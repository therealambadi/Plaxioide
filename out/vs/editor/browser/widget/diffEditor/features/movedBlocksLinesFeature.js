import { h } from "../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { Action } from "../../../../../base/common/actions.js";
import { booleanComparator, compareBy, numberComparator, tieBreakComparators } from "../../../../../base/common/arrays.js";
import { findMaxIdx } from "../../../../../base/common/arraysFind.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunHandleChanges, autorunWithStore, constObservable, derived, derivedWithStore, observableFromEvent, observableSignalFromEvent, observableValue, recomputeInitiallyAndOnChange } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { PlaceholderViewZone, ViewZoneOverlayWidget, applyStyle, applyViewZones } from "../utils.js";
import { OffsetRange, OffsetRangeSet } from "../../../../common/core/offsetRange.js";
import { localize } from "../../../../../nls.js";
const _MovedBlocksLinesFeature = class _MovedBlocksLinesFeature extends Disposable {
  constructor(_rootElement, _diffModel, _originalEditorLayoutInfo, _modifiedEditorLayoutInfo, _editors) {
    super();
    this._rootElement = _rootElement;
    this._diffModel = _diffModel;
    this._originalEditorLayoutInfo = _originalEditorLayoutInfo;
    this._modifiedEditorLayoutInfo = _modifiedEditorLayoutInfo;
    this._editors = _editors;
    this._originalScrollTop = observableFromEvent(this, this._editors.original.onDidScrollChange, () => this._editors.original.getScrollTop());
    this._modifiedScrollTop = observableFromEvent(this, this._editors.modified.onDidScrollChange, () => this._editors.modified.getScrollTop());
    this._viewZonesChanged = observableSignalFromEvent("onDidChangeViewZones", this._editors.modified.onDidChangeViewZones);
    this.width = observableValue(this, 0);
    this._modifiedViewZonesChangedSignal = observableSignalFromEvent("modified.onDidChangeViewZones", this._editors.modified.onDidChangeViewZones);
    this._originalViewZonesChangedSignal = observableSignalFromEvent("original.onDidChangeViewZones", this._editors.original.onDidChangeViewZones);
    this._state = derivedWithStore(this, (reader, store) => {
      this._element.replaceChildren();
      const model = this._diffModel.read(reader);
      const moves = model?.diff.read(reader)?.movedTexts;
      if (!moves || moves.length === 0) {
        this.width.set(0, void 0);
        return;
      }
      this._viewZonesChanged.read(reader);
      const infoOrig = this._originalEditorLayoutInfo.read(reader);
      const infoMod = this._modifiedEditorLayoutInfo.read(reader);
      if (!infoOrig || !infoMod) {
        this.width.set(0, void 0);
        return;
      }
      this._modifiedViewZonesChangedSignal.read(reader);
      this._originalViewZonesChangedSignal.read(reader);
      const lines = moves.map((move) => {
        function computeLineStart(range, editor) {
          const t1 = editor.getTopForLineNumber(range.startLineNumber, true);
          const t2 = editor.getTopForLineNumber(range.endLineNumberExclusive, true);
          return (t1 + t2) / 2;
        }
        const start = computeLineStart(move.lineRangeMapping.original, this._editors.original);
        const startOffset = this._originalScrollTop.read(reader);
        const end = computeLineStart(move.lineRangeMapping.modified, this._editors.modified);
        const endOffset = this._modifiedScrollTop.read(reader);
        const from = start - startOffset;
        const to = end - endOffset;
        const top = Math.min(start, end);
        const bottom = Math.max(start, end);
        return { range: new OffsetRange(top, bottom), from, to, fromWithoutScroll: start, toWithoutScroll: end, move };
      });
      lines.sort(tieBreakComparators(
        compareBy((l) => l.fromWithoutScroll > l.toWithoutScroll, booleanComparator),
        compareBy((l) => l.fromWithoutScroll > l.toWithoutScroll ? l.fromWithoutScroll : -l.toWithoutScroll, numberComparator)
      ));
      const layout = LinesLayout.compute(lines.map((l) => l.range));
      const padding = 10;
      const lineAreaLeft = infoOrig.verticalScrollbarWidth;
      const lineAreaWidth = (layout.getTrackCount() - 1) * 10 + padding * 2;
      const width = lineAreaLeft + lineAreaWidth + (infoMod.contentLeft - _MovedBlocksLinesFeature.movedCodeBlockPadding);
      let idx = 0;
      for (const line of lines) {
        const track = layout.getTrack(idx);
        const verticalY = lineAreaLeft + padding + track * 10;
        const arrowHeight = 15;
        const arrowWidth = 15;
        const right = width;
        const rectWidth = infoMod.glyphMarginWidth + infoMod.lineNumbersWidth;
        const rectHeight = 18;
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.classList.add("arrow-rectangle");
        rect.setAttribute("x", `${right - rectWidth}`);
        rect.setAttribute("y", `${line.to - rectHeight / 2}`);
        rect.setAttribute("width", `${rectWidth}`);
        rect.setAttribute("height", `${rectHeight}`);
        this._element.appendChild(rect);
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${0} ${line.from} L ${verticalY} ${line.from} L ${verticalY} ${line.to} L ${right - arrowWidth} ${line.to}`);
        path.setAttribute("fill", "none");
        g.appendChild(path);
        const arrowRight = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        arrowRight.classList.add("arrow");
        store.add(autorun((reader2) => {
          path.classList.toggle("currentMove", line.move === model.activeMovedText.read(reader2));
          arrowRight.classList.toggle("currentMove", line.move === model.activeMovedText.read(reader2));
        }));
        arrowRight.setAttribute("points", `${right - arrowWidth},${line.to - arrowHeight / 2} ${right},${line.to} ${right - arrowWidth},${line.to + arrowHeight / 2}`);
        g.appendChild(arrowRight);
        this._element.appendChild(g);
        idx++;
      }
      this.width.set(lineAreaWidth, void 0);
    });
    this._element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this._element.setAttribute("class", "moved-blocks-lines");
    this._rootElement.appendChild(this._element);
    this._register(toDisposable(() => this._element.remove()));
    this._register(autorun((reader) => {
      const info = this._originalEditorLayoutInfo.read(reader);
      const info2 = this._modifiedEditorLayoutInfo.read(reader);
      if (!info || !info2) {
        return;
      }
      this._element.style.left = `${info.width - info.verticalScrollbarWidth}px`;
      this._element.style.height = `${info.height}px`;
      this._element.style.width = `${info.verticalScrollbarWidth + info.contentLeft - _MovedBlocksLinesFeature.movedCodeBlockPadding + this.width.read(reader)}px`;
    }));
    this._register(recomputeInitiallyAndOnChange(this._state));
    const movedBlockViewZones = derived((reader) => {
      const model = this._diffModel.read(reader);
      const d = model?.diff.read(reader);
      if (!d) {
        return [];
      }
      return d.movedTexts.map((move) => ({
        move,
        original: new PlaceholderViewZone(constObservable(move.lineRangeMapping.original.startLineNumber - 1), 18),
        modified: new PlaceholderViewZone(constObservable(move.lineRangeMapping.modified.startLineNumber - 1), 18)
      }));
    });
    this._register(applyViewZones(this._editors.original, movedBlockViewZones.map((zones) => (
      /** @description movedBlockViewZones.original */
      zones.map((z) => z.original)
    ))));
    this._register(applyViewZones(this._editors.modified, movedBlockViewZones.map((zones) => (
      /** @description movedBlockViewZones.modified */
      zones.map((z) => z.modified)
    ))));
    this._register(autorunWithStore((reader, store) => {
      const blocks = movedBlockViewZones.read(reader);
      for (const b of blocks) {
        store.add(new MovedBlockOverlayWidget(this._editors.original, b.original, b.move, "original", this._diffModel.get()));
        store.add(new MovedBlockOverlayWidget(this._editors.modified, b.modified, b.move, "modified", this._diffModel.get()));
      }
    }));
    const originalHasFocus = observableSignalFromEvent(
      "original.onDidFocusEditorWidget",
      (e) => this._editors.original.onDidFocusEditorWidget(() => setTimeout(() => e(void 0), 0))
    );
    const modifiedHasFocus = observableSignalFromEvent(
      "modified.onDidFocusEditorWidget",
      (e) => this._editors.modified.onDidFocusEditorWidget(() => setTimeout(() => e(void 0), 0))
    );
    let lastChangedEditor = "modified";
    this._register(autorunHandleChanges({
      createEmptyChangeSummary: () => void 0,
      handleChange: (ctx, summary) => {
        if (ctx.didChange(originalHasFocus)) {
          lastChangedEditor = "original";
        }
        if (ctx.didChange(modifiedHasFocus)) {
          lastChangedEditor = "modified";
        }
        return true;
      }
    }, (reader) => {
      originalHasFocus.read(reader);
      modifiedHasFocus.read(reader);
      const m = this._diffModel.read(reader);
      if (!m) {
        return;
      }
      const diff = m.diff.read(reader);
      let movedText = void 0;
      if (diff && lastChangedEditor === "original") {
        const originalPos = this._editors.originalCursor.read(reader);
        if (originalPos) {
          movedText = diff.movedTexts.find((m2) => m2.lineRangeMapping.original.contains(originalPos.lineNumber));
        }
      }
      if (diff && lastChangedEditor === "modified") {
        const modifiedPos = this._editors.modifiedCursor.read(reader);
        if (modifiedPos) {
          movedText = diff.movedTexts.find((m2) => m2.lineRangeMapping.modified.contains(modifiedPos.lineNumber));
        }
      }
      if (movedText !== m.movedTextToCompare.get()) {
        m.movedTextToCompare.set(void 0, void 0);
      }
      m.setActiveMovedText(movedText);
    }));
  }
};
_MovedBlocksLinesFeature.movedCodeBlockPadding = 4;
let MovedBlocksLinesFeature = _MovedBlocksLinesFeature;
class LinesLayout {
  constructor(_trackCount, trackPerLineIdx) {
    this._trackCount = _trackCount;
    this.trackPerLineIdx = trackPerLineIdx;
  }
  static compute(lines) {
    const setsPerTrack = [];
    const trackPerLineIdx = [];
    for (const line of lines) {
      let trackIdx = setsPerTrack.findIndex((set) => !set.intersectsStrict(line));
      if (trackIdx === -1) {
        const maxTrackCount = 6;
        if (setsPerTrack.length >= maxTrackCount) {
          trackIdx = findMaxIdx(setsPerTrack, compareBy((set) => set.intersectWithRangeLength(line), numberComparator));
        } else {
          trackIdx = setsPerTrack.length;
          setsPerTrack.push(new OffsetRangeSet());
        }
      }
      setsPerTrack[trackIdx].addRange(line);
      trackPerLineIdx.push(trackIdx);
    }
    return new LinesLayout(setsPerTrack.length, trackPerLineIdx);
  }
  getTrack(lineIdx) {
    return this.trackPerLineIdx[lineIdx];
  }
  getTrackCount() {
    return this._trackCount;
  }
}
class MovedBlockOverlayWidget extends ViewZoneOverlayWidget {
  constructor(_editor, _viewZone, _move, _kind, _diffModel) {
    const root = h("div.diff-hidden-lines-widget");
    super(_editor, _viewZone, root.root);
    this._editor = _editor;
    this._move = _move;
    this._kind = _kind;
    this._diffModel = _diffModel;
    this._nodes = h("div.diff-moved-code-block", { style: { marginRight: "4px" } }, [
      h("div.text-content@textContent"),
      h("div.action-bar@actionBar")
    ]);
    root.root.appendChild(this._nodes.root);
    const editorLayout = observableFromEvent(this._editor.onDidLayoutChange, () => this._editor.getLayoutInfo());
    this._register(applyStyle(this._nodes.root, {
      paddingRight: editorLayout.map((l) => l.verticalScrollbarWidth)
    }));
    let text;
    if (_move.changes.length > 0) {
      text = this._kind === "original" ? localize(
        "codeMovedToWithChanges",
        "Code moved with changes to line {0}-{1}",
        this._move.lineRangeMapping.modified.startLineNumber,
        this._move.lineRangeMapping.modified.endLineNumberExclusive - 1
      ) : localize(
        "codeMovedFromWithChanges",
        "Code moved with changes from line {0}-{1}",
        this._move.lineRangeMapping.original.startLineNumber,
        this._move.lineRangeMapping.original.endLineNumberExclusive - 1
      );
    } else {
      text = this._kind === "original" ? localize(
        "codeMovedTo",
        "Code moved to line {0}-{1}",
        this._move.lineRangeMapping.modified.startLineNumber,
        this._move.lineRangeMapping.modified.endLineNumberExclusive - 1
      ) : localize(
        "codeMovedFrom",
        "Code moved from line {0}-{1}",
        this._move.lineRangeMapping.original.startLineNumber,
        this._move.lineRangeMapping.original.endLineNumberExclusive - 1
      );
    }
    const actionBar = this._register(new ActionBar(this._nodes.actionBar, {
      highlightToggledItems: true
    }));
    const caption = new Action(
      "",
      text,
      "",
      false
    );
    actionBar.push(caption, { icon: false, label: true });
    const actionCompare = new Action(
      "",
      "Compare",
      ThemeIcon.asClassName(Codicon.compareChanges),
      true,
      () => {
        this._editor.focus();
        this._diffModel.movedTextToCompare.set(this._diffModel.movedTextToCompare.get() === _move ? void 0 : this._move, void 0);
      }
    );
    this._register(autorun((reader) => {
      const isActive = this._diffModel.movedTextToCompare.read(reader) === _move;
      actionCompare.checked = isActive;
    }));
    actionBar.push(actionCompare, { icon: false, label: true });
  }
}
export {
  MovedBlocksLinesFeature
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9mZWF0dXJlcy9tb3ZlZEJsb2Nrc0xpbmVzRmVhdHVyZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgYm9vbGVhbkNvbXBhcmF0b3IsIGNvbXBhcmVCeSwgbnVtYmVyQ29tcGFyYXRvciwgdGllQnJlYWtDb21wYXJhdG9ycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBmaW5kTWF4SWR4IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzRmluZC5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBhdXRvcnVuLCBhdXRvcnVuSGFuZGxlQ2hhbmdlcywgYXV0b3J1bldpdGhTdG9yZSwgY29uc3RPYnNlcnZhYmxlLCBkZXJpdmVkLCBkZXJpdmVkV2l0aFN0b3JlLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBvYnNlcnZhYmxlU2lnbmFsRnJvbUV2ZW50LCBvYnNlcnZhYmxlVmFsdWUsIHJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JFZGl0b3JzIH0gZnJvbSAnLi4vY29tcG9uZW50cy9kaWZmRWRpdG9yRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yVmlld01vZGVsIH0gZnJvbSAnLi4vZGlmZkVkaXRvclZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBQbGFjZWhvbGRlclZpZXdab25lLCBWaWV3Wm9uZU92ZXJsYXlXaWRnZXQsIGFwcGx5U3R5bGUsIGFwcGx5Vmlld1pvbmVzIH0gZnJvbSAnLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yTGF5b3V0SW5mbyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgT2Zmc2V0UmFuZ2UsIE9mZnNldFJhbmdlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0UmFuZ2UuanMnO1xuaW1wb3J0IHsgTW92ZWRUZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2RpZmYvbGluZXNEaWZmQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5leHBvcnQgY2xhc3MgTW92ZWRCbG9ja3NMaW5lc0ZlYXR1cmUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBtb3ZlZENvZGVCbG9ja1BhZGRpbmcgPSA0O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VsZW1lbnQ6IFNWR0VsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsU2Nyb2xsVG9wID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCB0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLm9uRGlkU2Nyb2xsQ2hhbmdlLCAoKSA9PiB0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLmdldFNjcm9sbFRvcCgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRTY3JvbGxUb3AgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIHRoaXMuX2VkaXRvcnMubW9kaWZpZWQub25EaWRTY3JvbGxDaGFuZ2UsICgpID0+IHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuZ2V0U2Nyb2xsVG9wKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3Wm9uZXNDaGFuZ2VkID0gb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCgnb25EaWRDaGFuZ2VWaWV3Wm9uZXMnLCB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLm9uRGlkQ2hhbmdlVmlld1pvbmVzKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgd2lkdGggPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgMCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcm9vdEVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZNb2RlbDogSU9ic2VydmFibGU8RGlmZkVkaXRvclZpZXdNb2RlbCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxFZGl0b3JMYXlvdXRJbmZvOiBJT2JzZXJ2YWJsZTxFZGl0b3JMYXlvdXRJbmZvIHwgbnVsbD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRFZGl0b3JMYXlvdXRJbmZvOiBJT2JzZXJ2YWJsZTxFZGl0b3JMYXlvdXRJbmZvIHwgbnVsbD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yczogRGlmZkVkaXRvckVkaXRvcnMsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsICdzdmcnKTtcblx0XHR0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnbW92ZWQtYmxvY2tzLWxpbmVzJyk7XG5cdFx0dGhpcy5fcm9vdEVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fZWxlbWVudCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX2VsZW1lbnQucmVtb3ZlKCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gdXBkYXRlIG1vdmVkIGJsb2NrcyBsaW5lcyBwb3NpdGlvbmluZyAqL1xuXHRcdFx0Y29uc3QgaW5mbyA9IHRoaXMuX29yaWdpbmFsRWRpdG9yTGF5b3V0SW5mby5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBpbmZvMiA9IHRoaXMuX21vZGlmaWVkRWRpdG9yTGF5b3V0SW5mby5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIWluZm8gfHwgIWluZm8yKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZWxlbWVudC5zdHlsZS5sZWZ0ID0gYCR7aW5mby53aWR0aCAtIGluZm8udmVydGljYWxTY3JvbGxiYXJXaWR0aH1weGA7XG5cdFx0XHR0aGlzLl9lbGVtZW50LnN0eWxlLmhlaWdodCA9IGAke2luZm8uaGVpZ2h0fXB4YDtcblx0XHRcdHRoaXMuX2VsZW1lbnQuc3R5bGUud2lkdGggPSBgJHtpbmZvLnZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggKyBpbmZvLmNvbnRlbnRMZWZ0IC0gTW92ZWRCbG9ja3NMaW5lc0ZlYXR1cmUubW92ZWRDb2RlQmxvY2tQYWRkaW5nICsgdGhpcy53aWR0aC5yZWFkKHJlYWRlcil9cHhgO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0YXRlKSk7XG5cblx0XHRjb25zdCBtb3ZlZEJsb2NrVmlld1pvbmVzID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9kaWZmTW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgZCA9IG1vZGVsPy5kaWZmLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghZCkgeyByZXR1cm4gW107IH1cblx0XHRcdHJldHVybiBkLm1vdmVkVGV4dHMubWFwKG1vdmUgPT4gKHtcblx0XHRcdFx0bW92ZSxcblx0XHRcdFx0b3JpZ2luYWw6IG5ldyBQbGFjZWhvbGRlclZpZXdab25lKGNvbnN0T2JzZXJ2YWJsZShtb3ZlLmxpbmVSYW5nZU1hcHBpbmcub3JpZ2luYWwuc3RhcnRMaW5lTnVtYmVyIC0gMSksIDE4KSxcblx0XHRcdFx0bW9kaWZpZWQ6IG5ldyBQbGFjZWhvbGRlclZpZXdab25lKGNvbnN0T2JzZXJ2YWJsZShtb3ZlLmxpbmVSYW5nZU1hcHBpbmcubW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyIC0gMSksIDE4KSxcblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFwcGx5Vmlld1pvbmVzKHRoaXMuX2VkaXRvcnMub3JpZ2luYWwsIG1vdmVkQmxvY2tWaWV3Wm9uZXMubWFwKHpvbmVzID0+IC8qKiBAZGVzY3JpcHRpb24gbW92ZWRCbG9ja1ZpZXdab25lcy5vcmlnaW5hbCAqLyB6b25lcy5tYXAoeiA9PiB6Lm9yaWdpbmFsKSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhcHBseVZpZXdab25lcyh0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLCBtb3ZlZEJsb2NrVmlld1pvbmVzLm1hcCh6b25lcyA9PiAvKiogQGRlc2NyaXB0aW9uIG1vdmVkQmxvY2tWaWV3Wm9uZXMubW9kaWZpZWQgKi8gem9uZXMubWFwKHogPT4gei5tb2RpZmllZCkpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRjb25zdCBibG9ja3MgPSBtb3ZlZEJsb2NrVmlld1pvbmVzLnJlYWQocmVhZGVyKTtcblx0XHRcdGZvciAoY29uc3QgYiBvZiBibG9ja3MpIHtcblx0XHRcdFx0c3RvcmUuYWRkKG5ldyBNb3ZlZEJsb2NrT3ZlcmxheVdpZGdldCh0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLCBiLm9yaWdpbmFsLCBiLm1vdmUsICdvcmlnaW5hbCcsIHRoaXMuX2RpZmZNb2RlbC5nZXQoKSEpKTtcblx0XHRcdFx0c3RvcmUuYWRkKG5ldyBNb3ZlZEJsb2NrT3ZlcmxheVdpZGdldCh0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLCBiLm1vZGlmaWVkLCBiLm1vdmUsICdtb2RpZmllZCcsIHRoaXMuX2RpZmZNb2RlbC5nZXQoKSEpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBvcmlnaW5hbEhhc0ZvY3VzID0gb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudChcblx0XHRcdCdvcmlnaW5hbC5vbkRpZEZvY3VzRWRpdG9yV2lkZ2V0Jyxcblx0XHRcdGUgPT4gdGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5vbkRpZEZvY3VzRWRpdG9yV2lkZ2V0KCgpID0+IHNldFRpbWVvdXQoKCkgPT4gZSh1bmRlZmluZWQpLCAwKSlcblx0XHQpO1xuXHRcdGNvbnN0IG1vZGlmaWVkSGFzRm9jdXMgPSBvYnNlcnZhYmxlU2lnbmFsRnJvbUV2ZW50KFxuXHRcdFx0J21vZGlmaWVkLm9uRGlkRm9jdXNFZGl0b3JXaWRnZXQnLFxuXHRcdFx0ZSA9PiB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLm9uRGlkRm9jdXNFZGl0b3JXaWRnZXQoKCkgPT4gc2V0VGltZW91dCgoKSA9PiBlKHVuZGVmaW5lZCksIDApKVxuXHRcdCk7XG5cblx0XHRsZXQgbGFzdENoYW5nZWRFZGl0b3I6ICdvcmlnaW5hbCcgfCAnbW9kaWZpZWQnID0gJ21vZGlmaWVkJztcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5IYW5kbGVDaGFuZ2VzKHtcblx0XHRcdGNyZWF0ZUVtcHR5Q2hhbmdlU3VtbWFyeTogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0aGFuZGxlQ2hhbmdlOiAoY3R4LCBzdW1tYXJ5KSA9PiB7XG5cdFx0XHRcdGlmIChjdHguZGlkQ2hhbmdlKG9yaWdpbmFsSGFzRm9jdXMpKSB7IGxhc3RDaGFuZ2VkRWRpdG9yID0gJ29yaWdpbmFsJzsgfVxuXHRcdFx0XHRpZiAoY3R4LmRpZENoYW5nZShtb2RpZmllZEhhc0ZvY3VzKSkgeyBsYXN0Q2hhbmdlZEVkaXRvciA9ICdtb2RpZmllZCc7IH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSwgcmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gTW92ZWRCbG9ja3NMaW5lcy5zZXRBY3RpdmVNb3ZlZFRleHRGcm9tQ3Vyc29yICovXG5cdFx0XHRvcmlnaW5hbEhhc0ZvY3VzLnJlYWQocmVhZGVyKTtcblx0XHRcdG1vZGlmaWVkSGFzRm9jdXMucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRjb25zdCBtID0gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghbSkgeyByZXR1cm47IH1cblx0XHRcdGNvbnN0IGRpZmYgPSBtLmRpZmYucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRsZXQgbW92ZWRUZXh0OiBNb3ZlZFRleHQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdGlmIChkaWZmICYmIGxhc3RDaGFuZ2VkRWRpdG9yID09PSAnb3JpZ2luYWwnKSB7XG5cdFx0XHRcdGNvbnN0IG9yaWdpbmFsUG9zID0gdGhpcy5fZWRpdG9ycy5vcmlnaW5hbEN1cnNvci5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGlmIChvcmlnaW5hbFBvcykge1xuXHRcdFx0XHRcdG1vdmVkVGV4dCA9IGRpZmYubW92ZWRUZXh0cy5maW5kKG0gPT4gbS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLmNvbnRhaW5zKG9yaWdpbmFsUG9zLmxpbmVOdW1iZXIpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZGlmZiAmJiBsYXN0Q2hhbmdlZEVkaXRvciA9PT0gJ21vZGlmaWVkJykge1xuXHRcdFx0XHRjb25zdCBtb2RpZmllZFBvcyA9IHRoaXMuX2VkaXRvcnMubW9kaWZpZWRDdXJzb3IucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRpZiAobW9kaWZpZWRQb3MpIHtcblx0XHRcdFx0XHRtb3ZlZFRleHQgPSBkaWZmLm1vdmVkVGV4dHMuZmluZChtID0+IG0ubGluZVJhbmdlTWFwcGluZy5tb2RpZmllZC5jb250YWlucyhtb2RpZmllZFBvcy5saW5lTnVtYmVyKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG1vdmVkVGV4dCAhPT0gbS5tb3ZlZFRleHRUb0NvbXBhcmUuZ2V0KCkpIHtcblx0XHRcdFx0bS5tb3ZlZFRleHRUb0NvbXBhcmUuc2V0KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHRcdG0uc2V0QWN0aXZlTW92ZWRUZXh0KG1vdmVkVGV4dCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRWaWV3Wm9uZXNDaGFuZ2VkU2lnbmFsID0gb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCgnbW9kaWZpZWQub25EaWRDaGFuZ2VWaWV3Wm9uZXMnLCB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLm9uRGlkQ2hhbmdlVmlld1pvbmVzKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxWaWV3Wm9uZXNDaGFuZ2VkU2lnbmFsID0gb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCgnb3JpZ2luYWwub25EaWRDaGFuZ2VWaWV3Wm9uZXMnLCB0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLm9uRGlkQ2hhbmdlVmlld1pvbmVzKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGF0ZSA9IGRlcml2ZWRXaXRoU3RvcmUodGhpcywgKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHQvKiogQGRlc2NyaXB0aW9uIHN0YXRlICovXG5cblx0XHR0aGlzLl9lbGVtZW50LnJlcGxhY2VDaGlsZHJlbigpO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBtb3ZlcyA9IG1vZGVsPy5kaWZmLnJlYWQocmVhZGVyKT8ubW92ZWRUZXh0cztcblx0XHRpZiAoIW1vdmVzIHx8IG1vdmVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy53aWR0aC5zZXQoMCwgdW5kZWZpbmVkKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl92aWV3Wm9uZXNDaGFuZ2VkLnJlYWQocmVhZGVyKTtcblxuXHRcdGNvbnN0IGluZm9PcmlnID0gdGhpcy5fb3JpZ2luYWxFZGl0b3JMYXlvdXRJbmZvLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBpbmZvTW9kID0gdGhpcy5fbW9kaWZpZWRFZGl0b3JMYXlvdXRJbmZvLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIWluZm9PcmlnIHx8ICFpbmZvTW9kKSB7XG5cdFx0XHR0aGlzLndpZHRoLnNldCgwLCB1bmRlZmluZWQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX21vZGlmaWVkVmlld1pvbmVzQ2hhbmdlZFNpZ25hbC5yZWFkKHJlYWRlcik7XG5cdFx0dGhpcy5fb3JpZ2luYWxWaWV3Wm9uZXNDaGFuZ2VkU2lnbmFsLnJlYWQocmVhZGVyKTtcblxuXHRcdGNvbnN0IGxpbmVzID0gbW92ZXMubWFwKChtb3ZlKSA9PiB7XG5cdFx0XHRmdW5jdGlvbiBjb21wdXRlTGluZVN0YXJ0KHJhbmdlOiBMaW5lUmFuZ2UsIGVkaXRvcjogSUNvZGVFZGl0b3IpIHtcblx0XHRcdFx0Y29uc3QgdDEgPSBlZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihyYW5nZS5zdGFydExpbmVOdW1iZXIsIHRydWUpO1xuXHRcdFx0XHRjb25zdCB0MiA9IGVkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKHJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUsIHRydWUpO1xuXHRcdFx0XHRyZXR1cm4gKHQxICsgdDIpIC8gMjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhcnQgPSBjb21wdXRlTGluZVN0YXJ0KG1vdmUubGluZVJhbmdlTWFwcGluZy5vcmlnaW5hbCwgdGhpcy5fZWRpdG9ycy5vcmlnaW5hbCk7XG5cdFx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMuX29yaWdpbmFsU2Nyb2xsVG9wLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGVuZCA9IGNvbXB1dGVMaW5lU3RhcnQobW92ZS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLCB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkKTtcblx0XHRcdGNvbnN0IGVuZE9mZnNldCA9IHRoaXMuX21vZGlmaWVkU2Nyb2xsVG9wLnJlYWQocmVhZGVyKTtcblxuXHRcdFx0Y29uc3QgZnJvbSA9IHN0YXJ0IC0gc3RhcnRPZmZzZXQ7XG5cdFx0XHRjb25zdCB0byA9IGVuZCAtIGVuZE9mZnNldDtcblxuXHRcdFx0Y29uc3QgdG9wID0gTWF0aC5taW4oc3RhcnQsIGVuZCk7XG5cdFx0XHRjb25zdCBib3R0b20gPSBNYXRoLm1heChzdGFydCwgZW5kKTtcblxuXHRcdFx0cmV0dXJuIHsgcmFuZ2U6IG5ldyBPZmZzZXRSYW5nZSh0b3AsIGJvdHRvbSksIGZyb20sIHRvLCBmcm9tV2l0aG91dFNjcm9sbDogc3RhcnQsIHRvV2l0aG91dFNjcm9sbDogZW5kLCBtb3ZlIH07XG5cdFx0fSk7XG5cblx0XHRsaW5lcy5zb3J0KHRpZUJyZWFrQ29tcGFyYXRvcnMoXG5cdFx0XHRjb21wYXJlQnkobCA9PiBsLmZyb21XaXRob3V0U2Nyb2xsID4gbC50b1dpdGhvdXRTY3JvbGwsIGJvb2xlYW5Db21wYXJhdG9yKSxcblx0XHRcdGNvbXBhcmVCeShsID0+IGwuZnJvbVdpdGhvdXRTY3JvbGwgPiBsLnRvV2l0aG91dFNjcm9sbCA/IGwuZnJvbVdpdGhvdXRTY3JvbGwgOiAtbC50b1dpdGhvdXRTY3JvbGwsIG51bWJlckNvbXBhcmF0b3IpXG5cdFx0KSk7XG5cblx0XHRjb25zdCBsYXlvdXQgPSBMaW5lc0xheW91dC5jb21wdXRlKGxpbmVzLm1hcChsID0+IGwucmFuZ2UpKTtcblxuXHRcdGNvbnN0IHBhZGRpbmcgPSAxMDtcblx0XHRjb25zdCBsaW5lQXJlYUxlZnQgPSBpbmZvT3JpZy52ZXJ0aWNhbFNjcm9sbGJhcldpZHRoO1xuXHRcdGNvbnN0IGxpbmVBcmVhV2lkdGggPSAobGF5b3V0LmdldFRyYWNrQ291bnQoKSAtIDEpICogMTAgKyBwYWRkaW5nICogMjtcblx0XHRjb25zdCB3aWR0aCA9IGxpbmVBcmVhTGVmdCArIGxpbmVBcmVhV2lkdGggKyAoaW5mb01vZC5jb250ZW50TGVmdCAtIE1vdmVkQmxvY2tzTGluZXNGZWF0dXJlLm1vdmVkQ29kZUJsb2NrUGFkZGluZyk7XG5cblx0XHRsZXQgaWR4ID0gMDtcblx0XHRmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcblx0XHRcdGNvbnN0IHRyYWNrID0gbGF5b3V0LmdldFRyYWNrKGlkeCk7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbFkgPSBsaW5lQXJlYUxlZnQgKyBwYWRkaW5nICsgdHJhY2sgKiAxMDtcblxuXHRcdFx0Y29uc3QgYXJyb3dIZWlnaHQgPSAxNTtcblx0XHRcdGNvbnN0IGFycm93V2lkdGggPSAxNTtcblx0XHRcdGNvbnN0IHJpZ2h0ID0gd2lkdGg7XG5cblx0XHRcdGNvbnN0IHJlY3RXaWR0aCA9IGluZm9Nb2QuZ2x5cGhNYXJnaW5XaWR0aCArIGluZm9Nb2QubGluZU51bWJlcnNXaWR0aDtcblx0XHRcdGNvbnN0IHJlY3RIZWlnaHQgPSAxODtcblx0XHRcdGNvbnN0IHJlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ3JlY3QnKTtcblx0XHRcdHJlY3QuY2xhc3NMaXN0LmFkZCgnYXJyb3ctcmVjdGFuZ2xlJyk7XG5cdFx0XHRyZWN0LnNldEF0dHJpYnV0ZSgneCcsIGAke3JpZ2h0IC0gcmVjdFdpZHRofWApO1xuXHRcdFx0cmVjdC5zZXRBdHRyaWJ1dGUoJ3knLCBgJHtsaW5lLnRvIC0gcmVjdEhlaWdodCAvIDJ9YCk7XG5cdFx0XHRyZWN0LnNldEF0dHJpYnV0ZSgnd2lkdGgnLCBgJHtyZWN0V2lkdGh9YCk7XG5cdFx0XHRyZWN0LnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgYCR7cmVjdEhlaWdodH1gKTtcblx0XHRcdHRoaXMuX2VsZW1lbnQuYXBwZW5kQ2hpbGQocmVjdCk7XG5cblx0XHRcdGNvbnN0IGcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ2cnKTtcblxuXHRcdFx0Y29uc3QgcGF0aCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAncGF0aCcpO1xuXG5cdFx0XHRwYXRoLnNldEF0dHJpYnV0ZSgnZCcsIGBNICR7MH0gJHtsaW5lLmZyb219IEwgJHt2ZXJ0aWNhbFl9ICR7bGluZS5mcm9tfSBMICR7dmVydGljYWxZfSAke2xpbmUudG99IEwgJHtyaWdodCAtIGFycm93V2lkdGh9ICR7bGluZS50b31gKTtcblx0XHRcdHBhdGguc2V0QXR0cmlidXRlKCdmaWxsJywgJ25vbmUnKTtcblx0XHRcdGcuYXBwZW5kQ2hpbGQocGF0aCk7XG5cblx0XHRcdGNvbnN0IGFycm93UmlnaHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ3BvbHlnb24nKTtcblx0XHRcdGFycm93UmlnaHQuY2xhc3NMaXN0LmFkZCgnYXJyb3cnKTtcblxuXHRcdFx0c3RvcmUuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdFx0cGF0aC5jbGFzc0xpc3QudG9nZ2xlKCdjdXJyZW50TW92ZScsIGxpbmUubW92ZSA9PT0gbW9kZWwuYWN0aXZlTW92ZWRUZXh0LnJlYWQocmVhZGVyKSk7XG5cdFx0XHRcdGFycm93UmlnaHQuY2xhc3NMaXN0LnRvZ2dsZSgnY3VycmVudE1vdmUnLCBsaW5lLm1vdmUgPT09IG1vZGVsLmFjdGl2ZU1vdmVkVGV4dC5yZWFkKHJlYWRlcikpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRhcnJvd1JpZ2h0LnNldEF0dHJpYnV0ZSgncG9pbnRzJywgYCR7cmlnaHQgLSBhcnJvd1dpZHRofSwke2xpbmUudG8gLSBhcnJvd0hlaWdodCAvIDJ9ICR7cmlnaHR9LCR7bGluZS50b30gJHtyaWdodCAtIGFycm93V2lkdGh9LCR7bGluZS50byArIGFycm93SGVpZ2h0IC8gMn1gKTtcblx0XHRcdGcuYXBwZW5kQ2hpbGQoYXJyb3dSaWdodCk7XG5cblx0XHRcdHRoaXMuX2VsZW1lbnQuYXBwZW5kQ2hpbGQoZyk7XG5cblx0XHRcdC8qXG5cdFx0XHRUT0RPQGhlZGlldFxuXHRcdFx0cGF0aC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4ge1xuXHRcdFx0XHRtb2RlbC5zZXRIb3ZlcmVkTW92ZWRUZXh0KGxpbmUubW92ZSk7XG5cdFx0XHR9KTtcblx0XHRcdHBhdGguYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHtcblx0XHRcdFx0bW9kZWwuc2V0SG92ZXJlZE1vdmVkVGV4dCh1bmRlZmluZWQpO1xuXHRcdFx0fSk7Ki9cblxuXHRcdFx0aWR4Kys7XG5cdFx0fVxuXG5cdFx0dGhpcy53aWR0aC5zZXQobGluZUFyZWFXaWR0aCwgdW5kZWZpbmVkKTtcblx0fSk7XG59XG5cbmNsYXNzIExpbmVzTGF5b3V0IHtcblx0cHVibGljIHN0YXRpYyBjb21wdXRlKGxpbmVzOiBPZmZzZXRSYW5nZVtdKTogTGluZXNMYXlvdXQge1xuXHRcdGNvbnN0IHNldHNQZXJUcmFjazogT2Zmc2V0UmFuZ2VTZXRbXSA9IFtdO1xuXHRcdGNvbnN0IHRyYWNrUGVyTGluZUlkeDogbnVtYmVyW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuXHRcdFx0bGV0IHRyYWNrSWR4ID0gc2V0c1BlclRyYWNrLmZpbmRJbmRleChzZXQgPT4gIXNldC5pbnRlcnNlY3RzU3RyaWN0KGxpbmUpKTtcblx0XHRcdGlmICh0cmFja0lkeCA9PT0gLTEpIHtcblx0XHRcdFx0Y29uc3QgbWF4VHJhY2tDb3VudCA9IDY7XG5cdFx0XHRcdGlmIChzZXRzUGVyVHJhY2subGVuZ3RoID49IG1heFRyYWNrQ291bnQpIHtcblx0XHRcdFx0XHR0cmFja0lkeCA9IGZpbmRNYXhJZHgoc2V0c1BlclRyYWNrLCBjb21wYXJlQnkoc2V0ID0+IHNldC5pbnRlcnNlY3RXaXRoUmFuZ2VMZW5ndGgobGluZSksIG51bWJlckNvbXBhcmF0b3IpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0cmFja0lkeCA9IHNldHNQZXJUcmFjay5sZW5ndGg7XG5cdFx0XHRcdFx0c2V0c1BlclRyYWNrLnB1c2gobmV3IE9mZnNldFJhbmdlU2V0KCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRzZXRzUGVyVHJhY2tbdHJhY2tJZHhdLmFkZFJhbmdlKGxpbmUpO1xuXHRcdFx0dHJhY2tQZXJMaW5lSWR4LnB1c2godHJhY2tJZHgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgTGluZXNMYXlvdXQoc2V0c1BlclRyYWNrLmxlbmd0aCwgdHJhY2tQZXJMaW5lSWR4KTtcblx0fVxuXG5cdHByaXZhdGUgY29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdHJhY2tDb3VudDogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdHJhY2tQZXJMaW5lSWR4OiBudW1iZXJbXVxuXHQpIHsgfVxuXG5cdGdldFRyYWNrKGxpbmVJZHg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudHJhY2tQZXJMaW5lSWR4W2xpbmVJZHhdO1xuXHR9XG5cblx0Z2V0VHJhY2tDb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl90cmFja0NvdW50O1xuXHR9XG59XG5cbmNsYXNzIE1vdmVkQmxvY2tPdmVybGF5V2lkZ2V0IGV4dGVuZHMgVmlld1pvbmVPdmVybGF5V2lkZ2V0IHtcblx0cHJpdmF0ZSByZWFkb25seSBfbm9kZXMgPSBoKCdkaXYuZGlmZi1tb3ZlZC1jb2RlLWJsb2NrJywgeyBzdHlsZTogeyBtYXJnaW5SaWdodDogJzRweCcgfSB9LCBbXG5cdFx0aCgnZGl2LnRleHQtY29udGVudEB0ZXh0Q29udGVudCcpLFxuXHRcdGgoJ2Rpdi5hY3Rpb24tYmFyQGFjdGlvbkJhcicpLFxuXHRdKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdF92aWV3Wm9uZTogUGxhY2Vob2xkZXJWaWV3Wm9uZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb3ZlOiBNb3ZlZFRleHQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfa2luZDogJ29yaWdpbmFsJyB8ICdtb2RpZmllZCcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlmZk1vZGVsOiBEaWZmRWRpdG9yVmlld01vZGVsLFxuXHQpIHtcblx0XHRjb25zdCByb290ID0gaCgnZGl2LmRpZmYtaGlkZGVuLWxpbmVzLXdpZGdldCcpO1xuXHRcdHN1cGVyKF9lZGl0b3IsIF92aWV3Wm9uZSwgcm9vdC5yb290KTtcblx0XHRyb290LnJvb3QuYXBwZW5kQ2hpbGQodGhpcy5fbm9kZXMucm9vdCk7XG5cblx0XHRjb25zdCBlZGl0b3JMYXlvdXQgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMuX2VkaXRvci5vbkRpZExheW91dENoYW5nZSwgKCkgPT4gdGhpcy5fZWRpdG9yLmdldExheW91dEluZm8oKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhcHBseVN0eWxlKHRoaXMuX25vZGVzLnJvb3QsIHtcblx0XHRcdHBhZGRpbmdSaWdodDogZWRpdG9yTGF5b3V0Lm1hcChsID0+IGwudmVydGljYWxTY3JvbGxiYXJXaWR0aClcblx0XHR9KSk7XG5cblx0XHRsZXQgdGV4dDogc3RyaW5nO1xuXG5cdFx0aWYgKF9tb3ZlLmNoYW5nZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGV4dCA9IHRoaXMuX2tpbmQgPT09ICdvcmlnaW5hbCcgPyBsb2NhbGl6ZShcblx0XHRcdFx0J2NvZGVNb3ZlZFRvV2l0aENoYW5nZXMnLFxuXHRcdFx0XHQnQ29kZSBtb3ZlZCB3aXRoIGNoYW5nZXMgdG8gbGluZSB7MH0tezF9Jyxcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0KSA6IGxvY2FsaXplKFxuXHRcdFx0XHQnY29kZU1vdmVkRnJvbVdpdGhDaGFuZ2VzJyxcblx0XHRcdFx0J0NvZGUgbW92ZWQgd2l0aCBjaGFuZ2VzIGZyb20gbGluZSB7MH0tezF9Jyxcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGV4dCA9IHRoaXMuX2tpbmQgPT09ICdvcmlnaW5hbCcgPyBsb2NhbGl6ZShcblx0XHRcdFx0J2NvZGVNb3ZlZFRvJyxcblx0XHRcdFx0J0NvZGUgbW92ZWQgdG8gbGluZSB7MH0tezF9Jyxcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0KSA6IGxvY2FsaXplKFxuXHRcdFx0XHQnY29kZU1vdmVkRnJvbScsXG5cdFx0XHRcdCdDb2RlIG1vdmVkIGZyb20gbGluZSB7MH0tezF9Jyxcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0dGhpcy5fbW92ZS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKHRoaXMuX25vZGVzLmFjdGlvbkJhciwge1xuXHRcdFx0aGlnaGxpZ2h0VG9nZ2xlZEl0ZW1zOiB0cnVlLFxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGNhcHRpb24gPSBuZXcgQWN0aW9uKFxuXHRcdFx0JycsXG5cdFx0XHR0ZXh0LFxuXHRcdFx0JycsXG5cdFx0XHRmYWxzZSxcblx0XHQpO1xuXHRcdGFjdGlvbkJhci5wdXNoKGNhcHRpb24sIHsgaWNvbjogZmFsc2UsIGxhYmVsOiB0cnVlIH0pO1xuXG5cdFx0Y29uc3QgYWN0aW9uQ29tcGFyZSA9IG5ldyBBY3Rpb24oXG5cdFx0XHQnJyxcblx0XHRcdCdDb21wYXJlJyxcblx0XHRcdFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmNvbXBhcmVDaGFuZ2VzKSxcblx0XHRcdHRydWUsXG5cdFx0XHQoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXHRcdFx0XHR0aGlzLl9kaWZmTW9kZWwubW92ZWRUZXh0VG9Db21wYXJlLnNldCh0aGlzLl9kaWZmTW9kZWwubW92ZWRUZXh0VG9Db21wYXJlLmdldCgpID09PSBfbW92ZSA/IHVuZGVmaW5lZCA6IHRoaXMuX21vdmUsIHVuZGVmaW5lZCk7XG5cdFx0XHR9LFxuXHRcdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgaXNBY3RpdmUgPSB0aGlzLl9kaWZmTW9kZWwubW92ZWRUZXh0VG9Db21wYXJlLnJlYWQocmVhZGVyKSA9PT0gX21vdmU7XG5cdFx0XHRhY3Rpb25Db21wYXJlLmNoZWNrZWQgPSBpc0FjdGl2ZTtcblx0XHR9KSk7XG5cblx0XHRhY3Rpb25CYXIucHVzaChhY3Rpb25Db21wYXJlLCB7IGljb246IGZhbHNlLCBsYWJlbDogdHJ1ZSB9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxTQUFTO0FBQ2xCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsY0FBYztBQUN2QixTQUFTLG1CQUFtQixXQUFXLGtCQUFrQiwyQkFBMkI7QUFDcEYsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxvQkFBb0I7QUFDekMsU0FBc0IsU0FBUyxzQkFBc0Isa0JBQWtCLGlCQUFpQixTQUFTLGtCQUFrQixxQkFBcUIsMkJBQTJCLGlCQUFpQixxQ0FBcUM7QUFDek4sU0FBUyxpQkFBaUI7QUFJMUIsU0FBUyxxQkFBcUIsdUJBQXVCLFlBQVksc0JBQXNC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
