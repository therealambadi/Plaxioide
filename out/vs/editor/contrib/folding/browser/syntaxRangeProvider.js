import { onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { FoldingRegions, MAX_LINE_NUMBER } from "./foldingRanges.js";
const foldingContext = {};
const ID_SYNTAX_PROVIDER = "syntax";
class SyntaxRangeProvider {
  constructor(editorModel, providers, handleFoldingRangesChange, foldingRangesLimit, fallbackRangeProvider) {
    this.editorModel = editorModel;
    this.providers = providers;
    this.handleFoldingRangesChange = handleFoldingRangesChange;
    this.foldingRangesLimit = foldingRangesLimit;
    this.fallbackRangeProvider = fallbackRangeProvider;
    this.id = ID_SYNTAX_PROVIDER;
    this.disposables = new DisposableStore();
    if (fallbackRangeProvider) {
      this.disposables.add(fallbackRangeProvider);
    }
    for (const provider of providers) {
      if (typeof provider.onDidChange === "function") {
        this.disposables.add(provider.onDidChange(handleFoldingRangesChange));
      }
    }
  }
  compute(cancellationToken) {
    return collectSyntaxRanges(this.providers, this.editorModel, cancellationToken).then((ranges) => {
      if (this.editorModel.isDisposed()) {
        return null;
      }
      if (ranges) {
        const res = sanitizeRanges(ranges, this.foldingRangesLimit);
        return res;
      }
      return this.fallbackRangeProvider?.compute(cancellationToken) ?? null;
    });
  }
  dispose() {
    this.disposables.dispose();
  }
}
function collectSyntaxRanges(providers, model, cancellationToken) {
  let rangeData = null;
  const promises = providers.map((provider, i) => {
    return Promise.resolve(provider.provideFoldingRanges(model, foldingContext, cancellationToken)).then((ranges) => {
      if (cancellationToken.isCancellationRequested) {
        return;
      }
      if (Array.isArray(ranges)) {
        if (!Array.isArray(rangeData)) {
          rangeData = [];
        }
        const nLines = model.getLineCount();
        for (const r of ranges) {
          if (r.start > 0 && r.end > r.start && r.end <= nLines) {
            rangeData.push({ start: r.start, end: r.end, rank: i, kind: r.kind });
          }
        }
      }
    }, onUnexpectedExternalError);
  });
  return Promise.all(promises).then((_) => {
    return rangeData;
  });
}
class RangesCollector {
  constructor(foldingRangesLimit) {
    this._startIndexes = [];
    this._endIndexes = [];
    this._nestingLevels = [];
    this._nestingLevelCounts = [];
    this._types = [];
    this._length = 0;
    this._foldingRangesLimit = foldingRangesLimit;
  }
  add(startLineNumber, endLineNumber, type, nestingLevel) {
    if (startLineNumber > MAX_LINE_NUMBER || endLineNumber > MAX_LINE_NUMBER) {
      return;
    }
    const index = this._length;
    this._startIndexes[index] = startLineNumber;
    this._endIndexes[index] = endLineNumber;
    this._nestingLevels[index] = nestingLevel;
    this._types[index] = type;
    this._length++;
    if (nestingLevel < 30) {
      this._nestingLevelCounts[nestingLevel] = (this._nestingLevelCounts[nestingLevel] || 0) + 1;
    }
  }
  toIndentRanges() {
    const limit = this._foldingRangesLimit.limit;
    if (this._length <= limit) {
      this._foldingRangesLimit.update(this._length, false);
      const startIndexes = new Uint32Array(this._length);
      const endIndexes = new Uint32Array(this._length);
      for (let i = 0; i < this._length; i++) {
        startIndexes[i] = this._startIndexes[i];
        endIndexes[i] = this._endIndexes[i];
      }
      return new FoldingRegions(startIndexes, endIndexes, this._types);
    } else {
      this._foldingRangesLimit.update(this._length, limit);
      let entries = 0;
      let maxLevel = this._nestingLevelCounts.length;
      for (let i = 0; i < this._nestingLevelCounts.length; i++) {
        const n = this._nestingLevelCounts[i];
        if (n) {
          if (n + entries > limit) {
            maxLevel = i;
            break;
          }
          entries += n;
        }
      }
      const startIndexes = new Uint32Array(limit);
      const endIndexes = new Uint32Array(limit);
      const types = [];
      for (let i = 0, k = 0; i < this._length; i++) {
        const level = this._nestingLevels[i];
        if (level < maxLevel || level === maxLevel && entries++ < limit) {
          startIndexes[k] = this._startIndexes[i];
          endIndexes[k] = this._endIndexes[i];
          types[k] = this._types[i];
          k++;
        }
      }
      return new FoldingRegions(startIndexes, endIndexes, types);
    }
  }
}
function sanitizeRanges(rangeData, foldingRangesLimit) {
  const sorted = rangeData.sort((d1, d2) => {
    let diff = d1.start - d2.start;
    if (diff === 0) {
      diff = d1.rank - d2.rank;
    }
    return diff;
  });
  const collector = new RangesCollector(foldingRangesLimit);
  let top = void 0;
  const previous = [];
  for (const entry of sorted) {
    if (!top) {
      top = entry;
      collector.add(entry.start, entry.end, entry.kind && entry.kind.value, previous.length);
    } else {
      if (entry.start > top.start) {
        if (entry.end <= top.end) {
          previous.push(top);
          top = entry;
          collector.add(entry.start, entry.end, entry.kind && entry.kind.value, previous.length);
        } else {
          if (entry.start > top.end) {
            do {
              top = previous.pop();
            } while (top && entry.start > top.end);
            if (top) {
              previous.push(top);
            }
            top = entry;
          }
          collector.add(entry.start, entry.end, entry.kind && entry.kind.value, previous.length);
        }
      }
    }
  }
  return collector.toIndentRanges();
}
export {
  SyntaxRangeProvider,
  sanitizeRanges
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9mb2xkaW5nL2Jyb3dzZXIvc3ludGF4UmFuZ2VQcm92aWRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgRm9sZGluZ0NvbnRleHQsIEZvbGRpbmdSYW5nZSwgRm9sZGluZ1JhbmdlUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IEZvbGRpbmdMaW1pdFJlcG9ydGVyLCBSYW5nZVByb3ZpZGVyIH0gZnJvbSAnLi9mb2xkaW5nLmpzJztcbmltcG9ydCB7IEZvbGRpbmdSZWdpb25zLCBNQVhfTElORV9OVU1CRVIgfSBmcm9tICcuL2ZvbGRpbmdSYW5nZXMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElGb2xkaW5nUmFuZ2VEYXRhIGV4dGVuZHMgRm9sZGluZ1JhbmdlIHtcblx0cmFuazogbnVtYmVyO1xufVxuXG5jb25zdCBmb2xkaW5nQ29udGV4dDogRm9sZGluZ0NvbnRleHQgPSB7XG59O1xuXG5jb25zdCBJRF9TWU5UQVhfUFJPVklERVIgPSAnc3ludGF4JztcblxuZXhwb3J0IGNsYXNzIFN5bnRheFJhbmdlUHJvdmlkZXIgaW1wbGVtZW50cyBSYW5nZVByb3ZpZGVyIHtcblxuXHRyZWFkb25seSBpZCA9IElEX1NZTlRBWF9QUk9WSURFUjtcblxuXHRyZWFkb25seSBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yTW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwcm92aWRlcnM6IEZvbGRpbmdSYW5nZVByb3ZpZGVyW10sXG5cdFx0cmVhZG9ubHkgaGFuZGxlRm9sZGluZ1Jhbmdlc0NoYW5nZTogKCkgPT4gdm9pZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZvbGRpbmdSYW5nZXNMaW1pdDogRm9sZGluZ0xpbWl0UmVwb3J0ZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmYWxsYmFja1JhbmdlUHJvdmlkZXI6IFJhbmdlUHJvdmlkZXIgfCB1bmRlZmluZWQgLy8gdXNlZCB3aGVuIGFsbCBwcm92aWRlcnMgcmV0dXJuIG51bGxcblx0KSB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpZiAoZmFsbGJhY2tSYW5nZVByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChmYWxsYmFja1JhbmdlUHJvdmlkZXIpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgcHJvdmlkZXJzKSB7XG5cdFx0XHRpZiAodHlwZW9mIHByb3ZpZGVyLm9uRGlkQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHByb3ZpZGVyLm9uRGlkQ2hhbmdlKGhhbmRsZUZvbGRpbmdSYW5nZXNDaGFuZ2UpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRjb21wdXRlKGNhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8Rm9sZGluZ1JlZ2lvbnMgfCBudWxsPiB7XG5cdFx0cmV0dXJuIGNvbGxlY3RTeW50YXhSYW5nZXModGhpcy5wcm92aWRlcnMsIHRoaXMuZWRpdG9yTW9kZWwsIGNhbmNlbGxhdGlvblRva2VuKS50aGVuKHJhbmdlcyA9PiB7XG5cdFx0XHRpZiAodGhpcy5lZGl0b3JNb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAocmFuZ2VzKSB7XG5cdFx0XHRcdGNvbnN0IHJlcyA9IHNhbml0aXplUmFuZ2VzKHJhbmdlcywgdGhpcy5mb2xkaW5nUmFuZ2VzTGltaXQpO1xuXHRcdFx0XHRyZXR1cm4gcmVzO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuZmFsbGJhY2tSYW5nZVByb3ZpZGVyPy5jb21wdXRlKGNhbmNlbGxhdGlvblRva2VuKSA/PyBudWxsO1xuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0U3ludGF4UmFuZ2VzKHByb3ZpZGVyczogRm9sZGluZ1JhbmdlUHJvdmlkZXJbXSwgbW9kZWw6IElUZXh0TW9kZWwsIGNhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUZvbGRpbmdSYW5nZURhdGFbXSB8IG51bGw+IHtcblx0bGV0IHJhbmdlRGF0YTogSUZvbGRpbmdSYW5nZURhdGFbXSB8IG51bGwgPSBudWxsO1xuXHRjb25zdCBwcm9taXNlcyA9IHByb3ZpZGVycy5tYXAoKHByb3ZpZGVyLCBpKSA9PiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShwcm92aWRlci5wcm92aWRlRm9sZGluZ1Jhbmdlcyhtb2RlbCwgZm9sZGluZ0NvbnRleHQsIGNhbmNlbGxhdGlvblRva2VuKSkudGhlbihyYW5nZXMgPT4ge1xuXHRcdFx0aWYgKGNhbmNlbGxhdGlvblRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KHJhbmdlcykpIHtcblx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KHJhbmdlRGF0YSkpIHtcblx0XHRcdFx0XHRyYW5nZURhdGEgPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBuTGluZXMgPSBtb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRcdFx0Zm9yIChjb25zdCByIG9mIHJhbmdlcykge1xuXHRcdFx0XHRcdGlmIChyLnN0YXJ0ID4gMCAmJiByLmVuZCA+IHIuc3RhcnQgJiYgci5lbmQgPD0gbkxpbmVzKSB7XG5cdFx0XHRcdFx0XHRyYW5nZURhdGEucHVzaCh7IHN0YXJ0OiByLnN0YXJ0LCBlbmQ6IHIuZW5kLCByYW5rOiBpLCBraW5kOiByLmtpbmQgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgb25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvcik7XG5cdH0pO1xuXHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oXyA9PiB7XG5cdFx0cmV0dXJuIHJhbmdlRGF0YTtcblx0fSk7XG59XG5cbmNsYXNzIFJhbmdlc0NvbGxlY3RvciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXJ0SW5kZXhlczogbnVtYmVyW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VuZEluZGV4ZXM6IG51bWJlcltdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9uZXN0aW5nTGV2ZWxzOiBudW1iZXJbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfbmVzdGluZ0xldmVsQ291bnRzOiBudW1iZXJbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfdHlwZXM6IEFycmF5PHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgX2xlbmd0aDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9mb2xkaW5nUmFuZ2VzTGltaXQ6IEZvbGRpbmdMaW1pdFJlcG9ydGVyO1xuXG5cdGNvbnN0cnVjdG9yKGZvbGRpbmdSYW5nZXNMaW1pdDogRm9sZGluZ0xpbWl0UmVwb3J0ZXIpIHtcblx0XHR0aGlzLl9zdGFydEluZGV4ZXMgPSBbXTtcblx0XHR0aGlzLl9lbmRJbmRleGVzID0gW107XG5cdFx0dGhpcy5fbmVzdGluZ0xldmVscyA9IFtdO1xuXHRcdHRoaXMuX25lc3RpbmdMZXZlbENvdW50cyA9IFtdO1xuXHRcdHRoaXMuX3R5cGVzID0gW107XG5cdFx0dGhpcy5fbGVuZ3RoID0gMDtcblx0XHR0aGlzLl9mb2xkaW5nUmFuZ2VzTGltaXQgPSBmb2xkaW5nUmFuZ2VzTGltaXQ7XG5cdH1cblxuXHRwdWJsaWMgYWRkKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgbmVzdGluZ0xldmVsOiBudW1iZXIpIHtcblx0XHRpZiAoc3RhcnRMaW5lTnVtYmVyID4gTUFYX0xJTkVfTlVNQkVSIHx8IGVuZExpbmVOdW1iZXIgPiBNQVhfTElORV9OVU1CRVIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9sZW5ndGg7XG5cdFx0dGhpcy5fc3RhcnRJbmRleGVzW2luZGV4XSA9IHN0YXJ0TGluZU51bWJlcjtcblx0XHR0aGlzLl9lbmRJbmRleGVzW2luZGV4XSA9IGVuZExpbmVOdW1iZXI7XG5cdFx0dGhpcy5fbmVzdGluZ0xldmVsc1tpbmRleF0gPSBuZXN0aW5nTGV2ZWw7XG5cdFx0dGhpcy5fdHlwZXNbaW5kZXhdID0gdHlwZTtcblx0XHR0aGlzLl9sZW5ndGgrKztcblx0XHRpZiAobmVzdGluZ0xldmVsIDwgMzApIHtcblx0XHRcdHRoaXMuX25lc3RpbmdMZXZlbENvdW50c1tuZXN0aW5nTGV2ZWxdID0gKHRoaXMuX25lc3RpbmdMZXZlbENvdW50c1tuZXN0aW5nTGV2ZWxdIHx8IDApICsgMTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdG9JbmRlbnRSYW5nZXMoKSB7XG5cdFx0Y29uc3QgbGltaXQgPSB0aGlzLl9mb2xkaW5nUmFuZ2VzTGltaXQubGltaXQ7XG5cdFx0aWYgKHRoaXMuX2xlbmd0aCA8PSBsaW1pdCkge1xuXHRcdFx0dGhpcy5fZm9sZGluZ1Jhbmdlc0xpbWl0LnVwZGF0ZSh0aGlzLl9sZW5ndGgsIGZhbHNlKTtcblxuXHRcdFx0Y29uc3Qgc3RhcnRJbmRleGVzID0gbmV3IFVpbnQzMkFycmF5KHRoaXMuX2xlbmd0aCk7XG5cdFx0XHRjb25zdCBlbmRJbmRleGVzID0gbmV3IFVpbnQzMkFycmF5KHRoaXMuX2xlbmd0aCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHN0YXJ0SW5kZXhlc1tpXSA9IHRoaXMuX3N0YXJ0SW5kZXhlc1tpXTtcblx0XHRcdFx0ZW5kSW5kZXhlc1tpXSA9IHRoaXMuX2VuZEluZGV4ZXNbaV07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IEZvbGRpbmdSZWdpb25zKHN0YXJ0SW5kZXhlcywgZW5kSW5kZXhlcywgdGhpcy5fdHlwZXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9mb2xkaW5nUmFuZ2VzTGltaXQudXBkYXRlKHRoaXMuX2xlbmd0aCwgbGltaXQpO1xuXG5cdFx0XHRsZXQgZW50cmllcyA9IDA7XG5cdFx0XHRsZXQgbWF4TGV2ZWwgPSB0aGlzLl9uZXN0aW5nTGV2ZWxDb3VudHMubGVuZ3RoO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9uZXN0aW5nTGV2ZWxDb3VudHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbiA9IHRoaXMuX25lc3RpbmdMZXZlbENvdW50c1tpXTtcblx0XHRcdFx0aWYgKG4pIHtcblx0XHRcdFx0XHRpZiAobiArIGVudHJpZXMgPiBsaW1pdCkge1xuXHRcdFx0XHRcdFx0bWF4TGV2ZWwgPSBpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVudHJpZXMgKz0gbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdGFydEluZGV4ZXMgPSBuZXcgVWludDMyQXJyYXkobGltaXQpO1xuXHRcdFx0Y29uc3QgZW5kSW5kZXhlcyA9IG5ldyBVaW50MzJBcnJheShsaW1pdCk7XG5cdFx0XHRjb25zdCB0eXBlczogQXJyYXk8c3RyaW5nIHwgdW5kZWZpbmVkPiA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGsgPSAwOyBpIDwgdGhpcy5fbGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbGV2ZWwgPSB0aGlzLl9uZXN0aW5nTGV2ZWxzW2ldO1xuXHRcdFx0XHRpZiAobGV2ZWwgPCBtYXhMZXZlbCB8fCAobGV2ZWwgPT09IG1heExldmVsICYmIGVudHJpZXMrKyA8IGxpbWl0KSkge1xuXHRcdFx0XHRcdHN0YXJ0SW5kZXhlc1trXSA9IHRoaXMuX3N0YXJ0SW5kZXhlc1tpXTtcblx0XHRcdFx0XHRlbmRJbmRleGVzW2tdID0gdGhpcy5fZW5kSW5kZXhlc1tpXTtcblx0XHRcdFx0XHR0eXBlc1trXSA9IHRoaXMuX3R5cGVzW2ldO1xuXHRcdFx0XHRcdGsrKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBGb2xkaW5nUmVnaW9ucyhzdGFydEluZGV4ZXMsIGVuZEluZGV4ZXMsIHR5cGVzKTtcblx0XHR9XG5cblx0fVxuXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZVJhbmdlcyhyYW5nZURhdGE6IElGb2xkaW5nUmFuZ2VEYXRhW10sIGZvbGRpbmdSYW5nZXNMaW1pdDogRm9sZGluZ0xpbWl0UmVwb3J0ZXIpOiBGb2xkaW5nUmVnaW9ucyB7XG5cdGNvbnN0IHNvcnRlZCA9IHJhbmdlRGF0YS5zb3J0KChkMSwgZDIpID0+IHtcblx0XHRsZXQgZGlmZiA9IGQxLnN0YXJ0IC0gZDIuc3RhcnQ7XG5cdFx0aWYgKGRpZmYgPT09IDApIHtcblx0XHRcdGRpZmYgPSBkMS5yYW5rIC0gZDIucmFuaztcblx0XHR9XG5cdFx0cmV0dXJuIGRpZmY7XG5cdH0pO1xuXHRjb25zdCBjb2xsZWN0b3IgPSBuZXcgUmFuZ2VzQ29sbGVjdG9yKGZvbGRpbmdSYW5nZXNMaW1pdCk7XG5cblx0bGV0IHRvcDogSUZvbGRpbmdSYW5nZURhdGEgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGNvbnN0IHByZXZpb3VzOiBJRm9sZGluZ1JhbmdlRGF0YVtdID0gW107XG5cdGZvciAoY29uc3QgZW50cnkgb2Ygc29ydGVkKSB7XG5cdFx0aWYgKCF0b3ApIHtcblx0XHRcdHRvcCA9IGVudHJ5O1xuXHRcdFx0Y29sbGVjdG9yLmFkZChlbnRyeS5zdGFydCwgZW50cnkuZW5kLCBlbnRyeS5raW5kICYmIGVudHJ5LmtpbmQudmFsdWUsIHByZXZpb3VzLmxlbmd0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChlbnRyeS5zdGFydCA+IHRvcC5zdGFydCkge1xuXHRcdFx0XHRpZiAoZW50cnkuZW5kIDw9IHRvcC5lbmQpIHtcblx0XHRcdFx0XHRwcmV2aW91cy5wdXNoKHRvcCk7XG5cdFx0XHRcdFx0dG9wID0gZW50cnk7XG5cdFx0XHRcdFx0Y29sbGVjdG9yLmFkZChlbnRyeS5zdGFydCwgZW50cnkuZW5kLCBlbnRyeS5raW5kICYmIGVudHJ5LmtpbmQudmFsdWUsIHByZXZpb3VzLmxlbmd0aCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGVudHJ5LnN0YXJ0ID4gdG9wLmVuZCkge1xuXHRcdFx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdFx0XHR0b3AgPSBwcmV2aW91cy5wb3AoKTtcblx0XHRcdFx0XHRcdH0gd2hpbGUgKHRvcCAmJiBlbnRyeS5zdGFydCA+IHRvcC5lbmQpO1xuXHRcdFx0XHRcdFx0aWYgKHRvcCkge1xuXHRcdFx0XHRcdFx0XHRwcmV2aW91cy5wdXNoKHRvcCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0b3AgPSBlbnRyeTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29sbGVjdG9yLmFkZChlbnRyeS5zdGFydCwgZW50cnkuZW5kLCBlbnRyeS5raW5kICYmIGVudHJ5LmtpbmQudmFsdWUsIHByZXZpb3VzLmxlbmd0aCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGNvbGxlY3Rvci50b0luZGVudFJhbmdlcygpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyx1QkFBdUI7QUFJaEMsU0FBUyxnQkFBZ0IsdUJBQXVCO0FBTWhELE1BQU0saUJBQWlDLENBQ3ZDO0FBRUEsTUFBTSxxQkFBcUI7QUFFcEIsTUFBTSxvQkFBNkM7QUFBQSxFQU16RCxZQUNrQixhQUNBLFdBQ1IsMkJBQ1Esb0JBQ0EsdUJBQ2hCO0FBTGdCO0FBQ0E7QUFDUjtBQUNRO0FBQ0E7QUFUbEIsU0FBUyxLQUFLO0FBV2IsU0FBSyxjQUFjLElBQUksZ0JBQWdCO0FBQ3ZDLFFBQUksdUJBQXVCO0FBQzFCLFdBQUssWUFBWSxJQUFJLHFCQUFxQjtBQUFBLElBQzNDO0FBRUEsZUFBVyxZQUFZLFdBQVc7QUFDakMsVUFBSSxPQUFPLFNBQVMsZ0JBQWdCLFlBQVk7QUFDL0MsYUFBSyxZQUFZLElBQUksU0FBUyxZQUFZLHlCQUF5QixDQUFDO0FBQUEsTUFDckU7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVB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
