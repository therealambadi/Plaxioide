import { compareBy, numberComparator } from "../../../../../base/common/arrays.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { DetailedLineRangeMapping } from "./mapping.js";
import { LineRangeEdit } from "./editing.js";
import { LineRange } from "./lineRange.js";
import { ReentrancyBarrier } from "../../../../../base/common/controlFlow.js";
import { autorun, observableSignal, observableValue, transaction } from "../../../../../base/common/observable.js";
class TextModelDiffs extends Disposable {
  constructor(baseTextModel, textModel, diffComputer) {
    super();
    this.baseTextModel = baseTextModel;
    this.textModel = textModel;
    this.diffComputer = diffComputer;
    this._recomputeCount = 0;
    this._state = observableValue(this, 1 /* initializing */);
    this._diffs = observableValue(this, []);
    this._barrier = new ReentrancyBarrier();
    this._isDisposed = false;
    this._isInitializing = true;
    const recomputeSignal = observableSignal("recompute");
    this._register(autorun((reader) => {
      recomputeSignal.read(reader);
      this._recompute(reader);
    }));
    this._register(
      baseTextModel.onDidChangeContent(
        this._barrier.makeExclusiveOrSkip(() => {
          recomputeSignal.trigger(void 0);
        })
      )
    );
    this._register(
      textModel.onDidChangeContent(
        this._barrier.makeExclusiveOrSkip(() => {
          recomputeSignal.trigger(void 0);
        })
      )
    );
    this._register(toDisposable(() => {
      this._isDisposed = true;
    }));
  }
  get isApplyingChange() {
    return this._barrier.isOccupied;
  }
  get state() {
    return this._state;
  }
  /**
   * Diffs from base to input.
  */
  get diffs() {
    return this._diffs;
  }
  _recompute(reader) {
    this._recomputeCount++;
    const currentRecomputeIdx = this._recomputeCount;
    if (this._state.get() === 1 /* initializing */) {
      this._isInitializing = true;
    }
    transaction((tx) => {
      this._state.set(
        this._isInitializing ? 1 /* initializing */ : 3 /* updating */,
        tx,
        0 /* other */
      );
    });
    const result = this.diffComputer.computeDiff(this.baseTextModel, this.textModel, reader);
    result.then((result2) => {
      if (this._isDisposed) {
        return;
      }
      if (currentRecomputeIdx !== this._recomputeCount) {
        return;
      }
      transaction((tx) => {
        if (result2.diffs) {
          this._state.set(2 /* upToDate */, tx, 1 /* textChange */);
          this._diffs.set(result2.diffs, tx, 1 /* textChange */);
        } else {
          this._state.set(4 /* error */, tx, 1 /* textChange */);
        }
        this._isInitializing = false;
      });
    });
  }
  ensureUpToDate() {
    if (this.state.get() !== 2 /* upToDate */) {
      throw new BugIndicatingError("Cannot remove diffs when the model is not up to date");
    }
  }
  removeDiffs(diffToRemoves, transaction2, group) {
    this.ensureUpToDate();
    diffToRemoves.sort(compareBy((d) => d.inputRange.startLineNumber, numberComparator));
    diffToRemoves.reverse();
    let diffs = this._diffs.get();
    for (const diffToRemove of diffToRemoves) {
      const len = diffs.length;
      diffs = diffs.filter((d) => d !== diffToRemove);
      if (len === diffs.length) {
        throw new BugIndicatingError();
      }
      this._barrier.runExclusivelyOrThrow(() => {
        const edits = diffToRemove.getReverseLineEdit().toEdits(this.textModel.getLineCount());
        this.textModel.pushEditOperations(null, edits, () => null, group);
      });
      diffs = diffs.map(
        (d) => d.outputRange.isAfter(diffToRemove.outputRange) ? d.addOutputLineDelta(diffToRemove.inputRange.lineCount - diffToRemove.outputRange.lineCount) : d
      );
    }
    this._diffs.set(diffs, transaction2, 0 /* other */);
  }
  /**
   * Edit must be conflict free.
   */
  applyEditRelativeToOriginal(edit, transaction2, group) {
    this.ensureUpToDate();
    const editMapping = new DetailedLineRangeMapping(
      edit.range,
      this.baseTextModel,
      new LineRange(edit.range.startLineNumber, edit.newLines.length),
      this.textModel
    );
    let firstAfter = false;
    let delta = 0;
    const newDiffs = new Array();
    for (const diff of this.diffs.get()) {
      if (diff.inputRange.touches(edit.range)) {
        throw new BugIndicatingError("Edit must be conflict free.");
      } else if (diff.inputRange.isAfter(edit.range)) {
        if (!firstAfter) {
          firstAfter = true;
          newDiffs.push(editMapping.addOutputLineDelta(delta));
        }
        newDiffs.push(diff.addOutputLineDelta(edit.newLines.length - edit.range.lineCount));
      } else {
        newDiffs.push(diff);
      }
      if (!firstAfter) {
        delta += diff.outputRange.lineCount - diff.inputRange.lineCount;
      }
    }
    if (!firstAfter) {
      firstAfter = true;
      newDiffs.push(editMapping.addOutputLineDelta(delta));
    }
    this._barrier.runExclusivelyOrThrow(() => {
      const edits = new LineRangeEdit(edit.range.delta(delta), edit.newLines).toEdits(this.textModel.getLineCount());
      this.textModel.pushEditOperations(null, edits, () => null, group);
    });
    this._diffs.set(newDiffs, transaction2, 0 /* other */);
  }
  findTouchingDiffs(baseRange) {
    return this.diffs.get().filter((d) => d.inputRange.touches(baseRange));
  }
  getResultLine(lineNumber, reader) {
    let offset = 0;
    const diffs = reader ? this.diffs.read(reader) : this.diffs.get();
    for (const diff of diffs) {
      if (diff.inputRange.contains(lineNumber) || diff.inputRange.endLineNumberExclusive === lineNumber) {
        return diff;
      } else if (diff.inputRange.endLineNumberExclusive < lineNumber) {
        offset = diff.resultingDeltaFromOriginalToModified;
      } else {
        break;
      }
    }
    return lineNumber + offset;
  }
  getResultLineRange(baseRange, reader) {
    let start = this.getResultLine(baseRange.startLineNumber, reader);
    if (typeof start !== "number") {
      start = start.outputRange.startLineNumber;
    }
    let endExclusive = this.getResultLine(baseRange.endLineNumberExclusive, reader);
    if (typeof endExclusive !== "number") {
      endExclusive = endExclusive.outputRange.endLineNumberExclusive;
    }
    return LineRange.fromLineNumbers(start, endExclusive);
  }
}
var TextModelDiffChangeReason = /* @__PURE__ */ ((TextModelDiffChangeReason2) => {
  TextModelDiffChangeReason2[TextModelDiffChangeReason2["other"] = 0] = "other";
  TextModelDiffChangeReason2[TextModelDiffChangeReason2["textChange"] = 1] = "textChange";
  return TextModelDiffChangeReason2;
})(TextModelDiffChangeReason || {});
var TextModelDiffState = /* @__PURE__ */ ((TextModelDiffState2) => {
  TextModelDiffState2[TextModelDiffState2["initializing"] = 1] = "initializing";
  TextModelDiffState2[TextModelDiffState2["upToDate"] = 2] = "upToDate";
  TextModelDiffState2[TextModelDiffState2["updating"] = 3] = "updating";
  TextModelDiffState2[TextModelDiffState2["error"] = 4] = "error";
  return TextModelDiffState2;
})(TextModelDiffState || {});
export {
  TextModelDiffChangeReason,
  TextModelDiffState,
  TextModelDiffs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL3RleHRNb2RlbERpZmZzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY29tcGFyZUJ5LCBudW1iZXJDb21wYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi9tYXBwaW5nLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZUVkaXQgfSBmcm9tICcuL2VkaXRpbmcuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgUmVlbnRyYW5jeUJhcnJpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb250cm9sRmxvdy5qcyc7XG5pbXBvcnQgeyBJTWVyZ2VEaWZmQ29tcHV0ZXIgfSBmcm9tICcuL2RpZmZDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2UsIElSZWFkZXIsIElUcmFuc2FjdGlvbiwgb2JzZXJ2YWJsZVNpZ25hbCwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVW5kb1JlZG9Hcm91cCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXh0TW9kZWxEaWZmcyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9yZWNvbXB1dGVDb3VudCA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlID0gb2JzZXJ2YWJsZVZhbHVlPFRleHRNb2RlbERpZmZTdGF0ZSwgVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbj4odGhpcywgVGV4dE1vZGVsRGlmZlN0YXRlLmluaXRpYWxpemluZyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZzID0gb2JzZXJ2YWJsZVZhbHVlPERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdLCBUZXh0TW9kZWxEaWZmQ2hhbmdlUmVhc29uPih0aGlzLCBbXSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYmFycmllciA9IG5ldyBSZWVudHJhbmN5QmFycmllcigpO1xuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkID0gZmFsc2U7XG5cblx0cHVibGljIGdldCBpc0FwcGx5aW5nQ2hhbmdlKCkge1xuXHRcdHJldHVybiB0aGlzLl9iYXJyaWVyLmlzT2NjdXBpZWQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGJhc2VUZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkaWZmQ29tcHV0ZXI6IElNZXJnZURpZmZDb21wdXRlcixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHJlY29tcHV0ZVNpZ25hbCA9IG9ic2VydmFibGVTaWduYWwoJ3JlY29tcHV0ZScpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBVcGRhdGUgZGlmZiBzdGF0ZSAqL1xuXHRcdFx0cmVjb21wdXRlU2lnbmFsLnJlYWQocmVhZGVyKTtcblx0XHRcdHRoaXMuX3JlY29tcHV0ZShyZWFkZXIpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0YmFzZVRleHRNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoXG5cdFx0XHRcdHRoaXMuX2JhcnJpZXIubWFrZUV4Y2x1c2l2ZU9yU2tpcCgoKSA9PiB7XG5cdFx0XHRcdFx0cmVjb21wdXRlU2lnbmFsLnRyaWdnZXIodW5kZWZpbmVkKTtcblx0XHRcdFx0fSlcblx0XHRcdClcblx0XHQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0dGV4dE1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChcblx0XHRcdFx0dGhpcy5fYmFycmllci5tYWtlRXhjbHVzaXZlT3JTa2lwKCgpID0+IHtcblx0XHRcdFx0XHRyZWNvbXB1dGVTaWduYWwudHJpZ2dlcih1bmRlZmluZWQpO1xuXHRcdFx0XHR9KVxuXHRcdFx0KVxuXHRcdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgc3RhdGUoKTogSU9ic2VydmFibGVXaXRoQ2hhbmdlPFRleHRNb2RlbERpZmZTdGF0ZSwgVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbj4ge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEaWZmcyBmcm9tIGJhc2UgdG8gaW5wdXQuXG5cdCovXG5cdHB1YmxpYyBnZXQgZGlmZnMoKTogSU9ic2VydmFibGVXaXRoQ2hhbmdlPERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdLCBUZXh0TW9kZWxEaWZmQ2hhbmdlUmVhc29uPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2RpZmZzO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNJbml0aWFsaXppbmcgPSB0cnVlO1xuXG5cdHByaXZhdGUgX3JlY29tcHV0ZShyZWFkZXI6IElSZWFkZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWNvbXB1dGVDb3VudCsrO1xuXHRcdGNvbnN0IGN1cnJlbnRSZWNvbXB1dGVJZHggPSB0aGlzLl9yZWNvbXB1dGVDb3VudDtcblxuXHRcdGlmICh0aGlzLl9zdGF0ZS5nZXQoKSA9PT0gVGV4dE1vZGVsRGlmZlN0YXRlLmluaXRpYWxpemluZykge1xuXHRcdFx0dGhpcy5faXNJbml0aWFsaXppbmcgPSB0cnVlO1xuXHRcdH1cblxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gU3RhcnRpbmcgRGlmZiBDb21wdXRhdGlvbi4gKi9cblx0XHRcdHRoaXMuX3N0YXRlLnNldChcblx0XHRcdFx0dGhpcy5faXNJbml0aWFsaXppbmcgPyBUZXh0TW9kZWxEaWZmU3RhdGUuaW5pdGlhbGl6aW5nIDogVGV4dE1vZGVsRGlmZlN0YXRlLnVwZGF0aW5nLFxuXHRcdFx0XHR0eCxcblx0XHRcdFx0VGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbi5vdGhlclxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuZGlmZkNvbXB1dGVyLmNvbXB1dGVEaWZmKHRoaXMuYmFzZVRleHRNb2RlbCwgdGhpcy50ZXh0TW9kZWwsIHJlYWRlcik7XG5cblx0XHRyZXN1bHQudGhlbigocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjdXJyZW50UmVjb21wdXRlSWR4ICE9PSB0aGlzLl9yZWNvbXB1dGVDb3VudCkge1xuXHRcdFx0XHQvLyBUaGVyZSBpcyBhIG5ld2VyIHJlY29tcHV0ZSBjYWxsXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIENvbXBsZXRlZCBEaWZmIENvbXB1dGF0aW9uICovXG5cdFx0XHRcdGlmIChyZXN1bHQuZGlmZnMpIHtcblx0XHRcdFx0XHR0aGlzLl9zdGF0ZS5zZXQoVGV4dE1vZGVsRGlmZlN0YXRlLnVwVG9EYXRlLCB0eCwgVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbi50ZXh0Q2hhbmdlKTtcblx0XHRcdFx0XHR0aGlzLl9kaWZmcy5zZXQocmVzdWx0LmRpZmZzLCB0eCwgVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbi50ZXh0Q2hhbmdlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9zdGF0ZS5zZXQoVGV4dE1vZGVsRGlmZlN0YXRlLmVycm9yLCB0eCwgVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbi50ZXh0Q2hhbmdlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZVVwVG9EYXRlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnN0YXRlLmdldCgpICE9PSBUZXh0TW9kZWxEaWZmU3RhdGUudXBUb0RhdGUpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0Nhbm5vdCByZW1vdmUgZGlmZnMgd2hlbiB0aGUgbW9kZWwgaXMgbm90IHVwIHRvIGRhdGUnKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlRGlmZnMoZGlmZlRvUmVtb3ZlczogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10sIHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQsIGdyb3VwPzogVW5kb1JlZG9Hcm91cCk6IHZvaWQge1xuXHRcdHRoaXMuZW5zdXJlVXBUb0RhdGUoKTtcblxuXHRcdGRpZmZUb1JlbW92ZXMuc29ydChjb21wYXJlQnkoKGQpID0+IGQuaW5wdXRSYW5nZS5zdGFydExpbmVOdW1iZXIsIG51bWJlckNvbXBhcmF0b3IpKTtcblx0XHRkaWZmVG9SZW1vdmVzLnJldmVyc2UoKTtcblxuXHRcdGxldCBkaWZmcyA9IHRoaXMuX2RpZmZzLmdldCgpO1xuXG5cdFx0Zm9yIChjb25zdCBkaWZmVG9SZW1vdmUgb2YgZGlmZlRvUmVtb3Zlcykge1xuXHRcdFx0Ly8gVE9ETyBpbXByb3ZlIHBlcmZvcm1hbmNlXG5cdFx0XHRjb25zdCBsZW4gPSBkaWZmcy5sZW5ndGg7XG5cdFx0XHRkaWZmcyA9IGRpZmZzLmZpbHRlcigoZCkgPT4gZCAhPT0gZGlmZlRvUmVtb3ZlKTtcblx0XHRcdGlmIChsZW4gPT09IGRpZmZzLmxlbmd0aCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2JhcnJpZXIucnVuRXhjbHVzaXZlbHlPclRocm93KCgpID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdHMgPSBkaWZmVG9SZW1vdmUuZ2V0UmV2ZXJzZUxpbmVFZGl0KCkudG9FZGl0cyh0aGlzLnRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHRcdHRoaXMudGV4dE1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBlZGl0cywgKCkgPT4gbnVsbCwgZ3JvdXApO1xuXHRcdFx0fSk7XG5cblx0XHRcdGRpZmZzID0gZGlmZnMubWFwKChkKSA9PlxuXHRcdFx0XHRkLm91dHB1dFJhbmdlLmlzQWZ0ZXIoZGlmZlRvUmVtb3ZlLm91dHB1dFJhbmdlKVxuXHRcdFx0XHRcdD8gZC5hZGRPdXRwdXRMaW5lRGVsdGEoZGlmZlRvUmVtb3ZlLmlucHV0UmFuZ2UubGluZUNvdW50IC0gZGlmZlRvUmVtb3ZlLm91dHB1dFJhbmdlLmxpbmVDb3VudClcblx0XHRcdFx0XHQ6IGRcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGlmZnMuc2V0KGRpZmZzLCB0cmFuc2FjdGlvbiwgVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbi5vdGhlcik7XG5cdH1cblxuXHQvKipcblx0ICogRWRpdCBtdXN0IGJlIGNvbmZsaWN0IGZyZWUuXG5cdCAqL1xuXHRwdWJsaWMgYXBwbHlFZGl0UmVsYXRpdmVUb09yaWdpbmFsKGVkaXQ6IExpbmVSYW5nZUVkaXQsIHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQsIGdyb3VwPzogVW5kb1JlZG9Hcm91cCk6IHZvaWQge1xuXHRcdHRoaXMuZW5zdXJlVXBUb0RhdGUoKTtcblxuXHRcdGNvbnN0IGVkaXRNYXBwaW5nID0gbmV3IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyhcblx0XHRcdGVkaXQucmFuZ2UsXG5cdFx0XHR0aGlzLmJhc2VUZXh0TW9kZWwsXG5cdFx0XHRuZXcgTGluZVJhbmdlKGVkaXQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBlZGl0Lm5ld0xpbmVzLmxlbmd0aCksXG5cdFx0XHR0aGlzLnRleHRNb2RlbFxuXHRcdCk7XG5cblx0XHRsZXQgZmlyc3RBZnRlciA9IGZhbHNlO1xuXHRcdGxldCBkZWx0YSA9IDA7XG5cdFx0Y29uc3QgbmV3RGlmZnMgPSBuZXcgQXJyYXk8RGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nPigpO1xuXHRcdGZvciAoY29uc3QgZGlmZiBvZiB0aGlzLmRpZmZzLmdldCgpKSB7XG5cdFx0XHRpZiAoZGlmZi5pbnB1dFJhbmdlLnRvdWNoZXMoZWRpdC5yYW5nZSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignRWRpdCBtdXN0IGJlIGNvbmZsaWN0IGZyZWUuJyk7XG5cdFx0XHR9IGVsc2UgaWYgKGRpZmYuaW5wdXRSYW5nZS5pc0FmdGVyKGVkaXQucmFuZ2UpKSB7XG5cdFx0XHRcdGlmICghZmlyc3RBZnRlcikge1xuXHRcdFx0XHRcdGZpcnN0QWZ0ZXIgPSB0cnVlO1xuXHRcdFx0XHRcdG5ld0RpZmZzLnB1c2goZWRpdE1hcHBpbmcuYWRkT3V0cHV0TGluZURlbHRhKGRlbHRhKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRuZXdEaWZmcy5wdXNoKGRpZmYuYWRkT3V0cHV0TGluZURlbHRhKGVkaXQubmV3TGluZXMubGVuZ3RoIC0gZWRpdC5yYW5nZS5saW5lQ291bnQpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5ld0RpZmZzLnB1c2goZGlmZik7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghZmlyc3RBZnRlcikge1xuXHRcdFx0XHRkZWx0YSArPSBkaWZmLm91dHB1dFJhbmdlLmxpbmVDb3VudCAtIGRpZmYuaW5wdXRSYW5nZS5saW5lQ291bnQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFmaXJzdEFmdGVyKSB7XG5cdFx0XHRmaXJzdEFmdGVyID0gdHJ1ZTtcblx0XHRcdG5ld0RpZmZzLnB1c2goZWRpdE1hcHBpbmcuYWRkT3V0cHV0TGluZURlbHRhKGRlbHRhKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYmFycmllci5ydW5FeGNsdXNpdmVseU9yVGhyb3coKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdHMgPSBuZXcgTGluZVJhbmdlRWRpdChlZGl0LnJhbmdlLmRlbHRhKGRlbHRhKSwgZWRpdC5uZXdMaW5lcykudG9FZGl0cyh0aGlzLnRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHR0aGlzLnRleHRNb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgZWRpdHMsICgpID0+IG51bGwsIGdyb3VwKTtcblx0XHR9KTtcblx0XHR0aGlzLl9kaWZmcy5zZXQobmV3RGlmZnMsIHRyYW5zYWN0aW9uLCBUZXh0TW9kZWxEaWZmQ2hhbmdlUmVhc29uLm90aGVyKTtcblx0fVxuXG5cdHB1YmxpYyBmaW5kVG91Y2hpbmdEaWZmcyhiYXNlUmFuZ2U6IExpbmVSYW5nZSk6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5kaWZmcy5nZXQoKS5maWx0ZXIoZCA9PiBkLmlucHV0UmFuZ2UudG91Y2hlcyhiYXNlUmFuZ2UpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UmVzdWx0TGluZShsaW5lTnVtYmVyOiBudW1iZXIsIHJlYWRlcj86IElSZWFkZXIpOiBudW1iZXIgfCBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcge1xuXHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdGNvbnN0IGRpZmZzID0gcmVhZGVyID8gdGhpcy5kaWZmcy5yZWFkKHJlYWRlcikgOiB0aGlzLmRpZmZzLmdldCgpO1xuXHRcdGZvciAoY29uc3QgZGlmZiBvZiBkaWZmcykge1xuXHRcdFx0aWYgKGRpZmYuaW5wdXRSYW5nZS5jb250YWlucyhsaW5lTnVtYmVyKSB8fCBkaWZmLmlucHV0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSA9PT0gbGluZU51bWJlcikge1xuXHRcdFx0XHRyZXR1cm4gZGlmZjtcblx0XHRcdH0gZWxzZSBpZiAoZGlmZi5pbnB1dFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgPCBsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdG9mZnNldCA9IGRpZmYucmVzdWx0aW5nRGVsdGFGcm9tT3JpZ2luYWxUb01vZGlmaWVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBsaW5lTnVtYmVyICsgb2Zmc2V0O1xuXHR9XG5cblx0cHVibGljIGdldFJlc3VsdExpbmVSYW5nZShiYXNlUmFuZ2U6IExpbmVSYW5nZSwgcmVhZGVyPzogSVJlYWRlcik6IExpbmVSYW5nZSB7XG5cdFx0bGV0IHN0YXJ0ID0gdGhpcy5nZXRSZXN1bHRMaW5lKGJhc2VSYW5nZS5zdGFydExpbmVOdW1iZXIsIHJlYWRlcik7XG5cdFx0aWYgKHR5cGVvZiBzdGFydCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHN0YXJ0ID0gc3RhcnQub3V0cHV0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdH1cblx0XHRsZXQgZW5kRXhjbHVzaXZlID0gdGhpcy5nZXRSZXN1bHRMaW5lKGJhc2VSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlLCByZWFkZXIpO1xuXHRcdGlmICh0eXBlb2YgZW5kRXhjbHVzaXZlICE9PSAnbnVtYmVyJykge1xuXHRcdFx0ZW5kRXhjbHVzaXZlID0gZW5kRXhjbHVzaXZlLm91dHB1dFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIExpbmVSYW5nZS5mcm9tTGluZU51bWJlcnMoc3RhcnQsIGVuZEV4Y2x1c2l2ZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbiB7XG5cdG90aGVyID0gMCxcblx0dGV4dENoYW5nZSA9IDEsXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRleHRNb2RlbERpZmZTdGF0ZSB7XG5cdGluaXRpYWxpemluZyA9IDEsXG5cdHVwVG9EYXRlID0gMixcblx0dXBkYXRpbmcgPSAzLFxuXHRlcnJvciA9IDQsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRleHRNb2RlbERpZmZzU3RhdGUge1xuXHRzdGF0ZTogVGV4dE1vZGVsRGlmZlN0YXRlO1xuXHRkaWZmczogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW107XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFdBQVcsd0JBQXdCO0FBQzVDLFNBQVMsMEJBQTBCO0FBQ25DLFNB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QVk7QUFDbEcsZUFBTztBQUFBLE1BQ1IsV0FBVyxLQUFLLFdBQVcseUJBQXlCLFlBQVk7QUFDL0QsaUJBQVMsS0FBSztBQUFBLE1BQ2YsT0FBTztBQUNOO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxXQUFPLGFBQWE7QUFBQSxFQUNyQjtBQUFBLEVBRU8sbUJBQW1CLFdBQXNCLFFBQTZCO0FBQzVFLFFBQUksUUFBUSxLQUFLLGNBQWMsVUFBVSxpQkFBaUIsTUFBTTtBQUNoRSxRQUFJLE9BQU8sVUFBVSxVQUFVO0FBQzlCLGNBQVEsTUFBTSxZQUFZO0FBQUEsSUFDM0I7QUFDQSxRQUFJLGVBQWUsS0FBSyxjQUFjLFVBQVUsd0JBQXdCLE1BQU07QUFDOUUsUUFBSSxPQUFPLGlCQUFpQixVQUFVO0FBQ3JDLHFCQUFlLGFBQWEsWUFBWTtBQUFBLElBQ3pDO0FBRUEsV0FBTyxVQUFVLGdCQUFnQixPQUFPLFlBQVk7QUFBQSxFQUNyRDtBQUNEO0FBRU8sSUFBVyw0QkFBWCxrQkFBV0MsK0JBQVg7QUFDTixFQUFBQSxzREFBQSxXQUFRLEtBQVI7QUFDQSxFQUFBQSxzREFBQSxnQkFBYSxLQUFiO0FBRmlCLFNBQUFBO0FBQUEsR0FBQTtBQUtYLElBQVcscUJBQVgsa0JBQVdDLHdCQUFYO0FBQ04sRUFBQUEsd0NBQUEsa0JBQWUsS0FBZjtBQUNBLEVBQUFBLHdDQUFBLGNBQVcsS0FBWDtBQUNBLEVBQUFBLHdDQUFBLGNBQVcsS0FBWDtBQUNBLEVBQUFBLHdDQUFBLFdBQVEsS0FBUjtBQUppQixTQUFBQTtBQUFBLEdBQUE7IiwKICAibmFtZXMiOiBbInJlc3VsdCIsICJ0cmFuc2FjdGlvbiIsICJUZXh0TW9kZWxEaWZmQ2hhbmdlUmVhc29uIiwgIlRleHRNb2RlbERpZmZTdGF0ZSJdCn0K
