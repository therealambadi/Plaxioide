import { CharCode } from "../../../base/common/charCode.js";
import * as strings from "../../../base/common/strings.js";
import { SelectionStartKind, SingleCursorState } from "../cursorCommon.js";
import { DeleteOperations } from "./cursorDeleteOperations.js";
import { WordCharacterClass, getMapForWordSeparators } from "../core/wordCharacterClassifier.js";
import { Position } from "../core/position.js";
import { Range } from "../core/range.js";
var WordType = /* @__PURE__ */ ((WordType2) => {
  WordType2[WordType2["None"] = 0] = "None";
  WordType2[WordType2["Regular"] = 1] = "Regular";
  WordType2[WordType2["Separator"] = 2] = "Separator";
  return WordType2;
})(WordType || {});
var WordNavigationType = /* @__PURE__ */ ((WordNavigationType2) => {
  WordNavigationType2[WordNavigationType2["WordStart"] = 0] = "WordStart";
  WordNavigationType2[WordNavigationType2["WordStartFast"] = 1] = "WordStartFast";
  WordNavigationType2[WordNavigationType2["WordEnd"] = 2] = "WordEnd";
  WordNavigationType2[WordNavigationType2["WordAccessibility"] = 3] = "WordAccessibility";
  return WordNavigationType2;
})(WordNavigationType || {});
class WordOperations {
  static _createWord(lineContent, wordType, nextCharClass, start, end) {
    return { start, end, wordType, nextCharClass };
  }
  static _createIntlWord(intlWord, nextCharClass) {
    return { start: intlWord.index, end: intlWord.index + intlWord.segment.length, wordType: 1 /* Regular */, nextCharClass };
  }
  static _findPreviousWordOnLine(wordSeparators, model, position) {
    const lineContent = model.getLineContent(position.lineNumber);
    return this._doFindPreviousWordOnLine(lineContent, wordSeparators, position);
  }
  static _doFindPreviousWordOnLine(lineContent, wordSeparators, position) {
    let wordType = 0 /* None */;
    const previousIntlWord = wordSeparators.findPrevIntlWordBeforeOrAtOffset(lineContent, position.column - 2);
    for (let chIndex = position.column - 2; chIndex >= 0; chIndex--) {
      const chCode = lineContent.charCodeAt(chIndex);
      const chClass = wordSeparators.get(chCode);
      if (previousIntlWord && chIndex === previousIntlWord.index) {
        return this._createIntlWord(previousIntlWord, chClass);
      }
      if (chClass === WordCharacterClass.Regular) {
        if (wordType === 2 /* Separator */) {
          return this._createWord(lineContent, wordType, chClass, chIndex + 1, this._findEndOfWord(lineContent, wordSeparators, wordType, chIndex + 1));
        }
        wordType = 1 /* Regular */;
      } else if (chClass === WordCharacterClass.WordSeparator) {
        if (wordType === 1 /* Regular */) {
          return this._createWord(lineContent, wordType, chClass, chIndex + 1, this._findEndOfWord(lineContent, wordSeparators, wordType, chIndex + 1));
        }
        wordType = 2 /* Separator */;
      } else if (chClass === WordCharacterClass.Whitespace) {
        if (wordType !== 0 /* None */) {
          return this._createWord(lineContent, wordType, chClass, chIndex + 1, this._findEndOfWord(lineContent, wordSeparators, wordType, chIndex + 1));
        }
      }
    }
    if (wordType !== 0 /* None */) {
      return this._createWord(lineContent, wordType, WordCharacterClass.Whitespace, 0, this._findEndOfWord(lineContent, wordSeparators, wordType, 0));
    }
    return null;
  }
  static _findEndOfWord(lineContent, wordSeparators, wordType, startIndex) {
    const nextIntlWord = wordSeparators.findNextIntlWordAtOrAfterOffset(lineContent, startIndex);
    const len = lineContent.length;
    for (let chIndex = startIndex; chIndex < len; chIndex++) {
      const chCode = lineContent.charCodeAt(chIndex);
      const chClass = wordSeparators.get(chCode);
      if (nextIntlWord && chIndex === nextIntlWord.index + nextIntlWord.segment.length) {
        return chIndex;
      }
      if (chClass === WordCharacterClass.Whitespace) {
        return chIndex;
      }
      if (wordType === 1 /* Regular */ && chClass === WordCharacterClass.WordSeparator) {
        return chIndex;
      }
      if (wordType === 2 /* Separator */ && chClass === WordCharacterClass.Regular) {
        return chIndex;
      }
    }
    return len;
  }
  static _findNextWordOnLine(wordSeparators, model, position) {
    const lineContent = model.getLineContent(position.lineNumber);
    return this._doFindNextWordOnLine(lineContent, wordSeparators, position);
  }
  static _doFindNextWordOnLine(lineContent, wordSeparators, position) {
    let wordType = 0 /* None */;
    const len = lineContent.length;
    const nextIntlWord = wordSeparators.findNextIntlWordAtOrAfterOffset(lineContent, position.column - 1);
    for (let chIndex = position.column - 1; chIndex < len; chIndex++) {
      const chCode = lineContent.charCodeAt(chIndex);
      const chClass = wordSeparators.get(chCode);
      if (nextIntlWord && chIndex === nextIntlWord.index) {
        return this._createIntlWord(nextIntlWord, chClass);
      }
      if (chClass === WordCharacterClass.Regular) {
        if (wordType === 2 /* Separator */) {
          return this._createWord(lineContent, wordType, chClass, this._findStartOfWord(lineContent, wordSeparators, wordType, chIndex - 1), chIndex);
        }
        wordType = 1 /* Regular */;
      } else if (chClass === WordCharacterClass.WordSeparator) {
        if (wordType === 1 /* Regular */) {
          return this._createWord(lineContent, wordType, chClass, this._findStartOfWord(lineContent, wordSeparators, wordType, chIndex - 1), chIndex);
        }
        wordType = 2 /* Separator */;
      } else if (chClass === WordCharacterClass.Whitespace) {
        if (wordType !== 0 /* None */) {
          return this._createWord(lineContent, wordType, chClass, this._findStartOfWord(lineContent, wordSeparators, wordType, chIndex - 1), chIndex);
        }
      }
    }
    if (wordType !== 0 /* None */) {
      return this._createWord(lineContent, wordType, WordCharacterClass.Whitespace, this._findStartOfWord(lineContent, wordSeparators, wordType, len - 1), len);
    }
    return null;
  }
  static _findStartOfWord(lineContent, wordSeparators, wordType, startIndex) {
    const previousIntlWord = wordSeparators.findPrevIntlWordBeforeOrAtOffset(lineContent, startIndex);
    for (let chIndex = startIndex; chIndex >= 0; chIndex--) {
      const chCode = lineContent.charCodeAt(chIndex);
      const chClass = wordSeparators.get(chCode);
      if (previousIntlWord && chIndex === previousIntlWord.index) {
        return chIndex;
      }
      if (chClass === WordCharacterClass.Whitespace) {
        return chIndex + 1;
      }
      if (wordType === 1 /* Regular */ && chClass === WordCharacterClass.WordSeparator) {
        return chIndex + 1;
      }
      if (wordType === 2 /* Separator */ && chClass === WordCharacterClass.Regular) {
        return chIndex + 1;
      }
    }
    return 0;
  }
  static moveWordLeft(wordSeparators, model, position, wordNavigationType, hasMulticursor) {
    let lineNumber = position.lineNumber;
    let column = position.column;
    if (column === 1) {
      if (lineNumber > 1) {
        lineNumber = lineNumber - 1;
        column = model.getLineMaxColumn(lineNumber);
      }
    }
    let prevWordOnLine = WordOperations._findPreviousWordOnLine(wordSeparators, model, new Position(lineNumber, column));
    if (wordNavigationType === 0 /* WordStart */) {
      return new Position(lineNumber, prevWordOnLine ? prevWordOnLine.start + 1 : 1);
    }
    if (wordNavigationType === 1 /* WordStartFast */) {
      if (!hasMulticursor && prevWordOnLine && prevWordOnLine.wordType === 2 /* Separator */ && prevWordOnLine.end - prevWordOnLine.start === 1 && prevWordOnLine.nextCharClass === WordCharacterClass.Regular) {
        prevWordOnLine = WordOperations._findPreviousWordOnLine(wordSeparators, model, new Position(lineNumber, prevWordOnLine.start + 1));
      }
      return new Position(lineNumber, prevWordOnLine ? prevWordOnLine.start + 1 : 1);
    }
    if (wordNavigationType === 3 /* WordAccessibility */) {
      while (prevWordOnLine && prevWordOnLine.wordType === 2 /* Separator */) {
        prevWordOnLine = WordOperations._findPreviousWordOnLine(wordSeparators, model, new Position(lineNumber, prevWordOnLine.start + 1));
      }
      return new Position(lineNumber, prevWordOnLine ? prevWordOnLine.start + 1 : 1);
    }
    if (prevWordOnLine && column <= prevWordOnLine.end + 1) {
      prevWordOnLine = WordOperations._findPreviousWordOnLine(wordSeparators, model, new Position(lineNumber, prevWordOnLine.start + 1));
    }
    return new Position(lineNumber, prevWordOnLine ? prevWordOnLine.end + 1 : 1);
  }
  static _moveWordPartLeft(model, position) {
    const lineNumber = position.lineNumber;
    const maxColumn = model.getLineMaxColumn(lineNumber);
    if (position.column === 1) {
      return lineNumber > 1 ? new Position(lineNumber - 1, model.getLineMaxColumn(lineNumber - 1)) : position;
    }
    const lineContent = model.getLineContent(lineNumber);
    for (let column = position.column - 1; column > 1; column--) {
      const left = lineContent.charCodeAt(column - 2);
      const right = lineContent.charCodeAt(column - 1);
      if (left === CharCode.Underline && right !== CharCode.Underline) {
        return new Position(lineNumber, column);
      }
      if (left === CharCode.Dash && right !== CharCode.Dash) {
        return new Position(lineNumber, column);
      }
      if ((strings.isLowerAsciiLetter(left) || strings.isAsciiDigit(left)) && strings.isUpperAsciiLetter(right)) {
        return new Position(lineNumber, column);
      }
      if (strings.isUpperAsciiLetter(left) && strings.isUpperAsciiLetter(right)) {
        if (column + 1 < maxColumn) {
          const rightRight = lineContent.charCodeAt(column);
          if (strings.isLowerAsciiLetter(rightRight) || strings.isAsciiDigit(rightRight)) {
            return new Position(lineNumber, column);
          }
        }
      }
    }
    return new Position(lineNumber, 1);
  }
  static moveWordRight(wordSeparators, model, position, wordNavigationType) {
    let lineNumber = position.lineNumber;
    let column = position.column;
    let movedDown = false;
    if (column === model.getLineMaxColumn(lineNumber)) {
      if (lineNumber < model.getLineCount()) {
        movedDown = true;
        lineNumber = lineNumber + 1;
        column = 1;
      }
    }
    let nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, new Position(lineNumber, column));
    if (wordNavigationType === 2 /* WordEnd */) {
      if (nextWordOnLine && nextWordOnLine.wordType === 2 /* Separator */) {
        if (nextWordOnLine.end - nextWordOnLine.start === 1 && nextWordOnLine.nextCharClass === WordCharacterClass.Regular) {
          nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, new Position(lineNumber, nextWordOnLine.end + 1));
        }
      }
      if (nextWordOnLine) {
        column = nextWordOnLine.end + 1;
      } else {
        column = model.getLineMaxColumn(lineNumber);
      }
    } else if (wordNavigationType === 3 /* WordAccessibility */) {
      if (movedDown) {
        column = 0;
      }
      while (nextWordOnLine && (nextWordOnLine.wordType === 2 /* Separator */ || nextWordOnLine.start + 1 <= column)) {
        nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, new Position(lineNumber, nextWordOnLine.end + 1));
      }
      if (nextWordOnLine) {
        column = nextWordOnLine.start + 1;
      } else {
        column = model.getLineMaxColumn(lineNumber);
      }
    } else {
      if (nextWordOnLine && !movedDown && column >= nextWordOnLine.start + 1) {
        nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, new Position(lineNumber, nextWordOnLine.end + 1));
      }
      if (nextWordOnLine) {
        column = nextWordOnLine.start + 1;
      } else {
        column = model.getLineMaxColumn(lineNumber);
      }
    }
    return new Position(lineNumber, column);
  }
  static _moveWordPartRight(model, position) {
    const lineNumber = position.lineNumber;
    const maxColumn = model.getLineMaxColumn(lineNumber);
    if (position.column === maxColumn) {
      return lineNumber < model.getLineCount() ? new Position(lineNumber + 1, 1) : position;
    }
    const lineContent = model.getLineContent(lineNumber);
    for (let column = position.column + 1; column < maxColumn; column++) {
      const left = lineContent.charCodeAt(column - 2);
      const right = lineContent.charCodeAt(column - 1);
      if (left !== CharCode.Underline && right === CharCode.Underline) {
        return new Position(lineNumber, column);
      }
      if (left !== CharCode.Dash && right === CharCode.Dash) {
        return new Position(lineNumber, column);
      }
      if ((strings.isLowerAsciiLetter(left) || strings.isAsciiDigit(left)) && strings.isUpperAsciiLetter(right)) {
        return new Position(lineNumber, column);
      }
      if (strings.isUpperAsciiLetter(left) && strings.isUpperAsciiLetter(right)) {
        if (column + 1 < maxColumn) {
          const rightRight = lineContent.charCodeAt(column);
          if (strings.isLowerAsciiLetter(rightRight) || strings.isAsciiDigit(rightRight)) {
            return new Position(lineNumber, column);
          }
        }
      }
    }
    return new Position(lineNumber, maxColumn);
  }
  static _deleteWordLeftWhitespace(model, position) {
    const lineContent = model.getLineContent(position.lineNumber);
    const startIndex = position.column - 2;
    const lastNonWhitespace = strings.lastNonWhitespaceIndex(lineContent, startIndex);
    if (lastNonWhitespace + 1 < startIndex) {
      return new Range(position.lineNumber, lastNonWhitespace + 2, position.lineNumber, position.column);
    }
    return null;
  }
  static deleteWordLeft(ctx, wordNavigationType) {
    const wordSeparators = ctx.wordSeparators;
    const model = ctx.model;
    const selection = ctx.selection;
    const whitespaceHeuristics = ctx.whitespaceHeuristics;
    if (!selection.isEmpty()) {
      return selection;
    }
    if (DeleteOperations.isAutoClosingPairDelete(ctx.autoClosingDelete, ctx.autoClosingBrackets, ctx.autoClosingQuotes, ctx.autoClosingPairs.autoClosingPairsOpenByEnd, ctx.model, [ctx.selection], ctx.autoClosedCharacters)) {
      const position2 = ctx.selection.getPosition();
      return new Range(position2.lineNumber, position2.column - 1, position2.lineNumber, position2.column + 1);
    }
    const position = new Position(selection.positionLineNumber, selection.positionColumn);
    let lineNumber = position.lineNumber;
    let column = position.column;
    if (lineNumber === 1 && column === 1) {
      return null;
    }
    if (whitespaceHeuristics) {
      const r = this._deleteWordLeftWhitespace(model, position);
      if (r) {
        return r;
      }
    }
    let prevWordOnLine = WordOperations._findPreviousWordOnLine(wordSeparators, model, position);
    if (wordNavigationType === 0 /* WordStart */) {
      if (prevWordOnLine) {
        column = prevWordOnLine.start + 1;
      } else {
        if (column > 1) {
          column = 1;
        } else {
          lineNumber--;
          column = model.getLineMaxColumn(lineNumber);
        }
      }
    } else {
      if (prevWordOnLine && column <= prevWordOnLine.end + 1) {
        prevWordOnLine = WordOperations._findPreviousWordOnLine(wordSeparators, model, new Position(lineNumber, prevWordOnLine.start + 1));
      }
      if (prevWordOnLine) {
        column = prevWordOnLine.end + 1;
      } else {
        if (column > 1) {
          column = 1;
        } else {
          lineNumber--;
          column = model.getLineMaxColumn(lineNumber);
        }
      }
    }
    return new Range(lineNumber, column, position.lineNumber, position.column);
  }
  static deleteInsideWord(wordSeparators, model, selection) {
    if (!selection.isEmpty()) {
      return selection;
    }
    const position = new Position(selection.positionLineNumber, selection.positionColumn);
    const r = this._deleteInsideWordWhitespace(model, position);
    if (r) {
      return r;
    }
    return this._deleteInsideWordDetermineDeleteRange(wordSeparators, model, position);
  }
  static _charAtIsWhitespace(str, index) {
    const charCode = str.charCodeAt(index);
    return charCode === CharCode.Space || charCode === CharCode.Tab;
  }
  static _deleteInsideWordWhitespace(model, position) {
    const lineContent = model.getLineContent(position.lineNumber);
    const lineContentLength = lineContent.length;
    if (lineContentLength === 0) {
      return null;
    }
    let leftIndex = Math.max(position.column - 2, 0);
    if (!this._charAtIsWhitespace(lineContent, leftIndex)) {
      return null;
    }
    let rightIndex = Math.min(position.column - 1, lineContentLength - 1);
    if (!this._charAtIsWhitespace(lineContent, rightIndex)) {
      return null;
    }
    while (leftIndex > 0 && this._charAtIsWhitespace(lineContent, leftIndex - 1)) {
      leftIndex--;
    }
    while (rightIndex + 1 < lineContentLength && this._charAtIsWhitespace(lineContent, rightIndex + 1)) {
      rightIndex++;
    }
    return new Range(position.lineNumber, leftIndex + 1, position.lineNumber, rightIndex + 2);
  }
  static _deleteInsideWordDetermineDeleteRange(wordSeparators, model, position) {
    const lineContent = model.getLineContent(position.lineNumber);
    const lineLength = lineContent.length;
    if (lineLength === 0) {
      if (position.lineNumber > 1) {
        return new Range(position.lineNumber - 1, model.getLineMaxColumn(position.lineNumber - 1), position.lineNumber, 1);
      } else {
        if (position.lineNumber < model.getLineCount()) {
          return new Range(position.lineNumber, 1, position.lineNumber + 1, 1);
        } else {
          return new Range(position.lineNumber, 1, position.lineNumber, 1);
        }
      }
    }
    const touchesWord = (word) => {
      return word.start + 1 <= position.column && position.column <= word.end + 1;
    };
    const createRangeWithPosition = (startColumn, endColumn) => {
      startColumn = Math.min(startColumn, position.column);
      endColumn = Math.max(endColumn, position.column);
      return new Range(position.lineNumber, startColumn, position.lineNumber, endColumn);
    };
    const deleteWordAndAdjacentWhitespace = (word) => {
      let startColumn = word.start + 1;
      let endColumn = word.end + 1;
      let expandedToTheRight = false;
      while (endColumn - 1 < lineLength && this._charAtIsWhitespace(lineContent, endColumn - 1)) {
        expandedToTheRight = true;
        endColumn++;
      }
      if (!expandedToTheRight) {
        while (startColumn > 1 && this._charAtIsWhitespace(lineContent, startColumn - 2)) {
          startColumn--;
        }
      }
      return createRangeWithPosition(startColumn, endColumn);
    };
    const prevWordOnLine = WordOperations._findPreviousWordOnLine(wordSeparators, model, position);
    if (prevWordOnLine && touchesWord(prevWordOnLine)) {
      return deleteWordAndAdjacentWhitespace(prevWordOnLine);
    }
    const nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, position);
    if (nextWordOnLine && touchesWord(nextWordOnLine)) {
      return deleteWordAndAdjacentWhitespace(nextWordOnLine);
    }
    if (prevWordOnLine && nextWordOnLine) {
      return createRangeWithPosition(prevWordOnLine.end + 1, nextWordOnLine.start + 1);
    }
    if (prevWordOnLine) {
      return createRangeWithPosition(prevWordOnLine.start + 1, prevWordOnLine.end + 1);
    }
    if (nextWordOnLine) {
      return createRangeWithPosition(nextWordOnLine.start + 1, nextWordOnLine.end + 1);
    }
    return createRangeWithPosition(1, lineLength + 1);
  }
  static _deleteWordPartLeft(model, selection) {
    if (!selection.isEmpty()) {
      return selection;
    }
    const pos = selection.getPosition();
    const toPosition = WordOperations._moveWordPartLeft(model, pos);
    return new Range(pos.lineNumber, pos.column, toPosition.lineNumber, toPosition.column);
  }
  static _findFirstNonWhitespaceChar(str, startIndex) {
    const len = str.length;
    for (let chIndex = startIndex; chIndex < len; chIndex++) {
      const ch = str.charAt(chIndex);
      if (ch !== " " && ch !== "	") {
        return chIndex;
      }
    }
    return len;
  }
  static _deleteWordRightWhitespace(model, position) {
    const lineContent = model.getLineContent(position.lineNumber);
    const startIndex = position.column - 1;
    const firstNonWhitespace = this._findFirstNonWhitespaceChar(lineContent, startIndex);
    if (startIndex + 1 < firstNonWhitespace) {
      return new Range(position.lineNumber, position.column, position.lineNumber, firstNonWhitespace + 1);
    }
    return null;
  }
  static deleteWordRight(ctx, wordNavigationType) {
    const wordSeparators = ctx.wordSeparators;
    const model = ctx.model;
    const selection = ctx.selection;
    const whitespaceHeuristics = ctx.whitespaceHeuristics;
    if (!selection.isEmpty()) {
      return selection;
    }
    const position = new Position(selection.positionLineNumber, selection.positionColumn);
    let lineNumber = position.lineNumber;
    let column = position.column;
    const lineCount = model.getLineCount();
    const maxColumn = model.getLineMaxColumn(lineNumber);
    if (lineNumber === lineCount && column === maxColumn) {
      return null;
    }
    if (whitespaceHeuristics) {
      const r = this._deleteWordRightWhitespace(model, position);
      if (r) {
        return r;
      }
    }
    let nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, position);
    if (wordNavigationType === 2 /* WordEnd */) {
      if (nextWordOnLine) {
        column = nextWordOnLine.end + 1;
      } else {
        if (column < maxColumn || lineNumber === lineCount) {
          column = maxColumn;
        } else {
          lineNumber++;
          nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, new Position(lineNumber, 1));
          if (nextWordOnLine) {
            column = nextWordOnLine.start + 1;
          } else {
            column = model.getLineMaxColumn(lineNumber);
          }
        }
      }
    } else {
      if (nextWordOnLine && column >= nextWordOnLine.start + 1) {
        nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, new Position(lineNumber, nextWordOnLine.end + 1));
      }
      if (nextWordOnLine) {
        column = nextWordOnLine.start + 1;
      } else {
        if (column < maxColumn || lineNumber === lineCount) {
          column = maxColumn;
        } else {
          lineNumber++;
          nextWordOnLine = WordOperations._findNextWordOnLine(wordSeparators, model, new Position(lineNumber, 1));
          if (nextWordOnLine) {
            column = nextWordOnLine.start + 1;
          } else {
            column = model.getLineMaxColumn(lineNumber);
          }
        }
      }
    }
    return new Range(lineNumber, column, position.lineNumber, position.column);
  }
  static _deleteWordPartRight(model, selection) {
    if (!selection.isEmpty()) {
      return selection;
    }
    const pos = selection.getPosition();
    const toPosition = WordOperations._moveWordPartRight(model, pos);
    return new Range(pos.lineNumber, pos.column, toPosition.lineNumber, toPosition.column);
  }
  static _createWordAtPosition(model, lineNumber, word) {
    const range = new Range(lineNumber, word.start + 1, lineNumber, word.end + 1);
    return {
      word: model.getValueInRange(range),
      startColumn: range.startColumn,
      endColumn: range.endColumn
    };
  }
  static getWordAtPosition(model, _wordSeparators, _intlSegmenterLocales, position) {
    const wordSeparators = getMapForWordSeparators(_wordSeparators, _intlSegmenterLocales);
    const prevWord = WordOperations._findPreviousWordOnLine(wordSeparators, model, position);
    if (prevWord && prevWord.wordType === 1 /* Regular */ && prevWord.start <= position.column - 1 && position.column - 1 <= prevWord.end) {
      return WordOperations._createWordAtPosition(model, position.lineNumber, prevWord);
    }
    const nextWord = WordOperations._findNextWordOnLine(wordSeparators, model, position);
    if (nextWord && nextWord.wordType === 1 /* Regular */ && nextWord.start <= position.column - 1 && position.column - 1 <= nextWord.end) {
      return WordOperations._createWordAtPosition(model, position.lineNumber, nextWord);
    }
    return null;
  }
  static word(config, model, cursor, inSelectionMode, position) {
    const wordSeparators = getMapForWordSeparators(config.wordSeparators, config.wordSegmenterLocales);
    const prevWord = WordOperations._findPreviousWordOnLine(wordSeparators, model, position);
    const nextWord = WordOperations._findNextWordOnLine(wordSeparators, model, position);
    if (!inSelectionMode) {
      let startColumn2;
      let endColumn2;
      if (prevWord && prevWord.wordType === 1 /* Regular */ && prevWord.start <= position.column - 1 && position.column - 1 <= prevWord.end) {
        startColumn2 = prevWord.start + 1;
        endColumn2 = prevWord.end + 1;
      } else if (nextWord && nextWord.wordType === 1 /* Regular */ && nextWord.start <= position.column - 1 && position.column - 1 <= nextWord.end) {
        startColumn2 = nextWord.start + 1;
        endColumn2 = nextWord.end + 1;
      } else {
        if (prevWord) {
          startColumn2 = prevWord.end + 1;
        } else {
          startColumn2 = 1;
        }
        if (nextWord) {
          endColumn2 = nextWord.start + 1;
        } else {
          endColumn2 = model.getLineMaxColumn(position.lineNumber);
        }
      }
      return new SingleCursorState(
        new Range(position.lineNumber, startColumn2, position.lineNumber, endColumn2),
        SelectionStartKind.Word,
        0,
        new Position(position.lineNumber, endColumn2),
        0
      );
    }
    let startColumn;
    let endColumn;
    if (prevWord && prevWord.wordType === 1 /* Regular */ && prevWord.start < position.column - 1 && position.column - 1 < prevWord.end) {
      startColumn = prevWord.start + 1;
      endColumn = prevWord.end + 1;
    } else if (nextWord && nextWord.wordType === 1 /* Regular */ && nextWord.start < position.column - 1 && position.column - 1 < nextWord.end) {
      startColumn = nextWord.start + 1;
      endColumn = nextWord.end + 1;
    } else {
      startColumn = position.column;
      endColumn = position.column;
    }
    const lineNumber = position.lineNumber;
    let column;
    if (cursor.selectionStart.containsPosition(position)) {
      column = cursor.selectionStart.endColumn;
    } else if (position.isBeforeOrEqual(cursor.selectionStart.getStartPosition())) {
      column = startColumn;
      const possiblePosition = new Position(lineNumber, column);
      if (cursor.selectionStart.containsPosition(possiblePosition)) {
        column = cursor.selectionStart.endColumn;
      }
    } else {
      column = endColumn;
      const possiblePosition = new Position(lineNumber, column);
      if (cursor.selectionStart.containsPosition(possiblePosition)) {
        column = cursor.selectionStart.startColumn;
      }
    }
    return cursor.move(true, lineNumber, column, 0);
  }
}
class WordPartOperations extends WordOperations {
  static deleteWordPartLeft(ctx) {
    const candidates = enforceDefined([
      WordOperations.deleteWordLeft(ctx, 0 /* WordStart */),
      WordOperations.deleteWordLeft(ctx, 2 /* WordEnd */),
      WordOperations._deleteWordPartLeft(ctx.model, ctx.selection)
    ]);
    candidates.sort(Range.compareRangesUsingEnds);
    return candidates[2];
  }
  static deleteWordPartRight(ctx) {
    const candidates = enforceDefined([
      WordOperations.deleteWordRight(ctx, 0 /* WordStart */),
      WordOperations.deleteWordRight(ctx, 2 /* WordEnd */),
      WordOperations._deleteWordPartRight(ctx.model, ctx.selection)
    ]);
    candidates.sort(Range.compareRangesUsingStarts);
    return candidates[0];
  }
  static moveWordPartLeft(wordSeparators, model, position, hasMulticursor) {
    const candidates = enforceDefined([
      WordOperations.moveWordLeft(wordSeparators, model, position, 0 /* WordStart */, hasMulticursor),
      WordOperations.moveWordLeft(wordSeparators, model, position, 2 /* WordEnd */, hasMulticursor),
      WordOperations._moveWordPartLeft(model, position)
    ]);
    candidates.sort(Position.compare);
    return candidates[2];
  }
  static moveWordPartRight(wordSeparators, model, position) {
    const candidates = enforceDefined([
      WordOperations.moveWordRight(wordSeparators, model, position, 0 /* WordStart */),
      WordOperations.moveWordRight(wordSeparators, model, position, 2 /* WordEnd */),
      WordOperations._moveWordPartRight(model, position)
    ]);
    candidates.sort(Position.compare);
    return candidates[0];
  }
}
function enforceDefined(arr) {
  return arr.filter((el) => Boolean(el));
}
export {
  WordNavigationType,
  WordOperations,
  WordPartOperations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2N1cnNvci9jdXJzb3JXb3JkT3BlcmF0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IEVkaXRvckF1dG9DbG9zaW5nRWRpdFN0cmF0ZWd5LCBFZGl0b3JBdXRvQ2xvc2luZ1N0cmF0ZWd5IH0gZnJvbSAnLi4vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29uZmlndXJhdGlvbiwgSUN1cnNvclNpbXBsZU1vZGVsLCBTZWxlY3Rpb25TdGFydEtpbmQsIFNpbmdsZUN1cnNvclN0YXRlIH0gZnJvbSAnLi4vY3Vyc29yQ29tbW9uLmpzJztcbmltcG9ydCB7IERlbGV0ZU9wZXJhdGlvbnMgfSBmcm9tICcuL2N1cnNvckRlbGV0ZU9wZXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgV29yZENoYXJhY3RlckNsYXNzLCBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciwgSW50bFdvcmRTZWdtZW50RGF0YSwgZ2V0TWFwRm9yV29yZFNlcGFyYXRvcnMgfSBmcm9tICcuLi9jb3JlL3dvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uL21vZGVsLmpzJztcbmltcG9ydCB7IElXb3JkQXRQb3NpdGlvbiB9IGZyb20gJy4uL2NvcmUvd29yZEhlbHBlci5qcyc7XG5pbXBvcnQgeyBBdXRvQ2xvc2luZ1BhaXJzIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvbi5qcyc7XG5cbmludGVyZmFjZSBJRmluZFdvcmRSZXN1bHQge1xuXHQvKipcblx0ICogVGhlIGluZGV4IHdoZXJlIHRoZSB3b3JkIHN0YXJ0cy5cblx0ICovXG5cdHN0YXJ0OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBUaGUgaW5kZXggd2hlcmUgdGhlIHdvcmQgZW5kcy5cblx0ICovXG5cdGVuZDogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIHdvcmQgdHlwZS5cblx0ICovXG5cdHdvcmRUeXBlOiBXb3JkVHlwZTtcblx0LyoqXG5cdCAqIFRoZSByZWFzb24gdGhlIHdvcmQgZW5kZWQuXG5cdCAqL1xuXHRuZXh0Q2hhckNsYXNzOiBXb3JkQ2hhcmFjdGVyQ2xhc3M7XG59XG5cbmNvbnN0IGVudW0gV29yZFR5cGUge1xuXHROb25lID0gMCxcblx0UmVndWxhciA9IDEsXG5cdFNlcGFyYXRvciA9IDJcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gV29yZE5hdmlnYXRpb25UeXBlIHtcblx0V29yZFN0YXJ0ID0gMCxcblx0V29yZFN0YXJ0RmFzdCA9IDEsXG5cdFdvcmRFbmQgPSAyLFxuXHRXb3JkQWNjZXNzaWJpbGl0eSA9IDMgLy8gUmVzcGVjdCBjaHJvbWUgZGVmaW5pdGlvbiBvZiBhIHdvcmRcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEZWxldGVXb3JkQ29udGV4dCB7XG5cdHdvcmRTZXBhcmF0b3JzOiBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllcjtcblx0bW9kZWw6IElUZXh0TW9kZWw7XG5cdHNlbGVjdGlvbjogU2VsZWN0aW9uO1xuXHR3aGl0ZXNwYWNlSGV1cmlzdGljczogYm9vbGVhbjtcblx0YXV0b0Nsb3NpbmdEZWxldGU6IEVkaXRvckF1dG9DbG9zaW5nRWRpdFN0cmF0ZWd5O1xuXHRhdXRvQ2xvc2luZ0JyYWNrZXRzOiBFZGl0b3JBdXRvQ2xvc2luZ1N0cmF0ZWd5O1xuXHRhdXRvQ2xvc2luZ1F1b3RlczogRWRpdG9yQXV0b0Nsb3NpbmdTdHJhdGVneTtcblx0YXV0b0Nsb3NpbmdQYWlyczogQXV0b0Nsb3NpbmdQYWlycztcblx0YXV0b0Nsb3NlZENoYXJhY3RlcnM6IFJhbmdlW107XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JkT3BlcmF0aW9ucyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NyZWF0ZVdvcmQobGluZUNvbnRlbnQ6IHN0cmluZywgd29yZFR5cGU6IFdvcmRUeXBlLCBuZXh0Q2hhckNsYXNzOiBXb3JkQ2hhcmFjdGVyQ2xhc3MsIHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyKTogSUZpbmRXb3JkUmVzdWx0IHtcblx0XHQvLyBjb25zb2xlLmxvZygnV09SRCA9PT4gJyArIHN0YXJ0ICsgJyA9PiAnICsgZW5kICsgJzo6OjogPDw8JyArIGxpbmVDb250ZW50LnN1YnN0cmluZyhzdGFydCwgZW5kKSArICc+Pj4nKTtcblx0XHRyZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kLCB3b3JkVHlwZTogd29yZFR5cGUsIG5leHRDaGFyQ2xhc3M6IG5leHRDaGFyQ2xhc3MgfTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jcmVhdGVJbnRsV29yZChpbnRsV29yZDogSW50bFdvcmRTZWdtZW50RGF0YSwgbmV4dENoYXJDbGFzczogV29yZENoYXJhY3RlckNsYXNzKTogSUZpbmRXb3JkUmVzdWx0IHtcblx0XHQvLyBjb25zb2xlLmxvZygnSU5UTCBXT1JEID09PiAnICsgaW50bFdvcmQuaW5kZXggKyAnID0+ICcgKyBpbnRsV29yZC5pbmRleCArIGludGxXb3JkLnNlZ21lbnQubGVuZ3RoICsgJzo6OjogPDw8JyArIGludGxXb3JkLnNlZ21lbnQgKyAnPj4+Jyk7XG5cdFx0cmV0dXJuIHsgc3RhcnQ6IGludGxXb3JkLmluZGV4LCBlbmQ6IGludGxXb3JkLmluZGV4ICsgaW50bFdvcmQuc2VnbWVudC5sZW5ndGgsIHdvcmRUeXBlOiBXb3JkVHlwZS5SZWd1bGFyLCBuZXh0Q2hhckNsYXNzOiBuZXh0Q2hhckNsYXNzIH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZmluZFByZXZpb3VzV29yZE9uTGluZSh3b3JkU2VwYXJhdG9yczogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbik6IElGaW5kV29yZFJlc3VsdCB8IG51bGwge1xuXHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0cmV0dXJuIHRoaXMuX2RvRmluZFByZXZpb3VzV29yZE9uTGluZShsaW5lQ29udGVudCwgd29yZFNlcGFyYXRvcnMsIHBvc2l0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9kb0ZpbmRQcmV2aW91c1dvcmRPbkxpbmUobGluZUNvbnRlbnQ6IHN0cmluZywgd29yZFNlcGFyYXRvcnM6IFdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLCBwb3NpdGlvbjogUG9zaXRpb24pOiBJRmluZFdvcmRSZXN1bHQgfCBudWxsIHtcblx0XHRsZXQgd29yZFR5cGUgPSBXb3JkVHlwZS5Ob25lO1xuXG5cdFx0Y29uc3QgcHJldmlvdXNJbnRsV29yZCA9IHdvcmRTZXBhcmF0b3JzLmZpbmRQcmV2SW50bFdvcmRCZWZvcmVPckF0T2Zmc2V0KGxpbmVDb250ZW50LCBwb3NpdGlvbi5jb2x1bW4gLSAyKTtcblxuXHRcdGZvciAobGV0IGNoSW5kZXggPSBwb3NpdGlvbi5jb2x1bW4gLSAyOyBjaEluZGV4ID49IDA7IGNoSW5kZXgtLSkge1xuXHRcdFx0Y29uc3QgY2hDb2RlID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjaEluZGV4KTtcblx0XHRcdGNvbnN0IGNoQ2xhc3MgPSB3b3JkU2VwYXJhdG9ycy5nZXQoY2hDb2RlKTtcblxuXHRcdFx0aWYgKHByZXZpb3VzSW50bFdvcmQgJiYgY2hJbmRleCA9PT0gcHJldmlvdXNJbnRsV29yZC5pbmRleCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlSW50bFdvcmQocHJldmlvdXNJbnRsV29yZCwgY2hDbGFzcyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjaENsYXNzID09PSBXb3JkQ2hhcmFjdGVyQ2xhc3MuUmVndWxhcikge1xuXHRcdFx0XHRpZiAod29yZFR5cGUgPT09IFdvcmRUeXBlLlNlcGFyYXRvcikge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVXb3JkKGxpbmVDb250ZW50LCB3b3JkVHlwZSwgY2hDbGFzcywgY2hJbmRleCArIDEsIHRoaXMuX2ZpbmRFbmRPZldvcmQobGluZUNvbnRlbnQsIHdvcmRTZXBhcmF0b3JzLCB3b3JkVHlwZSwgY2hJbmRleCArIDEpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3b3JkVHlwZSA9IFdvcmRUeXBlLlJlZ3VsYXI7XG5cdFx0XHR9IGVsc2UgaWYgKGNoQ2xhc3MgPT09IFdvcmRDaGFyYWN0ZXJDbGFzcy5Xb3JkU2VwYXJhdG9yKSB7XG5cdFx0XHRcdGlmICh3b3JkVHlwZSA9PT0gV29yZFR5cGUuUmVndWxhcikge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVXb3JkKGxpbmVDb250ZW50LCB3b3JkVHlwZSwgY2hDbGFzcywgY2hJbmRleCArIDEsIHRoaXMuX2ZpbmRFbmRPZldvcmQobGluZUNvbnRlbnQsIHdvcmRTZXBhcmF0b3JzLCB3b3JkVHlwZSwgY2hJbmRleCArIDEpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3b3JkVHlwZSA9IFdvcmRUeXBlLlNlcGFyYXRvcjtcblx0XHRcdH0gZWxzZSBpZiAoY2hDbGFzcyA9PT0gV29yZENoYXJhY3RlckNsYXNzLldoaXRlc3BhY2UpIHtcblx0XHRcdFx0aWYgKHdvcmRUeXBlICE9PSBXb3JkVHlwZS5Ob25lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZVdvcmQobGluZUNvbnRlbnQsIHdvcmRUeXBlLCBjaENsYXNzLCBjaEluZGV4ICsgMSwgdGhpcy5fZmluZEVuZE9mV29yZChsaW5lQ29udGVudCwgd29yZFNlcGFyYXRvcnMsIHdvcmRUeXBlLCBjaEluZGV4ICsgMSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHdvcmRUeXBlICE9PSBXb3JkVHlwZS5Ob25lKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlV29yZChsaW5lQ29udGVudCwgd29yZFR5cGUsIFdvcmRDaGFyYWN0ZXJDbGFzcy5XaGl0ZXNwYWNlLCAwLCB0aGlzLl9maW5kRW5kT2ZXb3JkKGxpbmVDb250ZW50LCB3b3JkU2VwYXJhdG9ycywgd29yZFR5cGUsIDApKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9maW5kRW5kT2ZXb3JkKGxpbmVDb250ZW50OiBzdHJpbmcsIHdvcmRTZXBhcmF0b3JzOiBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciwgd29yZFR5cGU6IFdvcmRUeXBlLCBzdGFydEluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXG5cdFx0Y29uc3QgbmV4dEludGxXb3JkID0gd29yZFNlcGFyYXRvcnMuZmluZE5leHRJbnRsV29yZEF0T3JBZnRlck9mZnNldChsaW5lQ29udGVudCwgc3RhcnRJbmRleCk7XG5cblx0XHRjb25zdCBsZW4gPSBsaW5lQ29udGVudC5sZW5ndGg7XG5cdFx0Zm9yIChsZXQgY2hJbmRleCA9IHN0YXJ0SW5kZXg7IGNoSW5kZXggPCBsZW47IGNoSW5kZXgrKykge1xuXHRcdFx0Y29uc3QgY2hDb2RlID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjaEluZGV4KTtcblx0XHRcdGNvbnN0IGNoQ2xhc3MgPSB3b3JkU2VwYXJhdG9ycy5nZXQoY2hDb2RlKTtcblxuXHRcdFx0aWYgKG5leHRJbnRsV29yZCAmJiBjaEluZGV4ID09PSBuZXh0SW50bFdvcmQuaW5kZXggKyBuZXh0SW50bFdvcmQuc2VnbWVudC5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIGNoSW5kZXg7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjaENsYXNzID09PSBXb3JkQ2hhcmFjdGVyQ2xhc3MuV2hpdGVzcGFjZSkge1xuXHRcdFx0XHRyZXR1cm4gY2hJbmRleDtcblx0XHRcdH1cblx0XHRcdGlmICh3b3JkVHlwZSA9PT0gV29yZFR5cGUuUmVndWxhciAmJiBjaENsYXNzID09PSBXb3JkQ2hhcmFjdGVyQ2xhc3MuV29yZFNlcGFyYXRvcikge1xuXHRcdFx0XHRyZXR1cm4gY2hJbmRleDtcblx0XHRcdH1cblx0XHRcdGlmICh3b3JkVHlwZSA9PT0gV29yZFR5cGUuU2VwYXJhdG9yICYmIGNoQ2xhc3MgPT09IFdvcmRDaGFyYWN0ZXJDbGFzcy5SZWd1bGFyKSB7XG5cdFx0XHRcdHJldHVybiBjaEluZGV4O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbGVuO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2ZpbmROZXh0V29yZE9uTGluZSh3b3JkU2VwYXJhdG9yczogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbik6IElGaW5kV29yZFJlc3VsdCB8IG51bGwge1xuXHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0cmV0dXJuIHRoaXMuX2RvRmluZE5leHRXb3JkT25MaW5lKGxpbmVDb250ZW50LCB3b3JkU2VwYXJhdG9ycywgcG9zaXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2RvRmluZE5leHRXb3JkT25MaW5lKGxpbmVDb250ZW50OiBzdHJpbmcsIHdvcmRTZXBhcmF0b3JzOiBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciwgcG9zaXRpb246IFBvc2l0aW9uKTogSUZpbmRXb3JkUmVzdWx0IHwgbnVsbCB7XG5cdFx0bGV0IHdvcmRUeXBlID0gV29yZFR5cGUuTm9uZTtcblx0XHRjb25zdCBsZW4gPSBsaW5lQ29udGVudC5sZW5ndGg7XG5cblx0XHRjb25zdCBuZXh0SW50bFdvcmQgPSB3b3JkU2VwYXJhdG9ycy5maW5kTmV4dEludGxXb3JkQXRPckFmdGVyT2Zmc2V0KGxpbmVDb250ZW50LCBwb3NpdGlvbi5jb2x1bW4gLSAxKTtcblxuXHRcdGZvciAobGV0IGNoSW5kZXggPSBwb3NpdGlvbi5jb2x1bW4gLSAxOyBjaEluZGV4IDwgbGVuOyBjaEluZGV4KyspIHtcblx0XHRcdGNvbnN0IGNoQ29kZSA9IGxpbmVDb250ZW50LmNoYXJDb2RlQXQoY2hJbmRleCk7XG5cdFx0XHRjb25zdCBjaENsYXNzID0gd29yZFNlcGFyYXRvcnMuZ2V0KGNoQ29kZSk7XG5cblx0XHRcdGlmIChuZXh0SW50bFdvcmQgJiYgY2hJbmRleCA9PT0gbmV4dEludGxXb3JkLmluZGV4KSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVJbnRsV29yZChuZXh0SW50bFdvcmQsIGNoQ2xhc3MpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2hDbGFzcyA9PT0gV29yZENoYXJhY3RlckNsYXNzLlJlZ3VsYXIpIHtcblx0XHRcdFx0aWYgKHdvcmRUeXBlID09PSBXb3JkVHlwZS5TZXBhcmF0b3IpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlV29yZChsaW5lQ29udGVudCwgd29yZFR5cGUsIGNoQ2xhc3MsIHRoaXMuX2ZpbmRTdGFydE9mV29yZChsaW5lQ29udGVudCwgd29yZFNlcGFyYXRvcnMsIHdvcmRUeXBlLCBjaEluZGV4IC0gMSksIGNoSW5kZXgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdvcmRUeXBlID0gV29yZFR5cGUuUmVndWxhcjtcblx0XHRcdH0gZWxzZSBpZiAoY2hDbGFzcyA9PT0gV29yZENoYXJhY3RlckNsYXNzLldvcmRTZXBhcmF0b3IpIHtcblx0XHRcdFx0aWYgKHdvcmRUeXBlID09PSBXb3JkVHlwZS5SZWd1bGFyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZVdvcmQobGluZUNvbnRlbnQsIHdvcmRUeXBlLCBjaENsYXNzLCB0aGlzLl9maW5kU3RhcnRPZldvcmQobGluZUNvbnRlbnQsIHdvcmRTZXBhcmF0b3JzLCB3b3JkVHlwZSwgY2hJbmRleCAtIDEpLCBjaEluZGV4KTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3b3JkVHlwZSA9IFdvcmRUeXBlLlNlcGFyYXRvcjtcblx0XHRcdH0gZWxzZSBpZiAoY2hDbGFzcyA9PT0gV29yZENoYXJhY3RlckNsYXNzLldoaXRlc3BhY2UpIHtcblx0XHRcdFx0aWYgKHdvcmRUeXBlICE9PSBXb3JkVHlwZS5Ob25lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZVdvcmQobGluZUNvbnRlbnQsIHdvcmRUeXBlLCBjaENsYXNzLCB0aGlzLl9maW5kU3RhcnRPZldvcmQobGluZUNvbnRlbnQsIHdvcmRTZXBhcmF0b3JzLCB3b3JkVHlwZSwgY2hJbmRleCAtIDEpLCBjaEluZGV4KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh3b3JkVHlwZSAhPT0gV29yZFR5cGUuTm9uZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZVdvcmQobGluZUNvbnRlbnQsIHdvcmRUeXBlLCBXb3JkQ2hhcmFjdGVyQ2xhc3MuV2hpdGVzcGFjZSwgdGhpcy5fZmluZFN0YXJ0T2ZXb3JkKGxpbmVDb250ZW50LCB3b3JkU2VwYXJhdG9ycywgd29yZFR5cGUsIGxlbiAtIDEpLCBsZW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2ZpbmRTdGFydE9mV29yZChsaW5lQ29udGVudDogc3RyaW5nLCB3b3JkU2VwYXJhdG9yczogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIHdvcmRUeXBlOiBXb3JkVHlwZSwgc3RhcnRJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblxuXHRcdGNvbnN0IHByZXZpb3VzSW50bFdvcmQgPSB3b3JkU2VwYXJhdG9ycy5maW5kUHJldkludGxXb3JkQmVmb3JlT3JBdE9mZnNldChsaW5lQ29udGVudCwgc3RhcnRJbmRleCk7XG5cblx0XHRmb3IgKGxldCBjaEluZGV4ID0gc3RhcnRJbmRleDsgY2hJbmRleCA+PSAwOyBjaEluZGV4LS0pIHtcblx0XHRcdGNvbnN0IGNoQ29kZSA9IGxpbmVDb250ZW50LmNoYXJDb2RlQXQoY2hJbmRleCk7XG5cdFx0XHRjb25zdCBjaENsYXNzID0gd29yZFNlcGFyYXRvcnMuZ2V0KGNoQ29kZSk7XG5cblx0XHRcdGlmIChwcmV2aW91c0ludGxXb3JkICYmIGNoSW5kZXggPT09IHByZXZpb3VzSW50bFdvcmQuaW5kZXgpIHtcblx0XHRcdFx0cmV0dXJuIGNoSW5kZXg7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjaENsYXNzID09PSBXb3JkQ2hhcmFjdGVyQ2xhc3MuV2hpdGVzcGFjZSkge1xuXHRcdFx0XHRyZXR1cm4gY2hJbmRleCArIDE7XG5cdFx0XHR9XG5cdFx0XHRpZiAod29yZFR5cGUgPT09IFdvcmRUeXBlLlJlZ3VsYXIgJiYgY2hDbGFzcyA9PT0gV29yZENoYXJhY3RlckNsYXNzLldvcmRTZXBhcmF0b3IpIHtcblx0XHRcdFx0cmV0dXJuIGNoSW5kZXggKyAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHdvcmRUeXBlID09PSBXb3JkVHlwZS5TZXBhcmF0b3IgJiYgY2hDbGFzcyA9PT0gV29yZENoYXJhY3RlckNsYXNzLlJlZ3VsYXIpIHtcblx0XHRcdFx0cmV0dXJuIGNoSW5kZXggKyAxO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgbW92ZVdvcmRMZWZ0KHdvcmRTZXBhcmF0b3JzOiBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciwgbW9kZWw6IElDdXJzb3JTaW1wbGVNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCB3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZSwgaGFzTXVsdGljdXJzb3I6IGJvb2xlYW4pOiBQb3NpdGlvbiB7XG5cdFx0bGV0IGxpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdGxldCBjb2x1bW4gPSBwb3NpdGlvbi5jb2x1bW47XG5cblx0XHRpZiAoY29sdW1uID09PSAxKSB7XG5cdFx0XHRpZiAobGluZU51bWJlciA+IDEpIHtcblx0XHRcdFx0bGluZU51bWJlciA9IGxpbmVOdW1iZXIgLSAxO1xuXHRcdFx0XHRjb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBwcmV2V29yZE9uTGluZSA9IFdvcmRPcGVyYXRpb25zLl9maW5kUHJldmlvdXNXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbikpO1xuXG5cdFx0aWYgKHdvcmROYXZpZ2F0aW9uVHlwZSA9PT0gV29yZE5hdmlnYXRpb25UeXBlLldvcmRTdGFydCkge1xuXHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBwcmV2V29yZE9uTGluZSA/IHByZXZXb3JkT25MaW5lLnN0YXJ0ICsgMSA6IDEpO1xuXHRcdH1cblxuXHRcdGlmICh3b3JkTmF2aWdhdGlvblR5cGUgPT09IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkU3RhcnRGYXN0KSB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCFoYXNNdWx0aWN1cnNvciAvLyBhdm9pZCBoYXZpbmcgbXVsdGlwbGUgY3Vyc29ycyBzdG9wIGF0IGRpZmZlcmVudCBsb2NhdGlvbnMgd2hlbiBkb2luZyB3b3JkIHN0YXJ0XG5cdFx0XHRcdCYmIHByZXZXb3JkT25MaW5lXG5cdFx0XHRcdCYmIHByZXZXb3JkT25MaW5lLndvcmRUeXBlID09PSBXb3JkVHlwZS5TZXBhcmF0b3Jcblx0XHRcdFx0JiYgcHJldldvcmRPbkxpbmUuZW5kIC0gcHJldldvcmRPbkxpbmUuc3RhcnQgPT09IDFcblx0XHRcdFx0JiYgcHJldldvcmRPbkxpbmUubmV4dENoYXJDbGFzcyA9PT0gV29yZENoYXJhY3RlckNsYXNzLlJlZ3VsYXJcblx0XHRcdCkge1xuXHRcdFx0XHQvLyBTa2lwIG92ZXIgYSB3b3JkIG1hZGUgdXAgb2Ygb25lIHNpbmdsZSBzZXBhcmF0b3IgYW5kIGZvbGxvd2VkIGJ5IGEgcmVndWxhciBjaGFyYWN0ZXJcblx0XHRcdFx0cHJldldvcmRPbkxpbmUgPSBXb3JkT3BlcmF0aW9ucy5fZmluZFByZXZpb3VzV29yZE9uTGluZSh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBwcmV2V29yZE9uTGluZS5zdGFydCArIDEpKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBwcmV2V29yZE9uTGluZSA/IHByZXZXb3JkT25MaW5lLnN0YXJ0ICsgMSA6IDEpO1xuXHRcdH1cblxuXHRcdGlmICh3b3JkTmF2aWdhdGlvblR5cGUgPT09IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkQWNjZXNzaWJpbGl0eSkge1xuXHRcdFx0d2hpbGUgKFxuXHRcdFx0XHRwcmV2V29yZE9uTGluZVxuXHRcdFx0XHQmJiBwcmV2V29yZE9uTGluZS53b3JkVHlwZSA9PT0gV29yZFR5cGUuU2VwYXJhdG9yXG5cdFx0XHQpIHtcblx0XHRcdFx0Ly8gU2tpcCBvdmVyIHdvcmRzIG1hZGUgdXAgb2Ygb25seSBzZXBhcmF0b3JzXG5cdFx0XHRcdHByZXZXb3JkT25MaW5lID0gV29yZE9wZXJhdGlvbnMuX2ZpbmRQcmV2aW91c1dvcmRPbkxpbmUod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBuZXcgUG9zaXRpb24obGluZU51bWJlciwgcHJldldvcmRPbkxpbmUuc3RhcnQgKyAxKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgcHJldldvcmRPbkxpbmUgPyBwcmV2V29yZE9uTGluZS5zdGFydCArIDEgOiAxKTtcblx0XHR9XG5cblx0XHQvLyBXZSBhcmUgc3RvcHBpbmcgYXQgdGhlIGVuZGluZyBvZiB3b3Jkc1xuXG5cdFx0aWYgKHByZXZXb3JkT25MaW5lICYmIGNvbHVtbiA8PSBwcmV2V29yZE9uTGluZS5lbmQgKyAxKSB7XG5cdFx0XHRwcmV2V29yZE9uTGluZSA9IFdvcmRPcGVyYXRpb25zLl9maW5kUHJldmlvdXNXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIHByZXZXb3JkT25MaW5lLnN0YXJ0ICsgMSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgcHJldldvcmRPbkxpbmUgPyBwcmV2V29yZE9uTGluZS5lbmQgKyAxIDogMSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIF9tb3ZlV29yZFBhcnRMZWZ0KG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbik6IFBvc2l0aW9uIHtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gcG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRjb25zdCBtYXhDb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXG5cdFx0aWYgKHBvc2l0aW9uLmNvbHVtbiA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIChsaW5lTnVtYmVyID4gMSA/IG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyIC0gMSwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyIC0gMSkpIDogcG9zaXRpb24pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cdFx0Zm9yIChsZXQgY29sdW1uID0gcG9zaXRpb24uY29sdW1uIC0gMTsgY29sdW1uID4gMTsgY29sdW1uLS0pIHtcblx0XHRcdGNvbnN0IGxlZnQgPSBsaW5lQ29udGVudC5jaGFyQ29kZUF0KGNvbHVtbiAtIDIpO1xuXHRcdFx0Y29uc3QgcmlnaHQgPSBsaW5lQ29udGVudC5jaGFyQ29kZUF0KGNvbHVtbiAtIDEpO1xuXG5cdFx0XHRpZiAobGVmdCA9PT0gQ2hhckNvZGUuVW5kZXJsaW5lICYmIHJpZ2h0ICE9PSBDaGFyQ29kZS5VbmRlcmxpbmUpIHtcblx0XHRcdFx0Ly8gc25ha2VfY2FzZV92YXJpYWJsZXNcblx0XHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobGVmdCA9PT0gQ2hhckNvZGUuRGFzaCAmJiByaWdodCAhPT0gQ2hhckNvZGUuRGFzaCkge1xuXHRcdFx0XHQvLyBrZWJhYi1jYXNlLXZhcmlhYmxlc1xuXHRcdFx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cdFx0XHR9XG5cblx0XHRcdGlmICgoc3RyaW5ncy5pc0xvd2VyQXNjaWlMZXR0ZXIobGVmdCkgfHwgc3RyaW5ncy5pc0FzY2lpRGlnaXQobGVmdCkpICYmIHN0cmluZ3MuaXNVcHBlckFzY2lpTGV0dGVyKHJpZ2h0KSkge1xuXHRcdFx0XHQvLyBjYW1lbENhc2VWYXJpYWJsZXNcblx0XHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RyaW5ncy5pc1VwcGVyQXNjaWlMZXR0ZXIobGVmdCkgJiYgc3RyaW5ncy5pc1VwcGVyQXNjaWlMZXR0ZXIocmlnaHQpKSB7XG5cdFx0XHRcdC8vIHRoaXNJc0FDYW1lbENhc2VXaXRoT25lTGV0dGVyV29yZHNcblx0XHRcdFx0aWYgKGNvbHVtbiArIDEgPCBtYXhDb2x1bW4pIHtcblx0XHRcdFx0XHRjb25zdCByaWdodFJpZ2h0ID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjb2x1bW4pO1xuXHRcdFx0XHRcdGlmIChzdHJpbmdzLmlzTG93ZXJBc2NpaUxldHRlcihyaWdodFJpZ2h0KSB8fCBzdHJpbmdzLmlzQXNjaWlEaWdpdChyaWdodFJpZ2h0KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgMSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIG1vdmVXb3JkUmlnaHQod29yZFNlcGFyYXRvcnM6IFdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLCBtb2RlbDogSUN1cnNvclNpbXBsZU1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlKTogUG9zaXRpb24ge1xuXHRcdGxldCBsaW5lTnVtYmVyID0gcG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRsZXQgY29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXG5cdFx0bGV0IG1vdmVkRG93biA9IGZhbHNlO1xuXHRcdGlmIChjb2x1bW4gPT09IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcikpIHtcblx0XHRcdGlmIChsaW5lTnVtYmVyIDwgbW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0bW92ZWREb3duID0gdHJ1ZTtcblx0XHRcdFx0bGluZU51bWJlciA9IGxpbmVOdW1iZXIgKyAxO1xuXHRcdFx0XHRjb2x1bW4gPSAxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBuZXh0V29yZE9uTGluZSA9IFdvcmRPcGVyYXRpb25zLl9maW5kTmV4dFdvcmRPbkxpbmUod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKSk7XG5cblx0XHRpZiAod29yZE5hdmlnYXRpb25UeXBlID09PSBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEVuZCkge1xuXHRcdFx0aWYgKG5leHRXb3JkT25MaW5lICYmIG5leHRXb3JkT25MaW5lLndvcmRUeXBlID09PSBXb3JkVHlwZS5TZXBhcmF0b3IpIHtcblx0XHRcdFx0aWYgKG5leHRXb3JkT25MaW5lLmVuZCAtIG5leHRXb3JkT25MaW5lLnN0YXJ0ID09PSAxICYmIG5leHRXb3JkT25MaW5lLm5leHRDaGFyQ2xhc3MgPT09IFdvcmRDaGFyYWN0ZXJDbGFzcy5SZWd1bGFyKSB7XG5cdFx0XHRcdFx0Ly8gU2tpcCBvdmVyIGEgd29yZCBtYWRlIHVwIG9mIG9uZSBzaW5nbGUgc2VwYXJhdG9yIGFuZCBmb2xsb3dlZCBieSBhIHJlZ3VsYXIgY2hhcmFjdGVyXG5cdFx0XHRcdFx0bmV4dFdvcmRPbkxpbmUgPSBXb3JkT3BlcmF0aW9ucy5fZmluZE5leHRXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIG5leHRXb3JkT25MaW5lLmVuZCArIDEpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG5leHRXb3JkT25MaW5lKSB7XG5cdFx0XHRcdGNvbHVtbiA9IG5leHRXb3JkT25MaW5lLmVuZCArIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAod29yZE5hdmlnYXRpb25UeXBlID09PSBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEFjY2Vzc2liaWxpdHkpIHtcblx0XHRcdGlmIChtb3ZlZERvd24pIHtcblx0XHRcdFx0Ly8gSWYgd2UgbW92ZSB0byB0aGUgbmV4dCBsaW5lLCBwcmV0ZW5kIHRoYXQgdGhlIGN1cnNvciBpcyByaWdodCBiZWZvcmUgdGhlIGZpcnN0IGNoYXJhY3Rlci5cblx0XHRcdFx0Ly8gVGhpcyBpcyBuZWVkZWQgd2hlbiB0aGUgZmlyc3Qgd29yZCBzdGFydHMgcmlnaHQgYXQgdGhlIGZpcnN0IGNoYXJhY3RlciAtIGFuZCBpbiBvcmRlciBub3QgdG8gbWlzcyBpdCxcblx0XHRcdFx0Ly8gd2UgbmVlZCB0byBzdGFydCBiZWZvcmUuXG5cdFx0XHRcdGNvbHVtbiA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdHdoaWxlIChcblx0XHRcdFx0bmV4dFdvcmRPbkxpbmVcblx0XHRcdFx0JiYgKG5leHRXb3JkT25MaW5lLndvcmRUeXBlID09PSBXb3JkVHlwZS5TZXBhcmF0b3Jcblx0XHRcdFx0XHR8fCBuZXh0V29yZE9uTGluZS5zdGFydCArIDEgPD0gY29sdW1uXG5cdFx0XHRcdClcblx0XHRcdCkge1xuXHRcdFx0XHQvLyBTa2lwIG92ZXIgYSB3b3JkIG1hZGUgdXAgb2Ygb25lIHNpbmdsZSBzZXBhcmF0b3Jcblx0XHRcdFx0Ly8gQWxzbyBza2lwIG92ZXIgd29yZCBpZiBpdCBiZWdpbnMgYmVmb3JlIGN1cnJlbnQgY3Vyc29yIHBvc2l0aW9uIHRvIGFzY2VydGFpbiB3ZSdyZSBtb3ZpbmcgZm9yd2FyZCBhdCBsZWFzdCAxIGNoYXJhY3Rlci5cblx0XHRcdFx0bmV4dFdvcmRPbkxpbmUgPSBXb3JkT3BlcmF0aW9ucy5fZmluZE5leHRXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIG5leHRXb3JkT25MaW5lLmVuZCArIDEpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG5leHRXb3JkT25MaW5lKSB7XG5cdFx0XHRcdGNvbHVtbiA9IG5leHRXb3JkT25MaW5lLnN0YXJ0ICsgMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChuZXh0V29yZE9uTGluZSAmJiAhbW92ZWREb3duICYmIGNvbHVtbiA+PSBuZXh0V29yZE9uTGluZS5zdGFydCArIDEpIHtcblx0XHRcdFx0bmV4dFdvcmRPbkxpbmUgPSBXb3JkT3BlcmF0aW9ucy5fZmluZE5leHRXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIG5leHRXb3JkT25MaW5lLmVuZCArIDEpKTtcblx0XHRcdH1cblx0XHRcdGlmIChuZXh0V29yZE9uTGluZSkge1xuXHRcdFx0XHRjb2x1bW4gPSBuZXh0V29yZE9uTGluZS5zdGFydCArIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgX21vdmVXb3JkUGFydFJpZ2h0KG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbik6IFBvc2l0aW9uIHtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gcG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRjb25zdCBtYXhDb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXG5cdFx0aWYgKHBvc2l0aW9uLmNvbHVtbiA9PT0gbWF4Q29sdW1uKSB7XG5cdFx0XHRyZXR1cm4gKGxpbmVOdW1iZXIgPCBtb2RlbC5nZXRMaW5lQ291bnQoKSA/IG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyICsgMSwgMSkgOiBwb3NpdGlvbik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0XHRmb3IgKGxldCBjb2x1bW4gPSBwb3NpdGlvbi5jb2x1bW4gKyAxOyBjb2x1bW4gPCBtYXhDb2x1bW47IGNvbHVtbisrKSB7XG5cdFx0XHRjb25zdCBsZWZ0ID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjb2x1bW4gLSAyKTtcblx0XHRcdGNvbnN0IHJpZ2h0ID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjb2x1bW4gLSAxKTtcblxuXHRcdFx0aWYgKGxlZnQgIT09IENoYXJDb2RlLlVuZGVybGluZSAmJiByaWdodCA9PT0gQ2hhckNvZGUuVW5kZXJsaW5lKSB7XG5cdFx0XHRcdC8vIHNuYWtlX2Nhc2VfdmFyaWFibGVzXG5cdFx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGxlZnQgIT09IENoYXJDb2RlLkRhc2ggJiYgcmlnaHQgPT09IENoYXJDb2RlLkRhc2gpIHtcblx0XHRcdFx0Ly8ga2ViYWItY2FzZS12YXJpYWJsZXNcblx0XHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoKHN0cmluZ3MuaXNMb3dlckFzY2lpTGV0dGVyKGxlZnQpIHx8IHN0cmluZ3MuaXNBc2NpaURpZ2l0KGxlZnQpKSAmJiBzdHJpbmdzLmlzVXBwZXJBc2NpaUxldHRlcihyaWdodCkpIHtcblx0XHRcdFx0Ly8gY2FtZWxDYXNlVmFyaWFibGVzXG5cdFx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0cmluZ3MuaXNVcHBlckFzY2lpTGV0dGVyKGxlZnQpICYmIHN0cmluZ3MuaXNVcHBlckFzY2lpTGV0dGVyKHJpZ2h0KSkge1xuXHRcdFx0XHQvLyB0aGlzSXNBQ2FtZWxDYXNlV2l0aE9uZUxldHRlcldvcmRzXG5cdFx0XHRcdGlmIChjb2x1bW4gKyAxIDwgbWF4Q29sdW1uKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmlnaHRSaWdodCA9IGxpbmVDb250ZW50LmNoYXJDb2RlQXQoY29sdW1uKTtcblx0XHRcdFx0XHRpZiAoc3RyaW5ncy5pc0xvd2VyQXNjaWlMZXR0ZXIocmlnaHRSaWdodCkgfHwgc3RyaW5ncy5pc0FzY2lpRGlnaXQocmlnaHRSaWdodCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIG1heENvbHVtbik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgc3RhdGljIF9kZWxldGVXb3JkTGVmdFdoaXRlc3BhY2UobW9kZWw6IElDdXJzb3JTaW1wbGVNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uKTogUmFuZ2UgfCBudWxsIHtcblx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHN0YXJ0SW5kZXggPSBwb3NpdGlvbi5jb2x1bW4gLSAyO1xuXHRcdGNvbnN0IGxhc3ROb25XaGl0ZXNwYWNlID0gc3RyaW5ncy5sYXN0Tm9uV2hpdGVzcGFjZUluZGV4KGxpbmVDb250ZW50LCBzdGFydEluZGV4KTtcblx0XHRpZiAobGFzdE5vbldoaXRlc3BhY2UgKyAxIDwgc3RhcnRJbmRleCkge1xuXHRcdFx0cmV0dXJuIG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCBsYXN0Tm9uV2hpdGVzcGFjZSArIDIsIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbik7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBkZWxldGVXb3JkTGVmdChjdHg6IERlbGV0ZVdvcmRDb250ZXh0LCB3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZSk6IFJhbmdlIHwgbnVsbCB7XG5cdFx0Y29uc3Qgd29yZFNlcGFyYXRvcnMgPSBjdHgud29yZFNlcGFyYXRvcnM7XG5cdFx0Y29uc3QgbW9kZWwgPSBjdHgubW9kZWw7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gY3R4LnNlbGVjdGlvbjtcblx0XHRjb25zdCB3aGl0ZXNwYWNlSGV1cmlzdGljcyA9IGN0eC53aGl0ZXNwYWNlSGV1cmlzdGljcztcblxuXHRcdGlmICghc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0XHR9XG5cblx0XHRpZiAoRGVsZXRlT3BlcmF0aW9ucy5pc0F1dG9DbG9zaW5nUGFpckRlbGV0ZShjdHguYXV0b0Nsb3NpbmdEZWxldGUsIGN0eC5hdXRvQ2xvc2luZ0JyYWNrZXRzLCBjdHguYXV0b0Nsb3NpbmdRdW90ZXMsIGN0eC5hdXRvQ2xvc2luZ1BhaXJzLmF1dG9DbG9zaW5nUGFpcnNPcGVuQnlFbmQsIGN0eC5tb2RlbCwgW2N0eC5zZWxlY3Rpb25dLCBjdHguYXV0b0Nsb3NlZENoYXJhY3RlcnMpKSB7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IGN0eC5zZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblx0XHRcdHJldHVybiBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uIC0gMSwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uICsgMSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSBuZXcgUG9zaXRpb24oc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlciwgc2VsZWN0aW9uLnBvc2l0aW9uQ29sdW1uKTtcblxuXHRcdGxldCBsaW5lTnVtYmVyID0gcG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRsZXQgY29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXG5cdFx0aWYgKGxpbmVOdW1iZXIgPT09IDEgJiYgY29sdW1uID09PSAxKSB7XG5cdFx0XHQvLyBJZ25vcmUgZGVsZXRpbmcgYXQgYmVnaW5uaW5nIG9mIGZpbGVcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh3aGl0ZXNwYWNlSGV1cmlzdGljcykge1xuXHRcdFx0Y29uc3QgciA9IHRoaXMuX2RlbGV0ZVdvcmRMZWZ0V2hpdGVzcGFjZShtb2RlbCwgcG9zaXRpb24pO1xuXHRcdFx0aWYgKHIpIHtcblx0XHRcdFx0cmV0dXJuIHI7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHByZXZXb3JkT25MaW5lID0gV29yZE9wZXJhdGlvbnMuX2ZpbmRQcmV2aW91c1dvcmRPbkxpbmUod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBwb3NpdGlvbik7XG5cblx0XHRpZiAod29yZE5hdmlnYXRpb25UeXBlID09PSBXb3JkTmF2aWdhdGlvblR5cGUuV29yZFN0YXJ0KSB7XG5cdFx0XHRpZiAocHJldldvcmRPbkxpbmUpIHtcblx0XHRcdFx0Y29sdW1uID0gcHJldldvcmRPbkxpbmUuc3RhcnQgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGNvbHVtbiA+IDEpIHtcblx0XHRcdFx0XHRjb2x1bW4gPSAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxpbmVOdW1iZXItLTtcblx0XHRcdFx0XHRjb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChwcmV2V29yZE9uTGluZSAmJiBjb2x1bW4gPD0gcHJldldvcmRPbkxpbmUuZW5kICsgMSkge1xuXHRcdFx0XHRwcmV2V29yZE9uTGluZSA9IFdvcmRPcGVyYXRpb25zLl9maW5kUHJldmlvdXNXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIHByZXZXb3JkT25MaW5lLnN0YXJ0ICsgMSkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHByZXZXb3JkT25MaW5lKSB7XG5cdFx0XHRcdGNvbHVtbiA9IHByZXZXb3JkT25MaW5lLmVuZCArIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoY29sdW1uID4gMSkge1xuXHRcdFx0XHRcdGNvbHVtbiA9IDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGluZU51bWJlci0tO1xuXHRcdFx0XHRcdGNvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFJhbmdlKGxpbmVOdW1iZXIsIGNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVsZXRlSW5zaWRlV29yZCh3b3JkU2VwYXJhdG9yczogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb246IFNlbGVjdGlvbik6IFJhbmdlIHtcblx0XHRpZiAoIXNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdHJldHVybiBzZWxlY3Rpb247XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSBuZXcgUG9zaXRpb24oc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlciwgc2VsZWN0aW9uLnBvc2l0aW9uQ29sdW1uKTtcblxuXHRcdGNvbnN0IHIgPSB0aGlzLl9kZWxldGVJbnNpZGVXb3JkV2hpdGVzcGFjZShtb2RlbCwgcG9zaXRpb24pO1xuXHRcdGlmIChyKSB7XG5cdFx0XHRyZXR1cm4gcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZGVsZXRlSW5zaWRlV29yZERldGVybWluZURlbGV0ZVJhbmdlKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgcG9zaXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NoYXJBdElzV2hpdGVzcGFjZShzdHI6IHN0cmluZywgaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaW5kZXgpO1xuXHRcdHJldHVybiAoY2hhckNvZGUgPT09IENoYXJDb2RlLlNwYWNlIHx8IGNoYXJDb2RlID09PSBDaGFyQ29kZS5UYWIpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2RlbGV0ZUluc2lkZVdvcmRXaGl0ZXNwYWNlKG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbik6IFJhbmdlIHwgbnVsbCB7XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRjb25zdCBsaW5lQ29udGVudExlbmd0aCA9IGxpbmVDb250ZW50Lmxlbmd0aDtcblxuXHRcdGlmIChsaW5lQ29udGVudExlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gZW1wdHkgbGluZVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0bGV0IGxlZnRJbmRleCA9IE1hdGgubWF4KHBvc2l0aW9uLmNvbHVtbiAtIDIsIDApO1xuXHRcdGlmICghdGhpcy5fY2hhckF0SXNXaGl0ZXNwYWNlKGxpbmVDb250ZW50LCBsZWZ0SW5kZXgpKSB7XG5cdFx0XHQvLyB0b3VjaGVzIGEgbm9uLXdoaXRlc3BhY2UgY2hhcmFjdGVyIHRvIHRoZSBsZWZ0XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRsZXQgcmlnaHRJbmRleCA9IE1hdGgubWluKHBvc2l0aW9uLmNvbHVtbiAtIDEsIGxpbmVDb250ZW50TGVuZ3RoIC0gMSk7XG5cdFx0aWYgKCF0aGlzLl9jaGFyQXRJc1doaXRlc3BhY2UobGluZUNvbnRlbnQsIHJpZ2h0SW5kZXgpKSB7XG5cdFx0XHQvLyB0b3VjaGVzIGEgbm9uLXdoaXRlc3BhY2UgY2hhcmFjdGVyIHRvIHRoZSByaWdodFxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gd2FsayBvdmVyIHdoaXRlc3BhY2UgdG8gdGhlIGxlZnRcblx0XHR3aGlsZSAobGVmdEluZGV4ID4gMCAmJiB0aGlzLl9jaGFyQXRJc1doaXRlc3BhY2UobGluZUNvbnRlbnQsIGxlZnRJbmRleCAtIDEpKSB7XG5cdFx0XHRsZWZ0SW5kZXgtLTtcblx0XHR9XG5cblx0XHQvLyB3YWxrIG92ZXIgd2hpdGVzcGFjZSB0byB0aGUgcmlnaHRcblx0XHR3aGlsZSAocmlnaHRJbmRleCArIDEgPCBsaW5lQ29udGVudExlbmd0aCAmJiB0aGlzLl9jaGFyQXRJc1doaXRlc3BhY2UobGluZUNvbnRlbnQsIHJpZ2h0SW5kZXggKyAxKSkge1xuXHRcdFx0cmlnaHRJbmRleCsrO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgbGVmdEluZGV4ICsgMSwgcG9zaXRpb24ubGluZU51bWJlciwgcmlnaHRJbmRleCArIDIpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2RlbGV0ZUluc2lkZVdvcmREZXRlcm1pbmVEZWxldGVSYW5nZSh3b3JkU2VwYXJhdG9yczogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbik6IFJhbmdlIHtcblx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGxpbmVMZW5ndGggPSBsaW5lQ29udGVudC5sZW5ndGg7XG5cdFx0aWYgKGxpbmVMZW5ndGggPT09IDApIHtcblx0XHRcdC8vIGVtcHR5IGxpbmVcblx0XHRcdGlmIChwb3NpdGlvbi5saW5lTnVtYmVyID4gMSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIgLSAxLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHBvc2l0aW9uLmxpbmVOdW1iZXIgLSAxKSwgcG9zaXRpb24ubGluZU51bWJlciwgMSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAocG9zaXRpb24ubGluZU51bWJlciA8IG1vZGVsLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCAxLCBwb3NpdGlvbi5saW5lTnVtYmVyICsgMSwgMSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZW1wdHkgbW9kZWxcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIDEsIHBvc2l0aW9uLmxpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG91Y2hlc1dvcmQgPSAod29yZDogSUZpbmRXb3JkUmVzdWx0KSA9PiB7XG5cdFx0XHRyZXR1cm4gKHdvcmQuc3RhcnQgKyAxIDw9IHBvc2l0aW9uLmNvbHVtbiAmJiBwb3NpdGlvbi5jb2x1bW4gPD0gd29yZC5lbmQgKyAxKTtcblx0XHR9O1xuXHRcdGNvbnN0IGNyZWF0ZVJhbmdlV2l0aFBvc2l0aW9uID0gKHN0YXJ0Q29sdW1uOiBudW1iZXIsIGVuZENvbHVtbjogbnVtYmVyKSA9PiB7XG5cdFx0XHRzdGFydENvbHVtbiA9IE1hdGgubWluKHN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5jb2x1bW4pO1xuXHRcdFx0ZW5kQ29sdW1uID0gTWF0aC5tYXgoZW5kQ29sdW1uLCBwb3NpdGlvbi5jb2x1bW4pO1xuXHRcdFx0cmV0dXJuIG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCBzdGFydENvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgZW5kQ29sdW1uKTtcblx0XHR9O1xuXHRcdGNvbnN0IGRlbGV0ZVdvcmRBbmRBZGphY2VudFdoaXRlc3BhY2UgPSAod29yZDogSUZpbmRXb3JkUmVzdWx0KSA9PiB7XG5cdFx0XHRsZXQgc3RhcnRDb2x1bW4gPSB3b3JkLnN0YXJ0ICsgMTtcblx0XHRcdGxldCBlbmRDb2x1bW4gPSB3b3JkLmVuZCArIDE7XG5cdFx0XHRsZXQgZXhwYW5kZWRUb1RoZVJpZ2h0ID0gZmFsc2U7XG5cdFx0XHR3aGlsZSAoZW5kQ29sdW1uIC0gMSA8IGxpbmVMZW5ndGggJiYgdGhpcy5fY2hhckF0SXNXaGl0ZXNwYWNlKGxpbmVDb250ZW50LCBlbmRDb2x1bW4gLSAxKSkge1xuXHRcdFx0XHRleHBhbmRlZFRvVGhlUmlnaHQgPSB0cnVlO1xuXHRcdFx0XHRlbmRDb2x1bW4rKztcblx0XHRcdH1cblx0XHRcdGlmICghZXhwYW5kZWRUb1RoZVJpZ2h0KSB7XG5cdFx0XHRcdHdoaWxlIChzdGFydENvbHVtbiA+IDEgJiYgdGhpcy5fY2hhckF0SXNXaGl0ZXNwYWNlKGxpbmVDb250ZW50LCBzdGFydENvbHVtbiAtIDIpKSB7XG5cdFx0XHRcdFx0c3RhcnRDb2x1bW4tLTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNyZWF0ZVJhbmdlV2l0aFBvc2l0aW9uKHN0YXJ0Q29sdW1uLCBlbmRDb2x1bW4pO1xuXHRcdH07XG5cblx0XHRjb25zdCBwcmV2V29yZE9uTGluZSA9IFdvcmRPcGVyYXRpb25zLl9maW5kUHJldmlvdXNXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgcG9zaXRpb24pO1xuXHRcdGlmIChwcmV2V29yZE9uTGluZSAmJiB0b3VjaGVzV29yZChwcmV2V29yZE9uTGluZSkpIHtcblx0XHRcdHJldHVybiBkZWxldGVXb3JkQW5kQWRqYWNlbnRXaGl0ZXNwYWNlKHByZXZXb3JkT25MaW5lKTtcblx0XHR9XG5cdFx0Y29uc3QgbmV4dFdvcmRPbkxpbmUgPSBXb3JkT3BlcmF0aW9ucy5fZmluZE5leHRXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgcG9zaXRpb24pO1xuXHRcdGlmIChuZXh0V29yZE9uTGluZSAmJiB0b3VjaGVzV29yZChuZXh0V29yZE9uTGluZSkpIHtcblx0XHRcdHJldHVybiBkZWxldGVXb3JkQW5kQWRqYWNlbnRXaGl0ZXNwYWNlKG5leHRXb3JkT25MaW5lKTtcblx0XHR9XG5cdFx0aWYgKHByZXZXb3JkT25MaW5lICYmIG5leHRXb3JkT25MaW5lKSB7XG5cdFx0XHRyZXR1cm4gY3JlYXRlUmFuZ2VXaXRoUG9zaXRpb24ocHJldldvcmRPbkxpbmUuZW5kICsgMSwgbmV4dFdvcmRPbkxpbmUuc3RhcnQgKyAxKTtcblx0XHR9XG5cdFx0aWYgKHByZXZXb3JkT25MaW5lKSB7XG5cdFx0XHRyZXR1cm4gY3JlYXRlUmFuZ2VXaXRoUG9zaXRpb24ocHJldldvcmRPbkxpbmUuc3RhcnQgKyAxLCBwcmV2V29yZE9uTGluZS5lbmQgKyAxKTtcblx0XHR9XG5cdFx0aWYgKG5leHRXb3JkT25MaW5lKSB7XG5cdFx0XHRyZXR1cm4gY3JlYXRlUmFuZ2VXaXRoUG9zaXRpb24obmV4dFdvcmRPbkxpbmUuc3RhcnQgKyAxLCBuZXh0V29yZE9uTGluZS5lbmQgKyAxKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY3JlYXRlUmFuZ2VXaXRoUG9zaXRpb24oMSwgbGluZUxlbmd0aCArIDEpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBfZGVsZXRlV29yZFBhcnRMZWZ0KG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHNlbGVjdGlvbjogU2VsZWN0aW9uKTogUmFuZ2Uge1xuXHRcdGlmICghc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0XHR9XG5cblx0XHRjb25zdCBwb3MgPSBzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblx0XHRjb25zdCB0b1Bvc2l0aW9uID0gV29yZE9wZXJhdGlvbnMuX21vdmVXb3JkUGFydExlZnQobW9kZWwsIHBvcyk7XG5cdFx0cmV0dXJuIG5ldyBSYW5nZShwb3MubGluZU51bWJlciwgcG9zLmNvbHVtbiwgdG9Qb3NpdGlvbi5saW5lTnVtYmVyLCB0b1Bvc2l0aW9uLmNvbHVtbik7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZmluZEZpcnN0Tm9uV2hpdGVzcGFjZUNoYXIoc3RyOiBzdHJpbmcsIHN0YXJ0SW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgbGVuID0gc3RyLmxlbmd0aDtcblx0XHRmb3IgKGxldCBjaEluZGV4ID0gc3RhcnRJbmRleDsgY2hJbmRleCA8IGxlbjsgY2hJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBjaCA9IHN0ci5jaGFyQXQoY2hJbmRleCk7XG5cdFx0XHRpZiAoY2ggIT09ICcgJyAmJiBjaCAhPT0gJ1xcdCcpIHtcblx0XHRcdFx0cmV0dXJuIGNoSW5kZXg7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBsZW47XG5cdH1cblxuXHRwcm90ZWN0ZWQgc3RhdGljIF9kZWxldGVXb3JkUmlnaHRXaGl0ZXNwYWNlKG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbik6IFJhbmdlIHwgbnVsbCB7XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRjb25zdCBzdGFydEluZGV4ID0gcG9zaXRpb24uY29sdW1uIC0gMTtcblx0XHRjb25zdCBmaXJzdE5vbldoaXRlc3BhY2UgPSB0aGlzLl9maW5kRmlyc3ROb25XaGl0ZXNwYWNlQ2hhcihsaW5lQ29udGVudCwgc3RhcnRJbmRleCk7XG5cdFx0aWYgKHN0YXJ0SW5kZXggKyAxIDwgZmlyc3ROb25XaGl0ZXNwYWNlKSB7XG5cdFx0XHQvLyBiaW5nb1xuXHRcdFx0cmV0dXJuIG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIGZpcnN0Tm9uV2hpdGVzcGFjZSArIDEpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVsZXRlV29yZFJpZ2h0KGN0eDogRGVsZXRlV29yZENvbnRleHQsIHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlKTogUmFuZ2UgfCBudWxsIHtcblx0XHRjb25zdCB3b3JkU2VwYXJhdG9ycyA9IGN0eC53b3JkU2VwYXJhdG9ycztcblx0XHRjb25zdCBtb2RlbCA9IGN0eC5tb2RlbDtcblx0XHRjb25zdCBzZWxlY3Rpb24gPSBjdHguc2VsZWN0aW9uO1xuXHRcdGNvbnN0IHdoaXRlc3BhY2VIZXVyaXN0aWNzID0gY3R4LndoaXRlc3BhY2VIZXVyaXN0aWNzO1xuXG5cdFx0aWYgKCFzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9uO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKHNlbGVjdGlvbi5wb3NpdGlvbkxpbmVOdW1iZXIsIHNlbGVjdGlvbi5wb3NpdGlvbkNvbHVtbik7XG5cblx0XHRsZXQgbGluZU51bWJlciA9IHBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0bGV0IGNvbHVtbiA9IHBvc2l0aW9uLmNvbHVtbjtcblxuXHRcdGNvbnN0IGxpbmVDb3VudCA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IG1heENvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0aWYgKGxpbmVOdW1iZXIgPT09IGxpbmVDb3VudCAmJiBjb2x1bW4gPT09IG1heENvbHVtbikge1xuXHRcdFx0Ly8gSWdub3JlIGRlbGV0aW5nIGF0IGVuZCBvZiBmaWxlXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAod2hpdGVzcGFjZUhldXJpc3RpY3MpIHtcblx0XHRcdGNvbnN0IHIgPSB0aGlzLl9kZWxldGVXb3JkUmlnaHRXaGl0ZXNwYWNlKG1vZGVsLCBwb3NpdGlvbik7XG5cdFx0XHRpZiAocikge1xuXHRcdFx0XHRyZXR1cm4gcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgbmV4dFdvcmRPbkxpbmUgPSBXb3JkT3BlcmF0aW9ucy5fZmluZE5leHRXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgcG9zaXRpb24pO1xuXG5cdFx0aWYgKHdvcmROYXZpZ2F0aW9uVHlwZSA9PT0gV29yZE5hdmlnYXRpb25UeXBlLldvcmRFbmQpIHtcblx0XHRcdGlmIChuZXh0V29yZE9uTGluZSkge1xuXHRcdFx0XHRjb2x1bW4gPSBuZXh0V29yZE9uTGluZS5lbmQgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGNvbHVtbiA8IG1heENvbHVtbiB8fCBsaW5lTnVtYmVyID09PSBsaW5lQ291bnQpIHtcblx0XHRcdFx0XHRjb2x1bW4gPSBtYXhDb2x1bW47XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGluZU51bWJlcisrO1xuXHRcdFx0XHRcdG5leHRXb3JkT25MaW5lID0gV29yZE9wZXJhdGlvbnMuX2ZpbmROZXh0V29yZE9uTGluZSh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCAxKSk7XG5cdFx0XHRcdFx0aWYgKG5leHRXb3JkT25MaW5lKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW4gPSBuZXh0V29yZE9uTGluZS5zdGFydCArIDE7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChuZXh0V29yZE9uTGluZSAmJiBjb2x1bW4gPj0gbmV4dFdvcmRPbkxpbmUuc3RhcnQgKyAxKSB7XG5cdFx0XHRcdG5leHRXb3JkT25MaW5lID0gV29yZE9wZXJhdGlvbnMuX2ZpbmROZXh0V29yZE9uTGluZSh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBuZXh0V29yZE9uTGluZS5lbmQgKyAxKSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAobmV4dFdvcmRPbkxpbmUpIHtcblx0XHRcdFx0Y29sdW1uID0gbmV4dFdvcmRPbkxpbmUuc3RhcnQgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGNvbHVtbiA8IG1heENvbHVtbiB8fCBsaW5lTnVtYmVyID09PSBsaW5lQ291bnQpIHtcblx0XHRcdFx0XHRjb2x1bW4gPSBtYXhDb2x1bW47XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGluZU51bWJlcisrO1xuXHRcdFx0XHRcdG5leHRXb3JkT25MaW5lID0gV29yZE9wZXJhdGlvbnMuX2ZpbmROZXh0V29yZE9uTGluZSh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCAxKSk7XG5cdFx0XHRcdFx0aWYgKG5leHRXb3JkT25MaW5lKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW4gPSBuZXh0V29yZE9uTGluZS5zdGFydCArIDE7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBSYW5nZShsaW5lTnVtYmVyLCBjb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbik7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIF9kZWxldGVXb3JkUGFydFJpZ2h0KG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHNlbGVjdGlvbjogU2VsZWN0aW9uKTogUmFuZ2Uge1xuXHRcdGlmICghc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0XHR9XG5cblx0XHRjb25zdCBwb3MgPSBzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblx0XHRjb25zdCB0b1Bvc2l0aW9uID0gV29yZE9wZXJhdGlvbnMuX21vdmVXb3JkUGFydFJpZ2h0KG1vZGVsLCBwb3MpO1xuXHRcdHJldHVybiBuZXcgUmFuZ2UocG9zLmxpbmVOdW1iZXIsIHBvcy5jb2x1bW4sIHRvUG9zaXRpb24ubGluZU51bWJlciwgdG9Qb3NpdGlvbi5jb2x1bW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NyZWF0ZVdvcmRBdFBvc2l0aW9uKG1vZGVsOiBJVGV4dE1vZGVsLCBsaW5lTnVtYmVyOiBudW1iZXIsIHdvcmQ6IElGaW5kV29yZFJlc3VsdCk6IElXb3JkQXRQb3NpdGlvbiB7XG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2UobGluZU51bWJlciwgd29yZC5zdGFydCArIDEsIGxpbmVOdW1iZXIsIHdvcmQuZW5kICsgMSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHdvcmQ6IG1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSksXG5cdFx0XHRzdGFydENvbHVtbjogcmFuZ2Uuc3RhcnRDb2x1bW4sXG5cdFx0XHRlbmRDb2x1bW46IHJhbmdlLmVuZENvbHVtblxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGdldFdvcmRBdFBvc2l0aW9uKG1vZGVsOiBJVGV4dE1vZGVsLCBfd29yZFNlcGFyYXRvcnM6IHN0cmluZywgX2ludGxTZWdtZW50ZXJMb2NhbGVzOiBzdHJpbmdbXSwgcG9zaXRpb246IFBvc2l0aW9uKTogSVdvcmRBdFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0Y29uc3Qgd29yZFNlcGFyYXRvcnMgPSBnZXRNYXBGb3JXb3JkU2VwYXJhdG9ycyhfd29yZFNlcGFyYXRvcnMsIF9pbnRsU2VnbWVudGVyTG9jYWxlcyk7XG5cdFx0Y29uc3QgcHJldldvcmQgPSBXb3JkT3BlcmF0aW9ucy5fZmluZFByZXZpb3VzV29yZE9uTGluZSh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIHBvc2l0aW9uKTtcblx0XHRpZiAocHJldldvcmQgJiYgcHJldldvcmQud29yZFR5cGUgPT09IFdvcmRUeXBlLlJlZ3VsYXIgJiYgcHJldldvcmQuc3RhcnQgPD0gcG9zaXRpb24uY29sdW1uIC0gMSAmJiBwb3NpdGlvbi5jb2x1bW4gLSAxIDw9IHByZXZXb3JkLmVuZCkge1xuXHRcdFx0cmV0dXJuIFdvcmRPcGVyYXRpb25zLl9jcmVhdGVXb3JkQXRQb3NpdGlvbihtb2RlbCwgcG9zaXRpb24ubGluZU51bWJlciwgcHJldldvcmQpO1xuXHRcdH1cblx0XHRjb25zdCBuZXh0V29yZCA9IFdvcmRPcGVyYXRpb25zLl9maW5kTmV4dFdvcmRPbkxpbmUod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBwb3NpdGlvbik7XG5cdFx0aWYgKG5leHRXb3JkICYmIG5leHRXb3JkLndvcmRUeXBlID09PSBXb3JkVHlwZS5SZWd1bGFyICYmIG5leHRXb3JkLnN0YXJ0IDw9IHBvc2l0aW9uLmNvbHVtbiAtIDEgJiYgcG9zaXRpb24uY29sdW1uIC0gMSA8PSBuZXh0V29yZC5lbmQpIHtcblx0XHRcdHJldHVybiBXb3JkT3BlcmF0aW9ucy5fY3JlYXRlV29yZEF0UG9zaXRpb24obW9kZWwsIHBvc2l0aW9uLmxpbmVOdW1iZXIsIG5leHRXb3JkKTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHdvcmQoY29uZmlnOiBDdXJzb3JDb25maWd1cmF0aW9uLCBtb2RlbDogSUN1cnNvclNpbXBsZU1vZGVsLCBjdXJzb3I6IFNpbmdsZUN1cnNvclN0YXRlLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIHBvc2l0aW9uOiBQb3NpdGlvbik6IFNpbmdsZUN1cnNvclN0YXRlIHtcblx0XHRjb25zdCB3b3JkU2VwYXJhdG9ycyA9IGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKGNvbmZpZy53b3JkU2VwYXJhdG9ycywgY29uZmlnLndvcmRTZWdtZW50ZXJMb2NhbGVzKTtcblx0XHRjb25zdCBwcmV2V29yZCA9IFdvcmRPcGVyYXRpb25zLl9maW5kUHJldmlvdXNXb3JkT25MaW5lKHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgcG9zaXRpb24pO1xuXHRcdGNvbnN0IG5leHRXb3JkID0gV29yZE9wZXJhdGlvbnMuX2ZpbmROZXh0V29yZE9uTGluZSh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIHBvc2l0aW9uKTtcblxuXHRcdGlmICghaW5TZWxlY3Rpb25Nb2RlKSB7XG5cdFx0XHQvLyBFbnRlcmluZyB3b3JkIHNlbGVjdGlvbiBmb3IgdGhlIGZpcnN0IHRpbWVcblx0XHRcdGxldCBzdGFydENvbHVtbjogbnVtYmVyO1xuXHRcdFx0bGV0IGVuZENvbHVtbjogbnVtYmVyO1xuXG5cdFx0XHRpZiAocHJldldvcmQgJiYgcHJldldvcmQud29yZFR5cGUgPT09IFdvcmRUeXBlLlJlZ3VsYXIgJiYgcHJldldvcmQuc3RhcnQgPD0gcG9zaXRpb24uY29sdW1uIC0gMSAmJiBwb3NpdGlvbi5jb2x1bW4gLSAxIDw9IHByZXZXb3JkLmVuZCkge1xuXHRcdFx0XHQvLyBpc1RvdWNoaW5nUHJldldvcmRcblx0XHRcdFx0c3RhcnRDb2x1bW4gPSBwcmV2V29yZC5zdGFydCArIDE7XG5cdFx0XHRcdGVuZENvbHVtbiA9IHByZXZXb3JkLmVuZCArIDE7XG5cdFx0XHR9IGVsc2UgaWYgKG5leHRXb3JkICYmIG5leHRXb3JkLndvcmRUeXBlID09PSBXb3JkVHlwZS5SZWd1bGFyICYmIG5leHRXb3JkLnN0YXJ0IDw9IHBvc2l0aW9uLmNvbHVtbiAtIDEgJiYgcG9zaXRpb24uY29sdW1uIC0gMSA8PSBuZXh0V29yZC5lbmQpIHtcblx0XHRcdFx0Ly8gaXNUb3VjaGluZ05leHRXb3JkXG5cdFx0XHRcdHN0YXJ0Q29sdW1uID0gbmV4dFdvcmQuc3RhcnQgKyAxO1xuXHRcdFx0XHRlbmRDb2x1bW4gPSBuZXh0V29yZC5lbmQgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHByZXZXb3JkKSB7XG5cdFx0XHRcdFx0c3RhcnRDb2x1bW4gPSBwcmV2V29yZC5lbmQgKyAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobmV4dFdvcmQpIHtcblx0XHRcdFx0XHRlbmRDb2x1bW4gPSBuZXh0V29yZC5zdGFydCArIDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW5kQ29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbmV3IFNpbmdsZUN1cnNvclN0YXRlKFxuXHRcdFx0XHRuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgc3RhcnRDb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIGVuZENvbHVtbiksIFNlbGVjdGlvblN0YXJ0S2luZC5Xb3JkLCAwLFxuXHRcdFx0XHRuZXcgUG9zaXRpb24ocG9zaXRpb24ubGluZU51bWJlciwgZW5kQ29sdW1uKSwgMFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRsZXQgc3RhcnRDb2x1bW46IG51bWJlcjtcblx0XHRsZXQgZW5kQ29sdW1uOiBudW1iZXI7XG5cblx0XHRpZiAocHJldldvcmQgJiYgcHJldldvcmQud29yZFR5cGUgPT09IFdvcmRUeXBlLlJlZ3VsYXIgJiYgcHJldldvcmQuc3RhcnQgPCBwb3NpdGlvbi5jb2x1bW4gLSAxICYmIHBvc2l0aW9uLmNvbHVtbiAtIDEgPCBwcmV2V29yZC5lbmQpIHtcblx0XHRcdC8vIGlzSW5zaWRlUHJldldvcmRcblx0XHRcdHN0YXJ0Q29sdW1uID0gcHJldldvcmQuc3RhcnQgKyAxO1xuXHRcdFx0ZW5kQ29sdW1uID0gcHJldldvcmQuZW5kICsgMTtcblx0XHR9IGVsc2UgaWYgKG5leHRXb3JkICYmIG5leHRXb3JkLndvcmRUeXBlID09PSBXb3JkVHlwZS5SZWd1bGFyICYmIG5leHRXb3JkLnN0YXJ0IDwgcG9zaXRpb24uY29sdW1uIC0gMSAmJiBwb3NpdGlvbi5jb2x1bW4gLSAxIDwgbmV4dFdvcmQuZW5kKSB7XG5cdFx0XHQvLyBpc0luc2lkZU5leHRXb3JkXG5cdFx0XHRzdGFydENvbHVtbiA9IG5leHRXb3JkLnN0YXJ0ICsgMTtcblx0XHRcdGVuZENvbHVtbiA9IG5leHRXb3JkLmVuZCArIDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0YXJ0Q29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXHRcdFx0ZW5kQ29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdGxldCBjb2x1bW46IG51bWJlcjtcblx0XHRpZiAoY3Vyc29yLnNlbGVjdGlvblN0YXJ0LmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKSB7XG5cdFx0XHRjb2x1bW4gPSBjdXJzb3Iuc2VsZWN0aW9uU3RhcnQuZW5kQ29sdW1uO1xuXHRcdH0gZWxzZSBpZiAocG9zaXRpb24uaXNCZWZvcmVPckVxdWFsKGN1cnNvci5zZWxlY3Rpb25TdGFydC5nZXRTdGFydFBvc2l0aW9uKCkpKSB7XG5cdFx0XHRjb2x1bW4gPSBzdGFydENvbHVtbjtcblx0XHRcdGNvbnN0IHBvc3NpYmxlUG9zaXRpb24gPSBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0XHRcdGlmIChjdXJzb3Iuc2VsZWN0aW9uU3RhcnQuY29udGFpbnNQb3NpdGlvbihwb3NzaWJsZVBvc2l0aW9uKSkge1xuXHRcdFx0XHRjb2x1bW4gPSBjdXJzb3Iuc2VsZWN0aW9uU3RhcnQuZW5kQ29sdW1uO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb2x1bW4gPSBlbmRDb2x1bW47XG5cdFx0XHRjb25zdCBwb3NzaWJsZVBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cdFx0XHRpZiAoY3Vyc29yLnNlbGVjdGlvblN0YXJ0LmNvbnRhaW5zUG9zaXRpb24ocG9zc2libGVQb3NpdGlvbikpIHtcblx0XHRcdFx0Y29sdW1uID0gY3Vyc29yLnNlbGVjdGlvblN0YXJ0LnN0YXJ0Q29sdW1uO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBjdXJzb3IubW92ZSh0cnVlLCBsaW5lTnVtYmVyLCBjb2x1bW4sIDApO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JkUGFydE9wZXJhdGlvbnMgZXh0ZW5kcyBXb3JkT3BlcmF0aW9ucyB7XG5cdHB1YmxpYyBzdGF0aWMgZGVsZXRlV29yZFBhcnRMZWZ0KGN0eDogRGVsZXRlV29yZENvbnRleHQpOiBSYW5nZSB7XG5cdFx0Y29uc3QgY2FuZGlkYXRlcyA9IGVuZm9yY2VEZWZpbmVkKFtcblx0XHRcdFdvcmRPcGVyYXRpb25zLmRlbGV0ZVdvcmRMZWZ0KGN0eCwgV29yZE5hdmlnYXRpb25UeXBlLldvcmRTdGFydCksXG5cdFx0XHRXb3JkT3BlcmF0aW9ucy5kZWxldGVXb3JkTGVmdChjdHgsIFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkRW5kKSxcblx0XHRcdFdvcmRPcGVyYXRpb25zLl9kZWxldGVXb3JkUGFydExlZnQoY3R4Lm1vZGVsLCBjdHguc2VsZWN0aW9uKVxuXHRcdF0pO1xuXHRcdGNhbmRpZGF0ZXMuc29ydChSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdFbmRzKTtcblx0XHRyZXR1cm4gY2FuZGlkYXRlc1syXTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVsZXRlV29yZFBhcnRSaWdodChjdHg6IERlbGV0ZVdvcmRDb250ZXh0KTogUmFuZ2Uge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSBlbmZvcmNlRGVmaW5lZChbXG5cdFx0XHRXb3JkT3BlcmF0aW9ucy5kZWxldGVXb3JkUmlnaHQoY3R4LCBXb3JkTmF2aWdhdGlvblR5cGUuV29yZFN0YXJ0KSxcblx0XHRcdFdvcmRPcGVyYXRpb25zLmRlbGV0ZVdvcmRSaWdodChjdHgsIFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkRW5kKSxcblx0XHRcdFdvcmRPcGVyYXRpb25zLl9kZWxldGVXb3JkUGFydFJpZ2h0KGN0eC5tb2RlbCwgY3R4LnNlbGVjdGlvbilcblx0XHRdKTtcblx0XHRjYW5kaWRhdGVzLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblx0XHRyZXR1cm4gY2FuZGlkYXRlc1swXTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgbW92ZVdvcmRQYXJ0TGVmdCh3b3JkU2VwYXJhdG9yczogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgaGFzTXVsdGljdXJzb3I6IGJvb2xlYW4pOiBQb3NpdGlvbiB7XG5cdFx0Y29uc3QgY2FuZGlkYXRlcyA9IGVuZm9yY2VEZWZpbmVkKFtcblx0XHRcdFdvcmRPcGVyYXRpb25zLm1vdmVXb3JkTGVmdCh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIHBvc2l0aW9uLCBXb3JkTmF2aWdhdGlvblR5cGUuV29yZFN0YXJ0LCBoYXNNdWx0aWN1cnNvciksXG5cdFx0XHRXb3JkT3BlcmF0aW9ucy5tb3ZlV29yZExlZnQod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBwb3NpdGlvbiwgV29yZE5hdmlnYXRpb25UeXBlLldvcmRFbmQsIGhhc011bHRpY3Vyc29yKSxcblx0XHRcdFdvcmRPcGVyYXRpb25zLl9tb3ZlV29yZFBhcnRMZWZ0KG1vZGVsLCBwb3NpdGlvbilcblx0XHRdKTtcblx0XHRjYW5kaWRhdGVzLnNvcnQoUG9zaXRpb24uY29tcGFyZSk7XG5cdFx0cmV0dXJuIGNhbmRpZGF0ZXNbMl07XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIG1vdmVXb3JkUGFydFJpZ2h0KHdvcmRTZXBhcmF0b3JzOiBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciwgbW9kZWw6IElDdXJzb3JTaW1wbGVNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uKTogUG9zaXRpb24ge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSBlbmZvcmNlRGVmaW5lZChbXG5cdFx0XHRXb3JkT3BlcmF0aW9ucy5tb3ZlV29yZFJpZ2h0KHdvcmRTZXBhcmF0b3JzLCBtb2RlbCwgcG9zaXRpb24sIFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkU3RhcnQpLFxuXHRcdFx0V29yZE9wZXJhdGlvbnMubW92ZVdvcmRSaWdodCh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIHBvc2l0aW9uLCBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEVuZCksXG5cdFx0XHRXb3JkT3BlcmF0aW9ucy5fbW92ZVdvcmRQYXJ0UmlnaHQobW9kZWwsIHBvc2l0aW9uKVxuXHRcdF0pO1xuXHRcdGNhbmRpZGF0ZXMuc29ydChQb3NpdGlvbi5jb21wYXJlKTtcblx0XHRyZXR1cm4gY2FuZGlkYXRlc1swXTtcblx0fVxufVxuXG5mdW5jdGlvbiBlbmZvcmNlRGVmaW5lZDxUPihhcnI6IEFycmF5PFQgfCB1bmRlZmluZWQgfCBudWxsPik6IFRbXSB7XG5cdHJldHVybiA8VFtdPmFyci5maWx0ZXIoZWwgPT4gQm9vbGVhbihlbCkpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxhQUFhO0FBRXpCLFNBQWtELG9CQUFvQix5QkFBeUI7QUFDL0YsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxvQkFBa0UsK0JBQStCO0FBQzFHLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQXlCdEIsSUFBVyxXQUFYLGtCQUFXQSxjQUFYO0FBQ0MsRUFBQUEsb0JBQUEsVUFBTyxLQUFQO0FBQ0EsRUFBQUEsb0JBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsb0JBQUEsZUFBWSxLQUFaO0FBSFUsU0FBQUE7QUFBQSxHQUFBO0FBTUosSUFBVyxxQkFBWCxrQkFBV0Msd0JBQVg7QUFDTixFQUFBQSx3Q0FBQSxlQUFZLEtBQVo7QUFDQSxFQUFBQSx3Q0FBQSxtQkFBZ0IsS0FBaEI7QUFDQSxFQUFBQSx3Q0FBQSxhQUFVLEtBQVY7QUFDQSxFQUFBQSx3Q0FBQSx1QkFBb0IsS0FBcEI7QUFKaUIsU0FBQUE7QUFBQSxHQUFBO0FBbUJYLE1BQU0sZUFBZTtBQUFBLEVBRTNCLE9BQWUsWUFBWSxhQUFxQixVQUFvQixlQUFtQyxPQUFlLEtBQThCO0FBRW5KLFdBQU8sRUFBRSxPQUFjLEtBQVUsVUFBb0IsY0FBNkI7QUFBQSxFQUNuRjtBQUFBLEVBRUEsT0FBZSxnQkFBZ0IsVUFBK0IsZUFBb0Q7QUFF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LHdCQUF3QjtBQUM5QyxXQUFPLFdBQVcsQ0FBQztBQUFBLEVBQ3BCO0FBQUEsRUFFQSxPQUFjLGlCQUFpQixnQkFBeUMsT0FBMkIsVUFBb0IsZ0JBQW1DO0FBQ3pKLFVBQU0sYUFBYSxlQUFlO0FBQUEsTUFDakMsZUFBZSxhQUFhLGdCQUFnQixPQUFPLFVBQVUsbUJBQThCLGNBQWM7QUFBQSxNQUN6RyxlQUFlLGFBQWEsZ0JBQWdCLE9BQU8sVUFBVSxpQkFBNEIsY0FBYztBQUFBLE1BQ3ZHLGVBQWUsa0JBQWtCLE9BQU8sUUFBUTtBQUFBLElBQ2pELENBQUM7QUFDRCxlQUFXLEtBQUssU0FBUyxPQUFPO0FBQ2hDLFdBQU8sV0FBVyxDQUFDO0FBQUEsRUFDcEI7QUFBQSxFQUVBLE9BQWMsa0JBQWtCLGdCQUF5QyxPQUEyQixVQUE4QjtBQUNqSSxVQUFNLGFBQWEsZUFBZTtBQUFBLE1BQ2pDLGVBQWUsY0FBYyxnQkFBZ0IsT0FBTyxVQUFVLGlCQUE0QjtBQUFBLE1BQzFGLGVBQWUsY0FBYyxnQkFBZ0IsT0FBTyxVQUFVLGVBQTBCO0FBQUEsTUFDeEYsZUFBZSxtQkFBbUIsT0FBTyxRQUFRO0FBQUEsSUFDbEQsQ0FBQztBQUNELGVBQVcsS0FBSyxTQUFTLE9BQU87QUFDaEMsV0FBTyxXQUFXLENBQUM7QUFBQSxFQUNwQjtBQUNEO0FBRUEsU0FBUyxlQUFrQixLQUF1QztBQUNqRSxTQUFZLElBQUksT0FBTyxRQUFNLFFBQVEsRUFBRSxDQUFDO0FBQ3pDOyIsCiAgIm5hbWVzIjogWyJXb3JkVHlwZSIsICJXb3JkTmF2aWdhdGlvblR5cGUiLCAicG9zaXRpb24iLCAic3RhcnRDb2x1bW4iLCAiZW5kQ29sdW1uIl0KfQo=
