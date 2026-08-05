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
import { CompareResult, equals } from "../../../../../base/common/arrays.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { autorunHandleChanges, derived, keepObserved, observableValue, transaction, waitForState } from "../../../../../base/common/observable.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { localize } from "../../../../../nls.js";
import { IUndoRedoService, UndoRedoElementType, UndoRedoGroup } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { EditorModel } from "../../../../common/editor/editorModel.js";
import { LineRange } from "./lineRange.js";
import { DocumentLineRangeMap, DocumentRangeMap, LineRangeMapping } from "./mapping.js";
import { TextModelDiffChangeReason, TextModelDiffs, TextModelDiffState } from "./textModelDiffs.js";
import { leftJoin } from "../utils.js";
import { ModifiedBaseRange, ModifiedBaseRangeState, ModifiedBaseRangeStateKind } from "./modifiedBaseRange.js";
let MergeEditorModel = class extends EditorModel {
  constructor(base, input1, input2, resultTextModel, diffComputer, options, telemetry, languageService, undoRedoService) {
    super();
    this.base = base;
    this.input1 = input1;
    this.input2 = input2;
    this.resultTextModel = resultTextModel;
    this.diffComputer = diffComputer;
    this.options = options;
    this.telemetry = telemetry;
    this.languageService = languageService;
    this.undoRedoService = undoRedoService;
    this.input1TextModelDiffs = this._register(new TextModelDiffs(this.base, this.input1.textModel, this.diffComputer));
    this.input2TextModelDiffs = this._register(new TextModelDiffs(this.base, this.input2.textModel, this.diffComputer));
    this.resultTextModelDiffs = this._register(new TextModelDiffs(this.base, this.resultTextModel, this.diffComputer));
    this.modifiedBaseRanges = derived(this, (reader) => {
      const input1Diffs = this.input1TextModelDiffs.diffs.read(reader);
      const input2Diffs = this.input2TextModelDiffs.diffs.read(reader);
      return ModifiedBaseRange.fromDiffs(input1Diffs, input2Diffs, this.base, this.input1.textModel, this.input2.textModel);
    });
    this.modifiedBaseRangeResultStates = derived(this, (reader) => {
      const map = new Map(
        this.modifiedBaseRanges.read(reader).map((s) => [
          s,
          new ModifiedBaseRangeData(s)
        ])
      );
      return map;
    });
    this.resultSnapshot = this.resultTextModel.createSnapshot();
    this.baseInput1Diffs = this.input1TextModelDiffs.diffs;
    this.baseInput2Diffs = this.input2TextModelDiffs.diffs;
    this.baseResultDiffs = this.resultTextModelDiffs.diffs;
    this.input1ResultMapping = derived(this, (reader) => {
      return this.getInputResultMapping(
        this.baseInput1Diffs.read(reader),
        this.baseResultDiffs.read(reader),
        this.input1.textModel.getLineCount()
      );
    });
    this.resultInput1Mapping = derived(this, (reader) => this.input1ResultMapping.read(reader).reverse());
    this.input2ResultMapping = derived(this, (reader) => {
      return this.getInputResultMapping(
        this.baseInput2Diffs.read(reader),
        this.baseResultDiffs.read(reader),
        this.input2.textModel.getLineCount()
      );
    });
    this.resultInput2Mapping = derived(this, (reader) => this.input2ResultMapping.read(reader).reverse());
    this.baseResultMapping = derived(this, (reader) => {
      const map = new DocumentLineRangeMap(this.baseResultDiffs.read(reader), -1);
      return new DocumentLineRangeMap(
        map.lineRangeMappings.map(
          (m) => m.inputRange.isEmpty || m.outputRange.isEmpty ? new LineRangeMapping(
            // We can do this because two adjacent diffs have one line in between.
            m.inputRange.deltaStart(-1),
            m.outputRange.deltaStart(-1)
          ) : m
        ),
        map.inputLineCount
      );
    });
    this.resultBaseMapping = derived(this, (reader) => this.baseResultMapping.read(reader).reverse());
    this.diffComputingState = derived(this, (reader) => {
      const states = [
        this.input1TextModelDiffs,
        this.input2TextModelDiffs,
        this.resultTextModelDiffs
      ].map((s) => s.state.read(reader));
      if (states.some((s) => s === TextModelDiffState.initializing)) {
        return 1 /* initializing */;
      }
      if (states.some((s) => s === TextModelDiffState.updating)) {
        return 3 /* updating */;
      }
      return 2 /* upToDate */;
    });
    this.inputDiffComputingState = derived(this, (reader) => {
      const states = [
        this.input1TextModelDiffs,
        this.input2TextModelDiffs
      ].map((s) => s.state.read(reader));
      if (states.some((s) => s === TextModelDiffState.initializing)) {
        return 1 /* initializing */;
      }
      if (states.some((s) => s === TextModelDiffState.updating)) {
        return 3 /* updating */;
      }
      return 2 /* upToDate */;
    });
    this.isUpToDate = derived(this, (reader) => this.diffComputingState.read(reader) === 2 /* upToDate */);
    this.onInitialized = waitForState(this.diffComputingState, (state) => state === 2 /* upToDate */).then(() => {
    });
    this.firstRun = true;
    this.unhandledConflictsCount = derived(this, (reader) => {
      const map = this.modifiedBaseRangeResultStates.read(reader);
      let unhandledCount = 0;
      for (const [_key, value] of map) {
        if (!value.handled.read(reader)) {
          unhandledCount++;
        }
      }
      return unhandledCount;
    });
    this.hasUnhandledConflicts = this.unhandledConflictsCount.map((value) => (
      /** @description hasUnhandledConflicts */
      value > 0
    ));
    this._register(keepObserved(this.modifiedBaseRangeResultStates));
    this._register(keepObserved(this.input1ResultMapping));
    this._register(keepObserved(this.input2ResultMapping));
    const initializePromise = this.initialize();
    this.onInitialized = this.onInitialized.then(async () => {
      await initializePromise;
    });
    initializePromise.then(() => {
      let shouldRecomputeHandledFromAccepted = true;
      this._register(
        autorunHandleChanges(
          {
            handleChange: (ctx) => {
              if (ctx.didChange(this.modifiedBaseRangeResultStates)) {
                shouldRecomputeHandledFromAccepted = true;
              }
              return ctx.didChange(this.resultTextModelDiffs.diffs) ? ctx.change === TextModelDiffChangeReason.textChange : true;
            }
          },
          (reader) => {
            const states = this.modifiedBaseRangeResultStates.read(reader);
            if (!this.isUpToDate.read(reader)) {
              return;
            }
            const resultDiffs = this.resultTextModelDiffs.diffs.read(reader);
            transaction((tx) => {
              this.updateBaseRangeAcceptedState(resultDiffs, states, tx);
              if (shouldRecomputeHandledFromAccepted) {
                shouldRecomputeHandledFromAccepted = false;
                for (const [_range, observableState] of states) {
                  const state = observableState.accepted.get();
                  const handled = !(state.kind === ModifiedBaseRangeStateKind.base || state.kind === ModifiedBaseRangeStateKind.unrecognized);
                  observableState.handledInput1.set(handled, tx);
                  observableState.handledInput2.set(handled, tx);
                }
              }
            });
          }
        )
      );
    });
  }
  async initialize() {
    if (this.options.resetResult) {
      await this.reset();
    }
  }
  async reset() {
    await waitForState(this.inputDiffComputingState, (state) => state === 2 /* upToDate */);
    const states = this.modifiedBaseRangeResultStates.get();
    transaction((tx) => {
      for (const [range, state] of states) {
        let newState;
        let handled = false;
        if (range.input1Diffs.length === 0) {
          newState = ModifiedBaseRangeState.base.withInputValue(2, true);
          handled = true;
        } else if (range.input2Diffs.length === 0) {
          newState = ModifiedBaseRangeState.base.withInputValue(1, true);
          handled = true;
        } else if (range.isEqualChange) {
          newState = ModifiedBaseRangeState.base.withInputValue(1, true);
          handled = true;
        } else {
          newState = ModifiedBaseRangeState.base;
          handled = false;
        }
        state.accepted.set(newState, tx);
        state.computedFromDiffing = false;
        state.previousNonDiffingState = void 0;
        state.handledInput1.set(handled, tx);
        state.handledInput2.set(handled, tx);
      }
      this.resultTextModel.pushEditOperations(null, [{
        range: new Range(1, 1, Number.MAX_SAFE_INTEGER, 1),
        text: this.computeAutoMergedResult()
      }], () => null);
    });
  }
  computeAutoMergedResult() {
    const baseRanges = this.modifiedBaseRanges.get();
    const baseLines = this.base.getLinesContent();
    const input1Lines = this.input1.textModel.getLinesContent();
    const input2Lines = this.input2.textModel.getLinesContent();
    const resultLines = [];
    function appendLinesToResult(source, lineRange) {
      for (let i = lineRange.startLineNumber; i < lineRange.endLineNumberExclusive; i++) {
        resultLines.push(source[i - 1]);
      }
    }
    let baseStartLineNumber = 1;
    for (const baseRange of baseRanges) {
      appendLinesToResult(baseLines, LineRange.fromLineNumbers(baseStartLineNumber, baseRange.baseRange.startLineNumber));
      baseStartLineNumber = baseRange.baseRange.endLineNumberExclusive;
      if (baseRange.input1Diffs.length === 0) {
        appendLinesToResult(input2Lines, baseRange.input2Range);
      } else if (baseRange.input2Diffs.length === 0) {
        appendLinesToResult(input1Lines, baseRange.input1Range);
      } else if (baseRange.isEqualChange) {
        appendLinesToResult(input1Lines, baseRange.input1Range);
      } else {
        appendLinesToResult(baseLines, baseRange.baseRange);
      }
    }
    appendLinesToResult(baseLines, LineRange.fromLineNumbers(baseStartLineNumber, baseLines.length + 1));
    return resultLines.join(this.resultTextModel.getEOL());
  }
  hasBaseRange(baseRange) {
    return this.modifiedBaseRangeResultStates.get().has(baseRange);
  }
  get isApplyingEditInResult() {
    return this.resultTextModelDiffs.isApplyingChange;
  }
  getInputResultMapping(inputLinesDiffs, resultDiffs, inputLineCount) {
    const map = DocumentLineRangeMap.betweenOutputs(inputLinesDiffs, resultDiffs, inputLineCount);
    return new DocumentLineRangeMap(
      map.lineRangeMappings.map(
        (m) => m.inputRange.isEmpty || m.outputRange.isEmpty ? new LineRangeMapping(
          // We can do this because two adjacent diffs have one line in between.
          m.inputRange.deltaStart(-1),
          m.outputRange.deltaStart(-1)
        ) : m
      ),
      map.inputLineCount
    );
  }
  translateInputRangeToBase(input, range) {
    const baseInputDiffs = input === 1 ? this.baseInput1Diffs.get() : this.baseInput2Diffs.get();
    const map = new DocumentRangeMap(baseInputDiffs.flatMap((d) => d.rangeMappings), 0).reverse();
    return map.projectRange(range).outputRange;
  }
  translateBaseRangeToInput(input, range) {
    const baseInputDiffs = input === 1 ? this.baseInput1Diffs.get() : this.baseInput2Diffs.get();
    const map = new DocumentRangeMap(baseInputDiffs.flatMap((d) => d.rangeMappings), 0);
    return map.projectRange(range).outputRange;
  }
  getLineRangeInResult(baseRange, reader) {
    return this.resultTextModelDiffs.getResultLineRange(baseRange, reader);
  }
  translateResultRangeToBase(range) {
    const map = new DocumentRangeMap(this.baseResultDiffs.get().flatMap((d) => d.rangeMappings), 0).reverse();
    return map.projectRange(range).outputRange;
  }
  translateBaseRangeToResult(range) {
    const map = new DocumentRangeMap(this.baseResultDiffs.get().flatMap((d) => d.rangeMappings), 0);
    return map.projectRange(range).outputRange;
  }
  findModifiedBaseRangesInRange(rangeInBase) {
    return this.modifiedBaseRanges.get().filter((r) => r.baseRange.intersects(rangeInBase));
  }
  updateBaseRangeAcceptedState(resultDiffs, states, tx) {
    const baseRangeWithStoreAndTouchingDiffs = leftJoin(
      states,
      resultDiffs,
      (baseRange, diff) => baseRange[0].baseRange.touches(diff.inputRange) ? CompareResult.neitherLessOrGreaterThan : LineRange.compareByStart(
        baseRange[0].baseRange,
        diff.inputRange
      )
    );
    for (const row of baseRangeWithStoreAndTouchingDiffs) {
      const newState = this.computeState(row.left[0], row.rights);
      const data = row.left[1];
      const oldState = data.accepted.get();
      if (!oldState.equals(newState)) {
        if (!this.firstRun && !data.computedFromDiffing) {
          data.computedFromDiffing = true;
          data.previousNonDiffingState = oldState;
        }
        data.accepted.set(newState, tx);
      }
    }
    if (this.firstRun) {
      this.firstRun = false;
    }
  }
  computeState(baseRange, conflictingDiffs) {
    if (conflictingDiffs.length === 0) {
      return ModifiedBaseRangeState.base;
    }
    const conflictingEdits = conflictingDiffs.map((d) => d.getLineEdit());
    function editsAgreeWithDiffs(diffs) {
      return equals(
        conflictingEdits,
        diffs.map((d) => d.getLineEdit()),
        (a, b) => a.equals(b)
      );
    }
    if (editsAgreeWithDiffs(baseRange.input1Diffs)) {
      return ModifiedBaseRangeState.base.withInputValue(1, true);
    }
    if (editsAgreeWithDiffs(baseRange.input2Diffs)) {
      return ModifiedBaseRangeState.base.withInputValue(2, true);
    }
    const states = [
      ModifiedBaseRangeState.base.withInputValue(1, true).withInputValue(2, true, true),
      ModifiedBaseRangeState.base.withInputValue(2, true).withInputValue(1, true, true),
      ModifiedBaseRangeState.base.withInputValue(1, true).withInputValue(2, true, false),
      ModifiedBaseRangeState.base.withInputValue(2, true).withInputValue(1, true, false)
    ];
    for (const s of states) {
      const { edit } = baseRange.getEditForBase(s);
      if (edit) {
        const resultRange = this.resultTextModelDiffs.getResultLineRange(baseRange.baseRange);
        const existingLines = resultRange.getLines(this.resultTextModel);
        if (equals(edit.newLines, existingLines, (a, b) => a === b)) {
          return s;
        }
      }
    }
    return ModifiedBaseRangeState.unrecognized;
  }
  getState(baseRange) {
    const existingState = this.modifiedBaseRangeResultStates.get().get(baseRange);
    if (!existingState) {
      throw new BugIndicatingError("object must be from this instance");
    }
    return existingState.accepted;
  }
  setState(baseRange, state, _markInputAsHandled, tx, _pushStackElement = false) {
    if (!this.isUpToDate.get()) {
      throw new BugIndicatingError("Cannot set state while updating");
    }
    const existingState = this.modifiedBaseRangeResultStates.get().get(baseRange);
    if (!existingState) {
      throw new BugIndicatingError("object must be from this instance");
    }
    const conflictingDiffs = this.resultTextModelDiffs.findTouchingDiffs(
      baseRange.baseRange
    );
    const group = new UndoRedoGroup();
    if (conflictingDiffs) {
      this.resultTextModelDiffs.removeDiffs(conflictingDiffs, tx, group);
    }
    const { edit, effectiveState } = baseRange.getEditForBase(state);
    existingState.accepted.set(effectiveState, tx);
    existingState.previousNonDiffingState = void 0;
    existingState.computedFromDiffing = false;
    const input1Handled = existingState.handledInput1.get();
    const input2Handled = existingState.handledInput2.get();
    if (!input1Handled || !input2Handled) {
      this.undoRedoService.pushElement(
        new MarkAsHandledUndoRedoElement(this.resultTextModel.uri, new WeakRef(this), new WeakRef(existingState), input1Handled, input2Handled),
        group
      );
    }
    if (edit) {
      this.resultTextModel.pushStackElement();
      this.resultTextModelDiffs.applyEditRelativeToOriginal(edit, tx, group);
      this.resultTextModel.pushStackElement();
    }
    existingState.handledInput1.set(true, tx);
    existingState.handledInput2.set(true, tx);
  }
  resetDirtyConflictsToBase() {
    transaction((tx) => {
      this.resultTextModel.pushStackElement();
      for (const range of this.modifiedBaseRanges.get()) {
        if (this.getState(range).get().kind === ModifiedBaseRangeStateKind.unrecognized) {
          this.setState(range, ModifiedBaseRangeState.base, false, tx, false);
        }
      }
      this.resultTextModel.pushStackElement();
    });
  }
  isHandled(baseRange) {
    return this.modifiedBaseRangeResultStates.get().get(baseRange).handled;
  }
  isInputHandled(baseRange, inputNumber) {
    const state = this.modifiedBaseRangeResultStates.get().get(baseRange);
    return inputNumber === 1 ? state.handledInput1 : state.handledInput2;
  }
  setInputHandled(baseRange, inputNumber, handled, tx) {
    const state = this.modifiedBaseRangeResultStates.get().get(baseRange);
    if (state.handled.get() === handled) {
      return;
    }
    const dataRef = new WeakRef(ModifiedBaseRangeData);
    const modelRef = new WeakRef(this);
    this.undoRedoService.pushElement({
      type: UndoRedoElementType.Resource,
      resource: this.resultTextModel.uri,
      code: "setInputHandled",
      label: localize("setInputHandled", "Set Input Handled"),
      redo() {
        const model = modelRef.deref();
        const data = dataRef.deref();
        if (model && !model.isDisposed() && data) {
          transaction((tx2) => {
            if (inputNumber === 1) {
              state.handledInput1.set(handled, tx2);
            } else {
              state.handledInput2.set(handled, tx2);
            }
          });
        }
      },
      undo() {
        const model = modelRef.deref();
        const data = dataRef.deref();
        if (model && !model.isDisposed() && data) {
          transaction((tx2) => {
            if (inputNumber === 1) {
              state.handledInput1.set(!handled, tx2);
            } else {
              state.handledInput2.set(!handled, tx2);
            }
          });
        }
      }
    });
    if (inputNumber === 1) {
      state.handledInput1.set(handled, tx);
    } else {
      state.handledInput2.set(handled, tx);
    }
  }
  setHandled(baseRange, handled, tx) {
    const state = this.modifiedBaseRangeResultStates.get().get(baseRange);
    if (state.handled.get() === handled) {
      return;
    }
    state.handledInput1.set(handled, tx);
    state.handledInput2.set(handled, tx);
  }
  setLanguageId(languageId, source) {
    const language = this.languageService.createById(languageId);
    this.base.setLanguage(language, source);
    this.input1.textModel.setLanguage(language, source);
    this.input2.textModel.setLanguage(language, source);
    this.resultTextModel.setLanguage(language, source);
  }
  getInitialResultValue() {
    const chunks = [];
    while (true) {
      const chunk = this.resultSnapshot.read();
      if (chunk === null) {
        break;
      }
      chunks.push(chunk);
    }
    return chunks.join();
  }
  async getResultValueWithConflictMarkers() {
    await waitForState(this.diffComputingState, (state) => state === 2 /* upToDate */);
    if (this.unhandledConflictsCount.get() === 0) {
      return this.resultTextModel.getValue();
    }
    const resultLines = this.resultTextModel.getLinesContent();
    const input1Lines = this.input1.textModel.getLinesContent();
    const input2Lines = this.input2.textModel.getLinesContent();
    const states = this.modifiedBaseRangeResultStates.get();
    const outputLines = [];
    function appendLinesToResult(source, lineRange) {
      for (let i = lineRange.startLineNumber; i < lineRange.endLineNumberExclusive; i++) {
        outputLines.push(source[i - 1]);
      }
    }
    let resultStartLineNumber = 1;
    for (const [range, state] of states) {
      if (state.handled.get()) {
        continue;
      }
      const resultRange = this.resultTextModelDiffs.getResultLineRange(range.baseRange);
      appendLinesToResult(resultLines, LineRange.fromLineNumbers(resultStartLineNumber, Math.max(resultStartLineNumber, resultRange.startLineNumber)));
      resultStartLineNumber = resultRange.endLineNumberExclusive;
      outputLines.push("<<<<<<<");
      if (state.accepted.get().kind === ModifiedBaseRangeStateKind.unrecognized) {
        appendLinesToResult(resultLines, resultRange);
      } else {
        appendLinesToResult(input1Lines, range.input1Range);
      }
      outputLines.push("=======");
      appendLinesToResult(input2Lines, range.input2Range);
      outputLines.push(">>>>>>>");
    }
    appendLinesToResult(resultLines, LineRange.fromLineNumbers(resultStartLineNumber, resultLines.length + 1));
    return outputLines.join("\n");
  }
  get conflictCount() {
    return arrayCount(this.modifiedBaseRanges.get(), (r) => r.isConflicting);
  }
  get combinableConflictCount() {
    return arrayCount(this.modifiedBaseRanges.get(), (r) => r.isConflicting && r.canBeCombined);
  }
  get conflictsResolvedWithBase() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => r.isConflicting && s.accepted.get().kind === ModifiedBaseRangeStateKind.base
    );
  }
  get conflictsResolvedWithInput1() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => r.isConflicting && s.accepted.get().kind === ModifiedBaseRangeStateKind.input1
    );
  }
  get conflictsResolvedWithInput2() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => r.isConflicting && s.accepted.get().kind === ModifiedBaseRangeStateKind.input2
    );
  }
  get conflictsResolvedWithSmartCombination() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.both && state.smartCombination;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualNone() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => r.isConflicting && s.accepted.get().kind === ModifiedBaseRangeStateKind.unrecognized
    );
  }
  get manuallySolvedConflictCountThatEqualSmartCombine() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && s.computedFromDiffing && state.kind === ModifiedBaseRangeStateKind.both && state.smartCombination;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualInput1() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && s.computedFromDiffing && state.kind === ModifiedBaseRangeStateKind.input1;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualInput2() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && s.computedFromDiffing && state.kind === ModifiedBaseRangeStateKind.input2;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualNoneAndStartedWithBase() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.base;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.input1;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.input2;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.both && !s.previousNonDiffingState?.smartCombination;
      }
    );
  }
  get manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart() {
    return arrayCount(
      this.modifiedBaseRangeResultStates.get().entries(),
      ([r, s]) => {
        const state = s.accepted.get();
        return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.both && s.previousNonDiffingState?.smartCombination;
      }
    );
  }
};
MergeEditorModel = __decorateClass([
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IUndoRedoService)
], MergeEditorModel);
function arrayCount(array, predicate) {
  let count = 0;
  for (const value of array) {
    if (predicate(value)) {
      count++;
    }
  }
  return count;
}
class ModifiedBaseRangeData {
  constructor(baseRange) {
    this.baseRange = baseRange;
    this.accepted = observableValue(`BaseRangeState${this.baseRange.baseRange}`, ModifiedBaseRangeState.base);
    this.handledInput1 = observableValue(`BaseRangeHandledState${this.baseRange.baseRange}.Input1`, false);
    this.handledInput2 = observableValue(`BaseRangeHandledState${this.baseRange.baseRange}.Input2`, false);
    this.computedFromDiffing = false;
    this.previousNonDiffingState = void 0;
    this.handled = derived(this, (reader) => this.handledInput1.read(reader) && this.handledInput2.read(reader));
  }
}
var MergeEditorModelState = /* @__PURE__ */ ((MergeEditorModelState2) => {
  MergeEditorModelState2[MergeEditorModelState2["initializing"] = 1] = "initializing";
  MergeEditorModelState2[MergeEditorModelState2["upToDate"] = 2] = "upToDate";
  MergeEditorModelState2[MergeEditorModelState2["updating"] = 3] = "updating";
  return MergeEditorModelState2;
})(MergeEditorModelState || {});
class MarkAsHandledUndoRedoElement {
  constructor(resource, mergeEditorModelRef, stateRef, input1Handled, input2Handled) {
    this.resource = resource;
    this.mergeEditorModelRef = mergeEditorModelRef;
    this.stateRef = stateRef;
    this.input1Handled = input1Handled;
    this.input2Handled = input2Handled;
    this.code = "undoMarkAsHandled";
    this.label = localize("undoMarkAsHandled", "Undo Mark As Handled");
    this.type = UndoRedoElementType.Resource;
  }
  redo() {
    const mergeEditorModel = this.mergeEditorModelRef.deref();
    if (!mergeEditorModel || mergeEditorModel.isDisposed()) {
      return;
    }
    const state = this.stateRef.deref();
    if (!state) {
      return;
    }
    transaction((tx) => {
      state.handledInput1.set(true, tx);
      state.handledInput2.set(true, tx);
    });
  }
  undo() {
    const mergeEditorModel = this.mergeEditorModelRef.deref();
    if (!mergeEditorModel || mergeEditorModel.isDisposed()) {
      return;
    }
    const state = this.stateRef.deref();
    if (!state) {
      return;
    }
    transaction((tx) => {
      state.handledInput1.set(this.input1Handled, tx);
      state.handledInput2.set(this.input2Handled, tx);
    });
  }
}
export {
  MergeEditorModel,
  MergeEditorModelState
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL21lcmdlRWRpdG9yTW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb21wYXJlUmVzdWx0LCBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IGF1dG9ydW5IYW5kbGVDaGFuZ2VzLCBkZXJpdmVkLCBJT2JzZXJ2YWJsZSwgSVJlYWRlciwgSVNldHRhYmxlT2JzZXJ2YWJsZSwgSVRyYW5zYWN0aW9uLCBrZWVwT2JzZXJ2ZWQsIG9ic2VydmFibGVWYWx1ZSwgdHJhbnNhY3Rpb24sIHdhaXRGb3JTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VVbmRvUmVkb0VsZW1lbnQsIElVbmRvUmVkb1NlcnZpY2UsIFVuZG9SZWRvRWxlbWVudFR5cGUsIFVuZG9SZWRvR3JvdXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IElNZXJnZURpZmZDb21wdXRlciB9IGZyb20gJy4vZGlmZkNvbXB1dGVyLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4vbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IERldGFpbGVkTGluZVJhbmdlTWFwcGluZywgRG9jdW1lbnRMaW5lUmFuZ2VNYXAsIERvY3VtZW50UmFuZ2VNYXAsIExpbmVSYW5nZU1hcHBpbmcgfSBmcm9tICcuL21hcHBpbmcuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbiwgVGV4dE1vZGVsRGlmZnMsIFRleHRNb2RlbERpZmZTdGF0ZSB9IGZyb20gJy4vdGV4dE1vZGVsRGlmZnMuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JUZWxlbWV0cnkgfSBmcm9tICcuLi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgbGVmdEpvaW4gfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyBJbnB1dE51bWJlciwgTW9kaWZpZWRCYXNlUmFuZ2UsIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUsIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kIH0gZnJvbSAnLi9tb2RpZmllZEJhc2VSYW5nZS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5wdXREYXRhIHtcblx0cmVhZG9ubHkgdGV4dE1vZGVsOiBJVGV4dE1vZGVsO1xuXHRyZWFkb25seSB0aXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBkZXRhaWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlRWRpdG9yTW9kZWwgZXh0ZW5kcyBFZGl0b3JNb2RlbCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5wdXQxVGV4dE1vZGVsRGlmZnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGV4dE1vZGVsRGlmZnModGhpcy5iYXNlLCB0aGlzLmlucHV0MS50ZXh0TW9kZWwsIHRoaXMuZGlmZkNvbXB1dGVyKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5wdXQyVGV4dE1vZGVsRGlmZnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGV4dE1vZGVsRGlmZnModGhpcy5iYXNlLCB0aGlzLmlucHV0Mi50ZXh0TW9kZWwsIHRoaXMuZGlmZkNvbXB1dGVyKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVzdWx0VGV4dE1vZGVsRGlmZnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGV4dE1vZGVsRGlmZnModGhpcy5iYXNlLCB0aGlzLnJlc3VsdFRleHRNb2RlbCwgdGhpcy5kaWZmQ29tcHV0ZXIpKTtcblx0cHVibGljIHJlYWRvbmx5IG1vZGlmaWVkQmFzZVJhbmdlcyA9IGRlcml2ZWQ8TW9kaWZpZWRCYXNlUmFuZ2VbXT4odGhpcywgKHJlYWRlcikgPT4ge1xuXHRcdGNvbnN0IGlucHV0MURpZmZzID0gdGhpcy5pbnB1dDFUZXh0TW9kZWxEaWZmcy5kaWZmcy5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgaW5wdXQyRGlmZnMgPSB0aGlzLmlucHV0MlRleHRNb2RlbERpZmZzLmRpZmZzLnJlYWQocmVhZGVyKTtcblx0XHRyZXR1cm4gTW9kaWZpZWRCYXNlUmFuZ2UuZnJvbURpZmZzKGlucHV0MURpZmZzLCBpbnB1dDJEaWZmcywgdGhpcy5iYXNlLCB0aGlzLmlucHV0MS50ZXh0TW9kZWwsIHRoaXMuaW5wdXQyLnRleHRNb2RlbCk7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgbWFwID0gbmV3IE1hcDxNb2RpZmllZEJhc2VSYW5nZSwgTW9kaWZpZWRCYXNlUmFuZ2VEYXRhPihcblx0XHRcdHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VzLnJlYWQocmVhZGVyKS5tYXA8W01vZGlmaWVkQmFzZVJhbmdlLCBNb2RpZmllZEJhc2VSYW5nZURhdGFdPigocykgPT4gW1xuXHRcdFx0XHRzLCBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VEYXRhKHMpXG5cdFx0XHRdKVxuXHRcdCk7XG5cdFx0cmV0dXJuIG1hcDtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSByZXN1bHRTbmFwc2hvdCA9IHRoaXMucmVzdWx0VGV4dE1vZGVsLmNyZWF0ZVNuYXBzaG90KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgYmFzZTogSVRleHRNb2RlbCxcblx0XHRyZWFkb25seSBpbnB1dDE6IElucHV0RGF0YSxcblx0XHRyZWFkb25seSBpbnB1dDI6IElucHV0RGF0YSxcblx0XHRyZWFkb25seSByZXN1bHRUZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkaWZmQ29tcHV0ZXI6IElNZXJnZURpZmZDb21wdXRlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IHsgcmVzZXRSZXN1bHQ6IGJvb2xlYW4gfSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdGVsZW1ldHJ5OiBNZXJnZUVkaXRvclRlbGVtZXRyeSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASVVuZG9SZWRvU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGtlZXBPYnNlcnZlZCh0aGlzLm1vZGlmaWVkQmFzZVJhbmdlUmVzdWx0U3RhdGVzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoa2VlcE9ic2VydmVkKHRoaXMuaW5wdXQxUmVzdWx0TWFwcGluZykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGtlZXBPYnNlcnZlZCh0aGlzLmlucHV0MlJlc3VsdE1hcHBpbmcpKTtcblxuXHRcdGNvbnN0IGluaXRpYWxpemVQcm9taXNlID0gdGhpcy5pbml0aWFsaXplKCk7XG5cblx0XHR0aGlzLm9uSW5pdGlhbGl6ZWQgPSB0aGlzLm9uSW5pdGlhbGl6ZWQudGhlbihhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCBpbml0aWFsaXplUHJvbWlzZTtcblx0XHR9KTtcblxuXHRcdGluaXRpYWxpemVQcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0bGV0IHNob3VsZFJlY29tcHV0ZUhhbmRsZWRGcm9tQWNjZXB0ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRcdGF1dG9ydW5IYW5kbGVDaGFuZ2VzKFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGhhbmRsZUNoYW5nZTogKGN0eCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoY3R4LmRpZENoYW5nZSh0aGlzLm1vZGlmaWVkQmFzZVJhbmdlUmVzdWx0U3RhdGVzKSkge1xuXHRcdFx0XHRcdFx0XHRcdHNob3VsZFJlY29tcHV0ZUhhbmRsZWRGcm9tQWNjZXB0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiBjdHguZGlkQ2hhbmdlKHRoaXMucmVzdWx0VGV4dE1vZGVsRGlmZnMuZGlmZnMpXG5cdFx0XHRcdFx0XHRcdFx0Ly8gSWdub3JlIG5vbi10ZXh0IGNoYW5nZXMgYXMgd2UgdXBkYXRlIHRoZSBzdGF0ZSBkaXJlY3RseVxuXHRcdFx0XHRcdFx0XHRcdD8gY3R4LmNoYW5nZSA9PT0gVGV4dE1vZGVsRGlmZkNoYW5nZVJlYXNvbi50ZXh0Q2hhbmdlXG5cdFx0XHRcdFx0XHRcdFx0OiB0cnVlO1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdChyZWFkZXIpID0+IHtcblx0XHRcdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gTWVyZ2UgRWRpdG9yIE1vZGVsOiBSZWNvbXB1dGUgU3RhdGUgRnJvbSBSZXN1bHQgKi9cblx0XHRcdFx0XHRcdGNvbnN0IHN0YXRlcyA9IHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLmlzVXBUb0RhdGUucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdERpZmZzID0gdGhpcy5yZXN1bHRUZXh0TW9kZWxEaWZmcy5kaWZmcy5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gTWVyZ2UgRWRpdG9yIE1vZGVsOiBSZWNvbXB1dGUgU3RhdGUgKi9cblxuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZUJhc2VSYW5nZUFjY2VwdGVkU3RhdGUocmVzdWx0RGlmZnMsIHN0YXRlcywgdHgpO1xuXG5cdFx0XHRcdFx0XHRcdGlmIChzaG91bGRSZWNvbXB1dGVIYW5kbGVkRnJvbUFjY2VwdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0c2hvdWxkUmVjb21wdXRlSGFuZGxlZEZyb21BY2NlcHRlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgW19yYW5nZSwgb2JzZXJ2YWJsZVN0YXRlXSBvZiBzdGF0ZXMpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHN0YXRlID0gb2JzZXJ2YWJsZVN0YXRlLmFjY2VwdGVkLmdldCgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgaGFuZGxlZCA9ICEoc3RhdGUua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuYmFzZSB8fCBzdGF0ZS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC51bnJlY29nbml6ZWQpO1xuXHRcdFx0XHRcdFx0XHRcdFx0b2JzZXJ2YWJsZVN0YXRlLmhhbmRsZWRJbnB1dDEuc2V0KGhhbmRsZWQsIHR4KTtcblx0XHRcdFx0XHRcdFx0XHRcdG9ic2VydmFibGVTdGF0ZS5oYW5kbGVkSW5wdXQyLnNldChoYW5kbGVkLCB0eCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdClcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5yZXNldFJlc3VsdCkge1xuXHRcdFx0YXdhaXQgdGhpcy5yZXNldCgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyByZXNldCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB3YWl0Rm9yU3RhdGUodGhpcy5pbnB1dERpZmZDb21wdXRpbmdTdGF0ZSwgc3RhdGUgPT4gc3RhdGUgPT09IE1lcmdlRWRpdG9yTW9kZWxTdGF0ZS51cFRvRGF0ZSk7XG5cdFx0Y29uc3Qgc3RhdGVzID0gdGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKTtcblxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gU2V0IGluaXRpYWwgc3RhdGUgKi9cblxuXHRcdFx0Zm9yIChjb25zdCBbcmFuZ2UsIHN0YXRlXSBvZiBzdGF0ZXMpIHtcblx0XHRcdFx0bGV0IG5ld1N0YXRlOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlO1xuXHRcdFx0XHRsZXQgaGFuZGxlZCA9IGZhbHNlO1xuXHRcdFx0XHRpZiAocmFuZ2UuaW5wdXQxRGlmZnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0bmV3U3RhdGUgPSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2Uud2l0aElucHV0VmFsdWUoMiwgdHJ1ZSk7XG5cdFx0XHRcdFx0aGFuZGxlZCA9IHRydWU7XG5cdFx0XHRcdH0gZWxzZSBpZiAocmFuZ2UuaW5wdXQyRGlmZnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0bmV3U3RhdGUgPSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2Uud2l0aElucHV0VmFsdWUoMSwgdHJ1ZSk7XG5cdFx0XHRcdFx0aGFuZGxlZCA9IHRydWU7XG5cdFx0XHRcdH0gZWxzZSBpZiAocmFuZ2UuaXNFcXVhbENoYW5nZSkge1xuXHRcdFx0XHRcdG5ld1N0YXRlID0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZS5iYXNlLndpdGhJbnB1dFZhbHVlKDEsIHRydWUpO1xuXHRcdFx0XHRcdGhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5ld1N0YXRlID0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZS5iYXNlO1xuXHRcdFx0XHRcdGhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN0YXRlLmFjY2VwdGVkLnNldChuZXdTdGF0ZSwgdHgpO1xuXHRcdFx0XHRzdGF0ZS5jb21wdXRlZEZyb21EaWZmaW5nID0gZmFsc2U7XG5cdFx0XHRcdHN0YXRlLnByZXZpb3VzTm9uRGlmZmluZ1N0YXRlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRzdGF0ZS5oYW5kbGVkSW5wdXQxLnNldChoYW5kbGVkLCB0eCk7XG5cdFx0XHRcdHN0YXRlLmhhbmRsZWRJbnB1dDIuc2V0KGhhbmRsZWQsIHR4KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5yZXN1bHRUZXh0TW9kZWwucHVzaEVkaXRPcGVyYXRpb25zKG51bGwsIFt7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIDEpLFxuXHRcdFx0XHR0ZXh0OiB0aGlzLmNvbXB1dGVBdXRvTWVyZ2VkUmVzdWx0KClcblx0XHRcdH1dLCAoKSA9PiBudWxsKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZUF1dG9NZXJnZWRSZXN1bHQoKTogc3RyaW5nIHtcblx0XHRjb25zdCBiYXNlUmFuZ2VzID0gdGhpcy5tb2RpZmllZEJhc2VSYW5nZXMuZ2V0KCk7XG5cblx0XHRjb25zdCBiYXNlTGluZXMgPSB0aGlzLmJhc2UuZ2V0TGluZXNDb250ZW50KCk7XG5cdFx0Y29uc3QgaW5wdXQxTGluZXMgPSB0aGlzLmlucHV0MS50ZXh0TW9kZWwuZ2V0TGluZXNDb250ZW50KCk7XG5cdFx0Y29uc3QgaW5wdXQyTGluZXMgPSB0aGlzLmlucHV0Mi50ZXh0TW9kZWwuZ2V0TGluZXNDb250ZW50KCk7XG5cblx0XHRjb25zdCByZXN1bHRMaW5lczogc3RyaW5nW10gPSBbXTtcblx0XHRmdW5jdGlvbiBhcHBlbmRMaW5lc1RvUmVzdWx0KHNvdXJjZTogc3RyaW5nW10sIGxpbmVSYW5nZTogTGluZVJhbmdlKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gbGluZVJhbmdlLnN0YXJ0TGluZU51bWJlcjsgaSA8IGxpbmVSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlOyBpKyspIHtcblx0XHRcdFx0cmVzdWx0TGluZXMucHVzaChzb3VyY2VbaSAtIDFdKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgYmFzZVN0YXJ0TGluZU51bWJlciA9IDE7XG5cblx0XHRmb3IgKGNvbnN0IGJhc2VSYW5nZSBvZiBiYXNlUmFuZ2VzKSB7XG5cdFx0XHRhcHBlbmRMaW5lc1RvUmVzdWx0KGJhc2VMaW5lcywgTGluZVJhbmdlLmZyb21MaW5lTnVtYmVycyhiYXNlU3RhcnRMaW5lTnVtYmVyLCBiYXNlUmFuZ2UuYmFzZVJhbmdlLnN0YXJ0TGluZU51bWJlcikpO1xuXHRcdFx0YmFzZVN0YXJ0TGluZU51bWJlciA9IGJhc2VSYW5nZS5iYXNlUmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZTtcblxuXHRcdFx0aWYgKGJhc2VSYW5nZS5pbnB1dDFEaWZmcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0YXBwZW5kTGluZXNUb1Jlc3VsdChpbnB1dDJMaW5lcywgYmFzZVJhbmdlLmlucHV0MlJhbmdlKTtcblx0XHRcdH0gZWxzZSBpZiAoYmFzZVJhbmdlLmlucHV0MkRpZmZzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRhcHBlbmRMaW5lc1RvUmVzdWx0KGlucHV0MUxpbmVzLCBiYXNlUmFuZ2UuaW5wdXQxUmFuZ2UpO1xuXHRcdFx0fSBlbHNlIGlmIChiYXNlUmFuZ2UuaXNFcXVhbENoYW5nZSkge1xuXHRcdFx0XHRhcHBlbmRMaW5lc1RvUmVzdWx0KGlucHV0MUxpbmVzLCBiYXNlUmFuZ2UuaW5wdXQxUmFuZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXBwZW5kTGluZXNUb1Jlc3VsdChiYXNlTGluZXMsIGJhc2VSYW5nZS5iYXNlUmFuZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGFwcGVuZExpbmVzVG9SZXN1bHQoYmFzZUxpbmVzLCBMaW5lUmFuZ2UuZnJvbUxpbmVOdW1iZXJzKGJhc2VTdGFydExpbmVOdW1iZXIsIGJhc2VMaW5lcy5sZW5ndGggKyAxKSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0TGluZXMuam9pbih0aGlzLnJlc3VsdFRleHRNb2RlbC5nZXRFT0woKSk7XG5cdH1cblxuXHRwdWJsaWMgaGFzQmFzZVJhbmdlKGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2UpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5oYXMoYmFzZVJhbmdlKTtcblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSBiYXNlSW5wdXQxRGlmZnMgPSB0aGlzLmlucHV0MVRleHRNb2RlbERpZmZzLmRpZmZzO1xuXG5cdHB1YmxpYyByZWFkb25seSBiYXNlSW5wdXQyRGlmZnMgPSB0aGlzLmlucHV0MlRleHRNb2RlbERpZmZzLmRpZmZzO1xuXHRwdWJsaWMgcmVhZG9ubHkgYmFzZVJlc3VsdERpZmZzID0gdGhpcy5yZXN1bHRUZXh0TW9kZWxEaWZmcy5kaWZmcztcblx0cHVibGljIGdldCBpc0FwcGx5aW5nRWRpdEluUmVzdWx0KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5yZXN1bHRUZXh0TW9kZWxEaWZmcy5pc0FwcGx5aW5nQ2hhbmdlOyB9XG5cdHB1YmxpYyByZWFkb25seSBpbnB1dDFSZXN1bHRNYXBwaW5nID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdHJldHVybiB0aGlzLmdldElucHV0UmVzdWx0TWFwcGluZyhcblx0XHRcdHRoaXMuYmFzZUlucHV0MURpZmZzLnJlYWQocmVhZGVyKSxcblx0XHRcdHRoaXMuYmFzZVJlc3VsdERpZmZzLnJlYWQocmVhZGVyKSxcblx0XHRcdHRoaXMuaW5wdXQxLnRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSxcblx0XHQpO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgcmVzdWx0SW5wdXQxTWFwcGluZyA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHRoaXMuaW5wdXQxUmVzdWx0TWFwcGluZy5yZWFkKHJlYWRlcikucmV2ZXJzZSgpKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaW5wdXQyUmVzdWx0TWFwcGluZyA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRJbnB1dFJlc3VsdE1hcHBpbmcoXG5cdFx0XHR0aGlzLmJhc2VJbnB1dDJEaWZmcy5yZWFkKHJlYWRlciksXG5cdFx0XHR0aGlzLmJhc2VSZXN1bHREaWZmcy5yZWFkKHJlYWRlciksXG5cdFx0XHR0aGlzLmlucHV0Mi50ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCksXG5cdFx0KTtcblx0fSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHJlc3VsdElucHV0Mk1hcHBpbmcgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB0aGlzLmlucHV0MlJlc3VsdE1hcHBpbmcucmVhZChyZWFkZXIpLnJldmVyc2UoKSk7XG5cblx0cHJpdmF0ZSBnZXRJbnB1dFJlc3VsdE1hcHBpbmcoaW5wdXRMaW5lc0RpZmZzOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSwgcmVzdWx0RGlmZnM6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdLCBpbnB1dExpbmVDb3VudDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgbWFwID0gRG9jdW1lbnRMaW5lUmFuZ2VNYXAuYmV0d2Vlbk91dHB1dHMoaW5wdXRMaW5lc0RpZmZzLCByZXN1bHREaWZmcywgaW5wdXRMaW5lQ291bnQpO1xuXHRcdHJldHVybiBuZXcgRG9jdW1lbnRMaW5lUmFuZ2VNYXAoXG5cdFx0XHRtYXAubGluZVJhbmdlTWFwcGluZ3MubWFwKChtKSA9PlxuXHRcdFx0XHRtLmlucHV0UmFuZ2UuaXNFbXB0eSB8fCBtLm91dHB1dFJhbmdlLmlzRW1wdHlcblx0XHRcdFx0XHQ/IG5ldyBMaW5lUmFuZ2VNYXBwaW5nKFxuXHRcdFx0XHRcdFx0Ly8gV2UgY2FuIGRvIHRoaXMgYmVjYXVzZSB0d28gYWRqYWNlbnQgZGlmZnMgaGF2ZSBvbmUgbGluZSBpbiBiZXR3ZWVuLlxuXHRcdFx0XHRcdFx0bS5pbnB1dFJhbmdlLmRlbHRhU3RhcnQoLTEpLFxuXHRcdFx0XHRcdFx0bS5vdXRwdXRSYW5nZS5kZWx0YVN0YXJ0KC0xKVxuXHRcdFx0XHRcdClcblx0XHRcdFx0XHQ6IG1cblx0XHRcdCksXG5cdFx0XHRtYXAuaW5wdXRMaW5lQ291bnRcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IGJhc2VSZXN1bHRNYXBwaW5nID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IG1hcCA9IG5ldyBEb2N1bWVudExpbmVSYW5nZU1hcCh0aGlzLmJhc2VSZXN1bHREaWZmcy5yZWFkKHJlYWRlciksIC0xKTtcblx0XHRyZXR1cm4gbmV3IERvY3VtZW50TGluZVJhbmdlTWFwKFxuXHRcdFx0bWFwLmxpbmVSYW5nZU1hcHBpbmdzLm1hcCgobSkgPT5cblx0XHRcdFx0bS5pbnB1dFJhbmdlLmlzRW1wdHkgfHwgbS5vdXRwdXRSYW5nZS5pc0VtcHR5XG5cdFx0XHRcdFx0PyBuZXcgTGluZVJhbmdlTWFwcGluZyhcblx0XHRcdFx0XHRcdC8vIFdlIGNhbiBkbyB0aGlzIGJlY2F1c2UgdHdvIGFkamFjZW50IGRpZmZzIGhhdmUgb25lIGxpbmUgaW4gYmV0d2Vlbi5cblx0XHRcdFx0XHRcdG0uaW5wdXRSYW5nZS5kZWx0YVN0YXJ0KC0xKSxcblx0XHRcdFx0XHRcdG0ub3V0cHV0UmFuZ2UuZGVsdGFTdGFydCgtMSlcblx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0OiBtXG5cdFx0XHQpLFxuXHRcdFx0bWFwLmlucHV0TGluZUNvdW50XG5cdFx0KTtcblx0fSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHJlc3VsdEJhc2VNYXBwaW5nID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5iYXNlUmVzdWx0TWFwcGluZy5yZWFkKHJlYWRlcikucmV2ZXJzZSgpKTtcblxuXHRwdWJsaWMgdHJhbnNsYXRlSW5wdXRSYW5nZVRvQmFzZShpbnB1dDogMSB8IDIsIHJhbmdlOiBSYW5nZSk6IFJhbmdlIHtcblx0XHRjb25zdCBiYXNlSW5wdXREaWZmcyA9IGlucHV0ID09PSAxID8gdGhpcy5iYXNlSW5wdXQxRGlmZnMuZ2V0KCkgOiB0aGlzLmJhc2VJbnB1dDJEaWZmcy5nZXQoKTtcblx0XHRjb25zdCBtYXAgPSBuZXcgRG9jdW1lbnRSYW5nZU1hcChiYXNlSW5wdXREaWZmcy5mbGF0TWFwKGQgPT4gZC5yYW5nZU1hcHBpbmdzKSwgMCkucmV2ZXJzZSgpO1xuXHRcdHJldHVybiBtYXAucHJvamVjdFJhbmdlKHJhbmdlKS5vdXRwdXRSYW5nZTtcblx0fVxuXG5cdHB1YmxpYyB0cmFuc2xhdGVCYXNlUmFuZ2VUb0lucHV0KGlucHV0OiAxIHwgMiwgcmFuZ2U6IFJhbmdlKTogUmFuZ2Uge1xuXHRcdGNvbnN0IGJhc2VJbnB1dERpZmZzID0gaW5wdXQgPT09IDEgPyB0aGlzLmJhc2VJbnB1dDFEaWZmcy5nZXQoKSA6IHRoaXMuYmFzZUlucHV0MkRpZmZzLmdldCgpO1xuXHRcdGNvbnN0IG1hcCA9IG5ldyBEb2N1bWVudFJhbmdlTWFwKGJhc2VJbnB1dERpZmZzLmZsYXRNYXAoZCA9PiBkLnJhbmdlTWFwcGluZ3MpLCAwKTtcblx0XHRyZXR1cm4gbWFwLnByb2plY3RSYW5nZShyYW5nZSkub3V0cHV0UmFuZ2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZVJhbmdlSW5SZXN1bHQoYmFzZVJhbmdlOiBMaW5lUmFuZ2UsIHJlYWRlcj86IElSZWFkZXIpOiBMaW5lUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLnJlc3VsdFRleHRNb2RlbERpZmZzLmdldFJlc3VsdExpbmVSYW5nZShiYXNlUmFuZ2UsIHJlYWRlcik7XG5cdH1cblxuXHRwdWJsaWMgdHJhbnNsYXRlUmVzdWx0UmFuZ2VUb0Jhc2UocmFuZ2U6IFJhbmdlKTogUmFuZ2Uge1xuXHRcdGNvbnN0IG1hcCA9IG5ldyBEb2N1bWVudFJhbmdlTWFwKHRoaXMuYmFzZVJlc3VsdERpZmZzLmdldCgpLmZsYXRNYXAoZCA9PiBkLnJhbmdlTWFwcGluZ3MpLCAwKS5yZXZlcnNlKCk7XG5cdFx0cmV0dXJuIG1hcC5wcm9qZWN0UmFuZ2UocmFuZ2UpLm91dHB1dFJhbmdlO1xuXHR9XG5cblx0cHVibGljIHRyYW5zbGF0ZUJhc2VSYW5nZVRvUmVzdWx0KHJhbmdlOiBSYW5nZSk6IFJhbmdlIHtcblx0XHRjb25zdCBtYXAgPSBuZXcgRG9jdW1lbnRSYW5nZU1hcCh0aGlzLmJhc2VSZXN1bHREaWZmcy5nZXQoKS5mbGF0TWFwKGQgPT4gZC5yYW5nZU1hcHBpbmdzKSwgMCk7XG5cdFx0cmV0dXJuIG1hcC5wcm9qZWN0UmFuZ2UocmFuZ2UpLm91dHB1dFJhbmdlO1xuXHR9XG5cblx0cHVibGljIGZpbmRNb2RpZmllZEJhc2VSYW5nZXNJblJhbmdlKHJhbmdlSW5CYXNlOiBMaW5lUmFuZ2UpOiBNb2RpZmllZEJhc2VSYW5nZVtdIHtcblx0XHQvLyBUT0RPIHVzZSBiaW5hcnkgc2VhcmNoXG5cdFx0cmV0dXJuIHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VzLmdldCgpLmZpbHRlcihyID0+IHIuYmFzZVJhbmdlLmludGVyc2VjdHMocmFuZ2VJbkJhc2UpKTtcblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSBkaWZmQ29tcHV0aW5nU3RhdGUgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3Qgc3RhdGVzID0gW1xuXHRcdFx0dGhpcy5pbnB1dDFUZXh0TW9kZWxEaWZmcyxcblx0XHRcdHRoaXMuaW5wdXQyVGV4dE1vZGVsRGlmZnMsXG5cdFx0XHR0aGlzLnJlc3VsdFRleHRNb2RlbERpZmZzLFxuXHRcdF0ubWFwKChzKSA9PiBzLnN0YXRlLnJlYWQocmVhZGVyKSk7XG5cblx0XHRpZiAoc3RhdGVzLnNvbWUoKHMpID0+IHMgPT09IFRleHRNb2RlbERpZmZTdGF0ZS5pbml0aWFsaXppbmcpKSB7XG5cdFx0XHRyZXR1cm4gTWVyZ2VFZGl0b3JNb2RlbFN0YXRlLmluaXRpYWxpemluZztcblx0XHR9XG5cdFx0aWYgKHN0YXRlcy5zb21lKChzKSA9PiBzID09PSBUZXh0TW9kZWxEaWZmU3RhdGUudXBkYXRpbmcpKSB7XG5cdFx0XHRyZXR1cm4gTWVyZ2VFZGl0b3JNb2RlbFN0YXRlLnVwZGF0aW5nO1xuXHRcdH1cblx0XHRyZXR1cm4gTWVyZ2VFZGl0b3JNb2RlbFN0YXRlLnVwVG9EYXRlO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaW5wdXREaWZmQ29tcHV0aW5nU3RhdGUgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3Qgc3RhdGVzID0gW1xuXHRcdFx0dGhpcy5pbnB1dDFUZXh0TW9kZWxEaWZmcyxcblx0XHRcdHRoaXMuaW5wdXQyVGV4dE1vZGVsRGlmZnMsXG5cdFx0XS5tYXAoKHMpID0+IHMuc3RhdGUucmVhZChyZWFkZXIpKTtcblxuXHRcdGlmIChzdGF0ZXMuc29tZSgocykgPT4gcyA9PT0gVGV4dE1vZGVsRGlmZlN0YXRlLmluaXRpYWxpemluZykpIHtcblx0XHRcdHJldHVybiBNZXJnZUVkaXRvck1vZGVsU3RhdGUuaW5pdGlhbGl6aW5nO1xuXHRcdH1cblx0XHRpZiAoc3RhdGVzLnNvbWUoKHMpID0+IHMgPT09IFRleHRNb2RlbERpZmZTdGF0ZS51cGRhdGluZykpIHtcblx0XHRcdHJldHVybiBNZXJnZUVkaXRvck1vZGVsU3RhdGUudXBkYXRpbmc7XG5cdFx0fVxuXHRcdHJldHVybiBNZXJnZUVkaXRvck1vZGVsU3RhdGUudXBUb0RhdGU7XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBpc1VwVG9EYXRlID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5kaWZmQ29tcHV0aW5nU3RhdGUucmVhZChyZWFkZXIpID09PSBNZXJnZUVkaXRvck1vZGVsU3RhdGUudXBUb0RhdGUpO1xuXG5cdHB1YmxpYyByZWFkb25seSBvbkluaXRpYWxpemVkID0gd2FpdEZvclN0YXRlKHRoaXMuZGlmZkNvbXB1dGluZ1N0YXRlLCBzdGF0ZSA9PiBzdGF0ZSA9PT0gTWVyZ2VFZGl0b3JNb2RlbFN0YXRlLnVwVG9EYXRlKS50aGVuKCgpID0+IHsgfSk7XG5cblx0cHJpdmF0ZSBmaXJzdFJ1biA9IHRydWU7XG5cdHByaXZhdGUgdXBkYXRlQmFzZVJhbmdlQWNjZXB0ZWRTdGF0ZShyZXN1bHREaWZmczogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10sIHN0YXRlczogTWFwPE1vZGlmaWVkQmFzZVJhbmdlLCBNb2RpZmllZEJhc2VSYW5nZURhdGE+LCB0eDogSVRyYW5zYWN0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgYmFzZVJhbmdlV2l0aFN0b3JlQW5kVG91Y2hpbmdEaWZmcyA9IGxlZnRKb2luKFxuXHRcdFx0c3RhdGVzLFxuXHRcdFx0cmVzdWx0RGlmZnMsXG5cdFx0XHQoYmFzZVJhbmdlLCBkaWZmKSA9PlxuXHRcdFx0XHRiYXNlUmFuZ2VbMF0uYmFzZVJhbmdlLnRvdWNoZXMoZGlmZi5pbnB1dFJhbmdlKVxuXHRcdFx0XHRcdD8gQ29tcGFyZVJlc3VsdC5uZWl0aGVyTGVzc09yR3JlYXRlclRoYW5cblx0XHRcdFx0XHQ6IExpbmVSYW5nZS5jb21wYXJlQnlTdGFydChcblx0XHRcdFx0XHRcdGJhc2VSYW5nZVswXS5iYXNlUmFuZ2UsXG5cdFx0XHRcdFx0XHRkaWZmLmlucHV0UmFuZ2Vcblx0XHRcdFx0XHQpXG5cdFx0KTtcblxuXHRcdGZvciAoY29uc3Qgcm93IG9mIGJhc2VSYW5nZVdpdGhTdG9yZUFuZFRvdWNoaW5nRGlmZnMpIHtcblx0XHRcdGNvbnN0IG5ld1N0YXRlID0gdGhpcy5jb21wdXRlU3RhdGUocm93LmxlZnRbMF0sIHJvdy5yaWdodHMpO1xuXHRcdFx0Y29uc3QgZGF0YSA9IHJvdy5sZWZ0WzFdO1xuXHRcdFx0Y29uc3Qgb2xkU3RhdGUgPSBkYXRhLmFjY2VwdGVkLmdldCgpO1xuXHRcdFx0aWYgKCFvbGRTdGF0ZS5lcXVhbHMobmV3U3RhdGUpKSB7XG5cdFx0XHRcdGlmICghdGhpcy5maXJzdFJ1biAmJiAhZGF0YS5jb21wdXRlZEZyb21EaWZmaW5nKSB7XG5cdFx0XHRcdFx0Ly8gRG9uJ3Qgc2V0IHRoaXMgb24gdGhlIGZpcnN0IHJ1biAtIHRoZSBmaXJzdCBydW4gbWlnaHQgYmUgdXNlZCB0byByZXN0b3JlIHN0YXRlLlxuXHRcdFx0XHRcdGRhdGEuY29tcHV0ZWRGcm9tRGlmZmluZyA9IHRydWU7XG5cdFx0XHRcdFx0ZGF0YS5wcmV2aW91c05vbkRpZmZpbmdTdGF0ZSA9IG9sZFN0YXRlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRhdGEuYWNjZXB0ZWQuc2V0KG5ld1N0YXRlLCB0eCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZmlyc3RSdW4pIHtcblx0XHRcdHRoaXMuZmlyc3RSdW4gPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVTdGF0ZShiYXNlUmFuZ2U6IE1vZGlmaWVkQmFzZVJhbmdlLCBjb25mbGljdGluZ0RpZmZzOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSk6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUge1xuXHRcdGlmIChjb25mbGljdGluZ0RpZmZzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUuYmFzZTtcblx0XHR9XG5cdFx0Y29uc3QgY29uZmxpY3RpbmdFZGl0cyA9IGNvbmZsaWN0aW5nRGlmZnMubWFwKChkKSA9PiBkLmdldExpbmVFZGl0KCkpO1xuXG5cdFx0ZnVuY3Rpb24gZWRpdHNBZ3JlZVdpdGhEaWZmcyhkaWZmczogcmVhZG9ubHkgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10pOiBib29sZWFuIHtcblx0XHRcdHJldHVybiBlcXVhbHMoXG5cdFx0XHRcdGNvbmZsaWN0aW5nRWRpdHMsXG5cdFx0XHRcdGRpZmZzLm1hcCgoZCkgPT4gZC5nZXRMaW5lRWRpdCgpKSxcblx0XHRcdFx0KGEsIGIpID0+IGEuZXF1YWxzKGIpXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0c0FncmVlV2l0aERpZmZzKGJhc2VSYW5nZS5pbnB1dDFEaWZmcykpIHtcblx0XHRcdHJldHVybiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2Uud2l0aElucHV0VmFsdWUoMSwgdHJ1ZSk7XG5cdFx0fVxuXHRcdGlmIChlZGl0c0FncmVlV2l0aERpZmZzKGJhc2VSYW5nZS5pbnB1dDJEaWZmcykpIHtcblx0XHRcdHJldHVybiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2Uud2l0aElucHV0VmFsdWUoMiwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhdGVzID0gW1xuXHRcdFx0TW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZS5iYXNlLndpdGhJbnB1dFZhbHVlKDEsIHRydWUpLndpdGhJbnB1dFZhbHVlKDIsIHRydWUsIHRydWUpLFxuXHRcdFx0TW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZS5iYXNlLndpdGhJbnB1dFZhbHVlKDIsIHRydWUpLndpdGhJbnB1dFZhbHVlKDEsIHRydWUsIHRydWUpLFxuXHRcdFx0TW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZS5iYXNlLndpdGhJbnB1dFZhbHVlKDEsIHRydWUpLndpdGhJbnB1dFZhbHVlKDIsIHRydWUsIGZhbHNlKSxcblx0XHRcdE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUuYmFzZS53aXRoSW5wdXRWYWx1ZSgyLCB0cnVlKS53aXRoSW5wdXRWYWx1ZSgxLCB0cnVlLCBmYWxzZSksXG5cdFx0XTtcblxuXHRcdGZvciAoY29uc3QgcyBvZiBzdGF0ZXMpIHtcblx0XHRcdGNvbnN0IHsgZWRpdCB9ID0gYmFzZVJhbmdlLmdldEVkaXRGb3JCYXNlKHMpO1xuXHRcdFx0aWYgKGVkaXQpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0UmFuZ2UgPSB0aGlzLnJlc3VsdFRleHRNb2RlbERpZmZzLmdldFJlc3VsdExpbmVSYW5nZShiYXNlUmFuZ2UuYmFzZVJhbmdlKTtcblx0XHRcdFx0Y29uc3QgZXhpc3RpbmdMaW5lcyA9IHJlc3VsdFJhbmdlLmdldExpbmVzKHRoaXMucmVzdWx0VGV4dE1vZGVsKTtcblxuXHRcdFx0XHRpZiAoZXF1YWxzKGVkaXQubmV3TGluZXMsIGV4aXN0aW5nTGluZXMsIChhLCBiKSA9PiBhID09PSBiKSkge1xuXHRcdFx0XHRcdHJldHVybiBzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUudW5yZWNvZ25pemVkO1xuXHR9XG5cblx0cHVibGljIGdldFN0YXRlKGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2UpOiBJT2JzZXJ2YWJsZTxNb2RpZmllZEJhc2VSYW5nZVN0YXRlPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmdTdGF0ZSA9IHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZ2V0KGJhc2VSYW5nZSk7XG5cdFx0aWYgKCFleGlzdGluZ1N0YXRlKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdvYmplY3QgbXVzdCBiZSBmcm9tIHRoaXMgaW5zdGFuY2UnKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV4aXN0aW5nU3RhdGUuYWNjZXB0ZWQ7XG5cdH1cblxuXHRwdWJsaWMgc2V0U3RhdGUoXG5cdFx0YmFzZVJhbmdlOiBNb2RpZmllZEJhc2VSYW5nZSxcblx0XHRzdGF0ZTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSxcblx0XHRfbWFya0lucHV0QXNIYW5kbGVkOiBib29sZWFuIHwgSW5wdXROdW1iZXIsXG5cdFx0dHg6IElUcmFuc2FjdGlvbixcblx0XHRfcHVzaFN0YWNrRWxlbWVudDogYm9vbGVhbiA9IGZhbHNlXG5cdCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc1VwVG9EYXRlLmdldCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdDYW5ub3Qgc2V0IHN0YXRlIHdoaWxlIHVwZGF0aW5nJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhpc3RpbmdTdGF0ZSA9IHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZ2V0KGJhc2VSYW5nZSk7XG5cdFx0aWYgKCFleGlzdGluZ1N0YXRlKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdvYmplY3QgbXVzdCBiZSBmcm9tIHRoaXMgaW5zdGFuY2UnKTtcblx0XHR9XG5cblx0XHRjb25zdCBjb25mbGljdGluZ0RpZmZzID0gdGhpcy5yZXN1bHRUZXh0TW9kZWxEaWZmcy5maW5kVG91Y2hpbmdEaWZmcyhcblx0XHRcdGJhc2VSYW5nZS5iYXNlUmFuZ2Vcblx0XHQpO1xuXHRcdGNvbnN0IGdyb3VwID0gbmV3IFVuZG9SZWRvR3JvdXAoKTtcblx0XHRpZiAoY29uZmxpY3RpbmdEaWZmcykge1xuXHRcdFx0dGhpcy5yZXN1bHRUZXh0TW9kZWxEaWZmcy5yZW1vdmVEaWZmcyhjb25mbGljdGluZ0RpZmZzLCB0eCwgZ3JvdXApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgZWRpdCwgZWZmZWN0aXZlU3RhdGUgfSA9IGJhc2VSYW5nZS5nZXRFZGl0Rm9yQmFzZShzdGF0ZSk7XG5cblx0XHRleGlzdGluZ1N0YXRlLmFjY2VwdGVkLnNldChlZmZlY3RpdmVTdGF0ZSwgdHgpO1xuXHRcdGV4aXN0aW5nU3RhdGUucHJldmlvdXNOb25EaWZmaW5nU3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0ZXhpc3RpbmdTdGF0ZS5jb21wdXRlZEZyb21EaWZmaW5nID0gZmFsc2U7XG5cblx0XHRjb25zdCBpbnB1dDFIYW5kbGVkID0gZXhpc3RpbmdTdGF0ZS5oYW5kbGVkSW5wdXQxLmdldCgpO1xuXHRcdGNvbnN0IGlucHV0MkhhbmRsZWQgPSBleGlzdGluZ1N0YXRlLmhhbmRsZWRJbnB1dDIuZ2V0KCk7XG5cblx0XHRpZiAoIWlucHV0MUhhbmRsZWQgfHwgIWlucHV0MkhhbmRsZWQpIHtcblx0XHRcdHRoaXMudW5kb1JlZG9TZXJ2aWNlLnB1c2hFbGVtZW50KFxuXHRcdFx0XHRuZXcgTWFya0FzSGFuZGxlZFVuZG9SZWRvRWxlbWVudCh0aGlzLnJlc3VsdFRleHRNb2RlbC51cmksIG5ldyBXZWFrUmVmKHRoaXMpLCBuZXcgV2Vha1JlZihleGlzdGluZ1N0YXRlKSwgaW5wdXQxSGFuZGxlZCwgaW5wdXQySGFuZGxlZCksXG5cdFx0XHRcdGdyb3VwXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0KSB7XG5cdFx0XHR0aGlzLnJlc3VsdFRleHRNb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHR0aGlzLnJlc3VsdFRleHRNb2RlbERpZmZzLmFwcGx5RWRpdFJlbGF0aXZlVG9PcmlnaW5hbChlZGl0LCB0eCwgZ3JvdXApO1xuXHRcdFx0dGhpcy5yZXN1bHRUZXh0TW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdH1cblxuXHRcdC8vIGFsd2F5cyBzZXQgY29uZmxpY3QgYXMgaGFuZGxlZFxuXHRcdGV4aXN0aW5nU3RhdGUuaGFuZGxlZElucHV0MS5zZXQodHJ1ZSwgdHgpO1xuXHRcdGV4aXN0aW5nU3RhdGUuaGFuZGxlZElucHV0Mi5zZXQodHJ1ZSwgdHgpO1xuXHR9XG5cblx0cHVibGljIHJlc2V0RGlydHlDb25mbGljdHNUb0Jhc2UoKTogdm9pZCB7XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBSZXNldCBVbmtub3duIEJhc2UgUmFuZ2UgU3RhdGVzICovXG5cdFx0XHR0aGlzLnJlc3VsdFRleHRNb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VzLmdldCgpKSB7XG5cdFx0XHRcdGlmICh0aGlzLmdldFN0YXRlKHJhbmdlKS5nZXQoKS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC51bnJlY29nbml6ZWQpIHtcblx0XHRcdFx0XHR0aGlzLnNldFN0YXRlKHJhbmdlLCBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2UsIGZhbHNlLCB0eCwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJlc3VsdFRleHRNb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgaXNIYW5kbGVkKGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2UpOiBJT2JzZXJ2YWJsZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZ2V0KGJhc2VSYW5nZSkhLmhhbmRsZWQ7XG5cdH1cblxuXHRwdWJsaWMgaXNJbnB1dEhhbmRsZWQoYmFzZVJhbmdlOiBNb2RpZmllZEJhc2VSYW5nZSwgaW5wdXROdW1iZXI6IElucHV0TnVtYmVyKTogSU9ic2VydmFibGU8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5nZXQoYmFzZVJhbmdlKSE7XG5cdFx0cmV0dXJuIGlucHV0TnVtYmVyID09PSAxID8gc3RhdGUuaGFuZGxlZElucHV0MSA6IHN0YXRlLmhhbmRsZWRJbnB1dDI7XG5cdH1cblxuXHRwdWJsaWMgc2V0SW5wdXRIYW5kbGVkKGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2UsIGlucHV0TnVtYmVyOiBJbnB1dE51bWJlciwgaGFuZGxlZDogYm9vbGVhbiwgdHg6IElUcmFuc2FjdGlvbik6IHZvaWQge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5nZXQoYmFzZVJhbmdlKSE7XG5cdFx0aWYgKHN0YXRlLmhhbmRsZWQuZ2V0KCkgPT09IGhhbmRsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhUmVmID0gbmV3IFdlYWtSZWYoTW9kaWZpZWRCYXNlUmFuZ2VEYXRhKTtcblx0XHRjb25zdCBtb2RlbFJlZiA9IG5ldyBXZWFrUmVmKHRoaXMpO1xuXG5cdFx0dGhpcy51bmRvUmVkb1NlcnZpY2UucHVzaEVsZW1lbnQoe1xuXHRcdFx0dHlwZTogVW5kb1JlZG9FbGVtZW50VHlwZS5SZXNvdXJjZSxcblx0XHRcdHJlc291cmNlOiB0aGlzLnJlc3VsdFRleHRNb2RlbC51cmksXG5cdFx0XHRjb2RlOiAnc2V0SW5wdXRIYW5kbGVkJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2V0SW5wdXRIYW5kbGVkJywgXCJTZXQgSW5wdXQgSGFuZGxlZFwiKSxcblx0XHRcdHJlZG8oKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gbW9kZWxSZWYuZGVyZWYoKTtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGRhdGFSZWYuZGVyZWYoKTtcblx0XHRcdFx0aWYgKG1vZGVsICYmICFtb2RlbC5pc0Rpc3Bvc2VkKCkgJiYgZGF0YSkge1xuXHRcdFx0XHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdFx0XHRcdGlmIChpbnB1dE51bWJlciA9PT0gMSkge1xuXHRcdFx0XHRcdFx0XHRzdGF0ZS5oYW5kbGVkSW5wdXQxLnNldChoYW5kbGVkLCB0eCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzdGF0ZS5oYW5kbGVkSW5wdXQyLnNldChoYW5kbGVkLCB0eCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1bmRvKCkge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IG1vZGVsUmVmLmRlcmVmKCk7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBkYXRhUmVmLmRlcmVmKCk7XG5cdFx0XHRcdGlmIChtb2RlbCAmJiAhbW9kZWwuaXNEaXNwb3NlZCgpICYmIGRhdGEpIHtcblx0XHRcdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoaW5wdXROdW1iZXIgPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0c3RhdGUuaGFuZGxlZElucHV0MS5zZXQoIWhhbmRsZWQsIHR4KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHN0YXRlLmhhbmRsZWRJbnB1dDIuc2V0KCFoYW5kbGVkLCB0eCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRpZiAoaW5wdXROdW1iZXIgPT09IDEpIHtcblx0XHRcdHN0YXRlLmhhbmRsZWRJbnB1dDEuc2V0KGhhbmRsZWQsIHR4KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3RhdGUuaGFuZGxlZElucHV0Mi5zZXQoaGFuZGxlZCwgdHgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzZXRIYW5kbGVkKGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2UsIGhhbmRsZWQ6IGJvb2xlYW4sIHR4OiBJVHJhbnNhY3Rpb24pOiB2b2lkIHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZ2V0KGJhc2VSYW5nZSkhO1xuXHRcdGlmIChzdGF0ZS5oYW5kbGVkLmdldCgpID09PSBoYW5kbGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3RhdGUuaGFuZGxlZElucHV0MS5zZXQoaGFuZGxlZCwgdHgpO1xuXHRcdHN0YXRlLmhhbmRsZWRJbnB1dDIuc2V0KGhhbmRsZWQsIHR4KTtcblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSB1bmhhbmRsZWRDb25mbGljdHNDb3VudCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBtYXAgPSB0aGlzLm1vZGlmaWVkQmFzZVJhbmdlUmVzdWx0U3RhdGVzLnJlYWQocmVhZGVyKTtcblx0XHRsZXQgdW5oYW5kbGVkQ291bnQgPSAwO1xuXHRcdGZvciAoY29uc3QgW19rZXksIHZhbHVlXSBvZiBtYXApIHtcblx0XHRcdGlmICghdmFsdWUuaGFuZGxlZC5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0dW5oYW5kbGVkQ291bnQrKztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuaGFuZGxlZENvdW50O1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaGFzVW5oYW5kbGVkQ29uZmxpY3RzID0gdGhpcy51bmhhbmRsZWRDb25mbGljdHNDb3VudC5tYXAodmFsdWUgPT4gLyoqIEBkZXNjcmlwdGlvbiBoYXNVbmhhbmRsZWRDb25mbGljdHMgKi8gdmFsdWUgPiAwKTtcblxuXHRwdWJsaWMgc2V0TGFuZ3VhZ2VJZChsYW5ndWFnZUlkOiBzdHJpbmcsIHNvdXJjZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGxhbmd1YWdlID0gdGhpcy5sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZChsYW5ndWFnZUlkKTtcblx0XHR0aGlzLmJhc2Uuc2V0TGFuZ3VhZ2UobGFuZ3VhZ2UsIHNvdXJjZSk7XG5cdFx0dGhpcy5pbnB1dDEudGV4dE1vZGVsLnNldExhbmd1YWdlKGxhbmd1YWdlLCBzb3VyY2UpO1xuXHRcdHRoaXMuaW5wdXQyLnRleHRNb2RlbC5zZXRMYW5ndWFnZShsYW5ndWFnZSwgc291cmNlKTtcblx0XHR0aGlzLnJlc3VsdFRleHRNb2RlbC5zZXRMYW5ndWFnZShsYW5ndWFnZSwgc291cmNlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRJbml0aWFsUmVzdWx0VmFsdWUoKTogc3RyaW5nIHtcblx0XHRjb25zdCBjaHVua3M6IHN0cmluZ1tdID0gW107XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGNvbnN0IGNodW5rID0gdGhpcy5yZXN1bHRTbmFwc2hvdC5yZWFkKCk7XG5cdFx0XHRpZiAoY2h1bmsgPT09IG51bGwpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjaHVua3MucHVzaChjaHVuayk7XG5cdFx0fVxuXHRcdHJldHVybiBjaHVua3Muam9pbigpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldFJlc3VsdFZhbHVlV2l0aENvbmZsaWN0TWFya2VycygpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGF3YWl0IHdhaXRGb3JTdGF0ZSh0aGlzLmRpZmZDb21wdXRpbmdTdGF0ZSwgc3RhdGUgPT4gc3RhdGUgPT09IE1lcmdlRWRpdG9yTW9kZWxTdGF0ZS51cFRvRGF0ZSk7XG5cblx0XHRpZiAodGhpcy51bmhhbmRsZWRDb25mbGljdHNDb3VudC5nZXQoKSA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVzdWx0VGV4dE1vZGVsLmdldFZhbHVlKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0TGluZXMgPSB0aGlzLnJlc3VsdFRleHRNb2RlbC5nZXRMaW5lc0NvbnRlbnQoKTtcblx0XHRjb25zdCBpbnB1dDFMaW5lcyA9IHRoaXMuaW5wdXQxLnRleHRNb2RlbC5nZXRMaW5lc0NvbnRlbnQoKTtcblx0XHRjb25zdCBpbnB1dDJMaW5lcyA9IHRoaXMuaW5wdXQyLnRleHRNb2RlbC5nZXRMaW5lc0NvbnRlbnQoKTtcblxuXHRcdGNvbnN0IHN0YXRlcyA9IHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCk7XG5cblx0XHRjb25zdCBvdXRwdXRMaW5lczogc3RyaW5nW10gPSBbXTtcblx0XHRmdW5jdGlvbiBhcHBlbmRMaW5lc1RvUmVzdWx0KHNvdXJjZTogc3RyaW5nW10sIGxpbmVSYW5nZTogTGluZVJhbmdlKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gbGluZVJhbmdlLnN0YXJ0TGluZU51bWJlcjsgaSA8IGxpbmVSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlOyBpKyspIHtcblx0XHRcdFx0b3V0cHV0TGluZXMucHVzaChzb3VyY2VbaSAtIDFdKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0U3RhcnRMaW5lTnVtYmVyID0gMTtcblxuXHRcdGZvciAoY29uc3QgW3JhbmdlLCBzdGF0ZV0gb2Ygc3RhdGVzKSB7XG5cdFx0XHRpZiAoc3RhdGUuaGFuZGxlZC5nZXQoKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlc3VsdFJhbmdlID0gdGhpcy5yZXN1bHRUZXh0TW9kZWxEaWZmcy5nZXRSZXN1bHRMaW5lUmFuZ2UocmFuZ2UuYmFzZVJhbmdlKTtcblxuXHRcdFx0YXBwZW5kTGluZXNUb1Jlc3VsdChyZXN1bHRMaW5lcywgTGluZVJhbmdlLmZyb21MaW5lTnVtYmVycyhyZXN1bHRTdGFydExpbmVOdW1iZXIsIE1hdGgubWF4KHJlc3VsdFN0YXJ0TGluZU51bWJlciwgcmVzdWx0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSkpO1xuXHRcdFx0cmVzdWx0U3RhcnRMaW5lTnVtYmVyID0gcmVzdWx0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZTtcblxuXHRcdFx0b3V0cHV0TGluZXMucHVzaCgnPDw8PDw8PCcpO1xuXHRcdFx0aWYgKHN0YXRlLmFjY2VwdGVkLmdldCgpLmtpbmQgPT09IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLnVucmVjb2duaXplZCkge1xuXHRcdFx0XHQvLyB0byBwcmV2ZW50IGxvc3Mgb2YgZGF0YSwgdXNlIG1vZGlmaWVkIHJlc3VsdCBhcyBcIm91cnNcIlxuXHRcdFx0XHRhcHBlbmRMaW5lc1RvUmVzdWx0KHJlc3VsdExpbmVzLCByZXN1bHRSYW5nZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhcHBlbmRMaW5lc1RvUmVzdWx0KGlucHV0MUxpbmVzLCByYW5nZS5pbnB1dDFSYW5nZSk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXRMaW5lcy5wdXNoKCc9PT09PT09Jyk7XG5cdFx0XHRhcHBlbmRMaW5lc1RvUmVzdWx0KGlucHV0MkxpbmVzLCByYW5nZS5pbnB1dDJSYW5nZSk7XG5cdFx0XHRvdXRwdXRMaW5lcy5wdXNoKCc+Pj4+Pj4+Jyk7XG5cdFx0fVxuXG5cdFx0YXBwZW5kTGluZXNUb1Jlc3VsdChyZXN1bHRMaW5lcywgTGluZVJhbmdlLmZyb21MaW5lTnVtYmVycyhyZXN1bHRTdGFydExpbmVOdW1iZXIsIHJlc3VsdExpbmVzLmxlbmd0aCArIDEpKTtcblx0XHRyZXR1cm4gb3V0cHV0TGluZXMuam9pbignXFxuJyk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNvbmZsaWN0Q291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gYXJyYXlDb3VudCh0aGlzLm1vZGlmaWVkQmFzZVJhbmdlcy5nZXQoKSwgciA9PiByLmlzQ29uZmxpY3RpbmcpO1xuXHR9XG5cdHB1YmxpYyBnZXQgY29tYmluYWJsZUNvbmZsaWN0Q291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gYXJyYXlDb3VudCh0aGlzLm1vZGlmaWVkQmFzZVJhbmdlcy5nZXQoKSwgciA9PiByLmlzQ29uZmxpY3RpbmcgJiYgci5jYW5CZUNvbWJpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgY29uZmxpY3RzUmVzb2x2ZWRXaXRoQmFzZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiBhcnJheUNvdW50KFxuXHRcdFx0dGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5lbnRyaWVzKCksXG5cdFx0XHQoW3IsIHNdKSA9PlxuXHRcdFx0XHRyLmlzQ29uZmxpY3RpbmcgJiZcblx0XHRcdFx0cy5hY2NlcHRlZC5nZXQoKS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5iYXNlXG5cdFx0KTtcblx0fVxuXHRwdWJsaWMgZ2V0IGNvbmZsaWN0c1Jlc29sdmVkV2l0aElucHV0MSgpOiBudW1iZXIge1xuXHRcdHJldHVybiBhcnJheUNvdW50KFxuXHRcdFx0dGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5lbnRyaWVzKCksXG5cdFx0XHQoW3IsIHNdKSA9PlxuXHRcdFx0XHRyLmlzQ29uZmxpY3RpbmcgJiZcblx0XHRcdFx0cy5hY2NlcHRlZC5nZXQoKS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5pbnB1dDFcblx0XHQpO1xuXHR9XG5cdHB1YmxpYyBnZXQgY29uZmxpY3RzUmVzb2x2ZWRXaXRoSW5wdXQyKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIGFycmF5Q291bnQoXG5cdFx0XHR0aGlzLm1vZGlmaWVkQmFzZVJhbmdlUmVzdWx0U3RhdGVzLmdldCgpLmVudHJpZXMoKSxcblx0XHRcdChbciwgc10pID0+XG5cdFx0XHRcdHIuaXNDb25mbGljdGluZyAmJlxuXHRcdFx0XHRzLmFjY2VwdGVkLmdldCgpLmtpbmQgPT09IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLmlucHV0MlxuXHRcdCk7XG5cdH1cblx0cHVibGljIGdldCBjb25mbGljdHNSZXNvbHZlZFdpdGhTbWFydENvbWJpbmF0aW9uKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIGFycmF5Q291bnQoXG5cdFx0XHR0aGlzLm1vZGlmaWVkQmFzZVJhbmdlUmVzdWx0U3RhdGVzLmdldCgpLmVudHJpZXMoKSxcblx0XHRcdChbciwgc106IFtNb2RpZmllZEJhc2VSYW5nZSwgTW9kaWZpZWRCYXNlUmFuZ2VEYXRhXSkgPT4ge1xuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IHMuYWNjZXB0ZWQuZ2V0KCk7XG5cdFx0XHRcdHJldHVybiByLmlzQ29uZmxpY3RpbmcgJiYgc3RhdGUua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuYm90aCAmJiBzdGF0ZS5zbWFydENvbWJpbmF0aW9uO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbE5vbmUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gYXJyYXlDb3VudChcblx0XHRcdHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZW50cmllcygpLFxuXHRcdFx0KFtyLCBzXSkgPT5cblx0XHRcdFx0ci5pc0NvbmZsaWN0aW5nICYmXG5cdFx0XHRcdHMuYWNjZXB0ZWQuZ2V0KCkua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQudW5yZWNvZ25pemVkXG5cdFx0KTtcblx0fVxuXHRwdWJsaWMgZ2V0IG1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbFNtYXJ0Q29tYmluZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiBhcnJheUNvdW50KFxuXHRcdFx0dGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5lbnRyaWVzKCksXG5cdFx0XHQoW3IsIHNdOiBbTW9kaWZpZWRCYXNlUmFuZ2UsIE1vZGlmaWVkQmFzZVJhbmdlRGF0YV0pID0+IHtcblx0XHRcdFx0Y29uc3Qgc3RhdGUgPSBzLmFjY2VwdGVkLmdldCgpO1xuXHRcdFx0XHRyZXR1cm4gci5pc0NvbmZsaWN0aW5nICYmIHMuY29tcHV0ZWRGcm9tRGlmZmluZyAmJiBzdGF0ZS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5ib3RoICYmIHN0YXRlLnNtYXJ0Q29tYmluYXRpb247XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXHRwdWJsaWMgZ2V0IG1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbElucHV0MSgpOiBudW1iZXIge1xuXHRcdHJldHVybiBhcnJheUNvdW50KFxuXHRcdFx0dGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5lbnRyaWVzKCksXG5cdFx0XHQoW3IsIHNdOiBbTW9kaWZpZWRCYXNlUmFuZ2UsIE1vZGlmaWVkQmFzZVJhbmdlRGF0YV0pID0+IHtcblx0XHRcdFx0Y29uc3Qgc3RhdGUgPSBzLmFjY2VwdGVkLmdldCgpO1xuXHRcdFx0XHRyZXR1cm4gci5pc0NvbmZsaWN0aW5nICYmIHMuY29tcHV0ZWRGcm9tRGlmZmluZyAmJiBzdGF0ZS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5pbnB1dDE7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXHRwdWJsaWMgZ2V0IG1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbElucHV0MigpOiBudW1iZXIge1xuXHRcdHJldHVybiBhcnJheUNvdW50KFxuXHRcdFx0dGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5lbnRyaWVzKCksXG5cdFx0XHQoW3IsIHNdOiBbTW9kaWZpZWRCYXNlUmFuZ2UsIE1vZGlmaWVkQmFzZVJhbmdlRGF0YV0pID0+IHtcblx0XHRcdFx0Y29uc3Qgc3RhdGUgPSBzLmFjY2VwdGVkLmdldCgpO1xuXHRcdFx0XHRyZXR1cm4gci5pc0NvbmZsaWN0aW5nICYmIHMuY29tcHV0ZWRGcm9tRGlmZmluZyAmJiBzdGF0ZS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5pbnB1dDI7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbWFudWFsbHlTb2x2ZWRDb25mbGljdENvdW50VGhhdEVxdWFsTm9uZUFuZFN0YXJ0ZWRXaXRoQmFzZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiBhcnJheUNvdW50KFxuXHRcdFx0dGhpcy5tb2RpZmllZEJhc2VSYW5nZVJlc3VsdFN0YXRlcy5nZXQoKS5lbnRyaWVzKCksXG5cdFx0XHQoW3IsIHNdOiBbTW9kaWZpZWRCYXNlUmFuZ2UsIE1vZGlmaWVkQmFzZVJhbmdlRGF0YV0pID0+IHtcblx0XHRcdFx0Y29uc3Qgc3RhdGUgPSBzLmFjY2VwdGVkLmdldCgpO1xuXHRcdFx0XHRyZXR1cm4gci5pc0NvbmZsaWN0aW5nICYmIHN0YXRlLmtpbmQgPT09IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLnVucmVjb2duaXplZCAmJiBzLnByZXZpb3VzTm9uRGlmZmluZ1N0YXRlPy5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5iYXNlO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblx0cHVibGljIGdldCBtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhJbnB1dDEoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gYXJyYXlDb3VudChcblx0XHRcdHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZW50cmllcygpLFxuXHRcdFx0KFtyLCBzXTogW01vZGlmaWVkQmFzZVJhbmdlLCBNb2RpZmllZEJhc2VSYW5nZURhdGFdKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHN0YXRlID0gcy5hY2NlcHRlZC5nZXQoKTtcblx0XHRcdFx0cmV0dXJuIHIuaXNDb25mbGljdGluZyAmJiBzdGF0ZS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC51bnJlY29nbml6ZWQgJiYgcy5wcmV2aW91c05vbkRpZmZpbmdTdGF0ZT8ua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuaW5wdXQxO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblx0cHVibGljIGdldCBtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhJbnB1dDIoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gYXJyYXlDb3VudChcblx0XHRcdHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZW50cmllcygpLFxuXHRcdFx0KFtyLCBzXTogW01vZGlmaWVkQmFzZVJhbmdlLCBNb2RpZmllZEJhc2VSYW5nZURhdGFdKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHN0YXRlID0gcy5hY2NlcHRlZC5nZXQoKTtcblx0XHRcdFx0cmV0dXJuIHIuaXNDb25mbGljdGluZyAmJiBzdGF0ZS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC51bnJlY29nbml6ZWQgJiYgcy5wcmV2aW91c05vbkRpZmZpbmdTdGF0ZT8ua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuaW5wdXQyO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblx0cHVibGljIGdldCBtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhCb3RoTm9uU21hcnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gYXJyYXlDb3VudChcblx0XHRcdHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VSZXN1bHRTdGF0ZXMuZ2V0KCkuZW50cmllcygpLFxuXHRcdFx0KFtyLCBzXTogW01vZGlmaWVkQmFzZVJhbmdlLCBNb2RpZmllZEJhc2VSYW5nZURhdGFdKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHN0YXRlID0gcy5hY2NlcHRlZC5nZXQoKTtcblx0XHRcdFx0cmV0dXJuIHIuaXNDb25mbGljdGluZyAmJiBzdGF0ZS5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC51bnJlY29nbml6ZWQgJiYgcy5wcmV2aW91c05vbkRpZmZpbmdTdGF0ZT8ua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuYm90aCAmJiAhcy5wcmV2aW91c05vbkRpZmZpbmdTdGF0ZT8uc21hcnRDb21iaW5hdGlvbjtcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cdHB1YmxpYyBnZXQgbWFudWFsbHlTb2x2ZWRDb25mbGljdENvdW50VGhhdEVxdWFsTm9uZUFuZFN0YXJ0ZWRXaXRoQm90aFNtYXJ0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIGFycmF5Q291bnQoXG5cdFx0XHR0aGlzLm1vZGlmaWVkQmFzZVJhbmdlUmVzdWx0U3RhdGVzLmdldCgpLmVudHJpZXMoKSxcblx0XHRcdChbciwgc106IFtNb2RpZmllZEJhc2VSYW5nZSwgTW9kaWZpZWRCYXNlUmFuZ2VEYXRhXSkgPT4ge1xuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IHMuYWNjZXB0ZWQuZ2V0KCk7XG5cdFx0XHRcdHJldHVybiByLmlzQ29uZmxpY3RpbmcgJiYgc3RhdGUua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQudW5yZWNvZ25pemVkICYmIHMucHJldmlvdXNOb25EaWZmaW5nU3RhdGU/LmtpbmQgPT09IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLmJvdGggJiYgcy5wcmV2aW91c05vbkRpZmZpbmdTdGF0ZT8uc21hcnRDb21iaW5hdGlvbjtcblx0XHRcdH1cblx0XHQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFycmF5Q291bnQ8VD4oYXJyYXk6IEl0ZXJhYmxlPFQ+LCBwcmVkaWNhdGU6ICh2YWx1ZTogVCkgPT4gYm9vbGVhbik6IG51bWJlciB7XG5cdGxldCBjb3VudCA9IDA7XG5cdGZvciAoY29uc3QgdmFsdWUgb2YgYXJyYXkpIHtcblx0XHRpZiAocHJlZGljYXRlKHZhbHVlKSkge1xuXHRcdFx0Y291bnQrKztcblx0XHR9XG5cdH1cblx0cmV0dXJuIGNvdW50O1xufVxuXG5jbGFzcyBNb2RpZmllZEJhc2VSYW5nZURhdGEge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2UpIHsgfVxuXG5cdHB1YmxpYyBhY2NlcHRlZDogSVNldHRhYmxlT2JzZXJ2YWJsZTxNb2RpZmllZEJhc2VSYW5nZVN0YXRlPiA9IG9ic2VydmFibGVWYWx1ZShgQmFzZVJhbmdlU3RhdGUke3RoaXMuYmFzZVJhbmdlLmJhc2VSYW5nZX1gLCBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2UpO1xuXHRwdWJsaWMgaGFuZGxlZElucHV0MTogSVNldHRhYmxlT2JzZXJ2YWJsZTxib29sZWFuPiA9IG9ic2VydmFibGVWYWx1ZShgQmFzZVJhbmdlSGFuZGxlZFN0YXRlJHt0aGlzLmJhc2VSYW5nZS5iYXNlUmFuZ2V9LklucHV0MWAsIGZhbHNlKTtcblx0cHVibGljIGhhbmRsZWRJbnB1dDI6IElTZXR0YWJsZU9ic2VydmFibGU8Ym9vbGVhbj4gPSBvYnNlcnZhYmxlVmFsdWUoYEJhc2VSYW5nZUhhbmRsZWRTdGF0ZSR7dGhpcy5iYXNlUmFuZ2UuYmFzZVJhbmdlfS5JbnB1dDJgLCBmYWxzZSk7XG5cblx0cHVibGljIGNvbXB1dGVkRnJvbURpZmZpbmcgPSBmYWxzZTtcblx0cHVibGljIHByZXZpb3VzTm9uRGlmZmluZ1N0YXRlOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHB1YmxpYyByZWFkb25seSBoYW5kbGVkID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5oYW5kbGVkSW5wdXQxLnJlYWQocmVhZGVyKSAmJiB0aGlzLmhhbmRsZWRJbnB1dDIucmVhZChyZWFkZXIpKTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gTWVyZ2VFZGl0b3JNb2RlbFN0YXRlIHtcblx0aW5pdGlhbGl6aW5nID0gMSxcblx0dXBUb0RhdGUgPSAyLFxuXHR1cGRhdGluZyA9IDMsXG59XG5cbmNsYXNzIE1hcmtBc0hhbmRsZWRVbmRvUmVkb0VsZW1lbnQgaW1wbGVtZW50cyBJUmVzb3VyY2VVbmRvUmVkb0VsZW1lbnQge1xuXHRwdWJsaWMgcmVhZG9ubHkgY29kZSA9ICd1bmRvTWFya0FzSGFuZGxlZCc7XG5cdHB1YmxpYyByZWFkb25seSBsYWJlbCA9IGxvY2FsaXplKCd1bmRvTWFya0FzSGFuZGxlZCcsICdVbmRvIE1hcmsgQXMgSGFuZGxlZCcpO1xuXG5cdHB1YmxpYyByZWFkb25seSB0eXBlID0gVW5kb1JlZG9FbGVtZW50VHlwZS5SZXNvdXJjZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVzb3VyY2U6IFVSSSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1lcmdlRWRpdG9yTW9kZWxSZWY6IFdlYWtSZWY8TWVyZ2VFZGl0b3JNb2RlbD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzdGF0ZVJlZjogV2Vha1JlZjxNb2RpZmllZEJhc2VSYW5nZURhdGE+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaW5wdXQxSGFuZGxlZDogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGlucHV0MkhhbmRsZWQ6IGJvb2xlYW4sXG5cdCkgeyB9XG5cblx0cHVibGljIHJlZG8oKSB7XG5cdFx0Y29uc3QgbWVyZ2VFZGl0b3JNb2RlbCA9IHRoaXMubWVyZ2VFZGl0b3JNb2RlbFJlZi5kZXJlZigpO1xuXHRcdGlmICghbWVyZ2VFZGl0b3JNb2RlbCB8fCBtZXJnZUVkaXRvck1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVSZWYuZGVyZWYoKTtcblx0XHRpZiAoIXN0YXRlKSB7IHJldHVybjsgfVxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHN0YXRlLmhhbmRsZWRJbnB1dDEuc2V0KHRydWUsIHR4KTtcblx0XHRcdHN0YXRlLmhhbmRsZWRJbnB1dDIuc2V0KHRydWUsIHR4KTtcblx0XHR9KTtcblx0fVxuXHRwdWJsaWMgdW5kbygpIHtcblx0XHRjb25zdCBtZXJnZUVkaXRvck1vZGVsID0gdGhpcy5tZXJnZUVkaXRvck1vZGVsUmVmLmRlcmVmKCk7XG5cdFx0aWYgKCFtZXJnZUVkaXRvck1vZGVsIHx8IG1lcmdlRWRpdG9yTW9kZWwuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZVJlZi5kZXJlZigpO1xuXHRcdGlmICghc3RhdGUpIHsgcmV0dXJuOyB9XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0c3RhdGUuaGFuZGxlZElucHV0MS5zZXQodGhpcy5pbnB1dDFIYW5kbGVkLCB0eCk7XG5cdFx0XHRzdGF0ZS5oYW5kbGVkSW5wdXQyLnNldCh0aGlzLmlucHV0MkhhbmRsZWQsIHR4KTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWUsY0FBYztBQUN0QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHNCQUFzQixTQUFrRSxjQUFjLGlCQUFpQixhQUFhLG9CQUFvQjtBQUVqSyxTQUFTLGFBQWE7QUFDdEIsU0FBUyx3QkFBd0I7QUFFakMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBbUMsa0JBQWtCLHFCQUFxQixxQkFBcUI7QUFDL0YsU0FBUyxtQkFBbUI7QUFFNUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBbUMsc0JBQXNCLGtCQUFrQix3QkFBd0I7QUFDbkcsU0FBUywyQkFBMkIsZ0JBQWdCLDBCQUEwQjtBQUU5RSxTQUFTLGdCQUFnQjtBQUN6QixTQUFzQixtQkFBbUIsd0JBQXdCLGtDQUFrQztBQVM1RixJQUFNLG1CQUFOLGNBQStCLFlBQVk7QUFBQSxFQXFCakQsWUFDVSxNQUNBLFFBQ0EsUUFDQSxpQkFDUSxjQUNBLFNBQ0QsV0FDbUIsaUJBQ0EsaUJBQ2xDO0FBQ0QsVUFBTTtBQVZHO0FBQ0E7QUFDQTtBQUNBO0FBQ1E7QUFDQTtBQUNEO0FB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
