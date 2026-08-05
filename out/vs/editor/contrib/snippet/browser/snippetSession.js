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
import { groupBy } from "../../../../base/common/arrays.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { getLeadingWhitespace } from "../../../../base/common/strings.js";
import "./snippetSession.css";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { Choice, Placeholder, SnippetParser, Text, TextmateSnippet } from "./snippetParser.js";
import { ClipboardBasedVariableResolver, CommentBasedVariableResolver, CompositeSnippetVariableResolver, ModelBasedVariableResolver, RandomBasedVariableResolver, SelectionBasedVariableResolver, TimeBasedVariableResolver, WorkspaceBasedVariableResolver } from "./snippetVariables.js";
const _OneSnippet = class _OneSnippet {
  constructor(_editor, _snippet, _snippetLineLeadingWhitespace) {
    this._editor = _editor;
    this._snippet = _snippet;
    this._snippetLineLeadingWhitespace = _snippetLineLeadingWhitespace;
    this._offset = -1;
    this._nestingLevel = 1;
    this._placeholderGroups = groupBy(_snippet.placeholders, Placeholder.compareByIndex);
    this._placeholderGroupsIdx = -1;
  }
  initialize(textChange) {
    this._offset = textChange.newPosition;
  }
  dispose() {
    if (this._placeholderDecorations) {
      this._editor.removeDecorations([...this._placeholderDecorations.values()]);
    }
    this._placeholderGroups.length = 0;
  }
  _initDecorations() {
    if (this._offset === -1) {
      throw new Error(`Snippet not initialized!`);
    }
    if (this._placeholderDecorations) {
      return;
    }
    this._placeholderDecorations = /* @__PURE__ */ new Map();
    const model = this._editor.getModel();
    this._editor.changeDecorations((accessor) => {
      for (const placeholder of this._snippet.placeholders) {
        const placeholderOffset = this._snippet.offset(placeholder);
        const placeholderLen = this._snippet.fullLen(placeholder);
        const range = Range.fromPositions(
          model.getPositionAt(this._offset + placeholderOffset),
          model.getPositionAt(this._offset + placeholderOffset + placeholderLen)
        );
        const options = placeholder.isFinalTabstop ? _OneSnippet._decor.inactiveFinal : _OneSnippet._decor.inactive;
        const handle = accessor.addDecoration(range, options);
        this._placeholderDecorations.set(placeholder, handle);
      }
    });
  }
  move(fwd) {
    if (!this._editor.hasModel()) {
      return [];
    }
    this._initDecorations();
    if (this._placeholderGroupsIdx >= 0) {
      const operations = [];
      for (const placeholder of this._placeholderGroups[this._placeholderGroupsIdx]) {
        if (placeholder.transform) {
          const id = this._placeholderDecorations.get(placeholder);
          const range = this._editor.getModel().getDecorationRange(id);
          const currentValue = this._editor.getModel().getValueInRange(range);
          const transformedValueLines = placeholder.transform.resolve(currentValue).split(/\r\n|\r|\n/);
          for (let i = 1; i < transformedValueLines.length; i++) {
            transformedValueLines[i] = this._editor.getModel().normalizeIndentation(this._snippetLineLeadingWhitespace + transformedValueLines[i]);
          }
          operations.push(EditOperation.replace(range, transformedValueLines.join(this._editor.getModel().getEOL())));
        }
      }
      if (operations.length > 0) {
        this._editor.executeEdits("snippet.placeholderTransform", operations);
      }
    }
    let couldSkipThisPlaceholder = false;
    if (fwd === true && this._placeholderGroupsIdx < this._placeholderGroups.length - 1) {
      this._placeholderGroupsIdx += 1;
      couldSkipThisPlaceholder = true;
    } else if (fwd === false && this._placeholderGroupsIdx > 0) {
      this._placeholderGroupsIdx -= 1;
      couldSkipThisPlaceholder = true;
    } else {
    }
    const newSelections = this._editor.getModel().changeDecorations((accessor) => {
      const activePlaceholders = /* @__PURE__ */ new Set();
      const selections = [];
      for (const placeholder of this._placeholderGroups[this._placeholderGroupsIdx]) {
        const id = this._placeholderDecorations.get(placeholder);
        const range = this._editor.getModel().getDecorationRange(id);
        selections.push(new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn));
        couldSkipThisPlaceholder = couldSkipThisPlaceholder && this._hasPlaceholderBeenCollapsed(placeholder);
        accessor.changeDecorationOptions(id, placeholder.isFinalTabstop ? _OneSnippet._decor.activeFinal : _OneSnippet._decor.active);
        activePlaceholders.add(placeholder);
        for (const enclosingPlaceholder of this._snippet.enclosingPlaceholders(placeholder)) {
          const id2 = this._placeholderDecorations.get(enclosingPlaceholder);
          accessor.changeDecorationOptions(id2, enclosingPlaceholder.isFinalTabstop ? _OneSnippet._decor.activeFinal : _OneSnippet._decor.active);
          activePlaceholders.add(enclosingPlaceholder);
        }
      }
      for (const [placeholder, id] of this._placeholderDecorations) {
        if (!activePlaceholders.has(placeholder)) {
          accessor.changeDecorationOptions(id, placeholder.isFinalTabstop ? _OneSnippet._decor.inactiveFinal : _OneSnippet._decor.inactive);
        }
      }
      return selections;
    });
    return !couldSkipThisPlaceholder ? newSelections ?? [] : this.move(fwd);
  }
  _hasPlaceholderBeenCollapsed(placeholder) {
    let marker = placeholder;
    while (marker) {
      if (marker instanceof Placeholder) {
        const id = this._placeholderDecorations.get(marker);
        const range = this._editor.getModel().getDecorationRange(id);
        if (range.isEmpty() && marker.toString().length > 0) {
          return true;
        }
      }
      marker = marker.parent;
    }
    return false;
  }
  get isAtFirstPlaceholder() {
    return this._placeholderGroupsIdx <= 0 || this._placeholderGroups.length === 0;
  }
  get isAtLastPlaceholder() {
    return this._placeholderGroupsIdx === this._placeholderGroups.length - 1;
  }
  get hasPlaceholder() {
    return this._snippet.placeholders.length > 0;
  }
  /**
   * A snippet is trivial when it has no placeholder or only a final placeholder at
   * its very end
   */
  get isTrivialSnippet() {
    if (this._snippet.placeholders.length === 0) {
      return true;
    }
    if (this._snippet.placeholders.length === 1) {
      const [placeholder] = this._snippet.placeholders;
      if (placeholder.isFinalTabstop) {
        if (this._snippet.rightMostDescendant === placeholder) {
          return true;
        }
      }
    }
    return false;
  }
  computePossibleSelections() {
    const result = /* @__PURE__ */ new Map();
    for (const placeholdersWithEqualIndex of this._placeholderGroups) {
      let ranges;
      for (const placeholder of placeholdersWithEqualIndex) {
        if (placeholder.isFinalTabstop) {
          break;
        }
        if (!ranges) {
          ranges = [];
          result.set(placeholder.index, ranges);
        }
        const id = this._placeholderDecorations.get(placeholder);
        const range = this._editor.getModel().getDecorationRange(id);
        if (!range) {
          result.delete(placeholder.index);
          break;
        }
        ranges.push(range);
      }
    }
    return result;
  }
  get activeChoice() {
    if (!this._placeholderDecorations) {
      return void 0;
    }
    const placeholder = this._placeholderGroups[this._placeholderGroupsIdx][0];
    if (!placeholder?.choice) {
      return void 0;
    }
    const id = this._placeholderDecorations.get(placeholder);
    if (!id) {
      return void 0;
    }
    const range = this._editor.getModel().getDecorationRange(id);
    if (!range) {
      return void 0;
    }
    return { range, choice: placeholder.choice };
  }
  get hasChoice() {
    let result = false;
    this._snippet.walk((marker) => {
      result = marker instanceof Choice;
      return !result;
    });
    return result;
  }
  merge(others) {
    const model = this._editor.getModel();
    this._nestingLevel *= 10;
    this._editor.changeDecorations((accessor) => {
      for (const placeholder of this._placeholderGroups[this._placeholderGroupsIdx]) {
        const nested = others.shift();
        console.assert(nested._offset !== -1);
        console.assert(!nested._placeholderDecorations);
        const indexLastPlaceholder = nested._snippet.placeholderInfo.last.index;
        for (const nestedPlaceholder of nested._snippet.placeholderInfo.all) {
          if (nestedPlaceholder.isFinalTabstop) {
            nestedPlaceholder.index = placeholder.index + (indexLastPlaceholder + 1) / this._nestingLevel;
          } else {
            nestedPlaceholder.index = placeholder.index + nestedPlaceholder.index / this._nestingLevel;
          }
        }
        this._snippet.replace(placeholder, nested._snippet.children);
        const id = this._placeholderDecorations.get(placeholder);
        accessor.removeDecoration(id);
        this._placeholderDecorations.delete(placeholder);
        for (const placeholder2 of nested._snippet.placeholders) {
          const placeholderOffset = nested._snippet.offset(placeholder2);
          const placeholderLen = nested._snippet.fullLen(placeholder2);
          const range = Range.fromPositions(
            model.getPositionAt(nested._offset + placeholderOffset),
            model.getPositionAt(nested._offset + placeholderOffset + placeholderLen)
          );
          const handle = accessor.addDecoration(range, _OneSnippet._decor.inactive);
          this._placeholderDecorations.set(placeholder2, handle);
        }
      }
      this._placeholderGroups = groupBy(this._snippet.placeholders, Placeholder.compareByIndex);
    });
  }
  getEnclosingRange() {
    let result;
    const model = this._editor.getModel();
    for (const decorationId of this._placeholderDecorations.values()) {
      const placeholderRange = model.getDecorationRange(decorationId) ?? void 0;
      if (!result) {
        result = placeholderRange;
      } else {
        result = result.plusRange(placeholderRange);
      }
    }
    return result;
  }
};
_OneSnippet._decor = {
  active: ModelDecorationOptions.register({ description: "snippet-placeholder-1", stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges, className: "snippet-placeholder" }),
  inactive: ModelDecorationOptions.register({ description: "snippet-placeholder-2", stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, className: "snippet-placeholder" }),
  activeFinal: ModelDecorationOptions.register({ description: "snippet-placeholder-3", stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, className: "finish-snippet-placeholder" }),
  inactiveFinal: ModelDecorationOptions.register({ description: "snippet-placeholder-4", stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, className: "finish-snippet-placeholder" })
};
let OneSnippet = _OneSnippet;
const _defaultOptions = {
  overwriteBefore: 0,
  overwriteAfter: 0,
  adjustWhitespace: true,
  clipboardText: void 0,
  overtypingCapturer: void 0
};
let SnippetSession = class {
  constructor(_editor, _template, _options = _defaultOptions, _languageConfigurationService) {
    this._editor = _editor;
    this._template = _template;
    this._options = _options;
    this._languageConfigurationService = _languageConfigurationService;
    this._templateMerges = [];
    this._snippets = [];
  }
  static adjustWhitespace(model, position, adjustIndentation, snippet, filter) {
    const line = model.getLineContent(position.lineNumber);
    const lineLeadingWhitespace = getLeadingWhitespace(line, 0, position.column - 1);
    let snippetTextString;
    snippet.walk((marker) => {
      if (!(marker instanceof Text) || marker.parent instanceof Choice) {
        return true;
      }
      if (filter && !filter.has(marker)) {
        return true;
      }
      const lines = marker.value.split(/\r\n|\r|\n/);
      if (adjustIndentation) {
        const offset = snippet.offset(marker);
        if (offset === 0) {
          lines[0] = model.normalizeIndentation(lines[0]);
        } else {
          snippetTextString = snippetTextString ?? snippet.toString();
          const prevChar = snippetTextString.charCodeAt(offset - 1);
          if (prevChar === CharCode.LineFeed || prevChar === CharCode.CarriageReturn) {
            lines[0] = model.normalizeIndentation(lineLeadingWhitespace + lines[0]);
          }
        }
        for (let i = 1; i < lines.length; i++) {
          lines[i] = model.normalizeIndentation(lineLeadingWhitespace + lines[i]);
        }
      }
      const newValue = lines.join(model.getEOL());
      if (newValue !== marker.value) {
        marker.parent.replace(marker, [new Text(newValue)]);
        snippetTextString = void 0;
      }
      return true;
    });
    return lineLeadingWhitespace;
  }
  static adjustSelection(model, selection, overwriteBefore, overwriteAfter) {
    if (overwriteBefore !== 0 || overwriteAfter !== 0) {
      const { positionLineNumber, positionColumn } = selection;
      const positionColumnBefore = positionColumn - overwriteBefore;
      const positionColumnAfter = positionColumn + overwriteAfter;
      const range = model.validateRange({
        startLineNumber: positionLineNumber,
        startColumn: positionColumnBefore,
        endLineNumber: positionLineNumber,
        endColumn: positionColumnAfter
      });
      selection = Selection.createWithDirection(
        range.startLineNumber,
        range.startColumn,
        range.endLineNumber,
        range.endColumn,
        selection.getDirection()
      );
    }
    return selection;
  }
  static createEditsAndSnippetsFromSelections(editor, template, overwriteBefore, overwriteAfter, enforceFinalTabstop, adjustWhitespace, clipboardText, overtypingCapturer, languageConfigurationService) {
    const edits = [];
    const snippets = [];
    if (!editor.hasModel()) {
      return { edits, snippets };
    }
    const model = editor.getModel();
    const workspaceService = editor.invokeWithinContext((accessor) => accessor.get(IWorkspaceContextService));
    const modelBasedVariableResolver = editor.invokeWithinContext((accessor) => new ModelBasedVariableResolver(accessor.get(ILabelService), model));
    const readClipboardText = () => clipboardText;
    const firstBeforeText = model.getValueInRange(SnippetSession.adjustSelection(model, editor.getSelection(), overwriteBefore, 0));
    const firstAfterText = model.getValueInRange(SnippetSession.adjustSelection(model, editor.getSelection(), 0, overwriteAfter));
    const firstLineFirstNonWhitespace = model.getLineFirstNonWhitespaceColumn(editor.getSelection().positionLineNumber);
    const indexedSelections = editor.getSelections().map((selection, idx) => ({ selection, idx })).sort((a, b) => Range.compareRangesUsingStarts(a.selection, b.selection));
    for (const { selection, idx } of indexedSelections) {
      let extensionBefore = SnippetSession.adjustSelection(model, selection, overwriteBefore, 0);
      let extensionAfter = SnippetSession.adjustSelection(model, selection, 0, overwriteAfter);
      if (firstBeforeText !== model.getValueInRange(extensionBefore)) {
        extensionBefore = selection;
      }
      if (firstAfterText !== model.getValueInRange(extensionAfter)) {
        extensionAfter = selection;
      }
      const snippetSelection = selection.setStartPosition(extensionBefore.startLineNumber, extensionBefore.startColumn).setEndPosition(extensionAfter.endLineNumber, extensionAfter.endColumn);
      const snippet = new SnippetParser().parse(template, true, enforceFinalTabstop);
      const start = snippetSelection.getStartPosition();
      const snippetLineLeadingWhitespace = SnippetSession.adjustWhitespace(
        model,
        start,
        adjustWhitespace || idx > 0 && firstLineFirstNonWhitespace !== model.getLineFirstNonWhitespaceColumn(selection.positionLineNumber),
        snippet
      );
      snippet.resolveVariables(new CompositeSnippetVariableResolver([
        modelBasedVariableResolver,
        new ClipboardBasedVariableResolver(readClipboardText, idx, indexedSelections.length, editor.getOption(EditorOption.multiCursorPaste) === "spread"),
        new SelectionBasedVariableResolver(model, selection, idx, overtypingCapturer),
        new CommentBasedVariableResolver(model, selection, languageConfigurationService),
        new TimeBasedVariableResolver(),
        new WorkspaceBasedVariableResolver(workspaceService),
        new RandomBasedVariableResolver()
      ]));
      edits[idx] = EditOperation.replace(snippetSelection, snippet.toString());
      edits[idx].identifier = { major: idx, minor: 0 };
      edits[idx]._isTracked = true;
      snippets[idx] = new OneSnippet(editor, snippet, snippetLineLeadingWhitespace);
    }
    return { edits, snippets };
  }
  static createEditsAndSnippetsFromEdits(editor, snippetEdits, enforceFinalTabstop, adjustWhitespace, clipboardText, overtypingCapturer, languageConfigurationService) {
    if (!editor.hasModel() || snippetEdits.length === 0) {
      return { edits: [], snippets: [] };
    }
    const edits = [];
    const model = editor.getModel();
    const parser = new SnippetParser();
    const snippet = new TextmateSnippet();
    const resolver = new CompositeSnippetVariableResolver([
      editor.invokeWithinContext((accessor) => new ModelBasedVariableResolver(accessor.get(ILabelService), model)),
      new ClipboardBasedVariableResolver(() => clipboardText, 0, editor.getSelections().length, editor.getOption(EditorOption.multiCursorPaste) === "spread"),
      new SelectionBasedVariableResolver(model, editor.getSelection(), 0, overtypingCapturer),
      new CommentBasedVariableResolver(model, editor.getSelection(), languageConfigurationService),
      new TimeBasedVariableResolver(),
      new WorkspaceBasedVariableResolver(editor.invokeWithinContext((accessor) => accessor.get(IWorkspaceContextService))),
      new RandomBasedVariableResolver()
    ]);
    snippetEdits = snippetEdits.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
    let offset = 0;
    for (let i = 0; i < snippetEdits.length; i++) {
      const { range, template, keepWhitespace } = snippetEdits[i];
      if (i > 0) {
        const lastRange = snippetEdits[i - 1].range;
        const textRange = Range.fromPositions(lastRange.getEndPosition(), range.getStartPosition());
        const textNode = new Text(model.getValueInRange(textRange));
        snippet.appendChild(textNode);
        offset += textNode.value.length;
      }
      const newNodes = parser.parseFragment(template, snippet);
      SnippetSession.adjustWhitespace(model, range.getStartPosition(), keepWhitespace !== void 0 ? !keepWhitespace : adjustWhitespace, snippet, new Set(newNodes));
      snippet.resolveVariables(resolver);
      const snippetText = snippet.toString();
      const snippetFragmentText = snippetText.slice(offset);
      offset = snippetText.length;
      const edit = EditOperation.replace(range, snippetFragmentText);
      edit.identifier = { major: i, minor: 0 };
      edit._isTracked = true;
      edits.push(edit);
    }
    parser.ensureFinalTabstop(snippet, enforceFinalTabstop, true);
    return {
      edits,
      snippets: [new OneSnippet(editor, snippet, "")]
    };
  }
  dispose() {
    dispose(this._snippets);
  }
  _logInfo() {
    return `template="${this._template}", merged_templates="${this._templateMerges.join(" -> ")}"`;
  }
  insert() {
    if (!this._editor.hasModel()) {
      return;
    }
    const { edits, snippets } = typeof this._template === "string" ? SnippetSession.createEditsAndSnippetsFromSelections(this._editor, this._template, this._options.overwriteBefore, this._options.overwriteAfter, false, this._options.adjustWhitespace, this._options.clipboardText, this._options.overtypingCapturer, this._languageConfigurationService) : SnippetSession.createEditsAndSnippetsFromEdits(this._editor, this._template, false, this._options.adjustWhitespace, this._options.clipboardText, this._options.overtypingCapturer, this._languageConfigurationService);
    this._snippets = snippets;
    this._editor.executeEdits("snippet", edits, (_undoEdits) => {
      const undoEdits = _undoEdits.filter((edit) => !!edit.identifier);
      for (let idx = 0; idx < snippets.length; idx++) {
        snippets[idx].initialize(undoEdits[idx].textChange);
      }
      if (this._snippets[0].hasPlaceholder) {
        return this._move(true);
      } else {
        return undoEdits.map((edit) => Selection.fromPositions(edit.range.getEndPosition()));
      }
    });
    this._editor.revealRange(this._editor.getSelections()[0]);
  }
  merge(template, options = _defaultOptions) {
    if (!this._editor.hasModel()) {
      return;
    }
    this._templateMerges.push([this._snippets[0]._nestingLevel, this._snippets[0]._placeholderGroupsIdx, template]);
    const { edits, snippets } = SnippetSession.createEditsAndSnippetsFromSelections(this._editor, template, options.overwriteBefore, options.overwriteAfter, true, options.adjustWhitespace, options.clipboardText, options.overtypingCapturer, this._languageConfigurationService);
    this._editor.executeEdits("snippet", edits, (_undoEdits) => {
      const undoEdits = _undoEdits.filter((edit) => !!edit.identifier);
      for (let idx = 0; idx < snippets.length; idx++) {
        snippets[idx].initialize(undoEdits[idx].textChange);
      }
      const isTrivialSnippet = snippets[0].isTrivialSnippet;
      if (!isTrivialSnippet) {
        for (const snippet of this._snippets) {
          snippet.merge(snippets);
        }
        console.assert(snippets.length === 0);
      }
      if (this._snippets[0].hasPlaceholder && !isTrivialSnippet) {
        return this._move(void 0);
      } else {
        return undoEdits.map((edit) => Selection.fromPositions(edit.range.getEndPosition()));
      }
    });
  }
  next() {
    const newSelections = this._move(true);
    this._editor.setSelections(newSelections);
    this._editor.revealPositionInCenterIfOutsideViewport(newSelections[0].getPosition());
  }
  prev() {
    const newSelections = this._move(false);
    this._editor.setSelections(newSelections);
    this._editor.revealPositionInCenterIfOutsideViewport(newSelections[0].getPosition());
  }
  _move(fwd) {
    const selections = [];
    for (const snippet of this._snippets) {
      const oneSelection = snippet.move(fwd);
      selections.push(...oneSelection);
    }
    return selections;
  }
  get isAtFirstPlaceholder() {
    return this._snippets[0].isAtFirstPlaceholder;
  }
  get isAtLastPlaceholder() {
    return this._snippets[0].isAtLastPlaceholder;
  }
  get hasPlaceholder() {
    return this._snippets[0].hasPlaceholder;
  }
  get hasChoice() {
    return this._snippets[0].hasChoice;
  }
  get activeChoice() {
    return this._snippets[0].activeChoice;
  }
  isSelectionWithinPlaceholders() {
    if (!this.hasPlaceholder) {
      return false;
    }
    const selections = this._editor.getSelections();
    if (selections.length < this._snippets.length) {
      return false;
    }
    const allPossibleSelections = /* @__PURE__ */ new Map();
    for (const snippet of this._snippets) {
      const possibleSelections = snippet.computePossibleSelections();
      if (allPossibleSelections.size === 0) {
        for (const [index, ranges] of possibleSelections) {
          ranges.sort(Range.compareRangesUsingStarts);
          for (const selection of selections) {
            if (ranges[0].containsRange(selection)) {
              allPossibleSelections.set(index, []);
              break;
            }
          }
        }
      }
      if (allPossibleSelections.size === 0) {
        return false;
      }
      allPossibleSelections.forEach((array, index) => {
        array.push(...possibleSelections.get(index));
      });
    }
    selections.sort(Range.compareRangesUsingStarts);
    for (const [index, ranges] of allPossibleSelections) {
      if (ranges.length !== selections.length) {
        allPossibleSelections.delete(index);
        continue;
      }
      ranges.sort(Range.compareRangesUsingStarts);
      for (let i = 0; i < ranges.length; i++) {
        if (!ranges[i].containsRange(selections[i])) {
          allPossibleSelections.delete(index);
          continue;
        }
      }
    }
    return allPossibleSelections.size > 0;
  }
  getEnclosingRange() {
    let result;
    for (const snippet of this._snippets) {
      const snippetRange = snippet.getEnclosingRange();
      if (!result) {
        result = snippetRange;
      } else {
        result = result.plusRange(snippetRange);
      }
    }
    return result;
  }
};
SnippetSession = __decorateClass([
  __decorateParam(3, ILanguageConfigurationService)
], SnippetSession);
export {
  OneSnippet,
  SnippetSession
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFNlc3Npb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBncm91cEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBnZXRMZWFkaW5nV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0ICcuL3NuaXBwZXRTZXNzaW9uLmNzcyc7XG5pbXBvcnQgeyBJQWN0aXZlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdE9wZXJhdGlvbiwgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFRleHRDaGFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS90ZXh0Q2hhbmdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb24sIElUZXh0TW9kZWwsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgT3ZlcnR5cGluZ0NhcHR1cmVyIH0gZnJvbSAnLi4vLi4vc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3RPdmVydHlwaW5nQ2FwdHVyZXIuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBDaG9pY2UsIE1hcmtlciwgUGxhY2Vob2xkZXIsIFNuaXBwZXRQYXJzZXIsIFRleHQsIFRleHRtYXRlU25pcHBldCB9IGZyb20gJy4vc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBDbGlwYm9hcmRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIsIENvbW1lbnRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIsIENvbXBvc2l0ZVNuaXBwZXRWYXJpYWJsZVJlc29sdmVyLCBNb2RlbEJhc2VkVmFyaWFibGVSZXNvbHZlciwgUmFuZG9tQmFzZWRWYXJpYWJsZVJlc29sdmVyLCBTZWxlY3Rpb25CYXNlZFZhcmlhYmxlUmVzb2x2ZXIsIFRpbWVCYXNlZFZhcmlhYmxlUmVzb2x2ZXIsIFdvcmtzcGFjZUJhc2VkVmFyaWFibGVSZXNvbHZlciB9IGZyb20gJy4vc25pcHBldFZhcmlhYmxlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBPbmVTbmlwcGV0IHtcblxuXHRwcml2YXRlIF9wbGFjZWhvbGRlckRlY29yYXRpb25zPzogTWFwPFBsYWNlaG9sZGVyLCBzdHJpbmc+O1xuXHRwcml2YXRlIF9wbGFjZWhvbGRlckdyb3VwczogUGxhY2Vob2xkZXJbXVtdO1xuXHRwcml2YXRlIF9vZmZzZXQ6IG51bWJlciA9IC0xO1xuXHRfcGxhY2Vob2xkZXJHcm91cHNJZHg6IG51bWJlcjtcblx0X25lc3RpbmdMZXZlbDogbnVtYmVyID0gMTtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfZGVjb3IgPSB7XG5cdFx0YWN0aXZlOiBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHsgZGVzY3JpcHRpb246ICdzbmlwcGV0LXBsYWNlaG9sZGVyLTEnLCBzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMsIGNsYXNzTmFtZTogJ3NuaXBwZXQtcGxhY2Vob2xkZXInIH0pLFxuXHRcdGluYWN0aXZlOiBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHsgZGVzY3JpcHRpb246ICdzbmlwcGV0LXBsYWNlaG9sZGVyLTInLCBzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcywgY2xhc3NOYW1lOiAnc25pcHBldC1wbGFjZWhvbGRlcicgfSksXG5cdFx0YWN0aXZlRmluYWw6IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoeyBkZXNjcmlwdGlvbjogJ3NuaXBwZXQtcGxhY2Vob2xkZXItMycsIHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCBjbGFzc05hbWU6ICdmaW5pc2gtc25pcHBldC1wbGFjZWhvbGRlcicgfSksXG5cdFx0aW5hY3RpdmVGaW5hbDogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7IGRlc2NyaXB0aW9uOiAnc25pcHBldC1wbGFjZWhvbGRlci00Jywgc3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsIGNsYXNzTmFtZTogJ2ZpbmlzaC1zbmlwcGV0LXBsYWNlaG9sZGVyJyB9KSxcblx0fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3NuaXBwZXQ6IFRleHRtYXRlU25pcHBldCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zbmlwcGV0TGluZUxlYWRpbmdXaGl0ZXNwYWNlOiBzdHJpbmdcblx0KSB7XG5cdFx0dGhpcy5fcGxhY2Vob2xkZXJHcm91cHMgPSBncm91cEJ5KF9zbmlwcGV0LnBsYWNlaG9sZGVycywgUGxhY2Vob2xkZXIuY29tcGFyZUJ5SW5kZXgpO1xuXHRcdHRoaXMuX3BsYWNlaG9sZGVyR3JvdXBzSWR4ID0gLTE7XG5cdH1cblxuXHRpbml0aWFsaXplKHRleHRDaGFuZ2U6IFRleHRDaGFuZ2UpOiB2b2lkIHtcblx0XHR0aGlzLl9vZmZzZXQgPSB0ZXh0Q2hhbmdlLm5ld1Bvc2l0aW9uO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcGxhY2Vob2xkZXJEZWNvcmF0aW9ucykge1xuXHRcdFx0dGhpcy5fZWRpdG9yLnJlbW92ZURlY29yYXRpb25zKFsuLi50aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb25zLnZhbHVlcygpXSk7XG5cdFx0fVxuXHRcdHRoaXMuX3BsYWNlaG9sZGVyR3JvdXBzLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRwcml2YXRlIF9pbml0RGVjb3JhdGlvbnMoKTogdm9pZCB7XG5cblx0XHRpZiAodGhpcy5fb2Zmc2V0ID09PSAtMSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBTbmlwcGV0IG5vdCBpbml0aWFsaXplZCFgKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcGxhY2Vob2xkZXJEZWNvcmF0aW9ucykge1xuXHRcdFx0Ly8gYWxyZWFkeSBpbml0aWFsaXplZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbnMgPSBuZXcgTWFwPFBsYWNlaG9sZGVyLCBzdHJpbmc+KCk7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdHRoaXMuX2VkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB7XG5cdFx0XHQvLyBjcmVhdGUgYSBkZWNvcmF0aW9uIGZvciBlYWNoIHBsYWNlaG9sZGVyXG5cdFx0XHRmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIG9mIHRoaXMuX3NuaXBwZXQucGxhY2Vob2xkZXJzKSB7XG5cdFx0XHRcdGNvbnN0IHBsYWNlaG9sZGVyT2Zmc2V0ID0gdGhpcy5fc25pcHBldC5vZmZzZXQocGxhY2Vob2xkZXIpO1xuXHRcdFx0XHRjb25zdCBwbGFjZWhvbGRlckxlbiA9IHRoaXMuX3NuaXBwZXQuZnVsbExlbihwbGFjZWhvbGRlcik7XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhcblx0XHRcdFx0XHRtb2RlbC5nZXRQb3NpdGlvbkF0KHRoaXMuX29mZnNldCArIHBsYWNlaG9sZGVyT2Zmc2V0KSxcblx0XHRcdFx0XHRtb2RlbC5nZXRQb3NpdGlvbkF0KHRoaXMuX29mZnNldCArIHBsYWNlaG9sZGVyT2Zmc2V0ICsgcGxhY2Vob2xkZXJMZW4pXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGNvbnN0IG9wdGlvbnMgPSBwbGFjZWhvbGRlci5pc0ZpbmFsVGFic3RvcCA/IE9uZVNuaXBwZXQuX2RlY29yLmluYWN0aXZlRmluYWwgOiBPbmVTbmlwcGV0Ll9kZWNvci5pbmFjdGl2ZTtcblx0XHRcdFx0Y29uc3QgaGFuZGxlID0gYWNjZXNzb3IuYWRkRGVjb3JhdGlvbihyYW5nZSwgb3B0aW9ucyk7XG5cdFx0XHRcdHRoaXMuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbnMhLnNldChwbGFjZWhvbGRlciwgaGFuZGxlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG1vdmUoZndkOiBib29sZWFuIHwgdW5kZWZpbmVkKTogU2VsZWN0aW9uW10ge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHR0aGlzLl9pbml0RGVjb3JhdGlvbnMoKTtcblxuXHRcdC8vIFRyYW5zZm9ybSBwbGFjZWhvbGRlciB0ZXh0IGlmIG5lY2Vzc2FyeVxuXHRcdGlmICh0aGlzLl9wbGFjZWhvbGRlckdyb3Vwc0lkeCA+PSAwKSB7XG5cdFx0XHRjb25zdCBvcGVyYXRpb25zOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cblx0XHRcdGZvciAoY29uc3QgcGxhY2Vob2xkZXIgb2YgdGhpcy5fcGxhY2Vob2xkZXJHcm91cHNbdGhpcy5fcGxhY2Vob2xkZXJHcm91cHNJZHhdKSB7XG5cdFx0XHRcdC8vIENoZWNrIGlmIHRoZSBwbGFjZWhvbGRlciBoYXMgYSB0cmFuc2Zvcm1hdGlvblxuXHRcdFx0XHRpZiAocGxhY2Vob2xkZXIudHJhbnNmb3JtKSB7XG5cdFx0XHRcdFx0Y29uc3QgaWQgPSB0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb25zIS5nZXQocGxhY2Vob2xkZXIpITtcblx0XHRcdFx0XHRjb25zdCByYW5nZSA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLmdldERlY29yYXRpb25SYW5nZShpZCkhO1xuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRWYWx1ZSA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlSW5SYW5nZShyYW5nZSk7XG5cdFx0XHRcdFx0Y29uc3QgdHJhbnNmb3JtZWRWYWx1ZUxpbmVzID0gcGxhY2Vob2xkZXIudHJhbnNmb3JtLnJlc29sdmUoY3VycmVudFZhbHVlKS5zcGxpdCgvXFxyXFxufFxccnxcXG4vKTtcblx0XHRcdFx0XHQvLyBmaXggaW5kZW50YXRpb24gZm9yIHRyYW5zZm9ybWVkIGxpbmVzXG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCB0cmFuc2Zvcm1lZFZhbHVlTGluZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdHRyYW5zZm9ybWVkVmFsdWVMaW5lc1tpXSA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLm5vcm1hbGl6ZUluZGVudGF0aW9uKHRoaXMuX3NuaXBwZXRMaW5lTGVhZGluZ1doaXRlc3BhY2UgKyB0cmFuc2Zvcm1lZFZhbHVlTGluZXNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRvcGVyYXRpb25zLnB1c2goRWRpdE9wZXJhdGlvbi5yZXBsYWNlKHJhbmdlLCB0cmFuc2Zvcm1lZFZhbHVlTGluZXMuam9pbih0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKS5nZXRFT0woKSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG9wZXJhdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IuZXhlY3V0ZUVkaXRzKCdzbmlwcGV0LnBsYWNlaG9sZGVyVHJhbnNmb3JtJywgb3BlcmF0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGNvdWxkU2tpcFRoaXNQbGFjZWhvbGRlciA9IGZhbHNlO1xuXHRcdGlmIChmd2QgPT09IHRydWUgJiYgdGhpcy5fcGxhY2Vob2xkZXJHcm91cHNJZHggPCB0aGlzLl9wbGFjZWhvbGRlckdyb3Vwcy5sZW5ndGggLSAxKSB7XG5cdFx0XHR0aGlzLl9wbGFjZWhvbGRlckdyb3Vwc0lkeCArPSAxO1xuXHRcdFx0Y291bGRTa2lwVGhpc1BsYWNlaG9sZGVyID0gdHJ1ZTtcblxuXHRcdH0gZWxzZSBpZiAoZndkID09PSBmYWxzZSAmJiB0aGlzLl9wbGFjZWhvbGRlckdyb3Vwc0lkeCA+IDApIHtcblx0XHRcdHRoaXMuX3BsYWNlaG9sZGVyR3JvdXBzSWR4IC09IDE7XG5cdFx0XHRjb3VsZFNraXBUaGlzUGxhY2Vob2xkZXIgPSB0cnVlO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHRoZSBzZWxlY3Rpb24gb2YgdGhlIGN1cnJlbnQgcGxhY2Vob2xkZXIgbWlnaHRcblx0XHRcdC8vIG5vdCBhY3VyYXRlIGFueSBtb3JlIC0+IHNpbXBseSByZXN0b3JlIGl0XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3U2VsZWN0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLmNoYW5nZURlY29yYXRpb25zKGFjY2Vzc29yID0+IHtcblxuXHRcdFx0Y29uc3QgYWN0aXZlUGxhY2Vob2xkZXJzID0gbmV3IFNldDxQbGFjZWhvbGRlcj4oKTtcblxuXHRcdFx0Ly8gY2hhbmdlIHN0aWNraW5lc3MgdG8gYWx3YXlzIGdyb3cgd2hlbiB0eXBpbmcgYXQgaXRzIGVkZ2VzXG5cdFx0XHQvLyBiZWNhdXNlIHRoZXNlIGRlY29yYXRpb25zIHJlcHJlc2VudCB0aGUgY3VycmVudGx5IGFjdGl2ZVxuXHRcdFx0Ly8gdGFic3RvcC5cblx0XHRcdC8vIFNwZWNpYWwgY2FzZSAjMTogcmVhY2hpbmcgdGhlIGZpbmFsIHRhYnN0b3Bcblx0XHRcdC8vIFNwZWNpYWwgY2FzZSAjMjogcGxhY2Vob2xkZXJzIGVuY2xvc2luZyBhY3RpdmUgcGxhY2Vob2xkZXJzXG5cdFx0XHRjb25zdCBzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBwbGFjZWhvbGRlciBvZiB0aGlzLl9wbGFjZWhvbGRlckdyb3Vwc1t0aGlzLl9wbGFjZWhvbGRlckdyb3Vwc0lkeF0pIHtcblx0XHRcdFx0Y29uc3QgaWQgPSB0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb25zIS5nZXQocGxhY2Vob2xkZXIpITtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKS5nZXREZWNvcmF0aW9uUmFuZ2UoaWQpITtcblx0XHRcdFx0c2VsZWN0aW9ucy5wdXNoKG5ldyBTZWxlY3Rpb24ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbiwgcmFuZ2UuZW5kTGluZU51bWJlciwgcmFuZ2UuZW5kQ29sdW1uKSk7XG5cblx0XHRcdFx0Ly8gY29uc2lkZXIgdG8gc2tpcCB0aGlzIHBsYWNlaG9sZGVyIGluZGV4IHdoZW4gdGhlIGRlY29yYXRpb25cblx0XHRcdFx0Ly8gcmFuZ2UgaXMgZW1wdHkgYnV0IHdoZW4gdGhlIHBsYWNlaG9sZGVyIHdhc24ndC4gdGhhdCdzIGEgc3Ryb25nXG5cdFx0XHRcdC8vIGhpbnQgdGhhdCB0aGUgcGxhY2Vob2xkZXIgaGFzIGJlZW4gZGVsZXRlZC4gKGFsbCBwbGFjZWhvbGRlciBtdXN0IG1hdGNoIHRoaXMpXG5cdFx0XHRcdGNvdWxkU2tpcFRoaXNQbGFjZWhvbGRlciA9IGNvdWxkU2tpcFRoaXNQbGFjZWhvbGRlciAmJiB0aGlzLl9oYXNQbGFjZWhvbGRlckJlZW5Db2xsYXBzZWQocGxhY2Vob2xkZXIpO1xuXG5cdFx0XHRcdGFjY2Vzc29yLmNoYW5nZURlY29yYXRpb25PcHRpb25zKGlkLCBwbGFjZWhvbGRlci5pc0ZpbmFsVGFic3RvcCA/IE9uZVNuaXBwZXQuX2RlY29yLmFjdGl2ZUZpbmFsIDogT25lU25pcHBldC5fZGVjb3IuYWN0aXZlKTtcblx0XHRcdFx0YWN0aXZlUGxhY2Vob2xkZXJzLmFkZChwbGFjZWhvbGRlcik7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBlbmNsb3NpbmdQbGFjZWhvbGRlciBvZiB0aGlzLl9zbmlwcGV0LmVuY2xvc2luZ1BsYWNlaG9sZGVycyhwbGFjZWhvbGRlcikpIHtcblx0XHRcdFx0XHRjb25zdCBpZCA9IHRoaXMuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbnMhLmdldChlbmNsb3NpbmdQbGFjZWhvbGRlcikhO1xuXHRcdFx0XHRcdGFjY2Vzc29yLmNoYW5nZURlY29yYXRpb25PcHRpb25zKGlkLCBlbmNsb3NpbmdQbGFjZWhvbGRlci5pc0ZpbmFsVGFic3RvcCA/IE9uZVNuaXBwZXQuX2RlY29yLmFjdGl2ZUZpbmFsIDogT25lU25pcHBldC5fZGVjb3IuYWN0aXZlKTtcblx0XHRcdFx0XHRhY3RpdmVQbGFjZWhvbGRlcnMuYWRkKGVuY2xvc2luZ1BsYWNlaG9sZGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBjaGFuZ2Ugc3RpY2tuZXNzIHRvIG5ldmVyIGdyb3cgd2hlbiB0eXBpbmcgYXQgaXRzIGVkZ2VzXG5cdFx0XHQvLyBzbyB0aGF0IGluLWFjdGl2ZSB0YWJzdG9wcyBuZXZlciBncm93XG5cdFx0XHRmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgaWRdIG9mIHRoaXMuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbnMhKSB7XG5cdFx0XHRcdGlmICghYWN0aXZlUGxhY2Vob2xkZXJzLmhhcyhwbGFjZWhvbGRlcikpIHtcblx0XHRcdFx0XHRhY2Nlc3Nvci5jaGFuZ2VEZWNvcmF0aW9uT3B0aW9ucyhpZCwgcGxhY2Vob2xkZXIuaXNGaW5hbFRhYnN0b3AgPyBPbmVTbmlwcGV0Ll9kZWNvci5pbmFjdGl2ZUZpbmFsIDogT25lU25pcHBldC5fZGVjb3IuaW5hY3RpdmUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBzZWxlY3Rpb25zO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuICFjb3VsZFNraXBUaGlzUGxhY2Vob2xkZXIgPyBuZXdTZWxlY3Rpb25zID8/IFtdIDogdGhpcy5tb3ZlKGZ3ZCk7XG5cdH1cblxuXHRwcml2YXRlIF9oYXNQbGFjZWhvbGRlckJlZW5Db2xsYXBzZWQocGxhY2Vob2xkZXI6IFBsYWNlaG9sZGVyKTogYm9vbGVhbiB7XG5cdFx0Ly8gQSBwbGFjZWhvbGRlciBpcyBlbXB0eSB3aGVuIGl0IHdhc24ndCBlbXB0eSB3aGVuIGF1dGhvcmVkIGJ1dFxuXHRcdC8vIHdoZW4gaXRzIHRyYWNraW5nIGRlY29yYXRpb24gaXMgZW1wdHkuIFRoaXMgYWxzbyBhcHBsaWVzIHRvIGFsbFxuXHRcdC8vIHBvdGVudGlhbCBwYXJlbnQgcGxhY2Vob2xkZXJzXG5cdFx0bGV0IG1hcmtlcjogTWFya2VyIHwgdW5kZWZpbmVkID0gcGxhY2Vob2xkZXI7XG5cdFx0d2hpbGUgKG1hcmtlcikge1xuXHRcdFx0aWYgKG1hcmtlciBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyKSB7XG5cdFx0XHRcdGNvbnN0IGlkID0gdGhpcy5fcGxhY2Vob2xkZXJEZWNvcmF0aW9ucyEuZ2V0KG1hcmtlcikhO1xuXHRcdFx0XHRjb25zdCByYW5nZSA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLmdldERlY29yYXRpb25SYW5nZShpZCkhO1xuXHRcdFx0XHRpZiAocmFuZ2UuaXNFbXB0eSgpICYmIG1hcmtlci50b1N0cmluZygpLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bWFya2VyID0gbWFya2VyLnBhcmVudDtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Z2V0IGlzQXRGaXJzdFBsYWNlaG9sZGVyKCkge1xuXHRcdHJldHVybiB0aGlzLl9wbGFjZWhvbGRlckdyb3Vwc0lkeCA8PSAwIHx8IHRoaXMuX3BsYWNlaG9sZGVyR3JvdXBzLmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdGdldCBpc0F0TGFzdFBsYWNlaG9sZGVyKCkge1xuXHRcdHJldHVybiB0aGlzLl9wbGFjZWhvbGRlckdyb3Vwc0lkeCA9PT0gdGhpcy5fcGxhY2Vob2xkZXJHcm91cHMubGVuZ3RoIC0gMTtcblx0fVxuXG5cdGdldCBoYXNQbGFjZWhvbGRlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc25pcHBldC5wbGFjZWhvbGRlcnMubGVuZ3RoID4gMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNuaXBwZXQgaXMgdHJpdmlhbCB3aGVuIGl0IGhhcyBubyBwbGFjZWhvbGRlciBvciBvbmx5IGEgZmluYWwgcGxhY2Vob2xkZXIgYXRcblx0ICogaXRzIHZlcnkgZW5kXG5cdCAqL1xuXHRnZXQgaXNUcml2aWFsU25pcHBldCgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fc25pcHBldC5wbGFjZWhvbGRlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3NuaXBwZXQucGxhY2Vob2xkZXJzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgW3BsYWNlaG9sZGVyXSA9IHRoaXMuX3NuaXBwZXQucGxhY2Vob2xkZXJzO1xuXHRcdFx0aWYgKHBsYWNlaG9sZGVyLmlzRmluYWxUYWJzdG9wKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9zbmlwcGV0LnJpZ2h0TW9zdERlc2NlbmRhbnQgPT09IHBsYWNlaG9sZGVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y29tcHV0ZVBvc3NpYmxlU2VsZWN0aW9ucygpIHtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgTWFwPG51bWJlciwgUmFuZ2VbXT4oKTtcblx0XHRmb3IgKGNvbnN0IHBsYWNlaG9sZGVyc1dpdGhFcXVhbEluZGV4IG9mIHRoaXMuX3BsYWNlaG9sZGVyR3JvdXBzKSB7XG5cdFx0XHRsZXQgcmFuZ2VzOiBSYW5nZVtdIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIG9mIHBsYWNlaG9sZGVyc1dpdGhFcXVhbEluZGV4KSB7XG5cdFx0XHRcdGlmIChwbGFjZWhvbGRlci5pc0ZpbmFsVGFic3RvcCkge1xuXHRcdFx0XHRcdC8vIGlnbm9yZSB0aG9zZVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFyYW5nZXMpIHtcblx0XHRcdFx0XHRyYW5nZXMgPSBbXTtcblx0XHRcdFx0XHRyZXN1bHQuc2V0KHBsYWNlaG9sZGVyLmluZGV4LCByYW5nZXMpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaWQgPSB0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb25zIS5nZXQocGxhY2Vob2xkZXIpITtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKS5nZXREZWNvcmF0aW9uUmFuZ2UoaWQpO1xuXHRcdFx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRcdFx0Ly8gb25lIG9mIHRoZSBwbGFjZWhvbGRlciBsb3N0IGl0cyBkZWNvcmF0aW9uIGFuZFxuXHRcdFx0XHRcdC8vIHRoZXJlZm9yZSB3ZSBiYWlsIG91dCBhbmQgcHJldGVuZCB0aGUgcGxhY2Vob2xkZXJcblx0XHRcdFx0XHQvLyAod2l0aCBpdHMgbWlycm9ycykgZG9lc24ndCBleGlzdCBhbnltb3JlLlxuXHRcdFx0XHRcdHJlc3VsdC5kZWxldGUocGxhY2Vob2xkZXIuaW5kZXgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmFuZ2VzLnB1c2gocmFuZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0Z2V0IGFjdGl2ZUNob2ljZSgpOiB7IGNob2ljZTogQ2hvaWNlOyByYW5nZTogUmFuZ2UgfSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb25zKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBwbGFjZWhvbGRlciA9IHRoaXMuX3BsYWNlaG9sZGVyR3JvdXBzW3RoaXMuX3BsYWNlaG9sZGVyR3JvdXBzSWR4XVswXTtcblx0XHRpZiAoIXBsYWNlaG9sZGVyPy5jaG9pY2UpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGlkID0gdGhpcy5fcGxhY2Vob2xkZXJEZWNvcmF0aW9ucy5nZXQocGxhY2Vob2xkZXIpO1xuXHRcdGlmICghaWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkuZ2V0RGVjb3JhdGlvblJhbmdlKGlkKTtcblx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4geyByYW5nZSwgY2hvaWNlOiBwbGFjZWhvbGRlci5jaG9pY2UgfTtcblx0fVxuXG5cdGdldCBoYXNDaG9pY2UoKTogYm9vbGVhbiB7XG5cdFx0bGV0IHJlc3VsdCA9IGZhbHNlO1xuXHRcdHRoaXMuX3NuaXBwZXQud2FsayhtYXJrZXIgPT4ge1xuXHRcdFx0cmVzdWx0ID0gbWFya2VyIGluc3RhbmNlb2YgQ2hvaWNlO1xuXHRcdFx0cmV0dXJuICFyZXN1bHQ7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdG1lcmdlKG90aGVyczogT25lU25pcHBldFtdKTogdm9pZCB7XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdHRoaXMuX25lc3RpbmdMZXZlbCAqPSAxMDtcblxuXHRcdHRoaXMuX2VkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB7XG5cblx0XHRcdC8vIEZvciBlYWNoIGFjdGl2ZSBwbGFjZWhvbGRlciB0YWtlIG9uZSBzbmlwcGV0IGFuZCBtZXJnZSBpdFxuXHRcdFx0Ly8gaW4gdGhhdCB0aGUgcGxhY2Vob2xkZXIgKGNhbiBiZSBtYW55IGZvciBgJDFmb28kMWZvb2ApLiBCZWNhdXNlXG5cdFx0XHQvLyBldmVyeXRoaW5nIGlzIHNvcnRlZCBieSBlZGl0b3Igc2VsZWN0aW9uIHdlIGNhbiBzaW1wbHkgcmVtb3ZlXG5cdFx0XHQvLyBlbGVtZW50cyBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFycmF5XG5cdFx0XHRmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIG9mIHRoaXMuX3BsYWNlaG9sZGVyR3JvdXBzW3RoaXMuX3BsYWNlaG9sZGVyR3JvdXBzSWR4XSkge1xuXHRcdFx0XHRjb25zdCBuZXN0ZWQgPSBvdGhlcnMuc2hpZnQoKSE7XG5cdFx0XHRcdGNvbnNvbGUuYXNzZXJ0KG5lc3RlZC5fb2Zmc2V0ICE9PSAtMSk7XG5cdFx0XHRcdGNvbnNvbGUuYXNzZXJ0KCFuZXN0ZWQuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbnMpO1xuXG5cdFx0XHRcdC8vIE1hc3NhZ2UgcGxhY2Vob2xkZXItaW5kaWNpZXMgb2YgdGhlIG5lc3RlZCBzbmlwcGV0IHRvIGJlXG5cdFx0XHRcdC8vIHNvcnRlZCByaWdodCBhZnRlciB0aGUgaW5zZXJ0aW9uIHBvaW50LiBUaGlzIGVuc3VyZXMgd2UgbW92ZVxuXHRcdFx0XHQvLyB0aHJvdWdoIHRoZSBwbGFjZWhvbGRlcnMgaW4gdGhlIGNvcnJlY3Qgb3JkZXJcblx0XHRcdFx0Y29uc3QgaW5kZXhMYXN0UGxhY2Vob2xkZXIgPSBuZXN0ZWQuX3NuaXBwZXQucGxhY2Vob2xkZXJJbmZvLmxhc3QhLmluZGV4O1xuXG5cdFx0XHRcdGZvciAoY29uc3QgbmVzdGVkUGxhY2Vob2xkZXIgb2YgbmVzdGVkLl9zbmlwcGV0LnBsYWNlaG9sZGVySW5mby5hbGwpIHtcblx0XHRcdFx0XHRpZiAobmVzdGVkUGxhY2Vob2xkZXIuaXNGaW5hbFRhYnN0b3ApIHtcblx0XHRcdFx0XHRcdG5lc3RlZFBsYWNlaG9sZGVyLmluZGV4ID0gcGxhY2Vob2xkZXIuaW5kZXggKyAoKGluZGV4TGFzdFBsYWNlaG9sZGVyICsgMSkgLyB0aGlzLl9uZXN0aW5nTGV2ZWwpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRuZXN0ZWRQbGFjZWhvbGRlci5pbmRleCA9IHBsYWNlaG9sZGVyLmluZGV4ICsgKG5lc3RlZFBsYWNlaG9sZGVyLmluZGV4IC8gdGhpcy5fbmVzdGluZ0xldmVsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fc25pcHBldC5yZXBsYWNlKHBsYWNlaG9sZGVyLCBuZXN0ZWQuX3NuaXBwZXQuY2hpbGRyZW4pO1xuXG5cdFx0XHRcdC8vIFJlbW92ZSB0aGUgcGxhY2Vob2xkZXIgYXQgd2hpY2ggcG9zaXRpb24gYXJlIGluc2VydGluZ1xuXHRcdFx0XHQvLyB0aGUgc25pcHBldCBhbmQgYWxzbyByZW1vdmUgaXRzIGRlY29yYXRpb24uXG5cdFx0XHRcdGNvbnN0IGlkID0gdGhpcy5fcGxhY2Vob2xkZXJEZWNvcmF0aW9ucyEuZ2V0KHBsYWNlaG9sZGVyKSE7XG5cdFx0XHRcdGFjY2Vzc29yLnJlbW92ZURlY29yYXRpb24oaWQpO1xuXHRcdFx0XHR0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb25zIS5kZWxldGUocGxhY2Vob2xkZXIpO1xuXG5cdFx0XHRcdC8vIEZvciBlYWNoICpuZXcqIHBsYWNlaG9sZGVyIHdlIGNyZWF0ZSBkZWNvcmF0aW9uIHRvIG1vbml0b3Jcblx0XHRcdFx0Ly8gaG93IGFuZCBpZiBpdCBncm93cy9zaHJpbmtzLlxuXHRcdFx0XHRmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIG9mIG5lc3RlZC5fc25pcHBldC5wbGFjZWhvbGRlcnMpIHtcblx0XHRcdFx0XHRjb25zdCBwbGFjZWhvbGRlck9mZnNldCA9IG5lc3RlZC5fc25pcHBldC5vZmZzZXQocGxhY2Vob2xkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHBsYWNlaG9sZGVyTGVuID0gbmVzdGVkLl9zbmlwcGV0LmZ1bGxMZW4ocGxhY2Vob2xkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhcblx0XHRcdFx0XHRcdG1vZGVsLmdldFBvc2l0aW9uQXQobmVzdGVkLl9vZmZzZXQgKyBwbGFjZWhvbGRlck9mZnNldCksXG5cdFx0XHRcdFx0XHRtb2RlbC5nZXRQb3NpdGlvbkF0KG5lc3RlZC5fb2Zmc2V0ICsgcGxhY2Vob2xkZXJPZmZzZXQgKyBwbGFjZWhvbGRlckxlbilcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGNvbnN0IGhhbmRsZSA9IGFjY2Vzc29yLmFkZERlY29yYXRpb24ocmFuZ2UsIE9uZVNuaXBwZXQuX2RlY29yLmluYWN0aXZlKTtcblx0XHRcdFx0XHR0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb25zIS5zZXQocGxhY2Vob2xkZXIsIGhhbmRsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gTGFzdCwgcmUtY3JlYXRlIHRoZSBwbGFjZWhvbGRlciBncm91cHMgYnkgc29ydGluZyBwbGFjZWhvbGRlcnMgYnkgdGhlaXIgaW5kZXguXG5cdFx0XHR0aGlzLl9wbGFjZWhvbGRlckdyb3VwcyA9IGdyb3VwQnkodGhpcy5fc25pcHBldC5wbGFjZWhvbGRlcnMsIFBsYWNlaG9sZGVyLmNvbXBhcmVCeUluZGV4KTtcblx0XHR9KTtcblx0fVxuXG5cdGdldEVuY2xvc2luZ1JhbmdlKCk6IFJhbmdlIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgcmVzdWx0OiBSYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbklkIG9mIHRoaXMuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbnMhLnZhbHVlcygpKSB7XG5cdFx0XHRjb25zdCBwbGFjZWhvbGRlclJhbmdlID0gbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGRlY29yYXRpb25JZCkgPz8gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0cmVzdWx0ID0gcGxhY2Vob2xkZXJSYW5nZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdCA9IHJlc3VsdC5wbHVzUmFuZ2UocGxhY2Vob2xkZXJSYW5nZSEpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNuaXBwZXRTZXNzaW9uSW5zZXJ0T3B0aW9ucyB7XG5cdG92ZXJ3cml0ZUJlZm9yZTogbnVtYmVyO1xuXHRvdmVyd3JpdGVBZnRlcjogbnVtYmVyO1xuXHRhZGp1c3RXaGl0ZXNwYWNlOiBib29sZWFuO1xuXHRjbGlwYm9hcmRUZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdG92ZXJ0eXBpbmdDYXB0dXJlcjogT3ZlcnR5cGluZ0NhcHR1cmVyIHwgdW5kZWZpbmVkO1xufVxuXG5jb25zdCBfZGVmYXVsdE9wdGlvbnM6IElTbmlwcGV0U2Vzc2lvbkluc2VydE9wdGlvbnMgPSB7XG5cdG92ZXJ3cml0ZUJlZm9yZTogMCxcblx0b3ZlcndyaXRlQWZ0ZXI6IDAsXG5cdGFkanVzdFdoaXRlc3BhY2U6IHRydWUsXG5cdGNsaXBib2FyZFRleHQ6IHVuZGVmaW5lZCxcblx0b3ZlcnR5cGluZ0NhcHR1cmVyOiB1bmRlZmluZWRcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNuaXBwZXRFZGl0IHtcblx0cmFuZ2U6IFJhbmdlO1xuXHR0ZW1wbGF0ZTogc3RyaW5nO1xuXHRrZWVwV2hpdGVzcGFjZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBTbmlwcGV0U2Vzc2lvbiB7XG5cblx0c3RhdGljIGFkanVzdFdoaXRlc3BhY2UobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBJUG9zaXRpb24sIGFkanVzdEluZGVudGF0aW9uOiBib29sZWFuLCBzbmlwcGV0OiBUZXh0bWF0ZVNuaXBwZXQsIGZpbHRlcj86IFNldDxNYXJrZXI+KTogc3RyaW5nIHtcblx0XHRjb25zdCBsaW5lID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0Y29uc3QgbGluZUxlYWRpbmdXaGl0ZXNwYWNlID0gZ2V0TGVhZGluZ1doaXRlc3BhY2UobGluZSwgMCwgcG9zaXRpb24uY29sdW1uIC0gMSk7XG5cblx0XHQvLyB0aGUgc25pcHBldCBhcyBpbnNlcnRlZFxuXHRcdGxldCBzbmlwcGV0VGV4dFN0cmluZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdFx0c25pcHBldC53YWxrKG1hcmtlciA9PiB7XG5cdFx0XHQvLyBhbGwgdGV4dCBlbGVtZW50cyB0aGF0IGFyZSBub3QgaW5zaWRlIGNob2ljZVxuXHRcdFx0aWYgKCEobWFya2VyIGluc3RhbmNlb2YgVGV4dCkgfHwgbWFya2VyLnBhcmVudCBpbnN0YW5jZW9mIENob2ljZSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY2hlY2sgd2l0aCBmaWx0ZXIgKGlmZiBwcm92aWRlZClcblx0XHRcdGlmIChmaWx0ZXIgJiYgIWZpbHRlci5oYXMobWFya2VyKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGluZXMgPSBtYXJrZXIudmFsdWUuc3BsaXQoL1xcclxcbnxcXHJ8XFxuLyk7XG5cblx0XHRcdGlmIChhZGp1c3RJbmRlbnRhdGlvbikge1xuXHRcdFx0XHQvLyBhZGp1c3QgaW5kZW50YXRpb24gb2Ygc25pcHBldCB0ZXN0XG5cdFx0XHRcdC8vIC10aGUgc25pcHBldC1zdGFydCBkb2Vzbid0IGdldCBleHRyYS1pbmRlbnRlZCAobGluZUxlYWRpbmdXaGl0ZXNwYWNlKSwgb25seSBub3JtYWxpemVkXG5cdFx0XHRcdC8vIC1hbGwgTisxIGxpbmVzIGdldCBleHRyYS1pbmRlbnRlZCBhbmQgbm9ybWFsaXplZFxuXHRcdFx0XHQvLyAtdGhlIHRleHQgc3RhcnQgZ2V0IGV4dHJhLWluZGVudGVkIGFuZCBub3JtYWxpemVkIHdoZW4gZm9sbG93aW5nIGEgbGluZWJyZWFrXG5cdFx0XHRcdGNvbnN0IG9mZnNldCA9IHNuaXBwZXQub2Zmc2V0KG1hcmtlcik7XG5cdFx0XHRcdGlmIChvZmZzZXQgPT09IDApIHtcblx0XHRcdFx0XHQvLyBzbmlwcGV0IHN0YXJ0XG5cdFx0XHRcdFx0bGluZXNbMF0gPSBtb2RlbC5ub3JtYWxpemVJbmRlbnRhdGlvbihsaW5lc1swXSk7XG5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBjaGVjayBpZiB0ZXh0IHN0YXJ0IGlzIGFmdGVyIGEgbGluZWJyZWFrXG5cdFx0XHRcdFx0c25pcHBldFRleHRTdHJpbmcgPSBzbmlwcGV0VGV4dFN0cmluZyA/PyBzbmlwcGV0LnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0Y29uc3QgcHJldkNoYXIgPSBzbmlwcGV0VGV4dFN0cmluZy5jaGFyQ29kZUF0KG9mZnNldCAtIDEpO1xuXHRcdFx0XHRcdGlmIChwcmV2Q2hhciA9PT0gQ2hhckNvZGUuTGluZUZlZWQgfHwgcHJldkNoYXIgPT09IENoYXJDb2RlLkNhcnJpYWdlUmV0dXJuKSB7XG5cdFx0XHRcdFx0XHRsaW5lc1swXSA9IG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKGxpbmVMZWFkaW5nV2hpdGVzcGFjZSArIGxpbmVzWzBdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGxpbmVzW2ldID0gbW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24obGluZUxlYWRpbmdXaGl0ZXNwYWNlICsgbGluZXNbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5ld1ZhbHVlID0gbGluZXMuam9pbihtb2RlbC5nZXRFT0woKSk7XG5cdFx0XHRpZiAobmV3VmFsdWUgIT09IG1hcmtlci52YWx1ZSkge1xuXHRcdFx0XHRtYXJrZXIucGFyZW50LnJlcGxhY2UobWFya2VyLCBbbmV3IFRleHQobmV3VmFsdWUpXSk7XG5cdFx0XHRcdHNuaXBwZXRUZXh0U3RyaW5nID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gbGluZUxlYWRpbmdXaGl0ZXNwYWNlO1xuXHR9XG5cblx0c3RhdGljIGFkanVzdFNlbGVjdGlvbihtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIG92ZXJ3cml0ZUJlZm9yZTogbnVtYmVyLCBvdmVyd3JpdGVBZnRlcjogbnVtYmVyKTogU2VsZWN0aW9uIHtcblx0XHRpZiAob3ZlcndyaXRlQmVmb3JlICE9PSAwIHx8IG92ZXJ3cml0ZUFmdGVyICE9PSAwKSB7XG5cdFx0XHQvLyBvdmVyd3JpdGVbQmVmb3JlfEFmdGVyXSBpcyBjb21wdXRlIHVzaW5nIHRoZSBwb3NpdGlvbiwgbm90IHRoZSB3aG9sZVxuXHRcdFx0Ly8gc2VsZWN0aW9uLiB0aGVyZWZvcmUgd2UgYWRqdXN0IHRoZSBzZWxlY3Rpb24gYXJvdW5kIHRoYXQgcG9zaXRpb25cblx0XHRcdGNvbnN0IHsgcG9zaXRpb25MaW5lTnVtYmVyLCBwb3NpdGlvbkNvbHVtbiB9ID0gc2VsZWN0aW9uO1xuXHRcdFx0Y29uc3QgcG9zaXRpb25Db2x1bW5CZWZvcmUgPSBwb3NpdGlvbkNvbHVtbiAtIG92ZXJ3cml0ZUJlZm9yZTtcblx0XHRcdGNvbnN0IHBvc2l0aW9uQ29sdW1uQWZ0ZXIgPSBwb3NpdGlvbkNvbHVtbiArIG92ZXJ3cml0ZUFmdGVyO1xuXG5cdFx0XHRjb25zdCByYW5nZSA9IG1vZGVsLnZhbGlkYXRlUmFuZ2Uoe1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHBvc2l0aW9uTGluZU51bWJlcixcblx0XHRcdFx0c3RhcnRDb2x1bW46IHBvc2l0aW9uQ29sdW1uQmVmb3JlLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBwb3NpdGlvbkxpbmVOdW1iZXIsXG5cdFx0XHRcdGVuZENvbHVtbjogcG9zaXRpb25Db2x1bW5BZnRlclxuXHRcdFx0fSk7XG5cblx0XHRcdHNlbGVjdGlvbiA9IFNlbGVjdGlvbi5jcmVhdGVXaXRoRGlyZWN0aW9uKFxuXHRcdFx0XHRyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRyYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4sXG5cdFx0XHRcdHNlbGVjdGlvbi5nZXREaXJlY3Rpb24oKVxuXHRcdFx0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0fVxuXG5cdHN0YXRpYyBjcmVhdGVFZGl0c0FuZFNuaXBwZXRzRnJvbVNlbGVjdGlvbnMoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvciwgdGVtcGxhdGU6IHN0cmluZywgb3ZlcndyaXRlQmVmb3JlOiBudW1iZXIsIG92ZXJ3cml0ZUFmdGVyOiBudW1iZXIsIGVuZm9yY2VGaW5hbFRhYnN0b3A6IGJvb2xlYW4sIGFkanVzdFdoaXRlc3BhY2U6IGJvb2xlYW4sIGNsaXBib2FyZFRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgb3ZlcnR5cGluZ0NhcHR1cmVyOiBPdmVydHlwaW5nQ2FwdHVyZXIgfCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogeyBlZGl0czogSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW107IHNuaXBwZXRzOiBPbmVTbmlwcGV0W10gfSB7XG5cdFx0Y29uc3QgZWRpdHM6IElJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0Y29uc3Qgc25pcHBldHM6IE9uZVNuaXBwZXRbXSA9IFtdO1xuXG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIHsgZWRpdHMsIHNuaXBwZXRzIH07XG5cdFx0fVxuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VTZXJ2aWNlID0gZWRpdG9yLmludm9rZVdpdGhpbkNvbnRleHQoYWNjZXNzb3IgPT4gYWNjZXNzb3IuZ2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSkpO1xuXHRcdGNvbnN0IG1vZGVsQmFzZWRWYXJpYWJsZVJlc29sdmVyID0gZWRpdG9yLmludm9rZVdpdGhpbkNvbnRleHQoYWNjZXNzb3IgPT4gbmV3IE1vZGVsQmFzZWRWYXJpYWJsZVJlc29sdmVyKGFjY2Vzc29yLmdldChJTGFiZWxTZXJ2aWNlKSwgbW9kZWwpKTtcblx0XHRjb25zdCByZWFkQ2xpcGJvYXJkVGV4dCA9ICgpID0+IGNsaXBib2FyZFRleHQ7XG5cblx0XHQvLyBrbm93IHdoYXQgdGV4dCB0aGUgb3ZlcndyaXRlW0JlZm9yZXxBZnRlcl0gZXh0ZW5zaW9uc1xuXHRcdC8vIG9mIHRoZSBwcmltYXJ5IGN1cnNvciBoYXZlIHNlbGVjdGVkIGJlY2F1c2Ugb25seSB3aGVuXG5cdFx0Ly8gc2Vjb25kYXJ5IHNlbGVjdGlvbnMgZXh0ZW5kIHRvIHRoZSBzYW1lIHRleHQgd2UgY2FuIGdyb3cgdGhlbVxuXHRcdGNvbnN0IGZpcnN0QmVmb3JlVGV4dCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShTbmlwcGV0U2Vzc2lvbi5hZGp1c3RTZWxlY3Rpb24obW9kZWwsIGVkaXRvci5nZXRTZWxlY3Rpb24oKSwgb3ZlcndyaXRlQmVmb3JlLCAwKSk7XG5cdFx0Y29uc3QgZmlyc3RBZnRlclRleHQgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoU25pcHBldFNlc3Npb24uYWRqdXN0U2VsZWN0aW9uKG1vZGVsLCBlZGl0b3IuZ2V0U2VsZWN0aW9uKCksIDAsIG92ZXJ3cml0ZUFmdGVyKSk7XG5cblx0XHQvLyByZW1lbWJlciB0aGUgZmlyc3Qgbm9uLXdoaXRlc3BhY2UgY29sdW1uIHRvIGRlY2lkZSBpZlxuXHRcdC8vIGBrZWVwV2hpdGVzcGFjZWAgc2hvdWxkIGJlIG92ZXJydWxlZCBmb3Igc2Vjb25kYXJ5IHNlbGVjdGlvbnNcblx0XHRjb25zdCBmaXJzdExpbmVGaXJzdE5vbldoaXRlc3BhY2UgPSBtb2RlbC5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGVkaXRvci5nZXRTZWxlY3Rpb24oKS5wb3NpdGlvbkxpbmVOdW1iZXIpO1xuXG5cdFx0Ly8gc29ydCBzZWxlY3Rpb25zIGJ5IHRoZWlyIHN0YXJ0IHBvc2l0aW9uIGJ1dCByZW1lYmVyXG5cdFx0Ly8gdGhlIG9yaWdpbmFsIGluZGV4LiB0aGF0IGFsbG93cyB5b3UgdG8gY3JlYXRlIGNvcnJlY3Rcblx0XHQvLyBvZmZzZXQtYmFzZWQgc2VsZWN0aW9uIGxvZ2ljIHdpdGhvdXQgY2hhbmdpbmcgdGhlXG5cdFx0Ly8gcHJpbWFyeSBzZWxlY3Rpb25cblx0XHRjb25zdCBpbmRleGVkU2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKClcblx0XHRcdC5tYXAoKHNlbGVjdGlvbiwgaWR4KSA9PiAoeyBzZWxlY3Rpb24sIGlkeCB9KSlcblx0XHRcdC5zb3J0KChhLCBiKSA9PiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5zZWxlY3Rpb24sIGIuc2VsZWN0aW9uKSk7XG5cblx0XHRmb3IgKGNvbnN0IHsgc2VsZWN0aW9uLCBpZHggfSBvZiBpbmRleGVkU2VsZWN0aW9ucykge1xuXG5cdFx0XHQvLyBleHRlbmQgc2VsZWN0aW9uIHdpdGggdGhlIGBvdmVyd3JpdGVCZWZvcmVgIGFuZCBgb3ZlcndyaXRlQWZ0ZXJgIGFuZCB0aGVuXG5cdFx0XHQvLyBjb21wYXJlIGlmIHRoaXMgbWF0Y2hlcyB0aGUgZXh0ZW5zaW9ucyBvZiB0aGUgcHJpbWFyeSBzZWxlY3Rpb25cblx0XHRcdGxldCBleHRlbnNpb25CZWZvcmUgPSBTbmlwcGV0U2Vzc2lvbi5hZGp1c3RTZWxlY3Rpb24obW9kZWwsIHNlbGVjdGlvbiwgb3ZlcndyaXRlQmVmb3JlLCAwKTtcblx0XHRcdGxldCBleHRlbnNpb25BZnRlciA9IFNuaXBwZXRTZXNzaW9uLmFkanVzdFNlbGVjdGlvbihtb2RlbCwgc2VsZWN0aW9uLCAwLCBvdmVyd3JpdGVBZnRlcik7XG5cdFx0XHRpZiAoZmlyc3RCZWZvcmVUZXh0ICE9PSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoZXh0ZW5zaW9uQmVmb3JlKSkge1xuXHRcdFx0XHRleHRlbnNpb25CZWZvcmUgPSBzZWxlY3Rpb247XG5cdFx0XHR9XG5cdFx0XHRpZiAoZmlyc3RBZnRlclRleHQgIT09IG1vZGVsLmdldFZhbHVlSW5SYW5nZShleHRlbnNpb25BZnRlcikpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uQWZ0ZXIgPSBzZWxlY3Rpb247XG5cdFx0XHR9XG5cblx0XHRcdC8vIG1lcmdlIHRoZSBiZWZvcmUgYW5kIGFmdGVyIHNlbGVjdGlvbiBpbnRvIG9uZVxuXHRcdFx0Y29uc3Qgc25pcHBldFNlbGVjdGlvbiA9IHNlbGVjdGlvblxuXHRcdFx0XHQuc2V0U3RhcnRQb3NpdGlvbihleHRlbnNpb25CZWZvcmUuc3RhcnRMaW5lTnVtYmVyLCBleHRlbnNpb25CZWZvcmUuc3RhcnRDb2x1bW4pXG5cdFx0XHRcdC5zZXRFbmRQb3NpdGlvbihleHRlbnNpb25BZnRlci5lbmRMaW5lTnVtYmVyLCBleHRlbnNpb25BZnRlci5lbmRDb2x1bW4pO1xuXG5cdFx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSh0ZW1wbGF0ZSwgdHJ1ZSwgZW5mb3JjZUZpbmFsVGFic3RvcCk7XG5cblx0XHRcdC8vIGFkanVzdCB0aGUgdGVtcGxhdGUgc3RyaW5nIHRvIG1hdGNoIHRoZSBpbmRlbnRhdGlvbiBhbmRcblx0XHRcdC8vIHdoaXRlc3BhY2UgcnVsZXMgb2YgdGhpcyBpbnNlcnQgbG9jYXRpb24gKGNhbiBiZSBkaWZmZXJlbnQgZm9yIGVhY2ggY3Vyc29yKVxuXHRcdFx0Ly8gaGFwcGVucyB3aGVuIGJlaW5nIGFza2VkIGZvciAoZGVmYXVsdCkgb3Igd2hlbiB0aGlzIGlzIGEgc2Vjb25kYXJ5XG5cdFx0XHQvLyBjdXJzb3IgYW5kIHRoZSBsZWFkaW5nIHdoaXRlc3BhY2UgaXMgZGlmZmVyZW50XG5cdFx0XHRjb25zdCBzdGFydCA9IHNuaXBwZXRTZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0Y29uc3Qgc25pcHBldExpbmVMZWFkaW5nV2hpdGVzcGFjZSA9IFNuaXBwZXRTZXNzaW9uLmFkanVzdFdoaXRlc3BhY2UoXG5cdFx0XHRcdG1vZGVsLCBzdGFydCxcblx0XHRcdFx0YWRqdXN0V2hpdGVzcGFjZSB8fCAoaWR4ID4gMCAmJiBmaXJzdExpbmVGaXJzdE5vbldoaXRlc3BhY2UgIT09IG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcikpLFxuXHRcdFx0XHRzbmlwcGV0LFxuXHRcdFx0KTtcblxuXHRcdFx0c25pcHBldC5yZXNvbHZlVmFyaWFibGVzKG5ldyBDb21wb3NpdGVTbmlwcGV0VmFyaWFibGVSZXNvbHZlcihbXG5cdFx0XHRcdG1vZGVsQmFzZWRWYXJpYWJsZVJlc29sdmVyLFxuXHRcdFx0XHRuZXcgQ2xpcGJvYXJkQmFzZWRWYXJpYWJsZVJlc29sdmVyKHJlYWRDbGlwYm9hcmRUZXh0LCBpZHgsIGluZGV4ZWRTZWxlY3Rpb25zLmxlbmd0aCwgZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubXVsdGlDdXJzb3JQYXN0ZSkgPT09ICdzcHJlYWQnKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbkJhc2VkVmFyaWFibGVSZXNvbHZlcihtb2RlbCwgc2VsZWN0aW9uLCBpZHgsIG92ZXJ0eXBpbmdDYXB0dXJlciksXG5cdFx0XHRcdG5ldyBDb21tZW50QmFzZWRWYXJpYWJsZVJlc29sdmVyKG1vZGVsLCBzZWxlY3Rpb24sIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpLFxuXHRcdFx0XHRuZXcgVGltZUJhc2VkVmFyaWFibGVSZXNvbHZlcixcblx0XHRcdFx0bmV3IFdvcmtzcGFjZUJhc2VkVmFyaWFibGVSZXNvbHZlcih3b3Jrc3BhY2VTZXJ2aWNlKSxcblx0XHRcdFx0bmV3IFJhbmRvbUJhc2VkVmFyaWFibGVSZXNvbHZlcixcblx0XHRcdF0pKTtcblxuXHRcdFx0Ly8gc3RvcmUgc25pcHBldHMgd2l0aCB0aGUgaW5kZXggb2YgdGhlaXIgb3JpZ2luYXRpbmcgc2VsZWN0aW9uLlxuXHRcdFx0Ly8gdGhhdCBlbnN1cmVzIHRoZSBwcmltYXJ5IGN1cnNvciBzdGF5cyBwcmltYXJ5IGRlc3BpdGUgbm90IGJlaW5nXG5cdFx0XHQvLyB0aGUgb25lIHdpdGggbG93ZXN0IHN0YXJ0IHBvc2l0aW9uXG5cdFx0XHRlZGl0c1tpZHhdID0gRWRpdE9wZXJhdGlvbi5yZXBsYWNlKHNuaXBwZXRTZWxlY3Rpb24sIHNuaXBwZXQudG9TdHJpbmcoKSk7XG5cdFx0XHRlZGl0c1tpZHhdLmlkZW50aWZpZXIgPSB7IG1ham9yOiBpZHgsIG1pbm9yOiAwIH07IC8vIG1hcmsgdGhlIGVkaXQgc28gb25seSBvdXIgdW5kbyBlZGl0cyB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgZW5kIGN1cnNvcnNcblx0XHRcdGVkaXRzW2lkeF0uX2lzVHJhY2tlZCA9IHRydWU7XG5cdFx0XHRzbmlwcGV0c1tpZHhdID0gbmV3IE9uZVNuaXBwZXQoZWRpdG9yLCBzbmlwcGV0LCBzbmlwcGV0TGluZUxlYWRpbmdXaGl0ZXNwYWNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBlZGl0cywgc25pcHBldHMgfTtcblx0fVxuXG5cdHN0YXRpYyBjcmVhdGVFZGl0c0FuZFNuaXBwZXRzRnJvbUVkaXRzKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IsIHNuaXBwZXRFZGl0czogSVNuaXBwZXRFZGl0W10sIGVuZm9yY2VGaW5hbFRhYnN0b3A6IGJvb2xlYW4sIGFkanVzdFdoaXRlc3BhY2U6IGJvb2xlYW4sIGNsaXBib2FyZFRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgb3ZlcnR5cGluZ0NhcHR1cmVyOiBPdmVydHlwaW5nQ2FwdHVyZXIgfCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogeyBlZGl0czogSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW107IHNuaXBwZXRzOiBPbmVTbmlwcGV0W10gfSB7XG5cblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpIHx8IHNuaXBwZXRFZGl0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB7IGVkaXRzOiBbXSwgc25pcHBldHM6IFtdIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdHM6IElJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdGNvbnN0IHBhcnNlciA9IG5ldyBTbmlwcGV0UGFyc2VyKCk7XG5cdFx0Y29uc3Qgc25pcHBldCA9IG5ldyBUZXh0bWF0ZVNuaXBwZXQoKTtcblxuXHRcdC8vIHNuaXBwZXQgdmFyaWFibGVzIHJlc29sdmVyXG5cdFx0Y29uc3QgcmVzb2x2ZXIgPSBuZXcgQ29tcG9zaXRlU25pcHBldFZhcmlhYmxlUmVzb2x2ZXIoW1xuXHRcdFx0ZWRpdG9yLmludm9rZVdpdGhpbkNvbnRleHQoYWNjZXNzb3IgPT4gbmV3IE1vZGVsQmFzZWRWYXJpYWJsZVJlc29sdmVyKGFjY2Vzc29yLmdldChJTGFiZWxTZXJ2aWNlKSwgbW9kZWwpKSxcblx0XHRcdG5ldyBDbGlwYm9hcmRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIoKCkgPT4gY2xpcGJvYXJkVGV4dCwgMCwgZWRpdG9yLmdldFNlbGVjdGlvbnMoKS5sZW5ndGgsIGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLm11bHRpQ3Vyc29yUGFzdGUpID09PSAnc3ByZWFkJyksXG5cdFx0XHRuZXcgU2VsZWN0aW9uQmFzZWRWYXJpYWJsZVJlc29sdmVyKG1vZGVsLCBlZGl0b3IuZ2V0U2VsZWN0aW9uKCksIDAsIG92ZXJ0eXBpbmdDYXB0dXJlciksXG5cdFx0XHRuZXcgQ29tbWVudEJhc2VkVmFyaWFibGVSZXNvbHZlcihtb2RlbCwgZWRpdG9yLmdldFNlbGVjdGlvbigpLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSxcblx0XHRcdG5ldyBUaW1lQmFzZWRWYXJpYWJsZVJlc29sdmVyLFxuXHRcdFx0bmV3IFdvcmtzcGFjZUJhc2VkVmFyaWFibGVSZXNvbHZlcihlZGl0b3IuaW52b2tlV2l0aGluQ29udGV4dChhY2Nlc3NvciA9PiBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKSkpLFxuXHRcdFx0bmV3IFJhbmRvbUJhc2VkVmFyaWFibGVSZXNvbHZlcixcblx0XHRdKTtcblxuXHRcdC8vXG5cdFx0c25pcHBldEVkaXRzID0gc25pcHBldEVkaXRzLnNvcnQoKGEsIGIpID0+IFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyhhLnJhbmdlLCBiLnJhbmdlKSk7XG5cdFx0bGV0IG9mZnNldCA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzbmlwcGV0RWRpdHMubGVuZ3RoOyBpKyspIHtcblxuXHRcdFx0Y29uc3QgeyByYW5nZSwgdGVtcGxhdGUsIGtlZXBXaGl0ZXNwYWNlIH0gPSBzbmlwcGV0RWRpdHNbaV07XG5cblx0XHRcdC8vIGdhcHMgYmV0d2VlbiBzbmlwcGV0IGVkaXRzIGFyZSBhcHBlbmRlZCBhcyB0ZXh0IG5vZGVzLiB0aGlzXG5cdFx0XHQvLyBlbnN1cmVzIHBsYWNlaG9sZGVyLW9mZnNldHMgYXJlIGxhdGVyIGNvcnJlY3Rcblx0XHRcdGlmIChpID4gMCkge1xuXHRcdFx0XHRjb25zdCBsYXN0UmFuZ2UgPSBzbmlwcGV0RWRpdHNbaSAtIDFdLnJhbmdlO1xuXHRcdFx0XHRjb25zdCB0ZXh0UmFuZ2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKGxhc3RSYW5nZS5nZXRFbmRQb3NpdGlvbigpLCByYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRjb25zdCB0ZXh0Tm9kZSA9IG5ldyBUZXh0KG1vZGVsLmdldFZhbHVlSW5SYW5nZSh0ZXh0UmFuZ2UpKTtcblx0XHRcdFx0c25pcHBldC5hcHBlbmRDaGlsZCh0ZXh0Tm9kZSk7XG5cdFx0XHRcdG9mZnNldCArPSB0ZXh0Tm9kZS52YWx1ZS5sZW5ndGg7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5ld05vZGVzID0gcGFyc2VyLnBhcnNlRnJhZ21lbnQodGVtcGxhdGUsIHNuaXBwZXQpO1xuXHRcdFx0U25pcHBldFNlc3Npb24uYWRqdXN0V2hpdGVzcGFjZShtb2RlbCwgcmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpLCBrZWVwV2hpdGVzcGFjZSAhPT0gdW5kZWZpbmVkID8gIWtlZXBXaGl0ZXNwYWNlIDogYWRqdXN0V2hpdGVzcGFjZSwgc25pcHBldCwgbmV3IFNldChuZXdOb2RlcykpO1xuXHRcdFx0c25pcHBldC5yZXNvbHZlVmFyaWFibGVzKHJlc29sdmVyKTtcblxuXHRcdFx0Y29uc3Qgc25pcHBldFRleHQgPSBzbmlwcGV0LnRvU3RyaW5nKCk7XG5cdFx0XHRjb25zdCBzbmlwcGV0RnJhZ21lbnRUZXh0ID0gc25pcHBldFRleHQuc2xpY2Uob2Zmc2V0KTtcblx0XHRcdG9mZnNldCA9IHNuaXBwZXRUZXh0Lmxlbmd0aDtcblxuXHRcdFx0Ly8gbWFrZSBlZGl0XG5cdFx0XHRjb25zdCBlZGl0OiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb24gPSBFZGl0T3BlcmF0aW9uLnJlcGxhY2UocmFuZ2UsIHNuaXBwZXRGcmFnbWVudFRleHQpO1xuXHRcdFx0ZWRpdC5pZGVudGlmaWVyID0geyBtYWpvcjogaSwgbWlub3I6IDAgfTsgLy8gbWFyayB0aGUgZWRpdCBzbyBvbmx5IG91ciB1bmRvIGVkaXRzIHdpbGwgYmUgdXNlZCB0byBnZW5lcmF0ZSBlbmQgY3Vyc29yc1xuXHRcdFx0ZWRpdC5faXNUcmFja2VkID0gdHJ1ZTtcblx0XHRcdGVkaXRzLnB1c2goZWRpdCk7XG5cdFx0fVxuXG5cdFx0Ly9cblx0XHRwYXJzZXIuZW5zdXJlRmluYWxUYWJzdG9wKHNuaXBwZXQsIGVuZm9yY2VGaW5hbFRhYnN0b3AsIHRydWUpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVkaXRzLFxuXHRcdFx0c25pcHBldHM6IFtuZXcgT25lU25pcHBldChlZGl0b3IsIHNuaXBwZXQsICcnKV1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdGVtcGxhdGVNZXJnZXM6IFtudW1iZXIsIG51bWJlciwgc3RyaW5nIHwgSVNuaXBwZXRFZGl0W11dW10gPSBbXTtcblx0cHJpdmF0ZSBfc25pcHBldHM6IE9uZVNuaXBwZXRbXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGVtcGxhdGU6IHN0cmluZyB8IElTbmlwcGV0RWRpdFtdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IElTbmlwcGV0U2Vzc2lvbkluc2VydE9wdGlvbnMgPSBfZGVmYXVsdE9wdGlvbnMsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkgeyB9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMuX3NuaXBwZXRzKTtcblx0fVxuXG5cdF9sb2dJbmZvKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGB0ZW1wbGF0ZT1cIiR7dGhpcy5fdGVtcGxhdGV9XCIsIG1lcmdlZF90ZW1wbGF0ZXM9XCIke3RoaXMuX3RlbXBsYXRlTWVyZ2VzLmpvaW4oJyAtPiAnKX1cImA7XG5cdH1cblxuXHRpbnNlcnQoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgaW5zZXJ0IGVkaXQgYW5kIHN0YXJ0IHdpdGggZmlyc3Qgc2VsZWN0aW9uc1xuXHRcdGNvbnN0IHsgZWRpdHMsIHNuaXBwZXRzIH0gPSB0eXBlb2YgdGhpcy5fdGVtcGxhdGUgPT09ICdzdHJpbmcnXG5cdFx0XHQ/IFNuaXBwZXRTZXNzaW9uLmNyZWF0ZUVkaXRzQW5kU25pcHBldHNGcm9tU2VsZWN0aW9ucyh0aGlzLl9lZGl0b3IsIHRoaXMuX3RlbXBsYXRlLCB0aGlzLl9vcHRpb25zLm92ZXJ3cml0ZUJlZm9yZSwgdGhpcy5fb3B0aW9ucy5vdmVyd3JpdGVBZnRlciwgZmFsc2UsIHRoaXMuX29wdGlvbnMuYWRqdXN0V2hpdGVzcGFjZSwgdGhpcy5fb3B0aW9ucy5jbGlwYm9hcmRUZXh0LCB0aGlzLl9vcHRpb25zLm92ZXJ0eXBpbmdDYXB0dXJlciwgdGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSlcblx0XHRcdDogU25pcHBldFNlc3Npb24uY3JlYXRlRWRpdHNBbmRTbmlwcGV0c0Zyb21FZGl0cyh0aGlzLl9lZGl0b3IsIHRoaXMuX3RlbXBsYXRlLCBmYWxzZSwgdGhpcy5fb3B0aW9ucy5hZGp1c3RXaGl0ZXNwYWNlLCB0aGlzLl9vcHRpb25zLmNsaXBib2FyZFRleHQsIHRoaXMuX29wdGlvbnMub3ZlcnR5cGluZ0NhcHR1cmVyLCB0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3NuaXBwZXRzID0gc25pcHBldHM7XG5cblx0XHR0aGlzLl9lZGl0b3IuZXhlY3V0ZUVkaXRzKCdzbmlwcGV0JywgZWRpdHMsIF91bmRvRWRpdHMgPT4ge1xuXHRcdFx0Ly8gU29tZXRpbWVzLCB0aGUgdGV4dCBidWZmZXIgd2lsbCByZW1vdmUgYXV0b21hdGljIHdoaXRlc3BhY2Ugd2hlbiBkb2luZyBhbnkgZWRpdHMsXG5cdFx0XHQvLyBzbyB3ZSBuZWVkIHRvIGxvb2sgb25seSBhdCB0aGUgdW5kbyBlZGl0cyByZWxldmFudCBmb3IgdXMuXG5cdFx0XHQvLyBPdXIgZWRpdHMgaGF2ZSBhbiBpZGVudGlmaWVyIHNldCBzbyB0aGF0J3MgaG93IHdlIGNhbiBkaXN0aW5ndWlzaCB0aGVtXG5cdFx0XHRjb25zdCB1bmRvRWRpdHMgPSBfdW5kb0VkaXRzLmZpbHRlcihlZGl0ID0+ICEhZWRpdC5pZGVudGlmaWVyKTtcblx0XHRcdGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHNuaXBwZXRzLmxlbmd0aDsgaWR4KyspIHtcblx0XHRcdFx0c25pcHBldHNbaWR4XS5pbml0aWFsaXplKHVuZG9FZGl0c1tpZHhdLnRleHRDaGFuZ2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fc25pcHBldHNbMF0uaGFzUGxhY2Vob2xkZXIpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX21vdmUodHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdW5kb0VkaXRzXG5cdFx0XHRcdFx0Lm1hcChlZGl0ID0+IFNlbGVjdGlvbi5mcm9tUG9zaXRpb25zKGVkaXQucmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX2VkaXRvci5yZXZlYWxSYW5nZSh0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9ucygpWzBdKTtcblx0fVxuXG5cdG1lcmdlKHRlbXBsYXRlOiBzdHJpbmcsIG9wdGlvbnM6IElTbmlwcGV0U2Vzc2lvbkluc2VydE9wdGlvbnMgPSBfZGVmYXVsdE9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3RlbXBsYXRlTWVyZ2VzLnB1c2goW3RoaXMuX3NuaXBwZXRzWzBdLl9uZXN0aW5nTGV2ZWwsIHRoaXMuX3NuaXBwZXRzWzBdLl9wbGFjZWhvbGRlckdyb3Vwc0lkeCwgdGVtcGxhdGVdKTtcblx0XHRjb25zdCB7IGVkaXRzLCBzbmlwcGV0cyB9ID0gU25pcHBldFNlc3Npb24uY3JlYXRlRWRpdHNBbmRTbmlwcGV0c0Zyb21TZWxlY3Rpb25zKHRoaXMuX2VkaXRvciwgdGVtcGxhdGUsIG9wdGlvbnMub3ZlcndyaXRlQmVmb3JlLCBvcHRpb25zLm92ZXJ3cml0ZUFmdGVyLCB0cnVlLCBvcHRpb25zLmFkanVzdFdoaXRlc3BhY2UsIG9wdGlvbnMuY2xpcGJvYXJkVGV4dCwgb3B0aW9ucy5vdmVydHlwaW5nQ2FwdHVyZXIsIHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fZWRpdG9yLmV4ZWN1dGVFZGl0cygnc25pcHBldCcsIGVkaXRzLCBfdW5kb0VkaXRzID0+IHtcblx0XHRcdC8vIFNvbWV0aW1lcywgdGhlIHRleHQgYnVmZmVyIHdpbGwgcmVtb3ZlIGF1dG9tYXRpYyB3aGl0ZXNwYWNlIHdoZW4gZG9pbmcgYW55IGVkaXRzLFxuXHRcdFx0Ly8gc28gd2UgbmVlZCB0byBsb29rIG9ubHkgYXQgdGhlIHVuZG8gZWRpdHMgcmVsZXZhbnQgZm9yIHVzLlxuXHRcdFx0Ly8gT3VyIGVkaXRzIGhhdmUgYW4gaWRlbnRpZmllciBzZXQgc28gdGhhdCdzIGhvdyB3ZSBjYW4gZGlzdGluZ3Vpc2ggdGhlbVxuXHRcdFx0Y29uc3QgdW5kb0VkaXRzID0gX3VuZG9FZGl0cy5maWx0ZXIoZWRpdCA9PiAhIWVkaXQuaWRlbnRpZmllcik7XG5cdFx0XHRmb3IgKGxldCBpZHggPSAwOyBpZHggPCBzbmlwcGV0cy5sZW5ndGg7IGlkeCsrKSB7XG5cdFx0XHRcdHNuaXBwZXRzW2lkeF0uaW5pdGlhbGl6ZSh1bmRvRWRpdHNbaWR4XS50ZXh0Q2hhbmdlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVHJpdmlhbCBzbmlwcGV0cyBoYXZlIG5vIHBsYWNlaG9sZGVyIG9yIGFyZSBqdXN0IHRoZSBmaW5hbCBwbGFjZWhvbGRlci4gVGhhdCBtZWFucyB0aGV5XG5cdFx0XHQvLyBhcmUganVzdCB0ZXh0IGluc2VydGlvbnMgYW5kIHdlIGRvbid0IG5lZWQgdG8gbWVyZ2UgdGhlIG5lc3RlZCBzbmlwcGV0IGludG8gdGhlIGV4aXN0aW5nXG5cdFx0XHQvLyBzbmlwcGV0XG5cdFx0XHRjb25zdCBpc1RyaXZpYWxTbmlwcGV0ID0gc25pcHBldHNbMF0uaXNUcml2aWFsU25pcHBldDtcblx0XHRcdGlmICghaXNUcml2aWFsU25pcHBldCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNuaXBwZXQgb2YgdGhpcy5fc25pcHBldHMpIHtcblx0XHRcdFx0XHRzbmlwcGV0Lm1lcmdlKHNuaXBwZXRzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zb2xlLmFzc2VydChzbmlwcGV0cy5sZW5ndGggPT09IDApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fc25pcHBldHNbMF0uaGFzUGxhY2Vob2xkZXIgJiYgIWlzVHJpdmlhbFNuaXBwZXQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX21vdmUodW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB1bmRvRWRpdHMubWFwKGVkaXQgPT4gU2VsZWN0aW9uLmZyb21Qb3NpdGlvbnMoZWRpdC5yYW5nZS5nZXRFbmRQb3NpdGlvbigpKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRuZXh0KCk6IHZvaWQge1xuXHRcdGNvbnN0IG5ld1NlbGVjdGlvbnMgPSB0aGlzLl9tb3ZlKHRydWUpO1xuXHRcdHRoaXMuX2VkaXRvci5zZXRTZWxlY3Rpb25zKG5ld1NlbGVjdGlvbnMpO1xuXHRcdHRoaXMuX2VkaXRvci5yZXZlYWxQb3NpdGlvbkluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQobmV3U2VsZWN0aW9uc1swXS5nZXRQb3NpdGlvbigpKTtcblx0fVxuXG5cdHByZXYoKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3U2VsZWN0aW9ucyA9IHRoaXMuX21vdmUoZmFsc2UpO1xuXHRcdHRoaXMuX2VkaXRvci5zZXRTZWxlY3Rpb25zKG5ld1NlbGVjdGlvbnMpO1xuXHRcdHRoaXMuX2VkaXRvci5yZXZlYWxQb3NpdGlvbkluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQobmV3U2VsZWN0aW9uc1swXS5nZXRQb3NpdGlvbigpKTtcblx0fVxuXG5cdHByaXZhdGUgX21vdmUoZndkOiBib29sZWFuIHwgdW5kZWZpbmVkKTogU2VsZWN0aW9uW10ge1xuXHRcdGNvbnN0IHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBzbmlwcGV0IG9mIHRoaXMuX3NuaXBwZXRzKSB7XG5cdFx0XHRjb25zdCBvbmVTZWxlY3Rpb24gPSBzbmlwcGV0Lm1vdmUoZndkKTtcblx0XHRcdHNlbGVjdGlvbnMucHVzaCguLi5vbmVTZWxlY3Rpb24pO1xuXHRcdH1cblx0XHRyZXR1cm4gc2VsZWN0aW9ucztcblx0fVxuXG5cdGdldCBpc0F0Rmlyc3RQbGFjZWhvbGRlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc25pcHBldHNbMF0uaXNBdEZpcnN0UGxhY2Vob2xkZXI7XG5cdH1cblxuXHRnZXQgaXNBdExhc3RQbGFjZWhvbGRlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc25pcHBldHNbMF0uaXNBdExhc3RQbGFjZWhvbGRlcjtcblx0fVxuXG5cdGdldCBoYXNQbGFjZWhvbGRlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc25pcHBldHNbMF0uaGFzUGxhY2Vob2xkZXI7XG5cdH1cblxuXHRnZXQgaGFzQ2hvaWNlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zbmlwcGV0c1swXS5oYXNDaG9pY2U7XG5cdH1cblxuXHRnZXQgYWN0aXZlQ2hvaWNlKCk6IHsgY2hvaWNlOiBDaG9pY2U7IHJhbmdlOiBSYW5nZSB9IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fc25pcHBldHNbMF0uYWN0aXZlQ2hvaWNlO1xuXHR9XG5cblx0aXNTZWxlY3Rpb25XaXRoaW5QbGFjZWhvbGRlcnMoKTogYm9vbGVhbiB7XG5cblx0XHRpZiAoIXRoaXMuaGFzUGxhY2Vob2xkZXIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRpZiAoc2VsZWN0aW9ucy5sZW5ndGggPCB0aGlzLl9zbmlwcGV0cy5sZW5ndGgpIHtcblx0XHRcdC8vIHRoaXMgbWVhbnMgd2Ugc3RhcnRlZCBzbmlwcGV0IG1vZGUgd2l0aCBOXG5cdFx0XHQvLyBzZWxlY3Rpb25zIGFuZCBoYXZlIE0gKE4gPiBNKSBzZWxlY3Rpb25zLlxuXHRcdFx0Ly8gU28gb25lIHNuaXBwZXQgaXMgd2l0aG91dCBzZWxlY3Rpb24gLT4gY2FuY2VsXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsUG9zc2libGVTZWxlY3Rpb25zID0gbmV3IE1hcDxudW1iZXIsIFJhbmdlW10+KCk7XG5cdFx0Zm9yIChjb25zdCBzbmlwcGV0IG9mIHRoaXMuX3NuaXBwZXRzKSB7XG5cblx0XHRcdGNvbnN0IHBvc3NpYmxlU2VsZWN0aW9ucyA9IHNuaXBwZXQuY29tcHV0ZVBvc3NpYmxlU2VsZWN0aW9ucygpO1xuXG5cdFx0XHQvLyBmb3IgdGhlIGZpcnN0IHNuaXBwZXQgZmluZCB0aGUgcGxhY2Vob2xkZXIgKGFuZCBpdHMgcmFuZ2VzKVxuXHRcdFx0Ly8gdGhhdCBjb250YWluIGF0IGxlYXN0IG9uZSBzZWxlY3Rpb24uIGZvciBhbGwgcmVtYWluaW5nIHNuaXBwZXRzXG5cdFx0XHQvLyB0aGUgc2FtZSBwbGFjZWhvbGRlciAoYW5kIHRoZWlyIHJhbmdlcykgbXVzdCBiZSB1c2VkLlxuXHRcdFx0aWYgKGFsbFBvc3NpYmxlU2VsZWN0aW9ucy5zaXplID09PSAwKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgW2luZGV4LCByYW5nZXNdIG9mIHBvc3NpYmxlU2VsZWN0aW9ucykge1xuXHRcdFx0XHRcdHJhbmdlcy5zb3J0KFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyk7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2Ygc2VsZWN0aW9ucykge1xuXHRcdFx0XHRcdFx0aWYgKHJhbmdlc1swXS5jb250YWluc1JhbmdlKHNlbGVjdGlvbikpIHtcblx0XHRcdFx0XHRcdFx0YWxsUG9zc2libGVTZWxlY3Rpb25zLnNldChpbmRleCwgW10pO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGFsbFBvc3NpYmxlU2VsZWN0aW9ucy5zaXplID09PSAwKSB7XG5cdFx0XHRcdC8vIHJldHVybiBmYWxzZSBpZiB3ZSBjb3VsZG4ndCBhc3NvY2lhdGUgYSBzZWxlY3Rpb24gdG9cblx0XHRcdFx0Ly8gdGhpcyAodGhlIGZpcnN0KSBzbmlwcGV0XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gYWRkIHNlbGVjdGlvbnMgZnJvbSAndGhpcycgc25pcHBldCBzbyB0aGF0IHdlIGtub3cgYWxsXG5cdFx0XHQvLyBzZWxlY3Rpb25zIGZvciB0aGlzIHBsYWNlaG9sZGVyXG5cdFx0XHRhbGxQb3NzaWJsZVNlbGVjdGlvbnMuZm9yRWFjaCgoYXJyYXksIGluZGV4KSA9PiB7XG5cdFx0XHRcdGFycmF5LnB1c2goLi4ucG9zc2libGVTZWxlY3Rpb25zLmdldChpbmRleCkhKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIHNvcnQgc2VsZWN0aW9ucyAoYW5kIGxhdGVyIHBsYWNlaG9sZGVyLXJhbmdlcykuIHRoZW4gd2FsayBib3RoXG5cdFx0Ly8gYXJyYXlzIGFuZCBtYWtlIHN1cmUgdGhlIHBsYWNlaG9sZGVyLXJhbmdlcyBjb250YWluIHRoZSBjb3JyZXNwb25kaW5nXG5cdFx0Ly8gc2VsZWN0aW9uXG5cdFx0c2VsZWN0aW9ucy5zb3J0KFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyk7XG5cblx0XHRmb3IgKGNvbnN0IFtpbmRleCwgcmFuZ2VzXSBvZiBhbGxQb3NzaWJsZVNlbGVjdGlvbnMpIHtcblx0XHRcdGlmIChyYW5nZXMubGVuZ3RoICE9PSBzZWxlY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRhbGxQb3NzaWJsZVNlbGVjdGlvbnMuZGVsZXRlKGluZGV4KTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHJhbmdlcy5zb3J0KFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyk7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICghcmFuZ2VzW2ldLmNvbnRhaW5zUmFuZ2Uoc2VsZWN0aW9uc1tpXSkpIHtcblx0XHRcdFx0XHRhbGxQb3NzaWJsZVNlbGVjdGlvbnMuZGVsZXRlKGluZGV4KTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGZyb20gYWxsIHBvc3NpYmxlIHNlbGVjdGlvbnMgd2UgaGF2ZSBkZWxldGVkIHRob3NlXG5cdFx0Ly8gdGhhdCBkb24ndCBtYXRjaCB3aXRoIHRoZSBjdXJyZW50IHNlbGVjdGlvbi4gaWYgd2UgZG9uJ3Rcblx0XHQvLyBoYXZlIGFueSBsZWZ0LCB3ZSBkb24ndCBoYXZlIGEgc2VsZWN0aW9uIGFueW1vcmVcblx0XHRyZXR1cm4gYWxsUG9zc2libGVTZWxlY3Rpb25zLnNpemUgPiAwO1xuXHR9XG5cblx0cHVibGljIGdldEVuY2xvc2luZ1JhbmdlKCk6IFJhbmdlIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgcmVzdWx0OiBSYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IHNuaXBwZXQgb2YgdGhpcy5fc25pcHBldHMpIHtcblx0XHRcdGNvbnN0IHNuaXBwZXRSYW5nZSA9IHNuaXBwZXQuZ2V0RW5jbG9zaW5nUmFuZ2UoKTtcblx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdHJlc3VsdCA9IHNuaXBwZXRSYW5nZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdCA9IHJlc3VsdC5wbHVzUmFuZ2Uoc25pcHBldFJhbmdl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
