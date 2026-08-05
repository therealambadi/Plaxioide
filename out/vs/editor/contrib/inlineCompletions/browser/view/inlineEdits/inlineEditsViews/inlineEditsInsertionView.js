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
import { $, n } from "../../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { constObservable, derived, derivedWithStore, observableValue } from "../../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { editorBackground } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { observableCodeEditor } from "../../../../../../browser/observableCodeEditor.js";
import { Rect } from "../../../../../../browser/rect.js";
import { LineSource, renderLines, RenderOptions } from "../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { LineRange } from "../../../../../../common/core/lineRange.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { Position } from "../../../../../../common/core/position.js";
import { Range } from "../../../../../../common/core/range.js";
import { ILanguageService } from "../../../../../../common/languages/language.js";
import { LineTokens } from "../../../../../../common/tokens/lineTokens.js";
import { TokenArray } from "../../../../../../common/tokens/tokenArray.js";
import { InlineDecoration, InlineDecorationType } from "../../../../../../common/viewModel.js";
import { GhostText, GhostTextPart } from "../../../model/ghostText.js";
import { GhostTextView } from "../../ghostText/ghostTextView.js";
import { getModifiedBorderColor, modifiedBackgroundColor } from "../theme.js";
import { getPrefixTrim, mapOutFalsy } from "../utils/utils.js";
const BORDER_WIDTH = 1;
const WIDGET_SEPARATOR_WIDTH = 1;
const BORDER_RADIUS = 4;
let InlineEditsInsertionView = class extends Disposable {
  constructor(_editor, _input, _tabAction, instantiationService, _languageService) {
    super();
    this._editor = _editor;
    this._input = _input;
    this._tabAction = _tabAction;
    this._languageService = _languageService;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._state = derived(this, (reader) => {
      const state = this._input.read(reader);
      if (!state) {
        return void 0;
      }
      const textModel = this._editor.getModel();
      const eol = textModel.getEOL();
      if (state.startColumn === 1 && state.lineNumber > 1 && textModel.getLineLength(state.lineNumber) !== 0 && state.text.endsWith(eol) && !state.text.startsWith(eol)) {
        const endOfLineColumn = textModel.getLineLength(state.lineNumber - 1) + 1;
        return { lineNumber: state.lineNumber - 1, column: endOfLineColumn, text: eol + state.text.slice(0, -eol.length) };
      }
      return { lineNumber: state.lineNumber, column: state.startColumn, text: state.text };
    });
    this._trimVertically = derived(this, (reader) => {
      const text = this._state.read(reader)?.text;
      if (!text || text.trim() === "") {
        return { topOffset: 0, bottomOffset: 0, linesTop: 0, linesBottom: 0 };
      }
      const lineHeight = this._editor.getOption(EditorOption.lineHeight);
      const eol = this._editor.getModel().getEOL();
      let linesTop = 0;
      let linesBottom = 0;
      let i = 0;
      for (; i < text.length && text.startsWith(eol, i); i += eol.length) {
        linesTop += 1;
      }
      for (let j = text.length; j > i && text.endsWith(eol, j); j -= eol.length) {
        linesBottom += 1;
      }
      return { topOffset: linesTop * lineHeight, bottomOffset: linesBottom * lineHeight, linesTop, linesBottom };
    });
    this._maxPrefixTrim = derived((reader) => {
      const state = this._state.read(reader);
      if (!state) {
        return { prefixLeftOffset: 0, prefixTrim: 0 };
      }
      const textModel = this._editor.getModel();
      const eol = textModel.getEOL();
      const trimVertically = this._trimVertically.read(reader);
      const lines = state.text.split(eol);
      const modifiedLines = lines.slice(trimVertically.linesTop, lines.length - trimVertically.linesBottom);
      if (trimVertically.linesTop === 0) {
        modifiedLines[0] = textModel.getLineContent(state.lineNumber) + modifiedLines[0];
      }
      const originalRange = new LineRange(state.lineNumber, state.lineNumber + (trimVertically.linesTop > 0 ? 0 : 1));
      return getPrefixTrim([], originalRange, modifiedLines, this._editor);
    });
    this._ghostText = derived((reader) => {
      const state = this._state.read(reader);
      const prefixTrim = this._maxPrefixTrim.read(reader);
      if (!state) {
        return void 0;
      }
      const textModel = this._editor.getModel();
      const eol = textModel.getEOL();
      const modifiedLines = state.text.split(eol);
      const inlineDecorations = modifiedLines.map((line, i) => new InlineDecoration(
        new Range(i + 1, i === 0 ? 1 : prefixTrim.prefixTrim + 1, i + 1, line.length + 1),
        "modified-background",
        InlineDecorationType.Regular
      ));
      return new GhostText(state.lineNumber, [new GhostTextPart(state.column, state.text, false, inlineDecorations)]);
    });
    this._display = derived(this, (reader) => !!this._state.read(reader) ? "block" : "none");
    this._editorMaxContentWidthInRange = derived(this, (reader) => {
      const state = this._state.read(reader);
      if (!state) {
        return 0;
      }
      this._editorObs.versionId.read(reader);
      const textModel = this._editor.getModel();
      const eol = textModel.getEOL();
      const textBeforeInsertion = state.text.startsWith(eol) ? "" : textModel.getValueInRange(new Range(state.lineNumber, 1, state.lineNumber, state.column));
      const textAfterInsertion = textModel.getValueInRange(new Range(state.lineNumber, state.column, state.lineNumber, textModel.getLineLength(state.lineNumber) + 1));
      const text = textBeforeInsertion + state.text + textAfterInsertion;
      const lines = text.split(eol);
      const renderOptions = RenderOptions.fromEditor(this._editor).withSetWidth(false).withScrollBeyondLastColumn(0);
      const lineWidths = lines.map((line) => {
        const t = textModel.tokenization.tokenizeLinesAt(state.lineNumber, [line])?.[0];
        let tokens;
        if (t) {
          tokens = TokenArray.fromLineTokens(t).toLineTokens(line, this._languageService.languageIdCodec);
        } else {
          tokens = LineTokens.createEmpty(line, this._languageService.languageIdCodec);
        }
        return renderLines(new LineSource([tokens]), renderOptions, [], $("div"), true).minWidthInPx;
      });
      return Math.max(...lineWidths);
    });
    this.startLineOffset = this._trimVertically.map((v) => v.topOffset);
    this.originalLines = this._state.map(
      (s) => s ? new LineRange(
        s.lineNumber,
        Math.min(s.lineNumber + 2, this._editor.getModel().getLineCount() + 1)
      ) : void 0
    );
    this._overlayLayout = derivedWithStore(this, (reader, store) => {
      this._ghostText.read(reader);
      const state = this._state.read(reader);
      if (!state) {
        return null;
      }
      this._editorObs.observePosition(observableValue(this, new Position(state.lineNumber, state.column)), store).read(reader);
      const editorLayout = this._editorObs.layoutInfo.read(reader);
      const horizontalScrollOffset = this._editorObs.scrollLeft.read(reader);
      const verticalScrollbarWidth = this._editorObs.layoutInfoVerticalScrollbarWidth.read(reader);
      const right = editorLayout.contentLeft + this._editorMaxContentWidthInRange.read(reader) - horizontalScrollOffset;
      const prefixLeftOffset = this._maxPrefixTrim.read(reader).prefixLeftOffset ?? 0;
      const left = editorLayout.contentLeft + prefixLeftOffset - horizontalScrollOffset;
      if (right <= left) {
        return null;
      }
      const { topOffset: topTrim, bottomOffset: bottomTrim } = this._trimVertically.read(reader);
      const scrollTop = this._editorObs.scrollTop.read(reader);
      const height = this._ghostTextView.height.read(reader) - topTrim - bottomTrim;
      const top = this._editor.getTopForLineNumber(state.lineNumber) - scrollTop + topTrim;
      const bottom = top + height;
      const overlay = new Rect(left, top, right, bottom);
      return {
        overlay,
        startsAtContentLeft: prefixLeftOffset === 0,
        contentLeft: editorLayout.contentLeft,
        minContentWidthRequired: prefixLeftOffset + overlay.width + verticalScrollbarWidth
      };
    }).recomputeInitiallyAndOnChange(this._store);
    this._modifiedOverlay = n.div({
      style: { pointerEvents: "none" }
    }, derived((reader) => {
      const overlayLayoutObs = mapOutFalsy(this._overlayLayout).read(reader);
      if (!overlayLayoutObs) {
        return void 0;
      }
      const overlayHider = overlayLayoutObs.map((layoutInfo) => Rect.fromLeftTopRightBottom(
        layoutInfo.contentLeft - BORDER_RADIUS - BORDER_WIDTH,
        layoutInfo.overlay.top,
        layoutInfo.contentLeft,
        layoutInfo.overlay.bottom
      )).read(reader);
      const overlayRect = overlayLayoutObs.map((l) => l.overlay.withMargin(0, BORDER_WIDTH, 0, l.startsAtContentLeft ? 0 : BORDER_WIDTH).intersectHorizontal(new OffsetRange(overlayHider.left, Number.MAX_SAFE_INTEGER)));
      const underlayRect = overlayRect.map((rect) => rect.withMargin(WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH));
      return [
        n.div({
          class: "originalUnderlayInsertion",
          style: {
            ...underlayRect.read(reader).toStyles(),
            borderRadius: BORDER_RADIUS,
            border: `${BORDER_WIDTH + WIDGET_SEPARATOR_WIDTH}px solid ${asCssVariable(editorBackground)}`,
            boxSizing: "border-box"
          }
        }),
        n.div({
          class: "originalOverlayInsertion",
          style: {
            ...overlayRect.read(reader).toStyles(),
            borderRadius: BORDER_RADIUS,
            border: getModifiedBorderColor(this._tabAction).map((bc) => `${BORDER_WIDTH}px solid ${asCssVariable(bc)}`),
            boxSizing: "border-box",
            backgroundColor: asCssVariable(modifiedBackgroundColor)
          }
        }),
        n.div({
          class: "originalOverlayHiderInsertion",
          style: {
            ...overlayHider.toStyles(),
            backgroundColor: asCssVariable(editorBackground)
          }
        })
      ];
    })).keepUpdated(this._store);
    this._view = n.div({
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
      [this._modifiedOverlay]
    ]).keepUpdated(this._store);
    this._editorObs = observableCodeEditor(this._editor);
    this._ghostTextView = this._register(instantiationService.createInstance(
      GhostTextView,
      this._editor,
      {
        ghostText: this._ghostText,
        minReservedLineCount: constObservable(0),
        targetTextModel: this._editorObs.model.map((model) => model ?? void 0),
        warning: constObservable(void 0)
      },
      observableValue(this, { syntaxHighlightingEnabled: true, extraClasses: ["inline-edit"] }),
      true,
      true
    ));
    this.isHovered = this._ghostTextView.isHovered;
    this._register(this._ghostTextView.onDidClick((e) => {
      this._onDidClick.fire(e);
    }));
    this._register(this._editorObs.createOverlayWidget({
      domNode: this._view.element,
      position: constObservable(null),
      allowEditorOverflow: false,
      minContentWidthInPx: derived((reader) => {
        const info = this._overlayLayout.read(reader);
        if (info === null) {
          return 0;
        }
        return info.minContentWidthRequired;
      })
    }));
  }
};
InlineEditsInsertionView = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILanguageService)
], InlineEditsInsertionView);
export {
  InlineEditsInsertionView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c0luc2VydGlvblZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IHsgJCwgbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSU1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjb25zdE9ic2VydmFibGUsIGRlcml2ZWQsIGRlcml2ZWRXaXRoU3RvcmUsIElPYnNlcnZhYmxlLCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgZWRpdG9yQmFja2dyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JVdGlscy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlQ29kZUVkaXRvciwgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFJlY3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL3JlY3QuanMnO1xuaW1wb3J0IHsgTGluZVNvdXJjZSwgcmVuZGVyTGluZXMsIFJlbmRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2NvbXBvbmVudHMvZGlmZkVkaXRvclZpZXdab25lcy9yZW5kZXJMaW5lcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IE9mZnNldFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0UmFuZ2UuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IExpbmVUb2tlbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgVG9rZW5BcnJheSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi90b2tlbnMvdG9rZW5BcnJheS5qcyc7XG5pbXBvcnQgeyBJbmxpbmVEZWNvcmF0aW9uLCBJbmxpbmVEZWNvcmF0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgR2hvc3RUZXh0LCBHaG9zdFRleHRQYXJ0IH0gZnJvbSAnLi4vLi4vLi4vbW9kZWwvZ2hvc3RUZXh0LmpzJztcbmltcG9ydCB7IEdob3N0VGV4dFZpZXcgfSBmcm9tICcuLi8uLi9naG9zdFRleHQvZ2hvc3RUZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5saW5lRWRpdHNWaWV3LCBJbmxpbmVFZGl0VGFiQWN0aW9uIH0gZnJvbSAnLi4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IGdldE1vZGlmaWVkQm9yZGVyQ29sb3IsIG1vZGlmaWVkQmFja2dyb3VuZENvbG9yIH0gZnJvbSAnLi4vdGhlbWUuanMnO1xuaW1wb3J0IHsgZ2V0UHJlZml4VHJpbSwgbWFwT3V0RmFsc3kgfSBmcm9tICcuLi91dGlscy91dGlscy5qcyc7XG5cbmNvbnN0IEJPUkRFUl9XSURUSCA9IDE7XG5jb25zdCBXSURHRVRfU0VQQVJBVE9SX1dJRFRIID0gMTtcbmNvbnN0IEJPUkRFUl9SQURJVVMgPSA0O1xuXG5leHBvcnQgY2xhc3MgSW5saW5lRWRpdHNJbnNlcnRpb25WaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElJbmxpbmVFZGl0c1ZpZXcge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JPYnM6IE9ic2VydmFibGVDb2RlRWRpdG9yO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2xpY2sgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTW91c2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2xpY2sgPSB0aGlzLl9vbkRpZENsaWNrLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5faW5wdXQucmVhZChyZWFkZXIpO1xuXHRcdGlmICghc3RhdGUpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdGNvbnN0IGVvbCA9IHRleHRNb2RlbC5nZXRFT0woKTtcblxuXHRcdGlmIChzdGF0ZS5zdGFydENvbHVtbiA9PT0gMSAmJiBzdGF0ZS5saW5lTnVtYmVyID4gMSAmJiB0ZXh0TW9kZWwuZ2V0TGluZUxlbmd0aChzdGF0ZS5saW5lTnVtYmVyKSAhPT0gMCAmJiBzdGF0ZS50ZXh0LmVuZHNXaXRoKGVvbCkgJiYgIXN0YXRlLnRleHQuc3RhcnRzV2l0aChlb2wpKSB7XG5cdFx0XHRjb25zdCBlbmRPZkxpbmVDb2x1bW4gPSB0ZXh0TW9kZWwuZ2V0TGluZUxlbmd0aChzdGF0ZS5saW5lTnVtYmVyIC0gMSkgKyAxO1xuXHRcdFx0cmV0dXJuIHsgbGluZU51bWJlcjogc3RhdGUubGluZU51bWJlciAtIDEsIGNvbHVtbjogZW5kT2ZMaW5lQ29sdW1uLCB0ZXh0OiBlb2wgKyBzdGF0ZS50ZXh0LnNsaWNlKDAsIC1lb2wubGVuZ3RoKSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGxpbmVOdW1iZXI6IHN0YXRlLmxpbmVOdW1iZXIsIGNvbHVtbjogc3RhdGUuc3RhcnRDb2x1bW4sIHRleHQ6IHN0YXRlLnRleHQgfTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdHJpbVZlcnRpY2FsbHkgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9IHRoaXMuX3N0YXRlLnJlYWQocmVhZGVyKT8udGV4dDtcblx0XHRpZiAoIXRleHQgfHwgdGV4dC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4geyB0b3BPZmZzZXQ6IDAsIGJvdHRvbU9mZnNldDogMCwgbGluZXNUb3A6IDAsIGxpbmVzQm90dG9tOiAwIH07XG5cdFx0fVxuXG5cdFx0Ly8gQWRqdXN0IGZvciBsZWFkaW5nL3RyYWlsaW5nIG5ld2xpbmVzXG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdGNvbnN0IGVvbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpIS5nZXRFT0woKTtcblx0XHRsZXQgbGluZXNUb3AgPSAwO1xuXHRcdGxldCBsaW5lc0JvdHRvbSA9IDA7XG5cblx0XHRsZXQgaSA9IDA7XG5cdFx0Zm9yICg7IGkgPCB0ZXh0Lmxlbmd0aCAmJiB0ZXh0LnN0YXJ0c1dpdGgoZW9sLCBpKTsgaSArPSBlb2wubGVuZ3RoKSB7XG5cdFx0XHRsaW5lc1RvcCArPSAxO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGogPSB0ZXh0Lmxlbmd0aDsgaiA+IGkgJiYgdGV4dC5lbmRzV2l0aChlb2wsIGopOyBqIC09IGVvbC5sZW5ndGgpIHtcblx0XHRcdGxpbmVzQm90dG9tICs9IDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgdG9wT2Zmc2V0OiBsaW5lc1RvcCAqIGxpbmVIZWlnaHQsIGJvdHRvbU9mZnNldDogbGluZXNCb3R0b20gKiBsaW5lSGVpZ2h0LCBsaW5lc1RvcCwgbGluZXNCb3R0b20gfTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbWF4UHJlZml4VHJpbSA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3N0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRyZXR1cm4geyBwcmVmaXhMZWZ0T2Zmc2V0OiAwLCBwcmVmaXhUcmltOiAwIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdGNvbnN0IGVvbCA9IHRleHRNb2RlbC5nZXRFT0woKTtcblxuXHRcdGNvbnN0IHRyaW1WZXJ0aWNhbGx5ID0gdGhpcy5fdHJpbVZlcnRpY2FsbHkucmVhZChyZWFkZXIpO1xuXG5cdFx0Y29uc3QgbGluZXMgPSBzdGF0ZS50ZXh0LnNwbGl0KGVvbCk7XG5cdFx0Y29uc3QgbW9kaWZpZWRMaW5lcyA9IGxpbmVzLnNsaWNlKHRyaW1WZXJ0aWNhbGx5LmxpbmVzVG9wLCBsaW5lcy5sZW5ndGggLSB0cmltVmVydGljYWxseS5saW5lc0JvdHRvbSk7XG5cdFx0aWYgKHRyaW1WZXJ0aWNhbGx5LmxpbmVzVG9wID09PSAwKSB7XG5cdFx0XHRtb2RpZmllZExpbmVzWzBdID0gdGV4dE1vZGVsLmdldExpbmVDb250ZW50KHN0YXRlLmxpbmVOdW1iZXIpICsgbW9kaWZpZWRMaW5lc1swXTtcblx0XHR9XG5cblx0XHRjb25zdCBvcmlnaW5hbFJhbmdlID0gbmV3IExpbmVSYW5nZShzdGF0ZS5saW5lTnVtYmVyLCBzdGF0ZS5saW5lTnVtYmVyICsgKHRyaW1WZXJ0aWNhbGx5LmxpbmVzVG9wID4gMCA/IDAgOiAxKSk7XG5cblx0XHRyZXR1cm4gZ2V0UHJlZml4VHJpbShbXSwgb3JpZ2luYWxSYW5nZSwgbW9kaWZpZWRMaW5lcywgdGhpcy5fZWRpdG9yKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZ2hvc3RUZXh0ID0gZGVyaXZlZDxHaG9zdFRleHQgfCB1bmRlZmluZWQ+KHJlYWRlciA9PiB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLl9zdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgcHJlZml4VHJpbSA9IHRoaXMuX21heFByZWZpeFRyaW0ucmVhZChyZWFkZXIpO1xuXHRcdGlmICghc3RhdGUpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdGNvbnN0IGVvbCA9IHRleHRNb2RlbC5nZXRFT0woKTtcblx0XHRjb25zdCBtb2RpZmllZExpbmVzID0gc3RhdGUudGV4dC5zcGxpdChlb2wpO1xuXG5cdFx0Y29uc3QgaW5saW5lRGVjb3JhdGlvbnMgPSBtb2RpZmllZExpbmVzLm1hcCgobGluZSwgaSkgPT4gbmV3IElubGluZURlY29yYXRpb24oXG5cdFx0XHRuZXcgUmFuZ2UoaSArIDEsIGkgPT09IDAgPyAxIDogcHJlZml4VHJpbS5wcmVmaXhUcmltICsgMSwgaSArIDEsIGxpbmUubGVuZ3RoICsgMSksXG5cdFx0XHQnbW9kaWZpZWQtYmFja2dyb3VuZCcsXG5cdFx0XHRJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyXG5cdFx0KSk7XG5cblx0XHRyZXR1cm4gbmV3IEdob3N0VGV4dChzdGF0ZS5saW5lTnVtYmVyLCBbbmV3IEdob3N0VGV4dFBhcnQoc3RhdGUuY29sdW1uLCBzdGF0ZS50ZXh0LCBmYWxzZSwgaW5saW5lRGVjb3JhdGlvbnMpXSk7XG5cdH0pO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfZ2hvc3RUZXh0VmlldzogR2hvc3RUZXh0Vmlldztcblx0cmVhZG9ubHkgaXNIb3ZlcmVkOiBJT2JzZXJ2YWJsZTxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lucHV0OiBJT2JzZXJ2YWJsZTx7XG5cdFx0XHRsaW5lTnVtYmVyOiBudW1iZXI7XG5cdFx0XHRzdGFydENvbHVtbjogbnVtYmVyO1xuXHRcdFx0dGV4dDogc3RyaW5nO1xuXHRcdH0gfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RhYkFjdGlvbjogSU9ic2VydmFibGU8SW5saW5lRWRpdFRhYkFjdGlvbj4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2VkaXRvck9icyA9IG9ic2VydmFibGVDb2RlRWRpdG9yKHRoaXMuX2VkaXRvcik7XG5cblx0XHR0aGlzLl9naG9zdFRleHRWaWV3ID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoR2hvc3RUZXh0Vmlldyxcblx0XHRcdHRoaXMuX2VkaXRvcixcblx0XHRcdHtcblx0XHRcdFx0Z2hvc3RUZXh0OiB0aGlzLl9naG9zdFRleHQsXG5cdFx0XHRcdG1pblJlc2VydmVkTGluZUNvdW50OiBjb25zdE9ic2VydmFibGUoMCksXG5cdFx0XHRcdHRhcmdldFRleHRNb2RlbDogdGhpcy5fZWRpdG9yT2JzLm1vZGVsLm1hcChtb2RlbCA9PiBtb2RlbCA/PyB1bmRlZmluZWQpLFxuXHRcdFx0XHR3YXJuaW5nOiBjb25zdE9ic2VydmFibGUodW5kZWZpbmVkKSxcblx0XHRcdH0sXG5cdFx0XHRvYnNlcnZhYmxlVmFsdWUodGhpcywgeyBzeW50YXhIaWdobGlnaHRpbmdFbmFibGVkOiB0cnVlLCBleHRyYUNsYXNzZXM6IFsnaW5saW5lLWVkaXQnXSB9KSxcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlXG5cdFx0KSk7XG5cblx0XHR0aGlzLmlzSG92ZXJlZCA9IHRoaXMuX2dob3N0VGV4dFZpZXcuaXNIb3ZlcmVkO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZ2hvc3RUZXh0Vmlldy5vbkRpZENsaWNrKChlKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENsaWNrLmZpcmUoZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yT2JzLmNyZWF0ZU92ZXJsYXlXaWRnZXQoe1xuXHRcdFx0ZG9tTm9kZTogdGhpcy5fdmlldy5lbGVtZW50LFxuXHRcdFx0cG9zaXRpb246IGNvbnN0T2JzZXJ2YWJsZShudWxsKSxcblx0XHRcdGFsbG93RWRpdG9yT3ZlcmZsb3c6IGZhbHNlLFxuXHRcdFx0bWluQ29udGVudFdpZHRoSW5QeDogZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmZvID0gdGhpcy5fb3ZlcmxheUxheW91dC5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGlmIChpbmZvID09PSBudWxsKSB7IHJldHVybiAwOyB9XG5cdFx0XHRcdHJldHVybiBpbmZvLm1pbkNvbnRlbnRXaWR0aFJlcXVpcmVkO1xuXHRcdFx0fSksXG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcGxheSA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+ICEhdGhpcy5fc3RhdGUucmVhZChyZWFkZXIpID8gJ2Jsb2NrJyA6ICdub25lJyk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yTWF4Q29udGVudFdpZHRoSW5SYW5nZSA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3N0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0dGhpcy5fZWRpdG9yT2JzLnZlcnNpb25JZC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdGNvbnN0IGVvbCA9IHRleHRNb2RlbC5nZXRFT0woKTtcblxuXHRcdGNvbnN0IHRleHRCZWZvcmVJbnNlcnRpb24gPSBzdGF0ZS50ZXh0LnN0YXJ0c1dpdGgoZW9sKSA/ICcnIDogdGV4dE1vZGVsLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2Uoc3RhdGUubGluZU51bWJlciwgMSwgc3RhdGUubGluZU51bWJlciwgc3RhdGUuY29sdW1uKSk7XG5cdFx0Y29uc3QgdGV4dEFmdGVySW5zZXJ0aW9uID0gdGV4dE1vZGVsLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2Uoc3RhdGUubGluZU51bWJlciwgc3RhdGUuY29sdW1uLCBzdGF0ZS5saW5lTnVtYmVyLCB0ZXh0TW9kZWwuZ2V0TGluZUxlbmd0aChzdGF0ZS5saW5lTnVtYmVyKSArIDEpKTtcblx0XHRjb25zdCB0ZXh0ID0gdGV4dEJlZm9yZUluc2VydGlvbiArIHN0YXRlLnRleHQgKyB0ZXh0QWZ0ZXJJbnNlcnRpb247XG5cdFx0Y29uc3QgbGluZXMgPSB0ZXh0LnNwbGl0KGVvbCk7XG5cblx0XHRjb25zdCByZW5kZXJPcHRpb25zID0gUmVuZGVyT3B0aW9ucy5mcm9tRWRpdG9yKHRoaXMuX2VkaXRvcikud2l0aFNldFdpZHRoKGZhbHNlKS53aXRoU2Nyb2xsQmV5b25kTGFzdENvbHVtbigwKTtcblx0XHRjb25zdCBsaW5lV2lkdGhzID0gbGluZXMubWFwKGxpbmUgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IHRleHRNb2RlbC50b2tlbml6YXRpb24udG9rZW5pemVMaW5lc0F0KHN0YXRlLmxpbmVOdW1iZXIsIFtsaW5lXSk/LlswXTtcblx0XHRcdGxldCB0b2tlbnM6IExpbmVUb2tlbnM7XG5cdFx0XHRpZiAodCkge1xuXHRcdFx0XHR0b2tlbnMgPSBUb2tlbkFycmF5LmZyb21MaW5lVG9rZW5zKHQpLnRvTGluZVRva2VucyhsaW5lLCB0aGlzLl9sYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRva2VucyA9IExpbmVUb2tlbnMuY3JlYXRlRW1wdHkobGluZSwgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYyk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZW5kZXJMaW5lcyhuZXcgTGluZVNvdXJjZShbdG9rZW5zXSksIHJlbmRlck9wdGlvbnMsIFtdLCAkKCdkaXYnKSwgdHJ1ZSkubWluV2lkdGhJblB4O1xuXHRcdH0pO1xuXG5cdFx0Ly8gVGFrZSB0aGUgbWF4IHZhbHVlIHRoYXQgd2Ugb2JzZXJ2ZWQuXG5cdFx0Ly8gUmVzZXQgd2hlbiBlaXRoZXIgdGhlIGVkaXQgY2hhbmdlcyBvciB0aGUgZWRpdG9yIHRleHQgdmVyc2lvbi5cblx0XHRyZXR1cm4gTWF0aC5tYXgoLi4ubGluZVdpZHRocyk7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBzdGFydExpbmVPZmZzZXQgPSB0aGlzLl90cmltVmVydGljYWxseS5tYXAodiA9PiB2LnRvcE9mZnNldCk7XG5cdHB1YmxpYyByZWFkb25seSBvcmlnaW5hbExpbmVzID0gdGhpcy5fc3RhdGUubWFwKHMgPT4gcyA/XG5cdFx0bmV3IExpbmVSYW5nZShcblx0XHRcdHMubGluZU51bWJlcixcblx0XHRcdE1hdGgubWluKHMubGluZU51bWJlciArIDIsIHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ291bnQoKSArIDEpXG5cdFx0KSA6IHVuZGVmaW5lZFxuXHQpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX292ZXJsYXlMYXlvdXQgPSBkZXJpdmVkV2l0aFN0b3JlKHRoaXMsIChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0dGhpcy5fZ2hvc3RUZXh0LnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3N0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgdGhlIG92ZXJsYXkgd2hlbiB0aGUgcG9zaXRpb24gY2hhbmdlc1xuXHRcdHRoaXMuX2VkaXRvck9icy5vYnNlcnZlUG9zaXRpb24ob2JzZXJ2YWJsZVZhbHVlKHRoaXMsIG5ldyBQb3NpdGlvbihzdGF0ZS5saW5lTnVtYmVyLCBzdGF0ZS5jb2x1bW4pKSwgc3RvcmUpLnJlYWQocmVhZGVyKTtcblxuXHRcdGNvbnN0IGVkaXRvckxheW91dCA9IHRoaXMuX2VkaXRvck9icy5sYXlvdXRJbmZvLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBob3Jpem9udGFsU2Nyb2xsT2Zmc2V0ID0gdGhpcy5fZWRpdG9yT2JzLnNjcm9sbExlZnQucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggPSB0aGlzLl9lZGl0b3JPYnMubGF5b3V0SW5mb1ZlcnRpY2FsU2Nyb2xsYmFyV2lkdGgucmVhZChyZWFkZXIpO1xuXG5cdFx0Y29uc3QgcmlnaHQgPSBlZGl0b3JMYXlvdXQuY29udGVudExlZnQgKyB0aGlzLl9lZGl0b3JNYXhDb250ZW50V2lkdGhJblJhbmdlLnJlYWQocmVhZGVyKSAtIGhvcml6b250YWxTY3JvbGxPZmZzZXQ7XG5cdFx0Y29uc3QgcHJlZml4TGVmdE9mZnNldCA9IHRoaXMuX21heFByZWZpeFRyaW0ucmVhZChyZWFkZXIpLnByZWZpeExlZnRPZmZzZXQgPz8gMCAvKiBmaXggZHVlIHRvIG9ic2VydmFibGUgYnVnPyAqLztcblx0XHRjb25zdCBsZWZ0ID0gZWRpdG9yTGF5b3V0LmNvbnRlbnRMZWZ0ICsgcHJlZml4TGVmdE9mZnNldCAtIGhvcml6b250YWxTY3JvbGxPZmZzZXQ7XG5cdFx0aWYgKHJpZ2h0IDw9IGxlZnQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgdG9wT2Zmc2V0OiB0b3BUcmltLCBib3R0b21PZmZzZXQ6IGJvdHRvbVRyaW0gfSA9IHRoaXMuX3RyaW1WZXJ0aWNhbGx5LnJlYWQocmVhZGVyKTtcblxuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMuX2VkaXRvck9icy5zY3JvbGxUb3AucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGhlaWdodCA9IHRoaXMuX2dob3N0VGV4dFZpZXcuaGVpZ2h0LnJlYWQocmVhZGVyKSAtIHRvcFRyaW0gLSBib3R0b21UcmltO1xuXHRcdGNvbnN0IHRvcCA9IHRoaXMuX2VkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKHN0YXRlLmxpbmVOdW1iZXIpIC0gc2Nyb2xsVG9wICsgdG9wVHJpbTtcblx0XHRjb25zdCBib3R0b20gPSB0b3AgKyBoZWlnaHQ7XG5cblx0XHRjb25zdCBvdmVybGF5ID0gbmV3IFJlY3QobGVmdCwgdG9wLCByaWdodCwgYm90dG9tKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvdmVybGF5LFxuXHRcdFx0c3RhcnRzQXRDb250ZW50TGVmdDogcHJlZml4TGVmdE9mZnNldCA9PT0gMCxcblx0XHRcdGNvbnRlbnRMZWZ0OiBlZGl0b3JMYXlvdXQuY29udGVudExlZnQsXG5cdFx0XHRtaW5Db250ZW50V2lkdGhSZXF1aXJlZDogcHJlZml4TGVmdE9mZnNldCArIG92ZXJsYXkud2lkdGggKyB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoLFxuXHRcdH07XG5cdH0pLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZE92ZXJsYXkgPSBuLmRpdih7XG5cdFx0c3R5bGU6IHsgcG9pbnRlckV2ZW50czogJ25vbmUnLCB9XG5cdH0sIGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRjb25zdCBvdmVybGF5TGF5b3V0T2JzID0gbWFwT3V0RmFsc3kodGhpcy5fb3ZlcmxheUxheW91dCkucmVhZChyZWFkZXIpO1xuXHRcdGlmICghb3ZlcmxheUxheW91dE9icykgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0XHQvLyBDcmVhdGUgYW4gb3ZlcmxheSB3aGljaCBoaWRlcyB0aGUgbGVmdCBoYW5kIHNpZGUgb2YgdGhlIG9yaWdpbmFsIG92ZXJsYXkgd2hlbiBpdCBvdmVyZmxvd3MgdG8gdGhlIGxlZnRcblx0XHQvLyBzdWNoIHRoYXQgdGhlcmUgaXMgYSBzbW9vdGggdHJhbnNpdGlvbiBhdCB0aGUgZWRnZSBvZiBjb250ZW50IGxlZnRcblx0XHRjb25zdCBvdmVybGF5SGlkZXIgPSBvdmVybGF5TGF5b3V0T2JzLm1hcChsYXlvdXRJbmZvID0+IFJlY3QuZnJvbUxlZnRUb3BSaWdodEJvdHRvbShcblx0XHRcdGxheW91dEluZm8uY29udGVudExlZnQgLSBCT1JERVJfUkFESVVTIC0gQk9SREVSX1dJRFRILFxuXHRcdFx0bGF5b3V0SW5mby5vdmVybGF5LnRvcCxcblx0XHRcdGxheW91dEluZm8uY29udGVudExlZnQsXG5cdFx0XHRsYXlvdXRJbmZvLm92ZXJsYXkuYm90dG9tXG5cdFx0KSkucmVhZChyZWFkZXIpO1xuXG5cdFx0Y29uc3Qgb3ZlcmxheVJlY3QgPSBvdmVybGF5TGF5b3V0T2JzLm1hcChsID0+IGwub3ZlcmxheS53aXRoTWFyZ2luKDAsIEJPUkRFUl9XSURUSCwgMCwgbC5zdGFydHNBdENvbnRlbnRMZWZ0ID8gMCA6IEJPUkRFUl9XSURUSCkuaW50ZXJzZWN0SG9yaXpvbnRhbChuZXcgT2Zmc2V0UmFuZ2Uob3ZlcmxheUhpZGVyLmxlZnQsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSkpO1xuXHRcdGNvbnN0IHVuZGVybGF5UmVjdCA9IG92ZXJsYXlSZWN0Lm1hcChyZWN0ID0+IHJlY3Qud2l0aE1hcmdpbihXSURHRVRfU0VQQVJBVE9SX1dJRFRILCBXSURHRVRfU0VQQVJBVE9SX1dJRFRIKSk7XG5cblx0XHRyZXR1cm4gW1xuXHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRjbGFzczogJ29yaWdpbmFsVW5kZXJsYXlJbnNlcnRpb24nLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLnVuZGVybGF5UmVjdC5yZWFkKHJlYWRlcikudG9TdHlsZXMoKSxcblx0XHRcdFx0XHRib3JkZXJSYWRpdXM6IEJPUkRFUl9SQURJVVMsXG5cdFx0XHRcdFx0Ym9yZGVyOiBgJHtCT1JERVJfV0lEVEggKyBXSURHRVRfU0VQQVJBVE9SX1dJRFRIfXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShlZGl0b3JCYWNrZ3JvdW5kKX1gLFxuXHRcdFx0XHRcdGJveFNpemluZzogJ2JvcmRlci1ib3gnLFxuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRcdG4uZGl2KHtcblx0XHRcdFx0Y2xhc3M6ICdvcmlnaW5hbE92ZXJsYXlJbnNlcnRpb24nLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLm92ZXJsYXlSZWN0LnJlYWQocmVhZGVyKS50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJvcmRlclJhZGl1czogQk9SREVSX1JBRElVUyxcblx0XHRcdFx0XHRib3JkZXI6IGdldE1vZGlmaWVkQm9yZGVyQ29sb3IodGhpcy5fdGFiQWN0aW9uKS5tYXAoYmMgPT4gYCR7Qk9SREVSX1dJRFRIfXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShiYyl9YCksXG5cdFx0XHRcdFx0Ym94U2l6aW5nOiAnYm9yZGVyLWJveCcsXG5cdFx0XHRcdFx0YmFja2dyb3VuZENvbG9yOiBhc0Nzc1ZhcmlhYmxlKG1vZGlmaWVkQmFja2dyb3VuZENvbG9yKSxcblx0XHRcdFx0fVxuXHRcdFx0fSksXG5cdFx0XHRuLmRpdih7XG5cdFx0XHRcdGNsYXNzOiAnb3JpZ2luYWxPdmVybGF5SGlkZXJJbnNlcnRpb24nLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLm92ZXJsYXlIaWRlci50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJhY2tncm91bmRDb2xvcjogYXNDc3NWYXJpYWJsZShlZGl0b3JCYWNrZ3JvdW5kKSxcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRdO1xuXHR9KSkua2VlcFVwZGF0ZWQodGhpcy5fc3RvcmUpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXcgPSBuLmRpdih7XG5cdFx0Y2xhc3M6ICdpbmxpbmUtZWRpdHMtdmlldycsXG5cdFx0c3R5bGU6IHtcblx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0b3ZlcmZsb3c6ICd2aXNpYmxlJyxcblx0XHRcdHRvcDogJzBweCcsXG5cdFx0XHRsZWZ0OiAnMHB4Jyxcblx0XHRcdHpJbmRleDogJzAnLFxuXHRcdFx0ZGlzcGxheTogdGhpcy5fZGlzcGxheSxcblx0XHR9LFxuXHR9LCBbXG5cdFx0W3RoaXMuX21vZGlmaWVkT3ZlcmxheV0sXG5cdF0pLmtlZXBVcGRhdGVkKHRoaXMuX3N0b3JlKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBSUEsU0FBUyxHQUFHLFNBQVM7QUFFckIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCLFNBQVMsa0JBQStCLHVCQUF1QjtBQUN6RixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFCQUFxQjtBQUU5QixTQUErQiw0QkFBNEI7QUFDM0QsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsWUFBWSxhQUFhLHFCQUFxQjtBQUN2RCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0IsNEJBQTRCO0FBQ3ZELFNBQVMsV0FBVyxxQkFBcUI7QUFDekMsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUyx3QkFBd0IsK0JBQStCO0FBQ2hFLFNBQVMsZUFBZSxtQkFBbUI7QUFFM0MsTUFBTSxlQUFlO0FBQ3JCLE1BQU0seUJBQXlCO0FBQy9CLE1BQU0sZ0JBQWdC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
