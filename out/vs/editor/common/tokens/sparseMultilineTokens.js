import { CharCode } from "../../../base/common/charCode.js";
import { Position } from "../core/position.js";
import { Range } from "../core/range.js";
import { countEOL } from "../core/eolCounter.js";
class SparseMultilineTokens {
  static create(startLineNumber, tokens) {
    return new SparseMultilineTokens(startLineNumber, new SparseMultilineTokensStorage(tokens));
  }
  /**
   * (Inclusive) start line number for these tokens.
   */
  get startLineNumber() {
    return this._startLineNumber;
  }
  /**
   * (Inclusive) end line number for these tokens.
   */
  get endLineNumber() {
    return this._endLineNumber;
  }
  constructor(startLineNumber, tokens) {
    this._startLineNumber = startLineNumber;
    this._tokens = tokens;
    this._endLineNumber = this._startLineNumber + this._tokens.getMaxDeltaLine();
  }
  toString() {
    return this._tokens.toString(this._startLineNumber);
  }
  _updateEndLineNumber() {
    this._endLineNumber = this._startLineNumber + this._tokens.getMaxDeltaLine();
  }
  isEmpty() {
    return this._tokens.isEmpty();
  }
  getLineTokens(lineNumber) {
    if (this._startLineNumber <= lineNumber && lineNumber <= this._endLineNumber) {
      return this._tokens.getLineTokens(lineNumber - this._startLineNumber);
    }
    return null;
  }
  getRange() {
    const deltaRange = this._tokens.getRange();
    if (!deltaRange) {
      return deltaRange;
    }
    return new Range(this._startLineNumber + deltaRange.startLineNumber, deltaRange.startColumn, this._startLineNumber + deltaRange.endLineNumber, deltaRange.endColumn);
  }
  removeTokens(range) {
    const startLineIndex = range.startLineNumber - this._startLineNumber;
    const endLineIndex = range.endLineNumber - this._startLineNumber;
    this._startLineNumber += this._tokens.removeTokens(startLineIndex, range.startColumn - 1, endLineIndex, range.endColumn - 1);
    this._updateEndLineNumber();
  }
  split(range) {
    const startLineIndex = range.startLineNumber - this._startLineNumber;
    const endLineIndex = range.endLineNumber - this._startLineNumber;
    const [a, b, bDeltaLine] = this._tokens.split(startLineIndex, range.startColumn - 1, endLineIndex, range.endColumn - 1);
    return [new SparseMultilineTokens(this._startLineNumber, a), new SparseMultilineTokens(this._startLineNumber + bDeltaLine, b)];
  }
  applyEdit(range, text) {
    const [eolCount, firstLineLength, lastLineLength] = countEOL(text);
    this.acceptEdit(range, eolCount, firstLineLength, lastLineLength, text.length > 0 ? text.charCodeAt(0) : CharCode.Null);
  }
  acceptEdit(range, eolCount, firstLineLength, lastLineLength, firstCharCode) {
    this._acceptDeleteRange(range);
    this._acceptInsertText(new Position(range.startLineNumber, range.startColumn), eolCount, firstLineLength, lastLineLength, firstCharCode);
    this._updateEndLineNumber();
  }
  _acceptDeleteRange(range) {
    if (range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn) {
      return;
    }
    const firstLineIndex = range.startLineNumber - this._startLineNumber;
    const lastLineIndex = range.endLineNumber - this._startLineNumber;
    if (lastLineIndex < 0) {
      const deletedLinesCount = lastLineIndex - firstLineIndex;
      this._startLineNumber -= deletedLinesCount;
      return;
    }
    const tokenMaxDeltaLine = this._tokens.getMaxDeltaLine();
    if (firstLineIndex >= tokenMaxDeltaLine + 1) {
      return;
    }
    if (firstLineIndex < 0 && lastLineIndex >= tokenMaxDeltaLine + 1) {
      this._startLineNumber = 0;
      this._tokens.clear();
      return;
    }
    if (firstLineIndex < 0) {
      const deletedBefore = -firstLineIndex;
      this._startLineNumber -= deletedBefore;
      this._tokens.acceptDeleteRange(range.startColumn - 1, 0, 0, lastLineIndex, range.endColumn - 1);
    } else {
      this._tokens.acceptDeleteRange(0, firstLineIndex, range.startColumn - 1, lastLineIndex, range.endColumn - 1);
    }
  }
  _acceptInsertText(position, eolCount, firstLineLength, lastLineLength, firstCharCode) {
    if (eolCount === 0 && firstLineLength === 0) {
      return;
    }
    const lineIndex = position.lineNumber - this._startLineNumber;
    if (lineIndex < 0) {
      this._startLineNumber += eolCount;
      return;
    }
    const tokenMaxDeltaLine = this._tokens.getMaxDeltaLine();
    if (lineIndex >= tokenMaxDeltaLine + 1) {
      return;
    }
    this._tokens.acceptInsertText(lineIndex, position.column - 1, eolCount, firstLineLength, lastLineLength, firstCharCode);
  }
}
class SparseMultilineTokensStorage {
  constructor(tokens) {
    this._tokens = tokens;
    this._tokenCount = tokens.length / 4;
  }
  toString(startLineNumber) {
    const pieces = [];
    for (let i = 0; i < this._tokenCount; i++) {
      pieces.push(`(${this._getDeltaLine(i) + startLineNumber},${this._getStartCharacter(i)}-${this._getEndCharacter(i)})`);
    }
    return `[${pieces.join(",")}]`;
  }
  getMaxDeltaLine() {
    const tokenCount = this._getTokenCount();
    if (tokenCount === 0) {
      return -1;
    }
    return this._getDeltaLine(tokenCount - 1);
  }
  getRange() {
    const tokenCount = this._getTokenCount();
    if (tokenCount === 0) {
      return null;
    }
    const startChar = this._getStartCharacter(0);
    const maxDeltaLine = this._getDeltaLine(tokenCount - 1);
    const endChar = this._getEndCharacter(tokenCount - 1);
    return new Range(0, startChar + 1, maxDeltaLine, endChar + 1);
  }
  _getTokenCount() {
    return this._tokenCount;
  }
  _getDeltaLine(tokenIndex) {
    return this._tokens[4 * tokenIndex];
  }
  _getStartCharacter(tokenIndex) {
    return this._tokens[4 * tokenIndex + 1];
  }
  _getEndCharacter(tokenIndex) {
    return this._tokens[4 * tokenIndex + 2];
  }
  isEmpty() {
    return this._getTokenCount() === 0;
  }
  getLineTokens(deltaLine) {
    let low = 0;
    let high = this._getTokenCount() - 1;
    while (low < high) {
      const mid = low + Math.floor((high - low) / 2);
      const midDeltaLine = this._getDeltaLine(mid);
      if (midDeltaLine < deltaLine) {
        low = mid + 1;
      } else if (midDeltaLine > deltaLine) {
        high = mid - 1;
      } else {
        let min = mid;
        while (min > low && this._getDeltaLine(min - 1) === deltaLine) {
          min--;
        }
        let max = mid;
        while (max < high && this._getDeltaLine(max + 1) === deltaLine) {
          max++;
        }
        return new SparseLineTokens(this._tokens.subarray(4 * min, 4 * max + 4));
      }
    }
    if (this._getDeltaLine(low) === deltaLine) {
      return new SparseLineTokens(this._tokens.subarray(4 * low, 4 * low + 4));
    }
    return null;
  }
  clear() {
    this._tokenCount = 0;
  }
  removeTokens(startDeltaLine, startChar, endDeltaLine, endChar) {
    const tokens = this._tokens;
    const tokenCount = this._tokenCount;
    let newTokenCount = 0;
    let hasDeletedTokens = false;
    let firstDeltaLine = 0;
    for (let i = 0; i < tokenCount; i++) {
      const srcOffset = 4 * i;
      const tokenDeltaLine = tokens[srcOffset];
      const tokenStartCharacter = tokens[srcOffset + 1];
      const tokenEndCharacter = tokens[srcOffset + 2];
      const tokenMetadata = tokens[srcOffset + 3];
      if ((tokenDeltaLine > startDeltaLine || tokenDeltaLine === startDeltaLine && tokenEndCharacter >= startChar) && (tokenDeltaLine < endDeltaLine || tokenDeltaLine === endDeltaLine && tokenStartCharacter <= endChar)) {
        hasDeletedTokens = true;
      } else {
        if (newTokenCount === 0) {
          firstDeltaLine = tokenDeltaLine;
        }
        if (hasDeletedTokens) {
          const destOffset = 4 * newTokenCount;
          tokens[destOffset] = tokenDeltaLine - firstDeltaLine;
          tokens[destOffset + 1] = tokenStartCharacter;
          tokens[destOffset + 2] = tokenEndCharacter;
          tokens[destOffset + 3] = tokenMetadata;
        }
        newTokenCount++;
      }
    }
    this._tokenCount = newTokenCount;
    return firstDeltaLine;
  }
  split(startDeltaLine, startChar, endDeltaLine, endChar) {
    const tokens = this._tokens;
    const tokenCount = this._tokenCount;
    const aTokens = [];
    const bTokens = [];
    let destTokens = aTokens;
    let destOffset = 0;
    let destFirstDeltaLine = 0;
    for (let i = 0; i < tokenCount; i++) {
      const srcOffset = 4 * i;
      const tokenDeltaLine = tokens[srcOffset];
      const tokenStartCharacter = tokens[srcOffset + 1];
      const tokenEndCharacter = tokens[srcOffset + 2];
      const tokenMetadata = tokens[srcOffset + 3];
      if (tokenDeltaLine > startDeltaLine || tokenDeltaLine === startDeltaLine && tokenEndCharacter >= startChar) {
        if (tokenDeltaLine < endDeltaLine || tokenDeltaLine === endDeltaLine && tokenStartCharacter <= endChar) {
          continue;
        } else {
          if (destTokens !== bTokens) {
            destTokens = bTokens;
            destOffset = 0;
            destFirstDeltaLine = tokenDeltaLine;
          }
        }
      }
      destTokens[destOffset++] = tokenDeltaLine - destFirstDeltaLine;
      destTokens[destOffset++] = tokenStartCharacter;
      destTokens[destOffset++] = tokenEndCharacter;
      destTokens[destOffset++] = tokenMetadata;
    }
    return [new SparseMultilineTokensStorage(new Uint32Array(aTokens)), new SparseMultilineTokensStorage(new Uint32Array(bTokens)), destFirstDeltaLine];
  }
  acceptDeleteRange(horizontalShiftForFirstLineTokens, startDeltaLine, startCharacter, endDeltaLine, endCharacter) {
    const tokens = this._tokens;
    const tokenCount = this._tokenCount;
    const deletedLineCount = endDeltaLine - startDeltaLine;
    let newTokenCount = 0;
    let hasDeletedTokens = false;
    for (let i = 0; i < tokenCount; i++) {
      const srcOffset = 4 * i;
      let tokenDeltaLine = tokens[srcOffset];
      let tokenStartCharacter = tokens[srcOffset + 1];
      let tokenEndCharacter = tokens[srcOffset + 2];
      const tokenMetadata = tokens[srcOffset + 3];
      if (tokenDeltaLine < startDeltaLine || tokenDeltaLine === startDeltaLine && tokenEndCharacter <= startCharacter) {
        newTokenCount++;
        continue;
      } else if (tokenDeltaLine === startDeltaLine && tokenStartCharacter < startCharacter) {
        if (tokenDeltaLine === endDeltaLine && tokenEndCharacter > endCharacter) {
          tokenEndCharacter -= endCharacter - startCharacter;
        } else {
          tokenEndCharacter = startCharacter;
        }
      } else if (tokenDeltaLine === startDeltaLine && tokenStartCharacter === startCharacter) {
        if (tokenDeltaLine === endDeltaLine && tokenEndCharacter > endCharacter) {
          tokenEndCharacter -= endCharacter - startCharacter;
        } else {
          hasDeletedTokens = true;
          continue;
        }
      } else if (tokenDeltaLine < endDeltaLine || tokenDeltaLine === endDeltaLine && tokenStartCharacter < endCharacter) {
        if (tokenDeltaLine === endDeltaLine && tokenEndCharacter > endCharacter) {
          tokenDeltaLine = startDeltaLine;
          tokenStartCharacter = startCharacter;
          tokenEndCharacter = tokenStartCharacter + (tokenEndCharacter - endCharacter);
        } else {
          hasDeletedTokens = true;
          continue;
        }
      } else if (tokenDeltaLine > endDeltaLine) {
        if (deletedLineCount === 0 && !hasDeletedTokens) {
          newTokenCount = tokenCount;
          break;
        }
        tokenDeltaLine -= deletedLineCount;
      } else if (tokenDeltaLine === endDeltaLine && tokenStartCharacter >= endCharacter) {
        if (horizontalShiftForFirstLineTokens && tokenDeltaLine === 0) {
          tokenStartCharacter += horizontalShiftForFirstLineTokens;
          tokenEndCharacter += horizontalShiftForFirstLineTokens;
        }
        tokenDeltaLine -= deletedLineCount;
        tokenStartCharacter -= endCharacter - startCharacter;
        tokenEndCharacter -= endCharacter - startCharacter;
      } else {
        throw new Error(`Not possible!`);
      }
      const destOffset = 4 * newTokenCount;
      tokens[destOffset] = tokenDeltaLine;
      tokens[destOffset + 1] = tokenStartCharacter;
      tokens[destOffset + 2] = tokenEndCharacter;
      tokens[destOffset + 3] = tokenMetadata;
      newTokenCount++;
    }
    this._tokenCount = newTokenCount;
  }
  acceptInsertText(deltaLine, character, eolCount, firstLineLength, lastLineLength, firstCharCode) {
    const isInsertingPreciselyOneWordCharacter = eolCount === 0 && firstLineLength === 1 && (firstCharCode >= CharCode.Digit0 && firstCharCode <= CharCode.Digit9 || firstCharCode >= CharCode.A && firstCharCode <= CharCode.Z || firstCharCode >= CharCode.a && firstCharCode <= CharCode.z);
    const tokens = this._tokens;
    const tokenCount = this._tokenCount;
    for (let i = 0; i < tokenCount; i++) {
      const offset = 4 * i;
      let tokenDeltaLine = tokens[offset];
      let tokenStartCharacter = tokens[offset + 1];
      let tokenEndCharacter = tokens[offset + 2];
      if (tokenDeltaLine < deltaLine || tokenDeltaLine === deltaLine && tokenEndCharacter < character) {
        continue;
      } else if (tokenDeltaLine === deltaLine && tokenEndCharacter === character) {
        if (isInsertingPreciselyOneWordCharacter) {
          tokenEndCharacter += 1;
        } else {
          continue;
        }
      } else if (tokenDeltaLine === deltaLine && tokenStartCharacter < character && character < tokenEndCharacter) {
        if (eolCount === 0) {
          tokenEndCharacter += firstLineLength;
        } else {
          tokenEndCharacter = character;
        }
      } else {
        if (tokenDeltaLine === deltaLine && tokenStartCharacter === character) {
          if (isInsertingPreciselyOneWordCharacter) {
            continue;
          }
        }
        if (tokenDeltaLine === deltaLine) {
          tokenDeltaLine += eolCount;
          if (eolCount === 0) {
            tokenStartCharacter += firstLineLength;
            tokenEndCharacter += firstLineLength;
          } else {
            const tokenLength = tokenEndCharacter - tokenStartCharacter;
            tokenStartCharacter = lastLineLength + (tokenStartCharacter - character);
            tokenEndCharacter = tokenStartCharacter + tokenLength;
          }
        } else {
          tokenDeltaLine += eolCount;
        }
      }
      tokens[offset] = tokenDeltaLine;
      tokens[offset + 1] = tokenStartCharacter;
      tokens[offset + 2] = tokenEndCharacter;
    }
  }
}
class SparseLineTokens {
  constructor(tokens) {
    this._tokens = tokens;
  }
  getCount() {
    return this._tokens.length / 4;
  }
  getStartCharacter(tokenIndex) {
    return this._tokens[4 * tokenIndex + 1];
  }
  getEndCharacter(tokenIndex) {
    return this._tokens[4 * tokenIndex + 2];
  }
  getMetadata(tokenIndex) {
    return this._tokens[4 * tokenIndex + 3];
  }
}
export {
  SparseLineTokens,
  SparseMultilineTokens
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3Rva2Vucy9zcGFyc2VNdWx0aWxpbmVUb2tlbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NoYXJDb2RlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBjb3VudEVPTCB9IGZyb20gJy4uL2NvcmUvZW9sQ291bnRlci5qcyc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBzcGFyc2UgdG9rZW5zIG92ZXIgYSBjb250aWd1b3VzIHJhbmdlIG9mIGxpbmVzLlxuICovXG5leHBvcnQgY2xhc3MgU3BhcnNlTXVsdGlsaW5lVG9rZW5zIHtcblxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZShzdGFydExpbmVOdW1iZXI6IG51bWJlciwgdG9rZW5zOiBVaW50MzJBcnJheSk6IFNwYXJzZU11bHRpbGluZVRva2VucyB7XG5cdFx0cmV0dXJuIG5ldyBTcGFyc2VNdWx0aWxpbmVUb2tlbnMoc3RhcnRMaW5lTnVtYmVyLCBuZXcgU3BhcnNlTXVsdGlsaW5lVG9rZW5zU3RvcmFnZSh0b2tlbnMpKTtcblx0fVxuXG5cdHByaXZhdGUgX3N0YXJ0TGluZU51bWJlcjogbnVtYmVyO1xuXHRwcml2YXRlIF9lbmRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Rva2VuczogU3BhcnNlTXVsdGlsaW5lVG9rZW5zU3RvcmFnZTtcblxuXHQvKipcblx0ICogKEluY2x1c2l2ZSkgc3RhcnQgbGluZSBudW1iZXIgZm9yIHRoZXNlIHRva2Vucy5cblx0ICovXG5cdHB1YmxpYyBnZXQgc3RhcnRMaW5lTnVtYmVyKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXJ0TGluZU51bWJlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiAoSW5jbHVzaXZlKSBlbmQgbGluZSBudW1iZXIgZm9yIHRoZXNlIHRva2Vucy5cblx0ICovXG5cdHB1YmxpYyBnZXQgZW5kTGluZU51bWJlcigpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9lbmRMaW5lTnVtYmVyO1xuXHR9XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcihzdGFydExpbmVOdW1iZXI6IG51bWJlciwgdG9rZW5zOiBTcGFyc2VNdWx0aWxpbmVUb2tlbnNTdG9yYWdlKSB7XG5cdFx0dGhpcy5fc3RhcnRMaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyO1xuXHRcdHRoaXMuX3Rva2VucyA9IHRva2Vucztcblx0XHR0aGlzLl9lbmRMaW5lTnVtYmVyID0gdGhpcy5fc3RhcnRMaW5lTnVtYmVyICsgdGhpcy5fdG9rZW5zLmdldE1heERlbHRhTGluZSgpO1xuXHR9XG5cblx0cHVibGljIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy50b1N0cmluZyh0aGlzLl9zdGFydExpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRW5kTGluZU51bWJlcigpOiB2b2lkIHtcblx0XHR0aGlzLl9lbmRMaW5lTnVtYmVyID0gdGhpcy5fc3RhcnRMaW5lTnVtYmVyICsgdGhpcy5fdG9rZW5zLmdldE1heERlbHRhTGluZSgpO1xuXHR9XG5cblx0cHVibGljIGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy5pc0VtcHR5KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZVRva2VucyhsaW5lTnVtYmVyOiBudW1iZXIpOiBTcGFyc2VMaW5lVG9rZW5zIHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuX3N0YXJ0TGluZU51bWJlciA8PSBsaW5lTnVtYmVyICYmIGxpbmVOdW1iZXIgPD0gdGhpcy5fZW5kTGluZU51bWJlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy5nZXRMaW5lVG9rZW5zKGxpbmVOdW1iZXIgLSB0aGlzLl9zdGFydExpbmVOdW1iZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBnZXRSYW5nZSgpOiBSYW5nZSB8IG51bGwge1xuXHRcdGNvbnN0IGRlbHRhUmFuZ2UgPSB0aGlzLl90b2tlbnMuZ2V0UmFuZ2UoKTtcblx0XHRpZiAoIWRlbHRhUmFuZ2UpIHtcblx0XHRcdHJldHVybiBkZWx0YVJhbmdlO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFJhbmdlKHRoaXMuX3N0YXJ0TGluZU51bWJlciArIGRlbHRhUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBkZWx0YVJhbmdlLnN0YXJ0Q29sdW1uLCB0aGlzLl9zdGFydExpbmVOdW1iZXIgKyBkZWx0YVJhbmdlLmVuZExpbmVOdW1iZXIsIGRlbHRhUmFuZ2UuZW5kQ29sdW1uKTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVUb2tlbnMocmFuZ2U6IFJhbmdlKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lSW5kZXggPSByYW5nZS5zdGFydExpbmVOdW1iZXIgLSB0aGlzLl9zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgZW5kTGluZUluZGV4ID0gcmFuZ2UuZW5kTGluZU51bWJlciAtIHRoaXMuX3N0YXJ0TGluZU51bWJlcjtcblxuXHRcdHRoaXMuX3N0YXJ0TGluZU51bWJlciArPSB0aGlzLl90b2tlbnMucmVtb3ZlVG9rZW5zKHN0YXJ0TGluZUluZGV4LCByYW5nZS5zdGFydENvbHVtbiAtIDEsIGVuZExpbmVJbmRleCwgcmFuZ2UuZW5kQ29sdW1uIC0gMSk7XG5cdFx0dGhpcy5fdXBkYXRlRW5kTGluZU51bWJlcigpO1xuXHR9XG5cblx0cHVibGljIHNwbGl0KHJhbmdlOiBSYW5nZSk6IFtTcGFyc2VNdWx0aWxpbmVUb2tlbnMsIFNwYXJzZU11bHRpbGluZVRva2Vuc10ge1xuXHRcdC8vIHNwbGl0IHRva2VucyB0byB0d286XG5cdFx0Ly8gYSkgYWxsIHRoZSB0b2tlbnMgYmVmb3JlIGByYW5nZWBcblx0XHQvLyBiKSBhbGwgdGhlIHRva2VucyBhZnRlciBgcmFuZ2VgXG5cdFx0Y29uc3Qgc3RhcnRMaW5lSW5kZXggPSByYW5nZS5zdGFydExpbmVOdW1iZXIgLSB0aGlzLl9zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgZW5kTGluZUluZGV4ID0gcmFuZ2UuZW5kTGluZU51bWJlciAtIHRoaXMuX3N0YXJ0TGluZU51bWJlcjtcblxuXHRcdGNvbnN0IFthLCBiLCBiRGVsdGFMaW5lXSA9IHRoaXMuX3Rva2Vucy5zcGxpdChzdGFydExpbmVJbmRleCwgcmFuZ2Uuc3RhcnRDb2x1bW4gLSAxLCBlbmRMaW5lSW5kZXgsIHJhbmdlLmVuZENvbHVtbiAtIDEpO1xuXHRcdHJldHVybiBbbmV3IFNwYXJzZU11bHRpbGluZVRva2Vucyh0aGlzLl9zdGFydExpbmVOdW1iZXIsIGEpLCBuZXcgU3BhcnNlTXVsdGlsaW5lVG9rZW5zKHRoaXMuX3N0YXJ0TGluZU51bWJlciArIGJEZWx0YUxpbmUsIGIpXTtcblx0fVxuXG5cdHB1YmxpYyBhcHBseUVkaXQocmFuZ2U6IElSYW5nZSwgdGV4dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgW2VvbENvdW50LCBmaXJzdExpbmVMZW5ndGgsIGxhc3RMaW5lTGVuZ3RoXSA9IGNvdW50RU9MKHRleHQpO1xuXHRcdHRoaXMuYWNjZXB0RWRpdChyYW5nZSwgZW9sQ291bnQsIGZpcnN0TGluZUxlbmd0aCwgbGFzdExpbmVMZW5ndGgsIHRleHQubGVuZ3RoID4gMCA/IHRleHQuY2hhckNvZGVBdCgwKSA6IENoYXJDb2RlLk51bGwpO1xuXHR9XG5cblx0cHVibGljIGFjY2VwdEVkaXQocmFuZ2U6IElSYW5nZSwgZW9sQ291bnQ6IG51bWJlciwgZmlyc3RMaW5lTGVuZ3RoOiBudW1iZXIsIGxhc3RMaW5lTGVuZ3RoOiBudW1iZXIsIGZpcnN0Q2hhckNvZGU6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2FjY2VwdERlbGV0ZVJhbmdlKHJhbmdlKTtcblx0XHR0aGlzLl9hY2NlcHRJbnNlcnRUZXh0KG5ldyBQb3NpdGlvbihyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uKSwgZW9sQ291bnQsIGZpcnN0TGluZUxlbmd0aCwgbGFzdExpbmVMZW5ndGgsIGZpcnN0Q2hhckNvZGUpO1xuXHRcdHRoaXMuX3VwZGF0ZUVuZExpbmVOdW1iZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgX2FjY2VwdERlbGV0ZVJhbmdlKHJhbmdlOiBJUmFuZ2UpOiB2b2lkIHtcblx0XHRpZiAocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSByYW5nZS5lbmRMaW5lTnVtYmVyICYmIHJhbmdlLnN0YXJ0Q29sdW1uID09PSByYW5nZS5lbmRDb2x1bW4pIHtcblx0XHRcdC8vIE5vdGhpbmcgdG8gZGVsZXRlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlyc3RMaW5lSW5kZXggPSByYW5nZS5zdGFydExpbmVOdW1iZXIgLSB0aGlzLl9zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgbGFzdExpbmVJbmRleCA9IHJhbmdlLmVuZExpbmVOdW1iZXIgLSB0aGlzLl9zdGFydExpbmVOdW1iZXI7XG5cblx0XHRpZiAobGFzdExpbmVJbmRleCA8IDApIHtcblx0XHRcdC8vIHRoaXMgZGVsZXRpb24gb2NjdXJzIGVudGlyZWx5IGJlZm9yZSB0aGlzIGJsb2NrLCBzbyB3ZSBvbmx5IG5lZWQgdG8gYWRqdXN0IGxpbmUgbnVtYmVyc1xuXHRcdFx0Y29uc3QgZGVsZXRlZExpbmVzQ291bnQgPSBsYXN0TGluZUluZGV4IC0gZmlyc3RMaW5lSW5kZXg7XG5cdFx0XHR0aGlzLl9zdGFydExpbmVOdW1iZXIgLT0gZGVsZXRlZExpbmVzQ291bnQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9rZW5NYXhEZWx0YUxpbmUgPSB0aGlzLl90b2tlbnMuZ2V0TWF4RGVsdGFMaW5lKCk7XG5cblx0XHRpZiAoZmlyc3RMaW5lSW5kZXggPj0gdG9rZW5NYXhEZWx0YUxpbmUgKyAxKSB7XG5cdFx0XHQvLyB0aGlzIGRlbGV0aW9uIG9jY3VycyBlbnRpcmVseSBhZnRlciB0aGlzIGJsb2NrLCBzbyB0aGVyZSBpcyBub3RoaW5nIHRvIGRvXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGZpcnN0TGluZUluZGV4IDwgMCAmJiBsYXN0TGluZUluZGV4ID49IHRva2VuTWF4RGVsdGFMaW5lICsgMSkge1xuXHRcdFx0Ly8gdGhpcyBkZWxldGlvbiBjb21wbGV0ZWx5IGVuY29tcGFzc2VzIHRoaXMgYmxvY2tcblx0XHRcdHRoaXMuX3N0YXJ0TGluZU51bWJlciA9IDA7XG5cdFx0XHR0aGlzLl90b2tlbnMuY2xlYXIoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZmlyc3RMaW5lSW5kZXggPCAwKSB7XG5cdFx0XHRjb25zdCBkZWxldGVkQmVmb3JlID0gLWZpcnN0TGluZUluZGV4O1xuXHRcdFx0dGhpcy5fc3RhcnRMaW5lTnVtYmVyIC09IGRlbGV0ZWRCZWZvcmU7XG5cblx0XHRcdHRoaXMuX3Rva2Vucy5hY2NlcHREZWxldGVSYW5nZShyYW5nZS5zdGFydENvbHVtbiAtIDEsIDAsIDAsIGxhc3RMaW5lSW5kZXgsIHJhbmdlLmVuZENvbHVtbiAtIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl90b2tlbnMuYWNjZXB0RGVsZXRlUmFuZ2UoMCwgZmlyc3RMaW5lSW5kZXgsIHJhbmdlLnN0YXJ0Q29sdW1uIC0gMSwgbGFzdExpbmVJbmRleCwgcmFuZ2UuZW5kQ29sdW1uIC0gMSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfYWNjZXB0SW5zZXJ0VGV4dChwb3NpdGlvbjogUG9zaXRpb24sIGVvbENvdW50OiBudW1iZXIsIGZpcnN0TGluZUxlbmd0aDogbnVtYmVyLCBsYXN0TGluZUxlbmd0aDogbnVtYmVyLCBmaXJzdENoYXJDb2RlOiBudW1iZXIpOiB2b2lkIHtcblxuXHRcdGlmIChlb2xDb3VudCA9PT0gMCAmJiBmaXJzdExpbmVMZW5ndGggPT09IDApIHtcblx0XHRcdC8vIE5vdGhpbmcgdG8gaW5zZXJ0XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZUluZGV4ID0gcG9zaXRpb24ubGluZU51bWJlciAtIHRoaXMuX3N0YXJ0TGluZU51bWJlcjtcblxuXHRcdGlmIChsaW5lSW5kZXggPCAwKSB7XG5cdFx0XHQvLyB0aGlzIGluc2VydGlvbiBvY2N1cnMgYmVmb3JlIHRoaXMgYmxvY2ssIHNvIHdlIG9ubHkgbmVlZCB0byBhZGp1c3QgbGluZSBudW1iZXJzXG5cdFx0XHR0aGlzLl9zdGFydExpbmVOdW1iZXIgKz0gZW9sQ291bnQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9rZW5NYXhEZWx0YUxpbmUgPSB0aGlzLl90b2tlbnMuZ2V0TWF4RGVsdGFMaW5lKCk7XG5cblx0XHRpZiAobGluZUluZGV4ID49IHRva2VuTWF4RGVsdGFMaW5lICsgMSkge1xuXHRcdFx0Ly8gdGhpcyBpbnNlcnRpb24gb2NjdXJzIGFmdGVyIHRoaXMgYmxvY2ssIHNvIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG9cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl90b2tlbnMuYWNjZXB0SW5zZXJ0VGV4dChsaW5lSW5kZXgsIHBvc2l0aW9uLmNvbHVtbiAtIDEsIGVvbENvdW50LCBmaXJzdExpbmVMZW5ndGgsIGxhc3RMaW5lTGVuZ3RoLCBmaXJzdENoYXJDb2RlKTtcblx0fVxufVxuXG5jbGFzcyBTcGFyc2VNdWx0aWxpbmVUb2tlbnNTdG9yYWdlIHtcblx0LyoqXG5cdCAqIFRoZSBlbmNvZGluZyBvZiB0b2tlbnMgaXM6XG5cdCAqICA0KmkgICAgZGVsdGFMaW5lIChmcm9tIGBzdGFydExpbmVOdW1iZXJgKVxuXHQgKiAgNCppKzEgIHN0YXJ0Q2hhcmFjdGVyIChmcm9tIHRoZSBsaW5lIHN0YXJ0KVxuXHQgKiAgNCppKzIgIGVuZENoYXJhY3RlciAoZnJvbSB0aGUgbGluZSBzdGFydClcblx0ICogIDQqaSszICBtZXRhZGF0YVxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW5zOiBVaW50MzJBcnJheTtcblx0cHJpdmF0ZSBfdG9rZW5Db3VudDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKHRva2VuczogVWludDMyQXJyYXkpIHtcblx0XHR0aGlzLl90b2tlbnMgPSB0b2tlbnM7XG5cdFx0dGhpcy5fdG9rZW5Db3VudCA9IHRva2Vucy5sZW5ndGggLyA0O1xuXHR9XG5cblx0cHVibGljIHRvU3RyaW5nKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRjb25zdCBwaWVjZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl90b2tlbkNvdW50OyBpKyspIHtcblx0XHRcdHBpZWNlcy5wdXNoKGAoJHt0aGlzLl9nZXREZWx0YUxpbmUoaSkgKyBzdGFydExpbmVOdW1iZXJ9LCR7dGhpcy5fZ2V0U3RhcnRDaGFyYWN0ZXIoaSl9LSR7dGhpcy5fZ2V0RW5kQ2hhcmFjdGVyKGkpfSlgKTtcblx0XHR9XG5cdFx0cmV0dXJuIGBbJHtwaWVjZXMuam9pbignLCcpfV1gO1xuXHR9XG5cblx0cHVibGljIGdldE1heERlbHRhTGluZSgpOiBudW1iZXIge1xuXHRcdGNvbnN0IHRva2VuQ291bnQgPSB0aGlzLl9nZXRUb2tlbkNvdW50KCk7XG5cdFx0aWYgKHRva2VuQ291bnQgPT09IDApIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2dldERlbHRhTGluZSh0b2tlbkNvdW50IC0gMSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UmFuZ2UoKTogUmFuZ2UgfCBudWxsIHtcblx0XHRjb25zdCB0b2tlbkNvdW50ID0gdGhpcy5fZ2V0VG9rZW5Db3VudCgpO1xuXHRcdGlmICh0b2tlbkNvdW50ID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3Qgc3RhcnRDaGFyID0gdGhpcy5fZ2V0U3RhcnRDaGFyYWN0ZXIoMCk7XG5cdFx0Y29uc3QgbWF4RGVsdGFMaW5lID0gdGhpcy5fZ2V0RGVsdGFMaW5lKHRva2VuQ291bnQgLSAxKTtcblx0XHRjb25zdCBlbmRDaGFyID0gdGhpcy5fZ2V0RW5kQ2hhcmFjdGVyKHRva2VuQ291bnQgLSAxKTtcblx0XHRyZXR1cm4gbmV3IFJhbmdlKDAsIHN0YXJ0Q2hhciArIDEsIG1heERlbHRhTGluZSwgZW5kQ2hhciArIDEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VG9rZW5Db3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl90b2tlbkNvdW50O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RGVsdGFMaW5lKHRva2VuSW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vuc1s0ICogdG9rZW5JbmRleF07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRTdGFydENoYXJhY3Rlcih0b2tlbkluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl90b2tlbnNbNCAqIHRva2VuSW5kZXggKyAxXTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEVuZENoYXJhY3Rlcih0b2tlbkluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl90b2tlbnNbNCAqIHRva2VuSW5kZXggKyAyXTtcblx0fVxuXG5cdHB1YmxpYyBpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5fZ2V0VG9rZW5Db3VudCgpID09PSAwKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lVG9rZW5zKGRlbHRhTGluZTogbnVtYmVyKTogU3BhcnNlTGluZVRva2VucyB8IG51bGwge1xuXHRcdGxldCBsb3cgPSAwO1xuXHRcdGxldCBoaWdoID0gdGhpcy5fZ2V0VG9rZW5Db3VudCgpIC0gMTtcblxuXHRcdHdoaWxlIChsb3cgPCBoaWdoKSB7XG5cdFx0XHRjb25zdCBtaWQgPSBsb3cgKyBNYXRoLmZsb29yKChoaWdoIC0gbG93KSAvIDIpO1xuXHRcdFx0Y29uc3QgbWlkRGVsdGFMaW5lID0gdGhpcy5fZ2V0RGVsdGFMaW5lKG1pZCk7XG5cblx0XHRcdGlmIChtaWREZWx0YUxpbmUgPCBkZWx0YUxpbmUpIHtcblx0XHRcdFx0bG93ID0gbWlkICsgMTtcblx0XHRcdH0gZWxzZSBpZiAobWlkRGVsdGFMaW5lID4gZGVsdGFMaW5lKSB7XG5cdFx0XHRcdGhpZ2ggPSBtaWQgLSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGV0IG1pbiA9IG1pZDtcblx0XHRcdFx0d2hpbGUgKG1pbiA+IGxvdyAmJiB0aGlzLl9nZXREZWx0YUxpbmUobWluIC0gMSkgPT09IGRlbHRhTGluZSkge1xuXHRcdFx0XHRcdG1pbi0tO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCBtYXggPSBtaWQ7XG5cdFx0XHRcdHdoaWxlIChtYXggPCBoaWdoICYmIHRoaXMuX2dldERlbHRhTGluZShtYXggKyAxKSA9PT0gZGVsdGFMaW5lKSB7XG5cdFx0XHRcdFx0bWF4Kys7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG5ldyBTcGFyc2VMaW5lVG9rZW5zKHRoaXMuX3Rva2Vucy5zdWJhcnJheSg0ICogbWluLCA0ICogbWF4ICsgNCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9nZXREZWx0YUxpbmUobG93KSA9PT0gZGVsdGFMaW5lKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFNwYXJzZUxpbmVUb2tlbnModGhpcy5fdG9rZW5zLnN1YmFycmF5KDQgKiBsb3csIDQgKiBsb3cgKyA0KSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fdG9rZW5Db3VudCA9IDA7XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlVG9rZW5zKHN0YXJ0RGVsdGFMaW5lOiBudW1iZXIsIHN0YXJ0Q2hhcjogbnVtYmVyLCBlbmREZWx0YUxpbmU6IG51bWJlciwgZW5kQ2hhcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCB0b2tlbnMgPSB0aGlzLl90b2tlbnM7XG5cdFx0Y29uc3QgdG9rZW5Db3VudCA9IHRoaXMuX3Rva2VuQ291bnQ7XG5cdFx0bGV0IG5ld1Rva2VuQ291bnQgPSAwO1xuXHRcdGxldCBoYXNEZWxldGVkVG9rZW5zID0gZmFsc2U7XG5cdFx0bGV0IGZpcnN0RGVsdGFMaW5lID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2VuQ291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3Qgc3JjT2Zmc2V0ID0gNCAqIGk7XG5cdFx0XHRjb25zdCB0b2tlbkRlbHRhTGluZSA9IHRva2Vuc1tzcmNPZmZzZXRdO1xuXHRcdFx0Y29uc3QgdG9rZW5TdGFydENoYXJhY3RlciA9IHRva2Vuc1tzcmNPZmZzZXQgKyAxXTtcblx0XHRcdGNvbnN0IHRva2VuRW5kQ2hhcmFjdGVyID0gdG9rZW5zW3NyY09mZnNldCArIDJdO1xuXHRcdFx0Y29uc3QgdG9rZW5NZXRhZGF0YSA9IHRva2Vuc1tzcmNPZmZzZXQgKyAzXTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQodG9rZW5EZWx0YUxpbmUgPiBzdGFydERlbHRhTGluZSB8fCAodG9rZW5EZWx0YUxpbmUgPT09IHN0YXJ0RGVsdGFMaW5lICYmIHRva2VuRW5kQ2hhcmFjdGVyID49IHN0YXJ0Q2hhcikpXG5cdFx0XHRcdCYmICh0b2tlbkRlbHRhTGluZSA8IGVuZERlbHRhTGluZSB8fCAodG9rZW5EZWx0YUxpbmUgPT09IGVuZERlbHRhTGluZSAmJiB0b2tlblN0YXJ0Q2hhcmFjdGVyIDw9IGVuZENoYXIpKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGhhc0RlbGV0ZWRUb2tlbnMgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKG5ld1Rva2VuQ291bnQgPT09IDApIHtcblx0XHRcdFx0XHRmaXJzdERlbHRhTGluZSA9IHRva2VuRGVsdGFMaW5lO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChoYXNEZWxldGVkVG9rZW5zKSB7XG5cdFx0XHRcdFx0Ly8gbXVzdCBtb3ZlIHRoZSB0b2tlbiB0byB0aGUgbGVmdFxuXHRcdFx0XHRcdGNvbnN0IGRlc3RPZmZzZXQgPSA0ICogbmV3VG9rZW5Db3VudDtcblx0XHRcdFx0XHR0b2tlbnNbZGVzdE9mZnNldF0gPSB0b2tlbkRlbHRhTGluZSAtIGZpcnN0RGVsdGFMaW5lO1xuXHRcdFx0XHRcdHRva2Vuc1tkZXN0T2Zmc2V0ICsgMV0gPSB0b2tlblN0YXJ0Q2hhcmFjdGVyO1xuXHRcdFx0XHRcdHRva2Vuc1tkZXN0T2Zmc2V0ICsgMl0gPSB0b2tlbkVuZENoYXJhY3Rlcjtcblx0XHRcdFx0XHR0b2tlbnNbZGVzdE9mZnNldCArIDNdID0gdG9rZW5NZXRhZGF0YTtcblx0XHRcdFx0fVxuXHRcdFx0XHRuZXdUb2tlbkNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fdG9rZW5Db3VudCA9IG5ld1Rva2VuQ291bnQ7XG5cblx0XHRyZXR1cm4gZmlyc3REZWx0YUxpbmU7XG5cdH1cblxuXHRwdWJsaWMgc3BsaXQoc3RhcnREZWx0YUxpbmU6IG51bWJlciwgc3RhcnRDaGFyOiBudW1iZXIsIGVuZERlbHRhTGluZTogbnVtYmVyLCBlbmRDaGFyOiBudW1iZXIpOiBbU3BhcnNlTXVsdGlsaW5lVG9rZW5zU3RvcmFnZSwgU3BhcnNlTXVsdGlsaW5lVG9rZW5zU3RvcmFnZSwgbnVtYmVyXSB7XG5cdFx0Y29uc3QgdG9rZW5zID0gdGhpcy5fdG9rZW5zO1xuXHRcdGNvbnN0IHRva2VuQ291bnQgPSB0aGlzLl90b2tlbkNvdW50O1xuXHRcdGNvbnN0IGFUb2tlbnM6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3QgYlRva2VuczogbnVtYmVyW10gPSBbXTtcblx0XHRsZXQgZGVzdFRva2VuczogbnVtYmVyW10gPSBhVG9rZW5zO1xuXHRcdGxldCBkZXN0T2Zmc2V0ID0gMDtcblx0XHRsZXQgZGVzdEZpcnN0RGVsdGFMaW5lOiBudW1iZXIgPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5Db3VudDsgaSsrKSB7XG5cdFx0XHRjb25zdCBzcmNPZmZzZXQgPSA0ICogaTtcblx0XHRcdGNvbnN0IHRva2VuRGVsdGFMaW5lID0gdG9rZW5zW3NyY09mZnNldF07XG5cdFx0XHRjb25zdCB0b2tlblN0YXJ0Q2hhcmFjdGVyID0gdG9rZW5zW3NyY09mZnNldCArIDFdO1xuXHRcdFx0Y29uc3QgdG9rZW5FbmRDaGFyYWN0ZXIgPSB0b2tlbnNbc3JjT2Zmc2V0ICsgMl07XG5cdFx0XHRjb25zdCB0b2tlbk1ldGFkYXRhID0gdG9rZW5zW3NyY09mZnNldCArIDNdO1xuXG5cdFx0XHRpZiAoKHRva2VuRGVsdGFMaW5lID4gc3RhcnREZWx0YUxpbmUgfHwgKHRva2VuRGVsdGFMaW5lID09PSBzdGFydERlbHRhTGluZSAmJiB0b2tlbkVuZENoYXJhY3RlciA+PSBzdGFydENoYXIpKSkge1xuXHRcdFx0XHRpZiAoKHRva2VuRGVsdGFMaW5lIDwgZW5kRGVsdGFMaW5lIHx8ICh0b2tlbkRlbHRhTGluZSA9PT0gZW5kRGVsdGFMaW5lICYmIHRva2VuU3RhcnRDaGFyYWN0ZXIgPD0gZW5kQ2hhcikpKSB7XG5cdFx0XHRcdFx0Ly8gdGhpcyB0b2tlbiBpcyB0b3VjaGluZyB0aGUgcmFuZ2Vcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyB0aGlzIHRva2VuIGlzIGFmdGVyIHRoZSByYW5nZVxuXHRcdFx0XHRcdGlmIChkZXN0VG9rZW5zICE9PSBiVG9rZW5zKSB7XG5cdFx0XHRcdFx0XHQvLyB0aGlzIHRva2VuIGlzIHRoZSBmaXJzdCB0b2tlbiBhZnRlciB0aGUgcmFuZ2Vcblx0XHRcdFx0XHRcdGRlc3RUb2tlbnMgPSBiVG9rZW5zO1xuXHRcdFx0XHRcdFx0ZGVzdE9mZnNldCA9IDA7XG5cdFx0XHRcdFx0XHRkZXN0Rmlyc3REZWx0YUxpbmUgPSB0b2tlbkRlbHRhTGluZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZGVzdFRva2Vuc1tkZXN0T2Zmc2V0KytdID0gdG9rZW5EZWx0YUxpbmUgLSBkZXN0Rmlyc3REZWx0YUxpbmU7XG5cdFx0XHRkZXN0VG9rZW5zW2Rlc3RPZmZzZXQrK10gPSB0b2tlblN0YXJ0Q2hhcmFjdGVyO1xuXHRcdFx0ZGVzdFRva2Vuc1tkZXN0T2Zmc2V0KytdID0gdG9rZW5FbmRDaGFyYWN0ZXI7XG5cdFx0XHRkZXN0VG9rZW5zW2Rlc3RPZmZzZXQrK10gPSB0b2tlbk1ldGFkYXRhO1xuXHRcdH1cblxuXHRcdHJldHVybiBbbmV3IFNwYXJzZU11bHRpbGluZVRva2Vuc1N0b3JhZ2UobmV3IFVpbnQzMkFycmF5KGFUb2tlbnMpKSwgbmV3IFNwYXJzZU11bHRpbGluZVRva2Vuc1N0b3JhZ2UobmV3IFVpbnQzMkFycmF5KGJUb2tlbnMpKSwgZGVzdEZpcnN0RGVsdGFMaW5lXTtcblx0fVxuXG5cdHB1YmxpYyBhY2NlcHREZWxldGVSYW5nZShob3Jpem9udGFsU2hpZnRGb3JGaXJzdExpbmVUb2tlbnM6IG51bWJlciwgc3RhcnREZWx0YUxpbmU6IG51bWJlciwgc3RhcnRDaGFyYWN0ZXI6IG51bWJlciwgZW5kRGVsdGFMaW5lOiBudW1iZXIsIGVuZENoYXJhY3RlcjogbnVtYmVyKTogdm9pZCB7XG5cdFx0Ly8gVGhpcyBpcyBhIGJpdCBjb21wbGV4LCBoZXJlIGFyZSB0aGUgY2FzZXMgSSB1c2VkIHRvIHRoaW5rIGFib3V0IHRoaXM6XG5cdFx0Ly9cblx0XHQvLyAxLiBUaGUgdG9rZW4gc3RhcnRzIGJlZm9yZSB0aGUgZGVsZXRpb24gcmFuZ2Vcblx0XHQvLyAxYS4gVGhlIHRva2VuIGlzIGNvbXBsZXRlbHkgYmVmb3JlIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdC8vICAgICAgICAgICAgICAgLS0tLS0tLS0tLS1cblx0XHQvLyAgICAgICAgICAgICAgICAgICAgICAgICAgeHh4eHh4eHh4eHhcblx0XHQvLyAxYi4gVGhlIHRva2VuIHN0YXJ0cyBiZWZvcmUsIHRoZSBkZWxldGlvbiByYW5nZSBlbmRzIGFmdGVyIHRoZSB0b2tlblxuXHRcdC8vICAgICAgICAgICAgICAgLS0tLS0tLS0tLS1cblx0XHQvLyAgICAgICAgICAgICAgICAgICAgICB4eHh4eHh4eHh4eFxuXHRcdC8vIDFjLiBUaGUgdG9rZW4gc3RhcnRzIGJlZm9yZSwgdGhlIGRlbGV0aW9uIHJhbmdlIGVuZHMgcHJlY2lzZWx5IHdpdGggdGhlIHRva2VuXG5cdFx0Ly8gICAgICAgICAgICAgICAtLS0tLS0tLS0tLS0tLS1cblx0XHQvLyAgICAgICAgICAgICAgICAgICAgICB4eHh4eHh4eFxuXHRcdC8vIDFkLiBUaGUgdG9rZW4gc3RhcnRzIGJlZm9yZSwgdGhlIGRlbGV0aW9uIHJhbmdlIGlzIGluc2lkZSB0aGUgdG9rZW5cblx0XHQvLyAgICAgICAgICAgICAgIC0tLS0tLS0tLS0tLS0tLVxuXHRcdC8vICAgICAgICAgICAgICAgICAgICB4eHh4eFxuXHRcdC8vXG5cdFx0Ly8gMi4gVGhlIHRva2VuIHN0YXJ0cyBhdCB0aGUgc2FtZSBwb3NpdGlvbiB3aXRoIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdC8vIDJhLiBUaGUgdG9rZW4gc3RhcnRzIGF0IHRoZSBzYW1lIHBvc2l0aW9uLCBhbmQgZW5kcyBpbnNpZGUgdGhlIGRlbGV0aW9uIHJhbmdlXG5cdFx0Ly8gICAgICAgICAgICAgICAtLS0tLS0tXG5cdFx0Ly8gICAgICAgICAgICAgICB4eHh4eHh4eHh4eFxuXHRcdC8vIDJiLiBUaGUgdG9rZW4gc3RhcnRzIGF0IHRoZSBzYW1lIHBvc2l0aW9uLCBhbmQgZW5kcyBhdCB0aGUgc2FtZSBwb3NpdGlvbiBhcyB0aGUgZGVsZXRpb24gcmFuZ2Vcblx0XHQvLyAgICAgICAgICAgICAgIC0tLS0tLS0tLS1cblx0XHQvLyAgICAgICAgICAgICAgIHh4eHh4eHh4eHhcblx0XHQvLyAyYy4gVGhlIHRva2VuIHN0YXJ0cyBhdCB0aGUgc2FtZSBwb3NpdGlvbiwgYW5kIGVuZHMgYWZ0ZXIgdGhlIGRlbGV0aW9uIHJhbmdlXG5cdFx0Ly8gICAgICAgICAgICAgICAtLS0tLS0tLS0tLS0tXG5cdFx0Ly8gICAgICAgICAgICAgICB4eHh4eHh4XG5cdFx0Ly9cblx0XHQvLyAzLiBUaGUgdG9rZW4gc3RhcnRzIGluc2lkZSB0aGUgZGVsZXRpb24gcmFuZ2Vcblx0XHQvLyAzYS4gVGhlIHRva2VuIGlzIGluc2lkZSB0aGUgZGVsZXRpb24gcmFuZ2Vcblx0XHQvLyAgICAgICAgICAgICAgICAtLS0tLS0tXG5cdFx0Ly8gICAgICAgICAgICAgeHh4eHh4eHh4eHh4eFxuXHRcdC8vIDNiLiBUaGUgdG9rZW4gc3RhcnRzIGluc2lkZSB0aGUgZGVsZXRpb24gcmFuZ2UsIGFuZCBlbmRzIGF0IHRoZSBzYW1lIHBvc2l0aW9uIGFzIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdC8vICAgICAgICAgICAgICAgIC0tLS0tLS0tLS1cblx0XHQvLyAgICAgICAgICAgICB4eHh4eHh4eHh4eHh4XG5cdFx0Ly8gM2MuIFRoZSB0b2tlbiBzdGFydHMgaW5zaWRlIHRoZSBkZWxldGlvbiByYW5nZSwgYW5kIGVuZHMgYWZ0ZXIgdGhlIGRlbGV0aW9uIHJhbmdlXG5cdFx0Ly8gICAgICAgICAgICAgICAgLS0tLS0tLS0tLS0tXG5cdFx0Ly8gICAgICAgICAgICAgeHh4eHh4eHh4eHhcblx0XHQvL1xuXHRcdC8vIDQuIFRoZSB0b2tlbiBzdGFydHMgYWZ0ZXIgdGhlIGRlbGV0aW9uIHJhbmdlXG5cdFx0Ly8gICAgICAgICAgICAgICAgICAtLS0tLS0tLS0tLVxuXHRcdC8vICAgICAgICAgIHh4eHh4eHh4XG5cdFx0Ly9cblx0XHRjb25zdCB0b2tlbnMgPSB0aGlzLl90b2tlbnM7XG5cdFx0Y29uc3QgdG9rZW5Db3VudCA9IHRoaXMuX3Rva2VuQ291bnQ7XG5cdFx0Y29uc3QgZGVsZXRlZExpbmVDb3VudCA9IChlbmREZWx0YUxpbmUgLSBzdGFydERlbHRhTGluZSk7XG5cdFx0bGV0IG5ld1Rva2VuQ291bnQgPSAwO1xuXHRcdGxldCBoYXNEZWxldGVkVG9rZW5zID0gZmFsc2U7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbkNvdW50OyBpKyspIHtcblx0XHRcdGNvbnN0IHNyY09mZnNldCA9IDQgKiBpO1xuXHRcdFx0bGV0IHRva2VuRGVsdGFMaW5lID0gdG9rZW5zW3NyY09mZnNldF07XG5cdFx0XHRsZXQgdG9rZW5TdGFydENoYXJhY3RlciA9IHRva2Vuc1tzcmNPZmZzZXQgKyAxXTtcblx0XHRcdGxldCB0b2tlbkVuZENoYXJhY3RlciA9IHRva2Vuc1tzcmNPZmZzZXQgKyAyXTtcblx0XHRcdGNvbnN0IHRva2VuTWV0YWRhdGEgPSB0b2tlbnNbc3JjT2Zmc2V0ICsgM107XG5cblx0XHRcdGlmICh0b2tlbkRlbHRhTGluZSA8IHN0YXJ0RGVsdGFMaW5lIHx8ICh0b2tlbkRlbHRhTGluZSA9PT0gc3RhcnREZWx0YUxpbmUgJiYgdG9rZW5FbmRDaGFyYWN0ZXIgPD0gc3RhcnRDaGFyYWN0ZXIpKSB7XG5cdFx0XHRcdC8vIDFhLiBUaGUgdG9rZW4gaXMgY29tcGxldGVseSBiZWZvcmUgdGhlIGRlbGV0aW9uIHJhbmdlXG5cdFx0XHRcdC8vID0+IG5vdGhpbmcgdG8gZG9cblx0XHRcdFx0bmV3VG9rZW5Db3VudCsrO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH0gZWxzZSBpZiAodG9rZW5EZWx0YUxpbmUgPT09IHN0YXJ0RGVsdGFMaW5lICYmIHRva2VuU3RhcnRDaGFyYWN0ZXIgPCBzdGFydENoYXJhY3Rlcikge1xuXHRcdFx0XHQvLyAxYiwgMWMsIDFkXG5cdFx0XHRcdC8vID0+IHRoZSB0b2tlbiBzdXJ2aXZlcywgYnV0IGl0IG5lZWRzIHRvIHNocmlua1xuXHRcdFx0XHRpZiAodG9rZW5EZWx0YUxpbmUgPT09IGVuZERlbHRhTGluZSAmJiB0b2tlbkVuZENoYXJhY3RlciA+IGVuZENoYXJhY3Rlcikge1xuXHRcdFx0XHRcdC8vIDFkLiBUaGUgdG9rZW4gc3RhcnRzIGJlZm9yZSwgdGhlIGRlbGV0aW9uIHJhbmdlIGlzIGluc2lkZSB0aGUgdG9rZW5cblx0XHRcdFx0XHQvLyA9PiB0aGUgdG9rZW4gc2hyaW5rcyBieSB0aGUgZGVsZXRpb24gY2hhcmFjdGVyIGNvdW50XG5cdFx0XHRcdFx0dG9rZW5FbmRDaGFyYWN0ZXIgLT0gKGVuZENoYXJhY3RlciAtIHN0YXJ0Q2hhcmFjdGVyKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyAxYi4gVGhlIHRva2VuIHN0YXJ0cyBiZWZvcmUsIHRoZSBkZWxldGlvbiByYW5nZSBlbmRzIGFmdGVyIHRoZSB0b2tlblxuXHRcdFx0XHRcdC8vIDFjLiBUaGUgdG9rZW4gc3RhcnRzIGJlZm9yZSwgdGhlIGRlbGV0aW9uIHJhbmdlIGVuZHMgcHJlY2lzZWx5IHdpdGggdGhlIHRva2VuXG5cdFx0XHRcdFx0Ly8gPT4gdGhlIHRva2VuIHNocmlua3MgaXRzIGVuZGluZyB0byB0aGUgZGVsZXRpb24gc3RhcnRcblx0XHRcdFx0XHR0b2tlbkVuZENoYXJhY3RlciA9IHN0YXJ0Q2hhcmFjdGVyO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHRva2VuRGVsdGFMaW5lID09PSBzdGFydERlbHRhTGluZSAmJiB0b2tlblN0YXJ0Q2hhcmFjdGVyID09PSBzdGFydENoYXJhY3Rlcikge1xuXHRcdFx0XHQvLyAyYSwgMmIsIDJjXG5cdFx0XHRcdGlmICh0b2tlbkRlbHRhTGluZSA9PT0gZW5kRGVsdGFMaW5lICYmIHRva2VuRW5kQ2hhcmFjdGVyID4gZW5kQ2hhcmFjdGVyKSB7XG5cdFx0XHRcdFx0Ly8gMmMuIFRoZSB0b2tlbiBzdGFydHMgYXQgdGhlIHNhbWUgcG9zaXRpb24sIGFuZCBlbmRzIGFmdGVyIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdFx0XHRcdC8vID0+IHRoZSB0b2tlbiBzaHJpbmtzIGJ5IHRoZSBkZWxldGlvbiBjaGFyYWN0ZXIgY291bnRcblx0XHRcdFx0XHR0b2tlbkVuZENoYXJhY3RlciAtPSAoZW5kQ2hhcmFjdGVyIC0gc3RhcnRDaGFyYWN0ZXIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIDJhLiBUaGUgdG9rZW4gc3RhcnRzIGF0IHRoZSBzYW1lIHBvc2l0aW9uLCBhbmQgZW5kcyBpbnNpZGUgdGhlIGRlbGV0aW9uIHJhbmdlXG5cdFx0XHRcdFx0Ly8gMmIuIFRoZSB0b2tlbiBzdGFydHMgYXQgdGhlIHNhbWUgcG9zaXRpb24sIGFuZCBlbmRzIGF0IHRoZSBzYW1lIHBvc2l0aW9uIGFzIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdFx0XHRcdC8vID0+IHRoZSB0b2tlbiBpcyBkZWxldGVkXG5cdFx0XHRcdFx0aGFzRGVsZXRlZFRva2VucyA9IHRydWU7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAodG9rZW5EZWx0YUxpbmUgPCBlbmREZWx0YUxpbmUgfHwgKHRva2VuRGVsdGFMaW5lID09PSBlbmREZWx0YUxpbmUgJiYgdG9rZW5TdGFydENoYXJhY3RlciA8IGVuZENoYXJhY3RlcikpIHtcblx0XHRcdFx0Ly8gM2EsIDNiLCAzY1xuXHRcdFx0XHRpZiAodG9rZW5EZWx0YUxpbmUgPT09IGVuZERlbHRhTGluZSAmJiB0b2tlbkVuZENoYXJhY3RlciA+IGVuZENoYXJhY3Rlcikge1xuXHRcdFx0XHRcdC8vIDNjLiBUaGUgdG9rZW4gc3RhcnRzIGluc2lkZSB0aGUgZGVsZXRpb24gcmFuZ2UsIGFuZCBlbmRzIGFmdGVyIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdFx0XHRcdC8vID0+IHRoZSB0b2tlbiBtb3ZlcyB0byBjb250aW51ZSByaWdodCBhZnRlciB0aGUgZGVsZXRpb25cblx0XHRcdFx0XHR0b2tlbkRlbHRhTGluZSA9IHN0YXJ0RGVsdGFMaW5lO1xuXHRcdFx0XHRcdHRva2VuU3RhcnRDaGFyYWN0ZXIgPSBzdGFydENoYXJhY3Rlcjtcblx0XHRcdFx0XHR0b2tlbkVuZENoYXJhY3RlciA9IHRva2VuU3RhcnRDaGFyYWN0ZXIgKyAodG9rZW5FbmRDaGFyYWN0ZXIgLSBlbmRDaGFyYWN0ZXIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIDNhLiBUaGUgdG9rZW4gaXMgaW5zaWRlIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdFx0XHRcdC8vIDNiLiBUaGUgdG9rZW4gc3RhcnRzIGluc2lkZSB0aGUgZGVsZXRpb24gcmFuZ2UsIGFuZCBlbmRzIGF0IHRoZSBzYW1lIHBvc2l0aW9uIGFzIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdFx0XHRcdC8vID0+IHRoZSB0b2tlbiBpcyBkZWxldGVkXG5cdFx0XHRcdFx0aGFzRGVsZXRlZFRva2VucyA9IHRydWU7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAodG9rZW5EZWx0YUxpbmUgPiBlbmREZWx0YUxpbmUpIHtcblx0XHRcdFx0Ly8gNC4gKHBhcnRpYWwpIFRoZSB0b2tlbiBzdGFydHMgYWZ0ZXIgdGhlIGRlbGV0aW9uIHJhbmdlLCBvbiBhIGxpbmUgYmVsb3cuLi5cblx0XHRcdFx0aWYgKGRlbGV0ZWRMaW5lQ291bnQgPT09IDAgJiYgIWhhc0RlbGV0ZWRUb2tlbnMpIHtcblx0XHRcdFx0XHQvLyBlYXJseSBzdG9wLCB0aGVyZSBpcyBubyBuZWVkIHRvIHdhbGsgYWxsIHRoZSB0b2tlbnMgYW5kIGRvIG5vdGhpbmcuLi5cblx0XHRcdFx0XHRuZXdUb2tlbkNvdW50ID0gdG9rZW5Db3VudDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHR0b2tlbkRlbHRhTGluZSAtPSBkZWxldGVkTGluZUNvdW50O1xuXHRcdFx0fSBlbHNlIGlmICh0b2tlbkRlbHRhTGluZSA9PT0gZW5kRGVsdGFMaW5lICYmIHRva2VuU3RhcnRDaGFyYWN0ZXIgPj0gZW5kQ2hhcmFjdGVyKSB7XG5cdFx0XHRcdC8vIDQuIChjb250aW51ZWQpIFRoZSB0b2tlbiBzdGFydHMgYWZ0ZXIgdGhlIGRlbGV0aW9uIHJhbmdlLCBvbiB0aGUgbGFzdCBsaW5lIHdoZXJlIGEgZGVsZXRpb24gb2NjdXJzXG5cdFx0XHRcdGlmIChob3Jpem9udGFsU2hpZnRGb3JGaXJzdExpbmVUb2tlbnMgJiYgdG9rZW5EZWx0YUxpbmUgPT09IDApIHtcblx0XHRcdFx0XHR0b2tlblN0YXJ0Q2hhcmFjdGVyICs9IGhvcml6b250YWxTaGlmdEZvckZpcnN0TGluZVRva2Vucztcblx0XHRcdFx0XHR0b2tlbkVuZENoYXJhY3RlciArPSBob3Jpem9udGFsU2hpZnRGb3JGaXJzdExpbmVUb2tlbnM7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9rZW5EZWx0YUxpbmUgLT0gZGVsZXRlZExpbmVDb3VudDtcblx0XHRcdFx0dG9rZW5TdGFydENoYXJhY3RlciAtPSAoZW5kQ2hhcmFjdGVyIC0gc3RhcnRDaGFyYWN0ZXIpO1xuXHRcdFx0XHR0b2tlbkVuZENoYXJhY3RlciAtPSAoZW5kQ2hhcmFjdGVyIC0gc3RhcnRDaGFyYWN0ZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBOb3QgcG9zc2libGUhYCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRlc3RPZmZzZXQgPSA0ICogbmV3VG9rZW5Db3VudDtcblx0XHRcdHRva2Vuc1tkZXN0T2Zmc2V0XSA9IHRva2VuRGVsdGFMaW5lO1xuXHRcdFx0dG9rZW5zW2Rlc3RPZmZzZXQgKyAxXSA9IHRva2VuU3RhcnRDaGFyYWN0ZXI7XG5cdFx0XHR0b2tlbnNbZGVzdE9mZnNldCArIDJdID0gdG9rZW5FbmRDaGFyYWN0ZXI7XG5cdFx0XHR0b2tlbnNbZGVzdE9mZnNldCArIDNdID0gdG9rZW5NZXRhZGF0YTtcblx0XHRcdG5ld1Rva2VuQ291bnQrKztcblx0XHR9XG5cblx0XHR0aGlzLl90b2tlbkNvdW50ID0gbmV3VG9rZW5Db3VudDtcblx0fVxuXG5cdHB1YmxpYyBhY2NlcHRJbnNlcnRUZXh0KGRlbHRhTGluZTogbnVtYmVyLCBjaGFyYWN0ZXI6IG51bWJlciwgZW9sQ291bnQ6IG51bWJlciwgZmlyc3RMaW5lTGVuZ3RoOiBudW1iZXIsIGxhc3RMaW5lTGVuZ3RoOiBudW1iZXIsIGZpcnN0Q2hhckNvZGU6IG51bWJlcik6IHZvaWQge1xuXHRcdC8vIEhlcmUgYXJlIHRoZSBjYXNlcyBJIHVzZWQgdG8gdGhpbmsgYWJvdXQgdGhpczpcblx0XHQvL1xuXHRcdC8vIDEuIFRoZSB0b2tlbiBpcyBjb21wbGV0ZWx5IGJlZm9yZSB0aGUgaW5zZXJ0aW9uIHBvaW50XG5cdFx0Ly8gICAgICAgICAgICAtLS0tLS0tLS0tLSAgIHxcblx0XHQvLyAyLiBUaGUgdG9rZW4gZW5kcyBwcmVjaXNlbHkgYXQgdGhlIGluc2VydGlvbiBwb2ludFxuXHRcdC8vICAgICAgICAgICAgLS0tLS0tLS0tLS18XG5cdFx0Ly8gMy4gVGhlIHRva2VuIGNvbnRhaW5zIHRoZSBpbnNlcnRpb24gcG9pbnRcblx0XHQvLyAgICAgICAgICAgIC0tLS0tfC0tLS0tLVxuXHRcdC8vIDQuIFRoZSB0b2tlbiBzdGFydHMgcHJlY2lzZWx5IGF0IHRoZSBpbnNlcnRpb24gcG9pbnRcblx0XHQvLyAgICAgICAgICAgIHwtLS0tLS0tLS0tLVxuXHRcdC8vIDUuIFRoZSB0b2tlbiBpcyBjb21wbGV0ZWx5IGFmdGVyIHRoZSBpbnNlcnRpb24gcG9pbnRcblx0XHQvLyAgICAgICAgICAgIHwgICAtLS0tLS0tLS0tLVxuXHRcdC8vXG5cdFx0Y29uc3QgaXNJbnNlcnRpbmdQcmVjaXNlbHlPbmVXb3JkQ2hhcmFjdGVyID0gKFxuXHRcdFx0ZW9sQ291bnQgPT09IDBcblx0XHRcdCYmIGZpcnN0TGluZUxlbmd0aCA9PT0gMVxuXHRcdFx0JiYgKFxuXHRcdFx0XHQoZmlyc3RDaGFyQ29kZSA+PSBDaGFyQ29kZS5EaWdpdDAgJiYgZmlyc3RDaGFyQ29kZSA8PSBDaGFyQ29kZS5EaWdpdDkpXG5cdFx0XHRcdHx8IChmaXJzdENoYXJDb2RlID49IENoYXJDb2RlLkEgJiYgZmlyc3RDaGFyQ29kZSA8PSBDaGFyQ29kZS5aKVxuXHRcdFx0XHR8fCAoZmlyc3RDaGFyQ29kZSA+PSBDaGFyQ29kZS5hICYmIGZpcnN0Q2hhckNvZGUgPD0gQ2hhckNvZGUueilcblx0XHRcdClcblx0XHQpO1xuXHRcdGNvbnN0IHRva2VucyA9IHRoaXMuX3Rva2Vucztcblx0XHRjb25zdCB0b2tlbkNvdW50ID0gdGhpcy5fdG9rZW5Db3VudDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2VuQ291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gNCAqIGk7XG5cdFx0XHRsZXQgdG9rZW5EZWx0YUxpbmUgPSB0b2tlbnNbb2Zmc2V0XTtcblx0XHRcdGxldCB0b2tlblN0YXJ0Q2hhcmFjdGVyID0gdG9rZW5zW29mZnNldCArIDFdO1xuXHRcdFx0bGV0IHRva2VuRW5kQ2hhcmFjdGVyID0gdG9rZW5zW29mZnNldCArIDJdO1xuXG5cdFx0XHRpZiAodG9rZW5EZWx0YUxpbmUgPCBkZWx0YUxpbmUgfHwgKHRva2VuRGVsdGFMaW5lID09PSBkZWx0YUxpbmUgJiYgdG9rZW5FbmRDaGFyYWN0ZXIgPCBjaGFyYWN0ZXIpKSB7XG5cdFx0XHRcdC8vIDEuIFRoZSB0b2tlbiBpcyBjb21wbGV0ZWx5IGJlZm9yZSB0aGUgaW5zZXJ0aW9uIHBvaW50XG5cdFx0XHRcdC8vID0+IG5vdGhpbmcgdG8gZG9cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9IGVsc2UgaWYgKHRva2VuRGVsdGFMaW5lID09PSBkZWx0YUxpbmUgJiYgdG9rZW5FbmRDaGFyYWN0ZXIgPT09IGNoYXJhY3Rlcikge1xuXHRcdFx0XHQvLyAyLiBUaGUgdG9rZW4gZW5kcyBwcmVjaXNlbHkgYXQgdGhlIGluc2VydGlvbiBwb2ludFxuXHRcdFx0XHQvLyA9PiBleHBhbmQgdGhlIGVuZCBjaGFyYWN0ZXIgb25seSBpZiBpbnNlcnRpbmcgcHJlY2lzZWx5IG9uZSBjaGFyYWN0ZXIgdGhhdCBpcyBhIHdvcmQgY2hhcmFjdGVyXG5cdFx0XHRcdGlmIChpc0luc2VydGluZ1ByZWNpc2VseU9uZVdvcmRDaGFyYWN0ZXIpIHtcblx0XHRcdFx0XHR0b2tlbkVuZENoYXJhY3RlciArPSAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHRva2VuRGVsdGFMaW5lID09PSBkZWx0YUxpbmUgJiYgdG9rZW5TdGFydENoYXJhY3RlciA8IGNoYXJhY3RlciAmJiBjaGFyYWN0ZXIgPCB0b2tlbkVuZENoYXJhY3Rlcikge1xuXHRcdFx0XHQvLyAzLiBUaGUgdG9rZW4gY29udGFpbnMgdGhlIGluc2VydGlvbiBwb2ludFxuXHRcdFx0XHRpZiAoZW9sQ291bnQgPT09IDApIHtcblx0XHRcdFx0XHQvLyA9PiBqdXN0IGV4cGFuZCB0aGUgZW5kIGNoYXJhY3RlclxuXHRcdFx0XHRcdHRva2VuRW5kQ2hhcmFjdGVyICs9IGZpcnN0TGluZUxlbmd0aDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyA9PiBjdXQgb2ZmIHRoZSB0b2tlblxuXHRcdFx0XHRcdHRva2VuRW5kQ2hhcmFjdGVyID0gY2hhcmFjdGVyO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyA0LiBvciA1LlxuXHRcdFx0XHRpZiAodG9rZW5EZWx0YUxpbmUgPT09IGRlbHRhTGluZSAmJiB0b2tlblN0YXJ0Q2hhcmFjdGVyID09PSBjaGFyYWN0ZXIpIHtcblx0XHRcdFx0XHQvLyA0LiBUaGUgdG9rZW4gc3RhcnRzIHByZWNpc2VseSBhdCB0aGUgaW5zZXJ0aW9uIHBvaW50XG5cdFx0XHRcdFx0Ly8gPT4gZ3JvdyB0aGUgdG9rZW4gKGJ5IGtlZXBpbmcgaXRzIHN0YXJ0IGNvbnN0YW50KSBvbmx5IGlmIGluc2VydGluZyBwcmVjaXNlbHkgb25lIGNoYXJhY3RlciB0aGF0IGlzIGEgd29yZCBjaGFyYWN0ZXJcblx0XHRcdFx0XHQvLyA9PiBvdGhlcndpc2UgYmVoYXZlIGFzIGluIGNhc2UgNS5cblx0XHRcdFx0XHRpZiAoaXNJbnNlcnRpbmdQcmVjaXNlbHlPbmVXb3JkQ2hhcmFjdGVyKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gPT4gdGhlIHRva2VuIG11c3QgbW92ZSBhbmQga2VlcCBpdHMgc2l6ZSBjb25zdGFudFxuXHRcdFx0XHRpZiAodG9rZW5EZWx0YUxpbmUgPT09IGRlbHRhTGluZSkge1xuXHRcdFx0XHRcdHRva2VuRGVsdGFMaW5lICs9IGVvbENvdW50O1xuXHRcdFx0XHRcdC8vIHRoaXMgdG9rZW4gaXMgb24gdGhlIGxpbmUgd2hlcmUgdGhlIGluc2VydGlvbiBpcyB0YWtpbmcgcGxhY2Vcblx0XHRcdFx0XHRpZiAoZW9sQ291bnQgPT09IDApIHtcblx0XHRcdFx0XHRcdHRva2VuU3RhcnRDaGFyYWN0ZXIgKz0gZmlyc3RMaW5lTGVuZ3RoO1xuXHRcdFx0XHRcdFx0dG9rZW5FbmRDaGFyYWN0ZXIgKz0gZmlyc3RMaW5lTGVuZ3RoO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCB0b2tlbkxlbmd0aCA9IHRva2VuRW5kQ2hhcmFjdGVyIC0gdG9rZW5TdGFydENoYXJhY3Rlcjtcblx0XHRcdFx0XHRcdHRva2VuU3RhcnRDaGFyYWN0ZXIgPSBsYXN0TGluZUxlbmd0aCArICh0b2tlblN0YXJ0Q2hhcmFjdGVyIC0gY2hhcmFjdGVyKTtcblx0XHRcdFx0XHRcdHRva2VuRW5kQ2hhcmFjdGVyID0gdG9rZW5TdGFydENoYXJhY3RlciArIHRva2VuTGVuZ3RoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0b2tlbkRlbHRhTGluZSArPSBlb2xDb3VudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0b2tlbnNbb2Zmc2V0XSA9IHRva2VuRGVsdGFMaW5lO1xuXHRcdFx0dG9rZW5zW29mZnNldCArIDFdID0gdG9rZW5TdGFydENoYXJhY3Rlcjtcblx0XHRcdHRva2Vuc1tvZmZzZXQgKyAyXSA9IHRva2VuRW5kQ2hhcmFjdGVyO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3BhcnNlTGluZVRva2VucyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW5zOiBVaW50MzJBcnJheTtcblxuXHRjb25zdHJ1Y3Rvcih0b2tlbnM6IFVpbnQzMkFycmF5KSB7XG5cdFx0dGhpcy5fdG9rZW5zID0gdG9rZW5zO1xuXHR9XG5cblx0cHVibGljIGdldENvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy5sZW5ndGggLyA0O1xuXHR9XG5cblx0cHVibGljIGdldFN0YXJ0Q2hhcmFjdGVyKHRva2VuSW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vuc1s0ICogdG9rZW5JbmRleCArIDFdO1xuXHR9XG5cblx0cHVibGljIGdldEVuZENoYXJhY3Rlcih0b2tlbkluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl90b2tlbnNbNCAqIHRva2VuSW5kZXggKyAyXTtcblx0fVxuXG5cdHB1YmxpYyBnZXRNZXRhZGF0YSh0b2tlbkluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl90b2tlbnNbNCAqIHRva2VuSW5kZXggKyAz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
