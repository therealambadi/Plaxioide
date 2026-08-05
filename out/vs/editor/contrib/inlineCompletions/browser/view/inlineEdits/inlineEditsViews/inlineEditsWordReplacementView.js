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
import { getWindow, n } from "../../../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../../../base/browser/mouseEvent.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { constObservable, derived, observableValue } from "../../../../../../../base/common/observable.js";
import { editorBackground, editorHoverForeground } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { Point } from "../../../../../../browser/point.js";
import { Rect } from "../../../../../../browser/rect.js";
import { LineSource, renderLines, RenderOptions } from "../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { SingleOffsetEdit } from "../../../../../../common/core/offsetEdit.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { ILanguageService } from "../../../../../../common/languages/language.js";
import { LineTokens } from "../../../../../../common/tokens/lineTokens.js";
import { TokenArray } from "../../../../../../common/tokens/tokenArray.js";
import { getModifiedBorderColor, getOriginalBorderColor, modifiedChangedTextOverlayColor, originalChangedTextOverlayColor } from "../theme.js";
import { mapOutFalsy, rectToProps } from "../utils/utils.js";
let InlineEditsWordReplacementView = class extends Disposable {
  constructor(_editor, _edit, _tabAction, _languageService) {
    super();
    this._editor = _editor;
    this._edit = _edit;
    this._tabAction = _tabAction;
    this._languageService = _languageService;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._start = this._editor.observePosition(constObservable(this._edit.range.getStartPosition()), this._store);
    this._end = this._editor.observePosition(constObservable(this._edit.range.getEndPosition()), this._store);
    this._line = document.createElement("div");
    this._hoverableElement = observableValue(this, null);
    this.isHovered = this._hoverableElement.map((e, reader) => e?.didMouseMoveDuringHover.read(reader) ?? false);
    this._renderTextEffect = derived((_reader) => {
      const tm = this._editor.model.get();
      const origLine = tm.getLineContent(this._edit.range.startLineNumber);
      const edit = SingleOffsetEdit.replace(new OffsetRange(this._edit.range.startColumn - 1, this._edit.range.endColumn - 1), this._edit.text);
      const lineToTokenize = edit.apply(origLine);
      const t = tm.tokenization.tokenizeLinesAt(this._edit.range.startLineNumber, [lineToTokenize])?.[0];
      let tokens;
      if (t) {
        tokens = TokenArray.fromLineTokens(t).slice(edit.getRangeAfterApply()).toLineTokens(this._edit.text, this._languageService.languageIdCodec);
      } else {
        tokens = LineTokens.createEmpty(this._edit.text, this._languageService.languageIdCodec);
      }
      const res = renderLines(new LineSource([tokens]), RenderOptions.fromEditor(this._editor.editor).withSetWidth(false).withScrollBeyondLastColumn(0), [], this._line, true);
      this._line.style.width = `${res.minWidthInPx}px`;
    });
    this._layout = derived(this, (reader) => {
      this._renderTextEffect.read(reader);
      const widgetStart = this._start.read(reader);
      const widgetEnd = this._end.read(reader);
      if (!widgetStart || !widgetEnd || widgetStart.x > widgetEnd.x || widgetStart.y > widgetEnd.y) {
        return void 0;
      }
      const lineHeight = this._editor.getOption(EditorOption.lineHeight).read(reader);
      const scrollLeft = this._editor.scrollLeft.read(reader);
      const w = this._editor.getOption(EditorOption.fontInfo).read(reader).typicalHalfwidthCharacterWidth;
      const modifiedLeftOffset = 3 * w;
      const modifiedTopOffset = 4;
      const modifiedOffset = new Point(modifiedLeftOffset, modifiedTopOffset);
      const originalLine = Rect.fromPoints(widgetStart, widgetEnd).withHeight(lineHeight).translateX(-scrollLeft);
      const modifiedLine = Rect.fromPointSize(originalLine.getLeftBottom().add(modifiedOffset), new Point(this._edit.text.length * w, originalLine.height));
      const lowerBackground = modifiedLine.withLeft(originalLine.left);
      return {
        originalLine,
        modifiedLine,
        lowerBackground,
        lineHeight
      };
    });
    this._root = n.div({
      class: "word-replacement"
    }, [
      derived((reader) => {
        const layout = mapOutFalsy(this._layout).read(reader);
        if (!layout) {
          return [];
        }
        const contentLeft = this._editor.layoutInfoContentLeft.read(reader);
        const borderWidth = 1;
        const originalBorderColor = getOriginalBorderColor(this._tabAction).map((c) => asCssVariable(c)).read(reader);
        const modifiedBorderColor = getModifiedBorderColor(this._tabAction).map((c) => asCssVariable(c)).read(reader);
        return [
          n.div({
            style: {
              position: "absolute",
              top: 0,
              left: contentLeft,
              width: this._editor.contentWidth,
              height: this._editor.editor.getContentHeight(),
              overflow: "hidden",
              pointerEvents: "none"
            }
          }, [
            n.div({
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).lowerBackground.withMargin(borderWidth, 2 * borderWidth, borderWidth, 0)),
                background: asCssVariable(editorBackground),
                //boxShadow: `${asCssVariable(scrollbarShadow)} 0 6px 6px -6px`,
                cursor: "pointer",
                pointerEvents: "auto"
              },
              onmousedown: (e) => {
                e.preventDefault();
              },
              onmouseup: (e) => this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e)),
              obsRef: (elem) => {
                this._hoverableElement.set(elem, void 0);
              }
            }),
            n.div({
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).modifiedLine.withMargin(1, 2)),
                fontFamily: this._editor.getOption(EditorOption.fontFamily),
                fontSize: this._editor.getOption(EditorOption.fontSize),
                fontWeight: this._editor.getOption(EditorOption.fontWeight),
                pointerEvents: "none",
                boxSizing: "border-box",
                borderRadius: "4px",
                border: `${borderWidth}px solid ${modifiedBorderColor}`,
                background: asCssVariable(modifiedChangedTextOverlayColor),
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                outline: `2px solid ${asCssVariable(editorBackground)}`
              }
            }, [this._line]),
            n.div({
              style: {
                position: "absolute",
                ...rectToProps((reader2) => layout.read(reader2).originalLine.withMargin(1)),
                boxSizing: "border-box",
                borderRadius: "4px",
                border: `${borderWidth}px solid ${originalBorderColor}`,
                background: asCssVariable(originalChangedTextOverlayColor),
                pointerEvents: "none"
              }
            }, []),
            n.svg({
              width: 11,
              height: 14,
              viewBox: "0 0 11 14",
              fill: "none",
              style: {
                position: "absolute",
                left: layout.map((l) => l.modifiedLine.left - 16),
                top: layout.map((l) => l.modifiedLine.top + Math.round((l.lineHeight - 14 - 5) / 2))
              }
            }, [
              n.svgElem("path", {
                d: "M1 0C1 2.98966 1 5.92087 1 8.49952C1 9.60409 1.89543 10.5 3 10.5H10.5",
                stroke: asCssVariable(editorHoverForeground)
              }),
              n.svgElem("path", {
                d: "M6 7.5L9.99999 10.49998L6 13.5",
                stroke: asCssVariable(editorHoverForeground)
              })
            ])
          ])
        ];
      })
    ]).keepUpdated(this._store);
    this._register(this._editor.createOverlayWidget({
      domNode: this._root.element,
      minContentWidthInPx: constObservable(0),
      position: constObservable({ preference: { top: 0, left: 0 } }),
      allowEditorOverflow: false
    }));
  }
};
InlineEditsWordReplacementView.MAX_LENGTH = 100;
InlineEditsWordReplacementView = __decorateClass([
  __decorateParam(3, ILanguageService)
], InlineEditsWordReplacementView);
export {
  InlineEditsWordReplacementView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c1dvcmRSZXBsYWNlbWVudFZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBnZXRXaW5kb3csIG4sIE9ic2VydmVyTm9kZVdpdGhFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJTW91c2VFdmVudCwgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY29uc3RPYnNlcnZhYmxlLCBkZXJpdmVkLCBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kLCBlZGl0b3JIb3ZlckZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yVXRpbHMuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFBvaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9wb2ludC5qcyc7XG5pbXBvcnQgeyBSZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9yZWN0LmpzJztcbmltcG9ydCB7IExpbmVTb3VyY2UsIHJlbmRlckxpbmVzLCBSZW5kZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2RpZmZFZGl0b3JWaWV3Wm9uZXMvcmVuZGVyTGluZXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFNpbmdsZU9mZnNldEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9vZmZzZXRFZGl0LmpzJztcbmltcG9ydCB7IE9mZnNldFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0UmFuZ2UuanMnO1xuaW1wb3J0IHsgU2luZ2xlVGV4dEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS90ZXh0RWRpdC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBMaW5lVG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9saW5lVG9rZW5zLmpzJztcbmltcG9ydCB7IFRva2VuQXJyYXkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vdG9rZW5zL3Rva2VuQXJyYXkuanMnO1xuaW1wb3J0IHsgSUlubGluZUVkaXRzVmlldywgSW5saW5lRWRpdFRhYkFjdGlvbiB9IGZyb20gJy4uL2lubGluZUVkaXRzVmlld0ludGVyZmFjZS5qcyc7XG5pbXBvcnQgeyBnZXRNb2RpZmllZEJvcmRlckNvbG9yLCBnZXRPcmlnaW5hbEJvcmRlckNvbG9yLCBtb2RpZmllZENoYW5nZWRUZXh0T3ZlcmxheUNvbG9yLCBvcmlnaW5hbENoYW5nZWRUZXh0T3ZlcmxheUNvbG9yIH0gZnJvbSAnLi4vdGhlbWUuanMnO1xuaW1wb3J0IHsgbWFwT3V0RmFsc3ksIHJlY3RUb1Byb3BzIH0gZnJvbSAnLi4vdXRpbHMvdXRpbHMuanMnO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lRWRpdHNXb3JkUmVwbGFjZW1lbnRWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElJbmxpbmVFZGl0c1ZpZXcge1xuXG5cdHB1YmxpYyBzdGF0aWMgTUFYX0xFTkdUSCA9IDEwMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENsaWNrID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vdXNlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsaWNrID0gdGhpcy5fb25EaWRDbGljay5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFydCA9IHRoaXMuX2VkaXRvci5vYnNlcnZlUG9zaXRpb24oY29uc3RPYnNlcnZhYmxlKHRoaXMuX2VkaXQucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKSwgdGhpcy5fc3RvcmUpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lbmQgPSB0aGlzLl9lZGl0b3Iub2JzZXJ2ZVBvc2l0aW9uKGNvbnN0T2JzZXJ2YWJsZSh0aGlzLl9lZGl0LnJhbmdlLmdldEVuZFBvc2l0aW9uKCkpLCB0aGlzLl9zdG9yZSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGluZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyYWJsZUVsZW1lbnQgPSBvYnNlcnZhYmxlVmFsdWU8T2JzZXJ2ZXJOb2RlV2l0aEVsZW1lbnQgfCBudWxsPih0aGlzLCBudWxsKTtcblxuXHRyZWFkb25seSBpc0hvdmVyZWQgPSB0aGlzLl9ob3ZlcmFibGVFbGVtZW50Lm1hcCgoZSwgcmVhZGVyKSA9PiBlPy5kaWRNb3VzZU1vdmVEdXJpbmdIb3Zlci5yZWFkKHJlYWRlcikgPz8gZmFsc2UpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogT2JzZXJ2YWJsZUNvZGVFZGl0b3IsXG5cdFx0LyoqIE11c3QgYmUgc2luZ2xlLWxpbmUgaW4gYm90aCBzaWRlcyAqL1xuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXQ6IFNpbmdsZVRleHRFZGl0LFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBfdGFiQWN0aW9uOiBJT2JzZXJ2YWJsZTxJbmxpbmVFZGl0VGFiQWN0aW9uPixcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3IuY3JlYXRlT3ZlcmxheVdpZGdldCh7XG5cdFx0XHRkb21Ob2RlOiB0aGlzLl9yb290LmVsZW1lbnQsXG5cdFx0XHRtaW5Db250ZW50V2lkdGhJblB4OiBjb25zdE9ic2VydmFibGUoMCksXG5cdFx0XHRwb3NpdGlvbjogY29uc3RPYnNlcnZhYmxlKHsgcHJlZmVyZW5jZTogeyB0b3A6IDAsIGxlZnQ6IDAgfSB9KSxcblx0XHRcdGFsbG93RWRpdG9yT3ZlcmZsb3c6IGZhbHNlLFxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlbmRlclRleHRFZmZlY3QgPSBkZXJpdmVkKF9yZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHRtID0gdGhpcy5fZWRpdG9yLm1vZGVsLmdldCgpITtcblx0XHRjb25zdCBvcmlnTGluZSA9IHRtLmdldExpbmVDb250ZW50KHRoaXMuX2VkaXQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblxuXHRcdGNvbnN0IGVkaXQgPSBTaW5nbGVPZmZzZXRFZGl0LnJlcGxhY2UobmV3IE9mZnNldFJhbmdlKHRoaXMuX2VkaXQucmFuZ2Uuc3RhcnRDb2x1bW4gLSAxLCB0aGlzLl9lZGl0LnJhbmdlLmVuZENvbHVtbiAtIDEpLCB0aGlzLl9lZGl0LnRleHQpO1xuXHRcdGNvbnN0IGxpbmVUb1Rva2VuaXplID0gZWRpdC5hcHBseShvcmlnTGluZSk7XG5cdFx0Y29uc3QgdCA9IHRtLnRva2VuaXphdGlvbi50b2tlbml6ZUxpbmVzQXQodGhpcy5fZWRpdC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIFtsaW5lVG9Ub2tlbml6ZV0pPy5bMF07XG5cdFx0bGV0IHRva2VuczogTGluZVRva2Vucztcblx0XHRpZiAodCkge1xuXHRcdFx0dG9rZW5zID0gVG9rZW5BcnJheS5mcm9tTGluZVRva2Vucyh0KS5zbGljZShlZGl0LmdldFJhbmdlQWZ0ZXJBcHBseSgpKS50b0xpbmVUb2tlbnModGhpcy5fZWRpdC50ZXh0LCB0aGlzLl9sYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9rZW5zID0gTGluZVRva2Vucy5jcmVhdGVFbXB0eSh0aGlzLl9lZGl0LnRleHQsIHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMpO1xuXHRcdH1cblx0XHRjb25zdCByZXMgPSByZW5kZXJMaW5lcyhuZXcgTGluZVNvdXJjZShbdG9rZW5zXSksIFJlbmRlck9wdGlvbnMuZnJvbUVkaXRvcih0aGlzLl9lZGl0b3IuZWRpdG9yKS53aXRoU2V0V2lkdGgoZmFsc2UpLndpdGhTY3JvbGxCZXlvbmRMYXN0Q29sdW1uKDApLCBbXSwgdGhpcy5fbGluZSwgdHJ1ZSk7XG5cdFx0dGhpcy5fbGluZS5zdHlsZS53aWR0aCA9IGAke3Jlcy5taW5XaWR0aEluUHh9cHhgO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sYXlvdXQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0dGhpcy5fcmVuZGVyVGV4dEVmZmVjdC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3Qgd2lkZ2V0U3RhcnQgPSB0aGlzLl9zdGFydC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3Qgd2lkZ2V0RW5kID0gdGhpcy5fZW5kLnJlYWQocmVhZGVyKTtcblxuXHRcdC8vIFRPRE9AaGVkaWV0IGJldHRlciBhYm91dCB3aWRnZXRTdGFydCBhbmQgd2lkZ2V0RW5kIGluIGEgc2luZ2xlIHRyYW5zYWN0aW9uIVxuXHRcdGlmICghd2lkZ2V0U3RhcnQgfHwgIXdpZGdldEVuZCB8fCB3aWRnZXRTdGFydC54ID4gd2lkZ2V0RW5kLnggfHwgd2lkZ2V0U3RhcnQueSA+IHdpZGdldEVuZC55KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KS5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3Qgc2Nyb2xsTGVmdCA9IHRoaXMuX2VkaXRvci5zY3JvbGxMZWZ0LnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCB3ID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEluZm8pLnJlYWQocmVhZGVyKS50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg7XG5cblx0XHRjb25zdCBtb2RpZmllZExlZnRPZmZzZXQgPSAzICogdztcblx0XHRjb25zdCBtb2RpZmllZFRvcE9mZnNldCA9IDQ7XG5cdFx0Y29uc3QgbW9kaWZpZWRPZmZzZXQgPSBuZXcgUG9pbnQobW9kaWZpZWRMZWZ0T2Zmc2V0LCBtb2RpZmllZFRvcE9mZnNldCk7XG5cblx0XHRjb25zdCBvcmlnaW5hbExpbmUgPSBSZWN0LmZyb21Qb2ludHMod2lkZ2V0U3RhcnQsIHdpZGdldEVuZCkud2l0aEhlaWdodChsaW5lSGVpZ2h0KS50cmFuc2xhdGVYKC1zY3JvbGxMZWZ0KTtcblx0XHRjb25zdCBtb2RpZmllZExpbmUgPSBSZWN0LmZyb21Qb2ludFNpemUob3JpZ2luYWxMaW5lLmdldExlZnRCb3R0b20oKS5hZGQobW9kaWZpZWRPZmZzZXQpLCBuZXcgUG9pbnQodGhpcy5fZWRpdC50ZXh0Lmxlbmd0aCAqIHcsIG9yaWdpbmFsTGluZS5oZWlnaHQpKTtcblxuXHRcdGNvbnN0IGxvd2VyQmFja2dyb3VuZCA9IG1vZGlmaWVkTGluZS53aXRoTGVmdChvcmlnaW5hbExpbmUubGVmdCk7XG5cblx0XHQvLyBkZWJ1Z1ZpZXcoZGVidWdMb2dSZWN0cyh7IGxvd2VyQmFja2dyb3VuZCB9LCB0aGlzLl9lZGl0b3IuZWRpdG9yLmdldENvbnRhaW5lckRvbU5vZGUoKSksIHJlYWRlcik7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0b3JpZ2luYWxMaW5lLFxuXHRcdFx0bW9kaWZpZWRMaW5lLFxuXHRcdFx0bG93ZXJCYWNrZ3JvdW5kLFxuXHRcdFx0bGluZUhlaWdodCxcblx0XHR9O1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yb290ID0gbi5kaXYoe1xuXHRcdGNsYXNzOiAnd29yZC1yZXBsYWNlbWVudCcsXG5cdH0sIFtcblx0XHRkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBsYXlvdXQgPSBtYXBPdXRGYWxzeSh0aGlzLl9sYXlvdXQpLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghbGF5b3V0KSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29udGVudExlZnQgPSB0aGlzLl9lZGl0b3IubGF5b3V0SW5mb0NvbnRlbnRMZWZ0LnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGJvcmRlcldpZHRoID0gMTtcblxuXHRcdFx0Y29uc3Qgb3JpZ2luYWxCb3JkZXJDb2xvciA9IGdldE9yaWdpbmFsQm9yZGVyQ29sb3IodGhpcy5fdGFiQWN0aW9uKS5tYXAoYyA9PiBhc0Nzc1ZhcmlhYmxlKGMpKS5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBtb2RpZmllZEJvcmRlckNvbG9yID0gZ2V0TW9kaWZpZWRCb3JkZXJDb2xvcih0aGlzLl90YWJBY3Rpb24pLm1hcChjID0+IGFzQ3NzVmFyaWFibGUoYykpLnJlYWQocmVhZGVyKTtcblxuXHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0XHRcdFx0XHRcdHRvcDogMCxcblx0XHRcdFx0XHRcdGxlZnQ6IGNvbnRlbnRMZWZ0LFxuXHRcdFx0XHRcdFx0d2lkdGg6IHRoaXMuX2VkaXRvci5jb250ZW50V2lkdGgsXG5cdFx0XHRcdFx0XHRoZWlnaHQ6IHRoaXMuX2VkaXRvci5lZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpLFxuXHRcdFx0XHRcdFx0b3ZlcmZsb3c6ICdoaWRkZW4nLFxuXHRcdFx0XHRcdFx0cG9pbnRlckV2ZW50czogJ25vbmUnLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgW1xuXHRcdFx0XHRcdG4uZGl2KHtcblx0XHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0XHRcdFx0XHQuLi5yZWN0VG9Qcm9wcyhyZWFkZXIgPT4gbGF5b3V0LnJlYWQocmVhZGVyKS5sb3dlckJhY2tncm91bmQud2l0aE1hcmdpbihib3JkZXJXaWR0aCwgMiAqIGJvcmRlcldpZHRoLCBib3JkZXJXaWR0aCwgMCkpLFxuXHRcdFx0XHRcdFx0XHRiYWNrZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGVkaXRvckJhY2tncm91bmQpLFxuXHRcdFx0XHRcdFx0XHQvL2JveFNoYWRvdzogYCR7YXNDc3NWYXJpYWJsZShzY3JvbGxiYXJTaGFkb3cpfSAwIDZweCA2cHggLTZweGAsXG5cdFx0XHRcdFx0XHRcdGN1cnNvcjogJ3BvaW50ZXInLFxuXHRcdFx0XHRcdFx0XHRwb2ludGVyRXZlbnRzOiAnYXV0bycsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0b25tb3VzZWRvd246IGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7IC8vIFRoaXMgcHJldmVudHMgdGhhdCB0aGUgZWRpdG9yIGxvc2VzIGZvY3VzXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0b25tb3VzZXVwOiAoZSkgPT4gdGhpcy5fb25EaWRDbGljay5maXJlKG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KGUpLCBlKSksXG5cdFx0XHRcdFx0XHRvYnNSZWY6IChlbGVtKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2hvdmVyYWJsZUVsZW1lbnQuc2V0KGVsZW0sIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRcdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0XHRcdFx0XHRcdC4uLnJlY3RUb1Byb3BzKHJlYWRlciA9PiBsYXlvdXQucmVhZChyZWFkZXIpLm1vZGlmaWVkTGluZS53aXRoTWFyZ2luKDEsIDIpKSxcblx0XHRcdFx0XHRcdFx0Zm9udEZhbWlseTogdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEZhbWlseSksXG5cdFx0XHRcdFx0XHRcdGZvbnRTaXplOiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250U2l6ZSksXG5cdFx0XHRcdFx0XHRcdGZvbnRXZWlnaHQ6IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRXZWlnaHQpLFxuXG5cdFx0XHRcdFx0XHRcdHBvaW50ZXJFdmVudHM6ICdub25lJyxcblx0XHRcdFx0XHRcdFx0Ym94U2l6aW5nOiAnYm9yZGVyLWJveCcsXG5cdFx0XHRcdFx0XHRcdGJvcmRlclJhZGl1czogJzRweCcsXG5cdFx0XHRcdFx0XHRcdGJvcmRlcjogYCR7Ym9yZGVyV2lkdGh9cHggc29saWQgJHttb2RpZmllZEJvcmRlckNvbG9yfWAsXG5cblx0XHRcdFx0XHRcdFx0YmFja2dyb3VuZDogYXNDc3NWYXJpYWJsZShtb2RpZmllZENoYW5nZWRUZXh0T3ZlcmxheUNvbG9yKSxcblx0XHRcdFx0XHRcdFx0ZGlzcGxheTogJ2ZsZXgnLFxuXHRcdFx0XHRcdFx0XHRqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXG5cdFx0XHRcdFx0XHRcdGFsaWduSXRlbXM6ICdjZW50ZXInLFxuXG5cdFx0XHRcdFx0XHRcdG91dGxpbmU6IGAycHggc29saWQgJHthc0Nzc1ZhcmlhYmxlKGVkaXRvckJhY2tncm91bmQpfWAsXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSwgW3RoaXMuX2xpbmVdKSxcblx0XHRcdFx0XHRuLmRpdih7XG5cdFx0XHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdFx0XHRwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0XHRcdFx0XHRcdFx0Li4ucmVjdFRvUHJvcHMocmVhZGVyID0+IGxheW91dC5yZWFkKHJlYWRlcikub3JpZ2luYWxMaW5lLndpdGhNYXJnaW4oMSkpLFxuXHRcdFx0XHRcdFx0XHRib3hTaXppbmc6ICdib3JkZXItYm94Jyxcblx0XHRcdFx0XHRcdFx0Ym9yZGVyUmFkaXVzOiAnNHB4Jyxcblx0XHRcdFx0XHRcdFx0Ym9yZGVyOiBgJHtib3JkZXJXaWR0aH1weCBzb2xpZCAke29yaWdpbmFsQm9yZGVyQ29sb3J9YCxcblx0XHRcdFx0XHRcdFx0YmFja2dyb3VuZDogYXNDc3NWYXJpYWJsZShvcmlnaW5hbENoYW5nZWRUZXh0T3ZlcmxheUNvbG9yKSxcblx0XHRcdFx0XHRcdFx0cG9pbnRlckV2ZW50czogJ25vbmUnLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIFtdKSxcblxuXHRcdFx0XHRcdG4uc3ZnKHtcblx0XHRcdFx0XHRcdHdpZHRoOiAxMSxcblx0XHRcdFx0XHRcdGhlaWdodDogMTQsXG5cdFx0XHRcdFx0XHR2aWV3Qm94OiAnMCAwIDExIDE0Jyxcblx0XHRcdFx0XHRcdGZpbGw6ICdub25lJyxcblx0XHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0XHRcdFx0XHRsZWZ0OiBsYXlvdXQubWFwKGwgPT4gbC5tb2RpZmllZExpbmUubGVmdCAtIDE2KSxcblx0XHRcdFx0XHRcdFx0dG9wOiBsYXlvdXQubWFwKGwgPT4gbC5tb2RpZmllZExpbmUudG9wICsgTWF0aC5yb3VuZCgobC5saW5lSGVpZ2h0IC0gMTQgLSA1KSAvIDIpKSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LCBbXG5cdFx0XHRcdFx0XHRuLnN2Z0VsZW0oJ3BhdGgnLCB7XG5cdFx0XHRcdFx0XHRcdGQ6ICdNMSAwQzEgMi45ODk2NiAxIDUuOTIwODcgMSA4LjQ5OTUyQzEgOS42MDQwOSAxLjg5NTQzIDEwLjUgMyAxMC41SDEwLjUnLFxuXHRcdFx0XHRcdFx0XHRzdHJva2U6IGFzQ3NzVmFyaWFibGUoZWRpdG9ySG92ZXJGb3JlZ3JvdW5kKSxcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdFx0bi5zdmdFbGVtKCdwYXRoJywge1xuXHRcdFx0XHRcdFx0XHRkOiAnTTYgNy41TDkuOTk5OTkgMTAuNDk5OThMNiAxMy41Jyxcblx0XHRcdFx0XHRcdFx0c3Ryb2tlOiBhc0Nzc1ZhcmlhYmxlKGVkaXRvckhvdmVyRm9yZWdyb3VuZCksXG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdF0pLFxuXG5cdFx0XHRcdF0pXG5cdFx0XHRdO1xuXHRcdH0pXG5cdF0pLmtlZXBVcGRhdGVkKHRoaXMuX3N0b3JlKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxXQUFXLFNBQWtDO0FBQ3RELFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBaUIsU0FBc0IsdUJBQXVCO0FBQ3ZFLFNBQVMsa0JBQWtCLDZCQUE2QjtBQUN4RCxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsWUFBWSxhQUFhLHFCQUFxQjtBQUN2RCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1CQUFtQjtBQUU1QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLHdCQUF3Qix3QkFBd0IsaUNBQWlDLHVDQUF1QztBQUNqSSxTQUFTLGFBQWEsbUJBQW1CO0FBRWxDLElBQU0saUNBQU4sY0FBNkMsV0FBdUM7QUFBQSxFQWdCMUYsWUFDa0IsU0FFQSxPQUNFLFlBQ2dCLGtCQUNsQztBQUNELFVBQU07QUFOVztBQUVBO0FBQ0U7QUFDZ0I7QUFqQnBDLFNBQWlCLGNBQWMsS0FBSyxVQUFVLElBQUksUUFBcUIsQ0FBQztBQUN4RSxTQUFTLGFBQWEsS0FBSyxZQUFZO0FBRXZDLFNBQWlCLFNBQVMsS0FBSyxRQUFRLGdCQUFnQixnQkFBZ0IsS0FBSyxNQUFNLE1BQU0saUJBQWlCLENBQUMsR0FBRyxLQUFLLE1BQU07QUFD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
