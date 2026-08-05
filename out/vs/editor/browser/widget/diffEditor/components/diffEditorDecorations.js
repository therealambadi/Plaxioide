import { Disposable } from "../../../../../base/common/lifecycle.js";
import { derived } from "../../../../../base/common/observable.js";
import { allowsTrueInlineDiffRendering } from "./diffEditorViewZones/diffEditorViewZones.js";
import { MovedBlocksLinesFeature } from "../features/movedBlocksLinesFeature.js";
import { diffAddDecoration, diffAddDecorationEmpty, diffDeleteDecoration, diffDeleteDecorationEmpty, diffLineAddDecorationBackground, diffLineAddDecorationBackgroundWithIndicator, diffLineDeleteDecorationBackground, diffLineDeleteDecorationBackgroundWithIndicator, diffWholeLineAddDecoration, diffWholeLineDeleteDecoration } from "../registrations.contribution.js";
import { applyObservableDecorations } from "../utils.js";
class DiffEditorDecorations extends Disposable {
  constructor(_editors, _diffModel, _options, widget) {
    super();
    this._editors = _editors;
    this._diffModel = _diffModel;
    this._options = _options;
    this._decorations = derived(this, (reader) => {
      const diffModel = this._diffModel.read(reader);
      const diff = diffModel?.diff.read(reader);
      if (!diff) {
        return null;
      }
      const movedTextToCompare = this._diffModel.read(reader).movedTextToCompare.read(reader);
      const renderIndicators = this._options.renderIndicators.read(reader);
      const showEmptyDecorations = this._options.showEmptyDecorations.read(reader);
      const originalDecorations = [];
      const modifiedDecorations = [];
      if (!movedTextToCompare) {
        for (const m of diff.mappings) {
          if (!m.lineRangeMapping.original.isEmpty) {
            originalDecorations.push({ range: m.lineRangeMapping.original.toInclusiveRange(), options: renderIndicators ? diffLineDeleteDecorationBackgroundWithIndicator : diffLineDeleteDecorationBackground });
          }
          if (!m.lineRangeMapping.modified.isEmpty) {
            modifiedDecorations.push({ range: m.lineRangeMapping.modified.toInclusiveRange(), options: renderIndicators ? diffLineAddDecorationBackgroundWithIndicator : diffLineAddDecorationBackground });
          }
          if (m.lineRangeMapping.modified.isEmpty || m.lineRangeMapping.original.isEmpty) {
            if (!m.lineRangeMapping.original.isEmpty) {
              originalDecorations.push({ range: m.lineRangeMapping.original.toInclusiveRange(), options: diffWholeLineDeleteDecoration });
            }
            if (!m.lineRangeMapping.modified.isEmpty) {
              modifiedDecorations.push({ range: m.lineRangeMapping.modified.toInclusiveRange(), options: diffWholeLineAddDecoration });
            }
          } else {
            const useInlineDiff = this._options.useTrueInlineDiffRendering.read(reader) && allowsTrueInlineDiffRendering(m.lineRangeMapping);
            for (const i of m.lineRangeMapping.innerChanges || []) {
              if (m.lineRangeMapping.original.contains(i.originalRange.startLineNumber)) {
                originalDecorations.push({ range: i.originalRange, options: i.originalRange.isEmpty() && showEmptyDecorations ? diffDeleteDecorationEmpty : diffDeleteDecoration });
              }
              if (m.lineRangeMapping.modified.contains(i.modifiedRange.startLineNumber)) {
                modifiedDecorations.push({ range: i.modifiedRange, options: i.modifiedRange.isEmpty() && showEmptyDecorations && !useInlineDiff ? diffAddDecorationEmpty : diffAddDecoration });
              }
              if (useInlineDiff) {
                const deletedText = diffModel.model.original.getValueInRange(i.originalRange);
                modifiedDecorations.push({
                  range: i.modifiedRange,
                  options: {
                    description: "deleted-text",
                    before: {
                      content: deletedText,
                      inlineClassName: "inline-deleted-text"
                    },
                    zIndex: 1e5,
                    showIfCollapsed: true
                  }
                });
              }
            }
          }
        }
      }
      if (movedTextToCompare) {
        for (const m of movedTextToCompare.changes) {
          const fullRangeOriginal = m.original.toInclusiveRange();
          if (fullRangeOriginal) {
            originalDecorations.push({ range: fullRangeOriginal, options: renderIndicators ? diffLineDeleteDecorationBackgroundWithIndicator : diffLineDeleteDecorationBackground });
          }
          const fullRangeModified = m.modified.toInclusiveRange();
          if (fullRangeModified) {
            modifiedDecorations.push({ range: fullRangeModified, options: renderIndicators ? diffLineAddDecorationBackgroundWithIndicator : diffLineAddDecorationBackground });
          }
          for (const i of m.innerChanges || []) {
            originalDecorations.push({ range: i.originalRange, options: diffDeleteDecoration });
            modifiedDecorations.push({ range: i.modifiedRange, options: diffAddDecoration });
          }
        }
      }
      const activeMovedText = this._diffModel.read(reader).activeMovedText.read(reader);
      for (const m of diff.movedTexts) {
        originalDecorations.push({
          range: m.lineRangeMapping.original.toInclusiveRange(),
          options: {
            description: "moved",
            blockClassName: "movedOriginal" + (m === activeMovedText ? " currentMove" : ""),
            blockPadding: [MovedBlocksLinesFeature.movedCodeBlockPadding, 0, MovedBlocksLinesFeature.movedCodeBlockPadding, MovedBlocksLinesFeature.movedCodeBlockPadding]
          }
        });
        modifiedDecorations.push({
          range: m.lineRangeMapping.modified.toInclusiveRange(),
          options: {
            description: "moved",
            blockClassName: "movedModified" + (m === activeMovedText ? " currentMove" : ""),
            blockPadding: [4, 0, 4, 4]
          }
        });
      }
      return { originalDecorations, modifiedDecorations };
    });
    this._register(applyObservableDecorations(this._editors.original, this._decorations.map((d) => d?.originalDecorations || [])));
    this._register(applyObservableDecorations(this._editors.modified, this._decorations.map((d) => d?.modifiedDecorations || [])));
  }
}
export {
  DiffEditorDecorations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2RpZmZFZGl0b3JEZWNvcmF0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIGRlcml2ZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JFZGl0b3JzIH0gZnJvbSAnLi9kaWZmRWRpdG9yRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBhbGxvd3NUcnVlSW5saW5lRGlmZlJlbmRlcmluZyB9IGZyb20gJy4vZGlmZkVkaXRvclZpZXdab25lcy9kaWZmRWRpdG9yVmlld1pvbmVzLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vZGlmZkVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvclZpZXdNb2RlbCB9IGZyb20gJy4uL2RpZmZFZGl0b3JWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcldpZGdldCB9IGZyb20gJy4uL2RpZmZFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgTW92ZWRCbG9ja3NMaW5lc0ZlYXR1cmUgfSBmcm9tICcuLi9mZWF0dXJlcy9tb3ZlZEJsb2Nrc0xpbmVzRmVhdHVyZS5qcyc7XG5pbXBvcnQgeyBkaWZmQWRkRGVjb3JhdGlvbiwgZGlmZkFkZERlY29yYXRpb25FbXB0eSwgZGlmZkRlbGV0ZURlY29yYXRpb24sIGRpZmZEZWxldGVEZWNvcmF0aW9uRW1wdHksIGRpZmZMaW5lQWRkRGVjb3JhdGlvbkJhY2tncm91bmQsIGRpZmZMaW5lQWRkRGVjb3JhdGlvbkJhY2tncm91bmRXaXRoSW5kaWNhdG9yLCBkaWZmTGluZURlbGV0ZURlY29yYXRpb25CYWNrZ3JvdW5kLCBkaWZmTGluZURlbGV0ZURlY29yYXRpb25CYWNrZ3JvdW5kV2l0aEluZGljYXRvciwgZGlmZldob2xlTGluZUFkZERlY29yYXRpb24sIGRpZmZXaG9sZUxpbmVEZWxldGVEZWNvcmF0aW9uIH0gZnJvbSAnLi4vcmVnaXN0cmF0aW9ucy5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgYXBwbHlPYnNlcnZhYmxlRGVjb3JhdGlvbnMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWx0YURlY29yYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuXG5leHBvcnQgY2xhc3MgRGlmZkVkaXRvckRlY29yYXRpb25zIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcnM6IERpZmZFZGl0b3JFZGl0b3JzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZNb2RlbDogSU9ic2VydmFibGU8RGlmZkVkaXRvclZpZXdNb2RlbCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogRGlmZkVkaXRvck9wdGlvbnMsXG5cdFx0d2lkZ2V0OiBEaWZmRWRpdG9yV2lkZ2V0LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXBwbHlPYnNlcnZhYmxlRGVjb3JhdGlvbnModGhpcy5fZWRpdG9ycy5vcmlnaW5hbCwgdGhpcy5fZGVjb3JhdGlvbnMubWFwKGQgPT4gZD8ub3JpZ2luYWxEZWNvcmF0aW9ucyB8fCBbXSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhcHBseU9ic2VydmFibGVEZWNvcmF0aW9ucyh0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLCB0aGlzLl9kZWNvcmF0aW9ucy5tYXAoZCA9PiBkPy5tb2RpZmllZERlY29yYXRpb25zIHx8IFtdKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGVjb3JhdGlvbnMgPSBkZXJpdmVkKHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHRjb25zdCBkaWZmTW9kZWwgPSB0aGlzLl9kaWZmTW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGRpZmYgPSBkaWZmTW9kZWw/LmRpZmYucmVhZChyZWFkZXIpO1xuXHRcdGlmICghZGlmZikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW92ZWRUZXh0VG9Db21wYXJlID0gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKSEubW92ZWRUZXh0VG9Db21wYXJlLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCByZW5kZXJJbmRpY2F0b3JzID0gdGhpcy5fb3B0aW9ucy5yZW5kZXJJbmRpY2F0b3JzLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBzaG93RW1wdHlEZWNvcmF0aW9ucyA9IHRoaXMuX29wdGlvbnMuc2hvd0VtcHR5RGVjb3JhdGlvbnMucmVhZChyZWFkZXIpO1xuXG5cdFx0Y29uc3Qgb3JpZ2luYWxEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRjb25zdCBtb2RpZmllZERlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXHRcdGlmICghbW92ZWRUZXh0VG9Db21wYXJlKSB7XG5cdFx0XHRmb3IgKGNvbnN0IG0gb2YgZGlmZi5tYXBwaW5ncykge1xuXHRcdFx0XHRpZiAoIW0ubGluZVJhbmdlTWFwcGluZy5vcmlnaW5hbC5pc0VtcHR5KSB7XG5cdFx0XHRcdFx0b3JpZ2luYWxEZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IG0ubGluZVJhbmdlTWFwcGluZy5vcmlnaW5hbC50b0luY2x1c2l2ZVJhbmdlKCkhLCBvcHRpb25zOiByZW5kZXJJbmRpY2F0b3JzID8gZGlmZkxpbmVEZWxldGVEZWNvcmF0aW9uQmFja2dyb3VuZFdpdGhJbmRpY2F0b3IgOiBkaWZmTGluZURlbGV0ZURlY29yYXRpb25CYWNrZ3JvdW5kIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghbS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmlzRW1wdHkpIHtcblx0XHRcdFx0XHRtb2RpZmllZERlY29yYXRpb25zLnB1c2goeyByYW5nZTogbS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLnRvSW5jbHVzaXZlUmFuZ2UoKSEsIG9wdGlvbnM6IHJlbmRlckluZGljYXRvcnMgPyBkaWZmTGluZUFkZERlY29yYXRpb25CYWNrZ3JvdW5kV2l0aEluZGljYXRvciA6IGRpZmZMaW5lQWRkRGVjb3JhdGlvbkJhY2tncm91bmQgfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmlzRW1wdHkgfHwgbS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLmlzRW1wdHkpIHtcblx0XHRcdFx0XHRpZiAoIW0ubGluZVJhbmdlTWFwcGluZy5vcmlnaW5hbC5pc0VtcHR5KSB7XG5cdFx0XHRcdFx0XHRvcmlnaW5hbERlY29yYXRpb25zLnB1c2goeyByYW5nZTogbS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLnRvSW5jbHVzaXZlUmFuZ2UoKSEsIG9wdGlvbnM6IGRpZmZXaG9sZUxpbmVEZWxldGVEZWNvcmF0aW9uIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIW0ubGluZVJhbmdlTWFwcGluZy5tb2RpZmllZC5pc0VtcHR5KSB7XG5cdFx0XHRcdFx0XHRtb2RpZmllZERlY29yYXRpb25zLnB1c2goeyByYW5nZTogbS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLnRvSW5jbHVzaXZlUmFuZ2UoKSEsIG9wdGlvbnM6IGRpZmZXaG9sZUxpbmVBZGREZWNvcmF0aW9uIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCB1c2VJbmxpbmVEaWZmID0gdGhpcy5fb3B0aW9ucy51c2VUcnVlSW5saW5lRGlmZlJlbmRlcmluZy5yZWFkKHJlYWRlcikgJiYgYWxsb3dzVHJ1ZUlubGluZURpZmZSZW5kZXJpbmcobS5saW5lUmFuZ2VNYXBwaW5nKTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGkgb2YgbS5saW5lUmFuZ2VNYXBwaW5nLmlubmVyQ2hhbmdlcyB8fCBbXSkge1xuXHRcdFx0XHRcdFx0Ly8gRG9uJ3Qgc2hvdyBlbXB0eSBtYXJrZXJzIG91dHNpZGUgdGhlIGxpbmUgcmFuZ2Vcblx0XHRcdFx0XHRcdGlmIChtLmxpbmVSYW5nZU1hcHBpbmcub3JpZ2luYWwuY29udGFpbnMoaS5vcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlcikpIHtcblx0XHRcdFx0XHRcdFx0b3JpZ2luYWxEZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IGkub3JpZ2luYWxSYW5nZSwgb3B0aW9uczogKGkub3JpZ2luYWxSYW5nZS5pc0VtcHR5KCkgJiYgc2hvd0VtcHR5RGVjb3JhdGlvbnMpID8gZGlmZkRlbGV0ZURlY29yYXRpb25FbXB0eSA6IGRpZmZEZWxldGVEZWNvcmF0aW9uIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKG0ubGluZVJhbmdlTWFwcGluZy5tb2RpZmllZC5jb250YWlucyhpLm1vZGlmaWVkUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSkge1xuXHRcdFx0XHRcdFx0XHRtb2RpZmllZERlY29yYXRpb25zLnB1c2goeyByYW5nZTogaS5tb2RpZmllZFJhbmdlLCBvcHRpb25zOiAoaS5tb2RpZmllZFJhbmdlLmlzRW1wdHkoKSAmJiBzaG93RW1wdHlEZWNvcmF0aW9ucyAmJiAhdXNlSW5saW5lRGlmZikgPyBkaWZmQWRkRGVjb3JhdGlvbkVtcHR5IDogZGlmZkFkZERlY29yYXRpb24gfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAodXNlSW5saW5lRGlmZikge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBkZWxldGVkVGV4dCA9IGRpZmZNb2RlbCEubW9kZWwub3JpZ2luYWwuZ2V0VmFsdWVJblJhbmdlKGkub3JpZ2luYWxSYW5nZSk7XG5cdFx0XHRcdFx0XHRcdG1vZGlmaWVkRGVjb3JhdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0cmFuZ2U6IGkubW9kaWZpZWRSYW5nZSxcblx0XHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2RlbGV0ZWQtdGV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRiZWZvcmU6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudDogZGVsZXRlZFRleHQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlubGluZUNsYXNzTmFtZTogJ2lubGluZS1kZWxldGVkLXRleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdHpJbmRleDogMTAwMDAwLFxuXHRcdFx0XHRcdFx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG1vdmVkVGV4dFRvQ29tcGFyZSkge1xuXHRcdFx0Zm9yIChjb25zdCBtIG9mIG1vdmVkVGV4dFRvQ29tcGFyZS5jaGFuZ2VzKSB7XG5cdFx0XHRcdGNvbnN0IGZ1bGxSYW5nZU9yaWdpbmFsID0gbS5vcmlnaW5hbC50b0luY2x1c2l2ZVJhbmdlKCk7XG5cdFx0XHRcdGlmIChmdWxsUmFuZ2VPcmlnaW5hbCkge1xuXHRcdFx0XHRcdG9yaWdpbmFsRGVjb3JhdGlvbnMucHVzaCh7IHJhbmdlOiBmdWxsUmFuZ2VPcmlnaW5hbCwgb3B0aW9uczogcmVuZGVySW5kaWNhdG9ycyA/IGRpZmZMaW5lRGVsZXRlRGVjb3JhdGlvbkJhY2tncm91bmRXaXRoSW5kaWNhdG9yIDogZGlmZkxpbmVEZWxldGVEZWNvcmF0aW9uQmFja2dyb3VuZCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBmdWxsUmFuZ2VNb2RpZmllZCA9IG0ubW9kaWZpZWQudG9JbmNsdXNpdmVSYW5nZSgpO1xuXHRcdFx0XHRpZiAoZnVsbFJhbmdlTW9kaWZpZWQpIHtcblx0XHRcdFx0XHRtb2RpZmllZERlY29yYXRpb25zLnB1c2goeyByYW5nZTogZnVsbFJhbmdlTW9kaWZpZWQsIG9wdGlvbnM6IHJlbmRlckluZGljYXRvcnMgPyBkaWZmTGluZUFkZERlY29yYXRpb25CYWNrZ3JvdW5kV2l0aEluZGljYXRvciA6IGRpZmZMaW5lQWRkRGVjb3JhdGlvbkJhY2tncm91bmQgfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IGkgb2YgbS5pbm5lckNoYW5nZXMgfHwgW10pIHtcblx0XHRcdFx0XHRvcmlnaW5hbERlY29yYXRpb25zLnB1c2goeyByYW5nZTogaS5vcmlnaW5hbFJhbmdlLCBvcHRpb25zOiBkaWZmRGVsZXRlRGVjb3JhdGlvbiB9KTtcblx0XHRcdFx0XHRtb2RpZmllZERlY29yYXRpb25zLnB1c2goeyByYW5nZTogaS5tb2RpZmllZFJhbmdlLCBvcHRpb25zOiBkaWZmQWRkRGVjb3JhdGlvbiB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBhY3RpdmVNb3ZlZFRleHQgPSB0aGlzLl9kaWZmTW9kZWwucmVhZChyZWFkZXIpIS5hY3RpdmVNb3ZlZFRleHQucmVhZChyZWFkZXIpO1xuXG5cdFx0Zm9yIChjb25zdCBtIG9mIGRpZmYubW92ZWRUZXh0cykge1xuXHRcdFx0b3JpZ2luYWxEZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0cmFuZ2U6IG0ubGluZVJhbmdlTWFwcGluZy5vcmlnaW5hbC50b0luY2x1c2l2ZVJhbmdlKCkhLCBvcHRpb25zOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdtb3ZlZCcsXG5cdFx0XHRcdFx0YmxvY2tDbGFzc05hbWU6ICdtb3ZlZE9yaWdpbmFsJyArIChtID09PSBhY3RpdmVNb3ZlZFRleHQgPyAnIGN1cnJlbnRNb3ZlJyA6ICcnKSxcblx0XHRcdFx0XHRibG9ja1BhZGRpbmc6IFtNb3ZlZEJsb2Nrc0xpbmVzRmVhdHVyZS5tb3ZlZENvZGVCbG9ja1BhZGRpbmcsIDAsIE1vdmVkQmxvY2tzTGluZXNGZWF0dXJlLm1vdmVkQ29kZUJsb2NrUGFkZGluZywgTW92ZWRCbG9ja3NMaW5lc0ZlYXR1cmUubW92ZWRDb2RlQmxvY2tQYWRkaW5nXSxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdG1vZGlmaWVkRGVjb3JhdGlvbnMucHVzaCh7XG5cdFx0XHRcdHJhbmdlOiBtLmxpbmVSYW5nZU1hcHBpbmcubW9kaWZpZWQudG9JbmNsdXNpdmVSYW5nZSgpISwgb3B0aW9uczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnbW92ZWQnLFxuXHRcdFx0XHRcdGJsb2NrQ2xhc3NOYW1lOiAnbW92ZWRNb2RpZmllZCcgKyAobSA9PT0gYWN0aXZlTW92ZWRUZXh0ID8gJyBjdXJyZW50TW92ZScgOiAnJyksXG5cdFx0XHRcdFx0YmxvY2tQYWRkaW5nOiBbNCwgMCwgNCwgNF0sXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IG9yaWdpbmFsRGVj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
