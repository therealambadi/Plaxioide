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
import { $, getWindow, n } from "../../../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../../../base/browser/mouseEvent.js";
import { Color } from "../../../../../../../base/common/color.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, derivedObservableWithCache, observableFromEvent } from "../../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { editorBackground } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { asCssVariable, asCssVariableWithDefault } from "../../../../../../../platform/theme/common/colorUtils.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { observableCodeEditor } from "../../../../../../browser/observableCodeEditor.js";
import { Rect } from "../../../../../../browser/rect.js";
import { EmbeddedCodeEditorWidget } from "../../../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { Position } from "../../../../../../common/core/position.js";
import { Range } from "../../../../../../common/core/range.js";
import { StickyScrollController } from "../../../../../stickyScroll/browser/stickyScrollController.js";
import { InlineCompletionContextKeys } from "../../../controller/inlineCompletionContextKeys.js";
import { getEditorBlendedColor, getModifiedBorderColor, getOriginalBorderColor, modifiedBackgroundColor, originalBackgroundColor } from "../theme.js";
import { PathBuilder, getContentRenderWidth, getOffsetForPos, mapOutFalsy, maxContentWidthInRange } from "../utils/utils.js";
const HORIZONTAL_PADDING = 0;
const VERTICAL_PADDING = 0;
const ENABLE_OVERFLOW = false;
const BORDER_WIDTH = 1;
const WIDGET_SEPARATOR_WIDTH = 1;
const BORDER_RADIUS = 4;
const ORIGINAL_END_PADDING = 20;
const MODIFIED_END_PADDING = 12;
let InlineEditsSideBySideView = class extends Disposable {
  constructor(_editor, _edit, _previewTextModel, _uiState, _tabAction, _instantiationService, _themeService) {
    super();
    this._editor = _editor;
    this._edit = _edit;
    this._previewTextModel = _previewTextModel;
    this._uiState = _uiState;
    this._tabAction = _tabAction;
    this._instantiationService = _instantiationService;
    this._themeService = _themeService;
    this._editorObs = observableCodeEditor(this._editor);
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._display = derived(this, (reader) => !!this._uiState.read(reader) ? "block" : "none");
    this.previewRef = n.ref();
    this._editorContainer = n.div({
      class: ["editorContainer"],
      style: { position: "absolute", overflow: "hidden", cursor: "pointer" },
      onmousedown: (e) => {
        e.preventDefault();
      },
      onclick: (e) => {
        this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e));
      }
    }, [
      n.div({ class: "preview", style: { pointerEvents: "none" }, ref: this.previewRef })
    ]).keepUpdated(this._store);
    this.isHovered = this._editorContainer.didMouseMoveDuringHover;
    this.previewEditor = this._register(this._instantiationService.createInstance(
      EmbeddedCodeEditorWidget,
      this.previewRef.element,
      {
        glyphMargin: false,
        lineNumbers: "off",
        minimap: { enabled: false },
        guides: {
          indentation: false,
          bracketPairs: false,
          bracketPairsHorizontal: false,
          highlightActiveIndentation: false
        },
        rulers: [],
        padding: { top: 0, bottom: 0 },
        folding: false,
        selectOnLineNumbers: false,
        selectionHighlight: false,
        columnSelection: false,
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        revealHorizontalRightPadding: 0,
        bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },
        scrollBeyondLastLine: false,
        scrollbar: {
          vertical: "hidden",
          horizontal: "hidden",
          handleMouseWheel: false
        },
        readOnly: true,
        wordWrap: "off",
        wordWrapOverride1: "off",
        wordWrapOverride2: "off"
      },
      {
        contextKeyValues: {
          [InlineCompletionContextKeys.inInlineEditsPreviewEditor.key]: true
        },
        contributions: []
      },
      this._editor
    ));
    this._previewEditorObs = observableCodeEditor(this.previewEditor);
    this._activeViewZones = [];
    this._updatePreviewEditor = derived((reader) => {
      this._editorContainer.readEffect(reader);
      this._previewEditorObs.model.read(reader);
      this._display.read(reader);
      if (this._nonOverflowView) {
        this._nonOverflowView.element.style.display = this._display.read(reader);
      }
      const uiState = this._uiState.read(reader);
      const edit = this._edit.read(reader);
      if (!uiState || !edit) {
        return;
      }
      const range = edit.originalLineRange;
      const hiddenAreas = [];
      if (range.startLineNumber > 1) {
        hiddenAreas.push(new Range(1, 1, range.startLineNumber - 1, 1));
      }
      if (range.startLineNumber + uiState.newTextLineCount < this._previewTextModel.getLineCount() + 1) {
        hiddenAreas.push(new Range(range.startLineNumber + uiState.newTextLineCount, 1, this._previewTextModel.getLineCount() + 1, 1));
      }
      this.previewEditor.setHiddenAreas(hiddenAreas, void 0, true);
      const previousViewZones = [...this._activeViewZones];
      this._activeViewZones = [];
      const reducedLinesCount = range.endLineNumberExclusive - range.startLineNumber - uiState.newTextLineCount;
      this.previewEditor.changeViewZones((changeAccessor) => {
        previousViewZones.forEach((id) => changeAccessor.removeZone(id));
        if (reducedLinesCount > 0) {
          this._activeViewZones.push(changeAccessor.addZone({
            afterLineNumber: range.startLineNumber + uiState.newTextLineCount - 1,
            heightInLines: reducedLinesCount,
            showInHiddenAreas: true,
            domNode: $("div.diagonal-fill.inline-edits-view-zone")
          }));
        }
      });
    });
    this._previewEditorWidth = derived(this, (reader) => {
      const edit = this._edit.read(reader);
      if (!edit) {
        return 0;
      }
      this._updatePreviewEditor.read(reader);
      return maxContentWidthInRange(this._previewEditorObs, edit.modifiedLineRange, reader);
    });
    this._cursorPosIfTouchesEdit = derived(this, (reader) => {
      const cursorPos = this._editorObs.cursorPosition.read(reader);
      const edit = this._edit.read(reader);
      if (!edit || !cursorPos) {
        return void 0;
      }
      return edit.modifiedLineRange.contains(cursorPos.lineNumber) ? cursorPos : void 0;
    });
    this._originalStartPosition = derived(this, (reader) => {
      const inlineEdit = this._edit.read(reader);
      return inlineEdit ? new Position(inlineEdit.originalLineRange.startLineNumber, 1) : null;
    });
    this._originalEndPosition = derived(this, (reader) => {
      const inlineEdit = this._edit.read(reader);
      return inlineEdit ? new Position(inlineEdit.originalLineRange.endLineNumberExclusive, 1) : null;
    });
    this._originalVerticalStartPosition = this._editorObs.observePosition(this._originalStartPosition, this._store).map((p) => p?.y);
    this._originalVerticalEndPosition = this._editorObs.observePosition(this._originalEndPosition, this._store).map((p) => p?.y);
    this._originalDisplayRange = this._uiState.map((s) => s?.originalDisplayRange);
    this._editorMaxContentWidthInRange = derived(this, (reader) => {
      const originalDisplayRange = this._originalDisplayRange.read(reader);
      if (!originalDisplayRange) {
        return constObservable(0);
      }
      this._editorObs.versionId.read(reader);
      return derivedObservableWithCache(this, (reader2, lastValue) => {
        const maxWidth = maxContentWidthInRange(this._editorObs, originalDisplayRange, reader2);
        return Math.max(maxWidth, lastValue ?? 0);
      });
    }).map((v, r) => v.read(r));
    this._previewEditorLayoutInfo = derived(this, (reader) => {
      const inlineEdit = this._edit.read(reader);
      if (!inlineEdit) {
        return null;
      }
      const state = this._uiState.read(reader);
      if (!state) {
        return null;
      }
      const range = inlineEdit.originalLineRange;
      const horizontalScrollOffset = this._editorObs.scrollLeft.read(reader);
      const editorContentMaxWidthInRange = this._editorMaxContentWidthInRange.read(reader);
      const editorLayout = this._editorObs.layoutInfo.read(reader);
      const previewContentWidth = this._previewEditorWidth.read(reader);
      const editorContentAreaWidth = editorLayout.contentWidth - editorLayout.verticalScrollbarWidth;
      const editorBoundingClientRect = this._editor.getContainerDomNode().getBoundingClientRect();
      const clientContentAreaRight = editorLayout.contentLeft + editorLayout.contentWidth + editorBoundingClientRect.left;
      const remainingWidthRightOfContent = getWindow(this._editor.getContainerDomNode()).innerWidth - clientContentAreaRight;
      const remainingWidthRightOfEditor = getWindow(this._editor.getContainerDomNode()).innerWidth - editorBoundingClientRect.right;
      const desiredMinimumWidth = Math.min(editorLayout.contentWidth * 0.3, previewContentWidth, 100);
      const IN_EDITOR_DISPLACEMENT = 0;
      const maximumAvailableWidth = IN_EDITOR_DISPLACEMENT + remainingWidthRightOfContent;
      const cursorPos = this._cursorPosIfTouchesEdit.read(reader);
      const maxPreviewEditorLeft = Math.max(
        // We're starting from the content area right and moving it left by IN_EDITOR_DISPLACEMENT and also by an amount to ensure some minimum desired width
        editorContentAreaWidth + horizontalScrollOffset - IN_EDITOR_DISPLACEMENT - Math.max(0, desiredMinimumWidth - maximumAvailableWidth),
        // But we don't want that the moving left ends up covering the cursor, so this will push it to the right again
        Math.min(
          cursorPos ? getOffsetForPos(this._editorObs, cursorPos, reader) + 50 : 0,
          editorContentAreaWidth + horizontalScrollOffset
        )
      );
      const previewEditorLeftInTextArea = Math.min(editorContentMaxWidthInRange + ORIGINAL_END_PADDING, maxPreviewEditorLeft);
      const maxContentWidth = editorContentMaxWidthInRange + ORIGINAL_END_PADDING + previewContentWidth + 70;
      const dist = maxPreviewEditorLeft - previewEditorLeftInTextArea;
      let desiredPreviewEditorScrollLeft;
      let codeRight;
      if (previewEditorLeftInTextArea > horizontalScrollOffset) {
        desiredPreviewEditorScrollLeft = 0;
        codeRight = editorLayout.contentLeft + previewEditorLeftInTextArea - horizontalScrollOffset;
      } else {
        desiredPreviewEditorScrollLeft = horizontalScrollOffset - previewEditorLeftInTextArea;
        codeRight = editorLayout.contentLeft;
      }
      const selectionTop = this._originalVerticalStartPosition.read(reader) ?? this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
      const selectionBottom = this._originalVerticalEndPosition.read(reader) ?? this._editor.getBottomForLineNumber(range.endLineNumberExclusive - 1) - this._editorObs.scrollTop.read(reader);
      const codeLeft = editorLayout.contentLeft - horizontalScrollOffset;
      let codeRect = Rect.fromLeftTopRightBottom(codeLeft, selectionTop, codeRight, selectionBottom);
      const isInsertion = codeRect.height === 0;
      if (!isInsertion) {
        codeRect = codeRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING);
      }
      const editHeight = this._editor.getOption(EditorOption.lineHeight) * inlineEdit.modifiedLineRange.length;
      const codeHeight = selectionBottom - selectionTop;
      const previewEditorHeight = Math.max(codeHeight, editHeight);
      const clipped = dist === 0;
      const codeEditDist = 0;
      const previewEditorWidth = Math.min(previewContentWidth + MODIFIED_END_PADDING, remainingWidthRightOfEditor + editorLayout.width - editorLayout.contentLeft - codeEditDist);
      let editRect = Rect.fromLeftTopWidthHeight(codeRect.right + codeEditDist, selectionTop, previewEditorWidth, previewEditorHeight);
      if (!isInsertion) {
        editRect = editRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING).translateX(HORIZONTAL_PADDING + BORDER_WIDTH);
      } else {
        editRect = editRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING).translateY(VERTICAL_PADDING);
      }
      return {
        codeRect,
        editRect,
        codeScrollLeft: horizontalScrollOffset,
        contentLeft: editorLayout.contentLeft,
        isInsertion,
        maxContentWidth,
        shouldShowShadow: clipped,
        desiredPreviewEditorScrollLeft,
        previewEditorWidth
      };
    });
    this._stickyScrollController = StickyScrollController.get(this._editorObs.editor);
    this._stickyScrollHeight = this._stickyScrollController ? observableFromEvent(this._stickyScrollController.onDidChangeStickyScrollHeight, () => this._stickyScrollController.stickyScrollWidgetHeight) : constObservable(0);
    this._shouldOverflow = derived((reader) => {
      if (!ENABLE_OVERFLOW) {
        return false;
      }
      const range = this._edit.read(reader)?.originalLineRange;
      if (!range) {
        return false;
      }
      const stickyScrollHeight = this._stickyScrollHeight.read(reader);
      const top = this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
      if (top <= stickyScrollHeight) {
        return false;
      }
      const bottom = this._editor.getTopForLineNumber(range.endLineNumberExclusive) - this._editorObs.scrollTop.read(reader);
      if (bottom >= this._editorObs.layoutInfo.read(reader).height) {
        return false;
      }
      return true;
    });
    this._originalBackgroundColor = observableFromEvent(this, this._themeService.onDidColorThemeChange, () => {
      return this._themeService.getColorTheme().getColor(originalBackgroundColor) ?? Color.transparent;
    });
    this._backgroundSvg = n.svg({
      transform: "translate(-0.5 -0.5)",
      style: { overflow: "visible", pointerEvents: "none", position: "absolute" }
    }, [
      n.svgElem("path", {
        class: "rightOfModifiedBackgroundCoverUp",
        d: derived((reader) => {
          const layoutInfo = this._previewEditorLayoutInfo.read(reader);
          if (!layoutInfo) {
            return void 0;
          }
          const originalBackgroundColor2 = this._originalBackgroundColor.read(reader);
          if (originalBackgroundColor2.isTransparent()) {
            return void 0;
          }
          return new PathBuilder().moveTo(layoutInfo.codeRect.getRightTop()).lineTo(layoutInfo.codeRect.getRightTop().deltaX(1e3)).lineTo(layoutInfo.codeRect.getRightBottom().deltaX(1e3)).lineTo(layoutInfo.codeRect.getRightBottom()).build();
        }),
        style: {
          fill: asCssVariableWithDefault(editorBackground, "transparent")
        }
      })
    ]).keepUpdated(this._store);
    this._originalOverlay = n.div({
      style: { pointerEvents: "none", display: this._previewEditorLayoutInfo.map((layoutInfo) => layoutInfo?.isInsertion ? "none" : "block") }
    }, derived((reader) => {
      const layoutInfoObs = mapOutFalsy(this._previewEditorLayoutInfo).read(reader);
      if (!layoutInfoObs) {
        return void 0;
      }
      const borderStyling = getOriginalBorderColor(this._tabAction).map((bc) => `${BORDER_WIDTH}px solid ${asCssVariable(bc)}`);
      const borderStylingSeparator = `${BORDER_WIDTH + WIDGET_SEPARATOR_WIDTH}px solid ${asCssVariable(editorBackground)}`;
      const hasBorderLeft = layoutInfoObs.read(reader).codeScrollLeft !== 0;
      const isModifiedLower = layoutInfoObs.map((layoutInfo) => layoutInfo.codeRect.bottom < layoutInfo.editRect.bottom);
      const transitionRectSize = BORDER_RADIUS * 2 + BORDER_WIDTH * 2;
      const overlayHider = layoutInfoObs.map((layoutInfo) => Rect.fromLeftTopRightBottom(
        layoutInfo.contentLeft - BORDER_RADIUS - BORDER_WIDTH,
        layoutInfo.codeRect.top,
        layoutInfo.contentLeft,
        layoutInfo.codeRect.bottom + transitionRectSize
      )).read(reader);
      const intersectionLine = new OffsetRange(overlayHider.left, Number.MAX_SAFE_INTEGER);
      const overlayRect = layoutInfoObs.map((layoutInfo) => layoutInfo.codeRect.intersectHorizontal(intersectionLine));
      const separatorRect = overlayRect.map((overlayRect2) => overlayRect2.withMargin(WIDGET_SEPARATOR_WIDTH, 0, WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH).intersectHorizontal(intersectionLine));
      const transitionRect = overlayRect.map((overlayRect2) => Rect.fromLeftTopWidthHeight(overlayRect2.right - transitionRectSize + BORDER_WIDTH, overlayRect2.bottom - BORDER_WIDTH, transitionRectSize, transitionRectSize).intersectHorizontal(intersectionLine));
      return [
        n.div({
          class: "originalSeparatorSideBySide",
          style: {
            ...separatorRect.read(reader).toStyles(),
            boxSizing: "border-box",
            borderRadius: `${BORDER_RADIUS}px 0 0 ${BORDER_RADIUS}px`,
            borderTop: borderStylingSeparator,
            borderBottom: borderStylingSeparator,
            borderLeft: hasBorderLeft ? "none" : borderStylingSeparator
          }
        }),
        n.div({
          class: "originalOverlaySideBySide",
          style: {
            ...overlayRect.read(reader).toStyles(),
            boxSizing: "border-box",
            borderRadius: `${BORDER_RADIUS}px 0 0 ${BORDER_RADIUS}px`,
            borderTop: borderStyling,
            borderBottom: borderStyling,
            borderLeft: hasBorderLeft ? "none" : borderStyling,
            backgroundColor: asCssVariable(originalBackgroundColor)
          }
        }),
        n.div({
          class: "originalCornerCutoutSideBySide",
          style: {
            pointerEvents: "none",
            display: isModifiedLower.map((isLower) => isLower ? "block" : "none"),
            ...transitionRect.read(reader).toStyles()
          }
        }, [
          n.div({
            class: "originalCornerCutoutBackground",
            style: {
              position: "absolute",
              top: "0px",
              left: "0px",
              width: "100%",
              height: "100%",
              backgroundColor: getEditorBlendedColor(originalBackgroundColor, this._themeService).map((c) => c.toString())
            }
          }),
          n.div({
            class: "originalCornerCutoutBorder",
            style: {
              position: "absolute",
              top: "0px",
              left: "0px",
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              borderTop: borderStyling,
              borderRight: borderStyling,
              borderRadius: `0 100% 0 0`,
              backgroundColor: asCssVariable(editorBackground)
            }
          })
        ]),
        n.div({
          class: "originalOverlaySideBySideHider",
          style: {
            ...overlayHider.toStyles(),
            backgroundColor: asCssVariable(editorBackground)
          }
        })
      ];
    })).keepUpdated(this._store);
    this._modifiedOverlay = n.div({
      style: { pointerEvents: "none" }
    }, derived((reader) => {
      const layoutInfoObs = mapOutFalsy(this._previewEditorLayoutInfo).read(reader);
      if (!layoutInfoObs) {
        return void 0;
      }
      const isModifiedLower = layoutInfoObs.map((layoutInfo) => layoutInfo.codeRect.bottom < layoutInfo.editRect.bottom);
      const borderRadius = isModifiedLower.map((isLower) => `0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px ${isLower ? BORDER_RADIUS : 0}px`);
      const borderStyling = getEditorBlendedColor(getModifiedBorderColor(this._tabAction), this._themeService).map((c) => `1px solid ${c.toString()}`);
      const borderStylingSeparator = `${BORDER_WIDTH + WIDGET_SEPARATOR_WIDTH}px solid ${asCssVariable(editorBackground)}`;
      const overlayRect = layoutInfoObs.map((layoutInfo) => layoutInfo.editRect.withMargin(0, BORDER_WIDTH));
      const separatorRect = overlayRect.map((overlayRect2) => overlayRect2.withMargin(WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH, 0));
      const insertionRect = derived((reader2) => {
        const overlay = overlayRect.read(reader2);
        const layoutinfo = layoutInfoObs.read(reader2);
        if (!layoutinfo.isInsertion || layoutinfo.contentLeft >= overlay.left) {
          return Rect.fromLeftTopWidthHeight(overlay.left, overlay.top, 0, 0);
        }
        return new Rect(layoutinfo.contentLeft, overlay.top, overlay.left, overlay.top + BORDER_WIDTH * 2);
      });
      return [
        n.div({
          class: "modifiedInsertionSideBySide",
          style: {
            ...insertionRect.read(reader).toStyles(),
            backgroundColor: getModifiedBorderColor(this._tabAction).map((c) => asCssVariable(c))
          }
        }),
        n.div({
          class: "modifiedSeparatorSideBySide",
          style: {
            ...separatorRect.read(reader).toStyles(),
            borderRadius,
            borderTop: borderStylingSeparator,
            borderBottom: borderStylingSeparator,
            borderRight: borderStylingSeparator,
            boxSizing: "border-box"
          }
        }),
        n.div({
          class: "modifiedOverlaySideBySide",
          style: {
            ...overlayRect.read(reader).toStyles(),
            borderRadius,
            border: borderStyling,
            boxSizing: "border-box",
            backgroundColor: asCssVariable(modifiedBackgroundColor)
          }
        })
      ];
    })).keepUpdated(this._store);
    this._nonOverflowView = n.div({
      class: "inline-edits-view",
      style: {
        position: "absolute",
        overflow: "visible",
        top: "0px",
        left: "0px",
        zIndex: "0",
        display: this._display
      }
    }, [
      this._backgroundSvg,
      derived(this, (reader) => this._shouldOverflow.read(reader) ? [] : [this._editorContainer, this._originalOverlay, this._modifiedOverlay])
    ]).keepUpdated(this._store);
    this._register(this._editorObs.createOverlayWidget({
      domNode: this._nonOverflowView.element,
      position: constObservable(null),
      allowEditorOverflow: false,
      minContentWidthInPx: derived((reader) => {
        const x = this._previewEditorLayoutInfo.read(reader)?.maxContentWidth;
        if (x === void 0) {
          return 0;
        }
        return x;
      })
    }));
    this.previewEditor.setModel(this._previewTextModel);
    this._register(autorun((reader) => {
      const layoutInfo = this._previewEditorLayoutInfo.read(reader);
      if (!layoutInfo) {
        return;
      }
      const editorRect = layoutInfo.editRect.withMargin(-VERTICAL_PADDING, -HORIZONTAL_PADDING);
      this.previewEditor.layout({
        height: editorRect.height,
        width: layoutInfo.previewEditorWidth + 15
        /* Make sure editor does not scroll horizontally */
      });
      this._editorContainer.element.style.top = `${editorRect.top}px`;
      this._editorContainer.element.style.left = `${editorRect.left}px`;
      this._editorContainer.element.style.width = `${layoutInfo.previewEditorWidth + HORIZONTAL_PADDING}px`;
    }));
    this._register(autorun((reader) => {
      const layoutInfo = this._previewEditorLayoutInfo.read(reader);
      if (!layoutInfo) {
        return;
      }
      this._previewEditorObs.editor.setScrollLeft(layoutInfo.desiredPreviewEditorScrollLeft);
    }));
    this._updatePreviewEditor.recomputeInitiallyAndOnChange(this._store);
  }
  // This is an approximation and should be improved by using the real parameters used bellow
  static fitsInsideViewport(editor, textModel, edit, originalDisplayRange, reader) {
    const editorObs = observableCodeEditor(editor);
    const editorWidth = editorObs.layoutInfoWidth.read(reader);
    const editorContentLeft = editorObs.layoutInfoContentLeft.read(reader);
    const editorVerticalScrollbar = editor.getLayoutInfo().verticalScrollbarWidth;
    const minimapWidth = editorObs.layoutInfoMinimap.read(reader).minimapLeft !== 0 ? editorObs.layoutInfoMinimap.read(reader).minimapWidth : 0;
    const maxOriginalContent = maxContentWidthInRange(
      editorObs,
      originalDisplayRange,
      void 0
      /* do not reconsider on each layout info change */
    );
    const maxModifiedContent = edit.lineEdit.newLines.reduce((max, line) => Math.max(max, getContentRenderWidth(line, editor, textModel)), 0);
    const originalPadding = ORIGINAL_END_PADDING;
    const modifiedPadding = MODIFIED_END_PADDING + 2 * BORDER_WIDTH;
    return maxOriginalContent + maxModifiedContent + originalPadding + modifiedPadding < editorWidth - editorContentLeft - editorVerticalScrollbar - minimapWidth;
  }
};
InlineEditsSideBySideView = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IThemeService)
], InlineEditsSideBySideView);
export {
  InlineEditsSideBySideView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c1NpZGVCeVNpZGVWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7ICQsIGdldFdpbmRvdywgbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSU1vdXNlRXZlbnQsIFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIElSZWFkZXIsIGF1dG9ydW4sIGNvbnN0T2JzZXJ2YWJsZSwgZGVyaXZlZCwgZGVyaXZlZE9ic2VydmFibGVXaXRoQ2FjaGUsIG9ic2VydmFibGVGcm9tRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgZWRpdG9yQmFja2dyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIGFzQ3NzVmFyaWFibGVXaXRoRGVmYXVsdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclV0aWxzLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBSZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9yZWN0LmpzJztcbmltcG9ydCB7IEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgT2Zmc2V0UmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9vZmZzZXRSYW5nZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBTdGlja3lTY3JvbGxDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc3RpY2t5U2Nyb2xsL2Jyb3dzZXIvc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb250cm9sbGVyL2lubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJSW5saW5lRWRpdHNWaWV3LCBJbmxpbmVFZGl0VGFiQWN0aW9uIH0gZnJvbSAnLi4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IElubGluZUVkaXRXaXRoQ2hhbmdlcyB9IGZyb20gJy4uL2lubGluZUVkaXRXaXRoQ2hhbmdlcy5qcyc7XG5pbXBvcnQgeyBnZXRFZGl0b3JCbGVuZGVkQ29sb3IsIGdldE1vZGlmaWVkQm9yZGVyQ29sb3IsIGdldE9yaWdpbmFsQm9yZGVyQ29sb3IsIG1vZGlmaWVkQmFja2dyb3VuZENvbG9yLCBvcmlnaW5hbEJhY2tncm91bmRDb2xvciB9IGZyb20gJy4uL3RoZW1lLmpzJztcbmltcG9ydCB7IFBhdGhCdWlsZGVyLCBnZXRDb250ZW50UmVuZGVyV2lkdGgsIGdldE9mZnNldEZvclBvcywgbWFwT3V0RmFsc3ksIG1heENvbnRlbnRXaWR0aEluUmFuZ2UgfSBmcm9tICcuLi91dGlscy91dGlscy5qcyc7XG5cbmNvbnN0IEhPUklaT05UQUxfUEFERElORyA9IDA7XG5jb25zdCBWRVJUSUNBTF9QQURESU5HID0gMDtcbmNvbnN0IEVOQUJMRV9PVkVSRkxPVyA9IGZhbHNlO1xuXG5jb25zdCBCT1JERVJfV0lEVEggPSAxO1xuY29uc3QgV0lER0VUX1NFUEFSQVRPUl9XSURUSCA9IDE7XG5jb25zdCBCT1JERVJfUkFESVVTID0gNDtcbmNvbnN0IE9SSUdJTkFMX0VORF9QQURESU5HID0gMjA7XG5jb25zdCBNT0RJRklFRF9FTkRfUEFERElORyA9IDEyO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lRWRpdHNTaWRlQnlTaWRlVmlldyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJSW5saW5lRWRpdHNWaWV3IHtcblxuXHQvLyBUaGlzIGlzIGFuIGFwcHJveGltYXRpb24gYW5kIHNob3VsZCBiZSBpbXByb3ZlZCBieSB1c2luZyB0aGUgcmVhbCBwYXJhbWV0ZXJzIHVzZWQgYmVsbG93XG5cdHN0YXRpYyBmaXRzSW5zaWRlVmlld3BvcnQoZWRpdG9yOiBJQ29kZUVkaXRvciwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsLCBlZGl0OiBJbmxpbmVFZGl0V2l0aENoYW5nZXMsIG9yaWdpbmFsRGlzcGxheVJhbmdlOiBMaW5lUmFuZ2UsIHJlYWRlcjogSVJlYWRlcik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGVkaXRvck9icyA9IG9ic2VydmFibGVDb2RlRWRpdG9yKGVkaXRvcik7XG5cdFx0Y29uc3QgZWRpdG9yV2lkdGggPSBlZGl0b3JPYnMubGF5b3V0SW5mb1dpZHRoLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBlZGl0b3JDb250ZW50TGVmdCA9IGVkaXRvck9icy5sYXlvdXRJbmZvQ29udGVudExlZnQucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGVkaXRvclZlcnRpY2FsU2Nyb2xsYmFyID0gZWRpdG9yLmdldExheW91dEluZm8oKS52ZXJ0aWNhbFNjcm9sbGJhcldpZHRoO1xuXHRcdGNvbnN0IG1pbmltYXBXaWR0aCA9IGVkaXRvck9icy5sYXlvdXRJbmZvTWluaW1hcC5yZWFkKHJlYWRlcikubWluaW1hcExlZnQgIT09IDAgPyBlZGl0b3JPYnMubGF5b3V0SW5mb01pbmltYXAucmVhZChyZWFkZXIpLm1pbmltYXBXaWR0aCA6IDA7XG5cblx0XHRjb25zdCBtYXhPcmlnaW5hbENvbnRlbnQgPSBtYXhDb250ZW50V2lkdGhJblJhbmdlKGVkaXRvck9icywgb3JpZ2luYWxEaXNwbGF5UmFuZ2UsIHVuZGVmaW5lZC8qIGRvIG5vdCByZWNvbnNpZGVyIG9uIGVhY2ggbGF5b3V0IGluZm8gY2hhbmdlICovKTtcblx0XHRjb25zdCBtYXhNb2RpZmllZENvbnRlbnQgPSBlZGl0LmxpbmVFZGl0Lm5ld0xpbmVzLnJlZHVjZSgobWF4LCBsaW5lKSA9PiBNYXRoLm1heChtYXgsIGdldENvbnRlbnRSZW5kZXJXaWR0aChsaW5lLCBlZGl0b3IsIHRleHRNb2RlbCkpLCAwKTtcblx0XHRjb25zdCBvcmlnaW5hbFBhZGRpbmcgPSBPUklHSU5BTF9FTkRfUEFERElORzsgLy8gcGFkZGluZyBhZnRlciBsYXN0IGxpbmUgb2Ygb3JpZ2luYWwgZWRpdG9yXG5cdFx0Y29uc3QgbW9kaWZpZWRQYWRkaW5nID0gTU9ESUZJRURfRU5EX1BBRERJTkcgKyAyICogQk9SREVSX1dJRFRIOyAvLyBwYWRkaW5nIGFmdGVyIGxhc3QgbGluZSBvZiBtb2RpZmllZCBlZGl0b3JcblxuXHRcdHJldHVybiBtYXhPcmlnaW5hbENvbnRlbnQgKyBtYXhNb2RpZmllZENvbnRlbnQgKyBvcmlnaW5hbFBhZGRpbmcgKyBtb2RpZmllZFBhZGRpbmcgPCBlZGl0b3JXaWR0aCAtIGVkaXRvckNvbnRlbnRMZWZ0IC0gZWRpdG9yVmVydGljYWxTY3JvbGxiYXIgLSBtaW5pbWFwV2lkdGg7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JPYnMgPSBvYnNlcnZhYmxlQ29kZUVkaXRvcih0aGlzLl9lZGl0b3IpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2xpY2sgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTW91c2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2xpY2sgPSB0aGlzLl9vbkRpZENsaWNrLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdDogSU9ic2VydmFibGU8SW5saW5lRWRpdFdpdGhDaGFuZ2VzIHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcmV2aWV3VGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VpU3RhdGU6IElPYnNlcnZhYmxlPHtcblx0XHRcdG5ld1RleHRMaW5lQ291bnQ6IG51bWJlcjtcblx0XHRcdG9yaWdpbmFsRGlzcGxheVJhbmdlOiBMaW5lUmFuZ2U7XG5cdFx0fSB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGFiQWN0aW9uOiBJT2JzZXJ2YWJsZTxJbmxpbmVFZGl0VGFiQWN0aW9uPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yT2JzLmNyZWF0ZU92ZXJsYXlXaWRnZXQoe1xuXHRcdFx0ZG9tTm9kZTogdGhpcy5fbm9uT3ZlcmZsb3dWaWV3LmVsZW1lbnQsXG5cdFx0XHRwb3NpdGlvbjogY29uc3RPYnNlcnZhYmxlKG51bGwpLFxuXHRcdFx0YWxsb3dFZGl0b3JPdmVyZmxvdzogZmFsc2UsXG5cdFx0XHRtaW5Db250ZW50V2lkdGhJblB4OiBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRcdGNvbnN0IHggPSB0aGlzLl9wcmV2aWV3RWRpdG9yTGF5b3V0SW5mby5yZWFkKHJlYWRlcik/Lm1heENvbnRlbnRXaWR0aDtcblx0XHRcdFx0aWYgKHggPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gMDsgfVxuXHRcdFx0XHRyZXR1cm4geDtcblx0XHRcdH0pLFxuXHRcdH0pKTtcblxuXHRcdHRoaXMucHJldmlld0VkaXRvci5zZXRNb2RlbCh0aGlzLl9wcmV2aWV3VGV4dE1vZGVsKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLl9wcmV2aWV3RWRpdG9yTGF5b3V0SW5mby5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIWxheW91dEluZm8pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZWRpdG9yUmVjdCA9IGxheW91dEluZm8uZWRpdFJlY3Qud2l0aE1hcmdpbigtVkVSVElDQUxfUEFERElORywgLUhPUklaT05UQUxfUEFERElORyk7XG5cblx0XHRcdHRoaXMucHJldmlld0VkaXRvci5sYXlvdXQoeyBoZWlnaHQ6IGVkaXRvclJlY3QuaGVpZ2h0LCB3aWR0aDogbGF5b3V0SW5mby5wcmV2aWV3RWRpdG9yV2lkdGggKyAxNSAvKiBNYWtlIHN1cmUgZWRpdG9yIGRvZXMgbm90IHNjcm9sbCBob3Jpem9udGFsbHkgKi8gfSk7XG5cdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuZWxlbWVudC5zdHlsZS50b3AgPSBgJHtlZGl0b3JSZWN0LnRvcH1weGA7XG5cdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuZWxlbWVudC5zdHlsZS5sZWZ0ID0gYCR7ZWRpdG9yUmVjdC5sZWZ0fXB4YDtcblx0XHRcdHRoaXMuX2VkaXRvckNvbnRhaW5lci5lbGVtZW50LnN0eWxlLndpZHRoID0gYCR7bGF5b3V0SW5mby5wcmV2aWV3RWRpdG9yV2lkdGggKyBIT1JJWk9OVEFMX1BBRERJTkd9cHhgOyAvLyBTZXQgd2lkdGggdG8gY2xpcCB2aWV3IHpvbmVcblx0XHRcdC8vdGhpcy5fZWRpdG9yQ29udGFpbmVyLmVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gYDAgJHtCT1JERVJfUkFESVVTfXB4ICR7Qk9SREVSX1JBRElVU31weCAwYDtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBsYXlvdXRJbmZvID0gdGhpcy5fcHJldmlld0VkaXRvckxheW91dEluZm8ucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFsYXlvdXRJbmZvKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcHJldmlld0VkaXRvck9icy5lZGl0b3Iuc2V0U2Nyb2xsTGVmdChsYXlvdXRJbmZvLmRlc2lyZWRQcmV2aWV3RWRpdG9yU2Nyb2xsTGVmdCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fdXBkYXRlUHJldmlld0VkaXRvci5yZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9zdG9yZSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwbGF5ID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gISF0aGlzLl91aVN0YXRlLnJlYWQocmVhZGVyKSA/ICdibG9jaycgOiAnbm9uZScpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJldmlld1JlZiA9IG4ucmVmPEhUTUxEaXZFbGVtZW50PigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvckNvbnRhaW5lciA9IG4uZGl2KHtcblx0XHRjbGFzczogWydlZGl0b3JDb250YWluZXInXSxcblx0XHRzdHlsZTogeyBwb3NpdGlvbjogJ2Fic29sdXRlJywgb3ZlcmZsb3c6ICdoaWRkZW4nLCBjdXJzb3I6ICdwb2ludGVyJyB9LFxuXHRcdG9ubW91c2Vkb3duOiBlID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTsgLy8gVGhpcyBwcmV2ZW50cyB0aGF0IHRoZSBlZGl0b3IgbG9zZXMgZm9jdXNcblx0XHR9LFxuXHRcdG9uY2xpY2s6IChlKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENsaWNrLmZpcmUobmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3coZSksIGUpKTtcblx0XHR9XG5cdH0sIFtcblx0XHRuLmRpdih7IGNsYXNzOiAncHJldmlldycsIHN0eWxlOiB7IHBvaW50ZXJFdmVudHM6ICdub25lJyB9LCByZWY6IHRoaXMucHJldmlld1JlZiB9KSxcblx0XSkua2VlcFVwZGF0ZWQodGhpcy5fc3RvcmUpO1xuXG5cdHB1YmxpYyByZWFkb25seSBpc0hvdmVyZWQgPSB0aGlzLl9lZGl0b3JDb250YWluZXIuZGlkTW91c2VNb3ZlRHVyaW5nSG92ZXI7XG5cblx0cHVibGljIHJlYWRvbmx5IHByZXZpZXdFZGl0b3IgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQsXG5cdFx0dGhpcy5wcmV2aWV3UmVmLmVsZW1lbnQsXG5cdFx0e1xuXHRcdFx0Z2x5cGhNYXJnaW46IGZhbHNlLFxuXHRcdFx0bGluZU51bWJlcnM6ICdvZmYnLFxuXHRcdFx0bWluaW1hcDogeyBlbmFibGVkOiBmYWxzZSB9LFxuXHRcdFx0Z3VpZGVzOiB7XG5cdFx0XHRcdGluZGVudGF0aW9uOiBmYWxzZSxcblx0XHRcdFx0YnJhY2tldFBhaXJzOiBmYWxzZSxcblx0XHRcdFx0YnJhY2tldFBhaXJzSG9yaXpvbnRhbDogZmFsc2UsXG5cdFx0XHRcdGhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uOiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRydWxlcnM6IFtdLFxuXHRcdFx0cGFkZGluZzogeyB0b3A6IDAsIGJvdHRvbTogMCB9LFxuXHRcdFx0Zm9sZGluZzogZmFsc2UsXG5cdFx0XHRzZWxlY3RPbkxpbmVOdW1iZXJzOiBmYWxzZSxcblx0XHRcdHNlbGVjdGlvbkhpZ2hsaWdodDogZmFsc2UsXG5cdFx0XHRjb2x1bW5TZWxlY3Rpb246IGZhbHNlLFxuXHRcdFx0b3ZlcnZpZXdSdWxlckJvcmRlcjogZmFsc2UsXG5cdFx0XHRvdmVydmlld1J1bGVyTGFuZXM6IDAsXG5cdFx0XHRsaW5lRGVjb3JhdGlvbnNXaWR0aDogMCxcblx0XHRcdGxpbmVOdW1iZXJzTWluQ2hhcnM6IDAsXG5cdFx0XHRyZXZlYWxIb3Jpem9udGFsUmlnaHRQYWRkaW5nOiAwLFxuXHRcdFx0YnJhY2tldFBhaXJDb2xvcml6YXRpb246IHsgZW5hYmxlZDogdHJ1ZSwgaW5kZXBlbmRlbnRDb2xvclBvb2xQZXJCcmFja2V0VHlwZTogZmFsc2UgfSxcblx0XHRcdHNjcm9sbEJleW9uZExhc3RMaW5lOiBmYWxzZSxcblx0XHRcdHNjcm9sbGJhcjoge1xuXHRcdFx0XHR2ZXJ0aWNhbDogJ2hpZGRlbicsXG5cdFx0XHRcdGhvcml6b250YWw6ICdoaWRkZW4nLFxuXHRcdFx0XHRoYW5kbGVNb3VzZVdoZWVsOiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRyZWFkT25seTogdHJ1ZSxcblx0XHRcdHdvcmRXcmFwOiAnb2ZmJyxcblx0XHRcdHdvcmRXcmFwT3ZlcnJpZGUxOiAnb2ZmJyxcblx0XHRcdHdvcmRXcmFwT3ZlcnJpZGUyOiAnb2ZmJyxcblx0XHR9LFxuXHRcdHtcblx0XHRcdGNvbnRleHRLZXlWYWx1ZXM6IHtcblx0XHRcdFx0W0lubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbklubGluZUVkaXRzUHJldmlld0VkaXRvci5rZXldOiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdGNvbnRyaWJ1dGlvbnM6IFtdLFxuXHRcdH0sXG5cdFx0dGhpcy5fZWRpdG9yXG5cdCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3ByZXZpZXdFZGl0b3JPYnMgPSBvYnNlcnZhYmxlQ29kZUVkaXRvcih0aGlzLnByZXZpZXdFZGl0b3IpO1xuXG5cdHByaXZhdGUgX2FjdGl2ZVZpZXdab25lczogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfdXBkYXRlUHJldmlld0VkaXRvciA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIucmVhZEVmZmVjdChyZWFkZXIpO1xuXHRcdHRoaXMuX3ByZXZpZXdFZGl0b3JPYnMubW9kZWwucmVhZChyZWFkZXIpOyAvLyB1cGRhdGUgd2hlbiB0aGUgbW9kZWwgaXMgc2V0XG5cblx0XHQvLyBTZXR0aW5nIHRoaXMgaGVyZSBleHBsaWNpdGx5IHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSBwcmV2aWV3IGVkaXRvciBpc1xuXHRcdC8vIHZpc2libGUgd2hlbiBuZWVkZWQsIHdlJ3JlIGFsc28gY2hlY2tpbmcgdGhhdCB0aGVzZSBmaWVsZHMgYXJlIGRlZmluZWRcblx0XHQvLyBiZWNhdXNlIG9mIHRoZSBhdXRvIHJ1biBpbml0aWFsXG5cdFx0Ly8gQmVmb3JlIHJlbW92aW5nIHRoZXNlLCB2ZXJpZnkgd2l0aCBhIG5vbi1tb25vc3BhY2UgZm9udCBmYW1pbHlcblx0XHR0aGlzLl9kaXNwbGF5LnJlYWQocmVhZGVyKTtcblx0XHRpZiAodGhpcy5fbm9uT3ZlcmZsb3dWaWV3KSB7XG5cdFx0XHR0aGlzLl9ub25PdmVyZmxvd1ZpZXcuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gdGhpcy5fZGlzcGxheS5yZWFkKHJlYWRlcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdWlTdGF0ZSA9IHRoaXMuX3VpU3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGVkaXQgPSB0aGlzLl9lZGl0LnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXVpU3RhdGUgfHwgIWVkaXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByYW5nZSA9IGVkaXQub3JpZ2luYWxMaW5lUmFuZ2U7XG5cblx0XHRjb25zdCBoaWRkZW5BcmVhczogUmFuZ2VbXSA9IFtdO1xuXHRcdGlmIChyYW5nZS5zdGFydExpbmVOdW1iZXIgPiAxKSB7XG5cdFx0XHRoaWRkZW5BcmVhcy5wdXNoKG5ldyBSYW5nZSgxLCAxLCByYW5nZS5zdGFydExpbmVOdW1iZXIgLSAxLCAxKSk7XG5cdFx0fVxuXHRcdGlmIChyYW5nZS5zdGFydExpbmVOdW1iZXIgKyB1aVN0YXRlLm5ld1RleHRMaW5lQ291bnQgPCB0aGlzLl9wcmV2aWV3VGV4dE1vZGVsLmdldExpbmVDb3VudCgpICsgMSkge1xuXHRcdFx0aGlkZGVuQXJlYXMucHVzaChuZXcgUmFuZ2UocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgdWlTdGF0ZS5uZXdUZXh0TGluZUNvdW50LCAxLCB0aGlzLl9wcmV2aWV3VGV4dE1vZGVsLmdldExpbmVDb3VudCgpICsgMSwgMSkpO1xuXHRcdH1cblxuXHRcdHRoaXMucHJldmlld0VkaXRvci5zZXRIaWRkZW5BcmVhcyhoaWRkZW5BcmVhcywgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdC8vIFRPRE86IGlzIHRoaXMgdGhlIHByb3BlciB3YXkgdG8gaGFuZGxlIHZpZXd6b25lcz9cblx0XHRjb25zdCBwcmV2aW91c1ZpZXdab25lcyA9IFsuLi50aGlzLl9hY3RpdmVWaWV3Wm9uZXNdO1xuXHRcdHRoaXMuX2FjdGl2ZVZpZXdab25lcyA9IFtdO1xuXG5cdFx0Y29uc3QgcmVkdWNlZExpbmVzQ291bnQgPSAocmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSAtIHJhbmdlLnN0YXJ0TGluZU51bWJlcikgLSB1aVN0YXRlLm5ld1RleHRMaW5lQ291bnQ7XG5cdFx0dGhpcy5wcmV2aWV3RWRpdG9yLmNoYW5nZVZpZXdab25lcygoY2hhbmdlQWNjZXNzb3IpID0+IHtcblx0XHRcdHByZXZpb3VzVmlld1pvbmVzLmZvckVhY2goaWQgPT4gY2hhbmdlQWNjZXNzb3IucmVtb3ZlWm9uZShpZCkpO1xuXG5cdFx0XHRpZiAocmVkdWNlZExpbmVzQ291bnQgPiAwKSB7XG5cdFx0XHRcdHRoaXMuX2FjdGl2ZVZpZXdab25lcy5wdXNoKGNoYW5nZUFjY2Vzc29yLmFkZFpvbmUoe1xuXHRcdFx0XHRcdGFmdGVyTGluZU51bWJlcjogcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgdWlTdGF0ZS5uZXdUZXh0TGluZUNvdW50IC0gMSxcblx0XHRcdFx0XHRoZWlnaHRJbkxpbmVzOiByZWR1Y2VkTGluZXNDb3VudCxcblx0XHRcdFx0XHRzaG93SW5IaWRkZW5BcmVhczogdHJ1ZSxcblx0XHRcdFx0XHRkb21Ob2RlOiAkKCdkaXYuZGlhZ29uYWwtZmlsbC5pbmxpbmUtZWRpdHMtdmlldy16b25lJyksXG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJldmlld0VkaXRvcldpZHRoID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGVkaXQgPSB0aGlzLl9lZGl0LnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIWVkaXQpIHsgcmV0dXJuIDA7IH1cblx0XHR0aGlzLl91cGRhdGVQcmV2aWV3RWRpdG9yLnJlYWQocmVhZGVyKTtcblxuXHRcdHJldHVybiBtYXhDb250ZW50V2lkdGhJblJhbmdlKHRoaXMuX3ByZXZpZXdFZGl0b3JPYnMsIGVkaXQubW9kaWZpZWRMaW5lUmFuZ2UsIHJlYWRlcik7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnNvclBvc0lmVG91Y2hlc0VkaXQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgY3Vyc29yUG9zID0gdGhpcy5fZWRpdG9yT2JzLmN1cnNvclBvc2l0aW9uLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBlZGl0ID0gdGhpcy5fZWRpdC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFlZGl0IHx8ICFjdXJzb3JQb3MpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdHJldHVybiBlZGl0Lm1vZGlmaWVkTGluZVJhbmdlLmNvbnRhaW5zKGN1cnNvclBvcy5saW5lTnVtYmVyKSA/IGN1cnNvclBvcyA6IHVuZGVmaW5lZDtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxTdGFydFBvc2l0aW9uID0gZGVyaXZlZCh0aGlzLCAocmVhZGVyKSA9PiB7XG5cdFx0Y29uc3QgaW5saW5lRWRpdCA9IHRoaXMuX2VkaXQucmVhZChyZWFkZXIpO1xuXHRcdHJldHVybiBpbmxpbmVFZGl0ID8gbmV3IFBvc2l0aW9uKGlubGluZUVkaXQub3JpZ2luYWxMaW5lUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKSA6IG51bGw7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsRW5kUG9zaXRpb24gPSBkZXJpdmVkKHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHRjb25zdCBpbmxpbmVFZGl0ID0gdGhpcy5fZWRpdC5yZWFkKHJlYWRlcik7XG5cdFx0cmV0dXJuIGlubGluZUVkaXQgPyBuZXcgUG9zaXRpb24oaW5saW5lRWRpdC5vcmlnaW5hbExpbmVSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlLCAxKSA6IG51bGw7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsVmVydGljYWxTdGFydFBvc2l0aW9uID0gdGhpcy5fZWRpdG9yT2JzLm9ic2VydmVQb3NpdGlvbih0aGlzLl9vcmlnaW5hbFN0YXJ0UG9zaXRpb24sIHRoaXMuX3N0b3JlKS5tYXAocCA9PiBwPy55KTtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxWZXJ0aWNhbEVuZFBvc2l0aW9uID0gdGhpcy5fZWRpdG9yT2JzLm9ic2VydmVQb3NpdGlvbih0aGlzLl9vcmlnaW5hbEVuZFBvc2l0aW9uLCB0aGlzLl9zdG9yZSkubWFwKHAgPT4gcD8ueSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxEaXNwbGF5UmFuZ2UgPSB0aGlzLl91aVN0YXRlLm1hcChzID0+IHM/Lm9yaWdpbmFsRGlzcGxheVJhbmdlKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yTWF4Q29udGVudFdpZHRoSW5SYW5nZSA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbERpc3BsYXlSYW5nZSA9IHRoaXMuX29yaWdpbmFsRGlzcGxheVJhbmdlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIW9yaWdpbmFsRGlzcGxheVJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gY29uc3RPYnNlcnZhYmxlKDApO1xuXHRcdH1cblx0XHR0aGlzLl9lZGl0b3JPYnMudmVyc2lvbklkLnJlYWQocmVhZGVyKTtcblxuXHRcdC8vIFRha2UgdGhlIG1heCB2YWx1ZSB0aGF0IHdlIG9ic2VydmVkLlxuXHRcdC8vIFJlc2V0IHdoZW4gZWl0aGVyIHRoZSBlZGl0IGNoYW5nZXMgb3IgdGhlIGVkaXRvciB0ZXh0IHZlcnNpb24uXG5cdFx0cmV0dXJuIGRlcml2ZWRPYnNlcnZhYmxlV2l0aENhY2hlPG51bWJlcj4odGhpcywgKHJlYWRlciwgbGFzdFZhbHVlKSA9PiB7XG5cdFx0XHRjb25zdCBtYXhXaWR0aCA9IG1heENvbnRlbnRXaWR0aEluUmFuZ2UodGhpcy5fZWRpdG9yT2JzLCBvcmlnaW5hbERpc3BsYXlSYW5nZSwgcmVhZGVyKTtcblx0XHRcdHJldHVybiBNYXRoLm1heChtYXhXaWR0aCwgbGFzdFZhbHVlID8/IDApO1xuXHRcdH0pO1xuXHR9KS5tYXAoKHYsIHIpID0+IHYucmVhZChyKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJldmlld0VkaXRvckxheW91dEluZm8gPSBkZXJpdmVkKHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHRjb25zdCBpbmxpbmVFZGl0ID0gdGhpcy5fZWRpdC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFpbmxpbmVFZGl0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLl91aVN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCByYW5nZSA9IGlubGluZUVkaXQub3JpZ2luYWxMaW5lUmFuZ2U7XG5cblx0XHRjb25zdCBob3Jpem9udGFsU2Nyb2xsT2Zmc2V0ID0gdGhpcy5fZWRpdG9yT2JzLnNjcm9sbExlZnQucmVhZChyZWFkZXIpO1xuXG5cdFx0Y29uc3QgZWRpdG9yQ29udGVudE1heFdpZHRoSW5SYW5nZSA9IHRoaXMuX2VkaXRvck1heENvbnRlbnRXaWR0aEluUmFuZ2UucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGVkaXRvckxheW91dCA9IHRoaXMuX2VkaXRvck9icy5sYXlvdXRJbmZvLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBwcmV2aWV3Q29udGVudFdpZHRoID0gdGhpcy5fcHJldmlld0VkaXRvcldpZHRoLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBlZGl0b3JDb250ZW50QXJlYVdpZHRoID0gZWRpdG9yTGF5b3V0LmNvbnRlbnRXaWR0aCAtIGVkaXRvckxheW91dC52ZXJ0aWNhbFNjcm9sbGJhcldpZHRoO1xuXHRcdGNvbnN0IGVkaXRvckJvdW5kaW5nQ2xpZW50UmVjdCA9IHRoaXMuX2VkaXRvci5nZXRDb250YWluZXJEb21Ob2RlKCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0Y29uc3QgY2xpZW50Q29udGVudEFyZWFSaWdodCA9IGVkaXRvckxheW91dC5jb250ZW50TGVmdCArIGVkaXRvckxheW91dC5jb250ZW50V2lkdGggKyBlZGl0b3JCb3VuZGluZ0NsaWVudFJlY3QubGVmdDtcblx0XHRjb25zdCByZW1haW5pbmdXaWR0aFJpZ2h0T2ZDb250ZW50ID0gZ2V0V2luZG93KHRoaXMuX2VkaXRvci5nZXRDb250YWluZXJEb21Ob2RlKCkpLmlubmVyV2lkdGggLSBjbGllbnRDb250ZW50QXJlYVJpZ2h0O1xuXHRcdGNvbnN0IHJlbWFpbmluZ1dpZHRoUmlnaHRPZkVkaXRvciA9IGdldFdpbmRvdyh0aGlzLl9lZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpKS5pbm5lcldpZHRoIC0gZWRpdG9yQm91bmRpbmdDbGllbnRSZWN0LnJpZ2h0O1xuXHRcdGNvbnN0IGRlc2lyZWRNaW5pbXVtV2lkdGggPSBNYXRoLm1pbihlZGl0b3JMYXlvdXQuY29udGVudFdpZHRoICogMC4zLCBwcmV2aWV3Q29udGVudFdpZHRoLCAxMDApO1xuXHRcdGNvbnN0IElOX0VESVRPUl9ESVNQTEFDRU1FTlQgPSAwO1xuXHRcdGNvbnN0IG1heGltdW1BdmFpbGFibGVXaWR0aCA9IElOX0VESVRPUl9ESVNQTEFDRU1FTlQgKyByZW1haW5pbmdXaWR0aFJpZ2h0T2ZDb250ZW50O1xuXG5cdFx0Y29uc3QgY3Vyc29yUG9zID0gdGhpcy5fY3Vyc29yUG9zSWZUb3VjaGVzRWRpdC5yZWFkKHJlYWRlcik7XG5cblx0XHRjb25zdCBtYXhQcmV2aWV3RWRpdG9yTGVmdCA9IE1hdGgubWF4KFxuXHRcdFx0Ly8gV2UncmUgc3RhcnRpbmcgZnJvbSB0aGUgY29udGVudCBhcmVhIHJpZ2h0IGFuZCBtb3ZpbmcgaXQgbGVmdCBieSBJTl9FRElUT1JfRElTUExBQ0VNRU5UIGFuZCBhbHNvIGJ5IGFuIGFtb3VudCB0byBlbnN1cmUgc29tZSBtaW5pbXVtIGRlc2lyZWQgd2lkdGhcblx0XHRcdGVkaXRvckNvbnRlbnRBcmVhV2lkdGggKyBob3Jpem9udGFsU2Nyb2xsT2Zmc2V0IC0gSU5fRURJVE9SX0RJU1BMQUNFTUVOVCAtIE1hdGgubWF4KDAsIGRlc2lyZWRNaW5pbXVtV2lkdGggLSBtYXhpbXVtQXZhaWxhYmxlV2lkdGgpLFxuXHRcdFx0Ly8gQnV0IHdlIGRvbid0IHdhbnQgdGhhdCB0aGUgbW92aW5nIGxlZnQgZW5kcyB1cCBjb3ZlcmluZyB0aGUgY3Vyc29yLCBzbyB0aGlzIHdpbGwgcHVzaCBpdCB0byB0aGUgcmlnaHQgYWdhaW5cblx0XHRcdE1hdGgubWluKFxuXHRcdFx0XHRjdXJzb3JQb3MgPyBnZXRPZmZzZXRGb3JQb3ModGhpcy5fZWRpdG9yT2JzLCBjdXJzb3JQb3MsIHJlYWRlcikgKyA1MCA6IDAsXG5cdFx0XHRcdGVkaXRvckNvbnRlbnRBcmVhV2lkdGggKyBob3Jpem9udGFsU2Nyb2xsT2Zmc2V0XG5cdFx0XHQpXG5cdFx0KTtcblx0XHRjb25zdCBwcmV2aWV3RWRpdG9yTGVmdEluVGV4dEFyZWEgPSBNYXRoLm1pbihlZGl0b3JDb250ZW50TWF4V2lkdGhJblJhbmdlICsgT1JJR0lOQUxfRU5EX1BBRERJTkcsIG1heFByZXZpZXdFZGl0b3JMZWZ0KTtcblxuXHRcdGNvbnN0IG1heENvbnRlbnRXaWR0aCA9IGVkaXRvckNvbnRlbnRNYXhXaWR0aEluUmFuZ2UgKyBPUklHSU5BTF9FTkRfUEFERElORyArIHByZXZpZXdDb250ZW50V2lkdGggKyA3MDtcblxuXHRcdGNvbnN0IGRpc3QgPSBtYXhQcmV2aWV3RWRpdG9yTGVmdCAtIHByZXZpZXdFZGl0b3JMZWZ0SW5UZXh0QXJlYTtcblxuXHRcdGxldCBkZXNpcmVkUHJldmlld0VkaXRvclNjcm9sbExlZnQ7XG5cdFx0bGV0IGNvZGVSaWdodDtcblx0XHRpZiAocHJldmlld0VkaXRvckxlZnRJblRleHRBcmVhID4gaG9yaXpvbnRhbFNjcm9sbE9mZnNldCkge1xuXHRcdFx0ZGVzaXJlZFByZXZpZXdFZGl0b3JTY3JvbGxMZWZ0ID0gMDtcblx0XHRcdGNvZGVSaWdodCA9IGVkaXRvckxheW91dC5jb250ZW50TGVmdCArIHByZXZpZXdFZGl0b3JMZWZ0SW5UZXh0QXJlYSAtIGhvcml6b250YWxTY3JvbGxPZmZzZXQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRlc2lyZWRQcmV2aWV3RWRpdG9yU2Nyb2xsTGVmdCA9IGhvcml6b250YWxTY3JvbGxPZmZzZXQgLSBwcmV2aWV3RWRpdG9yTGVmdEluVGV4dEFyZWE7XG5cdFx0XHRjb2RlUmlnaHQgPSBlZGl0b3JMYXlvdXQuY29udGVudExlZnQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uVG9wID0gdGhpcy5fb3JpZ2luYWxWZXJ0aWNhbFN0YXJ0UG9zaXRpb24ucmVhZChyZWFkZXIpID8/IHRoaXMuX2VkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKHJhbmdlLnN0YXJ0TGluZU51bWJlcikgLSB0aGlzLl9lZGl0b3JPYnMuc2Nyb2xsVG9wLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBzZWxlY3Rpb25Cb3R0b20gPSB0aGlzLl9vcmlnaW5hbFZlcnRpY2FsRW5kUG9zaXRpb24ucmVhZChyZWFkZXIpID8/IHRoaXMuX2VkaXRvci5nZXRCb3R0b21Gb3JMaW5lTnVtYmVyKHJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxKSAtIHRoaXMuX2VkaXRvck9icy5zY3JvbGxUb3AucmVhZChyZWFkZXIpO1xuXG5cdFx0Ly8gVE9ETzogY29uc3QgeyBwcmVmaXhMZWZ0T2Zmc2V0IH0gPSBnZXRQcmVmaXhUcmltKGlubGluZUVkaXQuZWRpdC5lZGl0cy5tYXAoZSA9PiBlLnJhbmdlKSwgaW5saW5lRWRpdC5vcmlnaW5hbExpbmVSYW5nZSwgW10sIHRoaXMuX2VkaXRvcik7XG5cdFx0Y29uc3QgY29kZUxlZnQgPSBlZGl0b3JMYXlvdXQuY29udGVudExlZnQgLSBob3Jpem9udGFsU2Nyb2xsT2Zmc2V0O1xuXG5cdFx0bGV0IGNvZGVSZWN0ID0gUmVjdC5mcm9tTGVmdFRvcFJpZ2h0Qm90dG9tKGNvZGVMZWZ0LCBzZWxlY3Rpb25Ub3AsIGNvZGVSaWdodCwgc2VsZWN0aW9uQm90dG9tKTtcblx0XHRjb25zdCBpc0luc2VydGlvbiA9IGNvZGVSZWN0LmhlaWdodCA9PT0gMDtcblx0XHRpZiAoIWlzSW5zZXJ0aW9uKSB7XG5cdFx0XHRjb2RlUmVjdCA9IGNvZGVSZWN0LndpdGhNYXJnaW4oVkVSVElDQUxfUEFERElORywgSE9SSVpPTlRBTF9QQURESU5HKTtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0SGVpZ2h0ID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCkgKiBpbmxpbmVFZGl0Lm1vZGlmaWVkTGluZVJhbmdlLmxlbmd0aDtcblx0XHRjb25zdCBjb2RlSGVpZ2h0ID0gc2VsZWN0aW9uQm90dG9tIC0gc2VsZWN0aW9uVG9wO1xuXHRcdGNvbnN0IHByZXZpZXdFZGl0b3JIZWlnaHQgPSBNYXRoLm1heChjb2RlSGVpZ2h0LCBlZGl0SGVpZ2h0KTtcblxuXHRcdGNvbnN0IGNsaXBwZWQgPSBkaXN0ID09PSAwO1xuXHRcdGNvbnN0IGNvZGVFZGl0RGlzdCA9IDA7XG5cdFx0Y29uc3QgcHJldmlld0VkaXRvcldpZHRoID0gTWF0aC5taW4ocHJldmlld0NvbnRlbnRXaWR0aCArIE1PRElGSUVEX0VORF9QQURESU5HLCByZW1haW5pbmdXaWR0aFJpZ2h0T2ZFZGl0b3IgKyBlZGl0b3JMYXlvdXQud2lkdGggLSBlZGl0b3JMYXlvdXQuY29udGVudExlZnQgLSBjb2RlRWRpdERpc3QpO1xuXG5cdFx0bGV0IGVkaXRSZWN0ID0gUmVjdC5mcm9tTGVmdFRvcFdpZHRoSGVpZ2h0KGNvZGVSZWN0LnJpZ2h0ICsgY29kZUVkaXREaXN0LCBzZWxlY3Rpb25Ub3AsIHByZXZpZXdFZGl0b3JXaWR0aCwgcHJldmlld0VkaXRvckhlaWdodCk7XG5cdFx0aWYgKCFpc0luc2VydGlvbikge1xuXHRcdFx0ZWRpdFJlY3QgPSBlZGl0UmVjdC53aXRoTWFyZ2luKFZFUlRJQ0FMX1BBRERJTkcsIEhPUklaT05UQUxfUEFERElORykudHJhbnNsYXRlWChIT1JJWk9OVEFMX1BBRERJTkcgKyBCT1JERVJfV0lEVEgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBBbGlnbiB0b3Agb2YgZWRpdCB3aXRoIGluc2VydGlvbiBsaW5lXG5cdFx0XHRlZGl0UmVjdCA9IGVkaXRSZWN0LndpdGhNYXJnaW4oVkVSVElDQUxfUEFERElORywgSE9SSVpPTlRBTF9QQURESU5HKS50cmFuc2xhdGVZKFZFUlRJQ0FMX1BBRERJTkcpO1xuXHRcdH1cblxuXHRcdC8vIGRlYnVnVmlldyhkZWJ1Z0xvZ1JlY3RzKHsgY29kZVJlY3QsIGVkaXRSZWN0IH0sIHRoaXMuX2VkaXRvci5nZXREb21Ob2RlKCkhKSwgcmVhZGVyKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb2RlUmVjdCxcblx0XHRcdGVkaXRSZWN0LFxuXHRcdFx0Y29kZVNjcm9sbExlZnQ6IGhvcml6b250YWxTY3JvbGxPZmZzZXQsXG5cdFx0XHRjb250ZW50TGVmdDogZWRpdG9yTGF5b3V0LmNvbnRlbnRMZWZ0LFxuXG5cdFx0XHRpc0luc2VydGlvbixcblx0XHRcdG1heENvbnRlbnRXaWR0aCxcblx0XHRcdHNob3VsZFNob3dTaGFkb3c6IGNsaXBwZWQsXG5cdFx0XHRkZXNpcmVkUHJldmlld0VkaXRvclNjcm9sbExlZnQsXG5cdFx0XHRwcmV2aWV3RWRpdG9yV2lkdGgsXG5cdFx0fTtcblx0fSk7XG5cblx0cHJpdmF0ZSBfc3RpY2t5U2Nyb2xsQ29udHJvbGxlciA9IFN0aWNreVNjcm9sbENvbnRyb2xsZXIuZ2V0KHRoaXMuX2VkaXRvck9icy5lZGl0b3IpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGlja3lTY3JvbGxIZWlnaHQgPSB0aGlzLl9zdGlja3lTY3JvbGxDb250cm9sbGVyID8gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLl9zdGlja3lTY3JvbGxDb250cm9sbGVyLm9uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsSGVpZ2h0LCAoKSA9PiB0aGlzLl9zdGlja3lTY3JvbGxDb250cm9sbGVyIS5zdGlja3lTY3JvbGxXaWRnZXRIZWlnaHQpIDogY29uc3RPYnNlcnZhYmxlKDApO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nob3VsZE92ZXJmbG93ID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdGlmICghRU5BQkxFX09WRVJGTE9XKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fZWRpdC5yZWFkKHJlYWRlcik/Lm9yaWdpbmFsTGluZVJhbmdlO1xuXHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3Qgc3RpY2t5U2Nyb2xsSGVpZ2h0ID0gdGhpcy5fc3RpY2t5U2Nyb2xsSGVpZ2h0LnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCB0b3AgPSB0aGlzLl9lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihyYW5nZS5zdGFydExpbmVOdW1iZXIpIC0gdGhpcy5fZWRpdG9yT2JzLnNjcm9sbFRvcC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKHRvcCA8PSBzdGlja3lTY3JvbGxIZWlnaHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgYm90dG9tID0gdGhpcy5fZWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIocmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSkgLSB0aGlzLl9lZGl0b3JPYnMuc2Nyb2xsVG9wLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoYm90dG9tID49IHRoaXMuX2VkaXRvck9icy5sYXlvdXRJbmZvLnJlYWQocmVhZGVyKS5oZWlnaHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsQmFja2dyb3VuZENvbG9yID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCB0aGlzLl90aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3Iob3JpZ2luYWxCYWNrZ3JvdW5kQ29sb3IpID8/IENvbG9yLnRyYW5zcGFyZW50O1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9iYWNrZ3JvdW5kU3ZnID0gbi5zdmcoe1xuXHRcdHRyYW5zZm9ybTogJ3RyYW5zbGF0ZSgtMC41IC0wLjUpJyxcblx0XHRzdHlsZTogeyBvdmVyZmxvdzogJ3Zpc2libGUnLCBwb2ludGVyRXZlbnRzOiAnbm9uZScsIHBvc2l0aW9uOiAnYWJzb2x1dGUnIH0sXG5cdH0sIFtcblx0XHRuLnN2Z0VsZW0oJ3BhdGgnLCB7XG5cdFx0XHRjbGFzczogJ3JpZ2h0T2ZNb2RpZmllZEJhY2tncm91bmRDb3ZlclVwJyxcblx0XHRcdGQ6IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuX3ByZXZpZXdFZGl0b3JMYXlvdXRJbmZvLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0aWYgKCFsYXlvdXRJbmZvKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBvcmlnaW5hbEJhY2tncm91bmRDb2xvciA9IHRoaXMuX29yaWdpbmFsQmFja2dyb3VuZENvbG9yLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0aWYgKG9yaWdpbmFsQmFja2dyb3VuZENvbG9yLmlzVHJhbnNwYXJlbnQoKSkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbmV3IFBhdGhCdWlsZGVyKClcblx0XHRcdFx0XHQubW92ZVRvKGxheW91dEluZm8uY29kZVJlY3QuZ2V0UmlnaHRUb3AoKSlcblx0XHRcdFx0XHQubGluZVRvKGxheW91dEluZm8uY29kZVJlY3QuZ2V0UmlnaHRUb3AoKS5kZWx0YVgoMTAwMCkpXG5cdFx0XHRcdFx0LmxpbmVUbyhsYXlvdXRJbmZvLmNvZGVSZWN0LmdldFJpZ2h0Qm90dG9tKCkuZGVsdGFYKDEwMDApKVxuXHRcdFx0XHRcdC5saW5lVG8obGF5b3V0SW5mby5jb2RlUmVjdC5nZXRSaWdodEJvdHRvbSgpKVxuXHRcdFx0XHRcdC5idWlsZCgpO1xuXHRcdFx0fSksXG5cdFx0XHRzdHlsZToge1xuXHRcdFx0XHRmaWxsOiBhc0Nzc1ZhcmlhYmxlV2l0aERlZmF1bHQoZWRpdG9yQmFja2dyb3VuZCwgJ3RyYW5zcGFyZW50JyksXG5cdFx0XHR9XG5cdFx0fSksXG5cdF0pLmtlZXBVcGRhdGVkKHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbE92ZXJsYXkgPSBuLmRpdih7XG5cdFx0c3R5bGU6IHsgcG9pbnRlckV2ZW50czogJ25vbmUnLCBkaXNwbGF5OiB0aGlzLl9wcmV2aWV3RWRpdG9yTGF5b3V0SW5mby5tYXAobGF5b3V0SW5mbyA9PiBsYXlvdXRJbmZvPy5pc0luc2VydGlvbiA/ICdub25lJyA6ICdibG9jaycpIH0sXG5cdH0sIGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRjb25zdCBsYXlvdXRJbmZvT2JzID0gbWFwT3V0RmFsc3kodGhpcy5fcHJldmlld0VkaXRvckxheW91dEluZm8pLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIWxheW91dEluZm9PYnMpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0Y29uc3QgYm9yZGVyU3R5bGluZyA9IGdldE9yaWdpbmFsQm9yZGVyQ29sb3IodGhpcy5fdGFiQWN0aW9uKS5tYXAoYmMgPT4gYCR7Qk9SREVSX1dJRFRIfXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShiYyl9YCk7XG5cdFx0Y29uc3QgYm9yZGVyU3R5bGluZ1NlcGFyYXRvciA9IGAke0JPUkRFUl9XSURUSCArIFdJREdFVF9TRVBBUkFUT1JfV0lEVEh9cHggc29saWQgJHthc0Nzc1ZhcmlhYmxlKGVkaXRvckJhY2tncm91bmQpfWA7XG5cblx0XHRjb25zdCBoYXNCb3JkZXJMZWZ0ID0gbGF5b3V0SW5mb09icy5yZWFkKHJlYWRlcikuY29kZVNjcm9sbExlZnQgIT09IDA7XG5cdFx0Y29uc3QgaXNNb2RpZmllZExvd2VyID0gbGF5b3V0SW5mb09icy5tYXAobGF5b3V0SW5mbyA9PiBsYXlvdXRJbmZvLmNvZGVSZWN0LmJvdHRvbSA8IGxheW91dEluZm8uZWRpdFJlY3QuYm90dG9tKTtcblx0XHRjb25zdCB0cmFuc2l0aW9uUmVjdFNpemUgPSBCT1JERVJfUkFESVVTICogMiArIEJPUkRFUl9XSURUSCAqIDI7XG5cblx0XHQvLyBDcmVhdGUgYW4gb3ZlcmxheSB3aGljaCBoaWRlcyB0aGUgbGVmdCBoYW5kIHNpZGUgb2YgdGhlIG9yaWdpbmFsIG92ZXJsYXkgd2hlbiBpdCBvdmVyZmxvd3MgdG8gdGhlIGxlZnRcblx0XHQvLyBzdWNoIHRoYXQgdGhlcmUgaXMgYSBzbW9vdGggdHJhbnNpdGlvbiBhdCB0aGUgZWRnZSBvZiBjb250ZW50IGxlZnRcblx0XHRjb25zdCBvdmVybGF5SGlkZXIgPSBsYXlvdXRJbmZvT2JzLm1hcChsYXlvdXRJbmZvID0+IFJlY3QuZnJvbUxlZnRUb3BSaWdodEJvdHRvbShcblx0XHRcdGxheW91dEluZm8uY29udGVudExlZnQgLSBCT1JERVJfUkFESVVTIC0gQk9SREVSX1dJRFRILFxuXHRcdFx0bGF5b3V0SW5mby5jb2RlUmVjdC50b3AsXG5cdFx0XHRsYXlvdXRJbmZvLmNvbnRlbnRMZWZ0LFxuXHRcdFx0bGF5b3V0SW5mby5jb2RlUmVjdC5ib3R0b20gKyB0cmFuc2l0aW9uUmVjdFNpemVcblx0XHQpKS5yZWFkKHJlYWRlcik7XG5cblx0XHRjb25zdCBpbnRlcnNlY3Rpb25MaW5lID0gbmV3IE9mZnNldFJhbmdlKG92ZXJsYXlIaWRlci5sZWZ0LCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUik7XG5cdFx0Y29uc3Qgb3ZlcmxheVJlY3QgPSBsYXlvdXRJbmZvT2JzLm1hcChsYXlvdXRJbmZvID0+IGxheW91dEluZm8uY29kZVJlY3QuaW50ZXJzZWN0SG9yaXpvbnRhbChpbnRlcnNlY3Rpb25MaW5lKSk7XG5cdFx0Y29uc3Qgc2VwYXJhdG9yUmVjdCA9IG92ZXJsYXlSZWN0Lm1hcChvdmVybGF5UmVjdCA9PiBvdmVybGF5UmVjdC53aXRoTWFyZ2luKFdJREdFVF9TRVBBUkFUT1JfV0lEVEgsIDAsIFdJREdFVF9TRVBBUkFUT1JfV0lEVEgsIFdJREdFVF9TRVBBUkFUT1JfV0lEVEgpLmludGVyc2VjdEhvcml6b250YWwoaW50ZXJzZWN0aW9uTGluZSkpO1xuXG5cdFx0Y29uc3QgdHJhbnNpdGlvblJlY3QgPSBvdmVybGF5UmVjdC5tYXAob3ZlcmxheVJlY3QgPT4gUmVjdC5mcm9tTGVmdFRvcFdpZHRoSGVpZ2h0KG92ZXJsYXlSZWN0LnJpZ2h0IC0gdHJhbnNpdGlvblJlY3RTaXplICsgQk9SREVSX1dJRFRILCBvdmVybGF5UmVjdC5ib3R0b20gLSBCT1JERVJfV0lEVEgsIHRyYW5zaXRpb25SZWN0U2l6ZSwgdHJhbnNpdGlvblJlY3RTaXplKS5pbnRlcnNlY3RIb3Jpem9udGFsKGludGVyc2VjdGlvbkxpbmUpKTtcblxuXHRcdHJldHVybiBbXG5cdFx0XHRuLmRpdih7XG5cdFx0XHRcdGNsYXNzOiAnb3JpZ2luYWxTZXBhcmF0b3JTaWRlQnlTaWRlJyxcblx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHQuLi5zZXBhcmF0b3JSZWN0LnJlYWQocmVhZGVyKS50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJveFNpemluZzogJ2JvcmRlci1ib3gnLFxuXHRcdFx0XHRcdGJvcmRlclJhZGl1czogYCR7Qk9SREVSX1JBRElVU31weCAwIDAgJHtCT1JERVJfUkFESVVTfXB4YCxcblx0XHRcdFx0XHRib3JkZXJUb3A6IGJvcmRlclN0eWxpbmdTZXBhcmF0b3IsXG5cdFx0XHRcdFx0Ym9yZGVyQm90dG9tOiBib3JkZXJTdHlsaW5nU2VwYXJhdG9yLFxuXHRcdFx0XHRcdGJvcmRlckxlZnQ6IGhhc0JvcmRlckxlZnQgPyAnbm9uZScgOiBib3JkZXJTdHlsaW5nU2VwYXJhdG9yLFxuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblxuXHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRjbGFzczogJ29yaWdpbmFsT3ZlcmxheVNpZGVCeVNpZGUnLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLm92ZXJsYXlSZWN0LnJlYWQocmVhZGVyKS50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJveFNpemluZzogJ2JvcmRlci1ib3gnLFxuXHRcdFx0XHRcdGJvcmRlclJhZGl1czogYCR7Qk9SREVSX1JBRElVU31weCAwIDAgJHtCT1JERVJfUkFESVVTfXB4YCxcblx0XHRcdFx0XHRib3JkZXJUb3A6IGJvcmRlclN0eWxpbmcsXG5cdFx0XHRcdFx0Ym9yZGVyQm90dG9tOiBib3JkZXJTdHlsaW5nLFxuXHRcdFx0XHRcdGJvcmRlckxlZnQ6IGhhc0JvcmRlckxlZnQgPyAnbm9uZScgOiBib3JkZXJTdHlsaW5nLFxuXHRcdFx0XHRcdGJhY2tncm91bmRDb2xvcjogYXNDc3NWYXJpYWJsZShvcmlnaW5hbEJhY2tncm91bmRDb2xvciksXG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXG5cdFx0XHRuLmRpdih7XG5cdFx0XHRcdGNsYXNzOiAnb3JpZ2luYWxDb3JuZXJDdXRvdXRTaWRlQnlTaWRlJyxcblx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRwb2ludGVyRXZlbnRzOiAnbm9uZScsXG5cdFx0XHRcdFx0ZGlzcGxheTogaXNNb2RpZmllZExvd2VyLm1hcChpc0xvd2VyID0+IGlzTG93ZXIgPyAnYmxvY2snIDogJ25vbmUnKSxcblx0XHRcdFx0XHQuLi50cmFuc2l0aW9uUmVjdC5yZWFkKHJlYWRlcikudG9TdHlsZXMoKSxcblx0XHRcdFx0fVxuXHRcdFx0fSwgW1xuXHRcdFx0XHRuLmRpdih7XG5cdFx0XHRcdFx0Y2xhc3M6ICdvcmlnaW5hbENvcm5lckN1dG91dEJhY2tncm91bmQnLFxuXHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbjogJ2Fic29sdXRlJywgdG9wOiAnMHB4JywgbGVmdDogJzBweCcsIHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzEwMCUnLFxuXHRcdFx0XHRcdFx0YmFja2dyb3VuZENvbG9yOiBnZXRFZGl0b3JCbGVuZGVkQ29sb3Iob3JpZ2luYWxCYWNrZ3JvdW5kQ29sb3IsIHRoaXMuX3RoZW1lU2VydmljZSkubWFwKGMgPT4gYy50b1N0cmluZygpKSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRuLmRpdih7XG5cdFx0XHRcdFx0Y2xhc3M6ICdvcmlnaW5hbENvcm5lckN1dG91dEJvcmRlcicsXG5cdFx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLCB0b3A6ICcwcHgnLCBsZWZ0OiAnMHB4Jywgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAnMTAwJScsXG5cdFx0XHRcdFx0XHRib3hTaXppbmc6ICdib3JkZXItYm94Jyxcblx0XHRcdFx0XHRcdGJvcmRlclRvcDogYm9yZGVyU3R5bGluZyxcblx0XHRcdFx0XHRcdGJvcmRlclJpZ2h0OiBib3JkZXJTdHlsaW5nLFxuXHRcdFx0XHRcdFx0Ym9yZGVyUmFkaXVzOiBgMCAxMDAlIDAgMGAsXG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kQ29sb3I6IGFzQ3NzVmFyaWFibGUoZWRpdG9yQmFja2dyb3VuZClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRdKSxcblx0XHRcdG4uZGl2KHtcblx0XHRcdFx0Y2xhc3M6ICdvcmlnaW5hbE92ZXJsYXlTaWRlQnlTaWRlSGlkZXInLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLm92ZXJsYXlIaWRlci50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJhY2tncm91bmRDb2xvcjogYXNDc3NWYXJpYWJsZShlZGl0b3JCYWNrZ3JvdW5kKSxcblx0XHRcdFx0fVxuXHRcdFx0fSksXG5cdFx0XTtcblx0fSkpLmtlZXBVcGRhdGVkKHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZE92ZXJsYXkgPSBuLmRpdih7XG5cdFx0c3R5bGU6IHsgcG9pbnRlckV2ZW50czogJ25vbmUnLCB9XG5cdH0sIGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRjb25zdCBsYXlvdXRJbmZvT2JzID0gbWFwT3V0RmFsc3kodGhpcy5fcHJldmlld0VkaXRvckxheW91dEluZm8pLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIWxheW91dEluZm9PYnMpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0Y29uc3QgaXNNb2RpZmllZExvd2VyID0gbGF5b3V0SW5mb09icy5tYXAobGF5b3V0SW5mbyA9PiBsYXlvdXRJbmZvLmNvZGVSZWN0LmJvdHRvbSA8IGxheW91dEluZm8uZWRpdFJlY3QuYm90dG9tKTtcblxuXHRcdGNvbnN0IGJvcmRlclJhZGl1cyA9IGlzTW9kaWZpZWRMb3dlci5tYXAoaXNMb3dlciA9PiBgMCAke0JPUkRFUl9SQURJVVN9cHggJHtCT1JERVJfUkFESVVTfXB4ICR7aXNMb3dlciA/IEJPUkRFUl9SQURJVVMgOiAwfXB4YCk7XG5cdFx0Y29uc3QgYm9yZGVyU3R5bGluZyA9IGdldEVkaXRvckJsZW5kZWRDb2xvcihnZXRNb2RpZmllZEJvcmRlckNvbG9yKHRoaXMuX3RhYkFjdGlvbiksIHRoaXMuX3RoZW1lU2VydmljZSkubWFwKGMgPT4gYDFweCBzb2xpZCAke2MudG9TdHJpbmcoKX1gKTtcblx0XHRjb25zdCBib3JkZXJTdHlsaW5nU2VwYXJhdG9yID0gYCR7Qk9SREVSX1dJRFRIICsgV0lER0VUX1NFUEFSQVRPUl9XSURUSH1weCBzb2xpZCAke2FzQ3NzVmFyaWFibGUoZWRpdG9yQmFja2dyb3VuZCl9YDtcblxuXHRcdGNvbnN0IG92ZXJsYXlSZWN0ID0gbGF5b3V0SW5mb09icy5tYXAobGF5b3V0SW5mbyA9PiBsYXlvdXRJbmZvLmVkaXRSZWN0LndpdGhNYXJnaW4oMCwgQk9SREVSX1dJRFRIKSk7XG5cdFx0Y29uc3Qgc2VwYXJhdG9yUmVjdCA9IG92ZXJsYXlSZWN0Lm1hcChvdmVybGF5UmVjdCA9PiBvdmVybGF5UmVjdC53aXRoTWFyZ2luKFdJREdFVF9TRVBBUkFUT1JfV0lEVEgsIFdJREdFVF9TRVBBUkFUT1JfV0lEVEgsIFdJREdFVF9TRVBBUkFUT1JfV0lEVEgsIDApKTtcblxuXHRcdGNvbnN0IGluc2VydGlvblJlY3QgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBvdmVybGF5ID0gb3ZlcmxheVJlY3QucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgbGF5b3V0aW5mbyA9IGxheW91dEluZm9PYnMucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFsYXlvdXRpbmZvLmlzSW5zZXJ0aW9uIHx8IGxheW91dGluZm8uY29udGVudExlZnQgPj0gb3ZlcmxheS5sZWZ0KSB7XG5cdFx0XHRcdHJldHVybiBSZWN0LmZyb21MZWZ0VG9wV2lkdGhIZWlnaHQob3ZlcmxheS5sZWZ0LCBvdmVybGF5LnRvcCwgMCwgMCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IFJlY3QobGF5b3V0aW5mby5jb250ZW50TGVmdCwgb3ZlcmxheS50b3AsIG92ZXJsYXkubGVmdCwgb3ZlcmxheS50b3AgKyBCT1JERVJfV0lEVEggKiAyKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBbXG5cdFx0XHRuLmRpdih7XG5cdFx0XHRcdGNsYXNzOiAnbW9kaWZpZWRJbnNlcnRpb25TaWRlQnlTaWRlJyxcblx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHQuLi5pbnNlcnRpb25SZWN0LnJlYWQocmVhZGVyKS50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJhY2tncm91bmRDb2xvcjogZ2V0TW9kaWZpZWRCb3JkZXJDb2xvcih0aGlzLl90YWJBY3Rpb24pLm1hcChjID0+IGFzQ3NzVmFyaWFibGUoYykpLFxuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRcdG4uZGl2KHtcblx0XHRcdFx0Y2xhc3M6ICdtb2RpZmllZFNlcGFyYXRvclNpZGVCeVNpZGUnLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLnNlcGFyYXRvclJlY3QucmVhZChyZWFkZXIpLnRvU3R5bGVzKCksXG5cdFx0XHRcdFx0Ym9yZGVyUmFkaXVzLFxuXHRcdFx0XHRcdGJvcmRlclRvcDogYm9yZGVyU3R5bGluZ1NlcGFyYXRvcixcblx0XHRcdFx0XHRib3JkZXJCb3R0b206IGJvcmRlclN0eWxpbmdTZXBhcmF0b3IsXG5cdFx0XHRcdFx0Ym9yZGVyUmlnaHQ6IGJvcmRlclN0eWxpbmdTZXBhcmF0b3IsXG5cdFx0XHRcdFx0Ym94U2l6aW5nOiAnYm9yZGVyLWJveCcsXG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRjbGFzczogJ21vZGlmaWVkT3ZlcmxheVNpZGVCeVNpZGUnLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLm92ZXJsYXlSZWN0LnJlYWQocmVhZGVyKS50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJvcmRlclJhZGl1cyxcblx0XHRcdFx0XHRib3JkZXI6IGJvcmRlclN0eWxpbmcsXG5cdFx0XHRcdFx0Ym94U2l6aW5nOiAnYm9yZGVyLWJveCcsXG5cdFx0XHRcdFx0YmFja2dyb3VuZENvbG9yOiBhc0Nzc1ZhcmlhYmxlKG1vZGlmaWVkQmFja2dyb3VuZENvbG9yKSxcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRdO1xuXHR9KSkua2VlcFVwZGF0ZWQodGhpcy5fc3RvcmUpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX25vbk92ZXJmbG93VmlldyA9IG4uZGl2KHtcblx0XHRjbGFzczogJ2lubGluZS1lZGl0cy12aWV3Jyxcblx0XHRzdHlsZToge1xuXHRcdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0XHRvdmVyZmxvdzogJ3Zpc2libGUnLFxuXHRcdFx0dG9wOiAnMHB4Jyxcblx0XHRcdGxlZnQ6ICcwcHgnLFxuXHRcdFx0ekluZGV4OiAnMCcsXG5cdFx0XHRkaXNwbGF5OiB0aGlzLl9kaXNwbGF5LFxuXHRcdH0sXG5cdH0sIFtcblx0XHR0aGlzLl9iYWNrZ3JvdW5kU3ZnLFxuXHRcdGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHRoaXMuX3Nob3VsZE92ZXJmbG93LnJlYWQocmVhZGVyKSA/IFtdIDogW3RoaXMuX2VkaXRvckNvbnRhaW5lciwgdGhpcy5fb3JpZ2luYWxPdmVybGF5LCB0aGlzLl9tb2RpZmllZE92ZXJsYXldKSxcblx0XSkua2VlcFVwZGF0ZWQodGhpcy5fc3RvcmUpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFJQSxTQUFTLEdBQUcsV0FBVyxTQUFTO0FBQ2hDLFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQStCLFNBQVMsaUJBQWlCLFNBQVMsNEJBQTRCLDJCQUEyQjtBQUN6SCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGVBQWUsZ0NBQWdDO0FBQ3hELFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsWUFBWTtBQUNyQixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG9CQUFvQjtBQUU3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFFdEIsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxtQ0FBbUM7QUFHNUMsU0FBUyx1QkFBdUIsd0JBQXdCLHdCQUF3Qix5QkFBeUIsK0JBQStCO0FBQ3hJLFNBQVMsYUFBYSx1QkFBdUIsaUJBQWlCLGFBQWEsOEJBQThCO0FBRXpHLE1BQU0scUJBQXFCO0FBQzNCLE1BQU0sbUJBQW1CO0FBQ3pCLE1BQU0sa0JBQWtCO0FBRXhCLE1BQU0sZUFBZTtBQUNyQixNQUFNLHlCQUF5QjtBQUMvQixNQUFNLGdCQUFnQjtBQUN0QixNQUFNLHVCQUF1QjtBQUM3QixNQUFNLHVCQUF1QjtBQUV0QixJQUFNLDRCQUFOLGNBQXdDLFdBQXVDO0FBQUEsRUF1QnJGLFlBQ2tCLFNBQ0EsT0FDQSxtQkFDQSxVQUlBLFlBQ3VCLHVCQUNSLGVBQy9CO0FBQ0QsVUFBTTtBQVhXO0FBQ0E7QUFDQTtBQUNBO0FBSUE7QUFDdUI7QUFDUjtBQWZqQyxTQUFpQixhQUFhLHFCQUFxQixLQUFLLE9BQU87QUFFL0QsU0FBaUIsY0FBYyxLQUFLLFVBQVUsSUFBSSxRQUFxQixDQUFDO0FBQ3hFLFNBQVMsYUFBYSxLQUFLLFlBQVk7QUF1RHZDLFNBQWlCLFdBQVcsUUFBUSxNQUFNLFlBQVUsQ0FBQyxDQUFDLEtBQUssU0FBUyxLQUFLLE1BQU0sSUFBSSxVQUFVLE1BQU07QUFFbkcsU0FBaUIsYUFBYSxFQUFFLElBQW9CO0FBRXBELFNBQWlCLG1CQUFtQixFQUFFLElBQUk7QUFBQSxNQUN6QyxPQUFPLENBQUMsaUJBQWlCO0FBQUEsTUFDekIsT0FBTyxFQUFFLFVBQVUsWUFBWSxVQUFVLFVBQVUsUUFBUSxVQUFVO0FBQUEsTUFDckUsYUFBYSxPQUFLO0FBQ2pCLFVBQUUsZUFBZTtBQUFBLE1BQ2xCO0FBQUEsTUFDQSxTQUFTLENBQUMsTUFBTTtBQUNmLGFBQUssWUFBWSxLQUFLLElBQUksbUJBQW1CLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUFBLE1BQzlEO0FBQUEsSUFDRCxHQUFHO0FBQUEsTUFDRixFQUFFLElBQUksRUFBRSxPQUFPLFdBQVcsT0FBTyxFQUFFLGVBQWUsT0FBTyxHQUFHLEtBQUssS0FBSyxXQUFXLENBQUM7QUFBQSxJQUNuRixDQUFDLEVBQUUsWUFBWSxLQUFLLE1BQU07QUFFMUIsU0FBZ0IsWUFBWSxLQUFLLGlCQUFpQjtBQUVsRCxTQUFnQixnQkFBZ0IsS0FBSyxVQUFVLEtBQUssc0JBQXNCO0FBQUEsTUFDekU7QUFBQSxNQUNBLEtBQUssV0FBVztBQUFBLE1BQ2hCO0FBQUEsUUFDQyxhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixTQUFTLEVBQUUsU0FBUyxNQUFNO0FBQUEsUUFDMUIsUUFBUTtBQUFBLFVBQ1AsYUFBYTtBQUFBLFVBQ2IsY0FBYztBQUFBLFVBQ2Qsd0JBQXdCO0FBQUEsVUFDeEIsNEJBQTRCO0FBQUEsUUFDN0I7QUFBQSxRQUNBLFFBQVEsQ0FBQztBQUFBLFFBQ1QsU0FBUyxFQUFFLEtBQUssR0FBRyxRQUFRLEVBQUU7QUFBQSxRQUM3QixTQUFTO0FBQUEsUUFDVCxxQkFBcUI7QUFBQSxRQUNyQixvQkFBb0I7QUFBQSxRQUNwQixpQkFBaUI7QUFBQSxRQUNqQixxQkFBcUI7QUFBQSxRQUNyQixvQkFBb0I7QUFBQSxRQUNwQixzQkFBc0I7QUFBQSxRQUN0QixxQkFBcUI7QUFBQSxRQUNyQiw4QkFBOEI7QUFBQSxRQUM5Qix5QkFBeUIsRUFBRSxTQUFTLE1BQU0sb0NBQW9DLE1BQU07QUFBQSxRQUNwRixzQkFBc0I7QUFBQSxRQUN0QixXQUFXO0FBQUEsVUFDVixVQUFVO0FBQUEsVUFDVixZQUFZO0FBQUEsVUFDWixrQkFBa0I7QUFBQSxRQUNuQjtBQUFBLFFBQ0EsVUFBVTtBQUFBLFFBQ1YsVUFBVTtBQUFBLFFBQ1YsbUJBQW1CO0FBQUEsUUFDbkIsbUJBQW1CO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsUUFDQyxrQkFBa0I7QUFBQSxVQUNqQixDQUFDLDRCQUE0QiwyQkFBMkIsR0FBRyxHQUFHO0FBQUEsUUFDL0Q7QUFBQSxRQUNBLGVBQWUsQ0FBQztBQUFBLE1BQ2pCO0FBQUEsTUFDQSxLQUFLO0FBQUEsSUFDTixDQUFDO0FBRUQsU0FBaUIsb0JBQW9CLHFCQUFxQixLQUFLLGFBQWE7QUFFNUUsU0FBUSxtQkFBNkIsQ0FBQztBQUN0QyxTQUFpQix1QkFBdUIsUUFBUSxZQUFVO0FBQ3pELFdBQUssaUJBQWlCLFdBQVcsTUFBTTtBQUN2QyxXQUFLLGtCQUFrQixNQUFNLEtBQUssTUFBTTtBQU14QyxXQUFLLFNBQVMsS0FBSyxNQUFNO0FBQ3pCLFVBQUksS0FBSyxrQkFBa0I7QUFDMUIsYUFBSyxpQkFBaUIsUUFBUSxNQUFNLFVBQVUsS0FBSyxTQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3hFO0FBRUEsWUFBTSxVQUFVLEtBQUssU0FBUyxLQUFLLE1BQU07QUFDekMsWUFBTSxPQUFPLEtBQUssTUFBTSxLQUFLLE1BQU07QUFDbkMsVUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNO0FBQ3RCO0FBQUEsTUFDRDtBQUVBLFlBQU0sUUFBUSxLQUFLO0FBRW5CLFlBQU0sY0FBdUIsQ0FBQztBQUM5QixVQUFJLE1BQU0sa0JBQWtCLEdBQUc7QUFDOUIsb0JBQVksS0FBSyxJQUFJLE1BQU0sR0FBRyxHQUFHLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDL0Q7QUFDQSxVQUFJLE1BQU0sa0JBQWtCLFFBQVEsbUJBQW1CLEtBQUssa0JBQWtCLGFBQWEsSUFBSSxHQUFHO0FBQ2pHLG9CQUFZLEtBQUssSUFBSSxNQUFNLE1BQU0sa0JBQWtCLFFBQVEsa0JBQWtCLEdBQUcsS0FBSyxrQkFBa0IsYUFBYSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDOUg7QUFFQSxXQUFLLGNBQWMsZUFBZSxhQUFhLFFBQVcsSUFBSTtBQUc5RCxZQUFNLG9CQUFvQixDQUFDLEdBQUcsS0FBSyxnQkFBZ0I7QUFDbkQsV0FBSyxtQkFBbUIsQ0FBQztBQUV6QixZQUFNLG9CQUFxQixNQUFNLHlCQUF5QixNQUFNLGtCQUFtQixRQUFRO0FBQzNGLFdBQUssY0FBYyxnQkFBZ0IsQ0FBQyxtQkFBbUI7QUFDdEQsMEJBQWtCLFFBQVEsUUFBTSxlQUFlLFdBQVcsRUFBRSxDQUFDO0FBRTdELFlBQUksb0JBQW9CLEdBQUc7QUFDMUIsZUFBSyxpQkFBaUIsS0FBSyxlQUFlLFFBQVE7QUFBQSxZQUNqRCxpQkFBaUIsTUFBTSxrQkFBa0IsUUFBUSxtQkFBbUI7QUFBQSxZQUNwRSxlQUFlO0FBQUEsWUFDZixtQkFBbUI7QUFBQSxZQUNuQixTQUFTLEVBQUUsMENBQTBDO0FBQUEsVUFDdEQsQ0FBQyxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQWlCLHNCQUFzQixRQUFRLE1BQU0sWUFBVTtBQUM5RCxZQUFNLE9BQU8sS0FBSyxNQUFNLEtBQUssTUFBTTtBQUNuQyxVQUFJLENBQUMsTUFBTTtBQUFFLGVBQU87QUFBQSxNQUFHO0FBQ3ZCLFdBQUsscUJBQXFCLEtBQUssTUFBTTtBQUVyQyxhQUFPLHVCQUF1QixLQUFLLG1CQUFtQixLQUFLLG1CQUFtQixNQUFNO0FBQUEsSUFDckYsQ0FBQztBQUVELFNBQWlCLDBCQUEwQixRQUFRLE1BQU0sWUFBVTtBQUNsRSxZQUFNLFlBQVksS0FBSyxXQUFXLGVBQWUsS0FBSyxNQUFNO0FBQzVELFlBQU0sT0FBTyxLQUFLLE1BQU0sS0FBSyxNQUFNO0FBQ25DLFVBQUksQ0FBQyxRQUFRLENBQUMsV0FBVztBQUFFLGVBQU87QUFBQSxNQUFXO0FBQzdDLGFBQU8sS0FBSyxrQkFBa0IsU0FBUyxVQUFVLFVBQVUsSUFBSSxZQUFZO0FBQUEsSUFDNUUsQ0FBQztBQUVELFNBQWlCLHlCQUF5QixRQUFRLE1BQU0sQ0FBQyxXQUFXO0FBQ25FLFlBQU0sYUFBYSxLQUFLLE1BQU0sS0FBSyxNQUFNO0FBQ3pDLGFBQU8sYUFBYSxJQUFJLFNBQVMsV0FBVyxrQkFBa0IsaUJBQWlCLENBQUMsSUFBSTtBQUFBLElBQ3JGLENBQUM7QUFFRCxTQUFpQix1QkFBdUIsUUFBUSxNQUFNLENBQUMsV0FBVztBQUNqRSxZQUFNLGFBQWEsS0FBSyxNQUFNLEtBQUssTUFBTTtBQUN6QyxhQUFPLGFBQWEsSUFBSSxTQUFTLFdBQVcsa0JBQWtCLHdCQUF3QixDQUFDLElBQUk7QUFBQSxJQUM1RixDQUFDO0FBRUQsU0FBaUIsaUNBQWlDLEtBQUssV0FBVyxnQkFBZ0IsS0FBSyx3QkFBd0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxPQUFLLEdBQUcsQ0FBQztBQUN6SSxTQUFpQiwrQkFBK0IsS0FBSyxXQUFXLGdCQUFnQixLQUFLLHNCQUFzQixLQUFLLE1BQU0sRUFBRSxJQUFJLE9BQUssR0FBRyxDQUFDO0FBRXJJLFNBQWlCLHdCQUF3QixLQUFLLFNBQVMsSUFBSSxPQUFLLEdBQUcsb0JBQW9CO0FBQ3ZGLFNBQWlCLGdDQUFnQyxRQUFRLE1BQU0sWUFBVTtBQUN4RSxZQUFNLHVCQUF1QixLQUFLLHNCQUFzQixLQUFLLE1BQU07QUFDbkUsVUFBSSxDQUFDLHNCQUFzQjtBQUMxQixlQUFPLGdCQUFnQixDQUFDO0FBQUEsTUFDekI7QUFDQSxXQUFLLFdBQVcsVUFBVSxLQUFLLE1BQU07QUFJckMsYUFBTywyQkFBbUMsTUFBTSxDQUFDQSxTQUFRLGNBQWM7QUFDdEUsY0FBTSxXQUFXLHVCQUF1QixLQUFLLFlBQVksc0JBQXNCQSxPQUFNO0FBQ3JGLGVBQU8sS0FBSyxJQUFJLFVBQVUsYUFBYSxDQUFDO0FBQUEsTUFDekMsQ0FBQztBQUFBLElBQ0YsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztBQUUxQixTQUFpQiwyQkFBMkIsUUFBUSxNQUFNLENBQUMsV0FBVztBQUNyRSxZQUFNLGFBQWEsS0FBSyxNQUFNLEtBQUssTUFBTTtBQUN6QyxVQUFJLENBQUMsWUFBWTtBQUNoQixlQUFPO0FBQUEsTUFDUjtBQUNBLFlBQU0sUUFBUSxLQUFLLFNBQVMsS0FBSyxNQUFNO0FBQ3ZDLFVBQUksQ0FBQyxPQUFPO0FBQ1gsZUFBTztBQUFBLE1BQ1I7QUFFQSxZQUFNLFFBQVEsV0FBVztBQUV6QixZQUFNLHlCQUF5QixLQUFLLFdBQVcsV0FBVyxLQUFLLE1BQU07QUFFckUsWUFBTSwrQkFBK0IsS0FBSyw4QkFBOEIsS0FBSyxNQUFNO0FBQ25GLFlBQU0sZUFBZSxLQUFLLFdBQVcsV0FBVyxLQUFLLE1BQU07QUFDM0QsWUFBTSxzQkFBc0IsS0FBSyxvQkFBb0IsS0FBSyxNQUFNO0FBQ2hFLFlBQU0seUJBQXlCLGFBQWEsZUFBZSxhQUFhO0FBQ3hFLFlBQU0sMkJBQTJCLEtBQUssUUFBUSxvQkFBb0IsRUFBRSxzQkFBc0I7QUFDMUYsWUFBTSx5QkFBeUIsYUFBYSxjQUFjLGFBQWEsZUFBZSx5QkFBeUI7QUFDL0csWUFBTSwrQkFBK0IsVUFBVSxLQUFLLFFBQVEsb0JBQW9CLENBQUMsRUFBRSxhQUFhO0FBQ2hHLFlBQU0sOEJBQThCLFVBQVUsS0FBSyxRQUFRLG9CQUFvQixDQUFDLEVBQUUsYUFBYSx5QkFBeUI7QUFDeEgsWUFBTSxzQkFBc0IsS0FBSyxJQUFJLGFBQWEsZUFBZSxLQUFLLHFCQUFxQixHQUFHO0FBQzlGLFlBQU0seUJBQXlCO0FBQy9CLFlBQU0sd0JBQXdCLHlCQUF5QjtBQUV2RCxZQUFNLFlBQVksS0FBSyx3QkFBd0IsS0FBSyxNQUFNO0FBRTFELFlBQU0sdUJBQXVCLEtBQUs7QUFBQTtBQUFBLFFBRWpDLHlCQUF5Qix5QkFBeUIseUJBQXlCLEtBQUssSUFBSSxHQUFHLHNCQUFzQixxQkFBcUI7QUFBQTtBQUFBLFFBRWxJLEtBQUs7QUFBQSxVQUNKLFlBQVksZ0JBQWdCLEtBQUssWUFBWSxXQUFXLE1BQU0sSUFBSSxLQUFLO0FBQUEsVUFDdkUseUJBQXlCO0FBQUEsUUFDMUI7QUFBQSxNQUNEO0FBQ0EsWUFBTSw4QkFBOEIsS0FBSyxJQUFJLCtCQUErQixzQkFBc0Isb0JBQW9CO0FBRXRILFlBQU0sa0JBQWtCLCtCQUErQix1QkFBdUIsc0JBQXNCO0FBRXBHLFlBQU0sT0FBTyx1QkFBdUI7QUFFcEMsVUFBSTtBQUNKLFVBQUk7QUFDSixVQUFJLDhCQUE4Qix3QkFBd0I7QUFDekQseUNBQWlDO0FBQ2pDLG9CQUFZLGFBQWEsY0FBYyw4QkFBOEI7QUFBQSxNQUN0RSxPQUFPO0FBQ04seUNBQWlDLHlCQUF5QjtBQUMxRCxvQkFBWSxhQUFhO0FBQUEsTUFDMUI7QUFFQSxZQUFNLGVBQWUsS0FBSywrQkFBK0IsS0FBSyxNQUFNLEtBQUssS0FBSyxRQUFRLG9CQUFvQixNQUFNLGVBQWUsSUFBSSxLQUFLLFdBQVcsVUFBVSxLQUFLLE1BQU07QUFDeEssWUFBTSxrQkFBa0IsS0FBSyw2QkFBNkIsS0FBSyxNQUFNLEtBQUssS0FBSyxRQUFRLHVCQUF1QixNQUFNLHlCQUF5QixDQUFDLElBQUksS0FBSyxXQUFXLFVBQVUsS0FBSyxNQUFNO0FBR3ZMLFlBQU0sV0FBVyxhQUFhLGNBQWM7QUFFNUMsVUFBSSxXQUFXLEtBQUssdUJBQXVCLFVBQVUsY0FBYyxXQUFXLGVBQWU7QUFDN0YsWUFBTSxjQUFjLFNBQVMsV0FBVztBQUN4QyxVQUFJLENBQUMsYUFBYTtBQUNqQixtQkFBVyxTQUFTLFdBQVcsa0JBQWtCLGtCQUFrQjtBQUFBLE1BQ3BFO0FBRUEsWUFBTSxhQUFhLEtBQUssUUFBUSxVQUFVLGFBQWEsVUFBVSxJQUFJLFdBQVcsa0JBQWtCO0FBQ2xHLFlBQU0sYUFBYSxrQkFBa0I7QUFDckMsWUFBTSxzQkFBc0IsS0FBSyxJQUFJLFlBQVksVUFBVTtBQUUzRCxZQUFNLFVBQVUsU0FBUztBQUN6QixZQUFNLGVBQWU7QUFDckIsWUFBTSxxQkFBcUIsS0FBSyxJQUFJLHNCQUFzQixzQkFBc0IsOEJBQThCLGFBQWEsUUFBUSxhQUFhLGNBQWMsWUFBWTtBQUUxSyxVQUFJLFdBQVcsS0FBSyx1QkFBdUIsU0FBUyxRQUFRLGNBQWMsY0FBYyxvQkFBb0IsbUJBQW1CO0FBQy9ILFVBQUksQ0FBQyxhQUFhO0FBQ2pCLG1CQUFXLFNBQVMsV0FBVyxrQkFBa0Isa0JBQWtCLEVBQUUsV0FBVyxxQkFBcUIsWUFBWTtBQUFBLE1BQ2xILE9BQU87QUFFTixtQkFBVyxTQUFTLFdBQVcsa0JBQWtCLGtCQUFrQixFQUFFLFdBQVcsZ0JBQWdCO0FBQUEsTUFDakc7QUFJQSxhQUFPO0FBQUEsUUFDTjtBQUFBLFFBQ0E7QUFBQSxRQUNBLGdCQUFnQjtBQUFBLFFBQ2hCLGFBQWEsYUFBYTtBQUFBLFFBRTFCO0FBQUEsUUFDQTtBQUFBLFFBQ0Esa0JBQWtCO0FBQUEsUUFDbEI7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUVELFNBQVEsMEJBQTBCLHVCQUF1QixJQUFJLEtBQUssV0FBVyxNQUFNO0FBQ25GLFNBQWlCLHNCQUFzQixLQUFLLDBCQUEwQixvQkFBb0IsS0FBSyx3QkFBd0IsK0JBQStCLE1BQU0sS0FBSyx3QkFBeUIsd0JBQXdCLElBQUksZ0JBQWdCLENBQUM7QUFFdk8sU0FBaUIsa0JBQWtCLFFBQVEsWUFBVTtBQUNwRCxVQUFJLENBQUMsaUJBQWlCO0FBQ3JCLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTSxRQUFRLEtBQUssTUFBTSxLQUFLLE1BQU0sR0FBRztBQUN2QyxVQUFJLENBQUMsT0FBTztBQUNYLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTSxxQkFBcUIsS0FBSyxvQkFBb0IsS0FBSyxNQUFNO0FBQy9ELFlBQU0sTUFBTSxLQUFLLFFBQVEsb0JBQW9CLE1BQU0sZUFBZSxJQUFJLEtBQUssV0FBVyxVQUFVLEtBQUssTUFBTTtBQUMzRyxVQUFJLE9BQU8sb0JBQW9CO0FBQzlCLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTSxTQUFTLEtBQUssUUFBUSxvQkFBb0IsTUFBTSxzQkFBc0IsSUFBSSxLQUFLLFdBQVcsVUFBVSxLQUFLLE1BQU07QUFDckgsVUFBSSxVQUFVLEtBQUssV0FBVyxXQUFXLEtBQUssTUFBTSxFQUFFLFFBQVE7QUFDN0QsZUFBTztBQUFBLE1BQ1I7QUFDQSxhQUFPO0FBQUEsSUFDUixDQUFDO0FBRUQsU0FBaUIsMkJBQTJCLG9CQUFvQixNQUFNLEtBQUssY0FBYyx1QkFBdUIsTUFBTTtBQUNySCxhQUFPLEtBQUssY0FBYyxjQUFjLEVBQUUsU0FBUyx1QkFBdUIsS0FBSyxNQUFNO0FBQUEsSUFDdEYsQ0FBQztBQUVELFNBQWlCLGlCQUFpQixFQUFFLElBQUk7QUFBQSxNQUN2QyxXQUFXO0FBQUEsTUFDWCxPQUFPLEVBQUUsVUFBVSxXQUFXLGVBQWUsUUFBUSxVQUFVLFdBQVc7QUFBQSxJQUMzRSxHQUFHO0FBQUEsTUFDRixFQUFFLFFBQVEsUUFBUTtBQUFBLFFBQ2pCLE9BQU87QUFBQSxRQUNQLEdBQUcsUUFBUSxZQUFVO0FBQ3BCLGdCQUFNLGFBQWEsS0FBSyx5QkFBeUIsS0FBSyxNQUFNO0FBQzVELGNBQUksQ0FBQyxZQUFZO0FBQ2hCLG1CQUFPO0FBQUEsVUFDUjtBQUNBLGdCQUFNQywyQkFBMEIsS0FBSyx5QkFBeUIsS0FBSyxNQUFNO0FBQ3pFLGNBQUlBLHlCQUF3QixjQUFjLEdBQUc7QUFDNUMsbUJBQU87QUFBQSxVQUNSO0FBRUEsaUJBQU8sSUFBSSxZQUFZLEVBQ3JCLE9BQU8sV0FBVyxTQUFTLFlBQVksQ0FBQyxFQUN4QyxPQUFPLFdBQVcsU0FBUyxZQUFZLEVBQUUsT0FBTyxHQUFJLENBQUMsRUFDckQsT0FBTyxXQUFXLFNBQVMsZUFBZSxFQUFFLE9BQU8sR0FBSSxDQUFDLEVBQ3hELE9BQU8sV0FBVyxTQUFTLGVBQWUsQ0FBQyxFQUMzQyxNQUFNO0FBQUEsUUFDVCxDQUFDO0FBQUEsUUFDRCxPQUFPO0FBQUEsVUFDTixNQUFNLHlCQUF5QixrQkFBa0IsYUFBYTtBQUFBLFFBQy9EO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDLEVBQUUsWUFBWSxLQUFLLE1BQU07QUFFMUIsU0FBaUIsbUJBQW1CLEVBQUUsSUFBSTtBQUFBLE1BQ3pDLE9BQU8sRUFBRSxlQUFlLFFBQVEsU0FBUyxLQUFLLHlCQUF5QixJQUFJLGdCQUFjLFlBQVksY0FBYyxTQUFTLE9BQU8sRUFBRTtBQUFBLElBQ3RJLEdBQUcsUUFBUSxZQUFVO0FBQ3BCLFlBQU0sZ0JBQWdCLFlBQVksS0FBSyx3QkFBd0IsRUFBRSxLQUFLLE1BQU07QUFDNUUsVUFBSSxDQUFDLGVBQWU7QUFBRSxlQUFPO0FBQUEsTUFBVztBQUV4QyxZQUFNLGdCQUFnQix1QkFBdUIsS0FBSyxVQUFVLEVBQUUsSUFBSSxRQUFNLEdBQUcsWUFBWSxZQUFZLGNBQWMsRUFBRSxDQUFDLEVBQUU7QUFDdEgsWUFBTSx5QkFBeUIsR0FBRyxlQUFlLHNCQUFzQixZQUFZLGNBQWMsZ0JBQWdCLENBQUM7QUFFbEgsWUFBTSxnQkFBZ0IsY0FBYyxLQUFLLE1BQU0sRUFBRSxtQkFBbUI7QUFDcEUsWUFBTSxrQkFBa0IsY0FBYyxJQUFJLGdCQUFjLFdBQVcsU0FBUyxTQUFTLFdBQVcsU0FBUyxNQUFNO0FBQy9HLFlBQU0scUJBQXFCLGdCQUFnQixJQUFJLGVBQWU7QUFJOUQsWUFBTSxlQUFlLGNBQWMsSUFBSSxnQkFBYyxLQUFLO0FBQUEsUUFDekQsV0FBVyxjQUFjLGdCQUFnQjtBQUFBLFFBQ3pDLFdBQVcsU0FBUztBQUFBLFFBQ3BCLFdBQVc7QUFBQSxRQUNYLFdBQVcsU0FBUyxTQUFTO0FBQUEsTUFDOUIsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUVkLFlBQU0sbUJBQW1CLElBQUksWUFBWSxhQUFhLE1BQU0sT0FBTyxnQkFBZ0I7QUFDbkYsWUFBTSxjQUFjLGNBQWMsSUFBSSxnQkFBYyxXQUFXLFNBQVMsb0JBQW9CLGdCQUFnQixDQUFDO0FBQzdHLFlBQU0sZ0JBQWdCLFlBQVksSUFBSSxDQUFBQyxpQkFBZUEsYUFBWSxXQUFXLHdCQUF3QixHQUFHLHdCQUF3QixzQkFBc0IsRUFBRSxvQkFBb0IsZ0JBQWdCLENBQUM7QUFFNUwsWUFBTSxpQkFBaUIsWUFBWSxJQUFJLENBQUFBLGlCQUFlLEtBQUssdUJBQXVCQSxhQUFZLFFBQVEscUJBQXFCLGNBQWNBLGFBQVksU0FBUyxjQUFjLG9CQUFvQixrQkFBa0IsRUFBRSxvQkFBb0IsZ0JBQWdCLENBQUM7QUFFelAsYUFBTztBQUFBLFFBQ04sRUFBRSxJQUFJO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsWUFDTixHQUFHLGNBQWMsS0FBSyxNQUFNLEVBQUUsU0FBUztBQUFBLFlBQ3ZDLFdBQVc7QUFBQSxZQUNYLGNBQWMsR0FBRyxhQUFhLFVBQVUsYUFBYTtBQUFBLFlBQ3JELFdBQVc7QUFBQSxZQUNYLGNBQWM7QUFBQSxZQUNkLFlBQVksZ0JBQWdCLFNBQVM7QUFBQSxVQUN0QztBQUFBLFFBQ0QsQ0FBQztBQUFBLFFBRUQsRUFBRSxJQUFJO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsWUFDTixHQUFHLFlBQVksS0FBSyxNQUFNLEVBQUUsU0FBUztBQUFBLFlBQ3JDLFdBQVc7QUFBQSxZQUNYLGNBQWMsR0FBRyxhQUFhLFVBQVUsYUFBYTtBQUFBLFlBQ3JELFdBQVc7QUFBQSxZQUNYLGNBQWM7QUFBQSxZQUNkLFlBQVksZ0JBQWdCLFNBQVM7QUFBQSxZQUNyQyxpQkFBaUIsY0FBYyx1QkFBdUI7QUFBQSxVQUN2RDtBQUFBLFFBQ0QsQ0FBQztBQUFBLFFBRUQsRUFBRSxJQUFJO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsWUFDTixlQUFlO0FBQUEsWUFDZixTQUFTLGdCQUFnQixJQUFJLGFBQVcsVUFBVSxVQUFVLE1BQU07QUFBQSxZQUNsRSxHQUFHLGVBQWUsS0FBSyxNQUFNLEVBQUUsU0FBUztBQUFBLFVBQ3pDO0FBQUEsUUFDRCxHQUFHO0FBQUEsVUFDRixFQUFFLElBQUk7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE9BQU87QUFBQSxjQUNOLFVBQVU7QUFBQSxjQUFZLEtBQUs7QUFBQSxjQUFPLE1BQU07QUFBQSxjQUFPLE9BQU87QUFBQSxjQUFRLFFBQVE7QUFBQSxjQUN0RSxpQkFBaUIsc0JBQXNCLHlCQUF5QixLQUFLLGFBQWEsRUFBRSxJQUFJLE9BQUssRUFBRSxTQUFTLENBQUM7QUFBQSxZQUMxRztBQUFBLFVBQ0QsQ0FBQztBQUFBLFVBQ0QsRUFBRSxJQUFJO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxPQUFPO0FBQUEsY0FDTixVQUFVO0FBQUEsY0FBWSxLQUFLO0FBQUEsY0FBTyxNQUFNO0FBQUEsY0FBTyxPQUFPO0FBQUEsY0FBUSxRQUFRO0FBQUEsY0FDdEUsV0FBVztBQUFBLGNBQ1gsV0FBVztBQUFBLGNBQ1gsYUFBYTtBQUFBLGNBQ2IsY0FBYztBQUFBLGNBQ2QsaUJBQWlCLGNBQWMsZ0JBQWdCO0FBQUEsWUFDaEQ7QUFBQSxVQUNELENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELEVBQUUsSUFBSTtBQUFBLFVBQ0wsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFlBQ04sR0FBRyxhQUFhLFNBQVM7QUFBQSxZQUN6QixpQkFBaUIsY0FBYyxnQkFBZ0I7QUFBQSxVQUNoRDtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNELENBQUMsQ0FBQyxFQUFFLFlBQVksS0FBSyxNQUFNO0FBRTNCLFNBQWlCLG1CQUFtQixFQUFFLElBQUk7QUFBQSxNQUN6QyxPQUFPLEVBQUUsZUFBZSxPQUFRO0FBQUEsSUFDakMsR0FBRyxRQUFRLFlBQVU7QUFDcEIsWUFBTSxnQkFBZ0IsWUFBWSxLQUFLLHdCQUF3QixFQUFFLEtBQUssTUFBTTtBQUM1RSxVQUFJLENBQUMsZUFBZTtBQUFFLGVBQU87QUFBQSxNQUFXO0FBRXhDLFlBQU0sa0JBQWtCLGNBQWMsSUFBSSxnQkFBYyxXQUFXLFNBQVMsU0FBUyxXQUFXLFNBQVMsTUFBTTtBQUUvRyxZQUFNLGVBQWUsZ0JBQWdCLElBQUksYUFBVyxLQUFLLGFBQWEsTUFBTSxhQUFhLE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxJQUFJO0FBQzlILFlBQU0sZ0JBQWdCLHNCQUFzQix1QkFBdUIsS0FBSyxVQUFVLEdBQUcsS0FBSyxhQUFhLEVBQUUsSUFBSSxPQUFLLGFBQWEsRUFBRSxTQUFTLENBQUMsRUFBRTtBQUM3SSxZQUFNLHlCQUF5QixHQUFHLGVBQWUsc0JBQXNCLFlBQVksY0FBYyxnQkFBZ0IsQ0FBQztBQUVsSCxZQUFNLGNBQWMsY0FBYyxJQUFJLGdCQUFjLFdBQVcsU0FBUyxXQUFXLEdBQUcsWUFBWSxDQUFDO0FBQ25HLFlBQU0sZ0JBQWdCLFlBQVksSUFBSSxDQUFBQSxpQkFBZUEsYUFBWSxXQUFXLHdCQUF3Qix3QkFBd0Isd0JBQXdCLENBQUMsQ0FBQztBQUV0SixZQUFNLGdCQUFnQixRQUFRLENBQUFGLFlBQVU7QUFDdkMsY0FBTSxVQUFVLFlBQVksS0FBS0EsT0FBTTtBQUN2QyxjQUFNLGFBQWEsY0FBYyxLQUFLQSxPQUFNO0FBQzVDLFlBQUksQ0FBQyxXQUFXLGVBQWUsV0FBVyxlQUFlLFFBQVEsTUFBTTtBQUN0RSxpQkFBTyxLQUFLLHVCQUF1QixRQUFRLE1BQU0sUUFBUSxLQUFLLEdBQUcsQ0FBQztBQUFBLFFBQ25FO0FBQ0EsZUFBTyxJQUFJLEtBQUssV0FBVyxhQUFhLFFBQVEsS0FBSyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsQ0FBQztBQUFBLE1BQ2xHLENBQUM7QUFFRCxhQUFPO0FBQUEsUUFDTixFQUFFLElBQUk7QUFBQSxVQUNMLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxZQUNOLEdBQUcsY0FBYyxLQUFLLE1BQU0sRUFBRSxTQUFTO0FBQUEsWUFDdkMsaUJBQWlCLHVCQUF1QixLQUFLLFVBQVUsRUFBRSxJQUFJLE9BQUssY0FBYyxDQUFDLENBQUM7QUFBQSxVQUNuRjtBQUFBLFFBQ0QsQ0FBQztBQUFBLFFBQ0QsRUFBRSxJQUFJO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsWUFDTixHQUFHLGNBQWMsS0FBSyxNQUFNLEVBQUUsU0FBUztBQUFBLFlBQ3ZDO0FBQUEsWUFDQSxXQUFXO0FBQUEsWUFDWCxjQUFjO0FBQUEsWUFDZCxhQUFhO0FBQUEsWUFDYixXQUFXO0FBQUEsVUFDWjtBQUFBLFFBQ0QsQ0FBQztBQUFBLFFBQ0QsRUFBRSxJQUFJO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsWUFDTixHQUFHLFlBQVksS0FBSyxNQUFNLEVBQUUsU0FBUztBQUFBLFlBQ3JDO0FBQUEsWUFDQSxRQUFRO0FBQUEsWUFDUixXQUFXO0FBQUEsWUFDWCxpQkFBaUIsY0FBYyx1QkFBdUI7QUFBQSxVQUN2RDtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNELENBQUMsQ0FBQyxFQUFFLFlBQVksS0FBSyxNQUFNO0FBRTNCLFNBQWlCLG1CQUFtQixFQUFFLElBQUk7QUFBQSxNQUN6QyxPQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixTQUFTLEtBQUs7QUFBQSxNQUNmO0FBQUEsSUFDRCxHQUFHO0FBQUEsTUFDRixLQUFLO0FBQUEsTUFDTCxRQUFRLE1BQU0sWUFBVSxLQUFLLGdCQUFnQixLQUFLLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLGtCQUFrQixLQUFLLGtCQUFrQixLQUFLLGdCQUFnQixDQUFDO0FBQUEsSUFDdkksQ0FBQyxFQUFFLFlBQVksS0FBSyxNQUFNO0FBamdCekIsU0FBSyxVQUFVLEtBQUssV0FBVyxvQkFBb0I7QUFBQSxNQUNsRCxTQUFTLEtBQUssaUJBQWlCO0FBQUEsTUFDL0IsVUFBVSxnQkFBZ0IsSUFBSTtBQUFBLE1BQzlCLHFCQUFxQjtBQUFBLE1BQ3JCLHFCQUFxQixRQUFRLFlBQVU7QUFDdEMsY0FBTSxJQUFJLEtBQUsseUJBQXlCLEtBQUssTUFBTSxHQUFHO0FBQ3RELFlBQUksTUFBTSxRQUFXO0FBQUUsaUJBQU87QUFBQSxRQUFHO0FBQ2pDLGVBQU87QUFBQSxNQUNSLENBQUM7QUFBQSxJQUNGLENBQUMsQ0FBQztBQUVGLFNBQUssY0FBYyxTQUFTLEtBQUssaUJBQWlCO0FBRWxELFNBQUssVUFBVSxRQUFRLFlBQVU7QUFDaEMsWUFBTSxhQUFhLEtBQUsseUJBQXlCLEtBQUssTUFBTTtBQUM1RCxVQUFJLENBQUMsWUFBWTtBQUNoQjtBQUFBLE1BQ0Q7QUFDQSxZQUFNLGFBQWEsV0FBVyxTQUFTLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0I7QUFFeEYsV0FBSyxjQUFjLE9BQU87QUFBQSxRQUFFLFFBQVEsV0FBVztBQUFBLFFBQVEsT0FBTyxXQUFXLHFCQUFxQjtBQUFBO0FBQUEsTUFBdUQsQ0FBQztBQUN0SixXQUFLLGlCQUFpQixRQUFRLE1BQU0sTUFBTSxHQUFHLFdBQVcsR0FBRztBQUMzRCxXQUFLLGlCQUFpQixRQUFRLE1BQU0sT0FBTyxHQUFHLFdBQVcsSUFBSTtBQUM3RCxXQUFLLGlCQUFpQixRQUFRLE1BQU0sUUFBUSxHQUFHLFdBQVcscUJBQXFCLGtCQUFrQjtBQUFBLElBRWxHLENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxRQUFRLFlBQVU7QUFDaEMsWUFBTSxhQUFhLEtBQUsseUJBQXlCLEtBQUssTUFBTTtBQUM1RCxVQUFJLENBQUMsWUFBWTtBQUNoQjtBQUFBLE1BQ0Q7QUFFQSxXQUFLLGtCQUFrQixPQUFPLGNBQWMsV0FBVyw4QkFBOEI7QUFBQSxJQUN0RixDQUFDLENBQUM7QUFFRixTQUFLLHFCQUFxQiw4QkFBOEIsS0FBSyxNQUFNO0FBQUEsRUFDcEU7QUFBQTtBQUFBLEVBdkVBLE9BQU8sbUJBQW1CLFFBQXFCLFdBQXVCLE1BQTZCLHNCQUFpQyxRQUEwQjtBQUM3SixVQUFNLFlBQVkscUJBQXFCLE1BQU07QUFDN0MsVUFBTSxjQUFjLFVBQVUsZ0JBQWdCLEtBQUssTUFBTTtBQUN6RCxVQUFNLG9CQUFvQixVQUFVLHNCQUFzQixLQUFLLE1BQU07QUFDckUsVUFBTSwwQkFBMEIsT0FBTyxjQUFjLEVBQUU7QUFDdkQsVUFBTSxlQUFlLFVBQVUsa0JBQWtCLEtBQUssTUFBTSxFQUFFLGdCQUFnQixJQUFJLFVBQVUsa0JBQWtCLEtBQUssTUFBTSxFQUFFLGVBQWU7QUFFMUksVUFBTSxxQkFBcUI7QUFBQSxNQUF1QjtBQUFBLE1BQVc7QUFBQSxNQUFzQjtBQUFBO0FBQUEsSUFBMkQ7QUFDOUksVUFBTSxxQkFBcUIsS0FBSyxTQUFTLFNBQVMsT0FBTyxDQUFDLEtBQUssU0FBUyxLQUFLLElBQUksS0FBSyxzQkFBc0IsTUFBTSxRQUFRLFNBQVMsQ0FBQyxHQUFHLENBQUM7QUFDeEksVUFBTSxrQkFBa0I7QUFDeEIsVUFBTSxrQkFBa0IsdUJBQXVCLElBQUk7QUFFbkQsV0FBTyxxQkFBcUIscUJBQXFCLGtCQUFrQixrQkFBa0IsY0FBYyxvQkFBb0IsMEJBQTBCO0FBQUEsRUFDbEo7QUF1aEJEO0FBdmlCYSw0QkFBTjtBQUFBLEVBZ0NKO0FBQUEsRUFDQTtBQUFBLEdBakNVOyIsCiAgIm5hbWVzIjogWyJyZWFkZXIiLCAib3JpZ2luYWxCYWNrZ3JvdW5kQ29sb3IiLCAib3ZlcmxheVJlY3QiXQp9Cg==
