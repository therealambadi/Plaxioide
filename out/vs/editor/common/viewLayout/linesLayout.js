import * as strings from "../../../base/common/strings.js";
class PendingChanges {
  constructor() {
    this._hasPending = false;
    this._inserts = [];
    this._changes = [];
    this._removes = [];
  }
  insert(x) {
    this._hasPending = true;
    this._inserts.push(x);
  }
  change(x) {
    this._hasPending = true;
    this._changes.push(x);
  }
  remove(x) {
    this._hasPending = true;
    this._removes.push(x);
  }
  mustCommit() {
    return this._hasPending;
  }
  commit(linesLayout) {
    if (!this._hasPending) {
      return;
    }
    const inserts = this._inserts;
    const changes = this._changes;
    const removes = this._removes;
    this._hasPending = false;
    this._inserts = [];
    this._changes = [];
    this._removes = [];
    linesLayout._commitPendingChanges(inserts, changes, removes);
  }
}
class EditorWhitespace {
  constructor(id, afterLineNumber, ordinal, height, minWidth) {
    this.id = id;
    this.afterLineNumber = afterLineNumber;
    this.ordinal = ordinal;
    this.height = height;
    this.minWidth = minWidth;
    this.prefixSum = 0;
  }
}
const _LinesLayout = class _LinesLayout {
  constructor(lineCount, lineHeight, paddingTop, paddingBottom) {
    this._instanceId = strings.singleLetterHash(++_LinesLayout.INSTANCE_COUNT);
    this._pendingChanges = new PendingChanges();
    this._lastWhitespaceId = 0;
    this._arr = [];
    this._prefixSumValidIndex = -1;
    this._minWidth = -1;
    this._lineCount = lineCount;
    this._lineHeight = lineHeight;
    this._paddingTop = paddingTop;
    this._paddingBottom = paddingBottom;
  }
  /**
   * Find the insertion index for a new value inside a sorted array of values.
   * If the value is already present in the sorted array, the insertion index will be after the already existing value.
   */
  static findInsertionIndex(arr, afterLineNumber, ordinal) {
    let low = 0;
    let high = arr.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (afterLineNumber === arr[mid].afterLineNumber) {
        if (ordinal < arr[mid].ordinal) {
          high = mid;
        } else {
          low = mid + 1;
        }
      } else if (afterLineNumber < arr[mid].afterLineNumber) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    return low;
  }
  /**
   * Change the height of a line in pixels.
   */
  setLineHeight(lineHeight) {
    this._checkPendingChanges();
    this._lineHeight = lineHeight;
  }
  /**
   * Changes the padding used to calculate vertical offsets.
   */
  setPadding(paddingTop, paddingBottom) {
    this._paddingTop = paddingTop;
    this._paddingBottom = paddingBottom;
  }
  /**
   * Set the number of lines.
   *
   * @param lineCount New number of lines.
   */
  onFlushed(lineCount) {
    this._checkPendingChanges();
    this._lineCount = lineCount;
  }
  changeWhitespace(callback) {
    let hadAChange = false;
    try {
      const accessor = {
        insertWhitespace: (afterLineNumber, ordinal, heightInPx, minWidth) => {
          hadAChange = true;
          afterLineNumber = afterLineNumber | 0;
          ordinal = ordinal | 0;
          heightInPx = heightInPx | 0;
          minWidth = minWidth | 0;
          const id = this._instanceId + ++this._lastWhitespaceId;
          this._pendingChanges.insert(new EditorWhitespace(id, afterLineNumber, ordinal, heightInPx, minWidth));
          return id;
        },
        changeOneWhitespace: (id, newAfterLineNumber, newHeight) => {
          hadAChange = true;
          newAfterLineNumber = newAfterLineNumber | 0;
          newHeight = newHeight | 0;
          this._pendingChanges.change({ id, newAfterLineNumber, newHeight });
        },
        removeWhitespace: (id) => {
          hadAChange = true;
          this._pendingChanges.remove({ id });
        }
      };
      callback(accessor);
    } finally {
      this._pendingChanges.commit(this);
    }
    return hadAChange;
  }
  _commitPendingChanges(inserts, changes, removes) {
    if (inserts.length > 0 || removes.length > 0) {
      this._minWidth = -1;
    }
    if (inserts.length + changes.length + removes.length <= 1) {
      for (const insert of inserts) {
        this._insertWhitespace(insert);
      }
      for (const change of changes) {
        this._changeOneWhitespace(change.id, change.newAfterLineNumber, change.newHeight);
      }
      for (const remove of removes) {
        const index = this._findWhitespaceIndex(remove.id);
        if (index === -1) {
          continue;
        }
        this._removeWhitespace(index);
      }
      return;
    }
    const toRemove = /* @__PURE__ */ new Set();
    for (const remove of removes) {
      toRemove.add(remove.id);
    }
    const toChange = /* @__PURE__ */ new Map();
    for (const change of changes) {
      toChange.set(change.id, change);
    }
    const applyRemoveAndChange = (whitespaces) => {
      const result2 = [];
      for (const whitespace of whitespaces) {
        if (toRemove.has(whitespace.id)) {
          continue;
        }
        if (toChange.has(whitespace.id)) {
          const change = toChange.get(whitespace.id);
          whitespace.afterLineNumber = change.newAfterLineNumber;
          whitespace.height = change.newHeight;
        }
        result2.push(whitespace);
      }
      return result2;
    };
    const result = applyRemoveAndChange(this._arr).concat(applyRemoveAndChange(inserts));
    result.sort((a, b) => {
      if (a.afterLineNumber === b.afterLineNumber) {
        return a.ordinal - b.ordinal;
      }
      return a.afterLineNumber - b.afterLineNumber;
    });
    this._arr = result;
    this._prefixSumValidIndex = -1;
  }
  _checkPendingChanges() {
    if (this._pendingChanges.mustCommit()) {
      this._pendingChanges.commit(this);
    }
  }
  _insertWhitespace(whitespace) {
    const insertIndex = _LinesLayout.findInsertionIndex(this._arr, whitespace.afterLineNumber, whitespace.ordinal);
    this._arr.splice(insertIndex, 0, whitespace);
    this._prefixSumValidIndex = Math.min(this._prefixSumValidIndex, insertIndex - 1);
  }
  _findWhitespaceIndex(id) {
    const arr = this._arr;
    for (let i = 0, len = arr.length; i < len; i++) {
      if (arr[i].id === id) {
        return i;
      }
    }
    return -1;
  }
  _changeOneWhitespace(id, newAfterLineNumber, newHeight) {
    const index = this._findWhitespaceIndex(id);
    if (index === -1) {
      return;
    }
    if (this._arr[index].height !== newHeight) {
      this._arr[index].height = newHeight;
      this._prefixSumValidIndex = Math.min(this._prefixSumValidIndex, index - 1);
    }
    if (this._arr[index].afterLineNumber !== newAfterLineNumber) {
      const whitespace = this._arr[index];
      this._removeWhitespace(index);
      whitespace.afterLineNumber = newAfterLineNumber;
      this._insertWhitespace(whitespace);
    }
  }
  _removeWhitespace(removeIndex) {
    this._arr.splice(removeIndex, 1);
    this._prefixSumValidIndex = Math.min(this._prefixSumValidIndex, removeIndex - 1);
  }
  /**
   * Notify the layouter that lines have been deleted (a continuous zone of lines).
   *
   * @param fromLineNumber The line number at which the deletion started, inclusive
   * @param toLineNumber The line number at which the deletion ended, inclusive
   */
  onLinesDeleted(fromLineNumber, toLineNumber) {
    this._checkPendingChanges();
    fromLineNumber = fromLineNumber | 0;
    toLineNumber = toLineNumber | 0;
    this._lineCount -= toLineNumber - fromLineNumber + 1;
    for (let i = 0, len = this._arr.length; i < len; i++) {
      const afterLineNumber = this._arr[i].afterLineNumber;
      if (fromLineNumber <= afterLineNumber && afterLineNumber <= toLineNumber) {
        this._arr[i].afterLineNumber = fromLineNumber - 1;
      } else if (afterLineNumber > toLineNumber) {
        this._arr[i].afterLineNumber -= toLineNumber - fromLineNumber + 1;
      }
    }
  }
  /**
   * Notify the layouter that lines have been inserted (a continuous zone of lines).
   *
   * @param fromLineNumber The line number at which the insertion started, inclusive
   * @param toLineNumber The line number at which the insertion ended, inclusive.
   */
  onLinesInserted(fromLineNumber, toLineNumber) {
    this._checkPendingChanges();
    fromLineNumber = fromLineNumber | 0;
    toLineNumber = toLineNumber | 0;
    this._lineCount += toLineNumber - fromLineNumber + 1;
    for (let i = 0, len = this._arr.length; i < len; i++) {
      const afterLineNumber = this._arr[i].afterLineNumber;
      if (fromLineNumber <= afterLineNumber) {
        this._arr[i].afterLineNumber += toLineNumber - fromLineNumber + 1;
      }
    }
  }
  /**
   * Get the sum of all the whitespaces.
   */
  getWhitespacesTotalHeight() {
    this._checkPendingChanges();
    if (this._arr.length === 0) {
      return 0;
    }
    return this.getWhitespacesAccumulatedHeight(this._arr.length - 1);
  }
  /**
   * Return the sum of the heights of the whitespaces at [0..index].
   * This includes the whitespace at `index`.
   *
   * @param index The index of the whitespace.
   * @return The sum of the heights of all whitespaces before the one at `index`, including the one at `index`.
   */
  getWhitespacesAccumulatedHeight(index) {
    this._checkPendingChanges();
    index = index | 0;
    let startIndex = Math.max(0, this._prefixSumValidIndex + 1);
    if (startIndex === 0) {
      this._arr[0].prefixSum = this._arr[0].height;
      startIndex++;
    }
    for (let i = startIndex; i <= index; i++) {
      this._arr[i].prefixSum = this._arr[i - 1].prefixSum + this._arr[i].height;
    }
    this._prefixSumValidIndex = Math.max(this._prefixSumValidIndex, index);
    return this._arr[index].prefixSum;
  }
  /**
   * Get the sum of heights for all objects.
   *
   * @return The sum of heights for all objects.
   */
  getLinesTotalHeight() {
    this._checkPendingChanges();
    const linesHeight = this._lineHeight * this._lineCount;
    const whitespacesHeight = this.getWhitespacesTotalHeight();
    return linesHeight + whitespacesHeight + this._paddingTop + this._paddingBottom;
  }
  /**
   * Returns the accumulated height of whitespaces before the given line number.
   *
   * @param lineNumber The line number
   */
  getWhitespaceAccumulatedHeightBeforeLineNumber(lineNumber) {
    this._checkPendingChanges();
    lineNumber = lineNumber | 0;
    const lastWhitespaceBeforeLineNumber = this._findLastWhitespaceBeforeLineNumber(lineNumber);
    if (lastWhitespaceBeforeLineNumber === -1) {
      return 0;
    }
    return this.getWhitespacesAccumulatedHeight(lastWhitespaceBeforeLineNumber);
  }
  _findLastWhitespaceBeforeLineNumber(lineNumber) {
    lineNumber = lineNumber | 0;
    const arr = this._arr;
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {
      const delta = high - low | 0;
      const halfDelta = delta / 2 | 0;
      const mid = low + halfDelta | 0;
      if (arr[mid].afterLineNumber < lineNumber) {
        if (mid + 1 >= arr.length || arr[mid + 1].afterLineNumber >= lineNumber) {
          return mid;
        } else {
          low = mid + 1 | 0;
        }
      } else {
        high = mid - 1 | 0;
      }
    }
    return -1;
  }
  _findFirstWhitespaceAfterLineNumber(lineNumber) {
    lineNumber = lineNumber | 0;
    const lastWhitespaceBeforeLineNumber = this._findLastWhitespaceBeforeLineNumber(lineNumber);
    const firstWhitespaceAfterLineNumber = lastWhitespaceBeforeLineNumber + 1;
    if (firstWhitespaceAfterLineNumber < this._arr.length) {
      return firstWhitespaceAfterLineNumber;
    }
    return -1;
  }
  /**
   * Find the index of the first whitespace which has `afterLineNumber` >= `lineNumber`.
   * @return The index of the first whitespace with `afterLineNumber` >= `lineNumber` or -1 if no whitespace is found.
   */
  getFirstWhitespaceIndexAfterLineNumber(lineNumber) {
    this._checkPendingChanges();
    lineNumber = lineNumber | 0;
    return this._findFirstWhitespaceAfterLineNumber(lineNumber);
  }
  /**
   * Get the vertical offset (the sum of heights for all objects above) a certain line number.
   *
   * @param lineNumber The line number
   * @return The sum of heights for all objects above `lineNumber`.
   */
  getVerticalOffsetForLineNumber(lineNumber, includeViewZones = false) {
    this._checkPendingChanges();
    lineNumber = lineNumber | 0;
    let previousLinesHeight;
    if (lineNumber > 1) {
      previousLinesHeight = this._lineHeight * (lineNumber - 1);
    } else {
      previousLinesHeight = 0;
    }
    const previousWhitespacesHeight = this.getWhitespaceAccumulatedHeightBeforeLineNumber(lineNumber - (includeViewZones ? 1 : 0));
    return previousLinesHeight + previousWhitespacesHeight + this._paddingTop;
  }
  /**
   * Get the vertical offset (the sum of heights for all objects above) a certain line number.
   *
   * @param lineNumber The line number
   * @return The sum of heights for all objects above `lineNumber`.
   */
  getVerticalOffsetAfterLineNumber(lineNumber, includeViewZones = false) {
    this._checkPendingChanges();
    lineNumber = lineNumber | 0;
    const previousLinesHeight = this._lineHeight * lineNumber;
    const previousWhitespacesHeight = this.getWhitespaceAccumulatedHeightBeforeLineNumber(lineNumber + (includeViewZones ? 1 : 0));
    return previousLinesHeight + previousWhitespacesHeight + this._paddingTop;
  }
  /**
   * Returns if there is any whitespace in the document.
   */
  hasWhitespace() {
    this._checkPendingChanges();
    return this.getWhitespacesCount() > 0;
  }
  /**
   * The maximum min width for all whitespaces.
   */
  getWhitespaceMinWidth() {
    this._checkPendingChanges();
    if (this._minWidth === -1) {
      let minWidth = 0;
      for (let i = 0, len = this._arr.length; i < len; i++) {
        minWidth = Math.max(minWidth, this._arr[i].minWidth);
      }
      this._minWidth = minWidth;
    }
    return this._minWidth;
  }
  /**
   * Check if `verticalOffset` is below all lines.
   */
  isAfterLines(verticalOffset) {
    this._checkPendingChanges();
    const totalHeight = this.getLinesTotalHeight();
    return verticalOffset > totalHeight;
  }
  isInTopPadding(verticalOffset) {
    if (this._paddingTop === 0) {
      return false;
    }
    this._checkPendingChanges();
    return verticalOffset < this._paddingTop;
  }
  isInBottomPadding(verticalOffset) {
    if (this._paddingBottom === 0) {
      return false;
    }
    this._checkPendingChanges();
    const totalHeight = this.getLinesTotalHeight();
    return verticalOffset >= totalHeight - this._paddingBottom;
  }
  /**
   * Find the first line number that is at or after vertical offset `verticalOffset`.
   * i.e. if getVerticalOffsetForLine(line) is x and getVerticalOffsetForLine(line + 1) is y, then
   * getLineNumberAtOrAfterVerticalOffset(i) = line, x <= i < y.
   *
   * @param verticalOffset The vertical offset to search at.
   * @return The line number at or after vertical offset `verticalOffset`.
   */
  getLineNumberAtOrAfterVerticalOffset(verticalOffset) {
    this._checkPendingChanges();
    verticalOffset = verticalOffset | 0;
    if (verticalOffset < 0) {
      return 1;
    }
    const linesCount = this._lineCount | 0;
    const lineHeight = this._lineHeight;
    let minLineNumber = 1;
    let maxLineNumber = linesCount;
    while (minLineNumber < maxLineNumber) {
      const midLineNumber = (minLineNumber + maxLineNumber) / 2 | 0;
      const midLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(midLineNumber) | 0;
      if (verticalOffset >= midLineNumberVerticalOffset + lineHeight) {
        minLineNumber = midLineNumber + 1;
      } else if (verticalOffset >= midLineNumberVerticalOffset) {
        return midLineNumber;
      } else {
        maxLineNumber = midLineNumber;
      }
    }
    if (minLineNumber > linesCount) {
      return linesCount;
    }
    return minLineNumber;
  }
  /**
   * Get all the lines and their relative vertical offsets that are positioned between `verticalOffset1` and `verticalOffset2`.
   *
   * @param verticalOffset1 The beginning of the viewport.
   * @param verticalOffset2 The end of the viewport.
   * @return A structure describing the lines positioned between `verticalOffset1` and `verticalOffset2`.
   */
  getLinesViewportData(verticalOffset1, verticalOffset2) {
    this._checkPendingChanges();
    verticalOffset1 = verticalOffset1 | 0;
    verticalOffset2 = verticalOffset2 | 0;
    const lineHeight = this._lineHeight;
    const startLineNumber = this.getLineNumberAtOrAfterVerticalOffset(verticalOffset1) | 0;
    const startLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(startLineNumber) | 0;
    let endLineNumber = this._lineCount | 0;
    let whitespaceIndex = this.getFirstWhitespaceIndexAfterLineNumber(startLineNumber) | 0;
    const whitespaceCount = this.getWhitespacesCount() | 0;
    let currentWhitespaceHeight;
    let currentWhitespaceAfterLineNumber;
    if (whitespaceIndex === -1) {
      whitespaceIndex = whitespaceCount;
      currentWhitespaceAfterLineNumber = endLineNumber + 1;
      currentWhitespaceHeight = 0;
    } else {
      currentWhitespaceAfterLineNumber = this.getAfterLineNumberForWhitespaceIndex(whitespaceIndex) | 0;
      currentWhitespaceHeight = this.getHeightForWhitespaceIndex(whitespaceIndex) | 0;
    }
    let currentVerticalOffset = startLineNumberVerticalOffset;
    let currentLineRelativeOffset = currentVerticalOffset;
    const STEP_SIZE = 5e5;
    let bigNumbersDelta = 0;
    if (startLineNumberVerticalOffset >= STEP_SIZE) {
      bigNumbersDelta = Math.floor(startLineNumberVerticalOffset / STEP_SIZE) * STEP_SIZE;
      bigNumbersDelta = Math.floor(bigNumbersDelta / lineHeight) * lineHeight;
      currentLineRelativeOffset -= bigNumbersDelta;
    }
    const linesOffsets = [];
    const verticalCenter = verticalOffset1 + (verticalOffset2 - verticalOffset1) / 2;
    let centeredLineNumber = -1;
    for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
      if (centeredLineNumber === -1) {
        const currentLineTop = currentVerticalOffset;
        const currentLineBottom = currentVerticalOffset + lineHeight;
        if (currentLineTop <= verticalCenter && verticalCenter < currentLineBottom || currentLineTop > verticalCenter) {
          centeredLineNumber = lineNumber;
        }
      }
      currentVerticalOffset += lineHeight;
      linesOffsets[lineNumber - startLineNumber] = currentLineRelativeOffset;
      currentLineRelativeOffset += lineHeight;
      while (currentWhitespaceAfterLineNumber === lineNumber) {
        currentLineRelativeOffset += currentWhitespaceHeight;
        currentVerticalOffset += currentWhitespaceHeight;
        whitespaceIndex++;
        if (whitespaceIndex >= whitespaceCount) {
          currentWhitespaceAfterLineNumber = endLineNumber + 1;
        } else {
          currentWhitespaceAfterLineNumber = this.getAfterLineNumberForWhitespaceIndex(whitespaceIndex) | 0;
          currentWhitespaceHeight = this.getHeightForWhitespaceIndex(whitespaceIndex) | 0;
        }
      }
      if (currentVerticalOffset >= verticalOffset2) {
        endLineNumber = lineNumber;
        break;
      }
    }
    if (centeredLineNumber === -1) {
      centeredLineNumber = endLineNumber;
    }
    const endLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(endLineNumber) | 0;
    let completelyVisibleStartLineNumber = startLineNumber;
    let completelyVisibleEndLineNumber = endLineNumber;
    if (completelyVisibleStartLineNumber < completelyVisibleEndLineNumber) {
      if (startLineNumberVerticalOffset < verticalOffset1) {
        completelyVisibleStartLineNumber++;
      }
    }
    if (completelyVisibleStartLineNumber < completelyVisibleEndLineNumber) {
      if (endLineNumberVerticalOffset + lineHeight > verticalOffset2) {
        completelyVisibleEndLineNumber--;
      }
    }
    return {
      bigNumbersDelta,
      startLineNumber,
      endLineNumber,
      relativeVerticalOffset: linesOffsets,
      centeredLineNumber,
      completelyVisibleStartLineNumber,
      completelyVisibleEndLineNumber,
      lineHeight: this._lineHeight
    };
  }
  getVerticalOffsetForWhitespaceIndex(whitespaceIndex) {
    this._checkPendingChanges();
    whitespaceIndex = whitespaceIndex | 0;
    const afterLineNumber = this.getAfterLineNumberForWhitespaceIndex(whitespaceIndex);
    let previousLinesHeight;
    if (afterLineNumber >= 1) {
      previousLinesHeight = this._lineHeight * afterLineNumber;
    } else {
      previousLinesHeight = 0;
    }
    let previousWhitespacesHeight;
    if (whitespaceIndex > 0) {
      previousWhitespacesHeight = this.getWhitespacesAccumulatedHeight(whitespaceIndex - 1);
    } else {
      previousWhitespacesHeight = 0;
    }
    return previousLinesHeight + previousWhitespacesHeight + this._paddingTop;
  }
  getWhitespaceIndexAtOrAfterVerticallOffset(verticalOffset) {
    this._checkPendingChanges();
    verticalOffset = verticalOffset | 0;
    let minWhitespaceIndex = 0;
    let maxWhitespaceIndex = this.getWhitespacesCount() - 1;
    if (maxWhitespaceIndex < 0) {
      return -1;
    }
    const maxWhitespaceVerticalOffset = this.getVerticalOffsetForWhitespaceIndex(maxWhitespaceIndex);
    const maxWhitespaceHeight = this.getHeightForWhitespaceIndex(maxWhitespaceIndex);
    if (verticalOffset >= maxWhitespaceVerticalOffset + maxWhitespaceHeight) {
      return -1;
    }
    while (minWhitespaceIndex < maxWhitespaceIndex) {
      const midWhitespaceIndex = Math.floor((minWhitespaceIndex + maxWhitespaceIndex) / 2);
      const midWhitespaceVerticalOffset = this.getVerticalOffsetForWhitespaceIndex(midWhitespaceIndex);
      const midWhitespaceHeight = this.getHeightForWhitespaceIndex(midWhitespaceIndex);
      if (verticalOffset >= midWhitespaceVerticalOffset + midWhitespaceHeight) {
        minWhitespaceIndex = midWhitespaceIndex + 1;
      } else if (verticalOffset >= midWhitespaceVerticalOffset) {
        return midWhitespaceIndex;
      } else {
        maxWhitespaceIndex = midWhitespaceIndex;
      }
    }
    return minWhitespaceIndex;
  }
  /**
   * Get exactly the whitespace that is layouted at `verticalOffset`.
   *
   * @param verticalOffset The vertical offset.
   * @return Precisely the whitespace that is layouted at `verticaloffset` or null.
   */
  getWhitespaceAtVerticalOffset(verticalOffset) {
    this._checkPendingChanges();
    verticalOffset = verticalOffset | 0;
    const candidateIndex = this.getWhitespaceIndexAtOrAfterVerticallOffset(verticalOffset);
    if (candidateIndex < 0) {
      return null;
    }
    if (candidateIndex >= this.getWhitespacesCount()) {
      return null;
    }
    const candidateTop = this.getVerticalOffsetForWhitespaceIndex(candidateIndex);
    if (candidateTop > verticalOffset) {
      return null;
    }
    const candidateHeight = this.getHeightForWhitespaceIndex(candidateIndex);
    const candidateId = this.getIdForWhitespaceIndex(candidateIndex);
    const candidateAfterLineNumber = this.getAfterLineNumberForWhitespaceIndex(candidateIndex);
    return {
      id: candidateId,
      afterLineNumber: candidateAfterLineNumber,
      verticalOffset: candidateTop,
      height: candidateHeight
    };
  }
  /**
   * Get a list of whitespaces that are positioned between `verticalOffset1` and `verticalOffset2`.
   *
   * @param verticalOffset1 The beginning of the viewport.
   * @param verticalOffset2 The end of the viewport.
   * @return An array with all the whitespaces in the viewport. If no whitespace is in viewport, the array is empty.
   */
  getWhitespaceViewportData(verticalOffset1, verticalOffset2) {
    this._checkPendingChanges();
    verticalOffset1 = verticalOffset1 | 0;
    verticalOffset2 = verticalOffset2 | 0;
    const startIndex = this.getWhitespaceIndexAtOrAfterVerticallOffset(verticalOffset1);
    const endIndex = this.getWhitespacesCount() - 1;
    if (startIndex < 0) {
      return [];
    }
    const result = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const top = this.getVerticalOffsetForWhitespaceIndex(i);
      const height = this.getHeightForWhitespaceIndex(i);
      if (top >= verticalOffset2) {
        break;
      }
      result.push({
        id: this.getIdForWhitespaceIndex(i),
        afterLineNumber: this.getAfterLineNumberForWhitespaceIndex(i),
        verticalOffset: top,
        height
      });
    }
    return result;
  }
  /**
   * Get all whitespaces.
   */
  getWhitespaces() {
    this._checkPendingChanges();
    return this._arr.slice(0);
  }
  /**
   * The number of whitespaces.
   */
  getWhitespacesCount() {
    this._checkPendingChanges();
    return this._arr.length;
  }
  /**
   * Get the `id` for whitespace at index `index`.
   *
   * @param index The index of the whitespace.
   * @return `id` of whitespace at `index`.
   */
  getIdForWhitespaceIndex(index) {
    this._checkPendingChanges();
    index = index | 0;
    return this._arr[index].id;
  }
  /**
   * Get the `afterLineNumber` for whitespace at index `index`.
   *
   * @param index The index of the whitespace.
   * @return `afterLineNumber` of whitespace at `index`.
   */
  getAfterLineNumberForWhitespaceIndex(index) {
    this._checkPendingChanges();
    index = index | 0;
    return this._arr[index].afterLineNumber;
  }
  /**
   * Get the `height` for whitespace at index `index`.
   *
   * @param index The index of the whitespace.
   * @return `height` of whitespace at `index`.
   */
  getHeightForWhitespaceIndex(index) {
    this._checkPendingChanges();
    index = index | 0;
    return this._arr[index].height;
  }
};
_LinesLayout.INSTANCE_COUNT = 0;
let LinesLayout = _LinesLayout;
export {
  EditorWhitespace,
  LinesLayout
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3ZpZXdMYXlvdXQvbGluZXNMYXlvdXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJRWRpdG9yV2hpdGVzcGFjZSwgSVBhcnRpYWxWaWV3TGluZXNWaWV3cG9ydERhdGEsIElWaWV3V2hpdGVzcGFjZVZpZXdwb3J0RGF0YSwgSVdoaXRlc3BhY2VDaGFuZ2VBY2Nlc3NvciB9IGZyb20gJy4uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuXG5pbnRlcmZhY2UgSVBlbmRpbmdDaGFuZ2UgeyBpZDogc3RyaW5nOyBuZXdBZnRlckxpbmVOdW1iZXI6IG51bWJlcjsgbmV3SGVpZ2h0OiBudW1iZXIgfVxuaW50ZXJmYWNlIElQZW5kaW5nUmVtb3ZlIHsgaWQ6IHN0cmluZyB9XG5cbmNsYXNzIFBlbmRpbmdDaGFuZ2VzIHtcblx0cHJpdmF0ZSBfaGFzUGVuZGluZzogYm9vbGVhbjtcblx0cHJpdmF0ZSBfaW5zZXJ0czogRWRpdG9yV2hpdGVzcGFjZVtdO1xuXHRwcml2YXRlIF9jaGFuZ2VzOiBJUGVuZGluZ0NoYW5nZVtdO1xuXHRwcml2YXRlIF9yZW1vdmVzOiBJUGVuZGluZ1JlbW92ZVtdO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX2hhc1BlbmRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLl9pbnNlcnRzID0gW107XG5cdFx0dGhpcy5fY2hhbmdlcyA9IFtdO1xuXHRcdHRoaXMuX3JlbW92ZXMgPSBbXTtcblx0fVxuXG5cdHB1YmxpYyBpbnNlcnQoeDogRWRpdG9yV2hpdGVzcGFjZSk6IHZvaWQge1xuXHRcdHRoaXMuX2hhc1BlbmRpbmcgPSB0cnVlO1xuXHRcdHRoaXMuX2luc2VydHMucHVzaCh4KTtcblx0fVxuXG5cdHB1YmxpYyBjaGFuZ2UoeDogSVBlbmRpbmdDaGFuZ2UpOiB2b2lkIHtcblx0XHR0aGlzLl9oYXNQZW5kaW5nID0gdHJ1ZTtcblx0XHR0aGlzLl9jaGFuZ2VzLnB1c2goeCk7XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlKHg6IElQZW5kaW5nUmVtb3ZlKTogdm9pZCB7XG5cdFx0dGhpcy5faGFzUGVuZGluZyA9IHRydWU7XG5cdFx0dGhpcy5fcmVtb3Zlcy5wdXNoKHgpO1xuXHR9XG5cblx0cHVibGljIG11c3RDb21taXQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2hhc1BlbmRpbmc7XG5cdH1cblxuXHRwdWJsaWMgY29tbWl0KGxpbmVzTGF5b3V0OiBMaW5lc0xheW91dCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faGFzUGVuZGluZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluc2VydHMgPSB0aGlzLl9pbnNlcnRzO1xuXHRcdGNvbnN0IGNoYW5nZXMgPSB0aGlzLl9jaGFuZ2VzO1xuXHRcdGNvbnN0IHJlbW92ZXMgPSB0aGlzLl9yZW1vdmVzO1xuXG5cdFx0dGhpcy5faGFzUGVuZGluZyA9IGZhbHNlO1xuXHRcdHRoaXMuX2luc2VydHMgPSBbXTtcblx0XHR0aGlzLl9jaGFuZ2VzID0gW107XG5cdFx0dGhpcy5fcmVtb3ZlcyA9IFtdO1xuXG5cdFx0bGluZXNMYXlvdXQuX2NvbW1pdFBlbmRpbmdDaGFuZ2VzKGluc2VydHMsIGNoYW5nZXMsIHJlbW92ZXMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JXaGl0ZXNwYWNlIGltcGxlbWVudHMgSUVkaXRvcldoaXRlc3BhY2Uge1xuXHRwdWJsaWMgaWQ6IHN0cmluZztcblx0cHVibGljIGFmdGVyTGluZU51bWJlcjogbnVtYmVyO1xuXHRwdWJsaWMgb3JkaW5hbDogbnVtYmVyO1xuXHRwdWJsaWMgaGVpZ2h0OiBudW1iZXI7XG5cdHB1YmxpYyBtaW5XaWR0aDogbnVtYmVyO1xuXHRwdWJsaWMgcHJlZml4U3VtOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgYWZ0ZXJMaW5lTnVtYmVyOiBudW1iZXIsIG9yZGluYWw6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIG1pbldpZHRoOiBudW1iZXIpIHtcblx0XHR0aGlzLmlkID0gaWQ7XG5cdFx0dGhpcy5hZnRlckxpbmVOdW1iZXIgPSBhZnRlckxpbmVOdW1iZXI7XG5cdFx0dGhpcy5vcmRpbmFsID0gb3JkaW5hbDtcblx0XHR0aGlzLmhlaWdodCA9IGhlaWdodDtcblx0XHR0aGlzLm1pbldpZHRoID0gbWluV2lkdGg7XG5cdFx0dGhpcy5wcmVmaXhTdW0gPSAwO1xuXHR9XG59XG5cbi8qKlxuICogTGF5b3V0aW5nIG9mIG9iamVjdHMgdGhhdCB0YWtlIHZlcnRpY2FsIHNwYWNlIChieSBoYXZpbmcgYSBoZWlnaHQpIGFuZCBwdXNoIGRvd24gb3RoZXIgb2JqZWN0cy5cbiAqXG4gKiBUaGVzZSBvYmplY3RzIGFyZSBiYXNpY2FsbHkgZWl0aGVyIHRleHQgKGxpbmVzKSBvciBzcGFjZXMgYmV0d2VlbiB0aG9zZSBsaW5lcyAod2hpdGVzcGFjZXMpLlxuICogVGhpcyBwcm92aWRlcyBjb21tb2RpdHkgb3BlcmF0aW9ucyBmb3Igd29ya2luZyB3aXRoIGxpbmVzIHRoYXQgY29udGFpbiB3aGl0ZXNwYWNlIHRoYXQgcHVzaGVzIGxpbmVzIGxvd2VyICh2ZXJ0aWNhbGx5KS5cbiAqL1xuZXhwb3J0IGNsYXNzIExpbmVzTGF5b3V0IHtcblxuXHRwcml2YXRlIHN0YXRpYyBJTlNUQU5DRV9DT1VOVCA9IDA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5zdGFuY2VJZDogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wZW5kaW5nQ2hhbmdlczogUGVuZGluZ0NoYW5nZXM7XG5cdHByaXZhdGUgX2xhc3RXaGl0ZXNwYWNlSWQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfYXJyOiBFZGl0b3JXaGl0ZXNwYWNlW107XG5cdHByaXZhdGUgX3ByZWZpeFN1bVZhbGlkSW5kZXg6IG51bWJlcjtcblx0cHJpdmF0ZSBfbWluV2lkdGg6IG51bWJlcjtcblx0cHJpdmF0ZSBfbGluZUNvdW50OiBudW1iZXI7XG5cdHByaXZhdGUgX2xpbmVIZWlnaHQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfcGFkZGluZ1RvcDogbnVtYmVyO1xuXHRwcml2YXRlIF9wYWRkaW5nQm90dG9tOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IobGluZUNvdW50OiBudW1iZXIsIGxpbmVIZWlnaHQ6IG51bWJlciwgcGFkZGluZ1RvcDogbnVtYmVyLCBwYWRkaW5nQm90dG9tOiBudW1iZXIpIHtcblx0XHR0aGlzLl9pbnN0YW5jZUlkID0gc3RyaW5ncy5zaW5nbGVMZXR0ZXJIYXNoKCsrTGluZXNMYXlvdXQuSU5TVEFOQ0VfQ09VTlQpO1xuXHRcdHRoaXMuX3BlbmRpbmdDaGFuZ2VzID0gbmV3IFBlbmRpbmdDaGFuZ2VzKCk7XG5cdFx0dGhpcy5fbGFzdFdoaXRlc3BhY2VJZCA9IDA7XG5cdFx0dGhpcy5fYXJyID0gW107XG5cdFx0dGhpcy5fcHJlZml4U3VtVmFsaWRJbmRleCA9IC0xO1xuXHRcdHRoaXMuX21pbldpZHRoID0gLTE7IC8qIG1hcmtlciBmb3Igbm90IGJlaW5nIGNvbXB1dGVkICovXG5cdFx0dGhpcy5fbGluZUNvdW50ID0gbGluZUNvdW50O1xuXHRcdHRoaXMuX2xpbmVIZWlnaHQgPSBsaW5lSGVpZ2h0O1xuXHRcdHRoaXMuX3BhZGRpbmdUb3AgPSBwYWRkaW5nVG9wO1xuXHRcdHRoaXMuX3BhZGRpbmdCb3R0b20gPSBwYWRkaW5nQm90dG9tO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgdGhlIGluc2VydGlvbiBpbmRleCBmb3IgYSBuZXcgdmFsdWUgaW5zaWRlIGEgc29ydGVkIGFycmF5IG9mIHZhbHVlcy5cblx0ICogSWYgdGhlIHZhbHVlIGlzIGFscmVhZHkgcHJlc2VudCBpbiB0aGUgc29ydGVkIGFycmF5LCB0aGUgaW5zZXJ0aW9uIGluZGV4IHdpbGwgYmUgYWZ0ZXIgdGhlIGFscmVhZHkgZXhpc3RpbmcgdmFsdWUuXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGZpbmRJbnNlcnRpb25JbmRleChhcnI6IEVkaXRvcldoaXRlc3BhY2VbXSwgYWZ0ZXJMaW5lTnVtYmVyOiBudW1iZXIsIG9yZGluYWw6IG51bWJlcik6IG51bWJlciB7XG5cdFx0bGV0IGxvdyA9IDA7XG5cdFx0bGV0IGhpZ2ggPSBhcnIubGVuZ3RoO1xuXG5cdFx0d2hpbGUgKGxvdyA8IGhpZ2gpIHtcblx0XHRcdGNvbnN0IG1pZCA9ICgobG93ICsgaGlnaCkgPj4+IDEpO1xuXG5cdFx0XHRpZiAoYWZ0ZXJMaW5lTnVtYmVyID09PSBhcnJbbWlkXS5hZnRlckxpbmVOdW1iZXIpIHtcblx0XHRcdFx0aWYgKG9yZGluYWwgPCBhcnJbbWlkXS5vcmRpbmFsKSB7XG5cdFx0XHRcdFx0aGlnaCA9IG1pZDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsb3cgPSBtaWQgKyAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGFmdGVyTGluZU51bWJlciA8IGFyclttaWRdLmFmdGVyTGluZU51bWJlcikge1xuXHRcdFx0XHRoaWdoID0gbWlkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bG93ID0gbWlkICsgMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbG93O1xuXHR9XG5cblx0LyoqXG5cdCAqIENoYW5nZSB0aGUgaGVpZ2h0IG9mIGEgbGluZSBpbiBwaXhlbHMuXG5cdCAqL1xuXHRwdWJsaWMgc2V0TGluZUhlaWdodChsaW5lSGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9jaGVja1BlbmRpbmdDaGFuZ2VzKCk7XG5cdFx0dGhpcy5fbGluZUhlaWdodCA9IGxpbmVIZWlnaHQ7XG5cdH1cblxuXHQvKipcblx0ICogQ2hhbmdlcyB0aGUgcGFkZGluZyB1c2VkIHRvIGNhbGN1bGF0ZSB2ZXJ0aWNhbCBvZmZzZXRzLlxuXHQgKi9cblx0cHVibGljIHNldFBhZGRpbmcocGFkZGluZ1RvcDogbnVtYmVyLCBwYWRkaW5nQm90dG9tOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9wYWRkaW5nVG9wID0gcGFkZGluZ1RvcDtcblx0XHR0aGlzLl9wYWRkaW5nQm90dG9tID0gcGFkZGluZ0JvdHRvbTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZXQgdGhlIG51bWJlciBvZiBsaW5lcy5cblx0ICpcblx0ICogQHBhcmFtIGxpbmVDb3VudCBOZXcgbnVtYmVyIG9mIGxpbmVzLlxuXHQgKi9cblx0cHVibGljIG9uRmx1c2hlZChsaW5lQ291bnQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHR0aGlzLl9saW5lQ291bnQgPSBsaW5lQ291bnQ7XG5cdH1cblxuXHRwdWJsaWMgY2hhbmdlV2hpdGVzcGFjZShjYWxsYmFjazogKGFjY2Vzc29yOiBJV2hpdGVzcGFjZUNoYW5nZUFjY2Vzc29yKSA9PiB2b2lkKTogYm9vbGVhbiB7XG5cdFx0bGV0IGhhZEFDaGFuZ2UgPSBmYWxzZTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYWNjZXNzb3I6IElXaGl0ZXNwYWNlQ2hhbmdlQWNjZXNzb3IgPSB7XG5cdFx0XHRcdGluc2VydFdoaXRlc3BhY2U6IChhZnRlckxpbmVOdW1iZXI6IG51bWJlciwgb3JkaW5hbDogbnVtYmVyLCBoZWlnaHRJblB4OiBudW1iZXIsIG1pbldpZHRoOiBudW1iZXIpOiBzdHJpbmcgPT4ge1xuXHRcdFx0XHRcdGhhZEFDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHRcdGFmdGVyTGluZU51bWJlciA9IGFmdGVyTGluZU51bWJlciB8IDA7XG5cdFx0XHRcdFx0b3JkaW5hbCA9IG9yZGluYWwgfCAwO1xuXHRcdFx0XHRcdGhlaWdodEluUHggPSBoZWlnaHRJblB4IHwgMDtcblx0XHRcdFx0XHRtaW5XaWR0aCA9IG1pbldpZHRoIHwgMDtcblx0XHRcdFx0XHRjb25zdCBpZCA9IHRoaXMuX2luc3RhbmNlSWQgKyAoKyt0aGlzLl9sYXN0V2hpdGVzcGFjZUlkKTtcblx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nQ2hhbmdlcy5pbnNlcnQobmV3IEVkaXRvcldoaXRlc3BhY2UoaWQsIGFmdGVyTGluZU51bWJlciwgb3JkaW5hbCwgaGVpZ2h0SW5QeCwgbWluV2lkdGgpKTtcblx0XHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNoYW5nZU9uZVdoaXRlc3BhY2U6IChpZDogc3RyaW5nLCBuZXdBZnRlckxpbmVOdW1iZXI6IG51bWJlciwgbmV3SGVpZ2h0OiBudW1iZXIpOiB2b2lkID0+IHtcblx0XHRcdFx0XHRoYWRBQ2hhbmdlID0gdHJ1ZTtcblx0XHRcdFx0XHRuZXdBZnRlckxpbmVOdW1iZXIgPSBuZXdBZnRlckxpbmVOdW1iZXIgfCAwO1xuXHRcdFx0XHRcdG5ld0hlaWdodCA9IG5ld0hlaWdodCB8IDA7XG5cdFx0XHRcdFx0dGhpcy5fcGVuZGluZ0NoYW5nZXMuY2hhbmdlKHsgaWQsIG5ld0FmdGVyTGluZU51bWJlciwgbmV3SGVpZ2h0IH0pO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZW1vdmVXaGl0ZXNwYWNlOiAoaWQ6IHN0cmluZyk6IHZvaWQgPT4ge1xuXHRcdFx0XHRcdGhhZEFDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHRcdHRoaXMuX3BlbmRpbmdDaGFuZ2VzLnJlbW92ZSh7IGlkIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0Y2FsbGJhY2soYWNjZXNzb3IpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9wZW5kaW5nQ2hhbmdlcy5jb21taXQodGhpcyk7XG5cdFx0fVxuXHRcdHJldHVybiBoYWRBQ2hhbmdlO1xuXHR9XG5cblx0cHVibGljIF9jb21taXRQZW5kaW5nQ2hhbmdlcyhpbnNlcnRzOiBFZGl0b3JXaGl0ZXNwYWNlW10sIGNoYW5nZXM6IElQZW5kaW5nQ2hhbmdlW10sIHJlbW92ZXM6IElQZW5kaW5nUmVtb3ZlW10pOiB2b2lkIHtcblx0XHRpZiAoaW5zZXJ0cy5sZW5ndGggPiAwIHx8IHJlbW92ZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fbWluV2lkdGggPSAtMTsgLyogbWFya2VyIGZvciBub3QgYmVpbmcgY29tcHV0ZWQgKi9cblx0XHR9XG5cblx0XHRpZiAoaW5zZXJ0cy5sZW5ndGggKyBjaGFuZ2VzLmxlbmd0aCArIHJlbW92ZXMubGVuZ3RoIDw9IDEpIHtcblx0XHRcdC8vIHdoZW4gb25seSBvbmUgdGhpbmcgaGFwcGVuZWQsIGhhbmRsZSBpdCBcImRlbGljYXRlbHlcIlxuXHRcdFx0Zm9yIChjb25zdCBpbnNlcnQgb2YgaW5zZXJ0cykge1xuXHRcdFx0XHR0aGlzLl9pbnNlcnRXaGl0ZXNwYWNlKGluc2VydCk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBjaGFuZ2VzKSB7XG5cdFx0XHRcdHRoaXMuX2NoYW5nZU9uZVdoaXRlc3BhY2UoY2hhbmdlLmlkLCBjaGFuZ2UubmV3QWZ0ZXJMaW5lTnVtYmVyLCBjaGFuZ2UubmV3SGVpZ2h0KTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgcmVtb3ZlIG9mIHJlbW92ZXMpIHtcblx0XHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9maW5kV2hpdGVzcGFjZUluZGV4KHJlbW92ZS5pZCk7XG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9yZW1vdmVXaGl0ZXNwYWNlKGluZGV4KTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBzaW1wbHkgcmVidWlsZCB0aGUgZW50aXJlIGRhdGFzdHJ1Y3R1cmVcblxuXHRcdGNvbnN0IHRvUmVtb3ZlID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Zm9yIChjb25zdCByZW1vdmUgb2YgcmVtb3Zlcykge1xuXHRcdFx0dG9SZW1vdmUuYWRkKHJlbW92ZS5pZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9DaGFuZ2UgPSBuZXcgTWFwPHN0cmluZywgSVBlbmRpbmdDaGFuZ2U+KCk7XG5cdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgY2hhbmdlcykge1xuXHRcdFx0dG9DaGFuZ2Uuc2V0KGNoYW5nZS5pZCwgY2hhbmdlKTtcblx0XHR9XG5cblx0XHRjb25zdCBhcHBseVJlbW92ZUFuZENoYW5nZSA9ICh3aGl0ZXNwYWNlczogRWRpdG9yV2hpdGVzcGFjZVtdKTogRWRpdG9yV2hpdGVzcGFjZVtdID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogRWRpdG9yV2hpdGVzcGFjZVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHdoaXRlc3BhY2Ugb2Ygd2hpdGVzcGFjZXMpIHtcblx0XHRcdFx0aWYgKHRvUmVtb3ZlLmhhcyh3aGl0ZXNwYWNlLmlkKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0b0NoYW5nZS5oYXMod2hpdGVzcGFjZS5pZCkpIHtcblx0XHRcdFx0XHRjb25zdCBjaGFuZ2UgPSB0b0NoYW5nZS5nZXQod2hpdGVzcGFjZS5pZCkhO1xuXHRcdFx0XHRcdHdoaXRlc3BhY2UuYWZ0ZXJMaW5lTnVtYmVyID0gY2hhbmdlLm5ld0FmdGVyTGluZU51bWJlcjtcblx0XHRcdFx0XHR3aGl0ZXNwYWNlLmhlaWdodCA9IGNoYW5nZS5uZXdIZWlnaHQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0LnB1c2god2hpdGVzcGFjZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH07XG5cblx0XHRjb25zdCByZXN1bHQgPSBhcHBseVJlbW92ZUFuZENoYW5nZSh0aGlzLl9hcnIpLmNvbmNhdChhcHBseVJlbW92ZUFuZENoYW5nZShpbnNlcnRzKSk7XG5cdFx0cmVzdWx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGlmIChhLmFmdGVyTGluZU51bWJlciA9PT0gYi5hZnRlckxpbmVOdW1iZXIpIHtcblx0XHRcdFx0cmV0dXJuIGEub3JkaW5hbCAtIGIub3JkaW5hbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhLmFmdGVyTGluZU51bWJlciAtIGIuYWZ0ZXJMaW5lTnVtYmVyO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fYXJyID0gcmVzdWx0O1xuXHRcdHRoaXMuX3ByZWZpeFN1bVZhbGlkSW5kZXggPSAtMTtcblx0fVxuXG5cdHByaXZhdGUgX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3BlbmRpbmdDaGFuZ2VzLm11c3RDb21taXQoKSkge1xuXHRcdFx0dGhpcy5fcGVuZGluZ0NoYW5nZXMuY29tbWl0KHRoaXMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2luc2VydFdoaXRlc3BhY2Uod2hpdGVzcGFjZTogRWRpdG9yV2hpdGVzcGFjZSk6IHZvaWQge1xuXHRcdGNvbnN0IGluc2VydEluZGV4ID0gTGluZXNMYXlvdXQuZmluZEluc2VydGlvbkluZGV4KHRoaXMuX2Fyciwgd2hpdGVzcGFjZS5hZnRlckxpbmVOdW1iZXIsIHdoaXRlc3BhY2Uub3JkaW5hbCk7XG5cdFx0dGhpcy5fYXJyLnNwbGljZShpbnNlcnRJbmRleCwgMCwgd2hpdGVzcGFjZSk7XG5cdFx0dGhpcy5fcHJlZml4U3VtVmFsaWRJbmRleCA9IE1hdGgubWluKHRoaXMuX3ByZWZpeFN1bVZhbGlkSW5kZXgsIGluc2VydEluZGV4IC0gMSk7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kV2hpdGVzcGFjZUluZGV4KGlkOiBzdHJpbmcpOiBudW1iZXIge1xuXHRcdGNvbnN0IGFyciA9IHRoaXMuX2Fycjtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRpZiAoYXJyW2ldLmlkID09PSBpZCkge1xuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2hhbmdlT25lV2hpdGVzcGFjZShpZDogc3RyaW5nLCBuZXdBZnRlckxpbmVOdW1iZXI6IG51bWJlciwgbmV3SGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2ZpbmRXaGl0ZXNwYWNlSW5kZXgoaWQpO1xuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2FycltpbmRleF0uaGVpZ2h0ICE9PSBuZXdIZWlnaHQpIHtcblx0XHRcdHRoaXMuX2FycltpbmRleF0uaGVpZ2h0ID0gbmV3SGVpZ2h0O1xuXHRcdFx0dGhpcy5fcHJlZml4U3VtVmFsaWRJbmRleCA9IE1hdGgubWluKHRoaXMuX3ByZWZpeFN1bVZhbGlkSW5kZXgsIGluZGV4IC0gMSk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9hcnJbaW5kZXhdLmFmdGVyTGluZU51bWJlciAhPT0gbmV3QWZ0ZXJMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBgYWZ0ZXJMaW5lTnVtYmVyYCBjaGFuZ2VkIGZvciB0aGlzIHdoaXRlc3BhY2VcblxuXHRcdFx0Ly8gUmVjb3JkIG9sZCB3aGl0ZXNwYWNlXG5cdFx0XHRjb25zdCB3aGl0ZXNwYWNlID0gdGhpcy5fYXJyW2luZGV4XTtcblxuXHRcdFx0Ly8gU2luY2UgY2hhbmdpbmcgYGFmdGVyTGluZU51bWJlcmAgY2FuIHRyaWdnZXIgYSByZW9yZGVyaW5nLCB3ZSdyZSBnb25uYSByZW1vdmUgdGhpcyB3aGl0ZXNwYWNlXG5cdFx0XHR0aGlzLl9yZW1vdmVXaGl0ZXNwYWNlKGluZGV4KTtcblxuXHRcdFx0d2hpdGVzcGFjZS5hZnRlckxpbmVOdW1iZXIgPSBuZXdBZnRlckxpbmVOdW1iZXI7XG5cblx0XHRcdC8vIEFuZCBhZGQgaXQgYWdhaW5cblx0XHRcdHRoaXMuX2luc2VydFdoaXRlc3BhY2Uod2hpdGVzcGFjZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlV2hpdGVzcGFjZShyZW1vdmVJbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fYXJyLnNwbGljZShyZW1vdmVJbmRleCwgMSk7XG5cdFx0dGhpcy5fcHJlZml4U3VtVmFsaWRJbmRleCA9IE1hdGgubWluKHRoaXMuX3ByZWZpeFN1bVZhbGlkSW5kZXgsIHJlbW92ZUluZGV4IC0gMSk7XG5cdH1cblxuXHQvKipcblx0ICogTm90aWZ5IHRoZSBsYXlvdXRlciB0aGF0IGxpbmVzIGhhdmUgYmVlbiBkZWxldGVkIChhIGNvbnRpbnVvdXMgem9uZSBvZiBsaW5lcykuXG5cdCAqXG5cdCAqIEBwYXJhbSBmcm9tTGluZU51bWJlciBUaGUgbGluZSBudW1iZXIgYXQgd2hpY2ggdGhlIGRlbGV0aW9uIHN0YXJ0ZWQsIGluY2x1c2l2ZVxuXHQgKiBAcGFyYW0gdG9MaW5lTnVtYmVyIFRoZSBsaW5lIG51bWJlciBhdCB3aGljaCB0aGUgZGVsZXRpb24gZW5kZWQsIGluY2x1c2l2ZVxuXHQgKi9cblx0cHVibGljIG9uTGluZXNEZWxldGVkKGZyb21MaW5lTnVtYmVyOiBudW1iZXIsIHRvTGluZU51bWJlcjogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGZyb21MaW5lTnVtYmVyID0gZnJvbUxpbmVOdW1iZXIgfCAwO1xuXHRcdHRvTGluZU51bWJlciA9IHRvTGluZU51bWJlciB8IDA7XG5cblx0XHR0aGlzLl9saW5lQ291bnQgLT0gKHRvTGluZU51bWJlciAtIGZyb21MaW5lTnVtYmVyICsgMSk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2Fyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgYWZ0ZXJMaW5lTnVtYmVyID0gdGhpcy5fYXJyW2ldLmFmdGVyTGluZU51bWJlcjtcblxuXHRcdFx0aWYgKGZyb21MaW5lTnVtYmVyIDw9IGFmdGVyTGluZU51bWJlciAmJiBhZnRlckxpbmVOdW1iZXIgPD0gdG9MaW5lTnVtYmVyKSB7XG5cdFx0XHRcdC8vIFRoZSBsaW5lIHRoaXMgd2hpdGVzcGFjZSB3YXMgYWZ0ZXIgaGFzIGJlZW4gZGVsZXRlZFxuXHRcdFx0XHQvLyAgPT4gbW92ZSB3aGl0ZXNwYWNlIHRvIGJlZm9yZSBmaXJzdCBkZWxldGVkIGxpbmVcblx0XHRcdFx0dGhpcy5fYXJyW2ldLmFmdGVyTGluZU51bWJlciA9IGZyb21MaW5lTnVtYmVyIC0gMTtcblx0XHRcdH0gZWxzZSBpZiAoYWZ0ZXJMaW5lTnVtYmVyID4gdG9MaW5lTnVtYmVyKSB7XG5cdFx0XHRcdC8vIFRoZSBsaW5lIHRoaXMgd2hpdGVzcGFjZSB3YXMgYWZ0ZXIgaGFzIGJlZW4gbW92ZWQgdXBcblx0XHRcdFx0Ly8gID0+IG1vdmUgd2hpdGVzcGFjZSB1cFxuXHRcdFx0XHR0aGlzLl9hcnJbaV0uYWZ0ZXJMaW5lTnVtYmVyIC09ICh0b0xpbmVOdW1iZXIgLSBmcm9tTGluZU51bWJlciArIDEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBOb3RpZnkgdGhlIGxheW91dGVyIHRoYXQgbGluZXMgaGF2ZSBiZWVuIGluc2VydGVkIChhIGNvbnRpbnVvdXMgem9uZSBvZiBsaW5lcykuXG5cdCAqXG5cdCAqIEBwYXJhbSBmcm9tTGluZU51bWJlciBUaGUgbGluZSBudW1iZXIgYXQgd2hpY2ggdGhlIGluc2VydGlvbiBzdGFydGVkLCBpbmNsdXNpdmVcblx0ICogQHBhcmFtIHRvTGluZU51bWJlciBUaGUgbGluZSBudW1iZXIgYXQgd2hpY2ggdGhlIGluc2VydGlvbiBlbmRlZCwgaW5jbHVzaXZlLlxuXHQgKi9cblx0cHVibGljIG9uTGluZXNJbnNlcnRlZChmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHRmcm9tTGluZU51bWJlciA9IGZyb21MaW5lTnVtYmVyIHwgMDtcblx0XHR0b0xpbmVOdW1iZXIgPSB0b0xpbmVOdW1iZXIgfCAwO1xuXG5cdFx0dGhpcy5fbGluZUNvdW50ICs9ICh0b0xpbmVOdW1iZXIgLSBmcm9tTGluZU51bWJlciArIDEpO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9hcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGFmdGVyTGluZU51bWJlciA9IHRoaXMuX2FycltpXS5hZnRlckxpbmVOdW1iZXI7XG5cblx0XHRcdGlmIChmcm9tTGluZU51bWJlciA8PSBhZnRlckxpbmVOdW1iZXIpIHtcblx0XHRcdFx0dGhpcy5fYXJyW2ldLmFmdGVyTGluZU51bWJlciArPSAodG9MaW5lTnVtYmVyIC0gZnJvbUxpbmVOdW1iZXIgKyAxKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBzdW0gb2YgYWxsIHRoZSB3aGl0ZXNwYWNlcy5cblx0ICovXG5cdHB1YmxpYyBnZXRXaGl0ZXNwYWNlc1RvdGFsSGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGlmICh0aGlzLl9hcnIubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0V2hpdGVzcGFjZXNBY2N1bXVsYXRlZEhlaWdodCh0aGlzLl9hcnIubGVuZ3RoIC0gMSk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBzdW0gb2YgdGhlIGhlaWdodHMgb2YgdGhlIHdoaXRlc3BhY2VzIGF0IFswLi5pbmRleF0uXG5cdCAqIFRoaXMgaW5jbHVkZXMgdGhlIHdoaXRlc3BhY2UgYXQgYGluZGV4YC5cblx0ICpcblx0ICogQHBhcmFtIGluZGV4IFRoZSBpbmRleCBvZiB0aGUgd2hpdGVzcGFjZS5cblx0ICogQHJldHVybiBUaGUgc3VtIG9mIHRoZSBoZWlnaHRzIG9mIGFsbCB3aGl0ZXNwYWNlcyBiZWZvcmUgdGhlIG9uZSBhdCBgaW5kZXhgLCBpbmNsdWRpbmcgdGhlIG9uZSBhdCBgaW5kZXhgLlxuXHQgKi9cblx0cHVibGljIGdldFdoaXRlc3BhY2VzQWNjdW11bGF0ZWRIZWlnaHQoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGluZGV4ID0gaW5kZXggfCAwO1xuXG5cdFx0bGV0IHN0YXJ0SW5kZXggPSBNYXRoLm1heCgwLCB0aGlzLl9wcmVmaXhTdW1WYWxpZEluZGV4ICsgMSk7XG5cdFx0aWYgKHN0YXJ0SW5kZXggPT09IDApIHtcblx0XHRcdHRoaXMuX2FyclswXS5wcmVmaXhTdW0gPSB0aGlzLl9hcnJbMF0uaGVpZ2h0O1xuXHRcdFx0c3RhcnRJbmRleCsrO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGluZGV4OyBpKyspIHtcblx0XHRcdHRoaXMuX2FycltpXS5wcmVmaXhTdW0gPSB0aGlzLl9hcnJbaSAtIDFdLnByZWZpeFN1bSArIHRoaXMuX2FycltpXS5oZWlnaHQ7XG5cdFx0fVxuXHRcdHRoaXMuX3ByZWZpeFN1bVZhbGlkSW5kZXggPSBNYXRoLm1heCh0aGlzLl9wcmVmaXhTdW1WYWxpZEluZGV4LCBpbmRleCk7XG5cdFx0cmV0dXJuIHRoaXMuX2FycltpbmRleF0ucHJlZml4U3VtO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgc3VtIG9mIGhlaWdodHMgZm9yIGFsbCBvYmplY3RzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIFRoZSBzdW0gb2YgaGVpZ2h0cyBmb3IgYWxsIG9iamVjdHMuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0TGluZXNUb3RhbEhlaWdodCgpOiBudW1iZXIge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHRjb25zdCBsaW5lc0hlaWdodCA9IHRoaXMuX2xpbmVIZWlnaHQgKiB0aGlzLl9saW5lQ291bnQ7XG5cdFx0Y29uc3Qgd2hpdGVzcGFjZXNIZWlnaHQgPSB0aGlzLmdldFdoaXRlc3BhY2VzVG90YWxIZWlnaHQoKTtcblxuXHRcdHJldHVybiBsaW5lc0hlaWdodCArIHdoaXRlc3BhY2VzSGVpZ2h0ICsgdGhpcy5fcGFkZGluZ1RvcCArIHRoaXMuX3BhZGRpbmdCb3R0b207XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgaGVpZ2h0IG9mIHdoaXRlc3BhY2VzIGJlZm9yZSB0aGUgZ2l2ZW4gbGluZSBudW1iZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSBsaW5lTnVtYmVyIFRoZSBsaW5lIG51bWJlclxuXHQgKi9cblx0cHVibGljIGdldFdoaXRlc3BhY2VBY2N1bXVsYXRlZEhlaWdodEJlZm9yZUxpbmVOdW1iZXIobGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHR0aGlzLl9jaGVja1BlbmRpbmdDaGFuZ2VzKCk7XG5cdFx0bGluZU51bWJlciA9IGxpbmVOdW1iZXIgfCAwO1xuXG5cdFx0Y29uc3QgbGFzdFdoaXRlc3BhY2VCZWZvcmVMaW5lTnVtYmVyID0gdGhpcy5fZmluZExhc3RXaGl0ZXNwYWNlQmVmb3JlTGluZU51bWJlcihsaW5lTnVtYmVyKTtcblxuXHRcdGlmIChsYXN0V2hpdGVzcGFjZUJlZm9yZUxpbmVOdW1iZXIgPT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRXaGl0ZXNwYWNlc0FjY3VtdWxhdGVkSGVpZ2h0KGxhc3RXaGl0ZXNwYWNlQmVmb3JlTGluZU51bWJlcik7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kTGFzdFdoaXRlc3BhY2VCZWZvcmVMaW5lTnVtYmVyKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0bGluZU51bWJlciA9IGxpbmVOdW1iZXIgfCAwO1xuXG5cdFx0Ly8gRmluZCB0aGUgd2hpdGVzcGFjZSBiZWZvcmUgbGluZSBudW1iZXJcblx0XHRjb25zdCBhcnIgPSB0aGlzLl9hcnI7XG5cdFx0bGV0IGxvdyA9IDA7XG5cdFx0bGV0IGhpZ2ggPSBhcnIubGVuZ3RoIC0gMTtcblxuXHRcdHdoaWxlIChsb3cgPD0gaGlnaCkge1xuXHRcdFx0Y29uc3QgZGVsdGEgPSAoaGlnaCAtIGxvdykgfCAwO1xuXHRcdFx0Y29uc3QgaGFsZkRlbHRhID0gKGRlbHRhIC8gMikgfCAwO1xuXHRcdFx0Y29uc3QgbWlkID0gKGxvdyArIGhhbGZEZWx0YSkgfCAwO1xuXG5cdFx0XHRpZiAoYXJyW21pZF0uYWZ0ZXJMaW5lTnVtYmVyIDwgbGluZU51bWJlcikge1xuXHRcdFx0XHRpZiAobWlkICsgMSA+PSBhcnIubGVuZ3RoIHx8IGFyclttaWQgKyAxXS5hZnRlckxpbmVOdW1iZXIgPj0gbGluZU51bWJlcikge1xuXHRcdFx0XHRcdHJldHVybiBtaWQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bG93ID0gKG1pZCArIDEpIHwgMDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aGlnaCA9IChtaWQgLSAxKSB8IDA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZEZpcnN0V2hpdGVzcGFjZUFmdGVyTGluZU51bWJlcihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyIHwgMDtcblxuXHRcdGNvbnN0IGxhc3RXaGl0ZXNwYWNlQmVmb3JlTGluZU51bWJlciA9IHRoaXMuX2ZpbmRMYXN0V2hpdGVzcGFjZUJlZm9yZUxpbmVOdW1iZXIobGluZU51bWJlcik7XG5cdFx0Y29uc3QgZmlyc3RXaGl0ZXNwYWNlQWZ0ZXJMaW5lTnVtYmVyID0gbGFzdFdoaXRlc3BhY2VCZWZvcmVMaW5lTnVtYmVyICsgMTtcblxuXHRcdGlmIChmaXJzdFdoaXRlc3BhY2VBZnRlckxpbmVOdW1iZXIgPCB0aGlzLl9hcnIubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmlyc3RXaGl0ZXNwYWNlQWZ0ZXJMaW5lTnVtYmVyO1xuXHRcdH1cblxuXHRcdHJldHVybiAtMTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGaW5kIHRoZSBpbmRleCBvZiB0aGUgZmlyc3Qgd2hpdGVzcGFjZSB3aGljaCBoYXMgYGFmdGVyTGluZU51bWJlcmAgPj0gYGxpbmVOdW1iZXJgLlxuXHQgKiBAcmV0dXJuIFRoZSBpbmRleCBvZiB0aGUgZmlyc3Qgd2hpdGVzcGFjZSB3aXRoIGBhZnRlckxpbmVOdW1iZXJgID49IGBsaW5lTnVtYmVyYCBvciAtMSBpZiBubyB3aGl0ZXNwYWNlIGlzIGZvdW5kLlxuXHQgKi9cblx0cHVibGljIGdldEZpcnN0V2hpdGVzcGFjZUluZGV4QWZ0ZXJMaW5lTnVtYmVyKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyIHwgMDtcblxuXHRcdHJldHVybiB0aGlzLl9maW5kRmlyc3RXaGl0ZXNwYWNlQWZ0ZXJMaW5lTnVtYmVyKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgdmVydGljYWwgb2Zmc2V0ICh0aGUgc3VtIG9mIGhlaWdodHMgZm9yIGFsbCBvYmplY3RzIGFib3ZlKSBhIGNlcnRhaW4gbGluZSBudW1iZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSBsaW5lTnVtYmVyIFRoZSBsaW5lIG51bWJlclxuXHQgKiBAcmV0dXJuIFRoZSBzdW0gb2YgaGVpZ2h0cyBmb3IgYWxsIG9iamVjdHMgYWJvdmUgYGxpbmVOdW1iZXJgLlxuXHQgKi9cblx0cHVibGljIGdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihsaW5lTnVtYmVyOiBudW1iZXIsIGluY2x1ZGVWaWV3Wm9uZXMgPSBmYWxzZSk6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyIHwgMDtcblxuXHRcdGxldCBwcmV2aW91c0xpbmVzSGVpZ2h0OiBudW1iZXI7XG5cdFx0aWYgKGxpbmVOdW1iZXIgPiAxKSB7XG5cdFx0XHRwcmV2aW91c0xpbmVzSGVpZ2h0ID0gdGhpcy5fbGluZUhlaWdodCAqIChsaW5lTnVtYmVyIC0gMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHByZXZpb3VzTGluZXNIZWlnaHQgPSAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzV2hpdGVzcGFjZXNIZWlnaHQgPSB0aGlzLmdldFdoaXRlc3BhY2VBY2N1bXVsYXRlZEhlaWdodEJlZm9yZUxpbmVOdW1iZXIobGluZU51bWJlciAtIChpbmNsdWRlVmlld1pvbmVzID8gMSA6IDApKTtcblxuXHRcdHJldHVybiBwcmV2aW91c0xpbmVzSGVpZ2h0ICsgcHJldmlvdXNXaGl0ZXNwYWNlc0hlaWdodCArIHRoaXMuX3BhZGRpbmdUb3A7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSB2ZXJ0aWNhbCBvZmZzZXQgKHRoZSBzdW0gb2YgaGVpZ2h0cyBmb3IgYWxsIG9iamVjdHMgYWJvdmUpIGEgY2VydGFpbiBsaW5lIG51bWJlci5cblx0ICpcblx0ICogQHBhcmFtIGxpbmVOdW1iZXIgVGhlIGxpbmUgbnVtYmVyXG5cdCAqIEByZXR1cm4gVGhlIHN1bSBvZiBoZWlnaHRzIGZvciBhbGwgb2JqZWN0cyBhYm92ZSBgbGluZU51bWJlcmAuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0VmVydGljYWxPZmZzZXRBZnRlckxpbmVOdW1iZXIobGluZU51bWJlcjogbnVtYmVyLCBpbmNsdWRlVmlld1pvbmVzID0gZmFsc2UpOiBudW1iZXIge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHRsaW5lTnVtYmVyID0gbGluZU51bWJlciB8IDA7XG5cdFx0Y29uc3QgcHJldmlvdXNMaW5lc0hlaWdodCA9IHRoaXMuX2xpbmVIZWlnaHQgKiBsaW5lTnVtYmVyO1xuXHRcdGNvbnN0IHByZXZpb3VzV2hpdGVzcGFjZXNIZWlnaHQgPSB0aGlzLmdldFdoaXRlc3BhY2VBY2N1bXVsYXRlZEhlaWdodEJlZm9yZUxpbmVOdW1iZXIobGluZU51bWJlciArIChpbmNsdWRlVmlld1pvbmVzID8gMSA6IDApKTtcblx0XHRyZXR1cm4gcHJldmlvdXNMaW5lc0hlaWdodCArIHByZXZpb3VzV2hpdGVzcGFjZXNIZWlnaHQgKyB0aGlzLl9wYWRkaW5nVG9wO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgaWYgdGhlcmUgaXMgYW55IHdoaXRlc3BhY2UgaW4gdGhlIGRvY3VtZW50LlxuXHQgKi9cblx0cHVibGljIGhhc1doaXRlc3BhY2UoKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdHJldHVybiB0aGlzLmdldFdoaXRlc3BhY2VzQ291bnQoKSA+IDA7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIG1heGltdW0gbWluIHdpZHRoIGZvciBhbGwgd2hpdGVzcGFjZXMuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0V2hpdGVzcGFjZU1pbldpZHRoKCk6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGlmICh0aGlzLl9taW5XaWR0aCA9PT0gLTEpIHtcblx0XHRcdGxldCBtaW5XaWR0aCA9IDA7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdG1pbldpZHRoID0gTWF0aC5tYXgobWluV2lkdGgsIHRoaXMuX2FycltpXS5taW5XaWR0aCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9taW5XaWR0aCA9IG1pbldpZHRoO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbWluV2lkdGg7XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgYHZlcnRpY2FsT2Zmc2V0YCBpcyBiZWxvdyBhbGwgbGluZXMuXG5cdCAqL1xuXHRwdWJsaWMgaXNBZnRlckxpbmVzKHZlcnRpY2FsT2Zmc2V0OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHR0aGlzLl9jaGVja1BlbmRpbmdDaGFuZ2VzKCk7XG5cdFx0Y29uc3QgdG90YWxIZWlnaHQgPSB0aGlzLmdldExpbmVzVG90YWxIZWlnaHQoKTtcblx0XHRyZXR1cm4gdmVydGljYWxPZmZzZXQgPiB0b3RhbEhlaWdodDtcblx0fVxuXG5cdHB1YmxpYyBpc0luVG9wUGFkZGluZyh2ZXJ0aWNhbE9mZnNldDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX3BhZGRpbmdUb3AgPT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdHJldHVybiAodmVydGljYWxPZmZzZXQgPCB0aGlzLl9wYWRkaW5nVG9wKTtcblx0fVxuXG5cdHB1YmxpYyBpc0luQm90dG9tUGFkZGluZyh2ZXJ0aWNhbE9mZnNldDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX3BhZGRpbmdCb3R0b20gPT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGNvbnN0IHRvdGFsSGVpZ2h0ID0gdGhpcy5nZXRMaW5lc1RvdGFsSGVpZ2h0KCk7XG5cdFx0cmV0dXJuICh2ZXJ0aWNhbE9mZnNldCA+PSB0b3RhbEhlaWdodCAtIHRoaXMuX3BhZGRpbmdCb3R0b20pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgdGhlIGZpcnN0IGxpbmUgbnVtYmVyIHRoYXQgaXMgYXQgb3IgYWZ0ZXIgdmVydGljYWwgb2Zmc2V0IGB2ZXJ0aWNhbE9mZnNldGAuXG5cdCAqIGkuZS4gaWYgZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lKGxpbmUpIGlzIHggYW5kIGdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZShsaW5lICsgMSkgaXMgeSwgdGhlblxuXHQgKiBnZXRMaW5lTnVtYmVyQXRPckFmdGVyVmVydGljYWxPZmZzZXQoaSkgPSBsaW5lLCB4IDw9IGkgPCB5LlxuXHQgKlxuXHQgKiBAcGFyYW0gdmVydGljYWxPZmZzZXQgVGhlIHZlcnRpY2FsIG9mZnNldCB0byBzZWFyY2ggYXQuXG5cdCAqIEByZXR1cm4gVGhlIGxpbmUgbnVtYmVyIGF0IG9yIGFmdGVyIHZlcnRpY2FsIG9mZnNldCBgdmVydGljYWxPZmZzZXRgLlxuXHQgKi9cblx0cHVibGljIGdldExpbmVOdW1iZXJBdE9yQWZ0ZXJWZXJ0aWNhbE9mZnNldCh2ZXJ0aWNhbE9mZnNldDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHR0aGlzLl9jaGVja1BlbmRpbmdDaGFuZ2VzKCk7XG5cdFx0dmVydGljYWxPZmZzZXQgPSB2ZXJ0aWNhbE9mZnNldCB8IDA7XG5cblx0XHRpZiAodmVydGljYWxPZmZzZXQgPCAwKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lc0NvdW50ID0gdGhpcy5fbGluZUNvdW50IHwgMDtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fbGluZUhlaWdodDtcblx0XHRsZXQgbWluTGluZU51bWJlciA9IDE7XG5cdFx0bGV0IG1heExpbmVOdW1iZXIgPSBsaW5lc0NvdW50O1xuXG5cdFx0d2hpbGUgKG1pbkxpbmVOdW1iZXIgPCBtYXhMaW5lTnVtYmVyKSB7XG5cdFx0XHRjb25zdCBtaWRMaW5lTnVtYmVyID0gKChtaW5MaW5lTnVtYmVyICsgbWF4TGluZU51bWJlcikgLyAyKSB8IDA7XG5cblx0XHRcdGNvbnN0IG1pZExpbmVOdW1iZXJWZXJ0aWNhbE9mZnNldCA9IHRoaXMuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKG1pZExpbmVOdW1iZXIpIHwgMDtcblxuXHRcdFx0aWYgKHZlcnRpY2FsT2Zmc2V0ID49IG1pZExpbmVOdW1iZXJWZXJ0aWNhbE9mZnNldCArIGxpbmVIZWlnaHQpIHtcblx0XHRcdFx0Ly8gdmVydGljYWwgb2Zmc2V0IGlzIGFmdGVyIG1pZCBsaW5lIG51bWJlclxuXHRcdFx0XHRtaW5MaW5lTnVtYmVyID0gbWlkTGluZU51bWJlciArIDE7XG5cdFx0XHR9IGVsc2UgaWYgKHZlcnRpY2FsT2Zmc2V0ID49IG1pZExpbmVOdW1iZXJWZXJ0aWNhbE9mZnNldCkge1xuXHRcdFx0XHQvLyBIaXRcblx0XHRcdFx0cmV0dXJuIG1pZExpbmVOdW1iZXI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyB2ZXJ0aWNhbCBvZmZzZXQgaXMgYmVmb3JlIG1pZCBsaW5lIG51bWJlciwgYnV0IG1pZCBsaW5lIG51bWJlciBjb3VsZCBzdGlsbCBiZSB3aGF0IHdlJ3JlIHNlYXJjaGluZyBmb3Jcblx0XHRcdFx0bWF4TGluZU51bWJlciA9IG1pZExpbmVOdW1iZXI7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG1pbkxpbmVOdW1iZXIgPiBsaW5lc0NvdW50KSB7XG5cdFx0XHRyZXR1cm4gbGluZXNDb3VudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gbWluTGluZU51bWJlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgYWxsIHRoZSBsaW5lcyBhbmQgdGhlaXIgcmVsYXRpdmUgdmVydGljYWwgb2Zmc2V0cyB0aGF0IGFyZSBwb3NpdGlvbmVkIGJldHdlZW4gYHZlcnRpY2FsT2Zmc2V0MWAgYW5kIGB2ZXJ0aWNhbE9mZnNldDJgLlxuXHQgKlxuXHQgKiBAcGFyYW0gdmVydGljYWxPZmZzZXQxIFRoZSBiZWdpbm5pbmcgb2YgdGhlIHZpZXdwb3J0LlxuXHQgKiBAcGFyYW0gdmVydGljYWxPZmZzZXQyIFRoZSBlbmQgb2YgdGhlIHZpZXdwb3J0LlxuXHQgKiBAcmV0dXJuIEEgc3RydWN0dXJlIGRlc2NyaWJpbmcgdGhlIGxpbmVzIHBvc2l0aW9uZWQgYmV0d2VlbiBgdmVydGljYWxPZmZzZXQxYCBhbmQgYHZlcnRpY2FsT2Zmc2V0MmAuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0TGluZXNWaWV3cG9ydERhdGEodmVydGljYWxPZmZzZXQxOiBudW1iZXIsIHZlcnRpY2FsT2Zmc2V0MjogbnVtYmVyKTogSVBhcnRpYWxWaWV3TGluZXNWaWV3cG9ydERhdGEge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHR2ZXJ0aWNhbE9mZnNldDEgPSB2ZXJ0aWNhbE9mZnNldDEgfCAwO1xuXHRcdHZlcnRpY2FsT2Zmc2V0MiA9IHZlcnRpY2FsT2Zmc2V0MiB8IDA7XG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuX2xpbmVIZWlnaHQ7XG5cblx0XHQvLyBGaW5kIGZpcnN0IGxpbmUgbnVtYmVyXG5cdFx0Ly8gV2UgZG9uJ3QgbGl2ZSBpbiBhIHBlcmZlY3Qgd29ybGQsIHNvIHRoZSBsaW5lIG51bWJlciBtaWdodCBzdGFydCBiZWZvcmUgb3IgYWZ0ZXIgdmVydGljYWxPZmZzZXQxXG5cdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gdGhpcy5nZXRMaW5lTnVtYmVyQXRPckFmdGVyVmVydGljYWxPZmZzZXQodmVydGljYWxPZmZzZXQxKSB8IDA7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyVmVydGljYWxPZmZzZXQgPSB0aGlzLmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihzdGFydExpbmVOdW1iZXIpIHwgMDtcblxuXHRcdGxldCBlbmRMaW5lTnVtYmVyID0gdGhpcy5fbGluZUNvdW50IHwgMDtcblxuXHRcdC8vIEFsc28ga2VlcCB0cmFjayBvZiB3aGF0IHdoaXRlc3BhY2Ugd2UndmUgZ290XG5cdFx0bGV0IHdoaXRlc3BhY2VJbmRleCA9IHRoaXMuZ2V0Rmlyc3RXaGl0ZXNwYWNlSW5kZXhBZnRlckxpbmVOdW1iZXIoc3RhcnRMaW5lTnVtYmVyKSB8IDA7XG5cdFx0Y29uc3Qgd2hpdGVzcGFjZUNvdW50ID0gdGhpcy5nZXRXaGl0ZXNwYWNlc0NvdW50KCkgfCAwO1xuXHRcdGxldCBjdXJyZW50V2hpdGVzcGFjZUhlaWdodDogbnVtYmVyO1xuXHRcdGxldCBjdXJyZW50V2hpdGVzcGFjZUFmdGVyTGluZU51bWJlcjogbnVtYmVyO1xuXG5cdFx0aWYgKHdoaXRlc3BhY2VJbmRleCA9PT0gLTEpIHtcblx0XHRcdHdoaXRlc3BhY2VJbmRleCA9IHdoaXRlc3BhY2VDb3VudDtcblx0XHRcdGN1cnJlbnRXaGl0ZXNwYWNlQWZ0ZXJMaW5lTnVtYmVyID0gZW5kTGluZU51bWJlciArIDE7XG5cdFx0XHRjdXJyZW50V2hpdGVzcGFjZUhlaWdodCA9IDA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN1cnJlbnRXaGl0ZXNwYWNlQWZ0ZXJMaW5lTnVtYmVyID0gdGhpcy5nZXRBZnRlckxpbmVOdW1iZXJGb3JXaGl0ZXNwYWNlSW5kZXgod2hpdGVzcGFjZUluZGV4KSB8IDA7XG5cdFx0XHRjdXJyZW50V2hpdGVzcGFjZUhlaWdodCA9IHRoaXMuZ2V0SGVpZ2h0Rm9yV2hpdGVzcGFjZUluZGV4KHdoaXRlc3BhY2VJbmRleCkgfCAwO1xuXHRcdH1cblxuXHRcdGxldCBjdXJyZW50VmVydGljYWxPZmZzZXQgPSBzdGFydExpbmVOdW1iZXJWZXJ0aWNhbE9mZnNldDtcblx0XHRsZXQgY3VycmVudExpbmVSZWxhdGl2ZU9mZnNldCA9IGN1cnJlbnRWZXJ0aWNhbE9mZnNldDtcblxuXHRcdC8vIElFIChhbGwgdmVyc2lvbnMpIGNhbm5vdCBoYW5kbGUgdW5pdHMgYWJvdmUgYWJvdXQgMSw1MzMsOTA4IHB4LCBzbyBldmVyeSA1MDBrIHBpeGVscyBicmluZyBudW1iZXJzIGRvd25cblx0XHRjb25zdCBTVEVQX1NJWkUgPSA1MDAwMDA7XG5cdFx0bGV0IGJpZ051bWJlcnNEZWx0YSA9IDA7XG5cdFx0aWYgKHN0YXJ0TGluZU51bWJlclZlcnRpY2FsT2Zmc2V0ID49IFNURVBfU0laRSkge1xuXHRcdFx0Ly8gQ29tcHV0ZSBhIGRlbHRhIHRoYXQgZ3VhcmFudGVlcyB0aGF0IGxpbmVzIGFyZSBwb3NpdGlvbmVkIGF0IGBsaW5lSGVpZ2h0YCBpbmNyZW1lbnRzXG5cdFx0XHRiaWdOdW1iZXJzRGVsdGEgPSBNYXRoLmZsb29yKHN0YXJ0TGluZU51bWJlclZlcnRpY2FsT2Zmc2V0IC8gU1RFUF9TSVpFKSAqIFNURVBfU0laRTtcblx0XHRcdGJpZ051bWJlcnNEZWx0YSA9IE1hdGguZmxvb3IoYmlnTnVtYmVyc0RlbHRhIC8gbGluZUhlaWdodCkgKiBsaW5lSGVpZ2h0O1xuXG5cdFx0XHRjdXJyZW50TGluZVJlbGF0aXZlT2Zmc2V0IC09IGJpZ051bWJlcnNEZWx0YTtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lc09mZnNldHM6IG51bWJlcltdID0gW107XG5cblx0XHRjb25zdCB2ZXJ0aWNhbENlbnRlciA9IHZlcnRpY2FsT2Zmc2V0MSArICh2ZXJ0aWNhbE9mZnNldDIgLSB2ZXJ0aWNhbE9mZnNldDEpIC8gMjtcblx0XHRsZXQgY2VudGVyZWRMaW5lTnVtYmVyID0gLTE7XG5cblx0XHQvLyBGaWd1cmUgb3V0IGhvdyBmYXIgdGhlIGxpbmVzIGdvXG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSBlbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblxuXHRcdFx0aWYgKGNlbnRlcmVkTGluZU51bWJlciA9PT0gLTEpIHtcblx0XHRcdFx0Y29uc3QgY3VycmVudExpbmVUb3AgPSBjdXJyZW50VmVydGljYWxPZmZzZXQ7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRMaW5lQm90dG9tID0gY3VycmVudFZlcnRpY2FsT2Zmc2V0ICsgbGluZUhlaWdodDtcblx0XHRcdFx0aWYgKChjdXJyZW50TGluZVRvcCA8PSB2ZXJ0aWNhbENlbnRlciAmJiB2ZXJ0aWNhbENlbnRlciA8IGN1cnJlbnRMaW5lQm90dG9tKSB8fCBjdXJyZW50TGluZVRvcCA+IHZlcnRpY2FsQ2VudGVyKSB7XG5cdFx0XHRcdFx0Y2VudGVyZWRMaW5lTnVtYmVyID0gbGluZU51bWJlcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBDb3VudCBjdXJyZW50IGxpbmUgaGVpZ2h0IGluIHRoZSB2ZXJ0aWNhbCBvZmZzZXRzXG5cdFx0XHRjdXJyZW50VmVydGljYWxPZmZzZXQgKz0gbGluZUhlaWdodDtcblx0XHRcdGxpbmVzT2Zmc2V0c1tsaW5lTnVtYmVyIC0gc3RhcnRMaW5lTnVtYmVyXSA9IGN1cnJlbnRMaW5lUmVsYXRpdmVPZmZzZXQ7XG5cblx0XHRcdC8vIE5leHQgbGluZSBzdGFydHMgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhpcyBvbmVcblx0XHRcdGN1cnJlbnRMaW5lUmVsYXRpdmVPZmZzZXQgKz0gbGluZUhlaWdodDtcblx0XHRcdHdoaWxlIChjdXJyZW50V2hpdGVzcGFjZUFmdGVyTGluZU51bWJlciA9PT0gbGluZU51bWJlcikge1xuXHRcdFx0XHQvLyBQdXNoIGRvd24gbmV4dCBsaW5lIHdpdGggdGhlIGhlaWdodCBvZiB0aGUgY3VycmVudCB3aGl0ZXNwYWNlXG5cdFx0XHRcdGN1cnJlbnRMaW5lUmVsYXRpdmVPZmZzZXQgKz0gY3VycmVudFdoaXRlc3BhY2VIZWlnaHQ7XG5cblx0XHRcdFx0Ly8gQ291bnQgY3VycmVudCB3aGl0ZXNwYWNlIGluIHRoZSB2ZXJ0aWNhbCBvZmZzZXRzXG5cdFx0XHRcdGN1cnJlbnRWZXJ0aWNhbE9mZnNldCArPSBjdXJyZW50V2hpdGVzcGFjZUhlaWdodDtcblx0XHRcdFx0d2hpdGVzcGFjZUluZGV4Kys7XG5cblx0XHRcdFx0aWYgKHdoaXRlc3BhY2VJbmRleCA+PSB3aGl0ZXNwYWNlQ291bnQpIHtcblx0XHRcdFx0XHRjdXJyZW50V2hpdGVzcGFjZUFmdGVyTGluZU51bWJlciA9IGVuZExpbmVOdW1iZXIgKyAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGN1cnJlbnRXaGl0ZXNwYWNlQWZ0ZXJMaW5lTnVtYmVyID0gdGhpcy5nZXRBZnRlckxpbmVOdW1iZXJGb3JXaGl0ZXNwYWNlSW5kZXgod2hpdGVzcGFjZUluZGV4KSB8IDA7XG5cdFx0XHRcdFx0Y3VycmVudFdoaXRlc3BhY2VIZWlnaHQgPSB0aGlzLmdldEhlaWdodEZvcldoaXRlc3BhY2VJbmRleCh3aGl0ZXNwYWNlSW5kZXgpIHwgMDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY3VycmVudFZlcnRpY2FsT2Zmc2V0ID49IHZlcnRpY2FsT2Zmc2V0Mikge1xuXHRcdFx0XHQvLyBXZSBoYXZlIGNvdmVyZWQgdGhlIGVudGlyZSB2aWV3cG9ydCBhcmVhLCB0aW1lIHRvIHN0b3Bcblx0XHRcdFx0ZW5kTGluZU51bWJlciA9IGxpbmVOdW1iZXI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChjZW50ZXJlZExpbmVOdW1iZXIgPT09IC0xKSB7XG5cdFx0XHRjZW50ZXJlZExpbmVOdW1iZXIgPSBlbmRMaW5lTnVtYmVyO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVuZExpbmVOdW1iZXJWZXJ0aWNhbE9mZnNldCA9IHRoaXMuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKGVuZExpbmVOdW1iZXIpIHwgMDtcblxuXHRcdGxldCBjb21wbGV0ZWx5VmlzaWJsZVN0YXJ0TGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjtcblx0XHRsZXQgY29tcGxldGVseVZpc2libGVFbmRMaW5lTnVtYmVyID0gZW5kTGluZU51bWJlcjtcblxuXHRcdGlmIChjb21wbGV0ZWx5VmlzaWJsZVN0YXJ0TGluZU51bWJlciA8IGNvbXBsZXRlbHlWaXNpYmxlRW5kTGluZU51bWJlcikge1xuXHRcdFx0aWYgKHN0YXJ0TGluZU51bWJlclZlcnRpY2FsT2Zmc2V0IDwgdmVydGljYWxPZmZzZXQxKSB7XG5cdFx0XHRcdGNvbXBsZXRlbHlWaXNpYmxlU3RhcnRMaW5lTnVtYmVyKys7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjb21wbGV0ZWx5VmlzaWJsZVN0YXJ0TGluZU51bWJlciA8IGNvbXBsZXRlbHlWaXNpYmxlRW5kTGluZU51bWJlcikge1xuXHRcdFx0aWYgKGVuZExpbmVOdW1iZXJWZXJ0aWNhbE9mZnNldCArIGxpbmVIZWlnaHQgPiB2ZXJ0aWNhbE9mZnNldDIpIHtcblx0XHRcdFx0Y29tcGxldGVseVZpc2libGVFbmRMaW5lTnVtYmVyLS07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGJpZ051bWJlcnNEZWx0YTogYmlnTnVtYmVyc0RlbHRhLFxuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmVOdW1iZXIsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiBlbmRMaW5lTnVtYmVyLFxuXHRcdFx0cmVsYXRpdmVWZXJ0aWNhbE9mZnNldDogbGluZXNPZmZzZXRzLFxuXHRcdFx0Y2VudGVyZWRMaW5lTnVtYmVyOiBjZW50ZXJlZExpbmVOdW1iZXIsXG5cdFx0XHRjb21wbGV0ZWx5VmlzaWJsZVN0YXJ0TGluZU51bWJlcjogY29tcGxldGVseVZpc2libGVTdGFydExpbmVOdW1iZXIsXG5cdFx0XHRjb21wbGV0ZWx5VmlzaWJsZUVuZExpbmVOdW1iZXI6IGNvbXBsZXRlbHlWaXNpYmxlRW5kTGluZU51bWJlcixcblx0XHRcdGxpbmVIZWlnaHQ6IHRoaXMuX2xpbmVIZWlnaHQsXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWZXJ0aWNhbE9mZnNldEZvcldoaXRlc3BhY2VJbmRleCh3aGl0ZXNwYWNlSW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdHdoaXRlc3BhY2VJbmRleCA9IHdoaXRlc3BhY2VJbmRleCB8IDA7XG5cblx0XHRjb25zdCBhZnRlckxpbmVOdW1iZXIgPSB0aGlzLmdldEFmdGVyTGluZU51bWJlckZvcldoaXRlc3BhY2VJbmRleCh3aGl0ZXNwYWNlSW5kZXgpO1xuXG5cdFx0bGV0IHByZXZpb3VzTGluZXNIZWlnaHQ6IG51bWJlcjtcblx0XHRpZiAoYWZ0ZXJMaW5lTnVtYmVyID49IDEpIHtcblx0XHRcdHByZXZpb3VzTGluZXNIZWlnaHQgPSB0aGlzLl9saW5lSGVpZ2h0ICogYWZ0ZXJMaW5lTnVtYmVyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwcmV2aW91c0xpbmVzSGVpZ2h0ID0gMDtcblx0XHR9XG5cblx0XHRsZXQgcHJldmlvdXNXaGl0ZXNwYWNlc0hlaWdodDogbnVtYmVyO1xuXHRcdGlmICh3aGl0ZXNwYWNlSW5kZXggPiAwKSB7XG5cdFx0XHRwcmV2aW91c1doaXRlc3BhY2VzSGVpZ2h0ID0gdGhpcy5nZXRXaGl0ZXNwYWNlc0FjY3VtdWxhdGVkSGVpZ2h0KHdoaXRlc3BhY2VJbmRleCAtIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwcmV2aW91c1doaXRlc3BhY2VzSGVpZ2h0ID0gMDtcblx0XHR9XG5cdFx0cmV0dXJuIHByZXZpb3VzTGluZXNIZWlnaHQgKyBwcmV2aW91c1doaXRlc3BhY2VzSGVpZ2h0ICsgdGhpcy5fcGFkZGluZ1RvcDtcblx0fVxuXG5cdHB1YmxpYyBnZXRXaGl0ZXNwYWNlSW5kZXhBdE9yQWZ0ZXJWZXJ0aWNhbGxPZmZzZXQodmVydGljYWxPZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdHZlcnRpY2FsT2Zmc2V0ID0gdmVydGljYWxPZmZzZXQgfCAwO1xuXG5cdFx0bGV0IG1pbldoaXRlc3BhY2VJbmRleCA9IDA7XG5cdFx0bGV0IG1heFdoaXRlc3BhY2VJbmRleCA9IHRoaXMuZ2V0V2hpdGVzcGFjZXNDb3VudCgpIC0gMTtcblxuXHRcdGlmIChtYXhXaGl0ZXNwYWNlSW5kZXggPCAwKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXG5cdFx0Ly8gU3BlY2lhbCBjYXNlOiBub3RoaW5nIHRvIGJlIGZvdW5kXG5cdFx0Y29uc3QgbWF4V2hpdGVzcGFjZVZlcnRpY2FsT2Zmc2V0ID0gdGhpcy5nZXRWZXJ0aWNhbE9mZnNldEZvcldoaXRlc3BhY2VJbmRleChtYXhXaGl0ZXNwYWNlSW5kZXgpO1xuXHRcdGNvbnN0IG1heFdoaXRlc3BhY2VIZWlnaHQgPSB0aGlzLmdldEhlaWdodEZvcldoaXRlc3BhY2VJbmRleChtYXhXaGl0ZXNwYWNlSW5kZXgpO1xuXHRcdGlmICh2ZXJ0aWNhbE9mZnNldCA+PSBtYXhXaGl0ZXNwYWNlVmVydGljYWxPZmZzZXQgKyBtYXhXaGl0ZXNwYWNlSGVpZ2h0KSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXG5cdFx0d2hpbGUgKG1pbldoaXRlc3BhY2VJbmRleCA8IG1heFdoaXRlc3BhY2VJbmRleCkge1xuXHRcdFx0Y29uc3QgbWlkV2hpdGVzcGFjZUluZGV4ID0gTWF0aC5mbG9vcigobWluV2hpdGVzcGFjZUluZGV4ICsgbWF4V2hpdGVzcGFjZUluZGV4KSAvIDIpO1xuXG5cdFx0XHRjb25zdCBtaWRXaGl0ZXNwYWNlVmVydGljYWxPZmZzZXQgPSB0aGlzLmdldFZlcnRpY2FsT2Zmc2V0Rm9yV2hpdGVzcGFjZUluZGV4KG1pZFdoaXRlc3BhY2VJbmRleCk7XG5cdFx0XHRjb25zdCBtaWRXaGl0ZXNwYWNlSGVpZ2h0ID0gdGhpcy5nZXRIZWlnaHRGb3JXaGl0ZXNwYWNlSW5kZXgobWlkV2hpdGVzcGFjZUluZGV4KTtcblxuXHRcdFx0aWYgKHZlcnRpY2FsT2Zmc2V0ID49IG1pZFdoaXRlc3BhY2VWZXJ0aWNhbE9mZnNldCArIG1pZFdoaXRlc3BhY2VIZWlnaHQpIHtcblx0XHRcdFx0Ly8gdmVydGljYWwgb2Zmc2V0IGlzIGFmdGVyIHdoaXRlc3BhY2Vcblx0XHRcdFx0bWluV2hpdGVzcGFjZUluZGV4ID0gbWlkV2hpdGVzcGFjZUluZGV4ICsgMTtcblx0XHRcdH0gZWxzZSBpZiAodmVydGljYWxPZmZzZXQgPj0gbWlkV2hpdGVzcGFjZVZlcnRpY2FsT2Zmc2V0KSB7XG5cdFx0XHRcdC8vIEhpdFxuXHRcdFx0XHRyZXR1cm4gbWlkV2hpdGVzcGFjZUluZGV4O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gdmVydGljYWwgb2Zmc2V0IGlzIGJlZm9yZSB3aGl0ZXNwYWNlLCBidXQgbWlkV2hpdGVzcGFjZUluZGV4IG1pZ2h0IHN0aWxsIGJlIHdoYXQgd2UncmUgc2VhcmNoaW5nIGZvclxuXHRcdFx0XHRtYXhXaGl0ZXNwYWNlSW5kZXggPSBtaWRXaGl0ZXNwYWNlSW5kZXg7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBtaW5XaGl0ZXNwYWNlSW5kZXg7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGV4YWN0bHkgdGhlIHdoaXRlc3BhY2UgdGhhdCBpcyBsYXlvdXRlZCBhdCBgdmVydGljYWxPZmZzZXRgLlxuXHQgKlxuXHQgKiBAcGFyYW0gdmVydGljYWxPZmZzZXQgVGhlIHZlcnRpY2FsIG9mZnNldC5cblx0ICogQHJldHVybiBQcmVjaXNlbHkgdGhlIHdoaXRlc3BhY2UgdGhhdCBpcyBsYXlvdXRlZCBhdCBgdmVydGljYWxvZmZzZXRgIG9yIG51bGwuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0V2hpdGVzcGFjZUF0VmVydGljYWxPZmZzZXQodmVydGljYWxPZmZzZXQ6IG51bWJlcik6IElWaWV3V2hpdGVzcGFjZVZpZXdwb3J0RGF0YSB8IG51bGwge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHR2ZXJ0aWNhbE9mZnNldCA9IHZlcnRpY2FsT2Zmc2V0IHwgMDtcblxuXHRcdGNvbnN0IGNhbmRpZGF0ZUluZGV4ID0gdGhpcy5nZXRXaGl0ZXNwYWNlSW5kZXhBdE9yQWZ0ZXJWZXJ0aWNhbGxPZmZzZXQodmVydGljYWxPZmZzZXQpO1xuXG5cdFx0aWYgKGNhbmRpZGF0ZUluZGV4IDwgMCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKGNhbmRpZGF0ZUluZGV4ID49IHRoaXMuZ2V0V2hpdGVzcGFjZXNDb3VudCgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBjYW5kaWRhdGVUb3AgPSB0aGlzLmdldFZlcnRpY2FsT2Zmc2V0Rm9yV2hpdGVzcGFjZUluZGV4KGNhbmRpZGF0ZUluZGV4KTtcblxuXHRcdGlmIChjYW5kaWRhdGVUb3AgPiB2ZXJ0aWNhbE9mZnNldCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2FuZGlkYXRlSGVpZ2h0ID0gdGhpcy5nZXRIZWlnaHRGb3JXaGl0ZXNwYWNlSW5kZXgoY2FuZGlkYXRlSW5kZXgpO1xuXHRcdGNvbnN0IGNhbmRpZGF0ZUlkID0gdGhpcy5nZXRJZEZvcldoaXRlc3BhY2VJbmRleChjYW5kaWRhdGVJbmRleCk7XG5cdFx0Y29uc3QgY2FuZGlkYXRlQWZ0ZXJMaW5lTnVtYmVyID0gdGhpcy5nZXRBZnRlckxpbmVOdW1iZXJGb3JXaGl0ZXNwYWNlSW5kZXgoY2FuZGlkYXRlSW5kZXgpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiBjYW5kaWRhdGVJZCxcblx0XHRcdGFmdGVyTGluZU51bWJlcjogY2FuZGlkYXRlQWZ0ZXJMaW5lTnVtYmVyLFxuXHRcdFx0dmVydGljYWxPZmZzZXQ6IGNhbmRpZGF0ZVRvcCxcblx0XHRcdGhlaWdodDogY2FuZGlkYXRlSGVpZ2h0XG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgYSBsaXN0IG9mIHdoaXRlc3BhY2VzIHRoYXQgYXJlIHBvc2l0aW9uZWQgYmV0d2VlbiBgdmVydGljYWxPZmZzZXQxYCBhbmQgYHZlcnRpY2FsT2Zmc2V0MmAuXG5cdCAqXG5cdCAqIEBwYXJhbSB2ZXJ0aWNhbE9mZnNldDEgVGhlIGJlZ2lubmluZyBvZiB0aGUgdmlld3BvcnQuXG5cdCAqIEBwYXJhbSB2ZXJ0aWNhbE9mZnNldDIgVGhlIGVuZCBvZiB0aGUgdmlld3BvcnQuXG5cdCAqIEByZXR1cm4gQW4gYXJyYXkgd2l0aCBhbGwgdGhlIHdoaXRlc3BhY2VzIGluIHRoZSB2aWV3cG9ydC4gSWYgbm8gd2hpdGVzcGFjZSBpcyBpbiB2aWV3cG9ydCwgdGhlIGFycmF5IGlzIGVtcHR5LlxuXHQgKi9cblx0cHVibGljIGdldFdoaXRlc3BhY2VWaWV3cG9ydERhdGEodmVydGljYWxPZmZzZXQxOiBudW1iZXIsIHZlcnRpY2FsT2Zmc2V0MjogbnVtYmVyKTogSVZpZXdXaGl0ZXNwYWNlVmlld3BvcnREYXRhW10ge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHR2ZXJ0aWNhbE9mZnNldDEgPSB2ZXJ0aWNhbE9mZnNldDEgfCAwO1xuXHRcdHZlcnRpY2FsT2Zmc2V0MiA9IHZlcnRpY2FsT2Zmc2V0MiB8IDA7XG5cblx0XHRjb25zdCBzdGFydEluZGV4ID0gdGhpcy5nZXRXaGl0ZXNwYWNlSW5kZXhBdE9yQWZ0ZXJWZXJ0aWNhbGxPZmZzZXQodmVydGljYWxPZmZzZXQxKTtcblx0XHRjb25zdCBlbmRJbmRleCA9IHRoaXMuZ2V0V2hpdGVzcGFjZXNDb3VudCgpIC0gMTtcblxuXHRcdGlmIChzdGFydEluZGV4IDwgMCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdDogSVZpZXdXaGl0ZXNwYWNlVmlld3BvcnREYXRhW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8PSBlbmRJbmRleDsgaSsrKSB7XG5cdFx0XHRjb25zdCB0b3AgPSB0aGlzLmdldFZlcnRpY2FsT2Zmc2V0Rm9yV2hpdGVzcGFjZUluZGV4KGkpO1xuXHRcdFx0Y29uc3QgaGVpZ2h0ID0gdGhpcy5nZXRIZWlnaHRGb3JXaGl0ZXNwYWNlSW5kZXgoaSk7XG5cdFx0XHRpZiAodG9wID49IHZlcnRpY2FsT2Zmc2V0Mikge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRpZDogdGhpcy5nZXRJZEZvcldoaXRlc3BhY2VJbmRleChpKSxcblx0XHRcdFx0YWZ0ZXJMaW5lTnVtYmVyOiB0aGlzLmdldEFmdGVyTGluZU51bWJlckZvcldoaXRlc3BhY2VJbmRleChpKSxcblx0XHRcdFx0dmVydGljYWxPZmZzZXQ6IHRvcCxcblx0XHRcdFx0aGVpZ2h0OiBoZWlnaHRcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGFsbCB3aGl0ZXNwYWNlcy5cblx0ICovXG5cdHB1YmxpYyBnZXRXaGl0ZXNwYWNlcygpOiBJRWRpdG9yV2hpdGVzcGFjZVtdIHtcblx0XHR0aGlzLl9jaGVja1BlbmRpbmdDaGFuZ2VzKCk7XG5cdFx0cmV0dXJuIHRoaXMuX2Fyci5zbGljZSgwKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgbnVtYmVyIG9mIHdoaXRlc3BhY2VzLlxuXHQgKi9cblx0cHVibGljIGdldFdoaXRlc3BhY2VzQ291bnQoKTogbnVtYmVyIHtcblx0XHR0aGlzLl9jaGVja1BlbmRpbmdDaGFuZ2VzKCk7XG5cdFx0cmV0dXJuIHRoaXMuX2Fyci5sZW5ndGg7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBgaWRgIGZvciB3aGl0ZXNwYWNlIGF0IGluZGV4IGBpbmRleGAuXG5cdCAqXG5cdCAqIEBwYXJhbSBpbmRleCBUaGUgaW5kZXggb2YgdGhlIHdoaXRlc3BhY2UuXG5cdCAqIEByZXR1cm4gYGlkYCBvZiB3aGl0ZXNwYWNlIGF0IGBpbmRleGAuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0SWRGb3JXaGl0ZXNwYWNlSW5kZXgoaW5kZXg6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGluZGV4ID0gaW5kZXggfCAwO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2FycltpbmRleF0uaWQ7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBgYWZ0ZXJMaW5lTnVtYmVyYCBmb3Igd2hpdGVzcGFjZSBhdCBpbmRleCBgaW5kZXhgLlxuXHQgKlxuXHQgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IG9mIHRoZSB3aGl0ZXNwYWNlLlxuXHQgKiBAcmV0dXJuIGBhZnRlckxpbmVOdW1iZXJgIG9mIHdoaXRlc3BhY2UgYXQgYGluZGV4YC5cblx0ICovXG5cdHB1YmxpYyBnZXRBZnRlckxpbmVOdW1iZXJGb3JXaGl0ZXNwYWNlSW5kZXgoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuXHRcdGluZGV4ID0gaW5kZXggfCAwO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2FycltpbmRleF0uYWZ0ZXJMaW5lTnVtYmVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgYGhlaWdodGAgZm9yIHdoaXRlc3BhY2UgYXQgaW5kZXggYGluZGV4YC5cblx0ICpcblx0ICogQHBhcmFtIGluZGV4IFRoZSBpbmRleCBvZiB0aGUgd2hpdGVzcGFjZS5cblx0ICogQHJldHVybiBgaGVpZ2h0YCBvZiB3aGl0ZXNwYWNlIGF0IGBpbmRleGAuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0SGVpZ2h0Rm9yV2hpdGVzcGFjZUluZGV4KGluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHRoaXMuX2NoZWNrUGVuZGluZ0NoYW5nZXMoKTtcblx0XHRpbmRleCA9IGluZGV4IHwgMDtcblxuXHRcdHJldHVybiB0aGlzLl9hcnJbaW5kZXhdLmhlaWdodDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsWUFBWSxhQUFhO0FBS3pCLE1BQU0sZUFBZTtBQUFBLEVBTXBCLGNBQWM7QUFDYixTQUFLLGNBQWM7QUFDbkIsU0FBSyxXQUFXLENBQUM7QUFDakIsU0FBSyxXQUFXLENBQUM7QUFDakIsU0FBSyxXQUFXLENBQUM7QUFBQSxFQUNsQjtBQUFBLEVBRU8sT0FBTyxHQUEyQjtBQUN4QyxTQUFLLGNBQWM7QUFDbkIsU0FBSyxTQUFTLEtBQUssQ0FBQztBQUFBLEVBQ3JCO0FBQUEsRUFFTyxPQUFPLEdBQXlCO0FBQ3RDLFNBQUssY0FBYztBQUNuQixTQUFLLFNBQVMsS0FBSyxDQUFDO0FBQUEsRUFDckI7QUFBQSxFQUVPLE9BQU8sR0FBeUI7QUFDdEMsU0FBSyxj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O0FBQzFCLHNCQUFrQixrQkFBa0I7QUFDcEMsc0JBQWtCLGtCQUFrQjtBQUVwQyxVQUFNLGFBQWEsS0FBSywyQ0FBMkMsZUFBZTtBQUNsRixVQUFNLFdBQVcsS0FBSyxvQkFBb0IsSUFBSTtBQUU5QyxRQUFJLGFBQWEsR0FBRztBQUNuQixhQUFPLENBQUM7QUFBQSxJQUNUO0FBRUEsVUFBTSxTQUF3QyxDQUFDO0FBQy9DLGFBQVMsSUFBSSxZQUFZLEtBQUssVUFBVSxLQUFLO0FBQzVDLFlBQU0sTUFBTSxLQUFLLG9DQUFvQyxDQUFDO0FBQ3RELFlBQU0sU0FBUyxLQUFLLDRCQUE0QixDQUFDO0FBQ2pELFVBQUksT0FBTyxpQkFBaUI7QUFDM0I7QUFBQSxNQUNEO0FBRUEsYUFBTyxLQUFLO0FBQUEsUUFDWCxJQUFJLEtBQUssd0JBQXdCLENBQUM7QUFBQSxRQUNsQyxpQkFBaUIsS0FBSyxxQ0FBcUMsQ0FBQztBQUFBLFFBQzVELGdCQUFnQjtBQUFBLFFBQ2hCO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLTyxpQkFBc0M7QUFDNUMsU0FBSyxxQkFBcUI7QUFDMUIsV0FBTyxLQUFLLEtBQUssTUFBTSxDQUFDO0FBQUEsRUFDekI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtPLHNCQUE4QjtBQUNwQyxTQUFLLHFCQUFxQjtBQUMxQixXQUFPLEtBQUssS0FBSztBQUFBLEVBQ2xCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRTyx3QkFBd0IsT0FBdUI7QUFDckQsU0FBSyxxQkFBcUI7QUFDMUIsWUFBUSxRQUFRO0FBRWhCLFdBQU8sS0FBSyxLQUFLLEtBQUssRUFBRTtBQUFBLEVBQ3pCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRTyxxQ0FBcUMsT0FBdUI7QUFDbEUsU0FBSyxxQkFBcUI7QUFDMUIsWUFBUSxRQUFRO0FBRWhCLFdBQU8sS0FBSyxLQUFLLEtBQUssRUFBRTtBQUFBLEVBQ3pCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRTyw0QkFBNEIsT0FBdUI7QUFDekQsU0FBSyxxQkFBcUI7QUFDMUIsWUFBUSxRQUFRO0FBRWhCLFdBQU8sS0FBSyxLQUFLLEtBQUssRUFBRTtBQUFBLEVBQ3pCO0FBQ0Q7QUF2MEJhLGFBRUcsaUJBQWlCO0FBRjFCLElBQU0sY0FBTjsiLAogICJuYW1lcyI6IFsicmVzdWx0Il0KfQo=
