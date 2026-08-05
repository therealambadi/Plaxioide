import { n } from "../../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { constObservable, derived, derivedObservableWithCache } from "../../../../../../../base/common/observable.js";
import { editorBackground } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { observableCodeEditor } from "../../../../../../browser/observableCodeEditor.js";
import { Rect } from "../../../../../../browser/rect.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { Position } from "../../../../../../common/core/position.js";
import { getOriginalBorderColor, originalBackgroundColor } from "../theme.js";
import { getPrefixTrim, mapOutFalsy, maxContentWidthInRange } from "../utils/utils.js";
const HORIZONTAL_PADDING = 0;
const VERTICAL_PADDING = 0;
const BORDER_WIDTH = 1;
const WIDGET_SEPARATOR_WIDTH = 1;
const BORDER_RADIUS = 4;
class InlineEditsDeletionView extends Disposable {
  constructor(_editor, _edit, _uiState, _tabAction) {
    super();
    this._editor = _editor;
    this._edit = _edit;
    this._uiState = _uiState;
    this._tabAction = _tabAction;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._display = derived(this, (reader) => !!this._uiState.read(reader) ? "block" : "none");
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
    this._maxPrefixTrim = derived((reader) => {
      const state = this._uiState.read(reader);
      if (!state) {
        return { prefixTrim: 0, prefixLeftOffset: 0 };
      }
      return getPrefixTrim(state.deletions, state.originalRange, [], this._editor);
    });
    this._editorLayoutInfo = derived(this, (reader) => {
      const inlineEdit = this._edit.read(reader);
      if (!inlineEdit) {
        return null;
      }
      const state = this._uiState.read(reader);
      if (!state) {
        return null;
      }
      const editorLayout = this._editorObs.layoutInfo.read(reader);
      const horizontalScrollOffset = this._editorObs.scrollLeft.read(reader);
      const w = this._editorObs.getOption(EditorOption.fontInfo).map((f) => f.typicalHalfwidthCharacterWidth).read(reader);
      const right = editorLayout.contentLeft + Math.max(this._editorMaxContentWidthInRange.read(reader), w) - horizontalScrollOffset;
      const range = inlineEdit.originalLineRange;
      const selectionTop = this._originalVerticalStartPosition.read(reader) ?? this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
      const selectionBottom = this._originalVerticalEndPosition.read(reader) ?? this._editor.getTopForLineNumber(range.endLineNumberExclusive) - this._editorObs.scrollTop.read(reader);
      const left = editorLayout.contentLeft + this._maxPrefixTrim.read(reader).prefixLeftOffset - horizontalScrollOffset;
      if (right <= left) {
        return null;
      }
      const codeRect = Rect.fromLeftTopRightBottom(left, selectionTop, right, selectionBottom).withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING);
      return {
        codeRect,
        contentLeft: editorLayout.contentLeft
      };
    }).recomputeInitiallyAndOnChange(this._store);
    this._originalOverlay = n.div({
      style: { pointerEvents: "none" }
    }, derived((reader) => {
      const layoutInfoObs = mapOutFalsy(this._editorLayoutInfo).read(reader);
      if (!layoutInfoObs) {
        return void 0;
      }
      const overlayhider = layoutInfoObs.map((layoutInfo) => Rect.fromLeftTopRightBottom(
        layoutInfo.contentLeft - BORDER_RADIUS - BORDER_WIDTH,
        layoutInfo.codeRect.top,
        layoutInfo.contentLeft,
        layoutInfo.codeRect.bottom
      ));
      const overlayRect = derived((reader2) => {
        const rect = layoutInfoObs.read(reader2).codeRect;
        const overlayHider = overlayhider.read(reader2);
        return rect.intersectHorizontal(new OffsetRange(overlayHider.left, Number.MAX_SAFE_INTEGER));
      });
      const separatorRect = overlayRect.map((rect) => rect.withMargin(WIDGET_SEPARATOR_WIDTH, WIDGET_SEPARATOR_WIDTH));
      return [
        n.div({
          class: "originalSeparatorDeletion",
          style: {
            ...separatorRect.read(reader).toStyles(),
            borderRadius: `${BORDER_RADIUS}px`,
            border: `${BORDER_WIDTH + WIDGET_SEPARATOR_WIDTH}px solid ${asCssVariable(editorBackground)}`,
            boxSizing: "border-box"
          }
        }),
        n.div({
          class: "originalOverlayDeletion",
          style: {
            ...overlayRect.read(reader).toStyles(),
            borderRadius: `${BORDER_RADIUS}px`,
            border: getOriginalBorderColor(this._tabAction).map((bc) => `${BORDER_WIDTH}px solid ${asCssVariable(bc)}`),
            boxSizing: "border-box",
            backgroundColor: asCssVariable(originalBackgroundColor)
          }
        }),
        n.div({
          class: "originalOverlayHiderDeletion",
          style: {
            ...overlayhider.read(reader).toStyles(),
            backgroundColor: asCssVariable(editorBackground)
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
      [this._originalOverlay]
    ]).keepUpdated(this._store);
    this.isHovered = constObservable(false);
    this._editorObs = observableCodeEditor(this._editor);
    const originalStartPosition = derived(this, (reader) => {
      const inlineEdit = this._edit.read(reader);
      return inlineEdit ? new Position(inlineEdit.originalLineRange.startLineNumber, 1) : null;
    });
    const originalEndPosition = derived(this, (reader) => {
      const inlineEdit = this._edit.read(reader);
      return inlineEdit ? new Position(inlineEdit.originalLineRange.endLineNumberExclusive, 1) : null;
    });
    this._originalDisplayRange = this._uiState.map((s) => s?.originalRange);
    this._originalVerticalStartPosition = this._editorObs.observePosition(originalStartPosition, this._store).map((p) => p?.y);
    this._originalVerticalEndPosition = this._editorObs.observePosition(originalEndPosition, this._store).map((p) => p?.y);
    this._register(this._editorObs.createOverlayWidget({
      domNode: this._nonOverflowView.element,
      position: constObservable(null),
      allowEditorOverflow: false,
      minContentWidthInPx: derived((reader) => {
        const info = this._editorLayoutInfo.read(reader);
        if (info === null) {
          return 0;
        }
        return info.codeRect.width;
      })
    }));
  }
}
export {
  InlineEditsDeletionView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c0RlbGV0aW9uVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGNvbnN0T2JzZXJ2YWJsZSwgZGVyaXZlZCwgZGVyaXZlZE9ic2VydmFibGVXaXRoQ2FjaGUsIElPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclV0aWxzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IE9ic2VydmFibGVDb2RlRWRpdG9yLCBvYnNlcnZhYmxlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvb2JzZXJ2YWJsZUNvZGVFZGl0b3IuanMnO1xuaW1wb3J0IHsgUmVjdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvcmVjdC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IE9mZnNldFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0UmFuZ2UuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElJbmxpbmVFZGl0c1ZpZXcsIElubGluZUVkaXRUYWJBY3Rpb24gfSBmcm9tICcuLi9pbmxpbmVFZGl0c1ZpZXdJbnRlcmZhY2UuanMnO1xuaW1wb3J0IHsgSW5saW5lRWRpdFdpdGhDaGFuZ2VzIH0gZnJvbSAnLi4vaW5saW5lRWRpdFdpdGhDaGFuZ2VzLmpzJztcbmltcG9ydCB7IGdldE9yaWdpbmFsQm9yZGVyQ29sb3IsIG9yaWdpbmFsQmFja2dyb3VuZENvbG9yIH0gZnJvbSAnLi4vdGhlbWUuanMnO1xuaW1wb3J0IHsgZ2V0UHJlZml4VHJpbSwgbWFwT3V0RmFsc3ksIG1heENvbnRlbnRXaWR0aEluUmFuZ2UgfSBmcm9tICcuLi91dGlscy91dGlscy5qcyc7XG5cbmNvbnN0IEhPUklaT05UQUxfUEFERElORyA9IDA7XG5jb25zdCBWRVJUSUNBTF9QQURESU5HID0gMDtcbmNvbnN0IEJPUkRFUl9XSURUSCA9IDE7XG5jb25zdCBXSURHRVRfU0VQQVJBVE9SX1dJRFRIID0gMTtcbmNvbnN0IEJPUkRFUl9SQURJVVMgPSA0O1xuXG5leHBvcnQgY2xhc3MgSW5saW5lRWRpdHNEZWxldGlvblZpZXcgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUlubGluZUVkaXRzVmlldyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbGljayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElNb3VzZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDbGljayA9IHRoaXMuX29uRGlkQ2xpY2suZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yT2JzOiBPYnNlcnZhYmxlQ29kZUVkaXRvcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbFZlcnRpY2FsU3RhcnRQb3NpdGlvbjogSU9ic2VydmFibGU8bnVtYmVyIHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxWZXJ0aWNhbEVuZFBvc2l0aW9uOiBJT2JzZXJ2YWJsZTxudW1iZXIgfCB1bmRlZmluZWQ+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsRGlzcGxheVJhbmdlOiBJT2JzZXJ2YWJsZTxMaW5lUmFuZ2UgfCB1bmRlZmluZWQ+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdDogSU9ic2VydmFibGU8SW5saW5lRWRpdFdpdGhDaGFuZ2VzIHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF91aVN0YXRlOiBJT2JzZXJ2YWJsZTx7XG5cdFx0XHRvcmlnaW5hbFJhbmdlOiBMaW5lUmFuZ2U7XG5cdFx0XHRkZWxldGlvbnM6IFJhbmdlW107XG5cdFx0fSB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGFiQWN0aW9uOiBJT2JzZXJ2YWJsZTxJbmxpbmVFZGl0VGFiQWN0aW9uPixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2VkaXRvck9icyA9IG9ic2VydmFibGVDb2RlRWRpdG9yKHRoaXMuX2VkaXRvcik7XG5cblx0XHRjb25zdCBvcmlnaW5hbFN0YXJ0UG9zaXRpb24gPSBkZXJpdmVkKHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHRcdGNvbnN0IGlubGluZUVkaXQgPSB0aGlzLl9lZGl0LnJlYWQocmVhZGVyKTtcblx0XHRcdHJldHVybiBpbmxpbmVFZGl0ID8gbmV3IFBvc2l0aW9uKGlubGluZUVkaXQub3JpZ2luYWxMaW5lUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKSA6IG51bGw7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBvcmlnaW5hbEVuZFBvc2l0aW9uID0gZGVyaXZlZCh0aGlzLCAocmVhZGVyKSA9PiB7XG5cdFx0XHRjb25zdCBpbmxpbmVFZGl0ID0gdGhpcy5fZWRpdC5yZWFkKHJlYWRlcik7XG5cdFx0XHRyZXR1cm4gaW5saW5lRWRpdCA/IG5ldyBQb3NpdGlvbihpbmxpbmVFZGl0Lm9yaWdpbmFsTGluZVJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUsIDEpIDogbnVsbDtcblx0XHR9KTtcblxuXHRcdHRoaXMuX29yaWdpbmFsRGlzcGxheVJhbmdlID0gdGhpcy5fdWlTdGF0ZS5tYXAocyA9PiBzPy5vcmlnaW5hbFJhbmdlKTtcblx0XHR0aGlzLl9vcmlnaW5hbFZlcnRpY2FsU3RhcnRQb3NpdGlvbiA9IHRoaXMuX2VkaXRvck9icy5vYnNlcnZlUG9zaXRpb24ob3JpZ2luYWxTdGFydFBvc2l0aW9uLCB0aGlzLl9zdG9yZSkubWFwKHAgPT4gcD8ueSk7XG5cdFx0dGhpcy5fb3JpZ2luYWxWZXJ0aWNhbEVuZFBvc2l0aW9uID0gdGhpcy5fZWRpdG9yT2JzLm9ic2VydmVQb3NpdGlvbihvcmlnaW5hbEVuZFBvc2l0aW9uLCB0aGlzLl9zdG9yZSkubWFwKHAgPT4gcD8ueSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3JPYnMuY3JlYXRlT3ZlcmxheVdpZGdldCh7XG5cdFx0XHRkb21Ob2RlOiB0aGlzLl9ub25PdmVyZmxvd1ZpZXcuZWxlbWVudCxcblx0XHRcdHBvc2l0aW9uOiBjb25zdE9ic2VydmFibGUobnVsbCksXG5cdFx0XHRhbGxvd0VkaXRvck92ZXJmbG93OiBmYWxzZSxcblx0XHRcdG1pbkNvbnRlbnRXaWR0aEluUHg6IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdFx0Y29uc3QgaW5mbyA9IHRoaXMuX2VkaXRvckxheW91dEluZm8ucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRpZiAoaW5mbyA9PT0gbnVsbCkgeyByZXR1cm4gMDsgfVxuXHRcdFx0XHRyZXR1cm4gaW5mby5jb2RlUmVjdC53aWR0aDtcblx0XHRcdH0pLFxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3BsYXkgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiAhIXRoaXMuX3VpU3RhdGUucmVhZChyZWFkZXIpID8gJ2Jsb2NrJyA6ICdub25lJyk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yTWF4Q29udGVudFdpZHRoSW5SYW5nZSA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbERpc3BsYXlSYW5nZSA9IHRoaXMuX29yaWdpbmFsRGlzcGxheVJhbmdlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIW9yaWdpbmFsRGlzcGxheVJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gY29uc3RPYnNlcnZhYmxlKDApO1xuXHRcdH1cblx0XHR0aGlzLl9lZGl0b3JPYnMudmVyc2lvbklkLnJlYWQocmVhZGVyKTtcblxuXHRcdC8vIFRha2UgdGhlIG1heCB2YWx1ZSB0aGF0IHdlIG9ic2VydmVkLlxuXHRcdC8vIFJlc2V0IHdoZW4gZWl0aGVyIHRoZSBlZGl0IGNoYW5nZXMgb3IgdGhlIGVkaXRvciB0ZXh0IHZlcnNpb24uXG5cdFx0cmV0dXJuIGRlcml2ZWRPYnNlcnZhYmxlV2l0aENhY2hlPG51bWJlcj4odGhpcywgKHJlYWRlciwgbGFzdFZhbHVlKSA9PiB7XG5cdFx0XHRjb25zdCBtYXhXaWR0aCA9IG1heENvbnRlbnRXaWR0aEluUmFuZ2UodGhpcy5fZWRpdG9yT2JzLCBvcmlnaW5hbERpc3BsYXlSYW5nZSwgcmVhZGVyKTtcblx0XHRcdHJldHVybiBNYXRoLm1heChtYXhXaWR0aCwgbGFzdFZhbHVlID8/IDApO1xuXHRcdH0pO1xuXHR9KS5tYXAoKHYsIHIpID0+IHYucmVhZChyKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbWF4UHJlZml4VHJpbSA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3VpU3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdGlmICghc3RhdGUpIHtcblx0XHRcdHJldHVybiB7IHByZWZpeFRyaW06IDAsIHByZWZpeExlZnRPZmZzZXQ6IDAgfTtcblx0XHR9XG5cdFx0cmV0dXJuIGdldFByZWZpeFRyaW0oc3RhdGUuZGVsZXRpb25zLCBzdGF0ZS5vcmlnaW5hbFJhbmdlLCBbXSwgdGhpcy5fZWRpdG9yKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yTGF5b3V0SW5mbyA9IGRlcml2ZWQodGhpcywgKHJlYWRlcikgPT4ge1xuXHRcdGNvbnN0IGlubGluZUVkaXQgPSB0aGlzLl9lZGl0LnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIWlubGluZUVkaXQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3VpU3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdGlmICghc3RhdGUpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvckxheW91dCA9IHRoaXMuX2VkaXRvck9icy5sYXlvdXRJbmZvLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBob3Jpem9udGFsU2Nyb2xsT2Zmc2V0ID0gdGhpcy5fZWRpdG9yT2JzLnNjcm9sbExlZnQucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IHcgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250SW5mbykubWFwKGYgPT4gZi50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGgpLnJlYWQocmVhZGVyKTtcblxuXHRcdGNvbnN0IHJpZ2h0ID0gZWRpdG9yTGF5b3V0LmNvbnRlbnRMZWZ0ICsgTWF0aC5tYXgodGhpcy5fZWRpdG9yTWF4Q29udGVudFdpZHRoSW5SYW5nZS5yZWFkKHJlYWRlciksIHcpIC0gaG9yaXpvbnRhbFNjcm9sbE9mZnNldDtcblxuXHRcdGNvbnN0IHJhbmdlID0gaW5saW5lRWRpdC5vcmlnaW5hbExpbmVSYW5nZTtcblx0XHRjb25zdCBzZWxlY3Rpb25Ub3AgPSB0aGlzLl9vcmlnaW5hbFZlcnRpY2FsU3RhcnRQb3NpdGlvbi5yZWFkKHJlYWRlcikgPz8gdGhpcy5fZWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSAtIHRoaXMuX2VkaXRvck9icy5zY3JvbGxUb3AucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbkJvdHRvbSA9IHRoaXMuX29yaWdpbmFsVmVydGljYWxFbmRQb3NpdGlvbi5yZWFkKHJlYWRlcikgPz8gdGhpcy5fZWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIocmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSkgLSB0aGlzLl9lZGl0b3JPYnMuc2Nyb2xsVG9wLnJlYWQocmVhZGVyKTtcblxuXHRcdGNvbnN0IGxlZnQgPSBlZGl0b3JMYXlvdXQuY29udGVudExlZnQgKyB0aGlzLl9tYXhQcmVmaXhUcmltLnJlYWQocmVhZGVyKS5wcmVmaXhMZWZ0T2Zmc2V0IC0gaG9yaXpvbnRhbFNjcm9sbE9mZnNldDtcblxuXHRcdGlmIChyaWdodCA8PSBsZWZ0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBjb2RlUmVjdCA9IFJlY3QuZnJvbUxlZnRUb3BSaWdodEJvdHRvbShsZWZ0LCBzZWxlY3Rpb25Ub3AsIHJpZ2h0LCBzZWxlY3Rpb25Cb3R0b20pLndpdGhNYXJnaW4oVkVSVElDQUxfUEFERElORywgSE9SSVpPTlRBTF9QQURESU5HKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb2RlUmVjdCxcblx0XHRcdGNvbnRlbnRMZWZ0OiBlZGl0b3JMYXlvdXQuY29udGVudExlZnQsXG5cdFx0fTtcblx0fSkucmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UodGhpcy5fc3RvcmUpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsT3ZlcmxheSA9IG4uZGl2KHtcblx0XHRzdHlsZTogeyBwb2ludGVyRXZlbnRzOiAnbm9uZScsIH1cblx0fSwgZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGxheW91dEluZm9PYnMgPSBtYXBPdXRGYWxzeSh0aGlzLl9lZGl0b3JMYXlvdXRJbmZvKS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFsYXlvdXRJbmZvT2JzKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuXHRcdC8vIENyZWF0ZSBhbiBvdmVybGF5IHdoaWNoIGhpZGVzIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgb3JpZ2luYWwgb3ZlcmxheSB3aGVuIGl0IG92ZXJmbG93cyB0byB0aGUgbGVmdFxuXHRcdC8vIHN1Y2ggdGhhdCB0aGVyZSBpcyBhIHNtb290aCB0cmFuc2l0aW9uIGF0IHRoZSBlZGdlIG9mIGNvbnRlbnQgbGVmdFxuXHRcdGNvbnN0IG92ZXJsYXloaWRlciA9IGxheW91dEluZm9PYnMubWFwKGxheW91dEluZm8gPT4gUmVjdC5mcm9tTGVmdFRvcFJpZ2h0Qm90dG9tKFxuXHRcdFx0bGF5b3V0SW5mby5jb250ZW50TGVmdCAtIEJPUkRFUl9SQURJVVMgLSBCT1JERVJfV0lEVEgsXG5cdFx0XHRsYXlvdXRJbmZvLmNvZGVSZWN0LnRvcCxcblx0XHRcdGxheW91dEluZm8uY29udGVudExlZnQsXG5cdFx0XHRsYXlvdXRJbmZvLmNvZGVSZWN0LmJvdHRvbVxuXHRcdCkpO1xuXG5cdFx0Y29uc3Qgb3ZlcmxheVJlY3QgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCByZWN0ID0gbGF5b3V0SW5mb09icy5yZWFkKHJlYWRlcikuY29kZVJlY3Q7XG5cdFx0XHRjb25zdCBvdmVybGF5SGlkZXIgPSBvdmVybGF5aGlkZXIucmVhZChyZWFkZXIpO1xuXHRcdFx0cmV0dXJuIHJlY3QuaW50ZXJzZWN0SG9yaXpvbnRhbChuZXcgT2Zmc2V0UmFuZ2Uob3ZlcmxheUhpZGVyLmxlZnQsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzZXBhcmF0b3JSZWN0ID0gb3ZlcmxheVJlY3QubWFwKHJlY3QgPT4gcmVjdC53aXRoTWFyZ2luKFdJREdFVF9TRVBBUkFUT1JfV0lEVEgsIFdJREdFVF9TRVBBUkFUT1JfV0lEVEgpKTtcblxuXHRcdHJldHVybiBbXG5cdFx0XHRuLmRpdih7XG5cdFx0XHRcdGNsYXNzOiAnb3JpZ2luYWxTZXBhcmF0b3JEZWxldGlvbicsXG5cdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0Li4uc2VwYXJhdG9yUmVjdC5yZWFkKHJlYWRlcikudG9TdHlsZXMoKSxcblx0XHRcdFx0XHRib3JkZXJSYWRpdXM6IGAke0JPUkRFUl9SQURJVVN9cHhgLFxuXHRcdFx0XHRcdGJvcmRlcjogYCR7Qk9SREVSX1dJRFRIICsgV0lER0VUX1NFUEFSQVRPUl9XSURUSH1weCBzb2xpZCAke2FzQ3NzVmFyaWFibGUoZWRpdG9yQmFja2dyb3VuZCl9YCxcblx0XHRcdFx0XHRib3hTaXppbmc6ICdib3JkZXItYm94Jyxcblx0XHRcdFx0fVxuXHRcdFx0fSksXG5cdFx0XHRuLmRpdih7XG5cdFx0XHRcdGNsYXNzOiAnb3JpZ2luYWxPdmVybGF5RGVsZXRpb24nLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLm92ZXJsYXlSZWN0LnJlYWQocmVhZGVyKS50b1N0eWxlcygpLFxuXHRcdFx0XHRcdGJvcmRlclJhZGl1czogYCR7Qk9SREVSX1JBRElVU31weGAsXG5cdFx0XHRcdFx0Ym9yZGVyOiBnZXRPcmlnaW5hbEJvcmRlckNvbG9yKHRoaXMuX3RhYkFjdGlvbikubWFwKGJjID0+IGAke0JPUkRFUl9XSURUSH1weCBzb2xpZCAke2FzQ3NzVmFyaWFibGUoYmMpfWApLFxuXHRcdFx0XHRcdGJveFNpemluZzogJ2JvcmRlci1ib3gnLFxuXHRcdFx0XHRcdGJhY2tncm91bmRDb2xvcjogYXNDc3NWYXJpYWJsZShvcmlnaW5hbEJhY2tncm91bmRDb2xvciksXG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRjbGFzczogJ29yaWdpbmFsT3ZlcmxheUhpZGVyRGVsZXRpb24nLFxuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdC4uLm92ZXJsYXloaWRlci5yZWFkKHJlYWRlcikudG9TdHlsZXMoKSxcblx0XHRcdFx0XHRiYWNrZ3JvdW5kQ29sb3I6IGFzQ3NzVmFyaWFibGUoZWRpdG9yQmFja2dyb3VuZCksXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0XTtcblx0fSkpLmtlZXBVcGRhdGVkKHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ub25PdmVyZmxvd1ZpZXcgPSBuLmRpdih7XG5cdFx0Y2xhc3M6ICdpbmxpbmUtZWRpdHMtdmlldycsXG5cdFx0c3R5bGU6IHtcblx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0b3ZlcmZsb3c6ICd2aXNpYmxlJyxcblx0XHRcdHRvcDogJzBweCcsXG5cdFx0XHRsZWZ0OiAnMHB4Jyxcblx0XHRcdHpJbmRleDogJzAnLFxuXHRcdFx0ZGlzcGxheTogdGhpcy5fZGlzcGxheSxcblx0XHR9LFxuXHR9LCBbXG5cdFx0W3RoaXMuX29yaWdpbmFsT3ZlcmxheV0sXG5cdF0pLmtlZXBVcGRhdGVkKHRoaXMuX3N0b3JlKTtcblxuXHRyZWFkb25seSBpc0hvdmVyZWQgPSBjb25zdE9ic2VydmFibGUoZmFsc2UpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsU0FBUyxTQUFTO0FBRWxCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQixTQUFTLGtDQUErQztBQUNsRixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFCQUFxQjtBQUU5QixTQUErQiw0QkFBNEI7QUFDM0QsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0JBQWdCO0FBSXpCLFNBQVMsd0JBQXdCLCtCQUErQjtBQUNoRSxTQUFTLGVBQWUsYUFBYSw4QkFBOEI7QUFFbkUsTUFBTSxxQkFBcUI7QUFDM0IsTUFBTSxtQkFBbUI7QUFDekIsTUFBTSxlQUFlO0FBQ3JCLE1BQU0seUJBQXlCO0FBQy9CLE1BQU0sZ0JBQWdCO0FBRWYsTUFBTSxnQ0FBZ0MsV0FBdUM7QUFBQSxFQVluRixZQUNrQixTQUNBLE9BQ0EsVUFJQSxZQUNoQjtBQUNELFVBQU07QUFSVztBQUNBO0FBQ0E7QUFJQTtBQWpCbEIsU0FBaUIsY0FBYyxLQUFLLFVB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
