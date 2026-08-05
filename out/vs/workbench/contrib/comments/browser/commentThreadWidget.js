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
import "./media/review.css";
import * as dom from "../../../../base/browser/dom.js";
import * as domStylesheets from "../../../../base/browser/domStylesheets.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import * as languages from "../../../../editor/common/languages.js";
import { CommentReply } from "./commentReply.js";
import { ICommentService } from "./commentService.js";
import { CommentThreadBody } from "./commentThreadBody.js";
import { CommentThreadHeader } from "./commentThreadHeader.js";
import { CommentThreadAdditionalActions } from "./commentThreadAdditionalActions.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { contrastBorder, focusBorder, inputValidationErrorBackground, inputValidationErrorBorder, inputValidationErrorForeground, textBlockQuoteBackground, textBlockQuoteBorder, textLinkActiveForeground, textLinkForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { PANEL_BORDER } from "../../../common/theme.js";
import { Range } from "../../../../editor/common/core/range.js";
import { commentThreadStateBackgroundColorVar, commentThreadStateColorVar } from "./commentColors.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { COMMENTS_SECTION } from "../common/commentsConfiguration.js";
import { localize } from "../../../../nls.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
const COMMENTEDITOR_DECORATION_KEY = "commenteditordecoration";
let CommentThreadWidget = class extends Disposable {
  constructor(container, _parentEditor, _owner, _parentResourceUri, _contextKeyService, _scopedInstantiationService, _commentThread, _pendingComment, _pendingEdits, _markdownOptions, _commentOptions, _containerDelegate, commentService, configurationService, _keybindingService) {
    super();
    this.container = container;
    this._parentEditor = _parentEditor;
    this._owner = _owner;
    this._parentResourceUri = _parentResourceUri;
    this._contextKeyService = _contextKeyService;
    this._scopedInstantiationService = _scopedInstantiationService;
    this._commentThread = _commentThread;
    this._pendingComment = _pendingComment;
    this._pendingEdits = _pendingEdits;
    this._markdownOptions = _markdownOptions;
    this._commentOptions = _commentOptions;
    this._containerDelegate = _containerDelegate;
    this.commentService = commentService;
    this.configurationService = configurationService;
    this._keybindingService = _keybindingService;
    this._commentThreadDisposables = [];
    this._onDidResize = new Emitter();
    this.onDidResize = this._onDidResize.event;
    this._threadIsEmpty = CommentContextKeys.commentThreadIsEmpty.bindTo(this._contextKeyService);
    this._threadIsEmpty.set(!_commentThread.comments || !_commentThread.comments.length);
    this._focusedContextKey = CommentContextKeys.commentFocused.bindTo(this._contextKeyService);
    this._commentMenus = this.commentService.getCommentMenus(this._owner);
    this._register(this._header = this._scopedInstantiationService.createInstance(
      CommentThreadHeader,
      container,
      {
        collapse: this._containerDelegate.collapse.bind(this)
      },
      this._commentMenus,
      this._commentThread
    ));
    this._header.updateCommentThread(this._commentThread);
    const bodyElement = dom.$(".body");
    container.appendChild(bodyElement);
    this._register(toDisposable(() => bodyElement.remove()));
    const tracker = this._register(dom.trackFocus(bodyElement));
    this._register(registerNavigableContainer({
      name: "commentThreadWidget",
      focusNotifiers: [tracker],
      focusNextWidget: () => {
        if (!this._commentReply?.isCommentEditorFocused()) {
          this._commentReply?.expandReplyAreaAndFocusCommentEditor();
        }
      },
      focusPreviousWidget: () => {
        if (this._commentReply?.isCommentEditorFocused() && this._commentThread.comments?.length) {
          this._body.focus();
        }
      }
    }));
    this._register(tracker.onDidFocus(() => this._focusedContextKey.set(true)));
    this._register(tracker.onDidBlur(() => this._focusedContextKey.reset()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.Comments)) {
        this._setAriaLabel();
      }
    }));
    this._body = this._scopedInstantiationService.createInstance(
      CommentThreadBody,
      this._parentEditor,
      this._owner,
      this._parentResourceUri,
      bodyElement,
      this._markdownOptions,
      this._commentThread,
      this._pendingEdits,
      this._scopedInstantiationService,
      this
    );
    this._register(this._body);
    this._setAriaLabel();
    this._styleElement = domStylesheets.createStyleSheet(this.container);
    this._commentThreadContextValue = CommentContextKeys.commentThreadContext.bindTo(this._contextKeyService);
    this._commentThreadContextValue.set(_commentThread.contextValue);
    const commentControllerKey = CommentContextKeys.commentControllerContext.bindTo(this._contextKeyService);
    const controller = this.commentService.getCommentController(this._owner);
    if (controller?.contextValue) {
      commentControllerKey.set(controller.contextValue);
    }
    this.currentThreadListeners();
  }
  get commentThread() {
    return this._commentThread;
  }
  get hasUnsubmittedComments() {
    return !!this._commentReply?.commentEditor.getValue() || this._body.hasCommentsInEditMode();
  }
  _setAriaLabel() {
    let ariaLabel = localize("commentLabel", "Comment");
    let keybinding;
    const verbose = this.configurationService.getValue(AccessibilityVerbositySettingId.Comments);
    if (verbose) {
      keybinding = this._keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp, this._contextKeyService)?.getLabel() ?? void 0;
    }
    if (keybinding) {
      ariaLabel = localize("commentLabelWithKeybinding", "{0}, use ({1}) for accessibility help", ariaLabel, keybinding);
    } else if (verbose) {
      ariaLabel = localize("commentLabelWithKeybindingNoKeybinding", "{0}, run the command Open Accessibility Help which is currently not triggerable via keybinding.", ariaLabel);
    }
    this._body.container.ariaLabel = ariaLabel;
  }
  updateCurrentThread(hasMouse, hasFocus) {
    if (hasMouse || hasFocus) {
      this.commentService.setCurrentCommentThread(this.commentThread);
    } else {
      this.commentService.setCurrentCommentThread(void 0);
    }
  }
  currentThreadListeners() {
    let hasMouse = false;
    let hasFocus = false;
    this._register(dom.addDisposableListener(this.container, dom.EventType.MOUSE_ENTER, (e) => {
      if (e.toElement === this.container) {
        hasMouse = true;
        this.updateCurrentThread(hasMouse, hasFocus);
      }
    }, true));
    this._register(dom.addDisposableListener(this.container, dom.EventType.MOUSE_LEAVE, (e) => {
      if (e.fromElement === this.container) {
        hasMouse = false;
        this.updateCurrentThread(hasMouse, hasFocus);
      }
    }, true));
    this._register(dom.addDisposableListener(this.container, dom.EventType.FOCUS_IN, () => {
      hasFocus = true;
      this.updateCurrentThread(hasMouse, hasFocus);
    }, true));
    this._register(dom.addDisposableListener(this.container, dom.EventType.FOCUS_OUT, () => {
      hasFocus = false;
      this.updateCurrentThread(hasMouse, hasFocus);
    }, true));
  }
  async updateCommentThread(commentThread) {
    const shouldCollapse = this._commentThread.collapsibleState === languages.CommentThreadCollapsibleState.Expanded && this._commentThreadState === languages.CommentThreadState.Unresolved && commentThread.state === languages.CommentThreadState.Resolved;
    this._commentThreadState = commentThread.state;
    this._commentThread = commentThread;
    dispose(this._commentThreadDisposables);
    this._commentThreadDisposables = [];
    this._bindCommentThreadListeners();
    await this._body.updateCommentThread(commentThread, this._commentReply?.isCommentEditorFocused() ?? false);
    this._threadIsEmpty.set(!this._body.length);
    this._header.updateCommentThread(commentThread);
    this._commentReply?.updateCommentThread(commentThread);
    if (this._commentThread.contextValue) {
      this._commentThreadContextValue.set(this._commentThread.contextValue);
    } else {
      this._commentThreadContextValue.reset();
    }
    if (shouldCollapse && this.configurationService.getValue(COMMENTS_SECTION).collapseOnResolve) {
      this.collapse();
    }
  }
  async display(lineHeight, focus) {
    const headHeight = Math.max(23, Math.ceil(lineHeight * 1.2));
    this._header.updateHeight(headHeight);
    await this._body.display();
    if (this._commentThread.canReply) {
      this._createCommentForm(focus);
    }
    this._createAdditionalActions();
    this._register(this._body.onDidResize((dimension) => {
      this._refresh(dimension);
    }));
    if (this._commentThread.canReply && this._commentReply) {
      this._commentReply.focusIfNeeded();
    }
    this._bindCommentThreadListeners();
  }
  _refresh(dimension) {
    this._body.layout();
    this._onDidResize.fire(dimension);
  }
  dispose() {
    super.dispose();
    dispose(this._commentThreadDisposables);
    this.updateCurrentThread(false, false);
  }
  _bindCommentThreadListeners() {
    this._commentThreadDisposables.push(this._commentThread.onDidChangeCanReply(() => {
      if (this._commentReply) {
        this._commentReply.updateCanReply();
      } else {
        if (this._commentThread.canReply) {
          this._createCommentForm(false);
        }
      }
    }));
    this._commentThreadDisposables.push(this._commentThread.onDidChangeComments(async (_) => {
      await this.updateCommentThread(this._commentThread);
    }));
    this._commentThreadDisposables.push(this._commentThread.onDidChangeLabel((_) => {
      this._header.createThreadLabel();
    }));
  }
  _createCommentForm(focus) {
    this._commentReply = this._scopedInstantiationService.createInstance(
      CommentReply,
      this._owner,
      this._body.container,
      this._parentEditor,
      this._commentThread,
      this._scopedInstantiationService,
      this._contextKeyService,
      this._commentMenus,
      this._commentOptions,
      this._pendingComment,
      this,
      focus,
      this._containerDelegate.actionRunner
    );
    this._register(this._commentReply);
  }
  _createAdditionalActions() {
    this._additionalActions = this._scopedInstantiationService.createInstance(
      CommentThreadAdditionalActions,
      this._body.container,
      this._commentThread,
      this._contextKeyService,
      this._commentMenus,
      this._containerDelegate.actionRunner
    );
    this._register(this._additionalActions);
  }
  getCommentCoords(commentUniqueId) {
    return this._body.getCommentCoords(commentUniqueId);
  }
  getPendingEdits() {
    return this._body.getPendingEdits();
  }
  getPendingComment() {
    if (this._commentReply) {
      return this._commentReply.getPendingComment();
    }
    return void 0;
  }
  setPendingComment(pending) {
    this._pendingComment = pending;
    this._commentReply?.setPendingComment(pending);
  }
  getDimensions() {
    return this._body.getDimensions();
  }
  layout(widthInPixel) {
    this._body.layout(widthInPixel);
    if (widthInPixel !== void 0) {
      this._commentReply?.layout(widthInPixel);
    }
  }
  ensureFocusIntoNewEditingComment() {
    this._body.ensureFocusIntoNewEditingComment();
  }
  focusCommentEditor() {
    this._commentReply?.expandReplyAreaAndFocusCommentEditor();
  }
  focus(commentUniqueId) {
    this._body.focus(commentUniqueId);
  }
  async submitComment() {
    const activeComment = this._body.activeComment;
    if (activeComment) {
      return activeComment.submitComment();
    } else if ((this._commentReply?.getPendingComment()?.body.length ?? 0) > 0) {
      return this._commentReply?.submitComment();
    }
  }
  async collapse() {
    if (await this._containerDelegate.collapse() && Range.isIRange(this.commentThread.range) && isCodeEditor(this._parentEditor)) {
      this._parentEditor.setSelection(this.commentThread.range);
    }
  }
  applyTheme(theme, fontInfo) {
    const content = [];
    content.push(`.monaco-editor .review-widget > .body { border-top: 1px solid var(${commentThreadStateColorVar}) }`);
    content.push(`.monaco-editor .review-widget > .head { background-color: var(${commentThreadStateBackgroundColorVar}) }`);
    const linkColor = theme.getColor(textLinkForeground);
    if (linkColor) {
      content.push(`.review-widget .body .comment-body a { color: ${linkColor} }`);
    }
    const linkActiveColor = theme.getColor(textLinkActiveForeground);
    if (linkActiveColor) {
      content.push(`.review-widget .body .comment-body a:hover, a:active { color: ${linkActiveColor} }`);
    }
    const focusColor = theme.getColor(focusBorder);
    if (focusColor) {
      content.push(`.review-widget .body .comment-body a:focus { outline: 1px solid ${focusColor}; }`);
      content.push(`.review-widget .body .monaco-editor.focused { outline: 1px solid ${focusColor}; }`);
    }
    const blockQuoteBackground = theme.getColor(textBlockQuoteBackground);
    if (blockQuoteBackground) {
      content.push(`.review-widget .body .review-comment blockquote { background: ${blockQuoteBackground}; }`);
    }
    const blockQuoteBOrder = theme.getColor(textBlockQuoteBorder);
    if (blockQuoteBOrder) {
      content.push(`.review-widget .body .review-comment blockquote { border-color: ${blockQuoteBOrder}; }`);
    }
    const border = theme.getColor(PANEL_BORDER);
    if (border) {
      content.push(`.review-widget .body .review-comment .review-comment-contents .comment-reactions .action-item a.action-label { border-color: ${border}; }`);
    }
    const hcBorder = theme.getColor(contrastBorder);
    if (hcBorder) {
      content.push(`.review-widget .body .comment-form .review-thread-reply-button { outline-color: ${hcBorder}; }`);
      content.push(`.review-widget .body .monaco-editor { outline: 1px solid ${hcBorder}; }`);
    }
    const errorBorder = theme.getColor(inputValidationErrorBorder);
    if (errorBorder) {
      content.push(`.review-widget .validation-error { border: 1px solid ${errorBorder}; }`);
    }
    const errorBackground = theme.getColor(inputValidationErrorBackground);
    if (errorBackground) {
      content.push(`.review-widget .validation-error { background: ${errorBackground}; }`);
    }
    const errorForeground = theme.getColor(inputValidationErrorForeground);
    if (errorForeground) {
      content.push(`.review-widget .body .comment-form .validation-error { color: ${errorForeground}; }`);
    }
    const fontFamilyVar = "--comment-thread-editor-font-family";
    const fontSizeVar = "--comment-thread-editor-font-size";
    const fontWeightVar = "--comment-thread-editor-font-weight";
    this.container?.style.setProperty(fontFamilyVar, fontInfo.fontFamily);
    this.container?.style.setProperty(fontSizeVar, `${fontInfo.fontSize}px`);
    this.container?.style.setProperty(fontWeightVar, fontInfo.fontWeight);
    content.push(`.review-widget .body code {
			font-family: var(${fontFamilyVar});
			font-weight: var(${fontWeightVar});
		}`);
    this._styleElement.textContent = content.join("\n");
    this._commentReply?.setCommentEditorDecorations();
  }
};
CommentThreadWidget = __decorateClass([
  __decorateParam(12, ICommentService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IKeybindingService)
], CommentThreadWidget);
export {
  COMMENTEDITOR_DECORATION_KEY,
  CommentThreadWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRUaHJlYWRXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvcmV2aWV3LmNzcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlcyBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25SZW5kZXJlck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbWFya2Rvd25SZW5kZXJlci9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb21tZW50TWVudXMgfSBmcm9tICcuL2NvbW1lbnRNZW51cy5qcyc7XG5pbXBvcnQgeyBDb21tZW50UmVwbHkgfSBmcm9tICcuL2NvbW1lbnRSZXBseS5qcyc7XG5pbXBvcnQgeyBJQ29tbWVudFNlcnZpY2UgfSBmcm9tICcuL2NvbW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbW1lbnRUaHJlYWRCb2R5IH0gZnJvbSAnLi9jb21tZW50VGhyZWFkQm9keS5qcyc7XG5pbXBvcnQgeyBDb21tZW50VGhyZWFkSGVhZGVyIH0gZnJvbSAnLi9jb21tZW50VGhyZWFkSGVhZGVyLmpzJztcbmltcG9ydCB7IENvbW1lbnRUaHJlYWRBZGRpdGlvbmFsQWN0aW9ucyB9IGZyb20gJy4vY29tbWVudFRocmVhZEFkZGl0aW9uYWxBY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbW1lbnRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jb21tZW50Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUNvbW1lbnRUaHJlYWRXaWRnZXQgfSBmcm9tICcuLi9jb21tb24vY29tbWVudFRocmVhZFdpZGdldC5qcyc7XG5pbXBvcnQgeyBJQ29sb3JUaGVtZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY29udHJhc3RCb3JkZXIsIGZvY3VzQm9yZGVyLCBpbnB1dFZhbGlkYXRpb25FcnJvckJhY2tncm91bmQsIGlucHV0VmFsaWRhdGlvbkVycm9yQm9yZGVyLCBpbnB1dFZhbGlkYXRpb25FcnJvckZvcmVncm91bmQsIHRleHRCbG9ja1F1b3RlQmFja2dyb3VuZCwgdGV4dEJsb2NrUXVvdGVCb3JkZXIsIHRleHRMaW5rQWN0aXZlRm9yZWdyb3VuZCwgdGV4dExpbmtGb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUEFORUxfQk9SREVSIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgY29tbWVudFRocmVhZFN0YXRlQmFja2dyb3VuZENvbG9yVmFyLCBjb21tZW50VGhyZWFkU3RhdGVDb2xvclZhciB9IGZyb20gJy4vY29tbWVudENvbG9ycy5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgRm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlck5hdmlnYWJsZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93aWRnZXROYXZpZ2F0aW9uQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDT01NRU5UU19TRUNUSU9OLCBJQ29tbWVudHNDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvbW1lbnRzQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUNvbW1hbmRJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHlDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBMYXlvdXRhYmxlRWRpdG9yIH0gZnJvbSAnLi9zaW1wbGVDb21tZW50RWRpdG9yLmpzJztcbmltcG9ydCB7IGlzQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVEVESVRPUl9ERUNPUkFUSU9OX0tFWSA9ICdjb21tZW50ZWRpdG9yZGVjb3JhdGlvbic7XG5cbmV4cG9ydCBjbGFzcyBDb21tZW50VGhyZWFkV2lkZ2V0PFQgZXh0ZW5kcyBJUmFuZ2UgfCBJQ2VsbFJhbmdlID0gSVJhbmdlPiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ29tbWVudFRocmVhZFdpZGdldCB7XG5cdHByaXZhdGUgX2hlYWRlciE6IENvbW1lbnRUaHJlYWRIZWFkZXI8VD47XG5cdHByaXZhdGUgX2JvZHk6IENvbW1lbnRUaHJlYWRCb2R5PFQ+O1xuXHRwcml2YXRlIF9jb21tZW50UmVwbHk/OiBDb21tZW50UmVwbHk8VD47XG5cdHByaXZhdGUgX2FkZGl0aW9uYWxBY3Rpb25zPzogQ29tbWVudFRocmVhZEFkZGl0aW9uYWxBY3Rpb25zPFQ+O1xuXHRwcml2YXRlIF9jb21tZW50TWVudXM6IENvbW1lbnRNZW51cztcblx0cHJpdmF0ZSBfY29tbWVudFRocmVhZERpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdHByaXZhdGUgX3RocmVhZElzRW1wdHk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9zdHlsZUVsZW1lbnQ6IEhUTUxTdHlsZUVsZW1lbnQ7XG5cdHByaXZhdGUgX2NvbW1lbnRUaHJlYWRDb250ZXh0VmFsdWU6IElDb250ZXh0S2V5PHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgX2ZvY3VzZWRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfb25EaWRSZXNpemUgPSBuZXcgRW1pdHRlcjxkb20uRGltZW5zaW9uPigpO1xuXHRvbkRpZFJlc2l6ZSA9IHRoaXMuX29uRGlkUmVzaXplLmV2ZW50O1xuXG5cdHByaXZhdGUgX2NvbW1lbnRUaHJlYWRTdGF0ZTogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRTdGF0ZSB8IHVuZGVmaW5lZDtcblxuXHRnZXQgY29tbWVudFRocmVhZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fY29tbWVudFRocmVhZDtcblx0fVxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHJlYWRvbmx5IF9wYXJlbnRFZGl0b3I6IExheW91dGFibGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSBfb3duZXI6IHN0cmluZyxcblx0XHRwcml2YXRlIF9wYXJlbnRSZXNvdXJjZVVyaTogVVJJLFxuXHRcdHByaXZhdGUgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRwcml2YXRlIF9jb21tZW50VGhyZWFkOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZDxUPixcblx0XHRwcml2YXRlIF9wZW5kaW5nQ29tbWVudDogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgX3BlbmRpbmdFZGl0czogeyBba2V5OiBudW1iZXJdOiBsYW5ndWFnZXMuUGVuZGluZ0NvbW1lbnQgfSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIF9tYXJrZG93bk9wdGlvbnM6IElNYXJrZG93blJlbmRlcmVyT3B0aW9ucyxcblx0XHRwcml2YXRlIF9jb21tZW50T3B0aW9uczogbGFuZ3VhZ2VzLkNvbW1lbnRPcHRpb25zIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgX2NvbnRhaW5lckRlbGVnYXRlOiB7XG5cdFx0XHRhY3Rpb25SdW5uZXI6ICgoKSA9PiB2b2lkKSB8IG51bGw7XG5cdFx0XHRjb2xsYXBzZTogKCkgPT4gUHJvbWlzZTxib29sZWFuPjtcblx0XHR9LFxuXHRcdEBJQ29tbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tZW50U2VydmljZTogSUNvbW1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fdGhyZWFkSXNFbXB0eSA9IENvbW1lbnRDb250ZXh0S2V5cy5jb21tZW50VGhyZWFkSXNFbXB0eS5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3RocmVhZElzRW1wdHkuc2V0KCFfY29tbWVudFRocmVhZC5jb21tZW50cyB8fCAhX2NvbW1lbnRUaHJlYWQuY29tbWVudHMubGVuZ3RoKTtcblx0XHR0aGlzLl9mb2N1c2VkQ29udGV4dEtleSA9IENvbW1lbnRDb250ZXh0S2V5cy5jb21tZW50Rm9jdXNlZC5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fY29tbWVudE1lbnVzID0gdGhpcy5jb21tZW50U2VydmljZS5nZXRDb21tZW50TWVudXModGhpcy5fb3duZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5faGVhZGVyID0gdGhpcy5fc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRDb21tZW50VGhyZWFkSGVhZGVyLFxuXHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0e1xuXHRcdFx0XHRjb2xsYXBzZTogdGhpcy5fY29udGFpbmVyRGVsZWdhdGUuY29sbGFwc2UuYmluZCh0aGlzKVxuXHRcdFx0fSxcblx0XHRcdHRoaXMuX2NvbW1lbnRNZW51cyxcblx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRcblx0XHQpKTtcblxuXHRcdHRoaXMuX2hlYWRlci51cGRhdGVDb21tZW50VGhyZWFkKHRoaXMuX2NvbW1lbnRUaHJlYWQpO1xuXG5cdFx0Y29uc3QgYm9keUVsZW1lbnQgPSA8SFRNTERpdkVsZW1lbnQ+ZG9tLiQoJy5ib2R5Jyk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGJvZHlFbGVtZW50KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gYm9keUVsZW1lbnQucmVtb3ZlKCkpKTtcblxuXHRcdGNvbnN0IHRyYWNrZXIgPSB0aGlzLl9yZWdpc3Rlcihkb20udHJhY2tGb2N1cyhib2R5RWxlbWVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyTmF2aWdhYmxlQ29udGFpbmVyKHtcblx0XHRcdG5hbWU6ICdjb21tZW50VGhyZWFkV2lkZ2V0Jyxcblx0XHRcdGZvY3VzTm90aWZpZXJzOiBbdHJhY2tlcl0sXG5cdFx0XHRmb2N1c05leHRXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLl9jb21tZW50UmVwbHk/LmlzQ29tbWVudEVkaXRvckZvY3VzZWQoKSkge1xuXHRcdFx0XHRcdHRoaXMuX2NvbW1lbnRSZXBseT8uZXhwYW5kUmVwbHlBcmVhQW5kRm9jdXNDb21tZW50RWRpdG9yKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmb2N1c1ByZXZpb3VzV2lkZ2V0OiAoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl9jb21tZW50UmVwbHk/LmlzQ29tbWVudEVkaXRvckZvY3VzZWQoKSAmJiB0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzPy5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLl9ib2R5LmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHRoaXMuX2ZvY3VzZWRDb250ZXh0S2V5LnNldCh0cnVlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRyYWNrZXIub25EaWRCbHVyKCgpID0+IHRoaXMuX2ZvY3VzZWRDb250ZXh0S2V5LnJlc2V0KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ29tbWVudHMpKSB7XG5cdFx0XHRcdHRoaXMuX3NldEFyaWFMYWJlbCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9ib2R5ID0gdGhpcy5fc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRDb21tZW50VGhyZWFkQm9keSxcblx0XHRcdHRoaXMuX3BhcmVudEVkaXRvcixcblx0XHRcdHRoaXMuX293bmVyLFxuXHRcdFx0dGhpcy5fcGFyZW50UmVzb3VyY2VVcmksXG5cdFx0XHRib2R5RWxlbWVudCxcblx0XHRcdHRoaXMuX21hcmtkb3duT3B0aW9ucyxcblx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWQsXG5cdFx0XHR0aGlzLl9wZW5kaW5nRWRpdHMsXG5cdFx0XHR0aGlzLl9zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdHRoaXNcblx0XHQpIGFzIHVua25vd24gYXMgQ29tbWVudFRocmVhZEJvZHk8VD47XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fYm9keSk7XG5cdFx0dGhpcy5fc2V0QXJpYUxhYmVsKCk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50ID0gZG9tU3R5bGVzaGVldHMuY3JlYXRlU3R5bGVTaGVldCh0aGlzLmNvbnRhaW5lcik7XG5cblxuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRDb250ZXh0VmFsdWUgPSBDb21tZW50Q29udGV4dEtleXMuY29tbWVudFRocmVhZENvbnRleHQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jb21tZW50VGhyZWFkQ29udGV4dFZhbHVlLnNldChfY29tbWVudFRocmVhZC5jb250ZXh0VmFsdWUpO1xuXG5cdFx0Y29uc3QgY29tbWVudENvbnRyb2xsZXJLZXkgPSBDb21tZW50Q29udGV4dEtleXMuY29tbWVudENvbnRyb2xsZXJDb250ZXh0LmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IHRoaXMuY29tbWVudFNlcnZpY2UuZ2V0Q29tbWVudENvbnRyb2xsZXIodGhpcy5fb3duZXIpO1xuXG5cdFx0aWYgKGNvbnRyb2xsZXI/LmNvbnRleHRWYWx1ZSkge1xuXHRcdFx0Y29tbWVudENvbnRyb2xsZXJLZXkuc2V0KGNvbnRyb2xsZXIuY29udGV4dFZhbHVlKTtcblx0XHR9XG5cblx0XHR0aGlzLmN1cnJlbnRUaHJlYWRMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdGdldCBoYXNVbnN1Ym1pdHRlZENvbW1lbnRzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX2NvbW1lbnRSZXBseT8uY29tbWVudEVkaXRvci5nZXRWYWx1ZSgpIHx8IHRoaXMuX2JvZHkuaGFzQ29tbWVudHNJbkVkaXRNb2RlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRBcmlhTGFiZWwoKTogdm9pZCB7XG5cdFx0bGV0IGFyaWFMYWJlbCA9IGxvY2FsaXplKCdjb21tZW50TGFiZWwnLCBcIkNvbW1lbnRcIik7XG5cdFx0bGV0IGtleWJpbmRpbmc6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCB2ZXJib3NlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLkNvbW1lbnRzKTtcblx0XHRpZiAodmVyYm9zZSkge1xuXHRcdFx0a2V5YmluZGluZyA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5PcGVuQWNjZXNzaWJpbGl0eUhlbHAsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKT8uZ2V0TGFiZWwoKSA/PyB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRhcmlhTGFiZWwgPSBsb2NhbGl6ZSgnY29tbWVudExhYmVsV2l0aEtleWJpbmRpbmcnLCBcInswfSwgdXNlICh7MX0pIGZvciBhY2Nlc3NpYmlsaXR5IGhlbHBcIiwgYXJpYUxhYmVsLCBrZXliaW5kaW5nKTtcblx0XHR9IGVsc2UgaWYgKHZlcmJvc2UpIHtcblx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdjb21tZW50TGFiZWxXaXRoS2V5YmluZGluZ05vS2V5YmluZGluZycsIFwiezB9LCBydW4gdGhlIGNvbW1hbmQgT3BlbiBBY2Nlc3NpYmlsaXR5IEhlbHAgd2hpY2ggaXMgY3VycmVudGx5IG5vdCB0cmlnZ2VyYWJsZSB2aWEga2V5YmluZGluZy5cIiwgYXJpYUxhYmVsKTtcblx0XHR9XG5cdFx0dGhpcy5fYm9keS5jb250YWluZXIuYXJpYUxhYmVsID0gYXJpYUxhYmVsO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDdXJyZW50VGhyZWFkKGhhc01vdXNlOiBib29sZWFuLCBoYXNGb2N1czogYm9vbGVhbikge1xuXHRcdGlmIChoYXNNb3VzZSB8fCBoYXNGb2N1cykge1xuXHRcdFx0dGhpcy5jb21tZW50U2VydmljZS5zZXRDdXJyZW50Q29tbWVudFRocmVhZCh0aGlzLmNvbW1lbnRUaHJlYWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNvbW1lbnRTZXJ2aWNlLnNldEN1cnJlbnRDb21tZW50VGhyZWFkKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjdXJyZW50VGhyZWFkTGlzdGVuZXJzKCkge1xuXHRcdGxldCBoYXNNb3VzZSA9IGZhbHNlO1xuXHRcdGxldCBoYXNGb2N1cyA9IGZhbHNlO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIGRvbS5FdmVudFR5cGUuTU9VU0VfRU5URVIsIChlKSA9PiB7XG5cdFx0XHRpZiAoKDxhbnk+ZSkudG9FbGVtZW50ID09PSB0aGlzLmNvbnRhaW5lcikge1xuXHRcdFx0XHRoYXNNb3VzZSA9IHRydWU7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ3VycmVudFRocmVhZChoYXNNb3VzZSwgaGFzRm9jdXMpO1xuXHRcdFx0fVxuXHRcdH0sIHRydWUpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuY29udGFpbmVyLCBkb20uRXZlbnRUeXBlLk1PVVNFX0xFQVZFLCAoZSkgPT4ge1xuXHRcdFx0aWYgKCg8YW55PmUpLmZyb21FbGVtZW50ID09PSB0aGlzLmNvbnRhaW5lcikge1xuXHRcdFx0XHRoYXNNb3VzZSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUN1cnJlbnRUaHJlYWQoaGFzTW91c2UsIGhhc0ZvY3VzKTtcblx0XHRcdH1cblx0XHR9LCB0cnVlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgZG9tLkV2ZW50VHlwZS5GT0NVU19JTiwgKCkgPT4ge1xuXHRcdFx0aGFzRm9jdXMgPSB0cnVlO1xuXHRcdFx0dGhpcy51cGRhdGVDdXJyZW50VGhyZWFkKGhhc01vdXNlLCBoYXNGb2N1cyk7XG5cdFx0fSwgdHJ1ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIGRvbS5FdmVudFR5cGUuRk9DVVNfT1VULCAoKSA9PiB7XG5cdFx0XHRoYXNGb2N1cyA9IGZhbHNlO1xuXHRcdFx0dGhpcy51cGRhdGVDdXJyZW50VGhyZWFkKGhhc01vdXNlLCBoYXNGb2N1cyk7XG5cdFx0fSwgdHJ1ZSkpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlQ29tbWVudFRocmVhZChjb21tZW50VGhyZWFkOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZDxUPikge1xuXHRcdGNvbnN0IHNob3VsZENvbGxhcHNlID0gKHRoaXMuX2NvbW1lbnRUaHJlYWQuY29sbGFwc2libGVTdGF0ZSA9PT0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlLkV4cGFuZGVkKSAmJiAodGhpcy5fY29tbWVudFRocmVhZFN0YXRlID09PSBsYW5ndWFnZXMuQ29tbWVudFRocmVhZFN0YXRlLlVucmVzb2x2ZWQpXG5cdFx0XHQmJiAoY29tbWVudFRocmVhZC5zdGF0ZSA9PT0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRTdGF0ZS5SZXNvbHZlZCk7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZFN0YXRlID0gY29tbWVudFRocmVhZC5zdGF0ZTtcblx0XHR0aGlzLl9jb21tZW50VGhyZWFkID0gY29tbWVudFRocmVhZDtcblx0XHRkaXNwb3NlKHRoaXMuX2NvbW1lbnRUaHJlYWREaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZERpc3Bvc2FibGVzID0gW107XG5cdFx0dGhpcy5fYmluZENvbW1lbnRUaHJlYWRMaXN0ZW5lcnMoKTtcblxuXHRcdGF3YWl0IHRoaXMuX2JvZHkudXBkYXRlQ29tbWVudFRocmVhZChjb21tZW50VGhyZWFkLCB0aGlzLl9jb21tZW50UmVwbHk/LmlzQ29tbWVudEVkaXRvckZvY3VzZWQoKSA/PyBmYWxzZSk7XG5cdFx0dGhpcy5fdGhyZWFkSXNFbXB0eS5zZXQoIXRoaXMuX2JvZHkubGVuZ3RoKTtcblx0XHR0aGlzLl9oZWFkZXIudXBkYXRlQ29tbWVudFRocmVhZChjb21tZW50VGhyZWFkKTtcblx0XHR0aGlzLl9jb21tZW50UmVwbHk/LnVwZGF0ZUNvbW1lbnRUaHJlYWQoY29tbWVudFRocmVhZCk7XG5cblx0XHRpZiAodGhpcy5fY29tbWVudFRocmVhZC5jb250ZXh0VmFsdWUpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRDb250ZXh0VmFsdWUuc2V0KHRoaXMuX2NvbW1lbnRUaHJlYWQuY29udGV4dFZhbHVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY29tbWVudFRocmVhZENvbnRleHRWYWx1ZS5yZXNldCgpO1xuXHRcdH1cblxuXHRcdGlmIChzaG91bGRDb2xsYXBzZSAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElDb21tZW50c0NvbmZpZ3VyYXRpb24+KENPTU1FTlRTX1NFQ1RJT04pLmNvbGxhcHNlT25SZXNvbHZlKSB7XG5cdFx0XHR0aGlzLmNvbGxhcHNlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZGlzcGxheShsaW5lSGVpZ2h0OiBudW1iZXIsIGZvY3VzOiBib29sZWFuKSB7XG5cdFx0Y29uc3QgaGVhZEhlaWdodCA9IE1hdGgubWF4KDIzLCBNYXRoLmNlaWwobGluZUhlaWdodCAqIDEuMikpOyAvLyAyMyBpcyB0aGUgdmFsdWUgb2YgYE1hdGguY2VpbChsaW5lSGVpZ2h0ICogMS4yKWAgd2l0aCB0aGUgZGVmYXVsdCBlZGl0b3IgZm9udCBzaXplXG5cdFx0dGhpcy5faGVhZGVyLnVwZGF0ZUhlaWdodChoZWFkSGVpZ2h0KTtcblxuXHRcdGF3YWl0IHRoaXMuX2JvZHkuZGlzcGxheSgpO1xuXG5cdFx0Ly8gY3JlYXRlIGNvbW1lbnQgdGhyZWFkIG9ubHkgd2hlbiBpdCBzdXBwb3J0cyByZXBseVxuXHRcdGlmICh0aGlzLl9jb21tZW50VGhyZWFkLmNhblJlcGx5KSB7XG5cdFx0XHR0aGlzLl9jcmVhdGVDb21tZW50Rm9ybShmb2N1cyk7XG5cdFx0fVxuXHRcdHRoaXMuX2NyZWF0ZUFkZGl0aW9uYWxBY3Rpb25zKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ib2R5Lm9uRGlkUmVzaXplKGRpbWVuc2lvbiA9PiB7XG5cdFx0XHR0aGlzLl9yZWZyZXNoKGRpbWVuc2lvbik7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gSWYgdGhlcmUgYXJlIG5vIGV4aXN0aW5nIGNvbW1lbnRzLCBwbGFjZSBmb2N1cyBvbiB0aGUgdGV4dCBhcmVhLiBUaGlzIG11c3QgYmUgZG9uZSBhZnRlciBzaG93LCB3aGljaCBhbHNvIG1vdmVzIGZvY3VzLlxuXHRcdC8vIGlmIHRoaXMuX2NvbW1lbnRUaHJlYWQuY29tbWVudHMgaXMgdW5kZWZpbmVkLCBpdCBkb2Vzbid0IGZpbmlzaCBpbml0aWFsaXphdGlvbiB5ZXQsIHNvIHdlIGRvbid0IGZvY3VzIHRoZSBlZGl0b3IgaW1tZWRpYXRlbHkuXG5cdFx0aWYgKHRoaXMuX2NvbW1lbnRUaHJlYWQuY2FuUmVwbHkgJiYgdGhpcy5fY29tbWVudFJlcGx5KSB7XG5cdFx0XHR0aGlzLl9jb21tZW50UmVwbHkuZm9jdXNJZk5lZWRlZCgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2JpbmRDb21tZW50VGhyZWFkTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWZyZXNoKGRpbWVuc2lvbjogZG9tLkRpbWVuc2lvbikge1xuXHRcdHRoaXMuX2JvZHkubGF5b3V0KCk7XG5cdFx0dGhpcy5fb25EaWRSZXNpemUuZmlyZShkaW1lbnNpb24pO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0ZGlzcG9zZSh0aGlzLl9jb21tZW50VGhyZWFkRGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMudXBkYXRlQ3VycmVudFRocmVhZChmYWxzZSwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYmluZENvbW1lbnRUaHJlYWRMaXN0ZW5lcnMoKSB7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZERpc3Bvc2FibGVzLnB1c2godGhpcy5fY29tbWVudFRocmVhZC5vbkRpZENoYW5nZUNhblJlcGx5KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9jb21tZW50UmVwbHkpIHtcblx0XHRcdFx0dGhpcy5fY29tbWVudFJlcGx5LnVwZGF0ZUNhblJlcGx5KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAodGhpcy5fY29tbWVudFRocmVhZC5jYW5SZXBseSkge1xuXHRcdFx0XHRcdHRoaXMuX2NyZWF0ZUNvbW1lbnRGb3JtKGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWREaXNwb3NhYmxlcy5wdXNoKHRoaXMuX2NvbW1lbnRUaHJlYWQub25EaWRDaGFuZ2VDb21tZW50cyhhc3luYyBfID0+IHtcblx0XHRcdGF3YWl0IHRoaXMudXBkYXRlQ29tbWVudFRocmVhZCh0aGlzLl9jb21tZW50VGhyZWFkKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb21tZW50VGhyZWFkRGlzcG9zYWJsZXMucHVzaCh0aGlzLl9jb21tZW50VGhyZWFkLm9uRGlkQ2hhbmdlTGFiZWwoXyA9PiB7XG5cdFx0XHR0aGlzLl9oZWFkZXIuY3JlYXRlVGhyZWFkTGFiZWwoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVDb21tZW50Rm9ybShmb2N1czogYm9vbGVhbikge1xuXHRcdHRoaXMuX2NvbW1lbnRSZXBseSA9IHRoaXMuX3Njb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Q29tbWVudFJlcGx5LFxuXHRcdFx0dGhpcy5fb3duZXIsXG5cdFx0XHR0aGlzLl9ib2R5LmNvbnRhaW5lcixcblx0XHRcdHRoaXMuX3BhcmVudEVkaXRvcixcblx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWQsXG5cdFx0XHR0aGlzLl9zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fY29tbWVudE1lbnVzLFxuXHRcdFx0dGhpcy5fY29tbWVudE9wdGlvbnMsXG5cdFx0XHR0aGlzLl9wZW5kaW5nQ29tbWVudCxcblx0XHRcdHRoaXMsXG5cdFx0XHRmb2N1cyxcblx0XHRcdHRoaXMuX2NvbnRhaW5lckRlbGVnYXRlLmFjdGlvblJ1bm5lclxuXHRcdCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb21tZW50UmVwbHkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlQWRkaXRpb25hbEFjdGlvbnMoKSB7XG5cdFx0dGhpcy5fYWRkaXRpb25hbEFjdGlvbnMgPSB0aGlzLl9zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdENvbW1lbnRUaHJlYWRBZGRpdGlvbmFsQWN0aW9ucyxcblx0XHRcdHRoaXMuX2JvZHkuY29udGFpbmVyLFxuXHRcdFx0dGhpcy5fY29tbWVudFRocmVhZCxcblx0XHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fY29tbWVudE1lbnVzLFxuXHRcdFx0dGhpcy5fY29udGFpbmVyRGVsZWdhdGUuYWN0aW9uUnVubmVyLFxuXHRcdCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9hZGRpdGlvbmFsQWN0aW9ucyk7XG5cdH1cblxuXHRnZXRDb21tZW50Q29vcmRzKGNvbW1lbnRVbmlxdWVJZDogbnVtYmVyKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2JvZHkuZ2V0Q29tbWVudENvb3Jkcyhjb21tZW50VW5pcXVlSWQpO1xuXHR9XG5cblx0Z2V0UGVuZGluZ0VkaXRzKCk6IHsgW2tleTogbnVtYmVyXTogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IH0ge1xuXHRcdHJldHVybiB0aGlzLl9ib2R5LmdldFBlbmRpbmdFZGl0cygpO1xuXHR9XG5cblx0Z2V0UGVuZGluZ0NvbW1lbnQoKTogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5fY29tbWVudFJlcGx5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY29tbWVudFJlcGx5LmdldFBlbmRpbmdDb21tZW50KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHNldFBlbmRpbmdDb21tZW50KHBlbmRpbmc6IGxhbmd1YWdlcy5QZW5kaW5nQ29tbWVudCkge1xuXHRcdHRoaXMuX3BlbmRpbmdDb21tZW50ID0gcGVuZGluZztcblx0XHR0aGlzLl9jb21tZW50UmVwbHk/LnNldFBlbmRpbmdDb21tZW50KHBlbmRpbmcpO1xuXHR9XG5cblx0Z2V0RGltZW5zaW9ucygpIHtcblx0XHRyZXR1cm4gdGhpcy5fYm9keS5nZXREaW1lbnNpb25zKCk7XG5cdH1cblxuXHRsYXlvdXQod2lkdGhJblBpeGVsPzogbnVtYmVyKSB7XG5cdFx0dGhpcy5fYm9keS5sYXlvdXQod2lkdGhJblBpeGVsKTtcblxuXHRcdGlmICh3aWR0aEluUGl4ZWwgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fY29tbWVudFJlcGx5Py5sYXlvdXQod2lkdGhJblBpeGVsKTtcblx0XHR9XG5cdH1cblxuXHRlbnN1cmVGb2N1c0ludG9OZXdFZGl0aW5nQ29tbWVudCgpIHtcblx0XHR0aGlzLl9ib2R5LmVuc3VyZUZvY3VzSW50b05ld0VkaXRpbmdDb21tZW50KCk7XG5cdH1cblxuXHRmb2N1c0NvbW1lbnRFZGl0b3IoKSB7XG5cdFx0dGhpcy5fY29tbWVudFJlcGx5Py5leHBhbmRSZXBseUFyZWFBbmRGb2N1c0NvbW1lbnRFZGl0b3IoKTtcblx0fVxuXG5cdGZvY3VzKGNvbW1lbnRVbmlxdWVJZDogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fYm9keS5mb2N1cyhjb21tZW50VW5pcXVlSWQpO1xuXHR9XG5cblx0YXN5bmMgc3VibWl0Q29tbWVudCgpIHtcblx0XHRjb25zdCBhY3RpdmVDb21tZW50ID0gdGhpcy5fYm9keS5hY3RpdmVDb21tZW50O1xuXHRcdGlmIChhY3RpdmVDb21tZW50KSB7XG5cdFx0XHRyZXR1cm4gYWN0aXZlQ29tbWVudC5zdWJtaXRDb21tZW50KCk7XG5cdFx0fSBlbHNlIGlmICgodGhpcy5fY29tbWVudFJlcGx5Py5nZXRQZW5kaW5nQ29tbWVudCgpPy5ib2R5Lmxlbmd0aCA/PyAwKSA+IDApIHtcblx0XHRcdHJldHVybiB0aGlzLl9jb21tZW50UmVwbHk/LnN1Ym1pdENvbW1lbnQoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjb2xsYXBzZSgpIHtcblx0XHRpZiAoKGF3YWl0IHRoaXMuX2NvbnRhaW5lckRlbGVnYXRlLmNvbGxhcHNlKCkpICYmIFJhbmdlLmlzSVJhbmdlKHRoaXMuY29tbWVudFRocmVhZC5yYW5nZSkgJiYgaXNDb2RlRWRpdG9yKHRoaXMuX3BhcmVudEVkaXRvcikpIHtcblx0XHRcdHRoaXMuX3BhcmVudEVkaXRvci5zZXRTZWxlY3Rpb24odGhpcy5jb21tZW50VGhyZWFkLnJhbmdlKTtcblx0XHR9XG5cblx0fVxuXG5cdGFwcGx5VGhlbWUodGhlbWU6IElDb2xvclRoZW1lLCBmb250SW5mbzogRm9udEluZm8pIHtcblx0XHRjb25zdCBjb250ZW50OiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWVkaXRvciAucmV2aWV3LXdpZGdldCA+IC5ib2R5IHsgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigke2NvbW1lbnRUaHJlYWRTdGF0ZUNvbG9yVmFyfSkgfWApO1xuXHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1lZGl0b3IgLnJldmlldy13aWRnZXQgPiAuaGVhZCB7IGJhY2tncm91bmQtY29sb3I6IHZhcigke2NvbW1lbnRUaHJlYWRTdGF0ZUJhY2tncm91bmRDb2xvclZhcn0pIH1gKTtcblxuXHRcdGNvbnN0IGxpbmtDb2xvciA9IHRoZW1lLmdldENvbG9yKHRleHRMaW5rRm9yZWdyb3VuZCk7XG5cdFx0aWYgKGxpbmtDb2xvcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGAucmV2aWV3LXdpZGdldCAuYm9keSAuY29tbWVudC1ib2R5IGEgeyBjb2xvcjogJHtsaW5rQ29sb3J9IH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5rQWN0aXZlQ29sb3IgPSB0aGVtZS5nZXRDb2xvcih0ZXh0TGlua0FjdGl2ZUZvcmVncm91bmQpO1xuXHRcdGlmIChsaW5rQWN0aXZlQ29sb3IpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLnJldmlldy13aWRnZXQgLmJvZHkgLmNvbW1lbnQtYm9keSBhOmhvdmVyLCBhOmFjdGl2ZSB7IGNvbG9yOiAke2xpbmtBY3RpdmVDb2xvcn0gfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvY3VzQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihmb2N1c0JvcmRlcik7XG5cdFx0aWYgKGZvY3VzQ29sb3IpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLnJldmlldy13aWRnZXQgLmJvZHkgLmNvbW1lbnQtYm9keSBhOmZvY3VzIHsgb3V0bGluZTogMXB4IHNvbGlkICR7Zm9jdXNDb2xvcn07IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLnJldmlldy13aWRnZXQgLmJvZHkgLm1vbmFjby1lZGl0b3IuZm9jdXNlZCB7IG91dGxpbmU6IDFweCBzb2xpZCAke2ZvY3VzQ29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYmxvY2tRdW90ZUJhY2tncm91bmQgPSB0aGVtZS5nZXRDb2xvcih0ZXh0QmxvY2tRdW90ZUJhY2tncm91bmQpO1xuXHRcdGlmIChibG9ja1F1b3RlQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAucmV2aWV3LXdpZGdldCAuYm9keSAucmV2aWV3LWNvbW1lbnQgYmxvY2txdW90ZSB7IGJhY2tncm91bmQ6ICR7YmxvY2tRdW90ZUJhY2tncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYmxvY2tRdW90ZUJPcmRlciA9IHRoZW1lLmdldENvbG9yKHRleHRCbG9ja1F1b3RlQm9yZGVyKTtcblx0XHRpZiAoYmxvY2tRdW90ZUJPcmRlcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGAucmV2aWV3LXdpZGdldCAuYm9keSAucmV2aWV3LWNvbW1lbnQgYmxvY2txdW90ZSB7IGJvcmRlci1jb2xvcjogJHtibG9ja1F1b3RlQk9yZGVyfTsgfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJvcmRlciA9IHRoZW1lLmdldENvbG9yKFBBTkVMX0JPUkRFUik7XG5cdFx0aWYgKGJvcmRlcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGAucmV2aWV3LXdpZGdldCAuYm9keSAucmV2aWV3LWNvbW1lbnQgLnJldmlldy1jb21tZW50LWNvbnRlbnRzIC5jb21tZW50LXJlYWN0aW9ucyAuYWN0aW9uLWl0ZW0gYS5hY3Rpb24tbGFiZWwgeyBib3JkZXItY29sb3I6ICR7Ym9yZGVyfTsgfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhjQm9yZGVyID0gdGhlbWUuZ2V0Q29sb3IoY29udHJhc3RCb3JkZXIpO1xuXHRcdGlmIChoY0JvcmRlcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGAucmV2aWV3LXdpZGdldCAuYm9keSAuY29tbWVudC1mb3JtIC5yZXZpZXctdGhyZWFkLXJlcGx5LWJ1dHRvbiB7IG91dGxpbmUtY29sb3I6ICR7aGNCb3JkZXJ9OyB9YCk7XG5cdFx0XHRjb250ZW50LnB1c2goYC5yZXZpZXctd2lkZ2V0IC5ib2R5IC5tb25hY28tZWRpdG9yIHsgb3V0bGluZTogMXB4IHNvbGlkICR7aGNCb3JkZXJ9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXJyb3JCb3JkZXIgPSB0aGVtZS5nZXRDb2xvcihpbnB1dFZhbGlkYXRpb25FcnJvckJvcmRlcik7XG5cdFx0aWYgKGVycm9yQm9yZGVyKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5yZXZpZXctd2lkZ2V0IC52YWxpZGF0aW9uLWVycm9yIHsgYm9yZGVyOiAxcHggc29saWQgJHtlcnJvckJvcmRlcn07IH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBlcnJvckJhY2tncm91bmQgPSB0aGVtZS5nZXRDb2xvcihpbnB1dFZhbGlkYXRpb25FcnJvckJhY2tncm91bmQpO1xuXHRcdGlmIChlcnJvckJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLnJldmlldy13aWRnZXQgLnZhbGlkYXRpb24tZXJyb3IgeyBiYWNrZ3JvdW5kOiAke2Vycm9yQmFja2dyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBlcnJvckZvcmVncm91bmQgPSB0aGVtZS5nZXRDb2xvcihpbnB1dFZhbGlkYXRpb25FcnJvckZvcmVncm91bmQpO1xuXHRcdGlmIChlcnJvckZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLnJldmlldy13aWRnZXQgLmJvZHkgLmNvbW1lbnQtZm9ybSAudmFsaWRhdGlvbi1lcnJvciB7IGNvbG9yOiAke2Vycm9yRm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBmb250RmFtaWx5VmFyID0gJy0tY29tbWVudC10aHJlYWQtZWRpdG9yLWZvbnQtZmFtaWx5Jztcblx0XHRjb25zdCBmb250U2l6ZVZhciA9ICctLWNvbW1lbnQtdGhyZWFkLWVkaXRvci1mb250LXNpemUnO1xuXHRcdGNvbnN0IGZvbnRXZWlnaHRWYXIgPSAnLS1jb21tZW50LXRocmVhZC1lZGl0b3ItZm9udC13ZWlnaHQnO1xuXHRcdHRoaXMuY29udGFpbmVyPy5zdHlsZS5zZXRQcm9wZXJ0eShmb250RmFtaWx5VmFyLCBmb250SW5mby5mb250RmFtaWx5KTtcblx0XHR0aGlzLmNvbnRhaW5lcj8uc3R5bGUuc2V0UHJvcGVydHkoZm9udFNpemVWYXIsIGAke2ZvbnRJbmZvLmZvbnRTaXplfXB4YCk7XG5cdFx0dGhpcy5jb250YWluZXI/LnN0eWxlLnNldFByb3BlcnR5KGZvbnRXZWlnaHRWYXIsIGZvbnRJbmZvLmZvbnRXZWlnaHQpO1xuXG5cdFx0Y29udGVudC5wdXNoKGAucmV2aWV3LXdpZGdldCAuYm9keSBjb2RlIHtcblx0XHRcdGZvbnQtZmFtaWx5OiB2YXIoJHtmb250RmFtaWx5VmFyfSk7XG5cdFx0XHRmb250LXdlaWdodDogdmFyKCR7Zm9udFdlaWdodFZhcn0pO1xuXHRcdH1gKTtcblxuXHRcdHRoaXMuX3N0eWxlRWxlbWVudC50ZXh0Q29udGVudCA9IGNvbnRlbnQuam9pbignXFxuJyk7XG5cdFx0dGhpcy5fY29tbWVudFJlcGx5Py5zZXRDb21tZW50RWRpdG9yRGVjb3JhdGlvbnMoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFlBQVksb0JBQW9CO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVksU0FBc0Isb0JBQW9CO0FBRS9ELFlBQVksZUFBZTtBQUszQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLDBCQUEwQjtBQUduQyxTQUFTLGdCQUFnQixhQUFhLGdDQUFnQyw0QkFBNEIsZ0NBQWdDLDBCQUEwQixzQkFBc0IsMEJBQTBCLDBCQUEwQjtBQUN0TyxTQUFTLG9CQUFvQjtBQUM3QixTQUFpQixhQUFhO0FBQzlCLFNBQVMsc0NBQXNDLGtDQUFr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
