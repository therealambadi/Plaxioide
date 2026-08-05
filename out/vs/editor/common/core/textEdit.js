import { equals } from "../../../base/common/arrays.js";
import { assert, assertFn, checkAdjacentItems } from "../../../base/common/assert.js";
import { BugIndicatingError } from "../../../base/common/errors.js";
import { commonPrefixLength, commonSuffixLength, splitLines } from "../../../base/common/strings.js";
import { Position } from "./position.js";
import { PositionOffsetTransformer } from "./positionToOffset.js";
import { Range } from "./range.js";
import { TextLength } from "./textLength.js";
class TextEdit {
  constructor(edits) {
    this.edits = edits;
    assertFn(() => checkAdjacentItems(edits, (a, b) => a.range.getEndPosition().isBeforeOrEqual(b.range.getStartPosition())));
  }
  static fromOffsetEdit(edit, initialState) {
    const edits = edit.edits.map((e) => new SingleTextEdit(initialState.getTransformer().getRange(e.replaceRange), e.newText));
    return new TextEdit(edits);
  }
  static single(originalRange, newText) {
    return new TextEdit([new SingleTextEdit(originalRange, newText)]);
  }
  static insert(position, newText) {
    return new TextEdit([new SingleTextEdit(Range.fromPositions(position, position), newText)]);
  }
  /**
   * Joins touching edits and removes empty edits.
   */
  normalize() {
    const edits = [];
    for (const edit of this.edits) {
      if (edits.length > 0 && edits[edits.length - 1].range.getEndPosition().equals(edit.range.getStartPosition())) {
        const last = edits[edits.length - 1];
        edits[edits.length - 1] = new SingleTextEdit(last.range.plusRange(edit.range), last.text + edit.text);
      } else if (!edit.isEmpty) {
        edits.push(edit);
      }
    }
    return new TextEdit(edits);
  }
  mapPosition(position) {
    let lineDelta = 0;
    let curLine = 0;
    let columnDeltaInCurLine = 0;
    for (const edit of this.edits) {
      const start = edit.range.getStartPosition();
      if (position.isBeforeOrEqual(start)) {
        break;
      }
      const end = edit.range.getEndPosition();
      const len = TextLength.ofText(edit.text);
      if (position.isBefore(end)) {
        const startPos = new Position(start.lineNumber + lineDelta, start.column + (start.lineNumber + lineDelta === curLine ? columnDeltaInCurLine : 0));
        const endPos = len.addToPosition(startPos);
        return rangeFromPositions(startPos, endPos);
      }
      if (start.lineNumber + lineDelta !== curLine) {
        columnDeltaInCurLine = 0;
      }
      lineDelta += len.lineCount - (edit.range.endLineNumber - edit.range.startLineNumber);
      if (len.lineCount === 0) {
        if (end.lineNumber !== start.lineNumber) {
          columnDeltaInCurLine += len.columnCount - (end.column - 1);
        } else {
          columnDeltaInCurLine += len.columnCount - (end.column - start.column);
        }
      } else {
        columnDeltaInCurLine = len.columnCount;
      }
      curLine = end.lineNumber + lineDelta;
    }
    return new Position(position.lineNumber + lineDelta, position.column + (position.lineNumber + lineDelta === curLine ? columnDeltaInCurLine : 0));
  }
  mapRange(range) {
    function getStart(p) {
      return p instanceof Position ? p : p.getStartPosition();
    }
    function getEnd(p) {
      return p instanceof Position ? p : p.getEndPosition();
    }
    const start = getStart(this.mapPosition(range.getStartPosition()));
    const end = getEnd(this.mapPosition(range.getEndPosition()));
    return rangeFromPositions(start, end);
  }
  // TODO: `doc` is not needed for this!
  inverseMapPosition(positionAfterEdit, doc) {
    const reversed = this.inverse(doc);
    return reversed.mapPosition(positionAfterEdit);
  }
  inverseMapRange(range, doc) {
    const reversed = this.inverse(doc);
    return reversed.mapRange(range);
  }
  apply(text) {
    let result = "";
    let lastEditEnd = new Position(1, 1);
    for (const edit of this.edits) {
      const editRange = edit.range;
      const editStart = editRange.getStartPosition();
      const editEnd = editRange.getEndPosition();
      const r2 = rangeFromPositions(lastEditEnd, editStart);
      if (!r2.isEmpty()) {
        result += text.getValueOfRange(r2);
      }
      result += edit.text;
      lastEditEnd = editEnd;
    }
    const r = rangeFromPositions(lastEditEnd, text.endPositionExclusive);
    if (!r.isEmpty()) {
      result += text.getValueOfRange(r);
    }
    return result;
  }
  applyToString(str) {
    const strText = new StringText(str);
    return this.apply(strText);
  }
  inverse(doc) {
    const ranges = this.getNewRanges();
    return new TextEdit(this.edits.map((e, idx) => new SingleTextEdit(ranges[idx], doc.getValueOfRange(e.range))));
  }
  getNewRanges() {
    const newRanges = [];
    let previousEditEndLineNumber = 0;
    let lineOffset = 0;
    let columnOffset = 0;
    for (const edit of this.edits) {
      const textLength = TextLength.ofText(edit.text);
      const newRangeStart = Position.lift({
        lineNumber: edit.range.startLineNumber + lineOffset,
        column: edit.range.startColumn + (edit.range.startLineNumber === previousEditEndLineNumber ? columnOffset : 0)
      });
      const newRange = textLength.createRange(newRangeStart);
      newRanges.push(newRange);
      lineOffset = newRange.endLineNumber - edit.range.endLineNumber;
      columnOffset = newRange.endColumn - edit.range.endColumn;
      previousEditEndLineNumber = edit.range.endLineNumber;
    }
    return newRanges;
  }
  toSingle(text) {
    if (this.edits.length === 0) {
      throw new BugIndicatingError();
    }
    if (this.edits.length === 1) {
      return this.edits[0];
    }
    const startPos = this.edits[0].range.getStartPosition();
    const endPos = this.edits[this.edits.length - 1].range.getEndPosition();
    let newText = "";
    for (let i = 0; i < this.edits.length; i++) {
      const curEdit = this.edits[i];
      newText += curEdit.text;
      if (i < this.edits.length - 1) {
        const nextEdit = this.edits[i + 1];
        const gapRange = Range.fromPositions(curEdit.range.getEndPosition(), nextEdit.range.getStartPosition());
        const gapText = text.getValueOfRange(gapRange);
        newText += gapText;
      }
    }
    return new SingleTextEdit(Range.fromPositions(startPos, endPos), newText);
  }
  equals(other) {
    return equals(this.edits, other.edits, (a, b) => a.equals(b));
  }
}
class SingleTextEdit {
  constructor(range, text) {
    this.range = range;
    this.text = text;
  }
  static joinEdits(edits, initialValue) {
    if (edits.length === 0) {
      throw new BugIndicatingError();
    }
    if (edits.length === 1) {
      return edits[0];
    }
    const startPos = edits[0].range.getStartPosition();
    const endPos = edits[edits.length - 1].range.getEndPosition();
    let newText = "";
    for (let i = 0; i < edits.length; i++) {
      const curEdit = edits[i];
      newText += curEdit.text;
      if (i < edits.length - 1) {
        const nextEdit = edits[i + 1];
        const gapRange = Range.fromPositions(curEdit.range.getEndPosition(), nextEdit.range.getStartPosition());
        const gapText = initialValue.getValueOfRange(gapRange);
        newText += gapText;
      }
    }
    return new SingleTextEdit(Range.fromPositions(startPos, endPos), newText);
  }
  get isEmpty() {
    return this.range.isEmpty() && this.text.length === 0;
  }
  static equals(first, second) {
    return first.range.equalsRange(second.range) && first.text === second.text;
  }
  toSingleEditOperation() {
    return {
      range: this.range,
      text: this.text
    };
  }
  toEdit() {
    return new TextEdit([this]);
  }
  equals(other) {
    return SingleTextEdit.equals(this, other);
  }
  extendToCoverRange(range, initialValue) {
    if (this.range.containsRange(range)) {
      return this;
    }
    const newRange = this.range.plusRange(range);
    const textBefore = initialValue.getValueOfRange(Range.fromPositions(newRange.getStartPosition(), this.range.getStartPosition()));
    const textAfter = initialValue.getValueOfRange(Range.fromPositions(this.range.getEndPosition(), newRange.getEndPosition()));
    const newText = textBefore + this.text + textAfter;
    return new SingleTextEdit(newRange, newText);
  }
  extendToFullLine(initialValue) {
    const newRange = new Range(
      this.range.startLineNumber,
      1,
      this.range.endLineNumber,
      initialValue.getTransformer().getLineLength(this.range.endLineNumber) + 1
    );
    return this.extendToCoverRange(newRange, initialValue);
  }
  removeCommonPrefix(text) {
    const normalizedOriginalText = text.getValueOfRange(this.range).replaceAll("\r\n", "\n");
    const normalizedModifiedText = this.text.replaceAll("\r\n", "\n");
    const commonPrefixLen = commonPrefixLength(normalizedOriginalText, normalizedModifiedText);
    const start = TextLength.ofText(normalizedOriginalText.substring(0, commonPrefixLen)).addToPosition(this.range.getStartPosition());
    const newText = normalizedModifiedText.substring(commonPrefixLen);
    const range = Range.fromPositions(start, this.range.getEndPosition());
    return new SingleTextEdit(range, newText);
  }
  isEffectiveDeletion(text) {
    let newText = this.text.replaceAll("\r\n", "\n");
    let existingText = text.getValueOfRange(this.range).replaceAll("\r\n", "\n");
    const l = commonPrefixLength(newText, existingText);
    newText = newText.substring(l);
    existingText = existingText.substring(l);
    const r = commonSuffixLength(newText, existingText);
    newText = newText.substring(0, newText.length - r);
    existingText = existingText.substring(0, existingText.length - r);
    return newText === "";
  }
}
function rangeFromPositions(start, end) {
  if (start.lineNumber === end.lineNumber && start.column === Number.MAX_SAFE_INTEGER) {
    return Range.fromPositions(end, end);
  } else if (!start.isBeforeOrEqual(end)) {
    throw new BugIndicatingError("start must be before end");
  }
  return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
}
class AbstractText {
  constructor() {
    this._transformer = void 0;
  }
  get endPositionExclusive() {
    return this.length.addToPosition(new Position(1, 1));
  }
  get lineRange() {
    return this.length.toLineRange();
  }
  getValue() {
    return this.getValueOfRange(this.length.toRange());
  }
  getLineLength(lineNumber) {
    return this.getValueOfRange(new Range(lineNumber, 1, lineNumber, Number.MAX_SAFE_INTEGER)).length;
  }
  getTransformer() {
    if (!this._transformer) {
      this._transformer = new PositionOffsetTransformer(this.getValue());
    }
    return this._transformer;
  }
  getLineAt(lineNumber) {
    return this.getValueOfRange(new Range(lineNumber, 1, lineNumber, Number.MAX_SAFE_INTEGER));
  }
  getLines() {
    const value = this.getValue();
    return splitLines(value);
  }
}
class LineBasedText extends AbstractText {
  constructor(_getLineContent, _lineCount) {
    assert(_lineCount >= 1);
    super();
    this._getLineContent = _getLineContent;
    this._lineCount = _lineCount;
  }
  getValueOfRange(range) {
    if (range.startLineNumber === range.endLineNumber) {
      return this._getLineContent(range.startLineNumber).substring(range.startColumn - 1, range.endColumn - 1);
    }
    let result = this._getLineContent(range.startLineNumber).substring(range.startColumn - 1);
    for (let i = range.startLineNumber + 1; i < range.endLineNumber; i++) {
      result += "\n" + this._getLineContent(i);
    }
    result += "\n" + this._getLineContent(range.endLineNumber).substring(0, range.endColumn - 1);
    return result;
  }
  getLineLength(lineNumber) {
    return this._getLineContent(lineNumber).length;
  }
  get length() {
    const lastLine = this._getLineContent(this._lineCount);
    return new TextLength(this._lineCount - 1, lastLine.length);
  }
}
class ArrayText extends LineBasedText {
  constructor(lines) {
    super(
      (lineNumber) => lines[lineNumber - 1],
      lines.length
    );
  }
}
class StringText extends AbstractText {
  constructor(value) {
    super();
    this.value = value;
    this._t = new PositionOffsetTransformer(this.value);
  }
  getValueOfRange(range) {
    return this._t.getOffsetRange(range).substring(this.value);
  }
  get length() {
    return this._t.textLength;
  }
}
export {
  AbstractText,
  ArrayText,
  LineBasedText,
  SingleTextEdit,
  StringText,
  TextEdit
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvcmUvdGV4dEVkaXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0LCBhc3NlcnRGbiwgY2hlY2tBZGphY2VudEl0ZW1zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBjb21tb25QcmVmaXhMZW5ndGgsIGNvbW1vblN1ZmZpeExlbmd0aCwgc3BsaXRMaW5lcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgT2Zmc2V0RWRpdCB9IGZyb20gJy4vb2Zmc2V0RWRpdC5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4vcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb25PZmZzZXRUcmFuc2Zvcm1lciB9IGZyb20gJy4vcG9zaXRpb25Ub09mZnNldC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vcmFuZ2UuanMnO1xuaW1wb3J0IHsgVGV4dExlbmd0aCB9IGZyb20gJy4vdGV4dExlbmd0aC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXh0RWRpdCB7XG5cdHB1YmxpYyBzdGF0aWMgZnJvbU9mZnNldEVkaXQoZWRpdDogT2Zmc2V0RWRpdCwgaW5pdGlhbFN0YXRlOiBBYnN0cmFjdFRleHQpOiBUZXh0RWRpdCB7XG5cdFx0Y29uc3QgZWRpdHMgPSBlZGl0LmVkaXRzLm1hcChlID0+IG5ldyBTaW5nbGVUZXh0RWRpdChpbml0aWFsU3RhdGUuZ2V0VHJhbnNmb3JtZXIoKS5nZXRSYW5nZShlLnJlcGxhY2VSYW5nZSksIGUubmV3VGV4dCkpO1xuXHRcdHJldHVybiBuZXcgVGV4dEVkaXQoZWRpdHMpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBzaW5nbGUob3JpZ2luYWxSYW5nZTogUmFuZ2UsIG5ld1RleHQ6IHN0cmluZyk6IFRleHRFZGl0IHtcblx0XHRyZXR1cm4gbmV3IFRleHRFZGl0KFtuZXcgU2luZ2xlVGV4dEVkaXQob3JpZ2luYWxSYW5nZSwgbmV3VGV4dCldKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgaW5zZXJ0KHBvc2l0aW9uOiBQb3NpdGlvbiwgbmV3VGV4dDogc3RyaW5nKTogVGV4dEVkaXQge1xuXHRcdHJldHVybiBuZXcgVGV4dEVkaXQoW25ldyBTaW5nbGVUZXh0RWRpdChSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uLCBwb3NpdGlvbiksIG5ld1RleHQpXSk7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgZWRpdHM6IHJlYWRvbmx5IFNpbmdsZVRleHRFZGl0W10pIHtcblx0XHRhc3NlcnRGbigoKSA9PiBjaGVja0FkamFjZW50SXRlbXMoZWRpdHMsIChhLCBiKSA9PiBhLnJhbmdlLmdldEVuZFBvc2l0aW9uKCkuaXNCZWZvcmVPckVxdWFsKGIucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEpvaW5zIHRvdWNoaW5nIGVkaXRzIGFuZCByZW1vdmVzIGVtcHR5IGVkaXRzLlxuXHQgKi9cblx0bm9ybWFsaXplKCk6IFRleHRFZGl0IHtcblx0XHRjb25zdCBlZGl0czogU2luZ2xlVGV4dEVkaXRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB0aGlzLmVkaXRzKSB7XG5cdFx0XHRpZiAoZWRpdHMubGVuZ3RoID4gMCAmJiBlZGl0c1tlZGl0cy5sZW5ndGggLSAxXS5yYW5nZS5nZXRFbmRQb3NpdGlvbigpLmVxdWFscyhlZGl0LnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSkpIHtcblx0XHRcdFx0Y29uc3QgbGFzdCA9IGVkaXRzW2VkaXRzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRlZGl0c1tlZGl0cy5sZW5ndGggLSAxXSA9IG5ldyBTaW5nbGVUZXh0RWRpdChsYXN0LnJhbmdlLnBsdXNSYW5nZShlZGl0LnJhbmdlKSwgbGFzdC50ZXh0ICsgZWRpdC50ZXh0KTtcblx0XHRcdH0gZWxzZSBpZiAoIWVkaXQuaXNFbXB0eSkge1xuXHRcdFx0XHRlZGl0cy5wdXNoKGVkaXQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFRleHRFZGl0KGVkaXRzKTtcblx0fVxuXG5cdG1hcFBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbik6IFBvc2l0aW9uIHwgUmFuZ2Uge1xuXHRcdGxldCBsaW5lRGVsdGEgPSAwO1xuXHRcdGxldCBjdXJMaW5lID0gMDtcblx0XHRsZXQgY29sdW1uRGVsdGFJbkN1ckxpbmUgPSAwO1xuXG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIHRoaXMuZWRpdHMpIHtcblx0XHRcdGNvbnN0IHN0YXJ0ID0gZWRpdC5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cblx0XHRcdGlmIChwb3NpdGlvbi5pc0JlZm9yZU9yRXF1YWwoc3RhcnQpKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlbmQgPSBlZGl0LnJhbmdlLmdldEVuZFBvc2l0aW9uKCk7XG5cdFx0XHRjb25zdCBsZW4gPSBUZXh0TGVuZ3RoLm9mVGV4dChlZGl0LnRleHQpO1xuXHRcdFx0aWYgKHBvc2l0aW9uLmlzQmVmb3JlKGVuZCkpIHtcblx0XHRcdFx0Y29uc3Qgc3RhcnRQb3MgPSBuZXcgUG9zaXRpb24oc3RhcnQubGluZU51bWJlciArIGxpbmVEZWx0YSwgc3RhcnQuY29sdW1uICsgKHN0YXJ0LmxpbmVOdW1iZXIgKyBsaW5lRGVsdGEgPT09IGN1ckxpbmUgPyBjb2x1bW5EZWx0YUluQ3VyTGluZSA6IDApKTtcblx0XHRcdFx0Y29uc3QgZW5kUG9zID0gbGVuLmFkZFRvUG9zaXRpb24oc3RhcnRQb3MpO1xuXHRcdFx0XHRyZXR1cm4gcmFuZ2VGcm9tUG9zaXRpb25zKHN0YXJ0UG9zLCBlbmRQb3MpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RhcnQubGluZU51bWJlciArIGxpbmVEZWx0YSAhPT0gY3VyTGluZSkge1xuXHRcdFx0XHRjb2x1bW5EZWx0YUluQ3VyTGluZSA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdGxpbmVEZWx0YSArPSBsZW4ubGluZUNvdW50IC0gKGVkaXQucmFuZ2UuZW5kTGluZU51bWJlciAtIGVkaXQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblxuXHRcdFx0aWYgKGxlbi5saW5lQ291bnQgPT09IDApIHtcblx0XHRcdFx0aWYgKGVuZC5saW5lTnVtYmVyICE9PSBzdGFydC5saW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0Y29sdW1uRGVsdGFJbkN1ckxpbmUgKz0gbGVuLmNvbHVtbkNvdW50IC0gKGVuZC5jb2x1bW4gLSAxKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb2x1bW5EZWx0YUluQ3VyTGluZSArPSBsZW4uY29sdW1uQ291bnQgLSAoZW5kLmNvbHVtbiAtIHN0YXJ0LmNvbHVtbik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbHVtbkRlbHRhSW5DdXJMaW5lID0gbGVuLmNvbHVtbkNvdW50O1xuXHRcdFx0fVxuXHRcdFx0Y3VyTGluZSA9IGVuZC5saW5lTnVtYmVyICsgbGluZURlbHRhO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUG9zaXRpb24ocG9zaXRpb24ubGluZU51bWJlciArIGxpbmVEZWx0YSwgcG9zaXRpb24uY29sdW1uICsgKHBvc2l0aW9uLmxpbmVOdW1iZXIgKyBsaW5lRGVsdGEgPT09IGN1ckxpbmUgPyBjb2x1bW5EZWx0YUluQ3VyTGluZSA6IDApKTtcblx0fVxuXG5cdG1hcFJhbmdlKHJhbmdlOiBSYW5nZSk6IFJhbmdlIHtcblx0XHRmdW5jdGlvbiBnZXRTdGFydChwOiBQb3NpdGlvbiB8IFJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gcCBpbnN0YW5jZW9mIFBvc2l0aW9uID8gcCA6IHAuZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldEVuZChwOiBQb3NpdGlvbiB8IFJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gcCBpbnN0YW5jZW9mIFBvc2l0aW9uID8gcCA6IHAuZ2V0RW5kUG9zaXRpb24oKTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydCA9IGdldFN0YXJ0KHRoaXMubWFwUG9zaXRpb24ocmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKSk7XG5cdFx0Y29uc3QgZW5kID0gZ2V0RW5kKHRoaXMubWFwUG9zaXRpb24ocmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSkpO1xuXG5cdFx0cmV0dXJuIHJhbmdlRnJvbVBvc2l0aW9ucyhzdGFydCwgZW5kKTtcblx0fVxuXG5cdC8vIFRPRE86IGBkb2NgIGlzIG5vdCBuZWVkZWQgZm9yIHRoaXMhXG5cdGludmVyc2VNYXBQb3NpdGlvbihwb3NpdGlvbkFmdGVyRWRpdDogUG9zaXRpb24sIGRvYzogQWJzdHJhY3RUZXh0KTogUG9zaXRpb24gfCBSYW5nZSB7XG5cdFx0Y29uc3QgcmV2ZXJzZWQgPSB0aGlzLmludmVyc2UoZG9jKTtcblx0XHRyZXR1cm4gcmV2ZXJzZWQubWFwUG9zaXRpb24ocG9zaXRpb25BZnRlckVkaXQpO1xuXHR9XG5cblx0aW52ZXJzZU1hcFJhbmdlKHJhbmdlOiBSYW5nZSwgZG9jOiBBYnN0cmFjdFRleHQpOiBSYW5nZSB7XG5cdFx0Y29uc3QgcmV2ZXJzZWQgPSB0aGlzLmludmVyc2UoZG9jKTtcblx0XHRyZXR1cm4gcmV2ZXJzZWQubWFwUmFuZ2UocmFuZ2UpO1xuXHR9XG5cblx0YXBwbHkodGV4dDogQWJzdHJhY3RUZXh0KTogc3RyaW5nIHtcblx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cdFx0bGV0IGxhc3RFZGl0RW5kID0gbmV3IFBvc2l0aW9uKDEsIDEpO1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB0aGlzLmVkaXRzKSB7XG5cdFx0XHRjb25zdCBlZGl0UmFuZ2UgPSBlZGl0LnJhbmdlO1xuXHRcdFx0Y29uc3QgZWRpdFN0YXJ0ID0gZWRpdFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdGNvbnN0IGVkaXRFbmQgPSBlZGl0UmFuZ2UuZ2V0RW5kUG9zaXRpb24oKTtcblxuXHRcdFx0Y29uc3QgciA9IHJhbmdlRnJvbVBvc2l0aW9ucyhsYXN0RWRpdEVuZCwgZWRpdFN0YXJ0KTtcblx0XHRcdGlmICghci5pc0VtcHR5KCkpIHtcblx0XHRcdFx0cmVzdWx0ICs9IHRleHQuZ2V0VmFsdWVPZlJhbmdlKHIpO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0ICs9IGVkaXQudGV4dDtcblx0XHRcdGxhc3RFZGl0RW5kID0gZWRpdEVuZDtcblx0XHR9XG5cdFx0Y29uc3QgciA9IHJhbmdlRnJvbVBvc2l0aW9ucyhsYXN0RWRpdEVuZCwgdGV4dC5lbmRQb3NpdGlvbkV4Y2x1c2l2ZSk7XG5cdFx0aWYgKCFyLmlzRW1wdHkoKSkge1xuXHRcdFx0cmVzdWx0ICs9IHRleHQuZ2V0VmFsdWVPZlJhbmdlKHIpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0YXBwbHlUb1N0cmluZyhzdHI6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc3RyVGV4dCA9IG5ldyBTdHJpbmdUZXh0KHN0cik7XG5cdFx0cmV0dXJuIHRoaXMuYXBwbHkoc3RyVGV4dCk7XG5cdH1cblxuXHRpbnZlcnNlKGRvYzogQWJzdHJhY3RUZXh0KTogVGV4dEVkaXQge1xuXHRcdGNvbnN0IHJhbmdlcyA9IHRoaXMuZ2V0TmV3UmFuZ2VzKCk7XG5cdFx0cmV0dXJuIG5ldyBUZXh0RWRpdCh0aGlzLmVkaXRzLm1hcCgoZSwgaWR4KSA9PiBuZXcgU2luZ2xlVGV4dEVkaXQocmFuZ2VzW2lkeF0sIGRvYy5nZXRWYWx1ZU9mUmFuZ2UoZS5yYW5nZSkpKSk7XG5cdH1cblxuXHRnZXROZXdSYW5nZXMoKTogUmFuZ2VbXSB7XG5cdFx0Y29uc3QgbmV3UmFuZ2VzOiBSYW5nZVtdID0gW107XG5cdFx0bGV0IHByZXZpb3VzRWRpdEVuZExpbmVOdW1iZXIgPSAwO1xuXHRcdGxldCBsaW5lT2Zmc2V0ID0gMDtcblx0XHRsZXQgY29sdW1uT2Zmc2V0ID0gMDtcblx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgdGhpcy5lZGl0cykge1xuXHRcdFx0Y29uc3QgdGV4dExlbmd0aCA9IFRleHRMZW5ndGgub2ZUZXh0KGVkaXQudGV4dCk7XG5cdFx0XHRjb25zdCBuZXdSYW5nZVN0YXJ0ID0gUG9zaXRpb24ubGlmdCh7XG5cdFx0XHRcdGxpbmVOdW1iZXI6IGVkaXQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgbGluZU9mZnNldCxcblx0XHRcdFx0Y29sdW1uOiBlZGl0LnJhbmdlLnN0YXJ0Q29sdW1uICsgKGVkaXQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSBwcmV2aW91c0VkaXRFbmRMaW5lTnVtYmVyID8gY29sdW1uT2Zmc2V0IDogMClcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgbmV3UmFuZ2UgPSB0ZXh0TGVuZ3RoLmNyZWF0ZVJhbmdlKG5ld1JhbmdlU3RhcnQpO1xuXHRcdFx0bmV3UmFuZ2VzLnB1c2gobmV3UmFuZ2UpO1xuXHRcdFx0bGluZU9mZnNldCA9IG5ld1JhbmdlLmVuZExpbmVOdW1iZXIgLSBlZGl0LnJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0XHRjb2x1bW5PZmZzZXQgPSBuZXdSYW5nZS5lbmRDb2x1bW4gLSBlZGl0LnJhbmdlLmVuZENvbHVtbjtcblx0XHRcdHByZXZpb3VzRWRpdEVuZExpbmVOdW1iZXIgPSBlZGl0LnJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0fVxuXHRcdHJldHVybiBuZXdSYW5nZXM7XG5cdH1cblxuXHR0b1NpbmdsZSh0ZXh0OiBBYnN0cmFjdFRleHQpIHtcblx0XHRpZiAodGhpcy5lZGl0cy5sZW5ndGggPT09IDApIHsgdGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpOyB9XG5cdFx0aWYgKHRoaXMuZWRpdHMubGVuZ3RoID09PSAxKSB7IHJldHVybiB0aGlzLmVkaXRzWzBdOyB9XG5cblx0XHRjb25zdCBzdGFydFBvcyA9IHRoaXMuZWRpdHNbMF0ucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdGNvbnN0IGVuZFBvcyA9IHRoaXMuZWRpdHNbdGhpcy5lZGl0cy5sZW5ndGggLSAxXS5yYW5nZS5nZXRFbmRQb3NpdGlvbigpO1xuXG5cdFx0bGV0IG5ld1RleHQgPSAnJztcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lZGl0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgY3VyRWRpdCA9IHRoaXMuZWRpdHNbaV07XG5cdFx0XHRuZXdUZXh0ICs9IGN1ckVkaXQudGV4dDtcblx0XHRcdGlmIChpIDwgdGhpcy5lZGl0cy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdGNvbnN0IG5leHRFZGl0ID0gdGhpcy5lZGl0c1tpICsgMV07XG5cdFx0XHRcdGNvbnN0IGdhcFJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhjdXJFZGl0LnJhbmdlLmdldEVuZFBvc2l0aW9uKCksIG5leHRFZGl0LnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0XHRcdGNvbnN0IGdhcFRleHQgPSB0ZXh0LmdldFZhbHVlT2ZSYW5nZShnYXBSYW5nZSk7XG5cdFx0XHRcdG5ld1RleHQgKz0gZ2FwVGV4dDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBTaW5nbGVUZXh0RWRpdChSYW5nZS5mcm9tUG9zaXRpb25zKHN0YXJ0UG9zLCBlbmRQb3MpLCBuZXdUZXh0KTtcblx0fVxuXG5cdGVxdWFscyhvdGhlcjogVGV4dEVkaXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZXF1YWxzKHRoaXMuZWRpdHMsIG90aGVyLmVkaXRzLCAoYSwgYikgPT4gYS5lcXVhbHMoYikpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTaW5nbGVUZXh0RWRpdCB7XG5cdHB1YmxpYyBzdGF0aWMgam9pbkVkaXRzKGVkaXRzOiBTaW5nbGVUZXh0RWRpdFtdLCBpbml0aWFsVmFsdWU6IEFic3RyYWN0VGV4dCk6IFNpbmdsZVRleHRFZGl0IHtcblx0XHRpZiAoZWRpdHMubGVuZ3RoID09PSAwKSB7IHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoKTsgfVxuXHRcdGlmIChlZGl0cy5sZW5ndGggPT09IDEpIHsgcmV0dXJuIGVkaXRzWzBdOyB9XG5cblx0XHRjb25zdCBzdGFydFBvcyA9IGVkaXRzWzBdLnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRjb25zdCBlbmRQb3MgPSBlZGl0c1tlZGl0cy5sZW5ndGggLSAxXS5yYW5nZS5nZXRFbmRQb3NpdGlvbigpO1xuXG5cdFx0bGV0IG5ld1RleHQgPSAnJztcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZWRpdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1ckVkaXQgPSBlZGl0c1tpXTtcblx0XHRcdG5ld1RleHQgKz0gY3VyRWRpdC50ZXh0O1xuXHRcdFx0aWYgKGkgPCBlZGl0cy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdGNvbnN0IG5leHRFZGl0ID0gZWRpdHNbaSArIDFdO1xuXHRcdFx0XHRjb25zdCBnYXBSYW5nZSA9IFJhbmdlLmZyb21Qb3NpdGlvbnMoY3VyRWRpdC5yYW5nZS5nZXRFbmRQb3NpdGlvbigpLCBuZXh0RWRpdC5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRjb25zdCBnYXBUZXh0ID0gaW5pdGlhbFZhbHVlLmdldFZhbHVlT2ZSYW5nZShnYXBSYW5nZSk7XG5cdFx0XHRcdG5ld1RleHQgKz0gZ2FwVGV4dDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBTaW5nbGVUZXh0RWRpdChSYW5nZS5mcm9tUG9zaXRpb25zKHN0YXJ0UG9zLCBlbmRQb3MpLCBuZXdUZXh0KTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSByYW5nZTogUmFuZ2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IHRleHQ6IHN0cmluZyxcblx0KSB7XG5cdH1cblxuXHRnZXQgaXNFbXB0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5yYW5nZS5pc0VtcHR5KCkgJiYgdGhpcy50ZXh0Lmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdHN0YXRpYyBlcXVhbHMoZmlyc3Q6IFNpbmdsZVRleHRFZGl0LCBzZWNvbmQ6IFNpbmdsZVRleHRFZGl0KSB7XG5cdFx0cmV0dXJuIGZpcnN0LnJhbmdlLmVxdWFsc1JhbmdlKHNlY29uZC5yYW5nZSkgJiYgZmlyc3QudGV4dCA9PT0gc2Vjb25kLnRleHQ7XG5cdH1cblxuXHRwdWJsaWMgdG9TaW5nbGVFZGl0T3BlcmF0aW9uKCk6IElTaW5nbGVFZGl0T3BlcmF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IHRoaXMucmFuZ2UsXG5cdFx0XHR0ZXh0OiB0aGlzLnRleHQsXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyB0b0VkaXQoKTogVGV4dEVkaXQge1xuXHRcdHJldHVybiBuZXcgVGV4dEVkaXQoW3RoaXNdKTtcblx0fVxuXG5cdHB1YmxpYyBlcXVhbHMob3RoZXI6IFNpbmdsZVRleHRFZGl0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIFNpbmdsZVRleHRFZGl0LmVxdWFscyh0aGlzLCBvdGhlcik7XG5cdH1cblxuXHRwdWJsaWMgZXh0ZW5kVG9Db3ZlclJhbmdlKHJhbmdlOiBSYW5nZSwgaW5pdGlhbFZhbHVlOiBBYnN0cmFjdFRleHQpOiBTaW5nbGVUZXh0RWRpdCB7XG5cdFx0aWYgKHRoaXMucmFuZ2UuY29udGFpbnNSYW5nZShyYW5nZSkpIHsgcmV0dXJuIHRoaXM7IH1cblxuXHRcdGNvbnN0IG5ld1JhbmdlID0gdGhpcy5yYW5nZS5wbHVzUmFuZ2UocmFuZ2UpO1xuXHRcdGNvbnN0IHRleHRCZWZvcmUgPSBpbml0aWFsVmFsdWUuZ2V0VmFsdWVPZlJhbmdlKFJhbmdlLmZyb21Qb3NpdGlvbnMobmV3UmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpLCB0aGlzLnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSkpO1xuXHRcdGNvbnN0IHRleHRBZnRlciA9IGluaXRpYWxWYWx1ZS5nZXRWYWx1ZU9mUmFuZ2UoUmFuZ2UuZnJvbVBvc2l0aW9ucyh0aGlzLnJhbmdlLmdldEVuZFBvc2l0aW9uKCksIG5ld1JhbmdlLmdldEVuZFBvc2l0aW9uKCkpKTtcblx0XHRjb25zdCBuZXdUZXh0ID0gdGV4dEJlZm9yZSArIHRoaXMudGV4dCArIHRleHRBZnRlcjtcblx0XHRyZXR1cm4gbmV3IFNpbmdsZVRleHRFZGl0KG5ld1JhbmdlLCBuZXdUZXh0KTtcblx0fVxuXG5cdHB1YmxpYyBleHRlbmRUb0Z1bGxMaW5lKGluaXRpYWxWYWx1ZTogQWJzdHJhY3RUZXh0KTogU2luZ2xlVGV4dEVkaXQge1xuXHRcdGNvbnN0IG5ld1JhbmdlID0gbmV3IFJhbmdlKFxuXHRcdFx0dGhpcy5yYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHQxLFxuXHRcdFx0dGhpcy5yYW5nZS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0aW5pdGlhbFZhbHVlLmdldFRyYW5zZm9ybWVyKCkuZ2V0TGluZUxlbmd0aCh0aGlzLnJhbmdlLmVuZExpbmVOdW1iZXIpICsgMVxuXHRcdCk7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5kVG9Db3ZlclJhbmdlKG5ld1JhbmdlLCBpbml0aWFsVmFsdWUpO1xuXHR9XG5cblx0cHVibGljIHJlbW92ZUNvbW1vblByZWZpeCh0ZXh0OiBBYnN0cmFjdFRleHQpOiBTaW5nbGVUZXh0RWRpdCB7XG5cdFx0Y29uc3Qgbm9ybWFsaXplZE9yaWdpbmFsVGV4dCA9IHRleHQuZ2V0VmFsdWVPZlJhbmdlKHRoaXMucmFuZ2UpLnJlcGxhY2VBbGwoJ1xcclxcbicsICdcXG4nKTtcblx0XHRjb25zdCBub3JtYWxpemVkTW9kaWZpZWRUZXh0ID0gdGhpcy50ZXh0LnJlcGxhY2VBbGwoJ1xcclxcbicsICdcXG4nKTtcblxuXHRcdGNvbnN0IGNvbW1vblByZWZpeExlbiA9IGNvbW1vblByZWZpeExlbmd0aChub3JtYWxpemVkT3JpZ2luYWxUZXh0LCBub3JtYWxpemVkTW9kaWZpZWRUZXh0KTtcblx0XHRjb25zdCBzdGFydCA9IFRleHRMZW5ndGgub2ZUZXh0KG5vcm1hbGl6ZWRPcmlnaW5hbFRleHQuc3Vic3RyaW5nKDAsIGNvbW1vblByZWZpeExlbikpXG5cdFx0XHQuYWRkVG9Qb3NpdGlvbih0aGlzLnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cblx0XHRjb25zdCBuZXdUZXh0ID0gbm9ybWFsaXplZE1vZGlmaWVkVGV4dC5zdWJzdHJpbmcoY29tbW9uUHJlZml4TGVuKTtcblx0XHRjb25zdCByYW5nZSA9IFJhbmdlLmZyb21Qb3NpdGlvbnMoc3RhcnQsIHRoaXMucmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSk7XG5cdFx0cmV0dXJuIG5ldyBTaW5nbGVUZXh0RWRpdChyYW5nZSwgbmV3VGV4dCk7XG5cdH1cblxuXHRwdWJsaWMgaXNFZmZlY3RpdmVEZWxldGlvbih0ZXh0OiBBYnN0cmFjdFRleHQpOiBib29sZWFuIHtcblx0XHRsZXQgbmV3VGV4dCA9IHRoaXMudGV4dC5yZXBsYWNlQWxsKCdcXHJcXG4nLCAnXFxuJyk7XG5cdFx0bGV0IGV4aXN0aW5nVGV4dCA9IHRleHQuZ2V0VmFsdWVPZlJhbmdlKHRoaXMucmFuZ2UpLnJlcGxhY2VBbGwoJ1xcclxcbicsICdcXG4nKTtcblx0XHRjb25zdCBsID0gY29tbW9uUHJlZml4TGVuZ3RoKG5ld1RleHQsIGV4aXN0aW5nVGV4dCk7XG5cdFx0bmV3VGV4dCA9IG5ld1RleHQuc3Vic3RyaW5nKGwpO1xuXHRcdGV4aXN0aW5nVGV4dCA9IGV4aXN0aW5nVGV4dC5zdWJzdHJpbmcobCk7XG5cdFx0Y29uc3QgciA9IGNvbW1vblN1ZmZpeExlbmd0aChuZXdUZXh0LCBleGlzdGluZ1RleHQpO1xuXHRcdG5ld1RleHQgPSBuZXdUZXh0LnN1YnN0cmluZygwLCBuZXdUZXh0Lmxlbmd0aCAtIHIpO1xuXHRcdGV4aXN0aW5nVGV4dCA9IGV4aXN0aW5nVGV4dC5zdWJzdHJpbmcoMCwgZXhpc3RpbmdUZXh0Lmxlbmd0aCAtIHIpO1xuXG5cdFx0cmV0dXJuIG5ld1RleHQgPT09ICcnO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJhbmdlRnJvbVBvc2l0aW9ucyhzdGFydDogUG9zaXRpb24sIGVuZDogUG9zaXRpb24pOiBSYW5nZSB7XG5cdGlmIChzdGFydC5saW5lTnVtYmVyID09PSBlbmQubGluZU51bWJlciAmJiBzdGFydC5jb2x1bW4gPT09IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG5cdFx0cmV0dXJuIFJhbmdlLmZyb21Qb3NpdGlvbnMoZW5kLCBlbmQpO1xuXHR9IGVsc2UgaWYgKCFzdGFydC5pc0JlZm9yZU9yRXF1YWwoZW5kKSkge1xuXHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ3N0YXJ0IG11c3QgYmUgYmVmb3JlIGVuZCcpO1xuXHR9XG5cdHJldHVybiBuZXcgUmFuZ2Uoc3RhcnQubGluZU51bWJlciwgc3RhcnQuY29sdW1uLCBlbmQubGluZU51bWJlciwgZW5kLmNvbHVtbik7XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFRleHQge1xuXHRhYnN0cmFjdCBnZXRWYWx1ZU9mUmFuZ2UocmFuZ2U6IFJhbmdlKTogc3RyaW5nO1xuXHRhYnN0cmFjdCByZWFkb25seSBsZW5ndGg6IFRleHRMZW5ndGg7XG5cblx0Z2V0IGVuZFBvc2l0aW9uRXhjbHVzaXZlKCk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5sZW5ndGguYWRkVG9Qb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHR9XG5cblx0Z2V0IGxpbmVSYW5nZSgpOiBMaW5lUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLmxlbmd0aC50b0xpbmVSYW5nZSgpO1xuXHR9XG5cblx0Z2V0VmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRWYWx1ZU9mUmFuZ2UodGhpcy5sZW5ndGgudG9SYW5nZSgpKTtcblx0fVxuXG5cdGdldExpbmVMZW5ndGgobGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRWYWx1ZU9mUmFuZ2UobmV3IFJhbmdlKGxpbmVOdW1iZXIsIDEsIGxpbmVOdW1iZXIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSkubGVuZ3RoO1xuXHR9XG5cblx0cHJpdmF0ZSBfdHJhbnNmb3JtZXI6IFBvc2l0aW9uT2Zmc2V0VHJhbnNmb3JtZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Z2V0VHJhbnNmb3JtZXIoKTogUG9zaXRpb25PZmZzZXRUcmFuc2Zvcm1lciB7XG5cdFx0aWYgKCF0aGlzLl90cmFuc2Zvcm1lcikge1xuXHRcdFx0dGhpcy5fdHJhbnNmb3JtZXIgPSBuZXcgUG9zaXRpb25PZmZzZXRUcmFuc2Zvcm1lcih0aGlzLmdldFZhbHVlKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdHJhbnNmb3JtZXI7XG5cdH1cblxuXHRnZXRMaW5lQXQobGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRWYWx1ZU9mUmFuZ2UobmV3IFJhbmdlKGxpbmVOdW1iZXIsIDEsIGxpbmVOdW1iZXIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSk7XG5cdH1cblxuXHRnZXRMaW5lcygpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLmdldFZhbHVlKCk7XG5cdFx0cmV0dXJuIHNwbGl0TGluZXModmFsdWUpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBMaW5lQmFzZWRUZXh0IGV4dGVuZHMgQWJzdHJhY3RUZXh0IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZ2V0TGluZUNvbnRlbnQ6IChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9saW5lQ291bnQ6IG51bWJlcixcblx0KSB7XG5cdFx0YXNzZXJ0KF9saW5lQ291bnQgPj0gMSk7XG5cblx0XHRzdXBlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0VmFsdWVPZlJhbmdlKHJhbmdlOiBSYW5nZSk6IHN0cmluZyB7XG5cdFx0aWYgKHJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gcmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2dldExpbmVDb250ZW50KHJhbmdlLnN0YXJ0TGluZU51bWJlcikuc3Vic3RyaW5nKHJhbmdlLnN0YXJ0Q29sdW1uIC0gMSwgcmFuZ2UuZW5kQ29sdW1uIC0gMSk7XG5cdFx0fVxuXHRcdGxldCByZXN1bHQgPSB0aGlzLl9nZXRMaW5lQ29udGVudChyYW5nZS5zdGFydExpbmVOdW1iZXIpLnN1YnN0cmluZyhyYW5nZS5zdGFydENvbHVtbiAtIDEpO1xuXHRcdGZvciAobGV0IGkgPSByYW5nZS5zdGFydExpbmVOdW1iZXIgKyAxOyBpIDwgcmFuZ2UuZW5kTGluZU51bWJlcjsgaSsrKSB7XG5cdFx0XHRyZXN1bHQgKz0gJ1xcbicgKyB0aGlzLl9nZXRMaW5lQ29udGVudChpKTtcblx0XHR9XG5cdFx0cmVzdWx0ICs9ICdcXG4nICsgdGhpcy5fZ2V0TGluZUNvbnRlbnQocmFuZ2UuZW5kTGluZU51bWJlcikuc3Vic3RyaW5nKDAsIHJhbmdlLmVuZENvbHVtbiAtIDEpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRMaW5lTGVuZ3RoKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldExpbmVDb250ZW50KGxpbmVOdW1iZXIpLmxlbmd0aDtcblx0fVxuXG5cdGdldCBsZW5ndGgoKTogVGV4dExlbmd0aCB7XG5cdFx0Y29uc3QgbGFzdExpbmUgPSB0aGlzLl9nZXRMaW5lQ29udGVudCh0aGlzLl9saW5lQ291bnQpO1xuXHRcdHJldHVybiBuZXcgVGV4dExlbmd0aCh0aGlzLl9saW5lQ291bnQgLSAxLCBsYXN0TGluZS5sZW5ndGgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBcnJheVRleHQgZXh0ZW5kcyBMaW5lQmFzZWRUZXh0IHtcblx0Y29uc3RydWN0b3IobGluZXM6IHN0cmluZ1tdKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHRsaW5lTnVtYmVyID0+IGxpbmVzW2xpbmVOdW1iZXIgLSAxXSxcblx0XHRcdGxpbmVzLmxlbmd0aFxuXHRcdCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0cmluZ1RleHQgZXh0ZW5kcyBBYnN0cmFjdFRleHQge1xuXHRwcml2YXRlIHJlYWRvbmx5IF90ID0gbmV3IFBvc2l0aW9uT2Zmc2V0VHJhbnNmb3JtZXIodGhpcy52YWx1ZSk7XG5cblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHZhbHVlOiBzdHJpbmcpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0Z2V0VmFsdWVPZlJhbmdlKHJhbmdlOiBSYW5nZSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3QuZ2V0T2Zmc2V0UmFuZ2UocmFuZ2UpLnN1YnN0cmluZyh0aGlzLnZhbHVlKTtcblx0fVxuXG5cdGdldCBsZW5ndGgoKTogVGV4dExlbmd0aCB7XG5cdFx0cmV0dXJuIHRoaXMuX3QudGV4dExlbmd0aDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsUUFBUSxVQUFVLDBCQUEwQjtBQUNyRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9CQUFvQixvQkFBb0Isa0JBQWtCO0FBSW5FLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsYUFBYTtBQUN0QixTQUFTLGtCQUFrQjtBQUVwQixNQUFNLFNBQVM7QUFBQSxFQWNyQixZQUE0QixPQUFrQztBQUFsQztBQUMzQixhQUFTLE1BQU0sbUJBQW1CLE9BQU8sQ0FBQyxHQUFHLE1BQU0sRUFBRSxNQUFNLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlCQUFpQixDQUFDLENBQUMsQ0FBQztBQUFBLEVBQ3pIO0FBQUEsRUFmQSxPQUFjLGVBQWUsTUFBa0IsY0FBc0M7QUFDcEYsVUFBTSxRQUFRLEtBQUssTUFBTSxJQUFJLE9BQUssSUFBSSxlQUFlLGFBQWEsZUFBZSxFQUFFLFNBQVMsRUFBRSxZQUFZLEdBQUcsRUFBRSxPQUFPLENBQUM7QUFDdkgsV0FBTyxJQUFJLFNBQVMsS0FBSztBQUFBLEVBQzFCO0FBQUEsRUFFQSxPQUFjLE9BQU8sZUFBc0IsU0FBMkI7QUFDckUsV0FBTyxJQUFJLFNBQVMsQ0FBQyxJQUFJLGVBQWUsZUFBZSxPQUFPLENBQUMsQ0FBQztBQUFBLEVBQ2pFO0FBQUEsRUFFQSxPQUFjLE9BQU8sVUFBb0IsU0FBMkI7QUFDbkUsV0FBTyxJQUFJLFNBQVMsQ0FBQyxJQUFJLGVBQWUsTUFBTSxjQUFjLFVBQVUsUUFBUSxHQUFHLE9BQU8sQ0FBQyxDQUFDO0FBQUEsRUFDM0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVNBLFlBQXNCO0FBQ3JCLFVBQU0sUUFBMEIsQ0FBQztBQUNqQyxlQUFXLFFB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
