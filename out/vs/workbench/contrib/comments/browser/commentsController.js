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
import { Action } from "../../../../base/common/actions.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { findFirstIdxMonotonousOrArrLen } from "../../../../base/common/arraysFind.js";
import { createCancelablePromise, Delayer } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import "./media/review.css";
import { isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { EditorType } from "../../../../editor/common/editorCommon.js";
import { ModelDecorationOptions, TextModel } from "../../../../editor/common/model/textModel.js";
import * as languages from "../../../../editor/common/languages.js";
import * as nls from "../../../../nls.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { CommentGlyphWidget } from "./commentGlyphWidget.js";
import { ICommentService } from "./commentService.js";
import { CommentWidgetFocus, isMouseUpEventDragFromMouseDown, parseMouseDownInfoFromEvent, ReviewZoneWidget } from "./commentThreadZoneWidget.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { COMMENTS_VIEW_ID } from "./commentsTreeViewer.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { COMMENTS_SECTION } from "../common/commentsConfiguration.js";
import { COMMENTEDITOR_DECORATION_KEY } from "./commentReply.js";
import { Emitter } from "../../../../base/common/event.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { CommentThreadRangeDecorator } from "./commentThreadRangeDecorator.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { URI } from "../../../../base/common/uri.js";
import { threadHasMeaningfulComments } from "./commentsModel.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
const ID = "editor.contrib.review";
class CommentingRangeDecoration {
  constructor(_editor, _ownerId, _extensionId, _label, _range, options, commentingRangesInfo, isHover = false) {
    this._editor = _editor;
    this._ownerId = _ownerId;
    this._extensionId = _extensionId;
    this._label = _label;
    this._range = _range;
    this.options = options;
    this.commentingRangesInfo = commentingRangesInfo;
    this.isHover = isHover;
    this._startLineNumber = _range.startLineNumber;
    this._endLineNumber = _range.endLineNumber;
  }
  get id() {
    return this._decorationId;
  }
  set id(id) {
    this._decorationId = id;
  }
  get range() {
    return {
      startLineNumber: this._startLineNumber,
      startColumn: 1,
      endLineNumber: this._endLineNumber,
      endColumn: 1
    };
  }
  getCommentAction() {
    return {
      extensionId: this._extensionId,
      label: this._label,
      ownerId: this._ownerId,
      commentingRangesInfo: this.commentingRangesInfo
    };
  }
  getOriginalRange() {
    return this._range;
  }
  getActiveRange() {
    return this.id ? this._editor.getModel().getDecorationRange(this.id) : void 0;
  }
}
const _CommentingRangeDecorator = class _CommentingRangeDecorator {
  constructor() {
    this.commentingRangeDecorations = [];
    this.decorationIds = [];
    this._lastHover = -1;
    this._onDidChangeDecorationsCount = new Emitter();
    this.onDidChangeDecorationsCount = this._onDidChangeDecorationsCount.event;
    const decorationOptions = {
      description: _CommentingRangeDecorator.description,
      isWholeLine: true,
      linesDecorationsClassName: "comment-range-glyph comment-diff-added"
    };
    this.decorationOptions = ModelDecorationOptions.createDynamic(decorationOptions);
    const hoverDecorationOptions = {
      description: _CommentingRangeDecorator.description,
      isWholeLine: true,
      linesDecorationsClassName: `comment-range-glyph line-hover`
    };
    this.hoverDecorationOptions = ModelDecorationOptions.createDynamic(hoverDecorationOptions);
    const multilineDecorationOptions = {
      description: _CommentingRangeDecorator.description,
      isWholeLine: true,
      linesDecorationsClassName: `comment-range-glyph multiline-add`
    };
    this.multilineDecorationOptions = ModelDecorationOptions.createDynamic(multilineDecorationOptions);
  }
  updateHover(hoverLine) {
    if (this._editor && this._infos && hoverLine !== this._lastHover) {
      this._doUpdate(this._editor, this._infos, hoverLine);
    }
    this._lastHover = hoverLine ?? -1;
  }
  updateSelection(cursorLine, range = new Range(0, 0, 0, 0)) {
    this._lastSelection = range.isEmpty() ? void 0 : range;
    this._lastSelectionCursor = range.isEmpty() ? void 0 : cursorLine;
    if (this._editor && this._infos) {
      this._doUpdate(this._editor, this._infos, cursorLine, range);
    }
  }
  update(editor, commentInfos, cursorLine, range) {
    if (editor) {
      this._editor = editor;
      this._infos = commentInfos;
      this._doUpdate(editor, commentInfos, cursorLine, range);
    }
  }
  _lineHasThread(editor, lineRange) {
    return editor.getDecorationsInRange(lineRange)?.find((decoration) => decoration.options.description === CommentGlyphWidget.description);
  }
  _doUpdate(editor, commentInfos, emphasisLine = -1, selectionRange = this._lastSelection) {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    emphasisLine = this._lastSelectionCursor ?? emphasisLine;
    const commentingRangeDecorations = [];
    for (const info of commentInfos) {
      info.commentingRanges.ranges.forEach((range) => {
        const rangeObject = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
        let intersectingSelectionRange = selectionRange ? rangeObject.intersectRanges(selectionRange) : void 0;
        if (selectionRange && emphasisLine >= 0 && intersectingSelectionRange && !(intersectingSelectionRange.startLineNumber === intersectingSelectionRange.endLineNumber && emphasisLine === intersectingSelectionRange.startLineNumber)) {
          let intersectingEmphasisRange;
          if (emphasisLine <= intersectingSelectionRange.startLineNumber) {
            intersectingEmphasisRange = intersectingSelectionRange.collapseToStart();
            intersectingSelectionRange = new Range(intersectingSelectionRange.startLineNumber + 1, 1, intersectingSelectionRange.endLineNumber, 1);
          } else {
            intersectingEmphasisRange = new Range(intersectingSelectionRange.endLineNumber, 1, intersectingSelectionRange.endLineNumber, 1);
            intersectingSelectionRange = new Range(intersectingSelectionRange.startLineNumber, 1, intersectingSelectionRange.endLineNumber - 1, 1);
          }
          commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, intersectingSelectionRange, this.multilineDecorationOptions, info.commentingRanges, true));
          if (!this._lineHasThread(editor, intersectingEmphasisRange)) {
            commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, intersectingEmphasisRange, this.hoverDecorationOptions, info.commentingRanges, true));
          }
          const beforeRangeEndLine = Math.min(intersectingEmphasisRange.startLineNumber, intersectingSelectionRange.startLineNumber) - 1;
          const hasBeforeRange = rangeObject.startLineNumber <= beforeRangeEndLine;
          const afterRangeStartLine = Math.max(intersectingEmphasisRange.endLineNumber, intersectingSelectionRange.endLineNumber) + 1;
          const hasAfterRange = rangeObject.endLineNumber >= afterRangeStartLine;
          if (hasBeforeRange) {
            const beforeRange = new Range(range.startLineNumber, 1, beforeRangeEndLine, 1);
            commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, beforeRange, this.decorationOptions, info.commentingRanges, true));
          }
          if (hasAfterRange) {
            const afterRange = new Range(afterRangeStartLine, 1, range.endLineNumber, 1);
            commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, afterRange, this.decorationOptions, info.commentingRanges, true));
          }
        } else if (rangeObject.startLineNumber <= emphasisLine && emphasisLine <= rangeObject.endLineNumber) {
          if (rangeObject.startLineNumber < emphasisLine) {
            const beforeRange = new Range(range.startLineNumber, 1, emphasisLine - 1, 1);
            commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, beforeRange, this.decorationOptions, info.commentingRanges, true));
          }
          const emphasisRange = new Range(emphasisLine, 1, emphasisLine, 1);
          if (!this._lineHasThread(editor, emphasisRange)) {
            commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, emphasisRange, this.hoverDecorationOptions, info.commentingRanges, true));
          }
          if (emphasisLine < rangeObject.endLineNumber) {
            const afterRange = new Range(emphasisLine + 1, 1, range.endLineNumber, 1);
            commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, afterRange, this.decorationOptions, info.commentingRanges, true));
          }
        } else {
          commentingRangeDecorations.push(new CommentingRangeDecoration(editor, info.uniqueOwner, info.extensionId, info.label, range, this.decorationOptions, info.commentingRanges));
        }
      });
    }
    editor.changeDecorations((accessor) => {
      this.decorationIds = accessor.deltaDecorations(this.decorationIds, commentingRangeDecorations);
      commentingRangeDecorations.forEach((decoration, index) => decoration.id = this.decorationIds[index]);
    });
    const rangesDifference = this.commentingRangeDecorations.length - commentingRangeDecorations.length;
    this.commentingRangeDecorations = commentingRangeDecorations;
    if (rangesDifference) {
      this._onDidChangeDecorationsCount.fire(this.commentingRangeDecorations.length);
    }
  }
  areRangesIntersectingOrTouchingByLine(a, b) {
    if (a.endLineNumber < b.startLineNumber - 1) {
      return false;
    }
    if (b.endLineNumber + 1 < a.startLineNumber) {
      return false;
    }
    return true;
  }
  getMatchedCommentAction(commentRange) {
    if (commentRange === void 0) {
      const foundInfos = this._infos?.filter((info) => info.commentingRanges.fileComments);
      if (foundInfos) {
        return foundInfos.map((foundInfo) => {
          return {
            action: {
              ownerId: foundInfo.uniqueOwner,
              extensionId: foundInfo.extensionId,
              label: foundInfo.label,
              commentingRangesInfo: foundInfo.commentingRanges
            }
          };
        });
      }
      return [];
    }
    const foundHoverActions = /* @__PURE__ */ new Map();
    for (const decoration of this.commentingRangeDecorations) {
      const range = decoration.getActiveRange();
      if (range && this.areRangesIntersectingOrTouchingByLine(range, commentRange)) {
        const action = decoration.getCommentAction();
        const alreadyFoundInfo = foundHoverActions.get(action.ownerId);
        if (alreadyFoundInfo?.action.commentingRangesInfo === action.commentingRangesInfo) {
          const newRange = new Range(
            range.startLineNumber < alreadyFoundInfo.range.startLineNumber ? range.startLineNumber : alreadyFoundInfo.range.startLineNumber,
            range.startColumn < alreadyFoundInfo.range.startColumn ? range.startColumn : alreadyFoundInfo.range.startColumn,
            range.endLineNumber > alreadyFoundInfo.range.endLineNumber ? range.endLineNumber : alreadyFoundInfo.range.endLineNumber,
            range.endColumn > alreadyFoundInfo.range.endColumn ? range.endColumn : alreadyFoundInfo.range.endColumn
          );
          foundHoverActions.set(action.ownerId, { range: newRange, action });
        } else {
          foundHoverActions.set(action.ownerId, { range, action });
        }
      }
    }
    const seenOwners = /* @__PURE__ */ new Set();
    return Array.from(foundHoverActions.values()).filter((action) => {
      if (seenOwners.has(action.action.ownerId)) {
        return false;
      } else {
        seenOwners.add(action.action.ownerId);
        return true;
      }
    });
  }
  getNearestCommentingRange(findPosition, reverse) {
    let findPositionContainedWithin;
    let decorations;
    if (reverse) {
      decorations = [];
      for (let i = this.commentingRangeDecorations.length - 1; i >= 0; i--) {
        decorations.push(this.commentingRangeDecorations[i]);
      }
    } else {
      decorations = this.commentingRangeDecorations;
    }
    for (const decoration of decorations) {
      const range = decoration.getActiveRange();
      if (!range) {
        continue;
      }
      if (findPositionContainedWithin && this.areRangesIntersectingOrTouchingByLine(range, findPositionContainedWithin)) {
        findPositionContainedWithin = Range.plusRange(findPositionContainedWithin, range);
        continue;
      }
      if (range.startLineNumber <= findPosition.lineNumber && findPosition.lineNumber <= range.endLineNumber) {
        findPositionContainedWithin = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
        continue;
      }
      if (!reverse && range.endLineNumber < findPosition.lineNumber) {
        continue;
      }
      if (reverse && range.startLineNumber > findPosition.lineNumber) {
        continue;
      }
      return range;
    }
    return decorations.length > 0 ? decorations[0].getActiveRange() ?? void 0 : void 0;
  }
  dispose() {
    this.commentingRangeDecorations = [];
  }
};
_CommentingRangeDecorator.description = "commenting-range-decorator";
let CommentingRangeDecorator = _CommentingRangeDecorator;
function moveToNextCommentInThread(commentInfo, type) {
  if (!commentInfo?.comment || !commentInfo?.thread?.comments) {
    return;
  }
  const currentIndex = commentInfo.thread.comments?.indexOf(commentInfo.comment);
  if (currentIndex === void 0 || currentIndex < 0) {
    return;
  }
  if (type === "previous" && currentIndex === 0) {
    return;
  }
  if (type === "next" && currentIndex === commentInfo.thread.comments.length - 1) {
    return;
  }
  const comment = commentInfo.thread.comments?.[type === "previous" ? currentIndex - 1 : currentIndex + 1];
  if (!comment) {
    return;
  }
  return {
    ...commentInfo,
    comment
  };
}
function revealCommentThread(commentService, editorService, uriIdentityService, commentThread, comment, focusReply, pinned, preserveFocus, sideBySide) {
  if (!commentThread.resource) {
    return;
  }
  if (!commentService.isCommentingEnabled) {
    commentService.enableCommenting(true);
  }
  const range = commentThread.range;
  const focus = focusReply ? CommentWidgetFocus.Editor : preserveFocus ? CommentWidgetFocus.None : CommentWidgetFocus.Widget;
  const activeEditor = editorService.activeTextEditorControl;
  const currentActiveResources = isDiffEditor(activeEditor) ? [activeEditor.getOriginalEditor(), activeEditor.getModifiedEditor()] : activeEditor ? [activeEditor] : [];
  const threadToReveal = commentThread.threadId;
  const commentToReveal = comment?.uniqueIdInThread;
  const resource = URI.parse(commentThread.resource);
  for (const editor of currentActiveResources) {
    const model = editor.getModel();
    if (model instanceof TextModel && uriIdentityService.extUri.isEqual(resource, model.uri)) {
      if (threadToReveal && isCodeEditor(editor)) {
        const controller = CommentController.get(editor);
        controller?.revealCommentThread(threadToReveal, commentToReveal, true, focus);
      }
      return;
    }
  }
  editorService.openEditor({
    resource,
    options: {
      pinned,
      preserveFocus,
      selection: range ?? new Range(1, 1, 1, 1)
    }
  }, sideBySide ? SIDE_GROUP : ACTIVE_GROUP).then((editor) => {
    if (editor) {
      const control = editor.getControl();
      if (threadToReveal && isCodeEditor(control)) {
        const controller = CommentController.get(control);
        controller?.revealCommentThread(threadToReveal, commentToReveal, true, focus);
      }
    }
  });
}
let CommentController = class {
  constructor(editor, commentService, instantiationService, codeEditorService, contextMenuService, quickInputService, viewsService, configurationService, contextKeyService, editorService, keybindingService, accessibilityService, notificationService) {
    this.commentService = commentService;
    this.instantiationService = instantiationService;
    this.codeEditorService = codeEditorService;
    this.contextMenuService = contextMenuService;
    this.quickInputService = quickInputService;
    this.viewsService = viewsService;
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.keybindingService = keybindingService;
    this.accessibilityService = accessibilityService;
    this.notificationService = notificationService;
    this.globalToDispose = new DisposableStore();
    this.localToDispose = new DisposableStore();
    this.mouseDownInfo = null;
    this._commentingRangeSpaceReserved = false;
    this._commentingRangeAmountReserved = 0;
    this._emptyThreadsToAddQueue = [];
    // uniqueOwner -> threadId -> uniqueIdInThread -> pending comment
    this._inProcessContinueOnComments = /* @__PURE__ */ new Map();
    this._editorDisposables = [];
    this._hasRespondedToEditorChange = false;
    this._commentInfos = [];
    this._commentWidgets = [];
    this._pendingNewCommentCache = {};
    this._pendingEditsCache = {};
    this._computePromise = null;
    this._activeCursorHasCommentingRange = CommentContextKeys.activeCursorHasCommentingRange.bindTo(contextKeyService);
    this._activeCursorHasComment = CommentContextKeys.activeCursorHasComment.bindTo(contextKeyService);
    this._activeEditorHasCommentingRange = CommentContextKeys.activeEditorHasCommentingRange.bindTo(contextKeyService);
    if (editor instanceof EmbeddedCodeEditorWidget) {
      return;
    }
    this.editor = editor;
    this._commentingRangeDecorator = new CommentingRangeDecorator();
    this.globalToDispose.add(this._commentingRangeDecorator.onDidChangeDecorationsCount((count) => {
      if (count === 0) {
        this.clearEditorListeners();
      } else if (this._editorDisposables.length === 0) {
        this.registerEditorListeners();
      }
    }));
    this.globalToDispose.add(this._commentThreadRangeDecorator = new CommentThreadRangeDecorator(this.commentService));
    this.globalToDispose.add(this.commentService.onDidDeleteDataProvider((ownerId) => {
      if (ownerId) {
        delete this._pendingNewCommentCache[ownerId];
        delete this._pendingEditsCache[ownerId];
      } else {
        this._pendingNewCommentCache = {};
        this._pendingEditsCache = {};
      }
      this.beginCompute();
    }));
    this.globalToDispose.add(this.commentService.onDidSetDataProvider((_) => this.beginComputeAndHandleEditorChange()));
    this.globalToDispose.add(this.commentService.onDidUpdateCommentingRanges((_) => this.beginComputeAndHandleEditorChange()));
    this.globalToDispose.add(this.commentService.onDidSetResourceCommentInfos(async (e) => {
      const editorURI = this.editor && this.editor.hasModel() && this.editor.getModel().uri;
      if (editorURI && editorURI.toString() === e.resource.toString()) {
        await this.setComments(e.commentInfos.filter((commentInfo) => commentInfo !== null));
      }
    }));
    this.globalToDispose.add(this.commentService.onDidChangeCommentingEnabled((e) => {
      if (e) {
        this.registerEditorListeners();
        this.beginCompute();
      } else {
        this.tryUpdateReservedSpace();
        this.clearEditorListeners();
        this._commentingRangeDecorator.update(this.editor, []);
        this._commentThreadRangeDecorator.update(this.editor, []);
        dispose(this._commentWidgets);
        this._commentWidgets = [];
      }
    }));
    this.globalToDispose.add(this.editor.onWillChangeModel((e) => this.onWillChangeModel(e)));
    this.globalToDispose.add(this.editor.onDidChangeModel((_) => this.onModelChanged()));
    this.globalToDispose.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("diffEditor.renderSideBySide")) {
        this.beginCompute();
      }
    }));
    this.onModelChanged();
    this.codeEditorService.registerDecorationType("comment-controller", COMMENTEDITOR_DECORATION_KEY, {});
    this.globalToDispose.add(
      this.commentService.registerContinueOnCommentProvider({
        provideContinueOnComments: () => {
          const pendingComments = [];
          if (this._commentWidgets) {
            for (const zone of this._commentWidgets) {
              const zonePendingComments = zone.getPendingComments();
              const pendingNewComment = zonePendingComments.newComment;
              if (!pendingNewComment) {
                continue;
              }
              let lastCommentBody;
              if (zone.commentThread.comments && zone.commentThread.comments.length) {
                const lastComment = zone.commentThread.comments[zone.commentThread.comments.length - 1];
                if (typeof lastComment.body === "string") {
                  lastCommentBody = lastComment.body;
                } else {
                  lastCommentBody = lastComment.body.value;
                }
              }
              if (pendingNewComment.body !== lastCommentBody) {
                pendingComments.push({
                  uniqueOwner: zone.uniqueOwner,
                  uri: zone.editor.getModel().uri,
                  range: zone.commentThread.range,
                  comment: pendingNewComment,
                  isReply: zone.commentThread.comments !== void 0 && zone.commentThread.comments.length > 0
                });
              }
            }
          }
          return pendingComments;
        }
      })
    );
  }
  registerEditorListeners() {
    this._editorDisposables = [];
    if (!this.editor) {
      return;
    }
    this._editorDisposables.push(this.editor.onMouseMove((e) => this.onEditorMouseMove(e)));
    this._editorDisposables.push(this.editor.onMouseLeave(() => this.onEditorMouseLeave()));
    this._editorDisposables.push(this.editor.onDidChangeCursorPosition((e) => this.onEditorChangeCursorPosition(e.position)));
    this._editorDisposables.push(this.editor.onDidFocusEditorWidget(() => this.onEditorChangeCursorPosition(this.editor?.getPosition() ?? null)));
    this._editorDisposables.push(this.editor.onDidChangeCursorSelection((e) => this.onEditorChangeCursorSelection(e)));
    this._editorDisposables.push(this.editor.onDidBlurEditorWidget(() => this.onEditorChangeCursorSelection()));
  }
  clearEditorListeners() {
    dispose(this._editorDisposables);
    this._editorDisposables = [];
  }
  onEditorMouseLeave() {
    this._commentingRangeDecorator.updateHover();
  }
  onEditorMouseMove(e) {
    const position = e.target.position?.lineNumber;
    if (e.event.leftButton.valueOf() && position && this.mouseDownInfo) {
      this._commentingRangeDecorator.updateSelection(position, new Range(this.mouseDownInfo.lineNumber, 1, position, 1));
    } else {
      this._commentingRangeDecorator.updateHover(position);
    }
  }
  onEditorChangeCursorSelection(e) {
    const position = this.editor?.getPosition()?.lineNumber;
    if (position) {
      this._commentingRangeDecorator.updateSelection(position, e?.selection);
    }
  }
  onEditorChangeCursorPosition(e) {
    if (!e) {
      return;
    }
    const range = Range.fromPositions(e, { column: -1, lineNumber: e.lineNumber });
    const decorations = this.editor?.getDecorationsInRange(range);
    let hasCommentingRange = false;
    if (decorations) {
      for (const decoration of decorations) {
        if (decoration.options.description === CommentGlyphWidget.description) {
          hasCommentingRange = false;
          break;
        } else if (decoration.options.description === CommentingRangeDecorator.description) {
          hasCommentingRange = true;
        }
      }
    }
    this._activeCursorHasCommentingRange.set(hasCommentingRange);
    this._activeCursorHasComment.set(this.getCommentsAtLine(range).length > 0);
  }
  isEditorInlineOriginal(testEditor) {
    if (this.configurationService.getValue("diffEditor.renderSideBySide")) {
      return false;
    }
    const foundEditor = this.editorService.visibleTextEditorControls.find((editor) => {
      if (editor.getEditorType() === EditorType.IDiffEditor) {
        const diffEditor = editor;
        return diffEditor.getOriginalEditor() === testEditor;
      }
      return false;
    });
    return !!foundEditor;
  }
  beginCompute() {
    this._computePromise = createCancelablePromise((token) => {
      const editorURI = this.editor && this.editor.hasModel() && this.editor.getModel().uri;
      if (editorURI) {
        return this.commentService.getDocumentComments(editorURI);
      }
      return Promise.resolve([]);
    });
    this._computeAndSetPromise = this._computePromise.then(async (commentInfos) => {
      await this.setComments(coalesce(commentInfos));
      this._computePromise = null;
    }, (error) => console.log(error));
    this._computePromise.then(() => this._computeAndSetPromise = void 0);
    return this._computeAndSetPromise;
  }
  beginComputeCommentingRanges() {
    if (this._computeCommentingRangeScheduler) {
      if (this._computeCommentingRangePromise) {
        this._computeCommentingRangePromise.cancel();
        this._computeCommentingRangePromise = null;
      }
      this._computeCommentingRangeScheduler.trigger(() => {
        const editorURI = this.editor && this.editor.hasModel() && this.editor.getModel().uri;
        if (editorURI) {
          return this.commentService.getDocumentComments(editorURI);
        }
        return Promise.resolve([]);
      }).then((commentInfos) => {
        if (this.commentService.isCommentingEnabled) {
          const meaningfulCommentInfos = coalesce(commentInfos);
          this._commentingRangeDecorator.update(this.editor, meaningfulCommentInfos, this.editor?.getPosition()?.lineNumber, this.editor?.getSelection() ?? void 0);
        }
      }, (err) => {
        onUnexpectedError(err);
        return null;
      });
    }
  }
  static get(editor) {
    return editor.getContribution(ID);
  }
  revealCommentThread(threadId, commentUniqueId, fetchOnceIfNotExist, focus) {
    const commentThreadWidget = this._commentWidgets.filter((widget) => widget.commentThread.threadId === threadId);
    if (commentThreadWidget.length === 1) {
      commentThreadWidget[0].reveal(commentUniqueId, focus);
    } else if (fetchOnceIfNotExist) {
      if (this._computeAndSetPromise) {
        this._computeAndSetPromise.then((_) => {
          this.revealCommentThread(threadId, commentUniqueId, false, focus);
        });
      } else {
        this.beginCompute().then((_) => {
          this.revealCommentThread(threadId, commentUniqueId, false, focus);
        });
      }
    }
  }
  collapseAll() {
    for (const widget of this._commentWidgets) {
      widget.collapse(true);
    }
  }
  expandAll() {
    for (const widget of this._commentWidgets) {
      widget.expand();
    }
  }
  expandUnresolved() {
    for (const widget of this._commentWidgets) {
      if (widget.commentThread.state === languages.CommentThreadState.Unresolved) {
        widget.expand();
      }
    }
  }
  nextCommentThread(focusThread) {
    this._findNearestCommentThread(focusThread);
  }
  _findNearestCommentThread(focusThread, reverse) {
    if (!this._commentWidgets.length || !this.editor?.hasModel()) {
      return;
    }
    const after = reverse ? this.editor.getSelection().getStartPosition() : this.editor.getSelection().getEndPosition();
    const sortedWidgets = this._commentWidgets.sort((a, b) => {
      if (reverse) {
        const temp = a;
        a = b;
        b = temp;
      }
      if (a.commentThread.range === void 0) {
        return -1;
      }
      if (b.commentThread.range === void 0) {
        return 1;
      }
      if (a.commentThread.range.startLineNumber < b.commentThread.range.startLineNumber) {
        return -1;
      }
      if (a.commentThread.range.startLineNumber > b.commentThread.range.startLineNumber) {
        return 1;
      }
      if (a.commentThread.range.startColumn < b.commentThread.range.startColumn) {
        return -1;
      }
      if (a.commentThread.range.startColumn > b.commentThread.range.startColumn) {
        return 1;
      }
      return 0;
    });
    const idx = findFirstIdxMonotonousOrArrLen(sortedWidgets, (widget) => {
      const lineValueOne = reverse ? after.lineNumber : widget.commentThread.range?.startLineNumber ?? 0;
      const lineValueTwo = reverse ? widget.commentThread.range?.startLineNumber ?? 0 : after.lineNumber;
      const columnValueOne = reverse ? after.column : widget.commentThread.range?.startColumn ?? 0;
      const columnValueTwo = reverse ? widget.commentThread.range?.startColumn ?? 0 : after.column;
      if (lineValueOne > lineValueTwo) {
        return true;
      }
      if (lineValueOne < lineValueTwo) {
        return false;
      }
      if (columnValueOne > columnValueTwo) {
        return true;
      }
      return false;
    });
    const nextWidget = sortedWidgets[idx];
    if (nextWidget !== void 0) {
      this.editor.setSelection(nextWidget.commentThread.range ?? new Range(1, 1, 1, 1));
      nextWidget.reveal(void 0, focusThread ? CommentWidgetFocus.Widget : CommentWidgetFocus.None);
    }
  }
  previousCommentThread(focusThread) {
    this._findNearestCommentThread(focusThread, true);
  }
  _findNearestCommentingRange(reverse) {
    if (!this.editor?.hasModel()) {
      return;
    }
    const after = this.editor.getSelection().getEndPosition();
    const range = this._commentingRangeDecorator.getNearestCommentingRange(after, reverse);
    if (range) {
      const position = reverse ? range.getEndPosition() : range.getStartPosition();
      this.editor.setPosition(position);
      this.editor.revealLineInCenterIfOutsideViewport(position.lineNumber);
    }
    if (this.accessibilityService.isScreenReaderOptimized()) {
      const commentRangeStart = range?.getStartPosition().lineNumber;
      const commentRangeEnd = range?.getEndPosition().lineNumber;
      if (commentRangeStart && commentRangeEnd) {
        const oneLine = commentRangeStart === commentRangeEnd;
        oneLine ? status(nls.localize("commentRange", "Line {0}", commentRangeStart)) : status(nls.localize("commentRangeStart", "Lines {0} to {1}", commentRangeStart, commentRangeEnd));
      }
    }
  }
  nextCommentingRange() {
    this._findNearestCommentingRange();
  }
  previousCommentingRange() {
    this._findNearestCommentingRange(true);
  }
  dispose() {
    this.globalToDispose.dispose();
    this.localToDispose.dispose();
    dispose(this._editorDisposables);
    dispose(this._commentWidgets);
    this.editor = null;
  }
  onWillChangeModel(e) {
    if (e.newModelUrl) {
      this.tryUpdateReservedSpace(e.newModelUrl);
    }
  }
  async handleCommentAdded(editorId, uniqueOwner, thread) {
    const matchedZones = this._commentWidgets.filter((zoneWidget) => zoneWidget.uniqueOwner === uniqueOwner && zoneWidget.commentThread.threadId === thread.threadId);
    if (matchedZones.length) {
      return;
    }
    const matchedNewCommentThreadZones = this._commentWidgets.filter((zoneWidget) => zoneWidget.uniqueOwner === uniqueOwner && zoneWidget.commentThread.commentThreadHandle === -1 && Range.equalsRange(zoneWidget.commentThread.range, thread.range));
    if (matchedNewCommentThreadZones.length) {
      matchedNewCommentThreadZones[0].update(thread);
      return;
    }
    const continueOnCommentIndex = this._inProcessContinueOnComments.get(uniqueOwner)?.findIndex((pending) => {
      if (pending.range === void 0) {
        return thread.range === void 0;
      } else {
        return Range.lift(pending.range).equalsRange(thread.range);
      }
    });
    let continueOnCommentText;
    if (continueOnCommentIndex !== void 0 && continueOnCommentIndex >= 0) {
      continueOnCommentText = this._inProcessContinueOnComments.get(uniqueOwner)?.splice(continueOnCommentIndex, 1)[0].comment.body;
    }
    const pendingCommentText = (this._pendingNewCommentCache[uniqueOwner] && this._pendingNewCommentCache[uniqueOwner][thread.threadId]) ?? continueOnCommentText;
    const pendingEdits = this._pendingEditsCache[uniqueOwner] && this._pendingEditsCache[uniqueOwner][thread.threadId];
    const shouldReveal = thread.canReply && thread.isTemplate && (!thread.comments || thread.comments.length === 0) && (!thread.editorId || thread.editorId === editorId);
    await this.displayCommentThread(uniqueOwner, thread, shouldReveal, pendingCommentText, pendingEdits);
    this._commentInfos.filter((info) => info.uniqueOwner === uniqueOwner)[0].threads.push(thread);
    this.tryUpdateReservedSpace();
  }
  onModelChanged() {
    this.localToDispose.clear();
    this.tryUpdateReservedSpace();
    this.removeCommentWidgetsAndStoreCache();
    if (!this.editor) {
      return;
    }
    this._hasRespondedToEditorChange = false;
    this.localToDispose.add(this.editor.onMouseDown((e) => this.onEditorMouseDown(e)));
    this.localToDispose.add(this.editor.onMouseUp((e) => this.onEditorMouseUp(e)));
    if (this._editorDisposables.length) {
      this.clearEditorListeners();
      this.registerEditorListeners();
    }
    this._computeCommentingRangeScheduler = new Delayer(200);
    this.localToDispose.add({
      dispose: () => {
        this._computeCommentingRangeScheduler?.cancel();
        this._computeCommentingRangeScheduler = null;
      }
    });
    this.localToDispose.add(this.editor.onDidChangeModelContent(async () => {
      this.beginComputeCommentingRanges();
    }));
    this.localToDispose.add(this.commentService.onDidUpdateCommentThreads(async (e) => {
      const editorURI = this.editor && this.editor.hasModel() && this.editor.getModel().uri;
      if (!editorURI || !this.commentService.isCommentingEnabled) {
        return;
      }
      if (this._computePromise) {
        await this._computePromise;
      }
      const commentInfo = this._commentInfos.filter((info) => info.uniqueOwner === e.uniqueOwner);
      if (!commentInfo || !commentInfo.length) {
        return;
      }
      const added = e.added.filter((thread) => thread.resource && thread.resource === editorURI.toString());
      const removed = e.removed.filter((thread) => thread.resource && thread.resource === editorURI.toString());
      const changed = e.changed.filter((thread) => thread.resource && thread.resource === editorURI.toString());
      const pending = e.pending.filter((pending2) => pending2.uri.toString() === editorURI.toString());
      removed.forEach((thread) => {
        const matchedZones = this._commentWidgets.filter((zoneWidget) => zoneWidget.uniqueOwner === e.uniqueOwner && zoneWidget.commentThread.threadId === thread.threadId && zoneWidget.commentThread.threadId !== "");
        if (matchedZones.length) {
          const matchedZone = matchedZones[0];
          const index = this._commentWidgets.indexOf(matchedZone);
          this._commentWidgets.splice(index, 1);
          matchedZone.dispose();
        }
        const infosThreads = this._commentInfos.filter((info) => info.uniqueOwner === e.uniqueOwner)[0].threads;
        for (let i = 0; i < infosThreads.length; i++) {
          if (infosThreads[i] === thread) {
            infosThreads.splice(i, 1);
            i--;
          }
        }
      });
      for (const thread of changed) {
        const matchedZones = this._commentWidgets.filter((zoneWidget) => zoneWidget.uniqueOwner === e.uniqueOwner && zoneWidget.commentThread.threadId === thread.threadId);
        if (matchedZones.length) {
          const matchedZone = matchedZones[0];
          matchedZone.update(thread);
          this.openCommentsView(thread);
        }
      }
      const editorId = this.editor?.getId();
      for (const thread of added) {
        await this.handleCommentAdded(editorId, e.uniqueOwner, thread);
      }
      for (const thread of pending) {
        await this.resumePendingComment(editorURI, thread);
      }
      this._commentThreadRangeDecorator.update(this.editor, commentInfo);
    }));
    this.beginComputeAndHandleEditorChange();
  }
  async resumePendingComment(editorURI, thread) {
    const matchedZones = this._commentWidgets.filter((zoneWidget) => zoneWidget.uniqueOwner === thread.uniqueOwner && Range.lift(zoneWidget.commentThread.range)?.equalsRange(thread.range));
    if (thread.isReply && matchedZones.length) {
      this.commentService.removeContinueOnComment({ uniqueOwner: thread.uniqueOwner, uri: editorURI, range: thread.range, isReply: true });
      matchedZones[0].setPendingComment(thread.comment);
    } else if (matchedZones.length) {
      this.commentService.removeContinueOnComment({ uniqueOwner: thread.uniqueOwner, uri: editorURI, range: thread.range, isReply: false });
      const existingPendingComment = matchedZones[0].getPendingComments().newComment;
      let pendingComment;
      if (!existingPendingComment || thread.comment.body.includes(existingPendingComment.body)) {
        pendingComment = thread.comment;
      } else if (existingPendingComment.body.includes(thread.comment.body)) {
        pendingComment = existingPendingComment;
      } else {
        pendingComment = { body: `${existingPendingComment}
${thread.comment.body}`, cursor: thread.comment.cursor };
      }
      matchedZones[0].setPendingComment(pendingComment);
    } else if (!thread.isReply) {
      const threadStillAvailable = this.commentService.removeContinueOnComment({ uniqueOwner: thread.uniqueOwner, uri: editorURI, range: thread.range, isReply: false });
      if (!threadStillAvailable) {
        return;
      }
      if (!this._inProcessContinueOnComments.has(thread.uniqueOwner)) {
        this._inProcessContinueOnComments.set(thread.uniqueOwner, []);
      }
      this._inProcessContinueOnComments.get(thread.uniqueOwner)?.push(thread);
      await this.commentService.createCommentThreadTemplate(thread.uniqueOwner, thread.uri, thread.range ? Range.lift(thread.range) : void 0);
    }
  }
  beginComputeAndHandleEditorChange() {
    this.beginCompute().then(() => {
      if (!this._hasRespondedToEditorChange) {
        if (this._commentInfos.some((commentInfo) => commentInfo.commentingRanges.ranges.length > 0 || commentInfo.commentingRanges.fileComments)) {
          this._hasRespondedToEditorChange = true;
          const verbose = this.configurationService.getValue(AccessibilityVerbositySettingId.Comments);
          if (verbose) {
            const keybinding = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getAriaLabel();
            if (keybinding) {
              status(nls.localize("hasCommentRangesKb", "Editor has commenting ranges, run the command Open Accessibility Help ({0}), for more information.", keybinding));
            } else {
              status(nls.localize("hasCommentRangesNoKb", "Editor has commenting ranges, run the command Open Accessibility Help, which is currently not triggerable via keybinding, for more information."));
            }
          } else {
            status(nls.localize("hasCommentRanges", "Editor has commenting ranges."));
          }
        }
      }
    });
  }
  async openCommentsView(thread) {
    if (thread.comments && thread.comments.length > 0 && threadHasMeaningfulComments(thread)) {
      const openViewState = this.configurationService.getValue(COMMENTS_SECTION).openView;
      if (openViewState === "file") {
        return this.viewsService.openView(COMMENTS_VIEW_ID);
      } else if (openViewState === "firstFile" || openViewState === "firstFileUnresolved" && thread.state === languages.CommentThreadState.Unresolved) {
        const hasShownView = this.viewsService.getViewWithId(COMMENTS_VIEW_ID)?.hasRendered;
        if (!hasShownView) {
          return this.viewsService.openView(COMMENTS_VIEW_ID);
        }
      }
    }
    return void 0;
  }
  async displayCommentThread(uniqueOwner, thread, shouldReveal, pendingComment, pendingEdits) {
    const editor = this.editor?.getModel();
    if (!editor) {
      return;
    }
    if (!this.editor || this.isEditorInlineOriginal(this.editor)) {
      return;
    }
    let continueOnCommentReply;
    if (thread.range && !pendingComment) {
      continueOnCommentReply = this.commentService.removeContinueOnComment({ uniqueOwner, uri: editor.uri, range: thread.range, isReply: true });
    }
    const zoneWidget = this.instantiationService.createInstance(ReviewZoneWidget, this.editor, uniqueOwner, thread, pendingComment ?? continueOnCommentReply?.comment, pendingEdits);
    await zoneWidget.display(thread.range, shouldReveal);
    this._commentWidgets.push(zoneWidget);
    this.openCommentsView(thread);
  }
  onEditorMouseDown(e) {
    this.mouseDownInfo = this._activeEditorHasCommentingRange.get() ? parseMouseDownInfoFromEvent(e) : null;
  }
  onEditorMouseUp(e) {
    const matchedLineNumber = isMouseUpEventDragFromMouseDown(this.mouseDownInfo, e);
    this.mouseDownInfo = null;
    if (!this.editor || matchedLineNumber === null || !e.target.element) {
      return;
    }
    const mouseUpIsOnDecorator = e.target.element.className.indexOf("comment-range-glyph") >= 0;
    const lineNumber = e.target.position.lineNumber;
    let range;
    let selection;
    if (matchedLineNumber !== lineNumber) {
      if (matchedLineNumber > lineNumber) {
        selection = new Range(matchedLineNumber, this.editor.getModel().getLineLength(matchedLineNumber) + 1, lineNumber, 1);
      } else {
        selection = new Range(matchedLineNumber, 1, lineNumber, this.editor.getModel().getLineLength(lineNumber) + 1);
      }
    } else if (mouseUpIsOnDecorator) {
      selection = this.editor.getSelection();
    }
    if (selection && selection.startLineNumber <= lineNumber && lineNumber <= selection.endLineNumber) {
      range = selection;
      this.editor.setSelection(new Range(selection.endLineNumber, 1, selection.endLineNumber, 1));
    } else if (mouseUpIsOnDecorator) {
      range = new Range(lineNumber, 1, lineNumber, 1);
    }
    if (range) {
      this.addOrToggleCommentAtLine(range, e);
    }
  }
  getCommentsAtLine(commentRange) {
    return this._commentWidgets.filter((widget) => widget.getGlyphPosition() === (commentRange ? commentRange.endLineNumber : 0));
  }
  async addOrToggleCommentAtLine(commentRange, e) {
    if (!this._addInProgress) {
      this._addInProgress = true;
      const existingCommentsAtLine = this.getCommentsAtLine(commentRange);
      if (existingCommentsAtLine.length) {
        const allExpanded = existingCommentsAtLine.every((widget) => widget.expanded);
        existingCommentsAtLine.forEach(allExpanded ? (widget) => widget.collapse(true) : (widget) => widget.expand(true));
        this.processNextThreadToAdd();
        return;
      } else {
        this.addCommentAtLine(commentRange, e);
      }
    } else {
      this._emptyThreadsToAddQueue.push([commentRange, e]);
    }
  }
  processNextThreadToAdd() {
    this._addInProgress = false;
    const info = this._emptyThreadsToAddQueue.shift();
    if (info) {
      this.addOrToggleCommentAtLine(info[0], info[1]);
    }
  }
  clipUserRangeToCommentRange(userRange, commentRange) {
    if (userRange.startLineNumber < commentRange.startLineNumber) {
      userRange = new Range(commentRange.startLineNumber, commentRange.startColumn, userRange.endLineNumber, userRange.endColumn);
    }
    if (userRange.endLineNumber > commentRange.endLineNumber) {
      userRange = new Range(userRange.startLineNumber, userRange.startColumn, commentRange.endLineNumber, commentRange.endColumn);
    }
    return userRange;
  }
  addCommentAtLine(range, e) {
    const newCommentInfos = this._commentingRangeDecorator.getMatchedCommentAction(range);
    if (!newCommentInfos.length || !this.editor?.hasModel()) {
      this._addInProgress = false;
      if (!newCommentInfos.length) {
        if (range) {
          this.notificationService.error(nls.localize("comments.addCommand.error", "The cursor must be within a commenting range to add a comment."));
        } else {
          this.notificationService.error(nls.localize("comments.addFileCommentCommand.error", "File comments are not allowed on this file."));
        }
      }
      return Promise.resolve();
    }
    if (newCommentInfos.length > 1) {
      if (e && range) {
        this.contextMenuService.showContextMenu({
          getAnchor: () => e.event,
          getActions: () => this.getContextMenuActions(newCommentInfos, range),
          getActionsContext: () => newCommentInfos.length ? newCommentInfos[0] : void 0,
          onHide: () => {
            this._addInProgress = false;
          }
        });
        return Promise.resolve();
      } else {
        const picks = this.getCommentProvidersQuickPicks(newCommentInfos);
        return this.quickInputService.pick(picks, { placeHolder: nls.localize("pickCommentService", "Select Comment Provider"), matchOnDescription: true }).then((pick) => {
          if (!pick) {
            return;
          }
          const commentInfos = newCommentInfos.filter((info) => info.action.ownerId === pick.id);
          if (commentInfos.length) {
            const { ownerId } = commentInfos[0].action;
            const clippedRange = range && commentInfos[0].range ? this.clipUserRangeToCommentRange(range, commentInfos[0].range) : range;
            this.addCommentAtLine2(clippedRange, ownerId);
          }
        }).then(() => {
          this._addInProgress = false;
        });
      }
    } else {
      const { ownerId } = newCommentInfos[0].action;
      const clippedRange = range && newCommentInfos[0].range ? this.clipUserRangeToCommentRange(range, newCommentInfos[0].range) : range;
      this.addCommentAtLine2(clippedRange, ownerId);
    }
    return Promise.resolve();
  }
  getCommentProvidersQuickPicks(commentInfos) {
    const picks = commentInfos.map((commentInfo) => {
      const { ownerId, extensionId, label } = commentInfo.action;
      return {
        label: label ?? extensionId ?? ownerId,
        id: ownerId
      };
    });
    return picks;
  }
  getContextMenuActions(commentInfos, commentRange) {
    const actions = [];
    commentInfos.forEach((commentInfo) => {
      const { ownerId, extensionId, label } = commentInfo.action;
      actions.push(new Action(
        "addCommentThread",
        `${label || extensionId}`,
        void 0,
        true,
        () => {
          const clippedRange = commentInfo.range ? this.clipUserRangeToCommentRange(commentRange, commentInfo.range) : commentRange;
          this.addCommentAtLine2(clippedRange, ownerId);
          return Promise.resolve();
        }
      ));
    });
    return actions;
  }
  addCommentAtLine2(range, ownerId) {
    if (!this.editor) {
      return;
    }
    this.commentService.createCommentThreadTemplate(ownerId, this.editor.getModel().uri, range, this.editor.getId());
    this.processNextThreadToAdd();
    return;
  }
  getExistingCommentEditorOptions(editor) {
    const lineDecorationsWidth = editor.getOption(EditorOption.lineDecorationsWidth);
    let extraEditorClassName = [];
    const configuredExtraClassName = editor.getRawOptions().extraEditorClassName;
    if (configuredExtraClassName) {
      extraEditorClassName = configuredExtraClassName.split(" ");
    }
    return { lineDecorationsWidth, extraEditorClassName };
  }
  getWithoutCommentsEditorOptions(editor, extraEditorClassName, startingLineDecorationsWidth) {
    let lineDecorationsWidth = startingLineDecorationsWidth;
    const inlineCommentPos = extraEditorClassName.findIndex((name) => name === "inline-comment");
    if (inlineCommentPos >= 0) {
      extraEditorClassName.splice(inlineCommentPos, 1);
    }
    const options = editor.getOptions();
    if (options.get(EditorOption.folding) && options.get(EditorOption.showFoldingControls) !== "never") {
      lineDecorationsWidth += 11;
    }
    lineDecorationsWidth -= 24;
    return { extraEditorClassName, lineDecorationsWidth };
  }
  getWithCommentsLineDecorationWidth(editor, startingLineDecorationsWidth) {
    let lineDecorationsWidth = startingLineDecorationsWidth;
    const options = editor.getOptions();
    if (options.get(EditorOption.folding) && options.get(EditorOption.showFoldingControls) !== "never") {
      lineDecorationsWidth -= 11;
    }
    lineDecorationsWidth += 24;
    this._commentingRangeAmountReserved = lineDecorationsWidth;
    return this._commentingRangeAmountReserved;
  }
  getWithCommentsEditorOptions(editor, extraEditorClassName, startingLineDecorationsWidth) {
    extraEditorClassName.push("inline-comment");
    return { lineDecorationsWidth: this.getWithCommentsLineDecorationWidth(editor, startingLineDecorationsWidth), extraEditorClassName };
  }
  updateEditorLayoutOptions(editor, extraEditorClassName, lineDecorationsWidth) {
    editor.updateOptions({
      extraEditorClassName: extraEditorClassName.join(" "),
      lineDecorationsWidth
    });
  }
  ensureCommentingRangeReservedAmount(editor) {
    const existing = this.getExistingCommentEditorOptions(editor);
    if (existing.lineDecorationsWidth !== this._commentingRangeAmountReserved) {
      editor.updateOptions({
        lineDecorationsWidth: this.getWithCommentsLineDecorationWidth(editor, existing.lineDecorationsWidth)
      });
    }
  }
  tryUpdateReservedSpace(uri) {
    if (!this.editor) {
      return;
    }
    const hasCommentsOrRangesInInfo = this._commentInfos.some((info) => {
      const hasRanges = Boolean(info.commentingRanges && (Array.isArray(info.commentingRanges) ? info.commentingRanges : info.commentingRanges.ranges).length);
      return hasRanges || info.threads.length > 0;
    });
    uri = uri ?? this.editor.getModel()?.uri;
    const resourceHasCommentingRanges = uri ? this.commentService.resourceHasCommentingRanges(uri) : false;
    const hasCommentsOrRanges = hasCommentsOrRangesInInfo || resourceHasCommentingRanges;
    if (hasCommentsOrRanges && this.commentService.isCommentingEnabled) {
      if (!this._commentingRangeSpaceReserved) {
        this._commentingRangeSpaceReserved = true;
        const { lineDecorationsWidth, extraEditorClassName } = this.getExistingCommentEditorOptions(this.editor);
        const newOptions = this.getWithCommentsEditorOptions(this.editor, extraEditorClassName, lineDecorationsWidth);
        this.updateEditorLayoutOptions(this.editor, newOptions.extraEditorClassName, newOptions.lineDecorationsWidth);
      } else {
        this.ensureCommentingRangeReservedAmount(this.editor);
      }
    } else if ((!hasCommentsOrRanges || !this.commentService.isCommentingEnabled) && this._commentingRangeSpaceReserved) {
      this._commentingRangeSpaceReserved = false;
      const { lineDecorationsWidth, extraEditorClassName } = this.getExistingCommentEditorOptions(this.editor);
      const newOptions = this.getWithoutCommentsEditorOptions(this.editor, extraEditorClassName, lineDecorationsWidth);
      this.updateEditorLayoutOptions(this.editor, newOptions.extraEditorClassName, newOptions.lineDecorationsWidth);
    }
  }
  async setComments(commentInfos) {
    if (!this.editor || !this.commentService.isCommentingEnabled) {
      return;
    }
    this._commentInfos = commentInfos;
    this.tryUpdateReservedSpace();
    this.removeCommentWidgetsAndStoreCache();
    let hasCommentingRanges = false;
    for (const info of this._commentInfos) {
      if (!hasCommentingRanges && (info.commentingRanges.ranges.length > 0 || info.commentingRanges.fileComments)) {
        hasCommentingRanges = true;
      }
      const providerCacheStore = this._pendingNewCommentCache[info.uniqueOwner];
      const providerEditsCacheStore = this._pendingEditsCache[info.uniqueOwner];
      info.threads = info.threads.filter((thread) => !thread.isDisposed);
      for (const thread of info.threads) {
        let pendingComment = void 0;
        if (providerCacheStore) {
          pendingComment = providerCacheStore[thread.threadId];
        }
        let pendingEdits = void 0;
        if (providerEditsCacheStore) {
          pendingEdits = providerEditsCacheStore[thread.threadId];
        }
        await this.displayCommentThread(info.uniqueOwner, thread, false, pendingComment, pendingEdits);
      }
      for (const thread of info.pendingCommentThreads ?? []) {
        this.resumePendingComment(this.editor.getModel().uri, thread);
      }
    }
    this._commentingRangeDecorator.update(this.editor, this._commentInfos);
    this._commentThreadRangeDecorator.update(this.editor, this._commentInfos);
    if (hasCommentingRanges) {
      this._activeEditorHasCommentingRange.set(true);
    } else {
      this._activeEditorHasCommentingRange.set(false);
    }
  }
  collapseAndFocusRange(threadId) {
    this._commentWidgets?.find((widget) => widget.commentThread.threadId === threadId)?.collapseAndFocusRange();
  }
  removeCommentWidgetsAndStoreCache() {
    if (this._commentWidgets) {
      this._commentWidgets.forEach((zone) => {
        const pendingComments = zone.getPendingComments();
        const pendingNewComment = pendingComments.newComment;
        const providerNewCommentCacheStore = this._pendingNewCommentCache[zone.uniqueOwner];
        let lastCommentBody;
        if (zone.commentThread.comments && zone.commentThread.comments.length) {
          const lastComment = zone.commentThread.comments[zone.commentThread.comments.length - 1];
          if (typeof lastComment.body === "string") {
            lastCommentBody = lastComment.body;
          } else {
            lastCommentBody = lastComment.body.value;
          }
        }
        if (pendingNewComment && pendingNewComment.body !== lastCommentBody) {
          if (!providerNewCommentCacheStore) {
            this._pendingNewCommentCache[zone.uniqueOwner] = {};
          }
          this._pendingNewCommentCache[zone.uniqueOwner][zone.commentThread.threadId] = pendingNewComment;
        } else {
          if (providerNewCommentCacheStore) {
            delete providerNewCommentCacheStore[zone.commentThread.threadId];
          }
        }
        const pendingEdits = pendingComments.edits;
        const providerEditsCacheStore = this._pendingEditsCache[zone.uniqueOwner];
        if (Object.keys(pendingEdits).length > 0) {
          if (!providerEditsCacheStore) {
            this._pendingEditsCache[zone.uniqueOwner] = {};
          }
          this._pendingEditsCache[zone.uniqueOwner][zone.commentThread.threadId] = pendingEdits;
        } else if (providerEditsCacheStore) {
          delete providerEditsCacheStore[zone.commentThread.threadId];
        }
        zone.dispose();
      });
    }
    this._commentWidgets = [];
  }
};
CommentController = __decorateClass([
  __decorateParam(1, ICommentService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, IViewsService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IAccessibilityService),
  __decorateParam(12, INotificationService)
], CommentController);
export {
  CommentController,
  ID,
  moveToNextCommentInThread,
  revealCommentThread
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRzQ29udHJvbGxlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgZmluZEZpcnN0SWR4TW9ub3Rvbm91c09yQXJyTGVuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzRmluZC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxhYmxlUHJvbWlzZSwgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UsIERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAnLi9tZWRpYS9yZXZpZXcuY3NzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJRWRpdG9yTW91c2VFdmVudCwgaXNDb2RlRWRpdG9yLCBpc0RpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yVHlwZSwgSURpZmZFZGl0b3IsIElFZGl0b3IsIElFZGl0b3JDb250cmlidXRpb24sIElNb2RlbENoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElNb2RlbERlY29yYXRpb25PcHRpb25zLCBJTW9kZWxEZWx0YURlY29yYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMsIFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlcyBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IENvbW1lbnRHbHlwaFdpZGdldCB9IGZyb20gJy4vY29tbWVudEdseXBoV2lkZ2V0LmpzJztcbmltcG9ydCB7IElDb21tZW50SW5mbywgSUNvbW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi9jb21tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb21tZW50V2lkZ2V0Rm9jdXMsIGlzTW91c2VVcEV2ZW50RHJhZ0Zyb21Nb3VzZURvd24sIHBhcnNlTW91c2VEb3duSW5mb0Zyb21FdmVudCwgUmV2aWV3Wm9uZVdpZGdldCB9IGZyb20gJy4vY29tbWVudFRocmVhZFpvbmVXaWRnZXQuanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBJRWRpdG9yU2VydmljZSwgU0lERV9HUk9VUCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9lbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDT01NRU5UU19WSUVXX0lEIH0gZnJvbSAnLi9jb21tZW50c1RyZWVWaWV3ZXIuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDT01NRU5UU19TRUNUSU9OLCBJQ29tbWVudHNDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvbW1lbnRzQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDT01NRU5URURJVE9SX0RFQ09SQVRJT05fS0VZIH0gZnJvbSAnLi9jb21tZW50UmVwbHkuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IENvbW1lbnRUaHJlYWRSYW5nZURlY29yYXRvciB9IGZyb20gJy4vY29tbWVudFRocmVhZFJhbmdlRGVjb3JhdG9yLmpzJztcbmltcG9ydCB7IElDdXJzb3JTZWxlY3Rpb25DaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBDb21tZW50c1BhbmVsIH0gZnJvbSAnLi9jb21tZW50c1ZpZXcuanMnO1xuaW1wb3J0IHsgc3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBDb21tZW50Q29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vY29tbWVudENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUNvbW1hbmRJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHlDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgdGhyZWFkSGFzTWVhbmluZ2Z1bENvbW1lbnRzIH0gZnJvbSAnLi9jb21tZW50c01vZGVsLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuXG5leHBvcnQgY29uc3QgSUQgPSAnZWRpdG9yLmNvbnRyaWIucmV2aWV3JztcblxuaW50ZXJmYWNlIENvbW1lbnRSYW5nZUFjdGlvbiB7XG5cdG93bmVySWQ6IHN0cmluZztcblx0ZXh0ZW5zaW9uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Y29tbWVudGluZ1Jhbmdlc0luZm86IGxhbmd1YWdlcy5Db21tZW50aW5nUmFuZ2VzO1xufVxuXG5pbnRlcmZhY2UgTWVyZ2VkQ29tbWVudFJhbmdlQWN0aW9ucyB7XG5cdHJhbmdlPzogUmFuZ2U7XG5cdGFjdGlvbjogQ29tbWVudFJhbmdlQWN0aW9uO1xufVxuXG5jbGFzcyBDb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uIGltcGxlbWVudHMgSU1vZGVsRGVsdGFEZWNvcmF0aW9uIHtcblx0cHJpdmF0ZSBfZGVjb3JhdGlvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3N0YXJ0TGluZU51bWJlcjogbnVtYmVyO1xuXHRwcml2YXRlIF9lbmRMaW5lTnVtYmVyOiBudW1iZXI7XG5cblx0cHVibGljIGdldCBpZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9kZWNvcmF0aW9uSWQ7XG5cdH1cblxuXHRwdWJsaWMgc2V0IGlkKGlkOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9kZWNvcmF0aW9uSWQgPSBpZDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgcmFuZ2UoKTogSVJhbmdlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiB0aGlzLl9zdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0ZW5kTGluZU51bWJlcjogdGhpcy5fZW5kTGluZU51bWJlciwgZW5kQ29sdW1uOiAxXG5cdFx0fTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgX2VkaXRvcjogSUNvZGVFZGl0b3IsIHByaXZhdGUgX293bmVySWQ6IHN0cmluZywgcHJpdmF0ZSBfZXh0ZW5zaW9uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgcHJpdmF0ZSBfbGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCwgcHJpdmF0ZSBfcmFuZ2U6IElSYW5nZSwgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMsIHByaXZhdGUgY29tbWVudGluZ1Jhbmdlc0luZm86IGxhbmd1YWdlcy5Db21tZW50aW5nUmFuZ2VzLCBwdWJsaWMgcmVhZG9ubHkgaXNIb3ZlcjogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdFx0dGhpcy5fc3RhcnRMaW5lTnVtYmVyID0gX3JhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHR0aGlzLl9lbmRMaW5lTnVtYmVyID0gX3JhbmdlLmVuZExpbmVOdW1iZXI7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29tbWVudEFjdGlvbigpOiBDb21tZW50UmFuZ2VBY3Rpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRleHRlbnNpb25JZDogdGhpcy5fZXh0ZW5zaW9uSWQsXG5cdFx0XHRsYWJlbDogdGhpcy5fbGFiZWwsXG5cdFx0XHRvd25lcklkOiB0aGlzLl9vd25lcklkLFxuXHRcdFx0Y29tbWVudGluZ1Jhbmdlc0luZm86IHRoaXMuY29tbWVudGluZ1Jhbmdlc0luZm9cblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGdldE9yaWdpbmFsUmFuZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3JhbmdlO1xuXHR9XG5cblx0cHVibGljIGdldEFjdGl2ZVJhbmdlKCkge1xuXHRcdHJldHVybiB0aGlzLmlkID8gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhLmdldERlY29yYXRpb25SYW5nZSh0aGlzLmlkKSA6IHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBDb21tZW50aW5nUmFuZ2VEZWNvcmF0b3Ige1xuXHRwdWJsaWMgc3RhdGljIGRlc2NyaXB0aW9uID0gJ2NvbW1lbnRpbmctcmFuZ2UtZGVjb3JhdG9yJztcblx0cHJpdmF0ZSBkZWNvcmF0aW9uT3B0aW9uczogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucztcblx0cHJpdmF0ZSBob3ZlckRlY29yYXRpb25PcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXHRwcml2YXRlIG11bHRpbGluZURlY29yYXRpb25PcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXHRwcml2YXRlIGNvbW1lbnRpbmdSYW5nZURlY29yYXRpb25zOiBDb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uW10gPSBbXTtcblx0cHJpdmF0ZSBkZWNvcmF0aW9uSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRwcml2YXRlIF9lZGl0b3I6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pbmZvczogSUNvbW1lbnRJbmZvW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhc3RIb3ZlcjogbnVtYmVyID0gLTE7XG5cdHByaXZhdGUgX2xhc3RTZWxlY3Rpb246IFJhbmdlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9sYXN0U2VsZWN0aW9uQ3Vyc29yOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnNDb3VudDogRW1pdHRlcjxudW1iZXI+ID0gbmV3IEVtaXR0ZXIoKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGVjb3JhdGlvbnNDb3VudCA9IHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnNDb3VudC5ldmVudDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWNvcmF0aW9uT3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRkZXNjcmlwdGlvbjogQ29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLmRlc2NyaXB0aW9uLFxuXHRcdFx0aXNXaG9sZUxpbmU6IHRydWUsXG5cdFx0XHRsaW5lc0RlY29yYXRpb25zQ2xhc3NOYW1lOiAnY29tbWVudC1yYW5nZS1nbHlwaCBjb21tZW50LWRpZmYtYWRkZWQnXG5cdFx0fTtcblxuXHRcdHRoaXMuZGVjb3JhdGlvbk9wdGlvbnMgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLmNyZWF0ZUR5bmFtaWMoZGVjb3JhdGlvbk9wdGlvbnMpO1xuXG5cdFx0Y29uc3QgaG92ZXJEZWNvcmF0aW9uT3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRkZXNjcmlwdGlvbjogQ29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLmRlc2NyaXB0aW9uLFxuXHRcdFx0aXNXaG9sZUxpbmU6IHRydWUsXG5cdFx0XHRsaW5lc0RlY29yYXRpb25zQ2xhc3NOYW1lOiBgY29tbWVudC1yYW5nZS1nbHlwaCBsaW5lLWhvdmVyYFxuXHRcdH07XG5cblx0XHR0aGlzLmhvdmVyRGVjb3JhdGlvbk9wdGlvbnMgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLmNyZWF0ZUR5bmFtaWMoaG92ZXJEZWNvcmF0aW9uT3B0aW9ucyk7XG5cblx0XHRjb25zdCBtdWx0aWxpbmVEZWNvcmF0aW9uT3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRkZXNjcmlwdGlvbjogQ29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLmRlc2NyaXB0aW9uLFxuXHRcdFx0aXNXaG9sZUxpbmU6IHRydWUsXG5cdFx0XHRsaW5lc0RlY29yYXRpb25zQ2xhc3NOYW1lOiBgY29tbWVudC1yYW5nZS1nbHlwaCBtdWx0aWxpbmUtYWRkYFxuXHRcdH07XG5cblx0XHR0aGlzLm11bHRpbGluZURlY29yYXRpb25PcHRpb25zID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5jcmVhdGVEeW5hbWljKG11bHRpbGluZURlY29yYXRpb25PcHRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVIb3Zlcihob3ZlckxpbmU/OiBudW1iZXIpIHtcblx0XHRpZiAodGhpcy5fZWRpdG9yICYmIHRoaXMuX2luZm9zICYmIChob3ZlckxpbmUgIT09IHRoaXMuX2xhc3RIb3ZlcikpIHtcblx0XHRcdHRoaXMuX2RvVXBkYXRlKHRoaXMuX2VkaXRvciwgdGhpcy5faW5mb3MsIGhvdmVyTGluZSk7XG5cdFx0fVxuXHRcdHRoaXMuX2xhc3RIb3ZlciA9IGhvdmVyTGluZSA/PyAtMTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVTZWxlY3Rpb24oY3Vyc29yTGluZTogbnVtYmVyLCByYW5nZTogUmFuZ2UgPSBuZXcgUmFuZ2UoMCwgMCwgMCwgMCkpIHtcblx0XHR0aGlzLl9sYXN0U2VsZWN0aW9uID0gcmFuZ2UuaXNFbXB0eSgpID8gdW5kZWZpbmVkIDogcmFuZ2U7XG5cdFx0dGhpcy5fbGFzdFNlbGVjdGlvbkN1cnNvciA9IHJhbmdlLmlzRW1wdHkoKSA/IHVuZGVmaW5lZCA6IGN1cnNvckxpbmU7XG5cdFx0Ly8gU29tZSBzY2VuYXJpb3M6XG5cdFx0Ly8gU2VsZWN0aW9uIGlzIG1hZGUuIEVtcGhhc2lzIHNob3VsZCBzaG93IG9uIHRoZSBkcmFnL3NlbGVjdGlvbiBlbmQgbG9jYXRpb24uXG5cdFx0Ly8gU2VsZWN0aW9uIGlzIG1hZGUsIHRoZW4gdXNlciBjbGlja3MgZWxzZXdoZXJlLiBXZSBzaG91bGQgc3RpbGwgc2hvdyB0aGUgZGVjb3JhdGlvbi5cblx0XHRpZiAodGhpcy5fZWRpdG9yICYmIHRoaXMuX2luZm9zKSB7XG5cdFx0XHR0aGlzLl9kb1VwZGF0ZSh0aGlzLl9lZGl0b3IsIHRoaXMuX2luZm9zLCBjdXJzb3JMaW5lLCByYW5nZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHVwZGF0ZShlZGl0b3I6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkLCBjb21tZW50SW5mb3M6IElDb21tZW50SW5mb1tdLCBjdXJzb3JMaW5lPzogbnVtYmVyLCByYW5nZT86IFJhbmdlKSB7XG5cdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0dGhpcy5fZWRpdG9yID0gZWRpdG9yO1xuXHRcdFx0dGhpcy5faW5mb3MgPSBjb21tZW50SW5mb3M7XG5cdFx0XHR0aGlzLl9kb1VwZGF0ZShlZGl0b3IsIGNvbW1lbnRJbmZvcywgY3Vyc29yTGluZSwgcmFuZ2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2xpbmVIYXNUaHJlYWQoZWRpdG9yOiBJQ29kZUVkaXRvciwgbGluZVJhbmdlOiBSYW5nZSkge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0RGVjb3JhdGlvbnNJblJhbmdlKGxpbmVSYW5nZSk/LmZpbmQoZGVjb3JhdGlvbiA9PiBkZWNvcmF0aW9uLm9wdGlvbnMuZGVzY3JpcHRpb24gPT09IENvbW1lbnRHbHlwaFdpZGdldC5kZXNjcmlwdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIF9kb1VwZGF0ZShlZGl0b3I6IElDb2RlRWRpdG9yLCBjb21tZW50SW5mb3M6IElDb21tZW50SW5mb1tdLCBlbXBoYXNpc0xpbmU6IG51bWJlciA9IC0xLCBzZWxlY3Rpb25SYW5nZTogUmFuZ2UgfCB1bmRlZmluZWQgPSB0aGlzLl9sYXN0U2VsZWN0aW9uKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlcmUncyBzdGlsbCBhIHNlbGVjdGlvbiwgdXNlIHRoYXQuXG5cdFx0ZW1waGFzaXNMaW5lID0gdGhpcy5fbGFzdFNlbGVjdGlvbkN1cnNvciA/PyBlbXBoYXNpc0xpbmU7XG5cblx0XHRjb25zdCBjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uczogQ29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBpbmZvIG9mIGNvbW1lbnRJbmZvcykge1xuXHRcdFx0aW5mby5jb21tZW50aW5nUmFuZ2VzLnJhbmdlcy5mb3JFYWNoKHJhbmdlID0+IHtcblx0XHRcdFx0Y29uc3QgcmFuZ2VPYmplY3QgPSBuZXcgUmFuZ2UocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbiwgcmFuZ2UuZW5kTGluZU51bWJlciwgcmFuZ2UuZW5kQ29sdW1uKTtcblx0XHRcdFx0bGV0IGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlID0gc2VsZWN0aW9uUmFuZ2UgPyByYW5nZU9iamVjdC5pbnRlcnNlY3RSYW5nZXMoc2VsZWN0aW9uUmFuZ2UpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoKHNlbGVjdGlvblJhbmdlICYmIChlbXBoYXNpc0xpbmUgPj0gMCkgJiYgaW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2UpXG5cdFx0XHRcdFx0Ly8gSWYgdGhlcmUncyBvbmx5IG9uZSBzZWxlY3Rpb24gbGluZSwgdGhlbiBqdXN0IGRyb3AgaW50byB0aGUgZWxzZSBpZiBhbmQgc2hvdyBhbiBlbXBoYXNpcyBsaW5lLlxuXHRcdFx0XHRcdCYmICEoKGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gaW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2UuZW5kTGluZU51bWJlcilcblx0XHRcdFx0XHRcdCYmIChlbXBoYXNpc0xpbmUgPT09IGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlLnN0YXJ0TGluZU51bWJlcikpKSB7XG5cdFx0XHRcdFx0Ly8gVGhlIGVtcGhhc2lzTGluZSBzaG91bGQgYmUgd2l0aGluIHRoZSBjb21tZW50aW5nIHJhbmdlLCBldmVuIGlmIHRoZSBzZWxlY3Rpb24gcmFuZ2Ugc3RyZXRjaGVzXG5cdFx0XHRcdFx0Ly8gb3V0c2lkZSBvZiB0aGUgY29tbWVudGluZyByYW5nZS5cblx0XHRcdFx0XHQvLyBDbGlwIHRoZSBlbXBoYXNpcyBhbmQgc2VsZWN0aW9uIHJhbmdlcyB0byB0aGUgY29tbWVudGluZyByYW5nZVxuXHRcdFx0XHRcdGxldCBpbnRlcnNlY3RpbmdFbXBoYXNpc1JhbmdlOiBSYW5nZTtcblx0XHRcdFx0XHRpZiAoZW1waGFzaXNMaW5lIDw9IGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0aW50ZXJzZWN0aW5nRW1waGFzaXNSYW5nZSA9IGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlLmNvbGxhcHNlVG9TdGFydCgpO1xuXHRcdFx0XHRcdFx0aW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2UgPSBuZXcgUmFuZ2UoaW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgMSwgMSwgaW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2UuZW5kTGluZU51bWJlciwgMSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGludGVyc2VjdGluZ0VtcGhhc2lzUmFuZ2UgPSBuZXcgUmFuZ2UoaW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2UuZW5kTGluZU51bWJlciwgMSwgaW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2UuZW5kTGluZU51bWJlciwgMSk7XG5cdFx0XHRcdFx0XHRpbnRlcnNlY3RpbmdTZWxlY3Rpb25SYW5nZSA9IG5ldyBSYW5nZShpbnRlcnNlY3RpbmdTZWxlY3Rpb25SYW5nZS5zdGFydExpbmVOdW1iZXIsIDEsIGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlLmVuZExpbmVOdW1iZXIgLSAxLCAxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnMucHVzaChuZXcgQ29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbihlZGl0b3IsIGluZm8udW5pcXVlT3duZXIsIGluZm8uZXh0ZW5zaW9uSWQsIGluZm8ubGFiZWwsIGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlLCB0aGlzLm11bHRpbGluZURlY29yYXRpb25PcHRpb25zLCBpbmZvLmNvbW1lbnRpbmdSYW5nZXMsIHRydWUpKTtcblxuXHRcdFx0XHRcdGlmICghdGhpcy5fbGluZUhhc1RocmVhZChlZGl0b3IsIGludGVyc2VjdGluZ0VtcGhhc2lzUmFuZ2UpKSB7XG5cdFx0XHRcdFx0XHRjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucy5wdXNoKG5ldyBDb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uKGVkaXRvciwgaW5mby51bmlxdWVPd25lciwgaW5mby5leHRlbnNpb25JZCwgaW5mby5sYWJlbCwgaW50ZXJzZWN0aW5nRW1waGFzaXNSYW5nZSwgdGhpcy5ob3ZlckRlY29yYXRpb25PcHRpb25zLCBpbmZvLmNvbW1lbnRpbmdSYW5nZXMsIHRydWUpKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBiZWZvcmVSYW5nZUVuZExpbmUgPSBNYXRoLm1pbihpbnRlcnNlY3RpbmdFbXBoYXNpc1JhbmdlLnN0YXJ0TGluZU51bWJlciwgaW50ZXJzZWN0aW5nU2VsZWN0aW9uUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSAtIDE7XG5cdFx0XHRcdFx0Y29uc3QgaGFzQmVmb3JlUmFuZ2UgPSByYW5nZU9iamVjdC5zdGFydExpbmVOdW1iZXIgPD0gYmVmb3JlUmFuZ2VFbmRMaW5lO1xuXHRcdFx0XHRcdGNvbnN0IGFmdGVyUmFuZ2VTdGFydExpbmUgPSBNYXRoLm1heChpbnRlcnNlY3RpbmdFbXBoYXNpc1JhbmdlLmVuZExpbmVOdW1iZXIsIGludGVyc2VjdGluZ1NlbGVjdGlvblJhbmdlLmVuZExpbmVOdW1iZXIpICsgMTtcblx0XHRcdFx0XHRjb25zdCBoYXNBZnRlclJhbmdlID0gcmFuZ2VPYmplY3QuZW5kTGluZU51bWJlciA+PSBhZnRlclJhbmdlU3RhcnRMaW5lO1xuXHRcdFx0XHRcdGlmIChoYXNCZWZvcmVSYW5nZSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgYmVmb3JlUmFuZ2UgPSBuZXcgUmFuZ2UocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxLCBiZWZvcmVSYW5nZUVuZExpbmUsIDEpO1xuXHRcdFx0XHRcdFx0Y29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnMucHVzaChuZXcgQ29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbihlZGl0b3IsIGluZm8udW5pcXVlT3duZXIsIGluZm8uZXh0ZW5zaW9uSWQsIGluZm8ubGFiZWwsIGJlZm9yZVJhbmdlLCB0aGlzLmRlY29yYXRpb25PcHRpb25zLCBpbmZvLmNvbW1lbnRpbmdSYW5nZXMsIHRydWUpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGhhc0FmdGVyUmFuZ2UpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGFmdGVyUmFuZ2UgPSBuZXcgUmFuZ2UoYWZ0ZXJSYW5nZVN0YXJ0TGluZSwgMSwgcmFuZ2UuZW5kTGluZU51bWJlciwgMSk7XG5cdFx0XHRcdFx0XHRjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucy5wdXNoKG5ldyBDb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uKGVkaXRvciwgaW5mby51bmlxdWVPd25lciwgaW5mby5leHRlbnNpb25JZCwgaW5mby5sYWJlbCwgYWZ0ZXJSYW5nZSwgdGhpcy5kZWNvcmF0aW9uT3B0aW9ucywgaW5mby5jb21tZW50aW5nUmFuZ2VzLCB0cnVlKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKChyYW5nZU9iamVjdC5zdGFydExpbmVOdW1iZXIgPD0gZW1waGFzaXNMaW5lKSAmJiAoZW1waGFzaXNMaW5lIDw9IHJhbmdlT2JqZWN0LmVuZExpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdFx0aWYgKHJhbmdlT2JqZWN0LnN0YXJ0TGluZU51bWJlciA8IGVtcGhhc2lzTGluZSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgYmVmb3JlUmFuZ2UgPSBuZXcgUmFuZ2UocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxLCBlbXBoYXNpc0xpbmUgLSAxLCAxKTtcblx0XHRcdFx0XHRcdGNvbW1lbnRpbmdSYW5nZURlY29yYXRpb25zLnB1c2gobmV3IENvbW1lbnRpbmdSYW5nZURlY29yYXRpb24oZWRpdG9yLCBpbmZvLnVuaXF1ZU93bmVyLCBpbmZvLmV4dGVuc2lvbklkLCBpbmZvLmxhYmVsLCBiZWZvcmVSYW5nZSwgdGhpcy5kZWNvcmF0aW9uT3B0aW9ucywgaW5mby5jb21tZW50aW5nUmFuZ2VzLCB0cnVlKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGVtcGhhc2lzUmFuZ2UgPSBuZXcgUmFuZ2UoZW1waGFzaXNMaW5lLCAxLCBlbXBoYXNpc0xpbmUsIDEpO1xuXHRcdFx0XHRcdGlmICghdGhpcy5fbGluZUhhc1RocmVhZChlZGl0b3IsIGVtcGhhc2lzUmFuZ2UpKSB7XG5cdFx0XHRcdFx0XHRjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucy5wdXNoKG5ldyBDb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uKGVkaXRvciwgaW5mby51bmlxdWVPd25lciwgaW5mby5leHRlbnNpb25JZCwgaW5mby5sYWJlbCwgZW1waGFzaXNSYW5nZSwgdGhpcy5ob3ZlckRlY29yYXRpb25PcHRpb25zLCBpbmZvLmNvbW1lbnRpbmdSYW5nZXMsIHRydWUpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGVtcGhhc2lzTGluZSA8IHJhbmdlT2JqZWN0LmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGFmdGVyUmFuZ2UgPSBuZXcgUmFuZ2UoZW1waGFzaXNMaW5lICsgMSwgMSwgcmFuZ2UuZW5kTGluZU51bWJlciwgMSk7XG5cdFx0XHRcdFx0XHRjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucy5wdXNoKG5ldyBDb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uKGVkaXRvciwgaW5mby51bmlxdWVPd25lciwgaW5mby5leHRlbnNpb25JZCwgaW5mby5sYWJlbCwgYWZ0ZXJSYW5nZSwgdGhpcy5kZWNvcmF0aW9uT3B0aW9ucywgaW5mby5jb21tZW50aW5nUmFuZ2VzLCB0cnVlKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbW1lbnRpbmdSYW5nZURlY29yYXRpb25zLnB1c2gobmV3IENvbW1lbnRpbmdSYW5nZURlY29yYXRpb24oZWRpdG9yLCBpbmZvLnVuaXF1ZU93bmVyLCBpbmZvLmV4dGVuc2lvbklkLCBpbmZvLmxhYmVsLCByYW5nZSwgdGhpcy5kZWNvcmF0aW9uT3B0aW9ucywgaW5mby5jb21tZW50aW5nUmFuZ2VzKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGVkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucygoYWNjZXNzb3IpID0+IHtcblx0XHRcdHRoaXMuZGVjb3JhdGlvbklkcyA9IGFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnModGhpcy5kZWNvcmF0aW9uSWRzLCBjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucyk7XG5cdFx0XHRjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucy5mb3JFYWNoKChkZWNvcmF0aW9uLCBpbmRleCkgPT4gZGVjb3JhdGlvbi5pZCA9IHRoaXMuZGVjb3JhdGlvbklkc1tpbmRleF0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmFuZ2VzRGlmZmVyZW5jZSA9IHRoaXMuY29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnMubGVuZ3RoIC0gY29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnMubGVuZ3RoO1xuXHRcdHRoaXMuY29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnMgPSBjb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucztcblx0XHRpZiAocmFuZ2VzRGlmZmVyZW5jZSkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9uc0NvdW50LmZpcmUodGhpcy5jb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucy5sZW5ndGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXJlUmFuZ2VzSW50ZXJzZWN0aW5nT3JUb3VjaGluZ0J5TGluZShhOiBSYW5nZSwgYjogUmFuZ2UpIHtcblx0XHQvLyBDaGVjayBpZiBgYWAgaXMgYmVmb3JlIGBiYFxuXHRcdGlmIChhLmVuZExpbmVOdW1iZXIgPCAoYi5zdGFydExpbmVOdW1iZXIgLSAxKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGlmIGBiYCBpcyBiZWZvcmUgYGFgXG5cdFx0aWYgKChiLmVuZExpbmVOdW1iZXIgKyAxKSA8IGEuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gVGhlc2UgcmFuZ2VzIG11c3QgaW50ZXJzZWN0XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TWF0Y2hlZENvbW1lbnRBY3Rpb24oY29tbWVudFJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZCk6IE1lcmdlZENvbW1lbnRSYW5nZUFjdGlvbnNbXSB7XG5cdFx0aWYgKGNvbW1lbnRSYW5nZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBmb3VuZEluZm9zID0gdGhpcy5faW5mb3M/LmZpbHRlcihpbmZvID0+IGluZm8uY29tbWVudGluZ1Jhbmdlcy5maWxlQ29tbWVudHMpO1xuXHRcdFx0aWYgKGZvdW5kSW5mb3MpIHtcblx0XHRcdFx0cmV0dXJuIGZvdW5kSW5mb3MubWFwKGZvdW5kSW5mbyA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRvd25lcklkOiBmb3VuZEluZm8udW5pcXVlT3duZXIsXG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbklkOiBmb3VuZEluZm8uZXh0ZW5zaW9uSWQsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBmb3VuZEluZm8ubGFiZWwsXG5cdFx0XHRcdFx0XHRcdGNvbW1lbnRpbmdSYW5nZXNJbmZvOiBmb3VuZEluZm8uY29tbWVudGluZ1Jhbmdlc1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIGtleXMgaXMgb3duZXJJZFxuXHRcdGNvbnN0IGZvdW5kSG92ZXJBY3Rpb25zID0gbmV3IE1hcDxzdHJpbmcsIHsgcmFuZ2U6IFJhbmdlOyBhY3Rpb246IENvbW1lbnRSYW5nZUFjdGlvbiB9PigpO1xuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiB0aGlzLmNvbW1lbnRpbmdSYW5nZURlY29yYXRpb25zKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IGRlY29yYXRpb24uZ2V0QWN0aXZlUmFuZ2UoKTtcblx0XHRcdGlmIChyYW5nZSAmJiB0aGlzLmFyZVJhbmdlc0ludGVyc2VjdGluZ09yVG91Y2hpbmdCeUxpbmUocmFuZ2UsIGNvbW1lbnRSYW5nZSkpIHtcblx0XHRcdFx0Ly8gV2UgY2FuIGhhdmUgc2V2ZXJhbCBjb21tZW50aW5nIHJhbmdlcyB0aGF0IG1hdGNoIGZyb20gdGhlIHNhbWUgdW5pcXVlT3duZXIgYmVjYXVzZSBvZiBob3dcblx0XHRcdFx0Ly8gdGhlIGxpbmUgaG92ZXIgYW5kIHNlbGVjdGlvbiBkZWNvcmF0aW9uIGlzIGRvbmUuXG5cdFx0XHRcdC8vIFRoZSByYW5nZXMgbXVzdCBiZSBtZXJnZWQgc28gdGhhdCB3ZSBjYW4gc2VlIGlmIHRoZSBuZXcgY29tbWVudFJhbmdlIGZpdHMgd2l0aGluIHRoZW0uXG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9IGRlY29yYXRpb24uZ2V0Q29tbWVudEFjdGlvbigpO1xuXHRcdFx0XHRjb25zdCBhbHJlYWR5Rm91bmRJbmZvID0gZm91bmRIb3ZlckFjdGlvbnMuZ2V0KGFjdGlvbi5vd25lcklkKTtcblx0XHRcdFx0aWYgKGFscmVhZHlGb3VuZEluZm8/LmFjdGlvbi5jb21tZW50aW5nUmFuZ2VzSW5mbyA9PT0gYWN0aW9uLmNvbW1lbnRpbmdSYW5nZXNJbmZvKSB7XG5cdFx0XHRcdFx0Ly8gTWVyZ2UgcmFuZ2VzLlxuXHRcdFx0XHRcdGNvbnN0IG5ld1JhbmdlID0gbmV3IFJhbmdlKFxuXHRcdFx0XHRcdFx0cmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIDwgYWxyZWFkeUZvdW5kSW5mby5yYW5nZS5zdGFydExpbmVOdW1iZXIgPyByYW5nZS5zdGFydExpbmVOdW1iZXIgOiBhbHJlYWR5Rm91bmRJbmZvLnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdHJhbmdlLnN0YXJ0Q29sdW1uIDwgYWxyZWFkeUZvdW5kSW5mby5yYW5nZS5zdGFydENvbHVtbiA/IHJhbmdlLnN0YXJ0Q29sdW1uIDogYWxyZWFkeUZvdW5kSW5mby5yYW5nZS5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdHJhbmdlLmVuZExpbmVOdW1iZXIgPiBhbHJlYWR5Rm91bmRJbmZvLnJhbmdlLmVuZExpbmVOdW1iZXIgPyByYW5nZS5lbmRMaW5lTnVtYmVyIDogYWxyZWFkeUZvdW5kSW5mby5yYW5nZS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0cmFuZ2UuZW5kQ29sdW1uID4gYWxyZWFkeUZvdW5kSW5mby5yYW5nZS5lbmRDb2x1bW4gPyByYW5nZS5lbmRDb2x1bW4gOiBhbHJlYWR5Rm91bmRJbmZvLnJhbmdlLmVuZENvbHVtblxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0Zm91bmRIb3ZlckFjdGlvbnMuc2V0KGFjdGlvbi5vd25lcklkLCB7IHJhbmdlOiBuZXdSYW5nZSwgYWN0aW9uIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZvdW5kSG92ZXJBY3Rpb25zLnNldChhY3Rpb24ub3duZXJJZCwgeyByYW5nZSwgYWN0aW9uIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Vlbk93bmVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHJldHVybiBBcnJheS5mcm9tKGZvdW5kSG92ZXJBY3Rpb25zLnZhbHVlcygpKS5maWx0ZXIoYWN0aW9uID0+IHtcblx0XHRcdGlmIChzZWVuT3duZXJzLmhhcyhhY3Rpb24uYWN0aW9uLm93bmVySWQpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNlZW5Pd25lcnMuYWRkKGFjdGlvbi5hY3Rpb24ub3duZXJJZCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldE5lYXJlc3RDb21tZW50aW5nUmFuZ2UoZmluZFBvc2l0aW9uOiBQb3NpdGlvbiwgcmV2ZXJzZT86IGJvb2xlYW4pOiBSYW5nZSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGZpbmRQb3NpdGlvbkNvbnRhaW5lZFdpdGhpbjogUmFuZ2UgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGRlY29yYXRpb25zOiBDb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9uW107XG5cdFx0aWYgKHJldmVyc2UpIHtcblx0XHRcdGRlY29yYXRpb25zID0gW107XG5cdFx0XHRmb3IgKGxldCBpID0gdGhpcy5jb21tZW50aW5nUmFuZ2VEZWNvcmF0aW9ucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0XHRkZWNvcmF0aW9ucy5wdXNoKHRoaXMuY29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnNbaV0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRkZWNvcmF0aW9ucyA9IHRoaXMuY29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnM7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiBkZWNvcmF0aW9ucykge1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSBkZWNvcmF0aW9uLmdldEFjdGl2ZVJhbmdlKCk7XG5cdFx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZmluZFBvc2l0aW9uQ29udGFpbmVkV2l0aGluICYmIHRoaXMuYXJlUmFuZ2VzSW50ZXJzZWN0aW5nT3JUb3VjaGluZ0J5TGluZShyYW5nZSwgZmluZFBvc2l0aW9uQ29udGFpbmVkV2l0aGluKSkge1xuXHRcdFx0XHRmaW5kUG9zaXRpb25Db250YWluZWRXaXRoaW4gPSBSYW5nZS5wbHVzUmFuZ2UoZmluZFBvc2l0aW9uQ29udGFpbmVkV2l0aGluLCByYW5nZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIDw9IGZpbmRQb3NpdGlvbi5saW5lTnVtYmVyICYmIGZpbmRQb3NpdGlvbi5saW5lTnVtYmVyIDw9IHJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0ZmluZFBvc2l0aW9uQ29udGFpbmVkV2l0aGluID0gbmV3IFJhbmdlKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc3RhcnRDb2x1bW4sIHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbik7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXJldmVyc2UgJiYgcmFuZ2UuZW5kTGluZU51bWJlciA8IGZpbmRQb3NpdGlvbi5saW5lTnVtYmVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmV2ZXJzZSAmJiByYW5nZS5zdGFydExpbmVOdW1iZXIgPiBmaW5kUG9zaXRpb24ubGluZU51bWJlcikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJhbmdlO1xuXHRcdH1cblx0XHRyZXR1cm4gKGRlY29yYXRpb25zLmxlbmd0aCA+IDAgPyAoZGVjb3JhdGlvbnNbMF0uZ2V0QWN0aXZlUmFuZ2UoKSA/PyB1bmRlZmluZWQpIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY29tbWVudGluZ1JhbmdlRGVjb3JhdGlvbnMgPSBbXTtcblx0fVxufVxuXG4vKipcbiogTmF2aWdhdGUgdG8gdGhlIG5leHQgb3IgcHJldmlvdXMgY29tbWVudCBpbiB0aGUgY3VycmVudCB0aHJlYWQuXG4qIEBwYXJhbSB0eXBlXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1vdmVUb05leHRDb21tZW50SW5UaHJlYWQoY29tbWVudEluZm86IHsgdGhyZWFkOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZDxJUmFuZ2U+OyBjb21tZW50PzogbGFuZ3VhZ2VzLkNvbW1lbnQgfSB8IHVuZGVmaW5lZCwgdHlwZTogJ25leHQnIHwgJ3ByZXZpb3VzJykge1xuXHRpZiAoIWNvbW1lbnRJbmZvPy5jb21tZW50IHx8ICFjb21tZW50SW5mbz8udGhyZWFkPy5jb21tZW50cykge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCBjdXJyZW50SW5kZXggPSBjb21tZW50SW5mby50aHJlYWQuY29tbWVudHM/LmluZGV4T2YoY29tbWVudEluZm8uY29tbWVudCk7XG5cdGlmIChjdXJyZW50SW5kZXggPT09IHVuZGVmaW5lZCB8fCBjdXJyZW50SW5kZXggPCAwKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGlmICh0eXBlID09PSAncHJldmlvdXMnICYmIGN1cnJlbnRJbmRleCA9PT0gMCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAodHlwZSA9PT0gJ25leHQnICYmIGN1cnJlbnRJbmRleCA9PT0gY29tbWVudEluZm8udGhyZWFkLmNvbW1lbnRzLmxlbmd0aCAtIDEpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgY29tbWVudCA9IGNvbW1lbnRJbmZvLnRocmVhZC5jb21tZW50cz8uW3R5cGUgPT09ICdwcmV2aW91cycgPyBjdXJyZW50SW5kZXggLSAxIDogY3VycmVudEluZGV4ICsgMV07XG5cdGlmICghY29tbWVudCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRyZXR1cm4ge1xuXHRcdC4uLmNvbW1lbnRJbmZvLFxuXHRcdGNvbW1lbnQsXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXZlYWxDb21tZW50VGhyZWFkKGNvbW1lbnRTZXJ2aWNlOiBJQ29tbWVudFNlcnZpY2UsIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdGNvbW1lbnRUaHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkPElSYW5nZT4sIGNvbW1lbnQ6IGxhbmd1YWdlcy5Db21tZW50IHwgdW5kZWZpbmVkLCBmb2N1c1JlcGx5PzogYm9vbGVhbiwgcGlubmVkPzogYm9vbGVhbiwgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4sIHNpZGVCeVNpZGU/OiBib29sZWFuKTogdm9pZCB7XG5cdGlmICghY29tbWVudFRocmVhZC5yZXNvdXJjZSkge1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAoIWNvbW1lbnRTZXJ2aWNlLmlzQ29tbWVudGluZ0VuYWJsZWQpIHtcblx0XHRjb21tZW50U2VydmljZS5lbmFibGVDb21tZW50aW5nKHRydWUpO1xuXHR9XG5cblx0Y29uc3QgcmFuZ2UgPSBjb21tZW50VGhyZWFkLnJhbmdlO1xuXHRjb25zdCBmb2N1cyA9IGZvY3VzUmVwbHkgPyBDb21tZW50V2lkZ2V0Rm9jdXMuRWRpdG9yIDogKHByZXNlcnZlRm9jdXMgPyBDb21tZW50V2lkZ2V0Rm9jdXMuTm9uZSA6IENvbW1lbnRXaWRnZXRGb2N1cy5XaWRnZXQpO1xuXG5cdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdC8vIElmIHRoZSBhY3RpdmUgZWRpdG9yIGlzIGEgZGlmZiBlZGl0b3Igd2hlcmUgb25lIG9mIHRoZSBzaWRlcyBoYXMgdGhlIGNvbW1lbnQsXG5cdC8vIHRoZW4gd2UgdHJ5IHRvIHJldmVhbCB0aGUgY29tbWVudCBpbiB0aGUgZGlmZiBlZGl0b3IuXG5cdGNvbnN0IGN1cnJlbnRBY3RpdmVSZXNvdXJjZXM6IElFZGl0b3JbXSA9IGlzRGlmZkVkaXRvcihhY3RpdmVFZGl0b3IpID8gW2FjdGl2ZUVkaXRvci5nZXRPcmlnaW5hbEVkaXRvcigpLCBhY3RpdmVFZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKV1cblx0XHQ6IChhY3RpdmVFZGl0b3IgPyBbYWN0aXZlRWRpdG9yXSA6IFtdKTtcblx0Y29uc3QgdGhyZWFkVG9SZXZlYWwgPSBjb21tZW50VGhyZWFkLnRocmVhZElkO1xuXHRjb25zdCBjb21tZW50VG9SZXZlYWwgPSBjb21tZW50Py51bmlxdWVJZEluVGhyZWFkO1xuXHRjb25zdCByZXNvdXJjZSA9IFVSSS5wYXJzZShjb21tZW50VGhyZWFkLnJlc291cmNlKTtcblxuXHRmb3IgKGNvbnN0IGVkaXRvciBvZiBjdXJyZW50QWN0aXZlUmVzb3VyY2VzKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoKG1vZGVsIGluc3RhbmNlb2YgVGV4dE1vZGVsKSAmJiB1cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2UsIG1vZGVsLnVyaSkpIHtcblxuXHRcdFx0aWYgKHRocmVhZFRvUmV2ZWFsICYmIGlzQ29kZUVkaXRvcihlZGl0b3IpKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb21tZW50Q29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRcdFx0Y29udHJvbGxlcj8ucmV2ZWFsQ29tbWVudFRocmVhZCh0aHJlYWRUb1JldmVhbCwgY29tbWVudFRvUmV2ZWFsLCB0cnVlLCBmb2N1cyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0ZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRyZXNvdXJjZSxcblx0XHRvcHRpb25zOiB7XG5cdFx0XHRwaW5uZWQ6IHBpbm5lZCxcblx0XHRcdHByZXNlcnZlRm9jdXM6IHByZXNlcnZlRm9jdXMsXG5cdFx0XHRzZWxlY3Rpb246IHJhbmdlID8/IG5ldyBSYW5nZSgxLCAxLCAxLCAxKVxuXHRcdH1cblx0fSwgc2lkZUJ5U2lkZSA/IFNJREVfR1JPVVAgOiBBQ1RJVkVfR1JPVVApLnRoZW4oZWRpdG9yID0+IHtcblx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRjb25zdCBjb250cm9sID0gZWRpdG9yLmdldENvbnRyb2woKTtcblx0XHRcdGlmICh0aHJlYWRUb1JldmVhbCAmJiBpc0NvZGVFZGl0b3IoY29udHJvbCkpIHtcblx0XHRcdFx0Y29uc3QgY29udHJvbGxlciA9IENvbW1lbnRDb250cm9sbGVyLmdldChjb250cm9sKTtcblx0XHRcdFx0Y29udHJvbGxlcj8ucmV2ZWFsQ29tbWVudFRocmVhZCh0aHJlYWRUb1JldmVhbCwgY29tbWVudFRvUmV2ZWFsLCB0cnVlLCBmb2N1cyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbW1lbnRDb250cm9sbGVyIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgZ2xvYmFsVG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxvY2FsVG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIGVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2NvbW1lbnRXaWRnZXRzOiBSZXZpZXdab25lV2lkZ2V0W107XG5cdHByaXZhdGUgX2NvbW1lbnRJbmZvczogSUNvbW1lbnRJbmZvW107XG5cdHByaXZhdGUgX2NvbW1lbnRpbmdSYW5nZURlY29yYXRvciE6IENvbW1lbnRpbmdSYW5nZURlY29yYXRvcjtcblx0cHJpdmF0ZSBfY29tbWVudFRocmVhZFJhbmdlRGVjb3JhdG9yITogQ29tbWVudFRocmVhZFJhbmdlRGVjb3JhdG9yO1xuXHRwcml2YXRlIG1vdXNlRG93bkluZm86IHsgbGluZU51bWJlcjogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfY29tbWVudGluZ1JhbmdlU3BhY2VSZXNlcnZlZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9jb21tZW50aW5nUmFuZ2VBbW91bnRSZXNlcnZlZCA9IDA7XG5cdHByaXZhdGUgX2NvbXB1dGVQcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTxBcnJheTxJQ29tbWVudEluZm8gfCBudWxsPj4gfCBudWxsO1xuXHRwcml2YXRlIF9jb21wdXRlQW5kU2V0UHJvbWlzZTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYWRkSW5Qcm9ncmVzcyE6IGJvb2xlYW47XG5cdHByaXZhdGUgX2VtcHR5VGhyZWFkc1RvQWRkUXVldWU6IFtSYW5nZSB8IHVuZGVmaW5lZCwgSUVkaXRvck1vdXNlRXZlbnQgfCB1bmRlZmluZWRdW10gPSBbXTtcblx0cHJpdmF0ZSBfY29tcHV0ZUNvbW1lbnRpbmdSYW5nZVByb21pc2UhOiBDYW5jZWxhYmxlUHJvbWlzZTxJQ29tbWVudEluZm9bXT4gfCBudWxsO1xuXHRwcml2YXRlIF9jb21wdXRlQ29tbWVudGluZ1JhbmdlU2NoZWR1bGVyITogRGVsYXllcjxBcnJheTxJQ29tbWVudEluZm8gfCBudWxsPj4gfCBudWxsO1xuXHRwcml2YXRlIF9wZW5kaW5nTmV3Q29tbWVudENhY2hlOiB7IFtrZXk6IHN0cmluZ106IHsgW2tleTogc3RyaW5nXTogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IH0gfTtcblx0cHJpdmF0ZSBfcGVuZGluZ0VkaXRzQ2FjaGU6IHsgW2tleTogc3RyaW5nXTogeyBba2V5OiBzdHJpbmddOiB7IFtrZXk6IG51bWJlcl06IGxhbmd1YWdlcy5QZW5kaW5nQ29tbWVudCB9IH0gfTsgLy8gdW5pcXVlT3duZXIgLT4gdGhyZWFkSWQgLT4gdW5pcXVlSWRJblRocmVhZCAtPiBwZW5kaW5nIGNvbW1lbnRcblx0cHJpdmF0ZSBfaW5Qcm9jZXNzQ29udGludWVPbkNvbW1lbnRzOiBNYXA8c3RyaW5nLCBsYW5ndWFnZXMuUGVuZGluZ0NvbW1lbnRUaHJlYWRbXT4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgX2VkaXRvckRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdHByaXZhdGUgX2FjdGl2ZUN1cnNvckhhc0NvbW1lbnRpbmdSYW5nZTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX2FjdGl2ZUN1cnNvckhhc0NvbW1lbnQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9hY3RpdmVFZGl0b3JIYXNDb21tZW50aW5nUmFuZ2U6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9oYXNSZXNwb25kZWRUb0VkaXRvckNoYW5nZTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElDb21tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1lbnRTZXJ2aWNlOiBJQ29tbWVudFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX2NvbW1lbnRJbmZvcyA9IFtdO1xuXHRcdHRoaXMuX2NvbW1lbnRXaWRnZXRzID0gW107XG5cdFx0dGhpcy5fcGVuZGluZ05ld0NvbW1lbnRDYWNoZSA9IHt9O1xuXHRcdHRoaXMuX3BlbmRpbmdFZGl0c0NhY2hlID0ge307XG5cdFx0dGhpcy5fY29tcHV0ZVByb21pc2UgPSBudWxsO1xuXHRcdHRoaXMuX2FjdGl2ZUN1cnNvckhhc0NvbW1lbnRpbmdSYW5nZSA9IENvbW1lbnRDb250ZXh0S2V5cy5hY3RpdmVDdXJzb3JIYXNDb21tZW50aW5nUmFuZ2UuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9hY3RpdmVDdXJzb3JIYXNDb21tZW50ID0gQ29tbWVudENvbnRleHRLZXlzLmFjdGl2ZUN1cnNvckhhc0NvbW1lbnQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9hY3RpdmVFZGl0b3JIYXNDb21tZW50aW5nUmFuZ2UgPSBDb21tZW50Q29udGV4dEtleXMuYWN0aXZlRWRpdG9ySGFzQ29tbWVudGluZ1JhbmdlLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lZGl0b3IgPSBlZGl0b3I7XG5cblx0XHR0aGlzLl9jb21tZW50aW5nUmFuZ2VEZWNvcmF0b3IgPSBuZXcgQ29tbWVudGluZ1JhbmdlRGVjb3JhdG9yKCk7XG5cdFx0dGhpcy5nbG9iYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuX2NvbW1lbnRpbmdSYW5nZURlY29yYXRvci5vbkRpZENoYW5nZURlY29yYXRpb25zQ291bnQoY291bnQgPT4ge1xuXHRcdFx0aWYgKGNvdW50ID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJFZGl0b3JMaXN0ZW5lcnMoKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5fZWRpdG9yRGlzcG9zYWJsZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRoaXMucmVnaXN0ZXJFZGl0b3JMaXN0ZW5lcnMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmdsb2JhbFRvRGlzcG9zZS5hZGQodGhpcy5fY29tbWVudFRocmVhZFJhbmdlRGVjb3JhdG9yID0gbmV3IENvbW1lbnRUaHJlYWRSYW5nZURlY29yYXRvcih0aGlzLmNvbW1lbnRTZXJ2aWNlKSk7XG5cblx0XHR0aGlzLmdsb2JhbFRvRGlzcG9zZS5hZGQodGhpcy5jb21tZW50U2VydmljZS5vbkRpZERlbGV0ZURhdGFQcm92aWRlcihvd25lcklkID0+IHtcblx0XHRcdGlmIChvd25lcklkKSB7XG5cdFx0XHRcdGRlbGV0ZSB0aGlzLl9wZW5kaW5nTmV3Q29tbWVudENhY2hlW293bmVySWRdO1xuXHRcdFx0XHRkZWxldGUgdGhpcy5fcGVuZGluZ0VkaXRzQ2FjaGVbb3duZXJJZF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9wZW5kaW5nTmV3Q29tbWVudENhY2hlID0ge307XG5cdFx0XHRcdHRoaXMuX3BlbmRpbmdFZGl0c0NhY2hlID0ge307XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmJlZ2luQ29tcHV0ZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmdsb2JhbFRvRGlzcG9zZS5hZGQodGhpcy5jb21tZW50U2VydmljZS5vbkRpZFNldERhdGFQcm92aWRlcihfID0+IHRoaXMuYmVnaW5Db21wdXRlQW5kSGFuZGxlRWRpdG9yQ2hhbmdlKCkpKTtcblx0XHR0aGlzLmdsb2JhbFRvRGlzcG9zZS5hZGQodGhpcy5jb21tZW50U2VydmljZS5vbkRpZFVwZGF0ZUNvbW1lbnRpbmdSYW5nZXMoXyA9PiB0aGlzLmJlZ2luQ29tcHV0ZUFuZEhhbmRsZUVkaXRvckNoYW5nZSgpKSk7XG5cblx0XHR0aGlzLmdsb2JhbFRvRGlzcG9zZS5hZGQodGhpcy5jb21tZW50U2VydmljZS5vbkRpZFNldFJlc291cmNlQ29tbWVudEluZm9zKGFzeW5jIGUgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9yVVJJID0gdGhpcy5lZGl0b3IgJiYgdGhpcy5lZGl0b3IuaGFzTW9kZWwoKSAmJiB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLnVyaTtcblx0XHRcdGlmIChlZGl0b3JVUkkgJiYgZWRpdG9yVVJJLnRvU3RyaW5nKCkgPT09IGUucmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnNldENvbW1lbnRzKGUuY29tbWVudEluZm9zLmZpbHRlcihjb21tZW50SW5mbyA9PiBjb21tZW50SW5mbyAhPT0gbnVsbCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuZ2xvYmFsVG9EaXNwb3NlLmFkZCh0aGlzLmNvbW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29tbWVudGluZ0VuYWJsZWQoZSA9PiB7XG5cdFx0XHRpZiAoZSkge1xuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyRWRpdG9yTGlzdGVuZXJzKCk7XG5cdFx0XHRcdHRoaXMuYmVnaW5Db21wdXRlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRyeVVwZGF0ZVJlc2VydmVkU3BhY2UoKTtcblx0XHRcdFx0dGhpcy5jbGVhckVkaXRvckxpc3RlbmVycygpO1xuXHRcdFx0XHR0aGlzLl9jb21tZW50aW5nUmFuZ2VEZWNvcmF0b3IudXBkYXRlKHRoaXMuZWRpdG9yLCBbXSk7XG5cdFx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWRSYW5nZURlY29yYXRvci51cGRhdGUodGhpcy5lZGl0b3IsIFtdKTtcblx0XHRcdFx0ZGlzcG9zZSh0aGlzLl9jb21tZW50V2lkZ2V0cyk7XG5cdFx0XHRcdHRoaXMuX2NvbW1lbnRXaWRnZXRzID0gW107XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5nbG9iYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuZWRpdG9yLm9uV2lsbENoYW5nZU1vZGVsKGUgPT4gdGhpcy5vbldpbGxDaGFuZ2VNb2RlbChlKSkpO1xuXHRcdHRoaXMuZ2xvYmFsVG9EaXNwb3NlLmFkZCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZU1vZGVsKF8gPT4gdGhpcy5vbk1vZGVsQ2hhbmdlZCgpKSk7XG5cdFx0dGhpcy5nbG9iYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2RpZmZFZGl0b3IucmVuZGVyU2lkZUJ5U2lkZScpKSB7XG5cdFx0XHRcdHRoaXMuYmVnaW5Db21wdXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5vbk1vZGVsQ2hhbmdlZCgpO1xuXHRcdHRoaXMuY29kZUVkaXRvclNlcnZpY2UucmVnaXN0ZXJEZWNvcmF0aW9uVHlwZSgnY29tbWVudC1jb250cm9sbGVyJywgQ09NTUVOVEVESVRPUl9ERUNPUkFUSU9OX0tFWSwge30pO1xuXHRcdHRoaXMuZ2xvYmFsVG9EaXNwb3NlLmFkZChcblx0XHRcdHRoaXMuY29tbWVudFNlcnZpY2UucmVnaXN0ZXJDb250aW51ZU9uQ29tbWVudFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZUNvbnRpbnVlT25Db21tZW50czogKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHBlbmRpbmdDb21tZW50czogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50VGhyZWFkW10gPSBbXTtcblx0XHRcdFx0XHRpZiAodGhpcy5fY29tbWVudFdpZGdldHMpIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3Qgem9uZSBvZiB0aGlzLl9jb21tZW50V2lkZ2V0cykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB6b25lUGVuZGluZ0NvbW1lbnRzID0gem9uZS5nZXRQZW5kaW5nQ29tbWVudHMoKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcGVuZGluZ05ld0NvbW1lbnQgPSB6b25lUGVuZGluZ0NvbW1lbnRzLm5ld0NvbW1lbnQ7XG5cdFx0XHRcdFx0XHRcdGlmICghcGVuZGluZ05ld0NvbW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRsZXQgbGFzdENvbW1lbnRCb2R5O1xuXHRcdFx0XHRcdFx0XHRpZiAoem9uZS5jb21tZW50VGhyZWFkLmNvbW1lbnRzICYmIHpvbmUuY29tbWVudFRocmVhZC5jb21tZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBsYXN0Q29tbWVudCA9IHpvbmUuY29tbWVudFRocmVhZC5jb21tZW50c1t6b25lLmNvbW1lbnRUaHJlYWQuY29tbWVudHMubGVuZ3RoIC0gMV07XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBsYXN0Q29tbWVudC5ib2R5ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHRcdFx0bGFzdENvbW1lbnRCb2R5ID0gbGFzdENvbW1lbnQuYm9keTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0bGFzdENvbW1lbnRCb2R5ID0gbGFzdENvbW1lbnQuYm9keS52YWx1ZTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRpZiAocGVuZGluZ05ld0NvbW1lbnQuYm9keSAhPT0gbGFzdENvbW1lbnRCb2R5KSB7XG5cdFx0XHRcdFx0XHRcdFx0cGVuZGluZ0NvbW1lbnRzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdFx0dW5pcXVlT3duZXI6IHpvbmUudW5pcXVlT3duZXIsXG5cdFx0XHRcdFx0XHRcdFx0XHR1cmk6IHpvbmUuZWRpdG9yLmdldE1vZGVsKCkhLnVyaSxcblx0XHRcdFx0XHRcdFx0XHRcdHJhbmdlOiB6b25lLmNvbW1lbnRUaHJlYWQucmFuZ2UsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb21tZW50OiBwZW5kaW5nTmV3Q29tbWVudCxcblx0XHRcdFx0XHRcdFx0XHRcdGlzUmVwbHk6ICh6b25lLmNvbW1lbnRUaHJlYWQuY29tbWVudHMgIT09IHVuZGVmaW5lZCkgJiYgKHpvbmUuY29tbWVudFRocmVhZC5jb21tZW50cy5sZW5ndGggPiAwKVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBwZW5kaW5nQ29tbWVudHM7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckVkaXRvckxpc3RlbmVycygpIHtcblx0XHR0aGlzLl9lZGl0b3JEaXNwb3NhYmxlcyA9IFtdO1xuXHRcdGlmICghdGhpcy5lZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fZWRpdG9yRGlzcG9zYWJsZXMucHVzaCh0aGlzLmVkaXRvci5vbk1vdXNlTW92ZShlID0+IHRoaXMub25FZGl0b3JNb3VzZU1vdmUoZSkpKTtcblx0XHR0aGlzLl9lZGl0b3JEaXNwb3NhYmxlcy5wdXNoKHRoaXMuZWRpdG9yLm9uTW91c2VMZWF2ZSgoKSA9PiB0aGlzLm9uRWRpdG9yTW91c2VMZWF2ZSgpKSk7XG5cdFx0dGhpcy5fZWRpdG9yRGlzcG9zYWJsZXMucHVzaCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKGUgPT4gdGhpcy5vbkVkaXRvckNoYW5nZUN1cnNvclBvc2l0aW9uKGUucG9zaXRpb24pKSk7XG5cdFx0dGhpcy5fZWRpdG9yRGlzcG9zYWJsZXMucHVzaCh0aGlzLmVkaXRvci5vbkRpZEZvY3VzRWRpdG9yV2lkZ2V0KCgpID0+IHRoaXMub25FZGl0b3JDaGFuZ2VDdXJzb3JQb3NpdGlvbih0aGlzLmVkaXRvcj8uZ2V0UG9zaXRpb24oKSA/PyBudWxsKSkpO1xuXHRcdHRoaXMuX2VkaXRvckRpc3Bvc2FibGVzLnB1c2godGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24oZSA9PiB0aGlzLm9uRWRpdG9yQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKGUpKSk7XG5cdFx0dGhpcy5fZWRpdG9yRGlzcG9zYWJsZXMucHVzaCh0aGlzLmVkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQoKCkgPT4gdGhpcy5vbkVkaXRvckNoYW5nZUN1cnNvclNlbGVjdGlvbigpKSk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRWRpdG9yTGlzdGVuZXJzKCkge1xuXHRcdGRpc3Bvc2UodGhpcy5fZWRpdG9yRGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMuX2VkaXRvckRpc3Bvc2FibGVzID0gW107XG5cdH1cblxuXHRwcml2YXRlIG9uRWRpdG9yTW91c2VMZWF2ZSgpIHtcblx0XHR0aGlzLl9jb21tZW50aW5nUmFuZ2VEZWNvcmF0b3IudXBkYXRlSG92ZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgb25FZGl0b3JNb3VzZU1vdmUoZTogSUVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IGUudGFyZ2V0LnBvc2l0aW9uPy5saW5lTnVtYmVyO1xuXHRcdGlmIChlLmV2ZW50LmxlZnRCdXR0b24udmFsdWVPZigpICYmIHBvc2l0aW9uICYmIHRoaXMubW91c2VEb3duSW5mbykge1xuXHRcdFx0dGhpcy5fY29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLnVwZGF0ZVNlbGVjdGlvbihwb3NpdGlvbiwgbmV3IFJhbmdlKHRoaXMubW91c2VEb3duSW5mby5saW5lTnVtYmVyLCAxLCBwb3NpdGlvbiwgMSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9jb21tZW50aW5nUmFuZ2VEZWNvcmF0b3IudXBkYXRlSG92ZXIocG9zaXRpb24pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25FZGl0b3JDaGFuZ2VDdXJzb3JTZWxlY3Rpb24oZT86IElDdXJzb3JTZWxlY3Rpb25DaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuZWRpdG9yPy5nZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyO1xuXHRcdGlmIChwb3NpdGlvbikge1xuXHRcdFx0dGhpcy5fY29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLnVwZGF0ZVNlbGVjdGlvbihwb3NpdGlvbiwgZT8uc2VsZWN0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRWRpdG9yQ2hhbmdlQ3Vyc29yUG9zaXRpb24oZTogUG9zaXRpb24gfCBudWxsKSB7XG5cdFx0aWYgKCFlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhlLCB7IGNvbHVtbjogLTEsIGxpbmVOdW1iZXI6IGUubGluZU51bWJlciB9KTtcblx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IHRoaXMuZWRpdG9yPy5nZXREZWNvcmF0aW9uc0luUmFuZ2UocmFuZ2UpO1xuXHRcdGxldCBoYXNDb21tZW50aW5nUmFuZ2UgPSBmYWxzZTtcblx0XHRpZiAoZGVjb3JhdGlvbnMpIHtcblx0XHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiBkZWNvcmF0aW9ucykge1xuXHRcdFx0XHRpZiAoZGVjb3JhdGlvbi5vcHRpb25zLmRlc2NyaXB0aW9uID09PSBDb21tZW50R2x5cGhXaWRnZXQuZGVzY3JpcHRpb24pIHtcblx0XHRcdFx0XHQvLyBXZSBkb24ndCBhbGxvdyBtdWx0aXBsZSBjb21tZW50cyBvbiB0aGUgc2FtZSBsaW5lLlxuXHRcdFx0XHRcdGhhc0NvbW1lbnRpbmdSYW5nZSA9IGZhbHNlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGRlY29yYXRpb24ub3B0aW9ucy5kZXNjcmlwdGlvbiA9PT0gQ29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLmRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0aGFzQ29tbWVudGluZ1JhbmdlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9hY3RpdmVDdXJzb3JIYXNDb21tZW50aW5nUmFuZ2Uuc2V0KGhhc0NvbW1lbnRpbmdSYW5nZSk7XG5cdFx0dGhpcy5fYWN0aXZlQ3Vyc29ySGFzQ29tbWVudC5zZXQodGhpcy5nZXRDb21tZW50c0F0TGluZShyYW5nZSkubGVuZ3RoID4gMCk7XG5cdH1cblxuXHRwcml2YXRlIGlzRWRpdG9ySW5saW5lT3JpZ2luYWwodGVzdEVkaXRvcjogSUNvZGVFZGl0b3IpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZGlmZkVkaXRvci5yZW5kZXJTaWRlQnlTaWRlJykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBmb3VuZEVkaXRvciA9IHRoaXMuZWRpdG9yU2VydmljZS52aXNpYmxlVGV4dEVkaXRvckNvbnRyb2xzLmZpbmQoZWRpdG9yID0+IHtcblx0XHRcdGlmIChlZGl0b3IuZ2V0RWRpdG9yVHlwZSgpID09PSBFZGl0b3JUeXBlLklEaWZmRWRpdG9yKSB7XG5cdFx0XHRcdGNvbnN0IGRpZmZFZGl0b3IgPSBlZGl0b3IgYXMgSURpZmZFZGl0b3I7XG5cdFx0XHRcdHJldHVybiBkaWZmRWRpdG9yLmdldE9yaWdpbmFsRWRpdG9yKCkgPT09IHRlc3RFZGl0b3I7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cdFx0cmV0dXJuICEhZm91bmRFZGl0b3I7XG5cdH1cblxuXHRwcml2YXRlIGJlZ2luQ29tcHV0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9jb21wdXRlUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHtcblx0XHRcdGNvbnN0IGVkaXRvclVSSSA9IHRoaXMuZWRpdG9yICYmIHRoaXMuZWRpdG9yLmhhc01vZGVsKCkgJiYgdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS51cmk7XG5cblx0XHRcdGlmIChlZGl0b3JVUkkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY29tbWVudFNlcnZpY2UuZ2V0RG9jdW1lbnRDb21tZW50cyhlZGl0b3JVUkkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtdKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX2NvbXB1dGVBbmRTZXRQcm9taXNlID0gdGhpcy5fY29tcHV0ZVByb21pc2UudGhlbihhc3luYyBjb21tZW50SW5mb3MgPT4ge1xuXHRcdFx0YXdhaXQgdGhpcy5zZXRDb21tZW50cyhjb2FsZXNjZShjb21tZW50SW5mb3MpKTtcblx0XHRcdHRoaXMuX2NvbXB1dGVQcm9taXNlID0gbnVsbDtcblx0XHR9LCBlcnJvciA9PiBjb25zb2xlLmxvZyhlcnJvcikpO1xuXHRcdHRoaXMuX2NvbXB1dGVQcm9taXNlLnRoZW4oKCkgPT4gdGhpcy5fY29tcHV0ZUFuZFNldFByb21pc2UgPSB1bmRlZmluZWQpO1xuXHRcdHJldHVybiB0aGlzLl9jb21wdXRlQW5kU2V0UHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgYmVnaW5Db21wdXRlQ29tbWVudGluZ1JhbmdlcygpIHtcblx0XHRpZiAodGhpcy5fY29tcHV0ZUNvbW1lbnRpbmdSYW5nZVNjaGVkdWxlcikge1xuXHRcdFx0aWYgKHRoaXMuX2NvbXB1dGVDb21tZW50aW5nUmFuZ2VQcm9taXNlKSB7XG5cdFx0XHRcdHRoaXMuX2NvbXB1dGVDb21tZW50aW5nUmFuZ2VQcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLl9jb21wdXRlQ29tbWVudGluZ1JhbmdlUHJvbWlzZSA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2NvbXB1dGVDb21tZW50aW5nUmFuZ2VTY2hlZHVsZXIudHJpZ2dlcigoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclVSSSA9IHRoaXMuZWRpdG9yICYmIHRoaXMuZWRpdG9yLmhhc01vZGVsKCkgJiYgdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS51cmk7XG5cblx0XHRcdFx0aWYgKGVkaXRvclVSSSkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNvbW1lbnRTZXJ2aWNlLmdldERvY3VtZW50Q29tbWVudHMoZWRpdG9yVVJJKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoW10pO1xuXHRcdFx0fSkudGhlbihjb21tZW50SW5mb3MgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5jb21tZW50U2VydmljZS5pc0NvbW1lbnRpbmdFbmFibGVkKSB7XG5cdFx0XHRcdFx0Y29uc3QgbWVhbmluZ2Z1bENvbW1lbnRJbmZvcyA9IGNvYWxlc2NlKGNvbW1lbnRJbmZvcyk7XG5cdFx0XHRcdFx0dGhpcy5fY29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLnVwZGF0ZSh0aGlzLmVkaXRvciwgbWVhbmluZ2Z1bENvbW1lbnRJbmZvcywgdGhpcy5lZGl0b3I/LmdldFBvc2l0aW9uKCk/LmxpbmVOdW1iZXIsIHRoaXMuZWRpdG9yPy5nZXRTZWxlY3Rpb24oKSA/PyB1bmRlZmluZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAoZXJyKSA9PiB7XG5cdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IENvbW1lbnRDb250cm9sbGVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248Q29tbWVudENvbnRyb2xsZXI+KElEKTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxDb21tZW50VGhyZWFkKHRocmVhZElkOiBzdHJpbmcsIGNvbW1lbnRVbmlxdWVJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBmZXRjaE9uY2VJZk5vdEV4aXN0OiBib29sZWFuLCBmb2N1czogQ29tbWVudFdpZGdldEZvY3VzKTogdm9pZCB7XG5cdFx0Y29uc3QgY29tbWVudFRocmVhZFdpZGdldCA9IHRoaXMuX2NvbW1lbnRXaWRnZXRzLmZpbHRlcih3aWRnZXQgPT4gd2lkZ2V0LmNvbW1lbnRUaHJlYWQudGhyZWFkSWQgPT09IHRocmVhZElkKTtcblx0XHRpZiAoY29tbWVudFRocmVhZFdpZGdldC5sZW5ndGggPT09IDEpIHtcblx0XHRcdGNvbW1lbnRUaHJlYWRXaWRnZXRbMF0ucmV2ZWFsKGNvbW1lbnRVbmlxdWVJZCwgZm9jdXMpO1xuXHRcdH0gZWxzZSBpZiAoZmV0Y2hPbmNlSWZOb3RFeGlzdCkge1xuXHRcdFx0aWYgKHRoaXMuX2NvbXB1dGVBbmRTZXRQcm9taXNlKSB7XG5cdFx0XHRcdHRoaXMuX2NvbXB1dGVBbmRTZXRQcm9taXNlLnRoZW4oXyA9PiB7XG5cdFx0XHRcdFx0dGhpcy5yZXZlYWxDb21tZW50VGhyZWFkKHRocmVhZElkLCBjb21tZW50VW5pcXVlSWQsIGZhbHNlLCBmb2N1cyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5iZWdpbkNvbXB1dGUoKS50aGVuKF8gPT4ge1xuXHRcdFx0XHRcdHRoaXMucmV2ZWFsQ29tbWVudFRocmVhZCh0aHJlYWRJZCwgY29tbWVudFVuaXF1ZUlkLCBmYWxzZSwgZm9jdXMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY29sbGFwc2VBbGwoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB3aWRnZXQgb2YgdGhpcy5fY29tbWVudFdpZGdldHMpIHtcblx0XHRcdHdpZGdldC5jb2xsYXBzZSh0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZXhwYW5kQWxsKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qgd2lkZ2V0IG9mIHRoaXMuX2NvbW1lbnRXaWRnZXRzKSB7XG5cdFx0XHR3aWRnZXQuZXhwYW5kKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGV4cGFuZFVucmVzb2x2ZWQoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB3aWRnZXQgb2YgdGhpcy5fY29tbWVudFdpZGdldHMpIHtcblx0XHRcdGlmICh3aWRnZXQuY29tbWVudFRocmVhZC5zdGF0ZSA9PT0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRTdGF0ZS5VbnJlc29sdmVkKSB7XG5cdFx0XHRcdHdpZGdldC5leHBhbmQoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgbmV4dENvbW1lbnRUaHJlYWQoZm9jdXNUaHJlYWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9maW5kTmVhcmVzdENvbW1lbnRUaHJlYWQoZm9jdXNUaHJlYWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZE5lYXJlc3RDb21tZW50VGhyZWFkKGZvY3VzVGhyZWFkOiBib29sZWFuLCByZXZlcnNlPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fY29tbWVudFdpZGdldHMubGVuZ3RoIHx8ICF0aGlzLmVkaXRvcj8uaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFmdGVyID0gcmV2ZXJzZSA/IHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbigpLmdldFN0YXJ0UG9zaXRpb24oKSA6IHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbigpLmdldEVuZFBvc2l0aW9uKCk7XG5cdFx0Y29uc3Qgc29ydGVkV2lkZ2V0cyA9IHRoaXMuX2NvbW1lbnRXaWRnZXRzLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGlmIChyZXZlcnNlKSB7XG5cdFx0XHRcdGNvbnN0IHRlbXAgPSBhO1xuXHRcdFx0XHRhID0gYjtcblx0XHRcdFx0YiA9IHRlbXA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYS5jb21tZW50VGhyZWFkLnJhbmdlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGIuY29tbWVudFRocmVhZC5yYW5nZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGEuY29tbWVudFRocmVhZC5yYW5nZS5zdGFydExpbmVOdW1iZXIgPCBiLmNvbW1lbnRUaHJlYWQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGEuY29tbWVudFRocmVhZC5yYW5nZS5zdGFydExpbmVOdW1iZXIgPiBiLmNvbW1lbnRUaHJlYWQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYS5jb21tZW50VGhyZWFkLnJhbmdlLnN0YXJ0Q29sdW1uIDwgYi5jb21tZW50VGhyZWFkLnJhbmdlLnN0YXJ0Q29sdW1uKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGEuY29tbWVudFRocmVhZC5yYW5nZS5zdGFydENvbHVtbiA+IGIuY29tbWVudFRocmVhZC5yYW5nZS5zdGFydENvbHVtbikge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBpZHggPSBmaW5kRmlyc3RJZHhNb25vdG9ub3VzT3JBcnJMZW4oc29ydGVkV2lkZ2V0cywgd2lkZ2V0ID0+IHtcblx0XHRcdGNvbnN0IGxpbmVWYWx1ZU9uZSA9IHJldmVyc2UgPyBhZnRlci5saW5lTnVtYmVyIDogKHdpZGdldC5jb21tZW50VGhyZWFkLnJhbmdlPy5zdGFydExpbmVOdW1iZXIgPz8gMCk7XG5cdFx0XHRjb25zdCBsaW5lVmFsdWVUd28gPSByZXZlcnNlID8gKHdpZGdldC5jb21tZW50VGhyZWFkLnJhbmdlPy5zdGFydExpbmVOdW1iZXIgPz8gMCkgOiBhZnRlci5saW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgY29sdW1uVmFsdWVPbmUgPSByZXZlcnNlID8gYWZ0ZXIuY29sdW1uIDogKHdpZGdldC5jb21tZW50VGhyZWFkLnJhbmdlPy5zdGFydENvbHVtbiA/PyAwKTtcblx0XHRcdGNvbnN0IGNvbHVtblZhbHVlVHdvID0gcmV2ZXJzZSA/ICh3aWRnZXQuY29tbWVudFRocmVhZC5yYW5nZT8uc3RhcnRDb2x1bW4gPz8gMCkgOiBhZnRlci5jb2x1bW47XG5cdFx0XHRpZiAobGluZVZhbHVlT25lID4gbGluZVZhbHVlVHdvKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobGluZVZhbHVlT25lIDwgbGluZVZhbHVlVHdvKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvbHVtblZhbHVlT25lID4gY29sdW1uVmFsdWVUd28pIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBuZXh0V2lkZ2V0OiBSZXZpZXdab25lV2lkZ2V0IHwgdW5kZWZpbmVkID0gc29ydGVkV2lkZ2V0c1tpZHhdO1xuXHRcdGlmIChuZXh0V2lkZ2V0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuZWRpdG9yLnNldFNlbGVjdGlvbihuZXh0V2lkZ2V0LmNvbW1lbnRUaHJlYWQucmFuZ2UgPz8gbmV3IFJhbmdlKDEsIDEsIDEsIDEpKTtcblx0XHRcdG5leHRXaWRnZXQucmV2ZWFsKHVuZGVmaW5lZCwgZm9jdXNUaHJlYWQgPyBDb21tZW50V2lkZ2V0Rm9jdXMuV2lkZ2V0IDogQ29tbWVudFdpZGdldEZvY3VzLk5vbmUpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBwcmV2aW91c0NvbW1lbnRUaHJlYWQoZm9jdXNUaHJlYWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9maW5kTmVhcmVzdENvbW1lbnRUaHJlYWQoZm9jdXNUaHJlYWQsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZE5lYXJlc3RDb21tZW50aW5nUmFuZ2UocmV2ZXJzZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWZ0ZXIgPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb24oKS5nZXRFbmRQb3NpdGlvbigpO1xuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fY29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLmdldE5lYXJlc3RDb21tZW50aW5nUmFuZ2UoYWZ0ZXIsIHJldmVyc2UpO1xuXHRcdGlmIChyYW5nZSkge1xuXHRcdFx0Y29uc3QgcG9zaXRpb24gPSByZXZlcnNlID8gcmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSA6IHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdHRoaXMuZWRpdG9yLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdHRoaXMuZWRpdG9yLnJldmVhbExpbmVJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0XHRjb25zdCBjb21tZW50UmFuZ2VTdGFydCA9IHJhbmdlPy5nZXRTdGFydFBvc2l0aW9uKCkubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IGNvbW1lbnRSYW5nZUVuZCA9IHJhbmdlPy5nZXRFbmRQb3NpdGlvbigpLmxpbmVOdW1iZXI7XG5cdFx0XHRpZiAoY29tbWVudFJhbmdlU3RhcnQgJiYgY29tbWVudFJhbmdlRW5kKSB7XG5cdFx0XHRcdGNvbnN0IG9uZUxpbmUgPSBjb21tZW50UmFuZ2VTdGFydCA9PT0gY29tbWVudFJhbmdlRW5kO1xuXHRcdFx0XHRvbmVMaW5lID8gc3RhdHVzKG5scy5sb2NhbGl6ZSgnY29tbWVudFJhbmdlJywgXCJMaW5lIHswfVwiLCBjb21tZW50UmFuZ2VTdGFydCkpIDogc3RhdHVzKG5scy5sb2NhbGl6ZSgnY29tbWVudFJhbmdlU3RhcnQnLCBcIkxpbmVzIHswfSB0byB7MX1cIiwgY29tbWVudFJhbmdlU3RhcnQsIGNvbW1lbnRSYW5nZUVuZCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBuZXh0Q29tbWVudGluZ1JhbmdlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2ZpbmROZWFyZXN0Q29tbWVudGluZ1JhbmdlKCk7XG5cdH1cblxuXHRwdWJsaWMgcHJldmlvdXNDb21tZW50aW5nUmFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZmluZE5lYXJlc3RDb21tZW50aW5nUmFuZ2UodHJ1ZSk7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmdsb2JhbFRvRGlzcG9zZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5kaXNwb3NlKCk7XG5cdFx0ZGlzcG9zZSh0aGlzLl9lZGl0b3JEaXNwb3NhYmxlcyk7XG5cdFx0ZGlzcG9zZSh0aGlzLl9jb21tZW50V2lkZ2V0cyk7XG5cblx0XHR0aGlzLmVkaXRvciA9IG51bGwhOyAvLyBTdHJpY3QgbnVsbCBvdmVycmlkZSAtIG51bGxpbmcgb3V0IGluIGRpc3Bvc2Vcblx0fVxuXG5cdHByaXZhdGUgb25XaWxsQ2hhbmdlTW9kZWwoZTogSU1vZGVsQ2hhbmdlZEV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUubmV3TW9kZWxVcmwpIHtcblx0XHRcdHRoaXMudHJ5VXBkYXRlUmVzZXJ2ZWRTcGFjZShlLm5ld01vZGVsVXJsKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGhhbmRsZUNvbW1lbnRBZGRlZChlZGl0b3JJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCB1bmlxdWVPd25lcjogc3RyaW5nLCB0aHJlYWQ6IGxhbmd1YWdlcy5BZGRlZENvbW1lbnRUaHJlYWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtYXRjaGVkWm9uZXMgPSB0aGlzLl9jb21tZW50V2lkZ2V0cy5maWx0ZXIoem9uZVdpZGdldCA9PiB6b25lV2lkZ2V0LnVuaXF1ZU93bmVyID09PSB1bmlxdWVPd25lciAmJiB6b25lV2lkZ2V0LmNvbW1lbnRUaHJlYWQudGhyZWFkSWQgPT09IHRocmVhZC50aHJlYWRJZCk7XG5cdFx0aWYgKG1hdGNoZWRab25lcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtYXRjaGVkTmV3Q29tbWVudFRocmVhZFpvbmVzID0gdGhpcy5fY29tbWVudFdpZGdldHMuZmlsdGVyKHpvbmVXaWRnZXQgPT4gem9uZVdpZGdldC51bmlxdWVPd25lciA9PT0gdW5pcXVlT3duZXIgJiYgem9uZVdpZGdldC5jb21tZW50VGhyZWFkLmNvbW1lbnRUaHJlYWRIYW5kbGUgPT09IC0xICYmIFJhbmdlLmVxdWFsc1JhbmdlKHpvbmVXaWRnZXQuY29tbWVudFRocmVhZC5yYW5nZSwgdGhyZWFkLnJhbmdlKSk7XG5cblx0XHRpZiAobWF0Y2hlZE5ld0NvbW1lbnRUaHJlYWRab25lcy5sZW5ndGgpIHtcblx0XHRcdG1hdGNoZWROZXdDb21tZW50VGhyZWFkWm9uZXNbMF0udXBkYXRlKHRocmVhZCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGludWVPbkNvbW1lbnRJbmRleCA9IHRoaXMuX2luUHJvY2Vzc0NvbnRpbnVlT25Db21tZW50cy5nZXQodW5pcXVlT3duZXIpPy5maW5kSW5kZXgocGVuZGluZyA9PiB7XG5cdFx0XHRpZiAocGVuZGluZy5yYW5nZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybiB0aHJlYWQucmFuZ2UgPT09IHVuZGVmaW5lZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBSYW5nZS5saWZ0KHBlbmRpbmcucmFuZ2UpLmVxdWFsc1JhbmdlKHRocmVhZC5yYW5nZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0bGV0IGNvbnRpbnVlT25Db21tZW50VGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmICgoY29udGludWVPbkNvbW1lbnRJbmRleCAhPT0gdW5kZWZpbmVkKSAmJiBjb250aW51ZU9uQ29tbWVudEluZGV4ID49IDApIHtcblx0XHRcdGNvbnRpbnVlT25Db21tZW50VGV4dCA9IHRoaXMuX2luUHJvY2Vzc0NvbnRpbnVlT25Db21tZW50cy5nZXQodW5pcXVlT3duZXIpPy5zcGxpY2UoY29udGludWVPbkNvbW1lbnRJbmRleCwgMSlbMF0uY29tbWVudC5ib2R5O1xuXHRcdH1cblxuXHRcdGNvbnN0IHBlbmRpbmdDb21tZW50VGV4dCA9ICh0aGlzLl9wZW5kaW5nTmV3Q29tbWVudENhY2hlW3VuaXF1ZU93bmVyXSAmJiB0aGlzLl9wZW5kaW5nTmV3Q29tbWVudENhY2hlW3VuaXF1ZU93bmVyXVt0aHJlYWQudGhyZWFkSWRdKVxuXHRcdFx0Pz8gY29udGludWVPbkNvbW1lbnRUZXh0O1xuXHRcdGNvbnN0IHBlbmRpbmdFZGl0cyA9IHRoaXMuX3BlbmRpbmdFZGl0c0NhY2hlW3VuaXF1ZU93bmVyXSAmJiB0aGlzLl9wZW5kaW5nRWRpdHNDYWNoZVt1bmlxdWVPd25lcl1bdGhyZWFkLnRocmVhZElkXTtcblx0XHRjb25zdCBzaG91bGRSZXZlYWwgPSB0aHJlYWQuY2FuUmVwbHkgJiYgdGhyZWFkLmlzVGVtcGxhdGUgJiYgKCF0aHJlYWQuY29tbWVudHMgfHwgKHRocmVhZC5jb21tZW50cy5sZW5ndGggPT09IDApKSAmJiAoIXRocmVhZC5lZGl0b3JJZCB8fCAodGhyZWFkLmVkaXRvcklkID09PSBlZGl0b3JJZCkpO1xuXHRcdGF3YWl0IHRoaXMuZGlzcGxheUNvbW1lbnRUaHJlYWQodW5pcXVlT3duZXIsIHRocmVhZCwgc2hvdWxkUmV2ZWFsLCBwZW5kaW5nQ29tbWVudFRleHQsIHBlbmRpbmdFZGl0cyk7XG5cdFx0dGhpcy5fY29tbWVudEluZm9zLmZpbHRlcihpbmZvID0+IGluZm8udW5pcXVlT3duZXIgPT09IHVuaXF1ZU93bmVyKVswXS50aHJlYWRzLnB1c2godGhyZWFkKTtcblx0XHR0aGlzLnRyeVVwZGF0ZVJlc2VydmVkU3BhY2UoKTtcblx0fVxuXG5cdHB1YmxpYyBvbk1vZGVsQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHR0aGlzLmxvY2FsVG9EaXNwb3NlLmNsZWFyKCk7XG5cdFx0dGhpcy50cnlVcGRhdGVSZXNlcnZlZFNwYWNlKCk7XG5cblx0XHR0aGlzLnJlbW92ZUNvbW1lbnRXaWRnZXRzQW5kU3RvcmVDYWNoZSgpO1xuXHRcdGlmICghdGhpcy5lZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9oYXNSZXNwb25kZWRUb0VkaXRvckNoYW5nZSA9IGZhbHNlO1xuXG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5hZGQodGhpcy5lZGl0b3Iub25Nb3VzZURvd24oZSA9PiB0aGlzLm9uRWRpdG9yTW91c2VEb3duKGUpKSk7XG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5hZGQodGhpcy5lZGl0b3Iub25Nb3VzZVVwKGUgPT4gdGhpcy5vbkVkaXRvck1vdXNlVXAoZSkpKTtcblx0XHRpZiAodGhpcy5fZWRpdG9yRGlzcG9zYWJsZXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmNsZWFyRWRpdG9yTGlzdGVuZXJzKCk7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyRWRpdG9yTGlzdGVuZXJzKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29tcHV0ZUNvbW1lbnRpbmdSYW5nZVNjaGVkdWxlciA9IG5ldyBEZWxheWVyPElDb21tZW50SW5mb1tdPigyMDApO1xuXHRcdHRoaXMubG9jYWxUb0Rpc3Bvc2UuYWRkKHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fY29tcHV0ZUNvbW1lbnRpbmdSYW5nZVNjaGVkdWxlcj8uY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMuX2NvbXB1dGVDb21tZW50aW5nUmFuZ2VTY2hlZHVsZXIgPSBudWxsO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMubG9jYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGFzeW5jICgpID0+IHtcblx0XHRcdHRoaXMuYmVnaW5Db21wdXRlQ29tbWVudGluZ1JhbmdlcygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmxvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLmNvbW1lbnRTZXJ2aWNlLm9uRGlkVXBkYXRlQ29tbWVudFRocmVhZHMoYXN5bmMgZSA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3JVUkkgPSB0aGlzLmVkaXRvciAmJiB0aGlzLmVkaXRvci5oYXNNb2RlbCgpICYmIHRoaXMuZWRpdG9yLmdldE1vZGVsKCkudXJpO1xuXHRcdFx0aWYgKCFlZGl0b3JVUkkgfHwgIXRoaXMuY29tbWVudFNlcnZpY2UuaXNDb21tZW50aW5nRW5hYmxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9jb21wdXRlUHJvbWlzZSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9jb21wdXRlUHJvbWlzZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29tbWVudEluZm8gPSB0aGlzLl9jb21tZW50SW5mb3MuZmlsdGVyKGluZm8gPT4gaW5mby51bmlxdWVPd25lciA9PT0gZS51bmlxdWVPd25lcik7XG5cdFx0XHRpZiAoIWNvbW1lbnRJbmZvIHx8ICFjb21tZW50SW5mby5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhZGRlZCA9IGUuYWRkZWQuZmlsdGVyKHRocmVhZCA9PiB0aHJlYWQucmVzb3VyY2UgJiYgdGhyZWFkLnJlc291cmNlID09PSBlZGl0b3JVUkkudG9TdHJpbmcoKSk7XG5cdFx0XHRjb25zdCByZW1vdmVkID0gZS5yZW1vdmVkLmZpbHRlcih0aHJlYWQgPT4gdGhyZWFkLnJlc291cmNlICYmIHRocmVhZC5yZXNvdXJjZSA9PT0gZWRpdG9yVVJJLnRvU3RyaW5nKCkpO1xuXHRcdFx0Y29uc3QgY2hhbmdlZCA9IGUuY2hhbmdlZC5maWx0ZXIodGhyZWFkID0+IHRocmVhZC5yZXNvdXJjZSAmJiB0aHJlYWQucmVzb3VyY2UgPT09IGVkaXRvclVSSS50b1N0cmluZygpKTtcblx0XHRcdGNvbnN0IHBlbmRpbmcgPSBlLnBlbmRpbmcuZmlsdGVyKHBlbmRpbmcgPT4gcGVuZGluZy51cmkudG9TdHJpbmcoKSA9PT0gZWRpdG9yVVJJLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRyZW1vdmVkLmZvckVhY2godGhyZWFkID0+IHtcblx0XHRcdFx0Y29uc3QgbWF0Y2hlZFpvbmVzID0gdGhpcy5fY29tbWVudFdpZGdldHMuZmlsdGVyKHpvbmVXaWRnZXQgPT4gem9uZVdpZGdldC51bmlxdWVPd25lciA9PT0gZS51bmlxdWVPd25lciAmJiB6b25lV2lkZ2V0LmNvbW1lbnRUaHJlYWQudGhyZWFkSWQgPT09IHRocmVhZC50aHJlYWRJZCAmJiB6b25lV2lkZ2V0LmNvbW1lbnRUaHJlYWQudGhyZWFkSWQgIT09ICcnKTtcblx0XHRcdFx0aWYgKG1hdGNoZWRab25lcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRjb25zdCBtYXRjaGVkWm9uZSA9IG1hdGNoZWRab25lc1swXTtcblx0XHRcdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2NvbW1lbnRXaWRnZXRzLmluZGV4T2YobWF0Y2hlZFpvbmUpO1xuXHRcdFx0XHRcdHRoaXMuX2NvbW1lbnRXaWRnZXRzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdFx0bWF0Y2hlZFpvbmUuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGluZm9zVGhyZWFkcyA9IHRoaXMuX2NvbW1lbnRJbmZvcy5maWx0ZXIoaW5mbyA9PiBpbmZvLnVuaXF1ZU93bmVyID09PSBlLnVuaXF1ZU93bmVyKVswXS50aHJlYWRzO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGluZm9zVGhyZWFkcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGlmIChpbmZvc1RocmVhZHNbaV0gPT09IHRocmVhZCkge1xuXHRcdFx0XHRcdFx0aW5mb3NUaHJlYWRzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRcdGktLTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHRocmVhZCBvZiBjaGFuZ2VkKSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoZWRab25lcyA9IHRoaXMuX2NvbW1lbnRXaWRnZXRzLmZpbHRlcih6b25lV2lkZ2V0ID0+IHpvbmVXaWRnZXQudW5pcXVlT3duZXIgPT09IGUudW5pcXVlT3duZXIgJiYgem9uZVdpZGdldC5jb21tZW50VGhyZWFkLnRocmVhZElkID09PSB0aHJlYWQudGhyZWFkSWQpO1xuXHRcdFx0XHRpZiAobWF0Y2hlZFpvbmVzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoZWRab25lID0gbWF0Y2hlZFpvbmVzWzBdO1xuXHRcdFx0XHRcdG1hdGNoZWRab25lLnVwZGF0ZSh0aHJlYWQpO1xuXHRcdFx0XHRcdHRoaXMub3BlbkNvbW1lbnRzVmlldyh0aHJlYWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlZGl0b3JJZCA9IHRoaXMuZWRpdG9yPy5nZXRJZCgpO1xuXHRcdFx0Zm9yIChjb25zdCB0aHJlYWQgb2YgYWRkZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5oYW5kbGVDb21tZW50QWRkZWQoZWRpdG9ySWQsIGUudW5pcXVlT3duZXIsIHRocmVhZCk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgdGhyZWFkIG9mIHBlbmRpbmcpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5yZXN1bWVQZW5kaW5nQ29tbWVudChlZGl0b3JVUkksIHRocmVhZCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jb21tZW50VGhyZWFkUmFuZ2VEZWNvcmF0b3IudXBkYXRlKHRoaXMuZWRpdG9yLCBjb21tZW50SW5mbyk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5iZWdpbkNvbXB1dGVBbmRIYW5kbGVFZGl0b3JDaGFuZ2UoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzdW1lUGVuZGluZ0NvbW1lbnQoZWRpdG9yVVJJOiBVUkksIHRocmVhZDogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50VGhyZWFkKSB7XG5cdFx0Y29uc3QgbWF0Y2hlZFpvbmVzID0gdGhpcy5fY29tbWVudFdpZGdldHMuZmlsdGVyKHpvbmVXaWRnZXQgPT4gem9uZVdpZGdldC51bmlxdWVPd25lciA9PT0gdGhyZWFkLnVuaXF1ZU93bmVyICYmIFJhbmdlLmxpZnQoem9uZVdpZGdldC5jb21tZW50VGhyZWFkLnJhbmdlKT8uZXF1YWxzUmFuZ2UodGhyZWFkLnJhbmdlKSk7XG5cdFx0aWYgKHRocmVhZC5pc1JlcGx5ICYmIG1hdGNoZWRab25lcy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuY29tbWVudFNlcnZpY2UucmVtb3ZlQ29udGludWVPbkNvbW1lbnQoeyB1bmlxdWVPd25lcjogdGhyZWFkLnVuaXF1ZU93bmVyLCB1cmk6IGVkaXRvclVSSSwgcmFuZ2U6IHRocmVhZC5yYW5nZSwgaXNSZXBseTogdHJ1ZSB9KTtcblx0XHRcdG1hdGNoZWRab25lc1swXS5zZXRQZW5kaW5nQ29tbWVudCh0aHJlYWQuY29tbWVudCk7XG5cdFx0fSBlbHNlIGlmIChtYXRjaGVkWm9uZXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmNvbW1lbnRTZXJ2aWNlLnJlbW92ZUNvbnRpbnVlT25Db21tZW50KHsgdW5pcXVlT3duZXI6IHRocmVhZC51bmlxdWVPd25lciwgdXJpOiBlZGl0b3JVUkksIHJhbmdlOiB0aHJlYWQucmFuZ2UsIGlzUmVwbHk6IGZhbHNlIH0pO1xuXHRcdFx0Y29uc3QgZXhpc3RpbmdQZW5kaW5nQ29tbWVudCA9IG1hdGNoZWRab25lc1swXS5nZXRQZW5kaW5nQ29tbWVudHMoKS5uZXdDb21tZW50O1xuXHRcdFx0Ly8gV2UgbmVlZCB0byB0cnkgdG8gcmVjb25jaWxlIHRoZSBleGlzdGluZyBwZW5kaW5nIGNvbW1lbnQgd2l0aCB0aGUgaW5jb21pbmcgcGVuZGluZyBjb21tZW50XG5cdFx0XHRsZXQgcGVuZGluZ0NvbW1lbnQ6IGxhbmd1YWdlcy5QZW5kaW5nQ29tbWVudDtcblx0XHRcdGlmICghZXhpc3RpbmdQZW5kaW5nQ29tbWVudCB8fCB0aHJlYWQuY29tbWVudC5ib2R5LmluY2x1ZGVzKGV4aXN0aW5nUGVuZGluZ0NvbW1lbnQuYm9keSkpIHtcblx0XHRcdFx0cGVuZGluZ0NvbW1lbnQgPSB0aHJlYWQuY29tbWVudDtcblx0XHRcdH0gZWxzZSBpZiAoZXhpc3RpbmdQZW5kaW5nQ29tbWVudC5ib2R5LmluY2x1ZGVzKHRocmVhZC5jb21tZW50LmJvZHkpKSB7XG5cdFx0XHRcdHBlbmRpbmdDb21tZW50ID0gZXhpc3RpbmdQZW5kaW5nQ29tbWVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBlbmRpbmdDb21tZW50ID0geyBib2R5OiBgJHtleGlzdGluZ1BlbmRpbmdDb21tZW50fVxcbiR7dGhyZWFkLmNvbW1lbnQuYm9keX1gLCBjdXJzb3I6IHRocmVhZC5jb21tZW50LmN1cnNvciB9O1xuXHRcdFx0fVxuXHRcdFx0bWF0Y2hlZFpvbmVzWzBdLnNldFBlbmRpbmdDb21tZW50KHBlbmRpbmdDb21tZW50KTtcblx0XHR9IGVsc2UgaWYgKCF0aHJlYWQuaXNSZXBseSkge1xuXHRcdFx0Y29uc3QgdGhyZWFkU3RpbGxBdmFpbGFibGUgPSB0aGlzLmNvbW1lbnRTZXJ2aWNlLnJlbW92ZUNvbnRpbnVlT25Db21tZW50KHsgdW5pcXVlT3duZXI6IHRocmVhZC51bmlxdWVPd25lciwgdXJpOiBlZGl0b3JVUkksIHJhbmdlOiB0aHJlYWQucmFuZ2UsIGlzUmVwbHk6IGZhbHNlIH0pO1xuXHRcdFx0aWYgKCF0aHJlYWRTdGlsbEF2YWlsYWJsZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuX2luUHJvY2Vzc0NvbnRpbnVlT25Db21tZW50cy5oYXModGhyZWFkLnVuaXF1ZU93bmVyKSkge1xuXHRcdFx0XHR0aGlzLl9pblByb2Nlc3NDb250aW51ZU9uQ29tbWVudHMuc2V0KHRocmVhZC51bmlxdWVPd25lciwgW10pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5faW5Qcm9jZXNzQ29udGludWVPbkNvbW1lbnRzLmdldCh0aHJlYWQudW5pcXVlT3duZXIpPy5wdXNoKHRocmVhZCk7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbW1lbnRTZXJ2aWNlLmNyZWF0ZUNvbW1lbnRUaHJlYWRUZW1wbGF0ZSh0aHJlYWQudW5pcXVlT3duZXIsIHRocmVhZC51cmksIHRocmVhZC5yYW5nZSA/IFJhbmdlLmxpZnQodGhyZWFkLnJhbmdlKSA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBiZWdpbkNvbXB1dGVBbmRIYW5kbGVFZGl0b3JDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5iZWdpbkNvbXB1dGUoKS50aGVuKCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5faGFzUmVzcG9uZGVkVG9FZGl0b3JDaGFuZ2UpIHtcblx0XHRcdFx0aWYgKHRoaXMuX2NvbW1lbnRJbmZvcy5zb21lKGNvbW1lbnRJbmZvID0+IGNvbW1lbnRJbmZvLmNvbW1lbnRpbmdSYW5nZXMucmFuZ2VzLmxlbmd0aCA+IDAgfHwgY29tbWVudEluZm8uY29tbWVudGluZ1Jhbmdlcy5maWxlQ29tbWVudHMpKSB7XG5cdFx0XHRcdFx0dGhpcy5faGFzUmVzcG9uZGVkVG9FZGl0b3JDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHRcdGNvbnN0IHZlcmJvc2UgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ29tbWVudHMpO1xuXHRcdFx0XHRcdGlmICh2ZXJib3NlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKEFjY2Vzc2liaWxpdHlDb21tYW5kSWQuT3BlbkFjY2Vzc2liaWxpdHlIZWxwKT8uZ2V0QXJpYUxhYmVsKCk7XG5cdFx0XHRcdFx0XHRpZiAoa2V5YmluZGluZykge1xuXHRcdFx0XHRcdFx0XHRzdGF0dXMobmxzLmxvY2FsaXplKCdoYXNDb21tZW50UmFuZ2VzS2InLCBcIkVkaXRvciBoYXMgY29tbWVudGluZyByYW5nZXMsIHJ1biB0aGUgY29tbWFuZCBPcGVuIEFjY2Vzc2liaWxpdHkgSGVscCAoezB9KSwgZm9yIG1vcmUgaW5mb3JtYXRpb24uXCIsIGtleWJpbmRpbmcpKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHN0YXR1cyhubHMubG9jYWxpemUoJ2hhc0NvbW1lbnRSYW5nZXNOb0tiJywgXCJFZGl0b3IgaGFzIGNvbW1lbnRpbmcgcmFuZ2VzLCBydW4gdGhlIGNvbW1hbmQgT3BlbiBBY2Nlc3NpYmlsaXR5IEhlbHAsIHdoaWNoIGlzIGN1cnJlbnRseSBub3QgdHJpZ2dlcmFibGUgdmlhIGtleWJpbmRpbmcsIGZvciBtb3JlIGluZm9ybWF0aW9uLlwiKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHN0YXR1cyhubHMubG9jYWxpemUoJ2hhc0NvbW1lbnRSYW5nZXMnLCBcIkVkaXRvciBoYXMgY29tbWVudGluZyByYW5nZXMuXCIpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbkNvbW1lbnRzVmlldyh0aHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkKSB7XG5cdFx0aWYgKHRocmVhZC5jb21tZW50cyAmJiAodGhyZWFkLmNvbW1lbnRzLmxlbmd0aCA+IDApICYmIHRocmVhZEhhc01lYW5pbmdmdWxDb21tZW50cyh0aHJlYWQpKSB7XG5cdFx0XHRjb25zdCBvcGVuVmlld1N0YXRlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJQ29tbWVudHNDb25maWd1cmF0aW9uPihDT01NRU5UU19TRUNUSU9OKS5vcGVuVmlldztcblx0XHRcdGlmIChvcGVuVmlld1N0YXRlID09PSAnZmlsZScpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3KENPTU1FTlRTX1ZJRVdfSUQpO1xuXHRcdFx0fSBlbHNlIGlmIChvcGVuVmlld1N0YXRlID09PSAnZmlyc3RGaWxlJyB8fCAob3BlblZpZXdTdGF0ZSA9PT0gJ2ZpcnN0RmlsZVVucmVzb2x2ZWQnICYmIHRocmVhZC5zdGF0ZSA9PT0gbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRTdGF0ZS5VbnJlc29sdmVkKSkge1xuXHRcdFx0XHRjb25zdCBoYXNTaG93blZpZXcgPSB0aGlzLnZpZXdzU2VydmljZS5nZXRWaWV3V2l0aElkPENvbW1lbnRzUGFuZWw+KENPTU1FTlRTX1ZJRVdfSUQpPy5oYXNSZW5kZXJlZDtcblx0XHRcdFx0aWYgKCFoYXNTaG93blZpZXcpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXcoQ09NTUVOVFNfVklFV19JRCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZGlzcGxheUNvbW1lbnRUaHJlYWQodW5pcXVlT3duZXI6IHN0cmluZywgdGhyZWFkOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZCwgc2hvdWxkUmV2ZWFsOiBib29sZWFuLCBwZW5kaW5nQ29tbWVudDogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IHwgdW5kZWZpbmVkLCBwZW5kaW5nRWRpdHM6IHsgW2tleTogbnVtYmVyXTogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IH0gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLmVkaXRvcj8uZ2V0TW9kZWwoKTtcblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuZWRpdG9yIHx8IHRoaXMuaXNFZGl0b3JJbmxpbmVPcmlnaW5hbCh0aGlzLmVkaXRvcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgY29udGludWVPbkNvbW1lbnRSZXBseTogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50VGhyZWFkIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0aHJlYWQucmFuZ2UgJiYgIXBlbmRpbmdDb21tZW50KSB7XG5cdFx0XHRjb250aW51ZU9uQ29tbWVudFJlcGx5ID0gdGhpcy5jb21tZW50U2VydmljZS5yZW1vdmVDb250aW51ZU9uQ29tbWVudCh7IHVuaXF1ZU93bmVyLCB1cmk6IGVkaXRvci51cmksIHJhbmdlOiB0aHJlYWQucmFuZ2UsIGlzUmVwbHk6IHRydWUgfSk7XG5cdFx0fVxuXHRcdGNvbnN0IHpvbmVXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJldmlld1pvbmVXaWRnZXQsIHRoaXMuZWRpdG9yLCB1bmlxdWVPd25lciwgdGhyZWFkLCBwZW5kaW5nQ29tbWVudCA/PyBjb250aW51ZU9uQ29tbWVudFJlcGx5Py5jb21tZW50LCBwZW5kaW5nRWRpdHMpO1xuXHRcdGF3YWl0IHpvbmVXaWRnZXQuZGlzcGxheSh0aHJlYWQucmFuZ2UsIHNob3VsZFJldmVhbCk7XG5cdFx0dGhpcy5fY29tbWVudFdpZGdldHMucHVzaCh6b25lV2lkZ2V0KTtcblx0XHR0aGlzLm9wZW5Db21tZW50c1ZpZXcodGhyZWFkKTtcblx0fVxuXG5cdHByaXZhdGUgb25FZGl0b3JNb3VzZURvd24oZTogSUVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLm1vdXNlRG93bkluZm8gPSB0aGlzLl9hY3RpdmVFZGl0b3JIYXNDb21tZW50aW5nUmFuZ2UuZ2V0KCkgPyBwYXJzZU1vdXNlRG93bkluZm9Gcm9tRXZlbnQoZSkgOiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkVkaXRvck1vdXNlVXAoZTogSUVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBtYXRjaGVkTGluZU51bWJlciA9IGlzTW91c2VVcEV2ZW50RHJhZ0Zyb21Nb3VzZURvd24odGhpcy5tb3VzZURvd25JbmZvLCBlKTtcblx0XHR0aGlzLm1vdXNlRG93bkluZm8gPSBudWxsO1xuXG5cdFx0aWYgKCF0aGlzLmVkaXRvciB8fCBtYXRjaGVkTGluZU51bWJlciA9PT0gbnVsbCB8fCAhZS50YXJnZXQuZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBtb3VzZVVwSXNPbkRlY29yYXRvciA9IChlLnRhcmdldC5lbGVtZW50LmNsYXNzTmFtZS5pbmRleE9mKCdjb21tZW50LXJhbmdlLWdseXBoJykgPj0gMCk7XG5cblx0XHRjb25zdCBsaW5lTnVtYmVyID0gZS50YXJnZXQucG9zaXRpb24hLmxpbmVOdW1iZXI7XG5cdFx0bGV0IHJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgc2VsZWN0aW9uOiBSYW5nZSB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdFx0Ly8gQ2hlY2sgZm9yIGRyYWcgYWxvbmcgZ3V0dGVyIGRlY29yYXRpb25cblx0XHRpZiAoKG1hdGNoZWRMaW5lTnVtYmVyICE9PSBsaW5lTnVtYmVyKSkge1xuXHRcdFx0aWYgKG1hdGNoZWRMaW5lTnVtYmVyID4gbGluZU51bWJlcikge1xuXHRcdFx0XHRzZWxlY3Rpb24gPSBuZXcgUmFuZ2UobWF0Y2hlZExpbmVOdW1iZXIsIHRoaXMuZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVMZW5ndGgobWF0Y2hlZExpbmVOdW1iZXIpICsgMSwgbGluZU51bWJlciwgMSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZWxlY3Rpb24gPSBuZXcgUmFuZ2UobWF0Y2hlZExpbmVOdW1iZXIsIDEsIGxpbmVOdW1iZXIsIHRoaXMuZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVMZW5ndGgobGluZU51bWJlcikgKyAxKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKG1vdXNlVXBJc09uRGVjb3JhdG9yKSB7XG5cdFx0XHRzZWxlY3Rpb24gPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBmb3Igc2VsZWN0aW9uIGF0IGxpbmUgbnVtYmVyLlxuXHRcdGlmIChzZWxlY3Rpb24gJiYgKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgPD0gbGluZU51bWJlcikgJiYgKGxpbmVOdW1iZXIgPD0gc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIpKSB7XG5cdFx0XHRyYW5nZSA9IHNlbGVjdGlvbjtcblx0XHRcdHRoaXMuZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgUmFuZ2Uoc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIsIDEsIHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyLCAxKSk7XG5cdFx0fSBlbHNlIGlmIChtb3VzZVVwSXNPbkRlY29yYXRvcikge1xuXHRcdFx0cmFuZ2UgPSBuZXcgUmFuZ2UobGluZU51bWJlciwgMSwgbGluZU51bWJlciwgMSk7XG5cdFx0fVxuXG5cdFx0aWYgKHJhbmdlKSB7XG5cdFx0XHR0aGlzLmFkZE9yVG9nZ2xlQ29tbWVudEF0TGluZShyYW5nZSwgZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldENvbW1lbnRzQXRMaW5lKGNvbW1lbnRSYW5nZTogUmFuZ2UgfCB1bmRlZmluZWQpOiBSZXZpZXdab25lV2lkZ2V0W10ge1xuXHRcdHJldHVybiB0aGlzLl9jb21tZW50V2lkZ2V0cy5maWx0ZXIod2lkZ2V0ID0+IHdpZGdldC5nZXRHbHlwaFBvc2l0aW9uKCkgPT09IChjb21tZW50UmFuZ2UgPyBjb21tZW50UmFuZ2UuZW5kTGluZU51bWJlciA6IDApKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBhZGRPclRvZ2dsZUNvbW1lbnRBdExpbmUoY29tbWVudFJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZCwgZTogSUVkaXRvck1vdXNlRXZlbnQgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBJZiBhbiBhZGQgaXMgYWxyZWFkeSBpbiBwcm9ncmVzcywgcXVldWUgdGhlIG5leHQgYWRkIGFuZCBwcm9jZXNzIGl0IGFmdGVyIHRoZSBjdXJyZW50IG9uZSBmaW5pc2hlcyB0b1xuXHRcdC8vIHByZXZlbnQgZW1wdHkgY29tbWVudCB0aHJlYWRzIGZyb20gYmVpbmcgYWRkZWQgdG8gdGhlIHNhbWUgbGluZS5cblx0XHRpZiAoIXRoaXMuX2FkZEluUHJvZ3Jlc3MpIHtcblx0XHRcdHRoaXMuX2FkZEluUHJvZ3Jlc3MgPSB0cnVlO1xuXHRcdFx0Ly8gVGhlIHdpZGdldCdzIHBvc2l0aW9uIGlzIHVuZGVmaW5lZCB1bnRpbCB0aGUgd2lkZ2V0IGhhcyBiZWVuIGRpc3BsYXllZCwgc28gcmVseSBvbiB0aGUgZ2x5cGggcG9zaXRpb24gaW5zdGVhZFxuXHRcdFx0Y29uc3QgZXhpc3RpbmdDb21tZW50c0F0TGluZSA9IHRoaXMuZ2V0Q29tbWVudHNBdExpbmUoY29tbWVudFJhbmdlKTtcblx0XHRcdGlmIChleGlzdGluZ0NvbW1lbnRzQXRMaW5lLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBhbGxFeHBhbmRlZCA9IGV4aXN0aW5nQ29tbWVudHNBdExpbmUuZXZlcnkod2lkZ2V0ID0+IHdpZGdldC5leHBhbmRlZCk7XG5cdFx0XHRcdGV4aXN0aW5nQ29tbWVudHNBdExpbmUuZm9yRWFjaChhbGxFeHBhbmRlZCA/IHdpZGdldCA9PiB3aWRnZXQuY29sbGFwc2UodHJ1ZSkgOiB3aWRnZXQgPT4gd2lkZ2V0LmV4cGFuZCh0cnVlKSk7XG5cdFx0XHRcdHRoaXMucHJvY2Vzc05leHRUaHJlYWRUb0FkZCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmFkZENvbW1lbnRBdExpbmUoY29tbWVudFJhbmdlLCBlKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZW1wdHlUaHJlYWRzVG9BZGRRdWV1ZS5wdXNoKFtjb21tZW50UmFuZ2UsIGVdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHByb2Nlc3NOZXh0VGhyZWFkVG9BZGQoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWRkSW5Qcm9ncmVzcyA9IGZhbHNlO1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9lbXB0eVRocmVhZHNUb0FkZFF1ZXVlLnNoaWZ0KCk7XG5cdFx0aWYgKGluZm8pIHtcblx0XHRcdHRoaXMuYWRkT3JUb2dnbGVDb21tZW50QXRMaW5lKGluZm9bMF0sIGluZm9bMV0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xpcFVzZXJSYW5nZVRvQ29tbWVudFJhbmdlKHVzZXJSYW5nZTogUmFuZ2UsIGNvbW1lbnRSYW5nZTogUmFuZ2UpOiBSYW5nZSB7XG5cdFx0aWYgKHVzZXJSYW5nZS5zdGFydExpbmVOdW1iZXIgPCBjb21tZW50UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHR1c2VyUmFuZ2UgPSBuZXcgUmFuZ2UoY29tbWVudFJhbmdlLnN0YXJ0TGluZU51bWJlciwgY29tbWVudFJhbmdlLnN0YXJ0Q29sdW1uLCB1c2VyUmFuZ2UuZW5kTGluZU51bWJlciwgdXNlclJhbmdlLmVuZENvbHVtbik7XG5cdFx0fVxuXHRcdGlmICh1c2VyUmFuZ2UuZW5kTGluZU51bWJlciA+IGNvbW1lbnRSYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHR1c2VyUmFuZ2UgPSBuZXcgUmFuZ2UodXNlclJhbmdlLnN0YXJ0TGluZU51bWJlciwgdXNlclJhbmdlLnN0YXJ0Q29sdW1uLCBjb21tZW50UmFuZ2UuZW5kTGluZU51bWJlciwgY29tbWVudFJhbmdlLmVuZENvbHVtbik7XG5cdFx0fVxuXHRcdHJldHVybiB1c2VyUmFuZ2U7XG5cdH1cblxuXHRwdWJsaWMgYWRkQ29tbWVudEF0TGluZShyYW5nZTogUmFuZ2UgfCB1bmRlZmluZWQsIGU6IElFZGl0b3JNb3VzZUV2ZW50IHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbmV3Q29tbWVudEluZm9zID0gdGhpcy5fY29tbWVudGluZ1JhbmdlRGVjb3JhdG9yLmdldE1hdGNoZWRDb21tZW50QWN0aW9uKHJhbmdlKTtcblx0XHRpZiAoIW5ld0NvbW1lbnRJbmZvcy5sZW5ndGggfHwgIXRoaXMuZWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0aGlzLl9hZGRJblByb2dyZXNzID0gZmFsc2U7XG5cdFx0XHRpZiAoIW5ld0NvbW1lbnRJbmZvcy5sZW5ndGgpIHtcblx0XHRcdFx0aWYgKHJhbmdlKSB7XG5cdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKG5scy5sb2NhbGl6ZSgnY29tbWVudHMuYWRkQ29tbWFuZC5lcnJvcicsIFwiVGhlIGN1cnNvciBtdXN0IGJlIHdpdGhpbiBhIGNvbW1lbnRpbmcgcmFuZ2UgdG8gYWRkIGEgY29tbWVudC5cIikpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihubHMubG9jYWxpemUoJ2NvbW1lbnRzLmFkZEZpbGVDb21tZW50Q29tbWFuZC5lcnJvcicsIFwiRmlsZSBjb21tZW50cyBhcmUgbm90IGFsbG93ZWQgb24gdGhpcyBmaWxlLlwiKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0XHRpZiAobmV3Q29tbWVudEluZm9zLmxlbmd0aCA+IDEpIHtcblx0XHRcdGlmIChlICYmIHJhbmdlKSB7XG5cdFx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBlLmV2ZW50LFxuXHRcdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHRoaXMuZ2V0Q29udGV4dE1lbnVBY3Rpb25zKG5ld0NvbW1lbnRJbmZvcywgcmFuZ2UpLFxuXHRcdFx0XHRcdGdldEFjdGlvbnNDb250ZXh0OiAoKSA9PiBuZXdDb21tZW50SW5mb3MubGVuZ3RoID8gbmV3Q29tbWVudEluZm9zWzBdIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdG9uSGlkZTogKCkgPT4geyB0aGlzLl9hZGRJblByb2dyZXNzID0gZmFsc2U7IH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcGlja3MgPSB0aGlzLmdldENvbW1lbnRQcm92aWRlcnNRdWlja1BpY2tzKG5ld0NvbW1lbnRJbmZvcyk7XG5cdFx0XHRcdHJldHVybiB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnBpY2socGlja3MsIHsgcGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgncGlja0NvbW1lbnRTZXJ2aWNlJywgXCJTZWxlY3QgQ29tbWVudCBQcm92aWRlclwiKSwgbWF0Y2hPbkRlc2NyaXB0aW9uOiB0cnVlIH0pLnRoZW4ocGljayA9PiB7XG5cdFx0XHRcdFx0aWYgKCFwaWNrKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgY29tbWVudEluZm9zID0gbmV3Q29tbWVudEluZm9zLmZpbHRlcihpbmZvID0+IGluZm8uYWN0aW9uLm93bmVySWQgPT09IHBpY2suaWQpO1xuXG5cdFx0XHRcdFx0aWYgKGNvbW1lbnRJbmZvcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHsgb3duZXJJZCB9ID0gY29tbWVudEluZm9zWzBdLmFjdGlvbjtcblx0XHRcdFx0XHRcdGNvbnN0IGNsaXBwZWRSYW5nZSA9IHJhbmdlICYmIGNvbW1lbnRJbmZvc1swXS5yYW5nZSA/IHRoaXMuY2xpcFVzZXJSYW5nZVRvQ29tbWVudFJhbmdlKHJhbmdlLCBjb21tZW50SW5mb3NbMF0ucmFuZ2UpIDogcmFuZ2U7XG5cdFx0XHRcdFx0XHR0aGlzLmFkZENvbW1lbnRBdExpbmUyKGNsaXBwZWRSYW5nZSwgb3duZXJJZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9hZGRJblByb2dyZXNzID0gZmFsc2U7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB7IG93bmVySWQgfSA9IG5ld0NvbW1lbnRJbmZvc1swXSEuYWN0aW9uO1xuXHRcdFx0Y29uc3QgY2xpcHBlZFJhbmdlID0gcmFuZ2UgJiYgbmV3Q29tbWVudEluZm9zWzBdLnJhbmdlID8gdGhpcy5jbGlwVXNlclJhbmdlVG9Db21tZW50UmFuZ2UocmFuZ2UsIG5ld0NvbW1lbnRJbmZvc1swXS5yYW5nZSkgOiByYW5nZTtcblx0XHRcdHRoaXMuYWRkQ29tbWVudEF0TGluZTIoY2xpcHBlZFJhbmdlLCBvd25lcklkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbW1lbnRQcm92aWRlcnNRdWlja1BpY2tzKGNvbW1lbnRJbmZvczogTWVyZ2VkQ29tbWVudFJhbmdlQWN0aW9uc1tdKSB7XG5cdFx0Y29uc3QgcGlja3M6IFF1aWNrUGlja0lucHV0W10gPSBjb21tZW50SW5mb3MubWFwKChjb21tZW50SW5mbykgPT4ge1xuXHRcdFx0Y29uc3QgeyBvd25lcklkLCBleHRlbnNpb25JZCwgbGFiZWwgfSA9IGNvbW1lbnRJbmZvLmFjdGlvbjtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGFiZWw6IGxhYmVsID8/IGV4dGVuc2lvbklkID8/IG93bmVySWQsXG5cdFx0XHRcdGlkOiBvd25lcklkXG5cdFx0XHR9IHNhdGlzZmllcyBJUXVpY2tQaWNrSXRlbTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBwaWNrcztcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29udGV4dE1lbnVBY3Rpb25zKGNvbW1lbnRJbmZvczogTWVyZ2VkQ29tbWVudFJhbmdlQWN0aW9uc1tdLCBjb21tZW50UmFuZ2U6IFJhbmdlKTogSUFjdGlvbltdIHtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdGNvbW1lbnRJbmZvcy5mb3JFYWNoKGNvbW1lbnRJbmZvID0+IHtcblx0XHRcdGNvbnN0IHsgb3duZXJJZCwgZXh0ZW5zaW9uSWQsIGxhYmVsIH0gPSBjb21tZW50SW5mby5hY3Rpb247XG5cblx0XHRcdGFjdGlvbnMucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHQnYWRkQ29tbWVudFRocmVhZCcsXG5cdFx0XHRcdGAke2xhYmVsIHx8IGV4dGVuc2lvbklkfWAsXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNsaXBwZWRSYW5nZSA9IGNvbW1lbnRJbmZvLnJhbmdlID8gdGhpcy5jbGlwVXNlclJhbmdlVG9Db21tZW50UmFuZ2UoY29tbWVudFJhbmdlLCBjb21tZW50SW5mby5yYW5nZSkgOiBjb21tZW50UmFuZ2U7XG5cdFx0XHRcdFx0dGhpcy5hZGRDb21tZW50QXRMaW5lMihjbGlwcGVkUmFuZ2UsIG93bmVySWQpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0KSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGFjdGlvbnM7XG5cdH1cblxuXHRwdWJsaWMgYWRkQ29tbWVudEF0TGluZTIocmFuZ2U6IFJhbmdlIHwgdW5kZWZpbmVkLCBvd25lcklkOiBzdHJpbmcpIHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuY29tbWVudFNlcnZpY2UuY3JlYXRlQ29tbWVudFRocmVhZFRlbXBsYXRlKG93bmVySWQsIHRoaXMuZWRpdG9yLmdldE1vZGVsKCkhLnVyaSwgcmFuZ2UsIHRoaXMuZWRpdG9yLmdldElkKCkpO1xuXHRcdHRoaXMucHJvY2Vzc05leHRUaHJlYWRUb0FkZCgpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RXhpc3RpbmdDb21tZW50RWRpdG9yT3B0aW9ucyhlZGl0b3I6IElDb2RlRWRpdG9yKSB7XG5cdFx0Y29uc3QgbGluZURlY29yYXRpb25zV2lkdGg6IG51bWJlciA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVEZWNvcmF0aW9uc1dpZHRoKTtcblx0XHRsZXQgZXh0cmFFZGl0b3JDbGFzc05hbWU6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgY29uZmlndXJlZEV4dHJhQ2xhc3NOYW1lID0gZWRpdG9yLmdldFJhd09wdGlvbnMoKS5leHRyYUVkaXRvckNsYXNzTmFtZTtcblx0XHRpZiAoY29uZmlndXJlZEV4dHJhQ2xhc3NOYW1lKSB7XG5cdFx0XHRleHRyYUVkaXRvckNsYXNzTmFtZSA9IGNvbmZpZ3VyZWRFeHRyYUNsYXNzTmFtZS5zcGxpdCgnICcpO1xuXHRcdH1cblx0XHRyZXR1cm4geyBsaW5lRGVjb3JhdGlvbnNXaWR0aCwgZXh0cmFFZGl0b3JDbGFzc05hbWUgfTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0V2l0aG91dENvbW1lbnRzRWRpdG9yT3B0aW9ucyhlZGl0b3I6IElDb2RlRWRpdG9yLCBleHRyYUVkaXRvckNsYXNzTmFtZTogc3RyaW5nW10sIHN0YXJ0aW5nTGluZURlY29yYXRpb25zV2lkdGg6IG51bWJlcikge1xuXHRcdGxldCBsaW5lRGVjb3JhdGlvbnNXaWR0aCA9IHN0YXJ0aW5nTGluZURlY29yYXRpb25zV2lkdGg7XG5cdFx0Y29uc3QgaW5saW5lQ29tbWVudFBvcyA9IGV4dHJhRWRpdG9yQ2xhc3NOYW1lLmZpbmRJbmRleChuYW1lID0+IG5hbWUgPT09ICdpbmxpbmUtY29tbWVudCcpO1xuXHRcdGlmIChpbmxpbmVDb21tZW50UG9zID49IDApIHtcblx0XHRcdGV4dHJhRWRpdG9yQ2xhc3NOYW1lLnNwbGljZShpbmxpbmVDb21tZW50UG9zLCAxKTtcblx0XHR9XG5cblx0XHRjb25zdCBvcHRpb25zID0gZWRpdG9yLmdldE9wdGlvbnMoKTtcblx0XHRpZiAob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbGRpbmcpICYmIG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5zaG93Rm9sZGluZ0NvbnRyb2xzKSAhPT0gJ25ldmVyJykge1xuXHRcdFx0bGluZURlY29yYXRpb25zV2lkdGggKz0gMTE7IC8vIDExIGNvbWVzIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi85NGVlNWY1ODYxOWQ1OTE3MDk4M2Y0NTNmZTc4ZjE1NmMwY2M3M2EzL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL21lZGlhL3Jldmlldy5jc3MjTDQ4NVxuXHRcdH1cblx0XHRsaW5lRGVjb3JhdGlvbnNXaWR0aCAtPSAyNDtcblx0XHRyZXR1cm4geyBleHRyYUVkaXRvckNsYXNzTmFtZSwgbGluZURlY29yYXRpb25zV2lkdGggfTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0V2l0aENvbW1lbnRzTGluZURlY29yYXRpb25XaWR0aChlZGl0b3I6IElDb2RlRWRpdG9yLCBzdGFydGluZ0xpbmVEZWNvcmF0aW9uc1dpZHRoOiBudW1iZXIpIHtcblx0XHRsZXQgbGluZURlY29yYXRpb25zV2lkdGggPSBzdGFydGluZ0xpbmVEZWNvcmF0aW9uc1dpZHRoO1xuXHRcdGNvbnN0IG9wdGlvbnMgPSBlZGl0b3IuZ2V0T3B0aW9ucygpO1xuXHRcdGlmIChvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9sZGluZykgJiYgb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnNob3dGb2xkaW5nQ29udHJvbHMpICE9PSAnbmV2ZXInKSB7XG5cdFx0XHRsaW5lRGVjb3JhdGlvbnNXaWR0aCAtPSAxMTtcblx0XHR9XG5cdFx0bGluZURlY29yYXRpb25zV2lkdGggKz0gMjQ7XG5cdFx0dGhpcy5fY29tbWVudGluZ1JhbmdlQW1vdW50UmVzZXJ2ZWQgPSBsaW5lRGVjb3JhdGlvbnNXaWR0aDtcblx0XHRyZXR1cm4gdGhpcy5fY29tbWVudGluZ1JhbmdlQW1vdW50UmVzZXJ2ZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldFdpdGhDb21tZW50c0VkaXRvck9wdGlvbnMoZWRpdG9yOiBJQ29kZUVkaXRvciwgZXh0cmFFZGl0b3JDbGFzc05hbWU6IHN0cmluZ1tdLCBzdGFydGluZ0xpbmVEZWNvcmF0aW9uc1dpZHRoOiBudW1iZXIpIHtcblx0XHRleHRyYUVkaXRvckNsYXNzTmFtZS5wdXNoKCdpbmxpbmUtY29tbWVudCcpO1xuXHRcdHJldHVybiB7IGxpbmVEZWNvcmF0aW9uc1dpZHRoOiB0aGlzLmdldFdpdGhDb21tZW50c0xpbmVEZWNvcmF0aW9uV2lkdGgoZWRpdG9yLCBzdGFydGluZ0xpbmVEZWNvcmF0aW9uc1dpZHRoKSwgZXh0cmFFZGl0b3JDbGFzc05hbWUgfTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRWRpdG9yTGF5b3V0T3B0aW9ucyhlZGl0b3I6IElDb2RlRWRpdG9yLCBleHRyYUVkaXRvckNsYXNzTmFtZTogc3RyaW5nW10sIGxpbmVEZWNvcmF0aW9uc1dpZHRoOiBudW1iZXIpIHtcblx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRleHRyYUVkaXRvckNsYXNzTmFtZTogZXh0cmFFZGl0b3JDbGFzc05hbWUuam9pbignICcpLFxuXHRcdFx0bGluZURlY29yYXRpb25zV2lkdGg6IGxpbmVEZWNvcmF0aW9uc1dpZHRoXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZUNvbW1lbnRpbmdSYW5nZVJlc2VydmVkQW1vdW50KGVkaXRvcjogSUNvZGVFZGl0b3IpIHtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuZ2V0RXhpc3RpbmdDb21tZW50RWRpdG9yT3B0aW9ucyhlZGl0b3IpO1xuXHRcdGlmIChleGlzdGluZy5saW5lRGVjb3JhdGlvbnNXaWR0aCAhPT0gdGhpcy5fY29tbWVudGluZ1JhbmdlQW1vdW50UmVzZXJ2ZWQpIHtcblx0XHRcdGVkaXRvci51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0bGluZURlY29yYXRpb25zV2lkdGg6IHRoaXMuZ2V0V2l0aENvbW1lbnRzTGluZURlY29yYXRpb25XaWR0aChlZGl0b3IsIGV4aXN0aW5nLmxpbmVEZWNvcmF0aW9uc1dpZHRoKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0cnlVcGRhdGVSZXNlcnZlZFNwYWNlKHVyaT86IFVSSSkge1xuXHRcdGlmICghdGhpcy5lZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNDb21tZW50c09yUmFuZ2VzSW5JbmZvID0gdGhpcy5fY29tbWVudEluZm9zLnNvbWUoaW5mbyA9PiB7XG5cdFx0XHRjb25zdCBoYXNSYW5nZXMgPSBCb29sZWFuKGluZm8uY29tbWVudGluZ1JhbmdlcyAmJiAoQXJyYXkuaXNBcnJheShpbmZvLmNvbW1lbnRpbmdSYW5nZXMpID8gaW5mby5jb21tZW50aW5nUmFuZ2VzIDogaW5mby5jb21tZW50aW5nUmFuZ2VzLnJhbmdlcykubGVuZ3RoKTtcblx0XHRcdHJldHVybiBoYXNSYW5nZXMgfHwgKGluZm8udGhyZWFkcy5sZW5ndGggPiAwKTtcblx0XHR9KTtcblx0XHR1cmkgPSB1cmkgPz8gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKT8udXJpO1xuXHRcdGNvbnN0IHJlc291cmNlSGFzQ29tbWVudGluZ1JhbmdlcyA9IHVyaSA/IHRoaXMuY29tbWVudFNlcnZpY2UucmVzb3VyY2VIYXNDb21tZW50aW5nUmFuZ2VzKHVyaSkgOiBmYWxzZTtcblxuXHRcdGNvbnN0IGhhc0NvbW1lbnRzT3JSYW5nZXMgPSBoYXNDb21tZW50c09yUmFuZ2VzSW5JbmZvIHx8IHJlc291cmNlSGFzQ29tbWVudGluZ1JhbmdlcztcblxuXHRcdGlmIChoYXNDb21tZW50c09yUmFuZ2VzICYmIHRoaXMuY29tbWVudFNlcnZpY2UuaXNDb21tZW50aW5nRW5hYmxlZCkge1xuXHRcdFx0aWYgKCF0aGlzLl9jb21tZW50aW5nUmFuZ2VTcGFjZVJlc2VydmVkKSB7XG5cdFx0XHRcdHRoaXMuX2NvbW1lbnRpbmdSYW5nZVNwYWNlUmVzZXJ2ZWQgPSB0cnVlO1xuXHRcdFx0XHRjb25zdCB7IGxpbmVEZWNvcmF0aW9uc1dpZHRoLCBleHRyYUVkaXRvckNsYXNzTmFtZSB9ID0gdGhpcy5nZXRFeGlzdGluZ0NvbW1lbnRFZGl0b3JPcHRpb25zKHRoaXMuZWRpdG9yKTtcblx0XHRcdFx0Y29uc3QgbmV3T3B0aW9ucyA9IHRoaXMuZ2V0V2l0aENvbW1lbnRzRWRpdG9yT3B0aW9ucyh0aGlzLmVkaXRvciwgZXh0cmFFZGl0b3JDbGFzc05hbWUsIGxpbmVEZWNvcmF0aW9uc1dpZHRoKTtcblx0XHRcdFx0dGhpcy51cGRhdGVFZGl0b3JMYXlvdXRPcHRpb25zKHRoaXMuZWRpdG9yLCBuZXdPcHRpb25zLmV4dHJhRWRpdG9yQ2xhc3NOYW1lLCBuZXdPcHRpb25zLmxpbmVEZWNvcmF0aW9uc1dpZHRoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZW5zdXJlQ29tbWVudGluZ1JhbmdlUmVzZXJ2ZWRBbW91bnQodGhpcy5lZGl0b3IpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoKCFoYXNDb21tZW50c09yUmFuZ2VzIHx8ICF0aGlzLmNvbW1lbnRTZXJ2aWNlLmlzQ29tbWVudGluZ0VuYWJsZWQpICYmIHRoaXMuX2NvbW1lbnRpbmdSYW5nZVNwYWNlUmVzZXJ2ZWQpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRpbmdSYW5nZVNwYWNlUmVzZXJ2ZWQgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHsgbGluZURlY29yYXRpb25zV2lkdGgsIGV4dHJhRWRpdG9yQ2xhc3NOYW1lIH0gPSB0aGlzLmdldEV4aXN0aW5nQ29tbWVudEVkaXRvck9wdGlvbnModGhpcy5lZGl0b3IpO1xuXHRcdFx0Y29uc3QgbmV3T3B0aW9ucyA9IHRoaXMuZ2V0V2l0aG91dENvbW1lbnRzRWRpdG9yT3B0aW9ucyh0aGlzLmVkaXRvciwgZXh0cmFFZGl0b3JDbGFzc05hbWUsIGxpbmVEZWNvcmF0aW9uc1dpZHRoKTtcblx0XHRcdHRoaXMudXBkYXRlRWRpdG9yTGF5b3V0T3B0aW9ucyh0aGlzLmVkaXRvciwgbmV3T3B0aW9ucy5leHRyYUVkaXRvckNsYXNzTmFtZSwgbmV3T3B0aW9ucy5saW5lRGVjb3JhdGlvbnNXaWR0aCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXRDb21tZW50cyhjb21tZW50SW5mb3M6IElDb21tZW50SW5mb1tdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvciB8fCAhdGhpcy5jb21tZW50U2VydmljZS5pc0NvbW1lbnRpbmdFbmFibGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29tbWVudEluZm9zID0gY29tbWVudEluZm9zO1xuXHRcdHRoaXMudHJ5VXBkYXRlUmVzZXJ2ZWRTcGFjZSgpO1xuXHRcdC8vIGNyZWF0ZSB2aWV3em9uZXNcblx0XHR0aGlzLnJlbW92ZUNvbW1lbnRXaWRnZXRzQW5kU3RvcmVDYWNoZSgpO1xuXG5cdFx0bGV0IGhhc0NvbW1lbnRpbmdSYW5nZXMgPSBmYWxzZTtcblx0XHRmb3IgKGNvbnN0IGluZm8gb2YgdGhpcy5fY29tbWVudEluZm9zKSB7XG5cdFx0XHRpZiAoIWhhc0NvbW1lbnRpbmdSYW5nZXMgJiYgKGluZm8uY29tbWVudGluZ1Jhbmdlcy5yYW5nZXMubGVuZ3RoID4gMCB8fCBpbmZvLmNvbW1lbnRpbmdSYW5nZXMuZmlsZUNvbW1lbnRzKSkge1xuXHRcdFx0XHRoYXNDb21tZW50aW5nUmFuZ2VzID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcHJvdmlkZXJDYWNoZVN0b3JlID0gdGhpcy5fcGVuZGluZ05ld0NvbW1lbnRDYWNoZVtpbmZvLnVuaXF1ZU93bmVyXTtcblx0XHRcdGNvbnN0IHByb3ZpZGVyRWRpdHNDYWNoZVN0b3JlID0gdGhpcy5fcGVuZGluZ0VkaXRzQ2FjaGVbaW5mby51bmlxdWVPd25lcl07XG5cdFx0XHRpbmZvLnRocmVhZHMgPSBpbmZvLnRocmVhZHMuZmlsdGVyKHRocmVhZCA9PiAhdGhyZWFkLmlzRGlzcG9zZWQpO1xuXHRcdFx0Zm9yIChjb25zdCB0aHJlYWQgb2YgaW5mby50aHJlYWRzKSB7XG5cdFx0XHRcdGxldCBwZW5kaW5nQ29tbWVudDogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAocHJvdmlkZXJDYWNoZVN0b3JlKSB7XG5cdFx0XHRcdFx0cGVuZGluZ0NvbW1lbnQgPSBwcm92aWRlckNhY2hlU3RvcmVbdGhyZWFkLnRocmVhZElkXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBwZW5kaW5nRWRpdHM6IHsgW2tleTogbnVtYmVyXTogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IH0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChwcm92aWRlckVkaXRzQ2FjaGVTdG9yZSkge1xuXHRcdFx0XHRcdHBlbmRpbmdFZGl0cyA9IHByb3ZpZGVyRWRpdHNDYWNoZVN0b3JlW3RocmVhZC50aHJlYWRJZF07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhd2FpdCB0aGlzLmRpc3BsYXlDb21tZW50VGhyZWFkKGluZm8udW5pcXVlT3duZXIsIHRocmVhZCwgZmFsc2UsIHBlbmRpbmdDb21tZW50LCBwZW5kaW5nRWRpdHMpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCB0aHJlYWQgb2YgaW5mby5wZW5kaW5nQ29tbWVudFRocmVhZHMgPz8gW10pIHtcblx0XHRcdFx0dGhpcy5yZXN1bWVQZW5kaW5nQ29tbWVudCh0aGlzLmVkaXRvciEuZ2V0TW9kZWwoKSEudXJpLCB0aHJlYWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2NvbW1lbnRpbmdSYW5nZURlY29yYXRvci51cGRhdGUodGhpcy5lZGl0b3IsIHRoaXMuX2NvbW1lbnRJbmZvcyk7XG5cdFx0dGhpcy5fY29tbWVudFRocmVhZFJhbmdlRGVjb3JhdG9yLnVwZGF0ZSh0aGlzLmVkaXRvciwgdGhpcy5fY29tbWVudEluZm9zKTtcblxuXHRcdGlmIChoYXNDb21tZW50aW5nUmFuZ2VzKSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVFZGl0b3JIYXNDb21tZW50aW5nUmFuZ2Uuc2V0KHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVFZGl0b3JIYXNDb21tZW50aW5nUmFuZ2Uuc2V0KGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY29sbGFwc2VBbmRGb2N1c1JhbmdlKHRocmVhZElkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9jb21tZW50V2lkZ2V0cz8uZmluZCh3aWRnZXQgPT4gd2lkZ2V0LmNvbW1lbnRUaHJlYWQudGhyZWFkSWQgPT09IHRocmVhZElkKT8uY29sbGFwc2VBbmRGb2N1c1JhbmdlKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUNvbW1lbnRXaWRnZXRzQW5kU3RvcmVDYWNoZSgpIHtcblx0XHRpZiAodGhpcy5fY29tbWVudFdpZGdldHMpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRXaWRnZXRzLmZvckVhY2goem9uZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHBlbmRpbmdDb21tZW50cyA9IHpvbmUuZ2V0UGVuZGluZ0NvbW1lbnRzKCk7XG5cdFx0XHRcdGNvbnN0IHBlbmRpbmdOZXdDb21tZW50ID0gcGVuZGluZ0NvbW1lbnRzLm5ld0NvbW1lbnQ7XG5cdFx0XHRcdGNvbnN0IHByb3ZpZGVyTmV3Q29tbWVudENhY2hlU3RvcmUgPSB0aGlzLl9wZW5kaW5nTmV3Q29tbWVudENhY2hlW3pvbmUudW5pcXVlT3duZXJdO1xuXG5cdFx0XHRcdGxldCBsYXN0Q29tbWVudEJvZHk7XG5cdFx0XHRcdGlmICh6b25lLmNvbW1lbnRUaHJlYWQuY29tbWVudHMgJiYgem9uZS5jb21tZW50VGhyZWFkLmNvbW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IGxhc3RDb21tZW50ID0gem9uZS5jb21tZW50VGhyZWFkLmNvbW1lbnRzW3pvbmUuY29tbWVudFRocmVhZC5jb21tZW50cy5sZW5ndGggLSAxXTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGxhc3RDb21tZW50LmJvZHkgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRsYXN0Q29tbWVudEJvZHkgPSBsYXN0Q29tbWVudC5ib2R5O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRsYXN0Q29tbWVudEJvZHkgPSBsYXN0Q29tbWVudC5ib2R5LnZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocGVuZGluZ05ld0NvbW1lbnQgJiYgKHBlbmRpbmdOZXdDb21tZW50LmJvZHkgIT09IGxhc3RDb21tZW50Qm9keSkpIHtcblx0XHRcdFx0XHRpZiAoIXByb3ZpZGVyTmV3Q29tbWVudENhY2hlU3RvcmUpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3BlbmRpbmdOZXdDb21tZW50Q2FjaGVbem9uZS51bmlxdWVPd25lcl0gPSB7fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nTmV3Q29tbWVudENhY2hlW3pvbmUudW5pcXVlT3duZXJdW3pvbmUuY29tbWVudFRocmVhZC50aHJlYWRJZF0gPSBwZW5kaW5nTmV3Q29tbWVudDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAocHJvdmlkZXJOZXdDb21tZW50Q2FjaGVTdG9yZSkge1xuXHRcdFx0XHRcdFx0ZGVsZXRlIHByb3ZpZGVyTmV3Q29tbWVudENhY2hlU3RvcmVbem9uZS5jb21tZW50VGhyZWFkLnRocmVhZElkXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBwZW5kaW5nRWRpdHMgPSBwZW5kaW5nQ29tbWVudHMuZWRpdHM7XG5cdFx0XHRcdGNvbnN0IHByb3ZpZGVyRWRpdHNDYWNoZVN0b3JlID0gdGhpcy5fcGVuZGluZ0VkaXRzQ2FjaGVbem9uZS51bmlxdWVPd25lcl07XG5cdFx0XHRcdGlmIChPYmplY3Qua2V5cyhwZW5kaW5nRWRpdHMpLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRpZiAoIXByb3ZpZGVyRWRpdHNDYWNoZVN0b3JlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nRWRpdHNDYWNoZVt6b25lLnVuaXF1ZU93bmVyXSA9IHt9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nRWRpdHNDYWNoZVt6b25lLnVuaXF1ZU93bmVyXVt6b25lLmNvbW1lbnRUaHJlYWQudGhyZWFkSWRdID0gcGVuZGluZ0VkaXRzO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHByb3ZpZGVyRWRpdHNDYWNoZVN0b3JlKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHByb3ZpZGVyRWRpdHNDYWNoZVN0b3JlW3pvbmUuY29tbWVudFRocmVhZC50aHJlYWRJZF07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR6b25lLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRc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
