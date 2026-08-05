import { addDisposableListener, h, EventType } from "../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorunWithStore, derived } from "../../../../../base/common/observable.js";
import { LineRange, LineRangeSet } from "../../../../common/core/lineRange.js";
import { Range } from "../../../../common/core/range.js";
import { LineRangeMapping } from "../../../../common/diff/rangeMapping.js";
import { GlyphMarginLane } from "../../../../common/model.js";
import { localize } from "../../../../../nls.js";
const emptyArr = [];
class RevertButtonsFeature extends Disposable {
  constructor(_editors, _diffModel, _options, _widget) {
    super();
    this._editors = _editors;
    this._diffModel = _diffModel;
    this._options = _options;
    this._widget = _widget;
    this._selectedDiffs = derived(this, (reader) => {
      const model = this._diffModel.read(reader);
      const diff = model?.diff.read(reader);
      if (!diff) {
        return emptyArr;
      }
      const selections = this._editors.modifiedSelections.read(reader);
      if (selections.every((s) => s.isEmpty())) {
        return emptyArr;
      }
      const selectedLineNumbers = new LineRangeSet(selections.map((s) => LineRange.fromRangeInclusive(s)));
      const selectedMappings = diff.mappings.filter(
        (m) => m.lineRangeMapping.innerChanges && selectedLineNumbers.intersects(m.lineRangeMapping.modified)
      );
      const result = selectedMappings.map((mapping) => ({
        mapping,
        rangeMappings: mapping.lineRangeMapping.innerChanges.filter(
          (c) => selections.some((s) => Range.areIntersecting(c.modifiedRange, s))
        )
      }));
      if (result.length === 0 || result.every((r) => r.rangeMappings.length === 0)) {
        return emptyArr;
      }
      return result;
    });
    this._register(autorunWithStore((reader, store) => {
      if (!this._options.shouldRenderOldRevertArrows.read(reader)) {
        return;
      }
      const model = this._diffModel.read(reader);
      const diff = model?.diff.read(reader);
      if (!model || !diff) {
        return;
      }
      if (model.movedTextToCompare.read(reader)) {
        return;
      }
      const glyphWidgetsModified = [];
      const selectedDiffs = this._selectedDiffs.read(reader);
      const selectedDiffsSet = new Set(selectedDiffs.map((d) => d.mapping));
      if (selectedDiffs.length > 0) {
        const selections = this._editors.modifiedSelections.read(reader);
        const btn = store.add(new RevertButton(
          selections[selections.length - 1].positionLineNumber,
          this._widget,
          selectedDiffs.flatMap((d) => d.rangeMappings),
          true
        ));
        this._editors.modified.addGlyphMarginWidget(btn);
        glyphWidgetsModified.push(btn);
      }
      for (const m of diff.mappings) {
        if (selectedDiffsSet.has(m)) {
          continue;
        }
        if (!m.lineRangeMapping.modified.isEmpty && m.lineRangeMapping.innerChanges) {
          const btn = store.add(new RevertButton(
            m.lineRangeMapping.modified.startLineNumber,
            this._widget,
            m.lineRangeMapping,
            false
          ));
          this._editors.modified.addGlyphMarginWidget(btn);
          glyphWidgetsModified.push(btn);
        }
      }
      store.add(toDisposable(() => {
        for (const w of glyphWidgetsModified) {
          this._editors.modified.removeGlyphMarginWidget(w);
        }
      }));
    }));
  }
}
const _RevertButton = class _RevertButton extends Disposable {
  constructor(_lineNumber, _widget, _diffs, _revertSelection) {
    super();
    this._lineNumber = _lineNumber;
    this._widget = _widget;
    this._diffs = _diffs;
    this._revertSelection = _revertSelection;
    this._id = `revertButton${_RevertButton.counter++}`;
    this._domNode = h(
      "div.revertButton",
      {
        title: this._revertSelection ? localize("revertSelectedChanges", "Revert Selected Changes") : localize("revertChange", "Revert Change")
      },
      [renderIcon(Codicon.arrowRight)]
    ).root;
    this._register(addDisposableListener(this._domNode, EventType.MOUSE_DOWN, (e) => {
      if (e.button !== 2) {
        e.stopPropagation();
        e.preventDefault();
      }
    }));
    this._register(addDisposableListener(this._domNode, EventType.MOUSE_UP, (e) => {
      e.stopPropagation();
      e.preventDefault();
    }));
    this._register(addDisposableListener(this._domNode, EventType.CLICK, (e) => {
      if (this._diffs instanceof LineRangeMapping) {
        this._widget.revert(this._diffs);
      } else {
        this._widget.revertRangeMappings(this._diffs);
      }
      e.stopPropagation();
      e.preventDefault();
    }));
  }
  getId() {
    return this._id;
  }
  /**
   * Get the dom node of the glyph widget.
   */
  getDomNode() {
    return this._domNode;
  }
  /**
   * Get the placement of the glyph widget.
   */
  getPosition() {
    return {
      lane: GlyphMarginLane.Right,
      range: {
        startColumn: 1,
        startLineNumber: this._lineNumber,
        endColumn: 1,
        endLineNumber: this._lineNumber
      },
      zIndex: 10001
    };
  }
};
_RevertButton.counter = 0;
let RevertButton = _RevertButton;
export {
  RevertButton,
  RevertButtonsFeature
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9mZWF0dXJlcy9yZXZlcnRCdXR0b25zRmVhdHVyZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgaCwgRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIGF1dG9ydW5XaXRoU3RvcmUsIGRlcml2ZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElHbHlwaE1hcmdpbldpZGdldCwgSUdseXBoTWFyZ2luV2lkZ2V0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JFZGl0b3JzIH0gZnJvbSAnLi4vY29tcG9uZW50cy9kaWZmRWRpdG9yRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uL2RpZmZFZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JWaWV3TW9kZWwgfSBmcm9tICcuLi9kaWZmRWRpdG9yVmlld01vZGVsLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi9kaWZmRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSwgTGluZVJhbmdlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlTWFwcGluZywgUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IEdseXBoTWFyZ2luTGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmNvbnN0IGVtcHR5QXJyOiBuZXZlcltdID0gW107XG5cbmV4cG9ydCBjbGFzcyBSZXZlcnRCdXR0b25zRmVhdHVyZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JzOiBEaWZmRWRpdG9yRWRpdG9ycyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmTW9kZWw6IElPYnNlcnZhYmxlPERpZmZFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IERpZmZFZGl0b3JPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3dpZGdldDogRGlmZkVkaXRvcldpZGdldFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bldpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLl9vcHRpb25zLnNob3VsZFJlbmRlck9sZFJldmVydEFycm93cy5yZWFkKHJlYWRlcikpIHsgcmV0dXJuOyB9XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2RpZmZNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBkaWZmID0gbW9kZWw/LmRpZmYucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFtb2RlbCB8fCAhZGlmZikgeyByZXR1cm47IH1cblx0XHRcdGlmIChtb2RlbC5tb3ZlZFRleHRUb0NvbXBhcmUucmVhZChyZWFkZXIpKSB7IHJldHVybjsgfVxuXG5cdFx0XHRjb25zdCBnbHlwaFdpZGdldHNNb2RpZmllZDogSUdseXBoTWFyZ2luV2lkZ2V0W10gPSBbXTtcblxuXHRcdFx0Y29uc3Qgc2VsZWN0ZWREaWZmcyA9IHRoaXMuX3NlbGVjdGVkRGlmZnMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWREaWZmc1NldCA9IG5ldyBTZXQoc2VsZWN0ZWREaWZmcy5tYXAoZCA9PiBkLm1hcHBpbmcpKTtcblxuXHRcdFx0aWYgKHNlbGVjdGVkRGlmZnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHQvLyBUaGUgYnV0dG9uIHRvIHJldmVydCB0aGUgc2VsZWN0aW9uXG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkU2VsZWN0aW9ucy5yZWFkKHJlYWRlcik7XG5cblx0XHRcdFx0Y29uc3QgYnRuID0gc3RvcmUuYWRkKG5ldyBSZXZlcnRCdXR0b24oXG5cdFx0XHRcdFx0c2VsZWN0aW9uc1tzZWxlY3Rpb25zLmxlbmd0aCAtIDFdLnBvc2l0aW9uTGluZU51bWJlcixcblx0XHRcdFx0XHR0aGlzLl93aWRnZXQsXG5cdFx0XHRcdFx0c2VsZWN0ZWREaWZmcy5mbGF0TWFwKGQgPT4gZC5yYW5nZU1hcHBpbmdzKSxcblx0XHRcdFx0XHR0cnVlXG5cdFx0XHRcdCkpO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmFkZEdseXBoTWFyZ2luV2lkZ2V0KGJ0bik7XG5cdFx0XHRcdGdseXBoV2lkZ2V0c01vZGlmaWVkLnB1c2goYnRuKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBtIG9mIGRpZmYubWFwcGluZ3MpIHtcblx0XHRcdFx0aWYgKHNlbGVjdGVkRGlmZnNTZXQuaGFzKG0pKSB7IGNvbnRpbnVlOyB9XG5cdFx0XHRcdGlmICghbS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmlzRW1wdHkgJiYgbS5saW5lUmFuZ2VNYXBwaW5nLmlubmVyQ2hhbmdlcykge1xuXHRcdFx0XHRcdGNvbnN0IGJ0biA9IHN0b3JlLmFkZChuZXcgUmV2ZXJ0QnV0dG9uKFxuXHRcdFx0XHRcdFx0bS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdHRoaXMuX3dpZGdldCxcblx0XHRcdFx0XHRcdG0ubGluZVJhbmdlTWFwcGluZyxcblx0XHRcdFx0XHRcdGZhbHNlXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZC5hZGRHbHlwaE1hcmdpbldpZGdldChidG4pO1xuXHRcdFx0XHRcdGdseXBoV2lkZ2V0c01vZGlmaWVkLnB1c2goYnRuKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCB3IG9mIGdseXBoV2lkZ2V0c01vZGlmaWVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZC5yZW1vdmVHbHlwaE1hcmdpbldpZGdldCh3KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlbGVjdGVkRGlmZnMgPSBkZXJpdmVkKHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHQvKiogQGRlc2NyaXB0aW9uIHNlbGVjdGVkRGlmZnMgKi9cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2RpZmZNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgZGlmZiA9IG1vZGVsPy5kaWZmLnJlYWQocmVhZGVyKTtcblx0XHQvLyBSZXR1cm4gYGVtcHR5QXJyYCBiZWNhdXNlIGl0IGlzIGEgY29uc3RhbnQuIFtdIGlzIGFsd2F5cyBhIG5ldyBhcnJheSBhbmQgd291bGQgdHJpZ2dlciBhIGNoYW5nZS5cblx0XHRpZiAoIWRpZmYpIHsgcmV0dXJuIGVtcHR5QXJyOyB9XG5cblx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9ycy5tb2RpZmllZFNlbGVjdGlvbnMucmVhZChyZWFkZXIpO1xuXHRcdGlmIChzZWxlY3Rpb25zLmV2ZXJ5KHMgPT4gcy5pc0VtcHR5KCkpKSB7IHJldHVybiBlbXB0eUFycjsgfVxuXG5cdFx0Y29uc3Qgc2VsZWN0ZWRMaW5lTnVtYmVycyA9IG5ldyBMaW5lUmFuZ2VTZXQoc2VsZWN0aW9ucy5tYXAocyA9PiBMaW5lUmFuZ2UuZnJvbVJhbmdlSW5jbHVzaXZlKHMpKSk7XG5cblx0XHRjb25zdCBzZWxlY3RlZE1hcHBpbmdzID0gZGlmZi5tYXBwaW5ncy5maWx0ZXIobSA9PlxuXHRcdFx0bS5saW5lUmFuZ2VNYXBwaW5nLmlubmVyQ2hhbmdlcyAmJiBzZWxlY3RlZExpbmVOdW1iZXJzLmludGVyc2VjdHMobS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkKVxuXHRcdCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gc2VsZWN0ZWRNYXBwaW5ncy5tYXAobWFwcGluZyA9PiAoe1xuXHRcdFx0bWFwcGluZyxcblx0XHRcdHJhbmdlTWFwcGluZ3M6IG1hcHBpbmcubGluZVJhbmdlTWFwcGluZy5pbm5lckNoYW5nZXMhLmZpbHRlcihcblx0XHRcdFx0YyA9PiBzZWxlY3Rpb25zLnNvbWUocyA9PiBSYW5nZS5hcmVJbnRlcnNlY3RpbmcoYy5tb2RpZmllZFJhbmdlLCBzKSlcblx0XHRcdClcblx0XHR9KSk7XG5cdFx0aWYgKHJlc3VsdC5sZW5ndGggPT09IDAgfHwgcmVzdWx0LmV2ZXJ5KHIgPT4gci5yYW5nZU1hcHBpbmdzLmxlbmd0aCA9PT0gMCkpIHsgcmV0dXJuIGVtcHR5QXJyOyB9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSk7XG59XG5cbmV4cG9ydCBjbGFzcyBSZXZlcnRCdXR0b24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUdseXBoTWFyZ2luV2lkZ2V0IHtcblx0cHVibGljIHN0YXRpYyBjb3VudGVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pZDogc3RyaW5nID0gYHJldmVydEJ1dHRvbiR7UmV2ZXJ0QnV0dG9uLmNvdW50ZXIrK31gO1xuXG5cdGdldElkKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl9pZDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGUgPSBoKCdkaXYucmV2ZXJ0QnV0dG9uJywge1xuXHRcdHRpdGxlOiB0aGlzLl9yZXZlcnRTZWxlY3Rpb25cblx0XHRcdD8gbG9jYWxpemUoJ3JldmVydFNlbGVjdGVkQ2hhbmdlcycsICdSZXZlcnQgU2VsZWN0ZWQgQ2hhbmdlcycpXG5cdFx0XHQ6IGxvY2FsaXplKCdyZXZlcnRDaGFuZ2UnLCAnUmV2ZXJ0IENoYW5nZScpXG5cdH0sXG5cdFx0W3JlbmRlckljb24oQ29kaWNvbi5hcnJvd1JpZ2h0KV1cblx0KS5yb290O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVOdW1iZXI6IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF93aWRnZXQ6IERpZmZFZGl0b3JXaWRnZXQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlmZnM6IFJhbmdlTWFwcGluZ1tdIHwgTGluZVJhbmdlTWFwcGluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZXZlcnRTZWxlY3Rpb246IGJvb2xlYW4sXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9kb21Ob2RlLCBFdmVudFR5cGUuTU9VU0VfRE9XTiwgZSA9PiB7XG5cdFx0XHQvLyBkb24ndCBwcmV2ZW50IGNvbnRleHQgbWVudSBmcm9tIHNob3dpbmcgdXBcblx0XHRcdGlmIChlLmJ1dHRvbiAhPT0gMikge1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUsIEV2ZW50VHlwZS5NT1VTRV9VUCwgZSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9kb21Ob2RlLCBFdmVudFR5cGUuQ0xJQ0ssIChlKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZGlmZnMgaW5zdGFuY2VvZiBMaW5lUmFuZ2VNYXBwaW5nKSB7XG5cdFx0XHRcdHRoaXMuX3dpZGdldC5yZXZlcnQodGhpcy5fZGlmZnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fd2lkZ2V0LnJldmVydFJhbmdlTWFwcGluZ3ModGhpcy5fZGlmZnMpO1xuXHRcdFx0fVxuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBkb20gbm9kZSBvZiB0aGUgZ2x5cGggd2lkZ2V0LlxuXHQgKi9cblx0Z2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBwbGFjZW1lbnQgb2YgdGhlIGdseXBoIHdpZGdldC5cblx0ICovXG5cdGdldFBvc2l0aW9uKCk6IElHbHlwaE1hcmdpbldpZGdldFBvc2l0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFuZTogR2x5cGhNYXJnaW5MYW5lLlJpZ2h0LFxuXHRcdFx0cmFuZ2U6IHtcblx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogdGhpcy5fbGluZU51bWJlcixcblx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB0aGlzLl9saW5lTnVtYmVyLFxuXHRcdFx0fSxcblx0XHRcdHpJbmRleDogMTAwMDEsXG5cdFx0fTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyx1QkFBdUIsR0FBRyxpQkFBaUI7QUFDcEQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxvQkFBb0I7QUFDekMsU0FBc0Isa0JBQWtCLGVBQWU7QUFNdkQsU0FBUyxXQUFXLG9CQUFvQjtBQUN4QyxTQUFTLGFBQWE7QUFDdEIsU0FBUyx3QkFBc0M7QUFDL0MsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQkFBZ0I7QUFFekIsTUFBTSxXQUFvQixDQUFDO0FBRXBCLE1BQU0sNkJBQTZCLFdBQVc7QUFBQSxFQUNwRCxZQUNrQixVQUNBLFlBQ0EsVUFDQSxTQUNoQjtBQUNELFVBQU07QUFMVztBQUNBO0FBQ0E7QUFDQTtBQW9EbEIsU0FBaUIsaUJBQWlCLFFBQVEsTUFBTSxDQUFDLFdBQVc7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
