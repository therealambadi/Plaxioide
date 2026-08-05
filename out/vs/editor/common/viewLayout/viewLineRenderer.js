import * as nls from "../../../nls.js";
import { CharCode } from "../../../base/common/charCode.js";
import * as strings from "../../../base/common/strings.js";
import { StringBuilder } from "../core/stringBuilder.js";
import { LineDecoration, LineDecorationsNormalizer } from "./lineDecorations.js";
import { InlineDecorationType } from "../viewModel.js";
import { LinePart, LinePartMetadata } from "./linePart.js";
var RenderWhitespace = /* @__PURE__ */ ((RenderWhitespace2) => {
  RenderWhitespace2[RenderWhitespace2["None"] = 0] = "None";
  RenderWhitespace2[RenderWhitespace2["Boundary"] = 1] = "Boundary";
  RenderWhitespace2[RenderWhitespace2["Selection"] = 2] = "Selection";
  RenderWhitespace2[RenderWhitespace2["Trailing"] = 3] = "Trailing";
  RenderWhitespace2[RenderWhitespace2["All"] = 4] = "All";
  return RenderWhitespace2;
})(RenderWhitespace || {});
class LineRange {
  constructor(startIndex, endIndex) {
    this.startOffset = startIndex;
    this.endOffset = endIndex;
  }
  equals(otherLineRange) {
    return this.startOffset === otherLineRange.startOffset && this.endOffset === otherLineRange.endOffset;
  }
}
class RenderLineInput {
  constructor(useMonospaceOptimizations, canUseHalfwidthRightwardsArrow, lineContent, continuesWithWrappedLine, isBasicASCII, containsRTL, fauxIndentLength, lineTokens, lineDecorations, tabSize, startVisibleColumn, spaceWidth, middotWidth, wsmiddotWidth, stopRenderingLineAfter, renderWhitespace, renderControlCharacters, fontLigatures, selectionsOnLine) {
    this.useMonospaceOptimizations = useMonospaceOptimizations;
    this.canUseHalfwidthRightwardsArrow = canUseHalfwidthRightwardsArrow;
    this.lineContent = lineContent;
    this.continuesWithWrappedLine = continuesWithWrappedLine;
    this.isBasicASCII = isBasicASCII;
    this.containsRTL = containsRTL;
    this.fauxIndentLength = fauxIndentLength;
    this.lineTokens = lineTokens;
    this.lineDecorations = lineDecorations.sort(LineDecoration.compare);
    this.tabSize = tabSize;
    this.startVisibleColumn = startVisibleColumn;
    this.spaceWidth = spaceWidth;
    this.stopRenderingLineAfter = stopRenderingLineAfter;
    this.renderWhitespace = renderWhitespace === "all" ? 4 /* All */ : renderWhitespace === "boundary" ? 1 /* Boundary */ : renderWhitespace === "selection" ? 2 /* Selection */ : renderWhitespace === "trailing" ? 3 /* Trailing */ : 0 /* None */;
    this.renderControlCharacters = renderControlCharacters;
    this.fontLigatures = fontLigatures;
    this.selectionsOnLine = selectionsOnLine && selectionsOnLine.sort((a, b) => a.startOffset < b.startOffset ? -1 : 1);
    const wsmiddotDiff = Math.abs(wsmiddotWidth - spaceWidth);
    const middotDiff = Math.abs(middotWidth - spaceWidth);
    if (wsmiddotDiff < middotDiff) {
      this.renderSpaceWidth = wsmiddotWidth;
      this.renderSpaceCharCode = 11825;
    } else {
      this.renderSpaceWidth = middotWidth;
      this.renderSpaceCharCode = 183;
    }
  }
  sameSelection(otherSelections) {
    if (this.selectionsOnLine === null) {
      return otherSelections === null;
    }
    if (otherSelections === null) {
      return false;
    }
    if (otherSelections.length !== this.selectionsOnLine.length) {
      return false;
    }
    for (let i = 0; i < this.selectionsOnLine.length; i++) {
      if (!this.selectionsOnLine[i].equals(otherSelections[i])) {
        return false;
      }
    }
    return true;
  }
  equals(other) {
    return this.useMonospaceOptimizations === other.useMonospaceOptimizations && this.canUseHalfwidthRightwardsArrow === other.canUseHalfwidthRightwardsArrow && this.lineContent === other.lineContent && this.continuesWithWrappedLine === other.continuesWithWrappedLine && this.isBasicASCII === other.isBasicASCII && this.containsRTL === other.containsRTL && this.fauxIndentLength === other.fauxIndentLength && this.tabSize === other.tabSize && this.startVisibleColumn === other.startVisibleColumn && this.spaceWidth === other.spaceWidth && this.renderSpaceWidth === other.renderSpaceWidth && this.renderSpaceCharCode === other.renderSpaceCharCode && this.stopRenderingLineAfter === other.stopRenderingLineAfter && this.renderWhitespace === other.renderWhitespace && this.renderControlCharacters === other.renderControlCharacters && this.fontLigatures === other.fontLigatures && LineDecoration.equalsArr(this.lineDecorations, other.lineDecorations) && this.lineTokens.equals(other.lineTokens) && this.sameSelection(other.selectionsOnLine);
  }
}
var CharacterMappingConstants = /* @__PURE__ */ ((CharacterMappingConstants2) => {
  CharacterMappingConstants2[CharacterMappingConstants2["PART_INDEX_MASK"] = 4294901760] = "PART_INDEX_MASK";
  CharacterMappingConstants2[CharacterMappingConstants2["CHAR_INDEX_MASK"] = 65535] = "CHAR_INDEX_MASK";
  CharacterMappingConstants2[CharacterMappingConstants2["CHAR_INDEX_OFFSET"] = 0] = "CHAR_INDEX_OFFSET";
  CharacterMappingConstants2[CharacterMappingConstants2["PART_INDEX_OFFSET"] = 16] = "PART_INDEX_OFFSET";
  return CharacterMappingConstants2;
})(CharacterMappingConstants || {});
class DomPosition {
  constructor(partIndex, charIndex) {
    this.partIndex = partIndex;
    this.charIndex = charIndex;
  }
}
class CharacterMapping {
  static getPartIndex(partData) {
    return (partData & 4294901760 /* PART_INDEX_MASK */) >>> 16 /* PART_INDEX_OFFSET */;
  }
  static getCharIndex(partData) {
    return (partData & 65535 /* CHAR_INDEX_MASK */) >>> 0 /* CHAR_INDEX_OFFSET */;
  }
  constructor(length, partCount) {
    this.length = length;
    this._data = new Uint32Array(this.length);
    this._horizontalOffset = new Uint32Array(this.length);
  }
  setColumnInfo(column, partIndex, charIndex, horizontalOffset) {
    const partData = (partIndex << 16 /* PART_INDEX_OFFSET */ | charIndex << 0 /* CHAR_INDEX_OFFSET */) >>> 0;
    this._data[column - 1] = partData;
    this._horizontalOffset[column - 1] = horizontalOffset;
  }
  getHorizontalOffset(column) {
    if (this._horizontalOffset.length === 0) {
      return 0;
    }
    return this._horizontalOffset[column - 1];
  }
  charOffsetToPartData(charOffset) {
    if (this.length === 0) {
      return 0;
    }
    if (charOffset < 0) {
      return this._data[0];
    }
    if (charOffset >= this.length) {
      return this._data[this.length - 1];
    }
    return this._data[charOffset];
  }
  getDomPosition(column) {
    const partData = this.charOffsetToPartData(column - 1);
    const partIndex = CharacterMapping.getPartIndex(partData);
    const charIndex = CharacterMapping.getCharIndex(partData);
    return new DomPosition(partIndex, charIndex);
  }
  getColumn(domPosition, partLength) {
    const charOffset = this.partDataToCharOffset(domPosition.partIndex, partLength, domPosition.charIndex);
    return charOffset + 1;
  }
  partDataToCharOffset(partIndex, partLength, charIndex) {
    if (this.length === 0) {
      return 0;
    }
    const searchEntry = (partIndex << 16 /* PART_INDEX_OFFSET */ | charIndex << 0 /* CHAR_INDEX_OFFSET */) >>> 0;
    let min = 0;
    let max = this.length - 1;
    while (min + 1 < max) {
      const mid = min + max >>> 1;
      const midEntry = this._data[mid];
      if (midEntry === searchEntry) {
        return mid;
      } else if (midEntry > searchEntry) {
        max = mid;
      } else {
        min = mid;
      }
    }
    if (min === max) {
      return min;
    }
    const minEntry = this._data[min];
    const maxEntry = this._data[max];
    if (minEntry === searchEntry) {
      return min;
    }
    if (maxEntry === searchEntry) {
      return max;
    }
    const minPartIndex = CharacterMapping.getPartIndex(minEntry);
    const minCharIndex = CharacterMapping.getCharIndex(minEntry);
    const maxPartIndex = CharacterMapping.getPartIndex(maxEntry);
    let maxCharIndex;
    if (minPartIndex !== maxPartIndex) {
      maxCharIndex = partLength;
    } else {
      maxCharIndex = CharacterMapping.getCharIndex(maxEntry);
    }
    const minEntryDistance = charIndex - minCharIndex;
    const maxEntryDistance = maxCharIndex - charIndex;
    if (minEntryDistance <= maxEntryDistance) {
      return min;
    }
    return max;
  }
  inflate() {
    const result = [];
    for (let i = 0; i < this.length; i++) {
      const partData = this._data[i];
      const partIndex = CharacterMapping.getPartIndex(partData);
      const charIndex = CharacterMapping.getCharIndex(partData);
      const visibleColumn = this._horizontalOffset[i];
      result.push([partIndex, charIndex, visibleColumn]);
    }
    return result;
  }
}
var ForeignElementType = /* @__PURE__ */ ((ForeignElementType2) => {
  ForeignElementType2[ForeignElementType2["None"] = 0] = "None";
  ForeignElementType2[ForeignElementType2["Before"] = 1] = "Before";
  ForeignElementType2[ForeignElementType2["After"] = 2] = "After";
  return ForeignElementType2;
})(ForeignElementType || {});
class RenderLineOutput {
  constructor(characterMapping, containsRTL, containsForeignElements) {
    this._renderLineOutputBrand = void 0;
    this.characterMapping = characterMapping;
    this.containsRTL = containsRTL;
    this.containsForeignElements = containsForeignElements;
  }
}
function renderViewLine(input, sb) {
  if (input.lineContent.length === 0) {
    if (input.lineDecorations.length > 0) {
      sb.appendString(`<span>`);
      let beforeCount = 0;
      let afterCount = 0;
      let containsForeignElements = 0 /* None */;
      for (const lineDecoration of input.lineDecorations) {
        if (lineDecoration.type === InlineDecorationType.Before || lineDecoration.type === InlineDecorationType.After) {
          sb.appendString(`<span class="`);
          sb.appendString(lineDecoration.className);
          sb.appendString(`"></span>`);
          if (lineDecoration.type === InlineDecorationType.Before) {
            containsForeignElements |= 1 /* Before */;
            beforeCount++;
          }
          if (lineDecoration.type === InlineDecorationType.After) {
            containsForeignElements |= 2 /* After */;
            afterCount++;
          }
        }
      }
      sb.appendString(`</span>`);
      const characterMapping = new CharacterMapping(1, beforeCount + afterCount);
      characterMapping.setColumnInfo(1, beforeCount, 0, 0);
      return new RenderLineOutput(
        characterMapping,
        false,
        containsForeignElements
      );
    }
    sb.appendString("<span><span></span></span>");
    return new RenderLineOutput(
      new CharacterMapping(0, 0),
      false,
      0 /* None */
    );
  }
  return _renderLine(resolveRenderLineInput(input), sb);
}
class RenderLineOutput2 {
  constructor(characterMapping, html, containsRTL, containsForeignElements) {
    this.characterMapping = characterMapping;
    this.html = html;
    this.containsRTL = containsRTL;
    this.containsForeignElements = containsForeignElements;
  }
}
function renderViewLine2(input) {
  const sb = new StringBuilder(1e4);
  const out = renderViewLine(input, sb);
  return new RenderLineOutput2(out.characterMapping, sb.build(), out.containsRTL, out.containsForeignElements);
}
class ResolvedRenderLineInput {
  constructor(fontIsMonospace, canUseHalfwidthRightwardsArrow, lineContent, len, isOverflowing, overflowingCharCount, parts, containsForeignElements, fauxIndentLength, tabSize, startVisibleColumn, containsRTL, spaceWidth, renderSpaceCharCode, renderWhitespace, renderControlCharacters) {
    this.fontIsMonospace = fontIsMonospace;
    this.canUseHalfwidthRightwardsArrow = canUseHalfwidthRightwardsArrow;
    this.lineContent = lineContent;
    this.len = len;
    this.isOverflowing = isOverflowing;
    this.overflowingCharCount = overflowingCharCount;
    this.parts = parts;
    this.containsForeignElements = containsForeignElements;
    this.fauxIndentLength = fauxIndentLength;
    this.tabSize = tabSize;
    this.startVisibleColumn = startVisibleColumn;
    this.containsRTL = containsRTL;
    this.spaceWidth = spaceWidth;
    this.renderSpaceCharCode = renderSpaceCharCode;
    this.renderWhitespace = renderWhitespace;
    this.renderControlCharacters = renderControlCharacters;
  }
}
function resolveRenderLineInput(input) {
  const lineContent = input.lineContent;
  let isOverflowing;
  let overflowingCharCount;
  let len;
  if (input.stopRenderingLineAfter !== -1 && input.stopRenderingLineAfter < lineContent.length) {
    isOverflowing = true;
    overflowingCharCount = lineContent.length - input.stopRenderingLineAfter;
    len = input.stopRenderingLineAfter;
  } else {
    isOverflowing = false;
    overflowingCharCount = 0;
    len = lineContent.length;
  }
  let tokens = transformAndRemoveOverflowing(lineContent, input.containsRTL, input.lineTokens, input.fauxIndentLength, len);
  if (input.renderControlCharacters && !input.isBasicASCII) {
    tokens = extractControlCharacters(lineContent, tokens);
  }
  if (input.renderWhitespace === 4 /* All */ || input.renderWhitespace === 1 /* Boundary */ || input.renderWhitespace === 2 /* Selection */ && !!input.selectionsOnLine || input.renderWhitespace === 3 /* Trailing */ && !input.continuesWithWrappedLine) {
    tokens = _applyRenderWhitespace(input, lineContent, len, tokens);
  }
  let containsForeignElements = 0 /* None */;
  if (input.lineDecorations.length > 0) {
    for (let i = 0, len2 = input.lineDecorations.length; i < len2; i++) {
      const lineDecoration = input.lineDecorations[i];
      if (lineDecoration.type === InlineDecorationType.RegularAffectingLetterSpacing) {
        containsForeignElements |= 1 /* Before */;
      } else if (lineDecoration.type === InlineDecorationType.Before) {
        containsForeignElements |= 1 /* Before */;
      } else if (lineDecoration.type === InlineDecorationType.After) {
        containsForeignElements |= 2 /* After */;
      }
    }
    tokens = _applyInlineDecorations(lineContent, len, tokens, input.lineDecorations);
  }
  if (!input.containsRTL) {
    tokens = splitLargeTokens(lineContent, tokens, !input.isBasicASCII || input.fontLigatures);
  }
  return new ResolvedRenderLineInput(
    input.useMonospaceOptimizations,
    input.canUseHalfwidthRightwardsArrow,
    lineContent,
    len,
    isOverflowing,
    overflowingCharCount,
    tokens,
    containsForeignElements,
    input.fauxIndentLength,
    input.tabSize,
    input.startVisibleColumn,
    input.containsRTL,
    input.spaceWidth,
    input.renderSpaceCharCode,
    input.renderWhitespace,
    input.renderControlCharacters
  );
}
function transformAndRemoveOverflowing(lineContent, lineContainsRTL, tokens, fauxIndentLength, len) {
  const result = [];
  let resultLen = 0;
  if (fauxIndentLength > 0) {
    result[resultLen++] = new LinePart(fauxIndentLength, "", 0, false);
  }
  let startOffset = fauxIndentLength;
  for (let tokenIndex = 0, tokensLen = tokens.getCount(); tokenIndex < tokensLen; tokenIndex++) {
    const endIndex = tokens.getEndOffset(tokenIndex);
    if (endIndex <= fauxIndentLength) {
      continue;
    }
    const type = tokens.getClassName(tokenIndex);
    if (endIndex >= len) {
      const tokenContainsRTL2 = lineContainsRTL ? strings.containsRTL(lineContent.substring(startOffset, len)) : false;
      result[resultLen++] = new LinePart(len, type, 0, tokenContainsRTL2);
      break;
    }
    const tokenContainsRTL = lineContainsRTL ? strings.containsRTL(lineContent.substring(startOffset, endIndex)) : false;
    result[resultLen++] = new LinePart(endIndex, type, 0, tokenContainsRTL);
    startOffset = endIndex;
  }
  return result;
}
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["LongToken"] = 50] = "LongToken";
  return Constants2;
})(Constants || {});
function splitLargeTokens(lineContent, tokens, onlyAtSpaces) {
  let lastTokenEndIndex = 0;
  const result = [];
  let resultLen = 0;
  if (onlyAtSpaces) {
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const tokenEndIndex = token.endIndex;
      if (lastTokenEndIndex + 50 /* LongToken */ < tokenEndIndex) {
        const tokenType = token.type;
        const tokenMetadata = token.metadata;
        const tokenContainsRTL = token.containsRTL;
        let lastSpaceOffset = -1;
        let currTokenStart = lastTokenEndIndex;
        for (let j = lastTokenEndIndex; j < tokenEndIndex; j++) {
          if (lineContent.charCodeAt(j) === CharCode.Space) {
            lastSpaceOffset = j;
          }
          if (lastSpaceOffset !== -1 && j - currTokenStart >= 50 /* LongToken */) {
            result[resultLen++] = new LinePart(lastSpaceOffset + 1, tokenType, tokenMetadata, tokenContainsRTL);
            currTokenStart = lastSpaceOffset + 1;
            lastSpaceOffset = -1;
          }
        }
        if (currTokenStart !== tokenEndIndex) {
          result[resultLen++] = new LinePart(tokenEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
        }
      } else {
        result[resultLen++] = token;
      }
      lastTokenEndIndex = tokenEndIndex;
    }
  } else {
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const tokenEndIndex = token.endIndex;
      const diff = tokenEndIndex - lastTokenEndIndex;
      if (diff > 50 /* LongToken */) {
        const tokenType = token.type;
        const tokenMetadata = token.metadata;
        const tokenContainsRTL = token.containsRTL;
        const piecesCount = Math.ceil(diff / 50 /* LongToken */);
        for (let j = 1; j < piecesCount; j++) {
          const pieceEndIndex = lastTokenEndIndex + j * 50 /* LongToken */;
          result[resultLen++] = new LinePart(pieceEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
        }
        result[resultLen++] = new LinePart(tokenEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
      } else {
        result[resultLen++] = token;
      }
      lastTokenEndIndex = tokenEndIndex;
    }
  }
  return result;
}
function isControlCharacter(charCode) {
  if (charCode < 32) {
    return charCode !== CharCode.Tab;
  }
  if (charCode === 127) {
    return true;
  }
  if (charCode >= 8234 && charCode <= 8238 || charCode >= 8294 && charCode <= 8297 || charCode >= 8206 && charCode <= 8207 || charCode === 1564) {
    return true;
  }
  return false;
}
function extractControlCharacters(lineContent, tokens) {
  const result = [];
  let lastLinePart = new LinePart(0, "", 0, false);
  let charOffset = 0;
  for (const token of tokens) {
    const tokenEndIndex = token.endIndex;
    for (; charOffset < tokenEndIndex; charOffset++) {
      const charCode = lineContent.charCodeAt(charOffset);
      if (isControlCharacter(charCode)) {
        if (charOffset > lastLinePart.endIndex) {
          lastLinePart = new LinePart(charOffset, token.type, token.metadata, token.containsRTL);
          result.push(lastLinePart);
        }
        lastLinePart = new LinePart(charOffset + 1, "mtkcontrol", token.metadata, false);
        result.push(lastLinePart);
      }
    }
    if (charOffset > lastLinePart.endIndex) {
      lastLinePart = new LinePart(tokenEndIndex, token.type, token.metadata, token.containsRTL);
      result.push(lastLinePart);
    }
  }
  return result;
}
function _applyRenderWhitespace(input, lineContent, len, tokens) {
  const continuesWithWrappedLine = input.continuesWithWrappedLine;
  const fauxIndentLength = input.fauxIndentLength;
  const tabSize = input.tabSize;
  const startVisibleColumn = input.startVisibleColumn;
  const useMonospaceOptimizations = input.useMonospaceOptimizations;
  const selections = input.selectionsOnLine;
  const onlyBoundary = input.renderWhitespace === 1 /* Boundary */;
  const onlyTrailing = input.renderWhitespace === 3 /* Trailing */;
  const generateLinePartForEachWhitespace = input.renderSpaceWidth !== input.spaceWidth;
  const result = [];
  let resultLen = 0;
  let tokenIndex = 0;
  let tokenType = tokens[tokenIndex].type;
  let tokenContainsRTL = tokens[tokenIndex].containsRTL;
  let tokenEndIndex = tokens[tokenIndex].endIndex;
  const tokensLength = tokens.length;
  let lineIsEmptyOrWhitespace = false;
  let firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineContent);
  let lastNonWhitespaceIndex;
  if (firstNonWhitespaceIndex === -1) {
    lineIsEmptyOrWhitespace = true;
    firstNonWhitespaceIndex = len;
    lastNonWhitespaceIndex = len;
  } else {
    lastNonWhitespaceIndex = strings.lastNonWhitespaceIndex(lineContent);
  }
  let wasInWhitespace = false;
  let currentSelectionIndex = 0;
  let currentSelection = selections && selections[currentSelectionIndex];
  let tmpIndent = startVisibleColumn % tabSize;
  for (let charIndex = fauxIndentLength; charIndex < len; charIndex++) {
    const chCode = lineContent.charCodeAt(charIndex);
    if (currentSelection && charIndex >= currentSelection.endOffset) {
      currentSelectionIndex++;
      currentSelection = selections && selections[currentSelectionIndex];
    }
    let isInWhitespace;
    if (charIndex < firstNonWhitespaceIndex || charIndex > lastNonWhitespaceIndex) {
      isInWhitespace = true;
    } else if (chCode === CharCode.Tab) {
      isInWhitespace = true;
    } else if (chCode === CharCode.Space) {
      if (onlyBoundary) {
        if (wasInWhitespace) {
          isInWhitespace = true;
        } else {
          const nextChCode = charIndex + 1 < len ? lineContent.charCodeAt(charIndex + 1) : CharCode.Null;
          isInWhitespace = nextChCode === CharCode.Space || nextChCode === CharCode.Tab;
        }
      } else {
        isInWhitespace = true;
      }
    } else {
      isInWhitespace = false;
    }
    if (isInWhitespace && selections) {
      isInWhitespace = !!currentSelection && currentSelection.startOffset <= charIndex && currentSelection.endOffset > charIndex;
    }
    if (isInWhitespace && onlyTrailing) {
      isInWhitespace = lineIsEmptyOrWhitespace || charIndex > lastNonWhitespaceIndex;
    }
    if (isInWhitespace && tokenContainsRTL) {
      if (charIndex >= firstNonWhitespaceIndex && charIndex <= lastNonWhitespaceIndex) {
        isInWhitespace = false;
      }
    }
    if (wasInWhitespace) {
      if (!isInWhitespace || !useMonospaceOptimizations && tmpIndent >= tabSize) {
        if (generateLinePartForEachWhitespace) {
          const lastEndIndex = resultLen > 0 ? result[resultLen - 1].endIndex : fauxIndentLength;
          for (let i = lastEndIndex + 1; i <= charIndex; i++) {
            result[resultLen++] = new LinePart(i, "mtkw", LinePartMetadata.IS_WHITESPACE, false);
          }
        } else {
          result[resultLen++] = new LinePart(charIndex, "mtkw", LinePartMetadata.IS_WHITESPACE, false);
        }
        tmpIndent = tmpIndent % tabSize;
      }
    } else {
      if (charIndex === tokenEndIndex || isInWhitespace && charIndex > fauxIndentLength) {
        result[resultLen++] = new LinePart(charIndex, tokenType, 0, tokenContainsRTL);
        tmpIndent = tmpIndent % tabSize;
      }
    }
    if (chCode === CharCode.Tab) {
      tmpIndent = tabSize;
    } else if (strings.isFullWidthCharacter(chCode)) {
      tmpIndent += 2;
    } else {
      tmpIndent++;
    }
    wasInWhitespace = isInWhitespace;
    while (charIndex === tokenEndIndex) {
      tokenIndex++;
      if (tokenIndex < tokensLength) {
        tokenType = tokens[tokenIndex].type;
        tokenContainsRTL = tokens[tokenIndex].containsRTL;
        tokenEndIndex = tokens[tokenIndex].endIndex;
      } else {
        break;
      }
    }
  }
  let generateWhitespace = false;
  if (wasInWhitespace) {
    if (continuesWithWrappedLine && onlyBoundary) {
      const lastCharCode = len > 0 ? lineContent.charCodeAt(len - 1) : CharCode.Null;
      const prevCharCode = len > 1 ? lineContent.charCodeAt(len - 2) : CharCode.Null;
      const isSingleTrailingSpace = lastCharCode === CharCode.Space && (prevCharCode !== CharCode.Space && prevCharCode !== CharCode.Tab);
      if (!isSingleTrailingSpace) {
        generateWhitespace = true;
      }
    } else {
      generateWhitespace = true;
    }
  }
  if (generateWhitespace) {
    if (generateLinePartForEachWhitespace) {
      const lastEndIndex = resultLen > 0 ? result[resultLen - 1].endIndex : fauxIndentLength;
      for (let i = lastEndIndex + 1; i <= len; i++) {
        result[resultLen++] = new LinePart(i, "mtkw", LinePartMetadata.IS_WHITESPACE, false);
      }
    } else {
      result[resultLen++] = new LinePart(len, "mtkw", LinePartMetadata.IS_WHITESPACE, false);
    }
  } else {
    result[resultLen++] = new LinePart(len, tokenType, 0, tokenContainsRTL);
  }
  return result;
}
function _applyInlineDecorations(lineContent, len, tokens, _lineDecorations) {
  _lineDecorations.sort(LineDecoration.compare);
  const lineDecorations = LineDecorationsNormalizer.normalize(lineContent, _lineDecorations);
  const lineDecorationsLen = lineDecorations.length;
  let lineDecorationIndex = 0;
  const result = [];
  let resultLen = 0;
  let lastResultEndIndex = 0;
  for (let tokenIndex = 0, len2 = tokens.length; tokenIndex < len2; tokenIndex++) {
    const token = tokens[tokenIndex];
    const tokenEndIndex = token.endIndex;
    const tokenType = token.type;
    const tokenMetadata = token.metadata;
    const tokenContainsRTL = token.containsRTL;
    while (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset < tokenEndIndex) {
      const lineDecoration = lineDecorations[lineDecorationIndex];
      if (lineDecoration.startOffset > lastResultEndIndex) {
        lastResultEndIndex = lineDecoration.startOffset;
        result[resultLen++] = new LinePart(lastResultEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
      }
      if (lineDecoration.endOffset + 1 <= tokenEndIndex) {
        lastResultEndIndex = lineDecoration.endOffset + 1;
        result[resultLen++] = new LinePart(lastResultEndIndex, tokenType + " " + lineDecoration.className, tokenMetadata | lineDecoration.metadata, tokenContainsRTL);
        lineDecorationIndex++;
      } else {
        lastResultEndIndex = tokenEndIndex;
        result[resultLen++] = new LinePart(lastResultEndIndex, tokenType + " " + lineDecoration.className, tokenMetadata | lineDecoration.metadata, tokenContainsRTL);
        break;
      }
    }
    if (tokenEndIndex > lastResultEndIndex) {
      lastResultEndIndex = tokenEndIndex;
      result[resultLen++] = new LinePart(lastResultEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
    }
  }
  const lastTokenEndIndex = tokens[tokens.length - 1].endIndex;
  if (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset === lastTokenEndIndex) {
    while (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset === lastTokenEndIndex) {
      const lineDecoration = lineDecorations[lineDecorationIndex];
      result[resultLen++] = new LinePart(lastResultEndIndex, lineDecoration.className, lineDecoration.metadata, false);
      lineDecorationIndex++;
    }
  }
  return result;
}
function _renderLine(input, sb) {
  const fontIsMonospace = input.fontIsMonospace;
  const canUseHalfwidthRightwardsArrow = input.canUseHalfwidthRightwardsArrow;
  const containsForeignElements = input.containsForeignElements;
  const lineContent = input.lineContent;
  const len = input.len;
  const isOverflowing = input.isOverflowing;
  const overflowingCharCount = input.overflowingCharCount;
  const parts = input.parts;
  const fauxIndentLength = input.fauxIndentLength;
  const tabSize = input.tabSize;
  const startVisibleColumn = input.startVisibleColumn;
  const containsRTL = input.containsRTL;
  const spaceWidth = input.spaceWidth;
  const renderSpaceCharCode = input.renderSpaceCharCode;
  const renderWhitespace = input.renderWhitespace;
  const renderControlCharacters = input.renderControlCharacters;
  const characterMapping = new CharacterMapping(len + 1, parts.length);
  let lastCharacterMappingDefined = false;
  let charIndex = 0;
  let visibleColumn = startVisibleColumn;
  let charOffsetInPart = 0;
  let charHorizontalOffset = 0;
  let partDisplacement = 0;
  if (containsRTL) {
    sb.appendString('<span dir="ltr">');
  } else {
    sb.appendString("<span>");
  }
  for (let partIndex = 0, tokensLen = parts.length; partIndex < tokensLen; partIndex++) {
    const part = parts[partIndex];
    const partEndIndex = part.endIndex;
    const partType = part.type;
    const partContainsRTL = part.containsRTL;
    const partRendersWhitespace = renderWhitespace !== 0 /* None */ && part.isWhitespace();
    const partRendersWhitespaceWithWidth = partRendersWhitespace && !fontIsMonospace && (partType === "mtkw" || !containsForeignElements);
    const partIsEmptyAndHasPseudoAfter = charIndex === partEndIndex && part.isPseudoAfter();
    charOffsetInPart = 0;
    sb.appendString("<span ");
    if (partContainsRTL) {
      sb.appendString('style="unicode-bidi:isolate" ');
    }
    sb.appendString('class="');
    sb.appendString(partRendersWhitespaceWithWidth ? "mtkz" : partType);
    sb.appendASCIICharCode(CharCode.DoubleQuote);
    if (partRendersWhitespace) {
      let partWidth = 0;
      {
        let _charIndex = charIndex;
        let _visibleColumn = visibleColumn;
        for (; _charIndex < partEndIndex; _charIndex++) {
          const charCode = lineContent.charCodeAt(_charIndex);
          const charWidth = (charCode === CharCode.Tab ? tabSize - _visibleColumn % tabSize : 1) | 0;
          partWidth += charWidth;
          if (_charIndex >= fauxIndentLength) {
            _visibleColumn += charWidth;
          }
        }
      }
      if (partRendersWhitespaceWithWidth) {
        sb.appendString(' style="width:');
        sb.appendString(String(spaceWidth * partWidth));
        sb.appendString('px"');
      }
      sb.appendASCIICharCode(CharCode.GreaterThan);
      for (; charIndex < partEndIndex; charIndex++) {
        characterMapping.setColumnInfo(charIndex + 1, partIndex - partDisplacement, charOffsetInPart, charHorizontalOffset);
        partDisplacement = 0;
        const charCode = lineContent.charCodeAt(charIndex);
        let producedCharacters;
        let charWidth;
        if (charCode === CharCode.Tab) {
          producedCharacters = tabSize - visibleColumn % tabSize | 0;
          charWidth = producedCharacters;
          if (!canUseHalfwidthRightwardsArrow || charWidth > 1) {
            sb.appendCharCode(8594);
          } else {
            sb.appendCharCode(65515);
          }
          for (let space = 2; space <= charWidth; space++) {
            sb.appendCharCode(160);
          }
        } else {
          producedCharacters = 2;
          charWidth = 1;
          sb.appendCharCode(renderSpaceCharCode);
          sb.appendCharCode(8204);
        }
        charOffsetInPart += producedCharacters;
        charHorizontalOffset += charWidth;
        if (charIndex >= fauxIndentLength) {
          visibleColumn += charWidth;
        }
      }
    } else {
      sb.appendASCIICharCode(CharCode.GreaterThan);
      for (; charIndex < partEndIndex; charIndex++) {
        characterMapping.setColumnInfo(charIndex + 1, partIndex - partDisplacement, charOffsetInPart, charHorizontalOffset);
        partDisplacement = 0;
        const charCode = lineContent.charCodeAt(charIndex);
        let producedCharacters = 1;
        let charWidth = 1;
        switch (charCode) {
          case CharCode.Tab:
            producedCharacters = tabSize - visibleColumn % tabSize;
            charWidth = producedCharacters;
            for (let space = 1; space <= producedCharacters; space++) {
              sb.appendCharCode(160);
            }
            break;
          case CharCode.Space:
            sb.appendCharCode(160);
            break;
          case CharCode.LessThan:
            sb.appendString("&lt;");
            break;
          case CharCode.GreaterThan:
            sb.appendString("&gt;");
            break;
          case CharCode.Ampersand:
            sb.appendString("&amp;");
            break;
          case CharCode.Null:
            if (renderControlCharacters) {
              sb.appendCharCode(9216);
            } else {
              sb.appendString("&#00;");
            }
            break;
          case CharCode.UTF8_BOM:
          case CharCode.LINE_SEPARATOR:
          case CharCode.PARAGRAPH_SEPARATOR:
          case CharCode.NEXT_LINE:
            sb.appendCharCode(65533);
            break;
          default:
            if (strings.isFullWidthCharacter(charCode)) {
              charWidth++;
            }
            if (renderControlCharacters && charCode < 32) {
              sb.appendCharCode(9216 + charCode);
            } else if (renderControlCharacters && charCode === 127) {
              sb.appendCharCode(9249);
            } else if (renderControlCharacters && isControlCharacter(charCode)) {
              sb.appendString("[U+");
              sb.appendString(to4CharHex(charCode));
              sb.appendString("]");
              producedCharacters = 8;
              charWidth = producedCharacters;
            } else {
              sb.appendCharCode(charCode);
            }
        }
        charOffsetInPart += producedCharacters;
        charHorizontalOffset += charWidth;
        if (charIndex >= fauxIndentLength) {
          visibleColumn += charWidth;
        }
      }
    }
    if (partIsEmptyAndHasPseudoAfter) {
      partDisplacement++;
    } else {
      partDisplacement = 0;
    }
    if (charIndex >= len && !lastCharacterMappingDefined && part.isPseudoAfter()) {
      lastCharacterMappingDefined = true;
      characterMapping.setColumnInfo(charIndex + 1, partIndex, charOffsetInPart, charHorizontalOffset);
    }
    sb.appendString("</span>");
  }
  if (!lastCharacterMappingDefined) {
    characterMapping.setColumnInfo(len + 1, parts.length - 1, charOffsetInPart, charHorizontalOffset);
  }
  if (isOverflowing) {
    sb.appendString('<span class="mtkoverflow">');
    sb.appendString(nls.localize("showMore", "Show more ({0})", renderOverflowingCharCount(overflowingCharCount)));
    sb.appendString("</span>");
  }
  sb.appendString("</span>");
  return new RenderLineOutput(characterMapping, containsRTL, containsForeignElements);
}
function to4CharHex(n) {
  return n.toString(16).toUpperCase().padStart(4, "0");
}
function renderOverflowingCharCount(n) {
  if (n < 1024) {
    return nls.localize("overflow.chars", "{0} chars", n);
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export {
  CharacterMapping,
  DomPosition,
  ForeignElementType,
  LineRange,
  RenderLineInput,
  RenderLineOutput,
  RenderLineOutput2,
  RenderWhitespace,
  renderViewLine,
  renderViewLine2
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVSZW5kZXJlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSVZpZXdMaW5lVG9rZW5zIH0gZnJvbSAnLi4vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgU3RyaW5nQnVpbGRlciB9IGZyb20gJy4uL2NvcmUvc3RyaW5nQnVpbGRlci5qcyc7XG5pbXBvcnQgeyBMaW5lRGVjb3JhdGlvbiwgTGluZURlY29yYXRpb25zTm9ybWFsaXplciB9IGZyb20gJy4vbGluZURlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IElubGluZURlY29yYXRpb25UeXBlIH0gZnJvbSAnLi4vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IExpbmVQYXJ0LCBMaW5lUGFydE1ldGFkYXRhIH0gZnJvbSAnLi9saW5lUGFydC5qcyc7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFJlbmRlcldoaXRlc3BhY2Uge1xuXHROb25lID0gMCxcblx0Qm91bmRhcnkgPSAxLFxuXHRTZWxlY3Rpb24gPSAyLFxuXHRUcmFpbGluZyA9IDMsXG5cdEFsbCA9IDRcbn1cblxuZXhwb3J0IGNsYXNzIExpbmVSYW5nZSB7XG5cdC8qKlxuXHQgKiBaZXJvLWJhc2VkIG9mZnNldCBvbiB3aGljaCB0aGUgcmFuZ2Ugc3RhcnRzLCBpbmNsdXNpdmUuXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgc3RhcnRPZmZzZXQ6IG51bWJlcjtcblxuXHQvKipcblx0ICogWmVyby1iYXNlZCBvZmZzZXQgb24gd2hpY2ggdGhlIHJhbmdlIGVuZHMsIGluY2x1c2l2ZS5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBlbmRPZmZzZXQ6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihzdGFydEluZGV4OiBudW1iZXIsIGVuZEluZGV4OiBudW1iZXIpIHtcblx0XHR0aGlzLnN0YXJ0T2Zmc2V0ID0gc3RhcnRJbmRleDtcblx0XHR0aGlzLmVuZE9mZnNldCA9IGVuZEluZGV4O1xuXHR9XG5cblx0cHVibGljIGVxdWFscyhvdGhlckxpbmVSYW5nZTogTGluZVJhbmdlKSB7XG5cdFx0cmV0dXJuIHRoaXMuc3RhcnRPZmZzZXQgPT09IG90aGVyTGluZVJhbmdlLnN0YXJ0T2Zmc2V0XG5cdFx0XHQmJiB0aGlzLmVuZE9mZnNldCA9PT0gb3RoZXJMaW5lUmFuZ2UuZW5kT2Zmc2V0O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZW5kZXJMaW5lSW5wdXQge1xuXG5cdHB1YmxpYyByZWFkb25seSB1c2VNb25vc3BhY2VPcHRpbWl6YXRpb25zOiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93OiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGluZUNvbnRlbnQ6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IGNvbnRpbnVlc1dpdGhXcmFwcGVkTGluZTogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IGlzQmFzaWNBU0NJSTogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IGNvbnRhaW5zUlRMOiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgZmF1eEluZGVudExlbmd0aDogbnVtYmVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGluZVRva2VuczogSVZpZXdMaW5lVG9rZW5zO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGluZURlY29yYXRpb25zOiBMaW5lRGVjb3JhdGlvbltdO1xuXHRwdWJsaWMgcmVhZG9ubHkgdGFiU2l6ZTogbnVtYmVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgc3RhcnRWaXNpYmxlQ29sdW1uOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBzcGFjZVdpZHRoOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSByZW5kZXJTcGFjZVdpZHRoOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSByZW5kZXJTcGFjZUNoYXJDb2RlOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBzdG9wUmVuZGVyaW5nTGluZUFmdGVyOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSByZW5kZXJXaGl0ZXNwYWNlOiBSZW5kZXJXaGl0ZXNwYWNlO1xuXHRwdWJsaWMgcmVhZG9ubHkgcmVuZGVyQ29udHJvbENoYXJhY3RlcnM6IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBmb250TGlnYXR1cmVzOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBEZWZpbmVkIG9ubHkgd2hlbiByZW5kZXJXaGl0ZXNwYWNlIGlzICdzZWxlY3Rpb24nLiBTZWxlY3Rpb25zIGFyZSBub24tb3ZlcmxhcHBpbmcsXG5cdCAqIGFuZCBvcmRlcmVkIGJ5IHBvc2l0aW9uIHdpdGhpbiB0aGUgbGluZS5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBzZWxlY3Rpb25zT25MaW5lOiBMaW5lUmFuZ2VbXSB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0dXNlTW9ub3NwYWNlT3B0aW1pemF0aW9uczogYm9vbGVhbixcblx0XHRjYW5Vc2VIYWxmd2lkdGhSaWdodHdhcmRzQXJyb3c6IGJvb2xlYW4sXG5cdFx0bGluZUNvbnRlbnQ6IHN0cmluZyxcblx0XHRjb250aW51ZXNXaXRoV3JhcHBlZExpbmU6IGJvb2xlYW4sXG5cdFx0aXNCYXNpY0FTQ0lJOiBib29sZWFuLFxuXHRcdGNvbnRhaW5zUlRMOiBib29sZWFuLFxuXHRcdGZhdXhJbmRlbnRMZW5ndGg6IG51bWJlcixcblx0XHRsaW5lVG9rZW5zOiBJVmlld0xpbmVUb2tlbnMsXG5cdFx0bGluZURlY29yYXRpb25zOiBMaW5lRGVjb3JhdGlvbltdLFxuXHRcdHRhYlNpemU6IG51bWJlcixcblx0XHRzdGFydFZpc2libGVDb2x1bW46IG51bWJlcixcblx0XHRzcGFjZVdpZHRoOiBudW1iZXIsXG5cdFx0bWlkZG90V2lkdGg6IG51bWJlcixcblx0XHR3c21pZGRvdFdpZHRoOiBudW1iZXIsXG5cdFx0c3RvcFJlbmRlcmluZ0xpbmVBZnRlcjogbnVtYmVyLFxuXHRcdHJlbmRlcldoaXRlc3BhY2U6ICdub25lJyB8ICdib3VuZGFyeScgfCAnc2VsZWN0aW9uJyB8ICd0cmFpbGluZycgfCAnYWxsJyxcblx0XHRyZW5kZXJDb250cm9sQ2hhcmFjdGVyczogYm9vbGVhbixcblx0XHRmb250TGlnYXR1cmVzOiBib29sZWFuLFxuXHRcdHNlbGVjdGlvbnNPbkxpbmU6IExpbmVSYW5nZVtdIHwgbnVsbFxuXHQpIHtcblx0XHR0aGlzLnVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnMgPSB1c2VNb25vc3BhY2VPcHRpbWl6YXRpb25zO1xuXHRcdHRoaXMuY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93ID0gY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93O1xuXHRcdHRoaXMubGluZUNvbnRlbnQgPSBsaW5lQ29udGVudDtcblx0XHR0aGlzLmNvbnRpbnVlc1dpdGhXcmFwcGVkTGluZSA9IGNvbnRpbnVlc1dpdGhXcmFwcGVkTGluZTtcblx0XHR0aGlzLmlzQmFzaWNBU0NJSSA9IGlzQmFzaWNBU0NJSTtcblx0XHR0aGlzLmNvbnRhaW5zUlRMID0gY29udGFpbnNSVEw7XG5cdFx0dGhpcy5mYXV4SW5kZW50TGVuZ3RoID0gZmF1eEluZGVudExlbmd0aDtcblx0XHR0aGlzLmxpbmVUb2tlbnMgPSBsaW5lVG9rZW5zO1xuXHRcdHRoaXMubGluZURlY29yYXRpb25zID0gbGluZURlY29yYXRpb25zLnNvcnQoTGluZURlY29yYXRpb24uY29tcGFyZSk7XG5cdFx0dGhpcy50YWJTaXplID0gdGFiU2l6ZTtcblx0XHR0aGlzLnN0YXJ0VmlzaWJsZUNvbHVtbiA9IHN0YXJ0VmlzaWJsZUNvbHVtbjtcblx0XHR0aGlzLnNwYWNlV2lkdGggPSBzcGFjZVdpZHRoO1xuXHRcdHRoaXMuc3RvcFJlbmRlcmluZ0xpbmVBZnRlciA9IHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXI7XG5cdFx0dGhpcy5yZW5kZXJXaGl0ZXNwYWNlID0gKFxuXHRcdFx0cmVuZGVyV2hpdGVzcGFjZSA9PT0gJ2FsbCdcblx0XHRcdFx0PyBSZW5kZXJXaGl0ZXNwYWNlLkFsbFxuXHRcdFx0XHQ6IHJlbmRlcldoaXRlc3BhY2UgPT09ICdib3VuZGFyeSdcblx0XHRcdFx0XHQ/IFJlbmRlcldoaXRlc3BhY2UuQm91bmRhcnlcblx0XHRcdFx0XHQ6IHJlbmRlcldoaXRlc3BhY2UgPT09ICdzZWxlY3Rpb24nXG5cdFx0XHRcdFx0XHQ/IFJlbmRlcldoaXRlc3BhY2UuU2VsZWN0aW9uXG5cdFx0XHRcdFx0XHQ6IHJlbmRlcldoaXRlc3BhY2UgPT09ICd0cmFpbGluZydcblx0XHRcdFx0XHRcdFx0PyBSZW5kZXJXaGl0ZXNwYWNlLlRyYWlsaW5nXG5cdFx0XHRcdFx0XHRcdDogUmVuZGVyV2hpdGVzcGFjZS5Ob25lXG5cdFx0KTtcblx0XHR0aGlzLnJlbmRlckNvbnRyb2xDaGFyYWN0ZXJzID0gcmVuZGVyQ29udHJvbENoYXJhY3RlcnM7XG5cdFx0dGhpcy5mb250TGlnYXR1cmVzID0gZm9udExpZ2F0dXJlcztcblx0XHR0aGlzLnNlbGVjdGlvbnNPbkxpbmUgPSBzZWxlY3Rpb25zT25MaW5lICYmIHNlbGVjdGlvbnNPbkxpbmUuc29ydCgoYSwgYikgPT4gYS5zdGFydE9mZnNldCA8IGIuc3RhcnRPZmZzZXQgPyAtMSA6IDEpO1xuXG5cdFx0Y29uc3Qgd3NtaWRkb3REaWZmID0gTWF0aC5hYnMod3NtaWRkb3RXaWR0aCAtIHNwYWNlV2lkdGgpO1xuXHRcdGNvbnN0IG1pZGRvdERpZmYgPSBNYXRoLmFicyhtaWRkb3RXaWR0aCAtIHNwYWNlV2lkdGgpO1xuXHRcdGlmICh3c21pZGRvdERpZmYgPCBtaWRkb3REaWZmKSB7XG5cdFx0XHR0aGlzLnJlbmRlclNwYWNlV2lkdGggPSB3c21pZGRvdFdpZHRoO1xuXHRcdFx0dGhpcy5yZW5kZXJTcGFjZUNoYXJDb2RlID0gMHgyRTMxOyAvLyBVKzJFMzEgLSBXT1JEIFNFUEFSQVRPUiBNSURETEUgRE9UXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVuZGVyU3BhY2VXaWR0aCA9IG1pZGRvdFdpZHRoO1xuXHRcdFx0dGhpcy5yZW5kZXJTcGFjZUNoYXJDb2RlID0gMHhCNzsgLy8gVSswMEI3IC0gTUlERExFIERPVFxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2FtZVNlbGVjdGlvbihvdGhlclNlbGVjdGlvbnM6IExpbmVSYW5nZVtdIHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLnNlbGVjdGlvbnNPbkxpbmUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBvdGhlclNlbGVjdGlvbnMgPT09IG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKG90aGVyU2VsZWN0aW9ucyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChvdGhlclNlbGVjdGlvbnMubGVuZ3RoICE9PSB0aGlzLnNlbGVjdGlvbnNPbkxpbmUubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNlbGVjdGlvbnNPbkxpbmUubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICghdGhpcy5zZWxlY3Rpb25zT25MaW5lW2ldLmVxdWFscyhvdGhlclNlbGVjdGlvbnNbaV0pKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBlcXVhbHMob3RoZXI6IFJlbmRlckxpbmVJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoXG5cdFx0XHR0aGlzLnVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnMgPT09IG90aGVyLnVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnNcblx0XHRcdCYmIHRoaXMuY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93ID09PSBvdGhlci5jYW5Vc2VIYWxmd2lkdGhSaWdodHdhcmRzQXJyb3dcblx0XHRcdCYmIHRoaXMubGluZUNvbnRlbnQgPT09IG90aGVyLmxpbmVDb250ZW50XG5cdFx0XHQmJiB0aGlzLmNvbnRpbnVlc1dpdGhXcmFwcGVkTGluZSA9PT0gb3RoZXIuY29udGludWVzV2l0aFdyYXBwZWRMaW5lXG5cdFx0XHQmJiB0aGlzLmlzQmFzaWNBU0NJSSA9PT0gb3RoZXIuaXNCYXNpY0FTQ0lJXG5cdFx0XHQmJiB0aGlzLmNvbnRhaW5zUlRMID09PSBvdGhlci5jb250YWluc1JUTFxuXHRcdFx0JiYgdGhpcy5mYXV4SW5kZW50TGVuZ3RoID09PSBvdGhlci5mYXV4SW5kZW50TGVuZ3RoXG5cdFx0XHQmJiB0aGlzLnRhYlNpemUgPT09IG90aGVyLnRhYlNpemVcblx0XHRcdCYmIHRoaXMuc3RhcnRWaXNpYmxlQ29sdW1uID09PSBvdGhlci5zdGFydFZpc2libGVDb2x1bW5cblx0XHRcdCYmIHRoaXMuc3BhY2VXaWR0aCA9PT0gb3RoZXIuc3BhY2VXaWR0aFxuXHRcdFx0JiYgdGhpcy5yZW5kZXJTcGFjZVdpZHRoID09PSBvdGhlci5yZW5kZXJTcGFjZVdpZHRoXG5cdFx0XHQmJiB0aGlzLnJlbmRlclNwYWNlQ2hhckNvZGUgPT09IG90aGVyLnJlbmRlclNwYWNlQ2hhckNvZGVcblx0XHRcdCYmIHRoaXMuc3RvcFJlbmRlcmluZ0xpbmVBZnRlciA9PT0gb3RoZXIuc3RvcFJlbmRlcmluZ0xpbmVBZnRlclxuXHRcdFx0JiYgdGhpcy5yZW5kZXJXaGl0ZXNwYWNlID09PSBvdGhlci5yZW5kZXJXaGl0ZXNwYWNlXG5cdFx0XHQmJiB0aGlzLnJlbmRlckNvbnRyb2xDaGFyYWN0ZXJzID09PSBvdGhlci5yZW5kZXJDb250cm9sQ2hhcmFjdGVyc1xuXHRcdFx0JiYgdGhpcy5mb250TGlnYXR1cmVzID09PSBvdGhlci5mb250TGlnYXR1cmVzXG5cdFx0XHQmJiBMaW5lRGVjb3JhdGlvbi5lcXVhbHNBcnIodGhpcy5saW5lRGVjb3JhdGlvbnMsIG90aGVyLmxpbmVEZWNvcmF0aW9ucylcblx0XHRcdCYmIHRoaXMubGluZVRva2Vucy5lcXVhbHMob3RoZXIubGluZVRva2Vucylcblx0XHRcdCYmIHRoaXMuc2FtZVNlbGVjdGlvbihvdGhlci5zZWxlY3Rpb25zT25MaW5lKVxuXHRcdCk7XG5cdH1cbn1cblxuY29uc3QgZW51bSBDaGFyYWN0ZXJNYXBwaW5nQ29uc3RhbnRzIHtcblx0UEFSVF9JTkRFWF9NQVNLID0gMGIxMTExMTExMTExMTExMTExMDAwMDAwMDAwMDAwMDAwMCxcblx0Q0hBUl9JTkRFWF9NQVNLID0gMGIwMDAwMDAwMDAwMDAwMDAwMTExMTExMTExMTExMTExMSxcblxuXHRDSEFSX0lOREVYX09GRlNFVCA9IDAsXG5cdFBBUlRfSU5ERVhfT0ZGU0VUID0gMTZcbn1cblxuZXhwb3J0IGNsYXNzIERvbVBvc2l0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHBhcnRJbmRleDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBjaGFySW5kZXg6IG51bWJlclxuXHQpIHsgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIGEgYm90aCBkaXJlY3Rpb24gbWFwcGluZyBiZXR3ZWVuIGEgbGluZSdzIGNoYXJhY3RlciBhbmQgaXRzIHJlbmRlcmVkIHBvc2l0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgQ2hhcmFjdGVyTWFwcGluZyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgZ2V0UGFydEluZGV4KHBhcnREYXRhOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiAocGFydERhdGEgJiBDaGFyYWN0ZXJNYXBwaW5nQ29uc3RhbnRzLlBBUlRfSU5ERVhfTUFTSykgPj4+IENoYXJhY3Rlck1hcHBpbmdDb25zdGFudHMuUEFSVF9JTkRFWF9PRkZTRVQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRDaGFySW5kZXgocGFydERhdGE6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIChwYXJ0RGF0YSAmIENoYXJhY3Rlck1hcHBpbmdDb25zdGFudHMuQ0hBUl9JTkRFWF9NQVNLKSA+Pj4gQ2hhcmFjdGVyTWFwcGluZ0NvbnN0YW50cy5DSEFSX0lOREVYX09GRlNFVDtcblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSBsZW5ndGg6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfZGF0YTogVWludDMyQXJyYXk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hvcml6b250YWxPZmZzZXQ6IFVpbnQzMkFycmF5O1xuXG5cdGNvbnN0cnVjdG9yKGxlbmd0aDogbnVtYmVyLCBwYXJ0Q291bnQ6IG51bWJlcikge1xuXHRcdHRoaXMubGVuZ3RoID0gbGVuZ3RoO1xuXHRcdHRoaXMuX2RhdGEgPSBuZXcgVWludDMyQXJyYXkodGhpcy5sZW5ndGgpO1xuXHRcdHRoaXMuX2hvcml6b250YWxPZmZzZXQgPSBuZXcgVWludDMyQXJyYXkodGhpcy5sZW5ndGgpO1xuXHR9XG5cblx0cHVibGljIHNldENvbHVtbkluZm8oY29sdW1uOiBudW1iZXIsIHBhcnRJbmRleDogbnVtYmVyLCBjaGFySW5kZXg6IG51bWJlciwgaG9yaXpvbnRhbE9mZnNldDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcGFydERhdGEgPSAoXG5cdFx0XHQocGFydEluZGV4IDw8IENoYXJhY3Rlck1hcHBpbmdDb25zdGFudHMuUEFSVF9JTkRFWF9PRkZTRVQpXG5cdFx0XHR8IChjaGFySW5kZXggPDwgQ2hhcmFjdGVyTWFwcGluZ0NvbnN0YW50cy5DSEFSX0lOREVYX09GRlNFVClcblx0XHQpID4+PiAwO1xuXHRcdHRoaXMuX2RhdGFbY29sdW1uIC0gMV0gPSBwYXJ0RGF0YTtcblx0XHR0aGlzLl9ob3Jpem9udGFsT2Zmc2V0W2NvbHVtbiAtIDFdID0gaG9yaXpvbnRhbE9mZnNldDtcblx0fVxuXG5cdHB1YmxpYyBnZXRIb3Jpem9udGFsT2Zmc2V0KGNvbHVtbjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5faG9yaXpvbnRhbE9mZnNldC5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIE5vIGNoYXJhY3RlcnMgb24gdGhpcyBsaW5lXG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2hvcml6b250YWxPZmZzZXRbY29sdW1uIC0gMV07XG5cdH1cblxuXHRwcml2YXRlIGNoYXJPZmZzZXRUb1BhcnREYXRhKGNoYXJPZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKHRoaXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0aWYgKGNoYXJPZmZzZXQgPCAwKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZGF0YVswXTtcblx0XHR9XG5cdFx0aWYgKGNoYXJPZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9kYXRhW3RoaXMubGVuZ3RoIC0gMV07XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9kYXRhW2NoYXJPZmZzZXRdO1xuXHR9XG5cblx0cHVibGljIGdldERvbVBvc2l0aW9uKGNvbHVtbjogbnVtYmVyKTogRG9tUG9zaXRpb24ge1xuXHRcdGNvbnN0IHBhcnREYXRhID0gdGhpcy5jaGFyT2Zmc2V0VG9QYXJ0RGF0YShjb2x1bW4gLSAxKTtcblx0XHRjb25zdCBwYXJ0SW5kZXggPSBDaGFyYWN0ZXJNYXBwaW5nLmdldFBhcnRJbmRleChwYXJ0RGF0YSk7XG5cdFx0Y29uc3QgY2hhckluZGV4ID0gQ2hhcmFjdGVyTWFwcGluZy5nZXRDaGFySW5kZXgocGFydERhdGEpO1xuXHRcdHJldHVybiBuZXcgRG9tUG9zaXRpb24ocGFydEluZGV4LCBjaGFySW5kZXgpO1xuXHR9XG5cblx0cHVibGljIGdldENvbHVtbihkb21Qb3NpdGlvbjogRG9tUG9zaXRpb24sIHBhcnRMZW5ndGg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgY2hhck9mZnNldCA9IHRoaXMucGFydERhdGFUb0NoYXJPZmZzZXQoZG9tUG9zaXRpb24ucGFydEluZGV4LCBwYXJ0TGVuZ3RoLCBkb21Qb3NpdGlvbi5jaGFySW5kZXgpO1xuXHRcdHJldHVybiBjaGFyT2Zmc2V0ICsgMTtcblx0fVxuXG5cdHByaXZhdGUgcGFydERhdGFUb0NoYXJPZmZzZXQocGFydEluZGV4OiBudW1iZXIsIHBhcnRMZW5ndGg6IG51bWJlciwgY2hhckluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VhcmNoRW50cnkgPSAoXG5cdFx0XHQocGFydEluZGV4IDw8IENoYXJhY3Rlck1hcHBpbmdDb25zdGFudHMuUEFSVF9JTkRFWF9PRkZTRVQpXG5cdFx0XHR8IChjaGFySW5kZXggPDwgQ2hhcmFjdGVyTWFwcGluZ0NvbnN0YW50cy5DSEFSX0lOREVYX09GRlNFVClcblx0XHQpID4+PiAwO1xuXG5cdFx0bGV0IG1pbiA9IDA7XG5cdFx0bGV0IG1heCA9IHRoaXMubGVuZ3RoIC0gMTtcblx0XHR3aGlsZSAobWluICsgMSA8IG1heCkge1xuXHRcdFx0Y29uc3QgbWlkID0gKChtaW4gKyBtYXgpID4+PiAxKTtcblx0XHRcdGNvbnN0IG1pZEVudHJ5ID0gdGhpcy5fZGF0YVttaWRdO1xuXHRcdFx0aWYgKG1pZEVudHJ5ID09PSBzZWFyY2hFbnRyeSkge1xuXHRcdFx0XHRyZXR1cm4gbWlkO1xuXHRcdFx0fSBlbHNlIGlmIChtaWRFbnRyeSA+IHNlYXJjaEVudHJ5KSB7XG5cdFx0XHRcdG1heCA9IG1pZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1pbiA9IG1pZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobWluID09PSBtYXgpIHtcblx0XHRcdHJldHVybiBtaW47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWluRW50cnkgPSB0aGlzLl9kYXRhW21pbl07XG5cdFx0Y29uc3QgbWF4RW50cnkgPSB0aGlzLl9kYXRhW21heF07XG5cblx0XHRpZiAobWluRW50cnkgPT09IHNlYXJjaEVudHJ5KSB7XG5cdFx0XHRyZXR1cm4gbWluO1xuXHRcdH1cblx0XHRpZiAobWF4RW50cnkgPT09IHNlYXJjaEVudHJ5KSB7XG5cdFx0XHRyZXR1cm4gbWF4O1xuXHRcdH1cblxuXHRcdGNvbnN0IG1pblBhcnRJbmRleCA9IENoYXJhY3Rlck1hcHBpbmcuZ2V0UGFydEluZGV4KG1pbkVudHJ5KTtcblx0XHRjb25zdCBtaW5DaGFySW5kZXggPSBDaGFyYWN0ZXJNYXBwaW5nLmdldENoYXJJbmRleChtaW5FbnRyeSk7XG5cblx0XHRjb25zdCBtYXhQYXJ0SW5kZXggPSBDaGFyYWN0ZXJNYXBwaW5nLmdldFBhcnRJbmRleChtYXhFbnRyeSk7XG5cdFx0bGV0IG1heENoYXJJbmRleDogbnVtYmVyO1xuXG5cdFx0aWYgKG1pblBhcnRJbmRleCAhPT0gbWF4UGFydEluZGV4KSB7XG5cdFx0XHQvLyBzaXR0aW5nIGJldHdlZW4gcGFydHNcblx0XHRcdG1heENoYXJJbmRleCA9IHBhcnRMZW5ndGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1heENoYXJJbmRleCA9IENoYXJhY3Rlck1hcHBpbmcuZ2V0Q2hhckluZGV4KG1heEVudHJ5KTtcblx0XHR9XG5cblx0XHRjb25zdCBtaW5FbnRyeURpc3RhbmNlID0gY2hhckluZGV4IC0gbWluQ2hhckluZGV4O1xuXHRcdGNvbnN0IG1heEVudHJ5RGlzdGFuY2UgPSBtYXhDaGFySW5kZXggLSBjaGFySW5kZXg7XG5cblx0XHRpZiAobWluRW50cnlEaXN0YW5jZSA8PSBtYXhFbnRyeURpc3RhbmNlKSB7XG5cdFx0XHRyZXR1cm4gbWluO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF4O1xuXHR9XG5cblx0cHVibGljIGluZmxhdGUoKSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBbbnVtYmVyLCBudW1iZXIsIG51bWJlcl1bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcGFydERhdGEgPSB0aGlzLl9kYXRhW2ldO1xuXHRcdFx0Y29uc3QgcGFydEluZGV4ID0gQ2hhcmFjdGVyTWFwcGluZy5nZXRQYXJ0SW5kZXgocGFydERhdGEpO1xuXHRcdFx0Y29uc3QgY2hhckluZGV4ID0gQ2hhcmFjdGVyTWFwcGluZy5nZXRDaGFySW5kZXgocGFydERhdGEpO1xuXHRcdFx0Y29uc3QgdmlzaWJsZUNvbHVtbiA9IHRoaXMuX2hvcml6b250YWxPZmZzZXRbaV07XG5cdFx0XHRyZXN1bHQucHVzaChbcGFydEluZGV4LCBjaGFySW5kZXgsIHZpc2libGVDb2x1bW5dKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBGb3JlaWduRWxlbWVudFR5cGUge1xuXHROb25lID0gMCxcblx0QmVmb3JlID0gMSxcblx0QWZ0ZXIgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBSZW5kZXJMaW5lT3V0cHV0IHtcblx0X3JlbmRlckxpbmVPdXRwdXRCcmFuZDogdm9pZCA9IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBjaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nO1xuXHRyZWFkb25seSBjb250YWluc1JUTDogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29udGFpbnNGb3JlaWduRWxlbWVudHM6IEZvcmVpZ25FbGVtZW50VHlwZTtcblxuXHRjb25zdHJ1Y3RvcihjaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nLCBjb250YWluc1JUTDogYm9vbGVhbiwgY29udGFpbnNGb3JlaWduRWxlbWVudHM6IEZvcmVpZ25FbGVtZW50VHlwZSkge1xuXHRcdHRoaXMuY2hhcmFjdGVyTWFwcGluZyA9IGNoYXJhY3Rlck1hcHBpbmc7XG5cdFx0dGhpcy5jb250YWluc1JUTCA9IGNvbnRhaW5zUlRMO1xuXHRcdHRoaXMuY29udGFpbnNGb3JlaWduRWxlbWVudHMgPSBjb250YWluc0ZvcmVpZ25FbGVtZW50cztcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVmlld0xpbmUoaW5wdXQ6IFJlbmRlckxpbmVJbnB1dCwgc2I6IFN0cmluZ0J1aWxkZXIpOiBSZW5kZXJMaW5lT3V0cHV0IHtcblx0aWYgKGlucHV0LmxpbmVDb250ZW50Lmxlbmd0aCA9PT0gMCkge1xuXG5cdFx0aWYgKGlucHV0LmxpbmVEZWNvcmF0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBUaGlzIGxpbmUgaXMgZW1wdHksIGJ1dCBpdCBjb250YWlucyBpbmxpbmUgZGVjb3JhdGlvbnNcblx0XHRcdHNiLmFwcGVuZFN0cmluZyhgPHNwYW4+YCk7XG5cblx0XHRcdGxldCBiZWZvcmVDb3VudCA9IDA7XG5cdFx0XHRsZXQgYWZ0ZXJDb3VudCA9IDA7XG5cdFx0XHRsZXQgY29udGFpbnNGb3JlaWduRWxlbWVudHMgPSBGb3JlaWduRWxlbWVudFR5cGUuTm9uZTtcblx0XHRcdGZvciAoY29uc3QgbGluZURlY29yYXRpb24gb2YgaW5wdXQubGluZURlY29yYXRpb25zKSB7XG5cdFx0XHRcdGlmIChsaW5lRGVjb3JhdGlvbi50eXBlID09PSBJbmxpbmVEZWNvcmF0aW9uVHlwZS5CZWZvcmUgfHwgbGluZURlY29yYXRpb24udHlwZSA9PT0gSW5saW5lRGVjb3JhdGlvblR5cGUuQWZ0ZXIpIHtcblx0XHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoYDxzcGFuIGNsYXNzPVwiYCk7XG5cdFx0XHRcdFx0c2IuYXBwZW5kU3RyaW5nKGxpbmVEZWNvcmF0aW9uLmNsYXNzTmFtZSk7XG5cdFx0XHRcdFx0c2IuYXBwZW5kU3RyaW5nKGBcIj48L3NwYW4+YCk7XG5cblx0XHRcdFx0XHRpZiAobGluZURlY29yYXRpb24udHlwZSA9PT0gSW5saW5lRGVjb3JhdGlvblR5cGUuQmVmb3JlKSB7XG5cdFx0XHRcdFx0XHRjb250YWluc0ZvcmVpZ25FbGVtZW50cyB8PSBGb3JlaWduRWxlbWVudFR5cGUuQmVmb3JlO1xuXHRcdFx0XHRcdFx0YmVmb3JlQ291bnQrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGxpbmVEZWNvcmF0aW9uLnR5cGUgPT09IElubGluZURlY29yYXRpb25UeXBlLkFmdGVyKSB7XG5cdFx0XHRcdFx0XHRjb250YWluc0ZvcmVpZ25FbGVtZW50cyB8PSBGb3JlaWduRWxlbWVudFR5cGUuQWZ0ZXI7XG5cdFx0XHRcdFx0XHRhZnRlckNvdW50Kys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHNiLmFwcGVuZFN0cmluZyhgPC9zcGFuPmApO1xuXG5cdFx0XHRjb25zdCBjaGFyYWN0ZXJNYXBwaW5nID0gbmV3IENoYXJhY3Rlck1hcHBpbmcoMSwgYmVmb3JlQ291bnQgKyBhZnRlckNvdW50KTtcblx0XHRcdGNoYXJhY3Rlck1hcHBpbmcuc2V0Q29sdW1uSW5mbygxLCBiZWZvcmVDb3VudCwgMCwgMCk7XG5cblx0XHRcdHJldHVybiBuZXcgUmVuZGVyTGluZU91dHB1dChcblx0XHRcdFx0Y2hhcmFjdGVyTWFwcGluZyxcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdGNvbnRhaW5zRm9yZWlnbkVsZW1lbnRzXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIGNvbXBsZXRlbHkgZW1wdHkgbGluZVxuXHRcdHNiLmFwcGVuZFN0cmluZygnPHNwYW4+PHNwYW4+PC9zcGFuPjwvc3Bhbj4nKTtcblx0XHRyZXR1cm4gbmV3IFJlbmRlckxpbmVPdXRwdXQoXG5cdFx0XHRuZXcgQ2hhcmFjdGVyTWFwcGluZygwLCAwKSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0Rm9yZWlnbkVsZW1lbnRUeXBlLk5vbmVcblx0XHQpO1xuXHR9XG5cblx0cmV0dXJuIF9yZW5kZXJMaW5lKHJlc29sdmVSZW5kZXJMaW5lSW5wdXQoaW5wdXQpLCBzYik7XG59XG5cbmV4cG9ydCBjbGFzcyBSZW5kZXJMaW5lT3V0cHV0MiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBjaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBodG1sOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGNvbnRhaW5zUlRMOiBib29sZWFuLFxuXHRcdHB1YmxpYyByZWFkb25seSBjb250YWluc0ZvcmVpZ25FbGVtZW50czogRm9yZWlnbkVsZW1lbnRUeXBlXG5cdCkge1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJWaWV3TGluZTIoaW5wdXQ6IFJlbmRlckxpbmVJbnB1dCk6IFJlbmRlckxpbmVPdXRwdXQyIHtcblx0Y29uc3Qgc2IgPSBuZXcgU3RyaW5nQnVpbGRlcigxMDAwMCk7XG5cdGNvbnN0IG91dCA9IHJlbmRlclZpZXdMaW5lKGlucHV0LCBzYik7XG5cdHJldHVybiBuZXcgUmVuZGVyTGluZU91dHB1dDIob3V0LmNoYXJhY3Rlck1hcHBpbmcsIHNiLmJ1aWxkKCksIG91dC5jb250YWluc1JUTCwgb3V0LmNvbnRhaW5zRm9yZWlnbkVsZW1lbnRzKTtcbn1cblxuY2xhc3MgUmVzb2x2ZWRSZW5kZXJMaW5lSW5wdXQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgZm9udElzTW9ub3NwYWNlOiBib29sZWFuLFxuXHRcdHB1YmxpYyByZWFkb25seSBjYW5Vc2VIYWxmd2lkdGhSaWdodHdhcmRzQXJyb3c6IGJvb2xlYW4sXG5cdFx0cHVibGljIHJlYWRvbmx5IGxpbmVDb250ZW50OiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGxlbjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBpc092ZXJmbG93aW5nOiBib29sZWFuLFxuXHRcdHB1YmxpYyByZWFkb25seSBvdmVyZmxvd2luZ0NoYXJDb3VudDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBwYXJ0czogTGluZVBhcnRbXSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgY29udGFpbnNGb3JlaWduRWxlbWVudHM6IEZvcmVpZ25FbGVtZW50VHlwZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgZmF1eEluZGVudExlbmd0aDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSB0YWJTaXplOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHN0YXJ0VmlzaWJsZUNvbHVtbjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBjb250YWluc1JUTDogYm9vbGVhbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc3BhY2VXaWR0aDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSByZW5kZXJTcGFjZUNoYXJDb2RlOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHJlbmRlcldoaXRlc3BhY2U6IFJlbmRlcldoaXRlc3BhY2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IHJlbmRlckNvbnRyb2xDaGFyYWN0ZXJzOiBib29sZWFuLFxuXHQpIHtcblx0XHQvL1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVSZW5kZXJMaW5lSW5wdXQoaW5wdXQ6IFJlbmRlckxpbmVJbnB1dCk6IFJlc29sdmVkUmVuZGVyTGluZUlucHV0IHtcblx0Y29uc3QgbGluZUNvbnRlbnQgPSBpbnB1dC5saW5lQ29udGVudDtcblxuXHRsZXQgaXNPdmVyZmxvd2luZzogYm9vbGVhbjtcblx0bGV0IG92ZXJmbG93aW5nQ2hhckNvdW50OiBudW1iZXI7XG5cdGxldCBsZW46IG51bWJlcjtcblxuXHRpZiAoaW5wdXQuc3RvcFJlbmRlcmluZ0xpbmVBZnRlciAhPT0gLTEgJiYgaW5wdXQuc3RvcFJlbmRlcmluZ0xpbmVBZnRlciA8IGxpbmVDb250ZW50Lmxlbmd0aCkge1xuXHRcdGlzT3ZlcmZsb3dpbmcgPSB0cnVlO1xuXHRcdG92ZXJmbG93aW5nQ2hhckNvdW50ID0gbGluZUNvbnRlbnQubGVuZ3RoIC0gaW5wdXQuc3RvcFJlbmRlcmluZ0xpbmVBZnRlcjtcblx0XHRsZW4gPSBpbnB1dC5zdG9wUmVuZGVyaW5nTGluZUFmdGVyO1xuXHR9IGVsc2Uge1xuXHRcdGlzT3ZlcmZsb3dpbmcgPSBmYWxzZTtcblx0XHRvdmVyZmxvd2luZ0NoYXJDb3VudCA9IDA7XG5cdFx0bGVuID0gbGluZUNvbnRlbnQubGVuZ3RoO1xuXHR9XG5cblx0bGV0IHRva2VucyA9IHRyYW5zZm9ybUFuZFJlbW92ZU92ZXJmbG93aW5nKGxpbmVDb250ZW50LCBpbnB1dC5jb250YWluc1JUTCwgaW5wdXQubGluZVRva2VucywgaW5wdXQuZmF1eEluZGVudExlbmd0aCwgbGVuKTtcblx0aWYgKGlucHV0LnJlbmRlckNvbnRyb2xDaGFyYWN0ZXJzICYmICFpbnB1dC5pc0Jhc2ljQVNDSUkpIHtcblx0XHQvLyBDYWxsaW5nIGBleHRyYWN0Q29udHJvbENoYXJhY3RlcnNgIGJlZm9yZSBhZGRpbmcgKHBvc3NpYmx5IGVtcHR5KSBsaW5lIHBhcnRzXG5cdFx0Ly8gZm9yIGlubGluZSBkZWNvcmF0aW9ucy4gYGV4dHJhY3RDb250cm9sQ2hhcmFjdGVyc2AgcmVtb3ZlcyBlbXB0eSBsaW5lIHBhcnRzLlxuXHRcdHRva2VucyA9IGV4dHJhY3RDb250cm9sQ2hhcmFjdGVycyhsaW5lQ29udGVudCwgdG9rZW5zKTtcblx0fVxuXHRpZiAoaW5wdXQucmVuZGVyV2hpdGVzcGFjZSA9PT0gUmVuZGVyV2hpdGVzcGFjZS5BbGwgfHxcblx0XHRpbnB1dC5yZW5kZXJXaGl0ZXNwYWNlID09PSBSZW5kZXJXaGl0ZXNwYWNlLkJvdW5kYXJ5IHx8XG5cdFx0KGlucHV0LnJlbmRlcldoaXRlc3BhY2UgPT09IFJlbmRlcldoaXRlc3BhY2UuU2VsZWN0aW9uICYmICEhaW5wdXQuc2VsZWN0aW9uc09uTGluZSkgfHxcblx0XHQoaW5wdXQucmVuZGVyV2hpdGVzcGFjZSA9PT0gUmVuZGVyV2hpdGVzcGFjZS5UcmFpbGluZyAmJiAhaW5wdXQuY29udGludWVzV2l0aFdyYXBwZWRMaW5lKVxuXHQpIHtcblx0XHR0b2tlbnMgPSBfYXBwbHlSZW5kZXJXaGl0ZXNwYWNlKGlucHV0LCBsaW5lQ29udGVudCwgbGVuLCB0b2tlbnMpO1xuXHR9XG5cdGxldCBjb250YWluc0ZvcmVpZ25FbGVtZW50cyA9IEZvcmVpZ25FbGVtZW50VHlwZS5Ob25lO1xuXHRpZiAoaW5wdXQubGluZURlY29yYXRpb25zLmxlbmd0aCA+IDApIHtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gaW5wdXQubGluZURlY29yYXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lRGVjb3JhdGlvbiA9IGlucHV0LmxpbmVEZWNvcmF0aW9uc1tpXTtcblx0XHRcdGlmIChsaW5lRGVjb3JhdGlvbi50eXBlID09PSBJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyQWZmZWN0aW5nTGV0dGVyU3BhY2luZykge1xuXHRcdFx0XHQvLyBQcmV0ZW5kIHRoZXJlIGFyZSBmb3JlaWduIGVsZW1lbnRzLi4uIGFsdGhvdWdoIG5vdCAxMDAlIGFjY3VyYXRlLlxuXHRcdFx0XHRjb250YWluc0ZvcmVpZ25FbGVtZW50cyB8PSBGb3JlaWduRWxlbWVudFR5cGUuQmVmb3JlO1xuXHRcdFx0fSBlbHNlIGlmIChsaW5lRGVjb3JhdGlvbi50eXBlID09PSBJbmxpbmVEZWNvcmF0aW9uVHlwZS5CZWZvcmUpIHtcblx0XHRcdFx0Y29udGFpbnNGb3JlaWduRWxlbWVudHMgfD0gRm9yZWlnbkVsZW1lbnRUeXBlLkJlZm9yZTtcblx0XHRcdH0gZWxzZSBpZiAobGluZURlY29yYXRpb24udHlwZSA9PT0gSW5saW5lRGVjb3JhdGlvblR5cGUuQWZ0ZXIpIHtcblx0XHRcdFx0Y29udGFpbnNGb3JlaWduRWxlbWVudHMgfD0gRm9yZWlnbkVsZW1lbnRUeXBlLkFmdGVyO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0b2tlbnMgPSBfYXBwbHlJbmxpbmVEZWNvcmF0aW9ucyhsaW5lQ29udGVudCwgbGVuLCB0b2tlbnMsIGlucHV0LmxpbmVEZWNvcmF0aW9ucyk7XG5cdH1cblx0aWYgKCFpbnB1dC5jb250YWluc1JUTCkge1xuXHRcdC8vIFdlIGNhbiBuZXZlciBzcGxpdCBSVEwgdGV4dCwgYXMgaXQgcnVpbnMgdGhlIHJlbmRlcmluZ1xuXHRcdHRva2VucyA9IHNwbGl0TGFyZ2VUb2tlbnMobGluZUNvbnRlbnQsIHRva2VucywgIWlucHV0LmlzQmFzaWNBU0NJSSB8fCBpbnB1dC5mb250TGlnYXR1cmVzKTtcblx0fVxuXG5cdHJldHVybiBuZXcgUmVzb2x2ZWRSZW5kZXJMaW5lSW5wdXQoXG5cdFx0aW5wdXQudXNlTW9ub3NwYWNlT3B0aW1pemF0aW9ucyxcblx0XHRpbnB1dC5jYW5Vc2VIYWxmd2lkdGhSaWdodHdhcmRzQXJyb3csXG5cdFx0bGluZUNvbnRlbnQsXG5cdFx0bGVuLFxuXHRcdGlzT3ZlcmZsb3dpbmcsXG5cdFx0b3ZlcmZsb3dpbmdDaGFyQ291bnQsXG5cdFx0dG9rZW5zLFxuXHRcdGNvbnRhaW5zRm9yZWlnbkVsZW1lbnRzLFxuXHRcdGlucHV0LmZhdXhJbmRlbnRMZW5ndGgsXG5cdFx0aW5wdXQudGFiU2l6ZSxcblx0XHRpbnB1dC5zdGFydFZpc2libGVDb2x1bW4sXG5cdFx0aW5wdXQuY29udGFpbnNSVEwsXG5cdFx0aW5wdXQuc3BhY2VXaWR0aCxcblx0XHRpbnB1dC5yZW5kZXJTcGFjZUNoYXJDb2RlLFxuXHRcdGlucHV0LnJlbmRlcldoaXRlc3BhY2UsXG5cdFx0aW5wdXQucmVuZGVyQ29udHJvbENoYXJhY3RlcnNcblx0KTtcbn1cblxuLyoqXG4gKiBJbiB0aGUgcmVuZGVyaW5nIHBoYXNlLCBjaGFyYWN0ZXJzIGFyZSBhbHdheXMgbG9vcGVkIHVudGlsIHRva2VuLmVuZEluZGV4LlxuICogRW5zdXJlIHRoYXQgYWxsIHRva2VucyBlbmQgYmVmb3JlIGBsZW5gIGFuZCB0aGUgbGFzdCBvbmUgZW5kcyBwcmVjaXNlbHkgYXQgYGxlbmAuXG4gKi9cbmZ1bmN0aW9uIHRyYW5zZm9ybUFuZFJlbW92ZU92ZXJmbG93aW5nKGxpbmVDb250ZW50OiBzdHJpbmcsIGxpbmVDb250YWluc1JUTDogYm9vbGVhbiwgdG9rZW5zOiBJVmlld0xpbmVUb2tlbnMsIGZhdXhJbmRlbnRMZW5ndGg6IG51bWJlciwgbGVuOiBudW1iZXIpOiBMaW5lUGFydFtdIHtcblx0Y29uc3QgcmVzdWx0OiBMaW5lUGFydFtdID0gW107XG5cdGxldCByZXN1bHRMZW4gPSAwO1xuXG5cdC8vIFRoZSBmYXV4IGluZGVudCBwYXJ0IG9mIHRoZSBsaW5lIHNob3VsZCBoYXZlIG5vIHRva2VuIHR5cGVcblx0aWYgKGZhdXhJbmRlbnRMZW5ndGggPiAwKSB7XG5cdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBMaW5lUGFydChmYXV4SW5kZW50TGVuZ3RoLCAnJywgMCwgZmFsc2UpO1xuXHR9XG5cdGxldCBzdGFydE9mZnNldCA9IGZhdXhJbmRlbnRMZW5ndGg7XG5cdGZvciAobGV0IHRva2VuSW5kZXggPSAwLCB0b2tlbnNMZW4gPSB0b2tlbnMuZ2V0Q291bnQoKTsgdG9rZW5JbmRleCA8IHRva2Vuc0xlbjsgdG9rZW5JbmRleCsrKSB7XG5cdFx0Y29uc3QgZW5kSW5kZXggPSB0b2tlbnMuZ2V0RW5kT2Zmc2V0KHRva2VuSW5kZXgpO1xuXHRcdGlmIChlbmRJbmRleCA8PSBmYXV4SW5kZW50TGVuZ3RoKSB7XG5cdFx0XHQvLyBUaGUgZmF1eCBpbmRlbnQgcGFydCBvZiB0aGUgbGluZSBzaG91bGQgaGF2ZSBubyB0b2tlbiB0eXBlXG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0Y29uc3QgdHlwZSA9IHRva2Vucy5nZXRDbGFzc05hbWUodG9rZW5JbmRleCk7XG5cdFx0aWYgKGVuZEluZGV4ID49IGxlbikge1xuXHRcdFx0Y29uc3QgdG9rZW5Db250YWluc1JUTCA9IChsaW5lQ29udGFpbnNSVEwgPyBzdHJpbmdzLmNvbnRhaW5zUlRMKGxpbmVDb250ZW50LnN1YnN0cmluZyhzdGFydE9mZnNldCwgbGVuKSkgOiBmYWxzZSk7XG5cdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KGxlbiwgdHlwZSwgMCwgdG9rZW5Db250YWluc1JUTCk7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0Y29uc3QgdG9rZW5Db250YWluc1JUTCA9IChsaW5lQ29udGFpbnNSVEwgPyBzdHJpbmdzLmNvbnRhaW5zUlRMKGxpbmVDb250ZW50LnN1YnN0cmluZyhzdGFydE9mZnNldCwgZW5kSW5kZXgpKSA6IGZhbHNlKTtcblx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KGVuZEluZGV4LCB0eXBlLCAwLCB0b2tlbkNvbnRhaW5zUlRMKTtcblx0XHRzdGFydE9mZnNldCA9IGVuZEluZGV4O1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiB3cml0dGVuIGFzIGEgY29uc3QgZW51bSB0byBnZXQgdmFsdWUgaW5saW5pbmcuXG4gKi9cbmNvbnN0IGVudW0gQ29uc3RhbnRzIHtcblx0TG9uZ1Rva2VuID0gNTBcbn1cblxuLyoqXG4gKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzY4ODUuXG4gKiBJdCBhcHBlYXJzIHRoYXQgaGF2aW5nIHZlcnkgbGFyZ2Ugc3BhbnMgY2F1c2VzIHZlcnkgc2xvdyByZWFkaW5nIG9mIGNoYXJhY3RlciBwb3NpdGlvbnMuXG4gKiBTbyBoZXJlIHdlIHRyeSB0byBhdm9pZCB0aGF0LlxuICovXG5mdW5jdGlvbiBzcGxpdExhcmdlVG9rZW5zKGxpbmVDb250ZW50OiBzdHJpbmcsIHRva2VuczogTGluZVBhcnRbXSwgb25seUF0U3BhY2VzOiBib29sZWFuKTogTGluZVBhcnRbXSB7XG5cdGxldCBsYXN0VG9rZW5FbmRJbmRleCA9IDA7XG5cdGNvbnN0IHJlc3VsdDogTGluZVBhcnRbXSA9IFtdO1xuXHRsZXQgcmVzdWx0TGVuID0gMDtcblxuXHRpZiAob25seUF0U3BhY2VzKSB7XG5cdFx0Ly8gU3BsaXQgb25seSBhdCBzcGFjZXMgPT4gd2UgbmVlZCB0byB3YWxrIGVhY2ggY2hhcmFjdGVyXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHRva2Vucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgdG9rZW4gPSB0b2tlbnNbaV07XG5cdFx0XHRjb25zdCB0b2tlbkVuZEluZGV4ID0gdG9rZW4uZW5kSW5kZXg7XG5cdFx0XHRpZiAobGFzdFRva2VuRW5kSW5kZXggKyBDb25zdGFudHMuTG9uZ1Rva2VuIDwgdG9rZW5FbmRJbmRleCkge1xuXHRcdFx0XHRjb25zdCB0b2tlblR5cGUgPSB0b2tlbi50eXBlO1xuXHRcdFx0XHRjb25zdCB0b2tlbk1ldGFkYXRhID0gdG9rZW4ubWV0YWRhdGE7XG5cdFx0XHRcdGNvbnN0IHRva2VuQ29udGFpbnNSVEwgPSB0b2tlbi5jb250YWluc1JUTDtcblxuXHRcdFx0XHRsZXQgbGFzdFNwYWNlT2Zmc2V0ID0gLTE7XG5cdFx0XHRcdGxldCBjdXJyVG9rZW5TdGFydCA9IGxhc3RUb2tlbkVuZEluZGV4O1xuXHRcdFx0XHRmb3IgKGxldCBqID0gbGFzdFRva2VuRW5kSW5kZXg7IGogPCB0b2tlbkVuZEluZGV4OyBqKyspIHtcblx0XHRcdFx0XHRpZiAobGluZUNvbnRlbnQuY2hhckNvZGVBdChqKSA9PT0gQ2hhckNvZGUuU3BhY2UpIHtcblx0XHRcdFx0XHRcdGxhc3RTcGFjZU9mZnNldCA9IGo7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChsYXN0U3BhY2VPZmZzZXQgIT09IC0xICYmIGogLSBjdXJyVG9rZW5TdGFydCA+PSBDb25zdGFudHMuTG9uZ1Rva2VuKSB7XG5cdFx0XHRcdFx0XHQvLyBTcGxpdCBhdCBgbGFzdFNwYWNlT2Zmc2V0YCArIDFcblx0XHRcdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgTGluZVBhcnQobGFzdFNwYWNlT2Zmc2V0ICsgMSwgdG9rZW5UeXBlLCB0b2tlbk1ldGFkYXRhLCB0b2tlbkNvbnRhaW5zUlRMKTtcblx0XHRcdFx0XHRcdGN1cnJUb2tlblN0YXJ0ID0gbGFzdFNwYWNlT2Zmc2V0ICsgMTtcblx0XHRcdFx0XHRcdGxhc3RTcGFjZU9mZnNldCA9IC0xO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY3VyclRva2VuU3RhcnQgIT09IHRva2VuRW5kSW5kZXgpIHtcblx0XHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KHRva2VuRW5kSW5kZXgsIHRva2VuVHlwZSwgdG9rZW5NZXRhZGF0YSwgdG9rZW5Db250YWluc1JUTCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSB0b2tlbjtcblx0XHRcdH1cblxuXHRcdFx0bGFzdFRva2VuRW5kSW5kZXggPSB0b2tlbkVuZEluZGV4O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBTcGxpdCBhbnl3aGVyZSA9PiB3ZSBkb24ndCBuZWVkIHRvIHdhbGsgZWFjaCBjaGFyYWN0ZXJcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdG9rZW5zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCB0b2tlbiA9IHRva2Vuc1tpXTtcblx0XHRcdGNvbnN0IHRva2VuRW5kSW5kZXggPSB0b2tlbi5lbmRJbmRleDtcblx0XHRcdGNvbnN0IGRpZmYgPSAodG9rZW5FbmRJbmRleCAtIGxhc3RUb2tlbkVuZEluZGV4KTtcblx0XHRcdGlmIChkaWZmID4gQ29uc3RhbnRzLkxvbmdUb2tlbikge1xuXHRcdFx0XHRjb25zdCB0b2tlblR5cGUgPSB0b2tlbi50eXBlO1xuXHRcdFx0XHRjb25zdCB0b2tlbk1ldGFkYXRhID0gdG9rZW4ubWV0YWRhdGE7XG5cdFx0XHRcdGNvbnN0IHRva2VuQ29udGFpbnNSVEwgPSB0b2tlbi5jb250YWluc1JUTDtcblx0XHRcdFx0Y29uc3QgcGllY2VzQ291bnQgPSBNYXRoLmNlaWwoZGlmZiAvIENvbnN0YW50cy5Mb25nVG9rZW4pO1xuXHRcdFx0XHRmb3IgKGxldCBqID0gMTsgaiA8IHBpZWNlc0NvdW50OyBqKyspIHtcblx0XHRcdFx0XHRjb25zdCBwaWVjZUVuZEluZGV4ID0gbGFzdFRva2VuRW5kSW5kZXggKyAoaiAqIENvbnN0YW50cy5Mb25nVG9rZW4pO1xuXHRcdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgTGluZVBhcnQocGllY2VFbmRJbmRleCwgdG9rZW5UeXBlLCB0b2tlbk1ldGFkYXRhLCB0b2tlbkNvbnRhaW5zUlRMKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KHRva2VuRW5kSW5kZXgsIHRva2VuVHlwZSwgdG9rZW5NZXRhZGF0YSwgdG9rZW5Db250YWluc1JUTCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gdG9rZW47XG5cdFx0XHR9XG5cdFx0XHRsYXN0VG9rZW5FbmRJbmRleCA9IHRva2VuRW5kSW5kZXg7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaXNDb250cm9sQ2hhcmFjdGVyKGNoYXJDb2RlOiBudW1iZXIpOiBib29sZWFuIHtcblx0aWYgKGNoYXJDb2RlIDwgMzIpIHtcblx0XHRyZXR1cm4gKGNoYXJDb2RlICE9PSBDaGFyQ29kZS5UYWIpO1xuXHR9XG5cdGlmIChjaGFyQ29kZSA9PT0gMTI3KSB7XG5cdFx0Ly8gREVMXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRpZiAoXG5cdFx0KGNoYXJDb2RlID49IDB4MjAyQSAmJiBjaGFyQ29kZSA8PSAweDIwMkUpXG5cdFx0fHwgKGNoYXJDb2RlID49IDB4MjA2NiAmJiBjaGFyQ29kZSA8PSAweDIwNjkpXG5cdFx0fHwgKGNoYXJDb2RlID49IDB4MjAwRSAmJiBjaGFyQ29kZSA8PSAweDIwMEYpXG5cdFx0fHwgY2hhckNvZGUgPT09IDB4MDYxQ1xuXHQpIHtcblx0XHQvLyBVbmljb2RlIERpcmVjdGlvbmFsIEZvcm1hdHRpbmcgQ2hhcmFjdGVyc1xuXHRcdC8vIExSRVx0VSsyMDJBXHRMRUZULVRPLVJJR0hUIEVNQkVERElOR1xuXHRcdC8vIFJMRVx0VSsyMDJCXHRSSUdIVC1UTy1MRUZUIEVNQkVERElOR1xuXHRcdC8vIFBERlx0VSsyMDJDXHRQT1AgRElSRUNUSU9OQUwgRk9STUFUVElOR1xuXHRcdC8vIExST1x0VSsyMDJEXHRMRUZULVRPLVJJR0hUIE9WRVJSSURFXG5cdFx0Ly8gUkxPXHRVKzIwMkVcdFJJR0hULVRPLUxFRlQgT1ZFUlJJREVcblx0XHQvLyBMUklcdFUrMjA2Nlx0TEVGVC1UTy1SSUdIVCBJU09MQVRFXG5cdFx0Ly8gUkxJXHRVKzIwNjdcdFJJR0hULVRPLUxFRlQgSVNPTEFURVxuXHRcdC8vIEZTSVx0VSsyMDY4XHRGSVJTVCBTVFJPTkcgSVNPTEFURVxuXHRcdC8vIFBESVx0VSsyMDY5XHRQT1AgRElSRUNUSU9OQUwgSVNPTEFURVxuXHRcdC8vIExSTVx0VSsyMDBFXHRMRUZULVRPLVJJR0hUIE1BUktcblx0XHQvLyBSTE1cdFUrMjAwRlx0UklHSFQtVE8tTEVGVCBNQVJLXG5cdFx0Ly8gQUxNXHRVKzA2MUNcdEFSQUJJQyBMRVRURVIgTUFSS1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0Q29udHJvbENoYXJhY3RlcnMobGluZUNvbnRlbnQ6IHN0cmluZywgdG9rZW5zOiBMaW5lUGFydFtdKTogTGluZVBhcnRbXSB7XG5cdGNvbnN0IHJlc3VsdDogTGluZVBhcnRbXSA9IFtdO1xuXHRsZXQgbGFzdExpbmVQYXJ0OiBMaW5lUGFydCA9IG5ldyBMaW5lUGFydCgwLCAnJywgMCwgZmFsc2UpO1xuXHRsZXQgY2hhck9mZnNldCA9IDA7XG5cdGZvciAoY29uc3QgdG9rZW4gb2YgdG9rZW5zKSB7XG5cdFx0Y29uc3QgdG9rZW5FbmRJbmRleCA9IHRva2VuLmVuZEluZGV4O1xuXHRcdGZvciAoOyBjaGFyT2Zmc2V0IDwgdG9rZW5FbmRJbmRleDsgY2hhck9mZnNldCsrKSB7XG5cdFx0XHRjb25zdCBjaGFyQ29kZSA9IGxpbmVDb250ZW50LmNoYXJDb2RlQXQoY2hhck9mZnNldCk7XG5cdFx0XHRpZiAoaXNDb250cm9sQ2hhcmFjdGVyKGNoYXJDb2RlKSkge1xuXHRcdFx0XHRpZiAoY2hhck9mZnNldCA+IGxhc3RMaW5lUGFydC5lbmRJbmRleCkge1xuXHRcdFx0XHRcdC8vIGVtaXQgcHJldmlvdXMgcGFydCBpZiBpdCBoYXMgdGV4dFxuXHRcdFx0XHRcdGxhc3RMaW5lUGFydCA9IG5ldyBMaW5lUGFydChjaGFyT2Zmc2V0LCB0b2tlbi50eXBlLCB0b2tlbi5tZXRhZGF0YSwgdG9rZW4uY29udGFpbnNSVEwpO1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKGxhc3RMaW5lUGFydCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGFzdExpbmVQYXJ0ID0gbmV3IExpbmVQYXJ0KGNoYXJPZmZzZXQgKyAxLCAnbXRrY29udHJvbCcsIHRva2VuLm1ldGFkYXRhLCBmYWxzZSk7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGxhc3RMaW5lUGFydCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjaGFyT2Zmc2V0ID4gbGFzdExpbmVQYXJ0LmVuZEluZGV4KSB7XG5cdFx0XHQvLyBlbWl0IHByZXZpb3VzIHBhcnQgaWYgaXQgaGFzIHRleHRcblx0XHRcdGxhc3RMaW5lUGFydCA9IG5ldyBMaW5lUGFydCh0b2tlbkVuZEluZGV4LCB0b2tlbi50eXBlLCB0b2tlbi5tZXRhZGF0YSwgdG9rZW4uY29udGFpbnNSVEwpO1xuXHRcdFx0cmVzdWx0LnB1c2gobGFzdExpbmVQYXJ0KTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBXaGl0ZXNwYWNlIGlzIHJlbmRlcmVkIGJ5IFwicmVwbGFjaW5nXCIgdG9rZW5zIHdpdGggYSBzcGVjaWFsLXB1cnBvc2UgYG10a3dgIHR5cGUgdGhhdCBpcyBsYXRlciByZWNvZ25pemVkIGluIHRoZSByZW5kZXJpbmcgcGhhc2UuXG4gKiBNb3Jlb3ZlciwgYSB0b2tlbiBpcyBjcmVhdGVkIGZvciBldmVyeSB2aXN1YWwgaW5kZW50IGJlY2F1c2Ugb24gc29tZSBmb250cyB0aGUgZ2x5cGhzIHVzZWQgZm9yIHJlbmRlcmluZyB3aGl0ZXNwYWNlICgmcmFycjsgb3IgJm1pZGRvdDspIGRvIG5vdCBoYXZlIHRoZSBzYW1lIHdpZHRoIGFzICZuYnNwOy5cbiAqIFRoZSByZW5kZXJpbmcgcGhhc2Ugd2lsbCBnZW5lcmF0ZSBgc3R5bGU9XCJ3aWR0aDouLi5cImAgZm9yIHRoZXNlIHRva2Vucy5cbiAqL1xuZnVuY3Rpb24gX2FwcGx5UmVuZGVyV2hpdGVzcGFjZShpbnB1dDogUmVuZGVyTGluZUlucHV0LCBsaW5lQ29udGVudDogc3RyaW5nLCBsZW46IG51bWJlciwgdG9rZW5zOiBMaW5lUGFydFtdKTogTGluZVBhcnRbXSB7XG5cblx0Y29uc3QgY29udGludWVzV2l0aFdyYXBwZWRMaW5lID0gaW5wdXQuY29udGludWVzV2l0aFdyYXBwZWRMaW5lO1xuXHRjb25zdCBmYXV4SW5kZW50TGVuZ3RoID0gaW5wdXQuZmF1eEluZGVudExlbmd0aDtcblx0Y29uc3QgdGFiU2l6ZSA9IGlucHV0LnRhYlNpemU7XG5cdGNvbnN0IHN0YXJ0VmlzaWJsZUNvbHVtbiA9IGlucHV0LnN0YXJ0VmlzaWJsZUNvbHVtbjtcblx0Y29uc3QgdXNlTW9ub3NwYWNlT3B0aW1pemF0aW9ucyA9IGlucHV0LnVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnM7XG5cdGNvbnN0IHNlbGVjdGlvbnMgPSBpbnB1dC5zZWxlY3Rpb25zT25MaW5lO1xuXHRjb25zdCBvbmx5Qm91bmRhcnkgPSAoaW5wdXQucmVuZGVyV2hpdGVzcGFjZSA9PT0gUmVuZGVyV2hpdGVzcGFjZS5Cb3VuZGFyeSk7XG5cdGNvbnN0IG9ubHlUcmFpbGluZyA9IChpbnB1dC5yZW5kZXJXaGl0ZXNwYWNlID09PSBSZW5kZXJXaGl0ZXNwYWNlLlRyYWlsaW5nKTtcblx0Y29uc3QgZ2VuZXJhdGVMaW5lUGFydEZvckVhY2hXaGl0ZXNwYWNlID0gKGlucHV0LnJlbmRlclNwYWNlV2lkdGggIT09IGlucHV0LnNwYWNlV2lkdGgpO1xuXG5cdGNvbnN0IHJlc3VsdDogTGluZVBhcnRbXSA9IFtdO1xuXHRsZXQgcmVzdWx0TGVuID0gMDtcblx0bGV0IHRva2VuSW5kZXggPSAwO1xuXHRsZXQgdG9rZW5UeXBlID0gdG9rZW5zW3Rva2VuSW5kZXhdLnR5cGU7XG5cdGxldCB0b2tlbkNvbnRhaW5zUlRMID0gdG9rZW5zW3Rva2VuSW5kZXhdLmNvbnRhaW5zUlRMO1xuXHRsZXQgdG9rZW5FbmRJbmRleCA9IHRva2Vuc1t0b2tlbkluZGV4XS5lbmRJbmRleDtcblx0Y29uc3QgdG9rZW5zTGVuZ3RoID0gdG9rZW5zLmxlbmd0aDtcblxuXHRsZXQgbGluZUlzRW1wdHlPcldoaXRlc3BhY2UgPSBmYWxzZTtcblx0bGV0IGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4ID0gc3RyaW5ncy5maXJzdE5vbldoaXRlc3BhY2VJbmRleChsaW5lQ29udGVudCk7XG5cdGxldCBsYXN0Tm9uV2hpdGVzcGFjZUluZGV4OiBudW1iZXI7XG5cdGlmIChmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA9PT0gLTEpIHtcblx0XHRsaW5lSXNFbXB0eU9yV2hpdGVzcGFjZSA9IHRydWU7XG5cdFx0Zmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPSBsZW47XG5cdFx0bGFzdE5vbldoaXRlc3BhY2VJbmRleCA9IGxlbjtcblx0fSBlbHNlIHtcblx0XHRsYXN0Tm9uV2hpdGVzcGFjZUluZGV4ID0gc3RyaW5ncy5sYXN0Tm9uV2hpdGVzcGFjZUluZGV4KGxpbmVDb250ZW50KTtcblx0fVxuXG5cdGxldCB3YXNJbldoaXRlc3BhY2UgPSBmYWxzZTtcblx0bGV0IGN1cnJlbnRTZWxlY3Rpb25JbmRleCA9IDA7XG5cdGxldCBjdXJyZW50U2VsZWN0aW9uID0gc2VsZWN0aW9ucyAmJiBzZWxlY3Rpb25zW2N1cnJlbnRTZWxlY3Rpb25JbmRleF07XG5cdGxldCB0bXBJbmRlbnQgPSBzdGFydFZpc2libGVDb2x1bW4gJSB0YWJTaXplO1xuXHRmb3IgKGxldCBjaGFySW5kZXggPSBmYXV4SW5kZW50TGVuZ3RoOyBjaGFySW5kZXggPCBsZW47IGNoYXJJbmRleCsrKSB7XG5cdFx0Y29uc3QgY2hDb2RlID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjaGFySW5kZXgpO1xuXG5cdFx0aWYgKGN1cnJlbnRTZWxlY3Rpb24gJiYgY2hhckluZGV4ID49IGN1cnJlbnRTZWxlY3Rpb24uZW5kT2Zmc2V0KSB7XG5cdFx0XHRjdXJyZW50U2VsZWN0aW9uSW5kZXgrKztcblx0XHRcdGN1cnJlbnRTZWxlY3Rpb24gPSBzZWxlY3Rpb25zICYmIHNlbGVjdGlvbnNbY3VycmVudFNlbGVjdGlvbkluZGV4XTtcblx0XHR9XG5cblx0XHRsZXQgaXNJbldoaXRlc3BhY2U6IGJvb2xlYW47XG5cdFx0aWYgKGNoYXJJbmRleCA8IGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4IHx8IGNoYXJJbmRleCA+IGxhc3ROb25XaGl0ZXNwYWNlSW5kZXgpIHtcblx0XHRcdC8vIGluIGxlYWRpbmcgb3IgdHJhaWxpbmcgd2hpdGVzcGFjZVxuXHRcdFx0aXNJbldoaXRlc3BhY2UgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAoY2hDb2RlID09PSBDaGFyQ29kZS5UYWIpIHtcblx0XHRcdC8vIGEgdGFiIGNoYXJhY3RlciBpcyByZW5kZXJlZCBib3RoIGluIGFsbCBhbmQgYm91bmRhcnkgY2FzZXNcblx0XHRcdGlzSW5XaGl0ZXNwYWNlID0gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKGNoQ29kZSA9PT0gQ2hhckNvZGUuU3BhY2UpIHtcblx0XHRcdC8vIGhpdCBhIHNwYWNlIGNoYXJhY3RlclxuXHRcdFx0aWYgKG9ubHlCb3VuZGFyeSkge1xuXHRcdFx0XHQvLyByZW5kZXJpbmcgb25seSBib3VuZGFyeSB3aGl0ZXNwYWNlXG5cdFx0XHRcdGlmICh3YXNJbldoaXRlc3BhY2UpIHtcblx0XHRcdFx0XHRpc0luV2hpdGVzcGFjZSA9IHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgbmV4dENoQ29kZSA9IChjaGFySW5kZXggKyAxIDwgbGVuID8gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjaGFySW5kZXggKyAxKSA6IENoYXJDb2RlLk51bGwpO1xuXHRcdFx0XHRcdGlzSW5XaGl0ZXNwYWNlID0gKG5leHRDaENvZGUgPT09IENoYXJDb2RlLlNwYWNlIHx8IG5leHRDaENvZGUgPT09IENoYXJDb2RlLlRhYik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlzSW5XaGl0ZXNwYWNlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aXNJbldoaXRlc3BhY2UgPSBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBJZiByZW5kZXJpbmcgd2hpdGVzcGFjZSBvbiBzZWxlY3Rpb24sIGNoZWNrIHRoYXQgdGhlIGNoYXJJbmRleCBmYWxscyB3aXRoaW4gYSBzZWxlY3Rpb25cblx0XHRpZiAoaXNJbldoaXRlc3BhY2UgJiYgc2VsZWN0aW9ucykge1xuXHRcdFx0aXNJbldoaXRlc3BhY2UgPSAhIWN1cnJlbnRTZWxlY3Rpb24gJiYgY3VycmVudFNlbGVjdGlvbi5zdGFydE9mZnNldCA8PSBjaGFySW5kZXggJiYgY3VycmVudFNlbGVjdGlvbi5lbmRPZmZzZXQgPiBjaGFySW5kZXg7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgcmVuZGVyaW5nIG9ubHkgdHJhaWxpbmcgd2hpdGVzcGFjZSwgY2hlY2sgdGhhdCB0aGUgY2hhckluZGV4IHBvaW50cyB0byB0cmFpbGluZyB3aGl0ZXNwYWNlLlxuXHRcdGlmIChpc0luV2hpdGVzcGFjZSAmJiBvbmx5VHJhaWxpbmcpIHtcblx0XHRcdGlzSW5XaGl0ZXNwYWNlID0gbGluZUlzRW1wdHlPcldoaXRlc3BhY2UgfHwgY2hhckluZGV4ID4gbGFzdE5vbldoaXRlc3BhY2VJbmRleDtcblx0XHR9XG5cblx0XHRpZiAoaXNJbldoaXRlc3BhY2UgJiYgdG9rZW5Db250YWluc1JUTCkge1xuXHRcdFx0Ly8gSWYgdGhlIHRva2VuIGNvbnRhaW5zIFJUTCB0ZXh0LCBicmVha2luZyBpdCB1cCBpbnRvIG11bHRpcGxlIGxpbmUgcGFydHNcblx0XHRcdC8vIHRvIHJlbmRlciB3aGl0ZXNwYWNlIG1pZ2h0IGFmZmVjdCB0aGUgYnJvd3NlcidzIGJpZGkgbGF5b3V0LlxuXHRcdFx0Ly9cblx0XHRcdC8vIFdlIHJlbmRlciB3aGl0ZXNwYWNlIGluIHN1Y2ggdG9rZW5zIG9ubHkgaWYgdGhlIHdoaXRlc3BhY2Vcblx0XHRcdC8vIGlzIHRoZSBsZWFkaW5nIG9yIHRoZSB0cmFpbGluZyB3aGl0ZXNwYWNlIG9mIHRoZSBsaW5lLFxuXHRcdFx0Ly8gd2hpY2ggZG9lc24ndCBhZmZlY3QgdGhlIGJyb3dzZXIncyBiaWRpIGxheW91dC5cblx0XHRcdGlmIChjaGFySW5kZXggPj0gZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggJiYgY2hhckluZGV4IDw9IGxhc3ROb25XaGl0ZXNwYWNlSW5kZXgpIHtcblx0XHRcdFx0aXNJbldoaXRlc3BhY2UgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAod2FzSW5XaGl0ZXNwYWNlKSB7XG5cdFx0XHQvLyB3YXMgaW4gd2hpdGVzcGFjZSB0b2tlblxuXHRcdFx0aWYgKCFpc0luV2hpdGVzcGFjZSB8fCAoIXVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnMgJiYgdG1wSW5kZW50ID49IHRhYlNpemUpKSB7XG5cdFx0XHRcdC8vIGxlYXZpbmcgd2hpdGVzcGFjZSB0b2tlbiBvciBlbnRlcmluZyBhIG5ldyBpbmRlbnRcblx0XHRcdFx0aWYgKGdlbmVyYXRlTGluZVBhcnRGb3JFYWNoV2hpdGVzcGFjZSkge1xuXHRcdFx0XHRcdGNvbnN0IGxhc3RFbmRJbmRleCA9IChyZXN1bHRMZW4gPiAwID8gcmVzdWx0W3Jlc3VsdExlbiAtIDFdLmVuZEluZGV4IDogZmF1eEluZGVudExlbmd0aCk7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IGxhc3RFbmRJbmRleCArIDE7IGkgPD0gY2hhckluZGV4OyBpKyspIHtcblx0XHRcdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgTGluZVBhcnQoaSwgJ210a3cnLCBMaW5lUGFydE1ldGFkYXRhLklTX1dISVRFU1BBQ0UsIGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBMaW5lUGFydChjaGFySW5kZXgsICdtdGt3JywgTGluZVBhcnRNZXRhZGF0YS5JU19XSElURVNQQUNFLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG1wSW5kZW50ID0gdG1wSW5kZW50ICUgdGFiU2l6ZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gd2FzIGluIHJlZ3VsYXIgdG9rZW5cblx0XHRcdGlmIChjaGFySW5kZXggPT09IHRva2VuRW5kSW5kZXggfHwgKGlzSW5XaGl0ZXNwYWNlICYmIGNoYXJJbmRleCA+IGZhdXhJbmRlbnRMZW5ndGgpKSB7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgTGluZVBhcnQoY2hhckluZGV4LCB0b2tlblR5cGUsIDAsIHRva2VuQ29udGFpbnNSVEwpO1xuXHRcdFx0XHR0bXBJbmRlbnQgPSB0bXBJbmRlbnQgJSB0YWJTaXplO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChjaENvZGUgPT09IENoYXJDb2RlLlRhYikge1xuXHRcdFx0dG1wSW5kZW50ID0gdGFiU2l6ZTtcblx0XHR9IGVsc2UgaWYgKHN0cmluZ3MuaXNGdWxsV2lkdGhDaGFyYWN0ZXIoY2hDb2RlKSkge1xuXHRcdFx0dG1wSW5kZW50ICs9IDI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRtcEluZGVudCsrO1xuXHRcdH1cblxuXHRcdHdhc0luV2hpdGVzcGFjZSA9IGlzSW5XaGl0ZXNwYWNlO1xuXG5cdFx0d2hpbGUgKGNoYXJJbmRleCA9PT0gdG9rZW5FbmRJbmRleCkge1xuXHRcdFx0dG9rZW5JbmRleCsrO1xuXHRcdFx0aWYgKHRva2VuSW5kZXggPCB0b2tlbnNMZW5ndGgpIHtcblx0XHRcdFx0dG9rZW5UeXBlID0gdG9rZW5zW3Rva2VuSW5kZXhdLnR5cGU7XG5cdFx0XHRcdHRva2VuQ29udGFpbnNSVEwgPSB0b2tlbnNbdG9rZW5JbmRleF0uY29udGFpbnNSVEw7XG5cdFx0XHRcdHRva2VuRW5kSW5kZXggPSB0b2tlbnNbdG9rZW5JbmRleF0uZW5kSW5kZXg7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRsZXQgZ2VuZXJhdGVXaGl0ZXNwYWNlID0gZmFsc2U7XG5cdGlmICh3YXNJbldoaXRlc3BhY2UpIHtcblx0XHQvLyB3YXMgaW4gd2hpdGVzcGFjZSB0b2tlblxuXHRcdGlmIChjb250aW51ZXNXaXRoV3JhcHBlZExpbmUgJiYgb25seUJvdW5kYXJ5KSB7XG5cdFx0XHRjb25zdCBsYXN0Q2hhckNvZGUgPSAobGVuID4gMCA/IGxpbmVDb250ZW50LmNoYXJDb2RlQXQobGVuIC0gMSkgOiBDaGFyQ29kZS5OdWxsKTtcblx0XHRcdGNvbnN0IHByZXZDaGFyQ29kZSA9IChsZW4gPiAxID8gbGluZUNvbnRlbnQuY2hhckNvZGVBdChsZW4gLSAyKSA6IENoYXJDb2RlLk51bGwpO1xuXHRcdFx0Y29uc3QgaXNTaW5nbGVUcmFpbGluZ1NwYWNlID0gKGxhc3RDaGFyQ29kZSA9PT0gQ2hhckNvZGUuU3BhY2UgJiYgKHByZXZDaGFyQ29kZSAhPT0gQ2hhckNvZGUuU3BhY2UgJiYgcHJldkNoYXJDb2RlICE9PSBDaGFyQ29kZS5UYWIpKTtcblx0XHRcdGlmICghaXNTaW5nbGVUcmFpbGluZ1NwYWNlKSB7XG5cdFx0XHRcdGdlbmVyYXRlV2hpdGVzcGFjZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGdlbmVyYXRlV2hpdGVzcGFjZSA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGdlbmVyYXRlV2hpdGVzcGFjZSkge1xuXHRcdGlmIChnZW5lcmF0ZUxpbmVQYXJ0Rm9yRWFjaFdoaXRlc3BhY2UpIHtcblx0XHRcdGNvbnN0IGxhc3RFbmRJbmRleCA9IChyZXN1bHRMZW4gPiAwID8gcmVzdWx0W3Jlc3VsdExlbiAtIDFdLmVuZEluZGV4IDogZmF1eEluZGVudExlbmd0aCk7XG5cdFx0XHRmb3IgKGxldCBpID0gbGFzdEVuZEluZGV4ICsgMTsgaSA8PSBsZW47IGkrKykge1xuXHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KGksICdtdGt3JywgTGluZVBhcnRNZXRhZGF0YS5JU19XSElURVNQQUNFLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgTGluZVBhcnQobGVuLCAnbXRrdycsIExpbmVQYXJ0TWV0YWRhdGEuSVNfV0hJVEVTUEFDRSwgZmFsc2UpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KGxlbiwgdG9rZW5UeXBlLCAwLCB0b2tlbkNvbnRhaW5zUlRMKTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogSW5saW5lIGRlY29yYXRpb25zIGFyZSBcIm1lcmdlZFwiIG9uIHRvcCBvZiB0b2tlbnMuXG4gKiBTcGVjaWFsIGNhcmUgbXVzdCBiZSB0YWtlbiB3aGVuIG11bHRpcGxlIGlubGluZSBkZWNvcmF0aW9ucyBhcmUgYXQgcGxheSBhbmQgdGhleSBvdmVybGFwLlxuICovXG5mdW5jdGlvbiBfYXBwbHlJbmxpbmVEZWNvcmF0aW9ucyhsaW5lQ29udGVudDogc3RyaW5nLCBsZW46IG51bWJlciwgdG9rZW5zOiBMaW5lUGFydFtdLCBfbGluZURlY29yYXRpb25zOiBMaW5lRGVjb3JhdGlvbltdKTogTGluZVBhcnRbXSB7XG5cdF9saW5lRGVjb3JhdGlvbnMuc29ydChMaW5lRGVjb3JhdGlvbi5jb21wYXJlKTtcblx0Y29uc3QgbGluZURlY29yYXRpb25zID0gTGluZURlY29yYXRpb25zTm9ybWFsaXplci5ub3JtYWxpemUobGluZUNvbnRlbnQsIF9saW5lRGVjb3JhdGlvbnMpO1xuXHRjb25zdCBsaW5lRGVjb3JhdGlvbnNMZW4gPSBsaW5lRGVjb3JhdGlvbnMubGVuZ3RoO1xuXG5cdGxldCBsaW5lRGVjb3JhdGlvbkluZGV4ID0gMDtcblx0Y29uc3QgcmVzdWx0OiBMaW5lUGFydFtdID0gW107XG5cdGxldCByZXN1bHRMZW4gPSAwO1xuXHRsZXQgbGFzdFJlc3VsdEVuZEluZGV4ID0gMDtcblx0Zm9yIChsZXQgdG9rZW5JbmRleCA9IDAsIGxlbiA9IHRva2Vucy5sZW5ndGg7IHRva2VuSW5kZXggPCBsZW47IHRva2VuSW5kZXgrKykge1xuXHRcdGNvbnN0IHRva2VuID0gdG9rZW5zW3Rva2VuSW5kZXhdO1xuXHRcdGNvbnN0IHRva2VuRW5kSW5kZXggPSB0b2tlbi5lbmRJbmRleDtcblx0XHRjb25zdCB0b2tlblR5cGUgPSB0b2tlbi50eXBlO1xuXHRcdGNvbnN0IHRva2VuTWV0YWRhdGEgPSB0b2tlbi5tZXRhZGF0YTtcblx0XHRjb25zdCB0b2tlbkNvbnRhaW5zUlRMID0gdG9rZW4uY29udGFpbnNSVEw7XG5cblx0XHR3aGlsZSAobGluZURlY29yYXRpb25JbmRleCA8IGxpbmVEZWNvcmF0aW9uc0xlbiAmJiBsaW5lRGVjb3JhdGlvbnNbbGluZURlY29yYXRpb25JbmRleF0uc3RhcnRPZmZzZXQgPCB0b2tlbkVuZEluZGV4KSB7XG5cdFx0XHRjb25zdCBsaW5lRGVjb3JhdGlvbiA9IGxpbmVEZWNvcmF0aW9uc1tsaW5lRGVjb3JhdGlvbkluZGV4XTtcblxuXHRcdFx0aWYgKGxpbmVEZWNvcmF0aW9uLnN0YXJ0T2Zmc2V0ID4gbGFzdFJlc3VsdEVuZEluZGV4KSB7XG5cdFx0XHRcdGxhc3RSZXN1bHRFbmRJbmRleCA9IGxpbmVEZWNvcmF0aW9uLnN0YXJ0T2Zmc2V0O1xuXHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KGxhc3RSZXN1bHRFbmRJbmRleCwgdG9rZW5UeXBlLCB0b2tlbk1ldGFkYXRhLCB0b2tlbkNvbnRhaW5zUlRMKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGxpbmVEZWNvcmF0aW9uLmVuZE9mZnNldCArIDEgPD0gdG9rZW5FbmRJbmRleCkge1xuXHRcdFx0XHQvLyBUaGlzIGxpbmUgZGVjb3JhdGlvbiBlbmRzIGJlZm9yZSB0aGlzIHRva2VuIGVuZHNcblx0XHRcdFx0bGFzdFJlc3VsdEVuZEluZGV4ID0gbGluZURlY29yYXRpb24uZW5kT2Zmc2V0ICsgMTtcblx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBMaW5lUGFydChsYXN0UmVzdWx0RW5kSW5kZXgsIHRva2VuVHlwZSArICcgJyArIGxpbmVEZWNvcmF0aW9uLmNsYXNzTmFtZSwgdG9rZW5NZXRhZGF0YSB8IGxpbmVEZWNvcmF0aW9uLm1ldGFkYXRhLCB0b2tlbkNvbnRhaW5zUlRMKTtcblx0XHRcdFx0bGluZURlY29yYXRpb25JbmRleCsrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gVGhpcyBsaW5lIGRlY29yYXRpb24gY29udGludWVzIG9uIHRvIHRoZSBuZXh0IHRva2VuXG5cdFx0XHRcdGxhc3RSZXN1bHRFbmRJbmRleCA9IHRva2VuRW5kSW5kZXg7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgTGluZVBhcnQobGFzdFJlc3VsdEVuZEluZGV4LCB0b2tlblR5cGUgKyAnICcgKyBsaW5lRGVjb3JhdGlvbi5jbGFzc05hbWUsIHRva2VuTWV0YWRhdGEgfCBsaW5lRGVjb3JhdGlvbi5tZXRhZGF0YSwgdG9rZW5Db250YWluc1JUTCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0b2tlbkVuZEluZGV4ID4gbGFzdFJlc3VsdEVuZEluZGV4KSB7XG5cdFx0XHRsYXN0UmVzdWx0RW5kSW5kZXggPSB0b2tlbkVuZEluZGV4O1xuXHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBMaW5lUGFydChsYXN0UmVzdWx0RW5kSW5kZXgsIHRva2VuVHlwZSwgdG9rZW5NZXRhZGF0YSwgdG9rZW5Db250YWluc1JUTCk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgbGFzdFRva2VuRW5kSW5kZXggPSB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdLmVuZEluZGV4O1xuXHRpZiAobGluZURlY29yYXRpb25JbmRleCA8IGxpbmVEZWNvcmF0aW9uc0xlbiAmJiBsaW5lRGVjb3JhdGlvbnNbbGluZURlY29yYXRpb25JbmRleF0uc3RhcnRPZmZzZXQgPT09IGxhc3RUb2tlbkVuZEluZGV4KSB7XG5cdFx0d2hpbGUgKGxpbmVEZWNvcmF0aW9uSW5kZXggPCBsaW5lRGVjb3JhdGlvbnNMZW4gJiYgbGluZURlY29yYXRpb25zW2xpbmVEZWNvcmF0aW9uSW5kZXhdLnN0YXJ0T2Zmc2V0ID09PSBsYXN0VG9rZW5FbmRJbmRleCkge1xuXHRcdFx0Y29uc3QgbGluZURlY29yYXRpb24gPSBsaW5lRGVjb3JhdGlvbnNbbGluZURlY29yYXRpb25JbmRleF07XG5cdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IExpbmVQYXJ0KGxhc3RSZXN1bHRFbmRJbmRleCwgbGluZURlY29yYXRpb24uY2xhc3NOYW1lLCBsaW5lRGVjb3JhdGlvbi5tZXRhZGF0YSwgZmFsc2UpO1xuXHRcdFx0bGluZURlY29yYXRpb25JbmRleCsrO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBvbiBwdXJwb3NlIG5vdCBzcGxpdCB1cCBpbnRvIG11bHRpcGxlIGZ1bmN0aW9ucyB0byBhbGxvdyBydW50aW1lIHR5cGUgaW5mZXJlbmNlIChpLmUuIHBlcmZvcm1hbmNlIHJlYXNvbnMpLlxuICogTm90aWNlIGhvdyBhbGwgdGhlIG5lZWRlZCBkYXRhIGlzIGZ1bGx5IHJlc29sdmVkIGFuZCBwYXNzZWQgaW4gKGkuZS4gbm8gb3RoZXIgY2FsbHMpLlxuICovXG5mdW5jdGlvbiBfcmVuZGVyTGluZShpbnB1dDogUmVzb2x2ZWRSZW5kZXJMaW5lSW5wdXQsIHNiOiBTdHJpbmdCdWlsZGVyKTogUmVuZGVyTGluZU91dHB1dCB7XG5cdGNvbnN0IGZvbnRJc01vbm9zcGFjZSA9IGlucHV0LmZvbnRJc01vbm9zcGFjZTtcblx0Y29uc3QgY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93ID0gaW5wdXQuY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93O1xuXHRjb25zdCBjb250YWluc0ZvcmVpZ25FbGVtZW50cyA9IGlucHV0LmNvbnRhaW5zRm9yZWlnbkVsZW1lbnRzO1xuXHRjb25zdCBsaW5lQ29udGVudCA9IGlucHV0LmxpbmVDb250ZW50O1xuXHRjb25zdCBsZW4gPSBpbnB1dC5sZW47XG5cdGNvbnN0IGlzT3ZlcmZsb3dpbmcgPSBpbnB1dC5pc092ZXJmbG93aW5nO1xuXHRjb25zdCBvdmVyZmxvd2luZ0NoYXJDb3VudCA9IGlucHV0Lm92ZXJmbG93aW5nQ2hhckNvdW50O1xuXHRjb25zdCBwYXJ0cyA9IGlucHV0LnBhcnRzO1xuXHRjb25zdCBmYXV4SW5kZW50TGVuZ3RoID0gaW5wdXQuZmF1eEluZGVudExlbmd0aDtcblx0Y29uc3QgdGFiU2l6ZSA9IGlucHV0LnRhYlNpemU7XG5cdGNvbnN0IHN0YXJ0VmlzaWJsZUNvbHVtbiA9IGlucHV0LnN0YXJ0VmlzaWJsZUNvbHVtbjtcblx0Y29uc3QgY29udGFpbnNSVEwgPSBpbnB1dC5jb250YWluc1JUTDtcblx0Y29uc3Qgc3BhY2VXaWR0aCA9IGlucHV0LnNwYWNlV2lkdGg7XG5cdGNvbnN0IHJlbmRlclNwYWNlQ2hhckNvZGUgPSBpbnB1dC5yZW5kZXJTcGFjZUNoYXJDb2RlO1xuXHRjb25zdCByZW5kZXJXaGl0ZXNwYWNlID0gaW5wdXQucmVuZGVyV2hpdGVzcGFjZTtcblx0Y29uc3QgcmVuZGVyQ29udHJvbENoYXJhY3RlcnMgPSBpbnB1dC5yZW5kZXJDb250cm9sQ2hhcmFjdGVycztcblxuXHRjb25zdCBjaGFyYWN0ZXJNYXBwaW5nID0gbmV3IENoYXJhY3Rlck1hcHBpbmcobGVuICsgMSwgcGFydHMubGVuZ3RoKTtcblx0bGV0IGxhc3RDaGFyYWN0ZXJNYXBwaW5nRGVmaW5lZCA9IGZhbHNlO1xuXG5cdGxldCBjaGFySW5kZXggPSAwO1xuXHRsZXQgdmlzaWJsZUNvbHVtbiA9IHN0YXJ0VmlzaWJsZUNvbHVtbjtcblx0bGV0IGNoYXJPZmZzZXRJblBhcnQgPSAwOyAvLyB0aGUgY2hhcmFjdGVyIG9mZnNldCBpbiB0aGUgY3VycmVudCBwYXJ0XG5cdGxldCBjaGFySG9yaXpvbnRhbE9mZnNldCA9IDA7IC8vIHRoZSBjaGFyYWN0ZXIgaG9yaXpvbnRhbCBwb3NpdGlvbiBpbiB0ZXJtcyBvZiBjaGFycyByZWxhdGl2ZSB0byBsaW5lIHN0YXJ0XG5cblx0bGV0IHBhcnREaXNwbGFjZW1lbnQgPSAwO1xuXG5cdGlmIChjb250YWluc1JUTCkge1xuXHRcdHNiLmFwcGVuZFN0cmluZygnPHNwYW4gZGlyPVwibHRyXCI+Jyk7XG5cdH0gZWxzZSB7XG5cdFx0c2IuYXBwZW5kU3RyaW5nKCc8c3Bhbj4nKTtcblx0fVxuXG5cdGZvciAobGV0IHBhcnRJbmRleCA9IDAsIHRva2Vuc0xlbiA9IHBhcnRzLmxlbmd0aDsgcGFydEluZGV4IDwgdG9rZW5zTGVuOyBwYXJ0SW5kZXgrKykge1xuXG5cdFx0Y29uc3QgcGFydCA9IHBhcnRzW3BhcnRJbmRleF07XG5cdFx0Y29uc3QgcGFydEVuZEluZGV4ID0gcGFydC5lbmRJbmRleDtcblx0XHRjb25zdCBwYXJ0VHlwZSA9IHBhcnQudHlwZTtcblx0XHRjb25zdCBwYXJ0Q29udGFpbnNSVEwgPSBwYXJ0LmNvbnRhaW5zUlRMO1xuXHRcdGNvbnN0IHBhcnRSZW5kZXJzV2hpdGVzcGFjZSA9IChyZW5kZXJXaGl0ZXNwYWNlICE9PSBSZW5kZXJXaGl0ZXNwYWNlLk5vbmUgJiYgcGFydC5pc1doaXRlc3BhY2UoKSk7XG5cdFx0Y29uc3QgcGFydFJlbmRlcnNXaGl0ZXNwYWNlV2l0aFdpZHRoID0gcGFydFJlbmRlcnNXaGl0ZXNwYWNlICYmICFmb250SXNNb25vc3BhY2UgJiYgKHBhcnRUeXBlID09PSAnbXRrdycvKm9ubHkgd2hpdGVzcGFjZSovIHx8ICFjb250YWluc0ZvcmVpZ25FbGVtZW50cyk7XG5cdFx0Y29uc3QgcGFydElzRW1wdHlBbmRIYXNQc2V1ZG9BZnRlciA9IChjaGFySW5kZXggPT09IHBhcnRFbmRJbmRleCAmJiBwYXJ0LmlzUHNldWRvQWZ0ZXIoKSk7XG5cdFx0Y2hhck9mZnNldEluUGFydCA9IDA7XG5cblx0XHRzYi5hcHBlbmRTdHJpbmcoJzxzcGFuICcpO1xuXHRcdGlmIChwYXJ0Q29udGFpbnNSVEwpIHtcblx0XHRcdHNiLmFwcGVuZFN0cmluZygnc3R5bGU9XCJ1bmljb2RlLWJpZGk6aXNvbGF0ZVwiICcpO1xuXHRcdH1cblx0XHRzYi5hcHBlbmRTdHJpbmcoJ2NsYXNzPVwiJyk7XG5cdFx0c2IuYXBwZW5kU3RyaW5nKHBhcnRSZW5kZXJzV2hpdGVzcGFjZVdpdGhXaWR0aCA/ICdtdGt6JyA6IHBhcnRUeXBlKTtcblx0XHRzYi5hcHBlbmRBU0NJSUNoYXJDb2RlKENoYXJDb2RlLkRvdWJsZVF1b3RlKTtcblxuXHRcdGlmIChwYXJ0UmVuZGVyc1doaXRlc3BhY2UpIHtcblxuXHRcdFx0bGV0IHBhcnRXaWR0aCA9IDA7XG5cdFx0XHR7XG5cdFx0XHRcdGxldCBfY2hhckluZGV4ID0gY2hhckluZGV4O1xuXHRcdFx0XHRsZXQgX3Zpc2libGVDb2x1bW4gPSB2aXNpYmxlQ29sdW1uO1xuXG5cdFx0XHRcdGZvciAoOyBfY2hhckluZGV4IDwgcGFydEVuZEluZGV4OyBfY2hhckluZGV4KyspIHtcblx0XHRcdFx0XHRjb25zdCBjaGFyQ29kZSA9IGxpbmVDb250ZW50LmNoYXJDb2RlQXQoX2NoYXJJbmRleCk7XG5cdFx0XHRcdFx0Y29uc3QgY2hhcldpZHRoID0gKGNoYXJDb2RlID09PSBDaGFyQ29kZS5UYWIgPyAodGFiU2l6ZSAtIChfdmlzaWJsZUNvbHVtbiAlIHRhYlNpemUpKSA6IDEpIHwgMDtcblx0XHRcdFx0XHRwYXJ0V2lkdGggKz0gY2hhcldpZHRoO1xuXHRcdFx0XHRcdGlmIChfY2hhckluZGV4ID49IGZhdXhJbmRlbnRMZW5ndGgpIHtcblx0XHRcdFx0XHRcdF92aXNpYmxlQ29sdW1uICs9IGNoYXJXaWR0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhcnRSZW5kZXJzV2hpdGVzcGFjZVdpdGhXaWR0aCkge1xuXHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoJyBzdHlsZT1cIndpZHRoOicpO1xuXHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoU3RyaW5nKHNwYWNlV2lkdGggKiBwYXJ0V2lkdGgpKTtcblx0XHRcdFx0c2IuYXBwZW5kU3RyaW5nKCdweFwiJyk7XG5cdFx0XHR9XG5cdFx0XHRzYi5hcHBlbmRBU0NJSUNoYXJDb2RlKENoYXJDb2RlLkdyZWF0ZXJUaGFuKTtcblxuXHRcdFx0Zm9yICg7IGNoYXJJbmRleCA8IHBhcnRFbmRJbmRleDsgY2hhckluZGV4KyspIHtcblx0XHRcdFx0Y2hhcmFjdGVyTWFwcGluZy5zZXRDb2x1bW5JbmZvKGNoYXJJbmRleCArIDEsIHBhcnRJbmRleCAtIHBhcnREaXNwbGFjZW1lbnQsIGNoYXJPZmZzZXRJblBhcnQsIGNoYXJIb3Jpem9udGFsT2Zmc2V0KTtcblx0XHRcdFx0cGFydERpc3BsYWNlbWVudCA9IDA7XG5cdFx0XHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjaGFySW5kZXgpO1xuXG5cdFx0XHRcdGxldCBwcm9kdWNlZENoYXJhY3RlcnM6IG51bWJlcjtcblx0XHRcdFx0bGV0IGNoYXJXaWR0aDogbnVtYmVyO1xuXG5cdFx0XHRcdGlmIChjaGFyQ29kZSA9PT0gQ2hhckNvZGUuVGFiKSB7XG5cdFx0XHRcdFx0cHJvZHVjZWRDaGFyYWN0ZXJzID0gKHRhYlNpemUgLSAodmlzaWJsZUNvbHVtbiAlIHRhYlNpemUpKSB8IDA7XG5cdFx0XHRcdFx0Y2hhcldpZHRoID0gcHJvZHVjZWRDaGFyYWN0ZXJzO1xuXG5cdFx0XHRcdFx0aWYgKCFjYW5Vc2VIYWxmd2lkdGhSaWdodHdhcmRzQXJyb3cgfHwgY2hhcldpZHRoID4gMSkge1xuXHRcdFx0XHRcdFx0c2IuYXBwZW5kQ2hhckNvZGUoMHgyMTkyKTsgLy8gUklHSFRXQVJEUyBBUlJPV1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzYi5hcHBlbmRDaGFyQ29kZSgweEZGRUIpOyAvLyBIQUxGV0lEVEggUklHSFRXQVJEUyBBUlJPV1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKGxldCBzcGFjZSA9IDI7IHNwYWNlIDw9IGNoYXJXaWR0aDsgc3BhY2UrKykge1xuXHRcdFx0XHRcdFx0c2IuYXBwZW5kQ2hhckNvZGUoMHhBMCk7IC8vICZuYnNwO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9IGVsc2UgeyAvLyBtdXN0IGJlIENoYXJDb2RlLlNwYWNlXG5cdFx0XHRcdFx0cHJvZHVjZWRDaGFyYWN0ZXJzID0gMjtcblx0XHRcdFx0XHRjaGFyV2lkdGggPSAxO1xuXG5cdFx0XHRcdFx0c2IuYXBwZW5kQ2hhckNvZGUocmVuZGVyU3BhY2VDaGFyQ29kZSk7IC8vICZtaWRkb3Q7IG9yIHdvcmQgc2VwYXJhdG9yIG1pZGRsZSBkb3Rcblx0XHRcdFx0XHRzYi5hcHBlbmRDaGFyQ29kZSgweDIwMEMpOyAvLyBaRVJPIFdJRFRIIE5PTi1KT0lORVJcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNoYXJPZmZzZXRJblBhcnQgKz0gcHJvZHVjZWRDaGFyYWN0ZXJzO1xuXHRcdFx0XHRjaGFySG9yaXpvbnRhbE9mZnNldCArPSBjaGFyV2lkdGg7XG5cdFx0XHRcdGlmIChjaGFySW5kZXggPj0gZmF1eEluZGVudExlbmd0aCkge1xuXHRcdFx0XHRcdHZpc2libGVDb2x1bW4gKz0gY2hhcldpZHRoO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHRzYi5hcHBlbmRBU0NJSUNoYXJDb2RlKENoYXJDb2RlLkdyZWF0ZXJUaGFuKTtcblxuXHRcdFx0Zm9yICg7IGNoYXJJbmRleCA8IHBhcnRFbmRJbmRleDsgY2hhckluZGV4KyspIHtcblx0XHRcdFx0Y2hhcmFjdGVyTWFwcGluZy5zZXRDb2x1bW5JbmZvKGNoYXJJbmRleCArIDEsIHBhcnRJbmRleCAtIHBhcnREaXNwbGFjZW1lbnQsIGNoYXJPZmZzZXRJblBhcnQsIGNoYXJIb3Jpem9udGFsT2Zmc2V0KTtcblx0XHRcdFx0cGFydERpc3BsYWNlbWVudCA9IDA7XG5cdFx0XHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjaGFySW5kZXgpO1xuXG5cdFx0XHRcdGxldCBwcm9kdWNlZENoYXJhY3RlcnMgPSAxO1xuXHRcdFx0XHRsZXQgY2hhcldpZHRoID0gMTtcblxuXHRcdFx0XHRzd2l0Y2ggKGNoYXJDb2RlKSB7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5UYWI6XG5cdFx0XHRcdFx0XHRwcm9kdWNlZENoYXJhY3RlcnMgPSAodGFiU2l6ZSAtICh2aXNpYmxlQ29sdW1uICUgdGFiU2l6ZSkpO1xuXHRcdFx0XHRcdFx0Y2hhcldpZHRoID0gcHJvZHVjZWRDaGFyYWN0ZXJzO1xuXHRcdFx0XHRcdFx0Zm9yIChsZXQgc3BhY2UgPSAxOyBzcGFjZSA8PSBwcm9kdWNlZENoYXJhY3RlcnM7IHNwYWNlKyspIHtcblx0XHRcdFx0XHRcdFx0c2IuYXBwZW5kQ2hhckNvZGUoMHhBMCk7IC8vICZuYnNwO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLlNwYWNlOlxuXHRcdFx0XHRcdFx0c2IuYXBwZW5kQ2hhckNvZGUoMHhBMCk7IC8vICZuYnNwO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLkxlc3NUaGFuOlxuXHRcdFx0XHRcdFx0c2IuYXBwZW5kU3RyaW5nKCcmbHQ7Jyk7XG5cdFx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuR3JlYXRlclRoYW46XG5cdFx0XHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoJyZndDsnKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5BbXBlcnNhbmQ6XG5cdFx0XHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoJyZhbXA7Jyk7XG5cdFx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuTnVsbDpcblx0XHRcdFx0XHRcdGlmIChyZW5kZXJDb250cm9sQ2hhcmFjdGVycykge1xuXHRcdFx0XHRcdFx0XHQvLyBTZWUgaHR0cHM6Ly91bmljb2RlLXRhYmxlLmNvbS9lbi9ibG9ja3MvY29udHJvbC1waWN0dXJlcy9cblx0XHRcdFx0XHRcdFx0c2IuYXBwZW5kQ2hhckNvZGUoOTIxNik7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoJyYjMDA7Jyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuVVRGOF9CT006XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5MSU5FX1NFUEFSQVRPUjpcblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLlBBUkFHUkFQSF9TRVBBUkFUT1I6XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5ORVhUX0xJTkU6XG5cdFx0XHRcdFx0XHRzYi5hcHBlbmRDaGFyQ29kZSgweEZGRkQpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0aWYgKHN0cmluZ3MuaXNGdWxsV2lkdGhDaGFyYWN0ZXIoY2hhckNvZGUpKSB7XG5cdFx0XHRcdFx0XHRcdGNoYXJXaWR0aCsrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly8gU2VlIGh0dHBzOi8vdW5pY29kZS10YWJsZS5jb20vZW4vYmxvY2tzL2NvbnRyb2wtcGljdHVyZXMvXG5cdFx0XHRcdFx0XHRpZiAocmVuZGVyQ29udHJvbENoYXJhY3RlcnMgJiYgY2hhckNvZGUgPCAzMikge1xuXHRcdFx0XHRcdFx0XHRzYi5hcHBlbmRDaGFyQ29kZSg5MjE2ICsgY2hhckNvZGUpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChyZW5kZXJDb250cm9sQ2hhcmFjdGVycyAmJiBjaGFyQ29kZSA9PT0gMTI3KSB7XG5cdFx0XHRcdFx0XHRcdC8vIERFTFxuXHRcdFx0XHRcdFx0XHRzYi5hcHBlbmRDaGFyQ29kZSg5MjQ5KTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAocmVuZGVyQ29udHJvbENoYXJhY3RlcnMgJiYgaXNDb250cm9sQ2hhcmFjdGVyKGNoYXJDb2RlKSkge1xuXHRcdFx0XHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoJ1tVKycpO1xuXHRcdFx0XHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcodG80Q2hhckhleChjaGFyQ29kZSkpO1xuXHRcdFx0XHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoJ10nKTtcblx0XHRcdFx0XHRcdFx0cHJvZHVjZWRDaGFyYWN0ZXJzID0gODtcblx0XHRcdFx0XHRcdFx0Y2hhcldpZHRoID0gcHJvZHVjZWRDaGFyYWN0ZXJzO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0c2IuYXBwZW5kQ2hhckNvZGUoY2hhckNvZGUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y2hhck9mZnNldEluUGFydCArPSBwcm9kdWNlZENoYXJhY3RlcnM7XG5cdFx0XHRcdGNoYXJIb3Jpem9udGFsT2Zmc2V0ICs9IGNoYXJXaWR0aDtcblx0XHRcdFx0aWYgKGNoYXJJbmRleCA+PSBmYXV4SW5kZW50TGVuZ3RoKSB7XG5cdFx0XHRcdFx0dmlzaWJsZUNvbHVtbiArPSBjaGFyV2lkdGg7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocGFydElzRW1wdHlBbmRIYXNQc2V1ZG9BZnRlcikge1xuXHRcdFx0cGFydERpc3BsYWNlbWVudCsrO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwYXJ0RGlzcGxhY2VtZW50ID0gMDtcblx0XHR9XG5cblx0XHRpZiAoY2hhckluZGV4ID49IGxlbiAmJiAhbGFzdENoYXJhY3Rlck1hcHBpbmdEZWZpbmVkICYmIHBhcnQuaXNQc2V1ZG9BZnRlcigpKSB7XG5cdFx0XHRsYXN0Q2hhcmFjdGVyTWFwcGluZ0RlZmluZWQgPSB0cnVlO1xuXHRcdFx0Y2hhcmFjdGVyTWFwcGluZy5zZXRDb2x1bW5JbmZvKGNoYXJJbmRleCArIDEsIHBhcnRJbmRleCwgY2hhck9mZnNldEluUGFydCwgY2hhckhvcml6b250YWxPZmZzZXQpO1xuXHRcdH1cblxuXHRcdHNiLmFwcGVuZFN0cmluZygnPC9zcGFuPicpO1xuXG5cdH1cblxuXHRpZiAoIWxhc3RDaGFyYWN0ZXJNYXBwaW5nRGVmaW5lZCkge1xuXHRcdC8vIFdoZW4gZ2V0dGluZyBjbGllbnQgcmVjdHMgZm9yIHRoZSBsYXN0IGNoYXJhY3Rlciwgd2Ugd2lsbCBwb3NpdGlvbiB0aGVcblx0XHQvLyB0ZXh0IHJhbmdlIGF0IHRoZSBlbmQgb2YgdGhlIHNwYW4sIGluc3RlYWYgb2YgYXQgdGhlIGJlZ2lubmluZyBvZiBuZXh0IHNwYW5cblx0XHRjaGFyYWN0ZXJNYXBwaW5nLnNldENvbHVtbkluZm8obGVuICsgMSwgcGFydHMubGVuZ3RoIC0gMSwgY2hhck9mZnNldEluUGFydCwgY2hhckhvcml6b250YWxPZmZzZXQpO1xuXHR9XG5cblx0aWYgKGlzT3ZlcmZsb3dpbmcpIHtcblx0XHRzYi5hcHBlbmRTdHJpbmcoJzxzcGFuIGNsYXNzPVwibXRrb3ZlcmZsb3dcIj4nKTtcblx0XHRzYi5hcHBlbmRTdHJpbmcobmxzLmxvY2FsaXplKCdzaG93TW9yZScsIFwiU2hvdyBtb3JlICh7MH0pXCIsIHJlbmRlck92ZXJmbG93aW5nQ2hhckNvdW50KG92ZXJmbG93aW5nQ2hhckNvdW50KSkpO1xuXHRcdHNiLmFwcGVuZFN0cmluZygnPC9zcGFuPicpO1xuXHR9XG5cblx0c2IuYXBwZW5kU3RyaW5nKCc8L3NwYW4+Jyk7XG5cblx0cmV0dXJuIG5ldyBSZW5kZXJMaW5lT3V0cHV0KGNoYXJhY3Rlck1hcHBpbmcsIGNvbnRhaW5zUlRMLCBjb250YWluc0ZvcmVpZ25FbGVtZW50cyk7XG59XG5cbmZ1bmN0aW9uIHRvNENoYXJIZXgobjogbnVtYmVyKTogc3RyaW5nIHtcblx0cmV0dXJuIG4udG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkucGFkU3RhcnQoNCwgJzAnKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyT3ZlcmZsb3dpbmdDaGFyQ291bnQobjogbnVtYmVyKTogc3RyaW5nIHtcblx0aWYgKG4gPCAxMDI0KSB7XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnb3ZlcmZsb3cuY2hhcnMnLCBcInswfSBjaGFyc1wiLCBuKTtcblx0fVxuXHRpZiAobiA8IDEwMjQgKiAxMDI0KSB7XG5cdFx0cmV0dXJuIGAkeyhuIC8gMTAyNCkudG9GaXhlZCgxKX0gS0JgO1xuXHR9XG5cdHJldHVybiBgJHsobiAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDEpfSBNQmA7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNB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LGVBQWU7QUFDbEIsT0FBRyxhQUFhLDRCQUE0QjtBQUM1QyxPQUFHLGFBQWEsSUFBSSxTQUFTLFlBQVksbUJBQW1CLDJCQUEyQixvQkFBb0IsQ0FBQyxDQUFDO0FBQzdHLE9BQUcsYUFBYSxTQUFTO0FBQUEsRUFDMUI7QUFFQSxLQUFHLGFBQWEsU0FBUztBQUV6QixTQUFPLElBQUksaUJBQWlCLGtCQUFrQixhQUFhLHVCQUF1QjtBQUNuRjtBQUVBLFNBQVMsV0FBVyxHQUFtQjtBQUN0QyxTQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUsWUFBWSxFQUFFLFNBQVMsR0FBRyxHQUFHO0FBQ3BEO0FBRUEsU0FBUywyQkFBMkIsR0FBbUI7QUFDdEQsTUFBSSxJQUFJLE1BQU07QUFDYixXQUFPLElBQUksU0FBUyxrQkFBa0IsYUFBYSxDQUFDO0FBQUEsRUFDckQ7QUFDQSxNQUFJLElBQUksT0FBTyxNQUFNO0FBQ3BCLFdBQU8sSUFBSSxJQUFJLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFBQSxFQUNoQztBQUNBLFNBQU8sSUFBSSxJQUFJLE9BQU8sTUFBTSxRQUFRLENBQUMsQ0FBQztBQUN2QzsiLAogICJuYW1lcyI6IFsiUmVuZGVyV2hpdGVzcGFjZSIsICJDaGFyYWN0ZXJNYXBwaW5nQ29uc3RhbnRzIiwgIkZvcmVpZ25FbGVtZW50VHlwZSIsICJsZW4iLCAidG9rZW5Db250YWluc1JUTCIsICJDb25zdGFudHMiXQp9Cg==
