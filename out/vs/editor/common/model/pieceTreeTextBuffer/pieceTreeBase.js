import { CharCode } from "../../../../base/common/charCode.js";
import { Position } from "../../core/position.js";
import { Range } from "../../core/range.js";
import { FindMatch } from "../../model.js";
import { NodeColor, SENTINEL, TreeNode, fixInsert, leftest, rbDelete, righttest, updateTreeMetadata } from "./rbTreeBase.js";
import { Searcher, createFindMatch, isValidMatch } from "../textModelSearch.js";
const AverageBufferSize = 65535;
function createUintArray(arr) {
  let r;
  if (arr[arr.length - 1] < 65536) {
    r = new Uint16Array(arr.length);
  } else {
    r = new Uint32Array(arr.length);
  }
  r.set(arr, 0);
  return r;
}
class LineStarts {
  constructor(lineStarts, cr, lf, crlf, isBasicASCII) {
    this.lineStarts = lineStarts;
    this.cr = cr;
    this.lf = lf;
    this.crlf = crlf;
    this.isBasicASCII = isBasicASCII;
  }
}
function createLineStartsFast(str, readonly = true) {
  const r = [0];
  let rLength = 1;
  for (let i = 0, len = str.length; i < len; i++) {
    const chr = str.charCodeAt(i);
    if (chr === CharCode.CarriageReturn) {
      if (i + 1 < len && str.charCodeAt(i + 1) === CharCode.LineFeed) {
        r[rLength++] = i + 2;
        i++;
      } else {
        r[rLength++] = i + 1;
      }
    } else if (chr === CharCode.LineFeed) {
      r[rLength++] = i + 1;
    }
  }
  if (readonly) {
    return createUintArray(r);
  } else {
    return r;
  }
}
function createLineStarts(r, str) {
  r.length = 0;
  r[0] = 0;
  let rLength = 1;
  let cr = 0, lf = 0, crlf = 0;
  let isBasicASCII = true;
  for (let i = 0, len = str.length; i < len; i++) {
    const chr = str.charCodeAt(i);
    if (chr === CharCode.CarriageReturn) {
      if (i + 1 < len && str.charCodeAt(i + 1) === CharCode.LineFeed) {
        crlf++;
        r[rLength++] = i + 2;
        i++;
      } else {
        cr++;
        r[rLength++] = i + 1;
      }
    } else if (chr === CharCode.LineFeed) {
      lf++;
      r[rLength++] = i + 1;
    } else {
      if (isBasicASCII) {
        if (chr !== CharCode.Tab && (chr < 32 || chr > 126)) {
          isBasicASCII = false;
        }
      }
    }
  }
  const result = new LineStarts(createUintArray(r), cr, lf, crlf, isBasicASCII);
  r.length = 0;
  return result;
}
class Piece {
  constructor(bufferIndex, start, end, lineFeedCnt, length) {
    this.bufferIndex = bufferIndex;
    this.start = start;
    this.end = end;
    this.lineFeedCnt = lineFeedCnt;
    this.length = length;
  }
}
class StringBuffer {
  constructor(buffer, lineStarts) {
    this.buffer = buffer;
    this.lineStarts = lineStarts;
  }
}
class PieceTreeSnapshot {
  constructor(tree, BOM) {
    this._pieces = [];
    this._tree = tree;
    this._BOM = BOM;
    this._index = 0;
    if (tree.root !== SENTINEL) {
      tree.iterate(tree.root, (node) => {
        if (node !== SENTINEL) {
          this._pieces.push(node.piece);
        }
        return true;
      });
    }
  }
  read() {
    if (this._pieces.length === 0) {
      if (this._index === 0) {
        this._index++;
        return this._BOM;
      } else {
        return null;
      }
    }
    if (this._index > this._pieces.length - 1) {
      return null;
    }
    if (this._index === 0) {
      return this._BOM + this._tree.getPieceContent(this._pieces[this._index++]);
    }
    return this._tree.getPieceContent(this._pieces[this._index++]);
  }
}
class PieceTreeSearchCache {
  constructor(limit) {
    this._limit = limit;
    this._cache = [];
  }
  get(offset) {
    for (let i = this._cache.length - 1; i >= 0; i--) {
      const nodePos = this._cache[i];
      if (nodePos.nodeStartOffset <= offset && nodePos.nodeStartOffset + nodePos.node.piece.length >= offset) {
        return nodePos;
      }
    }
    return null;
  }
  get2(lineNumber) {
    for (let i = this._cache.length - 1; i >= 0; i--) {
      const nodePos = this._cache[i];
      if (nodePos.nodeStartLineNumber && nodePos.nodeStartLineNumber < lineNumber && nodePos.nodeStartLineNumber + nodePos.node.piece.lineFeedCnt >= lineNumber) {
        return nodePos;
      }
    }
    return null;
  }
  set(nodePosition) {
    if (this._cache.length >= this._limit) {
      this._cache.shift();
    }
    this._cache.push(nodePosition);
  }
  validate(offset) {
    let hasInvalidVal = false;
    const tmp = this._cache;
    for (let i = 0; i < tmp.length; i++) {
      const nodePos = tmp[i];
      if (nodePos.node.parent === null || nodePos.nodeStartOffset >= offset) {
        tmp[i] = null;
        hasInvalidVal = true;
        continue;
      }
    }
    if (hasInvalidVal) {
      const newArr = [];
      for (const entry of tmp) {
        if (entry !== null) {
          newArr.push(entry);
        }
      }
      this._cache = newArr;
    }
  }
}
class PieceTreeBase {
  constructor(chunks, eol, eolNormalized) {
    this.create(chunks, eol, eolNormalized);
  }
  create(chunks, eol, eolNormalized) {
    this._buffers = [
      new StringBuffer("", [0])
    ];
    this._lastChangeBufferPos = { line: 0, column: 0 };
    this.root = SENTINEL;
    this._lineCnt = 1;
    this._length = 0;
    this._EOL = eol;
    this._EOLLength = eol.length;
    this._EOLNormalized = eolNormalized;
    let lastNode = null;
    for (let i = 0, len = chunks.length; i < len; i++) {
      if (chunks[i].buffer.length > 0) {
        if (!chunks[i].lineStarts) {
          chunks[i].lineStarts = createLineStartsFast(chunks[i].buffer);
        }
        const piece = new Piece(
          i + 1,
          { line: 0, column: 0 },
          { line: chunks[i].lineStarts.length - 1, column: chunks[i].buffer.length - chunks[i].lineStarts[chunks[i].lineStarts.length - 1] },
          chunks[i].lineStarts.length - 1,
          chunks[i].buffer.length
        );
        this._buffers.push(chunks[i]);
        lastNode = this.rbInsertRight(lastNode, piece);
      }
    }
    this._searchCache = new PieceTreeSearchCache(1);
    this._lastVisitedLine = { lineNumber: 0, value: "" };
    this.computeBufferMetadata();
  }
  normalizeEOL(eol) {
    const averageBufferSize = AverageBufferSize;
    const min = averageBufferSize - Math.floor(averageBufferSize / 3);
    const max = min * 2;
    let tempChunk = "";
    let tempChunkLen = 0;
    const chunks = [];
    this.iterate(this.root, (node) => {
      const str = this.getNodeContent(node);
      const len = str.length;
      if (tempChunkLen <= min || tempChunkLen + len < max) {
        tempChunk += str;
        tempChunkLen += len;
        return true;
      }
      const text = tempChunk.replace(/\r\n|\r|\n/g, eol);
      chunks.push(new StringBuffer(text, createLineStartsFast(text)));
      tempChunk = str;
      tempChunkLen = len;
      return true;
    });
    if (tempChunkLen > 0) {
      const text = tempChunk.replace(/\r\n|\r|\n/g, eol);
      chunks.push(new StringBuffer(text, createLineStartsFast(text)));
    }
    this.create(chunks, eol, true);
  }
  // #region Buffer API
  getEOL() {
    return this._EOL;
  }
  setEOL(newEOL) {
    this._EOL = newEOL;
    this._EOLLength = this._EOL.length;
    this.normalizeEOL(newEOL);
  }
  createSnapshot(BOM) {
    return new PieceTreeSnapshot(this, BOM);
  }
  equal(other) {
    if (this.getLength() !== other.getLength()) {
      return false;
    }
    if (this.getLineCount() !== other.getLineCount()) {
      return false;
    }
    let offset = 0;
    const ret = this.iterate(this.root, (node) => {
      if (node === SENTINEL) {
        return true;
      }
      const str = this.getNodeContent(node);
      const len = str.length;
      const startPosition = other.nodeAt(offset);
      const endPosition = other.nodeAt(offset + len);
      const val = other.getValueInRange2(startPosition, endPosition);
      offset += len;
      return str === val;
    });
    return ret;
  }
  getOffsetAt(lineNumber, column) {
    let leftLen = 0;
    let x = this.root;
    while (x !== SENTINEL) {
      if (x.left !== SENTINEL && x.lf_left + 1 >= lineNumber) {
        x = x.left;
      } else if (x.lf_left + x.piece.lineFeedCnt + 1 >= lineNumber) {
        leftLen += x.size_left;
        const accumualtedValInCurrentIndex = this.getAccumulatedValue(x, lineNumber - x.lf_left - 2);
        return leftLen += accumualtedValInCurrentIndex + column - 1;
      } else {
        lineNumber -= x.lf_left + x.piece.lineFeedCnt;
        leftLen += x.size_left + x.piece.length;
        x = x.right;
      }
    }
    return leftLen;
  }
  getPositionAt(offset) {
    offset = Math.floor(offset);
    offset = Math.max(0, offset);
    let x = this.root;
    let lfCnt = 0;
    const originalOffset = offset;
    while (x !== SENTINEL) {
      if (x.size_left !== 0 && x.size_left >= offset) {
        x = x.left;
      } else if (x.size_left + x.piece.length >= offset) {
        const out = this.getIndexOf(x, offset - x.size_left);
        lfCnt += x.lf_left + out.index;
        if (out.index === 0) {
          const lineStartOffset = this.getOffsetAt(lfCnt + 1, 1);
          const column = originalOffset - lineStartOffset;
          return new Position(lfCnt + 1, column + 1);
        }
        return new Position(lfCnt + 1, out.remainder + 1);
      } else {
        offset -= x.size_left + x.piece.length;
        lfCnt += x.lf_left + x.piece.lineFeedCnt;
        if (x.right === SENTINEL) {
          const lineStartOffset = this.getOffsetAt(lfCnt + 1, 1);
          const column = originalOffset - offset - lineStartOffset;
          return new Position(lfCnt + 1, column + 1);
        } else {
          x = x.right;
        }
      }
    }
    return new Position(1, 1);
  }
  getValueInRange(range, eol) {
    if (range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn) {
      return "";
    }
    const startPosition = this.nodeAt2(range.startLineNumber, range.startColumn);
    const endPosition = this.nodeAt2(range.endLineNumber, range.endColumn);
    const value = this.getValueInRange2(startPosition, endPosition);
    if (eol) {
      if (eol !== this._EOL || !this._EOLNormalized) {
        return value.replace(/\r\n|\r|\n/g, eol);
      }
      if (eol === this.getEOL() && this._EOLNormalized) {
        if (eol === "\r\n") {
        }
        return value;
      }
      return value.replace(/\r\n|\r|\n/g, eol);
    }
    return value;
  }
  getValueInRange2(startPosition, endPosition) {
    if (startPosition.node === endPosition.node) {
      const node = startPosition.node;
      const buffer2 = this._buffers[node.piece.bufferIndex].buffer;
      const startOffset2 = this.offsetInBuffer(node.piece.bufferIndex, node.piece.start);
      return buffer2.substring(startOffset2 + startPosition.remainder, startOffset2 + endPosition.remainder);
    }
    let x = startPosition.node;
    const buffer = this._buffers[x.piece.bufferIndex].buffer;
    const startOffset = this.offsetInBuffer(x.piece.bufferIndex, x.piece.start);
    let ret = buffer.substring(startOffset + startPosition.remainder, startOffset + x.piece.length);
    x = x.next();
    while (x !== SENTINEL) {
      const buffer2 = this._buffers[x.piece.bufferIndex].buffer;
      const startOffset2 = this.offsetInBuffer(x.piece.bufferIndex, x.piece.start);
      if (x === endPosition.node) {
        ret += buffer2.substring(startOffset2, startOffset2 + endPosition.remainder);
        break;
      } else {
        ret += buffer2.substr(startOffset2, x.piece.length);
      }
      x = x.next();
    }
    return ret;
  }
  getLinesContent() {
    const lines = [];
    let linesLength = 0;
    let currentLine = "";
    let danglingCR = false;
    this.iterate(this.root, (node) => {
      if (node === SENTINEL) {
        return true;
      }
      const piece = node.piece;
      let pieceLength = piece.length;
      if (pieceLength === 0) {
        return true;
      }
      const buffer = this._buffers[piece.bufferIndex].buffer;
      const lineStarts = this._buffers[piece.bufferIndex].lineStarts;
      const pieceStartLine = piece.start.line;
      const pieceEndLine = piece.end.line;
      let pieceStartOffset = lineStarts[pieceStartLine] + piece.start.column;
      if (danglingCR) {
        if (buffer.charCodeAt(pieceStartOffset) === CharCode.LineFeed) {
          pieceStartOffset++;
          pieceLength--;
        }
        lines[linesLength++] = currentLine;
        currentLine = "";
        danglingCR = false;
        if (pieceLength === 0) {
          return true;
        }
      }
      if (pieceStartLine === pieceEndLine) {
        if (!this._EOLNormalized && buffer.charCodeAt(pieceStartOffset + pieceLength - 1) === CharCode.CarriageReturn) {
          danglingCR = true;
          currentLine += buffer.substr(pieceStartOffset, pieceLength - 1);
        } else {
          currentLine += buffer.substr(pieceStartOffset, pieceLength);
        }
        return true;
      }
      currentLine += this._EOLNormalized ? buffer.substring(pieceStartOffset, Math.max(pieceStartOffset, lineStarts[pieceStartLine + 1] - this._EOLLength)) : buffer.substring(pieceStartOffset, lineStarts[pieceStartLine + 1]).replace(/(\r\n|\r|\n)$/, "");
      lines[linesLength++] = currentLine;
      for (let line = pieceStartLine + 1; line < pieceEndLine; line++) {
        currentLine = this._EOLNormalized ? buffer.substring(lineStarts[line], lineStarts[line + 1] - this._EOLLength) : buffer.substring(lineStarts[line], lineStarts[line + 1]).replace(/(\r\n|\r|\n)$/, "");
        lines[linesLength++] = currentLine;
      }
      if (!this._EOLNormalized && buffer.charCodeAt(lineStarts[pieceEndLine] + piece.end.column - 1) === CharCode.CarriageReturn) {
        danglingCR = true;
        if (piece.end.column === 0) {
          linesLength--;
        } else {
          currentLine = buffer.substr(lineStarts[pieceEndLine], piece.end.column - 1);
        }
      } else {
        currentLine = buffer.substr(lineStarts[pieceEndLine], piece.end.column);
      }
      return true;
    });
    if (danglingCR) {
      lines[linesLength++] = currentLine;
      currentLine = "";
    }
    lines[linesLength++] = currentLine;
    return lines;
  }
  getLength() {
    return this._length;
  }
  getLineCount() {
    return this._lineCnt;
  }
  getLineContent(lineNumber) {
    if (this._lastVisitedLine.lineNumber === lineNumber) {
      return this._lastVisitedLine.value;
    }
    this._lastVisitedLine.lineNumber = lineNumber;
    if (lineNumber === this._lineCnt) {
      this._lastVisitedLine.value = this.getLineRawContent(lineNumber);
    } else if (this._EOLNormalized) {
      this._lastVisitedLine.value = this.getLineRawContent(lineNumber, this._EOLLength);
    } else {
      this._lastVisitedLine.value = this.getLineRawContent(lineNumber).replace(/(\r\n|\r|\n)$/, "");
    }
    return this._lastVisitedLine.value;
  }
  _getCharCode(nodePos) {
    if (nodePos.remainder === nodePos.node.piece.length) {
      const matchingNode = nodePos.node.next();
      if (!matchingNode) {
        return 0;
      }
      const buffer = this._buffers[matchingNode.piece.bufferIndex];
      const startOffset = this.offsetInBuffer(matchingNode.piece.bufferIndex, matchingNode.piece.start);
      return buffer.buffer.charCodeAt(startOffset);
    } else {
      const buffer = this._buffers[nodePos.node.piece.bufferIndex];
      const startOffset = this.offsetInBuffer(nodePos.node.piece.bufferIndex, nodePos.node.piece.start);
      const targetOffset = startOffset + nodePos.remainder;
      return buffer.buffer.charCodeAt(targetOffset);
    }
  }
  getLineCharCode(lineNumber, index) {
    const nodePos = this.nodeAt2(lineNumber, index + 1);
    return this._getCharCode(nodePos);
  }
  getLineLength(lineNumber) {
    if (lineNumber === this.getLineCount()) {
      const startOffset = this.getOffsetAt(lineNumber, 1);
      return this.getLength() - startOffset;
    }
    return this.getOffsetAt(lineNumber + 1, 1) - this.getOffsetAt(lineNumber, 1) - this._EOLLength;
  }
  getCharCode(offset) {
    const nodePos = this.nodeAt(offset);
    return this._getCharCode(nodePos);
  }
  getNearestChunk(offset) {
    const nodePos = this.nodeAt(offset);
    if (nodePos.remainder === nodePos.node.piece.length) {
      const matchingNode = nodePos.node.next();
      if (!matchingNode || matchingNode === SENTINEL) {
        return "";
      }
      const buffer = this._buffers[matchingNode.piece.bufferIndex];
      const startOffset = this.offsetInBuffer(matchingNode.piece.bufferIndex, matchingNode.piece.start);
      return buffer.buffer.substring(startOffset, startOffset + matchingNode.piece.length);
    } else {
      const buffer = this._buffers[nodePos.node.piece.bufferIndex];
      const startOffset = this.offsetInBuffer(nodePos.node.piece.bufferIndex, nodePos.node.piece.start);
      const targetOffset = startOffset + nodePos.remainder;
      const targetEnd = startOffset + nodePos.node.piece.length;
      return buffer.buffer.substring(targetOffset, targetEnd);
    }
  }
  findMatchesInNode(node, searcher, startLineNumber, startColumn, startCursor, endCursor, searchData, captureMatches, limitResultCount, resultLen, result) {
    const buffer = this._buffers[node.piece.bufferIndex];
    const startOffsetInBuffer = this.offsetInBuffer(node.piece.bufferIndex, node.piece.start);
    const start = this.offsetInBuffer(node.piece.bufferIndex, startCursor);
    const end = this.offsetInBuffer(node.piece.bufferIndex, endCursor);
    let m;
    const ret = { line: 0, column: 0 };
    let searchText;
    let offsetInBuffer;
    if (searcher._wordSeparators) {
      searchText = buffer.buffer.substring(start, end);
      offsetInBuffer = (offset) => offset + start;
      searcher.reset(0);
    } else {
      searchText = buffer.buffer;
      offsetInBuffer = (offset) => offset;
      searcher.reset(start);
    }
    do {
      m = searcher.next(searchText);
      if (m) {
        if (offsetInBuffer(m.index) >= end) {
          return resultLen;
        }
        this.positionInBuffer(node, offsetInBuffer(m.index) - startOffsetInBuffer, ret);
        const lineFeedCnt = this.getLineFeedCnt(node.piece.bufferIndex, startCursor, ret);
        const retStartColumn = ret.line === startCursor.line ? ret.column - startCursor.column + startColumn : ret.column + 1;
        const retEndColumn = retStartColumn + m[0].length;
        result[resultLen++] = createFindMatch(new Range(startLineNumber + lineFeedCnt, retStartColumn, startLineNumber + lineFeedCnt, retEndColumn), m, captureMatches);
        if (offsetInBuffer(m.index) + m[0].length >= end) {
          return resultLen;
        }
        if (resultLen >= limitResultCount) {
          return resultLen;
        }
      }
    } while (m);
    return resultLen;
  }
  findMatchesLineByLine(searchRange, searchData, captureMatches, limitResultCount) {
    const result = [];
    let resultLen = 0;
    const searcher = new Searcher(searchData.wordSeparators, searchData.regex);
    let startPosition = this.nodeAt2(searchRange.startLineNumber, searchRange.startColumn);
    if (startPosition === null) {
      return [];
    }
    const endPosition = this.nodeAt2(searchRange.endLineNumber, searchRange.endColumn);
    if (endPosition === null) {
      return [];
    }
    let start = this.positionInBuffer(startPosition.node, startPosition.remainder);
    const end = this.positionInBuffer(endPosition.node, endPosition.remainder);
    if (startPosition.node === endPosition.node) {
      this.findMatchesInNode(startPosition.node, searcher, searchRange.startLineNumber, searchRange.startColumn, start, end, searchData, captureMatches, limitResultCount, resultLen, result);
      return result;
    }
    let startLineNumber = searchRange.startLineNumber;
    let currentNode = startPosition.node;
    while (currentNode !== endPosition.node) {
      const lineBreakCnt = this.getLineFeedCnt(currentNode.piece.bufferIndex, start, currentNode.piece.end);
      if (lineBreakCnt >= 1) {
        const lineStarts = this._buffers[currentNode.piece.bufferIndex].lineStarts;
        const startOffsetInBuffer = this.offsetInBuffer(currentNode.piece.bufferIndex, currentNode.piece.start);
        const nextLineStartOffset = lineStarts[start.line + lineBreakCnt];
        const startColumn3 = startLineNumber === searchRange.startLineNumber ? searchRange.startColumn : 1;
        resultLen = this.findMatchesInNode(currentNode, searcher, startLineNumber, startColumn3, start, this.positionInBuffer(currentNode, nextLineStartOffset - startOffsetInBuffer), searchData, captureMatches, limitResultCount, resultLen, result);
        if (resultLen >= limitResultCount) {
          return result;
        }
        startLineNumber += lineBreakCnt;
      }
      const startColumn2 = startLineNumber === searchRange.startLineNumber ? searchRange.startColumn - 1 : 0;
      if (startLineNumber === searchRange.endLineNumber) {
        const text = this.getLineContent(startLineNumber).substring(startColumn2, searchRange.endColumn - 1);
        resultLen = this._findMatchesInLine(searchData, searcher, text, searchRange.endLineNumber, startColumn2, resultLen, result, captureMatches, limitResultCount);
        return result;
      }
      resultLen = this._findMatchesInLine(searchData, searcher, this.getLineContent(startLineNumber).substr(startColumn2), startLineNumber, startColumn2, resultLen, result, captureMatches, limitResultCount);
      if (resultLen >= limitResultCount) {
        return result;
      }
      startLineNumber++;
      startPosition = this.nodeAt2(startLineNumber, 1);
      currentNode = startPosition.node;
      start = this.positionInBuffer(startPosition.node, startPosition.remainder);
    }
    if (startLineNumber === searchRange.endLineNumber) {
      const startColumn2 = startLineNumber === searchRange.startLineNumber ? searchRange.startColumn - 1 : 0;
      const text = this.getLineContent(startLineNumber).substring(startColumn2, searchRange.endColumn - 1);
      resultLen = this._findMatchesInLine(searchData, searcher, text, searchRange.endLineNumber, startColumn2, resultLen, result, captureMatches, limitResultCount);
      return result;
    }
    const startColumn = startLineNumber === searchRange.startLineNumber ? searchRange.startColumn : 1;
    resultLen = this.findMatchesInNode(endPosition.node, searcher, startLineNumber, startColumn, start, end, searchData, captureMatches, limitResultCount, resultLen, result);
    return result;
  }
  _findMatchesInLine(searchData, searcher, text, lineNumber, deltaOffset, resultLen, result, captureMatches, limitResultCount) {
    const wordSeparators = searchData.wordSeparators;
    if (!captureMatches && searchData.simpleSearch) {
      const searchString = searchData.simpleSearch;
      const searchStringLen = searchString.length;
      const textLength = text.length;
      let lastMatchIndex = -searchStringLen;
      while ((lastMatchIndex = text.indexOf(searchString, lastMatchIndex + searchStringLen)) !== -1) {
        if (!wordSeparators || isValidMatch(wordSeparators, text, textLength, lastMatchIndex, searchStringLen)) {
          result[resultLen++] = new FindMatch(new Range(lineNumber, lastMatchIndex + 1 + deltaOffset, lineNumber, lastMatchIndex + 1 + searchStringLen + deltaOffset), null);
          if (resultLen >= limitResultCount) {
            return resultLen;
          }
        }
      }
      return resultLen;
    }
    let m;
    searcher.reset(0);
    do {
      m = searcher.next(text);
      if (m) {
        result[resultLen++] = createFindMatch(new Range(lineNumber, m.index + 1 + deltaOffset, lineNumber, m.index + 1 + m[0].length + deltaOffset), m, captureMatches);
        if (resultLen >= limitResultCount) {
          return resultLen;
        }
      }
    } while (m);
    return resultLen;
  }
  // #endregion
  // #region Piece Table
  insert(offset, value, eolNormalized = false) {
    this._EOLNormalized = this._EOLNormalized && eolNormalized;
    this._lastVisitedLine.lineNumber = 0;
    this._lastVisitedLine.value = "";
    if (this.root !== SENTINEL) {
      const { node, remainder, nodeStartOffset } = this.nodeAt(offset);
      const piece = node.piece;
      const bufferIndex = piece.bufferIndex;
      const insertPosInBuffer = this.positionInBuffer(node, remainder);
      if (node.piece.bufferIndex === 0 && piece.end.line === this._lastChangeBufferPos.line && piece.end.column === this._lastChangeBufferPos.column && nodeStartOffset + piece.length === offset && value.length < AverageBufferSize) {
        this.appendToNode(node, value);
        this.computeBufferMetadata();
        return;
      }
      if (nodeStartOffset === offset) {
        this.insertContentToNodeLeft(value, node);
        this._searchCache.validate(offset);
      } else if (nodeStartOffset + node.piece.length > offset) {
        const nodesToDel = [];
        let newRightPiece = new Piece(
          piece.bufferIndex,
          insertPosInBuffer,
          piece.end,
          this.getLineFeedCnt(piece.bufferIndex, insertPosInBuffer, piece.end),
          this.offsetInBuffer(bufferIndex, piece.end) - this.offsetInBuffer(bufferIndex, insertPosInBuffer)
        );
        if (this.shouldCheckCRLF() && this.endWithCR(value)) {
          const headOfRight = this.nodeCharCodeAt(node, remainder);
          if (headOfRight === 10) {
            const newStart = { line: newRightPiece.start.line + 1, column: 0 };
            newRightPiece = new Piece(
              newRightPiece.bufferIndex,
              newStart,
              newRightPiece.end,
              this.getLineFeedCnt(newRightPiece.bufferIndex, newStart, newRightPiece.end),
              newRightPiece.length - 1
            );
            value += "\n";
          }
        }
        if (this.shouldCheckCRLF() && this.startWithLF(value)) {
          const tailOfLeft = this.nodeCharCodeAt(node, remainder - 1);
          if (tailOfLeft === 13) {
            const previousPos = this.positionInBuffer(node, remainder - 1);
            this.deleteNodeTail(node, previousPos);
            value = "\r" + value;
            if (node.piece.length === 0) {
              nodesToDel.push(node);
            }
          } else {
            this.deleteNodeTail(node, insertPosInBuffer);
          }
        } else {
          this.deleteNodeTail(node, insertPosInBuffer);
        }
        const newPieces = this.createNewPieces(value);
        if (newRightPiece.length > 0) {
          this.rbInsertRight(node, newRightPiece);
        }
        let tmpNode = node;
        for (let k = 0; k < newPieces.length; k++) {
          tmpNode = this.rbInsertRight(tmpNode, newPieces[k]);
        }
        this.deleteNodes(nodesToDel);
      } else {
        this.insertContentToNodeRight(value, node);
      }
    } else {
      const pieces = this.createNewPieces(value);
      let node = this.rbInsertLeft(null, pieces[0]);
      for (let k = 1; k < pieces.length; k++) {
        node = this.rbInsertRight(node, pieces[k]);
      }
    }
    this.computeBufferMetadata();
  }
  delete(offset, cnt) {
    this._lastVisitedLine.lineNumber = 0;
    this._lastVisitedLine.value = "";
    if (cnt <= 0 || this.root === SENTINEL) {
      return;
    }
    const startPosition = this.nodeAt(offset);
    const endPosition = this.nodeAt(offset + cnt);
    const startNode = startPosition.node;
    const endNode = endPosition.node;
    if (startNode === endNode) {
      const startSplitPosInBuffer2 = this.positionInBuffer(startNode, startPosition.remainder);
      const endSplitPosInBuffer2 = this.positionInBuffer(startNode, endPosition.remainder);
      if (startPosition.nodeStartOffset === offset) {
        if (cnt === startNode.piece.length) {
          const next = startNode.next();
          rbDelete(this, startNode);
          this.validateCRLFWithPrevNode(next);
          this.computeBufferMetadata();
          return;
        }
        this.deleteNodeHead(startNode, endSplitPosInBuffer2);
        this._searchCache.validate(offset);
        this.validateCRLFWithPrevNode(startNode);
        this.computeBufferMetadata();
        return;
      }
      if (startPosition.nodeStartOffset + startNode.piece.length === offset + cnt) {
        this.deleteNodeTail(startNode, startSplitPosInBuffer2);
        this.validateCRLFWithNextNode(startNode);
        this.computeBufferMetadata();
        return;
      }
      this.shrinkNode(startNode, startSplitPosInBuffer2, endSplitPosInBuffer2);
      this.computeBufferMetadata();
      return;
    }
    const nodesToDel = [];
    const startSplitPosInBuffer = this.positionInBuffer(startNode, startPosition.remainder);
    this.deleteNodeTail(startNode, startSplitPosInBuffer);
    this._searchCache.validate(offset);
    if (startNode.piece.length === 0) {
      nodesToDel.push(startNode);
    }
    const endSplitPosInBuffer = this.positionInBuffer(endNode, endPosition.remainder);
    this.deleteNodeHead(endNode, endSplitPosInBuffer);
    if (endNode.piece.length === 0) {
      nodesToDel.push(endNode);
    }
    const secondNode = startNode.next();
    for (let node = secondNode; node !== SENTINEL && node !== endNode; node = node.next()) {
      nodesToDel.push(node);
    }
    const prev = startNode.piece.length === 0 ? startNode.prev() : startNode;
    this.deleteNodes(nodesToDel);
    this.validateCRLFWithNextNode(prev);
    this.computeBufferMetadata();
  }
  insertContentToNodeLeft(value, node) {
    const nodesToDel = [];
    if (this.shouldCheckCRLF() && this.endWithCR(value) && this.startWithLF(node)) {
      const piece = node.piece;
      const newStart = { line: piece.start.line + 1, column: 0 };
      const nPiece = new Piece(
        piece.bufferIndex,
        newStart,
        piece.end,
        this.getLineFeedCnt(piece.bufferIndex, newStart, piece.end),
        piece.length - 1
      );
      node.piece = nPiece;
      value += "\n";
      updateTreeMetadata(this, node, -1, -1);
      if (node.piece.length === 0) {
        nodesToDel.push(node);
      }
    }
    const newPieces = this.createNewPieces(value);
    let newNode = this.rbInsertLeft(node, newPieces[newPieces.length - 1]);
    for (let k = newPieces.length - 2; k >= 0; k--) {
      newNode = this.rbInsertLeft(newNode, newPieces[k]);
    }
    this.validateCRLFWithPrevNode(newNode);
    this.deleteNodes(nodesToDel);
  }
  insertContentToNodeRight(value, node) {
    if (this.adjustCarriageReturnFromNext(value, node)) {
      value += "\n";
    }
    const newPieces = this.createNewPieces(value);
    const newNode = this.rbInsertRight(node, newPieces[0]);
    let tmpNode = newNode;
    for (let k = 1; k < newPieces.length; k++) {
      tmpNode = this.rbInsertRight(tmpNode, newPieces[k]);
    }
    this.validateCRLFWithPrevNode(newNode);
  }
  positionInBuffer(node, remainder, ret) {
    const piece = node.piece;
    const bufferIndex = node.piece.bufferIndex;
    const lineStarts = this._buffers[bufferIndex].lineStarts;
    const startOffset = lineStarts[piece.start.line] + piece.start.column;
    const offset = startOffset + remainder;
    let low = piece.start.line;
    let high = piece.end.line;
    let mid = 0;
    let midStop = 0;
    let midStart = 0;
    while (low <= high) {
      mid = low + (high - low) / 2 | 0;
      midStart = lineStarts[mid];
      if (mid === high) {
        break;
      }
      midStop = lineStarts[mid + 1];
      if (offset < midStart) {
        high = mid - 1;
      } else if (offset >= midStop) {
        low = mid + 1;
      } else {
        break;
      }
    }
    if (ret) {
      ret.line = mid;
      ret.column = offset - midStart;
      return null;
    }
    return {
      line: mid,
      column: offset - midStart
    };
  }
  getLineFeedCnt(bufferIndex, start, end) {
    if (end.column === 0) {
      return end.line - start.line;
    }
    const lineStarts = this._buffers[bufferIndex].lineStarts;
    if (end.line === lineStarts.length - 1) {
      return end.line - start.line;
    }
    const nextLineStartOffset = lineStarts[end.line + 1];
    const endOffset = lineStarts[end.line] + end.column;
    if (nextLineStartOffset > endOffset + 1) {
      return end.line - start.line;
    }
    const previousCharOffset = endOffset - 1;
    const buffer = this._buffers[bufferIndex].buffer;
    if (buffer.charCodeAt(previousCharOffset) === 13) {
      return end.line - start.line + 1;
    } else {
      return end.line - start.line;
    }
  }
  offsetInBuffer(bufferIndex, cursor) {
    const lineStarts = this._buffers[bufferIndex].lineStarts;
    return lineStarts[cursor.line] + cursor.column;
  }
  deleteNodes(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      rbDelete(this, nodes[i]);
    }
  }
  createNewPieces(text) {
    if (text.length > AverageBufferSize) {
      const newPieces = [];
      while (text.length > AverageBufferSize) {
        const lastChar = text.charCodeAt(AverageBufferSize - 1);
        let splitText;
        if (lastChar === CharCode.CarriageReturn || lastChar >= 55296 && lastChar <= 56319) {
          splitText = text.substring(0, AverageBufferSize - 1);
          text = text.substring(AverageBufferSize - 1);
        } else {
          splitText = text.substring(0, AverageBufferSize);
          text = text.substring(AverageBufferSize);
        }
        const lineStarts3 = createLineStartsFast(splitText);
        newPieces.push(new Piece(
          this._buffers.length,
          /* buffer index */
          { line: 0, column: 0 },
          { line: lineStarts3.length - 1, column: splitText.length - lineStarts3[lineStarts3.length - 1] },
          lineStarts3.length - 1,
          splitText.length
        ));
        this._buffers.push(new StringBuffer(splitText, lineStarts3));
      }
      const lineStarts2 = createLineStartsFast(text);
      newPieces.push(new Piece(
        this._buffers.length,
        /* buffer index */
        { line: 0, column: 0 },
        { line: lineStarts2.length - 1, column: text.length - lineStarts2[lineStarts2.length - 1] },
        lineStarts2.length - 1,
        text.length
      ));
      this._buffers.push(new StringBuffer(text, lineStarts2));
      return newPieces;
    }
    let startOffset = this._buffers[0].buffer.length;
    const lineStarts = createLineStartsFast(text, false);
    let start = this._lastChangeBufferPos;
    if (this._buffers[0].lineStarts[this._buffers[0].lineStarts.length - 1] === startOffset && startOffset !== 0 && this.startWithLF(text) && this.endWithCR(this._buffers[0].buffer)) {
      this._lastChangeBufferPos = { line: this._lastChangeBufferPos.line, column: this._lastChangeBufferPos.column + 1 };
      start = this._lastChangeBufferPos;
      for (let i = 0; i < lineStarts.length; i++) {
        lineStarts[i] += startOffset + 1;
      }
      this._buffers[0].lineStarts = this._buffers[0].lineStarts.concat(lineStarts.slice(1));
      this._buffers[0].buffer += "_" + text;
      startOffset += 1;
    } else {
      if (startOffset !== 0) {
        for (let i = 0; i < lineStarts.length; i++) {
          lineStarts[i] += startOffset;
        }
      }
      this._buffers[0].lineStarts = this._buffers[0].lineStarts.concat(lineStarts.slice(1));
      this._buffers[0].buffer += text;
    }
    const endOffset = this._buffers[0].buffer.length;
    const endIndex = this._buffers[0].lineStarts.length - 1;
    const endColumn = endOffset - this._buffers[0].lineStarts[endIndex];
    const endPos = { line: endIndex, column: endColumn };
    const newPiece = new Piece(
      0,
      /** todo@peng */
      start,
      endPos,
      this.getLineFeedCnt(0, start, endPos),
      endOffset - startOffset
    );
    this._lastChangeBufferPos = endPos;
    return [newPiece];
  }
  getLinesRawContent() {
    return this.getContentOfSubTree(this.root);
  }
  getLineRawContent(lineNumber, endOffset = 0) {
    let x = this.root;
    let ret = "";
    const cache = this._searchCache.get2(lineNumber);
    if (cache) {
      x = cache.node;
      const prevAccumulatedValue = this.getAccumulatedValue(x, lineNumber - cache.nodeStartLineNumber - 1);
      const buffer = this._buffers[x.piece.bufferIndex].buffer;
      const startOffset = this.offsetInBuffer(x.piece.bufferIndex, x.piece.start);
      if (cache.nodeStartLineNumber + x.piece.lineFeedCnt === lineNumber) {
        ret = buffer.substring(startOffset + prevAccumulatedValue, startOffset + x.piece.length);
      } else {
        const accumulatedValue = this.getAccumulatedValue(x, lineNumber - cache.nodeStartLineNumber);
        return buffer.substring(startOffset + prevAccumulatedValue, startOffset + accumulatedValue - endOffset);
      }
    } else {
      let nodeStartOffset = 0;
      const originalLineNumber = lineNumber;
      while (x !== SENTINEL) {
        if (x.left !== SENTINEL && x.lf_left >= lineNumber - 1) {
          x = x.left;
        } else if (x.lf_left + x.piece.lineFeedCnt > lineNumber - 1) {
          const prevAccumulatedValue = this.getAccumulatedValue(x, lineNumber - x.lf_left - 2);
          const accumulatedValue = this.getAccumulatedValue(x, lineNumber - x.lf_left - 1);
          const buffer = this._buffers[x.piece.bufferIndex].buffer;
          const startOffset = this.offsetInBuffer(x.piece.bufferIndex, x.piece.start);
          nodeStartOffset += x.size_left;
          this._searchCache.set({
            node: x,
            nodeStartOffset,
            nodeStartLineNumber: originalLineNumber - (lineNumber - 1 - x.lf_left)
          });
          return buffer.substring(startOffset + prevAccumulatedValue, startOffset + accumulatedValue - endOffset);
        } else if (x.lf_left + x.piece.lineFeedCnt === lineNumber - 1) {
          const prevAccumulatedValue = this.getAccumulatedValue(x, lineNumber - x.lf_left - 2);
          const buffer = this._buffers[x.piece.bufferIndex].buffer;
          const startOffset = this.offsetInBuffer(x.piece.bufferIndex, x.piece.start);
          ret = buffer.substring(startOffset + prevAccumulatedValue, startOffset + x.piece.length);
          break;
        } else {
          lineNumber -= x.lf_left + x.piece.lineFeedCnt;
          nodeStartOffset += x.size_left + x.piece.length;
          x = x.right;
        }
      }
    }
    x = x.next();
    while (x !== SENTINEL) {
      const buffer = this._buffers[x.piece.bufferIndex].buffer;
      if (x.piece.lineFeedCnt > 0) {
        const accumulatedValue = this.getAccumulatedValue(x, 0);
        const startOffset = this.offsetInBuffer(x.piece.bufferIndex, x.piece.start);
        ret += buffer.substring(startOffset, startOffset + accumulatedValue - endOffset);
        return ret;
      } else {
        const startOffset = this.offsetInBuffer(x.piece.bufferIndex, x.piece.start);
        ret += buffer.substr(startOffset, x.piece.length);
      }
      x = x.next();
    }
    return ret;
  }
  computeBufferMetadata() {
    let x = this.root;
    let lfCnt = 1;
    let len = 0;
    while (x !== SENTINEL) {
      lfCnt += x.lf_left + x.piece.lineFeedCnt;
      len += x.size_left + x.piece.length;
      x = x.right;
    }
    this._lineCnt = lfCnt;
    this._length = len;
    this._searchCache.validate(this._length);
  }
  // #region node operations
  getIndexOf(node, accumulatedValue) {
    const piece = node.piece;
    const pos = this.positionInBuffer(node, accumulatedValue);
    const lineCnt = pos.line - piece.start.line;
    if (this.offsetInBuffer(piece.bufferIndex, piece.end) - this.offsetInBuffer(piece.bufferIndex, piece.start) === accumulatedValue) {
      const realLineCnt = this.getLineFeedCnt(node.piece.bufferIndex, piece.start, pos);
      if (realLineCnt !== lineCnt) {
        return { index: realLineCnt, remainder: 0 };
      }
    }
    return { index: lineCnt, remainder: pos.column };
  }
  getAccumulatedValue(node, index) {
    if (index < 0) {
      return 0;
    }
    const piece = node.piece;
    const lineStarts = this._buffers[piece.bufferIndex].lineStarts;
    const expectedLineStartIndex = piece.start.line + index + 1;
    if (expectedLineStartIndex > piece.end.line) {
      return lineStarts[piece.end.line] + piece.end.column - lineStarts[piece.start.line] - piece.start.column;
    } else {
      return lineStarts[expectedLineStartIndex] - lineStarts[piece.start.line] - piece.start.column;
    }
  }
  deleteNodeTail(node, pos) {
    const piece = node.piece;
    const originalLFCnt = piece.lineFeedCnt;
    const originalEndOffset = this.offsetInBuffer(piece.bufferIndex, piece.end);
    const newEnd = pos;
    const newEndOffset = this.offsetInBuffer(piece.bufferIndex, newEnd);
    const newLineFeedCnt = this.getLineFeedCnt(piece.bufferIndex, piece.start, newEnd);
    const lf_delta = newLineFeedCnt - originalLFCnt;
    const size_delta = newEndOffset - originalEndOffset;
    const newLength = piece.length + size_delta;
    node.piece = new Piece(
      piece.bufferIndex,
      piece.start,
      newEnd,
      newLineFeedCnt,
      newLength
    );
    updateTreeMetadata(this, node, size_delta, lf_delta);
  }
  deleteNodeHead(node, pos) {
    const piece = node.piece;
    const originalLFCnt = piece.lineFeedCnt;
    const originalStartOffset = this.offsetInBuffer(piece.bufferIndex, piece.start);
    const newStart = pos;
    const newLineFeedCnt = this.getLineFeedCnt(piece.bufferIndex, newStart, piece.end);
    const newStartOffset = this.offsetInBuffer(piece.bufferIndex, newStart);
    const lf_delta = newLineFeedCnt - originalLFCnt;
    const size_delta = originalStartOffset - newStartOffset;
    const newLength = piece.length + size_delta;
    node.piece = new Piece(
      piece.bufferIndex,
      newStart,
      piece.end,
      newLineFeedCnt,
      newLength
    );
    updateTreeMetadata(this, node, size_delta, lf_delta);
  }
  shrinkNode(node, start, end) {
    const piece = node.piece;
    const originalStartPos = piece.start;
    const originalEndPos = piece.end;
    const oldLength = piece.length;
    const oldLFCnt = piece.lineFeedCnt;
    const newEnd = start;
    const newLineFeedCnt = this.getLineFeedCnt(piece.bufferIndex, piece.start, newEnd);
    const newLength = this.offsetInBuffer(piece.bufferIndex, start) - this.offsetInBuffer(piece.bufferIndex, originalStartPos);
    node.piece = new Piece(
      piece.bufferIndex,
      piece.start,
      newEnd,
      newLineFeedCnt,
      newLength
    );
    updateTreeMetadata(this, node, newLength - oldLength, newLineFeedCnt - oldLFCnt);
    const newPiece = new Piece(
      piece.bufferIndex,
      end,
      originalEndPos,
      this.getLineFeedCnt(piece.bufferIndex, end, originalEndPos),
      this.offsetInBuffer(piece.bufferIndex, originalEndPos) - this.offsetInBuffer(piece.bufferIndex, end)
    );
    const newNode = this.rbInsertRight(node, newPiece);
    this.validateCRLFWithPrevNode(newNode);
  }
  appendToNode(node, value) {
    if (this.adjustCarriageReturnFromNext(value, node)) {
      value += "\n";
    }
    const hitCRLF = this.shouldCheckCRLF() && this.startWithLF(value) && this.endWithCR(node);
    const startOffset = this._buffers[0].buffer.length;
    this._buffers[0].buffer += value;
    const lineStarts = createLineStartsFast(value, false);
    for (let i = 0; i < lineStarts.length; i++) {
      lineStarts[i] += startOffset;
    }
    if (hitCRLF) {
      const prevStartOffset = this._buffers[0].lineStarts[this._buffers[0].lineStarts.length - 2];
      this._buffers[0].lineStarts.pop();
      this._lastChangeBufferPos = { line: this._lastChangeBufferPos.line - 1, column: startOffset - prevStartOffset };
    }
    this._buffers[0].lineStarts = this._buffers[0].lineStarts.concat(lineStarts.slice(1));
    const endIndex = this._buffers[0].lineStarts.length - 1;
    const endColumn = this._buffers[0].buffer.length - this._buffers[0].lineStarts[endIndex];
    const newEnd = { line: endIndex, column: endColumn };
    const newLength = node.piece.length + value.length;
    const oldLineFeedCnt = node.piece.lineFeedCnt;
    const newLineFeedCnt = this.getLineFeedCnt(0, node.piece.start, newEnd);
    const lf_delta = newLineFeedCnt - oldLineFeedCnt;
    node.piece = new Piece(
      node.piece.bufferIndex,
      node.piece.start,
      newEnd,
      newLineFeedCnt,
      newLength
    );
    this._lastChangeBufferPos = newEnd;
    updateTreeMetadata(this, node, value.length, lf_delta);
  }
  nodeAt(offset) {
    let x = this.root;
    const cache = this._searchCache.get(offset);
    if (cache) {
      return {
        node: cache.node,
        nodeStartOffset: cache.nodeStartOffset,
        remainder: offset - cache.nodeStartOffset
      };
    }
    let nodeStartOffset = 0;
    while (x !== SENTINEL) {
      if (x.size_left > offset) {
        x = x.left;
      } else if (x.size_left + x.piece.length >= offset) {
        nodeStartOffset += x.size_left;
        const ret = {
          node: x,
          remainder: offset - x.size_left,
          nodeStartOffset
        };
        this._searchCache.set(ret);
        return ret;
      } else {
        offset -= x.size_left + x.piece.length;
        nodeStartOffset += x.size_left + x.piece.length;
        x = x.right;
      }
    }
    return null;
  }
  nodeAt2(lineNumber, column) {
    let x = this.root;
    let nodeStartOffset = 0;
    while (x !== SENTINEL) {
      if (x.left !== SENTINEL && x.lf_left >= lineNumber - 1) {
        x = x.left;
      } else if (x.lf_left + x.piece.lineFeedCnt > lineNumber - 1) {
        const prevAccumualtedValue = this.getAccumulatedValue(x, lineNumber - x.lf_left - 2);
        const accumulatedValue = this.getAccumulatedValue(x, lineNumber - x.lf_left - 1);
        nodeStartOffset += x.size_left;
        return {
          node: x,
          remainder: Math.min(prevAccumualtedValue + column - 1, accumulatedValue),
          nodeStartOffset
        };
      } else if (x.lf_left + x.piece.lineFeedCnt === lineNumber - 1) {
        const prevAccumualtedValue = this.getAccumulatedValue(x, lineNumber - x.lf_left - 2);
        if (prevAccumualtedValue + column - 1 <= x.piece.length) {
          return {
            node: x,
            remainder: prevAccumualtedValue + column - 1,
            nodeStartOffset
          };
        } else {
          column -= x.piece.length - prevAccumualtedValue;
          break;
        }
      } else {
        lineNumber -= x.lf_left + x.piece.lineFeedCnt;
        nodeStartOffset += x.size_left + x.piece.length;
        x = x.right;
      }
    }
    x = x.next();
    while (x !== SENTINEL) {
      if (x.piece.lineFeedCnt > 0) {
        const accumulatedValue = this.getAccumulatedValue(x, 0);
        const nodeStartOffset2 = this.offsetOfNode(x);
        return {
          node: x,
          remainder: Math.min(column - 1, accumulatedValue),
          nodeStartOffset: nodeStartOffset2
        };
      } else {
        if (x.piece.length >= column - 1) {
          const nodeStartOffset2 = this.offsetOfNode(x);
          return {
            node: x,
            remainder: column - 1,
            nodeStartOffset: nodeStartOffset2
          };
        } else {
          column -= x.piece.length;
        }
      }
      x = x.next();
    }
    return null;
  }
  nodeCharCodeAt(node, offset) {
    if (node.piece.lineFeedCnt < 1) {
      return -1;
    }
    const buffer = this._buffers[node.piece.bufferIndex];
    const newOffset = this.offsetInBuffer(node.piece.bufferIndex, node.piece.start) + offset;
    return buffer.buffer.charCodeAt(newOffset);
  }
  offsetOfNode(node) {
    if (!node) {
      return 0;
    }
    let pos = node.size_left;
    while (node !== this.root) {
      if (node.parent.right === node) {
        pos += node.parent.size_left + node.parent.piece.length;
      }
      node = node.parent;
    }
    return pos;
  }
  // #endregion
  // #region CRLF
  shouldCheckCRLF() {
    return !(this._EOLNormalized && this._EOL === "\n");
  }
  startWithLF(val) {
    if (typeof val === "string") {
      return val.charCodeAt(0) === 10;
    }
    if (val === SENTINEL || val.piece.lineFeedCnt === 0) {
      return false;
    }
    const piece = val.piece;
    const lineStarts = this._buffers[piece.bufferIndex].lineStarts;
    const line = piece.start.line;
    const startOffset = lineStarts[line] + piece.start.column;
    if (line === lineStarts.length - 1) {
      return false;
    }
    const nextLineOffset = lineStarts[line + 1];
    if (nextLineOffset > startOffset + 1) {
      return false;
    }
    return this._buffers[piece.bufferIndex].buffer.charCodeAt(startOffset) === 10;
  }
  endWithCR(val) {
    if (typeof val === "string") {
      return val.charCodeAt(val.length - 1) === 13;
    }
    if (val === SENTINEL || val.piece.lineFeedCnt === 0) {
      return false;
    }
    return this.nodeCharCodeAt(val, val.piece.length - 1) === 13;
  }
  validateCRLFWithPrevNode(nextNode) {
    if (this.shouldCheckCRLF() && this.startWithLF(nextNode)) {
      const node = nextNode.prev();
      if (this.endWithCR(node)) {
        this.fixCRLF(node, nextNode);
      }
    }
  }
  validateCRLFWithNextNode(node) {
    if (this.shouldCheckCRLF() && this.endWithCR(node)) {
      const nextNode = node.next();
      if (this.startWithLF(nextNode)) {
        this.fixCRLF(node, nextNode);
      }
    }
  }
  fixCRLF(prev, next) {
    const nodesToDel = [];
    const lineStarts = this._buffers[prev.piece.bufferIndex].lineStarts;
    let newEnd;
    if (prev.piece.end.column === 0) {
      newEnd = { line: prev.piece.end.line - 1, column: lineStarts[prev.piece.end.line] - lineStarts[prev.piece.end.line - 1] - 1 };
    } else {
      newEnd = { line: prev.piece.end.line, column: prev.piece.end.column - 1 };
    }
    const prevNewLength = prev.piece.length - 1;
    const prevNewLFCnt = prev.piece.lineFeedCnt - 1;
    prev.piece = new Piece(
      prev.piece.bufferIndex,
      prev.piece.start,
      newEnd,
      prevNewLFCnt,
      prevNewLength
    );
    updateTreeMetadata(this, prev, -1, -1);
    if (prev.piece.length === 0) {
      nodesToDel.push(prev);
    }
    const newStart = { line: next.piece.start.line + 1, column: 0 };
    const newLength = next.piece.length - 1;
    const newLineFeedCnt = this.getLineFeedCnt(next.piece.bufferIndex, newStart, next.piece.end);
    next.piece = new Piece(
      next.piece.bufferIndex,
      newStart,
      next.piece.end,
      newLineFeedCnt,
      newLength
    );
    updateTreeMetadata(this, next, -1, -1);
    if (next.piece.length === 0) {
      nodesToDel.push(next);
    }
    const pieces = this.createNewPieces("\r\n");
    this.rbInsertRight(prev, pieces[0]);
    for (let i = 0; i < nodesToDel.length; i++) {
      rbDelete(this, nodesToDel[i]);
    }
  }
  adjustCarriageReturnFromNext(value, node) {
    if (this.shouldCheckCRLF() && this.endWithCR(value)) {
      const nextNode = node.next();
      if (this.startWithLF(nextNode)) {
        value += "\n";
        if (nextNode.piece.length === 1) {
          rbDelete(this, nextNode);
        } else {
          const piece = nextNode.piece;
          const newStart = { line: piece.start.line + 1, column: 0 };
          const newLength = piece.length - 1;
          const newLineFeedCnt = this.getLineFeedCnt(piece.bufferIndex, newStart, piece.end);
          nextNode.piece = new Piece(
            piece.bufferIndex,
            newStart,
            piece.end,
            newLineFeedCnt,
            newLength
          );
          updateTreeMetadata(this, nextNode, -1, -1);
        }
        return true;
      }
    }
    return false;
  }
  // #endregion
  // #endregion
  // #region Tree operations
  iterate(node, callback) {
    if (node === SENTINEL) {
      return callback(SENTINEL);
    }
    const leftRet = this.iterate(node.left, callback);
    if (!leftRet) {
      return leftRet;
    }
    return callback(node) && this.iterate(node.right, callback);
  }
  getNodeContent(node) {
    if (node === SENTINEL) {
      return "";
    }
    const buffer = this._buffers[node.piece.bufferIndex];
    const piece = node.piece;
    const startOffset = this.offsetInBuffer(piece.bufferIndex, piece.start);
    const endOffset = this.offsetInBuffer(piece.bufferIndex, piece.end);
    const currentContent = buffer.buffer.substring(startOffset, endOffset);
    return currentContent;
  }
  getPieceContent(piece) {
    const buffer = this._buffers[piece.bufferIndex];
    const startOffset = this.offsetInBuffer(piece.bufferIndex, piece.start);
    const endOffset = this.offsetInBuffer(piece.bufferIndex, piece.end);
    const currentContent = buffer.buffer.substring(startOffset, endOffset);
    return currentContent;
  }
  /**
   *      node              node
   *     /  \              /  \
   *    a   b    <----   a    b
   *                         /
   *                        z
   */
  rbInsertRight(node, p) {
    const z = new TreeNode(p, NodeColor.Red);
    z.left = SENTINEL;
    z.right = SENTINEL;
    z.parent = SENTINEL;
    z.size_left = 0;
    z.lf_left = 0;
    const x = this.root;
    if (x === SENTINEL) {
      this.root = z;
      z.color = NodeColor.Black;
    } else if (node.right === SENTINEL) {
      node.right = z;
      z.parent = node;
    } else {
      const nextNode = leftest(node.right);
      nextNode.left = z;
      z.parent = nextNode;
    }
    fixInsert(this, z);
    return z;
  }
  /**
   *      node              node
   *     /  \              /  \
   *    a   b     ---->   a    b
   *                       \
   *                        z
   */
  rbInsertLeft(node, p) {
    const z = new TreeNode(p, NodeColor.Red);
    z.left = SENTINEL;
    z.right = SENTINEL;
    z.parent = SENTINEL;
    z.size_left = 0;
    z.lf_left = 0;
    if (this.root === SENTINEL) {
      this.root = z;
      z.color = NodeColor.Black;
    } else if (node.left === SENTINEL) {
      node.left = z;
      z.parent = node;
    } else {
      const prevNode = righttest(node.left);
      prevNode.right = z;
      z.parent = prevNode;
    }
    fixInsert(this, z);
    return z;
  }
  getContentOfSubTree(node) {
    let str = "";
    this.iterate(node, (node2) => {
      str += this.getNodeContent(node2);
      return true;
    });
    return str;
  }
  // #endregion
}
export {
  Piece,
  PieceTreeBase,
  StringBuffer,
  createLineStarts,
  createLineStartsFast
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL3BpZWNlVHJlZVRleHRCdWZmZXIvcGllY2VUcmVlQmFzZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBGaW5kTWF0Y2gsIElUZXh0U25hcHNob3QsIFNlYXJjaERhdGEgfSBmcm9tICcuLi8uLi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBOb2RlQ29sb3IsIFNFTlRJTkVMLCBUcmVlTm9kZSwgZml4SW5zZXJ0LCBsZWZ0ZXN0LCByYkRlbGV0ZSwgcmlnaHR0ZXN0LCB1cGRhdGVUcmVlTWV0YWRhdGEgfSBmcm9tICcuL3JiVHJlZUJhc2UuanMnO1xuaW1wb3J0IHsgU2VhcmNoZXIsIGNyZWF0ZUZpbmRNYXRjaCwgaXNWYWxpZE1hdGNoIH0gZnJvbSAnLi4vdGV4dE1vZGVsU2VhcmNoLmpzJztcblxuLy8gY29uc3QgbGZSZWdleCA9IG5ldyBSZWdFeHAoL1xcclxcbnxcXHJ8XFxuL2cpO1xuY29uc3QgQXZlcmFnZUJ1ZmZlclNpemUgPSA2NTUzNTtcblxuZnVuY3Rpb24gY3JlYXRlVWludEFycmF5KGFycjogbnVtYmVyW10pOiBVaW50MzJBcnJheSB8IFVpbnQxNkFycmF5IHtcblx0bGV0IHI7XG5cdGlmIChhcnJbYXJyLmxlbmd0aCAtIDFdIDwgNjU1MzYpIHtcblx0XHRyID0gbmV3IFVpbnQxNkFycmF5KGFyci5sZW5ndGgpO1xuXHR9IGVsc2Uge1xuXHRcdHIgPSBuZXcgVWludDMyQXJyYXkoYXJyLmxlbmd0aCk7XG5cdH1cblx0ci5zZXQoYXJyLCAwKTtcblx0cmV0dXJuIHI7XG59XG5cbmNsYXNzIExpbmVTdGFydHMge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGluZVN0YXJ0czogVWludDMyQXJyYXkgfCBVaW50MTZBcnJheSB8IG51bWJlcltdLFxuXHRcdHB1YmxpYyByZWFkb25seSBjcjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBsZjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBjcmxmOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGlzQmFzaWNBU0NJSTogYm9vbGVhblxuXHQpIHsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGluZVN0YXJ0c0Zhc3Qoc3RyOiBzdHJpbmcsIHJlYWRvbmx5OiBib29sZWFuID0gdHJ1ZSk6IFVpbnQzMkFycmF5IHwgVWludDE2QXJyYXkgfCBudW1iZXJbXSB7XG5cdGNvbnN0IHI6IG51bWJlcltdID0gWzBdO1xuXHRsZXQgckxlbmd0aCA9IDE7XG5cblx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdGNvbnN0IGNociA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXG5cdFx0aWYgKGNociA9PT0gQ2hhckNvZGUuQ2FycmlhZ2VSZXR1cm4pIHtcblx0XHRcdGlmIChpICsgMSA8IGxlbiAmJiBzdHIuY2hhckNvZGVBdChpICsgMSkgPT09IENoYXJDb2RlLkxpbmVGZWVkKSB7XG5cdFx0XHRcdC8vIFxcclxcbi4uLiBjYXNlXG5cdFx0XHRcdHJbckxlbmd0aCsrXSA9IGkgKyAyO1xuXHRcdFx0XHRpKys7IC8vIHNraXAgXFxuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBcXHIuLi4gY2FzZVxuXHRcdFx0XHRyW3JMZW5ndGgrK10gPSBpICsgMTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGNociA9PT0gQ2hhckNvZGUuTGluZUZlZWQpIHtcblx0XHRcdHJbckxlbmd0aCsrXSA9IGkgKyAxO1xuXHRcdH1cblx0fVxuXHRpZiAocmVhZG9ubHkpIHtcblx0XHRyZXR1cm4gY3JlYXRlVWludEFycmF5KHIpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiByO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMaW5lU3RhcnRzKHI6IG51bWJlcltdLCBzdHI6IHN0cmluZyk6IExpbmVTdGFydHMge1xuXHRyLmxlbmd0aCA9IDA7XG5cdHJbMF0gPSAwO1xuXHRsZXQgckxlbmd0aCA9IDE7XG5cdGxldCBjciA9IDAsIGxmID0gMCwgY3JsZiA9IDA7XG5cdGxldCBpc0Jhc2ljQVNDSUkgPSB0cnVlO1xuXHRmb3IgKGxldCBpID0gMCwgbGVuID0gc3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0Y29uc3QgY2hyID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cblx0XHRpZiAoY2hyID09PSBDaGFyQ29kZS5DYXJyaWFnZVJldHVybikge1xuXHRcdFx0aWYgKGkgKyAxIDwgbGVuICYmIHN0ci5jaGFyQ29kZUF0KGkgKyAxKSA9PT0gQ2hhckNvZGUuTGluZUZlZWQpIHtcblx0XHRcdFx0Ly8gXFxyXFxuLi4uIGNhc2Vcblx0XHRcdFx0Y3JsZisrO1xuXHRcdFx0XHRyW3JMZW5ndGgrK10gPSBpICsgMjtcblx0XHRcdFx0aSsrOyAvLyBza2lwIFxcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y3IrKztcblx0XHRcdFx0Ly8gXFxyLi4uIGNhc2Vcblx0XHRcdFx0cltyTGVuZ3RoKytdID0gaSArIDE7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjaHIgPT09IENoYXJDb2RlLkxpbmVGZWVkKSB7XG5cdFx0XHRsZisrO1xuXHRcdFx0cltyTGVuZ3RoKytdID0gaSArIDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChpc0Jhc2ljQVNDSUkpIHtcblx0XHRcdFx0aWYgKGNociAhPT0gQ2hhckNvZGUuVGFiICYmIChjaHIgPCAzMiB8fCBjaHIgPiAxMjYpKSB7XG5cdFx0XHRcdFx0aXNCYXNpY0FTQ0lJID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0Y29uc3QgcmVzdWx0ID0gbmV3IExpbmVTdGFydHMoY3JlYXRlVWludEFycmF5KHIpLCBjciwgbGYsIGNybGYsIGlzQmFzaWNBU0NJSSk7XG5cdHIubGVuZ3RoID0gMDtcblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5pbnRlcmZhY2UgTm9kZVBvc2l0aW9uIHtcblx0LyoqXG5cdCAqIFBpZWNlIEluZGV4XG5cdCAqL1xuXHRub2RlOiBUcmVlTm9kZTtcblx0LyoqXG5cdCAqIHJlbWFpbmRlciBpbiBjdXJyZW50IHBpZWNlLlxuXHQqL1xuXHRyZW1haW5kZXI6IG51bWJlcjtcblx0LyoqXG5cdCAqIG5vZGUgc3RhcnQgb2Zmc2V0IGluIGRvY3VtZW50LlxuXHQgKi9cblx0bm9kZVN0YXJ0T2Zmc2V0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBCdWZmZXJDdXJzb3Ige1xuXHQvKipcblx0ICogTGluZSBudW1iZXIgaW4gY3VycmVudCBidWZmZXJcblx0ICovXG5cdGxpbmU6IG51bWJlcjtcblx0LyoqXG5cdCAqIENvbHVtbiBudW1iZXIgaW4gY3VycmVudCBidWZmZXJcblx0ICovXG5cdGNvbHVtbjogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgUGllY2Uge1xuXHRyZWFkb25seSBidWZmZXJJbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBzdGFydDogQnVmZmVyQ3Vyc29yO1xuXHRyZWFkb25seSBlbmQ6IEJ1ZmZlckN1cnNvcjtcblx0cmVhZG9ubHkgbGVuZ3RoOiBudW1iZXI7XG5cdHJlYWRvbmx5IGxpbmVGZWVkQ250OiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoYnVmZmVySW5kZXg6IG51bWJlciwgc3RhcnQ6IEJ1ZmZlckN1cnNvciwgZW5kOiBCdWZmZXJDdXJzb3IsIGxpbmVGZWVkQ250OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSB7XG5cdFx0dGhpcy5idWZmZXJJbmRleCA9IGJ1ZmZlckluZGV4O1xuXHRcdHRoaXMuc3RhcnQgPSBzdGFydDtcblx0XHR0aGlzLmVuZCA9IGVuZDtcblx0XHR0aGlzLmxpbmVGZWVkQ250ID0gbGluZUZlZWRDbnQ7XG5cdFx0dGhpcy5sZW5ndGggPSBsZW5ndGg7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0cmluZ0J1ZmZlciB7XG5cdGJ1ZmZlcjogc3RyaW5nO1xuXHRsaW5lU3RhcnRzOiBVaW50MzJBcnJheSB8IFVpbnQxNkFycmF5IHwgbnVtYmVyW107XG5cblx0Y29uc3RydWN0b3IoYnVmZmVyOiBzdHJpbmcsIGxpbmVTdGFydHM6IFVpbnQzMkFycmF5IHwgVWludDE2QXJyYXkgfCBudW1iZXJbXSkge1xuXHRcdHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuXHRcdHRoaXMubGluZVN0YXJ0cyA9IGxpbmVTdGFydHM7XG5cdH1cbn1cblxuLyoqXG4gKiBSZWFkb25seSBzbmFwc2hvdCBmb3IgcGllY2UgdHJlZS5cbiAqIEluIGEgcmVhbCBtdWx0aXBsZSB0aHJlYWQgZW52aXJvbm1lbnQsIHRvIG1ha2Ugc25hcHNob3QgcmVhZGluZyBhbHdheXMgd29yayBjb3JyZWN0bHksIHdlIG5lZWQgdG9cbiAqIDEuIE1ha2UgVHJlZU5vZGUucGllY2UgaW1tdXRhYmxlLCB0aGVuIHJlYWRpbmcgYW5kIHdyaXRpbmcgY2FuIHJ1biBpbiBwYXJhbGxlbC5cbiAqIDIuIFRyZWVOb2RlL0J1ZmZlcnMgbm9ybWFsaXphdGlvbiBzaG91bGQgbm90IGhhcHBlbiBkdXJpbmcgc25hcHNob3QgcmVhZGluZy5cbiAqL1xuY2xhc3MgUGllY2VUcmVlU25hcHNob3QgaW1wbGVtZW50cyBJVGV4dFNuYXBzaG90IHtcblx0cHJpdmF0ZSByZWFkb25seSBfcGllY2VzOiBQaWVjZVtdO1xuXHRwcml2YXRlIF9pbmRleDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90cmVlOiBQaWVjZVRyZWVCYXNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9CT006IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcih0cmVlOiBQaWVjZVRyZWVCYXNlLCBCT006IHN0cmluZykge1xuXHRcdHRoaXMuX3BpZWNlcyA9IFtdO1xuXHRcdHRoaXMuX3RyZWUgPSB0cmVlO1xuXHRcdHRoaXMuX0JPTSA9IEJPTTtcblx0XHR0aGlzLl9pbmRleCA9IDA7XG5cdFx0aWYgKHRyZWUucm9vdCAhPT0gU0VOVElORUwpIHtcblx0XHRcdHRyZWUuaXRlcmF0ZSh0cmVlLnJvb3QsIG5vZGUgPT4ge1xuXHRcdFx0XHRpZiAobm9kZSAhPT0gU0VOVElORUwpIHtcblx0XHRcdFx0XHR0aGlzLl9waWVjZXMucHVzaChub2RlLnBpZWNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHJlYWQoKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuX3BpZWNlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGlmICh0aGlzLl9pbmRleCA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLl9pbmRleCsrO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fQk9NO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2luZGV4ID4gdGhpcy5fcGllY2VzLmxlbmd0aCAtIDEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9pbmRleCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX0JPTSArIHRoaXMuX3RyZWUuZ2V0UGllY2VDb250ZW50KHRoaXMuX3BpZWNlc1t0aGlzLl9pbmRleCsrXSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90cmVlLmdldFBpZWNlQ29udGVudCh0aGlzLl9waWVjZXNbdGhpcy5faW5kZXgrK10pO1xuXHR9XG59XG5cbmludGVyZmFjZSBDYWNoZUVudHJ5IHtcblx0bm9kZTogVHJlZU5vZGU7XG5cdG5vZGVTdGFydE9mZnNldDogbnVtYmVyO1xuXHRub2RlU3RhcnRMaW5lTnVtYmVyPzogbnVtYmVyO1xufVxuXG5jbGFzcyBQaWVjZVRyZWVTZWFyY2hDYWNoZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpbWl0OiBudW1iZXI7XG5cdHByaXZhdGUgX2NhY2hlOiBDYWNoZUVudHJ5W107XG5cblx0Y29uc3RydWN0b3IobGltaXQ6IG51bWJlcikge1xuXHRcdHRoaXMuX2xpbWl0ID0gbGltaXQ7XG5cdFx0dGhpcy5fY2FjaGUgPSBbXTtcblx0fVxuXG5cdHB1YmxpYyBnZXQob2Zmc2V0OiBudW1iZXIpOiBDYWNoZUVudHJ5IHwgbnVsbCB7XG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMuX2NhY2hlLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBub2RlUG9zID0gdGhpcy5fY2FjaGVbaV07XG5cdFx0XHRpZiAobm9kZVBvcy5ub2RlU3RhcnRPZmZzZXQgPD0gb2Zmc2V0ICYmIG5vZGVQb3Mubm9kZVN0YXJ0T2Zmc2V0ICsgbm9kZVBvcy5ub2RlLnBpZWNlLmxlbmd0aCA+PSBvZmZzZXQpIHtcblx0XHRcdFx0cmV0dXJuIG5vZGVQb3M7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHVibGljIGdldDIobGluZU51bWJlcjogbnVtYmVyKTogeyBub2RlOiBUcmVlTm9kZTsgbm9kZVN0YXJ0T2Zmc2V0OiBudW1iZXI7IG5vZGVTdGFydExpbmVOdW1iZXI6IG51bWJlciB9IHwgbnVsbCB7XG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMuX2NhY2hlLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBub2RlUG9zID0gdGhpcy5fY2FjaGVbaV07XG5cdFx0XHRpZiAobm9kZVBvcy5ub2RlU3RhcnRMaW5lTnVtYmVyICYmIG5vZGVQb3Mubm9kZVN0YXJ0TGluZU51bWJlciA8IGxpbmVOdW1iZXIgJiYgbm9kZVBvcy5ub2RlU3RhcnRMaW5lTnVtYmVyICsgbm9kZVBvcy5ub2RlLnBpZWNlLmxpbmVGZWVkQ250ID49IGxpbmVOdW1iZXIpIHtcblx0XHRcdFx0cmV0dXJuIDx7IG5vZGU6IFRyZWVOb2RlOyBub2RlU3RhcnRPZmZzZXQ6IG51bWJlcjsgbm9kZVN0YXJ0TGluZU51bWJlcjogbnVtYmVyIH0+bm9kZVBvcztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwdWJsaWMgc2V0KG5vZGVQb3NpdGlvbjogQ2FjaGVFbnRyeSkge1xuXHRcdGlmICh0aGlzLl9jYWNoZS5sZW5ndGggPj0gdGhpcy5fbGltaXQpIHtcblx0XHRcdHRoaXMuX2NhY2hlLnNoaWZ0KCk7XG5cdFx0fVxuXHRcdHRoaXMuX2NhY2hlLnB1c2gobm9kZVBvc2l0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShvZmZzZXQ6IG51bWJlcikge1xuXHRcdGxldCBoYXNJbnZhbGlkVmFsID0gZmFsc2U7XG5cdFx0Y29uc3QgdG1wOiBBcnJheTxDYWNoZUVudHJ5IHwgbnVsbD4gPSB0aGlzLl9jYWNoZTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRtcC5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3Qgbm9kZVBvcyA9IHRtcFtpXSE7XG5cdFx0XHRpZiAobm9kZVBvcy5ub2RlLnBhcmVudCA9PT0gbnVsbCB8fCBub2RlUG9zLm5vZGVTdGFydE9mZnNldCA+PSBvZmZzZXQpIHtcblx0XHRcdFx0dG1wW2ldID0gbnVsbDtcblx0XHRcdFx0aGFzSW52YWxpZFZhbCA9IHRydWU7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChoYXNJbnZhbGlkVmFsKSB7XG5cdFx0XHRjb25zdCBuZXdBcnI6IENhY2hlRW50cnlbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0bXApIHtcblx0XHRcdFx0aWYgKGVudHJ5ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0bmV3QXJyLnB1c2goZW50cnkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2NhY2hlID0gbmV3QXJyO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUGllY2VUcmVlQmFzZSB7XG5cdHJvb3QhOiBUcmVlTm9kZTtcblx0cHJvdGVjdGVkIF9idWZmZXJzITogU3RyaW5nQnVmZmVyW107IC8vIDAgaXMgY2hhbmdlIGJ1ZmZlciwgb3RoZXJzIGFyZSByZWFkb25seSBvcmlnaW5hbCBidWZmZXIuXG5cdHByb3RlY3RlZCBfbGluZUNudCE6IG51bWJlcjtcblx0cHJvdGVjdGVkIF9sZW5ndGghOiBudW1iZXI7XG5cdHByb3RlY3RlZCBfRU9MITogJ1xcclxcbicgfCAnXFxuJztcblx0cHJvdGVjdGVkIF9FT0xMZW5ndGghOiBudW1iZXI7XG5cdHByb3RlY3RlZCBfRU9MTm9ybWFsaXplZCE6IGJvb2xlYW47XG5cdHByaXZhdGUgX2xhc3RDaGFuZ2VCdWZmZXJQb3MhOiBCdWZmZXJDdXJzb3I7XG5cdHByaXZhdGUgX3NlYXJjaENhY2hlITogUGllY2VUcmVlU2VhcmNoQ2FjaGU7XG5cdHByaXZhdGUgX2xhc3RWaXNpdGVkTGluZSE6IHsgbGluZU51bWJlcjogbnVtYmVyOyB2YWx1ZTogc3RyaW5nIH07XG5cblx0Y29uc3RydWN0b3IoY2h1bmtzOiBTdHJpbmdCdWZmZXJbXSwgZW9sOiAnXFxyXFxuJyB8ICdcXG4nLCBlb2xOb3JtYWxpemVkOiBib29sZWFuKSB7XG5cdFx0dGhpcy5jcmVhdGUoY2h1bmtzLCBlb2wsIGVvbE5vcm1hbGl6ZWQpO1xuXHR9XG5cblx0Y3JlYXRlKGNodW5rczogU3RyaW5nQnVmZmVyW10sIGVvbDogJ1xcclxcbicgfCAnXFxuJywgZW9sTm9ybWFsaXplZDogYm9vbGVhbikge1xuXHRcdHRoaXMuX2J1ZmZlcnMgPSBbXG5cdFx0XHRuZXcgU3RyaW5nQnVmZmVyKCcnLCBbMF0pXG5cdFx0XTtcblx0XHR0aGlzLl9sYXN0Q2hhbmdlQnVmZmVyUG9zID0geyBsaW5lOiAwLCBjb2x1bW46IDAgfTtcblx0XHR0aGlzLnJvb3QgPSBTRU5USU5FTDtcblx0XHR0aGlzLl9saW5lQ250ID0gMTtcblx0XHR0aGlzLl9sZW5ndGggPSAwO1xuXHRcdHRoaXMuX0VPTCA9IGVvbDtcblx0XHR0aGlzLl9FT0xMZW5ndGggPSBlb2wubGVuZ3RoO1xuXHRcdHRoaXMuX0VPTE5vcm1hbGl6ZWQgPSBlb2xOb3JtYWxpemVkO1xuXG5cdFx0bGV0IGxhc3ROb2RlOiBUcmVlTm9kZSB8IG51bGwgPSBudWxsO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaHVua3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGlmIChjaHVua3NbaV0uYnVmZmVyLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0aWYgKCFjaHVua3NbaV0ubGluZVN0YXJ0cykge1xuXHRcdFx0XHRcdGNodW5rc1tpXS5saW5lU3RhcnRzID0gY3JlYXRlTGluZVN0YXJ0c0Zhc3QoY2h1bmtzW2ldLmJ1ZmZlcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBwaWVjZSA9IG5ldyBQaWVjZShcblx0XHRcdFx0XHRpICsgMSxcblx0XHRcdFx0XHR7IGxpbmU6IDAsIGNvbHVtbjogMCB9LFxuXHRcdFx0XHRcdHsgbGluZTogY2h1bmtzW2ldLmxpbmVTdGFydHMubGVuZ3RoIC0gMSwgY29sdW1uOiBjaHVua3NbaV0uYnVmZmVyLmxlbmd0aCAtIGNodW5rc1tpXS5saW5lU3RhcnRzW2NodW5rc1tpXS5saW5lU3RhcnRzLmxlbmd0aCAtIDFdIH0sXG5cdFx0XHRcdFx0Y2h1bmtzW2ldLmxpbmVTdGFydHMubGVuZ3RoIC0gMSxcblx0XHRcdFx0XHRjaHVua3NbaV0uYnVmZmVyLmxlbmd0aFxuXHRcdFx0XHQpO1xuXHRcdFx0XHR0aGlzLl9idWZmZXJzLnB1c2goY2h1bmtzW2ldKTtcblx0XHRcdFx0bGFzdE5vZGUgPSB0aGlzLnJiSW5zZXJ0UmlnaHQobGFzdE5vZGUsIHBpZWNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9zZWFyY2hDYWNoZSA9IG5ldyBQaWVjZVRyZWVTZWFyY2hDYWNoZSgxKTtcblx0XHR0aGlzLl9sYXN0VmlzaXRlZExpbmUgPSB7IGxpbmVOdW1iZXI6IDAsIHZhbHVlOiAnJyB9O1xuXHRcdHRoaXMuY29tcHV0ZUJ1ZmZlck1ldGFkYXRhKCk7XG5cdH1cblxuXHRub3JtYWxpemVFT0woZW9sOiAnXFxyXFxuJyB8ICdcXG4nKSB7XG5cdFx0Y29uc3QgYXZlcmFnZUJ1ZmZlclNpemUgPSBBdmVyYWdlQnVmZmVyU2l6ZTtcblx0XHRjb25zdCBtaW4gPSBhdmVyYWdlQnVmZmVyU2l6ZSAtIE1hdGguZmxvb3IoYXZlcmFnZUJ1ZmZlclNpemUgLyAzKTtcblx0XHRjb25zdCBtYXggPSBtaW4gKiAyO1xuXG5cdFx0bGV0IHRlbXBDaHVuayA9ICcnO1xuXHRcdGxldCB0ZW1wQ2h1bmtMZW4gPSAwO1xuXHRcdGNvbnN0IGNodW5rczogU3RyaW5nQnVmZmVyW10gPSBbXTtcblxuXHRcdHRoaXMuaXRlcmF0ZSh0aGlzLnJvb3QsIG5vZGUgPT4ge1xuXHRcdFx0Y29uc3Qgc3RyID0gdGhpcy5nZXROb2RlQ29udGVudChub2RlKTtcblx0XHRcdGNvbnN0IGxlbiA9IHN0ci5sZW5ndGg7XG5cdFx0XHRpZiAodGVtcENodW5rTGVuIDw9IG1pbiB8fCB0ZW1wQ2h1bmtMZW4gKyBsZW4gPCBtYXgpIHtcblx0XHRcdFx0dGVtcENodW5rICs9IHN0cjtcblx0XHRcdFx0dGVtcENodW5rTGVuICs9IGxlbjtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGZsdXNoIGFueXdheXNcblx0XHRcdGNvbnN0IHRleHQgPSB0ZW1wQ2h1bmsucmVwbGFjZSgvXFxyXFxufFxccnxcXG4vZywgZW9sKTtcblx0XHRcdGNodW5rcy5wdXNoKG5ldyBTdHJpbmdCdWZmZXIodGV4dCwgY3JlYXRlTGluZVN0YXJ0c0Zhc3QodGV4dCkpKTtcblx0XHRcdHRlbXBDaHVuayA9IHN0cjtcblx0XHRcdHRlbXBDaHVua0xlbiA9IGxlbjtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHRlbXBDaHVua0xlbiA+IDApIHtcblx0XHRcdGNvbnN0IHRleHQgPSB0ZW1wQ2h1bmsucmVwbGFjZSgvXFxyXFxufFxccnxcXG4vZywgZW9sKTtcblx0XHRcdGNodW5rcy5wdXNoKG5ldyBTdHJpbmdCdWZmZXIodGV4dCwgY3JlYXRlTGluZVN0YXJ0c0Zhc3QodGV4dCkpKTtcblx0XHR9XG5cblx0XHR0aGlzLmNyZWF0ZShjaHVua3MsIGVvbCwgdHJ1ZSk7XG5cdH1cblxuXHQvLyAjcmVnaW9uIEJ1ZmZlciBBUElcblx0cHVibGljIGdldEVPTCgpOiAnXFxyXFxuJyB8ICdcXG4nIHtcblx0XHRyZXR1cm4gdGhpcy5fRU9MO1xuXHR9XG5cblx0cHVibGljIHNldEVPTChuZXdFT0w6ICdcXHJcXG4nIHwgJ1xcbicpOiB2b2lkIHtcblx0XHR0aGlzLl9FT0wgPSBuZXdFT0w7XG5cdFx0dGhpcy5fRU9MTGVuZ3RoID0gdGhpcy5fRU9MLmxlbmd0aDtcblx0XHR0aGlzLm5vcm1hbGl6ZUVPTChuZXdFT0wpO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZVNuYXBzaG90KEJPTTogc3RyaW5nKTogSVRleHRTbmFwc2hvdCB7XG5cdFx0cmV0dXJuIG5ldyBQaWVjZVRyZWVTbmFwc2hvdCh0aGlzLCBCT00pO1xuXHR9XG5cblx0cHVibGljIGVxdWFsKG90aGVyOiBQaWVjZVRyZWVCYXNlKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuZ2V0TGVuZ3RoKCkgIT09IG90aGVyLmdldExlbmd0aCgpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmdldExpbmVDb3VudCgpICE9PSBvdGhlci5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdGNvbnN0IHJldCA9IHRoaXMuaXRlcmF0ZSh0aGlzLnJvb3QsIG5vZGUgPT4ge1xuXHRcdFx0aWYgKG5vZGUgPT09IFNFTlRJTkVMKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc3RyID0gdGhpcy5nZXROb2RlQ29udGVudChub2RlKTtcblx0XHRcdGNvbnN0IGxlbiA9IHN0ci5sZW5ndGg7XG5cdFx0XHRjb25zdCBzdGFydFBvc2l0aW9uID0gb3RoZXIubm9kZUF0KG9mZnNldCk7XG5cdFx0XHRjb25zdCBlbmRQb3NpdGlvbiA9IG90aGVyLm5vZGVBdChvZmZzZXQgKyBsZW4pO1xuXHRcdFx0Y29uc3QgdmFsID0gb3RoZXIuZ2V0VmFsdWVJblJhbmdlMihzdGFydFBvc2l0aW9uLCBlbmRQb3NpdGlvbik7XG5cblx0XHRcdG9mZnNldCArPSBsZW47XG5cdFx0XHRyZXR1cm4gc3RyID09PSB2YWw7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0cHVibGljIGdldE9mZnNldEF0KGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGxldCBsZWZ0TGVuID0gMDsgLy8gaW5vcmRlclxuXG5cdFx0bGV0IHggPSB0aGlzLnJvb3Q7XG5cblx0XHR3aGlsZSAoeCAhPT0gU0VOVElORUwpIHtcblx0XHRcdGlmICh4LmxlZnQgIT09IFNFTlRJTkVMICYmIHgubGZfbGVmdCArIDEgPj0gbGluZU51bWJlcikge1xuXHRcdFx0XHR4ID0geC5sZWZ0O1xuXHRcdFx0fSBlbHNlIGlmICh4LmxmX2xlZnQgKyB4LnBpZWNlLmxpbmVGZWVkQ250ICsgMSA+PSBsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdGxlZnRMZW4gKz0geC5zaXplX2xlZnQ7XG5cdFx0XHRcdC8vIGxpbmVOdW1iZXIgPj0gMlxuXHRcdFx0XHRjb25zdCBhY2N1bXVhbHRlZFZhbEluQ3VycmVudEluZGV4ID0gdGhpcy5nZXRBY2N1bXVsYXRlZFZhbHVlKHgsIGxpbmVOdW1iZXIgLSB4LmxmX2xlZnQgLSAyKTtcblx0XHRcdFx0cmV0dXJuIGxlZnRMZW4gKz0gYWNjdW11YWx0ZWRWYWxJbkN1cnJlbnRJbmRleCArIGNvbHVtbiAtIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsaW5lTnVtYmVyIC09IHgubGZfbGVmdCArIHgucGllY2UubGluZUZlZWRDbnQ7XG5cdFx0XHRcdGxlZnRMZW4gKz0geC5zaXplX2xlZnQgKyB4LnBpZWNlLmxlbmd0aDtcblx0XHRcdFx0eCA9IHgucmlnaHQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxlZnRMZW47XG5cdH1cblxuXHRwdWJsaWMgZ2V0UG9zaXRpb25BdChvZmZzZXQ6IG51bWJlcik6IFBvc2l0aW9uIHtcblx0XHRvZmZzZXQgPSBNYXRoLmZsb29yKG9mZnNldCk7XG5cdFx0b2Zmc2V0ID0gTWF0aC5tYXgoMCwgb2Zmc2V0KTtcblxuXHRcdGxldCB4ID0gdGhpcy5yb290O1xuXHRcdGxldCBsZkNudCA9IDA7XG5cdFx0Y29uc3Qgb3JpZ2luYWxPZmZzZXQgPSBvZmZzZXQ7XG5cblx0XHR3aGlsZSAoeCAhPT0gU0VOVElORUwpIHtcblx0XHRcdGlmICh4LnNpemVfbGVmdCAhPT0gMCAmJiB4LnNpemVfbGVmdCA+PSBvZmZzZXQpIHtcblx0XHRcdFx0eCA9IHgubGVmdDtcblx0XHRcdH0gZWxzZSBpZiAoeC5zaXplX2xlZnQgKyB4LnBpZWNlLmxlbmd0aCA+PSBvZmZzZXQpIHtcblx0XHRcdFx0Y29uc3Qgb3V0ID0gdGhpcy5nZXRJbmRleE9mKHgsIG9mZnNldCAtIHguc2l6ZV9sZWZ0KTtcblxuXHRcdFx0XHRsZkNudCArPSB4LmxmX2xlZnQgKyBvdXQuaW5kZXg7XG5cblx0XHRcdFx0aWYgKG91dC5pbmRleCA9PT0gMCkge1xuXHRcdFx0XHRcdGNvbnN0IGxpbmVTdGFydE9mZnNldCA9IHRoaXMuZ2V0T2Zmc2V0QXQobGZDbnQgKyAxLCAxKTtcblx0XHRcdFx0XHRjb25zdCBjb2x1bW4gPSBvcmlnaW5hbE9mZnNldCAtIGxpbmVTdGFydE9mZnNldDtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxmQ250ICsgMSwgY29sdW1uICsgMSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxmQ250ICsgMSwgb3V0LnJlbWFpbmRlciArIDEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b2Zmc2V0IC09IHguc2l6ZV9sZWZ0ICsgeC5waWVjZS5sZW5ndGg7XG5cdFx0XHRcdGxmQ250ICs9IHgubGZfbGVmdCArIHgucGllY2UubGluZUZlZWRDbnQ7XG5cblx0XHRcdFx0aWYgKHgucmlnaHQgPT09IFNFTlRJTkVMKSB7XG5cdFx0XHRcdFx0Ly8gbGFzdCBub2RlXG5cdFx0XHRcdFx0Y29uc3QgbGluZVN0YXJ0T2Zmc2V0ID0gdGhpcy5nZXRPZmZzZXRBdChsZkNudCArIDEsIDEpO1xuXHRcdFx0XHRcdGNvbnN0IGNvbHVtbiA9IG9yaWdpbmFsT2Zmc2V0IC0gb2Zmc2V0IC0gbGluZVN0YXJ0T2Zmc2V0O1xuXHRcdFx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24obGZDbnQgKyAxLCBjb2x1bW4gKyAxKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR4ID0geC5yaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUG9zaXRpb24oMSwgMSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmFsdWVJblJhbmdlKHJhbmdlOiBSYW5nZSwgZW9sPzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSByYW5nZS5lbmRMaW5lTnVtYmVyICYmIHJhbmdlLnN0YXJ0Q29sdW1uID09PSByYW5nZS5lbmRDb2x1bW4pIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydFBvc2l0aW9uID0gdGhpcy5ub2RlQXQyKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdGNvbnN0IGVuZFBvc2l0aW9uID0gdGhpcy5ub2RlQXQyKHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbik7XG5cblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuZ2V0VmFsdWVJblJhbmdlMihzdGFydFBvc2l0aW9uLCBlbmRQb3NpdGlvbik7XG5cdFx0aWYgKGVvbCkge1xuXHRcdFx0aWYgKGVvbCAhPT0gdGhpcy5fRU9MIHx8ICF0aGlzLl9FT0xOb3JtYWxpemVkKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXHJcXG58XFxyfFxcbi9nLCBlb2wpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZW9sID09PSB0aGlzLmdldEVPTCgpICYmIHRoaXMuX0VPTE5vcm1hbGl6ZWQpIHtcblx0XHRcdFx0aWYgKGVvbCA9PT0gJ1xcclxcbicpIHtcblxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXHJcXG58XFxyfFxcbi9nLCBlb2wpO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmFsdWVJblJhbmdlMihzdGFydFBvc2l0aW9uOiBOb2RlUG9zaXRpb24sIGVuZFBvc2l0aW9uOiBOb2RlUG9zaXRpb24pOiBzdHJpbmcge1xuXHRcdGlmIChzdGFydFBvc2l0aW9uLm5vZGUgPT09IGVuZFBvc2l0aW9uLm5vZGUpIHtcblx0XHRcdGNvbnN0IG5vZGUgPSBzdGFydFBvc2l0aW9uLm5vZGU7XG5cdFx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9idWZmZXJzW25vZGUucGllY2UuYnVmZmVySW5kZXhdLmJ1ZmZlcjtcblx0XHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihub2RlLnBpZWNlLmJ1ZmZlckluZGV4LCBub2RlLnBpZWNlLnN0YXJ0KTtcblx0XHRcdHJldHVybiBidWZmZXIuc3Vic3RyaW5nKHN0YXJ0T2Zmc2V0ICsgc3RhcnRQb3NpdGlvbi5yZW1haW5kZXIsIHN0YXJ0T2Zmc2V0ICsgZW5kUG9zaXRpb24ucmVtYWluZGVyKTtcblx0XHR9XG5cblx0XHRsZXQgeCA9IHN0YXJ0UG9zaXRpb24ubm9kZTtcblx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9idWZmZXJzW3gucGllY2UuYnVmZmVySW5kZXhdLmJ1ZmZlcjtcblx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIoeC5waWVjZS5idWZmZXJJbmRleCwgeC5waWVjZS5zdGFydCk7XG5cdFx0bGV0IHJldCA9IGJ1ZmZlci5zdWJzdHJpbmcoc3RhcnRPZmZzZXQgKyBzdGFydFBvc2l0aW9uLnJlbWFpbmRlciwgc3RhcnRPZmZzZXQgKyB4LnBpZWNlLmxlbmd0aCk7XG5cblx0XHR4ID0geC5uZXh0KCk7XG5cdFx0d2hpbGUgKHggIT09IFNFTlRJTkVMKSB7XG5cdFx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9idWZmZXJzW3gucGllY2UuYnVmZmVySW5kZXhdLmJ1ZmZlcjtcblx0XHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gdGhpcy5vZmZzZXRJbkJ1ZmZlcih4LnBpZWNlLmJ1ZmZlckluZGV4LCB4LnBpZWNlLnN0YXJ0KTtcblxuXHRcdFx0aWYgKHggPT09IGVuZFBvc2l0aW9uLm5vZGUpIHtcblx0XHRcdFx0cmV0ICs9IGJ1ZmZlci5zdWJzdHJpbmcoc3RhcnRPZmZzZXQsIHN0YXJ0T2Zmc2V0ICsgZW5kUG9zaXRpb24ucmVtYWluZGVyKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXQgKz0gYnVmZmVyLnN1YnN0cihzdGFydE9mZnNldCwgeC5waWVjZS5sZW5ndGgpO1xuXHRcdFx0fVxuXG5cdFx0XHR4ID0geC5uZXh0KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lc0NvbnRlbnQoKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCBsaW5lc0xlbmd0aCA9IDA7XG5cdFx0bGV0IGN1cnJlbnRMaW5lID0gJyc7XG5cdFx0bGV0IGRhbmdsaW5nQ1IgPSBmYWxzZTtcblxuXHRcdHRoaXMuaXRlcmF0ZSh0aGlzLnJvb3QsIG5vZGUgPT4ge1xuXHRcdFx0aWYgKG5vZGUgPT09IFNFTlRJTkVMKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwaWVjZSA9IG5vZGUucGllY2U7XG5cdFx0XHRsZXQgcGllY2VMZW5ndGggPSBwaWVjZS5sZW5ndGg7XG5cdFx0XHRpZiAocGllY2VMZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcnNbcGllY2UuYnVmZmVySW5kZXhdLmJ1ZmZlcjtcblx0XHRcdGNvbnN0IGxpbmVTdGFydHMgPSB0aGlzLl9idWZmZXJzW3BpZWNlLmJ1ZmZlckluZGV4XS5saW5lU3RhcnRzO1xuXG5cdFx0XHRjb25zdCBwaWVjZVN0YXJ0TGluZSA9IHBpZWNlLnN0YXJ0LmxpbmU7XG5cdFx0XHRjb25zdCBwaWVjZUVuZExpbmUgPSBwaWVjZS5lbmQubGluZTtcblx0XHRcdGxldCBwaWVjZVN0YXJ0T2Zmc2V0ID0gbGluZVN0YXJ0c1twaWVjZVN0YXJ0TGluZV0gKyBwaWVjZS5zdGFydC5jb2x1bW47XG5cblx0XHRcdGlmIChkYW5nbGluZ0NSKSB7XG5cdFx0XHRcdGlmIChidWZmZXIuY2hhckNvZGVBdChwaWVjZVN0YXJ0T2Zmc2V0KSA9PT0gQ2hhckNvZGUuTGluZUZlZWQpIHtcblx0XHRcdFx0XHQvLyBwcmV0ZW5kIHRoZSBcXG4gd2FzIGluIHRoZSBwcmV2aW91cyBwaWVjZS4uXG5cdFx0XHRcdFx0cGllY2VTdGFydE9mZnNldCsrO1xuXHRcdFx0XHRcdHBpZWNlTGVuZ3RoLS07XG5cdFx0XHRcdH1cblx0XHRcdFx0bGluZXNbbGluZXNMZW5ndGgrK10gPSBjdXJyZW50TGluZTtcblx0XHRcdFx0Y3VycmVudExpbmUgPSAnJztcblx0XHRcdFx0ZGFuZ2xpbmdDUiA9IGZhbHNlO1xuXHRcdFx0XHRpZiAocGllY2VMZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAocGllY2VTdGFydExpbmUgPT09IHBpZWNlRW5kTGluZSkge1xuXHRcdFx0XHQvLyB0aGlzIHBpZWNlIGhhcyBubyBuZXcgbGluZXNcblx0XHRcdFx0aWYgKCF0aGlzLl9FT0xOb3JtYWxpemVkICYmIGJ1ZmZlci5jaGFyQ29kZUF0KHBpZWNlU3RhcnRPZmZzZXQgKyBwaWVjZUxlbmd0aCAtIDEpID09PSBDaGFyQ29kZS5DYXJyaWFnZVJldHVybikge1xuXHRcdFx0XHRcdGRhbmdsaW5nQ1IgPSB0cnVlO1xuXHRcdFx0XHRcdGN1cnJlbnRMaW5lICs9IGJ1ZmZlci5zdWJzdHIocGllY2VTdGFydE9mZnNldCwgcGllY2VMZW5ndGggLSAxKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjdXJyZW50TGluZSArPSBidWZmZXIuc3Vic3RyKHBpZWNlU3RhcnRPZmZzZXQsIHBpZWNlTGVuZ3RoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gYWRkIHRoZSB0ZXh0IGJlZm9yZSB0aGUgZmlyc3QgbGluZSBzdGFydCBpbiB0aGlzIHBpZWNlXG5cdFx0XHRjdXJyZW50TGluZSArPSAoXG5cdFx0XHRcdHRoaXMuX0VPTE5vcm1hbGl6ZWRcblx0XHRcdFx0XHQ/IGJ1ZmZlci5zdWJzdHJpbmcocGllY2VTdGFydE9mZnNldCwgTWF0aC5tYXgocGllY2VTdGFydE9mZnNldCwgbGluZVN0YXJ0c1twaWVjZVN0YXJ0TGluZSArIDFdIC0gdGhpcy5fRU9MTGVuZ3RoKSlcblx0XHRcdFx0XHQ6IGJ1ZmZlci5zdWJzdHJpbmcocGllY2VTdGFydE9mZnNldCwgbGluZVN0YXJ0c1twaWVjZVN0YXJ0TGluZSArIDFdKS5yZXBsYWNlKC8oXFxyXFxufFxccnxcXG4pJC8sICcnKVxuXHRcdFx0KTtcblx0XHRcdGxpbmVzW2xpbmVzTGVuZ3RoKytdID0gY3VycmVudExpbmU7XG5cblx0XHRcdGZvciAobGV0IGxpbmUgPSBwaWVjZVN0YXJ0TGluZSArIDE7IGxpbmUgPCBwaWVjZUVuZExpbmU7IGxpbmUrKykge1xuXHRcdFx0XHRjdXJyZW50TGluZSA9IChcblx0XHRcdFx0XHR0aGlzLl9FT0xOb3JtYWxpemVkXG5cdFx0XHRcdFx0XHQ/IGJ1ZmZlci5zdWJzdHJpbmcobGluZVN0YXJ0c1tsaW5lXSwgbGluZVN0YXJ0c1tsaW5lICsgMV0gLSB0aGlzLl9FT0xMZW5ndGgpXG5cdFx0XHRcdFx0XHQ6IGJ1ZmZlci5zdWJzdHJpbmcobGluZVN0YXJ0c1tsaW5lXSwgbGluZVN0YXJ0c1tsaW5lICsgMV0pLnJlcGxhY2UoLyhcXHJcXG58XFxyfFxcbikkLywgJycpXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGxpbmVzW2xpbmVzTGVuZ3RoKytdID0gY3VycmVudExpbmU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fRU9MTm9ybWFsaXplZCAmJiBidWZmZXIuY2hhckNvZGVBdChsaW5lU3RhcnRzW3BpZWNlRW5kTGluZV0gKyBwaWVjZS5lbmQuY29sdW1uIC0gMSkgPT09IENoYXJDb2RlLkNhcnJpYWdlUmV0dXJuKSB7XG5cdFx0XHRcdGRhbmdsaW5nQ1IgPSB0cnVlO1xuXHRcdFx0XHRpZiAocGllY2UuZW5kLmNvbHVtbiA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIFRoZSBsYXN0IGxpbmUgZW5kZWQgd2l0aCBhIFxcciwgbGV0J3MgdW5kbyB0aGUgcHVzaCwgaXQgd2lsbCBiZSBwdXNoZWQgYnkgbmV4dCBpdGVyYXRpb25cblx0XHRcdFx0XHRsaW5lc0xlbmd0aC0tO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGN1cnJlbnRMaW5lID0gYnVmZmVyLnN1YnN0cihsaW5lU3RhcnRzW3BpZWNlRW5kTGluZV0sIHBpZWNlLmVuZC5jb2x1bW4gLSAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y3VycmVudExpbmUgPSBidWZmZXIuc3Vic3RyKGxpbmVTdGFydHNbcGllY2VFbmRMaW5lXSwgcGllY2UuZW5kLmNvbHVtbik7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0aWYgKGRhbmdsaW5nQ1IpIHtcblx0XHRcdGxpbmVzW2xpbmVzTGVuZ3RoKytdID0gY3VycmVudExpbmU7XG5cdFx0XHRjdXJyZW50TGluZSA9ICcnO1xuXHRcdH1cblxuXHRcdGxpbmVzW2xpbmVzTGVuZ3RoKytdID0gY3VycmVudExpbmU7XG5cdFx0cmV0dXJuIGxpbmVzO1xuXHR9XG5cblx0cHVibGljIGdldExlbmd0aCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9sZW5ndGg7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZUNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVDbnQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5fbGFzdFZpc2l0ZWRMaW5lLmxpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpIHtcblx0XHRcdHJldHVybiB0aGlzLl9sYXN0VmlzaXRlZExpbmUudmFsdWU7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbGFzdFZpc2l0ZWRMaW5lLmxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyO1xuXG5cdFx0aWYgKGxpbmVOdW1iZXIgPT09IHRoaXMuX2xpbmVDbnQpIHtcblx0XHRcdHRoaXMuX2xhc3RWaXNpdGVkTGluZS52YWx1ZSA9IHRoaXMuZ2V0TGluZVJhd0NvbnRlbnQobGluZU51bWJlcik7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9FT0xOb3JtYWxpemVkKSB7XG5cdFx0XHR0aGlzLl9sYXN0VmlzaXRlZExpbmUudmFsdWUgPSB0aGlzLmdldExpbmVSYXdDb250ZW50KGxpbmVOdW1iZXIsIHRoaXMuX0VPTExlbmd0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2xhc3RWaXNpdGVkTGluZS52YWx1ZSA9IHRoaXMuZ2V0TGluZVJhd0NvbnRlbnQobGluZU51bWJlcikucmVwbGFjZSgvKFxcclxcbnxcXHJ8XFxuKSQvLCAnJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2xhc3RWaXNpdGVkTGluZS52YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2dldENoYXJDb2RlKG5vZGVQb3M6IE5vZGVQb3NpdGlvbik6IG51bWJlciB7XG5cdFx0aWYgKG5vZGVQb3MucmVtYWluZGVyID09PSBub2RlUG9zLm5vZGUucGllY2UubGVuZ3RoKSB7XG5cdFx0XHQvLyB0aGUgY2hhciB3ZSB3YW50IHRvIGZldGNoIGlzIGF0IHRoZSBoZWFkIG9mIG5leHQgbm9kZS5cblx0XHRcdGNvbnN0IG1hdGNoaW5nTm9kZSA9IG5vZGVQb3Mubm9kZS5uZXh0KCk7XG5cdFx0XHRpZiAoIW1hdGNoaW5nTm9kZSkge1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fYnVmZmVyc1ttYXRjaGluZ05vZGUucGllY2UuYnVmZmVySW5kZXhdO1xuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKG1hdGNoaW5nTm9kZS5waWVjZS5idWZmZXJJbmRleCwgbWF0Y2hpbmdOb2RlLnBpZWNlLnN0YXJ0KTtcblx0XHRcdHJldHVybiBidWZmZXIuYnVmZmVyLmNoYXJDb2RlQXQoc3RhcnRPZmZzZXQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9idWZmZXJzW25vZGVQb3Mubm9kZS5waWVjZS5idWZmZXJJbmRleF07XG5cdFx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIobm9kZVBvcy5ub2RlLnBpZWNlLmJ1ZmZlckluZGV4LCBub2RlUG9zLm5vZGUucGllY2Uuc3RhcnQpO1xuXHRcdFx0Y29uc3QgdGFyZ2V0T2Zmc2V0ID0gc3RhcnRPZmZzZXQgKyBub2RlUG9zLnJlbWFpbmRlcjtcblxuXHRcdFx0cmV0dXJuIGJ1ZmZlci5idWZmZXIuY2hhckNvZGVBdCh0YXJnZXRPZmZzZXQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lQ2hhckNvZGUobGluZU51bWJlcjogbnVtYmVyLCBpbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCBub2RlUG9zID0gdGhpcy5ub2RlQXQyKGxpbmVOdW1iZXIsIGluZGV4ICsgMSk7XG5cdFx0cmV0dXJuIHRoaXMuX2dldENoYXJDb2RlKG5vZGVQb3MpO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVMZW5ndGgobGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAobGluZU51bWJlciA9PT0gdGhpcy5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLmdldE9mZnNldEF0KGxpbmVOdW1iZXIsIDEpO1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0TGVuZ3RoKCkgLSBzdGFydE9mZnNldDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0T2Zmc2V0QXQobGluZU51bWJlciArIDEsIDEpIC0gdGhpcy5nZXRPZmZzZXRBdChsaW5lTnVtYmVyLCAxKSAtIHRoaXMuX0VPTExlbmd0aDtcblx0fVxuXG5cdHB1YmxpYyBnZXRDaGFyQ29kZShvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3Qgbm9kZVBvcyA9IHRoaXMubm9kZUF0KG9mZnNldCk7XG5cdFx0cmV0dXJuIHRoaXMuX2dldENoYXJDb2RlKG5vZGVQb3MpO1xuXHR9XG5cblx0cHVibGljIGdldE5lYXJlc3RDaHVuayhvZmZzZXQ6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0Y29uc3Qgbm9kZVBvcyA9IHRoaXMubm9kZUF0KG9mZnNldCk7XG5cdFx0aWYgKG5vZGVQb3MucmVtYWluZGVyID09PSBub2RlUG9zLm5vZGUucGllY2UubGVuZ3RoKSB7XG5cdFx0XHQvLyB0aGUgb2Zmc2V0IGlzIGF0IHRoZSBoZWFkIG9mIG5leHQgbm9kZS5cblx0XHRcdGNvbnN0IG1hdGNoaW5nTm9kZSA9IG5vZGVQb3Mubm9kZS5uZXh0KCk7XG5cdFx0XHRpZiAoIW1hdGNoaW5nTm9kZSB8fCBtYXRjaGluZ05vZGUgPT09IFNFTlRJTkVMKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fYnVmZmVyc1ttYXRjaGluZ05vZGUucGllY2UuYnVmZmVySW5kZXhdO1xuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKG1hdGNoaW5nTm9kZS5waWVjZS5idWZmZXJJbmRleCwgbWF0Y2hpbmdOb2RlLnBpZWNlLnN0YXJ0KTtcblx0XHRcdHJldHVybiBidWZmZXIuYnVmZmVyLnN1YnN0cmluZyhzdGFydE9mZnNldCwgc3RhcnRPZmZzZXQgKyBtYXRjaGluZ05vZGUucGllY2UubGVuZ3RoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fYnVmZmVyc1tub2RlUG9zLm5vZGUucGllY2UuYnVmZmVySW5kZXhdO1xuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKG5vZGVQb3Mubm9kZS5waWVjZS5idWZmZXJJbmRleCwgbm9kZVBvcy5ub2RlLnBpZWNlLnN0YXJ0KTtcblx0XHRcdGNvbnN0IHRhcmdldE9mZnNldCA9IHN0YXJ0T2Zmc2V0ICsgbm9kZVBvcy5yZW1haW5kZXI7XG5cdFx0XHRjb25zdCB0YXJnZXRFbmQgPSBzdGFydE9mZnNldCArIG5vZGVQb3Mubm9kZS5waWVjZS5sZW5ndGg7XG5cdFx0XHRyZXR1cm4gYnVmZmVyLmJ1ZmZlci5zdWJzdHJpbmcodGFyZ2V0T2Zmc2V0LCB0YXJnZXRFbmQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBmaW5kTWF0Y2hlc0luTm9kZShub2RlOiBUcmVlTm9kZSwgc2VhcmNoZXI6IFNlYXJjaGVyLCBzdGFydExpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgc3RhcnRDdXJzb3I6IEJ1ZmZlckN1cnNvciwgZW5kQ3Vyc29yOiBCdWZmZXJDdXJzb3IsIHNlYXJjaERhdGE6IFNlYXJjaERhdGEsIGNhcHR1cmVNYXRjaGVzOiBib29sZWFuLCBsaW1pdFJlc3VsdENvdW50OiBudW1iZXIsIHJlc3VsdExlbjogbnVtYmVyLCByZXN1bHQ6IEZpbmRNYXRjaFtdKSB7XG5cdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fYnVmZmVyc1tub2RlLnBpZWNlLmJ1ZmZlckluZGV4XTtcblx0XHRjb25zdCBzdGFydE9mZnNldEluQnVmZmVyID0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihub2RlLnBpZWNlLmJ1ZmZlckluZGV4LCBub2RlLnBpZWNlLnN0YXJ0KTtcblx0XHRjb25zdCBzdGFydCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIobm9kZS5waWVjZS5idWZmZXJJbmRleCwgc3RhcnRDdXJzb3IpO1xuXHRcdGNvbnN0IGVuZCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIobm9kZS5waWVjZS5idWZmZXJJbmRleCwgZW5kQ3Vyc29yKTtcblxuXHRcdGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXHRcdC8vIFJlc2V0IHJlZ2V4IHRvIHNlYXJjaCBmcm9tIHRoZSBiZWdpbm5pbmdcblx0XHRjb25zdCByZXQ6IEJ1ZmZlckN1cnNvciA9IHsgbGluZTogMCwgY29sdW1uOiAwIH07XG5cdFx0bGV0IHNlYXJjaFRleHQ6IHN0cmluZztcblx0XHRsZXQgb2Zmc2V0SW5CdWZmZXI6IChvZmZzZXQ6IG51bWJlcikgPT4gbnVtYmVyO1xuXG5cdFx0aWYgKHNlYXJjaGVyLl93b3JkU2VwYXJhdG9ycykge1xuXHRcdFx0c2VhcmNoVGV4dCA9IGJ1ZmZlci5idWZmZXIuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuXHRcdFx0b2Zmc2V0SW5CdWZmZXIgPSAob2Zmc2V0OiBudW1iZXIpID0+IG9mZnNldCArIHN0YXJ0O1xuXHRcdFx0c2VhcmNoZXIucmVzZXQoMCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlYXJjaFRleHQgPSBidWZmZXIuYnVmZmVyO1xuXHRcdFx0b2Zmc2V0SW5CdWZmZXIgPSAob2Zmc2V0OiBudW1iZXIpID0+IG9mZnNldDtcblx0XHRcdHNlYXJjaGVyLnJlc2V0KHN0YXJ0KTtcblx0XHR9XG5cblx0XHRkbyB7XG5cdFx0XHRtID0gc2VhcmNoZXIubmV4dChzZWFyY2hUZXh0KTtcblxuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0aWYgKG9mZnNldEluQnVmZmVyKG0uaW5kZXgpID49IGVuZCkge1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHRMZW47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wb3NpdGlvbkluQnVmZmVyKG5vZGUsIG9mZnNldEluQnVmZmVyKG0uaW5kZXgpIC0gc3RhcnRPZmZzZXRJbkJ1ZmZlciwgcmV0KTtcblx0XHRcdFx0Y29uc3QgbGluZUZlZWRDbnQgPSB0aGlzLmdldExpbmVGZWVkQ250KG5vZGUucGllY2UuYnVmZmVySW5kZXgsIHN0YXJ0Q3Vyc29yLCByZXQpO1xuXHRcdFx0XHRjb25zdCByZXRTdGFydENvbHVtbiA9IHJldC5saW5lID09PSBzdGFydEN1cnNvci5saW5lID8gcmV0LmNvbHVtbiAtIHN0YXJ0Q3Vyc29yLmNvbHVtbiArIHN0YXJ0Q29sdW1uIDogcmV0LmNvbHVtbiArIDE7XG5cdFx0XHRcdGNvbnN0IHJldEVuZENvbHVtbiA9IHJldFN0YXJ0Q29sdW1uICsgbVswXS5sZW5ndGg7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBjcmVhdGVGaW5kTWF0Y2gobmV3IFJhbmdlKHN0YXJ0TGluZU51bWJlciArIGxpbmVGZWVkQ250LCByZXRTdGFydENvbHVtbiwgc3RhcnRMaW5lTnVtYmVyICsgbGluZUZlZWRDbnQsIHJldEVuZENvbHVtbiksIG0sIGNhcHR1cmVNYXRjaGVzKTtcblxuXHRcdFx0XHRpZiAob2Zmc2V0SW5CdWZmZXIobS5pbmRleCkgKyBtWzBdLmxlbmd0aCA+PSBlbmQpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0TGVuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChyZXN1bHRMZW4gPj0gbGltaXRSZXN1bHRDb3VudCkge1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHRMZW47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0gd2hpbGUgKG0pO1xuXG5cdFx0cmV0dXJuIHJlc3VsdExlbjtcblx0fVxuXG5cdHB1YmxpYyBmaW5kTWF0Y2hlc0xpbmVCeUxpbmUoc2VhcmNoUmFuZ2U6IFJhbmdlLCBzZWFyY2hEYXRhOiBTZWFyY2hEYXRhLCBjYXB0dXJlTWF0Y2hlczogYm9vbGVhbiwgbGltaXRSZXN1bHRDb3VudDogbnVtYmVyKTogRmluZE1hdGNoW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogRmluZE1hdGNoW10gPSBbXTtcblx0XHRsZXQgcmVzdWx0TGVuID0gMDtcblx0XHRjb25zdCBzZWFyY2hlciA9IG5ldyBTZWFyY2hlcihzZWFyY2hEYXRhLndvcmRTZXBhcmF0b3JzLCBzZWFyY2hEYXRhLnJlZ2V4KTtcblxuXHRcdGxldCBzdGFydFBvc2l0aW9uID0gdGhpcy5ub2RlQXQyKHNlYXJjaFJhbmdlLnN0YXJ0TGluZU51bWJlciwgc2VhcmNoUmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdGlmIChzdGFydFBvc2l0aW9uID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGNvbnN0IGVuZFBvc2l0aW9uID0gdGhpcy5ub2RlQXQyKHNlYXJjaFJhbmdlLmVuZExpbmVOdW1iZXIsIHNlYXJjaFJhbmdlLmVuZENvbHVtbik7XG5cdFx0aWYgKGVuZFBvc2l0aW9uID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGxldCBzdGFydCA9IHRoaXMucG9zaXRpb25JbkJ1ZmZlcihzdGFydFBvc2l0aW9uLm5vZGUsIHN0YXJ0UG9zaXRpb24ucmVtYWluZGVyKTtcblx0XHRjb25zdCBlbmQgPSB0aGlzLnBvc2l0aW9uSW5CdWZmZXIoZW5kUG9zaXRpb24ubm9kZSwgZW5kUG9zaXRpb24ucmVtYWluZGVyKTtcblxuXHRcdGlmIChzdGFydFBvc2l0aW9uLm5vZGUgPT09IGVuZFBvc2l0aW9uLm5vZGUpIHtcblx0XHRcdHRoaXMuZmluZE1hdGNoZXNJbk5vZGUoc3RhcnRQb3NpdGlvbi5ub2RlLCBzZWFyY2hlciwgc2VhcmNoUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBzZWFyY2hSYW5nZS5zdGFydENvbHVtbiwgc3RhcnQsIGVuZCwgc2VhcmNoRGF0YSwgY2FwdHVyZU1hdGNoZXMsIGxpbWl0UmVzdWx0Q291bnQsIHJlc3VsdExlbiwgcmVzdWx0KTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0bGV0IHN0YXJ0TGluZU51bWJlciA9IHNlYXJjaFJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblxuXHRcdGxldCBjdXJyZW50Tm9kZSA9IHN0YXJ0UG9zaXRpb24ubm9kZTtcblx0XHR3aGlsZSAoY3VycmVudE5vZGUgIT09IGVuZFBvc2l0aW9uLm5vZGUpIHtcblx0XHRcdGNvbnN0IGxpbmVCcmVha0NudCA9IHRoaXMuZ2V0TGluZUZlZWRDbnQoY3VycmVudE5vZGUucGllY2UuYnVmZmVySW5kZXgsIHN0YXJ0LCBjdXJyZW50Tm9kZS5waWVjZS5lbmQpO1xuXG5cdFx0XHRpZiAobGluZUJyZWFrQ250ID49IDEpIHtcblx0XHRcdFx0Ly8gbGFzdCBsaW5lIGJyZWFrIHBvc2l0aW9uXG5cdFx0XHRcdGNvbnN0IGxpbmVTdGFydHMgPSB0aGlzLl9idWZmZXJzW2N1cnJlbnROb2RlLnBpZWNlLmJ1ZmZlckluZGV4XS5saW5lU3RhcnRzO1xuXHRcdFx0XHRjb25zdCBzdGFydE9mZnNldEluQnVmZmVyID0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihjdXJyZW50Tm9kZS5waWVjZS5idWZmZXJJbmRleCwgY3VycmVudE5vZGUucGllY2Uuc3RhcnQpO1xuXHRcdFx0XHRjb25zdCBuZXh0TGluZVN0YXJ0T2Zmc2V0ID0gbGluZVN0YXJ0c1tzdGFydC5saW5lICsgbGluZUJyZWFrQ250XTtcblx0XHRcdFx0Y29uc3Qgc3RhcnRDb2x1bW4gPSBzdGFydExpbmVOdW1iZXIgPT09IHNlYXJjaFJhbmdlLnN0YXJ0TGluZU51bWJlciA/IHNlYXJjaFJhbmdlLnN0YXJ0Q29sdW1uIDogMTtcblx0XHRcdFx0cmVzdWx0TGVuID0gdGhpcy5maW5kTWF0Y2hlc0luTm9kZShjdXJyZW50Tm9kZSwgc2VhcmNoZXIsIHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sIHN0YXJ0LCB0aGlzLnBvc2l0aW9uSW5CdWZmZXIoY3VycmVudE5vZGUsIG5leHRMaW5lU3RhcnRPZmZzZXQgLSBzdGFydE9mZnNldEluQnVmZmVyKSwgc2VhcmNoRGF0YSwgY2FwdHVyZU1hdGNoZXMsIGxpbWl0UmVzdWx0Q291bnQsIHJlc3VsdExlbiwgcmVzdWx0KTtcblxuXHRcdFx0XHRpZiAocmVzdWx0TGVuID49IGxpbWl0UmVzdWx0Q291bnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyICs9IGxpbmVCcmVha0NudDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhcnRDb2x1bW4gPSBzdGFydExpbmVOdW1iZXIgPT09IHNlYXJjaFJhbmdlLnN0YXJ0TGluZU51bWJlciA/IHNlYXJjaFJhbmdlLnN0YXJ0Q29sdW1uIC0gMSA6IDA7XG5cdFx0XHQvLyBzZWFyY2ggZm9yIHRoZSByZW1haW5pbmcgY29udGVudFxuXHRcdFx0aWYgKHN0YXJ0TGluZU51bWJlciA9PT0gc2VhcmNoUmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gdGhpcy5nZXRMaW5lQ29udGVudChzdGFydExpbmVOdW1iZXIpLnN1YnN0cmluZyhzdGFydENvbHVtbiwgc2VhcmNoUmFuZ2UuZW5kQ29sdW1uIC0gMSk7XG5cdFx0XHRcdHJlc3VsdExlbiA9IHRoaXMuX2ZpbmRNYXRjaGVzSW5MaW5lKHNlYXJjaERhdGEsIHNlYXJjaGVyLCB0ZXh0LCBzZWFyY2hSYW5nZS5lbmRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgcmVzdWx0TGVuLCByZXN1bHQsIGNhcHR1cmVNYXRjaGVzLCBsaW1pdFJlc3VsdENvdW50KTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0TGVuID0gdGhpcy5fZmluZE1hdGNoZXNJbkxpbmUoc2VhcmNoRGF0YSwgc2VhcmNoZXIsIHRoaXMuZ2V0TGluZUNvbnRlbnQoc3RhcnRMaW5lTnVtYmVyKS5zdWJzdHIoc3RhcnRDb2x1bW4pLCBzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCByZXN1bHRMZW4sIHJlc3VsdCwgY2FwdHVyZU1hdGNoZXMsIGxpbWl0UmVzdWx0Q291bnQpO1xuXG5cdFx0XHRpZiAocmVzdWx0TGVuID49IGxpbWl0UmVzdWx0Q291bnQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblxuXHRcdFx0c3RhcnRMaW5lTnVtYmVyKys7XG5cdFx0XHRzdGFydFBvc2l0aW9uID0gdGhpcy5ub2RlQXQyKHN0YXJ0TGluZU51bWJlciwgMSk7XG5cdFx0XHRjdXJyZW50Tm9kZSA9IHN0YXJ0UG9zaXRpb24ubm9kZTtcblx0XHRcdHN0YXJ0ID0gdGhpcy5wb3NpdGlvbkluQnVmZmVyKHN0YXJ0UG9zaXRpb24ubm9kZSwgc3RhcnRQb3NpdGlvbi5yZW1haW5kZXIpO1xuXHRcdH1cblxuXHRcdGlmIChzdGFydExpbmVOdW1iZXIgPT09IHNlYXJjaFJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdGNvbnN0IHN0YXJ0Q29sdW1uID0gc3RhcnRMaW5lTnVtYmVyID09PSBzZWFyY2hSYW5nZS5zdGFydExpbmVOdW1iZXIgPyBzZWFyY2hSYW5nZS5zdGFydENvbHVtbiAtIDEgOiAwO1xuXHRcdFx0Y29uc3QgdGV4dCA9IHRoaXMuZ2V0TGluZUNvbnRlbnQoc3RhcnRMaW5lTnVtYmVyKS5zdWJzdHJpbmcoc3RhcnRDb2x1bW4sIHNlYXJjaFJhbmdlLmVuZENvbHVtbiAtIDEpO1xuXHRcdFx0cmVzdWx0TGVuID0gdGhpcy5fZmluZE1hdGNoZXNJbkxpbmUoc2VhcmNoRGF0YSwgc2VhcmNoZXIsIHRleHQsIHNlYXJjaFJhbmdlLmVuZExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCByZXN1bHRMZW4sIHJlc3VsdCwgY2FwdHVyZU1hdGNoZXMsIGxpbWl0UmVzdWx0Q291bnQpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydENvbHVtbiA9IHN0YXJ0TGluZU51bWJlciA9PT0gc2VhcmNoUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID8gc2VhcmNoUmFuZ2Uuc3RhcnRDb2x1bW4gOiAxO1xuXHRcdHJlc3VsdExlbiA9IHRoaXMuZmluZE1hdGNoZXNJbk5vZGUoZW5kUG9zaXRpb24ubm9kZSwgc2VhcmNoZXIsIHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sIHN0YXJ0LCBlbmQsIHNlYXJjaERhdGEsIGNhcHR1cmVNYXRjaGVzLCBsaW1pdFJlc3VsdENvdW50LCByZXN1bHRMZW4sIHJlc3VsdCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2ZpbmRNYXRjaGVzSW5MaW5lKHNlYXJjaERhdGE6IFNlYXJjaERhdGEsIHNlYXJjaGVyOiBTZWFyY2hlciwgdGV4dDogc3RyaW5nLCBsaW5lTnVtYmVyOiBudW1iZXIsIGRlbHRhT2Zmc2V0OiBudW1iZXIsIHJlc3VsdExlbjogbnVtYmVyLCByZXN1bHQ6IEZpbmRNYXRjaFtdLCBjYXB0dXJlTWF0Y2hlczogYm9vbGVhbiwgbGltaXRSZXN1bHRDb3VudDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCB3b3JkU2VwYXJhdG9ycyA9IHNlYXJjaERhdGEud29yZFNlcGFyYXRvcnM7XG5cdFx0aWYgKCFjYXB0dXJlTWF0Y2hlcyAmJiBzZWFyY2hEYXRhLnNpbXBsZVNlYXJjaCkge1xuXHRcdFx0Y29uc3Qgc2VhcmNoU3RyaW5nID0gc2VhcmNoRGF0YS5zaW1wbGVTZWFyY2g7XG5cdFx0XHRjb25zdCBzZWFyY2hTdHJpbmdMZW4gPSBzZWFyY2hTdHJpbmcubGVuZ3RoO1xuXHRcdFx0Y29uc3QgdGV4dExlbmd0aCA9IHRleHQubGVuZ3RoO1xuXG5cdFx0XHRsZXQgbGFzdE1hdGNoSW5kZXggPSAtc2VhcmNoU3RyaW5nTGVuO1xuXHRcdFx0d2hpbGUgKChsYXN0TWF0Y2hJbmRleCA9IHRleHQuaW5kZXhPZihzZWFyY2hTdHJpbmcsIGxhc3RNYXRjaEluZGV4ICsgc2VhcmNoU3RyaW5nTGVuKSkgIT09IC0xKSB7XG5cdFx0XHRcdGlmICghd29yZFNlcGFyYXRvcnMgfHwgaXNWYWxpZE1hdGNoKHdvcmRTZXBhcmF0b3JzLCB0ZXh0LCB0ZXh0TGVuZ3RoLCBsYXN0TWF0Y2hJbmRleCwgc2VhcmNoU3RyaW5nTGVuKSkge1xuXHRcdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgRmluZE1hdGNoKG5ldyBSYW5nZShsaW5lTnVtYmVyLCBsYXN0TWF0Y2hJbmRleCArIDEgKyBkZWx0YU9mZnNldCwgbGluZU51bWJlciwgbGFzdE1hdGNoSW5kZXggKyAxICsgc2VhcmNoU3RyaW5nTGVuICsgZGVsdGFPZmZzZXQpLCBudWxsKTtcblx0XHRcdFx0XHRpZiAocmVzdWx0TGVuID49IGxpbWl0UmVzdWx0Q291bnQpIHtcblx0XHRcdFx0XHRcdHJldHVybiByZXN1bHRMZW47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0TGVuO1xuXHRcdH1cblxuXHRcdGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXHRcdC8vIFJlc2V0IHJlZ2V4IHRvIHNlYXJjaCBmcm9tIHRoZSBiZWdpbm5pbmdcblx0XHRzZWFyY2hlci5yZXNldCgwKTtcblx0XHRkbyB7XG5cdFx0XHRtID0gc2VhcmNoZXIubmV4dCh0ZXh0KTtcblx0XHRcdGlmIChtKSB7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBjcmVhdGVGaW5kTWF0Y2gobmV3IFJhbmdlKGxpbmVOdW1iZXIsIG0uaW5kZXggKyAxICsgZGVsdGFPZmZzZXQsIGxpbmVOdW1iZXIsIG0uaW5kZXggKyAxICsgbVswXS5sZW5ndGggKyBkZWx0YU9mZnNldCksIG0sIGNhcHR1cmVNYXRjaGVzKTtcblx0XHRcdFx0aWYgKHJlc3VsdExlbiA+PSBsaW1pdFJlc3VsdENvdW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdExlbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKG0pO1xuXHRcdHJldHVybiByZXN1bHRMZW47XG5cdH1cblxuXHQvLyAjZW5kcmVnaW9uXG5cblx0Ly8gI3JlZ2lvbiBQaWVjZSBUYWJsZVxuXHRwdWJsaWMgaW5zZXJ0KG9mZnNldDogbnVtYmVyLCB2YWx1ZTogc3RyaW5nLCBlb2xOb3JtYWxpemVkOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHR0aGlzLl9FT0xOb3JtYWxpemVkID0gdGhpcy5fRU9MTm9ybWFsaXplZCAmJiBlb2xOb3JtYWxpemVkO1xuXHRcdHRoaXMuX2xhc3RWaXNpdGVkTGluZS5saW5lTnVtYmVyID0gMDtcblx0XHR0aGlzLl9sYXN0VmlzaXRlZExpbmUudmFsdWUgPSAnJztcblxuXHRcdGlmICh0aGlzLnJvb3QgIT09IFNFTlRJTkVMKSB7XG5cdFx0XHRjb25zdCB7IG5vZGUsIHJlbWFpbmRlciwgbm9kZVN0YXJ0T2Zmc2V0IH0gPSB0aGlzLm5vZGVBdChvZmZzZXQpO1xuXHRcdFx0Y29uc3QgcGllY2UgPSBub2RlLnBpZWNlO1xuXHRcdFx0Y29uc3QgYnVmZmVySW5kZXggPSBwaWVjZS5idWZmZXJJbmRleDtcblx0XHRcdGNvbnN0IGluc2VydFBvc0luQnVmZmVyID0gdGhpcy5wb3NpdGlvbkluQnVmZmVyKG5vZGUsIHJlbWFpbmRlcik7XG5cdFx0XHRpZiAobm9kZS5waWVjZS5idWZmZXJJbmRleCA9PT0gMCAmJlxuXHRcdFx0XHRwaWVjZS5lbmQubGluZSA9PT0gdGhpcy5fbGFzdENoYW5nZUJ1ZmZlclBvcy5saW5lICYmXG5cdFx0XHRcdHBpZWNlLmVuZC5jb2x1bW4gPT09IHRoaXMuX2xhc3RDaGFuZ2VCdWZmZXJQb3MuY29sdW1uICYmXG5cdFx0XHRcdChub2RlU3RhcnRPZmZzZXQgKyBwaWVjZS5sZW5ndGggPT09IG9mZnNldCkgJiZcblx0XHRcdFx0dmFsdWUubGVuZ3RoIDwgQXZlcmFnZUJ1ZmZlclNpemVcblx0XHRcdCkge1xuXHRcdFx0XHQvLyBjaGFuZ2VkIGJ1ZmZlclxuXHRcdFx0XHR0aGlzLmFwcGVuZFRvTm9kZShub2RlLCB2YWx1ZSk7XG5cdFx0XHRcdHRoaXMuY29tcHV0ZUJ1ZmZlck1ldGFkYXRhKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG5vZGVTdGFydE9mZnNldCA9PT0gb2Zmc2V0KSB7XG5cdFx0XHRcdHRoaXMuaW5zZXJ0Q29udGVudFRvTm9kZUxlZnQodmFsdWUsIG5vZGUpO1xuXHRcdFx0XHR0aGlzLl9zZWFyY2hDYWNoZS52YWxpZGF0ZShvZmZzZXQpO1xuXHRcdFx0fSBlbHNlIGlmIChub2RlU3RhcnRPZmZzZXQgKyBub2RlLnBpZWNlLmxlbmd0aCA+IG9mZnNldCkge1xuXHRcdFx0XHQvLyB3ZSBhcmUgaW5zZXJ0aW5nIGludG8gdGhlIG1pZGRsZSBvZiBhIG5vZGUuXG5cdFx0XHRcdGNvbnN0IG5vZGVzVG9EZWw6IFRyZWVOb2RlW10gPSBbXTtcblx0XHRcdFx0bGV0IG5ld1JpZ2h0UGllY2UgPSBuZXcgUGllY2UoXG5cdFx0XHRcdFx0cGllY2UuYnVmZmVySW5kZXgsXG5cdFx0XHRcdFx0aW5zZXJ0UG9zSW5CdWZmZXIsXG5cdFx0XHRcdFx0cGllY2UuZW5kLFxuXHRcdFx0XHRcdHRoaXMuZ2V0TGluZUZlZWRDbnQocGllY2UuYnVmZmVySW5kZXgsIGluc2VydFBvc0luQnVmZmVyLCBwaWVjZS5lbmQpLFxuXHRcdFx0XHRcdHRoaXMub2Zmc2V0SW5CdWZmZXIoYnVmZmVySW5kZXgsIHBpZWNlLmVuZCkgLSB0aGlzLm9mZnNldEluQnVmZmVyKGJ1ZmZlckluZGV4LCBpbnNlcnRQb3NJbkJ1ZmZlcilcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRpZiAodGhpcy5zaG91bGRDaGVja0NSTEYoKSAmJiB0aGlzLmVuZFdpdGhDUih2YWx1ZSkpIHtcblx0XHRcdFx0XHRjb25zdCBoZWFkT2ZSaWdodCA9IHRoaXMubm9kZUNoYXJDb2RlQXQobm9kZSwgcmVtYWluZGVyKTtcblxuXHRcdFx0XHRcdGlmIChoZWFkT2ZSaWdodCA9PT0gMTAgLyoqIFxcbiAqLykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbmV3U3RhcnQ6IEJ1ZmZlckN1cnNvciA9IHsgbGluZTogbmV3UmlnaHRQaWVjZS5zdGFydC5saW5lICsgMSwgY29sdW1uOiAwIH07XG5cdFx0XHRcdFx0XHRuZXdSaWdodFBpZWNlID0gbmV3IFBpZWNlKFxuXHRcdFx0XHRcdFx0XHRuZXdSaWdodFBpZWNlLmJ1ZmZlckluZGV4LFxuXHRcdFx0XHRcdFx0XHRuZXdTdGFydCxcblx0XHRcdFx0XHRcdFx0bmV3UmlnaHRQaWVjZS5lbmQsXG5cdFx0XHRcdFx0XHRcdHRoaXMuZ2V0TGluZUZlZWRDbnQobmV3UmlnaHRQaWVjZS5idWZmZXJJbmRleCwgbmV3U3RhcnQsIG5ld1JpZ2h0UGllY2UuZW5kKSxcblx0XHRcdFx0XHRcdFx0bmV3UmlnaHRQaWVjZS5sZW5ndGggLSAxXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHR2YWx1ZSArPSAnXFxuJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyByZXVzZSBub2RlIGZvciBjb250ZW50IGJlZm9yZSBpbnNlcnRpb24gcG9pbnQuXG5cdFx0XHRcdGlmICh0aGlzLnNob3VsZENoZWNrQ1JMRigpICYmIHRoaXMuc3RhcnRXaXRoTEYodmFsdWUpKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGFpbE9mTGVmdCA9IHRoaXMubm9kZUNoYXJDb2RlQXQobm9kZSwgcmVtYWluZGVyIC0gMSk7XG5cdFx0XHRcdFx0aWYgKHRhaWxPZkxlZnQgPT09IDEzIC8qKiBcXHIgKi8pIHtcblx0XHRcdFx0XHRcdGNvbnN0IHByZXZpb3VzUG9zID0gdGhpcy5wb3NpdGlvbkluQnVmZmVyKG5vZGUsIHJlbWFpbmRlciAtIDEpO1xuXHRcdFx0XHRcdFx0dGhpcy5kZWxldGVOb2RlVGFpbChub2RlLCBwcmV2aW91c1Bvcyk7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9ICdcXHInICsgdmFsdWU7XG5cblx0XHRcdFx0XHRcdGlmIChub2RlLnBpZWNlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0XHRub2Rlc1RvRGVsLnB1c2gobm9kZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuZGVsZXRlTm9kZVRhaWwobm9kZSwgaW5zZXJ0UG9zSW5CdWZmZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmRlbGV0ZU5vZGVUYWlsKG5vZGUsIGluc2VydFBvc0luQnVmZmVyKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG5ld1BpZWNlcyA9IHRoaXMuY3JlYXRlTmV3UGllY2VzKHZhbHVlKTtcblx0XHRcdFx0aWYgKG5ld1JpZ2h0UGllY2UubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHRoaXMucmJJbnNlcnRSaWdodChub2RlLCBuZXdSaWdodFBpZWNlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCB0bXBOb2RlID0gbm9kZTtcblx0XHRcdFx0Zm9yIChsZXQgayA9IDA7IGsgPCBuZXdQaWVjZXMubGVuZ3RoOyBrKyspIHtcblx0XHRcdFx0XHR0bXBOb2RlID0gdGhpcy5yYkluc2VydFJpZ2h0KHRtcE5vZGUsIG5ld1BpZWNlc1trXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5kZWxldGVOb2Rlcyhub2Rlc1RvRGVsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuaW5zZXJ0Q29udGVudFRvTm9kZVJpZ2h0KHZhbHVlLCBub2RlKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gaW5zZXJ0IG5ldyBub2RlXG5cdFx0XHRjb25zdCBwaWVjZXMgPSB0aGlzLmNyZWF0ZU5ld1BpZWNlcyh2YWx1ZSk7XG5cdFx0XHRsZXQgbm9kZSA9IHRoaXMucmJJbnNlcnRMZWZ0KG51bGwsIHBpZWNlc1swXSk7XG5cblx0XHRcdGZvciAobGV0IGsgPSAxOyBrIDwgcGllY2VzLmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdG5vZGUgPSB0aGlzLnJiSW5zZXJ0UmlnaHQobm9kZSwgcGllY2VzW2tdKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB0b2RvLCB0aGlzIGlzIHRvbyBicnV0YWwuIFRvdGFsIGxpbmUgZmVlZCBjb3VudCBzaG91bGQgYmUgdXBkYXRlZCB0aGUgc2FtZSB3YXkgYXMgbGZfbGVmdC5cblx0XHR0aGlzLmNvbXB1dGVCdWZmZXJNZXRhZGF0YSgpO1xuXHR9XG5cblx0cHVibGljIGRlbGV0ZShvZmZzZXQ6IG51bWJlciwgY250OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9sYXN0VmlzaXRlZExpbmUubGluZU51bWJlciA9IDA7XG5cdFx0dGhpcy5fbGFzdFZpc2l0ZWRMaW5lLnZhbHVlID0gJyc7XG5cblx0XHRpZiAoY250IDw9IDAgfHwgdGhpcy5yb290ID09PSBTRU5USU5FTCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXJ0UG9zaXRpb24gPSB0aGlzLm5vZGVBdChvZmZzZXQpO1xuXHRcdGNvbnN0IGVuZFBvc2l0aW9uID0gdGhpcy5ub2RlQXQob2Zmc2V0ICsgY250KTtcblx0XHRjb25zdCBzdGFydE5vZGUgPSBzdGFydFBvc2l0aW9uLm5vZGU7XG5cdFx0Y29uc3QgZW5kTm9kZSA9IGVuZFBvc2l0aW9uLm5vZGU7XG5cblx0XHRpZiAoc3RhcnROb2RlID09PSBlbmROb2RlKSB7XG5cdFx0XHRjb25zdCBzdGFydFNwbGl0UG9zSW5CdWZmZXIgPSB0aGlzLnBvc2l0aW9uSW5CdWZmZXIoc3RhcnROb2RlLCBzdGFydFBvc2l0aW9uLnJlbWFpbmRlcik7XG5cdFx0XHRjb25zdCBlbmRTcGxpdFBvc0luQnVmZmVyID0gdGhpcy5wb3NpdGlvbkluQnVmZmVyKHN0YXJ0Tm9kZSwgZW5kUG9zaXRpb24ucmVtYWluZGVyKTtcblxuXHRcdFx0aWYgKHN0YXJ0UG9zaXRpb24ubm9kZVN0YXJ0T2Zmc2V0ID09PSBvZmZzZXQpIHtcblx0XHRcdFx0aWYgKGNudCA9PT0gc3RhcnROb2RlLnBpZWNlLmxlbmd0aCkgeyAvLyBkZWxldGUgbm9kZVxuXHRcdFx0XHRcdGNvbnN0IG5leHQgPSBzdGFydE5vZGUubmV4dCgpO1xuXHRcdFx0XHRcdHJiRGVsZXRlKHRoaXMsIHN0YXJ0Tm9kZSk7XG5cdFx0XHRcdFx0dGhpcy52YWxpZGF0ZUNSTEZXaXRoUHJldk5vZGUobmV4dCk7XG5cdFx0XHRcdFx0dGhpcy5jb21wdXRlQnVmZmVyTWV0YWRhdGEoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5kZWxldGVOb2RlSGVhZChzdGFydE5vZGUsIGVuZFNwbGl0UG9zSW5CdWZmZXIpO1xuXHRcdFx0XHR0aGlzLl9zZWFyY2hDYWNoZS52YWxpZGF0ZShvZmZzZXQpO1xuXHRcdFx0XHR0aGlzLnZhbGlkYXRlQ1JMRldpdGhQcmV2Tm9kZShzdGFydE5vZGUpO1xuXHRcdFx0XHR0aGlzLmNvbXB1dGVCdWZmZXJNZXRhZGF0YSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGFydFBvc2l0aW9uLm5vZGVTdGFydE9mZnNldCArIHN0YXJ0Tm9kZS5waWVjZS5sZW5ndGggPT09IG9mZnNldCArIGNudCkge1xuXHRcdFx0XHR0aGlzLmRlbGV0ZU5vZGVUYWlsKHN0YXJ0Tm9kZSwgc3RhcnRTcGxpdFBvc0luQnVmZmVyKTtcblx0XHRcdFx0dGhpcy52YWxpZGF0ZUNSTEZXaXRoTmV4dE5vZGUoc3RhcnROb2RlKTtcblx0XHRcdFx0dGhpcy5jb21wdXRlQnVmZmVyTWV0YWRhdGEoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBkZWxldGUgY29udGVudCBpbiB0aGUgbWlkZGxlLCB0aGlzIG5vZGUgd2lsbCBiZSBzcGxpdHRlZCB0byBub2Rlc1xuXHRcdFx0dGhpcy5zaHJpbmtOb2RlKHN0YXJ0Tm9kZSwgc3RhcnRTcGxpdFBvc0luQnVmZmVyLCBlbmRTcGxpdFBvc0luQnVmZmVyKTtcblx0XHRcdHRoaXMuY29tcHV0ZUJ1ZmZlck1ldGFkYXRhKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZXNUb0RlbDogVHJlZU5vZGVbXSA9IFtdO1xuXG5cdFx0Y29uc3Qgc3RhcnRTcGxpdFBvc0luQnVmZmVyID0gdGhpcy5wb3NpdGlvbkluQnVmZmVyKHN0YXJ0Tm9kZSwgc3RhcnRQb3NpdGlvbi5yZW1haW5kZXIpO1xuXHRcdHRoaXMuZGVsZXRlTm9kZVRhaWwoc3RhcnROb2RlLCBzdGFydFNwbGl0UG9zSW5CdWZmZXIpO1xuXHRcdHRoaXMuX3NlYXJjaENhY2hlLnZhbGlkYXRlKG9mZnNldCk7XG5cdFx0aWYgKHN0YXJ0Tm9kZS5waWVjZS5sZW5ndGggPT09IDApIHtcblx0XHRcdG5vZGVzVG9EZWwucHVzaChzdGFydE5vZGUpO1xuXHRcdH1cblxuXHRcdC8vIHVwZGF0ZSBsYXN0IHRvdWNoZWQgbm9kZVxuXHRcdGNvbnN0IGVuZFNwbGl0UG9zSW5CdWZmZXIgPSB0aGlzLnBvc2l0aW9uSW5CdWZmZXIoZW5kTm9kZSwgZW5kUG9zaXRpb24ucmVtYWluZGVyKTtcblx0XHR0aGlzLmRlbGV0ZU5vZGVIZWFkKGVuZE5vZGUsIGVuZFNwbGl0UG9zSW5CdWZmZXIpO1xuXHRcdGlmIChlbmROb2RlLnBpZWNlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bm9kZXNUb0RlbC5wdXNoKGVuZE5vZGUpO1xuXHRcdH1cblxuXHRcdC8vIGRlbGV0ZSBub2RlcyBpbiBiZXR3ZWVuXG5cdFx0Y29uc3Qgc2Vjb25kTm9kZSA9IHN0YXJ0Tm9kZS5uZXh0KCk7XG5cdFx0Zm9yIChsZXQgbm9kZSA9IHNlY29uZE5vZGU7IG5vZGUgIT09IFNFTlRJTkVMICYmIG5vZGUgIT09IGVuZE5vZGU7IG5vZGUgPSBub2RlLm5leHQoKSkge1xuXHRcdFx0bm9kZXNUb0RlbC5wdXNoKG5vZGUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXYgPSBzdGFydE5vZGUucGllY2UubGVuZ3RoID09PSAwID8gc3RhcnROb2RlLnByZXYoKSA6IHN0YXJ0Tm9kZTtcblx0XHR0aGlzLmRlbGV0ZU5vZGVzKG5vZGVzVG9EZWwpO1xuXHRcdHRoaXMudmFsaWRhdGVDUkxGV2l0aE5leHROb2RlKHByZXYpO1xuXHRcdHRoaXMuY29tcHV0ZUJ1ZmZlck1ldGFkYXRhKCk7XG5cdH1cblxuXHRwcml2YXRlIGluc2VydENvbnRlbnRUb05vZGVMZWZ0KHZhbHVlOiBzdHJpbmcsIG5vZGU6IFRyZWVOb2RlKSB7XG5cdFx0Ly8gd2UgYXJlIGluc2VydGluZyBjb250ZW50IHRvIHRoZSBiZWdpbm5pbmcgb2Ygbm9kZVxuXHRcdGNvbnN0IG5vZGVzVG9EZWw6IFRyZWVOb2RlW10gPSBbXTtcblx0XHRpZiAodGhpcy5zaG91bGRDaGVja0NSTEYoKSAmJiB0aGlzLmVuZFdpdGhDUih2YWx1ZSkgJiYgdGhpcy5zdGFydFdpdGhMRihub2RlKSkge1xuXHRcdFx0Ly8gbW92ZSBgXFxuYCB0byBuZXcgbm9kZS5cblxuXHRcdFx0Y29uc3QgcGllY2UgPSBub2RlLnBpZWNlO1xuXHRcdFx0Y29uc3QgbmV3U3RhcnQ6IEJ1ZmZlckN1cnNvciA9IHsgbGluZTogcGllY2Uuc3RhcnQubGluZSArIDEsIGNvbHVtbjogMCB9O1xuXHRcdFx0Y29uc3QgblBpZWNlID0gbmV3IFBpZWNlKFxuXHRcdFx0XHRwaWVjZS5idWZmZXJJbmRleCxcblx0XHRcdFx0bmV3U3RhcnQsXG5cdFx0XHRcdHBpZWNlLmVuZCxcblx0XHRcdFx0dGhpcy5nZXRMaW5lRmVlZENudChwaWVjZS5idWZmZXJJbmRleCwgbmV3U3RhcnQsIHBpZWNlLmVuZCksXG5cdFx0XHRcdHBpZWNlLmxlbmd0aCAtIDFcblx0XHRcdCk7XG5cblx0XHRcdG5vZGUucGllY2UgPSBuUGllY2U7XG5cblx0XHRcdHZhbHVlICs9ICdcXG4nO1xuXHRcdFx0dXBkYXRlVHJlZU1ldGFkYXRhKHRoaXMsIG5vZGUsIC0xLCAtMSk7XG5cblx0XHRcdGlmIChub2RlLnBpZWNlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRub2Rlc1RvRGVsLnB1c2gobm9kZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3UGllY2VzID0gdGhpcy5jcmVhdGVOZXdQaWVjZXModmFsdWUpO1xuXHRcdGxldCBuZXdOb2RlID0gdGhpcy5yYkluc2VydExlZnQobm9kZSwgbmV3UGllY2VzW25ld1BpZWNlcy5sZW5ndGggLSAxXSk7XG5cdFx0Zm9yIChsZXQgayA9IG5ld1BpZWNlcy5sZW5ndGggLSAyOyBrID49IDA7IGstLSkge1xuXHRcdFx0bmV3Tm9kZSA9IHRoaXMucmJJbnNlcnRMZWZ0KG5ld05vZGUsIG5ld1BpZWNlc1trXSk7XG5cdFx0fVxuXHRcdHRoaXMudmFsaWRhdGVDUkxGV2l0aFByZXZOb2RlKG5ld05vZGUpO1xuXHRcdHRoaXMuZGVsZXRlTm9kZXMobm9kZXNUb0RlbCk7XG5cdH1cblxuXHRwcml2YXRlIGluc2VydENvbnRlbnRUb05vZGVSaWdodCh2YWx1ZTogc3RyaW5nLCBub2RlOiBUcmVlTm9kZSkge1xuXHRcdC8vIHdlIGFyZSBpbnNlcnRpbmcgdG8gdGhlIHJpZ2h0IG9mIHRoaXMgbm9kZS5cblx0XHRpZiAodGhpcy5hZGp1c3RDYXJyaWFnZVJldHVybkZyb21OZXh0KHZhbHVlLCBub2RlKSkge1xuXHRcdFx0Ly8gbW92ZSBcXG4gdG8gdGhlIG5ldyBub2RlLlxuXHRcdFx0dmFsdWUgKz0gJ1xcbic7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3UGllY2VzID0gdGhpcy5jcmVhdGVOZXdQaWVjZXModmFsdWUpO1xuXHRcdGNvbnN0IG5ld05vZGUgPSB0aGlzLnJiSW5zZXJ0UmlnaHQobm9kZSwgbmV3UGllY2VzWzBdKTtcblx0XHRsZXQgdG1wTm9kZSA9IG5ld05vZGU7XG5cblx0XHRmb3IgKGxldCBrID0gMTsgayA8IG5ld1BpZWNlcy5sZW5ndGg7IGsrKykge1xuXHRcdFx0dG1wTm9kZSA9IHRoaXMucmJJbnNlcnRSaWdodCh0bXBOb2RlLCBuZXdQaWVjZXNba10pO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsaWRhdGVDUkxGV2l0aFByZXZOb2RlKG5ld05vZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBwb3NpdGlvbkluQnVmZmVyKG5vZGU6IFRyZWVOb2RlLCByZW1haW5kZXI6IG51bWJlcik6IEJ1ZmZlckN1cnNvcjtcblx0cHJpdmF0ZSBwb3NpdGlvbkluQnVmZmVyKG5vZGU6IFRyZWVOb2RlLCByZW1haW5kZXI6IG51bWJlciwgcmV0OiBCdWZmZXJDdXJzb3IpOiBudWxsO1xuXHRwcml2YXRlIHBvc2l0aW9uSW5CdWZmZXIobm9kZTogVHJlZU5vZGUsIHJlbWFpbmRlcjogbnVtYmVyLCByZXQ/OiBCdWZmZXJDdXJzb3IpOiBCdWZmZXJDdXJzb3IgfCBudWxsIHtcblx0XHRjb25zdCBwaWVjZSA9IG5vZGUucGllY2U7XG5cdFx0Y29uc3QgYnVmZmVySW5kZXggPSBub2RlLnBpZWNlLmJ1ZmZlckluZGV4O1xuXHRcdGNvbnN0IGxpbmVTdGFydHMgPSB0aGlzLl9idWZmZXJzW2J1ZmZlckluZGV4XS5saW5lU3RhcnRzO1xuXG5cdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSBsaW5lU3RhcnRzW3BpZWNlLnN0YXJ0LmxpbmVdICsgcGllY2Uuc3RhcnQuY29sdW1uO1xuXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gc3RhcnRPZmZzZXQgKyByZW1haW5kZXI7XG5cblx0XHQvLyBiaW5hcnkgc2VhcmNoIG9mZnNldCBiZXR3ZWVuIHN0YXJ0T2Zmc2V0IGFuZCBlbmRPZmZzZXRcblx0XHRsZXQgbG93ID0gcGllY2Uuc3RhcnQubGluZTtcblx0XHRsZXQgaGlnaCA9IHBpZWNlLmVuZC5saW5lO1xuXG5cdFx0bGV0IG1pZDogbnVtYmVyID0gMDtcblx0XHRsZXQgbWlkU3RvcDogbnVtYmVyID0gMDtcblx0XHRsZXQgbWlkU3RhcnQ6IG51bWJlciA9IDA7XG5cblx0XHR3aGlsZSAobG93IDw9IGhpZ2gpIHtcblx0XHRcdG1pZCA9IGxvdyArICgoaGlnaCAtIGxvdykgLyAyKSB8IDA7XG5cdFx0XHRtaWRTdGFydCA9IGxpbmVTdGFydHNbbWlkXTtcblxuXHRcdFx0aWYgKG1pZCA9PT0gaGlnaCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0bWlkU3RvcCA9IGxpbmVTdGFydHNbbWlkICsgMV07XG5cblx0XHRcdGlmIChvZmZzZXQgPCBtaWRTdGFydCkge1xuXHRcdFx0XHRoaWdoID0gbWlkIC0gMTtcblx0XHRcdH0gZWxzZSBpZiAob2Zmc2V0ID49IG1pZFN0b3ApIHtcblx0XHRcdFx0bG93ID0gbWlkICsgMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChyZXQpIHtcblx0XHRcdHJldC5saW5lID0gbWlkO1xuXHRcdFx0cmV0LmNvbHVtbiA9IG9mZnNldCAtIG1pZFN0YXJ0O1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGxpbmU6IG1pZCxcblx0XHRcdGNvbHVtbjogb2Zmc2V0IC0gbWlkU3RhcnRcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRMaW5lRmVlZENudChidWZmZXJJbmRleDogbnVtYmVyLCBzdGFydDogQnVmZmVyQ3Vyc29yLCBlbmQ6IEJ1ZmZlckN1cnNvcik6IG51bWJlciB7XG5cdFx0Ly8gd2UgZG9uJ3QgbmVlZCB0byB3b3JyeSBhYm91dCBzdGFydDogYWJjXFxyfFxcbiwgb3IgYWJjfFxcciwgb3IgYWJjfFxcbiwgb3IgYWJjfFxcclxcbiBkb2Vzbid0IGNoYW5nZSB0aGUgZmFjdCB0aGF0LCB0aGVyZSBpcyBvbmUgbGluZSBicmVhayBhZnRlciBzdGFydC5cblx0XHQvLyBub3cgbGV0J3MgdGFrZSBjYXJlIG9mIGVuZDogYWJjXFxyfFxcbiwgaWYgZW5kIGlzIGluIGJldHdlZW4gXFxyIGFuZCBcXG4sIHdlIG5lZWQgdG8gYWRkIGxpbmUgZmVlZCBjb3VudCBieSAxXG5cdFx0aWYgKGVuZC5jb2x1bW4gPT09IDApIHtcblx0XHRcdHJldHVybiBlbmQubGluZSAtIHN0YXJ0LmxpbmU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZVN0YXJ0cyA9IHRoaXMuX2J1ZmZlcnNbYnVmZmVySW5kZXhdLmxpbmVTdGFydHM7XG5cdFx0aWYgKGVuZC5saW5lID09PSBsaW5lU3RhcnRzLmxlbmd0aCAtIDEpIHsgLy8gaXQgbWVhbnMsIHRoZXJlIGlzIG5vIFxcbiBhZnRlciBlbmQsIG90aGVyd2lzZSwgdGhlcmUgd2lsbCBiZSBvbmUgbW9yZSBsaW5lU3RhcnQuXG5cdFx0XHRyZXR1cm4gZW5kLmxpbmUgLSBzdGFydC5saW5lO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5leHRMaW5lU3RhcnRPZmZzZXQgPSBsaW5lU3RhcnRzW2VuZC5saW5lICsgMV07XG5cdFx0Y29uc3QgZW5kT2Zmc2V0ID0gbGluZVN0YXJ0c1tlbmQubGluZV0gKyBlbmQuY29sdW1uO1xuXHRcdGlmIChuZXh0TGluZVN0YXJ0T2Zmc2V0ID4gZW5kT2Zmc2V0ICsgMSkgeyAvLyB0aGVyZSBhcmUgbW9yZSB0aGFuIDEgY2hhcmFjdGVyIGFmdGVyIGVuZCwgd2hpY2ggbWVhbnMgaXQgY2FuJ3QgYmUgXFxuXG5cdFx0XHRyZXR1cm4gZW5kLmxpbmUgLSBzdGFydC5saW5lO1xuXHRcdH1cblx0XHQvLyBlbmRPZmZzZXQgKyAxID09PSBuZXh0TGluZVN0YXJ0T2Zmc2V0XG5cdFx0Ly8gY2hhcmFjdGVyIGF0IGVuZE9mZnNldCBpcyBcXG4sIHNvIHdlIGNoZWNrIHRoZSBjaGFyYWN0ZXIgYmVmb3JlIGZpcnN0XG5cdFx0Ly8gaWYgY2hhcmFjdGVyIGF0IGVuZE9mZnNldCBpcyBcXHIsIGVuZC5jb2x1bW4gaXMgMCBhbmQgd2UgY2FuJ3QgZ2V0IGhlcmUuXG5cdFx0Y29uc3QgcHJldmlvdXNDaGFyT2Zmc2V0ID0gZW5kT2Zmc2V0IC0gMTsgLy8gZW5kLmNvbHVtbiA+IDAgc28gaXQncyBva2F5LlxuXHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcnNbYnVmZmVySW5kZXhdLmJ1ZmZlcjtcblxuXHRcdGlmIChidWZmZXIuY2hhckNvZGVBdChwcmV2aW91c0NoYXJPZmZzZXQpID09PSAxMykge1xuXHRcdFx0cmV0dXJuIGVuZC5saW5lIC0gc3RhcnQubGluZSArIDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBlbmQubGluZSAtIHN0YXJ0LmxpbmU7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvZmZzZXRJbkJ1ZmZlcihidWZmZXJJbmRleDogbnVtYmVyLCBjdXJzb3I6IEJ1ZmZlckN1cnNvcik6IG51bWJlciB7XG5cdFx0Y29uc3QgbGluZVN0YXJ0cyA9IHRoaXMuX2J1ZmZlcnNbYnVmZmVySW5kZXhdLmxpbmVTdGFydHM7XG5cdFx0cmV0dXJuIGxpbmVTdGFydHNbY3Vyc29yLmxpbmVdICsgY3Vyc29yLmNvbHVtbjtcblx0fVxuXG5cdHByaXZhdGUgZGVsZXRlTm9kZXMobm9kZXM6IFRyZWVOb2RlW10pOiB2b2lkIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRyYkRlbGV0ZSh0aGlzLCBub2Rlc1tpXSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVOZXdQaWVjZXModGV4dDogc3RyaW5nKTogUGllY2VbXSB7XG5cdFx0aWYgKHRleHQubGVuZ3RoID4gQXZlcmFnZUJ1ZmZlclNpemUpIHtcblx0XHRcdC8vIHRoZSBjb250ZW50IGlzIGxhcmdlLCBvcGVyYXRpb25zIGxpa2Ugc3Vic3RyaW5nLCBjaGFyQ29kZSBiZWNvbWVzIHNsb3dcblx0XHRcdC8vIHNvIGhlcmUgd2Ugc3BsaXQgaXQgaW50byBzbWFsbGVyIGNodW5rcywganVzdCBsaWtlIHdoYXQgd2UgZGlkIGZvciBDUi9MRiBub3JtYWxpemF0aW9uXG5cdFx0XHRjb25zdCBuZXdQaWVjZXM6IFBpZWNlW10gPSBbXTtcblx0XHRcdHdoaWxlICh0ZXh0Lmxlbmd0aCA+IEF2ZXJhZ2VCdWZmZXJTaXplKSB7XG5cdFx0XHRcdGNvbnN0IGxhc3RDaGFyID0gdGV4dC5jaGFyQ29kZUF0KEF2ZXJhZ2VCdWZmZXJTaXplIC0gMSk7XG5cdFx0XHRcdGxldCBzcGxpdFRleHQ7XG5cdFx0XHRcdGlmIChsYXN0Q2hhciA9PT0gQ2hhckNvZGUuQ2FycmlhZ2VSZXR1cm4gfHwgKGxhc3RDaGFyID49IDB4RDgwMCAmJiBsYXN0Q2hhciA8PSAweERCRkYpKSB7XG5cdFx0XHRcdFx0Ly8gbGFzdCBjaGFyYWN0ZXIgaXMgXFxyIG9yIGEgaGlnaCBzdXJyb2dhdGUgPT4ga2VlcCBpdCBiYWNrXG5cdFx0XHRcdFx0c3BsaXRUZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgQXZlcmFnZUJ1ZmZlclNpemUgLSAxKTtcblx0XHRcdFx0XHR0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoQXZlcmFnZUJ1ZmZlclNpemUgLSAxKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzcGxpdFRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCBBdmVyYWdlQnVmZmVyU2l6ZSk7XG5cdFx0XHRcdFx0dGV4dCA9IHRleHQuc3Vic3RyaW5nKEF2ZXJhZ2VCdWZmZXJTaXplKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGxpbmVTdGFydHMgPSBjcmVhdGVMaW5lU3RhcnRzRmFzdChzcGxpdFRleHQpO1xuXHRcdFx0XHRuZXdQaWVjZXMucHVzaChuZXcgUGllY2UoXG5cdFx0XHRcdFx0dGhpcy5fYnVmZmVycy5sZW5ndGgsIC8qIGJ1ZmZlciBpbmRleCAqL1xuXHRcdFx0XHRcdHsgbGluZTogMCwgY29sdW1uOiAwIH0sXG5cdFx0XHRcdFx0eyBsaW5lOiBsaW5lU3RhcnRzLmxlbmd0aCAtIDEsIGNvbHVtbjogc3BsaXRUZXh0Lmxlbmd0aCAtIGxpbmVTdGFydHNbbGluZVN0YXJ0cy5sZW5ndGggLSAxXSB9LFxuXHRcdFx0XHRcdGxpbmVTdGFydHMubGVuZ3RoIC0gMSxcblx0XHRcdFx0XHRzcGxpdFRleHQubGVuZ3RoXG5cdFx0XHRcdCkpO1xuXHRcdFx0XHR0aGlzLl9idWZmZXJzLnB1c2gobmV3IFN0cmluZ0J1ZmZlcihzcGxpdFRleHQsIGxpbmVTdGFydHMpKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGluZVN0YXJ0cyA9IGNyZWF0ZUxpbmVTdGFydHNGYXN0KHRleHQpO1xuXHRcdFx0bmV3UGllY2VzLnB1c2gobmV3IFBpZWNlKFxuXHRcdFx0XHR0aGlzLl9idWZmZXJzLmxlbmd0aCwgLyogYnVmZmVyIGluZGV4ICovXG5cdFx0XHRcdHsgbGluZTogMCwgY29sdW1uOiAwIH0sXG5cdFx0XHRcdHsgbGluZTogbGluZVN0YXJ0cy5sZW5ndGggLSAxLCBjb2x1bW46IHRleHQubGVuZ3RoIC0gbGluZVN0YXJ0c1tsaW5lU3RhcnRzLmxlbmd0aCAtIDFdIH0sXG5cdFx0XHRcdGxpbmVTdGFydHMubGVuZ3RoIC0gMSxcblx0XHRcdFx0dGV4dC5sZW5ndGhcblx0XHRcdCkpO1xuXHRcdFx0dGhpcy5fYnVmZmVycy5wdXNoKG5ldyBTdHJpbmdCdWZmZXIodGV4dCwgbGluZVN0YXJ0cykpO1xuXG5cdFx0XHRyZXR1cm4gbmV3UGllY2VzO1xuXHRcdH1cblxuXHRcdGxldCBzdGFydE9mZnNldCA9IHRoaXMuX2J1ZmZlcnNbMF0uYnVmZmVyLmxlbmd0aDtcblx0XHRjb25zdCBsaW5lU3RhcnRzID0gY3JlYXRlTGluZVN0YXJ0c0Zhc3QodGV4dCwgZmFsc2UpO1xuXG5cdFx0bGV0IHN0YXJ0ID0gdGhpcy5fbGFzdENoYW5nZUJ1ZmZlclBvcztcblx0XHRpZiAodGhpcy5fYnVmZmVyc1swXS5saW5lU3RhcnRzW3RoaXMuX2J1ZmZlcnNbMF0ubGluZVN0YXJ0cy5sZW5ndGggLSAxXSA9PT0gc3RhcnRPZmZzZXRcblx0XHRcdCYmIHN0YXJ0T2Zmc2V0ICE9PSAwXG5cdFx0XHQmJiB0aGlzLnN0YXJ0V2l0aExGKHRleHQpXG5cdFx0XHQmJiB0aGlzLmVuZFdpdGhDUih0aGlzLl9idWZmZXJzWzBdLmJ1ZmZlcikgLy8gdG9kbywgd2UgY2FuIGNoZWNrIHRoaXMuX2xhc3RDaGFuZ2VCdWZmZXJQb3MncyBjb2x1bW4gYXMgaXQncyB0aGUgbGFzdCBvbmVcblx0XHQpIHtcblx0XHRcdHRoaXMuX2xhc3RDaGFuZ2VCdWZmZXJQb3MgPSB7IGxpbmU6IHRoaXMuX2xhc3RDaGFuZ2VCdWZmZXJQb3MubGluZSwgY29sdW1uOiB0aGlzLl9sYXN0Q2hhbmdlQnVmZmVyUG9zLmNvbHVtbiArIDEgfTtcblx0XHRcdHN0YXJ0ID0gdGhpcy5fbGFzdENoYW5nZUJ1ZmZlclBvcztcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lU3RhcnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGxpbmVTdGFydHNbaV0gKz0gc3RhcnRPZmZzZXQgKyAxO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9idWZmZXJzWzBdLmxpbmVTdGFydHMgPSAoPG51bWJlcltdPnRoaXMuX2J1ZmZlcnNbMF0ubGluZVN0YXJ0cykuY29uY2F0KDxudW1iZXJbXT5saW5lU3RhcnRzLnNsaWNlKDEpKTtcblx0XHRcdHRoaXMuX2J1ZmZlcnNbMF0uYnVmZmVyICs9ICdfJyArIHRleHQ7XG5cdFx0XHRzdGFydE9mZnNldCArPSAxO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoc3RhcnRPZmZzZXQgIT09IDApIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lU3RhcnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0bGluZVN0YXJ0c1tpXSArPSBzdGFydE9mZnNldDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fYnVmZmVyc1swXS5saW5lU3RhcnRzID0gKDxudW1iZXJbXT50aGlzLl9idWZmZXJzWzBdLmxpbmVTdGFydHMpLmNvbmNhdCg8bnVtYmVyW10+bGluZVN0YXJ0cy5zbGljZSgxKSk7XG5cdFx0XHR0aGlzLl9idWZmZXJzWzBdLmJ1ZmZlciArPSB0ZXh0O1xuXHRcdH1cblxuXHRcdGNvbnN0IGVuZE9mZnNldCA9IHRoaXMuX2J1ZmZlcnNbMF0uYnVmZmVyLmxlbmd0aDtcblx0XHRjb25zdCBlbmRJbmRleCA9IHRoaXMuX2J1ZmZlcnNbMF0ubGluZVN0YXJ0cy5sZW5ndGggLSAxO1xuXHRcdGNvbnN0IGVuZENvbHVtbiA9IGVuZE9mZnNldCAtIHRoaXMuX2J1ZmZlcnNbMF0ubGluZVN0YXJ0c1tlbmRJbmRleF07XG5cdFx0Y29uc3QgZW5kUG9zID0geyBsaW5lOiBlbmRJbmRleCwgY29sdW1uOiBlbmRDb2x1bW4gfTtcblx0XHRjb25zdCBuZXdQaWVjZSA9IG5ldyBQaWVjZShcblx0XHRcdDAsIC8qKiB0b2RvQHBlbmcgKi9cblx0XHRcdHN0YXJ0LFxuXHRcdFx0ZW5kUG9zLFxuXHRcdFx0dGhpcy5nZXRMaW5lRmVlZENudCgwLCBzdGFydCwgZW5kUG9zKSxcblx0XHRcdGVuZE9mZnNldCAtIHN0YXJ0T2Zmc2V0XG5cdFx0KTtcblx0XHR0aGlzLl9sYXN0Q2hhbmdlQnVmZmVyUG9zID0gZW5kUG9zO1xuXHRcdHJldHVybiBbbmV3UGllY2VdO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVzUmF3Q29udGVudCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmdldENvbnRlbnRPZlN1YlRyZWUodGhpcy5yb290KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lUmF3Q29udGVudChsaW5lTnVtYmVyOiBudW1iZXIsIGVuZE9mZnNldDogbnVtYmVyID0gMCk6IHN0cmluZyB7XG5cdFx0bGV0IHggPSB0aGlzLnJvb3Q7XG5cblx0XHRsZXQgcmV0ID0gJyc7XG5cdFx0Y29uc3QgY2FjaGUgPSB0aGlzLl9zZWFyY2hDYWNoZS5nZXQyKGxpbmVOdW1iZXIpO1xuXHRcdGlmIChjYWNoZSkge1xuXHRcdFx0eCA9IGNhY2hlLm5vZGU7XG5cdFx0XHRjb25zdCBwcmV2QWNjdW11bGF0ZWRWYWx1ZSA9IHRoaXMuZ2V0QWNjdW11bGF0ZWRWYWx1ZSh4LCBsaW5lTnVtYmVyIC0gY2FjaGUubm9kZVN0YXJ0TGluZU51bWJlciAtIDEpO1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fYnVmZmVyc1t4LnBpZWNlLmJ1ZmZlckluZGV4XS5idWZmZXI7XG5cdFx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIoeC5waWVjZS5idWZmZXJJbmRleCwgeC5waWVjZS5zdGFydCk7XG5cdFx0XHRpZiAoY2FjaGUubm9kZVN0YXJ0TGluZU51bWJlciArIHgucGllY2UubGluZUZlZWRDbnQgPT09IGxpbmVOdW1iZXIpIHtcblx0XHRcdFx0cmV0ID0gYnVmZmVyLnN1YnN0cmluZyhzdGFydE9mZnNldCArIHByZXZBY2N1bXVsYXRlZFZhbHVlLCBzdGFydE9mZnNldCArIHgucGllY2UubGVuZ3RoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGFjY3VtdWxhdGVkVmFsdWUgPSB0aGlzLmdldEFjY3VtdWxhdGVkVmFsdWUoeCwgbGluZU51bWJlciAtIGNhY2hlLm5vZGVTdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRyZXR1cm4gYnVmZmVyLnN1YnN0cmluZyhzdGFydE9mZnNldCArIHByZXZBY2N1bXVsYXRlZFZhbHVlLCBzdGFydE9mZnNldCArIGFjY3VtdWxhdGVkVmFsdWUgLSBlbmRPZmZzZXQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZXQgbm9kZVN0YXJ0T2Zmc2V0ID0gMDtcblx0XHRcdGNvbnN0IG9yaWdpbmFsTGluZU51bWJlciA9IGxpbmVOdW1iZXI7XG5cdFx0XHR3aGlsZSAoeCAhPT0gU0VOVElORUwpIHtcblx0XHRcdFx0aWYgKHgubGVmdCAhPT0gU0VOVElORUwgJiYgeC5sZl9sZWZ0ID49IGxpbmVOdW1iZXIgLSAxKSB7XG5cdFx0XHRcdFx0eCA9IHgubGVmdDtcblx0XHRcdFx0fSBlbHNlIGlmICh4LmxmX2xlZnQgKyB4LnBpZWNlLmxpbmVGZWVkQ250ID4gbGluZU51bWJlciAtIDEpIHtcblx0XHRcdFx0XHRjb25zdCBwcmV2QWNjdW11bGF0ZWRWYWx1ZSA9IHRoaXMuZ2V0QWNjdW11bGF0ZWRWYWx1ZSh4LCBsaW5lTnVtYmVyIC0geC5sZl9sZWZ0IC0gMik7XG5cdFx0XHRcdFx0Y29uc3QgYWNjdW11bGF0ZWRWYWx1ZSA9IHRoaXMuZ2V0QWNjdW11bGF0ZWRWYWx1ZSh4LCBsaW5lTnVtYmVyIC0geC5sZl9sZWZ0IC0gMSk7XG5cdFx0XHRcdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fYnVmZmVyc1t4LnBpZWNlLmJ1ZmZlckluZGV4XS5idWZmZXI7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKHgucGllY2UuYnVmZmVySW5kZXgsIHgucGllY2Uuc3RhcnQpO1xuXHRcdFx0XHRcdG5vZGVTdGFydE9mZnNldCArPSB4LnNpemVfbGVmdDtcblx0XHRcdFx0XHR0aGlzLl9zZWFyY2hDYWNoZS5zZXQoe1xuXHRcdFx0XHRcdFx0bm9kZTogeCxcblx0XHRcdFx0XHRcdG5vZGVTdGFydE9mZnNldCxcblx0XHRcdFx0XHRcdG5vZGVTdGFydExpbmVOdW1iZXI6IG9yaWdpbmFsTGluZU51bWJlciAtIChsaW5lTnVtYmVyIC0gMSAtIHgubGZfbGVmdClcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdHJldHVybiBidWZmZXIuc3Vic3RyaW5nKHN0YXJ0T2Zmc2V0ICsgcHJldkFjY3VtdWxhdGVkVmFsdWUsIHN0YXJ0T2Zmc2V0ICsgYWNjdW11bGF0ZWRWYWx1ZSAtIGVuZE9mZnNldCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoeC5sZl9sZWZ0ICsgeC5waWVjZS5saW5lRmVlZENudCA9PT0gbGluZU51bWJlciAtIDEpIHtcblx0XHRcdFx0XHRjb25zdCBwcmV2QWNjdW11bGF0ZWRWYWx1ZSA9IHRoaXMuZ2V0QWNjdW11bGF0ZWRWYWx1ZSh4LCBsaW5lTnVtYmVyIC0geC5sZl9sZWZ0IC0gMik7XG5cdFx0XHRcdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fYnVmZmVyc1t4LnBpZWNlLmJ1ZmZlckluZGV4XS5idWZmZXI7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKHgucGllY2UuYnVmZmVySW5kZXgsIHgucGllY2Uuc3RhcnQpO1xuXG5cdFx0XHRcdFx0cmV0ID0gYnVmZmVyLnN1YnN0cmluZyhzdGFydE9mZnNldCArIHByZXZBY2N1bXVsYXRlZFZhbHVlLCBzdGFydE9mZnNldCArIHgucGllY2UubGVuZ3RoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsaW5lTnVtYmVyIC09IHgubGZfbGVmdCArIHgucGllY2UubGluZUZlZWRDbnQ7XG5cdFx0XHRcdFx0bm9kZVN0YXJ0T2Zmc2V0ICs9IHguc2l6ZV9sZWZ0ICsgeC5waWVjZS5sZW5ndGg7XG5cdFx0XHRcdFx0eCA9IHgucmlnaHQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBzZWFyY2ggaW4gb3JkZXIsIHRvIGZpbmQgdGhlIG5vZGUgY29udGFpbnMgZW5kIGNvbHVtblxuXHRcdHggPSB4Lm5leHQoKTtcblx0XHR3aGlsZSAoeCAhPT0gU0VOVElORUwpIHtcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcnNbeC5waWVjZS5idWZmZXJJbmRleF0uYnVmZmVyO1xuXG5cdFx0XHRpZiAoeC5waWVjZS5saW5lRmVlZENudCA+IDApIHtcblx0XHRcdFx0Y29uc3QgYWNjdW11bGF0ZWRWYWx1ZSA9IHRoaXMuZ2V0QWNjdW11bGF0ZWRWYWx1ZSh4LCAwKTtcblx0XHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKHgucGllY2UuYnVmZmVySW5kZXgsIHgucGllY2Uuc3RhcnQpO1xuXG5cdFx0XHRcdHJldCArPSBidWZmZXIuc3Vic3RyaW5nKHN0YXJ0T2Zmc2V0LCBzdGFydE9mZnNldCArIGFjY3VtdWxhdGVkVmFsdWUgLSBlbmRPZmZzZXQpO1xuXHRcdFx0XHRyZXR1cm4gcmV0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKHgucGllY2UuYnVmZmVySW5kZXgsIHgucGllY2Uuc3RhcnQpO1xuXHRcdFx0XHRyZXQgKz0gYnVmZmVyLnN1YnN0cihzdGFydE9mZnNldCwgeC5waWVjZS5sZW5ndGgpO1xuXHRcdFx0fVxuXG5cdFx0XHR4ID0geC5uZXh0KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZUJ1ZmZlck1ldGFkYXRhKCkge1xuXHRcdGxldCB4ID0gdGhpcy5yb290O1xuXG5cdFx0bGV0IGxmQ250ID0gMTtcblx0XHRsZXQgbGVuID0gMDtcblxuXHRcdHdoaWxlICh4ICE9PSBTRU5USU5FTCkge1xuXHRcdFx0bGZDbnQgKz0geC5sZl9sZWZ0ICsgeC5waWVjZS5saW5lRmVlZENudDtcblx0XHRcdGxlbiArPSB4LnNpemVfbGVmdCArIHgucGllY2UubGVuZ3RoO1xuXHRcdFx0eCA9IHgucmlnaHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbGluZUNudCA9IGxmQ250O1xuXHRcdHRoaXMuX2xlbmd0aCA9IGxlbjtcblx0XHR0aGlzLl9zZWFyY2hDYWNoZS52YWxpZGF0ZSh0aGlzLl9sZW5ndGgpO1xuXHR9XG5cblx0Ly8gI3JlZ2lvbiBub2RlIG9wZXJhdGlvbnNcblx0cHJpdmF0ZSBnZXRJbmRleE9mKG5vZGU6IFRyZWVOb2RlLCBhY2N1bXVsYXRlZFZhbHVlOiBudW1iZXIpOiB7IGluZGV4OiBudW1iZXI7IHJlbWFpbmRlcjogbnVtYmVyIH0ge1xuXHRcdGNvbnN0IHBpZWNlID0gbm9kZS5waWVjZTtcblx0XHRjb25zdCBwb3MgPSB0aGlzLnBvc2l0aW9uSW5CdWZmZXIobm9kZSwgYWNjdW11bGF0ZWRWYWx1ZSk7XG5cdFx0Y29uc3QgbGluZUNudCA9IHBvcy5saW5lIC0gcGllY2Uuc3RhcnQubGluZTtcblxuXHRcdGlmICh0aGlzLm9mZnNldEluQnVmZmVyKHBpZWNlLmJ1ZmZlckluZGV4LCBwaWVjZS5lbmQpIC0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihwaWVjZS5idWZmZXJJbmRleCwgcGllY2Uuc3RhcnQpID09PSBhY2N1bXVsYXRlZFZhbHVlKSB7XG5cdFx0XHQvLyB3ZSBhcmUgY2hlY2tpbmcgdGhlIGVuZCBvZiB0aGlzIG5vZGUsIHNvIGEgQ1JMRiBjaGVjayBpcyBuZWNlc3NhcnkuXG5cdFx0XHRjb25zdCByZWFsTGluZUNudCA9IHRoaXMuZ2V0TGluZUZlZWRDbnQobm9kZS5waWVjZS5idWZmZXJJbmRleCwgcGllY2Uuc3RhcnQsIHBvcyk7XG5cdFx0XHRpZiAocmVhbExpbmVDbnQgIT09IGxpbmVDbnQpIHtcblx0XHRcdFx0Ly8gYWhhIHllcywgQ1JMRlxuXHRcdFx0XHRyZXR1cm4geyBpbmRleDogcmVhbExpbmVDbnQsIHJlbWFpbmRlcjogMCB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IGluZGV4OiBsaW5lQ250LCByZW1haW5kZXI6IHBvcy5jb2x1bW4gfTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWNjdW11bGF0ZWRWYWx1ZShub2RlOiBUcmVlTm9kZSwgaW5kZXg6IG51bWJlcikge1xuXHRcdGlmIChpbmRleCA8IDApIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0XHRjb25zdCBwaWVjZSA9IG5vZGUucGllY2U7XG5cdFx0Y29uc3QgbGluZVN0YXJ0cyA9IHRoaXMuX2J1ZmZlcnNbcGllY2UuYnVmZmVySW5kZXhdLmxpbmVTdGFydHM7XG5cdFx0Y29uc3QgZXhwZWN0ZWRMaW5lU3RhcnRJbmRleCA9IHBpZWNlLnN0YXJ0LmxpbmUgKyBpbmRleCArIDE7XG5cdFx0aWYgKGV4cGVjdGVkTGluZVN0YXJ0SW5kZXggPiBwaWVjZS5lbmQubGluZSkge1xuXHRcdFx0cmV0dXJuIGxpbmVTdGFydHNbcGllY2UuZW5kLmxpbmVdICsgcGllY2UuZW5kLmNvbHVtbiAtIGxpbmVTdGFydHNbcGllY2Uuc3RhcnQubGluZV0gLSBwaWVjZS5zdGFydC5jb2x1bW47XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBsaW5lU3RhcnRzW2V4cGVjdGVkTGluZVN0YXJ0SW5kZXhdIC0gbGluZVN0YXJ0c1twaWVjZS5zdGFydC5saW5lXSAtIHBpZWNlLnN0YXJ0LmNvbHVtbjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRlbGV0ZU5vZGVUYWlsKG5vZGU6IFRyZWVOb2RlLCBwb3M6IEJ1ZmZlckN1cnNvcikge1xuXHRcdGNvbnN0IHBpZWNlID0gbm9kZS5waWVjZTtcblx0XHRjb25zdCBvcmlnaW5hbExGQ250ID0gcGllY2UubGluZUZlZWRDbnQ7XG5cdFx0Y29uc3Qgb3JpZ2luYWxFbmRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKHBpZWNlLmJ1ZmZlckluZGV4LCBwaWVjZS5lbmQpO1xuXG5cdFx0Y29uc3QgbmV3RW5kID0gcG9zO1xuXHRcdGNvbnN0IG5ld0VuZE9mZnNldCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIocGllY2UuYnVmZmVySW5kZXgsIG5ld0VuZCk7XG5cdFx0Y29uc3QgbmV3TGluZUZlZWRDbnQgPSB0aGlzLmdldExpbmVGZWVkQ250KHBpZWNlLmJ1ZmZlckluZGV4LCBwaWVjZS5zdGFydCwgbmV3RW5kKTtcblxuXHRcdGNvbnN0IGxmX2RlbHRhID0gbmV3TGluZUZlZWRDbnQgLSBvcmlnaW5hbExGQ250O1xuXHRcdGNvbnN0IHNpemVfZGVsdGEgPSBuZXdFbmRPZmZzZXQgLSBvcmlnaW5hbEVuZE9mZnNldDtcblx0XHRjb25zdCBuZXdMZW5ndGggPSBwaWVjZS5sZW5ndGggKyBzaXplX2RlbHRhO1xuXG5cdFx0bm9kZS5waWVjZSA9IG5ldyBQaWVjZShcblx0XHRcdHBpZWNlLmJ1ZmZlckluZGV4LFxuXHRcdFx0cGllY2Uuc3RhcnQsXG5cdFx0XHRuZXdFbmQsXG5cdFx0XHRuZXdMaW5lRmVlZENudCxcblx0XHRcdG5ld0xlbmd0aFxuXHRcdCk7XG5cblx0XHR1cGRhdGVUcmVlTWV0YWRhdGEodGhpcywgbm9kZSwgc2l6ZV9kZWx0YSwgbGZfZGVsdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBkZWxldGVOb2RlSGVhZChub2RlOiBUcmVlTm9kZSwgcG9zOiBCdWZmZXJDdXJzb3IpIHtcblx0XHRjb25zdCBwaWVjZSA9IG5vZGUucGllY2U7XG5cdFx0Y29uc3Qgb3JpZ2luYWxMRkNudCA9IHBpZWNlLmxpbmVGZWVkQ250O1xuXHRcdGNvbnN0IG9yaWdpbmFsU3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKHBpZWNlLmJ1ZmZlckluZGV4LCBwaWVjZS5zdGFydCk7XG5cblx0XHRjb25zdCBuZXdTdGFydCA9IHBvcztcblx0XHRjb25zdCBuZXdMaW5lRmVlZENudCA9IHRoaXMuZ2V0TGluZUZlZWRDbnQocGllY2UuYnVmZmVySW5kZXgsIG5ld1N0YXJ0LCBwaWVjZS5lbmQpO1xuXHRcdGNvbnN0IG5ld1N0YXJ0T2Zmc2V0ID0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihwaWVjZS5idWZmZXJJbmRleCwgbmV3U3RhcnQpO1xuXHRcdGNvbnN0IGxmX2RlbHRhID0gbmV3TGluZUZlZWRDbnQgLSBvcmlnaW5hbExGQ250O1xuXHRcdGNvbnN0IHNpemVfZGVsdGEgPSBvcmlnaW5hbFN0YXJ0T2Zmc2V0IC0gbmV3U3RhcnRPZmZzZXQ7XG5cdFx0Y29uc3QgbmV3TGVuZ3RoID0gcGllY2UubGVuZ3RoICsgc2l6ZV9kZWx0YTtcblx0XHRub2RlLnBpZWNlID0gbmV3IFBpZWNlKFxuXHRcdFx0cGllY2UuYnVmZmVySW5kZXgsXG5cdFx0XHRuZXdTdGFydCxcblx0XHRcdHBpZWNlLmVuZCxcblx0XHRcdG5ld0xpbmVGZWVkQ250LFxuXHRcdFx0bmV3TGVuZ3RoXG5cdFx0KTtcblxuXHRcdHVwZGF0ZVRyZWVNZXRhZGF0YSh0aGlzLCBub2RlLCBzaXplX2RlbHRhLCBsZl9kZWx0YSk7XG5cdH1cblxuXHRwcml2YXRlIHNocmlua05vZGUobm9kZTogVHJlZU5vZGUsIHN0YXJ0OiBCdWZmZXJDdXJzb3IsIGVuZDogQnVmZmVyQ3Vyc29yKSB7XG5cdFx0Y29uc3QgcGllY2UgPSBub2RlLnBpZWNlO1xuXHRcdGNvbnN0IG9yaWdpbmFsU3RhcnRQb3MgPSBwaWVjZS5zdGFydDtcblx0XHRjb25zdCBvcmlnaW5hbEVuZFBvcyA9IHBpZWNlLmVuZDtcblxuXHRcdC8vIG9sZCBwaWVjZSwgb3JpZ2luYWxTdGFydFBvcywgc3RhcnRcblx0XHRjb25zdCBvbGRMZW5ndGggPSBwaWVjZS5sZW5ndGg7XG5cdFx0Y29uc3Qgb2xkTEZDbnQgPSBwaWVjZS5saW5lRmVlZENudDtcblx0XHRjb25zdCBuZXdFbmQgPSBzdGFydDtcblx0XHRjb25zdCBuZXdMaW5lRmVlZENudCA9IHRoaXMuZ2V0TGluZUZlZWRDbnQocGllY2UuYnVmZmVySW5kZXgsIHBpZWNlLnN0YXJ0LCBuZXdFbmQpO1xuXHRcdGNvbnN0IG5ld0xlbmd0aCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIocGllY2UuYnVmZmVySW5kZXgsIHN0YXJ0KSAtIHRoaXMub2Zmc2V0SW5CdWZmZXIocGllY2UuYnVmZmVySW5kZXgsIG9yaWdpbmFsU3RhcnRQb3MpO1xuXG5cdFx0bm9kZS5waWVjZSA9IG5ldyBQaWVjZShcblx0XHRcdHBpZWNlLmJ1ZmZlckluZGV4LFxuXHRcdFx0cGllY2Uuc3RhcnQsXG5cdFx0XHRuZXdFbmQsXG5cdFx0XHRuZXdMaW5lRmVlZENudCxcblx0XHRcdG5ld0xlbmd0aFxuXHRcdCk7XG5cblx0XHR1cGRhdGVUcmVlTWV0YWRhdGEodGhpcywgbm9kZSwgbmV3TGVuZ3RoIC0gb2xkTGVuZ3RoLCBuZXdMaW5lRmVlZENudCAtIG9sZExGQ250KTtcblxuXHRcdC8vIG5ldyByaWdodCBwaWVjZSwgZW5kLCBvcmlnaW5hbEVuZFBvc1xuXHRcdGNvbnN0IG5ld1BpZWNlID0gbmV3IFBpZWNlKFxuXHRcdFx0cGllY2UuYnVmZmVySW5kZXgsXG5cdFx0XHRlbmQsXG5cdFx0XHRvcmlnaW5hbEVuZFBvcyxcblx0XHRcdHRoaXMuZ2V0TGluZUZlZWRDbnQocGllY2UuYnVmZmVySW5kZXgsIGVuZCwgb3JpZ2luYWxFbmRQb3MpLFxuXHRcdFx0dGhpcy5vZmZzZXRJbkJ1ZmZlcihwaWVjZS5idWZmZXJJbmRleCwgb3JpZ2luYWxFbmRQb3MpIC0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihwaWVjZS5idWZmZXJJbmRleCwgZW5kKVxuXHRcdCk7XG5cblx0XHRjb25zdCBuZXdOb2RlID0gdGhpcy5yYkluc2VydFJpZ2h0KG5vZGUsIG5ld1BpZWNlKTtcblx0XHR0aGlzLnZhbGlkYXRlQ1JMRldpdGhQcmV2Tm9kZShuZXdOb2RlKTtcblx0fVxuXG5cdHByaXZhdGUgYXBwZW5kVG9Ob2RlKG5vZGU6IFRyZWVOb2RlLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuYWRqdXN0Q2FycmlhZ2VSZXR1cm5Gcm9tTmV4dCh2YWx1ZSwgbm9kZSkpIHtcblx0XHRcdHZhbHVlICs9ICdcXG4nO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhpdENSTEYgPSB0aGlzLnNob3VsZENoZWNrQ1JMRigpICYmIHRoaXMuc3RhcnRXaXRoTEYodmFsdWUpICYmIHRoaXMuZW5kV2l0aENSKG5vZGUpO1xuXHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gdGhpcy5fYnVmZmVyc1swXS5idWZmZXIubGVuZ3RoO1xuXHRcdHRoaXMuX2J1ZmZlcnNbMF0uYnVmZmVyICs9IHZhbHVlO1xuXHRcdGNvbnN0IGxpbmVTdGFydHMgPSBjcmVhdGVMaW5lU3RhcnRzRmFzdCh2YWx1ZSwgZmFsc2UpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZVN0YXJ0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0bGluZVN0YXJ0c1tpXSArPSBzdGFydE9mZnNldDtcblx0XHR9XG5cdFx0aWYgKGhpdENSTEYpIHtcblx0XHRcdGNvbnN0IHByZXZTdGFydE9mZnNldCA9IHRoaXMuX2J1ZmZlcnNbMF0ubGluZVN0YXJ0c1t0aGlzLl9idWZmZXJzWzBdLmxpbmVTdGFydHMubGVuZ3RoIC0gMl07XG5cdFx0XHQoPG51bWJlcltdPnRoaXMuX2J1ZmZlcnNbMF0ubGluZVN0YXJ0cykucG9wKCk7XG5cdFx0XHQvLyBfbGFzdENoYW5nZUJ1ZmZlclBvcyBpcyBhbHJlYWR5IHdyb25nXG5cdFx0XHR0aGlzLl9sYXN0Q2hhbmdlQnVmZmVyUG9zID0geyBsaW5lOiB0aGlzLl9sYXN0Q2hhbmdlQnVmZmVyUG9zLmxpbmUgLSAxLCBjb2x1bW46IHN0YXJ0T2Zmc2V0IC0gcHJldlN0YXJ0T2Zmc2V0IH07XG5cdFx0fVxuXG5cdFx0dGhpcy5fYnVmZmVyc1swXS5saW5lU3RhcnRzID0gKDxudW1iZXJbXT50aGlzLl9idWZmZXJzWzBdLmxpbmVTdGFydHMpLmNvbmNhdCg8bnVtYmVyW10+bGluZVN0YXJ0cy5zbGljZSgxKSk7XG5cdFx0Y29uc3QgZW5kSW5kZXggPSB0aGlzLl9idWZmZXJzWzBdLmxpbmVTdGFydHMubGVuZ3RoIC0gMTtcblx0XHRjb25zdCBlbmRDb2x1bW4gPSB0aGlzLl9idWZmZXJzWzBdLmJ1ZmZlci5sZW5ndGggLSB0aGlzLl9idWZmZXJzWzBdLmxpbmVTdGFydHNbZW5kSW5kZXhdO1xuXHRcdGNvbnN0IG5ld0VuZCA9IHsgbGluZTogZW5kSW5kZXgsIGNvbHVtbjogZW5kQ29sdW1uIH07XG5cdFx0Y29uc3QgbmV3TGVuZ3RoID0gbm9kZS5waWVjZS5sZW5ndGggKyB2YWx1ZS5sZW5ndGg7XG5cdFx0Y29uc3Qgb2xkTGluZUZlZWRDbnQgPSBub2RlLnBpZWNlLmxpbmVGZWVkQ250O1xuXHRcdGNvbnN0IG5ld0xpbmVGZWVkQ250ID0gdGhpcy5nZXRMaW5lRmVlZENudCgwLCBub2RlLnBpZWNlLnN0YXJ0LCBuZXdFbmQpO1xuXHRcdGNvbnN0IGxmX2RlbHRhID0gbmV3TGluZUZlZWRDbnQgLSBvbGRMaW5lRmVlZENudDtcblxuXHRcdG5vZGUucGllY2UgPSBuZXcgUGllY2UoXG5cdFx0XHRub2RlLnBpZWNlLmJ1ZmZlckluZGV4LFxuXHRcdFx0bm9kZS5waWVjZS5zdGFydCxcblx0XHRcdG5ld0VuZCxcblx0XHRcdG5ld0xpbmVGZWVkQ250LFxuXHRcdFx0bmV3TGVuZ3RoXG5cdFx0KTtcblxuXHRcdHRoaXMuX2xhc3RDaGFuZ2VCdWZmZXJQb3MgPSBuZXdFbmQ7XG5cdFx0dXBkYXRlVHJlZU1ldGFkYXRhKHRoaXMsIG5vZGUsIHZhbHVlLmxlbmd0aCwgbGZfZGVsdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBub2RlQXQob2Zmc2V0OiBudW1iZXIpOiBOb2RlUG9zaXRpb24ge1xuXHRcdGxldCB4ID0gdGhpcy5yb290O1xuXHRcdGNvbnN0IGNhY2hlID0gdGhpcy5fc2VhcmNoQ2FjaGUuZ2V0KG9mZnNldCk7XG5cdFx0aWYgKGNhY2hlKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRub2RlOiBjYWNoZS5ub2RlLFxuXHRcdFx0XHRub2RlU3RhcnRPZmZzZXQ6IGNhY2hlLm5vZGVTdGFydE9mZnNldCxcblx0XHRcdFx0cmVtYWluZGVyOiBvZmZzZXQgLSBjYWNoZS5ub2RlU3RhcnRPZmZzZXRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0bGV0IG5vZGVTdGFydE9mZnNldCA9IDA7XG5cblx0XHR3aGlsZSAoeCAhPT0gU0VOVElORUwpIHtcblx0XHRcdGlmICh4LnNpemVfbGVmdCA+IG9mZnNldCkge1xuXHRcdFx0XHR4ID0geC5sZWZ0O1xuXHRcdFx0fSBlbHNlIGlmICh4LnNpemVfbGVmdCArIHgucGllY2UubGVuZ3RoID49IG9mZnNldCkge1xuXHRcdFx0XHRub2RlU3RhcnRPZmZzZXQgKz0geC5zaXplX2xlZnQ7XG5cdFx0XHRcdGNvbnN0IHJldCA9IHtcblx0XHRcdFx0XHRub2RlOiB4LFxuXHRcdFx0XHRcdHJlbWFpbmRlcjogb2Zmc2V0IC0geC5zaXplX2xlZnQsXG5cdFx0XHRcdFx0bm9kZVN0YXJ0T2Zmc2V0XG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMuX3NlYXJjaENhY2hlLnNldChyZXQpO1xuXHRcdFx0XHRyZXR1cm4gcmV0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b2Zmc2V0IC09IHguc2l6ZV9sZWZ0ICsgeC5waWVjZS5sZW5ndGg7XG5cdFx0XHRcdG5vZGVTdGFydE9mZnNldCArPSB4LnNpemVfbGVmdCArIHgucGllY2UubGVuZ3RoO1xuXHRcdFx0XHR4ID0geC5yaWdodDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbCE7XG5cdH1cblxuXHRwcml2YXRlIG5vZGVBdDIobGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlcik6IE5vZGVQb3NpdGlvbiB7XG5cdFx0bGV0IHggPSB0aGlzLnJvb3Q7XG5cdFx0bGV0IG5vZGVTdGFydE9mZnNldCA9IDA7XG5cblx0XHR3aGlsZSAoeCAhPT0gU0VOVElORUwpIHtcblx0XHRcdGlmICh4LmxlZnQgIT09IFNFTlRJTkVMICYmIHgubGZfbGVmdCA+PSBsaW5lTnVtYmVyIC0gMSkge1xuXHRcdFx0XHR4ID0geC5sZWZ0O1xuXHRcdFx0fSBlbHNlIGlmICh4LmxmX2xlZnQgKyB4LnBpZWNlLmxpbmVGZWVkQ250ID4gbGluZU51bWJlciAtIDEpIHtcblx0XHRcdFx0Y29uc3QgcHJldkFjY3VtdWFsdGVkVmFsdWUgPSB0aGlzLmdldEFjY3VtdWxhdGVkVmFsdWUoeCwgbGluZU51bWJlciAtIHgubGZfbGVmdCAtIDIpO1xuXHRcdFx0XHRjb25zdCBhY2N1bXVsYXRlZFZhbHVlID0gdGhpcy5nZXRBY2N1bXVsYXRlZFZhbHVlKHgsIGxpbmVOdW1iZXIgLSB4LmxmX2xlZnQgLSAxKTtcblx0XHRcdFx0bm9kZVN0YXJ0T2Zmc2V0ICs9IHguc2l6ZV9sZWZ0O1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bm9kZTogeCxcblx0XHRcdFx0XHRyZW1haW5kZXI6IE1hdGgubWluKHByZXZBY2N1bXVhbHRlZFZhbHVlICsgY29sdW1uIC0gMSwgYWNjdW11bGF0ZWRWYWx1ZSksXG5cdFx0XHRcdFx0bm9kZVN0YXJ0T2Zmc2V0XG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2UgaWYgKHgubGZfbGVmdCArIHgucGllY2UubGluZUZlZWRDbnQgPT09IGxpbmVOdW1iZXIgLSAxKSB7XG5cdFx0XHRcdGNvbnN0IHByZXZBY2N1bXVhbHRlZFZhbHVlID0gdGhpcy5nZXRBY2N1bXVsYXRlZFZhbHVlKHgsIGxpbmVOdW1iZXIgLSB4LmxmX2xlZnQgLSAyKTtcblx0XHRcdFx0aWYgKHByZXZBY2N1bXVhbHRlZFZhbHVlICsgY29sdW1uIC0gMSA8PSB4LnBpZWNlLmxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRub2RlOiB4LFxuXHRcdFx0XHRcdFx0cmVtYWluZGVyOiBwcmV2QWNjdW11YWx0ZWRWYWx1ZSArIGNvbHVtbiAtIDEsXG5cdFx0XHRcdFx0XHRub2RlU3RhcnRPZmZzZXRcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbHVtbiAtPSB4LnBpZWNlLmxlbmd0aCAtIHByZXZBY2N1bXVhbHRlZFZhbHVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsaW5lTnVtYmVyIC09IHgubGZfbGVmdCArIHgucGllY2UubGluZUZlZWRDbnQ7XG5cdFx0XHRcdG5vZGVTdGFydE9mZnNldCArPSB4LnNpemVfbGVmdCArIHgucGllY2UubGVuZ3RoO1xuXHRcdFx0XHR4ID0geC5yaWdodDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBzZWFyY2ggaW4gb3JkZXIsIHRvIGZpbmQgdGhlIG5vZGUgY29udGFpbnMgcG9zaXRpb24uY29sdW1uXG5cdFx0eCA9IHgubmV4dCgpO1xuXHRcdHdoaWxlICh4ICE9PSBTRU5USU5FTCkge1xuXG5cdFx0XHRpZiAoeC5waWVjZS5saW5lRmVlZENudCA+IDApIHtcblx0XHRcdFx0Y29uc3QgYWNjdW11bGF0ZWRWYWx1ZSA9IHRoaXMuZ2V0QWNjdW11bGF0ZWRWYWx1ZSh4LCAwKTtcblx0XHRcdFx0Y29uc3Qgbm9kZVN0YXJ0T2Zmc2V0ID0gdGhpcy5vZmZzZXRPZk5vZGUoeCk7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bm9kZTogeCxcblx0XHRcdFx0XHRyZW1haW5kZXI6IE1hdGgubWluKGNvbHVtbiAtIDEsIGFjY3VtdWxhdGVkVmFsdWUpLFxuXHRcdFx0XHRcdG5vZGVTdGFydE9mZnNldFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHgucGllY2UubGVuZ3RoID49IGNvbHVtbiAtIDEpIHtcblx0XHRcdFx0XHRjb25zdCBub2RlU3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldE9mTm9kZSh4KTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0bm9kZTogeCxcblx0XHRcdFx0XHRcdHJlbWFpbmRlcjogY29sdW1uIC0gMSxcblx0XHRcdFx0XHRcdG5vZGVTdGFydE9mZnNldFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29sdW1uIC09IHgucGllY2UubGVuZ3RoO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHggPSB4Lm5leHQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbCE7XG5cdH1cblxuXHRwcml2YXRlIG5vZGVDaGFyQ29kZUF0KG5vZGU6IFRyZWVOb2RlLCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKG5vZGUucGllY2UubGluZUZlZWRDbnQgPCAxKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcnNbbm9kZS5waWVjZS5idWZmZXJJbmRleF07XG5cdFx0Y29uc3QgbmV3T2Zmc2V0ID0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihub2RlLnBpZWNlLmJ1ZmZlckluZGV4LCBub2RlLnBpZWNlLnN0YXJ0KSArIG9mZnNldDtcblx0XHRyZXR1cm4gYnVmZmVyLmJ1ZmZlci5jaGFyQ29kZUF0KG5ld09mZnNldCk7XG5cdH1cblxuXHRwcml2YXRlIG9mZnNldE9mTm9kZShub2RlOiBUcmVlTm9kZSk6IG51bWJlciB7XG5cdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0bGV0IHBvcyA9IG5vZGUuc2l6ZV9sZWZ0O1xuXHRcdHdoaWxlIChub2RlICE9PSB0aGlzLnJvb3QpIHtcblx0XHRcdGlmIChub2RlLnBhcmVudC5yaWdodCA9PT0gbm9kZSkge1xuXHRcdFx0XHRwb3MgKz0gbm9kZS5wYXJlbnQuc2l6ZV9sZWZ0ICsgbm9kZS5wYXJlbnQucGllY2UubGVuZ3RoO1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlID0gbm9kZS5wYXJlbnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBvcztcblx0fVxuXG5cdC8vICNlbmRyZWdpb25cblxuXHQvLyAjcmVnaW9uIENSTEZcblx0cHJpdmF0ZSBzaG91bGRDaGVja0NSTEYoKSB7XG5cdFx0cmV0dXJuICEodGhpcy5fRU9MTm9ybWFsaXplZCAmJiB0aGlzLl9FT0wgPT09ICdcXG4nKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhcnRXaXRoTEYodmFsOiBzdHJpbmcgfCBUcmVlTm9kZSk6IGJvb2xlYW4ge1xuXHRcdGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHZhbC5jaGFyQ29kZUF0KDApID09PSAxMDtcblx0XHR9XG5cblx0XHRpZiAodmFsID09PSBTRU5USU5FTCB8fCB2YWwucGllY2UubGluZUZlZWRDbnQgPT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBwaWVjZSA9IHZhbC5waWVjZTtcblx0XHRjb25zdCBsaW5lU3RhcnRzID0gdGhpcy5fYnVmZmVyc1twaWVjZS5idWZmZXJJbmRleF0ubGluZVN0YXJ0cztcblx0XHRjb25zdCBsaW5lID0gcGllY2Uuc3RhcnQubGluZTtcblx0XHRjb25zdCBzdGFydE9mZnNldCA9IGxpbmVTdGFydHNbbGluZV0gKyBwaWVjZS5zdGFydC5jb2x1bW47XG5cdFx0aWYgKGxpbmUgPT09IGxpbmVTdGFydHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0Ly8gbGFzdCBsaW5lLCBzbyB0aGVyZSBpcyBubyBsaW5lIGZlZWQgYXQgdGhlIGVuZCBvZiB0aGlzIGxpbmVcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgbmV4dExpbmVPZmZzZXQgPSBsaW5lU3RhcnRzW2xpbmUgKyAxXTtcblx0XHRpZiAobmV4dExpbmVPZmZzZXQgPiBzdGFydE9mZnNldCArIDEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2J1ZmZlcnNbcGllY2UuYnVmZmVySW5kZXhdLmJ1ZmZlci5jaGFyQ29kZUF0KHN0YXJ0T2Zmc2V0KSA9PT0gMTA7XG5cdH1cblxuXHRwcml2YXRlIGVuZFdpdGhDUih2YWw6IHN0cmluZyB8IFRyZWVOb2RlKTogYm9vbGVhbiB7XG5cdFx0aWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gdmFsLmNoYXJDb2RlQXQodmFsLmxlbmd0aCAtIDEpID09PSAxMztcblx0XHR9XG5cblx0XHRpZiAodmFsID09PSBTRU5USU5FTCB8fCB2YWwucGllY2UubGluZUZlZWRDbnQgPT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5ub2RlQ2hhckNvZGVBdCh2YWwsIHZhbC5waWVjZS5sZW5ndGggLSAxKSA9PT0gMTM7XG5cdH1cblxuXHRwcml2YXRlIHZhbGlkYXRlQ1JMRldpdGhQcmV2Tm9kZShuZXh0Tm9kZTogVHJlZU5vZGUpIHtcblx0XHRpZiAodGhpcy5zaG91bGRDaGVja0NSTEYoKSAmJiB0aGlzLnN0YXJ0V2l0aExGKG5leHROb2RlKSkge1xuXHRcdFx0Y29uc3Qgbm9kZSA9IG5leHROb2RlLnByZXYoKTtcblx0XHRcdGlmICh0aGlzLmVuZFdpdGhDUihub2RlKSkge1xuXHRcdFx0XHR0aGlzLmZpeENSTEYobm9kZSwgbmV4dE5vZGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdmFsaWRhdGVDUkxGV2l0aE5leHROb2RlKG5vZGU6IFRyZWVOb2RlKSB7XG5cdFx0aWYgKHRoaXMuc2hvdWxkQ2hlY2tDUkxGKCkgJiYgdGhpcy5lbmRXaXRoQ1Iobm9kZSkpIHtcblx0XHRcdGNvbnN0IG5leHROb2RlID0gbm9kZS5uZXh0KCk7XG5cdFx0XHRpZiAodGhpcy5zdGFydFdpdGhMRihuZXh0Tm9kZSkpIHtcblx0XHRcdFx0dGhpcy5maXhDUkxGKG5vZGUsIG5leHROb2RlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZpeENSTEYocHJldjogVHJlZU5vZGUsIG5leHQ6IFRyZWVOb2RlKSB7XG5cdFx0Y29uc3Qgbm9kZXNUb0RlbDogVHJlZU5vZGVbXSA9IFtdO1xuXHRcdC8vIHVwZGF0ZSBub2RlXG5cdFx0Y29uc3QgbGluZVN0YXJ0cyA9IHRoaXMuX2J1ZmZlcnNbcHJldi5waWVjZS5idWZmZXJJbmRleF0ubGluZVN0YXJ0cztcblx0XHRsZXQgbmV3RW5kOiBCdWZmZXJDdXJzb3I7XG5cdFx0aWYgKHByZXYucGllY2UuZW5kLmNvbHVtbiA9PT0gMCkge1xuXHRcdFx0Ly8gaXQgbWVhbnMsIGxhc3QgbGluZSBlbmRzIHdpdGggXFxyLCBub3QgXFxyXFxuXG5cdFx0XHRuZXdFbmQgPSB7IGxpbmU6IHByZXYucGllY2UuZW5kLmxpbmUgLSAxLCBjb2x1bW46IGxpbmVTdGFydHNbcHJldi5waWVjZS5lbmQubGluZV0gLSBsaW5lU3RhcnRzW3ByZXYucGllY2UuZW5kLmxpbmUgLSAxXSAtIDEgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gXFxyXFxuXG5cdFx0XHRuZXdFbmQgPSB7IGxpbmU6IHByZXYucGllY2UuZW5kLmxpbmUsIGNvbHVtbjogcHJldi5waWVjZS5lbmQuY29sdW1uIC0gMSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZOZXdMZW5ndGggPSBwcmV2LnBpZWNlLmxlbmd0aCAtIDE7XG5cdFx0Y29uc3QgcHJldk5ld0xGQ250ID0gcHJldi5waWVjZS5saW5lRmVlZENudCAtIDE7XG5cdFx0cHJldi5waWVjZSA9IG5ldyBQaWVjZShcblx0XHRcdHByZXYucGllY2UuYnVmZmVySW5kZXgsXG5cdFx0XHRwcmV2LnBpZWNlLnN0YXJ0LFxuXHRcdFx0bmV3RW5kLFxuXHRcdFx0cHJldk5ld0xGQ250LFxuXHRcdFx0cHJldk5ld0xlbmd0aFxuXHRcdCk7XG5cblx0XHR1cGRhdGVUcmVlTWV0YWRhdGEodGhpcywgcHJldiwgLSAxLCAtMSk7XG5cdFx0aWYgKHByZXYucGllY2UubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRub2Rlc1RvRGVsLnB1c2gocHJldik7XG5cdFx0fVxuXG5cdFx0Ly8gdXBkYXRlIG5leHROb2RlXG5cdFx0Y29uc3QgbmV3U3RhcnQ6IEJ1ZmZlckN1cnNvciA9IHsgbGluZTogbmV4dC5waWVjZS5zdGFydC5saW5lICsgMSwgY29sdW1uOiAwIH07XG5cdFx0Y29uc3QgbmV3TGVuZ3RoID0gbmV4dC5waWVjZS5sZW5ndGggLSAxO1xuXHRcdGNvbnN0IG5ld0xpbmVGZWVkQ250ID0gdGhpcy5nZXRMaW5lRmVlZENudChuZXh0LnBpZWNlLmJ1ZmZlckluZGV4LCBuZXdTdGFydCwgbmV4dC5waWVjZS5lbmQpO1xuXHRcdG5leHQucGllY2UgPSBuZXcgUGllY2UoXG5cdFx0XHRuZXh0LnBpZWNlLmJ1ZmZlckluZGV4LFxuXHRcdFx0bmV3U3RhcnQsXG5cdFx0XHRuZXh0LnBpZWNlLmVuZCxcblx0XHRcdG5ld0xpbmVGZWVkQ250LFxuXHRcdFx0bmV3TGVuZ3RoXG5cdFx0KTtcblxuXHRcdHVwZGF0ZVRyZWVNZXRhZGF0YSh0aGlzLCBuZXh0LCAtIDEsIC0xKTtcblx0XHRpZiAobmV4dC5waWVjZS5sZW5ndGggPT09IDApIHtcblx0XHRcdG5vZGVzVG9EZWwucHVzaChuZXh0KTtcblx0XHR9XG5cblx0XHQvLyBjcmVhdGUgbmV3IHBpZWNlIHdoaWNoIGNvbnRhaW5zIFxcclxcblxuXHRcdGNvbnN0IHBpZWNlcyA9IHRoaXMuY3JlYXRlTmV3UGllY2VzKCdcXHJcXG4nKTtcblx0XHR0aGlzLnJiSW5zZXJ0UmlnaHQocHJldiwgcGllY2VzWzBdKTtcblx0XHQvLyBkZWxldGUgZW1wdHkgbm9kZXNcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXNUb0RlbC5sZW5ndGg7IGkrKykge1xuXHRcdFx0cmJEZWxldGUodGhpcywgbm9kZXNUb0RlbFtpXSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhZGp1c3RDYXJyaWFnZVJldHVybkZyb21OZXh0KHZhbHVlOiBzdHJpbmcsIG5vZGU6IFRyZWVOb2RlKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuc2hvdWxkQ2hlY2tDUkxGKCkgJiYgdGhpcy5lbmRXaXRoQ1IodmFsdWUpKSB7XG5cdFx0XHRjb25zdCBuZXh0Tm9kZSA9IG5vZGUubmV4dCgpO1xuXHRcdFx0aWYgKHRoaXMuc3RhcnRXaXRoTEYobmV4dE5vZGUpKSB7XG5cdFx0XHRcdC8vIG1vdmUgYFxcbmAgZm9yd2FyZFxuXHRcdFx0XHR2YWx1ZSArPSAnXFxuJztcblxuXHRcdFx0XHRpZiAobmV4dE5vZGUucGllY2UubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0cmJEZWxldGUodGhpcywgbmV4dE5vZGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdFx0Y29uc3QgcGllY2UgPSBuZXh0Tm9kZS5waWVjZTtcblx0XHRcdFx0XHRjb25zdCBuZXdTdGFydDogQnVmZmVyQ3Vyc29yID0geyBsaW5lOiBwaWVjZS5zdGFydC5saW5lICsgMSwgY29sdW1uOiAwIH07XG5cdFx0XHRcdFx0Y29uc3QgbmV3TGVuZ3RoID0gcGllY2UubGVuZ3RoIC0gMTtcblx0XHRcdFx0XHRjb25zdCBuZXdMaW5lRmVlZENudCA9IHRoaXMuZ2V0TGluZUZlZWRDbnQocGllY2UuYnVmZmVySW5kZXgsIG5ld1N0YXJ0LCBwaWVjZS5lbmQpO1xuXHRcdFx0XHRcdG5leHROb2RlLnBpZWNlID0gbmV3IFBpZWNlKFxuXHRcdFx0XHRcdFx0cGllY2UuYnVmZmVySW5kZXgsXG5cdFx0XHRcdFx0XHRuZXdTdGFydCxcblx0XHRcdFx0XHRcdHBpZWNlLmVuZCxcblx0XHRcdFx0XHRcdG5ld0xpbmVGZWVkQ250LFxuXHRcdFx0XHRcdFx0bmV3TGVuZ3RoXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdHVwZGF0ZVRyZWVNZXRhZGF0YSh0aGlzLCBuZXh0Tm9kZSwgLTEsIC0xKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvLyAjZW5kcmVnaW9uXG5cblx0Ly8gI2VuZHJlZ2lvblxuXG5cdC8vICNyZWdpb24gVHJlZSBvcGVyYXRpb25zXG5cdGl0ZXJhdGUobm9kZTogVHJlZU5vZGUsIGNhbGxiYWNrOiAobm9kZTogVHJlZU5vZGUpID0+IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRpZiAobm9kZSA9PT0gU0VOVElORUwpIHtcblx0XHRcdHJldHVybiBjYWxsYmFjayhTRU5USU5FTCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGVmdFJldCA9IHRoaXMuaXRlcmF0ZShub2RlLmxlZnQsIGNhbGxiYWNrKTtcblx0XHRpZiAoIWxlZnRSZXQpIHtcblx0XHRcdHJldHVybiBsZWZ0UmV0O1xuXHRcdH1cblxuXHRcdHJldHVybiBjYWxsYmFjayhub2RlKSAmJiB0aGlzLml0ZXJhdGUobm9kZS5yaWdodCwgY2FsbGJhY2spO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXROb2RlQ29udGVudChub2RlOiBUcmVlTm9kZSkge1xuXHRcdGlmIChub2RlID09PSBTRU5USU5FTCkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9idWZmZXJzW25vZGUucGllY2UuYnVmZmVySW5kZXhdO1xuXHRcdGNvbnN0IHBpZWNlID0gbm9kZS5waWVjZTtcblx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIocGllY2UuYnVmZmVySW5kZXgsIHBpZWNlLnN0YXJ0KTtcblx0XHRjb25zdCBlbmRPZmZzZXQgPSB0aGlzLm9mZnNldEluQnVmZmVyKHBpZWNlLmJ1ZmZlckluZGV4LCBwaWVjZS5lbmQpO1xuXHRcdGNvbnN0IGN1cnJlbnRDb250ZW50ID0gYnVmZmVyLmJ1ZmZlci5zdWJzdHJpbmcoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCk7XG5cdFx0cmV0dXJuIGN1cnJlbnRDb250ZW50O1xuXHR9XG5cblx0Z2V0UGllY2VDb250ZW50KHBpZWNlOiBQaWVjZSkge1xuXHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcnNbcGllY2UuYnVmZmVySW5kZXhdO1xuXHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gdGhpcy5vZmZzZXRJbkJ1ZmZlcihwaWVjZS5idWZmZXJJbmRleCwgcGllY2Uuc3RhcnQpO1xuXHRcdGNvbnN0IGVuZE9mZnNldCA9IHRoaXMub2Zmc2V0SW5CdWZmZXIocGllY2UuYnVmZmVySW5kZXgsIHBpZWNlLmVuZCk7XG5cdFx0Y29uc3QgY3VycmVudENvbnRlbnQgPSBidWZmZXIuYnVmZmVyLnN1YnN0cmluZyhzdGFydE9mZnNldCwgZW5kT2Zmc2V0KTtcblx0XHRyZXR1cm4gY3VycmVudENvbnRlbnQ7XG5cdH1cblxuXHQvKipcblx0ICogICAgICBub2RlICAgICAgICAgICAgICBub2RlXG5cdCAqICAgICAvICBcXCAgICAgICAgICAgICAgLyAgXFxcblx0ICogICAgYSAgIGIgICAgPC0tLS0gICBhICAgIGJcblx0ICogICAgICAgICAgICAgICAgICAgICAgICAgL1xuXHQgKiAgICAgICAgICAgICAgICAgICAgICAgIHpcblx0ICovXG5cdHByaXZhdGUgcmJJbnNlcnRSaWdodChub2RlOiBUcmVlTm9kZSB8IG51bGwsIHA6IFBpZWNlKTogVHJlZU5vZGUge1xuXHRcdGNvbnN0IHogPSBuZXcgVHJlZU5vZGUocCwgTm9kZUNvbG9yLlJlZCk7XG5cdFx0ei5sZWZ0ID0gU0VOVElORUw7XG5cdFx0ei5yaWdodCA9IFNFTlRJTkVMO1xuXHRcdHoucGFyZW50ID0gU0VOVElORUw7XG5cdFx0ei5zaXplX2xlZnQgPSAwO1xuXHRcdHoubGZfbGVmdCA9IDA7XG5cblx0XHRjb25zdCB4ID0gdGhpcy5yb290O1xuXHRcdGlmICh4ID09PSBTRU5USU5FTCkge1xuXHRcdFx0dGhpcy5yb290ID0gejtcblx0XHRcdHouY29sb3IgPSBOb2RlQ29sb3IuQmxhY2s7XG5cdFx0fSBlbHNlIGlmIChub2RlIS5yaWdodCA9PT0gU0VOVElORUwpIHtcblx0XHRcdG5vZGUhLnJpZ2h0ID0gejtcblx0XHRcdHoucGFyZW50ID0gbm9kZSE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG5leHROb2RlID0gbGVmdGVzdChub2RlIS5yaWdodCk7XG5cdFx0XHRuZXh0Tm9kZS5sZWZ0ID0gejtcblx0XHRcdHoucGFyZW50ID0gbmV4dE5vZGU7XG5cdFx0fVxuXG5cdFx0Zml4SW5zZXJ0KHRoaXMsIHopO1xuXHRcdHJldHVybiB6O1xuXHR9XG5cblx0LyoqXG5cdCAqICAgICAgbm9kZSAgICAgICAgICAgICAgbm9kZVxuXHQgKiAgICAgLyAgXFwgICAgICAgICAgICAgIC8gIFxcXG5cdCAqICAgIGEgICBiICAgICAtLS0tPiAgIGEgICAgYlxuXHQgKiAgICAgICAgICAgICAgICAgICAgICAgXFxcblx0ICogICAgICAgICAgICAgICAgICAgICAgICB6XG5cdCAqL1xuXHRwcml2YXRlIHJiSW5zZXJ0TGVmdChub2RlOiBUcmVlTm9kZSB8IG51bGwsIHA6IFBpZWNlKTogVHJlZU5vZGUge1xuXHRcdGNvbnN0IHogPSBuZXcgVHJlZU5vZGUocCwgTm9kZUNvbG9yLlJlZCk7XG5cdFx0ei5sZWZ0ID0gU0VOVElORUw7XG5cdFx0ei5yaWdodCA9IFNFTlRJTkVMO1xuXHRcdHoucGFyZW50ID0gU0VOVElORUw7XG5cdFx0ei5zaXplX2xlZnQgPSAwO1xuXHRcdHoubGZfbGVmdCA9IDA7XG5cblx0XHRpZiAodGhpcy5yb290ID09PSBTRU5USU5FTCkge1xuXHRcdFx0dGhpcy5yb290ID0gejtcblx0XHRcdHouY29sb3IgPSBOb2RlQ29sb3IuQmxhY2s7XG5cdFx0fSBlbHNlIGlmIChub2RlIS5sZWZ0ID09PSBTRU5USU5FTCkge1xuXHRcdFx0bm9kZSEubGVmdCA9IHo7XG5cdFx0XHR6LnBhcmVudCA9IG5vZGUhO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBwcmV2Tm9kZSA9IHJpZ2h0dGVzdChub2RlIS5sZWZ0KTsgLy8gYVxuXHRcdFx0cHJldk5vZGUucmlnaHQgPSB6O1xuXHRcdFx0ei5wYXJlbnQgPSBwcmV2Tm9kZTtcblx0XHR9XG5cblx0XHRmaXhJbnNlcnQodGhpcywgeik7XG5cdFx0cmV0dXJuIHo7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbnRlbnRPZlN1YlRyZWUobm9kZTogVHJlZU5vZGUpOiBzdHJpbmcge1xuXHRcdGxldCBzdHIgPSAnJztcblxuXHRcdHRoaXMuaXRlcmF0ZShub2RlLCBub2RlID0+IHtcblx0XHRcdHN0ciArPSB0aGlzLmdldE5vZGVDb250ZW50KG5vZGUpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gc3RyO1xuXHR9XG5cdC8vICNlbmRyZWdpb25cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUE0QztBQUNyRCxTQUFTLFdBQVcsVUFBVSxVQUFVLFdBQVcsU0FBUyxVQUFVLFdBQVcsMEJBQTBCO0FBQzNHLFNBQVMsVUFBVSxpQkFBaUIsb0JBQW9CO0FBR3hELE1BQU0sb0JBQW9CO0FBRTFCLFNBQVMsZ0JBQWdCLEtBQTBDO0FBQ2xFLE1BQUk7QUFDSixNQUFJLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxPQUFPO0FBQ2hDLFFBQUksSUFBSSxZQUFZLElBQUksTUFBTTtBQUFBLEVBQy9CLE9BQU87QUFDTixRQUFJLElBQUksWUFBWSxJQUFJLE1BQU07QUFBQSxFQUMvQjtBQUNBLElBQUUsSUFBSSxLQUFLLENBQUM7QUFDWixTQUFPO0FBQ1I7QUFFQSxNQUFNLFdBQVc7QUFBQSxFQUNoQixZQUNpQixZQUNBLElBQ0EsSUFDQSxNQUNBLGNBQ2Y7QUFMZTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQUEsRUFDYjtBQUNMO0FBRU8sU0FBUyxxQkFBcUIsS0FBYSxXQUFvQixNQUE0QztBQUNqSCxRQUFNLElBQWMsQ0FBQyxDQUFDO0FBQ3RCLE1BQUksVUFBVTtBQUVkLFdBQVMsSUFBSSxHQUFHLE1BQU0sSUFBSSxRQUFRLElBQUksS0FBSyxLQUFLO0FBQy9DLFVBQU0sTUFBTSxJQUFJLFdBQVcsQ0FBQztBQUU1QixRQUFJLFFBQVEsU0FBUyxnQkFBZ0I7QUFDcEMsVUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLFdBQVcsSUFBSSxDQUFDLE1BQU0sU0FBUyxVQUFVO0FBRS9ELFVBQUUsU0FBUyxJQUFJLElBQUk7QUFDbkI7QUFBQSxNQUNELE9BQU87QUFFTixVQUFFLFNBQVMsSUFBSSxJQUFJO0FBQUEsTUFDcEI7QUFBQSxJQUNELFdBQVcsUUFBUSxTQUFTLFVBQVU7QUFDckMsUUFBRSxTQUFTLElBQUksSUFBSTtBQUFBLElBQ3BCO0FBQUEsRUFDRDtBQUNBLE1BQUksVUFBVTtBQUNiLFdBQU8sZ0JBQWdCLENBQUM7QUFBQSxFQUN6QixPQUFPO0FBQ04sV0FBTztBQUFBLEVBQ1I7QUFDRDtBQUVPLFNBQVMsaUJBQWlCLEdBQWEsS0FBeUI7QUFDdEUsSUFBRSxTQUFTO0FBQ1gsSUFBRSxDQUFDLElBQUk7QUFDUCxNQUFJLFVBQVU7QUFDZCxNQUFJLEtBQUssR0FBRyxLQUFLLEdBQUcsT0FBTztBQUMzQixNQUFJLGVBQWU7QUFDbkIsV0FBUyxJQUFJLEdBQUcsTUFBTSxJQUFJLFFBQVEsSUFBSSxLQUFLLEtBQUs7QUFDL0MsVUFBTSxNQUFNLElBQUksV0FBVyxDQUFDO0FBRTVCLFFBQUksUUFBUSxTQUFTLGdCQUFnQjtBQUNwQyxVQUFJLElBQUksSUFBSSxPQUFPLElBQUksV0FBVyxJQUFJLENBQUMsTUFBTSxTQUFTLFVBQVU7QUFFL0Q7QUFDQSxVQUFFLFNBQVMsSUFBSSxJQUFJO0FBQ25CO0FBQUEsTUFDRCxPQUFPO0FBQ047QUFFQSxVQUFFLFNBQVMsSUFBSSxJQUFJO0FBQUEsTUFDcEI7QUFBQSxJQUNELFdBQVcsUUFBUSxTQUFTLFVBQVU7QUFDckM7QUFDQSxRQUFFLFNBQVMsSUFBSSxJQUFJO0FBQUEsSUFDcEIsT0FBTztBQUNOLFVBQUksY0FBYztBQUNqQixZQUFJLFFBQVEsU0FBUyxRQUFRLE1BQU0sTUFBTSxNQUFNLE1BQU07QUFDcEQseUJBQWU7QUFBQSxRQUNoQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNBLFFBQU0sU0FBUyxJQUFJLFdBQVcsZ0JBQWdCLENBQUMsR0FBRyxJQUFJLElBQUksTUFBTSxZQUFZO0FBQzVFLElBQUUsU0FBUztBQUVYLFNBQU87QUFDUjtBQTRCTyxNQUFNLE1BQU07QUFBQSxFQU9sQixZQUFZLGFBQXFCLE9BQXFCLEtBQW1CLGFBQXFCLFFBQWdCO0FBQzdHLFNBQUssY0FBYztBQUNuQixTQUFLLFFBQVE7QUFDYixTQUFLLE1BQU07QUFDWCxTQUFLLGNBQWM7QUFDbkIsU0FBSyxTQUFTO0FBQUEsRUFDZjtBQUNEO0FBRU8sTUFBTSxhQUFhO0FBQUEsRUFJekIsWUFBWSxRQUFnQixZQUFrRDtBQUM3RSxTQUFLLFNBQVM7QUFDZCxTQUFLLGFBQWE7QUFBQSxFQUNuQjtBQUNEO0FBUUEsTUFBTSxrQkFBMkM7QUFBQSxFQU1oRCxZQUFZLE1BQXFCLEtBQWE7QUFDN0MsU0FBSyxVQUFVLENBQUM7QUFDaEIsU0FBSyxRQUFRO0FBQ2IsU0FBSyxPQUFPO0FBQ1osU0FBSyxTQUFTO0FBQ2QsUUFBSSxLQUFLLFNBQVMsVUFBVTtBQUMzQixXQUFLLFFBQVEsS0FBSyxNQUFNLFVBQVE7QUFDL0IsWUFBSSxTQUFTLFVBQVU7QUFDdEIsZUFBSyxRQUFRLEtBQUssS0FBSyxLQUFLO0FBQUEsUUFDN0I7QUFDQSxlQUFPO0FBQUEsTUFDUixDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE9BQXNCO0FBQ3JCLFFBQUksS0FBSyxRQUFRLFdBQVcsR0FBRztBQUM5QixVQUFJLEtBQUssV0FBVyxHQUFHO0FBQ3RCLGFBQUs7QUFDTCxlQUFPLEtBQUs7QUFBQSxNQUNiLE9BQU87QUFDTixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFFQSxRQUFJLEtBQUssU0FBUyxLQUFLLFFBQVEsU0FBUyxHQUFHO0FBQzFDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxLQUFLLFdBQVcsR0FBRztBQUN0QixhQUFPLEtBQUssT0FBTyxLQUFLLE1BQU0sZ0JBQWdCLEtBQUssUUFBUSxLQUFLLFFBQVEsQ0FBQztBQUFBLElBQzFFO0FBQ0EsV0FBTyxLQUFLLE1BQU0sZ0JBQWdCLEtBQUssUUFBUSxLQUFLLFFBQVEsQ0FBQztBQUFBLEVBQzlEO0FBQ0Q7QUFRQSxNQUFNLHFCQUFxQjtBQUFBLEVBSTFCLFlBQVksT0FBZTtBQUMxQixTQUFLLFNBQVM7QUFDZCxTQUFLLFNBQVMsQ0FBQztBQUFBLEVBQ2hCO0FBQUEsRUFFTyxJQUFJLFFBQW1DO0FBQzdDLGFBQVMsSUFBSSxLQUFLLE9BQU8sU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ2pELFlBQU0sVUFBVSxLQUFLLE9BQU8sQ0FBQztBQUM3QixVQUFJLFFBQVEsbUJBQW1CLFVBQVUsUUFBUSxrQkFBa0IsUUFBUSxLQUFLLE1BQU0sVUFBVSxRQUFRO0FBQ3ZHLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxLQUFLLFlBQXFHO0FBQ2hILGFBQVMsSUFBSSxLQUFLLE9BQU8sU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ2pELFlBQU0sVUFBVSxLQUFLLE9BQU8sQ0FBQztBQUM3QixVQUFJLFFBQVEsdUJBQXVCLFFBQVEsc0JBQXNCLGNBQWMsUUFBUSxzQkFBc0IsUUFBUSxLQUFLLE1BQU0sZUFBZSxZQUFZO0FBQzFKLGVBQWlGO0FBQUEsTUFDbEY7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLElBQUksY0FBMEI7QUFDcEMsUUFBSSxLQUFLLE9BQU8sVUFBVSxLQUFLLFFBQVE7QUFDdEMsV0FBSyxPQUFPLE1BQU07QUFBQSxJQUNuQjtBQUNBLFNBQUssT0FBTyxLQUFLLFlBQVk7QUFBQSxFQUM5QjtBQUFBLEVBRU8sU0FBUyxRQUFnQjtBQUMvQixRQUFJLGdCQUFnQjtBQUNwQixVQUFNLE1BQWdDLEtBQUs7QUFDM0MsYUFBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsS0FBSztBQUNwQyxZQUFNLFVBQVUsSUFBSSxDQUFDO0FBQ3JCLFVBQUksUUFBUSxLQUFLLFdBQVcsUUFBUSxRQUFRLG1CQUFtQixRQUFRO0FBQ3RFLFlBQUksQ0FBQyxJQUFJO0FBQ1Qsd0JBQWdCO0FBQ2hCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLGVBQWU7QUFDbEIsWUFBTSxTQUF1QixDQUFDO0FBQzlCLGlCQUFXLFNBQVMsS0FBSztBQUN4QixZQUFJLFVBQVUsTUFBTTtBQUNuQixpQkFBTyxLQUFLLEtBQUs7QUFBQSxRQUNsQjtBQUFBLE1BQ0Q7QUFFQSxXQUFLLFNBQVM7QUFBQSxJQUNmO0FBQUEsRUFDRDtBQUNEO0FBRU8sTUFBTSxjQUFjO0FBQUEsRUFZMUIsWUFBWSxRQUF3QixLQUFvQixlQUF3QjtBQUMvRSxTQUFLLE9BQU8sUUFBUSxLQUFLLGFBQWE7QUFBQSxFQUN2QztBQUFBLEVBRUEsT0FBTyxRQUF3QixLQUFvQixlQUF3QjtBQUMxRSxTQUFLLFdBQVc7QUFBQSxNQUNmLElBQUksYUFBYSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDekI7QUFDQSxTQUFLLHVCQUF1QixFQUFFLE1BQU0sR0FBRyxRQUFRLEVBQUU7QUFDakQsU0FBSyxPQUFPO0FBQ1osU0FBSyxXQUFXO0FBQ2hCLFNBQUssVUFBVTtBQUNmLFNBQUssT0FBTztBQUNaLFNBQUssYUFBYSxJQUFJO0FBQ3RCLFNBQUssaUJBQWlCO0FBRXRCLFFBQUksV0FBNEI7QUFDaEMsYUFBUyxJQUFJLEdBQUcsTUFBTSxPQUFPLFFBQVEsSUFBSSxLQUFLLEtBQUs7QUFDbEQsVUFBSSxPQUFPLENBQUMsRUFBRSxPQUFPLFNBQVMsR0FBRztBQUNoQyxZQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsWUFBWTtBQUMxQixpQkFBTyxDQUFDLEVBQUUsYUFBYSxxQkFBcUIsT0FBTyxDQUFDLEVBQUUsTUFBTTtBQUFBLFFBQzdEO0FBRUEsY0FBTSxRQUFRLElBQUk7QUFBQSxVQUNqQixJQUFJO0FBQUEsVUFDSixFQUFFLE1BQU0sR0FBRyxRQUFRLEVBQUU7QUFBQSxVQUNyQixFQUFFLE1BQU0sT0FBTyxDQUFDLEVBQUUsV0FBVyxTQUFTLEdBQUcsUUFBUSxPQUFPLENBQUMsRUFBRSxPQUFPLFNBQVMsT0FBTyxDQUFDLEVBQUUsV0FBVyxPQUFPLENBQUMsRUFBRSxXQUFXLFNBQVMsQ0FBQyxFQUFFO0FBQUEsVUFDakksT0FBTyxDQUFDLEVBQUUsV0FBVyxTQUFTO0FBQUEsVUFDOUIsT0FBTyxDQUFDLEVBQUUsT0FBTztBQUFBLFFBQ2xCO0FBQ0EsYUFBSyxTQUFTLEtBQUssT0FBTyxDQUFDLENBQUM7QUFDNUIsbUJBQVcsS0FBSyxjQUFjLFVBQVUsS0FBSztBQUFBLE1BQzlDO0FBQUEsSUFDRDtBQUVBLFNBQUssZUFBZSxJQUFJLHFCQUFxQixDQUFDO0FBQzlDLFNBQUssbUJBQW1CLEVBQUUsWUFBWSxHQUFHLE9BQU8sR0FBRztBQUNuRCxTQUFLLHNCQUFzQjtBQUFBLEVBQzVCO0FBQUEsRUFFQSxhQUFhLEtBQW9CO0FBQ2hDLFVBQU0sb0JBQW9CO0FBQzFCLFVBQU0sTUFBTSxvQkFBb0IsS0FBSyxNQUFNLG9CQUFvQixDQUFDO0FBQ2hFLFVBQU0sTUFBTSxNQUFNO0FBRWxCLFFBQUksWUFBWTtBQUNoQixRQUFJLGVBQWU7QUFDbkIsVUFBTSxTQUF5QixDQUFDO0FBRWhDLFNBQUssUUFBUSxLQUFLLE1BQU0sVUFBUTtBQUMvQixZQUFNLE1BQU0sS0FBSyxlQUFlLElBQUk7QUFDcEMsWUFBTSxNQUFNLElBQUk7QUFDaEIsVUFBSSxnQkFBZ0IsT0FBTyxlQUFlLE1BQU0sS0FBSztBQUNwRCxxQkFBYTtBQUNiLHdCQUFnQjtBQUNoQixlQUFPO0FBQUEsTUFDUjtBQUdBLFlBQU0sT0FBTyxVQUFVLFFBQVEsZUFBZSxHQUFHO0FBQ2pELGFBQU8sS0FBSyxJQUFJLGFBQWEsTUFBTSxxQkFBcUIsSUFBSSxDQUFDLENBQUM7QUFDOUQsa0JBQVk7QUFDWixxQkFBZTtBQUNmLGFBQU87QUFBQSxJQUNSLENBQUM7QUFFRCxRQUFJLGVBQWUsR0FBRztBQUNyQixZQUFNLE9BQU8sVUFBVSxRQUFRLGVBQWUsR0FBRztBQUNqRCxhQUFPLEtBQUssSUFBSSxhQUFhLE1BQU0scUJBQXFCLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDL0Q7QUFFQSxTQUFLLE9BQU8sUUFBUSxLQUFLLElBQUk7QUFBQSxFQUM5QjtBQUFBO0FBQUEsRUFHTyxTQUF3QjtBQUM5QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTyxPQUFPLFFBQTZCO0FBQzFDLFNBQUssT0FBTztBQUNaLFNBQUssYUFBYSxLQUFLLEtBQUs7QUFDNUIsU0FBSyxhQUFhLE1BQU07QUFBQSxFQUN6QjtBQUFBLEVBRU8sZUFBZSxLQUE0QjtBQUNqRCxXQUFPLElBQUksa0JBQWtCLE1BQU0sR0FBRztBQUFBLEVBQ3ZDO0FBQUEsRUFFTyxNQUFNLE9BQStCO0FBQzNDLFFBQUksS0FBSyxVQUFVLE1BQU0sTUFBTSxVQUFVLEdBQUc7QUFDM0MsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLEtBQUssYUFBYSxNQUFNLE1BQU0sYUFBYSxHQUFHO0FBQ2pELGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxTQUFTO0FBQ2IsVUFBTSxNQUFNLEtBQUssUUFBUSxLQUFLLE1BQU0sVUFBUTtBQUMzQyxVQUFJLFNBQVMsVUFBVTtBQUN0QixlQUFPO0FBQUEsTUFDUjtBQUNBLFlBQU0sTUFBTSxLQUFLLGVBQWUsSUFBSTtBQUNwQyxZQUFNLE1BQU0sSUFBSTtBQUNoQixZQUFNLGdCQUFnQixNQUFNLE9BQU8sTUFBTTtBQUN6QyxZQUFNLGNBQWMsTUFBTSxPQUFPLFNBQVMsR0FBRztBQUM3QyxZQUFNLE1BQU0sTUFBTSxpQkFBaUIsZUFBZSxXQUFXO0FBRTdELGdCQUFVO0FBQ1YsYUFBTyxRQUFRO0FBQUEsSUFDaEIsQ0FBQztBQUVELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxZQUFZLFlBQW9CLFFBQXdCO0FBQzlELFFBQUksVUFBVTtBQUVkLFFBQUksSUFBSSxLQUFLO0FBRWIsV0FBTyxNQUFNLFVBQVU7QUFDdEIsVUFBSSxFQUFFLFNBQVMsWUFBWSxFQUFFLFVBQVUsS0FBSyxZQUFZO0FBQ3ZELFlBQUksRUFBRTtBQUFBLE1BQ1AsV0FBVyxFQUFFLFVBQVUsRUFBRSxNQUFNLGNBQWMsS0FBSyxZQUFZO0FBQzdELG1CQUFXLEVBQUU7QUFFYixjQUFNLCtCQUErQixLQUFLLG9CQUFvQixHQUFHLGFBQWEsRUFBRSxVQUFVLENBQUM7QUFDM0YsZUFBTyxXQUFXLCtCQUErQixTQUFTO0FBQUEsTUFDM0QsT0FBTztBQUNOLHNCQUFjLEVBQUUsVUFBVSxFQUFFLE1BQU07QUFDbEMsbUJBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTTtBQUNqQyxZQUFJLEVBQUU7QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxjQUFjLFFBQTBCO0FBQzlDLGFBQVMsS0FBSyxNQUFNLE1BQU07QUFDMUIsYUFBUyxLQUFLLElBQUksR0FBRyxNQUFNO0FBRTNCLFFBQUksSUFBSSxLQUFLO0FBQ2IsUUFBSSxRQUFRO0FBQ1osVUFBTSxpQkFBaUI7QUFFdkIsV0FBTyxNQUFNLFVBQVU7QUFDdEIsVUFBSSxFQUFFLGNBQWMsS0FBSyxFQUFFLGFBQWEsUUFBUTtBQUMvQyxZQUFJLEVBQUU7QUFBQSxNQUNQLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSxVQUFVLFFBQVE7QUFDbEQsY0FBTSxNQUFNLEtBQUssV0FBVyxHQUFHLFNBQVMsRUFBRSxTQUFTO0FBRW5ELGlCQUFTLEVBQUUsVUFBVSxJQUFJO0FBRXpCLFlBQUksSUFBSSxVQUFVLEdBQUc7QUFDcEIsZ0JBQU0sa0JBQWtCLEtBQUssWUFBWSxRQUFRLEdBQUcsQ0FBQztBQUNyRCxnQkFBTSxTQUFTLGlCQUFpQjtBQUNoQyxpQkFBTyxJQUFJLFNBQVMsUUFBUSxHQUFHLFNBQVMsQ0FBQztBQUFBLFFBQzFDO0FBRUEsZUFBTyxJQUFJLFNBQVMsUUFBUSxHQUFHLElBQUksWUFBWSxDQUFDO0FBQUEsTUFDakQsT0FBTztBQUNOLGtCQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU07QUFDaEMsaUJBQVMsRUFBRSxVQUFVLEVBQUUsTUFBTTtBQUU3QixZQUFJLEVBQUUsVUFBVSxVQUFVO0FBRXpCLGdCQUFNLGtCQUFrQixLQUFLLFlBQVksUUFBUSxHQUFHLENBQUM7QUFDckQsZ0JBQU0sU0FBUyxpQkFBaUIsU0FBUztBQUN6QyxpQkFBTyxJQUFJLFNBQVMsUUFBUSxHQUFHLFNBQVMsQ0FBQztBQUFBLFFBQzFDLE9BQU87QUFDTixjQUFJLEVBQUU7QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxXQUFPLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxFQUN6QjtBQUFBLEVBRU8sZ0JBQWdCLE9BQWMsS0FBc0I7QUFDMUQsUUFBSSxNQUFNLG9CQUFvQixNQUFNLGlCQUFpQixNQUFNLGdCQUFnQixNQUFNLFdBQVc7QUFDM0YsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGdCQUFnQixLQUFLLFFBQVEsTUFBTSxpQkFBaUIsTUFBTSxXQUFXO0FBQzNFLFVBQU0sY0FBYyxLQUFLLFFBQVEsTUFBTSxlQUFlLE1BQU0sU0FBUztBQUVyRSxVQUFNLFFBQVEsS0FBSyxpQkFBaUIsZUFBZSxXQUFXO0FBQzlELFFBQUksS0FBSztBQUNSLFVBQUksUUFBUSxLQUFLLFFBQVEsQ0FBQyxLQUFLLGdCQUFnQjtBQUM5QyxlQUFPLE1BQU0sUUFBUSxlQUFlLEdBQUc7QUFBQSxNQUN4QztBQUVBLFVBQUksUUFBUSxLQUFLLE9BQU8sS0FBSyxLQUFLLGdCQUFnQjtBQUNqRCxZQUFJLFFBQVEsUUFBUTtBQUFBLFFBRXBCO0FBQ0EsZUFBTztBQUFBLE1BQ1I7QUFDQSxhQUFPLE1BQU0sUUFBUSxlQUFlLEdBQUc7QUFBQSxJQUN4QztBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxpQkFBaUIsZUFBNkIsYUFBbUM7QUFDdkYsUUFBSSxjQUFjLFNBQVMsWUFBWSxNQUFNO0FBQzVDLFlBQU0sT0FBTyxjQUFjO0FBQzNCLFlBQU1BLFVBQVMsS0FBSyxTQUFTLEtBQUssTUFBTSxXQUFXLEVBQUU7QUFDckQsWUFBTUMsZUFBYyxLQUFLLGVBQWUsS0FBSyxNQUFNLGFBQWEsS0FBSyxNQUFNLEtBQUs7QUFDaEYsYUFBT0QsUUFBTyxVQUFVQyxlQUFjLGNBQWMsV0FBV0EsZUFBYyxZQUFZLFNBQVM7QUFBQSxJQUNuRztBQUVBLFFBQUksSUFBSSxjQUFjO0FBQ3RCLFVBQU0sU0FBUyxLQUFLLFNBQVMsRUFBRSxNQUFNLFdBQVcsRUFBRTtBQUNsRCxVQUFNLGNBQWMsS0FBSyxlQUFlLEVBQUUsTUFBTSxhQUFhLEVBQUUsTUFBTSxLQUFLO0FBQzFFLFFBQUksTUFBTSxPQUFPLFVBQVUsY0FBYyxjQUFjLFdBQVcsY0FBYyxFQUFFLE1BQU0sTUFBTTtBQUU5RixRQUFJLEVBQUUsS0FBSztBQUNYLFdBQU8sTUFBTSxVQUFVO0FBQ3RCLFlBQU1ELFVBQVMsS0FBSyxTQUFTLEVBQUUsTUFBTSxXQUFXLEVBQUU7QUFDbEQsWUFBTUMsZUFBYyxLQUFLLGVBQWUsRUFBRSxNQUFNLGFBQWEsRUFBRSxNQUFNLEtBQUs7QUFFMUUsVUFBSSxNQUFNLFlBQVksTUFBTTtBQUMzQixlQUFPRCxRQUFPLFVBQVVDLGNBQWFBLGVBQWMsWUFBWSxTQUFTO0FBQ3hFO0FBQUEsTUFDRCxPQUFPO0FBQ04sZUFBT0QsUUFBTyxPQUFPQyxjQUFhLEVBQUUsTUFBTSxNQUFNO0FBQUEsTUFDakQ7QUFFQSxVQUFJLEVBQUUsS0FBSztBQUFBLElBQ1o7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sa0JBQTRCO0FBQ2xDLFVBQU0sUUFBa0IsQ0FBQztBQUN6QixRQUFJLGNBQWM7QUFDbEIsUUFBSSxjQUFjO0FBQ2xCLFFBQUksYUFBYTtBQUVqQixTQUFLLFFBQVEsS0FBSyxNQUFNLFVBQVE7QUFDL0IsVUFBSSxTQUFTLFVBQVU7QUFDdEIsZUFBTztBQUFBLE1BQ1I7QUFFQSxZQUFNLFFBQVEsS0FBSztBQUNuQixVQUFJLGNBQWMsTUFBTTtBQUN4QixVQUFJLGdCQUFnQixHQUFHO0FBQ3RCLGVBQU87QUFBQSxNQUNSO0FBRUEsWUFBTSxTQUFTLEtBQUssU0FBUyxNQUFNLFdBQVcsRUFBRTtBQUNoRCxZQUFNLGFBQWEsS0FBSyxTQUFTLE1BQU0sV0FBVyxFQUFFO0FBRXBELFlBQU0saUJBQWlCLE1BQU0sTUFBTTtBQUNuQyxZQUFNLGVBQWUsTUFBTSxJQUFJO0FBQy9CLFVBQUksbUJBQW1CLFdBQVcsY0FBYyxJQUFJLE1BQU0sTUFBTTtBQUVoRSxVQUFJLFlBQVk7QUFDZixZQUFJLE9BQU8sV0FBVyxnQkFBZ0IsTUFBTSxTQUFTLFVBQVU7QUFFOUQ7QUFDQTtBQUFBLFFBQ0Q7QUFDQSxjQUFNLGFBQWEsSUFBSTtBQUN2QixzQkFBYztBQUNkLHFCQUFhO0FBQ2IsWUFBSSxnQkFBZ0IsR0FBRztBQUN0QixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBRUEsVUFBSSxtQkFBbUIsY0FBYztBQUVwQyxZQUFJLENBQUMsS0FBSyxrQkFBa0IsT0FBTyxXQUFXLG1CQUFtQixjQUFjLENBQUMsTUFBTSxTQUFTLGdCQUFnQjtBQUM5Ryx1QkFBYTtBQUNiLHlCQUFlLE9BQU8sT0FBTyxrQkFBa0IsY0FBYyxDQUFDO0FBQUEsUUFDL0QsT0FBTztBQUNOLHlCQUFlLE9BQU8sT0FBTyxrQkFBa0IsV0FBVztBQUFBLFFBQzNEO0FBQ0EsZUFBTztBQUFBLE1BQ1I7QUFHQSxxQkFDQyxLQUFLLGlCQUNGLE9BQU8sVUFBVSxrQkFBa0IsS0FBSyxJQUFJLGtCQUFrQixXQUFXLGlCQUFpQixDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsSUFDL0csT0FBTyxVQUFVLGtCQUFrQixXQUFXLGlCQUFpQixDQUFDLENBQUMsRUFBRSxRQUFRLGlCQUFpQixFQUFFO0FBRWxHLFlBQU0sYUFBYSxJQUFJO0FBRXZCLGVBQVMsT0FBTyxpQkFBaUIsR0FBRyxPQUFPLGNBQWMsUUFBUTtBQUNoRSxzQkFDQyxLQUFLLGlCQUNGLE9BQU8sVUFBVSxXQUFXLElBQUksR0FBRyxXQUFXLE9BQU8sQ0FBQyxJQUFJLEtBQUssVUFBVSxJQUN6RSxPQUFPLFVBQVUsV0FBVyxJQUFJLEdBQUcsV0FBVyxPQUFPLENBQUMsQ0FBQyxFQUFFLFFBQVEsaUJBQWlCLEVBQUU7QUFFeEYsY0FBTSxhQUFhLElBQUk7QUFBQSxNQUN4QjtBQUVBLFVBQUksQ0FBQyxLQUFLLGtCQUFrQixPQUFPLFdBQVcsV0FBVyxZQUFZLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxNQUFNLFNBQVMsZ0JBQWdCO0FBQzNILHFCQUFhO0FBQ2IsWUFBSSxNQUFNLElBQUksV0FBVyxHQUFHO0FBRTNCO0FBQUEsUUFDRCxPQUFPO0FBQ04sd0JBQWMsT0FBTyxPQUFPLFdBQVcsWUFBWSxHQUFHLE1BQU0sSUFBSSxTQUFTLENBQUM7QUFBQSxRQUMzRTtBQUFBLE1BQ0QsT0FBTztBQUNOLHNCQUFjLE9BQU8sT0FBTyxXQUFXLFlBQVksR0FBRyxNQUFNLElBQUksTUFBTTtBQUFBLE1BQ3ZFO0FBRUEsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUVELFFBQUksWUFBWTtBQUNmLFlBQU0sYUFBYSxJQUFJO0FBQ3ZCLG9CQUFjO0FBQUEsSUFDZjtBQUVBLFVBQU0sYUFBYSxJQUFJO0FBQ3ZCLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxZQUFvQjtBQUMxQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTyxlQUF1QjtBQUM3QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTyxlQUFlLFlBQTRCO0FBQ2pELFFBQUksS0FBSyxpQkFBaUIsZUFBZSxZQUFZO0FBQ3BELGFBQU8sS0FBSyxpQkFBaUI7QUFBQSxJQUM5QjtBQUVBLFNBQUssaUJBQWlCLGFBQWE7QUFFbkMsUUFBSSxlQUFlLEtBQUssVUFBVTtBQUNqQyxXQUFLLGlCQUFpQixRQUFRLEtBQUssa0JBQWtCLFVBQVU7QUFBQSxJQUNoRSxXQUFXLEtBQUssZ0JBQWdCO0FBQy9CLFdBQUssaUJBQWlCLFFBQVEsS0FBSyxrQkFBa0IsWUFBWSxLQUFLLFVBQVU7QUFBQSxJQUNqRixPQUFPO0FBQ04sV0FBSyxpQkFBaUIsUUFBUSxLQUFLLGtCQUFrQixVQUFVLEVBQUUsUUFBUSxpQkFBaUIsRUFBRTtBQUFBLElBQzdGO0FBRUEsV0FBTyxLQUFLLGlCQUFpQjtBQUFBLEVBQzlCO0FBQUEsRUFFUSxhQUFhLFNBQStCO0FBQ25ELFFBQUksUUFBUSxjQUFjLFFBQVEsS0FBSyxNQUFNLFFBQVE7QUFFcEQsWUFBTSxlQUFlLFFBQVEsS0FBSyxLQUFLO0FBQ3ZDLFVBQUksQ0FBQyxjQUFjO0FBQ2xCLGVBQU87QUFBQSxNQUNSO0FBRUEsWUFBTSxTQUFTLEtBQUssU0FBUyxhQUFhLE1BQU0sV0FBVztBQUMzRCxZQUFNLGNBQWMsS0FBSyxlQUFlLGFBQWEsTUFBTSxhQUFhLGFBQWEsTUFBTSxLQUFLO0FBQ2hHLGFBQU8sT0FBTyxPQUFPLFdBQVcsV0FBVztBQUFBLElBQzVDLE9BQU87QUFDTixZQUFNLFNBQVMsS0FBSyxTQUFTLFFBQVEsS0FBSyxNQUFNLFdBQVc7QUFDM0QsWUFBTSxjQUFjLEtBQUssZUFBZSxRQUFRLEtBQUssTUFBTSxhQUFhLFFBQVEsS0FBSyxNQUFNLEtBQUs7QUFDaEcsWUFBTSxlQUFlLGNBQWMsUUFBUTtBQUUzQyxhQUFPLE9BQU8sT0FBTyxXQUFXLFlBQVk7QUFBQSxJQUM3QztBQUFBLEVBQ0Q7QUFBQSxFQUVPLGdCQUFnQixZQUFvQixPQUF1QjtBQUNqRSxVQUFNLFVBQVUsS0FBSyxRQUFRLFlBQVksUUFBUSxDQUFDO0FBQ2xELFdBQU8sS0FBSyxhQUFhLE9BQU87QUFBQSxFQUNqQztBQUFBLEVBRU8sY0FBYyxZQUE0QjtBQUNoRCxRQUFJLGVBQWUsS0FBSyxhQUFhLEdBQUc7QUFDdkMsWUFBTSxjQUFjLEtBQUssWUFBWSxZQUFZLENBQUM7QUFDbEQsYUFBTyxLQUFLLFVBQVUsSUFBSTtBQUFBLElBQzNCO0FBQ0EsV0FBTyxLQUFLLFlBQVksYUFBYSxHQUFHLENBQUMsSUFBSSxLQUFLLFlBQVksWUFBWSxDQUFDLElBQUksS0FBSztBQUFBLEVBQ3JGO0FBQUEsRUFFTyxZQUFZLFFBQXdCO0FBQzFDLFVBQU0sVUFBVSxLQUFLLE9BQU8sTUFBTTtBQUNsQyxXQUFPLEtBQUssYUFBYSxPQUFPO0FBQUEsRUFDakM7QUFBQSxFQUVPLGdCQUFnQixRQUF3QjtBQUM5QyxVQUFNLFVBQVUsS0FBSyxPQUFPLE1BQU07QUFDbEMsUUFBSSxRQUFRLGNBQWMsUUFBUSxLQUFLLE1BQU0sUUFBUTtBQUVwRCxZQUFNLGVBQWUsUUFBUSxLQUFLLEtBQUs7QUFDdkMsVUFBSSxDQUFDLGdCQUFnQixpQkFBaUIsVUFBVTtBQUMvQyxlQUFPO0FBQUEsTUFDUjtBQUVBLFlBQU0sU0FBUyxLQUFLLFNBQVMsYUFBYSxNQUFNLFdBQVc7QUFDM0QsWUFBTSxjQUFjLEtBQUssZUFBZSxhQUFhLE1BQU0sYUFBYSxhQUFhLE1BQU0sS0FBSztBQUNoRyxhQUFPLE9BQU8sT0FBTyxVQUFVLGFBQWEsY0FBYyxhQUFhLE1BQU0sTUFBTTtBQUFBLElBQ3BGLE9BQU87QUFDTixZQUFNLFNBQVMsS0FBSyxTQUFTLFFBQVEsS0FBSyxNQUFNLFdBQVc7QUFDM0QsWUFBTSxjQUFjLEtBQUssZUFBZSxRQUFRLEtBQUssTUFBTSxhQUFhLFFBQVEsS0FBSyxNQUFNLEtBQUs7QUFDaEcsWUFBTSxlQUFlLGNBQWMsUUFBUTtBQUMzQyxZQUFNLFlBQVksY0FBYyxRQUFRLEtBQUssTUFBTTtBQUNuRCxhQUFPLE9BQU8sT0FBTyxVQUFVLGNBQWMsU0FBUztBQUFBLElBQ3ZEO0FBQUEsRUFDRDtBQUFBLEVBRU8sa0JBQWtCLE1BQWdCLFVBQW9CLGlCQUF5QixhQUFxQixhQUEyQixXQUF5QixZQUF3QixnQkFBeUIsa0JBQTBCLFdBQW1CLFFBQXFCO0FBQ2pSLFVBQU0sU0FBUyxLQUFLLFNBQVMsS0FBSyxNQUFNLFdBQVc7QUFDbkQsVUFBTSxzQkFBc0IsS0FBSyxlQUFlLEtBQUssTUFBTSxhQUFhLEtBQUssTUFBTSxLQUFLO0FBQ3hGLFVBQU0sUUFBUSxLQUFLLGVBQWUsS0FBSyxNQUFNLGFBQWEsV0FBVztBQUNyRSxVQUFNLE1BQU0sS0FBSyxlQUFlLEtBQUssTUFBTSxhQUFhLFNBQVM7QUFFakUsUUFBSTtBQUVKLFVBQU0sTUFBb0IsRUFBRSxNQUFNLEdBQUcsUUFBUSxFQUFFO0FBQy9DLFFBQUk7QUFDSixRQUFJO0FBRUosUUFBSSxTQUFTLGlCQUFpQjtBQUM3QixtQkFBYSxPQUFPLE9BQU8sVUFBVSxPQUFPLEdBQUc7QUFDL0MsdUJBQWlCLENBQUMsV0FBbUIsU0FBUztBQUM5QyxlQUFTLE1BQU0sQ0FBQztBQUFBLElBQ2pCLE9BQU87QUFDTixtQkFBYSxPQUFPO0FBQ3BCLHVCQUFpQixDQUFDLFdBQW1CO0FBQ3JDLGVBQVMsTUFBTSxLQUFLO0FBQUEsSUFDckI7QUFFQSxPQUFHO0FBQ0YsVUFBSSxTQUFTLEtBQUssVUFBVTtBQUU1QixVQUFJLEdBQUc7QUFDTixZQUFJLGVBQWUsRUFBRSxLQUFLLEtBQUssS0FBSztBQUNuQyxpQkFBTztBQUFBLFFBQ1I7QUFDQSxhQUFLLGlCQUFpQixNQUFNLGVBQWUsRUFBRSxLQUFLLElBQUkscUJBQXFCLEdBQUc7QUFDOUUsY0FBTSxjQUFjLEtBQUssZUFBZSxLQUFLLE1BQU0sYUFBYSxhQUFhLEdBQUc7QUFDaEYsY0FBTSxpQkFBaUIsSUFBSSxTQUFTLFlBQVksT0FBTyxJQUFJLFNBQVMsWUFBWSxTQUFTLGNBQWMsSUFBSSxTQUFTO0FBQ3BILGNBQU0sZUFBZSxpQkFBaUIsRUFBRSxDQUFDLEVBQUU7QUFDM0MsZUFBTyxXQUFXLElBQUksZ0JBQWdCLElBQUksTUFBTSxrQkFBa0IsYUFBYSxnQkFBZ0Isa0JBQWtCLGFBQWEsWUFBWSxHQUFHLEdBQUcsY0FBYztBQUU5SixZQUFJLGVBQWUsRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLEVBQUUsVUFBVSxLQUFLO0FBQ2pELGlCQUFPO0FBQUEsUUFDUjtBQUNBLFlBQUksYUFBYSxrQkFBa0I7QUFDbEMsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBRUQsU0FBUztBQUVULFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxzQkFBc0IsYUFBb0IsWUFBd0IsZ0JBQXlCLGtCQUF1QztBQUN4SSxVQUFNLFNBQXNCLENBQUM7QUFDN0IsUUFBSSxZQUFZO0FBQ2hCLFVBQU0sV0FBVyxJQUFJLFNBQVMsV0FBVyxnQkFBZ0IsV0FBVyxLQUFLO0FBRXpFLFFBQUksZ0JBQWdCLEtBQUssUUFBUSxZQUFZLGlCQUFpQixZQUFZLFdBQVc7QUFDckYsUUFBSSxrQkFBa0IsTUFBTTtBQUMzQixhQUFPLENBQUM7QUFBQSxJQUNUO0FBQ0EsVUFBTSxjQUFjLEtBQUssUUFBUSxZQUFZLGVBQWUsWUFBWSxTQUFTO0FBQ2pGLFFBQUksZ0JBQWdCLE1BQU07QUFDekIsYUFBTyxDQUFDO0FBQUEsSUFDVDtBQUNBLFFBQUksUUFBUSxLQUFLLGlCQUFpQixjQUFjLE1BQU0sY0FBYyxTQUFTO0FBQzdFLFVBQU0sTUFBTSxLQUFLLGlCQUFpQixZQUFZLE1BQU0sWUFBWSxTQUFTO0FBRXpFLFFBQUksY0FBYyxTQUFTLFlBQVksTUFBTTtBQUM1QyxXQUFLLGtCQUFrQixjQUFjLE1BQU0sVUFBVSxZQUFZLGlCQUFpQixZQUFZLGFBQWEsT0FBTyxLQUFLLFlBQVksZ0JBQWdCLGtCQUFrQixXQUFXLE1BQU07QUFDdEwsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLGtCQUFrQixZQUFZO0FBRWxDLFFBQUksY0FBYyxjQUFjO0FBQ2hDLFdBQU8sZ0JBQWdCLFlBQVksTUFBTTtBQUN4QyxZQUFNLGVBQWUsS0FBSyxlQUFlLFlBQVksTUFBTSxhQUFhLE9BQU8sWUFBWSxNQUFNLEdBQUc7QUFFcEcsVUFBSSxnQkFBZ0IsR0FBRztBQUV0QixjQUFNLGFBQWEsS0FBSyxTQUFTLFlBQVksTUFBTSxXQUFXLEVBQUU7QUFDaEUsY0FBTSxzQkFBc0IsS0FBSyxlQUFlLFlBQVksTUFBTSxhQUFhLFlBQVksTUFBTSxLQUFLO0FBQ3RHLGNBQU0sc0JBQXNCLFdBQVcsTUFBTSxPQUFPLFlBQVk7QUFDaEUsY0FBTUMsZUFBYyxvQkFBb0IsWUFBWSxrQkFBa0IsWUFBWSxjQUFjO0FBQ2hHLG9CQUFZLEtBQUssa0JBQWtCLGFBQWEsVUFBVSxpQkFBaUJBLGNBQWEsT0FBTyxLQUFLLGlCQUFpQixhQUFhLHNCQUFzQixtQkFBbUIsR0FBRyxZQUFZLGdCQUFnQixrQkFBa0IsV0FBVyxNQUFNO0FBRTdPLFlBQUksYUFBYSxrQkFBa0I7QUFDbEMsaUJBQU87QUFBQSxRQUNSO0FBRUEsMkJBQW1CO0FBQUEsTUFDcEI7QUFFQSxZQUFNQSxlQUFjLG9CQUFvQixZQUFZLGtCQUFrQixZQUFZLGNBQWMsSUFBSTtBQUVwRyxVQUFJLG9CQUFvQixZQUFZLGVBQWU7QUFDbEQsY0FBTSxPQUFPLEtBQUssZUFBZSxlQUFlLEVBQUUsVUFBVUEsY0FBYSxZQUFZLFlBQVksQ0FBQztBQUNsRyxvQkFBWSxLQUFLLG1CQUFtQixZQUFZLFVBQVUsTUFBTSxZQUFZLGVBQWVBLGNBQWEsV0FBVyxRQUFRLGdCQUFnQixnQkFBZ0I7QUFDM0osZUFBTztBQUFBLE1BQ1I7QUFFQSxrQkFBWSxLQUFLLG1CQUFtQixZQUFZLFVBQVUsS0FBSyxlQUFlLGVBQWUsRUFBRSxPQUFPQSxZQUFXLEdBQUcsaUJBQWlCQSxjQUFhLFdBQVcsUUFBUSxnQkFBZ0IsZ0JBQWdCO0FBRXJNLFVBQUksYUFBYSxrQkFBa0I7QUFDbEMsZUFBTztBQUFBLE1BQ1I7QUFFQTtBQUNBLHNCQUFnQixLQUFLLFFBQVEsaUJBQWlCLENBQUM7QUFDL0Msb0JBQWMsY0FBYztBQUM1QixjQUFRLEtBQUssaUJBQWlCLGNBQWMsTUFBTSxjQUFjLFNBQVM7QUFBQSxJQUMxRTtBQUVBLFFBQUksb0JBQW9CLFlBQVksZUFBZTtBQUNsRCxZQUFNQSxlQUFjLG9CQUFvQixZQUFZLGtCQUFrQixZQUFZLGNBQWMsSUFBSTtBQUNwRyxZQUFNLE9BQU8sS0FBSyxlQUFlLGVBQWUsRUFBRSxVQUFVQSxjQUFhLFlBQVksWUFBWSxDQUFDO0FBQ2xHLGtCQUFZLEtBQUssbUJBQW1CLFlBQVksVUFBVSxNQUFNLFlBQVksZUFBZUEsY0FBYSxXQUFXLFFBQVEsZ0JBQWdCLGdCQUFnQjtBQUMzSixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sY0FBYyxvQkFBb0IsWUFBWSxrQkFBa0IsWUFBWSxjQUFjO0FBQ2hHLGdCQUFZLEtBQUssa0JBQWtCLFlBQVksTUFBTSxVQUFVLGlCQUFpQixhQUFhLE9BQU8sS0FBSyxZQUFZLGdCQUFnQixrQkFBa0IsV0FBVyxNQUFNO0FBQ3hLLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxtQkFBbUIsWUFBd0IsVUFBb0IsTUFBYyxZQUFvQixhQUFxQixXQUFtQixRQUFxQixnQkFBeUIsa0JBQWtDO0FBQ2hPLFVBQU0saUJBQWlCLFdBQVc7QUFDbEMsUUFBSSxDQUFDLGtCQUFrQixXQUFXLGNBQWM7QUFDL0MsWUFBTSxlQUFlLFdBQVc7QUFDaEMsWUFBTSxrQkFBa0IsYUFBYTtBQUNyQyxZQUFNLGFBQWEsS0FBSztBQUV4QixVQUFJLGlCQUFpQixDQUFDO0FBQ3RCLGNBQVEsaUJBQWlCLEtBQUssUUFBUSxjQUFjLGlCQUFpQixlQUFlLE9BQU8sSUFBSTtBQUM5RixZQUFJLENBQUMsa0JBQWtCLGFBQWEsZ0JBQWdCLE1BQU0sWUFBWSxnQkFBZ0IsZUFBZSxHQUFHO0FBQ3ZHLGlCQUFPLFdBQVcsSUFBSSxJQUFJLFVBQVUsSUFBSSxNQUFNLFlBQVksaUJBQWlCLElBQUksYUFBYSxZQUFZLGlCQUFpQixJQUFJLGtCQUFrQixXQUFXLEdBQUcsSUFBSTtBQUNqSyxjQUFJLGFBQWEsa0JBQWtCO0FBQ2xDLG1CQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQ0EsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJO0FBRUosYUFBUyxNQUFNLENBQUM7QUFDaEIsT0FBRztBQUNGLFVBQUksU0FBUyxLQUFLLElBQUk7QUFDdEIsVUFBSSxHQUFHO0FBQ04sZUFBTyxXQUFXLElBQUksZ0JBQWdCLElBQUksTUFBTSxZQUFZLEVBQUUsUUFBUSxJQUFJLGFBQWEsWUFBWSxFQUFFLFFBQVEsSUFBSSxFQUFFLENBQUMsRUFBRSxTQUFTLFdBQVcsR0FBRyxHQUFHLGNBQWM7QUFDOUosWUFBSSxhQUFhLGtCQUFrQjtBQUNsQyxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsSUFDRCxTQUFTO0FBQ1QsV0FBTztBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUEsRUFLTyxPQUFPLFFBQWdCLE9BQWUsZ0JBQXlCLE9BQWE7QUFDbEYsU0FBSyxpQkFBaUIsS0FBSyxrQkFBa0I7QUFDN0MsU0FBSyxpQkFBaUIsYUFBYTtBQUNuQyxTQUFLLGlCQUFpQixRQUFRO0FBRTlCLFFBQUksS0FBSyxTQUFTLFVBQVU7QUFDM0IsWUFBTSxFQUFFLE1BQU0sV0FBVyxnQkFBZ0IsSUFBSSxLQUFLLE9BQU8sTUFBTTtBQUMvRCxZQUFNLFFBQVEsS0FBSztBQUNuQixZQUFNLGNBQWMsTUFBTTtBQUMxQixZQUFNLG9CQUFvQixLQUFLLGlCQUFpQixNQUFNLFNBQVM7QUFDL0QsVUFBSSxLQUFLLE1BQU0sZ0JBQWdCLEtBQzlCLE1BQU0sSUFBSSxTQUFTLEtBQUsscUJBQXFCLFFBQzdDLE1BQU0sSUFBSSxXQUFXLEtBQUsscUJBQXFCLFVBQzlDLGtCQUFrQixNQUFNLFdBQVcsVUFDcEMsTUFBTSxTQUFTLG1CQUNkO0FBRUQsYUFBSyxhQUFhLE1BQU0sS0FBSztBQUM3QixhQUFLLHNCQUFzQjtBQUMzQjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLG9CQUFvQixRQUFRO0FBQy9CLGFBQUssd0JBQXdCLE9BQU8sSUFBSTtBQUN4QyxhQUFLLGFBQWEsU0FBUyxNQUFNO0FBQUEsTUFDbEMsV0FBVyxrQkFBa0IsS0FBSyxNQUFNLFNBQVMsUUFBUTtBQUV4RCxjQUFNLGFBQXlCLENBQUM7QUFDaEMsWUFBSSxnQkFBZ0IsSUFBSTtBQUFBLFVBQ3ZCLE1BQU07QUFBQSxVQUNOO0FBQUEsVUFDQSxNQUFNO0FBQUEsVUFDTixLQUFLLGVBQWUsTUFBTSxhQUFhLG1CQUFtQixNQUFNLEdBQUc7QUFBQSxVQUNuRSxLQUFLLGVBQWUsYUFBYSxNQUFNLEdBQUcsSUFBSSxLQUFLLGVBQWUsYUFBYSxpQkFBaUI7QUFBQSxRQUNqRztBQUVBLFlBQUksS0FBSyxnQkFBZ0IsS0FBSyxLQUFLLFVBQVUsS0FBSyxHQUFHO0FBQ3BELGdCQUFNLGNBQWMsS0FBSyxlQUFlLE1BQU0sU0FBUztBQUV2RCxjQUFJLGdCQUFnQixJQUFjO0FBQ2pDLGtCQUFNLFdBQXlCLEVBQUUsTUFBTSxjQUFjLE1BQU0sT0FBTyxHQUFHLFFBQVEsRUFBRTtBQUMvRSw0QkFBZ0IsSUFBSTtBQUFBLGNBQ25CLGNBQWM7QUFBQSxjQUNkO0FBQUEsY0FDQSxjQUFjO0FBQUEsY0FDZCxLQUFLLGVBQWUsY0FBYyxhQUFhLFVBQVUsY0FBYyxHQUFHO0FBQUEsY0FDMUUsY0FBYyxTQUFTO0FBQUEsWUFDeEI7QUFFQSxxQkFBUztBQUFBLFVBQ1Y7QUFBQSxRQUNEO0FBR0EsWUFBSSxLQUFLLGdCQUFnQixLQUFLLEtBQUssWUFBWSxLQUFLLEdBQUc7QUFDdEQsZ0JBQU0sYUFBYSxLQUFLLGVBQWUsTUFBTSxZQUFZLENBQUM7QUFDMUQsY0FBSSxlQUFlLElBQWM7QUFDaEMsa0JBQU0sY0FBYyxLQUFLLGlCQUFpQixNQUFNLFlBQVksQ0FBQztBQUM3RCxpQkFBSyxlQUFlLE1BQU0sV0FBVztBQUNyQyxvQkFBUSxPQUFPO0FBRWYsZ0JBQUksS0FBSyxNQUFNLFdBQVcsR0FBRztBQUM1Qix5QkFBVyxLQUFLLElBQUk7QUFBQSxZQUNyQjtBQUFBLFVBQ0QsT0FBTztBQUNOLGlCQUFLLGVBQWUsTUFBTSxpQkFBaUI7QUFBQSxVQUM1QztBQUFBLFFBQ0QsT0FBTztBQUNOLGVBQUssZUFBZSxNQUFNLGlCQUFpQjtBQUFBLFFBQzVDO0FBRUEsY0FBTSxZQUFZLEtBQUssZ0JBQWdCLEtBQUs7QUFDNUMsWUFBSSxjQUFjLFNBQVMsR0FBRztBQUM3QixlQUFLLGNBQWMsTUFBTSxhQUFhO0FBQUEsUUFDdkM7QUFFQSxZQUFJLFVBQVU7QUFDZCxpQkFBUyxJQUFJLEdBQUcsSUFBSSxVQUFVLFFBQVEsS0FBSztBQUMxQyxvQkFBVSxLQUFLLGNBQWMsU0FBUyxVQUFVLENBQUMsQ0FBQztBQUFBLFFBQ25EO0FBQ0EsYUFBSyxZQUFZLFVBQVU7QUFBQSxNQUM1QixPQUFPO0FBQ04sYUFBSyx5QkFBeUIsT0FBTyxJQUFJO0FBQUEsTUFDMUM7QUFBQSxJQUNELE9BQU87QUFFTixZQUFNLFNBQVMsS0FBSyxnQkFBZ0IsS0FBSztBQUN6QyxVQUFJLE9BQU8sS0FBSyxhQUFhLE1BQU0sT0FBTyxDQUFDLENBQUM7QUFFNUMsZUFBUyxJQUFJLEdBQUcsSUFBSSxPQUFPLFFBQVEsS0FBSztBQUN2QyxlQUFPLEtBQUssY0FBYyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQUEsTUFDMUM7QUFBQSxJQUNEO0FBR0EsU0FBSyxzQkFBc0I7QUFBQSxFQUM1QjtBQUFBLEVBRU8sT0FBTyxRQUFnQixLQUFtQjtBQUNoRCxTQUFLLGlCQUFpQixhQUFhO0FBQ25DLFNBQUssaUJBQWlCLFFBQVE7QUFFOUIsUUFBSSxPQUFPLEtBQUssS0FBSyxTQUFTLFVBQVU7QUFDdkM7QUFBQSxJQUNEO0FBRUEsVUFBTSxnQkFBZ0IsS0FBSyxPQUFPLE1BQU07QUFDeEMsVUFBTSxjQUFjLEtBQUssT0FBTyxTQUFTLEdBQUc7QUFDNUMsVUFBTSxZQUFZLGNBQWM7QUFDaEMsVUFBTSxVQUFVLFlBQVk7QUFFNUIsUUFBSSxjQUFjLFNBQVM7QUFDMUIsWUFBTUMseUJBQXdCLEtBQUssaUJBQWlCLFdBQVcsY0FBYyxTQUFTO0FBQ3RGLFlBQU1DLHVCQUFzQixLQUFLLGlCQUFpQixXQUFXLFlBQVksU0FBUztBQUVsRixVQUFJLGNBQWMsb0JBQW9CLFFBQVE7QUFDN0MsWUFBSSxRQUFRLFVBQVUsTUFBTSxRQUFRO0FBQ25DLGdCQUFNLE9BQU8sVUFBVSxLQUFLO0FBQzVCLG1CQUFTLE1BQU0sU0FBUztBQUN4QixlQUFLLHlCQUF5QixJQUFJO0FBQ2xDLGVBQUssc0JBQXNCO0FBQzNCO0FBQUEsUUFDRDtBQUNBLGFBQUssZUFBZSxXQUFXQSxvQkFBbUI7QUFDbEQsYUFBSyxhQUFhLFNBQVMsTUFBTTtBQUNqQyxhQUFLLHlCQUF5QixTQUFTO0FBQ3ZDLGFBQUssc0JBQXNCO0FBQzNCO0FBQUEsTUFDRDtBQUVBLFVBQUksY0FBYyxrQkFBa0IsVUFBVSxNQUFNLFdBQVcsU0FBUyxLQUFLO0FBQzVFLGFBQUssZUFBZSxXQUFXRCxzQkFBcUI7QUFDcEQsYUFBSyx5QkFBeUIsU0FBUztBQUN2QyxhQUFLLHNCQUFzQjtBQUMzQjtBQUFBLE1BQ0Q7QUFHQSxXQUFLLFdBQVcsV0FBV0Esd0JBQXVCQyxvQkFBbUI7QUFDckUsV0FBSyxzQkFBc0I7QUFDM0I7QUFBQSxJQUNEO0FBRUEsVUFBTSxhQUF5QixDQUFDO0FBRWhDLFVBQU0sd0JBQXdCLEtBQUssaUJBQWlCLFdBQVcsY0FBYyxTQUFTO0FBQ3RGLFNBQUssZUFBZSxXQUFXLHFCQUFxQjtBQUNwRCxTQUFLLGFBQWEsU0FBUyxNQUFNO0FBQ2pDLFFBQUksVUFBVSxNQUFNLFdBQVcsR0FBRztBQUNqQyxpQkFBVyxLQUFLLFNBQVM7QUFBQSxJQUMxQjtBQUdBLFVBQU0sc0JBQXNCLEtBQUssaUJBQWlCLFNBQVMsWUFBWSxTQUFTO0FBQ2hGLFNBQUssZUFBZSxTQUFTLG1CQUFtQjtBQUNoRCxRQUFJLFFBQVEsTUFBTSxXQUFXLEdBQUc7QUFDL0IsaUJBQVcsS0FBSyxPQUFPO0FBQUEsSUFDeEI7QUFHQSxVQUFNLGFBQWEsVUFBVSxLQUFLO0FBQ2xDLGFBQVMsT0FBTyxZQUFZLFNBQVMsWUFBWSxTQUFTLFNBQVMsT0FBTyxLQUFLLEtBQUssR0FBRztBQUN0RixpQkFBVyxLQUFLLElBQUk7QUFBQSxJQUNyQjtBQUVBLFVBQU0sT0FBTyxVQUFVLE1BQU0sV0FBVyxJQUFJLFVBQVUsS0FBSyxJQUFJO0FBQy9ELFNBQUssWUFBWSxVQUFVO0FBQzNCLFNBQUsseUJBQXlCLElBQUk7QUFDbEMsU0FBSyxzQkFBc0I7QUFBQSxFQUM1QjtBQUFBLEVBRVEsd0JBQXdCLE9BQWUsTUFBZ0I7QUFFOUQsVUFBTSxhQUF5QixDQUFDO0FBQ2hDLFFBQUksS0FBSyxnQkFBZ0IsS0FBSyxLQUFLLFVBQVUsS0FBSyxLQUFLLEtBQUssWUFBWSxJQUFJLEdBQUc7QUFHOUUsWUFBTSxRQUFRLEtBQUs7QUFDbkIsWUFBTSxXQUF5QixFQUFFLE1BQU0sTUFBTSxNQUFNLE9BQU8sR0FBRyxRQUFRLEVBQUU7QUFDdkUsWUFBTSxTQUFTLElBQUk7QUFBQSxRQUNsQixNQUFNO0FBQUEsUUFDTjtBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sS0FBSyxlQUFlLE1BQU0sYUFBYSxVQUFVLE1BQU0sR0FBRztBQUFBLFFBQzFELE1BQU0sU0FBUztBQUFBLE1BQ2hCO0FBRUEsV0FBSyxRQUFRO0FBRWIsZUFBUztBQUNULHlCQUFtQixNQUFNLE1BQU0sSUFBSSxFQUFFO0FBRXJDLFVBQUksS0FBSyxNQUFNLFdBQVcsR0FBRztBQUM1QixtQkFBVyxLQUFLLElBQUk7QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLFlBQVksS0FBSyxnQkFBZ0IsS0FBSztBQUM1QyxRQUFJLFVBQVUsS0FBSyxhQUFhLE1BQU0sVUFBVSxVQUFVLFNBQVMsQ0FBQyxDQUFDO0FBQ3JFLGFBQVMsSUFBSSxVQUFVLFNBQVMsR0FBRyxLQUFLLEdBQUcsS0FBSztBQUMvQyxnQkFBVSxLQUFLLGFBQWEsU0FBUyxVQUFVLENBQUMsQ0FBQztBQUFBLElBQ2xEO0FBQ0EsU0FBSyx5QkFBeUIsT0FBTztBQUNyQyxTQUFLLFlBQVksVUFBVTtBQUFBLEVBQzVCO0FBQUEsRUFFUSx5QkFBeUIsT0FBZSxNQUFnQjtBQUUvRCxRQUFJLEtBQUssNkJBQTZCLE9BQU8sSUFBSSxHQUFHO0FBRW5ELGVBQVM7QUFBQSxJQUNWO0FBRUEsVUFBTSxZQUFZLEtBQUssZ0JBQWdCLEtBQUs7QUFDNUMsVUFBTSxVQUFVLEtBQUssY0FBYyxNQUFNLFVBQVUsQ0FBQyxDQUFDO0FBQ3JELFFBQUksVUFBVTtBQUVkLGFBQVMsSUFBSSxHQUFHLElBQUksVUFBVSxRQUFRLEtBQUs7QUFDMUMsZ0JBQVUsS0FBSyxjQUFjLFNBQVMsVUFBVSxDQUFDLENBQUM7QUFBQSxJQUNuRDtBQUVBLFNBQUsseUJBQXlCLE9BQU87QUFBQSxFQUN0QztBQUFBLEVBSVEsaUJBQWlCLE1BQWdCLFdBQW1CLEtBQXlDO0FBQ3BHLFVBQU0sUUFBUSxLQUFLO0FBQ25CLFVBQU0sY0FBYyxLQUFLLE1BQU07QUFDL0IsVUFBTSxhQUFhLEtBQUssU0FBUyxXQUFXLEVBQUU7QUFFOUMsVUFBTSxjQUFjLFdBQVcsTUFBTSxNQUFNLElBQUksSUFBSSxNQUFNLE1BQU07QUFFL0QsVUFBTSxTQUFTLGNBQWM7QUFHN0IsUUFBSSxNQUFNLE1BQU0sTUFBTTtBQUN0QixRQUFJLE9BQU8sTUFBTSxJQUFJO0FBRXJCLFFBQUksTUFBYztBQUNsQixRQUFJLFVBQWtCO0FBQ3RCLFFBQUksV0FBbUI7QUFFdkIsV0FBTyxPQUFPLE1BQU07QUFDbkIsWUFBTSxPQUFRLE9BQU8sT0FBTyxJQUFLO0FBQ2pDLGlCQUFXLFdBQVcsR0FBRztBQUV6QixVQUFJLFFBQVEsTUFBTTtBQUNqQjtBQUFBLE1BQ0Q7QUFFQSxnQkFBVSxXQUFXLE1BQU0sQ0FBQztBQUU1QixVQUFJLFNBQVMsVUFBVTtBQUN0QixlQUFPLE1BQU07QUFBQSxNQUNkLFdBQVcsVUFBVSxTQUFTO0FBQzdCLGNBQU0sTUFBTTtBQUFBLE1BQ2IsT0FBTztBQUNOO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLEtBQUs7QUFDUixVQUFJLE9BQU87QUFDWCxVQUFJLFNBQVMsU0FBUztBQUN0QixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFFBQVEsU0FBUztBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUFBLEVBRVEsZUFBZSxhQUFxQixPQUFxQixLQUEyQjtBQUczRixRQUFJLElBQUksV0FBVyxHQUFHO0FBQ3JCLGFBQU8sSUFBSSxPQUFPLE1BQU07QUFBQSxJQUN6QjtBQUVBLFVBQU0sYUFBYSxLQUFLLFNBQVMsV0FBVyxFQUFFO0FBQzlDLFFBQUksSUFBSSxTQUFTLFdBQVcsU0FBUyxHQUFHO0FBQ3ZDLGFBQU8sSUFBSSxPQUFPLE1BQU07QUFBQSxJQUN6QjtBQUVBLFVBQU0sc0JBQXNCLFdBQVcsSUFBSSxPQUFPLENBQUM7QUFDbkQsVUFBTSxZQUFZLFdBQVcsSUFBSSxJQUFJLElBQUksSUFBSTtBQUM3QyxRQUFJLHNCQUFzQixZQUFZLEdBQUc7QUFDeEMsYUFBTyxJQUFJLE9BQU8sTUFBTTtBQUFBLElBQ3pCO0FBSUEsVUFBTSxxQkFBcUIsWUFBWTtBQUN2QyxVQUFNLFNBQVMsS0FBSyxTQUFTLFdBQVcsRUFBRTtBQUUxQyxRQUFJLE9BQU8sV0FBVyxrQkFBa0IsTUFBTSxJQUFJO0FBQ2pELGFBQU8sSUFBSSxPQUFPLE1BQU0sT0FBTztBQUFBLElBQ2hDLE9BQU87QUFDTixhQUFPLElBQUksT0FBTyxNQUFNO0FBQUEsSUFDekI7QUFBQSxFQUNEO0FBQUEsRUFFUSxlQUFlLGFBQXFCLFFBQThCO0FBQ3pFLFVBQU0sYUFBYSxLQUFLLFNBQVMsV0FBVyxFQUFFO0FBQzlDLFdBQU8sV0FBVyxPQUFPLElBQUksSUFBSSxPQUFPO0FBQUEsRUFDekM7QUFBQSxFQUVRLFlBQVksT0FBeUI7QUFDNUMsYUFBUyxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSztBQUN0QyxlQUFTLE1BQU0sTUFBTSxDQUFDLENBQUM7QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGdCQUFnQixNQUF1QjtBQUM5QyxRQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFHcEMsWUFBTSxZQUFxQixDQUFDO0FBQzVCLGFBQU8sS0FBSyxTQUFTLG1CQUFtQjtBQUN2QyxjQUFNLFdBQVcsS0FBSyxXQUFXLG9CQUFvQixDQUFDO0FBQ3RELFlBQUk7QUFDSixZQUFJLGFBQWEsU0FBUyxrQkFBbUIsWUFBWSxTQUFVLFlBQVksT0FBUztBQUV2RixzQkFBWSxLQUFLLFVBQVUsR0FBRyxvQkFBb0IsQ0FBQztBQUNuRCxpQkFBTyxLQUFLLFVBQVUsb0JBQW9CLENBQUM7QUFBQSxRQUM1QyxPQUFPO0FBQ04sc0JBQVksS0FBSyxVQUFVLEdBQUcsaUJBQWlCO0FBQy9DLGlCQUFPLEtBQUssVUFBVSxpQkFBaUI7QUFBQSxRQUN4QztBQUVBLGNBQU1DLGNBQWEscUJBQXFCLFNBQVM7QUFDakQsa0JBQVUsS0FBSyxJQUFJO0FBQUEsVUFDbEIsS0FBSyxTQUFTO0FBQUE7QUFBQSxVQUNkLEVBQUUsTUFBTSxHQUFHLFFBQVEsRUFBRTtBQUFBLFVBQ3JCLEVBQUUsTUFBTUEsWUFBVyxTQUFTLEdBQUcsUUFBUSxVQUFVLFNBQVNBLFlBQVdBLFlBQVcsU0FBUyxDQUFDLEVBQUU7QUFBQSxVQUM1RkEsWUFBVyxTQUFTO0FBQUEsVUFDcEIsVUFBVTtBQUFBLFFBQ1gsQ0FBQztBQUNELGFBQUssU0FBUyxLQUFLLElBQUksYUFBYSxXQUFXQSxXQUFVLENBQUM7QUFBQSxNQUMzRDtBQUVBLFlBQU1BLGNBQWEscUJBQXFCLElBQUk7QUFDNUMsZ0JBQVUsS0FBSyxJQUFJO0FBQUEsUUFDbEIsS0FBSyxTQUFTO0FBQUE7QUFBQSxRQUNkLEVBQUUsTUFBTSxHQUFHLFFBQVEsRUFBRTtBQUFBLFFBQ3JCLEVBQUUsTUFBTUEsWUFBVyxTQUFTLEdBQUcsUUFBUSxLQUFLLFNBQVNBLFlBQVdBLFlBQVcsU0FBUyxDQUFDLEVBQUU7QUFBQSxRQUN2RkEsWUFBVyxTQUFTO0FBQUEsUUFDcEIsS0FBSztBQUFBLE1BQ04sQ0FBQztBQUNELFdBQUssU0FBUyxLQUFLLElBQUksYUFBYSxNQUFNQSxXQUFVLENBQUM7QUFFckQsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLGNBQWMsS0FBSyxTQUFTLENBQUMsRUFBRSxPQUFPO0FBQzFDLFVBQU0sYUFBYSxxQkFBcUIsTUFBTSxLQUFLO0FBRW5ELFFBQUksUUFBUSxLQUFLO0FBQ2pCLFFBQUksS0FBSyxTQUFTLENBQUMsRUFBRSxXQUFXLEtBQUssU0FBUyxDQUFDLEVBQUUsV0FBVyxTQUFTLENBQUMsTUFBTSxlQUN4RSxnQkFBZ0IsS0FDaEIsS0FBSyxZQUFZLElBQUksS0FDckIsS0FBSyxVQUFVLEtBQUssU0FBUyxDQUFDLEVBQUUsTUFBTSxHQUN4QztBQUNELFdBQUssdUJBQXVCLEVBQUUsTUFBTSxLQUFLLHFCQUFxQixNQUFNLFFBQVEsS0FBSyxxQkFBcUIsU0FBUyxFQUFFO0FBQ2pILGNBQVEsS0FBSztBQUViLGVBQVMsSUFBSSxHQUFHLElBQUksV0FBVyxRQUFRLEtBQUs7QUFDM0MsbUJBQVcsQ0FBQyxLQUFLLGNBQWM7QUFBQSxNQUNoQztBQUVBLFdBQUssU0FBUyxDQUFDLEVBQUUsYUFBd0IsS0FBSyxTQUFTLENBQUMsRUFBRSxXQUFZLE9BQWlCLFdBQVcsTUFBTSxDQUFDLENBQUM7QUFDMUcsV0FBSyxTQUFTLENBQUMsRUFBRSxVQUFVLE1BQU07QUFDakMscUJBQWU7QUFBQSxJQUNoQixPQUFPO0FBQ04sVUFBSSxnQkFBZ0IsR0FBRztBQUN0QixpQkFBUyxJQUFJLEdBQUcsSUFBSSxXQUFXLFFBQVEsS0FBSztBQUMzQyxxQkFBVyxDQUFDLEtBQUs7QUFBQSxRQUNsQjtBQUFBLE1BQ0Q7QUFDQSxXQUFLLFNBQVMsQ0FBQyxFQUFFLGFBQXdCLEtBQUssU0FBUyxDQUFDLEVBQUUsV0FBWSxPQUFpQixXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzFHLFdBQUssU0FBUyxDQUFDLEVBQUUsVUFBVTtBQUFBLElBQzVCO0FBRUEsVUFBTSxZQUFZLEtBQUssU0FBUyxDQUFDLEVBQUUsT0FBTztBQUMxQyxVQUFNLFdBQVcsS0FBSyxTQUFTLENBQUMsRUFBRSxXQUFXLFNBQVM7QUFDdEQsVUFBTSxZQUFZLFlBQVksS0FBSyxTQUFTLENBQUMsRUFBRSxXQUFXLFFBQVE7QUFDbEUsVUFBTSxTQUFTLEVBQUUsTUFBTSxVQUFVLFFBQVEsVUFBVTtBQUNuRCxVQUFNLFdBQVcsSUFBSTtBQUFBLE1BQ3BCO0FBQUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsS0FBSyxlQUFlLEdBQUcsT0FBTyxNQUFNO0FBQUEsTUFDcEMsWUFBWTtBQUFBLElBQ2I7QUFDQSxTQUFLLHVCQUF1QjtBQUM1QixXQUFPLENBQUMsUUFBUTtBQUFBLEVBQ2pCO0FBQUEsRUFFTyxxQkFBNkI7QUFDbkMsV0FBTyxLQUFLLG9CQUFvQixLQUFLLElBQUk7QUFBQSxFQUMxQztBQUFBLEVBRU8sa0JBQWtCLFlBQW9CLFlBQW9CLEdBQVc7QUFDM0UsUUFBSSxJQUFJLEtBQUs7QUFFYixRQUFJLE1BQU07QUFDVixVQUFNLFFBQVEsS0FBSyxhQUFhLEtBQUssVUFBVTtBQUMvQyxRQUFJLE9BQU87QUFDVixVQUFJLE1BQU07QUFDVixZQUFNLHVCQUF1QixLQUFLLG9CQUFvQixHQUFHLGFBQWEsTUFBTSxzQkFBc0IsQ0FBQztBQUNuRyxZQUFNLFNBQVMsS0FBSyxTQUFTLEVBQUUsTUFBTSxXQUFXLEVBQUU7QUFDbEQsWUFBTSxjQUFjLEtBQUssZUFBZSxFQUFFLE1BQU0sYUFBYSxFQUFFLE1BQU0sS0FBSztBQUMxRSxVQUFJLE1BQU0sc0JBQXNCLEVBQUUsTUFBTSxnQkFBZ0IsWUFBWTtBQUNuRSxjQUFNLE9BQU8sVUFBVSxjQUFjLHNCQUFzQixjQUFjLEVBQUUsTUFBTSxNQUFNO0FBQUEsTUFDeEYsT0FBTztBQUNOLGNBQU0sbUJBQW1CLEtBQUssb0JBQW9CLEdBQUcsYUFBYSxNQUFNLG1CQUFtQjtBQUMzRixlQUFPLE9BQU8sVUFBVSxjQUFjLHNCQUFzQixjQUFjLG1CQUFtQixTQUFTO0FBQUEsTUFDdkc7QUFBQSxJQUNELE9BQU87QUFDTixVQUFJLGtCQUFrQjtBQUN0QixZQUFNLHFCQUFxQjtBQUMzQixhQUFPLE1BQU0sVUFBVTtBQUN0QixZQUFJLEVBQUUsU0FBUyxZQUFZLEVBQUUsV0FBVyxhQUFhLEdBQUc7QUFDdkQsY0FBSSxFQUFFO0FBQUEsUUFDUCxXQUFXLEVBQUUsVUFBVSxFQUFFLE1BQU0sY0FBYyxhQUFhLEdBQUc7QUFDNUQsZ0JBQU0sdUJBQXVCLEtBQUssb0JBQW9CLEdBQUcsYUFBYSxFQUFFLFVBQVUsQ0FBQztBQUNuRixnQkFBTSxtQkFBbUIsS0FBSyxvQkFBb0IsR0FBRyxhQUFhLEVBQUUsVUFBVSxDQUFDO0FBQy9FLGdCQUFNLFNBQVMsS0FBSyxTQUFTLEVBQUUsTUFBTSxXQUFXLEVBQUU7QUFDbEQsZ0JBQU0sY0FBYyxLQUFLLGVBQWUsRUFBRSxNQUFNLGFBQWEsRUFBRSxNQUFNLEtBQUs7QUFDMUUsNkJBQW1CLEVBQUU7QUFDckIsZUFBSyxhQUFhLElBQUk7QUFBQSxZQUNyQixNQUFNO0FBQUEsWUFDTjtBQUFBLFlBQ0EscUJBQXFCLHNCQUFzQixhQUFhLElBQUksRUFBRTtBQUFBLFVBQy9ELENBQUM7QUFFRCxpQkFBTyxPQUFPLFVBQVUsY0FBYyxzQkFBc0IsY0FBYyxtQkFBbUIsU0FBUztBQUFBLFFBQ3ZHLFdBQVcsRUFBRSxVQUFVLEVBQUUsTUFBTSxnQkFBZ0IsYUFBYSxHQUFHO0FBQzlELGdCQUFNLHVCQUF1QixLQUFLLG9CQUFvQixHQUFHLGFBQWEsRUFBRSxVQUFVLENBQUM7QUFDbkYsZ0JBQU0sU0FBUyxLQUFLLFNBQVMsRUFBRSxNQUFNLFdBQVcsRUFBRTtBQUNsRCxnQkFBTSxjQUFjLEtBQUssZUFBZSxFQUFFLE1BQU0sYUFBYSxFQUFFLE1BQU0sS0FBSztBQUUxRSxnQkFBTSxPQUFPLFVBQVUsY0FBYyxzQkFBc0IsY0FBYyxFQUFFLE1BQU0sTUFBTTtBQUN2RjtBQUFBLFFBQ0QsT0FBTztBQUNOLHdCQUFjLEVBQUUsVUFBVSxFQUFFLE1BQU07QUFDbEMsNkJBQW1CLEVBQUUsWUFBWSxFQUFFLE1BQU07QUFDekMsY0FBSSxFQUFFO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBR0EsUUFBSSxFQUFFLEtBQUs7QUFDWCxXQUFPLE1BQU0sVUFBVTtBQUN0QixZQUFNLFNBQVMsS0FBSyxTQUFTLEVBQUUsTUFBTSxXQUFXLEVBQUU7QUFFbEQsVUFBSSxFQUFFLE1BQU0sY0FBYyxHQUFHO0FBQzVCLGNBQU0sbUJBQW1CLEtBQUssb0JBQW9CLEdBQUcsQ0FBQztBQUN0RCxjQUFNLGNBQWMsS0FBSyxlQUFlLEVBQUUsTUFBTSxhQUFhLEVBQUUsTUFBTSxLQUFLO0FBRTFFLGVBQU8sT0FBTyxVQUFVLGFBQWEsY0FBYyxtQkFBbUIsU0FBUztBQUMvRSxlQUFPO0FBQUEsTUFDUixPQUFPO0FBQ04sY0FBTSxjQUFjLEtBQUssZUFBZSxFQUFFLE1BQU0sYUFBYSxFQUFFLE1BQU0sS0FBSztBQUMxRSxlQUFPLE9BQU8sT0FBTyxhQUFhLEVBQUUsTUFBTSxNQUFNO0FBQUEsTUFDakQ7QUFFQSxVQUFJLEVBQUUsS0FBSztBQUFBLElBQ1o7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsd0JBQXdCO0FBQy9CLFFBQUksSUFBSSxLQUFLO0FBRWIsUUFBSSxRQUFRO0FBQ1osUUFBSSxNQUFNO0FBRVYsV0FBTyxNQUFNLFVBQVU7QUFDdEIsZUFBUyxFQUFFLFVBQVUsRUFBRSxNQUFNO0FBQzdCLGFBQU8sRUFBRSxZQUFZLEVBQUUsTUFBTTtBQUM3QixVQUFJLEVBQUU7QUFBQSxJQUNQO0FBRUEsU0FBSyxXQUFXO0FBQ2hCLFNBQUssVUFBVTtBQUNmLFNBQUssYUFBYSxTQUFTLEtBQUssT0FBTztBQUFBLEVBQ3hDO0FBQUE7QUFBQSxFQUdRLFdBQVcsTUFBZ0Isa0JBQWdFO0FBQ2xHLFVBQU0sUUFBUSxLQUFLO0FBQ25CLFVBQU0sTUFBTSxLQUFLLGlCQUFpQixNQUFNLGdCQUFnQjtBQUN4RCxVQUFNLFVBQVUsSUFBSSxPQUFPLE1BQU0sTUFBTTtBQUV2QyxRQUFJLEtBQUssZUFBZSxNQUFNLGFBQWEsTUFBTSxHQUFHLElBQUksS0FBSyxlQUFlLE1BQU0sYUFBYSxNQUFNLEtBQUssTUFBTSxrQkFBa0I7QUFFakksWUFBTSxjQUFjLEtBQUssZUFBZSxLQUFLLE1BQU0sYUFBYSxNQUFNLE9BQU8sR0FBRztBQUNoRixVQUFJLGdCQUFnQixTQUFTO0FBRTVCLGVBQU8sRUFBRSxPQUFPLGFBQWEsV0FBVyxFQUFFO0FBQUEsTUFDM0M7QUFBQSxJQUNEO0FBRUEsV0FBTyxFQUFFLE9BQU8sU0FBUyxXQUFXLElBQUksT0FBTztBQUFBLEVBQ2hEO0FBQUEsRUFFUSxvQkFBb0IsTUFBZ0IsT0FBZTtBQUMxRCxRQUFJLFFBQVEsR0FBRztBQUNkLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxRQUFRLEtBQUs7QUFDbkIsVUFBTSxhQUFhLEtBQUssU0FBUyxNQUFNLFdBQVcsRUFBRTtBQUNwRCxVQUFNLHlCQUF5QixNQUFNLE1BQU0sT0FBTyxRQUFRO0FBQzFELFFBQUkseUJBQXlCLE1BQU0sSUFBSSxNQUFNO0FBQzVDLGFBQU8sV0FBVyxNQUFNLElBQUksSUFBSSxJQUFJLE1BQU0sSUFBSSxTQUFTLFdBQVcsTUFBTSxNQUFNLElBQUksSUFBSSxNQUFNLE1BQU07QUFBQSxJQUNuRyxPQUFPO0FBQ04sYUFBTyxXQUFXLHNCQUFzQixJQUFJLFdBQVcsTUFBTSxNQUFNLElBQUksSUFBSSxNQUFNLE1BQU07QUFBQSxJQUN4RjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGVBQWUsTUFBZ0IsS0FBbUI7QUFDekQsVUFBTSxRQUFRLEtBQUs7QUFDbkIsVUFBTSxnQkFBZ0IsTUFBTTtBQUM1QixVQUFNLG9CQUFvQixLQUFLLGVBQWUsTUFBTSxhQUFhLE1BQU0sR0FBRztBQUUxRSxVQUFNLFNBQVM7QUFDZixVQUFNLGVBQWUsS0FBSyxlQUFlLE1BQU0sYUFBYSxNQUFNO0FBQ2xFLFVBQU0saUJBQWlCLEtBQUssZUFBZSxNQUFNLGFBQWEsTUFBTSxPQUFPLE1BQU07QUFFakYsVUFBTSxXQUFXLGlCQUFpQjtBQUNsQyxVQUFNLGFBQWEsZUFBZTtBQUNsQyxVQUFNLFlBQVksTUFBTSxTQUFTO0FBRWpDLFNBQUssUUFBUSxJQUFJO0FBQUEsTUFDaEIsTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSx1QkFBbUIsTUFBTSxNQUFNLFlBQVksUUFBUTtBQUFBLEVBQ3BEO0FBQUEsRUFFUSxlQUFlLE1BQWdCLEtBQW1CO0FBQ3pELFVBQU0sUUFBUSxLQUFLO0FBQ25CLFVBQU0sZ0JBQWdCLE1BQU07QUFDNUIsVUFBTSxzQkFBc0IsS0FBSyxlQUFlLE1BQU0sYUFBYSxNQUFNLEtBQUs7QUFFOUUsVUFBTSxXQUFXO0FBQ2pCLFVBQU0saUJBQWlCLEtBQUssZUFBZSxNQUFNLGFBQWEsVUFBVSxNQUFNLEdBQUc7QUFDakYsVUFBTSxpQkFBaUIsS0FBSyxlQUFlLE1BQU0sYUFBYSxRQUFRO0FBQ3RFLFVBQU0sV0FBVyxpQkFBaUI7QUFDbEMsVUFBTSxhQUFhLHNCQUFzQjtBQUN6QyxVQUFNLFlBQVksTUFBTSxTQUFTO0FBQ2pDLFNBQUssUUFBUSxJQUFJO0FBQUEsTUFDaEIsTUFBTTtBQUFBLE1BQ047QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSx1QkFBbUIsTUFBTSxNQUFNLFlBQVksUUFBUTtBQUFBLEVBQ3BEO0FBQUEsRUFFUSxXQUFXLE1BQWdCLE9BQXFCLEtBQW1CO0FBQzFFLFVBQU0sUUFBUSxLQUFLO0FBQ25CLFVBQU0sbUJBQW1CLE1BQU07QUFDL0IsVUFBTSxpQkFBaUIsTUFBTTtBQUc3QixVQUFNLFlBQVksTUFBTTtBQUN4QixVQUFNLFdBQVcsTUFBTTtBQUN2QixVQUFNLFNBQVM7QUFDZixVQUFNLGlCQUFpQixLQUFLLGVBQWUsTUFBTSxhQUFhLE1BQU0sT0FBTyxNQUFNO0FBQ2pGLFVBQU0sWUFBWSxLQUFLLGVBQWUsTUFBTSxhQUFhLEtBQUssSUFBSSxLQUFLLGVBQWUsTUFBTSxhQUFhLGdCQUFnQjtBQUV6SCxTQUFLLFFBQVEsSUFBSTtBQUFBLE1BQ2hCLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUEsdUJBQW1CLE1BQU0sTUFBTSxZQUFZLFdBQVcsaUJBQWlCLFFBQVE7QUFHL0UsVUFBTSxXQUFXLElBQUk7QUFBQSxNQUNwQixNQUFNO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxNQUNBLEtBQUssZUFBZSxNQUFNLGFBQWEsS0FBSyxjQUFjO0FBQUEsTUFDMUQsS0FBSyxlQUFlLE1BQU0sYUFBYSxjQUFjLElBQUksS0FBSyxlQUFlLE1BQU0sYUFBYSxHQUFHO0FBQUEsSUFDcEc7QUFFQSxVQUFNLFVBQVUsS0FBSyxjQUFjLE1BQU0sUUFBUTtBQUNqRCxTQUFLLHlCQUF5QixPQUFPO0FBQUEsRUFDdEM7QUFBQSxFQUVRLGFBQWEsTUFBZ0IsT0FBcUI7QUFDekQsUUFBSSxLQUFLLDZCQUE2QixPQUFPLElBQUksR0FBRztBQUNuRCxlQUFTO0FBQUEsSUFDVjtBQUVBLFVBQU0sVUFBVSxLQUFLLGdCQUFnQixLQUFLLEtBQUssWUFBWSxLQUFLLEtBQUssS0FBSyxVQUFVLElBQUk7QUFDeEYsVUFBTSxjQUFjLEtBQUssU0FBUyxDQUFDLEVBQUUsT0FBTztBQUM1QyxTQUFLLFNBQVMsQ0FBQyxFQUFFLFVBQVU7QUFDM0IsVUFBTSxhQUFhLHFCQUFxQixPQUFPLEtBQUs7QUFDcEQsYUFBUyxJQUFJLEdBQUcsSUFBSSxXQUFXLFFBQVEsS0FBSztBQUMzQyxpQkFBVyxDQUFDLEtBQUs7QUFBQSxJQUNsQjtBQUNBLFFBQUksU0FBUztBQUNaLFlBQU0sa0JBQWtCLEtBQUssU0FBUyxDQUFDLEVBQUUsV0FBVyxLQUFLLFNBQVMsQ0FBQyxFQUFFLFdBQVcsU0FBUyxDQUFDO0FBQzFGLE1BQVcsS0FBSyxTQUFTLENBQUMsRUFBRSxXQUFZLElBQUk7QUFFNUMsV0FBSyx1QkFBdUIsRUFBRSxNQUFNLEtBQUsscUJBQXFCLE9BQU8sR0FBRyxRQUFRLGNBQWMsZ0JBQWdCO0FBQUEsSUFDL0c7QUFFQSxTQUFLLFNBQVMsQ0FBQyxFQUFFLGFBQXdCLEtBQUssU0FBUyxDQUFDLEVBQUUsV0FBWSxPQUFpQixXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzFHLFVBQU0sV0FBVyxLQUFLLFNBQVMsQ0FBQyxFQUFFLFdBQVcsU0FBUztBQUN0RCxVQUFNLFlBQVksS0FBSyxTQUFTLENBQUMsRUFBRSxPQUFPLFNBQVMsS0FBSyxTQUFTLENBQUMsRUFBRSxXQUFXLFFBQVE7QUFDdkYsVUFBTSxTQUFTLEVBQUUsTUFBTSxVQUFVLFFBQVEsVUFBVTtBQUNuRCxVQUFNLFlBQVksS0FBSyxNQUFNLFNBQVMsTUFBTTtBQUM1QyxVQUFNLGlCQUFpQixLQUFLLE1BQU07QUFDbEMsVUFBTSxpQkFBaUIsS0FBSyxlQUFlLEdBQUcsS0FBSyxNQUFNLE9BQU8sTUFBTTtBQUN0RSxVQUFNLFdBQVcsaUJBQWlCO0FBRWxDLFNBQUssUUFBUSxJQUFJO0FBQUEsTUFDaEIsS0FBSyxNQUFNO0FBQUEsTUFDWCxLQUFLLE1BQU07QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUEsU0FBSyx1QkFBdUI7QUFDNUIsdUJBQW1CLE1BQU0sTUFBTSxNQUFNLFFBQVEsUUFBUTtBQUFBLEVBQ3REO0FBQUEsRUFFUSxPQUFPLFFBQThCO0FBQzVDLFFBQUksSUFBSSxLQUFLO0FBQ2IsVUFBTSxRQUFRLEtBQUssYUFBYSxJQUFJLE1BQU07QUFDMUMsUUFBSSxPQUFPO0FBQ1YsYUFBTztBQUFBLFFBQ04sTUFBTSxNQUFNO0FBQUEsUUFDWixpQkFBaUIsTUFBTTtBQUFBLFFBQ3ZCLFdBQVcsU0FBUyxNQUFNO0FBQUEsTUFDM0I7QUFBQSxJQUNEO0FBRUEsUUFBSSxrQkFBa0I7QUFFdEIsV0FBTyxNQUFNLFVBQVU7QUFDdEIsVUFBSSxFQUFFLFlBQVksUUFBUTtBQUN6QixZQUFJLEVBQUU7QUFBQSxNQUNQLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSxVQUFVLFFBQVE7QUFDbEQsMkJBQW1CLEVBQUU7QUFDckIsY0FBTSxNQUFNO0FBQUEsVUFDWCxNQUFNO0FBQUEsVUFDTixXQUFXLFNBQVMsRUFBRTtBQUFBLFVBQ3RCO0FBQUEsUUFDRDtBQUNBLGFBQUssYUFBYSxJQUFJLEdBQUc7QUFDekIsZUFBTztBQUFBLE1BQ1IsT0FBTztBQUNOLGtCQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU07QUFDaEMsMkJBQW1CLEVBQUUsWUFBWSxFQUFFLE1BQU07QUFDekMsWUFBSSxFQUFFO0FBQUEsTUFDUDtBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsUUFBUSxZQUFvQixRQUE4QjtBQUNqRSxRQUFJLElBQUksS0FBSztBQUNiLFFBQUksa0JBQWtCO0FBRXRCLFdBQU8sTUFBTSxVQUFVO0FBQ3RCLFVBQUksRUFBRSxTQUFTLFlBQVksRUFBRSxXQUFXLGFBQWEsR0FBRztBQUN2RCxZQUFJLEVBQUU7QUFBQSxNQUNQLFdBQVcsRUFBRSxVQUFVLEVBQUUsTUFBTSxjQUFjLGFBQWEsR0FBRztBQUM1RCxjQUFNLHVCQUF1QixLQUFLLG9CQUFvQixHQUFHLGFBQWEsRUFBRSxVQUFVLENBQUM7QUFDbkYsY0FBTSxtQkFBbUIsS0FBSyxvQkFBb0IsR0FBRyxhQUFhLEVBQUUsVUFBVSxDQUFDO0FBQy9FLDJCQUFtQixFQUFFO0FBRXJCLGVBQU87QUFBQSxVQUNOLE1BQU07QUFBQSxVQUNOLFdBQVcsS0FBSyxJQUFJLHVCQUF1QixTQUFTLEdBQUcsZ0JBQWdCO0FBQUEsVUFDdkU7QUFBQSxRQUNEO0FBQUEsTUFDRCxXQUFXLEVBQUUsVUFBVSxFQUFFLE1BQU0sZ0JBQWdCLGFBQWEsR0FBRztBQUM5RCxjQUFNLHVCQUF1QixLQUFLLG9CQUFvQixHQUFHLGFBQWEsRUFBRSxVQUFVLENBQUM7QUFDbkYsWUFBSSx1QkFBdUIsU0FBUyxLQUFLLEVBQUUsTUFBTSxRQUFRO0FBQ3hELGlCQUFPO0FBQUEsWUFDTixNQUFNO0FBQUEsWUFDTixXQUFXLHVCQUF1QixTQUFTO0FBQUEsWUFDM0M7QUFBQSxVQUNEO0FBQUEsUUFDRCxPQUFPO0FBQ04sb0JBQVUsRUFBRSxNQUFNLFNBQVM7QUFDM0I7QUFBQSxRQUNEO0FBQUEsTUFDRCxPQUFPO0FBQ04sc0JBQWMsRUFBRSxVQUFVLEVBQUUsTUFBTTtBQUNsQywyQkFBbUIsRUFBRSxZQUFZLEVBQUUsTUFBTTtBQUN6QyxZQUFJLEVBQUU7QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUdBLFFBQUksRUFBRSxLQUFLO0FBQ1gsV0FBTyxNQUFNLFVBQVU7QUFFdEIsVUFBSSxFQUFFLE1BQU0sY0FBYyxHQUFHO0FBQzVCLGNBQU0sbUJBQW1CLEtBQUssb0JBQW9CLEdBQUcsQ0FBQztBQUN0RCxjQUFNQyxtQkFBa0IsS0FBSyxhQUFhLENBQUM7QUFDM0MsZUFBTztBQUFBLFVBQ04sTUFBTTtBQUFBLFVBQ04sV0FBVyxLQUFLLElBQUksU0FBUyxHQUFHLGdCQUFnQjtBQUFBLFVBQ2hELGlCQUFBQTtBQUFBLFFBQ0Q7QUFBQSxNQUNELE9BQU87QUFDTixZQUFJLEVBQUUsTUFBTSxVQUFVLFNBQVMsR0FBRztBQUNqQyxnQkFBTUEsbUJBQWtCLEtBQUssYUFBYSxDQUFDO0FBQzNDLGlCQUFPO0FBQUEsWUFDTixNQUFNO0FBQUEsWUFDTixXQUFXLFNBQVM7QUFBQSxZQUNwQixpQkFBQUE7QUFBQSxVQUNEO0FBQUEsUUFDRCxPQUFPO0FBQ04sb0JBQVUsRUFBRSxNQUFNO0FBQUEsUUFDbkI7QUFBQSxNQUNEO0FBRUEsVUFBSSxFQUFFLEtBQUs7QUFBQSxJQUNaO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGVBQWUsTUFBZ0IsUUFBd0I7QUFDOUQsUUFBSSxLQUFLLE1BQU0sY0FBYyxHQUFHO0FBQy9CLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxTQUFTLEtBQUssU0FBUyxLQUFLLE1BQU0sV0FBVztBQUNuRCxVQUFNLFlBQVksS0FBSyxlQUFlLEtBQUssTUFBTSxhQUFhLEtBQUssTUFBTSxLQUFLLElBQUk7QUFDbEYsV0FBTyxPQUFPLE9BQU8sV0FBVyxTQUFTO0FBQUEsRUFDMUM7QUFBQSxFQUVRLGFBQWEsTUFBd0I7QUFDNUMsUUFBSSxDQUFDLE1BQU07QUFDVixhQUFPO0FBQUEsSUFDUjtBQUNBLFFBQUksTUFBTSxLQUFLO0FBQ2YsV0FBTyxTQUFTLEtBQUssTUFBTTtBQUMxQixVQUFJLEtBQUssT0FBTyxVQUFVLE1BQU07QUFDL0IsZUFBTyxLQUFLLE9BQU8sWUFBWSxLQUFLLE9BQU8sTUFBTTtBQUFBLE1BQ2xEO0FBRUEsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBLEVBS1Esa0JBQWtCO0FBQ3pCLFdBQU8sRUFBRSxLQUFLLGtCQUFrQixLQUFLLFNBQVM7QUFBQSxFQUMvQztBQUFBLEVBRVEsWUFBWSxLQUFpQztBQUNwRCxRQUFJLE9BQU8sUUFBUSxVQUFVO0FBQzVCLGFBQU8sSUFBSSxXQUFXLENBQUMsTUFBTTtBQUFBLElBQzlCO0FBRUEsUUFBSSxRQUFRLFlBQVksSUFBSSxNQUFNLGdCQUFnQixHQUFHO0FBQ3BELGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxRQUFRLElBQUk7QUFDbEIsVUFBTSxhQUFhLEtBQUssU0FBUyxNQUFNLFdBQVcsRUFBRTtBQUNwRCxVQUFNLE9BQU8sTUFBTSxNQUFNO0FBQ3pCLFVBQU0sY0FBYyxXQUFXLElBQUksSUFBSSxNQUFNLE1BQU07QUFDbkQsUUFBSSxTQUFTLFdBQVcsU0FBUyxHQUFHO0FBRW5DLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxpQkFBaUIsV0FBVyxPQUFPLENBQUM7QUFDMUMsUUFBSSxpQkFBaUIsY0FBYyxHQUFHO0FBQ3JDLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTyxLQUFLLFNBQVMsTUFBTSxXQUFXLEVBQUUsT0FBTyxXQUFXLFdBQVcsTUFBTTtBQUFBLEVBQzVFO0FBQUEsRUFFUSxVQUFVLEtBQWlDO0FBQ2xELFFBQUksT0FBTyxRQUFRLFVBQVU7QUFDNUIsYUFBTyxJQUFJLFdBQVcsSUFBSSxTQUFTLENBQUMsTUFBTTtBQUFBLElBQzNDO0FBRUEsUUFBSSxRQUFRLFlBQVksSUFBSSxNQUFNLGdCQUFnQixHQUFHO0FBQ3BELGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLGVBQWUsS0FBSyxJQUFJLE1BQU0sU0FBUyxDQUFDLE1BQU07QUFBQSxFQUMzRDtBQUFBLEVBRVEseUJBQXlCLFVBQW9CO0FBQ3BELFFBQUksS0FBSyxnQkFBZ0IsS0FBSyxLQUFLLFlBQVksUUFBUSxHQUFHO0FBQ3pELFlBQU0sT0FBTyxTQUFTLEtBQUs7QUFDM0IsVUFBSSxLQUFLLFVBQVUsSUFBSSxHQUFHO0FBQ3pCLGFBQUssUUFBUSxNQUFNLFFBQVE7QUFBQSxNQUM1QjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSx5QkFBeUIsTUFBZ0I7QUFDaEQsUUFBSSxLQUFLLGdCQUFnQixLQUFLLEtBQUssVUFBVSxJQUFJLEdBQUc7QUFDbkQsWUFBTSxXQUFXLEtBQUssS0FBSztBQUMzQixVQUFJLEtBQUssWUFBWSxRQUFRLEdBQUc7QUFDL0IsYUFBSyxRQUFRLE1BQU0sUUFBUTtBQUFBLE1BQzVCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLFFBQVEsTUFBZ0IsTUFBZ0I7QUFDL0MsVUFBTSxhQUF5QixDQUFDO0FBRWhDLFVBQU0sYUFBYSxLQUFLLFNBQVMsS0FBSyxNQUFNLFdBQVcsRUFBRTtBQUN6RCxRQUFJO0FBQ0osUUFBSSxLQUFLLE1BQU0sSUFBSSxXQUFXLEdBQUc7QUFFaEMsZUFBUyxFQUFFLE1BQU0sS0FBSyxNQUFNLElBQUksT0FBTyxHQUFHLFFBQVEsV0FBVyxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksV0FBVyxLQUFLLE1BQU0sSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFO0FBQUEsSUFDN0gsT0FBTztBQUVOLGVBQVMsRUFBRSxNQUFNLEtBQUssTUFBTSxJQUFJLE1BQU0sUUFBUSxLQUFLLE1BQU0sSUFBSSxTQUFTLEVBQUU7QUFBQSxJQUN6RTtBQUVBLFVBQU0sZ0JBQWdCLEtBQUssTUFBTSxTQUFTO0FBQzFDLFVBQU0sZUFBZSxLQUFLLE1BQU0sY0FBYztBQUM5QyxTQUFLLFFBQVEsSUFBSTtBQUFBLE1BQ2hCLEtBQUssTUFBTTtBQUFBLE1BQ1gsS0FBSyxNQUFNO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBLHVCQUFtQixNQUFNLE1BQU0sSUFBSyxFQUFFO0FBQ3RDLFFBQUksS0FBSyxNQUFNLFdBQVcsR0FBRztBQUM1QixpQkFBVyxLQUFLLElBQUk7QUFBQSxJQUNyQjtBQUdBLFVBQU0sV0FBeUIsRUFBRSxNQUFNLEtBQUssTUFBTSxNQUFNLE9BQU8sR0FBRyxRQUFRLEVBQUU7QUFDNUUsVUFBTSxZQUFZLEtBQUssTUFBTSxTQUFTO0FBQ3RDLFVBQU0saUJBQWlCLEtBQUssZUFBZSxLQUFLLE1BQU0sYUFBYSxVQUFVLEtBQUssTUFBTSxHQUFHO0FBQzNGLFNBQUssUUFBUSxJQUFJO0FBQUEsTUFDaEIsS0FBSyxNQUFNO0FBQUEsTUFDWDtBQUFBLE1BQ0EsS0FBSyxNQUFNO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUEsdUJBQW1CLE1BQU0sTUFBTSxJQUFLLEVBQUU7QUFDdEMsUUFBSSxLQUFLLE1BQU0sV0FBVyxHQUFHO0FBQzVCLGlCQUFXLEtBQUssSUFBSTtBQUFBLElBQ3JCO0FBR0EsVUFBTSxTQUFTLEtBQUssZ0JBQWdCLE1BQU07QUFDMUMsU0FBSyxjQUFjLE1BQU0sT0FBTyxDQUFDLENBQUM7QUFHbEMsYUFBUyxJQUFJLEdBQUcsSUFBSSxXQUFXLFFBQVEsS0FBSztBQUMzQyxlQUFTLE1BQU0sV0FBVyxDQUFDLENBQUM7QUFBQSxJQUM3QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDZCQUE2QixPQUFlLE1BQXlCO0FBQzVFLFFBQUksS0FBSyxnQkFBZ0IsS0FBSyxLQUFLLFVBQVUsS0FBSyxHQUFHO0FBQ3BELFlBQU0sV0FBVyxLQUFLLEtBQUs7QUFDM0IsVUFBSSxLQUFLLFlBQVksUUFBUSxHQUFHO0FBRS9CLGlCQUFTO0FBRVQsWUFBSSxTQUFTLE1BQU0sV0FBVyxHQUFHO0FBQ2hDLG1CQUFTLE1BQU0sUUFBUTtBQUFBLFFBQ3hCLE9BQU87QUFFTixnQkFBTSxRQUFRLFNBQVM7QUFDdkIsZ0JBQU0sV0FBeUIsRUFBRSxNQUFNLE1BQU0sTUFBTSxPQUFPLEdBQUcsUUFBUSxFQUFFO0FBQ3ZFLGdCQUFNLFlBQVksTUFBTSxTQUFTO0FBQ2pDLGdCQUFNLGlCQUFpQixLQUFLLGVBQWUsTUFBTSxhQUFhLFVBQVUsTUFBTSxHQUFHO0FBQ2pGLG1CQUFTLFFBQVEsSUFBSTtBQUFBLFlBQ3BCLE1BQU07QUFBQSxZQUNOO0FBQUEsWUFDQSxNQUFNO0FBQUEsWUFDTjtBQUFBLFlBQ0E7QUFBQSxVQUNEO0FBRUEsNkJBQW1CLE1BQU0sVUFBVSxJQUFJLEVBQUU7QUFBQSxRQUMxQztBQUNBLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxRQUFRLE1BQWdCLFVBQWdEO0FBQ3ZFLFFBQUksU0FBUyxVQUFVO0FBQ3RCLGFBQU8sU0FBUyxRQUFRO0FBQUEsSUFDekI7QUFFQSxVQUFNLFVBQVUsS0FBSyxRQUFRLEtBQUssTUFBTSxRQUFRO0FBQ2hELFFBQUksQ0FBQyxTQUFTO0FBQ2IsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLFNBQVMsSUFBSSxLQUFLLEtBQUssUUFBUSxLQUFLLE9BQU8sUUFBUTtBQUFBLEVBQzNEO0FBQUEsRUFFUSxlQUFlLE1BQWdCO0FBQ3RDLFFBQUksU0FBUyxVQUFVO0FBQ3RCLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxTQUFTLEtBQUssU0FBUyxLQUFLLE1BQU0sV0FBVztBQUNuRCxVQUFNLFFBQVEsS0FBSztBQUNuQixVQUFNLGNBQWMsS0FBSyxlQUFlLE1BQU0sYUFBYSxNQUFNLEtBQUs7QUFDdEUsVUFBTSxZQUFZLEtBQUssZUFBZSxNQUFNLGFBQWEsTUFBTSxHQUFHO0FBQ2xFLFVBQU0saUJBQWlCLE9BQU8sT0FBTyxVQUFVLGFBQWEsU0FBUztBQUNyRSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsZ0JBQWdCLE9BQWM7QUFDN0IsVUFBTSxTQUFTLEtBQUssU0FBUyxNQUFNLFdBQVc7QUFDOUMsVUFBTSxjQUFjLEtBQUssZUFBZSxNQUFNLGFBQWEsTUFBTSxLQUFLO0FBQ3RFLFVBQU0sWUFBWSxLQUFLLGVBQWUsTUFBTSxhQUFhLE1BQU0sR0FBRztBQUNsRSxVQUFNLGlCQUFpQixPQUFPLE9BQU8sVUFBVSxhQUFhLFNBQVM7QUFDckUsV0FBTztBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBU1EsY0FBYyxNQUF1QixHQUFvQjtBQUNoRSxVQUFNLElBQUksSUFBSSxTQUFTLEdBQUcsVUFBVSxHQUFHO0FBQ3ZDLE1BQUUsT0FBTztBQUNULE1BQUUsUUFBUTtBQUNWLE1BQUUsU0FBUztBQUNYLE1BQUUsWUFBWTtBQUNkLE1BQUUsVUFBVTtBQUVaLFVBQU0sSUFBSSxLQUFLO0FBQ2YsUUFBSSxNQUFNLFVBQVU7QUFDbkIsV0FBSyxPQUFPO0FBQ1osUUFBRSxRQUFRLFVBQVU7QUFBQSxJQUNyQixXQUFXLEtBQU0sVUFBVSxVQUFVO0FBQ3BDLFdBQU0sUUFBUTtBQUNkLFFBQUUsU0FBUztBQUFBLElBQ1osT0FBTztBQUNOLFlBQU0sV0FBVyxRQUFRLEtBQU0sS0FBSztBQUNwQyxlQUFTLE9BQU87QUFDaEIsUUFBRSxTQUFTO0FBQUEsSUFDWjtBQUVBLGNBQVUsTUFBTSxDQUFDO0FBQ2pCLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVNRLGFBQWEsTUFBdUIsR0FBb0I7QUFDL0QsVUFBTSxJQUFJLElBQUksU0FBUyxHQUFHLFVBQVUsR0FBRztBQUN2QyxNQUFFLE9BQU87QUFDVCxNQUFFLFFBQVE7QUFDVixNQUFFLFNBQVM7QUFDWCxNQUFFLFlBQVk7QUFDZCxNQUFFLFVBQVU7QUFFWixRQUFJLEtBQUssU0FBUyxVQUFVO0FBQzNCLFdBQUssT0FBTztBQUNaLFFBQUUsUUFBUSxVQUFVO0FBQUEsSUFDckIsV0FBVyxLQUFNLFNBQVMsVUFBVTtBQUNuQyxXQUFNLE9BQU87QUFDYixRQUFFLFNBQVM7QUFBQSxJQUNaLE9BQU87QUFDTixZQUFNLFdBQVcsVUFBVSxLQUFNLElBQUk7QUFDckMsZUFBUyxRQUFRO0FBQ2pCLFFBQUUsU0FBUztBQUFBLElBQ1o7QUFFQSxjQUFVLE1BQU0sQ0FBQztBQUNqQixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsb0JBQW9CLE1BQXdCO0FBQ25ELFFBQUksTUFBTTtBQUVWLFNBQUssUUFBUSxNQUFNLENBQUFDLFVBQVE7QUFDMUIsYUFBTyxLQUFLLGVBQWVBLEtBQUk7QUFDL0IsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUVELFdBQU87QUFBQSxFQUNSO0FBQUE7QUFFRDsiLAogICJuYW1lcyI6IFsiYnVmZmVyIiwgInN0YXJ0T2Zmc2V0IiwgInN0YXJ0Q29sdW1uIiwgInN0YXJ0U3BsaXRQb3NJbkJ1ZmZlciIsICJlbmRTcGxpdFBvc0luQnVmZmVyIiwgImxpbmVTdGFydHMiLCAibm9kZVN0YXJ0T2Zmc2V0IiwgIm5vZGUiXQp9Cg==
