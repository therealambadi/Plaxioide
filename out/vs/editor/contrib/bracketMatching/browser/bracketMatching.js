import { RunOnceScheduler } from "../../../../base/common/async.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import "./bracketMatching.css";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { OverviewRulerLane, TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import * as nls from "../../../../nls.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
const overviewRulerBracketMatchForeground = registerColor("editorOverviewRuler.bracketMatchForeground", "#A0A0A0", nls.localize("overviewRulerBracketMatchForeground", "Overview ruler marker color for matching brackets."));
class JumpToBracketAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.jumpToBracket",
      label: nls.localize2("smartSelect.jumpBracket", "Go to Bracket"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backslash,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    BracketMatchingController.get(editor)?.jumpToBracket();
  }
}
class SelectToBracketAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.selectToBracket",
      label: nls.localize2("smartSelect.selectToBracket", "Select to Bracket"),
      precondition: void 0,
      metadata: {
        description: nls.localize2("smartSelect.selectToBracketDescription", "Select the text inside and including the brackets or curly braces"),
        args: [{
          name: "args",
          schema: {
            type: "object",
            properties: {
              "selectBrackets": {
                type: "boolean",
                default: true
              }
            }
          }
        }]
      }
    });
  }
  run(accessor, editor, args) {
    let selectBrackets = true;
    if (args && args.selectBrackets === false) {
      selectBrackets = false;
    }
    BracketMatchingController.get(editor)?.selectToBracket(selectBrackets);
  }
}
class RemoveBracketsAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.removeBrackets",
      label: nls.localize2("smartSelect.removeBrackets", "Remove Brackets"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Backspace,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    BracketMatchingController.get(editor)?.removeBrackets(this.id);
  }
}
class BracketsData {
  constructor(position, brackets, options) {
    this.position = position;
    this.brackets = brackets;
    this.options = options;
  }
}
const _BracketMatchingController = class _BracketMatchingController extends Disposable {
  static get(editor) {
    return editor.getContribution(_BracketMatchingController.ID);
  }
  constructor(editor) {
    super();
    this._editor = editor;
    this._lastBracketsData = [];
    this._lastVersionId = 0;
    this._decorations = this._editor.createDecorationsCollection();
    this._updateBracketsSoon = this._register(new RunOnceScheduler(() => this._updateBrackets(), 50));
    this._matchBrackets = this._editor.getOption(EditorOption.matchBrackets);
    this._updateBracketsSoon.schedule();
    this._register(editor.onDidChangeCursorPosition((e) => {
      if (this._matchBrackets === "never") {
        return;
      }
      this._updateBracketsSoon.schedule();
    }));
    this._register(editor.onDidChangeModelContent((e) => {
      this._updateBracketsSoon.schedule();
    }));
    this._register(editor.onDidChangeModel((e) => {
      this._lastBracketsData = [];
      this._updateBracketsSoon.schedule();
    }));
    this._register(editor.onDidChangeModelLanguageConfiguration((e) => {
      this._lastBracketsData = [];
      this._updateBracketsSoon.schedule();
    }));
    this._register(editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.matchBrackets)) {
        this._matchBrackets = this._editor.getOption(EditorOption.matchBrackets);
        this._decorations.clear();
        this._lastBracketsData = [];
        this._lastVersionId = 0;
        this._updateBracketsSoon.schedule();
      }
    }));
    this._register(editor.onDidBlurEditorWidget(() => {
      this._updateBracketsSoon.schedule();
    }));
    this._register(editor.onDidFocusEditorWidget(() => {
      this._updateBracketsSoon.schedule();
    }));
  }
  jumpToBracket() {
    if (!this._editor.hasModel()) {
      return;
    }
    const model = this._editor.getModel();
    const newSelections = this._editor.getSelections().map((selection) => {
      const position = selection.getStartPosition();
      const brackets = model.bracketPairs.matchBracket(position);
      let newCursorPosition = null;
      if (brackets) {
        if (brackets[0].containsPosition(position) && !brackets[1].containsPosition(position)) {
          newCursorPosition = brackets[1].getStartPosition();
        } else if (brackets[1].containsPosition(position)) {
          newCursorPosition = brackets[0].getStartPosition();
        }
      } else {
        const enclosingBrackets = model.bracketPairs.findEnclosingBrackets(position);
        if (enclosingBrackets) {
          newCursorPosition = enclosingBrackets[1].getStartPosition();
        } else {
          const nextBracket = model.bracketPairs.findNextBracket(position);
          if (nextBracket && nextBracket.range) {
            newCursorPosition = nextBracket.range.getStartPosition();
          }
        }
      }
      if (newCursorPosition) {
        return new Selection(newCursorPosition.lineNumber, newCursorPosition.column, newCursorPosition.lineNumber, newCursorPosition.column);
      }
      return new Selection(position.lineNumber, position.column, position.lineNumber, position.column);
    });
    this._editor.setSelections(newSelections);
    this._editor.revealRange(newSelections[0]);
  }
  selectToBracket(selectBrackets) {
    if (!this._editor.hasModel()) {
      return;
    }
    const model = this._editor.getModel();
    const newSelections = [];
    this._editor.getSelections().forEach((selection) => {
      const position = selection.getStartPosition();
      let brackets = model.bracketPairs.matchBracket(position);
      if (!brackets) {
        brackets = model.bracketPairs.findEnclosingBrackets(position);
        if (!brackets) {
          const nextBracket = model.bracketPairs.findNextBracket(position);
          if (nextBracket && nextBracket.range) {
            brackets = model.bracketPairs.matchBracket(nextBracket.range.getStartPosition());
          }
        }
      }
      let selectFrom = null;
      let selectTo = null;
      if (brackets) {
        brackets.sort(Range.compareRangesUsingStarts);
        const [open, close] = brackets;
        selectFrom = selectBrackets ? open.getStartPosition() : open.getEndPosition();
        selectTo = selectBrackets ? close.getEndPosition() : close.getStartPosition();
        if (close.containsPosition(position)) {
          const tmp = selectFrom;
          selectFrom = selectTo;
          selectTo = tmp;
        }
      }
      if (selectFrom && selectTo) {
        newSelections.push(new Selection(selectFrom.lineNumber, selectFrom.column, selectTo.lineNumber, selectTo.column));
      }
    });
    if (newSelections.length > 0) {
      this._editor.setSelections(newSelections);
      this._editor.revealRange(newSelections[0]);
    }
  }
  removeBrackets(editSource) {
    if (!this._editor.hasModel()) {
      return;
    }
    const model = this._editor.getModel();
    this._editor.getSelections().forEach((selection) => {
      const position = selection.getPosition();
      let brackets = model.bracketPairs.matchBracket(position);
      if (!brackets) {
        brackets = model.bracketPairs.findEnclosingBrackets(position);
      }
      if (brackets) {
        this._editor.pushUndoStop();
        this._editor.executeEdits(
          editSource,
          [
            { range: brackets[0], text: "" },
            { range: brackets[1], text: "" }
          ]
        );
        this._editor.pushUndoStop();
      }
    });
  }
  _updateBrackets() {
    if (this._matchBrackets === "never") {
      return;
    }
    this._recomputeBrackets();
    const newDecorations = [];
    let newDecorationsLen = 0;
    for (const bracketData of this._lastBracketsData) {
      const brackets = bracketData.brackets;
      if (brackets) {
        newDecorations[newDecorationsLen++] = { range: brackets[0], options: bracketData.options };
        newDecorations[newDecorationsLen++] = { range: brackets[1], options: bracketData.options };
      }
    }
    this._decorations.set(newDecorations);
  }
  _recomputeBrackets() {
    if (!this._editor.hasModel() || !this._editor.hasWidgetFocus()) {
      this._lastBracketsData = [];
      this._lastVersionId = 0;
      return;
    }
    const selections = this._editor.getSelections();
    if (selections.length > 100) {
      this._lastBracketsData = [];
      this._lastVersionId = 0;
      return;
    }
    const model = this._editor.getModel();
    const versionId = model.getVersionId();
    let previousData = [];
    if (this._lastVersionId === versionId) {
      previousData = this._lastBracketsData;
    }
    const positions = [];
    let positionsLen = 0;
    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i];
      if (selection.isEmpty()) {
        positions[positionsLen++] = selection.getStartPosition();
      }
    }
    if (positions.length > 1) {
      positions.sort(Position.compare);
    }
    const newData = [];
    let newDataLen = 0;
    let previousIndex = 0;
    const previousLen = previousData.length;
    for (let i = 0, len = positions.length; i < len; i++) {
      const position = positions[i];
      while (previousIndex < previousLen && previousData[previousIndex].position.isBefore(position)) {
        previousIndex++;
      }
      if (previousIndex < previousLen && previousData[previousIndex].position.equals(position)) {
        newData[newDataLen++] = previousData[previousIndex];
      } else {
        let brackets = model.bracketPairs.matchBracket(
          position,
          20
          /* give at most 20ms to compute */
        );
        let options = _BracketMatchingController._DECORATION_OPTIONS_WITH_OVERVIEW_RULER;
        if (!brackets && this._matchBrackets === "always") {
          brackets = model.bracketPairs.findEnclosingBrackets(
            position,
            20
            /* give at most 20ms to compute */
          );
          options = _BracketMatchingController._DECORATION_OPTIONS_WITHOUT_OVERVIEW_RULER;
        }
        newData[newDataLen++] = new BracketsData(position, brackets, options);
      }
    }
    this._lastBracketsData = newData;
    this._lastVersionId = versionId;
  }
};
_BracketMatchingController.ID = "editor.contrib.bracketMatchingController";
_BracketMatchingController._DECORATION_OPTIONS_WITH_OVERVIEW_RULER = ModelDecorationOptions.register({
  description: "bracket-match-overview",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  className: "bracket-match",
  overviewRuler: {
    color: themeColorFromId(overviewRulerBracketMatchForeground),
    position: OverviewRulerLane.Center
  }
});
_BracketMatchingController._DECORATION_OPTIONS_WITHOUT_OVERVIEW_RULER = ModelDecorationOptions.register({
  description: "bracket-match-no-overview",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  className: "bracket-match"
});
let BracketMatchingController = _BracketMatchingController;
registerEditorContribution(BracketMatchingController.ID, BracketMatchingController, EditorContributionInstantiation.AfterFirstRender);
registerEditorAction(SelectToBracketAction);
registerEditorAction(JumpToBracketAction);
registerEditorAction(RemoveBracketsAction);
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
  group: "5_infile_nav",
  command: {
    id: "editor.action.jumpToBracket",
    title: nls.localize({ key: "miGoToBracket", comment: ["&& denotes a mnemonic"] }, "Go to &&Bracket")
  },
  order: 2
});
export {
  BracketMatchingController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9icmFja2V0TWF0Y2hpbmcvYnJvd3Nlci9icmFja2V0TWF0Y2hpbmcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgJy4vYnJhY2tldE1hdGNoaW5nLmNzcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIHJlZ2lzdGVyRWRpdG9yQWN0aW9uLCByZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbiwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uLCBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWx0YURlY29yYXRpb24sIE92ZXJ2aWV3UnVsZXJMYW5lLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyB0aGVtZUNvbG9yRnJvbUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5cbmNvbnN0IG92ZXJ2aWV3UnVsZXJCcmFja2V0TWF0Y2hGb3JlZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignZWRpdG9yT3ZlcnZpZXdSdWxlci5icmFja2V0TWF0Y2hGb3JlZ3JvdW5kJywgJyNBMEEwQTAnLCBubHMubG9jYWxpemUoJ292ZXJ2aWV3UnVsZXJCcmFja2V0TWF0Y2hGb3JlZ3JvdW5kJywgJ092ZXJ2aWV3IHJ1bGVyIG1hcmtlciBjb2xvciBmb3IgbWF0Y2hpbmcgYnJhY2tldHMuJykpO1xuXG5jbGFzcyBKdW1wVG9CcmFja2V0QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmp1bXBUb0JyYWNrZXQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3NtYXJ0U2VsZWN0Lmp1bXBCcmFja2V0JywgXCJHbyB0byBCcmFja2V0XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CYWNrc2xhc2gsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0QnJhY2tldE1hdGNoaW5nQ29udHJvbGxlci5nZXQoZWRpdG9yKT8uanVtcFRvQnJhY2tldCgpO1xuXHR9XG59XG5cbmNsYXNzIFNlbGVjdFRvQnJhY2tldEFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5zZWxlY3RUb0JyYWNrZXQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3NtYXJ0U2VsZWN0LnNlbGVjdFRvQnJhY2tldCcsIFwiU2VsZWN0IHRvIEJyYWNrZXRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdzbWFydFNlbGVjdC5zZWxlY3RUb0JyYWNrZXREZXNjcmlwdGlvbicsIFwiU2VsZWN0IHRoZSB0ZXh0IGluc2lkZSBhbmQgaW5jbHVkaW5nIHRoZSBicmFja2V0cyBvciBjdXJseSBicmFjZXNcIiksXG5cdFx0XHRcdGFyZ3M6IFt7XG5cdFx0XHRcdFx0bmFtZTogJ2FyZ3MnLFxuXHRcdFx0XHRcdHNjaGVtYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdCdzZWxlY3RCcmFja2V0cyc6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdGxldCBzZWxlY3RCcmFja2V0cyA9IHRydWU7XG5cdFx0aWYgKGFyZ3MgJiYgYXJncy5zZWxlY3RCcmFja2V0cyA9PT0gZmFsc2UpIHtcblx0XHRcdHNlbGVjdEJyYWNrZXRzID0gZmFsc2U7XG5cdFx0fVxuXHRcdEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXIuZ2V0KGVkaXRvcik/LnNlbGVjdFRvQnJhY2tldChzZWxlY3RCcmFja2V0cyk7XG5cdH1cbn1cbmNsYXNzIFJlbW92ZUJyYWNrZXRzQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLnJlbW92ZUJyYWNrZXRzJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdzbWFydFNlbGVjdC5yZW1vdmVCcmFja2V0cycsIFwiUmVtb3ZlIEJyYWNrZXRzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuQmFja3NwYWNlLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXIuZ2V0KGVkaXRvcik/LnJlbW92ZUJyYWNrZXRzKHRoaXMuaWQpO1xuXHR9XG59XG5cbnR5cGUgQnJhY2tldHMgPSBbUmFuZ2UsIFJhbmdlXTtcblxuY2xhc3MgQnJhY2tldHNEYXRhIHtcblx0cHVibGljIHJlYWRvbmx5IHBvc2l0aW9uOiBQb3NpdGlvbjtcblx0cHVibGljIHJlYWRvbmx5IGJyYWNrZXRzOiBCcmFja2V0cyB8IG51bGw7XG5cdHB1YmxpYyByZWFkb25seSBvcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXG5cdGNvbnN0cnVjdG9yKHBvc2l0aW9uOiBQb3NpdGlvbiwgYnJhY2tldHM6IEJyYWNrZXRzIHwgbnVsbCwgb3B0aW9uczogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucykge1xuXHRcdHRoaXMucG9zaXRpb24gPSBwb3NpdGlvbjtcblx0XHR0aGlzLmJyYWNrZXRzID0gYnJhY2tldHM7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQnJhY2tldE1hdGNoaW5nQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5icmFja2V0TWF0Y2hpbmdDb250cm9sbGVyJztcblxuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogQnJhY2tldE1hdGNoaW5nQ29udHJvbGxlciB8IG51bGwge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXI+KEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXIuSUQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcjtcblxuXHRwcml2YXRlIF9sYXN0QnJhY2tldHNEYXRhOiBCcmFja2V0c0RhdGFbXTtcblx0cHJpdmF0ZSBfbGFzdFZlcnNpb25JZDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uczogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBfdXBkYXRlQnJhY2tldHNTb29uOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIF9tYXRjaEJyYWNrZXRzOiAnbmV2ZXInIHwgJ25lYXInIHwgJ2Fsd2F5cyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvclxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2VkaXRvciA9IGVkaXRvcjtcblx0XHR0aGlzLl9sYXN0QnJhY2tldHNEYXRhID0gW107XG5cdFx0dGhpcy5fbGFzdFZlcnNpb25JZCA9IDA7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMgPSB0aGlzLl9lZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cdFx0dGhpcy5fdXBkYXRlQnJhY2tldHNTb29uID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5fdXBkYXRlQnJhY2tldHMoKSwgNTApKTtcblx0XHR0aGlzLl9tYXRjaEJyYWNrZXRzID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubWF0Y2hCcmFja2V0cyk7XG5cblx0XHR0aGlzLl91cGRhdGVCcmFja2V0c1Nvb24uc2NoZWR1bGUoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbigoZSkgPT4ge1xuXG5cdFx0XHRpZiAodGhpcy5fbWF0Y2hCcmFja2V0cyA9PT0gJ25ldmVyJykge1xuXHRcdFx0XHQvLyBFYXJseSBleGl0IGlmIG5vdGhpbmcgbmVlZHMgdG8gYmUgZG9uZSFcblx0XHRcdFx0Ly8gTGVhdmUgc29tZSBmb3JtIG9mIGVhcmx5IGV4aXQgY2hlY2sgaGVyZSBpZiB5b3Ugd2lzaCB0byBjb250aW51ZSBiZWluZyBhIGN1cnNvciBwb3NpdGlvbiBjaGFuZ2UgbGlzdGVuZXIgOylcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl91cGRhdGVCcmFja2V0c1Nvb24uc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KChlKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVCcmFja2V0c1Nvb24uc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKGUpID0+IHtcblx0XHRcdHRoaXMuX2xhc3RCcmFja2V0c0RhdGEgPSBbXTtcblx0XHRcdHRoaXMuX3VwZGF0ZUJyYWNrZXRzU29vbi5zY2hlZHVsZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0dGhpcy5fbGFzdEJyYWNrZXRzRGF0YSA9IFtdO1xuXHRcdFx0dGhpcy5fdXBkYXRlQnJhY2tldHNTb29uLnNjaGVkdWxlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGUpID0+IHtcblx0XHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLm1hdGNoQnJhY2tldHMpKSB7XG5cdFx0XHRcdHRoaXMuX21hdGNoQnJhY2tldHMgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5tYXRjaEJyYWNrZXRzKTtcblx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5fbGFzdEJyYWNrZXRzRGF0YSA9IFtdO1xuXHRcdFx0XHR0aGlzLl9sYXN0VmVyc2lvbklkID0gMDtcblx0XHRcdFx0dGhpcy5fdXBkYXRlQnJhY2tldHNTb29uLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQmx1ckVkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVCcmFja2V0c1Nvb24uc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVCcmFja2V0c1Nvb24uc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMganVtcFRvQnJhY2tldCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBuZXdTZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKS5tYXAoc2VsZWN0aW9uID0+IHtcblx0XHRcdGNvbnN0IHBvc2l0aW9uID0gc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKTtcblxuXHRcdFx0Ly8gZmluZCBtYXRjaGluZyBicmFja2V0cyBpZiBwb3NpdGlvbiBpcyBvbiBhIGJyYWNrZXRcblx0XHRcdGNvbnN0IGJyYWNrZXRzID0gbW9kZWwuYnJhY2tldFBhaXJzLm1hdGNoQnJhY2tldChwb3NpdGlvbik7XG5cdFx0XHRsZXQgbmV3Q3Vyc29yUG9zaXRpb246IFBvc2l0aW9uIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRpZiAoYnJhY2tldHMpIHtcblx0XHRcdFx0aWYgKGJyYWNrZXRzWzBdLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pICYmICFicmFja2V0c1sxXS5jb250YWluc1Bvc2l0aW9uKHBvc2l0aW9uKSkge1xuXHRcdFx0XHRcdG5ld0N1cnNvclBvc2l0aW9uID0gYnJhY2tldHNbMV0uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGJyYWNrZXRzWzFdLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKSB7XG5cdFx0XHRcdFx0bmV3Q3Vyc29yUG9zaXRpb24gPSBicmFja2V0c1swXS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGZpbmQgdGhlIGVuY2xvc2luZyBicmFja2V0cyBpZiB0aGUgcG9zaXRpb24gaXNuJ3Qgb24gYSBtYXRjaGluZyBicmFja2V0XG5cdFx0XHRcdGNvbnN0IGVuY2xvc2luZ0JyYWNrZXRzID0gbW9kZWwuYnJhY2tldFBhaXJzLmZpbmRFbmNsb3NpbmdCcmFja2V0cyhwb3NpdGlvbik7XG5cdFx0XHRcdGlmIChlbmNsb3NpbmdCcmFja2V0cykge1xuXHRcdFx0XHRcdG5ld0N1cnNvclBvc2l0aW9uID0gZW5jbG9zaW5nQnJhY2tldHNbMV0uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIG5vIGVuY2xvc2luZyBicmFja2V0cywgdHJ5IHRoZSB2ZXJ5IGZpcnN0IG5leHQgYnJhY2tldFxuXHRcdFx0XHRcdGNvbnN0IG5leHRCcmFja2V0ID0gbW9kZWwuYnJhY2tldFBhaXJzLmZpbmROZXh0QnJhY2tldChwb3NpdGlvbik7XG5cdFx0XHRcdFx0aWYgKG5leHRCcmFja2V0ICYmIG5leHRCcmFja2V0LnJhbmdlKSB7XG5cdFx0XHRcdFx0XHRuZXdDdXJzb3JQb3NpdGlvbiA9IG5leHRCcmFja2V0LnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG5ld0N1cnNvclBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgU2VsZWN0aW9uKG5ld0N1cnNvclBvc2l0aW9uLmxpbmVOdW1iZXIsIG5ld0N1cnNvclBvc2l0aW9uLmNvbHVtbiwgbmV3Q3Vyc29yUG9zaXRpb24ubGluZU51bWJlciwgbmV3Q3Vyc29yUG9zaXRpb24uY29sdW1uKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBuZXcgU2VsZWN0aW9uKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX2VkaXRvci5zZXRTZWxlY3Rpb25zKG5ld1NlbGVjdGlvbnMpO1xuXHRcdHRoaXMuX2VkaXRvci5yZXZlYWxSYW5nZShuZXdTZWxlY3Rpb25zWzBdKTtcblx0fVxuXG5cdHB1YmxpYyBzZWxlY3RUb0JyYWNrZXQoc2VsZWN0QnJhY2tldHM6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBuZXdTZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSA9IFtdO1xuXG5cdFx0dGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKS5mb3JFYWNoKHNlbGVjdGlvbiA9PiB7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IHNlbGVjdGlvbi5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0XHRsZXQgYnJhY2tldHMgPSBtb2RlbC5icmFja2V0UGFpcnMubWF0Y2hCcmFja2V0KHBvc2l0aW9uKTtcblxuXHRcdFx0aWYgKCFicmFja2V0cykge1xuXHRcdFx0XHRicmFja2V0cyA9IG1vZGVsLmJyYWNrZXRQYWlycy5maW5kRW5jbG9zaW5nQnJhY2tldHMocG9zaXRpb24pO1xuXHRcdFx0XHRpZiAoIWJyYWNrZXRzKSB7XG5cdFx0XHRcdFx0Y29uc3QgbmV4dEJyYWNrZXQgPSBtb2RlbC5icmFja2V0UGFpcnMuZmluZE5leHRCcmFja2V0KHBvc2l0aW9uKTtcblx0XHRcdFx0XHRpZiAobmV4dEJyYWNrZXQgJiYgbmV4dEJyYWNrZXQucmFuZ2UpIHtcblx0XHRcdFx0XHRcdGJyYWNrZXRzID0gbW9kZWwuYnJhY2tldFBhaXJzLm1hdGNoQnJhY2tldChuZXh0QnJhY2tldC5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRsZXQgc2VsZWN0RnJvbTogUG9zaXRpb24gfCBudWxsID0gbnVsbDtcblx0XHRcdGxldCBzZWxlY3RUbzogUG9zaXRpb24gfCBudWxsID0gbnVsbDtcblxuXHRcdFx0aWYgKGJyYWNrZXRzKSB7XG5cdFx0XHRcdGJyYWNrZXRzLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblx0XHRcdFx0Y29uc3QgW29wZW4sIGNsb3NlXSA9IGJyYWNrZXRzO1xuXHRcdFx0XHRzZWxlY3RGcm9tID0gc2VsZWN0QnJhY2tldHMgPyBvcGVuLmdldFN0YXJ0UG9zaXRpb24oKSA6IG9wZW4uZ2V0RW5kUG9zaXRpb24oKTtcblx0XHRcdFx0c2VsZWN0VG8gPSBzZWxlY3RCcmFja2V0cyA/IGNsb3NlLmdldEVuZFBvc2l0aW9uKCkgOiBjbG9zZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cblx0XHRcdFx0aWYgKGNsb3NlLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKSB7XG5cdFx0XHRcdFx0Ly8gc2VsZWN0IGJhY2t3YXJkcyBpZiB0aGUgY3Vyc29yIHdhcyBvbiB0aGUgY2xvc2luZyBicmFja2V0XG5cdFx0XHRcdFx0Y29uc3QgdG1wID0gc2VsZWN0RnJvbTtcblx0XHRcdFx0XHRzZWxlY3RGcm9tID0gc2VsZWN0VG87XG5cdFx0XHRcdFx0c2VsZWN0VG8gPSB0bXA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHNlbGVjdEZyb20gJiYgc2VsZWN0VG8pIHtcblx0XHRcdFx0bmV3U2VsZWN0aW9ucy5wdXNoKG5ldyBTZWxlY3Rpb24oc2VsZWN0RnJvbS5saW5lTnVtYmVyLCBzZWxlY3RGcm9tLmNvbHVtbiwgc2VsZWN0VG8ubGluZU51bWJlciwgc2VsZWN0VG8uY29sdW1uKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAobmV3U2VsZWN0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3Iuc2V0U2VsZWN0aW9ucyhuZXdTZWxlY3Rpb25zKTtcblx0XHRcdHRoaXMuX2VkaXRvci5yZXZlYWxSYW5nZShuZXdTZWxlY3Rpb25zWzBdKTtcblx0XHR9XG5cdH1cblx0cHVibGljIHJlbW92ZUJyYWNrZXRzKGVkaXRTb3VyY2U/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHR0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9ucygpLmZvckVhY2goKHNlbGVjdGlvbikgPT4ge1xuXHRcdFx0Y29uc3QgcG9zaXRpb24gPSBzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblxuXHRcdFx0bGV0IGJyYWNrZXRzID0gbW9kZWwuYnJhY2tldFBhaXJzLm1hdGNoQnJhY2tldChwb3NpdGlvbik7XG5cdFx0XHRpZiAoIWJyYWNrZXRzKSB7XG5cdFx0XHRcdGJyYWNrZXRzID0gbW9kZWwuYnJhY2tldFBhaXJzLmZpbmRFbmNsb3NpbmdCcmFja2V0cyhwb3NpdGlvbik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYnJhY2tldHMpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IuZXhlY3V0ZUVkaXRzKFxuXHRcdFx0XHRcdGVkaXRTb3VyY2UsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0eyByYW5nZTogYnJhY2tldHNbMF0sIHRleHQ6ICcnIH0sXG5cdFx0XHRcdFx0XHR7IHJhbmdlOiBicmFja2V0c1sxXSwgdGV4dDogJycgfVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0RFQ09SQVRJT05fT1BUSU9OU19XSVRIX09WRVJWSUVXX1JVTEVSID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICdicmFja2V0LW1hdGNoLW92ZXJ2aWV3Jyxcblx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRjbGFzc05hbWU6ICdicmFja2V0LW1hdGNoJyxcblx0XHRvdmVydmlld1J1bGVyOiB7XG5cdFx0XHRjb2xvcjogdGhlbWVDb2xvckZyb21JZChvdmVydmlld1J1bGVyQnJhY2tldE1hdGNoRm9yZWdyb3VuZCksXG5cdFx0XHRwb3NpdGlvbjogT3ZlcnZpZXdSdWxlckxhbmUuQ2VudGVyXG5cdFx0fVxuXHR9KTtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfREVDT1JBVElPTl9PUFRJT05TX1dJVEhPVVRfT1ZFUlZJRVdfUlVMRVIgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRkZXNjcmlwdGlvbjogJ2JyYWNrZXQtbWF0Y2gtbm8tb3ZlcnZpZXcnLFxuXHRcdHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLFxuXHRcdGNsYXNzTmFtZTogJ2JyYWNrZXQtbWF0Y2gnXG5cdH0pO1xuXG5cdHByaXZhdGUgX3VwZGF0ZUJyYWNrZXRzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9tYXRjaEJyYWNrZXRzID09PSAnbmV2ZXInKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3JlY29tcHV0ZUJyYWNrZXRzKCk7XG5cblx0XHRjb25zdCBuZXdEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRsZXQgbmV3RGVjb3JhdGlvbnNMZW4gPSAwO1xuXHRcdGZvciAoY29uc3QgYnJhY2tldERhdGEgb2YgdGhpcy5fbGFzdEJyYWNrZXRzRGF0YSkge1xuXHRcdFx0Y29uc3QgYnJhY2tldHMgPSBicmFja2V0RGF0YS5icmFja2V0cztcblx0XHRcdGlmIChicmFja2V0cykge1xuXHRcdFx0XHRuZXdEZWNvcmF0aW9uc1tuZXdEZWNvcmF0aW9uc0xlbisrXSA9IHsgcmFuZ2U6IGJyYWNrZXRzWzBdLCBvcHRpb25zOiBicmFja2V0RGF0YS5vcHRpb25zIH07XG5cdFx0XHRcdG5ld0RlY29yYXRpb25zW25ld0RlY29yYXRpb25zTGVuKytdID0geyByYW5nZTogYnJhY2tldHNbMV0sIG9wdGlvbnM6IGJyYWNrZXREYXRhLm9wdGlvbnMgfTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9kZWNvcmF0aW9ucy5zZXQobmV3RGVjb3JhdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVjb21wdXRlQnJhY2tldHMoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCAhdGhpcy5fZWRpdG9yLmhhc1dpZGdldEZvY3VzKCkpIHtcblx0XHRcdC8vIG5vIG1vZGVsIG9yIG5vIGZvY3VzID0+IG5vIGJyYWNrZXRzIVxuXHRcdFx0dGhpcy5fbGFzdEJyYWNrZXRzRGF0YSA9IFtdO1xuXHRcdFx0dGhpcy5fbGFzdFZlcnNpb25JZCA9IDA7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0aWYgKHNlbGVjdGlvbnMubGVuZ3RoID4gMTAwKSB7XG5cdFx0XHQvLyBubyBicmFja2V0IG1hdGNoaW5nIGZvciBoaWdoIG51bWJlcnMgb2Ygc2VsZWN0aW9uc1xuXHRcdFx0dGhpcy5fbGFzdEJyYWNrZXRzRGF0YSA9IFtdO1xuXHRcdFx0dGhpcy5fbGFzdFZlcnNpb25JZCA9IDA7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCB2ZXJzaW9uSWQgPSBtb2RlbC5nZXRWZXJzaW9uSWQoKTtcblx0XHRsZXQgcHJldmlvdXNEYXRhOiBCcmFja2V0c0RhdGFbXSA9IFtdO1xuXHRcdGlmICh0aGlzLl9sYXN0VmVyc2lvbklkID09PSB2ZXJzaW9uSWQpIHtcblx0XHRcdC8vIHVzZSB0aGUgcHJldmlvdXMgZGF0YSBvbmx5IGlmIHRoZSBtb2RlbCBpcyBhdCB0aGUgc2FtZSB2ZXJzaW9uIGlkXG5cdFx0XHRwcmV2aW91c0RhdGEgPSB0aGlzLl9sYXN0QnJhY2tldHNEYXRhO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBvc2l0aW9uczogUG9zaXRpb25bXSA9IFtdO1xuXHRcdGxldCBwb3NpdGlvbnNMZW4gPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzZWxlY3Rpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBzZWxlY3Rpb25zW2ldO1xuXG5cdFx0XHRpZiAoc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0XHQvLyB3aWxsIGJyYWNrZXQgbWF0Y2ggYSBjdXJzb3Igb25seSBpZiB0aGUgc2VsZWN0aW9uIGlzIGNvbGxhcHNlZFxuXHRcdFx0XHRwb3NpdGlvbnNbcG9zaXRpb25zTGVuKytdID0gc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBzb3J0IHBvc2l0aW9ucyBmb3IgYHByZXZpb3VzRGF0YWAgY2FjaGUgaGl0c1xuXHRcdGlmIChwb3NpdGlvbnMubGVuZ3RoID4gMSkge1xuXHRcdFx0cG9zaXRpb25zLnNvcnQoUG9zaXRpb24uY29tcGFyZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3RGF0YTogQnJhY2tldHNEYXRhW10gPSBbXTtcblx0XHRsZXQgbmV3RGF0YUxlbiA9IDA7XG5cdFx0bGV0IHByZXZpb3VzSW5kZXggPSAwO1xuXHRcdGNvbnN0IHByZXZpb3VzTGVuID0gcHJldmlvdXNEYXRhLmxlbmd0aDtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcG9zaXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IHBvc2l0aW9uc1tpXTtcblxuXHRcdFx0d2hpbGUgKHByZXZpb3VzSW5kZXggPCBwcmV2aW91c0xlbiAmJiBwcmV2aW91c0RhdGFbcHJldmlvdXNJbmRleF0ucG9zaXRpb24uaXNCZWZvcmUocG9zaXRpb24pKSB7XG5cdFx0XHRcdHByZXZpb3VzSW5kZXgrKztcblx0XHRcdH1cblxuXHRcdFx0aWYgKHByZXZpb3VzSW5kZXggPCBwcmV2aW91c0xlbiAmJiBwcmV2aW91c0RhdGFbcHJldmlvdXNJbmRleF0ucG9zaXRpb24uZXF1YWxzKHBvc2l0aW9uKSkge1xuXHRcdFx0XHRuZXdEYXRhW25ld0RhdGFMZW4rK10gPSBwcmV2aW91c0RhdGFbcHJldmlvdXNJbmRleF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsZXQgYnJhY2tldHMgPSBtb2RlbC5icmFja2V0UGFpcnMubWF0Y2hCcmFja2V0KHBvc2l0aW9uLCAyMCAvKiBnaXZlIGF0IG1vc3QgMjBtcyB0byBjb21wdXRlICovKTtcblx0XHRcdFx0bGV0IG9wdGlvbnMgPSBCcmFja2V0TWF0Y2hpbmdDb250cm9sbGVyLl9ERUNPUkFUSU9OX09QVElPTlNfV0lUSF9PVkVSVklFV19SVUxFUjtcblx0XHRcdFx0aWYgKCFicmFja2V0cyAmJiB0aGlzLl9tYXRjaEJyYWNrZXRzID09PSAnYWx3YXlzJykge1xuXHRcdFx0XHRcdGJyYWNrZXRzID0gbW9kZWwuYnJhY2tldFBhaXJzLmZpbmRFbmNsb3NpbmdCcmFja2V0cyhwb3NpdGlvbiwgMjAgLyogZ2l2ZSBhdCBtb3N0IDIwbXMgdG8gY29tcHV0ZSAqLyk7XG5cdFx0XHRcdFx0b3B0aW9ucyA9IEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXIuX0RFQ09SQVRJT05fT1BUSU9OU19XSVRIT1VUX09WRVJWSUVXX1JVTEVSO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG5ld0RhdGFbbmV3RGF0YUxlbisrXSA9IG5ldyBCcmFja2V0c0RhdGEocG9zaXRpb24sIGJyYWNrZXRzLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9sYXN0QnJhY2tldHNEYXRhID0gbmV3RGF0YTtcblx0XHR0aGlzLl9sYXN0VmVyc2lvbklkID0gdmVyc2lvbklkO1xuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uKEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXIuSUQsIEJyYWNrZXRNYXRjaGluZ0NvbnRyb2xsZXIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uQWZ0ZXJGaXJzdFJlbmRlcik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihTZWxlY3RUb0JyYWNrZXRBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oSnVtcFRvQnJhY2tldEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihSZW1vdmVCcmFja2V0c0FjdGlvbik7XG5cbi8vIEdvIHRvIG1lbnVcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckdvTWVudSwge1xuXHRncm91cDogJzVfaW5maWxlX25hdicsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ2VkaXRvci5hY3Rpb24uanVtcFRvQnJhY2tldCcsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pR29Ub0JyYWNrZXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR28gdG8gJiZCcmFja2V0XCIpXG5cdH0sXG5cdG9yZGVyOiAyXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsa0JBQWtCO0FBQzNCLE9BQU87QUFFUCxTQUFTLGNBQWMsaUNBQWlDLHNCQUFzQixrQ0FBb0Q7QUFDbEksU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQWdDLG1CQUFtQiw4QkFBOEI7QUFDakYsU0FBUyw4QkFBOEI7QUFD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QUM5RjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLGdCQUFnQixlQUFlLGFBQWEsYUFBYSxFQUFFLFNBQVMsT0FBTyxRQUFRLEdBQUc7QUFDekYsZ0JBQVEsWUFBWSxJQUFJLGFBQWEsYUFBYTtBQUFBLE1BQ25ELE9BQU87QUFDTixZQUFJLFdBQVcsTUFBTSxhQUFhO0FBQUEsVUFBYTtBQUFBLFVBQVU7QUFBQTtBQUFBLFFBQXFDO0FBQzlGLFlBQUksVUFBVSwyQkFBMEI7QUFDeEMsWUFBSSxDQUFDLFlBQVksS0FBSyxtQkFBbUIsVUFBVTtBQUNsRCxxQkFBVyxNQUFNLGFBQWE7QUFBQSxZQUFzQjtBQUFBLFlBQVU7QUFBQTtBQUFBLFVBQXFDO0FBQ25HLG9CQUFVLDJCQUEwQjtBQUFBLFFBQ3JDO0FBQ0EsZ0JBQVEsWUFBWSxJQUFJLElBQUksYUFBYSxVQUFVLFVBQVUsT0FBTztBQUFBLE1BQ3JFO0FBQUEsSUFDRDtBQUVBLFNBQUssb0JBQW9CO0FBQ3pCLFNBQUssaUJBQWlCO0FBQUEsRUFDdkI7QUFDRDtBQS9SYSwyQkFDVyxLQUFLO0FBRGhCLDJCQXlMWSwwQ0FBMEMsdUJBQXVCLFNBQVM7QUFBQSxFQUNqRyxhQUFhO0FBQUEsRUFDYixZQUFZLHVCQUF1QjtBQUFBLEVBQ25DLFdBQVc7QUFBQSxFQUNYLGVBQWU7QUFBQSxJQUNkLE9BQU8saUJBQWlCLG1DQUFtQztBQUFBLElBQzNELFVBQVUsa0JBQWtCO0FBQUEsRUFDN0I7QUFDRCxDQUFDO0FBak1XLDJCQW1NWSw2Q0FBNkMsdUJBQXVCLFNBQVM7QUFBQSxFQUNwRyxhQUFhO0FBQUEsRUFDYixZQUFZLHVCQUF1QjtBQUFBLEVBQ25DLFdBQVc7QUFDWixDQUFDO0FBdk1LLElBQU0sNEJBQU47QUFpU1AsMkJBQTJCLDBCQUEwQixJQUFJLDJCQUEyQixnQ0FBZ0MsZ0JBQWdCO0FBQ3BJLHFCQUFxQixxQkFBcUI7QUFDMUMscUJBQXFCLG1CQUFtQjtBQUN4QyxxQkFBcUIsb0JBQW9CO0FBR3pDLGFBQWEsZUFBZSxPQUFPLGVBQWU7QUFBQSxFQUNqRCxPQUFPO0FBQUEsRUFDUCxTQUFTO0FBQUEsSUFDUixJQUFJO0FBQUEsSUFDSixPQUFPLElBQUksU0FBUyxFQUFFLEtBQUssaUJBQWlCLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLGlCQUFpQjtBQUFBLEVBQ3BHO0FBQUEsRUFDQSxPQUFPO0FBQ1IsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
