import * as arrays from "../../../base/common/arrays.js";
import { Position } from "../core/position.js";
import { Range } from "../core/range.js";
import { PositionAffinity } from "../model.js";
import { IndentGuide, IndentGuideHorizontalLine } from "../textModelGuides.js";
import { ModelDecorationOptions } from "../model/textModel.js";
import { LineInjectedText } from "../textModelEvents.js";
import * as viewEvents from "../viewEvents.js";
import { createModelLineProjection } from "./modelLineProjection.js";
import { ConstantTimePrefixSumComputer } from "../model/prefixSumComputer.js";
import { ViewLineData } from "../viewModel.js";
class ViewModelLinesFromProjectedModel {
  constructor(editorId, model, domLineBreaksComputerFactory, monospaceLineBreaksComputerFactory, fontInfo, tabSize, wrappingStrategy, wrappingColumn, wrappingIndent, wordBreak) {
    this._editorId = editorId;
    this.model = model;
    this._validModelVersionId = -1;
    this._domLineBreaksComputerFactory = domLineBreaksComputerFactory;
    this._monospaceLineBreaksComputerFactory = monospaceLineBreaksComputerFactory;
    this.fontInfo = fontInfo;
    this.tabSize = tabSize;
    this.wrappingStrategy = wrappingStrategy;
    this.wrappingColumn = wrappingColumn;
    this.wrappingIndent = wrappingIndent;
    this.wordBreak = wordBreak;
    this._constructLines(
      /*resetHiddenAreas*/
      true,
      null
    );
  }
  dispose() {
    this.hiddenAreasDecorationIds = this.model.deltaDecorations(this.hiddenAreasDecorationIds, []);
  }
  createCoordinatesConverter() {
    return new CoordinatesConverter(this);
  }
  _constructLines(resetHiddenAreas, previousLineBreaks) {
    this.modelLineProjections = [];
    if (resetHiddenAreas) {
      this.hiddenAreasDecorationIds = this.model.deltaDecorations(this.hiddenAreasDecorationIds, []);
    }
    const linesContent = this.model.getLinesContent();
    const injectedTextDecorations = this.model.getInjectedTextDecorations(this._editorId);
    const lineCount = linesContent.length;
    const lineBreaksComputer = this.createLineBreaksComputer();
    const injectedTextQueue = new arrays.ArrayQueue(LineInjectedText.fromDecorations(injectedTextDecorations));
    for (let i = 0; i < lineCount; i++) {
      const lineInjectedText = injectedTextQueue.takeWhile((t) => t.lineNumber === i + 1);
      lineBreaksComputer.addRequest(linesContent[i], lineInjectedText, previousLineBreaks ? previousLineBreaks[i] : null);
    }
    const linesBreaks = lineBreaksComputer.finalize();
    const values = [];
    const hiddenAreas = this.hiddenAreasDecorationIds.map((areaId) => this.model.getDecorationRange(areaId)).sort(Range.compareRangesUsingStarts);
    let hiddenAreaStart = 1, hiddenAreaEnd = 0;
    let hiddenAreaIdx = -1;
    let nextLineNumberToUpdateHiddenArea = hiddenAreaIdx + 1 < hiddenAreas.length ? hiddenAreaEnd + 1 : lineCount + 2;
    for (let i = 0; i < lineCount; i++) {
      const lineNumber = i + 1;
      if (lineNumber === nextLineNumberToUpdateHiddenArea) {
        hiddenAreaIdx++;
        hiddenAreaStart = hiddenAreas[hiddenAreaIdx].startLineNumber;
        hiddenAreaEnd = hiddenAreas[hiddenAreaIdx].endLineNumber;
        nextLineNumberToUpdateHiddenArea = hiddenAreaIdx + 1 < hiddenAreas.length ? hiddenAreaEnd + 1 : lineCount + 2;
      }
      const isInHiddenArea = lineNumber >= hiddenAreaStart && lineNumber <= hiddenAreaEnd;
      const line = createModelLineProjection(linesBreaks[i], !isInHiddenArea);
      values[i] = line.getViewLineCount();
      this.modelLineProjections[i] = line;
    }
    this._validModelVersionId = this.model.getVersionId();
    this.projectedModelLineLineCounts = new ConstantTimePrefixSumComputer(values);
  }
  getHiddenAreas() {
    return this.hiddenAreasDecorationIds.map(
      (decId) => this.model.getDecorationRange(decId)
    );
  }
  setHiddenAreas(_ranges) {
    const validatedRanges = _ranges.map((r) => this.model.validateRange(r));
    const newRanges = normalizeLineRanges(validatedRanges);
    const oldRanges = this.hiddenAreasDecorationIds.map((areaId) => this.model.getDecorationRange(areaId)).sort(Range.compareRangesUsingStarts);
    if (newRanges.length === oldRanges.length) {
      let hasDifference = false;
      for (let i = 0; i < newRanges.length; i++) {
        if (!newRanges[i].equalsRange(oldRanges[i])) {
          hasDifference = true;
          break;
        }
      }
      if (!hasDifference) {
        return false;
      }
    }
    const newDecorations = newRanges.map(
      (r) => ({
        range: r,
        options: ModelDecorationOptions.EMPTY
      })
    );
    this.hiddenAreasDecorationIds = this.model.deltaDecorations(this.hiddenAreasDecorationIds, newDecorations);
    const hiddenAreas = newRanges;
    let hiddenAreaStart = 1, hiddenAreaEnd = 0;
    let hiddenAreaIdx = -1;
    let nextLineNumberToUpdateHiddenArea = hiddenAreaIdx + 1 < hiddenAreas.length ? hiddenAreaEnd + 1 : this.modelLineProjections.length + 2;
    let hasVisibleLine = false;
    for (let i = 0; i < this.modelLineProjections.length; i++) {
      const lineNumber = i + 1;
      if (lineNumber === nextLineNumberToUpdateHiddenArea) {
        hiddenAreaIdx++;
        hiddenAreaStart = hiddenAreas[hiddenAreaIdx].startLineNumber;
        hiddenAreaEnd = hiddenAreas[hiddenAreaIdx].endLineNumber;
        nextLineNumberToUpdateHiddenArea = hiddenAreaIdx + 1 < hiddenAreas.length ? hiddenAreaEnd + 1 : this.modelLineProjections.length + 2;
      }
      let lineChanged = false;
      if (lineNumber >= hiddenAreaStart && lineNumber <= hiddenAreaEnd) {
        if (this.modelLineProjections[i].isVisible()) {
          this.modelLineProjections[i] = this.modelLineProjections[i].setVisible(false);
          lineChanged = true;
        }
      } else {
        hasVisibleLine = true;
        if (!this.modelLineProjections[i].isVisible()) {
          this.modelLineProjections[i] = this.modelLineProjections[i].setVisible(true);
          lineChanged = true;
        }
      }
      if (lineChanged) {
        const newOutputLineCount = this.modelLineProjections[i].getViewLineCount();
        this.projectedModelLineLineCounts.setValue(i, newOutputLineCount);
      }
    }
    if (!hasVisibleLine) {
      this.setHiddenAreas([]);
    }
    return true;
  }
  modelPositionIsVisible(modelLineNumber, _modelColumn) {
    if (modelLineNumber < 1 || modelLineNumber > this.modelLineProjections.length) {
      return false;
    }
    return this.modelLineProjections[modelLineNumber - 1].isVisible();
  }
  getModelLineViewLineCount(modelLineNumber) {
    if (modelLineNumber < 1 || modelLineNumber > this.modelLineProjections.length) {
      return 1;
    }
    return this.modelLineProjections[modelLineNumber - 1].getViewLineCount();
  }
  setTabSize(newTabSize) {
    if (this.tabSize === newTabSize) {
      return false;
    }
    this.tabSize = newTabSize;
    this._constructLines(
      /*resetHiddenAreas*/
      false,
      null
    );
    return true;
  }
  setWrappingSettings(fontInfo, wrappingStrategy, wrappingColumn, wrappingIndent, wordBreak) {
    const equalFontInfo = this.fontInfo.equals(fontInfo);
    const equalWrappingStrategy = this.wrappingStrategy === wrappingStrategy;
    const equalWrappingColumn = this.wrappingColumn === wrappingColumn;
    const equalWrappingIndent = this.wrappingIndent === wrappingIndent;
    const equalWordBreak = this.wordBreak === wordBreak;
    if (equalFontInfo && equalWrappingStrategy && equalWrappingColumn && equalWrappingIndent && equalWordBreak) {
      return false;
    }
    const onlyWrappingColumnChanged = equalFontInfo && equalWrappingStrategy && !equalWrappingColumn && equalWrappingIndent && equalWordBreak;
    this.fontInfo = fontInfo;
    this.wrappingStrategy = wrappingStrategy;
    this.wrappingColumn = wrappingColumn;
    this.wrappingIndent = wrappingIndent;
    this.wordBreak = wordBreak;
    let previousLineBreaks = null;
    if (onlyWrappingColumnChanged) {
      previousLineBreaks = [];
      for (let i = 0, len = this.modelLineProjections.length; i < len; i++) {
        previousLineBreaks[i] = this.modelLineProjections[i].getProjectionData();
      }
    }
    this._constructLines(
      /*resetHiddenAreas*/
      false,
      previousLineBreaks
    );
    return true;
  }
  createLineBreaksComputer() {
    const lineBreaksComputerFactory = this.wrappingStrategy === "advanced" ? this._domLineBreaksComputerFactory : this._monospaceLineBreaksComputerFactory;
    return lineBreaksComputerFactory.createLineBreaksComputer(this.fontInfo, this.tabSize, this.wrappingColumn, this.wrappingIndent, this.wordBreak);
  }
  onModelFlushed() {
    this._constructLines(
      /*resetHiddenAreas*/
      true,
      null
    );
  }
  onModelLinesDeleted(versionId, fromLineNumber, toLineNumber) {
    if (!versionId || versionId <= this._validModelVersionId) {
      return null;
    }
    const outputFromLineNumber = fromLineNumber === 1 ? 1 : this.projectedModelLineLineCounts.getPrefixSum(fromLineNumber - 1) + 1;
    const outputToLineNumber = this.projectedModelLineLineCounts.getPrefixSum(toLineNumber);
    this.modelLineProjections.splice(fromLineNumber - 1, toLineNumber - fromLineNumber + 1);
    this.projectedModelLineLineCounts.removeValues(fromLineNumber - 1, toLineNumber - fromLineNumber + 1);
    return new viewEvents.ViewLinesDeletedEvent(outputFromLineNumber, outputToLineNumber);
  }
  onModelLinesInserted(versionId, fromLineNumber, _toLineNumber, lineBreaks) {
    if (!versionId || versionId <= this._validModelVersionId) {
      return null;
    }
    const isInHiddenArea = fromLineNumber > 2 && !this.modelLineProjections[fromLineNumber - 2].isVisible();
    const outputFromLineNumber = fromLineNumber === 1 ? 1 : this.projectedModelLineLineCounts.getPrefixSum(fromLineNumber - 1) + 1;
    let totalOutputLineCount = 0;
    const insertLines = [];
    const insertPrefixSumValues = [];
    for (let i = 0, len = lineBreaks.length; i < len; i++) {
      const line = createModelLineProjection(lineBreaks[i], !isInHiddenArea);
      insertLines.push(line);
      const outputLineCount = line.getViewLineCount();
      totalOutputLineCount += outputLineCount;
      insertPrefixSumValues[i] = outputLineCount;
    }
    this.modelLineProjections = this.modelLineProjections.slice(0, fromLineNumber - 1).concat(insertLines).concat(this.modelLineProjections.slice(fromLineNumber - 1));
    this.projectedModelLineLineCounts.insertValues(fromLineNumber - 1, insertPrefixSumValues);
    return new viewEvents.ViewLinesInsertedEvent(outputFromLineNumber, outputFromLineNumber + totalOutputLineCount - 1);
  }
  onModelLineChanged(versionId, lineNumber, lineBreakData) {
    if (versionId !== null && versionId <= this._validModelVersionId) {
      return [false, null, null, null];
    }
    const lineIndex = lineNumber - 1;
    const oldOutputLineCount = this.modelLineProjections[lineIndex].getViewLineCount();
    const isVisible = this.modelLineProjections[lineIndex].isVisible();
    const line = createModelLineProjection(lineBreakData, isVisible);
    this.modelLineProjections[lineIndex] = line;
    const newOutputLineCount = this.modelLineProjections[lineIndex].getViewLineCount();
    let lineMappingChanged = false;
    let changeFrom = 0;
    let changeTo = -1;
    let insertFrom = 0;
    let insertTo = -1;
    let deleteFrom = 0;
    let deleteTo = -1;
    if (oldOutputLineCount > newOutputLineCount) {
      changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
      changeTo = changeFrom + newOutputLineCount - 1;
      deleteFrom = changeTo + 1;
      deleteTo = deleteFrom + (oldOutputLineCount - newOutputLineCount) - 1;
      lineMappingChanged = true;
    } else if (oldOutputLineCount < newOutputLineCount) {
      changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
      changeTo = changeFrom + oldOutputLineCount - 1;
      insertFrom = changeTo + 1;
      insertTo = insertFrom + (newOutputLineCount - oldOutputLineCount) - 1;
      lineMappingChanged = true;
    } else {
      changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
      changeTo = changeFrom + newOutputLineCount - 1;
    }
    this.projectedModelLineLineCounts.setValue(lineIndex, newOutputLineCount);
    const viewLinesChangedEvent = changeFrom <= changeTo ? new viewEvents.ViewLinesChangedEvent(changeFrom, changeTo - changeFrom + 1) : null;
    const viewLinesInsertedEvent = insertFrom <= insertTo ? new viewEvents.ViewLinesInsertedEvent(insertFrom, insertTo) : null;
    const viewLinesDeletedEvent = deleteFrom <= deleteTo ? new viewEvents.ViewLinesDeletedEvent(deleteFrom, deleteTo) : null;
    return [lineMappingChanged, viewLinesChangedEvent, viewLinesInsertedEvent, viewLinesDeletedEvent];
  }
  acceptVersionId(versionId) {
    this._validModelVersionId = versionId;
    if (this.modelLineProjections.length === 1 && !this.modelLineProjections[0].isVisible()) {
      this.setHiddenAreas([]);
    }
  }
  getViewLineCount() {
    return this.projectedModelLineLineCounts.getTotalSum();
  }
  _toValidViewLineNumber(viewLineNumber) {
    if (viewLineNumber < 1) {
      return 1;
    }
    const viewLineCount = this.getViewLineCount();
    if (viewLineNumber > viewLineCount) {
      return viewLineCount;
    }
    return viewLineNumber | 0;
  }
  getActiveIndentGuide(viewLineNumber, minLineNumber, maxLineNumber) {
    viewLineNumber = this._toValidViewLineNumber(viewLineNumber);
    minLineNumber = this._toValidViewLineNumber(minLineNumber);
    maxLineNumber = this._toValidViewLineNumber(maxLineNumber);
    const modelPosition = this.convertViewPositionToModelPosition(viewLineNumber, this.getViewLineMinColumn(viewLineNumber));
    const modelMinPosition = this.convertViewPositionToModelPosition(minLineNumber, this.getViewLineMinColumn(minLineNumber));
    const modelMaxPosition = this.convertViewPositionToModelPosition(maxLineNumber, this.getViewLineMinColumn(maxLineNumber));
    const result = this.model.guides.getActiveIndentGuide(modelPosition.lineNumber, modelMinPosition.lineNumber, modelMaxPosition.lineNumber);
    const viewStartPosition = this.convertModelPositionToViewPosition(result.startLineNumber, 1);
    const viewEndPosition = this.convertModelPositionToViewPosition(result.endLineNumber, this.model.getLineMaxColumn(result.endLineNumber));
    return {
      startLineNumber: viewStartPosition.lineNumber,
      endLineNumber: viewEndPosition.lineNumber,
      indent: result.indent
    };
  }
  // #region ViewLineInfo
  getViewLineInfo(viewLineNumber) {
    viewLineNumber = this._toValidViewLineNumber(viewLineNumber);
    const r = this.projectedModelLineLineCounts.getIndexOf(viewLineNumber - 1);
    const lineIndex = r.index;
    const remainder = r.remainder;
    return new ViewLineInfo(lineIndex + 1, remainder);
  }
  getMinColumnOfViewLine(viewLineInfo) {
    return this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewLineMinColumn(
      this.model,
      viewLineInfo.modelLineNumber,
      viewLineInfo.modelLineWrappedLineIdx
    );
  }
  getMaxColumnOfViewLine(viewLineInfo) {
    return this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewLineMaxColumn(
      this.model,
      viewLineInfo.modelLineNumber,
      viewLineInfo.modelLineWrappedLineIdx
    );
  }
  getModelStartPositionOfViewLine(viewLineInfo) {
    const line = this.modelLineProjections[viewLineInfo.modelLineNumber - 1];
    const minViewColumn = line.getViewLineMinColumn(
      this.model,
      viewLineInfo.modelLineNumber,
      viewLineInfo.modelLineWrappedLineIdx
    );
    const column = line.getModelColumnOfViewPosition(
      viewLineInfo.modelLineWrappedLineIdx,
      minViewColumn
    );
    return new Position(viewLineInfo.modelLineNumber, column);
  }
  getModelEndPositionOfViewLine(viewLineInfo) {
    const line = this.modelLineProjections[viewLineInfo.modelLineNumber - 1];
    const maxViewColumn = line.getViewLineMaxColumn(
      this.model,
      viewLineInfo.modelLineNumber,
      viewLineInfo.modelLineWrappedLineIdx
    );
    const column = line.getModelColumnOfViewPosition(
      viewLineInfo.modelLineWrappedLineIdx,
      maxViewColumn
    );
    return new Position(viewLineInfo.modelLineNumber, column);
  }
  getViewLineInfosGroupedByModelRanges(viewStartLineNumber, viewEndLineNumber) {
    const startViewLine = this.getViewLineInfo(viewStartLineNumber);
    const endViewLine = this.getViewLineInfo(viewEndLineNumber);
    const result = new Array();
    let lastVisibleModelPos = this.getModelStartPositionOfViewLine(startViewLine);
    let viewLines = new Array();
    for (let curModelLine = startViewLine.modelLineNumber; curModelLine <= endViewLine.modelLineNumber; curModelLine++) {
      const line = this.modelLineProjections[curModelLine - 1];
      if (line.isVisible()) {
        const startOffset = curModelLine === startViewLine.modelLineNumber ? startViewLine.modelLineWrappedLineIdx : 0;
        const endOffset = curModelLine === endViewLine.modelLineNumber ? endViewLine.modelLineWrappedLineIdx + 1 : line.getViewLineCount();
        for (let i = startOffset; i < endOffset; i++) {
          viewLines.push(new ViewLineInfo(curModelLine, i));
        }
      }
      if (!line.isVisible() && lastVisibleModelPos) {
        const lastVisibleModelPos2 = new Position(curModelLine - 1, this.model.getLineMaxColumn(curModelLine - 1) + 1);
        const modelRange = Range.fromPositions(lastVisibleModelPos, lastVisibleModelPos2);
        result.push(new ViewLineInfoGroupedByModelRange(modelRange, viewLines));
        viewLines = [];
        lastVisibleModelPos = null;
      } else if (line.isVisible() && !lastVisibleModelPos) {
        lastVisibleModelPos = new Position(curModelLine, 1);
      }
    }
    if (lastVisibleModelPos) {
      const modelRange = Range.fromPositions(lastVisibleModelPos, this.getModelEndPositionOfViewLine(endViewLine));
      result.push(new ViewLineInfoGroupedByModelRange(modelRange, viewLines));
    }
    return result;
  }
  // #endregion
  getViewLinesBracketGuides(viewStartLineNumber, viewEndLineNumber, activeViewPosition, options) {
    const modelActivePosition = activeViewPosition ? this.convertViewPositionToModelPosition(activeViewPosition.lineNumber, activeViewPosition.column) : null;
    const resultPerViewLine = [];
    for (const group of this.getViewLineInfosGroupedByModelRanges(viewStartLineNumber, viewEndLineNumber)) {
      const modelRangeStartLineNumber = group.modelRange.startLineNumber;
      const bracketGuidesPerModelLine = this.model.guides.getLinesBracketGuides(
        modelRangeStartLineNumber,
        group.modelRange.endLineNumber,
        modelActivePosition,
        options
      );
      for (const viewLineInfo of group.viewLines) {
        const bracketGuides = bracketGuidesPerModelLine[viewLineInfo.modelLineNumber - modelRangeStartLineNumber];
        const result = bracketGuides.map((g) => {
          if (g.forWrappedLinesAfterColumn !== -1) {
            const p2 = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.forWrappedLinesAfterColumn);
            if (p2.lineNumber >= viewLineInfo.modelLineWrappedLineIdx) {
              return void 0;
            }
          }
          if (g.forWrappedLinesBeforeOrAtColumn !== -1) {
            const p2 = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.forWrappedLinesBeforeOrAtColumn);
            if (p2.lineNumber < viewLineInfo.modelLineWrappedLineIdx) {
              return void 0;
            }
          }
          if (!g.horizontalLine) {
            return g;
          }
          let column = -1;
          if (g.column !== -1) {
            const p2 = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.column);
            if (p2.lineNumber === viewLineInfo.modelLineWrappedLineIdx) {
              column = p2.column;
            } else if (p2.lineNumber < viewLineInfo.modelLineWrappedLineIdx) {
              column = this.getMinColumnOfViewLine(viewLineInfo);
            } else if (p2.lineNumber > viewLineInfo.modelLineWrappedLineIdx) {
              return void 0;
            }
          }
          const viewPosition = this.convertModelPositionToViewPosition(viewLineInfo.modelLineNumber, g.horizontalLine.endColumn);
          const p = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.horizontalLine.endColumn);
          if (p.lineNumber === viewLineInfo.modelLineWrappedLineIdx) {
            return new IndentGuide(
              g.visibleColumn,
              column,
              g.className,
              new IndentGuideHorizontalLine(
                g.horizontalLine.top,
                viewPosition.column
              ),
              -1,
              -1
            );
          } else if (p.lineNumber < viewLineInfo.modelLineWrappedLineIdx) {
            return void 0;
          } else {
            if (g.visibleColumn !== -1) {
              return void 0;
            }
            return new IndentGuide(
              g.visibleColumn,
              column,
              g.className,
              new IndentGuideHorizontalLine(
                g.horizontalLine.top,
                this.getMaxColumnOfViewLine(viewLineInfo)
              ),
              -1,
              -1
            );
          }
        });
        resultPerViewLine.push(result.filter((r) => !!r));
      }
    }
    return resultPerViewLine;
  }
  getViewLinesIndentGuides(viewStartLineNumber, viewEndLineNumber) {
    viewStartLineNumber = this._toValidViewLineNumber(viewStartLineNumber);
    viewEndLineNumber = this._toValidViewLineNumber(viewEndLineNumber);
    const modelStart = this.convertViewPositionToModelPosition(viewStartLineNumber, this.getViewLineMinColumn(viewStartLineNumber));
    const modelEnd = this.convertViewPositionToModelPosition(viewEndLineNumber, this.getViewLineMaxColumn(viewEndLineNumber));
    let result = [];
    const resultRepeatCount = [];
    const resultRepeatOption = [];
    const modelStartLineIndex = modelStart.lineNumber - 1;
    const modelEndLineIndex = modelEnd.lineNumber - 1;
    let reqStart = null;
    for (let modelLineIndex = modelStartLineIndex; modelLineIndex <= modelEndLineIndex; modelLineIndex++) {
      const line = this.modelLineProjections[modelLineIndex];
      if (line.isVisible()) {
        const viewLineStartIndex = line.getViewLineNumberOfModelPosition(0, modelLineIndex === modelStartLineIndex ? modelStart.column : 1);
        const viewLineEndIndex = line.getViewLineNumberOfModelPosition(0, this.model.getLineMaxColumn(modelLineIndex + 1));
        const count = viewLineEndIndex - viewLineStartIndex + 1;
        let option = 0 /* BlockNone */;
        if (count > 1 && line.getViewLineMinColumn(this.model, modelLineIndex + 1, viewLineEndIndex) === 1) {
          option = viewLineStartIndex === 0 ? 1 /* BlockSubsequent */ : 2 /* BlockAll */;
        }
        resultRepeatCount.push(count);
        resultRepeatOption.push(option);
        if (reqStart === null) {
          reqStart = new Position(modelLineIndex + 1, 0);
        }
      } else {
        if (reqStart !== null) {
          result = result.concat(this.model.guides.getLinesIndentGuides(reqStart.lineNumber, modelLineIndex));
          reqStart = null;
        }
      }
    }
    if (reqStart !== null) {
      result = result.concat(this.model.guides.getLinesIndentGuides(reqStart.lineNumber, modelEnd.lineNumber));
      reqStart = null;
    }
    const viewLineCount = viewEndLineNumber - viewStartLineNumber + 1;
    const viewIndents = new Array(viewLineCount);
    let currIndex = 0;
    for (let i = 0, len = result.length; i < len; i++) {
      let value = result[i];
      const count = Math.min(viewLineCount - currIndex, resultRepeatCount[i]);
      const option = resultRepeatOption[i];
      let blockAtIndex;
      if (option === 2 /* BlockAll */) {
        blockAtIndex = 0;
      } else if (option === 1 /* BlockSubsequent */) {
        blockAtIndex = 1;
      } else {
        blockAtIndex = count;
      }
      for (let j = 0; j < count; j++) {
        if (j === blockAtIndex) {
          value = 0;
        }
        viewIndents[currIndex++] = value;
      }
    }
    return viewIndents;
  }
  getViewLineContent(viewLineNumber) {
    const info = this.getViewLineInfo(viewLineNumber);
    return this.modelLineProjections[info.modelLineNumber - 1].getViewLineContent(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
  }
  getViewLineLength(viewLineNumber) {
    const info = this.getViewLineInfo(viewLineNumber);
    return this.modelLineProjections[info.modelLineNumber - 1].getViewLineLength(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
  }
  getViewLineMinColumn(viewLineNumber) {
    const info = this.getViewLineInfo(viewLineNumber);
    return this.modelLineProjections[info.modelLineNumber - 1].getViewLineMinColumn(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
  }
  getViewLineMaxColumn(viewLineNumber) {
    const info = this.getViewLineInfo(viewLineNumber);
    return this.modelLineProjections[info.modelLineNumber - 1].getViewLineMaxColumn(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
  }
  getViewLineData(viewLineNumber) {
    const info = this.getViewLineInfo(viewLineNumber);
    return this.modelLineProjections[info.modelLineNumber - 1].getViewLineData(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
  }
  getViewLinesData(viewStartLineNumber, viewEndLineNumber, needed) {
    viewStartLineNumber = this._toValidViewLineNumber(viewStartLineNumber);
    viewEndLineNumber = this._toValidViewLineNumber(viewEndLineNumber);
    const start = this.projectedModelLineLineCounts.getIndexOf(viewStartLineNumber - 1);
    let viewLineNumber = viewStartLineNumber;
    const startModelLineIndex = start.index;
    const startRemainder = start.remainder;
    const result = [];
    for (let modelLineIndex = startModelLineIndex, len = this.model.getLineCount(); modelLineIndex < len; modelLineIndex++) {
      const line = this.modelLineProjections[modelLineIndex];
      if (!line.isVisible()) {
        continue;
      }
      const fromViewLineIndex = modelLineIndex === startModelLineIndex ? startRemainder : 0;
      let remainingViewLineCount = line.getViewLineCount() - fromViewLineIndex;
      let lastLine = false;
      if (viewLineNumber + remainingViewLineCount > viewEndLineNumber) {
        lastLine = true;
        remainingViewLineCount = viewEndLineNumber - viewLineNumber + 1;
      }
      line.getViewLinesData(this.model, modelLineIndex + 1, fromViewLineIndex, remainingViewLineCount, viewLineNumber - viewStartLineNumber, needed, result);
      viewLineNumber += remainingViewLineCount;
      if (lastLine) {
        break;
      }
    }
    return result;
  }
  validateViewPosition(viewLineNumber, viewColumn, expectedModelPosition) {
    viewLineNumber = this._toValidViewLineNumber(viewLineNumber);
    const r = this.projectedModelLineLineCounts.getIndexOf(viewLineNumber - 1);
    const lineIndex = r.index;
    const remainder = r.remainder;
    const line = this.modelLineProjections[lineIndex];
    const minColumn = line.getViewLineMinColumn(this.model, lineIndex + 1, remainder);
    const maxColumn = line.getViewLineMaxColumn(this.model, lineIndex + 1, remainder);
    if (viewColumn < minColumn) {
      viewColumn = minColumn;
    }
    if (viewColumn > maxColumn) {
      viewColumn = maxColumn;
    }
    const computedModelColumn = line.getModelColumnOfViewPosition(remainder, viewColumn);
    const computedModelPosition = this.model.validatePosition(new Position(lineIndex + 1, computedModelColumn));
    if (computedModelPosition.equals(expectedModelPosition)) {
      return new Position(viewLineNumber, viewColumn);
    }
    return this.convertModelPositionToViewPosition(expectedModelPosition.lineNumber, expectedModelPosition.column);
  }
  validateViewRange(viewRange, expectedModelRange) {
    const validViewStart = this.validateViewPosition(viewRange.startLineNumber, viewRange.startColumn, expectedModelRange.getStartPosition());
    const validViewEnd = this.validateViewPosition(viewRange.endLineNumber, viewRange.endColumn, expectedModelRange.getEndPosition());
    return new Range(validViewStart.lineNumber, validViewStart.column, validViewEnd.lineNumber, validViewEnd.column);
  }
  convertViewPositionToModelPosition(viewLineNumber, viewColumn) {
    const info = this.getViewLineInfo(viewLineNumber);
    const inputColumn = this.modelLineProjections[info.modelLineNumber - 1].getModelColumnOfViewPosition(info.modelLineWrappedLineIdx, viewColumn);
    return this.model.validatePosition(new Position(info.modelLineNumber, inputColumn));
  }
  convertViewRangeToModelRange(viewRange) {
    const start = this.convertViewPositionToModelPosition(viewRange.startLineNumber, viewRange.startColumn);
    const end = this.convertViewPositionToModelPosition(viewRange.endLineNumber, viewRange.endColumn);
    return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
  }
  convertModelPositionToViewPosition(_modelLineNumber, _modelColumn, affinity = PositionAffinity.None, allowZeroLineNumber = false, belowHiddenRanges = false) {
    const validPosition = this.model.validatePosition(new Position(_modelLineNumber, _modelColumn));
    const inputLineNumber = validPosition.lineNumber;
    const inputColumn = validPosition.column;
    let lineIndex = inputLineNumber - 1, lineIndexChanged = false;
    if (belowHiddenRanges) {
      while (lineIndex < this.modelLineProjections.length && !this.modelLineProjections[lineIndex].isVisible()) {
        lineIndex++;
        lineIndexChanged = true;
      }
    } else {
      while (lineIndex > 0 && !this.modelLineProjections[lineIndex].isVisible()) {
        lineIndex--;
        lineIndexChanged = true;
      }
    }
    if (lineIndex === 0 && !this.modelLineProjections[lineIndex].isVisible()) {
      return new Position(allowZeroLineNumber ? 0 : 1, 1);
    }
    const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
    let r;
    if (lineIndexChanged) {
      if (belowHiddenRanges) {
        r = this.modelLineProjections[lineIndex].getViewPositionOfModelPosition(deltaLineNumber, 1, affinity);
      } else {
        r = this.modelLineProjections[lineIndex].getViewPositionOfModelPosition(deltaLineNumber, this.model.getLineMaxColumn(lineIndex + 1), affinity);
      }
    } else {
      r = this.modelLineProjections[inputLineNumber - 1].getViewPositionOfModelPosition(deltaLineNumber, inputColumn, affinity);
    }
    return r;
  }
  /**
   * @param affinity The affinity in case of an empty range. Has no effect for non-empty ranges.
  */
  convertModelRangeToViewRange(modelRange, affinity = PositionAffinity.Left) {
    if (modelRange.isEmpty()) {
      const start = this.convertModelPositionToViewPosition(modelRange.startLineNumber, modelRange.startColumn, affinity);
      return Range.fromPositions(start);
    } else {
      const start = this.convertModelPositionToViewPosition(modelRange.startLineNumber, modelRange.startColumn, PositionAffinity.Right);
      const end = this.convertModelPositionToViewPosition(modelRange.endLineNumber, modelRange.endColumn, PositionAffinity.Left);
      return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
    }
  }
  getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
    let lineIndex = modelLineNumber - 1;
    if (this.modelLineProjections[lineIndex].isVisible()) {
      const deltaLineNumber2 = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
      return this.modelLineProjections[lineIndex].getViewLineNumberOfModelPosition(deltaLineNumber2, modelColumn);
    }
    while (lineIndex > 0 && !this.modelLineProjections[lineIndex].isVisible()) {
      lineIndex--;
    }
    if (lineIndex === 0 && !this.modelLineProjections[lineIndex].isVisible()) {
      return 1;
    }
    const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
    return this.modelLineProjections[lineIndex].getViewLineNumberOfModelPosition(deltaLineNumber, this.model.getLineMaxColumn(lineIndex + 1));
  }
  getDecorationsInRange(range, ownerId, filterOutValidation, onlyMinimapDecorations, onlyMarginDecorations) {
    const modelStart = this.convertViewPositionToModelPosition(range.startLineNumber, range.startColumn);
    const modelEnd = this.convertViewPositionToModelPosition(range.endLineNumber, range.endColumn);
    if (modelEnd.lineNumber - modelStart.lineNumber <= range.endLineNumber - range.startLineNumber) {
      return this.model.getDecorationsInRange(new Range(modelStart.lineNumber, 1, modelEnd.lineNumber, modelEnd.column), ownerId, filterOutValidation, onlyMinimapDecorations, onlyMarginDecorations);
    }
    let result = [];
    const modelStartLineIndex = modelStart.lineNumber - 1;
    const modelEndLineIndex = modelEnd.lineNumber - 1;
    let reqStart = null;
    for (let modelLineIndex = modelStartLineIndex; modelLineIndex <= modelEndLineIndex; modelLineIndex++) {
      const line = this.modelLineProjections[modelLineIndex];
      if (line.isVisible()) {
        if (reqStart === null) {
          reqStart = new Position(modelLineIndex + 1, modelLineIndex === modelStartLineIndex ? modelStart.column : 1);
        }
      } else {
        if (reqStart !== null) {
          const maxLineColumn = this.model.getLineMaxColumn(modelLineIndex);
          result = result.concat(this.model.getDecorationsInRange(new Range(reqStart.lineNumber, reqStart.column, modelLineIndex, maxLineColumn), ownerId, filterOutValidation, onlyMinimapDecorations));
          reqStart = null;
        }
      }
    }
    if (reqStart !== null) {
      result = result.concat(this.model.getDecorationsInRange(new Range(reqStart.lineNumber, reqStart.column, modelEnd.lineNumber, modelEnd.column), ownerId, filterOutValidation, onlyMinimapDecorations));
      reqStart = null;
    }
    result.sort((a, b) => {
      const res = Range.compareRangesUsingStarts(a.range, b.range);
      if (res === 0) {
        if (a.id < b.id) {
          return -1;
        }
        if (a.id > b.id) {
          return 1;
        }
        return 0;
      }
      return res;
    });
    const finalResult = [];
    let finalResultLen = 0;
    let prevDecId = null;
    for (const dec of result) {
      const decId = dec.id;
      if (prevDecId === decId) {
        continue;
      }
      prevDecId = decId;
      finalResult[finalResultLen++] = dec;
    }
    return finalResult;
  }
  getInjectedTextAt(position) {
    const info = this.getViewLineInfo(position.lineNumber);
    return this.modelLineProjections[info.modelLineNumber - 1].getInjectedTextAt(info.modelLineWrappedLineIdx, position.column);
  }
  normalizePosition(position, affinity) {
    const info = this.getViewLineInfo(position.lineNumber);
    return this.modelLineProjections[info.modelLineNumber - 1].normalizePosition(info.modelLineWrappedLineIdx, position, affinity);
  }
  getLineIndentColumn(lineNumber) {
    const info = this.getViewLineInfo(lineNumber);
    if (info.modelLineWrappedLineIdx === 0) {
      return this.model.getLineIndentColumn(info.modelLineNumber);
    }
    return 0;
  }
}
function normalizeLineRanges(ranges) {
  if (ranges.length === 0) {
    return [];
  }
  const sortedRanges = ranges.slice();
  sortedRanges.sort(Range.compareRangesUsingStarts);
  const result = [];
  let currentRangeStart = sortedRanges[0].startLineNumber;
  let currentRangeEnd = sortedRanges[0].endLineNumber;
  for (let i = 1, len = sortedRanges.length; i < len; i++) {
    const range = sortedRanges[i];
    if (range.startLineNumber > currentRangeEnd + 1) {
      result.push(new Range(currentRangeStart, 1, currentRangeEnd, 1));
      currentRangeStart = range.startLineNumber;
      currentRangeEnd = range.endLineNumber;
    } else if (range.endLineNumber > currentRangeEnd) {
      currentRangeEnd = range.endLineNumber;
    }
  }
  result.push(new Range(currentRangeStart, 1, currentRangeEnd, 1));
  return result;
}
class ViewLineInfo {
  constructor(modelLineNumber, modelLineWrappedLineIdx) {
    this.modelLineNumber = modelLineNumber;
    this.modelLineWrappedLineIdx = modelLineWrappedLineIdx;
  }
  get isWrappedLineContinuation() {
    return this.modelLineWrappedLineIdx > 0;
  }
}
class ViewLineInfoGroupedByModelRange {
  constructor(modelRange, viewLines) {
    this.modelRange = modelRange;
    this.viewLines = viewLines;
  }
}
class CoordinatesConverter {
  constructor(lines) {
    this._lines = lines;
  }
  // View -> Model conversion and related methods
  convertViewPositionToModelPosition(viewPosition) {
    return this._lines.convertViewPositionToModelPosition(viewPosition.lineNumber, viewPosition.column);
  }
  convertViewRangeToModelRange(viewRange) {
    return this._lines.convertViewRangeToModelRange(viewRange);
  }
  validateViewPosition(viewPosition, expectedModelPosition) {
    return this._lines.validateViewPosition(viewPosition.lineNumber, viewPosition.column, expectedModelPosition);
  }
  validateViewRange(viewRange, expectedModelRange) {
    return this._lines.validateViewRange(viewRange, expectedModelRange);
  }
  // Model -> View conversion and related methods
  convertModelPositionToViewPosition(modelPosition, affinity, allowZero, belowHiddenRanges) {
    return this._lines.convertModelPositionToViewPosition(modelPosition.lineNumber, modelPosition.column, affinity, allowZero, belowHiddenRanges);
  }
  convertModelRangeToViewRange(modelRange, affinity) {
    return this._lines.convertModelRangeToViewRange(modelRange, affinity);
  }
  modelPositionIsVisible(modelPosition) {
    return this._lines.modelPositionIsVisible(modelPosition.lineNumber, modelPosition.column);
  }
  getModelLineViewLineCount(modelLineNumber) {
    return this._lines.getModelLineViewLineCount(modelLineNumber);
  }
  getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
    return this._lines.getViewLineNumberOfModelPosition(modelLineNumber, modelColumn);
  }
}
var IndentGuideRepeatOption = /* @__PURE__ */ ((IndentGuideRepeatOption2) => {
  IndentGuideRepeatOption2[IndentGuideRepeatOption2["BlockNone"] = 0] = "BlockNone";
  IndentGuideRepeatOption2[IndentGuideRepeatOption2["BlockSubsequent"] = 1] = "BlockSubsequent";
  IndentGuideRepeatOption2[IndentGuideRepeatOption2["BlockAll"] = 2] = "BlockAll";
  return IndentGuideRepeatOption2;
})(IndentGuideRepeatOption || {});
class ViewModelLinesFromModelAsIs {
  constructor(model) {
    this.model = model;
  }
  dispose() {
  }
  createCoordinatesConverter() {
    return new IdentityCoordinatesConverter(this);
  }
  getHiddenAreas() {
    return [];
  }
  setHiddenAreas(_ranges) {
    return false;
  }
  setTabSize(_newTabSize) {
    return false;
  }
  setWrappingSettings(_fontInfo, _wrappingStrategy, _wrappingColumn, _wrappingIndent) {
    return false;
  }
  createLineBreaksComputer() {
    const result = [];
    return {
      addRequest: (lineText, injectedText, previousLineBreakData) => {
        result.push(null);
      },
      finalize: () => {
        return result;
      }
    };
  }
  onModelFlushed() {
  }
  onModelLinesDeleted(_versionId, fromLineNumber, toLineNumber) {
    return new viewEvents.ViewLinesDeletedEvent(fromLineNumber, toLineNumber);
  }
  onModelLinesInserted(_versionId, fromLineNumber, toLineNumber, lineBreaks) {
    return new viewEvents.ViewLinesInsertedEvent(fromLineNumber, toLineNumber);
  }
  onModelLineChanged(_versionId, lineNumber, lineBreakData) {
    return [false, new viewEvents.ViewLinesChangedEvent(lineNumber, 1), null, null];
  }
  acceptVersionId(_versionId) {
  }
  getViewLineCount() {
    return this.model.getLineCount();
  }
  getActiveIndentGuide(viewLineNumber, _minLineNumber, _maxLineNumber) {
    return {
      startLineNumber: viewLineNumber,
      endLineNumber: viewLineNumber,
      indent: 0
    };
  }
  getViewLinesBracketGuides(startLineNumber, endLineNumber, activePosition) {
    return new Array(endLineNumber - startLineNumber + 1).fill([]);
  }
  getViewLinesIndentGuides(viewStartLineNumber, viewEndLineNumber) {
    const viewLineCount = viewEndLineNumber - viewStartLineNumber + 1;
    const result = new Array(viewLineCount);
    for (let i = 0; i < viewLineCount; i++) {
      result[i] = 0;
    }
    return result;
  }
  getViewLineContent(viewLineNumber) {
    return this.model.getLineContent(viewLineNumber);
  }
  getViewLineLength(viewLineNumber) {
    return this.model.getLineLength(viewLineNumber);
  }
  getViewLineMinColumn(viewLineNumber) {
    return this.model.getLineMinColumn(viewLineNumber);
  }
  getViewLineMaxColumn(viewLineNumber) {
    return this.model.getLineMaxColumn(viewLineNumber);
  }
  getViewLineData(viewLineNumber) {
    const lineTokens = this.model.tokenization.getLineTokens(viewLineNumber);
    const lineContent = lineTokens.getLineContent();
    return new ViewLineData(
      lineContent,
      false,
      1,
      lineContent.length + 1,
      0,
      lineTokens.inflate(),
      null
    );
  }
  getViewLinesData(viewStartLineNumber, viewEndLineNumber, needed) {
    const lineCount = this.model.getLineCount();
    viewStartLineNumber = Math.min(Math.max(1, viewStartLineNumber), lineCount);
    viewEndLineNumber = Math.min(Math.max(1, viewEndLineNumber), lineCount);
    const result = [];
    for (let lineNumber = viewStartLineNumber; lineNumber <= viewEndLineNumber; lineNumber++) {
      const idx = lineNumber - viewStartLineNumber;
      result[idx] = needed[idx] ? this.getViewLineData(lineNumber) : null;
    }
    return result;
  }
  getDecorationsInRange(range, ownerId, filterOutValidation, onlyMinimapDecorations, onlyMarginDecorations) {
    return this.model.getDecorationsInRange(range, ownerId, filterOutValidation, onlyMinimapDecorations, onlyMarginDecorations);
  }
  normalizePosition(position, affinity) {
    return this.model.normalizePosition(position, affinity);
  }
  getLineIndentColumn(lineNumber) {
    return this.model.getLineIndentColumn(lineNumber);
  }
  getInjectedTextAt(position) {
    return null;
  }
}
class IdentityCoordinatesConverter {
  constructor(lines) {
    this._lines = lines;
  }
  _validPosition(pos) {
    return this._lines.model.validatePosition(pos);
  }
  _validRange(range) {
    return this._lines.model.validateRange(range);
  }
  // View -> Model conversion and related methods
  convertViewPositionToModelPosition(viewPosition) {
    return this._validPosition(viewPosition);
  }
  convertViewRangeToModelRange(viewRange) {
    return this._validRange(viewRange);
  }
  validateViewPosition(_viewPosition, expectedModelPosition) {
    return this._validPosition(expectedModelPosition);
  }
  validateViewRange(_viewRange, expectedModelRange) {
    return this._validRange(expectedModelRange);
  }
  // Model -> View conversion and related methods
  convertModelPositionToViewPosition(modelPosition) {
    return this._validPosition(modelPosition);
  }
  convertModelRangeToViewRange(modelRange) {
    return this._validRange(modelRange);
  }
  modelPositionIsVisible(modelPosition) {
    const lineCount = this._lines.model.getLineCount();
    if (modelPosition.lineNumber < 1 || modelPosition.lineNumber > lineCount) {
      return false;
    }
    return true;
  }
  modelRangeIsVisible(modelRange) {
    const lineCount = this._lines.model.getLineCount();
    if (modelRange.startLineNumber < 1 || modelRange.startLineNumber > lineCount) {
      return false;
    }
    if (modelRange.endLineNumber < 1 || modelRange.endLineNumber > lineCount) {
      return false;
    }
    return true;
  }
  getModelLineViewLineCount(modelLineNumber) {
    return 1;
  }
  getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
    return modelLineNumber;
  }
}
export {
  ViewModelLinesFromModelAsIs,
  ViewModelLinesFromProjectedModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3ZpZXdNb2RlbC92aWV3TW9kZWxMaW5lcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGFycmF5cyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgV3JhcHBpbmdJbmRlbnQgfSBmcm9tICcuLi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBGb250SW5mbyB9IGZyb20gJy4uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVjb3JhdGlvbiwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsLCBQb3NpdGlvbkFmZmluaXR5IH0gZnJvbSAnLi4vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUFjdGl2ZUluZGVudEd1aWRlSW5mbywgQnJhY2tldEd1aWRlT3B0aW9ucywgSW5kZW50R3VpZGUsIEluZGVudEd1aWRlSG9yaXpvbnRhbExpbmUgfSBmcm9tICcuLi90ZXh0TW9kZWxHdWlkZXMuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBMaW5lSW5qZWN0ZWRUZXh0IH0gZnJvbSAnLi4vdGV4dE1vZGVsRXZlbnRzLmpzJztcbmltcG9ydCAqIGFzIHZpZXdFdmVudHMgZnJvbSAnLi4vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNb2RlbExpbmVQcm9qZWN0aW9uLCBJTW9kZWxMaW5lUHJvamVjdGlvbiB9IGZyb20gJy4vbW9kZWxMaW5lUHJvamVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGluZUJyZWFrc0NvbXB1dGVyLCBNb2RlbExpbmVQcm9qZWN0aW9uRGF0YSwgSW5qZWN0ZWRUZXh0LCBJTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSB9IGZyb20gJy4uL21vZGVsTGluZVByb2plY3Rpb25EYXRhLmpzJztcbmltcG9ydCB7IENvbnN0YW50VGltZVByZWZpeFN1bUNvbXB1dGVyIH0gZnJvbSAnLi4vbW9kZWwvcHJlZml4U3VtQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgSUNvb3JkaW5hdGVzQ29udmVydGVyLCBWaWV3TGluZURhdGEgfSBmcm9tICcuLi92aWV3TW9kZWwuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3TW9kZWxMaW5lcyBleHRlbmRzIElEaXNwb3NhYmxlIHtcblx0Y3JlYXRlQ29vcmRpbmF0ZXNDb252ZXJ0ZXIoKTogSUNvb3JkaW5hdGVzQ29udmVydGVyO1xuXG5cdHNldFdyYXBwaW5nU2V0dGluZ3MoZm9udEluZm86IEZvbnRJbmZvLCB3cmFwcGluZ1N0cmF0ZWd5OiAnc2ltcGxlJyB8ICdhZHZhbmNlZCcsIHdyYXBwaW5nQ29sdW1uOiBudW1iZXIsIHdyYXBwaW5nSW5kZW50OiBXcmFwcGluZ0luZGVudCwgd29yZEJyZWFrOiAnbm9ybWFsJyB8ICdrZWVwQWxsJyk6IGJvb2xlYW47XG5cdHNldFRhYlNpemUobmV3VGFiU2l6ZTogbnVtYmVyKTogYm9vbGVhbjtcblx0Z2V0SGlkZGVuQXJlYXMoKTogUmFuZ2VbXTtcblx0c2V0SGlkZGVuQXJlYXMoX3JhbmdlczogcmVhZG9ubHkgUmFuZ2VbXSk6IGJvb2xlYW47XG5cblx0Y3JlYXRlTGluZUJyZWFrc0NvbXB1dGVyKCk6IElMaW5lQnJlYWtzQ29tcHV0ZXI7XG5cdG9uTW9kZWxGbHVzaGVkKCk6IHZvaWQ7XG5cdG9uTW9kZWxMaW5lc0RlbGV0ZWQodmVyc2lvbklkOiBudW1iZXIgfCBudWxsLCBmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlcik6IHZpZXdFdmVudHMuVmlld0xpbmVzRGVsZXRlZEV2ZW50IHwgbnVsbDtcblx0b25Nb2RlbExpbmVzSW5zZXJ0ZWQodmVyc2lvbklkOiBudW1iZXIgfCBudWxsLCBmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlciwgbGluZUJyZWFrczogKE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbClbXSk6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCB8IG51bGw7XG5cdG9uTW9kZWxMaW5lQ2hhbmdlZCh2ZXJzaW9uSWQ6IG51bWJlciB8IG51bGwsIGxpbmVOdW1iZXI6IG51bWJlciwgbGluZUJyZWFrRGF0YTogTW9kZWxMaW5lUHJvamVjdGlvbkRhdGEgfCBudWxsKTogW2Jvb2xlYW4sIHZpZXdFdmVudHMuVmlld0xpbmVzQ2hhbmdlZEV2ZW50IHwgbnVsbCwgdmlld0V2ZW50cy5WaWV3TGluZXNJbnNlcnRlZEV2ZW50IHwgbnVsbCwgdmlld0V2ZW50cy5WaWV3TGluZXNEZWxldGVkRXZlbnQgfCBudWxsXTtcblx0YWNjZXB0VmVyc2lvbklkKHZlcnNpb25JZDogbnVtYmVyKTogdm9pZDtcblxuXHRnZXRWaWV3TGluZUNvdW50KCk6IG51bWJlcjtcblx0Z2V0QWN0aXZlSW5kZW50R3VpZGUodmlld0xpbmVOdW1iZXI6IG51bWJlciwgbWluTGluZU51bWJlcjogbnVtYmVyLCBtYXhMaW5lTnVtYmVyOiBudW1iZXIpOiBJQWN0aXZlSW5kZW50R3VpZGVJbmZvO1xuXHRnZXRWaWV3TGluZXNJbmRlbnRHdWlkZXModmlld1N0YXJ0TGluZU51bWJlcjogbnVtYmVyLCB2aWV3RW5kTGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyW107XG5cdGdldFZpZXdMaW5lc0JyYWNrZXRHdWlkZXMoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgYWN0aXZlUG9zaXRpb246IElQb3NpdGlvbiB8IG51bGwsIG9wdGlvbnM6IEJyYWNrZXRHdWlkZU9wdGlvbnMpOiBJbmRlbnRHdWlkZVtdW107XG5cdGdldFZpZXdMaW5lQ29udGVudCh2aWV3TGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nO1xuXHRnZXRWaWV3TGluZUxlbmd0aCh2aWV3TGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyO1xuXHRnZXRWaWV3TGluZU1pbkNvbHVtbih2aWV3TGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyO1xuXHRnZXRWaWV3TGluZU1heENvbHVtbih2aWV3TGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyO1xuXHRnZXRWaWV3TGluZURhdGEodmlld0xpbmVOdW1iZXI6IG51bWJlcik6IFZpZXdMaW5lRGF0YTtcblx0Z2V0Vmlld0xpbmVzRGF0YSh2aWV3U3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIHZpZXdFbmRMaW5lTnVtYmVyOiBudW1iZXIsIG5lZWRlZDogYm9vbGVhbltdKTogQXJyYXk8Vmlld0xpbmVEYXRhIHwgbnVsbD47XG5cblx0Z2V0RGVjb3JhdGlvbnNJblJhbmdlKHJhbmdlOiBSYW5nZSwgb3duZXJJZDogbnVtYmVyLCBmaWx0ZXJPdXRWYWxpZGF0aW9uOiBib29sZWFuLCBvbmx5TWluaW1hcERlY29yYXRpb25zOiBib29sZWFuLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnM6IGJvb2xlYW4pOiBJTW9kZWxEZWNvcmF0aW9uW107XG5cblx0Z2V0SW5qZWN0ZWRUZXh0QXQodmlld1Bvc2l0aW9uOiBQb3NpdGlvbik6IEluamVjdGVkVGV4dCB8IG51bGw7XG5cblx0bm9ybWFsaXplUG9zaXRpb24ocG9zaXRpb246IFBvc2l0aW9uLCBhZmZpbml0eTogUG9zaXRpb25BZmZpbml0eSk6IFBvc2l0aW9uO1xuXHQvKipcblx0ICogR2V0cyB0aGUgY29sdW1uIGF0IHdoaWNoIGluZGVudGF0aW9uIHN0b3BzIGF0IGEgZ2l2ZW4gbGluZS5cblx0ICogQGludGVybmFsXG5cdCovXG5cdGdldExpbmVJbmRlbnRDb2x1bW4obGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgVmlld01vZGVsTGluZXNGcm9tUHJvamVjdGVkTW9kZWwgaW1wbGVtZW50cyBJVmlld01vZGVsTGluZXMge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JJZDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsOiBJVGV4dE1vZGVsO1xuXHRwcml2YXRlIF92YWxpZE1vZGVsVmVyc2lvbklkOiBudW1iZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeTogSUxpbmVCcmVha3NDb21wdXRlckZhY3Rvcnk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlckZhY3Rvcnk6IElMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5O1xuXG5cdHByaXZhdGUgZm9udEluZm86IEZvbnRJbmZvO1xuXHRwcml2YXRlIHRhYlNpemU6IG51bWJlcjtcblx0cHJpdmF0ZSB3cmFwcGluZ0NvbHVtbjogbnVtYmVyO1xuXHRwcml2YXRlIHdyYXBwaW5nSW5kZW50OiBXcmFwcGluZ0luZGVudDtcblx0cHJpdmF0ZSB3b3JkQnJlYWs6ICdub3JtYWwnIHwgJ2tlZXBBbGwnO1xuXHRwcml2YXRlIHdyYXBwaW5nU3RyYXRlZ3k6ICdzaW1wbGUnIHwgJ2FkdmFuY2VkJztcblxuXHRwcml2YXRlIG1vZGVsTGluZVByb2plY3Rpb25zITogSU1vZGVsTGluZVByb2plY3Rpb25bXTtcblxuXHQvKipcblx0ICogUmVmbGVjdHMgdGhlIHN1bSBvZiB0aGUgbGluZSBjb3VudHMgb2YgYWxsIHByb2plY3RlZCBtb2RlbCBsaW5lcy5cblx0Ki9cblx0cHJpdmF0ZSBwcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzITogQ29uc3RhbnRUaW1lUHJlZml4U3VtQ29tcHV0ZXI7XG5cblx0cHJpdmF0ZSBoaWRkZW5BcmVhc0RlY29yYXRpb25JZHMhOiBzdHJpbmdbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3JJZDogbnVtYmVyLFxuXHRcdG1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdGRvbUxpbmVCcmVha3NDb21wdXRlckZhY3Rvcnk6IElMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5LFxuXHRcdG1vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlckZhY3Rvcnk6IElMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5LFxuXHRcdGZvbnRJbmZvOiBGb250SW5mbyxcblx0XHR0YWJTaXplOiBudW1iZXIsXG5cdFx0d3JhcHBpbmdTdHJhdGVneTogJ3NpbXBsZScgfCAnYWR2YW5jZWQnLFxuXHRcdHdyYXBwaW5nQ29sdW1uOiBudW1iZXIsXG5cdFx0d3JhcHBpbmdJbmRlbnQ6IFdyYXBwaW5nSW5kZW50LFxuXHRcdHdvcmRCcmVhazogJ25vcm1hbCcgfCAna2VlcEFsbCdcblx0KSB7XG5cdFx0dGhpcy5fZWRpdG9ySWQgPSBlZGl0b3JJZDtcblx0XHR0aGlzLm1vZGVsID0gbW9kZWw7XG5cdFx0dGhpcy5fdmFsaWRNb2RlbFZlcnNpb25JZCA9IC0xO1xuXHRcdHRoaXMuX2RvbUxpbmVCcmVha3NDb21wdXRlckZhY3RvcnkgPSBkb21MaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5O1xuXHRcdHRoaXMuX21vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlckZhY3RvcnkgPSBtb25vc3BhY2VMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5O1xuXHRcdHRoaXMuZm9udEluZm8gPSBmb250SW5mbztcblx0XHR0aGlzLnRhYlNpemUgPSB0YWJTaXplO1xuXHRcdHRoaXMud3JhcHBpbmdTdHJhdGVneSA9IHdyYXBwaW5nU3RyYXRlZ3k7XG5cdFx0dGhpcy53cmFwcGluZ0NvbHVtbiA9IHdyYXBwaW5nQ29sdW1uO1xuXHRcdHRoaXMud3JhcHBpbmdJbmRlbnQgPSB3cmFwcGluZ0luZGVudDtcblx0XHR0aGlzLndvcmRCcmVhayA9IHdvcmRCcmVhaztcblxuXHRcdHRoaXMuX2NvbnN0cnVjdExpbmVzKC8qcmVzZXRIaWRkZW5BcmVhcyovdHJ1ZSwgbnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmhpZGRlbkFyZWFzRGVjb3JhdGlvbklkcyA9IHRoaXMubW9kZWwuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLmhpZGRlbkFyZWFzRGVjb3JhdGlvbklkcywgW10pO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZUNvb3JkaW5hdGVzQ29udmVydGVyKCk6IElDb29yZGluYXRlc0NvbnZlcnRlciB7XG5cdFx0cmV0dXJuIG5ldyBDb29yZGluYXRlc0NvbnZlcnRlcih0aGlzKTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbnN0cnVjdExpbmVzKHJlc2V0SGlkZGVuQXJlYXM6IGJvb2xlYW4sIHByZXZpb3VzTGluZUJyZWFrczogKChNb2RlbExpbmVQcm9qZWN0aW9uRGF0YSB8IG51bGwpW10pIHwgbnVsbCk6IHZvaWQge1xuXHRcdHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnMgPSBbXTtcblxuXHRcdGlmIChyZXNldEhpZGRlbkFyZWFzKSB7XG5cdFx0XHR0aGlzLmhpZGRlbkFyZWFzRGVjb3JhdGlvbklkcyA9IHRoaXMubW9kZWwuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLmhpZGRlbkFyZWFzRGVjb3JhdGlvbklkcywgW10pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVzQ29udGVudCA9IHRoaXMubW9kZWwuZ2V0TGluZXNDb250ZW50KCk7XG5cdFx0Y29uc3QgaW5qZWN0ZWRUZXh0RGVjb3JhdGlvbnMgPSB0aGlzLm1vZGVsLmdldEluamVjdGVkVGV4dERlY29yYXRpb25zKHRoaXMuX2VkaXRvcklkKTtcblx0XHRjb25zdCBsaW5lQ291bnQgPSBsaW5lc0NvbnRlbnQubGVuZ3RoO1xuXHRcdGNvbnN0IGxpbmVCcmVha3NDb21wdXRlciA9IHRoaXMuY3JlYXRlTGluZUJyZWFrc0NvbXB1dGVyKCk7XG5cblx0XHRjb25zdCBpbmplY3RlZFRleHRRdWV1ZSA9IG5ldyBhcnJheXMuQXJyYXlRdWV1ZShMaW5lSW5qZWN0ZWRUZXh0LmZyb21EZWNvcmF0aW9ucyhpbmplY3RlZFRleHREZWNvcmF0aW9ucykpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZUNvdW50OyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmVJbmplY3RlZFRleHQgPSBpbmplY3RlZFRleHRRdWV1ZS50YWtlV2hpbGUodCA9PiB0LmxpbmVOdW1iZXIgPT09IGkgKyAxKTtcblx0XHRcdGxpbmVCcmVha3NDb21wdXRlci5hZGRSZXF1ZXN0KGxpbmVzQ29udGVudFtpXSwgbGluZUluamVjdGVkVGV4dCwgcHJldmlvdXNMaW5lQnJlYWtzID8gcHJldmlvdXNMaW5lQnJlYWtzW2ldIDogbnVsbCk7XG5cdFx0fVxuXHRcdGNvbnN0IGxpbmVzQnJlYWtzID0gbGluZUJyZWFrc0NvbXB1dGVyLmZpbmFsaXplKCk7XG5cblx0XHRjb25zdCB2YWx1ZXM6IG51bWJlcltdID0gW107XG5cblx0XHRjb25zdCBoaWRkZW5BcmVhcyA9IHRoaXMuaGlkZGVuQXJlYXNEZWNvcmF0aW9uSWRzLm1hcCgoYXJlYUlkKSA9PiB0aGlzLm1vZGVsLmdldERlY29yYXRpb25SYW5nZShhcmVhSWQpISkuc29ydChSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMpO1xuXHRcdGxldCBoaWRkZW5BcmVhU3RhcnQgPSAxLCBoaWRkZW5BcmVhRW5kID0gMDtcblx0XHRsZXQgaGlkZGVuQXJlYUlkeCA9IC0xO1xuXHRcdGxldCBuZXh0TGluZU51bWJlclRvVXBkYXRlSGlkZGVuQXJlYSA9IChoaWRkZW5BcmVhSWR4ICsgMSA8IGhpZGRlbkFyZWFzLmxlbmd0aCkgPyBoaWRkZW5BcmVhRW5kICsgMSA6IGxpbmVDb3VudCArIDI7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVDb3VudDsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lTnVtYmVyID0gaSArIDE7XG5cblx0XHRcdGlmIChsaW5lTnVtYmVyID09PSBuZXh0TGluZU51bWJlclRvVXBkYXRlSGlkZGVuQXJlYSkge1xuXHRcdFx0XHRoaWRkZW5BcmVhSWR4Kys7XG5cdFx0XHRcdGhpZGRlbkFyZWFTdGFydCA9IGhpZGRlbkFyZWFzW2hpZGRlbkFyZWFJZHhdIS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdGhpZGRlbkFyZWFFbmQgPSBoaWRkZW5BcmVhc1toaWRkZW5BcmVhSWR4XSEuZW5kTGluZU51bWJlcjtcblx0XHRcdFx0bmV4dExpbmVOdW1iZXJUb1VwZGF0ZUhpZGRlbkFyZWEgPSAoaGlkZGVuQXJlYUlkeCArIDEgPCBoaWRkZW5BcmVhcy5sZW5ndGgpID8gaGlkZGVuQXJlYUVuZCArIDEgOiBsaW5lQ291bnQgKyAyO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpc0luSGlkZGVuQXJlYSA9IChsaW5lTnVtYmVyID49IGhpZGRlbkFyZWFTdGFydCAmJiBsaW5lTnVtYmVyIDw9IGhpZGRlbkFyZWFFbmQpO1xuXHRcdFx0Y29uc3QgbGluZSA9IGNyZWF0ZU1vZGVsTGluZVByb2plY3Rpb24obGluZXNCcmVha3NbaV0sICFpc0luSGlkZGVuQXJlYSk7XG5cdFx0XHR2YWx1ZXNbaV0gPSBsaW5lLmdldFZpZXdMaW5lQ291bnQoKTtcblx0XHRcdHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbaV0gPSBsaW5lO1xuXHRcdH1cblxuXHRcdHRoaXMuX3ZhbGlkTW9kZWxWZXJzaW9uSWQgPSB0aGlzLm1vZGVsLmdldFZlcnNpb25JZCgpO1xuXG5cdFx0dGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzID0gbmV3IENvbnN0YW50VGltZVByZWZpeFN1bUNvbXB1dGVyKHZhbHVlcyk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0SGlkZGVuQXJlYXMoKTogUmFuZ2VbXSB7XG5cdFx0cmV0dXJuIHRoaXMuaGlkZGVuQXJlYXNEZWNvcmF0aW9uSWRzLm1hcChcblx0XHRcdChkZWNJZCkgPT4gdGhpcy5tb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoZGVjSWQpIVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0SGlkZGVuQXJlYXMoX3JhbmdlczogUmFuZ2VbXSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHZhbGlkYXRlZFJhbmdlcyA9IF9yYW5nZXMubWFwKHIgPT4gdGhpcy5tb2RlbC52YWxpZGF0ZVJhbmdlKHIpKTtcblx0XHRjb25zdCBuZXdSYW5nZXMgPSBub3JtYWxpemVMaW5lUmFuZ2VzKHZhbGlkYXRlZFJhbmdlcyk7XG5cblx0XHQvLyBUT0RPQE1hcnRpbjogUGxlYXNlIHN0b3AgY2FsbGluZyB0aGlzIG1ldGhvZCBvbiBlYWNoIG1vZGVsIGNoYW5nZSFcblxuXHRcdC8vIFRoaXMgY2hlY2tzIGlmIHRoZXJlIHJlYWxseSB3YXMgYSBjaGFuZ2Vcblx0XHRjb25zdCBvbGRSYW5nZXMgPSB0aGlzLmhpZGRlbkFyZWFzRGVjb3JhdGlvbklkcy5tYXAoKGFyZWFJZCkgPT4gdGhpcy5tb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoYXJlYUlkKSEpLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblx0XHRpZiAobmV3UmFuZ2VzLmxlbmd0aCA9PT0gb2xkUmFuZ2VzLmxlbmd0aCkge1xuXHRcdFx0bGV0IGhhc0RpZmZlcmVuY2UgPSBmYWxzZTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbmV3UmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICghbmV3UmFuZ2VzW2ldLmVxdWFsc1JhbmdlKG9sZFJhbmdlc1tpXSkpIHtcblx0XHRcdFx0XHRoYXNEaWZmZXJlbmNlID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFoYXNEaWZmZXJlbmNlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBuZXdEZWNvcmF0aW9ucyA9IG5ld1Jhbmdlcy5tYXA8SU1vZGVsRGVsdGFEZWNvcmF0aW9uPihcblx0XHRcdChyKSA9PlxuXHRcdFx0KHtcblx0XHRcdFx0cmFuZ2U6IHIsXG5cdFx0XHRcdG9wdGlvbnM6IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMuRU1QVFksXG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHR0aGlzLmhpZGRlbkFyZWFzRGVjb3JhdGlvbklkcyA9IHRoaXMubW9kZWwuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLmhpZGRlbkFyZWFzRGVjb3JhdGlvbklkcywgbmV3RGVjb3JhdGlvbnMpO1xuXG5cdFx0Y29uc3QgaGlkZGVuQXJlYXMgPSBuZXdSYW5nZXM7XG5cdFx0bGV0IGhpZGRlbkFyZWFTdGFydCA9IDEsIGhpZGRlbkFyZWFFbmQgPSAwO1xuXHRcdGxldCBoaWRkZW5BcmVhSWR4ID0gLTE7XG5cdFx0bGV0IG5leHRMaW5lTnVtYmVyVG9VcGRhdGVIaWRkZW5BcmVhID0gKGhpZGRlbkFyZWFJZHggKyAxIDwgaGlkZGVuQXJlYXMubGVuZ3RoKSA/IGhpZGRlbkFyZWFFbmQgKyAxIDogdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9ucy5sZW5ndGggKyAyO1xuXG5cdFx0bGV0IGhhc1Zpc2libGVMaW5lID0gZmFsc2U7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lTnVtYmVyID0gaSArIDE7XG5cblx0XHRcdGlmIChsaW5lTnVtYmVyID09PSBuZXh0TGluZU51bWJlclRvVXBkYXRlSGlkZGVuQXJlYSkge1xuXHRcdFx0XHRoaWRkZW5BcmVhSWR4Kys7XG5cdFx0XHRcdGhpZGRlbkFyZWFTdGFydCA9IGhpZGRlbkFyZWFzW2hpZGRlbkFyZWFJZHhdLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0aGlkZGVuQXJlYUVuZCA9IGhpZGRlbkFyZWFzW2hpZGRlbkFyZWFJZHhdLmVuZExpbmVOdW1iZXI7XG5cdFx0XHRcdG5leHRMaW5lTnVtYmVyVG9VcGRhdGVIaWRkZW5BcmVhID0gKGhpZGRlbkFyZWFJZHggKyAxIDwgaGlkZGVuQXJlYXMubGVuZ3RoKSA/IGhpZGRlbkFyZWFFbmQgKyAxIDogdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9ucy5sZW5ndGggKyAyO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgbGluZUNoYW5nZWQgPSBmYWxzZTtcblx0XHRcdGlmIChsaW5lTnVtYmVyID49IGhpZGRlbkFyZWFTdGFydCAmJiBsaW5lTnVtYmVyIDw9IGhpZGRlbkFyZWFFbmQpIHtcblx0XHRcdFx0Ly8gTGluZSBzaG91bGQgYmUgaGlkZGVuXG5cdFx0XHRcdGlmICh0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2ldLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpXSA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbaV0uc2V0VmlzaWJsZShmYWxzZSk7XG5cdFx0XHRcdFx0bGluZUNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoYXNWaXNpYmxlTGluZSA9IHRydWU7XG5cdFx0XHRcdC8vIExpbmUgc2hvdWxkIGJlIHZpc2libGVcblx0XHRcdFx0aWYgKCF0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2ldLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpXSA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbaV0uc2V0VmlzaWJsZSh0cnVlKTtcblx0XHRcdFx0XHRsaW5lQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChsaW5lQ2hhbmdlZCkge1xuXHRcdFx0XHRjb25zdCBuZXdPdXRwdXRMaW5lQ291bnQgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2ldLmdldFZpZXdMaW5lQ291bnQoKTtcblx0XHRcdFx0dGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLnNldFZhbHVlKGksIG5ld091dHB1dExpbmVDb3VudCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFoYXNWaXNpYmxlTGluZSkge1xuXHRcdFx0Ly8gQ2Fubm90IGhhdmUgZXZlcnl0aGluZyBiZSBoaWRkZW4gPT4gcmV2ZWFsIGV2ZXJ5dGhpbmchXG5cdFx0XHR0aGlzLnNldEhpZGRlbkFyZWFzKFtdKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBtb2RlbFBvc2l0aW9uSXNWaXNpYmxlKG1vZGVsTGluZU51bWJlcjogbnVtYmVyLCBfbW9kZWxDb2x1bW46IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmIChtb2RlbExpbmVOdW1iZXIgPCAxIHx8IG1vZGVsTGluZU51bWJlciA+IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHQvLyBpbnZhbGlkIGFyZ3VtZW50c1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1ttb2RlbExpbmVOdW1iZXIgLSAxXS5pc1Zpc2libGUoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRNb2RlbExpbmVWaWV3TGluZUNvdW50KG1vZGVsTGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAobW9kZWxMaW5lTnVtYmVyIDwgMSB8fCBtb2RlbExpbmVOdW1iZXIgPiB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0Ly8gaW52YWxpZCBhcmd1bWVudHNcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1ttb2RlbExpbmVOdW1iZXIgLSAxXS5nZXRWaWV3TGluZUNvdW50KCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0VGFiU2l6ZShuZXdUYWJTaXplOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy50YWJTaXplID09PSBuZXdUYWJTaXplKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMudGFiU2l6ZSA9IG5ld1RhYlNpemU7XG5cblx0XHR0aGlzLl9jb25zdHJ1Y3RMaW5lcygvKnJlc2V0SGlkZGVuQXJlYXMqL2ZhbHNlLCBudWxsKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIHNldFdyYXBwaW5nU2V0dGluZ3MoZm9udEluZm86IEZvbnRJbmZvLCB3cmFwcGluZ1N0cmF0ZWd5OiAnc2ltcGxlJyB8ICdhZHZhbmNlZCcsIHdyYXBwaW5nQ29sdW1uOiBudW1iZXIsIHdyYXBwaW5nSW5kZW50OiBXcmFwcGluZ0luZGVudCwgd29yZEJyZWFrOiAnbm9ybWFsJyB8ICdrZWVwQWxsJyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGVxdWFsRm9udEluZm8gPSB0aGlzLmZvbnRJbmZvLmVxdWFscyhmb250SW5mbyk7XG5cdFx0Y29uc3QgZXF1YWxXcmFwcGluZ1N0cmF0ZWd5ID0gKHRoaXMud3JhcHBpbmdTdHJhdGVneSA9PT0gd3JhcHBpbmdTdHJhdGVneSk7XG5cdFx0Y29uc3QgZXF1YWxXcmFwcGluZ0NvbHVtbiA9ICh0aGlzLndyYXBwaW5nQ29sdW1uID09PSB3cmFwcGluZ0NvbHVtbik7XG5cdFx0Y29uc3QgZXF1YWxXcmFwcGluZ0luZGVudCA9ICh0aGlzLndyYXBwaW5nSW5kZW50ID09PSB3cmFwcGluZ0luZGVudCk7XG5cdFx0Y29uc3QgZXF1YWxXb3JkQnJlYWsgPSAodGhpcy53b3JkQnJlYWsgPT09IHdvcmRCcmVhayk7XG5cdFx0aWYgKGVxdWFsRm9udEluZm8gJiYgZXF1YWxXcmFwcGluZ1N0cmF0ZWd5ICYmIGVxdWFsV3JhcHBpbmdDb2x1bW4gJiYgZXF1YWxXcmFwcGluZ0luZGVudCAmJiBlcXVhbFdvcmRCcmVhaykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9ubHlXcmFwcGluZ0NvbHVtbkNoYW5nZWQgPSAoZXF1YWxGb250SW5mbyAmJiBlcXVhbFdyYXBwaW5nU3RyYXRlZ3kgJiYgIWVxdWFsV3JhcHBpbmdDb2x1bW4gJiYgZXF1YWxXcmFwcGluZ0luZGVudCAmJiBlcXVhbFdvcmRCcmVhayk7XG5cblx0XHR0aGlzLmZvbnRJbmZvID0gZm9udEluZm87XG5cdFx0dGhpcy53cmFwcGluZ1N0cmF0ZWd5ID0gd3JhcHBpbmdTdHJhdGVneTtcblx0XHR0aGlzLndyYXBwaW5nQ29sdW1uID0gd3JhcHBpbmdDb2x1bW47XG5cdFx0dGhpcy53cmFwcGluZ0luZGVudCA9IHdyYXBwaW5nSW5kZW50O1xuXHRcdHRoaXMud29yZEJyZWFrID0gd29yZEJyZWFrO1xuXG5cdFx0bGV0IHByZXZpb3VzTGluZUJyZWFrczogKChNb2RlbExpbmVQcm9qZWN0aW9uRGF0YSB8IG51bGwpW10pIHwgbnVsbCA9IG51bGw7XG5cdFx0aWYgKG9ubHlXcmFwcGluZ0NvbHVtbkNoYW5nZWQpIHtcblx0XHRcdHByZXZpb3VzTGluZUJyZWFrcyA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0cHJldmlvdXNMaW5lQnJlYWtzW2ldID0gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpXS5nZXRQcm9qZWN0aW9uRGF0YSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2NvbnN0cnVjdExpbmVzKC8qcmVzZXRIaWRkZW5BcmVhcyovZmFsc2UsIHByZXZpb3VzTGluZUJyZWFrcyk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVMaW5lQnJlYWtzQ29tcHV0ZXIoKTogSUxpbmVCcmVha3NDb21wdXRlciB7XG5cdFx0Y29uc3QgbGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSA9IChcblx0XHRcdHRoaXMud3JhcHBpbmdTdHJhdGVneSA9PT0gJ2FkdmFuY2VkJ1xuXHRcdFx0XHQ/IHRoaXMuX2RvbUxpbmVCcmVha3NDb21wdXRlckZhY3Rvcnlcblx0XHRcdFx0OiB0aGlzLl9tb25vc3BhY2VMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5XG5cdFx0KTtcblx0XHRyZXR1cm4gbGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeS5jcmVhdGVMaW5lQnJlYWtzQ29tcHV0ZXIodGhpcy5mb250SW5mbywgdGhpcy50YWJTaXplLCB0aGlzLndyYXBwaW5nQ29sdW1uLCB0aGlzLndyYXBwaW5nSW5kZW50LCB0aGlzLndvcmRCcmVhayk7XG5cdH1cblxuXHRwdWJsaWMgb25Nb2RlbEZsdXNoZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5fY29uc3RydWN0TGluZXMoLypyZXNldEhpZGRlbkFyZWFzKi90cnVlLCBudWxsKTtcblx0fVxuXG5cdHB1YmxpYyBvbk1vZGVsTGluZXNEZWxldGVkKHZlcnNpb25JZDogbnVtYmVyIHwgbnVsbCwgZnJvbUxpbmVOdW1iZXI6IG51bWJlciwgdG9MaW5lTnVtYmVyOiBudW1iZXIpOiB2aWV3RXZlbnRzLlZpZXdMaW5lc0RlbGV0ZWRFdmVudCB8IG51bGwge1xuXHRcdGlmICghdmVyc2lvbklkIHx8IHZlcnNpb25JZCA8PSB0aGlzLl92YWxpZE1vZGVsVmVyc2lvbklkKSB7XG5cdFx0XHQvLyBIZXJlIHdlIGNoZWNrIGZvciB2ZXJzaW9uSWQgaW4gY2FzZSB0aGUgbGluZXMgd2VyZSByZWNvbnN0cnVjdGVkIGluIHRoZSBtZWFudGltZS5cblx0XHRcdC8vIFdlIGRvbid0IHdhbnQgdG8gYXBwbHkgc3RhbGUgY2hhbmdlIGV2ZW50cyBvbiB0b3Agb2YgYSBuZXdlciByZWFkIG1vZGVsIHN0YXRlLlxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3V0cHV0RnJvbUxpbmVOdW1iZXIgPSAoZnJvbUxpbmVOdW1iZXIgPT09IDEgPyAxIDogdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldFByZWZpeFN1bShmcm9tTGluZU51bWJlciAtIDEpICsgMSk7XG5cdFx0Y29uc3Qgb3V0cHV0VG9MaW5lTnVtYmVyID0gdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldFByZWZpeFN1bSh0b0xpbmVOdW1iZXIpO1xuXG5cdFx0dGhpcy5tb2RlbExpbmVQcm9qZWN0aW9ucy5zcGxpY2UoZnJvbUxpbmVOdW1iZXIgLSAxLCB0b0xpbmVOdW1iZXIgLSBmcm9tTGluZU51bWJlciArIDEpO1xuXHRcdHRoaXMucHJvamVjdGVkTW9kZWxMaW5lTGluZUNvdW50cy5yZW1vdmVWYWx1ZXMoZnJvbUxpbmVOdW1iZXIgLSAxLCB0b0xpbmVOdW1iZXIgLSBmcm9tTGluZU51bWJlciArIDEpO1xuXG5cdFx0cmV0dXJuIG5ldyB2aWV3RXZlbnRzLlZpZXdMaW5lc0RlbGV0ZWRFdmVudChvdXRwdXRGcm9tTGluZU51bWJlciwgb3V0cHV0VG9MaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBvbk1vZGVsTGluZXNJbnNlcnRlZCh2ZXJzaW9uSWQ6IG51bWJlciB8IG51bGwsIGZyb21MaW5lTnVtYmVyOiBudW1iZXIsIF90b0xpbmVOdW1iZXI6IG51bWJlciwgbGluZUJyZWFrczogKE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbClbXSk6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCB8IG51bGwge1xuXHRcdGlmICghdmVyc2lvbklkIHx8IHZlcnNpb25JZCA8PSB0aGlzLl92YWxpZE1vZGVsVmVyc2lvbklkKSB7XG5cdFx0XHQvLyBIZXJlIHdlIGNoZWNrIGZvciB2ZXJzaW9uSWQgaW4gY2FzZSB0aGUgbGluZXMgd2VyZSByZWNvbnN0cnVjdGVkIGluIHRoZSBtZWFudGltZS5cblx0XHRcdC8vIFdlIGRvbid0IHdhbnQgdG8gYXBwbHkgc3RhbGUgY2hhbmdlIGV2ZW50cyBvbiB0b3Agb2YgYSBuZXdlciByZWFkIG1vZGVsIHN0YXRlLlxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gY2Fubm90IHVzZSB0aGlzLmdldEhpZGRlbkFyZWFzKCkgYmVjYXVzZSB0aG9zZSBkZWNvcmF0aW9ucyBoYXZlIGFscmVhZHkgc2VlbiB0aGUgZWZmZWN0IG9mIHRoaXMgbW9kZWwgY2hhbmdlXG5cdFx0Y29uc3QgaXNJbkhpZGRlbkFyZWEgPSAoZnJvbUxpbmVOdW1iZXIgPiAyICYmICF0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2Zyb21MaW5lTnVtYmVyIC0gMl0uaXNWaXNpYmxlKCkpO1xuXG5cdFx0Y29uc3Qgb3V0cHV0RnJvbUxpbmVOdW1iZXIgPSAoZnJvbUxpbmVOdW1iZXIgPT09IDEgPyAxIDogdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldFByZWZpeFN1bShmcm9tTGluZU51bWJlciAtIDEpICsgMSk7XG5cblx0XHRsZXQgdG90YWxPdXRwdXRMaW5lQ291bnQgPSAwO1xuXHRcdGNvbnN0IGluc2VydExpbmVzOiBJTW9kZWxMaW5lUHJvamVjdGlvbltdID0gW107XG5cdFx0Y29uc3QgaW5zZXJ0UHJlZml4U3VtVmFsdWVzOiBudW1iZXJbXSA9IFtdO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVCcmVha3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmUgPSBjcmVhdGVNb2RlbExpbmVQcm9qZWN0aW9uKGxpbmVCcmVha3NbaV0sICFpc0luSGlkZGVuQXJlYSk7XG5cdFx0XHRpbnNlcnRMaW5lcy5wdXNoKGxpbmUpO1xuXG5cdFx0XHRjb25zdCBvdXRwdXRMaW5lQ291bnQgPSBsaW5lLmdldFZpZXdMaW5lQ291bnQoKTtcblx0XHRcdHRvdGFsT3V0cHV0TGluZUNvdW50ICs9IG91dHB1dExpbmVDb3VudDtcblx0XHRcdGluc2VydFByZWZpeFN1bVZhbHVlc1tpXSA9IG91dHB1dExpbmVDb3VudDtcblx0XHR9XG5cblx0XHQvLyBUT0RPQEFsZXg6IHVzZSBhcnJheXMuYXJyYXlJbnNlcnRcblx0XHR0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zID1cblx0XHRcdHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnMuc2xpY2UoMCwgZnJvbUxpbmVOdW1iZXIgLSAxKVxuXHRcdFx0XHQuY29uY2F0KGluc2VydExpbmVzKVxuXHRcdFx0XHQuY29uY2F0KHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnMuc2xpY2UoZnJvbUxpbmVOdW1iZXIgLSAxKSk7XG5cblx0XHR0aGlzLnByb2plY3RlZE1vZGVsTGluZUxpbmVDb3VudHMuaW5zZXJ0VmFsdWVzKGZyb21MaW5lTnVtYmVyIC0gMSwgaW5zZXJ0UHJlZml4U3VtVmFsdWVzKTtcblxuXHRcdHJldHVybiBuZXcgdmlld0V2ZW50cy5WaWV3TGluZXNJbnNlcnRlZEV2ZW50KG91dHB1dEZyb21MaW5lTnVtYmVyLCBvdXRwdXRGcm9tTGluZU51bWJlciArIHRvdGFsT3V0cHV0TGluZUNvdW50IC0gMSk7XG5cdH1cblxuXHRwdWJsaWMgb25Nb2RlbExpbmVDaGFuZ2VkKHZlcnNpb25JZDogbnVtYmVyIHwgbnVsbCwgbGluZU51bWJlcjogbnVtYmVyLCBsaW5lQnJlYWtEYXRhOiBNb2RlbExpbmVQcm9qZWN0aW9uRGF0YSB8IG51bGwpOiBbYm9vbGVhbiwgdmlld0V2ZW50cy5WaWV3TGluZXNDaGFuZ2VkRXZlbnQgfCBudWxsLCB2aWV3RXZlbnRzLlZpZXdMaW5lc0luc2VydGVkRXZlbnQgfCBudWxsLCB2aWV3RXZlbnRzLlZpZXdMaW5lc0RlbGV0ZWRFdmVudCB8IG51bGxdIHtcblx0XHRpZiAodmVyc2lvbklkICE9PSBudWxsICYmIHZlcnNpb25JZCA8PSB0aGlzLl92YWxpZE1vZGVsVmVyc2lvbklkKSB7XG5cdFx0XHQvLyBIZXJlIHdlIGNoZWNrIGZvciB2ZXJzaW9uSWQgaW4gY2FzZSB0aGUgbGluZXMgd2VyZSByZWNvbnN0cnVjdGVkIGluIHRoZSBtZWFudGltZS5cblx0XHRcdC8vIFdlIGRvbid0IHdhbnQgdG8gYXBwbHkgc3RhbGUgY2hhbmdlIGV2ZW50cyBvbiB0b3Agb2YgYSBuZXdlciByZWFkIG1vZGVsIHN0YXRlLlxuXHRcdFx0cmV0dXJuIFtmYWxzZSwgbnVsbCwgbnVsbCwgbnVsbF07XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZUluZGV4ID0gbGluZU51bWJlciAtIDE7XG5cblx0XHRjb25zdCBvbGRPdXRwdXRMaW5lQ291bnQgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2xpbmVJbmRleF0uZ2V0Vmlld0xpbmVDb3VudCgpO1xuXHRcdGNvbnN0IGlzVmlzaWJsZSA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbbGluZUluZGV4XS5pc1Zpc2libGUoKTtcblx0XHRjb25zdCBsaW5lID0gY3JlYXRlTW9kZWxMaW5lUHJvamVjdGlvbihsaW5lQnJlYWtEYXRhLCBpc1Zpc2libGUpO1xuXHRcdHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbbGluZUluZGV4XSA9IGxpbmU7XG5cdFx0Y29uc3QgbmV3T3V0cHV0TGluZUNvdW50ID0gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tsaW5lSW5kZXhdLmdldFZpZXdMaW5lQ291bnQoKTtcblxuXHRcdGxldCBsaW5lTWFwcGluZ0NoYW5nZWQgPSBmYWxzZTtcblx0XHRsZXQgY2hhbmdlRnJvbSA9IDA7XG5cdFx0bGV0IGNoYW5nZVRvID0gLTE7XG5cdFx0bGV0IGluc2VydEZyb20gPSAwO1xuXHRcdGxldCBpbnNlcnRUbyA9IC0xO1xuXHRcdGxldCBkZWxldGVGcm9tID0gMDtcblx0XHRsZXQgZGVsZXRlVG8gPSAtMTtcblxuXHRcdGlmIChvbGRPdXRwdXRMaW5lQ291bnQgPiBuZXdPdXRwdXRMaW5lQ291bnQpIHtcblx0XHRcdGNoYW5nZUZyb20gPSB0aGlzLnByb2plY3RlZE1vZGVsTGluZUxpbmVDb3VudHMuZ2V0UHJlZml4U3VtKGxpbmVOdW1iZXIgLSAxKSArIDE7XG5cdFx0XHRjaGFuZ2VUbyA9IGNoYW5nZUZyb20gKyBuZXdPdXRwdXRMaW5lQ291bnQgLSAxO1xuXHRcdFx0ZGVsZXRlRnJvbSA9IGNoYW5nZVRvICsgMTtcblx0XHRcdGRlbGV0ZVRvID0gZGVsZXRlRnJvbSArIChvbGRPdXRwdXRMaW5lQ291bnQgLSBuZXdPdXRwdXRMaW5lQ291bnQpIC0gMTtcblx0XHRcdGxpbmVNYXBwaW5nQ2hhbmdlZCA9IHRydWU7XG5cdFx0fSBlbHNlIGlmIChvbGRPdXRwdXRMaW5lQ291bnQgPCBuZXdPdXRwdXRMaW5lQ291bnQpIHtcblx0XHRcdGNoYW5nZUZyb20gPSB0aGlzLnByb2plY3RlZE1vZGVsTGluZUxpbmVDb3VudHMuZ2V0UHJlZml4U3VtKGxpbmVOdW1iZXIgLSAxKSArIDE7XG5cdFx0XHRjaGFuZ2VUbyA9IGNoYW5nZUZyb20gKyBvbGRPdXRwdXRMaW5lQ291bnQgLSAxO1xuXHRcdFx0aW5zZXJ0RnJvbSA9IGNoYW5nZVRvICsgMTtcblx0XHRcdGluc2VydFRvID0gaW5zZXJ0RnJvbSArIChuZXdPdXRwdXRMaW5lQ291bnQgLSBvbGRPdXRwdXRMaW5lQ291bnQpIC0gMTtcblx0XHRcdGxpbmVNYXBwaW5nQ2hhbmdlZCA9IHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNoYW5nZUZyb20gPSB0aGlzLnByb2plY3RlZE1vZGVsTGluZUxpbmVDb3VudHMuZ2V0UHJlZml4U3VtKGxpbmVOdW1iZXIgLSAxKSArIDE7XG5cdFx0XHRjaGFuZ2VUbyA9IGNoYW5nZUZyb20gKyBuZXdPdXRwdXRMaW5lQ291bnQgLSAxO1xuXHRcdH1cblxuXHRcdHRoaXMucHJvamVjdGVkTW9kZWxMaW5lTGluZUNvdW50cy5zZXRWYWx1ZShsaW5lSW5kZXgsIG5ld091dHB1dExpbmVDb3VudCk7XG5cblx0XHRjb25zdCB2aWV3TGluZXNDaGFuZ2VkRXZlbnQgPSAoY2hhbmdlRnJvbSA8PSBjaGFuZ2VUbyA/IG5ldyB2aWV3RXZlbnRzLlZpZXdMaW5lc0NoYW5nZWRFdmVudChjaGFuZ2VGcm9tLCBjaGFuZ2VUbyAtIGNoYW5nZUZyb20gKyAxKSA6IG51bGwpO1xuXHRcdGNvbnN0IHZpZXdMaW5lc0luc2VydGVkRXZlbnQgPSAoaW5zZXJ0RnJvbSA8PSBpbnNlcnRUbyA/IG5ldyB2aWV3RXZlbnRzLlZpZXdMaW5lc0luc2VydGVkRXZlbnQoaW5zZXJ0RnJvbSwgaW5zZXJ0VG8pIDogbnVsbCk7XG5cdFx0Y29uc3Qgdmlld0xpbmVzRGVsZXRlZEV2ZW50ID0gKGRlbGV0ZUZyb20gPD0gZGVsZXRlVG8gPyBuZXcgdmlld0V2ZW50cy5WaWV3TGluZXNEZWxldGVkRXZlbnQoZGVsZXRlRnJvbSwgZGVsZXRlVG8pIDogbnVsbCk7XG5cblx0XHRyZXR1cm4gW2xpbmVNYXBwaW5nQ2hhbmdlZCwgdmlld0xpbmVzQ2hhbmdlZEV2ZW50LCB2aWV3TGluZXNJbnNlcnRlZEV2ZW50LCB2aWV3TGluZXNEZWxldGVkRXZlbnRdO1xuXHR9XG5cblx0cHVibGljIGFjY2VwdFZlcnNpb25JZCh2ZXJzaW9uSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3ZhbGlkTW9kZWxWZXJzaW9uSWQgPSB2ZXJzaW9uSWQ7XG5cdFx0aWYgKHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnMubGVuZ3RoID09PSAxICYmICF0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zWzBdLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHQvLyBBdCBsZWFzdCBvbmUgbGluZSBtdXN0IGJlIHZpc2libGUgPT4gcmVzZXQgaGlkZGVuIGFyZWFzXG5cdFx0XHR0aGlzLnNldEhpZGRlbkFyZWFzKFtdKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0Vmlld0xpbmVDb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnByb2plY3RlZE1vZGVsTGluZUxpbmVDb3VudHMuZ2V0VG90YWxTdW0oKTtcblx0fVxuXG5cdHByaXZhdGUgX3RvVmFsaWRWaWV3TGluZU51bWJlcih2aWV3TGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAodmlld0xpbmVOdW1iZXIgPCAxKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cdFx0Y29uc3Qgdmlld0xpbmVDb3VudCA9IHRoaXMuZ2V0Vmlld0xpbmVDb3VudCgpO1xuXHRcdGlmICh2aWV3TGluZU51bWJlciA+IHZpZXdMaW5lQ291bnQpIHtcblx0XHRcdHJldHVybiB2aWV3TGluZUNvdW50O1xuXHRcdH1cblx0XHRyZXR1cm4gdmlld0xpbmVOdW1iZXIgfCAwO1xuXHR9XG5cblx0cHVibGljIGdldEFjdGl2ZUluZGVudEd1aWRlKHZpZXdMaW5lTnVtYmVyOiBudW1iZXIsIG1pbkxpbmVOdW1iZXI6IG51bWJlciwgbWF4TGluZU51bWJlcjogbnVtYmVyKTogSUFjdGl2ZUluZGVudEd1aWRlSW5mbyB7XG5cdFx0dmlld0xpbmVOdW1iZXIgPSB0aGlzLl90b1ZhbGlkVmlld0xpbmVOdW1iZXIodmlld0xpbmVOdW1iZXIpO1xuXHRcdG1pbkxpbmVOdW1iZXIgPSB0aGlzLl90b1ZhbGlkVmlld0xpbmVOdW1iZXIobWluTGluZU51bWJlcik7XG5cdFx0bWF4TGluZU51bWJlciA9IHRoaXMuX3RvVmFsaWRWaWV3TGluZU51bWJlcihtYXhMaW5lTnVtYmVyKTtcblxuXHRcdGNvbnN0IG1vZGVsUG9zaXRpb24gPSB0aGlzLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24odmlld0xpbmVOdW1iZXIsIHRoaXMuZ2V0Vmlld0xpbmVNaW5Db2x1bW4odmlld0xpbmVOdW1iZXIpKTtcblx0XHRjb25zdCBtb2RlbE1pblBvc2l0aW9uID0gdGhpcy5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKG1pbkxpbmVOdW1iZXIsIHRoaXMuZ2V0Vmlld0xpbmVNaW5Db2x1bW4obWluTGluZU51bWJlcikpO1xuXHRcdGNvbnN0IG1vZGVsTWF4UG9zaXRpb24gPSB0aGlzLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24obWF4TGluZU51bWJlciwgdGhpcy5nZXRWaWV3TGluZU1pbkNvbHVtbihtYXhMaW5lTnVtYmVyKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5tb2RlbC5ndWlkZXMuZ2V0QWN0aXZlSW5kZW50R3VpZGUobW9kZWxQb3NpdGlvbi5saW5lTnVtYmVyLCBtb2RlbE1pblBvc2l0aW9uLmxpbmVOdW1iZXIsIG1vZGVsTWF4UG9zaXRpb24ubGluZU51bWJlcik7XG5cblx0XHRjb25zdCB2aWV3U3RhcnRQb3NpdGlvbiA9IHRoaXMuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihyZXN1bHQuc3RhcnRMaW5lTnVtYmVyLCAxKTtcblx0XHRjb25zdCB2aWV3RW5kUG9zaXRpb24gPSB0aGlzLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24ocmVzdWx0LmVuZExpbmVOdW1iZXIsIHRoaXMubW9kZWwuZ2V0TGluZU1heENvbHVtbihyZXN1bHQuZW5kTGluZU51bWJlcikpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IHZpZXdTdGFydFBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiB2aWV3RW5kUG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdGluZGVudDogcmVzdWx0LmluZGVudFxuXHRcdH07XG5cdH1cblxuXHQvLyAjcmVnaW9uIFZpZXdMaW5lSW5mb1xuXG5cdHByaXZhdGUgZ2V0Vmlld0xpbmVJbmZvKHZpZXdMaW5lTnVtYmVyOiBudW1iZXIpOiBWaWV3TGluZUluZm8ge1xuXHRcdHZpZXdMaW5lTnVtYmVyID0gdGhpcy5fdG9WYWxpZFZpZXdMaW5lTnVtYmVyKHZpZXdMaW5lTnVtYmVyKTtcblx0XHRjb25zdCByID0gdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldEluZGV4T2Yodmlld0xpbmVOdW1iZXIgLSAxKTtcblx0XHRjb25zdCBsaW5lSW5kZXggPSByLmluZGV4O1xuXHRcdGNvbnN0IHJlbWFpbmRlciA9IHIucmVtYWluZGVyO1xuXHRcdHJldHVybiBuZXcgVmlld0xpbmVJbmZvKGxpbmVJbmRleCArIDEsIHJlbWFpbmRlcik7XG5cdH1cblxuXHRwcml2YXRlIGdldE1pbkNvbHVtbk9mVmlld0xpbmUodmlld0xpbmVJbmZvOiBWaWV3TGluZUluZm8pOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW3ZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIgLSAxXS5nZXRWaWV3TGluZU1pbkNvbHVtbihcblx0XHRcdHRoaXMubW9kZWwsXG5cdFx0XHR2aWV3TGluZUluZm8ubW9kZWxMaW5lTnVtYmVyLFxuXHRcdFx0dmlld0xpbmVJbmZvLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4XG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWF4Q29sdW1uT2ZWaWV3TGluZSh2aWV3TGluZUluZm86IFZpZXdMaW5lSW5mbyk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbdmlld0xpbmVJbmZvLm1vZGVsTGluZU51bWJlciAtIDFdLmdldFZpZXdMaW5lTWF4Q29sdW1uKFxuXHRcdFx0dGhpcy5tb2RlbCxcblx0XHRcdHZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIsXG5cdFx0XHR2aWV3TGluZUluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHhcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRNb2RlbFN0YXJ0UG9zaXRpb25PZlZpZXdMaW5lKHZpZXdMaW5lSW5mbzogVmlld0xpbmVJbmZvKTogUG9zaXRpb24ge1xuXHRcdGNvbnN0IGxpbmUgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW3ZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIgLSAxXTtcblx0XHRjb25zdCBtaW5WaWV3Q29sdW1uID0gbGluZS5nZXRWaWV3TGluZU1pbkNvbHVtbihcblx0XHRcdHRoaXMubW9kZWwsXG5cdFx0XHR2aWV3TGluZUluZm8ubW9kZWxMaW5lTnVtYmVyLFxuXHRcdFx0dmlld0xpbmVJbmZvLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4XG5cdFx0KTtcblx0XHRjb25zdCBjb2x1bW4gPSBsaW5lLmdldE1vZGVsQ29sdW1uT2ZWaWV3UG9zaXRpb24oXG5cdFx0XHR2aWV3TGluZUluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHgsXG5cdFx0XHRtaW5WaWV3Q29sdW1uXG5cdFx0KTtcblx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKHZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIsIGNvbHVtbik7XG5cdH1cblxuXHRwcml2YXRlIGdldE1vZGVsRW5kUG9zaXRpb25PZlZpZXdMaW5lKHZpZXdMaW5lSW5mbzogVmlld0xpbmVJbmZvKTogUG9zaXRpb24ge1xuXHRcdGNvbnN0IGxpbmUgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW3ZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIgLSAxXTtcblx0XHRjb25zdCBtYXhWaWV3Q29sdW1uID0gbGluZS5nZXRWaWV3TGluZU1heENvbHVtbihcblx0XHRcdHRoaXMubW9kZWwsXG5cdFx0XHR2aWV3TGluZUluZm8ubW9kZWxMaW5lTnVtYmVyLFxuXHRcdFx0dmlld0xpbmVJbmZvLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4XG5cdFx0KTtcblx0XHRjb25zdCBjb2x1bW4gPSBsaW5lLmdldE1vZGVsQ29sdW1uT2ZWaWV3UG9zaXRpb24oXG5cdFx0XHR2aWV3TGluZUluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHgsXG5cdFx0XHRtYXhWaWV3Q29sdW1uXG5cdFx0KTtcblx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKHZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIsIGNvbHVtbik7XG5cdH1cblxuXHRwcml2YXRlIGdldFZpZXdMaW5lSW5mb3NHcm91cGVkQnlNb2RlbFJhbmdlcyh2aWV3U3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIHZpZXdFbmRMaW5lTnVtYmVyOiBudW1iZXIpOiBWaWV3TGluZUluZm9Hcm91cGVkQnlNb2RlbFJhbmdlW10ge1xuXHRcdGNvbnN0IHN0YXJ0Vmlld0xpbmUgPSB0aGlzLmdldFZpZXdMaW5lSW5mbyh2aWV3U3RhcnRMaW5lTnVtYmVyKTtcblx0XHRjb25zdCBlbmRWaWV3TGluZSA9IHRoaXMuZ2V0Vmlld0xpbmVJbmZvKHZpZXdFbmRMaW5lTnVtYmVyKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBBcnJheTxWaWV3TGluZUluZm9Hcm91cGVkQnlNb2RlbFJhbmdlPigpO1xuXHRcdGxldCBsYXN0VmlzaWJsZU1vZGVsUG9zOiBQb3NpdGlvbiB8IG51bGwgPSB0aGlzLmdldE1vZGVsU3RhcnRQb3NpdGlvbk9mVmlld0xpbmUoc3RhcnRWaWV3TGluZSk7XG5cdFx0bGV0IHZpZXdMaW5lcyA9IG5ldyBBcnJheTxWaWV3TGluZUluZm8+KCk7XG5cblx0XHRmb3IgKGxldCBjdXJNb2RlbExpbmUgPSBzdGFydFZpZXdMaW5lLm1vZGVsTGluZU51bWJlcjsgY3VyTW9kZWxMaW5lIDw9IGVuZFZpZXdMaW5lLm1vZGVsTGluZU51bWJlcjsgY3VyTW9kZWxMaW5lKyspIHtcblx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2N1ck1vZGVsTGluZSAtIDFdO1xuXG5cdFx0XHRpZiAobGluZS5pc1Zpc2libGUoKSkge1xuXHRcdFx0XHRjb25zdCBzdGFydE9mZnNldCA9XG5cdFx0XHRcdFx0Y3VyTW9kZWxMaW5lID09PSBzdGFydFZpZXdMaW5lLm1vZGVsTGluZU51bWJlclxuXHRcdFx0XHRcdFx0PyBzdGFydFZpZXdMaW5lLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4XG5cdFx0XHRcdFx0XHQ6IDA7XG5cblx0XHRcdFx0Y29uc3QgZW5kT2Zmc2V0ID1cblx0XHRcdFx0XHRjdXJNb2RlbExpbmUgPT09IGVuZFZpZXdMaW5lLm1vZGVsTGluZU51bWJlclxuXHRcdFx0XHRcdFx0PyBlbmRWaWV3TGluZS5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCArIDFcblx0XHRcdFx0XHRcdDogbGluZS5nZXRWaWV3TGluZUNvdW50KCk7XG5cblx0XHRcdFx0Zm9yIChsZXQgaSA9IHN0YXJ0T2Zmc2V0OyBpIDwgZW5kT2Zmc2V0OyBpKyspIHtcblx0XHRcdFx0XHR2aWV3TGluZXMucHVzaChuZXcgVmlld0xpbmVJbmZvKGN1ck1vZGVsTGluZSwgaSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICghbGluZS5pc1Zpc2libGUoKSAmJiBsYXN0VmlzaWJsZU1vZGVsUG9zKSB7XG5cdFx0XHRcdGNvbnN0IGxhc3RWaXNpYmxlTW9kZWxQb3MyID0gbmV3IFBvc2l0aW9uKGN1ck1vZGVsTGluZSAtIDEsIHRoaXMubW9kZWwuZ2V0TGluZU1heENvbHVtbihjdXJNb2RlbExpbmUgLSAxKSArIDEpO1xuXG5cdFx0XHRcdGNvbnN0IG1vZGVsUmFuZ2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKGxhc3RWaXNpYmxlTW9kZWxQb3MsIGxhc3RWaXNpYmxlTW9kZWxQb3MyKTtcblx0XHRcdFx0cmVzdWx0LnB1c2gobmV3IFZpZXdMaW5lSW5mb0dyb3VwZWRCeU1vZGVsUmFuZ2UobW9kZWxSYW5nZSwgdmlld0xpbmVzKSk7XG5cdFx0XHRcdHZpZXdMaW5lcyA9IFtdO1xuXG5cdFx0XHRcdGxhc3RWaXNpYmxlTW9kZWxQb3MgPSBudWxsO1xuXHRcdFx0fSBlbHNlIGlmIChsaW5lLmlzVmlzaWJsZSgpICYmICFsYXN0VmlzaWJsZU1vZGVsUG9zKSB7XG5cdFx0XHRcdGxhc3RWaXNpYmxlTW9kZWxQb3MgPSBuZXcgUG9zaXRpb24oY3VyTW9kZWxMaW5lLCAxKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobGFzdFZpc2libGVNb2RlbFBvcykge1xuXHRcdFx0Y29uc3QgbW9kZWxSYW5nZSA9IFJhbmdlLmZyb21Qb3NpdGlvbnMobGFzdFZpc2libGVNb2RlbFBvcywgdGhpcy5nZXRNb2RlbEVuZFBvc2l0aW9uT2ZWaWV3TGluZShlbmRWaWV3TGluZSkpO1xuXHRcdFx0cmVzdWx0LnB1c2gobmV3IFZpZXdMaW5lSW5mb0dyb3VwZWRCeU1vZGVsUmFuZ2UobW9kZWxSYW5nZSwgdmlld0xpbmVzKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8vICNlbmRyZWdpb25cblxuXHRwdWJsaWMgZ2V0Vmlld0xpbmVzQnJhY2tldEd1aWRlcyh2aWV3U3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIHZpZXdFbmRMaW5lTnVtYmVyOiBudW1iZXIsIGFjdGl2ZVZpZXdQb3NpdGlvbjogSVBvc2l0aW9uIHwgbnVsbCwgb3B0aW9uczogQnJhY2tldEd1aWRlT3B0aW9ucyk6IEluZGVudEd1aWRlW11bXSB7XG5cdFx0Y29uc3QgbW9kZWxBY3RpdmVQb3NpdGlvbiA9IGFjdGl2ZVZpZXdQb3NpdGlvbiA/IHRoaXMuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbihhY3RpdmVWaWV3UG9zaXRpb24ubGluZU51bWJlciwgYWN0aXZlVmlld1Bvc2l0aW9uLmNvbHVtbikgOiBudWxsO1xuXHRcdGNvbnN0IHJlc3VsdFBlclZpZXdMaW5lOiBJbmRlbnRHdWlkZVtdW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5nZXRWaWV3TGluZUluZm9zR3JvdXBlZEJ5TW9kZWxSYW5nZXModmlld1N0YXJ0TGluZU51bWJlciwgdmlld0VuZExpbmVOdW1iZXIpKSB7XG5cdFx0XHRjb25zdCBtb2RlbFJhbmdlU3RhcnRMaW5lTnVtYmVyID0gZ3JvdXAubW9kZWxSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cblx0XHRcdGNvbnN0IGJyYWNrZXRHdWlkZXNQZXJNb2RlbExpbmUgPSB0aGlzLm1vZGVsLmd1aWRlcy5nZXRMaW5lc0JyYWNrZXRHdWlkZXMoXG5cdFx0XHRcdG1vZGVsUmFuZ2VTdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdGdyb3VwLm1vZGVsUmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0bW9kZWxBY3RpdmVQb3NpdGlvbixcblx0XHRcdFx0b3B0aW9uc1xuXHRcdFx0KTtcblxuXHRcdFx0Zm9yIChjb25zdCB2aWV3TGluZUluZm8gb2YgZ3JvdXAudmlld0xpbmVzKSB7XG5cblx0XHRcdFx0Y29uc3QgYnJhY2tldEd1aWRlcyA9IGJyYWNrZXRHdWlkZXNQZXJNb2RlbExpbmVbdmlld0xpbmVJbmZvLm1vZGVsTGluZU51bWJlciAtIG1vZGVsUmFuZ2VTdGFydExpbmVOdW1iZXJdO1xuXG5cdFx0XHRcdC8vIHZpc2libGVDb2x1bW5zIHN0YXkgYXMgdGhleSBhcmUgKHRoaXMgaXMgYSBidWcgYW5kIG5lZWRzIHRvIGJlIGZpeGVkLCBidXQgaXQgaXMgbm90IGEgcmVncmVzc2lvbilcblx0XHRcdFx0Ly8gbW9kZWwtY29sdW1ucyBtdXN0IGJlIGNvbnZlcnRlZCB0byB2aWV3LW1vZGVsIGNvbHVtbnMuXG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGJyYWNrZXRHdWlkZXMubWFwKGcgPT4ge1xuXHRcdFx0XHRcdGlmIChnLmZvcldyYXBwZWRMaW5lc0FmdGVyQ29sdW1uICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcCA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbdmlld0xpbmVJbmZvLm1vZGVsTGluZU51bWJlciAtIDFdLmdldFZpZXdQb3NpdGlvbk9mTW9kZWxQb3NpdGlvbigwLCBnLmZvcldyYXBwZWRMaW5lc0FmdGVyQ29sdW1uKTtcblx0XHRcdFx0XHRcdGlmIChwLmxpbmVOdW1iZXIgPj0gdmlld0xpbmVJbmZvLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGcuZm9yV3JhcHBlZExpbmVzQmVmb3JlT3JBdENvbHVtbiAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHAgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW3ZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIgLSAxXS5nZXRWaWV3UG9zaXRpb25PZk1vZGVsUG9zaXRpb24oMCwgZy5mb3JXcmFwcGVkTGluZXNCZWZvcmVPckF0Q29sdW1uKTtcblx0XHRcdFx0XHRcdGlmIChwLmxpbmVOdW1iZXIgPCB2aWV3TGluZUluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHgpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWcuaG9yaXpvbnRhbExpbmUpIHtcblx0XHRcdFx0XHRcdHJldHVybiBnO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGxldCBjb2x1bW4gPSAtMTtcblx0XHRcdFx0XHRpZiAoZy5jb2x1bW4gIT09IC0xKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBwID0gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1t2aWV3TGluZUluZm8ubW9kZWxMaW5lTnVtYmVyIC0gMV0uZ2V0Vmlld1Bvc2l0aW9uT2ZNb2RlbFBvc2l0aW9uKDAsIGcuY29sdW1uKTtcblx0XHRcdFx0XHRcdGlmIChwLmxpbmVOdW1iZXIgPT09IHZpZXdMaW5lSW5mby5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCkge1xuXHRcdFx0XHRcdFx0XHRjb2x1bW4gPSBwLmNvbHVtbjtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAocC5saW5lTnVtYmVyIDwgdmlld0xpbmVJbmZvLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4KSB7XG5cdFx0XHRcdFx0XHRcdGNvbHVtbiA9IHRoaXMuZ2V0TWluQ29sdW1uT2ZWaWV3TGluZSh2aWV3TGluZUluZm8pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChwLmxpbmVOdW1iZXIgPiB2aWV3TGluZUluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHgpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB2aWV3UG9zaXRpb24gPSB0aGlzLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24odmlld0xpbmVJbmZvLm1vZGVsTGluZU51bWJlciwgZy5ob3Jpem9udGFsTGluZS5lbmRDb2x1bW4pO1xuXHRcdFx0XHRcdGNvbnN0IHAgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW3ZpZXdMaW5lSW5mby5tb2RlbExpbmVOdW1iZXIgLSAxXS5nZXRWaWV3UG9zaXRpb25PZk1vZGVsUG9zaXRpb24oMCwgZy5ob3Jpem9udGFsTGluZS5lbmRDb2x1bW4pO1xuXHRcdFx0XHRcdGlmIChwLmxpbmVOdW1iZXIgPT09IHZpZXdMaW5lSW5mby5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBJbmRlbnRHdWlkZShnLnZpc2libGVDb2x1bW4sIGNvbHVtbiwgZy5jbGFzc05hbWUsXG5cdFx0XHRcdFx0XHRcdG5ldyBJbmRlbnRHdWlkZUhvcml6b250YWxMaW5lKGcuaG9yaXpvbnRhbExpbmUudG9wLFxuXHRcdFx0XHRcdFx0XHRcdHZpZXdQb3NpdGlvbi5jb2x1bW4pLFxuXHRcdFx0XHRcdFx0XHQtIDEsXG5cdFx0XHRcdFx0XHRcdC0xLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHAubGluZU51bWJlciA8IHZpZXdMaW5lSW5mby5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKGcudmlzaWJsZUNvbHVtbiAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdFx0Ly8gRG9uJ3QgcmVwZWF0IGhvcml6b250YWwgbGluZXMgdGhhdCB1c2UgdmlzaWJsZUNvbHVtbiBmb3IgdW5yZWxhdGVkIGxpbmVzLlxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBJbmRlbnRHdWlkZShnLnZpc2libGVDb2x1bW4sIGNvbHVtbiwgZy5jbGFzc05hbWUsXG5cdFx0XHRcdFx0XHRcdG5ldyBJbmRlbnRHdWlkZUhvcml6b250YWxMaW5lKGcuaG9yaXpvbnRhbExpbmUudG9wLFxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuZ2V0TWF4Q29sdW1uT2ZWaWV3TGluZSh2aWV3TGluZUluZm8pXG5cdFx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHRcdC0xLFxuXHRcdFx0XHRcdFx0XHQtMSxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmVzdWx0UGVyVmlld0xpbmUucHVzaChyZXN1bHQuZmlsdGVyKChyKTogciBpcyBJbmRlbnRHdWlkZSA9PiAhIXIpKTtcblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHRQZXJWaWV3TGluZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZXNJbmRlbnRHdWlkZXModmlld1N0YXJ0TGluZU51bWJlcjogbnVtYmVyLCB2aWV3RW5kTGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyW10ge1xuXHRcdC8vIFRPRE86IFVzZSB0aGUgc2FtZSBjb2RlIGFzIGluIGBnZXRWaWV3TGluZXNCcmFja2V0R3VpZGVzYC5cblx0XHQvLyBGdXR1cmUgVE9ETzogTWVyZ2Ugd2l0aCBgZ2V0Vmlld0xpbmVzQnJhY2tldEd1aWRlc2AuXG5cdFx0Ly8gSG93ZXZlciwgdGhpcyByZXF1aXJlcyBtb3JlIHJlZmFjdG9yaW5nIG9mIGluZGVudCBndWlkZXMuXG5cdFx0dmlld1N0YXJ0TGluZU51bWJlciA9IHRoaXMuX3RvVmFsaWRWaWV3TGluZU51bWJlcih2aWV3U3RhcnRMaW5lTnVtYmVyKTtcblx0XHR2aWV3RW5kTGluZU51bWJlciA9IHRoaXMuX3RvVmFsaWRWaWV3TGluZU51bWJlcih2aWV3RW5kTGluZU51bWJlcik7XG5cblx0XHRjb25zdCBtb2RlbFN0YXJ0ID0gdGhpcy5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKHZpZXdTdGFydExpbmVOdW1iZXIsIHRoaXMuZ2V0Vmlld0xpbmVNaW5Db2x1bW4odmlld1N0YXJ0TGluZU51bWJlcikpO1xuXHRcdGNvbnN0IG1vZGVsRW5kID0gdGhpcy5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKHZpZXdFbmRMaW5lTnVtYmVyLCB0aGlzLmdldFZpZXdMaW5lTWF4Q29sdW1uKHZpZXdFbmRMaW5lTnVtYmVyKSk7XG5cblx0XHRsZXQgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IHJlc3VsdFJlcGVhdENvdW50OiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IHJlc3VsdFJlcGVhdE9wdGlvbjogSW5kZW50R3VpZGVSZXBlYXRPcHRpb25bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsU3RhcnRMaW5lSW5kZXggPSBtb2RlbFN0YXJ0LmxpbmVOdW1iZXIgLSAxO1xuXHRcdGNvbnN0IG1vZGVsRW5kTGluZUluZGV4ID0gbW9kZWxFbmQubGluZU51bWJlciAtIDE7XG5cblx0XHRsZXQgcmVxU3RhcnQ6IFBvc2l0aW9uIHwgbnVsbCA9IG51bGw7XG5cdFx0Zm9yIChsZXQgbW9kZWxMaW5lSW5kZXggPSBtb2RlbFN0YXJ0TGluZUluZGV4OyBtb2RlbExpbmVJbmRleCA8PSBtb2RlbEVuZExpbmVJbmRleDsgbW9kZWxMaW5lSW5kZXgrKykge1xuXHRcdFx0Y29uc3QgbGluZSA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbbW9kZWxMaW5lSW5kZXhdO1xuXHRcdFx0aWYgKGxpbmUuaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0Y29uc3Qgdmlld0xpbmVTdGFydEluZGV4ID0gbGluZS5nZXRWaWV3TGluZU51bWJlck9mTW9kZWxQb3NpdGlvbigwLCBtb2RlbExpbmVJbmRleCA9PT0gbW9kZWxTdGFydExpbmVJbmRleCA/IG1vZGVsU3RhcnQuY29sdW1uIDogMSk7XG5cdFx0XHRcdGNvbnN0IHZpZXdMaW5lRW5kSW5kZXggPSBsaW5lLmdldFZpZXdMaW5lTnVtYmVyT2ZNb2RlbFBvc2l0aW9uKDAsIHRoaXMubW9kZWwuZ2V0TGluZU1heENvbHVtbihtb2RlbExpbmVJbmRleCArIDEpKTtcblx0XHRcdFx0Y29uc3QgY291bnQgPSB2aWV3TGluZUVuZEluZGV4IC0gdmlld0xpbmVTdGFydEluZGV4ICsgMTtcblx0XHRcdFx0bGV0IG9wdGlvbiA9IEluZGVudEd1aWRlUmVwZWF0T3B0aW9uLkJsb2NrTm9uZTtcblx0XHRcdFx0aWYgKGNvdW50ID4gMSAmJiBsaW5lLmdldFZpZXdMaW5lTWluQ29sdW1uKHRoaXMubW9kZWwsIG1vZGVsTGluZUluZGV4ICsgMSwgdmlld0xpbmVFbmRJbmRleCkgPT09IDEpIHtcblx0XHRcdFx0XHQvLyB3cmFwcGVkIGxpbmVzIHNob3VsZCBibG9jayBpbmRlbnQgZ3VpZGVzXG5cdFx0XHRcdFx0b3B0aW9uID0gKHZpZXdMaW5lU3RhcnRJbmRleCA9PT0gMCA/IEluZGVudEd1aWRlUmVwZWF0T3B0aW9uLkJsb2NrU3Vic2VxdWVudCA6IEluZGVudEd1aWRlUmVwZWF0T3B0aW9uLkJsb2NrQWxsKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHRSZXBlYXRDb3VudC5wdXNoKGNvdW50KTtcblx0XHRcdFx0cmVzdWx0UmVwZWF0T3B0aW9uLnB1c2gob3B0aW9uKTtcblx0XHRcdFx0Ly8gbWVyZ2UgaW50byBwcmV2aW91cyByZXF1ZXN0XG5cdFx0XHRcdGlmIChyZXFTdGFydCA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdHJlcVN0YXJ0ID0gbmV3IFBvc2l0aW9uKG1vZGVsTGluZUluZGV4ICsgMSwgMCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGhpdCBpbnZpc2libGUgbGluZSA9PiBmbHVzaCByZXF1ZXN0XG5cdFx0XHRcdGlmIChyZXFTdGFydCAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdHJlc3VsdCA9IHJlc3VsdC5jb25jYXQodGhpcy5tb2RlbC5ndWlkZXMuZ2V0TGluZXNJbmRlbnRHdWlkZXMocmVxU3RhcnQubGluZU51bWJlciwgbW9kZWxMaW5lSW5kZXgpKTtcblx0XHRcdFx0XHRyZXFTdGFydCA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocmVxU3RhcnQgIT09IG51bGwpIHtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdC5jb25jYXQodGhpcy5tb2RlbC5ndWlkZXMuZ2V0TGluZXNJbmRlbnRHdWlkZXMocmVxU3RhcnQubGluZU51bWJlciwgbW9kZWxFbmQubGluZU51bWJlcikpO1xuXHRcdFx0cmVxU3RhcnQgPSBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdMaW5lQ291bnQgPSB2aWV3RW5kTGluZU51bWJlciAtIHZpZXdTdGFydExpbmVOdW1iZXIgKyAxO1xuXHRcdGNvbnN0IHZpZXdJbmRlbnRzID0gbmV3IEFycmF5PG51bWJlcj4odmlld0xpbmVDb3VudCk7XG5cdFx0bGV0IGN1cnJJbmRleCA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJlc3VsdC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0bGV0IHZhbHVlID0gcmVzdWx0W2ldO1xuXHRcdFx0Y29uc3QgY291bnQgPSBNYXRoLm1pbih2aWV3TGluZUNvdW50IC0gY3VyckluZGV4LCByZXN1bHRSZXBlYXRDb3VudFtpXSk7XG5cdFx0XHRjb25zdCBvcHRpb24gPSByZXN1bHRSZXBlYXRPcHRpb25baV07XG5cdFx0XHRsZXQgYmxvY2tBdEluZGV4OiBudW1iZXI7XG5cdFx0XHRpZiAob3B0aW9uID09PSBJbmRlbnRHdWlkZVJlcGVhdE9wdGlvbi5CbG9ja0FsbCkge1xuXHRcdFx0XHRibG9ja0F0SW5kZXggPSAwO1xuXHRcdFx0fSBlbHNlIGlmIChvcHRpb24gPT09IEluZGVudEd1aWRlUmVwZWF0T3B0aW9uLkJsb2NrU3Vic2VxdWVudCkge1xuXHRcdFx0XHRibG9ja0F0SW5kZXggPSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YmxvY2tBdEluZGV4ID0gY291bnQ7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcblx0XHRcdFx0aWYgKGogPT09IGJsb2NrQXRJbmRleCkge1xuXHRcdFx0XHRcdHZhbHVlID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHR2aWV3SW5kZW50c1tjdXJySW5kZXgrK10gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZpZXdJbmRlbnRzO1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lQ29udGVudCh2aWV3TGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRjb25zdCBpbmZvID0gdGhpcy5nZXRWaWV3TGluZUluZm8odmlld0xpbmVOdW1iZXIpO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2luZm8ubW9kZWxMaW5lTnVtYmVyIC0gMV0uZ2V0Vmlld0xpbmVDb250ZW50KHRoaXMubW9kZWwsIGluZm8ubW9kZWxMaW5lTnVtYmVyLCBpbmZvLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZUxlbmd0aCh2aWV3TGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCBpbmZvID0gdGhpcy5nZXRWaWV3TGluZUluZm8odmlld0xpbmVOdW1iZXIpO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2luZm8ubW9kZWxMaW5lTnVtYmVyIC0gMV0uZ2V0Vmlld0xpbmVMZW5ndGgodGhpcy5tb2RlbCwgaW5mby5tb2RlbExpbmVOdW1iZXIsIGluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHgpO1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lTWluQ29sdW1uKHZpZXdMaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLmdldFZpZXdMaW5lSW5mbyh2aWV3TGluZU51bWJlcik7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbaW5mby5tb2RlbExpbmVOdW1iZXIgLSAxXS5nZXRWaWV3TGluZU1pbkNvbHVtbih0aGlzLm1vZGVsLCBpbmZvLm1vZGVsTGluZU51bWJlciwgaW5mby5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Vmlld0xpbmVNYXhDb2x1bW4odmlld0xpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuZ2V0Vmlld0xpbmVJbmZvKHZpZXdMaW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpbmZvLm1vZGVsTGluZU51bWJlciAtIDFdLmdldFZpZXdMaW5lTWF4Q29sdW1uKHRoaXMubW9kZWwsIGluZm8ubW9kZWxMaW5lTnVtYmVyLCBpbmZvLm1vZGVsTGluZVdyYXBwZWRMaW5lSWR4KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZURhdGEodmlld0xpbmVOdW1iZXI6IG51bWJlcik6IFZpZXdMaW5lRGF0YSB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuZ2V0Vmlld0xpbmVJbmZvKHZpZXdMaW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpbmZvLm1vZGVsTGluZU51bWJlciAtIDFdLmdldFZpZXdMaW5lRGF0YSh0aGlzLm1vZGVsLCBpbmZvLm1vZGVsTGluZU51bWJlciwgaW5mby5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Vmlld0xpbmVzRGF0YSh2aWV3U3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIHZpZXdFbmRMaW5lTnVtYmVyOiBudW1iZXIsIG5lZWRlZDogYm9vbGVhbltdKTogVmlld0xpbmVEYXRhW10ge1xuXG5cdFx0dmlld1N0YXJ0TGluZU51bWJlciA9IHRoaXMuX3RvVmFsaWRWaWV3TGluZU51bWJlcih2aWV3U3RhcnRMaW5lTnVtYmVyKTtcblx0XHR2aWV3RW5kTGluZU51bWJlciA9IHRoaXMuX3RvVmFsaWRWaWV3TGluZU51bWJlcih2aWV3RW5kTGluZU51bWJlcik7XG5cblx0XHRjb25zdCBzdGFydCA9IHRoaXMucHJvamVjdGVkTW9kZWxMaW5lTGluZUNvdW50cy5nZXRJbmRleE9mKHZpZXdTdGFydExpbmVOdW1iZXIgLSAxKTtcblx0XHRsZXQgdmlld0xpbmVOdW1iZXIgPSB2aWV3U3RhcnRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IHN0YXJ0TW9kZWxMaW5lSW5kZXggPSBzdGFydC5pbmRleDtcblx0XHRjb25zdCBzdGFydFJlbWFpbmRlciA9IHN0YXJ0LnJlbWFpbmRlcjtcblxuXHRcdGNvbnN0IHJlc3VsdDogVmlld0xpbmVEYXRhW10gPSBbXTtcblx0XHRmb3IgKGxldCBtb2RlbExpbmVJbmRleCA9IHN0YXJ0TW9kZWxMaW5lSW5kZXgsIGxlbiA9IHRoaXMubW9kZWwuZ2V0TGluZUNvdW50KCk7IG1vZGVsTGluZUluZGV4IDwgbGVuOyBtb2RlbExpbmVJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1ttb2RlbExpbmVJbmRleF07XG5cdFx0XHRpZiAoIWxpbmUuaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmcm9tVmlld0xpbmVJbmRleCA9IChtb2RlbExpbmVJbmRleCA9PT0gc3RhcnRNb2RlbExpbmVJbmRleCA/IHN0YXJ0UmVtYWluZGVyIDogMCk7XG5cdFx0XHRsZXQgcmVtYWluaW5nVmlld0xpbmVDb3VudCA9IGxpbmUuZ2V0Vmlld0xpbmVDb3VudCgpIC0gZnJvbVZpZXdMaW5lSW5kZXg7XG5cblx0XHRcdGxldCBsYXN0TGluZSA9IGZhbHNlO1xuXHRcdFx0aWYgKHZpZXdMaW5lTnVtYmVyICsgcmVtYWluaW5nVmlld0xpbmVDb3VudCA+IHZpZXdFbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdGxhc3RMaW5lID0gdHJ1ZTtcblx0XHRcdFx0cmVtYWluaW5nVmlld0xpbmVDb3VudCA9IHZpZXdFbmRMaW5lTnVtYmVyIC0gdmlld0xpbmVOdW1iZXIgKyAxO1xuXHRcdFx0fVxuXG5cdFx0XHRsaW5lLmdldFZpZXdMaW5lc0RhdGEodGhpcy5tb2RlbCwgbW9kZWxMaW5lSW5kZXggKyAxLCBmcm9tVmlld0xpbmVJbmRleCwgcmVtYWluaW5nVmlld0xpbmVDb3VudCwgdmlld0xpbmVOdW1iZXIgLSB2aWV3U3RhcnRMaW5lTnVtYmVyLCBuZWVkZWQsIHJlc3VsdCk7XG5cblx0XHRcdHZpZXdMaW5lTnVtYmVyICs9IHJlbWFpbmluZ1ZpZXdMaW5lQ291bnQ7XG5cblx0XHRcdGlmIChsYXN0TGluZSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlVmlld1Bvc2l0aW9uKHZpZXdMaW5lTnVtYmVyOiBudW1iZXIsIHZpZXdDb2x1bW46IG51bWJlciwgZXhwZWN0ZWRNb2RlbFBvc2l0aW9uOiBQb3NpdGlvbik6IFBvc2l0aW9uIHtcblx0XHR2aWV3TGluZU51bWJlciA9IHRoaXMuX3RvVmFsaWRWaWV3TGluZU51bWJlcih2aWV3TGluZU51bWJlcik7XG5cblx0XHRjb25zdCByID0gdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldEluZGV4T2Yodmlld0xpbmVOdW1iZXIgLSAxKTtcblx0XHRjb25zdCBsaW5lSW5kZXggPSByLmluZGV4O1xuXHRcdGNvbnN0IHJlbWFpbmRlciA9IHIucmVtYWluZGVyO1xuXG5cdFx0Y29uc3QgbGluZSA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbbGluZUluZGV4XTtcblxuXHRcdGNvbnN0IG1pbkNvbHVtbiA9IGxpbmUuZ2V0Vmlld0xpbmVNaW5Db2x1bW4odGhpcy5tb2RlbCwgbGluZUluZGV4ICsgMSwgcmVtYWluZGVyKTtcblx0XHRjb25zdCBtYXhDb2x1bW4gPSBsaW5lLmdldFZpZXdMaW5lTWF4Q29sdW1uKHRoaXMubW9kZWwsIGxpbmVJbmRleCArIDEsIHJlbWFpbmRlcik7XG5cdFx0aWYgKHZpZXdDb2x1bW4gPCBtaW5Db2x1bW4pIHtcblx0XHRcdHZpZXdDb2x1bW4gPSBtaW5Db2x1bW47XG5cdFx0fVxuXHRcdGlmICh2aWV3Q29sdW1uID4gbWF4Q29sdW1uKSB7XG5cdFx0XHR2aWV3Q29sdW1uID0gbWF4Q29sdW1uO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbXB1dGVkTW9kZWxDb2x1bW4gPSBsaW5lLmdldE1vZGVsQ29sdW1uT2ZWaWV3UG9zaXRpb24ocmVtYWluZGVyLCB2aWV3Q29sdW1uKTtcblx0XHRjb25zdCBjb21wdXRlZE1vZGVsUG9zaXRpb24gPSB0aGlzLm1vZGVsLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKGxpbmVJbmRleCArIDEsIGNvbXB1dGVkTW9kZWxDb2x1bW4pKTtcblxuXHRcdGlmIChjb21wdXRlZE1vZGVsUG9zaXRpb24uZXF1YWxzKGV4cGVjdGVkTW9kZWxQb3NpdGlvbikpIHtcblx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24odmlld0xpbmVOdW1iZXIsIHZpZXdDb2x1bW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24oZXhwZWN0ZWRNb2RlbFBvc2l0aW9uLmxpbmVOdW1iZXIsIGV4cGVjdGVkTW9kZWxQb3NpdGlvbi5jb2x1bW4pO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlVmlld1JhbmdlKHZpZXdSYW5nZTogUmFuZ2UsIGV4cGVjdGVkTW9kZWxSYW5nZTogUmFuZ2UpOiBSYW5nZSB7XG5cdFx0Y29uc3QgdmFsaWRWaWV3U3RhcnQgPSB0aGlzLnZhbGlkYXRlVmlld1Bvc2l0aW9uKHZpZXdSYW5nZS5zdGFydExpbmVOdW1iZXIsIHZpZXdSYW5nZS5zdGFydENvbHVtbiwgZXhwZWN0ZWRNb2RlbFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0Y29uc3QgdmFsaWRWaWV3RW5kID0gdGhpcy52YWxpZGF0ZVZpZXdQb3NpdGlvbih2aWV3UmFuZ2UuZW5kTGluZU51bWJlciwgdmlld1JhbmdlLmVuZENvbHVtbiwgZXhwZWN0ZWRNb2RlbFJhbmdlLmdldEVuZFBvc2l0aW9uKCkpO1xuXHRcdHJldHVybiBuZXcgUmFuZ2UodmFsaWRWaWV3U3RhcnQubGluZU51bWJlciwgdmFsaWRWaWV3U3RhcnQuY29sdW1uLCB2YWxpZFZpZXdFbmQubGluZU51bWJlciwgdmFsaWRWaWV3RW5kLmNvbHVtbik7XG5cdH1cblxuXHRwdWJsaWMgY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbih2aWV3TGluZU51bWJlcjogbnVtYmVyLCB2aWV3Q29sdW1uOiBudW1iZXIpOiBQb3NpdGlvbiB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuZ2V0Vmlld0xpbmVJbmZvKHZpZXdMaW5lTnVtYmVyKTtcblxuXHRcdGNvbnN0IGlucHV0Q29sdW1uID0gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpbmZvLm1vZGVsTGluZU51bWJlciAtIDFdLmdldE1vZGVsQ29sdW1uT2ZWaWV3UG9zaXRpb24oaW5mby5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCwgdmlld0NvbHVtbik7XG5cdFx0Ly8gY29uc29sZS5sb2coJ291dCAtPiBpbiAnICsgdmlld0xpbmVOdW1iZXIgKyAnLCcgKyB2aWV3Q29sdW1uICsgJyA9PT0+ICcgKyAobGluZUluZGV4KzEpICsgJywnICsgaW5wdXRDb2x1bW4pO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKGluZm8ubW9kZWxMaW5lTnVtYmVyLCBpbnB1dENvbHVtbikpO1xuXHR9XG5cblx0cHVibGljIGNvbnZlcnRWaWV3UmFuZ2VUb01vZGVsUmFuZ2Uodmlld1JhbmdlOiBSYW5nZSk6IFJhbmdlIHtcblx0XHRjb25zdCBzdGFydCA9IHRoaXMuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbih2aWV3UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCB2aWV3UmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdGNvbnN0IGVuZCA9IHRoaXMuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbih2aWV3UmFuZ2UuZW5kTGluZU51bWJlciwgdmlld1JhbmdlLmVuZENvbHVtbik7XG5cdFx0cmV0dXJuIG5ldyBSYW5nZShzdGFydC5saW5lTnVtYmVyLCBzdGFydC5jb2x1bW4sIGVuZC5saW5lTnVtYmVyLCBlbmQuY29sdW1uKTtcblx0fVxuXG5cdHB1YmxpYyBjb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKF9tb2RlbExpbmVOdW1iZXI6IG51bWJlciwgX21vZGVsQ29sdW1uOiBudW1iZXIsIGFmZmluaXR5OiBQb3NpdGlvbkFmZmluaXR5ID0gUG9zaXRpb25BZmZpbml0eS5Ob25lLCBhbGxvd1plcm9MaW5lTnVtYmVyOiBib29sZWFuID0gZmFsc2UsIGJlbG93SGlkZGVuUmFuZ2VzOiBib29sZWFuID0gZmFsc2UpOiBQb3NpdGlvbiB7XG5cblx0XHRjb25zdCB2YWxpZFBvc2l0aW9uID0gdGhpcy5tb2RlbC52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbihfbW9kZWxMaW5lTnVtYmVyLCBfbW9kZWxDb2x1bW4pKTtcblx0XHRjb25zdCBpbnB1dExpbmVOdW1iZXIgPSB2YWxpZFBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0Y29uc3QgaW5wdXRDb2x1bW4gPSB2YWxpZFBvc2l0aW9uLmNvbHVtbjtcblxuXHRcdGxldCBsaW5lSW5kZXggPSBpbnB1dExpbmVOdW1iZXIgLSAxLCBsaW5lSW5kZXhDaGFuZ2VkID0gZmFsc2U7XG5cdFx0aWYgKGJlbG93SGlkZGVuUmFuZ2VzKSB7XG5cdFx0XHR3aGlsZSAobGluZUluZGV4IDwgdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9ucy5sZW5ndGggJiYgIXRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbbGluZUluZGV4XS5pc1Zpc2libGUoKSkge1xuXHRcdFx0XHRsaW5lSW5kZXgrKztcblx0XHRcdFx0bGluZUluZGV4Q2hhbmdlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdoaWxlIChsaW5lSW5kZXggPiAwICYmICF0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2xpbmVJbmRleF0uaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0bGluZUluZGV4LS07XG5cdFx0XHRcdGxpbmVJbmRleENoYW5nZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAobGluZUluZGV4ID09PSAwICYmICF0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2xpbmVJbmRleF0uaXNWaXNpYmxlKCkpIHtcblx0XHRcdC8vIENvdWxkIG5vdCByZWFjaCBhIHJlYWwgbGluZVxuXHRcdFx0Ly8gY29uc29sZS5sb2coJ2luIC0+IG91dCAnICsgaW5wdXRMaW5lTnVtYmVyICsgJywnICsgaW5wdXRDb2x1bW4gKyAnID09PT4gJyArIDEgKyAnLCcgKyAxKTtcblx0XHRcdC8vIFRPRE9AYWxleGRpbWFAaGVkaWV0IHRoaXMgaXNuJ3Qgc29vIHByZXR0eVxuXHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihhbGxvd1plcm9MaW5lTnVtYmVyID8gMCA6IDEsIDEpO1xuXHRcdH1cblx0XHRjb25zdCBkZWx0YUxpbmVOdW1iZXIgPSAxICsgdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldFByZWZpeFN1bShsaW5lSW5kZXgpO1xuXG5cdFx0bGV0IHI6IFBvc2l0aW9uO1xuXHRcdGlmIChsaW5lSW5kZXhDaGFuZ2VkKSB7XG5cdFx0XHRpZiAoYmVsb3dIaWRkZW5SYW5nZXMpIHtcblx0XHRcdFx0ciA9IHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbbGluZUluZGV4XS5nZXRWaWV3UG9zaXRpb25PZk1vZGVsUG9zaXRpb24oZGVsdGFMaW5lTnVtYmVyLCAxLCBhZmZpbml0eSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyID0gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tsaW5lSW5kZXhdLmdldFZpZXdQb3NpdGlvbk9mTW9kZWxQb3NpdGlvbihkZWx0YUxpbmVOdW1iZXIsIHRoaXMubW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lSW5kZXggKyAxKSwgYWZmaW5pdHkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyID0gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpbnB1dExpbmVOdW1iZXIgLSAxXS5nZXRWaWV3UG9zaXRpb25PZk1vZGVsUG9zaXRpb24oZGVsdGFMaW5lTnVtYmVyLCBpbnB1dENvbHVtbiwgYWZmaW5pdHkpO1xuXHRcdH1cblxuXHRcdC8vIGNvbnNvbGUubG9nKCdpbiAtPiBvdXQgJyArIGlucHV0TGluZU51bWJlciArICcsJyArIGlucHV0Q29sdW1uICsgJyA9PT0+ICcgKyByLmxpbmVOdW1iZXIgKyAnLCcgKyByKTtcblx0XHRyZXR1cm4gcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0gYWZmaW5pdHkgVGhlIGFmZmluaXR5IGluIGNhc2Ugb2YgYW4gZW1wdHkgcmFuZ2UuIEhhcyBubyBlZmZlY3QgZm9yIG5vbi1lbXB0eSByYW5nZXMuXG5cdCovXG5cdHB1YmxpYyBjb252ZXJ0TW9kZWxSYW5nZVRvVmlld1JhbmdlKG1vZGVsUmFuZ2U6IFJhbmdlLCBhZmZpbml0eTogUG9zaXRpb25BZmZpbml0eSA9IFBvc2l0aW9uQWZmaW5pdHkuTGVmdCk6IFJhbmdlIHtcblx0XHRpZiAobW9kZWxSYW5nZS5pc0VtcHR5KCkpIHtcblx0XHRcdGNvbnN0IHN0YXJ0ID0gdGhpcy5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKG1vZGVsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBtb2RlbFJhbmdlLnN0YXJ0Q29sdW1uLCBhZmZpbml0eSk7XG5cdFx0XHRyZXR1cm4gUmFuZ2UuZnJvbVBvc2l0aW9ucyhzdGFydCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHN0YXJ0ID0gdGhpcy5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKG1vZGVsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBtb2RlbFJhbmdlLnN0YXJ0Q29sdW1uLCBQb3NpdGlvbkFmZmluaXR5LlJpZ2h0KTtcblx0XHRcdGNvbnN0IGVuZCA9IHRoaXMuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihtb2RlbFJhbmdlLmVuZExpbmVOdW1iZXIsIG1vZGVsUmFuZ2UuZW5kQ29sdW1uLCBQb3NpdGlvbkFmZmluaXR5LkxlZnQpO1xuXHRcdFx0cmV0dXJuIG5ldyBSYW5nZShzdGFydC5saW5lTnVtYmVyLCBzdGFydC5jb2x1bW4sIGVuZC5saW5lTnVtYmVyLCBlbmQuY29sdW1uKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0Vmlld0xpbmVOdW1iZXJPZk1vZGVsUG9zaXRpb24obW9kZWxMaW5lTnVtYmVyOiBudW1iZXIsIG1vZGVsQ29sdW1uOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGxldCBsaW5lSW5kZXggPSBtb2RlbExpbmVOdW1iZXIgLSAxO1xuXHRcdGlmICh0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2xpbmVJbmRleF0uaXNWaXNpYmxlKCkpIHtcblx0XHRcdC8vIHRoaXMgbW9kZWwgbGluZSBpcyB2aXNpYmxlXG5cdFx0XHRjb25zdCBkZWx0YUxpbmVOdW1iZXIgPSAxICsgdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldFByZWZpeFN1bShsaW5lSW5kZXgpO1xuXHRcdFx0cmV0dXJuIHRoaXMubW9kZWxMaW5lUHJvamVjdGlvbnNbbGluZUluZGV4XS5nZXRWaWV3TGluZU51bWJlck9mTW9kZWxQb3NpdGlvbihkZWx0YUxpbmVOdW1iZXIsIG1vZGVsQ29sdW1uKTtcblx0XHR9XG5cblx0XHQvLyB0aGlzIG1vZGVsIGxpbmUgaXMgbm90IHZpc2libGVcblx0XHR3aGlsZSAobGluZUluZGV4ID4gMCAmJiAhdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tsaW5lSW5kZXhdLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRsaW5lSW5kZXgtLTtcblx0XHR9XG5cdFx0aWYgKGxpbmVJbmRleCA9PT0gMCAmJiAhdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tsaW5lSW5kZXhdLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHQvLyBDb3VsZCBub3QgcmVhY2ggYSByZWFsIGxpbmVcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblx0XHRjb25zdCBkZWx0YUxpbmVOdW1iZXIgPSAxICsgdGhpcy5wcm9qZWN0ZWRNb2RlbExpbmVMaW5lQ291bnRzLmdldFByZWZpeFN1bShsaW5lSW5kZXgpO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW2xpbmVJbmRleF0uZ2V0Vmlld0xpbmVOdW1iZXJPZk1vZGVsUG9zaXRpb24oZGVsdGFMaW5lTnVtYmVyLCB0aGlzLm1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZUluZGV4ICsgMSkpO1xuXHR9XG5cblx0cHVibGljIGdldERlY29yYXRpb25zSW5SYW5nZShyYW5nZTogUmFuZ2UsIG93bmVySWQ6IG51bWJlciwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiwgb25seU1pbmltYXBEZWNvcmF0aW9uczogYm9vbGVhbiwgb25seU1hcmdpbkRlY29yYXRpb25zOiBib29sZWFuKTogSU1vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRjb25zdCBtb2RlbFN0YXJ0ID0gdGhpcy5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdGNvbnN0IG1vZGVsRW5kID0gdGhpcy5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbik7XG5cblx0XHRpZiAobW9kZWxFbmQubGluZU51bWJlciAtIG1vZGVsU3RhcnQubGluZU51bWJlciA8PSByYW5nZS5lbmRMaW5lTnVtYmVyIC0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBtb3N0IGxpa2VseSB0aGVyZSBhcmUgbm8gaGlkZGVuIGxpbmVzID0+IGZhc3QgcGF0aFxuXHRcdFx0Ly8gZmV0Y2ggZGVjb3JhdGlvbnMgZnJvbSBjb2x1bW4gMSB0byBjb3ZlciB0aGUgY2FzZSBvZiB3cmFwcGVkIGxpbmVzIHRoYXQgaGF2ZSB3aG9sZSBsaW5lIGRlY29yYXRpb25zIGF0IGNvbHVtbiAxXG5cdFx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXREZWNvcmF0aW9uc0luUmFuZ2UobmV3IFJhbmdlKG1vZGVsU3RhcnQubGluZU51bWJlciwgMSwgbW9kZWxFbmQubGluZU51bWJlciwgbW9kZWxFbmQuY29sdW1uKSwgb3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb25seU1pbmltYXBEZWNvcmF0aW9ucywgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0OiBJTW9kZWxEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRjb25zdCBtb2RlbFN0YXJ0TGluZUluZGV4ID0gbW9kZWxTdGFydC5saW5lTnVtYmVyIC0gMTtcblx0XHRjb25zdCBtb2RlbEVuZExpbmVJbmRleCA9IG1vZGVsRW5kLmxpbmVOdW1iZXIgLSAxO1xuXG5cdFx0bGV0IHJlcVN0YXJ0OiBQb3NpdGlvbiB8IG51bGwgPSBudWxsO1xuXHRcdGZvciAobGV0IG1vZGVsTGluZUluZGV4ID0gbW9kZWxTdGFydExpbmVJbmRleDsgbW9kZWxMaW5lSW5kZXggPD0gbW9kZWxFbmRMaW5lSW5kZXg7IG1vZGVsTGluZUluZGV4KyspIHtcblx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLm1vZGVsTGluZVByb2plY3Rpb25zW21vZGVsTGluZUluZGV4XTtcblx0XHRcdGlmIChsaW5lLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdC8vIG1lcmdlIGludG8gcHJldmlvdXMgcmVxdWVzdFxuXHRcdFx0XHRpZiAocmVxU3RhcnQgPT09IG51bGwpIHtcblx0XHRcdFx0XHRyZXFTdGFydCA9IG5ldyBQb3NpdGlvbihtb2RlbExpbmVJbmRleCArIDEsIG1vZGVsTGluZUluZGV4ID09PSBtb2RlbFN0YXJ0TGluZUluZGV4ID8gbW9kZWxTdGFydC5jb2x1bW4gOiAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gaGl0IGludmlzaWJsZSBsaW5lID0+IGZsdXNoIHJlcXVlc3Rcblx0XHRcdFx0aWYgKHJlcVN0YXJ0ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0Y29uc3QgbWF4TGluZUNvbHVtbiA9IHRoaXMubW9kZWwuZ2V0TGluZU1heENvbHVtbihtb2RlbExpbmVJbmRleCk7XG5cdFx0XHRcdFx0cmVzdWx0ID0gcmVzdWx0LmNvbmNhdCh0aGlzLm1vZGVsLmdldERlY29yYXRpb25zSW5SYW5nZShuZXcgUmFuZ2UocmVxU3RhcnQubGluZU51bWJlciwgcmVxU3RhcnQuY29sdW1uLCBtb2RlbExpbmVJbmRleCwgbWF4TGluZUNvbHVtbiksIG93bmVySWQsIGZpbHRlck91dFZhbGlkYXRpb24sIG9ubHlNaW5pbWFwRGVjb3JhdGlvbnMpKTtcblx0XHRcdFx0XHRyZXFTdGFydCA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocmVxU3RhcnQgIT09IG51bGwpIHtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdC5jb25jYXQodGhpcy5tb2RlbC5nZXREZWNvcmF0aW9uc0luUmFuZ2UobmV3IFJhbmdlKHJlcVN0YXJ0LmxpbmVOdW1iZXIsIHJlcVN0YXJ0LmNvbHVtbiwgbW9kZWxFbmQubGluZU51bWJlciwgbW9kZWxFbmQuY29sdW1uKSwgb3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb25seU1pbmltYXBEZWNvcmF0aW9ucykpO1xuXHRcdFx0cmVxU3RhcnQgPSBudWxsO1xuXHRcdH1cblxuXHRcdHJlc3VsdC5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRjb25zdCByZXMgPSBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSk7XG5cdFx0XHRpZiAocmVzID09PSAwKSB7XG5cdFx0XHRcdGlmIChhLmlkIDwgYi5pZCkge1xuXHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYS5pZCA+IGIuaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXM7XG5cdFx0fSk7XG5cblx0XHQvLyBFbGltaW5hdGUgZHVwbGljYXRlIGRlY29yYXRpb25zIHRoYXQgbWlnaHQgaGF2ZSBpbnRlcnNlY3RlZCBvdXIgdmlzaWJsZSByYW5nZXMgbXVsdGlwbGUgdGltZXNcblx0XHRjb25zdCBmaW5hbFJlc3VsdDogSU1vZGVsRGVjb3JhdGlvbltdID0gW107XG5cdFx0bGV0IGZpbmFsUmVzdWx0TGVuID0gMDtcblx0XHRsZXQgcHJldkRlY0lkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRmb3IgKGNvbnN0IGRlYyBvZiByZXN1bHQpIHtcblx0XHRcdGNvbnN0IGRlY0lkID0gZGVjLmlkO1xuXHRcdFx0aWYgKHByZXZEZWNJZCA9PT0gZGVjSWQpIHtcblx0XHRcdFx0Ly8gc2tpcFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHByZXZEZWNJZCA9IGRlY0lkO1xuXHRcdFx0ZmluYWxSZXN1bHRbZmluYWxSZXN1bHRMZW4rK10gPSBkZWM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZpbmFsUmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldEluamVjdGVkVGV4dEF0KHBvc2l0aW9uOiBQb3NpdGlvbik6IEluamVjdGVkVGV4dCB8IG51bGwge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLmdldFZpZXdMaW5lSW5mbyhwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpbmZvLm1vZGVsTGluZU51bWJlciAtIDFdLmdldEluamVjdGVkVGV4dEF0KGluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHgsIHBvc2l0aW9uLmNvbHVtbik7XG5cdH1cblxuXHRub3JtYWxpemVQb3NpdGlvbihwb3NpdGlvbjogUG9zaXRpb24sIGFmZmluaXR5OiBQb3NpdGlvbkFmZmluaXR5KTogUG9zaXRpb24ge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLmdldFZpZXdMaW5lSW5mbyhwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbExpbmVQcm9qZWN0aW9uc1tpbmZvLm1vZGVsTGluZU51bWJlciAtIDFdLm5vcm1hbGl6ZVBvc2l0aW9uKGluZm8ubW9kZWxMaW5lV3JhcHBlZExpbmVJZHgsIHBvc2l0aW9uLCBhZmZpbml0eSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZUluZGVudENvbHVtbihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLmdldFZpZXdMaW5lSW5mbyhsaW5lTnVtYmVyKTtcblx0XHRpZiAoaW5mby5tb2RlbExpbmVXcmFwcGVkTGluZUlkeCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0TGluZUluZGVudENvbHVtbihpbmZvLm1vZGVsTGluZU51bWJlcik7XG5cdFx0fVxuXG5cdFx0Ly8gd3JhcHBlZCBsaW5lcyBoYXZlIG5vIGluZGVudGF0aW9uLlxuXHRcdC8vIFdlIGRlbGliZXJhdGVseSBkb24ndCBoYW5kbGUgdGhlIGNhc2UgdGhhdCBpbmRlbnRhdGlvbiBpcyB3cmFwcGVkXG5cdFx0Ly8gdG8gYXZvaWQgdHdvIHZpZXcgbGluZXMgcmVwb3J0aW5nIGluZGVudGF0aW9uIGZvciB0aGUgdmVyeSBzYW1lIG1vZGVsIGxpbmUuXG5cdFx0cmV0dXJuIDA7XG5cdH1cbn1cblxuLyoqXG4gKiBPdmVybGFwcGluZyB1bnNvcnRlZCByYW5nZXM6XG4gKiBbICAgKSAgICAgIFsgKSAgICAgICBbICApXG4gKiAgICBbICAgICkgICAgICBbICAgICAgIClcbiAqIC0+XG4gKiBOb24gb3ZlcmxhcHBpbmcgc29ydGVkIHJhbmdlczpcbiAqIFsgICAgICAgKSAgWyApIFsgICAgICAgIClcbiAqXG4gKiBOb3RlOiBUaGlzIGZ1bmN0aW9uIG9ubHkgY29uc2lkZXJzIGxpbmUgaW5mb3JtYXRpb24hIENvbHVtbnMgYXJlIGlnbm9yZWQuXG4qL1xuZnVuY3Rpb24gbm9ybWFsaXplTGluZVJhbmdlcyhyYW5nZXM6IFJhbmdlW10pOiBSYW5nZVtdIHtcblx0aWYgKHJhbmdlcy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRjb25zdCBzb3J0ZWRSYW5nZXMgPSByYW5nZXMuc2xpY2UoKTtcblx0c29ydGVkUmFuZ2VzLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblxuXHRjb25zdCByZXN1bHQ6IFJhbmdlW10gPSBbXTtcblx0bGV0IGN1cnJlbnRSYW5nZVN0YXJ0ID0gc29ydGVkUmFuZ2VzWzBdLnN0YXJ0TGluZU51bWJlcjtcblx0bGV0IGN1cnJlbnRSYW5nZUVuZCA9IHNvcnRlZFJhbmdlc1swXS5lbmRMaW5lTnVtYmVyO1xuXG5cdGZvciAobGV0IGkgPSAxLCBsZW4gPSBzb3J0ZWRSYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRjb25zdCByYW5nZSA9IHNvcnRlZFJhbmdlc1tpXTtcblxuXHRcdGlmIChyYW5nZS5zdGFydExpbmVOdW1iZXIgPiBjdXJyZW50UmFuZ2VFbmQgKyAxKSB7XG5cdFx0XHRyZXN1bHQucHVzaChuZXcgUmFuZ2UoY3VycmVudFJhbmdlU3RhcnQsIDEsIGN1cnJlbnRSYW5nZUVuZCwgMSkpO1xuXHRcdFx0Y3VycmVudFJhbmdlU3RhcnQgPSByYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRjdXJyZW50UmFuZ2VFbmQgPSByYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdH0gZWxzZSBpZiAocmFuZ2UuZW5kTGluZU51bWJlciA+IGN1cnJlbnRSYW5nZUVuZCkge1xuXHRcdFx0Y3VycmVudFJhbmdlRW5kID0gcmFuZ2UuZW5kTGluZU51bWJlcjtcblx0XHR9XG5cdH1cblx0cmVzdWx0LnB1c2gobmV3IFJhbmdlKGN1cnJlbnRSYW5nZVN0YXJ0LCAxLCBjdXJyZW50UmFuZ2VFbmQsIDEpKTtcblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgdmlldyBsaW5lLiBDYW4gYmUgdXNlZCB0byBlZmZpY2llbnRseSBxdWVyeSBtb3JlIGluZm9ybWF0aW9uIGFib3V0IGl0LlxuICovXG5jbGFzcyBWaWV3TGluZUluZm8ge1xuXHRwdWJsaWMgZ2V0IGlzV3JhcHBlZExpbmVDb250aW51YXRpb24oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWxMaW5lV3JhcHBlZExpbmVJZHggPiAwO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG1vZGVsTGluZU51bWJlcjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBtb2RlbExpbmVXcmFwcGVkTGluZUlkeDogbnVtYmVyLFxuXHQpIHsgfVxufVxuXG4vKipcbiAqIEEgbGlzdCBvZiB2aWV3IGxpbmVzIHRoYXQgaGF2ZSBhIGNvbnRpZ3VvdXMgc3BhbiBpbiB0aGUgbW9kZWwuXG4qL1xuY2xhc3MgVmlld0xpbmVJbmZvR3JvdXBlZEJ5TW9kZWxSYW5nZSB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBtb2RlbFJhbmdlOiBSYW5nZSwgcHVibGljIHJlYWRvbmx5IHZpZXdMaW5lczogVmlld0xpbmVJbmZvW10pIHtcblx0fVxufVxuXG5jbGFzcyBDb29yZGluYXRlc0NvbnZlcnRlciBpbXBsZW1lbnRzIElDb29yZGluYXRlc0NvbnZlcnRlciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVzOiBWaWV3TW9kZWxMaW5lc0Zyb21Qcm9qZWN0ZWRNb2RlbDtcblxuXHRjb25zdHJ1Y3RvcihsaW5lczogVmlld01vZGVsTGluZXNGcm9tUHJvamVjdGVkTW9kZWwpIHtcblx0XHR0aGlzLl9saW5lcyA9IGxpbmVzO1xuXHR9XG5cblx0Ly8gVmlldyAtPiBNb2RlbCBjb252ZXJzaW9uIGFuZCByZWxhdGVkIG1ldGhvZHNcblxuXHRwdWJsaWMgY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbih2aWV3UG9zaXRpb246IFBvc2l0aW9uKTogUG9zaXRpb24ge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKHZpZXdQb3NpdGlvbi5saW5lTnVtYmVyLCB2aWV3UG9zaXRpb24uY29sdW1uKTtcblx0fVxuXG5cdHB1YmxpYyBjb252ZXJ0Vmlld1JhbmdlVG9Nb2RlbFJhbmdlKHZpZXdSYW5nZTogUmFuZ2UpOiBSYW5nZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLmNvbnZlcnRWaWV3UmFuZ2VUb01vZGVsUmFuZ2Uodmlld1JhbmdlKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZVZpZXdQb3NpdGlvbih2aWV3UG9zaXRpb246IFBvc2l0aW9uLCBleHBlY3RlZE1vZGVsUG9zaXRpb246IFBvc2l0aW9uKTogUG9zaXRpb24ge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy52YWxpZGF0ZVZpZXdQb3NpdGlvbih2aWV3UG9zaXRpb24ubGluZU51bWJlciwgdmlld1Bvc2l0aW9uLmNvbHVtbiwgZXhwZWN0ZWRNb2RlbFBvc2l0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZVZpZXdSYW5nZSh2aWV3UmFuZ2U6IFJhbmdlLCBleHBlY3RlZE1vZGVsUmFuZ2U6IFJhbmdlKTogUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy52YWxpZGF0ZVZpZXdSYW5nZSh2aWV3UmFuZ2UsIGV4cGVjdGVkTW9kZWxSYW5nZSk7XG5cdH1cblxuXHQvLyBNb2RlbCAtPiBWaWV3IGNvbnZlcnNpb24gYW5kIHJlbGF0ZWQgbWV0aG9kc1xuXG5cdHB1YmxpYyBjb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKG1vZGVsUG9zaXRpb246IFBvc2l0aW9uLCBhZmZpbml0eT86IFBvc2l0aW9uQWZmaW5pdHksIGFsbG93WmVybz86IGJvb2xlYW4sIGJlbG93SGlkZGVuUmFuZ2VzPzogYm9vbGVhbik6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihtb2RlbFBvc2l0aW9uLmxpbmVOdW1iZXIsIG1vZGVsUG9zaXRpb24uY29sdW1uLCBhZmZpbml0eSwgYWxsb3daZXJvLCBiZWxvd0hpZGRlblJhbmdlcyk7XG5cdH1cblxuXHRwdWJsaWMgY29udmVydE1vZGVsUmFuZ2VUb1ZpZXdSYW5nZShtb2RlbFJhbmdlOiBSYW5nZSwgYWZmaW5pdHk/OiBQb3NpdGlvbkFmZmluaXR5KTogUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy5jb252ZXJ0TW9kZWxSYW5nZVRvVmlld1JhbmdlKG1vZGVsUmFuZ2UsIGFmZmluaXR5KTtcblx0fVxuXG5cdHB1YmxpYyBtb2RlbFBvc2l0aW9uSXNWaXNpYmxlKG1vZGVsUG9zaXRpb246IFBvc2l0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLm1vZGVsUG9zaXRpb25Jc1Zpc2libGUobW9kZWxQb3NpdGlvbi5saW5lTnVtYmVyLCBtb2RlbFBvc2l0aW9uLmNvbHVtbik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TW9kZWxMaW5lVmlld0xpbmVDb3VudChtb2RlbExpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLmdldE1vZGVsTGluZVZpZXdMaW5lQ291bnQobW9kZWxMaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZU51bWJlck9mTW9kZWxQb3NpdGlvbihtb2RlbExpbmVOdW1iZXI6IG51bWJlciwgbW9kZWxDb2x1bW46IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLmdldFZpZXdMaW5lTnVtYmVyT2ZNb2RlbFBvc2l0aW9uKG1vZGVsTGluZU51bWJlciwgbW9kZWxDb2x1bW4pO1xuXHR9XG59XG5cbmNvbnN0IGVudW0gSW5kZW50R3VpZGVSZXBlYXRPcHRpb24ge1xuXHRCbG9ja05vbmUgPSAwLFxuXHRCbG9ja1N1YnNlcXVlbnQgPSAxLFxuXHRCbG9ja0FsbCA9IDJcbn1cblxuZXhwb3J0IGNsYXNzIFZpZXdNb2RlbExpbmVzRnJvbU1vZGVsQXNJcyBpbXBsZW1lbnRzIElWaWV3TW9kZWxMaW5lcyB7XG5cdHB1YmxpYyByZWFkb25seSBtb2RlbDogSVRleHRNb2RlbDtcblxuXHRjb25zdHJ1Y3Rvcihtb2RlbDogSVRleHRNb2RlbCkge1xuXHRcdHRoaXMubW9kZWwgPSBtb2RlbDtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZUNvb3JkaW5hdGVzQ29udmVydGVyKCk6IElDb29yZGluYXRlc0NvbnZlcnRlciB7XG5cdFx0cmV0dXJuIG5ldyBJZGVudGl0eUNvb3JkaW5hdGVzQ29udmVydGVyKHRoaXMpO1xuXHR9XG5cblx0cHVibGljIGdldEhpZGRlbkFyZWFzKCk6IFJhbmdlW10ge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHB1YmxpYyBzZXRIaWRkZW5BcmVhcyhfcmFuZ2VzOiBSYW5nZVtdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIHNldFRhYlNpemUoX25ld1RhYlNpemU6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBzZXRXcmFwcGluZ1NldHRpbmdzKF9mb250SW5mbzogRm9udEluZm8sIF93cmFwcGluZ1N0cmF0ZWd5OiAnc2ltcGxlJyB8ICdhZHZhbmNlZCcsIF93cmFwcGluZ0NvbHVtbjogbnVtYmVyLCBfd3JhcHBpbmdJbmRlbnQ6IFdyYXBwaW5nSW5kZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZUxpbmVCcmVha3NDb21wdXRlcigpOiBJTGluZUJyZWFrc0NvbXB1dGVyIHtcblx0XHRjb25zdCByZXN1bHQ6IG51bGxbXSA9IFtdO1xuXHRcdHJldHVybiB7XG5cdFx0XHRhZGRSZXF1ZXN0OiAobGluZVRleHQ6IHN0cmluZywgaW5qZWN0ZWRUZXh0OiBMaW5lSW5qZWN0ZWRUZXh0W10gfCBudWxsLCBwcmV2aW91c0xpbmVCcmVha0RhdGE6IE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbCkgPT4ge1xuXHRcdFx0XHRyZXN1bHQucHVzaChudWxsKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5hbGl6ZTogKCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgb25Nb2RlbEZsdXNoZWQoKTogdm9pZCB7XG5cdH1cblxuXHRwdWJsaWMgb25Nb2RlbExpbmVzRGVsZXRlZChfdmVyc2lvbklkOiBudW1iZXIgfCBudWxsLCBmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlcik6IHZpZXdFdmVudHMuVmlld0xpbmVzRGVsZXRlZEV2ZW50IHwgbnVsbCB7XG5cdFx0cmV0dXJuIG5ldyB2aWV3RXZlbnRzLlZpZXdMaW5lc0RlbGV0ZWRFdmVudChmcm9tTGluZU51bWJlciwgdG9MaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBvbk1vZGVsTGluZXNJbnNlcnRlZChfdmVyc2lvbklkOiBudW1iZXIgfCBudWxsLCBmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlciwgbGluZUJyZWFrczogKE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbClbXSk6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCB8IG51bGwge1xuXHRcdHJldHVybiBuZXcgdmlld0V2ZW50cy5WaWV3TGluZXNJbnNlcnRlZEV2ZW50KGZyb21MaW5lTnVtYmVyLCB0b0xpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIG9uTW9kZWxMaW5lQ2hhbmdlZChfdmVyc2lvbklkOiBudW1iZXIgfCBudWxsLCBsaW5lTnVtYmVyOiBudW1iZXIsIGxpbmVCcmVha0RhdGE6IE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHwgbnVsbCk6IFtib29sZWFuLCB2aWV3RXZlbnRzLlZpZXdMaW5lc0NoYW5nZWRFdmVudCB8IG51bGwsIHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCB8IG51bGwsIHZpZXdFdmVudHMuVmlld0xpbmVzRGVsZXRlZEV2ZW50IHwgbnVsbF0ge1xuXHRcdHJldHVybiBbZmFsc2UsIG5ldyB2aWV3RXZlbnRzLlZpZXdMaW5lc0NoYW5nZWRFdmVudChsaW5lTnVtYmVyLCAxKSwgbnVsbCwgbnVsbF07XG5cdH1cblxuXHRwdWJsaWMgYWNjZXB0VmVyc2lvbklkKF92ZXJzaW9uSWQ6IG51bWJlcik6IHZvaWQge1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBY3RpdmVJbmRlbnRHdWlkZSh2aWV3TGluZU51bWJlcjogbnVtYmVyLCBfbWluTGluZU51bWJlcjogbnVtYmVyLCBfbWF4TGluZU51bWJlcjogbnVtYmVyKTogSUFjdGl2ZUluZGVudEd1aWRlSW5mbyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogdmlld0xpbmVOdW1iZXIsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiB2aWV3TGluZU51bWJlcixcblx0XHRcdGluZGVudDogMFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgZ2V0Vmlld0xpbmVzQnJhY2tldEd1aWRlcyhzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyLCBhY3RpdmVQb3NpdGlvbjogSVBvc2l0aW9uIHwgbnVsbCk6IEluZGVudEd1aWRlW11bXSB7XG5cdFx0cmV0dXJuIG5ldyBBcnJheShlbmRMaW5lTnVtYmVyIC0gc3RhcnRMaW5lTnVtYmVyICsgMSkuZmlsbChbXSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKHZpZXdTdGFydExpbmVOdW1iZXI6IG51bWJlciwgdmlld0VuZExpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlcltdIHtcblx0XHRjb25zdCB2aWV3TGluZUNvdW50ID0gdmlld0VuZExpbmVOdW1iZXIgLSB2aWV3U3RhcnRMaW5lTnVtYmVyICsgMTtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgQXJyYXk8bnVtYmVyPih2aWV3TGluZUNvdW50KTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHZpZXdMaW5lQ291bnQ7IGkrKykge1xuXHRcdFx0cmVzdWx0W2ldID0gMDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZUNvbnRlbnQodmlld0xpbmVOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0TGluZUNvbnRlbnQodmlld0xpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lTGVuZ3RoKHZpZXdMaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldExpbmVMZW5ndGgodmlld0xpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lTWluQ29sdW1uKHZpZXdMaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldExpbmVNaW5Db2x1bW4odmlld0xpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lTWF4Q29sdW1uKHZpZXdMaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldExpbmVNYXhDb2x1bW4odmlld0xpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lRGF0YSh2aWV3TGluZU51bWJlcjogbnVtYmVyKTogVmlld0xpbmVEYXRhIHtcblx0XHRjb25zdCBsaW5lVG9rZW5zID0gdGhpcy5tb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2Vucyh2aWV3TGluZU51bWJlcik7XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBsaW5lVG9rZW5zLmdldExpbmVDb250ZW50KCk7XG5cdFx0cmV0dXJuIG5ldyBWaWV3TGluZURhdGEoXG5cdFx0XHRsaW5lQ29udGVudCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MSxcblx0XHRcdGxpbmVDb250ZW50Lmxlbmd0aCArIDEsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVRva2Vucy5pbmZsYXRlKCksXG5cdFx0XHRudWxsXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZXNEYXRhKHZpZXdTdGFydExpbmVOdW1iZXI6IG51bWJlciwgdmlld0VuZExpbmVOdW1iZXI6IG51bWJlciwgbmVlZGVkOiBib29sZWFuW10pOiBBcnJheTxWaWV3TGluZURhdGEgfCBudWxsPiB7XG5cdFx0Y29uc3QgbGluZUNvdW50ID0gdGhpcy5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHR2aWV3U3RhcnRMaW5lTnVtYmVyID0gTWF0aC5taW4oTWF0aC5tYXgoMSwgdmlld1N0YXJ0TGluZU51bWJlciksIGxpbmVDb3VudCk7XG5cdFx0dmlld0VuZExpbmVOdW1iZXIgPSBNYXRoLm1pbihNYXRoLm1heCgxLCB2aWV3RW5kTGluZU51bWJlciksIGxpbmVDb3VudCk7XG5cblx0XHRjb25zdCByZXN1bHQ6IEFycmF5PFZpZXdMaW5lRGF0YSB8IG51bGw+ID0gW107XG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IHZpZXdTdGFydExpbmVOdW1iZXI7IGxpbmVOdW1iZXIgPD0gdmlld0VuZExpbmVOdW1iZXI7IGxpbmVOdW1iZXIrKykge1xuXHRcdFx0Y29uc3QgaWR4ID0gbGluZU51bWJlciAtIHZpZXdTdGFydExpbmVOdW1iZXI7XG5cdFx0XHRyZXN1bHRbaWR4XSA9IG5lZWRlZFtpZHhdID8gdGhpcy5nZXRWaWV3TGluZURhdGEobGluZU51bWJlcikgOiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RGVjb3JhdGlvbnNJblJhbmdlKHJhbmdlOiBSYW5nZSwgb3duZXJJZDogbnVtYmVyLCBmaWx0ZXJPdXRWYWxpZGF0aW9uOiBib29sZWFuLCBvbmx5TWluaW1hcERlY29yYXRpb25zOiBib29sZWFuLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnM6IGJvb2xlYW4pOiBJTW9kZWxEZWNvcmF0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldERlY29yYXRpb25zSW5SYW5nZShyYW5nZSwgb3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb25seU1pbmltYXBEZWNvcmF0aW9ucywgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0fVxuXG5cdG5vcm1hbGl6ZVBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbiwgYWZmaW5pdHk6IFBvc2l0aW9uQWZmaW5pdHkpOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwubm9ybWFsaXplUG9zaXRpb24ocG9zaXRpb24sIGFmZmluaXR5KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lSW5kZW50Q29sdW1uKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0TGluZUluZGVudENvbHVtbihsaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRJbmplY3RlZFRleHRBdChwb3NpdGlvbjogUG9zaXRpb24pOiBJbmplY3RlZFRleHQgfCBudWxsIHtcblx0XHQvLyBJZGVudGl0eSBsaW5lcyBjb2xsZWN0aW9uIGRvZXMgbm90IHN1cHBvcnQgaW5qZWN0ZWQgdGV4dC5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG5jbGFzcyBJZGVudGl0eUNvb3JkaW5hdGVzQ29udmVydGVyIGltcGxlbWVudHMgSUNvb3JkaW5hdGVzQ29udmVydGVyIHtcblx0cHJpdmF0ZSByZWFkb25seSBfbGluZXM6IFZpZXdNb2RlbExpbmVzRnJvbU1vZGVsQXNJcztcblxuXHRjb25zdHJ1Y3RvcihsaW5lczogVmlld01vZGVsTGluZXNGcm9tTW9kZWxBc0lzKSB7XG5cdFx0dGhpcy5fbGluZXMgPSBsaW5lcztcblx0fVxuXG5cdHByaXZhdGUgX3ZhbGlkUG9zaXRpb24ocG9zOiBQb3NpdGlvbik6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMubW9kZWwudmFsaWRhdGVQb3NpdGlvbihwb3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdmFsaWRSYW5nZShyYW5nZTogUmFuZ2UpOiBSYW5nZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLm1vZGVsLnZhbGlkYXRlUmFuZ2UocmFuZ2UpO1xuXHR9XG5cblx0Ly8gVmlldyAtPiBNb2RlbCBjb252ZXJzaW9uIGFuZCByZWxhdGVkIG1ldGhvZHNcblxuXHRwdWJsaWMgY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbih2aWV3UG9zaXRpb246IFBvc2l0aW9uKTogUG9zaXRpb24ge1xuXHRcdHJldHVybiB0aGlzLl92YWxpZFBvc2l0aW9uKHZpZXdQb3NpdGlvbik7XG5cdH1cblxuXHRwdWJsaWMgY29udmVydFZpZXdSYW5nZVRvTW9kZWxSYW5nZSh2aWV3UmFuZ2U6IFJhbmdlKTogUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLl92YWxpZFJhbmdlKHZpZXdSYW5nZSk7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGVWaWV3UG9zaXRpb24oX3ZpZXdQb3NpdGlvbjogUG9zaXRpb24sIGV4cGVjdGVkTW9kZWxQb3NpdGlvbjogUG9zaXRpb24pOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbGlkUG9zaXRpb24oZXhwZWN0ZWRNb2RlbFBvc2l0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZVZpZXdSYW5nZShfdmlld1JhbmdlOiBSYW5nZSwgZXhwZWN0ZWRNb2RlbFJhbmdlOiBSYW5nZSk6IFJhbmdlIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsaWRSYW5nZShleHBlY3RlZE1vZGVsUmFuZ2UpO1xuXHR9XG5cblx0Ly8gTW9kZWwgLT4gVmlldyBjb252ZXJzaW9uIGFuZCByZWxhdGVkIG1ldGhvZHNcblxuXHRwdWJsaWMgY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihtb2RlbFBvc2l0aW9uOiBQb3NpdGlvbik6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsaWRQb3NpdGlvbihtb2RlbFBvc2l0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyBjb252ZXJ0TW9kZWxSYW5nZVRvVmlld1JhbmdlKG1vZGVsUmFuZ2U6IFJhbmdlKTogUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLl92YWxpZFJhbmdlKG1vZGVsUmFuZ2UpO1xuXHR9XG5cblx0cHVibGljIG1vZGVsUG9zaXRpb25Jc1Zpc2libGUobW9kZWxQb3NpdGlvbjogUG9zaXRpb24pOiBib29sZWFuIHtcblx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLl9saW5lcy5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRpZiAobW9kZWxQb3NpdGlvbi5saW5lTnVtYmVyIDwgMSB8fCBtb2RlbFBvc2l0aW9uLmxpbmVOdW1iZXIgPiBsaW5lQ291bnQpIHtcblx0XHRcdC8vIGludmFsaWQgYXJndW1lbnRzXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG1vZGVsUmFuZ2VJc1Zpc2libGUobW9kZWxSYW5nZTogUmFuZ2UpOiBib29sZWFuIHtcblx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLl9saW5lcy5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRpZiAobW9kZWxSYW5nZS5zdGFydExpbmVOdW1iZXIgPCAxIHx8IG1vZGVsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID4gbGluZUNvdW50KSB7XG5cdFx0XHQvLyBpbnZhbGlkIGFyZ3VtZW50c1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAobW9kZWxSYW5nZS5lbmRMaW5lTnVtYmVyIDwgMSB8fCBtb2RlbFJhbmdlLmVuZExpbmVOdW1iZXIgPiBsaW5lQ291bnQpIHtcblx0XHRcdC8vIGludmFsaWQgYXJndW1lbnRzXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGdldE1vZGVsTGluZVZpZXdMaW5lQ291bnQobW9kZWxMaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiAxO1xuXHR9XG5cblx0cHVibGljIGdldFZpZXdMaW5lTnVtYmVyT2ZNb2RlbFBvc2l0aW9uKG1vZGVsTGluZU51bWJlcjogbnVtYmVyLCBtb2RlbENvbHVtbjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gbW9kZWxMaW5lTnVtYmVyO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFlBQVk7QUFJeEIsU0FBb0IsZ0JBQWdCO0FBQ3BDLFNBQVMsYUFBYTtBQUN0QixTQUE4RCx3QkFBd0I7QUFDdEYsU0FBc0QsYUFBYSxpQ0FBaUM7QUFDcEcsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyx3QkFBd0I7QUFDakMsWUFBWSxnQkFBZ0I7QUFDNUIsU0FBUyxpQ0FBdUQ7QUFFaEUsU0FBUyxxQ0FBcUM7QUFD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QUMzQztBQUFBO0FBQUEsRUFJTyxtQ0FBbUMsZUFBbUM7QUFDNUUsV0FBTyxLQUFLLGVBQWUsYUFBYTtBQUFBLEVBQ3pDO0FBQUEsRUFFTyw2QkFBNkIsWUFBMEI7QUFDN0QsV0FBTyxLQUFLLFlBQVksVUFBVTtBQUFBLEVBQ25DO0FBQUEsRUFFTyx1QkFBdUIsZUFBa0M7QUFDL0QsVUFBTSxZQUFZLEtBQUssT0FBTyxNQUFNLGFBQWE7QUFDakQsUUFBSSxjQUFjLGFBQWEsS0FBSyxjQUFjLGFBQWEsV0FBVztBQUV6RSxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxvQkFBb0IsWUFBNEI7QUFDdEQsVUFBTSxZQUFZLEtBQUssT0FBTyxNQUFNLGFBQWE7QUFDakQsUUFBSSxXQUFXLGtCQUFrQixLQUFLLFdBQVcsa0JBQWtCLFdBQVc7QUFFN0UsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLFdBQVcsZ0JBQWdCLEtBQUssV0FBVyxnQkFBZ0IsV0FBVztBQUV6RSxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTywwQkFBMEIsaUJBQWlDO0FBQ2pFLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxpQ0FBaUMsaUJBQXlCLGFBQTZCO0FBQzdGLFdBQU87QUFBQSxFQUNSO0FBQ0Q7IiwKICAibmFtZXMiOiBbInAiLCAiZGVsdGFMaW5lTnVtYmVyIiwgIkluZGVudEd1aWRlUmVwZWF0T3B0aW9uIl0KfQo=
