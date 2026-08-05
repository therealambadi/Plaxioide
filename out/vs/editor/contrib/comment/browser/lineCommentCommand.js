import { CharCode } from "../../../../base/common/charCode.js";
import * as strings from "../../../../base/common/strings.js";
import { Constants } from "../../../../base/common/uint.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { BlockCommentCommand } from "./blockCommentCommand.js";
var Type = /* @__PURE__ */ ((Type2) => {
  Type2[Type2["Toggle"] = 0] = "Toggle";
  Type2[Type2["ForceAdd"] = 1] = "ForceAdd";
  Type2[Type2["ForceRemove"] = 2] = "ForceRemove";
  return Type2;
})(Type || {});
class LineCommentCommand {
  constructor(languageConfigurationService, selection, indentSize, type, insertSpace, ignoreEmptyLines, ignoreFirstLine) {
    this.languageConfigurationService = languageConfigurationService;
    this._selection = selection;
    this._indentSize = indentSize;
    this._type = type;
    this._insertSpace = insertSpace;
    this._selectionId = null;
    this._deltaColumn = 0;
    this._moveEndPositionDown = false;
    this._ignoreEmptyLines = ignoreEmptyLines;
    this._ignoreFirstLine = ignoreFirstLine || false;
  }
  /**
   * Do an initial pass over the lines and gather info about the line comment string.
   * Returns null if any of the lines doesn't support a line comment string.
   */
  static _gatherPreflightCommentStrings(model, startLineNumber, endLineNumber, languageConfigurationService) {
    model.tokenization.tokenizeIfCheap(startLineNumber);
    const languageId = model.getLanguageIdAtPosition(startLineNumber, 1);
    const config = languageConfigurationService.getLanguageConfiguration(languageId).comments;
    const commentStr = config ? config.lineCommentToken : null;
    if (!commentStr) {
      return null;
    }
    const lines = [];
    for (let i = 0, lineCount = endLineNumber - startLineNumber + 1; i < lineCount; i++) {
      lines[i] = {
        ignore: false,
        commentStr,
        commentStrOffset: 0,
        commentStrLength: commentStr.length
      };
    }
    return lines;
  }
  /**
   * Analyze lines and decide which lines are relevant and what the toggle should do.
   * Also, build up several offsets and lengths useful in the generation of editor operations.
   */
  static _analyzeLines(type, insertSpace, model, lines, startLineNumber, ignoreEmptyLines, ignoreFirstLine, languageConfigurationService) {
    let onlyWhitespaceLines = true;
    let shouldRemoveComments;
    if (type === 0 /* Toggle */) {
      shouldRemoveComments = true;
    } else if (type === 1 /* ForceAdd */) {
      shouldRemoveComments = false;
    } else {
      shouldRemoveComments = true;
    }
    for (let i = 0, lineCount = lines.length; i < lineCount; i++) {
      const lineData = lines[i];
      const lineNumber = startLineNumber + i;
      if (lineNumber === startLineNumber && ignoreFirstLine) {
        lineData.ignore = true;
        continue;
      }
      const lineContent = model.getLineContent(lineNumber);
      const lineContentStartOffset = strings.firstNonWhitespaceIndex(lineContent);
      if (lineContentStartOffset === -1) {
        lineData.ignore = ignoreEmptyLines;
        lineData.commentStrOffset = lineContent.length;
        continue;
      }
      onlyWhitespaceLines = false;
      lineData.ignore = false;
      lineData.commentStrOffset = lineContentStartOffset;
      if (shouldRemoveComments && !BlockCommentCommand._haystackHasNeedleAtOffset(lineContent, lineData.commentStr, lineContentStartOffset)) {
        if (type === 0 /* Toggle */) {
          shouldRemoveComments = false;
        } else if (type === 1 /* ForceAdd */) {
        } else {
          lineData.ignore = true;
        }
      }
      if (shouldRemoveComments && insertSpace) {
        const commentStrEndOffset = lineContentStartOffset + lineData.commentStrLength;
        if (commentStrEndOffset < lineContent.length && lineContent.charCodeAt(commentStrEndOffset) === CharCode.Space) {
          lineData.commentStrLength += 1;
        }
      }
    }
    if (type === 0 /* Toggle */ && onlyWhitespaceLines) {
      shouldRemoveComments = false;
      for (let i = 0, lineCount = lines.length; i < lineCount; i++) {
        lines[i].ignore = false;
      }
    }
    return {
      supported: true,
      shouldRemoveComments,
      lines
    };
  }
  /**
   * Analyze all lines and decide exactly what to do => not supported | insert line comments | remove line comments
   */
  static _gatherPreflightData(type, insertSpace, model, startLineNumber, endLineNumber, ignoreEmptyLines, ignoreFirstLine, languageConfigurationService) {
    const lines = LineCommentCommand._gatherPreflightCommentStrings(model, startLineNumber, endLineNumber, languageConfigurationService);
    if (lines === null) {
      return {
        supported: false
      };
    }
    return LineCommentCommand._analyzeLines(type, insertSpace, model, lines, startLineNumber, ignoreEmptyLines, ignoreFirstLine, languageConfigurationService);
  }
  /**
   * Given a successful analysis, execute either insert line comments, either remove line comments
   */
  _executeLineComments(model, builder, data, s) {
    let ops;
    if (data.shouldRemoveComments) {
      ops = LineCommentCommand._createRemoveLineCommentsOperations(data.lines, s.startLineNumber);
    } else {
      LineCommentCommand._normalizeInsertionPoint(model, data.lines, s.startLineNumber, this._indentSize);
      ops = this._createAddLineCommentsOperations(data.lines, s.startLineNumber);
    }
    const cursorPosition = new Position(s.positionLineNumber, s.positionColumn);
    for (let i = 0, len = ops.length; i < len; i++) {
      builder.addEditOperation(ops[i].range, ops[i].text);
      if (Range.isEmpty(ops[i].range) && Range.getStartPosition(ops[i].range).equals(cursorPosition)) {
        const lineContent = model.getLineContent(cursorPosition.lineNumber);
        if (lineContent.length + 1 === cursorPosition.column) {
          this._deltaColumn = (ops[i].text || "").length;
        }
      }
    }
    this._selectionId = builder.trackSelection(s);
  }
  _attemptRemoveBlockComment(model, s, startToken, endToken) {
    let startLineNumber = s.startLineNumber;
    let endLineNumber = s.endLineNumber;
    const startTokenAllowedBeforeColumn = endToken.length + Math.max(
      model.getLineFirstNonWhitespaceColumn(s.startLineNumber),
      s.startColumn
    );
    let startTokenIndex = model.getLineContent(startLineNumber).lastIndexOf(startToken, startTokenAllowedBeforeColumn - 1);
    let endTokenIndex = model.getLineContent(endLineNumber).indexOf(endToken, s.endColumn - 1 - startToken.length);
    if (startTokenIndex !== -1 && endTokenIndex === -1) {
      endTokenIndex = model.getLineContent(startLineNumber).indexOf(endToken, startTokenIndex + startToken.length);
      endLineNumber = startLineNumber;
    }
    if (startTokenIndex === -1 && endTokenIndex !== -1) {
      startTokenIndex = model.getLineContent(endLineNumber).lastIndexOf(startToken, endTokenIndex);
      startLineNumber = endLineNumber;
    }
    if (s.isEmpty() && (startTokenIndex === -1 || endTokenIndex === -1)) {
      startTokenIndex = model.getLineContent(startLineNumber).indexOf(startToken);
      if (startTokenIndex !== -1) {
        endTokenIndex = model.getLineContent(startLineNumber).indexOf(endToken, startTokenIndex + startToken.length);
      }
    }
    if (startTokenIndex !== -1 && model.getLineContent(startLineNumber).charCodeAt(startTokenIndex + startToken.length) === CharCode.Space) {
      startToken += " ";
    }
    if (endTokenIndex !== -1 && model.getLineContent(endLineNumber).charCodeAt(endTokenIndex - 1) === CharCode.Space) {
      endToken = " " + endToken;
      endTokenIndex -= 1;
    }
    if (startTokenIndex !== -1 && endTokenIndex !== -1) {
      return BlockCommentCommand._createRemoveBlockCommentOperations(
        new Range(startLineNumber, startTokenIndex + startToken.length + 1, endLineNumber, endTokenIndex + 1),
        startToken,
        endToken
      );
    }
    return null;
  }
  /**
   * Given an unsuccessful analysis, delegate to the block comment command
   */
  _executeBlockComment(model, builder, s) {
    model.tokenization.tokenizeIfCheap(s.startLineNumber);
    const languageId = model.getLanguageIdAtPosition(s.startLineNumber, 1);
    const config = this.languageConfigurationService.getLanguageConfiguration(languageId).comments;
    if (!config || !config.blockCommentStartToken || !config.blockCommentEndToken) {
      return;
    }
    const startToken = config.blockCommentStartToken;
    const endToken = config.blockCommentEndToken;
    let ops = this._attemptRemoveBlockComment(model, s, startToken, endToken);
    if (!ops) {
      if (s.isEmpty()) {
        const lineContent = model.getLineContent(s.startLineNumber);
        let firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineContent);
        if (firstNonWhitespaceIndex === -1) {
          firstNonWhitespaceIndex = lineContent.length;
        }
        ops = BlockCommentCommand._createAddBlockCommentOperations(
          new Range(s.startLineNumber, firstNonWhitespaceIndex + 1, s.startLineNumber, lineContent.length + 1),
          startToken,
          endToken,
          this._insertSpace
        );
      } else {
        ops = BlockCommentCommand._createAddBlockCommentOperations(
          new Range(s.startLineNumber, model.getLineFirstNonWhitespaceColumn(s.startLineNumber), s.endLineNumber, model.getLineMaxColumn(s.endLineNumber)),
          startToken,
          endToken,
          this._insertSpace
        );
      }
      if (ops.length === 1) {
        this._deltaColumn = startToken.length + 1;
      }
    }
    this._selectionId = builder.trackSelection(s);
    for (const op of ops) {
      builder.addEditOperation(op.range, op.text);
    }
  }
  getEditOperations(model, builder) {
    let s = this._selection;
    this._moveEndPositionDown = false;
    if (s.startLineNumber === s.endLineNumber && this._ignoreFirstLine) {
      builder.addEditOperation(new Range(s.startLineNumber, model.getLineMaxColumn(s.startLineNumber), s.startLineNumber + 1, 1), s.startLineNumber === model.getLineCount() ? "" : "\n");
      this._selectionId = builder.trackSelection(s);
      return;
    }
    if (s.startLineNumber < s.endLineNumber && s.endColumn === 1) {
      this._moveEndPositionDown = true;
      s = s.setEndPosition(s.endLineNumber - 1, model.getLineMaxColumn(s.endLineNumber - 1));
    }
    const data = LineCommentCommand._gatherPreflightData(
      this._type,
      this._insertSpace,
      model,
      s.startLineNumber,
      s.endLineNumber,
      this._ignoreEmptyLines,
      this._ignoreFirstLine,
      this.languageConfigurationService
    );
    if (data.supported) {
      return this._executeLineComments(model, builder, data, s);
    }
    return this._executeBlockComment(model, builder, s);
  }
  computeCursorState(model, helper) {
    let result = helper.getTrackedSelection(this._selectionId);
    if (this._moveEndPositionDown) {
      result = result.setEndPosition(result.endLineNumber + 1, 1);
    }
    return new Selection(
      result.selectionStartLineNumber,
      result.selectionStartColumn + this._deltaColumn,
      result.positionLineNumber,
      result.positionColumn + this._deltaColumn
    );
  }
  /**
   * Generate edit operations in the remove line comment case
   */
  static _createRemoveLineCommentsOperations(lines, startLineNumber) {
    const res = [];
    for (let i = 0, len = lines.length; i < len; i++) {
      const lineData = lines[i];
      if (lineData.ignore) {
        continue;
      }
      res.push(EditOperation.delete(new Range(
        startLineNumber + i,
        lineData.commentStrOffset + 1,
        startLineNumber + i,
        lineData.commentStrOffset + lineData.commentStrLength + 1
      )));
    }
    return res;
  }
  /**
   * Generate edit operations in the add line comment case
   */
  _createAddLineCommentsOperations(lines, startLineNumber) {
    const res = [];
    const afterCommentStr = this._insertSpace ? " " : "";
    for (let i = 0, len = lines.length; i < len; i++) {
      const lineData = lines[i];
      if (lineData.ignore) {
        continue;
      }
      res.push(EditOperation.insert(new Position(startLineNumber + i, lineData.commentStrOffset + 1), lineData.commentStr + afterCommentStr));
    }
    return res;
  }
  static nextVisibleColumn(currentVisibleColumn, indentSize, isTab, columnSize) {
    if (isTab) {
      return currentVisibleColumn + (indentSize - currentVisibleColumn % indentSize);
    }
    return currentVisibleColumn + columnSize;
  }
  /**
   * Adjust insertion points to have them vertically aligned in the add line comment case
   */
  static _normalizeInsertionPoint(model, lines, startLineNumber, indentSize) {
    let minVisibleColumn = Constants.MAX_SAFE_SMALL_INTEGER;
    let j;
    let lenJ;
    for (let i = 0, len = lines.length; i < len; i++) {
      if (lines[i].ignore) {
        continue;
      }
      const lineContent = model.getLineContent(startLineNumber + i);
      let currentVisibleColumn = 0;
      for (let j2 = 0, lenJ2 = lines[i].commentStrOffset; currentVisibleColumn < minVisibleColumn && j2 < lenJ2; j2++) {
        currentVisibleColumn = LineCommentCommand.nextVisibleColumn(currentVisibleColumn, indentSize, lineContent.charCodeAt(j2) === CharCode.Tab, 1);
      }
      if (currentVisibleColumn < minVisibleColumn) {
        minVisibleColumn = currentVisibleColumn;
      }
    }
    minVisibleColumn = Math.floor(minVisibleColumn / indentSize) * indentSize;
    for (let i = 0, len = lines.length; i < len; i++) {
      if (lines[i].ignore) {
        continue;
      }
      const lineContent = model.getLineContent(startLineNumber + i);
      let currentVisibleColumn = 0;
      for (j = 0, lenJ = lines[i].commentStrOffset; currentVisibleColumn < minVisibleColumn && j < lenJ; j++) {
        currentVisibleColumn = LineCommentCommand.nextVisibleColumn(currentVisibleColumn, indentSize, lineContent.charCodeAt(j) === CharCode.Tab, 1);
      }
      if (currentVisibleColumn > minVisibleColumn) {
        lines[i].commentStrOffset = j - 1;
      } else {
        lines[i].commentStrOffset = j;
      }
    }
  }
}
export {
  LineCommentCommand,
  Type
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb21tZW50L2Jyb3dzZXIvbGluZUNvbW1lbnRDb21tYW5kLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdWludC5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uLCBJU2luZ2xlRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZCwgSUN1cnNvclN0YXRlQ29tcHV0ZXJEYXRhLCBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEJsb2NrQ29tbWVudENvbW1hbmQgfSBmcm9tICcuL2Jsb2NrQ29tbWVudENvbW1hbmQuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElJbnNlcnRpb25Qb2ludCB7XG5cdGlnbm9yZTogYm9vbGVhbjtcblx0Y29tbWVudFN0ck9mZnNldDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaW5lUHJlZmxpZ2h0RGF0YSB7XG5cdGlnbm9yZTogYm9vbGVhbjtcblx0Y29tbWVudFN0cjogc3RyaW5nO1xuXHRjb21tZW50U3RyT2Zmc2V0OiBudW1iZXI7XG5cdGNvbW1lbnRTdHJMZW5ndGg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJlZmxpZ2h0RGF0YVN1cHBvcnRlZCB7XG5cdHN1cHBvcnRlZDogdHJ1ZTtcblx0c2hvdWxkUmVtb3ZlQ29tbWVudHM6IGJvb2xlYW47XG5cdGxpbmVzOiBJTGluZVByZWZsaWdodERhdGFbXTtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSVByZWZsaWdodERhdGFVbnN1cHBvcnRlZCB7XG5cdHN1cHBvcnRlZDogZmFsc2U7XG59XG5leHBvcnQgdHlwZSBJUHJlZmxpZ2h0RGF0YSA9IElQcmVmbGlnaHREYXRhU3VwcG9ydGVkIHwgSVByZWZsaWdodERhdGFVbnN1cHBvcnRlZDtcblxuZXhwb3J0IGludGVyZmFjZSBJU2ltcGxlTW9kZWwge1xuXHRnZXRMaW5lQ29udGVudChsaW5lTnVtYmVyOiBudW1iZXIpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFR5cGUge1xuXHRUb2dnbGUgPSAwLFxuXHRGb3JjZUFkZCA9IDEsXG5cdEZvcmNlUmVtb3ZlID0gMlxufVxuXG5leHBvcnQgY2xhc3MgTGluZUNvbW1lbnRDb21tYW5kIGltcGxlbWVudHMgSUNvbW1hbmQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlbGVjdGlvbjogU2VsZWN0aW9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbmRlbnRTaXplOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3R5cGU6IFR5cGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2luc2VydFNwYWNlOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pZ25vcmVFbXB0eUxpbmVzOiBib29sZWFuO1xuXHRwcml2YXRlIF9zZWxlY3Rpb25JZDogc3RyaW5nIHwgbnVsbDtcblx0cHJpdmF0ZSBfZGVsdGFDb2x1bW46IG51bWJlcjtcblx0cHJpdmF0ZSBfbW92ZUVuZFBvc2l0aW9uRG93bjogYm9vbGVhbjtcblx0cHJpdmF0ZSBfaWdub3JlRmlyc3RMaW5lOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0c2VsZWN0aW9uOiBTZWxlY3Rpb24sXG5cdFx0aW5kZW50U2l6ZTogbnVtYmVyLFxuXHRcdHR5cGU6IFR5cGUsXG5cdFx0aW5zZXJ0U3BhY2U6IGJvb2xlYW4sXG5cdFx0aWdub3JlRW1wdHlMaW5lczogYm9vbGVhbixcblx0XHRpZ25vcmVGaXJzdExpbmU/OiBib29sZWFuLFxuXHQpIHtcblx0XHR0aGlzLl9zZWxlY3Rpb24gPSBzZWxlY3Rpb247XG5cdFx0dGhpcy5faW5kZW50U2l6ZSA9IGluZGVudFNpemU7XG5cdFx0dGhpcy5fdHlwZSA9IHR5cGU7XG5cdFx0dGhpcy5faW5zZXJ0U3BhY2UgPSBpbnNlcnRTcGFjZTtcblx0XHR0aGlzLl9zZWxlY3Rpb25JZCA9IG51bGw7XG5cdFx0dGhpcy5fZGVsdGFDb2x1bW4gPSAwO1xuXHRcdHRoaXMuX21vdmVFbmRQb3NpdGlvbkRvd24gPSBmYWxzZTtcblx0XHR0aGlzLl9pZ25vcmVFbXB0eUxpbmVzID0gaWdub3JlRW1wdHlMaW5lcztcblx0XHR0aGlzLl9pZ25vcmVGaXJzdExpbmUgPSBpZ25vcmVGaXJzdExpbmUgfHwgZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogRG8gYW4gaW5pdGlhbCBwYXNzIG92ZXIgdGhlIGxpbmVzIGFuZCBnYXRoZXIgaW5mbyBhYm91dCB0aGUgbGluZSBjb21tZW50IHN0cmluZy5cblx0ICogUmV0dXJucyBudWxsIGlmIGFueSBvZiB0aGUgbGluZXMgZG9lc24ndCBzdXBwb3J0IGEgbGluZSBjb21tZW50IHN0cmluZy5cblx0ICovXG5cdHByaXZhdGUgc3RhdGljIF9nYXRoZXJQcmVmbGlnaHRDb21tZW50U3RyaW5ncyhtb2RlbDogSVRleHRNb2RlbCwgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiBJTGluZVByZWZsaWdodERhdGFbXSB8IG51bGwge1xuXG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLnRva2VuaXplSWZDaGVhcChzdGFydExpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBtb2RlbC5nZXRMYW5ndWFnZUlkQXRQb3NpdGlvbihzdGFydExpbmVOdW1iZXIsIDEpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VJZCkuY29tbWVudHM7XG5cdFx0Y29uc3QgY29tbWVudFN0ciA9IChjb25maWcgPyBjb25maWcubGluZUNvbW1lbnRUb2tlbiA6IG51bGwpO1xuXHRcdGlmICghY29tbWVudFN0cikge1xuXHRcdFx0Ly8gTW9kZSBkb2VzIG5vdCBzdXBwb3J0IGxpbmUgY29tbWVudHNcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVzOiBJTGluZVByZWZsaWdodERhdGFbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsaW5lQ291bnQgPSBlbmRMaW5lTnVtYmVyIC0gc3RhcnRMaW5lTnVtYmVyICsgMTsgaSA8IGxpbmVDb3VudDsgaSsrKSB7XG5cdFx0XHRsaW5lc1tpXSA9IHtcblx0XHRcdFx0aWdub3JlOiBmYWxzZSxcblx0XHRcdFx0Y29tbWVudFN0cjogY29tbWVudFN0cixcblx0XHRcdFx0Y29tbWVudFN0ck9mZnNldDogMCxcblx0XHRcdFx0Y29tbWVudFN0ckxlbmd0aDogY29tbWVudFN0ci5sZW5ndGhcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxpbmVzO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFuYWx5emUgbGluZXMgYW5kIGRlY2lkZSB3aGljaCBsaW5lcyBhcmUgcmVsZXZhbnQgYW5kIHdoYXQgdGhlIHRvZ2dsZSBzaG91bGQgZG8uXG5cdCAqIEFsc28sIGJ1aWxkIHVwIHNldmVyYWwgb2Zmc2V0cyBhbmQgbGVuZ3RocyB1c2VmdWwgaW4gdGhlIGdlbmVyYXRpb24gb2YgZWRpdG9yIG9wZXJhdGlvbnMuXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIF9hbmFseXplTGluZXModHlwZTogVHlwZSwgaW5zZXJ0U3BhY2U6IGJvb2xlYW4sIG1vZGVsOiBJU2ltcGxlTW9kZWwsIGxpbmVzOiBJTGluZVByZWZsaWdodERhdGFbXSwgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGlnbm9yZUVtcHR5TGluZXM6IGJvb2xlYW4sIGlnbm9yZUZpcnN0TGluZTogYm9vbGVhbiwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiBJUHJlZmxpZ2h0RGF0YSB7XG5cdFx0bGV0IG9ubHlXaGl0ZXNwYWNlTGluZXMgPSB0cnVlO1xuXG5cdFx0bGV0IHNob3VsZFJlbW92ZUNvbW1lbnRzOiBib29sZWFuO1xuXHRcdGlmICh0eXBlID09PSBUeXBlLlRvZ2dsZSkge1xuXHRcdFx0c2hvdWxkUmVtb3ZlQ29tbWVudHMgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gVHlwZS5Gb3JjZUFkZCkge1xuXHRcdFx0c2hvdWxkUmVtb3ZlQ29tbWVudHMgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2hvdWxkUmVtb3ZlQ29tbWVudHMgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSAwLCBsaW5lQ291bnQgPSBsaW5lcy5sZW5ndGg7IGkgPCBsaW5lQ291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3QgbGluZURhdGEgPSBsaW5lc1tpXTtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBzdGFydExpbmVOdW1iZXIgKyBpO1xuXG5cdFx0XHRpZiAobGluZU51bWJlciA9PT0gc3RhcnRMaW5lTnVtYmVyICYmIGlnbm9yZUZpcnN0TGluZSkge1xuXHRcdFx0XHQvLyBmaXJzdCBsaW5lIGlnbm9yZWRcblx0XHRcdFx0bGluZURhdGEuaWdub3JlID0gdHJ1ZTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cdFx0XHRjb25zdCBsaW5lQ29udGVudFN0YXJ0T2Zmc2V0ID0gc3RyaW5ncy5maXJzdE5vbldoaXRlc3BhY2VJbmRleChsaW5lQ29udGVudCk7XG5cblx0XHRcdGlmIChsaW5lQ29udGVudFN0YXJ0T2Zmc2V0ID09PSAtMSkge1xuXHRcdFx0XHQvLyBFbXB0eSBvciB3aGl0ZXNwYWNlIG9ubHkgbGluZVxuXHRcdFx0XHRsaW5lRGF0YS5pZ25vcmUgPSBpZ25vcmVFbXB0eUxpbmVzO1xuXHRcdFx0XHRsaW5lRGF0YS5jb21tZW50U3RyT2Zmc2V0ID0gbGluZUNvbnRlbnQubGVuZ3RoO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0b25seVdoaXRlc3BhY2VMaW5lcyA9IGZhbHNlO1xuXHRcdFx0bGluZURhdGEuaWdub3JlID0gZmFsc2U7XG5cdFx0XHRsaW5lRGF0YS5jb21tZW50U3RyT2Zmc2V0ID0gbGluZUNvbnRlbnRTdGFydE9mZnNldDtcblxuXHRcdFx0aWYgKHNob3VsZFJlbW92ZUNvbW1lbnRzICYmICFCbG9ja0NvbW1lbnRDb21tYW5kLl9oYXlzdGFja0hhc05lZWRsZUF0T2Zmc2V0KGxpbmVDb250ZW50LCBsaW5lRGF0YS5jb21tZW50U3RyLCBsaW5lQ29udGVudFN0YXJ0T2Zmc2V0KSkge1xuXHRcdFx0XHRpZiAodHlwZSA9PT0gVHlwZS5Ub2dnbGUpIHtcblx0XHRcdFx0XHQvLyBFdmVyeSBsaW5lIHNvIGZhciBoYXMgYmVlbiBhIGxpbmUgY29tbWVudCwgYnV0IHRoaXMgb25lIGlzIG5vdFxuXHRcdFx0XHRcdHNob3VsZFJlbW92ZUNvbW1lbnRzID0gZmFsc2U7XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gVHlwZS5Gb3JjZUFkZCkge1xuXHRcdFx0XHRcdC8vIFdpbGwgbm90IGhhcHBlblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxpbmVEYXRhLmlnbm9yZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHNob3VsZFJlbW92ZUNvbW1lbnRzICYmIGluc2VydFNwYWNlKSB7XG5cdFx0XHRcdC8vIFJlbW92ZSBhIGZvbGxvd2luZyBzcGFjZSBpZiBwcmVzZW50XG5cdFx0XHRcdGNvbnN0IGNvbW1lbnRTdHJFbmRPZmZzZXQgPSBsaW5lQ29udGVudFN0YXJ0T2Zmc2V0ICsgbGluZURhdGEuY29tbWVudFN0ckxlbmd0aDtcblx0XHRcdFx0aWYgKGNvbW1lbnRTdHJFbmRPZmZzZXQgPCBsaW5lQ29udGVudC5sZW5ndGggJiYgbGluZUNvbnRlbnQuY2hhckNvZGVBdChjb21tZW50U3RyRW5kT2Zmc2V0KSA9PT0gQ2hhckNvZGUuU3BhY2UpIHtcblx0XHRcdFx0XHRsaW5lRGF0YS5jb21tZW50U3RyTGVuZ3RoICs9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodHlwZSA9PT0gVHlwZS5Ub2dnbGUgJiYgb25seVdoaXRlc3BhY2VMaW5lcykge1xuXHRcdFx0Ly8gRm9yIG9ubHkgd2hpdGVzcGFjZSBsaW5lcywgd2UgaW5zZXJ0IGNvbW1lbnRzXG5cdFx0XHRzaG91bGRSZW1vdmVDb21tZW50cyA9IGZhbHNlO1xuXG5cdFx0XHQvLyBBbHNvLCBubyBsb25nZXIgaWdub3JlIHRoZW1cblx0XHRcdGZvciAobGV0IGkgPSAwLCBsaW5lQ291bnQgPSBsaW5lcy5sZW5ndGg7IGkgPCBsaW5lQ291bnQ7IGkrKykge1xuXHRcdFx0XHRsaW5lc1tpXS5pZ25vcmUgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c3VwcG9ydGVkOiB0cnVlLFxuXHRcdFx0c2hvdWxkUmVtb3ZlQ29tbWVudHM6IHNob3VsZFJlbW92ZUNvbW1lbnRzLFxuXHRcdFx0bGluZXM6IGxpbmVzXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBbmFseXplIGFsbCBsaW5lcyBhbmQgZGVjaWRlIGV4YWN0bHkgd2hhdCB0byBkbyA9PiBub3Qgc3VwcG9ydGVkIHwgaW5zZXJ0IGxpbmUgY29tbWVudHMgfCByZW1vdmUgbGluZSBjb21tZW50c1xuXHQgKi9cblx0cHVibGljIHN0YXRpYyBfZ2F0aGVyUHJlZmxpZ2h0RGF0YSh0eXBlOiBUeXBlLCBpbnNlcnRTcGFjZTogYm9vbGVhbiwgbW9kZWw6IElUZXh0TW9kZWwsIHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIGlnbm9yZUVtcHR5TGluZXM6IGJvb2xlYW4sIGlnbm9yZUZpcnN0TGluZTogYm9vbGVhbiwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiBJUHJlZmxpZ2h0RGF0YSB7XG5cdFx0Y29uc3QgbGluZXMgPSBMaW5lQ29tbWVudENvbW1hbmQuX2dhdGhlclByZWZsaWdodENvbW1lbnRTdHJpbmdzKG1vZGVsLCBzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXIsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGlmIChsaW5lcyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3VwcG9ydGVkOiBmYWxzZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gTGluZUNvbW1lbnRDb21tYW5kLl9hbmFseXplTGluZXModHlwZSwgaW5zZXJ0U3BhY2UsIG1vZGVsLCBsaW5lcywgc3RhcnRMaW5lTnVtYmVyLCBpZ25vcmVFbXB0eUxpbmVzLCBpZ25vcmVGaXJzdExpbmUsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdpdmVuIGEgc3VjY2Vzc2Z1bCBhbmFseXNpcywgZXhlY3V0ZSBlaXRoZXIgaW5zZXJ0IGxpbmUgY29tbWVudHMsIGVpdGhlciByZW1vdmUgbGluZSBjb21tZW50c1xuXHQgKi9cblx0cHJpdmF0ZSBfZXhlY3V0ZUxpbmVDb21tZW50cyhtb2RlbDogSVNpbXBsZU1vZGVsLCBidWlsZGVyOiBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIsIGRhdGE6IElQcmVmbGlnaHREYXRhU3VwcG9ydGVkLCBzOiBTZWxlY3Rpb24pOiB2b2lkIHtcblxuXHRcdGxldCBvcHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW107XG5cblx0XHRpZiAoZGF0YS5zaG91bGRSZW1vdmVDb21tZW50cykge1xuXHRcdFx0b3BzID0gTGluZUNvbW1lbnRDb21tYW5kLl9jcmVhdGVSZW1vdmVMaW5lQ29tbWVudHNPcGVyYXRpb25zKGRhdGEubGluZXMsIHMuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0TGluZUNvbW1lbnRDb21tYW5kLl9ub3JtYWxpemVJbnNlcnRpb25Qb2ludChtb2RlbCwgZGF0YS5saW5lcywgcy5zdGFydExpbmVOdW1iZXIsIHRoaXMuX2luZGVudFNpemUpO1xuXHRcdFx0b3BzID0gdGhpcy5fY3JlYXRlQWRkTGluZUNvbW1lbnRzT3BlcmF0aW9ucyhkYXRhLmxpbmVzLCBzLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3Vyc29yUG9zaXRpb24gPSBuZXcgUG9zaXRpb24ocy5wb3NpdGlvbkxpbmVOdW1iZXIsIHMucG9zaXRpb25Db2x1bW4pO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IG9wcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0YnVpbGRlci5hZGRFZGl0T3BlcmF0aW9uKG9wc1tpXS5yYW5nZSwgb3BzW2ldLnRleHQpO1xuXHRcdFx0aWYgKFJhbmdlLmlzRW1wdHkob3BzW2ldLnJhbmdlKSAmJiBSYW5nZS5nZXRTdGFydFBvc2l0aW9uKG9wc1tpXS5yYW5nZSkuZXF1YWxzKGN1cnNvclBvc2l0aW9uKSkge1xuXHRcdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KGN1cnNvclBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdFx0XHRpZiAobGluZUNvbnRlbnQubGVuZ3RoICsgMSA9PT0gY3Vyc29yUG9zaXRpb24uY29sdW1uKSB7XG5cdFx0XHRcdFx0dGhpcy5fZGVsdGFDb2x1bW4gPSAob3BzW2ldLnRleHQgfHwgJycpLmxlbmd0aDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3NlbGVjdGlvbklkID0gYnVpbGRlci50cmFja1NlbGVjdGlvbihzKTtcblx0fVxuXG5cdHByaXZhdGUgX2F0dGVtcHRSZW1vdmVCbG9ja0NvbW1lbnQobW9kZWw6IElUZXh0TW9kZWwsIHM6IFNlbGVjdGlvbiwgc3RhcnRUb2tlbjogc3RyaW5nLCBlbmRUb2tlbjogc3RyaW5nKTogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSB8IG51bGwge1xuXHRcdGxldCBzdGFydExpbmVOdW1iZXIgPSBzLnN0YXJ0TGluZU51bWJlcjtcblx0XHRsZXQgZW5kTGluZU51bWJlciA9IHMuZW5kTGluZU51bWJlcjtcblxuXHRcdGNvbnN0IHN0YXJ0VG9rZW5BbGxvd2VkQmVmb3JlQ29sdW1uID0gZW5kVG9rZW4ubGVuZ3RoICsgTWF0aC5tYXgoXG5cdFx0XHRtb2RlbC5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKHMuc3RhcnRMaW5lTnVtYmVyKSxcblx0XHRcdHMuc3RhcnRDb2x1bW5cblx0XHQpO1xuXG5cdFx0bGV0IHN0YXJ0VG9rZW5JbmRleCA9IG1vZGVsLmdldExpbmVDb250ZW50KHN0YXJ0TGluZU51bWJlcikubGFzdEluZGV4T2Yoc3RhcnRUb2tlbiwgc3RhcnRUb2tlbkFsbG93ZWRCZWZvcmVDb2x1bW4gLSAxKTtcblx0XHRsZXQgZW5kVG9rZW5JbmRleCA9IG1vZGVsLmdldExpbmVDb250ZW50KGVuZExpbmVOdW1iZXIpLmluZGV4T2YoZW5kVG9rZW4sIHMuZW5kQ29sdW1uIC0gMSAtIHN0YXJ0VG9rZW4ubGVuZ3RoKTtcblxuXHRcdGlmIChzdGFydFRva2VuSW5kZXggIT09IC0xICYmIGVuZFRva2VuSW5kZXggPT09IC0xKSB7XG5cdFx0XHRlbmRUb2tlbkluZGV4ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQoc3RhcnRMaW5lTnVtYmVyKS5pbmRleE9mKGVuZFRva2VuLCBzdGFydFRva2VuSW5kZXggKyBzdGFydFRva2VuLmxlbmd0aCk7XG5cdFx0XHRlbmRMaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyO1xuXHRcdH1cblxuXHRcdGlmIChzdGFydFRva2VuSW5kZXggPT09IC0xICYmIGVuZFRva2VuSW5kZXggIT09IC0xKSB7XG5cdFx0XHRzdGFydFRva2VuSW5kZXggPSBtb2RlbC5nZXRMaW5lQ29udGVudChlbmRMaW5lTnVtYmVyKS5sYXN0SW5kZXhPZihzdGFydFRva2VuLCBlbmRUb2tlbkluZGV4KTtcblx0XHRcdHN0YXJ0TGluZU51bWJlciA9IGVuZExpbmVOdW1iZXI7XG5cdFx0fVxuXG5cdFx0aWYgKHMuaXNFbXB0eSgpICYmIChzdGFydFRva2VuSW5kZXggPT09IC0xIHx8IGVuZFRva2VuSW5kZXggPT09IC0xKSkge1xuXHRcdFx0c3RhcnRUb2tlbkluZGV4ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQoc3RhcnRMaW5lTnVtYmVyKS5pbmRleE9mKHN0YXJ0VG9rZW4pO1xuXHRcdFx0aWYgKHN0YXJ0VG9rZW5JbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0ZW5kVG9rZW5JbmRleCA9IG1vZGVsLmdldExpbmVDb250ZW50KHN0YXJ0TGluZU51bWJlcikuaW5kZXhPZihlbmRUb2tlbiwgc3RhcnRUb2tlbkluZGV4ICsgc3RhcnRUb2tlbi5sZW5ndGgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFdlIGhhdmUgdG8gYWRqdXN0IHRvIHBvc3NpYmxlIGlubmVyIHdoaXRlIHNwYWNlLlxuXHRcdC8vIEZvciBTcGFjZSBhZnRlciBzdGFydFRva2VuLCBhZGQgU3BhY2UgdG8gc3RhcnRUb2tlbiAtIHJhbmdlIG1hdGggd2lsbCB3b3JrIG91dC5cblx0XHRpZiAoc3RhcnRUb2tlbkluZGV4ICE9PSAtMSAmJiBtb2RlbC5nZXRMaW5lQ29udGVudChzdGFydExpbmVOdW1iZXIpLmNoYXJDb2RlQXQoc3RhcnRUb2tlbkluZGV4ICsgc3RhcnRUb2tlbi5sZW5ndGgpID09PSBDaGFyQ29kZS5TcGFjZSkge1xuXHRcdFx0c3RhcnRUb2tlbiArPSAnICc7XG5cdFx0fVxuXG5cdFx0Ly8gRm9yIFNwYWNlIGJlZm9yZSBlbmRUb2tlbiwgYWRkIFNwYWNlIGJlZm9yZSBlbmRUb2tlbiBhbmQgc2hpZnQgaW5kZXggb25lIGxlZnQuXG5cdFx0aWYgKGVuZFRva2VuSW5kZXggIT09IC0xICYmIG1vZGVsLmdldExpbmVDb250ZW50KGVuZExpbmVOdW1iZXIpLmNoYXJDb2RlQXQoZW5kVG9rZW5JbmRleCAtIDEpID09PSBDaGFyQ29kZS5TcGFjZSkge1xuXHRcdFx0ZW5kVG9rZW4gPSAnICcgKyBlbmRUb2tlbjtcblx0XHRcdGVuZFRva2VuSW5kZXggLT0gMTtcblx0XHR9XG5cblx0XHRpZiAoc3RhcnRUb2tlbkluZGV4ICE9PSAtMSAmJiBlbmRUb2tlbkluZGV4ICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIEJsb2NrQ29tbWVudENvbW1hbmQuX2NyZWF0ZVJlbW92ZUJsb2NrQ29tbWVudE9wZXJhdGlvbnMoXG5cdFx0XHRcdG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0VG9rZW5JbmRleCArIHN0YXJ0VG9rZW4ubGVuZ3RoICsgMSwgZW5kTGluZU51bWJlciwgZW5kVG9rZW5JbmRleCArIDEpLCBzdGFydFRva2VuLCBlbmRUb2tlblxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhbiB1bnN1Y2Nlc3NmdWwgYW5hbHlzaXMsIGRlbGVnYXRlIHRvIHRoZSBibG9jayBjb21tZW50IGNvbW1hbmRcblx0ICovXG5cdHByaXZhdGUgX2V4ZWN1dGVCbG9ja0NvbW1lbnQobW9kZWw6IElUZXh0TW9kZWwsIGJ1aWxkZXI6IElFZGl0T3BlcmF0aW9uQnVpbGRlciwgczogU2VsZWN0aW9uKTogdm9pZCB7XG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLnRva2VuaXplSWZDaGVhcChzLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IG1vZGVsLmdldExhbmd1YWdlSWRBdFBvc2l0aW9uKHMuc3RhcnRMaW5lTnVtYmVyLCAxKTtcblx0XHRjb25zdCBjb25maWcgPSB0aGlzLmxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxhbmd1YWdlSWQpLmNvbW1lbnRzO1xuXHRcdGlmICghY29uZmlnIHx8ICFjb25maWcuYmxvY2tDb21tZW50U3RhcnRUb2tlbiB8fCAhY29uZmlnLmJsb2NrQ29tbWVudEVuZFRva2VuKSB7XG5cdFx0XHQvLyBNb2RlIGRvZXMgbm90IHN1cHBvcnQgYmxvY2sgY29tbWVudHNcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydFRva2VuID0gY29uZmlnLmJsb2NrQ29tbWVudFN0YXJ0VG9rZW47XG5cdFx0Y29uc3QgZW5kVG9rZW4gPSBjb25maWcuYmxvY2tDb21tZW50RW5kVG9rZW47XG5cblx0XHRsZXQgb3BzID0gdGhpcy5fYXR0ZW1wdFJlbW92ZUJsb2NrQ29tbWVudChtb2RlbCwgcywgc3RhcnRUb2tlbiwgZW5kVG9rZW4pO1xuXHRcdGlmICghb3BzKSB7XG5cdFx0XHRpZiAocy5pc0VtcHR5KCkpIHtcblx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChzLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdGxldCBmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA9IHN0cmluZ3MuZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXgobGluZUNvbnRlbnQpO1xuXHRcdFx0XHRpZiAoZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0Ly8gTGluZSBpcyBlbXB0eSBvciBjb250YWlucyBvbmx5IHdoaXRlc3BhY2Vcblx0XHRcdFx0XHRmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA9IGxpbmVDb250ZW50Lmxlbmd0aDtcblx0XHRcdFx0fVxuXHRcdFx0XHRvcHMgPSBCbG9ja0NvbW1lbnRDb21tYW5kLl9jcmVhdGVBZGRCbG9ja0NvbW1lbnRPcGVyYXRpb25zKFxuXHRcdFx0XHRcdG5ldyBSYW5nZShzLnN0YXJ0TGluZU51bWJlciwgZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggKyAxLCBzLnN0YXJ0TGluZU51bWJlciwgbGluZUNvbnRlbnQubGVuZ3RoICsgMSksXG5cdFx0XHRcdFx0c3RhcnRUb2tlbixcblx0XHRcdFx0XHRlbmRUb2tlbixcblx0XHRcdFx0XHR0aGlzLl9pbnNlcnRTcGFjZVxuXHRcdFx0XHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3BzID0gQmxvY2tDb21tZW50Q29tbWFuZC5fY3JlYXRlQWRkQmxvY2tDb21tZW50T3BlcmF0aW9ucyhcblx0XHRcdFx0XHRuZXcgUmFuZ2Uocy5zdGFydExpbmVOdW1iZXIsIG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4ocy5zdGFydExpbmVOdW1iZXIpLCBzLmVuZExpbmVOdW1iZXIsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4ocy5lbmRMaW5lTnVtYmVyKSksXG5cdFx0XHRcdFx0c3RhcnRUb2tlbixcblx0XHRcdFx0XHRlbmRUb2tlbixcblx0XHRcdFx0XHR0aGlzLl9pbnNlcnRTcGFjZVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3BzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHQvLyBMZWF2ZSBjdXJzb3IgYWZ0ZXIgdG9rZW4gYW5kIFNwYWNlXG5cdFx0XHRcdHRoaXMuX2RlbHRhQ29sdW1uID0gc3RhcnRUb2tlbi5sZW5ndGggKyAxO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9zZWxlY3Rpb25JZCA9IGJ1aWxkZXIudHJhY2tTZWxlY3Rpb24ocyk7XG5cdFx0Zm9yIChjb25zdCBvcCBvZiBvcHMpIHtcblx0XHRcdGJ1aWxkZXIuYWRkRWRpdE9wZXJhdGlvbihvcC5yYW5nZSwgb3AudGV4dCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldEVkaXRPcGVyYXRpb25zKG1vZGVsOiBJVGV4dE1vZGVsLCBidWlsZGVyOiBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIpOiB2b2lkIHtcblxuXHRcdGxldCBzID0gdGhpcy5fc2VsZWN0aW9uO1xuXHRcdHRoaXMuX21vdmVFbmRQb3NpdGlvbkRvd24gPSBmYWxzZTtcblxuXHRcdGlmIChzLnN0YXJ0TGluZU51bWJlciA9PT0gcy5lbmRMaW5lTnVtYmVyICYmIHRoaXMuX2lnbm9yZUZpcnN0TGluZSkge1xuXHRcdFx0YnVpbGRlci5hZGRFZGl0T3BlcmF0aW9uKG5ldyBSYW5nZShzLnN0YXJ0TGluZU51bWJlciwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihzLnN0YXJ0TGluZU51bWJlciksIHMuc3RhcnRMaW5lTnVtYmVyICsgMSwgMSksIHMuc3RhcnRMaW5lTnVtYmVyID09PSBtb2RlbC5nZXRMaW5lQ291bnQoKSA/ICcnIDogJ1xcbicpO1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uSWQgPSBidWlsZGVyLnRyYWNrU2VsZWN0aW9uKHMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChzLnN0YXJ0TGluZU51bWJlciA8IHMuZW5kTGluZU51bWJlciAmJiBzLmVuZENvbHVtbiA9PT0gMSkge1xuXHRcdFx0dGhpcy5fbW92ZUVuZFBvc2l0aW9uRG93biA9IHRydWU7XG5cdFx0XHRzID0gcy5zZXRFbmRQb3NpdGlvbihzLmVuZExpbmVOdW1iZXIgLSAxLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHMuZW5kTGluZU51bWJlciAtIDEpKTtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gTGluZUNvbW1lbnRDb21tYW5kLl9nYXRoZXJQcmVmbGlnaHREYXRhKFxuXHRcdFx0dGhpcy5fdHlwZSxcblx0XHRcdHRoaXMuX2luc2VydFNwYWNlLFxuXHRcdFx0bW9kZWwsXG5cdFx0XHRzLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdHMuZW5kTGluZU51bWJlcixcblx0XHRcdHRoaXMuX2lnbm9yZUVtcHR5TGluZXMsXG5cdFx0XHR0aGlzLl9pZ25vcmVGaXJzdExpbmUsXG5cdFx0XHR0aGlzLmxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHQpO1xuXG5cdFx0aWYgKGRhdGEuc3VwcG9ydGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZXhlY3V0ZUxpbmVDb21tZW50cyhtb2RlbCwgYnVpbGRlciwgZGF0YSwgcyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2V4ZWN1dGVCbG9ja0NvbW1lbnQobW9kZWwsIGJ1aWxkZXIsIHMpO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVDdXJzb3JTdGF0ZShtb2RlbDogSVRleHRNb2RlbCwgaGVscGVyOiBJQ3Vyc29yU3RhdGVDb21wdXRlckRhdGEpOiBTZWxlY3Rpb24ge1xuXHRcdGxldCByZXN1bHQgPSBoZWxwZXIuZ2V0VHJhY2tlZFNlbGVjdGlvbih0aGlzLl9zZWxlY3Rpb25JZCEpO1xuXG5cdFx0aWYgKHRoaXMuX21vdmVFbmRQb3NpdGlvbkRvd24pIHtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdC5zZXRFbmRQb3NpdGlvbihyZXN1bHQuZW5kTGluZU51bWJlciArIDEsIDEpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgU2VsZWN0aW9uKFxuXHRcdFx0cmVzdWx0LnNlbGVjdGlvblN0YXJ0TGluZU51bWJlcixcblx0XHRcdHJlc3VsdC5zZWxlY3Rpb25TdGFydENvbHVtbiArIHRoaXMuX2RlbHRhQ29sdW1uLFxuXHRcdFx0cmVzdWx0LnBvc2l0aW9uTGluZU51bWJlcixcblx0XHRcdHJlc3VsdC5wb3NpdGlvbkNvbHVtbiArIHRoaXMuX2RlbHRhQ29sdW1uXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZSBlZGl0IG9wZXJhdGlvbnMgaW4gdGhlIHJlbW92ZSBsaW5lIGNvbW1lbnQgY2FzZVxuXHQgKi9cblx0cHVibGljIHN0YXRpYyBfY3JlYXRlUmVtb3ZlTGluZUNvbW1lbnRzT3BlcmF0aW9ucyhsaW5lczogSUxpbmVQcmVmbGlnaHREYXRhW10sIHN0YXJ0TGluZU51bWJlcjogbnVtYmVyKTogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSB7XG5cdFx0Y29uc3QgcmVzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmVEYXRhID0gbGluZXNbaV07XG5cblx0XHRcdGlmIChsaW5lRGF0YS5pZ25vcmUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHJlcy5wdXNoKEVkaXRPcGVyYXRpb24uZGVsZXRlKG5ldyBSYW5nZShcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyICsgaSwgbGluZURhdGEuY29tbWVudFN0ck9mZnNldCArIDEsXG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlciArIGksIGxpbmVEYXRhLmNvbW1lbnRTdHJPZmZzZXQgKyBsaW5lRGF0YS5jb21tZW50U3RyTGVuZ3RoICsgMVxuXHRcdFx0KSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXM7XG5cdH1cblxuXHQvKipcblx0ICogR2VuZXJhdGUgZWRpdCBvcGVyYXRpb25zIGluIHRoZSBhZGQgbGluZSBjb21tZW50IGNhc2Vcblx0ICovXG5cdHByaXZhdGUgX2NyZWF0ZUFkZExpbmVDb21tZW50c09wZXJhdGlvbnMobGluZXM6IElMaW5lUHJlZmxpZ2h0RGF0YVtdLCBzdGFydExpbmVOdW1iZXI6IG51bWJlcik6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10ge1xuXHRcdGNvbnN0IHJlczogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGFmdGVyQ29tbWVudFN0ciA9IHRoaXMuX2luc2VydFNwYWNlID8gJyAnIDogJyc7XG5cblxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgbGluZURhdGEgPSBsaW5lc1tpXTtcblxuXHRcdFx0aWYgKGxpbmVEYXRhLmlnbm9yZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0cmVzLnB1c2goRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKHN0YXJ0TGluZU51bWJlciArIGksIGxpbmVEYXRhLmNvbW1lbnRTdHJPZmZzZXQgKyAxKSwgbGluZURhdGEuY29tbWVudFN0ciArIGFmdGVyQ29tbWVudFN0cikpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXM7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBuZXh0VmlzaWJsZUNvbHVtbihjdXJyZW50VmlzaWJsZUNvbHVtbjogbnVtYmVyLCBpbmRlbnRTaXplOiBudW1iZXIsIGlzVGFiOiBib29sZWFuLCBjb2x1bW5TaXplOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmIChpc1RhYikge1xuXHRcdFx0cmV0dXJuIGN1cnJlbnRWaXNpYmxlQ29sdW1uICsgKGluZGVudFNpemUgLSAoY3VycmVudFZpc2libGVDb2x1bW4gJSBpbmRlbnRTaXplKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjdXJyZW50VmlzaWJsZUNvbHVtbiArIGNvbHVtblNpemU7XG5cdH1cblxuXHQvKipcblx0ICogQWRqdXN0IGluc2VydGlvbiBwb2ludHMgdG8gaGF2ZSB0aGVtIHZlcnRpY2FsbHkgYWxpZ25lZCBpbiB0aGUgYWRkIGxpbmUgY29tbWVudCBjYXNlXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIF9ub3JtYWxpemVJbnNlcnRpb25Qb2ludChtb2RlbDogSVNpbXBsZU1vZGVsLCBsaW5lczogSUluc2VydGlvblBvaW50W10sIHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBpbmRlbnRTaXplOiBudW1iZXIpOiB2b2lkIHtcblx0XHRsZXQgbWluVmlzaWJsZUNvbHVtbiA9IENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSO1xuXHRcdGxldCBqOiBudW1iZXI7XG5cdFx0bGV0IGxlbko6IG51bWJlcjtcblxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0aWYgKGxpbmVzW2ldLmlnbm9yZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChzdGFydExpbmVOdW1iZXIgKyBpKTtcblxuXHRcdFx0bGV0IGN1cnJlbnRWaXNpYmxlQ29sdW1uID0gMDtcblx0XHRcdGZvciAobGV0IGogPSAwLCBsZW5KID0gbGluZXNbaV0uY29tbWVudFN0ck9mZnNldDsgY3VycmVudFZpc2libGVDb2x1bW4gPCBtaW5WaXNpYmxlQ29sdW1uICYmIGogPCBsZW5KOyBqKyspIHtcblx0XHRcdFx0Y3VycmVudFZpc2libGVDb2x1bW4gPSBMaW5lQ29tbWVudENvbW1hbmQubmV4dFZpc2libGVDb2x1bW4oY3VycmVudFZpc2libGVDb2x1bW4sIGluZGVudFNpemUsIGxpbmVDb250ZW50LmNoYXJDb2RlQXQoaikgPT09IENoYXJDb2RlLlRhYiwgMSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjdXJyZW50VmlzaWJsZUNvbHVtbiA8IG1pblZpc2libGVDb2x1bW4pIHtcblx0XHRcdFx0bWluVmlzaWJsZUNvbHVtbiA9IGN1cnJlbnRWaXNpYmxlQ29sdW1uO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdG1pblZpc2libGVDb2x1bW4gPSBNYXRoLmZsb29yKG1pblZpc2libGVDb2x1bW4gLyBpbmRlbnRTaXplKSAqIGluZGVudFNpemU7XG5cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGlmIChsaW5lc1tpXS5pZ25vcmUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQoc3RhcnRMaW5lTnVtYmVyICsgaSk7XG5cblx0XHRcdGxldCBjdXJyZW50VmlzaWJsZUNvbHVtbiA9IDA7XG5cdFx0XHRmb3IgKGogPSAwLCBsZW5KID0gbGluZXNbaV0uY29tbWVudFN0ck9mZnNldDsgY3VycmVudFZpc2libGVDb2x1bW4gPCBtaW5WaXNpYmxlQ29sdW1uICYmIGogPCBsZW5KOyBqKyspIHtcblx0XHRcdFx0Y3VycmVudFZpc2libGVDb2x1bW4gPSBMaW5lQ29tbWVudENvbW1hbmQubmV4dFZpc2libGVDb2x1bW4oY3VycmVudFZpc2libGVDb2x1bW4sIGluZGVudFNpemUsIGxpbmVDb250ZW50LmNoYXJDb2RlQXQoaikgPT09IENoYXJDb2RlLlRhYiwgMSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjdXJyZW50VmlzaWJsZUNvbHVtbiA+IG1pblZpc2libGVDb2x1bW4pIHtcblx0XHRcdFx0bGluZXNbaV0uY29tbWVudFN0ck9mZnNldCA9IGogLSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGluZXNbaV0uY29tbWVudFN0ck9mZnNldCA9IGo7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGdCQUFnQjtBQUN6QixZQUFZLGFBQWE7QUFDekIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxxQkFBMkM7QUFDcEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBSTFCLFNBQVMsMkJBQTJCO0FBNEI3QixJQUFXLE9BQVgsa0JBQVdBLFVBQVg7QUFDTixFQUFBQSxZQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLFlBQUEsY0FBVyxLQUFYO0FBQ0EsRUFBQUEsWUFBQSxpQkFBYyxLQUFkO0FBSGlCLFNBQUFBO0FBQUEsR0FBQTtBQU1YLE1BQU0sbUJBQXVDO0FBQUEsRUFZbkQsWUFDa0IsOEJBQ2pCLFdBQ0EsWUFDQSxNQUNBLGFBQ0Esa0JBQ0EsaUJBQ0M7QUFQZ0I7QUFRakIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssY0FBYztBQUNuQixTQUFLLFFBQVE7QUFDYixTQUFLLGVBQWU7QUFDcEIsU0FBSyxlQUFlO0FBQ3BCLFNBQUssZUFBZTtBQUNwQixTQUFLLHVCQUF1QjtBQUM1QixTQUFLLG9CQUFvQjtBQUN6QixTQUFLLG1CQUFtQixtQkFBbUI7QUFB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SSxTQUFTLGtCQUFrQixHQUFHLFNBQVMsbUJBQW1CLENBQUMsR0FBRyxTQUFTLGFBQWEsZUFBZSxDQUFDO0FBQUEsSUFDdkk7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsT0FBZSxrQkFBa0Isc0JBQThCLFlBQW9CLE9BQWdCLFlBQTRCO0FBQzlILFFBQUksT0FBTztBQUNWLGFBQU8sd0JBQXdCLGFBQWMsdUJBQXVCO0FBQUEsSUFDckU7QUFDQSxXQUFPLHVCQUF1QjtBQUFBLEVBQy9CO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxPQUFjLHlCQUF5QixPQUFxQixPQUEwQixpQkFBeUIsWUFBMEI7QUFDeEksUUFBSSxtQkFBbUIsVUFBVTtBQUNqQyxRQUFJO0FBQ0osUUFBSTtBQUVKLGFBQVMsSUFBSSxHQUFHLE1BQU0sTUFBTSxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ2pELFVBQUksTUFBTSxDQUFDLEVBQUUsUUFBUTtBQUNwQjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLGNBQWMsTUFBTSxlQUFlLGtCQUFrQixDQUFDO0FBRTVELFVBQUksdUJBQXVCO0FBQzNCLGVBQVNDLEtBQUksR0FBR0MsUUFBTyxNQUFNLENBQUMsRUFBRSxrQkFBa0IsdUJBQXVCLG9CQUFvQkQsS0FBSUMsT0FBTUQsTUFBSztBQUMzRywrQkFBdUIsbUJBQW1CLGtCQUFrQixzQkFBc0IsWUFBWSxZQUFZLFdBQVdBLEVBQUMsTUFBTSxTQUFTLEtBQUssQ0FBQztBQUFBLE1BQzVJO0FBRUEsVUFBSSx1QkFBdUIsa0JBQWtCO0FBQzVDLDJCQUFtQjtBQUFBLE1BQ3BCO0FBQUEsSUFDRDtBQUVBLHVCQUFtQixLQUFLLE1BQU0sbUJBQW1CLFVBQVUsSUFBSTtBQUUvRCxhQUFTLElBQUksR0FBRyxNQUFNLE1BQU0sUUFBUSxJQUFJLEtBQUssS0FBSztBQUNqRCxVQUFJLE1BQU0sQ0FBQyxFQUFFLFFBQVE7QUFDcEI7QUFBQSxNQUNEO0FBRUEsWUFBTSxjQUFjLE1BQU0sZUFBZSxrQkFBa0IsQ0FBQztBQUU1RCxVQUFJLHVCQUF1QjtBQUMzQixXQUFLLElBQUksR0FBRyxPQUFPLE1BQU0sQ0FBQyxFQUFFLGtCQUFrQix1QkFBdUIsb0JBQW9CLElBQUksTUFBTSxLQUFLO0FBQ3ZHLCtCQUF1QixtQkFBbUIsa0JBQWtCLHNCQUFzQixZQUFZLFlBQVksV0FBVyxDQUFDLE1BQU0sU0FBUyxLQUFLLENBQUM7QUFBQSxNQUM1STtBQUVBLFVBQUksdUJBQXVCLGtCQUFrQjtBQUM1QyxjQUFNLENBQUMsRUFBRSxtQkFBbUIsSUFBSTtBQUFBLE1BQ2pDLE9BQU87QUFDTixjQUFNLENBQUMsRUFBRSxtQkFBbUI7QUFBQSxNQUM3QjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbIlR5cGUiLCAiaiIsICJsZW5KIl0KfQo=
