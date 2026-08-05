import * as types from "../../../base/common/types.js";
import { CursorState, SelectionStartKind, SingleCursorState } from "../cursorCommon.js";
import { MoveOperations } from "./cursorMoveOperations.js";
import { WordOperations } from "./cursorWordOperations.js";
import { Position } from "../core/position.js";
import { Range } from "../core/range.js";
class CursorMoveCommands {
  static addCursorDown(viewModel, cursors, useLogicalLine) {
    const result = [];
    let resultLen = 0;
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[resultLen++] = new CursorState(cursor.modelState, cursor.viewState);
      if (useLogicalLine) {
        result[resultLen++] = CursorState.fromModelState(MoveOperations.translateDown(viewModel.cursorConfig, viewModel.model, cursor.modelState));
      } else {
        result[resultLen++] = CursorState.fromViewState(MoveOperations.translateDown(viewModel.cursorConfig, viewModel, cursor.viewState));
      }
    }
    return result;
  }
  static addCursorUp(viewModel, cursors, useLogicalLine) {
    const result = [];
    let resultLen = 0;
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[resultLen++] = new CursorState(cursor.modelState, cursor.viewState);
      if (useLogicalLine) {
        result[resultLen++] = CursorState.fromModelState(MoveOperations.translateUp(viewModel.cursorConfig, viewModel.model, cursor.modelState));
      } else {
        result[resultLen++] = CursorState.fromViewState(MoveOperations.translateUp(viewModel.cursorConfig, viewModel, cursor.viewState));
      }
    }
    return result;
  }
  static moveToBeginningOfLine(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = this._moveToLineStart(viewModel, cursor, inSelectionMode);
    }
    return result;
  }
  static _moveToLineStart(viewModel, cursor, inSelectionMode) {
    const currentViewStateColumn = cursor.viewState.position.column;
    const currentModelStateColumn = cursor.modelState.position.column;
    const isFirstLineOfWrappedLine = currentViewStateColumn === currentModelStateColumn;
    const currentViewStatelineNumber = cursor.viewState.position.lineNumber;
    const firstNonBlankColumn = viewModel.getLineFirstNonWhitespaceColumn(currentViewStatelineNumber);
    const isBeginningOfViewLine = currentViewStateColumn === firstNonBlankColumn;
    if (!isFirstLineOfWrappedLine && !isBeginningOfViewLine) {
      return this._moveToLineStartByView(viewModel, cursor, inSelectionMode);
    } else {
      return this._moveToLineStartByModel(viewModel, cursor, inSelectionMode);
    }
  }
  static _moveToLineStartByView(viewModel, cursor, inSelectionMode) {
    return CursorState.fromViewState(
      MoveOperations.moveToBeginningOfLine(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode)
    );
  }
  static _moveToLineStartByModel(viewModel, cursor, inSelectionMode) {
    return CursorState.fromModelState(
      MoveOperations.moveToBeginningOfLine(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode)
    );
  }
  static moveToEndOfLine(viewModel, cursors, inSelectionMode, sticky) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = this._moveToLineEnd(viewModel, cursor, inSelectionMode, sticky);
    }
    return result;
  }
  static _moveToLineEnd(viewModel, cursor, inSelectionMode, sticky) {
    const viewStatePosition = cursor.viewState.position;
    const viewModelMaxColumn = viewModel.getLineMaxColumn(viewStatePosition.lineNumber);
    const isEndOfViewLine = viewStatePosition.column === viewModelMaxColumn;
    const modelStatePosition = cursor.modelState.position;
    const modelMaxColumn = viewModel.model.getLineMaxColumn(modelStatePosition.lineNumber);
    const isEndLineOfWrappedLine = viewModelMaxColumn - viewStatePosition.column === modelMaxColumn - modelStatePosition.column;
    if (isEndOfViewLine || isEndLineOfWrappedLine) {
      return this._moveToLineEndByModel(viewModel, cursor, inSelectionMode, sticky);
    } else {
      return this._moveToLineEndByView(viewModel, cursor, inSelectionMode, sticky);
    }
  }
  static _moveToLineEndByView(viewModel, cursor, inSelectionMode, sticky) {
    return CursorState.fromViewState(
      MoveOperations.moveToEndOfLine(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, sticky)
    );
  }
  static _moveToLineEndByModel(viewModel, cursor, inSelectionMode, sticky) {
    return CursorState.fromModelState(
      MoveOperations.moveToEndOfLine(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode, sticky)
    );
  }
  static expandLineSelection(viewModel, cursors) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const startLineNumber = cursor.modelState.selection.startLineNumber;
      const lineCount = viewModel.model.getLineCount();
      let endLineNumber = cursor.modelState.selection.endLineNumber;
      let endColumn;
      if (endLineNumber === lineCount) {
        endColumn = viewModel.model.getLineMaxColumn(lineCount);
      } else {
        endLineNumber++;
        endColumn = 1;
      }
      result[i] = CursorState.fromModelState(new SingleCursorState(
        new Range(startLineNumber, 1, startLineNumber, 1),
        SelectionStartKind.Simple,
        0,
        new Position(endLineNumber, endColumn),
        0
      ));
    }
    return result;
  }
  static moveToBeginningOfBuffer(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = CursorState.fromModelState(MoveOperations.moveToBeginningOfBuffer(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode));
    }
    return result;
  }
  static moveToEndOfBuffer(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = CursorState.fromModelState(MoveOperations.moveToEndOfBuffer(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode));
    }
    return result;
  }
  static selectAll(viewModel, cursor) {
    const lineCount = viewModel.model.getLineCount();
    const maxColumn = viewModel.model.getLineMaxColumn(lineCount);
    return CursorState.fromModelState(new SingleCursorState(
      new Range(1, 1, 1, 1),
      SelectionStartKind.Simple,
      0,
      new Position(lineCount, maxColumn),
      0
    ));
  }
  static line(viewModel, cursor, inSelectionMode, _position, _viewPosition) {
    const position = viewModel.model.validatePosition(_position);
    const viewPosition = _viewPosition ? viewModel.coordinatesConverter.validateViewPosition(new Position(_viewPosition.lineNumber, _viewPosition.column), position) : viewModel.coordinatesConverter.convertModelPositionToViewPosition(position);
    if (!inSelectionMode) {
      const lineCount = viewModel.model.getLineCount();
      let selectToLineNumber = position.lineNumber + 1;
      let selectToColumn = 1;
      if (selectToLineNumber > lineCount) {
        selectToLineNumber = lineCount;
        selectToColumn = viewModel.model.getLineMaxColumn(selectToLineNumber);
      }
      return CursorState.fromModelState(new SingleCursorState(
        new Range(position.lineNumber, 1, selectToLineNumber, selectToColumn),
        SelectionStartKind.Line,
        0,
        new Position(selectToLineNumber, selectToColumn),
        0
      ));
    }
    const enteringLineNumber = cursor.modelState.selectionStart.getStartPosition().lineNumber;
    if (position.lineNumber < enteringLineNumber) {
      return CursorState.fromViewState(cursor.viewState.move(
        true,
        viewPosition.lineNumber,
        1,
        0
      ));
    } else if (position.lineNumber > enteringLineNumber) {
      const lineCount = viewModel.getLineCount();
      let selectToViewLineNumber = viewPosition.lineNumber + 1;
      let selectToViewColumn = 1;
      if (selectToViewLineNumber > lineCount) {
        selectToViewLineNumber = lineCount;
        selectToViewColumn = viewModel.getLineMaxColumn(selectToViewLineNumber);
      }
      return CursorState.fromViewState(cursor.viewState.move(
        true,
        selectToViewLineNumber,
        selectToViewColumn,
        0
      ));
    } else {
      const endPositionOfSelectionStart = cursor.modelState.selectionStart.getEndPosition();
      return CursorState.fromModelState(cursor.modelState.move(
        true,
        endPositionOfSelectionStart.lineNumber,
        endPositionOfSelectionStart.column,
        0
      ));
    }
  }
  static word(viewModel, cursor, inSelectionMode, _position) {
    const position = viewModel.model.validatePosition(_position);
    return CursorState.fromModelState(WordOperations.word(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode, position));
  }
  static cancelSelection(viewModel, cursor) {
    if (!cursor.modelState.hasSelection()) {
      return new CursorState(cursor.modelState, cursor.viewState);
    }
    const lineNumber = cursor.viewState.position.lineNumber;
    const column = cursor.viewState.position.column;
    return CursorState.fromViewState(new SingleCursorState(
      new Range(lineNumber, column, lineNumber, column),
      SelectionStartKind.Simple,
      0,
      new Position(lineNumber, column),
      0
    ));
  }
  static moveTo(viewModel, cursor, inSelectionMode, _position, _viewPosition) {
    if (inSelectionMode) {
      if (cursor.modelState.selectionStartKind === SelectionStartKind.Word) {
        return this.word(viewModel, cursor, inSelectionMode, _position);
      }
      if (cursor.modelState.selectionStartKind === SelectionStartKind.Line) {
        return this.line(viewModel, cursor, inSelectionMode, _position, _viewPosition);
      }
    }
    const position = viewModel.model.validatePosition(_position);
    const viewPosition = _viewPosition ? viewModel.coordinatesConverter.validateViewPosition(new Position(_viewPosition.lineNumber, _viewPosition.column), position) : viewModel.coordinatesConverter.convertModelPositionToViewPosition(position);
    return CursorState.fromViewState(cursor.viewState.move(inSelectionMode, viewPosition.lineNumber, viewPosition.column, 0));
  }
  static simpleMove(viewModel, cursors, direction, inSelectionMode, value, unit) {
    switch (direction) {
      case CursorMove.Direction.Left: {
        if (unit === CursorMove.Unit.HalfLine) {
          return this._moveHalfLineLeft(viewModel, cursors, inSelectionMode);
        } else {
          return this._moveLeft(viewModel, cursors, inSelectionMode, value);
        }
      }
      case CursorMove.Direction.Right: {
        if (unit === CursorMove.Unit.HalfLine) {
          return this._moveHalfLineRight(viewModel, cursors, inSelectionMode);
        } else {
          return this._moveRight(viewModel, cursors, inSelectionMode, value);
        }
      }
      case CursorMove.Direction.Up: {
        if (unit === CursorMove.Unit.WrappedLine) {
          return this._moveUpByViewLines(viewModel, cursors, inSelectionMode, value);
        } else {
          return this._moveUpByModelLines(viewModel, cursors, inSelectionMode, value);
        }
      }
      case CursorMove.Direction.Down: {
        if (unit === CursorMove.Unit.WrappedLine) {
          return this._moveDownByViewLines(viewModel, cursors, inSelectionMode, value);
        } else {
          return this._moveDownByModelLines(viewModel, cursors, inSelectionMode, value);
        }
      }
      case CursorMove.Direction.PrevBlankLine: {
        if (unit === CursorMove.Unit.WrappedLine) {
          return cursors.map((cursor) => CursorState.fromViewState(MoveOperations.moveToPrevBlankLine(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode)));
        } else {
          return cursors.map((cursor) => CursorState.fromModelState(MoveOperations.moveToPrevBlankLine(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode)));
        }
      }
      case CursorMove.Direction.NextBlankLine: {
        if (unit === CursorMove.Unit.WrappedLine) {
          return cursors.map((cursor) => CursorState.fromViewState(MoveOperations.moveToNextBlankLine(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode)));
        } else {
          return cursors.map((cursor) => CursorState.fromModelState(MoveOperations.moveToNextBlankLine(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode)));
        }
      }
      case CursorMove.Direction.WrappedLineStart: {
        return this._moveToViewMinColumn(viewModel, cursors, inSelectionMode);
      }
      case CursorMove.Direction.WrappedLineFirstNonWhitespaceCharacter: {
        return this._moveToViewFirstNonWhitespaceColumn(viewModel, cursors, inSelectionMode);
      }
      case CursorMove.Direction.WrappedLineColumnCenter: {
        return this._moveToViewCenterColumn(viewModel, cursors, inSelectionMode);
      }
      case CursorMove.Direction.WrappedLineEnd: {
        return this._moveToViewMaxColumn(viewModel, cursors, inSelectionMode);
      }
      case CursorMove.Direction.WrappedLineLastNonWhitespaceCharacter: {
        return this._moveToViewLastNonWhitespaceColumn(viewModel, cursors, inSelectionMode);
      }
      default:
        return null;
    }
  }
  static viewportMove(viewModel, cursors, direction, inSelectionMode, value) {
    const visibleViewRange = viewModel.getCompletelyVisibleViewRange();
    const visibleModelRange = viewModel.coordinatesConverter.convertViewRangeToModelRange(visibleViewRange);
    switch (direction) {
      case CursorMove.Direction.ViewPortTop: {
        const modelLineNumber = this._firstLineNumberInRange(viewModel.model, visibleModelRange, value);
        const modelColumn = viewModel.model.getLineFirstNonWhitespaceColumn(modelLineNumber);
        return [this._moveToModelPosition(viewModel, cursors[0], inSelectionMode, modelLineNumber, modelColumn)];
      }
      case CursorMove.Direction.ViewPortBottom: {
        const modelLineNumber = this._lastLineNumberInRange(viewModel.model, visibleModelRange, value);
        const modelColumn = viewModel.model.getLineFirstNonWhitespaceColumn(modelLineNumber);
        return [this._moveToModelPosition(viewModel, cursors[0], inSelectionMode, modelLineNumber, modelColumn)];
      }
      case CursorMove.Direction.ViewPortCenter: {
        const modelLineNumber = Math.round((visibleModelRange.startLineNumber + visibleModelRange.endLineNumber) / 2);
        const modelColumn = viewModel.model.getLineFirstNonWhitespaceColumn(modelLineNumber);
        return [this._moveToModelPosition(viewModel, cursors[0], inSelectionMode, modelLineNumber, modelColumn)];
      }
      case CursorMove.Direction.ViewPortIfOutside: {
        const result = [];
        for (let i = 0, len = cursors.length; i < len; i++) {
          const cursor = cursors[i];
          result[i] = this.findPositionInViewportIfOutside(viewModel, cursor, visibleViewRange, inSelectionMode);
        }
        return result;
      }
      default:
        return null;
    }
  }
  static findPositionInViewportIfOutside(viewModel, cursor, visibleViewRange, inSelectionMode) {
    const viewLineNumber = cursor.viewState.position.lineNumber;
    if (visibleViewRange.startLineNumber <= viewLineNumber && viewLineNumber <= visibleViewRange.endLineNumber - 1) {
      return new CursorState(cursor.modelState, cursor.viewState);
    } else {
      let newViewLineNumber;
      if (viewLineNumber > visibleViewRange.endLineNumber - 1) {
        newViewLineNumber = visibleViewRange.endLineNumber - 1;
      } else if (viewLineNumber < visibleViewRange.startLineNumber) {
        newViewLineNumber = visibleViewRange.startLineNumber;
      } else {
        newViewLineNumber = viewLineNumber;
      }
      const position = MoveOperations.vertical(viewModel.cursorConfig, viewModel, viewLineNumber, cursor.viewState.position.column, cursor.viewState.leftoverVisibleColumns, newViewLineNumber, false);
      return CursorState.fromViewState(cursor.viewState.move(inSelectionMode, position.lineNumber, position.column, position.leftoverVisibleColumns));
    }
  }
  /**
   * Find the nth line start included in the range (from the start).
   */
  static _firstLineNumberInRange(model, range, count) {
    let startLineNumber = range.startLineNumber;
    if (range.startColumn !== model.getLineMinColumn(startLineNumber)) {
      startLineNumber++;
    }
    return Math.min(range.endLineNumber, startLineNumber + count - 1);
  }
  /**
   * Find the nth line start included in the range (from the end).
   */
  static _lastLineNumberInRange(model, range, count) {
    let startLineNumber = range.startLineNumber;
    if (range.startColumn !== model.getLineMinColumn(startLineNumber)) {
      startLineNumber++;
    }
    return Math.max(startLineNumber, range.endLineNumber - count + 1);
  }
  static _moveLeft(viewModel, cursors, inSelectionMode, noOfColumns) {
    return cursors.map(
      (cursor) => CursorState.fromViewState(
        MoveOperations.moveLeft(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, noOfColumns)
      )
    );
  }
  static _moveHalfLineLeft(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const viewLineNumber = cursor.viewState.position.lineNumber;
      const halfLine = Math.round(viewModel.getLineLength(viewLineNumber) / 2);
      result[i] = CursorState.fromViewState(MoveOperations.moveLeft(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, halfLine));
    }
    return result;
  }
  static _moveRight(viewModel, cursors, inSelectionMode, noOfColumns) {
    return cursors.map(
      (cursor) => CursorState.fromViewState(
        MoveOperations.moveRight(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, noOfColumns)
      )
    );
  }
  static _moveHalfLineRight(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const viewLineNumber = cursor.viewState.position.lineNumber;
      const halfLine = Math.round(viewModel.getLineLength(viewLineNumber) / 2);
      result[i] = CursorState.fromViewState(MoveOperations.moveRight(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, halfLine));
    }
    return result;
  }
  static _moveDownByViewLines(viewModel, cursors, inSelectionMode, linesCount) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = CursorState.fromViewState(MoveOperations.moveDown(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, linesCount));
    }
    return result;
  }
  static _moveDownByModelLines(viewModel, cursors, inSelectionMode, linesCount) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = CursorState.fromModelState(MoveOperations.moveDown(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode, linesCount));
    }
    return result;
  }
  static _moveUpByViewLines(viewModel, cursors, inSelectionMode, linesCount) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = CursorState.fromViewState(MoveOperations.moveUp(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, linesCount));
    }
    return result;
  }
  static _moveUpByModelLines(viewModel, cursors, inSelectionMode, linesCount) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      result[i] = CursorState.fromModelState(MoveOperations.moveUp(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode, linesCount));
    }
    return result;
  }
  static _moveToViewPosition(viewModel, cursor, inSelectionMode, toViewLineNumber, toViewColumn) {
    return CursorState.fromViewState(cursor.viewState.move(inSelectionMode, toViewLineNumber, toViewColumn, 0));
  }
  static _moveToModelPosition(viewModel, cursor, inSelectionMode, toModelLineNumber, toModelColumn) {
    return CursorState.fromModelState(cursor.modelState.move(inSelectionMode, toModelLineNumber, toModelColumn, 0));
  }
  static _moveToViewMinColumn(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const viewLineNumber = cursor.viewState.position.lineNumber;
      const viewColumn = viewModel.getLineMinColumn(viewLineNumber);
      result[i] = this._moveToViewPosition(viewModel, cursor, inSelectionMode, viewLineNumber, viewColumn);
    }
    return result;
  }
  static _moveToViewFirstNonWhitespaceColumn(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const viewLineNumber = cursor.viewState.position.lineNumber;
      const viewColumn = viewModel.getLineFirstNonWhitespaceColumn(viewLineNumber);
      result[i] = this._moveToViewPosition(viewModel, cursor, inSelectionMode, viewLineNumber, viewColumn);
    }
    return result;
  }
  static _moveToViewCenterColumn(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const viewLineNumber = cursor.viewState.position.lineNumber;
      const viewColumn = Math.round((viewModel.getLineMaxColumn(viewLineNumber) + viewModel.getLineMinColumn(viewLineNumber)) / 2);
      result[i] = this._moveToViewPosition(viewModel, cursor, inSelectionMode, viewLineNumber, viewColumn);
    }
    return result;
  }
  static _moveToViewMaxColumn(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const viewLineNumber = cursor.viewState.position.lineNumber;
      const viewColumn = viewModel.getLineMaxColumn(viewLineNumber);
      result[i] = this._moveToViewPosition(viewModel, cursor, inSelectionMode, viewLineNumber, viewColumn);
    }
    return result;
  }
  static _moveToViewLastNonWhitespaceColumn(viewModel, cursors, inSelectionMode) {
    const result = [];
    for (let i = 0, len = cursors.length; i < len; i++) {
      const cursor = cursors[i];
      const viewLineNumber = cursor.viewState.position.lineNumber;
      const viewColumn = viewModel.getLineLastNonWhitespaceColumn(viewLineNumber);
      result[i] = this._moveToViewPosition(viewModel, cursor, inSelectionMode, viewLineNumber, viewColumn);
    }
    return result;
  }
}
var CursorMove;
((CursorMove2) => {
  const isCursorMoveArgs = function(arg) {
    if (!types.isObject(arg)) {
      return false;
    }
    const cursorMoveArg = arg;
    if (!types.isString(cursorMoveArg.to)) {
      return false;
    }
    if (!types.isUndefined(cursorMoveArg.select) && !types.isBoolean(cursorMoveArg.select)) {
      return false;
    }
    if (!types.isUndefined(cursorMoveArg.by) && !types.isString(cursorMoveArg.by)) {
      return false;
    }
    if (!types.isUndefined(cursorMoveArg.value) && !types.isNumber(cursorMoveArg.value)) {
      return false;
    }
    return true;
  };
  CursorMove2.metadata = {
    description: "Move cursor to a logical position in the view",
    args: [
      {
        name: "Cursor move argument object",
        description: `Property-value pairs that can be passed through this argument:
					* 'to': A mandatory logical position value providing where to move the cursor.
						\`\`\`
						'left', 'right', 'up', 'down', 'prevBlankLine', 'nextBlankLine',
						'wrappedLineStart', 'wrappedLineEnd', 'wrappedLineColumnCenter'
						'wrappedLineFirstNonWhitespaceCharacter', 'wrappedLineLastNonWhitespaceCharacter'
						'viewPortTop', 'viewPortCenter', 'viewPortBottom', 'viewPortIfOutside'
						\`\`\`
					* 'by': Unit to move. Default is computed based on 'to' value.
						\`\`\`
						'line', 'wrappedLine', 'character', 'halfLine'
						\`\`\`
					* 'value': Number of units to move. Default is '1'.
					* 'select': If 'true' makes the selection. Default is 'false'.
				`,
        constraint: isCursorMoveArgs,
        schema: {
          "type": "object",
          "required": ["to"],
          "properties": {
            "to": {
              "type": "string",
              "enum": ["left", "right", "up", "down", "prevBlankLine", "nextBlankLine", "wrappedLineStart", "wrappedLineEnd", "wrappedLineColumnCenter", "wrappedLineFirstNonWhitespaceCharacter", "wrappedLineLastNonWhitespaceCharacter", "viewPortTop", "viewPortCenter", "viewPortBottom", "viewPortIfOutside"]
            },
            "by": {
              "type": "string",
              "enum": ["line", "wrappedLine", "character", "halfLine"]
            },
            "value": {
              "type": "number",
              "default": 1
            },
            "select": {
              "type": "boolean",
              "default": false
            }
          }
        }
      }
    ]
  };
  CursorMove2.RawDirection = {
    Left: "left",
    Right: "right",
    Up: "up",
    Down: "down",
    PrevBlankLine: "prevBlankLine",
    NextBlankLine: "nextBlankLine",
    WrappedLineStart: "wrappedLineStart",
    WrappedLineFirstNonWhitespaceCharacter: "wrappedLineFirstNonWhitespaceCharacter",
    WrappedLineColumnCenter: "wrappedLineColumnCenter",
    WrappedLineEnd: "wrappedLineEnd",
    WrappedLineLastNonWhitespaceCharacter: "wrappedLineLastNonWhitespaceCharacter",
    ViewPortTop: "viewPortTop",
    ViewPortCenter: "viewPortCenter",
    ViewPortBottom: "viewPortBottom",
    ViewPortIfOutside: "viewPortIfOutside"
  };
  CursorMove2.RawUnit = {
    Line: "line",
    WrappedLine: "wrappedLine",
    Character: "character",
    HalfLine: "halfLine"
  };
  function parse(args) {
    if (!args.to) {
      return null;
    }
    let direction;
    switch (args.to) {
      case CursorMove2.RawDirection.Left:
        direction = 0 /* Left */;
        break;
      case CursorMove2.RawDirection.Right:
        direction = 1 /* Right */;
        break;
      case CursorMove2.RawDirection.Up:
        direction = 2 /* Up */;
        break;
      case CursorMove2.RawDirection.Down:
        direction = 3 /* Down */;
        break;
      case CursorMove2.RawDirection.PrevBlankLine:
        direction = 4 /* PrevBlankLine */;
        break;
      case CursorMove2.RawDirection.NextBlankLine:
        direction = 5 /* NextBlankLine */;
        break;
      case CursorMove2.RawDirection.WrappedLineStart:
        direction = 6 /* WrappedLineStart */;
        break;
      case CursorMove2.RawDirection.WrappedLineFirstNonWhitespaceCharacter:
        direction = 7 /* WrappedLineFirstNonWhitespaceCharacter */;
        break;
      case CursorMove2.RawDirection.WrappedLineColumnCenter:
        direction = 8 /* WrappedLineColumnCenter */;
        break;
      case CursorMove2.RawDirection.WrappedLineEnd:
        direction = 9 /* WrappedLineEnd */;
        break;
      case CursorMove2.RawDirection.WrappedLineLastNonWhitespaceCharacter:
        direction = 10 /* WrappedLineLastNonWhitespaceCharacter */;
        break;
      case CursorMove2.RawDirection.ViewPortTop:
        direction = 11 /* ViewPortTop */;
        break;
      case CursorMove2.RawDirection.ViewPortBottom:
        direction = 13 /* ViewPortBottom */;
        break;
      case CursorMove2.RawDirection.ViewPortCenter:
        direction = 12 /* ViewPortCenter */;
        break;
      case CursorMove2.RawDirection.ViewPortIfOutside:
        direction = 14 /* ViewPortIfOutside */;
        break;
      default:
        return null;
    }
    let unit = 0 /* None */;
    switch (args.by) {
      case CursorMove2.RawUnit.Line:
        unit = 1 /* Line */;
        break;
      case CursorMove2.RawUnit.WrappedLine:
        unit = 2 /* WrappedLine */;
        break;
      case CursorMove2.RawUnit.Character:
        unit = 3 /* Character */;
        break;
      case CursorMove2.RawUnit.HalfLine:
        unit = 4 /* HalfLine */;
        break;
    }
    return {
      direction,
      unit,
      select: !!args.select,
      value: args.value || 1
    };
  }
  CursorMove2.parse = parse;
  let Direction;
  ((Direction2) => {
    Direction2[Direction2["Left"] = 0] = "Left";
    Direction2[Direction2["Right"] = 1] = "Right";
    Direction2[Direction2["Up"] = 2] = "Up";
    Direction2[Direction2["Down"] = 3] = "Down";
    Direction2[Direction2["PrevBlankLine"] = 4] = "PrevBlankLine";
    Direction2[Direction2["NextBlankLine"] = 5] = "NextBlankLine";
    Direction2[Direction2["WrappedLineStart"] = 6] = "WrappedLineStart";
    Direction2[Direction2["WrappedLineFirstNonWhitespaceCharacter"] = 7] = "WrappedLineFirstNonWhitespaceCharacter";
    Direction2[Direction2["WrappedLineColumnCenter"] = 8] = "WrappedLineColumnCenter";
    Direction2[Direction2["WrappedLineEnd"] = 9] = "WrappedLineEnd";
    Direction2[Direction2["WrappedLineLastNonWhitespaceCharacter"] = 10] = "WrappedLineLastNonWhitespaceCharacter";
    Direction2[Direction2["ViewPortTop"] = 11] = "ViewPortTop";
    Direction2[Direction2["ViewPortCenter"] = 12] = "ViewPortCenter";
    Direction2[Direction2["ViewPortBottom"] = 13] = "ViewPortBottom";
    Direction2[Direction2["ViewPortIfOutside"] = 14] = "ViewPortIfOutside";
  })(Direction = CursorMove2.Direction || (CursorMove2.Direction = {}));
  let Unit;
  ((Unit2) => {
    Unit2[Unit2["None"] = 0] = "None";
    Unit2[Unit2["Line"] = 1] = "Line";
    Unit2[Unit2["WrappedLine"] = 2] = "WrappedLine";
    Unit2[Unit2["Character"] = 3] = "Character";
    Unit2[Unit2["HalfLine"] = 4] = "HalfLine";
  })(Unit = CursorMove2.Unit || (CursorMove2.Unit = {}));
})(CursorMove || (CursorMove = {}));
export {
  CursorMove,
  CursorMoveCommands
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2N1cnNvci9jdXJzb3JNb3ZlQ29tbWFuZHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBDdXJzb3JTdGF0ZSwgSUN1cnNvclNpbXBsZU1vZGVsLCBQYXJ0aWFsQ3Vyc29yU3RhdGUsIFNlbGVjdGlvblN0YXJ0S2luZCwgU2luZ2xlQ3Vyc29yU3RhdGUgfSBmcm9tICcuLi9jdXJzb3JDb21tb24uanMnO1xuaW1wb3J0IHsgTW92ZU9wZXJhdGlvbnMgfSBmcm9tICcuL2N1cnNvck1vdmVPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IFdvcmRPcGVyYXRpb25zIH0gZnJvbSAnLi9jdXJzb3JXb3JkT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRNZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJVmlld01vZGVsIH0gZnJvbSAnLi4vdmlld01vZGVsLmpzJztcblxuZXhwb3J0IGNsYXNzIEN1cnNvck1vdmVDb21tYW5kcyB7XG5cblx0cHVibGljIHN0YXRpYyBhZGRDdXJzb3JEb3duKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yczogQ3Vyc29yU3RhdGVbXSwgdXNlTG9naWNhbExpbmU6IGJvb2xlYW4pOiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IFtdO1xuXHRcdGxldCByZXN1bHRMZW4gPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjdXJzb3JzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBjdXJzb3IgPSBjdXJzb3JzW2ldO1xuXHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBDdXJzb3JTdGF0ZShjdXJzb3IubW9kZWxTdGF0ZSwgY3Vyc29yLnZpZXdTdGF0ZSk7XG5cdFx0XHRpZiAodXNlTG9naWNhbExpbmUpIHtcblx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKE1vdmVPcGVyYXRpb25zLnRyYW5zbGF0ZURvd24odmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCBjdXJzb3IubW9kZWxTdGF0ZSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoTW92ZU9wZXJhdGlvbnMudHJhbnNsYXRlRG93bih2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwsIGN1cnNvci52aWV3U3RhdGUpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYWRkQ3Vyc29yVXAodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCB1c2VMb2dpY2FsTGluZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0bGV0IHJlc3VsdExlbiA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IEN1cnNvclN0YXRlKGN1cnNvci5tb2RlbFN0YXRlLCBjdXJzb3Iudmlld1N0YXRlKTtcblx0XHRcdGlmICh1c2VMb2dpY2FsTGluZSkge1xuXHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gQ3Vyc29yU3RhdGUuZnJvbU1vZGVsU3RhdGUoTW92ZU9wZXJhdGlvbnMudHJhbnNsYXRlVXAodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCBjdXJzb3IubW9kZWxTdGF0ZSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoTW92ZU9wZXJhdGlvbnMudHJhbnNsYXRlVXAodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBjdXJzb3Iudmlld1N0YXRlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIG1vdmVUb0JlZ2lubmluZ09mTGluZSh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRyZXN1bHRbaV0gPSB0aGlzLl9tb3ZlVG9MaW5lU3RhcnQodmlld01vZGVsLCBjdXJzb3IsIGluU2VsZWN0aW9uTW9kZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tb3ZlVG9MaW5lU3RhcnQodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3I6IEN1cnNvclN0YXRlLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4pOiBQYXJ0aWFsQ3Vyc29yU3RhdGUge1xuXHRcdGNvbnN0IGN1cnJlbnRWaWV3U3RhdGVDb2x1bW4gPSBjdXJzb3Iudmlld1N0YXRlLnBvc2l0aW9uLmNvbHVtbjtcblx0XHRjb25zdCBjdXJyZW50TW9kZWxTdGF0ZUNvbHVtbiA9IGN1cnNvci5tb2RlbFN0YXRlLnBvc2l0aW9uLmNvbHVtbjtcblx0XHRjb25zdCBpc0ZpcnN0TGluZU9mV3JhcHBlZExpbmUgPSBjdXJyZW50Vmlld1N0YXRlQ29sdW1uID09PSBjdXJyZW50TW9kZWxTdGF0ZUNvbHVtbjtcblxuXHRcdGNvbnN0IGN1cnJlbnRWaWV3U3RhdGVsaW5lTnVtYmVyID0gY3Vyc29yLnZpZXdTdGF0ZS5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdGNvbnN0IGZpcnN0Tm9uQmxhbmtDb2x1bW4gPSB2aWV3TW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihjdXJyZW50Vmlld1N0YXRlbGluZU51bWJlcik7XG5cdFx0Y29uc3QgaXNCZWdpbm5pbmdPZlZpZXdMaW5lID0gY3VycmVudFZpZXdTdGF0ZUNvbHVtbiA9PT0gZmlyc3ROb25CbGFua0NvbHVtbjtcblxuXHRcdGlmICghaXNGaXJzdExpbmVPZldyYXBwZWRMaW5lICYmICFpc0JlZ2lubmluZ09mVmlld0xpbmUpIHtcblx0XHRcdHJldHVybiB0aGlzLl9tb3ZlVG9MaW5lU3RhcnRCeVZpZXcodmlld01vZGVsLCBjdXJzb3IsIGluU2VsZWN0aW9uTW9kZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9tb3ZlVG9MaW5lU3RhcnRCeU1vZGVsKHZpZXdNb2RlbCwgY3Vyc29yLCBpblNlbGVjdGlvbk1vZGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tb3ZlVG9MaW5lU3RhcnRCeVZpZXcodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3I6IEN1cnNvclN0YXRlLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4pOiBQYXJ0aWFsQ3Vyc29yU3RhdGUge1xuXHRcdHJldHVybiBDdXJzb3JTdGF0ZS5mcm9tVmlld1N0YXRlKFxuXHRcdFx0TW92ZU9wZXJhdGlvbnMubW92ZVRvQmVnaW5uaW5nT2ZMaW5lKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbCwgY3Vyc29yLnZpZXdTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZVRvTGluZVN0YXJ0QnlNb2RlbCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcjogQ3Vyc29yU3RhdGUsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZSB7XG5cdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKFxuXHRcdFx0TW92ZU9wZXJhdGlvbnMubW92ZVRvQmVnaW5uaW5nT2ZMaW5lKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbC5tb2RlbCwgY3Vyc29yLm1vZGVsU3RhdGUsIGluU2VsZWN0aW9uTW9kZSlcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBtb3ZlVG9FbmRPZkxpbmUodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIHN0aWNreTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRyZXN1bHRbaV0gPSB0aGlzLl9tb3ZlVG9MaW5lRW5kKHZpZXdNb2RlbCwgY3Vyc29yLCBpblNlbGVjdGlvbk1vZGUsIHN0aWNreSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tb3ZlVG9MaW5lRW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yOiBDdXJzb3JTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuLCBzdGlja3k6IGJvb2xlYW4pOiBQYXJ0aWFsQ3Vyc29yU3RhdGUge1xuXHRcdGNvbnN0IHZpZXdTdGF0ZVBvc2l0aW9uID0gY3Vyc29yLnZpZXdTdGF0ZS5wb3NpdGlvbjtcblx0XHRjb25zdCB2aWV3TW9kZWxNYXhDb2x1bW4gPSB2aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbih2aWV3U3RhdGVQb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRjb25zdCBpc0VuZE9mVmlld0xpbmUgPSB2aWV3U3RhdGVQb3NpdGlvbi5jb2x1bW4gPT09IHZpZXdNb2RlbE1heENvbHVtbjtcblxuXHRcdGNvbnN0IG1vZGVsU3RhdGVQb3NpdGlvbiA9IGN1cnNvci5tb2RlbFN0YXRlLnBvc2l0aW9uO1xuXHRcdGNvbnN0IG1vZGVsTWF4Q29sdW1uID0gdmlld01vZGVsLm1vZGVsLmdldExpbmVNYXhDb2x1bW4obW9kZWxTdGF0ZVBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGlzRW5kTGluZU9mV3JhcHBlZExpbmUgPSB2aWV3TW9kZWxNYXhDb2x1bW4gLSB2aWV3U3RhdGVQb3NpdGlvbi5jb2x1bW4gPT09IG1vZGVsTWF4Q29sdW1uIC0gbW9kZWxTdGF0ZVBvc2l0aW9uLmNvbHVtbjtcblxuXHRcdGlmIChpc0VuZE9mVmlld0xpbmUgfHwgaXNFbmRMaW5lT2ZXcmFwcGVkTGluZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX21vdmVUb0xpbmVFbmRCeU1vZGVsKHZpZXdNb2RlbCwgY3Vyc29yLCBpblNlbGVjdGlvbk1vZGUsIHN0aWNreSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9tb3ZlVG9MaW5lRW5kQnlWaWV3KHZpZXdNb2RlbCwgY3Vyc29yLCBpblNlbGVjdGlvbk1vZGUsIHN0aWNreSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX21vdmVUb0xpbmVFbmRCeVZpZXcodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3I6IEN1cnNvclN0YXRlLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIHN0aWNreTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZSB7XG5cdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoXG5cdFx0XHRNb3ZlT3BlcmF0aW9ucy5tb3ZlVG9FbmRPZkxpbmUodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBjdXJzb3Iudmlld1N0YXRlLCBpblNlbGVjdGlvbk1vZGUsIHN0aWNreSlcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX21vdmVUb0xpbmVFbmRCeU1vZGVsKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yOiBDdXJzb3JTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuLCBzdGlja3k6IGJvb2xlYW4pOiBQYXJ0aWFsQ3Vyc29yU3RhdGUge1xuXHRcdHJldHVybiBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTdGF0ZShcblx0XHRcdE1vdmVPcGVyYXRpb25zLm1vdmVUb0VuZE9mTGluZSh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwubW9kZWwsIGN1cnNvci5tb2RlbFN0YXRlLCBpblNlbGVjdGlvbk1vZGUsIHN0aWNreSlcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBleHBhbmRMaW5lU2VsZWN0aW9uKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yczogQ3Vyc29yU3RhdGVbXSk6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cblx0XHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IGN1cnNvci5tb2RlbFN0YXRlLnNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCBsaW5lQ291bnQgPSB2aWV3TW9kZWwubW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cblx0XHRcdGxldCBlbmRMaW5lTnVtYmVyID0gY3Vyc29yLm1vZGVsU3RhdGUuc2VsZWN0aW9uLmVuZExpbmVOdW1iZXI7XG5cdFx0XHRsZXQgZW5kQ29sdW1uOiBudW1iZXI7XG5cdFx0XHRpZiAoZW5kTGluZU51bWJlciA9PT0gbGluZUNvdW50KSB7XG5cdFx0XHRcdGVuZENvbHVtbiA9IHZpZXdNb2RlbC5tb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVDb3VudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlbmRMaW5lTnVtYmVyKys7XG5cdFx0XHRcdGVuZENvbHVtbiA9IDE7XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VsdFtpXSA9IEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKG5ldyBTaW5nbGVDdXJzb3JTdGF0ZShcblx0XHRcdFx0bmV3IFJhbmdlKHN0YXJ0TGluZU51bWJlciwgMSwgc3RhcnRMaW5lTnVtYmVyLCAxKSwgU2VsZWN0aW9uU3RhcnRLaW5kLlNpbXBsZSwgMCxcblx0XHRcdFx0bmV3IFBvc2l0aW9uKGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbiksIDBcblx0XHRcdCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBtb3ZlVG9CZWdpbm5pbmdPZkJ1ZmZlcih2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRyZXN1bHRbaV0gPSBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTdGF0ZShNb3ZlT3BlcmF0aW9ucy5tb3ZlVG9CZWdpbm5pbmdPZkJ1ZmZlcih2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwubW9kZWwsIGN1cnNvci5tb2RlbFN0YXRlLCBpblNlbGVjdGlvbk1vZGUpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgbW92ZVRvRW5kT2ZCdWZmZXIodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4pOiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjdXJzb3JzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBjdXJzb3IgPSBjdXJzb3JzW2ldO1xuXHRcdFx0cmVzdWx0W2ldID0gQ3Vyc29yU3RhdGUuZnJvbU1vZGVsU3RhdGUoTW92ZU9wZXJhdGlvbnMubW92ZVRvRW5kT2ZCdWZmZXIodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCBjdXJzb3IubW9kZWxTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlKSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHNlbGVjdEFsbCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcjogQ3Vyc29yU3RhdGUpOiBQYXJ0aWFsQ3Vyc29yU3RhdGUge1xuXHRcdGNvbnN0IGxpbmVDb3VudCA9IHZpZXdNb2RlbC5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCBtYXhDb2x1bW4gPSB2aWV3TW9kZWwubW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lQ291bnQpO1xuXG5cdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKG5ldyBTaW5nbGVDdXJzb3JTdGF0ZShcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgU2VsZWN0aW9uU3RhcnRLaW5kLlNpbXBsZSwgMCxcblx0XHRcdG5ldyBQb3NpdGlvbihsaW5lQ291bnQsIG1heENvbHVtbiksIDBcblx0XHQpKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgbGluZSh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcjogQ3Vyc29yU3RhdGUsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiwgX3Bvc2l0aW9uOiBJUG9zaXRpb24sIF92aWV3UG9zaXRpb246IElQb3NpdGlvbiB8IHVuZGVmaW5lZCk6IFBhcnRpYWxDdXJzb3JTdGF0ZSB7XG5cdFx0Y29uc3QgcG9zaXRpb24gPSB2aWV3TW9kZWwubW9kZWwudmFsaWRhdGVQb3NpdGlvbihfcG9zaXRpb24pO1xuXHRcdGNvbnN0IHZpZXdQb3NpdGlvbiA9IChcblx0XHRcdF92aWV3UG9zaXRpb25cblx0XHRcdFx0PyB2aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIudmFsaWRhdGVWaWV3UG9zaXRpb24obmV3IFBvc2l0aW9uKF92aWV3UG9zaXRpb24ubGluZU51bWJlciwgX3ZpZXdQb3NpdGlvbi5jb2x1bW4pLCBwb3NpdGlvbilcblx0XHRcdFx0OiB2aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihwb3NpdGlvbilcblx0XHQpO1xuXG5cdFx0aWYgKCFpblNlbGVjdGlvbk1vZGUpIHtcblx0XHRcdC8vIEVudGVyaW5nIGxpbmUgc2VsZWN0aW9uIGZvciB0aGUgZmlyc3QgdGltZVxuXHRcdFx0Y29uc3QgbGluZUNvdW50ID0gdmlld01vZGVsLm1vZGVsLmdldExpbmVDb3VudCgpO1xuXG5cdFx0XHRsZXQgc2VsZWN0VG9MaW5lTnVtYmVyID0gcG9zaXRpb24ubGluZU51bWJlciArIDE7XG5cdFx0XHRsZXQgc2VsZWN0VG9Db2x1bW4gPSAxO1xuXHRcdFx0aWYgKHNlbGVjdFRvTGluZU51bWJlciA+IGxpbmVDb3VudCkge1xuXHRcdFx0XHRzZWxlY3RUb0xpbmVOdW1iZXIgPSBsaW5lQ291bnQ7XG5cdFx0XHRcdHNlbGVjdFRvQ29sdW1uID0gdmlld01vZGVsLm1vZGVsLmdldExpbmVNYXhDb2x1bW4oc2VsZWN0VG9MaW5lTnVtYmVyKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKG5ldyBTaW5nbGVDdXJzb3JTdGF0ZShcblx0XHRcdFx0bmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIDEsIHNlbGVjdFRvTGluZU51bWJlciwgc2VsZWN0VG9Db2x1bW4pLCBTZWxlY3Rpb25TdGFydEtpbmQuTGluZSwgMCxcblx0XHRcdFx0bmV3IFBvc2l0aW9uKHNlbGVjdFRvTGluZU51bWJlciwgc2VsZWN0VG9Db2x1bW4pLCAwXG5cdFx0XHQpKTtcblx0XHR9XG5cblx0XHQvLyBDb250aW51aW5nIGxpbmUgc2VsZWN0aW9uXG5cdFx0Y29uc3QgZW50ZXJpbmdMaW5lTnVtYmVyID0gY3Vyc29yLm1vZGVsU3RhdGUuc2VsZWN0aW9uU3RhcnQuZ2V0U3RhcnRQb3NpdGlvbigpLmxpbmVOdW1iZXI7XG5cblx0XHRpZiAocG9zaXRpb24ubGluZU51bWJlciA8IGVudGVyaW5nTGluZU51bWJlcikge1xuXG5cdFx0XHRyZXR1cm4gQ3Vyc29yU3RhdGUuZnJvbVZpZXdTdGF0ZShjdXJzb3Iudmlld1N0YXRlLm1vdmUoXG5cdFx0XHRcdHRydWUsIHZpZXdQb3NpdGlvbi5saW5lTnVtYmVyLCAxLCAwXG5cdFx0XHQpKTtcblxuXHRcdH0gZWxzZSBpZiAocG9zaXRpb24ubGluZU51bWJlciA+IGVudGVyaW5nTGluZU51bWJlcikge1xuXG5cdFx0XHRjb25zdCBsaW5lQ291bnQgPSB2aWV3TW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cblx0XHRcdGxldCBzZWxlY3RUb1ZpZXdMaW5lTnVtYmVyID0gdmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIgKyAxO1xuXHRcdFx0bGV0IHNlbGVjdFRvVmlld0NvbHVtbiA9IDE7XG5cdFx0XHRpZiAoc2VsZWN0VG9WaWV3TGluZU51bWJlciA+IGxpbmVDb3VudCkge1xuXHRcdFx0XHRzZWxlY3RUb1ZpZXdMaW5lTnVtYmVyID0gbGluZUNvdW50O1xuXHRcdFx0XHRzZWxlY3RUb1ZpZXdDb2x1bW4gPSB2aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbihzZWxlY3RUb1ZpZXdMaW5lTnVtYmVyKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoY3Vyc29yLnZpZXdTdGF0ZS5tb3ZlKFxuXHRcdFx0XHR0cnVlLCBzZWxlY3RUb1ZpZXdMaW5lTnVtYmVyLCBzZWxlY3RUb1ZpZXdDb2x1bW4sIDBcblx0XHRcdCkpO1xuXG5cdFx0fSBlbHNlIHtcblxuXHRcdFx0Y29uc3QgZW5kUG9zaXRpb25PZlNlbGVjdGlvblN0YXJ0ID0gY3Vyc29yLm1vZGVsU3RhdGUuc2VsZWN0aW9uU3RhcnQuZ2V0RW5kUG9zaXRpb24oKTtcblx0XHRcdHJldHVybiBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTdGF0ZShjdXJzb3IubW9kZWxTdGF0ZS5tb3ZlKFxuXHRcdFx0XHR0cnVlLCBlbmRQb3NpdGlvbk9mU2VsZWN0aW9uU3RhcnQubGluZU51bWJlciwgZW5kUG9zaXRpb25PZlNlbGVjdGlvblN0YXJ0LmNvbHVtbiwgMFxuXHRcdFx0KSk7XG5cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHdvcmQodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3I6IEN1cnNvclN0YXRlLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIF9wb3NpdGlvbjogSVBvc2l0aW9uKTogUGFydGlhbEN1cnNvclN0YXRlIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IHZpZXdNb2RlbC5tb2RlbC52YWxpZGF0ZVBvc2l0aW9uKF9wb3NpdGlvbik7XG5cdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKFdvcmRPcGVyYXRpb25zLndvcmQodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCBjdXJzb3IubW9kZWxTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlLCBwb3NpdGlvbikpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBjYW5jZWxTZWxlY3Rpb24odmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3I6IEN1cnNvclN0YXRlKTogUGFydGlhbEN1cnNvclN0YXRlIHtcblx0XHRpZiAoIWN1cnNvci5tb2RlbFN0YXRlLmhhc1NlbGVjdGlvbigpKSB7XG5cdFx0XHRyZXR1cm4gbmV3IEN1cnNvclN0YXRlKGN1cnNvci5tb2RlbFN0YXRlLCBjdXJzb3Iudmlld1N0YXRlKTtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lTnVtYmVyID0gY3Vyc29yLnZpZXdTdGF0ZS5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdGNvbnN0IGNvbHVtbiA9IGN1cnNvci52aWV3U3RhdGUucG9zaXRpb24uY29sdW1uO1xuXG5cdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUobmV3IFNpbmdsZUN1cnNvclN0YXRlKFxuXHRcdFx0bmV3IFJhbmdlKGxpbmVOdW1iZXIsIGNvbHVtbiwgbGluZU51bWJlciwgY29sdW1uKSwgU2VsZWN0aW9uU3RhcnRLaW5kLlNpbXBsZSwgMCxcblx0XHRcdG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pLCAwXG5cdFx0KSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIG1vdmVUbyh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcjogQ3Vyc29yU3RhdGUsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiwgX3Bvc2l0aW9uOiBJUG9zaXRpb24sIF92aWV3UG9zaXRpb246IElQb3NpdGlvbiB8IHVuZGVmaW5lZCk6IFBhcnRpYWxDdXJzb3JTdGF0ZSB7XG5cdFx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdFx0aWYgKGN1cnNvci5tb2RlbFN0YXRlLnNlbGVjdGlvblN0YXJ0S2luZCA9PT0gU2VsZWN0aW9uU3RhcnRLaW5kLldvcmQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMud29yZCh2aWV3TW9kZWwsIGN1cnNvciwgaW5TZWxlY3Rpb25Nb2RlLCBfcG9zaXRpb24pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGN1cnNvci5tb2RlbFN0YXRlLnNlbGVjdGlvblN0YXJ0S2luZCA9PT0gU2VsZWN0aW9uU3RhcnRLaW5kLkxpbmUpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGluZSh2aWV3TW9kZWwsIGN1cnNvciwgaW5TZWxlY3Rpb25Nb2RlLCBfcG9zaXRpb24sIF92aWV3UG9zaXRpb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBwb3NpdGlvbiA9IHZpZXdNb2RlbC5tb2RlbC52YWxpZGF0ZVBvc2l0aW9uKF9wb3NpdGlvbik7XG5cdFx0Y29uc3Qgdmlld1Bvc2l0aW9uID0gKFxuXHRcdFx0X3ZpZXdQb3NpdGlvblxuXHRcdFx0XHQ/IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci52YWxpZGF0ZVZpZXdQb3NpdGlvbihuZXcgUG9zaXRpb24oX3ZpZXdQb3NpdGlvbi5saW5lTnVtYmVyLCBfdmlld1Bvc2l0aW9uLmNvbHVtbiksIHBvc2l0aW9uKVxuXHRcdFx0XHQ6IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKHBvc2l0aW9uKVxuXHRcdCk7XG5cdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoY3Vyc29yLnZpZXdTdGF0ZS5tb3ZlKGluU2VsZWN0aW9uTW9kZSwgdmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIsIHZpZXdQb3NpdGlvbi5jb2x1bW4sIDApKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgc2ltcGxlTW92ZSh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGRpcmVjdGlvbjogQ3Vyc29yTW92ZS5TaW1wbGVNb3ZlRGlyZWN0aW9uLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIHZhbHVlOiBudW1iZXIsIHVuaXQ6IEN1cnNvck1vdmUuVW5pdCk6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHwgbnVsbCB7XG5cdFx0c3dpdGNoIChkaXJlY3Rpb24pIHtcblx0XHRcdGNhc2UgQ3Vyc29yTW92ZS5EaXJlY3Rpb24uTGVmdDoge1xuXHRcdFx0XHRpZiAodW5pdCA9PT0gQ3Vyc29yTW92ZS5Vbml0LkhhbGZMaW5lKSB7XG5cdFx0XHRcdFx0Ly8gTW92ZSBsZWZ0IGJ5IGhhbGYgdGhlIGN1cnJlbnQgbGluZSBsZW5ndGhcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fbW92ZUhhbGZMaW5lTGVmdCh2aWV3TW9kZWwsIGN1cnNvcnMsIGluU2VsZWN0aW9uTW9kZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gTW92ZSBsZWZ0IGJ5IGBtb3ZlUGFyYW1zLnZhbHVlYCBjb2x1bW5zXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX21vdmVMZWZ0KHZpZXdNb2RlbCwgY3Vyc29ycywgaW5TZWxlY3Rpb25Nb2RlLCB2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNhc2UgQ3Vyc29yTW92ZS5EaXJlY3Rpb24uUmlnaHQ6IHtcblx0XHRcdFx0aWYgKHVuaXQgPT09IEN1cnNvck1vdmUuVW5pdC5IYWxmTGluZSkge1xuXHRcdFx0XHRcdC8vIE1vdmUgcmlnaHQgYnkgaGFsZiB0aGUgY3VycmVudCBsaW5lIGxlbmd0aFxuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9tb3ZlSGFsZkxpbmVSaWdodCh2aWV3TW9kZWwsIGN1cnNvcnMsIGluU2VsZWN0aW9uTW9kZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gTW92ZSByaWdodCBieSBgbW92ZVBhcmFtcy52YWx1ZWAgY29sdW1uc1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9tb3ZlUmlnaHQodmlld01vZGVsLCBjdXJzb3JzLCBpblNlbGVjdGlvbk1vZGUsIHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2FzZSBDdXJzb3JNb3ZlLkRpcmVjdGlvbi5VcDoge1xuXHRcdFx0XHRpZiAodW5pdCA9PT0gQ3Vyc29yTW92ZS5Vbml0LldyYXBwZWRMaW5lKSB7XG5cdFx0XHRcdFx0Ly8gTW92ZSB1cCBieSB2aWV3IGxpbmVzXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX21vdmVVcEJ5Vmlld0xpbmVzKHZpZXdNb2RlbCwgY3Vyc29ycywgaW5TZWxlY3Rpb25Nb2RlLCB2YWx1ZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gTW92ZSB1cCBieSBtb2RlbCBsaW5lc1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9tb3ZlVXBCeU1vZGVsTGluZXModmlld01vZGVsLCBjdXJzb3JzLCBpblNlbGVjdGlvbk1vZGUsIHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2FzZSBDdXJzb3JNb3ZlLkRpcmVjdGlvbi5Eb3duOiB7XG5cdFx0XHRcdGlmICh1bml0ID09PSBDdXJzb3JNb3ZlLlVuaXQuV3JhcHBlZExpbmUpIHtcblx0XHRcdFx0XHQvLyBNb3ZlIGRvd24gYnkgdmlldyBsaW5lc1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9tb3ZlRG93bkJ5Vmlld0xpbmVzKHZpZXdNb2RlbCwgY3Vyc29ycywgaW5TZWxlY3Rpb25Nb2RlLCB2YWx1ZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gTW92ZSBkb3duIGJ5IG1vZGVsIGxpbmVzXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX21vdmVEb3duQnlNb2RlbExpbmVzKHZpZXdNb2RlbCwgY3Vyc29ycywgaW5TZWxlY3Rpb25Nb2RlLCB2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNhc2UgQ3Vyc29yTW92ZS5EaXJlY3Rpb24uUHJldkJsYW5rTGluZToge1xuXHRcdFx0XHRpZiAodW5pdCA9PT0gQ3Vyc29yTW92ZS5Vbml0LldyYXBwZWRMaW5lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGN1cnNvcnMubWFwKGN1cnNvciA9PiBDdXJzb3JTdGF0ZS5mcm9tVmlld1N0YXRlKE1vdmVPcGVyYXRpb25zLm1vdmVUb1ByZXZCbGFua0xpbmUodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBjdXJzb3Iudmlld1N0YXRlLCBpblNlbGVjdGlvbk1vZGUpKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGN1cnNvcnMubWFwKGN1cnNvciA9PiBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTdGF0ZShNb3ZlT3BlcmF0aW9ucy5tb3ZlVG9QcmV2QmxhbmtMaW5lKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbC5tb2RlbCwgY3Vyc29yLm1vZGVsU3RhdGUsIGluU2VsZWN0aW9uTW9kZSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2FzZSBDdXJzb3JNb3ZlLkRpcmVjdGlvbi5OZXh0QmxhbmtMaW5lOiB7XG5cdFx0XHRcdGlmICh1bml0ID09PSBDdXJzb3JNb3ZlLlVuaXQuV3JhcHBlZExpbmUpIHtcblx0XHRcdFx0XHRyZXR1cm4gY3Vyc29ycy5tYXAoY3Vyc29yID0+IEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoTW92ZU9wZXJhdGlvbnMubW92ZVRvTmV4dEJsYW5rTGluZSh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwsIGN1cnNvci52aWV3U3RhdGUsIGluU2VsZWN0aW9uTW9kZSkpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gY3Vyc29ycy5tYXAoY3Vyc29yID0+IEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKE1vdmVPcGVyYXRpb25zLm1vdmVUb05leHRCbGFua0xpbmUodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCBjdXJzb3IubW9kZWxTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYXNlIEN1cnNvck1vdmUuRGlyZWN0aW9uLldyYXBwZWRMaW5lU3RhcnQ6IHtcblx0XHRcdFx0Ly8gTW92ZSB0byB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjdXJyZW50IHZpZXcgbGluZVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fbW92ZVRvVmlld01pbkNvbHVtbih2aWV3TW9kZWwsIGN1cnNvcnMsIGluU2VsZWN0aW9uTW9kZSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIEN1cnNvck1vdmUuRGlyZWN0aW9uLldyYXBwZWRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyOiB7XG5cdFx0XHRcdC8vIE1vdmUgdG8gdGhlIGZpcnN0IG5vbi13aGl0ZXNwYWNlIGNvbHVtbiBvZiB0aGUgY3VycmVudCB2aWV3IGxpbmVcblx0XHRcdFx0cmV0dXJuIHRoaXMuX21vdmVUb1ZpZXdGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4odmlld01vZGVsLCBjdXJzb3JzLCBpblNlbGVjdGlvbk1vZGUpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBDdXJzb3JNb3ZlLkRpcmVjdGlvbi5XcmFwcGVkTGluZUNvbHVtbkNlbnRlcjoge1xuXHRcdFx0XHQvLyBNb3ZlIHRvIHRoZSBcImNlbnRlclwiIG9mIHRoZSBjdXJyZW50IHZpZXcgbGluZVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fbW92ZVRvVmlld0NlbnRlckNvbHVtbih2aWV3TW9kZWwsIGN1cnNvcnMsIGluU2VsZWN0aW9uTW9kZSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIEN1cnNvck1vdmUuRGlyZWN0aW9uLldyYXBwZWRMaW5lRW5kOiB7XG5cdFx0XHRcdC8vIE1vdmUgdG8gdGhlIGVuZCBvZiB0aGUgY3VycmVudCB2aWV3IGxpbmVcblx0XHRcdFx0cmV0dXJuIHRoaXMuX21vdmVUb1ZpZXdNYXhDb2x1bW4odmlld01vZGVsLCBjdXJzb3JzLCBpblNlbGVjdGlvbk1vZGUpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBDdXJzb3JNb3ZlLkRpcmVjdGlvbi5XcmFwcGVkTGluZUxhc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyOiB7XG5cdFx0XHRcdC8vIE1vdmUgdG8gdGhlIGxhc3Qgbm9uLXdoaXRlc3BhY2UgY29sdW1uIG9mIHRoZSBjdXJyZW50IHZpZXcgbGluZVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fbW92ZVRvVmlld0xhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKHZpZXdNb2RlbCwgY3Vyc29ycywgaW5TZWxlY3Rpb25Nb2RlKTtcblx0XHRcdH1cblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHR9XG5cblx0cHVibGljIHN0YXRpYyB2aWV3cG9ydE1vdmUodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCBkaXJlY3Rpb246IEN1cnNvck1vdmUuVmlld3BvcnREaXJlY3Rpb24sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiwgdmFsdWU6IG51bWJlcik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHwgbnVsbCB7XG5cdFx0Y29uc3QgdmlzaWJsZVZpZXdSYW5nZSA9IHZpZXdNb2RlbC5nZXRDb21wbGV0ZWx5VmlzaWJsZVZpZXdSYW5nZSgpO1xuXHRcdGNvbnN0IHZpc2libGVNb2RlbFJhbmdlID0gdmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRWaWV3UmFuZ2VUb01vZGVsUmFuZ2UodmlzaWJsZVZpZXdSYW5nZSk7XG5cdFx0c3dpdGNoIChkaXJlY3Rpb24pIHtcblx0XHRcdGNhc2UgQ3Vyc29yTW92ZS5EaXJlY3Rpb24uVmlld1BvcnRUb3A6IHtcblx0XHRcdFx0Ly8gTW92ZSB0byB0aGUgbnRoIGxpbmUgc3RhcnQgaW4gdGhlIHZpZXdwb3J0IChmcm9tIHRoZSB0b3ApXG5cdFx0XHRcdGNvbnN0IG1vZGVsTGluZU51bWJlciA9IHRoaXMuX2ZpcnN0TGluZU51bWJlckluUmFuZ2Uodmlld01vZGVsLm1vZGVsLCB2aXNpYmxlTW9kZWxSYW5nZSwgdmFsdWUpO1xuXHRcdFx0XHRjb25zdCBtb2RlbENvbHVtbiA9IHZpZXdNb2RlbC5tb2RlbC5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKG1vZGVsTGluZU51bWJlcik7XG5cdFx0XHRcdHJldHVybiBbdGhpcy5fbW92ZVRvTW9kZWxQb3NpdGlvbih2aWV3TW9kZWwsIGN1cnNvcnNbMF0sIGluU2VsZWN0aW9uTW9kZSwgbW9kZWxMaW5lTnVtYmVyLCBtb2RlbENvbHVtbildO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBDdXJzb3JNb3ZlLkRpcmVjdGlvbi5WaWV3UG9ydEJvdHRvbToge1xuXHRcdFx0XHQvLyBNb3ZlIHRvIHRoZSBudGggbGluZSBzdGFydCBpbiB0aGUgdmlld3BvcnQgKGZyb20gdGhlIGJvdHRvbSlcblx0XHRcdFx0Y29uc3QgbW9kZWxMaW5lTnVtYmVyID0gdGhpcy5fbGFzdExpbmVOdW1iZXJJblJhbmdlKHZpZXdNb2RlbC5tb2RlbCwgdmlzaWJsZU1vZGVsUmFuZ2UsIHZhbHVlKTtcblx0XHRcdFx0Y29uc3QgbW9kZWxDb2x1bW4gPSB2aWV3TW9kZWwubW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihtb2RlbExpbmVOdW1iZXIpO1xuXHRcdFx0XHRyZXR1cm4gW3RoaXMuX21vdmVUb01vZGVsUG9zaXRpb24odmlld01vZGVsLCBjdXJzb3JzWzBdLCBpblNlbGVjdGlvbk1vZGUsIG1vZGVsTGluZU51bWJlciwgbW9kZWxDb2x1bW4pXTtcblx0XHRcdH1cblx0XHRcdGNhc2UgQ3Vyc29yTW92ZS5EaXJlY3Rpb24uVmlld1BvcnRDZW50ZXI6IHtcblx0XHRcdFx0Ly8gTW92ZSB0byB0aGUgbGluZSBzdGFydCBpbiB0aGUgdmlld3BvcnQgY2VudGVyXG5cdFx0XHRcdGNvbnN0IG1vZGVsTGluZU51bWJlciA9IE1hdGgucm91bmQoKHZpc2libGVNb2RlbFJhbmdlLnN0YXJ0TGluZU51bWJlciArIHZpc2libGVNb2RlbFJhbmdlLmVuZExpbmVOdW1iZXIpIC8gMik7XG5cdFx0XHRcdGNvbnN0IG1vZGVsQ29sdW1uID0gdmlld01vZGVsLm1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4obW9kZWxMaW5lTnVtYmVyKTtcblx0XHRcdFx0cmV0dXJuIFt0aGlzLl9tb3ZlVG9Nb2RlbFBvc2l0aW9uKHZpZXdNb2RlbCwgY3Vyc29yc1swXSwgaW5TZWxlY3Rpb25Nb2RlLCBtb2RlbExpbmVOdW1iZXIsIG1vZGVsQ29sdW1uKV07XG5cdFx0XHR9XG5cdFx0XHRjYXNlIEN1cnNvck1vdmUuRGlyZWN0aW9uLlZpZXdQb3J0SWZPdXRzaWRlOiB7XG5cdFx0XHRcdC8vIE1vdmUgdG8gYSBwb3NpdGlvbiBpbnNpZGUgdGhlIHZpZXdwb3J0XG5cdFx0XHRcdGNvbnN0IHJlc3VsdDogUGFydGlhbEN1cnNvclN0YXRlW10gPSBbXTtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBjdXJzb3IgPSBjdXJzb3JzW2ldO1xuXHRcdFx0XHRcdHJlc3VsdFtpXSA9IHRoaXMuZmluZFBvc2l0aW9uSW5WaWV3cG9ydElmT3V0c2lkZSh2aWV3TW9kZWwsIGN1cnNvciwgdmlzaWJsZVZpZXdSYW5nZSwgaW5TZWxlY3Rpb25Nb2RlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHN0YXRpYyBmaW5kUG9zaXRpb25JblZpZXdwb3J0SWZPdXRzaWRlKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yOiBDdXJzb3JTdGF0ZSwgdmlzaWJsZVZpZXdSYW5nZTogUmFuZ2UsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZSB7XG5cdFx0Y29uc3Qgdmlld0xpbmVOdW1iZXIgPSBjdXJzb3Iudmlld1N0YXRlLnBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cblx0XHRpZiAodmlzaWJsZVZpZXdSYW5nZS5zdGFydExpbmVOdW1iZXIgPD0gdmlld0xpbmVOdW1iZXIgJiYgdmlld0xpbmVOdW1iZXIgPD0gdmlzaWJsZVZpZXdSYW5nZS5lbmRMaW5lTnVtYmVyIC0gMSkge1xuXHRcdFx0Ly8gTm90aGluZyB0byBkbywgY3Vyc29yIGlzIGluIHZpZXdwb3J0XG5cdFx0XHRyZXR1cm4gbmV3IEN1cnNvclN0YXRlKGN1cnNvci5tb2RlbFN0YXRlLCBjdXJzb3Iudmlld1N0YXRlKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZXQgbmV3Vmlld0xpbmVOdW1iZXI6IG51bWJlcjtcblx0XHRcdGlmICh2aWV3TGluZU51bWJlciA+IHZpc2libGVWaWV3UmFuZ2UuZW5kTGluZU51bWJlciAtIDEpIHtcblx0XHRcdFx0bmV3Vmlld0xpbmVOdW1iZXIgPSB2aXNpYmxlVmlld1JhbmdlLmVuZExpbmVOdW1iZXIgLSAxO1xuXHRcdFx0fSBlbHNlIGlmICh2aWV3TGluZU51bWJlciA8IHZpc2libGVWaWV3UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdG5ld1ZpZXdMaW5lTnVtYmVyID0gdmlzaWJsZVZpZXdSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXdWaWV3TGluZU51bWJlciA9IHZpZXdMaW5lTnVtYmVyO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcG9zaXRpb24gPSBNb3ZlT3BlcmF0aW9ucy52ZXJ0aWNhbCh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwsIHZpZXdMaW5lTnVtYmVyLCBjdXJzb3Iudmlld1N0YXRlLnBvc2l0aW9uLmNvbHVtbiwgY3Vyc29yLnZpZXdTdGF0ZS5sZWZ0b3ZlclZpc2libGVDb2x1bW5zLCBuZXdWaWV3TGluZU51bWJlciwgZmFsc2UpO1xuXHRcdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoY3Vyc29yLnZpZXdTdGF0ZS5tb3ZlKGluU2VsZWN0aW9uTW9kZSwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCBwb3NpdGlvbi5sZWZ0b3ZlclZpc2libGVDb2x1bW5zKSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgdGhlIG50aCBsaW5lIHN0YXJ0IGluY2x1ZGVkIGluIHRoZSByYW5nZSAoZnJvbSB0aGUgc3RhcnQpLlxuXHQgKi9cblx0cHJpdmF0ZSBzdGF0aWMgX2ZpcnN0TGluZU51bWJlckluUmFuZ2UobW9kZWw6IElDdXJzb3JTaW1wbGVNb2RlbCwgcmFuZ2U6IFJhbmdlLCBjb3VudDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdGlmIChyYW5nZS5zdGFydENvbHVtbiAhPT0gbW9kZWwuZ2V0TGluZU1pbkNvbHVtbihzdGFydExpbmVOdW1iZXIpKSB7XG5cdFx0XHQvLyBNb3ZlIG9uIHRvIHRoZSBzZWNvbmQgbGluZSBpZiB0aGUgZmlyc3QgbGluZSBzdGFydCBpcyBub3QgaW5jbHVkZWQgaW4gdGhlIHJhbmdlXG5cdFx0XHRzdGFydExpbmVOdW1iZXIrKztcblx0XHR9XG5cblx0XHRyZXR1cm4gTWF0aC5taW4ocmFuZ2UuZW5kTGluZU51bWJlciwgc3RhcnRMaW5lTnVtYmVyICsgY291bnQgLSAxKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGaW5kIHRoZSBudGggbGluZSBzdGFydCBpbmNsdWRlZCBpbiB0aGUgcmFuZ2UgKGZyb20gdGhlIGVuZCkuXG5cdCAqL1xuXHRwcml2YXRlIHN0YXRpYyBfbGFzdExpbmVOdW1iZXJJblJhbmdlKG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHJhbmdlOiBSYW5nZSwgY291bnQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0bGV0IHN0YXJ0TGluZU51bWJlciA9IHJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRpZiAocmFuZ2Uuc3RhcnRDb2x1bW4gIT09IG1vZGVsLmdldExpbmVNaW5Db2x1bW4oc3RhcnRMaW5lTnVtYmVyKSkge1xuXHRcdFx0Ly8gTW92ZSBvbiB0byB0aGUgc2Vjb25kIGxpbmUgaWYgdGhlIGZpcnN0IGxpbmUgc3RhcnQgaXMgbm90IGluY2x1ZGVkIGluIHRoZSByYW5nZVxuXHRcdFx0c3RhcnRMaW5lTnVtYmVyKys7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1hdGgubWF4KHN0YXJ0TGluZU51bWJlciwgcmFuZ2UuZW5kTGluZU51bWJlciAtIGNvdW50ICsgMSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZUxlZnQodmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIG5vT2ZDb2x1bW5zOiBudW1iZXIpOiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSB7XG5cdFx0cmV0dXJuIGN1cnNvcnMubWFwKGN1cnNvciA9PlxuXHRcdFx0Q3Vyc29yU3RhdGUuZnJvbVZpZXdTdGF0ZShcblx0XHRcdFx0TW92ZU9wZXJhdGlvbnMubW92ZUxlZnQodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBjdXJzb3Iudmlld1N0YXRlLCBpblNlbGVjdGlvbk1vZGUsIG5vT2ZDb2x1bW5zKVxuXHRcdFx0KVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZUhhbGZMaW5lTGVmdCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRjb25zdCB2aWV3TGluZU51bWJlciA9IGN1cnNvci52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IGhhbGZMaW5lID0gTWF0aC5yb3VuZCh2aWV3TW9kZWwuZ2V0TGluZUxlbmd0aCh2aWV3TGluZU51bWJlcikgLyAyKTtcblx0XHRcdHJlc3VsdFtpXSA9IEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoTW92ZU9wZXJhdGlvbnMubW92ZUxlZnQodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBjdXJzb3Iudmlld1N0YXRlLCBpblNlbGVjdGlvbk1vZGUsIGhhbGZMaW5lKSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZVJpZ2h0KHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yczogQ3Vyc29yU3RhdGVbXSwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuLCBub09mQ29sdW1uczogbnVtYmVyKTogUGFydGlhbEN1cnNvclN0YXRlW10ge1xuXHRcdHJldHVybiBjdXJzb3JzLm1hcChjdXJzb3IgPT5cblx0XHRcdEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoXG5cdFx0XHRcdE1vdmVPcGVyYXRpb25zLm1vdmVSaWdodCh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwsIGN1cnNvci52aWV3U3RhdGUsIGluU2VsZWN0aW9uTW9kZSwgbm9PZkNvbHVtbnMpXG5cdFx0XHQpXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tb3ZlSGFsZkxpbmVSaWdodCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRjb25zdCB2aWV3TGluZU51bWJlciA9IGN1cnNvci52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IGhhbGZMaW5lID0gTWF0aC5yb3VuZCh2aWV3TW9kZWwuZ2V0TGluZUxlbmd0aCh2aWV3TGluZU51bWJlcikgLyAyKTtcblx0XHRcdHJlc3VsdFtpXSA9IEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoTW92ZU9wZXJhdGlvbnMubW92ZVJpZ2h0KHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbCwgY3Vyc29yLnZpZXdTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlLCBoYWxmTGluZSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX21vdmVEb3duQnlWaWV3TGluZXModmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIGxpbmVzQ291bnQ6IG51bWJlcik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRyZXN1bHRbaV0gPSBDdXJzb3JTdGF0ZS5mcm9tVmlld1N0YXRlKE1vdmVPcGVyYXRpb25zLm1vdmVEb3duKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbCwgY3Vyc29yLnZpZXdTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlLCBsaW5lc0NvdW50KSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZURvd25CeU1vZGVsTGluZXModmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIGxpbmVzQ291bnQ6IG51bWJlcik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRyZXN1bHRbaV0gPSBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTdGF0ZShNb3ZlT3BlcmF0aW9ucy5tb3ZlRG93bih2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwubW9kZWwsIGN1cnNvci5tb2RlbFN0YXRlLCBpblNlbGVjdGlvbk1vZGUsIGxpbmVzQ291bnQpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tb3ZlVXBCeVZpZXdMaW5lcyh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiwgbGluZXNDb3VudDogbnVtYmVyKTogUGFydGlhbEN1cnNvclN0YXRlW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogUGFydGlhbEN1cnNvclN0YXRlW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gY3Vyc29ycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgY3Vyc29yID0gY3Vyc29yc1tpXTtcblx0XHRcdHJlc3VsdFtpXSA9IEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoTW92ZU9wZXJhdGlvbnMubW92ZVVwKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbCwgY3Vyc29yLnZpZXdTdGF0ZSwgaW5TZWxlY3Rpb25Nb2RlLCBsaW5lc0NvdW50KSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZVVwQnlNb2RlbExpbmVzKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yczogQ3Vyc29yU3RhdGVbXSwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuLCBsaW5lc0NvdW50OiBudW1iZXIpOiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjdXJzb3JzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBjdXJzb3IgPSBjdXJzb3JzW2ldO1xuXHRcdFx0cmVzdWx0W2ldID0gQ3Vyc29yU3RhdGUuZnJvbU1vZGVsU3RhdGUoTW92ZU9wZXJhdGlvbnMubW92ZVVwKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbC5tb2RlbCwgY3Vyc29yLm1vZGVsU3RhdGUsIGluU2VsZWN0aW9uTW9kZSwgbGluZXNDb3VudCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX21vdmVUb1ZpZXdQb3NpdGlvbih2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcjogQ3Vyc29yU3RhdGUsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiwgdG9WaWV3TGluZU51bWJlcjogbnVtYmVyLCB0b1ZpZXdDb2x1bW46IG51bWJlcik6IFBhcnRpYWxDdXJzb3JTdGF0ZSB7XG5cdFx0cmV0dXJuIEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUoY3Vyc29yLnZpZXdTdGF0ZS5tb3ZlKGluU2VsZWN0aW9uTW9kZSwgdG9WaWV3TGluZU51bWJlciwgdG9WaWV3Q29sdW1uLCAwKSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZVRvTW9kZWxQb3NpdGlvbih2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcjogQ3Vyc29yU3RhdGUsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiwgdG9Nb2RlbExpbmVOdW1iZXI6IG51bWJlciwgdG9Nb2RlbENvbHVtbjogbnVtYmVyKTogUGFydGlhbEN1cnNvclN0YXRlIHtcblx0XHRyZXR1cm4gQ3Vyc29yU3RhdGUuZnJvbU1vZGVsU3RhdGUoY3Vyc29yLm1vZGVsU3RhdGUubW92ZShpblNlbGVjdGlvbk1vZGUsIHRvTW9kZWxMaW5lTnVtYmVyLCB0b01vZGVsQ29sdW1uLCAwKSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZVRvVmlld01pbkNvbHVtbih2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRjb25zdCB2aWV3TGluZU51bWJlciA9IGN1cnNvci52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IHZpZXdDb2x1bW4gPSB2aWV3TW9kZWwuZ2V0TGluZU1pbkNvbHVtbih2aWV3TGluZU51bWJlcik7XG5cdFx0XHRyZXN1bHRbaV0gPSB0aGlzLl9tb3ZlVG9WaWV3UG9zaXRpb24odmlld01vZGVsLCBjdXJzb3IsIGluU2VsZWN0aW9uTW9kZSwgdmlld0xpbmVOdW1iZXIsIHZpZXdDb2x1bW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX21vdmVUb1ZpZXdGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4odmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4pOiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjdXJzb3JzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBjdXJzb3IgPSBjdXJzb3JzW2ldO1xuXHRcdFx0Y29uc3Qgdmlld0xpbmVOdW1iZXIgPSBjdXJzb3Iudmlld1N0YXRlLnBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCB2aWV3Q29sdW1uID0gdmlld01vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4odmlld0xpbmVOdW1iZXIpO1xuXHRcdFx0cmVzdWx0W2ldID0gdGhpcy5fbW92ZVRvVmlld1Bvc2l0aW9uKHZpZXdNb2RlbCwgY3Vyc29yLCBpblNlbGVjdGlvbk1vZGUsIHZpZXdMaW5lTnVtYmVyLCB2aWV3Q29sdW1uKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tb3ZlVG9WaWV3Q2VudGVyQ29sdW1uKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yczogQ3Vyc29yU3RhdGVbXSwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuKTogUGFydGlhbEN1cnNvclN0YXRlW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogUGFydGlhbEN1cnNvclN0YXRlW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gY3Vyc29ycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgY3Vyc29yID0gY3Vyc29yc1tpXTtcblx0XHRcdGNvbnN0IHZpZXdMaW5lTnVtYmVyID0gY3Vyc29yLnZpZXdTdGF0ZS5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0Y29uc3Qgdmlld0NvbHVtbiA9IE1hdGgucm91bmQoKHZpZXdNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHZpZXdMaW5lTnVtYmVyKSArIHZpZXdNb2RlbC5nZXRMaW5lTWluQ29sdW1uKHZpZXdMaW5lTnVtYmVyKSkgLyAyKTtcblx0XHRcdHJlc3VsdFtpXSA9IHRoaXMuX21vdmVUb1ZpZXdQb3NpdGlvbih2aWV3TW9kZWwsIGN1cnNvciwgaW5TZWxlY3Rpb25Nb2RlLCB2aWV3TGluZU51bWJlciwgdmlld0NvbHVtbik7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfbW92ZVRvVmlld01heENvbHVtbih2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRjb25zdCB2aWV3TGluZU51bWJlciA9IGN1cnNvci52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IHZpZXdDb2x1bW4gPSB2aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbih2aWV3TGluZU51bWJlcik7XG5cdFx0XHRyZXN1bHRbaV0gPSB0aGlzLl9tb3ZlVG9WaWV3UG9zaXRpb24odmlld01vZGVsLCBjdXJzb3IsIGluU2VsZWN0aW9uTW9kZSwgdmlld0xpbmVOdW1iZXIsIHZpZXdDb2x1bW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX21vdmVUb1ZpZXdMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbih2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGN1cnNvcnM6IEN1cnNvclN0YXRlW10sIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbik6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnNvciA9IGN1cnNvcnNbaV07XG5cdFx0XHRjb25zdCB2aWV3TGluZU51bWJlciA9IGN1cnNvci52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IHZpZXdDb2x1bW4gPSB2aWV3TW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKHZpZXdMaW5lTnVtYmVyKTtcblx0XHRcdHJlc3VsdFtpXSA9IHRoaXMuX21vdmVUb1ZpZXdQb3NpdGlvbih2aWV3TW9kZWwsIGN1cnNvciwgaW5TZWxlY3Rpb25Nb2RlLCB2aWV3TGluZU51bWJlciwgdmlld0NvbHVtbik7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDdXJzb3JNb3ZlIHtcblxuXHRjb25zdCBpc0N1cnNvck1vdmVBcmdzID0gZnVuY3Rpb24gKGFyZzogYW55KTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0eXBlcy5pc09iamVjdChhcmcpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3Vyc29yTW92ZUFyZzogUmF3QXJndW1lbnRzID0gYXJnO1xuXG5cdFx0aWYgKCF0eXBlcy5pc1N0cmluZyhjdXJzb3JNb3ZlQXJnLnRvKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghdHlwZXMuaXNVbmRlZmluZWQoY3Vyc29yTW92ZUFyZy5zZWxlY3QpICYmICF0eXBlcy5pc0Jvb2xlYW4oY3Vyc29yTW92ZUFyZy5zZWxlY3QpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCF0eXBlcy5pc1VuZGVmaW5lZChjdXJzb3JNb3ZlQXJnLmJ5KSAmJiAhdHlwZXMuaXNTdHJpbmcoY3Vyc29yTW92ZUFyZy5ieSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIXR5cGVzLmlzVW5kZWZpbmVkKGN1cnNvck1vdmVBcmcudmFsdWUpICYmICF0eXBlcy5pc051bWJlcihjdXJzb3JNb3ZlQXJnLnZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9O1xuXG5cdGV4cG9ydCBjb25zdCBtZXRhZGF0YTogSUNvbW1hbmRNZXRhZGF0YSA9IHtcblx0XHRkZXNjcmlwdGlvbjogJ01vdmUgY3Vyc29yIHRvIGEgbG9naWNhbCBwb3NpdGlvbiBpbiB0aGUgdmlldycsXG5cdFx0YXJnczogW1xuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiAnQ3Vyc29yIG1vdmUgYXJndW1lbnQgb2JqZWN0Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGBQcm9wZXJ0eS12YWx1ZSBwYWlycyB0aGF0IGNhbiBiZSBwYXNzZWQgdGhyb3VnaCB0aGlzIGFyZ3VtZW50OlxuXHRcdFx0XHRcdCogJ3RvJzogQSBtYW5kYXRvcnkgbG9naWNhbCBwb3NpdGlvbiB2YWx1ZSBwcm92aWRpbmcgd2hlcmUgdG8gbW92ZSB0aGUgY3Vyc29yLlxuXHRcdFx0XHRcdFx0XFxgXFxgXFxgXG5cdFx0XHRcdFx0XHQnbGVmdCcsICdyaWdodCcsICd1cCcsICdkb3duJywgJ3ByZXZCbGFua0xpbmUnLCAnbmV4dEJsYW5rTGluZScsXG5cdFx0XHRcdFx0XHQnd3JhcHBlZExpbmVTdGFydCcsICd3cmFwcGVkTGluZUVuZCcsICd3cmFwcGVkTGluZUNvbHVtbkNlbnRlcidcblx0XHRcdFx0XHRcdCd3cmFwcGVkTGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNoYXJhY3RlcicsICd3cmFwcGVkTGluZUxhc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyJ1xuXHRcdFx0XHRcdFx0J3ZpZXdQb3J0VG9wJywgJ3ZpZXdQb3J0Q2VudGVyJywgJ3ZpZXdQb3J0Qm90dG9tJywgJ3ZpZXdQb3J0SWZPdXRzaWRlJ1xuXHRcdFx0XHRcdFx0XFxgXFxgXFxgXG5cdFx0XHRcdFx0KiAnYnknOiBVbml0IHRvIG1vdmUuIERlZmF1bHQgaXMgY29tcHV0ZWQgYmFzZWQgb24gJ3RvJyB2YWx1ZS5cblx0XHRcdFx0XHRcdFxcYFxcYFxcYFxuXHRcdFx0XHRcdFx0J2xpbmUnLCAnd3JhcHBlZExpbmUnLCAnY2hhcmFjdGVyJywgJ2hhbGZMaW5lJ1xuXHRcdFx0XHRcdFx0XFxgXFxgXFxgXG5cdFx0XHRcdFx0KiAndmFsdWUnOiBOdW1iZXIgb2YgdW5pdHMgdG8gbW92ZS4gRGVmYXVsdCBpcyAnMScuXG5cdFx0XHRcdFx0KiAnc2VsZWN0JzogSWYgJ3RydWUnIG1ha2VzIHRoZSBzZWxlY3Rpb24uIERlZmF1bHQgaXMgJ2ZhbHNlJy5cblx0XHRcdFx0YCxcblx0XHRcdFx0Y29uc3RyYWludDogaXNDdXJzb3JNb3ZlQXJncyxcblx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHQncmVxdWlyZWQnOiBbJ3RvJ10sXG5cdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHQndG8nOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdCdlbnVtJzogWydsZWZ0JywgJ3JpZ2h0JywgJ3VwJywgJ2Rvd24nLCAncHJldkJsYW5rTGluZScsICduZXh0QmxhbmtMaW5lJywgJ3dyYXBwZWRMaW5lU3RhcnQnLCAnd3JhcHBlZExpbmVFbmQnLCAnd3JhcHBlZExpbmVDb2x1bW5DZW50ZXInLCAnd3JhcHBlZExpbmVGaXJzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXInLCAnd3JhcHBlZExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNoYXJhY3RlcicsICd2aWV3UG9ydFRvcCcsICd2aWV3UG9ydENlbnRlcicsICd2aWV3UG9ydEJvdHRvbScsICd2aWV3UG9ydElmT3V0c2lkZSddXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J2J5Jzoge1xuXHRcdFx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHQnZW51bSc6IFsnbGluZScsICd3cmFwcGVkTGluZScsICdjaGFyYWN0ZXInLCAnaGFsZkxpbmUnXVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdCd2YWx1ZSc6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRcdFx0J2RlZmF1bHQnOiAxXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J3NlbGVjdCc6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdCdkZWZhdWx0JzogZmFsc2Vcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRdXG5cdH07XG5cblx0LyoqXG5cdCAqIFBvc2l0aW9ucyBpbiB0aGUgdmlldyBmb3IgY3Vyc29yIG1vdmUgY29tbWFuZC5cblx0ICovXG5cdGV4cG9ydCBjb25zdCBSYXdEaXJlY3Rpb24gPSB7XG5cdFx0TGVmdDogJ2xlZnQnLFxuXHRcdFJpZ2h0OiAncmlnaHQnLFxuXHRcdFVwOiAndXAnLFxuXHRcdERvd246ICdkb3duJyxcblxuXHRcdFByZXZCbGFua0xpbmU6ICdwcmV2QmxhbmtMaW5lJyxcblx0XHROZXh0QmxhbmtMaW5lOiAnbmV4dEJsYW5rTGluZScsXG5cblx0XHRXcmFwcGVkTGluZVN0YXJ0OiAnd3JhcHBlZExpbmVTdGFydCcsXG5cdFx0V3JhcHBlZExpbmVGaXJzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXI6ICd3cmFwcGVkTGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNoYXJhY3RlcicsXG5cdFx0V3JhcHBlZExpbmVDb2x1bW5DZW50ZXI6ICd3cmFwcGVkTGluZUNvbHVtbkNlbnRlcicsXG5cdFx0V3JhcHBlZExpbmVFbmQ6ICd3cmFwcGVkTGluZUVuZCcsXG5cdFx0V3JhcHBlZExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNoYXJhY3RlcjogJ3dyYXBwZWRMaW5lTGFzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXInLFxuXG5cdFx0Vmlld1BvcnRUb3A6ICd2aWV3UG9ydFRvcCcsXG5cdFx0Vmlld1BvcnRDZW50ZXI6ICd2aWV3UG9ydENlbnRlcicsXG5cdFx0Vmlld1BvcnRCb3R0b206ICd2aWV3UG9ydEJvdHRvbScsXG5cblx0XHRWaWV3UG9ydElmT3V0c2lkZTogJ3ZpZXdQb3J0SWZPdXRzaWRlJ1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBVbml0cyBmb3IgQ3Vyc29yIG1vdmUgJ2J5JyBhcmd1bWVudFxuXHQgKi9cblx0ZXhwb3J0IGNvbnN0IFJhd1VuaXQgPSB7XG5cdFx0TGluZTogJ2xpbmUnLFxuXHRcdFdyYXBwZWRMaW5lOiAnd3JhcHBlZExpbmUnLFxuXHRcdENoYXJhY3RlcjogJ2NoYXJhY3RlcicsXG5cdFx0SGFsZkxpbmU6ICdoYWxmTGluZSdcblx0fTtcblxuXHQvKipcblx0ICogQXJndW1lbnRzIGZvciBDdXJzb3IgbW92ZSBjb21tYW5kXG5cdCAqL1xuXHRleHBvcnQgaW50ZXJmYWNlIFJhd0FyZ3VtZW50cyB7XG5cdFx0dG86IHN0cmluZztcblx0XHRzZWxlY3Q/OiBib29sZWFuO1xuXHRcdGJ5Pzogc3RyaW5nO1xuXHRcdHZhbHVlPzogbnVtYmVyO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHBhcnNlKGFyZ3M6IFBhcnRpYWw8UmF3QXJndW1lbnRzPik6IFBhcnNlZEFyZ3VtZW50cyB8IG51bGwge1xuXHRcdGlmICghYXJncy50bykge1xuXHRcdFx0Ly8gaWxsZWdhbCBhcmd1bWVudHNcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGxldCBkaXJlY3Rpb246IERpcmVjdGlvbjtcblx0XHRzd2l0Y2ggKGFyZ3MudG8pIHtcblx0XHRcdGNhc2UgUmF3RGlyZWN0aW9uLkxlZnQ6XG5cdFx0XHRcdGRpcmVjdGlvbiA9IERpcmVjdGlvbi5MZWZ0O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmF3RGlyZWN0aW9uLlJpZ2h0OlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uUmlnaHQ7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdEaXJlY3Rpb24uVXA6XG5cdFx0XHRcdGRpcmVjdGlvbiA9IERpcmVjdGlvbi5VcDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5Eb3duOlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uRG93bjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5QcmV2QmxhbmtMaW5lOlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uUHJldkJsYW5rTGluZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5OZXh0QmxhbmtMaW5lOlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uTmV4dEJsYW5rTGluZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5XcmFwcGVkTGluZVN0YXJ0OlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uV3JhcHBlZExpbmVTdGFydDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5XcmFwcGVkTGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNoYXJhY3Rlcjpcblx0XHRcdFx0ZGlyZWN0aW9uID0gRGlyZWN0aW9uLldyYXBwZWRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmF3RGlyZWN0aW9uLldyYXBwZWRMaW5lQ29sdW1uQ2VudGVyOlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uV3JhcHBlZExpbmVDb2x1bW5DZW50ZXI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdEaXJlY3Rpb24uV3JhcHBlZExpbmVFbmQ6XG5cdFx0XHRcdGRpcmVjdGlvbiA9IERpcmVjdGlvbi5XcmFwcGVkTGluZUVuZDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5XcmFwcGVkTGluZUxhc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyOlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uV3JhcHBlZExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNoYXJhY3Rlcjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5WaWV3UG9ydFRvcDpcblx0XHRcdFx0ZGlyZWN0aW9uID0gRGlyZWN0aW9uLlZpZXdQb3J0VG9wO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmF3RGlyZWN0aW9uLlZpZXdQb3J0Qm90dG9tOlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uVmlld1BvcnRCb3R0b207XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdEaXJlY3Rpb24uVmlld1BvcnRDZW50ZXI6XG5cdFx0XHRcdGRpcmVjdGlvbiA9IERpcmVjdGlvbi5WaWV3UG9ydENlbnRlcjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5WaWV3UG9ydElmT3V0c2lkZTpcblx0XHRcdFx0ZGlyZWN0aW9uID0gRGlyZWN0aW9uLlZpZXdQb3J0SWZPdXRzaWRlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdC8vIGlsbGVnYWwgYXJndW1lbnRzXG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGxldCB1bml0ID0gVW5pdC5Ob25lO1xuXHRcdHN3aXRjaCAoYXJncy5ieSkge1xuXHRcdFx0Y2FzZSBSYXdVbml0LkxpbmU6XG5cdFx0XHRcdHVuaXQgPSBVbml0LkxpbmU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdVbml0LldyYXBwZWRMaW5lOlxuXHRcdFx0XHR1bml0ID0gVW5pdC5XcmFwcGVkTGluZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd1VuaXQuQ2hhcmFjdGVyOlxuXHRcdFx0XHR1bml0ID0gVW5pdC5DaGFyYWN0ZXI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdVbml0LkhhbGZMaW5lOlxuXHRcdFx0XHR1bml0ID0gVW5pdC5IYWxmTGluZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpcmVjdGlvbjogZGlyZWN0aW9uLFxuXHRcdFx0dW5pdDogdW5pdCxcblx0XHRcdHNlbGVjdDogKCEhYXJncy5zZWxlY3QpLFxuXHRcdFx0dmFsdWU6IChhcmdzLnZhbHVlIHx8IDEpXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkQXJndW1lbnRzIHtcblx0XHRkaXJlY3Rpb246IERpcmVjdGlvbjtcblx0XHR1bml0OiBVbml0O1xuXHRcdHNlbGVjdDogYm9vbGVhbjtcblx0XHR2YWx1ZTogbnVtYmVyO1xuXHR9XG5cblx0ZXhwb3J0IGludGVyZmFjZSBTaW1wbGVNb3ZlQXJndW1lbnRzIHtcblx0XHRkaXJlY3Rpb246IFNpbXBsZU1vdmVEaXJlY3Rpb247XG5cdFx0dW5pdDogVW5pdDtcblx0XHRzZWxlY3Q6IGJvb2xlYW47XG5cdFx0dmFsdWU6IG51bWJlcjtcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBlbnVtIERpcmVjdGlvbiB7XG5cdFx0TGVmdCxcblx0XHRSaWdodCxcblx0XHRVcCxcblx0XHREb3duLFxuXHRcdFByZXZCbGFua0xpbmUsXG5cdFx0TmV4dEJsYW5rTGluZSxcblxuXHRcdFdyYXBwZWRMaW5lU3RhcnQsXG5cdFx0V3JhcHBlZExpbmVGaXJzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXIsXG5cdFx0V3JhcHBlZExpbmVDb2x1bW5DZW50ZXIsXG5cdFx0V3JhcHBlZExpbmVFbmQsXG5cdFx0V3JhcHBlZExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNoYXJhY3RlcixcblxuXHRcdFZpZXdQb3J0VG9wLFxuXHRcdFZpZXdQb3J0Q2VudGVyLFxuXHRcdFZpZXdQb3J0Qm90dG9tLFxuXG5cdFx0Vmlld1BvcnRJZk91dHNpZGUsXG5cdH1cblxuXHRleHBvcnQgdHlwZSBTaW1wbGVNb3ZlRGlyZWN0aW9uID0gKFxuXHRcdERpcmVjdGlvbi5MZWZ0XG5cdFx0fCBEaXJlY3Rpb24uUmlnaHRcblx0XHR8IERpcmVjdGlvbi5VcFxuXHRcdHwgRGlyZWN0aW9uLkRvd25cblx0XHR8IERpcmVjdGlvbi5QcmV2QmxhbmtMaW5lXG5cdFx0fCBEaXJlY3Rpb24uTmV4dEJsYW5rTGluZVxuXHRcdHwgRGlyZWN0aW9uLldyYXBwZWRMaW5lU3RhcnRcblx0XHR8IERpcmVjdGlvbi5XcmFwcGVkTGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNoYXJhY3RlclxuXHRcdHwgRGlyZWN0aW9uLldyYXBwZWRMaW5lQ29sdW1uQ2VudGVyXG5cdFx0fCBEaXJlY3Rpb24uV3JhcHBlZExpbmVFbmRcblx0XHR8IERpcmVjdGlvbi5XcmFwcGVkTGluZUxhc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyXG5cdCk7XG5cblx0ZXhwb3J0IHR5cGUgVmlld3BvcnREaXJlY3Rpb24gPSAoXG5cdFx0RGlyZWN0aW9uLlZpZXdQb3J0VG9wXG5cdFx0fCBEaXJlY3Rpb24uVmlld1BvcnRDZW50ZXJcblx0XHR8IERpcmVjdGlvbi5WaWV3UG9ydEJvdHRvbVxuXHRcdHwgRGlyZWN0aW9uLlZpZXdQb3J0SWZPdXRzaWRlXG5cdCk7XG5cblx0ZXhwb3J0IGNvbnN0IGVudW0gVW5pdCB7XG5cdFx0Tm9uZSxcblx0XHRMaW5lLFxuXHRcdFdyYXBwZWRMaW5lLFxuXHRcdENoYXJhY3Rlcixcblx0XHRIYWxmTGluZSxcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFdBQVc7QUFDdkIsU0FBUyxhQUFxRCxvQkFBb0IseUJBQXlCO0FBQzNHLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQW9CLGdCQUFnQjtBQUNwQyxTQUFTLGFBQWE7QUFJZixNQUFNLG1CQUFtQjtBQUFBLEVBRS9CLE9BQWMsY0FBYyxXQUF1QixTQUF3QixnQkFBK0M7QUFDekgsVUFBTSxTQUErQixDQUFDO0FBQ3RDLFFBQUksWUFBWTtBQUNoQixhQUFTLElBQUksR0FBRyxNQUFNLFFBQVEsUUFBUSxJQUFJLEtBQUssS0FBSztBQUNuRCxZQUFNLFNBQVMsUUFBUSxDQUFDO0FBQ3hCLGFBQU8sV0FBVyxJQUFJLElBQUksWUFBWSxPQUFPLFlBQVksT0FBTyxTQUFTO0FBQ3pFLFVBQUksZ0JBQWdCO0FBQ25CLGVBQU8sV0FBVyxJQUFJLFlBQVksZUFBZSxlQUFlLGNBQWMsVUFBVSxjQUFjLFVBQVUsT0FBTyxPQUFPLFVBQVUsQ0FBQztBQUFBLE1BQzFJLE9BQU87QUFDTixlQUFPLFdBQVcsSUFBSSxZQUFZLGNBQWMsZUFBZSxjQUFjLFVBQVUsY0FBYyxXQUFXLE9BQU8sU0FBUyxDQUFDO0FBQUEsTUFDbEk7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE9BQWMsWUFBWSxXQUF1QixTQUF3QixnQkFBK0M7QUFDdkgsVUFBTSxTQUErQixDQUFDO0FBQ3RDLFFBQUksWUFBWTtBQUNoQixhQUFT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S0EsWUFBQSxhQUFhO0FBQ2pCLG9CQUFZO0FBQ1o7QUFBQSxNQUNELEtBQUtBLFlBQUEsYUFBYTtBQUNqQixvQkFBWTtBQUNaO0FBQUEsTUFDRCxLQUFLQSxZQUFBLGFBQWE7QUFDakIsb0JBQVk7QUFDWjtBQUFBLE1BQ0QsS0FBS0EsWUFBQSxhQUFhO0FBQ2pCLG9CQUFZO0FBQ1o7QUFBQSxNQUNELEtBQUtBLFlBQUEsYUFBYTtBQUNqQixvQkFBWTtBQUNaO0FBQUEsTUFDRCxLQUFLQSxZQUFBLGFBQWE7QUFDakIsb0JBQVk7QUFDWjtBQUFBLE1BQ0Q7QUFFQyxlQUFPO0FBQUEsSUFDVDtBQUVBLFFBQUksT0FBTztBQUNYLFlBQVEsS0FBSyxJQUFJO0FBQUEsTUFDaEIsS0FBS0EsWUFBQSxRQUFRO0FBQ1osZUFBTztBQUNQO0FBQUEsTUFDRCxLQUFLQSxZQUFBLFFBQVE7QUFDWixlQUFPO0FBQ1A7QUFBQSxNQUNELEtBQUtBLFlBQUEsUUFBUTtBQUNaLGVBQU87QUFDUDtBQUFBLE1BQ0QsS0FBS0EsWUFBQSxRQUFRO0FBQ1osZUFBTztBQUNQO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0EsUUFBUyxDQUFDLENBQUMsS0FBSztBQUFBLE1BQ2hCLE9BQVEsS0FBSyxTQUFTO0FBQUEsSUFDdkI7QUFBQSxFQUNEO0FBaEZPLEVBQUFBLFlBQVM7QUFnR1QsTUFBVztBQUFYLElBQVdDLGVBQVg7QUFDTixJQUFBQSxzQkFBQTtBQUNBLElBQUFBLHNCQUFBO0FBQ0EsSUFBQUEsc0JBQUE7QUFDQSxJQUFBQSxzQkFBQTtBQUNBLElBQUFBLHNCQUFBO0FBQ0EsSUFBQUEsc0JBQUE7QUFFQSxJQUFBQSxzQkFBQTtBQUNBLElBQUFBLHNCQUFBO0FBQ0EsSUFBQUEsc0JBQUE7QUFDQSxJQUFBQSxzQkFBQTtBQUNBLElBQUFBLHNCQUFBO0FBRUEsSUFBQUEsc0JBQUE7QUFDQSxJQUFBQSxzQkFBQTtBQUNBLElBQUFBLHNCQUFBO0FBRUEsSUFBQUEsc0JBQUE7QUFBQSxLQWxCaUIsWUFBQUQsWUFBQSxjQUFBQSxZQUFBO0FBMENYLE1BQVc7QUFBWCxJQUFXRSxVQUFYO0FBQ04sSUFBQUEsWUFBQTtBQUNBLElBQUFBLFlBQUE7QUFDQSxJQUFBQSxZQUFBO0FBQ0EsSUFBQUEsWUFBQTtBQUNBLElBQUFBLFlBQUE7QUFBQSxLQUxpQixPQUFBRixZQUFBLFNBQUFBLFlBQUE7QUFBQSxHQWxRRjsiLAogICJuYW1lcyI6IFsiQ3Vyc29yTW92ZSIsICJEaXJlY3Rpb24iLCAiVW5pdCJdCn0K
