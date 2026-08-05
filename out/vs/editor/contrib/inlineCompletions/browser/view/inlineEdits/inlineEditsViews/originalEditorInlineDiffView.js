import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { autorunWithStore, derived, observableFromEvent } from "../../../../../../../base/common/observable.js";
import { MouseTargetType } from "../../../../../../browser/editorBrowser.js";
import { observableCodeEditor } from "../../../../../../browser/observableCodeEditor.js";
import { rangeIsSingleLine } from "../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/diffEditorViewZones.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { Range } from "../../../../../../common/core/range.js";
import { EndOfLinePreference, InjectedTextCursorStops } from "../../../../../../common/model.js";
import { ModelDecorationOptions } from "../../../../../../common/model/textModel.js";
import { classNames } from "../utils/utils.js";
class OriginalEditorInlineDiffView extends Disposable {
  constructor(_originalEditor, _state, _modifiedTextModel) {
    super();
    this._originalEditor = _originalEditor;
    this._state = _state;
    this._modifiedTextModel = _modifiedTextModel;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this.isHovered = observableCodeEditor(this._originalEditor).isTargetHovered(
      (p) => p.target.type === MouseTargetType.CONTENT_TEXT && p.target.detail.injectedText?.options.attachedData instanceof InlineEditAttachedData && p.target.detail.injectedText.options.attachedData.owner === this,
      this._store
    );
    this._tokenizationFinished = modelTokenizationFinished(this._modifiedTextModel);
    this._decorations = derived(this, (reader) => {
      const diff = this._state.read(reader);
      if (!diff) {
        return void 0;
      }
      const modified = diff.modifiedText;
      const showInline = diff.mode === "insertionInline";
      const hasOneInnerChange = diff.diff.length === 1 && diff.diff[0].innerChanges?.length === 1;
      const showEmptyDecorations = true;
      const originalDecorations = [];
      const modifiedDecorations = [];
      const diffLineAddDecorationBackground = ModelDecorationOptions.register({
        className: "inlineCompletions-line-insert",
        description: "line-insert",
        isWholeLine: true,
        marginClassName: "gutter-insert"
      });
      const diffLineDeleteDecorationBackground = ModelDecorationOptions.register({
        className: "inlineCompletions-line-delete",
        description: "line-delete",
        isWholeLine: true,
        marginClassName: "gutter-delete"
      });
      const diffWholeLineDeleteDecoration = ModelDecorationOptions.register({
        className: "inlineCompletions-char-delete",
        description: "char-delete",
        isWholeLine: false
      });
      const diffWholeLineAddDecoration = ModelDecorationOptions.register({
        className: "inlineCompletions-char-insert",
        description: "char-insert",
        isWholeLine: true
      });
      const diffAddDecoration = ModelDecorationOptions.register({
        className: "inlineCompletions-char-insert",
        description: "char-insert",
        shouldFillLineOnLineBreak: true
      });
      const diffAddDecorationEmpty = ModelDecorationOptions.register({
        className: "inlineCompletions-char-insert diff-range-empty",
        description: "char-insert diff-range-empty"
      });
      for (const m of diff.diff) {
        const showFullLineDecorations = diff.mode !== "sideBySide" && diff.mode !== "deletion" && diff.mode !== "insertionInline";
        if (showFullLineDecorations) {
          if (!m.original.isEmpty) {
            originalDecorations.push({
              range: m.original.toInclusiveRange(),
              options: diffLineDeleteDecorationBackground
            });
          }
          if (!m.modified.isEmpty) {
            modifiedDecorations.push({
              range: m.modified.toInclusiveRange(),
              options: diffLineAddDecorationBackground
            });
          }
        }
        if (m.modified.isEmpty || m.original.isEmpty) {
          if (!m.original.isEmpty) {
            originalDecorations.push({ range: m.original.toInclusiveRange(), options: diffWholeLineDeleteDecoration });
          }
          if (!m.modified.isEmpty) {
            modifiedDecorations.push({ range: m.modified.toInclusiveRange(), options: diffWholeLineAddDecoration });
          }
        } else {
          const useInlineDiff = showInline && allowsTrueInlineDiffRendering(m);
          for (const i2 of m.innerChanges || []) {
            if (m.original.contains(i2.originalRange.startLineNumber)) {
              const replacedText = this._originalEditor.getModel()?.getValueInRange(i2.originalRange, EndOfLinePreference.LF);
              originalDecorations.push({
                range: i2.originalRange,
                options: {
                  description: "char-delete",
                  shouldFillLineOnLineBreak: false,
                  className: classNames(
                    "inlineCompletions-char-delete",
                    i2.originalRange.isSingleLine() && diff.mode === "insertionInline" && "single-line-inline",
                    i2.originalRange.isEmpty() && "empty",
                    (i2.originalRange.isEmpty() && hasOneInnerChange || diff.mode === "deletion" && replacedText === "\n") && showEmptyDecorations && !useInlineDiff && "diff-range-empty"
                  ),
                  inlineClassName: useInlineDiff ? classNames("strike-through", "inlineCompletions") : null,
                  zIndex: 1
                }
              });
            }
            if (m.modified.contains(i2.modifiedRange.startLineNumber)) {
              modifiedDecorations.push({
                range: i2.modifiedRange,
                options: i2.modifiedRange.isEmpty() && showEmptyDecorations && !useInlineDiff && hasOneInnerChange ? diffAddDecorationEmpty : diffAddDecoration
              });
            }
            if (useInlineDiff) {
              const insertedText = modified.getValueOfRange(i2.modifiedRange);
              const textSegments = insertedText.length > 3 ? [
                { text: insertedText.slice(0, 1), extraClasses: ["start"], offsetRange: new OffsetRange(i2.modifiedRange.startColumn - 1, i2.modifiedRange.startColumn) },
                { text: insertedText.slice(1, -1), extraClasses: [], offsetRange: new OffsetRange(i2.modifiedRange.startColumn, i2.modifiedRange.endColumn - 2) },
                { text: insertedText.slice(-1), extraClasses: ["end"], offsetRange: new OffsetRange(i2.modifiedRange.endColumn - 2, i2.modifiedRange.endColumn - 1) }
              ] : [
                { text: insertedText, extraClasses: ["start", "end"], offsetRange: new OffsetRange(i2.modifiedRange.startColumn - 1, i2.modifiedRange.endColumn) }
              ];
              this._tokenizationFinished.read(reader);
              const lineTokens = this._modifiedTextModel.tokenization.getLineTokens(i2.modifiedRange.startLineNumber);
              for (const { text, extraClasses, offsetRange } of textSegments) {
                originalDecorations.push({
                  range: Range.fromPositions(i2.originalRange.getEndPosition()),
                  options: {
                    description: "inserted-text",
                    before: {
                      tokens: lineTokens.getTokensInRange(offsetRange),
                      content: text,
                      inlineClassName: classNames(
                        "inlineCompletions-char-insert",
                        i2.modifiedRange.isSingleLine() && diff.mode === "insertionInline" && "single-line-inline",
                        ...extraClasses
                        // include extraClasses for additional styling if provided
                      ),
                      cursorStops: InjectedTextCursorStops.None,
                      attachedData: new InlineEditAttachedData(this)
                    },
                    zIndex: 2,
                    showIfCollapsed: true
                  }
                });
              }
            }
          }
        }
      }
      return { originalDecorations, modifiedDecorations };
    });
    this._register(observableCodeEditor(this._originalEditor).setDecorations(this._decorations.map((d) => d?.originalDecorations ?? [])));
    const modifiedCodeEditor = this._state.map((s) => s?.modifiedCodeEditor);
    this._register(autorunWithStore((reader, store) => {
      const e = modifiedCodeEditor.read(reader);
      if (e) {
        store.add(observableCodeEditor(e).setDecorations(this._decorations.map((d) => d?.modifiedDecorations ?? [])));
      }
    }));
    this._register(this._originalEditor.onMouseUp((e) => {
      if (e.target.type !== MouseTargetType.CONTENT_TEXT) {
        return;
      }
      const a = e.target.detail.injectedText?.options.attachedData;
      if (a instanceof InlineEditAttachedData && a.owner === this) {
        this._onDidClick.fire(e.event);
      }
    }));
  }
  static supportsInlineDiffRendering(mapping) {
    return allowsTrueInlineDiffRendering(mapping);
  }
}
class InlineEditAttachedData {
  constructor(owner) {
    this.owner = owner;
  }
}
function allowsTrueInlineDiffRendering(mapping) {
  if (!mapping.innerChanges) {
    return false;
  }
  return mapping.innerChanges.every((c) => rangeIsSingleLine(c.modifiedRange) && rangeIsSingleLine(c.originalRange));
}
let i = 0;
function modelTokenizationFinished(model) {
  return observableFromEvent(model.onDidChangeTokens, () => i++);
}
export {
  OriginalEditorInlineDiffView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9vcmlnaW5hbEVkaXRvcklubGluZURpZmZWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSU1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuV2l0aFN0b3JlLCBkZXJpdmVkLCBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIE1vdXNlVGFyZ2V0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvb2JzZXJ2YWJsZUNvZGVFZGl0b3IuanMnO1xuaW1wb3J0IHsgcmFuZ2VJc1NpbmdsZUxpbmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2NvbXBvbmVudHMvZGlmZkVkaXRvclZpZXdab25lcy9kaWZmRWRpdG9yVmlld1pvbmVzLmpzJztcbmltcG9ydCB7IE9mZnNldFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0UmFuZ2UuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS90ZXh0RWRpdC5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9jb21tb24vZGlmZi9yYW5nZU1hcHBpbmcuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lUHJlZmVyZW5jZSwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJbmplY3RlZFRleHRDdXJzb3JTdG9wcywgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSW5saW5lRWRpdHNWaWV3IH0gZnJvbSAnLi4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IGNsYXNzTmFtZXMgfSBmcm9tICcuLi91dGlscy91dGlscy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9yaWdpbmFsRWRpdG9ySW5saW5lRGlmZlZpZXdTdGF0ZSB7XG5cdGRpZmY6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdO1xuXHRtb2RpZmllZFRleHQ6IEFic3RyYWN0VGV4dDtcblx0bW9kZTogJ2luc2VydGlvbklubGluZScgfCAnc2lkZUJ5U2lkZScgfCAnZGVsZXRpb24nO1xuXG5cdG1vZGlmaWVkQ29kZUVkaXRvcjogSUNvZGVFZGl0b3I7XG59XG5cbmV4cG9ydCBjbGFzcyBPcmlnaW5hbEVkaXRvcklubGluZURpZmZWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElJbmxpbmVFZGl0c1ZpZXcge1xuXHRwdWJsaWMgc3RhdGljIHN1cHBvcnRzSW5saW5lRGlmZlJlbmRlcmluZyhtYXBwaW5nOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gYWxsb3dzVHJ1ZUlubGluZURpZmZSZW5kZXJpbmcobWFwcGluZyk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENsaWNrID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vdXNlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsaWNrID0gdGhpcy5fb25EaWRDbGljay5ldmVudDtcblxuXHRyZWFkb25seSBpc0hvdmVyZWQgPSBvYnNlcnZhYmxlQ29kZUVkaXRvcih0aGlzLl9vcmlnaW5hbEVkaXRvcikuaXNUYXJnZXRIb3ZlcmVkKFxuXHRcdHAgPT4gcC50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVEVYVCAmJlxuXHRcdFx0cC50YXJnZXQuZGV0YWlsLmluamVjdGVkVGV4dD8ub3B0aW9ucy5hdHRhY2hlZERhdGEgaW5zdGFuY2VvZiBJbmxpbmVFZGl0QXR0YWNoZWREYXRhICYmXG5cdFx0XHRwLnRhcmdldC5kZXRhaWwuaW5qZWN0ZWRUZXh0Lm9wdGlvbnMuYXR0YWNoZWREYXRhLm93bmVyID09PSB0aGlzLFxuXHRcdHRoaXMuX3N0b3JlXG5cdCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW5pemF0aW9uRmluaXNoZWQgPSBtb2RlbFRva2VuaXphdGlvbkZpbmlzaGVkKHRoaXMuX21vZGlmaWVkVGV4dE1vZGVsKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbEVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc3RhdGU6IElPYnNlcnZhYmxlPElPcmlnaW5hbEVkaXRvcklubGluZURpZmZWaWV3U3RhdGUgfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGlmaWVkVGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIob2JzZXJ2YWJsZUNvZGVFZGl0b3IodGhpcy5fb3JpZ2luYWxFZGl0b3IpLnNldERlY29yYXRpb25zKHRoaXMuX2RlY29yYXRpb25zLm1hcChkID0+IGQ/Lm9yaWdpbmFsRGVjb3JhdGlvbnMgPz8gW10pKSk7XG5cblx0XHRjb25zdCBtb2RpZmllZENvZGVFZGl0b3IgPSB0aGlzLl9zdGF0ZS5tYXAocyA9PiBzPy5tb2RpZmllZENvZGVFZGl0b3IpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdGNvbnN0IGUgPSBtb2RpZmllZENvZGVFZGl0b3IucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGUpIHtcblx0XHRcdFx0c3RvcmUuYWRkKG9ic2VydmFibGVDb2RlRWRpdG9yKGUpLnNldERlY29yYXRpb25zKHRoaXMuX2RlY29yYXRpb25zLm1hcChkID0+IGQ/Lm1vZGlmaWVkRGVjb3JhdGlvbnMgPz8gW10pKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb3JpZ2luYWxFZGl0b3Iub25Nb3VzZVVwKGUgPT4ge1xuXHRcdFx0aWYgKGUudGFyZ2V0LnR5cGUgIT09IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1RFWFQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYSA9IGUudGFyZ2V0LmRldGFpbC5pbmplY3RlZFRleHQ/Lm9wdGlvbnMuYXR0YWNoZWREYXRhO1xuXHRcdFx0aWYgKGEgaW5zdGFuY2VvZiBJbmxpbmVFZGl0QXR0YWNoZWREYXRhICYmIGEub3duZXIgPT09IHRoaXMpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDbGljay5maXJlKGUuZXZlbnQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlY29yYXRpb25zID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGRpZmYgPSB0aGlzLl9zdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFkaWZmKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuXHRcdGNvbnN0IG1vZGlmaWVkID0gZGlmZi5tb2RpZmllZFRleHQ7XG5cdFx0Y29uc3Qgc2hvd0lubGluZSA9IGRpZmYubW9kZSA9PT0gJ2luc2VydGlvbklubGluZSc7XG5cdFx0Y29uc3QgaGFzT25lSW5uZXJDaGFuZ2UgPSBkaWZmLmRpZmYubGVuZ3RoID09PSAxICYmIGRpZmYuZGlmZlswXS5pbm5lckNoYW5nZXM/Lmxlbmd0aCA9PT0gMTtcblxuXHRcdGNvbnN0IHNob3dFbXB0eURlY29yYXRpb25zID0gdHJ1ZTtcblxuXHRcdGNvbnN0IG9yaWdpbmFsRGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0Y29uc3QgbW9kaWZpZWREZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblxuXHRcdGNvbnN0IGRpZmZMaW5lQWRkRGVjb3JhdGlvbkJhY2tncm91bmQgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRcdGNsYXNzTmFtZTogJ2lubGluZUNvbXBsZXRpb25zLWxpbmUtaW5zZXJ0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnbGluZS1pbnNlcnQnLFxuXHRcdFx0aXNXaG9sZUxpbmU6IHRydWUsXG5cdFx0XHRtYXJnaW5DbGFzc05hbWU6ICdndXR0ZXItaW5zZXJ0Jyxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpZmZMaW5lRGVsZXRlRGVjb3JhdGlvbkJhY2tncm91bmQgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRcdGNsYXNzTmFtZTogJ2lubGluZUNvbXBsZXRpb25zLWxpbmUtZGVsZXRlJyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnbGluZS1kZWxldGUnLFxuXHRcdFx0aXNXaG9sZUxpbmU6IHRydWUsXG5cdFx0XHRtYXJnaW5DbGFzc05hbWU6ICdndXR0ZXItZGVsZXRlJyxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpZmZXaG9sZUxpbmVEZWxldGVEZWNvcmF0aW9uID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0XHRjbGFzc05hbWU6ICdpbmxpbmVDb21wbGV0aW9ucy1jaGFyLWRlbGV0ZScsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ2NoYXItZGVsZXRlJyxcblx0XHRcdGlzV2hvbGVMaW5lOiBmYWxzZSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpZmZXaG9sZUxpbmVBZGREZWNvcmF0aW9uID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0XHRjbGFzc05hbWU6ICdpbmxpbmVDb21wbGV0aW9ucy1jaGFyLWluc2VydCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ2NoYXItaW5zZXJ0Jyxcblx0XHRcdGlzV2hvbGVMaW5lOiB0cnVlLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZGlmZkFkZERlY29yYXRpb24gPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRcdGNsYXNzTmFtZTogJ2lubGluZUNvbXBsZXRpb25zLWNoYXItaW5zZXJ0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnY2hhci1pbnNlcnQnLFxuXHRcdFx0c2hvdWxkRmlsbExpbmVPbkxpbmVCcmVhazogdHJ1ZSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpZmZBZGREZWNvcmF0aW9uRW1wdHkgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRcdGNsYXNzTmFtZTogJ2lubGluZUNvbXBsZXRpb25zLWNoYXItaW5zZXJ0IGRpZmYtcmFuZ2UtZW1wdHknLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdjaGFyLWluc2VydCBkaWZmLXJhbmdlLWVtcHR5Jyxcblx0XHR9KTtcblxuXHRcdGZvciAoY29uc3QgbSBvZiBkaWZmLmRpZmYpIHtcblx0XHRcdGNvbnN0IHNob3dGdWxsTGluZURlY29yYXRpb25zID0gZGlmZi5tb2RlICE9PSAnc2lkZUJ5U2lkZScgJiYgZGlmZi5tb2RlICE9PSAnZGVsZXRpb24nICYmIGRpZmYubW9kZSAhPT0gJ2luc2VydGlvbklubGluZSc7XG5cdFx0XHRpZiAoc2hvd0Z1bGxMaW5lRGVjb3JhdGlvbnMpIHtcblx0XHRcdFx0aWYgKCFtLm9yaWdpbmFsLmlzRW1wdHkpIHtcblx0XHRcdFx0XHRvcmlnaW5hbERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IG0ub3JpZ2luYWwudG9JbmNsdXNpdmVSYW5nZSgpISxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IGRpZmZMaW5lRGVsZXRlRGVjb3JhdGlvbkJhY2tncm91bmQsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFtLm1vZGlmaWVkLmlzRW1wdHkpIHtcblx0XHRcdFx0XHRtb2RpZmllZERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IG0ubW9kaWZpZWQudG9JbmNsdXNpdmVSYW5nZSgpISxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IGRpZmZMaW5lQWRkRGVjb3JhdGlvbkJhY2tncm91bmQsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG0ubW9kaWZpZWQuaXNFbXB0eSB8fCBtLm9yaWdpbmFsLmlzRW1wdHkpIHtcblx0XHRcdFx0aWYgKCFtLm9yaWdpbmFsLmlzRW1wdHkpIHtcblx0XHRcdFx0XHRvcmlnaW5hbERlY29yYXRpb25zLnB1c2goeyByYW5nZTogbS5vcmlnaW5hbC50b0luY2x1c2l2ZVJhbmdlKCkhLCBvcHRpb25zOiBkaWZmV2hvbGVMaW5lRGVsZXRlRGVjb3JhdGlvbiB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIW0ubW9kaWZpZWQuaXNFbXB0eSkge1xuXHRcdFx0XHRcdG1vZGlmaWVkRGVjb3JhdGlvbnMucHVzaCh7IHJhbmdlOiBtLm1vZGlmaWVkLnRvSW5jbHVzaXZlUmFuZ2UoKSEsIG9wdGlvbnM6IGRpZmZXaG9sZUxpbmVBZGREZWNvcmF0aW9uIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB1c2VJbmxpbmVEaWZmID0gc2hvd0lubGluZSAmJiBhbGxvd3NUcnVlSW5saW5lRGlmZlJlbmRlcmluZyhtKTtcblx0XHRcdFx0Zm9yIChjb25zdCBpIG9mIG0uaW5uZXJDaGFuZ2VzIHx8IFtdKSB7XG5cdFx0XHRcdFx0Ly8gRG9uJ3Qgc2hvdyBlbXB0eSBtYXJrZXJzIG91dHNpZGUgdGhlIGxpbmUgcmFuZ2Vcblx0XHRcdFx0XHRpZiAobS5vcmlnaW5hbC5jb250YWlucyhpLm9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVwbGFjZWRUZXh0ID0gdGhpcy5fb3JpZ2luYWxFZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0VmFsdWVJblJhbmdlKGkub3JpZ2luYWxSYW5nZSwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRik7XG5cdFx0XHRcdFx0XHRvcmlnaW5hbERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRyYW5nZTogaS5vcmlnaW5hbFJhbmdlLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdjaGFyLWRlbGV0ZScsXG5cdFx0XHRcdFx0XHRcdFx0c2hvdWxkRmlsbExpbmVPbkxpbmVCcmVhazogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdFx0Y2xhc3NOYW1lOiBjbGFzc05hbWVzKFxuXHRcdFx0XHRcdFx0XHRcdFx0J2lubGluZUNvbXBsZXRpb25zLWNoYXItZGVsZXRlJyxcblx0XHRcdFx0XHRcdFx0XHRcdGkub3JpZ2luYWxSYW5nZS5pc1NpbmdsZUxpbmUoKSAmJiBkaWZmLm1vZGUgPT09ICdpbnNlcnRpb25JbmxpbmUnICYmICdzaW5nbGUtbGluZS1pbmxpbmUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0aS5vcmlnaW5hbFJhbmdlLmlzRW1wdHkoKSAmJiAnZW1wdHknLFxuXHRcdFx0XHRcdFx0XHRcdFx0KChpLm9yaWdpbmFsUmFuZ2UuaXNFbXB0eSgpICYmIGhhc09uZUlubmVyQ2hhbmdlIHx8IGRpZmYubW9kZSA9PT0gJ2RlbGV0aW9uJyAmJiByZXBsYWNlZFRleHQgPT09ICdcXG4nKSAmJiBzaG93RW1wdHlEZWNvcmF0aW9ucyAmJiAhdXNlSW5saW5lRGlmZikgJiYgJ2RpZmYtcmFuZ2UtZW1wdHknXG5cdFx0XHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdFx0XHRpbmxpbmVDbGFzc05hbWU6IHVzZUlubGluZURpZmYgPyBjbGFzc05hbWVzKCdzdHJpa2UtdGhyb3VnaCcsICdpbmxpbmVDb21wbGV0aW9ucycpIDogbnVsbCxcblx0XHRcdFx0XHRcdFx0XHR6SW5kZXg6IDFcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChtLm1vZGlmaWVkLmNvbnRhaW5zKGkubW9kaWZpZWRSYW5nZS5zdGFydExpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdFx0XHRtb2RpZmllZERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRyYW5nZTogaS5tb2RpZmllZFJhbmdlLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiAoaS5tb2RpZmllZFJhbmdlLmlzRW1wdHkoKSAmJiBzaG93RW1wdHlEZWNvcmF0aW9ucyAmJiAhdXNlSW5saW5lRGlmZiAmJiBoYXNPbmVJbm5lckNoYW5nZSlcblx0XHRcdFx0XHRcdFx0XHQ/IGRpZmZBZGREZWNvcmF0aW9uRW1wdHlcblx0XHRcdFx0XHRcdFx0XHQ6IGRpZmZBZGREZWNvcmF0aW9uXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHVzZUlubGluZURpZmYpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGluc2VydGVkVGV4dCA9IG1vZGlmaWVkLmdldFZhbHVlT2ZSYW5nZShpLm1vZGlmaWVkUmFuZ2UpO1xuXHRcdFx0XHRcdFx0Ly8gd2hlbiB0aGUgaW5qZWN0ZWQgdGV4dCBiZWNvbWVzIGxvbmcsIHRoZSBlZGl0b3Igd2lsbCBzcGxpdCBpdCBpbnRvIG11bHRpcGxlIHNwYW5zXG5cdFx0XHRcdFx0XHQvLyB0byBiZSBhYmxlIHRvIGdldCB0aGUgYm9yZGVyIGFyb3VuZCB0aGUgc3RhcnQgYW5kIGVuZCBvZiB0aGUgdGV4dCwgd2UgbmVlZCB0byBzcGxpdCBpdCBpbnRvIG11bHRpcGxlIHNlZ21lbnRzXG5cdFx0XHRcdFx0XHRjb25zdCB0ZXh0U2VnbWVudHMgPSBpbnNlcnRlZFRleHQubGVuZ3RoID4gMyA/XG5cdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHR7IHRleHQ6IGluc2VydGVkVGV4dC5zbGljZSgwLCAxKSwgZXh0cmFDbGFzc2VzOiBbJ3N0YXJ0J10sIG9mZnNldFJhbmdlOiBuZXcgT2Zmc2V0UmFuZ2UoaS5tb2RpZmllZFJhbmdlLnN0YXJ0Q29sdW1uIC0gMSwgaS5tb2RpZmllZFJhbmdlLnN0YXJ0Q29sdW1uKSB9LFxuXHRcdFx0XHRcdFx0XHRcdHsgdGV4dDogaW5zZXJ0ZWRUZXh0LnNsaWNlKDEsIC0xKSwgZXh0cmFDbGFzc2VzOiBbXSwgb2Zmc2V0UmFuZ2U6IG5ldyBPZmZzZXRSYW5nZShpLm1vZGlmaWVkUmFuZ2Uuc3RhcnRDb2x1bW4sIGkubW9kaWZpZWRSYW5nZS5lbmRDb2x1bW4gLSAyKSB9LFxuXHRcdFx0XHRcdFx0XHRcdHsgdGV4dDogaW5zZXJ0ZWRUZXh0LnNsaWNlKC0xKSwgZXh0cmFDbGFzc2VzOiBbJ2VuZCddLCBvZmZzZXRSYW5nZTogbmV3IE9mZnNldFJhbmdlKGkubW9kaWZpZWRSYW5nZS5lbmRDb2x1bW4gLSAyLCBpLm1vZGlmaWVkUmFuZ2UuZW5kQ29sdW1uIC0gMSkgfVxuXHRcdFx0XHRcdFx0XHRdIDpcblx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdHsgdGV4dDogaW5zZXJ0ZWRUZXh0LCBleHRyYUNsYXNzZXM6IFsnc3RhcnQnLCAnZW5kJ10sIG9mZnNldFJhbmdlOiBuZXcgT2Zmc2V0UmFuZ2UoaS5tb2RpZmllZFJhbmdlLnN0YXJ0Q29sdW1uIC0gMSwgaS5tb2RpZmllZFJhbmdlLmVuZENvbHVtbikgfVxuXHRcdFx0XHRcdFx0XHRdO1xuXG5cdFx0XHRcdFx0XHQvLyBUb2tlbml6YXRpb25cblx0XHRcdFx0XHRcdHRoaXMuX3Rva2VuaXphdGlvbkZpbmlzaGVkLnJlYWQocmVhZGVyKTsgLy8gcmVjb25zaWRlciB3aGVuIHRva2VuaXphdGlvbiBpcyBmaW5pc2hlZFxuXHRcdFx0XHRcdFx0Y29uc3QgbGluZVRva2VucyA9IHRoaXMuX21vZGlmaWVkVGV4dE1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKGkubW9kaWZpZWRSYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHsgdGV4dCwgZXh0cmFDbGFzc2VzLCBvZmZzZXRSYW5nZSB9IG9mIHRleHRTZWdtZW50cykge1xuXHRcdFx0XHRcdFx0XHRvcmlnaW5hbERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKGkub3JpZ2luYWxSYW5nZS5nZXRFbmRQb3NpdGlvbigpKSxcblx0XHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2luc2VydGVkLXRleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0YmVmb3JlOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHRva2VuczogbGluZVRva2Vucy5nZXRUb2tlbnNJblJhbmdlKG9mZnNldFJhbmdlKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudDogdGV4dCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0aW5saW5lQ2xhc3NOYW1lOiBjbGFzc05hbWVzKFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpbmxpbmVDb21wbGV0aW9ucy1jaGFyLWluc2VydCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0aS5tb2RpZmllZFJhbmdlLmlzU2luZ2xlTGluZSgpICYmIGRpZmYubW9kZSA9PT0gJ2luc2VydGlvbklubGluZScgJiYgJ3NpbmdsZS1saW5lLWlubGluZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Li4uZXh0cmFDbGFzc2VzIC8vIGluY2x1ZGUgZXh0cmFDbGFzc2VzIGZvciBhZGRpdGlvbmFsIHN0eWxpbmcgaWYgcHJvdmlkZWRcblx0XHRcdFx0XHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y3Vyc29yU3RvcHM6IEluamVjdGVkVGV4dEN1cnNvclN0b3BzLk5vbmUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGF0dGFjaGVkRGF0YTogbmV3IElubGluZUVkaXRBdHRhY2hlZERhdGEodGhpcyksXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0ekluZGV4OiAyLFxuXHRcdFx0XHRcdFx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgb3JpZ2luYWxEZWNvcmF0aW9ucywgbW9kaWZpZWREZWNvcmF0aW9ucyB9O1xuXHR9KTtcbn1cblxuY2xhc3MgSW5saW5lRWRpdEF0dGFjaGVkRGF0YSB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBvd25lcjogT3JpZ2luYWxFZGl0b3JJbmxpbmVEaWZmVmlldykgeyB9XG59XG5cbmZ1bmN0aW9uIGFsbG93c1RydWVJbmxpbmVEaWZmUmVuZGVyaW5nKG1hcHBpbmc6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyk6IGJvb2xlYW4ge1xuXHRpZiAoIW1hcHBpbmcuaW5uZXJDaGFuZ2VzKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiBtYXBwaW5nLmlubmVyQ2hhbmdlcy5ldmVyeShjID0+XG5cdFx0KHJhbmdlSXNTaW5nbGVMaW5lKGMubW9kaWZpZWRSYW5nZSkgJiYgcmFuZ2VJc1NpbmdsZUxpbmUoYy5vcmlnaW5hbFJhbmdlKSkpO1xufVxuXG5sZXQgaSA9IDA7XG5mdW5jdGlvbiBtb2RlbFRva2VuaXphdGlvbkZpbmlzaGVkKG1vZGVsOiBJVGV4dE1vZGVsKTogSU9ic2VydmFibGU8bnVtYmVyPiB7XG5cdHJldHVybiBvYnNlcnZhYmxlRnJvbUV2ZW50KG1vZGVsLm9uRGlkQ2hhbmdlVG9rZW5zLCAoKSA9PiBpKyspO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsa0JBQWtCLFNBQXNCLDJCQUEyQjtBQUM1RSxTQUFzQix1QkFBdUI7QUFDN0MsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxhQUFhO0FBR3RCLFNBQVMscUJBQTRDLCtCQUEyQztBQUNoRyxTQUFTLDhCQUE4QjtBQUV2QyxT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
