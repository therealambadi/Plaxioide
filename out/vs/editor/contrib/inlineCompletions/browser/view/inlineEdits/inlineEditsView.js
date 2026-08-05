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
import { equalsIfDefined, itemEquals } from "../../../../../../base/common/equals.js";
import { BugIndicatingError } from "../../../../../../base/common/errors.js";
import { Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { autorunWithStore, derived, derivedOpts, derivedWithStore, mapObservableArrayCached, observableValue } from "../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { observableCodeEditor } from "../../../../../browser/observableCodeEditor.js";
import { EditorOption } from "../../../../../common/config/editorOptions.js";
import { LineRange } from "../../../../../common/core/lineRange.js";
import { Range } from "../../../../../common/core/range.js";
import { SingleTextEdit, StringText } from "../../../../../common/core/textEdit.js";
import { TextLength } from "../../../../../common/core/textLength.js";
import { lineRangeMappingFromRangeMappings, RangeMapping } from "../../../../../common/diff/rangeMapping.js";
import { TextModel } from "../../../../../common/model/textModel.js";
import { InlineEditsGutterIndicator } from "./components/gutterIndicatorView.js";
import { InlineEditTabAction } from "./inlineEditsViewInterface.js";
import { InlineEditsCollapsedView } from "./inlineEditsViews/inlineEditsCollapsedView.js";
import { InlineEditsDeletionView } from "./inlineEditsViews/inlineEditsDeletionView.js";
import { InlineEditsInsertionView } from "./inlineEditsViews/inlineEditsInsertionView.js";
import { InlineEditsLineReplacementView } from "./inlineEditsViews/inlineEditsLineReplacementView.js";
import { InlineEditsSideBySideView } from "./inlineEditsViews/inlineEditsSideBySideView.js";
import { InlineEditsWordReplacementView } from "./inlineEditsViews/inlineEditsWordReplacementView.js";
import { OriginalEditorInlineDiffView } from "./inlineEditsViews/originalEditorInlineDiffView.js";
import { applyEditToModifiedRangeMappings, createReindentEdit } from "./utils/utils.js";
import "./view.css";
let InlineEditsView = class extends Disposable {
  constructor(_editor, _host, _model, _ghostTextIndicator, _focusIsInMenu, _instantiationService) {
    super();
    this._editor = _editor;
    this._host = _host;
    this._model = _model;
    this._ghostTextIndicator = _ghostTextIndicator;
    this._focusIsInMenu = _focusIsInMenu;
    this._instantiationService = _instantiationService;
    this._editorObs = observableCodeEditor(this._editor);
    this._tabAction = derived((reader) => this._model.read(reader)?.tabAction.read(reader) ?? InlineEditTabAction.Inactive);
    this._constructorDone = observableValue(this, false);
    this._uiState = derived(this, (reader) => {
      const model = this._model.read(reader);
      if (!model || !this._constructorDone.read(reader)) {
        return void 0;
      }
      model.handleInlineEditShown();
      const inlineEdit = model.inlineEdit;
      let mappings = RangeMapping.fromEdit(inlineEdit.edit);
      let newText = inlineEdit.edit.apply(inlineEdit.originalText);
      let diff = lineRangeMappingFromRangeMappings(mappings, inlineEdit.originalText, new StringText(newText));
      const originalDisplayRange = inlineEdit.originalText.lineRange.intersect(
        inlineEdit.originalLineRange.join(
          LineRange.ofLength(inlineEdit.originalLineRange.startLineNumber, inlineEdit.lineEdit.newLines.length)
        )
      );
      let state = this.determineRenderState(model, reader, diff, new StringText(newText), originalDisplayRange);
      if (!state) {
        model.abort(`unable to determine view: tried to render ${this._previousView?.view}`);
        return void 0;
      }
      if (state.kind === "sideBySide") {
        const indentationAdjustmentEdit = createReindentEdit(newText, inlineEdit.modifiedLineRange);
        newText = indentationAdjustmentEdit.applyToString(newText);
        mappings = applyEditToModifiedRangeMappings(mappings, indentationAdjustmentEdit);
        diff = lineRangeMappingFromRangeMappings(mappings, inlineEdit.originalText, new StringText(newText));
      }
      this._previewTextModel.setLanguage(this._editor.getModel().getLanguageId());
      const previousNewText = this._previewTextModel.getValue();
      if (previousNewText !== newText) {
        this._previewTextModel.setValue(newText);
      }
      if (model.showCollapsed.read(reader) && !this._indicator.read(reader)?.isHoverVisible.read(reader)) {
        state = { kind: "collapsed" };
      }
      return {
        state,
        diff,
        edit: inlineEdit,
        newText,
        newTextLineCount: inlineEdit.modifiedLineRange.length,
        originalDisplayRange
      };
    });
    this._previewTextModel = this._register(this._instantiationService.createInstance(
      TextModel,
      "",
      this._editor.getModel().getLanguageId(),
      { ...TextModel.DEFAULT_CREATION_OPTIONS, bracketPairColorizationOptions: { enabled: true, independentColorPoolPerBracketType: false } },
      null
    ));
    this._indicatorCyclicDependencyCircuitBreaker = observableValue(this, false);
    this._indicator = derivedWithStore(this, (reader, store) => {
      if (!this._indicatorCyclicDependencyCircuitBreaker.read(reader)) {
        return void 0;
      }
      const indicatorDisplayRange = derivedOpts({ owner: this, equalsFn: equalsIfDefined(itemEquals()) }, (reader2) => {
        const ghostTextIndicator = this._ghostTextIndicator.read(reader2);
        if (ghostTextIndicator) {
          return ghostTextIndicator.lineRange;
        }
        const state = this._uiState.read(reader2);
        if (state?.state?.kind === "insertionMultiLine") {
          return this._insertion.originalLines.read(reader2);
        }
        return state?.originalDisplayRange;
      });
      const modelWithGhostTextSupport = derived(this, (reader2) => {
        const model = this._model.read(reader2);
        if (model) {
          return model;
        }
        const ghostTextIndicator = this._ghostTextIndicator.read(reader2);
        if (ghostTextIndicator) {
          return ghostTextIndicator.model;
        }
        return model;
      });
      return store.add(this._instantiationService.createInstance(
        InlineEditsGutterIndicator,
        this._editorObs,
        indicatorDisplayRange,
        this._gutterIndicatorOffset,
        this._host,
        modelWithGhostTextSupport,
        this._inlineEditsIsHovered,
        this._focusIsInMenu
      ));
    });
    this._inlineEditsIsHovered = derived(this, (reader) => {
      return this._sideBySide.isHovered.read(reader) || this._wordReplacementViews.read(reader).some((v) => v.isHovered.read(reader)) || this._deletion.isHovered.read(reader) || this._inlineDiffView.isHovered.read(reader) || this._lineReplacementView.isHovered.read(reader) || this._insertion.isHovered.read(reader);
    });
    this._gutterIndicatorOffset = derived(this, (reader) => {
      if (this._uiState.read(reader)?.state?.kind === "insertionMultiLine") {
        return this._insertion.startLineOffset.read(reader);
      }
      return 0;
    });
    this._sideBySide = this._register(this._instantiationService.createInstance(
      InlineEditsSideBySideView,
      this._editor,
      this._model.map((m) => m?.inlineEdit),
      this._previewTextModel,
      this._uiState.map((s) => s && s.state?.kind === "sideBySide" ? {
        newTextLineCount: s.newTextLineCount,
        originalDisplayRange: s.originalDisplayRange
      } : void 0),
      this._tabAction
    ));
    this._deletion = this._register(this._instantiationService.createInstance(
      InlineEditsDeletionView,
      this._editor,
      this._model.map((m) => m?.inlineEdit),
      this._uiState.map((s) => s && s.state?.kind === "deletion" ? {
        originalRange: s.state.originalRange,
        deletions: s.state.deletions
      } : void 0),
      this._tabAction
    ));
    this._insertion = this._register(this._instantiationService.createInstance(
      InlineEditsInsertionView,
      this._editor,
      this._uiState.map((s) => s && s.state?.kind === "insertionMultiLine" ? {
        lineNumber: s.state.lineNumber,
        startColumn: s.state.column,
        text: s.state.text
      } : void 0),
      this._tabAction
    ));
    this._inlineDiffViewState = derived(this, (reader) => {
      const e = this._uiState.read(reader);
      if (!e || !e.state) {
        return void 0;
      }
      if (e.state.kind === "wordReplacements" || e.state.kind === "lineReplacement" || e.state.kind === "insertionMultiLine" || e.state.kind === "collapsed") {
        return void 0;
      }
      return {
        modifiedText: new StringText(e.newText),
        diff: e.diff,
        mode: e.state.kind,
        modifiedCodeEditor: this._sideBySide.previewEditor
      };
    });
    this._inlineCollapsedView = this._register(this._instantiationService.createInstance(
      InlineEditsCollapsedView,
      this._editor,
      this._model.map((m, reader) => this._uiState.read(reader)?.state?.kind === "collapsed" ? m?.inlineEdit : void 0)
    ));
    this._inlineDiffView = this._register(new OriginalEditorInlineDiffView(this._editor, this._inlineDiffViewState, this._previewTextModel));
    this._wordReplacementViews = mapObservableArrayCached(this, this._uiState.map((s) => s?.state?.kind === "wordReplacements" ? s.state.replacements : []), (e, store) => {
      return store.add(this._instantiationService.createInstance(InlineEditsWordReplacementView, this._editorObs, e, this._tabAction));
    });
    this._lineReplacementView = this._register(this._instantiationService.createInstance(
      InlineEditsLineReplacementView,
      this._editorObs,
      this._uiState.map((s) => s?.state?.kind === "lineReplacement" ? {
        originalRange: s.state.originalRange,
        modifiedRange: s.state.modifiedRange,
        modifiedLines: s.state.modifiedLines,
        replacements: s.state.replacements
      } : void 0),
      this._tabAction
    ));
    this._useCodeShifting = this._editorObs.getOption(EditorOption.inlineSuggest).map((s) => s.edits.allowCodeShifting);
    this._renderSideBySide = this._editorObs.getOption(EditorOption.inlineSuggest).map((s) => s.edits.renderSideBySide);
    this._useMultiLineGhostText = this._editorObs.getOption(EditorOption.inlineSuggest).map((s) => s.edits.useMultiLineGhostText);
    this._register(autorunWithStore((reader, store) => {
      const model = this._model.read(reader);
      if (!model) {
        return;
      }
      store.add(
        Event.any(
          this._sideBySide.onDidClick,
          this._deletion.onDidClick,
          this._lineReplacementView.onDidClick,
          this._insertion.onDidClick,
          ...this._wordReplacementViews.read(reader).map((w) => w.onDidClick),
          this._inlineDiffView.onDidClick
        )((e) => {
          if (this._viewHasBeenShownLongerThan(350)) {
            e.preventDefault();
            model.accept();
          }
        })
      );
    }));
    this._indicator.recomputeInitiallyAndOnChange(this._store);
    this._wordReplacementViews.recomputeInitiallyAndOnChange(this._store);
    this._indicatorCyclicDependencyCircuitBreaker.set(true, void 0);
    this._constructorDone.set(true, void 0);
  }
  getCacheId(model) {
    const inlineEdit = model.inlineEdit;
    if (this._host.get()?.inPartialAcceptFlow.get()) {
      return `${inlineEdit.inlineCompletion.id}_${inlineEdit.edit.edits.map((innerEdit) => innerEdit.range.toString() + innerEdit.text).join(",")}`;
    }
    return inlineEdit.inlineCompletion.id;
  }
  determineView(model, reader, diff, newText, originalDisplayRange) {
    const inlineEdit = model.inlineEdit;
    const canUseCache = this._previousView?.id === this.getCacheId(model);
    const reconsiderViewEditorWidthChange = this._previousView?.editorWidth !== this._editorObs.layoutInfoWidth.read(reader) && (this._previousView?.view === "sideBySide" || this._previousView?.view === "lineReplacement");
    if (canUseCache && !reconsiderViewEditorWidthChange) {
      return this._previousView.view;
    }
    const inner = diff.flatMap((d) => d.innerChanges ?? []);
    const isSingleInnerEdit = inner.length === 1;
    if (isSingleInnerEdit && this._useCodeShifting.read(reader) !== "never" && isSingleLineInsertionAfterPosition(diff, inlineEdit.cursorPosition)) {
      return "insertionInline";
    }
    const innerValues = inner.map((m) => ({ original: inlineEdit.originalText.getValueOfRange(m.originalRange), modified: newText.getValueOfRange(m.modifiedRange) }));
    if (innerValues.every(({ original, modified }) => modified.trim() === "" && original.length > 0 && (original.length > modified.length || original.trim() !== ""))) {
      return "deletion";
    }
    if (isSingleMultiLineInsertion(diff) && this._useMultiLineGhostText.read(reader) && this._useCodeShifting.read(reader) === "always") {
      return "insertionMultiLine";
    }
    const numOriginalLines = inlineEdit.originalLineRange.length;
    const numModifiedLines = inlineEdit.modifiedLineRange.length;
    const allInnerChangesNotTooLong = inner.every((m) => TextLength.ofRange(m.originalRange).columnCount < InlineEditsWordReplacementView.MAX_LENGTH && TextLength.ofRange(m.modifiedRange).columnCount < InlineEditsWordReplacementView.MAX_LENGTH);
    if (allInnerChangesNotTooLong && isSingleInnerEdit && numOriginalLines === 1 && numModifiedLines === 1) {
      if (!inner.some((m) => m.originalRange.isEmpty()) || !growEditsUntilWhitespace(inner.map((m) => new SingleTextEdit(m.originalRange, "")), inlineEdit.originalText).some((e) => e.range.isEmpty() && TextLength.ofRange(e.range).columnCount < InlineEditsWordReplacementView.MAX_LENGTH)) {
        return "wordReplacements";
      }
    }
    if (numOriginalLines > 0 && numModifiedLines > 0) {
      if (this._renderSideBySide.read(reader) !== "never" && InlineEditsSideBySideView.fitsInsideViewport(this._editor, this._previewTextModel, inlineEdit, originalDisplayRange, reader)) {
        return "sideBySide";
      }
      return "lineReplacement";
    }
    return "sideBySide";
  }
  determineRenderState(model, reader, diff, newText, originalDisplayRange) {
    const inlineEdit = model.inlineEdit;
    const view = this.determineView(model, reader, diff, newText, originalDisplayRange);
    this._previousView = { id: this.getCacheId(model), view, editorWidth: this._editor.getLayoutInfo().width, timestamp: Date.now() };
    switch (view) {
      case "insertionInline":
        return { kind: "insertionInline" };
      case "sideBySide":
        return { kind: "sideBySide" };
      case "collapsed":
        return { kind: "collapsed" };
    }
    const inner = diff.flatMap((d) => d.innerChanges ?? []);
    if (view === "deletion") {
      return {
        kind: "deletion",
        originalRange: inlineEdit.originalLineRange,
        deletions: inner.map((m) => m.originalRange)
      };
    }
    if (view === "insertionMultiLine") {
      const change = inner[0];
      return {
        kind: "insertionMultiLine",
        lineNumber: change.originalRange.startLineNumber,
        column: change.originalRange.startColumn,
        text: newText.getValueOfRange(change.modifiedRange)
      };
    }
    const replacements = inner.map((m) => new SingleTextEdit(m.originalRange, newText.getValueOfRange(m.modifiedRange)));
    if (replacements.length === 0) {
      return void 0;
    }
    if (view === "wordReplacements") {
      let grownEdits = growEditsToEntireWord(replacements, inlineEdit.originalText);
      if (grownEdits.some((e) => e.range.isEmpty())) {
        grownEdits = growEditsUntilWhitespace(replacements, inlineEdit.originalText);
      }
      return {
        kind: "wordReplacements",
        replacements: grownEdits
      };
    }
    if (view === "lineReplacement") {
      return {
        kind: "lineReplacement",
        originalRange: inlineEdit.originalLineRange,
        modifiedRange: inlineEdit.modifiedLineRange,
        modifiedLines: inlineEdit.modifiedLineRange.mapToLineArray((line) => newText.getLineAt(line)),
        replacements: inner.map((m) => ({ originalRange: m.originalRange, modifiedRange: m.modifiedRange }))
      };
    }
    return void 0;
  }
  _viewHasBeenShownLongerThan(durationMs) {
    const viewCreationTime = this._previousView?.timestamp;
    if (!viewCreationTime) {
      throw new BugIndicatingError("viewHasBeenShownLongThan called before a view has been shown");
    }
    const currentTime = Date.now();
    return currentTime - viewCreationTime >= durationMs;
  }
};
InlineEditsView = __decorateClass([
  __decorateParam(5, IInstantiationService)
], InlineEditsView);
function isSingleLineInsertionAfterPosition(diff, position) {
  if (!position) {
    return false;
  }
  const pos = position;
  return diff.every((m) => m.innerChanges.every((r) => isStableWordInsertion(r)));
  function isStableWordInsertion(r) {
    if (!r.originalRange.isEmpty()) {
      return false;
    }
    const isInsertionWithinLine = r.modifiedRange.startLineNumber === r.modifiedRange.endLineNumber;
    if (!isInsertionWithinLine) {
      return false;
    }
    const insertPosition = r.originalRange.getStartPosition();
    if (pos.isBeforeOrEqual(insertPosition)) {
      return true;
    }
    if (insertPosition.lineNumber < pos.lineNumber) {
      return true;
    }
    return false;
  }
}
function isSingleMultiLineInsertion(diff) {
  const inner = diff.flatMap((d) => d.innerChanges ?? []);
  if (inner.length !== 1) {
    return false;
  }
  const change = inner[0];
  if (!change.originalRange.isEmpty()) {
    return false;
  }
  if (change.modifiedRange.startLineNumber === change.modifiedRange.endLineNumber) {
    return false;
  }
  return true;
}
function growEditsToEntireWord(replacements, originalText) {
  return _growEdits(replacements, originalText, (char) => /^[a-zA-Z]$/.test(char));
}
function growEditsUntilWhitespace(replacements, originalText) {
  return _growEdits(replacements, originalText, (char) => !/^\s$/.test(char));
}
function _growEdits(replacements, originalText, fn) {
  const result = [];
  replacements.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
  for (const edit of replacements) {
    let startIndex = edit.range.startColumn - 1;
    let endIndex = edit.range.endColumn - 2;
    let prefix = "";
    let suffix = "";
    const startLineContent = originalText.getLineAt(edit.range.startLineNumber);
    const endLineContent = originalText.getLineAt(edit.range.endLineNumber);
    if (isIncluded(startLineContent[startIndex])) {
      while (isIncluded(startLineContent[startIndex - 1])) {
        prefix = startLineContent[startIndex - 1] + prefix;
        startIndex--;
      }
    }
    if (isIncluded(endLineContent[endIndex]) || endIndex < startIndex) {
      while (isIncluded(endLineContent[endIndex + 1])) {
        suffix += endLineContent[endIndex + 1];
        endIndex++;
      }
    }
    let newEdit = new SingleTextEdit(new Range(edit.range.startLineNumber, startIndex + 1, edit.range.endLineNumber, endIndex + 2), prefix + edit.text + suffix);
    if (result.length > 0 && Range.areIntersectingOrTouching(result[result.length - 1].range, newEdit.range)) {
      newEdit = SingleTextEdit.joinEdits([result.pop(), newEdit], originalText);
    }
    result.push(newEdit);
  }
  function isIncluded(c) {
    if (c === void 0) {
      return false;
    }
    return fn(c);
  }
  return result;
}
export {
  InlineEditsView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZXF1YWxzSWZEZWZpbmVkLCBpdGVtRXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXF1YWxzLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgZGVyaXZlZE9wdHMsIGRlcml2ZWRXaXRoU3RvcmUsIElPYnNlcnZhYmxlLCBJUmVhZGVyLCBJU2V0dGFibGVPYnNlcnZhYmxlLCBtYXBPYnNlcnZhYmxlQXJyYXlDYWNoZWQsIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlQ29kZUVkaXRvciwgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IEFic3RyYWN0VGV4dCwgU2luZ2xlVGV4dEVkaXQsIFN0cmluZ1RleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vY29yZS90ZXh0RWRpdC5qcyc7XG5pbXBvcnQgeyBUZXh0TGVuZ3RoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvdGV4dExlbmd0aC5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcsIGxpbmVSYW5nZU1hcHBpbmdGcm9tUmFuZ2VNYXBwaW5ncywgUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSW5saW5lRWRpdHNHdXR0ZXJJbmRpY2F0b3IgfSBmcm9tICcuL2NvbXBvbmVudHMvZ3V0dGVySW5kaWNhdG9yVmlldy5qcyc7XG5pbXBvcnQgeyBJbmxpbmVFZGl0V2l0aENoYW5nZXMgfSBmcm9tICcuL2lubGluZUVkaXRXaXRoQ2hhbmdlcy5qcyc7XG5pbXBvcnQgeyBHaG9zdFRleHRJbmRpY2F0b3IsIElubGluZUVkaXRIb3N0LCBJbmxpbmVFZGl0TW9kZWwgfSBmcm9tICcuL2lubGluZUVkaXRzTW9kZWwuanMnO1xuaW1wb3J0IHsgSUlubGluZUVkaXRNb2RlbCwgSW5saW5lRWRpdFRhYkFjdGlvbiB9IGZyb20gJy4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IElubGluZUVkaXRzQ29sbGFwc2VkVmlldyB9IGZyb20gJy4vaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c0NvbGxhcHNlZFZpZXcuanMnO1xuaW1wb3J0IHsgSW5saW5lRWRpdHNEZWxldGlvblZpZXcgfSBmcm9tICcuL2lubGluZUVkaXRzVmlld3MvaW5saW5lRWRpdHNEZWxldGlvblZpZXcuanMnO1xuaW1wb3J0IHsgSW5saW5lRWRpdHNJbnNlcnRpb25WaWV3IH0gZnJvbSAnLi9pbmxpbmVFZGl0c1ZpZXdzL2lubGluZUVkaXRzSW5zZXJ0aW9uVmlldy5qcyc7XG5pbXBvcnQgeyBJbmxpbmVFZGl0c0xpbmVSZXBsYWNlbWVudFZpZXcgfSBmcm9tICcuL2lubGluZUVkaXRzVmlld3MvaW5saW5lRWRpdHNMaW5lUmVwbGFjZW1lbnRWaWV3LmpzJztcbmltcG9ydCB7IElubGluZUVkaXRzU2lkZUJ5U2lkZVZpZXcgfSBmcm9tICcuL2lubGluZUVkaXRzVmlld3MvaW5saW5lRWRpdHNTaWRlQnlTaWRlVmlldy5qcyc7XG5pbXBvcnQgeyBJbmxpbmVFZGl0c1dvcmRSZXBsYWNlbWVudFZpZXcgfSBmcm9tICcuL2lubGluZUVkaXRzVmlld3MvaW5saW5lRWRpdHNXb3JkUmVwbGFjZW1lbnRWaWV3LmpzJztcbmltcG9ydCB7IElPcmlnaW5hbEVkaXRvcklubGluZURpZmZWaWV3U3RhdGUsIE9yaWdpbmFsRWRpdG9ySW5saW5lRGlmZlZpZXcgfSBmcm9tICcuL2lubGluZUVkaXRzVmlld3Mvb3JpZ2luYWxFZGl0b3JJbmxpbmVEaWZmVmlldy5qcyc7XG5pbXBvcnQgeyBhcHBseUVkaXRUb01vZGlmaWVkUmFuZ2VNYXBwaW5ncywgY3JlYXRlUmVpbmRlbnRFZGl0IH0gZnJvbSAnLi91dGlscy91dGlscy5qcyc7XG5pbXBvcnQgJy4vdmlldy5jc3MnO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lRWRpdHNWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvck9iczogT2JzZXJ2YWJsZUNvZGVFZGl0b3IgPSBvYnNlcnZhYmxlQ29kZUVkaXRvcih0aGlzLl9lZGl0b3IpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3VzZUNvZGVTaGlmdGluZztcblx0cHJpdmF0ZSByZWFkb25seSBfcmVuZGVyU2lkZUJ5U2lkZTtcblx0cHJpdmF0ZSByZWFkb25seSBfdXNlTXVsdGlMaW5lR2hvc3RUZXh0O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3RhYkFjdGlvbiA9IGRlcml2ZWQ8SW5saW5lRWRpdFRhYkFjdGlvbj4ocmVhZGVyID0+IHRoaXMuX21vZGVsLnJlYWQocmVhZGVyKT8udGFiQWN0aW9uLnJlYWQocmVhZGVyKSA/PyBJbmxpbmVFZGl0VGFiQWN0aW9uLkluYWN0aXZlKTtcblxuXHRwcml2YXRlIF9wcmV2aW91c1ZpZXc6IHtcblx0XHRpZDogc3RyaW5nO1xuXHRcdHZpZXc6IFJldHVyblR5cGU8dHlwZW9mIElubGluZUVkaXRzVmlldy5wcm90b3R5cGUuZGV0ZXJtaW5lVmlldz47XG5cdFx0ZWRpdG9yV2lkdGg6IG51bWJlcjtcblx0XHR0aW1lc3RhbXA6IG51bWJlcjtcblx0fSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hvc3Q6IElPYnNlcnZhYmxlPElubGluZUVkaXRIb3N0IHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSU9ic2VydmFibGU8SW5saW5lRWRpdE1vZGVsIHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9naG9zdFRleHRJbmRpY2F0b3I6IElPYnNlcnZhYmxlPEdob3N0VGV4dEluZGljYXRvciB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZm9jdXNJc0luTWVudTogSVNldHRhYmxlT2JzZXJ2YWJsZTxib29sZWFuPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl91c2VDb2RlU2hpZnRpbmcgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0KS5tYXAocyA9PiBzLmVkaXRzLmFsbG93Q29kZVNoaWZ0aW5nKTtcblx0XHR0aGlzLl9yZW5kZXJTaWRlQnlTaWRlID0gdGhpcy5fZWRpdG9yT2JzLmdldE9wdGlvbihFZGl0b3JPcHRpb24uaW5saW5lU3VnZ2VzdCkubWFwKHMgPT4gcy5lZGl0cy5yZW5kZXJTaWRlQnlTaWRlKTtcblx0XHR0aGlzLl91c2VNdWx0aUxpbmVHaG9zdFRleHQgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0KS5tYXAocyA9PiBzLmVkaXRzLnVzZU11bHRpTGluZUdob3N0VGV4dCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghbW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzdG9yZS5hZGQoXG5cdFx0XHRcdEV2ZW50LmFueShcblx0XHRcdFx0XHR0aGlzLl9zaWRlQnlTaWRlLm9uRGlkQ2xpY2ssXG5cdFx0XHRcdFx0dGhpcy5fZGVsZXRpb24ub25EaWRDbGljayxcblx0XHRcdFx0XHR0aGlzLl9saW5lUmVwbGFjZW1lbnRWaWV3Lm9uRGlkQ2xpY2ssXG5cdFx0XHRcdFx0dGhpcy5faW5zZXJ0aW9uLm9uRGlkQ2xpY2ssXG5cdFx0XHRcdFx0Li4udGhpcy5fd29yZFJlcGxhY2VtZW50Vmlld3MucmVhZChyZWFkZXIpLm1hcCh3ID0+IHcub25EaWRDbGljayksXG5cdFx0XHRcdFx0dGhpcy5faW5saW5lRGlmZlZpZXcub25EaWRDbGljayxcblx0XHRcdFx0KShlID0+IHtcblx0XHRcdFx0XHRpZiAodGhpcy5fdmlld0hhc0JlZW5TaG93bkxvbmdlclRoYW4oMzUwKSkge1xuXHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0bW9kZWwuYWNjZXB0KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9pbmRpY2F0b3IucmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UodGhpcy5fc3RvcmUpO1xuXHRcdHRoaXMuX3dvcmRSZXBsYWNlbWVudFZpZXdzLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRcdHRoaXMuX2luZGljYXRvckN5Y2xpY0RlcGVuZGVuY3lDaXJjdWl0QnJlYWtlci5zZXQodHJ1ZSwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLl9jb25zdHJ1Y3RvckRvbmUuc2V0KHRydWUsIHVuZGVmaW5lZCk7IC8vIFRPRE86IHJlbW92ZSBhbmQgdXNlIGNvcnJlY3QgaW5pdGlhbGl6YXRpb24gb3JkZXJcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnN0cnVjdG9yRG9uZSA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBmYWxzZSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdWlTdGF0ZSA9IGRlcml2ZWQ8e1xuXHRcdHN0YXRlOiBSZXR1cm5UeXBlPHR5cGVvZiBJbmxpbmVFZGl0c1ZpZXcucHJvdG90eXBlLmRldGVybWluZVJlbmRlclN0YXRlPjtcblx0XHRkaWZmOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXTtcblx0XHRlZGl0OiBJbmxpbmVFZGl0V2l0aENoYW5nZXM7XG5cdFx0bmV3VGV4dDogc3RyaW5nO1xuXHRcdG5ld1RleHRMaW5lQ291bnQ6IG51bWJlcjtcblx0XHRvcmlnaW5hbERpc3BsYXlSYW5nZTogTGluZVJhbmdlO1xuXHR9IHwgdW5kZWZpbmVkPih0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdGlmICghbW9kZWwgfHwgIXRoaXMuX2NvbnN0cnVjdG9yRG9uZS5yZWFkKHJlYWRlcikpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0bW9kZWwuaGFuZGxlSW5saW5lRWRpdFNob3duKCk7XG5cblx0XHRjb25zdCBpbmxpbmVFZGl0ID0gbW9kZWwuaW5saW5lRWRpdDtcblx0XHRsZXQgbWFwcGluZ3MgPSBSYW5nZU1hcHBpbmcuZnJvbUVkaXQoaW5saW5lRWRpdC5lZGl0KTtcblx0XHRsZXQgbmV3VGV4dCA9IGlubGluZUVkaXQuZWRpdC5hcHBseShpbmxpbmVFZGl0Lm9yaWdpbmFsVGV4dCk7XG5cdFx0bGV0IGRpZmYgPSBsaW5lUmFuZ2VNYXBwaW5nRnJvbVJhbmdlTWFwcGluZ3MobWFwcGluZ3MsIGlubGluZUVkaXQub3JpZ2luYWxUZXh0LCBuZXcgU3RyaW5nVGV4dChuZXdUZXh0KSk7XG5cblx0XHRjb25zdCBvcmlnaW5hbERpc3BsYXlSYW5nZSA9IGlubGluZUVkaXQub3JpZ2luYWxUZXh0LmxpbmVSYW5nZS5pbnRlcnNlY3QoXG5cdFx0XHRpbmxpbmVFZGl0Lm9yaWdpbmFsTGluZVJhbmdlLmpvaW4oXG5cdFx0XHRcdExpbmVSYW5nZS5vZkxlbmd0aChpbmxpbmVFZGl0Lm9yaWdpbmFsTGluZVJhbmdlLnN0YXJ0TGluZU51bWJlciwgaW5saW5lRWRpdC5saW5lRWRpdC5uZXdMaW5lcy5sZW5ndGgpXG5cdFx0XHQpXG5cdFx0KSE7XG5cblx0XHRsZXQgc3RhdGUgPSB0aGlzLmRldGVybWluZVJlbmRlclN0YXRlKG1vZGVsLCByZWFkZXIsIGRpZmYsIG5ldyBTdHJpbmdUZXh0KG5ld1RleHQpLCBvcmlnaW5hbERpc3BsYXlSYW5nZSk7XG5cdFx0aWYgKCFzdGF0ZSkge1xuXHRcdFx0bW9kZWwuYWJvcnQoYHVuYWJsZSB0byBkZXRlcm1pbmUgdmlldzogdHJpZWQgdG8gcmVuZGVyICR7dGhpcy5fcHJldmlvdXNWaWV3Py52aWV3fWApO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoc3RhdGUua2luZCA9PT0gJ3NpZGVCeVNpZGUnKSB7XG5cdFx0XHRjb25zdCBpbmRlbnRhdGlvbkFkanVzdG1lbnRFZGl0ID0gY3JlYXRlUmVpbmRlbnRFZGl0KG5ld1RleHQsIGlubGluZUVkaXQubW9kaWZpZWRMaW5lUmFuZ2UpO1xuXHRcdFx0bmV3VGV4dCA9IGluZGVudGF0aW9uQWRqdXN0bWVudEVkaXQuYXBwbHlUb1N0cmluZyhuZXdUZXh0KTtcblxuXHRcdFx0bWFwcGluZ3MgPSBhcHBseUVkaXRUb01vZGlmaWVkUmFuZ2VNYXBwaW5ncyhtYXBwaW5ncywgaW5kZW50YXRpb25BZGp1c3RtZW50RWRpdCk7XG5cdFx0XHRkaWZmID0gbGluZVJhbmdlTWFwcGluZ0Zyb21SYW5nZU1hcHBpbmdzKG1hcHBpbmdzLCBpbmxpbmVFZGl0Lm9yaWdpbmFsVGV4dCwgbmV3IFN0cmluZ1RleHQobmV3VGV4dCkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3ByZXZpZXdUZXh0TW9kZWwuc2V0TGFuZ3VhZ2UodGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhLmdldExhbmd1YWdlSWQoKSk7XG5cblx0XHRjb25zdCBwcmV2aW91c05ld1RleHQgPSB0aGlzLl9wcmV2aWV3VGV4dE1vZGVsLmdldFZhbHVlKCk7XG5cdFx0aWYgKHByZXZpb3VzTmV3VGV4dCAhPT0gbmV3VGV4dCkge1xuXHRcdFx0Ly8gT25seSB1cGRhdGUgdGhlIG1vZGVsIGlmIHRoZSB0ZXh0IGhhcyBjaGFuZ2VkIHRvIGF2b2lkIGZsaWNrZXJpbmdcblx0XHRcdHRoaXMuX3ByZXZpZXdUZXh0TW9kZWwuc2V0VmFsdWUobmV3VGV4dCk7XG5cdFx0fVxuXG5cdFx0aWYgKG1vZGVsLnNob3dDb2xsYXBzZWQucmVhZChyZWFkZXIpICYmICF0aGlzLl9pbmRpY2F0b3IucmVhZChyZWFkZXIpPy5pc0hvdmVyVmlzaWJsZS5yZWFkKHJlYWRlcikpIHtcblx0XHRcdHN0YXRlID0geyBraW5kOiAnY29sbGFwc2VkJyB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzdGF0ZSxcblx0XHRcdGRpZmYsXG5cdFx0XHRlZGl0OiBpbmxpbmVFZGl0LFxuXHRcdFx0bmV3VGV4dCxcblx0XHRcdG5ld1RleHRMaW5lQ291bnQ6IGlubGluZUVkaXQubW9kaWZpZWRMaW5lUmFuZ2UubGVuZ3RoLFxuXHRcdFx0b3JpZ2luYWxEaXNwbGF5UmFuZ2U6IG9yaWdpbmFsRGlzcGxheVJhbmdlLFxuXHRcdH07XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3ByZXZpZXdUZXh0TW9kZWwgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRUZXh0TW9kZWwsXG5cdFx0JycsXG5cdFx0dGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhLmdldExhbmd1YWdlSWQoKSxcblx0XHR7IC4uLlRleHRNb2RlbC5ERUZBVUxUX0NSRUFUSU9OX09QVElPTlMsIGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uT3B0aW9uczogeyBlbmFibGVkOiB0cnVlLCBpbmRlcGVuZGVudENvbG9yUG9vbFBlckJyYWNrZXRUeXBlOiBmYWxzZSB9IH0sXG5cdFx0bnVsbFxuXHQpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbmRpY2F0b3JDeWNsaWNEZXBlbmRlbmN5Q2lyY3VpdEJyZWFrZXIgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfaW5kaWNhdG9yID0gZGVyaXZlZFdpdGhTdG9yZTxJbmxpbmVFZGl0c0d1dHRlckluZGljYXRvciB8IHVuZGVmaW5lZD4odGhpcywgKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRpZiAoIXRoaXMuX2luZGljYXRvckN5Y2xpY0RlcGVuZGVuY3lDaXJjdWl0QnJlYWtlci5yZWFkKHJlYWRlcikpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kaWNhdG9yRGlzcGxheVJhbmdlID0gZGVyaXZlZE9wdHMoeyBvd25lcjogdGhpcywgZXF1YWxzRm46IGVxdWFsc0lmRGVmaW5lZChpdGVtRXF1YWxzKCkpIH0sIHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBnaG9zdFRleHRJbmRpY2F0b3IgPSB0aGlzLl9naG9zdFRleHRJbmRpY2F0b3IucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGdob3N0VGV4dEluZGljYXRvcikge1xuXHRcdFx0XHRyZXR1cm4gZ2hvc3RUZXh0SW5kaWNhdG9yLmxpbmVSYW5nZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLl91aVN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChzdGF0ZT8uc3RhdGU/LmtpbmQgPT09ICdpbnNlcnRpb25NdWx0aUxpbmUnKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9pbnNlcnRpb24ub3JpZ2luYWxMaW5lcy5yZWFkKHJlYWRlcik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc3RhdGU/Lm9yaWdpbmFsRGlzcGxheVJhbmdlO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbW9kZWxXaXRoR2hvc3RUZXh0U3VwcG9ydCA9IGRlcml2ZWQ8SW5saW5lRWRpdE1vZGVsIHwgdW5kZWZpbmVkPih0aGlzLCByZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuIG1vZGVsO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBnaG9zdFRleHRJbmRpY2F0b3IgPSB0aGlzLl9naG9zdFRleHRJbmRpY2F0b3IucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGdob3N0VGV4dEluZGljYXRvcikge1xuXHRcdFx0XHRyZXR1cm4gZ2hvc3RUZXh0SW5kaWNhdG9yLm1vZGVsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbW9kZWw7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gc3RvcmUuYWRkKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0SW5saW5lRWRpdHNHdXR0ZXJJbmRpY2F0b3IsXG5cdFx0XHR0aGlzLl9lZGl0b3JPYnMsXG5cdFx0XHRpbmRpY2F0b3JEaXNwbGF5UmFuZ2UsXG5cdFx0XHR0aGlzLl9ndXR0ZXJJbmRpY2F0b3JPZmZzZXQsXG5cdFx0XHR0aGlzLl9ob3N0LFxuXHRcdFx0bW9kZWxXaXRoR2hvc3RUZXh0U3VwcG9ydCxcblx0XHRcdHRoaXMuX2lubGluZUVkaXRzSXNIb3ZlcmVkLFxuXHRcdFx0dGhpcy5fZm9jdXNJc0luTWVudSxcblx0XHQpKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lRWRpdHNJc0hvdmVyZWQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3NpZGVCeVNpZGUuaXNIb3ZlcmVkLnJlYWQocmVhZGVyKVxuXHRcdFx0fHwgdGhpcy5fd29yZFJlcGxhY2VtZW50Vmlld3MucmVhZChyZWFkZXIpLnNvbWUodiA9PiB2LmlzSG92ZXJlZC5yZWFkKHJlYWRlcikpXG5cdFx0XHR8fCB0aGlzLl9kZWxldGlvbi5pc0hvdmVyZWQucmVhZChyZWFkZXIpXG5cdFx0XHR8fCB0aGlzLl9pbmxpbmVEaWZmVmlldy5pc0hvdmVyZWQucmVhZChyZWFkZXIpXG5cdFx0XHR8fCB0aGlzLl9saW5lUmVwbGFjZW1lbnRWaWV3LmlzSG92ZXJlZC5yZWFkKHJlYWRlcilcblx0XHRcdHx8IHRoaXMuX2luc2VydGlvbi5pc0hvdmVyZWQucmVhZChyZWFkZXIpO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ndXR0ZXJJbmRpY2F0b3JPZmZzZXQgPSBkZXJpdmVkPG51bWJlcj4odGhpcywgcmVhZGVyID0+IHtcblx0XHQvLyBUT0RPOiBoYXZlIGEgYmV0dGVyIHdheSB0byB0ZWxsIHRoZSBndXR0ZXIgaW5kaWNhdG9yIHZpZXcgd2hlcmUgdGhlIGVkaXQgaXMgaW5zaWRlIGEgdmlld3pvbmVcblx0XHRpZiAodGhpcy5fdWlTdGF0ZS5yZWFkKHJlYWRlcik/LnN0YXRlPy5raW5kID09PSAnaW5zZXJ0aW9uTXVsdGlMaW5lJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2luc2VydGlvbi5zdGFydExpbmVPZmZzZXQucmVhZChyZWFkZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4gMDtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2lkZUJ5U2lkZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKElubGluZUVkaXRzU2lkZUJ5U2lkZVZpZXcsXG5cdFx0dGhpcy5fZWRpdG9yLFxuXHRcdHRoaXMuX21vZGVsLm1hcChtID0+IG0/LmlubGluZUVkaXQpLFxuXHRcdHRoaXMuX3ByZXZpZXdUZXh0TW9kZWwsXG5cdFx0dGhpcy5fdWlTdGF0ZS5tYXAocyA9PiBzICYmIHMuc3RhdGU/LmtpbmQgPT09ICdzaWRlQnlTaWRlJyA/ICh7XG5cdFx0XHRuZXdUZXh0TGluZUNvdW50OiBzLm5ld1RleHRMaW5lQ291bnQsXG5cdFx0XHRvcmlnaW5hbERpc3BsYXlSYW5nZTogcy5vcmlnaW5hbERpc3BsYXlSYW5nZSxcblx0XHR9KSA6IHVuZGVmaW5lZCksXG5cdFx0dGhpcy5fdGFiQWN0aW9uLFxuXHQpKTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2RlbGV0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5saW5lRWRpdHNEZWxldGlvblZpZXcsXG5cdFx0dGhpcy5fZWRpdG9yLFxuXHRcdHRoaXMuX21vZGVsLm1hcChtID0+IG0/LmlubGluZUVkaXQpLFxuXHRcdHRoaXMuX3VpU3RhdGUubWFwKHMgPT4gcyAmJiBzLnN0YXRlPy5raW5kID09PSAnZGVsZXRpb24nID8gKHtcblx0XHRcdG9yaWdpbmFsUmFuZ2U6IHMuc3RhdGUub3JpZ2luYWxSYW5nZSxcblx0XHRcdGRlbGV0aW9uczogcy5zdGF0ZS5kZWxldGlvbnMsXG5cdFx0fSkgOiB1bmRlZmluZWQpLFxuXHRcdHRoaXMuX3RhYkFjdGlvbixcblx0KSk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9pbnNlcnRpb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVFZGl0c0luc2VydGlvblZpZXcsXG5cdFx0dGhpcy5fZWRpdG9yLFxuXHRcdHRoaXMuX3VpU3RhdGUubWFwKHMgPT4gcyAmJiBzLnN0YXRlPy5raW5kID09PSAnaW5zZXJ0aW9uTXVsdGlMaW5lJyA/ICh7XG5cdFx0XHRsaW5lTnVtYmVyOiBzLnN0YXRlLmxpbmVOdW1iZXIsXG5cdFx0XHRzdGFydENvbHVtbjogcy5zdGF0ZS5jb2x1bW4sXG5cdFx0XHR0ZXh0OiBzLnN0YXRlLnRleHQsXG5cdFx0fSkgOiB1bmRlZmluZWQpLFxuXHRcdHRoaXMuX3RhYkFjdGlvbixcblx0KSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lRGlmZlZpZXdTdGF0ZSA9IGRlcml2ZWQ8SU9yaWdpbmFsRWRpdG9ySW5saW5lRGlmZlZpZXdTdGF0ZSB8IHVuZGVmaW5lZD4odGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBlID0gdGhpcy5fdWlTdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFlIHx8ICFlLnN0YXRlKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRpZiAoZS5zdGF0ZS5raW5kID09PSAnd29yZFJlcGxhY2VtZW50cycgfHwgZS5zdGF0ZS5raW5kID09PSAnbGluZVJlcGxhY2VtZW50JyB8fCBlLnN0YXRlLmtpbmQgPT09ICdpbnNlcnRpb25NdWx0aUxpbmUnIHx8IGUuc3RhdGUua2luZCA9PT0gJ2NvbGxhcHNlZCcpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRtb2RpZmllZFRleHQ6IG5ldyBTdHJpbmdUZXh0KGUubmV3VGV4dCksXG5cdFx0XHRkaWZmOiBlLmRpZmYsXG5cdFx0XHRtb2RlOiBlLnN0YXRlLmtpbmQsXG5cdFx0XHRtb2RpZmllZENvZGVFZGl0b3I6IHRoaXMuX3NpZGVCeVNpZGUucHJldmlld0VkaXRvcixcblx0XHR9O1xuXHR9KTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2lubGluZUNvbGxhcHNlZFZpZXcgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVFZGl0c0NvbGxhcHNlZFZpZXcsXG5cdFx0dGhpcy5fZWRpdG9yLFxuXHRcdHRoaXMuX21vZGVsLm1hcCgobSwgcmVhZGVyKSA9PiB0aGlzLl91aVN0YXRlLnJlYWQocmVhZGVyKT8uc3RhdGU/LmtpbmQgPT09ICdjb2xsYXBzZWQnID8gbT8uaW5saW5lRWRpdCA6IHVuZGVmaW5lZClcblx0KSk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9pbmxpbmVEaWZmVmlldyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBPcmlnaW5hbEVkaXRvcklubGluZURpZmZWaWV3KHRoaXMuX2VkaXRvciwgdGhpcy5faW5saW5lRGlmZlZpZXdTdGF0ZSwgdGhpcy5fcHJldmlld1RleHRNb2RlbCkpO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfd29yZFJlcGxhY2VtZW50Vmlld3MgPSBtYXBPYnNlcnZhYmxlQXJyYXlDYWNoZWQodGhpcywgdGhpcy5fdWlTdGF0ZS5tYXAocyA9PiBzPy5zdGF0ZT8ua2luZCA9PT0gJ3dvcmRSZXBsYWNlbWVudHMnID8gcy5zdGF0ZS5yZXBsYWNlbWVudHMgOiBbXSksIChlLCBzdG9yZSkgPT4ge1xuXHRcdHJldHVybiBzdG9yZS5hZGQodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5saW5lRWRpdHNXb3JkUmVwbGFjZW1lbnRWaWV3LCB0aGlzLl9lZGl0b3JPYnMsIGUsIHRoaXMuX3RhYkFjdGlvbikpO1xuXHR9KTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2xpbmVSZXBsYWNlbWVudFZpZXcgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVFZGl0c0xpbmVSZXBsYWNlbWVudFZpZXcsXG5cdFx0dGhpcy5fZWRpdG9yT2JzLFxuXHRcdHRoaXMuX3VpU3RhdGUubWFwKHMgPT4gcz8uc3RhdGU/LmtpbmQgPT09ICdsaW5lUmVwbGFjZW1lbnQnID8gKHtcblx0XHRcdG9yaWdpbmFsUmFuZ2U6IHMuc3RhdGUub3JpZ2luYWxSYW5nZSxcblx0XHRcdG1vZGlmaWVkUmFuZ2U6IHMuc3RhdGUubW9kaWZpZWRSYW5nZSxcblx0XHRcdG1vZGlmaWVkTGluZXM6IHMuc3RhdGUubW9kaWZpZWRMaW5lcyxcblx0XHRcdHJlcGxhY2VtZW50czogcy5zdGF0ZS5yZXBsYWNlbWVudHMsXG5cdFx0fSkgOiB1bmRlZmluZWQpLFxuXHRcdHRoaXMuX3RhYkFjdGlvbixcblx0KSk7XG5cblx0cHJpdmF0ZSBnZXRDYWNoZUlkKG1vZGVsOiBJSW5saW5lRWRpdE1vZGVsKSB7XG5cdFx0Y29uc3QgaW5saW5lRWRpdCA9IG1vZGVsLmlubGluZUVkaXQ7XG5cdFx0aWYgKHRoaXMuX2hvc3QuZ2V0KCk/LmluUGFydGlhbEFjY2VwdEZsb3cuZ2V0KCkpIHtcblx0XHRcdHJldHVybiBgJHtpbmxpbmVFZGl0LmlubGluZUNvbXBsZXRpb24uaWR9XyR7aW5saW5lRWRpdC5lZGl0LmVkaXRzLm1hcChpbm5lckVkaXQgPT4gaW5uZXJFZGl0LnJhbmdlLnRvU3RyaW5nKCkgKyBpbm5lckVkaXQudGV4dCkuam9pbignLCcpfWA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGlubGluZUVkaXQuaW5saW5lQ29tcGxldGlvbi5pZDtcblx0fVxuXG5cdHByaXZhdGUgZGV0ZXJtaW5lVmlldyhtb2RlbDogSUlubGluZUVkaXRNb2RlbCwgcmVhZGVyOiBJUmVhZGVyLCBkaWZmOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSwgbmV3VGV4dDogU3RyaW5nVGV4dCwgb3JpZ2luYWxEaXNwbGF5UmFuZ2U6IExpbmVSYW5nZSk6IHN0cmluZyB7XG5cdFx0Ly8gQ2hlY2sgaWYgd2UgY2FuIHVzZSB0aGUgcHJldmlvdXMgdmlldyBpZiBpdCBpcyB0aGUgc2FtZSBJbmxpbmVDb21wbGV0aW9uIGFzIHByZXZpb3VzbHkgc2hvd25cblx0XHRjb25zdCBpbmxpbmVFZGl0ID0gbW9kZWwuaW5saW5lRWRpdDtcblx0XHRjb25zdCBjYW5Vc2VDYWNoZSA9IHRoaXMuX3ByZXZpb3VzVmlldz8uaWQgPT09IHRoaXMuZ2V0Q2FjaGVJZChtb2RlbCk7XG5cdFx0Y29uc3QgcmVjb25zaWRlclZpZXdFZGl0b3JXaWR0aENoYW5nZSA9IHRoaXMuX3ByZXZpb3VzVmlldz8uZWRpdG9yV2lkdGggIT09IHRoaXMuX2VkaXRvck9icy5sYXlvdXRJbmZvV2lkdGgucmVhZChyZWFkZXIpICYmXG5cdFx0XHQoXG5cdFx0XHRcdHRoaXMuX3ByZXZpb3VzVmlldz8udmlldyA9PT0gJ3NpZGVCeVNpZGUnIHx8XG5cdFx0XHRcdHRoaXMuX3ByZXZpb3VzVmlldz8udmlldyA9PT0gJ2xpbmVSZXBsYWNlbWVudCdcblx0XHRcdCk7XG5cblx0XHRpZiAoY2FuVXNlQ2FjaGUgJiYgIXJlY29uc2lkZXJWaWV3RWRpdG9yV2lkdGhDaGFuZ2UpIHtcblx0XHRcdHJldHVybiB0aGlzLl9wcmV2aW91c1ZpZXchLnZpZXc7XG5cdFx0fVxuXG5cdFx0Ly8gRGV0ZXJtaW5lIHRoZSB2aWV3IGJhc2VkIG9uIHRoZSBlZGl0IC8gZGlmZlxuXG5cdFx0Y29uc3QgaW5uZXIgPSBkaWZmLmZsYXRNYXAoZCA9PiBkLmlubmVyQ2hhbmdlcyA/PyBbXSk7XG5cdFx0Y29uc3QgaXNTaW5nbGVJbm5lckVkaXQgPSBpbm5lci5sZW5ndGggPT09IDE7XG5cdFx0aWYgKFxuXHRcdFx0aXNTaW5nbGVJbm5lckVkaXRcblx0XHRcdCYmIHRoaXMuX3VzZUNvZGVTaGlmdGluZy5yZWFkKHJlYWRlcikgIT09ICduZXZlcidcblx0XHRcdCYmIGlzU2luZ2xlTGluZUluc2VydGlvbkFmdGVyUG9zaXRpb24oZGlmZiwgaW5saW5lRWRpdC5jdXJzb3JQb3NpdGlvbilcblx0XHQpIHtcblx0XHRcdHJldHVybiAnaW5zZXJ0aW9uSW5saW5lJztcblx0XHR9XG5cblx0XHRjb25zdCBpbm5lclZhbHVlcyA9IGlubmVyLm1hcChtID0+ICh7IG9yaWdpbmFsOiBpbmxpbmVFZGl0Lm9yaWdpbmFsVGV4dC5nZXRWYWx1ZU9mUmFuZ2UobS5vcmlnaW5hbFJhbmdlKSwgbW9kaWZpZWQ6IG5ld1RleHQuZ2V0VmFsdWVPZlJhbmdlKG0ubW9kaWZpZWRSYW5nZSkgfSkpO1xuXHRcdGlmIChpbm5lclZhbHVlcy5ldmVyeSgoeyBvcmlnaW5hbCwgbW9kaWZpZWQgfSkgPT4gbW9kaWZpZWQudHJpbSgpID09PSAnJyAmJiBvcmlnaW5hbC5sZW5ndGggPiAwICYmIChvcmlnaW5hbC5sZW5ndGggPiBtb2RpZmllZC5sZW5ndGggfHwgb3JpZ2luYWwudHJpbSgpICE9PSAnJykpKSB7XG5cdFx0XHRyZXR1cm4gJ2RlbGV0aW9uJztcblx0XHR9XG5cblx0XHRpZiAoaXNTaW5nbGVNdWx0aUxpbmVJbnNlcnRpb24oZGlmZikgJiYgdGhpcy5fdXNlTXVsdGlMaW5lR2hvc3RUZXh0LnJlYWQocmVhZGVyKSAmJiB0aGlzLl91c2VDb2RlU2hpZnRpbmcucmVhZChyZWFkZXIpID09PSAnYWx3YXlzJykge1xuXHRcdFx0cmV0dXJuICdpbnNlcnRpb25NdWx0aUxpbmUnO1xuXHRcdH1cblxuXHRcdGNvbnN0IG51bU9yaWdpbmFsTGluZXMgPSBpbmxpbmVFZGl0Lm9yaWdpbmFsTGluZVJhbmdlLmxlbmd0aDtcblx0XHRjb25zdCBudW1Nb2RpZmllZExpbmVzID0gaW5saW5lRWRpdC5tb2RpZmllZExpbmVSYW5nZS5sZW5ndGg7XG5cdFx0Y29uc3QgYWxsSW5uZXJDaGFuZ2VzTm90VG9vTG9uZyA9IGlubmVyLmV2ZXJ5KG0gPT4gVGV4dExlbmd0aC5vZlJhbmdlKG0ub3JpZ2luYWxSYW5nZSkuY29sdW1uQ291bnQgPCBJbmxpbmVFZGl0c1dvcmRSZXBsYWNlbWVudFZpZXcuTUFYX0xFTkdUSCAmJiBUZXh0TGVuZ3RoLm9mUmFuZ2UobS5tb2RpZmllZFJhbmdlKS5jb2x1bW5Db3VudCA8IElubGluZUVkaXRzV29yZFJlcGxhY2VtZW50Vmlldy5NQVhfTEVOR1RIKTtcblx0XHRpZiAoYWxsSW5uZXJDaGFuZ2VzTm90VG9vTG9uZyAmJiBpc1NpbmdsZUlubmVyRWRpdCAmJiBudW1PcmlnaW5hbExpbmVzID09PSAxICYmIG51bU1vZGlmaWVkTGluZXMgPT09IDEpIHtcblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGVyZSBpcyBubyBpbnNlcnRpb24sIGV2ZW4gaWYgd2UgZ3JvdyB0aGVtXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCFpbm5lci5zb21lKG0gPT4gbS5vcmlnaW5hbFJhbmdlLmlzRW1wdHkoKSkgfHxcblx0XHRcdFx0IWdyb3dFZGl0c1VudGlsV2hpdGVzcGFjZShpbm5lci5tYXAobSA9PiBuZXcgU2luZ2xlVGV4dEVkaXQobS5vcmlnaW5hbFJhbmdlLCAnJykpLCBpbmxpbmVFZGl0Lm9yaWdpbmFsVGV4dCkuc29tZShlID0+IGUucmFuZ2UuaXNFbXB0eSgpICYmIFRleHRMZW5ndGgub2ZSYW5nZShlLnJhbmdlKS5jb2x1bW5Db3VudCA8IElubGluZUVkaXRzV29yZFJlcGxhY2VtZW50Vmlldy5NQVhfTEVOR1RIKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiAnd29yZFJlcGxhY2VtZW50cyc7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChudW1PcmlnaW5hbExpbmVzID4gMCAmJiBudW1Nb2RpZmllZExpbmVzID4gMCkge1xuXHRcdFx0aWYgKHRoaXMuX3JlbmRlclNpZGVCeVNpZGUucmVhZChyZWFkZXIpICE9PSAnbmV2ZXInICYmIElubGluZUVkaXRzU2lkZUJ5U2lkZVZpZXcuZml0c0luc2lkZVZpZXdwb3J0KHRoaXMuX2VkaXRvciwgdGhpcy5fcHJldmlld1RleHRNb2RlbCwgaW5saW5lRWRpdCwgb3JpZ2luYWxEaXNwbGF5UmFuZ2UsIHJlYWRlcikpIHtcblx0XHRcdFx0cmV0dXJuICdzaWRlQnlTaWRlJztcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICdsaW5lUmVwbGFjZW1lbnQnO1xuXHRcdH1cblxuXHRcdHJldHVybiAnc2lkZUJ5U2lkZSc7XG5cdH1cblxuXHRwcml2YXRlIGRldGVybWluZVJlbmRlclN0YXRlKG1vZGVsOiBJSW5saW5lRWRpdE1vZGVsLCByZWFkZXI6IElSZWFkZXIsIGRpZmY6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdLCBuZXdUZXh0OiBTdHJpbmdUZXh0LCBvcmlnaW5hbERpc3BsYXlSYW5nZTogTGluZVJhbmdlKSB7XG5cdFx0Y29uc3QgaW5saW5lRWRpdCA9IG1vZGVsLmlubGluZUVkaXQ7XG5cblx0XHRjb25zdCB2aWV3ID0gdGhpcy5kZXRlcm1pbmVWaWV3KG1vZGVsLCByZWFkZXIsIGRpZmYsIG5ld1RleHQsIG9yaWdpbmFsRGlzcGxheVJhbmdlKTtcblxuXHRcdHRoaXMuX3ByZXZpb3VzVmlldyA9IHsgaWQ6IHRoaXMuZ2V0Q2FjaGVJZChtb2RlbCksIHZpZXcsIGVkaXRvcldpZHRoOiB0aGlzLl9lZGl0b3IuZ2V0TGF5b3V0SW5mbygpLndpZHRoLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfTtcblxuXHRcdHN3aXRjaCAodmlldykge1xuXHRcdFx0Y2FzZSAnaW5zZXJ0aW9uSW5saW5lJzogcmV0dXJuIHsga2luZDogJ2luc2VydGlvbklubGluZScgYXMgY29uc3QgfTtcblx0XHRcdGNhc2UgJ3NpZGVCeVNpZGUnOiByZXR1cm4geyBraW5kOiAnc2lkZUJ5U2lkZScgYXMgY29uc3QgfTtcblx0XHRcdGNhc2UgJ2NvbGxhcHNlZCc6IHJldHVybiB7IGtpbmQ6ICdjb2xsYXBzZWQnIGFzIGNvbnN0IH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5uZXIgPSBkaWZmLmZsYXRNYXAoZCA9PiBkLmlubmVyQ2hhbmdlcyA/PyBbXSk7XG5cblx0XHRpZiAodmlldyA9PT0gJ2RlbGV0aW9uJykge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2luZDogJ2RlbGV0aW9uJyBhcyBjb25zdCxcblx0XHRcdFx0b3JpZ2luYWxSYW5nZTogaW5saW5lRWRpdC5vcmlnaW5hbExpbmVSYW5nZSxcblx0XHRcdFx0ZGVsZXRpb25zOiBpbm5lci5tYXAobSA9PiBtLm9yaWdpbmFsUmFuZ2UpLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodmlldyA9PT0gJ2luc2VydGlvbk11bHRpTGluZScpIHtcblx0XHRcdGNvbnN0IGNoYW5nZSA9IGlubmVyWzBdO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2luZDogJ2luc2VydGlvbk11bHRpTGluZScgYXMgY29uc3QsXG5cdFx0XHRcdGxpbmVOdW1iZXI6IGNoYW5nZS5vcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0Y29sdW1uOiBjaGFuZ2Uub3JpZ2luYWxSYW5nZS5zdGFydENvbHVtbixcblx0XHRcdFx0dGV4dDogbmV3VGV4dC5nZXRWYWx1ZU9mUmFuZ2UoY2hhbmdlLm1vZGlmaWVkUmFuZ2UpLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCByZXBsYWNlbWVudHMgPSBpbm5lci5tYXAobSA9PiBuZXcgU2luZ2xlVGV4dEVkaXQobS5vcmlnaW5hbFJhbmdlLCBuZXdUZXh0LmdldFZhbHVlT2ZSYW5nZShtLm1vZGlmaWVkUmFuZ2UpKSk7XG5cdFx0aWYgKHJlcGxhY2VtZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHZpZXcgPT09ICd3b3JkUmVwbGFjZW1lbnRzJykge1xuXHRcdFx0bGV0IGdyb3duRWRpdHMgPSBncm93RWRpdHNUb0VudGlyZVdvcmQocmVwbGFjZW1lbnRzLCBpbmxpbmVFZGl0Lm9yaWdpbmFsVGV4dCk7XG5cblx0XHRcdGlmIChncm93bkVkaXRzLnNvbWUoZSA9PiBlLnJhbmdlLmlzRW1wdHkoKSkpIHtcblx0XHRcdFx0Z3Jvd25FZGl0cyA9IGdyb3dFZGl0c1VudGlsV2hpdGVzcGFjZShyZXBsYWNlbWVudHMsIGlubGluZUVkaXQub3JpZ2luYWxUZXh0KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2luZDogJ3dvcmRSZXBsYWNlbWVudHMnIGFzIGNvbnN0LFxuXHRcdFx0XHRyZXBsYWNlbWVudHM6IGdyb3duRWRpdHMsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh2aWV3ID09PSAnbGluZVJlcGxhY2VtZW50Jykge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2luZDogJ2xpbmVSZXBsYWNlbWVudCcgYXMgY29uc3QsXG5cdFx0XHRcdG9yaWdpbmFsUmFuZ2U6IGlubGluZUVkaXQub3JpZ2luYWxMaW5lUmFuZ2UsXG5cdFx0XHRcdG1vZGlmaWVkUmFuZ2U6IGlubGluZUVkaXQubW9kaWZpZWRMaW5lUmFuZ2UsXG5cdFx0XHRcdG1vZGlmaWVkTGluZXM6IGlubGluZUVkaXQubW9kaWZpZWRMaW5lUmFuZ2UubWFwVG9MaW5lQXJyYXkobGluZSA9PiBuZXdUZXh0LmdldExpbmVBdChsaW5lKSksXG5cdFx0XHRcdHJlcGxhY2VtZW50czogaW5uZXIubWFwKG0gPT4gKHsgb3JpZ2luYWxSYW5nZTogbS5vcmlnaW5hbFJhbmdlLCBtb2RpZmllZFJhbmdlOiBtLm1vZGlmaWVkUmFuZ2UgfSkpLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfdmlld0hhc0JlZW5TaG93bkxvbmdlclRoYW4oZHVyYXRpb25NczogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgdmlld0NyZWF0aW9uVGltZSA9IHRoaXMuX3ByZXZpb3VzVmlldz8udGltZXN0YW1wO1xuXHRcdGlmICghdmlld0NyZWF0aW9uVGltZSkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigndmlld0hhc0JlZW5TaG93bkxvbmdUaGFuIGNhbGxlZCBiZWZvcmUgYSB2aWV3IGhhcyBiZWVuIHNob3duJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudFRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdHJldHVybiAoY3VycmVudFRpbWUgLSB2aWV3Q3JlYXRpb25UaW1lKSA+PSBkdXJhdGlvbk1zO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzU2luZ2xlTGluZUluc2VydGlvbkFmdGVyUG9zaXRpb24oZGlmZjogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10sIHBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGwpIHtcblx0aWYgKCFwb3NpdGlvbikge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRjb25zdCBwb3MgPSBwb3NpdGlvbjtcblxuXHRyZXR1cm4gZGlmZi5ldmVyeShtID0+IG0uaW5uZXJDaGFuZ2VzIS5ldmVyeShyID0+IGlzU3RhYmxlV29yZEluc2VydGlvbihyKSkpO1xuXG5cdGZ1bmN0aW9uIGlzU3RhYmxlV29yZEluc2VydGlvbihyOiBSYW5nZU1hcHBpbmcpIHtcblx0XHRpZiAoIXIub3JpZ2luYWxSYW5nZS5pc0VtcHR5KCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgaXNJbnNlcnRpb25XaXRoaW5MaW5lID0gci5tb2RpZmllZFJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gci5tb2RpZmllZFJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0aWYgKCFpc0luc2VydGlvbldpdGhpbkxpbmUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgaW5zZXJ0UG9zaXRpb24gPSByLm9yaWdpbmFsUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdGlmIChwb3MuaXNCZWZvcmVPckVxdWFsKGluc2VydFBvc2l0aW9uKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChpbnNlcnRQb3NpdGlvbi5saW5lTnVtYmVyIDwgcG9zLmxpbmVOdW1iZXIpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZnVuY3Rpb24gaXNTaW5nbGVNdWx0aUxpbmVJbnNlcnRpb24oZGlmZjogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10pIHtcblx0Y29uc3QgaW5uZXIgPSBkaWZmLmZsYXRNYXAoZCA9PiBkLmlubmVyQ2hhbmdlcyA/PyBbXSk7XG5cdGlmIChpbm5lci5sZW5ndGggIT09IDEpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjb25zdCBjaGFuZ2UgPSBpbm5lclswXTtcblx0aWYgKCFjaGFuZ2Uub3JpZ2luYWxSYW5nZS5pc0VtcHR5KCkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoY2hhbmdlLm1vZGlmaWVkUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSBjaGFuZ2UubW9kaWZpZWRSYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdyb3dFZGl0c1RvRW50aXJlV29yZChyZXBsYWNlbWVudHM6IFNpbmdsZVRleHRFZGl0W10sIG9yaWdpbmFsVGV4dDogQWJzdHJhY3RUZXh0KTogU2luZ2xlVGV4dEVkaXRbXSB7XG5cdHJldHVybiBfZ3Jvd0VkaXRzKHJlcGxhY2VtZW50cywgb3JpZ2luYWxUZXh0LCAoY2hhcikgPT4gL15bYS16QS1aXSQvLnRlc3QoY2hhcikpO1xufVxuXG5mdW5jdGlvbiBncm93RWRpdHNVbnRpbFdoaXRlc3BhY2UocmVwbGFjZW1lbnRzOiBTaW5nbGVUZXh0RWRpdFtdLCBvcmlnaW5hbFRleHQ6IEFic3RyYWN0VGV4dCk6IFNpbmdsZVRleHRFZGl0W10ge1xuXHRyZXR1cm4gX2dyb3dFZGl0cyhyZXBsYWNlbWVudHMsIG9yaWdpbmFsVGV4dCwgKGNoYXIpID0+ICEoL15cXHMkLy50ZXN0KGNoYXIpKSk7XG59XG5cbmZ1bmN0aW9uIF9ncm93RWRpdHMocmVwbGFjZW1lbnRzOiBTaW5nbGVUZXh0RWRpdFtdLCBvcmlnaW5hbFRleHQ6IEFic3RyYWN0VGV4dCwgZm46IChjOiBzdHJpbmcpID0+IGJvb2xlYW4pOiBTaW5nbGVUZXh0RWRpdFtdIHtcblx0Y29uc3QgcmVzdWx0OiBTaW5nbGVUZXh0RWRpdFtdID0gW107XG5cblx0cmVwbGFjZW1lbnRzLnNvcnQoKGEsIGIpID0+IFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyhhLnJhbmdlLCBiLnJhbmdlKSk7XG5cblx0Zm9yIChjb25zdCBlZGl0IG9mIHJlcGxhY2VtZW50cykge1xuXHRcdGxldCBzdGFydEluZGV4ID0gZWRpdC5yYW5nZS5zdGFydENvbHVtbiAtIDE7XG5cdFx0bGV0IGVuZEluZGV4ID0gZWRpdC5yYW5nZS5lbmRDb2x1bW4gLSAyO1xuXHRcdGxldCBwcmVmaXggPSAnJztcblx0XHRsZXQgc3VmZml4ID0gJyc7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lQ29udGVudCA9IG9yaWdpbmFsVGV4dC5nZXRMaW5lQXQoZWRpdC5yYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGVuZExpbmVDb250ZW50ID0gb3JpZ2luYWxUZXh0LmdldExpbmVBdChlZGl0LnJhbmdlLmVuZExpbmVOdW1iZXIpO1xuXG5cdFx0aWYgKGlzSW5jbHVkZWQoc3RhcnRMaW5lQ29udGVudFtzdGFydEluZGV4XSkpIHtcblx0XHRcdC8vIGdyb3cgdG8gdGhlIGxlZnRcblx0XHRcdHdoaWxlIChpc0luY2x1ZGVkKHN0YXJ0TGluZUNvbnRlbnRbc3RhcnRJbmRleCAtIDFdKSkge1xuXHRcdFx0XHRwcmVmaXggPSBzdGFydExpbmVDb250ZW50W3N0YXJ0SW5kZXggLSAxXSArIHByZWZpeDtcblx0XHRcdFx0c3RhcnRJbmRleC0tO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpc0luY2x1ZGVkKGVuZExpbmVDb250ZW50W2VuZEluZGV4XSkgfHwgZW5kSW5kZXggPCBzdGFydEluZGV4KSB7XG5cdFx0XHQvLyBncm93IHRvIHRoZSByaWdodFxuXHRcdFx0d2hpbGUgKGlzSW5jbHVkZWQoZW5kTGluZUNvbnRlbnRbZW5kSW5kZXggKyAxXSkpIHtcblx0XHRcdFx0c3VmZml4ICs9IGVuZExpbmVDb250ZW50W2VuZEluZGV4ICsgMV07XG5cdFx0XHRcdGVuZEluZGV4Kys7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gY3JlYXRlIG5ldyBlZGl0IGFuZCBtZXJnZSB0b2dldGhlciBpZiB0aGV5IGFyZSB0b3VjaGluZ1xuXHRcdGxldCBuZXdFZGl0ID0gbmV3IFNpbmdsZVRleHRFZGl0KG5ldyBSYW5nZShlZGl0LnJhbmdlLnN0YXJ0TGluZU51bWJlciwgc3RhcnRJbmRleCArIDEsIGVkaXQucmFuZ2UuZW5kTGluZU51bWJlciwgZW5kSW5kZXggKyAyKSwgcHJlZml4ICsgZWRpdC50ZXh0ICsgc3VmZml4KTtcblx0XHRpZiAocmVzdWx0Lmxlbmd0aCA+IDAgJiYgUmFuZ2UuYXJlSW50ZXJzZWN0aW5nT3JUb3VjaGluZyhyZXN1bHRbcmVzdWx0Lmxlbmd0aCAtIDFdLnJhbmdlLCBuZXdFZGl0LnJhbmdlKSkge1xuXHRcdFx0bmV3RWRpdCA9IFNpbmdsZVRleHRFZGl0LmpvaW5FZGl0cyhbcmVzdWx0LnBvcCgpISwgbmV3RWRpdF0sIG9yaWdpbmFsVGV4dCk7XG5cdFx0fVxuXG5cdFx0cmVzdWx0LnB1c2gobmV3RWRpdCk7XG5cdH1cblxuXHRmdW5jdGlvbiBpc0luY2x1ZGVkKGM6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdGlmIChjID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZuKGMpO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxpQkFBaUIsa0JBQWtCO0FBQzVDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsYUFBYTtBQUN0QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGtCQUFrQixTQUFTLGFBQWEsa0JBQTZELDBCQUEwQix1QkFBdUI7QUFDL0osU0FBUyw2QkFBNkI7QUFFdEMsU0FBK0IsNEJBQTRCO0FBQzNELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsYUFBYTtBQUN0QixTQUF1QixnQkFBZ0Isa0JBQWtCO0FBQ3pELFNBQVMsa0JBQWtCO0FBQzNCLFNBQW1DLG1DQUFtQyxvQkFBb0I7QUFDMUYsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQ0FBa0M7QUFHM0MsU0FB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
