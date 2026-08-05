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
import { mapFindFirst } from "../../../../../base/common/arraysFind.js";
import { itemsEquals } from "../../../../../base/common/equals.js";
import { BugIndicatingError, onUnexpectedError, onUnexpectedExternalError } from "../../../../../base/common/errors.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, derivedHandleChanges, derivedOpts, observableSignal, observableValue, recomputeInitiallyAndOnChange, subtransaction, transaction } from "../../../../../base/common/observable.js";
import { commonPrefixLength, firstNonWhitespaceIndex } from "../../../../../base/common/strings.js";
import { isDefined } from "../../../../../base/common/types.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { observableCodeEditor } from "../../../../browser/observableCodeEditor.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { CursorColumns } from "../../../../common/core/cursorColumns.js";
import { EditOperation } from "../../../../common/core/editOperation.js";
import { LineRange } from "../../../../common/core/lineRange.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { SingleTextEdit, TextEdit } from "../../../../common/core/textEdit.js";
import { TextLength } from "../../../../common/core/textLength.js";
import { ScrollType } from "../../../../common/editorCommon.js";
import { InlineCompletionTriggerKind, PartialAcceptTriggerKind } from "../../../../common/languages.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { EndOfLinePreference } from "../../../../common/model.js";
import { TextModelText } from "../../../../common/model/textModelText.js";
import { SnippetController2 } from "../../../snippet/browser/snippetController2.js";
import { addPositions, getEndPositionsAfterApplying, getModifiedRangesAfterApplying, substringPos, subtractPositions } from "../utils.js";
import { AnimatedValue, easeOutCubic, ObservableAnimatedValue } from "./animation.js";
import { computeGhostText } from "./computeGhostText.js";
import { GhostText, ghostTextOrReplacementEquals, ghostTextsOrReplacementsEqual } from "./ghostText.js";
import { InlineCompletionsSource } from "./inlineCompletionsSource.js";
import { InlineEdit } from "./inlineEdit.js";
import { singleTextEditAugments, singleTextRemoveCommonPrefix } from "./singleTextEditHelpers.js";
let InlineCompletionsModel = class extends Disposable {
  constructor(textModel, _selectedSuggestItem, _textModelVersionId, _positions, _debounceValue, _enabled, _editor, _instantiationService, _commandService, _languageConfigurationService, _accessibilityService) {
    super();
    this.textModel = textModel;
    this._selectedSuggestItem = _selectedSuggestItem;
    this._textModelVersionId = _textModelVersionId;
    this._positions = _positions;
    this._debounceValue = _debounceValue;
    this._enabled = _enabled;
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._commandService = _commandService;
    this._languageConfigurationService = _languageConfigurationService;
    this._accessibilityService = _accessibilityService;
    this._source = this._register(this._instantiationService.createInstance(InlineCompletionsSource, this.textModel, this._textModelVersionId, this._debounceValue));
    this._isActive = observableValue(this, false);
    this._onlyRequestInlineEditsSignal = observableSignal(this);
    this._forceUpdateExplicitlySignal = observableSignal(this);
    this._noDelaySignal = observableSignal(this);
    // We use a semantic id to keep the same inline completion selected even if the provider reorders the completions.
    this._selectedInlineCompletionId = observableValue(this, void 0);
    this.primaryPosition = derived(this, (reader) => this._positions.read(reader)[0] ?? new Position(1, 1));
    this._isAcceptingPartially = false;
    this._onDidAccept = new Emitter();
    this.onDidAccept = this._onDidAccept.event;
    this._editorObs = observableCodeEditor(this._editor);
    this._suggestPreviewEnabled = this._editorObs.getOption(EditorOption.suggest).map((v) => v.preview);
    this._suggestPreviewMode = this._editorObs.getOption(EditorOption.suggest).map((v) => v.previewMode);
    this._inlineSuggestMode = this._editorObs.getOption(EditorOption.inlineSuggest).map((v) => v.mode);
    this._inlineEditsEnabled = this._editorObs.getOption(EditorOption.inlineSuggest).map((v) => !!v.edits.enabled);
    this._inlineEditsShowCollapsedEnabled = this._editorObs.getOption(EditorOption.inlineSuggest).map((s) => s.edits.showCollapsed);
    this._lastShownInlineCompletionInfo = void 0;
    this._lastAcceptedInlineCompletionInfo = void 0;
    this._didUndoInlineEdits = derivedHandleChanges({
      owner: this,
      createEmptyChangeSummary: () => ({ didUndo: false }),
      handleChange: (ctx, changeSummary) => {
        changeSummary.didUndo = ctx.didChange(this._textModelVersionId) && !!ctx.change?.isUndoing;
        return true;
      }
    }, (reader, changeSummary) => {
      const versionId = this._textModelVersionId.read(reader);
      if (versionId !== null && this._lastAcceptedInlineCompletionInfo && this._lastAcceptedInlineCompletionInfo.textModelVersionIdAfter === versionId - 1 && this._lastAcceptedInlineCompletionInfo.inlineCompletion.isInlineEdit && changeSummary.didUndo) {
        this._lastAcceptedInlineCompletionInfo = void 0;
        return true;
      }
      return false;
    });
    this._preserveCurrentCompletionReasons = /* @__PURE__ */ new Set([
      1 /* Redo */,
      0 /* Undo */,
      2 /* AcceptWord */
    ]);
    this.dontRefetchSignal = observableSignal(this);
    this._fetchInlineCompletionsPromise = derivedHandleChanges({
      owner: this,
      createEmptyChangeSummary: () => ({
        dontRefetch: false,
        preserveCurrentCompletion: false,
        inlineCompletionTriggerKind: InlineCompletionTriggerKind.Automatic,
        onlyRequestInlineEdits: false,
        shouldDebounce: true
      }),
      handleChange: (ctx, changeSummary) => {
        if (ctx.didChange(this._textModelVersionId) && this._preserveCurrentCompletionReasons.has(this._getReason(ctx.change))) {
          changeSummary.preserveCurrentCompletion = true;
        } else if (ctx.didChange(this._forceUpdateExplicitlySignal)) {
          changeSummary.inlineCompletionTriggerKind = InlineCompletionTriggerKind.Explicit;
        } else if (ctx.didChange(this.dontRefetchSignal)) {
          changeSummary.dontRefetch = true;
        } else if (ctx.didChange(this._onlyRequestInlineEditsSignal)) {
          changeSummary.onlyRequestInlineEdits = true;
        } else if (ctx.didChange(this._noDelaySignal)) {
          changeSummary.shouldDebounce = false;
        }
        return true;
      }
    }, (reader, changeSummary) => {
      this._source.clearOperationOnTextModelChange.read(reader);
      this._noDelaySignal.read(reader);
      this.dontRefetchSignal.read(reader);
      this._onlyRequestInlineEditsSignal.read(reader);
      this._forceUpdateExplicitlySignal.read(reader);
      const shouldUpdate = this._enabled.read(reader) && this._selectedSuggestItem.read(reader) || this._isActive.read(reader);
      if (!shouldUpdate) {
        this._source.cancelUpdate();
        return void 0;
      }
      this._textModelVersionId.read(reader);
      const suggestWidgetInlineCompletions = this._source.suggestWidgetInlineCompletions.get();
      const suggestItem = this._selectedSuggestItem.read(reader);
      if (suggestWidgetInlineCompletions && !suggestItem) {
        const inlineCompletions = this._source.inlineCompletions.get();
        transaction((tx) => {
          if (!inlineCompletions || suggestWidgetInlineCompletions.request.versionId > inlineCompletions.request.versionId) {
            this._source.inlineCompletions.set(suggestWidgetInlineCompletions.clone(), tx);
          }
          this._source.clearSuggestWidgetInlineCompletions(tx);
        });
      }
      const cursorPosition = this.primaryPosition.get();
      if (changeSummary.dontRefetch) {
        return Promise.resolve(true);
      }
      if (this._didUndoInlineEdits.read(reader)) {
        transaction((tx) => {
          this._source.clear(tx);
        });
        return void 0;
      }
      let context = {
        triggerKind: changeSummary.inlineCompletionTriggerKind,
        selectedSuggestionInfo: suggestItem?.toSelectedSuggestionInfo(),
        includeInlineCompletions: !changeSummary.onlyRequestInlineEdits,
        includeInlineEdits: this._inlineEditsEnabled.read(reader)
      };
      if (context.triggerKind === InlineCompletionTriggerKind.Automatic) {
        if (this.textModel.getAlternativeVersionId() === this._lastShownInlineCompletionInfo?.alternateTextModelVersionId) {
          context = {
            ...context,
            includeInlineCompletions: !this._lastShownInlineCompletionInfo.inlineCompletion.isInlineEdit,
            includeInlineEdits: this._lastShownInlineCompletionInfo.inlineCompletion.isInlineEdit
          };
        }
      }
      const itemToPreserveCandidate = this.selectedInlineCompletion.get() ?? this._inlineCompletionItems.get()?.inlineEdit;
      const itemToPreserve = changeSummary.preserveCurrentCompletion || itemToPreserveCandidate?.forwardStable ? itemToPreserveCandidate : void 0;
      const userJumpedToActiveCompletion = this._jumpedToId.map((jumpedTo) => !!jumpedTo && jumpedTo === this._inlineCompletionItems.get()?.inlineEdit?.semanticId);
      return this._source.fetch(cursorPosition, context, itemToPreserve, changeSummary.shouldDebounce, userJumpedToActiveCompletion);
    });
    this._inlineCompletionItems = derivedOpts({ owner: this }, (reader) => {
      const c = this._source.inlineCompletions.read(reader);
      if (!c) {
        return void 0;
      }
      const cursorPosition = this.primaryPosition.read(reader);
      let inlineEdit = void 0;
      const visibleCompletions = [];
      for (const completion of c.inlineCompletions) {
        if (!completion.sourceInlineCompletion.isInlineEdit) {
          if (completion.isVisible(this.textModel, cursorPosition, reader)) {
            visibleCompletions.push(completion);
          }
        } else {
          inlineEdit = completion;
        }
      }
      if (visibleCompletions.length !== 0) {
        inlineEdit = void 0;
      }
      return {
        inlineCompletions: visibleCompletions,
        inlineEdit
      };
    });
    this._filteredInlineCompletionItems = derivedOpts({ owner: this, equalsFn: itemsEquals() }, (reader) => {
      const c = this._inlineCompletionItems.read(reader);
      return c?.inlineCompletions ?? [];
    });
    this.selectedInlineCompletionIndex = derived(this, (reader) => {
      const selectedInlineCompletionId = this._selectedInlineCompletionId.read(reader);
      const filteredCompletions = this._filteredInlineCompletionItems.read(reader);
      const idx = this._selectedInlineCompletionId === void 0 ? -1 : filteredCompletions.findIndex((v) => v.semanticId === selectedInlineCompletionId);
      if (idx === -1) {
        this._selectedInlineCompletionId.set(void 0, void 0);
        return 0;
      }
      return idx;
    });
    this.selectedInlineCompletion = derived(this, (reader) => {
      const filteredCompletions = this._filteredInlineCompletionItems.read(reader);
      const idx = this.selectedInlineCompletionIndex.read(reader);
      return filteredCompletions[idx];
    });
    this.activeCommands = derivedOpts(
      { owner: this, equalsFn: itemsEquals() },
      (r) => this.selectedInlineCompletion.read(r)?.source.inlineCompletions.commands ?? []
    );
    this.lastTriggerKind = this._source.inlineCompletions.map(this, (v) => v?.request.context.triggerKind);
    this.inlineCompletionsCount = derived(this, (reader) => {
      if (this.lastTriggerKind.read(reader) === InlineCompletionTriggerKind.Explicit) {
        return this._filteredInlineCompletionItems.read(reader).length;
      } else {
        return void 0;
      }
    });
    this._hasVisiblePeekWidgets = derived(this, (reader) => this._editorObs.openedPeekWidgets.read(reader) > 0);
    this.state = derivedOpts({
      owner: this,
      equalsFn: (a, b) => {
        if (!a || !b) {
          return a === b;
        }
        if (a.kind === "ghostText" && b.kind === "ghostText") {
          return ghostTextsOrReplacementsEqual(a.ghostTexts, b.ghostTexts) && a.inlineCompletion === b.inlineCompletion && a.suggestItem === b.suggestItem;
        } else if (a.kind === "inlineEdit" && b.kind === "inlineEdit") {
          return a.inlineEdit.equals(b.inlineEdit) && a.cursorAtInlineEdit === b.cursorAtInlineEdit;
        }
        return false;
      }
    }, (reader) => {
      const model = this.textModel;
      const item = this._inlineCompletionItems.read(reader);
      const inlineEditResult = item?.inlineEdit;
      if (inlineEditResult) {
        if (this._hasVisiblePeekWidgets.read(reader)) {
          return void 0;
        }
        let edit = inlineEditResult.toSingleTextEdit(reader);
        edit = singleTextRemoveCommonPrefix(edit, model);
        const cursorPos = this.primaryPosition.read(reader);
        const cursorAtInlineEdit = LineRange.fromRangeInclusive(edit.range).addMargin(1, 1).contains(cursorPos.lineNumber);
        const cursorInsideShowRange = cursorAtInlineEdit || (inlineEditResult.inlineCompletion.cursorShowRange?.containsPosition(cursorPos) ?? true);
        if (!cursorInsideShowRange && !this._inAcceptFlow.read(reader)) {
          return void 0;
        }
        const commands = inlineEditResult.inlineCompletion.source.inlineCompletions.commands;
        const inlineEdit = new InlineEdit(edit, commands ?? [], inlineEditResult.inlineCompletion);
        const edits = inlineEditResult.updatedEdit.read(reader);
        const e = edits ? TextEdit.fromOffsetEdit(edits, new TextModelText(this.textModel)).edits : [edit];
        return { kind: "inlineEdit", inlineEdit, inlineCompletion: inlineEditResult, edits: e, cursorAtInlineEdit };
      }
      const suggestItem = this._selectedSuggestItem.read(reader);
      if (suggestItem) {
        const suggestCompletionEdit = singleTextRemoveCommonPrefix(suggestItem.toSingleTextEdit(), model);
        const augmentation = this._computeAugmentation(suggestCompletionEdit, reader);
        const isSuggestionPreviewEnabled = this._suggestPreviewEnabled.read(reader);
        if (!isSuggestionPreviewEnabled && !augmentation) {
          return void 0;
        }
        const fullEdit = augmentation?.edit ?? suggestCompletionEdit;
        const fullEditPreviewLength = augmentation ? augmentation.edit.text.length - suggestCompletionEdit.text.length : 0;
        const mode = this._suggestPreviewMode.read(reader);
        const positions = this._positions.read(reader);
        const edits = [fullEdit, ...getSecondaryEdits(this.textModel, positions, fullEdit)];
        const ghostTexts = edits.map((edit, idx) => computeGhostText(edit, model, mode, positions[idx], fullEditPreviewLength)).filter(isDefined);
        const primaryGhostText = ghostTexts[0] ?? new GhostText(fullEdit.range.endLineNumber, []);
        return { kind: "ghostText", edits, primaryGhostText, ghostTexts, inlineCompletion: augmentation?.completion, suggestItem };
      } else {
        if (!this._isActive.read(reader)) {
          return void 0;
        }
        const inlineCompletion = this.selectedInlineCompletion.read(reader);
        if (!inlineCompletion) {
          return void 0;
        }
        const replacement = inlineCompletion.toSingleTextEdit(reader);
        const mode = this._inlineSuggestMode.read(reader);
        const positions = this._positions.read(reader);
        const edits = [replacement, ...getSecondaryEdits(this.textModel, positions, replacement)];
        const ghostTexts = edits.map((edit, idx) => computeGhostText(edit, model, mode, positions[idx], 0)).filter(isDefined);
        if (!ghostTexts[0]) {
          return void 0;
        }
        return { kind: "ghostText", edits, primaryGhostText: ghostTexts[0], ghostTexts, inlineCompletion, suggestItem: void 0 };
      }
    });
    this.status = derived(this, (reader) => {
      if (this._source.loading.read(reader)) {
        return "loading";
      }
      const s = this.state.read(reader);
      if (s?.kind === "ghostText") {
        return "ghostText";
      }
      if (s?.kind === "inlineEdit") {
        return "inlineEdit";
      }
      return "noSuggestion";
    });
    this.inlineCompletionState = derived(this, (reader) => {
      const s = this.state.read(reader);
      if (!s || s.kind !== "ghostText") {
        return void 0;
      }
      if (this._editorObs.inComposition.read(reader)) {
        return void 0;
      }
      return s;
    });
    this.inlineEditState = derived(this, (reader) => {
      const s = this.state.read(reader);
      if (!s || s.kind !== "inlineEdit") {
        return void 0;
      }
      return s;
    });
    this.inlineEditAvailable = derived(this, (reader) => {
      const s = this.inlineEditState.read(reader);
      return !!s;
    });
    this.warning = derived(this, (reader) => {
      return this.inlineCompletionState.read(reader)?.inlineCompletion?.sourceInlineCompletion.warning;
    });
    this.ghostTexts = derivedOpts({ owner: this, equalsFn: ghostTextsOrReplacementsEqual }, (reader) => {
      const v = this.inlineCompletionState.read(reader);
      if (!v) {
        return void 0;
      }
      return v.ghostTexts;
    });
    this.primaryGhostText = derivedOpts({ owner: this, equalsFn: ghostTextOrReplacementEquals }, (reader) => {
      const v = this.inlineCompletionState.read(reader);
      if (!v) {
        return void 0;
      }
      return v?.primaryGhostText;
    });
    this.showCollapsed = derived(this, (reader) => {
      const state = this.state.read(reader);
      if (!state || state.kind !== "inlineEdit") {
        return false;
      }
      const isCurrentModelVersion = state.inlineCompletion.updatedEditModelVersion === this._textModelVersionId.read(reader);
      return (this._inlineEditsShowCollapsedEnabled.read(reader) || !isCurrentModelVersion) && this._jumpedToId.read(reader) !== state.inlineCompletion.semanticId && !this._inAcceptFlow.read(reader);
    });
    this._tabShouldIndent = derived(this, (reader) => {
      if (this._inAcceptFlow.read(reader)) {
        return false;
      }
      function isMultiLine(range) {
        return range.startLineNumber !== range.endLineNumber;
      }
      function getNonIndentationRange(model, lineNumber) {
        const columnStart = model.getLineIndentColumn(lineNumber);
        const lastNonWsColumn = model.getLineLastNonWhitespaceColumn(lineNumber);
        const columnEnd = Math.max(lastNonWsColumn, columnStart);
        return new Range(lineNumber, columnStart, lineNumber, columnEnd);
      }
      const selections = this._editorObs.selections.read(reader);
      return selections?.some((s) => {
        if (s.isEmpty()) {
          return this.textModel.getLineLength(s.startLineNumber) === 0;
        } else {
          return isMultiLine(s) || s.containsRange(getNonIndentationRange(this.textModel, s.startLineNumber));
        }
      });
    });
    this.tabShouldJumpToInlineEdit = derived(this, (reader) => {
      if (this._tabShouldIndent.read(reader)) {
        return false;
      }
      const s = this.inlineEditState.read(reader);
      if (!s) {
        return false;
      }
      if (this.showCollapsed.read(reader)) {
        return true;
      }
      return !s.cursorAtInlineEdit;
    });
    this.tabShouldAcceptInlineEdit = derived(this, (reader) => {
      const s = this.inlineEditState.read(reader);
      if (!s) {
        return false;
      }
      if (this.showCollapsed.read(reader)) {
        return false;
      }
      if (s.inlineEdit.range.startLineNumber === this._editorObs.cursorLineNumber.read(reader)) {
        return true;
      }
      if (this._jumpedToId.read(reader) === s.inlineCompletion.semanticId) {
        return true;
      }
      if (this._tabShouldIndent.read(reader)) {
        return false;
      }
      return s.cursorAtInlineEdit;
    });
    // TODO: clean this up if we keep it
    this._inAcceptPartialFlow = observableValue(this, false);
    this.inPartialAcceptFlow = this._inAcceptPartialFlow;
    this._jumpedToId = observableValue(this, void 0);
    this._inAcceptFlow = observableValue(this, false);
    this.inAcceptFlow = this._inAcceptFlow;
    this._register(recomputeInitiallyAndOnChange(this._fetchInlineCompletionsPromise));
    let lastItem = void 0;
    this._register(autorun((reader) => {
      const item = this.inlineCompletionState.read(reader);
      const completion = item?.inlineCompletion;
      if (completion?.semanticId !== lastItem?.semanticId) {
        lastItem = completion;
        if (completion) {
          const i = completion.inlineCompletion;
          const src = i.source;
          src.provider.handleItemDidShow?.(src.inlineCompletions, i.sourceInlineCompletion, i.insertText);
        }
      }
    }));
    this._register(autorun((reader) => {
      const inlineCompletions = this._source.inlineCompletions.read(reader);
      if (!inlineCompletions) {
        return;
      }
      for (const inlineCompletion of inlineCompletions.inlineCompletions) {
        if (inlineCompletion.updatedEdit.read(reader) === void 0) {
          this.stop();
          break;
        }
      }
    }));
    this._register(autorun((reader) => {
      this._editorObs.versionId.read(reader);
      this._inAcceptFlow.set(false, void 0);
    }));
    this._register(autorun((reader) => {
      const jumpToReset = this.state.map((s) => !s || s.kind === "inlineEdit" && !s.cursorAtInlineEdit).read(reader);
      if (jumpToReset) {
        this._jumpedToId.set(void 0, void 0);
      }
    }));
    const inlineEditSemanticId = this.inlineEditState.map((s) => s?.inlineCompletion.semanticId);
    this._register(autorun((reader) => {
      const id = inlineEditSemanticId.read(reader);
      if (id) {
        this._editor.pushUndoStop();
        this._lastShownInlineCompletionInfo = {
          alternateTextModelVersionId: this.textModel.getAlternativeVersionId(),
          inlineCompletion: this.state.get().inlineCompletion.inlineCompletion
        };
      }
    }));
    this._didUndoInlineEdits.recomputeInitiallyAndOnChange(this._store);
  }
  get isAcceptingPartially() {
    return this._isAcceptingPartially;
  }
  debugGetSelectedSuggestItem() {
    return this._selectedSuggestItem;
  }
  getIndentationInfo(reader) {
    let startsWithIndentation = false;
    let startsWithIndentationLessThanTabSize = true;
    const ghostText = this?.primaryGhostText.read(reader);
    if (!!this?._selectedSuggestItem && ghostText && ghostText.parts.length > 0) {
      const { column, lines } = ghostText.parts[0];
      const firstLine = lines[0].line;
      const indentationEndColumn = this.textModel.getLineIndentColumn(ghostText.lineNumber);
      const inIndentation = column <= indentationEndColumn;
      if (inIndentation) {
        let firstNonWsIdx = firstNonWhitespaceIndex(firstLine);
        if (firstNonWsIdx === -1) {
          firstNonWsIdx = firstLine.length - 1;
        }
        startsWithIndentation = firstNonWsIdx > 0;
        const tabSize = this.textModel.getOptions().tabSize;
        const visibleColumnIndentation = CursorColumns.visibleColumnFromColumn(firstLine, firstNonWsIdx + 1, tabSize);
        startsWithIndentationLessThanTabSize = visibleColumnIndentation < tabSize;
      }
    }
    return {
      startsWithIndentation,
      startsWithIndentationLessThanTabSize
    };
  }
  _getReason(e) {
    if (e?.isUndoing) {
      return 0 /* Undo */;
    }
    if (e?.isRedoing) {
      return 1 /* Redo */;
    }
    if (this.isAcceptingPartially) {
      return 2 /* AcceptWord */;
    }
    return 3 /* Other */;
  }
  async trigger(tx, options) {
    subtransaction(tx, (tx2) => {
      if (options?.onlyFetchInlineEdits) {
        this._onlyRequestInlineEditsSignal.trigger(tx2);
      }
      if (options?.noDelay) {
        this._noDelaySignal.trigger(tx2);
      }
      this._isActive.set(true, tx2);
    });
    await this._fetchInlineCompletionsPromise.get();
  }
  async triggerExplicitly(tx, onlyFetchInlineEdits = false) {
    subtransaction(tx, (tx2) => {
      if (onlyFetchInlineEdits) {
        this._onlyRequestInlineEditsSignal.trigger(tx2);
      }
      this._isActive.set(true, tx2);
      this._inAcceptFlow.set(true, tx2);
      this._forceUpdateExplicitlySignal.trigger(tx2);
    });
    await this._fetchInlineCompletionsPromise.get();
  }
  stop(stopReason = "automatic", tx) {
    subtransaction(tx, (tx2) => {
      if (stopReason === "explicitCancel") {
        const inlineCompletion = this.state.get()?.inlineCompletion;
        const source = inlineCompletion?.source;
        const sourceInlineCompletion = inlineCompletion?.sourceInlineCompletion;
        if (sourceInlineCompletion && source?.provider.handleRejection) {
          source.provider.handleRejection(source.inlineCompletions, sourceInlineCompletion);
        }
      }
      this._inAcceptPartialFlow.set(false, tx2);
      this._isActive.set(false, tx2);
      this._source.clear(tx2);
    });
  }
  _computeAugmentation(suggestCompletion, reader) {
    const model = this.textModel;
    const suggestWidgetInlineCompletions = this._source.suggestWidgetInlineCompletions.read(reader);
    const candidateInlineCompletions = suggestWidgetInlineCompletions ? suggestWidgetInlineCompletions.inlineCompletions : [this.selectedInlineCompletion.read(reader)].filter(isDefined);
    const augmentedCompletion = mapFindFirst(candidateInlineCompletions, (completion) => {
      let r = completion.toSingleTextEdit(reader);
      r = singleTextRemoveCommonPrefix(
        r,
        model,
        Range.fromPositions(r.range.getStartPosition(), suggestCompletion.range.getEndPosition())
      );
      return singleTextEditAugments(r, suggestCompletion) ? { completion, edit: r } : void 0;
    });
    return augmentedCompletion;
  }
  async _deltaSelectedInlineCompletionIndex(delta) {
    await this.triggerExplicitly();
    const completions = this._filteredInlineCompletionItems.get() || [];
    if (completions.length > 0) {
      const newIdx = (this.selectedInlineCompletionIndex.get() + delta + completions.length) % completions.length;
      this._selectedInlineCompletionId.set(completions[newIdx].semanticId, void 0);
    } else {
      this._selectedInlineCompletionId.set(void 0, void 0);
    }
  }
  async next() {
    await this._deltaSelectedInlineCompletionIndex(1);
  }
  async previous() {
    await this._deltaSelectedInlineCompletionIndex(-1);
  }
  async accept(editor = this._editor) {
    if (editor.getModel() !== this.textModel) {
      throw new BugIndicatingError();
    }
    if (this._inAcceptPartialFlow.get()) {
      this._inAcceptPartialFlow.set(false, void 0);
      this.jump();
      return;
    }
    let completionWithUpdatedRange;
    const state = this.state.get();
    if (state?.kind === "ghostText") {
      if (!state || state.primaryGhostText.isEmpty() || !state.inlineCompletion) {
        return;
      }
      completionWithUpdatedRange = state.inlineCompletion;
    } else if (state?.kind === "inlineEdit") {
      completionWithUpdatedRange = state.inlineCompletion;
    } else {
      return;
    }
    const completion = completionWithUpdatedRange.toInlineCompletion(void 0);
    if (completion.command) {
      completion.source.addRef();
    }
    editor.pushUndoStop();
    if (completion.snippetInfo) {
      editor.executeEdits(
        "inlineSuggestion.accept",
        [
          EditOperation.replace(completion.range, ""),
          ...completion.additionalTextEdits
        ]
      );
      editor.setPosition(completion.snippetInfo.range.getStartPosition(), "inlineCompletionAccept");
      SnippetController2.get(editor)?.insert(completion.snippetInfo.snippet, { undoStopBefore: false });
    } else {
      const edits = state.edits;
      const selections = getEndPositionsAfterApplying(edits).map((p) => Selection.fromPositions(p));
      editor.executeEdits("inlineSuggestion.accept", [
        ...edits.map((edit) => EditOperation.replace(edit.range, edit.text)),
        ...completion.additionalTextEdits
      ]);
      editor.setSelections(state.kind === "inlineEdit" ? selections.slice(-1) : selections, "inlineCompletionAccept");
      if (state.kind === "inlineEdit" && !this._accessibilityService.isMotionReduced()) {
        const editRanges = new TextEdit(edits).getNewRanges();
        const dec = this._store.add(new FadeoutDecoration(editor, editRanges, () => {
          this._store.delete(dec);
        }));
      }
    }
    this._onDidAccept.fire();
    this.stop();
    if (completion.command) {
      await this._commandService.executeCommand(completion.command.id, ...completion.command.arguments || []).then(void 0, onUnexpectedExternalError);
      completion.source.removeRef();
    }
    this._inAcceptFlow.set(true, void 0);
    this._lastAcceptedInlineCompletionInfo = { textModelVersionIdAfter: this.textModel.getVersionId(), inlineCompletion: completion };
  }
  async acceptNextWord(editor) {
    await this._acceptNext(editor, (pos, text) => {
      const langId = this.textModel.getLanguageIdAtPosition(pos.lineNumber, pos.column);
      const config = this._languageConfigurationService.getLanguageConfiguration(langId);
      const wordRegExp = new RegExp(config.wordDefinition.source, config.wordDefinition.flags.replace("g", ""));
      const m1 = text.match(wordRegExp);
      let acceptUntilIndexExclusive = 0;
      if (m1 && m1.index !== void 0) {
        if (m1.index === 0) {
          acceptUntilIndexExclusive = m1[0].length;
        } else {
          acceptUntilIndexExclusive = m1.index;
        }
      } else {
        acceptUntilIndexExclusive = text.length;
      }
      const wsRegExp = /\s+/g;
      const m2 = wsRegExp.exec(text);
      if (m2 && m2.index !== void 0) {
        if (m2.index + m2[0].length < acceptUntilIndexExclusive) {
          acceptUntilIndexExclusive = m2.index + m2[0].length;
        }
      }
      return acceptUntilIndexExclusive;
    }, PartialAcceptTriggerKind.Word);
  }
  async acceptNextLine(editor) {
    await this._acceptNext(editor, (pos, text) => {
      const m = text.match(/\n/);
      if (m && m.index !== void 0) {
        return m.index + 1;
      }
      return text.length;
    }, PartialAcceptTriggerKind.Line);
  }
  async _acceptNext(editor, getAcceptUntilIndex, kind) {
    if (editor.getModel() !== this.textModel) {
      throw new BugIndicatingError();
    }
    const state = this.inlineCompletionState.get();
    if (!state || state.primaryGhostText.isEmpty() || !state.inlineCompletion) {
      return;
    }
    const ghostText = state.primaryGhostText;
    const completion = state.inlineCompletion.toInlineCompletion(void 0);
    if (completion.snippetInfo || completion.filterText !== completion.insertText) {
      await this.accept(editor);
      return;
    }
    const firstPart = ghostText.parts[0];
    const ghostTextPos = new Position(ghostText.lineNumber, firstPart.column);
    const ghostTextVal = firstPart.text;
    const acceptUntilIndexExclusive = getAcceptUntilIndex(ghostTextPos, ghostTextVal);
    if (acceptUntilIndexExclusive === ghostTextVal.length && ghostText.parts.length === 1) {
      this.accept(editor);
      return;
    }
    const partialGhostTextVal = ghostTextVal.substring(0, acceptUntilIndexExclusive);
    const positions = this._positions.get();
    const cursorPosition = positions[0];
    completion.source.addRef();
    try {
      this._isAcceptingPartially = true;
      try {
        editor.pushUndoStop();
        const replaceRange = Range.fromPositions(cursorPosition, ghostTextPos);
        const newText = editor.getModel().getValueInRange(replaceRange) + partialGhostTextVal;
        const primaryEdit = new SingleTextEdit(replaceRange, newText);
        const edits = [primaryEdit, ...getSecondaryEdits(this.textModel, positions, primaryEdit)];
        const selections = getEndPositionsAfterApplying(edits).map((p) => Selection.fromPositions(p));
        editor.executeEdits("inlineSuggestion.accept", edits.map((edit) => EditOperation.replace(edit.range, edit.text)));
        editor.setSelections(selections, "inlineCompletionPartialAccept");
        editor.revealPositionInCenterIfOutsideViewport(editor.getPosition(), ScrollType.Immediate);
      } finally {
        this._isAcceptingPartially = false;
      }
      if (completion.source.provider.handlePartialAccept) {
        const acceptedRange = Range.fromPositions(completion.range.getStartPosition(), TextLength.ofText(partialGhostTextVal).addToPosition(ghostTextPos));
        const text = editor.getModel().getValueInRange(acceptedRange, EndOfLinePreference.LF);
        const acceptedLength = text.length;
        completion.source.provider.handlePartialAccept(
          completion.source.inlineCompletions,
          completion.sourceInlineCompletion,
          acceptedLength,
          { kind, acceptedLength }
        );
      }
    } finally {
      completion.source.removeRef();
    }
  }
  async acceptNextInlineEditPart(editor) {
    if (editor.getModel() !== this.textModel) {
      throw new BugIndicatingError();
    }
    const state = this.inlineEditState.get();
    const updatedEdit = state?.inlineCompletion.updatedEdit.get();
    const completion = state?.inlineCompletion.toInlineCompletion(void 0);
    if (!updatedEdit || updatedEdit.isEmpty || !completion) {
      return;
    }
    const nextPart = updatedEdit.edits[0];
    const edit = new SingleTextEdit(Range.fromPositions(
      this.textModel.getPositionAt(nextPart.replaceRange.start),
      this.textModel.getPositionAt(nextPart.replaceRange.endExclusive)
    ), nextPart.newText);
    const cursorAtStartPosition = this._editor.getSelection()?.getStartPosition().equals(edit.range.getStartPosition());
    if (!cursorAtStartPosition || !this._inAcceptPartialFlow.get()) {
      this._inAcceptPartialFlow.set(true, void 0);
      this.jump();
      return;
    }
    const partToJumpToNext = updatedEdit.edits[1] ?? void 0;
    const editToJumpToNext = partToJumpToNext ? new SingleTextEdit(Range.fromPositions(
      this.textModel.getPositionAt(partToJumpToNext.replaceRange.start),
      this.textModel.getPositionAt(partToJumpToNext.replaceRange.endExclusive)
    ), partToJumpToNext.newText) : void 0;
    completion.source.addRef();
    try {
      this._isAcceptingPartially = true;
      try {
        editor.pushUndoStop();
        let selections;
        if (editToJumpToNext) {
          const [_, rangeOfEditToJumpTo] = getModifiedRangesAfterApplying([edit, editToJumpToNext]);
          selections = [Selection.fromPositions(rangeOfEditToJumpTo.getStartPosition())];
        } else {
          selections = getEndPositionsAfterApplying([edit]).map((p) => Selection.fromPositions(p));
        }
        const edits = [edit];
        editor.executeEdits("inlineSuggestion.accept", edits.map((edit2) => EditOperation.replace(edit2.range, edit2.text)));
        editor.setSelections(selections, "inlineCompletionPartialAccept");
        editor.revealPositionInCenterIfOutsideViewport(editor.getPosition(), ScrollType.Immediate);
      } finally {
        this._isAcceptingPartially = false;
      }
    } finally {
      completion.source.removeRef();
    }
  }
  handleSuggestAccepted(item) {
    const itemEdit = singleTextRemoveCommonPrefix(item.toSingleTextEdit(), this.textModel);
    const augmentedCompletion = this._computeAugmentation(itemEdit, void 0);
    if (!augmentedCompletion) {
      return;
    }
    const source = augmentedCompletion.completion.source;
    const sourceInlineCompletion = augmentedCompletion.completion.sourceInlineCompletion;
    const completion = augmentedCompletion.completion.toInlineCompletion(void 0);
    const alreadyAcceptedLength = this.textModel.getValueInRange(completion.range, EndOfLinePreference.LF).length;
    const acceptedLength = alreadyAcceptedLength + itemEdit.text.length;
    source.provider.handlePartialAccept?.(
      source.inlineCompletions,
      sourceInlineCompletion,
      itemEdit.text.length,
      {
        kind: PartialAcceptTriggerKind.Suggest,
        acceptedLength
      }
    );
  }
  extractReproSample() {
    const value = this.textModel.getValue();
    const item = this.state.get()?.inlineCompletion?.toInlineCompletion(void 0);
    return {
      documentValue: value,
      inlineCompletion: item?.sourceInlineCompletion
    };
  }
  jump() {
    const s = this.inlineEditState.get();
    if (!s) {
      return;
    }
    transaction((tx) => {
      this._jumpedToId.set(s.inlineCompletion.semanticId, tx);
      this.dontRefetchSignal.trigger(tx);
      const edit = s.inlineCompletion.toSingleTextEdit(void 0);
      this._editor.setPosition(edit.range.getStartPosition(), "inlineCompletions.jump");
      const isSingleLineChange = edit.range.startLineNumber === edit.range.endLineNumber && !edit.text.includes("\n");
      if (isSingleLineChange) {
        this._editor.revealPosition(edit.range.getStartPosition());
      } else {
        const revealRange = new Range(edit.range.startLineNumber - 1, 1, edit.range.endLineNumber + 1, 1);
        this._editor.revealRange(revealRange, ScrollType.Immediate);
      }
      this._editor.focus();
    });
  }
  async handleInlineEditShown(inlineCompletion) {
    if (inlineCompletion.didShow) {
      return;
    }
    inlineCompletion.markAsShown();
    inlineCompletion.source.provider.handleItemDidShow?.(inlineCompletion.source.inlineCompletions, inlineCompletion.sourceInlineCompletion, inlineCompletion.insertText);
    if (inlineCompletion.shownCommand) {
      await this._commandService.executeCommand(inlineCompletion.shownCommand.id, ...inlineCompletion.shownCommand.arguments || []);
    }
  }
};
InlineCompletionsModel = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, ILanguageConfigurationService),
  __decorateParam(10, IAccessibilityService)
], InlineCompletionsModel);
var VersionIdChangeReason = /* @__PURE__ */ ((VersionIdChangeReason2) => {
  VersionIdChangeReason2[VersionIdChangeReason2["Undo"] = 0] = "Undo";
  VersionIdChangeReason2[VersionIdChangeReason2["Redo"] = 1] = "Redo";
  VersionIdChangeReason2[VersionIdChangeReason2["AcceptWord"] = 2] = "AcceptWord";
  VersionIdChangeReason2[VersionIdChangeReason2["Other"] = 3] = "Other";
  return VersionIdChangeReason2;
})(VersionIdChangeReason || {});
function getSecondaryEdits(textModel, positions, primaryEdit) {
  if (positions.length === 1) {
    return [];
  }
  const primaryPosition = positions[0];
  const secondaryPositions = positions.slice(1);
  const primaryEditStartPosition = primaryEdit.range.getStartPosition();
  const primaryEditEndPosition = primaryEdit.range.getEndPosition();
  const replacedTextAfterPrimaryCursor = textModel.getValueInRange(
    Range.fromPositions(primaryPosition, primaryEditEndPosition)
  );
  const positionWithinTextEdit = subtractPositions(primaryPosition, primaryEditStartPosition);
  if (positionWithinTextEdit.lineNumber < 1) {
    onUnexpectedError(new BugIndicatingError(
      `positionWithinTextEdit line number should be bigger than 0.
			Invalid subtraction between ${primaryPosition.toString()} and ${primaryEditStartPosition.toString()}`
    ));
    return [];
  }
  const secondaryEditText = substringPos(primaryEdit.text, positionWithinTextEdit);
  return secondaryPositions.map((pos) => {
    const posEnd = addPositions(subtractPositions(pos, primaryEditStartPosition), primaryEditEndPosition);
    const textAfterSecondaryCursor = textModel.getValueInRange(
      Range.fromPositions(pos, posEnd)
    );
    const l = commonPrefixLength(replacedTextAfterPrimaryCursor, textAfterSecondaryCursor);
    const range = Range.fromPositions(pos, pos.delta(0, l));
    return new SingleTextEdit(range, secondaryEditText);
  });
}
class FadeoutDecoration extends Disposable {
  constructor(editor, ranges, onDispose) {
    super();
    if (onDispose) {
      this._register({ dispose: () => onDispose() });
    }
    this._register(observableCodeEditor(editor).setDecorations(constObservable(ranges.map((range) => ({
      range,
      options: {
        description: "animation",
        className: "edits-fadeout-decoration",
        zIndex: 1
      }
    })))));
    const animation = new AnimatedValue(1, 0, 1e3, easeOutCubic);
    const val = new ObservableAnimatedValue(animation);
    this._register(autorun((reader) => {
      const opacity = val.getValue(reader);
      editor.getContainerDomNode().style.setProperty("--animation-opacity", opacity.toString());
      if (animation.isFinished()) {
        this.dispose();
      }
    }));
  }
}
export {
  InlineCompletionsModel,
  VersionIdChangeReason,
  getSecondaryEdits
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL2lubGluZUNvbXBsZXRpb25zTW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBtYXBGaW5kRmlyc3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IGl0ZW1zRXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXF1YWxzLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciwgb25VbmV4cGVjdGVkRXJyb3IsIG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIElPYnNlcnZhYmxlV2l0aENoYW5nZSwgSVJlYWRlciwgSVRyYW5zYWN0aW9uLCBhdXRvcnVuLCBjb25zdE9ic2VydmFibGUsIGRlcml2ZWQsIGRlcml2ZWRIYW5kbGVDaGFuZ2VzLCBkZXJpdmVkT3B0cywgb2JzZXJ2YWJsZVNpZ25hbCwgb2JzZXJ2YWJsZVZhbHVlLCByZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSwgc3VidHJhbnNhY3Rpb24sIHRyYW5zYWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBjb21tb25QcmVmaXhMZW5ndGgsIGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29sdW1ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL2N1cnNvckNvbHVtbnMuanMnO1xuaW1wb3J0IHsgRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgU2luZ2xlVGV4dEVkaXQsIFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvdGV4dEVkaXQuanMnO1xuaW1wb3J0IHsgVGV4dExlbmd0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3RleHRMZW5ndGguanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgQ29tbWFuZCwgSW5saW5lQ29tcGxldGlvbiwgSW5saW5lQ29tcGxldGlvbkNvbnRleHQsIElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZCwgUGFydGlhbEFjY2VwdFRyaWdnZXJLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lUHJlZmVyZW5jZSwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsVGV4dC5qcyc7XG5pbXBvcnQgeyBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgU25pcHBldENvbnRyb2xsZXIyIH0gZnJvbSAnLi4vLi4vLi4vc25pcHBldC9icm93c2VyL3NuaXBwZXRDb250cm9sbGVyMi5qcyc7XG5pbXBvcnQgeyBhZGRQb3NpdGlvbnMsIGdldEVuZFBvc2l0aW9uc0FmdGVyQXBwbHlpbmcsIGdldE1vZGlmaWVkUmFuZ2VzQWZ0ZXJBcHBseWluZywgc3Vic3RyaW5nUG9zLCBzdWJ0cmFjdFBvc2l0aW9ucyB9IGZyb20gJy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IEFuaW1hdGVkVmFsdWUsIGVhc2VPdXRDdWJpYywgT2JzZXJ2YWJsZUFuaW1hdGVkVmFsdWUgfSBmcm9tICcuL2FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgeyBjb21wdXRlR2hvc3RUZXh0IH0gZnJvbSAnLi9jb21wdXRlR2hvc3RUZXh0LmpzJztcbmltcG9ydCB7IEdob3N0VGV4dCwgR2hvc3RUZXh0T3JSZXBsYWNlbWVudCwgZ2hvc3RUZXh0T3JSZXBsYWNlbWVudEVxdWFscywgZ2hvc3RUZXh0c09yUmVwbGFjZW1lbnRzRXF1YWwgfSBmcm9tICcuL2dob3N0VGV4dC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDb21wbGV0aW9uV2l0aFVwZGF0ZWRSYW5nZSwgSW5saW5lQ29tcGxldGlvbnNTb3VyY2UgfSBmcm9tICcuL2lubGluZUNvbXBsZXRpb25zU291cmNlLmpzJztcbmltcG9ydCB7IElubGluZUVkaXQgfSBmcm9tICcuL2lubGluZUVkaXQuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbkl0ZW0gfSBmcm9tICcuL3Byb3ZpZGVJbmxpbmVDb21wbGV0aW9ucy5qcyc7XG5pbXBvcnQgeyBzaW5nbGVUZXh0RWRpdEF1Z21lbnRzLCBzaW5nbGVUZXh0UmVtb3ZlQ29tbW9uUHJlZml4IH0gZnJvbSAnLi9zaW5nbGVUZXh0RWRpdEhlbHBlcnMuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdEl0ZW1JbmZvIH0gZnJvbSAnLi9zdWdnZXN0V2lkZ2V0QWRhcHRlci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVDb21wbGV0aW9uc01vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NvdXJjZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKElubGluZUNvbXBsZXRpb25zU291cmNlLCB0aGlzLnRleHRNb2RlbCwgdGhpcy5fdGV4dE1vZGVsVmVyc2lvbklkLCB0aGlzLl9kZWJvdW5jZVZhbHVlKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lzQWN0aXZlID0gb2JzZXJ2YWJsZVZhbHVlPGJvb2xlYW4+KHRoaXMsIGZhbHNlKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25seVJlcXVlc3RJbmxpbmVFZGl0c1NpZ25hbCA9IG9ic2VydmFibGVTaWduYWwodGhpcyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2ZvcmNlVXBkYXRlRXhwbGljaXRseVNpZ25hbCA9IG9ic2VydmFibGVTaWduYWwodGhpcyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX25vRGVsYXlTaWduYWwgPSBvYnNlcnZhYmxlU2lnbmFsKHRoaXMpO1xuXG5cdC8vIFdlIHVzZSBhIHNlbWFudGljIGlkIHRvIGtlZXAgdGhlIHNhbWUgaW5saW5lIGNvbXBsZXRpb24gc2VsZWN0ZWQgZXZlbiBpZiB0aGUgcHJvdmlkZXIgcmVvcmRlcnMgdGhlIGNvbXBsZXRpb25zLlxuXHRwcml2YXRlIHJlYWRvbmx5IF9zZWxlY3RlZElubGluZUNvbXBsZXRpb25JZCA9IG9ic2VydmFibGVWYWx1ZTxzdHJpbmcgfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cdHB1YmxpYyByZWFkb25seSBwcmltYXJ5UG9zaXRpb24gPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB0aGlzLl9wb3NpdGlvbnMucmVhZChyZWFkZXIpWzBdID8/IG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cblx0cHJpdmF0ZSBfaXNBY2NlcHRpbmdQYXJ0aWFsbHkgPSBmYWxzZTtcblx0cHVibGljIGdldCBpc0FjY2VwdGluZ1BhcnRpYWxseSgpIHsgcmV0dXJuIHRoaXMuX2lzQWNjZXB0aW5nUGFydGlhbGx5OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBY2NlcHQgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRBY2NlcHQgPSB0aGlzLl9vbkRpZEFjY2VwdC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JPYnMgPSBvYnNlcnZhYmxlQ29kZUVkaXRvcih0aGlzLl9lZGl0b3IpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N1Z2dlc3RQcmV2aWV3RW5hYmxlZCA9IHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN1Z2dlc3QpLm1hcCh2ID0+IHYucHJldmlldyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N1Z2dlc3RQcmV2aWV3TW9kZSA9IHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN1Z2dlc3QpLm1hcCh2ID0+IHYucHJldmlld01vZGUpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbmxpbmVTdWdnZXN0TW9kZSA9IHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGluZVN1Z2dlc3QpLm1hcCh2ID0+IHYubW9kZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lubGluZUVkaXRzRW5hYmxlZCA9IHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGluZVN1Z2dlc3QpLm1hcCh2ID0+ICEhdi5lZGl0cy5lbmFibGVkKTtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lRWRpdHNTaG93Q29sbGFwc2VkRW5hYmxlZCA9IHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGluZVN1Z2dlc3QpLm1hcChzID0+IHMuZWRpdHMuc2hvd0NvbGxhcHNlZCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHRleHRNb2RlbDogSVRleHRNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zZWxlY3RlZFN1Z2dlc3RJdGVtOiBJT2JzZXJ2YWJsZTxTdWdnZXN0SXRlbUluZm8gfCB1bmRlZmluZWQ+LFxuXHRcdHB1YmxpYyByZWFkb25seSBfdGV4dE1vZGVsVmVyc2lvbklkOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8bnVtYmVyIHwgbnVsbCwgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcG9zaXRpb25zOiBJT2JzZXJ2YWJsZTxyZWFkb25seSBQb3NpdGlvbltdPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kZWJvdW5jZVZhbHVlOiBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZW5hYmxlZDogSU9ic2VydmFibGU8Ym9vbGVhbj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9mZXRjaElubGluZUNvbXBsZXRpb25zUHJvbWlzZSkpO1xuXG5cdFx0bGV0IGxhc3RJdGVtOiBJbmxpbmVDb21wbGV0aW9uV2l0aFVwZGF0ZWRSYW5nZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGNhbGwgaGFuZGxlSXRlbURpZFNob3cgKi9cblx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLmlubGluZUNvbXBsZXRpb25TdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBjb21wbGV0aW9uID0gaXRlbT8uaW5saW5lQ29tcGxldGlvbjtcblx0XHRcdGlmIChjb21wbGV0aW9uPy5zZW1hbnRpY0lkICE9PSBsYXN0SXRlbT8uc2VtYW50aWNJZCkge1xuXHRcdFx0XHRsYXN0SXRlbSA9IGNvbXBsZXRpb247XG5cdFx0XHRcdGlmIChjb21wbGV0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgaSA9IGNvbXBsZXRpb24uaW5saW5lQ29tcGxldGlvbjtcblx0XHRcdFx0XHRjb25zdCBzcmMgPSBpLnNvdXJjZTtcblx0XHRcdFx0XHRzcmMucHJvdmlkZXIuaGFuZGxlSXRlbURpZFNob3c/LihzcmMuaW5saW5lQ29tcGxldGlvbnMsIGkuc291cmNlSW5saW5lQ29tcGxldGlvbiwgaS5pbnNlcnRUZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGhhbmRsZSB0ZXh0IGVkaXRzIGNvbGxhcHNpbmcgKi9cblx0XHRcdGNvbnN0IGlubGluZUNvbXBsZXRpb25zID0gdGhpcy5fc291cmNlLmlubGluZUNvbXBsZXRpb25zLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghaW5saW5lQ29tcGxldGlvbnMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBpbmxpbmVDb21wbGV0aW9uIG9mIGlubGluZUNvbXBsZXRpb25zLmlubGluZUNvbXBsZXRpb25zKSB7XG5cdFx0XHRcdGlmIChpbmxpbmVDb21wbGV0aW9uLnVwZGF0ZWRFZGl0LnJlYWQocmVhZGVyKSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy5zdG9wKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHR0aGlzLl9lZGl0b3JPYnMudmVyc2lvbklkLnJlYWQocmVhZGVyKTtcblx0XHRcdHRoaXMuX2luQWNjZXB0Rmxvdy5zZXQoZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QganVtcFRvUmVzZXQgPSB0aGlzLnN0YXRlLm1hcChzID0+ICFzIHx8IHMua2luZCA9PT0gJ2lubGluZUVkaXQnICYmICFzLmN1cnNvckF0SW5saW5lRWRpdCkucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGp1bXBUb1Jlc2V0KSB7XG5cdFx0XHRcdHRoaXMuX2p1bXBlZFRvSWQuc2V0KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBpbmxpbmVFZGl0U2VtYW50aWNJZCA9IHRoaXMuaW5saW5lRWRpdFN0YXRlLm1hcChzID0+IHM/LmlubGluZUNvbXBsZXRpb24uc2VtYW50aWNJZCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBpZCA9IGlubGluZUVkaXRTZW1hbnRpY0lkLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChpZCkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0XHRcdHRoaXMuX2xhc3RTaG93bklubGluZUNvbXBsZXRpb25JbmZvID0ge1xuXHRcdFx0XHRcdGFsdGVybmF0ZVRleHRNb2RlbFZlcnNpb25JZDogdGhpcy50ZXh0TW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKSxcblx0XHRcdFx0XHRpbmxpbmVDb21wbGV0aW9uOiB0aGlzLnN0YXRlLmdldCgpIS5pbmxpbmVDb21wbGV0aW9uIS5pbmxpbmVDb21wbGV0aW9uLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2RpZFVuZG9JbmxpbmVFZGl0cy5yZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9zdG9yZSk7XG5cdH1cblxuXHRwcml2YXRlIF9sYXN0U2hvd25JbmxpbmVDb21wbGV0aW9uSW5mbzogeyBhbHRlcm5hdGVUZXh0TW9kZWxWZXJzaW9uSWQ6IG51bWJlcjsgLyogYWxyZWFkeSBmcmVlZCEgKi8gaW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbkl0ZW0gfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfbGFzdEFjY2VwdGVkSW5saW5lQ29tcGxldGlvbkluZm86IHsgdGV4dE1vZGVsVmVyc2lvbklkQWZ0ZXI6IG51bWJlcjsgLyogYWxyZWFkeSBmcmVlZCEgKi8gaW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbkl0ZW0gfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlkVW5kb0lubGluZUVkaXRzID0gZGVyaXZlZEhhbmRsZUNoYW5nZXMoe1xuXHRcdG93bmVyOiB0aGlzLFxuXHRcdGNyZWF0ZUVtcHR5Q2hhbmdlU3VtbWFyeTogKCkgPT4gKHsgZGlkVW5kbzogZmFsc2UgfSksXG5cdFx0aGFuZGxlQ2hhbmdlOiAoY3R4LCBjaGFuZ2VTdW1tYXJ5KSA9PiB7XG5cdFx0XHRjaGFuZ2VTdW1tYXJ5LmRpZFVuZG8gPSBjdHguZGlkQ2hhbmdlKHRoaXMuX3RleHRNb2RlbFZlcnNpb25JZCkgJiYgISFjdHguY2hhbmdlPy5pc1VuZG9pbmc7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH0sIChyZWFkZXIsIGNoYW5nZVN1bW1hcnkpID0+IHtcblx0XHRjb25zdCB2ZXJzaW9uSWQgPSB0aGlzLl90ZXh0TW9kZWxWZXJzaW9uSWQucmVhZChyZWFkZXIpO1xuXHRcdGlmICh2ZXJzaW9uSWQgIT09IG51bGxcblx0XHRcdCYmIHRoaXMuX2xhc3RBY2NlcHRlZElubGluZUNvbXBsZXRpb25JbmZvXG5cdFx0XHQmJiB0aGlzLl9sYXN0QWNjZXB0ZWRJbmxpbmVDb21wbGV0aW9uSW5mby50ZXh0TW9kZWxWZXJzaW9uSWRBZnRlciA9PT0gdmVyc2lvbklkIC0gMVxuXHRcdFx0JiYgdGhpcy5fbGFzdEFjY2VwdGVkSW5saW5lQ29tcGxldGlvbkluZm8uaW5saW5lQ29tcGxldGlvbi5pc0lubGluZUVkaXRcblx0XHRcdCYmIGNoYW5nZVN1bW1hcnkuZGlkVW5kb1xuXHRcdCkge1xuXHRcdFx0dGhpcy5fbGFzdEFjY2VwdGVkSW5saW5lQ29tcGxldGlvbkluZm8gPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9KTtcblxuXHRwdWJsaWMgZGVidWdHZXRTZWxlY3RlZFN1Z2dlc3RJdGVtKCk6IElPYnNlcnZhYmxlPFN1Z2dlc3RJdGVtSW5mbyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9zZWxlY3RlZFN1Z2dlc3RJdGVtO1xuXHR9XG5cblx0cHVibGljIGdldEluZGVudGF0aW9uSW5mbyhyZWFkZXI6IElSZWFkZXIpIHtcblx0XHRsZXQgc3RhcnRzV2l0aEluZGVudGF0aW9uID0gZmFsc2U7XG5cdFx0bGV0IHN0YXJ0c1dpdGhJbmRlbnRhdGlvbkxlc3NUaGFuVGFiU2l6ZSA9IHRydWU7XG5cdFx0Y29uc3QgZ2hvc3RUZXh0ID0gdGhpcz8ucHJpbWFyeUdob3N0VGV4dC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCEhdGhpcz8uX3NlbGVjdGVkU3VnZ2VzdEl0ZW0gJiYgZ2hvc3RUZXh0ICYmIGdob3N0VGV4dC5wYXJ0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCB7IGNvbHVtbiwgbGluZXMgfSA9IGdob3N0VGV4dC5wYXJ0c1swXTtcblxuXHRcdFx0Y29uc3QgZmlyc3RMaW5lID0gbGluZXNbMF0ubGluZTtcblxuXHRcdFx0Y29uc3QgaW5kZW50YXRpb25FbmRDb2x1bW4gPSB0aGlzLnRleHRNb2RlbC5nZXRMaW5lSW5kZW50Q29sdW1uKGdob3N0VGV4dC5saW5lTnVtYmVyKTtcblx0XHRcdGNvbnN0IGluSW5kZW50YXRpb24gPSBjb2x1bW4gPD0gaW5kZW50YXRpb25FbmRDb2x1bW47XG5cblx0XHRcdGlmIChpbkluZGVudGF0aW9uKSB7XG5cdFx0XHRcdGxldCBmaXJzdE5vbldzSWR4ID0gZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXgoZmlyc3RMaW5lKTtcblx0XHRcdFx0aWYgKGZpcnN0Tm9uV3NJZHggPT09IC0xKSB7XG5cdFx0XHRcdFx0Zmlyc3ROb25Xc0lkeCA9IGZpcnN0TGluZS5sZW5ndGggLSAxO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXJ0c1dpdGhJbmRlbnRhdGlvbiA9IGZpcnN0Tm9uV3NJZHggPiAwO1xuXG5cdFx0XHRcdGNvbnN0IHRhYlNpemUgPSB0aGlzLnRleHRNb2RlbC5nZXRPcHRpb25zKCkudGFiU2l6ZTtcblx0XHRcdFx0Y29uc3QgdmlzaWJsZUNvbHVtbkluZGVudGF0aW9uID0gQ3Vyc29yQ29sdW1ucy52aXNpYmxlQ29sdW1uRnJvbUNvbHVtbihmaXJzdExpbmUsIGZpcnN0Tm9uV3NJZHggKyAxLCB0YWJTaXplKTtcblx0XHRcdFx0c3RhcnRzV2l0aEluZGVudGF0aW9uTGVzc1RoYW5UYWJTaXplID0gdmlzaWJsZUNvbHVtbkluZGVudGF0aW9uIDwgdGFiU2l6ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0c1dpdGhJbmRlbnRhdGlvbixcblx0XHRcdHN0YXJ0c1dpdGhJbmRlbnRhdGlvbkxlc3NUaGFuVGFiU2l6ZSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJlc2VydmVDdXJyZW50Q29tcGxldGlvblJlYXNvbnMgPSBuZXcgU2V0KFtcblx0XHRWZXJzaW9uSWRDaGFuZ2VSZWFzb24uUmVkbyxcblx0XHRWZXJzaW9uSWRDaGFuZ2VSZWFzb24uVW5kbyxcblx0XHRWZXJzaW9uSWRDaGFuZ2VSZWFzb24uQWNjZXB0V29yZCxcblx0XSk7XG5cblx0cHJpdmF0ZSBfZ2V0UmVhc29uKGU6IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQgfCB1bmRlZmluZWQpOiBWZXJzaW9uSWRDaGFuZ2VSZWFzb24ge1xuXHRcdGlmIChlPy5pc1VuZG9pbmcpIHsgcmV0dXJuIFZlcnNpb25JZENoYW5nZVJlYXNvbi5VbmRvOyB9XG5cdFx0aWYgKGU/LmlzUmVkb2luZykgeyByZXR1cm4gVmVyc2lvbklkQ2hhbmdlUmVhc29uLlJlZG87IH1cblx0XHRpZiAodGhpcy5pc0FjY2VwdGluZ1BhcnRpYWxseSkgeyByZXR1cm4gVmVyc2lvbklkQ2hhbmdlUmVhc29uLkFjY2VwdFdvcmQ7IH1cblx0XHRyZXR1cm4gVmVyc2lvbklkQ2hhbmdlUmVhc29uLk90aGVyO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IGRvbnRSZWZldGNoU2lnbmFsID0gb2JzZXJ2YWJsZVNpZ25hbCh0aGlzKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9mZXRjaElubGluZUNvbXBsZXRpb25zUHJvbWlzZSA9IGRlcml2ZWRIYW5kbGVDaGFuZ2VzKHtcblx0XHRvd25lcjogdGhpcyxcblx0XHRjcmVhdGVFbXB0eUNoYW5nZVN1bW1hcnk6ICgpID0+ICh7XG5cdFx0XHRkb250UmVmZXRjaDogZmFsc2UsXG5cdFx0XHRwcmVzZXJ2ZUN1cnJlbnRDb21wbGV0aW9uOiBmYWxzZSxcblx0XHRcdGlubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZDogSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kLkF1dG9tYXRpYyxcblx0XHRcdG9ubHlSZXF1ZXN0SW5saW5lRWRpdHM6IGZhbHNlLFxuXHRcdFx0c2hvdWxkRGVib3VuY2U6IHRydWUsXG5cdFx0fSksXG5cdFx0aGFuZGxlQ2hhbmdlOiAoY3R4LCBjaGFuZ2VTdW1tYXJ5KSA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGZldGNoIGlubGluZSBjb21wbGV0aW9ucyAqL1xuXHRcdFx0aWYgKGN0eC5kaWRDaGFuZ2UodGhpcy5fdGV4dE1vZGVsVmVyc2lvbklkKSAmJiB0aGlzLl9wcmVzZXJ2ZUN1cnJlbnRDb21wbGV0aW9uUmVhc29ucy5oYXModGhpcy5fZ2V0UmVhc29uKGN0eC5jaGFuZ2UpKSkge1xuXHRcdFx0XHRjaGFuZ2VTdW1tYXJ5LnByZXNlcnZlQ3VycmVudENvbXBsZXRpb24gPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmIChjdHguZGlkQ2hhbmdlKHRoaXMuX2ZvcmNlVXBkYXRlRXhwbGljaXRseVNpZ25hbCkpIHtcblx0XHRcdFx0Y2hhbmdlU3VtbWFyeS5pbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQgPSBJbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQuRXhwbGljaXQ7XG5cdFx0XHR9IGVsc2UgaWYgKGN0eC5kaWRDaGFuZ2UodGhpcy5kb250UmVmZXRjaFNpZ25hbCkpIHtcblx0XHRcdFx0Y2hhbmdlU3VtbWFyeS5kb250UmVmZXRjaCA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKGN0eC5kaWRDaGFuZ2UodGhpcy5fb25seVJlcXVlc3RJbmxpbmVFZGl0c1NpZ25hbCkpIHtcblx0XHRcdFx0Y2hhbmdlU3VtbWFyeS5vbmx5UmVxdWVzdElubGluZUVkaXRzID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSBpZiAoY3R4LmRpZENoYW5nZSh0aGlzLl9ub0RlbGF5U2lnbmFsKSkge1xuXHRcdFx0XHRjaGFuZ2VTdW1tYXJ5LnNob3VsZERlYm91bmNlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9LFxuXHR9LCAocmVhZGVyLCBjaGFuZ2VTdW1tYXJ5KSA9PiB7XG5cdFx0dGhpcy5fc291cmNlLmNsZWFyT3BlcmF0aW9uT25UZXh0TW9kZWxDaGFuZ2UucmVhZChyZWFkZXIpOyAvLyBNYWtlIHN1cmUgdGhlIGNsZWFyIG9wZXJhdGlvbiBydW5zIGJlZm9yZSB0aGUgZmV0Y2ggb3BlcmF0aW9uXG5cdFx0dGhpcy5fbm9EZWxheVNpZ25hbC5yZWFkKHJlYWRlcik7XG5cdFx0dGhpcy5kb250UmVmZXRjaFNpZ25hbC5yZWFkKHJlYWRlcik7XG5cdFx0dGhpcy5fb25seVJlcXVlc3RJbmxpbmVFZGl0c1NpZ25hbC5yZWFkKHJlYWRlcik7XG5cdFx0dGhpcy5fZm9yY2VVcGRhdGVFeHBsaWNpdGx5U2lnbmFsLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBzaG91bGRVcGRhdGUgPSAodGhpcy5fZW5hYmxlZC5yZWFkKHJlYWRlcikgJiYgdGhpcy5fc2VsZWN0ZWRTdWdnZXN0SXRlbS5yZWFkKHJlYWRlcikpIHx8IHRoaXMuX2lzQWN0aXZlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXNob3VsZFVwZGF0ZSkge1xuXHRcdFx0dGhpcy5fc291cmNlLmNhbmNlbFVwZGF0ZSgpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLl90ZXh0TW9kZWxWZXJzaW9uSWQucmVhZChyZWFkZXIpOyAvLyBSZWZldGNoIG9uIHRleHQgY2hhbmdlXG5cblx0XHRjb25zdCBzdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnMgPSB0aGlzLl9zb3VyY2Uuc3VnZ2VzdFdpZGdldElubGluZUNvbXBsZXRpb25zLmdldCgpO1xuXHRcdGNvbnN0IHN1Z2dlc3RJdGVtID0gdGhpcy5fc2VsZWN0ZWRTdWdnZXN0SXRlbS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKHN1Z2dlc3RXaWRnZXRJbmxpbmVDb21wbGV0aW9ucyAmJiAhc3VnZ2VzdEl0ZW0pIHtcblx0XHRcdGNvbnN0IGlubGluZUNvbXBsZXRpb25zID0gdGhpcy5fc291cmNlLmlubGluZUNvbXBsZXRpb25zLmdldCgpO1xuXHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIFNlZWQgaW5saW5lIGNvbXBsZXRpb25zIHdpdGggKG5ld2VyKSBzdWdnZXN0IHdpZGdldCBpbmxpbmUgY29tcGxldGlvbnMgKi9cblx0XHRcdFx0aWYgKCFpbmxpbmVDb21wbGV0aW9ucyB8fCBzdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnMucmVxdWVzdC52ZXJzaW9uSWQgPiBpbmxpbmVDb21wbGV0aW9ucy5yZXF1ZXN0LnZlcnNpb25JZCkge1xuXHRcdFx0XHRcdHRoaXMuX3NvdXJjZS5pbmxpbmVDb21wbGV0aW9ucy5zZXQoc3VnZ2VzdFdpZGdldElubGluZUNvbXBsZXRpb25zLmNsb25lKCksIHR4KTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9zb3VyY2UuY2xlYXJTdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnModHgpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3Vyc29yUG9zaXRpb24gPSB0aGlzLnByaW1hcnlQb3NpdGlvbi5nZXQoKTtcblx0XHRpZiAoY2hhbmdlU3VtbWFyeS5kb250UmVmZXRjaCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZGlkVW5kb0lubGluZUVkaXRzLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHR0aGlzLl9zb3VyY2UuY2xlYXIodHgpO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGxldCBjb250ZXh0OiBJbmxpbmVDb21wbGV0aW9uQ29udGV4dCA9IHtcblx0XHRcdHRyaWdnZXJLaW5kOiBjaGFuZ2VTdW1tYXJ5LmlubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZCxcblx0XHRcdHNlbGVjdGVkU3VnZ2VzdGlvbkluZm86IHN1Z2dlc3RJdGVtPy50b1NlbGVjdGVkU3VnZ2VzdGlvbkluZm8oKSxcblx0XHRcdGluY2x1ZGVJbmxpbmVDb21wbGV0aW9uczogIWNoYW5nZVN1bW1hcnkub25seVJlcXVlc3RJbmxpbmVFZGl0cyxcblx0XHRcdGluY2x1ZGVJbmxpbmVFZGl0czogdGhpcy5faW5saW5lRWRpdHNFbmFibGVkLnJlYWQocmVhZGVyKSxcblx0XHR9O1xuXG5cdFx0aWYgKGNvbnRleHQudHJpZ2dlcktpbmQgPT09IElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZC5BdXRvbWF0aWMpIHtcblx0XHRcdGlmICh0aGlzLnRleHRNb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpID09PSB0aGlzLl9sYXN0U2hvd25JbmxpbmVDb21wbGV0aW9uSW5mbz8uYWx0ZXJuYXRlVGV4dE1vZGVsVmVyc2lvbklkKSB7XG5cdFx0XHRcdC8vIFdoZW4gdW5kb2luZyBiYWNrIHRvIGEgdmVyc2lvbiB3aGVyZSBhbiBpbmxpbmUgZWRpdC9jb21wbGV0aW9uIHdhcyBzaG93bixcblx0XHRcdFx0Ly8gd2Ugd2FudCB0byBzaG93IGFuIGlubGluZSBlZGl0IChvciBjb21wbGV0aW9uKSBhZ2FpbiBpZiBpdCB3YXMgb3JpZ2luYWxseSBhbiBpbmxpbmUgZWRpdCAob3IgY29tcGxldGlvbikuXG5cdFx0XHRcdGNvbnRleHQgPSB7XG5cdFx0XHRcdFx0Li4uY29udGV4dCxcblx0XHRcdFx0XHRpbmNsdWRlSW5saW5lQ29tcGxldGlvbnM6ICF0aGlzLl9sYXN0U2hvd25JbmxpbmVDb21wbGV0aW9uSW5mby5pbmxpbmVDb21wbGV0aW9uLmlzSW5saW5lRWRpdCxcblx0XHRcdFx0XHRpbmNsdWRlSW5saW5lRWRpdHM6IHRoaXMuX2xhc3RTaG93bklubGluZUNvbXBsZXRpb25JbmZvLmlubGluZUNvbXBsZXRpb24uaXNJbmxpbmVFZGl0LFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGl0ZW1Ub1ByZXNlcnZlQ2FuZGlkYXRlID0gdGhpcy5zZWxlY3RlZElubGluZUNvbXBsZXRpb24uZ2V0KCkgPz8gdGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW1zLmdldCgpPy5pbmxpbmVFZGl0O1xuXHRcdGNvbnN0IGl0ZW1Ub1ByZXNlcnZlID0gY2hhbmdlU3VtbWFyeS5wcmVzZXJ2ZUN1cnJlbnRDb21wbGV0aW9uIHx8IGl0ZW1Ub1ByZXNlcnZlQ2FuZGlkYXRlPy5mb3J3YXJkU3RhYmxlXG5cdFx0XHQ/IGl0ZW1Ub1ByZXNlcnZlQ2FuZGlkYXRlIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHVzZXJKdW1wZWRUb0FjdGl2ZUNvbXBsZXRpb24gPSB0aGlzLl9qdW1wZWRUb0lkLm1hcChqdW1wZWRUbyA9PiAhIWp1bXBlZFRvICYmIGp1bXBlZFRvID09PSB0aGlzLl9pbmxpbmVDb21wbGV0aW9uSXRlbXMuZ2V0KCk/LmlubGluZUVkaXQ/LnNlbWFudGljSWQpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX3NvdXJjZS5mZXRjaChjdXJzb3JQb3NpdGlvbiwgY29udGV4dCwgaXRlbVRvUHJlc2VydmUsIGNoYW5nZVN1bW1hcnkuc2hvdWxkRGVib3VuY2UsIHVzZXJKdW1wZWRUb0FjdGl2ZUNvbXBsZXRpb24pO1xuXHR9KTtcblxuXHRwdWJsaWMgYXN5bmMgdHJpZ2dlcih0eD86IElUcmFuc2FjdGlvbiwgb3B0aW9ucz86IHsgb25seUZldGNoSW5saW5lRWRpdHM/OiBib29sZWFuOyBub0RlbGF5PzogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0c3VidHJhbnNhY3Rpb24odHgsIHR4ID0+IHtcblx0XHRcdGlmIChvcHRpb25zPy5vbmx5RmV0Y2hJbmxpbmVFZGl0cykge1xuXHRcdFx0XHR0aGlzLl9vbmx5UmVxdWVzdElubGluZUVkaXRzU2lnbmFsLnRyaWdnZXIodHgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9wdGlvbnM/Lm5vRGVsYXkpIHtcblx0XHRcdFx0dGhpcy5fbm9EZWxheVNpZ25hbC50cmlnZ2VyKHR4KTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2lzQWN0aXZlLnNldCh0cnVlLCB0eCk7XG5cdFx0fSk7XG5cdFx0YXdhaXQgdGhpcy5fZmV0Y2hJbmxpbmVDb21wbGV0aW9uc1Byb21pc2UuZ2V0KCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgdHJpZ2dlckV4cGxpY2l0bHkodHg/OiBJVHJhbnNhY3Rpb24sIG9ubHlGZXRjaElubGluZUVkaXRzOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRzdWJ0cmFuc2FjdGlvbih0eCwgdHggPT4ge1xuXHRcdFx0aWYgKG9ubHlGZXRjaElubGluZUVkaXRzKSB7XG5cdFx0XHRcdHRoaXMuX29ubHlSZXF1ZXN0SW5saW5lRWRpdHNTaWduYWwudHJpZ2dlcih0eCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9pc0FjdGl2ZS5zZXQodHJ1ZSwgdHgpO1xuXHRcdFx0dGhpcy5faW5BY2NlcHRGbG93LnNldCh0cnVlLCB0eCk7XG5cdFx0XHR0aGlzLl9mb3JjZVVwZGF0ZUV4cGxpY2l0bHlTaWduYWwudHJpZ2dlcih0eCk7XG5cdFx0fSk7XG5cdFx0YXdhaXQgdGhpcy5fZmV0Y2hJbmxpbmVDb21wbGV0aW9uc1Byb21pc2UuZ2V0KCk7XG5cdH1cblxuXHRwdWJsaWMgc3RvcChzdG9wUmVhc29uOiAnZXhwbGljaXRDYW5jZWwnIHwgJ2F1dG9tYXRpYycgPSAnYXV0b21hdGljJywgdHg/OiBJVHJhbnNhY3Rpb24pOiB2b2lkIHtcblx0XHRzdWJ0cmFuc2FjdGlvbih0eCwgdHggPT4ge1xuXHRcdFx0aWYgKHN0b3BSZWFzb24gPT09ICdleHBsaWNpdENhbmNlbCcpIHtcblx0XHRcdFx0Y29uc3QgaW5saW5lQ29tcGxldGlvbiA9IHRoaXMuc3RhdGUuZ2V0KCk/LmlubGluZUNvbXBsZXRpb247XG5cdFx0XHRcdGNvbnN0IHNvdXJjZSA9IGlubGluZUNvbXBsZXRpb24/LnNvdXJjZTtcblx0XHRcdFx0Y29uc3Qgc291cmNlSW5saW5lQ29tcGxldGlvbiA9IGlubGluZUNvbXBsZXRpb24/LnNvdXJjZUlubGluZUNvbXBsZXRpb247XG5cdFx0XHRcdGlmIChzb3VyY2VJbmxpbmVDb21wbGV0aW9uICYmIHNvdXJjZT8ucHJvdmlkZXIuaGFuZGxlUmVqZWN0aW9uKSB7XG5cdFx0XHRcdFx0c291cmNlLnByb3ZpZGVyLmhhbmRsZVJlamVjdGlvbihzb3VyY2UuaW5saW5lQ29tcGxldGlvbnMsIHNvdXJjZUlubGluZUNvbXBsZXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2luQWNjZXB0UGFydGlhbEZsb3cuc2V0KGZhbHNlLCB0eCk7XG5cdFx0XHR0aGlzLl9pc0FjdGl2ZS5zZXQoZmFsc2UsIHR4KTtcblx0XHRcdHRoaXMuX3NvdXJjZS5jbGVhcih0eCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbmxpbmVDb21wbGV0aW9uSXRlbXMgPSBkZXJpdmVkT3B0cyh7IG93bmVyOiB0aGlzIH0sIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgYyA9IHRoaXMuX3NvdXJjZS5pbmxpbmVDb21wbGV0aW9ucy5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFjKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRjb25zdCBjdXJzb3JQb3NpdGlvbiA9IHRoaXMucHJpbWFyeVBvc2l0aW9uLnJlYWQocmVhZGVyKTtcblx0XHRsZXQgaW5saW5lRWRpdDogSW5saW5lQ29tcGxldGlvbldpdGhVcGRhdGVkUmFuZ2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgdmlzaWJsZUNvbXBsZXRpb25zOiBJbmxpbmVDb21wbGV0aW9uV2l0aFVwZGF0ZWRSYW5nZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBjb21wbGV0aW9uIG9mIGMuaW5saW5lQ29tcGxldGlvbnMpIHtcblx0XHRcdGlmICghY29tcGxldGlvbi5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLmlzSW5saW5lRWRpdCkge1xuXHRcdFx0XHRpZiAoY29tcGxldGlvbi5pc1Zpc2libGUodGhpcy50ZXh0TW9kZWwsIGN1cnNvclBvc2l0aW9uLCByZWFkZXIpKSB7XG5cdFx0XHRcdFx0dmlzaWJsZUNvbXBsZXRpb25zLnB1c2goY29tcGxldGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlubGluZUVkaXQgPSBjb21wbGV0aW9uO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh2aXNpYmxlQ29tcGxldGlvbnMubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHQvLyBEb24ndCBzaG93IHRoZSBpbmxpbmUgZWRpdCBpZiB0aGVyZSBpcyBhIHZpc2libGUgY29tcGxldGlvblxuXHRcdFx0aW5saW5lRWRpdCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5saW5lQ29tcGxldGlvbnM6IHZpc2libGVDb21wbGV0aW9ucyxcblx0XHRcdGlubGluZUVkaXQsXG5cdFx0fTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZmlsdGVyZWRJbmxpbmVDb21wbGV0aW9uSXRlbXMgPSBkZXJpdmVkT3B0cyh7IG93bmVyOiB0aGlzLCBlcXVhbHNGbjogaXRlbXNFcXVhbHMoKSB9LCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGMgPSB0aGlzLl9pbmxpbmVDb21wbGV0aW9uSXRlbXMucmVhZChyZWFkZXIpO1xuXHRcdHJldHVybiBjPy5pbmxpbmVDb21wbGV0aW9ucyA/PyBbXTtcblx0fSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHNlbGVjdGVkSW5saW5lQ29tcGxldGlvbkluZGV4ID0gZGVyaXZlZDxudW1iZXI+KHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHRjb25zdCBzZWxlY3RlZElubGluZUNvbXBsZXRpb25JZCA9IHRoaXMuX3NlbGVjdGVkSW5saW5lQ29tcGxldGlvbklkLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBmaWx0ZXJlZENvbXBsZXRpb25zID0gdGhpcy5fZmlsdGVyZWRJbmxpbmVDb21wbGV0aW9uSXRlbXMucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGlkeCA9IHRoaXMuX3NlbGVjdGVkSW5saW5lQ29tcGxldGlvbklkID09PSB1bmRlZmluZWQgPyAtMVxuXHRcdFx0OiBmaWx0ZXJlZENvbXBsZXRpb25zLmZpbmRJbmRleCh2ID0+IHYuc2VtYW50aWNJZCA9PT0gc2VsZWN0ZWRJbmxpbmVDb21wbGV0aW9uSWQpO1xuXHRcdGlmIChpZHggPT09IC0xKSB7XG5cdFx0XHQvLyBSZXNldCB0aGUgc2VsZWN0aW9uIHNvIHRoYXQgdGhlIHNlbGVjdGlvbiBkb2VzIG5vdCBqdW1wIGJhY2sgd2hlbiBpdCBhcHBlYXJzIGFnYWluXG5cdFx0XHR0aGlzLl9zZWxlY3RlZElubGluZUNvbXBsZXRpb25JZC5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdHJldHVybiBpZHg7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBzZWxlY3RlZElubGluZUNvbXBsZXRpb24gPSBkZXJpdmVkPElubGluZUNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlIHwgdW5kZWZpbmVkPih0aGlzLCAocmVhZGVyKSA9PiB7XG5cdFx0Y29uc3QgZmlsdGVyZWRDb21wbGV0aW9ucyA9IHRoaXMuX2ZpbHRlcmVkSW5saW5lQ29tcGxldGlvbkl0ZW1zLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBpZHggPSB0aGlzLnNlbGVjdGVkSW5saW5lQ29tcGxldGlvbkluZGV4LnJlYWQocmVhZGVyKTtcblx0XHRyZXR1cm4gZmlsdGVyZWRDb21wbGV0aW9uc1tpZHhdO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgYWN0aXZlQ29tbWFuZHMgPSBkZXJpdmVkT3B0czxDb21tYW5kW10+KHsgb3duZXI6IHRoaXMsIGVxdWFsc0ZuOiBpdGVtc0VxdWFscygpIH0sXG5cdFx0ciA9PiB0aGlzLnNlbGVjdGVkSW5saW5lQ29tcGxldGlvbi5yZWFkKHIpPy5zb3VyY2UuaW5saW5lQ29tcGxldGlvbnMuY29tbWFuZHMgPz8gW11cblx0KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgbGFzdFRyaWdnZXJLaW5kOiBJT2JzZXJ2YWJsZTxJbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQgfCB1bmRlZmluZWQ+XG5cdFx0PSB0aGlzLl9zb3VyY2UuaW5saW5lQ29tcGxldGlvbnMubWFwKHRoaXMsIHYgPT4gdj8ucmVxdWVzdC5jb250ZXh0LnRyaWdnZXJLaW5kKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaW5saW5lQ29tcGxldGlvbnNDb3VudCA9IGRlcml2ZWQ8bnVtYmVyIHwgdW5kZWZpbmVkPih0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGlmICh0aGlzLmxhc3RUcmlnZ2VyS2luZC5yZWFkKHJlYWRlcikgPT09IElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZC5FeHBsaWNpdCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZpbHRlcmVkSW5saW5lQ29tcGxldGlvbkl0ZW1zLnJlYWQocmVhZGVyKS5sZW5ndGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNWaXNpYmxlUGVla1dpZGdldHMgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB0aGlzLl9lZGl0b3JPYnMub3BlbmVkUGVla1dpZGdldHMucmVhZChyZWFkZXIpID4gMCk7XG5cblx0cHVibGljIHJlYWRvbmx5IHN0YXRlID0gZGVyaXZlZE9wdHM8e1xuXHRcdGtpbmQ6ICdnaG9zdFRleHQnO1xuXHRcdGVkaXRzOiByZWFkb25seSBTaW5nbGVUZXh0RWRpdFtdO1xuXHRcdHByaW1hcnlHaG9zdFRleHQ6IEdob3N0VGV4dE9yUmVwbGFjZW1lbnQ7XG5cdFx0Z2hvc3RUZXh0czogcmVhZG9ubHkgR2hvc3RUZXh0T3JSZXBsYWNlbWVudFtdO1xuXHRcdHN1Z2dlc3RJdGVtOiBTdWdnZXN0SXRlbUluZm8gfCB1bmRlZmluZWQ7XG5cdFx0aW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbldpdGhVcGRhdGVkUmFuZ2UgfCB1bmRlZmluZWQ7XG5cdH0gfCB7XG5cdFx0a2luZDogJ2lubGluZUVkaXQnO1xuXHRcdGVkaXRzOiByZWFkb25seSBTaW5nbGVUZXh0RWRpdFtdO1xuXHRcdGlubGluZUVkaXQ6IElubGluZUVkaXQ7XG5cdFx0aW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbldpdGhVcGRhdGVkUmFuZ2U7XG5cdFx0Y3Vyc29yQXRJbmxpbmVFZGl0OiBib29sZWFuO1xuXHR9IHwgdW5kZWZpbmVkPih7XG5cdFx0b3duZXI6IHRoaXMsXG5cdFx0ZXF1YWxzRm46IChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoIWEgfHwgIWIpIHsgcmV0dXJuIGEgPT09IGI7IH1cblxuXHRcdFx0aWYgKGEua2luZCA9PT0gJ2dob3N0VGV4dCcgJiYgYi5raW5kID09PSAnZ2hvc3RUZXh0Jykge1xuXHRcdFx0XHRyZXR1cm4gZ2hvc3RUZXh0c09yUmVwbGFjZW1lbnRzRXF1YWwoYS5naG9zdFRleHRzLCBiLmdob3N0VGV4dHMpXG5cdFx0XHRcdFx0JiYgYS5pbmxpbmVDb21wbGV0aW9uID09PSBiLmlubGluZUNvbXBsZXRpb25cblx0XHRcdFx0XHQmJiBhLnN1Z2dlc3RJdGVtID09PSBiLnN1Z2dlc3RJdGVtO1xuXHRcdFx0fSBlbHNlIGlmIChhLmtpbmQgPT09ICdpbmxpbmVFZGl0JyAmJiBiLmtpbmQgPT09ICdpbmxpbmVFZGl0Jykge1xuXHRcdFx0XHRyZXR1cm4gYS5pbmxpbmVFZGl0LmVxdWFscyhiLmlubGluZUVkaXQpICYmIGEuY3Vyc29yQXRJbmxpbmVFZGl0ID09PSBiLmN1cnNvckF0SW5saW5lRWRpdDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH0sIChyZWFkZXIpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMudGV4dE1vZGVsO1xuXG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtcy5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgaW5saW5lRWRpdFJlc3VsdCA9IGl0ZW0/LmlubGluZUVkaXQ7XG5cdFx0aWYgKGlubGluZUVkaXRSZXN1bHQpIHtcblx0XHRcdGlmICh0aGlzLl9oYXNWaXNpYmxlUGVla1dpZGdldHMucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRsZXQgZWRpdCA9IGlubGluZUVkaXRSZXN1bHQudG9TaW5nbGVUZXh0RWRpdChyZWFkZXIpO1xuXHRcdFx0ZWRpdCA9IHNpbmdsZVRleHRSZW1vdmVDb21tb25QcmVmaXgoZWRpdCwgbW9kZWwpO1xuXG5cdFx0XHRjb25zdCBjdXJzb3JQb3MgPSB0aGlzLnByaW1hcnlQb3NpdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBjdXJzb3JBdElubGluZUVkaXQgPSBMaW5lUmFuZ2UuZnJvbVJhbmdlSW5jbHVzaXZlKGVkaXQucmFuZ2UpLmFkZE1hcmdpbigxLCAxKS5jb250YWlucyhjdXJzb3JQb3MubGluZU51bWJlcik7XG5cdFx0XHRjb25zdCBjdXJzb3JJbnNpZGVTaG93UmFuZ2UgPSBjdXJzb3JBdElubGluZUVkaXQgfHwgKGlubGluZUVkaXRSZXN1bHQuaW5saW5lQ29tcGxldGlvbi5jdXJzb3JTaG93UmFuZ2U/LmNvbnRhaW5zUG9zaXRpb24oY3Vyc29yUG9zKSA/PyB0cnVlKTtcblxuXHRcdFx0aWYgKCFjdXJzb3JJbnNpZGVTaG93UmFuZ2UgJiYgIXRoaXMuX2luQWNjZXB0Rmxvdy5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29tbWFuZHMgPSBpbmxpbmVFZGl0UmVzdWx0LmlubGluZUNvbXBsZXRpb24uc291cmNlLmlubGluZUNvbXBsZXRpb25zLmNvbW1hbmRzO1xuXHRcdFx0Y29uc3QgaW5saW5lRWRpdCA9IG5ldyBJbmxpbmVFZGl0KGVkaXQsIGNvbW1hbmRzID8/IFtdLCBpbmxpbmVFZGl0UmVzdWx0LmlubGluZUNvbXBsZXRpb24pO1xuXG5cdFx0XHRjb25zdCBlZGl0cyA9IGlubGluZUVkaXRSZXN1bHQudXBkYXRlZEVkaXQucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgZSA9IGVkaXRzID8gVGV4dEVkaXQuZnJvbU9mZnNldEVkaXQoZWRpdHMsIG5ldyBUZXh0TW9kZWxUZXh0KHRoaXMudGV4dE1vZGVsKSkuZWRpdHMgOiBbZWRpdF07XG5cblx0XHRcdHJldHVybiB7IGtpbmQ6ICdpbmxpbmVFZGl0JywgaW5saW5lRWRpdCwgaW5saW5lQ29tcGxldGlvbjogaW5saW5lRWRpdFJlc3VsdCwgZWRpdHM6IGUsIGN1cnNvckF0SW5saW5lRWRpdCB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHN1Z2dlc3RJdGVtID0gdGhpcy5fc2VsZWN0ZWRTdWdnZXN0SXRlbS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKHN1Z2dlc3RJdGVtKSB7XG5cdFx0XHRjb25zdCBzdWdnZXN0Q29tcGxldGlvbkVkaXQgPSBzaW5nbGVUZXh0UmVtb3ZlQ29tbW9uUHJlZml4KHN1Z2dlc3RJdGVtLnRvU2luZ2xlVGV4dEVkaXQoKSwgbW9kZWwpO1xuXHRcdFx0Y29uc3QgYXVnbWVudGF0aW9uID0gdGhpcy5fY29tcHV0ZUF1Z21lbnRhdGlvbihzdWdnZXN0Q29tcGxldGlvbkVkaXQsIHJlYWRlcik7XG5cblx0XHRcdGNvbnN0IGlzU3VnZ2VzdGlvblByZXZpZXdFbmFibGVkID0gdGhpcy5fc3VnZ2VzdFByZXZpZXdFbmFibGVkLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghaXNTdWdnZXN0aW9uUHJldmlld0VuYWJsZWQgJiYgIWF1Z21lbnRhdGlvbikgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0XHRcdGNvbnN0IGZ1bGxFZGl0ID0gYXVnbWVudGF0aW9uPy5lZGl0ID8/IHN1Z2dlc3RDb21wbGV0aW9uRWRpdDtcblx0XHRcdGNvbnN0IGZ1bGxFZGl0UHJldmlld0xlbmd0aCA9IGF1Z21lbnRhdGlvbiA/IGF1Z21lbnRhdGlvbi5lZGl0LnRleHQubGVuZ3RoIC0gc3VnZ2VzdENvbXBsZXRpb25FZGl0LnRleHQubGVuZ3RoIDogMDtcblxuXHRcdFx0Y29uc3QgbW9kZSA9IHRoaXMuX3N1Z2dlc3RQcmV2aWV3TW9kZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBwb3NpdGlvbnMgPSB0aGlzLl9wb3NpdGlvbnMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgZWRpdHMgPSBbZnVsbEVkaXQsIC4uLmdldFNlY29uZGFyeUVkaXRzKHRoaXMudGV4dE1vZGVsLCBwb3NpdGlvbnMsIGZ1bGxFZGl0KV07XG5cdFx0XHRjb25zdCBnaG9zdFRleHRzID0gZWRpdHNcblx0XHRcdFx0Lm1hcCgoZWRpdCwgaWR4KSA9PiBjb21wdXRlR2hvc3RUZXh0KGVkaXQsIG1vZGVsLCBtb2RlLCBwb3NpdGlvbnNbaWR4XSwgZnVsbEVkaXRQcmV2aWV3TGVuZ3RoKSlcblx0XHRcdFx0LmZpbHRlcihpc0RlZmluZWQpO1xuXHRcdFx0Y29uc3QgcHJpbWFyeUdob3N0VGV4dCA9IGdob3N0VGV4dHNbMF0gPz8gbmV3IEdob3N0VGV4dChmdWxsRWRpdC5yYW5nZS5lbmRMaW5lTnVtYmVyLCBbXSk7XG5cdFx0XHRyZXR1cm4geyBraW5kOiAnZ2hvc3RUZXh0JywgZWRpdHMsIHByaW1hcnlHaG9zdFRleHQsIGdob3N0VGV4dHMsIGlubGluZUNvbXBsZXRpb246IGF1Z21lbnRhdGlvbj8uY29tcGxldGlvbiwgc3VnZ2VzdEl0ZW0gfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKCF0aGlzLl9pc0FjdGl2ZS5yZWFkKHJlYWRlcikpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdFx0Y29uc3QgaW5saW5lQ29tcGxldGlvbiA9IHRoaXMuc2VsZWN0ZWRJbmxpbmVDb21wbGV0aW9uLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghaW5saW5lQ29tcGxldGlvbikgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0XHRcdGNvbnN0IHJlcGxhY2VtZW50ID0gaW5saW5lQ29tcGxldGlvbi50b1NpbmdsZVRleHRFZGl0KHJlYWRlcik7XG5cdFx0XHRjb25zdCBtb2RlID0gdGhpcy5faW5saW5lU3VnZ2VzdE1vZGUucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgcG9zaXRpb25zID0gdGhpcy5fcG9zaXRpb25zLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGVkaXRzID0gW3JlcGxhY2VtZW50LCAuLi5nZXRTZWNvbmRhcnlFZGl0cyh0aGlzLnRleHRNb2RlbCwgcG9zaXRpb25zLCByZXBsYWNlbWVudCldO1xuXHRcdFx0Y29uc3QgZ2hvc3RUZXh0cyA9IGVkaXRzXG5cdFx0XHRcdC5tYXAoKGVkaXQsIGlkeCkgPT4gY29tcHV0ZUdob3N0VGV4dChlZGl0LCBtb2RlbCwgbW9kZSwgcG9zaXRpb25zW2lkeF0sIDApKVxuXHRcdFx0XHQuZmlsdGVyKGlzRGVmaW5lZCk7XG5cdFx0XHRpZiAoIWdob3N0VGV4dHNbMF0pIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdFx0cmV0dXJuIHsga2luZDogJ2dob3N0VGV4dCcsIGVkaXRzLCBwcmltYXJ5R2hvc3RUZXh0OiBnaG9zdFRleHRzWzBdLCBnaG9zdFRleHRzLCBpbmxpbmVDb21wbGV0aW9uLCBzdWdnZXN0SXRlbTogdW5kZWZpbmVkIH07XG5cdFx0fVxuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgc3RhdHVzID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGlmICh0aGlzLl9zb3VyY2UubG9hZGluZy5yZWFkKHJlYWRlcikpIHsgcmV0dXJuICdsb2FkaW5nJzsgfVxuXHRcdGNvbnN0IHMgPSB0aGlzLnN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAocz8ua2luZCA9PT0gJ2dob3N0VGV4dCcpIHsgcmV0dXJuICdnaG9zdFRleHQnOyB9XG5cdFx0aWYgKHM/LmtpbmQgPT09ICdpbmxpbmVFZGl0JykgeyByZXR1cm4gJ2lubGluZUVkaXQnOyB9XG5cdFx0cmV0dXJuICdub1N1Z2dlc3Rpb24nO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaW5saW5lQ29tcGxldGlvblN0YXRlID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHMgPSB0aGlzLnN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXMgfHwgcy5raW5kICE9PSAnZ2hvc3RUZXh0Jykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2VkaXRvck9icy5pbkNvbXBvc2l0aW9uLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHM7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBpbmxpbmVFZGl0U3RhdGUgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgcyA9IHRoaXMuc3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdGlmICghcyB8fCBzLmtpbmQgIT09ICdpbmxpbmVFZGl0Jykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHM7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBpbmxpbmVFZGl0QXZhaWxhYmxlID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHMgPSB0aGlzLmlubGluZUVkaXRTdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0cmV0dXJuICEhcztcblx0fSk7XG5cblx0cHJpdmF0ZSBfY29tcHV0ZUF1Z21lbnRhdGlvbihzdWdnZXN0Q29tcGxldGlvbjogU2luZ2xlVGV4dEVkaXQsIHJlYWRlcjogSVJlYWRlciB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy50ZXh0TW9kZWw7XG5cdFx0Y29uc3Qgc3VnZ2VzdFdpZGdldElubGluZUNvbXBsZXRpb25zID0gdGhpcy5fc291cmNlLnN1Z2dlc3RXaWRnZXRJbmxpbmVDb21wbGV0aW9ucy5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgY2FuZGlkYXRlSW5saW5lQ29tcGxldGlvbnMgPSBzdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnNcblx0XHRcdD8gc3VnZ2VzdFdpZGdldElubGluZUNvbXBsZXRpb25zLmlubGluZUNvbXBsZXRpb25zXG5cdFx0XHQ6IFt0aGlzLnNlbGVjdGVkSW5saW5lQ29tcGxldGlvbi5yZWFkKHJlYWRlcildLmZpbHRlcihpc0RlZmluZWQpO1xuXG5cdFx0Y29uc3QgYXVnbWVudGVkQ29tcGxldGlvbiA9IG1hcEZpbmRGaXJzdChjYW5kaWRhdGVJbmxpbmVDb21wbGV0aW9ucywgY29tcGxldGlvbiA9PiB7XG5cdFx0XHRsZXQgciA9IGNvbXBsZXRpb24udG9TaW5nbGVUZXh0RWRpdChyZWFkZXIpO1xuXHRcdFx0ciA9IHNpbmdsZVRleHRSZW1vdmVDb21tb25QcmVmaXgoXG5cdFx0XHRcdHIsXG5cdFx0XHRcdG1vZGVsLFxuXHRcdFx0XHRSYW5nZS5mcm9tUG9zaXRpb25zKHIucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpLCBzdWdnZXN0Q29tcGxldGlvbi5yYW5nZS5nZXRFbmRQb3NpdGlvbigpKVxuXHRcdFx0KTtcblx0XHRcdHJldHVybiBzaW5nbGVUZXh0RWRpdEF1Z21lbnRzKHIsIHN1Z2dlc3RDb21wbGV0aW9uKSA/IHsgY29tcGxldGlvbiwgZWRpdDogciB9IDogdW5kZWZpbmVkO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGF1Z21lbnRlZENvbXBsZXRpb247XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgd2FybmluZyA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRyZXR1cm4gdGhpcy5pbmxpbmVDb21wbGV0aW9uU3RhdGUucmVhZChyZWFkZXIpPy5pbmxpbmVDb21wbGV0aW9uPy5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLndhcm5pbmc7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBnaG9zdFRleHRzID0gZGVyaXZlZE9wdHMoeyBvd25lcjogdGhpcywgZXF1YWxzRm46IGdob3N0VGV4dHNPclJlcGxhY2VtZW50c0VxdWFsIH0sIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgdiA9IHRoaXMuaW5saW5lQ29tcGxldGlvblN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXYpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB2Lmdob3N0VGV4dHM7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBwcmltYXJ5R2hvc3RUZXh0ID0gZGVyaXZlZE9wdHMoeyBvd25lcjogdGhpcywgZXF1YWxzRm46IGdob3N0VGV4dE9yUmVwbGFjZW1lbnRFcXVhbHMgfSwgcmVhZGVyID0+IHtcblx0XHRjb25zdCB2ID0gdGhpcy5pbmxpbmVDb21wbGV0aW9uU3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdGlmICghdikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHY/LnByaW1hcnlHaG9zdFRleHQ7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBzaG93Q29sbGFwc2VkID0gZGVyaXZlZDxib29sZWFuPih0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFzdGF0ZSB8fCBzdGF0ZS5raW5kICE9PSAnaW5saW5lRWRpdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBpc0N1cnJlbnRNb2RlbFZlcnNpb24gPSBzdGF0ZS5pbmxpbmVDb21wbGV0aW9uLnVwZGF0ZWRFZGl0TW9kZWxWZXJzaW9uID09PSB0aGlzLl90ZXh0TW9kZWxWZXJzaW9uSWQucmVhZChyZWFkZXIpO1xuXHRcdHJldHVybiAodGhpcy5faW5saW5lRWRpdHNTaG93Q29sbGFwc2VkRW5hYmxlZC5yZWFkKHJlYWRlcikgfHwgIWlzQ3VycmVudE1vZGVsVmVyc2lvbilcblx0XHRcdCYmIHRoaXMuX2p1bXBlZFRvSWQucmVhZChyZWFkZXIpICE9PSBzdGF0ZS5pbmxpbmVDb21wbGV0aW9uLnNlbWFudGljSWRcblx0XHRcdCYmICF0aGlzLl9pbkFjY2VwdEZsb3cucmVhZChyZWFkZXIpO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF90YWJTaG91bGRJbmRlbnQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0aWYgKHRoaXMuX2luQWNjZXB0Rmxvdy5yZWFkKHJlYWRlcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpc011bHRpTGluZShyYW5nZTogUmFuZ2UpOiBib29sZWFuIHtcblx0XHRcdHJldHVybiByYW5nZS5zdGFydExpbmVOdW1iZXIgIT09IHJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Tm9uSW5kZW50YXRpb25SYW5nZShtb2RlbDogSVRleHRNb2RlbCwgbGluZU51bWJlcjogbnVtYmVyKTogUmFuZ2Uge1xuXHRcdFx0Y29uc3QgY29sdW1uU3RhcnQgPSBtb2RlbC5nZXRMaW5lSW5kZW50Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0Y29uc3QgbGFzdE5vbldzQ29sdW1uID0gbW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0Y29uc3QgY29sdW1uRW5kID0gTWF0aC5tYXgobGFzdE5vbldzQ29sdW1uLCBjb2x1bW5TdGFydCk7XG5cdFx0XHRyZXR1cm4gbmV3IFJhbmdlKGxpbmVOdW1iZXIsIGNvbHVtblN0YXJ0LCBsaW5lTnVtYmVyLCBjb2x1bW5FbmQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9lZGl0b3JPYnMuc2VsZWN0aW9ucy5yZWFkKHJlYWRlcik7XG5cdFx0cmV0dXJuIHNlbGVjdGlvbnM/LnNvbWUocyA9PiB7XG5cdFx0XHRpZiAocy5pc0VtcHR5KCkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudGV4dE1vZGVsLmdldExpbmVMZW5ndGgocy5zdGFydExpbmVOdW1iZXIpID09PSAwO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGlzTXVsdGlMaW5lKHMpIHx8IHMuY29udGFpbnNSYW5nZShnZXROb25JbmRlbnRhdGlvblJhbmdlKHRoaXMudGV4dE1vZGVsLCBzLnN0YXJ0TGluZU51bWJlcikpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgdGFiU2hvdWxkSnVtcFRvSW5saW5lRWRpdCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRpZiAodGhpcy5fdGFiU2hvdWxkSW5kZW50LnJlYWQocmVhZGVyKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHMgPSB0aGlzLmlubGluZUVkaXRTdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2hvd0NvbGxhcHNlZC5yZWFkKHJlYWRlcikpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhcy5jdXJzb3JBdElubGluZUVkaXQ7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSB0YWJTaG91bGRBY2NlcHRJbmxpbmVFZGl0ID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHMgPSB0aGlzLmlubGluZUVkaXRTdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnNob3dDb2xsYXBzZWQucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChzLmlubGluZUVkaXQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSB0aGlzLl9lZGl0b3JPYnMuY3Vyc29yTGluZU51bWJlci5yZWFkKHJlYWRlcikpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fanVtcGVkVG9JZC5yZWFkKHJlYWRlcikgPT09IHMuaW5saW5lQ29tcGxldGlvbi5zZW1hbnRpY0lkKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3RhYlNob3VsZEluZGVudC5yZWFkKHJlYWRlcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcy5jdXJzb3JBdElubGluZUVkaXQ7XG5cdH0pO1xuXG5cdHByaXZhdGUgYXN5bmMgX2RlbHRhU2VsZWN0ZWRJbmxpbmVDb21wbGV0aW9uSW5kZXgoZGVsdGE6IDEgfCAtMSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMudHJpZ2dlckV4cGxpY2l0bHkoKTtcblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gdGhpcy5fZmlsdGVyZWRJbmxpbmVDb21wbGV0aW9uSXRlbXMuZ2V0KCkgfHwgW107XG5cdFx0aWYgKGNvbXBsZXRpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IG5ld0lkeCA9ICh0aGlzLnNlbGVjdGVkSW5saW5lQ29tcGxldGlvbkluZGV4LmdldCgpICsgZGVsdGEgKyBjb21wbGV0aW9ucy5sZW5ndGgpICUgY29tcGxldGlvbnMubGVuZ3RoO1xuXHRcdFx0dGhpcy5fc2VsZWN0ZWRJbmxpbmVDb21wbGV0aW9uSWQuc2V0KGNvbXBsZXRpb25zW25ld0lkeF0uc2VtYW50aWNJZCwgdW5kZWZpbmVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2VsZWN0ZWRJbmxpbmVDb21wbGV0aW9uSWQuc2V0KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgbmV4dCgpOiBQcm9taXNlPHZvaWQ+IHsgYXdhaXQgdGhpcy5fZGVsdGFTZWxlY3RlZElubGluZUNvbXBsZXRpb25JbmRleCgxKTsgfVxuXG5cdHB1YmxpYyBhc3luYyBwcmV2aW91cygpOiBQcm9taXNlPHZvaWQ+IHsgYXdhaXQgdGhpcy5fZGVsdGFTZWxlY3RlZElubGluZUNvbXBsZXRpb25JbmRleCgtMSk7IH1cblxuXHRwdWJsaWMgYXN5bmMgYWNjZXB0KGVkaXRvcjogSUNvZGVFZGl0b3IgPSB0aGlzLl9lZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoZWRpdG9yLmdldE1vZGVsKCkgIT09IHRoaXMudGV4dE1vZGVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2luQWNjZXB0UGFydGlhbEZsb3cuZ2V0KCkpIHtcblx0XHRcdHRoaXMuX2luQWNjZXB0UGFydGlhbEZsb3cuc2V0KGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5qdW1wKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlOiBJbmxpbmVDb21wbGV0aW9uV2l0aFVwZGF0ZWRSYW5nZTtcblxuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZS5nZXQoKTtcblx0XHRpZiAoc3RhdGU/LmtpbmQgPT09ICdnaG9zdFRleHQnKSB7XG5cdFx0XHRpZiAoIXN0YXRlIHx8IHN0YXRlLnByaW1hcnlHaG9zdFRleHQuaXNFbXB0eSgpIHx8ICFzdGF0ZS5pbmxpbmVDb21wbGV0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlID0gc3RhdGUuaW5saW5lQ29tcGxldGlvbjtcblx0XHR9IGVsc2UgaWYgKHN0YXRlPy5raW5kID09PSAnaW5saW5lRWRpdCcpIHtcblx0XHRcdGNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlID0gc3RhdGUuaW5saW5lQ29tcGxldGlvbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbXBsZXRpb24gPSBjb21wbGV0aW9uV2l0aFVwZGF0ZWRSYW5nZS50b0lubGluZUNvbXBsZXRpb24odW5kZWZpbmVkKTtcblxuXHRcdGlmIChjb21wbGV0aW9uLmNvbW1hbmQpIHtcblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGUgY29tcGxldGlvbiBsaXN0IHdpbGwgbm90IGJlIGRpc3Bvc2VkLlxuXHRcdFx0Y29tcGxldGlvbi5zb3VyY2UuYWRkUmVmKCk7XG5cdFx0fVxuXG5cdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdGlmIChjb21wbGV0aW9uLnNuaXBwZXRJbmZvKSB7XG5cdFx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKFxuXHRcdFx0XHQnaW5saW5lU3VnZ2VzdGlvbi5hY2NlcHQnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0RWRpdE9wZXJhdGlvbi5yZXBsYWNlKGNvbXBsZXRpb24ucmFuZ2UsICcnKSxcblx0XHRcdFx0XHQuLi5jb21wbGV0aW9uLmFkZGl0aW9uYWxUZXh0RWRpdHNcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihjb21wbGV0aW9uLnNuaXBwZXRJbmZvLnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSwgJ2lubGluZUNvbXBsZXRpb25BY2NlcHQnKTtcblx0XHRcdFNuaXBwZXRDb250cm9sbGVyMi5nZXQoZWRpdG9yKT8uaW5zZXJ0KGNvbXBsZXRpb24uc25pcHBldEluZm8uc25pcHBldCwgeyB1bmRvU3RvcEJlZm9yZTogZmFsc2UgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGVkaXRzID0gc3RhdGUuZWRpdHM7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gZ2V0RW5kUG9zaXRpb25zQWZ0ZXJBcHBseWluZyhlZGl0cykubWFwKHAgPT4gU2VsZWN0aW9uLmZyb21Qb3NpdGlvbnMocCkpO1xuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVFZGl0cygnaW5saW5lU3VnZ2VzdGlvbi5hY2NlcHQnLCBbXG5cdFx0XHRcdC4uLmVkaXRzLm1hcChlZGl0ID0+IEVkaXRPcGVyYXRpb24ucmVwbGFjZShlZGl0LnJhbmdlLCBlZGl0LnRleHQpKSxcblx0XHRcdFx0Li4uY29tcGxldGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzXG5cdFx0XHRdKTtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKHN0YXRlLmtpbmQgPT09ICdpbmxpbmVFZGl0JyA/IHNlbGVjdGlvbnMuc2xpY2UoLTEpIDogc2VsZWN0aW9ucywgJ2lubGluZUNvbXBsZXRpb25BY2NlcHQnKTtcblxuXHRcdFx0aWYgKHN0YXRlLmtpbmQgPT09ICdpbmxpbmVFZGl0JyAmJiAhdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNNb3Rpb25SZWR1Y2VkKCkpIHtcblx0XHRcdFx0Ly8gd2UgY2FuIGFzc3VtZSB0aGF0IGVkaXRzIGlzIHNvcnRlZCFcblx0XHRcdFx0Y29uc3QgZWRpdFJhbmdlcyA9IG5ldyBUZXh0RWRpdChlZGl0cykuZ2V0TmV3UmFuZ2VzKCk7XG5cdFx0XHRcdGNvbnN0IGRlYyA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRmFkZW91dERlY29yYXRpb24oZWRpdG9yLCBlZGl0UmFuZ2VzLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fc3RvcmUuZGVsZXRlKGRlYyk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZEFjY2VwdC5maXJlKCk7XG5cblx0XHQvLyBSZXNldCBiZWZvcmUgaW52b2tpbmcgdGhlIGNvbW1hbmQsIGFzIHRoZSBjb21tYW5kIG1pZ2h0IGNhdXNlIGEgZm9sbG93IHVwIHRyaWdnZXIgKHdoaWNoIHdlIGRvbid0IHdhbnQgdG8gcmVzZXQpLlxuXHRcdHRoaXMuc3RvcCgpO1xuXG5cdFx0aWYgKGNvbXBsZXRpb24uY29tbWFuZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5fY29tbWFuZFNlcnZpY2Vcblx0XHRcdFx0LmV4ZWN1dGVDb21tYW5kKGNvbXBsZXRpb24uY29tbWFuZC5pZCwgLi4uKGNvbXBsZXRpb24uY29tbWFuZC5hcmd1bWVudHMgfHwgW10pKVxuXHRcdFx0XHQudGhlbih1bmRlZmluZWQsIG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IpO1xuXHRcdFx0Y29tcGxldGlvbi5zb3VyY2UucmVtb3ZlUmVmKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faW5BY2NlcHRGbG93LnNldCh0cnVlLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMuX2xhc3RBY2NlcHRlZElubGluZUNvbXBsZXRpb25JbmZvID0geyB0ZXh0TW9kZWxWZXJzaW9uSWRBZnRlcjogdGhpcy50ZXh0TW9kZWwuZ2V0VmVyc2lvbklkKCksIGlubGluZUNvbXBsZXRpb246IGNvbXBsZXRpb24gfTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBhY2NlcHROZXh0V29yZChlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fYWNjZXB0TmV4dChlZGl0b3IsIChwb3MsIHRleHQpID0+IHtcblx0XHRcdGNvbnN0IGxhbmdJZCA9IHRoaXMudGV4dE1vZGVsLmdldExhbmd1YWdlSWRBdFBvc2l0aW9uKHBvcy5saW5lTnVtYmVyLCBwb3MuY29sdW1uKTtcblx0XHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxhbmdJZCk7XG5cdFx0XHRjb25zdCB3b3JkUmVnRXhwID0gbmV3IFJlZ0V4cChjb25maWcud29yZERlZmluaXRpb24uc291cmNlLCBjb25maWcud29yZERlZmluaXRpb24uZmxhZ3MucmVwbGFjZSgnZycsICcnKSk7XG5cblx0XHRcdGNvbnN0IG0xID0gdGV4dC5tYXRjaCh3b3JkUmVnRXhwKTtcblx0XHRcdGxldCBhY2NlcHRVbnRpbEluZGV4RXhjbHVzaXZlID0gMDtcblx0XHRcdGlmIChtMSAmJiBtMS5pbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGlmIChtMS5pbmRleCA9PT0gMCkge1xuXHRcdFx0XHRcdGFjY2VwdFVudGlsSW5kZXhFeGNsdXNpdmUgPSBtMVswXS5sZW5ndGg7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWNjZXB0VW50aWxJbmRleEV4Y2x1c2l2ZSA9IG0xLmluZGV4O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhY2NlcHRVbnRpbEluZGV4RXhjbHVzaXZlID0gdGV4dC5sZW5ndGg7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHdzUmVnRXhwID0gL1xccysvZztcblx0XHRcdGNvbnN0IG0yID0gd3NSZWdFeHAuZXhlYyh0ZXh0KTtcblx0XHRcdGlmIChtMiAmJiBtMi5pbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGlmIChtMi5pbmRleCArIG0yWzBdLmxlbmd0aCA8IGFjY2VwdFVudGlsSW5kZXhFeGNsdXNpdmUpIHtcblx0XHRcdFx0XHRhY2NlcHRVbnRpbEluZGV4RXhjbHVzaXZlID0gbTIuaW5kZXggKyBtMlswXS5sZW5ndGg7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBhY2NlcHRVbnRpbEluZGV4RXhjbHVzaXZlO1xuXHRcdH0sIFBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZC5Xb3JkKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBhY2NlcHROZXh0TGluZShlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fYWNjZXB0TmV4dChlZGl0b3IsIChwb3MsIHRleHQpID0+IHtcblx0XHRcdGNvbnN0IG0gPSB0ZXh0Lm1hdGNoKC9cXG4vKTtcblx0XHRcdGlmIChtICYmIG0uaW5kZXggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXR1cm4gbS5pbmRleCArIDE7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGV4dC5sZW5ndGg7XG5cdFx0fSwgUGFydGlhbEFjY2VwdFRyaWdnZXJLaW5kLkxpbmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYWNjZXB0TmV4dChlZGl0b3I6IElDb2RlRWRpdG9yLCBnZXRBY2NlcHRVbnRpbEluZGV4OiAocG9zaXRpb246IFBvc2l0aW9uLCB0ZXh0OiBzdHJpbmcpID0+IG51bWJlciwga2luZDogUGFydGlhbEFjY2VwdFRyaWdnZXJLaW5kKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGVkaXRvci5nZXRNb2RlbCgpICE9PSB0aGlzLnRleHRNb2RlbCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5pbmxpbmVDb21wbGV0aW9uU3RhdGUuZ2V0KCk7XG5cdFx0aWYgKCFzdGF0ZSB8fCBzdGF0ZS5wcmltYXJ5R2hvc3RUZXh0LmlzRW1wdHkoKSB8fCAhc3RhdGUuaW5saW5lQ29tcGxldGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBnaG9zdFRleHQgPSBzdGF0ZS5wcmltYXJ5R2hvc3RUZXh0O1xuXHRcdGNvbnN0IGNvbXBsZXRpb24gPSBzdGF0ZS5pbmxpbmVDb21wbGV0aW9uLnRvSW5saW5lQ29tcGxldGlvbih1bmRlZmluZWQpO1xuXG5cdFx0aWYgKGNvbXBsZXRpb24uc25pcHBldEluZm8gfHwgY29tcGxldGlvbi5maWx0ZXJUZXh0ICE9PSBjb21wbGV0aW9uLmluc2VydFRleHQpIHtcblx0XHRcdC8vIG5vdCBpbiBXWVNJV1lHIG1vZGUsIHBhcnRpYWwgY29tbWl0IG1pZ2h0IGNoYW5nZSBjb21wbGV0aW9uLCB0aHVzIGl0IGlzIG5vdCBzdXBwb3J0ZWRcblx0XHRcdGF3YWl0IHRoaXMuYWNjZXB0KGVkaXRvcik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlyc3RQYXJ0ID0gZ2hvc3RUZXh0LnBhcnRzWzBdO1xuXHRcdGNvbnN0IGdob3N0VGV4dFBvcyA9IG5ldyBQb3NpdGlvbihnaG9zdFRleHQubGluZU51bWJlciwgZmlyc3RQYXJ0LmNvbHVtbik7XG5cdFx0Y29uc3QgZ2hvc3RUZXh0VmFsID0gZmlyc3RQYXJ0LnRleHQ7XG5cdFx0Y29uc3QgYWNjZXB0VW50aWxJbmRleEV4Y2x1c2l2ZSA9IGdldEFjY2VwdFVudGlsSW5kZXgoZ2hvc3RUZXh0UG9zLCBnaG9zdFRleHRWYWwpO1xuXHRcdGlmIChhY2NlcHRVbnRpbEluZGV4RXhjbHVzaXZlID09PSBnaG9zdFRleHRWYWwubGVuZ3RoICYmIGdob3N0VGV4dC5wYXJ0cy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHRoaXMuYWNjZXB0KGVkaXRvcik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHBhcnRpYWxHaG9zdFRleHRWYWwgPSBnaG9zdFRleHRWYWwuc3Vic3RyaW5nKDAsIGFjY2VwdFVudGlsSW5kZXhFeGNsdXNpdmUpO1xuXG5cdFx0Y29uc3QgcG9zaXRpb25zID0gdGhpcy5fcG9zaXRpb25zLmdldCgpO1xuXHRcdGNvbnN0IGN1cnNvclBvc2l0aW9uID0gcG9zaXRpb25zWzBdO1xuXG5cdFx0Ly8gRXhlY3V0aW5nIHRoZSBlZGl0IG1pZ2h0IGZyZWUgdGhlIGNvbXBsZXRpb24sIHNvIHdlIGhhdmUgdG8gaG9sZCBhIHJlZmVyZW5jZSBvbiBpdC5cblx0XHRjb21wbGV0aW9uLnNvdXJjZS5hZGRSZWYoKTtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5faXNBY2NlcHRpbmdQYXJ0aWFsbHkgPSB0cnVlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0XHRjb25zdCByZXBsYWNlUmFuZ2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKGN1cnNvclBvc2l0aW9uLCBnaG9zdFRleHRQb3MpO1xuXHRcdFx0XHRjb25zdCBuZXdUZXh0ID0gZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlSW5SYW5nZShyZXBsYWNlUmFuZ2UpICsgcGFydGlhbEdob3N0VGV4dFZhbDtcblx0XHRcdFx0Y29uc3QgcHJpbWFyeUVkaXQgPSBuZXcgU2luZ2xlVGV4dEVkaXQocmVwbGFjZVJhbmdlLCBuZXdUZXh0KTtcblx0XHRcdFx0Y29uc3QgZWRpdHMgPSBbcHJpbWFyeUVkaXQsIC4uLmdldFNlY29uZGFyeUVkaXRzKHRoaXMudGV4dE1vZGVsLCBwb3NpdGlvbnMsIHByaW1hcnlFZGl0KV07XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBnZXRFbmRQb3NpdGlvbnNBZnRlckFwcGx5aW5nKGVkaXRzKS5tYXAocCA9PiBTZWxlY3Rpb24uZnJvbVBvc2l0aW9ucyhwKSk7XG5cdFx0XHRcdGVkaXRvci5leGVjdXRlRWRpdHMoJ2lubGluZVN1Z2dlc3Rpb24uYWNjZXB0JywgZWRpdHMubWFwKGVkaXQgPT4gRWRpdE9wZXJhdGlvbi5yZXBsYWNlKGVkaXQucmFuZ2UsIGVkaXQudGV4dCkpKTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoc2VsZWN0aW9ucywgJ2lubGluZUNvbXBsZXRpb25QYXJ0aWFsQWNjZXB0Jyk7XG5cdFx0XHRcdGVkaXRvci5yZXZlYWxQb3NpdGlvbkluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQoZWRpdG9yLmdldFBvc2l0aW9uKCkhLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9pc0FjY2VwdGluZ1BhcnRpYWxseSA9IGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29tcGxldGlvbi5zb3VyY2UucHJvdmlkZXIuaGFuZGxlUGFydGlhbEFjY2VwdCkge1xuXHRcdFx0XHRjb25zdCBhY2NlcHRlZFJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhjb21wbGV0aW9uLnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSwgVGV4dExlbmd0aC5vZlRleHQocGFydGlhbEdob3N0VGV4dFZhbCkuYWRkVG9Qb3NpdGlvbihnaG9zdFRleHRQb3MpKTtcblx0XHRcdFx0Ly8gVGhpcyBhc3N1bWVzIHRoYXQgdGhlIGlubGluZSBjb21wbGV0aW9uIGFuZCB0aGUgbW9kZWwgdXNlIHRoZSBzYW1lIEVPTCBzdHlsZS5cblx0XHRcdFx0Y29uc3QgdGV4dCA9IGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZUluUmFuZ2UoYWNjZXB0ZWRSYW5nZSwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRik7XG5cdFx0XHRcdGNvbnN0IGFjY2VwdGVkTGVuZ3RoID0gdGV4dC5sZW5ndGg7XG5cdFx0XHRcdGNvbXBsZXRpb24uc291cmNlLnByb3ZpZGVyLmhhbmRsZVBhcnRpYWxBY2NlcHQoXG5cdFx0XHRcdFx0Y29tcGxldGlvbi5zb3VyY2UuaW5saW5lQ29tcGxldGlvbnMsXG5cdFx0XHRcdFx0Y29tcGxldGlvbi5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLFxuXHRcdFx0XHRcdGFjY2VwdGVkTGVuZ3RoLFxuXHRcdFx0XHRcdHsga2luZCwgYWNjZXB0ZWRMZW5ndGg6IGFjY2VwdGVkTGVuZ3RoLCB9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNvbXBsZXRpb24uc291cmNlLnJlbW92ZVJlZigpO1xuXHRcdH1cblx0fVxuXG5cdC8vIFRPRE86IGNsZWFuIHRoaXMgdXAgaWYgd2Uga2VlcCBpdFxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbkFjY2VwdFBhcnRpYWxGbG93ID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIGZhbHNlKTtcblx0cHVibGljIHJlYWRvbmx5IGluUGFydGlhbEFjY2VwdEZsb3c6IElPYnNlcnZhYmxlPGJvb2xlYW4+ID0gdGhpcy5faW5BY2NlcHRQYXJ0aWFsRmxvdztcblx0cHVibGljIGFzeW5jIGFjY2VwdE5leHRJbmxpbmVFZGl0UGFydChlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGVkaXRvci5nZXRNb2RlbCgpICE9PSB0aGlzLnRleHRNb2RlbCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5pbmxpbmVFZGl0U3RhdGUuZ2V0KCk7XG5cdFx0Y29uc3QgdXBkYXRlZEVkaXQgPSBzdGF0ZT8uaW5saW5lQ29tcGxldGlvbi51cGRhdGVkRWRpdC5nZXQoKTtcblx0XHRjb25zdCBjb21wbGV0aW9uID0gc3RhdGU/LmlubGluZUNvbXBsZXRpb24udG9JbmxpbmVDb21wbGV0aW9uKHVuZGVmaW5lZCk7XG5cdFx0aWYgKCF1cGRhdGVkRWRpdCB8fCB1cGRhdGVkRWRpdC5pc0VtcHR5IHx8ICFjb21wbGV0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV4dFBhcnQgPSB1cGRhdGVkRWRpdC5lZGl0c1swXTtcblxuXHRcdGNvbnN0IGVkaXQgPSBuZXcgU2luZ2xlVGV4dEVkaXQoUmFuZ2UuZnJvbVBvc2l0aW9ucyhcblx0XHRcdHRoaXMudGV4dE1vZGVsLmdldFBvc2l0aW9uQXQobmV4dFBhcnQucmVwbGFjZVJhbmdlLnN0YXJ0KSxcblx0XHRcdHRoaXMudGV4dE1vZGVsLmdldFBvc2l0aW9uQXQobmV4dFBhcnQucmVwbGFjZVJhbmdlLmVuZEV4Y2x1c2l2ZSlcblx0XHQpLCBuZXh0UGFydC5uZXdUZXh0KTtcblxuXHRcdGNvbnN0IGN1cnNvckF0U3RhcnRQb3NpdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKT8uZ2V0U3RhcnRQb3NpdGlvbigpLmVxdWFscyhlZGl0LnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0aWYgKCFjdXJzb3JBdFN0YXJ0UG9zaXRpb24gfHwgIXRoaXMuX2luQWNjZXB0UGFydGlhbEZsb3cuZ2V0KCkpIHtcblx0XHRcdHRoaXMuX2luQWNjZXB0UGFydGlhbEZsb3cuc2V0KHRydWUsIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLmp1bXAoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJ0VG9KdW1wVG9OZXh0ID0gdXBkYXRlZEVkaXQuZWRpdHNbMV0gPz8gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGVkaXRUb0p1bXBUb05leHQgPSBwYXJ0VG9KdW1wVG9OZXh0ID8gbmV3IFNpbmdsZVRleHRFZGl0KFJhbmdlLmZyb21Qb3NpdGlvbnMoXG5cdFx0XHR0aGlzLnRleHRNb2RlbC5nZXRQb3NpdGlvbkF0KHBhcnRUb0p1bXBUb05leHQucmVwbGFjZVJhbmdlLnN0YXJ0KSxcblx0XHRcdHRoaXMudGV4dE1vZGVsLmdldFBvc2l0aW9uQXQocGFydFRvSnVtcFRvTmV4dC5yZXBsYWNlUmFuZ2UuZW5kRXhjbHVzaXZlKVxuXHRcdCksIHBhcnRUb0p1bXBUb05leHQubmV3VGV4dCkgOiB1bmRlZmluZWQ7XG5cblx0XHQvLyBFeGVjdXRpbmcgdGhlIGVkaXQgbWlnaHQgZnJlZSB0aGUgY29tcGxldGlvbiwgc28gd2UgaGF2ZSB0byBob2xkIGEgcmVmZXJlbmNlIG9uIGl0LlxuXHRcdGNvbXBsZXRpb24uc291cmNlLmFkZFJlZigpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9pc0FjY2VwdGluZ1BhcnRpYWxseSA9IHRydWU7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cblx0XHRcdFx0bGV0IHNlbGVjdGlvbnM7XG5cdFx0XHRcdGlmIChlZGl0VG9KdW1wVG9OZXh0KSB7XG5cdFx0XHRcdFx0Y29uc3QgW18sIHJhbmdlT2ZFZGl0VG9KdW1wVG9dID0gZ2V0TW9kaWZpZWRSYW5nZXNBZnRlckFwcGx5aW5nKFtlZGl0LCBlZGl0VG9KdW1wVG9OZXh0XSk7XG5cdFx0XHRcdFx0c2VsZWN0aW9ucyA9IFtTZWxlY3Rpb24uZnJvbVBvc2l0aW9ucyhyYW5nZU9mRWRpdFRvSnVtcFRvLmdldFN0YXJ0UG9zaXRpb24oKSldO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNlbGVjdGlvbnMgPSBnZXRFbmRQb3NpdGlvbnNBZnRlckFwcGx5aW5nKFtlZGl0XSkubWFwKHAgPT4gU2VsZWN0aW9uLmZyb21Qb3NpdGlvbnMocCkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZWRpdHMgPSBbZWRpdF07XG5cdFx0XHRcdGVkaXRvci5leGVjdXRlRWRpdHMoJ2lubGluZVN1Z2dlc3Rpb24uYWNjZXB0JywgZWRpdHMubWFwKGVkaXQgPT4gRWRpdE9wZXJhdGlvbi5yZXBsYWNlKGVkaXQucmFuZ2UsIGVkaXQudGV4dCkpKTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoc2VsZWN0aW9ucywgJ2lubGluZUNvbXBsZXRpb25QYXJ0aWFsQWNjZXB0Jyk7XG5cdFx0XHRcdGVkaXRvci5yZXZlYWxQb3NpdGlvbkluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQoZWRpdG9yLmdldFBvc2l0aW9uKCkhLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9pc0FjY2VwdGluZ1BhcnRpYWxseSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRjb21wbGV0aW9uLnNvdXJjZS5yZW1vdmVSZWYoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlU3VnZ2VzdEFjY2VwdGVkKGl0ZW06IFN1Z2dlc3RJdGVtSW5mbykge1xuXHRcdGNvbnN0IGl0ZW1FZGl0ID0gc2luZ2xlVGV4dFJlbW92ZUNvbW1vblByZWZpeChpdGVtLnRvU2luZ2xlVGV4dEVkaXQoKSwgdGhpcy50ZXh0TW9kZWwpO1xuXHRcdGNvbnN0IGF1Z21lbnRlZENvbXBsZXRpb24gPSB0aGlzLl9jb21wdXRlQXVnbWVudGF0aW9uKGl0ZW1FZGl0LCB1bmRlZmluZWQpO1xuXHRcdGlmICghYXVnbWVudGVkQ29tcGxldGlvbikgeyByZXR1cm47IH1cblxuXHRcdGNvbnN0IHNvdXJjZSA9IGF1Z21lbnRlZENvbXBsZXRpb24uY29tcGxldGlvbi5zb3VyY2U7XG5cdFx0Y29uc3Qgc291cmNlSW5saW5lQ29tcGxldGlvbiA9IGF1Z21lbnRlZENvbXBsZXRpb24uY29tcGxldGlvbi5zb3VyY2VJbmxpbmVDb21wbGV0aW9uO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbiA9IGF1Z21lbnRlZENvbXBsZXRpb24uY29tcGxldGlvbi50b0lubGluZUNvbXBsZXRpb24odW5kZWZpbmVkKTtcblx0XHQvLyBUaGlzIGFzc3VtZXMgdGhhdCB0aGUgaW5saW5lIGNvbXBsZXRpb24gYW5kIHRoZSBtb2RlbCB1c2UgdGhlIHNhbWUgRU9MIHN0eWxlLlxuXHRcdGNvbnN0IGFscmVhZHlBY2NlcHRlZExlbmd0aCA9IHRoaXMudGV4dE1vZGVsLmdldFZhbHVlSW5SYW5nZShjb21wbGV0aW9uLnJhbmdlLCBFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKS5sZW5ndGg7XG5cdFx0Y29uc3QgYWNjZXB0ZWRMZW5ndGggPSBhbHJlYWR5QWNjZXB0ZWRMZW5ndGggKyBpdGVtRWRpdC50ZXh0Lmxlbmd0aDtcblxuXHRcdHNvdXJjZS5wcm92aWRlci5oYW5kbGVQYXJ0aWFsQWNjZXB0Py4oXG5cdFx0XHRzb3VyY2UuaW5saW5lQ29tcGxldGlvbnMsXG5cdFx0XHRzb3VyY2VJbmxpbmVDb21wbGV0aW9uLFxuXHRcdFx0aXRlbUVkaXQudGV4dC5sZW5ndGgsXG5cdFx0XHR7XG5cdFx0XHRcdGtpbmQ6IFBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZC5TdWdnZXN0LFxuXHRcdFx0XHRhY2NlcHRlZExlbmd0aCxcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIGV4dHJhY3RSZXByb1NhbXBsZSgpOiBSZXBybyB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLnRleHRNb2RlbC5nZXRWYWx1ZSgpO1xuXHRcdGNvbnN0IGl0ZW0gPSB0aGlzLnN0YXRlLmdldCgpPy5pbmxpbmVDb21wbGV0aW9uPy50b0lubGluZUNvbXBsZXRpb24odW5kZWZpbmVkKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZG9jdW1lbnRWYWx1ZTogdmFsdWUsXG5cdFx0XHRpbmxpbmVDb21wbGV0aW9uOiBpdGVtPy5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9qdW1wZWRUb0lkID0gb2JzZXJ2YWJsZVZhbHVlPHVuZGVmaW5lZCB8IHN0cmluZz4odGhpcywgdW5kZWZpbmVkKTtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5BY2NlcHRGbG93ID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIGZhbHNlKTtcblx0cHVibGljIHJlYWRvbmx5IGluQWNjZXB0RmxvdzogSU9ic2VydmFibGU8Ym9vbGVhbj4gPSB0aGlzLl9pbkFjY2VwdEZsb3c7XG5cblx0cHVibGljIGp1bXAoKTogdm9pZCB7XG5cdFx0Y29uc3QgcyA9IHRoaXMuaW5saW5lRWRpdFN0YXRlLmdldCgpO1xuXHRcdGlmICghcykgeyByZXR1cm47IH1cblxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMuX2p1bXBlZFRvSWQuc2V0KHMuaW5saW5lQ29tcGxldGlvbi5zZW1hbnRpY0lkLCB0eCk7XG5cdFx0XHR0aGlzLmRvbnRSZWZldGNoU2lnbmFsLnRyaWdnZXIodHgpO1xuXHRcdFx0Y29uc3QgZWRpdCA9IHMuaW5saW5lQ29tcGxldGlvbi50b1NpbmdsZVRleHRFZGl0KHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9lZGl0b3Iuc2V0UG9zaXRpb24oZWRpdC5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCksICdpbmxpbmVDb21wbGV0aW9ucy5qdW1wJyk7XG5cblx0XHRcdC8vIFRPRE86IGNvbnNpZGVyIHVzaW5nIHZpZXcgaW5mb3JtYXRpb24gdG8gcmV2ZWFsIGl0XG5cdFx0XHRjb25zdCBpc1NpbmdsZUxpbmVDaGFuZ2UgPSBlZGl0LnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gZWRpdC5yYW5nZS5lbmRMaW5lTnVtYmVyICYmICFlZGl0LnRleHQuaW5jbHVkZXMoJ1xcbicpO1xuXHRcdFx0aWYgKGlzU2luZ2xlTGluZUNoYW5nZSkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IucmV2ZWFsUG9zaXRpb24oZWRpdC5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcmV2ZWFsUmFuZ2UgPSBuZXcgUmFuZ2UoZWRpdC5yYW5nZS5zdGFydExpbmVOdW1iZXIgLSAxLCAxLCBlZGl0LnJhbmdlLmVuZExpbmVOdW1iZXIgKyAxLCAxKTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLnJldmVhbFJhbmdlKHJldmVhbFJhbmdlLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGhhbmRsZUlubGluZUVkaXRTaG93bihpbmxpbmVDb21wbGV0aW9uOiBJbmxpbmVDb21wbGV0aW9uSXRlbSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChpbmxpbmVDb21wbGV0aW9uLmRpZFNob3cpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aW5saW5lQ29tcGxldGlvbi5tYXJrQXNTaG93bigpO1xuXG5cdFx0aW5saW5lQ29tcGxldGlvbi5zb3VyY2UucHJvdmlkZXIuaGFuZGxlSXRlbURpZFNob3c/LihpbmxpbmVDb21wbGV0aW9uLnNvdXJjZS5pbmxpbmVDb21wbGV0aW9ucywgaW5saW5lQ29tcGxldGlvbi5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLCBpbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQpO1xuXG5cdFx0aWYgKGlubGluZUNvbXBsZXRpb24uc2hvd25Db21tYW5kKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChpbmxpbmVDb21wbGV0aW9uLnNob3duQ29tbWFuZC5pZCwgLi4uKGlubGluZUNvbXBsZXRpb24uc2hvd25Db21tYW5kLmFyZ3VtZW50cyB8fCBbXSkpO1xuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgUmVwcm8ge1xuXHRkb2N1bWVudFZhbHVlOiBzdHJpbmc7XG5cdGlubGluZUNvbXBsZXRpb246IElubGluZUNvbXBsZXRpb24gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBlbnVtIFZlcnNpb25JZENoYW5nZVJlYXNvbiB7XG5cdFVuZG8sXG5cdFJlZG8sXG5cdEFjY2VwdFdvcmQsXG5cdE90aGVyLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2Vjb25kYXJ5RWRpdHModGV4dE1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbnM6IHJlYWRvbmx5IFBvc2l0aW9uW10sIHByaW1hcnlFZGl0OiBTaW5nbGVUZXh0RWRpdCk6IFNpbmdsZVRleHRFZGl0W10ge1xuXHRpZiAocG9zaXRpb25zLmxlbmd0aCA9PT0gMSkge1xuXHRcdC8vIE5vIHNlY29uZGFyeSBjdXJzb3IgcG9zaXRpb25zXG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdGNvbnN0IHByaW1hcnlQb3NpdGlvbiA9IHBvc2l0aW9uc1swXTtcblx0Y29uc3Qgc2Vjb25kYXJ5UG9zaXRpb25zID0gcG9zaXRpb25zLnNsaWNlKDEpO1xuXHRjb25zdCBwcmltYXJ5RWRpdFN0YXJ0UG9zaXRpb24gPSBwcmltYXJ5RWRpdC5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdGNvbnN0IHByaW1hcnlFZGl0RW5kUG9zaXRpb24gPSBwcmltYXJ5RWRpdC5yYW5nZS5nZXRFbmRQb3NpdGlvbigpO1xuXHRjb25zdCByZXBsYWNlZFRleHRBZnRlclByaW1hcnlDdXJzb3IgPSB0ZXh0TW9kZWwuZ2V0VmFsdWVJblJhbmdlKFxuXHRcdFJhbmdlLmZyb21Qb3NpdGlvbnMocHJpbWFyeVBvc2l0aW9uLCBwcmltYXJ5RWRpdEVuZFBvc2l0aW9uKVxuXHQpO1xuXHRjb25zdCBwb3NpdGlvbldpdGhpblRleHRFZGl0ID0gc3VidHJhY3RQb3NpdGlvbnMocHJpbWFyeVBvc2l0aW9uLCBwcmltYXJ5RWRpdFN0YXJ0UG9zaXRpb24pO1xuXHRpZiAocG9zaXRpb25XaXRoaW5UZXh0RWRpdC5saW5lTnVtYmVyIDwgMSkge1xuXHRcdG9uVW5leHBlY3RlZEVycm9yKG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoXG5cdFx0XHRgcG9zaXRpb25XaXRoaW5UZXh0RWRpdCBsaW5lIG51bWJlciBzaG91bGQgYmUgYmlnZ2VyIHRoYW4gMC5cblx0XHRcdEludmFsaWQgc3VidHJhY3Rpb24gYmV0d2VlbiAke3ByaW1hcnlQb3NpdGlvbi50b1N0cmluZygpfSBhbmQgJHtwcmltYXJ5RWRpdFN0YXJ0UG9zaXRpb24udG9TdHJpbmcoKX1gXG5cdFx0KSk7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdGNvbnN0IHNlY29uZGFyeUVkaXRUZXh0ID0gc3Vic3RyaW5nUG9zKHByaW1hcnlFZGl0LnRleHQsIHBvc2l0aW9uV2l0aGluVGV4dEVkaXQpO1xuXHRyZXR1cm4gc2Vjb25kYXJ5UG9zaXRpb25zLm1hcChwb3MgPT4ge1xuXHRcdGNvbnN0IHBvc0VuZCA9IGFkZFBvc2l0aW9ucyhzdWJ0cmFjdFBvc2l0aW9ucyhwb3MsIHByaW1hcnlFZGl0U3RhcnRQb3NpdGlvbiksIHByaW1hcnlFZGl0RW5kUG9zaXRpb24pO1xuXHRcdGNvbnN0IHRleHRBZnRlclNlY29uZGFyeUN1cnNvciA9IHRleHRNb2RlbC5nZXRWYWx1ZUluUmFuZ2UoXG5cdFx0XHRSYW5nZS5mcm9tUG9zaXRpb25zKHBvcywgcG9zRW5kKVxuXHRcdCk7XG5cdFx0Y29uc3QgbCA9IGNvbW1vblByZWZpeExlbmd0aChyZXBsYWNlZFRleHRBZnRlclByaW1hcnlDdXJzb3IsIHRleHRBZnRlclNlY29uZGFyeUN1cnNvcik7XG5cdFx0Y29uc3QgcmFuZ2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKHBvcywgcG9zLmRlbHRhKDAsIGwpKTtcblx0XHRyZXR1cm4gbmV3IFNpbmdsZVRleHRFZGl0KHJhbmdlLCBzZWNvbmRhcnlFZGl0VGV4dCk7XG5cdH0pO1xufVxuXG5jbGFzcyBGYWRlb3V0RGVjb3JhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHJhbmdlczogUmFuZ2VbXSxcblx0XHRvbkRpc3Bvc2U/OiAoKSA9PiB2b2lkLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKG9uRGlzcG9zZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoeyBkaXNwb3NlOiAoKSA9PiBvbkRpc3Bvc2UoKSB9KTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihvYnNlcnZhYmxlQ29kZUVkaXRvcihlZGl0b3IpLnNldERlY29yYXRpb25zKGNvbnN0T2JzZXJ2YWJsZShyYW5nZXMubWFwPElNb2RlbERlbHRhRGVjb3JhdGlvbj4ocmFuZ2UgPT4gKHtcblx0XHRcdHJhbmdlOiByYW5nZSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdhbmltYXRpb24nLFxuXHRcdFx0XHRjbGFzc05hbWU6ICdlZGl0cy1mYWRlb3V0LWRlY29yYXRpb24nLFxuXHRcdFx0XHR6SW5kZXg6IDEsXG5cdFx0XHR9XG5cdFx0fSkpKSkpO1xuXG5cdFx0Y29uc3QgYW5pbWF0aW9uID0gbmV3IEFuaW1hdGVkVmFsdWUoMSwgMCwgMTAwMCwgZWFzZU91dEN1YmljKTtcblx0XHRjb25zdCB2YWwgPSBuZXcgT2JzZXJ2YWJsZUFuaW1hdGVkVmFsdWUoYW5pbWF0aW9uKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IG9wYWNpdHkgPSB2YWwuZ2V0VmFsdWUocmVhZGVyKTtcblx0XHRcdGVkaXRvci5nZXRDb250YWluZXJEb21Ob2RlKCkuc3R5bGUuc2V0UHJvcGVydHkoJy0tYW5pbWF0aW9uLW9wYWNpdHknLCBvcGFjaXR5LnRvU3RyaW5nKCkpO1xuXHRcdFx0aWYgKGFuaW1hdGlvbi5pc0ZpbmlzaGVkKCkpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsb0JBQW9CLG1CQUFtQixpQ0FBaUM7QUFDakYsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQW9FLFNBQVMsaUJBQWlCLFNBQVMsc0JBQXNCLGFBQWEsa0JBQWtCLGlCQUFpQiwrQkFBK0IsZ0JBQWdCLG1CQUFtQjtBQUMvTyxTQUFTLG9CQUFvQiwrQkFBK0I7QUFDNUQsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0JBQWdCLGdCQUFnQjtBQUN6QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGtCQUFrQjtBQUMzQixTQUE2RCw2QkFBNkIsZ0NBQWdDO0FBQzFILFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsMkJBQThEO0FBQ3ZFLFNBQVMscUJBQXFCO0FBRzlCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsY0FBYyw4QkFBOEIsZ0NB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
