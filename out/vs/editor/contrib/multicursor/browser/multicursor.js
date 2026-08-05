var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Constants } from "../../../../base/common/uint.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { CursorChangeReason } from "../../../common/cursorEvents.js";
import { CursorMoveCommands } from "../../../common/cursor/cursorMoveCommands.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { CommonFindController } from "../../find/browser/findController.js";
import { FindOptionOverride } from "../../find/browser/findState.js";
import * as nls from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { getSelectionHighlightDecorationOptions } from "../../wordHighlighter/browser/highlightDecorations.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
function announceCursorChange(previousCursorState, cursorState) {
  const cursorDiff = cursorState.filter((cs) => !previousCursorState.find((pcs) => pcs.equals(cs)));
  if (cursorDiff.length >= 1) {
    const cursorPositions = cursorDiff.map((cs) => `line ${cs.viewState.position.lineNumber} column ${cs.viewState.position.column}`).join(", ");
    const msg = cursorDiff.length === 1 ? nls.localize("cursorAdded", "Cursor added: {0}", cursorPositions) : nls.localize("cursorsAdded", "Cursors added: {0}", cursorPositions);
    status(msg);
  }
}
class InsertCursorAbove extends EditorAction {
  constructor() {
    super({
      id: "editor.action.insertCursorAbove",
      label: nls.localize2("mutlicursor.insertAbove", "Add Cursor Above"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.UpArrow,
        linux: {
          primary: KeyMod.Shift | KeyMod.Alt | KeyCode.UpArrow,
          secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow]
        },
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "3_multi",
        title: nls.localize({ key: "miInsertCursorAbove", comment: ["&& denotes a mnemonic"] }, "&&Add Cursor Above"),
        order: 2
      }
    });
  }
  run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    let useLogicalLine = true;
    if (args && args.logicalLine === false) {
      useLogicalLine = false;
    }
    const viewModel = editor._getViewModel();
    if (viewModel.cursorConfig.readOnly) {
      return;
    }
    viewModel.model.pushStackElement();
    const previousCursorState = viewModel.getCursorStates();
    viewModel.setCursorStates(
      args.source,
      CursorChangeReason.Explicit,
      CursorMoveCommands.addCursorUp(viewModel, previousCursorState, useLogicalLine)
    );
    viewModel.revealTopMostCursor(args.source);
    announceCursorChange(previousCursorState, viewModel.getCursorStates());
  }
}
class InsertCursorBelow extends EditorAction {
  constructor() {
    super({
      id: "editor.action.insertCursorBelow",
      label: nls.localize2("mutlicursor.insertBelow", "Add Cursor Below"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.DownArrow,
        linux: {
          primary: KeyMod.Shift | KeyMod.Alt | KeyCode.DownArrow,
          secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow]
        },
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "3_multi",
        title: nls.localize({ key: "miInsertCursorBelow", comment: ["&& denotes a mnemonic"] }, "A&&dd Cursor Below"),
        order: 3
      }
    });
  }
  run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    let useLogicalLine = true;
    if (args && args.logicalLine === false) {
      useLogicalLine = false;
    }
    const viewModel = editor._getViewModel();
    if (viewModel.cursorConfig.readOnly) {
      return;
    }
    viewModel.model.pushStackElement();
    const previousCursorState = viewModel.getCursorStates();
    viewModel.setCursorStates(
      args.source,
      CursorChangeReason.Explicit,
      CursorMoveCommands.addCursorDown(viewModel, previousCursorState, useLogicalLine)
    );
    viewModel.revealBottomMostCursor(args.source);
    announceCursorChange(previousCursorState, viewModel.getCursorStates());
  }
}
class InsertCursorAtEndOfEachLineSelected extends EditorAction {
  constructor() {
    super({
      id: "editor.action.insertCursorAtEndOfEachLineSelected",
      label: nls.localize2("mutlicursor.insertAtEndOfEachLineSelected", "Add Cursors to Line Ends"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyI,
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "3_multi",
        title: nls.localize({ key: "miInsertCursorAtEndOfEachLineSelected", comment: ["&& denotes a mnemonic"] }, "Add C&&ursors to Line Ends"),
        order: 4
      }
    });
  }
  getCursorsForSelection(selection, model, result) {
    if (selection.isEmpty()) {
      return;
    }
    for (let i = selection.startLineNumber; i < selection.endLineNumber; i++) {
      const currentLineMaxColumn = model.getLineMaxColumn(i);
      result.push(new Selection(i, currentLineMaxColumn, i, currentLineMaxColumn));
    }
    if (selection.endColumn > 1) {
      result.push(new Selection(selection.endLineNumber, selection.endColumn, selection.endLineNumber, selection.endColumn));
    }
  }
  run(accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const model = editor.getModel();
    const selections = editor.getSelections();
    const viewModel = editor._getViewModel();
    const previousCursorState = viewModel.getCursorStates();
    const newSelections = [];
    selections.forEach((sel) => this.getCursorsForSelection(sel, model, newSelections));
    if (newSelections.length > 0) {
      editor.setSelections(newSelections);
    }
    announceCursorChange(previousCursorState, viewModel.getCursorStates());
  }
}
class InsertCursorAtEndOfLineSelected extends EditorAction {
  constructor() {
    super({
      id: "editor.action.addCursorsToBottom",
      label: nls.localize2("mutlicursor.addCursorsToBottom", "Add Cursors to Bottom"),
      precondition: void 0
    });
  }
  run(accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const selections = editor.getSelections();
    const lineCount = editor.getModel().getLineCount();
    const newSelections = [];
    for (let i = selections[0].startLineNumber; i <= lineCount; i++) {
      newSelections.push(new Selection(i, selections[0].startColumn, i, selections[0].endColumn));
    }
    const viewModel = editor._getViewModel();
    const previousCursorState = viewModel.getCursorStates();
    if (newSelections.length > 0) {
      editor.setSelections(newSelections);
    }
    announceCursorChange(previousCursorState, viewModel.getCursorStates());
  }
}
class InsertCursorAtTopOfLineSelected extends EditorAction {
  constructor() {
    super({
      id: "editor.action.addCursorsToTop",
      label: nls.localize2("mutlicursor.addCursorsToTop", "Add Cursors to Top"),
      precondition: void 0
    });
  }
  run(accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const selections = editor.getSelections();
    const newSelections = [];
    for (let i = selections[0].startLineNumber; i >= 1; i--) {
      newSelections.push(new Selection(i, selections[0].startColumn, i, selections[0].endColumn));
    }
    const viewModel = editor._getViewModel();
    const previousCursorState = viewModel.getCursorStates();
    if (newSelections.length > 0) {
      editor.setSelections(newSelections);
    }
    announceCursorChange(previousCursorState, viewModel.getCursorStates());
  }
}
class MultiCursorSessionResult {
  constructor(selections, revealRange, revealScrollType) {
    this.selections = selections;
    this.revealRange = revealRange;
    this.revealScrollType = revealScrollType;
  }
}
class MultiCursorSession {
  constructor(_editor, findController, isDisconnectedFromFindController, searchText, wholeWord, matchCase, currentMatch) {
    this._editor = _editor;
    this.findController = findController;
    this.isDisconnectedFromFindController = isDisconnectedFromFindController;
    this.searchText = searchText;
    this.wholeWord = wholeWord;
    this.matchCase = matchCase;
    this.currentMatch = currentMatch;
  }
  static create(editor, findController) {
    if (!editor.hasModel()) {
      return null;
    }
    const findState = findController.getState();
    if (!editor.hasTextFocus() && findState.isRevealed && findState.searchString.length > 0) {
      return new MultiCursorSession(editor, findController, false, findState.searchString, findState.wholeWord, findState.matchCase, null);
    }
    let isDisconnectedFromFindController = false;
    let wholeWord;
    let matchCase;
    const selections = editor.getSelections();
    if (selections.length === 1 && selections[0].isEmpty()) {
      isDisconnectedFromFindController = true;
      wholeWord = true;
      matchCase = true;
    } else {
      wholeWord = findState.wholeWord;
      matchCase = findState.matchCase;
    }
    const s = editor.getSelection();
    let searchText;
    let currentMatch = null;
    if (s.isEmpty()) {
      const word = editor.getConfiguredWordAtPosition(s.getStartPosition());
      if (!word) {
        return null;
      }
      searchText = word.word;
      currentMatch = new Selection(s.startLineNumber, word.startColumn, s.startLineNumber, word.endColumn);
    } else {
      searchText = editor.getModel().getValueInRange(s).replace(/\r\n/g, "\n");
    }
    return new MultiCursorSession(editor, findController, isDisconnectedFromFindController, searchText, wholeWord, matchCase, currentMatch);
  }
  addSelectionToNextFindMatch() {
    if (!this._editor.hasModel()) {
      return null;
    }
    const nextMatch = this._getNextMatch();
    if (!nextMatch) {
      return null;
    }
    const allSelections = this._editor.getSelections();
    return new MultiCursorSessionResult(allSelections.concat(nextMatch), nextMatch, ScrollType.Smooth);
  }
  moveSelectionToNextFindMatch() {
    if (!this._editor.hasModel()) {
      return null;
    }
    const nextMatch = this._getNextMatch();
    if (!nextMatch) {
      return null;
    }
    const allSelections = this._editor.getSelections();
    return new MultiCursorSessionResult(allSelections.slice(0, allSelections.length - 1).concat(nextMatch), nextMatch, ScrollType.Smooth);
  }
  _getNextMatch() {
    if (!this._editor.hasModel()) {
      return null;
    }
    if (this.currentMatch) {
      const result = this.currentMatch;
      this.currentMatch = null;
      return result;
    }
    this.findController.highlightFindOptions();
    const allSelections = this._editor.getSelections();
    const lastAddedSelection = allSelections[allSelections.length - 1];
    const nextMatch = this._editor.getModel().findNextMatch(this.searchText, lastAddedSelection.getEndPosition(), false, this.matchCase, this.wholeWord ? this._editor.getOption(EditorOption.wordSeparators) : null, false);
    if (!nextMatch) {
      return null;
    }
    return new Selection(nextMatch.range.startLineNumber, nextMatch.range.startColumn, nextMatch.range.endLineNumber, nextMatch.range.endColumn);
  }
  addSelectionToPreviousFindMatch() {
    if (!this._editor.hasModel()) {
      return null;
    }
    const previousMatch = this._getPreviousMatch();
    if (!previousMatch) {
      return null;
    }
    const allSelections = this._editor.getSelections();
    return new MultiCursorSessionResult(allSelections.concat(previousMatch), previousMatch, ScrollType.Smooth);
  }
  moveSelectionToPreviousFindMatch() {
    if (!this._editor.hasModel()) {
      return null;
    }
    const previousMatch = this._getPreviousMatch();
    if (!previousMatch) {
      return null;
    }
    const allSelections = this._editor.getSelections();
    return new MultiCursorSessionResult(allSelections.slice(0, allSelections.length - 1).concat(previousMatch), previousMatch, ScrollType.Smooth);
  }
  _getPreviousMatch() {
    if (!this._editor.hasModel()) {
      return null;
    }
    if (this.currentMatch) {
      const result = this.currentMatch;
      this.currentMatch = null;
      return result;
    }
    this.findController.highlightFindOptions();
    const allSelections = this._editor.getSelections();
    const lastAddedSelection = allSelections[allSelections.length - 1];
    const previousMatch = this._editor.getModel().findPreviousMatch(this.searchText, lastAddedSelection.getStartPosition(), false, this.matchCase, this.wholeWord ? this._editor.getOption(EditorOption.wordSeparators) : null, false);
    if (!previousMatch) {
      return null;
    }
    return new Selection(previousMatch.range.startLineNumber, previousMatch.range.startColumn, previousMatch.range.endLineNumber, previousMatch.range.endColumn);
  }
  selectAll(searchScope) {
    if (!this._editor.hasModel()) {
      return [];
    }
    this.findController.highlightFindOptions();
    const editorModel = this._editor.getModel();
    if (searchScope) {
      return editorModel.findMatches(this.searchText, searchScope, false, this.matchCase, this.wholeWord ? this._editor.getOption(EditorOption.wordSeparators) : null, false, Constants.MAX_SAFE_SMALL_INTEGER);
    }
    return editorModel.findMatches(this.searchText, true, false, this.matchCase, this.wholeWord ? this._editor.getOption(EditorOption.wordSeparators) : null, false, Constants.MAX_SAFE_SMALL_INTEGER);
  }
}
const _MultiCursorSelectionController = class _MultiCursorSelectionController extends Disposable {
  constructor(editor) {
    super();
    this._sessionDispose = this._register(new DisposableStore());
    this._editor = editor;
    this._ignoreSelectionChange = false;
    this._session = null;
  }
  static get(editor) {
    return editor.getContribution(_MultiCursorSelectionController.ID);
  }
  dispose() {
    this._endSession();
    super.dispose();
  }
  _beginSessionIfNeeded(findController) {
    if (!this._session) {
      const session = MultiCursorSession.create(this._editor, findController);
      if (!session) {
        return;
      }
      this._session = session;
      const newState = { searchString: this._session.searchText };
      if (this._session.isDisconnectedFromFindController) {
        newState.wholeWordOverride = FindOptionOverride.True;
        newState.matchCaseOverride = FindOptionOverride.True;
        newState.isRegexOverride = FindOptionOverride.False;
      }
      findController.getState().change(newState, false);
      this._sessionDispose.add(this._editor.onDidChangeCursorSelection((e) => {
        if (this._ignoreSelectionChange) {
          return;
        }
        this._endSession();
      }));
      this._sessionDispose.add(this._editor.onDidBlurEditorText(() => {
        this._endSession();
      }));
      this._sessionDispose.add(findController.getState().onFindReplaceStateChange((e) => {
        if (e.matchCase || e.wholeWord) {
          this._endSession();
        }
      }));
    }
  }
  _endSession() {
    this._sessionDispose.clear();
    if (this._session && this._session.isDisconnectedFromFindController) {
      const newState = {
        wholeWordOverride: FindOptionOverride.NotSet,
        matchCaseOverride: FindOptionOverride.NotSet,
        isRegexOverride: FindOptionOverride.NotSet
      };
      this._session.findController.getState().change(newState, false);
    }
    this._session = null;
  }
  _setSelections(selections) {
    this._ignoreSelectionChange = true;
    this._editor.setSelections(selections);
    this._ignoreSelectionChange = false;
  }
  _expandEmptyToWord(model, selection) {
    if (!selection.isEmpty()) {
      return selection;
    }
    const word = this._editor.getConfiguredWordAtPosition(selection.getStartPosition());
    if (!word) {
      return selection;
    }
    return new Selection(selection.startLineNumber, word.startColumn, selection.startLineNumber, word.endColumn);
  }
  _applySessionResult(result) {
    if (!result) {
      return;
    }
    this._setSelections(result.selections);
    if (result.revealRange) {
      this._editor.revealRangeInCenterIfOutsideViewport(result.revealRange, result.revealScrollType);
    }
  }
  getSession(findController) {
    return this._session;
  }
  addSelectionToNextFindMatch(findController) {
    if (!this._editor.hasModel()) {
      return;
    }
    if (!this._session) {
      const allSelections = this._editor.getSelections();
      if (allSelections.length > 1) {
        const findState = findController.getState();
        const matchCase = findState.matchCase;
        const selectionsContainSameText = modelRangesContainSameText(this._editor.getModel(), allSelections, matchCase);
        if (!selectionsContainSameText) {
          const model = this._editor.getModel();
          const resultingSelections = [];
          for (let i = 0, len = allSelections.length; i < len; i++) {
            resultingSelections[i] = this._expandEmptyToWord(model, allSelections[i]);
          }
          this._editor.setSelections(resultingSelections);
          return;
        }
      }
    }
    this._beginSessionIfNeeded(findController);
    if (this._session) {
      this._applySessionResult(this._session.addSelectionToNextFindMatch());
    }
  }
  addSelectionToPreviousFindMatch(findController) {
    this._beginSessionIfNeeded(findController);
    if (this._session) {
      this._applySessionResult(this._session.addSelectionToPreviousFindMatch());
    }
  }
  moveSelectionToNextFindMatch(findController) {
    this._beginSessionIfNeeded(findController);
    if (this._session) {
      this._applySessionResult(this._session.moveSelectionToNextFindMatch());
    }
  }
  moveSelectionToPreviousFindMatch(findController) {
    this._beginSessionIfNeeded(findController);
    if (this._session) {
      this._applySessionResult(this._session.moveSelectionToPreviousFindMatch());
    }
  }
  selectAll(findController) {
    if (!this._editor.hasModel()) {
      return;
    }
    let matches = null;
    const findState = findController.getState();
    if (findState.isRevealed && findState.searchString.length > 0 && findState.isRegex) {
      const editorModel = this._editor.getModel();
      if (findState.searchScope) {
        matches = editorModel.findMatches(findState.searchString, findState.searchScope, findState.isRegex, findState.matchCase, findState.wholeWord ? this._editor.getOption(EditorOption.wordSeparators) : null, false, Constants.MAX_SAFE_SMALL_INTEGER);
      } else {
        matches = editorModel.findMatches(findState.searchString, true, findState.isRegex, findState.matchCase, findState.wholeWord ? this._editor.getOption(EditorOption.wordSeparators) : null, false, Constants.MAX_SAFE_SMALL_INTEGER);
      }
    } else {
      this._beginSessionIfNeeded(findController);
      if (!this._session) {
        return;
      }
      matches = this._session.selectAll(findState.searchScope);
    }
    if (matches.length > 0) {
      const editorSelection = this._editor.getSelection();
      for (let i = 0, len = matches.length; i < len; i++) {
        const match = matches[i];
        const intersection = match.range.intersectRanges(editorSelection);
        if (intersection) {
          matches[i] = matches[0];
          matches[0] = match;
          break;
        }
      }
      this._setSelections(matches.map((m) => new Selection(m.range.startLineNumber, m.range.startColumn, m.range.endLineNumber, m.range.endColumn)));
    }
  }
  selectAllUsingSelections(selections) {
    if (selections.length > 0) {
      this._setSelections(selections);
    }
  }
};
_MultiCursorSelectionController.ID = "editor.contrib.multiCursorController";
let MultiCursorSelectionController = _MultiCursorSelectionController;
class MultiCursorSelectionControllerAction extends EditorAction {
  run(accessor, editor) {
    const multiCursorController = MultiCursorSelectionController.get(editor);
    if (!multiCursorController) {
      return;
    }
    const viewModel = editor._getViewModel();
    if (viewModel) {
      const previousCursorState = viewModel.getCursorStates();
      const findController = CommonFindController.get(editor);
      if (findController) {
        this._run(multiCursorController, findController);
      } else {
        const newFindController = accessor.get(IInstantiationService).createInstance(CommonFindController, editor);
        this._run(multiCursorController, newFindController);
        newFindController.dispose();
      }
      announceCursorChange(previousCursorState, viewModel.getCursorStates());
    }
  }
}
class AddSelectionToNextFindMatchAction extends MultiCursorSelectionControllerAction {
  constructor() {
    super({
      id: "editor.action.addSelectionToNextFindMatch",
      label: nls.localize2("addSelectionToNextFindMatch", "Add Selection to Next Find Match"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyCode.KeyD,
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "3_multi",
        title: nls.localize({ key: "miAddSelectionToNextFindMatch", comment: ["&& denotes a mnemonic"] }, "Add &&Next Occurrence"),
        order: 5
      }
    });
  }
  _run(multiCursorController, findController) {
    multiCursorController.addSelectionToNextFindMatch(findController);
  }
}
class AddSelectionToPreviousFindMatchAction extends MultiCursorSelectionControllerAction {
  constructor() {
    super({
      id: "editor.action.addSelectionToPreviousFindMatch",
      label: nls.localize2("addSelectionToPreviousFindMatch", "Add Selection to Previous Find Match"),
      precondition: void 0,
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "3_multi",
        title: nls.localize({ key: "miAddSelectionToPreviousFindMatch", comment: ["&& denotes a mnemonic"] }, "Add P&&revious Occurrence"),
        order: 6
      }
    });
  }
  _run(multiCursorController, findController) {
    multiCursorController.addSelectionToPreviousFindMatch(findController);
  }
}
class MoveSelectionToNextFindMatchAction extends MultiCursorSelectionControllerAction {
  constructor() {
    super({
      id: "editor.action.moveSelectionToNextFindMatch",
      label: nls.localize2("moveSelectionToNextFindMatch", "Move Last Selection to Next Find Match"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyD),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  _run(multiCursorController, findController) {
    multiCursorController.moveSelectionToNextFindMatch(findController);
  }
}
class MoveSelectionToPreviousFindMatchAction extends MultiCursorSelectionControllerAction {
  constructor() {
    super({
      id: "editor.action.moveSelectionToPreviousFindMatch",
      label: nls.localize2("moveSelectionToPreviousFindMatch", "Move Last Selection to Previous Find Match"),
      precondition: void 0
    });
  }
  _run(multiCursorController, findController) {
    multiCursorController.moveSelectionToPreviousFindMatch(findController);
  }
}
class SelectHighlightsAction extends MultiCursorSelectionControllerAction {
  constructor() {
    super({
      id: "editor.action.selectHighlights",
      label: nls.localize2("selectAllOccurrencesOfFindMatch", "Select All Occurrences of Find Match"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL,
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarSelectionMenu,
        group: "3_multi",
        title: nls.localize({ key: "miSelectHighlights", comment: ["&& denotes a mnemonic"] }, "Select All &&Occurrences"),
        order: 7
      }
    });
  }
  _run(multiCursorController, findController) {
    multiCursorController.selectAll(findController);
  }
}
class CompatChangeAll extends MultiCursorSelectionControllerAction {
  constructor() {
    super({
      id: "editor.action.changeAll",
      label: nls.localize2("changeAll.label", "Change All Occurrences"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.editorTextFocus),
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyCode.F2,
        weight: KeybindingWeight.EditorContrib
      },
      contextMenuOpts: {
        group: "1_modification",
        order: 1.2
      }
    });
  }
  _run(multiCursorController, findController) {
    multiCursorController.selectAll(findController);
  }
}
class SelectionHighlighterState {
  constructor(_model, _searchText, _matchCase, _wordSeparators, prevState) {
    this._model = _model;
    this._searchText = _searchText;
    this._matchCase = _matchCase;
    this._wordSeparators = _wordSeparators;
    this._cachedFindMatches = null;
    this._modelVersionId = this._model.getVersionId();
    if (prevState && this._model === prevState._model && this._searchText === prevState._searchText && this._matchCase === prevState._matchCase && this._wordSeparators === prevState._wordSeparators && this._modelVersionId === prevState._modelVersionId) {
      this._cachedFindMatches = prevState._cachedFindMatches;
    }
  }
  findMatches() {
    if (this._cachedFindMatches === null) {
      this._cachedFindMatches = this._model.findMatches(this._searchText, true, false, this._matchCase, this._wordSeparators, false).map((m) => m.range);
      this._cachedFindMatches.sort(Range.compareRangesUsingStarts);
    }
    return this._cachedFindMatches;
  }
}
let SelectionHighlighter = class extends Disposable {
  constructor(editor, _languageFeaturesService) {
    super();
    this._languageFeaturesService = _languageFeaturesService;
    this.editor = editor;
    this._isEnabled = editor.getOption(EditorOption.selectionHighlight);
    this._decorations = editor.createDecorationsCollection();
    this.updateSoon = this._register(new RunOnceScheduler(() => this._update(), 300));
    this.state = null;
    this._register(editor.onDidChangeConfiguration((e) => {
      this._isEnabled = editor.getOption(EditorOption.selectionHighlight);
    }));
    this._register(editor.onDidChangeCursorSelection((e) => {
      if (!this._isEnabled) {
        return;
      }
      if (e.selection.isEmpty()) {
        if (e.reason === CursorChangeReason.Explicit) {
          if (this.state) {
            this._setState(null);
          }
          this.updateSoon.schedule();
        } else {
          this._setState(null);
        }
      } else {
        this._update();
      }
    }));
    this._register(editor.onDidChangeModel((e) => {
      this._setState(null);
    }));
    this._register(editor.onDidChangeModelContent((e) => {
      if (this._isEnabled) {
        this.updateSoon.schedule();
      }
    }));
    const findController = CommonFindController.get(editor);
    if (findController) {
      this._register(findController.getState().onFindReplaceStateChange((e) => {
        this._update();
      }));
    }
    this.updateSoon.schedule();
  }
  _update() {
    this._setState(SelectionHighlighter._createState(this.state, this._isEnabled, this.editor));
  }
  static _createState(oldState, isEnabled, editor) {
    if (!isEnabled) {
      return null;
    }
    if (!editor.hasModel()) {
      return null;
    }
    const s = editor.getSelection();
    if (s.startLineNumber !== s.endLineNumber) {
      return null;
    }
    const multiCursorController = MultiCursorSelectionController.get(editor);
    if (!multiCursorController) {
      return null;
    }
    const findController = CommonFindController.get(editor);
    if (!findController) {
      return null;
    }
    let r = multiCursorController.getSession(findController);
    if (!r) {
      const allSelections = editor.getSelections();
      if (allSelections.length > 1) {
        const findState2 = findController.getState();
        const matchCase = findState2.matchCase;
        const selectionsContainSameText = modelRangesContainSameText(editor.getModel(), allSelections, matchCase);
        if (!selectionsContainSameText) {
          return null;
        }
      }
      r = MultiCursorSession.create(editor, findController);
    }
    if (!r) {
      return null;
    }
    if (r.currentMatch) {
      return null;
    }
    if (/^[ \t]+$/.test(r.searchText)) {
      return null;
    }
    if (r.searchText.length > 200) {
      return null;
    }
    const findState = findController.getState();
    const caseSensitive = findState.matchCase;
    if (findState.isRevealed) {
      let findStateSearchString = findState.searchString;
      if (!caseSensitive) {
        findStateSearchString = findStateSearchString.toLowerCase();
      }
      let mySearchString = r.searchText;
      if (!caseSensitive) {
        mySearchString = mySearchString.toLowerCase();
      }
      if (findStateSearchString === mySearchString && r.matchCase === findState.matchCase && r.wholeWord === findState.wholeWord && !findState.isRegex) {
        return null;
      }
    }
    return new SelectionHighlighterState(editor.getModel(), r.searchText, r.matchCase, r.wholeWord ? editor.getOption(EditorOption.wordSeparators) : null, oldState);
  }
  _setState(newState) {
    this.state = newState;
    if (!this.state) {
      this._decorations.clear();
      return;
    }
    if (!this.editor.hasModel()) {
      return;
    }
    const model = this.editor.getModel();
    if (model.isTooLargeForTokenization()) {
      return;
    }
    const allMatches = this.state.findMatches();
    const selections = this.editor.getSelections();
    selections.sort(Range.compareRangesUsingStarts);
    const matches = [];
    for (let i = 0, j = 0, len = allMatches.length, lenJ = selections.length; i < len; ) {
      const match = allMatches[i];
      if (j >= lenJ) {
        matches.push(match);
        i++;
      } else {
        const cmp = Range.compareRangesUsingStarts(match, selections[j]);
        if (cmp < 0) {
          if (selections[j].isEmpty() || !Range.areIntersecting(match, selections[j])) {
            matches.push(match);
          }
          i++;
        } else if (cmp > 0) {
          j++;
        } else {
          i++;
          j++;
        }
      }
    }
    const occurrenceHighlighting = this.editor.getOption(EditorOption.occurrencesHighlight) !== "off";
    const hasSemanticHighlights = this._languageFeaturesService.documentHighlightProvider.has(model) && occurrenceHighlighting;
    const decorations = matches.map((r) => {
      return {
        range: r,
        options: getSelectionHighlightDecorationOptions(hasSemanticHighlights)
      };
    });
    this._decorations.set(decorations);
  }
  dispose() {
    this._setState(null);
    super.dispose();
  }
};
SelectionHighlighter.ID = "editor.contrib.selectionHighlighter";
SelectionHighlighter = __decorateClass([
  __decorateParam(1, ILanguageFeaturesService)
], SelectionHighlighter);
function modelRangesContainSameText(model, ranges, matchCase) {
  const selectedText = getValueInRange(model, ranges[0], !matchCase);
  for (let i = 1, len = ranges.length; i < len; i++) {
    const range = ranges[i];
    if (range.isEmpty()) {
      return false;
    }
    const thisSelectedText = getValueInRange(model, range, !matchCase);
    if (selectedText !== thisSelectedText) {
      return false;
    }
  }
  return true;
}
function getValueInRange(model, range, toLowerCase) {
  const text = model.getValueInRange(range);
  return toLowerCase ? text.toLowerCase() : text;
}
class FocusNextCursor extends EditorAction {
  constructor() {
    super({
      id: "editor.action.focusNextCursor",
      label: nls.localize2("mutlicursor.focusNextCursor", "Focus Next Cursor"),
      metadata: {
        description: nls.localize("mutlicursor.focusNextCursor.description", "Focuses the next cursor"),
        args: []
      },
      precondition: void 0
    });
  }
  run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    const viewModel = editor._getViewModel();
    if (viewModel.cursorConfig.readOnly) {
      return;
    }
    viewModel.model.pushStackElement();
    const previousCursorState = Array.from(viewModel.getCursorStates());
    const firstCursor = previousCursorState.shift();
    if (!firstCursor) {
      return;
    }
    previousCursorState.push(firstCursor);
    viewModel.setCursorStates(args.source, CursorChangeReason.Explicit, previousCursorState);
    viewModel.revealPrimaryCursor(args.source, true);
    announceCursorChange(previousCursorState, viewModel.getCursorStates());
  }
}
class FocusPreviousCursor extends EditorAction {
  constructor() {
    super({
      id: "editor.action.focusPreviousCursor",
      label: nls.localize2("mutlicursor.focusPreviousCursor", "Focus Previous Cursor"),
      metadata: {
        description: nls.localize("mutlicursor.focusPreviousCursor.description", "Focuses the previous cursor"),
        args: []
      },
      precondition: void 0
    });
  }
  run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    const viewModel = editor._getViewModel();
    if (viewModel.cursorConfig.readOnly) {
      return;
    }
    viewModel.model.pushStackElement();
    const previousCursorState = Array.from(viewModel.getCursorStates());
    const firstCursor = previousCursorState.pop();
    if (!firstCursor) {
      return;
    }
    previousCursorState.unshift(firstCursor);
    viewModel.setCursorStates(args.source, CursorChangeReason.Explicit, previousCursorState);
    viewModel.revealPrimaryCursor(args.source, true);
    announceCursorChange(previousCursorState, viewModel.getCursorStates());
  }
}
registerEditorContribution(MultiCursorSelectionController.ID, MultiCursorSelectionController, EditorContributionInstantiation.Lazy);
registerEditorContribution(SelectionHighlighter.ID, SelectionHighlighter, EditorContributionInstantiation.AfterFirstRender);
registerEditorAction(InsertCursorAbove);
registerEditorAction(InsertCursorBelow);
registerEditorAction(InsertCursorAtEndOfEachLineSelected);
registerEditorAction(AddSelectionToNextFindMatchAction);
registerEditorAction(AddSelectionToPreviousFindMatchAction);
registerEditorAction(MoveSelectionToNextFindMatchAction);
registerEditorAction(MoveSelectionToPreviousFindMatchAction);
registerEditorAction(SelectHighlightsAction);
registerEditorAction(CompatChangeAll);
registerEditorAction(InsertCursorAtEndOfLineSelected);
registerEditorAction(InsertCursorAtTopOfLineSelected);
registerEditorAction(FocusNextCursor);
registerEditorAction(FocusPreviousCursor);
export {
  AddSelectionToNextFindMatchAction,
  AddSelectionToPreviousFindMatchAction,
  CompatChangeAll,
  FocusNextCursor,
  FocusPreviousCursor,
  InsertCursorAbove,
  InsertCursorBelow,
  MoveSelectionToNextFindMatchAction,
  MoveSelectionToPreviousFindMatchAction,
  MultiCursorSelectionController,
  MultiCursorSelectionControllerAction,
  MultiCursorSession,
  MultiCursorSessionResult,
  SelectHighlightsAction,
  SelectionHighlighter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9tdWx0aWN1cnNvci9icm93c2VyL211bHRpY3Vyc29yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgc3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91aW50LmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBDdXJzb3JTdGF0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jdXJzb3JDb21tb24uanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ2hhbmdlUmVhc29uLCBJQ3Vyc29yU2VsZWN0aW9uQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBDdXJzb3JNb3ZlQ29tbWFuZHMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY3Vyc29yL2N1cnNvck1vdmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uLCBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uLCBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBGaW5kTWF0Y2gsIElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgQ29tbW9uRmluZENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9maW5kL2Jyb3dzZXIvZmluZENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRmluZE9wdGlvbk92ZXJyaWRlLCBJTmV3RmluZFJlcGxhY2VTdGF0ZSB9IGZyb20gJy4uLy4uL2ZpbmQvYnJvd3Nlci9maW5kU3RhdGUuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBnZXRTZWxlY3Rpb25IaWdobGlnaHREZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uL3dvcmRIaWdobGlnaHRlci9icm93c2VyL2hpZ2hsaWdodERlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuXG5mdW5jdGlvbiBhbm5vdW5jZUN1cnNvckNoYW5nZShwcmV2aW91c0N1cnNvclN0YXRlOiBDdXJzb3JTdGF0ZVtdLCBjdXJzb3JTdGF0ZTogQ3Vyc29yU3RhdGVbXSk6IHZvaWQge1xuXHRjb25zdCBjdXJzb3JEaWZmID0gY3Vyc29yU3RhdGUuZmlsdGVyKGNzID0+ICFwcmV2aW91c0N1cnNvclN0YXRlLmZpbmQocGNzID0+IHBjcy5lcXVhbHMoY3MpKSk7XG5cdGlmIChjdXJzb3JEaWZmLmxlbmd0aCA+PSAxKSB7XG5cdFx0Y29uc3QgY3Vyc29yUG9zaXRpb25zID0gY3Vyc29yRGlmZi5tYXAoY3MgPT4gYGxpbmUgJHtjcy52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlcn0gY29sdW1uICR7Y3Mudmlld1N0YXRlLnBvc2l0aW9uLmNvbHVtbn1gKS5qb2luKCcsICcpO1xuXHRcdGNvbnN0IG1zZyA9IGN1cnNvckRpZmYubGVuZ3RoID09PSAxID8gbmxzLmxvY2FsaXplKCdjdXJzb3JBZGRlZCcsIFwiQ3Vyc29yIGFkZGVkOiB7MH1cIiwgY3Vyc29yUG9zaXRpb25zKSA6IG5scy5sb2NhbGl6ZSgnY3Vyc29yc0FkZGVkJywgXCJDdXJzb3JzIGFkZGVkOiB7MH1cIiwgY3Vyc29yUG9zaXRpb25zKTtcblx0XHRzdGF0dXMobXNnKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5zZXJ0Q3Vyc29yQWJvdmUgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5pbnNlcnRDdXJzb3JBYm92ZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbXV0bGljdXJzb3IuaW5zZXJ0QWJvdmUnLCBcIkFkZCBDdXJzb3IgQWJvdmVcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5VcEFycm93LFxuXHRcdFx0XHRsaW51eDoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlVwQXJyb3csXG5cdFx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlVwQXJyb3ddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudU9wdHM6IHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhclNlbGVjdGlvbk1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnM19tdWx0aScsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUluc2VydEN1cnNvckFib3ZlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQWRkIEN1cnNvciBBYm92ZVwiKSxcblx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgdXNlTG9naWNhbExpbmUgPSB0cnVlO1xuXHRcdGlmIChhcmdzICYmIGFyZ3MubG9naWNhbExpbmUgPT09IGZhbHNlKSB7XG5cdFx0XHR1c2VMb2dpY2FsTGluZSA9IGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCB2aWV3TW9kZWwgPSBlZGl0b3IuX2dldFZpZXdNb2RlbCgpO1xuXG5cdFx0aWYgKHZpZXdNb2RlbC5jdXJzb3JDb25maWcucmVhZE9ubHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdGNvbnN0IHByZXZpb3VzQ3Vyc29yU3RhdGUgPSB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCk7XG5cdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0Q3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0LFxuXHRcdFx0Q3Vyc29yTW92ZUNvbW1hbmRzLmFkZEN1cnNvclVwKHZpZXdNb2RlbCwgcHJldmlvdXNDdXJzb3JTdGF0ZSwgdXNlTG9naWNhbExpbmUpXG5cdFx0KTtcblx0XHR2aWV3TW9kZWwucmV2ZWFsVG9wTW9zdEN1cnNvcihhcmdzLnNvdXJjZSk7XG5cdFx0YW5ub3VuY2VDdXJzb3JDaGFuZ2UocHJldmlvdXNDdXJzb3JTdGF0ZSwgdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5zZXJ0Q3Vyc29yQmVsb3cgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5pbnNlcnRDdXJzb3JCZWxvdycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbXV0bGljdXJzb3IuaW5zZXJ0QmVsb3cnLCBcIkFkZCBDdXJzb3IgQmVsb3dcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRcdGxpbnV4OiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Eb3duQXJyb3ddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudU9wdHM6IHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhclNlbGVjdGlvbk1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnM19tdWx0aScsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUluc2VydEN1cnNvckJlbG93JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkEmJmRkIEN1cnNvciBCZWxvd1wiKSxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgdXNlTG9naWNhbExpbmUgPSB0cnVlO1xuXHRcdGlmIChhcmdzICYmIGFyZ3MubG9naWNhbExpbmUgPT09IGZhbHNlKSB7XG5cdFx0XHR1c2VMb2dpY2FsTGluZSA9IGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCB2aWV3TW9kZWwgPSBlZGl0b3IuX2dldFZpZXdNb2RlbCgpO1xuXG5cdFx0aWYgKHZpZXdNb2RlbC5jdXJzb3JDb25maWcucmVhZE9ubHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdGNvbnN0IHByZXZpb3VzQ3Vyc29yU3RhdGUgPSB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCk7XG5cdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0Q3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0LFxuXHRcdFx0Q3Vyc29yTW92ZUNvbW1hbmRzLmFkZEN1cnNvckRvd24odmlld01vZGVsLCBwcmV2aW91c0N1cnNvclN0YXRlLCB1c2VMb2dpY2FsTGluZSlcblx0XHQpO1xuXHRcdHZpZXdNb2RlbC5yZXZlYWxCb3R0b21Nb3N0Q3Vyc29yKGFyZ3Muc291cmNlKTtcblx0XHRhbm5vdW5jZUN1cnNvckNoYW5nZShwcmV2aW91c0N1cnNvclN0YXRlLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkpO1xuXHR9XG59XG5cbmNsYXNzIEluc2VydEN1cnNvckF0RW5kT2ZFYWNoTGluZVNlbGVjdGVkIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5zZXJ0Q3Vyc29yQXRFbmRPZkVhY2hMaW5lU2VsZWN0ZWQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ211dGxpY3Vyc29yLmluc2VydEF0RW5kT2ZFYWNoTGluZVNlbGVjdGVkJywgXCJBZGQgQ3Vyc29ycyB0byBMaW5lIEVuZHNcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuS2V5SSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZW51T3B0czoge1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyU2VsZWN0aW9uTWVudSxcblx0XHRcdFx0Z3JvdXA6ICczX211bHRpJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pSW5zZXJ0Q3Vyc29yQXRFbmRPZkVhY2hMaW5lU2VsZWN0ZWQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiQWRkIEMmJnVyc29ycyB0byBMaW5lIEVuZHNcIiksXG5cdFx0XHRcdG9yZGVyOiA0XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEN1cnNvcnNGb3JTZWxlY3Rpb24oc2VsZWN0aW9uOiBTZWxlY3Rpb24sIG1vZGVsOiBJVGV4dE1vZGVsLCByZXN1bHQ6IFNlbGVjdGlvbltdKTogdm9pZCB7XG5cdFx0aWYgKHNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcjsgaSA8IHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRMaW5lTWF4Q29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihpKTtcblx0XHRcdHJlc3VsdC5wdXNoKG5ldyBTZWxlY3Rpb24oaSwgY3VycmVudExpbmVNYXhDb2x1bW4sIGksIGN1cnJlbnRMaW5lTWF4Q29sdW1uKSk7XG5cdFx0fVxuXHRcdGlmIChzZWxlY3Rpb24uZW5kQ29sdW1uID4gMSkge1xuXHRcdFx0cmVzdWx0LnB1c2gobmV3IFNlbGVjdGlvbihzZWxlY3Rpb24uZW5kTGluZU51bWJlciwgc2VsZWN0aW9uLmVuZENvbHVtbiwgc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIsIHNlbGVjdGlvbi5lbmRDb2x1bW4pKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gZWRpdG9yLl9nZXRWaWV3TW9kZWwoKTtcblx0XHRjb25zdCBwcmV2aW91c0N1cnNvclN0YXRlID0gdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpO1xuXHRcdGNvbnN0IG5ld1NlbGVjdGlvbnM6IFNlbGVjdGlvbltdID0gW107XG5cdFx0c2VsZWN0aW9ucy5mb3JFYWNoKChzZWwpID0+IHRoaXMuZ2V0Q3Vyc29yc0ZvclNlbGVjdGlvbihzZWwsIG1vZGVsLCBuZXdTZWxlY3Rpb25zKSk7XG5cblx0XHRpZiAobmV3U2VsZWN0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhuZXdTZWxlY3Rpb25zKTtcblx0XHR9XG5cdFx0YW5ub3VuY2VDdXJzb3JDaGFuZ2UocHJldmlvdXNDdXJzb3JTdGF0ZSwgdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpKTtcblx0fVxufVxuXG5jbGFzcyBJbnNlcnRDdXJzb3JBdEVuZE9mTGluZVNlbGVjdGVkIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uYWRkQ3Vyc29yc1RvQm90dG9tJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdtdXRsaWN1cnNvci5hZGRDdXJzb3JzVG9Cb3R0b20nLCBcIkFkZCBDdXJzb3JzIHRvIEJvdHRvbVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGNvbnN0IGxpbmVDb3VudCA9IGVkaXRvci5nZXRNb2RlbCgpLmdldExpbmVDb3VudCgpO1xuXG5cdFx0Y29uc3QgbmV3U2VsZWN0aW9uczogU2VsZWN0aW9uW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gc2VsZWN0aW9uc1swXS5zdGFydExpbmVOdW1iZXI7IGkgPD0gbGluZUNvdW50OyBpKyspIHtcblx0XHRcdG5ld1NlbGVjdGlvbnMucHVzaChuZXcgU2VsZWN0aW9uKGksIHNlbGVjdGlvbnNbMF0uc3RhcnRDb2x1bW4sIGksIHNlbGVjdGlvbnNbMF0uZW5kQ29sdW1uKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld01vZGVsID0gZWRpdG9yLl9nZXRWaWV3TW9kZWwoKTtcblx0XHRjb25zdCBwcmV2aW91c0N1cnNvclN0YXRlID0gdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpO1xuXHRcdGlmIChuZXdTZWxlY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKG5ld1NlbGVjdGlvbnMpO1xuXHRcdH1cblx0XHRhbm5vdW5jZUN1cnNvckNoYW5nZShwcmV2aW91c0N1cnNvclN0YXRlLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkpO1xuXHR9XG59XG5cbmNsYXNzIEluc2VydEN1cnNvckF0VG9wT2ZMaW5lU2VsZWN0ZWQgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5hZGRDdXJzb3JzVG9Ub3AnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ211dGxpY3Vyc29yLmFkZEN1cnNvcnNUb1RvcCcsIFwiQWRkIEN1cnNvcnMgdG8gVG9wXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cblx0XHRjb25zdCBuZXdTZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSBzZWxlY3Rpb25zWzBdLnN0YXJ0TGluZU51bWJlcjsgaSA+PSAxOyBpLS0pIHtcblx0XHRcdG5ld1NlbGVjdGlvbnMucHVzaChuZXcgU2VsZWN0aW9uKGksIHNlbGVjdGlvbnNbMF0uc3RhcnRDb2x1bW4sIGksIHNlbGVjdGlvbnNbMF0uZW5kQ29sdW1uKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld01vZGVsID0gZWRpdG9yLl9nZXRWaWV3TW9kZWwoKTtcblx0XHRjb25zdCBwcmV2aW91c0N1cnNvclN0YXRlID0gdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpO1xuXHRcdGlmIChuZXdTZWxlY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKG5ld1NlbGVjdGlvbnMpO1xuXHRcdH1cblx0XHRhbm5vdW5jZUN1cnNvckNoYW5nZShwcmV2aW91c0N1cnNvclN0YXRlLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNdWx0aUN1cnNvclNlc3Npb25SZXN1bHQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgc2VsZWN0aW9uczogU2VsZWN0aW9uW10sXG5cdFx0cHVibGljIHJlYWRvbmx5IHJldmVhbFJhbmdlOiBSYW5nZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmV2ZWFsU2Nyb2xsVHlwZTogU2Nyb2xsVHlwZVxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgTXVsdGlDdXJzb3JTZXNzaW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZShlZGl0b3I6IElDb2RlRWRpdG9yLCBmaW5kQ29udHJvbGxlcjogQ29tbW9uRmluZENvbnRyb2xsZXIpOiBNdWx0aUN1cnNvclNlc3Npb24gfCBudWxsIHtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKTtcblxuXHRcdC8vIEZpbmQgd2lkZ2V0IG93bnMgZW50aXJlbHkgd2hhdCB3ZSBzZWFyY2ggZm9yIGlmOlxuXHRcdC8vICAtIGZvY3VzIGlzIG5vdCBpbiB0aGUgZWRpdG9yIChpLmUuIGl0IGlzIGluIHRoZSBmaW5kIHdpZGdldClcblx0XHQvLyAgLSBhbmQgdGhlIHNlYXJjaCB3aWRnZXQgaXMgdmlzaWJsZVxuXHRcdC8vICAtIGFuZCB0aGUgc2VhcmNoIHN0cmluZyBpcyBub24tZW1wdHlcblx0XHRpZiAoIWVkaXRvci5oYXNUZXh0Rm9jdXMoKSAmJiBmaW5kU3RhdGUuaXNSZXZlYWxlZCAmJiBmaW5kU3RhdGUuc2VhcmNoU3RyaW5nLmxlbmd0aCA+IDApIHtcblx0XHRcdC8vIEZpbmQgd2lkZ2V0IG93bnMgd2hhdCBpcyBzZWFyY2hlZCBmb3Jcblx0XHRcdHJldHVybiBuZXcgTXVsdGlDdXJzb3JTZXNzaW9uKGVkaXRvciwgZmluZENvbnRyb2xsZXIsIGZhbHNlLCBmaW5kU3RhdGUuc2VhcmNoU3RyaW5nLCBmaW5kU3RhdGUud2hvbGVXb3JkLCBmaW5kU3RhdGUubWF0Y2hDYXNlLCBudWxsKTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UsIHRoZSBzZWxlY3Rpb24gZ2l2ZXMgdGhlIHNlYXJjaCB0ZXh0LCBhbmQgdGhlIGZpbmQgd2lkZ2V0IGdpdmVzIHRoZSBzZWFyY2ggc2V0dGluZ3Ncblx0XHQvLyBUaGUgZXhjZXB0aW9uIGlzIHRoZSBmaW5kIHN0YXRlIGRpc2Fzc29jaWF0aW9uIGNhc2U6IHdoZW4gYmVnaW5uaW5nIHdpdGggYSBzaW5nbGUsIGNvbGxhcHNlZCBzZWxlY3Rpb25cblx0XHRsZXQgaXNEaXNjb25uZWN0ZWRGcm9tRmluZENvbnRyb2xsZXIgPSBmYWxzZTtcblx0XHRsZXQgd2hvbGVXb3JkOiBib29sZWFuO1xuXHRcdGxldCBtYXRjaENhc2U6IGJvb2xlYW47XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0aWYgKHNlbGVjdGlvbnMubGVuZ3RoID09PSAxICYmIHNlbGVjdGlvbnNbMF0uaXNFbXB0eSgpKSB7XG5cdFx0XHRpc0Rpc2Nvbm5lY3RlZEZyb21GaW5kQ29udHJvbGxlciA9IHRydWU7XG5cdFx0XHR3aG9sZVdvcmQgPSB0cnVlO1xuXHRcdFx0bWF0Y2hDYXNlID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d2hvbGVXb3JkID0gZmluZFN0YXRlLndob2xlV29yZDtcblx0XHRcdG1hdGNoQ2FzZSA9IGZpbmRTdGF0ZS5tYXRjaENhc2U7XG5cdFx0fVxuXG5cdFx0Ly8gU2VsZWN0aW9uIG93bnMgd2hhdCBpcyBzZWFyY2hlZCBmb3Jcblx0XHRjb25zdCBzID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXG5cdFx0bGV0IHNlYXJjaFRleHQ6IHN0cmluZztcblx0XHRsZXQgY3VycmVudE1hdGNoOiBTZWxlY3Rpb24gfCBudWxsID0gbnVsbDtcblxuXHRcdGlmIChzLmlzRW1wdHkoKSkge1xuXHRcdFx0Ly8gc2VsZWN0aW9uIGlzIGVtcHR5ID0+IGV4cGFuZCB0byBjdXJyZW50IHdvcmRcblx0XHRcdGNvbnN0IHdvcmQgPSBlZGl0b3IuZ2V0Q29uZmlndXJlZFdvcmRBdFBvc2l0aW9uKHMuZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdGlmICghd29yZCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHNlYXJjaFRleHQgPSB3b3JkLndvcmQ7XG5cdFx0XHRjdXJyZW50TWF0Y2ggPSBuZXcgU2VsZWN0aW9uKHMuc3RhcnRMaW5lTnVtYmVyLCB3b3JkLnN0YXJ0Q29sdW1uLCBzLnN0YXJ0TGluZU51bWJlciwgd29yZC5lbmRDb2x1bW4pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZWFyY2hUZXh0ID0gZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWVJblJhbmdlKHMpLnJlcGxhY2UoL1xcclxcbi9nLCAnXFxuJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBNdWx0aUN1cnNvclNlc3Npb24oZWRpdG9yLCBmaW5kQ29udHJvbGxlciwgaXNEaXNjb25uZWN0ZWRGcm9tRmluZENvbnRyb2xsZXIsIHNlYXJjaFRleHQsIHdob2xlV29yZCwgbWF0Y2hDYXNlLCBjdXJyZW50TWF0Y2gpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBpc0Rpc2Nvbm5lY3RlZEZyb21GaW5kQ29udHJvbGxlcjogYm9vbGVhbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc2VhcmNoVGV4dDogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSB3aG9sZVdvcmQ6IGJvb2xlYW4sXG5cdFx0cHVibGljIHJlYWRvbmx5IG1hdGNoQ2FzZTogYm9vbGVhbixcblx0XHRwdWJsaWMgY3VycmVudE1hdGNoOiBTZWxlY3Rpb24gfCBudWxsXG5cdCkgeyB9XG5cblx0cHVibGljIGFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCgpOiBNdWx0aUN1cnNvclNlc3Npb25SZXN1bHQgfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBuZXh0TWF0Y2ggPSB0aGlzLl9nZXROZXh0TWF0Y2goKTtcblx0XHRpZiAoIW5leHRNYXRjaCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsU2VsZWN0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0cmV0dXJuIG5ldyBNdWx0aUN1cnNvclNlc3Npb25SZXN1bHQoYWxsU2VsZWN0aW9ucy5jb25jYXQobmV4dE1hdGNoKSwgbmV4dE1hdGNoLCBTY3JvbGxUeXBlLlNtb290aCk7XG5cdH1cblxuXHRwdWJsaWMgbW92ZVNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCgpOiBNdWx0aUN1cnNvclNlc3Npb25SZXN1bHQgfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBuZXh0TWF0Y2ggPSB0aGlzLl9nZXROZXh0TWF0Y2goKTtcblx0XHRpZiAoIW5leHRNYXRjaCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsU2VsZWN0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0cmV0dXJuIG5ldyBNdWx0aUN1cnNvclNlc3Npb25SZXN1bHQoYWxsU2VsZWN0aW9ucy5zbGljZSgwLCBhbGxTZWxlY3Rpb25zLmxlbmd0aCAtIDEpLmNvbmNhdChuZXh0TWF0Y2gpLCBuZXh0TWF0Y2gsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldE5leHRNYXRjaCgpOiBTZWxlY3Rpb24gfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jdXJyZW50TWF0Y2gpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuY3VycmVudE1hdGNoO1xuXHRcdFx0dGhpcy5jdXJyZW50TWF0Y2ggPSBudWxsO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHR0aGlzLmZpbmRDb250cm9sbGVyLmhpZ2hsaWdodEZpbmRPcHRpb25zKCk7XG5cblx0XHRjb25zdCBhbGxTZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRjb25zdCBsYXN0QWRkZWRTZWxlY3Rpb24gPSBhbGxTZWxlY3Rpb25zW2FsbFNlbGVjdGlvbnMubGVuZ3RoIC0gMV07XG5cdFx0Y29uc3QgbmV4dE1hdGNoID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkuZmluZE5leHRNYXRjaCh0aGlzLnNlYXJjaFRleHQsIGxhc3RBZGRlZFNlbGVjdGlvbi5nZXRFbmRQb3NpdGlvbigpLCBmYWxzZSwgdGhpcy5tYXRjaENhc2UsIHRoaXMud2hvbGVXb3JkID8gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ud29yZFNlcGFyYXRvcnMpIDogbnVsbCwgZmFsc2UpO1xuXG5cdFx0aWYgKCFuZXh0TWF0Y2gpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFNlbGVjdGlvbihuZXh0TWF0Y2gucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBuZXh0TWF0Y2gucmFuZ2Uuc3RhcnRDb2x1bW4sIG5leHRNYXRjaC5yYW5nZS5lbmRMaW5lTnVtYmVyLCBuZXh0TWF0Y2gucmFuZ2UuZW5kQ29sdW1uKTtcblx0fVxuXG5cdHB1YmxpYyBhZGRTZWxlY3Rpb25Ub1ByZXZpb3VzRmluZE1hdGNoKCk6IE11bHRpQ3Vyc29yU2Vzc2lvblJlc3VsdCB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzTWF0Y2ggPSB0aGlzLl9nZXRQcmV2aW91c01hdGNoKCk7XG5cdFx0aWYgKCFwcmV2aW91c01hdGNoKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBhbGxTZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRyZXR1cm4gbmV3IE11bHRpQ3Vyc29yU2Vzc2lvblJlc3VsdChhbGxTZWxlY3Rpb25zLmNvbmNhdChwcmV2aW91c01hdGNoKSwgcHJldmlvdXNNYXRjaCwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHR9XG5cblx0cHVibGljIG1vdmVTZWxlY3Rpb25Ub1ByZXZpb3VzRmluZE1hdGNoKCk6IE11bHRpQ3Vyc29yU2Vzc2lvblJlc3VsdCB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzTWF0Y2ggPSB0aGlzLl9nZXRQcmV2aW91c01hdGNoKCk7XG5cdFx0aWYgKCFwcmV2aW91c01hdGNoKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBhbGxTZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRyZXR1cm4gbmV3IE11bHRpQ3Vyc29yU2Vzc2lvblJlc3VsdChhbGxTZWxlY3Rpb25zLnNsaWNlKDAsIGFsbFNlbGVjdGlvbnMubGVuZ3RoIC0gMSkuY29uY2F0KHByZXZpb3VzTWF0Y2gpLCBwcmV2aW91c01hdGNoLCBTY3JvbGxUeXBlLlNtb290aCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRQcmV2aW91c01hdGNoKCk6IFNlbGVjdGlvbiB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmN1cnJlbnRNYXRjaCkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5jdXJyZW50TWF0Y2g7XG5cdFx0XHR0aGlzLmN1cnJlbnRNYXRjaCA9IG51bGw7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdHRoaXMuZmluZENvbnRyb2xsZXIuaGlnaGxpZ2h0RmluZE9wdGlvbnMoKTtcblxuXHRcdGNvbnN0IGFsbFNlbGVjdGlvbnMgPSB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGNvbnN0IGxhc3RBZGRlZFNlbGVjdGlvbiA9IGFsbFNlbGVjdGlvbnNbYWxsU2VsZWN0aW9ucy5sZW5ndGggLSAxXTtcblx0XHRjb25zdCBwcmV2aW91c01hdGNoID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkuZmluZFByZXZpb3VzTWF0Y2godGhpcy5zZWFyY2hUZXh0LCBsYXN0QWRkZWRTZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpLCBmYWxzZSwgdGhpcy5tYXRjaENhc2UsIHRoaXMud2hvbGVXb3JkID8gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ud29yZFNlcGFyYXRvcnMpIDogbnVsbCwgZmFsc2UpO1xuXG5cdFx0aWYgKCFwcmV2aW91c01hdGNoKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24ocHJldmlvdXNNYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHByZXZpb3VzTWF0Y2gucmFuZ2Uuc3RhcnRDb2x1bW4sIHByZXZpb3VzTWF0Y2gucmFuZ2UuZW5kTGluZU51bWJlciwgcHJldmlvdXNNYXRjaC5yYW5nZS5lbmRDb2x1bW4pO1xuXHR9XG5cblx0cHVibGljIHNlbGVjdEFsbChzZWFyY2hTY29wZTogUmFuZ2VbXSB8IG51bGwpOiBGaW5kTWF0Y2hbXSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdHRoaXMuZmluZENvbnRyb2xsZXIuaGlnaGxpZ2h0RmluZE9wdGlvbnMoKTtcblxuXHRcdGNvbnN0IGVkaXRvck1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKHNlYXJjaFNjb3BlKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yTW9kZWwuZmluZE1hdGNoZXModGhpcy5zZWFyY2hUZXh0LCBzZWFyY2hTY29wZSwgZmFsc2UsIHRoaXMubWF0Y2hDYXNlLCB0aGlzLndob2xlV29yZCA/IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSA6IG51bGwsIGZhbHNlLCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUik7XG5cdFx0fVxuXHRcdHJldHVybiBlZGl0b3JNb2RlbC5maW5kTWF0Y2hlcyh0aGlzLnNlYXJjaFRleHQsIHRydWUsIGZhbHNlLCB0aGlzLm1hdGNoQ2FzZSwgdGhpcy53aG9sZVdvcmQgPyB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi53b3JkU2VwYXJhdG9ycykgOiBudWxsLCBmYWxzZSwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5tdWx0aUN1cnNvckNvbnRyb2xsZXInO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3I7XG5cdHByaXZhdGUgX2lnbm9yZVNlbGVjdGlvbkNoYW5nZTogYm9vbGVhbjtcblx0cHJpdmF0ZSBfc2Vzc2lvbjogTXVsdGlDdXJzb3JTZXNzaW9uIHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfc2Vzc2lvbkRpc3Bvc2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXI+KE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlci5JRCk7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihlZGl0b3I6IElDb2RlRWRpdG9yKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9lZGl0b3IgPSBlZGl0b3I7XG5cdFx0dGhpcy5faWdub3JlU2VsZWN0aW9uQ2hhbmdlID0gZmFsc2U7XG5cdFx0dGhpcy5fc2Vzc2lvbiA9IG51bGw7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9lbmRTZXNzaW9uKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYmVnaW5TZXNzaW9uSWZOZWVkZWQoZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9zZXNzaW9uKSB7XG5cdFx0XHQvLyBDcmVhdGUgYSBuZXcgc2Vzc2lvblxuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IE11bHRpQ3Vyc29yU2Vzc2lvbi5jcmVhdGUodGhpcy5fZWRpdG9yLCBmaW5kQ29udHJvbGxlcik7XG5cdFx0XHRpZiAoIXNlc3Npb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9zZXNzaW9uID0gc2Vzc2lvbjtcblxuXHRcdFx0Y29uc3QgbmV3U3RhdGU6IElOZXdGaW5kUmVwbGFjZVN0YXRlID0geyBzZWFyY2hTdHJpbmc6IHRoaXMuX3Nlc3Npb24uc2VhcmNoVGV4dCB9O1xuXHRcdFx0aWYgKHRoaXMuX3Nlc3Npb24uaXNEaXNjb25uZWN0ZWRGcm9tRmluZENvbnRyb2xsZXIpIHtcblx0XHRcdFx0bmV3U3RhdGUud2hvbGVXb3JkT3ZlcnJpZGUgPSBGaW5kT3B0aW9uT3ZlcnJpZGUuVHJ1ZTtcblx0XHRcdFx0bmV3U3RhdGUubWF0Y2hDYXNlT3ZlcnJpZGUgPSBGaW5kT3B0aW9uT3ZlcnJpZGUuVHJ1ZTtcblx0XHRcdFx0bmV3U3RhdGUuaXNSZWdleE92ZXJyaWRlID0gRmluZE9wdGlvbk92ZXJyaWRlLkZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5jaGFuZ2UobmV3U3RhdGUsIGZhbHNlKTtcblxuXHRcdFx0dGhpcy5fc2Vzc2lvbkRpc3Bvc2UuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbigoZSkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5faWdub3JlU2VsZWN0aW9uQ2hhbmdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2VuZFNlc3Npb24oKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRCbHVyRWRpdG9yVGV4dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2VuZFNlc3Npb24oKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NlLmFkZChmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpLm9uRmluZFJlcGxhY2VTdGF0ZUNoYW5nZSgoZSkgPT4ge1xuXHRcdFx0XHRpZiAoZS5tYXRjaENhc2UgfHwgZS53aG9sZVdvcmQpIHtcblx0XHRcdFx0XHR0aGlzLl9lbmRTZXNzaW9uKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9lbmRTZXNzaW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NlLmNsZWFyKCk7XG5cdFx0aWYgKHRoaXMuX3Nlc3Npb24gJiYgdGhpcy5fc2Vzc2lvbi5pc0Rpc2Nvbm5lY3RlZEZyb21GaW5kQ29udHJvbGxlcikge1xuXHRcdFx0Y29uc3QgbmV3U3RhdGU6IElOZXdGaW5kUmVwbGFjZVN0YXRlID0ge1xuXHRcdFx0XHR3aG9sZVdvcmRPdmVycmlkZTogRmluZE9wdGlvbk92ZXJyaWRlLk5vdFNldCxcblx0XHRcdFx0bWF0Y2hDYXNlT3ZlcnJpZGU6IEZpbmRPcHRpb25PdmVycmlkZS5Ob3RTZXQsXG5cdFx0XHRcdGlzUmVnZXhPdmVycmlkZTogRmluZE9wdGlvbk92ZXJyaWRlLk5vdFNldCxcblx0XHRcdH07XG5cdFx0XHR0aGlzLl9zZXNzaW9uLmZpbmRDb250cm9sbGVyLmdldFN0YXRlKCkuY2hhbmdlKG5ld1N0YXRlLCBmYWxzZSk7XG5cdFx0fVxuXHRcdHRoaXMuX3Nlc3Npb24gPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0U2VsZWN0aW9ucyhzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSk6IHZvaWQge1xuXHRcdHRoaXMuX2lnbm9yZVNlbGVjdGlvbkNoYW5nZSA9IHRydWU7XG5cdFx0dGhpcy5fZWRpdG9yLnNldFNlbGVjdGlvbnMoc2VsZWN0aW9ucyk7XG5cdFx0dGhpcy5faWdub3JlU2VsZWN0aW9uQ2hhbmdlID0gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9leHBhbmRFbXB0eVRvV29yZChtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24pOiBTZWxlY3Rpb24ge1xuXHRcdGlmICghc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0XHR9XG5cdFx0Y29uc3Qgd29yZCA9IHRoaXMuX2VkaXRvci5nZXRDb25maWd1cmVkV29yZEF0UG9zaXRpb24oc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0aWYgKCF3b3JkKSB7XG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9uO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFNlbGVjdGlvbihzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCB3b3JkLnN0YXJ0Q29sdW1uLCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCB3b3JkLmVuZENvbHVtbik7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseVNlc3Npb25SZXN1bHQocmVzdWx0OiBNdWx0aUN1cnNvclNlc3Npb25SZXN1bHQgfCBudWxsKTogdm9pZCB7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fc2V0U2VsZWN0aW9ucyhyZXN1bHQuc2VsZWN0aW9ucyk7XG5cdFx0aWYgKHJlc3VsdC5yZXZlYWxSYW5nZSkge1xuXHRcdFx0dGhpcy5fZWRpdG9yLnJldmVhbFJhbmdlSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChyZXN1bHQucmV2ZWFsUmFuZ2UsIHJlc3VsdC5yZXZlYWxTY3JvbGxUeXBlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2Vzc2lvbihmaW5kQ29udHJvbGxlcjogQ29tbW9uRmluZENvbnRyb2xsZXIpOiBNdWx0aUN1cnNvclNlc3Npb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fc2Vzc2lvbjtcblx0fVxuXG5cdHB1YmxpYyBhZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2goZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX3Nlc3Npb24pIHtcblx0XHRcdC8vIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBjdXJzb3JzLCBoYW5kbGUgdGhlIGNhc2Ugd2hlcmUgdGhleSBkbyBub3QgYWxsIHNlbGVjdCB0aGUgc2FtZSB0ZXh0LlxuXHRcdFx0Y29uc3QgYWxsU2VsZWN0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRpZiAoYWxsU2VsZWN0aW9ucy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCk7XG5cdFx0XHRcdGNvbnN0IG1hdGNoQ2FzZSA9IGZpbmRTdGF0ZS5tYXRjaENhc2U7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbnNDb250YWluU2FtZVRleHQgPSBtb2RlbFJhbmdlc0NvbnRhaW5TYW1lVGV4dCh0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKSwgYWxsU2VsZWN0aW9ucywgbWF0Y2hDYXNlKTtcblx0XHRcdFx0aWYgKCFzZWxlY3Rpb25zQ29udGFpblNhbWVUZXh0KSB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdFx0XHRjb25zdCByZXN1bHRpbmdTZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSA9IFtdO1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBhbGxTZWxlY3Rpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHRpbmdTZWxlY3Rpb25zW2ldID0gdGhpcy5fZXhwYW5kRW1wdHlUb1dvcmQobW9kZWwsIGFsbFNlbGVjdGlvbnNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9lZGl0b3Iuc2V0U2VsZWN0aW9ucyhyZXN1bHRpbmdTZWxlY3Rpb25zKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fYmVnaW5TZXNzaW9uSWZOZWVkZWQoZmluZENvbnRyb2xsZXIpO1xuXHRcdGlmICh0aGlzLl9zZXNzaW9uKSB7XG5cdFx0XHR0aGlzLl9hcHBseVNlc3Npb25SZXN1bHQodGhpcy5fc2Vzc2lvbi5hZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2goKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFkZFNlbGVjdGlvblRvUHJldmlvdXNGaW5kTWF0Y2goZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogdm9pZCB7XG5cdFx0dGhpcy5fYmVnaW5TZXNzaW9uSWZOZWVkZWQoZmluZENvbnRyb2xsZXIpO1xuXHRcdGlmICh0aGlzLl9zZXNzaW9uKSB7XG5cdFx0XHR0aGlzLl9hcHBseVNlc3Npb25SZXN1bHQodGhpcy5fc2Vzc2lvbi5hZGRTZWxlY3Rpb25Ub1ByZXZpb3VzRmluZE1hdGNoKCkpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBtb3ZlU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoKGZpbmRDb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcik6IHZvaWQge1xuXHRcdHRoaXMuX2JlZ2luU2Vzc2lvbklmTmVlZGVkKGZpbmRDb250cm9sbGVyKTtcblx0XHRpZiAodGhpcy5fc2Vzc2lvbikge1xuXHRcdFx0dGhpcy5fYXBwbHlTZXNzaW9uUmVzdWx0KHRoaXMuX3Nlc3Npb24ubW92ZVNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCgpKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgbW92ZVNlbGVjdGlvblRvUHJldmlvdXNGaW5kTWF0Y2goZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogdm9pZCB7XG5cdFx0dGhpcy5fYmVnaW5TZXNzaW9uSWZOZWVkZWQoZmluZENvbnRyb2xsZXIpO1xuXHRcdGlmICh0aGlzLl9zZXNzaW9uKSB7XG5cdFx0XHR0aGlzLl9hcHBseVNlc3Npb25SZXN1bHQodGhpcy5fc2Vzc2lvbi5tb3ZlU2VsZWN0aW9uVG9QcmV2aW91c0ZpbmRNYXRjaCgpKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2VsZWN0QWxsKGZpbmRDb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgbWF0Y2hlczogRmluZE1hdGNoW10gfCBudWxsID0gbnVsbDtcblxuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCk7XG5cblx0XHQvLyBTcGVjaWFsIGNhc2U6IGZpbmQgd2lkZ2V0IG93bnMgZW50aXJlbHkgd2hhdCB3ZSBzZWFyY2ggZm9yIGlmOlxuXHRcdC8vIC0gZm9jdXMgaXMgbm90IGluIHRoZSBlZGl0b3IgKGkuZS4gaXQgaXMgaW4gdGhlIGZpbmQgd2lkZ2V0KVxuXHRcdC8vIC0gYW5kIHRoZSBzZWFyY2ggd2lkZ2V0IGlzIHZpc2libGVcblx0XHQvLyAtIGFuZCB0aGUgc2VhcmNoIHN0cmluZyBpcyBub24tZW1wdHlcblx0XHQvLyAtIGFuZCB3ZSdyZSBzZWFyY2hpbmcgZm9yIGEgcmVnZXhcblx0XHRpZiAoZmluZFN0YXRlLmlzUmV2ZWFsZWQgJiYgZmluZFN0YXRlLnNlYXJjaFN0cmluZy5sZW5ndGggPiAwICYmIGZpbmRTdGF0ZS5pc1JlZ2V4KSB7XG5cdFx0XHRjb25zdCBlZGl0b3JNb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKGZpbmRTdGF0ZS5zZWFyY2hTY29wZSkge1xuXHRcdFx0XHRtYXRjaGVzID0gZWRpdG9yTW9kZWwuZmluZE1hdGNoZXMoZmluZFN0YXRlLnNlYXJjaFN0cmluZywgZmluZFN0YXRlLnNlYXJjaFNjb3BlLCBmaW5kU3RhdGUuaXNSZWdleCwgZmluZFN0YXRlLm1hdGNoQ2FzZSwgZmluZFN0YXRlLndob2xlV29yZCA/IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSA6IG51bGwsIGZhbHNlLCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtYXRjaGVzID0gZWRpdG9yTW9kZWwuZmluZE1hdGNoZXMoZmluZFN0YXRlLnNlYXJjaFN0cmluZywgdHJ1ZSwgZmluZFN0YXRlLmlzUmVnZXgsIGZpbmRTdGF0ZS5tYXRjaENhc2UsIGZpbmRTdGF0ZS53aG9sZVdvcmQgPyB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi53b3JkU2VwYXJhdG9ycykgOiBudWxsLCBmYWxzZSwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cblx0XHRcdHRoaXMuX2JlZ2luU2Vzc2lvbklmTmVlZGVkKGZpbmRDb250cm9sbGVyKTtcblx0XHRcdGlmICghdGhpcy5fc2Vzc2lvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdG1hdGNoZXMgPSB0aGlzLl9zZXNzaW9uLnNlbGVjdEFsbChmaW5kU3RhdGUuc2VhcmNoU2NvcGUpO1xuXHRcdH1cblxuXHRcdGlmIChtYXRjaGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IGVkaXRvclNlbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdC8vIEhhdmUgdGhlIHByaW1hcnkgY3Vyc29yIHJlbWFpbiB0aGUgb25lIHdoZXJlIHRoZSBhY3Rpb24gd2FzIGludm9rZWRcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBtYXRjaGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoID0gbWF0Y2hlc1tpXTtcblx0XHRcdFx0Y29uc3QgaW50ZXJzZWN0aW9uID0gbWF0Y2gucmFuZ2UuaW50ZXJzZWN0UmFuZ2VzKGVkaXRvclNlbGVjdGlvbik7XG5cdFx0XHRcdGlmIChpbnRlcnNlY3Rpb24pIHtcblx0XHRcdFx0XHQvLyBiaW5nbyFcblx0XHRcdFx0XHRtYXRjaGVzW2ldID0gbWF0Y2hlc1swXTtcblx0XHRcdFx0XHRtYXRjaGVzWzBdID0gbWF0Y2g7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fc2V0U2VsZWN0aW9ucyhtYXRjaGVzLm1hcChtID0+IG5ldyBTZWxlY3Rpb24obS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIG0ucmFuZ2Uuc3RhcnRDb2x1bW4sIG0ucmFuZ2UuZW5kTGluZU51bWJlciwgbS5yYW5nZS5lbmRDb2x1bW4pKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNlbGVjdEFsbFVzaW5nU2VsZWN0aW9ucyhzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSk6IHZvaWQge1xuXHRcdGlmIChzZWxlY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX3NldFNlbGVjdGlvbnMoc2VsZWN0aW9ucyk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXJBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBtdWx0aUN1cnNvckNvbnRyb2xsZXIgPSBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFtdWx0aUN1cnNvckNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gZWRpdG9yLl9nZXRWaWV3TW9kZWwoKTtcblx0XHRpZiAodmlld01vZGVsKSB7XG5cdFx0XHRjb25zdCBwcmV2aW91c0N1cnNvclN0YXRlID0gdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpO1xuXHRcdFx0Y29uc3QgZmluZENvbnRyb2xsZXIgPSBDb21tb25GaW5kQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRcdGlmIChmaW5kQ29udHJvbGxlcikge1xuXHRcdFx0XHR0aGlzLl9ydW4obXVsdGlDdXJzb3JDb250cm9sbGVyLCBmaW5kQ29udHJvbGxlcik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBuZXdGaW5kQ29udHJvbGxlciA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpLmNyZWF0ZUluc3RhbmNlKENvbW1vbkZpbmRDb250cm9sbGVyLCBlZGl0b3IpO1xuXHRcdFx0XHR0aGlzLl9ydW4obXVsdGlDdXJzb3JDb250cm9sbGVyLCBuZXdGaW5kQ29udHJvbGxlcik7XG5cdFx0XHRcdG5ld0ZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0YW5ub3VuY2VDdXJzb3JDaGFuZ2UocHJldmlvdXNDdXJzb3JTdGF0ZSwgdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX3J1bihtdWx0aUN1cnNvckNvbnRyb2xsZXI6IE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlciwgZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbiBleHRlbmRzIE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5hZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2gnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2FkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCcsIFwiQWRkIFNlbGVjdGlvbiB0byBOZXh0IEZpbmQgTWF0Y2hcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5RCxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZW51T3B0czoge1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyU2VsZWN0aW9uTWVudSxcblx0XHRcdFx0Z3JvdXA6ICczX211bHRpJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pQWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkFkZCAmJk5leHQgT2NjdXJyZW5jZVwiKSxcblx0XHRcdFx0b3JkZXI6IDVcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRwcm90ZWN0ZWQgX3J1bihtdWx0aUN1cnNvckNvbnRyb2xsZXI6IE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlciwgZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogdm9pZCB7XG5cdFx0bXVsdGlDdXJzb3JDb250cm9sbGVyLmFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaChmaW5kQ29udHJvbGxlcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEFkZFNlbGVjdGlvblRvUHJldmlvdXNGaW5kTWF0Y2hBY3Rpb24gZXh0ZW5kcyBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXJBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uYWRkU2VsZWN0aW9uVG9QcmV2aW91c0ZpbmRNYXRjaCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignYWRkU2VsZWN0aW9uVG9QcmV2aW91c0ZpbmRNYXRjaCcsIFwiQWRkIFNlbGVjdGlvbiB0byBQcmV2aW91cyBGaW5kIE1hdGNoXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRtZW51T3B0czoge1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyU2VsZWN0aW9uTWVudSxcblx0XHRcdFx0Z3JvdXA6ICczX211bHRpJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pQWRkU2VsZWN0aW9uVG9QcmV2aW91c0ZpbmRNYXRjaCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJBZGQgUCYmcmV2aW91cyBPY2N1cnJlbmNlXCIpLFxuXHRcdFx0XHRvcmRlcjogNlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHByb3RlY3RlZCBfcnVuKG11bHRpQ3Vyc29yQ29udHJvbGxlcjogTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyLCBmaW5kQ29udHJvbGxlcjogQ29tbW9uRmluZENvbnRyb2xsZXIpOiB2b2lkIHtcblx0XHRtdWx0aUN1cnNvckNvbnRyb2xsZXIuYWRkU2VsZWN0aW9uVG9QcmV2aW91c0ZpbmRNYXRjaChmaW5kQ29udHJvbGxlcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24gZXh0ZW5kcyBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXJBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24ubW92ZVNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbW92ZVNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCcsIFwiTW92ZSBMYXN0IFNlbGVjdGlvbiB0byBOZXh0IEZpbmQgTWF0Y2hcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUQpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHByb3RlY3RlZCBfcnVuKG11bHRpQ3Vyc29yQ29udHJvbGxlcjogTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyLCBmaW5kQ29udHJvbGxlcjogQ29tbW9uRmluZENvbnRyb2xsZXIpOiB2b2lkIHtcblx0XHRtdWx0aUN1cnNvckNvbnRyb2xsZXIubW92ZVNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaChmaW5kQ29udHJvbGxlcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVTZWxlY3Rpb25Ub1ByZXZpb3VzRmluZE1hdGNoQWN0aW9uIGV4dGVuZHMgTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLm1vdmVTZWxlY3Rpb25Ub1ByZXZpb3VzRmluZE1hdGNoJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdtb3ZlU2VsZWN0aW9uVG9QcmV2aW91c0ZpbmRNYXRjaCcsIFwiTW92ZSBMYXN0IFNlbGVjdGlvbiB0byBQcmV2aW91cyBGaW5kIE1hdGNoXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXHRwcm90ZWN0ZWQgX3J1bihtdWx0aUN1cnNvckNvbnRyb2xsZXI6IE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlciwgZmluZENvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogdm9pZCB7XG5cdFx0bXVsdGlDdXJzb3JDb250cm9sbGVyLm1vdmVTZWxlY3Rpb25Ub1ByZXZpb3VzRmluZE1hdGNoKGZpbmRDb250cm9sbGVyKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VsZWN0SGlnaGxpZ2h0c0FjdGlvbiBleHRlbmRzIE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5zZWxlY3RIaWdobGlnaHRzJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdzZWxlY3RBbGxPY2N1cnJlbmNlc09mRmluZE1hdGNoJywgXCJTZWxlY3QgQWxsIE9jY3VycmVuY2VzIG9mIEZpbmQgTWF0Y2hcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5TCxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZW51T3B0czoge1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyU2VsZWN0aW9uTWVudSxcblx0XHRcdFx0Z3JvdXA6ICczX211bHRpJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pU2VsZWN0SGlnaGxpZ2h0cycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJTZWxlY3QgQWxsICYmT2NjdXJyZW5jZXNcIiksXG5cdFx0XHRcdG9yZGVyOiA3XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0cHJvdGVjdGVkIF9ydW4obXVsdGlDdXJzb3JDb250cm9sbGVyOiBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIsIGZpbmRDb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcik6IHZvaWQge1xuXHRcdG11bHRpQ3Vyc29yQ29udHJvbGxlci5zZWxlY3RBbGwoZmluZENvbnRyb2xsZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wYXRDaGFuZ2VBbGwgZXh0ZW5kcyBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXJBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uY2hhbmdlQWxsJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdjaGFuZ2VBbGwubGFiZWwnLCBcIkNoYW5nZSBBbGwgT2NjdXJyZW5jZXNcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzKSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkYyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdGNvbnRleHRNZW51T3B0czoge1xuXHRcdFx0XHRncm91cDogJzFfbW9kaWZpY2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDEuMlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHByb3RlY3RlZCBfcnVuKG11bHRpQ3Vyc29yQ29udHJvbGxlcjogTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyLCBmaW5kQ29udHJvbGxlcjogQ29tbW9uRmluZENvbnRyb2xsZXIpOiB2b2lkIHtcblx0XHRtdWx0aUN1cnNvckNvbnRyb2xsZXIuc2VsZWN0QWxsKGZpbmRDb250cm9sbGVyKTtcblx0fVxufVxuXG5jbGFzcyBTZWxlY3Rpb25IaWdobGlnaHRlclN0YXRlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxWZXJzaW9uSWQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfY2FjaGVkRmluZE1hdGNoZXM6IFJhbmdlW10gfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSVRleHRNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zZWFyY2hUZXh0OiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbWF0Y2hDYXNlOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3dvcmRTZXBhcmF0b3JzOiBzdHJpbmcgfCBudWxsLFxuXHRcdHByZXZTdGF0ZTogU2VsZWN0aW9uSGlnaGxpZ2h0ZXJTdGF0ZSB8IG51bGxcblx0KSB7XG5cdFx0dGhpcy5fbW9kZWxWZXJzaW9uSWQgPSB0aGlzLl9tb2RlbC5nZXRWZXJzaW9uSWQoKTtcblx0XHRpZiAocHJldlN0YXRlXG5cdFx0XHQmJiB0aGlzLl9tb2RlbCA9PT0gcHJldlN0YXRlLl9tb2RlbFxuXHRcdFx0JiYgdGhpcy5fc2VhcmNoVGV4dCA9PT0gcHJldlN0YXRlLl9zZWFyY2hUZXh0XG5cdFx0XHQmJiB0aGlzLl9tYXRjaENhc2UgPT09IHByZXZTdGF0ZS5fbWF0Y2hDYXNlXG5cdFx0XHQmJiB0aGlzLl93b3JkU2VwYXJhdG9ycyA9PT0gcHJldlN0YXRlLl93b3JkU2VwYXJhdG9yc1xuXHRcdFx0JiYgdGhpcy5fbW9kZWxWZXJzaW9uSWQgPT09IHByZXZTdGF0ZS5fbW9kZWxWZXJzaW9uSWRcblx0XHQpIHtcblx0XHRcdHRoaXMuX2NhY2hlZEZpbmRNYXRjaGVzID0gcHJldlN0YXRlLl9jYWNoZWRGaW5kTWF0Y2hlcztcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZmluZE1hdGNoZXMoKTogUmFuZ2VbXSB7XG5cdFx0aWYgKHRoaXMuX2NhY2hlZEZpbmRNYXRjaGVzID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLl9jYWNoZWRGaW5kTWF0Y2hlcyA9IHRoaXMuX21vZGVsLmZpbmRNYXRjaGVzKHRoaXMuX3NlYXJjaFRleHQsIHRydWUsIGZhbHNlLCB0aGlzLl9tYXRjaENhc2UsIHRoaXMuX3dvcmRTZXBhcmF0b3JzLCBmYWxzZSkubWFwKG0gPT4gbS5yYW5nZSk7XG5cdFx0XHR0aGlzLl9jYWNoZWRGaW5kTWF0Y2hlcy5zb3J0KFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9jYWNoZWRGaW5kTWF0Y2hlcztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VsZWN0aW9uSGlnaGxpZ2h0ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIuc2VsZWN0aW9uSGlnaGxpZ2h0ZXInO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcjtcblx0cHJpdmF0ZSBfaXNFbmFibGVkOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uczogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSB1cGRhdGVTb29uOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIHN0YXRlOiBTZWxlY3Rpb25IaWdobGlnaHRlclN0YXRlIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuX2lzRW5hYmxlZCA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnNlbGVjdGlvbkhpZ2hsaWdodCk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMgPSBlZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cdFx0dGhpcy51cGRhdGVTb29uID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5fdXBkYXRlKCksIDMwMCkpO1xuXHRcdHRoaXMuc3RhdGUgPSBudWxsO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0dGhpcy5faXNFbmFibGVkID0gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc2VsZWN0aW9uSGlnaGxpZ2h0KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKChlOiBJQ3Vyc29yU2VsZWN0aW9uQ2hhbmdlZEV2ZW50KSA9PiB7XG5cblx0XHRcdGlmICghdGhpcy5faXNFbmFibGVkKSB7XG5cdFx0XHRcdC8vIEVhcmx5IGV4aXQgaWYgbm90aGluZyBuZWVkcyB0byBiZSBkb25lIVxuXHRcdFx0XHQvLyBMZWF2ZSBzb21lIGZvcm0gb2YgZWFybHkgZXhpdCBjaGVjayBoZXJlIGlmIHlvdSB3aXNoIHRvIGNvbnRpbnVlIGJlaW5nIGEgY3Vyc29yIHBvc2l0aW9uIGNoYW5nZSBsaXN0ZW5lciA7KVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLnNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0aWYgKGUucmVhc29uID09PSBDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5zdGF0ZSkge1xuXHRcdFx0XHRcdFx0Ly8gbm8gbG9uZ2VyIHZhbGlkXG5cdFx0XHRcdFx0XHR0aGlzLl9zZXRTdGF0ZShudWxsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTb29uLnNjaGVkdWxlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fc2V0U3RhdGUobnVsbCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoZSkgPT4ge1xuXHRcdFx0dGhpcy5fc2V0U3RhdGUobnVsbCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2lzRW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVNvb24uc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Y29uc3QgZmluZENvbnRyb2xsZXIgPSBDb21tb25GaW5kQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoZmluZENvbnRyb2xsZXIpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCkub25GaW5kUmVwbGFjZVN0YXRlQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZVNvb24uc2NoZWR1bGUoKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXRTdGF0ZShTZWxlY3Rpb25IaWdobGlnaHRlci5fY3JlYXRlU3RhdGUodGhpcy5zdGF0ZSwgdGhpcy5faXNFbmFibGVkLCB0aGlzLmVkaXRvcikpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NyZWF0ZVN0YXRlKG9sZFN0YXRlOiBTZWxlY3Rpb25IaWdobGlnaHRlclN0YXRlIHwgbnVsbCwgaXNFbmFibGVkOiBib29sZWFuLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogU2VsZWN0aW9uSGlnaGxpZ2h0ZXJTdGF0ZSB8IG51bGwge1xuXHRcdGlmICghaXNFbmFibGVkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IHMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0aWYgKHMuc3RhcnRMaW5lTnVtYmVyICE9PSBzLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdC8vIG11bHRpbGluZSBmb3JiaWRkZW4gZm9yIHBlcmYgcmVhc29uc1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IG11bHRpQ3Vyc29yQ29udHJvbGxlciA9IE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIW11bHRpQ3Vyc29yQ29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gQ29tbW9uRmluZENvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFmaW5kQ29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGxldCByID0gbXVsdGlDdXJzb3JDb250cm9sbGVyLmdldFNlc3Npb24oZmluZENvbnRyb2xsZXIpO1xuXHRcdGlmICghcikge1xuXHRcdFx0Y29uc3QgYWxsU2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRpZiAoYWxsU2VsZWN0aW9ucy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCk7XG5cdFx0XHRcdGNvbnN0IG1hdGNoQ2FzZSA9IGZpbmRTdGF0ZS5tYXRjaENhc2U7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbnNDb250YWluU2FtZVRleHQgPSBtb2RlbFJhbmdlc0NvbnRhaW5TYW1lVGV4dChlZGl0b3IuZ2V0TW9kZWwoKSwgYWxsU2VsZWN0aW9ucywgbWF0Y2hDYXNlKTtcblx0XHRcdFx0aWYgKCFzZWxlY3Rpb25zQ29udGFpblNhbWVUZXh0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ciA9IE11bHRpQ3Vyc29yU2Vzc2lvbi5jcmVhdGUoZWRpdG9yLCBmaW5kQ29udHJvbGxlcik7XG5cdFx0fVxuXHRcdGlmICghcikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKHIuY3VycmVudE1hdGNoKSB7XG5cdFx0XHQvLyBUaGlzIGlzIGFuIGVtcHR5IHNlbGVjdGlvblxuXHRcdFx0Ly8gRG8gbm90IGludGVyZmVyZSB3aXRoIHNlbWFudGljIHdvcmQgaGlnaGxpZ2h0aW5nIGluIHRoZSBubyBzZWxlY3Rpb24gY2FzZVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICgvXlsgXFx0XSskLy50ZXN0KHIuc2VhcmNoVGV4dCkpIHtcblx0XHRcdC8vIHdoaXRlc3BhY2Ugb25seSBzZWxlY3Rpb25cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoci5zZWFyY2hUZXh0Lmxlbmd0aCA+IDIwMCkge1xuXHRcdFx0Ly8gdmVyeSBsb25nIHNlbGVjdGlvblxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gVE9ETzogYmV0dGVyIGhhbmRsaW5nIG9mIHRoaXMgY2FzZVxuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCk7XG5cdFx0Y29uc3QgY2FzZVNlbnNpdGl2ZSA9IGZpbmRTdGF0ZS5tYXRjaENhc2U7XG5cblx0XHQvLyBSZXR1cm4gZWFybHkgaWYgdGhlIGZpbmQgd2lkZ2V0IHNob3dzIHRoZSBleGFjdCBzYW1lIG1hdGNoZXNcblx0XHRpZiAoZmluZFN0YXRlLmlzUmV2ZWFsZWQpIHtcblx0XHRcdGxldCBmaW5kU3RhdGVTZWFyY2hTdHJpbmcgPSBmaW5kU3RhdGUuc2VhcmNoU3RyaW5nO1xuXHRcdFx0aWYgKCFjYXNlU2Vuc2l0aXZlKSB7XG5cdFx0XHRcdGZpbmRTdGF0ZVNlYXJjaFN0cmluZyA9IGZpbmRTdGF0ZVNlYXJjaFN0cmluZy50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgbXlTZWFyY2hTdHJpbmcgPSByLnNlYXJjaFRleHQ7XG5cdFx0XHRpZiAoIWNhc2VTZW5zaXRpdmUpIHtcblx0XHRcdFx0bXlTZWFyY2hTdHJpbmcgPSBteVNlYXJjaFN0cmluZy50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZmluZFN0YXRlU2VhcmNoU3RyaW5nID09PSBteVNlYXJjaFN0cmluZyAmJiByLm1hdGNoQ2FzZSA9PT0gZmluZFN0YXRlLm1hdGNoQ2FzZSAmJiByLndob2xlV29yZCA9PT0gZmluZFN0YXRlLndob2xlV29yZCAmJiAhZmluZFN0YXRlLmlzUmVnZXgpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb25IaWdobGlnaHRlclN0YXRlKGVkaXRvci5nZXRNb2RlbCgpLCByLnNlYXJjaFRleHQsIHIubWF0Y2hDYXNlLCByLndob2xlV29yZCA/IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSA6IG51bGwsIG9sZFN0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldFN0YXRlKG5ld1N0YXRlOiBTZWxlY3Rpb25IaWdobGlnaHRlclN0YXRlIHwgbnVsbCk6IHZvaWQge1xuXHRcdHRoaXMuc3RhdGUgPSBuZXdTdGF0ZTtcblxuXHRcdGlmICghdGhpcy5zdGF0ZSkge1xuXHRcdFx0dGhpcy5fZGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsLmlzVG9vTGFyZ2VGb3JUb2tlbml6YXRpb24oKSkge1xuXHRcdFx0Ly8gdGhlIGZpbGUgaXMgdG9vIGxhcmdlLCBzbyBzZWFyY2hpbmcgd29yZCB1bmRlciBjdXJzb3IgaW4gdGhlIHdob2xlIGRvY3VtZW50IHdvdWxkIGJlIGJsb2NraW5nIHRoZSBVSS5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhbGxNYXRjaGVzID0gdGhpcy5zdGF0ZS5maW5kTWF0Y2hlcygpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRzZWxlY3Rpb25zLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblxuXHRcdC8vIGRvIG5vdCBvdmVybGFwIHdpdGggc2VsZWN0aW9uIChpc3N1ZSAjNjQgYW5kICM1MTIpXG5cdFx0Y29uc3QgbWF0Y2hlczogUmFuZ2VbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBqID0gMCwgbGVuID0gYWxsTWF0Y2hlcy5sZW5ndGgsIGxlbkogPSBzZWxlY3Rpb25zLmxlbmd0aDsgaSA8IGxlbjspIHtcblx0XHRcdGNvbnN0IG1hdGNoID0gYWxsTWF0Y2hlc1tpXTtcblxuXHRcdFx0aWYgKGogPj0gbGVuSikge1xuXHRcdFx0XHQvLyBmaW5pc2hlZCBhbGwgZWRpdG9yIHNlbGVjdGlvbnNcblx0XHRcdFx0bWF0Y2hlcy5wdXNoKG1hdGNoKTtcblx0XHRcdFx0aSsrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgY21wID0gUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKG1hdGNoLCBzZWxlY3Rpb25zW2pdKTtcblx0XHRcdFx0aWYgKGNtcCA8IDApIHtcblx0XHRcdFx0XHQvLyBtYXRjaCBpcyBiZWZvcmUgc2VsXG5cdFx0XHRcdFx0aWYgKHNlbGVjdGlvbnNbal0uaXNFbXB0eSgpIHx8ICFSYW5nZS5hcmVJbnRlcnNlY3RpbmcobWF0Y2gsIHNlbGVjdGlvbnNbal0pKSB7XG5cdFx0XHRcdFx0XHRtYXRjaGVzLnB1c2gobWF0Y2gpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpKys7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY21wID4gMCkge1xuXHRcdFx0XHRcdC8vIHNlbCBpcyBiZWZvcmUgbWF0Y2hcblx0XHRcdFx0XHRqKys7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gc2VsIGlzIGVxdWFsIHRvIG1hdGNoXG5cdFx0XHRcdFx0aSsrO1xuXHRcdFx0XHRcdGorKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG9jY3VycmVuY2VIaWdobGlnaHRpbmc6IGJvb2xlYW4gPSB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLm9jY3VycmVuY2VzSGlnaGxpZ2h0KSAhPT0gJ29mZic7XG5cdFx0Y29uc3QgaGFzU2VtYW50aWNIaWdobGlnaHRzID0gdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRIaWdobGlnaHRQcm92aWRlci5oYXMobW9kZWwpICYmIG9jY3VycmVuY2VIaWdobGlnaHRpbmc7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSBtYXRjaGVzLm1hcChyID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiByLFxuXHRcdFx0XHRvcHRpb25zOiBnZXRTZWxlY3Rpb25IaWdobGlnaHREZWNvcmF0aW9uT3B0aW9ucyhoYXNTZW1hbnRpY0hpZ2hsaWdodHMpXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMuc2V0KGRlY29yYXRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3NldFN0YXRlKG51bGwpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBtb2RlbFJhbmdlc0NvbnRhaW5TYW1lVGV4dChtb2RlbDogSVRleHRNb2RlbCwgcmFuZ2VzOiBSYW5nZVtdLCBtYXRjaENhc2U6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0Y29uc3Qgc2VsZWN0ZWRUZXh0ID0gZ2V0VmFsdWVJblJhbmdlKG1vZGVsLCByYW5nZXNbMF0sICFtYXRjaENhc2UpO1xuXHRmb3IgKGxldCBpID0gMSwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0Y29uc3QgcmFuZ2UgPSByYW5nZXNbaV07XG5cdFx0aWYgKHJhbmdlLmlzRW1wdHkoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCB0aGlzU2VsZWN0ZWRUZXh0ID0gZ2V0VmFsdWVJblJhbmdlKG1vZGVsLCByYW5nZSwgIW1hdGNoQ2FzZSk7XG5cdFx0aWYgKHNlbGVjdGVkVGV4dCAhPT0gdGhpc1NlbGVjdGVkVGV4dCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWVJblJhbmdlKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZTogUmFuZ2UsIHRvTG93ZXJDYXNlOiBib29sZWFuKTogc3RyaW5nIHtcblx0Y29uc3QgdGV4dCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSk7XG5cdHJldHVybiAodG9Mb3dlckNhc2UgPyB0ZXh0LnRvTG93ZXJDYXNlKCkgOiB0ZXh0KTtcbn1cblxuZXhwb3J0IGNsYXNzIEZvY3VzTmV4dEN1cnNvciBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5mb2N1c05leHRDdXJzb3InLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ211dGxpY3Vyc29yLmZvY3VzTmV4dEN1cnNvcicsIFwiRm9jdXMgTmV4dCBDdXJzb3JcIiksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtdXRsaWN1cnNvci5mb2N1c05leHRDdXJzb3IuZGVzY3JpcHRpb24nLCBcIkZvY3VzZXMgdGhlIG5leHQgY3Vyc29yXCIpLFxuXHRcdFx0XHRhcmdzOiBbXSxcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCk7XG5cblx0XHRpZiAodmlld01vZGVsLmN1cnNvckNvbmZpZy5yZWFkT25seSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZpZXdNb2RlbC5tb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0Y29uc3QgcHJldmlvdXNDdXJzb3JTdGF0ZSA9IEFycmF5LmZyb20odmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpKTtcblx0XHRjb25zdCBmaXJzdEN1cnNvciA9IHByZXZpb3VzQ3Vyc29yU3RhdGUuc2hpZnQoKTtcblx0XHRpZiAoIWZpcnN0Q3Vyc29yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHByZXZpb3VzQ3Vyc29yU3RhdGUucHVzaChmaXJzdEN1cnNvcik7XG5cblx0XHR2aWV3TW9kZWwuc2V0Q3Vyc29yU3RhdGVzKGFyZ3Muc291cmNlLCBDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsIHByZXZpb3VzQ3Vyc29yU3RhdGUpO1xuXHRcdHZpZXdNb2RlbC5yZXZlYWxQcmltYXJ5Q3Vyc29yKGFyZ3Muc291cmNlLCB0cnVlKTtcblx0XHRhbm5vdW5jZUN1cnNvckNoYW5nZShwcmV2aW91c0N1cnNvclN0YXRlLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGb2N1c1ByZXZpb3VzQ3Vyc29yIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmZvY3VzUHJldmlvdXNDdXJzb3InLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ211dGxpY3Vyc29yLmZvY3VzUHJldmlvdXNDdXJzb3InLCBcIkZvY3VzIFByZXZpb3VzIEN1cnNvclwiKSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ211dGxpY3Vyc29yLmZvY3VzUHJldmlvdXNDdXJzb3IuZGVzY3JpcHRpb24nLCBcIkZvY3VzZXMgdGhlIHByZXZpb3VzIGN1cnNvclwiKSxcblx0XHRcdFx0YXJnczogW10sXG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3TW9kZWwgPSBlZGl0b3IuX2dldFZpZXdNb2RlbCgpO1xuXG5cdFx0aWYgKHZpZXdNb2RlbC5jdXJzb3JDb25maWcucmVhZE9ubHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdGNvbnN0IHByZXZpb3VzQ3Vyc29yU3RhdGUgPSBBcnJheS5mcm9tKHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKSk7XG5cdFx0Y29uc3QgZmlyc3RDdXJzb3IgPSBwcmV2aW91c0N1cnNvclN0YXRlLnBvcCgpO1xuXHRcdGlmICghZmlyc3RDdXJzb3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cHJldmlvdXNDdXJzb3JTdGF0ZS51bnNoaWZ0KGZpcnN0Q3Vyc29yKTtcblxuXHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoYXJncy5zb3VyY2UsIEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCwgcHJldmlvdXNDdXJzb3JTdGF0ZSk7XG5cdFx0dmlld01vZGVsLnJldmVhbFByaW1hcnlDdXJzb3IoYXJncy5zb3VyY2UsIHRydWUpO1xuXHRcdGFubm91bmNlQ3Vyc29yQ2hhbmdlKHByZXZpb3VzQ3Vyc29yU3RhdGUsIHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKSk7XG5cdH1cbn1cblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyLklELCBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uTGF6eSk7XG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihTZWxlY3Rpb25IaWdobGlnaHRlci5JRCwgU2VsZWN0aW9uSGlnaGxpZ2h0ZXIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uQWZ0ZXJGaXJzdFJlbmRlcik7XG5cbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEluc2VydEN1cnNvckFib3ZlKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEluc2VydEN1cnNvckJlbG93KTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEluc2VydEN1cnNvckF0RW5kT2ZFYWNoTGluZVNlbGVjdGVkKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihBZGRTZWxlY3Rpb25Ub1ByZXZpb3VzRmluZE1hdGNoQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKE1vdmVTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oTW92ZVNlbGVjdGlvblRvUHJldmlvdXNGaW5kTWF0Y2hBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oU2VsZWN0SGlnaGxpZ2h0c0FjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihDb21wYXRDaGFuZ2VBbGwpO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oSW5zZXJ0Q3Vyc29yQXRFbmRPZkxpbmVTZWxlY3RlZCk7XG5yZWdpc3RlckVkaXRvckFjdGlvbihJbnNlcnRDdXJzb3JBdFRvcE9mTGluZVNlbGVjdGVkKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEZvY3VzTmV4dEN1cnNvcik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihGb2N1c1ByZXZpb3VzQ3Vyc29yKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsVUFBVSxTQUFTLGNBQWM7QUFDMUMsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLGlCQUFpQjtBQUUxQixTQUFTLGNBQWMsaUNBQWlDLHNCQUFzQixrQ0FBb0Q7QUFDbEksU0FBUyxvQkFBb0I7QUFFN0IsU0FBUywwQkFBd0Q7QUFDakUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxhQUFh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
