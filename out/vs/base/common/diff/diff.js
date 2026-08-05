import { DiffChange } from "./diffChange.js";
import { stringHash } from "../hash.js";
import { Constants } from "../uint.js";
class StringDiffSequence {
  constructor(source) {
    this.source = source;
  }
  getElements() {
    const source = this.source;
    const characters = new Int32Array(source.length);
    for (let i = 0, len = source.length; i < len; i++) {
      characters[i] = source.charCodeAt(i);
    }
    return characters;
  }
}
function stringDiff(original, modified, pretty) {
  return new LcsDiff(new StringDiffSequence(original), new StringDiffSequence(modified)).ComputeDiff(pretty).changes;
}
class Debug {
  static Assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }
}
class MyArray {
  /**
   * Copies a range of elements from an Array starting at the specified source index and pastes
   * them to another Array starting at the specified destination index. The length and the indexes
   * are specified as 64-bit integers.
   * sourceArray:
   *		The Array that contains the data to copy.
   * sourceIndex:
   *		A 64-bit integer that represents the index in the sourceArray at which copying begins.
   * destinationArray:
   *		The Array that receives the data.
   * destinationIndex:
   *		A 64-bit integer that represents the index in the destinationArray at which storing begins.
   * length:
   *		A 64-bit integer that represents the number of elements to copy.
   */
  static Copy(sourceArray, sourceIndex, destinationArray, destinationIndex, length) {
    for (let i = 0; i < length; i++) {
      destinationArray[destinationIndex + i] = sourceArray[sourceIndex + i];
    }
  }
  static Copy2(sourceArray, sourceIndex, destinationArray, destinationIndex, length) {
    for (let i = 0; i < length; i++) {
      destinationArray[destinationIndex + i] = sourceArray[sourceIndex + i];
    }
  }
}
var LocalConstants = /* @__PURE__ */ ((LocalConstants2) => {
  LocalConstants2[LocalConstants2["MaxDifferencesHistory"] = 1447] = "MaxDifferencesHistory";
  return LocalConstants2;
})(LocalConstants || {});
class DiffChangeHelper {
  /**
   * Constructs a new DiffChangeHelper for the given DiffSequences.
   */
  constructor() {
    this.m_changes = [];
    this.m_originalStart = Constants.MAX_SAFE_SMALL_INTEGER;
    this.m_modifiedStart = Constants.MAX_SAFE_SMALL_INTEGER;
    this.m_originalCount = 0;
    this.m_modifiedCount = 0;
  }
  /**
   * Marks the beginning of the next change in the set of differences.
   */
  MarkNextChange() {
    if (this.m_originalCount > 0 || this.m_modifiedCount > 0) {
      this.m_changes.push(new DiffChange(
        this.m_originalStart,
        this.m_originalCount,
        this.m_modifiedStart,
        this.m_modifiedCount
      ));
    }
    this.m_originalCount = 0;
    this.m_modifiedCount = 0;
    this.m_originalStart = Constants.MAX_SAFE_SMALL_INTEGER;
    this.m_modifiedStart = Constants.MAX_SAFE_SMALL_INTEGER;
  }
  /**
   * Adds the original element at the given position to the elements
   * affected by the current change. The modified index gives context
   * to the change position with respect to the original sequence.
   * @param originalIndex The index of the original element to add.
   * @param modifiedIndex The index of the modified element that provides corresponding position in the modified sequence.
   */
  AddOriginalElement(originalIndex, modifiedIndex) {
    this.m_originalStart = Math.min(this.m_originalStart, originalIndex);
    this.m_modifiedStart = Math.min(this.m_modifiedStart, modifiedIndex);
    this.m_originalCount++;
  }
  /**
   * Adds the modified element at the given position to the elements
   * affected by the current change. The original index gives context
   * to the change position with respect to the modified sequence.
   * @param originalIndex The index of the original element that provides corresponding position in the original sequence.
   * @param modifiedIndex The index of the modified element to add.
   */
  AddModifiedElement(originalIndex, modifiedIndex) {
    this.m_originalStart = Math.min(this.m_originalStart, originalIndex);
    this.m_modifiedStart = Math.min(this.m_modifiedStart, modifiedIndex);
    this.m_modifiedCount++;
  }
  /**
   * Retrieves all of the changes marked by the class.
   */
  getChanges() {
    if (this.m_originalCount > 0 || this.m_modifiedCount > 0) {
      this.MarkNextChange();
    }
    return this.m_changes;
  }
  /**
   * Retrieves all of the changes marked by the class in the reverse order
   */
  getReverseChanges() {
    if (this.m_originalCount > 0 || this.m_modifiedCount > 0) {
      this.MarkNextChange();
    }
    this.m_changes.reverse();
    return this.m_changes;
  }
}
class LcsDiff {
  /**
   * Constructs the DiffFinder
   */
  constructor(originalSequence, modifiedSequence, continueProcessingPredicate = null) {
    this.ContinueProcessingPredicate = continueProcessingPredicate;
    this._originalSequence = originalSequence;
    this._modifiedSequence = modifiedSequence;
    const [originalStringElements, originalElementsOrHash, originalHasStrings] = LcsDiff._getElements(originalSequence);
    const [modifiedStringElements, modifiedElementsOrHash, modifiedHasStrings] = LcsDiff._getElements(modifiedSequence);
    this._hasStrings = originalHasStrings && modifiedHasStrings;
    this._originalStringElements = originalStringElements;
    this._originalElementsOrHash = originalElementsOrHash;
    this._modifiedStringElements = modifiedStringElements;
    this._modifiedElementsOrHash = modifiedElementsOrHash;
    this.m_forwardHistory = [];
    this.m_reverseHistory = [];
  }
  static _isStringArray(arr) {
    return arr.length > 0 && typeof arr[0] === "string";
  }
  static _getElements(sequence) {
    const elements = sequence.getElements();
    if (LcsDiff._isStringArray(elements)) {
      const hashes = new Int32Array(elements.length);
      for (let i = 0, len = elements.length; i < len; i++) {
        hashes[i] = stringHash(elements[i], 0);
      }
      return [elements, hashes, true];
    }
    if (elements instanceof Int32Array) {
      return [[], elements, false];
    }
    return [[], new Int32Array(elements), false];
  }
  ElementsAreEqual(originalIndex, newIndex) {
    if (this._originalElementsOrHash[originalIndex] !== this._modifiedElementsOrHash[newIndex]) {
      return false;
    }
    return this._hasStrings ? this._originalStringElements[originalIndex] === this._modifiedStringElements[newIndex] : true;
  }
  ElementsAreStrictEqual(originalIndex, newIndex) {
    if (!this.ElementsAreEqual(originalIndex, newIndex)) {
      return false;
    }
    const originalElement = LcsDiff._getStrictElement(this._originalSequence, originalIndex);
    const modifiedElement = LcsDiff._getStrictElement(this._modifiedSequence, newIndex);
    return originalElement === modifiedElement;
  }
  static _getStrictElement(sequence, index) {
    if (typeof sequence.getStrictElement === "function") {
      return sequence.getStrictElement(index);
    }
    return null;
  }
  OriginalElementsAreEqual(index1, index2) {
    if (this._originalElementsOrHash[index1] !== this._originalElementsOrHash[index2]) {
      return false;
    }
    return this._hasStrings ? this._originalStringElements[index1] === this._originalStringElements[index2] : true;
  }
  ModifiedElementsAreEqual(index1, index2) {
    if (this._modifiedElementsOrHash[index1] !== this._modifiedElementsOrHash[index2]) {
      return false;
    }
    return this._hasStrings ? this._modifiedStringElements[index1] === this._modifiedStringElements[index2] : true;
  }
  ComputeDiff(pretty) {
    return this._ComputeDiff(0, this._originalElementsOrHash.length - 1, 0, this._modifiedElementsOrHash.length - 1, pretty);
  }
  /**
   * Computes the differences between the original and modified input
   * sequences on the bounded range.
   * @returns An array of the differences between the two input sequences.
   */
  _ComputeDiff(originalStart, originalEnd, modifiedStart, modifiedEnd, pretty) {
    const quitEarlyArr = [false];
    let changes = this.ComputeDiffRecursive(originalStart, originalEnd, modifiedStart, modifiedEnd, quitEarlyArr);
    if (pretty) {
      changes = this.PrettifyChanges(changes);
    }
    return {
      quitEarly: quitEarlyArr[0],
      changes
    };
  }
  /**
   * Private helper method which computes the differences on the bounded range
   * recursively.
   * @returns An array of the differences between the two input sequences.
   */
  ComputeDiffRecursive(originalStart, originalEnd, modifiedStart, modifiedEnd, quitEarlyArr) {
    quitEarlyArr[0] = false;
    while (originalStart <= originalEnd && modifiedStart <= modifiedEnd && this.ElementsAreEqual(originalStart, modifiedStart)) {
      originalStart++;
      modifiedStart++;
    }
    while (originalEnd >= originalStart && modifiedEnd >= modifiedStart && this.ElementsAreEqual(originalEnd, modifiedEnd)) {
      originalEnd--;
      modifiedEnd--;
    }
    if (originalStart > originalEnd || modifiedStart > modifiedEnd) {
      let changes;
      if (modifiedStart <= modifiedEnd) {
        Debug.Assert(originalStart === originalEnd + 1, "originalStart should only be one more than originalEnd");
        changes = [
          new DiffChange(originalStart, 0, modifiedStart, modifiedEnd - modifiedStart + 1)
        ];
      } else if (originalStart <= originalEnd) {
        Debug.Assert(modifiedStart === modifiedEnd + 1, "modifiedStart should only be one more than modifiedEnd");
        changes = [
          new DiffChange(originalStart, originalEnd - originalStart + 1, modifiedStart, 0)
        ];
      } else {
        Debug.Assert(originalStart === originalEnd + 1, "originalStart should only be one more than originalEnd");
        Debug.Assert(modifiedStart === modifiedEnd + 1, "modifiedStart should only be one more than modifiedEnd");
        changes = [];
      }
      return changes;
    }
    const midOriginalArr = [0];
    const midModifiedArr = [0];
    const result = this.ComputeRecursionPoint(originalStart, originalEnd, modifiedStart, modifiedEnd, midOriginalArr, midModifiedArr, quitEarlyArr);
    const midOriginal = midOriginalArr[0];
    const midModified = midModifiedArr[0];
    if (result !== null) {
      return result;
    } else if (!quitEarlyArr[0]) {
      const leftChanges = this.ComputeDiffRecursive(originalStart, midOriginal, modifiedStart, midModified, quitEarlyArr);
      let rightChanges = [];
      if (!quitEarlyArr[0]) {
        rightChanges = this.ComputeDiffRecursive(midOriginal + 1, originalEnd, midModified + 1, modifiedEnd, quitEarlyArr);
      } else {
        rightChanges = [
          new DiffChange(midOriginal + 1, originalEnd - (midOriginal + 1) + 1, midModified + 1, modifiedEnd - (midModified + 1) + 1)
        ];
      }
      return this.ConcatenateChanges(leftChanges, rightChanges);
    }
    return [
      new DiffChange(originalStart, originalEnd - originalStart + 1, modifiedStart, modifiedEnd - modifiedStart + 1)
    ];
  }
  WALKTRACE(diagonalForwardBase, diagonalForwardStart, diagonalForwardEnd, diagonalForwardOffset, diagonalReverseBase, diagonalReverseStart, diagonalReverseEnd, diagonalReverseOffset, forwardPoints, reversePoints, originalIndex, originalEnd, midOriginalArr, modifiedIndex, modifiedEnd, midModifiedArr, deltaIsEven, quitEarlyArr) {
    let forwardChanges = null;
    let reverseChanges = null;
    let changeHelper = new DiffChangeHelper();
    let diagonalMin = diagonalForwardStart;
    let diagonalMax = diagonalForwardEnd;
    let diagonalRelative = midOriginalArr[0] - midModifiedArr[0] - diagonalForwardOffset;
    let lastOriginalIndex = Constants.MIN_SAFE_SMALL_INTEGER;
    let historyIndex = this.m_forwardHistory.length - 1;
    do {
      const diagonal = diagonalRelative + diagonalForwardBase;
      if (diagonal === diagonalMin || diagonal < diagonalMax && forwardPoints[diagonal - 1] < forwardPoints[diagonal + 1]) {
        originalIndex = forwardPoints[diagonal + 1];
        modifiedIndex = originalIndex - diagonalRelative - diagonalForwardOffset;
        if (originalIndex < lastOriginalIndex) {
          changeHelper.MarkNextChange();
        }
        lastOriginalIndex = originalIndex;
        changeHelper.AddModifiedElement(originalIndex + 1, modifiedIndex);
        diagonalRelative = diagonal + 1 - diagonalForwardBase;
      } else {
        originalIndex = forwardPoints[diagonal - 1] + 1;
        modifiedIndex = originalIndex - diagonalRelative - diagonalForwardOffset;
        if (originalIndex < lastOriginalIndex) {
          changeHelper.MarkNextChange();
        }
        lastOriginalIndex = originalIndex - 1;
        changeHelper.AddOriginalElement(originalIndex, modifiedIndex + 1);
        diagonalRelative = diagonal - 1 - diagonalForwardBase;
      }
      if (historyIndex >= 0) {
        forwardPoints = this.m_forwardHistory[historyIndex];
        diagonalForwardBase = forwardPoints[0];
        diagonalMin = 1;
        diagonalMax = forwardPoints.length - 1;
      }
    } while (--historyIndex >= -1);
    forwardChanges = changeHelper.getReverseChanges();
    if (quitEarlyArr[0]) {
      let originalStartPoint = midOriginalArr[0] + 1;
      let modifiedStartPoint = midModifiedArr[0] + 1;
      if (forwardChanges !== null && forwardChanges.length > 0) {
        const lastForwardChange = forwardChanges[forwardChanges.length - 1];
        originalStartPoint = Math.max(originalStartPoint, lastForwardChange.getOriginalEnd());
        modifiedStartPoint = Math.max(modifiedStartPoint, lastForwardChange.getModifiedEnd());
      }
      reverseChanges = [
        new DiffChange(
          originalStartPoint,
          originalEnd - originalStartPoint + 1,
          modifiedStartPoint,
          modifiedEnd - modifiedStartPoint + 1
        )
      ];
    } else {
      changeHelper = new DiffChangeHelper();
      diagonalMin = diagonalReverseStart;
      diagonalMax = diagonalReverseEnd;
      diagonalRelative = midOriginalArr[0] - midModifiedArr[0] - diagonalReverseOffset;
      lastOriginalIndex = Constants.MAX_SAFE_SMALL_INTEGER;
      historyIndex = deltaIsEven ? this.m_reverseHistory.length - 1 : this.m_reverseHistory.length - 2;
      do {
        const diagonal = diagonalRelative + diagonalReverseBase;
        if (diagonal === diagonalMin || diagonal < diagonalMax && reversePoints[diagonal - 1] >= reversePoints[diagonal + 1]) {
          originalIndex = reversePoints[diagonal + 1] - 1;
          modifiedIndex = originalIndex - diagonalRelative - diagonalReverseOffset;
          if (originalIndex > lastOriginalIndex) {
            changeHelper.MarkNextChange();
          }
          lastOriginalIndex = originalIndex + 1;
          changeHelper.AddOriginalElement(originalIndex + 1, modifiedIndex + 1);
          diagonalRelative = diagonal + 1 - diagonalReverseBase;
        } else {
          originalIndex = reversePoints[diagonal - 1];
          modifiedIndex = originalIndex - diagonalRelative - diagonalReverseOffset;
          if (originalIndex > lastOriginalIndex) {
            changeHelper.MarkNextChange();
          }
          lastOriginalIndex = originalIndex;
          changeHelper.AddModifiedElement(originalIndex + 1, modifiedIndex + 1);
          diagonalRelative = diagonal - 1 - diagonalReverseBase;
        }
        if (historyIndex >= 0) {
          reversePoints = this.m_reverseHistory[historyIndex];
          diagonalReverseBase = reversePoints[0];
          diagonalMin = 1;
          diagonalMax = reversePoints.length - 1;
        }
      } while (--historyIndex >= -1);
      reverseChanges = changeHelper.getChanges();
    }
    return this.ConcatenateChanges(forwardChanges, reverseChanges);
  }
  /**
   * Given the range to compute the diff on, this method finds the point:
   * (midOriginal, midModified)
   * that exists in the middle of the LCS of the two sequences and
   * is the point at which the LCS problem may be broken down recursively.
   * This method will try to keep the LCS trace in memory. If the LCS recursion
   * point is calculated and the full trace is available in memory, then this method
   * will return the change list.
   * @param originalStart The start bound of the original sequence range
   * @param originalEnd The end bound of the original sequence range
   * @param modifiedStart The start bound of the modified sequence range
   * @param modifiedEnd The end bound of the modified sequence range
   * @param midOriginal The middle point of the original sequence range
   * @param midModified The middle point of the modified sequence range
   * @returns The diff changes, if available, otherwise null
   */
  ComputeRecursionPoint(originalStart, originalEnd, modifiedStart, modifiedEnd, midOriginalArr, midModifiedArr, quitEarlyArr) {
    let originalIndex = 0, modifiedIndex = 0;
    let diagonalForwardStart = 0, diagonalForwardEnd = 0;
    let diagonalReverseStart = 0, diagonalReverseEnd = 0;
    originalStart--;
    modifiedStart--;
    midOriginalArr[0] = 0;
    midModifiedArr[0] = 0;
    this.m_forwardHistory = [];
    this.m_reverseHistory = [];
    const maxDifferences = originalEnd - originalStart + (modifiedEnd - modifiedStart);
    const numDiagonals = maxDifferences + 1;
    const forwardPoints = new Int32Array(numDiagonals);
    const reversePoints = new Int32Array(numDiagonals);
    const diagonalForwardBase = modifiedEnd - modifiedStart;
    const diagonalReverseBase = originalEnd - originalStart;
    const diagonalForwardOffset = originalStart - modifiedStart;
    const diagonalReverseOffset = originalEnd - modifiedEnd;
    const delta = diagonalReverseBase - diagonalForwardBase;
    const deltaIsEven = delta % 2 === 0;
    forwardPoints[diagonalForwardBase] = originalStart;
    reversePoints[diagonalReverseBase] = originalEnd;
    quitEarlyArr[0] = false;
    for (let numDifferences = 1; numDifferences <= maxDifferences / 2 + 1; numDifferences++) {
      let furthestOriginalIndex = 0;
      let furthestModifiedIndex = 0;
      diagonalForwardStart = this.ClipDiagonalBound(diagonalForwardBase - numDifferences, numDifferences, diagonalForwardBase, numDiagonals);
      diagonalForwardEnd = this.ClipDiagonalBound(diagonalForwardBase + numDifferences, numDifferences, diagonalForwardBase, numDiagonals);
      for (let diagonal = diagonalForwardStart; diagonal <= diagonalForwardEnd; diagonal += 2) {
        if (diagonal === diagonalForwardStart || diagonal < diagonalForwardEnd && forwardPoints[diagonal - 1] < forwardPoints[diagonal + 1]) {
          originalIndex = forwardPoints[diagonal + 1];
        } else {
          originalIndex = forwardPoints[diagonal - 1] + 1;
        }
        modifiedIndex = originalIndex - (diagonal - diagonalForwardBase) - diagonalForwardOffset;
        const tempOriginalIndex = originalIndex;
        while (originalIndex < originalEnd && modifiedIndex < modifiedEnd && this.ElementsAreEqual(originalIndex + 1, modifiedIndex + 1)) {
          originalIndex++;
          modifiedIndex++;
        }
        forwardPoints[diagonal] = originalIndex;
        if (originalIndex + modifiedIndex > furthestOriginalIndex + furthestModifiedIndex) {
          furthestOriginalIndex = originalIndex;
          furthestModifiedIndex = modifiedIndex;
        }
        if (!deltaIsEven && Math.abs(diagonal - diagonalReverseBase) <= numDifferences - 1) {
          if (originalIndex >= reversePoints[diagonal]) {
            midOriginalArr[0] = originalIndex;
            midModifiedArr[0] = modifiedIndex;
            if (tempOriginalIndex <= reversePoints[diagonal] && 1447 /* MaxDifferencesHistory */ > 0 && numDifferences <= 1447 /* MaxDifferencesHistory */ + 1) {
              return this.WALKTRACE(
                diagonalForwardBase,
                diagonalForwardStart,
                diagonalForwardEnd,
                diagonalForwardOffset,
                diagonalReverseBase,
                diagonalReverseStart,
                diagonalReverseEnd,
                diagonalReverseOffset,
                forwardPoints,
                reversePoints,
                originalIndex,
                originalEnd,
                midOriginalArr,
                modifiedIndex,
                modifiedEnd,
                midModifiedArr,
                deltaIsEven,
                quitEarlyArr
              );
            } else {
              return null;
            }
          }
        }
      }
      const matchLengthOfLongest = (furthestOriginalIndex - originalStart + (furthestModifiedIndex - modifiedStart) - numDifferences) / 2;
      if (this.ContinueProcessingPredicate !== null && !this.ContinueProcessingPredicate(furthestOriginalIndex, matchLengthOfLongest)) {
        quitEarlyArr[0] = true;
        midOriginalArr[0] = furthestOriginalIndex;
        midModifiedArr[0] = furthestModifiedIndex;
        if (matchLengthOfLongest > 0 && 1447 /* MaxDifferencesHistory */ > 0 && numDifferences <= 1447 /* MaxDifferencesHistory */ + 1) {
          return this.WALKTRACE(
            diagonalForwardBase,
            diagonalForwardStart,
            diagonalForwardEnd,
            diagonalForwardOffset,
            diagonalReverseBase,
            diagonalReverseStart,
            diagonalReverseEnd,
            diagonalReverseOffset,
            forwardPoints,
            reversePoints,
            originalIndex,
            originalEnd,
            midOriginalArr,
            modifiedIndex,
            modifiedEnd,
            midModifiedArr,
            deltaIsEven,
            quitEarlyArr
          );
        } else {
          originalStart++;
          modifiedStart++;
          return [
            new DiffChange(
              originalStart,
              originalEnd - originalStart + 1,
              modifiedStart,
              modifiedEnd - modifiedStart + 1
            )
          ];
        }
      }
      diagonalReverseStart = this.ClipDiagonalBound(diagonalReverseBase - numDifferences, numDifferences, diagonalReverseBase, numDiagonals);
      diagonalReverseEnd = this.ClipDiagonalBound(diagonalReverseBase + numDifferences, numDifferences, diagonalReverseBase, numDiagonals);
      for (let diagonal = diagonalReverseStart; diagonal <= diagonalReverseEnd; diagonal += 2) {
        if (diagonal === diagonalReverseStart || diagonal < diagonalReverseEnd && reversePoints[diagonal - 1] >= reversePoints[diagonal + 1]) {
          originalIndex = reversePoints[diagonal + 1] - 1;
        } else {
          originalIndex = reversePoints[diagonal - 1];
        }
        modifiedIndex = originalIndex - (diagonal - diagonalReverseBase) - diagonalReverseOffset;
        const tempOriginalIndex = originalIndex;
        while (originalIndex > originalStart && modifiedIndex > modifiedStart && this.ElementsAreEqual(originalIndex, modifiedIndex)) {
          originalIndex--;
          modifiedIndex--;
        }
        reversePoints[diagonal] = originalIndex;
        if (deltaIsEven && Math.abs(diagonal - diagonalForwardBase) <= numDifferences) {
          if (originalIndex <= forwardPoints[diagonal]) {
            midOriginalArr[0] = originalIndex;
            midModifiedArr[0] = modifiedIndex;
            if (tempOriginalIndex >= forwardPoints[diagonal] && 1447 /* MaxDifferencesHistory */ > 0 && numDifferences <= 1447 /* MaxDifferencesHistory */ + 1) {
              return this.WALKTRACE(
                diagonalForwardBase,
                diagonalForwardStart,
                diagonalForwardEnd,
                diagonalForwardOffset,
                diagonalReverseBase,
                diagonalReverseStart,
                diagonalReverseEnd,
                diagonalReverseOffset,
                forwardPoints,
                reversePoints,
                originalIndex,
                originalEnd,
                midOriginalArr,
                modifiedIndex,
                modifiedEnd,
                midModifiedArr,
                deltaIsEven,
                quitEarlyArr
              );
            } else {
              return null;
            }
          }
        }
      }
      if (numDifferences <= 1447 /* MaxDifferencesHistory */) {
        let temp = new Int32Array(diagonalForwardEnd - diagonalForwardStart + 2);
        temp[0] = diagonalForwardBase - diagonalForwardStart + 1;
        MyArray.Copy2(forwardPoints, diagonalForwardStart, temp, 1, diagonalForwardEnd - diagonalForwardStart + 1);
        this.m_forwardHistory.push(temp);
        temp = new Int32Array(diagonalReverseEnd - diagonalReverseStart + 2);
        temp[0] = diagonalReverseBase - diagonalReverseStart + 1;
        MyArray.Copy2(reversePoints, diagonalReverseStart, temp, 1, diagonalReverseEnd - diagonalReverseStart + 1);
        this.m_reverseHistory.push(temp);
      }
    }
    return this.WALKTRACE(
      diagonalForwardBase,
      diagonalForwardStart,
      diagonalForwardEnd,
      diagonalForwardOffset,
      diagonalReverseBase,
      diagonalReverseStart,
      diagonalReverseEnd,
      diagonalReverseOffset,
      forwardPoints,
      reversePoints,
      originalIndex,
      originalEnd,
      midOriginalArr,
      modifiedIndex,
      modifiedEnd,
      midModifiedArr,
      deltaIsEven,
      quitEarlyArr
    );
  }
  /**
   * Shifts the given changes to provide a more intuitive diff.
   * While the first element in a diff matches the first element after the diff,
   * we shift the diff down.
   *
   * @param changes The list of changes to shift
   * @returns The shifted changes
   */
  PrettifyChanges(changes) {
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const originalStop = i < changes.length - 1 ? changes[i + 1].originalStart : this._originalElementsOrHash.length;
      const modifiedStop = i < changes.length - 1 ? changes[i + 1].modifiedStart : this._modifiedElementsOrHash.length;
      const checkOriginal = change.originalLength > 0;
      const checkModified = change.modifiedLength > 0;
      while (change.originalStart + change.originalLength < originalStop && change.modifiedStart + change.modifiedLength < modifiedStop && (!checkOriginal || this.OriginalElementsAreEqual(change.originalStart, change.originalStart + change.originalLength)) && (!checkModified || this.ModifiedElementsAreEqual(change.modifiedStart, change.modifiedStart + change.modifiedLength))) {
        const startStrictEqual = this.ElementsAreStrictEqual(change.originalStart, change.modifiedStart);
        const endStrictEqual = this.ElementsAreStrictEqual(change.originalStart + change.originalLength, change.modifiedStart + change.modifiedLength);
        if (endStrictEqual && !startStrictEqual) {
          break;
        }
        change.originalStart++;
        change.modifiedStart++;
      }
      const mergedChangeArr = [null];
      if (i < changes.length - 1 && this.ChangesOverlap(changes[i], changes[i + 1], mergedChangeArr)) {
        changes[i] = mergedChangeArr[0];
        changes.splice(i + 1, 1);
        i--;
        continue;
      }
    }
    for (let i = changes.length - 1; i >= 0; i--) {
      const change = changes[i];
      let originalStop = 0;
      let modifiedStop = 0;
      if (i > 0) {
        const prevChange = changes[i - 1];
        originalStop = prevChange.originalStart + prevChange.originalLength;
        modifiedStop = prevChange.modifiedStart + prevChange.modifiedLength;
      }
      const checkOriginal = change.originalLength > 0;
      const checkModified = change.modifiedLength > 0;
      let bestDelta = 0;
      let bestScore = this._boundaryScore(change.originalStart, change.originalLength, change.modifiedStart, change.modifiedLength);
      for (let delta = 1; ; delta++) {
        const originalStart = change.originalStart - delta;
        const modifiedStart = change.modifiedStart - delta;
        if (originalStart < originalStop || modifiedStart < modifiedStop) {
          break;
        }
        if (checkOriginal && !this.OriginalElementsAreEqual(originalStart, originalStart + change.originalLength)) {
          break;
        }
        if (checkModified && !this.ModifiedElementsAreEqual(modifiedStart, modifiedStart + change.modifiedLength)) {
          break;
        }
        const touchingPreviousChange = originalStart === originalStop && modifiedStart === modifiedStop;
        const score = (touchingPreviousChange ? 5 : 0) + this._boundaryScore(originalStart, change.originalLength, modifiedStart, change.modifiedLength);
        if (score > bestScore) {
          bestScore = score;
          bestDelta = delta;
        }
      }
      change.originalStart -= bestDelta;
      change.modifiedStart -= bestDelta;
      const mergedChangeArr = [null];
      if (i > 0 && this.ChangesOverlap(changes[i - 1], changes[i], mergedChangeArr)) {
        changes[i - 1] = mergedChangeArr[0];
        changes.splice(i, 1);
        i++;
        continue;
      }
    }
    if (this._hasStrings) {
      for (let i = 1, len = changes.length; i < len; i++) {
        const aChange = changes[i - 1];
        const bChange = changes[i];
        const matchedLength = bChange.originalStart - aChange.originalStart - aChange.originalLength;
        const aOriginalStart = aChange.originalStart;
        const bOriginalEnd = bChange.originalStart + bChange.originalLength;
        const abOriginalLength = bOriginalEnd - aOriginalStart;
        const aModifiedStart = aChange.modifiedStart;
        const bModifiedEnd = bChange.modifiedStart + bChange.modifiedLength;
        const abModifiedLength = bModifiedEnd - aModifiedStart;
        if (matchedLength < 5 && abOriginalLength < 20 && abModifiedLength < 20) {
          const t = this._findBetterContiguousSequence(
            aOriginalStart,
            abOriginalLength,
            aModifiedStart,
            abModifiedLength,
            matchedLength
          );
          if (t) {
            const [originalMatchStart, modifiedMatchStart] = t;
            if (originalMatchStart !== aChange.originalStart + aChange.originalLength || modifiedMatchStart !== aChange.modifiedStart + aChange.modifiedLength) {
              aChange.originalLength = originalMatchStart - aChange.originalStart;
              aChange.modifiedLength = modifiedMatchStart - aChange.modifiedStart;
              bChange.originalStart = originalMatchStart + matchedLength;
              bChange.modifiedStart = modifiedMatchStart + matchedLength;
              bChange.originalLength = bOriginalEnd - bChange.originalStart;
              bChange.modifiedLength = bModifiedEnd - bChange.modifiedStart;
            }
          }
        }
      }
    }
    return changes;
  }
  _findBetterContiguousSequence(originalStart, originalLength, modifiedStart, modifiedLength, desiredLength) {
    if (originalLength < desiredLength || modifiedLength < desiredLength) {
      return null;
    }
    const originalMax = originalStart + originalLength - desiredLength + 1;
    const modifiedMax = modifiedStart + modifiedLength - desiredLength + 1;
    let bestScore = 0;
    let bestOriginalStart = 0;
    let bestModifiedStart = 0;
    for (let i = originalStart; i < originalMax; i++) {
      for (let j = modifiedStart; j < modifiedMax; j++) {
        const score = this._contiguousSequenceScore(i, j, desiredLength);
        if (score > 0 && score > bestScore) {
          bestScore = score;
          bestOriginalStart = i;
          bestModifiedStart = j;
        }
      }
    }
    if (bestScore > 0) {
      return [bestOriginalStart, bestModifiedStart];
    }
    return null;
  }
  _contiguousSequenceScore(originalStart, modifiedStart, length) {
    let score = 0;
    for (let l = 0; l < length; l++) {
      if (!this.ElementsAreEqual(originalStart + l, modifiedStart + l)) {
        return 0;
      }
      score += this._originalStringElements[originalStart + l].length;
    }
    return score;
  }
  _OriginalIsBoundary(index) {
    if (index <= 0 || index >= this._originalElementsOrHash.length - 1) {
      return true;
    }
    return this._hasStrings && /^\s*$/.test(this._originalStringElements[index]);
  }
  _OriginalRegionIsBoundary(originalStart, originalLength) {
    if (this._OriginalIsBoundary(originalStart) || this._OriginalIsBoundary(originalStart - 1)) {
      return true;
    }
    if (originalLength > 0) {
      const originalEnd = originalStart + originalLength;
      if (this._OriginalIsBoundary(originalEnd - 1) || this._OriginalIsBoundary(originalEnd)) {
        return true;
      }
    }
    return false;
  }
  _ModifiedIsBoundary(index) {
    if (index <= 0 || index >= this._modifiedElementsOrHash.length - 1) {
      return true;
    }
    return this._hasStrings && /^\s*$/.test(this._modifiedStringElements[index]);
  }
  _ModifiedRegionIsBoundary(modifiedStart, modifiedLength) {
    if (this._ModifiedIsBoundary(modifiedStart) || this._ModifiedIsBoundary(modifiedStart - 1)) {
      return true;
    }
    if (modifiedLength > 0) {
      const modifiedEnd = modifiedStart + modifiedLength;
      if (this._ModifiedIsBoundary(modifiedEnd - 1) || this._ModifiedIsBoundary(modifiedEnd)) {
        return true;
      }
    }
    return false;
  }
  _boundaryScore(originalStart, originalLength, modifiedStart, modifiedLength) {
    const originalScore = this._OriginalRegionIsBoundary(originalStart, originalLength) ? 1 : 0;
    const modifiedScore = this._ModifiedRegionIsBoundary(modifiedStart, modifiedLength) ? 1 : 0;
    return originalScore + modifiedScore;
  }
  /**
   * Concatenates the two input DiffChange lists and returns the resulting
   * list.
   * @param The left changes
   * @param The right changes
   * @returns The concatenated list
   */
  ConcatenateChanges(left, right) {
    const mergedChangeArr = [];
    if (left.length === 0 || right.length === 0) {
      return right.length > 0 ? right : left;
    } else if (this.ChangesOverlap(left[left.length - 1], right[0], mergedChangeArr)) {
      const result = new Array(left.length + right.length - 1);
      MyArray.Copy(left, 0, result, 0, left.length - 1);
      result[left.length - 1] = mergedChangeArr[0];
      MyArray.Copy(right, 1, result, left.length, right.length - 1);
      return result;
    } else {
      const result = new Array(left.length + right.length);
      MyArray.Copy(left, 0, result, 0, left.length);
      MyArray.Copy(right, 0, result, left.length, right.length);
      return result;
    }
  }
  /**
   * Returns true if the two changes overlap and can be merged into a single
   * change
   * @param left The left change
   * @param right The right change
   * @param mergedChange The merged change if the two overlap, null otherwise
   * @returns True if the two changes overlap
   */
  ChangesOverlap(left, right, mergedChangeArr) {
    Debug.Assert(left.originalStart <= right.originalStart, "Left change is not less than or equal to right change");
    Debug.Assert(left.modifiedStart <= right.modifiedStart, "Left change is not less than or equal to right change");
    if (left.originalStart + left.originalLength >= right.originalStart || left.modifiedStart + left.modifiedLength >= right.modifiedStart) {
      const originalStart = left.originalStart;
      let originalLength = left.originalLength;
      const modifiedStart = left.modifiedStart;
      let modifiedLength = left.modifiedLength;
      if (left.originalStart + left.originalLength >= right.originalStart) {
        originalLength = right.originalStart + right.originalLength - left.originalStart;
      }
      if (left.modifiedStart + left.modifiedLength >= right.modifiedStart) {
        modifiedLength = right.modifiedStart + right.modifiedLength - left.modifiedStart;
      }
      mergedChangeArr[0] = new DiffChange(originalStart, originalLength, modifiedStart, modifiedLength);
      return true;
    } else {
      mergedChangeArr[0] = null;
      return false;
    }
  }
  /**
   * Helper method used to clip a diagonal index to the range of valid
   * diagonals. This also decides whether or not the diagonal index,
   * if it exceeds the boundary, should be clipped to the boundary or clipped
   * one inside the boundary depending on the Even/Odd status of the boundary
   * and numDifferences.
   * @param diagonal The index of the diagonal to clip.
   * @param numDifferences The current number of differences being iterated upon.
   * @param diagonalBaseIndex The base reference diagonal.
   * @param numDiagonals The total number of diagonals.
   * @returns The clipped diagonal index.
   */
  ClipDiagonalBound(diagonal, numDifferences, diagonalBaseIndex, numDiagonals) {
    if (diagonal >= 0 && diagonal < numDiagonals) {
      return diagonal;
    }
    const diagonalsBelow = diagonalBaseIndex;
    const diagonalsAbove = numDiagonals - diagonalBaseIndex - 1;
    const diffEven = numDifferences % 2 === 0;
    if (diagonal < 0) {
      const lowerBoundEven = diagonalsBelow % 2 === 0;
      return diffEven === lowerBoundEven ? 0 : 1;
    } else {
      const upperBoundEven = diagonalsAbove % 2 === 0;
      return diffEven === upperBoundEven ? numDiagonals - 1 : numDiagonals - 2;
    }
  }
}
const precomputedEqualityArray = new Uint32Array(65536);
const computeLevenshteinDistanceForShortStrings = (firstString, secondString) => {
  const firstStringLength = firstString.length;
  const secondStringLength = secondString.length;
  const lastBitMask = 1 << firstStringLength - 1;
  let positiveVector = -1;
  let negativeVector = 0;
  let distance = firstStringLength;
  let index = firstStringLength;
  while (index--) {
    precomputedEqualityArray[firstString.charCodeAt(index)] |= 1 << index;
  }
  for (index = 0; index < secondStringLength; index++) {
    let equalityMask = precomputedEqualityArray[secondString.charCodeAt(index)];
    const combinedVector = equalityMask | negativeVector;
    equalityMask |= (equalityMask & positiveVector) + positiveVector ^ positiveVector;
    negativeVector |= ~(equalityMask | positiveVector);
    positiveVector &= equalityMask;
    if (negativeVector & lastBitMask) {
      distance++;
    }
    if (positiveVector & lastBitMask) {
      distance--;
    }
    negativeVector = negativeVector << 1 | 1;
    positiveVector = positiveVector << 1 | ~(combinedVector | negativeVector);
    negativeVector &= combinedVector;
  }
  index = firstStringLength;
  while (index--) {
    precomputedEqualityArray[firstString.charCodeAt(index)] = 0;
  }
  return distance;
};
function computeLevenshteinDistanceForLongStrings(firstString, secondString) {
  const firstStringLength = firstString.length;
  const secondStringLength = secondString.length;
  const horizontalBitArray = [];
  const verticalBitArray = [];
  const horizontalSize = Math.ceil(firstStringLength / 32);
  const verticalSize = Math.ceil(secondStringLength / 32);
  for (let i = 0; i < horizontalSize; i++) {
    horizontalBitArray[i] = -1;
    verticalBitArray[i] = 0;
  }
  let verticalIndex = 0;
  for (; verticalIndex < verticalSize - 1; verticalIndex++) {
    let negativeVector2 = 0;
    let positiveVector2 = -1;
    const start2 = verticalIndex * 32;
    const verticalLength2 = Math.min(32, secondStringLength) + start2;
    for (let k = start2; k < verticalLength2; k++) {
      precomputedEqualityArray[secondString.charCodeAt(k)] |= 1 << k;
    }
    for (let i = 0; i < firstStringLength; i++) {
      const equalityMask = precomputedEqualityArray[firstString.charCodeAt(i)];
      const previousBit = horizontalBitArray[i / 32 | 0] >>> i & 1;
      const matchBit = verticalBitArray[i / 32 | 0] >>> i & 1;
      const combinedVector = equalityMask | negativeVector2;
      const combinedHorizontalVector = ((equalityMask | matchBit) & positiveVector2) + positiveVector2 ^ positiveVector2 | equalityMask | matchBit;
      let positiveHorizontalVector = negativeVector2 | ~(combinedHorizontalVector | positiveVector2);
      let negativeHorizontalVector = positiveVector2 & combinedHorizontalVector;
      if (positiveHorizontalVector >>> 31 ^ previousBit) {
        horizontalBitArray[i / 32 | 0] ^= 1 << i;
      }
      if (negativeHorizontalVector >>> 31 ^ matchBit) {
        verticalBitArray[i / 32 | 0] ^= 1 << i;
      }
      positiveHorizontalVector = positiveHorizontalVector << 1 | previousBit;
      negativeHorizontalVector = negativeHorizontalVector << 1 | matchBit;
      positiveVector2 = negativeHorizontalVector | ~(combinedVector | positiveHorizontalVector);
      negativeVector2 = positiveHorizontalVector & combinedVector;
    }
    for (let k = start2; k < verticalLength2; k++) {
      precomputedEqualityArray[secondString.charCodeAt(k)] = 0;
    }
  }
  let negativeVector = 0;
  let positiveVector = -1;
  const start = verticalIndex * 32;
  const verticalLength = Math.min(32, secondStringLength - start) + start;
  for (let k = start; k < verticalLength; k++) {
    precomputedEqualityArray[secondString.charCodeAt(k)] |= 1 << k;
  }
  let distance = secondStringLength;
  for (let i = 0; i < firstStringLength; i++) {
    const equalityMask = precomputedEqualityArray[firstString.charCodeAt(i)];
    const previousBit = horizontalBitArray[i / 32 | 0] >>> i & 1;
    const matchBit = verticalBitArray[i / 32 | 0] >>> i & 1;
    const combinedVector = equalityMask | negativeVector;
    const combinedHorizontalVector = ((equalityMask | matchBit) & positiveVector) + positiveVector ^ positiveVector | equalityMask | matchBit;
    let positiveHorizontalVector = negativeVector | ~(combinedHorizontalVector | positiveVector);
    let negativeHorizontalVector = positiveVector & combinedHorizontalVector;
    distance += positiveHorizontalVector >>> secondStringLength - 1 & 1;
    distance -= negativeHorizontalVector >>> secondStringLength - 1 & 1;
    if (positiveHorizontalVector >>> 31 ^ previousBit) {
      horizontalBitArray[i / 32 | 0] ^= 1 << i;
    }
    if (negativeHorizontalVector >>> 31 ^ matchBit) {
      verticalBitArray[i / 32 | 0] ^= 1 << i;
    }
    positiveHorizontalVector = positiveHorizontalVector << 1 | previousBit;
    negativeHorizontalVector = negativeHorizontalVector << 1 | matchBit;
    positiveVector = negativeHorizontalVector | ~(combinedVector | positiveHorizontalVector);
    negativeVector = positiveHorizontalVector & combinedVector;
  }
  for (let k = start; k < verticalLength; k++) {
    precomputedEqualityArray[secondString.charCodeAt(k)] = 0;
  }
  return distance;
}
function computeLevenshteinDistance(firstString, secondString) {
  if (firstString.length < secondString.length) {
    const temp = secondString;
    secondString = firstString;
    firstString = temp;
  }
  if (secondString.length === 0) {
    return firstString.length;
  }
  if (firstString.length <= 32) {
    return computeLevenshteinDistanceForShortStrings(firstString, secondString);
  }
  return computeLevenshteinDistanceForLongStrings(firstString, secondString);
}
export {
  LcsDiff,
  StringDiffSequence,
  computeLevenshteinDistance,
  stringDiff
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9kaWZmL2RpZmYudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaWZmQ2hhbmdlIH0gZnJvbSAnLi9kaWZmQ2hhbmdlLmpzJztcbmltcG9ydCB7IHN0cmluZ0hhc2ggfSBmcm9tICcuLi9oYXNoLmpzJztcbmltcG9ydCB7IENvbnN0YW50cyB9IGZyb20gJy4uL3VpbnQuanMnO1xuXG5leHBvcnQgY2xhc3MgU3RyaW5nRGlmZlNlcXVlbmNlIGltcGxlbWVudHMgSVNlcXVlbmNlIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHNvdXJjZTogc3RyaW5nKSB7IH1cblxuXHRnZXRFbGVtZW50cygpOiBJbnQzMkFycmF5IHwgbnVtYmVyW10gfCBzdHJpbmdbXSB7XG5cdFx0Y29uc3Qgc291cmNlID0gdGhpcy5zb3VyY2U7XG5cdFx0Y29uc3QgY2hhcmFjdGVycyA9IG5ldyBJbnQzMkFycmF5KHNvdXJjZS5sZW5ndGgpO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzb3VyY2UubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNoYXJhY3RlcnNbaV0gPSBzb3VyY2UuY2hhckNvZGVBdChpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNoYXJhY3RlcnM7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ0RpZmYob3JpZ2luYWw6IHN0cmluZywgbW9kaWZpZWQ6IHN0cmluZywgcHJldHR5OiBib29sZWFuKTogSURpZmZDaGFuZ2VbXSB7XG5cdHJldHVybiBuZXcgTGNzRGlmZihuZXcgU3RyaW5nRGlmZlNlcXVlbmNlKG9yaWdpbmFsKSwgbmV3IFN0cmluZ0RpZmZTZXF1ZW5jZShtb2RpZmllZCkpLkNvbXB1dGVEaWZmKHByZXR0eSkuY2hhbmdlcztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2VxdWVuY2Uge1xuXHRnZXRFbGVtZW50cygpOiBJbnQzMkFycmF5IHwgbnVtYmVyW10gfCBzdHJpbmdbXTtcblx0Z2V0U3RyaWN0RWxlbWVudD8oaW5kZXg6IG51bWJlcik6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRGlmZkNoYW5nZSB7XG5cdC8qKlxuXHQgKiBUaGUgcG9zaXRpb24gb2YgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIG9yaWdpbmFsIHNlcXVlbmNlIHdoaWNoXG5cdCAqIHRoaXMgY2hhbmdlIGFmZmVjdHMuXG5cdCAqL1xuXHRvcmlnaW5hbFN0YXJ0OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgZnJvbSB0aGUgb3JpZ2luYWwgc2VxdWVuY2Ugd2hpY2ggd2VyZVxuXHQgKiBhZmZlY3RlZC5cblx0ICovXG5cdG9yaWdpbmFsTGVuZ3RoOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBwb3NpdGlvbiBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgbW9kaWZpZWQgc2VxdWVuY2Ugd2hpY2hcblx0ICogdGhpcyBjaGFuZ2UgYWZmZWN0cy5cblx0ICovXG5cdG1vZGlmaWVkU3RhcnQ6IG51bWJlcjtcblxuXHQvKipcblx0ICogVGhlIG51bWJlciBvZiBlbGVtZW50cyBmcm9tIHRoZSBtb2RpZmllZCBzZXF1ZW5jZSB3aGljaCB3ZXJlXG5cdCAqIGFmZmVjdGVkIChhZGRlZCkuXG5cdCAqL1xuXHRtb2RpZmllZExlbmd0aDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb250aW51ZVByb2Nlc3NpbmdQcmVkaWNhdGUge1xuXHQoZnVydGhlc3RPcmlnaW5hbEluZGV4OiBudW1iZXIsIG1hdGNoTGVuZ3RoT2ZMb25nZXN0OiBudW1iZXIpOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEaWZmUmVzdWx0IHtcblx0cXVpdEVhcmx5OiBib29sZWFuO1xuXHRjaGFuZ2VzOiBJRGlmZkNoYW5nZVtdO1xufVxuXG4vL1xuLy8gVGhlIGNvZGUgYmVsb3cgaGFzIGJlZW4gcG9ydGVkIGZyb20gYSBDIyBpbXBsZW1lbnRhdGlvbiBpbiBWU1xuLy9cblxuY2xhc3MgRGVidWcge1xuXG5cdHB1YmxpYyBzdGF0aWMgQXNzZXJ0KGNvbmRpdGlvbjogYm9vbGVhbiwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCFjb25kaXRpb24pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgTXlBcnJheSB7XG5cdC8qKlxuXHQgKiBDb3BpZXMgYSByYW5nZSBvZiBlbGVtZW50cyBmcm9tIGFuIEFycmF5IHN0YXJ0aW5nIGF0IHRoZSBzcGVjaWZpZWQgc291cmNlIGluZGV4IGFuZCBwYXN0ZXNcblx0ICogdGhlbSB0byBhbm90aGVyIEFycmF5IHN0YXJ0aW5nIGF0IHRoZSBzcGVjaWZpZWQgZGVzdGluYXRpb24gaW5kZXguIFRoZSBsZW5ndGggYW5kIHRoZSBpbmRleGVzXG5cdCAqIGFyZSBzcGVjaWZpZWQgYXMgNjQtYml0IGludGVnZXJzLlxuXHQgKiBzb3VyY2VBcnJheTpcblx0ICpcdFx0VGhlIEFycmF5IHRoYXQgY29udGFpbnMgdGhlIGRhdGEgdG8gY29weS5cblx0ICogc291cmNlSW5kZXg6XG5cdCAqXHRcdEEgNjQtYml0IGludGVnZXIgdGhhdCByZXByZXNlbnRzIHRoZSBpbmRleCBpbiB0aGUgc291cmNlQXJyYXkgYXQgd2hpY2ggY29weWluZyBiZWdpbnMuXG5cdCAqIGRlc3RpbmF0aW9uQXJyYXk6XG5cdCAqXHRcdFRoZSBBcnJheSB0aGF0IHJlY2VpdmVzIHRoZSBkYXRhLlxuXHQgKiBkZXN0aW5hdGlvbkluZGV4OlxuXHQgKlx0XHRBIDY0LWJpdCBpbnRlZ2VyIHRoYXQgcmVwcmVzZW50cyB0aGUgaW5kZXggaW4gdGhlIGRlc3RpbmF0aW9uQXJyYXkgYXQgd2hpY2ggc3RvcmluZyBiZWdpbnMuXG5cdCAqIGxlbmd0aDpcblx0ICpcdFx0QSA2NC1iaXQgaW50ZWdlciB0aGF0IHJlcHJlc2VudHMgdGhlIG51bWJlciBvZiBlbGVtZW50cyB0byBjb3B5LlxuXHQgKi9cblx0cHVibGljIHN0YXRpYyBDb3B5KHNvdXJjZUFycmF5OiBhbnlbXSwgc291cmNlSW5kZXg6IG51bWJlciwgZGVzdGluYXRpb25BcnJheTogYW55W10sIGRlc3RpbmF0aW9uSW5kZXg6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRkZXN0aW5hdGlvbkFycmF5W2Rlc3RpbmF0aW9uSW5kZXggKyBpXSA9IHNvdXJjZUFycmF5W3NvdXJjZUluZGV4ICsgaV07XG5cdFx0fVxuXHR9XG5cdHB1YmxpYyBzdGF0aWMgQ29weTIoc291cmNlQXJyYXk6IEludDMyQXJyYXksIHNvdXJjZUluZGV4OiBudW1iZXIsIGRlc3RpbmF0aW9uQXJyYXk6IEludDMyQXJyYXksIGRlc3RpbmF0aW9uSW5kZXg6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRkZXN0aW5hdGlvbkFycmF5W2Rlc3RpbmF0aW9uSW5kZXggKyBpXSA9IHNvdXJjZUFycmF5W3NvdXJjZUluZGV4ICsgaV07XG5cdFx0fVxuXHR9XG59XG5cbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbi8vIExjc0RpZmYuY3Ncbi8vXG4vLyBBbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgZGlmZmVyZW5jZSBhbGdvcml0aG0gZGVzY3JpYmVkIGluXG4vLyBcIkFuIE8oTkQpIERpZmZlcmVuY2UgQWxnb3JpdGhtIGFuZCBpdHMgdmFyaWF0aW9uc1wiIGJ5IEV1Z2VuZSBXLiBNeWVyc1xuLy9cbi8vIENvcHlyaWdodCAoQykgMjAwOCBNaWNyb3NvZnQgQ29ycG9yYXRpb24gQG1pbmlmaWVyX2RvX25vdF9wcmVzZXJ2ZVxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXG4vLyBPdXIgdG90YWwgbWVtb3J5IHVzYWdlIGZvciBzdG9yaW5nIGhpc3RvcnkgaXMgKHdvcnN0LWNhc2UpOlxuLy8gMiAqIFsoTWF4RGlmZmVyZW5jZXNIaXN0b3J5ICsgMSkgKiAoTWF4RGlmZmVyZW5jZXNIaXN0b3J5ICsgMSkgLSAxXSAqIHNpemVvZihpbnQpXG4vLyAyICogWzE0NDgqMTQ0OCAtIDFdICogNCA9IDE2NzczNjI0ID0gMTZNQlxuY29uc3QgZW51bSBMb2NhbENvbnN0YW50cyB7XG5cdE1heERpZmZlcmVuY2VzSGlzdG9yeSA9IDE0NDdcbn1cblxuLyoqXG4gKiBBIHV0aWxpdHkgY2xhc3Mgd2hpY2ggaGVscHMgdG8gY3JlYXRlIHRoZSBzZXQgb2YgRGlmZkNoYW5nZXMgZnJvbVxuICogYSBkaWZmZXJlbmNlIG9wZXJhdGlvbi4gVGhpcyBjbGFzcyBhY2NlcHRzIG9yaWdpbmFsIERpZmZFbGVtZW50cyBhbmRcbiAqIG1vZGlmaWVkIERpZmZFbGVtZW50cyB0aGF0IGFyZSBpbnZvbHZlZCBpbiBhIHBhcnRpY3VsYXIgY2hhbmdlLiBUaGVcbiAqIE1hcmtOZXh0Q2hhbmdlKCkgbWV0aG9kIGNhbiBiZSBjYWxsZWQgdG8gbWFyayB0aGUgc2VwYXJhdGlvbiBiZXR3ZWVuXG4gKiBkaXN0aW5jdCBjaGFuZ2VzLiBBdCB0aGUgZW5kLCB0aGUgQ2hhbmdlcyBwcm9wZXJ0eSBjYW4gYmUgY2FsbGVkIHRvIHJldHJpZXZlXG4gKiB0aGUgY29uc3RydWN0ZWQgY2hhbmdlcy5cbiAqL1xuY2xhc3MgRGlmZkNoYW5nZUhlbHBlciB7XG5cblx0cHJpdmF0ZSBtX2NoYW5nZXM6IERpZmZDaGFuZ2VbXTtcblx0cHJpdmF0ZSBtX29yaWdpbmFsU3RhcnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBtX21vZGlmaWVkU3RhcnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBtX29yaWdpbmFsQ291bnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBtX21vZGlmaWVkQ291bnQ6IG51bWJlcjtcblxuXHQvKipcblx0ICogQ29uc3RydWN0cyBhIG5ldyBEaWZmQ2hhbmdlSGVscGVyIGZvciB0aGUgZ2l2ZW4gRGlmZlNlcXVlbmNlcy5cblx0ICovXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMubV9jaGFuZ2VzID0gW107XG5cdFx0dGhpcy5tX29yaWdpbmFsU3RhcnQgPSBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUjtcblx0XHR0aGlzLm1fbW9kaWZpZWRTdGFydCA9IENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSO1xuXHRcdHRoaXMubV9vcmlnaW5hbENvdW50ID0gMDtcblx0XHR0aGlzLm1fbW9kaWZpZWRDb3VudCA9IDA7XG5cdH1cblxuXHQvKipcblx0ICogTWFya3MgdGhlIGJlZ2lubmluZyBvZiB0aGUgbmV4dCBjaGFuZ2UgaW4gdGhlIHNldCBvZiBkaWZmZXJlbmNlcy5cblx0ICovXG5cdHB1YmxpYyBNYXJrTmV4dENoYW5nZSgpOiB2b2lkIHtcblx0XHQvLyBPbmx5IGFkZCB0byB0aGUgbGlzdCBpZiB0aGVyZSBpcyBzb21ldGhpbmcgdG8gYWRkXG5cdFx0aWYgKHRoaXMubV9vcmlnaW5hbENvdW50ID4gMCB8fCB0aGlzLm1fbW9kaWZpZWRDb3VudCA+IDApIHtcblx0XHRcdC8vIEFkZCB0aGUgbmV3IGNoYW5nZSB0byBvdXIgbGlzdFxuXHRcdFx0dGhpcy5tX2NoYW5nZXMucHVzaChuZXcgRGlmZkNoYW5nZSh0aGlzLm1fb3JpZ2luYWxTdGFydCwgdGhpcy5tX29yaWdpbmFsQ291bnQsXG5cdFx0XHRcdHRoaXMubV9tb2RpZmllZFN0YXJ0LCB0aGlzLm1fbW9kaWZpZWRDb3VudCkpO1xuXHRcdH1cblxuXHRcdC8vIFJlc2V0IGZvciB0aGUgbmV4dCBjaGFuZ2Vcblx0XHR0aGlzLm1fb3JpZ2luYWxDb3VudCA9IDA7XG5cdFx0dGhpcy5tX21vZGlmaWVkQ291bnQgPSAwO1xuXHRcdHRoaXMubV9vcmlnaW5hbFN0YXJ0ID0gQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVI7XG5cdFx0dGhpcy5tX21vZGlmaWVkU3RhcnQgPSBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUjtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIHRoZSBvcmlnaW5hbCBlbGVtZW50IGF0IHRoZSBnaXZlbiBwb3NpdGlvbiB0byB0aGUgZWxlbWVudHNcblx0ICogYWZmZWN0ZWQgYnkgdGhlIGN1cnJlbnQgY2hhbmdlLiBUaGUgbW9kaWZpZWQgaW5kZXggZ2l2ZXMgY29udGV4dFxuXHQgKiB0byB0aGUgY2hhbmdlIHBvc2l0aW9uIHdpdGggcmVzcGVjdCB0byB0aGUgb3JpZ2luYWwgc2VxdWVuY2UuXG5cdCAqIEBwYXJhbSBvcmlnaW5hbEluZGV4IFRoZSBpbmRleCBvZiB0aGUgb3JpZ2luYWwgZWxlbWVudCB0byBhZGQuXG5cdCAqIEBwYXJhbSBtb2RpZmllZEluZGV4IFRoZSBpbmRleCBvZiB0aGUgbW9kaWZpZWQgZWxlbWVudCB0aGF0IHByb3ZpZGVzIGNvcnJlc3BvbmRpbmcgcG9zaXRpb24gaW4gdGhlIG1vZGlmaWVkIHNlcXVlbmNlLlxuXHQgKi9cblx0cHVibGljIEFkZE9yaWdpbmFsRWxlbWVudChvcmlnaW5hbEluZGV4OiBudW1iZXIsIG1vZGlmaWVkSW5kZXg6IG51bWJlcikge1xuXHRcdC8vIFRoZSAndHJ1ZScgc3RhcnQgaW5kZXggaXMgdGhlIHNtYWxsZXN0IG9mIHRoZSBvbmVzIHdlJ3ZlIHNlZW5cblx0XHR0aGlzLm1fb3JpZ2luYWxTdGFydCA9IE1hdGgubWluKHRoaXMubV9vcmlnaW5hbFN0YXJ0LCBvcmlnaW5hbEluZGV4KTtcblx0XHR0aGlzLm1fbW9kaWZpZWRTdGFydCA9IE1hdGgubWluKHRoaXMubV9tb2RpZmllZFN0YXJ0LCBtb2RpZmllZEluZGV4KTtcblxuXHRcdHRoaXMubV9vcmlnaW5hbENvdW50Kys7XG5cdH1cblxuXHQvKipcblx0ICogQWRkcyB0aGUgbW9kaWZpZWQgZWxlbWVudCBhdCB0aGUgZ2l2ZW4gcG9zaXRpb24gdG8gdGhlIGVsZW1lbnRzXG5cdCAqIGFmZmVjdGVkIGJ5IHRoZSBjdXJyZW50IGNoYW5nZS4gVGhlIG9yaWdpbmFsIGluZGV4IGdpdmVzIGNvbnRleHRcblx0ICogdG8gdGhlIGNoYW5nZSBwb3NpdGlvbiB3aXRoIHJlc3BlY3QgdG8gdGhlIG1vZGlmaWVkIHNlcXVlbmNlLlxuXHQgKiBAcGFyYW0gb3JpZ2luYWxJbmRleCBUaGUgaW5kZXggb2YgdGhlIG9yaWdpbmFsIGVsZW1lbnQgdGhhdCBwcm92aWRlcyBjb3JyZXNwb25kaW5nIHBvc2l0aW9uIGluIHRoZSBvcmlnaW5hbCBzZXF1ZW5jZS5cblx0ICogQHBhcmFtIG1vZGlmaWVkSW5kZXggVGhlIGluZGV4IG9mIHRoZSBtb2RpZmllZCBlbGVtZW50IHRvIGFkZC5cblx0ICovXG5cdHB1YmxpYyBBZGRNb2RpZmllZEVsZW1lbnQob3JpZ2luYWxJbmRleDogbnVtYmVyLCBtb2RpZmllZEluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHQvLyBUaGUgJ3RydWUnIHN0YXJ0IGluZGV4IGlzIHRoZSBzbWFsbGVzdCBvZiB0aGUgb25lcyB3ZSd2ZSBzZWVuXG5cdFx0dGhpcy5tX29yaWdpbmFsU3RhcnQgPSBNYXRoLm1pbih0aGlzLm1fb3JpZ2luYWxTdGFydCwgb3JpZ2luYWxJbmRleCk7XG5cdFx0dGhpcy5tX21vZGlmaWVkU3RhcnQgPSBNYXRoLm1pbih0aGlzLm1fbW9kaWZpZWRTdGFydCwgbW9kaWZpZWRJbmRleCk7XG5cblx0XHR0aGlzLm1fbW9kaWZpZWRDb3VudCsrO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHJpZXZlcyBhbGwgb2YgdGhlIGNoYW5nZXMgbWFya2VkIGJ5IHRoZSBjbGFzcy5cblx0ICovXG5cdHB1YmxpYyBnZXRDaGFuZ2VzKCk6IERpZmZDaGFuZ2VbXSB7XG5cdFx0aWYgKHRoaXMubV9vcmlnaW5hbENvdW50ID4gMCB8fCB0aGlzLm1fbW9kaWZpZWRDb3VudCA+IDApIHtcblx0XHRcdC8vIEZpbmlzaCB1cCBvbiB3aGF0ZXZlciBpcyBsZWZ0XG5cdFx0XHR0aGlzLk1hcmtOZXh0Q2hhbmdlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubV9jaGFuZ2VzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHJpZXZlcyBhbGwgb2YgdGhlIGNoYW5nZXMgbWFya2VkIGJ5IHRoZSBjbGFzcyBpbiB0aGUgcmV2ZXJzZSBvcmRlclxuXHQgKi9cblx0cHVibGljIGdldFJldmVyc2VDaGFuZ2VzKCk6IERpZmZDaGFuZ2VbXSB7XG5cdFx0aWYgKHRoaXMubV9vcmlnaW5hbENvdW50ID4gMCB8fCB0aGlzLm1fbW9kaWZpZWRDb3VudCA+IDApIHtcblx0XHRcdC8vIEZpbmlzaCB1cCBvbiB3aGF0ZXZlciBpcyBsZWZ0XG5cdFx0XHR0aGlzLk1hcmtOZXh0Q2hhbmdlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5tX2NoYW5nZXMucmV2ZXJzZSgpO1xuXHRcdHJldHVybiB0aGlzLm1fY2hhbmdlcztcblx0fVxuXG59XG5cbi8qKlxuICogQW4gaW1wbGVtZW50YXRpb24gb2YgdGhlIGRpZmZlcmVuY2UgYWxnb3JpdGhtIGRlc2NyaWJlZCBpblxuICogXCJBbiBPKE5EKSBEaWZmZXJlbmNlIEFsZ29yaXRobSBhbmQgaXRzIHZhcmlhdGlvbnNcIiBieSBFdWdlbmUgVy4gTXllcnNcbiAqL1xuZXhwb3J0IGNsYXNzIExjc0RpZmYge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgQ29udGludWVQcm9jZXNzaW5nUHJlZGljYXRlOiBJQ29udGludWVQcm9jZXNzaW5nUHJlZGljYXRlIHwgbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbFNlcXVlbmNlOiBJU2VxdWVuY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vZGlmaWVkU2VxdWVuY2U6IElTZXF1ZW5jZTtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzU3RyaW5nczogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxTdHJpbmdFbGVtZW50czogc3RyaW5nW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsRWxlbWVudHNPckhhc2g6IEludDMyQXJyYXk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vZGlmaWVkU3RyaW5nRWxlbWVudHM6IHN0cmluZ1tdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZEVsZW1lbnRzT3JIYXNoOiBJbnQzMkFycmF5O1xuXG5cdHByaXZhdGUgbV9mb3J3YXJkSGlzdG9yeTogSW50MzJBcnJheVtdO1xuXHRwcml2YXRlIG1fcmV2ZXJzZUhpc3Rvcnk6IEludDMyQXJyYXlbXTtcblxuXHQvKipcblx0ICogQ29uc3RydWN0cyB0aGUgRGlmZkZpbmRlclxuXHQgKi9cblx0Y29uc3RydWN0b3Iob3JpZ2luYWxTZXF1ZW5jZTogSVNlcXVlbmNlLCBtb2RpZmllZFNlcXVlbmNlOiBJU2VxdWVuY2UsIGNvbnRpbnVlUHJvY2Vzc2luZ1ByZWRpY2F0ZTogSUNvbnRpbnVlUHJvY2Vzc2luZ1ByZWRpY2F0ZSB8IG51bGwgPSBudWxsKSB7XG5cdFx0dGhpcy5Db250aW51ZVByb2Nlc3NpbmdQcmVkaWNhdGUgPSBjb250aW51ZVByb2Nlc3NpbmdQcmVkaWNhdGU7XG5cblx0XHR0aGlzLl9vcmlnaW5hbFNlcXVlbmNlID0gb3JpZ2luYWxTZXF1ZW5jZTtcblx0XHR0aGlzLl9tb2RpZmllZFNlcXVlbmNlID0gbW9kaWZpZWRTZXF1ZW5jZTtcblxuXHRcdGNvbnN0IFtvcmlnaW5hbFN0cmluZ0VsZW1lbnRzLCBvcmlnaW5hbEVsZW1lbnRzT3JIYXNoLCBvcmlnaW5hbEhhc1N0cmluZ3NdID0gTGNzRGlmZi5fZ2V0RWxlbWVudHMob3JpZ2luYWxTZXF1ZW5jZSk7XG5cdFx0Y29uc3QgW21vZGlmaWVkU3RyaW5nRWxlbWVudHMsIG1vZGlmaWVkRWxlbWVudHNPckhhc2gsIG1vZGlmaWVkSGFzU3RyaW5nc10gPSBMY3NEaWZmLl9nZXRFbGVtZW50cyhtb2RpZmllZFNlcXVlbmNlKTtcblxuXHRcdHRoaXMuX2hhc1N0cmluZ3MgPSAob3JpZ2luYWxIYXNTdHJpbmdzICYmIG1vZGlmaWVkSGFzU3RyaW5ncyk7XG5cdFx0dGhpcy5fb3JpZ2luYWxTdHJpbmdFbGVtZW50cyA9IG9yaWdpbmFsU3RyaW5nRWxlbWVudHM7XG5cdFx0dGhpcy5fb3JpZ2luYWxFbGVtZW50c09ySGFzaCA9IG9yaWdpbmFsRWxlbWVudHNPckhhc2g7XG5cdFx0dGhpcy5fbW9kaWZpZWRTdHJpbmdFbGVtZW50cyA9IG1vZGlmaWVkU3RyaW5nRWxlbWVudHM7XG5cdFx0dGhpcy5fbW9kaWZpZWRFbGVtZW50c09ySGFzaCA9IG1vZGlmaWVkRWxlbWVudHNPckhhc2g7XG5cblx0XHR0aGlzLm1fZm9yd2FyZEhpc3RvcnkgPSBbXTtcblx0XHR0aGlzLm1fcmV2ZXJzZUhpc3RvcnkgPSBbXTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9pc1N0cmluZ0FycmF5KGFycjogSW50MzJBcnJheSB8IG51bWJlcltdIHwgc3RyaW5nW10pOiBhcnIgaXMgc3RyaW5nW10ge1xuXHRcdHJldHVybiAoYXJyLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyclswXSA9PT0gJ3N0cmluZycpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2dldEVsZW1lbnRzKHNlcXVlbmNlOiBJU2VxdWVuY2UpOiBbc3RyaW5nW10sIEludDMyQXJyYXksIGJvb2xlYW5dIHtcblx0XHRjb25zdCBlbGVtZW50cyA9IHNlcXVlbmNlLmdldEVsZW1lbnRzKCk7XG5cblx0XHRpZiAoTGNzRGlmZi5faXNTdHJpbmdBcnJheShlbGVtZW50cykpIHtcblx0XHRcdGNvbnN0IGhhc2hlcyA9IG5ldyBJbnQzMkFycmF5KGVsZW1lbnRzLmxlbmd0aCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gZWxlbWVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0aGFzaGVzW2ldID0gc3RyaW5nSGFzaChlbGVtZW50c1tpXSwgMCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gW2VsZW1lbnRzLCBoYXNoZXMsIHRydWVdO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50cyBpbnN0YW5jZW9mIEludDMyQXJyYXkpIHtcblx0XHRcdHJldHVybiBbW10sIGVsZW1lbnRzLCBmYWxzZV07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtbXSwgbmV3IEludDMyQXJyYXkoZWxlbWVudHMpLCBmYWxzZV07XG5cdH1cblxuXHRwcml2YXRlIEVsZW1lbnRzQXJlRXF1YWwob3JpZ2luYWxJbmRleDogbnVtYmVyLCBuZXdJbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX29yaWdpbmFsRWxlbWVudHNPckhhc2hbb3JpZ2luYWxJbmRleF0gIT09IHRoaXMuX21vZGlmaWVkRWxlbWVudHNPckhhc2hbbmV3SW5kZXhdKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiAodGhpcy5faGFzU3RyaW5ncyA/IHRoaXMuX29yaWdpbmFsU3RyaW5nRWxlbWVudHNbb3JpZ2luYWxJbmRleF0gPT09IHRoaXMuX21vZGlmaWVkU3RyaW5nRWxlbWVudHNbbmV3SW5kZXhdIDogdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIEVsZW1lbnRzQXJlU3RyaWN0RXF1YWwob3JpZ2luYWxJbmRleDogbnVtYmVyLCBuZXdJbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLkVsZW1lbnRzQXJlRXF1YWwob3JpZ2luYWxJbmRleCwgbmV3SW5kZXgpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IG9yaWdpbmFsRWxlbWVudCA9IExjc0RpZmYuX2dldFN0cmljdEVsZW1lbnQodGhpcy5fb3JpZ2luYWxTZXF1ZW5jZSwgb3JpZ2luYWxJbmRleCk7XG5cdFx0Y29uc3QgbW9kaWZpZWRFbGVtZW50ID0gTGNzRGlmZi5fZ2V0U3RyaWN0RWxlbWVudCh0aGlzLl9tb2RpZmllZFNlcXVlbmNlLCBuZXdJbmRleCk7XG5cdFx0cmV0dXJuIChvcmlnaW5hbEVsZW1lbnQgPT09IG1vZGlmaWVkRWxlbWVudCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZ2V0U3RyaWN0RWxlbWVudChzZXF1ZW5jZTogSVNlcXVlbmNlLCBpbmRleDogbnVtYmVyKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKHR5cGVvZiBzZXF1ZW5jZS5nZXRTdHJpY3RFbGVtZW50ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gc2VxdWVuY2UuZ2V0U3RyaWN0RWxlbWVudChpbmRleCk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBPcmlnaW5hbEVsZW1lbnRzQXJlRXF1YWwoaW5kZXgxOiBudW1iZXIsIGluZGV4MjogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX29yaWdpbmFsRWxlbWVudHNPckhhc2hbaW5kZXgxXSAhPT0gdGhpcy5fb3JpZ2luYWxFbGVtZW50c09ySGFzaFtpbmRleDJdKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiAodGhpcy5faGFzU3RyaW5ncyA/IHRoaXMuX29yaWdpbmFsU3RyaW5nRWxlbWVudHNbaW5kZXgxXSA9PT0gdGhpcy5fb3JpZ2luYWxTdHJpbmdFbGVtZW50c1tpbmRleDJdIDogdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIE1vZGlmaWVkRWxlbWVudHNBcmVFcXVhbChpbmRleDE6IG51bWJlciwgaW5kZXgyOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbW9kaWZpZWRFbGVtZW50c09ySGFzaFtpbmRleDFdICE9PSB0aGlzLl9tb2RpZmllZEVsZW1lbnRzT3JIYXNoW2luZGV4Ml0pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuICh0aGlzLl9oYXNTdHJpbmdzID8gdGhpcy5fbW9kaWZpZWRTdHJpbmdFbGVtZW50c1tpbmRleDFdID09PSB0aGlzLl9tb2RpZmllZFN0cmluZ0VsZW1lbnRzW2luZGV4Ml0gOiB0cnVlKTtcblx0fVxuXG5cdHB1YmxpYyBDb21wdXRlRGlmZihwcmV0dHk6IGJvb2xlYW4pOiBJRGlmZlJlc3VsdCB7XG5cdFx0cmV0dXJuIHRoaXMuX0NvbXB1dGVEaWZmKDAsIHRoaXMuX29yaWdpbmFsRWxlbWVudHNPckhhc2gubGVuZ3RoIC0gMSwgMCwgdGhpcy5fbW9kaWZpZWRFbGVtZW50c09ySGFzaC5sZW5ndGggLSAxLCBwcmV0dHkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbXB1dGVzIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHRoZSBvcmlnaW5hbCBhbmQgbW9kaWZpZWQgaW5wdXRcblx0ICogc2VxdWVuY2VzIG9uIHRoZSBib3VuZGVkIHJhbmdlLlxuXHQgKiBAcmV0dXJucyBBbiBhcnJheSBvZiB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0aGUgdHdvIGlucHV0IHNlcXVlbmNlcy5cblx0ICovXG5cdHByaXZhdGUgX0NvbXB1dGVEaWZmKG9yaWdpbmFsU3RhcnQ6IG51bWJlciwgb3JpZ2luYWxFbmQ6IG51bWJlciwgbW9kaWZpZWRTdGFydDogbnVtYmVyLCBtb2RpZmllZEVuZDogbnVtYmVyLCBwcmV0dHk6IGJvb2xlYW4pOiBJRGlmZlJlc3VsdCB7XG5cdFx0Y29uc3QgcXVpdEVhcmx5QXJyID0gW2ZhbHNlXTtcblx0XHRsZXQgY2hhbmdlcyA9IHRoaXMuQ29tcHV0ZURpZmZSZWN1cnNpdmUob3JpZ2luYWxTdGFydCwgb3JpZ2luYWxFbmQsIG1vZGlmaWVkU3RhcnQsIG1vZGlmaWVkRW5kLCBxdWl0RWFybHlBcnIpO1xuXG5cdFx0aWYgKHByZXR0eSkge1xuXHRcdFx0Ly8gV2UgaGF2ZSB0byBjbGVhbiB1cCB0aGUgY29tcHV0ZWQgZGlmZiB0byBiZSBtb3JlIGludHVpdGl2ZVxuXHRcdFx0Ly8gYnV0IGl0IHR1cm5zIG91dCB0aGlzIGNhbm5vdCBiZSBkb25lIGNvcnJlY3RseSB1bnRpbCB0aGUgZW50aXJlIHNldFxuXHRcdFx0Ly8gb2YgZGlmZnMgaGF2ZSBiZWVuIGNvbXB1dGVkXG5cdFx0XHRjaGFuZ2VzID0gdGhpcy5QcmV0dGlmeUNoYW5nZXMoY2hhbmdlcyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHF1aXRFYXJseTogcXVpdEVhcmx5QXJyWzBdLFxuXHRcdFx0Y2hhbmdlczogY2hhbmdlc1xuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogUHJpdmF0ZSBoZWxwZXIgbWV0aG9kIHdoaWNoIGNvbXB1dGVzIHRoZSBkaWZmZXJlbmNlcyBvbiB0aGUgYm91bmRlZCByYW5nZVxuXHQgKiByZWN1cnNpdmVseS5cblx0ICogQHJldHVybnMgQW4gYXJyYXkgb2YgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdGhlIHR3byBpbnB1dCBzZXF1ZW5jZXMuXG5cdCAqL1xuXHRwcml2YXRlIENvbXB1dGVEaWZmUmVjdXJzaXZlKG9yaWdpbmFsU3RhcnQ6IG51bWJlciwgb3JpZ2luYWxFbmQ6IG51bWJlciwgbW9kaWZpZWRTdGFydDogbnVtYmVyLCBtb2RpZmllZEVuZDogbnVtYmVyLCBxdWl0RWFybHlBcnI6IGJvb2xlYW5bXSk6IERpZmZDaGFuZ2VbXSB7XG5cdFx0cXVpdEVhcmx5QXJyWzBdID0gZmFsc2U7XG5cblx0XHQvLyBGaW5kIHRoZSBzdGFydCBvZiB0aGUgZGlmZmVyZW5jZXNcblx0XHR3aGlsZSAob3JpZ2luYWxTdGFydCA8PSBvcmlnaW5hbEVuZCAmJiBtb2RpZmllZFN0YXJ0IDw9IG1vZGlmaWVkRW5kICYmIHRoaXMuRWxlbWVudHNBcmVFcXVhbChvcmlnaW5hbFN0YXJ0LCBtb2RpZmllZFN0YXJ0KSkge1xuXHRcdFx0b3JpZ2luYWxTdGFydCsrO1xuXHRcdFx0bW9kaWZpZWRTdGFydCsrO1xuXHRcdH1cblxuXHRcdC8vIEZpbmQgdGhlIGVuZCBvZiB0aGUgZGlmZmVyZW5jZXNcblx0XHR3aGlsZSAob3JpZ2luYWxFbmQgPj0gb3JpZ2luYWxTdGFydCAmJiBtb2RpZmllZEVuZCA+PSBtb2RpZmllZFN0YXJ0ICYmIHRoaXMuRWxlbWVudHNBcmVFcXVhbChvcmlnaW5hbEVuZCwgbW9kaWZpZWRFbmQpKSB7XG5cdFx0XHRvcmlnaW5hbEVuZC0tO1xuXHRcdFx0bW9kaWZpZWRFbmQtLTtcblx0XHR9XG5cblx0XHQvLyBJbiB0aGUgc3BlY2lhbCBjYXNlIHdoZXJlIHdlIGVpdGhlciBoYXZlIGFsbCBpbnNlcnRpb25zIG9yIGFsbCBkZWxldGlvbnMgb3IgdGhlIHNlcXVlbmNlcyBhcmUgaWRlbnRpY2FsXG5cdFx0aWYgKG9yaWdpbmFsU3RhcnQgPiBvcmlnaW5hbEVuZCB8fCBtb2RpZmllZFN0YXJ0ID4gbW9kaWZpZWRFbmQpIHtcblx0XHRcdGxldCBjaGFuZ2VzOiBEaWZmQ2hhbmdlW107XG5cblx0XHRcdGlmIChtb2RpZmllZFN0YXJ0IDw9IG1vZGlmaWVkRW5kKSB7XG5cdFx0XHRcdERlYnVnLkFzc2VydChvcmlnaW5hbFN0YXJ0ID09PSBvcmlnaW5hbEVuZCArIDEsICdvcmlnaW5hbFN0YXJ0IHNob3VsZCBvbmx5IGJlIG9uZSBtb3JlIHRoYW4gb3JpZ2luYWxFbmQnKTtcblxuXHRcdFx0XHQvLyBBbGwgaW5zZXJ0aW9uc1xuXHRcdFx0XHRjaGFuZ2VzID0gW1xuXHRcdFx0XHRcdG5ldyBEaWZmQ2hhbmdlKG9yaWdpbmFsU3RhcnQsIDAsIG1vZGlmaWVkU3RhcnQsIG1vZGlmaWVkRW5kIC0gbW9kaWZpZWRTdGFydCArIDEpXG5cdFx0XHRcdF07XG5cdFx0XHR9IGVsc2UgaWYgKG9yaWdpbmFsU3RhcnQgPD0gb3JpZ2luYWxFbmQpIHtcblx0XHRcdFx0RGVidWcuQXNzZXJ0KG1vZGlmaWVkU3RhcnQgPT09IG1vZGlmaWVkRW5kICsgMSwgJ21vZGlmaWVkU3RhcnQgc2hvdWxkIG9ubHkgYmUgb25lIG1vcmUgdGhhbiBtb2RpZmllZEVuZCcpO1xuXG5cdFx0XHRcdC8vIEFsbCBkZWxldGlvbnNcblx0XHRcdFx0Y2hhbmdlcyA9IFtcblx0XHRcdFx0XHRuZXcgRGlmZkNoYW5nZShvcmlnaW5hbFN0YXJ0LCBvcmlnaW5hbEVuZCAtIG9yaWdpbmFsU3RhcnQgKyAxLCBtb2RpZmllZFN0YXJ0LCAwKVxuXHRcdFx0XHRdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0RGVidWcuQXNzZXJ0KG9yaWdpbmFsU3RhcnQgPT09IG9yaWdpbmFsRW5kICsgMSwgJ29yaWdpbmFsU3RhcnQgc2hvdWxkIG9ubHkgYmUgb25lIG1vcmUgdGhhbiBvcmlnaW5hbEVuZCcpO1xuXHRcdFx0XHREZWJ1Zy5Bc3NlcnQobW9kaWZpZWRTdGFydCA9PT0gbW9kaWZpZWRFbmQgKyAxLCAnbW9kaWZpZWRTdGFydCBzaG91bGQgb25seSBiZSBvbmUgbW9yZSB0aGFuIG1vZGlmaWVkRW5kJyk7XG5cblx0XHRcdFx0Ly8gSWRlbnRpY2FsIHNlcXVlbmNlcyAtIE5vIGRpZmZlcmVuY2VzXG5cdFx0XHRcdGNoYW5nZXMgPSBbXTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNoYW5nZXM7XG5cdFx0fVxuXG5cdFx0Ly8gVGhpcyBwcm9ibGVtIGNhbiBiZSBzb2x2ZWQgdXNpbmcgdGhlIERpdmlkZS1BbmQtQ29ucXVlciB0ZWNobmlxdWUuXG5cdFx0Y29uc3QgbWlkT3JpZ2luYWxBcnIgPSBbMF07XG5cdFx0Y29uc3QgbWlkTW9kaWZpZWRBcnIgPSBbMF07XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5Db21wdXRlUmVjdXJzaW9uUG9pbnQob3JpZ2luYWxTdGFydCwgb3JpZ2luYWxFbmQsIG1vZGlmaWVkU3RhcnQsIG1vZGlmaWVkRW5kLCBtaWRPcmlnaW5hbEFyciwgbWlkTW9kaWZpZWRBcnIsIHF1aXRFYXJseUFycik7XG5cblx0XHRjb25zdCBtaWRPcmlnaW5hbCA9IG1pZE9yaWdpbmFsQXJyWzBdO1xuXHRcdGNvbnN0IG1pZE1vZGlmaWVkID0gbWlkTW9kaWZpZWRBcnJbMF07XG5cblx0XHRpZiAocmVzdWx0ICE9PSBudWxsKSB7XG5cdFx0XHQvLyBSZXN1bHQgaXMgbm90LW51bGwgd2hlbiB0aGVyZSB3YXMgZW5vdWdoIG1lbW9yeSB0byBjb21wdXRlIHRoZSBjaGFuZ2VzIHdoaWxlXG5cdFx0XHQvLyBzZWFyY2hpbmcgZm9yIHRoZSByZWN1cnNpb24gcG9pbnRcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSBlbHNlIGlmICghcXVpdEVhcmx5QXJyWzBdKSB7XG5cdFx0XHQvLyBXZSBjYW4gYnJlYWsgdGhlIHByb2JsZW0gZG93biByZWN1cnNpdmVseSBieSBmaW5kaW5nIHRoZSBjaGFuZ2VzIGluIHRoZVxuXHRcdFx0Ly8gRmlyc3QgSGFsZjogICAob3JpZ2luYWxTdGFydCwgbW9kaWZpZWRTdGFydCkgdG8gKG1pZE9yaWdpbmFsLCBtaWRNb2RpZmllZClcblx0XHRcdC8vIFNlY29uZCBIYWxmOiAgKG1pZE9yaWdpbmFsICsgMSwgbWluTW9kaWZpZWQgKyAxKSB0byAob3JpZ2luYWxFbmQsIG1vZGlmaWVkRW5kKVxuXHRcdFx0Ly8gTk9URTogQ29tcHV0ZURpZmYoKSBpcyBpbmNsdXNpdmUsIHRoZXJlZm9yZSB0aGUgc2Vjb25kIHJhbmdlIHN0YXJ0cyBvbiB0aGUgbmV4dCBwb2ludFxuXG5cdFx0XHRjb25zdCBsZWZ0Q2hhbmdlcyA9IHRoaXMuQ29tcHV0ZURpZmZSZWN1cnNpdmUob3JpZ2luYWxTdGFydCwgbWlkT3JpZ2luYWwsIG1vZGlmaWVkU3RhcnQsIG1pZE1vZGlmaWVkLCBxdWl0RWFybHlBcnIpO1xuXHRcdFx0bGV0IHJpZ2h0Q2hhbmdlczogRGlmZkNoYW5nZVtdID0gW107XG5cblx0XHRcdGlmICghcXVpdEVhcmx5QXJyWzBdKSB7XG5cdFx0XHRcdHJpZ2h0Q2hhbmdlcyA9IHRoaXMuQ29tcHV0ZURpZmZSZWN1cnNpdmUobWlkT3JpZ2luYWwgKyAxLCBvcmlnaW5hbEVuZCwgbWlkTW9kaWZpZWQgKyAxLCBtb2RpZmllZEVuZCwgcXVpdEVhcmx5QXJyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFdlIGRpZG4ndCBoYXZlIHRpbWUgdG8gZmluaXNoIHRoZSBmaXJzdCBoYWxmLCBzbyB3ZSBkb24ndCBoYXZlIHRpbWUgdG8gY29tcHV0ZSB0aGlzIGhhbGYuXG5cdFx0XHRcdC8vIENvbnNpZGVyIHRoZSBlbnRpcmUgcmVzdCBvZiB0aGUgc2VxdWVuY2UgZGlmZmVyZW50LlxuXHRcdFx0XHRyaWdodENoYW5nZXMgPSBbXG5cdFx0XHRcdFx0bmV3IERpZmZDaGFuZ2UobWlkT3JpZ2luYWwgKyAxLCBvcmlnaW5hbEVuZCAtIChtaWRPcmlnaW5hbCArIDEpICsgMSwgbWlkTW9kaWZpZWQgKyAxLCBtb2RpZmllZEVuZCAtIChtaWRNb2RpZmllZCArIDEpICsgMSlcblx0XHRcdFx0XTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuQ29uY2F0ZW5hdGVDaGFuZ2VzKGxlZnRDaGFuZ2VzLCByaWdodENoYW5nZXMpO1xuXHRcdH1cblxuXHRcdC8vIElmIHdlIGhpdCBoZXJlLCB3ZSBxdWl0IGVhcmx5LCBhbmQgc28gY2FuJ3QgcmV0dXJuIGFueXRoaW5nIG1lYW5pbmdmdWxcblx0XHRyZXR1cm4gW1xuXHRcdFx0bmV3IERpZmZDaGFuZ2Uob3JpZ2luYWxTdGFydCwgb3JpZ2luYWxFbmQgLSBvcmlnaW5hbFN0YXJ0ICsgMSwgbW9kaWZpZWRTdGFydCwgbW9kaWZpZWRFbmQgLSBtb2RpZmllZFN0YXJ0ICsgMSlcblx0XHRdO1xuXHR9XG5cblx0cHJpdmF0ZSBXQUxLVFJBQ0UoZGlhZ29uYWxGb3J3YXJkQmFzZTogbnVtYmVyLCBkaWFnb25hbEZvcndhcmRTdGFydDogbnVtYmVyLCBkaWFnb25hbEZvcndhcmRFbmQ6IG51bWJlciwgZGlhZ29uYWxGb3J3YXJkT2Zmc2V0OiBudW1iZXIsXG5cdFx0ZGlhZ29uYWxSZXZlcnNlQmFzZTogbnVtYmVyLCBkaWFnb25hbFJldmVyc2VTdGFydDogbnVtYmVyLCBkaWFnb25hbFJldmVyc2VFbmQ6IG51bWJlciwgZGlhZ29uYWxSZXZlcnNlT2Zmc2V0OiBudW1iZXIsXG5cdFx0Zm9yd2FyZFBvaW50czogSW50MzJBcnJheSwgcmV2ZXJzZVBvaW50czogSW50MzJBcnJheSxcblx0XHRvcmlnaW5hbEluZGV4OiBudW1iZXIsIG9yaWdpbmFsRW5kOiBudW1iZXIsIG1pZE9yaWdpbmFsQXJyOiBudW1iZXJbXSxcblx0XHRtb2RpZmllZEluZGV4OiBudW1iZXIsIG1vZGlmaWVkRW5kOiBudW1iZXIsIG1pZE1vZGlmaWVkQXJyOiBudW1iZXJbXSxcblx0XHRkZWx0YUlzRXZlbjogYm9vbGVhbiwgcXVpdEVhcmx5QXJyOiBib29sZWFuW11cblx0KTogRGlmZkNoYW5nZVtdIHtcblx0XHRsZXQgZm9yd2FyZENoYW5nZXM6IERpZmZDaGFuZ2VbXSB8IG51bGwgPSBudWxsO1xuXHRcdGxldCByZXZlcnNlQ2hhbmdlczogRGlmZkNoYW5nZVtdIHwgbnVsbCA9IG51bGw7XG5cblx0XHQvLyBGaXJzdCwgd2FsayBiYWNrd2FyZCB0aHJvdWdoIHRoZSBmb3J3YXJkIGRpYWdvbmFscyBoaXN0b3J5XG5cdFx0bGV0IGNoYW5nZUhlbHBlciA9IG5ldyBEaWZmQ2hhbmdlSGVscGVyKCk7XG5cdFx0bGV0IGRpYWdvbmFsTWluID0gZGlhZ29uYWxGb3J3YXJkU3RhcnQ7XG5cdFx0bGV0IGRpYWdvbmFsTWF4ID0gZGlhZ29uYWxGb3J3YXJkRW5kO1xuXHRcdGxldCBkaWFnb25hbFJlbGF0aXZlID0gKG1pZE9yaWdpbmFsQXJyWzBdIC0gbWlkTW9kaWZpZWRBcnJbMF0pIC0gZGlhZ29uYWxGb3J3YXJkT2Zmc2V0O1xuXHRcdGxldCBsYXN0T3JpZ2luYWxJbmRleCA9IENvbnN0YW50cy5NSU5fU0FGRV9TTUFMTF9JTlRFR0VSO1xuXHRcdGxldCBoaXN0b3J5SW5kZXggPSB0aGlzLm1fZm9yd2FyZEhpc3RvcnkubGVuZ3RoIC0gMTtcblxuXHRcdGRvIHtcblx0XHRcdC8vIEdldCB0aGUgZGlhZ29uYWwgaW5kZXggZnJvbSB0aGUgcmVsYXRpdmUgZGlhZ29uYWwgbnVtYmVyXG5cdFx0XHRjb25zdCBkaWFnb25hbCA9IGRpYWdvbmFsUmVsYXRpdmUgKyBkaWFnb25hbEZvcndhcmRCYXNlO1xuXG5cdFx0XHQvLyBGaWd1cmUgb3V0IHdoZXJlIHdlIGNhbWUgZnJvbVxuXHRcdFx0aWYgKGRpYWdvbmFsID09PSBkaWFnb25hbE1pbiB8fCAoZGlhZ29uYWwgPCBkaWFnb25hbE1heCAmJiBmb3J3YXJkUG9pbnRzW2RpYWdvbmFsIC0gMV0gPCBmb3J3YXJkUG9pbnRzW2RpYWdvbmFsICsgMV0pKSB7XG5cdFx0XHRcdC8vIFZlcnRpY2FsIGxpbmUgKHRoZSBlbGVtZW50IGlzIGFuIGluc2VydClcblx0XHRcdFx0b3JpZ2luYWxJbmRleCA9IGZvcndhcmRQb2ludHNbZGlhZ29uYWwgKyAxXTtcblx0XHRcdFx0bW9kaWZpZWRJbmRleCA9IG9yaWdpbmFsSW5kZXggLSBkaWFnb25hbFJlbGF0aXZlIC0gZGlhZ29uYWxGb3J3YXJkT2Zmc2V0O1xuXHRcdFx0XHRpZiAob3JpZ2luYWxJbmRleCA8IGxhc3RPcmlnaW5hbEluZGV4KSB7XG5cdFx0XHRcdFx0Y2hhbmdlSGVscGVyLk1hcmtOZXh0Q2hhbmdlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGFzdE9yaWdpbmFsSW5kZXggPSBvcmlnaW5hbEluZGV4O1xuXHRcdFx0XHRjaGFuZ2VIZWxwZXIuQWRkTW9kaWZpZWRFbGVtZW50KG9yaWdpbmFsSW5kZXggKyAxLCBtb2RpZmllZEluZGV4KTtcblx0XHRcdFx0ZGlhZ29uYWxSZWxhdGl2ZSA9IChkaWFnb25hbCArIDEpIC0gZGlhZ29uYWxGb3J3YXJkQmFzZTsgLy9TZXR1cCBmb3IgdGhlIG5leHQgaXRlcmF0aW9uXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBIb3Jpem9udGFsIGxpbmUgKHRoZSBlbGVtZW50IGlzIGEgZGVsZXRpb24pXG5cdFx0XHRcdG9yaWdpbmFsSW5kZXggPSBmb3J3YXJkUG9pbnRzW2RpYWdvbmFsIC0gMV0gKyAxO1xuXHRcdFx0XHRtb2RpZmllZEluZGV4ID0gb3JpZ2luYWxJbmRleCAtIGRpYWdvbmFsUmVsYXRpdmUgLSBkaWFnb25hbEZvcndhcmRPZmZzZXQ7XG5cdFx0XHRcdGlmIChvcmlnaW5hbEluZGV4IDwgbGFzdE9yaWdpbmFsSW5kZXgpIHtcblx0XHRcdFx0XHRjaGFuZ2VIZWxwZXIuTWFya05leHRDaGFuZ2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRsYXN0T3JpZ2luYWxJbmRleCA9IG9yaWdpbmFsSW5kZXggLSAxO1xuXHRcdFx0XHRjaGFuZ2VIZWxwZXIuQWRkT3JpZ2luYWxFbGVtZW50KG9yaWdpbmFsSW5kZXgsIG1vZGlmaWVkSW5kZXggKyAxKTtcblx0XHRcdFx0ZGlhZ29uYWxSZWxhdGl2ZSA9IChkaWFnb25hbCAtIDEpIC0gZGlhZ29uYWxGb3J3YXJkQmFzZTsgLy9TZXR1cCBmb3IgdGhlIG5leHQgaXRlcmF0aW9uXG5cdFx0XHR9XG5cblx0XHRcdGlmIChoaXN0b3J5SW5kZXggPj0gMCkge1xuXHRcdFx0XHRmb3J3YXJkUG9pbnRzID0gdGhpcy5tX2ZvcndhcmRIaXN0b3J5W2hpc3RvcnlJbmRleF07XG5cdFx0XHRcdGRpYWdvbmFsRm9yd2FyZEJhc2UgPSBmb3J3YXJkUG9pbnRzWzBdOyAvL1dlIHN0b3JlZCB0aGlzIGluIHRoZSBmaXJzdCBzcG90XG5cdFx0XHRcdGRpYWdvbmFsTWluID0gMTtcblx0XHRcdFx0ZGlhZ29uYWxNYXggPSBmb3J3YXJkUG9pbnRzLmxlbmd0aCAtIDE7XG5cdFx0XHR9XG5cdFx0fSB3aGlsZSAoLS1oaXN0b3J5SW5kZXggPj0gLTEpO1xuXG5cdFx0Ly8gSXJvbmljYWxseSwgd2UgZ2V0IHRoZSBmb3J3YXJkIGNoYW5nZXMgYXMgdGhlIHJldmVyc2Ugb2YgdGhlXG5cdFx0Ly8gb3JkZXIgd2UgYWRkZWQgdGhlbSBzaW5jZSB3ZSB0ZWNobmljYWxseSBhZGRlZCB0aGVtIGJhY2t3YXJkc1xuXHRcdGZvcndhcmRDaGFuZ2VzID0gY2hhbmdlSGVscGVyLmdldFJldmVyc2VDaGFuZ2VzKCk7XG5cblx0XHRpZiAocXVpdEVhcmx5QXJyWzBdKSB7XG5cdFx0XHQvLyBUT0RPOiBDYWxjdWxhdGUgYSBwYXJ0aWFsIGZyb20gdGhlIHJldmVyc2UgZGlhZ29uYWxzLlxuXHRcdFx0Ly8gICAgICAgRm9yIG5vdywganVzdCBhc3N1bWUgZXZlcnl0aGluZyBhZnRlciB0aGUgbWlkT3JpZ2luYWwvbWlkTW9kaWZpZWQgcG9pbnQgaXMgYSBkaWZmXG5cblx0XHRcdGxldCBvcmlnaW5hbFN0YXJ0UG9pbnQgPSBtaWRPcmlnaW5hbEFyclswXSArIDE7XG5cdFx0XHRsZXQgbW9kaWZpZWRTdGFydFBvaW50ID0gbWlkTW9kaWZpZWRBcnJbMF0gKyAxO1xuXG5cdFx0XHRpZiAoZm9yd2FyZENoYW5nZXMgIT09IG51bGwgJiYgZm9yd2FyZENoYW5nZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBsYXN0Rm9yd2FyZENoYW5nZSA9IGZvcndhcmRDaGFuZ2VzW2ZvcndhcmRDaGFuZ2VzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRvcmlnaW5hbFN0YXJ0UG9pbnQgPSBNYXRoLm1heChvcmlnaW5hbFN0YXJ0UG9pbnQsIGxhc3RGb3J3YXJkQ2hhbmdlLmdldE9yaWdpbmFsRW5kKCkpO1xuXHRcdFx0XHRtb2RpZmllZFN0YXJ0UG9pbnQgPSBNYXRoLm1heChtb2RpZmllZFN0YXJ0UG9pbnQsIGxhc3RGb3J3YXJkQ2hhbmdlLmdldE1vZGlmaWVkRW5kKCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXZlcnNlQ2hhbmdlcyA9IFtcblx0XHRcdFx0bmV3IERpZmZDaGFuZ2Uob3JpZ2luYWxTdGFydFBvaW50LCBvcmlnaW5hbEVuZCAtIG9yaWdpbmFsU3RhcnRQb2ludCArIDEsXG5cdFx0XHRcdFx0bW9kaWZpZWRTdGFydFBvaW50LCBtb2RpZmllZEVuZCAtIG1vZGlmaWVkU3RhcnRQb2ludCArIDEpXG5cdFx0XHRdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBOb3cgd2FsayBiYWNrd2FyZCB0aHJvdWdoIHRoZSByZXZlcnNlIGRpYWdvbmFscyBoaXN0b3J5XG5cdFx0XHRjaGFuZ2VIZWxwZXIgPSBuZXcgRGlmZkNoYW5nZUhlbHBlcigpO1xuXHRcdFx0ZGlhZ29uYWxNaW4gPSBkaWFnb25hbFJldmVyc2VTdGFydDtcblx0XHRcdGRpYWdvbmFsTWF4ID0gZGlhZ29uYWxSZXZlcnNlRW5kO1xuXHRcdFx0ZGlhZ29uYWxSZWxhdGl2ZSA9IChtaWRPcmlnaW5hbEFyclswXSAtIG1pZE1vZGlmaWVkQXJyWzBdKSAtIGRpYWdvbmFsUmV2ZXJzZU9mZnNldDtcblx0XHRcdGxhc3RPcmlnaW5hbEluZGV4ID0gQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVI7XG5cdFx0XHRoaXN0b3J5SW5kZXggPSAoZGVsdGFJc0V2ZW4pID8gdGhpcy5tX3JldmVyc2VIaXN0b3J5Lmxlbmd0aCAtIDEgOiB0aGlzLm1fcmV2ZXJzZUhpc3RvcnkubGVuZ3RoIC0gMjtcblxuXHRcdFx0ZG8ge1xuXHRcdFx0XHQvLyBHZXQgdGhlIGRpYWdvbmFsIGluZGV4IGZyb20gdGhlIHJlbGF0aXZlIGRpYWdvbmFsIG51bWJlclxuXHRcdFx0XHRjb25zdCBkaWFnb25hbCA9IGRpYWdvbmFsUmVsYXRpdmUgKyBkaWFnb25hbFJldmVyc2VCYXNlO1xuXG5cdFx0XHRcdC8vIEZpZ3VyZSBvdXQgd2hlcmUgd2UgY2FtZSBmcm9tXG5cdFx0XHRcdGlmIChkaWFnb25hbCA9PT0gZGlhZ29uYWxNaW4gfHwgKGRpYWdvbmFsIDwgZGlhZ29uYWxNYXggJiYgcmV2ZXJzZVBvaW50c1tkaWFnb25hbCAtIDFdID49IHJldmVyc2VQb2ludHNbZGlhZ29uYWwgKyAxXSkpIHtcblx0XHRcdFx0XHQvLyBIb3Jpem9udGFsIGxpbmUgKHRoZSBlbGVtZW50IGlzIGEgZGVsZXRpb24pKVxuXHRcdFx0XHRcdG9yaWdpbmFsSW5kZXggPSByZXZlcnNlUG9pbnRzW2RpYWdvbmFsICsgMV0gLSAxO1xuXHRcdFx0XHRcdG1vZGlmaWVkSW5kZXggPSBvcmlnaW5hbEluZGV4IC0gZGlhZ29uYWxSZWxhdGl2ZSAtIGRpYWdvbmFsUmV2ZXJzZU9mZnNldDtcblx0XHRcdFx0XHRpZiAob3JpZ2luYWxJbmRleCA+IGxhc3RPcmlnaW5hbEluZGV4KSB7XG5cdFx0XHRcdFx0XHRjaGFuZ2VIZWxwZXIuTWFya05leHRDaGFuZ2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGFzdE9yaWdpbmFsSW5kZXggPSBvcmlnaW5hbEluZGV4ICsgMTtcblx0XHRcdFx0XHRjaGFuZ2VIZWxwZXIuQWRkT3JpZ2luYWxFbGVtZW50KG9yaWdpbmFsSW5kZXggKyAxLCBtb2RpZmllZEluZGV4ICsgMSk7XG5cdFx0XHRcdFx0ZGlhZ29uYWxSZWxhdGl2ZSA9IChkaWFnb25hbCArIDEpIC0gZGlhZ29uYWxSZXZlcnNlQmFzZTsgLy9TZXR1cCBmb3IgdGhlIG5leHQgaXRlcmF0aW9uXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gVmVydGljYWwgbGluZSAodGhlIGVsZW1lbnQgaXMgYW4gaW5zZXJ0aW9uKVxuXHRcdFx0XHRcdG9yaWdpbmFsSW5kZXggPSByZXZlcnNlUG9pbnRzW2RpYWdvbmFsIC0gMV07XG5cdFx0XHRcdFx0bW9kaWZpZWRJbmRleCA9IG9yaWdpbmFsSW5kZXggLSBkaWFnb25hbFJlbGF0aXZlIC0gZGlhZ29uYWxSZXZlcnNlT2Zmc2V0O1xuXHRcdFx0XHRcdGlmIChvcmlnaW5hbEluZGV4ID4gbGFzdE9yaWdpbmFsSW5kZXgpIHtcblx0XHRcdFx0XHRcdGNoYW5nZUhlbHBlci5NYXJrTmV4dENoYW5nZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRsYXN0T3JpZ2luYWxJbmRleCA9IG9yaWdpbmFsSW5kZXg7XG5cdFx0XHRcdFx0Y2hhbmdlSGVscGVyLkFkZE1vZGlmaWVkRWxlbWVudChvcmlnaW5hbEluZGV4ICsgMSwgbW9kaWZpZWRJbmRleCArIDEpO1xuXHRcdFx0XHRcdGRpYWdvbmFsUmVsYXRpdmUgPSAoZGlhZ29uYWwgLSAxKSAtIGRpYWdvbmFsUmV2ZXJzZUJhc2U7IC8vU2V0dXAgZm9yIHRoZSBuZXh0IGl0ZXJhdGlvblxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGhpc3RvcnlJbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0cmV2ZXJzZVBvaW50cyA9IHRoaXMubV9yZXZlcnNlSGlzdG9yeVtoaXN0b3J5SW5kZXhdO1xuXHRcdFx0XHRcdGRpYWdvbmFsUmV2ZXJzZUJhc2UgPSByZXZlcnNlUG9pbnRzWzBdOyAvL1dlIHN0b3JlZCB0aGlzIGluIHRoZSBmaXJzdCBzcG90XG5cdFx0XHRcdFx0ZGlhZ29uYWxNaW4gPSAxO1xuXHRcdFx0XHRcdGRpYWdvbmFsTWF4ID0gcmV2ZXJzZVBvaW50cy5sZW5ndGggLSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlICgtLWhpc3RvcnlJbmRleCA+PSAtMSk7XG5cblx0XHRcdC8vIFRoZXJlIGFyZSBjYXNlcyB3aGVyZSB0aGUgcmV2ZXJzZSBoaXN0b3J5IHdpbGwgZmluZCBkaWZmcyB0aGF0XG5cdFx0XHQvLyBhcmUgY29ycmVjdCwgYnV0IG5vdCBpbnR1aXRpdmUsIHNvIHdlIG5lZWQgc2hpZnQgdGhlbS5cblx0XHRcdHJldmVyc2VDaGFuZ2VzID0gY2hhbmdlSGVscGVyLmdldENoYW5nZXMoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5Db25jYXRlbmF0ZUNoYW5nZXMoZm9yd2FyZENoYW5nZXMsIHJldmVyc2VDaGFuZ2VzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiB0aGUgcmFuZ2UgdG8gY29tcHV0ZSB0aGUgZGlmZiBvbiwgdGhpcyBtZXRob2QgZmluZHMgdGhlIHBvaW50OlxuXHQgKiAobWlkT3JpZ2luYWwsIG1pZE1vZGlmaWVkKVxuXHQgKiB0aGF0IGV4aXN0cyBpbiB0aGUgbWlkZGxlIG9mIHRoZSBMQ1Mgb2YgdGhlIHR3byBzZXF1ZW5jZXMgYW5kXG5cdCAqIGlzIHRoZSBwb2ludCBhdCB3aGljaCB0aGUgTENTIHByb2JsZW0gbWF5IGJlIGJyb2tlbiBkb3duIHJlY3Vyc2l2ZWx5LlxuXHQgKiBUaGlzIG1ldGhvZCB3aWxsIHRyeSB0byBrZWVwIHRoZSBMQ1MgdHJhY2UgaW4gbWVtb3J5LiBJZiB0aGUgTENTIHJlY3Vyc2lvblxuXHQgKiBwb2ludCBpcyBjYWxjdWxhdGVkIGFuZCB0aGUgZnVsbCB0cmFjZSBpcyBhdmFpbGFibGUgaW4gbWVtb3J5LCB0aGVuIHRoaXMgbWV0aG9kXG5cdCAqIHdpbGwgcmV0dXJuIHRoZSBjaGFuZ2UgbGlzdC5cblx0ICogQHBhcmFtIG9yaWdpbmFsU3RhcnQgVGhlIHN0YXJ0IGJvdW5kIG9mIHRoZSBvcmlnaW5hbCBzZXF1ZW5jZSByYW5nZVxuXHQgKiBAcGFyYW0gb3JpZ2luYWxFbmQgVGhlIGVuZCBib3VuZCBvZiB0aGUgb3JpZ2luYWwgc2VxdWVuY2UgcmFuZ2Vcblx0ICogQHBhcmFtIG1vZGlmaWVkU3RhcnQgVGhlIHN0YXJ0IGJvdW5kIG9mIHRoZSBtb2RpZmllZCBzZXF1ZW5jZSByYW5nZVxuXHQgKiBAcGFyYW0gbW9kaWZpZWRFbmQgVGhlIGVuZCBib3VuZCBvZiB0aGUgbW9kaWZpZWQgc2VxdWVuY2UgcmFuZ2Vcblx0ICogQHBhcmFtIG1pZE9yaWdpbmFsIFRoZSBtaWRkbGUgcG9pbnQgb2YgdGhlIG9yaWdpbmFsIHNlcXVlbmNlIHJhbmdlXG5cdCAqIEBwYXJhbSBtaWRNb2RpZmllZCBUaGUgbWlkZGxlIHBvaW50IG9mIHRoZSBtb2RpZmllZCBzZXF1ZW5jZSByYW5nZVxuXHQgKiBAcmV0dXJucyBUaGUgZGlmZiBjaGFuZ2VzLCBpZiBhdmFpbGFibGUsIG90aGVyd2lzZSBudWxsXG5cdCAqL1xuXHRwcml2YXRlIENvbXB1dGVSZWN1cnNpb25Qb2ludChvcmlnaW5hbFN0YXJ0OiBudW1iZXIsIG9yaWdpbmFsRW5kOiBudW1iZXIsIG1vZGlmaWVkU3RhcnQ6IG51bWJlciwgbW9kaWZpZWRFbmQ6IG51bWJlciwgbWlkT3JpZ2luYWxBcnI6IG51bWJlcltdLCBtaWRNb2RpZmllZEFycjogbnVtYmVyW10sIHF1aXRFYXJseUFycjogYm9vbGVhbltdKSB7XG5cdFx0bGV0IG9yaWdpbmFsSW5kZXggPSAwLCBtb2RpZmllZEluZGV4ID0gMDtcblx0XHRsZXQgZGlhZ29uYWxGb3J3YXJkU3RhcnQgPSAwLCBkaWFnb25hbEZvcndhcmRFbmQgPSAwO1xuXHRcdGxldCBkaWFnb25hbFJldmVyc2VTdGFydCA9IDAsIGRpYWdvbmFsUmV2ZXJzZUVuZCA9IDA7XG5cblx0XHQvLyBUbyB0cmF2ZXJzZSB0aGUgZWRpdCBncmFwaCBhbmQgcHJvZHVjZSB0aGUgcHJvcGVyIExDUywgb3VyIGFjdHVhbFxuXHRcdC8vIHN0YXJ0IHBvc2l0aW9uIGlzIGp1c3Qgb3V0c2lkZSB0aGUgZ2l2ZW4gYm91bmRhcnlcblx0XHRvcmlnaW5hbFN0YXJ0LS07XG5cdFx0bW9kaWZpZWRTdGFydC0tO1xuXG5cdFx0Ly8gV2Ugc2V0IHRoZXNlIHVwIHRvIG1ha2UgdGhlIGNvbXBpbGVyIGhhcHB5LCBidXQgdGhleSB3aWxsXG5cdFx0Ly8gYmUgcmVwbGFjZWQgYmVmb3JlIHdlIHJldHVybiB3aXRoIHRoZSBhY3R1YWwgcmVjdXJzaW9uIHBvaW50XG5cdFx0bWlkT3JpZ2luYWxBcnJbMF0gPSAwO1xuXHRcdG1pZE1vZGlmaWVkQXJyWzBdID0gMDtcblxuXHRcdC8vIENsZWFyIG91dCB0aGUgaGlzdG9yeVxuXHRcdHRoaXMubV9mb3J3YXJkSGlzdG9yeSA9IFtdO1xuXHRcdHRoaXMubV9yZXZlcnNlSGlzdG9yeSA9IFtdO1xuXG5cdFx0Ly8gRWFjaCBjZWxsIGluIHRoZSB0d28gYXJyYXlzIGNvcnJlc3BvbmRzIHRvIGEgZGlhZ29uYWwgaW4gdGhlIGVkaXQgZ3JhcGguXG5cdFx0Ly8gVGhlIGludGVnZXIgdmFsdWUgaW4gdGhlIGNlbGwgcmVwcmVzZW50cyB0aGUgb3JpZ2luYWxJbmRleCBvZiB0aGUgZnVydGhlc3Rcblx0XHQvLyByZWFjaGluZyBwb2ludCBmb3VuZCBzbyBmYXIgdGhhdCBlbmRzIGluIHRoYXQgZGlhZ29uYWwuXG5cdFx0Ly8gVGhlIG1vZGlmaWVkSW5kZXggY2FuIGJlIGNvbXB1dGVkIG1hdGhlbWF0aWNhbGx5IGZyb20gdGhlIG9yaWdpbmFsSW5kZXggYW5kIHRoZSBkaWFnb25hbCBudW1iZXIuXG5cdFx0Y29uc3QgbWF4RGlmZmVyZW5jZXMgPSAob3JpZ2luYWxFbmQgLSBvcmlnaW5hbFN0YXJ0KSArIChtb2RpZmllZEVuZCAtIG1vZGlmaWVkU3RhcnQpO1xuXHRcdGNvbnN0IG51bURpYWdvbmFscyA9IG1heERpZmZlcmVuY2VzICsgMTtcblx0XHRjb25zdCBmb3J3YXJkUG9pbnRzID0gbmV3IEludDMyQXJyYXkobnVtRGlhZ29uYWxzKTtcblx0XHRjb25zdCByZXZlcnNlUG9pbnRzID0gbmV3IEludDMyQXJyYXkobnVtRGlhZ29uYWxzKTtcblx0XHQvLyBkaWFnb25hbEZvcndhcmRCYXNlOiBJbmRleCBpbnRvIGZvcndhcmRQb2ludHMgb2YgdGhlIGRpYWdvbmFsIHdoaWNoIHBhc3NlcyB0aHJvdWdoIChvcmlnaW5hbFN0YXJ0LCBtb2RpZmllZFN0YXJ0KVxuXHRcdC8vIGRpYWdvbmFsUmV2ZXJzZUJhc2U6IEluZGV4IGludG8gcmV2ZXJzZVBvaW50cyBvZiB0aGUgZGlhZ29uYWwgd2hpY2ggcGFzc2VzIHRocm91Z2ggKG9yaWdpbmFsRW5kLCBtb2RpZmllZEVuZClcblx0XHRjb25zdCBkaWFnb25hbEZvcndhcmRCYXNlID0gKG1vZGlmaWVkRW5kIC0gbW9kaWZpZWRTdGFydCk7XG5cdFx0Y29uc3QgZGlhZ29uYWxSZXZlcnNlQmFzZSA9IChvcmlnaW5hbEVuZCAtIG9yaWdpbmFsU3RhcnQpO1xuXHRcdC8vIGRpYWdvbmFsRm9yd2FyZE9mZnNldDogR2VvbWV0cmljIG9mZnNldCB3aGljaCBhbGxvd3MgbW9kaWZpZWRJbmRleCB0byBiZSBjb21wdXRlZCBmcm9tIG9yaWdpbmFsSW5kZXggYW5kIHRoZVxuXHRcdC8vICAgIGRpYWdvbmFsIG51bWJlciAocmVsYXRpdmUgdG8gZGlhZ29uYWxGb3J3YXJkQmFzZSlcblx0XHQvLyBkaWFnb25hbFJldmVyc2VPZmZzZXQ6IEdlb21ldHJpYyBvZmZzZXQgd2hpY2ggYWxsb3dzIG1vZGlmaWVkSW5kZXggdG8gYmUgY29tcHV0ZWQgZnJvbSBvcmlnaW5hbEluZGV4IGFuZCB0aGVcblx0XHQvLyAgICBkaWFnb25hbCBudW1iZXIgKHJlbGF0aXZlIHRvIGRpYWdvbmFsUmV2ZXJzZUJhc2UpXG5cdFx0Y29uc3QgZGlhZ29uYWxGb3J3YXJkT2Zmc2V0ID0gKG9yaWdpbmFsU3RhcnQgLSBtb2RpZmllZFN0YXJ0KTtcblx0XHRjb25zdCBkaWFnb25hbFJldmVyc2VPZmZzZXQgPSAob3JpZ2luYWxFbmQgLSBtb2RpZmllZEVuZCk7XG5cblx0XHQvLyBkZWx0YTogVGhlIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgZW5kIGRpYWdvbmFsIGFuZCB0aGUgc3RhcnQgZGlhZ29uYWwuIFRoaXMgaXMgdXNlZCB0byByZWxhdGUgZGlhZ29uYWwgbnVtYmVyc1xuXHRcdC8vICAgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IGRpYWdvbmFsIHdpdGggZGlhZ29uYWwgbnVtYmVycyByZWxhdGl2ZSB0byB0aGUgZW5kIGRpYWdvbmFsLlxuXHRcdC8vIFRoZSBFdmVuL09kZG4tbmVzcyBvZiB0aGlzIGRlbHRhIGlzIGltcG9ydGFudCBmb3IgZGV0ZXJtaW5pbmcgd2hlbiB3ZSBzaG91bGQgY2hlY2sgZm9yIG92ZXJsYXBcblx0XHRjb25zdCBkZWx0YSA9IGRpYWdvbmFsUmV2ZXJzZUJhc2UgLSBkaWFnb25hbEZvcndhcmRCYXNlO1xuXHRcdGNvbnN0IGRlbHRhSXNFdmVuID0gKGRlbHRhICUgMiA9PT0gMCk7XG5cblx0XHQvLyBIZXJlIHdlIHNldCB1cCB0aGUgc3RhcnQgYW5kIGVuZCBwb2ludHMgYXMgdGhlIGZ1cnRoZXN0IHBvaW50cyBmb3VuZCBzbyBmYXJcblx0XHQvLyBpbiBib3RoIHRoZSBmb3J3YXJkIGFuZCByZXZlcnNlIGRpcmVjdGlvbnMsIHJlc3BlY3RpdmVseVxuXHRcdGZvcndhcmRQb2ludHNbZGlhZ29uYWxGb3J3YXJkQmFzZV0gPSBvcmlnaW5hbFN0YXJ0O1xuXHRcdHJldmVyc2VQb2ludHNbZGlhZ29uYWxSZXZlcnNlQmFzZV0gPSBvcmlnaW5hbEVuZDtcblxuXHRcdC8vIFJlbWVtYmVyIGlmIHdlIHF1aXQgZWFybHksIGFuZCB0aHVzIG5lZWQgdG8gZG8gYSBiZXN0LWVmZm9ydCByZXN1bHQgaW5zdGVhZCBvZiBhIHJlYWwgcmVzdWx0LlxuXHRcdHF1aXRFYXJseUFyclswXSA9IGZhbHNlO1xuXG5cblxuXHRcdC8vIEEgY291cGxlIG9mIHBvaW50czpcblx0XHQvLyAtLVdpdGggdGhpcyBtZXRob2QsIHdlIGl0ZXJhdGUgb24gdGhlIG51bWJlciBvZiBkaWZmZXJlbmNlcyBiZXR3ZWVuIHRoZSB0d28gc2VxdWVuY2VzLlxuXHRcdC8vICAgVGhlIG1vcmUgZGlmZmVyZW5jZXMgdGhlcmUgYWN0dWFsbHkgYXJlLCB0aGUgbG9uZ2VyIHRoaXMgd2lsbCB0YWtlLlxuXHRcdC8vIC0tQWxzbywgYXMgdGhlIG51bWJlciBvZiBkaWZmZXJlbmNlcyBpbmNyZWFzZXMsIHdlIGhhdmUgdG8gc2VhcmNoIG9uIGRpYWdvbmFscyBmdXJ0aGVyXG5cdFx0Ly8gICBhd2F5IGZyb20gdGhlIHJlZmVyZW5jZSBkaWFnb25hbCAod2hpY2ggaXMgZGlhZ29uYWxGb3J3YXJkQmFzZSBmb3IgZm9yd2FyZCwgZGlhZ29uYWxSZXZlcnNlQmFzZSBmb3IgcmV2ZXJzZSkuXG5cdFx0Ly8gLS1XZSBleHRlbmQgb24gZXZlbiBkaWFnb25hbHMgKHJlbGF0aXZlIHRvIHRoZSByZWZlcmVuY2UgZGlhZ29uYWwpIG9ubHkgd2hlbiBudW1EaWZmZXJlbmNlc1xuXHRcdC8vICAgaXMgZXZlbiBhbmQgb2RkIGRpYWdvbmFscyBvbmx5IHdoZW4gbnVtRGlmZmVyZW5jZXMgaXMgb2RkLlxuXHRcdGZvciAobGV0IG51bURpZmZlcmVuY2VzID0gMTsgbnVtRGlmZmVyZW5jZXMgPD0gKG1heERpZmZlcmVuY2VzIC8gMikgKyAxOyBudW1EaWZmZXJlbmNlcysrKSB7XG5cdFx0XHRsZXQgZnVydGhlc3RPcmlnaW5hbEluZGV4ID0gMDtcblx0XHRcdGxldCBmdXJ0aGVzdE1vZGlmaWVkSW5kZXggPSAwO1xuXG5cdFx0XHQvLyBSdW4gdGhlIGFsZ29yaXRobSBpbiB0aGUgZm9yd2FyZCBkaXJlY3Rpb25cblx0XHRcdGRpYWdvbmFsRm9yd2FyZFN0YXJ0ID0gdGhpcy5DbGlwRGlhZ29uYWxCb3VuZChkaWFnb25hbEZvcndhcmRCYXNlIC0gbnVtRGlmZmVyZW5jZXMsIG51bURpZmZlcmVuY2VzLCBkaWFnb25hbEZvcndhcmRCYXNlLCBudW1EaWFnb25hbHMpO1xuXHRcdFx0ZGlhZ29uYWxGb3J3YXJkRW5kID0gdGhpcy5DbGlwRGlhZ29uYWxCb3VuZChkaWFnb25hbEZvcndhcmRCYXNlICsgbnVtRGlmZmVyZW5jZXMsIG51bURpZmZlcmVuY2VzLCBkaWFnb25hbEZvcndhcmRCYXNlLCBudW1EaWFnb25hbHMpO1xuXHRcdFx0Zm9yIChsZXQgZGlhZ29uYWwgPSBkaWFnb25hbEZvcndhcmRTdGFydDsgZGlhZ29uYWwgPD0gZGlhZ29uYWxGb3J3YXJkRW5kOyBkaWFnb25hbCArPSAyKSB7XG5cdFx0XHRcdC8vIFNURVAgMTogV2UgZXh0ZW5kIHRoZSBmdXJ0aGVzdCByZWFjaGluZyBwb2ludCBpbiB0aGUgcHJlc2VudCBkaWFnb25hbFxuXHRcdFx0XHQvLyBieSBsb29raW5nIGF0IHRoZSBkaWFnb25hbHMgYWJvdmUgYW5kIGJlbG93IGFuZCBwaWNraW5nIHRoZSBvbmUgd2hvc2UgcG9pbnRcblx0XHRcdFx0Ly8gaXMgZnVydGhlciBhd2F5IGZyb20gdGhlIHN0YXJ0IHBvaW50IChvcmlnaW5hbFN0YXJ0LCBtb2RpZmllZFN0YXJ0KVxuXHRcdFx0XHRpZiAoZGlhZ29uYWwgPT09IGRpYWdvbmFsRm9yd2FyZFN0YXJ0IHx8IChkaWFnb25hbCA8IGRpYWdvbmFsRm9yd2FyZEVuZCAmJiBmb3J3YXJkUG9pbnRzW2RpYWdvbmFsIC0gMV0gPCBmb3J3YXJkUG9pbnRzW2RpYWdvbmFsICsgMV0pKSB7XG5cdFx0XHRcdFx0b3JpZ2luYWxJbmRleCA9IGZvcndhcmRQb2ludHNbZGlhZ29uYWwgKyAxXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvcmlnaW5hbEluZGV4ID0gZm9yd2FyZFBvaW50c1tkaWFnb25hbCAtIDFdICsgMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtb2RpZmllZEluZGV4ID0gb3JpZ2luYWxJbmRleCAtIChkaWFnb25hbCAtIGRpYWdvbmFsRm9yd2FyZEJhc2UpIC0gZGlhZ29uYWxGb3J3YXJkT2Zmc2V0O1xuXG5cdFx0XHRcdC8vIFNhdmUgdGhlIGN1cnJlbnQgb3JpZ2luYWxJbmRleCBzbyB3ZSBjYW4gdGVzdCBmb3IgZmFsc2Ugb3ZlcmxhcCBpbiBzdGVwIDNcblx0XHRcdFx0Y29uc3QgdGVtcE9yaWdpbmFsSW5kZXggPSBvcmlnaW5hbEluZGV4O1xuXG5cdFx0XHRcdC8vIFNURVAgMjogV2UgY2FuIGNvbnRpbnVlIHRvIGV4dGVuZCB0aGUgZnVydGhlc3QgcmVhY2hpbmcgcG9pbnQgaW4gdGhlIHByZXNlbnQgZGlhZ29uYWxcblx0XHRcdFx0Ly8gc28gbG9uZyBhcyB0aGUgZWxlbWVudHMgYXJlIGVxdWFsLlxuXHRcdFx0XHR3aGlsZSAob3JpZ2luYWxJbmRleCA8IG9yaWdpbmFsRW5kICYmIG1vZGlmaWVkSW5kZXggPCBtb2RpZmllZEVuZCAmJiB0aGlzLkVsZW1lbnRzQXJlRXF1YWwob3JpZ2luYWxJbmRleCArIDEsIG1vZGlmaWVkSW5kZXggKyAxKSkge1xuXHRcdFx0XHRcdG9yaWdpbmFsSW5kZXgrKztcblx0XHRcdFx0XHRtb2RpZmllZEluZGV4Kys7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yd2FyZFBvaW50c1tkaWFnb25hbF0gPSBvcmlnaW5hbEluZGV4O1xuXG5cdFx0XHRcdGlmIChvcmlnaW5hbEluZGV4ICsgbW9kaWZpZWRJbmRleCA+IGZ1cnRoZXN0T3JpZ2luYWxJbmRleCArIGZ1cnRoZXN0TW9kaWZpZWRJbmRleCkge1xuXHRcdFx0XHRcdGZ1cnRoZXN0T3JpZ2luYWxJbmRleCA9IG9yaWdpbmFsSW5kZXg7XG5cdFx0XHRcdFx0ZnVydGhlc3RNb2RpZmllZEluZGV4ID0gbW9kaWZpZWRJbmRleDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFNURVAgMzogSWYgZGVsdGEgaXMgb2RkIChvdmVybGFwIGZpcnN0IGhhcHBlbnMgb24gZm9yd2FyZCB3aGVuIGRlbHRhIGlzIG9kZClcblx0XHRcdFx0Ly8gYW5kIGRpYWdvbmFsIGlzIGluIHRoZSByYW5nZSBvZiByZXZlcnNlIGRpYWdvbmFscyBjb21wdXRlZCBmb3IgbnVtRGlmZmVyZW5jZXMtMVxuXHRcdFx0XHQvLyAodGhlIHByZXZpb3VzIGl0ZXJhdGlvbjsgd2UgaGF2ZW4ndCBjb21wdXRlZCByZXZlcnNlIGRpYWdvbmFscyBmb3IgbnVtRGlmZmVyZW5jZXMgeWV0KVxuXHRcdFx0XHQvLyB0aGVuIGNoZWNrIGZvciBvdmVybGFwLlxuXHRcdFx0XHRpZiAoIWRlbHRhSXNFdmVuICYmIE1hdGguYWJzKGRpYWdvbmFsIC0gZGlhZ29uYWxSZXZlcnNlQmFzZSkgPD0gKG51bURpZmZlcmVuY2VzIC0gMSkpIHtcblx0XHRcdFx0XHRpZiAob3JpZ2luYWxJbmRleCA+PSByZXZlcnNlUG9pbnRzW2RpYWdvbmFsXSkge1xuXHRcdFx0XHRcdFx0bWlkT3JpZ2luYWxBcnJbMF0gPSBvcmlnaW5hbEluZGV4O1xuXHRcdFx0XHRcdFx0bWlkTW9kaWZpZWRBcnJbMF0gPSBtb2RpZmllZEluZGV4O1xuXG5cdFx0XHRcdFx0XHRpZiAodGVtcE9yaWdpbmFsSW5kZXggPD0gcmV2ZXJzZVBvaW50c1tkaWFnb25hbF0gJiYgTG9jYWxDb25zdGFudHMuTWF4RGlmZmVyZW5jZXNIaXN0b3J5ID4gMCAmJiBudW1EaWZmZXJlbmNlcyA8PSAoTG9jYWxDb25zdGFudHMuTWF4RGlmZmVyZW5jZXNIaXN0b3J5ICsgMSkpIHtcblx0XHRcdFx0XHRcdFx0Ly8gQklOR08hIFdlIG92ZXJsYXBwZWQsIGFuZCB3ZSBoYXZlIHRoZSBmdWxsIHRyYWNlIGluIG1lbW9yeSFcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuV0FMS1RSQUNFKGRpYWdvbmFsRm9yd2FyZEJhc2UsIGRpYWdvbmFsRm9yd2FyZFN0YXJ0LCBkaWFnb25hbEZvcndhcmRFbmQsIGRpYWdvbmFsRm9yd2FyZE9mZnNldCxcblx0XHRcdFx0XHRcdFx0XHRkaWFnb25hbFJldmVyc2VCYXNlLCBkaWFnb25hbFJldmVyc2VTdGFydCwgZGlhZ29uYWxSZXZlcnNlRW5kLCBkaWFnb25hbFJldmVyc2VPZmZzZXQsXG5cdFx0XHRcdFx0XHRcdFx0Zm9yd2FyZFBvaW50cywgcmV2ZXJzZVBvaW50cyxcblx0XHRcdFx0XHRcdFx0XHRvcmlnaW5hbEluZGV4LCBvcmlnaW5hbEVuZCwgbWlkT3JpZ2luYWxBcnIsXG5cdFx0XHRcdFx0XHRcdFx0bW9kaWZpZWRJbmRleCwgbW9kaWZpZWRFbmQsIG1pZE1vZGlmaWVkQXJyLFxuXHRcdFx0XHRcdFx0XHRcdGRlbHRhSXNFdmVuLCBxdWl0RWFybHlBcnJcblx0XHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIEVpdGhlciBmYWxzZSBvdmVybGFwLCBvciB3ZSBkaWRuJ3QgaGF2ZSBlbm91Z2ggbWVtb3J5IGZvciB0aGUgZnVsbCB0cmFjZVxuXHRcdFx0XHRcdFx0XHQvLyBKdXN0IHJldHVybiB0aGUgcmVjdXJzaW9uIHBvaW50XG5cdFx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBDaGVjayB0byBzZWUgaWYgd2Ugc2hvdWxkIGJlIHF1aXR0aW5nIGVhcmx5LCBiZWZvcmUgbW92aW5nIG9uIHRvIHRoZSBuZXh0IGl0ZXJhdGlvbi5cblx0XHRcdGNvbnN0IG1hdGNoTGVuZ3RoT2ZMb25nZXN0ID0gKChmdXJ0aGVzdE9yaWdpbmFsSW5kZXggLSBvcmlnaW5hbFN0YXJ0KSArIChmdXJ0aGVzdE1vZGlmaWVkSW5kZXggLSBtb2RpZmllZFN0YXJ0KSAtIG51bURpZmZlcmVuY2VzKSAvIDI7XG5cblx0XHRcdGlmICh0aGlzLkNvbnRpbnVlUHJvY2Vzc2luZ1ByZWRpY2F0ZSAhPT0gbnVsbCAmJiAhdGhpcy5Db250aW51ZVByb2Nlc3NpbmdQcmVkaWNhdGUoZnVydGhlc3RPcmlnaW5hbEluZGV4LCBtYXRjaExlbmd0aE9mTG9uZ2VzdCkpIHtcblx0XHRcdFx0Ly8gV2UgY2FuJ3QgZmluaXNoLCBzbyBza2lwIGFoZWFkIHRvIGdlbmVyYXRpbmcgYSByZXN1bHQgZnJvbSB3aGF0IHdlIGhhdmUuXG5cdFx0XHRcdHF1aXRFYXJseUFyclswXSA9IHRydWU7XG5cblx0XHRcdFx0Ly8gVXNlIHRoZSBmdXJ0aGVzdCBkaXN0YW5jZSB3ZSBnb3QgaW4gdGhlIGZvcndhcmQgZGlyZWN0aW9uLlxuXHRcdFx0XHRtaWRPcmlnaW5hbEFyclswXSA9IGZ1cnRoZXN0T3JpZ2luYWxJbmRleDtcblx0XHRcdFx0bWlkTW9kaWZpZWRBcnJbMF0gPSBmdXJ0aGVzdE1vZGlmaWVkSW5kZXg7XG5cblx0XHRcdFx0aWYgKG1hdGNoTGVuZ3RoT2ZMb25nZXN0ID4gMCAmJiBMb2NhbENvbnN0YW50cy5NYXhEaWZmZXJlbmNlc0hpc3RvcnkgPiAwICYmIG51bURpZmZlcmVuY2VzIDw9IChMb2NhbENvbnN0YW50cy5NYXhEaWZmZXJlbmNlc0hpc3RvcnkgKyAxKSkge1xuXHRcdFx0XHRcdC8vIEVub3VnaCBvZiB0aGUgaGlzdG9yeSBpcyBpbiBtZW1vcnkgdG8gd2FsayBpdCBiYWNrd2FyZHNcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5XQUxLVFJBQ0UoZGlhZ29uYWxGb3J3YXJkQmFzZSwgZGlhZ29uYWxGb3J3YXJkU3RhcnQsIGRpYWdvbmFsRm9yd2FyZEVuZCwgZGlhZ29uYWxGb3J3YXJkT2Zmc2V0LFxuXHRcdFx0XHRcdFx0ZGlhZ29uYWxSZXZlcnNlQmFzZSwgZGlhZ29uYWxSZXZlcnNlU3RhcnQsIGRpYWdvbmFsUmV2ZXJzZUVuZCwgZGlhZ29uYWxSZXZlcnNlT2Zmc2V0LFxuXHRcdFx0XHRcdFx0Zm9yd2FyZFBvaW50cywgcmV2ZXJzZVBvaW50cyxcblx0XHRcdFx0XHRcdG9yaWdpbmFsSW5kZXgsIG9yaWdpbmFsRW5kLCBtaWRPcmlnaW5hbEFycixcblx0XHRcdFx0XHRcdG1vZGlmaWVkSW5kZXgsIG1vZGlmaWVkRW5kLCBtaWRNb2RpZmllZEFycixcblx0XHRcdFx0XHRcdGRlbHRhSXNFdmVuLCBxdWl0RWFybHlBcnJcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFdlIGRpZG4ndCBhY3R1YWxseSByZW1lbWJlciBlbm91Z2ggb2YgdGhlIGhpc3RvcnkuXG5cblx0XHRcdFx0XHQvL1NpbmNlIHdlIGFyZSBxdWl0dGluZyB0aGUgZGlmZiBlYXJseSwgd2UgbmVlZCB0byBzaGlmdCBiYWNrIHRoZSBvcmlnaW5hbFN0YXJ0IGFuZCBtb2RpZmllZCBzdGFydFxuXHRcdFx0XHRcdC8vYmFjayBpbnRvIHRoZSBib3VuZGFyeSBsaW1pdHMgc2luY2Ugd2UgZGVjcmVtZW50ZWQgdGhlaXIgdmFsdWUgYWJvdmUgYmV5b25kIHRoZSBib3VuZGFyeSBsaW1pdC5cblx0XHRcdFx0XHRvcmlnaW5hbFN0YXJ0Kys7XG5cdFx0XHRcdFx0bW9kaWZpZWRTdGFydCsrO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRcdG5ldyBEaWZmQ2hhbmdlKG9yaWdpbmFsU3RhcnQsIG9yaWdpbmFsRW5kIC0gb3JpZ2luYWxTdGFydCArIDEsXG5cdFx0XHRcdFx0XHRcdG1vZGlmaWVkU3RhcnQsIG1vZGlmaWVkRW5kIC0gbW9kaWZpZWRTdGFydCArIDEpXG5cdFx0XHRcdFx0XTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBSdW4gdGhlIGFsZ29yaXRobSBpbiB0aGUgcmV2ZXJzZSBkaXJlY3Rpb25cblx0XHRcdGRpYWdvbmFsUmV2ZXJzZVN0YXJ0ID0gdGhpcy5DbGlwRGlhZ29uYWxCb3VuZChkaWFnb25hbFJldmVyc2VCYXNlIC0gbnVtRGlmZmVyZW5jZXMsIG51bURpZmZlcmVuY2VzLCBkaWFnb25hbFJldmVyc2VCYXNlLCBudW1EaWFnb25hbHMpO1xuXHRcdFx0ZGlhZ29uYWxSZXZlcnNlRW5kID0gdGhpcy5DbGlwRGlhZ29uYWxCb3VuZChkaWFnb25hbFJldmVyc2VCYXNlICsgbnVtRGlmZmVyZW5jZXMsIG51bURpZmZlcmVuY2VzLCBkaWFnb25hbFJldmVyc2VCYXNlLCBudW1EaWFnb25hbHMpO1xuXHRcdFx0Zm9yIChsZXQgZGlhZ29uYWwgPSBkaWFnb25hbFJldmVyc2VTdGFydDsgZGlhZ29uYWwgPD0gZGlhZ29uYWxSZXZlcnNlRW5kOyBkaWFnb25hbCArPSAyKSB7XG5cdFx0XHRcdC8vIFNURVAgMTogV2UgZXh0ZW5kIHRoZSBmdXJ0aGVzdCByZWFjaGluZyBwb2ludCBpbiB0aGUgcHJlc2VudCBkaWFnb25hbFxuXHRcdFx0XHQvLyBieSBsb29raW5nIGF0IHRoZSBkaWFnb25hbHMgYWJvdmUgYW5kIGJlbG93IGFuZCBwaWNraW5nIHRoZSBvbmUgd2hvc2UgcG9pbnRcblx0XHRcdFx0Ly8gaXMgZnVydGhlciBhd2F5IGZyb20gdGhlIHN0YXJ0IHBvaW50IChvcmlnaW5hbEVuZCwgbW9kaWZpZWRFbmQpXG5cdFx0XHRcdGlmIChkaWFnb25hbCA9PT0gZGlhZ29uYWxSZXZlcnNlU3RhcnQgfHwgKGRpYWdvbmFsIDwgZGlhZ29uYWxSZXZlcnNlRW5kICYmIHJldmVyc2VQb2ludHNbZGlhZ29uYWwgLSAxXSA+PSByZXZlcnNlUG9pbnRzW2RpYWdvbmFsICsgMV0pKSB7XG5cdFx0XHRcdFx0b3JpZ2luYWxJbmRleCA9IHJldmVyc2VQb2ludHNbZGlhZ29uYWwgKyAxXSAtIDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3JpZ2luYWxJbmRleCA9IHJldmVyc2VQb2ludHNbZGlhZ29uYWwgLSAxXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtb2RpZmllZEluZGV4ID0gb3JpZ2luYWxJbmRleCAtIChkaWFnb25hbCAtIGRpYWdvbmFsUmV2ZXJzZUJhc2UpIC0gZGlhZ29uYWxSZXZlcnNlT2Zmc2V0O1xuXG5cdFx0XHRcdC8vIFNhdmUgdGhlIGN1cnJlbnQgb3JpZ2luYWxJbmRleCBzbyB3ZSBjYW4gdGVzdCBmb3IgZmFsc2Ugb3ZlcmxhcFxuXHRcdFx0XHRjb25zdCB0ZW1wT3JpZ2luYWxJbmRleCA9IG9yaWdpbmFsSW5kZXg7XG5cblx0XHRcdFx0Ly8gU1RFUCAyOiBXZSBjYW4gY29udGludWUgdG8gZXh0ZW5kIHRoZSBmdXJ0aGVzdCByZWFjaGluZyBwb2ludCBpbiB0aGUgcHJlc2VudCBkaWFnb25hbFxuXHRcdFx0XHQvLyBhcyBsb25nIGFzIHRoZSBlbGVtZW50cyBhcmUgZXF1YWwuXG5cdFx0XHRcdHdoaWxlIChvcmlnaW5hbEluZGV4ID4gb3JpZ2luYWxTdGFydCAmJiBtb2RpZmllZEluZGV4ID4gbW9kaWZpZWRTdGFydCAmJiB0aGlzLkVsZW1lbnRzQXJlRXF1YWwob3JpZ2luYWxJbmRleCwgbW9kaWZpZWRJbmRleCkpIHtcblx0XHRcdFx0XHRvcmlnaW5hbEluZGV4LS07XG5cdFx0XHRcdFx0bW9kaWZpZWRJbmRleC0tO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldmVyc2VQb2ludHNbZGlhZ29uYWxdID0gb3JpZ2luYWxJbmRleDtcblxuXHRcdFx0XHQvLyBTVEVQIDQ6IElmIGRlbHRhIGlzIGV2ZW4gKG92ZXJsYXAgZmlyc3QgaGFwcGVucyBvbiByZXZlcnNlIHdoZW4gZGVsdGEgaXMgZXZlbilcblx0XHRcdFx0Ly8gYW5kIGRpYWdvbmFsIGlzIGluIHRoZSByYW5nZSBvZiBmb3J3YXJkIGRpYWdvbmFscyBjb21wdXRlZCBmb3IgbnVtRGlmZmVyZW5jZXNcblx0XHRcdFx0Ly8gdGhlbiBjaGVjayBmb3Igb3ZlcmxhcC5cblx0XHRcdFx0aWYgKGRlbHRhSXNFdmVuICYmIE1hdGguYWJzKGRpYWdvbmFsIC0gZGlhZ29uYWxGb3J3YXJkQmFzZSkgPD0gbnVtRGlmZmVyZW5jZXMpIHtcblx0XHRcdFx0XHRpZiAob3JpZ2luYWxJbmRleCA8PSBmb3J3YXJkUG9pbnRzW2RpYWdvbmFsXSkge1xuXHRcdFx0XHRcdFx0bWlkT3JpZ2luYWxBcnJbMF0gPSBvcmlnaW5hbEluZGV4O1xuXHRcdFx0XHRcdFx0bWlkTW9kaWZpZWRBcnJbMF0gPSBtb2RpZmllZEluZGV4O1xuXG5cdFx0XHRcdFx0XHRpZiAodGVtcE9yaWdpbmFsSW5kZXggPj0gZm9yd2FyZFBvaW50c1tkaWFnb25hbF0gJiYgTG9jYWxDb25zdGFudHMuTWF4RGlmZmVyZW5jZXNIaXN0b3J5ID4gMCAmJiBudW1EaWZmZXJlbmNlcyA8PSAoTG9jYWxDb25zdGFudHMuTWF4RGlmZmVyZW5jZXNIaXN0b3J5ICsgMSkpIHtcblx0XHRcdFx0XHRcdFx0Ly8gQklOR08hIFdlIG92ZXJsYXBwZWQsIGFuZCB3ZSBoYXZlIHRoZSBmdWxsIHRyYWNlIGluIG1lbW9yeSFcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuV0FMS1RSQUNFKGRpYWdvbmFsRm9yd2FyZEJhc2UsIGRpYWdvbmFsRm9yd2FyZFN0YXJ0LCBkaWFnb25hbEZvcndhcmRFbmQsIGRpYWdvbmFsRm9yd2FyZE9mZnNldCxcblx0XHRcdFx0XHRcdFx0XHRkaWFnb25hbFJldmVyc2VCYXNlLCBkaWFnb25hbFJldmVyc2VTdGFydCwgZGlhZ29uYWxSZXZlcnNlRW5kLCBkaWFnb25hbFJldmVyc2VPZmZzZXQsXG5cdFx0XHRcdFx0XHRcdFx0Zm9yd2FyZFBvaW50cywgcmV2ZXJzZVBvaW50cyxcblx0XHRcdFx0XHRcdFx0XHRvcmlnaW5hbEluZGV4LCBvcmlnaW5hbEVuZCwgbWlkT3JpZ2luYWxBcnIsXG5cdFx0XHRcdFx0XHRcdFx0bW9kaWZpZWRJbmRleCwgbW9kaWZpZWRFbmQsIG1pZE1vZGlmaWVkQXJyLFxuXHRcdFx0XHRcdFx0XHRcdGRlbHRhSXNFdmVuLCBxdWl0RWFybHlBcnJcblx0XHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIEVpdGhlciBmYWxzZSBvdmVybGFwLCBvciB3ZSBkaWRuJ3QgaGF2ZSBlbm91Z2ggbWVtb3J5IGZvciB0aGUgZnVsbCB0cmFjZVxuXHRcdFx0XHRcdFx0XHQvLyBKdXN0IHJldHVybiB0aGUgcmVjdXJzaW9uIHBvaW50XG5cdFx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBTYXZlIGN1cnJlbnQgdmVjdG9ycyB0byBoaXN0b3J5IGJlZm9yZSB0aGUgbmV4dCBpdGVyYXRpb25cblx0XHRcdGlmIChudW1EaWZmZXJlbmNlcyA8PSBMb2NhbENvbnN0YW50cy5NYXhEaWZmZXJlbmNlc0hpc3RvcnkpIHtcblx0XHRcdFx0Ly8gV2UgYXJlIGFsbG9jYXRpbmcgc3BhY2UgZm9yIG9uZSBleHRyYSBpbnQsIHdoaWNoIHdlIGZpbGwgd2l0aFxuXHRcdFx0XHQvLyB0aGUgaW5kZXggb2YgdGhlIGRpYWdvbmFsIGJhc2UgaW5kZXhcblx0XHRcdFx0bGV0IHRlbXAgPSBuZXcgSW50MzJBcnJheShkaWFnb25hbEZvcndhcmRFbmQgLSBkaWFnb25hbEZvcndhcmRTdGFydCArIDIpO1xuXHRcdFx0XHR0ZW1wWzBdID0gZGlhZ29uYWxGb3J3YXJkQmFzZSAtIGRpYWdvbmFsRm9yd2FyZFN0YXJ0ICsgMTtcblx0XHRcdFx0TXlBcnJheS5Db3B5Mihmb3J3YXJkUG9pbnRzLCBkaWFnb25hbEZvcndhcmRTdGFydCwgdGVtcCwgMSwgZGlhZ29uYWxGb3J3YXJkRW5kIC0gZGlhZ29uYWxGb3J3YXJkU3RhcnQgKyAxKTtcblx0XHRcdFx0dGhpcy5tX2ZvcndhcmRIaXN0b3J5LnB1c2godGVtcCk7XG5cblx0XHRcdFx0dGVtcCA9IG5ldyBJbnQzMkFycmF5KGRpYWdvbmFsUmV2ZXJzZUVuZCAtIGRpYWdvbmFsUmV2ZXJzZVN0YXJ0ICsgMik7XG5cdFx0XHRcdHRlbXBbMF0gPSBkaWFnb25hbFJldmVyc2VCYXNlIC0gZGlhZ29uYWxSZXZlcnNlU3RhcnQgKyAxO1xuXHRcdFx0XHRNeUFycmF5LkNvcHkyKHJldmVyc2VQb2ludHMsIGRpYWdvbmFsUmV2ZXJzZVN0YXJ0LCB0ZW1wLCAxLCBkaWFnb25hbFJldmVyc2VFbmQgLSBkaWFnb25hbFJldmVyc2VTdGFydCArIDEpO1xuXHRcdFx0XHR0aGlzLm1fcmV2ZXJzZUhpc3RvcnkucHVzaCh0ZW1wKTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdC8vIElmIHdlIGdvdCBoZXJlLCB0aGVuIHdlIGhhdmUgdGhlIGZ1bGwgdHJhY2UgaW4gaGlzdG9yeS4gV2UganVzdCBoYXZlIHRvIGNvbnZlcnQgaXQgdG8gYSBjaGFuZ2UgbGlzdFxuXHRcdC8vIE5PVEU6IFRoaXMgcGFydCBpcyBhIGJpdCBtZXNzeVxuXHRcdHJldHVybiB0aGlzLldBTEtUUkFDRShkaWFnb25hbEZvcndhcmRCYXNlLCBkaWFnb25hbEZvcndhcmRTdGFydCwgZGlhZ29uYWxGb3J3YXJkRW5kLCBkaWFnb25hbEZvcndhcmRPZmZzZXQsXG5cdFx0XHRkaWFnb25hbFJldmVyc2VCYXNlLCBkaWFnb25hbFJldmVyc2VTdGFydCwgZGlhZ29uYWxSZXZlcnNlRW5kLCBkaWFnb25hbFJldmVyc2VPZmZzZXQsXG5cdFx0XHRmb3J3YXJkUG9pbnRzLCByZXZlcnNlUG9pbnRzLFxuXHRcdFx0b3JpZ2luYWxJbmRleCwgb3JpZ2luYWxFbmQsIG1pZE9yaWdpbmFsQXJyLFxuXHRcdFx0bW9kaWZpZWRJbmRleCwgbW9kaWZpZWRFbmQsIG1pZE1vZGlmaWVkQXJyLFxuXHRcdFx0ZGVsdGFJc0V2ZW4sIHF1aXRFYXJseUFyclxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogU2hpZnRzIHRoZSBnaXZlbiBjaGFuZ2VzIHRvIHByb3ZpZGUgYSBtb3JlIGludHVpdGl2ZSBkaWZmLlxuXHQgKiBXaGlsZSB0aGUgZmlyc3QgZWxlbWVudCBpbiBhIGRpZmYgbWF0Y2hlcyB0aGUgZmlyc3QgZWxlbWVudCBhZnRlciB0aGUgZGlmZixcblx0ICogd2Ugc2hpZnQgdGhlIGRpZmYgZG93bi5cblx0ICpcblx0ICogQHBhcmFtIGNoYW5nZXMgVGhlIGxpc3Qgb2YgY2hhbmdlcyB0byBzaGlmdFxuXHQgKiBAcmV0dXJucyBUaGUgc2hpZnRlZCBjaGFuZ2VzXG5cdCAqL1xuXHRwcml2YXRlIFByZXR0aWZ5Q2hhbmdlcyhjaGFuZ2VzOiBEaWZmQ2hhbmdlW10pOiBEaWZmQ2hhbmdlW10ge1xuXG5cdFx0Ly8gU2hpZnQgYWxsIHRoZSBjaGFuZ2VzIGRvd24gZmlyc3Rcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5nZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGNoYW5nZSA9IGNoYW5nZXNbaV07XG5cdFx0XHRjb25zdCBvcmlnaW5hbFN0b3AgPSAoaSA8IGNoYW5nZXMubGVuZ3RoIC0gMSkgPyBjaGFuZ2VzW2kgKyAxXS5vcmlnaW5hbFN0YXJ0IDogdGhpcy5fb3JpZ2luYWxFbGVtZW50c09ySGFzaC5sZW5ndGg7XG5cdFx0XHRjb25zdCBtb2RpZmllZFN0b3AgPSAoaSA8IGNoYW5nZXMubGVuZ3RoIC0gMSkgPyBjaGFuZ2VzW2kgKyAxXS5tb2RpZmllZFN0YXJ0IDogdGhpcy5fbW9kaWZpZWRFbGVtZW50c09ySGFzaC5sZW5ndGg7XG5cdFx0XHRjb25zdCBjaGVja09yaWdpbmFsID0gY2hhbmdlLm9yaWdpbmFsTGVuZ3RoID4gMDtcblx0XHRcdGNvbnN0IGNoZWNrTW9kaWZpZWQgPSBjaGFuZ2UubW9kaWZpZWRMZW5ndGggPiAwO1xuXG5cdFx0XHR3aGlsZSAoXG5cdFx0XHRcdGNoYW5nZS5vcmlnaW5hbFN0YXJ0ICsgY2hhbmdlLm9yaWdpbmFsTGVuZ3RoIDwgb3JpZ2luYWxTdG9wXG5cdFx0XHRcdCYmIGNoYW5nZS5tb2RpZmllZFN0YXJ0ICsgY2hhbmdlLm1vZGlmaWVkTGVuZ3RoIDwgbW9kaWZpZWRTdG9wXG5cdFx0XHRcdCYmICghY2hlY2tPcmlnaW5hbCB8fCB0aGlzLk9yaWdpbmFsRWxlbWVudHNBcmVFcXVhbChjaGFuZ2Uub3JpZ2luYWxTdGFydCwgY2hhbmdlLm9yaWdpbmFsU3RhcnQgKyBjaGFuZ2Uub3JpZ2luYWxMZW5ndGgpKVxuXHRcdFx0XHQmJiAoIWNoZWNrTW9kaWZpZWQgfHwgdGhpcy5Nb2RpZmllZEVsZW1lbnRzQXJlRXF1YWwoY2hhbmdlLm1vZGlmaWVkU3RhcnQsIGNoYW5nZS5tb2RpZmllZFN0YXJ0ICsgY2hhbmdlLm1vZGlmaWVkTGVuZ3RoKSlcblx0XHRcdCkge1xuXHRcdFx0XHRjb25zdCBzdGFydFN0cmljdEVxdWFsID0gdGhpcy5FbGVtZW50c0FyZVN0cmljdEVxdWFsKGNoYW5nZS5vcmlnaW5hbFN0YXJ0LCBjaGFuZ2UubW9kaWZpZWRTdGFydCk7XG5cdFx0XHRcdGNvbnN0IGVuZFN0cmljdEVxdWFsID0gdGhpcy5FbGVtZW50c0FyZVN0cmljdEVxdWFsKGNoYW5nZS5vcmlnaW5hbFN0YXJ0ICsgY2hhbmdlLm9yaWdpbmFsTGVuZ3RoLCBjaGFuZ2UubW9kaWZpZWRTdGFydCArIGNoYW5nZS5tb2RpZmllZExlbmd0aCk7XG5cdFx0XHRcdGlmIChlbmRTdHJpY3RFcXVhbCAmJiAhc3RhcnRTdHJpY3RFcXVhbCkge1xuXHRcdFx0XHRcdC8vIG1vdmluZyB0aGUgY2hhbmdlIGRvd24gd291bGQgY3JlYXRlIGFuIGVxdWFsIGNoYW5nZSwgYnV0IHRoZSBlbGVtZW50cyBhcmUgbm90IHN0cmljdCBlcXVhbFxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNoYW5nZS5vcmlnaW5hbFN0YXJ0Kys7XG5cdFx0XHRcdGNoYW5nZS5tb2RpZmllZFN0YXJ0Kys7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1lcmdlZENoYW5nZUFycjogQXJyYXk8RGlmZkNoYW5nZSB8IG51bGw+ID0gW251bGxdO1xuXHRcdFx0aWYgKGkgPCBjaGFuZ2VzLmxlbmd0aCAtIDEgJiYgdGhpcy5DaGFuZ2VzT3ZlcmxhcChjaGFuZ2VzW2ldLCBjaGFuZ2VzW2kgKyAxXSwgbWVyZ2VkQ2hhbmdlQXJyKSkge1xuXHRcdFx0XHRjaGFuZ2VzW2ldID0gbWVyZ2VkQ2hhbmdlQXJyWzBdITtcblx0XHRcdFx0Y2hhbmdlcy5zcGxpY2UoaSArIDEsIDEpO1xuXHRcdFx0XHRpLS07XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNoaWZ0IGNoYW5nZXMgYmFjayB1cCB1bnRpbCB3ZSBoaXQgZW1wdHkgb3Igd2hpdGVzcGFjZS1vbmx5IGxpbmVzXG5cdFx0Zm9yIChsZXQgaSA9IGNoYW5nZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IGNoYW5nZSA9IGNoYW5nZXNbaV07XG5cblx0XHRcdGxldCBvcmlnaW5hbFN0b3AgPSAwO1xuXHRcdFx0bGV0IG1vZGlmaWVkU3RvcCA9IDA7XG5cdFx0XHRpZiAoaSA+IDApIHtcblx0XHRcdFx0Y29uc3QgcHJldkNoYW5nZSA9IGNoYW5nZXNbaSAtIDFdO1xuXHRcdFx0XHRvcmlnaW5hbFN0b3AgPSBwcmV2Q2hhbmdlLm9yaWdpbmFsU3RhcnQgKyBwcmV2Q2hhbmdlLm9yaWdpbmFsTGVuZ3RoO1xuXHRcdFx0XHRtb2RpZmllZFN0b3AgPSBwcmV2Q2hhbmdlLm1vZGlmaWVkU3RhcnQgKyBwcmV2Q2hhbmdlLm1vZGlmaWVkTGVuZ3RoO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjaGVja09yaWdpbmFsID0gY2hhbmdlLm9yaWdpbmFsTGVuZ3RoID4gMDtcblx0XHRcdGNvbnN0IGNoZWNrTW9kaWZpZWQgPSBjaGFuZ2UubW9kaWZpZWRMZW5ndGggPiAwO1xuXG5cdFx0XHRsZXQgYmVzdERlbHRhID0gMDtcblx0XHRcdGxldCBiZXN0U2NvcmUgPSB0aGlzLl9ib3VuZGFyeVNjb3JlKGNoYW5nZS5vcmlnaW5hbFN0YXJ0LCBjaGFuZ2Uub3JpZ2luYWxMZW5ndGgsIGNoYW5nZS5tb2RpZmllZFN0YXJ0LCBjaGFuZ2UubW9kaWZpZWRMZW5ndGgpO1xuXG5cdFx0XHRmb3IgKGxldCBkZWx0YSA9IDE7IDsgZGVsdGErKykge1xuXHRcdFx0XHRjb25zdCBvcmlnaW5hbFN0YXJ0ID0gY2hhbmdlLm9yaWdpbmFsU3RhcnQgLSBkZWx0YTtcblx0XHRcdFx0Y29uc3QgbW9kaWZpZWRTdGFydCA9IGNoYW5nZS5tb2RpZmllZFN0YXJ0IC0gZGVsdGE7XG5cblx0XHRcdFx0aWYgKG9yaWdpbmFsU3RhcnQgPCBvcmlnaW5hbFN0b3AgfHwgbW9kaWZpZWRTdGFydCA8IG1vZGlmaWVkU3RvcCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGNoZWNrT3JpZ2luYWwgJiYgIXRoaXMuT3JpZ2luYWxFbGVtZW50c0FyZUVxdWFsKG9yaWdpbmFsU3RhcnQsIG9yaWdpbmFsU3RhcnQgKyBjaGFuZ2Uub3JpZ2luYWxMZW5ndGgpKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY2hlY2tNb2RpZmllZCAmJiAhdGhpcy5Nb2RpZmllZEVsZW1lbnRzQXJlRXF1YWwobW9kaWZpZWRTdGFydCwgbW9kaWZpZWRTdGFydCArIGNoYW5nZS5tb2RpZmllZExlbmd0aCkpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHRvdWNoaW5nUHJldmlvdXNDaGFuZ2UgPSAob3JpZ2luYWxTdGFydCA9PT0gb3JpZ2luYWxTdG9wICYmIG1vZGlmaWVkU3RhcnQgPT09IG1vZGlmaWVkU3RvcCk7XG5cdFx0XHRcdGNvbnN0IHNjb3JlID0gKFxuXHRcdFx0XHRcdCh0b3VjaGluZ1ByZXZpb3VzQ2hhbmdlID8gNSA6IDApXG5cdFx0XHRcdFx0KyB0aGlzLl9ib3VuZGFyeVNjb3JlKG9yaWdpbmFsU3RhcnQsIGNoYW5nZS5vcmlnaW5hbExlbmd0aCwgbW9kaWZpZWRTdGFydCwgY2hhbmdlLm1vZGlmaWVkTGVuZ3RoKVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGlmIChzY29yZSA+IGJlc3RTY29yZSkge1xuXHRcdFx0XHRcdGJlc3RTY29yZSA9IHNjb3JlO1xuXHRcdFx0XHRcdGJlc3REZWx0YSA9IGRlbHRhO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNoYW5nZS5vcmlnaW5hbFN0YXJ0IC09IGJlc3REZWx0YTtcblx0XHRcdGNoYW5nZS5tb2RpZmllZFN0YXJ0IC09IGJlc3REZWx0YTtcblxuXHRcdFx0Y29uc3QgbWVyZ2VkQ2hhbmdlQXJyOiBBcnJheTxEaWZmQ2hhbmdlIHwgbnVsbD4gPSBbbnVsbF07XG5cdFx0XHRpZiAoaSA+IDAgJiYgdGhpcy5DaGFuZ2VzT3ZlcmxhcChjaGFuZ2VzW2kgLSAxXSwgY2hhbmdlc1tpXSwgbWVyZ2VkQ2hhbmdlQXJyKSkge1xuXHRcdFx0XHRjaGFuZ2VzW2kgLSAxXSA9IG1lcmdlZENoYW5nZUFyclswXSE7XG5cdFx0XHRcdGNoYW5nZXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRpKys7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFRoZXJlIGNvdWxkIGJlIG11bHRpcGxlIGxvbmdlc3QgY29tbW9uIHN1YnN0cmluZ3MuXG5cdFx0Ly8gR2l2ZSBwcmVmZXJlbmNlIHRvIHRoZSBvbmVzIGNvbnRhaW5pbmcgbG9uZ2VyIGxpbmVzXG5cdFx0aWYgKHRoaXMuX2hhc1N0cmluZ3MpIHtcblx0XHRcdGZvciAobGV0IGkgPSAxLCBsZW4gPSBjaGFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGFDaGFuZ2UgPSBjaGFuZ2VzW2kgLSAxXTtcblx0XHRcdFx0Y29uc3QgYkNoYW5nZSA9IGNoYW5nZXNbaV07XG5cdFx0XHRcdGNvbnN0IG1hdGNoZWRMZW5ndGggPSBiQ2hhbmdlLm9yaWdpbmFsU3RhcnQgLSBhQ2hhbmdlLm9yaWdpbmFsU3RhcnQgLSBhQ2hhbmdlLm9yaWdpbmFsTGVuZ3RoO1xuXHRcdFx0XHRjb25zdCBhT3JpZ2luYWxTdGFydCA9IGFDaGFuZ2Uub3JpZ2luYWxTdGFydDtcblx0XHRcdFx0Y29uc3QgYk9yaWdpbmFsRW5kID0gYkNoYW5nZS5vcmlnaW5hbFN0YXJ0ICsgYkNoYW5nZS5vcmlnaW5hbExlbmd0aDtcblx0XHRcdFx0Y29uc3QgYWJPcmlnaW5hbExlbmd0aCA9IGJPcmlnaW5hbEVuZCAtIGFPcmlnaW5hbFN0YXJ0O1xuXHRcdFx0XHRjb25zdCBhTW9kaWZpZWRTdGFydCA9IGFDaGFuZ2UubW9kaWZpZWRTdGFydDtcblx0XHRcdFx0Y29uc3QgYk1vZGlmaWVkRW5kID0gYkNoYW5nZS5tb2RpZmllZFN0YXJ0ICsgYkNoYW5nZS5tb2RpZmllZExlbmd0aDtcblx0XHRcdFx0Y29uc3QgYWJNb2RpZmllZExlbmd0aCA9IGJNb2RpZmllZEVuZCAtIGFNb2RpZmllZFN0YXJ0O1xuXHRcdFx0XHQvLyBBdm9pZCB3YXN0aW5nIGEgbG90IG9mIHRpbWUgd2l0aCB0aGVzZSBzZWFyY2hlc1xuXHRcdFx0XHRpZiAobWF0Y2hlZExlbmd0aCA8IDUgJiYgYWJPcmlnaW5hbExlbmd0aCA8IDIwICYmIGFiTW9kaWZpZWRMZW5ndGggPCAyMCkge1xuXHRcdFx0XHRcdGNvbnN0IHQgPSB0aGlzLl9maW5kQmV0dGVyQ29udGlndW91c1NlcXVlbmNlKFxuXHRcdFx0XHRcdFx0YU9yaWdpbmFsU3RhcnQsIGFiT3JpZ2luYWxMZW5ndGgsXG5cdFx0XHRcdFx0XHRhTW9kaWZpZWRTdGFydCwgYWJNb2RpZmllZExlbmd0aCxcblx0XHRcdFx0XHRcdG1hdGNoZWRMZW5ndGhcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGlmICh0KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBbb3JpZ2luYWxNYXRjaFN0YXJ0LCBtb2RpZmllZE1hdGNoU3RhcnRdID0gdDtcblx0XHRcdFx0XHRcdGlmIChvcmlnaW5hbE1hdGNoU3RhcnQgIT09IGFDaGFuZ2Uub3JpZ2luYWxTdGFydCArIGFDaGFuZ2Uub3JpZ2luYWxMZW5ndGggfHwgbW9kaWZpZWRNYXRjaFN0YXJ0ICE9PSBhQ2hhbmdlLm1vZGlmaWVkU3RhcnQgKyBhQ2hhbmdlLm1vZGlmaWVkTGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdC8vIHN3aXRjaCB0byBhbm90aGVyIHNlcXVlbmNlIHRoYXQgaGFzIGEgYmV0dGVyIHNjb3JlXG5cdFx0XHRcdFx0XHRcdGFDaGFuZ2Uub3JpZ2luYWxMZW5ndGggPSBvcmlnaW5hbE1hdGNoU3RhcnQgLSBhQ2hhbmdlLm9yaWdpbmFsU3RhcnQ7XG5cdFx0XHRcdFx0XHRcdGFDaGFuZ2UubW9kaWZpZWRMZW5ndGggPSBtb2RpZmllZE1hdGNoU3RhcnQgLSBhQ2hhbmdlLm1vZGlmaWVkU3RhcnQ7XG5cdFx0XHRcdFx0XHRcdGJDaGFuZ2Uub3JpZ2luYWxTdGFydCA9IG9yaWdpbmFsTWF0Y2hTdGFydCArIG1hdGNoZWRMZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGJDaGFuZ2UubW9kaWZpZWRTdGFydCA9IG1vZGlmaWVkTWF0Y2hTdGFydCArIG1hdGNoZWRMZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGJDaGFuZ2Uub3JpZ2luYWxMZW5ndGggPSBiT3JpZ2luYWxFbmQgLSBiQ2hhbmdlLm9yaWdpbmFsU3RhcnQ7XG5cdFx0XHRcdFx0XHRcdGJDaGFuZ2UubW9kaWZpZWRMZW5ndGggPSBiTW9kaWZpZWRFbmQgLSBiQ2hhbmdlLm1vZGlmaWVkU3RhcnQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNoYW5nZXM7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kQmV0dGVyQ29udGlndW91c1NlcXVlbmNlKG9yaWdpbmFsU3RhcnQ6IG51bWJlciwgb3JpZ2luYWxMZW5ndGg6IG51bWJlciwgbW9kaWZpZWRTdGFydDogbnVtYmVyLCBtb2RpZmllZExlbmd0aDogbnVtYmVyLCBkZXNpcmVkTGVuZ3RoOiBudW1iZXIpOiBbbnVtYmVyLCBudW1iZXJdIHwgbnVsbCB7XG5cdFx0aWYgKG9yaWdpbmFsTGVuZ3RoIDwgZGVzaXJlZExlbmd0aCB8fCBtb2RpZmllZExlbmd0aCA8IGRlc2lyZWRMZW5ndGgpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBvcmlnaW5hbE1heCA9IG9yaWdpbmFsU3RhcnQgKyBvcmlnaW5hbExlbmd0aCAtIGRlc2lyZWRMZW5ndGggKyAxO1xuXHRcdGNvbnN0IG1vZGlmaWVkTWF4ID0gbW9kaWZpZWRTdGFydCArIG1vZGlmaWVkTGVuZ3RoIC0gZGVzaXJlZExlbmd0aCArIDE7XG5cdFx0bGV0IGJlc3RTY29yZSA9IDA7XG5cdFx0bGV0IGJlc3RPcmlnaW5hbFN0YXJ0ID0gMDtcblx0XHRsZXQgYmVzdE1vZGlmaWVkU3RhcnQgPSAwO1xuXHRcdGZvciAobGV0IGkgPSBvcmlnaW5hbFN0YXJ0OyBpIDwgb3JpZ2luYWxNYXg7IGkrKykge1xuXHRcdFx0Zm9yIChsZXQgaiA9IG1vZGlmaWVkU3RhcnQ7IGogPCBtb2RpZmllZE1heDsgaisrKSB7XG5cdFx0XHRcdGNvbnN0IHNjb3JlID0gdGhpcy5fY29udGlndW91c1NlcXVlbmNlU2NvcmUoaSwgaiwgZGVzaXJlZExlbmd0aCk7XG5cdFx0XHRcdGlmIChzY29yZSA+IDAgJiYgc2NvcmUgPiBiZXN0U2NvcmUpIHtcblx0XHRcdFx0XHRiZXN0U2NvcmUgPSBzY29yZTtcblx0XHRcdFx0XHRiZXN0T3JpZ2luYWxTdGFydCA9IGk7XG5cdFx0XHRcdFx0YmVzdE1vZGlmaWVkU3RhcnQgPSBqO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChiZXN0U2NvcmUgPiAwKSB7XG5cdFx0XHRyZXR1cm4gW2Jlc3RPcmlnaW5hbFN0YXJ0LCBiZXN0TW9kaWZpZWRTdGFydF07XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udGlndW91c1NlcXVlbmNlU2NvcmUob3JpZ2luYWxTdGFydDogbnVtYmVyLCBtb2RpZmllZFN0YXJ0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRsZXQgc2NvcmUgPSAwO1xuXHRcdGZvciAobGV0IGwgPSAwOyBsIDwgbGVuZ3RoOyBsKyspIHtcblx0XHRcdGlmICghdGhpcy5FbGVtZW50c0FyZUVxdWFsKG9yaWdpbmFsU3RhcnQgKyBsLCBtb2RpZmllZFN0YXJ0ICsgbCkpIHtcblx0XHRcdFx0cmV0dXJuIDA7XG5cdFx0XHR9XG5cdFx0XHRzY29yZSArPSB0aGlzLl9vcmlnaW5hbFN0cmluZ0VsZW1lbnRzW29yaWdpbmFsU3RhcnQgKyBsXS5sZW5ndGg7XG5cdFx0fVxuXHRcdHJldHVybiBzY29yZTtcblx0fVxuXG5cdHByaXZhdGUgX09yaWdpbmFsSXNCb3VuZGFyeShpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKGluZGV4IDw9IDAgfHwgaW5kZXggPj0gdGhpcy5fb3JpZ2luYWxFbGVtZW50c09ySGFzaC5sZW5ndGggLSAxKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuICh0aGlzLl9oYXNTdHJpbmdzICYmIC9eXFxzKiQvLnRlc3QodGhpcy5fb3JpZ2luYWxTdHJpbmdFbGVtZW50c1tpbmRleF0pKTtcblx0fVxuXG5cdHByaXZhdGUgX09yaWdpbmFsUmVnaW9uSXNCb3VuZGFyeShvcmlnaW5hbFN0YXJ0OiBudW1iZXIsIG9yaWdpbmFsTGVuZ3RoOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fT3JpZ2luYWxJc0JvdW5kYXJ5KG9yaWdpbmFsU3RhcnQpIHx8IHRoaXMuX09yaWdpbmFsSXNCb3VuZGFyeShvcmlnaW5hbFN0YXJ0IC0gMSkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAob3JpZ2luYWxMZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBvcmlnaW5hbEVuZCA9IG9yaWdpbmFsU3RhcnQgKyBvcmlnaW5hbExlbmd0aDtcblx0XHRcdGlmICh0aGlzLl9PcmlnaW5hbElzQm91bmRhcnkob3JpZ2luYWxFbmQgLSAxKSB8fCB0aGlzLl9PcmlnaW5hbElzQm91bmRhcnkob3JpZ2luYWxFbmQpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9Nb2RpZmllZElzQm91bmRhcnkoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmIChpbmRleCA8PSAwIHx8IGluZGV4ID49IHRoaXMuX21vZGlmaWVkRWxlbWVudHNPckhhc2gubGVuZ3RoIC0gMSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiAodGhpcy5faGFzU3RyaW5ncyAmJiAvXlxccyokLy50ZXN0KHRoaXMuX21vZGlmaWVkU3RyaW5nRWxlbWVudHNbaW5kZXhdKSk7XG5cdH1cblxuXHRwcml2YXRlIF9Nb2RpZmllZFJlZ2lvbklzQm91bmRhcnkobW9kaWZpZWRTdGFydDogbnVtYmVyLCBtb2RpZmllZExlbmd0aDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX01vZGlmaWVkSXNCb3VuZGFyeShtb2RpZmllZFN0YXJ0KSB8fCB0aGlzLl9Nb2RpZmllZElzQm91bmRhcnkobW9kaWZpZWRTdGFydCAtIDEpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKG1vZGlmaWVkTGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgbW9kaWZpZWRFbmQgPSBtb2RpZmllZFN0YXJ0ICsgbW9kaWZpZWRMZW5ndGg7XG5cdFx0XHRpZiAodGhpcy5fTW9kaWZpZWRJc0JvdW5kYXJ5KG1vZGlmaWVkRW5kIC0gMSkgfHwgdGhpcy5fTW9kaWZpZWRJc0JvdW5kYXJ5KG1vZGlmaWVkRW5kKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfYm91bmRhcnlTY29yZShvcmlnaW5hbFN0YXJ0OiBudW1iZXIsIG9yaWdpbmFsTGVuZ3RoOiBudW1iZXIsIG1vZGlmaWVkU3RhcnQ6IG51bWJlciwgbW9kaWZpZWRMZW5ndGg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3Qgb3JpZ2luYWxTY29yZSA9ICh0aGlzLl9PcmlnaW5hbFJlZ2lvbklzQm91bmRhcnkob3JpZ2luYWxTdGFydCwgb3JpZ2luYWxMZW5ndGgpID8gMSA6IDApO1xuXHRcdGNvbnN0IG1vZGlmaWVkU2NvcmUgPSAodGhpcy5fTW9kaWZpZWRSZWdpb25Jc0JvdW5kYXJ5KG1vZGlmaWVkU3RhcnQsIG1vZGlmaWVkTGVuZ3RoKSA/IDEgOiAwKTtcblx0XHRyZXR1cm4gKG9yaWdpbmFsU2NvcmUgKyBtb2RpZmllZFNjb3JlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb25jYXRlbmF0ZXMgdGhlIHR3byBpbnB1dCBEaWZmQ2hhbmdlIGxpc3RzIGFuZCByZXR1cm5zIHRoZSByZXN1bHRpbmdcblx0ICogbGlzdC5cblx0ICogQHBhcmFtIFRoZSBsZWZ0IGNoYW5nZXNcblx0ICogQHBhcmFtIFRoZSByaWdodCBjaGFuZ2VzXG5cdCAqIEByZXR1cm5zIFRoZSBjb25jYXRlbmF0ZWQgbGlzdFxuXHQgKi9cblx0cHJpdmF0ZSBDb25jYXRlbmF0ZUNoYW5nZXMobGVmdDogRGlmZkNoYW5nZVtdLCByaWdodDogRGlmZkNoYW5nZVtdKTogRGlmZkNoYW5nZVtdIHtcblx0XHRjb25zdCBtZXJnZWRDaGFuZ2VBcnI6IERpZmZDaGFuZ2VbXSA9IFtdO1xuXG5cdFx0aWYgKGxlZnQubGVuZ3RoID09PSAwIHx8IHJpZ2h0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIChyaWdodC5sZW5ndGggPiAwKSA/IHJpZ2h0IDogbGVmdDtcblx0XHR9IGVsc2UgaWYgKHRoaXMuQ2hhbmdlc092ZXJsYXAobGVmdFtsZWZ0Lmxlbmd0aCAtIDFdLCByaWdodFswXSwgbWVyZ2VkQ2hhbmdlQXJyKSkge1xuXHRcdFx0Ly8gU2luY2Ugd2UgYnJlYWsgdGhlIHByb2JsZW0gZG93biByZWN1cnNpdmVseSwgaXQgaXMgcG9zc2libGUgdGhhdCB3ZVxuXHRcdFx0Ly8gbWlnaHQgcmVjdXJzZSBpbiB0aGUgbWlkZGxlIG9mIGEgY2hhbmdlIHRoZXJlYnkgc3BsaXR0aW5nIGl0IGludG9cblx0XHRcdC8vIHR3byBjaGFuZ2VzLiBIZXJlIGluIHRoZSBjb21iaW5pbmcgc3RhZ2UsIHdlIGRldGVjdCBhbmQgZnVzZSB0aG9zZVxuXHRcdFx0Ly8gY2hhbmdlcyBiYWNrIHRvZ2V0aGVyXG5cdFx0XHRjb25zdCByZXN1bHQgPSBuZXcgQXJyYXk8RGlmZkNoYW5nZT4obGVmdC5sZW5ndGggKyByaWdodC5sZW5ndGggLSAxKTtcblx0XHRcdE15QXJyYXkuQ29weShsZWZ0LCAwLCByZXN1bHQsIDAsIGxlZnQubGVuZ3RoIC0gMSk7XG5cdFx0XHRyZXN1bHRbbGVmdC5sZW5ndGggLSAxXSA9IG1lcmdlZENoYW5nZUFyclswXTtcblx0XHRcdE15QXJyYXkuQ29weShyaWdodCwgMSwgcmVzdWx0LCBsZWZ0Lmxlbmd0aCwgcmlnaHQubGVuZ3RoIC0gMSk7XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBBcnJheTxEaWZmQ2hhbmdlPihsZWZ0Lmxlbmd0aCArIHJpZ2h0Lmxlbmd0aCk7XG5cdFx0XHRNeUFycmF5LkNvcHkobGVmdCwgMCwgcmVzdWx0LCAwLCBsZWZ0Lmxlbmd0aCk7XG5cdFx0XHRNeUFycmF5LkNvcHkocmlnaHQsIDAsIHJlc3VsdCwgbGVmdC5sZW5ndGgsIHJpZ2h0Lmxlbmd0aCk7XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgdHdvIGNoYW5nZXMgb3ZlcmxhcCBhbmQgY2FuIGJlIG1lcmdlZCBpbnRvIGEgc2luZ2xlXG5cdCAqIGNoYW5nZVxuXHQgKiBAcGFyYW0gbGVmdCBUaGUgbGVmdCBjaGFuZ2Vcblx0ICogQHBhcmFtIHJpZ2h0IFRoZSByaWdodCBjaGFuZ2Vcblx0ICogQHBhcmFtIG1lcmdlZENoYW5nZSBUaGUgbWVyZ2VkIGNoYW5nZSBpZiB0aGUgdHdvIG92ZXJsYXAsIG51bGwgb3RoZXJ3aXNlXG5cdCAqIEByZXR1cm5zIFRydWUgaWYgdGhlIHR3byBjaGFuZ2VzIG92ZXJsYXBcblx0ICovXG5cdHByaXZhdGUgQ2hhbmdlc092ZXJsYXAobGVmdDogRGlmZkNoYW5nZSwgcmlnaHQ6IERpZmZDaGFuZ2UsIG1lcmdlZENoYW5nZUFycjogQXJyYXk8RGlmZkNoYW5nZSB8IG51bGw+KTogYm9vbGVhbiB7XG5cdFx0RGVidWcuQXNzZXJ0KGxlZnQub3JpZ2luYWxTdGFydCA8PSByaWdodC5vcmlnaW5hbFN0YXJ0LCAnTGVmdCBjaGFuZ2UgaXMgbm90IGxlc3MgdGhhbiBvciBlcXVhbCB0byByaWdodCBjaGFuZ2UnKTtcblx0XHREZWJ1Zy5Bc3NlcnQobGVmdC5tb2RpZmllZFN0YXJ0IDw9IHJpZ2h0Lm1vZGlmaWVkU3RhcnQsICdMZWZ0IGNoYW5nZSBpcyBub3QgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHJpZ2h0IGNoYW5nZScpO1xuXG5cdFx0aWYgKGxlZnQub3JpZ2luYWxTdGFydCArIGxlZnQub3JpZ2luYWxMZW5ndGggPj0gcmlnaHQub3JpZ2luYWxTdGFydCB8fCBsZWZ0Lm1vZGlmaWVkU3RhcnQgKyBsZWZ0Lm1vZGlmaWVkTGVuZ3RoID49IHJpZ2h0Lm1vZGlmaWVkU3RhcnQpIHtcblx0XHRcdGNvbnN0IG9yaWdpbmFsU3RhcnQgPSBsZWZ0Lm9yaWdpbmFsU3RhcnQ7XG5cdFx0XHRsZXQgb3JpZ2luYWxMZW5ndGggPSBsZWZ0Lm9yaWdpbmFsTGVuZ3RoO1xuXHRcdFx0Y29uc3QgbW9kaWZpZWRTdGFydCA9IGxlZnQubW9kaWZpZWRTdGFydDtcblx0XHRcdGxldCBtb2RpZmllZExlbmd0aCA9IGxlZnQubW9kaWZpZWRMZW5ndGg7XG5cblx0XHRcdGlmIChsZWZ0Lm9yaWdpbmFsU3RhcnQgKyBsZWZ0Lm9yaWdpbmFsTGVuZ3RoID49IHJpZ2h0Lm9yaWdpbmFsU3RhcnQpIHtcblx0XHRcdFx0b3JpZ2luYWxMZW5ndGggPSByaWdodC5vcmlnaW5hbFN0YXJ0ICsgcmlnaHQub3JpZ2luYWxMZW5ndGggLSBsZWZ0Lm9yaWdpbmFsU3RhcnQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAobGVmdC5tb2RpZmllZFN0YXJ0ICsgbGVmdC5tb2RpZmllZExlbmd0aCA+PSByaWdodC5tb2RpZmllZFN0YXJ0KSB7XG5cdFx0XHRcdG1vZGlmaWVkTGVuZ3RoID0gcmlnaHQubW9kaWZpZWRTdGFydCArIHJpZ2h0Lm1vZGlmaWVkTGVuZ3RoIC0gbGVmdC5tb2RpZmllZFN0YXJ0O1xuXHRcdFx0fVxuXG5cdFx0XHRtZXJnZWRDaGFuZ2VBcnJbMF0gPSBuZXcgRGlmZkNoYW5nZShvcmlnaW5hbFN0YXJ0LCBvcmlnaW5hbExlbmd0aCwgbW9kaWZpZWRTdGFydCwgbW9kaWZpZWRMZW5ndGgpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lcmdlZENoYW5nZUFyclswXSA9IG51bGw7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEhlbHBlciBtZXRob2QgdXNlZCB0byBjbGlwIGEgZGlhZ29uYWwgaW5kZXggdG8gdGhlIHJhbmdlIG9mIHZhbGlkXG5cdCAqIGRpYWdvbmFscy4gVGhpcyBhbHNvIGRlY2lkZXMgd2hldGhlciBvciBub3QgdGhlIGRpYWdvbmFsIGluZGV4LFxuXHQgKiBpZiBpdCBleGNlZWRzIHRoZSBib3VuZGFyeSwgc2hvdWxkIGJlIGNsaXBwZWQgdG8gdGhlIGJvdW5kYXJ5IG9yIGNsaXBwZWRcblx0ICogb25lIGluc2lkZSB0aGUgYm91bmRhcnkgZGVwZW5kaW5nIG9uIHRoZSBFdmVuL09kZCBzdGF0dXMgb2YgdGhlIGJvdW5kYXJ5XG5cdCAqIGFuZCBudW1EaWZmZXJlbmNlcy5cblx0ICogQHBhcmFtIGRpYWdvbmFsIFRoZSBpbmRleCBvZiB0aGUgZGlhZ29uYWwgdG8gY2xpcC5cblx0ICogQHBhcmFtIG51bURpZmZlcmVuY2VzIFRoZSBjdXJyZW50IG51bWJlciBvZiBkaWZmZXJlbmNlcyBiZWluZyBpdGVyYXRlZCB1cG9uLlxuXHQgKiBAcGFyYW0gZGlhZ29uYWxCYXNlSW5kZXggVGhlIGJhc2UgcmVmZXJlbmNlIGRpYWdvbmFsLlxuXHQgKiBAcGFyYW0gbnVtRGlhZ29uYWxzIFRoZSB0b3RhbCBudW1iZXIgb2YgZGlhZ29uYWxzLlxuXHQgKiBAcmV0dXJucyBUaGUgY2xpcHBlZCBkaWFnb25hbCBpbmRleC5cblx0ICovXG5cdHByaXZhdGUgQ2xpcERpYWdvbmFsQm91bmQoZGlhZ29uYWw6IG51bWJlciwgbnVtRGlmZmVyZW5jZXM6IG51bWJlciwgZGlhZ29uYWxCYXNlSW5kZXg6IG51bWJlciwgbnVtRGlhZ29uYWxzOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmIChkaWFnb25hbCA+PSAwICYmIGRpYWdvbmFsIDwgbnVtRGlhZ29uYWxzKSB7XG5cdFx0XHQvLyBOb3RoaW5nIHRvIGNsaXAsIGl0cyBpbiByYW5nZVxuXHRcdFx0cmV0dXJuIGRpYWdvbmFsO1xuXHRcdH1cblxuXHRcdC8vIGRpYWdvbmFsc0JlbG93OiBUaGUgbnVtYmVyIG9mIGRpYWdvbmFscyBiZWxvdyB0aGUgcmVmZXJlbmNlIGRpYWdvbmFsXG5cdFx0Ly8gZGlhZ29uYWxzQWJvdmU6IFRoZSBudW1iZXIgb2YgZGlhZ29uYWxzIGFib3ZlIHRoZSByZWZlcmVuY2UgZGlhZ29uYWxcblx0XHRjb25zdCBkaWFnb25hbHNCZWxvdyA9IGRpYWdvbmFsQmFzZUluZGV4O1xuXHRcdGNvbnN0IGRpYWdvbmFsc0Fib3ZlID0gbnVtRGlhZ29uYWxzIC0gZGlhZ29uYWxCYXNlSW5kZXggLSAxO1xuXHRcdGNvbnN0IGRpZmZFdmVuID0gKG51bURpZmZlcmVuY2VzICUgMiA9PT0gMCk7XG5cblx0XHRpZiAoZGlhZ29uYWwgPCAwKSB7XG5cdFx0XHRjb25zdCBsb3dlckJvdW5kRXZlbiA9IChkaWFnb25hbHNCZWxvdyAlIDIgPT09IDApO1xuXHRcdFx0cmV0dXJuIChkaWZmRXZlbiA9PT0gbG93ZXJCb3VuZEV2ZW4pID8gMCA6IDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHVwcGVyQm91bmRFdmVuID0gKGRpYWdvbmFsc0Fib3ZlICUgMiA9PT0gMCk7XG5cdFx0XHRyZXR1cm4gKGRpZmZFdmVuID09PSB1cHBlckJvdW5kRXZlbikgPyBudW1EaWFnb25hbHMgLSAxIDogbnVtRGlhZ29uYWxzIC0gMjtcblx0XHR9XG5cdH1cbn1cblxuXG4vKipcbiAqIFByZWNvbXB1dGVkIGVxdWFsaXR5IGFycmF5IGZvciBjaGFyYWN0ZXIgY29kZXMuXG4gKi9cbmNvbnN0IHByZWNvbXB1dGVkRXF1YWxpdHlBcnJheSA9IG5ldyBVaW50MzJBcnJheSgweDEwMDAwKTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgTGV2ZW5zaHRlaW4gZGlzdGFuY2UgZm9yIHN0cmluZ3Mgb2YgbGVuZ3RoIDw9IDMyLlxuICogQHBhcmFtIGZpcnN0U3RyaW5nIC0gVGhlIGZpcnN0IHN0cmluZy5cbiAqIEBwYXJhbSBzZWNvbmRTdHJpbmcgLSBUaGUgc2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm5zIFRoZSBMZXZlbnNodGVpbiBkaXN0YW5jZS5cbiAqL1xuY29uc3QgY29tcHV0ZUxldmVuc2h0ZWluRGlzdGFuY2VGb3JTaG9ydFN0cmluZ3MgPSAoZmlyc3RTdHJpbmc6IHN0cmluZywgc2Vjb25kU3RyaW5nOiBzdHJpbmcpOiBudW1iZXIgPT4ge1xuXHRjb25zdCBmaXJzdFN0cmluZ0xlbmd0aCA9IGZpcnN0U3RyaW5nLmxlbmd0aDtcblx0Y29uc3Qgc2Vjb25kU3RyaW5nTGVuZ3RoID0gc2Vjb25kU3RyaW5nLmxlbmd0aDtcblx0Y29uc3QgbGFzdEJpdE1hc2sgPSAxIDw8IChmaXJzdFN0cmluZ0xlbmd0aCAtIDEpO1xuXHRsZXQgcG9zaXRpdmVWZWN0b3IgPSAtMTtcblx0bGV0IG5lZ2F0aXZlVmVjdG9yID0gMDtcblx0bGV0IGRpc3RhbmNlID0gZmlyc3RTdHJpbmdMZW5ndGg7XG5cdGxldCBpbmRleCA9IGZpcnN0U3RyaW5nTGVuZ3RoO1xuXG5cdC8vIEluaXRpYWxpemUgcHJlY29tcHV0ZWRFcXVhbGl0eUFycmF5IGZvciBmaXJzdFN0cmluZ1xuXHR3aGlsZSAoaW5kZXgtLSkge1xuXHRcdHByZWNvbXB1dGVkRXF1YWxpdHlBcnJheVtmaXJzdFN0cmluZy5jaGFyQ29kZUF0KGluZGV4KV0gfD0gMSA8PCBpbmRleDtcblx0fVxuXG5cdC8vIFByb2Nlc3MgZWFjaCBjaGFyYWN0ZXIgb2Ygc2Vjb25kU3RyaW5nXG5cdGZvciAoaW5kZXggPSAwOyBpbmRleCA8IHNlY29uZFN0cmluZ0xlbmd0aDsgaW5kZXgrKykge1xuXHRcdGxldCBlcXVhbGl0eU1hc2sgPSBwcmVjb21wdXRlZEVxdWFsaXR5QXJyYXlbc2Vjb25kU3RyaW5nLmNoYXJDb2RlQXQoaW5kZXgpXTtcblx0XHRjb25zdCBjb21iaW5lZFZlY3RvciA9IGVxdWFsaXR5TWFzayB8IG5lZ2F0aXZlVmVjdG9yO1xuXHRcdGVxdWFsaXR5TWFzayB8PSAoKGVxdWFsaXR5TWFzayAmIHBvc2l0aXZlVmVjdG9yKSArIHBvc2l0aXZlVmVjdG9yKSBeIHBvc2l0aXZlVmVjdG9yO1xuXHRcdG5lZ2F0aXZlVmVjdG9yIHw9IH4oZXF1YWxpdHlNYXNrIHwgcG9zaXRpdmVWZWN0b3IpO1xuXHRcdHBvc2l0aXZlVmVjdG9yICY9IGVxdWFsaXR5TWFzaztcblx0XHRpZiAobmVnYXRpdmVWZWN0b3IgJiBsYXN0Qml0TWFzaykge1xuXHRcdFx0ZGlzdGFuY2UrKztcblx0XHR9XG5cdFx0aWYgKHBvc2l0aXZlVmVjdG9yICYgbGFzdEJpdE1hc2spIHtcblx0XHRcdGRpc3RhbmNlLS07XG5cdFx0fVxuXHRcdG5lZ2F0aXZlVmVjdG9yID0gKG5lZ2F0aXZlVmVjdG9yIDw8IDEpIHwgMTtcblx0XHRwb3NpdGl2ZVZlY3RvciA9IChwb3NpdGl2ZVZlY3RvciA8PCAxKSB8IH4oY29tYmluZWRWZWN0b3IgfCBuZWdhdGl2ZVZlY3Rvcik7XG5cdFx0bmVnYXRpdmVWZWN0b3IgJj0gY29tYmluZWRWZWN0b3I7XG5cdH1cblxuXHQvLyBSZXNldCBwcmVjb21wdXRlZEVxdWFsaXR5QXJyYXlcblx0aW5kZXggPSBmaXJzdFN0cmluZ0xlbmd0aDtcblx0d2hpbGUgKGluZGV4LS0pIHtcblx0XHRwcmVjb21wdXRlZEVxdWFsaXR5QXJyYXlbZmlyc3RTdHJpbmcuY2hhckNvZGVBdChpbmRleCldID0gMDtcblx0fVxuXG5cdHJldHVybiBkaXN0YW5jZTtcbn07XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIExldmVuc2h0ZWluIGRpc3RhbmNlIGZvciBzdHJpbmdzIG9mIGxlbmd0aCA+IDMyLlxuICogQHBhcmFtIGZpcnN0U3RyaW5nIC0gVGhlIGZpcnN0IHN0cmluZy5cbiAqIEBwYXJhbSBzZWNvbmRTdHJpbmcgLSBUaGUgc2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm5zIFRoZSBMZXZlbnNodGVpbiBkaXN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gY29tcHV0ZUxldmVuc2h0ZWluRGlzdGFuY2VGb3JMb25nU3RyaW5ncyhmaXJzdFN0cmluZzogc3RyaW5nLCBzZWNvbmRTdHJpbmc6IHN0cmluZyk6IG51bWJlciB7XG5cdGNvbnN0IGZpcnN0U3RyaW5nTGVuZ3RoID0gZmlyc3RTdHJpbmcubGVuZ3RoO1xuXHRjb25zdCBzZWNvbmRTdHJpbmdMZW5ndGggPSBzZWNvbmRTdHJpbmcubGVuZ3RoO1xuXHRjb25zdCBob3Jpem9udGFsQml0QXJyYXkgPSBbXTtcblx0Y29uc3QgdmVydGljYWxCaXRBcnJheSA9IFtdO1xuXHRjb25zdCBob3Jpem9udGFsU2l6ZSA9IE1hdGguY2VpbChmaXJzdFN0cmluZ0xlbmd0aCAvIDMyKTtcblx0Y29uc3QgdmVydGljYWxTaXplID0gTWF0aC5jZWlsKHNlY29uZFN0cmluZ0xlbmd0aCAvIDMyKTtcblxuXHQvLyBJbml0aWFsaXplIGhvcml6b250YWwgYW5kIHZlcnRpY2FsIGJpdCBhcnJheXNcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBob3Jpem9udGFsU2l6ZTsgaSsrKSB7XG5cdFx0aG9yaXpvbnRhbEJpdEFycmF5W2ldID0gLTE7XG5cdFx0dmVydGljYWxCaXRBcnJheVtpXSA9IDA7XG5cdH1cblxuXHRsZXQgdmVydGljYWxJbmRleCA9IDA7XG5cdGZvciAoOyB2ZXJ0aWNhbEluZGV4IDwgdmVydGljYWxTaXplIC0gMTsgdmVydGljYWxJbmRleCsrKSB7XG5cdFx0bGV0IG5lZ2F0aXZlVmVjdG9yID0gMDtcblx0XHRsZXQgcG9zaXRpdmVWZWN0b3IgPSAtMTtcblx0XHRjb25zdCBzdGFydCA9IHZlcnRpY2FsSW5kZXggKiAzMjtcblx0XHRjb25zdCB2ZXJ0aWNhbExlbmd0aCA9IE1hdGgubWluKDMyLCBzZWNvbmRTdHJpbmdMZW5ndGgpICsgc3RhcnQ7XG5cblx0XHQvLyBJbml0aWFsaXplIHByZWNvbXB1dGVkRXF1YWxpdHlBcnJheSBmb3Igc2Vjb25kU3RyaW5nXG5cdFx0Zm9yIChsZXQgayA9IHN0YXJ0OyBrIDwgdmVydGljYWxMZW5ndGg7IGsrKykge1xuXHRcdFx0cHJlY29tcHV0ZWRFcXVhbGl0eUFycmF5W3NlY29uZFN0cmluZy5jaGFyQ29kZUF0KGspXSB8PSAxIDw8IGs7XG5cdFx0fVxuXG5cdFx0Ly8gUHJvY2VzcyBlYWNoIGNoYXJhY3RlciBvZiBmaXJzdFN0cmluZ1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZmlyc3RTdHJpbmdMZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZXF1YWxpdHlNYXNrID0gcHJlY29tcHV0ZWRFcXVhbGl0eUFycmF5W2ZpcnN0U3RyaW5nLmNoYXJDb2RlQXQoaSldO1xuXHRcdFx0Y29uc3QgcHJldmlvdXNCaXQgPSAoaG9yaXpvbnRhbEJpdEFycmF5WyhpIC8gMzIpIHwgMF0gPj4+IGkpICYgMTtcblx0XHRcdGNvbnN0IG1hdGNoQml0ID0gKHZlcnRpY2FsQml0QXJyYXlbKGkgLyAzMikgfCAwXSA+Pj4gaSkgJiAxO1xuXHRcdFx0Y29uc3QgY29tYmluZWRWZWN0b3IgPSBlcXVhbGl0eU1hc2sgfCBuZWdhdGl2ZVZlY3Rvcjtcblx0XHRcdGNvbnN0IGNvbWJpbmVkSG9yaXpvbnRhbFZlY3RvciA9ICgoKChlcXVhbGl0eU1hc2sgfCBtYXRjaEJpdCkgJiBwb3NpdGl2ZVZlY3RvcikgKyBwb3NpdGl2ZVZlY3RvcikgXiBwb3NpdGl2ZVZlY3RvcikgfCBlcXVhbGl0eU1hc2sgfCBtYXRjaEJpdDtcblx0XHRcdGxldCBwb3NpdGl2ZUhvcml6b250YWxWZWN0b3IgPSBuZWdhdGl2ZVZlY3RvciB8IH4oY29tYmluZWRIb3Jpem9udGFsVmVjdG9yIHwgcG9zaXRpdmVWZWN0b3IpO1xuXHRcdFx0bGV0IG5lZ2F0aXZlSG9yaXpvbnRhbFZlY3RvciA9IHBvc2l0aXZlVmVjdG9yICYgY29tYmluZWRIb3Jpem9udGFsVmVjdG9yO1xuXHRcdFx0aWYgKChwb3NpdGl2ZUhvcml6b250YWxWZWN0b3IgPj4+IDMxKSBeIHByZXZpb3VzQml0KSB7XG5cdFx0XHRcdGhvcml6b250YWxCaXRBcnJheVsoaSAvIDMyKSB8IDBdIF49IDEgPDwgaTtcblx0XHRcdH1cblx0XHRcdGlmICgobmVnYXRpdmVIb3Jpem9udGFsVmVjdG9yID4+PiAzMSkgXiBtYXRjaEJpdCkge1xuXHRcdFx0XHR2ZXJ0aWNhbEJpdEFycmF5WyhpIC8gMzIpIHwgMF0gXj0gMSA8PCBpO1xuXHRcdFx0fVxuXHRcdFx0cG9zaXRpdmVIb3Jpem9udGFsVmVjdG9yID0gKHBvc2l0aXZlSG9yaXpvbnRhbFZlY3RvciA8PCAxKSB8IHByZXZpb3VzQml0O1xuXHRcdFx0bmVnYXRpdmVIb3Jpem9udGFsVmVjdG9yID0gKG5lZ2F0aXZlSG9yaXpvbnRhbFZlY3RvciA8PCAxKSB8IG1hdGNoQml0O1xuXHRcdFx0cG9zaXRpdmVWZWN0b3IgPSBuZWdhdGl2ZUhvcml6b250YWxWZWN0b3IgfCB+KGNvbWJpbmVkVmVjdG9yIHwgcG9zaXRpdmVIb3Jpem9udGFsVmVjdG9yKTtcblx0XHRcdG5lZ2F0aXZlVmVjdG9yID0gcG9zaXRpdmVIb3Jpem9udGFsVmVjdG9yICYgY29tYmluZWRWZWN0b3I7XG5cdFx0fVxuXG5cdFx0Ly8gUmVzZXQgcHJlY29tcHV0ZWRFcXVhbGl0eUFycmF5XG5cdFx0Zm9yIChsZXQgayA9IHN0YXJ0OyBrIDwgdmVydGljYWxMZW5ndGg7IGsrKykge1xuXHRcdFx0cHJlY29tcHV0ZWRFcXVhbGl0eUFycmF5W3NlY29uZFN0cmluZy5jaGFyQ29kZUF0KGspXSA9IDA7XG5cdFx0fVxuXHR9XG5cblx0bGV0IG5lZ2F0aXZlVmVjdG9yID0gMDtcblx0bGV0IHBvc2l0aXZlVmVjdG9yID0gLTE7XG5cdGNvbnN0IHN0YXJ0ID0gdmVydGljYWxJbmRleCAqIDMyO1xuXHRjb25zdCB2ZXJ0aWNhbExlbmd0aCA9IE1hdGgubWluKDMyLCBzZWNvbmRTdHJpbmdMZW5ndGggLSBzdGFydCkgKyBzdGFydDtcblxuXHQvLyBJbml0aWFsaXplIHByZWNvbXB1dGVkRXF1YWxpdHlBcnJheSBmb3Igc2Vjb25kU3RyaW5nXG5cdGZvciAobGV0IGsgPSBzdGFydDsgayA8IHZlcnRpY2FsTGVuZ3RoOyBrKyspIHtcblx0XHRwcmVjb21wdXRlZEVxdWFsaXR5QXJyYXlbc2Vjb25kU3RyaW5nLmNoYXJDb2RlQXQoayldIHw9IDEgPDwgaztcblx0fVxuXG5cdGxldCBkaXN0YW5jZSA9IHNlY29uZFN0cmluZ0xlbmd0aDtcblxuXHQvLyBQcm9jZXNzIGVhY2ggY2hhcmFjdGVyIG9mIGZpcnN0U3RyaW5nXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZmlyc3RTdHJpbmdMZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGVxdWFsaXR5TWFzayA9IHByZWNvbXB1dGVkRXF1YWxpdHlBcnJheVtmaXJzdFN0cmluZy5jaGFyQ29kZUF0KGkpXTtcblx0XHRjb25zdCBwcmV2aW91c0JpdCA9IChob3Jpem9udGFsQml0QXJyYXlbKGkgLyAzMikgfCAwXSA+Pj4gaSkgJiAxO1xuXHRcdGNvbnN0IG1hdGNoQml0ID0gKHZlcnRpY2FsQml0QXJyYXlbKGkgLyAzMikgfCAwXSA+Pj4gaSkgJiAxO1xuXHRcdGNvbnN0IGNvbWJpbmVkVmVjdG9yID0gZXF1YWxpdHlNYXNrIHwgbmVnYXRpdmVWZWN0b3I7XG5cdFx0Y29uc3QgY29tYmluZWRIb3Jpem9udGFsVmVjdG9yID0gKCgoKGVxdWFsaXR5TWFzayB8IG1hdGNoQml0KSAmIHBvc2l0aXZlVmVjdG9yKSArIHBvc2l0aXZlVmVjdG9yKSBeIHBvc2l0aXZlVmVjdG9yKSB8IGVxdWFsaXR5TWFzayB8IG1hdGNoQml0O1xuXHRcdGxldCBwb3NpdGl2ZUhvcml6b250YWxWZWN0b3IgPSBuZWdhdGl2ZVZlY3RvciB8IH4oY29tYmluZWRIb3Jpem9udGFsVmVjdG9yIHwgcG9zaXRpdmVWZWN0b3IpO1xuXHRcdGxldCBuZWdhdGl2ZUhvcml6b250YWxWZWN0b3IgPSBwb3NpdGl2ZVZlY3RvciAmIGNvbWJpbmVkSG9yaXpvbnRhbFZlY3Rvcjtcblx0XHRkaXN0YW5jZSArPSAocG9zaXRpdmVIb3Jpem9udGFsVmVjdG9yID4+PiAoc2Vjb25kU3RyaW5nTGVuZ3RoIC0gMSkpICYgMTtcblx0XHRkaXN0YW5jZSAtPSAobmVnYXRpdmVIb3Jpem9udGFsVmVjdG9yID4+PiAoc2Vjb25kU3RyaW5nTGVuZ3RoIC0gMSkpICYgMTtcblx0XHRpZiAoKHBvc2l0aXZlSG9yaXpvbnRhbFZlY3RvciA+Pj4gMzEpIF4gcHJldmlvdXNCaXQpIHtcblx0XHRcdGhvcml6b250YWxCaXRBcnJheVsoaSAvIDMyKSB8IDBdIF49IDEgPDwgaTtcblx0XHR9XG5cdFx0aWYgKChuZWdhdGl2ZUhvcml6b250YWxWZWN0b3IgPj4+IDMxKSBeIG1hdGNoQml0KSB7XG5cdFx0XHR2ZXJ0aWNhbEJpdEFycmF5WyhpIC8gMzIpIHwgMF0gXj0gMSA8PCBpO1xuXHRcdH1cblx0XHRwb3NpdGl2ZUhvcml6b250YWxWZWN0b3IgPSAocG9zaXRpdmVIb3Jpem9udGFsVmVjdG9yIDw8IDEpIHwgcHJldmlvdXNCaXQ7XG5cdFx0bmVnYXRpdmVIb3Jpem9udGFsVmVjdG9yID0gKG5lZ2F0aXZlSG9yaXpvbnRhbFZlY3RvciA8PCAxKSB8IG1hdGNoQml0O1xuXHRcdHBvc2l0aXZlVmVjdG9yID0gbmVnYXRpdmVIb3Jpem9udGFsVmVjdG9yIHwgfihjb21iaW5lZFZlY3RvciB8IHBvc2l0aXZlSG9yaXpvbnRhbFZlY3Rvcik7XG5cdFx0bmVnYXRpdmVWZWN0b3IgPSBwb3NpdGl2ZUhvcml6b250YWxWZWN0b3IgJiBjb21iaW5lZFZlY3Rvcjtcblx0fVxuXG5cdC8vIFJlc2V0IHByZWNvbXB1dGVkRXF1YWxpdHlBcnJheVxuXHRmb3IgKGxldCBrID0gc3RhcnQ7IGsgPCB2ZXJ0aWNhbExlbmd0aDsgaysrKSB7XG5cdFx0cHJlY29tcHV0ZWRFcXVhbGl0eUFycmF5W3NlY29uZFN0cmluZy5jaGFyQ29kZUF0KGspXSA9IDA7XG5cdH1cblxuXHRyZXR1cm4gZGlzdGFuY2U7XG59XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIExldmVuc2h0ZWluIGRpc3RhbmNlIGJldHdlZW4gdHdvIHN0cmluZ3MuXG4gKiBAcGFyYW0gZmlyc3RTdHJpbmcgLSBUaGUgZmlyc3Qgc3RyaW5nLlxuICogQHBhcmFtIHNlY29uZFN0cmluZyAtIFRoZSBzZWNvbmQgc3RyaW5nLlxuICogQHJldHVybnMgVGhlIExldmVuc2h0ZWluIGRpc3RhbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZUxldmVuc2h0ZWluRGlzdGFuY2UoZmlyc3RTdHJpbmc6IHN0cmluZywgc2Vjb25kU3RyaW5nOiBzdHJpbmcpOiBudW1iZXIge1xuXHRpZiAoZmlyc3RTdHJpbmcubGVuZ3RoIDwgc2Vjb25kU3RyaW5nLmxlbmd0aCkge1xuXHRcdGNvbnN0IHRlbXAgPSBzZWNvbmRTdHJpbmc7XG5cdFx0c2Vjb25kU3RyaW5nID0gZmlyc3RTdHJpbmc7XG5cdFx0Zmlyc3RTdHJpbmcgPSB0ZW1wO1xuXHR9XG5cdGlmIChzZWNvbmRTdHJpbmcubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIGZpcnN0U3RyaW5nLmxlbmd0aDtcblx0fVxuXHRpZiAoZmlyc3RTdHJpbmcubGVuZ3RoIDw9IDMyKSB7XG5cdFx0cmV0dXJuIGNvbXB1dGVMZXZlbnNodGVpbkRpc3RhbmNlRm9yU2hvcnRTdHJpbmdzKGZpcnN0U3RyaW5nLCBzZWNvbmRTdHJpbmcpO1xuXHR9XG5cdHJldHVybiBjb21wdXRlTGV2ZW5zaHRlaW5EaXN0YW5jZUZvckxvbmdTdHJpbmdzKGZpcnN0U3RyaW5nLCBzZWNvbmRTdHJpbmcpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBaUI7QUFFbkIsTUFBTSxtQkFBd0M7QUFBQSxFQUVwRCxZQUFvQixRQUFnQjtBQUFoQjtBQUFBLEVBQWtCO0FBQUEsRUFFdEMsY0FBZ0Q7QUFDL0MsVUFBTSxTQUFTLEtBQUs7QUFDcEIsVUFBTSxhQUFhLElBQUksV0FBVyxPQUFPLE1BQU07QUFDL0MsYUFBUyxJQUFJLEdBQUcsTUFBTSxPQUFPLFFBQVEsSUFBSSxLQUFLLEtBQUs7QUFDbEQsaUJBQVcsQ0FBQyxJQUFJLE9BQU8sV0FBVyxDQUFDO0FBQUEsSUFDcEM7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBRU8sU0FBUyxXQUFXLFVBQWtCLFVBQWtCLFFBQWdDO0FBQzlGLFNBQU8sSUFBSSxRQUFRLElBQUksbUJBQW1CLFFBQVEsR0FBRyxJQUFJLG1CQUFtQixRQUFRLENBQUMsRUFBRSxZQUFZLE1BQU0sRUFBRTtBQUM1RztBQThDQSxNQUFNLE1BQU07QUFBQSxFQUVYLE9BQWMsT0FBTyxXQUFvQixTQUF1QjtBQUMvRCxRQUFJLENBQUMsV0FBVztBQUNmLFlBQU0sSUFB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QVEsZ0JBQWdCO0FBQzlCLFFBQU0saUJBQWlCLEtBQUssSUFBSSxJQUFJLHFCQUFxQixLQUFLLElBQUk7QUFHbEUsV0FBUyxJQUFJLE9BQU8sSUFBSSxnQkFBZ0IsS0FBSztBQUM1Qyw2QkFBeUIsYUFBYSxXQUFXLENBQUMsQ0FBQyxLQUFLLEtBQUs7QUFBQSxFQUM5RDtBQUVBLE1BQUksV0FBVztBQUdmLFdBQVMsSUFBSSxHQUFHLElBQUksbUJBQW1CLEtBQUs7QUFDM0MsVUFBTSxlQUFlLHlCQUF5QixZQUFZLFdBQVcsQ0FBQyxDQUFDO0FBQ3ZFLFVBQU0sY0FBZSxtQkFBb0IsSUFBSSxLQUFNLENBQUMsTUFBTSxJQUFLO0FBQy9ELFVBQU0sV0FBWSxpQkFBa0IsSUFBSSxLQUFNLENBQUMsTUFBTSxJQUFLO0FBQzFELFVBQU0saUJBQWlCLGVBQWU7QUFDdEMsVUFBTSw2QkFBK0IsZUFBZSxZQUFZLGtCQUFrQixpQkFBa0IsaUJBQWtCLGVBQWU7QUFDckksUUFBSSwyQkFBMkIsaUJBQWlCLEVBQUUsMkJBQTJCO0FBQzdFLFFBQUksMkJBQTJCLGlCQUFpQjtBQUNoRCxnQkFBYSw2QkFBOEIscUJBQXFCLElBQU07QUFDdEUsZ0JBQWEsNkJBQThCLHFCQUFxQixJQUFNO0FBQ3RFLFFBQUssNkJBQTZCLEtBQU0sYUFBYTtBQUNwRCx5QkFBb0IsSUFBSSxLQUFNLENBQUMsS0FBSyxLQUFLO0FBQUEsSUFDMUM7QUFDQSxRQUFLLDZCQUE2QixLQUFNLFVBQVU7QUFDakQsdUJBQWtCLElBQUksS0FBTSxDQUFDLEtBQUssS0FBSztBQUFBLElBQ3hDO0FBQ0EsK0JBQTRCLDRCQUE0QixJQUFLO0FBQzdELCtCQUE0Qiw0QkFBNEIsSUFBSztBQUM3RCxxQkFBaUIsMkJBQTJCLEVBQUUsaUJBQWlCO0FBQy9ELHFCQUFpQiwyQkFBMkI7QUFBQSxFQUM3QztBQUdBLFdBQVMsSUFBSSxPQUFPLElBQUksZ0JBQWdCLEtBQUs7QUFDNUMsNkJBQXlCLGFBQWEsV0FBVyxDQUFDLENBQUMsSUFBSTtBQUFBLEVBQ3hEO0FBRUEsU0FBTztBQUNSO0FBUU8sU0FBUywyQkFBMkIsYUFBcUIsY0FBOEI7QUFDN0YsTUFBSSxZQUFZLFNBQVMsYUFBYSxRQUFRO0FBQzdDLFVBQU0sT0FBTztBQUNiLG1CQUFlO0FBQ2Ysa0JBQWM7QUFBQSxFQUNmO0FBQ0EsTUFBSSxhQUFhLFdBQVcsR0FBRztBQUM5QixXQUFPLFlBQVk7QUFBQSxFQUNwQjtBQUNBLE1BQUksWUFBWSxVQUFVLElBQUk7QUFDN0IsV0FBTywwQ0FBMEMsYUFBYSxZQUFZO0FBQUEsRUFDM0U7QUFDQSxTQUFPLHlDQUF5QyxhQUFhLFlBQVk7QUFDMUU7IiwKICAibmFtZXMiOiBbIkxvY2FsQ29uc3RhbnRzIiwgIm5lZ2F0aXZlVmVjdG9yIiwgInBvc2l0aXZlVmVjdG9yIiwgInN0YXJ0IiwgInZlcnRpY2FsTGVuZ3RoIl0KfQo=
