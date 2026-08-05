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
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import * as strings from "../../../../base/common/strings.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { ShiftCommand } from "../../../common/commands/shiftCommand.js";
import { EditorAutoIndentStrategy, EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { StandardTokenType } from "../../../common/encodedTokenAttributes.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { IndentConsts } from "../../../common/languages/supports/indentRules.js";
import { IModelService } from "../../../common/services/model.js";
import * as indentUtils from "../common/indentUtils.js";
import * as nls from "../../../../nls.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { getGoodIndentForLine, getIndentMetadata } from "../../../common/languages/autoIndent.js";
import { getReindentEditOperations } from "../common/indentation.js";
import { getStandardTokenTypeAtPosition } from "../../../common/tokens/lineTokens.js";
const _IndentationToSpacesAction = class _IndentationToSpacesAction extends EditorAction {
  constructor() {
    super({
      id: _IndentationToSpacesAction.ID,
      label: nls.localize2("indentationToSpaces", "Convert Indentation to Spaces"),
      precondition: EditorContextKeys.writable,
      metadata: {
        description: nls.localize2("indentationToSpacesDescription", "Convert the tab indentation to spaces.")
      }
    });
  }
  run(accessor, editor) {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const modelOpts = model.getOptions();
    const selection = editor.getSelection();
    if (!selection) {
      return;
    }
    const command = new IndentationToSpacesCommand(selection, modelOpts.tabSize);
    editor.pushUndoStop();
    editor.executeCommands(this.id, [command]);
    editor.pushUndoStop();
    model.updateOptions({
      insertSpaces: true
    });
  }
};
_IndentationToSpacesAction.ID = "editor.action.indentationToSpaces";
let IndentationToSpacesAction = _IndentationToSpacesAction;
const _IndentationToTabsAction = class _IndentationToTabsAction extends EditorAction {
  constructor() {
    super({
      id: _IndentationToTabsAction.ID,
      label: nls.localize2("indentationToTabs", "Convert Indentation to Tabs"),
      precondition: EditorContextKeys.writable,
      metadata: {
        description: nls.localize2("indentationToTabsDescription", "Convert the spaces indentation to tabs.")
      }
    });
  }
  run(accessor, editor) {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const modelOpts = model.getOptions();
    const selection = editor.getSelection();
    if (!selection) {
      return;
    }
    const command = new IndentationToTabsCommand(selection, modelOpts.tabSize);
    editor.pushUndoStop();
    editor.executeCommands(this.id, [command]);
    editor.pushUndoStop();
    model.updateOptions({
      insertSpaces: false
    });
  }
};
_IndentationToTabsAction.ID = "editor.action.indentationToTabs";
let IndentationToTabsAction = _IndentationToTabsAction;
class ChangeIndentationSizeAction extends EditorAction {
  constructor(insertSpaces, displaySizeOnly, opts) {
    super(opts);
    this.insertSpaces = insertSpaces;
    this.displaySizeOnly = displaySizeOnly;
  }
  run(accessor, editor) {
    const quickInputService = accessor.get(IQuickInputService);
    const modelService = accessor.get(IModelService);
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const creationOpts = modelService.getCreationOptions(model.getLanguageId(), model.uri, model.isForSimpleWidget);
    const modelOpts = model.getOptions();
    const picks = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      id: n.toString(),
      label: n.toString(),
      // add description for tabSize value set in the configuration
      description: n === creationOpts.tabSize && n === modelOpts.tabSize ? nls.localize("configuredTabSize", "Configured Tab Size") : n === creationOpts.tabSize ? nls.localize("defaultTabSize", "Default Tab Size") : n === modelOpts.tabSize ? nls.localize("currentTabSize", "Current Tab Size") : void 0
    }));
    const autoFocusIndex = Math.min(model.getOptions().tabSize - 1, 7);
    setTimeout(
      () => {
        quickInputService.pick(picks, { placeHolder: nls.localize({ key: "selectTabWidth", comment: ["Tab corresponds to the tab key"] }, "Select Tab Size for Current File"), activeItem: picks[autoFocusIndex] }).then((pick) => {
          if (pick) {
            if (model && !model.isDisposed()) {
              const pickedVal = parseInt(pick.label, 10);
              if (this.displaySizeOnly) {
                model.updateOptions({
                  tabSize: pickedVal
                });
              } else {
                model.updateOptions({
                  tabSize: pickedVal,
                  indentSize: pickedVal,
                  insertSpaces: this.insertSpaces
                });
              }
            }
          }
        });
      },
      50
      /* quick input is sensitive to being opened so soon after another */
    );
  }
}
const _IndentUsingTabs = class _IndentUsingTabs extends ChangeIndentationSizeAction {
  constructor() {
    super(false, false, {
      id: _IndentUsingTabs.ID,
      label: nls.localize2("indentUsingTabs", "Indent Using Tabs"),
      precondition: void 0,
      metadata: {
        description: nls.localize2("indentUsingTabsDescription", "Use indentation with tabs.")
      }
    });
  }
};
_IndentUsingTabs.ID = "editor.action.indentUsingTabs";
let IndentUsingTabs = _IndentUsingTabs;
const _IndentUsingSpaces = class _IndentUsingSpaces extends ChangeIndentationSizeAction {
  constructor() {
    super(true, false, {
      id: _IndentUsingSpaces.ID,
      label: nls.localize2("indentUsingSpaces", "Indent Using Spaces"),
      precondition: void 0,
      metadata: {
        description: nls.localize2("indentUsingSpacesDescription", "Use indentation with spaces.")
      }
    });
  }
};
_IndentUsingSpaces.ID = "editor.action.indentUsingSpaces";
let IndentUsingSpaces = _IndentUsingSpaces;
const _ChangeTabDisplaySize = class _ChangeTabDisplaySize extends ChangeIndentationSizeAction {
  constructor() {
    super(true, true, {
      id: _ChangeTabDisplaySize.ID,
      label: nls.localize2("changeTabDisplaySize", "Change Tab Display Size"),
      precondition: void 0,
      metadata: {
        description: nls.localize2("changeTabDisplaySizeDescription", "Change the space size equivalent of the tab.")
      }
    });
  }
};
_ChangeTabDisplaySize.ID = "editor.action.changeTabDisplaySize";
let ChangeTabDisplaySize = _ChangeTabDisplaySize;
const _DetectIndentation = class _DetectIndentation extends EditorAction {
  constructor() {
    super({
      id: _DetectIndentation.ID,
      label: nls.localize2("detectIndentation", "Detect Indentation from Content"),
      precondition: void 0,
      metadata: {
        description: nls.localize2("detectIndentationDescription", "Detect the indentation from content.")
      }
    });
  }
  run(accessor, editor) {
    const modelService = accessor.get(IModelService);
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const creationOpts = modelService.getCreationOptions(model.getLanguageId(), model.uri, model.isForSimpleWidget);
    model.detectIndentation(creationOpts.insertSpaces, creationOpts.tabSize);
  }
};
_DetectIndentation.ID = "editor.action.detectIndentation";
let DetectIndentation = _DetectIndentation;
class ReindentLinesAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.reindentlines",
      label: nls.localize2("editor.reindentlines", "Reindent Lines"),
      precondition: EditorContextKeys.writable,
      metadata: {
        description: nls.localize2("editor.reindentlinesDescription", "Reindent the lines of the editor.")
      }
    });
  }
  run(accessor, editor) {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const edits = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    if (edits.length > 0) {
      editor.pushUndoStop();
      editor.executeEdits(this.id, edits);
      editor.pushUndoStop();
    }
  }
}
class ReindentSelectedLinesAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.reindentselectedlines",
      label: nls.localize2("editor.reindentselectedlines", "Reindent Selected Lines"),
      precondition: EditorContextKeys.writable,
      metadata: {
        description: nls.localize2("editor.reindentselectedlinesDescription", "Reindent the selected lines of the editor.")
      }
    });
  }
  run(accessor, editor) {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const selections = editor.getSelections();
    if (selections === null) {
      return;
    }
    const edits = [];
    for (const selection of selections) {
      let startLineNumber = selection.startLineNumber;
      let endLineNumber = selection.endLineNumber;
      if (startLineNumber !== endLineNumber && selection.endColumn === 1) {
        endLineNumber--;
      }
      if (startLineNumber === 1) {
        if (startLineNumber === endLineNumber) {
          continue;
        }
      } else {
        startLineNumber--;
      }
      const editOperations = getReindentEditOperations(model, languageConfigurationService, startLineNumber, endLineNumber);
      edits.push(...editOperations);
    }
    if (edits.length > 0) {
      editor.pushUndoStop();
      editor.executeEdits(this.id, edits);
      editor.pushUndoStop();
    }
  }
}
class AutoIndentOnPasteCommand {
  constructor(edits, initialSelection) {
    this._initialSelection = initialSelection;
    this._edits = [];
    this._selectionId = null;
    for (const edit of edits) {
      if (edit.range && typeof edit.text === "string") {
        this._edits.push(edit);
      }
    }
  }
  getEditOperations(model, builder) {
    for (const edit of this._edits) {
      builder.addEditOperation(Range.lift(edit.range), edit.text);
    }
    let selectionIsSet = false;
    if (Array.isArray(this._edits) && this._edits.length === 1 && this._initialSelection.isEmpty()) {
      if (this._edits[0].range.startColumn === this._initialSelection.endColumn && this._edits[0].range.startLineNumber === this._initialSelection.endLineNumber) {
        selectionIsSet = true;
        this._selectionId = builder.trackSelection(this._initialSelection, true);
      } else if (this._edits[0].range.endColumn === this._initialSelection.startColumn && this._edits[0].range.endLineNumber === this._initialSelection.startLineNumber) {
        selectionIsSet = true;
        this._selectionId = builder.trackSelection(this._initialSelection, false);
      }
    }
    if (!selectionIsSet) {
      this._selectionId = builder.trackSelection(this._initialSelection);
    }
  }
  computeCursorState(model, helper) {
    return helper.getTrackedSelection(this._selectionId);
  }
}
let AutoIndentOnPaste = class {
  constructor(editor, _languageConfigurationService) {
    this.editor = editor;
    this._languageConfigurationService = _languageConfigurationService;
    this.callOnDispose = new DisposableStore();
    this.callOnModel = new DisposableStore();
    this.callOnDispose.add(editor.onDidChangeConfiguration(() => this.update()));
    this.callOnDispose.add(editor.onDidChangeModel(() => this.update()));
    this.callOnDispose.add(editor.onDidChangeModelLanguage(() => this.update()));
  }
  update() {
    this.callOnModel.clear();
    if (this.editor.getOption(EditorOption.autoIndent) < EditorAutoIndentStrategy.Full || this.editor.getOption(EditorOption.formatOnPaste)) {
      return;
    }
    if (!this.editor.hasModel()) {
      return;
    }
    this.callOnModel.add(this.editor.onDidPaste(({ range }) => {
      this.trigger(range);
    }));
  }
  trigger(range) {
    const selections = this.editor.getSelections();
    if (selections === null || selections.length > 1) {
      return;
    }
    const model = this.editor.getModel();
    if (!model) {
      return;
    }
    const containsOnlyWhitespace = this.rangeContainsOnlyWhitespaceCharacters(model, range);
    if (containsOnlyWhitespace) {
      return;
    }
    if (isStartOrEndInString(model, range)) {
      return;
    }
    if (!model.tokenization.isCheapToTokenize(range.getStartPosition().lineNumber)) {
      return;
    }
    const autoIndent = this.editor.getOption(EditorOption.autoIndent);
    const { tabSize, indentSize, insertSpaces } = model.getOptions();
    const textEdits = [];
    const indentConverter = {
      shiftIndent: (indentation) => {
        return ShiftCommand.shiftIndent(indentation, indentation.length + 1, tabSize, indentSize, insertSpaces);
      },
      unshiftIndent: (indentation) => {
        return ShiftCommand.unshiftIndent(indentation, indentation.length + 1, tabSize, indentSize, insertSpaces);
      }
    };
    let startLineNumber = range.startLineNumber;
    while (startLineNumber <= range.endLineNumber) {
      if (this.shouldIgnoreLine(model, startLineNumber)) {
        startLineNumber++;
        continue;
      }
      break;
    }
    if (startLineNumber > range.endLineNumber) {
      return;
    }
    let firstLineText = model.getLineContent(startLineNumber);
    if (!/\S/.test(firstLineText.substring(0, range.startColumn - 1))) {
      const indentOfFirstLine = getGoodIndentForLine(autoIndent, model, model.getLanguageId(), startLineNumber, indentConverter, this._languageConfigurationService);
      if (indentOfFirstLine !== null) {
        const oldIndentation = strings.getLeadingWhitespace(firstLineText);
        const newSpaceCnt = indentUtils.getSpaceCnt(indentOfFirstLine, tabSize);
        const oldSpaceCnt = indentUtils.getSpaceCnt(oldIndentation, tabSize);
        if (newSpaceCnt !== oldSpaceCnt) {
          const newIndent = indentUtils.generateIndent(newSpaceCnt, tabSize, insertSpaces);
          textEdits.push({
            range: new Range(startLineNumber, 1, startLineNumber, oldIndentation.length + 1),
            text: newIndent
          });
          firstLineText = newIndent + firstLineText.substring(oldIndentation.length);
        } else {
          const indentMetadata = getIndentMetadata(model, startLineNumber, this._languageConfigurationService);
          if (indentMetadata === 0 || indentMetadata === IndentConsts.UNINDENT_MASK) {
            return;
          }
        }
      }
    }
    const firstLineNumber = startLineNumber;
    while (startLineNumber < range.endLineNumber) {
      if (!/\S/.test(model.getLineContent(startLineNumber + 1))) {
        startLineNumber++;
        continue;
      }
      break;
    }
    if (startLineNumber !== range.endLineNumber) {
      const virtualModel = {
        tokenization: {
          getLineTokens: (lineNumber) => {
            return model.tokenization.getLineTokens(lineNumber);
          },
          getLanguageId: () => {
            return model.getLanguageId();
          },
          getLanguageIdAtPosition: (lineNumber, column) => {
            return model.getLanguageIdAtPosition(lineNumber, column);
          }
        },
        getLineContent: (lineNumber) => {
          if (lineNumber === firstLineNumber) {
            return firstLineText;
          } else {
            return model.getLineContent(lineNumber);
          }
        }
      };
      const indentOfSecondLine = getGoodIndentForLine(autoIndent, virtualModel, model.getLanguageId(), startLineNumber + 1, indentConverter, this._languageConfigurationService);
      if (indentOfSecondLine !== null) {
        const newSpaceCntOfSecondLine = indentUtils.getSpaceCnt(indentOfSecondLine, tabSize);
        const oldSpaceCntOfSecondLine = indentUtils.getSpaceCnt(strings.getLeadingWhitespace(model.getLineContent(startLineNumber + 1)), tabSize);
        if (newSpaceCntOfSecondLine !== oldSpaceCntOfSecondLine) {
          const spaceCntOffset = newSpaceCntOfSecondLine - oldSpaceCntOfSecondLine;
          for (let i = startLineNumber + 1; i <= range.endLineNumber; i++) {
            const lineContent = model.getLineContent(i);
            const originalIndent = strings.getLeadingWhitespace(lineContent);
            const originalSpacesCnt = indentUtils.getSpaceCnt(originalIndent, tabSize);
            const newSpacesCnt = originalSpacesCnt + spaceCntOffset;
            const newIndent = indentUtils.generateIndent(newSpacesCnt, tabSize, insertSpaces);
            if (newIndent !== originalIndent) {
              textEdits.push({
                range: new Range(i, 1, i, originalIndent.length + 1),
                text: newIndent
              });
            }
          }
        }
      }
    }
    if (textEdits.length > 0) {
      this.editor.pushUndoStop();
      const cmd = new AutoIndentOnPasteCommand(textEdits, this.editor.getSelection());
      this.editor.executeCommand("autoIndentOnPaste", cmd);
      this.editor.pushUndoStop();
    }
  }
  rangeContainsOnlyWhitespaceCharacters(model, range) {
    const lineContainsOnlyWhitespace = (content) => {
      return content.trim().length === 0;
    };
    let containsOnlyWhitespace = true;
    if (range.startLineNumber === range.endLineNumber) {
      const lineContent = model.getLineContent(range.startLineNumber);
      const linePart = lineContent.substring(range.startColumn - 1, range.endColumn - 1);
      containsOnlyWhitespace = lineContainsOnlyWhitespace(linePart);
    } else {
      for (let i = range.startLineNumber; i <= range.endLineNumber; i++) {
        const lineContent = model.getLineContent(i);
        if (i === range.startLineNumber) {
          const linePart = lineContent.substring(range.startColumn - 1);
          containsOnlyWhitespace = lineContainsOnlyWhitespace(linePart);
        } else if (i === range.endLineNumber) {
          const linePart = lineContent.substring(0, range.endColumn - 1);
          containsOnlyWhitespace = lineContainsOnlyWhitespace(linePart);
        } else {
          containsOnlyWhitespace = model.getLineFirstNonWhitespaceColumn(i) === 0;
        }
        if (!containsOnlyWhitespace) {
          break;
        }
      }
    }
    return containsOnlyWhitespace;
  }
  shouldIgnoreLine(model, lineNumber) {
    model.tokenization.forceTokenization(lineNumber);
    const nonWhitespaceColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
    if (nonWhitespaceColumn === 0) {
      return true;
    }
    const tokens = model.tokenization.getLineTokens(lineNumber);
    if (tokens.getCount() > 0) {
      const firstNonWhitespaceTokenIndex = tokens.findTokenIndexAtOffset(nonWhitespaceColumn);
      if (firstNonWhitespaceTokenIndex >= 0 && tokens.getStandardTokenType(firstNonWhitespaceTokenIndex) === StandardTokenType.Comment) {
        return true;
      }
    }
    return false;
  }
  dispose() {
    this.callOnDispose.dispose();
    this.callOnModel.dispose();
  }
};
AutoIndentOnPaste.ID = "editor.contrib.autoIndentOnPaste";
AutoIndentOnPaste = __decorateClass([
  __decorateParam(1, ILanguageConfigurationService)
], AutoIndentOnPaste);
function isStartOrEndInString(model, range) {
  const isPositionInString = (position) => {
    const tokenType = getStandardTokenTypeAtPosition(model, position);
    return tokenType === StandardTokenType.String;
  };
  return isPositionInString(range.getStartPosition()) || isPositionInString(range.getEndPosition());
}
function getIndentationEditOperations(model, builder, tabSize, tabsToSpaces) {
  if (model.getLineCount() === 1 && model.getLineMaxColumn(1) === 1) {
    return;
  }
  let spaces = "";
  for (let i = 0; i < tabSize; i++) {
    spaces += " ";
  }
  const spacesRegExp = new RegExp(spaces, "gi");
  for (let lineNumber = 1, lineCount = model.getLineCount(); lineNumber <= lineCount; lineNumber++) {
    let lastIndentationColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
    if (lastIndentationColumn === 0) {
      lastIndentationColumn = model.getLineMaxColumn(lineNumber);
    }
    if (lastIndentationColumn === 1) {
      continue;
    }
    const originalIndentationRange = new Range(lineNumber, 1, lineNumber, lastIndentationColumn);
    const originalIndentation = model.getValueInRange(originalIndentationRange);
    const newIndentation = tabsToSpaces ? originalIndentation.replace(/\t/ig, spaces) : originalIndentation.replace(spacesRegExp, "	");
    builder.addEditOperation(originalIndentationRange, newIndentation);
  }
}
class IndentationToSpacesCommand {
  constructor(selection, tabSize) {
    this.selection = selection;
    this.tabSize = tabSize;
    this.selectionId = null;
  }
  getEditOperations(model, builder) {
    this.selectionId = builder.trackSelection(this.selection);
    getIndentationEditOperations(model, builder, this.tabSize, true);
  }
  computeCursorState(model, helper) {
    return helper.getTrackedSelection(this.selectionId);
  }
}
class IndentationToTabsCommand {
  constructor(selection, tabSize) {
    this.selection = selection;
    this.tabSize = tabSize;
    this.selectionId = null;
  }
  getEditOperations(model, builder) {
    this.selectionId = builder.trackSelection(this.selection);
    getIndentationEditOperations(model, builder, this.tabSize, false);
  }
  computeCursorState(model, helper) {
    return helper.getTrackedSelection(this.selectionId);
  }
}
registerEditorContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(IndentationToSpacesAction);
registerEditorAction(IndentationToTabsAction);
registerEditorAction(IndentUsingTabs);
registerEditorAction(IndentUsingSpaces);
registerEditorAction(ChangeTabDisplaySize);
registerEditorAction(DetectIndentation);
registerEditorAction(ReindentLinesAction);
registerEditorAction(ReindentSelectedLinesAction);
export {
  AutoIndentOnPaste,
  AutoIndentOnPasteCommand,
  ChangeIndentationSizeAction,
  ChangeTabDisplaySize,
  DetectIndentation,
  IndentUsingSpaces,
  IndentUsingTabs,
  IndentationToSpacesAction,
  IndentationToSpacesCommand,
  IndentationToTabsAction,
  IndentationToTabsCommand,
  ReindentLinesAction,
  ReindentSelectedLinesAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmRlbnRhdGlvbi9icm93c2VyL2luZGVudGF0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIElBY3Rpb25PcHRpb25zLCByZWdpc3RlckVkaXRvckFjdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgU2hpZnRDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbW1hbmRzL3NoaWZ0Q29tbWFuZC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3ksIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJU2luZ2xlRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZCwgSUN1cnNvclN0YXRlQ29tcHV0ZXJEYXRhLCBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIsIElFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVNlcXVlbmNlLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZFRva2VuVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJbmRlbnRDb25zdHMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL3N1cHBvcnRzL2luZGVudFJ1bGVzLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0ICogYXMgaW5kZW50VXRpbHMgZnJvbSAnLi4vY29tbW9uL2luZGVudFV0aWxzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBnZXRHb29kSW5kZW50Rm9yTGluZSwgZ2V0SW5kZW50TWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2F1dG9JbmRlbnQuanMnO1xuaW1wb3J0IHsgZ2V0UmVpbmRlbnRFZGl0T3BlcmF0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9pbmRlbnRhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRTdGFuZGFyZFRva2VuVHlwZUF0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmRlbnRhdGlvblRvU3BhY2VzQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuYWN0aW9uLmluZGVudGF0aW9uVG9TcGFjZXMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBJbmRlbnRhdGlvblRvU3BhY2VzQWN0aW9uLklELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2luZGVudGF0aW9uVG9TcGFjZXMnLCBcIkNvbnZlcnQgSW5kZW50YXRpb24gdG8gU3BhY2VzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdpbmRlbnRhdGlvblRvU3BhY2VzRGVzY3JpcHRpb24nLCBcIkNvbnZlcnQgdGhlIHRhYiBpbmRlbnRhdGlvbiB0byBzcGFjZXMuXCIpLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbE9wdHMgPSBtb2RlbC5nZXRPcHRpb25zKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdGlmICghc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGNvbW1hbmQgPSBuZXcgSW5kZW50YXRpb25Ub1NwYWNlc0NvbW1hbmQoc2VsZWN0aW9uLCBtb2RlbE9wdHMudGFiU2l6ZSk7XG5cblx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0ZWRpdG9yLmV4ZWN1dGVDb21tYW5kcyh0aGlzLmlkLCBbY29tbWFuZF0pO1xuXHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblxuXHRcdG1vZGVsLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0aW5zZXJ0U3BhY2VzOiB0cnVlXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEluZGVudGF0aW9uVG9UYWJzQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuYWN0aW9uLmluZGVudGF0aW9uVG9UYWJzJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogSW5kZW50YXRpb25Ub1RhYnNBY3Rpb24uSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignaW5kZW50YXRpb25Ub1RhYnMnLCBcIkNvbnZlcnQgSW5kZW50YXRpb24gdG8gVGFic1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignaW5kZW50YXRpb25Ub1RhYnNEZXNjcmlwdGlvbicsIFwiQ29udmVydCB0aGUgc3BhY2VzIGluZGVudGF0aW9uIHRvIHRhYnMuXCIpLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbE9wdHMgPSBtb2RlbC5nZXRPcHRpb25zKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdGlmICghc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGNvbW1hbmQgPSBuZXcgSW5kZW50YXRpb25Ub1RhYnNDb21tYW5kKHNlbGVjdGlvbiwgbW9kZWxPcHRzLnRhYlNpemUpO1xuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgW2NvbW1hbmRdKTtcblx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cblx0XHRtb2RlbC51cGRhdGVPcHRpb25zKHtcblx0XHRcdGluc2VydFNwYWNlczogZmFsc2Vcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhbmdlSW5kZW50YXRpb25TaXplQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGluc2VydFNwYWNlczogYm9vbGVhbiwgcHJpdmF0ZSByZWFkb25seSBkaXNwbGF5U2l6ZU9ubHk6IGJvb2xlYW4sIG9wdHM6IElBY3Rpb25PcHRpb25zKSB7XG5cdFx0c3VwZXIob3B0cyk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBtb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1vZGVsU2VydmljZSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjcmVhdGlvbk9wdHMgPSBtb2RlbFNlcnZpY2UuZ2V0Q3JlYXRpb25PcHRpb25zKG1vZGVsLmdldExhbmd1YWdlSWQoKSwgbW9kZWwudXJpLCBtb2RlbC5pc0ZvclNpbXBsZVdpZGdldCk7XG5cdFx0Y29uc3QgbW9kZWxPcHRzID0gbW9kZWwuZ2V0T3B0aW9ucygpO1xuXHRcdGNvbnN0IHBpY2tzID0gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDhdLm1hcChuID0+ICh7XG5cdFx0XHRpZDogbi50b1N0cmluZygpLFxuXHRcdFx0bGFiZWw6IG4udG9TdHJpbmcoKSxcblx0XHRcdC8vIGFkZCBkZXNjcmlwdGlvbiBmb3IgdGFiU2l6ZSB2YWx1ZSBzZXQgaW4gdGhlIGNvbmZpZ3VyYXRpb25cblx0XHRcdGRlc2NyaXB0aW9uOiAoXG5cdFx0XHRcdG4gPT09IGNyZWF0aW9uT3B0cy50YWJTaXplICYmIG4gPT09IG1vZGVsT3B0cy50YWJTaXplXG5cdFx0XHRcdFx0PyBubHMubG9jYWxpemUoJ2NvbmZpZ3VyZWRUYWJTaXplJywgXCJDb25maWd1cmVkIFRhYiBTaXplXCIpXG5cdFx0XHRcdFx0OiBuID09PSBjcmVhdGlvbk9wdHMudGFiU2l6ZVxuXHRcdFx0XHRcdFx0PyBubHMubG9jYWxpemUoJ2RlZmF1bHRUYWJTaXplJywgXCJEZWZhdWx0IFRhYiBTaXplXCIpXG5cdFx0XHRcdFx0XHQ6IG4gPT09IG1vZGVsT3B0cy50YWJTaXplXG5cdFx0XHRcdFx0XHRcdD8gbmxzLmxvY2FsaXplKCdjdXJyZW50VGFiU2l6ZScsIFwiQ3VycmVudCBUYWIgU2l6ZVwiKVxuXHRcdFx0XHRcdFx0XHQ6IHVuZGVmaW5lZFxuXHRcdFx0KVxuXHRcdH0pKTtcblxuXHRcdC8vIGF1dG8gZm9jdXMgdGhlIHRhYlNpemUgc2V0IGZvciB0aGUgY3VycmVudCBlZGl0b3Jcblx0XHRjb25zdCBhdXRvRm9jdXNJbmRleCA9IE1hdGgubWluKG1vZGVsLmdldE9wdGlvbnMoKS50YWJTaXplIC0gMSwgNyk7XG5cblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2socGlja3MsIHsgcGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSh7IGtleTogJ3NlbGVjdFRhYldpZHRoJywgY29tbWVudDogWydUYWIgY29ycmVzcG9uZHMgdG8gdGhlIHRhYiBrZXknXSB9LCBcIlNlbGVjdCBUYWIgU2l6ZSBmb3IgQ3VycmVudCBGaWxlXCIpLCBhY3RpdmVJdGVtOiBwaWNrc1thdXRvRm9jdXNJbmRleF0gfSkudGhlbihwaWNrID0+IHtcblx0XHRcdFx0aWYgKHBpY2spIHtcblx0XHRcdFx0XHRpZiAobW9kZWwgJiYgIW1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcGlja2VkVmFsID0gcGFyc2VJbnQocGljay5sYWJlbCwgMTApO1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuZGlzcGxheVNpemVPbmx5KSB7XG5cdFx0XHRcdFx0XHRcdG1vZGVsLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0XHRcdFx0XHRcdHRhYlNpemU6IHBpY2tlZFZhbFxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG1vZGVsLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0XHRcdFx0XHRcdHRhYlNpemU6IHBpY2tlZFZhbCxcblx0XHRcdFx0XHRcdFx0XHRpbmRlbnRTaXplOiBwaWNrZWRWYWwsXG5cdFx0XHRcdFx0XHRcdFx0aW5zZXJ0U3BhY2VzOiB0aGlzLmluc2VydFNwYWNlc1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sIDUwLyogcXVpY2sgaW5wdXQgaXMgc2Vuc2l0aXZlIHRvIGJlaW5nIG9wZW5lZCBzbyBzb29uIGFmdGVyIGFub3RoZXIgKi8pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRlbnRVc2luZ1RhYnMgZXh0ZW5kcyBDaGFuZ2VJbmRlbnRhdGlvblNpemVBY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmFjdGlvbi5pbmRlbnRVc2luZ1RhYnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKGZhbHNlLCBmYWxzZSwge1xuXHRcdFx0aWQ6IEluZGVudFVzaW5nVGFicy5JRCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdpbmRlbnRVc2luZ1RhYnMnLCBcIkluZGVudCBVc2luZyBUYWJzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignaW5kZW50VXNpbmdUYWJzRGVzY3JpcHRpb24nLCBcIlVzZSBpbmRlbnRhdGlvbiB3aXRoIHRhYnMuXCIpLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRlbnRVc2luZ1NwYWNlcyBleHRlbmRzIENoYW5nZUluZGVudGF0aW9uU2l6ZUFjdGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuYWN0aW9uLmluZGVudFVzaW5nU3BhY2VzJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih0cnVlLCBmYWxzZSwge1xuXHRcdFx0aWQ6IEluZGVudFVzaW5nU3BhY2VzLklELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2luZGVudFVzaW5nU3BhY2VzJywgXCJJbmRlbnQgVXNpbmcgU3BhY2VzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignaW5kZW50VXNpbmdTcGFjZXNEZXNjcmlwdGlvbicsIFwiVXNlIGluZGVudGF0aW9uIHdpdGggc3BhY2VzLlwiKSxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhbmdlVGFiRGlzcGxheVNpemUgZXh0ZW5kcyBDaGFuZ2VJbmRlbnRhdGlvblNpemVBY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmFjdGlvbi5jaGFuZ2VUYWJEaXNwbGF5U2l6ZSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIodHJ1ZSwgdHJ1ZSwge1xuXHRcdFx0aWQ6IENoYW5nZVRhYkRpc3BsYXlTaXplLklELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2NoYW5nZVRhYkRpc3BsYXlTaXplJywgXCJDaGFuZ2UgVGFiIERpc3BsYXkgU2l6ZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZTIoJ2NoYW5nZVRhYkRpc3BsYXlTaXplRGVzY3JpcHRpb24nLCBcIkNoYW5nZSB0aGUgc3BhY2Ugc2l6ZSBlcXVpdmFsZW50IG9mIHRoZSB0YWIuXCIpLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZXRlY3RJbmRlbnRhdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuYWN0aW9uLmRldGVjdEluZGVudGF0aW9uJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRGV0ZWN0SW5kZW50YXRpb24uSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZGV0ZWN0SW5kZW50YXRpb24nLCBcIkRldGVjdCBJbmRlbnRhdGlvbiBmcm9tIENvbnRlbnRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdkZXRlY3RJbmRlbnRhdGlvbkRlc2NyaXB0aW9uJywgXCJEZXRlY3QgdGhlIGluZGVudGF0aW9uIGZyb20gY29udGVudC5cIiksXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElNb2RlbFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3JlYXRpb25PcHRzID0gbW9kZWxTZXJ2aWNlLmdldENyZWF0aW9uT3B0aW9ucyhtb2RlbC5nZXRMYW5ndWFnZUlkKCksIG1vZGVsLnVyaSwgbW9kZWwuaXNGb3JTaW1wbGVXaWRnZXQpO1xuXHRcdG1vZGVsLmRldGVjdEluZGVudGF0aW9uKGNyZWF0aW9uT3B0cy5pbnNlcnRTcGFjZXMsIGNyZWF0aW9uT3B0cy50YWJTaXplKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVpbmRlbnRMaW5lc0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5yZWluZGVudGxpbmVzJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdlZGl0b3IucmVpbmRlbnRsaW5lcycsIFwiUmVpbmRlbnQgTGluZXNcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZTIoJ2VkaXRvci5yZWluZGVudGxpbmVzRGVzY3JpcHRpb24nLCBcIlJlaW5kZW50IHRoZSBsaW5lcyBvZiB0aGUgZWRpdG9yLlwiKSxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBlZGl0cyA9IGdldFJlaW5kZW50RWRpdE9wZXJhdGlvbnMobW9kZWwsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRpZiAoZWRpdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVFZGl0cyh0aGlzLmlkLCBlZGl0cyk7XG5cdFx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWluZGVudFNlbGVjdGVkTGluZXNBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24ucmVpbmRlbnRzZWxlY3RlZGxpbmVzJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdlZGl0b3IucmVpbmRlbnRzZWxlY3RlZGxpbmVzJywgXCJSZWluZGVudCBTZWxlY3RlZCBMaW5lc1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignZWRpdG9yLnJlaW5kZW50c2VsZWN0ZWRsaW5lc0Rlc2NyaXB0aW9uJywgXCJSZWluZGVudCB0aGUgc2VsZWN0ZWQgbGluZXMgb2YgdGhlIGVkaXRvci5cIiksXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRpZiAoc2VsZWN0aW9ucyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGxldCBlbmRMaW5lTnVtYmVyID0gc2VsZWN0aW9uLmVuZExpbmVOdW1iZXI7XG5cblx0XHRcdGlmIChzdGFydExpbmVOdW1iZXIgIT09IGVuZExpbmVOdW1iZXIgJiYgc2VsZWN0aW9uLmVuZENvbHVtbiA9PT0gMSkge1xuXHRcdFx0XHRlbmRMaW5lTnVtYmVyLS07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGFydExpbmVOdW1iZXIgPT09IDEpIHtcblx0XHRcdFx0aWYgKHN0YXJ0TGluZU51bWJlciA9PT0gZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXItLTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZWRpdE9wZXJhdGlvbnMgPSBnZXRSZWluZGVudEVkaXRPcGVyYXRpb25zKG1vZGVsLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXIpO1xuXHRcdFx0ZWRpdHMucHVzaCguLi5lZGl0T3BlcmF0aW9ucyk7XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRcdGVkaXRvci5leGVjdXRlRWRpdHModGhpcy5pZCwgZWRpdHMpO1xuXHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQXV0b0luZGVudE9uUGFzdGVDb21tYW5kIGltcGxlbWVudHMgSUNvbW1hbmQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRzOiB7IHJhbmdlOiBJUmFuZ2U7IHRleHQ6IHN0cmluZzsgZW9sPzogRW5kT2ZMaW5lU2VxdWVuY2UgfVtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2luaXRpYWxTZWxlY3Rpb246IFNlbGVjdGlvbjtcblx0cHJpdmF0ZSBfc2VsZWN0aW9uSWQ6IHN0cmluZyB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoZWRpdHM6IFRleHRFZGl0W10sIGluaXRpYWxTZWxlY3Rpb246IFNlbGVjdGlvbikge1xuXHRcdHRoaXMuX2luaXRpYWxTZWxlY3Rpb24gPSBpbml0aWFsU2VsZWN0aW9uO1xuXHRcdHRoaXMuX2VkaXRzID0gW107XG5cdFx0dGhpcy5fc2VsZWN0aW9uSWQgPSBudWxsO1xuXG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIGVkaXRzKSB7XG5cdFx0XHRpZiAoZWRpdC5yYW5nZSAmJiB0eXBlb2YgZWRpdC50ZXh0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHR0aGlzLl9lZGl0cy5wdXNoKGVkaXQgYXMgeyByYW5nZTogSVJhbmdlOyB0ZXh0OiBzdHJpbmc7IGVvbD86IEVuZE9mTGluZVNlcXVlbmNlIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRFZGl0T3BlcmF0aW9ucyhtb2RlbDogSVRleHRNb2RlbCwgYnVpbGRlcjogSUVkaXRPcGVyYXRpb25CdWlsZGVyKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIHRoaXMuX2VkaXRzKSB7XG5cdFx0XHRidWlsZGVyLmFkZEVkaXRPcGVyYXRpb24oUmFuZ2UubGlmdChlZGl0LnJhbmdlKSwgZWRpdC50ZXh0KTtcblx0XHR9XG5cblx0XHRsZXQgc2VsZWN0aW9uSXNTZXQgPSBmYWxzZTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh0aGlzLl9lZGl0cykgJiYgdGhpcy5fZWRpdHMubGVuZ3RoID09PSAxICYmIHRoaXMuX2luaXRpYWxTZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRpZiAodGhpcy5fZWRpdHNbMF0ucmFuZ2Uuc3RhcnRDb2x1bW4gPT09IHRoaXMuX2luaXRpYWxTZWxlY3Rpb24uZW5kQ29sdW1uICYmXG5cdFx0XHRcdHRoaXMuX2VkaXRzWzBdLnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gdGhpcy5faW5pdGlhbFNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHNlbGVjdGlvbklzU2V0ID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fc2VsZWN0aW9uSWQgPSBidWlsZGVyLnRyYWNrU2VsZWN0aW9uKHRoaXMuX2luaXRpYWxTZWxlY3Rpb24sIHRydWUpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLl9lZGl0c1swXS5yYW5nZS5lbmRDb2x1bW4gPT09IHRoaXMuX2luaXRpYWxTZWxlY3Rpb24uc3RhcnRDb2x1bW4gJiZcblx0XHRcdFx0dGhpcy5fZWRpdHNbMF0ucmFuZ2UuZW5kTGluZU51bWJlciA9PT0gdGhpcy5faW5pdGlhbFNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0c2VsZWN0aW9uSXNTZXQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9zZWxlY3Rpb25JZCA9IGJ1aWxkZXIudHJhY2tTZWxlY3Rpb24odGhpcy5faW5pdGlhbFNlbGVjdGlvbiwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghc2VsZWN0aW9uSXNTZXQpIHtcblx0XHRcdHRoaXMuX3NlbGVjdGlvbklkID0gYnVpbGRlci50cmFja1NlbGVjdGlvbih0aGlzLl9pbml0aWFsU2VsZWN0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZUN1cnNvclN0YXRlKG1vZGVsOiBJVGV4dE1vZGVsLCBoZWxwZXI6IElDdXJzb3JTdGF0ZUNvbXB1dGVyRGF0YSk6IFNlbGVjdGlvbiB7XG5cdFx0cmV0dXJuIGhlbHBlci5nZXRUcmFja2VkU2VsZWN0aW9uKHRoaXMuX3NlbGVjdGlvbklkISk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEF1dG9JbmRlbnRPblBhc3RlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIuYXV0b0luZGVudE9uUGFzdGUnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2FsbE9uRGlzcG9zZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBjYWxsT25Nb2RlbCA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXG5cdFx0dGhpcy5jYWxsT25EaXNwb3NlLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLmNhbGxPbkRpc3Bvc2UuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLmNhbGxPbkRpc3Bvc2UuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UoKCkgPT4gdGhpcy51cGRhdGUoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGUoKTogdm9pZCB7XG5cblx0XHQvLyBjbGVhbiB1cFxuXHRcdHRoaXMuY2FsbE9uTW9kZWwuY2xlYXIoKTtcblxuXHRcdC8vIHdlIGFyZSBkaXNhYmxlZFxuXHRcdGlmICh0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmF1dG9JbmRlbnQpIDwgRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkZ1bGwgfHwgdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb3JtYXRPblBhc3RlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG5vIG1vZGVsXG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jYWxsT25Nb2RlbC5hZGQodGhpcy5lZGl0b3Iub25EaWRQYXN0ZSgoeyByYW5nZSB9KSA9PiB7XG5cdFx0XHR0aGlzLnRyaWdnZXIocmFuZ2UpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyB0cmlnZ2VyKHJhbmdlOiBSYW5nZSk6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0aWYgKHNlbGVjdGlvbnMgPT09IG51bGwgfHwgc2VsZWN0aW9ucy5sZW5ndGggPiAxKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgY29udGFpbnNPbmx5V2hpdGVzcGFjZSA9IHRoaXMucmFuZ2VDb250YWluc09ubHlXaGl0ZXNwYWNlQ2hhcmFjdGVycyhtb2RlbCwgcmFuZ2UpO1xuXHRcdGlmIChjb250YWluc09ubHlXaGl0ZXNwYWNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChpc1N0YXJ0T3JFbmRJblN0cmluZyhtb2RlbCwgcmFuZ2UpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghbW9kZWwudG9rZW5pemF0aW9uLmlzQ2hlYXBUb1Rva2VuaXplKHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKS5saW5lTnVtYmVyKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBhdXRvSW5kZW50ID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5hdXRvSW5kZW50KTtcblx0XHRjb25zdCB7IHRhYlNpemUsIGluZGVudFNpemUsIGluc2VydFNwYWNlcyB9ID0gbW9kZWwuZ2V0T3B0aW9ucygpO1xuXHRcdGNvbnN0IHRleHRFZGl0czogVGV4dEVkaXRbXSA9IFtdO1xuXG5cdFx0Y29uc3QgaW5kZW50Q29udmVydGVyID0ge1xuXHRcdFx0c2hpZnRJbmRlbnQ6IChpbmRlbnRhdGlvbjogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdHJldHVybiBTaGlmdENvbW1hbmQuc2hpZnRJbmRlbnQoaW5kZW50YXRpb24sIGluZGVudGF0aW9uLmxlbmd0aCArIDEsIHRhYlNpemUsIGluZGVudFNpemUsIGluc2VydFNwYWNlcyk7XG5cdFx0XHR9LFxuXHRcdFx0dW5zaGlmdEluZGVudDogKGluZGVudGF0aW9uOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0cmV0dXJuIFNoaWZ0Q29tbWFuZC51bnNoaWZ0SW5kZW50KGluZGVudGF0aW9uLCBpbmRlbnRhdGlvbi5sZW5ndGggKyAxLCB0YWJTaXplLCBpbmRlbnRTaXplLCBpbnNlcnRTcGFjZXMpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXG5cdFx0d2hpbGUgKHN0YXJ0TGluZU51bWJlciA8PSByYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRpZiAodGhpcy5zaG91bGRJZ25vcmVMaW5lKG1vZGVsLCBzdGFydExpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcisrO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmIChzdGFydExpbmVOdW1iZXIgPiByYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGZpcnN0TGluZVRleHQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChzdGFydExpbmVOdW1iZXIpO1xuXHRcdGlmICghL1xcUy8udGVzdChmaXJzdExpbmVUZXh0LnN1YnN0cmluZygwLCByYW5nZS5zdGFydENvbHVtbiAtIDEpKSkge1xuXHRcdFx0Y29uc3QgaW5kZW50T2ZGaXJzdExpbmUgPSBnZXRHb29kSW5kZW50Rm9yTGluZShhdXRvSW5kZW50LCBtb2RlbCwgbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLCBzdGFydExpbmVOdW1iZXIsIGluZGVudENvbnZlcnRlciwgdGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRcdGlmIChpbmRlbnRPZkZpcnN0TGluZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRjb25zdCBvbGRJbmRlbnRhdGlvbiA9IHN0cmluZ3MuZ2V0TGVhZGluZ1doaXRlc3BhY2UoZmlyc3RMaW5lVGV4dCk7XG5cdFx0XHRcdGNvbnN0IG5ld1NwYWNlQ250ID0gaW5kZW50VXRpbHMuZ2V0U3BhY2VDbnQoaW5kZW50T2ZGaXJzdExpbmUsIHRhYlNpemUpO1xuXHRcdFx0XHRjb25zdCBvbGRTcGFjZUNudCA9IGluZGVudFV0aWxzLmdldFNwYWNlQ250KG9sZEluZGVudGF0aW9uLCB0YWJTaXplKTtcblxuXHRcdFx0XHRpZiAobmV3U3BhY2VDbnQgIT09IG9sZFNwYWNlQ250KSB7XG5cdFx0XHRcdFx0Y29uc3QgbmV3SW5kZW50ID0gaW5kZW50VXRpbHMuZ2VuZXJhdGVJbmRlbnQobmV3U3BhY2VDbnQsIHRhYlNpemUsIGluc2VydFNwYWNlcyk7XG5cdFx0XHRcdFx0dGV4dEVkaXRzLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIDEsIHN0YXJ0TGluZU51bWJlciwgb2xkSW5kZW50YXRpb24ubGVuZ3RoICsgMSksXG5cdFx0XHRcdFx0XHR0ZXh0OiBuZXdJbmRlbnRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRmaXJzdExpbmVUZXh0ID0gbmV3SW5kZW50ICsgZmlyc3RMaW5lVGV4dC5zdWJzdHJpbmcob2xkSW5kZW50YXRpb24ubGVuZ3RoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBpbmRlbnRNZXRhZGF0YSA9IGdldEluZGVudE1ldGFkYXRhKG1vZGVsLCBzdGFydExpbmVOdW1iZXIsIHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRcdFx0aWYgKGluZGVudE1ldGFkYXRhID09PSAwIHx8IGluZGVudE1ldGFkYXRhID09PSBJbmRlbnRDb25zdHMuVU5JTkRFTlRfTUFTSykge1xuXHRcdFx0XHRcdFx0Ly8gd2UgcGFzdGUgY29udGVudCBpbnRvIGEgbGluZSB3aGVyZSBvbmx5IGNvbnRhaW5zIHdoaXRlc3BhY2VzXG5cdFx0XHRcdFx0XHQvLyBhZnRlciBwYXN0aW5nLCB0aGUgaW5kZW50YXRpb24gb2YgdGhlIGZpcnN0IGxpbmUgaXMgYWxyZWFkeSBjb3JyZWN0XG5cdFx0XHRcdFx0XHQvLyB0aGUgZmlyc3QgbGluZSBkb2Vzbid0IG1hdGNoIGFueSBpbmRlbnRhdGlvbiBydWxlXG5cdFx0XHRcdFx0XHQvLyB0aGVuIG5vLW9wLlxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGZpcnN0TGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjtcblxuXHRcdC8vIGlnbm9yZSBlbXB0eSBvciBpZ25vcmVkIGxpbmVzXG5cdFx0d2hpbGUgKHN0YXJ0TGluZU51bWJlciA8IHJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdGlmICghL1xcUy8udGVzdChtb2RlbC5nZXRMaW5lQ29udGVudChzdGFydExpbmVOdW1iZXIgKyAxKSkpIHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyKys7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXJ0TGluZU51bWJlciAhPT0gcmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0Y29uc3QgdmlydHVhbE1vZGVsID0ge1xuXHRcdFx0XHR0b2tlbml6YXRpb246IHtcblx0XHRcdFx0XHRnZXRMaW5lVG9rZW5zOiAobGluZU51bWJlcjogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMobGluZU51bWJlcik7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRnZXRMYW5ndWFnZUlkOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z2V0TGFuZ3VhZ2VJZEF0UG9zaXRpb246IChsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0TGFuZ3VhZ2VJZEF0UG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRMaW5lQ29udGVudDogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyID09PSBmaXJzdExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmaXJzdExpbmVUZXh0O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgaW5kZW50T2ZTZWNvbmRMaW5lID0gZ2V0R29vZEluZGVudEZvckxpbmUoYXV0b0luZGVudCwgdmlydHVhbE1vZGVsLCBtb2RlbC5nZXRMYW5ndWFnZUlkKCksIHN0YXJ0TGluZU51bWJlciArIDEsIGluZGVudENvbnZlcnRlciwgdGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRpZiAoaW5kZW50T2ZTZWNvbmRMaW5lICE9PSBudWxsKSB7XG5cdFx0XHRcdGNvbnN0IG5ld1NwYWNlQ250T2ZTZWNvbmRMaW5lID0gaW5kZW50VXRpbHMuZ2V0U3BhY2VDbnQoaW5kZW50T2ZTZWNvbmRMaW5lLCB0YWJTaXplKTtcblx0XHRcdFx0Y29uc3Qgb2xkU3BhY2VDbnRPZlNlY29uZExpbmUgPSBpbmRlbnRVdGlscy5nZXRTcGFjZUNudChzdHJpbmdzLmdldExlYWRpbmdXaGl0ZXNwYWNlKG1vZGVsLmdldExpbmVDb250ZW50KHN0YXJ0TGluZU51bWJlciArIDEpKSwgdGFiU2l6ZSk7XG5cblx0XHRcdFx0aWYgKG5ld1NwYWNlQ250T2ZTZWNvbmRMaW5lICE9PSBvbGRTcGFjZUNudE9mU2Vjb25kTGluZSkge1xuXHRcdFx0XHRcdGNvbnN0IHNwYWNlQ250T2Zmc2V0ID0gbmV3U3BhY2VDbnRPZlNlY29uZExpbmUgLSBvbGRTcGFjZUNudE9mU2Vjb25kTGluZTtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gc3RhcnRMaW5lTnVtYmVyICsgMTsgaSA8PSByYW5nZS5lbmRMaW5lTnVtYmVyOyBpKyspIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQoaSk7XG5cdFx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbEluZGVudCA9IHN0cmluZ3MuZ2V0TGVhZGluZ1doaXRlc3BhY2UobGluZUNvbnRlbnQpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxTcGFjZXNDbnQgPSBpbmRlbnRVdGlscy5nZXRTcGFjZUNudChvcmlnaW5hbEluZGVudCwgdGFiU2l6ZSk7XG5cdFx0XHRcdFx0XHRjb25zdCBuZXdTcGFjZXNDbnQgPSBvcmlnaW5hbFNwYWNlc0NudCArIHNwYWNlQ250T2Zmc2V0O1xuXHRcdFx0XHRcdFx0Y29uc3QgbmV3SW5kZW50ID0gaW5kZW50VXRpbHMuZ2VuZXJhdGVJbmRlbnQobmV3U3BhY2VzQ250LCB0YWJTaXplLCBpbnNlcnRTcGFjZXMpO1xuXG5cdFx0XHRcdFx0XHRpZiAobmV3SW5kZW50ICE9PSBvcmlnaW5hbEluZGVudCkge1xuXHRcdFx0XHRcdFx0XHR0ZXh0RWRpdHMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShpLCAxLCBpLCBvcmlnaW5hbEluZGVudC5sZW5ndGggKyAxKSxcblx0XHRcdFx0XHRcdFx0XHR0ZXh0OiBuZXdJbmRlbnRcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRleHRFZGl0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLmVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRcdGNvbnN0IGNtZCA9IG5ldyBBdXRvSW5kZW50T25QYXN0ZUNvbW1hbmQodGV4dEVkaXRzLCB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb24oKSEpO1xuXHRcdFx0dGhpcy5lZGl0b3IuZXhlY3V0ZUNvbW1hbmQoJ2F1dG9JbmRlbnRPblBhc3RlJywgY21kKTtcblx0XHRcdHRoaXMuZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmFuZ2VDb250YWluc09ubHlXaGl0ZXNwYWNlQ2hhcmFjdGVycyhtb2RlbDogSVRleHRNb2RlbCwgcmFuZ2U6IFJhbmdlKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbGluZUNvbnRhaW5zT25seVdoaXRlc3BhY2UgPSAoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiA9PiB7XG5cdFx0XHRyZXR1cm4gY29udGVudC50cmltKCkubGVuZ3RoID09PSAwO1xuXHRcdH07XG5cdFx0bGV0IGNvbnRhaW5zT25seVdoaXRlc3BhY2U6IGJvb2xlYW4gPSB0cnVlO1xuXHRcdGlmIChyYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IHJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdGNvbnN0IGxpbmVQYXJ0ID0gbGluZUNvbnRlbnQuc3Vic3RyaW5nKHJhbmdlLnN0YXJ0Q29sdW1uIC0gMSwgcmFuZ2UuZW5kQ29sdW1uIC0gMSk7XG5cdFx0XHRjb250YWluc09ubHlXaGl0ZXNwYWNlID0gbGluZUNvbnRhaW5zT25seVdoaXRlc3BhY2UobGluZVBhcnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGxldCBpID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyOyBpIDw9IHJhbmdlLmVuZExpbmVOdW1iZXI7IGkrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KGkpO1xuXHRcdFx0XHRpZiAoaSA9PT0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGluZVBhcnQgPSBsaW5lQ29udGVudC5zdWJzdHJpbmcocmFuZ2Uuc3RhcnRDb2x1bW4gLSAxKTtcblx0XHRcdFx0XHRjb250YWluc09ubHlXaGl0ZXNwYWNlID0gbGluZUNvbnRhaW5zT25seVdoaXRlc3BhY2UobGluZVBhcnQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGkgPT09IHJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lUGFydCA9IGxpbmVDb250ZW50LnN1YnN0cmluZygwLCByYW5nZS5lbmRDb2x1bW4gLSAxKTtcblx0XHRcdFx0XHRjb250YWluc09ubHlXaGl0ZXNwYWNlID0gbGluZUNvbnRhaW5zT25seVdoaXRlc3BhY2UobGluZVBhcnQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnRhaW5zT25seVdoaXRlc3BhY2UgPSBtb2RlbC5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGkpID09PSAwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghY29udGFpbnNPbmx5V2hpdGVzcGFjZSkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBjb250YWluc09ubHlXaGl0ZXNwYWNlO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRJZ25vcmVMaW5lKG1vZGVsOiBJVGV4dE1vZGVsLCBsaW5lTnVtYmVyOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obGluZU51bWJlcik7XG5cdFx0Y29uc3Qgbm9uV2hpdGVzcGFjZUNvbHVtbiA9IG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4obGluZU51bWJlcik7XG5cdFx0aWYgKG5vbldoaXRlc3BhY2VDb2x1bW4gPT09IDApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRjb25zdCB0b2tlbnMgPSBtb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2VucyhsaW5lTnVtYmVyKTtcblx0XHRpZiAodG9rZW5zLmdldENvdW50KCkgPiAwKSB7XG5cdFx0XHRjb25zdCBmaXJzdE5vbldoaXRlc3BhY2VUb2tlbkluZGV4ID0gdG9rZW5zLmZpbmRUb2tlbkluZGV4QXRPZmZzZXQobm9uV2hpdGVzcGFjZUNvbHVtbik7XG5cdFx0XHRpZiAoZmlyc3ROb25XaGl0ZXNwYWNlVG9rZW5JbmRleCA+PSAwICYmIHRva2Vucy5nZXRTdGFuZGFyZFRva2VuVHlwZShmaXJzdE5vbldoaXRlc3BhY2VUb2tlbkluZGV4KSA9PT0gU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNhbGxPbkRpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMuY2FsbE9uTW9kZWwuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzU3RhcnRPckVuZEluU3RyaW5nKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZTogUmFuZ2UpOiBib29sZWFuIHtcblx0Y29uc3QgaXNQb3NpdGlvbkluU3RyaW5nID0gKHBvc2l0aW9uOiBQb3NpdGlvbik6IGJvb2xlYW4gPT4ge1xuXHRcdGNvbnN0IHRva2VuVHlwZSA9IGdldFN0YW5kYXJkVG9rZW5UeXBlQXRQb3NpdGlvbihtb2RlbCwgcG9zaXRpb24pO1xuXHRcdHJldHVybiB0b2tlblR5cGUgPT09IFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZztcblx0fTtcblx0cmV0dXJuIGlzUG9zaXRpb25JblN0cmluZyhyYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpIHx8IGlzUG9zaXRpb25JblN0cmluZyhyYW5nZS5nZXRFbmRQb3NpdGlvbigpKTtcbn1cblxuZnVuY3Rpb24gZ2V0SW5kZW50YXRpb25FZGl0T3BlcmF0aW9ucyhtb2RlbDogSVRleHRNb2RlbCwgYnVpbGRlcjogSUVkaXRPcGVyYXRpb25CdWlsZGVyLCB0YWJTaXplOiBudW1iZXIsIHRhYnNUb1NwYWNlczogYm9vbGVhbik6IHZvaWQge1xuXHRpZiAobW9kZWwuZ2V0TGluZUNvdW50KCkgPT09IDEgJiYgbW9kZWwuZ2V0TGluZU1heENvbHVtbigxKSA9PT0gMSkge1xuXHRcdC8vIE1vZGVsIGlzIGVtcHR5XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0bGV0IHNwYWNlcyA9ICcnO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRhYlNpemU7IGkrKykge1xuXHRcdHNwYWNlcyArPSAnICc7XG5cdH1cblxuXHRjb25zdCBzcGFjZXNSZWdFeHAgPSBuZXcgUmVnRXhwKHNwYWNlcywgJ2dpJyk7XG5cblx0Zm9yIChsZXQgbGluZU51bWJlciA9IDEsIGxpbmVDb3VudCA9IG1vZGVsLmdldExpbmVDb3VudCgpOyBsaW5lTnVtYmVyIDw9IGxpbmVDb3VudDsgbGluZU51bWJlcisrKSB7XG5cdFx0bGV0IGxhc3RJbmRlbnRhdGlvbkNvbHVtbiA9IG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4obGluZU51bWJlcik7XG5cdFx0aWYgKGxhc3RJbmRlbnRhdGlvbkNvbHVtbiA9PT0gMCkge1xuXHRcdFx0bGFzdEluZGVudGF0aW9uQ29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKTtcblx0XHR9XG5cblx0XHRpZiAobGFzdEluZGVudGF0aW9uQ29sdW1uID09PSAxKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRjb25zdCBvcmlnaW5hbEluZGVudGF0aW9uUmFuZ2UgPSBuZXcgUmFuZ2UobGluZU51bWJlciwgMSwgbGluZU51bWJlciwgbGFzdEluZGVudGF0aW9uQ29sdW1uKTtcblx0XHRjb25zdCBvcmlnaW5hbEluZGVudGF0aW9uID0gbW9kZWwuZ2V0VmFsdWVJblJhbmdlKG9yaWdpbmFsSW5kZW50YXRpb25SYW5nZSk7XG5cdFx0Y29uc3QgbmV3SW5kZW50YXRpb24gPSAoXG5cdFx0XHR0YWJzVG9TcGFjZXNcblx0XHRcdFx0PyBvcmlnaW5hbEluZGVudGF0aW9uLnJlcGxhY2UoL1xcdC9pZywgc3BhY2VzKVxuXHRcdFx0XHQ6IG9yaWdpbmFsSW5kZW50YXRpb24ucmVwbGFjZShzcGFjZXNSZWdFeHAsICdcXHQnKVxuXHRcdCk7XG5cblx0XHRidWlsZGVyLmFkZEVkaXRPcGVyYXRpb24ob3JpZ2luYWxJbmRlbnRhdGlvblJhbmdlLCBuZXdJbmRlbnRhdGlvbik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEluZGVudGF0aW9uVG9TcGFjZXNDb21tYW5kIGltcGxlbWVudHMgSUNvbW1hbmQge1xuXG5cdHByaXZhdGUgc2VsZWN0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIHByaXZhdGUgdGFiU2l6ZTogbnVtYmVyKSB7IH1cblxuXHRwdWJsaWMgZ2V0RWRpdE9wZXJhdGlvbnMobW9kZWw6IElUZXh0TW9kZWwsIGJ1aWxkZXI6IElFZGl0T3BlcmF0aW9uQnVpbGRlcik6IHZvaWQge1xuXHRcdHRoaXMuc2VsZWN0aW9uSWQgPSBidWlsZGVyLnRyYWNrU2VsZWN0aW9uKHRoaXMuc2VsZWN0aW9uKTtcblx0XHRnZXRJbmRlbnRhdGlvbkVkaXRPcGVyYXRpb25zKG1vZGVsLCBidWlsZGVyLCB0aGlzLnRhYlNpemUsIHRydWUpO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVDdXJzb3JTdGF0ZShtb2RlbDogSVRleHRNb2RlbCwgaGVscGVyOiBJQ3Vyc29yU3RhdGVDb21wdXRlckRhdGEpOiBTZWxlY3Rpb24ge1xuXHRcdHJldHVybiBoZWxwZXIuZ2V0VHJhY2tlZFNlbGVjdGlvbih0aGlzLnNlbGVjdGlvbklkISk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEluZGVudGF0aW9uVG9UYWJzQ29tbWFuZCBpbXBsZW1lbnRzIElDb21tYW5kIHtcblxuXHRwcml2YXRlIHNlbGVjdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHNlbGVjdGlvbjogU2VsZWN0aW9uLCBwcml2YXRlIHRhYlNpemU6IG51bWJlcikgeyB9XG5cblx0cHVibGljIGdldEVkaXRPcGVyYXRpb25zKG1vZGVsOiBJVGV4dE1vZGVsLCBidWlsZGVyOiBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIpOiB2b2lkIHtcblx0XHR0aGlzLnNlbGVjdGlvbklkID0gYnVpbGRlci50cmFja1NlbGVjdGlvbih0aGlzLnNlbGVjdGlvbik7XG5cdFx0Z2V0SW5kZW50YXRpb25FZGl0T3BlcmF0aW9ucyhtb2RlbCwgYnVpbGRlciwgdGhpcy50YWJTaXplLCBmYWxzZSk7XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZUN1cnNvclN0YXRlKG1vZGVsOiBJVGV4dE1vZGVsLCBoZWxwZXI6IElDdXJzb3JTdGF0ZUNvbXB1dGVyRGF0YSk6IFNlbGVjdGlvbiB7XG5cdFx0cmV0dXJuIGhlbHBlci5nZXRUcmFja2VkU2VsZWN0aW9uKHRoaXMuc2VsZWN0aW9uSWQhKTtcblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihBdXRvSW5kZW50T25QYXN0ZS5JRCwgQXV0b0luZGVudE9uUGFzdGUsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uQmVmb3JlRmlyc3RJbnRlcmFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihJbmRlbnRhdGlvblRvU3BhY2VzQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEluZGVudGF0aW9uVG9UYWJzQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEluZGVudFVzaW5nVGFicyk7XG5yZWdpc3RlckVkaXRvckFjdGlvbihJbmRlbnRVc2luZ1NwYWNlcyk7XG5yZWdpc3RlckVkaXRvckFjdGlvbihDaGFuZ2VUYWJEaXNwbGF5U2l6ZSk7XG5yZWdpc3RlckVkaXRvckFjdGlvbihEZXRlY3RJbmRlbnRhdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihSZWluZGVudExpbmVzQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFJlaW5kZW50U2VsZWN0ZWRMaW5lc0FjdGlvbik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFlBQVksYUFBYTtBQUV6QixTQUFTLGNBQWMsaUNBQWlELHNCQUFzQixrQ0FBb0Q7QUFDbEosU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywwQkFBMEIsb0JBQW9CO0FBRXZELFNBQWlCLGFBQWE7QUFHOUIsU0FBUyx5QkFBeUI7QUFHbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxxQkFBcUI7QUFDOUIsWUFBWSxpQkFBaUI7QUFDN0IsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0JBQXNCLHlCQUF5QjtBQUN4RCxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLHNDQUFzQztBQUd4QyxNQUFNLDZCQUFOLE1BQU0sbUNBQWtDLGFBQWE7QUFBQSxFQUczRCxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSSwyQkFBMEI7QUFBQSxNQUM5QixP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
