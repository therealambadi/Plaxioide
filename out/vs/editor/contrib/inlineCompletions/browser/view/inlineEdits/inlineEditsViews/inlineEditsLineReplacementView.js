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
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun, autorunDelta, constObservable, derived } from "../../../../../../../base/common/observable.js";
import { editorBackground, scrollbarShadow } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { EditorMouseEvent } from "../../../../../../browser/editorDom.js";
import { Point } from "../../../../../../browser/point.js";
import { Rect } from "../../../../../../browser/rect.js";
import { LineSource, renderLines, RenderOptions } from "../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { Range } from "../../../../../../common/core/range.js";
import { ILanguageService } from "../../../../../../common/languages/language.js";
import { TrackedRangeStickiness } from "../../../../../../common/model.js";
import { LineTokens } from "../../../../../../common/tokens/lineTokens.js";
import { TokenArray } from "../../../../../../common/tokens/tokenArray.js";
import { InlineDecoration, InlineDecorationType } from "../../../../../../common/viewModel.js";
import { getEditorBlendedColor, getModifiedBorderColor, getOriginalBorderColor, modifiedChangedLineBackgroundColor, originalBackgroundColor } from "../theme.js";
import { getPrefixTrim, mapOutFalsy, rectToProps } from "../utils/utils.js";
let InlineEditsLineReplacementView = class extends Disposable {
  constructor(_editor, _edit, _tabAction, _languageService, _themeService) {
    super();
    this._editor = _editor;
    this._edit = _edit;
    this._tabAction = _tabAction;
    this._languageService = _languageService;
    this._themeService = _themeService;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._originalBubblesDecorationCollection = this._editor.editor.createDecorationsCollection();
    this._originalBubblesDecorationOptions = {
      description: "inlineCompletions-original-bubble",
      className: "inlineCompletions-original-bubble",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    };
    this._maxPrefixTrim = this._edit.map((e) => e ? getPrefixTrim(e.replacements.flatMap((r) => [r.originalRange, r.modifiedRange]), e.originalRange, e.modifiedLines, this._editor.editor) : void 0);
    this._modifiedLineElements = derived((reader) => {
      const lines = [];
      let requiredWidth = 0;
      const prefixTrim = this._maxPrefixTrim.read(reader);
      const edit = this._edit.read(reader);
      if (!edit || !prefixTrim) {
        return void 0;
      }
      const maxPrefixTrim = prefixTrim.prefixTrim;
      const modifiedBubbles = rangesToBubbleRanges(edit.replacements.map((r) => r.modifiedRange)).map((r) => new Range(r.startLineNumber, r.startColumn - maxPrefixTrim, r.endLineNumber, r.endColumn - maxPrefixTrim));
      const textModel = this._editor.model.get();
      const startLineNumber = edit.modifiedRange.startLineNumber;
      for (let i = 0; i < edit.modifiedRange.length; i++) {
        const line = document.createElement("div");
        const lineNumber = startLineNumber + i;
        const modLine = edit.modifiedLines[i].slice(maxPrefixTrim);
        const t = textModel.tokenization.tokenizeLinesAt(lineNumber, [modLine])?.[0];
        let tokens;
        if (t) {
          tokens = TokenArray.fromLineTokens(t).toLineTokens(modLine, this._languageService.languageIdCodec);
        } else {
          tokens = LineTokens.createEmpty(modLine, this._languageService.languageIdCodec);
        }
        const decorations = [];
        for (const modified of modifiedBubbles.filter((b) => b.startLineNumber === lineNumber)) {
          const validatedEndColumn = Math.min(modified.endColumn, modLine.length + 1);
          decorations.push(new InlineDecoration(new Range(1, modified.startColumn, 1, validatedEndColumn), "inlineCompletions-modified-bubble", InlineDecorationType.Regular));
          decorations.push(new InlineDecoration(new Range(1, modified.startColumn, 1, modified.startColumn + 1), "start", InlineDecorationType.Regular));
          decorations.push(new InlineDecoration(new Range(1, validatedEndColumn - 1, 1, validatedEndColumn), "end", InlineDecorationType.Regular));
        }
        const result = renderLines(new LineSource([tokens]), RenderOptions.fromEditor(this._editor.editor).withSetWidth(false).withScrollBeyondLastColumn(0), decorations, line, true);
        this._editor.getOption(EditorOption.fontInfo).read(reader);
        requiredWidth = Math.max(requiredWidth, result.minWidthInPx);
        lines.push(line);
      }
      return { lines, requiredWidth };
    });
    this._layout = derived(this, (reader) => {
      const modifiedLines = this._modifiedLineElements.read(reader);
      const maxPrefixTrim = this._maxPrefixTrim.read(reader);
      const edit = this._edit.read(reader);
      if (!modifiedLines || !maxPrefixTrim || !edit) {
        return void 0;
      }
      const { prefixLeftOffset } = maxPrefixTrim;
      const { requiredWidth } = modifiedLines;
      const lineHeight = this._editor.getOption(EditorOption.lineHeight).read(reader);
      const contentLeft = this._editor.layoutInfoContentLeft.read(reader);
      const verticalScrollbarWidth = this._editor.layoutInfoVerticalScrollbarWidth.read(reader);
      const scrollLeft = this._editor.scrollLeft.read(reader);
      const scrollTop = this._editor.scrollTop.read(reader);
      const editorLeftOffset = contentLeft - scrollLeft;
      const textModel = this._editor.editor.getModel();
      const originalLineWidths = edit.originalRange.mapToLineArray((line) => this._editor.editor.getOffsetForColumn(line, textModel.getLineMaxColumn(line)) - prefixLeftOffset);
      const maxLineWidth = Math.max(...originalLineWidths, requiredWidth);
      const startLineNumber = edit.originalRange.startLineNumber;
      const endLineNumber = edit.originalRange.endLineNumberExclusive - 1;
      const topOfOriginalLines = this._editor.editor.getTopForLineNumber(startLineNumber) - scrollTop;
      const bottomOfOriginalLines = this._editor.editor.getBottomForLineNumber(endLineNumber) - scrollTop;
      const originalLinesOverlay = Rect.fromLeftTopWidthHeight(
        editorLeftOffset + prefixLeftOffset,
        topOfOriginalLines,
        maxLineWidth,
        bottomOfOriginalLines - topOfOriginalLines
      );
      const modifiedLinesOverlay = Rect.fromLeftTopWidthHeight(
        originalLinesOverlay.left,
        originalLinesOverlay.bottom,
        originalLinesOverlay.width,
        edit.modifiedRange.length * lineHeight
      );
      const background = Rect.hull([originalLinesOverlay, modifiedLinesOverlay]);
      const lowerBackground = background.intersectVertical(new OffsetRange(originalLinesOverlay.bottom, Number.MAX_SAFE_INTEGER));
      const lowerText = new Rect(lowerBackground.left, lowerBackground.top, lowerBackground.right, lowerBackground.bottom);
      return {
        originalLinesOverlay,
        modifiedLinesOverlay,
        background,
        lowerBackground,
        lowerText,
        minContentWidthRequired: prefixLeftOffset + maxLineWidth + verticalScrollbarWidth
      };
    });
    this._viewZoneInfo = derived((reader) => {
      const shouldShowViewZone = this._editor.getOption(EditorOption.inlineSuggest).map((o) => o.edits.allowCodeShifting === "always").read(reader);
      if (!shouldShowViewZone) {
        return void 0;
      }
      const layout = this._layout.read(reader);
      const edit = this._edit.read(reader);
      if (!layout || !edit) {
        return void 0;
      }
      const viewZoneHeight = layout.lowerBackground.height;
      const viewZoneLineNumber = edit.originalRange.endLineNumberExclusive;
      return { height: viewZoneHeight, lineNumber: viewZoneLineNumber };
    });
    this._div = n.div({
      class: "line-replacement"
    }, [
      derived((reader) => {
        const layout = mapOutFalsy(this._layout).read(reader);
        const modifiedLineElements = this._modifiedLineElements.read(reader);
        if (!layout || !modifiedLineElements) {
          return [];
        }
        const layoutProps = layout.read(reader);
        const contentLeft = this._editor.layoutInfoContentLeft.read(reader);
        const contentWidth = this._editor.contentWidth.read(reader);
        const contentHeight = this._editor.editor.getContentHeight();
        const lineHeight = this._editor.getOption(EditorOption.lineHeight).read(reader);
        modifiedLineElements.lines.forEach((l) => {
          l.style.width = `${layoutProps.lowerText.width}px`;
          l.style.height = `${lineHeight}px`;
          l.style.position = "relative";
        });
        const modifiedBorderColor = getModifiedBorderColor(this._tabAction).read(reader);
        const originalBorderColor = getOriginalBorderColor(this._tabAction).read(reader);
        return [
          n.div({
            style: {
              position: "absolute",
              top: 0,
              left: contentLeft,
              width: contentWidth,
              height: contentHeight,
              overflow: "hidden",
              pointerEvents: "none"
            }
          }, [
            n.div({
              class: "originalOverlayLineReplacement",
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).background.translateX(-contentLeft)),
                borderRadius: "4px",
                border: getEditorBlendedColor(originalBorderColor, this._themeService).map((c) => `1px solid ${c.toString()}`),
                pointerEvents: "none",
                boxSizing: "border-box",
                background: asCssVariable(originalBackgroundColor)
              }
            }),
            n.div({
              class: "modifiedOverlayLineReplacement",
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).lowerBackground.translateX(-contentLeft)),
                borderRadius: "4px",
                background: asCssVariable(editorBackground),
                boxShadow: `${asCssVariable(scrollbarShadow)} 0 6px 6px -6px`,
                border: `1px solid ${asCssVariable(modifiedBorderColor)}`,
                boxSizing: "border-box",
                overflow: "hidden",
                cursor: "pointer",
                pointerEvents: "auto"
              },
              onmousedown: (e) => {
                e.preventDefault();
              },
              onclick: (e) => this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e))
            }, [
              n.div({
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  background: asCssVariable(modifiedChangedLineBackgroundColor)
                }
              })
            ]),
            n.div({
              class: "modifiedLinesLineReplacement",
              style: {
                position: "absolute",
                boxSizing: "border-box",
                ...rectToProps((reader2) => layout.read(reader2).lowerText.translateX(-contentLeft)),
                fontFamily: this._editor.getOption(EditorOption.fontFamily),
                fontSize: this._editor.getOption(EditorOption.fontSize),
                fontWeight: this._editor.getOption(EditorOption.fontWeight),
                pointerEvents: "none",
                whiteSpace: "nowrap",
                borderRadius: "4px",
                overflow: "hidden"
              }
            }, [...modifiedLineElements.lines])
          ])
        ];
      })
    ]).keepUpdated(this._store);
    this.isHovered = this._editor.isTargetHovered((e) => this._isMouseOverWidget(e), this._store);
    // View Zones
    this._previousViewZoneInfo = void 0;
    this._register(toDisposable(() => this._originalBubblesDecorationCollection.clear()));
    this._register(toDisposable(() => this._editor.editor.changeViewZones((accessor) => this.removePreviousViewZone(accessor))));
    this._register(autorunDelta(this._viewZoneInfo, ({ lastValue, newValue }) => {
      if (lastValue === newValue || lastValue?.height === newValue?.height && lastValue?.lineNumber === newValue?.lineNumber) {
        return;
      }
      this._editor.editor.changeViewZones((changeAccessor) => {
        this.removePreviousViewZone(changeAccessor);
        if (!newValue) {
          return;
        }
        this.addViewZone(newValue, changeAccessor);
      });
    }));
    this._register(autorun((reader) => {
      const edit = this._edit.read(reader);
      const originalBubbles = [];
      if (edit) {
        originalBubbles.push(...rangesToBubbleRanges(edit.replacements.map((r) => r.originalRange)));
      }
      this._originalBubblesDecorationCollection.set(originalBubbles.map((r) => ({ range: r, options: this._originalBubblesDecorationOptions })));
    }));
    this._register(this._editor.createOverlayWidget({
      domNode: this._div.element,
      minContentWidthInPx: derived((reader) => {
        return this._layout.read(reader)?.minContentWidthRequired ?? 0;
      }),
      position: constObservable({ preference: { top: 0, left: 0 } }),
      allowEditorOverflow: false
    }));
  }
  _isMouseOverWidget(e) {
    const layout = this._layout.get();
    if (!layout || !(e.event instanceof EditorMouseEvent)) {
      return false;
    }
    return layout.lowerBackground.containsPoint(new Point(e.event.relativePos.x, e.event.relativePos.y));
  }
  removePreviousViewZone(changeAccessor) {
    if (!this._previousViewZoneInfo) {
      return;
    }
    changeAccessor.removeZone(this._previousViewZoneInfo.id);
    const cursorLineNumber = this._editor.cursorLineNumber.get();
    if (cursorLineNumber !== null && cursorLineNumber >= this._previousViewZoneInfo.lineNumber) {
      this._editor.editor.setScrollTop(this._editor.scrollTop.get() - this._previousViewZoneInfo.height);
    }
    this._previousViewZoneInfo = void 0;
  }
  addViewZone(viewZoneInfo, changeAccessor) {
    const activeViewZone = changeAccessor.addZone({
      afterLineNumber: viewZoneInfo.lineNumber - 1,
      heightInPx: viewZoneInfo.height,
      // move computation to layout?
      domNode: $("div")
    });
    this._previousViewZoneInfo = { height: viewZoneInfo.height, lineNumber: viewZoneInfo.lineNumber, id: activeViewZone };
    const cursorLineNumber = this._editor.cursorLineNumber.get();
    if (cursorLineNumber !== null && cursorLineNumber >= viewZoneInfo.lineNumber) {
      this._editor.editor.setScrollTop(this._editor.scrollTop.get() + viewZoneInfo.height);
    }
  }
};
InlineEditsLineReplacementView = __decorateClass([
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IThemeService)
], InlineEditsLineReplacementView);
function rangesToBubbleRanges(ranges) {
  const result = [];
  while (ranges.length) {
    let range = ranges.shift();
    if (range.startLineNumber !== range.endLineNumber) {
      ranges.push(new Range(range.startLineNumber + 1, 1, range.endLineNumber, range.endColumn));
      range = new Range(range.startLineNumber, range.startColumn, range.startLineNumber, Number.MAX_SAFE_INTEGER);
    }
    result.push(range);
  }
  return result;
}
export {
  InlineEditsLineReplacementView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c0xpbmVSZXBsYWNlbWVudFZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyAkLCBnZXRXaW5kb3csIG4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElNb3VzZUV2ZW50LCBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIGF1dG9ydW5EZWx0YSwgY29uc3RPYnNlcnZhYmxlLCBkZXJpdmVkLCBJT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgZWRpdG9yQmFja2dyb3VuZCwgc2Nyb2xsYmFyU2hhZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclV0aWxzLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JNb3VzZUV2ZW50LCBJVmlld1pvbmVDaGFuZ2VBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JEb20uanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFBvaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9wb2ludC5qcyc7XG5pbXBvcnQgeyBSZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9yZWN0LmpzJztcbmltcG9ydCB7IExpbmVTb3VyY2UsIHJlbmRlckxpbmVzLCBSZW5kZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2RpZmZFZGl0b3JWaWV3Wm9uZXMvcmVuZGVyTGluZXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBPZmZzZXRSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL29mZnNldFJhbmdlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTGluZVRva2VucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi90b2tlbnMvbGluZVRva2Vucy5qcyc7XG5pbXBvcnQgeyBUb2tlbkFycmF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL3Rva2Vucy90b2tlbkFycmF5LmpzJztcbmltcG9ydCB7IElubGluZURlY29yYXRpb24sIElubGluZURlY29yYXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSW5saW5lRWRpdHNWaWV3LCBJbmxpbmVFZGl0VGFiQWN0aW9uIH0gZnJvbSAnLi4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IGdldEVkaXRvckJsZW5kZWRDb2xvciwgZ2V0TW9kaWZpZWRCb3JkZXJDb2xvciwgZ2V0T3JpZ2luYWxCb3JkZXJDb2xvciwgbW9kaWZpZWRDaGFuZ2VkTGluZUJhY2tncm91bmRDb2xvciwgb3JpZ2luYWxCYWNrZ3JvdW5kQ29sb3IgfSBmcm9tICcuLi90aGVtZS5qcyc7XG5pbXBvcnQgeyBnZXRQcmVmaXhUcmltLCBtYXBPdXRGYWxzeSwgcmVjdFRvUHJvcHMgfSBmcm9tICcuLi91dGlscy91dGlscy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVFZGl0c0xpbmVSZXBsYWNlbWVudFZpZXcgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUlubGluZUVkaXRzVmlldyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbGljayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElNb3VzZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDbGljayA9IHRoaXMuX29uRGlkQ2xpY2suZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxCdWJibGVzRGVjb3JhdGlvbkNvbGxlY3Rpb24gPSB0aGlzLl9lZGl0b3IuZWRpdG9yLmNyZWF0ZURlY29yYXRpb25zQ29sbGVjdGlvbigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbEJ1YmJsZXNEZWNvcmF0aW9uT3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSB7XG5cdFx0ZGVzY3JpcHRpb246ICdpbmxpbmVDb21wbGV0aW9ucy1vcmlnaW5hbC1idWJibGUnLFxuXHRcdGNsYXNzTmFtZTogJ2lubGluZUNvbXBsZXRpb25zLW9yaWdpbmFsLWJ1YmJsZScsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0fTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXhQcmVmaXhUcmltID0gdGhpcy5fZWRpdC5tYXAoZSA9PiBlID8gZ2V0UHJlZml4VHJpbShlLnJlcGxhY2VtZW50cy5mbGF0TWFwKHIgPT4gW3Iub3JpZ2luYWxSYW5nZSwgci5tb2RpZmllZFJhbmdlXSksIGUub3JpZ2luYWxSYW5nZSwgZS5tb2RpZmllZExpbmVzLCB0aGlzLl9lZGl0b3IuZWRpdG9yKSA6IHVuZGVmaW5lZCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRMaW5lRWxlbWVudHMgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgbGluZXMgPSBbXTtcblx0XHRsZXQgcmVxdWlyZWRXaWR0aCA9IDA7XG5cblx0XHRjb25zdCBwcmVmaXhUcmltID0gdGhpcy5fbWF4UHJlZml4VHJpbS5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgZWRpdCA9IHRoaXMuX2VkaXQucmVhZChyZWFkZXIpO1xuXHRcdGlmICghZWRpdCB8fCAhcHJlZml4VHJpbSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBtYXhQcmVmaXhUcmltID0gcHJlZml4VHJpbS5wcmVmaXhUcmltO1xuXHRcdGNvbnN0IG1vZGlmaWVkQnViYmxlcyA9IHJhbmdlc1RvQnViYmxlUmFuZ2VzKGVkaXQucmVwbGFjZW1lbnRzLm1hcChyID0+IHIubW9kaWZpZWRSYW5nZSkpLm1hcChyID0+IG5ldyBSYW5nZShyLnN0YXJ0TGluZU51bWJlciwgci5zdGFydENvbHVtbiAtIG1heFByZWZpeFRyaW0sIHIuZW5kTGluZU51bWJlciwgci5lbmRDb2x1bW4gLSBtYXhQcmVmaXhUcmltKSk7XG5cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSB0aGlzLl9lZGl0b3IubW9kZWwuZ2V0KCkhO1xuXHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IGVkaXQubW9kaWZpZWRSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlZGl0Lm1vZGlmaWVkUmFuZ2UubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBzdGFydExpbmVOdW1iZXIgKyBpO1xuXHRcdFx0Y29uc3QgbW9kTGluZSA9IGVkaXQubW9kaWZpZWRMaW5lc1tpXS5zbGljZShtYXhQcmVmaXhUcmltKTtcblxuXHRcdFx0Y29uc3QgdCA9IHRleHRNb2RlbC50b2tlbml6YXRpb24udG9rZW5pemVMaW5lc0F0KGxpbmVOdW1iZXIsIFttb2RMaW5lXSk/LlswXTtcblx0XHRcdGxldCB0b2tlbnM6IExpbmVUb2tlbnM7XG5cdFx0XHRpZiAodCkge1xuXHRcdFx0XHR0b2tlbnMgPSBUb2tlbkFycmF5LmZyb21MaW5lVG9rZW5zKHQpLnRvTGluZVRva2Vucyhtb2RMaW5lLCB0aGlzLl9sYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRva2VucyA9IExpbmVUb2tlbnMuY3JlYXRlRW1wdHkobW9kTGluZSwgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIElubGluZSBkZWNvcmF0aW9ucyBhcmUgYnJva2VuIGRvd24gaW50byBpbmRpdmlkdWFsIHNwYW5zLiBUbyBiZSBhYmxlIHRvIHJlbmRlciByb3VuZGVkIGNvcm5lcnMsIHdlIG5lZWQgdG8gc2V0IHRoZSBzdGFydCBhbmQgZW5kIGRlY29yYXRpb25zIHNlcGFyYXRlbHkuXG5cdFx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBtb2RpZmllZCBvZiBtb2RpZmllZEJ1YmJsZXMuZmlsdGVyKGIgPT4gYi5zdGFydExpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdGNvbnN0IHZhbGlkYXRlZEVuZENvbHVtbiA9IE1hdGgubWluKG1vZGlmaWVkLmVuZENvbHVtbiwgbW9kTGluZS5sZW5ndGggKyAxKTtcblx0XHRcdFx0ZGVjb3JhdGlvbnMucHVzaChuZXcgSW5saW5lRGVjb3JhdGlvbihuZXcgUmFuZ2UoMSwgbW9kaWZpZWQuc3RhcnRDb2x1bW4sIDEsIHZhbGlkYXRlZEVuZENvbHVtbiksICdpbmxpbmVDb21wbGV0aW9ucy1tb2RpZmllZC1idWJibGUnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyKSk7XG5cdFx0XHRcdGRlY29yYXRpb25zLnB1c2gobmV3IElubGluZURlY29yYXRpb24obmV3IFJhbmdlKDEsIG1vZGlmaWVkLnN0YXJ0Q29sdW1uLCAxLCBtb2RpZmllZC5zdGFydENvbHVtbiArIDEpLCAnc3RhcnQnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyKSk7XG5cdFx0XHRcdGRlY29yYXRpb25zLnB1c2gobmV3IElubGluZURlY29yYXRpb24obmV3IFJhbmdlKDEsIHZhbGlkYXRlZEVuZENvbHVtbiAtIDEsIDEsIHZhbGlkYXRlZEVuZENvbHVtbiksICdlbmQnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRPRE86IEFsbCBsaW5lcyBzaG91bGQgYmUgcmVuZGVyZWQgYXQgb25jZSBmb3Igb25lIGRvbSBlbGVtZW50XG5cdFx0XHRjb25zdCByZXN1bHQgPSByZW5kZXJMaW5lcyhuZXcgTGluZVNvdXJjZShbdG9rZW5zXSksIFJlbmRlck9wdGlvbnMuZnJvbUVkaXRvcih0aGlzLl9lZGl0b3IuZWRpdG9yKS53aXRoU2V0V2lkdGgoZmFsc2UpLndpdGhTY3JvbGxCZXlvbmRMYXN0Q29sdW1uKDApLCBkZWNvcmF0aW9ucywgbGluZSwgdHJ1ZSk7XG5cdFx0XHR0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250SW5mbykucmVhZChyZWFkZXIpOyAvLyB1cGRhdGUgd2hlbiBmb250IGluZm8gY2hhbmdlc1xuXG5cdFx0XHRyZXF1aXJlZFdpZHRoID0gTWF0aC5tYXgocmVxdWlyZWRXaWR0aCwgcmVzdWx0Lm1pbldpZHRoSW5QeCk7XG5cblx0XHRcdGxpbmVzLnB1c2gobGluZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgbGluZXMsIHJlcXVpcmVkV2lkdGg6IHJlcXVpcmVkV2lkdGggfTtcblx0fSk7XG5cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sYXlvdXQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgbW9kaWZpZWRMaW5lcyA9IHRoaXMuX21vZGlmaWVkTGluZUVsZW1lbnRzLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBtYXhQcmVmaXhUcmltID0gdGhpcy5fbWF4UHJlZml4VHJpbS5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgZWRpdCA9IHRoaXMuX2VkaXQucmVhZChyZWFkZXIpO1xuXHRcdGlmICghbW9kaWZpZWRMaW5lcyB8fCAhbWF4UHJlZml4VHJpbSB8fCAhZWRpdCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB7IHByZWZpeExlZnRPZmZzZXQgfSA9IG1heFByZWZpeFRyaW07XG5cdFx0Y29uc3QgeyByZXF1aXJlZFdpZHRoIH0gPSBtb2RpZmllZExpbmVzO1xuXG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBjb250ZW50TGVmdCA9IHRoaXMuX2VkaXRvci5sYXlvdXRJbmZvQ29udGVudExlZnQucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggPSB0aGlzLl9lZGl0b3IubGF5b3V0SW5mb1ZlcnRpY2FsU2Nyb2xsYmFyV2lkdGgucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IHNjcm9sbExlZnQgPSB0aGlzLl9lZGl0b3Iuc2Nyb2xsTGVmdC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5fZWRpdG9yLnNjcm9sbFRvcC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgZWRpdG9yTGVmdE9mZnNldCA9IGNvbnRlbnRMZWZ0IC0gc2Nyb2xsTGVmdDtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IHRoaXMuX2VkaXRvci5lZGl0b3IuZ2V0TW9kZWwoKSE7XG5cblx0XHRjb25zdCBvcmlnaW5hbExpbmVXaWR0aHMgPSBlZGl0Lm9yaWdpbmFsUmFuZ2UubWFwVG9MaW5lQXJyYXkobGluZSA9PiB0aGlzLl9lZGl0b3IuZWRpdG9yLmdldE9mZnNldEZvckNvbHVtbihsaW5lLCB0ZXh0TW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lKSkgLSBwcmVmaXhMZWZ0T2Zmc2V0KTtcblx0XHRjb25zdCBtYXhMaW5lV2lkdGggPSBNYXRoLm1heCguLi5vcmlnaW5hbExpbmVXaWR0aHMsIHJlcXVpcmVkV2lkdGgpO1xuXG5cdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gZWRpdC5vcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gZWRpdC5vcmlnaW5hbFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxO1xuXHRcdGNvbnN0IHRvcE9mT3JpZ2luYWxMaW5lcyA9IHRoaXMuX2VkaXRvci5lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihzdGFydExpbmVOdW1iZXIpIC0gc2Nyb2xsVG9wO1xuXHRcdGNvbnN0IGJvdHRvbU9mT3JpZ2luYWxMaW5lcyA9IHRoaXMuX2VkaXRvci5lZGl0b3IuZ2V0Qm90dG9tRm9yTGluZU51bWJlcihlbmRMaW5lTnVtYmVyKSAtIHNjcm9sbFRvcDtcblxuXHRcdC8vIEJveCBXaWRnZXQgcG9zaXRpb25pbmdcblx0XHRjb25zdCBvcmlnaW5hbExpbmVzT3ZlcmxheSA9IFJlY3QuZnJvbUxlZnRUb3BXaWR0aEhlaWdodChcblx0XHRcdGVkaXRvckxlZnRPZmZzZXQgKyBwcmVmaXhMZWZ0T2Zmc2V0LFxuXHRcdFx0dG9wT2ZPcmlnaW5hbExpbmVzLFxuXHRcdFx0bWF4TGluZVdpZHRoLFxuXHRcdFx0Ym90dG9tT2ZPcmlnaW5hbExpbmVzIC0gdG9wT2ZPcmlnaW5hbExpbmVzXG5cdFx0KTtcblx0XHRjb25zdCBtb2RpZmllZExpbmVzT3ZlcmxheSA9IFJlY3QuZnJvbUxlZnRUb3BXaWR0aEhlaWdodChcblx0XHRcdG9yaWdpbmFsTGluZXNPdmVybGF5LmxlZnQsXG5cdFx0XHRvcmlnaW5hbExpbmVzT3ZlcmxheS5ib3R0b20sXG5cdFx0XHRvcmlnaW5hbExpbmVzT3ZlcmxheS53aWR0aCxcblx0XHRcdGVkaXQubW9kaWZpZWRSYW5nZS5sZW5ndGggKiBsaW5lSGVpZ2h0XG5cdFx0KTtcblx0XHRjb25zdCBiYWNrZ3JvdW5kID0gUmVjdC5odWxsKFtvcmlnaW5hbExpbmVzT3ZlcmxheSwgbW9kaWZpZWRMaW5lc092ZXJsYXldKTtcblxuXHRcdGNvbnN0IGxvd2VyQmFja2dyb3VuZCA9IGJhY2tncm91bmQuaW50ZXJzZWN0VmVydGljYWwobmV3IE9mZnNldFJhbmdlKG9yaWdpbmFsTGluZXNPdmVybGF5LmJvdHRvbSwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpKTtcblx0XHRjb25zdCBsb3dlclRleHQgPSBuZXcgUmVjdChsb3dlckJhY2tncm91bmQubGVmdCwgbG93ZXJCYWNrZ3JvdW5kLnRvcCwgbG93ZXJCYWNrZ3JvdW5kLnJpZ2h0LCBsb3dlckJhY2tncm91bmQuYm90dG9tKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcmlnaW5hbExpbmVzT3ZlcmxheSxcblx0XHRcdG1vZGlmaWVkTGluZXNPdmVybGF5LFxuXHRcdFx0YmFja2dyb3VuZCxcblx0XHRcdGxvd2VyQmFja2dyb3VuZCxcblx0XHRcdGxvd2VyVGV4dCxcblx0XHRcdG1pbkNvbnRlbnRXaWR0aFJlcXVpcmVkOiBwcmVmaXhMZWZ0T2Zmc2V0ICsgbWF4TGluZVdpZHRoICsgdmVydGljYWxTY3JvbGxiYXJXaWR0aCxcblx0XHR9O1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3Wm9uZUluZm8gPSBkZXJpdmVkPHsgaGVpZ2h0OiBudW1iZXI7IGxpbmVOdW1iZXI6IG51bWJlciB9IHwgdW5kZWZpbmVkPihyZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHNob3VsZFNob3dWaWV3Wm9uZSA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGluZVN1Z2dlc3QpLm1hcChvID0+IG8uZWRpdHMuYWxsb3dDb2RlU2hpZnRpbmcgPT09ICdhbHdheXMnKS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFzaG91bGRTaG93Vmlld1pvbmUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGF5b3V0ID0gdGhpcy5fbGF5b3V0LnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBlZGl0ID0gdGhpcy5fZWRpdC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFsYXlvdXQgfHwgIWVkaXQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld1pvbmVIZWlnaHQgPSBsYXlvdXQubG93ZXJCYWNrZ3JvdW5kLmhlaWdodDtcblx0XHRjb25zdCB2aWV3Wm9uZUxpbmVOdW1iZXIgPSBlZGl0Lm9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZTtcblx0XHRyZXR1cm4geyBoZWlnaHQ6IHZpZXdab25lSGVpZ2h0LCBsaW5lTnVtYmVyOiB2aWV3Wm9uZUxpbmVOdW1iZXIgfTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGl2ID0gbi5kaXYoe1xuXHRcdGNsYXNzOiAnbGluZS1yZXBsYWNlbWVudCcsXG5cdH0sIFtcblx0XHRkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBsYXlvdXQgPSBtYXBPdXRGYWxzeSh0aGlzLl9sYXlvdXQpLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkTGluZUVsZW1lbnRzID0gdGhpcy5fbW9kaWZpZWRMaW5lRWxlbWVudHMucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFsYXlvdXQgfHwgIW1vZGlmaWVkTGluZUVsZW1lbnRzKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGF5b3V0UHJvcHMgPSBsYXlvdXQucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgY29udGVudExlZnQgPSB0aGlzLl9lZGl0b3IubGF5b3V0SW5mb0NvbnRlbnRMZWZ0LnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGNvbnRlbnRXaWR0aCA9IHRoaXMuX2VkaXRvci5jb250ZW50V2lkdGgucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgY29udGVudEhlaWdodCA9IHRoaXMuX2VkaXRvci5lZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpO1xuXG5cdFx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCkucmVhZChyZWFkZXIpO1xuXHRcdFx0bW9kaWZpZWRMaW5lRWxlbWVudHMubGluZXMuZm9yRWFjaChsID0+IHtcblx0XHRcdFx0bC5zdHlsZS53aWR0aCA9IGAke2xheW91dFByb3BzLmxvd2VyVGV4dC53aWR0aH1weGA7XG5cdFx0XHRcdGwuc3R5bGUuaGVpZ2h0ID0gYCR7bGluZUhlaWdodH1weGA7XG5cdFx0XHRcdGwuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IG1vZGlmaWVkQm9yZGVyQ29sb3IgPSBnZXRNb2RpZmllZEJvcmRlckNvbG9yKHRoaXMuX3RhYkFjdGlvbikucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgb3JpZ2luYWxCb3JkZXJDb2xvciA9IGdldE9yaWdpbmFsQm9yZGVyQ29sb3IodGhpcy5fdGFiQWN0aW9uKS5yZWFkKHJlYWRlcik7XG5cblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdG4uZGl2KHtcblx0XHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0XHRcdFx0XHR0b3A6IDAsXG5cdFx0XHRcdFx0XHRsZWZ0OiBjb250ZW50TGVmdCxcblx0XHRcdFx0XHRcdHdpZHRoOiBjb250ZW50V2lkdGgsXG5cdFx0XHRcdFx0XHRoZWlnaHQ6IGNvbnRlbnRIZWlnaHQsXG5cdFx0XHRcdFx0XHRvdmVyZmxvdzogJ2hpZGRlbicsXG5cdFx0XHRcdFx0XHRwb2ludGVyRXZlbnRzOiAnbm9uZScsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbXG5cdFx0XHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRcdFx0Y2xhc3M6ICdvcmlnaW5hbE92ZXJsYXlMaW5lUmVwbGFjZW1lbnQnLFxuXHRcdFx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRcdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0XHRcdFx0XHRcdC4uLnJlY3RUb1Byb3BzKHJlYWRlciA9PiBsYXlvdXQucmVhZChyZWFkZXIpLmJhY2tncm91bmQudHJhbnNsYXRlWCgtY29udGVudExlZnQpKSxcblx0XHRcdFx0XHRcdFx0Ym9yZGVyUmFkaXVzOiAnNHB4JyxcblxuXHRcdFx0XHRcdFx0XHRib3JkZXI6IGdldEVkaXRvckJsZW5kZWRDb2xvcihvcmlnaW5hbEJvcmRlckNvbG9yLCB0aGlzLl90aGVtZVNlcnZpY2UpLm1hcChjID0+IGAxcHggc29saWQgJHtjLnRvU3RyaW5nKCl9YCksXG5cdFx0XHRcdFx0XHRcdHBvaW50ZXJFdmVudHM6ICdub25lJyxcblx0XHRcdFx0XHRcdFx0Ym94U2l6aW5nOiAnYm9yZGVyLWJveCcsXG5cdFx0XHRcdFx0XHRcdGJhY2tncm91bmQ6IGFzQ3NzVmFyaWFibGUob3JpZ2luYWxCYWNrZ3JvdW5kQ29sb3IpLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdG4uZGl2KHtcblx0XHRcdFx0XHRcdGNsYXNzOiAnbW9kaWZpZWRPdmVybGF5TGluZVJlcGxhY2VtZW50Jyxcblx0XHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0XHRcdFx0XHQuLi5yZWN0VG9Qcm9wcyhyZWFkZXIgPT4gbGF5b3V0LnJlYWQocmVhZGVyKS5sb3dlckJhY2tncm91bmQudHJhbnNsYXRlWCgtY29udGVudExlZnQpKSxcblx0XHRcdFx0XHRcdFx0Ym9yZGVyUmFkaXVzOiAnNHB4Jyxcblx0XHRcdFx0XHRcdFx0YmFja2dyb3VuZDogYXNDc3NWYXJpYWJsZShlZGl0b3JCYWNrZ3JvdW5kKSxcblx0XHRcdFx0XHRcdFx0Ym94U2hhZG93OiBgJHthc0Nzc1ZhcmlhYmxlKHNjcm9sbGJhclNoYWRvdyl9IDAgNnB4IDZweCAtNnB4YCxcblx0XHRcdFx0XHRcdFx0Ym9yZGVyOiBgMXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShtb2RpZmllZEJvcmRlckNvbG9yKX1gLFxuXHRcdFx0XHRcdFx0XHRib3hTaXppbmc6ICdib3JkZXItYm94Jyxcblx0XHRcdFx0XHRcdFx0b3ZlcmZsb3c6ICdoaWRkZW4nLFxuXHRcdFx0XHRcdFx0XHRjdXJzb3I6ICdwb2ludGVyJyxcblx0XHRcdFx0XHRcdFx0cG9pbnRlckV2ZW50czogJ2F1dG8nLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdG9ubW91c2Vkb3duOiBlID0+IHtcblx0XHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBUaGlzIHByZXZlbnRzIHRoYXQgdGhlIGVkaXRvciBsb3NlcyBmb2N1c1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdG9uY2xpY2s6IChlKSA9PiB0aGlzLl9vbkRpZENsaWNrLmZpcmUobmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3coZSksIGUpKSxcblx0XHRcdFx0XHR9LCBbXG5cdFx0XHRcdFx0XHRuLmRpdih7XG5cdFx0XHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsIHRvcDogMCwgbGVmdDogMCwgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAnMTAwJScsXG5cdFx0XHRcdFx0XHRcdFx0YmFja2dyb3VuZDogYXNDc3NWYXJpYWJsZShtb2RpZmllZENoYW5nZWRMaW5lQmFja2dyb3VuZENvbG9yKSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XSksXG5cdFx0XHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRcdFx0Y2xhc3M6ICdtb2RpZmllZExpbmVzTGluZVJlcGxhY2VtZW50Jyxcblx0XHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0XHRcdFx0XHRib3hTaXppbmc6ICdib3JkZXItYm94Jyxcblx0XHRcdFx0XHRcdFx0Li4ucmVjdFRvUHJvcHMocmVhZGVyID0+IGxheW91dC5yZWFkKHJlYWRlcikubG93ZXJUZXh0LnRyYW5zbGF0ZVgoLWNvbnRlbnRMZWZ0KSksXG5cdFx0XHRcdFx0XHRcdGZvbnRGYW1pbHk6IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRGYW1pbHkpLFxuXHRcdFx0XHRcdFx0XHRmb250U2l6ZTogdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udFNpemUpLFxuXHRcdFx0XHRcdFx0XHRmb250V2VpZ2h0OiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250V2VpZ2h0KSxcblx0XHRcdFx0XHRcdFx0cG9pbnRlckV2ZW50czogJ25vbmUnLFxuXHRcdFx0XHRcdFx0XHR3aGl0ZVNwYWNlOiAnbm93cmFwJyxcblx0XHRcdFx0XHRcdFx0Ym9yZGVyUmFkaXVzOiAnNHB4Jyxcblx0XHRcdFx0XHRcdFx0b3ZlcmZsb3c6ICdoaWRkZW4nLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIFsuLi5tb2RpZmllZExpbmVFbGVtZW50cy5saW5lc10pLFxuXHRcdFx0XHRdKVxuXHRcdFx0XTtcblx0XHR9KVxuXHRdKS5rZWVwVXBkYXRlZCh0aGlzLl9zdG9yZSk7XG5cblx0cmVhZG9ubHkgaXNIb3ZlcmVkID0gdGhpcy5fZWRpdG9yLmlzVGFyZ2V0SG92ZXJlZCgoZSkgPT4gdGhpcy5faXNNb3VzZU92ZXJXaWRnZXQoZSksIHRoaXMuX3N0b3JlKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IE9ic2VydmFibGVDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXQ6IElPYnNlcnZhYmxlPHtcblx0XHRcdG9yaWdpbmFsUmFuZ2U6IExpbmVSYW5nZTtcblx0XHRcdG1vZGlmaWVkUmFuZ2U6IExpbmVSYW5nZTtcblx0XHRcdG1vZGlmaWVkTGluZXM6IHN0cmluZ1tdO1xuXHRcdFx0cmVwbGFjZW1lbnRzOiBSZXBsYWNlbWVudFtdO1xuXHRcdH0gfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RhYkFjdGlvbjogSU9ic2VydmFibGU8SW5saW5lRWRpdFRhYkFjdGlvbj4sXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9vcmlnaW5hbEJ1YmJsZXNEZWNvcmF0aW9uQ29sbGVjdGlvbi5jbGVhcigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX2VkaXRvci5lZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHRoaXMucmVtb3ZlUHJldmlvdXNWaWV3Wm9uZShhY2Nlc3NvcikpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuRGVsdGEodGhpcy5fdmlld1pvbmVJbmZvLCAoeyBsYXN0VmFsdWUsIG5ld1ZhbHVlIH0pID0+IHtcblx0XHRcdGlmIChsYXN0VmFsdWUgPT09IG5ld1ZhbHVlIHx8IChsYXN0VmFsdWU/LmhlaWdodCA9PT0gbmV3VmFsdWU/LmhlaWdodCAmJiBsYXN0VmFsdWU/LmxpbmVOdW1iZXIgPT09IG5ld1ZhbHVlPy5saW5lTnVtYmVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9lZGl0b3IuZWRpdG9yLmNoYW5nZVZpZXdab25lcygoY2hhbmdlQWNjZXNzb3IpID0+IHtcblx0XHRcdFx0dGhpcy5yZW1vdmVQcmV2aW91c1ZpZXdab25lKGNoYW5nZUFjY2Vzc29yKTtcblx0XHRcdFx0aWYgKCFuZXdWYWx1ZSkgeyByZXR1cm47IH1cblx0XHRcdFx0dGhpcy5hZGRWaWV3Wm9uZShuZXdWYWx1ZSwgY2hhbmdlQWNjZXNzb3IpO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdCA9IHRoaXMuX2VkaXQucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgb3JpZ2luYWxCdWJibGVzID0gW107XG5cdFx0XHRpZiAoZWRpdCkge1xuXHRcdFx0XHRvcmlnaW5hbEJ1YmJsZXMucHVzaCguLi5yYW5nZXNUb0J1YmJsZVJhbmdlcyhlZGl0LnJlcGxhY2VtZW50cy5tYXAociA9PiByLm9yaWdpbmFsUmFuZ2UpKSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vcmlnaW5hbEJ1YmJsZXNEZWNvcmF0aW9uQ29sbGVjdGlvbi5zZXQob3JpZ2luYWxCdWJibGVzLm1hcChyID0+ICh7IHJhbmdlOiByLCBvcHRpb25zOiB0aGlzLl9vcmlnaW5hbEJ1YmJsZXNEZWNvcmF0aW9uT3B0aW9ucyB9KSkpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5jcmVhdGVPdmVybGF5V2lkZ2V0KHtcblx0XHRcdGRvbU5vZGU6IHRoaXMuX2Rpdi5lbGVtZW50LFxuXHRcdFx0bWluQ29udGVudFdpZHRoSW5QeDogZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0LnJlYWQocmVhZGVyKT8ubWluQ29udGVudFdpZHRoUmVxdWlyZWQgPz8gMDtcblx0XHRcdH0pLFxuXHRcdFx0cG9zaXRpb246IGNvbnN0T2JzZXJ2YWJsZSh7IHByZWZlcmVuY2U6IHsgdG9wOiAwLCBsZWZ0OiAwIH0gfSksXG5cdFx0XHRhbGxvd0VkaXRvck92ZXJmbG93OiBmYWxzZSxcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9pc01vdXNlT3ZlcldpZGdldChlOiBJRWRpdG9yTW91c2VFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGxheW91dCA9IHRoaXMuX2xheW91dC5nZXQoKTtcblx0XHRpZiAoIWxheW91dCB8fCAhKGUuZXZlbnQgaW5zdGFuY2VvZiBFZGl0b3JNb3VzZUV2ZW50KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiBsYXlvdXQubG93ZXJCYWNrZ3JvdW5kLmNvbnRhaW5zUG9pbnQobmV3IFBvaW50KGUuZXZlbnQucmVsYXRpdmVQb3MueCwgZS5ldmVudC5yZWxhdGl2ZVBvcy55KSk7XG5cdH1cblxuXHQvLyBWaWV3IFpvbmVzXG5cdHByaXZhdGUgX3ByZXZpb3VzVmlld1pvbmVJbmZvOiB7IGhlaWdodDogbnVtYmVyOyBsaW5lTnVtYmVyOiBudW1iZXI7IGlkOiBzdHJpbmcgfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlbW92ZVByZXZpb3VzVmlld1pvbmUoY2hhbmdlQWNjZXNzb3I6IElWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yKSB7XG5cdFx0aWYgKCF0aGlzLl9wcmV2aW91c1ZpZXdab25lSW5mbykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNoYW5nZUFjY2Vzc29yLnJlbW92ZVpvbmUodGhpcy5fcHJldmlvdXNWaWV3Wm9uZUluZm8uaWQpO1xuXG5cdFx0Y29uc3QgY3Vyc29yTGluZU51bWJlciA9IHRoaXMuX2VkaXRvci5jdXJzb3JMaW5lTnVtYmVyLmdldCgpO1xuXHRcdGlmIChjdXJzb3JMaW5lTnVtYmVyICE9PSBudWxsICYmIGN1cnNvckxpbmVOdW1iZXIgPj0gdGhpcy5fcHJldmlvdXNWaWV3Wm9uZUluZm8ubGluZU51bWJlcikge1xuXHRcdFx0dGhpcy5fZWRpdG9yLmVkaXRvci5zZXRTY3JvbGxUb3AodGhpcy5fZWRpdG9yLnNjcm9sbFRvcC5nZXQoKSAtIHRoaXMuX3ByZXZpb3VzVmlld1pvbmVJbmZvLmhlaWdodCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJldmlvdXNWaWV3Wm9uZUluZm8gPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFkZFZpZXdab25lKHZpZXdab25lSW5mbzogeyBoZWlnaHQ6IG51bWJlcjsgbGluZU51bWJlcjogbnVtYmVyIH0sIGNoYW5nZUFjY2Vzc29yOiBJVmlld1pvbmVDaGFuZ2VBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGFjdGl2ZVZpZXdab25lID0gY2hhbmdlQWNjZXNzb3IuYWRkWm9uZSh7XG5cdFx0XHRhZnRlckxpbmVOdW1iZXI6IHZpZXdab25lSW5mby5saW5lTnVtYmVyIC0gMSxcblx0XHRcdGhlaWdodEluUHg6IHZpZXdab25lSW5mby5oZWlnaHQsIC8vIG1vdmUgY29tcHV0YXRpb24gdG8gbGF5b3V0P1xuXHRcdFx0ZG9tTm9kZTogJCgnZGl2JyksXG5cdFx0fSk7XG5cblx0XHR0aGlzLl9wcmV2aW91c1ZpZXdab25lSW5mbyA9IHsgaGVpZ2h0OiB2aWV3Wm9uZUluZm8uaGVpZ2h0LCBsaW5lTnVtYmVyOiB2aWV3Wm9uZUluZm8ubGluZU51bWJlciwgaWQ6IGFjdGl2ZVZpZXdab25lIH07XG5cblx0XHRjb25zdCBjdXJzb3JMaW5lTnVtYmVyID0gdGhpcy5fZWRpdG9yLmN1cnNvckxpbmVOdW1iZXIuZ2V0KCk7XG5cdFx0aWYgKGN1cnNvckxpbmVOdW1iZXIgIT09IG51bGwgJiYgY3Vyc29yTGluZU51bWJlciA+PSB2aWV3Wm9uZUluZm8ubGluZU51bWJlcikge1xuXHRcdFx0dGhpcy5fZWRpdG9yLmVkaXRvci5zZXRTY3JvbGxUb3AodGhpcy5fZWRpdG9yLnNjcm9sbFRvcC5nZXQoKSArIHZpZXdab25lSW5mby5oZWlnaHQpO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiByYW5nZXNUb0J1YmJsZVJhbmdlcyhyYW5nZXM6IFJhbmdlW10pOiBSYW5nZVtdIHtcblx0Y29uc3QgcmVzdWx0OiBSYW5nZVtdID0gW107XG5cdHdoaWxlIChyYW5nZXMubGVuZ3RoKSB7XG5cdFx0bGV0IHJhbmdlID0gcmFuZ2VzLnNoaWZ0KCkhO1xuXHRcdGlmIChyYW5nZS5zdGFydExpbmVOdW1iZXIgIT09IHJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdHJhbmdlcy5wdXNoKG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIgKyAxLCAxLCByYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4pKTtcblx0XHRcdHJhbmdlID0gbmV3IFJhbmdlKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc3RhcnRDb2x1bW4sIHJhbmdlLnN0YXJ0TGluZU51bWJlciwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpOyAvLyBUT0RPOiB0aGlzIGlzIG5vdCBjb3JyZWN0XG5cdFx0fVxuXG5cdFx0cmVzdWx0LnB1c2gocmFuZ2UpO1xuXHR9XG5cdHJldHVybiByZXN1bHQ7XG5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXBsYWNlbWVudCB7XG5cdG9yaWdpbmFsUmFuZ2U6IFJhbmdlO1xuXHRtb2RpZmllZFJhbmdlOiBSYW5nZTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxHQUFHLFdBQVcsU0FBUztBQUNoQyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxvQkFBb0I7QUFDekMsU0FBUyxTQUFTLGNBQWMsaUJBQWlCLGVBQTRCO0FBQzdFLFNBQVMsa0JBQWtCLHVCQUF1QjtBQUNsRCxTQUFTLHFC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
