import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { CoreEditingCommands } from "../../../browser/coreCommands.js";
import { EditorAction, registerEditorAction } from "../../../browser/editorExtensions.js";
import { ReplaceCommand, ReplaceCommandThatPreservesSelection, ReplaceCommandThatSelectsText } from "../../../common/commands/replaceCommand.js";
import { TrimTrailingWhitespaceCommand } from "../../../common/commands/trimTrailingWhitespaceCommand.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { TypeOperations } from "../../../common/cursor/cursorTypeOperations.js";
import { EnterOperation } from "../../../common/cursor/cursorTypeEditOperations.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { CopyLinesCommand } from "./copyLinesCommand.js";
import { MoveLinesCommand } from "./moveLinesCommand.js";
import { SortLinesCommand } from "./sortLinesCommand.js";
import * as nls from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
class AbstractCopyLinesAction extends EditorAction {
  constructor(down, opts) {
    super(opts);
    this.down = down;
  }
  run(_accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const selections = editor.getSelections().map((selection, index) => ({ selection, index, ignore: false }));
    selections.sort((a, b) => Range.compareRangesUsingStarts(a.selection, b.selection));
    let prev = selections[0];
    for (let i = 1; i < selections.length; i++) {
      const curr = selections[i];
      if (prev.selection.endLineNumber === curr.selection.startLineNumber) {
        if (prev.index < curr.index) {
          curr.ignore = true;
        } else {
          prev.ignore = true;
          prev = curr;
        }
      }
    }
    const commands = [];
    for (const selection of selections) {
      commands.push(new CopyLinesCommand(selection.selection, this.down, selection.ignore));
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, commands);
    editor.pushUndoStop();
  }
}
class CopyLinesUpAction extends AbstractCopyLinesAction {
  constructor() {
    super(false, {
      id: "editor.action.copyLinesUpAction",
      label: nls.localize2("lines.copyUp", "Copy Line Up"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Alt | KeyMod.Shift | KeyCode.UpArrow,
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.UpArrow },
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "2_line",
        title: nls.localize({ key: "miCopyLinesUp", comment: ["&& denotes a mnemonic"] }, "&&Copy Line Up"),
        order: 1
      }
    });
  }
}
class CopyLinesDownAction extends AbstractCopyLinesAction {
  constructor() {
    super(true, {
      id: "editor.action.copyLinesDownAction",
      label: nls.localize2("lines.copyDown", "Copy Line Down"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Alt | KeyMod.Shift | KeyCode.DownArrow,
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.DownArrow },
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "2_line",
        title: nls.localize({ key: "miCopyLinesDown", comment: ["&& denotes a mnemonic"] }, "Co&&py Line Down"),
        order: 2
      }
    });
  }
}
class DuplicateSelectionAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.duplicateSelection",
      label: nls.localize2("duplicateSelection", "Duplicate Selection"),
      precondition: EditorContextKeys.writable,
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "2_line",
        title: nls.localize({ key: "miDuplicateSelection", comment: ["&& denotes a mnemonic"] }, "&&Duplicate Selection"),
        order: 5
      }
    });
  }
  run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    const commands = [];
    const selections = editor.getSelections();
    const model = editor.getModel();
    for (const selection of selections) {
      if (selection.isEmpty()) {
        commands.push(new CopyLinesCommand(selection, true));
      } else {
        const insertSelection = new Selection(selection.endLineNumber, selection.endColumn, selection.endLineNumber, selection.endColumn);
        commands.push(new ReplaceCommandThatSelectsText(insertSelection, model.getValueInRange(selection)));
      }
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, commands);
    editor.pushUndoStop();
  }
}
class AbstractMoveLinesAction extends EditorAction {
  constructor(down, opts) {
    super(opts);
    this.down = down;
  }
  run(accessor, editor) {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    const commands = [];
    const selections = editor.getSelections() || [];
    const autoIndent = editor.getOption(EditorOption.autoIndent);
    for (const selection of selections) {
      commands.push(new MoveLinesCommand(selection, this.down, autoIndent, languageConfigurationService));
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, commands);
    editor.pushUndoStop();
  }
}
class MoveLinesUpAction extends AbstractMoveLinesAction {
  constructor() {
    super(false, {
      id: "editor.action.moveLinesUpAction",
      label: nls.localize2("lines.moveUp", "Move Line Up"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Alt | KeyCode.UpArrow,
        linux: { primary: KeyMod.Alt | KeyCode.UpArrow },
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "2_line",
        title: nls.localize({ key: "miMoveLinesUp", comment: ["&& denotes a mnemonic"] }, "Mo&&ve Line Up"),
        order: 3
      }
    });
  }
}
class MoveLinesDownAction extends AbstractMoveLinesAction {
  constructor() {
    super(true, {
      id: "editor.action.moveLinesDownAction",
      label: nls.localize2("lines.moveDown", "Move Line Down"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Alt | KeyCode.DownArrow,
        linux: { primary: KeyMod.Alt | KeyCode.DownArrow },
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "2_line",
        title: nls.localize({ key: "miMoveLinesDown", comment: ["&& denotes a mnemonic"] }, "Move &&Line Down"),
        order: 4
      }
    });
  }
}
class AbstractSortLinesAction extends EditorAction {
  constructor(descending, opts) {
    super(opts);
    this.descending = descending;
  }
  run(_accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const model = editor.getModel();
    let selections = editor.getSelections();
    if (selections.length === 1 && selections[0].isEmpty()) {
      selections = [new Selection(1, 1, model.getLineCount(), model.getLineMaxColumn(model.getLineCount()))];
    }
    for (const selection of selections) {
      if (!SortLinesCommand.canRun(editor.getModel(), selection, this.descending)) {
        return;
      }
    }
    const commands = [];
    for (let i = 0, len = selections.length; i < len; i++) {
      commands[i] = new SortLinesCommand(selections[i], this.descending);
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, commands);
    editor.pushUndoStop();
  }
}
class SortLinesAscendingAction extends AbstractSortLinesAction {
  constructor() {
    super(false, {
      id: "editor.action.sortLinesAscending",
      label: nls.localize2("lines.sortAscending", "Sort Lines Ascending"),
      precondition: EditorContextKeys.writable
    });
  }
}
class SortLinesDescendingAction extends AbstractSortLinesAction {
  constructor() {
    super(true, {
      id: "editor.action.sortLinesDescending",
      label: nls.localize2("lines.sortDescending", "Sort Lines Descending"),
      precondition: EditorContextKeys.writable
    });
  }
}
class DeleteDuplicateLinesAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.removeDuplicateLines",
      label: nls.localize2("lines.deleteDuplicates", "Delete Duplicate Lines"),
      precondition: EditorContextKeys.writable
    });
  }
  run(_accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const model = editor.getModel();
    if (model.getLineCount() === 1 && model.getLineMaxColumn(1) === 1) {
      return;
    }
    const edits = [];
    const endCursorState = [];
    let linesDeleted = 0;
    let updateSelection = true;
    let selections = editor.getSelections();
    if (selections.length === 1 && selections[0].isEmpty()) {
      selections = [new Selection(1, 1, model.getLineCount(), model.getLineMaxColumn(model.getLineCount()))];
      updateSelection = false;
    }
    for (const selection of selections) {
      const uniqueLines = /* @__PURE__ */ new Set();
      const lines = [];
      for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) {
        const line = model.getLineContent(i);
        if (uniqueLines.has(line)) {
          continue;
        }
        lines.push(line);
        uniqueLines.add(line);
      }
      const selectionToReplace = new Selection(
        selection.startLineNumber,
        1,
        selection.endLineNumber,
        model.getLineMaxColumn(selection.endLineNumber)
      );
      const adjustedSelectionStart = selection.startLineNumber - linesDeleted;
      const finalSelection = new Selection(
        adjustedSelectionStart,
        1,
        adjustedSelectionStart + lines.length - 1,
        lines[lines.length - 1].length
      );
      edits.push(EditOperation.replace(selectionToReplace, lines.join("\n")));
      endCursorState.push(finalSelection);
      linesDeleted += selection.endLineNumber - selection.startLineNumber + 1 - lines.length;
    }
    editor.pushUndoStop();
    editor.executeEdits(this.id, edits, updateSelection ? endCursorState : void 0);
    editor.pushUndoStop();
  }
}
const _TrimTrailingWhitespaceAction = class _TrimTrailingWhitespaceAction extends EditorAction {
  constructor() {
    super({
      id: _TrimTrailingWhitespaceAction.ID,
      label: nls.localize2("lines.trimTrailingWhitespace", "Trim Trailing Whitespace"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyX),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor, args) {
    let cursors = [];
    if (args.reason === "auto-save") {
      cursors = (editor.getSelections() || []).map((s) => new Position(s.positionLineNumber, s.positionColumn));
    }
    const selection = editor.getSelection();
    if (selection === null) {
      return;
    }
    const config = _accessor.get(IConfigurationService);
    const model = editor.getModel();
    const trimInRegexAndStrings = config.getValue("files.trimTrailingWhitespaceInRegexAndStrings", { overrideIdentifier: model?.getLanguageId(), resource: model?.uri });
    const command = new TrimTrailingWhitespaceCommand(selection, cursors, trimInRegexAndStrings);
    editor.pushUndoStop();
    editor.executeCommands(this.id, [command]);
    editor.pushUndoStop();
  }
};
_TrimTrailingWhitespaceAction.ID = "editor.action.trimTrailingWhitespace";
let TrimTrailingWhitespaceAction = _TrimTrailingWhitespaceAction;
class DeleteLinesAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.deleteLines",
      label: nls.localize2("lines.delete", "Delete Line"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const ops = this._getLinesToRemove(editor);
    const model = editor.getModel();
    if (model.getLineCount() === 1 && model.getLineMaxColumn(1) === 1) {
      return;
    }
    let linesDeleted = 0;
    const edits = [];
    const cursorState = [];
    for (let i = 0, len = ops.length; i < len; i++) {
      const op = ops[i];
      let startLineNumber = op.startLineNumber;
      let endLineNumber = op.endLineNumber;
      let startColumn = 1;
      let endColumn = model.getLineMaxColumn(endLineNumber);
      if (endLineNumber < model.getLineCount()) {
        endLineNumber += 1;
        endColumn = 1;
      } else if (startLineNumber > 1) {
        startLineNumber -= 1;
        startColumn = model.getLineMaxColumn(startLineNumber);
      }
      edits.push(EditOperation.replace(new Selection(startLineNumber, startColumn, endLineNumber, endColumn), ""));
      cursorState.push(new Selection(startLineNumber - linesDeleted, op.positionColumn, startLineNumber - linesDeleted, op.positionColumn));
      linesDeleted += op.endLineNumber - op.startLineNumber + 1;
    }
    editor.pushUndoStop();
    editor.executeEdits(this.id, edits, cursorState);
    editor.pushUndoStop();
  }
  _getLinesToRemove(editor) {
    const operations = editor.getSelections().map((s) => {
      let endLineNumber = s.endLineNumber;
      if (s.startLineNumber < s.endLineNumber && s.endColumn === 1) {
        endLineNumber -= 1;
      }
      return {
        startLineNumber: s.startLineNumber,
        selectionStartColumn: s.selectionStartColumn,
        endLineNumber,
        positionColumn: s.positionColumn
      };
    });
    operations.sort((a, b) => {
      if (a.startLineNumber === b.startLineNumber) {
        return a.endLineNumber - b.endLineNumber;
      }
      return a.startLineNumber - b.startLineNumber;
    });
    const mergedOperations = [];
    let previousOperation = operations[0];
    for (let i = 1; i < operations.length; i++) {
      if (previousOperation.endLineNumber + 1 >= operations[i].startLineNumber) {
        previousOperation.endLineNumber = operations[i].endLineNumber;
      } else {
        mergedOperations.push(previousOperation);
        previousOperation = operations[i];
      }
    }
    mergedOperations.push(previousOperation);
    return mergedOperations;
  }
}
class IndentLinesAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.indentLines",
      label: nls.localize2("lines.indent", "Indent Line"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyCode.BracketRight,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor) {
    const viewModel = editor._getViewModel();
    if (!viewModel) {
      return;
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, TypeOperations.indent(viewModel.cursorConfig, editor.getModel(), editor.getSelections()));
    editor.pushUndoStop();
  }
}
class OutdentLinesAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.outdentLines",
      label: nls.localize2("lines.outdent", "Outdent Line"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyCode.BracketLeft,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor) {
    CoreEditingCommands.Outdent.runEditorCommand(_accessor, editor, null);
  }
}
class InsertLineBeforeAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.insertLineBefore",
      label: nls.localize2("lines.insertBefore", "Insert Line Above"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor) {
    const viewModel = editor._getViewModel();
    if (!viewModel) {
      return;
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, EnterOperation.lineInsertBefore(viewModel.cursorConfig, editor.getModel(), editor.getSelections()));
  }
}
class InsertLineAfterAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.insertLineAfter",
      label: nls.localize2("lines.insertAfter", "Insert Line Below"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor) {
    const viewModel = editor._getViewModel();
    if (!viewModel) {
      return;
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, EnterOperation.lineInsertAfter(viewModel.cursorConfig, editor.getModel(), editor.getSelections()));
  }
}
class AbstractDeleteAllToBoundaryAction extends EditorAction {
  run(_accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const primaryCursor = editor.getSelection();
    const rangesToDelete = this._getRangesToDelete(editor);
    const effectiveRanges = [];
    for (let i = 0, count = rangesToDelete.length - 1; i < count; i++) {
      const range = rangesToDelete[i];
      const nextRange = rangesToDelete[i + 1];
      if (Range.intersectRanges(range, nextRange) === null) {
        effectiveRanges.push(range);
      } else {
        rangesToDelete[i + 1] = Range.plusRange(range, nextRange);
      }
    }
    effectiveRanges.push(rangesToDelete[rangesToDelete.length - 1]);
    const endCursorState = this._getEndCursorState(primaryCursor, effectiveRanges);
    const edits = effectiveRanges.map((range) => {
      return EditOperation.replace(range, "");
    });
    editor.pushUndoStop();
    editor.executeEdits(this.id, edits, endCursorState);
    editor.pushUndoStop();
  }
}
class DeleteAllLeftAction extends AbstractDeleteAllToBoundaryAction {
  constructor() {
    super({
      id: "deleteAllLeft",
      label: nls.localize2("lines.deleteAllLeft", "Delete All Left"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 0,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.Backspace },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  _getEndCursorState(primaryCursor, rangesToDelete) {
    let endPrimaryCursor = null;
    const endCursorState = [];
    let deletedLines = 0;
    rangesToDelete.forEach((range) => {
      let endCursor;
      if (range.endColumn === 1 && deletedLines > 0) {
        const newStartLine = range.startLineNumber - deletedLines;
        endCursor = new Selection(newStartLine, range.startColumn, newStartLine, range.startColumn);
      } else {
        endCursor = new Selection(range.startLineNumber, range.startColumn, range.startLineNumber, range.startColumn);
      }
      deletedLines += range.endLineNumber - range.startLineNumber;
      if (range.intersectRanges(primaryCursor)) {
        endPrimaryCursor = endCursor;
      } else {
        endCursorState.push(endCursor);
      }
    });
    if (endPrimaryCursor) {
      endCursorState.unshift(endPrimaryCursor);
    }
    return endCursorState;
  }
  _getRangesToDelete(editor) {
    const selections = editor.getSelections();
    if (selections === null) {
      return [];
    }
    let rangesToDelete = selections;
    const model = editor.getModel();
    if (model === null) {
      return [];
    }
    rangesToDelete.sort(Range.compareRangesUsingStarts);
    rangesToDelete = rangesToDelete.map((selection) => {
      if (selection.isEmpty()) {
        if (selection.startColumn === 1) {
          const deleteFromLine = Math.max(1, selection.startLineNumber - 1);
          const deleteFromColumn = selection.startLineNumber === 1 ? 1 : model.getLineLength(deleteFromLine) + 1;
          return new Range(deleteFromLine, deleteFromColumn, selection.startLineNumber, 1);
        } else {
          return new Range(selection.startLineNumber, 1, selection.startLineNumber, selection.startColumn);
        }
      } else {
        return new Range(selection.startLineNumber, 1, selection.endLineNumber, selection.endColumn);
      }
    });
    return rangesToDelete;
  }
}
class DeleteAllRightAction extends AbstractDeleteAllToBoundaryAction {
  constructor() {
    super({
      id: "deleteAllRight",
      label: nls.localize2("lines.deleteAllRight", "Delete All Right"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 0,
        mac: { primary: KeyMod.WinCtrl | KeyCode.KeyK, secondary: [KeyMod.CtrlCmd | KeyCode.Delete] },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  _getEndCursorState(primaryCursor, rangesToDelete) {
    let endPrimaryCursor = null;
    const endCursorState = [];
    for (let i = 0, len = rangesToDelete.length, offset = 0; i < len; i++) {
      const range = rangesToDelete[i];
      const endCursor = new Selection(range.startLineNumber - offset, range.startColumn, range.startLineNumber - offset, range.startColumn);
      if (range.intersectRanges(primaryCursor)) {
        endPrimaryCursor = endCursor;
      } else {
        endCursorState.push(endCursor);
      }
    }
    if (endPrimaryCursor) {
      endCursorState.unshift(endPrimaryCursor);
    }
    return endCursorState;
  }
  _getRangesToDelete(editor) {
    const model = editor.getModel();
    if (model === null) {
      return [];
    }
    const selections = editor.getSelections();
    if (selections === null) {
      return [];
    }
    const rangesToDelete = selections.map((sel) => {
      if (sel.isEmpty()) {
        const maxColumn = model.getLineMaxColumn(sel.startLineNumber);
        if (sel.startColumn === maxColumn) {
          return new Range(sel.startLineNumber, sel.startColumn, sel.startLineNumber + 1, 1);
        } else {
          return new Range(sel.startLineNumber, sel.startColumn, sel.startLineNumber, maxColumn);
        }
      }
      return sel;
    });
    rangesToDelete.sort(Range.compareRangesUsingStarts);
    return rangesToDelete;
  }
}
class JoinLinesAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.joinLines",
      label: nls.localize2("lines.joinLines", "Join Lines"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: 0,
        mac: { primary: KeyMod.WinCtrl | KeyCode.KeyJ },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor) {
    const selections = editor.getSelections();
    if (selections === null) {
      return;
    }
    let primaryCursor = editor.getSelection();
    if (primaryCursor === null) {
      return;
    }
    selections.sort(Range.compareRangesUsingStarts);
    const reducedSelections = [];
    const lastSelection = selections.reduce((previousValue, currentValue) => {
      if (previousValue.isEmpty()) {
        if (previousValue.endLineNumber === currentValue.startLineNumber) {
          if (primaryCursor.equalsSelection(previousValue)) {
            primaryCursor = currentValue;
          }
          return currentValue;
        }
        if (currentValue.startLineNumber > previousValue.endLineNumber + 1) {
          reducedSelections.push(previousValue);
          return currentValue;
        } else {
          return new Selection(previousValue.startLineNumber, previousValue.startColumn, currentValue.endLineNumber, currentValue.endColumn);
        }
      } else {
        if (currentValue.startLineNumber > previousValue.endLineNumber) {
          reducedSelections.push(previousValue);
          return currentValue;
        } else {
          return new Selection(previousValue.startLineNumber, previousValue.startColumn, currentValue.endLineNumber, currentValue.endColumn);
        }
      }
    });
    reducedSelections.push(lastSelection);
    const model = editor.getModel();
    if (model === null) {
      return;
    }
    const edits = [];
    const endCursorState = [];
    let endPrimaryCursor = primaryCursor;
    let lineOffset = 0;
    for (let i = 0, len = reducedSelections.length; i < len; i++) {
      const selection = reducedSelections[i];
      const startLineNumber = selection.startLineNumber;
      const startColumn = 1;
      let columnDeltaOffset = 0;
      let endLineNumber, endColumn;
      const selectionEndPositionOffset = model.getLineLength(selection.endLineNumber) - selection.endColumn;
      if (selection.isEmpty() || selection.startLineNumber === selection.endLineNumber) {
        const position = selection.getStartPosition();
        if (position.lineNumber < model.getLineCount()) {
          endLineNumber = startLineNumber + 1;
          endColumn = model.getLineMaxColumn(endLineNumber);
        } else {
          endLineNumber = position.lineNumber;
          endColumn = model.getLineMaxColumn(position.lineNumber);
        }
      } else {
        endLineNumber = selection.endLineNumber;
        endColumn = model.getLineMaxColumn(endLineNumber);
      }
      let trimmedLinesContent = model.getLineContent(startLineNumber);
      for (let i2 = startLineNumber + 1; i2 <= endLineNumber; i2++) {
        const lineText = model.getLineContent(i2);
        const firstNonWhitespaceIdx = model.getLineFirstNonWhitespaceColumn(i2);
        if (firstNonWhitespaceIdx >= 1) {
          let insertSpace = true;
          if (trimmedLinesContent === "") {
            insertSpace = false;
          }
          if (insertSpace && (trimmedLinesContent.charAt(trimmedLinesContent.length - 1) === " " || trimmedLinesContent.charAt(trimmedLinesContent.length - 1) === "	")) {
            insertSpace = false;
            trimmedLinesContent = trimmedLinesContent.replace(/[\s\uFEFF\xA0]+$/g, " ");
          }
          const lineTextWithoutIndent = lineText.substr(firstNonWhitespaceIdx - 1);
          trimmedLinesContent += (insertSpace ? " " : "") + lineTextWithoutIndent;
          if (insertSpace) {
            columnDeltaOffset = lineTextWithoutIndent.length + 1;
          } else {
            columnDeltaOffset = lineTextWithoutIndent.length;
          }
        } else {
          columnDeltaOffset = 0;
        }
      }
      const deleteSelection = new Range(startLineNumber, startColumn, endLineNumber, endColumn);
      if (!deleteSelection.isEmpty()) {
        let resultSelection;
        if (selection.isEmpty()) {
          edits.push(EditOperation.replace(deleteSelection, trimmedLinesContent));
          resultSelection = new Selection(deleteSelection.startLineNumber - lineOffset, trimmedLinesContent.length - columnDeltaOffset + 1, startLineNumber - lineOffset, trimmedLinesContent.length - columnDeltaOffset + 1);
        } else {
          if (selection.startLineNumber === selection.endLineNumber) {
            edits.push(EditOperation.replace(deleteSelection, trimmedLinesContent));
            resultSelection = new Selection(
              selection.startLineNumber - lineOffset,
              selection.startColumn,
              selection.endLineNumber - lineOffset,
              selection.endColumn
            );
          } else {
            edits.push(EditOperation.replace(deleteSelection, trimmedLinesContent));
            resultSelection = new Selection(
              selection.startLineNumber - lineOffset,
              selection.startColumn,
              selection.startLineNumber - lineOffset,
              trimmedLinesContent.length - selectionEndPositionOffset
            );
          }
        }
        if (Range.intersectRanges(deleteSelection, primaryCursor) !== null) {
          endPrimaryCursor = resultSelection;
        } else {
          endCursorState.push(resultSelection);
        }
      }
      lineOffset += deleteSelection.endLineNumber - deleteSelection.startLineNumber;
    }
    endCursorState.unshift(endPrimaryCursor);
    editor.pushUndoStop();
    editor.executeEdits(this.id, edits, endCursorState);
    editor.pushUndoStop();
  }
}
class TransposeAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.transpose",
      label: nls.localize2("editor.transpose", "Transpose Characters around the Cursor"),
      precondition: EditorContextKeys.writable
    });
  }
  run(_accessor, editor) {
    const selections = editor.getSelections();
    if (selections === null) {
      return;
    }
    const model = editor.getModel();
    if (model === null) {
      return;
    }
    const commands = [];
    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i];
      if (!selection.isEmpty()) {
        continue;
      }
      const cursor = selection.getStartPosition();
      const maxColumn = model.getLineMaxColumn(cursor.lineNumber);
      if (cursor.column >= maxColumn) {
        if (cursor.lineNumber === model.getLineCount()) {
          continue;
        }
        const deleteSelection = new Range(cursor.lineNumber, Math.max(1, cursor.column - 1), cursor.lineNumber + 1, 1);
        const chars = model.getValueInRange(deleteSelection).split("").reverse().join("");
        commands.push(new ReplaceCommand(new Selection(cursor.lineNumber, Math.max(1, cursor.column - 1), cursor.lineNumber + 1, 1), chars));
      } else {
        const deleteSelection = new Range(cursor.lineNumber, Math.max(1, cursor.column - 1), cursor.lineNumber, cursor.column + 1);
        const chars = model.getValueInRange(deleteSelection).split("").reverse().join("");
        commands.push(new ReplaceCommandThatPreservesSelection(
          deleteSelection,
          chars,
          new Selection(cursor.lineNumber, cursor.column + 1, cursor.lineNumber, cursor.column + 1)
        ));
      }
    }
    editor.pushUndoStop();
    editor.executeCommands(this.id, commands);
    editor.pushUndoStop();
  }
}
class AbstractCaseAction extends EditorAction {
  run(_accessor, editor) {
    const selections = editor.getSelections();
    if (selections === null) {
      return;
    }
    const model = editor.getModel();
    if (model === null) {
      return;
    }
    const wordSeparators = editor.getOption(EditorOption.wordSeparators);
    const textEdits = [];
    for (const selection of selections) {
      if (selection.isEmpty()) {
        const cursor = selection.getStartPosition();
        const word = editor.getConfiguredWordAtPosition(cursor);
        if (!word) {
          continue;
        }
        const wordRange = new Range(cursor.lineNumber, word.startColumn, cursor.lineNumber, word.endColumn);
        const text = model.getValueInRange(wordRange);
        textEdits.push(EditOperation.replace(wordRange, this._modifyText(text, wordSeparators)));
      } else {
        const text = model.getValueInRange(selection);
        textEdits.push(EditOperation.replace(selection, this._modifyText(text, wordSeparators)));
      }
    }
    editor.pushUndoStop();
    editor.executeEdits(this.id, textEdits);
    editor.pushUndoStop();
  }
}
class UpperCaseAction extends AbstractCaseAction {
  constructor() {
    super({
      id: "editor.action.transformToUppercase",
      label: nls.localize2("editor.transformToUppercase", "Transform to Uppercase"),
      precondition: EditorContextKeys.writable
    });
  }
  _modifyText(text, wordSeparators) {
    return text.toLocaleUpperCase();
  }
}
class LowerCaseAction extends AbstractCaseAction {
  constructor() {
    super({
      id: "editor.action.transformToLowercase",
      label: nls.localize2("editor.transformToLowercase", "Transform to Lowercase"),
      precondition: EditorContextKeys.writable
    });
  }
  _modifyText(text, wordSeparators) {
    return text.toLocaleLowerCase();
  }
}
class BackwardsCompatibleRegExp {
  constructor(_pattern, _flags) {
    this._pattern = _pattern;
    this._flags = _flags;
    this._actual = null;
    this._evaluated = false;
  }
  get() {
    if (!this._evaluated) {
      this._evaluated = true;
      try {
        this._actual = new RegExp(this._pattern, this._flags);
      } catch (err) {
      }
    }
    return this._actual;
  }
  isSupported() {
    return this.get() !== null;
  }
}
const _TitleCaseAction = class _TitleCaseAction extends AbstractCaseAction {
  constructor() {
    super({
      id: "editor.action.transformToTitlecase",
      label: nls.localize2("editor.transformToTitlecase", "Transform to Title Case"),
      precondition: EditorContextKeys.writable
    });
  }
  _modifyText(text, wordSeparators) {
    const titleBoundary = _TitleCaseAction.titleBoundary.get();
    if (!titleBoundary) {
      return text;
    }
    return text.toLocaleLowerCase().replace(titleBoundary, (b) => b.toLocaleUpperCase());
  }
};
_TitleCaseAction.titleBoundary = new BackwardsCompatibleRegExp("(^|[^\\p{L}\\p{N}']|((^|\\P{L})'))\\p{L}", "gmu");
let TitleCaseAction = _TitleCaseAction;
const _SnakeCaseAction = class _SnakeCaseAction extends AbstractCaseAction {
  constructor() {
    super({
      id: "editor.action.transformToSnakecase",
      label: nls.localize2("editor.transformToSnakecase", "Transform to Snake Case"),
      precondition: EditorContextKeys.writable
    });
  }
  _modifyText(text, wordSeparators) {
    const caseBoundary = _SnakeCaseAction.caseBoundary.get();
    const singleLetters = _SnakeCaseAction.singleLetters.get();
    if (!caseBoundary || !singleLetters) {
      return text;
    }
    return text.replace(caseBoundary, "$1_$2").replace(singleLetters, "$1_$2$3").toLocaleLowerCase();
  }
};
_SnakeCaseAction.caseBoundary = new BackwardsCompatibleRegExp("(\\p{Ll})(\\p{Lu})", "gmu");
_SnakeCaseAction.singleLetters = new BackwardsCompatibleRegExp("(\\p{Lu}|\\p{N})(\\p{Lu})(\\p{Ll})", "gmu");
let SnakeCaseAction = _SnakeCaseAction;
const _CamelCaseAction = class _CamelCaseAction extends AbstractCaseAction {
  constructor() {
    super({
      id: "editor.action.transformToCamelcase",
      label: nls.localize2("editor.transformToCamelcase", "Transform to Camel Case"),
      precondition: EditorContextKeys.writable
    });
  }
  _modifyText(text, wordSeparators) {
    const wordBoundary = _CamelCaseAction.wordBoundary.get();
    if (!wordBoundary) {
      return text;
    }
    const words = text.split(wordBoundary);
    const firstWord = words.shift();
    return firstWord + words.map((word) => word.substring(0, 1).toLocaleUpperCase() + word.substring(1)).join("");
  }
};
_CamelCaseAction.wordBoundary = new BackwardsCompatibleRegExp("[_\\s-]", "gm");
let CamelCaseAction = _CamelCaseAction;
const _PascalCaseAction = class _PascalCaseAction extends AbstractCaseAction {
  constructor() {
    super({
      id: "editor.action.transformToPascalcase",
      label: nls.localize2("editor.transformToPascalcase", "Transform to Pascal Case"),
      precondition: EditorContextKeys.writable
    });
  }
  _modifyText(text, wordSeparators) {
    const wordBoundary = _PascalCaseAction.wordBoundary.get();
    const wordBoundaryToMaintain = _PascalCaseAction.wordBoundaryToMaintain.get();
    if (!wordBoundary || !wordBoundaryToMaintain) {
      return text;
    }
    const wordsWithMaintainBoundaries = text.split(wordBoundaryToMaintain);
    const words = wordsWithMaintainBoundaries.map((word) => word.split(wordBoundary)).flat();
    return words.map((word) => word.substring(0, 1).toLocaleUpperCase() + word.substring(1)).join("");
  }
};
_PascalCaseAction.wordBoundary = new BackwardsCompatibleRegExp("[_\\s-]", "gm");
_PascalCaseAction.wordBoundaryToMaintain = new BackwardsCompatibleRegExp("(?<=\\.)", "gm");
let PascalCaseAction = _PascalCaseAction;
const _KebabCaseAction = class _KebabCaseAction extends AbstractCaseAction {
  static isSupported() {
    const areAllRegexpsSupported = [
      this.caseBoundary,
      this.singleLetters,
      this.underscoreBoundary
    ].every((regexp) => regexp.isSupported());
    return areAllRegexpsSupported;
  }
  constructor() {
    super({
      id: "editor.action.transformToKebabcase",
      label: nls.localize2("editor.transformToKebabcase", "Transform to Kebab Case"),
      precondition: EditorContextKeys.writable
    });
  }
  _modifyText(text, _) {
    const caseBoundary = _KebabCaseAction.caseBoundary.get();
    const singleLetters = _KebabCaseAction.singleLetters.get();
    const underscoreBoundary = _KebabCaseAction.underscoreBoundary.get();
    if (!caseBoundary || !singleLetters || !underscoreBoundary) {
      return text;
    }
    return text.replace(underscoreBoundary, "$1-$3").replace(caseBoundary, "$1-$2").replace(singleLetters, "$1-$2").toLocaleLowerCase();
  }
};
_KebabCaseAction.caseBoundary = new BackwardsCompatibleRegExp("(\\p{Ll})(\\p{Lu})", "gmu");
_KebabCaseAction.singleLetters = new BackwardsCompatibleRegExp("(\\p{Lu}|\\p{N})(\\p{Lu}\\p{Ll})", "gmu");
_KebabCaseAction.underscoreBoundary = new BackwardsCompatibleRegExp("(\\S)(_)(\\S)", "gm");
let KebabCaseAction = _KebabCaseAction;
registerEditorAction(CopyLinesUpAction);
registerEditorAction(CopyLinesDownAction);
registerEditorAction(DuplicateSelectionAction);
registerEditorAction(MoveLinesUpAction);
registerEditorAction(MoveLinesDownAction);
registerEditorAction(SortLinesAscendingAction);
registerEditorAction(SortLinesDescendingAction);
registerEditorAction(DeleteDuplicateLinesAction);
registerEditorAction(TrimTrailingWhitespaceAction);
registerEditorAction(DeleteLinesAction);
registerEditorAction(IndentLinesAction);
registerEditorAction(OutdentLinesAction);
registerEditorAction(InsertLineBeforeAction);
registerEditorAction(InsertLineAfterAction);
registerEditorAction(DeleteAllLeftAction);
registerEditorAction(DeleteAllRightAction);
registerEditorAction(JoinLinesAction);
registerEditorAction(TransposeAction);
registerEditorAction(UpperCaseAction);
registerEditorAction(LowerCaseAction);
if (SnakeCaseAction.caseBoundary.isSupported() && SnakeCaseAction.singleLetters.isSupported()) {
  registerEditorAction(SnakeCaseAction);
}
if (CamelCaseAction.wordBoundary.isSupported()) {
  registerEditorAction(CamelCaseAction);
}
if (PascalCaseAction.wordBoundary.isSupported()) {
  registerEditorAction(PascalCaseAction);
}
if (TitleCaseAction.titleBoundary.isSupported()) {
  registerEditorAction(TitleCaseAction);
}
if (KebabCaseAction.isSupported()) {
  registerEditorAction(KebabCaseAction);
}
export {
  AbstractCaseAction,
  AbstractDeleteAllToBoundaryAction,
  AbstractSortLinesAction,
  CamelCaseAction,
  DeleteAllLeftAction,
  DeleteAllRightAction,
  DeleteDuplicateLinesAction,
  DeleteLinesAction,
  DuplicateSelectionAction,
  IndentLinesAction,
  InsertLineAfterAction,
  InsertLineBeforeAction,
  JoinLinesAction,
  KebabCaseAction,
  LowerCaseAction,
  PascalCaseAction,
  SnakeCaseAction,
  SortLinesAscendingAction,
  SortLinesDescendingAction,
  TitleCaseAction,
  TransposeAction,
  TrimTrailingWhitespaceAction,
  UpperCaseAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvYnJvd3Nlci9saW5lc09wZXJhdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBLZXlDaG9yZCwgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgQ29yZUVkaXRpbmdDb21tYW5kcyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvY29yZUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IElBY3RpdmVDb2RlRWRpdG9yLCBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIElBY3Rpb25PcHRpb25zLCByZWdpc3RlckVkaXRvckFjdGlvbiwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBSZXBsYWNlQ29tbWFuZCwgUmVwbGFjZUNvbW1hbmRUaGF0UHJlc2VydmVzU2VsZWN0aW9uLCBSZXBsYWNlQ29tbWFuZFRoYXRTZWxlY3RzVGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb21tYW5kcy9yZXBsYWNlQ29tbWFuZC5qcyc7XG5pbXBvcnQgeyBUcmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb21tYW5kcy90cmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgVHlwZU9wZXJhdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY3Vyc29yL2N1cnNvclR5cGVPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IEVudGVyT3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvci9jdXJzb3JUeXBlRWRpdE9wZXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdE9wZXJhdGlvbiwgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgQ29weUxpbmVzQ29tbWFuZCB9IGZyb20gJy4vY29weUxpbmVzQ29tbWFuZC5qcyc7XG5pbXBvcnQgeyBNb3ZlTGluZXNDb21tYW5kIH0gZnJvbSAnLi9tb3ZlTGluZXNDb21tYW5kLmpzJztcbmltcG9ydCB7IFNvcnRMaW5lc0NvbW1hbmQgfSBmcm9tICcuL3NvcnRMaW5lc0NvbW1hbmQuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcblxuLy8gY29weSBsaW5lc1xuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdENvcHlMaW5lc0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkb3duOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKGRvd246IGJvb2xlYW4sIG9wdHM6IElBY3Rpb25PcHRpb25zKSB7XG5cdFx0c3VwZXIob3B0cyk7XG5cdFx0dGhpcy5kb3duID0gZG93bjtcblx0fVxuXG5cdHB1YmxpYyBydW4oX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLm1hcCgoc2VsZWN0aW9uLCBpbmRleCkgPT4gKHsgc2VsZWN0aW9uLCBpbmRleCwgaWdub3JlOiBmYWxzZSB9KSk7XG5cdFx0c2VsZWN0aW9ucy5zb3J0KChhLCBiKSA9PiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5zZWxlY3Rpb24sIGIuc2VsZWN0aW9uKSk7XG5cblx0XHQvLyBSZW1vdmUgc2VsZWN0aW9ucyB0aGF0IHdvdWxkIHJlc3VsdCBpbiBjb3B5aW5nIHRoZSBzYW1lIGxpbmVcblx0XHRsZXQgcHJldiA9IHNlbGVjdGlvbnNbMF07XG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBzZWxlY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBjdXJyID0gc2VsZWN0aW9uc1tpXTtcblx0XHRcdGlmIChwcmV2LnNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyID09PSBjdXJyLnNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Ly8gdGhlc2UgdHdvIHNlbGVjdGlvbnMgd291bGQgY29weSB0aGUgc2FtZSBsaW5lXG5cdFx0XHRcdGlmIChwcmV2LmluZGV4IDwgY3Vyci5pbmRleCkge1xuXHRcdFx0XHRcdC8vIHByZXYgd2luc1xuXHRcdFx0XHRcdGN1cnIuaWdub3JlID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBjdXJyIHdpbnNcblx0XHRcdFx0XHRwcmV2Lmlnbm9yZSA9IHRydWU7XG5cdFx0XHRcdFx0cHJldiA9IGN1cnI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjb21tYW5kczogSUNvbW1hbmRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgc2VsZWN0aW9uIG9mIHNlbGVjdGlvbnMpIHtcblx0XHRcdGNvbW1hbmRzLnB1c2gobmV3IENvcHlMaW5lc0NvbW1hbmQoc2VsZWN0aW9uLnNlbGVjdGlvbiwgdGhpcy5kb3duLCBzZWxlY3Rpb24uaWdub3JlKSk7XG5cdFx0fVxuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgY29tbWFuZHMpO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0fVxufVxuXG5jbGFzcyBDb3B5TGluZXNVcEFjdGlvbiBleHRlbmRzIEFic3RyYWN0Q29weUxpbmVzQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoZmFsc2UsIHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5jb3B5TGluZXNVcEFjdGlvbicsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMuY29weVVwJywgXCJDb3B5IExpbmUgVXBcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5VcEFycm93LFxuXHRcdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlVwQXJyb3cgfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZW51T3B0czoge1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyU2VsZWN0aW9uTWVudSxcblx0XHRcdFx0Z3JvdXA6ICcyX2xpbmUnLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlDb3B5TGluZXNVcCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkNvcHkgTGluZSBVcFwiKSxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBDb3B5TGluZXNEb3duQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDb3B5TGluZXNBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih0cnVlLCB7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uY29weUxpbmVzRG93bkFjdGlvbicsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMuY29weURvd24nLCBcIkNvcHkgTGluZSBEb3duXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkRvd25BcnJvdyB9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1lbnVPcHRzOiB7XG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLk1lbnViYXJTZWxlY3Rpb25NZW51LFxuXHRcdFx0XHRncm91cDogJzJfbGluZScsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUNvcHlMaW5lc0Rvd24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiQ28mJnB5IExpbmUgRG93blwiKSxcblx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRHVwbGljYXRlU2VsZWN0aW9uQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uZHVwbGljYXRlU2VsZWN0aW9uJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdkdXBsaWNhdGVTZWxlY3Rpb24nLCBcIkR1cGxpY2F0ZSBTZWxlY3Rpb25cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0bWVudU9wdHM6IHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhclNlbGVjdGlvbk1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnMl9saW5lJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pRHVwbGljYXRlU2VsZWN0aW9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmRHVwbGljYXRlIFNlbGVjdGlvblwiKSxcblx0XHRcdFx0b3JkZXI6IDVcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb21tYW5kczogSUNvbW1hbmRbXSA9IFtdO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cblx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRpZiAoc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRjb21tYW5kcy5wdXNoKG5ldyBDb3B5TGluZXNDb21tYW5kKHNlbGVjdGlvbiwgdHJ1ZSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgaW5zZXJ0U2VsZWN0aW9uID0gbmV3IFNlbGVjdGlvbihzZWxlY3Rpb24uZW5kTGluZU51bWJlciwgc2VsZWN0aW9uLmVuZENvbHVtbiwgc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIsIHNlbGVjdGlvbi5lbmRDb2x1bW4pO1xuXHRcdFx0XHRjb21tYW5kcy5wdXNoKG5ldyBSZXBsYWNlQ29tbWFuZFRoYXRTZWxlY3RzVGV4dChpbnNlcnRTZWxlY3Rpb24sIG1vZGVsLmdldFZhbHVlSW5SYW5nZShzZWxlY3Rpb24pKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgY29tbWFuZHMpO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0fVxufVxuXG4vLyBtb3ZlIGxpbmVzXG5cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0TW92ZUxpbmVzQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRvd246IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IoZG93bjogYm9vbGVhbiwgb3B0czogSUFjdGlvbk9wdGlvbnMpIHtcblx0XHRzdXBlcihvcHRzKTtcblx0XHR0aGlzLmRvd24gPSBkb3duO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29tbWFuZHM6IElDb21tYW5kW10gPSBbXTtcblx0XHRjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKSB8fCBbXTtcblx0XHRjb25zdCBhdXRvSW5kZW50ID0gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uYXV0b0luZGVudCk7XG5cblx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRjb21tYW5kcy5wdXNoKG5ldyBNb3ZlTGluZXNDb21tYW5kKHNlbGVjdGlvbiwgdGhpcy5kb3duLCBhdXRvSW5kZW50LCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0fVxuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgY29tbWFuZHMpO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0fVxufVxuXG5jbGFzcyBNb3ZlTGluZXNVcEFjdGlvbiBleHRlbmRzIEFic3RyYWN0TW92ZUxpbmVzQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoZmFsc2UsIHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5tb3ZlTGluZXNVcEFjdGlvbicsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMubW92ZVVwJywgXCJNb3ZlIExpbmUgVXBcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5VcEFycm93LFxuXHRcdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5VcEFycm93IH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudU9wdHM6IHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhclNlbGVjdGlvbk1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnMl9saW5lJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pTW92ZUxpbmVzVXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiTW8mJnZlIExpbmUgVXBcIiksXG5cdFx0XHRcdG9yZGVyOiAzXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgTW92ZUxpbmVzRG93bkFjdGlvbiBleHRlbmRzIEFic3RyYWN0TW92ZUxpbmVzQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIodHJ1ZSwge1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLm1vdmVMaW5lc0Rvd25BY3Rpb24nLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xpbmVzLm1vdmVEb3duJywgXCJNb3ZlIExpbmUgRG93blwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuRG93bkFycm93IH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudU9wdHM6IHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhclNlbGVjdGlvbk1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnMl9saW5lJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pTW92ZUxpbmVzRG93bicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJNb3ZlICYmTGluZSBEb3duXCIpLFxuXHRcdFx0XHRvcmRlcjogNFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFNvcnRMaW5lc0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGVzY2VuZGluZzogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3RvcihkZXNjZW5kaW5nOiBib29sZWFuLCBvcHRzOiBJQWN0aW9uT3B0aW9ucykge1xuXHRcdHN1cGVyKG9wdHMpO1xuXHRcdHRoaXMuZGVzY2VuZGluZyA9IGRlc2NlbmRpbmc7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGxldCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRpZiAoc2VsZWN0aW9ucy5sZW5ndGggPT09IDEgJiYgc2VsZWN0aW9uc1swXS5pc0VtcHR5KCkpIHtcblx0XHRcdC8vIEFwcGx5IHRvIHdob2xlIGRvY3VtZW50LlxuXHRcdFx0c2VsZWN0aW9ucyA9IFtuZXcgU2VsZWN0aW9uKDEsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKG1vZGVsLmdldExpbmVDb3VudCgpKSldO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3Qgc2VsZWN0aW9uIG9mIHNlbGVjdGlvbnMpIHtcblx0XHRcdGlmICghU29ydExpbmVzQ29tbWFuZC5jYW5SdW4oZWRpdG9yLmdldE1vZGVsKCksIHNlbGVjdGlvbiwgdGhpcy5kZXNjZW5kaW5nKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tbWFuZHM6IElDb21tYW5kW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gc2VsZWN0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29tbWFuZHNbaV0gPSBuZXcgU29ydExpbmVzQ29tbWFuZChzZWxlY3Rpb25zW2ldLCB0aGlzLmRlc2NlbmRpbmcpO1xuXHRcdH1cblxuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRlZGl0b3IuZXhlY3V0ZUNvbW1hbmRzKHRoaXMuaWQsIGNvbW1hbmRzKTtcblx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNvcnRMaW5lc0FzY2VuZGluZ0FjdGlvbiBleHRlbmRzIEFic3RyYWN0U29ydExpbmVzQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoZmFsc2UsIHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5zb3J0TGluZXNBc2NlbmRpbmcnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xpbmVzLnNvcnRBc2NlbmRpbmcnLCBcIlNvcnQgTGluZXMgQXNjZW5kaW5nXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTb3J0TGluZXNEZXNjZW5kaW5nQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RTb3J0TGluZXNBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih0cnVlLCB7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uc29ydExpbmVzRGVzY2VuZGluZycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMuc29ydERlc2NlbmRpbmcnLCBcIlNvcnQgTGluZXMgRGVzY2VuZGluZ1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGVcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVsZXRlRHVwbGljYXRlTGluZXNBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24ucmVtb3ZlRHVwbGljYXRlTGluZXMnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xpbmVzLmRlbGV0ZUR1cGxpY2F0ZXMnLCBcIkRlbGV0ZSBEdXBsaWNhdGUgTGluZXNcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbDogSVRleHRNb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmIChtb2RlbC5nZXRMaW5lQ291bnQoKSA9PT0gMSAmJiBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKDEpID09PSAxKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10gPSBbXTtcblx0XHRjb25zdCBlbmRDdXJzb3JTdGF0ZTogU2VsZWN0aW9uW10gPSBbXTtcblxuXHRcdGxldCBsaW5lc0RlbGV0ZWQgPSAwO1xuXHRcdGxldCB1cGRhdGVTZWxlY3Rpb24gPSB0cnVlO1xuXG5cdFx0bGV0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGlmIChzZWxlY3Rpb25zLmxlbmd0aCA9PT0gMSAmJiBzZWxlY3Rpb25zWzBdLmlzRW1wdHkoKSkge1xuXHRcdFx0Ly8gQXBwbHkgdG8gd2hvbGUgZG9jdW1lbnQuXG5cdFx0XHRzZWxlY3Rpb25zID0gW25ldyBTZWxlY3Rpb24oMSwgMSwgbW9kZWwuZ2V0TGluZUNvdW50KCksIG1vZGVsLmdldExpbmVNYXhDb2x1bW4obW9kZWwuZ2V0TGluZUNvdW50KCkpKV07XG5cdFx0XHR1cGRhdGVTZWxlY3Rpb24gPSBmYWxzZTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRjb25zdCB1bmlxdWVMaW5lcyA9IG5ldyBTZXQoKTtcblx0XHRcdGNvbnN0IGxpbmVzID0gW107XG5cblx0XHRcdGZvciAobGV0IGkgPSBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyOyBpIDw9IHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbGluZSA9IG1vZGVsLmdldExpbmVDb250ZW50KGkpO1xuXG5cdFx0XHRcdGlmICh1bmlxdWVMaW5lcy5oYXMobGluZSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxpbmVzLnB1c2gobGluZSk7XG5cdFx0XHRcdHVuaXF1ZUxpbmVzLmFkZChsaW5lKTtcblx0XHRcdH1cblxuXG5cdFx0XHRjb25zdCBzZWxlY3Rpb25Ub1JlcGxhY2UgPSBuZXcgU2VsZWN0aW9uKFxuXHRcdFx0XHRzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHQxLFxuXHRcdFx0XHRzZWxlY3Rpb24uZW5kTGluZU51bWJlcixcblx0XHRcdFx0bW9kZWwuZ2V0TGluZU1heENvbHVtbihzZWxlY3Rpb24uZW5kTGluZU51bWJlcilcblx0XHRcdCk7XG5cblx0XHRcdGNvbnN0IGFkanVzdGVkU2VsZWN0aW9uU3RhcnQgPSBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyIC0gbGluZXNEZWxldGVkO1xuXHRcdFx0Y29uc3QgZmluYWxTZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uKFxuXHRcdFx0XHRhZGp1c3RlZFNlbGVjdGlvblN0YXJ0LFxuXHRcdFx0XHQxLFxuXHRcdFx0XHRhZGp1c3RlZFNlbGVjdGlvblN0YXJ0ICsgbGluZXMubGVuZ3RoIC0gMSxcblx0XHRcdFx0bGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoXG5cdFx0XHQpO1xuXG5cdFx0XHRlZGl0cy5wdXNoKEVkaXRPcGVyYXRpb24ucmVwbGFjZShzZWxlY3Rpb25Ub1JlcGxhY2UsIGxpbmVzLmpvaW4oJ1xcbicpKSk7XG5cdFx0XHRlbmRDdXJzb3JTdGF0ZS5wdXNoKGZpbmFsU2VsZWN0aW9uKTtcblxuXHRcdFx0bGluZXNEZWxldGVkICs9IChzZWxlY3Rpb24uZW5kTGluZU51bWJlciAtIHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgKyAxKSAtIGxpbmVzLmxlbmd0aDtcblx0XHR9XG5cblx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0ZWRpdG9yLmV4ZWN1dGVFZGl0cyh0aGlzLmlkLCBlZGl0cywgdXBkYXRlU2VsZWN0aW9uID8gZW5kQ3Vyc29yU3RhdGUgOiB1bmRlZmluZWQpO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVHJpbVRyYWlsaW5nV2hpdGVzcGFjZUFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuYWN0aW9uLnRyaW1UcmFpbGluZ1doaXRlc3BhY2UnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUcmltVHJhaWxpbmdXaGl0ZXNwYWNlQWN0aW9uLklELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xpbmVzLnRyaW1UcmFpbGluZ1doaXRlc3BhY2UnLCBcIlRyaW0gVHJhaWxpbmcgV2hpdGVzcGFjZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5WCksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogdm9pZCB7XG5cblx0XHRsZXQgY3Vyc29yczogUG9zaXRpb25bXSA9IFtdO1xuXHRcdGlmIChhcmdzLnJlYXNvbiA9PT0gJ2F1dG8tc2F2ZScpIHtcblx0XHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vZWRpdG9yY29uZmlnL2VkaXRvcmNvbmZpZy12c2NvZGUvaXNzdWVzLzQ3XG5cdFx0XHQvLyBJdCBpcyB2ZXJ5IGNvbnZlbmllbnQgZm9yIHRoZSBlZGl0b3IgY29uZmlnIGV4dGVuc2lvbiB0byBpbnZva2UgdGhpcyBhY3Rpb24uXG5cdFx0XHQvLyBTbywgaWYgd2UgZ2V0IGEgcmVhc29uOidhdXRvLXNhdmUnIHBhc3NlZCBpbiwgbGV0J3MgcHJlc2VydmUgY3Vyc29yIHBvc2l0aW9ucy5cblx0XHRcdGN1cnNvcnMgPSAoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSB8fCBbXSkubWFwKHMgPT4gbmV3IFBvc2l0aW9uKHMucG9zaXRpb25MaW5lTnVtYmVyLCBzLnBvc2l0aW9uQ29sdW1uKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdGlmIChzZWxlY3Rpb24gPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb25maWcgPSBfYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCB0cmltSW5SZWdleEFuZFN0cmluZ3MgPSBjb25maWcuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2ZpbGVzLnRyaW1UcmFpbGluZ1doaXRlc3BhY2VJblJlZ2V4QW5kU3RyaW5ncycsIHsgb3ZlcnJpZGVJZGVudGlmaWVyOiBtb2RlbD8uZ2V0TGFuZ3VhZ2VJZCgpLCByZXNvdXJjZTogbW9kZWw/LnVyaSB9KTtcblxuXHRcdGNvbnN0IGNvbW1hbmQgPSBuZXcgVHJpbVRyYWlsaW5nV2hpdGVzcGFjZUNvbW1hbmQoc2VsZWN0aW9uLCBjdXJzb3JzLCB0cmltSW5SZWdleEFuZFN0cmluZ3MpO1xuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgW2NvbW1hbmRdKTtcblx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdH1cbn1cblxuLy8gZGVsZXRlIGxpbmVzXG5cbmludGVyZmFjZSBJRGVsZXRlTGluZXNPcGVyYXRpb24ge1xuXHRzdGFydExpbmVOdW1iZXI6IG51bWJlcjtcblx0c2VsZWN0aW9uU3RhcnRDb2x1bW46IG51bWJlcjtcblx0ZW5kTGluZU51bWJlcjogbnVtYmVyO1xuXHRwb3NpdGlvbkNvbHVtbjogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRGVsZXRlTGluZXNBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5kZWxldGVMaW5lcycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMuZGVsZXRlJywgXCJEZWxldGUgTGluZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUssXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvcHMgPSB0aGlzLl9nZXRMaW5lc1RvUmVtb3ZlKGVkaXRvcik7XG5cblx0XHRjb25zdCBtb2RlbDogSVRleHRNb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmIChtb2RlbC5nZXRMaW5lQ291bnQoKSA9PT0gMSAmJiBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKDEpID09PSAxKSB7XG5cdFx0XHQvLyBNb2RlbCBpcyBlbXB0eVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBsaW5lc0RlbGV0ZWQgPSAwO1xuXHRcdGNvbnN0IGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0Y29uc3QgY3Vyc29yU3RhdGU6IFNlbGVjdGlvbltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IG9wcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgb3AgPSBvcHNbaV07XG5cblx0XHRcdGxldCBzdGFydExpbmVOdW1iZXIgPSBvcC5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRsZXQgZW5kTGluZU51bWJlciA9IG9wLmVuZExpbmVOdW1iZXI7XG5cblx0XHRcdGxldCBzdGFydENvbHVtbiA9IDE7XG5cdFx0XHRsZXQgZW5kQ29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihlbmRMaW5lTnVtYmVyKTtcblx0XHRcdGlmIChlbmRMaW5lTnVtYmVyIDwgbW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0ZW5kTGluZU51bWJlciArPSAxO1xuXHRcdFx0XHRlbmRDb2x1bW4gPSAxO1xuXHRcdFx0fSBlbHNlIGlmIChzdGFydExpbmVOdW1iZXIgPiAxKSB7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlciAtPSAxO1xuXHRcdFx0XHRzdGFydENvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4oc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdHMucHVzaChFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFNlbGVjdGlvbihzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pLCAnJykpO1xuXHRcdFx0Y3Vyc29yU3RhdGUucHVzaChuZXcgU2VsZWN0aW9uKHN0YXJ0TGluZU51bWJlciAtIGxpbmVzRGVsZXRlZCwgb3AucG9zaXRpb25Db2x1bW4sIHN0YXJ0TGluZU51bWJlciAtIGxpbmVzRGVsZXRlZCwgb3AucG9zaXRpb25Db2x1bW4pKTtcblx0XHRcdGxpbmVzRGVsZXRlZCArPSAob3AuZW5kTGluZU51bWJlciAtIG9wLnN0YXJ0TGluZU51bWJlciArIDEpO1xuXHRcdH1cblxuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKHRoaXMuaWQsIGVkaXRzLCBjdXJzb3JTdGF0ZSk7XG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TGluZXNUb1JlbW92ZShlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yKTogSURlbGV0ZUxpbmVzT3BlcmF0aW9uW10ge1xuXHRcdC8vIENvbnN0cnVjdCBkZWxldGUgb3BlcmF0aW9uc1xuXHRcdGNvbnN0IG9wZXJhdGlvbnM6IElEZWxldGVMaW5lc09wZXJhdGlvbltdID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKS5tYXAoKHMpID0+IHtcblxuXHRcdFx0bGV0IGVuZExpbmVOdW1iZXIgPSBzLmVuZExpbmVOdW1iZXI7XG5cdFx0XHRpZiAocy5zdGFydExpbmVOdW1iZXIgPCBzLmVuZExpbmVOdW1iZXIgJiYgcy5lbmRDb2x1bW4gPT09IDEpIHtcblx0XHRcdFx0ZW5kTGluZU51bWJlciAtPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHMuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRzZWxlY3Rpb25TdGFydENvbHVtbjogcy5zZWxlY3Rpb25TdGFydENvbHVtbixcblx0XHRcdFx0ZW5kTGluZU51bWJlcjogZW5kTGluZU51bWJlcixcblx0XHRcdFx0cG9zaXRpb25Db2x1bW46IHMucG9zaXRpb25Db2x1bW5cblx0XHRcdH07XG5cdFx0fSk7XG5cblx0XHQvLyBTb3J0IGRlbGV0ZSBvcGVyYXRpb25zXG5cdFx0b3BlcmF0aW9ucy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoYS5zdGFydExpbmVOdW1iZXIgPT09IGIuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHJldHVybiBhLmVuZExpbmVOdW1iZXIgLSBiLmVuZExpbmVOdW1iZXI7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYS5zdGFydExpbmVOdW1iZXIgLSBiLnN0YXJ0TGluZU51bWJlcjtcblx0XHR9KTtcblxuXHRcdC8vIE1lcmdlIGRlbGV0ZSBvcGVyYXRpb25zIHdoaWNoIGFyZSBhZGphY2VudCBvciBvdmVybGFwcGluZ1xuXHRcdGNvbnN0IG1lcmdlZE9wZXJhdGlvbnM6IElEZWxldGVMaW5lc09wZXJhdGlvbltdID0gW107XG5cdFx0bGV0IHByZXZpb3VzT3BlcmF0aW9uID0gb3BlcmF0aW9uc1swXTtcblx0XHRmb3IgKGxldCBpID0gMTsgaSA8IG9wZXJhdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChwcmV2aW91c09wZXJhdGlvbi5lbmRMaW5lTnVtYmVyICsgMSA+PSBvcGVyYXRpb25zW2ldLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHQvLyBNZXJnZSBjdXJyZW50IG9wZXJhdGlvbnMgaW50byB0aGUgcHJldmlvdXMgb25lXG5cdFx0XHRcdHByZXZpb3VzT3BlcmF0aW9uLmVuZExpbmVOdW1iZXIgPSBvcGVyYXRpb25zW2ldLmVuZExpbmVOdW1iZXI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBQdXNoIHByZXZpb3VzIG9wZXJhdGlvblxuXHRcdFx0XHRtZXJnZWRPcGVyYXRpb25zLnB1c2gocHJldmlvdXNPcGVyYXRpb24pO1xuXHRcdFx0XHRwcmV2aW91c09wZXJhdGlvbiA9IG9wZXJhdGlvbnNbaV07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIFB1c2ggdGhlIGxhc3Qgb3BlcmF0aW9uXG5cdFx0bWVyZ2VkT3BlcmF0aW9ucy5wdXNoKHByZXZpb3VzT3BlcmF0aW9uKTtcblxuXHRcdHJldHVybiBtZXJnZWRPcGVyYXRpb25zO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRlbnRMaW5lc0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5pbmRlbnRMaW5lcycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMuaW5kZW50JywgXCJJbmRlbnQgTGluZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CcmFja2V0UmlnaHQsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCk7XG5cdFx0aWYgKCF2aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgVHlwZU9wZXJhdGlvbnMuaW5kZW50KHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIGVkaXRvci5nZXRNb2RlbCgpLCBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpKSk7XG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHR9XG59XG5cbmNsYXNzIE91dGRlbnRMaW5lc0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5vdXRkZW50TGluZXMnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xpbmVzLm91dGRlbnQnLCBcIk91dGRlbnQgTGluZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CcmFja2V0TGVmdCxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5PdXRkZW50LnJ1bkVkaXRvckNvbW1hbmQoX2FjY2Vzc29yLCBlZGl0b3IsIG51bGwpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnNlcnRMaW5lQmVmb3JlQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmluc2VydExpbmVCZWZvcmUnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xpbmVzLmluc2VydEJlZm9yZScsIFwiSW5zZXJ0IExpbmUgQWJvdmVcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCk7XG5cdFx0aWYgKCF2aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgRW50ZXJPcGVyYXRpb24ubGluZUluc2VydEJlZm9yZSh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCBlZGl0b3IuZ2V0TW9kZWwoKSwgZWRpdG9yLmdldFNlbGVjdGlvbnMoKSkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnNlcnRMaW5lQWZ0ZXJBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5zZXJ0TGluZUFmdGVyJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdsaW5lcy5pbnNlcnRBZnRlcicsIFwiSW5zZXJ0IExpbmUgQmVsb3dcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCk7XG5cdFx0aWYgKCF2aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgRW50ZXJPcGVyYXRpb24ubGluZUluc2VydEFmdGVyKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIGVkaXRvci5nZXRNb2RlbCgpLCBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpKSk7XG5cdH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RGVsZXRlQWxsVG9Cb3VuZGFyeUFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdHB1YmxpYyBydW4oX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBwcmltYXJ5Q3Vyc29yID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXG5cdFx0Y29uc3QgcmFuZ2VzVG9EZWxldGUgPSB0aGlzLl9nZXRSYW5nZXNUb0RlbGV0ZShlZGl0b3IpO1xuXHRcdC8vIG1lcmdlIG92ZXJsYXBwaW5nIHNlbGVjdGlvbnNcblx0XHRjb25zdCBlZmZlY3RpdmVSYW5nZXM6IFJhbmdlW10gPSBbXTtcblxuXHRcdGZvciAobGV0IGkgPSAwLCBjb3VudCA9IHJhbmdlc1RvRGVsZXRlLmxlbmd0aCAtIDE7IGkgPCBjb3VudDsgaSsrKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IHJhbmdlc1RvRGVsZXRlW2ldO1xuXHRcdFx0Y29uc3QgbmV4dFJhbmdlID0gcmFuZ2VzVG9EZWxldGVbaSArIDFdO1xuXG5cdFx0XHRpZiAoUmFuZ2UuaW50ZXJzZWN0UmFuZ2VzKHJhbmdlLCBuZXh0UmFuZ2UpID09PSBudWxsKSB7XG5cdFx0XHRcdGVmZmVjdGl2ZVJhbmdlcy5wdXNoKHJhbmdlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJhbmdlc1RvRGVsZXRlW2kgKyAxXSA9IFJhbmdlLnBsdXNSYW5nZShyYW5nZSwgbmV4dFJhbmdlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRlZmZlY3RpdmVSYW5nZXMucHVzaChyYW5nZXNUb0RlbGV0ZVtyYW5nZXNUb0RlbGV0ZS5sZW5ndGggLSAxXSk7XG5cblx0XHRjb25zdCBlbmRDdXJzb3JTdGF0ZSA9IHRoaXMuX2dldEVuZEN1cnNvclN0YXRlKHByaW1hcnlDdXJzb3IsIGVmZmVjdGl2ZVJhbmdlcyk7XG5cblx0XHRjb25zdCBlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IGVmZmVjdGl2ZVJhbmdlcy5tYXAocmFuZ2UgPT4ge1xuXHRcdFx0cmV0dXJuIEVkaXRPcGVyYXRpb24ucmVwbGFjZShyYW5nZSwgJycpO1xuXHRcdH0pO1xuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlRWRpdHModGhpcy5pZCwgZWRpdHMsIGVuZEN1cnNvclN0YXRlKTtcblx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29tcHV0ZSB0aGUgY3Vyc29yIHN0YXRlIGFmdGVyIHRoZSBlZGl0IG9wZXJhdGlvbnMgd2VyZSBhcHBsaWVkLlxuXHQgKi9cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9nZXRFbmRDdXJzb3JTdGF0ZShwcmltYXJ5Q3Vyc29yOiBSYW5nZSwgcmFuZ2VzVG9EZWxldGU6IFJhbmdlW10pOiBTZWxlY3Rpb25bXTtcblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2dldFJhbmdlc1RvRGVsZXRlKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBSYW5nZVtdO1xufVxuXG5leHBvcnQgY2xhc3MgRGVsZXRlQWxsTGVmdEFjdGlvbiBleHRlbmRzIEFic3RyYWN0RGVsZXRlQWxsVG9Cb3VuZGFyeUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZGVsZXRlQWxsTGVmdCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMuZGVsZXRlQWxsTGVmdCcsIFwiRGVsZXRlIEFsbCBMZWZ0XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkJhY2tzcGFjZSB9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRFbmRDdXJzb3JTdGF0ZShwcmltYXJ5Q3Vyc29yOiBSYW5nZSwgcmFuZ2VzVG9EZWxldGU6IFJhbmdlW10pOiBTZWxlY3Rpb25bXSB7XG5cdFx0bGV0IGVuZFByaW1hcnlDdXJzb3I6IFNlbGVjdGlvbiB8IG51bGwgPSBudWxsO1xuXHRcdGNvbnN0IGVuZEN1cnNvclN0YXRlOiBTZWxlY3Rpb25bXSA9IFtdO1xuXHRcdGxldCBkZWxldGVkTGluZXMgPSAwO1xuXG5cdFx0cmFuZ2VzVG9EZWxldGUuZm9yRWFjaChyYW5nZSA9PiB7XG5cdFx0XHRsZXQgZW5kQ3Vyc29yO1xuXHRcdFx0aWYgKHJhbmdlLmVuZENvbHVtbiA9PT0gMSAmJiBkZWxldGVkTGluZXMgPiAwKSB7XG5cdFx0XHRcdGNvbnN0IG5ld1N0YXJ0TGluZSA9IHJhbmdlLnN0YXJ0TGluZU51bWJlciAtIGRlbGV0ZWRMaW5lcztcblx0XHRcdFx0ZW5kQ3Vyc29yID0gbmV3IFNlbGVjdGlvbihuZXdTdGFydExpbmUsIHJhbmdlLnN0YXJ0Q29sdW1uLCBuZXdTdGFydExpbmUsIHJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVuZEN1cnNvciA9IG5ldyBTZWxlY3Rpb24ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbiwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbik7XG5cdFx0XHR9XG5cblx0XHRcdGRlbGV0ZWRMaW5lcyArPSByYW5nZS5lbmRMaW5lTnVtYmVyIC0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXG5cdFx0XHRpZiAocmFuZ2UuaW50ZXJzZWN0UmFuZ2VzKHByaW1hcnlDdXJzb3IpKSB7XG5cdFx0XHRcdGVuZFByaW1hcnlDdXJzb3IgPSBlbmRDdXJzb3I7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlbmRDdXJzb3JTdGF0ZS5wdXNoKGVuZEN1cnNvcik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoZW5kUHJpbWFyeUN1cnNvcikge1xuXHRcdFx0ZW5kQ3Vyc29yU3RhdGUudW5zaGlmdChlbmRQcmltYXJ5Q3Vyc29yKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZW5kQ3Vyc29yU3RhdGU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFJhbmdlc1RvRGVsZXRlKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBSYW5nZVtdIHtcblx0XHRjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRpZiAoc2VsZWN0aW9ucyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGxldCByYW5nZXNUb0RlbGV0ZTogUmFuZ2VbXSA9IHNlbGVjdGlvbnM7XG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdGlmIChtb2RlbCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdHJhbmdlc1RvRGVsZXRlLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblx0XHRyYW5nZXNUb0RlbGV0ZSA9IHJhbmdlc1RvRGVsZXRlLm1hcChzZWxlY3Rpb24gPT4ge1xuXHRcdFx0aWYgKHNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0aWYgKHNlbGVjdGlvbi5zdGFydENvbHVtbiA9PT0gMSkge1xuXHRcdFx0XHRcdGNvbnN0IGRlbGV0ZUZyb21MaW5lID0gTWF0aC5tYXgoMSwgc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciAtIDEpO1xuXHRcdFx0XHRcdGNvbnN0IGRlbGV0ZUZyb21Db2x1bW4gPSBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyID09PSAxID8gMSA6IG1vZGVsLmdldExpbmVMZW5ndGgoZGVsZXRlRnJvbUxpbmUpICsgMTtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFJhbmdlKGRlbGV0ZUZyb21MaW5lLCBkZWxldGVGcm9tQ29sdW1uLCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCAxKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFJhbmdlKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsIDEsIHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsIHNlbGVjdGlvbi5zdGFydENvbHVtbik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBuZXcgUmFuZ2Uoc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgMSwgc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIsIHNlbGVjdGlvbi5lbmRDb2x1bW4pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJhbmdlc1RvRGVsZXRlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVBbGxSaWdodEFjdGlvbiBleHRlbmRzIEFic3RyYWN0RGVsZXRlQWxsVG9Cb3VuZGFyeUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZGVsZXRlQWxsUmlnaHQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xpbmVzLmRlbGV0ZUFsbFJpZ2h0JywgXCJEZWxldGUgQWxsIFJpZ2h0XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleUssIHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5EZWxldGVdIH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldEVuZEN1cnNvclN0YXRlKHByaW1hcnlDdXJzb3I6IFJhbmdlLCByYW5nZXNUb0RlbGV0ZTogUmFuZ2VbXSk6IFNlbGVjdGlvbltdIHtcblx0XHRsZXQgZW5kUHJpbWFyeUN1cnNvcjogU2VsZWN0aW9uIHwgbnVsbCA9IG51bGw7XG5cdFx0Y29uc3QgZW5kQ3Vyc29yU3RhdGU6IFNlbGVjdGlvbltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJhbmdlc1RvRGVsZXRlLmxlbmd0aCwgb2Zmc2V0ID0gMDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IHJhbmdlc1RvRGVsZXRlW2ldO1xuXHRcdFx0Y29uc3QgZW5kQ3Vyc29yID0gbmV3IFNlbGVjdGlvbihyYW5nZS5zdGFydExpbmVOdW1iZXIgLSBvZmZzZXQsIHJhbmdlLnN0YXJ0Q29sdW1uLCByYW5nZS5zdGFydExpbmVOdW1iZXIgLSBvZmZzZXQsIHJhbmdlLnN0YXJ0Q29sdW1uKTtcblxuXHRcdFx0aWYgKHJhbmdlLmludGVyc2VjdFJhbmdlcyhwcmltYXJ5Q3Vyc29yKSkge1xuXHRcdFx0XHRlbmRQcmltYXJ5Q3Vyc29yID0gZW5kQ3Vyc29yO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW5kQ3Vyc29yU3RhdGUucHVzaChlbmRDdXJzb3IpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlbmRQcmltYXJ5Q3Vyc29yKSB7XG5cdFx0XHRlbmRDdXJzb3JTdGF0ZS51bnNoaWZ0KGVuZFByaW1hcnlDdXJzb3IpO1xuXHRcdH1cblxuXHRcdHJldHVybiBlbmRDdXJzb3JTdGF0ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0UmFuZ2VzVG9EZWxldGUoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcik6IFJhbmdlW10ge1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cblx0XHRpZiAoc2VsZWN0aW9ucyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhbmdlc1RvRGVsZXRlOiBSYW5nZVtdID0gc2VsZWN0aW9ucy5tYXAoKHNlbCkgPT4ge1xuXHRcdFx0aWYgKHNlbC5pc0VtcHR5KCkpIHtcblx0XHRcdFx0Y29uc3QgbWF4Q29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihzZWwuc3RhcnRMaW5lTnVtYmVyKTtcblxuXHRcdFx0XHRpZiAoc2VsLnN0YXJ0Q29sdW1uID09PSBtYXhDb2x1bW4pIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFJhbmdlKHNlbC5zdGFydExpbmVOdW1iZXIsIHNlbC5zdGFydENvbHVtbiwgc2VsLnN0YXJ0TGluZU51bWJlciArIDEsIDEpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgUmFuZ2Uoc2VsLnN0YXJ0TGluZU51bWJlciwgc2VsLnN0YXJ0Q29sdW1uLCBzZWwuc3RhcnRMaW5lTnVtYmVyLCBtYXhDb2x1bW4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc2VsO1xuXHRcdH0pO1xuXG5cdFx0cmFuZ2VzVG9EZWxldGUuc29ydChSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMpO1xuXHRcdHJldHVybiByYW5nZXNUb0RlbGV0ZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSm9pbkxpbmVzQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmpvaW5MaW5lcycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbGluZXMuam9pbkxpbmVzJywgXCJKb2luIExpbmVzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlKIH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGlmIChzZWxlY3Rpb25zID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHByaW1hcnlDdXJzb3IgPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0aWYgKHByaW1hcnlDdXJzb3IgPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZWxlY3Rpb25zLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblx0XHRjb25zdCByZWR1Y2VkU2VsZWN0aW9uczogU2VsZWN0aW9uW10gPSBbXTtcblxuXHRcdGNvbnN0IGxhc3RTZWxlY3Rpb24gPSBzZWxlY3Rpb25zLnJlZHVjZSgocHJldmlvdXNWYWx1ZSwgY3VycmVudFZhbHVlKSA9PiB7XG5cdFx0XHRpZiAocHJldmlvdXNWYWx1ZS5pc0VtcHR5KCkpIHtcblx0XHRcdFx0aWYgKHByZXZpb3VzVmFsdWUuZW5kTGluZU51bWJlciA9PT0gY3VycmVudFZhbHVlLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdGlmIChwcmltYXJ5Q3Vyc29yIS5lcXVhbHNTZWxlY3Rpb24ocHJldmlvdXNWYWx1ZSkpIHtcblx0XHRcdFx0XHRcdHByaW1hcnlDdXJzb3IgPSBjdXJyZW50VmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBjdXJyZW50VmFsdWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlLnN0YXJ0TGluZU51bWJlciA+IHByZXZpb3VzVmFsdWUuZW5kTGluZU51bWJlciArIDEpIHtcblx0XHRcdFx0XHRyZWR1Y2VkU2VsZWN0aW9ucy5wdXNoKHByZXZpb3VzVmFsdWUpO1xuXHRcdFx0XHRcdHJldHVybiBjdXJyZW50VmFsdWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24ocHJldmlvdXNWYWx1ZS5zdGFydExpbmVOdW1iZXIsIHByZXZpb3VzVmFsdWUuc3RhcnRDb2x1bW4sIGN1cnJlbnRWYWx1ZS5lbmRMaW5lTnVtYmVyLCBjdXJyZW50VmFsdWUuZW5kQ29sdW1uKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZS5zdGFydExpbmVOdW1iZXIgPiBwcmV2aW91c1ZhbHVlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRyZWR1Y2VkU2VsZWN0aW9ucy5wdXNoKHByZXZpb3VzVmFsdWUpO1xuXHRcdFx0XHRcdHJldHVybiBjdXJyZW50VmFsdWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24ocHJldmlvdXNWYWx1ZS5zdGFydExpbmVOdW1iZXIsIHByZXZpb3VzVmFsdWUuc3RhcnRDb2x1bW4sIGN1cnJlbnRWYWx1ZS5lbmRMaW5lTnVtYmVyLCBjdXJyZW50VmFsdWUuZW5kQ29sdW1uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmVkdWNlZFNlbGVjdGlvbnMucHVzaChsYXN0U2VsZWN0aW9uKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10gPSBbXTtcblx0XHRjb25zdCBlbmRDdXJzb3JTdGF0ZTogU2VsZWN0aW9uW10gPSBbXTtcblx0XHRsZXQgZW5kUHJpbWFyeUN1cnNvciA9IHByaW1hcnlDdXJzb3I7XG5cdFx0bGV0IGxpbmVPZmZzZXQgPSAwO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJlZHVjZWRTZWxlY3Rpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSByZWR1Y2VkU2VsZWN0aW9uc1tpXTtcblx0XHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IDE7XG5cdFx0XHRsZXQgY29sdW1uRGVsdGFPZmZzZXQgPSAwO1xuXHRcdFx0bGV0IGVuZExpbmVOdW1iZXI6IG51bWJlcixcblx0XHRcdFx0ZW5kQ29sdW1uOiBudW1iZXI7XG5cblx0XHRcdGNvbnN0IHNlbGVjdGlvbkVuZFBvc2l0aW9uT2Zmc2V0ID0gbW9kZWwuZ2V0TGluZUxlbmd0aChzZWxlY3Rpb24uZW5kTGluZU51bWJlcikgLSBzZWxlY3Rpb24uZW5kQ29sdW1uO1xuXG5cdFx0XHRpZiAoc2VsZWN0aW9uLmlzRW1wdHkoKSB8fCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyID09PSBzZWxlY3Rpb24uZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IHNlbGVjdGlvbi5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0XHRcdGlmIChwb3NpdGlvbi5saW5lTnVtYmVyIDwgbW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyICsgMTtcblx0XHRcdFx0XHRlbmRDb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGVuZExpbmVOdW1iZXIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVuZExpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0XHRcdGVuZENvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4ocG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVuZExpbmVOdW1iZXIgPSBzZWxlY3Rpb24uZW5kTGluZU51bWJlcjtcblx0XHRcdFx0ZW5kQ29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihlbmRMaW5lTnVtYmVyKTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IHRyaW1tZWRMaW5lc0NvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChzdGFydExpbmVOdW1iZXIpO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gc3RhcnRMaW5lTnVtYmVyICsgMTsgaSA8PSBlbmRMaW5lTnVtYmVyOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbGluZVRleHQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChpKTtcblx0XHRcdFx0Y29uc3QgZmlyc3ROb25XaGl0ZXNwYWNlSWR4ID0gbW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihpKTtcblxuXHRcdFx0XHRpZiAoZmlyc3ROb25XaGl0ZXNwYWNlSWR4ID49IDEpIHtcblx0XHRcdFx0XHRsZXQgaW5zZXJ0U3BhY2UgPSB0cnVlO1xuXHRcdFx0XHRcdGlmICh0cmltbWVkTGluZXNDb250ZW50ID09PSAnJykge1xuXHRcdFx0XHRcdFx0aW5zZXJ0U3BhY2UgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoaW5zZXJ0U3BhY2UgJiYgKHRyaW1tZWRMaW5lc0NvbnRlbnQuY2hhckF0KHRyaW1tZWRMaW5lc0NvbnRlbnQubGVuZ3RoIC0gMSkgPT09ICcgJyB8fFxuXHRcdFx0XHRcdFx0dHJpbW1lZExpbmVzQ29udGVudC5jaGFyQXQodHJpbW1lZExpbmVzQ29udGVudC5sZW5ndGggLSAxKSA9PT0gJ1xcdCcpKSB7XG5cdFx0XHRcdFx0XHRpbnNlcnRTcGFjZSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0dHJpbW1lZExpbmVzQ29udGVudCA9IHRyaW1tZWRMaW5lc0NvbnRlbnQucmVwbGFjZSgvW1xcc1xcdUZFRkZcXHhBMF0rJC9nLCAnICcpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGxpbmVUZXh0V2l0aG91dEluZGVudCA9IGxpbmVUZXh0LnN1YnN0cihmaXJzdE5vbldoaXRlc3BhY2VJZHggLSAxKTtcblxuXHRcdFx0XHRcdHRyaW1tZWRMaW5lc0NvbnRlbnQgKz0gKGluc2VydFNwYWNlID8gJyAnIDogJycpICsgbGluZVRleHRXaXRob3V0SW5kZW50O1xuXG5cdFx0XHRcdFx0aWYgKGluc2VydFNwYWNlKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5EZWx0YU9mZnNldCA9IGxpbmVUZXh0V2l0aG91dEluZGVudC5sZW5ndGggKyAxO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5EZWx0YU9mZnNldCA9IGxpbmVUZXh0V2l0aG91dEluZGVudC5sZW5ndGg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbHVtbkRlbHRhT2Zmc2V0ID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZWxldGVTZWxlY3Rpb24gPSBuZXcgUmFuZ2Uoc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgZW5kTGluZU51bWJlciwgZW5kQ29sdW1uKTtcblxuXHRcdFx0aWYgKCFkZWxldGVTZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdGxldCByZXN1bHRTZWxlY3Rpb246IFNlbGVjdGlvbjtcblxuXHRcdFx0XHRpZiAoc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRcdGVkaXRzLnB1c2goRWRpdE9wZXJhdGlvbi5yZXBsYWNlKGRlbGV0ZVNlbGVjdGlvbiwgdHJpbW1lZExpbmVzQ29udGVudCkpO1xuXHRcdFx0XHRcdHJlc3VsdFNlbGVjdGlvbiA9IG5ldyBTZWxlY3Rpb24oZGVsZXRlU2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciAtIGxpbmVPZmZzZXQsIHRyaW1tZWRMaW5lc0NvbnRlbnQubGVuZ3RoIC0gY29sdW1uRGVsdGFPZmZzZXQgKyAxLCBzdGFydExpbmVOdW1iZXIgLSBsaW5lT2Zmc2V0LCB0cmltbWVkTGluZXNDb250ZW50Lmxlbmd0aCAtIGNvbHVtbkRlbHRhT2Zmc2V0ICsgMSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgPT09IHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRlZGl0cy5wdXNoKEVkaXRPcGVyYXRpb24ucmVwbGFjZShkZWxldGVTZWxlY3Rpb24sIHRyaW1tZWRMaW5lc0NvbnRlbnQpKTtcblx0XHRcdFx0XHRcdHJlc3VsdFNlbGVjdGlvbiA9IG5ldyBTZWxlY3Rpb24oc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciAtIGxpbmVPZmZzZXQsIHNlbGVjdGlvbi5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdFx0c2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgLSBsaW5lT2Zmc2V0LCBzZWxlY3Rpb24uZW5kQ29sdW1uKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZWRpdHMucHVzaChFZGl0T3BlcmF0aW9uLnJlcGxhY2UoZGVsZXRlU2VsZWN0aW9uLCB0cmltbWVkTGluZXNDb250ZW50KSk7XG5cdFx0XHRcdFx0XHRyZXN1bHRTZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgLSBsaW5lT2Zmc2V0LCBzZWxlY3Rpb24uc3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0XHRcdHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgLSBsaW5lT2Zmc2V0LCB0cmltbWVkTGluZXNDb250ZW50Lmxlbmd0aCAtIHNlbGVjdGlvbkVuZFBvc2l0aW9uT2Zmc2V0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoUmFuZ2UuaW50ZXJzZWN0UmFuZ2VzKGRlbGV0ZVNlbGVjdGlvbiwgcHJpbWFyeUN1cnNvcikgIT09IG51bGwpIHtcblx0XHRcdFx0XHRlbmRQcmltYXJ5Q3Vyc29yID0gcmVzdWx0U2VsZWN0aW9uO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVuZEN1cnNvclN0YXRlLnB1c2gocmVzdWx0U2VsZWN0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRsaW5lT2Zmc2V0ICs9IGRlbGV0ZVNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyIC0gZGVsZXRlU2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcjtcblx0XHR9XG5cblx0XHRlbmRDdXJzb3JTdGF0ZS51bnNoaWZ0KGVuZFByaW1hcnlDdXJzb3IpO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKHRoaXMuaWQsIGVkaXRzLCBlbmRDdXJzb3JTdGF0ZSk7XG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc3Bvc2VBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24udHJhbnNwb3NlJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdlZGl0b3IudHJhbnNwb3NlJywgXCJUcmFuc3Bvc2UgQ2hhcmFjdGVycyBhcm91bmQgdGhlIEN1cnNvclwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGVcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0aWYgKHNlbGVjdGlvbnMgPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmIChtb2RlbCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbW1hbmRzOiBJQ29tbWFuZFtdID0gW107XG5cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gc2VsZWN0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gc2VsZWN0aW9uc1tpXTtcblxuXHRcdFx0aWYgKCFzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJzb3IgPSBzZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0Y29uc3QgbWF4Q29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihjdXJzb3IubGluZU51bWJlcik7XG5cblx0XHRcdGlmIChjdXJzb3IuY29sdW1uID49IG1heENvbHVtbikge1xuXHRcdFx0XHRpZiAoY3Vyc29yLmxpbmVOdW1iZXIgPT09IG1vZGVsLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBUaGUgY3Vyc29yIGlzIGF0IHRoZSBlbmQgb2YgY3VycmVudCBsaW5lIGFuZCBjdXJyZW50IGxpbmUgaXMgbm90IGVtcHR5XG5cdFx0XHRcdC8vIHRoZW4gd2UgdHJhbnNwb3NlIHRoZSBjaGFyYWN0ZXIgYmVmb3JlIHRoZSBjdXJzb3IgYW5kIHRoZSBsaW5lIGJyZWFrIGlmIHRoZXJlIGlzIGFueSBmb2xsb3dpbmcgbGluZS5cblx0XHRcdFx0Y29uc3QgZGVsZXRlU2VsZWN0aW9uID0gbmV3IFJhbmdlKGN1cnNvci5saW5lTnVtYmVyLCBNYXRoLm1heCgxLCBjdXJzb3IuY29sdW1uIC0gMSksIGN1cnNvci5saW5lTnVtYmVyICsgMSwgMSk7XG5cdFx0XHRcdGNvbnN0IGNoYXJzID0gbW9kZWwuZ2V0VmFsdWVJblJhbmdlKGRlbGV0ZVNlbGVjdGlvbikuc3BsaXQoJycpLnJldmVyc2UoKS5qb2luKCcnKTtcblxuXHRcdFx0XHRjb21tYW5kcy5wdXNoKG5ldyBSZXBsYWNlQ29tbWFuZChuZXcgU2VsZWN0aW9uKGN1cnNvci5saW5lTnVtYmVyLCBNYXRoLm1heCgxLCBjdXJzb3IuY29sdW1uIC0gMSksIGN1cnNvci5saW5lTnVtYmVyICsgMSwgMSksIGNoYXJzKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBkZWxldGVTZWxlY3Rpb24gPSBuZXcgUmFuZ2UoY3Vyc29yLmxpbmVOdW1iZXIsIE1hdGgubWF4KDEsIGN1cnNvci5jb2x1bW4gLSAxKSwgY3Vyc29yLmxpbmVOdW1iZXIsIGN1cnNvci5jb2x1bW4gKyAxKTtcblx0XHRcdFx0Y29uc3QgY2hhcnMgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoZGVsZXRlU2VsZWN0aW9uKS5zcGxpdCgnJykucmV2ZXJzZSgpLmpvaW4oJycpO1xuXHRcdFx0XHRjb21tYW5kcy5wdXNoKG5ldyBSZXBsYWNlQ29tbWFuZFRoYXRQcmVzZXJ2ZXNTZWxlY3Rpb24oZGVsZXRlU2VsZWN0aW9uLCBjaGFycyxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKGN1cnNvci5saW5lTnVtYmVyLCBjdXJzb3IuY29sdW1uICsgMSwgY3Vyc29yLmxpbmVOdW1iZXIsIGN1cnNvci5jb2x1bW4gKyAxKSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRlZGl0b3IuZXhlY3V0ZUNvbW1hbmRzKHRoaXMuaWQsIGNvbW1hbmRzKTtcblx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0Q2FzZUFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdHB1YmxpYyBydW4oX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0aWYgKHNlbGVjdGlvbnMgPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmIChtb2RlbCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdvcmRTZXBhcmF0b3JzID0gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ud29yZFNlcGFyYXRvcnMpO1xuXHRcdGNvbnN0IHRleHRFZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2Ygc2VsZWN0aW9ucykge1xuXHRcdFx0aWYgKHNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0Y29uc3QgY3Vyc29yID0gc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdFx0Y29uc3Qgd29yZCA9IGVkaXRvci5nZXRDb25maWd1cmVkV29yZEF0UG9zaXRpb24oY3Vyc29yKTtcblxuXHRcdFx0XHRpZiAoIXdvcmQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHdvcmRSYW5nZSA9IG5ldyBSYW5nZShjdXJzb3IubGluZU51bWJlciwgd29yZC5zdGFydENvbHVtbiwgY3Vyc29yLmxpbmVOdW1iZXIsIHdvcmQuZW5kQ29sdW1uKTtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZSh3b3JkUmFuZ2UpO1xuXHRcdFx0XHR0ZXh0RWRpdHMucHVzaChFZGl0T3BlcmF0aW9uLnJlcGxhY2Uod29yZFJhbmdlLCB0aGlzLl9tb2RpZnlUZXh0KHRleHQsIHdvcmRTZXBhcmF0b3JzKSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShzZWxlY3Rpb24pO1xuXHRcdFx0XHR0ZXh0RWRpdHMucHVzaChFZGl0T3BlcmF0aW9uLnJlcGxhY2Uoc2VsZWN0aW9uLCB0aGlzLl9tb2RpZnlUZXh0KHRleHQsIHdvcmRTZXBhcmF0b3JzKSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKHRoaXMuaWQsIHRleHRFZGl0cyk7XG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9tb2RpZnlUZXh0KHRleHQ6IHN0cmluZywgd29yZFNlcGFyYXRvcnM6IHN0cmluZyk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFVwcGVyQ2FzZUFjdGlvbiBleHRlbmRzIEFic3RyYWN0Q2FzZUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi50cmFuc2Zvcm1Ub1VwcGVyY2FzZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZWRpdG9yLnRyYW5zZm9ybVRvVXBwZXJjYXNlJywgXCJUcmFuc2Zvcm0gdG8gVXBwZXJjYXNlXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9tb2RpZnlUZXh0KHRleHQ6IHN0cmluZywgd29yZFNlcGFyYXRvcnM6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRleHQudG9Mb2NhbGVVcHBlckNhc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTG93ZXJDYXNlQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDYXNlQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLnRyYW5zZm9ybVRvTG93ZXJjYXNlJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdlZGl0b3IudHJhbnNmb3JtVG9Mb3dlcmNhc2UnLCBcIlRyYW5zZm9ybSB0byBMb3dlcmNhc2VcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX21vZGlmeVRleHQodGV4dDogc3RyaW5nLCB3b3JkU2VwYXJhdG9yczogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGV4dC50b0xvY2FsZUxvd2VyQ2FzZSgpO1xuXHR9XG59XG5cbmNsYXNzIEJhY2t3YXJkc0NvbXBhdGlibGVSZWdFeHAge1xuXG5cdHByaXZhdGUgX2FjdHVhbDogUmVnRXhwIHwgbnVsbDtcblx0cHJpdmF0ZSBfZXZhbHVhdGVkOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3BhdHRlcm46IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9mbGFnczogc3RyaW5nXG5cdCkge1xuXHRcdHRoaXMuX2FjdHVhbCA9IG51bGw7XG5cdFx0dGhpcy5fZXZhbHVhdGVkID0gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0KCk6IFJlZ0V4cCB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fZXZhbHVhdGVkKSB7XG5cdFx0XHR0aGlzLl9ldmFsdWF0ZWQgPSB0cnVlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5fYWN0dWFsID0gbmV3IFJlZ0V4cCh0aGlzLl9wYXR0ZXJuLCB0aGlzLl9mbGFncyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Ly8gdGhpcyBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgdGhpcyByZWd1bGFyIGV4cHJlc3Npb25cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbDtcblx0fVxuXG5cdHB1YmxpYyBpc1N1cHBvcnRlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKHRoaXMuZ2V0KCkgIT09IG51bGwpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUaXRsZUNhc2VBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENhc2VBY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgdGl0bGVCb3VuZGFyeSA9IG5ldyBCYWNrd2FyZHNDb21wYXRpYmxlUmVnRXhwKCcoXnxbXlxcXFxwe0x9XFxcXHB7Tn1cXCddfCgoXnxcXFxcUHtMfSlcXCcpKVxcXFxwe0x9JywgJ2dtdScpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi50cmFuc2Zvcm1Ub1RpdGxlY2FzZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZWRpdG9yLnRyYW5zZm9ybVRvVGl0bGVjYXNlJywgXCJUcmFuc2Zvcm0gdG8gVGl0bGUgQ2FzZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGVcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBfbW9kaWZ5VGV4dCh0ZXh0OiBzdHJpbmcsIHdvcmRTZXBhcmF0b3JzOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHRpdGxlQm91bmRhcnkgPSBUaXRsZUNhc2VBY3Rpb24udGl0bGVCb3VuZGFyeS5nZXQoKTtcblx0XHRpZiAoIXRpdGxlQm91bmRhcnkpIHtcblx0XHRcdC8vIGNhbm5vdCBzdXBwb3J0IHRoaXNcblx0XHRcdHJldHVybiB0ZXh0O1xuXHRcdH1cblx0XHRyZXR1cm4gdGV4dFxuXHRcdFx0LnRvTG9jYWxlTG93ZXJDYXNlKClcblx0XHRcdC5yZXBsYWNlKHRpdGxlQm91bmRhcnksIChiKSA9PiBiLnRvTG9jYWxlVXBwZXJDYXNlKCkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTbmFrZUNhc2VBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENhc2VBY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgY2FzZUJvdW5kYXJ5ID0gbmV3IEJhY2t3YXJkc0NvbXBhdGlibGVSZWdFeHAoJyhcXFxccHtMbH0pKFxcXFxwe0x1fSknLCAnZ211Jyk7XG5cdHB1YmxpYyBzdGF0aWMgc2luZ2xlTGV0dGVycyA9IG5ldyBCYWNrd2FyZHNDb21wYXRpYmxlUmVnRXhwKCcoXFxcXHB7THV9fFxcXFxwe059KShcXFxccHtMdX0pKFxcXFxwe0xsfSknLCAnZ211Jyk7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLnRyYW5zZm9ybVRvU25ha2VjYXNlJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdlZGl0b3IudHJhbnNmb3JtVG9TbmFrZWNhc2UnLCBcIlRyYW5zZm9ybSB0byBTbmFrZSBDYXNlXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9tb2RpZnlUZXh0KHRleHQ6IHN0cmluZywgd29yZFNlcGFyYXRvcnM6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgY2FzZUJvdW5kYXJ5ID0gU25ha2VDYXNlQWN0aW9uLmNhc2VCb3VuZGFyeS5nZXQoKTtcblx0XHRjb25zdCBzaW5nbGVMZXR0ZXJzID0gU25ha2VDYXNlQWN0aW9uLnNpbmdsZUxldHRlcnMuZ2V0KCk7XG5cdFx0aWYgKCFjYXNlQm91bmRhcnkgfHwgIXNpbmdsZUxldHRlcnMpIHtcblx0XHRcdC8vIGNhbm5vdCBzdXBwb3J0IHRoaXNcblx0XHRcdHJldHVybiB0ZXh0O1xuXHRcdH1cblx0XHRyZXR1cm4gKHRleHRcblx0XHRcdC5yZXBsYWNlKGNhc2VCb3VuZGFyeSwgJyQxXyQyJylcblx0XHRcdC5yZXBsYWNlKHNpbmdsZUxldHRlcnMsICckMV8kMiQzJylcblx0XHRcdC50b0xvY2FsZUxvd2VyQ2FzZSgpXG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2FtZWxDYXNlQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDYXNlQWN0aW9uIHtcblx0cHVibGljIHN0YXRpYyB3b3JkQm91bmRhcnkgPSBuZXcgQmFja3dhcmRzQ29tcGF0aWJsZVJlZ0V4cCgnW19cXFxccy1dJywgJ2dtJyk7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLnRyYW5zZm9ybVRvQ2FtZWxjYXNlJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdlZGl0b3IudHJhbnNmb3JtVG9DYW1lbGNhc2UnLCBcIlRyYW5zZm9ybSB0byBDYW1lbCBDYXNlXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9tb2RpZnlUZXh0KHRleHQ6IHN0cmluZywgd29yZFNlcGFyYXRvcnM6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgd29yZEJvdW5kYXJ5ID0gQ2FtZWxDYXNlQWN0aW9uLndvcmRCb3VuZGFyeS5nZXQoKTtcblx0XHRpZiAoIXdvcmRCb3VuZGFyeSkge1xuXHRcdFx0Ly8gY2Fubm90IHN1cHBvcnQgdGhpc1xuXHRcdFx0cmV0dXJuIHRleHQ7XG5cdFx0fVxuXHRcdGNvbnN0IHdvcmRzID0gdGV4dC5zcGxpdCh3b3JkQm91bmRhcnkpO1xuXHRcdGNvbnN0IGZpcnN0V29yZCA9IHdvcmRzLnNoaWZ0KCk7XG5cdFx0cmV0dXJuIGZpcnN0V29yZCArIHdvcmRzLm1hcCgod29yZDogc3RyaW5nKSA9PiB3b3JkLnN1YnN0cmluZygwLCAxKS50b0xvY2FsZVVwcGVyQ2FzZSgpICsgd29yZC5zdWJzdHJpbmcoMSkpXG5cdFx0XHQuam9pbignJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhc2NhbENhc2VBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENhc2VBY3Rpb24ge1xuXHRwdWJsaWMgc3RhdGljIHdvcmRCb3VuZGFyeSA9IG5ldyBCYWNrd2FyZHNDb21wYXRpYmxlUmVnRXhwKCdbX1xcXFxzLV0nLCAnZ20nKTtcblx0cHVibGljIHN0YXRpYyB3b3JkQm91bmRhcnlUb01haW50YWluID0gbmV3IEJhY2t3YXJkc0NvbXBhdGlibGVSZWdFeHAoJyg/PD1cXFxcLiknLCAnZ20nKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24udHJhbnNmb3JtVG9QYXNjYWxjYXNlJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdlZGl0b3IudHJhbnNmb3JtVG9QYXNjYWxjYXNlJywgXCJUcmFuc2Zvcm0gdG8gUGFzY2FsIENhc2VcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX21vZGlmeVRleHQodGV4dDogc3RyaW5nLCB3b3JkU2VwYXJhdG9yczogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCB3b3JkQm91bmRhcnkgPSBQYXNjYWxDYXNlQWN0aW9uLndvcmRCb3VuZGFyeS5nZXQoKTtcblx0XHRjb25zdCB3b3JkQm91bmRhcnlUb01haW50YWluID0gUGFzY2FsQ2FzZUFjdGlvbi53b3JkQm91bmRhcnlUb01haW50YWluLmdldCgpO1xuXG5cdFx0aWYgKCF3b3JkQm91bmRhcnkgfHwgIXdvcmRCb3VuZGFyeVRvTWFpbnRhaW4pIHtcblx0XHRcdC8vIGNhbm5vdCBzdXBwb3J0IHRoaXNcblx0XHRcdHJldHVybiB0ZXh0O1xuXHRcdH1cblxuXHRcdGNvbnN0IHdvcmRzV2l0aE1haW50YWluQm91bmRhcmllcyA9IHRleHQuc3BsaXQod29yZEJvdW5kYXJ5VG9NYWludGFpbik7XG5cdFx0Y29uc3Qgd29yZHMgPSB3b3Jkc1dpdGhNYWludGFpbkJvdW5kYXJpZXMubWFwKCh3b3JkOiBzdHJpbmcpID0+IHdvcmQuc3BsaXQod29yZEJvdW5kYXJ5KSkuZmxhdCgpO1xuXHRcdHJldHVybiB3b3Jkcy5tYXAoKHdvcmQ6IHN0cmluZykgPT4gd29yZC5zdWJzdHJpbmcoMCwgMSkudG9Mb2NhbGVVcHBlckNhc2UoKSArIHdvcmQuc3Vic3RyaW5nKDEpKVxuXHRcdFx0LmpvaW4oJycpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBLZWJhYkNhc2VBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENhc2VBY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgaXNTdXBwb3J0ZWQoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgYXJlQWxsUmVnZXhwc1N1cHBvcnRlZCA9IFtcblx0XHRcdHRoaXMuY2FzZUJvdW5kYXJ5LFxuXHRcdFx0dGhpcy5zaW5nbGVMZXR0ZXJzLFxuXHRcdFx0dGhpcy51bmRlcnNjb3JlQm91bmRhcnksXG5cdFx0XS5ldmVyeSgocmVnZXhwKSA9PiByZWdleHAuaXNTdXBwb3J0ZWQoKSk7XG5cblx0XHRyZXR1cm4gYXJlQWxsUmVnZXhwc1N1cHBvcnRlZDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIGNhc2VCb3VuZGFyeSA9IG5ldyBCYWNrd2FyZHNDb21wYXRpYmxlUmVnRXhwKCcoXFxcXHB7TGx9KShcXFxccHtMdX0pJywgJ2dtdScpO1xuXHRwcml2YXRlIHN0YXRpYyBzaW5nbGVMZXR0ZXJzID0gbmV3IEJhY2t3YXJkc0NvbXBhdGlibGVSZWdFeHAoJyhcXFxccHtMdX18XFxcXHB7Tn0pKFxcXFxwe0x1fVxcXFxwe0xsfSknLCAnZ211Jyk7XG5cdHByaXZhdGUgc3RhdGljIHVuZGVyc2NvcmVCb3VuZGFyeSA9IG5ldyBCYWNrd2FyZHNDb21wYXRpYmxlUmVnRXhwKCcoXFxcXFMpKF8pKFxcXFxTKScsICdnbScpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi50cmFuc2Zvcm1Ub0tlYmFiY2FzZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZWRpdG9yLnRyYW5zZm9ybVRvS2ViYWJjYXNlJywgJ1RyYW5zZm9ybSB0byBLZWJhYiBDYXNlJyksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX21vZGlmeVRleHQodGV4dDogc3RyaW5nLCBfOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGNhc2VCb3VuZGFyeSA9IEtlYmFiQ2FzZUFjdGlvbi5jYXNlQm91bmRhcnkuZ2V0KCk7XG5cdFx0Y29uc3Qgc2luZ2xlTGV0dGVycyA9IEtlYmFiQ2FzZUFjdGlvbi5zaW5nbGVMZXR0ZXJzLmdldCgpO1xuXHRcdGNvbnN0IHVuZGVyc2NvcmVCb3VuZGFyeSA9IEtlYmFiQ2FzZUFjdGlvbi51bmRlcnNjb3JlQm91bmRhcnkuZ2V0KCk7XG5cblx0XHRpZiAoIWNhc2VCb3VuZGFyeSB8fCAhc2luZ2xlTGV0dGVycyB8fCAhdW5kZXJzY29yZUJvdW5kYXJ5KSB7XG5cdFx0XHQvLyBvbmUgb3IgbW9yZSByZWdleHBzIGFyZW4ndCBzdXBwb3J0ZWRcblx0XHRcdHJldHVybiB0ZXh0O1xuXHRcdH1cblxuXHRcdHJldHVybiB0ZXh0XG5cdFx0XHQucmVwbGFjZSh1bmRlcnNjb3JlQm91bmRhcnksICckMS0kMycpXG5cdFx0XHQucmVwbGFjZShjYXNlQm91bmRhcnksICckMS0kMicpXG5cdFx0XHQucmVwbGFjZShzaW5nbGVMZXR0ZXJzLCAnJDEtJDInKVxuXHRcdFx0LnRvTG9jYWxlTG93ZXJDYXNlKCk7XG5cdH1cbn1cblxucmVnaXN0ZXJFZGl0b3JBY3Rpb24oQ29weUxpbmVzVXBBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oQ29weUxpbmVzRG93bkFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihEdXBsaWNhdGVTZWxlY3Rpb25BY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oTW92ZUxpbmVzVXBBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oTW92ZUxpbmVzRG93bkFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihTb3J0TGluZXNBc2NlbmRpbmdBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oU29ydExpbmVzRGVzY2VuZGluZ0FjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihEZWxldGVEdXBsaWNhdGVMaW5lc0FjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihUcmltVHJhaWxpbmdXaGl0ZXNwYWNlQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKERlbGV0ZUxpbmVzQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEluZGVudExpbmVzQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKE91dGRlbnRMaW5lc0FjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihJbnNlcnRMaW5lQmVmb3JlQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEluc2VydExpbmVBZnRlckFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihEZWxldGVBbGxMZWZ0QWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKERlbGV0ZUFsbFJpZ2h0QWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEpvaW5MaW5lc0FjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihUcmFuc3Bvc2VBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oVXBwZXJDYXNlQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKExvd2VyQ2FzZUFjdGlvbik7XG5cbmlmIChTbmFrZUNhc2VBY3Rpb24uY2FzZUJvdW5kYXJ5LmlzU3VwcG9ydGVkKCkgJiYgU25ha2VDYXNlQWN0aW9uLnNpbmdsZUxldHRlcnMuaXNTdXBwb3J0ZWQoKSkge1xuXHRyZWdpc3RlckVkaXRvckFjdGlvbihTbmFrZUNhc2VBY3Rpb24pO1xufVxuaWYgKENhbWVsQ2FzZUFjdGlvbi53b3JkQm91bmRhcnkuaXNTdXBwb3J0ZWQoKSkge1xuXHRyZWdpc3RlckVkaXRvckFjdGlvbihDYW1lbENhc2VBY3Rpb24pO1xufVxuaWYgKFBhc2NhbENhc2VBY3Rpb24ud29yZEJvdW5kYXJ5LmlzU3VwcG9ydGVkKCkpIHtcblx0cmVnaXN0ZXJFZGl0b3JBY3Rpb24oUGFzY2FsQ2FzZUFjdGlvbik7XG59XG5pZiAoVGl0bGVDYXNlQWN0aW9uLnRpdGxlQm91bmRhcnkuaXNTdXBwb3J0ZWQoKSkge1xuXHRyZWdpc3RlckVkaXRvckFjdGlvbihUaXRsZUNhc2VBY3Rpb24pO1xufVxuXG5pZiAoS2ViYWJDYXNlQWN0aW9uLmlzU3VwcG9ydGVkKCkpIHtcblx0cmVnaXN0ZXJFZGl0b3JBY3Rpb24oS2ViYWJDYXNlQWN0aW9uKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsVUFBVSxTQUFTLGNBQWM7QUFDMUMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxjQUE4Qiw0QkFBOEM7QUFDckYsU0FBUyxnQkFBZ0Isc0NBQXNDLHFDQUFxQztBQUNwRyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUEyQztBQUNwRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsY0FBYztBQUN2QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLDZCQUE2QjtBQUl0QyxNQUFlLGdDQUFnQyxhQUFhO0FBQUEsRUFJM0QsWUFBWSxNQUFlLE1BQXNCO0FBQ2hELFVBQU0sSUFBSTtBQUNWLFNBQUssT0FBTztBQUFBLEVBQ2I7QUFBQSxFQUVPLElBQUksV0FBNkIsUUFBMkI7QUFDbEUsUUFBSSxDQUFDLE9BQU8sU0FBUyxHQUFHO0FBQ3ZCO0FBQUEsSUFDRDtBQUVBLFVBQU0sYUFBYSxPQUFPLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVyxXQUFXLEVBQUUsV0FBVyxPQUFPLFFBQVEsTUFBTSxFQUFFO0FBQ3pHLGVBQVcsS0FBSyxDQUFDLEdBQUcsTUFBTSxNQUFNLHlCQUF5QixFQUFFLFdBQVcsRUFBRSxTQUFTLENB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
