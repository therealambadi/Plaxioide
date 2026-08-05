import { n } from "../../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { constObservable, derived } from "../../../../../../../base/common/observable.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { Point } from "../../../../../../browser/point.js";
import { Rect } from "../../../../../../browser/rect.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { getModifiedBorderColor } from "../theme.js";
import { mapOutFalsy, rectToProps } from "../utils/utils.js";
class InlineEditsWordInsertView extends Disposable {
  constructor(_editor, _edit, _tabAction) {
    super();
    this._editor = _editor;
    this._edit = _edit;
    this._tabAction = _tabAction;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._start = this._editor.observePosition(constObservable(this._edit.range.getStartPosition()), this._store);
    this._layout = derived(this, (reader) => {
      const start = this._start.read(reader);
      if (!start) {
        return void 0;
      }
      const contentLeft = this._editor.layoutInfoContentLeft.read(reader);
      const lineHeight = this._editor.getOption(EditorOption.lineHeight).read(reader);
      const w = this._editor.getOption(EditorOption.fontInfo).read(reader).typicalHalfwidthCharacterWidth;
      const width = this._edit.text.length * w + 5;
      const center = new Point(contentLeft + start.x + w / 2 - this._editor.scrollLeft.read(reader), start.y);
      const modified = Rect.fromLeftTopWidthHeight(center.x - width / 2, center.y + lineHeight + 5, width, lineHeight);
      const background = Rect.hull([Rect.fromPoint(center), modified]).withMargin(4);
      return {
        modified,
        center,
        background,
        lowerBackground: background.intersectVertical(new OffsetRange(modified.top - 2, Number.MAX_SAFE_INTEGER))
      };
    });
    this._div = n.div({
      class: "word-insert"
    }, [
      derived((reader) => {
        const layout = mapOutFalsy(this._layout).read(reader);
        if (!layout) {
          return [];
        }
        const modifiedBorderColor = asCssVariable(getModifiedBorderColor(this._tabAction).read(reader));
        return [
          n.div({
            style: {
              position: "absolute",
              ...rectToProps((reader2) => layout.read(reader2).lowerBackground),
              borderRadius: "4px",
              background: "var(--vscode-editor-background)"
            }
          }, []),
          n.div({
            style: {
              position: "absolute",
              ...rectToProps((reader2) => layout.read(reader2).modified),
              borderRadius: "4px",
              padding: "0px",
              textAlign: "center",
              background: "var(--vscode-inlineEdit-modifiedChangedTextBackground)",
              fontFamily: this._editor.getOption(EditorOption.fontFamily),
              fontSize: this._editor.getOption(EditorOption.fontSize),
              fontWeight: this._editor.getOption(EditorOption.fontWeight)
            }
          }, [
            this._edit.text
          ]),
          n.div({
            style: {
              position: "absolute",
              ...rectToProps((reader2) => layout.read(reader2).background),
              borderRadius: "4px",
              border: `1px solid ${modifiedBorderColor}`,
              //background: 'rgba(122, 122, 122, 0.12)', looks better
              background: "var(--vscode-inlineEdit-wordReplacementView-background)"
            }
          }, []),
          n.svg({
            viewBox: "0 0 12 18",
            width: 12,
            height: 18,
            fill: "none",
            style: {
              position: "absolute",
              left: derived((reader2) => layout.read(reader2).center.x - 9),
              top: derived((reader2) => layout.read(reader2).center.y + 4),
              transform: "scale(1.4, 1.4)"
            }
          }, [
            n.svgElem("path", {
              d: "M5.06445 0H7.35759C7.35759 0 7.35759 8.47059 7.35759 11.1176C7.35759 13.7647 9.4552 18 13.4674 18C17.4795 18 -2.58445 18 0.281373 18C3.14719 18 5.06477 14.2941 5.06477 11.1176C5.06477 7.94118 5.06445 0 5.06445 0Z",
              fill: "var(--vscode-inlineEdit-modifiedChangedTextBackground)"
            })
          ])
        ];
      })
    ]).keepUpdated(this._store);
    this.isHovered = constObservable(false);
    this._register(this._editor.createOverlayWidget({
      domNode: this._div.element,
      minContentWidthInPx: constObservable(0),
      position: constObservable({ preference: { top: 0, left: 0 } }),
      allowEditorOverflow: false
    }));
  }
}
export {
  InlineEditsWordInsertView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c1dvcmRJbnNlcnRWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSU1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjb25zdE9ic2VydmFibGUsIGRlcml2ZWQsIElPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yVXRpbHMuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFBvaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9wb2ludC5qcyc7XG5pbXBvcnQgeyBSZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9yZWN0LmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBPZmZzZXRSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL29mZnNldFJhbmdlLmpzJztcbmltcG9ydCB7IFNpbmdsZVRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvdGV4dEVkaXQuanMnO1xuaW1wb3J0IHsgSUlubGluZUVkaXRzVmlldywgSW5saW5lRWRpdFRhYkFjdGlvbiB9IGZyb20gJy4uL2lubGluZUVkaXRzVmlld0ludGVyZmFjZS5qcyc7XG5pbXBvcnQgeyBnZXRNb2RpZmllZEJvcmRlckNvbG9yIH0gZnJvbSAnLi4vdGhlbWUuanMnO1xuaW1wb3J0IHsgbWFwT3V0RmFsc3ksIHJlY3RUb1Byb3BzIH0gZnJvbSAnLi4vdXRpbHMvdXRpbHMuanMnO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lRWRpdHNXb3JkSW5zZXJ0VmlldyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJSW5saW5lRWRpdHNWaWV3IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENsaWNrID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vdXNlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsaWNrID0gdGhpcy5fb25EaWRDbGljay5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFydCA9IHRoaXMuX2VkaXRvci5vYnNlcnZlUG9zaXRpb24oY29uc3RPYnNlcnZhYmxlKHRoaXMuX2VkaXQucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKSwgdGhpcy5fc3RvcmUpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xheW91dCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBzdGFydCA9IHRoaXMuX3N0YXJ0LnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXN0YXJ0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBjb250ZW50TGVmdCA9IHRoaXMuX2VkaXRvci5sYXlvdXRJbmZvQ29udGVudExlZnQucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KS5yZWFkKHJlYWRlcik7XG5cblx0XHRjb25zdCB3ID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEluZm8pLnJlYWQocmVhZGVyKS50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg7XG5cdFx0Y29uc3Qgd2lkdGggPSB0aGlzLl9lZGl0LnRleHQubGVuZ3RoICogdyArIDU7XG5cblx0XHRjb25zdCBjZW50ZXIgPSBuZXcgUG9pbnQoY29udGVudExlZnQgKyBzdGFydC54ICsgdyAvIDIgLSB0aGlzLl9lZGl0b3Iuc2Nyb2xsTGVmdC5yZWFkKHJlYWRlciksIHN0YXJ0LnkpO1xuXG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBSZWN0LmZyb21MZWZ0VG9wV2lkdGhIZWlnaHQoY2VudGVyLnggLSB3aWR0aCAvIDIsIGNlbnRlci55ICsgbGluZUhlaWdodCArIDUsIHdpZHRoLCBsaW5lSGVpZ2h0KTtcblx0XHRjb25zdCBiYWNrZ3JvdW5kID0gUmVjdC5odWxsKFtSZWN0LmZyb21Qb2ludChjZW50ZXIpLCBtb2RpZmllZF0pLndpdGhNYXJnaW4oNCk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bW9kaWZpZWQsXG5cdFx0XHRjZW50ZXIsXG5cdFx0XHRiYWNrZ3JvdW5kLFxuXHRcdFx0bG93ZXJCYWNrZ3JvdW5kOiBiYWNrZ3JvdW5kLmludGVyc2VjdFZlcnRpY2FsKG5ldyBPZmZzZXRSYW5nZShtb2RpZmllZC50b3AgLSAyLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikpLFxuXHRcdH07XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RpdiA9IG4uZGl2KHtcblx0XHRjbGFzczogJ3dvcmQtaW5zZXJ0Jyxcblx0fSwgW1xuXHRcdGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IGxheW91dCA9IG1hcE91dEZhbHN5KHRoaXMuX2xheW91dCkucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFsYXlvdXQpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RpZmllZEJvcmRlckNvbG9yID0gYXNDc3NWYXJpYWJsZShnZXRNb2RpZmllZEJvcmRlckNvbG9yKHRoaXMuX3RhYkFjdGlvbikucmVhZChyZWFkZXIpKTtcblxuXHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0XHRcdFx0XHRcdC4uLnJlY3RUb1Byb3BzKHJlYWRlciA9PiBsYXlvdXQucmVhZChyZWFkZXIpLmxvd2VyQmFja2dyb3VuZCksXG5cdFx0XHRcdFx0XHRib3JkZXJSYWRpdXM6ICc0cHgnLFxuXHRcdFx0XHRcdFx0YmFja2dyb3VuZDogJ3ZhcigtLXZzY29kZS1lZGl0b3ItYmFja2dyb3VuZCknXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbXSksXG5cdFx0XHRcdG4uZGl2KHtcblx0XHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0XHRcdFx0XHQuLi5yZWN0VG9Qcm9wcyhyZWFkZXIgPT4gbGF5b3V0LnJlYWQocmVhZGVyKS5tb2RpZmllZCksXG5cdFx0XHRcdFx0XHRib3JkZXJSYWRpdXM6ICc0cHgnLFxuXHRcdFx0XHRcdFx0cGFkZGluZzogJzBweCcsXG5cdFx0XHRcdFx0XHR0ZXh0QWxpZ246ICdjZW50ZXInLFxuXHRcdFx0XHRcdFx0YmFja2dyb3VuZDogJ3ZhcigtLXZzY29kZS1pbmxpbmVFZGl0LW1vZGlmaWVkQ2hhbmdlZFRleHRCYWNrZ3JvdW5kKScsXG5cdFx0XHRcdFx0XHRmb250RmFtaWx5OiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250RmFtaWx5KSxcblx0XHRcdFx0XHRcdGZvbnRTaXplOiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250U2l6ZSksXG5cdFx0XHRcdFx0XHRmb250V2VpZ2h0OiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250V2VpZ2h0KSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIFtcblx0XHRcdFx0XHR0aGlzLl9lZGl0LnRleHQsXG5cdFx0XHRcdF0pLFxuXHRcdFx0XHRuLmRpdih7XG5cdFx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0XHRcdFx0Li4ucmVjdFRvUHJvcHMocmVhZGVyID0+IGxheW91dC5yZWFkKHJlYWRlcikuYmFja2dyb3VuZCksXG5cdFx0XHRcdFx0XHRib3JkZXJSYWRpdXM6ICc0cHgnLFxuXHRcdFx0XHRcdFx0Ym9yZGVyOiBgMXB4IHNvbGlkICR7bW9kaWZpZWRCb3JkZXJDb2xvcn1gLFxuXHRcdFx0XHRcdFx0Ly9iYWNrZ3JvdW5kOiAncmdiYSgxMjIsIDEyMiwgMTIyLCAwLjEyKScsIGxvb2tzIGJldHRlclxuXHRcdFx0XHRcdFx0YmFja2dyb3VuZDogJ3ZhcigtLXZzY29kZS1pbmxpbmVFZGl0LXdvcmRSZXBsYWNlbWVudFZpZXctYmFja2dyb3VuZCknLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgW10pLFxuXHRcdFx0XHRuLnN2Zyh7XG5cdFx0XHRcdFx0dmlld0JveDogJzAgMCAxMiAxOCcsXG5cdFx0XHRcdFx0d2lkdGg6IDEyLFxuXHRcdFx0XHRcdGhlaWdodDogMTgsXG5cdFx0XHRcdFx0ZmlsbDogJ25vbmUnLFxuXHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0XHRcdFx0XHRcdGxlZnQ6IGRlcml2ZWQocmVhZGVyID0+IGxheW91dC5yZWFkKHJlYWRlcikuY2VudGVyLnggLSA5KSxcblx0XHRcdFx0XHRcdHRvcDogZGVyaXZlZChyZWFkZXIgPT4gbGF5b3V0LnJlYWQocmVhZGVyKS5jZW50ZXIueSArIDQpLFxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtOiAnc2NhbGUoMS40LCAxLjQpJyxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIFtcblx0XHRcdFx0XHRuLnN2Z0VsZW0oJ3BhdGgnLCB7XG5cdFx0XHRcdFx0XHRkOiAnTTUuMDY0NDUgMEg3LjM1NzU5QzcuMzU3NTkgMCA3LjM1NzU5IDguNDcwNTkgNy4zNTc1OSAxMS4xMTc2QzcuMzU3NTkgMTMuNzY0NyA5LjQ1NTIgMTggMTMuNDY3NCAxOEMxNy40Nzk1IDE4IC0yLjU4NDQ1IDE4IDAuMjgxMzczIDE4QzMuMTQ3MTkgMTggNS4wNjQ3NyAxNC4yOTQxIDUuMDY0NzcgMTEuMTE3NkM1LjA2NDc3IDcuOTQxMTggNS4wNjQ0NSAwIDUuMDY0NDUgMFonLFxuXHRcdFx0XHRcdFx0ZmlsbDogJ3ZhcigtLXZzY29kZS1pbmxpbmVFZGl0LW1vZGlmaWVkQ2hhbmdlZFRleHRCYWNrZ3JvdW5kKScsXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XSlcblx0XHRcdF07XG5cdFx0fSlcblx0XSkua2VlcFVwZGF0ZWQodGhpcy5fc3RvcmUpO1xuXG5cdHJlYWRvbmx5IGlzSG92ZXJlZCA9IGNvbnN0T2JzZXJ2YWJsZShmYWxzZSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBPYnNlcnZhYmxlQ29kZUVkaXRvcixcblx0XHQvKiogTXVzdCBiZSBzaW5nbGUtbGluZSBpbiBib3RoIHNpZGVzICovXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdDogU2luZ2xlVGV4dEVkaXQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGFiQWN0aW9uOiBJT2JzZXJ2YWJsZTxJbmxpbmVFZGl0VGFiQWN0aW9uPlxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLmNyZWF0ZU92ZXJsYXlXaWRnZXQoe1xuXHRcdFx0ZG9tTm9kZTogdGhpcy5fZGl2LmVsZW1lbnQsXG5cdFx0XHRtaW5Db250ZW50V2lkdGhJblB4OiBjb25zdE9ic2VydmFibGUoMCksXG5cdFx0XHRwb3NpdGlvbjogY29uc3RPYnNlcnZhYmxlKHsgcHJlZmVyZW5jZTogeyB0b3A6IDAsIGxlZnQ6IDAgfSB9KSxcblx0XHRcdGFsbG93RWRpdG9yT3ZlcmZsb3c6IGZhbHNlLFxuXHRcdH0pKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxTQUFTO0FBRWxCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQixlQUE0QjtBQUN0RCxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUJBQW1CO0FBRzVCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsYUFBYSxtQkFBbUI7QUFFbEMsTUFBTSxrQ0FBa0MsV0FBdUM7QUFBQSxFQW1HckYsWUFDa0IsU0FFQSxPQUNB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
