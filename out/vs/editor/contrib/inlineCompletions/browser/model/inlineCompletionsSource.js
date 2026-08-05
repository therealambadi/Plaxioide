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
import { compareUndefinedSmallest, numberComparator } from "../../../../../base/common/arrays.js";
import { findLastMax } from "../../../../../base/common/arraysFind.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { equalsIfDefined, itemEquals } from "../../../../../base/common/equals.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { matchesSubString } from "../../../../../base/common/filters.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { derived, derivedHandleChanges, disposableObservableValue, observableValue, transaction } from "../../../../../base/common/observable.js";
import { commonPrefixLength, commonSuffixLength, splitLines } from "../../../../../base/common/strings.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { applyEditsToRanges, OffsetEdit, SingleOffsetEdit } from "../../../../common/core/offsetEdit.js";
import { OffsetRange } from "../../../../common/core/offsetRange.js";
import { Range } from "../../../../common/core/range.js";
import { SingleTextEdit, StringText } from "../../../../common/core/textEdit.js";
import { TextLength } from "../../../../common/core/textLength.js";
import { linesDiffComputers } from "../../../../common/diff/linesDiffComputers.js";
import { InlineCompletionTriggerKind } from "../../../../common/languages.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { EndOfLinePreference } from "../../../../common/model.js";
import { OffsetEdits } from "../../../../common/model/textModelOffsetEdit.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { provideInlineCompletions } from "./provideInlineCompletions.js";
import { singleTextRemoveCommonPrefix } from "./singleTextEditHelpers.js";
import { StructuredLogger, formatRecordableLogEntry } from "../structuredLogger.js";
let InlineCompletionsSource = class extends Disposable {
  constructor(_textModel, _versionId, _debounceValue, _languageFeaturesService, _languageConfigurationService, _logService, _configurationService, _instantiationService) {
    super();
    this._textModel = _textModel;
    this._versionId = _versionId;
    this._debounceValue = _debounceValue;
    this._languageFeaturesService = _languageFeaturesService;
    this._languageConfigurationService = _languageConfigurationService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._updateOperation = this._register(new MutableDisposable());
    this.inlineCompletions = this._register(disposableObservableValue("inlineCompletions", void 0));
    this.suggestWidgetInlineCompletions = this._register(disposableObservableValue("suggestWidgetInlineCompletions", void 0));
    this._loggingEnabled = observableConfigValue("editor.inlineSuggest.logFetch", false, this._configurationService).recomputeInitiallyAndOnChange(this._store);
    this._structuredFetchLogger = this._register(this._instantiationService.createInstance(
      StructuredLogger.cast(),
      "editor.inlineSuggest.logFetch.commandId"
    ));
    this.clearOperationOnTextModelChange = derived(this, (reader) => {
      this._versionId.read(reader);
      this._updateOperation.clear();
      return void 0;
    });
    this._loadingCount = observableValue(this, 0);
    this.loading = this._loadingCount.map(this, (v) => v > 0);
    this.clearOperationOnTextModelChange.recomputeInitiallyAndOnChange(this._store);
  }
  _log(entry) {
    if (this._loggingEnabled.get()) {
      this._logService.info(formatRecordableLogEntry(entry));
    }
    this._structuredFetchLogger.log(entry);
  }
  fetch(position, context, activeInlineCompletion, withDebounce, userJumpedToActiveCompletion) {
    const request = new UpdateRequest(position, context, this._textModel.getVersionId());
    const target = context.selectedSuggestionInfo ? this.suggestWidgetInlineCompletions : this.inlineCompletions;
    if (this._updateOperation.value?.request.satisfies(request)) {
      return this._updateOperation.value.promise;
    } else if (target.get()?.request.satisfies(request)) {
      return Promise.resolve(true);
    }
    const updateOngoing = !!this._updateOperation.value;
    this._updateOperation.clear();
    const source = new CancellationTokenSource();
    const promise = (async () => {
      this._loadingCount.set(this._loadingCount.get() + 1, void 0);
      try {
        const recommendedDebounceValue = this._debounceValue.get(this._textModel);
        const debounceValue = findLastMax(
          this._languageFeaturesService.inlineCompletionsProvider.all(this._textModel).map((p) => p.debounceDelayMs),
          compareUndefinedSmallest(numberComparator)
        ) ?? recommendedDebounceValue;
        const shouldDebounce = updateOngoing || withDebounce && context.triggerKind === InlineCompletionTriggerKind.Automatic;
        if (shouldDebounce) {
          await wait(debounceValue, source.token);
        }
        if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId) {
          return false;
        }
        const requestId = InlineCompletionsSource._requestId++;
        if (this._loggingEnabled.get() || this._structuredFetchLogger.isEnabled.get()) {
          this._log({ sourceId: "InlineCompletions.fetch", kind: "start", requestId, modelUri: this._textModel.uri.toString(), modelVersion: this._textModel.getVersionId(), context: { triggerKind: context.triggerKind }, time: Date.now() });
        }
        const startTime = /* @__PURE__ */ new Date();
        let updatedCompletions = void 0;
        let error = void 0;
        try {
          updatedCompletions = await provideInlineCompletions(
            this._languageFeaturesService.inlineCompletionsProvider,
            position,
            this._textModel,
            context,
            source.token,
            this._languageConfigurationService
          );
        } catch (e) {
          error = e;
          throw e;
        } finally {
          if (this._loggingEnabled.get() || this._structuredFetchLogger.isEnabled.get()) {
            if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId) {
              error = "canceled";
            }
            const result = updatedCompletions?.completions.map((c) => ({
              range: c.range.toString(),
              text: c.insertText,
              isInlineEdit: !!c.isInlineEdit,
              source: c.source.provider.groupId
            }));
            this._log({ sourceId: "InlineCompletions.fetch", kind: "end", requestId, durationMs: Date.now() - startTime.getTime(), error, result, time: Date.now() });
          }
        }
        if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId || userJumpedToActiveCompletion.get()) {
          updatedCompletions.dispose();
          return false;
        }
        if (activeInlineCompletion && activeInlineCompletion.isInlineEdit && activeInlineCompletion.updatedEditModelVersion === this._textModel.getVersionId() && (activeInlineCompletion.canBeReused(this._textModel, position) || updatedCompletions.has(activeInlineCompletion.inlineCompletion) || updatedCompletions.isEmpty())) {
          activeInlineCompletion.reuse();
          updatedCompletions.dispose();
          return false;
        }
        const endTime = /* @__PURE__ */ new Date();
        this._debounceValue.update(this._textModel, endTime.getTime() - startTime.getTime());
        const completions = new UpToDateInlineCompletions(updatedCompletions, request, this._textModel, this._versionId);
        if (activeInlineCompletion && !activeInlineCompletion.isInlineEdit && activeInlineCompletion.canBeReused(this._textModel, position)) {
          const asInlineCompletion = activeInlineCompletion.toInlineCompletion(void 0);
          if (!updatedCompletions.has(asInlineCompletion)) {
            completions.prepend(activeInlineCompletion.inlineCompletion, asInlineCompletion.range, true);
          }
        }
        this._updateOperation.clear();
        transaction((tx) => {
          target.set(completions, tx);
        });
      } finally {
        this._loadingCount.set(this._loadingCount.get() - 1, void 0);
      }
      return true;
    })();
    const updateOperation = new UpdateOperation(request, source, promise);
    this._updateOperation.value = updateOperation;
    return promise;
  }
  clear(tx) {
    this._updateOperation.clear();
    this.inlineCompletions.set(void 0, tx);
    this.suggestWidgetInlineCompletions.set(void 0, tx);
  }
  clearSuggestWidgetInlineCompletions(tx) {
    if (this._updateOperation.value?.request.context.selectedSuggestionInfo) {
      this._updateOperation.clear();
    }
    this.suggestWidgetInlineCompletions.set(void 0, tx);
  }
  cancelUpdate() {
    this._updateOperation.clear();
  }
};
InlineCompletionsSource._requestId = 0;
InlineCompletionsSource = __decorateClass([
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, ILanguageConfigurationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IInstantiationService)
], InlineCompletionsSource);
function wait(ms, cancellationToken) {
  return new Promise((resolve) => {
    let d = void 0;
    const handle = setTimeout(() => {
      if (d) {
        d.dispose();
      }
      resolve();
    }, ms);
    if (cancellationToken) {
      d = cancellationToken.onCancellationRequested(() => {
        clearTimeout(handle);
        if (d) {
          d.dispose();
        }
        resolve();
      });
    }
  });
}
class UpdateRequest {
  constructor(position, context, versionId) {
    this.position = position;
    this.context = context;
    this.versionId = versionId;
  }
  satisfies(other) {
    return this.position.equals(other.position) && equalsIfDefined(this.context.selectedSuggestionInfo, other.context.selectedSuggestionInfo, itemEquals()) && (other.context.triggerKind === InlineCompletionTriggerKind.Automatic || this.context.triggerKind === InlineCompletionTriggerKind.Explicit) && this.versionId === other.versionId;
  }
  get isExplicitRequest() {
    return this.context.triggerKind === InlineCompletionTriggerKind.Explicit;
  }
}
class UpdateOperation {
  constructor(request, cancellationTokenSource, promise) {
    this.request = request;
    this.cancellationTokenSource = cancellationTokenSource;
    this.promise = promise;
  }
  dispose() {
    this.cancellationTokenSource.cancel();
  }
}
class UpToDateInlineCompletions {
  constructor(inlineCompletionProviderResult, request, _textModel, _versionId) {
    this.inlineCompletionProviderResult = inlineCompletionProviderResult;
    this.request = request;
    this._textModel = _textModel;
    this._versionId = _versionId;
    this._refCount = 1;
    this._prependedInlineCompletionItems = [];
    this._inlineCompletions = inlineCompletionProviderResult.completions.map(
      (completion) => new InlineCompletionWithUpdatedRange(completion, void 0, this._textModel, this._versionId, this.request)
    );
  }
  get inlineCompletions() {
    return this._inlineCompletions;
  }
  clone() {
    this._refCount++;
    return this;
  }
  dispose() {
    this._refCount--;
    if (this._refCount === 0) {
      this.inlineCompletionProviderResult.dispose();
      for (const i of this._prependedInlineCompletionItems) {
        i.source.removeRef();
      }
      this._inlineCompletions.forEach((i) => i.dispose());
    }
  }
  prepend(inlineCompletion, range, addRefToSource) {
    if (addRefToSource) {
      inlineCompletion.source.addRef();
    }
    this._inlineCompletions.unshift(new InlineCompletionWithUpdatedRange(inlineCompletion, range, this._textModel, this._versionId, this.request));
    this._prependedInlineCompletionItems.push(inlineCompletion);
  }
}
class InlineCompletionWithUpdatedRange extends Disposable {
  constructor(inlineCompletion, updatedRange, _textModel, _modelVersion, request) {
    super();
    this.inlineCompletion = inlineCompletion;
    this._textModel = _textModel;
    this._modelVersion = _modelVersion;
    this.request = request;
    this.semanticId = JSON.stringify([
      this.inlineCompletion.filterText,
      this.inlineCompletion.insertText,
      this.inlineCompletion.range.getStartPosition().toString()
    ]);
    this._updatedRange = derived((reader) => {
      const edit = this.updatedEdit.read(reader);
      if (!edit || edit.edits.length === 0) {
        return void 0;
      }
      return Range.fromPositions(
        this._textModel.getPositionAt(edit.edits[0].replaceRange.start),
        this._textModel.getPositionAt(edit.edits[edit.edits.length - 1].replaceRange.endExclusive)
      );
    });
    this._updatedEditObj = this._register(this._toUpdatedEdit(updatedRange ?? this.inlineCompletion.range, this.inlineCompletion.insertText));
  }
  get forwardStable() {
    return this.source.inlineCompletions.enableForwardStability ?? false;
  }
  // helper as derivedHandleChanges can not access previous value
  get updatedEdit() {
    return this._updatedEditObj.offsetEdit;
  }
  get updatedEditModelVersion() {
    return this._updatedEditObj.modelVersion;
  }
  get source() {
    return this.inlineCompletion.source;
  }
  get sourceInlineCompletion() {
    return this.inlineCompletion.sourceInlineCompletion;
  }
  get isInlineEdit() {
    return this.inlineCompletion.isInlineEdit;
  }
  toInlineCompletion(reader) {
    const singleTextEdit = this.toSingleTextEdit(reader);
    return this.inlineCompletion.withRangeInsertTextAndFilterText(singleTextEdit.range, singleTextEdit.text, singleTextEdit.text);
  }
  toSingleTextEdit(reader) {
    this._modelVersion.read(reader);
    const offsetEdit = this.updatedEdit.read(reader);
    if (!offsetEdit) {
      return new SingleTextEdit(this._updatedRange.read(reader) ?? emptyRange, this.inlineCompletion.insertText);
    }
    const startOffset = offsetEdit.edits[0].replaceRange.start;
    const endOffset = offsetEdit.edits[offsetEdit.edits.length - 1].replaceRange.endExclusive;
    const overallOffsetRange = new OffsetRange(startOffset, endOffset);
    const overallLnColRange = Range.fromPositions(
      this._textModel.getPositionAt(overallOffsetRange.start),
      this._textModel.getPositionAt(overallOffsetRange.endExclusive)
    );
    let text = this._textModel.getValueInRange(overallLnColRange);
    for (let i = offsetEdit.edits.length - 1; i >= 0; i--) {
      const edit = offsetEdit.edits[i];
      const relativeStartOffset = edit.replaceRange.start - startOffset;
      const relativeEndOffset = edit.replaceRange.endExclusive - startOffset;
      text = text.substring(0, relativeStartOffset) + edit.newText + text.substring(relativeEndOffset);
    }
    return new SingleTextEdit(overallLnColRange, text);
  }
  isVisible(model, cursorPosition, reader) {
    const minimizedReplacement = singleTextRemoveCommonPrefix(this.toSingleTextEdit(reader), model);
    const updatedRange = this._updatedRange.read(reader);
    if (!updatedRange || !this.inlineCompletion.range.getStartPosition().equals(updatedRange.getStartPosition()) || cursorPosition.lineNumber !== minimizedReplacement.range.startLineNumber || minimizedReplacement.isEmpty) {
      return false;
    }
    const originalValue = model.getValueInRange(minimizedReplacement.range, EndOfLinePreference.LF);
    const filterText = minimizedReplacement.text;
    const cursorPosIndex = Math.max(0, cursorPosition.column - minimizedReplacement.range.startColumn);
    let filterTextBefore = filterText.substring(0, cursorPosIndex);
    let filterTextAfter = filterText.substring(cursorPosIndex);
    let originalValueBefore = originalValue.substring(0, cursorPosIndex);
    let originalValueAfter = originalValue.substring(cursorPosIndex);
    const originalValueIndent = model.getLineIndentColumn(minimizedReplacement.range.startLineNumber);
    if (minimizedReplacement.range.startColumn <= originalValueIndent) {
      originalValueBefore = originalValueBefore.trimStart();
      if (originalValueBefore.length === 0) {
        originalValueAfter = originalValueAfter.trimStart();
      }
      filterTextBefore = filterTextBefore.trimStart();
      if (filterTextBefore.length === 0) {
        filterTextAfter = filterTextAfter.trimStart();
      }
    }
    return filterTextBefore.startsWith(originalValueBefore) && !!matchesSubString(originalValueAfter, filterTextAfter);
  }
  reuse() {
    this._updatedEditObj.reuse();
  }
  canBeReused(model, position) {
    if (!this.updatedEdit.get()) {
      return false;
    }
    if (this.sourceInlineCompletion.isInlineEdit) {
      return this._updatedEditObj.lastChangePartOfInlineEdit;
    }
    const updatedRange = this._updatedRange.read(void 0);
    const result = !!updatedRange && updatedRange.containsPosition(position) && this.isVisible(model, position, void 0) && TextLength.ofRange(updatedRange).isGreaterThanOrEqualTo(TextLength.ofRange(this.inlineCompletion.range));
    return result;
  }
  _toUpdatedEdit(editRange, replaceText) {
    return this.isInlineEdit ? this._toInlineEditEdit(editRange, replaceText) : this._toInlineCompletionEdit(editRange, replaceText);
  }
  _toInlineCompletionEdit(editRange, replaceText) {
    const startOffset = this._textModel.getOffsetAt(editRange.getStartPosition());
    const endOffset = this._textModel.getOffsetAt(editRange.getEndPosition());
    const originalRange = OffsetRange.ofStartAndLength(startOffset, endOffset - startOffset);
    const offsetEdit = new OffsetEdit([new SingleOffsetEdit(originalRange, replaceText)]);
    return new UpdatedEdit(offsetEdit, this._textModel, this._modelVersion, false);
  }
  _toInlineEditEdit(editRange, replaceText) {
    const eol = this._textModel.getEOL();
    const editOriginalText = this._textModel.getValueInRange(editRange);
    const editReplaceText = replaceText.replace(/\r\n|\r|\n/g, eol);
    const diffAlgorithm = linesDiffComputers.getDefault();
    const lineDiffs = diffAlgorithm.computeDiff(
      splitLines(editOriginalText),
      splitLines(editReplaceText),
      {
        ignoreTrimWhitespace: false,
        computeMoves: false,
        extendToSubwords: true,
        maxComputationTimeMs: 500
      }
    );
    const innerChanges = lineDiffs.changes.flatMap((c) => c.innerChanges ?? []);
    function addRangeToPos(pos, range) {
      const start = TextLength.fromPosition(range.getStartPosition());
      return TextLength.ofRange(range).createRange(start.addToPosition(pos));
    }
    const modifiedText = new StringText(editReplaceText);
    const offsetEdit = new OffsetEdit(
      innerChanges.map((c) => {
        const range = addRangeToPos(editRange.getStartPosition(), c.originalRange);
        const startOffset = this._textModel.getOffsetAt(range.getStartPosition());
        const endOffset = this._textModel.getOffsetAt(range.getEndPosition());
        const originalRange = OffsetRange.ofStartAndLength(startOffset, endOffset - startOffset);
        const replaceText2 = modifiedText.getValueOfRange(c.modifiedRange);
        const originalText = this._textModel.getValueInRange(range);
        const edit = new SingleOffsetEdit(originalRange, replaceText2);
        return reshapeEdit(edit, originalText, innerChanges.length, this._textModel);
      })
    );
    return new UpdatedEdit(offsetEdit, this._textModel, this._modelVersion, true);
  }
}
class UpdatedEdit extends Disposable {
  constructor(offsetEdit, _textModel, _modelVersion, isInlineEdit) {
    super();
    this._textModel = _textModel;
    this._modelVersion = _modelVersion;
    this._lastChangePartOfInlineEdit = false;
    this._updatedEdit = derivedHandleChanges({
      owner: this,
      equalityComparer: equalsIfDefined((a, b) => a?.equals(b)),
      createEmptyChangeSummary: () => [],
      handleChange: (context, changeSummary) => {
        if (context.didChange(this._modelVersion) && context.change) {
          changeSummary.push(OffsetEdits.fromContentChanges(context.change.changes));
        }
        return true;
      }
    }, (reader, changeSummary) => {
      this._modelVersion.read(reader);
      for (const change of changeSummary) {
        this._innerEdits = this._applyTextModelChanges(change, this._innerEdits);
      }
      if (this._innerEdits.length === 0) {
        return void 0;
      }
      if (this._innerEdits.some((e) => e.edit === void 0)) {
        throw new BugIndicatingError("UpdatedEdit: Invalid state");
      }
      return new OffsetEdit(this._innerEdits.map((edit) => edit.edit));
    });
    this._inlineEditModelVersion = this._modelVersion.get() ?? -1;
    this._innerEdits = offsetEdit.edits.map((edit) => {
      if (isInlineEdit) {
        const replacedRange = Range.fromPositions(this._textModel.getPositionAt(edit.replaceRange.start), this._textModel.getPositionAt(edit.replaceRange.endExclusive));
        const replacedText = this._textModel.getValueInRange(replacedRange);
        return new SingleUpdatedNextEdit(edit, replacedText);
      }
      return new SingleUpdatedCompletion(edit);
    });
    this._updatedEdit.recomputeInitiallyAndOnChange(this._store);
  }
  get modelVersion() {
    return this._inlineEditModelVersion;
  }
  get lastChangePartOfInlineEdit() {
    return this._lastChangePartOfInlineEdit;
  }
  get offsetEdit() {
    return this._updatedEdit.map((e) => e ?? void 0);
  }
  _applyTextModelChanges(textModelChanges, edits) {
    for (const innerEdit of edits) {
      innerEdit.applyTextModelChanges(textModelChanges);
    }
    if (edits.some((edit) => edit.edit === void 0)) {
      return [];
    }
    const currentModelVersion = this._modelVersion.get();
    this._lastChangePartOfInlineEdit = edits.some((edit) => edit.lastChangeUpdatedEdit);
    if (this._lastChangePartOfInlineEdit) {
      this._inlineEditModelVersion = currentModelVersion ?? -1;
    }
    if (currentModelVersion === null || this._inlineEditModelVersion + 20 < currentModelVersion) {
      return [];
    }
    edits = edits.filter((innerEdit) => !innerEdit.edit.isEmpty);
    if (edits.length === 0) {
      return [];
    }
    return edits;
  }
  reuse() {
    this._inlineEditModelVersion = this._modelVersion.get() ?? -1;
  }
}
class SingleUpdatedEdit {
  constructor(edit) {
    this._lastChangeUpdatedEdit = false;
    this._edit = edit;
  }
  get edit() {
    return this._edit;
  }
  get lastChangeUpdatedEdit() {
    return this._lastChangeUpdatedEdit;
  }
  applyTextModelChanges(textModelChanges) {
    this._lastChangeUpdatedEdit = false;
    if (!this._edit) {
      throw new BugIndicatingError("UpdatedInnerEdits: No edit to apply changes to");
    }
    const result = this.applyChanges(this._edit, textModelChanges);
    if (!result) {
      this._edit = void 0;
      return;
    }
    this._edit = result.edit;
    this._lastChangeUpdatedEdit = result.editHasChanged;
  }
}
class SingleUpdatedCompletion extends SingleUpdatedEdit {
  constructor(edit) {
    super(edit);
  }
  applyChanges(edit, textModelChanges) {
    const newEditRange = applyEditsToRanges([edit.replaceRange], textModelChanges)[0];
    return { edit: new SingleOffsetEdit(newEditRange, edit.newText), editHasChanged: !newEditRange.equals(edit.replaceRange) };
  }
}
class SingleUpdatedNextEdit extends SingleUpdatedEdit {
  constructor(edit, replacedText) {
    super(edit);
    this._prefixLength = commonPrefixLength(edit.newText, replacedText);
    this._suffixLength = commonSuffixLength(edit.newText, replacedText);
    this._trimmedNewText = edit.newText.substring(this._prefixLength, edit.newText.length - this._suffixLength);
  }
  applyChanges(edit, textModelChanges) {
    let editStart = edit.replaceRange.start;
    let editEnd = edit.replaceRange.endExclusive;
    let editReplaceText = edit.newText;
    let editHasChanged = false;
    const shouldPreserveEditShape = this._prefixLength > 0 || this._suffixLength > 0;
    for (let i = textModelChanges.edits.length - 1; i >= 0; i--) {
      const change = textModelChanges.edits[i];
      const isInsertion = change.newText.length > 0 && change.replaceRange.isEmpty;
      if (isInsertion && !shouldPreserveEditShape && change.replaceRange.start === editStart && editReplaceText.startsWith(change.newText)) {
        editStart += change.newText.length;
        editReplaceText = editReplaceText.substring(change.newText.length);
        editEnd = Math.max(editStart, editEnd);
        editHasChanged = true;
        continue;
      }
      if (isInsertion && shouldPreserveEditShape && change.replaceRange.start === editStart + this._prefixLength && this._trimmedNewText.startsWith(change.newText)) {
        editEnd += change.newText.length;
        editHasChanged = true;
        this._prefixLength += change.newText.length;
        this._trimmedNewText = this._trimmedNewText.substring(change.newText.length);
        continue;
      }
      const isDeletion = change.newText.length === 0 && change.replaceRange.length > 0;
      if (isDeletion && change.replaceRange.start >= editStart + this._prefixLength && change.replaceRange.endExclusive <= editEnd - this._suffixLength) {
        editEnd -= change.replaceRange.length;
        editHasChanged = true;
        continue;
      }
      if (change.equals(edit)) {
        editHasChanged = true;
        editStart = change.replaceRange.endExclusive;
        editReplaceText = "";
        continue;
      }
      if (change.replaceRange.start > editEnd) {
        continue;
      }
      if (change.replaceRange.endExclusive < editStart) {
        editStart += change.newText.length - change.replaceRange.length;
        editEnd += change.newText.length - change.replaceRange.length;
        continue;
      }
      return void 0;
    }
    if (this._trimmedNewText.length === 0 && editStart + this._prefixLength === editEnd - this._suffixLength) {
      return { edit: new SingleOffsetEdit(new OffsetRange(editStart + this._prefixLength, editStart + this._prefixLength), ""), editHasChanged: true };
    }
    return { edit: new SingleOffsetEdit(new OffsetRange(editStart, editEnd), editReplaceText), editHasChanged };
  }
}
const emptyRange = new Range(1, 1, 1, 1);
function reshapeEdit(edit, originalText, totalInnerEdits, textModel) {
  const eol = textModel.getEOL();
  if (edit.newText.endsWith(eol) && originalText.endsWith(eol)) {
    edit = new SingleOffsetEdit(edit.replaceRange.deltaEnd(-eol.length), edit.newText.slice(0, -eol.length));
  }
  if (totalInnerEdits === 1 && edit.replaceRange.isEmpty && edit.newText.includes(eol)) {
    edit = reshapeMultiLineInsertion(edit, textModel);
  }
  if (totalInnerEdits === 1) {
    const prefixLength = commonPrefixLength(originalText, edit.newText);
    const suffixLength = commonSuffixLength(originalText.slice(prefixLength), edit.newText.slice(prefixLength));
    if (prefixLength + suffixLength === originalText.length) {
      return new SingleOffsetEdit(edit.replaceRange.deltaStart(prefixLength).deltaEnd(-suffixLength), edit.newText.substring(prefixLength, edit.newText.length - suffixLength));
    }
    if (prefixLength + suffixLength === edit.newText.length) {
      return new SingleOffsetEdit(edit.replaceRange.deltaStart(prefixLength).deltaEnd(-suffixLength), "");
    }
  }
  return edit;
}
function reshapeMultiLineInsertion(edit, textModel) {
  if (!edit.replaceRange.isEmpty) {
    throw new BugIndicatingError("Unexpected original range");
  }
  if (edit.replaceRange.start === 0) {
    return edit;
  }
  const eol = textModel.getEOL();
  const startPosition = textModel.getPositionAt(edit.replaceRange.start);
  const startColumn = startPosition.column;
  const startLineNumber = startPosition.lineNumber;
  if (startColumn === 1 && startLineNumber > 1 && textModel.getLineLength(startLineNumber) !== 0 && edit.newText.endsWith(eol) && !edit.newText.startsWith(eol)) {
    return new SingleOffsetEdit(edit.replaceRange.delta(-1), eol + edit.newText.slice(0, -eol.length));
  }
  return edit;
}
export {
  InlineCompletionWithUpdatedRange,
  InlineCompletionsSource,
  UpToDateInlineCompletions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL2lubGluZUNvbXBsZXRpb25zU291cmNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY29tcGFyZVVuZGVmaW5lZFNtYWxsZXN0LCBudW1iZXJDb21wYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGZpbmRMYXN0TWF4IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzRmluZC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZXF1YWxzSWZEZWZpbmVkLCBpdGVtRXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXF1YWxzLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBtYXRjaGVzU3ViU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIElPYnNlcnZhYmxlV2l0aENoYW5nZSwgSVJlYWRlciwgSVRyYW5zYWN0aW9uLCBkZXJpdmVkLCBkZXJpdmVkSGFuZGxlQ2hhbmdlcywgZGlzcG9zYWJsZU9ic2VydmFibGVWYWx1ZSwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgY29tbW9uUHJlZml4TGVuZ3RoLCBjb21tb25TdWZmaXhMZW5ndGgsIHNwbGl0TGluZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb25maWdWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL29ic2VydmFibGUvY29tbW9uL3BsYXRmb3JtT2JzZXJ2YWJsZVV0aWxzLmpzJztcbmltcG9ydCB7IGFwcGx5RWRpdHNUb1JhbmdlcywgT2Zmc2V0RWRpdCwgU2luZ2xlT2Zmc2V0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL29mZnNldEVkaXQuanMnO1xuaW1wb3J0IHsgT2Zmc2V0UmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9vZmZzZXRSYW5nZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2luZ2xlVGV4dEVkaXQsIFN0cmluZ1RleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS90ZXh0RWRpdC5qcyc7XG5pbXBvcnQgeyBUZXh0TGVuZ3RoIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvdGV4dExlbmd0aC5qcyc7XG5pbXBvcnQgeyBsaW5lc0RpZmZDb21wdXRlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZGlmZi9saW5lc0RpZmZDb21wdXRlcnMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbkNvbnRleHQsIElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVByZWZlcmVuY2UsIElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgT2Zmc2V0RWRpdHMgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsT2Zmc2V0RWRpdC5qcyc7XG5pbXBvcnQgeyBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbkl0ZW0sIElubGluZUNvbXBsZXRpb25Qcm92aWRlclJlc3VsdCwgcHJvdmlkZUlubGluZUNvbXBsZXRpb25zIH0gZnJvbSAnLi9wcm92aWRlSW5saW5lQ29tcGxldGlvbnMuanMnO1xuaW1wb3J0IHsgc2luZ2xlVGV4dFJlbW92ZUNvbW1vblByZWZpeCB9IGZyb20gJy4vc2luZ2xlVGV4dEVkaXRIZWxwZXJzLmpzJztcbmltcG9ydCB7IFN0cnVjdHVyZWRMb2dnZXIsIElSZWNvcmRhYmxlRWRpdG9yTG9nRW50cnksIElSZWNvcmRhYmxlTG9nRW50cnksIGZvcm1hdFJlY29yZGFibGVMb2dFbnRyeSB9IGZyb20gJy4uL3N0cnVjdHVyZWRMb2dnZXIuanMnO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lQ29tcGxldGlvbnNTb3VyY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBzdGF0aWMgX3JlcXVlc3RJZCA9IDA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdXBkYXRlT3BlcmF0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPFVwZGF0ZU9wZXJhdGlvbj4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBpbmxpbmVDb21wbGV0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKGRpc3Bvc2FibGVPYnNlcnZhYmxlVmFsdWU8VXBUb0RhdGVJbmxpbmVDb21wbGV0aW9ucyB8IHVuZGVmaW5lZD4oJ2lubGluZUNvbXBsZXRpb25zJywgdW5kZWZpbmVkKSk7XG5cdHB1YmxpYyByZWFkb25seSBzdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnMgPSB0aGlzLl9yZWdpc3RlcihkaXNwb3NhYmxlT2JzZXJ2YWJsZVZhbHVlPFVwVG9EYXRlSW5saW5lQ29tcGxldGlvbnMgfCB1bmRlZmluZWQ+KCdzdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnMnLCB1bmRlZmluZWQpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dnaW5nRW5hYmxlZCA9IG9ic2VydmFibGVDb25maWdWYWx1ZSgnZWRpdG9yLmlubGluZVN1Z2dlc3QubG9nRmV0Y2gnLCBmYWxzZSwgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdHJ1Y3R1cmVkRmV0Y2hMb2dnZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdHJ1Y3R1cmVkTG9nZ2VyLmNhc3Q8XG5cdFx0eyBraW5kOiAnc3RhcnQnOyByZXF1ZXN0SWQ6IG51bWJlcjsgY29udGV4dDogdW5rbm93biB9ICYgSVJlY29yZGFibGVFZGl0b3JMb2dFbnRyeVxuXHRcdHwgeyBraW5kOiAnZW5kJzsgZXJyb3I6IGFueTsgZHVyYXRpb25NczogbnVtYmVyOyByZXN1bHQ6IHVua25vd247IHJlcXVlc3RJZDogbnVtYmVyIH0gJiBJUmVjb3JkYWJsZUxvZ0VudHJ5XG5cdD4oKSxcblx0XHQnZWRpdG9yLmlubGluZVN1Z2dlc3QubG9nRmV0Y2guY29tbWFuZElkJ1xuXHQpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdmVyc2lvbklkOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8bnVtYmVyIHwgbnVsbCwgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGVib3VuY2VWYWx1ZTogSUZlYXR1cmVEZWJvdW5jZUluZm9ybWF0aW9uLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNsZWFyT3BlcmF0aW9uT25UZXh0TW9kZWxDaGFuZ2UucmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UodGhpcy5fc3RvcmUpO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IGNsZWFyT3BlcmF0aW9uT25UZXh0TW9kZWxDaGFuZ2UgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0dGhpcy5fdmVyc2lvbklkLnJlYWQocmVhZGVyKTtcblx0XHR0aGlzLl91cGRhdGVPcGVyYXRpb24uY2xlYXIoKTtcblx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBhbHdheXMgY29uc3RhbnRcblx0fSk7XG5cblx0cHJpdmF0ZSBfbG9nKGVudHJ5OlxuXHRcdHsgc291cmNlSWQ6IHN0cmluZzsga2luZDogJ3N0YXJ0JzsgcmVxdWVzdElkOiBudW1iZXI7IGNvbnRleHQ6IHVua25vd24gfSAmIElSZWNvcmRhYmxlRWRpdG9yTG9nRW50cnlcblx0XHR8IHsgc291cmNlSWQ6IHN0cmluZzsga2luZDogJ2VuZCc7IGVycm9yOiBhbnk7IGR1cmF0aW9uTXM6IG51bWJlcjsgcmVzdWx0OiB1bmtub3duOyByZXF1ZXN0SWQ6IG51bWJlciB9ICYgSVJlY29yZGFibGVMb2dFbnRyeVxuXHQpIHtcblx0XHRpZiAodGhpcy5fbG9nZ2luZ0VuYWJsZWQuZ2V0KCkpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhmb3JtYXRSZWNvcmRhYmxlTG9nRW50cnkoZW50cnkpKTtcblx0XHR9XG5cdFx0dGhpcy5fc3RydWN0dXJlZEZldGNoTG9nZ2VyLmxvZyhlbnRyeSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2FkaW5nQ291bnQgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgMCk7XG5cdHB1YmxpYyByZWFkb25seSBsb2FkaW5nID0gdGhpcy5fbG9hZGluZ0NvdW50Lm1hcCh0aGlzLCB2ID0+IHYgPiAwKTtcblxuXHRwdWJsaWMgZmV0Y2gocG9zaXRpb246IFBvc2l0aW9uLCBjb250ZXh0OiBJbmxpbmVDb21wbGV0aW9uQ29udGV4dCwgYWN0aXZlSW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbldpdGhVcGRhdGVkUmFuZ2UgfCB1bmRlZmluZWQsIHdpdGhEZWJvdW5jZTogYm9vbGVhbiwgdXNlckp1bXBlZFRvQWN0aXZlQ29tcGxldGlvbjogSU9ic2VydmFibGU8Ym9vbGVhbj4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCByZXF1ZXN0ID0gbmV3IFVwZGF0ZVJlcXVlc3QocG9zaXRpb24sIGNvbnRleHQsIHRoaXMuX3RleHRNb2RlbC5nZXRWZXJzaW9uSWQoKSk7XG5cblx0XHRjb25zdCB0YXJnZXQgPSBjb250ZXh0LnNlbGVjdGVkU3VnZ2VzdGlvbkluZm8gPyB0aGlzLnN1Z2dlc3RXaWRnZXRJbmxpbmVDb21wbGV0aW9ucyA6IHRoaXMuaW5saW5lQ29tcGxldGlvbnM7XG5cblx0XHRpZiAodGhpcy5fdXBkYXRlT3BlcmF0aW9uLnZhbHVlPy5yZXF1ZXN0LnNhdGlzZmllcyhyZXF1ZXN0KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3VwZGF0ZU9wZXJhdGlvbi52YWx1ZS5wcm9taXNlO1xuXHRcdH0gZWxzZSBpZiAodGFyZ2V0LmdldCgpPy5yZXF1ZXN0LnNhdGlzZmllcyhyZXF1ZXN0KSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0XHR9XG5cblx0XHRjb25zdCB1cGRhdGVPbmdvaW5nID0gISF0aGlzLl91cGRhdGVPcGVyYXRpb24udmFsdWU7XG5cdFx0dGhpcy5fdXBkYXRlT3BlcmF0aW9uLmNsZWFyKCk7XG5cblx0XHRjb25zdCBzb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdGNvbnN0IHByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5fbG9hZGluZ0NvdW50LnNldCh0aGlzLl9sb2FkaW5nQ291bnQuZ2V0KCkgKyAxLCB1bmRlZmluZWQpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcmVjb21tZW5kZWREZWJvdW5jZVZhbHVlID0gdGhpcy5fZGVib3VuY2VWYWx1ZS5nZXQodGhpcy5fdGV4dE1vZGVsKTtcblx0XHRcdFx0Y29uc3QgZGVib3VuY2VWYWx1ZSA9IGZpbmRMYXN0TWF4KFxuXHRcdFx0XHRcdHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZUNvbXBsZXRpb25zUHJvdmlkZXIuYWxsKHRoaXMuX3RleHRNb2RlbCkubWFwKHAgPT4gcC5kZWJvdW5jZURlbGF5TXMpLFxuXHRcdFx0XHRcdGNvbXBhcmVVbmRlZmluZWRTbWFsbGVzdChudW1iZXJDb21wYXJhdG9yKVxuXHRcdFx0XHQpID8/IHJlY29tbWVuZGVkRGVib3VuY2VWYWx1ZTtcblxuXHRcdFx0XHQvLyBEZWJvdW5jZSBpbiBhbnkgY2FzZSBpZiB1cGRhdGUgaXMgb25nb2luZ1xuXHRcdFx0XHRjb25zdCBzaG91bGREZWJvdW5jZSA9IHVwZGF0ZU9uZ29pbmcgfHwgKHdpdGhEZWJvdW5jZSAmJiBjb250ZXh0LnRyaWdnZXJLaW5kID09PSBJbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQuQXV0b21hdGljKTtcblx0XHRcdFx0aWYgKHNob3VsZERlYm91bmNlKSB7XG5cdFx0XHRcdFx0Ly8gVGhpcyBkZWJvdW5jZXMgdGhlIG9wZXJhdGlvblxuXHRcdFx0XHRcdGF3YWl0IHdhaXQoZGVib3VuY2VWYWx1ZSwgc291cmNlLnRva2VuKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzb3VyY2UudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgfHwgdGhpcy5fc3RvcmUuaXNEaXNwb3NlZCB8fCB0aGlzLl90ZXh0TW9kZWwuZ2V0VmVyc2lvbklkKCkgIT09IHJlcXVlc3QudmVyc2lvbklkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVxdWVzdElkID0gSW5saW5lQ29tcGxldGlvbnNTb3VyY2UuX3JlcXVlc3RJZCsrO1xuXHRcdFx0XHRpZiAodGhpcy5fbG9nZ2luZ0VuYWJsZWQuZ2V0KCkgfHwgdGhpcy5fc3RydWN0dXJlZEZldGNoTG9nZ2VyLmlzRW5hYmxlZC5nZXQoKSkge1xuXHRcdFx0XHRcdHRoaXMuX2xvZyh7IHNvdXJjZUlkOiAnSW5saW5lQ29tcGxldGlvbnMuZmV0Y2gnLCBraW5kOiAnc3RhcnQnLCByZXF1ZXN0SWQsIG1vZGVsVXJpOiB0aGlzLl90ZXh0TW9kZWwudXJpLnRvU3RyaW5nKCksIG1vZGVsVmVyc2lvbjogdGhpcy5fdGV4dE1vZGVsLmdldFZlcnNpb25JZCgpLCBjb250ZXh0OiB7IHRyaWdnZXJLaW5kOiBjb250ZXh0LnRyaWdnZXJLaW5kIH0sIHRpbWU6IERhdGUubm93KCkgfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHRsZXQgdXBkYXRlZENvbXBsZXRpb25zOiBJbmxpbmVDb21wbGV0aW9uUHJvdmlkZXJSZXN1bHQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGxldCBlcnJvcjogYW55ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHVwZGF0ZWRDb21wbGV0aW9ucyA9IGF3YWl0IHByb3ZpZGVJbmxpbmVDb21wbGV0aW9ucyhcblx0XHRcdFx0XHRcdHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZUNvbXBsZXRpb25zUHJvdmlkZXIsXG5cdFx0XHRcdFx0XHRwb3NpdGlvbixcblx0XHRcdFx0XHRcdHRoaXMuX3RleHRNb2RlbCxcblx0XHRcdFx0XHRcdGNvbnRleHQsXG5cdFx0XHRcdFx0XHRzb3VyY2UudG9rZW4sXG5cdFx0XHRcdFx0XHR0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGVycm9yID0gZTtcblx0XHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9sb2dnaW5nRW5hYmxlZC5nZXQoKSB8fCB0aGlzLl9zdHJ1Y3R1cmVkRmV0Y2hMb2dnZXIuaXNFbmFibGVkLmdldCgpKSB7XG5cdFx0XHRcdFx0XHRpZiAoc291cmNlLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIHx8IHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgfHwgdGhpcy5fdGV4dE1vZGVsLmdldFZlcnNpb25JZCgpICE9PSByZXF1ZXN0LnZlcnNpb25JZCkge1xuXHRcdFx0XHRcdFx0XHRlcnJvciA9ICdjYW5jZWxlZCc7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSB1cGRhdGVkQ29tcGxldGlvbnM/LmNvbXBsZXRpb25zLm1hcChjID0+ICh7XG5cdFx0XHRcdFx0XHRcdHJhbmdlOiBjLnJhbmdlLnRvU3RyaW5nKCksXG5cdFx0XHRcdFx0XHRcdHRleHQ6IGMuaW5zZXJ0VGV4dCxcblx0XHRcdFx0XHRcdFx0aXNJbmxpbmVFZGl0OiAhIWMuaXNJbmxpbmVFZGl0LFxuXHRcdFx0XHRcdFx0XHRzb3VyY2U6IGMuc291cmNlLnByb3ZpZGVyLmdyb3VwSWQsXG5cdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2coeyBzb3VyY2VJZDogJ0lubGluZUNvbXBsZXRpb25zLmZldGNoJywga2luZDogJ2VuZCcsIHJlcXVlc3RJZCwgZHVyYXRpb25NczogKERhdGUubm93KCkgLSBzdGFydFRpbWUuZ2V0VGltZSgpKSwgZXJyb3IsIHJlc3VsdCwgdGltZTogRGF0ZS5ub3coKSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc291cmNlLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIHx8IHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgfHwgdGhpcy5fdGV4dE1vZGVsLmdldFZlcnNpb25JZCgpICE9PSByZXF1ZXN0LnZlcnNpb25JZCB8fCB1c2VySnVtcGVkVG9BY3RpdmVDb21wbGV0aW9uLmdldCgpIC8qIEluIHRoZSBtZWFudGltZSB0aGUgdXNlciBzaG93ZWQgaW50ZXJlc3QgZm9yIHRoZSBhY3RpdmUgY29tcGxldGlvbiBzbyBkb250IGhpZGUgaXQgKi8pIHtcblx0XHRcdFx0XHR1cGRhdGVkQ29tcGxldGlvbnMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJldXNlIElubGluZSBFZGl0IGlmIHBvc3NpYmxlXG5cdFx0XHRcdGlmIChhY3RpdmVJbmxpbmVDb21wbGV0aW9uICYmIGFjdGl2ZUlubGluZUNvbXBsZXRpb24uaXNJbmxpbmVFZGl0ICYmIGFjdGl2ZUlubGluZUNvbXBsZXRpb24udXBkYXRlZEVkaXRNb2RlbFZlcnNpb24gPT09IHRoaXMuX3RleHRNb2RlbC5nZXRWZXJzaW9uSWQoKSAmJiAoXG5cdFx0XHRcdFx0YWN0aXZlSW5saW5lQ29tcGxldGlvbi5jYW5CZVJldXNlZCh0aGlzLl90ZXh0TW9kZWwsIHBvc2l0aW9uKVxuXHRcdFx0XHRcdHx8IHVwZGF0ZWRDb21wbGV0aW9ucy5oYXMoYWN0aXZlSW5saW5lQ29tcGxldGlvbi5pbmxpbmVDb21wbGV0aW9uKSAvKiBJbmxpbmUgRWRpdCB3aW5zIG92ZXIgY29tcGxldGlvbnMgaWYgaXQncyBhbHJlYWR5IGJlZW4gc2hvd24qL1xuXHRcdFx0XHRcdHx8IHVwZGF0ZWRDb21wbGV0aW9ucy5pc0VtcHR5KCkgLyogSW5jb21pbmcgY29tcGxldGlvbiBpcyBlbXB0eSwga2VlcCB0aGUgY3VycmVudCBvbmUgYWxpdmUgKi9cblx0XHRcdFx0KSkge1xuXHRcdFx0XHRcdGFjdGl2ZUlubGluZUNvbXBsZXRpb24ucmV1c2UoKTtcblx0XHRcdFx0XHR1cGRhdGVkQ29tcGxldGlvbnMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGVuZFRpbWUgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHR0aGlzLl9kZWJvdW5jZVZhbHVlLnVwZGF0ZSh0aGlzLl90ZXh0TW9kZWwsIGVuZFRpbWUuZ2V0VGltZSgpIC0gc3RhcnRUaW1lLmdldFRpbWUoKSk7XG5cblx0XHRcdFx0Ly8gUmV1c2UgSW5saW5lIENvbXBsZXRpb24gaWYgcG9zc2libGVcblx0XHRcdFx0Y29uc3QgY29tcGxldGlvbnMgPSBuZXcgVXBUb0RhdGVJbmxpbmVDb21wbGV0aW9ucyh1cGRhdGVkQ29tcGxldGlvbnMsIHJlcXVlc3QsIHRoaXMuX3RleHRNb2RlbCwgdGhpcy5fdmVyc2lvbklkKTtcblx0XHRcdFx0aWYgKGFjdGl2ZUlubGluZUNvbXBsZXRpb24gJiYgIWFjdGl2ZUlubGluZUNvbXBsZXRpb24uaXNJbmxpbmVFZGl0ICYmIGFjdGl2ZUlubGluZUNvbXBsZXRpb24uY2FuQmVSZXVzZWQodGhpcy5fdGV4dE1vZGVsLCBwb3NpdGlvbikpIHtcblx0XHRcdFx0XHRjb25zdCBhc0lubGluZUNvbXBsZXRpb24gPSBhY3RpdmVJbmxpbmVDb21wbGV0aW9uLnRvSW5saW5lQ29tcGxldGlvbih1bmRlZmluZWQpO1xuXHRcdFx0XHRcdGlmICghdXBkYXRlZENvbXBsZXRpb25zLmhhcyhhc0lubGluZUNvbXBsZXRpb24pKSB7XG5cdFx0XHRcdFx0XHRjb21wbGV0aW9ucy5wcmVwZW5kKGFjdGl2ZUlubGluZUNvbXBsZXRpb24uaW5saW5lQ29tcGxldGlvbiwgYXNJbmxpbmVDb21wbGV0aW9uLnJhbmdlLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl91cGRhdGVPcGVyYXRpb24uY2xlYXIoKTtcblx0XHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gVXBkYXRlIGNvbXBsZXRpb25zIHdpdGggcHJvdmlkZXIgcmVzdWx0ICovXG5cdFx0XHRcdFx0dGFyZ2V0LnNldChjb21wbGV0aW9ucywgdHgpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0dGhpcy5fbG9hZGluZ0NvdW50LnNldCh0aGlzLl9sb2FkaW5nQ291bnQuZ2V0KCkgLSAxLCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KSgpO1xuXG5cdFx0Y29uc3QgdXBkYXRlT3BlcmF0aW9uID0gbmV3IFVwZGF0ZU9wZXJhdGlvbihyZXF1ZXN0LCBzb3VyY2UsIHByb21pc2UpO1xuXHRcdHRoaXMuX3VwZGF0ZU9wZXJhdGlvbi52YWx1ZSA9IHVwZGF0ZU9wZXJhdGlvbjtcblxuXHRcdHJldHVybiBwcm9taXNlO1xuXHR9XG5cblx0cHVibGljIGNsZWFyKHR4OiBJVHJhbnNhY3Rpb24pOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVPcGVyYXRpb24uY2xlYXIoKTtcblx0XHR0aGlzLmlubGluZUNvbXBsZXRpb25zLnNldCh1bmRlZmluZWQsIHR4KTtcblx0XHR0aGlzLnN1Z2dlc3RXaWRnZXRJbmxpbmVDb21wbGV0aW9ucy5zZXQodW5kZWZpbmVkLCB0eCk7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJTdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnModHg6IElUcmFuc2FjdGlvbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl91cGRhdGVPcGVyYXRpb24udmFsdWU/LnJlcXVlc3QuY29udGV4dC5zZWxlY3RlZFN1Z2dlc3Rpb25JbmZvKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVPcGVyYXRpb24uY2xlYXIoKTtcblx0XHR9XG5cdFx0dGhpcy5zdWdnZXN0V2lkZ2V0SW5saW5lQ29tcGxldGlvbnMuc2V0KHVuZGVmaW5lZCwgdHgpO1xuXHR9XG5cblx0cHVibGljIGNhbmNlbFVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVPcGVyYXRpb24uY2xlYXIoKTtcblx0fVxufVxuXG5mdW5jdGlvbiB3YWl0KG1zOiBudW1iZXIsIGNhbmNlbGxhdGlvblRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdGxldCBkOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCBoYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmIChkKSB7IGQuZGlzcG9zZSgpOyB9XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fSwgbXMpO1xuXHRcdGlmIChjYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdFx0ZCA9IGNhbmNlbGxhdGlvblRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KGhhbmRsZSk7XG5cdFx0XHRcdGlmIChkKSB7IGQuZGlzcG9zZSgpOyB9XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG59XG5cbmNsYXNzIFVwZGF0ZVJlcXVlc3Qge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcG9zaXRpb246IFBvc2l0aW9uLFxuXHRcdHB1YmxpYyByZWFkb25seSBjb250ZXh0OiBJbmxpbmVDb21wbGV0aW9uQ29udGV4dCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdmVyc2lvbklkOiBudW1iZXIsXG5cdCkge1xuXHR9XG5cblx0cHVibGljIHNhdGlzZmllcyhvdGhlcjogVXBkYXRlUmVxdWVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnBvc2l0aW9uLmVxdWFscyhvdGhlci5wb3NpdGlvbilcblx0XHRcdCYmIGVxdWFsc0lmRGVmaW5lZCh0aGlzLmNvbnRleHQuc2VsZWN0ZWRTdWdnZXN0aW9uSW5mbywgb3RoZXIuY29udGV4dC5zZWxlY3RlZFN1Z2dlc3Rpb25JbmZvLCBpdGVtRXF1YWxzKCkpXG5cdFx0XHQmJiAob3RoZXIuY29udGV4dC50cmlnZ2VyS2luZCA9PT0gSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kLkF1dG9tYXRpY1xuXHRcdFx0XHR8fCB0aGlzLmNvbnRleHQudHJpZ2dlcktpbmQgPT09IElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZC5FeHBsaWNpdClcblx0XHRcdCYmIHRoaXMudmVyc2lvbklkID09PSBvdGhlci52ZXJzaW9uSWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzRXhwbGljaXRSZXF1ZXN0KCkge1xuXHRcdHJldHVybiB0aGlzLmNvbnRleHQudHJpZ2dlcktpbmQgPT09IElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZC5FeHBsaWNpdDtcblx0fVxufVxuXG5jbGFzcyBVcGRhdGVPcGVyYXRpb24gaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSByZXF1ZXN0OiBVcGRhdGVSZXF1ZXN0LFxuXHRcdHB1YmxpYyByZWFkb25seSBjYW5jZWxsYXRpb25Ub2tlblNvdXJjZTogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IHByb21pc2U6IFByb21pc2U8Ym9vbGVhbj4sXG5cdCkge1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLmNhbmNlbGxhdGlvblRva2VuU291cmNlLmNhbmNlbCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVcFRvRGF0ZUlubGluZUNvbXBsZXRpb25zIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbmxpbmVDb21wbGV0aW9uczogSW5saW5lQ29tcGxldGlvbldpdGhVcGRhdGVkUmFuZ2VbXTtcblx0cHVibGljIGdldCBpbmxpbmVDb21wbGV0aW9ucygpOiBSZWFkb25seUFycmF5PElubGluZUNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlPiB7IHJldHVybiB0aGlzLl9pbmxpbmVDb21wbGV0aW9uczsgfVxuXG5cdHByaXZhdGUgX3JlZkNvdW50ID0gMTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJlcGVuZGVkSW5saW5lQ29tcGxldGlvbkl0ZW1zOiBJbmxpbmVDb21wbGV0aW9uSXRlbVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpbmxpbmVDb21wbGV0aW9uUHJvdmlkZXJSZXN1bHQ6IElubGluZUNvbXBsZXRpb25Qcm92aWRlclJlc3VsdCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVxdWVzdDogVXBkYXRlUmVxdWVzdCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdmVyc2lvbklkOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8bnVtYmVyIHwgbnVsbCwgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB8IHVuZGVmaW5lZD4sXG5cdCkge1xuXHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25zID0gaW5saW5lQ29tcGxldGlvblByb3ZpZGVyUmVzdWx0LmNvbXBsZXRpb25zLm1hcChcblx0XHRcdGNvbXBsZXRpb24gPT4gbmV3IElubGluZUNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlKGNvbXBsZXRpb24sIHVuZGVmaW5lZCwgdGhpcy5fdGV4dE1vZGVsLCB0aGlzLl92ZXJzaW9uSWQsIHRoaXMucmVxdWVzdClcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIGNsb25lKCk6IHRoaXMge1xuXHRcdHRoaXMuX3JlZkNvdW50Kys7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWZDb3VudC0tO1xuXHRcdGlmICh0aGlzLl9yZWZDb3VudCA9PT0gMCkge1xuXHRcdFx0dGhpcy5pbmxpbmVDb21wbGV0aW9uUHJvdmlkZXJSZXN1bHQuZGlzcG9zZSgpO1xuXHRcdFx0Zm9yIChjb25zdCBpIG9mIHRoaXMuX3ByZXBlbmRlZElubGluZUNvbXBsZXRpb25JdGVtcykge1xuXHRcdFx0XHRpLnNvdXJjZS5yZW1vdmVSZWYoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25zLmZvckVhY2goaSA9PiBpLmRpc3Bvc2UoKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHByZXBlbmQoaW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbkl0ZW0sIHJhbmdlOiBSYW5nZSwgYWRkUmVmVG9Tb3VyY2U6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoYWRkUmVmVG9Tb3VyY2UpIHtcblx0XHRcdGlubGluZUNvbXBsZXRpb24uc291cmNlLmFkZFJlZigpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25zLnVuc2hpZnQobmV3IElubGluZUNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlKGlubGluZUNvbXBsZXRpb24sIHJhbmdlLCB0aGlzLl90ZXh0TW9kZWwsIHRoaXMuX3ZlcnNpb25JZCwgdGhpcy5yZXF1ZXN0KSk7XG5cdFx0dGhpcy5fcHJlcGVuZGVkSW5saW5lQ29tcGxldGlvbkl0ZW1zLnB1c2goaW5saW5lQ29tcGxldGlvbik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIElubGluZUNvbXBsZXRpb25XaXRoVXBkYXRlZFJhbmdlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHB1YmxpYyByZWFkb25seSBzZW1hbnRpY0lkID0gSlNPTi5zdHJpbmdpZnkoW1xuXHRcdHRoaXMuaW5saW5lQ29tcGxldGlvbi5maWx0ZXJUZXh0LFxuXHRcdHRoaXMuaW5saW5lQ29tcGxldGlvbi5pbnNlcnRUZXh0LFxuXHRcdHRoaXMuaW5saW5lQ29tcGxldGlvbi5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkudG9TdHJpbmcoKVxuXHRdKTtcblxuXHRwdWJsaWMgZ2V0IGZvcndhcmRTdGFibGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuc291cmNlLmlubGluZUNvbXBsZXRpb25zLmVuYWJsZUZvcndhcmRTdGFiaWxpdHkgPz8gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF91cGRhdGVkRWRpdE9iajogVXBkYXRlZEVkaXQ7IC8vIGhlbHBlciBhcyBkZXJpdmVkSGFuZGxlQ2hhbmdlcyBjYW4gbm90IGFjY2VzcyBwcmV2aW91cyB2YWx1ZVxuXHRwdWJsaWMgZ2V0IHVwZGF0ZWRFZGl0KCk6IElPYnNlcnZhYmxlPE9mZnNldEVkaXQgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHRoaXMuX3VwZGF0ZWRFZGl0T2JqLm9mZnNldEVkaXQ7IH1cblx0cHVibGljIGdldCB1cGRhdGVkRWRpdE1vZGVsVmVyc2lvbigpIHsgcmV0dXJuIHRoaXMuX3VwZGF0ZWRFZGl0T2JqLm1vZGVsVmVyc2lvbjsgfVxuXG5cdHB1YmxpYyBnZXQgc291cmNlKCkgeyByZXR1cm4gdGhpcy5pbmxpbmVDb21wbGV0aW9uLnNvdXJjZTsgfVxuXHRwdWJsaWMgZ2V0IHNvdXJjZUlubGluZUNvbXBsZXRpb24oKSB7IHJldHVybiB0aGlzLmlubGluZUNvbXBsZXRpb24uc291cmNlSW5saW5lQ29tcGxldGlvbjsgfVxuXHRwdWJsaWMgZ2V0IGlzSW5saW5lRWRpdCgpIHsgcmV0dXJuIHRoaXMuaW5saW5lQ29tcGxldGlvbi5pc0lubGluZUVkaXQ7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgaW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbkl0ZW0sXG5cdFx0dXBkYXRlZFJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxWZXJzaW9uOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8bnVtYmVyIHwgbnVsbCwgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB8IHVuZGVmaW5lZD4sXG5cdFx0cHVibGljIHJlYWRvbmx5IHJlcXVlc3Q6IFVwZGF0ZVJlcXVlc3QsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl91cGRhdGVkRWRpdE9iaiA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RvVXBkYXRlZEVkaXQodXBkYXRlZFJhbmdlID8/IHRoaXMuaW5saW5lQ29tcGxldGlvbi5yYW5nZSwgdGhpcy5pbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQpKTtcblx0fVxuXG5cdHB1YmxpYyB0b0lubGluZUNvbXBsZXRpb24ocmVhZGVyOiBJUmVhZGVyIHwgdW5kZWZpbmVkKTogSW5saW5lQ29tcGxldGlvbkl0ZW0ge1xuXHRcdGNvbnN0IHNpbmdsZVRleHRFZGl0ID0gdGhpcy50b1NpbmdsZVRleHRFZGl0KHJlYWRlcik7XG5cdFx0cmV0dXJuIHRoaXMuaW5saW5lQ29tcGxldGlvbi53aXRoUmFuZ2VJbnNlcnRUZXh0QW5kRmlsdGVyVGV4dChzaW5nbGVUZXh0RWRpdC5yYW5nZSwgc2luZ2xlVGV4dEVkaXQudGV4dCwgc2luZ2xlVGV4dEVkaXQudGV4dCk7XG5cdH1cblxuXHRwdWJsaWMgdG9TaW5nbGVUZXh0RWRpdChyZWFkZXI6IElSZWFkZXIgfCB1bmRlZmluZWQpOiBTaW5nbGVUZXh0RWRpdCB7XG5cdFx0dGhpcy5fbW9kZWxWZXJzaW9uLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBvZmZzZXRFZGl0ID0gdGhpcy51cGRhdGVkRWRpdC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFvZmZzZXRFZGl0KSB7XG5cdFx0XHRyZXR1cm4gbmV3IFNpbmdsZVRleHRFZGl0KHRoaXMuX3VwZGF0ZWRSYW5nZS5yZWFkKHJlYWRlcikgPz8gZW1wdHlSYW5nZSwgdGhpcy5pbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gb2Zmc2V0RWRpdC5lZGl0c1swXS5yZXBsYWNlUmFuZ2Uuc3RhcnQ7XG5cdFx0Y29uc3QgZW5kT2Zmc2V0ID0gb2Zmc2V0RWRpdC5lZGl0c1tvZmZzZXRFZGl0LmVkaXRzLmxlbmd0aCAtIDFdLnJlcGxhY2VSYW5nZS5lbmRFeGNsdXNpdmU7XG5cdFx0Y29uc3Qgb3ZlcmFsbE9mZnNldFJhbmdlID0gbmV3IE9mZnNldFJhbmdlKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpO1xuXHRcdGNvbnN0IG92ZXJhbGxMbkNvbFJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhcblx0XHRcdHRoaXMuX3RleHRNb2RlbC5nZXRQb3NpdGlvbkF0KG92ZXJhbGxPZmZzZXRSYW5nZS5zdGFydCksXG5cdFx0XHR0aGlzLl90ZXh0TW9kZWwuZ2V0UG9zaXRpb25BdChvdmVyYWxsT2Zmc2V0UmFuZ2UuZW5kRXhjbHVzaXZlKVxuXHRcdCk7XG5cdFx0bGV0IHRleHQgPSB0aGlzLl90ZXh0TW9kZWwuZ2V0VmFsdWVJblJhbmdlKG92ZXJhbGxMbkNvbFJhbmdlKTtcblx0XHRmb3IgKGxldCBpID0gb2Zmc2V0RWRpdC5lZGl0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgZWRpdCA9IG9mZnNldEVkaXQuZWRpdHNbaV07XG5cdFx0XHRjb25zdCByZWxhdGl2ZVN0YXJ0T2Zmc2V0ID0gZWRpdC5yZXBsYWNlUmFuZ2Uuc3RhcnQgLSBzdGFydE9mZnNldDtcblx0XHRcdGNvbnN0IHJlbGF0aXZlRW5kT2Zmc2V0ID0gZWRpdC5yZXBsYWNlUmFuZ2UuZW5kRXhjbHVzaXZlIC0gc3RhcnRPZmZzZXQ7XG5cdFx0XHR0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgcmVsYXRpdmVTdGFydE9mZnNldCkgKyBlZGl0Lm5ld1RleHQgKyB0ZXh0LnN1YnN0cmluZyhyZWxhdGl2ZUVuZE9mZnNldCk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgU2luZ2xlVGV4dEVkaXQob3ZlcmFsbExuQ29sUmFuZ2UsIHRleHQpO1xuXHR9XG5cblx0cHVibGljIGlzVmlzaWJsZShtb2RlbDogSVRleHRNb2RlbCwgY3Vyc29yUG9zaXRpb246IFBvc2l0aW9uLCByZWFkZXI6IElSZWFkZXIgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRjb25zdCBtaW5pbWl6ZWRSZXBsYWNlbWVudCA9IHNpbmdsZVRleHRSZW1vdmVDb21tb25QcmVmaXgodGhpcy50b1NpbmdsZVRleHRFZGl0KHJlYWRlciksIG1vZGVsKTtcblx0XHRjb25zdCB1cGRhdGVkUmFuZ2UgPSB0aGlzLl91cGRhdGVkUmFuZ2UucmVhZChyZWFkZXIpO1xuXHRcdGlmIChcblx0XHRcdCF1cGRhdGVkUmFuZ2Vcblx0XHRcdHx8ICF0aGlzLmlubGluZUNvbXBsZXRpb24ucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpLmVxdWFscyh1cGRhdGVkUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKVxuXHRcdFx0fHwgY3Vyc29yUG9zaXRpb24ubGluZU51bWJlciAhPT0gbWluaW1pemVkUmVwbGFjZW1lbnQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyXG5cdFx0XHR8fCBtaW5pbWl6ZWRSZXBsYWNlbWVudC5pc0VtcHR5IC8vIGlmIHRoZSBjb21wbGV0aW9uIGlzIGVtcHR5IGFmdGVyIHJlbW92aW5nIHRoZSBjb21tb24gcHJlZml4IG9mIHRoZSBjb21wbGV0aW9uIGFuZCB0aGUgbW9kZWwsIHRoZSBjb21wbGV0aW9uIGl0ZW0gd291bGQgbm90IGJlIHZpc2libGVcblx0XHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBXZSBtaWdodCBjb25zaWRlciBjb21wYXJpbmcgYnkgLnRvTG93ZXJUZXh0LCBidXQgdGhpcyByZXF1aXJlcyBHaG9zdFRleHRSZXBsYWNlbWVudFxuXHRcdGNvbnN0IG9yaWdpbmFsVmFsdWUgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UobWluaW1pemVkUmVwbGFjZW1lbnQucmFuZ2UsIEVuZE9mTGluZVByZWZlcmVuY2UuTEYpO1xuXHRcdGNvbnN0IGZpbHRlclRleHQgPSBtaW5pbWl6ZWRSZXBsYWNlbWVudC50ZXh0O1xuXG5cdFx0Y29uc3QgY3Vyc29yUG9zSW5kZXggPSBNYXRoLm1heCgwLCBjdXJzb3JQb3NpdGlvbi5jb2x1bW4gLSBtaW5pbWl6ZWRSZXBsYWNlbWVudC5yYW5nZS5zdGFydENvbHVtbik7XG5cblx0XHRsZXQgZmlsdGVyVGV4dEJlZm9yZSA9IGZpbHRlclRleHQuc3Vic3RyaW5nKDAsIGN1cnNvclBvc0luZGV4KTtcblx0XHRsZXQgZmlsdGVyVGV4dEFmdGVyID0gZmlsdGVyVGV4dC5zdWJzdHJpbmcoY3Vyc29yUG9zSW5kZXgpO1xuXG5cdFx0bGV0IG9yaWdpbmFsVmFsdWVCZWZvcmUgPSBvcmlnaW5hbFZhbHVlLnN1YnN0cmluZygwLCBjdXJzb3JQb3NJbmRleCk7XG5cdFx0bGV0IG9yaWdpbmFsVmFsdWVBZnRlciA9IG9yaWdpbmFsVmFsdWUuc3Vic3RyaW5nKGN1cnNvclBvc0luZGV4KTtcblxuXHRcdGNvbnN0IG9yaWdpbmFsVmFsdWVJbmRlbnQgPSBtb2RlbC5nZXRMaW5lSW5kZW50Q29sdW1uKG1pbmltaXplZFJlcGxhY2VtZW50LnJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0aWYgKG1pbmltaXplZFJlcGxhY2VtZW50LnJhbmdlLnN0YXJ0Q29sdW1uIDw9IG9yaWdpbmFsVmFsdWVJbmRlbnQpIHtcblx0XHRcdC8vIFJlbW92ZSBpbmRlbnRhdGlvblxuXHRcdFx0b3JpZ2luYWxWYWx1ZUJlZm9yZSA9IG9yaWdpbmFsVmFsdWVCZWZvcmUudHJpbVN0YXJ0KCk7XG5cdFx0XHRpZiAob3JpZ2luYWxWYWx1ZUJlZm9yZS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0b3JpZ2luYWxWYWx1ZUFmdGVyID0gb3JpZ2luYWxWYWx1ZUFmdGVyLnRyaW1TdGFydCgpO1xuXHRcdFx0fVxuXHRcdFx0ZmlsdGVyVGV4dEJlZm9yZSA9IGZpbHRlclRleHRCZWZvcmUudHJpbVN0YXJ0KCk7XG5cdFx0XHRpZiAoZmlsdGVyVGV4dEJlZm9yZS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0ZmlsdGVyVGV4dEFmdGVyID0gZmlsdGVyVGV4dEFmdGVyLnRyaW1TdGFydCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmaWx0ZXJUZXh0QmVmb3JlLnN0YXJ0c1dpdGgob3JpZ2luYWxWYWx1ZUJlZm9yZSlcblx0XHRcdCYmICEhbWF0Y2hlc1N1YlN0cmluZyhvcmlnaW5hbFZhbHVlQWZ0ZXIsIGZpbHRlclRleHRBZnRlcik7XG5cdH1cblxuXHRwdWJsaWMgcmV1c2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fdXBkYXRlZEVkaXRPYmoucmV1c2UoKTtcblx0fVxuXG5cdHB1YmxpYyBjYW5CZVJldXNlZChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLnVwZGF0ZWRFZGl0LmdldCgpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc291cmNlSW5saW5lQ29tcGxldGlvbi5pc0lubGluZUVkaXQpIHtcblx0XHRcdHJldHVybiB0aGlzLl91cGRhdGVkRWRpdE9iai5sYXN0Q2hhbmdlUGFydE9mSW5saW5lRWRpdDtcblx0XHR9XG5cblx0XHRjb25zdCB1cGRhdGVkUmFuZ2UgPSB0aGlzLl91cGRhdGVkUmFuZ2UucmVhZCh1bmRlZmluZWQpO1xuXHRcdGNvbnN0IHJlc3VsdCA9ICEhdXBkYXRlZFJhbmdlXG5cdFx0XHQmJiB1cGRhdGVkUmFuZ2UuY29udGFpbnNQb3NpdGlvbihwb3NpdGlvbilcblx0XHRcdCYmIHRoaXMuaXNWaXNpYmxlKG1vZGVsLCBwb3NpdGlvbiwgdW5kZWZpbmVkKVxuXHRcdFx0JiYgVGV4dExlbmd0aC5vZlJhbmdlKHVwZGF0ZWRSYW5nZSkuaXNHcmVhdGVyVGhhbk9yRXF1YWxUbyhUZXh0TGVuZ3RoLm9mUmFuZ2UodGhpcy5pbmxpbmVDb21wbGV0aW9uLnJhbmdlKSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3VwZGF0ZWRSYW5nZSA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRjb25zdCBlZGl0ID0gdGhpcy51cGRhdGVkRWRpdC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFlZGl0IHx8IGVkaXQuZWRpdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBSYW5nZS5mcm9tUG9zaXRpb25zKFxuXHRcdFx0dGhpcy5fdGV4dE1vZGVsLmdldFBvc2l0aW9uQXQoZWRpdC5lZGl0c1swXS5yZXBsYWNlUmFuZ2Uuc3RhcnQpLFxuXHRcdFx0dGhpcy5fdGV4dE1vZGVsLmdldFBvc2l0aW9uQXQoZWRpdC5lZGl0c1tlZGl0LmVkaXRzLmxlbmd0aCAtIDFdLnJlcGxhY2VSYW5nZS5lbmRFeGNsdXNpdmUpXG5cdFx0KTtcblx0fSk7XG5cblx0cHJpdmF0ZSBfdG9VcGRhdGVkRWRpdChlZGl0UmFuZ2U6IFJhbmdlLCByZXBsYWNlVGV4dDogc3RyaW5nKTogVXBkYXRlZEVkaXQge1xuXHRcdHJldHVybiB0aGlzLmlzSW5saW5lRWRpdFxuXHRcdFx0PyB0aGlzLl90b0lubGluZUVkaXRFZGl0KGVkaXRSYW5nZSwgcmVwbGFjZVRleHQpXG5cdFx0XHQ6IHRoaXMuX3RvSW5saW5lQ29tcGxldGlvbkVkaXQoZWRpdFJhbmdlLCByZXBsYWNlVGV4dCk7XG5cdH1cblxuXHRwcml2YXRlIF90b0lubGluZUNvbXBsZXRpb25FZGl0KGVkaXRSYW5nZTogUmFuZ2UsIHJlcGxhY2VUZXh0OiBzdHJpbmcpOiBVcGRhdGVkRWRpdCB7XG5cdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLl90ZXh0TW9kZWwuZ2V0T2Zmc2V0QXQoZWRpdFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0Y29uc3QgZW5kT2Zmc2V0ID0gdGhpcy5fdGV4dE1vZGVsLmdldE9mZnNldEF0KGVkaXRSYW5nZS5nZXRFbmRQb3NpdGlvbigpKTtcblx0XHRjb25zdCBvcmlnaW5hbFJhbmdlID0gT2Zmc2V0UmFuZ2Uub2ZTdGFydEFuZExlbmd0aChzdGFydE9mZnNldCwgZW5kT2Zmc2V0IC0gc3RhcnRPZmZzZXQpO1xuXHRcdGNvbnN0IG9mZnNldEVkaXQgPSBuZXcgT2Zmc2V0RWRpdChbbmV3IFNpbmdsZU9mZnNldEVkaXQob3JpZ2luYWxSYW5nZSwgcmVwbGFjZVRleHQpXSk7XG5cdFx0cmV0dXJuIG5ldyBVcGRhdGVkRWRpdChvZmZzZXRFZGl0LCB0aGlzLl90ZXh0TW9kZWwsIHRoaXMuX21vZGVsVmVyc2lvbiwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdG9JbmxpbmVFZGl0RWRpdChlZGl0UmFuZ2U6IFJhbmdlLCByZXBsYWNlVGV4dDogc3RyaW5nKTogVXBkYXRlZEVkaXQge1xuXHRcdGNvbnN0IGVvbCA9IHRoaXMuX3RleHRNb2RlbC5nZXRFT0woKTtcblx0XHRjb25zdCBlZGl0T3JpZ2luYWxUZXh0ID0gdGhpcy5fdGV4dE1vZGVsLmdldFZhbHVlSW5SYW5nZShlZGl0UmFuZ2UpO1xuXHRcdGNvbnN0IGVkaXRSZXBsYWNlVGV4dCA9IHJlcGxhY2VUZXh0LnJlcGxhY2UoL1xcclxcbnxcXHJ8XFxuL2csIGVvbCk7XG5cblx0XHRjb25zdCBkaWZmQWxnb3JpdGhtID0gbGluZXNEaWZmQ29tcHV0ZXJzLmdldERlZmF1bHQoKTtcblx0XHRjb25zdCBsaW5lRGlmZnMgPSBkaWZmQWxnb3JpdGhtLmNvbXB1dGVEaWZmKFxuXHRcdFx0c3BsaXRMaW5lcyhlZGl0T3JpZ2luYWxUZXh0KSxcblx0XHRcdHNwbGl0TGluZXMoZWRpdFJlcGxhY2VUZXh0KSxcblx0XHRcdHtcblx0XHRcdFx0aWdub3JlVHJpbVdoaXRlc3BhY2U6IGZhbHNlLFxuXHRcdFx0XHRjb21wdXRlTW92ZXM6IGZhbHNlLFxuXHRcdFx0XHRleHRlbmRUb1N1YndvcmRzOiB0cnVlLFxuXHRcdFx0XHRtYXhDb21wdXRhdGlvblRpbWVNczogNTAwLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRjb25zdCBpbm5lckNoYW5nZXMgPSBsaW5lRGlmZnMuY2hhbmdlcy5mbGF0TWFwKGMgPT4gYy5pbm5lckNoYW5nZXMgPz8gW10pO1xuXG5cdFx0ZnVuY3Rpb24gYWRkUmFuZ2VUb1Bvcyhwb3M6IFBvc2l0aW9uLCByYW5nZTogUmFuZ2UpOiBSYW5nZSB7XG5cdFx0XHRjb25zdCBzdGFydCA9IFRleHRMZW5ndGguZnJvbVBvc2l0aW9uKHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0XHRyZXR1cm4gVGV4dExlbmd0aC5vZlJhbmdlKHJhbmdlKS5jcmVhdGVSYW5nZShzdGFydC5hZGRUb1Bvc2l0aW9uKHBvcykpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGlmaWVkVGV4dCA9IG5ldyBTdHJpbmdUZXh0KGVkaXRSZXBsYWNlVGV4dCk7XG5cblx0XHRjb25zdCBvZmZzZXRFZGl0ID0gbmV3IE9mZnNldEVkaXQoXG5cdFx0XHRpbm5lckNoYW5nZXMubWFwKGMgPT4ge1xuXHRcdFx0XHRjb25zdCByYW5nZSA9IGFkZFJhbmdlVG9Qb3MoZWRpdFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSwgYy5vcmlnaW5hbFJhbmdlKTtcblx0XHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLl90ZXh0TW9kZWwuZ2V0T2Zmc2V0QXQocmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdFx0Y29uc3QgZW5kT2Zmc2V0ID0gdGhpcy5fdGV4dE1vZGVsLmdldE9mZnNldEF0KHJhbmdlLmdldEVuZFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRjb25zdCBvcmlnaW5hbFJhbmdlID0gT2Zmc2V0UmFuZ2Uub2ZTdGFydEFuZExlbmd0aChzdGFydE9mZnNldCwgZW5kT2Zmc2V0IC0gc3RhcnRPZmZzZXQpO1xuXG5cdFx0XHRcdGNvbnN0IHJlcGxhY2VUZXh0ID0gbW9kaWZpZWRUZXh0LmdldFZhbHVlT2ZSYW5nZShjLm1vZGlmaWVkUmFuZ2UpO1xuXHRcdFx0XHRjb25zdCBvcmlnaW5hbFRleHQgPSB0aGlzLl90ZXh0TW9kZWwuZ2V0VmFsdWVJblJhbmdlKHJhbmdlKTtcblx0XHRcdFx0Y29uc3QgZWRpdCA9IG5ldyBTaW5nbGVPZmZzZXRFZGl0KG9yaWdpbmFsUmFuZ2UsIHJlcGxhY2VUZXh0KTtcblxuXHRcdFx0XHRyZXR1cm4gcmVzaGFwZUVkaXQoZWRpdCwgb3JpZ2luYWxUZXh0LCBpbm5lckNoYW5nZXMubGVuZ3RoLCB0aGlzLl90ZXh0TW9kZWwpO1xuXHRcdFx0fSlcblx0XHQpO1xuXG5cdFx0cmV0dXJuIG5ldyBVcGRhdGVkRWRpdChvZmZzZXRFZGl0LCB0aGlzLl90ZXh0TW9kZWwsIHRoaXMuX21vZGVsVmVyc2lvbiwgdHJ1ZSk7XG5cdH1cbn1cblxuY2xhc3MgVXBkYXRlZEVkaXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9pbm5lckVkaXRzOiBTaW5nbGVVcGRhdGVkRWRpdFtdO1xuXG5cdHByaXZhdGUgX2lubGluZUVkaXRNb2RlbFZlcnNpb246IG51bWJlcjtcblx0cHVibGljIGdldCBtb2RlbFZlcnNpb24oKSB7IHJldHVybiB0aGlzLl9pbmxpbmVFZGl0TW9kZWxWZXJzaW9uOyB9XG5cblx0cHJpdmF0ZSBfbGFzdENoYW5nZVBhcnRPZklubGluZUVkaXQgPSBmYWxzZTtcblx0cHVibGljIGdldCBsYXN0Q2hhbmdlUGFydE9mSW5saW5lRWRpdCgpIHsgcmV0dXJuIHRoaXMuX2xhc3RDaGFuZ2VQYXJ0T2ZJbmxpbmVFZGl0OyB9XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF91cGRhdGVkRWRpdCA9IGRlcml2ZWRIYW5kbGVDaGFuZ2VzPE9mZnNldEVkaXQgfCB1bmRlZmluZWQgfCBudWxsLCBPZmZzZXRFZGl0W10+KHtcblx0XHRvd25lcjogdGhpcyxcblx0XHRlcXVhbGl0eUNvbXBhcmVyOiBlcXVhbHNJZkRlZmluZWQoKGEsIGIpID0+IGE/LmVxdWFscyhiKSksXG5cdFx0Y3JlYXRlRW1wdHlDaGFuZ2VTdW1tYXJ5OiAoKSA9PiBbXSBhcyBPZmZzZXRFZGl0W10sXG5cdFx0aGFuZGxlQ2hhbmdlOiAoY29udGV4dCwgY2hhbmdlU3VtbWFyeSkgPT4ge1xuXHRcdFx0aWYgKGNvbnRleHQuZGlkQ2hhbmdlKHRoaXMuX21vZGVsVmVyc2lvbikgJiYgY29udGV4dC5jaGFuZ2UpIHtcblx0XHRcdFx0Y2hhbmdlU3VtbWFyeS5wdXNoKE9mZnNldEVkaXRzLmZyb21Db250ZW50Q2hhbmdlcyhjb250ZXh0LmNoYW5nZS5jaGFuZ2VzKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH0sIChyZWFkZXIsIGNoYW5nZVN1bW1hcnkpID0+IHtcblx0XHR0aGlzLl9tb2RlbFZlcnNpb24ucmVhZChyZWFkZXIpO1xuXG5cdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgY2hhbmdlU3VtbWFyeSkge1xuXHRcdFx0dGhpcy5faW5uZXJFZGl0cyA9IHRoaXMuX2FwcGx5VGV4dE1vZGVsQ2hhbmdlcyhjaGFuZ2UsIHRoaXMuX2lubmVyRWRpdHMpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9pbm5lckVkaXRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5faW5uZXJFZGl0cy5zb21lKGUgPT4gZS5lZGl0ID09PSB1bmRlZmluZWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdVcGRhdGVkRWRpdDogSW52YWxpZCBzdGF0ZScpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgT2Zmc2V0RWRpdCh0aGlzLl9pbm5lckVkaXRzLm1hcChlZGl0ID0+IGVkaXQuZWRpdCEpKTtcblx0fSk7XG5cblx0cHVibGljIGdldCBvZmZzZXRFZGl0KCk6IElPYnNlcnZhYmxlPE9mZnNldEVkaXQgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHRoaXMuX3VwZGF0ZWRFZGl0Lm1hcChlID0+IGUgPz8gdW5kZWZpbmVkKTsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9mZnNldEVkaXQ6IE9mZnNldEVkaXQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsVmVyc2lvbjogSU9ic2VydmFibGVXaXRoQ2hhbmdlPG51bWJlciB8IG51bGwsIElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQgfCB1bmRlZmluZWQ+LFxuXHRcdGlzSW5saW5lRWRpdDogYm9vbGVhbixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2lubGluZUVkaXRNb2RlbFZlcnNpb24gPSB0aGlzLl9tb2RlbFZlcnNpb24uZ2V0KCkgPz8gLTE7XG5cblx0XHR0aGlzLl9pbm5lckVkaXRzID0gb2Zmc2V0RWRpdC5lZGl0cy5tYXAoZWRpdCA9PiB7XG5cdFx0XHRpZiAoaXNJbmxpbmVFZGl0KSB7XG5cdFx0XHRcdGNvbnN0IHJlcGxhY2VkUmFuZ2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKHRoaXMuX3RleHRNb2RlbC5nZXRQb3NpdGlvbkF0KGVkaXQucmVwbGFjZVJhbmdlLnN0YXJ0KSwgdGhpcy5fdGV4dE1vZGVsLmdldFBvc2l0aW9uQXQoZWRpdC5yZXBsYWNlUmFuZ2UuZW5kRXhjbHVzaXZlKSk7XG5cdFx0XHRcdGNvbnN0IHJlcGxhY2VkVGV4dCA9IHRoaXMuX3RleHRNb2RlbC5nZXRWYWx1ZUluUmFuZ2UocmVwbGFjZWRSYW5nZSk7XG5cdFx0XHRcdHJldHVybiBuZXcgU2luZ2xlVXBkYXRlZE5leHRFZGl0KGVkaXQsIHJlcGxhY2VkVGV4dCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBuZXcgU2luZ2xlVXBkYXRlZENvbXBsZXRpb24oZWRpdCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl91cGRhdGVkRWRpdC5yZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9zdG9yZSk7IC8vIG1ha2Ugc3VyZSB0byBjYWxsIHRoaXMgYWZ0ZXIgc2V0dGluZyBgX2xhc3RFZGl0YFxuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlUZXh0TW9kZWxDaGFuZ2VzKHRleHRNb2RlbENoYW5nZXM6IE9mZnNldEVkaXQsIGVkaXRzOiBTaW5nbGVVcGRhdGVkRWRpdFtdKTogU2luZ2xlVXBkYXRlZEVkaXRbXSB7XG5cdFx0Zm9yIChjb25zdCBpbm5lckVkaXQgb2YgZWRpdHMpIHtcblx0XHRcdGlubmVyRWRpdC5hcHBseVRleHRNb2RlbENoYW5nZXModGV4dE1vZGVsQ2hhbmdlcyk7XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRzLnNvbWUoZWRpdCA9PiBlZGl0LmVkaXQgPT09IHVuZGVmaW5lZCkpIHtcblx0XHRcdHJldHVybiBbXTsgLy8gY2hhbmdlIGlzIGludmFsaWQsIHNvIHdlIHdpbGwgaGF2ZSB0byBkcm9wIHRoZSBjb21wbGV0aW9uXG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudE1vZGVsVmVyc2lvbiA9IHRoaXMuX21vZGVsVmVyc2lvbi5nZXQoKTtcblxuXHRcdHRoaXMuX2xhc3RDaGFuZ2VQYXJ0T2ZJbmxpbmVFZGl0ID0gZWRpdHMuc29tZShlZGl0ID0+IGVkaXQubGFzdENoYW5nZVVwZGF0ZWRFZGl0KTtcblx0XHRpZiAodGhpcy5fbGFzdENoYW5nZVBhcnRPZklubGluZUVkaXQpIHtcblx0XHRcdHRoaXMuX2lubGluZUVkaXRNb2RlbFZlcnNpb24gPSBjdXJyZW50TW9kZWxWZXJzaW9uID8/IC0xO1xuXHRcdH1cblxuXHRcdGlmIChjdXJyZW50TW9kZWxWZXJzaW9uID09PSBudWxsIHx8IHRoaXMuX2lubGluZUVkaXRNb2RlbFZlcnNpb24gKyAyMCA8IGN1cnJlbnRNb2RlbFZlcnNpb24pIHtcblx0XHRcdHJldHVybiBbXTsgLy8gdGhlIGNvbXBsZXRpb24gaGFzIGJlZW4gaWdub3JlZCBmb3IgYSB3aGlsZSwgcmVtb3ZlIGl0XG5cdFx0fVxuXG5cdFx0ZWRpdHMgPSBlZGl0cy5maWx0ZXIoaW5uZXJFZGl0ID0+ICFpbm5lckVkaXQuZWRpdCEuaXNFbXB0eSk7XG5cdFx0aWYgKGVkaXRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIFtdOyAvLyB0aGUgY29tcGxldGlvbiBoYXMgYmVlbiB0eXBlZCBieSB0aGUgdXNlclxuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0cztcblx0fVxuXG5cdHJldXNlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2lubGluZUVkaXRNb2RlbFZlcnNpb24gPSB0aGlzLl9tb2RlbFZlcnNpb24uZ2V0KCkgPz8gLTE7XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgU2luZ2xlVXBkYXRlZEVkaXQge1xuXG5cdHByaXZhdGUgX2VkaXQ6IFNpbmdsZU9mZnNldEVkaXQgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBnZXQgZWRpdCgpIHsgcmV0dXJuIHRoaXMuX2VkaXQ7IH1cblxuXHRwcml2YXRlIF9sYXN0Q2hhbmdlVXBkYXRlZEVkaXQgPSBmYWxzZTtcblx0cHVibGljIGdldCBsYXN0Q2hhbmdlVXBkYXRlZEVkaXQoKSB7IHJldHVybiB0aGlzLl9sYXN0Q2hhbmdlVXBkYXRlZEVkaXQ7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0OiBTaW5nbGVPZmZzZXRFZGl0LFxuXHQpIHtcblx0XHR0aGlzLl9lZGl0ID0gZWRpdDtcblx0fVxuXG5cdHB1YmxpYyBhcHBseVRleHRNb2RlbENoYW5nZXModGV4dE1vZGVsQ2hhbmdlczogT2Zmc2V0RWRpdCkge1xuXHRcdHRoaXMuX2xhc3RDaGFuZ2VVcGRhdGVkRWRpdCA9IGZhbHNlO1xuXG5cdFx0aWYgKCF0aGlzLl9lZGl0KSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdVcGRhdGVkSW5uZXJFZGl0czogTm8gZWRpdCB0byBhcHBseSBjaGFuZ2VzIHRvJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5hcHBseUNoYW5nZXModGhpcy5fZWRpdCwgdGV4dE1vZGVsQ2hhbmdlcyk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHRoaXMuX2VkaXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdCA9IHJlc3VsdC5lZGl0O1xuXHRcdHRoaXMuX2xhc3RDaGFuZ2VVcGRhdGVkRWRpdCA9IHJlc3VsdC5lZGl0SGFzQ2hhbmdlZDtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBhcHBseUNoYW5nZXMoZWRpdDogU2luZ2xlT2Zmc2V0RWRpdCwgdGV4dE1vZGVsQ2hhbmdlczogT2Zmc2V0RWRpdCk6IHsgZWRpdDogU2luZ2xlT2Zmc2V0RWRpdDsgZWRpdEhhc0NoYW5nZWQ6IGJvb2xlYW4gfSB8IHVuZGVmaW5lZDtcbn1cblxuY2xhc3MgU2luZ2xlVXBkYXRlZENvbXBsZXRpb24gZXh0ZW5kcyBTaW5nbGVVcGRhdGVkRWRpdCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdDogU2luZ2xlT2Zmc2V0RWRpdCxcblx0KSB7XG5cdFx0c3VwZXIoZWRpdCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXBwbHlDaGFuZ2VzKGVkaXQ6IFNpbmdsZU9mZnNldEVkaXQsIHRleHRNb2RlbENoYW5nZXM6IE9mZnNldEVkaXQpOiB7IGVkaXQ6IFNpbmdsZU9mZnNldEVkaXQ7IGVkaXRIYXNDaGFuZ2VkOiBib29sZWFuIH0ge1xuXHRcdGNvbnN0IG5ld0VkaXRSYW5nZSA9IGFwcGx5RWRpdHNUb1JhbmdlcyhbZWRpdC5yZXBsYWNlUmFuZ2VdLCB0ZXh0TW9kZWxDaGFuZ2VzKVswXTtcblx0XHRyZXR1cm4geyBlZGl0OiBuZXcgU2luZ2xlT2Zmc2V0RWRpdChuZXdFZGl0UmFuZ2UsIGVkaXQubmV3VGV4dCksIGVkaXRIYXNDaGFuZ2VkOiAhbmV3RWRpdFJhbmdlLmVxdWFscyhlZGl0LnJlcGxhY2VSYW5nZSkgfTtcblx0fVxufVxuXG5jbGFzcyBTaW5nbGVVcGRhdGVkTmV4dEVkaXQgZXh0ZW5kcyBTaW5nbGVVcGRhdGVkRWRpdCB7XG5cblx0cHJpdmF0ZSBfdHJpbW1lZE5ld1RleHQ6IHN0cmluZztcblx0cHJpdmF0ZSBfcHJlZml4TGVuZ3RoOiBudW1iZXI7XG5cdHByaXZhdGUgX3N1ZmZpeExlbmd0aDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXQ6IFNpbmdsZU9mZnNldEVkaXQsXG5cdFx0cmVwbGFjZWRUZXh0OiBzdHJpbmcsXG5cdCkge1xuXHRcdHN1cGVyKGVkaXQpO1xuXG5cdFx0dGhpcy5fcHJlZml4TGVuZ3RoID0gY29tbW9uUHJlZml4TGVuZ3RoKGVkaXQubmV3VGV4dCwgcmVwbGFjZWRUZXh0KTtcblx0XHR0aGlzLl9zdWZmaXhMZW5ndGggPSBjb21tb25TdWZmaXhMZW5ndGgoZWRpdC5uZXdUZXh0LCByZXBsYWNlZFRleHQpO1xuXHRcdHRoaXMuX3RyaW1tZWROZXdUZXh0ID0gZWRpdC5uZXdUZXh0LnN1YnN0cmluZyh0aGlzLl9wcmVmaXhMZW5ndGgsIGVkaXQubmV3VGV4dC5sZW5ndGggLSB0aGlzLl9zdWZmaXhMZW5ndGgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFwcGx5Q2hhbmdlcyhlZGl0OiBTaW5nbGVPZmZzZXRFZGl0LCB0ZXh0TW9kZWxDaGFuZ2VzOiBPZmZzZXRFZGl0KTogeyBlZGl0OiBTaW5nbGVPZmZzZXRFZGl0OyBlZGl0SGFzQ2hhbmdlZDogYm9vbGVhbiB9IHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgZWRpdFN0YXJ0ID0gZWRpdC5yZXBsYWNlUmFuZ2Uuc3RhcnQ7XG5cdFx0bGV0IGVkaXRFbmQgPSBlZGl0LnJlcGxhY2VSYW5nZS5lbmRFeGNsdXNpdmU7XG5cdFx0bGV0IGVkaXRSZXBsYWNlVGV4dCA9IGVkaXQubmV3VGV4dDtcblx0XHRsZXQgZWRpdEhhc0NoYW5nZWQgPSBmYWxzZTtcblxuXHRcdGNvbnN0IHNob3VsZFByZXNlcnZlRWRpdFNoYXBlID0gdGhpcy5fcHJlZml4TGVuZ3RoID4gMCB8fCB0aGlzLl9zdWZmaXhMZW5ndGggPiAwO1xuXG5cdFx0Zm9yIChsZXQgaSA9IHRleHRNb2RlbENoYW5nZXMuZWRpdHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IGNoYW5nZSA9IHRleHRNb2RlbENoYW5nZXMuZWRpdHNbaV07XG5cblx0XHRcdC8vIElOU0VSVElPTlMgKG9ubHkgc3VwcG9ydCBpbnNlcnRpbmcgYXQgc3RhcnQgb2YgZWRpdClcblx0XHRcdGNvbnN0IGlzSW5zZXJ0aW9uID0gY2hhbmdlLm5ld1RleHQubGVuZ3RoID4gMCAmJiBjaGFuZ2UucmVwbGFjZVJhbmdlLmlzRW1wdHk7XG5cblx0XHRcdGlmIChpc0luc2VydGlvbiAmJiAhc2hvdWxkUHJlc2VydmVFZGl0U2hhcGUgJiYgY2hhbmdlLnJlcGxhY2VSYW5nZS5zdGFydCA9PT0gZWRpdFN0YXJ0ICYmIGVkaXRSZXBsYWNlVGV4dC5zdGFydHNXaXRoKGNoYW5nZS5uZXdUZXh0KSkge1xuXHRcdFx0XHRlZGl0U3RhcnQgKz0gY2hhbmdlLm5ld1RleHQubGVuZ3RoO1xuXHRcdFx0XHRlZGl0UmVwbGFjZVRleHQgPSBlZGl0UmVwbGFjZVRleHQuc3Vic3RyaW5nKGNoYW5nZS5uZXdUZXh0Lmxlbmd0aCk7XG5cdFx0XHRcdGVkaXRFbmQgPSBNYXRoLm1heChlZGl0U3RhcnQsIGVkaXRFbmQpO1xuXHRcdFx0XHRlZGl0SGFzQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNJbnNlcnRpb24gJiYgc2hvdWxkUHJlc2VydmVFZGl0U2hhcGUgJiYgY2hhbmdlLnJlcGxhY2VSYW5nZS5zdGFydCA9PT0gZWRpdFN0YXJ0ICsgdGhpcy5fcHJlZml4TGVuZ3RoICYmIHRoaXMuX3RyaW1tZWROZXdUZXh0LnN0YXJ0c1dpdGgoY2hhbmdlLm5ld1RleHQpKSB7XG5cdFx0XHRcdGVkaXRFbmQgKz0gY2hhbmdlLm5ld1RleHQubGVuZ3RoO1xuXHRcdFx0XHRlZGl0SGFzQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3ByZWZpeExlbmd0aCArPSBjaGFuZ2UubmV3VGV4dC5sZW5ndGg7XG5cdFx0XHRcdHRoaXMuX3RyaW1tZWROZXdUZXh0ID0gdGhpcy5fdHJpbW1lZE5ld1RleHQuc3Vic3RyaW5nKGNoYW5nZS5uZXdUZXh0Lmxlbmd0aCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBERUxFVElPTlNcblx0XHRcdGNvbnN0IGlzRGVsZXRpb24gPSBjaGFuZ2UubmV3VGV4dC5sZW5ndGggPT09IDAgJiYgY2hhbmdlLnJlcGxhY2VSYW5nZS5sZW5ndGggPiAwO1xuXHRcdFx0aWYgKGlzRGVsZXRpb24gJiYgY2hhbmdlLnJlcGxhY2VSYW5nZS5zdGFydCA+PSBlZGl0U3RhcnQgKyB0aGlzLl9wcmVmaXhMZW5ndGggJiYgY2hhbmdlLnJlcGxhY2VSYW5nZS5lbmRFeGNsdXNpdmUgPD0gZWRpdEVuZCAtIHRoaXMuX3N1ZmZpeExlbmd0aCkge1xuXHRcdFx0XHQvLyB1c2VyIGRlbGV0ZWQgdGV4dCBJTi1CRVRXRUVOIHRoZSBkZWxldGlvbiByYW5nZVxuXHRcdFx0XHRlZGl0RW5kIC09IGNoYW5nZS5yZXBsYWNlUmFuZ2UubGVuZ3RoO1xuXHRcdFx0XHRlZGl0SGFzQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB1c2VyIGRpZCBleGFjdGx5IHRoZSBlZGl0XG5cdFx0XHRpZiAoY2hhbmdlLmVxdWFscyhlZGl0KSkge1xuXHRcdFx0XHRlZGl0SGFzQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdGVkaXRTdGFydCA9IGNoYW5nZS5yZXBsYWNlUmFuZ2UuZW5kRXhjbHVzaXZlO1xuXHRcdFx0XHRlZGl0UmVwbGFjZVRleHQgPSAnJztcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1PVkUgRURJVFxuXHRcdFx0aWYgKGNoYW5nZS5yZXBsYWNlUmFuZ2Uuc3RhcnQgPiBlZGl0RW5kKSB7XG5cdFx0XHRcdC8vIHRoZSBjaGFuZ2UgaGFwcGVucyBhZnRlciB0aGUgY29tcGxldGlvbiByYW5nZVxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmIChjaGFuZ2UucmVwbGFjZVJhbmdlLmVuZEV4Y2x1c2l2ZSA8IGVkaXRTdGFydCkge1xuXHRcdFx0XHQvLyB0aGUgY2hhbmdlIGhhcHBlbnMgYmVmb3JlIHRoZSBjb21wbGV0aW9uIHJhbmdlXG5cdFx0XHRcdGVkaXRTdGFydCArPSBjaGFuZ2UubmV3VGV4dC5sZW5ndGggLSBjaGFuZ2UucmVwbGFjZVJhbmdlLmxlbmd0aDtcblx0XHRcdFx0ZWRpdEVuZCArPSBjaGFuZ2UubmV3VGV4dC5sZW5ndGggLSBjaGFuZ2UucmVwbGFjZVJhbmdlLmxlbmd0aDtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRoZSBjaGFuZ2UgaW50ZXJzZWN0cyB0aGUgY29tcGxldGlvbiwgc28gd2Ugd2lsbCBoYXZlIHRvIGRyb3AgdGhlIGNvbXBsZXRpb25cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gdGhlIHJlc3VsdGluZyBlZGl0IGlzIGEgbm9vcCBhcyB0aGUgb3JpZ2luYWwgYW5kIG5ldyB0ZXh0IGFyZSB0aGUgc2FtZVxuXHRcdGlmICh0aGlzLl90cmltbWVkTmV3VGV4dC5sZW5ndGggPT09IDAgJiYgZWRpdFN0YXJ0ICsgdGhpcy5fcHJlZml4TGVuZ3RoID09PSBlZGl0RW5kIC0gdGhpcy5fc3VmZml4TGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4geyBlZGl0OiBuZXcgU2luZ2xlT2Zmc2V0RWRpdChuZXcgT2Zmc2V0UmFuZ2UoZWRpdFN0YXJ0ICsgdGhpcy5fcHJlZml4TGVuZ3RoLCBlZGl0U3RhcnQgKyB0aGlzLl9wcmVmaXhMZW5ndGgpLCAnJyksIGVkaXRIYXNDaGFuZ2VkOiB0cnVlIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgZWRpdDogbmV3IFNpbmdsZU9mZnNldEVkaXQobmV3IE9mZnNldFJhbmdlKGVkaXRTdGFydCwgZWRpdEVuZCksIGVkaXRSZXBsYWNlVGV4dCksIGVkaXRIYXNDaGFuZ2VkIH07XG5cdH1cbn1cblxuY29uc3QgZW1wdHlSYW5nZSA9IG5ldyBSYW5nZSgxLCAxLCAxLCAxKTtcblxuZnVuY3Rpb24gcmVzaGFwZUVkaXQoZWRpdDogU2luZ2xlT2Zmc2V0RWRpdCwgb3JpZ2luYWxUZXh0OiBzdHJpbmcsIHRvdGFsSW5uZXJFZGl0czogbnVtYmVyLCB0ZXh0TW9kZWw6IElUZXh0TW9kZWwpOiBTaW5nbGVPZmZzZXRFZGl0IHtcblx0Ly8gVE9ETzogRU9MIGFyZSBub3QgcHJvcGVybHkgdHJpbW1lZCBieSB0aGUgZGlmZkFsZ29yaXRobSAjMTI2ODBcblx0Y29uc3QgZW9sID0gdGV4dE1vZGVsLmdldEVPTCgpO1xuXHRpZiAoZWRpdC5uZXdUZXh0LmVuZHNXaXRoKGVvbCkgJiYgb3JpZ2luYWxUZXh0LmVuZHNXaXRoKGVvbCkpIHtcblx0XHRlZGl0ID0gbmV3IFNpbmdsZU9mZnNldEVkaXQoZWRpdC5yZXBsYWNlUmFuZ2UuZGVsdGFFbmQoLWVvbC5sZW5ndGgpLCBlZGl0Lm5ld1RleHQuc2xpY2UoMCwgLWVvbC5sZW5ndGgpKTtcblx0fVxuXG5cdC8vIElOU0VSVElPTlxuXHQvLyBJZiB0aGUgaW5zZXJ0aW9uIGVuZHMgd2l0aCBhIG5ldyBsaW5lIGFuZCBpcyBpbnNlcnRlZCBhdCB0aGUgc3RhcnQgb2YgYSBsaW5lIHdoaWNoIGhhcyB0ZXh0LFxuXHQvLyB3ZSBtb3ZlIHRoZSBpbnNlcnRpb24gdG8gdGhlIGVuZCBvZiB0aGUgcHJldmlvdXMgbGluZSBpZiBwb3NzaWJsZVxuXHRpZiAodG90YWxJbm5lckVkaXRzID09PSAxICYmIGVkaXQucmVwbGFjZVJhbmdlLmlzRW1wdHkgJiYgZWRpdC5uZXdUZXh0LmluY2x1ZGVzKGVvbCkpIHtcblx0XHRlZGl0ID0gcmVzaGFwZU11bHRpTGluZUluc2VydGlvbihlZGl0LCB0ZXh0TW9kZWwpO1xuXHR9XG5cblx0Ly8gVGhlIGRpZmYgYWxnb3JpdGhtIGV4dGVuZGVkIGEgc2ltcGxlIGVkaXQgdG8gdGhlIGVudGlyZSB3b3JkXG5cdC8vIHNocmluayBpdCBiYWNrIHRvIGEgc2ltcGxlIGVkaXQgaWYgaXQgaXMgZGVsZXRpb24vaW5zZXJ0aW9uIG9ubHlcblx0aWYgKHRvdGFsSW5uZXJFZGl0cyA9PT0gMSkge1xuXHRcdGNvbnN0IHByZWZpeExlbmd0aCA9IGNvbW1vblByZWZpeExlbmd0aChvcmlnaW5hbFRleHQsIGVkaXQubmV3VGV4dCk7XG5cdFx0Y29uc3Qgc3VmZml4TGVuZ3RoID0gY29tbW9uU3VmZml4TGVuZ3RoKG9yaWdpbmFsVGV4dC5zbGljZShwcmVmaXhMZW5ndGgpLCBlZGl0Lm5ld1RleHQuc2xpY2UocHJlZml4TGVuZ3RoKSk7XG5cblx0XHQvLyByZXNoYXBlIGl0IGJhY2sgdG8gYW4gaW5zZXJ0aW9uXG5cdFx0aWYgKHByZWZpeExlbmd0aCArIHN1ZmZpeExlbmd0aCA9PT0gb3JpZ2luYWxUZXh0Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIG5ldyBTaW5nbGVPZmZzZXRFZGl0KGVkaXQucmVwbGFjZVJhbmdlLmRlbHRhU3RhcnQocHJlZml4TGVuZ3RoKS5kZWx0YUVuZCgtc3VmZml4TGVuZ3RoKSwgZWRpdC5uZXdUZXh0LnN1YnN0cmluZyhwcmVmaXhMZW5ndGgsIGVkaXQubmV3VGV4dC5sZW5ndGggLSBzdWZmaXhMZW5ndGgpKTtcblx0XHR9XG5cblx0XHQvLyByZXNoYXBlIGl0IGJhY2sgdG8gYSBkZWxldGlvblxuXHRcdGlmIChwcmVmaXhMZW5ndGggKyBzdWZmaXhMZW5ndGggPT09IGVkaXQubmV3VGV4dC5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBuZXcgU2luZ2xlT2Zmc2V0RWRpdChlZGl0LnJlcGxhY2VSYW5nZS5kZWx0YVN0YXJ0KHByZWZpeExlbmd0aCkuZGVsdGFFbmQoLXN1ZmZpeExlbmd0aCksICcnKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZWRpdDtcbn1cblxuZnVuY3Rpb24gcmVzaGFwZU11bHRpTGluZUluc2VydGlvbihlZGl0OiBTaW5nbGVPZmZzZXRFZGl0LCB0ZXh0TW9kZWw6IElUZXh0TW9kZWwpOiBTaW5nbGVPZmZzZXRFZGl0IHtcblx0aWYgKCFlZGl0LnJlcGxhY2VSYW5nZS5pc0VtcHR5KSB7XG5cdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignVW5leHBlY3RlZCBvcmlnaW5hbCByYW5nZScpO1xuXHR9XG5cblx0aWYgKGVkaXQucmVwbGFjZVJhbmdlLnN0YXJ0ID09PSAwKSB7XG5cdFx0cmV0dXJuIGVkaXQ7XG5cdH1cblxuXHRjb25zdCBlb2wgPSB0ZXh0TW9kZWwuZ2V0RU9MKCk7XG5cdGNvbnN0IHN0YXJ0UG9zaXRpb24gPSB0ZXh0TW9kZWwuZ2V0UG9zaXRpb25BdChlZGl0LnJlcGxhY2VSYW5nZS5zdGFydCk7XG5cdGNvbnN0IHN0YXJ0Q29sdW1uID0gc3RhcnRQb3NpdGlvbi5jb2x1bW47XG5cdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHN0YXJ0UG9zaXRpb24ubGluZU51bWJlcjtcblxuXHQvLyBJZiB0aGUgaW5zZXJ0aW9uIGVuZHMgd2l0aCBhIG5ldyBsaW5lIGFuZCBpcyBpbnNlcnRlZCBhdCB0aGUgc3RhcnQgb2YgYSBsaW5lIHdoaWNoIGhhcyB0ZXh0LFxuXHQvLyB3ZSBtb3ZlIHRoZSBpbnNlcnRpb24gdG8gdGhlIGVuZCBvZiB0aGUgcHJldmlvdXMgbGluZSBpZiBwb3NzaWJsZVxuXHRpZiAoc3RhcnRDb2x1bW4gPT09IDEgJiYgc3RhcnRMaW5lTnVtYmVyID4gMSAmJiB0ZXh0TW9kZWwuZ2V0TGluZUxlbmd0aChzdGFydExpbmVOdW1iZXIpICE9PSAwICYmIGVkaXQubmV3VGV4dC5lbmRzV2l0aChlb2wpICYmICFlZGl0Lm5ld1RleHQuc3RhcnRzV2l0aChlb2wpKSB7XG5cdFx0cmV0dXJuIG5ldyBTaW5nbGVPZmZzZXRFZGl0KGVkaXQucmVwbGFjZVJhbmdlLmRlbHRhKC0xKSwgZW9sICsgZWRpdC5uZXdUZXh0LnNsaWNlKDAsIC1lb2wubGVuZ3RoKSk7XG5cdH1cblxuXHRyZXR1cm4gZWRpdDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUywwQkFBMEIsd0JBQXdCO0FBQzNELFNBQVMsbUJBQW1CO0FBQzVCLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLGlCQUFpQixrQkFBa0I7QUFDNUMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxZQUF5Qix5QkFBeUI7QUFDM0QsU0FBb0UsU0FBUyxzQkFBc0IsMkJBQTJCLGlCQUFpQixtQkFBbUI7QUFDbEssU0FBUyxvQkFBb0Isb0JBQW9CLGtCQUFrQjtBQUNuRSxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQixZQUFZLHdCQUF3QjtBQUNqRSxTQUFTLG1CQUFtQjtBQUU1QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQkFBZ0Isa0JBQWtCO0FBQzNDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQWtDLG1DQUFtQztBQUNyRSxTQUFTLHFDQUFxQztBQUM5QyxT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
