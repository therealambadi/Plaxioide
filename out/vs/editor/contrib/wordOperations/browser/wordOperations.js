import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { EditorAction, EditorCommand, registerEditorAction, registerEditorCommand } from "../../../browser/editorExtensions.js";
import { ReplaceCommand } from "../../../common/commands/replaceCommand.js";
import { EditorOption, EditorOptions } from "../../../common/config/editorOptions.js";
import { CursorState } from "../../../common/cursorCommon.js";
import { CursorChangeReason } from "../../../common/cursorEvents.js";
import { WordNavigationType, WordOperations } from "../../../common/cursor/cursorWordOperations.js";
import { getMapForWordSeparators } from "../../../common/core/wordCharacterClassifier.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import * as nls from "../../../../nls.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IsWindowsContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
class MoveWordCommand extends EditorCommand {
  constructor(opts) {
    super(opts);
    this._inSelectionMode = opts.inSelectionMode;
    this._wordNavigationType = opts.wordNavigationType;
  }
  runEditorCommand(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    const wordSeparators = getMapForWordSeparators(editor.getOption(EditorOption.wordSeparators), editor.getOption(EditorOption.wordSegmenterLocales));
    const model = editor.getModel();
    const selections = editor.getSelections();
    const hasMulticursor = selections.length > 1;
    const result = selections.map((sel) => {
      const inPosition = new Position(sel.positionLineNumber, sel.positionColumn);
      const outPosition = this._move(wordSeparators, model, inPosition, this._wordNavigationType, hasMulticursor);
      return this._moveTo(sel, outPosition, this._inSelectionMode);
    });
    model.pushStackElement();
    editor._getViewModel().setCursorStates("moveWordCommand", CursorChangeReason.Explicit, result.map((r) => CursorState.fromModelSelection(r)));
    if (result.length === 1) {
      const pos = new Position(result[0].positionLineNumber, result[0].positionColumn);
      editor.revealPosition(pos, ScrollType.Smooth);
    }
  }
  _moveTo(from, to, inSelectionMode) {
    if (inSelectionMode) {
      return new Selection(
        from.selectionStartLineNumber,
        from.selectionStartColumn,
        to.lineNumber,
        to.column
      );
    } else {
      return new Selection(
        to.lineNumber,
        to.column,
        to.lineNumber,
        to.column
      );
    }
  }
}
class WordLeftCommand extends MoveWordCommand {
  _move(wordSeparators, model, position, wordNavigationType, hasMulticursor) {
    return WordOperations.moveWordLeft(wordSeparators, model, position, wordNavigationType, hasMulticursor);
  }
}
class WordRightCommand extends MoveWordCommand {
  _move(wordSeparators, model, position, wordNavigationType, hasMulticursor) {
    return WordOperations.moveWordRight(wordSeparators, model, position, wordNavigationType);
  }
}
class CursorWordStartLeft extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordStart,
      id: "cursorWordStartLeft",
      precondition: void 0
    });
  }
}
class CursorWordEndLeft extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "cursorWordEndLeft",
      precondition: void 0
    });
  }
}
class CursorWordLeft extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordStartFast,
      id: "cursorWordLeft",
      precondition: void 0,
      kbOpts: {
        kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
        primary: KeyMod.CtrlCmd | KeyCode.LeftArrow,
        mac: { primary: KeyMod.Alt | KeyCode.LeftArrow },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class CursorWordStartLeftSelect extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordStart,
      id: "cursorWordStartLeftSelect",
      precondition: void 0
    });
  }
}
class CursorWordEndLeftSelect extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "cursorWordEndLeftSelect",
      precondition: void 0
    });
  }
}
class CursorWordLeftSelect extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordStartFast,
      id: "cursorWordLeftSelect",
      precondition: void 0,
      kbOpts: {
        kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow,
        mac: { primary: KeyMod.Alt | KeyMod.Shift | KeyCode.LeftArrow },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class CursorWordAccessibilityLeft extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordAccessibility,
      id: "cursorWordAccessibilityLeft",
      precondition: void 0
    });
  }
  _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
    return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
  }
}
class CursorWordAccessibilityLeftSelect extends WordLeftCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordAccessibility,
      id: "cursorWordAccessibilityLeftSelect",
      precondition: void 0
    });
  }
  _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
    return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
  }
}
class CursorWordStartRight extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordStart,
      id: "cursorWordStartRight",
      precondition: void 0
    });
  }
}
class CursorWordEndRight extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "cursorWordEndRight",
      precondition: void 0,
      kbOpts: {
        kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
        primary: KeyMod.CtrlCmd | KeyCode.RightArrow,
        mac: { primary: KeyMod.Alt | KeyCode.RightArrow },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class CursorWordRight extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "cursorWordRight",
      precondition: void 0
    });
  }
}
class CursorWordStartRightSelect extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordStart,
      id: "cursorWordStartRightSelect",
      precondition: void 0
    });
  }
}
class CursorWordEndRightSelect extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "cursorWordEndRightSelect",
      precondition: void 0,
      kbOpts: {
        kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow,
        mac: { primary: KeyMod.Alt | KeyMod.Shift | KeyCode.RightArrow },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class CursorWordRightSelect extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "cursorWordRightSelect",
      precondition: void 0
    });
  }
}
class CursorWordAccessibilityRight extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: false,
      wordNavigationType: WordNavigationType.WordAccessibility,
      id: "cursorWordAccessibilityRight",
      precondition: void 0
    });
  }
  _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
    return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
  }
}
class CursorWordAccessibilityRightSelect extends WordRightCommand {
  constructor() {
    super({
      inSelectionMode: true,
      wordNavigationType: WordNavigationType.WordAccessibility,
      id: "cursorWordAccessibilityRightSelect",
      precondition: void 0
    });
  }
  _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
    return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
  }
}
class DeleteWordCommand extends EditorCommand {
  constructor(opts) {
    super(opts);
    this._whitespaceHeuristics = opts.whitespaceHeuristics;
    this._wordNavigationType = opts.wordNavigationType;
  }
  runEditorCommand(accessor, editor, args) {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    if (!editor.hasModel()) {
      return;
    }
    const wordSeparators = getMapForWordSeparators(editor.getOption(EditorOption.wordSeparators), editor.getOption(EditorOption.wordSegmenterLocales));
    const model = editor.getModel();
    const selections = editor.getSelections();
    const autoClosingBrackets = editor.getOption(EditorOption.autoClosingBrackets);
    const autoClosingQuotes = editor.getOption(EditorOption.autoClosingQuotes);
    const autoClosingPairs = languageConfigurationService.getLanguageConfiguration(model.getLanguageId()).getAutoClosingPairs();
    const viewModel = editor._getViewModel();
    const commands = selections.map((sel) => {
      const deleteRange = this._delete({
        wordSeparators,
        model,
        selection: sel,
        whitespaceHeuristics: this._whitespaceHeuristics,
        autoClosingDelete: editor.getOption(EditorOption.autoClosingDelete),
        autoClosingBrackets,
        autoClosingQuotes,
        autoClosingPairs,
        autoClosedCharacters: viewModel.getCursorAutoClosedCharacters()
      }, this._wordNavigationType);
      return new ReplaceCommand(deleteRange, "");
    });
    editor.pushUndoStop();
    editor.executeCommands(this.id, commands);
    editor.pushUndoStop();
  }
}
class DeleteWordLeftCommand extends DeleteWordCommand {
  _delete(ctx, wordNavigationType) {
    const r = WordOperations.deleteWordLeft(ctx, wordNavigationType);
    if (r) {
      return r;
    }
    return new Range(1, 1, 1, 1);
  }
}
class DeleteWordRightCommand extends DeleteWordCommand {
  _delete(ctx, wordNavigationType) {
    const r = WordOperations.deleteWordRight(ctx, wordNavigationType);
    if (r) {
      return r;
    }
    const lineCount = ctx.model.getLineCount();
    const maxColumn = ctx.model.getLineMaxColumn(lineCount);
    return new Range(lineCount, maxColumn, lineCount, maxColumn);
  }
}
class DeleteWordStartLeft extends DeleteWordLeftCommand {
  constructor() {
    super({
      whitespaceHeuristics: false,
      wordNavigationType: WordNavigationType.WordStart,
      id: "deleteWordStartLeft",
      precondition: EditorContextKeys.writable
    });
  }
}
class DeleteWordEndLeft extends DeleteWordLeftCommand {
  constructor() {
    super({
      whitespaceHeuristics: false,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "deleteWordEndLeft",
      precondition: EditorContextKeys.writable
    });
  }
}
class DeleteWordLeft extends DeleteWordLeftCommand {
  constructor() {
    super({
      whitespaceHeuristics: true,
      wordNavigationType: WordNavigationType.WordStart,
      id: "deleteWordLeft",
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyMod.CtrlCmd | KeyCode.Backspace,
        mac: { primary: KeyMod.Alt | KeyCode.Backspace },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class DeleteWordStartRight extends DeleteWordRightCommand {
  constructor() {
    super({
      whitespaceHeuristics: false,
      wordNavigationType: WordNavigationType.WordStart,
      id: "deleteWordStartRight",
      precondition: EditorContextKeys.writable
    });
  }
}
class DeleteWordEndRight extends DeleteWordRightCommand {
  constructor() {
    super({
      whitespaceHeuristics: false,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "deleteWordEndRight",
      precondition: EditorContextKeys.writable
    });
  }
}
class DeleteWordRight extends DeleteWordRightCommand {
  constructor() {
    super({
      whitespaceHeuristics: true,
      wordNavigationType: WordNavigationType.WordEnd,
      id: "deleteWordRight",
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyMod.CtrlCmd | KeyCode.Delete,
        mac: { primary: KeyMod.Alt | KeyCode.Delete },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class DeleteInsideWord extends EditorAction {
  constructor() {
    super({
      id: "deleteInsideWord",
      precondition: EditorContextKeys.writable,
      label: nls.localize2("deleteInsideWord", "Delete Word")
    });
  }
  run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    const wordSeparators = getMapForWordSeparators(editor.getOption(EditorOption.wordSeparators), editor.getOption(EditorOption.wordSegmenterLocales));
    const model = editor.getModel();
    const selections = editor.getSelections();
    const commands = selections.map((sel) => {
      const deleteRange = WordOperations.deleteInsideWord(wordSeparators, model, sel);
      return new ReplaceCommand(deleteRange, "");
    });
    editor.pushUndoStop();
    editor.executeCommands(this.id, commands);
    editor.pushUndoStop();
  }
}
registerEditorCommand(new CursorWordStartLeft());
registerEditorCommand(new CursorWordEndLeft());
registerEditorCommand(new CursorWordLeft());
registerEditorCommand(new CursorWordStartLeftSelect());
registerEditorCommand(new CursorWordEndLeftSelect());
registerEditorCommand(new CursorWordLeftSelect());
registerEditorCommand(new CursorWordStartRight());
registerEditorCommand(new CursorWordEndRight());
registerEditorCommand(new CursorWordRight());
registerEditorCommand(new CursorWordStartRightSelect());
registerEditorCommand(new CursorWordEndRightSelect());
registerEditorCommand(new CursorWordRightSelect());
registerEditorCommand(new CursorWordAccessibilityLeft());
registerEditorCommand(new CursorWordAccessibilityLeftSelect());
registerEditorCommand(new CursorWordAccessibilityRight());
registerEditorCommand(new CursorWordAccessibilityRightSelect());
registerEditorCommand(new DeleteWordStartLeft());
registerEditorCommand(new DeleteWordEndLeft());
registerEditorCommand(new DeleteWordLeft());
registerEditorCommand(new DeleteWordStartRight());
registerEditorCommand(new DeleteWordEndRight());
registerEditorCommand(new DeleteWordRight());
registerEditorAction(DeleteInsideWord);
export {
  CursorWordAccessibilityLeft,
  CursorWordAccessibilityLeftSelect,
  CursorWordAccessibilityRight,
  CursorWordAccessibilityRightSelect,
  CursorWordEndLeft,
  CursorWordEndLeftSelect,
  CursorWordEndRight,
  CursorWordEndRightSelect,
  CursorWordLeft,
  CursorWordLeftSelect,
  CursorWordRight,
  CursorWordRightSelect,
  CursorWordStartLeft,
  CursorWordStartLeftSelect,
  CursorWordStartRight,
  CursorWordStartRightSelect,
  DeleteInsideWord,
  DeleteWordCommand,
  DeleteWordEndLeft,
  DeleteWordEndRight,
  DeleteWordLeft,
  DeleteWordLeftCommand,
  DeleteWordRight,
  DeleteWordRightCommand,
  DeleteWordStartLeft,
  DeleteWordStartRight,
  MoveWordCommand,
  WordLeftCommand,
  WordRightCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi93b3JkT3BlcmF0aW9ucy9icm93c2VyL3dvcmRPcGVyYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uLCBFZGl0b3JDb21tYW5kLCBJQ29tbWFuZE9wdGlvbnMsIHJlZ2lzdGVyRWRpdG9yQWN0aW9uLCByZWdpc3RlckVkaXRvckNvbW1hbmQsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUmVwbGFjZUNvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29tbWFuZHMvcmVwbGFjZUNvbW1hbmQuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uLCBFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEN1cnNvclN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBDdXJzb3JDaGFuZ2VSZWFzb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY3Vyc29yRXZlbnRzLmpzJztcbmltcG9ydCB7IERlbGV0ZVdvcmRDb250ZXh0LCBXb3JkTmF2aWdhdGlvblR5cGUsIFdvcmRPcGVyYXRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvci9jdXJzb3JXb3JkT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBnZXRNYXBGb3JXb3JkU2VwYXJhdG9ycywgV29yZENoYXJhY3RlckNsYXNzaWZpZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS93b3JkQ2hhcmFjdGVyQ2xhc3NpZmllci5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElzV2luZG93c0NvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW92ZVdvcmRPcHRpb25zIGV4dGVuZHMgSUNvbW1hbmRPcHRpb25zIHtcblx0aW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuO1xuXHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE1vdmVXb3JkQ29tbWFuZCBleHRlbmRzIEVkaXRvckNvbW1hbmQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2luU2VsZWN0aW9uTW9kZTogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfd29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGU7XG5cblx0Y29uc3RydWN0b3Iob3B0czogTW92ZVdvcmRPcHRpb25zKSB7XG5cdFx0c3VwZXIob3B0cyk7XG5cdFx0dGhpcy5faW5TZWxlY3Rpb25Nb2RlID0gb3B0cy5pblNlbGVjdGlvbk1vZGU7XG5cdFx0dGhpcy5fd29yZE5hdmlnYXRpb25UeXBlID0gb3B0cy53b3JkTmF2aWdhdGlvblR5cGU7XG5cdH1cblxuXHRwdWJsaWMgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB3b3JkU2VwYXJhdG9ycyA9IGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSwgZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ud29yZFNlZ21lbnRlckxvY2FsZXMpKTtcblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGNvbnN0IGhhc011bHRpY3Vyc29yID0gc2VsZWN0aW9ucy5sZW5ndGggPiAxO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHNlbGVjdGlvbnMubWFwKChzZWwpID0+IHtcblx0XHRcdGNvbnN0IGluUG9zaXRpb24gPSBuZXcgUG9zaXRpb24oc2VsLnBvc2l0aW9uTGluZU51bWJlciwgc2VsLnBvc2l0aW9uQ29sdW1uKTtcblx0XHRcdGNvbnN0IG91dFBvc2l0aW9uID0gdGhpcy5fbW92ZSh3b3JkU2VwYXJhdG9ycywgbW9kZWwsIGluUG9zaXRpb24sIHRoaXMuX3dvcmROYXZpZ2F0aW9uVHlwZSwgaGFzTXVsdGljdXJzb3IpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX21vdmVUbyhzZWwsIG91dFBvc2l0aW9uLCB0aGlzLl9pblNlbGVjdGlvbk1vZGUpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdGVkaXRvci5fZ2V0Vmlld01vZGVsKCkuc2V0Q3Vyc29yU3RhdGVzKCdtb3ZlV29yZENvbW1hbmQnLCBDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsIHJlc3VsdC5tYXAociA9PiBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTZWxlY3Rpb24ocikpKTtcblx0XHRpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKHJlc3VsdFswXS5wb3NpdGlvbkxpbmVOdW1iZXIsIHJlc3VsdFswXS5wb3NpdGlvbkNvbHVtbik7XG5cdFx0XHRlZGl0b3IucmV2ZWFsUG9zaXRpb24ocG9zLCBTY3JvbGxUeXBlLlNtb290aCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfbW92ZVRvKGZyb206IFNlbGVjdGlvbiwgdG86IFBvc2l0aW9uLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4pOiBTZWxlY3Rpb24ge1xuXHRcdGlmIChpblNlbGVjdGlvbk1vZGUpIHtcblx0XHRcdC8vIG1vdmUganVzdCBwb3NpdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24oXG5cdFx0XHRcdGZyb20uc2VsZWN0aW9uU3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRmcm9tLnNlbGVjdGlvblN0YXJ0Q29sdW1uLFxuXHRcdFx0XHR0by5saW5lTnVtYmVyLFxuXHRcdFx0XHR0by5jb2x1bW5cblx0XHRcdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIG1vdmUgZXZlcnl0aGluZ1xuXHRcdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24oXG5cdFx0XHRcdHRvLmxpbmVOdW1iZXIsXG5cdFx0XHRcdHRvLmNvbHVtbixcblx0XHRcdFx0dG8ubGluZU51bWJlcixcblx0XHRcdFx0dG8uY29sdW1uXG5cdFx0XHQpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfbW92ZSh3b3JkU2VwYXJhdG9yczogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlLCBoYXNNdWx0aWN1cnNvcjogYm9vbGVhbik6IFBvc2l0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgV29yZExlZnRDb21tYW5kIGV4dGVuZHMgTW92ZVdvcmRDb21tYW5kIHtcblx0cHJvdGVjdGVkIF9tb3ZlKHdvcmRTZXBhcmF0b3JzOiBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciwgbW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgd29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUsIGhhc011bHRpY3Vyc29yOiBib29sZWFuKTogUG9zaXRpb24ge1xuXHRcdHJldHVybiBXb3JkT3BlcmF0aW9ucy5tb3ZlV29yZExlZnQod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBwb3NpdGlvbiwgd29yZE5hdmlnYXRpb25UeXBlLCBoYXNNdWx0aWN1cnNvcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmRSaWdodENvbW1hbmQgZXh0ZW5kcyBNb3ZlV29yZENvbW1hbmQge1xuXHRwcm90ZWN0ZWQgX21vdmUod29yZFNlcGFyYXRvcnM6IFdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCB3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZSwgaGFzTXVsdGljdXJzb3I6IGJvb2xlYW4pOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIFdvcmRPcGVyYXRpb25zLm1vdmVXb3JkUmlnaHQod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBwb3NpdGlvbiwgd29yZE5hdmlnYXRpb25UeXBlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ3Vyc29yV29yZFN0YXJ0TGVmdCBleHRlbmRzIFdvcmRMZWZ0Q29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGluU2VsZWN0aW9uTW9kZTogZmFsc2UsXG5cdFx0XHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkU3RhcnQsXG5cdFx0XHRpZDogJ2N1cnNvcldvcmRTdGFydExlZnQnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ3Vyc29yV29yZEVuZExlZnQgZXh0ZW5kcyBXb3JkTGVmdENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEVuZCxcblx0XHRcdGlkOiAnY3Vyc29yV29yZEVuZExlZnQnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ3Vyc29yV29yZExlZnQgZXh0ZW5kcyBXb3JkTGVmdENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZFN0YXJ0RmFzdCxcblx0XHRcdGlkOiAnY3Vyc29yV29yZExlZnQnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsIENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVELCBJc1dpbmRvd3NDb250ZXh0KT8ubmVnYXRlKCkpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuTGVmdEFycm93LFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuTGVmdEFycm93IH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvcldvcmRTdGFydExlZnRTZWxlY3QgZXh0ZW5kcyBXb3JkTGVmdENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IHRydWUsXG5cdFx0XHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkU3RhcnQsXG5cdFx0XHRpZDogJ2N1cnNvcldvcmRTdGFydExlZnRTZWxlY3QnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ3Vyc29yV29yZEVuZExlZnRTZWxlY3QgZXh0ZW5kcyBXb3JkTGVmdENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IHRydWUsXG5cdFx0XHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkRW5kLFxuXHRcdFx0aWQ6ICdjdXJzb3JXb3JkRW5kTGVmdFNlbGVjdCcsXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JXb3JkTGVmdFNlbGVjdCBleHRlbmRzIFdvcmRMZWZ0Q29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRcdHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlLldvcmRTdGFydEZhc3QsXG5cdFx0XHRpZDogJ2N1cnNvcldvcmRMZWZ0U2VsZWN0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLCBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCwgSXNXaW5kb3dzQ29udGV4dCk/Lm5lZ2F0ZSgpKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkxlZnRBcnJvdyxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkxlZnRBcnJvdyB9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbi8vIEFjY2Vzc2liaWxpdHkgbmF2aWdhdGlvbiBjb21tYW5kcyBzaG91bGQgb25seSBiZSBlbmFibGVkIG9uIHdpbmRvd3Mgc2luY2UgdGhleSBhcmUgdHVuZWQgdG8gd2hhdCBOVkRBIGV4cGVjdHNcbmV4cG9ydCBjbGFzcyBDdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnQgZXh0ZW5kcyBXb3JkTGVmdENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEFjY2Vzc2liaWxpdHksXG5cdFx0XHRpZDogJ2N1cnNvcldvcmRBY2Nlc3NpYmlsaXR5TGVmdCcsXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9tb3ZlKHdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyOiBXb3JkQ2hhcmFjdGVyQ2xhc3NpZmllciwgbW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgd29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUsIGhhc011bHRpY3Vyc29yOiBib29sZWFuKTogUG9zaXRpb24ge1xuXHRcdHJldHVybiBzdXBlci5fbW92ZShnZXRNYXBGb3JXb3JkU2VwYXJhdG9ycyhFZGl0b3JPcHRpb25zLndvcmRTZXBhcmF0b3JzLmRlZmF1bHRWYWx1ZSwgd29yZENoYXJhY3RlckNsYXNzaWZpZXIuaW50bFNlZ21lbnRlckxvY2FsZXMpLCBtb2RlbCwgcG9zaXRpb24sIHdvcmROYXZpZ2F0aW9uVHlwZSwgaGFzTXVsdGljdXJzb3IpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnRTZWxlY3QgZXh0ZW5kcyBXb3JkTGVmdENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IHRydWUsXG5cdFx0XHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkQWNjZXNzaWJpbGl0eSxcblx0XHRcdGlkOiAnY3Vyc29yV29yZEFjY2Vzc2liaWxpdHlMZWZ0U2VsZWN0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX21vdmUod29yZENoYXJhY3RlckNsYXNzaWZpZXI6IFdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCB3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZSwgaGFzTXVsdGljdXJzb3I6IGJvb2xlYW4pOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHN1cGVyLl9tb3ZlKGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKEVkaXRvck9wdGlvbnMud29yZFNlcGFyYXRvcnMuZGVmYXVsdFZhbHVlLCB3b3JkQ2hhcmFjdGVyQ2xhc3NpZmllci5pbnRsU2VnbWVudGVyTG9jYWxlcyksIG1vZGVsLCBwb3NpdGlvbiwgd29yZE5hdmlnYXRpb25UeXBlLCBoYXNNdWx0aWN1cnNvcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvcldvcmRTdGFydFJpZ2h0IGV4dGVuZHMgV29yZFJpZ2h0Q29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGluU2VsZWN0aW9uTW9kZTogZmFsc2UsXG5cdFx0XHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkU3RhcnQsXG5cdFx0XHRpZDogJ2N1cnNvcldvcmRTdGFydFJpZ2h0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvcldvcmRFbmRSaWdodCBleHRlbmRzIFdvcmRSaWdodENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEVuZCxcblx0XHRcdGlkOiAnY3Vyc29yV29yZEVuZFJpZ2h0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLCBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCwgSXNXaW5kb3dzQ29udGV4dCk/Lm5lZ2F0ZSgpKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlJpZ2h0QXJyb3csXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5SaWdodEFycm93IH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvcldvcmRSaWdodCBleHRlbmRzIFdvcmRSaWdodENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEVuZCxcblx0XHRcdGlkOiAnY3Vyc29yV29yZFJpZ2h0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvcldvcmRTdGFydFJpZ2h0U2VsZWN0IGV4dGVuZHMgV29yZFJpZ2h0Q29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRcdHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlLldvcmRTdGFydCxcblx0XHRcdGlkOiAnY3Vyc29yV29yZFN0YXJ0UmlnaHRTZWxlY3QnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ3Vyc29yV29yZEVuZFJpZ2h0U2VsZWN0IGV4dGVuZHMgV29yZFJpZ2h0Q29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRcdHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlLldvcmRFbmQsXG5cdFx0XHRpZDogJ2N1cnNvcldvcmRFbmRSaWdodFNlbGVjdCcsXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cywgQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQsIElzV2luZG93c0NvbnRleHQpPy5uZWdhdGUoKSksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5SaWdodEFycm93LFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUmlnaHRBcnJvdyB9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JXb3JkUmlnaHRTZWxlY3QgZXh0ZW5kcyBXb3JkUmlnaHRDb21tYW5kIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aW5TZWxlY3Rpb25Nb2RlOiB0cnVlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEVuZCxcblx0XHRcdGlkOiAnY3Vyc29yV29yZFJpZ2h0U2VsZWN0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHQgZXh0ZW5kcyBXb3JkUmlnaHRDb21tYW5kIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aW5TZWxlY3Rpb25Nb2RlOiBmYWxzZSxcblx0XHRcdHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlLldvcmRBY2Nlc3NpYmlsaXR5LFxuXHRcdFx0aWQ6ICdjdXJzb3JXb3JkQWNjZXNzaWJpbGl0eVJpZ2h0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX21vdmUod29yZENoYXJhY3RlckNsYXNzaWZpZXI6IFdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCB3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZSwgaGFzTXVsdGljdXJzb3I6IGJvb2xlYW4pOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHN1cGVyLl9tb3ZlKGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKEVkaXRvck9wdGlvbnMud29yZFNlcGFyYXRvcnMuZGVmYXVsdFZhbHVlLCB3b3JkQ2hhcmFjdGVyQ2xhc3NpZmllci5pbnRsU2VnbWVudGVyTG9jYWxlcyksIG1vZGVsLCBwb3NpdGlvbiwgd29yZE5hdmlnYXRpb25UeXBlLCBoYXNNdWx0aWN1cnNvcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHRTZWxlY3QgZXh0ZW5kcyBXb3JkUmlnaHRDb21tYW5kIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aW5TZWxlY3Rpb25Nb2RlOiB0cnVlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEFjY2Vzc2liaWxpdHksXG5cdFx0XHRpZDogJ2N1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHRTZWxlY3QnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfbW92ZSh3b3JkQ2hhcmFjdGVyQ2xhc3NpZmllcjogV29yZENoYXJhY3RlckNsYXNzaWZpZXIsIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlLCBoYXNNdWx0aWN1cnNvcjogYm9vbGVhbik6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gc3VwZXIuX21vdmUoZ2V0TWFwRm9yV29yZFNlcGFyYXRvcnMoRWRpdG9yT3B0aW9ucy53b3JkU2VwYXJhdG9ycy5kZWZhdWx0VmFsdWUsIHdvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLmludGxTZWdtZW50ZXJMb2NhbGVzKSwgbW9kZWwsIHBvc2l0aW9uLCB3b3JkTmF2aWdhdGlvblR5cGUsIGhhc011bHRpY3Vyc29yKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlbGV0ZVdvcmRPcHRpb25zIGV4dGVuZHMgSUNvbW1hbmRPcHRpb25zIHtcblx0d2hpdGVzcGFjZUhldXJpc3RpY3M6IGJvb2xlYW47XG5cdHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRGVsZXRlV29yZENvbW1hbmQgZXh0ZW5kcyBFZGl0b3JDb21tYW5kIHtcblx0cHJpdmF0ZSByZWFkb25seSBfd2hpdGVzcGFjZUhldXJpc3RpY3M6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3dvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlO1xuXG5cdGNvbnN0cnVjdG9yKG9wdHM6IERlbGV0ZVdvcmRPcHRpb25zKSB7XG5cdFx0c3VwZXIob3B0cyk7XG5cdFx0dGhpcy5fd2hpdGVzcGFjZUhldXJpc3RpY3MgPSBvcHRzLndoaXRlc3BhY2VIZXVyaXN0aWNzO1xuXHRcdHRoaXMuX3dvcmROYXZpZ2F0aW9uVHlwZSA9IG9wdHMud29yZE5hdmlnYXRpb25UeXBlO1xuXHR9XG5cblx0cHVibGljIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB3b3JkU2VwYXJhdG9ycyA9IGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSwgZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ud29yZFNlZ21lbnRlckxvY2FsZXMpKTtcblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGNvbnN0IGF1dG9DbG9zaW5nQnJhY2tldHMgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5hdXRvQ2xvc2luZ0JyYWNrZXRzKTtcblx0XHRjb25zdCBhdXRvQ2xvc2luZ1F1b3RlcyA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmF1dG9DbG9zaW5nUXVvdGVzKTtcblx0XHRjb25zdCBhdXRvQ2xvc2luZ1BhaXJzID0gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKS5nZXRBdXRvQ2xvc2luZ1BhaXJzKCk7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gZWRpdG9yLl9nZXRWaWV3TW9kZWwoKTtcblxuXHRcdGNvbnN0IGNvbW1hbmRzID0gc2VsZWN0aW9ucy5tYXAoKHNlbCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVsZXRlUmFuZ2UgPSB0aGlzLl9kZWxldGUoe1xuXHRcdFx0XHR3b3JkU2VwYXJhdG9ycyxcblx0XHRcdFx0bW9kZWwsXG5cdFx0XHRcdHNlbGVjdGlvbjogc2VsLFxuXHRcdFx0XHR3aGl0ZXNwYWNlSGV1cmlzdGljczogdGhpcy5fd2hpdGVzcGFjZUhldXJpc3RpY3MsXG5cdFx0XHRcdGF1dG9DbG9zaW5nRGVsZXRlOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5hdXRvQ2xvc2luZ0RlbGV0ZSksXG5cdFx0XHRcdGF1dG9DbG9zaW5nQnJhY2tldHMsXG5cdFx0XHRcdGF1dG9DbG9zaW5nUXVvdGVzLFxuXHRcdFx0XHRhdXRvQ2xvc2luZ1BhaXJzLFxuXHRcdFx0XHRhdXRvQ2xvc2VkQ2hhcmFjdGVyczogdmlld01vZGVsLmdldEN1cnNvckF1dG9DbG9zZWRDaGFyYWN0ZXJzKCksXG5cdFx0XHR9LCB0aGlzLl93b3JkTmF2aWdhdGlvblR5cGUpO1xuXHRcdFx0cmV0dXJuIG5ldyBSZXBsYWNlQ29tbWFuZChkZWxldGVSYW5nZSwgJycpO1xuXHRcdH0pO1xuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgY29tbWFuZHMpO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfZGVsZXRlKGN0eDogRGVsZXRlV29yZENvbnRleHQsIHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlKTogUmFuZ2U7XG59XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVXb3JkTGVmdENvbW1hbmQgZXh0ZW5kcyBEZWxldGVXb3JkQ29tbWFuZCB7XG5cdHByb3RlY3RlZCBfZGVsZXRlKGN0eDogRGVsZXRlV29yZENvbnRleHQsIHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlKTogUmFuZ2Uge1xuXHRcdGNvbnN0IHIgPSBXb3JkT3BlcmF0aW9ucy5kZWxldGVXb3JkTGVmdChjdHgsIHdvcmROYXZpZ2F0aW9uVHlwZSk7XG5cdFx0aWYgKHIpIHtcblx0XHRcdHJldHVybiByO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFJhbmdlKDEsIDEsIDEsIDEpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVXb3JkUmlnaHRDb21tYW5kIGV4dGVuZHMgRGVsZXRlV29yZENvbW1hbmQge1xuXHRwcm90ZWN0ZWQgX2RlbGV0ZShjdHg6IERlbGV0ZVdvcmRDb250ZXh0LCB3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZSk6IFJhbmdlIHtcblx0XHRjb25zdCByID0gV29yZE9wZXJhdGlvbnMuZGVsZXRlV29yZFJpZ2h0KGN0eCwgd29yZE5hdmlnYXRpb25UeXBlKTtcblx0XHRpZiAocikge1xuXHRcdFx0cmV0dXJuIHI7XG5cdFx0fVxuXHRcdGNvbnN0IGxpbmVDb3VudCA9IGN0eC5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCBtYXhDb2x1bW4gPSBjdHgubW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lQ291bnQpO1xuXHRcdHJldHVybiBuZXcgUmFuZ2UobGluZUNvdW50LCBtYXhDb2x1bW4sIGxpbmVDb3VudCwgbWF4Q29sdW1uKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVsZXRlV29yZFN0YXJ0TGVmdCBleHRlbmRzIERlbGV0ZVdvcmRMZWZ0Q29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHdoaXRlc3BhY2VIZXVyaXN0aWNzOiBmYWxzZSxcblx0XHRcdHdvcmROYXZpZ2F0aW9uVHlwZTogV29yZE5hdmlnYXRpb25UeXBlLldvcmRTdGFydCxcblx0XHRcdGlkOiAnZGVsZXRlV29yZFN0YXJ0TGVmdCcsXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlbGV0ZVdvcmRFbmRMZWZ0IGV4dGVuZHMgRGVsZXRlV29yZExlZnRDb21tYW5kIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0d2hpdGVzcGFjZUhldXJpc3RpY3M6IGZhbHNlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZEVuZCxcblx0XHRcdGlkOiAnZGVsZXRlV29yZEVuZExlZnQnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVXb3JkTGVmdCBleHRlbmRzIERlbGV0ZVdvcmRMZWZ0Q29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHdoaXRlc3BhY2VIZXVyaXN0aWNzOiB0cnVlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZFN0YXJ0LFxuXHRcdFx0aWQ6ICdkZWxldGVXb3JkTGVmdCcsXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2UsXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5CYWNrc3BhY2UgfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVsZXRlV29yZFN0YXJ0UmlnaHQgZXh0ZW5kcyBEZWxldGVXb3JkUmlnaHRDb21tYW5kIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0d2hpdGVzcGFjZUhldXJpc3RpY3M6IGZhbHNlLFxuXHRcdFx0d29yZE5hdmlnYXRpb25UeXBlOiBXb3JkTmF2aWdhdGlvblR5cGUuV29yZFN0YXJ0LFxuXHRcdFx0aWQ6ICdkZWxldGVXb3JkU3RhcnRSaWdodCcsXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlbGV0ZVdvcmRFbmRSaWdodCBleHRlbmRzIERlbGV0ZVdvcmRSaWdodENvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHR3aGl0ZXNwYWNlSGV1cmlzdGljczogZmFsc2UsXG5cdFx0XHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkRW5kLFxuXHRcdFx0aWQ6ICdkZWxldGVXb3JkRW5kUmlnaHQnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVXb3JkUmlnaHQgZXh0ZW5kcyBEZWxldGVXb3JkUmlnaHRDb21tYW5kIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0d2hpdGVzcGFjZUhldXJpc3RpY3M6IHRydWUsXG5cdFx0XHR3b3JkTmF2aWdhdGlvblR5cGU6IFdvcmROYXZpZ2F0aW9uVHlwZS5Xb3JkRW5kLFxuXHRcdFx0aWQ6ICdkZWxldGVXb3JkUmlnaHQnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRGVsZXRlLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuRGVsZXRlIH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlbGV0ZUluc2lkZVdvcmQgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZGVsZXRlSW5zaWRlV29yZCcsXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2RlbGV0ZUluc2lkZVdvcmQnLCBcIkRlbGV0ZSBXb3JkXCIpLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB3b3JkU2VwYXJhdG9ycyA9IGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSwgZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ud29yZFNlZ21lbnRlckxvY2FsZXMpKTtcblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXG5cdFx0Y29uc3QgY29tbWFuZHMgPSBzZWxlY3Rpb25zLm1hcCgoc2VsKSA9PiB7XG5cdFx0XHRjb25zdCBkZWxldGVSYW5nZSA9IFdvcmRPcGVyYXRpb25zLmRlbGV0ZUluc2lkZVdvcmQod29yZFNlcGFyYXRvcnMsIG1vZGVsLCBzZWwpO1xuXHRcdFx0cmV0dXJuIG5ldyBSZXBsYWNlQ29tbWFuZChkZWxldGVSYW5nZSwgJycpO1xuXHRcdH0pO1xuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgY29tbWFuZHMpO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvcldvcmRTdGFydExlZnQoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvcldvcmRFbmRMZWZ0KCkpO1xucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDdXJzb3JXb3JkTGVmdCgpKTtcbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yV29yZFN0YXJ0TGVmdFNlbGVjdCgpKTtcbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yV29yZEVuZExlZnRTZWxlY3QoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvcldvcmRMZWZ0U2VsZWN0KCkpO1xucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDdXJzb3JXb3JkU3RhcnRSaWdodCgpKTtcbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yV29yZEVuZFJpZ2h0KCkpO1xucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDdXJzb3JXb3JkUmlnaHQoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvcldvcmRTdGFydFJpZ2h0U2VsZWN0KCkpO1xucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDdXJzb3JXb3JkRW5kUmlnaHRTZWxlY3QoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvcldvcmRSaWdodFNlbGVjdCgpKTtcbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yV29yZEFjY2Vzc2liaWxpdHlMZWZ0KCkpO1xucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnRTZWxlY3QoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHQoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHRTZWxlY3QoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IERlbGV0ZVdvcmRTdGFydExlZnQoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IERlbGV0ZVdvcmRFbmRMZWZ0KCkpO1xucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBEZWxldGVXb3JkTGVmdCgpKTtcbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRGVsZXRlV29yZFN0YXJ0UmlnaHQoKSk7XG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IERlbGV0ZVdvcmRFbmRSaWdodCgpKTtcbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRGVsZXRlV29yZFJpZ2h0KCkpO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oRGVsZXRlSW5zaWRlV29yZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFNBQVMsY0FBYztBQUVoQyxTQUFTLGNBQWMsZUFBZ0Msc0JBQXNCLDZCQUErQztBQUM1SCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGNBQWMscUJBQXFCO0FBQzVDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQTRCLG9CQUFvQixzQkFBc0I7QUFDdEUsU0FBUywrQkFBd0Q7QUFDakUsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMscUNBQXFDO0FBQzlDLFlBQVksU0FBUztBQUNyQixTQUFTLDBDQUEwQztBQUNuRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQU8xQixNQUFlLHdCQUF3QixjQUFjO0FBQUEsRUFLM0QsWUFBWSxNQUF1QjtBQUNsQyxVQUFNLElBQUk7QUFDVixTQUFLLG1CQUFtQixLQUFLO0FBQzdCLFNBQUssc0JBQXNCLEtBQUs7QUFBQSxFQUNqQztBQUFBLEVBRU8saUJBQWlCLFVBQTRCLFFBQXFCLE1BQWlCO0FBQ3pGLFFBQUksQ0FBQyxPQUFPLFNBQVMsR0FBRztBQUN2QjtBQUFBLElBQ0Q7QUFDQSxVQUFNLGlCQUFpQix3QkFBd0IsT0FBTyxVQUFVLGFBQWEsY0FBYyxHQUFHLE9BQU8sVUFBVSxhQUFhLG9CQUFvQixDQUFDO0FBQ2pKLFVBQU0sUUFBUSxPQUFPLFNBQVM7QUFDOUIsVUFBTSxhQUFhLE9BQU8sY0FBYztBQUN4QyxVQUFNLGlCQUFpQixXQUFX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
