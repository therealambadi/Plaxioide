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
import { Color } from "../../../../base/common/color.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isCodeEditor, MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { Range } from "../../../../editor/common/core/range.js";
import * as languages from "../../../../editor/common/languages.js";
import { ZoneWidget } from "../../../../editor/contrib/zoneWidget/browser/zoneWidget.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { CommentGlyphWidget } from "./commentGlyphWidget.js";
import { ICommentService } from "./commentService.js";
import { EDITOR_FONT_DEFAULTS, EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { CommentThreadWidget } from "./commentThreadWidget.js";
import { commentThreadStateBackgroundColorVar, commentThreadStateColorVar, getCommentThreadStateBorderColor } from "./commentColors.js";
import { peekViewBorder } from "../../../../editor/contrib/peekView/browser/peekView.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { StableEditorScrollState } from "../../../../editor/browser/stableEditorScroll.js";
import Severity from "../../../../base/common/severity.js";
import * as nls from "../../../../nls.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
function getCommentThreadWidgetStateColor(thread, theme) {
  return getCommentThreadStateBorderColor(thread, theme) ?? theme.getColor(peekViewBorder);
}
var CommentWidgetFocus = /* @__PURE__ */ ((CommentWidgetFocus2) => {
  CommentWidgetFocus2[CommentWidgetFocus2["None"] = 0] = "None";
  CommentWidgetFocus2[CommentWidgetFocus2["Widget"] = 1] = "Widget";
  CommentWidgetFocus2[CommentWidgetFocus2["Editor"] = 2] = "Editor";
  return CommentWidgetFocus2;
})(CommentWidgetFocus || {});
function parseMouseDownInfoFromEvent(e) {
  const range = e.target.range;
  if (!range) {
    return null;
  }
  if (!e.event.leftButton) {
    return null;
  }
  if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
    return null;
  }
  const data = e.target.detail;
  const gutterOffsetX = data.offsetX - data.glyphMarginWidth - data.lineNumbersWidth - data.glyphMarginLeft;
  if (gutterOffsetX > 20) {
    return null;
  }
  return { lineNumber: range.startLineNumber };
}
function isMouseUpEventDragFromMouseDown(mouseDownInfo, e) {
  if (!mouseDownInfo) {
    return null;
  }
  const { lineNumber } = mouseDownInfo;
  const range = e.target.range;
  if (!range) {
    return null;
  }
  return lineNumber;
}
function isMouseUpEventMatchMouseDown(mouseDownInfo, e) {
  if (!mouseDownInfo) {
    return null;
  }
  const { lineNumber } = mouseDownInfo;
  const range = e.target.range;
  if (!range || range.startLineNumber !== lineNumber) {
    return null;
  }
  if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
    return null;
  }
  return lineNumber;
}
let ReviewZoneWidget = class extends ZoneWidget {
  constructor(editor, _uniqueOwner, _commentThread, _pendingComment, _pendingEdits, instantiationService, themeService, commentService, contextKeyService, configurationService, dialogService) {
    super(editor, { keepEditorSelection: true, isAccessible: true, showArrow: !!_commentThread.range });
    this._uniqueOwner = _uniqueOwner;
    this._commentThread = _commentThread;
    this._pendingComment = _pendingComment;
    this._pendingEdits = _pendingEdits;
    this.themeService = themeService;
    this.commentService = commentService;
    this.configurationService = configurationService;
    this.dialogService = dialogService;
    this._onDidClose = new Emitter();
    this._onDidCreateThread = new Emitter();
    this._globalToDispose = new DisposableStore();
    this._commentThreadDisposables = [];
    this._contextKeyService = contextKeyService.createScoped(this.domNode);
    this._scopedInstantiationService = this._globalToDispose.add(instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, this._contextKeyService]
    )));
    const controller = this.commentService.getCommentController(this._uniqueOwner);
    if (controller) {
      this._commentOptions = controller.options;
    }
    this._initialCollapsibleState = _pendingComment ? languages.CommentThreadCollapsibleState.Expanded : _commentThread.initialCollapsibleState;
    _commentThread.initialCollapsibleState = this._initialCollapsibleState;
    this._commentThreadDisposables = [];
    this.create();
    this._globalToDispose.add(this.themeService.onDidColorThemeChange(this._applyTheme, this));
    this._globalToDispose.add(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontInfo)) {
        this._applyTheme(this.themeService.getColorTheme());
      }
    }));
    this._applyTheme(this.themeService.getColorTheme());
  }
  get uniqueOwner() {
    return this._uniqueOwner;
  }
  get commentThread() {
    return this._commentThread;
  }
  get expanded() {
    return this._isExpanded;
  }
  get onDidClose() {
    return this._onDidClose.event;
  }
  get onDidCreateThread() {
    return this._onDidCreateThread.event;
  }
  getPosition() {
    if (this.position) {
      return this.position;
    }
    if (this._commentGlyph) {
      return this._commentGlyph.getPosition().position ?? void 0;
    }
    return void 0;
  }
  revealRange() {
  }
  reveal(commentUniqueId, focus = 0 /* None */) {
    this.makeVisible(commentUniqueId, focus);
    const comment = this._commentThread.comments?.find((comment2) => comment2.uniqueIdInThread === commentUniqueId) ?? this._commentThread.comments?.[0];
    this.commentService.setActiveCommentAndThread(this.uniqueOwner, { thread: this._commentThread, comment });
  }
  _expandAndShowZoneWidget() {
    if (!this._isExpanded) {
      this.show(this.arrowPosition(this._commentThread.range), 2);
    }
  }
  _setFocus(commentUniqueId, focus) {
    if (focus === 1 /* Widget */) {
      this._commentThreadWidget.focus(commentUniqueId);
    } else if (focus === 2 /* Editor */) {
      this._commentThreadWidget.focusCommentEditor();
    }
  }
  _goToComment(commentUniqueId, focus) {
    const height = this.editor.getLayoutInfo().height;
    const coords = this._commentThreadWidget.getCommentCoords(commentUniqueId);
    if (coords) {
      let scrollTop = 1;
      if (this._commentThread.range) {
        const commentThreadCoords = coords.thread;
        const commentCoords = coords.comment;
        scrollTop = this.editor.getTopForLineNumber(this._commentThread.range.startLineNumber) - height / 2 + commentCoords.top - commentThreadCoords.top;
      }
      this.editor.setScrollTop(scrollTop);
      this._setFocus(commentUniqueId, focus);
    } else {
      this._goToThread(focus);
    }
  }
  _goToThread(focus) {
    const rangeToReveal = this._commentThread.range ? new Range(this._commentThread.range.startLineNumber, this._commentThread.range.startColumn, this._commentThread.range.endLineNumber + 1, 1) : new Range(1, 1, 1, 1);
    this.editor.revealRangeInCenter(rangeToReveal);
    this._setFocus(void 0, focus);
  }
  makeVisible(commentUniqueId, focus = 0 /* None */) {
    this._expandAndShowZoneWidget();
    if (commentUniqueId !== void 0) {
      this._goToComment(commentUniqueId, focus);
    } else {
      this._goToThread(focus);
    }
  }
  getPendingComments() {
    return {
      newComment: this._commentThreadWidget.getPendingComment(),
      edits: this._commentThreadWidget.getPendingEdits()
    };
  }
  setPendingComment(pending) {
    this._pendingComment = pending;
    this.expand();
    this._commentThreadWidget.setPendingComment(pending);
  }
  _fillContainer(container) {
    this.setCssClass("review-widget");
    this._commentThreadWidget = this._scopedInstantiationService.createInstance(
      CommentThreadWidget,
      container,
      this.editor,
      this._uniqueOwner,
      this.editor.getModel().uri,
      this._contextKeyService,
      this._scopedInstantiationService,
      this._commentThread,
      this._pendingComment,
      this._pendingEdits,
      { editor: this.editor, codeBlockFontSize: "", codeBlockFontFamily: this.configurationService.getValue("editor").fontFamily || EDITOR_FONT_DEFAULTS.fontFamily },
      this._commentOptions,
      {
        actionRunner: async () => {
          if (!this._commentThread.comments || !this._commentThread.comments.length) {
            const newPosition = this.getPosition();
            if (newPosition) {
              const originalRange = this._commentThread.range;
              if (!originalRange) {
                return;
              }
              let range;
              if (newPosition.lineNumber !== originalRange.endLineNumber) {
                const distance = newPosition.lineNumber - originalRange.endLineNumber;
                range = new Range(originalRange.startLineNumber + distance, originalRange.startColumn, originalRange.endLineNumber + distance, originalRange.endColumn);
              } else {
                range = new Range(originalRange.startLineNumber, originalRange.startColumn, originalRange.endLineNumber, originalRange.endColumn);
              }
              await this.commentService.updateCommentThreadTemplate(this.uniqueOwner, this._commentThread.commentThreadHandle, range);
            }
          }
        },
        collapse: () => {
          return this.collapse(true);
        }
      }
    );
    this._disposables.add(this._commentThreadWidget);
  }
  arrowPosition(range) {
    if (!range) {
      return void 0;
    }
    return { lineNumber: range.endLineNumber, column: range.endLineNumber === range.startLineNumber ? (range.startColumn + range.endColumn + 1) / 2 : 1 };
  }
  deleteCommentThread() {
    this.dispose();
    this.commentService.disposeCommentThread(this.uniqueOwner, this._commentThread.threadId);
  }
  doCollapse() {
    this._commentThread.collapsibleState = languages.CommentThreadCollapsibleState.Collapsed;
  }
  async collapse(confirm = false) {
    if (!confirm || await this.confirmCollapse()) {
      this.doCollapse();
      return true;
    } else {
      return false;
    }
  }
  async confirmCollapse() {
    const confirmSetting = this.configurationService.getValue("comments.thread.confirmOnCollapse");
    if (confirmSetting === "whenHasUnsubmittedComments" && this._commentThreadWidget.hasUnsubmittedComments) {
      const result = await this.dialogService.confirm({
        message: nls.localize("confirmCollapse", "Collapsing a comment thread will discard unsubmitted comments. Do you want to collapse this comment thread?"),
        primaryButton: nls.localize("collapse", "Collapse"),
        type: Severity.Warning,
        checkbox: { label: nls.localize("neverAskAgain", "Never ask me again"), checked: false }
      });
      if (result.checkboxChecked) {
        await this.configurationService.updateValue("comments.thread.confirmOnCollapse", "never");
      }
      return result.confirmed;
    }
    return true;
  }
  expand(setActive) {
    this._commentThread.collapsibleState = languages.CommentThreadCollapsibleState.Expanded;
    if (setActive) {
      this.commentService.setActiveCommentAndThread(this.uniqueOwner, { thread: this._commentThread });
    }
  }
  getGlyphPosition() {
    if (this._commentGlyph) {
      return this._commentGlyph.getPosition().position.lineNumber;
    }
    return 0;
  }
  async update(commentThread) {
    if (this._commentThread !== commentThread) {
      this._commentThreadDisposables.forEach((disposable) => disposable.dispose());
      this._commentThread = commentThread;
      this._commentThreadDisposables = [];
      this.bindCommentThreadListeners();
    }
    await this._commentThreadWidget.updateCommentThread(commentThread);
    const lineNumber = this._commentThread.range?.endLineNumber ?? 1;
    let shouldMoveWidget = false;
    if (this._commentGlyph) {
      this._commentGlyph.setThreadState(commentThread.state);
      if (this._commentGlyph.getPosition().position.lineNumber !== lineNumber) {
        shouldMoveWidget = true;
        this._commentGlyph.setLineNumber(lineNumber);
      }
    }
    if (shouldMoveWidget && this._isExpanded || this._commentThread.collapsibleState === languages.CommentThreadCollapsibleState.Expanded && !this._isExpanded) {
      this.show(this.arrowPosition(this._commentThread.range), 2);
    } else if (this._commentThread.collapsibleState !== languages.CommentThreadCollapsibleState.Expanded) {
      this.hide();
    }
  }
  _onWidth(widthInPixel) {
    this._commentThreadWidget.layout(widthInPixel);
  }
  _doLayout(heightInPixel, widthInPixel) {
    this._commentThreadWidget.layout(widthInPixel);
  }
  async display(range, shouldReveal) {
    if (range) {
      this._commentGlyph = new CommentGlyphWidget(this.editor, range?.endLineNumber ?? -1);
      this._commentGlyph.setThreadState(this._commentThread.state);
      this._globalToDispose.add(this._commentGlyph.onDidChangeLineNumber(async (e) => {
        if (!this._commentThread.range) {
          return;
        }
        const shift = e - this._commentThread.range.endLineNumber;
        const newRange = new Range(this._commentThread.range.startLineNumber + shift, this._commentThread.range.startColumn, this._commentThread.range.endLineNumber + shift, this._commentThread.range.endColumn);
        this._commentThread.range = newRange;
      }));
    }
    await this._commentThreadWidget.display(this.editor.getOption(EditorOption.lineHeight), shouldReveal);
    this._disposables.add(this._commentThreadWidget.onDidResize((dimension) => {
      this._refresh(dimension);
    }));
    if (this._commentThread.collapsibleState === languages.CommentThreadCollapsibleState.Expanded) {
      this.show(this.arrowPosition(range), 2);
    }
    if (shouldReveal) {
      this.makeVisible();
    }
    this.bindCommentThreadListeners();
  }
  bindCommentThreadListeners() {
    this._commentThreadDisposables.push(this._commentThread.onDidChangeComments(async (_) => {
      await this.update(this._commentThread);
    }));
    this._commentThreadDisposables.push(this._commentThread.onDidChangeCollapsibleState((state) => {
      if (state === languages.CommentThreadCollapsibleState.Expanded && !this._isExpanded) {
        this.show(this.arrowPosition(this._commentThread.range), 2);
        this._commentThreadWidget.ensureFocusIntoNewEditingComment();
        return;
      }
      if (state === languages.CommentThreadCollapsibleState.Collapsed && this._isExpanded) {
        this.hide();
        return;
      }
    }));
    if (this._initialCollapsibleState === void 0) {
      const onDidChangeInitialCollapsibleState = this._commentThread.onDidChangeInitialCollapsibleState((state) => {
        this._initialCollapsibleState = state;
        this._commentThread.collapsibleState = this._initialCollapsibleState;
        onDidChangeInitialCollapsibleState.dispose();
      });
      this._commentThreadDisposables.push(onDidChangeInitialCollapsibleState);
    }
    this._commentThreadDisposables.push(this._commentThread.onDidChangeState(() => {
      const borderColor = getCommentThreadWidgetStateColor(this._commentThread.state, this.themeService.getColorTheme()) || Color.transparent;
      this.style({
        frameColor: borderColor,
        arrowColor: borderColor
      });
      this.container?.style.setProperty(commentThreadStateColorVar, `${borderColor}`);
      this.container?.style.setProperty(commentThreadStateBackgroundColorVar, `${borderColor.transparent(0.1)}`);
    }));
  }
  async submitComment() {
    return this._commentThreadWidget.submitComment();
  }
  _refresh(dimensions) {
    if (this._isExpanded === void 0 && dimensions.height === 0 && dimensions.width === 0) {
      this.commentThread.collapsibleState = languages.CommentThreadCollapsibleState.Collapsed;
      return;
    }
    if (this._isExpanded) {
      this._commentThreadWidget.layout();
      const headHeight = Math.ceil(this.editor.getOption(EditorOption.lineHeight) * 1.2);
      const lineHeight = this.editor.getOption(EditorOption.lineHeight);
      const arrowHeight = Math.round(lineHeight / 3);
      const frameThickness = Math.round(lineHeight / 9) * 2;
      const computedLinesNumber = Math.ceil((headHeight + dimensions.height + arrowHeight + frameThickness + 8) / lineHeight);
      if (this._viewZone?.heightInLines === computedLinesNumber) {
        return;
      }
      const currentPosition = this.getPosition();
      if (this._viewZone && currentPosition && currentPosition.lineNumber !== this._viewZone.afterLineNumber && this._viewZone.afterLineNumber !== 0) {
        this._viewZone.afterLineNumber = currentPosition.lineNumber;
      }
      const capture = StableEditorScrollState.capture(this.editor);
      this._relayout(computedLinesNumber);
      capture.restore(this.editor);
    }
  }
  _applyTheme(theme) {
    const borderColor = getCommentThreadWidgetStateColor(this._commentThread.state, this.themeService.getColorTheme()) || Color.transparent;
    this.style({
      arrowColor: borderColor,
      frameColor: borderColor
    });
    const fontInfo = this.editor.getOption(EditorOption.fontInfo);
    this._commentThreadWidget.applyTheme(theme, fontInfo);
  }
  show(rangeOrPos, heightInLines) {
    const glyphPosition = this._commentGlyph?.getPosition();
    let range = Range.isIRange(rangeOrPos) ? rangeOrPos : rangeOrPos ? Range.fromPositions(rangeOrPos) : void 0;
    if (glyphPosition?.position && range && glyphPosition.position.lineNumber !== range.endLineNumber) {
      const distance = glyphPosition.position.lineNumber - range.endLineNumber;
      range = new Range(range.startLineNumber + distance, range.startColumn, range.endLineNumber + distance, range.endColumn);
    }
    this._isExpanded = true;
    super.show(range ?? new Range(0, 0, 0, 0), heightInLines);
    this._commentThread.collapsibleState = languages.CommentThreadCollapsibleState.Expanded;
    this._refresh(this._commentThreadWidget.getDimensions());
  }
  async collapseAndFocusRange() {
    if (await this.collapse(true) && Range.isIRange(this.commentThread.range) && isCodeEditor(this.editor)) {
      this.editor.setSelection(this.commentThread.range);
    }
  }
  hide() {
    if (this._isExpanded) {
      this._isExpanded = false;
      if (this.editor.hasWidgetFocus()) {
        this.editor.focus();
      }
      if (!this._commentThread.comments || !this._commentThread.comments.length) {
        this.deleteCommentThread();
      }
    }
    super.hide();
  }
  dispose() {
    super.dispose();
    if (this._commentGlyph) {
      this._commentGlyph.dispose();
      this._commentGlyph = void 0;
    }
    this._globalToDispose.dispose();
    this._commentThreadDisposables.forEach((global) => global.dispose());
    this._onDidClose.fire(void 0);
  }
};
ReviewZoneWidget = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, ICommentService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IDialogService)
], ReviewZoneWidget);
export {
  CommentWidgetFocus,
  ReviewZoneWidget,
  isMouseUpEventDragFromMouseDown,
  isMouseUpEventMatchMouseDown,
  parseMouseDownInfoFromEvent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRUaHJlYWRab25lV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElFZGl0b3JNb3VzZUV2ZW50LCBpc0NvZGVFZGl0b3IsIE1vdXNlVGFyZ2V0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IFpvbmVXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi96b25lV2lkZ2V0L2Jyb3dzZXIvem9uZVdpZGdldC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbG9yVGhlbWUsIElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbW1lbnRHbHlwaFdpZGdldCB9IGZyb20gJy4vY29tbWVudEdseXBoV2lkZ2V0LmpzJztcbmltcG9ydCB7IElDb21tZW50U2VydmljZSB9IGZyb20gJy4vY29tbWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbW1lbnRUaHJlYWRXaWRnZXQgfSBmcm9tICcuLi9jb21tb24vY29tbWVudFRocmVhZFdpZGdldC5qcyc7XG5pbXBvcnQgeyBFRElUT1JfRk9OVF9ERUZBVUxUUywgRWRpdG9yT3B0aW9uLCBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb21tZW50VGhyZWFkV2lkZ2V0IH0gZnJvbSAnLi9jb21tZW50VGhyZWFkV2lkZ2V0LmpzJztcbmltcG9ydCB7IElDZWxsUmFuZ2UgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tSYW5nZS5qcyc7XG5pbXBvcnQgeyBjb21tZW50VGhyZWFkU3RhdGVCYWNrZ3JvdW5kQ29sb3JWYXIsIGNvbW1lbnRUaHJlYWRTdGF0ZUNvbG9yVmFyLCBnZXRDb21tZW50VGhyZWFkU3RhdGVCb3JkZXJDb2xvciB9IGZyb20gJy4vY29tbWVudENvbG9ycy5qcyc7XG5pbXBvcnQgeyBwZWVrVmlld0JvcmRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3BlZWtWaWV3L2Jyb3dzZXIvcGVla1ZpZXcuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBTdGFibGVFZGl0b3JTY3JvbGxTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3N0YWJsZUVkaXRvclNjcm9sbC5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuXG5mdW5jdGlvbiBnZXRDb21tZW50VGhyZWFkV2lkZ2V0U3RhdGVDb2xvcih0aHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkU3RhdGUgfCB1bmRlZmluZWQsIHRoZW1lOiBJQ29sb3JUaGVtZSk6IENvbG9yIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIGdldENvbW1lbnRUaHJlYWRTdGF0ZUJvcmRlckNvbG9yKHRocmVhZCwgdGhlbWUpID8/IHRoZW1lLmdldENvbG9yKHBlZWtWaWV3Qm9yZGVyKTtcbn1cblxuZXhwb3J0IGVudW0gQ29tbWVudFdpZGdldEZvY3VzIHtcblx0Tm9uZSA9IDAsXG5cdFdpZGdldCA9IDEsXG5cdEVkaXRvciA9IDJcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTW91c2VEb3duSW5mb0Zyb21FdmVudChlOiBJRWRpdG9yTW91c2VFdmVudCkge1xuXHRjb25zdCByYW5nZSA9IGUudGFyZ2V0LnJhbmdlO1xuXG5cdGlmICghcmFuZ2UpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGlmICghZS5ldmVudC5sZWZ0QnV0dG9uKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRpZiAoZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9MSU5FX0RFQ09SQVRJT05TKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBkYXRhID0gZS50YXJnZXQuZGV0YWlsO1xuXHRjb25zdCBndXR0ZXJPZmZzZXRYID0gZGF0YS5vZmZzZXRYIC0gZGF0YS5nbHlwaE1hcmdpbldpZHRoIC0gZGF0YS5saW5lTnVtYmVyc1dpZHRoIC0gZGF0YS5nbHlwaE1hcmdpbkxlZnQ7XG5cblx0Ly8gZG9uJ3QgY29sbGlkZSB3aXRoIGZvbGRpbmcgYW5kIGdpdCBkZWNvcmF0aW9uc1xuXHRpZiAoZ3V0dGVyT2Zmc2V0WCA+IDIwKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRyZXR1cm4geyBsaW5lTnVtYmVyOiByYW5nZS5zdGFydExpbmVOdW1iZXIgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTW91c2VVcEV2ZW50RHJhZ0Zyb21Nb3VzZURvd24obW91c2VEb3duSW5mbzogeyBsaW5lTnVtYmVyOiBudW1iZXIgfSB8IG51bGwsIGU6IElFZGl0b3JNb3VzZUV2ZW50KSB7XG5cdGlmICghbW91c2VEb3duSW5mbykge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgeyBsaW5lTnVtYmVyIH0gPSBtb3VzZURvd25JbmZvO1xuXG5cdGNvbnN0IHJhbmdlID0gZS50YXJnZXQucmFuZ2U7XG5cblx0aWYgKCFyYW5nZSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cmV0dXJuIGxpbmVOdW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc01vdXNlVXBFdmVudE1hdGNoTW91c2VEb3duKG1vdXNlRG93bkluZm86IHsgbGluZU51bWJlcjogbnVtYmVyIH0gfCBudWxsLCBlOiBJRWRpdG9yTW91c2VFdmVudCkge1xuXHRpZiAoIW1vdXNlRG93bkluZm8pIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IHsgbGluZU51bWJlciB9ID0gbW91c2VEb3duSW5mbztcblxuXHRjb25zdCByYW5nZSA9IGUudGFyZ2V0LnJhbmdlO1xuXG5cdGlmICghcmFuZ2UgfHwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSBsaW5lTnVtYmVyKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRpZiAoZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9MSU5FX0RFQ09SQVRJT05TKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRyZXR1cm4gbGluZU51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFJldmlld1pvbmVXaWRnZXQgZXh0ZW5kcyBab25lV2lkZ2V0IGltcGxlbWVudHMgSUNvbW1lbnRUaHJlYWRXaWRnZXQge1xuXHRwcml2YXRlIF9jb21tZW50VGhyZWFkV2lkZ2V0ITogQ29tbWVudFRocmVhZFdpZGdldDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbG9zZSA9IG5ldyBFbWl0dGVyPFJldmlld1pvbmVXaWRnZXQgfCB1bmRlZmluZWQ+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ3JlYXRlVGhyZWFkID0gbmV3IEVtaXR0ZXI8UmV2aWV3Wm9uZVdpZGdldD4oKTtcblx0cHJpdmF0ZSBfaXNFeHBhbmRlZD86IGJvb2xlYW47XG5cdHByaXZhdGUgX2luaXRpYWxDb2xsYXBzaWJsZVN0YXRlPzogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlO1xuXHRwcml2YXRlIF9jb21tZW50R2x5cGg/OiBDb21tZW50R2x5cGhXaWRnZXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2dsb2JhbFRvRGlzcG9zZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBfY29tbWVudFRocmVhZERpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdHByaXZhdGUgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdHByaXZhdGUgX3Njb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0cHVibGljIGdldCB1bmlxdWVPd25lcigpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl91bmlxdWVPd25lcjtcblx0fVxuXHRwdWJsaWMgZ2V0IGNvbW1lbnRUaHJlYWQoKTogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQge1xuXHRcdHJldHVybiB0aGlzLl9jb21tZW50VGhyZWFkO1xuXHR9XG5cblx0cHVibGljIGdldCBleHBhbmRlZCgpOiBib29sZWFuIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5faXNFeHBhbmRlZDtcblx0fVxuXG5cdHByaXZhdGUgX2NvbW1lbnRPcHRpb25zOiBsYW5ndWFnZXMuQ29tbWVudE9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIF91bmlxdWVPd25lcjogc3RyaW5nLFxuXHRcdHByaXZhdGUgX2NvbW1lbnRUaHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkLFxuXHRcdHByaXZhdGUgX3BlbmRpbmdDb21tZW50OiBsYW5ndWFnZXMuUGVuZGluZ0NvbW1lbnQgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBfcGVuZGluZ0VkaXRzOiB7IFtrZXk6IG51bWJlcl06IGxhbmd1YWdlcy5QZW5kaW5nQ29tbWVudCB9IHwgdW5kZWZpbmVkLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbW1lbnRTZXJ2aWNlIHByaXZhdGUgY29tbWVudFNlcnZpY2U6IElDb21tZW50U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZWRpdG9yLCB7IGtlZXBFZGl0b3JTZWxlY3Rpb246IHRydWUsIGlzQWNjZXNzaWJsZTogdHJ1ZSwgc2hvd0Fycm93OiAhIV9jb21tZW50VGhyZWFkLnJhbmdlIH0pO1xuXHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuZG9tTm9kZSk7XG5cblx0XHR0aGlzLl9zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX2dsb2JhbFRvRGlzcG9zZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lDb250ZXh0S2V5U2VydmljZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2VdXG5cdFx0KSkpO1xuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IHRoaXMuY29tbWVudFNlcnZpY2UuZ2V0Q29tbWVudENvbnRyb2xsZXIodGhpcy5fdW5pcXVlT3duZXIpO1xuXHRcdGlmIChjb250cm9sbGVyKSB7XG5cdFx0XHR0aGlzLl9jb21tZW50T3B0aW9ucyA9IGNvbnRyb2xsZXIub3B0aW9ucztcblx0XHR9XG5cblx0XHR0aGlzLl9pbml0aWFsQ29sbGFwc2libGVTdGF0ZSA9IF9wZW5kaW5nQ29tbWVudCA/IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZS5FeHBhbmRlZCA6IF9jb21tZW50VGhyZWFkLmluaXRpYWxDb2xsYXBzaWJsZVN0YXRlO1xuXHRcdF9jb21tZW50VGhyZWFkLmluaXRpYWxDb2xsYXBzaWJsZVN0YXRlID0gdGhpcy5faW5pdGlhbENvbGxhcHNpYmxlU3RhdGU7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZERpc3Bvc2FibGVzID0gW107XG5cdFx0dGhpcy5jcmVhdGUoKTtcblxuXHRcdHRoaXMuX2dsb2JhbFRvRGlzcG9zZS5hZGQodGhpcy50aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKHRoaXMuX2FwcGx5VGhlbWUsIHRoaXMpKTtcblx0XHR0aGlzLl9nbG9iYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKSkge1xuXHRcdFx0XHR0aGlzLl9hcHBseVRoZW1lKHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2FwcGx5VGhlbWUodGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpKTtcblxuXHR9XG5cblx0cHVibGljIGdldCBvbkRpZENsb3NlKCk6IEV2ZW50PFJldmlld1pvbmVXaWRnZXQgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDbG9zZS5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb25EaWRDcmVhdGVUaHJlYWQoKTogRXZlbnQ8UmV2aWV3Wm9uZVdpZGdldD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENyZWF0ZVRocmVhZC5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpOiBJUG9zaXRpb24gfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLnBvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wb3NpdGlvbjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fY29tbWVudEdseXBoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY29tbWVudEdseXBoLmdldFBvc2l0aW9uKCkucG9zaXRpb24gPz8gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJldmVhbFJhbmdlKCkge1xuXHRcdC8vIHdlIGRvbid0IGRvIGFueXRoaW5nIGhlcmUgYXMgd2UgYWx3YXlzIGRvIHRoZSByZXZlYWwgb3Vyc2VsdmVzLlxuXHR9XG5cblx0cHVibGljIHJldmVhbChjb21tZW50VW5pcXVlSWQ/OiBudW1iZXIsIGZvY3VzOiBDb21tZW50V2lkZ2V0Rm9jdXMgPSBDb21tZW50V2lkZ2V0Rm9jdXMuTm9uZSkge1xuXHRcdHRoaXMubWFrZVZpc2libGUoY29tbWVudFVuaXF1ZUlkLCBmb2N1cyk7XG5cdFx0Y29uc3QgY29tbWVudCA9IHRoaXMuX2NvbW1lbnRUaHJlYWQuY29tbWVudHM/LmZpbmQoY29tbWVudCA9PiBjb21tZW50LnVuaXF1ZUlkSW5UaHJlYWQgPT09IGNvbW1lbnRVbmlxdWVJZCkgPz8gdGhpcy5fY29tbWVudFRocmVhZC5jb21tZW50cz8uWzBdO1xuXHRcdHRoaXMuY29tbWVudFNlcnZpY2Uuc2V0QWN0aXZlQ29tbWVudEFuZFRocmVhZCh0aGlzLnVuaXF1ZU93bmVyLCB7IHRocmVhZDogdGhpcy5fY29tbWVudFRocmVhZCwgY29tbWVudCB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2V4cGFuZEFuZFNob3dab25lV2lkZ2V0KCkge1xuXHRcdGlmICghdGhpcy5faXNFeHBhbmRlZCkge1xuXHRcdFx0dGhpcy5zaG93KHRoaXMuYXJyb3dQb3NpdGlvbih0aGlzLl9jb21tZW50VGhyZWFkLnJhbmdlKSwgMik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2V0Rm9jdXMoY29tbWVudFVuaXF1ZUlkOiBudW1iZXIgfCB1bmRlZmluZWQsIGZvY3VzOiBDb21tZW50V2lkZ2V0Rm9jdXMpIHtcblx0XHRpZiAoZm9jdXMgPT09IENvbW1lbnRXaWRnZXRGb2N1cy5XaWRnZXQpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRXaWRnZXQuZm9jdXMoY29tbWVudFVuaXF1ZUlkKTtcblx0XHR9IGVsc2UgaWYgKGZvY3VzID09PSBDb21tZW50V2lkZ2V0Rm9jdXMuRWRpdG9yKSB7XG5cdFx0XHR0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0LmZvY3VzQ29tbWVudEVkaXRvcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dvVG9Db21tZW50KGNvbW1lbnRVbmlxdWVJZDogbnVtYmVyLCBmb2N1czogQ29tbWVudFdpZGdldEZvY3VzKSB7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gdGhpcy5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmhlaWdodDtcblx0XHRjb25zdCBjb29yZHMgPSB0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0LmdldENvbW1lbnRDb29yZHMoY29tbWVudFVuaXF1ZUlkKTtcblx0XHRpZiAoY29vcmRzKSB7XG5cdFx0XHRsZXQgc2Nyb2xsVG9wOiBudW1iZXIgPSAxO1xuXHRcdFx0aWYgKHRoaXMuX2NvbW1lbnRUaHJlYWQucmFuZ2UpIHtcblx0XHRcdFx0Y29uc3QgY29tbWVudFRocmVhZENvb3JkcyA9IGNvb3Jkcy50aHJlYWQ7XG5cdFx0XHRcdGNvbnN0IGNvbW1lbnRDb29yZHMgPSBjb29yZHMuY29tbWVudDtcblx0XHRcdFx0c2Nyb2xsVG9wID0gdGhpcy5lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcih0aGlzLl9jb21tZW50VGhyZWFkLnJhbmdlLnN0YXJ0TGluZU51bWJlcikgLSBoZWlnaHQgLyAyICsgY29tbWVudENvb3Jkcy50b3AgLSBjb21tZW50VGhyZWFkQ29vcmRzLnRvcDtcblx0XHRcdH1cblx0XHRcdHRoaXMuZWRpdG9yLnNldFNjcm9sbFRvcChzY3JvbGxUb3ApO1xuXHRcdFx0dGhpcy5fc2V0Rm9jdXMoY29tbWVudFVuaXF1ZUlkLCBmb2N1cyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2dvVG9UaHJlYWQoZm9jdXMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dvVG9UaHJlYWQoZm9jdXM6IENvbW1lbnRXaWRnZXRGb2N1cykge1xuXHRcdGNvbnN0IHJhbmdlVG9SZXZlYWwgPSB0aGlzLl9jb21tZW50VGhyZWFkLnJhbmdlXG5cdFx0XHQ/IG5ldyBSYW5nZSh0aGlzLl9jb21tZW50VGhyZWFkLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgdGhpcy5fY29tbWVudFRocmVhZC5yYW5nZS5zdGFydENvbHVtbiwgdGhpcy5fY29tbWVudFRocmVhZC5yYW5nZS5lbmRMaW5lTnVtYmVyICsgMSwgMSlcblx0XHRcdDogbmV3IFJhbmdlKDEsIDEsIDEsIDEpO1xuXG5cdFx0dGhpcy5lZGl0b3IucmV2ZWFsUmFuZ2VJbkNlbnRlcihyYW5nZVRvUmV2ZWFsKTtcblx0XHR0aGlzLl9zZXRGb2N1cyh1bmRlZmluZWQsIGZvY3VzKTtcblx0fVxuXG5cdHB1YmxpYyBtYWtlVmlzaWJsZShjb21tZW50VW5pcXVlSWQ/OiBudW1iZXIsIGZvY3VzOiBDb21tZW50V2lkZ2V0Rm9jdXMgPSBDb21tZW50V2lkZ2V0Rm9jdXMuTm9uZSkge1xuXHRcdHRoaXMuX2V4cGFuZEFuZFNob3dab25lV2lkZ2V0KCk7XG5cblx0XHRpZiAoY29tbWVudFVuaXF1ZUlkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX2dvVG9Db21tZW50KGNvbW1lbnRVbmlxdWVJZCwgZm9jdXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9nb1RvVGhyZWFkKGZvY3VzKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0UGVuZGluZ0NvbW1lbnRzKCk6IHsgbmV3Q29tbWVudDogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IHwgdW5kZWZpbmVkOyBlZGl0czogeyBba2V5OiBudW1iZXJdOiBsYW5ndWFnZXMuUGVuZGluZ0NvbW1lbnQgfSB9IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmV3Q29tbWVudDogdGhpcy5fY29tbWVudFRocmVhZFdpZGdldC5nZXRQZW5kaW5nQ29tbWVudCgpLFxuXHRcdFx0ZWRpdHM6IHRoaXMuX2NvbW1lbnRUaHJlYWRXaWRnZXQuZ2V0UGVuZGluZ0VkaXRzKClcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIHNldFBlbmRpbmdDb21tZW50KHBlbmRpbmc6IGxhbmd1YWdlcy5QZW5kaW5nQ29tbWVudCkge1xuXHRcdHRoaXMuX3BlbmRpbmdDb21tZW50ID0gcGVuZGluZztcblx0XHR0aGlzLmV4cGFuZCgpO1xuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRXaWRnZXQuc2V0UGVuZGluZ0NvbW1lbnQocGVuZGluZyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2ZpbGxDb250YWluZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0Q3NzQ2xhc3MoJ3Jldmlldy13aWRnZXQnKTtcblx0XHR0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0ID0gdGhpcy5fc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRDb21tZW50VGhyZWFkV2lkZ2V0LFxuXHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0dGhpcy5lZGl0b3IsXG5cdFx0XHR0aGlzLl91bmlxdWVPd25lcixcblx0XHRcdHRoaXMuZWRpdG9yLmdldE1vZGVsKCkhLnVyaSxcblx0XHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHR0aGlzLl9jb21tZW50VGhyZWFkIGFzIHVua25vd24gYXMgbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8SVJhbmdlIHwgSUNlbGxSYW5nZT4sXG5cdFx0XHR0aGlzLl9wZW5kaW5nQ29tbWVudCxcblx0XHRcdHRoaXMuX3BlbmRpbmdFZGl0cyxcblx0XHRcdHsgZWRpdG9yOiB0aGlzLmVkaXRvciwgY29kZUJsb2NrRm9udFNpemU6ICcnLCBjb2RlQmxvY2tGb250RmFtaWx5OiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJykuZm9udEZhbWlseSB8fCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250RmFtaWx5IH0sXG5cdFx0XHR0aGlzLl9jb21tZW50T3B0aW9ucyxcblx0XHRcdHtcblx0XHRcdFx0YWN0aW9uUnVubmVyOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzIHx8ICF0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbmV3UG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uKCk7XG5cblx0XHRcdFx0XHRcdGlmIChuZXdQb3NpdGlvbikge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbFJhbmdlID0gdGhpcy5fY29tbWVudFRocmVhZC5yYW5nZTtcblx0XHRcdFx0XHRcdFx0aWYgKCFvcmlnaW5hbFJhbmdlKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGxldCByYW5nZTogUmFuZ2U7XG5cblx0XHRcdFx0XHRcdFx0aWYgKG5ld1Bvc2l0aW9uLmxpbmVOdW1iZXIgIT09IG9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFRoZSB3aWRnZXQgY291bGQgaGF2ZSBtb3ZlZCBhcyBhIHJlc3VsdCBvZiBlZGl0b3IgY2hhbmdlcy5cblx0XHRcdFx0XHRcdFx0XHQvLyBXZSBuZWVkIHRvIHRyeSB0byBjYWxjdWxhdGUgdGhlIG5ldywgbW9yZSBjb3JyZWN0LCByYW5nZSBmb3IgdGhlIGNvbW1lbnQuXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZGlzdGFuY2UgPSBuZXdQb3NpdGlvbi5saW5lTnVtYmVyIC0gb3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0XHRcdHJhbmdlID0gbmV3IFJhbmdlKG9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgZGlzdGFuY2UsIG9yaWdpbmFsUmFuZ2Uuc3RhcnRDb2x1bW4sIG9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlciArIGRpc3RhbmNlLCBvcmlnaW5hbFJhbmdlLmVuZENvbHVtbik7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cmFuZ2UgPSBuZXcgUmFuZ2Uob3JpZ2luYWxSYW5nZS5zdGFydExpbmVOdW1iZXIsIG9yaWdpbmFsUmFuZ2Uuc3RhcnRDb2x1bW4sIG9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlciwgb3JpZ2luYWxSYW5nZS5lbmRDb2x1bW4pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWVudFNlcnZpY2UudXBkYXRlQ29tbWVudFRocmVhZFRlbXBsYXRlKHRoaXMudW5pcXVlT3duZXIsIHRoaXMuX2NvbW1lbnRUaHJlYWQuY29tbWVudFRocmVhZEhhbmRsZSwgcmFuZ2UpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0Y29sbGFwc2U6ICgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5jb2xsYXBzZSh0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCkgYXMgdW5rbm93biBhcyBDb21tZW50VGhyZWFkV2lkZ2V0PElSYW5nZT47XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fY29tbWVudFRocmVhZFdpZGdldCk7XG5cdH1cblxuXHRwcml2YXRlIGFycm93UG9zaXRpb24ocmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCk6IElQb3NpdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFyYW5nZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Ly8gQXJyb3cgb24gdG9wIGVkZ2Ugb2Ygem9uZSB3aWRnZXQgd2lsbCBiZSBhdCB0aGUgc3RhcnQgb2YgdGhlIGxpbmUgaWYgcmFuZ2UgaXMgbXVsdGktbGluZSwgZWxzZSBhdCBtaWRwb2ludCBvZiByYW5nZSAocm91bmRpbmcgcmlnaHR3YXJkcylcblx0XHRyZXR1cm4geyBsaW5lTnVtYmVyOiByYW5nZS5lbmRMaW5lTnVtYmVyLCBjb2x1bW46IHJhbmdlLmVuZExpbmVOdW1iZXIgPT09IHJhbmdlLnN0YXJ0TGluZU51bWJlciA/IChyYW5nZS5zdGFydENvbHVtbiArIHJhbmdlLmVuZENvbHVtbiArIDEpIC8gMiA6IDEgfTtcblx0fVxuXG5cdHByaXZhdGUgZGVsZXRlQ29tbWVudFRocmVhZCgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmNvbW1lbnRTZXJ2aWNlLmRpc3Bvc2VDb21tZW50VGhyZWFkKHRoaXMudW5pcXVlT3duZXIsIHRoaXMuX2NvbW1lbnRUaHJlYWQudGhyZWFkSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0NvbGxhcHNlKCkge1xuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWQuY29sbGFwc2libGVTdGF0ZSA9IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY29sbGFwc2UoY29uZmlybTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKCFjb25maXJtIHx8IChhd2FpdCB0aGlzLmNvbmZpcm1Db2xsYXBzZSgpKSkge1xuXHRcdFx0dGhpcy5kb0NvbGxhcHNlKCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY29uZmlybUNvbGxhcHNlKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGNvbmZpcm1TZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnd2hlbkhhc1Vuc3VibWl0dGVkQ29tbWVudHMnIHwgJ25ldmVyJz4oJ2NvbW1lbnRzLnRocmVhZC5jb25maXJtT25Db2xsYXBzZScpO1xuXG5cdFx0aWYgKGNvbmZpcm1TZXR0aW5nID09PSAnd2hlbkhhc1Vuc3VibWl0dGVkQ29tbWVudHMnICYmIHRoaXMuX2NvbW1lbnRUaHJlYWRXaWRnZXQuaGFzVW5zdWJtaXR0ZWRDb21tZW50cykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2NvbmZpcm1Db2xsYXBzZScsIFwiQ29sbGFwc2luZyBhIGNvbW1lbnQgdGhyZWFkIHdpbGwgZGlzY2FyZCB1bnN1Ym1pdHRlZCBjb21tZW50cy4gRG8geW91IHdhbnQgdG8gY29sbGFwc2UgdGhpcyBjb21tZW50IHRocmVhZD9cIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IG5scy5sb2NhbGl6ZSgnY29sbGFwc2UnLCBcIkNvbGxhcHNlXCIpLFxuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRjaGVja2JveDogeyBsYWJlbDogbmxzLmxvY2FsaXplKCduZXZlckFza0FnYWluJywgXCJOZXZlciBhc2sgbWUgYWdhaW5cIiksIGNoZWNrZWQ6IGZhbHNlIH1cblx0XHRcdH0pO1xuXHRcdFx0aWYgKHJlc3VsdC5jaGVja2JveENoZWNrZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSgnY29tbWVudHMudGhyZWFkLmNvbmZpcm1PbkNvbGxhcHNlJywgJ25ldmVyJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0LmNvbmZpcm1lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgZXhwYW5kKHNldEFjdGl2ZT86IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9jb21tZW50VGhyZWFkLmNvbGxhcHNpYmxlU3RhdGUgPSBsYW5ndWFnZXMuQ29tbWVudFRocmVhZENvbGxhcHNpYmxlU3RhdGUuRXhwYW5kZWQ7XG5cdFx0aWYgKHNldEFjdGl2ZSkge1xuXHRcdFx0dGhpcy5jb21tZW50U2VydmljZS5zZXRBY3RpdmVDb21tZW50QW5kVGhyZWFkKHRoaXMudW5pcXVlT3duZXIsIHsgdGhyZWFkOiB0aGlzLl9jb21tZW50VGhyZWFkIH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRHbHlwaFBvc2l0aW9uKCk6IG51bWJlciB7XG5cdFx0aWYgKHRoaXMuX2NvbW1lbnRHbHlwaCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2NvbW1lbnRHbHlwaC5nZXRQb3NpdGlvbigpLnBvc2l0aW9uIS5saW5lTnVtYmVyO1xuXHRcdH1cblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZShjb21tZW50VGhyZWFkOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZDxJUmFuZ2U+KSB7XG5cdFx0aWYgKHRoaXMuX2NvbW1lbnRUaHJlYWQgIT09IGNvbW1lbnRUaHJlYWQpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWREaXNwb3NhYmxlcy5mb3JFYWNoKGRpc3Bvc2FibGUgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkpO1xuXHRcdFx0dGhpcy5fY29tbWVudFRocmVhZCA9IGNvbW1lbnRUaHJlYWQ7XG5cdFx0XHR0aGlzLl9jb21tZW50VGhyZWFkRGlzcG9zYWJsZXMgPSBbXTtcblx0XHRcdHRoaXMuYmluZENvbW1lbnRUaHJlYWRMaXN0ZW5lcnMoKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0LnVwZGF0ZUNvbW1lbnRUaHJlYWQoY29tbWVudFRocmVhZCk7XG5cblx0XHQvLyBNb3ZlIGNvbW1lbnQgZ2x5cGggd2lkZ2V0IGFuZCBzaG93IHBvc2l0aW9uIGlmIHRoZSBsaW5lIGhhcyBjaGFuZ2VkLlxuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSB0aGlzLl9jb21tZW50VGhyZWFkLnJhbmdlPy5lbmRMaW5lTnVtYmVyID8/IDE7XG5cdFx0bGV0IHNob3VsZE1vdmVXaWRnZXQgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5fY29tbWVudEdseXBoKSB7XG5cdFx0XHR0aGlzLl9jb21tZW50R2x5cGguc2V0VGhyZWFkU3RhdGUoY29tbWVudFRocmVhZC5zdGF0ZSk7XG5cdFx0XHRpZiAodGhpcy5fY29tbWVudEdseXBoLmdldFBvc2l0aW9uKCkucG9zaXRpb24hLmxpbmVOdW1iZXIgIT09IGxpbmVOdW1iZXIpIHtcblx0XHRcdFx0c2hvdWxkTW92ZVdpZGdldCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX2NvbW1lbnRHbHlwaC5zZXRMaW5lTnVtYmVyKGxpbmVOdW1iZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICgoc2hvdWxkTW92ZVdpZGdldCAmJiB0aGlzLl9pc0V4cGFuZGVkKSB8fCAodGhpcy5fY29tbWVudFRocmVhZC5jb2xsYXBzaWJsZVN0YXRlID09PSBsYW5ndWFnZXMuQ29tbWVudFRocmVhZENvbGxhcHNpYmxlU3RhdGUuRXhwYW5kZWQgJiYgIXRoaXMuX2lzRXhwYW5kZWQpKSB7XG5cdFx0XHR0aGlzLnNob3codGhpcy5hcnJvd1Bvc2l0aW9uKHRoaXMuX2NvbW1lbnRUaHJlYWQucmFuZ2UpLCAyKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2NvbW1lbnRUaHJlYWQuY29sbGFwc2libGVTdGF0ZSAhPT0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlLkV4cGFuZGVkKSB7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX29uV2lkdGgod2lkdGhJblBpeGVsOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0LmxheW91dCh3aWR0aEluUGl4ZWwpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9kb0xheW91dChoZWlnaHRJblBpeGVsOiBudW1iZXIsIHdpZHRoSW5QaXhlbDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZFdpZGdldC5sYXlvdXQod2lkdGhJblBpeGVsKTtcblx0fVxuXG5cdGFzeW5jIGRpc3BsYXkocmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCwgc2hvdWxkUmV2ZWFsOiBib29sZWFuKSB7XG5cdFx0aWYgKHJhbmdlKSB7XG5cdFx0XHR0aGlzLl9jb21tZW50R2x5cGggPSBuZXcgQ29tbWVudEdseXBoV2lkZ2V0KHRoaXMuZWRpdG9yLCByYW5nZT8uZW5kTGluZU51bWJlciA/PyAtMSk7XG5cdFx0XHR0aGlzLl9jb21tZW50R2x5cGguc2V0VGhyZWFkU3RhdGUodGhpcy5fY29tbWVudFRocmVhZC5zdGF0ZSk7XG5cdFx0XHR0aGlzLl9nbG9iYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuX2NvbW1lbnRHbHlwaC5vbkRpZENoYW5nZUxpbmVOdW1iZXIoYXN5bmMgZSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5fY29tbWVudFRocmVhZC5yYW5nZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBzaGlmdCA9IGUgLSAodGhpcy5fY29tbWVudFRocmVhZC5yYW5nZS5lbmRMaW5lTnVtYmVyKTtcblx0XHRcdFx0Y29uc3QgbmV3UmFuZ2UgPSBuZXcgUmFuZ2UodGhpcy5fY29tbWVudFRocmVhZC5yYW5nZS5zdGFydExpbmVOdW1iZXIgKyBzaGlmdCwgdGhpcy5fY29tbWVudFRocmVhZC5yYW5nZS5zdGFydENvbHVtbiwgdGhpcy5fY29tbWVudFRocmVhZC5yYW5nZS5lbmRMaW5lTnVtYmVyICsgc2hpZnQsIHRoaXMuX2NvbW1lbnRUaHJlYWQucmFuZ2UuZW5kQ29sdW1uKTtcblx0XHRcdFx0dGhpcy5fY29tbWVudFRocmVhZC5yYW5nZSA9IG5ld1JhbmdlO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuX2NvbW1lbnRUaHJlYWRXaWRnZXQuZGlzcGxheSh0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpLCBzaG91bGRSZXZlYWwpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0Lm9uRGlkUmVzaXplKGRpbWVuc2lvbiA9PiB7XG5cdFx0XHR0aGlzLl9yZWZyZXNoKGRpbWVuc2lvbik7XG5cdFx0fSkpO1xuXHRcdGlmICh0aGlzLl9jb21tZW50VGhyZWFkLmNvbGxhcHNpYmxlU3RhdGUgPT09IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZS5FeHBhbmRlZCkge1xuXHRcdFx0dGhpcy5zaG93KHRoaXMuYXJyb3dQb3NpdGlvbihyYW5nZSksIDIpO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoaXMgaXMgYSBuZXcgY29tbWVudCB0aHJlYWQgYXdhaXRpbmcgdXNlciBpbnB1dCB0aGVuIHdlIG5lZWQgdG8gcmV2ZWFsIGl0LlxuXHRcdGlmIChzaG91bGRSZXZlYWwpIHtcblx0XHRcdHRoaXMubWFrZVZpc2libGUoKTtcblx0XHR9XG5cblx0XHR0aGlzLmJpbmRDb21tZW50VGhyZWFkTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIGJpbmRDb21tZW50VGhyZWFkTGlzdGVuZXJzKCkge1xuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWREaXNwb3NhYmxlcy5wdXNoKHRoaXMuX2NvbW1lbnRUaHJlYWQub25EaWRDaGFuZ2VDb21tZW50cyhhc3luYyBfID0+IHtcblx0XHRcdGF3YWl0IHRoaXMudXBkYXRlKHRoaXMuX2NvbW1lbnRUaHJlYWQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWREaXNwb3NhYmxlcy5wdXNoKHRoaXMuX2NvbW1lbnRUaHJlYWQub25EaWRDaGFuZ2VDb2xsYXBzaWJsZVN0YXRlKHN0YXRlID0+IHtcblx0XHRcdGlmIChzdGF0ZSA9PT0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlLkV4cGFuZGVkICYmICF0aGlzLl9pc0V4cGFuZGVkKSB7XG5cdFx0XHRcdHRoaXMuc2hvdyh0aGlzLmFycm93UG9zaXRpb24odGhpcy5fY29tbWVudFRocmVhZC5yYW5nZSksIDIpO1xuXHRcdFx0XHR0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0LmVuc3VyZUZvY3VzSW50b05ld0VkaXRpbmdDb21tZW50KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXRlID09PSBsYW5ndWFnZXMuQ29tbWVudFRocmVhZENvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkICYmIHRoaXMuX2lzRXhwYW5kZWQpIHtcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAodGhpcy5faW5pdGlhbENvbGxhcHNpYmxlU3RhdGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3Qgb25EaWRDaGFuZ2VJbml0aWFsQ29sbGFwc2libGVTdGF0ZSA9IHRoaXMuX2NvbW1lbnRUaHJlYWQub25EaWRDaGFuZ2VJbml0aWFsQ29sbGFwc2libGVTdGF0ZShzdGF0ZSA9PiB7XG5cdFx0XHRcdC8vIEZpbGUgY29tbWVudHMgYWx3YXlzIHN0YXJ0IGV4cGFuZGVkXG5cdFx0XHRcdHRoaXMuX2luaXRpYWxDb2xsYXBzaWJsZVN0YXRlID0gc3RhdGU7XG5cdFx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWQuY29sbGFwc2libGVTdGF0ZSA9IHRoaXMuX2luaXRpYWxDb2xsYXBzaWJsZVN0YXRlO1xuXHRcdFx0XHRvbkRpZENoYW5nZUluaXRpYWxDb2xsYXBzaWJsZVN0YXRlLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fY29tbWVudFRocmVhZERpc3Bvc2FibGVzLnB1c2gob25EaWRDaGFuZ2VJbml0aWFsQ29sbGFwc2libGVTdGF0ZSk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLl9jb21tZW50VGhyZWFkRGlzcG9zYWJsZXMucHVzaCh0aGlzLl9jb21tZW50VGhyZWFkLm9uRGlkQ2hhbmdlU3RhdGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgYm9yZGVyQ29sb3IgPVxuXHRcdFx0XHRnZXRDb21tZW50VGhyZWFkV2lkZ2V0U3RhdGVDb2xvcih0aGlzLl9jb21tZW50VGhyZWFkLnN0YXRlLCB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkpIHx8IENvbG9yLnRyYW5zcGFyZW50O1xuXHRcdFx0dGhpcy5zdHlsZSh7XG5cdFx0XHRcdGZyYW1lQ29sb3I6IGJvcmRlckNvbG9yLFxuXHRcdFx0XHRhcnJvd0NvbG9yOiBib3JkZXJDb2xvcixcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5jb250YWluZXI/LnN0eWxlLnNldFByb3BlcnR5KGNvbW1lbnRUaHJlYWRTdGF0ZUNvbG9yVmFyLCBgJHtib3JkZXJDb2xvcn1gKTtcblx0XHRcdHRoaXMuY29udGFpbmVyPy5zdHlsZS5zZXRQcm9wZXJ0eShjb21tZW50VGhyZWFkU3RhdGVCYWNrZ3JvdW5kQ29sb3JWYXIsIGAke2JvcmRlckNvbG9yLnRyYW5zcGFyZW50KC4xKX1gKTtcblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyBzdWJtaXRDb21tZW50KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9jb21tZW50VGhyZWFkV2lkZ2V0LnN1Ym1pdENvbW1lbnQoKTtcblx0fVxuXG5cdF9yZWZyZXNoKGRpbWVuc2lvbnM6IGRvbS5EaW1lbnNpb24pIHtcblx0XHRpZiAoKHRoaXMuX2lzRXhwYW5kZWQgPT09IHVuZGVmaW5lZCkgJiYgKGRpbWVuc2lvbnMuaGVpZ2h0ID09PSAwKSAmJiAoZGltZW5zaW9ucy53aWR0aCA9PT0gMCkpIHtcblx0XHRcdHRoaXMuY29tbWVudFRocmVhZC5jb2xsYXBzaWJsZVN0YXRlID0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2lzRXhwYW5kZWQpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRXaWRnZXQubGF5b3V0KCk7XG5cblx0XHRcdGNvbnN0IGhlYWRIZWlnaHQgPSBNYXRoLmNlaWwodGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KSAqIDEuMik7XG5cdFx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRcdGNvbnN0IGFycm93SGVpZ2h0ID0gTWF0aC5yb3VuZChsaW5lSGVpZ2h0IC8gMyk7XG5cdFx0XHRjb25zdCBmcmFtZVRoaWNrbmVzcyA9IE1hdGgucm91bmQobGluZUhlaWdodCAvIDkpICogMjtcblxuXHRcdFx0Y29uc3QgY29tcHV0ZWRMaW5lc051bWJlciA9IE1hdGguY2VpbCgoaGVhZEhlaWdodCArIGRpbWVuc2lvbnMuaGVpZ2h0ICsgYXJyb3dIZWlnaHQgKyBmcmFtZVRoaWNrbmVzcyArIDggLyoqIG1hcmdpbiBib3R0b20gdG8gYXZvaWQgbWFyZ2luIGNvbGxhcHNlICovKSAvIGxpbmVIZWlnaHQpO1xuXG5cdFx0XHRpZiAodGhpcy5fdmlld1pvbmU/LmhlaWdodEluTGluZXMgPT09IGNvbXB1dGVkTGluZXNOdW1iZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50UG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uKCk7XG5cblx0XHRcdGlmICh0aGlzLl92aWV3Wm9uZSAmJiBjdXJyZW50UG9zaXRpb24gJiYgY3VycmVudFBvc2l0aW9uLmxpbmVOdW1iZXIgIT09IHRoaXMuX3ZpZXdab25lLmFmdGVyTGluZU51bWJlciAmJiB0aGlzLl92aWV3Wm9uZS5hZnRlckxpbmVOdW1iZXIgIT09IDApIHtcblx0XHRcdFx0dGhpcy5fdmlld1pvbmUuYWZ0ZXJMaW5lTnVtYmVyID0gY3VycmVudFBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNhcHR1cmUgPSBTdGFibGVFZGl0b3JTY3JvbGxTdGF0ZS5jYXB0dXJlKHRoaXMuZWRpdG9yKTtcblx0XHRcdHRoaXMuX3JlbGF5b3V0KGNvbXB1dGVkTGluZXNOdW1iZXIpO1xuXHRcdFx0Y2FwdHVyZS5yZXN0b3JlKHRoaXMuZWRpdG9yKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseVRoZW1lKHRoZW1lOiBJQ29sb3JUaGVtZSkge1xuXHRcdGNvbnN0IGJvcmRlckNvbG9yID0gZ2V0Q29tbWVudFRocmVhZFdpZGdldFN0YXRlQ29sb3IodGhpcy5fY29tbWVudFRocmVhZC5zdGF0ZSwgdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpKSB8fCBDb2xvci50cmFuc3BhcmVudDtcblx0XHR0aGlzLnN0eWxlKHtcblx0XHRcdGFycm93Q29sb3I6IGJvcmRlckNvbG9yLFxuXHRcdFx0ZnJhbWVDb2xvcjogYm9yZGVyQ29sb3Jcblx0XHR9KTtcblx0XHRjb25zdCBmb250SW5mbyA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXG5cdFx0Ly8gRWRpdG9yIGRlY29yYXRpb25zIHNob3VsZCBhbHNvIGJlIHJlc3BvbnNpdmUgdG8gdGhlbWUgY2hhbmdlc1xuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRXaWRnZXQuYXBwbHlUaGVtZSh0aGVtZSwgZm9udEluZm8pO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2hvdyhyYW5nZU9yUG9zOiBJUmFuZ2UgfCBJUG9zaXRpb24gfCB1bmRlZmluZWQsIGhlaWdodEluTGluZXM6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGdseXBoUG9zaXRpb24gPSB0aGlzLl9jb21tZW50R2x5cGg/LmdldFBvc2l0aW9uKCk7XG5cdFx0bGV0IHJhbmdlID0gUmFuZ2UuaXNJUmFuZ2UocmFuZ2VPclBvcykgPyByYW5nZU9yUG9zIDogKHJhbmdlT3JQb3MgPyBSYW5nZS5mcm9tUG9zaXRpb25zKHJhbmdlT3JQb3MpIDogdW5kZWZpbmVkKTtcblx0XHRpZiAoZ2x5cGhQb3NpdGlvbj8ucG9zaXRpb24gJiYgcmFuZ2UgJiYgZ2x5cGhQb3NpdGlvbi5wb3NpdGlvbi5saW5lTnVtYmVyICE9PSByYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBUaGUgd2lkZ2V0IGNvdWxkIGhhdmUgbW92ZWQgYXMgYSByZXN1bHQgb2YgZWRpdG9yIGNoYW5nZXMuXG5cdFx0XHQvLyBXZSBuZWVkIHRvIHRyeSB0byBjYWxjdWxhdGUgdGhlIG5ldywgbW9yZSBjb3JyZWN0LCByYW5nZSBmb3IgdGhlIGNvbW1lbnQuXG5cdFx0XHRjb25zdCBkaXN0YW5jZSA9IGdseXBoUG9zaXRpb24ucG9zaXRpb24ubGluZU51bWJlciAtIHJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0XHRyYW5nZSA9IG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIgKyBkaXN0YW5jZSwgcmFuZ2Uuc3RhcnRDb2x1bW4sIHJhbmdlLmVuZExpbmVOdW1iZXIgKyBkaXN0YW5jZSwgcmFuZ2UuZW5kQ29sdW1uKTtcblx0XHR9XG5cblx0XHR0aGlzLl9pc0V4cGFuZGVkID0gdHJ1ZTtcblx0XHRzdXBlci5zaG93KHJhbmdlID8/IG5ldyBSYW5nZSgwLCAwLCAwLCAwKSwgaGVpZ2h0SW5MaW5lcyk7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZC5jb2xsYXBzaWJsZVN0YXRlID0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlLkV4cGFuZGVkO1xuXHRcdHRoaXMuX3JlZnJlc2godGhpcy5fY29tbWVudFRocmVhZFdpZGdldC5nZXREaW1lbnNpb25zKCkpO1xuXHR9XG5cblx0YXN5bmMgY29sbGFwc2VBbmRGb2N1c1JhbmdlKCkge1xuXHRcdGlmIChhd2FpdCB0aGlzLmNvbGxhcHNlKHRydWUpICYmIFJhbmdlLmlzSVJhbmdlKHRoaXMuY29tbWVudFRocmVhZC5yYW5nZSkgJiYgaXNDb2RlRWRpdG9yKHRoaXMuZWRpdG9yKSkge1xuXHRcdFx0dGhpcy5lZGl0b3Iuc2V0U2VsZWN0aW9uKHRoaXMuY29tbWVudFRocmVhZC5yYW5nZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgaGlkZSgpIHtcblx0XHRpZiAodGhpcy5faXNFeHBhbmRlZCkge1xuXHRcdFx0dGhpcy5faXNFeHBhbmRlZCA9IGZhbHNlO1xuXHRcdFx0Ly8gRm9jdXMgdGhlIGNvbnRhaW5lciBzbyB0aGF0IHRoZSBjb21tZW50IGVkaXRvciB3aWxsIGJlIGJsdXJyZWQgYmVmb3JlIGl0IGlzIGhpZGRlblxuXHRcdFx0aWYgKHRoaXMuZWRpdG9yLmhhc1dpZGdldEZvY3VzKCkpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzIHx8ICF0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmRlbGV0ZUNvbW1lbnRUaHJlYWQoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0c3VwZXIuaGlkZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHRpZiAodGhpcy5fY29tbWVudEdseXBoKSB7XG5cdFx0XHR0aGlzLl9jb21tZW50R2x5cGguZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fY29tbWVudEdseXBoID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuX2dsb2JhbFRvRGlzcG9zZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZERpc3Bvc2FibGVzLmZvckVhY2goZ2xvYmFsID0+IGdsb2JhbC5kaXNwb3NlKCkpO1xuXHRcdHRoaXMuX29uRGlkQ2xvc2UuZmlyZSh1bmRlZmluZWQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQXNCO0FBQy9CLFNBQXNCLHVCQUF1QjtBQUM3QyxTQUF5QyxjQUFjLHVCQUF1QjtBQUU5RSxTQUFpQixhQUFhO0FBQzlCLFlBQVksZUFBZTtBQUMzQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFzQixxQkFBcUI7QUFDM0MsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx1QkFBdUI7QUFFaEMsU0FBUyxzQkFBc0Isb0JBQW9DO0FBQ25FLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsc0NBQXNDLDRCQUE0Qix3Q0FBd0M7QUFDbkgsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywrQkFBK0I7QUFDeEMsT0FBTyxjQUFjO0FBQ3JCLFlBQVksU0FBUztBQUNyQixTQUFTLHNCQUFzQjtBQUUvQixTQUFTLGlDQUFpQyxRQUFrRCxPQUF1QztBQUNsSSxTQUFPLGlDQUFpQyxRQUFRLEtBQUssS0FBSyxNQUFNLFNBQVMsY0FBYztBQUN4RjtBQUVPLElBQUsscUJBQUwsa0JBQUtBLHdCQUFMO0FBQ04sRUFBQUEsd0NBQUEsVUFBTyxLQUFQO0FB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
