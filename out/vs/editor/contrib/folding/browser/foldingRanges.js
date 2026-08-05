var FoldSource = /* @__PURE__ */ ((FoldSource2) => {
  FoldSource2[FoldSource2["provider"] = 0] = "provider";
  FoldSource2[FoldSource2["userDefined"] = 1] = "userDefined";
  FoldSource2[FoldSource2["recovered"] = 2] = "recovered";
  return FoldSource2;
})(FoldSource || {});
const foldSourceAbbr = {
  [0 /* provider */]: " ",
  [1 /* userDefined */]: "u",
  [2 /* recovered */]: "r"
};
const MAX_FOLDING_REGIONS = 65535;
const MAX_LINE_NUMBER = 16777215;
const MASK_INDENT = 4278190080;
class BitField {
  constructor(size) {
    const numWords = Math.ceil(size / 32);
    this._states = new Uint32Array(numWords);
  }
  get(index) {
    const arrayIndex = index / 32 | 0;
    const bit = index % 32;
    return (this._states[arrayIndex] & 1 << bit) !== 0;
  }
  set(index, newState) {
    const arrayIndex = index / 32 | 0;
    const bit = index % 32;
    const value = this._states[arrayIndex];
    if (newState) {
      this._states[arrayIndex] = value | 1 << bit;
    } else {
      this._states[arrayIndex] = value & ~(1 << bit);
    }
  }
}
class FoldingRegions {
  constructor(startIndexes, endIndexes, types) {
    if (startIndexes.length !== endIndexes.length || startIndexes.length > MAX_FOLDING_REGIONS) {
      throw new Error("invalid startIndexes or endIndexes size");
    }
    this._startIndexes = startIndexes;
    this._endIndexes = endIndexes;
    this._collapseStates = new BitField(startIndexes.length);
    this._userDefinedStates = new BitField(startIndexes.length);
    this._recoveredStates = new BitField(startIndexes.length);
    this._types = types;
    this._parentsComputed = false;
  }
  ensureParentIndices() {
    if (!this._parentsComputed) {
      this._parentsComputed = true;
      const parentIndexes = [];
      const isInsideLast = (startLineNumber, endLineNumber) => {
        const index = parentIndexes[parentIndexes.length - 1];
        return this.getStartLineNumber(index) <= startLineNumber && this.getEndLineNumber(index) >= endLineNumber;
      };
      for (let i = 0, len = this._startIndexes.length; i < len; i++) {
        const startLineNumber = this._startIndexes[i];
        const endLineNumber = this._endIndexes[i];
        if (startLineNumber > MAX_LINE_NUMBER || endLineNumber > MAX_LINE_NUMBER) {
          throw new Error("startLineNumber or endLineNumber must not exceed " + MAX_LINE_NUMBER);
        }
        while (parentIndexes.length > 0 && !isInsideLast(startLineNumber, endLineNumber)) {
          parentIndexes.pop();
        }
        const parentIndex = parentIndexes.length > 0 ? parentIndexes[parentIndexes.length - 1] : -1;
        parentIndexes.push(i);
        this._startIndexes[i] = startLineNumber + ((parentIndex & 255) << 24);
        this._endIndexes[i] = endLineNumber + ((parentIndex & 65280) << 16);
      }
    }
  }
  get length() {
    return this._startIndexes.length;
  }
  getStartLineNumber(index) {
    return this._startIndexes[index] & MAX_LINE_NUMBER;
  }
  getEndLineNumber(index) {
    return this._endIndexes[index] & MAX_LINE_NUMBER;
  }
  getType(index) {
    return this._types ? this._types[index] : void 0;
  }
  hasTypes() {
    return !!this._types;
  }
  isCollapsed(index) {
    return this._collapseStates.get(index);
  }
  setCollapsed(index, newState) {
    this._collapseStates.set(index, newState);
  }
  isUserDefined(index) {
    return this._userDefinedStates.get(index);
  }
  setUserDefined(index, newState) {
    return this._userDefinedStates.set(index, newState);
  }
  isRecovered(index) {
    return this._recoveredStates.get(index);
  }
  setRecovered(index, newState) {
    return this._recoveredStates.set(index, newState);
  }
  getSource(index) {
    if (this.isUserDefined(index)) {
      return 1 /* userDefined */;
    } else if (this.isRecovered(index)) {
      return 2 /* recovered */;
    }
    return 0 /* provider */;
  }
  setSource(index, source) {
    if (source === 1 /* userDefined */) {
      this.setUserDefined(index, true);
      this.setRecovered(index, false);
    } else if (source === 2 /* recovered */) {
      this.setUserDefined(index, false);
      this.setRecovered(index, true);
    } else {
      this.setUserDefined(index, false);
      this.setRecovered(index, false);
    }
  }
  setCollapsedAllOfType(type, newState) {
    let hasChanged = false;
    if (this._types) {
      for (let i = 0; i < this._types.length; i++) {
        if (this._types[i] === type) {
          this.setCollapsed(i, newState);
          hasChanged = true;
        }
      }
    }
    return hasChanged;
  }
  toRegion(index) {
    return new FoldingRegion(this, index);
  }
  getParentIndex(index) {
    this.ensureParentIndices();
    const parent = ((this._startIndexes[index] & MASK_INDENT) >>> 24) + ((this._endIndexes[index] & MASK_INDENT) >>> 16);
    if (parent === MAX_FOLDING_REGIONS) {
      return -1;
    }
    return parent;
  }
  contains(index, line) {
    return this.getStartLineNumber(index) <= line && this.getEndLineNumber(index) >= line;
  }
  findIndex(line) {
    let low = 0, high = this._startIndexes.length;
    if (high === 0) {
      return -1;
    }
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (line < this.getStartLineNumber(mid)) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    return low - 1;
  }
  findRange(line) {
    let index = this.findIndex(line);
    if (index >= 0) {
      const endLineNumber = this.getEndLineNumber(index);
      if (endLineNumber >= line) {
        return index;
      }
      index = this.getParentIndex(index);
      while (index !== -1) {
        if (this.contains(index, line)) {
          return index;
        }
        index = this.getParentIndex(index);
      }
    }
    return -1;
  }
  toString() {
    const res = [];
    for (let i = 0; i < this.length; i++) {
      res[i] = `[${foldSourceAbbr[this.getSource(i)]}${this.isCollapsed(i) ? "+" : "-"}] ${this.getStartLineNumber(i)}/${this.getEndLineNumber(i)}`;
    }
    return res.join(", ");
  }
  toFoldRange(index) {
    return {
      startLineNumber: this._startIndexes[index] & MAX_LINE_NUMBER,
      endLineNumber: this._endIndexes[index] & MAX_LINE_NUMBER,
      type: this._types ? this._types[index] : void 0,
      isCollapsed: this.isCollapsed(index),
      source: this.getSource(index)
    };
  }
  static fromFoldRanges(ranges) {
    const rangesLength = ranges.length;
    const startIndexes = new Uint32Array(rangesLength);
    const endIndexes = new Uint32Array(rangesLength);
    let types = [];
    let gotTypes = false;
    for (let i = 0; i < rangesLength; i++) {
      const range = ranges[i];
      startIndexes[i] = range.startLineNumber;
      endIndexes[i] = range.endLineNumber;
      types.push(range.type);
      if (range.type) {
        gotTypes = true;
      }
    }
    if (!gotTypes) {
      types = void 0;
    }
    const regions = new FoldingRegions(startIndexes, endIndexes, types);
    for (let i = 0; i < rangesLength; i++) {
      if (ranges[i].isCollapsed) {
        regions.setCollapsed(i, true);
      }
      regions.setSource(i, ranges[i].source);
    }
    return regions;
  }
  /**
   * Two inputs, each a FoldingRegions or a FoldRange[], are merged.
   * Each input must be pre-sorted on startLineNumber.
   * The first list is assumed to always include all regions currently defined by range providers.
   * The second list only contains the previously collapsed and all manual ranges.
   * If the line position matches, the range of the new range is taken, and the range is no longer manual
   * When an entry in one list overlaps an entry in the other, the second list's entry "wins" and
   * overlapping entries in the first list are discarded.
   * Invalid entries are discarded. An entry is invalid if:
   * 		the start and end line numbers aren't a valid range of line numbers,
   * 		it is out of sequence or has the same start line as a preceding entry,
   * 		it overlaps a preceding entry and is not fully contained by that entry.
   */
  static sanitizeAndMerge(rangesA, rangesB, maxLineNumber, selection) {
    maxLineNumber = maxLineNumber ?? Number.MAX_VALUE;
    const getIndexedFunction = (r, limit) => {
      return Array.isArray(r) ? (i) => {
        return i < limit ? r[i] : void 0;
      } : (i) => {
        return i < limit ? r.toFoldRange(i) : void 0;
      };
    };
    const getA = getIndexedFunction(rangesA, rangesA.length);
    const getB = getIndexedFunction(rangesB, rangesB.length);
    let indexA = 0;
    let indexB = 0;
    let nextA = getA(0);
    let nextB = getB(0);
    const stackedRanges = [];
    let topStackedRange;
    let prevLineNumber = 0;
    const resultRanges = [];
    while (nextA || nextB) {
      let useRange = void 0;
      if (nextB && (!nextA || nextA.startLineNumber >= nextB.startLineNumber)) {
        if (nextA && nextA.startLineNumber === nextB.startLineNumber) {
          if (nextB.source === 1 /* userDefined */) {
            useRange = nextB;
          } else {
            useRange = nextA;
            useRange.isCollapsed = nextB.isCollapsed && (nextA.endLineNumber === nextB.endLineNumber || !selection?.startsInside(nextA.startLineNumber + 1, nextA.endLineNumber + 1));
            useRange.source = 0 /* provider */;
          }
          nextA = getA(++indexA);
        } else {
          useRange = nextB;
          if (nextB.isCollapsed && nextB.source === 0 /* provider */) {
            useRange.source = 2 /* recovered */;
          }
        }
        nextB = getB(++indexB);
      } else {
        let scanIndex = indexB;
        let prescanB = nextB;
        while (true) {
          if (!prescanB || prescanB.startLineNumber > nextA.endLineNumber) {
            useRange = nextA;
            break;
          }
          if (prescanB.source === 1 /* userDefined */ && prescanB.endLineNumber > nextA.endLineNumber) {
            break;
          }
          prescanB = getB(++scanIndex);
        }
        nextA = getA(++indexA);
      }
      if (useRange) {
        while (topStackedRange && topStackedRange.endLineNumber < useRange.startLineNumber) {
          topStackedRange = stackedRanges.pop();
        }
        if (useRange.endLineNumber > useRange.startLineNumber && useRange.startLineNumber > prevLineNumber && useRange.endLineNumber <= maxLineNumber && (!topStackedRange || topStackedRange.endLineNumber >= useRange.endLineNumber)) {
          resultRanges.push(useRange);
          prevLineNumber = useRange.startLineNumber;
          if (topStackedRange) {
            stackedRanges.push(topStackedRange);
          }
          topStackedRange = useRange;
        }
      }
    }
    return resultRanges;
  }
}
class FoldingRegion {
  constructor(ranges, index) {
    this.ranges = ranges;
    this.index = index;
  }
  get startLineNumber() {
    return this.ranges.getStartLineNumber(this.index);
  }
  get endLineNumber() {
    return this.ranges.getEndLineNumber(this.index);
  }
  get regionIndex() {
    return this.index;
  }
  get parentIndex() {
    return this.ranges.getParentIndex(this.index);
  }
  get isCollapsed() {
    return this.ranges.isCollapsed(this.index);
  }
  containedBy(range) {
    return range.startLineNumber <= this.startLineNumber && range.endLineNumber >= this.endLineNumber;
  }
  containsLine(lineNumber) {
    return this.startLineNumber <= lineNumber && lineNumber <= this.endLineNumber;
  }
  hidesLine(lineNumber) {
    return this.startLineNumber < lineNumber && lineNumber <= this.endLineNumber;
  }
}
export {
  FoldSource,
  FoldingRegion,
  FoldingRegions,
  MAX_FOLDING_REGIONS,
  MAX_LINE_NUMBER,
  foldSourceAbbr
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9mb2xkaW5nL2Jyb3dzZXIvZm9sZGluZ1Jhbmdlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFNlbGVjdGVkTGluZXMgfSBmcm9tICcuL2ZvbGRpbmcuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElMaW5lUmFuZ2Uge1xuXHRzdGFydExpbmVOdW1iZXI6IG51bWJlcjtcblx0ZW5kTGluZU51bWJlcjogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBGb2xkU291cmNlIHtcblx0cHJvdmlkZXIgPSAwLFxuXHR1c2VyRGVmaW5lZCA9IDEsXG5cdHJlY292ZXJlZCA9IDJcbn1cblxuZXhwb3J0IGNvbnN0IGZvbGRTb3VyY2VBYmJyID0ge1xuXHRbRm9sZFNvdXJjZS5wcm92aWRlcl06ICcgJyxcblx0W0ZvbGRTb3VyY2UudXNlckRlZmluZWRdOiAndScsXG5cdFtGb2xkU291cmNlLnJlY292ZXJlZF06ICdyJyxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgRm9sZFJhbmdlIHtcblx0c3RhcnRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdGVuZExpbmVOdW1iZXI6IG51bWJlcjtcblx0dHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRpc0NvbGxhcHNlZDogYm9vbGVhbjtcblx0c291cmNlOiBGb2xkU291cmNlO1xufVxuXG5leHBvcnQgY29uc3QgTUFYX0ZPTERJTkdfUkVHSU9OUyA9IDB4RkZGRjtcbmV4cG9ydCBjb25zdCBNQVhfTElORV9OVU1CRVIgPSAweEZGRkZGRjtcblxuY29uc3QgTUFTS19JTkRFTlQgPSAweEZGMDAwMDAwO1xuXG5jbGFzcyBCaXRGaWVsZCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlczogVWludDMyQXJyYXk7XG5cdGNvbnN0cnVjdG9yKHNpemU6IG51bWJlcikge1xuXHRcdGNvbnN0IG51bVdvcmRzID0gTWF0aC5jZWlsKHNpemUgLyAzMik7XG5cdFx0dGhpcy5fc3RhdGVzID0gbmV3IFVpbnQzMkFycmF5KG51bVdvcmRzKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGFycmF5SW5kZXggPSAoaW5kZXggLyAzMikgfCAwO1xuXHRcdGNvbnN0IGJpdCA9IGluZGV4ICUgMzI7XG5cdFx0cmV0dXJuICh0aGlzLl9zdGF0ZXNbYXJyYXlJbmRleF0gJiAoMSA8PCBiaXQpKSAhPT0gMDtcblx0fVxuXG5cdHB1YmxpYyBzZXQoaW5kZXg6IG51bWJlciwgbmV3U3RhdGU6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBhcnJheUluZGV4ID0gKGluZGV4IC8gMzIpIHwgMDtcblx0XHRjb25zdCBiaXQgPSBpbmRleCAlIDMyO1xuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5fc3RhdGVzW2FycmF5SW5kZXhdO1xuXHRcdGlmIChuZXdTdGF0ZSkge1xuXHRcdFx0dGhpcy5fc3RhdGVzW2FycmF5SW5kZXhdID0gdmFsdWUgfCAoMSA8PCBiaXQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zdGF0ZXNbYXJyYXlJbmRleF0gPSB2YWx1ZSAmIH4oMSA8PCBiaXQpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRm9sZGluZ1JlZ2lvbnMge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFydEluZGV4ZXM6IFVpbnQzMkFycmF5O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lbmRJbmRleGVzOiBVaW50MzJBcnJheTtcblx0cHJpdmF0ZSByZWFkb25seSBfY29sbGFwc2VTdGF0ZXM6IEJpdEZpZWxkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF91c2VyRGVmaW5lZFN0YXRlczogQml0RmllbGQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlY292ZXJlZFN0YXRlczogQml0RmllbGQ7XG5cblx0cHJpdmF0ZSBfcGFyZW50c0NvbXB1dGVkOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90eXBlczogQXJyYXk8c3RyaW5nIHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihzdGFydEluZGV4ZXM6IFVpbnQzMkFycmF5LCBlbmRJbmRleGVzOiBVaW50MzJBcnJheSwgdHlwZXM/OiBBcnJheTxzdHJpbmcgfCB1bmRlZmluZWQ+KSB7XG5cdFx0aWYgKHN0YXJ0SW5kZXhlcy5sZW5ndGggIT09IGVuZEluZGV4ZXMubGVuZ3RoIHx8IHN0YXJ0SW5kZXhlcy5sZW5ndGggPiBNQVhfRk9MRElOR19SRUdJT05TKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc3RhcnRJbmRleGVzIG9yIGVuZEluZGV4ZXMgc2l6ZScpO1xuXHRcdH1cblx0XHR0aGlzLl9zdGFydEluZGV4ZXMgPSBzdGFydEluZGV4ZXM7XG5cdFx0dGhpcy5fZW5kSW5kZXhlcyA9IGVuZEluZGV4ZXM7XG5cdFx0dGhpcy5fY29sbGFwc2VTdGF0ZXMgPSBuZXcgQml0RmllbGQoc3RhcnRJbmRleGVzLmxlbmd0aCk7XG5cdFx0dGhpcy5fdXNlckRlZmluZWRTdGF0ZXMgPSBuZXcgQml0RmllbGQoc3RhcnRJbmRleGVzLmxlbmd0aCk7XG5cdFx0dGhpcy5fcmVjb3ZlcmVkU3RhdGVzID0gbmV3IEJpdEZpZWxkKHN0YXJ0SW5kZXhlcy5sZW5ndGgpO1xuXHRcdHRoaXMuX3R5cGVzID0gdHlwZXM7XG5cdFx0dGhpcy5fcGFyZW50c0NvbXB1dGVkID0gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZVBhcmVudEluZGljZXMoKSB7XG5cdFx0aWYgKCF0aGlzLl9wYXJlbnRzQ29tcHV0ZWQpIHtcblx0XHRcdHRoaXMuX3BhcmVudHNDb21wdXRlZCA9IHRydWU7XG5cdFx0XHRjb25zdCBwYXJlbnRJbmRleGVzOiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgaXNJbnNpZGVMYXN0ID0gKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5kZXggPSBwYXJlbnRJbmRleGVzW3BhcmVudEluZGV4ZXMubGVuZ3RoIC0gMV07XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFN0YXJ0TGluZU51bWJlcihpbmRleCkgPD0gc3RhcnRMaW5lTnVtYmVyICYmIHRoaXMuZ2V0RW5kTGluZU51bWJlcihpbmRleCkgPj0gZW5kTGluZU51bWJlcjtcblx0XHRcdH07XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fc3RhcnRJbmRleGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHRoaXMuX3N0YXJ0SW5kZXhlc1tpXTtcblx0XHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuX2VuZEluZGV4ZXNbaV07XG5cdFx0XHRcdGlmIChzdGFydExpbmVOdW1iZXIgPiBNQVhfTElORV9OVU1CRVIgfHwgZW5kTGluZU51bWJlciA+IE1BWF9MSU5FX05VTUJFUikge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignc3RhcnRMaW5lTnVtYmVyIG9yIGVuZExpbmVOdW1iZXIgbXVzdCBub3QgZXhjZWVkICcgKyBNQVhfTElORV9OVU1CRVIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlIChwYXJlbnRJbmRleGVzLmxlbmd0aCA+IDAgJiYgIWlzSW5zaWRlTGFzdChzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdFx0cGFyZW50SW5kZXhlcy5wb3AoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBwYXJlbnRJbmRleCA9IHBhcmVudEluZGV4ZXMubGVuZ3RoID4gMCA/IHBhcmVudEluZGV4ZXNbcGFyZW50SW5kZXhlcy5sZW5ndGggLSAxXSA6IC0xO1xuXHRcdFx0XHRwYXJlbnRJbmRleGVzLnB1c2goaSk7XG5cdFx0XHRcdHRoaXMuX3N0YXJ0SW5kZXhlc1tpXSA9IHN0YXJ0TGluZU51bWJlciArICgocGFyZW50SW5kZXggJiAweEZGKSA8PCAyNCk7XG5cdFx0XHRcdHRoaXMuX2VuZEluZGV4ZXNbaV0gPSBlbmRMaW5lTnVtYmVyICsgKChwYXJlbnRJbmRleCAmIDB4RkYwMCkgPDwgMTYpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXQgbGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXJ0SW5kZXhlcy5sZW5ndGg7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U3RhcnRMaW5lTnVtYmVyKGluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9zdGFydEluZGV4ZXNbaW5kZXhdICYgTUFYX0xJTkVfTlVNQkVSO1xuXHR9XG5cblx0cHVibGljIGdldEVuZExpbmVOdW1iZXIoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2VuZEluZGV4ZXNbaW5kZXhdICYgTUFYX0xJTkVfTlVNQkVSO1xuXHR9XG5cblx0cHVibGljIGdldFR5cGUoaW5kZXg6IG51bWJlcik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3R5cGVzID8gdGhpcy5fdHlwZXNbaW5kZXhdIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGhhc1R5cGVzKCkge1xuXHRcdHJldHVybiAhIXRoaXMuX3R5cGVzO1xuXHR9XG5cblx0cHVibGljIGlzQ29sbGFwc2VkKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29sbGFwc2VTdGF0ZXMuZ2V0KGluZGV4KTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDb2xsYXBzZWQoaW5kZXg6IG51bWJlciwgbmV3U3RhdGU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9jb2xsYXBzZVN0YXRlcy5zZXQoaW5kZXgsIG5ld1N0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgaXNVc2VyRGVmaW5lZChpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VzZXJEZWZpbmVkU3RhdGVzLmdldChpbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIHNldFVzZXJEZWZpbmVkKGluZGV4OiBudW1iZXIsIG5ld1N0YXRlOiBib29sZWFuKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VzZXJEZWZpbmVkU3RhdGVzLnNldChpbmRleCwgbmV3U3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1JlY292ZXJlZChpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlY292ZXJlZFN0YXRlcy5nZXQoaW5kZXgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRSZWNvdmVyZWQoaW5kZXg6IG51bWJlciwgbmV3U3RhdGU6IGJvb2xlYW4pIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVjb3ZlcmVkU3RhdGVzLnNldChpbmRleCwgbmV3U3RhdGUpO1xuXHR9XG5cblx0cHVibGljIGdldFNvdXJjZShpbmRleDogbnVtYmVyKTogRm9sZFNvdXJjZSB7XG5cdFx0aWYgKHRoaXMuaXNVc2VyRGVmaW5lZChpbmRleCkpIHtcblx0XHRcdHJldHVybiBGb2xkU291cmNlLnVzZXJEZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pc1JlY292ZXJlZChpbmRleCkpIHtcblx0XHRcdHJldHVybiBGb2xkU291cmNlLnJlY292ZXJlZDtcblx0XHR9XG5cdFx0cmV0dXJuIEZvbGRTb3VyY2UucHJvdmlkZXI7XG5cdH1cblxuXHRwdWJsaWMgc2V0U291cmNlKGluZGV4OiBudW1iZXIsIHNvdXJjZTogRm9sZFNvdXJjZSk6IHZvaWQge1xuXHRcdGlmIChzb3VyY2UgPT09IEZvbGRTb3VyY2UudXNlckRlZmluZWQpIHtcblx0XHRcdHRoaXMuc2V0VXNlckRlZmluZWQoaW5kZXgsIHRydWUpO1xuXHRcdFx0dGhpcy5zZXRSZWNvdmVyZWQoaW5kZXgsIGZhbHNlKTtcblx0XHR9IGVsc2UgaWYgKHNvdXJjZSA9PT0gRm9sZFNvdXJjZS5yZWNvdmVyZWQpIHtcblx0XHRcdHRoaXMuc2V0VXNlckRlZmluZWQoaW5kZXgsIGZhbHNlKTtcblx0XHRcdHRoaXMuc2V0UmVjb3ZlcmVkKGluZGV4LCB0cnVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXRVc2VyRGVmaW5lZChpbmRleCwgZmFsc2UpO1xuXHRcdFx0dGhpcy5zZXRSZWNvdmVyZWQoaW5kZXgsIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2V0Q29sbGFwc2VkQWxsT2ZUeXBlKHR5cGU6IHN0cmluZywgbmV3U3RhdGU6IGJvb2xlYW4pIHtcblx0XHRsZXQgaGFzQ2hhbmdlZCA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLl90eXBlcykge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl90eXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodGhpcy5fdHlwZXNbaV0gPT09IHR5cGUpIHtcblx0XHRcdFx0XHR0aGlzLnNldENvbGxhcHNlZChpLCBuZXdTdGF0ZSk7XG5cdFx0XHRcdFx0aGFzQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGhhc0NoYW5nZWQ7XG5cdH1cblxuXHRwdWJsaWMgdG9SZWdpb24oaW5kZXg6IG51bWJlcik6IEZvbGRpbmdSZWdpb24ge1xuXHRcdHJldHVybiBuZXcgRm9sZGluZ1JlZ2lvbih0aGlzLCBpbmRleCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UGFyZW50SW5kZXgoaW5kZXg6IG51bWJlcikge1xuXHRcdHRoaXMuZW5zdXJlUGFyZW50SW5kaWNlcygpO1xuXHRcdGNvbnN0IHBhcmVudCA9ICgodGhpcy5fc3RhcnRJbmRleGVzW2luZGV4XSAmIE1BU0tfSU5ERU5UKSA+Pj4gMjQpICsgKCh0aGlzLl9lbmRJbmRleGVzW2luZGV4XSAmIE1BU0tfSU5ERU5UKSA+Pj4gMTYpO1xuXHRcdGlmIChwYXJlbnQgPT09IE1BWF9GT0xESU5HX1JFR0lPTlMpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIHBhcmVudDtcblx0fVxuXG5cdHB1YmxpYyBjb250YWlucyhpbmRleDogbnVtYmVyLCBsaW5lOiBudW1iZXIpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTdGFydExpbmVOdW1iZXIoaW5kZXgpIDw9IGxpbmUgJiYgdGhpcy5nZXRFbmRMaW5lTnVtYmVyKGluZGV4KSA+PSBsaW5lO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kSW5kZXgobGluZTogbnVtYmVyKSB7XG5cdFx0bGV0IGxvdyA9IDAsIGhpZ2ggPSB0aGlzLl9zdGFydEluZGV4ZXMubGVuZ3RoO1xuXHRcdGlmIChoaWdoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gLTE7IC8vIG5vIGNoaWxkcmVuXG5cdFx0fVxuXHRcdHdoaWxlIChsb3cgPCBoaWdoKSB7XG5cdFx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsb3cgKyBoaWdoKSAvIDIpO1xuXHRcdFx0aWYgKGxpbmUgPCB0aGlzLmdldFN0YXJ0TGluZU51bWJlcihtaWQpKSB7XG5cdFx0XHRcdGhpZ2ggPSBtaWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsb3cgPSBtaWQgKyAxO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbG93IC0gMTtcblx0fVxuXG5cdHB1YmxpYyBmaW5kUmFuZ2UobGluZTogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRsZXQgaW5kZXggPSB0aGlzLmZpbmRJbmRleChsaW5lKTtcblx0XHRpZiAoaW5kZXggPj0gMCkge1xuXHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuZ2V0RW5kTGluZU51bWJlcihpbmRleCk7XG5cdFx0XHRpZiAoZW5kTGluZU51bWJlciA+PSBsaW5lKSB7XG5cdFx0XHRcdHJldHVybiBpbmRleDtcblx0XHRcdH1cblx0XHRcdGluZGV4ID0gdGhpcy5nZXRQYXJlbnRJbmRleChpbmRleCk7XG5cdFx0XHR3aGlsZSAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdGlmICh0aGlzLmNvbnRhaW5zKGluZGV4LCBsaW5lKSkge1xuXHRcdFx0XHRcdHJldHVybiBpbmRleDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbmRleCA9IHRoaXMuZ2V0UGFyZW50SW5kZXgoaW5kZXgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gLTE7XG5cdH1cblxuXG5cdHB1YmxpYyB0b1N0cmluZygpIHtcblx0XHRjb25zdCByZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRyZXNbaV0gPSBgWyR7Zm9sZFNvdXJjZUFiYnJbdGhpcy5nZXRTb3VyY2UoaSldfSR7dGhpcy5pc0NvbGxhcHNlZChpKSA/ICcrJyA6ICctJ31dICR7dGhpcy5nZXRTdGFydExpbmVOdW1iZXIoaSl9LyR7dGhpcy5nZXRFbmRMaW5lTnVtYmVyKGkpfWA7XG5cdFx0fVxuXHRcdHJldHVybiByZXMuam9pbignLCAnKTtcblx0fVxuXG5cdHB1YmxpYyB0b0ZvbGRSYW5nZShpbmRleDogbnVtYmVyKTogRm9sZFJhbmdlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiB0aGlzLl9zdGFydEluZGV4ZXNbaW5kZXhdICYgTUFYX0xJTkVfTlVNQkVSLFxuXHRcdFx0ZW5kTGluZU51bWJlcjogdGhpcy5fZW5kSW5kZXhlc1tpbmRleF0gJiBNQVhfTElORV9OVU1CRVIsXG5cdFx0XHR0eXBlOiB0aGlzLl90eXBlcyA/IHRoaXMuX3R5cGVzW2luZGV4XSA6IHVuZGVmaW5lZCxcblx0XHRcdGlzQ29sbGFwc2VkOiB0aGlzLmlzQ29sbGFwc2VkKGluZGV4KSxcblx0XHRcdHNvdXJjZTogdGhpcy5nZXRTb3VyY2UoaW5kZXgpXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZnJvbUZvbGRSYW5nZXMocmFuZ2VzOiBGb2xkUmFuZ2VbXSk6IEZvbGRpbmdSZWdpb25zIHtcblx0XHRjb25zdCByYW5nZXNMZW5ndGggPSByYW5nZXMubGVuZ3RoO1xuXHRcdGNvbnN0IHN0YXJ0SW5kZXhlcyA9IG5ldyBVaW50MzJBcnJheShyYW5nZXNMZW5ndGgpO1xuXHRcdGNvbnN0IGVuZEluZGV4ZXMgPSBuZXcgVWludDMyQXJyYXkocmFuZ2VzTGVuZ3RoKTtcblx0XHRsZXQgdHlwZXM6IEFycmF5PHN0cmluZyB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQgPSBbXTtcblx0XHRsZXQgZ290VHlwZXMgPSBmYWxzZTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJhbmdlc0xlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IHJhbmdlc1tpXTtcblx0XHRcdHN0YXJ0SW5kZXhlc1tpXSA9IHJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGVuZEluZGV4ZXNbaV0gPSByYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0dHlwZXMucHVzaChyYW5nZS50eXBlKTtcblx0XHRcdGlmIChyYW5nZS50eXBlKSB7XG5cdFx0XHRcdGdvdFR5cGVzID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCFnb3RUeXBlcykge1xuXHRcdFx0dHlwZXMgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJlZ2lvbnMgPSBuZXcgRm9sZGluZ1JlZ2lvbnMoc3RhcnRJbmRleGVzLCBlbmRJbmRleGVzLCB0eXBlcyk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByYW5nZXNMZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKHJhbmdlc1tpXS5pc0NvbGxhcHNlZCkge1xuXHRcdFx0XHRyZWdpb25zLnNldENvbGxhcHNlZChpLCB0cnVlKTtcblx0XHRcdH1cblx0XHRcdHJlZ2lvbnMuc2V0U291cmNlKGksIHJhbmdlc1tpXS5zb3VyY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVnaW9ucztcblx0fVxuXG5cdC8qKlxuXHQgKiBUd28gaW5wdXRzLCBlYWNoIGEgRm9sZGluZ1JlZ2lvbnMgb3IgYSBGb2xkUmFuZ2VbXSwgYXJlIG1lcmdlZC5cblx0ICogRWFjaCBpbnB1dCBtdXN0IGJlIHByZS1zb3J0ZWQgb24gc3RhcnRMaW5lTnVtYmVyLlxuXHQgKiBUaGUgZmlyc3QgbGlzdCBpcyBhc3N1bWVkIHRvIGFsd2F5cyBpbmNsdWRlIGFsbCByZWdpb25zIGN1cnJlbnRseSBkZWZpbmVkIGJ5IHJhbmdlIHByb3ZpZGVycy5cblx0ICogVGhlIHNlY29uZCBsaXN0IG9ubHkgY29udGFpbnMgdGhlIHByZXZpb3VzbHkgY29sbGFwc2VkIGFuZCBhbGwgbWFudWFsIHJhbmdlcy5cblx0ICogSWYgdGhlIGxpbmUgcG9zaXRpb24gbWF0Y2hlcywgdGhlIHJhbmdlIG9mIHRoZSBuZXcgcmFuZ2UgaXMgdGFrZW4sIGFuZCB0aGUgcmFuZ2UgaXMgbm8gbG9uZ2VyIG1hbnVhbFxuXHQgKiBXaGVuIGFuIGVudHJ5IGluIG9uZSBsaXN0IG92ZXJsYXBzIGFuIGVudHJ5IGluIHRoZSBvdGhlciwgdGhlIHNlY29uZCBsaXN0J3MgZW50cnkgXCJ3aW5zXCIgYW5kXG5cdCAqIG92ZXJsYXBwaW5nIGVudHJpZXMgaW4gdGhlIGZpcnN0IGxpc3QgYXJlIGRpc2NhcmRlZC5cblx0ICogSW52YWxpZCBlbnRyaWVzIGFyZSBkaXNjYXJkZWQuIEFuIGVudHJ5IGlzIGludmFsaWQgaWY6XG5cdCAqIFx0XHR0aGUgc3RhcnQgYW5kIGVuZCBsaW5lIG51bWJlcnMgYXJlbid0IGEgdmFsaWQgcmFuZ2Ugb2YgbGluZSBudW1iZXJzLFxuXHQgKiBcdFx0aXQgaXMgb3V0IG9mIHNlcXVlbmNlIG9yIGhhcyB0aGUgc2FtZSBzdGFydCBsaW5lIGFzIGEgcHJlY2VkaW5nIGVudHJ5LFxuXHQgKiBcdFx0aXQgb3ZlcmxhcHMgYSBwcmVjZWRpbmcgZW50cnkgYW5kIGlzIG5vdCBmdWxseSBjb250YWluZWQgYnkgdGhhdCBlbnRyeS5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgc2FuaXRpemVBbmRNZXJnZShcblx0XHRyYW5nZXNBOiBGb2xkaW5nUmVnaW9ucyB8IEZvbGRSYW5nZVtdLFxuXHRcdHJhbmdlc0I6IEZvbGRpbmdSZWdpb25zIHwgRm9sZFJhbmdlW10sXG5cdFx0bWF4TGluZU51bWJlcjogbnVtYmVyIHwgdW5kZWZpbmVkLFxuXHRcdHNlbGVjdGlvbj86IFNlbGVjdGVkTGluZXNcblx0KTogRm9sZFJhbmdlW10ge1xuXG5cdFx0bWF4TGluZU51bWJlciA9IG1heExpbmVOdW1iZXIgPz8gTnVtYmVyLk1BWF9WQUxVRTtcblxuXHRcdGNvbnN0IGdldEluZGV4ZWRGdW5jdGlvbiA9IChyOiBGb2xkaW5nUmVnaW9ucyB8IEZvbGRSYW5nZVtdLCBsaW1pdDogbnVtYmVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheShyKVxuXHRcdFx0XHQ/ICgoaTogbnVtYmVyKSA9PiB7IHJldHVybiAoaSA8IGxpbWl0KSA/IHJbaV0gOiB1bmRlZmluZWQ7IH0pXG5cdFx0XHRcdDogKChpOiBudW1iZXIpID0+IHsgcmV0dXJuIChpIDwgbGltaXQpID8gci50b0ZvbGRSYW5nZShpKSA6IHVuZGVmaW5lZDsgfSk7XG5cdFx0fTtcblx0XHRjb25zdCBnZXRBID0gZ2V0SW5kZXhlZEZ1bmN0aW9uKHJhbmdlc0EsIHJhbmdlc0EubGVuZ3RoKTtcblx0XHRjb25zdCBnZXRCID0gZ2V0SW5kZXhlZEZ1bmN0aW9uKHJhbmdlc0IsIHJhbmdlc0IubGVuZ3RoKTtcblx0XHRsZXQgaW5kZXhBID0gMDtcblx0XHRsZXQgaW5kZXhCID0gMDtcblx0XHRsZXQgbmV4dEEgPSBnZXRBKDApO1xuXHRcdGxldCBuZXh0QiA9IGdldEIoMCk7XG5cblx0XHRjb25zdCBzdGFja2VkUmFuZ2VzOiBGb2xkUmFuZ2VbXSA9IFtdO1xuXHRcdGxldCB0b3BTdGFja2VkUmFuZ2U6IEZvbGRSYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcHJldkxpbmVOdW1iZXIgPSAwO1xuXHRcdGNvbnN0IHJlc3VsdFJhbmdlczogRm9sZFJhbmdlW10gPSBbXTtcblxuXHRcdHdoaWxlIChuZXh0QSB8fCBuZXh0Qikge1xuXG5cdFx0XHRsZXQgdXNlUmFuZ2U6IEZvbGRSYW5nZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChuZXh0QiAmJiAoIW5leHRBIHx8IG5leHRBLnN0YXJ0TGluZU51bWJlciA+PSBuZXh0Qi5zdGFydExpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdGlmIChuZXh0QSAmJiBuZXh0QS5zdGFydExpbmVOdW1iZXIgPT09IG5leHRCLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdGlmIChuZXh0Qi5zb3VyY2UgPT09IEZvbGRTb3VyY2UudXNlckRlZmluZWQpIHtcblx0XHRcdFx0XHRcdC8vIGEgdXNlciBkZWZpbmVkIHJhbmdlIChwb3NzaWJseSB1bmZvbGRlZClcblx0XHRcdFx0XHRcdHVzZVJhbmdlID0gbmV4dEI7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIGEgcHJldmlvdXNseSBmb2xkZWQgcmFuZ2Ugb3IgYSAocG9zc2libHkgdW5mb2xkZWQpIHJlY292ZXJlZCByYW5nZVxuXHRcdFx0XHRcdFx0dXNlUmFuZ2UgPSBuZXh0QTtcblx0XHRcdFx0XHRcdC8vIHN0YXlzIGNvbGxhcHNlZCBpZiB0aGUgcmFuZ2Ugc3RpbGwgaGFzIHRoZSBzYW1lIG51bWJlciBvZiBsaW5lcyBvciB0aGUgc2VsZWN0aW9uIGlzIG5vdCBpbiB0aGUgcmFuZ2Ugb3IgYWZ0ZXIgaXRcblx0XHRcdFx0XHRcdHVzZVJhbmdlLmlzQ29sbGFwc2VkID0gbmV4dEIuaXNDb2xsYXBzZWQgJiYgKG5leHRBLmVuZExpbmVOdW1iZXIgPT09IG5leHRCLmVuZExpbmVOdW1iZXIgfHwgIXNlbGVjdGlvbj8uc3RhcnRzSW5zaWRlKG5leHRBLnN0YXJ0TGluZU51bWJlciArIDEsIG5leHRBLmVuZExpbmVOdW1iZXIgKyAxKSk7XG5cdFx0XHRcdFx0XHR1c2VSYW5nZS5zb3VyY2UgPSBGb2xkU291cmNlLnByb3ZpZGVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRuZXh0QSA9IGdldEEoKytpbmRleEEpOyAvLyBub3QgbmVjZXNzYXJ5LCBqdXN0IGZvciBzcGVlZFxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHVzZVJhbmdlID0gbmV4dEI7XG5cdFx0XHRcdFx0aWYgKG5leHRCLmlzQ29sbGFwc2VkICYmIG5leHRCLnNvdXJjZSA9PT0gRm9sZFNvdXJjZS5wcm92aWRlcikge1xuXHRcdFx0XHRcdFx0Ly8gYSBwcmV2aW91c2x5IGNvbGxhcHNlZCByYW5nZVxuXHRcdFx0XHRcdFx0dXNlUmFuZ2Uuc291cmNlID0gRm9sZFNvdXJjZS5yZWNvdmVyZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdG5leHRCID0gZ2V0QigrK2luZGV4Qik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBuZXh0QSBpcyBuZXh0LiBUaGUgdXNlciBmb2xkZWQgQiBzZXQgdGFrZXMgcHJlY2VkZW5jZSBhbmQgd2Ugc29tZXRpbWVzIG5lZWQgdG8gbG9va1xuXHRcdFx0XHQvLyBhaGVhZCBpbiBpdCB0byBjaGVjayBmb3IgYW4gdXBjb21pbmcgY29uZmxpY3QuXG5cdFx0XHRcdGxldCBzY2FuSW5kZXggPSBpbmRleEI7XG5cdFx0XHRcdGxldCBwcmVzY2FuQiA9IG5leHRCO1xuXHRcdFx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0XHRcdGlmICghcHJlc2NhbkIgfHwgcHJlc2NhbkIuc3RhcnRMaW5lTnVtYmVyID4gbmV4dEEhLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdHVzZVJhbmdlID0gbmV4dEE7XG5cdFx0XHRcdFx0XHRicmVhazsgLy8gbm8gY29uZmxpY3QsIHVzZSB0aGlzIG5leHRBXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChwcmVzY2FuQi5zb3VyY2UgPT09IEZvbGRTb3VyY2UudXNlckRlZmluZWQgJiYgcHJlc2NhbkIuZW5kTGluZU51bWJlciA+IG5leHRBIS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHQvLyB3ZSBmb3VuZCBhIHVzZXIgZm9sZGVkIHJhbmdlLCBpdCB3aW5zXG5cdFx0XHRcdFx0XHRicmVhazsgLy8gd2l0aG91dCBzZXR0aW5nIG5leHRSZXN1bHQsIHNvIHRoaXMgbmV4dEEgZ2V0cyBza2lwcGVkXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHByZXNjYW5CID0gZ2V0QigrK3NjYW5JbmRleCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bmV4dEEgPSBnZXRBKCsraW5kZXhBKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHVzZVJhbmdlKSB7XG5cdFx0XHRcdHdoaWxlICh0b3BTdGFja2VkUmFuZ2Vcblx0XHRcdFx0XHQmJiB0b3BTdGFja2VkUmFuZ2UuZW5kTGluZU51bWJlciA8IHVzZVJhbmdlLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdHRvcFN0YWNrZWRSYW5nZSA9IHN0YWNrZWRSYW5nZXMucG9wKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHVzZVJhbmdlLmVuZExpbmVOdW1iZXIgPiB1c2VSYW5nZS5zdGFydExpbmVOdW1iZXJcblx0XHRcdFx0XHQmJiB1c2VSYW5nZS5zdGFydExpbmVOdW1iZXIgPiBwcmV2TGluZU51bWJlclxuXHRcdFx0XHRcdCYmIHVzZVJhbmdlLmVuZExpbmVOdW1iZXIgPD0gbWF4TGluZU51bWJlclxuXHRcdFx0XHRcdCYmICghdG9wU3RhY2tlZFJhbmdlXG5cdFx0XHRcdFx0XHR8fCB0b3BTdGFja2VkUmFuZ2UuZW5kTGluZU51bWJlciA+PSB1c2VSYW5nZS5lbmRMaW5lTnVtYmVyKSkge1xuXHRcdFx0XHRcdHJlc3VsdFJhbmdlcy5wdXNoKHVzZVJhbmdlKTtcblx0XHRcdFx0XHRwcmV2TGluZU51bWJlciA9IHVzZVJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0XHRpZiAodG9wU3RhY2tlZFJhbmdlKSB7XG5cdFx0XHRcdFx0XHRzdGFja2VkUmFuZ2VzLnB1c2godG9wU3RhY2tlZFJhbmdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dG9wU3RhY2tlZFJhbmdlID0gdXNlUmFuZ2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0UmFuZ2VzO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIEZvbGRpbmdSZWdpb24ge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcmFuZ2VzOiBGb2xkaW5nUmVnaW9ucywgcHJpdmF0ZSBpbmRleDogbnVtYmVyKSB7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHN0YXJ0TGluZU51bWJlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5yYW5nZXMuZ2V0U3RhcnRMaW5lTnVtYmVyKHRoaXMuaW5kZXgpO1xuXHR9XG5cblx0cHVibGljIGdldCBlbmRMaW5lTnVtYmVyKCkge1xuXHRcdHJldHVybiB0aGlzLnJhbmdlcy5nZXRFbmRMaW5lTnVtYmVyKHRoaXMuaW5kZXgpO1xuXHR9XG5cblx0cHVibGljIGdldCByZWdpb25JbmRleCgpIHtcblx0XHRyZXR1cm4gdGhpcy5pbmRleDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgcGFyZW50SW5kZXgoKSB7XG5cdFx0cmV0dXJuIHRoaXMucmFuZ2VzLmdldFBhcmVudEluZGV4KHRoaXMuaW5kZXgpO1xuXHR9XG5cblx0cHVibGljIGdldCBpc0NvbGxhcHNlZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5yYW5nZXMuaXNDb2xsYXBzZWQodGhpcy5pbmRleCk7XG5cdH1cblxuXHRjb250YWluZWRCeShyYW5nZTogSUxpbmVSYW5nZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiByYW5nZS5zdGFydExpbmVOdW1iZXIgPD0gdGhpcy5zdGFydExpbmVOdW1iZXIgJiYgcmFuZ2UuZW5kTGluZU51bWJlciA+PSB0aGlzLmVuZExpbmVOdW1iZXI7XG5cdH1cblx0Y29udGFpbnNMaW5lKGxpbmVOdW1iZXI6IG51bWJlcikge1xuXHRcdHJldHVybiB0aGlzLnN0YXJ0TGluZU51bWJlciA8PSBsaW5lTnVtYmVyICYmIGxpbmVOdW1iZXIgPD0gdGhpcy5lbmRMaW5lTnVtYmVyO1xuXHR9XG5cdGhpZGVzTGluZShsaW5lTnVtYmVyOiBudW1iZXIpIHtcblx0XHRyZXR1cm4gdGhpcy5zdGFydExpbmVOdW1iZXIgPCBsaW5lTnVtYmVyICYmIGxpbmVOdW1iZXIgPD0gdGhpcy5lbmRMaW5lTnVtYmVyO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFZTyxJQUFXLGFBQVgsa0JBQVdBLGdCQUFYO0FBQ04sRUFBQUEsd0JBQUEsY0FBVyxLQUFYO0FBQ0EsRUFBQUEsd0JBQUEsaUJBQWMsS0FBZDtBQUNBLEVBQUFBLHdCQUFBLGVBQVksS0FBWjtBQUhpQixTQUFBQTtBQUFBLEdBQUE7QUFNWCxNQUFNLGlCQUFpQjtBQUFBLEVBQzdCLENBQUMsZ0JBQW1CLEdBQUc7QUFBQSxFQUN2QixDQUFDLG1CQUFzQixHQUFHO0FBQUEsRUFDMUIsQ0FBQyxpQkFBb0IsR0FBRztBQUN6QjtBQVVPLE1BQU0sc0JBQXNCO0FBQzVCLE1BQU0sa0JBQWtCO0FBRS9CLE1BQU0sY0FBYztBQUVwQixNQUFNLFNBQVM7QUFBQSxFQUVkLFlBQVksTUFBYztBQUN6QixVQUFNLFdBQVcsS0FBSyxLQUFLLE9BQU8sRUFBRTtBQUNwQyxTQUFLLFVBQVUsSUFBSSxZQUFZLFFBQVE7QUFBQSxFQUN4QztBQUFBLEVBRU8sSUFBSSxPQUF3QjtBQUNsQyxVQUFNLGFBQWMsUUFBUSxLQUFNO0FBQ2xDLFVBQU0sTUFBTSxRQUFRO0FBQ3BCLFlBQVEsS0FBSyxRQUFRLFVBQVUsSUFBSyxLQUFLLFNBQVU7QUFBQSxFQUNwRDtBQUFBLEVBRU8sSUFBSSxPQUFlLFVBQW1CO0FBQzVDLFVBQU0sYUFBYyxRQUFRLEtBQU07QUFDbEMsVUFBTSxNQUFNLFFBQVE7QUFDcEIsVUFBTSxRQUFRLEtBQUssUUFBUSxVQUFVO0FBQ3JDLFFBQUksVUFBVTtBQUNiLFdBQUssUUFBUSxVQUFVLElBQUksUUFBUyxLQUFLO0FBQUEsSUFDMUMsT0FBTztBQUNOLFdBQUssUUFBUSxVQUFVLElBQUksUUFBUSxFQUFFLEtBQUs7QUFBQSxJQUMzQztBQUFBLEVBQ0Q7QUFDRDtBQUVPLE1BQU0sZUFBZTtBQUFBLEVBVTNCLFlBQVksY0FBMkIsWUFBeUIsT0FBbUM7QUFDbEcsUUFBSSxhQUFhLFdBQVcsV0FBVyxVQUFVLGFBQWEsU0FBUyxxQkFBcUI7QUFDM0YsWUFBTSxJQUFJLE1BQU0seUNBQXlDO0FBQUEsSUFDMUQ7QUFDQSxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLGNBQWM7QUFDbkIsU0FBSyxrQkFBa0IsSUFBSSxTQUFTLGFBQWEsTUFBTTtBQUN2RCxTQUFLLHFCQUFxQixJQUFJLFNBQVMsYUFBYSxNQUFNO0FBQzFELFNBQUssbUJBQW1CLElBQUksU0FBUyxhQUFhLE1BQU07QUFDeEQsU0FBSyxTQUFTO0FBQ2QsU0FBSyxtQkFBbUI7QUFBQSxFQUN6QjtBQUFBLEVBRVEsc0JBQXNCO0FBQzdCLFFBQUksQ0FBQyxLQUFLLGtCQUFrQjtBQUMzQixXQUFLLG1CQUFtQjtBQUN4QixZQUFNLGdCQUEwQixDQUFDO0FBQ2pDLFlBQU0sZUFBZSxDQUFDLGlCQUF5QixrQkFBMEI7QUFDeEUsY0FBTSxRQUFRLGNBQWMsY0FBYyxTQUFTLENBQUM7QUFDcEQsZUFBTyxLQUFLLG1CQUFtQixLQUFLLEtBQUssbUJBQW1CLEtBQUssaUJBQWlCLEtBQUssS0FBSztBQUFBLE1BQzdGO0FBQ0EsZUFBUyxJQUFJLEdBQUcsTUFBTSxLQUFLLGNBQWMsUUFBUSxJQUFJLEtBQUssS0FBSztBQUM5RCxjQUFNLGtCQUFrQixLQUFLLGNBQWMsQ0FBQztBQUM1QyxjQUFNLGdCQUFnQixLQUFLLFlBQVksQ0FBQztBQUN4QyxZQUFJLGtCQUFrQixtQkFBbUIsZ0JBQWdCLGlCQUFpQjtBQUN6RSxnQkFBTSxJQUFJLE1BQU0sc0RBQXNELGVBQWU7QUFBQSxRQUN0RjtBQUNBLGVBQU8sY0FBYyxTQUFTLEtBQUssQ0FBQyxhQUFhLGlCQUFpQixhQUFhLEdBQUc7QUFDakYsd0JBQWMsSUFBSTtBQUFBLFFBQ25CO0FBQ0EsY0FBTSxjQUFjLGNBQWMsU0FBUyxJQUFJLGNBQWMsY0FBYyxTQUFTLENBQUMsSUFBSTtBQUN6RixzQkFBYyxLQUFLLENBQUM7QUFDcEIsYUFBSyxjQUFjLENBQUMsSUFBSSxvQkFBb0IsY0FBYyxRQUFTO0FBQ25FLGFBQUssWUFBWSxDQUFDLElBQUksa0JBQWtCLGNBQWMsVUFBVztBQUFBLE1BQ2xFO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLElBQVcsU0FBaUI7QUFDM0IsV0FBTyxLQUFLLGNBQWM7QUFBQSxFQUMzQjtBQUFBLEVBRU8sbUJBQW1CLE9BQXVCO0FBQ2hELFdBQU8sS0FBSyxjQUFjLEtBQUssSUFBSTtBQUFBLEVBQ3BDO0FBQUEsRUFFTyxpQkFBaUIsT0FBdUI7QUFDOUMsV0FBTyxLQUFLLFlBQVksS0FBSyxJQUFJO0FBQUEsRUFDbEM7QUFBQSxFQUVPLFFBQVEsT0FBbUM7QUFDakQsV0FBTyxLQUFLLFNBQVMsS0FBSyxPQUFPLEtBQUssSUFBSTtBQUFBLEVBQzNDO0FBQUEsRUFFTyxXQUFXO0FBQ2pCLFdBQU8sQ0FBQyxDQUFDLEtBQUs7QUFBQSxFQUNmO0FBQUEsRUFFTyxZQUFZLE9BQXdCO0FBQzFDLFdBQU8sS0FBSyxnQkFBZ0IsSUFBSSxLQUFLO0FBQUEsRUFDdEM7QUFBQSxFQUVPLGFBQWEsT0FBZSxVQUFtQjtBQUNyRCxTQUFLLGdCQUFnQixJQUFJLE9BQU8sUUFBUTtBQUFBLEVBQ3pDO0FBQUEsRUFFUSxjQUFjLE9BQXdCO0FBQzdDLFdBQU8sS0FBSyxtQkFBbUIsSUFBSSxLQUFLO0FBQUEsRUFDekM7QUFBQSxFQUVRLGVBQWUsT0FBZSxVQUFtQjtBQUN4RCxXQUFPLEtBQUssbUJBQW1CLElBQUksT0FBTyxRQUFRO0FBQUEsRUFDbkQ7QUFBQSxFQUVRLFlBQVksT0FBd0I7QUFDM0MsV0FBTyxLQUFLLGlCQUFpQixJQUFJLEtBQUs7QUFBQSxFQUN2QztBQUFBLEVBRVEsYUFBYSxPQUFlLFVBQW1CO0FBQ3RELFdBQU8sS0FBSyxpQkFBaUIsSUFBSSxPQUFPLFFBQVE7QUFBQSxFQUNqRDtBQUFBLEVBRU8sVUFBVSxPQUEyQjtBQUMzQyxRQUFJLEtBQUssY0FBYyxLQUFLLEdBQUc7QUFDOUIsYUFBTztBQUFBLElBQ1IsV0FBVyxLQUFLLFlBQVksS0FBSyxHQUFHO0FBQ25DLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLFVBQVUsT0FBZSxRQUEwQjtBQUN6RCxRQUFJLFdBQVcscUJBQXdCO0FBQ3RDLFdBQUssZUFBZSxPQUFPLElBQUk7QUFDL0IsV0FBSyxhQUFhLE9BQU8sS0FBSztBQUFBLElBQy9CLFdBQVcsV0FBVyxtQkFBc0I7QUFDM0MsV0FBSyxlQUFlLE9BQU8sS0FBSztBQUNoQyxXQUFLLGFBQWEsT0FBTyxJQUFJO0FBQUEsSUFDOUIsT0FBTztBQUNOLFdBQUssZUFBZSxPQUFPLEtBQUs7QUFDaEMsV0FBSyxhQUFhLE9BQU8sS0FBSztBQUFBLElBQy9CO0FBQUEsRUFDRDtBQUFBLEVBRU8sc0JBQXNCLE1BQWMsVUFBbUI7QUFDN0QsUUFBSSxhQUFhO0FBQ2pCLFFBQUksS0FBSyxRQUFRO0FBQ2hCLGVBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxPQUFPLFFBQVEsS0FBSztBQUM1QyxZQUFJLEtBQUssT0FBTyxDQUFDLE1BQU0sTUFBTTtBQUM1QixlQUFLLGFBQWEsR0FBRyxRQUFRO0FBQzdCLHVCQUFhO0FBQUEsUUFDZDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLFNBQVMsT0FBOEI7QUFDN0MsV0FBTyxJQUFJLGNBQWMsTUFBTSxLQUFLO0FBQUEsRUFDckM7QUFBQSxFQUVPLGVBQWUsT0FBZTtBQUNwQyxTQUFLLG9CQUFvQjtBQUN6QixVQUFNLFdBQVcsS0FBSyxjQUFjLEtBQUssSUFBSSxpQkFBaUIsUUFBUSxLQUFLLFlBQVksS0FBSyxJQUFJLGlCQUFpQjtBQUNqSCxRQUFJLFdBQVcscUJBQXFCO0FBQ25DLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLFNBQVMsT0FBZSxNQUFjO0FBQzVDLFdBQU8sS0FBSyxtQkFBbUIsS0FBSyxLQUFLLFFBQVEsS0FBSyxpQkFBaUIsS0FBSyxLQUFLO0FBQUEsRUFDbEY7QUFBQSxFQUVRLFVBQVUsTUFBYztBQUMvQixRQUFJLE1BQU0sR0FBRyxPQUFPLEtBQUssY0FBYztBQUN2QyxRQUFJLFNBQVMsR0FBRztBQUNmLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTyxNQUFNLE1BQU07QUFDbEIsWUFBTSxNQUFNLEtBQUssT0FBTyxNQUFNLFFBQVEsQ0FBQztBQUN2QyxVQUFJLE9BQU8sS0FBSyxtQkFBbUIsR0FBRyxHQUFHO0FBQ3hDLGVBQU87QUFBQSxNQUNSLE9BQU87QUFDTixjQUFNLE1BQU07QUFBQSxNQUNiO0FBQUEsSUFDRDtBQUNBLFdBQU8sTUFBTTtBQUFBLEVBQ2Q7QUFBQSxFQUVPLFVBQVUsTUFBc0I7QUFDdEMsUUFBSSxRQUFRLEtBQUssVUFBVSxJQUFJO0FBQy9CLFFBQUksU0FBUyxHQUFHO0FBQ2YsWUFBTSxnQkFBZ0IsS0FBSyxpQkFBaUIsS0FBSztBQUNqRCxVQUFJLGlCQUFpQixNQUFNO0FBQzFCLGVBQU87QUFBQSxNQUNSO0FBQ0EsY0FBUSxLQUFLLGVBQWUsS0FBSztBQUNqQyxhQUFPLFVBQVUsSUFBSTtBQUNwQixZQUFJLEtBQUssU0FBUyxPQUFPLElBQUksR0FBRztBQUMvQixpQkFBTztBQUFBLFFBQ1I7QUFDQSxnQkFBUSxLQUFLLGVBQWUsS0FBSztBQUFBLE1BQ2xDO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFHTyxXQUFXO0FBQ2pCLFVBQU0sTUFBZ0IsQ0FBQztBQUN2QixhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssUUFBUSxLQUFLO0FBQ3JDLFVBQUksQ0FBQyxJQUFJLElBQUksZUFBZSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLFlBQVksQ0FBQyxJQUFJLE1BQU0sR0FBRyxLQUFLLEtBQUssbUJBQW1CLENBQUMsQ0FBQyxJQUFJLEtBQUssaUJBQWlCLENBQUMsQ0FBQztBQUFBLElBQzVJO0FBQ0EsV0FBTyxJQUFJLEtBQUssSUFBSTtBQUFBLEVBQ3JCO0FBQUEsRUFFTyxZQUFZLE9BQTBCO0FBQzVDLFdBQU87QUFBQSxNQUNOLGlCQUFpQixLQUFLLGNBQWMsS0FBSyxJQUFJO0FBQUEsTUFDN0MsZUFBZSxLQUFLLFlBQVksS0FBSyxJQUFJO0FBQUEsTUFDekMsTUFBTSxLQUFLLFNBQVMsS0FBSyxPQUFPLEtBQUssSUFBSTtBQUFBLE1BQ3pDLGFBQWEsS0FBSyxZQUFZLEtBQUs7QUFBQSxNQUNuQyxRQUFRLEtBQUssVUFBVSxLQUFLO0FBQUEsSUFDN0I7QUFBQSxFQUNEO0FBQUEsRUFFQSxPQUFjLGVBQWUsUUFBcUM7QUFDakUsVUFBTSxlQUFlLE9BQU87QUFDNUIsVUFBTSxlQUFlLElBQUksWUFBWSxZQUFZO0FBQ2pELFVBQU0sYUFBYSxJQUFJLFlBQVksWUFBWTtBQUMvQyxRQUFJLFFBQStDLENBQUM7QUFDcEQsUUFBSSxXQUFXO0FBQ2YsYUFBUyxJQUFJLEdBQUcsSUFBSSxjQUFjLEtBQUs7QUFDdEMsWUFBTSxRQUFRLE9BQU8sQ0FBQztBQUN0QixtQkFBYSxDQUFDLElBQUksTUFBTTtBQUN4QixpQkFBVyxDQUFDLElBQUksTUFBTTtBQUN0QixZQUFNLEtBQUssTUFBTSxJQUFJO0FBQ3JCLFVBQUksTUFBTSxNQUFNO0FBQ2YsbUJBQVc7QUFBQSxNQUNaO0FBQUEsSUFDRDtBQUNBLFFBQUksQ0FBQyxVQUFVO0FBQ2QsY0FBUTtBQUFBLElBQ1Q7QUFDQSxVQUFNLFVBQVUsSUFBSSxlQUFlLGNBQWMsWUFBWSxLQUFLO0FBQ2xFLGFBQVMsSUFBSSxHQUFHLElBQUksY0FBYyxLQUFLO0FBQ3RDLFVBQUksT0FBTyxDQUFDLEVBQUUsYUFBYTtBQUMxQixnQkFBUSxhQUFhLEdBQUcsSUFBSTtBQUFBLE1BQzdCO0FBQ0EsY0FBUSxVQUFVLEdBQUcsT0FBTyxDQUFDLEVBQUUsTUFBTTtBQUFBLElBQ3RDO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBZUEsT0FBYyxpQkFDYixTQUNBLFNBQ0EsZUFDQSxXQUNjO0FBRWQsb0JBQWdCLGlCQUFpQixPQUFPO0FBRXhDLFVBQU0scUJBQXFCLENBQUMsR0FBaUMsVUFBa0I7QUFDOUUsYUFBTyxNQUFNLFFBQVEsQ0FBQyxJQUNsQixDQUFDLE1BQWM7QUFBRSxlQUFRLElBQUksUUFBUyxFQUFFLENBQUMsSUFBSTtBQUFBLE1BQVcsSUFDeEQsQ0FBQyxNQUFjO0FBQUUsZUFBUSxJQUFJLFFBQVMsRUFBRSxZQUFZLENBQUMsSUFBSTtBQUFBLE1BQVc7QUFBQSxJQUN6RTtBQUNBLFVBQU0sT0FBTyxtQkFBbUIsU0FBUyxRQUFRLE1BQU07QUFDdkQsVUFBTSxPQUFPLG1CQUFtQixTQUFTLFFBQVEsTUFBTTtBQUN2RCxRQUFJLFNBQVM7QUFDYixRQUFJLFNBQVM7QUFDYixRQUFJLFFBQVEsS0FBSyxDQUFDO0FBQ2xCLFFBQUksUUFBUSxLQUFLLENBQUM7QUFFbEIsVUFBTSxnQkFBNkIsQ0FBQztBQUNwQyxRQUFJO0FBQ0osUUFBSSxpQkFBaUI7QUFDckIsVUFBTSxlQUE0QixDQUFDO0FBRW5DLFdBQU8sU0FBUyxPQUFPO0FBRXRCLFVBQUksV0FBa0M7QUFDdEMsVUFBSSxVQUFVLENBQUMsU0FBUyxNQUFNLG1CQUFtQixNQUFNLGtCQUFrQjtBQUN4RSxZQUFJLFNBQVMsTUFBTSxvQkFBb0IsTUFBTSxpQkFBaUI7QUFDN0QsY0FBSSxNQUFNLFdBQVcscUJBQXdCO0FBRTVDLHVCQUFXO0FBQUEsVUFDWixPQUFPO0FBRU4sdUJBQVc7QUFFWCxxQkFBUyxjQUFjLE1BQU0sZ0JBQWdCLE1BQU0sa0JBQWtCLE1BQU0saUJBQWlCLENBQUMsV0FBVyxhQUFhLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQztBQUN2SyxxQkFBUyxTQUFTO0FBQUEsVUFDbkI7QUFDQSxrQkFBUSxLQUFLLEVBQUUsTUFBTTtBQUFBLFFBQ3RCLE9BQU87QUFDTixxQkFBVztBQUNYLGNBQUksTUFBTSxlQUFlLE1BQU0sV0FBVyxrQkFBcUI7QUFFOUQscUJBQVMsU0FBUztBQUFBLFVBQ25CO0FBQUEsUUFDRDtBQUNBLGdCQUFRLEtBQUssRUFBRSxNQUFNO0FBQUEsTUFDdEIsT0FBTztBQUdOLFlBQUksWUFBWTtBQUNoQixZQUFJLFdBQVc7QUFDZixlQUFPLE1BQU07QUFDWixjQUFJLENBQUMsWUFBWSxTQUFTLGtCQUFrQixNQUFPLGVBQWU7QUFDakUsdUJBQVc7QUFDWDtBQUFBLFVBQ0Q7QUFDQSxjQUFJLFNBQVMsV0FBVyx1QkFBMEIsU0FBUyxnQkFBZ0IsTUFBTyxlQUFlO0FBRWhHO0FBQUEsVUFDRDtBQUNBLHFCQUFXLEtBQUssRUFBRSxTQUFTO0FBQUEsUUFDNUI7QUFDQSxnQkFBUSxLQUFLLEVBQUUsTUFBTTtBQUFBLE1BQ3RCO0FBRUEsVUFBSSxVQUFVO0FBQ2IsZUFBTyxtQkFDSCxnQkFBZ0IsZ0JBQWdCLFNBQVMsaUJBQWlCO0FBQzdELDRCQUFrQixjQUFjLElBQUk7QUFBQSxRQUNyQztBQUNBLFlBQUksU0FBUyxnQkFBZ0IsU0FBUyxtQkFDbEMsU0FBUyxrQkFBa0Isa0JBQzNCLFNBQVMsaUJBQWlCLGtCQUN6QixDQUFDLG1CQUNELGdCQUFnQixpQkFBaUIsU0FBUyxnQkFBZ0I7QUFDOUQsdUJBQWEsS0FBSyxRQUFRO0FBQzFCLDJCQUFpQixTQUFTO0FBQzFCLGNBQUksaUJBQWlCO0FBQ3BCLDBCQUFjLEtBQUssZUFBZTtBQUFBLFVBQ25DO0FBQ0EsNEJBQWtCO0FBQUEsUUFDbkI7QUFBQSxNQUNEO0FBQUEsSUFFRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBRUQ7QUFFTyxNQUFNLGNBQWM7QUFBQSxFQUUxQixZQUE2QixRQUFnQyxPQUFlO0FBQS9DO0FBQWdDO0FBQUEsRUFDN0Q7QUFBQSxFQUVBLElBQVcsa0JBQWtCO0FBQzVCLFdBQU8sS0FBSyxPQUFPLG1CQUFtQixLQUFLLEtBQUs7QUFBQSxFQUNqRDtBQUFBLEVBRUEsSUFBVyxnQkFBZ0I7QUFDMUIsV0FBTyxLQUFLLE9BQU8saUJBQWlCLEtBQUssS0FBSztBQUFBLEVBQy9DO0FBQUEsRUFFQSxJQUFXLGNBQWM7QUFDeEIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBVyxjQUFjO0FBQ3hCLFdBQU8sS0FBSyxPQUFPLGVBQWUsS0FBSyxLQUFLO0FBQUEsRUFDN0M7QUFBQSxFQUVBLElBQVcsY0FBYztBQUN4QixXQUFPLEtBQUssT0FBTyxZQUFZLEtBQUssS0FBSztBQUFBLEVBQzFDO0FBQUEsRUFFQSxZQUFZLE9BQTRCO0FBQ3ZDLFdBQU8sTUFBTSxtQkFBbUIsS0FBSyxtQkFBbUIsTUFBTSxpQkFBaUIsS0FBSztBQUFBLEVBQ3JGO0FBQUEsRUFDQSxhQUFhLFlBQW9CO0FBQ2hDLFdBQU8sS0FBSyxtQkFBbUIsY0FBYyxjQUFjLEtBQUs7QUFBQSxFQUNqRTtBQUFBLEVBQ0EsVUFBVSxZQUFvQjtBQUM3QixXQUFPLEtBQUssa0JBQWtCLGNBQWMsY0FBYyxLQUFLO0FBQUEsRUFDaEU7QUFDRDsiLAogICJuYW1lcyI6IFsiRm9sZFNvdXJjZSJdCn0K
