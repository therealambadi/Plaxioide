import { CharCode } from "../../../base/common/charCode.js";
import * as strings from "../../../base/common/strings.js";
import { WrappingIndent, EditorOption } from "../config/editorOptions.js";
import { CharacterClassifier } from "../core/characterClassifier.js";
import { LineInjectedText } from "../textModelEvents.js";
import { ModelLineProjectionData } from "../modelLineProjectionData.js";
class MonospaceLineBreaksComputerFactory {
  static create(options) {
    return new MonospaceLineBreaksComputerFactory(
      options.get(EditorOption.wordWrapBreakBeforeCharacters),
      options.get(EditorOption.wordWrapBreakAfterCharacters)
    );
  }
  constructor(breakBeforeChars, breakAfterChars) {
    this.classifier = new WrappingCharacterClassifier(breakBeforeChars, breakAfterChars);
  }
  createLineBreaksComputer(fontInfo, tabSize, wrappingColumn, wrappingIndent, wordBreak) {
    const requests = [];
    const injectedTexts = [];
    const previousBreakingData = [];
    return {
      addRequest: (lineText, injectedText, previousLineBreakData) => {
        requests.push(lineText);
        injectedTexts.push(injectedText);
        previousBreakingData.push(previousLineBreakData);
      },
      finalize: () => {
        const columnsForFullWidthChar = fontInfo.typicalFullwidthCharacterWidth / fontInfo.typicalHalfwidthCharacterWidth;
        const result = [];
        for (let i = 0, len = requests.length; i < len; i++) {
          const injectedText = injectedTexts[i];
          const previousLineBreakData = previousBreakingData[i];
          if (previousLineBreakData && !previousLineBreakData.injectionOptions && !injectedText) {
            result[i] = createLineBreaksFromPreviousLineBreaks(this.classifier, previousLineBreakData, requests[i], tabSize, wrappingColumn, columnsForFullWidthChar, wrappingIndent, wordBreak);
          } else {
            result[i] = createLineBreaks(this.classifier, requests[i], injectedText, tabSize, wrappingColumn, columnsForFullWidthChar, wrappingIndent, wordBreak);
          }
        }
        arrPool1.length = 0;
        arrPool2.length = 0;
        return result;
      }
    };
  }
}
var CharacterClass = /* @__PURE__ */ ((CharacterClass2) => {
  CharacterClass2[CharacterClass2["NONE"] = 0] = "NONE";
  CharacterClass2[CharacterClass2["BREAK_BEFORE"] = 1] = "BREAK_BEFORE";
  CharacterClass2[CharacterClass2["BREAK_AFTER"] = 2] = "BREAK_AFTER";
  CharacterClass2[CharacterClass2["BREAK_IDEOGRAPHIC"] = 3] = "BREAK_IDEOGRAPHIC";
  return CharacterClass2;
})(CharacterClass || {});
class WrappingCharacterClassifier extends CharacterClassifier {
  constructor(BREAK_BEFORE, BREAK_AFTER) {
    super(0 /* NONE */);
    for (let i = 0; i < BREAK_BEFORE.length; i++) {
      this.set(BREAK_BEFORE.charCodeAt(i), 1 /* BREAK_BEFORE */);
    }
    for (let i = 0; i < BREAK_AFTER.length; i++) {
      this.set(BREAK_AFTER.charCodeAt(i), 2 /* BREAK_AFTER */);
    }
  }
  get(charCode) {
    if (charCode >= 0 && charCode < 256) {
      return this._asciiMap[charCode];
    } else {
      if (charCode >= 12352 && charCode <= 12543 || charCode >= 13312 && charCode <= 19903 || charCode >= 19968 && charCode <= 40959) {
        return 3 /* BREAK_IDEOGRAPHIC */;
      }
      return this._map.get(charCode) || this._defaultValue;
    }
  }
}
let arrPool1 = [];
let arrPool2 = [];
function createLineBreaksFromPreviousLineBreaks(classifier, previousBreakingData, lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent, wordBreak) {
  if (firstLineBreakColumn === -1) {
    return null;
  }
  const len = lineText.length;
  if (len <= 1) {
    return null;
  }
  const isKeepAll = wordBreak === "keepAll";
  const prevBreakingOffsets = previousBreakingData.breakOffsets;
  const prevBreakingOffsetsVisibleColumn = previousBreakingData.breakOffsetsVisibleColumn;
  const wrappedTextIndentLength = computeWrappedTextIndentLength(lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent);
  const wrappedLineBreakColumn = firstLineBreakColumn - wrappedTextIndentLength;
  const breakingOffsets = arrPool1;
  const breakingOffsetsVisibleColumn = arrPool2;
  let breakingOffsetsCount = 0;
  let lastBreakingOffset = 0;
  let lastBreakingOffsetVisibleColumn = 0;
  let breakingColumn = firstLineBreakColumn;
  const prevLen = prevBreakingOffsets.length;
  let prevIndex = 0;
  if (prevIndex >= 0) {
    let bestDistance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex] - breakingColumn);
    while (prevIndex + 1 < prevLen) {
      const distance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex + 1] - breakingColumn);
      if (distance >= bestDistance) {
        break;
      }
      bestDistance = distance;
      prevIndex++;
    }
  }
  while (prevIndex < prevLen) {
    let prevBreakOffset = prevIndex < 0 ? 0 : prevBreakingOffsets[prevIndex];
    let prevBreakOffsetVisibleColumn = prevIndex < 0 ? 0 : prevBreakingOffsetsVisibleColumn[prevIndex];
    if (lastBreakingOffset > prevBreakOffset) {
      prevBreakOffset = lastBreakingOffset;
      prevBreakOffsetVisibleColumn = lastBreakingOffsetVisibleColumn;
    }
    let breakOffset = 0;
    let breakOffsetVisibleColumn = 0;
    let forcedBreakOffset = 0;
    let forcedBreakOffsetVisibleColumn = 0;
    if (prevBreakOffsetVisibleColumn <= breakingColumn) {
      let visibleColumn = prevBreakOffsetVisibleColumn;
      let prevCharCode = prevBreakOffset === 0 ? CharCode.Null : lineText.charCodeAt(prevBreakOffset - 1);
      let prevCharCodeClass = prevBreakOffset === 0 ? 0 /* NONE */ : classifier.get(prevCharCode);
      let entireLineFits = true;
      for (let i = prevBreakOffset; i < len; i++) {
        const charStartOffset = i;
        const charCode = lineText.charCodeAt(i);
        let charCodeClass;
        let charWidth;
        if (strings.isHighSurrogate(charCode)) {
          i++;
          charCodeClass = 0 /* NONE */;
          charWidth = 2;
        } else {
          charCodeClass = classifier.get(charCode);
          charWidth = computeCharWidth(charCode, visibleColumn, tabSize, columnsForFullWidthChar);
        }
        if (charStartOffset > lastBreakingOffset && canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll)) {
          breakOffset = charStartOffset;
          breakOffsetVisibleColumn = visibleColumn;
        }
        visibleColumn += charWidth;
        if (visibleColumn > breakingColumn) {
          if (charStartOffset > lastBreakingOffset) {
            forcedBreakOffset = charStartOffset;
            forcedBreakOffsetVisibleColumn = visibleColumn - charWidth;
          } else {
            forcedBreakOffset = i + 1;
            forcedBreakOffsetVisibleColumn = visibleColumn;
          }
          if (visibleColumn - breakOffsetVisibleColumn > wrappedLineBreakColumn) {
            breakOffset = 0;
          }
          entireLineFits = false;
          break;
        }
        prevCharCode = charCode;
        prevCharCodeClass = charCodeClass;
      }
      if (entireLineFits) {
        if (breakingOffsetsCount > 0) {
          breakingOffsets[breakingOffsetsCount] = prevBreakingOffsets[prevBreakingOffsets.length - 1];
          breakingOffsetsVisibleColumn[breakingOffsetsCount] = prevBreakingOffsetsVisibleColumn[prevBreakingOffsets.length - 1];
          breakingOffsetsCount++;
        }
        break;
      }
    }
    if (breakOffset === 0) {
      let visibleColumn = prevBreakOffsetVisibleColumn;
      let charCode = lineText.charCodeAt(prevBreakOffset);
      let charCodeClass = classifier.get(charCode);
      let hitATabCharacter = false;
      for (let i = prevBreakOffset - 1; i >= lastBreakingOffset; i--) {
        const charStartOffset = i + 1;
        const prevCharCode = lineText.charCodeAt(i);
        if (prevCharCode === CharCode.Tab) {
          hitATabCharacter = true;
          break;
        }
        let prevCharCodeClass;
        let prevCharWidth;
        if (strings.isLowSurrogate(prevCharCode)) {
          i--;
          prevCharCodeClass = 0 /* NONE */;
          prevCharWidth = 2;
        } else {
          prevCharCodeClass = classifier.get(prevCharCode);
          prevCharWidth = strings.isFullWidthCharacter(prevCharCode) ? columnsForFullWidthChar : 1;
        }
        if (visibleColumn <= breakingColumn) {
          if (forcedBreakOffset === 0) {
            forcedBreakOffset = charStartOffset;
            forcedBreakOffsetVisibleColumn = visibleColumn;
          }
          if (visibleColumn <= breakingColumn - wrappedLineBreakColumn) {
            break;
          }
          if (canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll)) {
            breakOffset = charStartOffset;
            breakOffsetVisibleColumn = visibleColumn;
            break;
          }
        }
        visibleColumn -= prevCharWidth;
        charCode = prevCharCode;
        charCodeClass = prevCharCodeClass;
      }
      if (breakOffset !== 0) {
        const remainingWidthOfNextLine = wrappedLineBreakColumn - (forcedBreakOffsetVisibleColumn - breakOffsetVisibleColumn);
        if (remainingWidthOfNextLine <= tabSize) {
          const charCodeAtForcedBreakOffset = lineText.charCodeAt(forcedBreakOffset);
          let charWidth;
          if (strings.isHighSurrogate(charCodeAtForcedBreakOffset)) {
            charWidth = 2;
          } else {
            charWidth = computeCharWidth(charCodeAtForcedBreakOffset, forcedBreakOffsetVisibleColumn, tabSize, columnsForFullWidthChar);
          }
          if (remainingWidthOfNextLine - charWidth < 0) {
            breakOffset = 0;
          }
        }
      }
      if (hitATabCharacter) {
        prevIndex--;
        continue;
      }
    }
    if (breakOffset === 0) {
      breakOffset = forcedBreakOffset;
      breakOffsetVisibleColumn = forcedBreakOffsetVisibleColumn;
    }
    if (breakOffset <= lastBreakingOffset) {
      const charCode = lineText.charCodeAt(lastBreakingOffset);
      if (strings.isHighSurrogate(charCode)) {
        breakOffset = lastBreakingOffset + 2;
        breakOffsetVisibleColumn = lastBreakingOffsetVisibleColumn + 2;
      } else {
        breakOffset = lastBreakingOffset + 1;
        breakOffsetVisibleColumn = lastBreakingOffsetVisibleColumn + computeCharWidth(charCode, lastBreakingOffsetVisibleColumn, tabSize, columnsForFullWidthChar);
      }
    }
    lastBreakingOffset = breakOffset;
    breakingOffsets[breakingOffsetsCount] = breakOffset;
    lastBreakingOffsetVisibleColumn = breakOffsetVisibleColumn;
    breakingOffsetsVisibleColumn[breakingOffsetsCount] = breakOffsetVisibleColumn;
    breakingOffsetsCount++;
    breakingColumn = breakOffsetVisibleColumn + wrappedLineBreakColumn;
    while (prevIndex < 0 || prevIndex < prevLen && prevBreakingOffsetsVisibleColumn[prevIndex] < breakOffsetVisibleColumn) {
      prevIndex++;
    }
    let bestDistance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex] - breakingColumn);
    while (prevIndex + 1 < prevLen) {
      const distance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex + 1] - breakingColumn);
      if (distance >= bestDistance) {
        break;
      }
      bestDistance = distance;
      prevIndex++;
    }
  }
  if (breakingOffsetsCount === 0) {
    return null;
  }
  breakingOffsets.length = breakingOffsetsCount;
  breakingOffsetsVisibleColumn.length = breakingOffsetsCount;
  arrPool1 = previousBreakingData.breakOffsets;
  arrPool2 = previousBreakingData.breakOffsetsVisibleColumn;
  previousBreakingData.breakOffsets = breakingOffsets;
  previousBreakingData.breakOffsetsVisibleColumn = breakingOffsetsVisibleColumn;
  previousBreakingData.wrappedTextIndentLength = wrappedTextIndentLength;
  return previousBreakingData;
}
function createLineBreaks(classifier, _lineText, injectedTexts, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent, wordBreak) {
  const lineText = LineInjectedText.applyInjectedText(_lineText, injectedTexts);
  let injectionOptions;
  let injectionOffsets;
  if (injectedTexts && injectedTexts.length > 0) {
    injectionOptions = injectedTexts.map((t) => t.options);
    injectionOffsets = injectedTexts.map((text) => text.column - 1);
  } else {
    injectionOptions = null;
    injectionOffsets = null;
  }
  if (firstLineBreakColumn === -1) {
    if (!injectionOptions) {
      return null;
    }
    return new ModelLineProjectionData(injectionOffsets, injectionOptions, [lineText.length], [], 0);
  }
  const len = lineText.length;
  if (len <= 1) {
    if (!injectionOptions) {
      return null;
    }
    return new ModelLineProjectionData(injectionOffsets, injectionOptions, [lineText.length], [], 0);
  }
  const isKeepAll = wordBreak === "keepAll";
  const wrappedTextIndentLength = computeWrappedTextIndentLength(lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent);
  const wrappedLineBreakColumn = firstLineBreakColumn - wrappedTextIndentLength;
  const breakingOffsets = [];
  const breakingOffsetsVisibleColumn = [];
  let breakingOffsetsCount = 0;
  let breakOffset = 0;
  let breakOffsetVisibleColumn = 0;
  let breakingColumn = firstLineBreakColumn;
  let prevCharCode = lineText.charCodeAt(0);
  let prevCharCodeClass = classifier.get(prevCharCode);
  let visibleColumn = computeCharWidth(prevCharCode, 0, tabSize, columnsForFullWidthChar);
  let startOffset = 1;
  if (strings.isHighSurrogate(prevCharCode)) {
    visibleColumn += 1;
    prevCharCode = lineText.charCodeAt(1);
    prevCharCodeClass = classifier.get(prevCharCode);
    startOffset++;
  }
  for (let i = startOffset; i < len; i++) {
    const charStartOffset = i;
    const charCode = lineText.charCodeAt(i);
    let charCodeClass;
    let charWidth;
    if (strings.isHighSurrogate(charCode)) {
      i++;
      charCodeClass = 0 /* NONE */;
      charWidth = 2;
    } else {
      charCodeClass = classifier.get(charCode);
      charWidth = computeCharWidth(charCode, visibleColumn, tabSize, columnsForFullWidthChar);
    }
    if (canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll)) {
      breakOffset = charStartOffset;
      breakOffsetVisibleColumn = visibleColumn;
    }
    visibleColumn += charWidth;
    if (visibleColumn > breakingColumn) {
      if (breakOffset === 0 || visibleColumn - breakOffsetVisibleColumn > wrappedLineBreakColumn) {
        breakOffset = charStartOffset;
        breakOffsetVisibleColumn = visibleColumn - charWidth;
      }
      breakingOffsets[breakingOffsetsCount] = breakOffset;
      breakingOffsetsVisibleColumn[breakingOffsetsCount] = breakOffsetVisibleColumn;
      breakingOffsetsCount++;
      breakingColumn = breakOffsetVisibleColumn + wrappedLineBreakColumn;
      breakOffset = 0;
    }
    prevCharCode = charCode;
    prevCharCodeClass = charCodeClass;
  }
  if (breakingOffsetsCount === 0 && (!injectedTexts || injectedTexts.length === 0)) {
    return null;
  }
  breakingOffsets[breakingOffsetsCount] = len;
  breakingOffsetsVisibleColumn[breakingOffsetsCount] = visibleColumn;
  return new ModelLineProjectionData(injectionOffsets, injectionOptions, breakingOffsets, breakingOffsetsVisibleColumn, wrappedTextIndentLength);
}
function computeCharWidth(charCode, visibleColumn, tabSize, columnsForFullWidthChar) {
  if (charCode === CharCode.Tab) {
    return tabSize - visibleColumn % tabSize;
  }
  if (strings.isFullWidthCharacter(charCode)) {
    return columnsForFullWidthChar;
  }
  if (charCode < 32) {
    return columnsForFullWidthChar;
  }
  return 1;
}
function tabCharacterWidth(visibleColumn, tabSize) {
  return tabSize - visibleColumn % tabSize;
}
function canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll) {
  return charCode !== CharCode.Space && (prevCharCodeClass === 2 /* BREAK_AFTER */ && charCodeClass !== 2 /* BREAK_AFTER */ || prevCharCodeClass !== 1 /* BREAK_BEFORE */ && charCodeClass === 1 /* BREAK_BEFORE */ || !isKeepAll && prevCharCodeClass === 3 /* BREAK_IDEOGRAPHIC */ && charCodeClass !== 2 /* BREAK_AFTER */ || !isKeepAll && charCodeClass === 3 /* BREAK_IDEOGRAPHIC */ && prevCharCodeClass !== 1 /* BREAK_BEFORE */);
}
function computeWrappedTextIndentLength(lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent) {
  let wrappedTextIndentLength = 0;
  if (wrappingIndent !== WrappingIndent.None) {
    const firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineText);
    if (firstNonWhitespaceIndex !== -1) {
      for (let i = 0; i < firstNonWhitespaceIndex; i++) {
        const charWidth = lineText.charCodeAt(i) === CharCode.Tab ? tabCharacterWidth(wrappedTextIndentLength, tabSize) : 1;
        wrappedTextIndentLength += charWidth;
      }
      const numberOfAdditionalTabs = wrappingIndent === WrappingIndent.DeepIndent ? 2 : wrappingIndent === WrappingIndent.Indent ? 1 : 0;
      for (let i = 0; i < numberOfAdditionalTabs; i++) {
        const charWidth = tabCharacterWidth(wrappedTextIndentLength, tabSize);
        wrappedTextIndentLength += charWidth;
      }
      if (wrappedTextIndentLength + columnsForFullWidthChar > firstLineBreakColumn) {
        wrappedTextIndentLength = 0;
      }
    }
  }
  return wrappedTextIndentLength;
}
export {
  MonospaceLineBreaksComputerFactory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3ZpZXdNb2RlbC9tb25vc3BhY2VMaW5lQnJlYWtzQ29tcHV0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NoYXJDb2RlLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBXcmFwcGluZ0luZGVudCwgSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2hhcmFjdGVyQ2xhc3NpZmllciB9IGZyb20gJy4uL2NvcmUvY2hhcmFjdGVyQ2xhc3NpZmllci5qcyc7XG5pbXBvcnQgeyBGb250SW5mbyB9IGZyb20gJy4uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgeyBMaW5lSW5qZWN0ZWRUZXh0IH0gZnJvbSAnLi4vdGV4dE1vZGVsRXZlbnRzLmpzJztcbmltcG9ydCB7IEluamVjdGVkVGV4dE9wdGlvbnMgfSBmcm9tICcuLi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSwgSUxpbmVCcmVha3NDb21wdXRlciwgTW9kZWxMaW5lUHJvamVjdGlvbkRhdGEgfSBmcm9tICcuLi9tb2RlbExpbmVQcm9qZWN0aW9uRGF0YS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBNb25vc3BhY2VMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5IGltcGxlbWVudHMgSUxpbmVCcmVha3NDb21wdXRlckZhY3Rvcnkge1xuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZShvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zKTogTW9ub3NwYWNlTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSB7XG5cdFx0cmV0dXJuIG5ldyBNb25vc3BhY2VMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5KFxuXHRcdFx0b3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndvcmRXcmFwQnJlYWtCZWZvcmVDaGFyYWN0ZXJzKSxcblx0XHRcdG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkV3JhcEJyZWFrQWZ0ZXJDaGFyYWN0ZXJzKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGNsYXNzaWZpZXI6IFdyYXBwaW5nQ2hhcmFjdGVyQ2xhc3NpZmllcjtcblxuXHRjb25zdHJ1Y3RvcihicmVha0JlZm9yZUNoYXJzOiBzdHJpbmcsIGJyZWFrQWZ0ZXJDaGFyczogc3RyaW5nKSB7XG5cdFx0dGhpcy5jbGFzc2lmaWVyID0gbmV3IFdyYXBwaW5nQ2hhcmFjdGVyQ2xhc3NpZmllcihicmVha0JlZm9yZUNoYXJzLCBicmVha0FmdGVyQ2hhcnMpO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZUxpbmVCcmVha3NDb21wdXRlcihmb250SW5mbzogRm9udEluZm8sIHRhYlNpemU6IG51bWJlciwgd3JhcHBpbmdDb2x1bW46IG51bWJlciwgd3JhcHBpbmdJbmRlbnQ6IFdyYXBwaW5nSW5kZW50LCB3b3JkQnJlYWs6ICdub3JtYWwnIHwgJ2tlZXBBbGwnKTogSUxpbmVCcmVha3NDb21wdXRlciB7XG5cdFx0Y29uc3QgcmVxdWVzdHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgaW5qZWN0ZWRUZXh0czogKExpbmVJbmplY3RlZFRleHRbXSB8IG51bGwpW10gPSBbXTtcblx0XHRjb25zdCBwcmV2aW91c0JyZWFraW5nRGF0YTogKE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbClbXSA9IFtdO1xuXHRcdHJldHVybiB7XG5cdFx0XHRhZGRSZXF1ZXN0OiAobGluZVRleHQ6IHN0cmluZywgaW5qZWN0ZWRUZXh0OiBMaW5lSW5qZWN0ZWRUZXh0W10gfCBudWxsLCBwcmV2aW91c0xpbmVCcmVha0RhdGE6IE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbCkgPT4ge1xuXHRcdFx0XHRyZXF1ZXN0cy5wdXNoKGxpbmVUZXh0KTtcblx0XHRcdFx0aW5qZWN0ZWRUZXh0cy5wdXNoKGluamVjdGVkVGV4dCk7XG5cdFx0XHRcdHByZXZpb3VzQnJlYWtpbmdEYXRhLnB1c2gocHJldmlvdXNMaW5lQnJlYWtEYXRhKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5hbGl6ZTogKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb2x1bW5zRm9yRnVsbFdpZHRoQ2hhciA9IGZvbnRJbmZvLnR5cGljYWxGdWxsd2lkdGhDaGFyYWN0ZXJXaWR0aCAvIGZvbnRJbmZvLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDtcblx0XHRcdFx0Y29uc3QgcmVzdWx0OiAoTW9kZWxMaW5lUHJvamVjdGlvbkRhdGEgfCBudWxsKVtdID0gW107XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSByZXF1ZXN0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGluamVjdGVkVGV4dCA9IGluamVjdGVkVGV4dHNbaV07XG5cdFx0XHRcdFx0Y29uc3QgcHJldmlvdXNMaW5lQnJlYWtEYXRhID0gcHJldmlvdXNCcmVha2luZ0RhdGFbaV07XG5cdFx0XHRcdFx0aWYgKHByZXZpb3VzTGluZUJyZWFrRGF0YSAmJiAhcHJldmlvdXNMaW5lQnJlYWtEYXRhLmluamVjdGlvbk9wdGlvbnMgJiYgIWluamVjdGVkVGV4dCkge1xuXHRcdFx0XHRcdFx0cmVzdWx0W2ldID0gY3JlYXRlTGluZUJyZWFrc0Zyb21QcmV2aW91c0xpbmVCcmVha3ModGhpcy5jbGFzc2lmaWVyLCBwcmV2aW91c0xpbmVCcmVha0RhdGEsIHJlcXVlc3RzW2ldLCB0YWJTaXplLCB3cmFwcGluZ0NvbHVtbiwgY29sdW1uc0ZvckZ1bGxXaWR0aENoYXIsIHdyYXBwaW5nSW5kZW50LCB3b3JkQnJlYWspO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXN1bHRbaV0gPSBjcmVhdGVMaW5lQnJlYWtzKHRoaXMuY2xhc3NpZmllciwgcmVxdWVzdHNbaV0sIGluamVjdGVkVGV4dCwgdGFiU2l6ZSwgd3JhcHBpbmdDb2x1bW4sIGNvbHVtbnNGb3JGdWxsV2lkdGhDaGFyLCB3cmFwcGluZ0luZGVudCwgd29yZEJyZWFrKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YXJyUG9vbDEubGVuZ3RoID0gMDtcblx0XHRcdFx0YXJyUG9vbDIubGVuZ3RoID0gMDtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmNvbnN0IGVudW0gQ2hhcmFjdGVyQ2xhc3Mge1xuXHROT05FID0gMCxcblx0QlJFQUtfQkVGT1JFID0gMSxcblx0QlJFQUtfQUZURVIgPSAyLFxuXHRCUkVBS19JREVPR1JBUEhJQyA9IDMgLy8gZm9yIEhhbiBhbmQgS2FuYS5cbn1cblxuY2xhc3MgV3JhcHBpbmdDaGFyYWN0ZXJDbGFzc2lmaWVyIGV4dGVuZHMgQ2hhcmFjdGVyQ2xhc3NpZmllcjxDaGFyYWN0ZXJDbGFzcz4ge1xuXG5cdGNvbnN0cnVjdG9yKEJSRUFLX0JFRk9SRTogc3RyaW5nLCBCUkVBS19BRlRFUjogc3RyaW5nKSB7XG5cdFx0c3VwZXIoQ2hhcmFjdGVyQ2xhc3MuTk9ORSk7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IEJSRUFLX0JFRk9SRS5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5zZXQoQlJFQUtfQkVGT1JFLmNoYXJDb2RlQXQoaSksIENoYXJhY3RlckNsYXNzLkJSRUFLX0JFRk9SRSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBCUkVBS19BRlRFUi5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5zZXQoQlJFQUtfQUZURVIuY2hhckNvZGVBdChpKSwgQ2hhcmFjdGVyQ2xhc3MuQlJFQUtfQUZURVIpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXQoY2hhckNvZGU6IG51bWJlcik6IENoYXJhY3RlckNsYXNzIHtcblx0XHRpZiAoY2hhckNvZGUgPj0gMCAmJiBjaGFyQ29kZSA8IDI1Nikge1xuXHRcdFx0cmV0dXJuIDxDaGFyYWN0ZXJDbGFzcz50aGlzLl9hc2NpaU1hcFtjaGFyQ29kZV07XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEluaXRpYWxpemUgQ2hhcmFjdGVyQ2xhc3MuQlJFQUtfSURFT0dSQVBISUMgZm9yIHRoZXNlIFVuaWNvZGUgcmFuZ2VzOlxuXHRcdFx0Ly8gMS4gQ0pLIFVuaWZpZWQgSWRlb2dyYXBocyAoMHg0RTAwIC0tIDB4OUZGRilcblx0XHRcdC8vIDIuIENKSyBVbmlmaWVkIElkZW9ncmFwaHMgRXh0ZW5zaW9uIEEgKDB4MzQwMCAtLSAweDREQkYpXG5cdFx0XHQvLyAzLiBIaXJhZ2FuYSBhbmQgS2F0YWthbmEgKDB4MzA0MCAtLSAweDMwRkYpXG5cdFx0XHRpZiAoXG5cdFx0XHRcdChjaGFyQ29kZSA+PSAweDMwNDAgJiYgY2hhckNvZGUgPD0gMHgzMEZGKVxuXHRcdFx0XHR8fCAoY2hhckNvZGUgPj0gMHgzNDAwICYmIGNoYXJDb2RlIDw9IDB4NERCRilcblx0XHRcdFx0fHwgKGNoYXJDb2RlID49IDB4NEUwMCAmJiBjaGFyQ29kZSA8PSAweDlGRkYpXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIENoYXJhY3RlckNsYXNzLkJSRUFLX0lERU9HUkFQSElDO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gPENoYXJhY3RlckNsYXNzPih0aGlzLl9tYXAuZ2V0KGNoYXJDb2RlKSB8fCB0aGlzLl9kZWZhdWx0VmFsdWUpO1xuXHRcdH1cblx0fVxufVxuXG5sZXQgYXJyUG9vbDE6IG51bWJlcltdID0gW107XG5sZXQgYXJyUG9vbDI6IG51bWJlcltdID0gW107XG5cbmZ1bmN0aW9uIGNyZWF0ZUxpbmVCcmVha3NGcm9tUHJldmlvdXNMaW5lQnJlYWtzKGNsYXNzaWZpZXI6IFdyYXBwaW5nQ2hhcmFjdGVyQ2xhc3NpZmllciwgcHJldmlvdXNCcmVha2luZ0RhdGE6IE1vZGVsTGluZVByb2plY3Rpb25EYXRhLCBsaW5lVGV4dDogc3RyaW5nLCB0YWJTaXplOiBudW1iZXIsIGZpcnN0TGluZUJyZWFrQ29sdW1uOiBudW1iZXIsIGNvbHVtbnNGb3JGdWxsV2lkdGhDaGFyOiBudW1iZXIsIHdyYXBwaW5nSW5kZW50OiBXcmFwcGluZ0luZGVudCwgd29yZEJyZWFrOiAnbm9ybWFsJyB8ICdrZWVwQWxsJyk6IE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbCB7XG5cdGlmIChmaXJzdExpbmVCcmVha0NvbHVtbiA9PT0gLTEpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGxlbiA9IGxpbmVUZXh0Lmxlbmd0aDtcblx0aWYgKGxlbiA8PSAxKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBpc0tlZXBBbGwgPSAod29yZEJyZWFrID09PSAna2VlcEFsbCcpO1xuXG5cdGNvbnN0IHByZXZCcmVha2luZ09mZnNldHMgPSBwcmV2aW91c0JyZWFraW5nRGF0YS5icmVha09mZnNldHM7XG5cdGNvbnN0IHByZXZCcmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uID0gcHJldmlvdXNCcmVha2luZ0RhdGEuYnJlYWtPZmZzZXRzVmlzaWJsZUNvbHVtbjtcblxuXHRjb25zdCB3cmFwcGVkVGV4dEluZGVudExlbmd0aCA9IGNvbXB1dGVXcmFwcGVkVGV4dEluZGVudExlbmd0aChsaW5lVGV4dCwgdGFiU2l6ZSwgZmlyc3RMaW5lQnJlYWtDb2x1bW4sIGNvbHVtbnNGb3JGdWxsV2lkdGhDaGFyLCB3cmFwcGluZ0luZGVudCk7XG5cdGNvbnN0IHdyYXBwZWRMaW5lQnJlYWtDb2x1bW4gPSBmaXJzdExpbmVCcmVha0NvbHVtbiAtIHdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoO1xuXG5cdGNvbnN0IGJyZWFraW5nT2Zmc2V0czogbnVtYmVyW10gPSBhcnJQb29sMTtcblx0Y29uc3QgYnJlYWtpbmdPZmZzZXRzVmlzaWJsZUNvbHVtbjogbnVtYmVyW10gPSBhcnJQb29sMjtcblx0bGV0IGJyZWFraW5nT2Zmc2V0c0NvdW50ID0gMDtcblx0bGV0IGxhc3RCcmVha2luZ09mZnNldCA9IDA7XG5cdGxldCBsYXN0QnJlYWtpbmdPZmZzZXRWaXNpYmxlQ29sdW1uID0gMDtcblxuXHRsZXQgYnJlYWtpbmdDb2x1bW4gPSBmaXJzdExpbmVCcmVha0NvbHVtbjtcblx0Y29uc3QgcHJldkxlbiA9IHByZXZCcmVha2luZ09mZnNldHMubGVuZ3RoO1xuXHRsZXQgcHJldkluZGV4ID0gMDtcblxuXHRpZiAocHJldkluZGV4ID49IDApIHtcblx0XHRsZXQgYmVzdERpc3RhbmNlID0gTWF0aC5hYnMocHJldkJyZWFraW5nT2Zmc2V0c1Zpc2libGVDb2x1bW5bcHJldkluZGV4XSAtIGJyZWFraW5nQ29sdW1uKTtcblx0XHR3aGlsZSAocHJldkluZGV4ICsgMSA8IHByZXZMZW4pIHtcblx0XHRcdGNvbnN0IGRpc3RhbmNlID0gTWF0aC5hYnMocHJldkJyZWFraW5nT2Zmc2V0c1Zpc2libGVDb2x1bW5bcHJldkluZGV4ICsgMV0gLSBicmVha2luZ0NvbHVtbik7XG5cdFx0XHRpZiAoZGlzdGFuY2UgPj0gYmVzdERpc3RhbmNlKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0YmVzdERpc3RhbmNlID0gZGlzdGFuY2U7XG5cdFx0XHRwcmV2SW5kZXgrKztcblx0XHR9XG5cdH1cblxuXHR3aGlsZSAocHJldkluZGV4IDwgcHJldkxlbikge1xuXHRcdC8vIEFsbG93IGZvciBwcmV2SW5kZXggdG8gYmUgLTEgKGZvciB0aGUgY2FzZSB3aGVyZSB3ZSBoaXQgYSB0YWIgd2hlbiB3YWxraW5nIGJhY2t3YXJkcyBmcm9tIHRoZSBmaXJzdCBicmVhaylcblx0XHRsZXQgcHJldkJyZWFrT2Zmc2V0ID0gcHJldkluZGV4IDwgMCA/IDAgOiBwcmV2QnJlYWtpbmdPZmZzZXRzW3ByZXZJbmRleF07XG5cdFx0bGV0IHByZXZCcmVha09mZnNldFZpc2libGVDb2x1bW4gPSBwcmV2SW5kZXggPCAwID8gMCA6IHByZXZCcmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uW3ByZXZJbmRleF07XG5cdFx0aWYgKGxhc3RCcmVha2luZ09mZnNldCA+IHByZXZCcmVha09mZnNldCkge1xuXHRcdFx0cHJldkJyZWFrT2Zmc2V0ID0gbGFzdEJyZWFraW5nT2Zmc2V0O1xuXHRcdFx0cHJldkJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiA9IGxhc3RCcmVha2luZ09mZnNldFZpc2libGVDb2x1bW47XG5cdFx0fVxuXG5cdFx0bGV0IGJyZWFrT2Zmc2V0ID0gMDtcblx0XHRsZXQgYnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uID0gMDtcblxuXHRcdGxldCBmb3JjZWRCcmVha09mZnNldCA9IDA7XG5cdFx0bGV0IGZvcmNlZEJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiA9IDA7XG5cblx0XHQvLyBpbml0aWFsbHksIHdlIHNlYXJjaCBhcyBtdWNoIGFzIHBvc3NpYmxlIHRvIHRoZSByaWdodCAoaWYgaXQgZml0cylcblx0XHRpZiAocHJldkJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiA8PSBicmVha2luZ0NvbHVtbikge1xuXHRcdFx0bGV0IHZpc2libGVDb2x1bW4gPSBwcmV2QnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uO1xuXHRcdFx0bGV0IHByZXZDaGFyQ29kZSA9IHByZXZCcmVha09mZnNldCA9PT0gMCA/IENoYXJDb2RlLk51bGwgOiBsaW5lVGV4dC5jaGFyQ29kZUF0KHByZXZCcmVha09mZnNldCAtIDEpO1xuXHRcdFx0bGV0IHByZXZDaGFyQ29kZUNsYXNzID0gcHJldkJyZWFrT2Zmc2V0ID09PSAwID8gQ2hhcmFjdGVyQ2xhc3MuTk9ORSA6IGNsYXNzaWZpZXIuZ2V0KHByZXZDaGFyQ29kZSk7XG5cdFx0XHRsZXQgZW50aXJlTGluZUZpdHMgPSB0cnVlO1xuXHRcdFx0Zm9yIChsZXQgaSA9IHByZXZCcmVha09mZnNldDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNoYXJTdGFydE9mZnNldCA9IGk7XG5cdFx0XHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZVRleHQuY2hhckNvZGVBdChpKTtcblx0XHRcdFx0bGV0IGNoYXJDb2RlQ2xhc3M6IG51bWJlcjtcblx0XHRcdFx0bGV0IGNoYXJXaWR0aDogbnVtYmVyO1xuXG5cdFx0XHRcdGlmIChzdHJpbmdzLmlzSGlnaFN1cnJvZ2F0ZShjaGFyQ29kZSkpIHtcblx0XHRcdFx0XHQvLyBBIHN1cnJvZ2F0ZSBwYWlyIG11c3QgYWx3YXlzIGJlIGNvbnNpZGVyZWQgYXMgYSBzaW5nbGUgdW5pdCwgc28gaXQgaXMgbmV2ZXIgdG8gYmUgYnJva2VuXG5cdFx0XHRcdFx0aSsrO1xuXHRcdFx0XHRcdGNoYXJDb2RlQ2xhc3MgPSBDaGFyYWN0ZXJDbGFzcy5OT05FO1xuXHRcdFx0XHRcdGNoYXJXaWR0aCA9IDI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2hhckNvZGVDbGFzcyA9IGNsYXNzaWZpZXIuZ2V0KGNoYXJDb2RlKTtcblx0XHRcdFx0XHRjaGFyV2lkdGggPSBjb21wdXRlQ2hhcldpZHRoKGNoYXJDb2RlLCB2aXNpYmxlQ29sdW1uLCB0YWJTaXplLCBjb2x1bW5zRm9yRnVsbFdpZHRoQ2hhcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY2hhclN0YXJ0T2Zmc2V0ID4gbGFzdEJyZWFraW5nT2Zmc2V0ICYmIGNhbkJyZWFrKHByZXZDaGFyQ29kZSwgcHJldkNoYXJDb2RlQ2xhc3MsIGNoYXJDb2RlLCBjaGFyQ29kZUNsYXNzLCBpc0tlZXBBbGwpKSB7XG5cdFx0XHRcdFx0YnJlYWtPZmZzZXQgPSBjaGFyU3RhcnRPZmZzZXQ7XG5cdFx0XHRcdFx0YnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uID0gdmlzaWJsZUNvbHVtbjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZpc2libGVDb2x1bW4gKz0gY2hhcldpZHRoO1xuXG5cdFx0XHRcdC8vIGNoZWNrIGlmIGFkZGluZyBjaGFyYWN0ZXIgYXQgYGlgIHdpbGwgZ28gb3ZlciB0aGUgYnJlYWtpbmcgY29sdW1uXG5cdFx0XHRcdGlmICh2aXNpYmxlQ29sdW1uID4gYnJlYWtpbmdDb2x1bW4pIHtcblx0XHRcdFx0XHQvLyBXZSBuZWVkIHRvIGJyZWFrIGF0IGxlYXN0IGJlZm9yZSBjaGFyYWN0ZXIgYXQgYGlgOlxuXHRcdFx0XHRcdGlmIChjaGFyU3RhcnRPZmZzZXQgPiBsYXN0QnJlYWtpbmdPZmZzZXQpIHtcblx0XHRcdFx0XHRcdGZvcmNlZEJyZWFrT2Zmc2V0ID0gY2hhclN0YXJ0T2Zmc2V0O1xuXHRcdFx0XHRcdFx0Zm9yY2VkQnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uID0gdmlzaWJsZUNvbHVtbiAtIGNoYXJXaWR0aDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gd2UgbmVlZCB0byBhZHZhbmNlIGF0IGxlYXN0IGJ5IG9uZSBjaGFyYWN0ZXJcblx0XHRcdFx0XHRcdGZvcmNlZEJyZWFrT2Zmc2V0ID0gaSArIDE7XG5cdFx0XHRcdFx0XHRmb3JjZWRCcmVha09mZnNldFZpc2libGVDb2x1bW4gPSB2aXNpYmxlQ29sdW1uO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh2aXNpYmxlQ29sdW1uIC0gYnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uID4gd3JhcHBlZExpbmVCcmVha0NvbHVtbikge1xuXHRcdFx0XHRcdFx0Ly8gQ2Fubm90IGJyZWFrIGF0IGBicmVha09mZnNldGAgPT4gcmVzZXQgaXQgaWYgaXQgd2FzIHNldFxuXHRcdFx0XHRcdFx0YnJlYWtPZmZzZXQgPSAwO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGVudGlyZUxpbmVGaXRzID0gZmFsc2U7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcmV2Q2hhckNvZGUgPSBjaGFyQ29kZTtcblx0XHRcdFx0cHJldkNoYXJDb2RlQ2xhc3MgPSBjaGFyQ29kZUNsYXNzO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZW50aXJlTGluZUZpdHMpIHtcblx0XHRcdFx0Ly8gdGhlcmUgaXMgbm8gbW9yZSBuZWVkIHRvIGJyZWFrID0+IHN0b3AgdGhlIG91dGVyIGxvb3AhXG5cdFx0XHRcdGlmIChicmVha2luZ09mZnNldHNDb3VudCA+IDApIHtcblx0XHRcdFx0XHQvLyBBZGQgbGFzdCBzZWdtZW50LCBubyBuZWVkIHRvIGFzc2lnbiB0byBgbGFzdEJyZWFraW5nT2Zmc2V0YCBhbmQgYGxhc3RCcmVha2luZ09mZnNldFZpc2libGVDb2x1bW5gXG5cdFx0XHRcdFx0YnJlYWtpbmdPZmZzZXRzW2JyZWFraW5nT2Zmc2V0c0NvdW50XSA9IHByZXZCcmVha2luZ09mZnNldHNbcHJldkJyZWFraW5nT2Zmc2V0cy5sZW5ndGggLSAxXTtcblx0XHRcdFx0XHRicmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uW2JyZWFraW5nT2Zmc2V0c0NvdW50XSA9IHByZXZCcmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uW3ByZXZCcmVha2luZ09mZnNldHMubGVuZ3RoIC0gMV07XG5cdFx0XHRcdFx0YnJlYWtpbmdPZmZzZXRzQ291bnQrKztcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoYnJlYWtPZmZzZXQgPT09IDApIHtcblx0XHRcdC8vIG11c3Qgc2VhcmNoIGxlZnRcblx0XHRcdGxldCB2aXNpYmxlQ29sdW1uID0gcHJldkJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbjtcblx0XHRcdGxldCBjaGFyQ29kZSA9IGxpbmVUZXh0LmNoYXJDb2RlQXQocHJldkJyZWFrT2Zmc2V0KTtcblx0XHRcdGxldCBjaGFyQ29kZUNsYXNzID0gY2xhc3NpZmllci5nZXQoY2hhckNvZGUpO1xuXHRcdFx0bGV0IGhpdEFUYWJDaGFyYWN0ZXIgPSBmYWxzZTtcblx0XHRcdGZvciAobGV0IGkgPSBwcmV2QnJlYWtPZmZzZXQgLSAxOyBpID49IGxhc3RCcmVha2luZ09mZnNldDsgaS0tKSB7XG5cdFx0XHRcdGNvbnN0IGNoYXJTdGFydE9mZnNldCA9IGkgKyAxO1xuXHRcdFx0XHRjb25zdCBwcmV2Q2hhckNvZGUgPSBsaW5lVGV4dC5jaGFyQ29kZUF0KGkpO1xuXG5cdFx0XHRcdGlmIChwcmV2Q2hhckNvZGUgPT09IENoYXJDb2RlLlRhYikge1xuXHRcdFx0XHRcdC8vIGNhbm5vdCBkZXRlcm1pbmUgdGhlIHdpZHRoIG9mIGEgdGFiIHdoZW4gZ29pbmcgYmFja3dhcmRzLCBzbyB3ZSBtdXN0IGdvIGZvcndhcmRzXG5cdFx0XHRcdFx0aGl0QVRhYkNoYXJhY3RlciA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgcHJldkNoYXJDb2RlQ2xhc3M6IG51bWJlcjtcblx0XHRcdFx0bGV0IHByZXZDaGFyV2lkdGg6IG51bWJlcjtcblxuXHRcdFx0XHRpZiAoc3RyaW5ncy5pc0xvd1N1cnJvZ2F0ZShwcmV2Q2hhckNvZGUpKSB7XG5cdFx0XHRcdFx0Ly8gQSBzdXJyb2dhdGUgcGFpciBtdXN0IGFsd2F5cyBiZSBjb25zaWRlcmVkIGFzIGEgc2luZ2xlIHVuaXQsIHNvIGl0IGlzIG5ldmVyIHRvIGJlIGJyb2tlblxuXHRcdFx0XHRcdGktLTtcblx0XHRcdFx0XHRwcmV2Q2hhckNvZGVDbGFzcyA9IENoYXJhY3RlckNsYXNzLk5PTkU7XG5cdFx0XHRcdFx0cHJldkNoYXJXaWR0aCA9IDI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cHJldkNoYXJDb2RlQ2xhc3MgPSBjbGFzc2lmaWVyLmdldChwcmV2Q2hhckNvZGUpO1xuXHRcdFx0XHRcdHByZXZDaGFyV2lkdGggPSAoc3RyaW5ncy5pc0Z1bGxXaWR0aENoYXJhY3RlcihwcmV2Q2hhckNvZGUpID8gY29sdW1uc0ZvckZ1bGxXaWR0aENoYXIgOiAxKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh2aXNpYmxlQ29sdW1uIDw9IGJyZWFraW5nQ29sdW1uKSB7XG5cdFx0XHRcdFx0aWYgKGZvcmNlZEJyZWFrT2Zmc2V0ID09PSAwKSB7XG5cdFx0XHRcdFx0XHRmb3JjZWRCcmVha09mZnNldCA9IGNoYXJTdGFydE9mZnNldDtcblx0XHRcdFx0XHRcdGZvcmNlZEJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiA9IHZpc2libGVDb2x1bW47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHZpc2libGVDb2x1bW4gPD0gYnJlYWtpbmdDb2x1bW4gLSB3cmFwcGVkTGluZUJyZWFrQ29sdW1uKSB7XG5cdFx0XHRcdFx0XHQvLyB3ZW50IHRvbyBmYXIhXG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoY2FuQnJlYWsocHJldkNoYXJDb2RlLCBwcmV2Q2hhckNvZGVDbGFzcywgY2hhckNvZGUsIGNoYXJDb2RlQ2xhc3MsIGlzS2VlcEFsbCkpIHtcblx0XHRcdFx0XHRcdGJyZWFrT2Zmc2V0ID0gY2hhclN0YXJ0T2Zmc2V0O1xuXHRcdFx0XHRcdFx0YnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uID0gdmlzaWJsZUNvbHVtbjtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZpc2libGVDb2x1bW4gLT0gcHJldkNoYXJXaWR0aDtcblx0XHRcdFx0Y2hhckNvZGUgPSBwcmV2Q2hhckNvZGU7XG5cdFx0XHRcdGNoYXJDb2RlQ2xhc3MgPSBwcmV2Q2hhckNvZGVDbGFzcztcblx0XHRcdH1cblxuXHRcdFx0aWYgKGJyZWFrT2Zmc2V0ICE9PSAwKSB7XG5cdFx0XHRcdGNvbnN0IHJlbWFpbmluZ1dpZHRoT2ZOZXh0TGluZSA9IHdyYXBwZWRMaW5lQnJlYWtDb2x1bW4gLSAoZm9yY2VkQnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uIC0gYnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uKTtcblx0XHRcdFx0aWYgKHJlbWFpbmluZ1dpZHRoT2ZOZXh0TGluZSA8PSB0YWJTaXplKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hhckNvZGVBdEZvcmNlZEJyZWFrT2Zmc2V0ID0gbGluZVRleHQuY2hhckNvZGVBdChmb3JjZWRCcmVha09mZnNldCk7XG5cdFx0XHRcdFx0bGV0IGNoYXJXaWR0aDogbnVtYmVyO1xuXHRcdFx0XHRcdGlmIChzdHJpbmdzLmlzSGlnaFN1cnJvZ2F0ZShjaGFyQ29kZUF0Rm9yY2VkQnJlYWtPZmZzZXQpKSB7XG5cdFx0XHRcdFx0XHQvLyBBIHN1cnJvZ2F0ZSBwYWlyIG11c3QgYWx3YXlzIGJlIGNvbnNpZGVyZWQgYXMgYSBzaW5nbGUgdW5pdCwgc28gaXQgaXMgbmV2ZXIgdG8gYmUgYnJva2VuXG5cdFx0XHRcdFx0XHRjaGFyV2lkdGggPSAyO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjaGFyV2lkdGggPSBjb21wdXRlQ2hhcldpZHRoKGNoYXJDb2RlQXRGb3JjZWRCcmVha09mZnNldCwgZm9yY2VkQnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uLCB0YWJTaXplLCBjb2x1bW5zRm9yRnVsbFdpZHRoQ2hhcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChyZW1haW5pbmdXaWR0aE9mTmV4dExpbmUgLSBjaGFyV2lkdGggPCAwKSB7XG5cdFx0XHRcdFx0XHQvLyBpdCBpcyBub3Qgd29ydGggaXQgdG8gYnJlYWsgYXQgYnJlYWtPZmZzZXQsIGl0IGp1c3QgaW50cm9kdWNlcyBhbiBleHRyYSBuZWVkbGVzcyBsaW5lIVxuXHRcdFx0XHRcdFx0YnJlYWtPZmZzZXQgPSAwO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaGl0QVRhYkNoYXJhY3Rlcikge1xuXHRcdFx0XHQvLyBjYW5ub3QgZGV0ZXJtaW5lIHRoZSB3aWR0aCBvZiBhIHRhYiB3aGVuIGdvaW5nIGJhY2t3YXJkcywgc28gd2UgbXVzdCBnbyBmb3J3YXJkcyBmcm9tIHRoZSBwcmV2aW91cyBicmVha1xuXHRcdFx0XHRwcmV2SW5kZXgtLTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGJyZWFrT2Zmc2V0ID09PSAwKSB7XG5cdFx0XHQvLyBDb3VsZCBub3QgZmluZCBhIGdvb2QgYnJlYWtpbmcgcG9pbnRcblx0XHRcdGJyZWFrT2Zmc2V0ID0gZm9yY2VkQnJlYWtPZmZzZXQ7XG5cdFx0XHRicmVha09mZnNldFZpc2libGVDb2x1bW4gPSBmb3JjZWRCcmVha09mZnNldFZpc2libGVDb2x1bW47XG5cdFx0fVxuXG5cdFx0aWYgKGJyZWFrT2Zmc2V0IDw9IGxhc3RCcmVha2luZ09mZnNldCkge1xuXHRcdFx0Ly8gTWFrZSBzdXJlIHRoYXQgd2UgYXJlIGFkdmFuY2luZyAoYXQgbGVhc3Qgb25lIGNoYXJhY3Rlcilcblx0XHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZVRleHQuY2hhckNvZGVBdChsYXN0QnJlYWtpbmdPZmZzZXQpO1xuXHRcdFx0aWYgKHN0cmluZ3MuaXNIaWdoU3Vycm9nYXRlKGNoYXJDb2RlKSkge1xuXHRcdFx0XHQvLyBBIHN1cnJvZ2F0ZSBwYWlyIG11c3QgYWx3YXlzIGJlIGNvbnNpZGVyZWQgYXMgYSBzaW5nbGUgdW5pdCwgc28gaXQgaXMgbmV2ZXIgdG8gYmUgYnJva2VuXG5cdFx0XHRcdGJyZWFrT2Zmc2V0ID0gbGFzdEJyZWFraW5nT2Zmc2V0ICsgMjtcblx0XHRcdFx0YnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uID0gbGFzdEJyZWFraW5nT2Zmc2V0VmlzaWJsZUNvbHVtbiArIDI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRicmVha09mZnNldCA9IGxhc3RCcmVha2luZ09mZnNldCArIDE7XG5cdFx0XHRcdGJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiA9IGxhc3RCcmVha2luZ09mZnNldFZpc2libGVDb2x1bW4gKyBjb21wdXRlQ2hhcldpZHRoKGNoYXJDb2RlLCBsYXN0QnJlYWtpbmdPZmZzZXRWaXNpYmxlQ29sdW1uLCB0YWJTaXplLCBjb2x1bW5zRm9yRnVsbFdpZHRoQ2hhcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGFzdEJyZWFraW5nT2Zmc2V0ID0gYnJlYWtPZmZzZXQ7XG5cdFx0YnJlYWtpbmdPZmZzZXRzW2JyZWFraW5nT2Zmc2V0c0NvdW50XSA9IGJyZWFrT2Zmc2V0O1xuXHRcdGxhc3RCcmVha2luZ09mZnNldFZpc2libGVDb2x1bW4gPSBicmVha09mZnNldFZpc2libGVDb2x1bW47XG5cdFx0YnJlYWtpbmdPZmZzZXRzVmlzaWJsZUNvbHVtblticmVha2luZ09mZnNldHNDb3VudF0gPSBicmVha09mZnNldFZpc2libGVDb2x1bW47XG5cdFx0YnJlYWtpbmdPZmZzZXRzQ291bnQrKztcblx0XHRicmVha2luZ0NvbHVtbiA9IGJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiArIHdyYXBwZWRMaW5lQnJlYWtDb2x1bW47XG5cblx0XHR3aGlsZSAocHJldkluZGV4IDwgMCB8fCAocHJldkluZGV4IDwgcHJldkxlbiAmJiBwcmV2QnJlYWtpbmdPZmZzZXRzVmlzaWJsZUNvbHVtbltwcmV2SW5kZXhdIDwgYnJlYWtPZmZzZXRWaXNpYmxlQ29sdW1uKSkge1xuXHRcdFx0cHJldkluZGV4Kys7XG5cdFx0fVxuXG5cdFx0bGV0IGJlc3REaXN0YW5jZSA9IE1hdGguYWJzKHByZXZCcmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uW3ByZXZJbmRleF0gLSBicmVha2luZ0NvbHVtbik7XG5cdFx0d2hpbGUgKHByZXZJbmRleCArIDEgPCBwcmV2TGVuKSB7XG5cdFx0XHRjb25zdCBkaXN0YW5jZSA9IE1hdGguYWJzKHByZXZCcmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uW3ByZXZJbmRleCArIDFdIC0gYnJlYWtpbmdDb2x1bW4pO1xuXHRcdFx0aWYgKGRpc3RhbmNlID49IGJlc3REaXN0YW5jZSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGJlc3REaXN0YW5jZSA9IGRpc3RhbmNlO1xuXHRcdFx0cHJldkluZGV4Kys7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGJyZWFraW5nT2Zmc2V0c0NvdW50ID09PSAwKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHQvLyBEb2luZyBoZXJlIHNvbWUgb2JqZWN0IHJldXNlIHdoaWNoIGVuZHMgdXAgaGVscGluZyBhIGh1Z2UgZGVhbCB3aXRoIEdDIHBhdXNlcyFcblx0YnJlYWtpbmdPZmZzZXRzLmxlbmd0aCA9IGJyZWFraW5nT2Zmc2V0c0NvdW50O1xuXHRicmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uLmxlbmd0aCA9IGJyZWFraW5nT2Zmc2V0c0NvdW50O1xuXHRhcnJQb29sMSA9IHByZXZpb3VzQnJlYWtpbmdEYXRhLmJyZWFrT2Zmc2V0cztcblx0YXJyUG9vbDIgPSBwcmV2aW91c0JyZWFraW5nRGF0YS5icmVha09mZnNldHNWaXNpYmxlQ29sdW1uO1xuXHRwcmV2aW91c0JyZWFraW5nRGF0YS5icmVha09mZnNldHMgPSBicmVha2luZ09mZnNldHM7XG5cdHByZXZpb3VzQnJlYWtpbmdEYXRhLmJyZWFrT2Zmc2V0c1Zpc2libGVDb2x1bW4gPSBicmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uO1xuXHRwcmV2aW91c0JyZWFraW5nRGF0YS53cmFwcGVkVGV4dEluZGVudExlbmd0aCA9IHdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoO1xuXHRyZXR1cm4gcHJldmlvdXNCcmVha2luZ0RhdGE7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUxpbmVCcmVha3MoY2xhc3NpZmllcjogV3JhcHBpbmdDaGFyYWN0ZXJDbGFzc2lmaWVyLCBfbGluZVRleHQ6IHN0cmluZywgaW5qZWN0ZWRUZXh0czogTGluZUluamVjdGVkVGV4dFtdIHwgbnVsbCwgdGFiU2l6ZTogbnVtYmVyLCBmaXJzdExpbmVCcmVha0NvbHVtbjogbnVtYmVyLCBjb2x1bW5zRm9yRnVsbFdpZHRoQ2hhcjogbnVtYmVyLCB3cmFwcGluZ0luZGVudDogV3JhcHBpbmdJbmRlbnQsIHdvcmRCcmVhazogJ25vcm1hbCcgfCAna2VlcEFsbCcpOiBNb2RlbExpbmVQcm9qZWN0aW9uRGF0YSB8IG51bGwge1xuXHRjb25zdCBsaW5lVGV4dCA9IExpbmVJbmplY3RlZFRleHQuYXBwbHlJbmplY3RlZFRleHQoX2xpbmVUZXh0LCBpbmplY3RlZFRleHRzKTtcblxuXHRsZXQgaW5qZWN0aW9uT3B0aW9uczogSW5qZWN0ZWRUZXh0T3B0aW9uc1tdIHwgbnVsbDtcblx0bGV0IGluamVjdGlvbk9mZnNldHM6IG51bWJlcltdIHwgbnVsbDtcblx0aWYgKGluamVjdGVkVGV4dHMgJiYgaW5qZWN0ZWRUZXh0cy5sZW5ndGggPiAwKSB7XG5cdFx0aW5qZWN0aW9uT3B0aW9ucyA9IGluamVjdGVkVGV4dHMubWFwKHQgPT4gdC5vcHRpb25zKTtcblx0XHRpbmplY3Rpb25PZmZzZXRzID0gaW5qZWN0ZWRUZXh0cy5tYXAodGV4dCA9PiB0ZXh0LmNvbHVtbiAtIDEpO1xuXHR9IGVsc2Uge1xuXHRcdGluamVjdGlvbk9wdGlvbnMgPSBudWxsO1xuXHRcdGluamVjdGlvbk9mZnNldHMgPSBudWxsO1xuXHR9XG5cblx0aWYgKGZpcnN0TGluZUJyZWFrQ29sdW1uID09PSAtMSkge1xuXHRcdGlmICghaW5qZWN0aW9uT3B0aW9ucykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdC8vIGNyZWF0aW5nIGEgYExpbmVCcmVha0RhdGFgIHdpdGggYW4gaW52YWxpZCBgYnJlYWtPZmZzZXRzVmlzaWJsZUNvbHVtbmAgaXMgT0tcblx0XHQvLyBiZWNhdXNlIGBicmVha09mZnNldHNWaXNpYmxlQ29sdW1uYCB3aWxsIG5ldmVyIGJlIHVzZWQgYmVjYXVzZSBpdCBjb250YWlucyBpbmplY3RlZCB0ZXh0XG5cdFx0cmV0dXJuIG5ldyBNb2RlbExpbmVQcm9qZWN0aW9uRGF0YShpbmplY3Rpb25PZmZzZXRzLCBpbmplY3Rpb25PcHRpb25zLCBbbGluZVRleHQubGVuZ3RoXSwgW10sIDApO1xuXHR9XG5cblx0Y29uc3QgbGVuID0gbGluZVRleHQubGVuZ3RoO1xuXHRpZiAobGVuIDw9IDEpIHtcblx0XHRpZiAoIWluamVjdGlvbk9wdGlvbnMpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHQvLyBjcmVhdGluZyBhIGBMaW5lQnJlYWtEYXRhYCB3aXRoIGFuIGludmFsaWQgYGJyZWFrT2Zmc2V0c1Zpc2libGVDb2x1bW5gIGlzIE9LXG5cdFx0Ly8gYmVjYXVzZSBgYnJlYWtPZmZzZXRzVmlzaWJsZUNvbHVtbmAgd2lsbCBuZXZlciBiZSB1c2VkIGJlY2F1c2UgaXQgY29udGFpbnMgaW5qZWN0ZWQgdGV4dFxuXHRcdHJldHVybiBuZXcgTW9kZWxMaW5lUHJvamVjdGlvbkRhdGEoaW5qZWN0aW9uT2Zmc2V0cywgaW5qZWN0aW9uT3B0aW9ucywgW2xpbmVUZXh0Lmxlbmd0aF0sIFtdLCAwKTtcblx0fVxuXG5cdGNvbnN0IGlzS2VlcEFsbCA9ICh3b3JkQnJlYWsgPT09ICdrZWVwQWxsJyk7XG5cdGNvbnN0IHdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoID0gY29tcHV0ZVdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoKGxpbmVUZXh0LCB0YWJTaXplLCBmaXJzdExpbmVCcmVha0NvbHVtbiwgY29sdW1uc0ZvckZ1bGxXaWR0aENoYXIsIHdyYXBwaW5nSW5kZW50KTtcblx0Y29uc3Qgd3JhcHBlZExpbmVCcmVha0NvbHVtbiA9IGZpcnN0TGluZUJyZWFrQ29sdW1uIC0gd3JhcHBlZFRleHRJbmRlbnRMZW5ndGg7XG5cblx0Y29uc3QgYnJlYWtpbmdPZmZzZXRzOiBudW1iZXJbXSA9IFtdO1xuXHRjb25zdCBicmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uOiBudW1iZXJbXSA9IFtdO1xuXHRsZXQgYnJlYWtpbmdPZmZzZXRzQ291bnQ6IG51bWJlciA9IDA7XG5cdGxldCBicmVha09mZnNldCA9IDA7XG5cdGxldCBicmVha09mZnNldFZpc2libGVDb2x1bW4gPSAwO1xuXG5cdGxldCBicmVha2luZ0NvbHVtbiA9IGZpcnN0TGluZUJyZWFrQ29sdW1uO1xuXHRsZXQgcHJldkNoYXJDb2RlID0gbGluZVRleHQuY2hhckNvZGVBdCgwKTtcblx0bGV0IHByZXZDaGFyQ29kZUNsYXNzID0gY2xhc3NpZmllci5nZXQocHJldkNoYXJDb2RlKTtcblx0bGV0IHZpc2libGVDb2x1bW4gPSBjb21wdXRlQ2hhcldpZHRoKHByZXZDaGFyQ29kZSwgMCwgdGFiU2l6ZSwgY29sdW1uc0ZvckZ1bGxXaWR0aENoYXIpO1xuXG5cdGxldCBzdGFydE9mZnNldCA9IDE7XG5cdGlmIChzdHJpbmdzLmlzSGlnaFN1cnJvZ2F0ZShwcmV2Q2hhckNvZGUpKSB7XG5cdFx0Ly8gQSBzdXJyb2dhdGUgcGFpciBtdXN0IGFsd2F5cyBiZSBjb25zaWRlcmVkIGFzIGEgc2luZ2xlIHVuaXQsIHNvIGl0IGlzIG5ldmVyIHRvIGJlIGJyb2tlblxuXHRcdHZpc2libGVDb2x1bW4gKz0gMTtcblx0XHRwcmV2Q2hhckNvZGUgPSBsaW5lVGV4dC5jaGFyQ29kZUF0KDEpO1xuXHRcdHByZXZDaGFyQ29kZUNsYXNzID0gY2xhc3NpZmllci5nZXQocHJldkNoYXJDb2RlKTtcblx0XHRzdGFydE9mZnNldCsrO1xuXHR9XG5cblx0Zm9yIChsZXQgaSA9IHN0YXJ0T2Zmc2V0OyBpIDwgbGVuOyBpKyspIHtcblx0XHRjb25zdCBjaGFyU3RhcnRPZmZzZXQgPSBpO1xuXHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZVRleHQuY2hhckNvZGVBdChpKTtcblx0XHRsZXQgY2hhckNvZGVDbGFzczogQ2hhcmFjdGVyQ2xhc3M7XG5cdFx0bGV0IGNoYXJXaWR0aDogbnVtYmVyO1xuXG5cdFx0aWYgKHN0cmluZ3MuaXNIaWdoU3Vycm9nYXRlKGNoYXJDb2RlKSkge1xuXHRcdFx0Ly8gQSBzdXJyb2dhdGUgcGFpciBtdXN0IGFsd2F5cyBiZSBjb25zaWRlcmVkIGFzIGEgc2luZ2xlIHVuaXQsIHNvIGl0IGlzIG5ldmVyIHRvIGJlIGJyb2tlblxuXHRcdFx0aSsrO1xuXHRcdFx0Y2hhckNvZGVDbGFzcyA9IENoYXJhY3RlckNsYXNzLk5PTkU7XG5cdFx0XHRjaGFyV2lkdGggPSAyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjaGFyQ29kZUNsYXNzID0gY2xhc3NpZmllci5nZXQoY2hhckNvZGUpO1xuXHRcdFx0Y2hhcldpZHRoID0gY29tcHV0ZUNoYXJXaWR0aChjaGFyQ29kZSwgdmlzaWJsZUNvbHVtbiwgdGFiU2l6ZSwgY29sdW1uc0ZvckZ1bGxXaWR0aENoYXIpO1xuXHRcdH1cblxuXHRcdGlmIChjYW5CcmVhayhwcmV2Q2hhckNvZGUsIHByZXZDaGFyQ29kZUNsYXNzLCBjaGFyQ29kZSwgY2hhckNvZGVDbGFzcywgaXNLZWVwQWxsKSkge1xuXHRcdFx0YnJlYWtPZmZzZXQgPSBjaGFyU3RhcnRPZmZzZXQ7XG5cdFx0XHRicmVha09mZnNldFZpc2libGVDb2x1bW4gPSB2aXNpYmxlQ29sdW1uO1xuXHRcdH1cblxuXHRcdHZpc2libGVDb2x1bW4gKz0gY2hhcldpZHRoO1xuXG5cdFx0Ly8gY2hlY2sgaWYgYWRkaW5nIGNoYXJhY3RlciBhdCBgaWAgd2lsbCBnbyBvdmVyIHRoZSBicmVha2luZyBjb2x1bW5cblx0XHRpZiAodmlzaWJsZUNvbHVtbiA+IGJyZWFraW5nQ29sdW1uKSB7XG5cdFx0XHQvLyBXZSBuZWVkIHRvIGJyZWFrIGF0IGxlYXN0IGJlZm9yZSBjaGFyYWN0ZXIgYXQgYGlgOlxuXG5cdFx0XHRpZiAoYnJlYWtPZmZzZXQgPT09IDAgfHwgdmlzaWJsZUNvbHVtbiAtIGJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiA+IHdyYXBwZWRMaW5lQnJlYWtDb2x1bW4pIHtcblx0XHRcdFx0Ly8gQ2Fubm90IGJyZWFrIGF0IGBicmVha09mZnNldGAsIG11c3QgYnJlYWsgYXQgYGlgXG5cdFx0XHRcdGJyZWFrT2Zmc2V0ID0gY2hhclN0YXJ0T2Zmc2V0O1xuXHRcdFx0XHRicmVha09mZnNldFZpc2libGVDb2x1bW4gPSB2aXNpYmxlQ29sdW1uIC0gY2hhcldpZHRoO1xuXHRcdFx0fVxuXG5cdFx0XHRicmVha2luZ09mZnNldHNbYnJlYWtpbmdPZmZzZXRzQ291bnRdID0gYnJlYWtPZmZzZXQ7XG5cdFx0XHRicmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uW2JyZWFraW5nT2Zmc2V0c0NvdW50XSA9IGJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbjtcblx0XHRcdGJyZWFraW5nT2Zmc2V0c0NvdW50Kys7XG5cdFx0XHRicmVha2luZ0NvbHVtbiA9IGJyZWFrT2Zmc2V0VmlzaWJsZUNvbHVtbiArIHdyYXBwZWRMaW5lQnJlYWtDb2x1bW47XG5cdFx0XHRicmVha09mZnNldCA9IDA7XG5cdFx0fVxuXG5cdFx0cHJldkNoYXJDb2RlID0gY2hhckNvZGU7XG5cdFx0cHJldkNoYXJDb2RlQ2xhc3MgPSBjaGFyQ29kZUNsYXNzO1xuXHR9XG5cblx0aWYgKGJyZWFraW5nT2Zmc2V0c0NvdW50ID09PSAwICYmICghaW5qZWN0ZWRUZXh0cyB8fCBpbmplY3RlZFRleHRzLmxlbmd0aCA9PT0gMCkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8vIEFkZCBsYXN0IHNlZ21lbnRcblx0YnJlYWtpbmdPZmZzZXRzW2JyZWFraW5nT2Zmc2V0c0NvdW50XSA9IGxlbjtcblx0YnJlYWtpbmdPZmZzZXRzVmlzaWJsZUNvbHVtblticmVha2luZ09mZnNldHNDb3VudF0gPSB2aXNpYmxlQ29sdW1uO1xuXG5cdHJldHVybiBuZXcgTW9kZWxMaW5lUHJvamVjdGlvbkRhdGEoaW5qZWN0aW9uT2Zmc2V0cywgaW5qZWN0aW9uT3B0aW9ucywgYnJlYWtpbmdPZmZzZXRzLCBicmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uLCB3cmFwcGVkVGV4dEluZGVudExlbmd0aCk7XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVDaGFyV2lkdGgoY2hhckNvZGU6IG51bWJlciwgdmlzaWJsZUNvbHVtbjogbnVtYmVyLCB0YWJTaXplOiBudW1iZXIsIGNvbHVtbnNGb3JGdWxsV2lkdGhDaGFyOiBudW1iZXIpOiBudW1iZXIge1xuXHRpZiAoY2hhckNvZGUgPT09IENoYXJDb2RlLlRhYikge1xuXHRcdHJldHVybiAodGFiU2l6ZSAtICh2aXNpYmxlQ29sdW1uICUgdGFiU2l6ZSkpO1xuXHR9XG5cdGlmIChzdHJpbmdzLmlzRnVsbFdpZHRoQ2hhcmFjdGVyKGNoYXJDb2RlKSkge1xuXHRcdHJldHVybiBjb2x1bW5zRm9yRnVsbFdpZHRoQ2hhcjtcblx0fVxuXHRpZiAoY2hhckNvZGUgPCAzMikge1xuXHRcdC8vIHdoZW4gdXNpbmcgYGVkaXRvci5yZW5kZXJDb250cm9sQ2hhcmFjdGVyc2AsIHRoZSBzdWJzdGl0dXRpb25zIGFyZSBvZnRlbiB3aWRlXG5cdFx0cmV0dXJuIGNvbHVtbnNGb3JGdWxsV2lkdGhDaGFyO1xuXHR9XG5cdHJldHVybiAxO1xufVxuXG5mdW5jdGlvbiB0YWJDaGFyYWN0ZXJXaWR0aCh2aXNpYmxlQ29sdW1uOiBudW1iZXIsIHRhYlNpemU6IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiAodGFiU2l6ZSAtICh2aXNpYmxlQ29sdW1uICUgdGFiU2l6ZSkpO1xufVxuXG4vKipcbiAqIEtpbnNva3UgU2hvcmkgOiBEb24ndCBicmVhayBhZnRlciBhIGxlYWRpbmcgY2hhcmFjdGVyLCBsaWtlIGFuIG9wZW4gYnJhY2tldFxuICogS2luc29rdSBTaG9yaSA6IERvbid0IGJyZWFrIGJlZm9yZSBhIHRyYWlsaW5nIGNoYXJhY3RlciwgbGlrZSBhIHBlcmlvZFxuICovXG5mdW5jdGlvbiBjYW5CcmVhayhwcmV2Q2hhckNvZGU6IG51bWJlciwgcHJldkNoYXJDb2RlQ2xhc3M6IENoYXJhY3RlckNsYXNzLCBjaGFyQ29kZTogbnVtYmVyLCBjaGFyQ29kZUNsYXNzOiBDaGFyYWN0ZXJDbGFzcywgaXNLZWVwQWxsOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdHJldHVybiAoXG5cdFx0Y2hhckNvZGUgIT09IENoYXJDb2RlLlNwYWNlXG5cdFx0JiYgKFxuXHRcdFx0KHByZXZDaGFyQ29kZUNsYXNzID09PSBDaGFyYWN0ZXJDbGFzcy5CUkVBS19BRlRFUiAmJiBjaGFyQ29kZUNsYXNzICE9PSBDaGFyYWN0ZXJDbGFzcy5CUkVBS19BRlRFUikgLy8gYnJlYWsgYXQgdGhlIGVuZCBvZiBtdWx0aXBsZSBCUkVBS19BRlRFUlxuXHRcdFx0fHwgKHByZXZDaGFyQ29kZUNsYXNzICE9PSBDaGFyYWN0ZXJDbGFzcy5CUkVBS19CRUZPUkUgJiYgY2hhckNvZGVDbGFzcyA9PT0gQ2hhcmFjdGVyQ2xhc3MuQlJFQUtfQkVGT1JFKSAvLyBicmVhayBhdCB0aGUgc3RhcnQgb2YgbXVsdGlwbGUgQlJFQUtfQkVGT1JFXG5cdFx0XHR8fCAoIWlzS2VlcEFsbCAmJiBwcmV2Q2hhckNvZGVDbGFzcyA9PT0gQ2hhcmFjdGVyQ2xhc3MuQlJFQUtfSURFT0dSQVBISUMgJiYgY2hhckNvZGVDbGFzcyAhPT0gQ2hhcmFjdGVyQ2xhc3MuQlJFQUtfQUZURVIpXG5cdFx0XHR8fCAoIWlzS2VlcEFsbCAmJiBjaGFyQ29kZUNsYXNzID09PSBDaGFyYWN0ZXJDbGFzcy5CUkVBS19JREVPR1JBUEhJQyAmJiBwcmV2Q2hhckNvZGVDbGFzcyAhPT0gQ2hhcmFjdGVyQ2xhc3MuQlJFQUtfQkVGT1JFKVxuXHRcdClcblx0KTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoKGxpbmVUZXh0OiBzdHJpbmcsIHRhYlNpemU6IG51bWJlciwgZmlyc3RMaW5lQnJlYWtDb2x1bW46IG51bWJlciwgY29sdW1uc0ZvckZ1bGxXaWR0aENoYXI6IG51bWJlciwgd3JhcHBpbmdJbmRlbnQ6IFdyYXBwaW5nSW5kZW50KTogbnVtYmVyIHtcblx0bGV0IHdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoID0gMDtcblx0aWYgKHdyYXBwaW5nSW5kZW50ICE9PSBXcmFwcGluZ0luZGVudC5Ob25lKSB7XG5cdFx0Y29uc3QgZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPSBzdHJpbmdzLmZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4KGxpbmVUZXh0KTtcblx0XHRpZiAoZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggIT09IC0xKSB7XG5cdFx0XHQvLyBUcmFjayBleGlzdGluZyBpbmRlbnRcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmaXJzdE5vbldoaXRlc3BhY2VJbmRleDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNoYXJXaWR0aCA9IChsaW5lVGV4dC5jaGFyQ29kZUF0KGkpID09PSBDaGFyQ29kZS5UYWIgPyB0YWJDaGFyYWN0ZXJXaWR0aCh3cmFwcGVkVGV4dEluZGVudExlbmd0aCwgdGFiU2l6ZSkgOiAxKTtcblx0XHRcdFx0d3JhcHBlZFRleHRJbmRlbnRMZW5ndGggKz0gY2hhcldpZHRoO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbmNyZWFzZSBpbmRlbnQgb2YgY29udGludWF0aW9uIGxpbmVzLCBpZiBkZXNpcmVkXG5cdFx0XHRjb25zdCBudW1iZXJPZkFkZGl0aW9uYWxUYWJzID0gKHdyYXBwaW5nSW5kZW50ID09PSBXcmFwcGluZ0luZGVudC5EZWVwSW5kZW50ID8gMiA6IHdyYXBwaW5nSW5kZW50ID09PSBXcmFwcGluZ0luZGVudC5JbmRlbnQgPyAxIDogMCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG51bWJlck9mQWRkaXRpb25hbFRhYnM7IGkrKykge1xuXHRcdFx0XHRjb25zdCBjaGFyV2lkdGggPSB0YWJDaGFyYWN0ZXJXaWR0aCh3cmFwcGVkVGV4dEluZGVudExlbmd0aCwgdGFiU2l6ZSk7XG5cdFx0XHRcdHdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoICs9IGNoYXJXaWR0aDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRm9yY2Ugc3RpY2tpbmcgdG8gYmVnaW5uaW5nIG9mIGxpbmUgaWYgbm8gY2hhcmFjdGVyIHdvdWxkIGZpdCBleGNlcHQgZm9yIHRoZSBpbmRlbnRhdGlvblxuXHRcdFx0aWYgKHdyYXBwZWRUZXh0SW5kZW50TGVuZ3RoICsgY29sdW1uc0ZvckZ1bGxXaWR0aENoYXIgPiBmaXJzdExpbmVCcmVha0NvbHVtbikge1xuXHRcdFx0XHR3cmFwcGVkVGV4dEluZGVudExlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiB3cmFwcGVkVGV4dEluZGVudExlbmd0aDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFlBQVksYUFBYTtBQUN6QixTQUFTLGdCQUF3QyxvQkFBb0I7QUFDckUsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyx3QkFBd0I7QUFFakMsU0FBMEQsK0JBQStCO0FBRWxGLE1BQU0sbUNBQXlFO0FBQUEsRUFDckYsT0FBYyxPQUFPLFNBQXFFO0FBQ3pGLFdBQU8sSUFBSTtBQUFBLE1BQ1YsUUFBUSxJQUFJLGFBQWEsNkJBQTZCO0FBQUEsTUFDdEQsUUFBUSxJQUFJLGFBQWEsNEJBQTRCO0FBQUEsSUFDdEQ7QUFBQSxFQUNEO0FBQUEsRUFJQSxZQUFZLGtCQUEwQixpQkFBeUI7QUFDOUQsU0FBSyxhQUFhLElBQUksNEJBQTRCLGtCQUFrQixlQUFlO0FBQUEsRUFDcEY7QUFBQSxFQUVPLHlCQUF5QixVQUFvQixTQUFpQixnQkFBd0IsZ0JBQWdDLFdBQXNEO0FBQ2xMLFVBQU0sV0FBcUIsQ0FBQztBQUM1QixVQUFNLGdCQUErQyxDQUFDO0FBQ3RELFVBQU0sdUJBQTJELENBQUM7QUFDbEUsV0FBTztBQUFBLE1BQ04sWUFBWSxDQUFDLFVBQWtCLGNBQXlDLDBCQUEwRDtBQUNqSSxpQkFBUyxLQUFLLFFB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
