import * as strings from "../../../base/common/strings.js";
import { ReplaceCommand } from "../commands/replaceCommand.js";
import { EditOperationResult, EditOperationType, isQuote } from "../cursorCommon.js";
import { CursorColumns } from "../core/cursorColumns.js";
import { MoveOperations } from "./cursorMoveOperations.js";
import { Range } from "../core/range.js";
import { Position } from "../core/position.js";
class DeleteOperations {
  static deleteRight(prevEditOperationType, config, model, selections) {
    const commands = [];
    let shouldPushStackElementBefore = prevEditOperationType !== EditOperationType.DeletingRight;
    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i];
      let deleteSelection = selection;
      if (deleteSelection.isEmpty()) {
        const position = selection.getPosition();
        const rightOfPosition = MoveOperations.right(config, model, position);
        deleteSelection = new Range(
          rightOfPosition.lineNumber,
          rightOfPosition.column,
          position.lineNumber,
          position.column
        );
      }
      if (deleteSelection.isEmpty()) {
        commands[i] = null;
        continue;
      }
      if (deleteSelection.startLineNumber !== deleteSelection.endLineNumber) {
        shouldPushStackElementBefore = true;
      }
      commands[i] = new ReplaceCommand(deleteSelection, "");
    }
    return [shouldPushStackElementBefore, commands];
  }
  static isAutoClosingPairDelete(autoClosingDelete, autoClosingBrackets, autoClosingQuotes, autoClosingPairsOpen, model, selections, autoClosedCharacters) {
    if (autoClosingBrackets === "never" && autoClosingQuotes === "never") {
      return false;
    }
    if (autoClosingDelete === "never") {
      return false;
    }
    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i];
      const position = selection.getPosition();
      if (!selection.isEmpty()) {
        return false;
      }
      const lineText = model.getLineContent(position.lineNumber);
      if (position.column < 2 || position.column >= lineText.length + 1) {
        return false;
      }
      const character = lineText.charAt(position.column - 2);
      const autoClosingPairCandidates = autoClosingPairsOpen.get(character);
      if (!autoClosingPairCandidates) {
        return false;
      }
      if (isQuote(character)) {
        if (autoClosingQuotes === "never") {
          return false;
        }
      } else {
        if (autoClosingBrackets === "never") {
          return false;
        }
      }
      const afterCharacter = lineText.charAt(position.column - 1);
      let foundAutoClosingPair = false;
      for (const autoClosingPairCandidate of autoClosingPairCandidates) {
        if (autoClosingPairCandidate.open === character && autoClosingPairCandidate.close === afterCharacter) {
          foundAutoClosingPair = true;
        }
      }
      if (!foundAutoClosingPair) {
        return false;
      }
      if (autoClosingDelete === "auto") {
        let found = false;
        for (let j = 0, lenJ = autoClosedCharacters.length; j < lenJ; j++) {
          const autoClosedCharacter = autoClosedCharacters[j];
          if (position.lineNumber === autoClosedCharacter.startLineNumber && position.column === autoClosedCharacter.startColumn) {
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }
    }
    return true;
  }
  static _runAutoClosingPairDelete(config, model, selections) {
    const commands = [];
    for (let i = 0, len = selections.length; i < len; i++) {
      const position = selections[i].getPosition();
      const deleteSelection = new Range(
        position.lineNumber,
        position.column - 1,
        position.lineNumber,
        position.column + 1
      );
      commands[i] = new ReplaceCommand(deleteSelection, "");
    }
    return [true, commands];
  }
  static deleteLeft(prevEditOperationType, config, model, selections, autoClosedCharacters) {
    if (this.isAutoClosingPairDelete(config.autoClosingDelete, config.autoClosingBrackets, config.autoClosingQuotes, config.autoClosingPairs.autoClosingPairsOpenByEnd, model, selections, autoClosedCharacters)) {
      return this._runAutoClosingPairDelete(config, model, selections);
    }
    const commands = [];
    let shouldPushStackElementBefore = prevEditOperationType !== EditOperationType.DeletingLeft;
    for (let i = 0, len = selections.length; i < len; i++) {
      const deleteRange = DeleteOperations.getDeleteRange(selections[i], model, config);
      if (deleteRange.isEmpty()) {
        commands[i] = null;
        continue;
      }
      if (deleteRange.startLineNumber !== deleteRange.endLineNumber) {
        shouldPushStackElementBefore = true;
      }
      commands[i] = new ReplaceCommand(deleteRange, "");
    }
    return [shouldPushStackElementBefore, commands];
  }
  static getDeleteRange(selection, model, config) {
    if (!selection.isEmpty()) {
      return selection;
    }
    const position = selection.getPosition();
    if (config.useTabStops && position.column > 1) {
      const lineContent = model.getLineContent(position.lineNumber);
      const firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineContent);
      const lastIndentationColumn = firstNonWhitespaceIndex === -1 ? (
        /* entire string is whitespace */
        lineContent.length + 1
      ) : firstNonWhitespaceIndex + 1;
      if (position.column <= lastIndentationColumn) {
        const fromVisibleColumn = config.visibleColumnFromColumn(model, position);
        const toVisibleColumn = CursorColumns.prevIndentTabStop(fromVisibleColumn, config.indentSize);
        const toColumn = config.columnFromVisibleColumn(model, position.lineNumber, toVisibleColumn);
        return new Range(position.lineNumber, toColumn, position.lineNumber, position.column);
      }
    }
    return Range.fromPositions(DeleteOperations.getPositionAfterDeleteLeft(position, model), position);
  }
  static getPositionAfterDeleteLeft(position, model) {
    if (position.column > 1) {
      const idx = strings.getLeftDeleteOffset(position.column - 1, model.getLineContent(position.lineNumber));
      return position.with(void 0, idx + 1);
    } else if (position.lineNumber > 1) {
      const newLine = position.lineNumber - 1;
      return new Position(newLine, model.getLineMaxColumn(newLine));
    } else {
      return position;
    }
  }
  static cut(config, model, selections) {
    const commands = [];
    let lastCutRange = null;
    selections.sort((a, b) => Position.compare(a.getStartPosition(), b.getEndPosition()));
    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i];
      if (selection.isEmpty()) {
        if (config.emptySelectionClipboard) {
          const position = selection.getPosition();
          let startLineNumber, startColumn, endLineNumber, endColumn;
          if (position.lineNumber < model.getLineCount()) {
            startLineNumber = position.lineNumber;
            startColumn = 1;
            endLineNumber = position.lineNumber + 1;
            endColumn = 1;
          } else if (position.lineNumber > 1 && lastCutRange?.endLineNumber !== position.lineNumber) {
            startLineNumber = position.lineNumber - 1;
            startColumn = model.getLineMaxColumn(position.lineNumber - 1);
            endLineNumber = position.lineNumber;
            endColumn = model.getLineMaxColumn(position.lineNumber);
          } else {
            startLineNumber = position.lineNumber;
            startColumn = 1;
            endLineNumber = position.lineNumber;
            endColumn = model.getLineMaxColumn(position.lineNumber);
          }
          const deleteSelection = new Range(
            startLineNumber,
            startColumn,
            endLineNumber,
            endColumn
          );
          lastCutRange = deleteSelection;
          if (!deleteSelection.isEmpty()) {
            commands[i] = new ReplaceCommand(deleteSelection, "");
          } else {
            commands[i] = null;
          }
        } else {
          commands[i] = null;
        }
      } else {
        commands[i] = new ReplaceCommand(selection, "");
      }
    }
    return new EditOperationResult(EditOperationType.Other, commands, {
      shouldPushStackElementBefore: true,
      shouldPushStackElementAfter: true
    });
  }
}
export {
  DeleteOperations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2N1cnNvci9jdXJzb3JEZWxldGVPcGVyYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFJlcGxhY2VDb21tYW5kIH0gZnJvbSAnLi4vY29tbWFuZHMvcmVwbGFjZUNvbW1hbmQuanMnO1xuaW1wb3J0IHsgRWRpdG9yQXV0b0Nsb3NpbmdFZGl0U3RyYXRlZ3ksIEVkaXRvckF1dG9DbG9zaW5nU3RyYXRlZ3kgfSBmcm9tICcuLi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBDdXJzb3JDb25maWd1cmF0aW9uLCBFZGl0T3BlcmF0aW9uUmVzdWx0LCBFZGl0T3BlcmF0aW9uVHlwZSwgSUN1cnNvclNpbXBsZU1vZGVsLCBpc1F1b3RlIH0gZnJvbSAnLi4vY3Vyc29yQ29tbW9uLmpzJztcbmltcG9ydCB7IEN1cnNvckNvbHVtbnMgfSBmcm9tICcuLi9jb3JlL2N1cnNvckNvbHVtbnMuanMnO1xuaW1wb3J0IHsgTW92ZU9wZXJhdGlvbnMgfSBmcm9tICcuL2N1cnNvck1vdmVPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZCB9IGZyb20gJy4uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEF1dG9DbG9zaW5nUGFpckNvbmRpdGlvbmFsIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uL2NvcmUvcG9zaXRpb24uanMnO1xuXG5leHBvcnQgY2xhc3MgRGVsZXRlT3BlcmF0aW9ucyB7XG5cblx0cHVibGljIHN0YXRpYyBkZWxldGVSaWdodChwcmV2RWRpdE9wZXJhdGlvblR5cGU6IEVkaXRPcGVyYXRpb25UeXBlLCBjb25maWc6IEN1cnNvckNvbmZpZ3VyYXRpb24sIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdKTogW2Jvb2xlYW4sIEFycmF5PElDb21tYW5kIHwgbnVsbD5dIHtcblx0XHRjb25zdCBjb21tYW5kczogQXJyYXk8SUNvbW1hbmQgfCBudWxsPiA9IFtdO1xuXHRcdGxldCBzaG91bGRQdXNoU3RhY2tFbGVtZW50QmVmb3JlID0gKHByZXZFZGl0T3BlcmF0aW9uVHlwZSAhPT0gRWRpdE9wZXJhdGlvblR5cGUuRGVsZXRpbmdSaWdodCk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHNlbGVjdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHNlbGVjdGlvbnNbaV07XG5cblx0XHRcdGxldCBkZWxldGVTZWxlY3Rpb246IFJhbmdlID0gc2VsZWN0aW9uO1xuXG5cdFx0XHRpZiAoZGVsZXRlU2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IHNlbGVjdGlvbi5nZXRQb3NpdGlvbigpO1xuXHRcdFx0XHRjb25zdCByaWdodE9mUG9zaXRpb24gPSBNb3ZlT3BlcmF0aW9ucy5yaWdodChjb25maWcsIG1vZGVsLCBwb3NpdGlvbik7XG5cdFx0XHRcdGRlbGV0ZVNlbGVjdGlvbiA9IG5ldyBSYW5nZShcblx0XHRcdFx0XHRyaWdodE9mUG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0XHRyaWdodE9mUG9zaXRpb24uY29sdW1uLFxuXHRcdFx0XHRcdHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0cG9zaXRpb24uY29sdW1uXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChkZWxldGVTZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdC8vIFByb2JhYmx5IGF0IGVuZCBvZiBmaWxlID0+IGlnbm9yZVxuXHRcdFx0XHRjb21tYW5kc1tpXSA9IG51bGw7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZGVsZXRlU2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciAhPT0gZGVsZXRlU2VsZWN0aW9uLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0c2hvdWxkUHVzaFN0YWNrRWxlbWVudEJlZm9yZSA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbW1hbmRzW2ldID0gbmV3IFJlcGxhY2VDb21tYW5kKGRlbGV0ZVNlbGVjdGlvbiwgJycpO1xuXHRcdH1cblx0XHRyZXR1cm4gW3Nob3VsZFB1c2hTdGFja0VsZW1lbnRCZWZvcmUsIGNvbW1hbmRzXTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgaXNBdXRvQ2xvc2luZ1BhaXJEZWxldGUoXG5cdFx0YXV0b0Nsb3NpbmdEZWxldGU6IEVkaXRvckF1dG9DbG9zaW5nRWRpdFN0cmF0ZWd5LFxuXHRcdGF1dG9DbG9zaW5nQnJhY2tldHM6IEVkaXRvckF1dG9DbG9zaW5nU3RyYXRlZ3ksXG5cdFx0YXV0b0Nsb3NpbmdRdW90ZXM6IEVkaXRvckF1dG9DbG9zaW5nU3RyYXRlZ3ksXG5cdFx0YXV0b0Nsb3NpbmdQYWlyc09wZW46IE1hcDxzdHJpbmcsIFN0YW5kYXJkQXV0b0Nsb3NpbmdQYWlyQ29uZGl0aW9uYWxbXT4sXG5cdFx0bW9kZWw6IElDdXJzb3JTaW1wbGVNb2RlbCxcblx0XHRzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSxcblx0XHRhdXRvQ2xvc2VkQ2hhcmFjdGVyczogUmFuZ2VbXVxuXHQpOiBib29sZWFuIHtcblx0XHRpZiAoYXV0b0Nsb3NpbmdCcmFja2V0cyA9PT0gJ25ldmVyJyAmJiBhdXRvQ2xvc2luZ1F1b3RlcyA9PT0gJ25ldmVyJykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoYXV0b0Nsb3NpbmdEZWxldGUgPT09ICduZXZlcicpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gc2VsZWN0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gc2VsZWN0aW9uc1tpXTtcblx0XHRcdGNvbnN0IHBvc2l0aW9uID0gc2VsZWN0aW9uLmdldFBvc2l0aW9uKCk7XG5cblx0XHRcdGlmICghc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxpbmVUZXh0ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0XHRpZiAocG9zaXRpb24uY29sdW1uIDwgMiB8fCBwb3NpdGlvbi5jb2x1bW4gPj0gbGluZVRleHQubGVuZ3RoICsgMSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjaGFyYWN0ZXIgPSBsaW5lVGV4dC5jaGFyQXQocG9zaXRpb24uY29sdW1uIC0gMik7XG5cblx0XHRcdGNvbnN0IGF1dG9DbG9zaW5nUGFpckNhbmRpZGF0ZXMgPSBhdXRvQ2xvc2luZ1BhaXJzT3Blbi5nZXQoY2hhcmFjdGVyKTtcblx0XHRcdGlmICghYXV0b0Nsb3NpbmdQYWlyQ2FuZGlkYXRlcykge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpc1F1b3RlKGNoYXJhY3RlcikpIHtcblx0XHRcdFx0aWYgKGF1dG9DbG9zaW5nUXVvdGVzID09PSAnbmV2ZXInKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoYXV0b0Nsb3NpbmdCcmFja2V0cyA9PT0gJ25ldmVyJykge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhZnRlckNoYXJhY3RlciA9IGxpbmVUZXh0LmNoYXJBdChwb3NpdGlvbi5jb2x1bW4gLSAxKTtcblxuXHRcdFx0bGV0IGZvdW5kQXV0b0Nsb3NpbmdQYWlyID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IGF1dG9DbG9zaW5nUGFpckNhbmRpZGF0ZSBvZiBhdXRvQ2xvc2luZ1BhaXJDYW5kaWRhdGVzKSB7XG5cdFx0XHRcdGlmIChhdXRvQ2xvc2luZ1BhaXJDYW5kaWRhdGUub3BlbiA9PT0gY2hhcmFjdGVyICYmIGF1dG9DbG9zaW5nUGFpckNhbmRpZGF0ZS5jbG9zZSA9PT0gYWZ0ZXJDaGFyYWN0ZXIpIHtcblx0XHRcdFx0XHRmb3VuZEF1dG9DbG9zaW5nUGFpciA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghZm91bmRBdXRvQ2xvc2luZ1BhaXIpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBNdXN0IGRlbGV0ZSB0aGUgcGFpciBvbmx5IGlmIGl0IHdhcyBhdXRvbWF0aWNhbGx5IGluc2VydGVkIGJ5IHRoZSBlZGl0b3Jcblx0XHRcdGlmIChhdXRvQ2xvc2luZ0RlbGV0ZSA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRcdGxldCBmb3VuZCA9IGZhbHNlO1xuXHRcdFx0XHRmb3IgKGxldCBqID0gMCwgbGVuSiA9IGF1dG9DbG9zZWRDaGFyYWN0ZXJzLmxlbmd0aDsgaiA8IGxlbko7IGorKykge1xuXHRcdFx0XHRcdGNvbnN0IGF1dG9DbG9zZWRDaGFyYWN0ZXIgPSBhdXRvQ2xvc2VkQ2hhcmFjdGVyc1tqXTtcblx0XHRcdFx0XHRpZiAocG9zaXRpb24ubGluZU51bWJlciA9PT0gYXV0b0Nsb3NlZENoYXJhY3Rlci5zdGFydExpbmVOdW1iZXIgJiYgcG9zaXRpb24uY29sdW1uID09PSBhdXRvQ2xvc2VkQ2hhcmFjdGVyLnN0YXJ0Q29sdW1uKSB7XG5cdFx0XHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFmb3VuZCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3J1bkF1dG9DbG9zaW5nUGFpckRlbGV0ZShjb25maWc6IEN1cnNvckNvbmZpZ3VyYXRpb24sIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdKTogW2Jvb2xlYW4sIElDb21tYW5kW11dIHtcblx0XHRjb25zdCBjb21tYW5kczogSUNvbW1hbmRbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzZWxlY3Rpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IHNlbGVjdGlvbnNbaV0uZ2V0UG9zaXRpb24oKTtcblx0XHRcdGNvbnN0IGRlbGV0ZVNlbGVjdGlvbiA9IG5ldyBSYW5nZShcblx0XHRcdFx0cG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0cG9zaXRpb24uY29sdW1uIC0gMSxcblx0XHRcdFx0cG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0cG9zaXRpb24uY29sdW1uICsgMVxuXHRcdFx0KTtcblx0XHRcdGNvbW1hbmRzW2ldID0gbmV3IFJlcGxhY2VDb21tYW5kKGRlbGV0ZVNlbGVjdGlvbiwgJycpO1xuXHRcdH1cblx0XHRyZXR1cm4gW3RydWUsIGNvbW1hbmRzXTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVsZXRlTGVmdChwcmV2RWRpdE9wZXJhdGlvblR5cGU6IEVkaXRPcGVyYXRpb25UeXBlLCBjb25maWc6IEN1cnNvckNvbmZpZ3VyYXRpb24sIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdLCBhdXRvQ2xvc2VkQ2hhcmFjdGVyczogUmFuZ2VbXSk6IFtib29sZWFuLCBBcnJheTxJQ29tbWFuZCB8IG51bGw+XSB7XG5cdFx0aWYgKHRoaXMuaXNBdXRvQ2xvc2luZ1BhaXJEZWxldGUoY29uZmlnLmF1dG9DbG9zaW5nRGVsZXRlLCBjb25maWcuYXV0b0Nsb3NpbmdCcmFja2V0cywgY29uZmlnLmF1dG9DbG9zaW5nUXVvdGVzLCBjb25maWcuYXV0b0Nsb3NpbmdQYWlycy5hdXRvQ2xvc2luZ1BhaXJzT3BlbkJ5RW5kLCBtb2RlbCwgc2VsZWN0aW9ucywgYXV0b0Nsb3NlZENoYXJhY3RlcnMpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcnVuQXV0b0Nsb3NpbmdQYWlyRGVsZXRlKGNvbmZpZywgbW9kZWwsIHNlbGVjdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbW1hbmRzOiBBcnJheTxJQ29tbWFuZCB8IG51bGw+ID0gW107XG5cdFx0bGV0IHNob3VsZFB1c2hTdGFja0VsZW1lbnRCZWZvcmUgPSAocHJldkVkaXRPcGVyYXRpb25UeXBlICE9PSBFZGl0T3BlcmF0aW9uVHlwZS5EZWxldGluZ0xlZnQpO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzZWxlY3Rpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBkZWxldGVSYW5nZSA9IERlbGV0ZU9wZXJhdGlvbnMuZ2V0RGVsZXRlUmFuZ2Uoc2VsZWN0aW9uc1tpXSwgbW9kZWwsIGNvbmZpZyk7XG5cblx0XHRcdC8vIElnbm9yZSBlbXB0eSBkZWxldGUgcmFuZ2VzLCBhcyB0aGV5IGhhdmUgbm8gZWZmZWN0XG5cdFx0XHQvLyBUaGV5IGhhcHBlbiBpZiB0aGUgY3Vyc29yIGlzIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGZpbGUuXG5cdFx0XHRpZiAoZGVsZXRlUmFuZ2UuaXNFbXB0eSgpKSB7XG5cdFx0XHRcdGNvbW1hbmRzW2ldID0gbnVsbDtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChkZWxldGVSYW5nZS5zdGFydExpbmVOdW1iZXIgIT09IGRlbGV0ZVJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0c2hvdWxkUHVzaFN0YWNrRWxlbWVudEJlZm9yZSA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbW1hbmRzW2ldID0gbmV3IFJlcGxhY2VDb21tYW5kKGRlbGV0ZVJhbmdlLCAnJyk7XG5cdFx0fVxuXHRcdHJldHVybiBbc2hvdWxkUHVzaFN0YWNrRWxlbWVudEJlZm9yZSwgY29tbWFuZHNdO1xuXG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXREZWxldGVSYW5nZShzZWxlY3Rpb246IFNlbGVjdGlvbiwgbW9kZWw6IElDdXJzb3JTaW1wbGVNb2RlbCwgY29uZmlnOiBDdXJzb3JDb25maWd1cmF0aW9uLCk6IFJhbmdlIHtcblx0XHRpZiAoIXNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdHJldHVybiBzZWxlY3Rpb247XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSBzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblxuXHRcdC8vIFVuaW50ZW5kIHdoZW4gdXNpbmcgdGFiIHN0b3BzIGFuZCBjdXJzb3IgaXMgd2l0aGluIGluZGVudGF0aW9uXG5cdFx0aWYgKGNvbmZpZy51c2VUYWJTdG9wcyAmJiBwb3NpdGlvbi5jb2x1bW4gPiAxKSB7XG5cdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXG5cdFx0XHRjb25zdCBmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA9IHN0cmluZ3MuZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXgobGluZUNvbnRlbnQpO1xuXHRcdFx0Y29uc3QgbGFzdEluZGVudGF0aW9uQ29sdW1uID0gKFxuXHRcdFx0XHRmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA9PT0gLTFcblx0XHRcdFx0XHQ/IC8qIGVudGlyZSBzdHJpbmcgaXMgd2hpdGVzcGFjZSAqLyBsaW5lQ29udGVudC5sZW5ndGggKyAxXG5cdFx0XHRcdFx0OiBmaXJzdE5vbldoaXRlc3BhY2VJbmRleCArIDFcblx0XHRcdCk7XG5cblx0XHRcdGlmIChwb3NpdGlvbi5jb2x1bW4gPD0gbGFzdEluZGVudGF0aW9uQ29sdW1uKSB7XG5cdFx0XHRcdGNvbnN0IGZyb21WaXNpYmxlQ29sdW1uID0gY29uZmlnLnZpc2libGVDb2x1bW5Gcm9tQ29sdW1uKG1vZGVsLCBwb3NpdGlvbik7XG5cdFx0XHRcdGNvbnN0IHRvVmlzaWJsZUNvbHVtbiA9IEN1cnNvckNvbHVtbnMucHJldkluZGVudFRhYlN0b3AoZnJvbVZpc2libGVDb2x1bW4sIGNvbmZpZy5pbmRlbnRTaXplKTtcblx0XHRcdFx0Y29uc3QgdG9Db2x1bW4gPSBjb25maWcuY29sdW1uRnJvbVZpc2libGVDb2x1bW4obW9kZWwsIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHRvVmlzaWJsZUNvbHVtbik7XG5cdFx0XHRcdHJldHVybiBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgdG9Db2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJhbmdlLmZyb21Qb3NpdGlvbnMoRGVsZXRlT3BlcmF0aW9ucy5nZXRQb3NpdGlvbkFmdGVyRGVsZXRlTGVmdChwb3NpdGlvbiwgbW9kZWwpLCBwb3NpdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRQb3NpdGlvbkFmdGVyRGVsZXRlTGVmdChwb3NpdGlvbjogUG9zaXRpb24sIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwpOiBQb3NpdGlvbiB7XG5cdFx0aWYgKHBvc2l0aW9uLmNvbHVtbiA+IDEpIHtcblx0XHRcdC8vIENvbnZlcnQgMS1iYXNlZCBjb2x1bW5zIHRvIDAtYmFzZWQgb2Zmc2V0cyBhbmQgYmFjay5cblx0XHRcdGNvbnN0IGlkeCA9IHN0cmluZ3MuZ2V0TGVmdERlbGV0ZU9mZnNldChwb3NpdGlvbi5jb2x1bW4gLSAxLCBtb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKSk7XG5cdFx0XHRyZXR1cm4gcG9zaXRpb24ud2l0aCh1bmRlZmluZWQsIGlkeCArIDEpO1xuXHRcdH0gZWxzZSBpZiAocG9zaXRpb24ubGluZU51bWJlciA+IDEpIHtcblx0XHRcdGNvbnN0IG5ld0xpbmUgPSBwb3NpdGlvbi5saW5lTnVtYmVyIC0gMTtcblx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24obmV3TGluZSwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihuZXdMaW5lKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBwb3NpdGlvbjtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGN1dChjb25maWc6IEN1cnNvckNvbmZpZ3VyYXRpb24sIG1vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWwsIHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdKTogRWRpdE9wZXJhdGlvblJlc3VsdCB7XG5cdFx0Y29uc3QgY29tbWFuZHM6IEFycmF5PElDb21tYW5kIHwgbnVsbD4gPSBbXTtcblx0XHRsZXQgbGFzdEN1dFJhbmdlOiBSYW5nZSB8IG51bGwgPSBudWxsO1xuXHRcdHNlbGVjdGlvbnMuc29ydCgoYSwgYikgPT4gUG9zaXRpb24uY29tcGFyZShhLmdldFN0YXJ0UG9zaXRpb24oKSwgYi5nZXRFbmRQb3NpdGlvbigpKSk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHNlbGVjdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHNlbGVjdGlvbnNbaV07XG5cblx0XHRcdGlmIChzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdGlmIChjb25maWcuZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQpIHtcblx0XHRcdFx0XHQvLyBUaGlzIGlzIGEgZnVsbCBsaW5lIGN1dFxuXG5cdFx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSBzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblxuXHRcdFx0XHRcdGxldCBzdGFydExpbmVOdW1iZXI6IG51bWJlcixcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiBudW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBudW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IG51bWJlcjtcblxuXHRcdFx0XHRcdGlmIChwb3NpdGlvbi5saW5lTnVtYmVyIDwgbW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0XHRcdC8vIEN1dHRpbmcgYSBsaW5lIGluIHRoZSBtaWRkbGUgb2YgdGhlIG1vZGVsXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW4gPSAxO1xuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlciA9IHBvc2l0aW9uLmxpbmVOdW1iZXIgKyAxO1xuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uID0gMTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHBvc2l0aW9uLmxpbmVOdW1iZXIgPiAxICYmIGxhc3RDdXRSYW5nZT8uZW5kTGluZU51bWJlciAhPT0gcG9zaXRpb24ubGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0Ly8gQ3V0dGluZyB0aGUgbGFzdCBsaW5lICYgdGhlcmUgYXJlIG1vcmUgdGhhbiAxIGxpbmVzIGluIHRoZSBtb2RlbCAmIGEgcHJldmlvdXMgY3V0IG9wZXJhdGlvbiBkb2VzIG5vdCB0b3VjaCB0aGUgY3VycmVudCBjdXQgb3BlcmF0aW9uXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyIC0gMTtcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihwb3NpdGlvbi5saW5lTnVtYmVyIC0gMSk7XG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyID0gcG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdFx0XHRcdGVuZENvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4ocG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIEN1dHRpbmcgdGhlIHNpbmdsZSBsaW5lIHRoYXQgdGhlIG1vZGVsIGNvbnRhaW5zXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW4gPSAxO1xuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlciA9IHBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRcdFx0XHRlbmRDb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGRlbGV0ZVNlbGVjdGlvbiA9IG5ldyBSYW5nZShcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdGVuZENvbHVtblxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0bGFzdEN1dFJhbmdlID0gZGVsZXRlU2VsZWN0aW9uO1xuXG5cdFx0XHRcdFx0aWYgKCFkZWxldGVTZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdFx0XHRjb21tYW5kc1tpXSA9IG5ldyBSZXBsYWNlQ29tbWFuZChkZWxldGVTZWxlY3Rpb24sICcnKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29tbWFuZHNbaV0gPSBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBDYW5ub3QgY3V0IGVtcHR5IHNlbGVjdGlvblxuXHRcdFx0XHRcdGNvbW1hbmRzW2ldID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29tbWFuZHNbaV0gPSBuZXcgUmVwbGFjZUNvbW1hbmQoc2VsZWN0aW9uLCAnJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgRWRpdE9wZXJhdGlvblJlc3VsdChFZGl0T3BlcmF0aW9uVHlwZS5PdGhlciwgY29tbWFuZHMsIHtcblx0XHRcdHNob3VsZFB1c2hTdGFja0VsZW1lbnRCZWZvcmU6IHRydWUsXG5cdFx0XHRzaG91bGRQdXNoU3RhY2tFbGVtZW50QWZ0ZXI6IHRydWVcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxhQUFhO0FBQ3pCLFNBQVMsc0JBQXNCO0FBRS9CLFNBQThCLHFCQUFxQixtQkFBdUMsZUFBZTtBQUN6RyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGFBQWE7QUFJdEIsU0FBUyxnQkFBZ0I7QUFFbEIsTUFBTSxpQkFBaUI7QUFBQSxFQUU3QixPQUFjLFlBQVksdUJBQTBDLFFBQTZCLE9BQTJCLFlBQTREO0FBQ3ZMLFVBQU0sV0FBbUMsQ0FBQztBQUMxQyxRQUFJLCtCQUFnQywwQkFBMEIsa0JBQWtCO0FBQ2hGLGFBQVMsSUFBSSxHQUFHLE1BQU0sV0FBVyxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ3RELFlBQU0sWUFBWSxXQUFXLENBQUM7QUFFOUIsVUFBSSxrQkFB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
