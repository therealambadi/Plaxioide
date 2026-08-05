import { onUnexpectedError } from "../../../base/common/errors.js";
import * as strings from "../../../base/common/strings.js";
import { CursorCollection } from "./cursorCollection.js";
import { CursorState, EditOperationResult, EditOperationType } from "../cursorCommon.js";
import { CursorContext } from "./cursorContext.js";
import { DeleteOperations } from "./cursorDeleteOperations.js";
import { CursorChangeReason } from "../cursorEvents.js";
import { CompositionOutcome, TypeOperations } from "./cursorTypeOperations.js";
import { BaseTypeWithAutoClosingCommand } from "./cursorTypeEditOperations.js";
import { Range } from "../core/range.js";
import { Selection, SelectionDirection } from "../core/selection.js";
import * as editorCommon from "../editorCommon.js";
import { TrackedRangeStickiness } from "../model.js";
import { RawContentChangedType, ModelInjectedTextChangedEvent } from "../textModelEvents.js";
import { VerticalRevealType, ViewCursorStateChangedEvent, ViewRevealRangeRequestEvent } from "../viewEvents.js";
import { dispose, Disposable } from "../../../base/common/lifecycle.js";
import { CursorStateChangedEvent } from "../viewModelEventDispatcher.js";
class CursorsController extends Disposable {
  constructor(model, viewModel, coordinatesConverter, cursorConfig) {
    super();
    this._model = model;
    this._knownModelVersionId = this._model.getVersionId();
    this._viewModel = viewModel;
    this._coordinatesConverter = coordinatesConverter;
    this.context = new CursorContext(this._model, this._viewModel, this._coordinatesConverter, cursorConfig);
    this._cursors = new CursorCollection(this.context);
    this._hasFocus = false;
    this._isHandling = false;
    this._compositionState = null;
    this._columnSelectData = null;
    this._autoClosedActions = [];
    this._prevEditOperationType = EditOperationType.Other;
  }
  dispose() {
    this._cursors.dispose();
    this._autoClosedActions = dispose(this._autoClosedActions);
    super.dispose();
  }
  updateConfiguration(cursorConfig) {
    this.context = new CursorContext(this._model, this._viewModel, this._coordinatesConverter, cursorConfig);
    this._cursors.updateContext(this.context);
  }
  onLineMappingChanged(eventsCollector) {
    if (this._knownModelVersionId !== this._model.getVersionId()) {
      return;
    }
    this.setStates(eventsCollector, "viewModel", CursorChangeReason.NotSet, this.getCursorStates());
  }
  setHasFocus(hasFocus) {
    this._hasFocus = hasFocus;
  }
  _validateAutoClosedActions() {
    if (this._autoClosedActions.length > 0) {
      const selections = this._cursors.getSelections();
      for (let i = 0; i < this._autoClosedActions.length; i++) {
        const autoClosedAction = this._autoClosedActions[i];
        if (!autoClosedAction.isValid(selections)) {
          autoClosedAction.dispose();
          this._autoClosedActions.splice(i, 1);
          i--;
        }
      }
    }
  }
  // ------ some getters/setters
  getPrimaryCursorState() {
    return this._cursors.getPrimaryCursor();
  }
  getLastAddedCursorIndex() {
    return this._cursors.getLastAddedCursorIndex();
  }
  getCursorStates() {
    return this._cursors.getAll();
  }
  setStates(eventsCollector, source, reason, states) {
    let reachedMaxCursorCount = false;
    const multiCursorLimit = this.context.cursorConfig.multiCursorLimit;
    if (states !== null && states.length > multiCursorLimit) {
      states = states.slice(0, multiCursorLimit);
      reachedMaxCursorCount = true;
    }
    const oldState = CursorModelState.from(this._model, this);
    this._cursors.setStates(states);
    this._cursors.normalize();
    this._columnSelectData = null;
    this._validateAutoClosedActions();
    return this._emitStateChangedIfNecessary(eventsCollector, source, reason, oldState, reachedMaxCursorCount);
  }
  setCursorColumnSelectData(columnSelectData) {
    this._columnSelectData = columnSelectData;
  }
  revealAll(eventsCollector, source, minimalReveal, verticalType, revealHorizontal, scrollType) {
    const viewPositions = this._cursors.getViewPositions();
    let revealViewRange = null;
    let revealViewSelections = null;
    if (viewPositions.length > 1) {
      revealViewSelections = this._cursors.getViewSelections();
    } else {
      revealViewRange = Range.fromPositions(viewPositions[0], viewPositions[0]);
    }
    eventsCollector.emitViewEvent(new ViewRevealRangeRequestEvent(source, minimalReveal, revealViewRange, revealViewSelections, verticalType, revealHorizontal, scrollType));
  }
  revealPrimary(eventsCollector, source, minimalReveal, verticalType, revealHorizontal, scrollType) {
    const primaryCursor = this._cursors.getPrimaryCursor();
    const revealViewSelections = [primaryCursor.viewState.selection];
    eventsCollector.emitViewEvent(new ViewRevealRangeRequestEvent(source, minimalReveal, null, revealViewSelections, verticalType, revealHorizontal, scrollType));
  }
  saveState() {
    const result = [];
    const selections = this._cursors.getSelections();
    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i];
      result.push({
        inSelectionMode: !selection.isEmpty(),
        selectionStart: {
          lineNumber: selection.selectionStartLineNumber,
          column: selection.selectionStartColumn
        },
        position: {
          lineNumber: selection.positionLineNumber,
          column: selection.positionColumn
        }
      });
    }
    return result;
  }
  restoreState(eventsCollector, states) {
    const desiredSelections = [];
    for (let i = 0, len = states.length; i < len; i++) {
      const state = states[i];
      let positionLineNumber = 1;
      let positionColumn = 1;
      if (state.position && state.position.lineNumber) {
        positionLineNumber = state.position.lineNumber;
      }
      if (state.position && state.position.column) {
        positionColumn = state.position.column;
      }
      let selectionStartLineNumber = positionLineNumber;
      let selectionStartColumn = positionColumn;
      if (state.selectionStart && state.selectionStart.lineNumber) {
        selectionStartLineNumber = state.selectionStart.lineNumber;
      }
      if (state.selectionStart && state.selectionStart.column) {
        selectionStartColumn = state.selectionStart.column;
      }
      desiredSelections.push({
        selectionStartLineNumber,
        selectionStartColumn,
        positionLineNumber,
        positionColumn
      });
    }
    this.setStates(eventsCollector, "restoreState", CursorChangeReason.NotSet, CursorState.fromModelSelections(desiredSelections));
    this.revealAll(eventsCollector, "restoreState", false, VerticalRevealType.Simple, true, editorCommon.ScrollType.Immediate);
  }
  onModelContentChanged(eventsCollector, event) {
    if (event instanceof ModelInjectedTextChangedEvent) {
      if (this._isHandling) {
        return;
      }
      this._isHandling = true;
      try {
        this.setStates(eventsCollector, "modelChange", CursorChangeReason.NotSet, this.getCursorStates());
      } finally {
        this._isHandling = false;
      }
    } else {
      const e = event.rawContentChangedEvent;
      this._knownModelVersionId = e.versionId;
      if (this._isHandling) {
        return;
      }
      const hadFlushEvent = e.containsEvent(RawContentChangedType.Flush);
      this._prevEditOperationType = EditOperationType.Other;
      if (hadFlushEvent) {
        this._cursors.dispose();
        this._cursors = new CursorCollection(this.context);
        this._validateAutoClosedActions();
        this._emitStateChangedIfNecessary(eventsCollector, "model", CursorChangeReason.ContentFlush, null, false);
      } else {
        if (this._hasFocus && e.resultingSelection && e.resultingSelection.length > 0) {
          const cursorState = CursorState.fromModelSelections(e.resultingSelection);
          if (this.setStates(eventsCollector, "modelChange", e.isUndoing ? CursorChangeReason.Undo : e.isRedoing ? CursorChangeReason.Redo : CursorChangeReason.RecoverFromMarkers, cursorState)) {
            this.revealAll(eventsCollector, "modelChange", false, VerticalRevealType.Simple, true, editorCommon.ScrollType.Smooth);
          }
        } else {
          const selectionsFromMarkers = this._cursors.readSelectionFromMarkers();
          this.setStates(eventsCollector, "modelChange", CursorChangeReason.RecoverFromMarkers, CursorState.fromModelSelections(selectionsFromMarkers));
        }
      }
    }
  }
  getSelection() {
    return this._cursors.getPrimaryCursor().modelState.selection;
  }
  getTopMostViewPosition() {
    return this._cursors.getTopMostViewPosition();
  }
  getBottomMostViewPosition() {
    return this._cursors.getBottomMostViewPosition();
  }
  getCursorColumnSelectData() {
    if (this._columnSelectData) {
      return this._columnSelectData;
    }
    const primaryCursor = this._cursors.getPrimaryCursor();
    const viewSelectionStart = primaryCursor.viewState.selectionStart.getStartPosition();
    const viewPosition = primaryCursor.viewState.position;
    return {
      isReal: false,
      fromViewLineNumber: viewSelectionStart.lineNumber,
      fromViewVisualColumn: this.context.cursorConfig.visibleColumnFromColumn(this._viewModel, viewSelectionStart),
      toViewLineNumber: viewPosition.lineNumber,
      toViewVisualColumn: this.context.cursorConfig.visibleColumnFromColumn(this._viewModel, viewPosition)
    };
  }
  getSelections() {
    return this._cursors.getSelections();
  }
  getPosition() {
    return this._cursors.getPrimaryCursor().modelState.position;
  }
  setSelections(eventsCollector, source, selections, reason) {
    this.setStates(eventsCollector, source, reason, CursorState.fromModelSelections(selections));
  }
  getPrevEditOperationType() {
    return this._prevEditOperationType;
  }
  setPrevEditOperationType(type) {
    this._prevEditOperationType = type;
  }
  // ------ auxiliary handling logic
  _pushAutoClosedAction(autoClosedCharactersRanges, autoClosedEnclosingRanges) {
    const autoClosedCharactersDeltaDecorations = [];
    const autoClosedEnclosingDeltaDecorations = [];
    for (let i = 0, len = autoClosedCharactersRanges.length; i < len; i++) {
      autoClosedCharactersDeltaDecorations.push({
        range: autoClosedCharactersRanges[i],
        options: {
          description: "auto-closed-character",
          inlineClassName: "auto-closed-character",
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });
      autoClosedEnclosingDeltaDecorations.push({
        range: autoClosedEnclosingRanges[i],
        options: {
          description: "auto-closed-enclosing",
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });
    }
    const autoClosedCharactersDecorations = this._model.deltaDecorations([], autoClosedCharactersDeltaDecorations);
    const autoClosedEnclosingDecorations = this._model.deltaDecorations([], autoClosedEnclosingDeltaDecorations);
    this._autoClosedActions.push(new AutoClosedAction(this._model, autoClosedCharactersDecorations, autoClosedEnclosingDecorations));
  }
  _executeEditOperation(opResult) {
    if (!opResult) {
      return;
    }
    if (opResult.shouldPushStackElementBefore) {
      this._model.pushStackElement();
    }
    const result = CommandExecutor.executeCommands(this._model, this._cursors.getSelections(), opResult.commands);
    if (result) {
      this._interpretCommandResult(result);
      const autoClosedCharactersRanges = [];
      const autoClosedEnclosingRanges = [];
      for (let i = 0; i < opResult.commands.length; i++) {
        const command = opResult.commands[i];
        if (command instanceof BaseTypeWithAutoClosingCommand && command.enclosingRange && command.closeCharacterRange) {
          autoClosedCharactersRanges.push(command.closeCharacterRange);
          autoClosedEnclosingRanges.push(command.enclosingRange);
        }
      }
      if (autoClosedCharactersRanges.length > 0) {
        this._pushAutoClosedAction(autoClosedCharactersRanges, autoClosedEnclosingRanges);
      }
      this._prevEditOperationType = opResult.type;
    }
    if (opResult.shouldPushStackElementAfter) {
      this._model.pushStackElement();
    }
  }
  _interpretCommandResult(cursorState) {
    if (!cursorState || cursorState.length === 0) {
      cursorState = this._cursors.readSelectionFromMarkers();
    }
    this._columnSelectData = null;
    this._cursors.setSelections(cursorState);
    this._cursors.normalize();
  }
  // -----------------------------------------------------------------------------------------------------------
  // ----- emitting events
  _emitStateChangedIfNecessary(eventsCollector, source, reason, oldState, reachedMaxCursorCount) {
    const newState = CursorModelState.from(this._model, this);
    if (newState.equals(oldState)) {
      return false;
    }
    const selections = this._cursors.getSelections();
    const viewSelections = this._cursors.getViewSelections();
    eventsCollector.emitViewEvent(new ViewCursorStateChangedEvent(viewSelections, selections, reason));
    if (!oldState || oldState.cursorState.length !== newState.cursorState.length || newState.cursorState.some((newCursorState, i) => !newCursorState.modelState.equals(oldState.cursorState[i].modelState))) {
      const oldSelections = oldState ? oldState.cursorState.map((s) => s.modelState.selection) : null;
      const oldModelVersionId = oldState ? oldState.modelVersionId : 0;
      eventsCollector.emitOutgoingEvent(new CursorStateChangedEvent(oldSelections, selections, oldModelVersionId, newState.modelVersionId, source || "keyboard", reason, reachedMaxCursorCount));
    }
    return true;
  }
  // -----------------------------------------------------------------------------------------------------------
  // ----- handlers beyond this point
  _findAutoClosingPairs(edits) {
    if (!edits.length) {
      return null;
    }
    const indices = [];
    for (let i = 0, len = edits.length; i < len; i++) {
      const edit = edits[i];
      if (!edit.text || edit.text.indexOf("\n") >= 0) {
        return null;
      }
      const m = edit.text.match(/([)\]}>'"`])([^)\]}>'"`]*)$/);
      if (!m) {
        return null;
      }
      const closeChar = m[1];
      const autoClosingPairsCandidates = this.context.cursorConfig.autoClosingPairs.autoClosingPairsCloseSingleChar.get(closeChar);
      if (!autoClosingPairsCandidates || autoClosingPairsCandidates.length !== 1) {
        return null;
      }
      const openChar = autoClosingPairsCandidates[0].open;
      const closeCharIndex = edit.text.length - m[2].length - 1;
      const openCharIndex = edit.text.lastIndexOf(openChar, closeCharIndex - 1);
      if (openCharIndex === -1) {
        return null;
      }
      indices.push([openCharIndex, closeCharIndex]);
    }
    return indices;
  }
  executeEdits(eventsCollector, source, edits, cursorStateComputer) {
    let autoClosingIndices = null;
    if (source === "snippet") {
      autoClosingIndices = this._findAutoClosingPairs(edits);
    }
    if (autoClosingIndices) {
      edits[0]._isTracked = true;
    }
    const autoClosedCharactersRanges = [];
    const autoClosedEnclosingRanges = [];
    const selections = this._model.pushEditOperations(this.getSelections(), edits, (undoEdits) => {
      if (autoClosingIndices) {
        for (let i = 0, len = autoClosingIndices.length; i < len; i++) {
          const [openCharInnerIndex, closeCharInnerIndex] = autoClosingIndices[i];
          const undoEdit = undoEdits[i];
          const lineNumber = undoEdit.range.startLineNumber;
          const openCharIndex = undoEdit.range.startColumn - 1 + openCharInnerIndex;
          const closeCharIndex = undoEdit.range.startColumn - 1 + closeCharInnerIndex;
          autoClosedCharactersRanges.push(new Range(lineNumber, closeCharIndex + 1, lineNumber, closeCharIndex + 2));
          autoClosedEnclosingRanges.push(new Range(lineNumber, openCharIndex + 1, lineNumber, closeCharIndex + 2));
        }
      }
      const selections2 = cursorStateComputer(undoEdits);
      if (selections2) {
        this._isHandling = true;
      }
      return selections2;
    });
    if (selections) {
      this._isHandling = false;
      this.setSelections(eventsCollector, source, selections, CursorChangeReason.NotSet);
    }
    if (autoClosedCharactersRanges.length > 0) {
      this._pushAutoClosedAction(autoClosedCharactersRanges, autoClosedEnclosingRanges);
    }
  }
  _executeEdit(callback, eventsCollector, source, cursorChangeReason = CursorChangeReason.NotSet) {
    if (this.context.cursorConfig.readOnly) {
      return;
    }
    const oldState = CursorModelState.from(this._model, this);
    this._cursors.stopTrackingSelections();
    this._isHandling = true;
    try {
      this._cursors.ensureValidState();
      callback();
    } catch (err) {
      onUnexpectedError(err);
    }
    this._isHandling = false;
    this._cursors.startTrackingSelections();
    this._validateAutoClosedActions();
    if (this._emitStateChangedIfNecessary(eventsCollector, source, cursorChangeReason, oldState, false)) {
      this.revealAll(eventsCollector, source, false, VerticalRevealType.Simple, true, editorCommon.ScrollType.Smooth);
    }
  }
  getAutoClosedCharacters() {
    return AutoClosedAction.getAllAutoClosedCharacters(this._autoClosedActions);
  }
  startComposition(eventsCollector) {
    this._compositionState = new CompositionState(this._model, this.getSelections());
  }
  endComposition(eventsCollector, source) {
    const compositionOutcome = this._compositionState ? this._compositionState.deduceOutcome(this._model, this.getSelections()) : null;
    this._compositionState = null;
    this._executeEdit(() => {
      if (source === "keyboard") {
        this._executeEditOperation(TypeOperations.compositionEndWithInterceptors(this._prevEditOperationType, this.context.cursorConfig, this._model, compositionOutcome, this.getSelections(), this.getAutoClosedCharacters()));
      }
    }, eventsCollector, source);
  }
  type(eventsCollector, text, source) {
    this._executeEdit(() => {
      if (source === "keyboard") {
        const len = text.length;
        let offset = 0;
        while (offset < len) {
          const charLength = strings.nextCharLength(text, offset);
          const chr = text.substr(offset, charLength);
          this._executeEditOperation(TypeOperations.typeWithInterceptors(!!this._compositionState, this._prevEditOperationType, this.context.cursorConfig, this._model, this.getSelections(), this.getAutoClosedCharacters(), chr));
          offset += charLength;
        }
      } else {
        this._executeEditOperation(TypeOperations.typeWithoutInterceptors(this._prevEditOperationType, this.context.cursorConfig, this._model, this.getSelections(), text));
      }
    }, eventsCollector, source);
  }
  compositionType(eventsCollector, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source) {
    if (text.length === 0 && replacePrevCharCnt === 0 && replaceNextCharCnt === 0) {
      if (positionDelta !== 0) {
        const newSelections = this.getSelections().map((selection) => {
          const position = selection.getPosition();
          return new Selection(position.lineNumber, position.column + positionDelta, position.lineNumber, position.column + positionDelta);
        });
        this.setSelections(eventsCollector, source, newSelections, CursorChangeReason.NotSet);
      }
      return;
    }
    this._executeEdit(() => {
      this._executeEditOperation(TypeOperations.compositionType(this._prevEditOperationType, this.context.cursorConfig, this._model, this.getSelections(), text, replacePrevCharCnt, replaceNextCharCnt, positionDelta));
    }, eventsCollector, source);
  }
  paste(eventsCollector, text, pasteOnNewLine, multicursorText, source) {
    this._executeEdit(() => {
      this._executeEditOperation(TypeOperations.paste(this.context.cursorConfig, this._model, this.getSelections(), text, pasteOnNewLine, multicursorText || []));
    }, eventsCollector, source, CursorChangeReason.Paste);
  }
  cut(eventsCollector, source) {
    this._executeEdit(() => {
      this._executeEditOperation(DeleteOperations.cut(this.context.cursorConfig, this._model, this.getSelections()));
    }, eventsCollector, source);
  }
  executeCommand(eventsCollector, command, source) {
    this._executeEdit(() => {
      this._cursors.killSecondaryCursors();
      this._executeEditOperation(new EditOperationResult(EditOperationType.Other, [command], {
        shouldPushStackElementBefore: false,
        shouldPushStackElementAfter: false
      }));
    }, eventsCollector, source);
  }
  executeCommands(eventsCollector, commands, source) {
    this._executeEdit(() => {
      this._executeEditOperation(new EditOperationResult(EditOperationType.Other, commands, {
        shouldPushStackElementBefore: false,
        shouldPushStackElementAfter: false
      }));
    }, eventsCollector, source);
  }
}
class CursorModelState {
  constructor(modelVersionId, cursorState) {
    this.modelVersionId = modelVersionId;
    this.cursorState = cursorState;
  }
  static from(model, cursor) {
    return new CursorModelState(model.getVersionId(), cursor.getCursorStates());
  }
  equals(other) {
    if (!other) {
      return false;
    }
    if (this.modelVersionId !== other.modelVersionId) {
      return false;
    }
    if (this.cursorState.length !== other.cursorState.length) {
      return false;
    }
    for (let i = 0, len = this.cursorState.length; i < len; i++) {
      if (!this.cursorState[i].equals(other.cursorState[i])) {
        return false;
      }
    }
    return true;
  }
}
class AutoClosedAction {
  static getAllAutoClosedCharacters(autoClosedActions) {
    let autoClosedCharacters = [];
    for (const autoClosedAction of autoClosedActions) {
      autoClosedCharacters = autoClosedCharacters.concat(autoClosedAction.getAutoClosedCharactersRanges());
    }
    return autoClosedCharacters;
  }
  constructor(model, autoClosedCharactersDecorations, autoClosedEnclosingDecorations) {
    this._model = model;
    this._autoClosedCharactersDecorations = autoClosedCharactersDecorations;
    this._autoClosedEnclosingDecorations = autoClosedEnclosingDecorations;
  }
  dispose() {
    this._autoClosedCharactersDecorations = this._model.deltaDecorations(this._autoClosedCharactersDecorations, []);
    this._autoClosedEnclosingDecorations = this._model.deltaDecorations(this._autoClosedEnclosingDecorations, []);
  }
  getAutoClosedCharactersRanges() {
    const result = [];
    for (let i = 0; i < this._autoClosedCharactersDecorations.length; i++) {
      const decorationRange = this._model.getDecorationRange(this._autoClosedCharactersDecorations[i]);
      if (decorationRange) {
        result.push(decorationRange);
      }
    }
    return result;
  }
  isValid(selections) {
    const enclosingRanges = [];
    for (let i = 0; i < this._autoClosedEnclosingDecorations.length; i++) {
      const decorationRange = this._model.getDecorationRange(this._autoClosedEnclosingDecorations[i]);
      if (decorationRange) {
        enclosingRanges.push(decorationRange);
        if (decorationRange.startLineNumber !== decorationRange.endLineNumber) {
          return false;
        }
      }
    }
    enclosingRanges.sort(Range.compareRangesUsingStarts);
    selections.sort(Range.compareRangesUsingStarts);
    for (let i = 0; i < selections.length; i++) {
      if (i >= enclosingRanges.length) {
        return false;
      }
      if (!enclosingRanges[i].strictContainsRange(selections[i])) {
        return false;
      }
    }
    return true;
  }
}
class CommandExecutor {
  static executeCommands(model, selectionsBefore, commands) {
    const ctx = {
      model,
      selectionsBefore,
      trackedRanges: [],
      trackedRangesDirection: []
    };
    const result = this._innerExecuteCommands(ctx, commands);
    for (let i = 0, len = ctx.trackedRanges.length; i < len; i++) {
      ctx.model._setTrackedRange(ctx.trackedRanges[i], null, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges);
    }
    return result;
  }
  static _innerExecuteCommands(ctx, commands) {
    if (this._arrayIsEmpty(commands)) {
      return null;
    }
    const commandsData = this._getEditOperations(ctx, commands);
    if (commandsData.operations.length === 0) {
      return null;
    }
    const rawOperations = commandsData.operations;
    const loserCursorsMap = this._getLoserCursorMap(rawOperations);
    if (loserCursorsMap.hasOwnProperty("0")) {
      console.warn("Ignoring commands");
      return null;
    }
    const filteredOperations = [];
    for (let i = 0, len = rawOperations.length; i < len; i++) {
      if (!loserCursorsMap.hasOwnProperty(rawOperations[i].identifier.major.toString())) {
        filteredOperations.push(rawOperations[i]);
      }
    }
    if (commandsData.hadTrackedEditOperation && filteredOperations.length > 0) {
      filteredOperations[0]._isTracked = true;
    }
    let selectionsAfter = ctx.model.pushEditOperations(ctx.selectionsBefore, filteredOperations, (inverseEditOperations) => {
      const groupedInverseEditOperations = [];
      for (let i = 0; i < ctx.selectionsBefore.length; i++) {
        groupedInverseEditOperations[i] = [];
      }
      for (const op of inverseEditOperations) {
        if (!op.identifier) {
          continue;
        }
        groupedInverseEditOperations[op.identifier.major].push(op);
      }
      const minorBasedSorter = (a, b) => {
        return a.identifier.minor - b.identifier.minor;
      };
      const cursorSelections = [];
      for (let i = 0; i < ctx.selectionsBefore.length; i++) {
        if (groupedInverseEditOperations[i].length > 0) {
          groupedInverseEditOperations[i].sort(minorBasedSorter);
          cursorSelections[i] = commands[i].computeCursorState(ctx.model, {
            getInverseEditOperations: () => {
              return groupedInverseEditOperations[i];
            },
            getTrackedSelection: (id) => {
              const idx = parseInt(id, 10);
              const range = ctx.model._getTrackedRange(ctx.trackedRanges[idx]);
              if (ctx.trackedRangesDirection[idx] === SelectionDirection.LTR) {
                return new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
              }
              return new Selection(range.endLineNumber, range.endColumn, range.startLineNumber, range.startColumn);
            }
          });
        } else {
          cursorSelections[i] = ctx.selectionsBefore[i];
        }
      }
      return cursorSelections;
    });
    if (!selectionsAfter) {
      selectionsAfter = ctx.selectionsBefore;
    }
    const losingCursors = [];
    for (const losingCursorIndex in loserCursorsMap) {
      if (loserCursorsMap.hasOwnProperty(losingCursorIndex)) {
        losingCursors.push(parseInt(losingCursorIndex, 10));
      }
    }
    losingCursors.sort((a, b) => {
      return b - a;
    });
    for (const losingCursor of losingCursors) {
      selectionsAfter.splice(losingCursor, 1);
    }
    return selectionsAfter;
  }
  static _arrayIsEmpty(commands) {
    for (let i = 0, len = commands.length; i < len; i++) {
      if (commands[i]) {
        return false;
      }
    }
    return true;
  }
  static _getEditOperations(ctx, commands) {
    let operations = [];
    let hadTrackedEditOperation = false;
    for (let i = 0, len = commands.length; i < len; i++) {
      const command = commands[i];
      if (command) {
        const r = this._getEditOperationsFromCommand(ctx, i, command);
        operations = operations.concat(r.operations);
        hadTrackedEditOperation = hadTrackedEditOperation || r.hadTrackedEditOperation;
      }
    }
    return {
      operations,
      hadTrackedEditOperation
    };
  }
  static _getEditOperationsFromCommand(ctx, majorIdentifier, command) {
    const operations = [];
    let operationMinor = 0;
    const addEditOperation = (range, text, forceMoveMarkers = false) => {
      if (Range.isEmpty(range) && text === "") {
        return;
      }
      operations.push({
        identifier: {
          major: majorIdentifier,
          minor: operationMinor++
        },
        range,
        text,
        forceMoveMarkers,
        isAutoWhitespaceEdit: command.insertsAutoWhitespace
      });
    };
    let hadTrackedEditOperation = false;
    const addTrackedEditOperation = (selection, text, forceMoveMarkers) => {
      hadTrackedEditOperation = true;
      addEditOperation(selection, text, forceMoveMarkers);
    };
    const trackSelection = (_selection, trackPreviousOnEmpty) => {
      const selection = Selection.liftSelection(_selection);
      let stickiness;
      if (selection.isEmpty()) {
        if (typeof trackPreviousOnEmpty === "boolean") {
          if (trackPreviousOnEmpty) {
            stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
          } else {
            stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingAfter;
          }
        } else {
          const maxLineColumn = ctx.model.getLineMaxColumn(selection.startLineNumber);
          if (selection.startColumn === maxLineColumn) {
            stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
          } else {
            stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingAfter;
          }
        }
      } else {
        stickiness = TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
      }
      const l = ctx.trackedRanges.length;
      const id = ctx.model._setTrackedRange(null, selection, stickiness);
      ctx.trackedRanges[l] = id;
      ctx.trackedRangesDirection[l] = selection.getDirection();
      return l.toString();
    };
    const editOperationBuilder = {
      addEditOperation,
      addTrackedEditOperation,
      trackSelection
    };
    try {
      command.getEditOperations(ctx.model, editOperationBuilder);
    } catch (e) {
      onUnexpectedError(e);
      return {
        operations: [],
        hadTrackedEditOperation: false
      };
    }
    return {
      operations,
      hadTrackedEditOperation
    };
  }
  static _getLoserCursorMap(operations) {
    operations = operations.slice(0);
    operations.sort((a, b) => {
      return -Range.compareRangesUsingEnds(a.range, b.range);
    });
    const loserCursorsMap = {};
    for (let i = 1; i < operations.length; i++) {
      const previousOp = operations[i - 1];
      const currentOp = operations[i];
      if (Range.getStartPosition(previousOp.range).isBefore(Range.getEndPosition(currentOp.range))) {
        let loserMajor;
        if (previousOp.identifier.major > currentOp.identifier.major) {
          loserMajor = previousOp.identifier.major;
        } else {
          loserMajor = currentOp.identifier.major;
        }
        loserCursorsMap[loserMajor.toString()] = true;
        for (let j = 0; j < operations.length; j++) {
          if (operations[j].identifier.major === loserMajor) {
            operations.splice(j, 1);
            if (j < i) {
              i--;
            }
            j--;
          }
        }
        if (i > 0) {
          i--;
        }
      }
    }
    return loserCursorsMap;
  }
}
class CompositionLineState {
  constructor(text, lineNumber, startSelectionOffset, endSelectionOffset) {
    this.text = text;
    this.lineNumber = lineNumber;
    this.startSelectionOffset = startSelectionOffset;
    this.endSelectionOffset = endSelectionOffset;
  }
}
class CompositionState {
  static _capture(textModel, selections) {
    const result = [];
    for (const selection of selections) {
      if (selection.startLineNumber !== selection.endLineNumber) {
        return null;
      }
      const lineNumber = selection.startLineNumber;
      result.push(new CompositionLineState(
        textModel.getLineContent(lineNumber),
        lineNumber,
        selection.startColumn - 1,
        selection.endColumn - 1
      ));
    }
    return result;
  }
  constructor(textModel, selections) {
    this._original = CompositionState._capture(textModel, selections);
  }
  /**
   * Returns the inserted text during this composition.
   * If the composition resulted in existing text being changed (i.e. not a pure insertion) it returns null.
   */
  deduceOutcome(textModel, selections) {
    if (!this._original) {
      return null;
    }
    const current = CompositionState._capture(textModel, selections);
    if (!current) {
      return null;
    }
    if (this._original.length !== current.length) {
      return null;
    }
    const result = [];
    for (let i = 0, len = this._original.length; i < len; i++) {
      result.push(CompositionState._deduceOutcome(this._original[i], current[i]));
    }
    return result;
  }
  static _deduceOutcome(original, current) {
    const commonPrefix = Math.min(
      original.startSelectionOffset,
      current.startSelectionOffset,
      strings.commonPrefixLength(original.text, current.text)
    );
    const commonSuffix = Math.min(
      original.text.length - original.endSelectionOffset,
      current.text.length - current.endSelectionOffset,
      strings.commonSuffixLength(original.text, current.text)
    );
    const deletedText = original.text.substring(commonPrefix, original.text.length - commonSuffix);
    const insertedTextStartOffset = commonPrefix;
    const insertedTextEndOffset = current.text.length - commonSuffix;
    const insertedText = current.text.substring(insertedTextStartOffset, insertedTextEndOffset);
    const insertedTextRange = new Range(current.lineNumber, insertedTextStartOffset + 1, current.lineNumber, insertedTextEndOffset + 1);
    return new CompositionOutcome(
      deletedText,
      original.startSelectionOffset - commonPrefix,
      original.endSelectionOffset - commonPrefix,
      insertedText,
      current.startSelectionOffset - commonPrefix,
      current.endSelectionOffset - commonPrefix,
      insertedTextRange
    );
  }
}
export {
  CommandExecutor,
  CursorsController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2N1cnNvci9jdXJzb3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29sbGVjdGlvbiB9IGZyb20gJy4vY3Vyc29yQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDdXJzb3JDb25maWd1cmF0aW9uLCBDdXJzb3JTdGF0ZSwgRWRpdE9wZXJhdGlvblJlc3VsdCwgRWRpdE9wZXJhdGlvblR5cGUsIElDb2x1bW5TZWxlY3REYXRhLCBQYXJ0aWFsQ3Vyc29yU3RhdGUsIElDdXJzb3JTaW1wbGVNb2RlbCB9IGZyb20gJy4uL2N1cnNvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBDdXJzb3JDb250ZXh0IH0gZnJvbSAnLi9jdXJzb3JDb250ZXh0LmpzJztcbmltcG9ydCB7IERlbGV0ZU9wZXJhdGlvbnMgfSBmcm9tICcuL2N1cnNvckRlbGV0ZU9wZXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ2hhbmdlUmVhc29uIH0gZnJvbSAnLi4vY3Vyc29yRXZlbnRzLmpzJztcbmltcG9ydCB7IENvbXBvc2l0aW9uT3V0Y29tZSwgVHlwZU9wZXJhdGlvbnMgfSBmcm9tICcuL2N1cnNvclR5cGVPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IEJhc2VUeXBlV2l0aEF1dG9DbG9zaW5nQ29tbWFuZCB9IGZyb20gJy4vY3Vyc29yVHlwZUVkaXRPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSwgSVJhbmdlIH0gZnJvbSAnLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJU2VsZWN0aW9uLCBTZWxlY3Rpb24sIFNlbGVjdGlvbkRpcmVjdGlvbiB9IGZyb20gJy4uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCAqIGFzIGVkaXRvckNvbW1vbiBmcm9tICcuLi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcywgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJQ3Vyc29yU3RhdGVDb21wdXRlciwgSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uLCBJVmFsaWRFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vbW9kZWwuanMnO1xuaW1wb3J0IHsgUmF3Q29udGVudENoYW5nZWRUeXBlLCBNb2RlbEluamVjdGVkVGV4dENoYW5nZWRFdmVudCwgSW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudCB9IGZyb20gJy4uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBWZXJ0aWNhbFJldmVhbFR5cGUsIFZpZXdDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudCwgVmlld1JldmVhbFJhbmdlUmVxdWVzdEV2ZW50IH0gZnJvbSAnLi4vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBkaXNwb3NlLCBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDb29yZGluYXRlc0NvbnZlcnRlciB9IGZyb20gJy4uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudCwgVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yIH0gZnJvbSAnLi4vdmlld01vZGVsRXZlbnREaXNwYXRjaGVyLmpzJztcblxuZXhwb3J0IGNsYXNzIEN1cnNvcnNDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWw7XG5cdHByaXZhdGUgX2tub3duTW9kZWxWZXJzaW9uSWQ6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfdmlld01vZGVsOiBJQ3Vyc29yU2ltcGxlTW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2Nvb3JkaW5hdGVzQ29udmVydGVyOiBJQ29vcmRpbmF0ZXNDb252ZXJ0ZXI7XG5cdHB1YmxpYyBjb250ZXh0OiBDdXJzb3JDb250ZXh0O1xuXHRwcml2YXRlIF9jdXJzb3JzOiBDdXJzb3JDb2xsZWN0aW9uO1xuXG5cdHByaXZhdGUgX2hhc0ZvY3VzOiBib29sZWFuO1xuXHRwcml2YXRlIF9pc0hhbmRsaW5nOiBib29sZWFuO1xuXHRwcml2YXRlIF9jb21wb3NpdGlvblN0YXRlOiBDb21wb3NpdGlvblN0YXRlIHwgbnVsbDtcblx0cHJpdmF0ZSBfY29sdW1uU2VsZWN0RGF0YTogSUNvbHVtblNlbGVjdERhdGEgfCBudWxsO1xuXHRwcml2YXRlIF9hdXRvQ2xvc2VkQWN0aW9uczogQXV0b0Nsb3NlZEFjdGlvbltdO1xuXHRwcml2YXRlIF9wcmV2RWRpdE9wZXJhdGlvblR5cGU6IEVkaXRPcGVyYXRpb25UeXBlO1xuXG5cdGNvbnN0cnVjdG9yKG1vZGVsOiBJVGV4dE1vZGVsLCB2aWV3TW9kZWw6IElDdXJzb3JTaW1wbGVNb2RlbCwgY29vcmRpbmF0ZXNDb252ZXJ0ZXI6IElDb29yZGluYXRlc0NvbnZlcnRlciwgY3Vyc29yQ29uZmlnOiBDdXJzb3JDb25maWd1cmF0aW9uKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xuXHRcdHRoaXMuX2tub3duTW9kZWxWZXJzaW9uSWQgPSB0aGlzLl9tb2RlbC5nZXRWZXJzaW9uSWQoKTtcblx0XHR0aGlzLl92aWV3TW9kZWwgPSB2aWV3TW9kZWw7XG5cdFx0dGhpcy5fY29vcmRpbmF0ZXNDb252ZXJ0ZXIgPSBjb29yZGluYXRlc0NvbnZlcnRlcjtcblx0XHR0aGlzLmNvbnRleHQgPSBuZXcgQ3Vyc29yQ29udGV4dCh0aGlzLl9tb2RlbCwgdGhpcy5fdmlld01vZGVsLCB0aGlzLl9jb29yZGluYXRlc0NvbnZlcnRlciwgY3Vyc29yQ29uZmlnKTtcblx0XHR0aGlzLl9jdXJzb3JzID0gbmV3IEN1cnNvckNvbGxlY3Rpb24odGhpcy5jb250ZXh0KTtcblxuXHRcdHRoaXMuX2hhc0ZvY3VzID0gZmFsc2U7XG5cdFx0dGhpcy5faXNIYW5kbGluZyA9IGZhbHNlO1xuXHRcdHRoaXMuX2NvbXBvc2l0aW9uU3RhdGUgPSBudWxsO1xuXHRcdHRoaXMuX2NvbHVtblNlbGVjdERhdGEgPSBudWxsO1xuXHRcdHRoaXMuX2F1dG9DbG9zZWRBY3Rpb25zID0gW107XG5cdFx0dGhpcy5fcHJldkVkaXRPcGVyYXRpb25UeXBlID0gRWRpdE9wZXJhdGlvblR5cGUuT3RoZXI7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9jdXJzb3JzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9hdXRvQ2xvc2VkQWN0aW9ucyA9IGRpc3Bvc2UodGhpcy5fYXV0b0Nsb3NlZEFjdGlvbnMpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVDb25maWd1cmF0aW9uKGN1cnNvckNvbmZpZzogQ3Vyc29yQ29uZmlndXJhdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuY29udGV4dCA9IG5ldyBDdXJzb3JDb250ZXh0KHRoaXMuX21vZGVsLCB0aGlzLl92aWV3TW9kZWwsIHRoaXMuX2Nvb3JkaW5hdGVzQ29udmVydGVyLCBjdXJzb3JDb25maWcpO1xuXHRcdHRoaXMuX2N1cnNvcnMudXBkYXRlQ29udGV4dCh0aGlzLmNvbnRleHQpO1xuXHR9XG5cblx0cHVibGljIG9uTGluZU1hcHBpbmdDaGFuZ2VkKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2tub3duTW9kZWxWZXJzaW9uSWQgIT09IHRoaXMuX21vZGVsLmdldFZlcnNpb25JZCgpKSB7XG5cdFx0XHQvLyBUaGVyZSBhcmUgbW9kZWwgY2hhbmdlIGV2ZW50cyB0aGF0IEkgZGlkbid0IHlldCByZWNlaXZlLlxuXHRcdFx0Ly9cblx0XHRcdC8vIFRoaXMgY2FuIGhhcHBlbiB3aGVuIGVkaXRpbmcgdGhlIG1vZGVsLCBhbmQgdGhlIHZpZXcgbW9kZWwgcmVjZWl2ZXMgdGhlIGNoYW5nZSBldmVudHMgZmlyc3QsXG5cdFx0XHQvLyBhbmQgdGhlIHZpZXcgbW9kZWwgZW1pdHMgbGluZSBtYXBwaW5nIGNoYW5nZWQgZXZlbnRzLCBhbGwgYmVmb3JlIHRoZSBjdXJzb3IgZ2V0cyBhIGNoYW5jZSB0b1xuXHRcdFx0Ly8gcmVjb3ZlciBmcm9tIG1hcmtlcnMuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gVGhlIG1vZGVsIGNoYW5nZSBsaXN0ZW5lciBhYm92ZSB3aWxsIGJlIGNhbGxlZCBzb29uIGFuZCB3ZSdsbCBlbnN1cmUgYSB2YWxpZCBjdXJzb3Igc3RhdGUgdGhlcmUuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIEVuc3VyZSB2YWxpZCBzdGF0ZVxuXHRcdHRoaXMuc2V0U3RhdGVzKGV2ZW50c0NvbGxlY3RvciwgJ3ZpZXdNb2RlbCcsIEN1cnNvckNoYW5nZVJlYXNvbi5Ob3RTZXQsIHRoaXMuZ2V0Q3Vyc29yU3RhdGVzKCkpO1xuXHR9XG5cblx0cHVibGljIHNldEhhc0ZvY3VzKGhhc0ZvY3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5faGFzRm9jdXMgPSBoYXNGb2N1cztcblx0fVxuXG5cdHByaXZhdGUgX3ZhbGlkYXRlQXV0b0Nsb3NlZEFjdGlvbnMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2F1dG9DbG9zZWRBY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbnM6IFJhbmdlW10gPSB0aGlzLl9jdXJzb3JzLmdldFNlbGVjdGlvbnMoKTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fYXV0b0Nsb3NlZEFjdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgYXV0b0Nsb3NlZEFjdGlvbiA9IHRoaXMuX2F1dG9DbG9zZWRBY3Rpb25zW2ldO1xuXHRcdFx0XHRpZiAoIWF1dG9DbG9zZWRBY3Rpb24uaXNWYWxpZChzZWxlY3Rpb25zKSkge1xuXHRcdFx0XHRcdGF1dG9DbG9zZWRBY3Rpb24uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuX2F1dG9DbG9zZWRBY3Rpb25zLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRpLS07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyAtLS0tLS0gc29tZSBnZXR0ZXJzL3NldHRlcnNcblxuXHRwdWJsaWMgZ2V0UHJpbWFyeUN1cnNvclN0YXRlKCk6IEN1cnNvclN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5fY3Vyc29ycy5nZXRQcmltYXJ5Q3Vyc29yKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGFzdEFkZGVkQ3Vyc29ySW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fY3Vyc29ycy5nZXRMYXN0QWRkZWRDdXJzb3JJbmRleCgpO1xuXHR9XG5cblx0cHVibGljIGdldEN1cnNvclN0YXRlcygpOiBDdXJzb3JTdGF0ZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fY3Vyc29ycy5nZXRBbGwoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRTdGF0ZXMoZXZlbnRzQ29sbGVjdG9yOiBWaWV3TW9kZWxFdmVudHNDb2xsZWN0b3IsIHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgcmVhc29uOiBDdXJzb3JDaGFuZ2VSZWFzb24sIHN0YXRlczogUGFydGlhbEN1cnNvclN0YXRlW10gfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0bGV0IHJlYWNoZWRNYXhDdXJzb3JDb3VudCA9IGZhbHNlO1xuXHRcdGNvbnN0IG11bHRpQ3Vyc29yTGltaXQgPSB0aGlzLmNvbnRleHQuY3Vyc29yQ29uZmlnLm11bHRpQ3Vyc29yTGltaXQ7XG5cdFx0aWYgKHN0YXRlcyAhPT0gbnVsbCAmJiBzdGF0ZXMubGVuZ3RoID4gbXVsdGlDdXJzb3JMaW1pdCkge1xuXHRcdFx0c3RhdGVzID0gc3RhdGVzLnNsaWNlKDAsIG11bHRpQ3Vyc29yTGltaXQpO1xuXHRcdFx0cmVhY2hlZE1heEN1cnNvckNvdW50ID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBvbGRTdGF0ZSA9IEN1cnNvck1vZGVsU3RhdGUuZnJvbSh0aGlzLl9tb2RlbCwgdGhpcyk7XG5cblx0XHR0aGlzLl9jdXJzb3JzLnNldFN0YXRlcyhzdGF0ZXMpO1xuXHRcdHRoaXMuX2N1cnNvcnMubm9ybWFsaXplKCk7XG5cdFx0dGhpcy5fY29sdW1uU2VsZWN0RGF0YSA9IG51bGw7XG5cblx0XHR0aGlzLl92YWxpZGF0ZUF1dG9DbG9zZWRBY3Rpb25zKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5fZW1pdFN0YXRlQ2hhbmdlZElmTmVjZXNzYXJ5KGV2ZW50c0NvbGxlY3Rvciwgc291cmNlLCByZWFzb24sIG9sZFN0YXRlLCByZWFjaGVkTWF4Q3Vyc29yQ291bnQpO1xuXHR9XG5cblx0cHVibGljIHNldEN1cnNvckNvbHVtblNlbGVjdERhdGEoY29sdW1uU2VsZWN0RGF0YTogSUNvbHVtblNlbGVjdERhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl9jb2x1bW5TZWxlY3REYXRhID0gY29sdW1uU2VsZWN0RGF0YTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxBbGwoZXZlbnRzQ29sbGVjdG9yOiBWaWV3TW9kZWxFdmVudHNDb2xsZWN0b3IsIHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgbWluaW1hbFJldmVhbDogYm9vbGVhbiwgdmVydGljYWxUeXBlOiBWZXJ0aWNhbFJldmVhbFR5cGUsIHJldmVhbEhvcml6b250YWw6IGJvb2xlYW4sIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld1Bvc2l0aW9ucyA9IHRoaXMuX2N1cnNvcnMuZ2V0Vmlld1Bvc2l0aW9ucygpO1xuXG5cdFx0bGV0IHJldmVhbFZpZXdSYW5nZTogUmFuZ2UgfCBudWxsID0gbnVsbDtcblx0XHRsZXQgcmV2ZWFsVmlld1NlbGVjdGlvbnM6IFNlbGVjdGlvbltdIHwgbnVsbCA9IG51bGw7XG5cdFx0aWYgKHZpZXdQb3NpdGlvbnMubGVuZ3RoID4gMSkge1xuXHRcdFx0cmV2ZWFsVmlld1NlbGVjdGlvbnMgPSB0aGlzLl9jdXJzb3JzLmdldFZpZXdTZWxlY3Rpb25zKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldmVhbFZpZXdSYW5nZSA9IFJhbmdlLmZyb21Qb3NpdGlvbnModmlld1Bvc2l0aW9uc1swXSwgdmlld1Bvc2l0aW9uc1swXSk7XG5cdFx0fVxuXG5cdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IFZpZXdSZXZlYWxSYW5nZVJlcXVlc3RFdmVudChzb3VyY2UsIG1pbmltYWxSZXZlYWwsIHJldmVhbFZpZXdSYW5nZSwgcmV2ZWFsVmlld1NlbGVjdGlvbnMsIHZlcnRpY2FsVHlwZSwgcmV2ZWFsSG9yaXpvbnRhbCwgc2Nyb2xsVHlwZSkpO1xuXHR9XG5cblx0cHVibGljIHJldmVhbFByaW1hcnkoZXZlbnRzQ29sbGVjdG9yOiBWaWV3TW9kZWxFdmVudHNDb2xsZWN0b3IsIHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgbWluaW1hbFJldmVhbDogYm9vbGVhbiwgdmVydGljYWxUeXBlOiBWZXJ0aWNhbFJldmVhbFR5cGUsIHJldmVhbEhvcml6b250YWw6IGJvb2xlYW4sIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJpbWFyeUN1cnNvciA9IHRoaXMuX2N1cnNvcnMuZ2V0UHJpbWFyeUN1cnNvcigpO1xuXHRcdGNvbnN0IHJldmVhbFZpZXdTZWxlY3Rpb25zID0gW3ByaW1hcnlDdXJzb3Iudmlld1N0YXRlLnNlbGVjdGlvbl07XG5cdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IFZpZXdSZXZlYWxSYW5nZVJlcXVlc3RFdmVudChzb3VyY2UsIG1pbmltYWxSZXZlYWwsIG51bGwsIHJldmVhbFZpZXdTZWxlY3Rpb25zLCB2ZXJ0aWNhbFR5cGUsIHJldmVhbEhvcml6b250YWwsIHNjcm9sbFR5cGUpKTtcblx0fVxuXG5cdHB1YmxpYyBzYXZlU3RhdGUoKTogZWRpdG9yQ29tbW9uLklDdXJzb3JTdGF0ZVtdIHtcblxuXHRcdGNvbnN0IHJlc3VsdDogZWRpdG9yQ29tbW9uLklDdXJzb3JTdGF0ZVtdID0gW107XG5cblx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5fY3Vyc29ycy5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHNlbGVjdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHNlbGVjdGlvbnNbaV07XG5cblx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0aW5TZWxlY3Rpb25Nb2RlOiAhc2VsZWN0aW9uLmlzRW1wdHkoKSxcblx0XHRcdFx0c2VsZWN0aW9uU3RhcnQ6IHtcblx0XHRcdFx0XHRsaW5lTnVtYmVyOiBzZWxlY3Rpb24uc2VsZWN0aW9uU3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdGNvbHVtbjogc2VsZWN0aW9uLnNlbGVjdGlvblN0YXJ0Q29sdW1uLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRwb3NpdGlvbjoge1xuXHRcdFx0XHRcdGxpbmVOdW1iZXI6IHNlbGVjdGlvbi5wb3NpdGlvbkxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0Y29sdW1uOiBzZWxlY3Rpb24ucG9zaXRpb25Db2x1bW4sXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgcmVzdG9yZVN0YXRlKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yLCBzdGF0ZXM6IGVkaXRvckNvbW1vbi5JQ3Vyc29yU3RhdGVbXSk6IHZvaWQge1xuXG5cdFx0Y29uc3QgZGVzaXJlZFNlbGVjdGlvbnM6IElTZWxlY3Rpb25bXSA9IFtdO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHN0YXRlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgc3RhdGUgPSBzdGF0ZXNbaV07XG5cblx0XHRcdGxldCBwb3NpdGlvbkxpbmVOdW1iZXIgPSAxO1xuXHRcdFx0bGV0IHBvc2l0aW9uQ29sdW1uID0gMTtcblxuXHRcdFx0Ly8gQXZvaWQgbWlzc2luZyBwcm9wZXJ0aWVzIG9uIHRoZSBsaXRlcmFsXG5cdFx0XHRpZiAoc3RhdGUucG9zaXRpb24gJiYgc3RhdGUucG9zaXRpb24ubGluZU51bWJlcikge1xuXHRcdFx0XHRwb3NpdGlvbkxpbmVOdW1iZXIgPSBzdGF0ZS5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHN0YXRlLnBvc2l0aW9uICYmIHN0YXRlLnBvc2l0aW9uLmNvbHVtbikge1xuXHRcdFx0XHRwb3NpdGlvbkNvbHVtbiA9IHN0YXRlLnBvc2l0aW9uLmNvbHVtbjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IHNlbGVjdGlvblN0YXJ0TGluZU51bWJlciA9IHBvc2l0aW9uTGluZU51bWJlcjtcblx0XHRcdGxldCBzZWxlY3Rpb25TdGFydENvbHVtbiA9IHBvc2l0aW9uQ29sdW1uO1xuXG5cdFx0XHQvLyBBdm9pZCBtaXNzaW5nIHByb3BlcnRpZXMgb24gdGhlIGxpdGVyYWxcblx0XHRcdGlmIChzdGF0ZS5zZWxlY3Rpb25TdGFydCAmJiBzdGF0ZS5zZWxlY3Rpb25TdGFydC5saW5lTnVtYmVyKSB7XG5cdFx0XHRcdHNlbGVjdGlvblN0YXJ0TGluZU51bWJlciA9IHN0YXRlLnNlbGVjdGlvblN0YXJ0LmxpbmVOdW1iZXI7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc3RhdGUuc2VsZWN0aW9uU3RhcnQgJiYgc3RhdGUuc2VsZWN0aW9uU3RhcnQuY29sdW1uKSB7XG5cdFx0XHRcdHNlbGVjdGlvblN0YXJ0Q29sdW1uID0gc3RhdGUuc2VsZWN0aW9uU3RhcnQuY29sdW1uO1xuXHRcdFx0fVxuXG5cdFx0XHRkZXNpcmVkU2VsZWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0c2VsZWN0aW9uU3RhcnRMaW5lTnVtYmVyOiBzZWxlY3Rpb25TdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdHNlbGVjdGlvblN0YXJ0Q29sdW1uOiBzZWxlY3Rpb25TdGFydENvbHVtbixcblx0XHRcdFx0cG9zaXRpb25MaW5lTnVtYmVyOiBwb3NpdGlvbkxpbmVOdW1iZXIsXG5cdFx0XHRcdHBvc2l0aW9uQ29sdW1uOiBwb3NpdGlvbkNvbHVtblxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRTdGF0ZXMoZXZlbnRzQ29sbGVjdG9yLCAncmVzdG9yZVN0YXRlJywgQ3Vyc29yQ2hhbmdlUmVhc29uLk5vdFNldCwgQ3Vyc29yU3RhdGUuZnJvbU1vZGVsU2VsZWN0aW9ucyhkZXNpcmVkU2VsZWN0aW9ucykpO1xuXHRcdHRoaXMucmV2ZWFsQWxsKGV2ZW50c0NvbGxlY3RvciwgJ3Jlc3RvcmVTdGF0ZScsIGZhbHNlLCBWZXJ0aWNhbFJldmVhbFR5cGUuU2ltcGxlLCB0cnVlLCBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHR9XG5cblx0cHVibGljIG9uTW9kZWxDb250ZW50Q2hhbmdlZChldmVudHNDb2xsZWN0b3I6IFZpZXdNb2RlbEV2ZW50c0NvbGxlY3RvciwgZXZlbnQ6IEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQgfCBNb2RlbEluamVjdGVkVGV4dENoYW5nZWRFdmVudCk6IHZvaWQge1xuXHRcdGlmIChldmVudCBpbnN0YW5jZW9mIE1vZGVsSW5qZWN0ZWRUZXh0Q2hhbmdlZEV2ZW50KSB7XG5cdFx0XHQvLyBJZiBpbmplY3RlZCB0ZXh0cyBjaGFuZ2UsIHRoZSB2aWV3IHBvc2l0aW9ucyBvZiBhbGwgY3Vyc29ycyBuZWVkIHRvIGJlIHVwZGF0ZWQuXG5cdFx0XHRpZiAodGhpcy5faXNIYW5kbGluZykge1xuXHRcdFx0XHQvLyBUaGUgdmlldyBwb3NpdGlvbnMgd2lsbCBiZSB1cGRhdGVkIHdoZW4gaGFuZGxpbmcgZmluaXNoZXNcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gc2V0U3RhdGVzIG1pZ2h0IHJlbW92ZSBtYXJrZXJzLCB3aGljaCBjb3VsZCB0cmlnZ2VyIGEgZGVjb3JhdGlvbiBjaGFuZ2UuXG5cdFx0XHQvLyBJZiB0aGVyZSBhcmUgaW5qZWN0ZWQgdGV4dCBkZWNvcmF0aW9ucyBmb3IgdGhhdCBsaW5lLCBgb25Nb2RlbENvbnRlbnRDaGFuZ2VkYCBpcyBlbWl0dGVkIGFnYWluXG5cdFx0XHQvLyBhbmQgYW4gZW5kbGVzcyByZWN1cnNpb24gaGFwcGVucy5cblx0XHRcdC8vIF9pc0hhbmRsaW5nIHByZXZlbnRzIHRoYXQuXG5cdFx0XHR0aGlzLl9pc0hhbmRsaW5nID0gdHJ1ZTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdGVzKGV2ZW50c0NvbGxlY3RvciwgJ21vZGVsQ2hhbmdlJywgQ3Vyc29yQ2hhbmdlUmVhc29uLk5vdFNldCwgdGhpcy5nZXRDdXJzb3JTdGF0ZXMoKSk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9pc0hhbmRsaW5nID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGUgPSBldmVudC5yYXdDb250ZW50Q2hhbmdlZEV2ZW50O1xuXHRcdFx0dGhpcy5fa25vd25Nb2RlbFZlcnNpb25JZCA9IGUudmVyc2lvbklkO1xuXHRcdFx0aWYgKHRoaXMuX2lzSGFuZGxpbmcpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoYWRGbHVzaEV2ZW50ID0gZS5jb250YWluc0V2ZW50KFJhd0NvbnRlbnRDaGFuZ2VkVHlwZS5GbHVzaCk7XG5cdFx0XHR0aGlzLl9wcmV2RWRpdE9wZXJhdGlvblR5cGUgPSBFZGl0T3BlcmF0aW9uVHlwZS5PdGhlcjtcblxuXHRcdFx0aWYgKGhhZEZsdXNoRXZlbnQpIHtcblx0XHRcdFx0Ly8gYSBtb2RlbC5zZXRWYWx1ZSgpIHdhcyBjYWxsZWRcblx0XHRcdFx0dGhpcy5fY3Vyc29ycy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2N1cnNvcnMgPSBuZXcgQ3Vyc29yQ29sbGVjdGlvbih0aGlzLmNvbnRleHQpO1xuXHRcdFx0XHR0aGlzLl92YWxpZGF0ZUF1dG9DbG9zZWRBY3Rpb25zKCk7XG5cdFx0XHRcdHRoaXMuX2VtaXRTdGF0ZUNoYW5nZWRJZk5lY2Vzc2FyeShldmVudHNDb2xsZWN0b3IsICdtb2RlbCcsIEN1cnNvckNoYW5nZVJlYXNvbi5Db250ZW50Rmx1c2gsIG51bGwsIGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLl9oYXNGb2N1cyAmJiBlLnJlc3VsdGluZ1NlbGVjdGlvbiAmJiBlLnJlc3VsdGluZ1NlbGVjdGlvbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0Y29uc3QgY3Vyc29yU3RhdGUgPSBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTZWxlY3Rpb25zKGUucmVzdWx0aW5nU2VsZWN0aW9uKTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXRTdGF0ZXMoZXZlbnRzQ29sbGVjdG9yLCAnbW9kZWxDaGFuZ2UnLCBlLmlzVW5kb2luZyA/IEN1cnNvckNoYW5nZVJlYXNvbi5VbmRvIDogZS5pc1JlZG9pbmcgPyBDdXJzb3JDaGFuZ2VSZWFzb24uUmVkbyA6IEN1cnNvckNoYW5nZVJlYXNvbi5SZWNvdmVyRnJvbU1hcmtlcnMsIGN1cnNvclN0YXRlKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5yZXZlYWxBbGwoZXZlbnRzQ29sbGVjdG9yLCAnbW9kZWxDaGFuZ2UnLCBmYWxzZSwgVmVydGljYWxSZXZlYWxUeXBlLlNpbXBsZSwgdHJ1ZSwgZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uc0Zyb21NYXJrZXJzID0gdGhpcy5fY3Vyc29ycy5yZWFkU2VsZWN0aW9uRnJvbU1hcmtlcnMoKTtcblx0XHRcdFx0XHR0aGlzLnNldFN0YXRlcyhldmVudHNDb2xsZWN0b3IsICdtb2RlbENoYW5nZScsIEN1cnNvckNoYW5nZVJlYXNvbi5SZWNvdmVyRnJvbU1hcmtlcnMsIEN1cnNvclN0YXRlLmZyb21Nb2RlbFNlbGVjdGlvbnMoc2VsZWN0aW9uc0Zyb21NYXJrZXJzKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2VsZWN0aW9uKCk6IFNlbGVjdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnNvcnMuZ2V0UHJpbWFyeUN1cnNvcigpLm1vZGVsU3RhdGUuc2VsZWN0aW9uO1xuXHR9XG5cblx0cHVibGljIGdldFRvcE1vc3RWaWV3UG9zaXRpb24oKTogUG9zaXRpb24ge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3JzLmdldFRvcE1vc3RWaWV3UG9zaXRpb24oKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRCb3R0b21Nb3N0Vmlld1Bvc2l0aW9uKCk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fY3Vyc29ycy5nZXRCb3R0b21Nb3N0Vmlld1Bvc2l0aW9uKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q3Vyc29yQ29sdW1uU2VsZWN0RGF0YSgpOiBJQ29sdW1uU2VsZWN0RGF0YSB7XG5cdFx0aWYgKHRoaXMuX2NvbHVtblNlbGVjdERhdGEpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jb2x1bW5TZWxlY3REYXRhO1xuXHRcdH1cblx0XHRjb25zdCBwcmltYXJ5Q3Vyc29yID0gdGhpcy5fY3Vyc29ycy5nZXRQcmltYXJ5Q3Vyc29yKCk7XG5cdFx0Y29uc3Qgdmlld1NlbGVjdGlvblN0YXJ0ID0gcHJpbWFyeUN1cnNvci52aWV3U3RhdGUuc2VsZWN0aW9uU3RhcnQuZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdGNvbnN0IHZpZXdQb3NpdGlvbiA9IHByaW1hcnlDdXJzb3Iudmlld1N0YXRlLnBvc2l0aW9uO1xuXHRcdHJldHVybiB7XG5cdFx0XHRpc1JlYWw6IGZhbHNlLFxuXHRcdFx0ZnJvbVZpZXdMaW5lTnVtYmVyOiB2aWV3U2VsZWN0aW9uU3RhcnQubGluZU51bWJlcixcblx0XHRcdGZyb21WaWV3VmlzdWFsQ29sdW1uOiB0aGlzLmNvbnRleHQuY3Vyc29yQ29uZmlnLnZpc2libGVDb2x1bW5Gcm9tQ29sdW1uKHRoaXMuX3ZpZXdNb2RlbCwgdmlld1NlbGVjdGlvblN0YXJ0KSxcblx0XHRcdHRvVmlld0xpbmVOdW1iZXI6IHZpZXdQb3NpdGlvbi5saW5lTnVtYmVyLFxuXHRcdFx0dG9WaWV3VmlzdWFsQ29sdW1uOiB0aGlzLmNvbnRleHQuY3Vyc29yQ29uZmlnLnZpc2libGVDb2x1bW5Gcm9tQ29sdW1uKHRoaXMuX3ZpZXdNb2RlbCwgdmlld1Bvc2l0aW9uKSxcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGdldFNlbGVjdGlvbnMoKTogU2VsZWN0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3JzLmdldFNlbGVjdGlvbnMoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnNvcnMuZ2V0UHJpbWFyeUN1cnNvcigpLm1vZGVsU3RhdGUucG9zaXRpb247XG5cdH1cblxuXHRwdWJsaWMgc2V0U2VsZWN0aW9ucyhldmVudHNDb2xsZWN0b3I6IFZpZXdNb2RlbEV2ZW50c0NvbGxlY3Rvciwgc291cmNlOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLCBzZWxlY3Rpb25zOiByZWFkb25seSBJU2VsZWN0aW9uW10sIHJlYXNvbjogQ3Vyc29yQ2hhbmdlUmVhc29uKTogdm9pZCB7XG5cdFx0dGhpcy5zZXRTdGF0ZXMoZXZlbnRzQ29sbGVjdG9yLCBzb3VyY2UsIHJlYXNvbiwgQ3Vyc29yU3RhdGUuZnJvbU1vZGVsU2VsZWN0aW9ucyhzZWxlY3Rpb25zKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UHJldkVkaXRPcGVyYXRpb25UeXBlKCk6IEVkaXRPcGVyYXRpb25UeXBlIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJldkVkaXRPcGVyYXRpb25UeXBlO1xuXHR9XG5cblx0cHVibGljIHNldFByZXZFZGl0T3BlcmF0aW9uVHlwZSh0eXBlOiBFZGl0T3BlcmF0aW9uVHlwZSk6IHZvaWQge1xuXHRcdHRoaXMuX3ByZXZFZGl0T3BlcmF0aW9uVHlwZSA9IHR5cGU7XG5cdH1cblxuXHQvLyAtLS0tLS0gYXV4aWxpYXJ5IGhhbmRsaW5nIGxvZ2ljXG5cblx0cHJpdmF0ZSBfcHVzaEF1dG9DbG9zZWRBY3Rpb24oYXV0b0Nsb3NlZENoYXJhY3RlcnNSYW5nZXM6IFJhbmdlW10sIGF1dG9DbG9zZWRFbmNsb3NpbmdSYW5nZXM6IFJhbmdlW10pOiB2b2lkIHtcblx0XHRjb25zdCBhdXRvQ2xvc2VkQ2hhcmFjdGVyc0RlbHRhRGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0Y29uc3QgYXV0b0Nsb3NlZEVuY2xvc2luZ0RlbHRhRGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXV0b0Nsb3NlZENoYXJhY3RlcnNSYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGF1dG9DbG9zZWRDaGFyYWN0ZXJzRGVsdGFEZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0cmFuZ2U6IGF1dG9DbG9zZWRDaGFyYWN0ZXJzUmFuZ2VzW2ldLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdhdXRvLWNsb3NlZC1jaGFyYWN0ZXInLFxuXHRcdFx0XHRcdGlubGluZUNsYXNzTmFtZTogJ2F1dG8tY2xvc2VkLWNoYXJhY3RlcicsXG5cdFx0XHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRhdXRvQ2xvc2VkRW5jbG9zaW5nRGVsdGFEZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0cmFuZ2U6IGF1dG9DbG9zZWRFbmNsb3NpbmdSYW5nZXNbaV0sXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2F1dG8tY2xvc2VkLWVuY2xvc2luZycsXG5cdFx0XHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXV0b0Nsb3NlZENoYXJhY3RlcnNEZWNvcmF0aW9ucyA9IHRoaXMuX21vZGVsLmRlbHRhRGVjb3JhdGlvbnMoW10sIGF1dG9DbG9zZWRDaGFyYWN0ZXJzRGVsdGFEZWNvcmF0aW9ucyk7XG5cdFx0Y29uc3QgYXV0b0Nsb3NlZEVuY2xvc2luZ0RlY29yYXRpb25zID0gdGhpcy5fbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgYXV0b0Nsb3NlZEVuY2xvc2luZ0RlbHRhRGVjb3JhdGlvbnMpO1xuXHRcdHRoaXMuX2F1dG9DbG9zZWRBY3Rpb25zLnB1c2gobmV3IEF1dG9DbG9zZWRBY3Rpb24odGhpcy5fbW9kZWwsIGF1dG9DbG9zZWRDaGFyYWN0ZXJzRGVjb3JhdGlvbnMsIGF1dG9DbG9zZWRFbmNsb3NpbmdEZWNvcmF0aW9ucykpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZXhlY3V0ZUVkaXRPcGVyYXRpb24ob3BSZXN1bHQ6IEVkaXRPcGVyYXRpb25SZXN1bHQgfCBudWxsKTogdm9pZCB7XG5cblx0XHRpZiAoIW9wUmVzdWx0KSB7XG5cdFx0XHQvLyBOb3RoaW5nIHRvIGV4ZWN1dGVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAob3BSZXN1bHQuc2hvdWxkUHVzaFN0YWNrRWxlbWVudEJlZm9yZSkge1xuXHRcdFx0dGhpcy5fbW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IENvbW1hbmRFeGVjdXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5fbW9kZWwsIHRoaXMuX2N1cnNvcnMuZ2V0U2VsZWN0aW9ucygpLCBvcFJlc3VsdC5jb21tYW5kcyk7XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0Ly8gVGhlIGNvbW1hbmRzIHdlcmUgYXBwbGllZCBjb3JyZWN0bHlcblx0XHRcdHRoaXMuX2ludGVycHJldENvbW1hbmRSZXN1bHQocmVzdWx0KTtcblxuXHRcdFx0Ly8gQ2hlY2sgZm9yIGF1dG8tY2xvc2luZyBjbG9zZWQgY2hhcmFjdGVyc1xuXHRcdFx0Y29uc3QgYXV0b0Nsb3NlZENoYXJhY3RlcnNSYW5nZXM6IFJhbmdlW10gPSBbXTtcblx0XHRcdGNvbnN0IGF1dG9DbG9zZWRFbmNsb3NpbmdSYW5nZXM6IFJhbmdlW10gPSBbXTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBvcFJlc3VsdC5jb21tYW5kcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBjb21tYW5kID0gb3BSZXN1bHQuY29tbWFuZHNbaV07XG5cdFx0XHRcdGlmIChjb21tYW5kIGluc3RhbmNlb2YgQmFzZVR5cGVXaXRoQXV0b0Nsb3NpbmdDb21tYW5kICYmIGNvbW1hbmQuZW5jbG9zaW5nUmFuZ2UgJiYgY29tbWFuZC5jbG9zZUNoYXJhY3RlclJhbmdlKSB7XG5cdFx0XHRcdFx0YXV0b0Nsb3NlZENoYXJhY3RlcnNSYW5nZXMucHVzaChjb21tYW5kLmNsb3NlQ2hhcmFjdGVyUmFuZ2UpO1xuXHRcdFx0XHRcdGF1dG9DbG9zZWRFbmNsb3NpbmdSYW5nZXMucHVzaChjb21tYW5kLmVuY2xvc2luZ1JhbmdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYXV0b0Nsb3NlZENoYXJhY3RlcnNSYW5nZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR0aGlzLl9wdXNoQXV0b0Nsb3NlZEFjdGlvbihhdXRvQ2xvc2VkQ2hhcmFjdGVyc1JhbmdlcywgYXV0b0Nsb3NlZEVuY2xvc2luZ1Jhbmdlcyk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3ByZXZFZGl0T3BlcmF0aW9uVHlwZSA9IG9wUmVzdWx0LnR5cGU7XG5cdFx0fVxuXG5cdFx0aWYgKG9wUmVzdWx0LnNob3VsZFB1c2hTdGFja0VsZW1lbnRBZnRlcikge1xuXHRcdFx0dGhpcy5fbW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2ludGVycHJldENvbW1hbmRSZXN1bHQoY3Vyc29yU3RhdGU6IFNlbGVjdGlvbltdIHwgbnVsbCk6IHZvaWQge1xuXHRcdGlmICghY3Vyc29yU3RhdGUgfHwgY3Vyc29yU3RhdGUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRjdXJzb3JTdGF0ZSA9IHRoaXMuX2N1cnNvcnMucmVhZFNlbGVjdGlvbkZyb21NYXJrZXJzKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29sdW1uU2VsZWN0RGF0YSA9IG51bGw7XG5cdFx0dGhpcy5fY3Vyc29ycy5zZXRTZWxlY3Rpb25zKGN1cnNvclN0YXRlKTtcblx0XHR0aGlzLl9jdXJzb3JzLm5vcm1hbGl6ZSgpO1xuXHR9XG5cblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0Ly8gLS0tLS0gZW1pdHRpbmcgZXZlbnRzXG5cblx0cHJpdmF0ZSBfZW1pdFN0YXRlQ2hhbmdlZElmTmVjZXNzYXJ5KGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yLCBzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIHJlYXNvbjogQ3Vyc29yQ2hhbmdlUmVhc29uLCBvbGRTdGF0ZTogQ3Vyc29yTW9kZWxTdGF0ZSB8IG51bGwsIHJlYWNoZWRNYXhDdXJzb3JDb3VudDogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG5ld1N0YXRlID0gQ3Vyc29yTW9kZWxTdGF0ZS5mcm9tKHRoaXMuX21vZGVsLCB0aGlzKTtcblx0XHRpZiAobmV3U3RhdGUuZXF1YWxzKG9sZFN0YXRlKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9jdXJzb3JzLmdldFNlbGVjdGlvbnMoKTtcblx0XHRjb25zdCB2aWV3U2VsZWN0aW9ucyA9IHRoaXMuX2N1cnNvcnMuZ2V0Vmlld1NlbGVjdGlvbnMoKTtcblxuXHRcdC8vIExldCB0aGUgdmlldyBnZXQgdGhlIGV2ZW50IGZpcnN0LlxuXHRcdGV2ZW50c0NvbGxlY3Rvci5lbWl0Vmlld0V2ZW50KG5ldyBWaWV3Q3Vyc29yU3RhdGVDaGFuZ2VkRXZlbnQodmlld1NlbGVjdGlvbnMsIHNlbGVjdGlvbnMsIHJlYXNvbikpO1xuXG5cdFx0Ly8gT25seSBhZnRlciB0aGUgdmlldyBoYXMgYmVlbiBub3RpZmllZCwgbGV0IHRoZSByZXN0IG9mIHRoZSB3b3JsZCBrbm93Li4uXG5cdFx0aWYgKCFvbGRTdGF0ZVxuXHRcdFx0fHwgb2xkU3RhdGUuY3Vyc29yU3RhdGUubGVuZ3RoICE9PSBuZXdTdGF0ZS5jdXJzb3JTdGF0ZS5sZW5ndGhcblx0XHRcdHx8IG5ld1N0YXRlLmN1cnNvclN0YXRlLnNvbWUoKG5ld0N1cnNvclN0YXRlLCBpKSA9PiAhbmV3Q3Vyc29yU3RhdGUubW9kZWxTdGF0ZS5lcXVhbHMob2xkU3RhdGUuY3Vyc29yU3RhdGVbaV0ubW9kZWxTdGF0ZSkpXG5cdFx0KSB7XG5cdFx0XHRjb25zdCBvbGRTZWxlY3Rpb25zID0gb2xkU3RhdGUgPyBvbGRTdGF0ZS5jdXJzb3JTdGF0ZS5tYXAocyA9PiBzLm1vZGVsU3RhdGUuc2VsZWN0aW9uKSA6IG51bGw7XG5cdFx0XHRjb25zdCBvbGRNb2RlbFZlcnNpb25JZCA9IG9sZFN0YXRlID8gb2xkU3RhdGUubW9kZWxWZXJzaW9uSWQgOiAwO1xuXHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRPdXRnb2luZ0V2ZW50KG5ldyBDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudChvbGRTZWxlY3Rpb25zLCBzZWxlY3Rpb25zLCBvbGRNb2RlbFZlcnNpb25JZCwgbmV3U3RhdGUubW9kZWxWZXJzaW9uSWQsIHNvdXJjZSB8fCAna2V5Ym9hcmQnLCByZWFzb24sIHJlYWNoZWRNYXhDdXJzb3JDb3VudCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0Ly8gLS0tLS0gaGFuZGxlcnMgYmV5b25kIHRoaXMgcG9pbnRcblxuXHRwcml2YXRlIF9maW5kQXV0b0Nsb3NpbmdQYWlycyhlZGl0czogSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW10pOiBbbnVtYmVyLCBudW1iZXJdW10gfCBudWxsIHtcblx0XHRpZiAoIWVkaXRzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kaWNlczogW251bWJlciwgbnVtYmVyXVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGVkaXRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBlZGl0ID0gZWRpdHNbaV07XG5cdFx0XHRpZiAoIWVkaXQudGV4dCB8fCBlZGl0LnRleHQuaW5kZXhPZignXFxuJykgPj0gMCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbSA9IGVkaXQudGV4dC5tYXRjaCgvKFspXFxdfT4nXCJgXSkoW14pXFxdfT4nXCJgXSopJC8pO1xuXHRcdFx0aWYgKCFtKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY2xvc2VDaGFyID0gbVsxXTtcblxuXHRcdFx0Y29uc3QgYXV0b0Nsb3NpbmdQYWlyc0NhbmRpZGF0ZXMgPSB0aGlzLmNvbnRleHQuY3Vyc29yQ29uZmlnLmF1dG9DbG9zaW5nUGFpcnMuYXV0b0Nsb3NpbmdQYWlyc0Nsb3NlU2luZ2xlQ2hhci5nZXQoY2xvc2VDaGFyKTtcblx0XHRcdGlmICghYXV0b0Nsb3NpbmdQYWlyc0NhbmRpZGF0ZXMgfHwgYXV0b0Nsb3NpbmdQYWlyc0NhbmRpZGF0ZXMubGVuZ3RoICE9PSAxKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBvcGVuQ2hhciA9IGF1dG9DbG9zaW5nUGFpcnNDYW5kaWRhdGVzWzBdLm9wZW47XG5cdFx0XHRjb25zdCBjbG9zZUNoYXJJbmRleCA9IGVkaXQudGV4dC5sZW5ndGggLSBtWzJdLmxlbmd0aCAtIDE7XG5cdFx0XHRjb25zdCBvcGVuQ2hhckluZGV4ID0gZWRpdC50ZXh0Lmxhc3RJbmRleE9mKG9wZW5DaGFyLCBjbG9zZUNoYXJJbmRleCAtIDEpO1xuXHRcdFx0aWYgKG9wZW5DaGFySW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpbmRpY2VzLnB1c2goW29wZW5DaGFySW5kZXgsIGNsb3NlQ2hhckluZGV4XSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGluZGljZXM7XG5cdH1cblxuXHRwdWJsaWMgZXhlY3V0ZUVkaXRzKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yLCBzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGVkaXRzOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXSwgY3Vyc29yU3RhdGVDb21wdXRlcjogSUN1cnNvclN0YXRlQ29tcHV0ZXIpOiB2b2lkIHtcblx0XHRsZXQgYXV0b0Nsb3NpbmdJbmRpY2VzOiBbbnVtYmVyLCBudW1iZXJdW10gfCBudWxsID0gbnVsbDtcblx0XHRpZiAoc291cmNlID09PSAnc25pcHBldCcpIHtcblx0XHRcdGF1dG9DbG9zaW5nSW5kaWNlcyA9IHRoaXMuX2ZpbmRBdXRvQ2xvc2luZ1BhaXJzKGVkaXRzKTtcblx0XHR9XG5cblx0XHRpZiAoYXV0b0Nsb3NpbmdJbmRpY2VzKSB7XG5cdFx0XHRlZGl0c1swXS5faXNUcmFja2VkID0gdHJ1ZTtcblx0XHR9XG5cdFx0Y29uc3QgYXV0b0Nsb3NlZENoYXJhY3RlcnNSYW5nZXM6IFJhbmdlW10gPSBbXTtcblx0XHRjb25zdCBhdXRvQ2xvc2VkRW5jbG9zaW5nUmFuZ2VzOiBSYW5nZVtdID0gW107XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMuX21vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyh0aGlzLmdldFNlbGVjdGlvbnMoKSwgZWRpdHMsICh1bmRvRWRpdHMpID0+IHtcblx0XHRcdGlmIChhdXRvQ2xvc2luZ0luZGljZXMpIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGF1dG9DbG9zaW5nSW5kaWNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IFtvcGVuQ2hhcklubmVySW5kZXgsIGNsb3NlQ2hhcklubmVySW5kZXhdID0gYXV0b0Nsb3NpbmdJbmRpY2VzW2ldO1xuXHRcdFx0XHRcdGNvbnN0IHVuZG9FZGl0ID0gdW5kb0VkaXRzW2ldO1xuXHRcdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSB1bmRvRWRpdC5yYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdFx0Y29uc3Qgb3BlbkNoYXJJbmRleCA9IHVuZG9FZGl0LnJhbmdlLnN0YXJ0Q29sdW1uIC0gMSArIG9wZW5DaGFySW5uZXJJbmRleDtcblx0XHRcdFx0XHRjb25zdCBjbG9zZUNoYXJJbmRleCA9IHVuZG9FZGl0LnJhbmdlLnN0YXJ0Q29sdW1uIC0gMSArIGNsb3NlQ2hhcklubmVySW5kZXg7XG5cblx0XHRcdFx0XHRhdXRvQ2xvc2VkQ2hhcmFjdGVyc1Jhbmdlcy5wdXNoKG5ldyBSYW5nZShsaW5lTnVtYmVyLCBjbG9zZUNoYXJJbmRleCArIDEsIGxpbmVOdW1iZXIsIGNsb3NlQ2hhckluZGV4ICsgMikpO1xuXHRcdFx0XHRcdGF1dG9DbG9zZWRFbmNsb3NpbmdSYW5nZXMucHVzaChuZXcgUmFuZ2UobGluZU51bWJlciwgb3BlbkNoYXJJbmRleCArIDEsIGxpbmVOdW1iZXIsIGNsb3NlQ2hhckluZGV4ICsgMikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gY3Vyc29yU3RhdGVDb21wdXRlcih1bmRvRWRpdHMpO1xuXHRcdFx0aWYgKHNlbGVjdGlvbnMpIHtcblx0XHRcdFx0Ly8gRG9uJ3QgcmVjb3ZlciB0aGUgc2VsZWN0aW9uIGZyb20gbWFya2VycyBiZWNhdXNlXG5cdFx0XHRcdC8vIHdlIGtub3cgd2hhdCBpdCBzaG91bGQgYmUuXG5cdFx0XHRcdHRoaXMuX2lzSGFuZGxpbmcgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9ucztcblx0XHR9KTtcblx0XHRpZiAoc2VsZWN0aW9ucykge1xuXHRcdFx0dGhpcy5faXNIYW5kbGluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5zZXRTZWxlY3Rpb25zKGV2ZW50c0NvbGxlY3Rvciwgc291cmNlLCBzZWxlY3Rpb25zLCBDdXJzb3JDaGFuZ2VSZWFzb24uTm90U2V0KTtcblx0XHR9XG5cdFx0aWYgKGF1dG9DbG9zZWRDaGFyYWN0ZXJzUmFuZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX3B1c2hBdXRvQ2xvc2VkQWN0aW9uKGF1dG9DbG9zZWRDaGFyYWN0ZXJzUmFuZ2VzLCBhdXRvQ2xvc2VkRW5jbG9zaW5nUmFuZ2VzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9leGVjdXRlRWRpdChjYWxsYmFjazogKCkgPT4gdm9pZCwgZXZlbnRzQ29sbGVjdG9yOiBWaWV3TW9kZWxFdmVudHNDb2xsZWN0b3IsIHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgY3Vyc29yQ2hhbmdlUmVhc29uOiBDdXJzb3JDaGFuZ2VSZWFzb24gPSBDdXJzb3JDaGFuZ2VSZWFzb24uTm90U2V0KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY29udGV4dC5jdXJzb3JDb25maWcucmVhZE9ubHkpIHtcblx0XHRcdC8vIHdlIGNhbm5vdCBlZGl0IHdoZW4gcmVhZCBvbmx5Li4uXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb2xkU3RhdGUgPSBDdXJzb3JNb2RlbFN0YXRlLmZyb20odGhpcy5fbW9kZWwsIHRoaXMpO1xuXHRcdHRoaXMuX2N1cnNvcnMuc3RvcFRyYWNraW5nU2VsZWN0aW9ucygpO1xuXHRcdHRoaXMuX2lzSGFuZGxpbmcgPSB0cnVlO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2N1cnNvcnMuZW5zdXJlVmFsaWRTdGF0ZSgpO1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0fVxuXG5cdFx0dGhpcy5faXNIYW5kbGluZyA9IGZhbHNlO1xuXHRcdHRoaXMuX2N1cnNvcnMuc3RhcnRUcmFja2luZ1NlbGVjdGlvbnMoKTtcblx0XHR0aGlzLl92YWxpZGF0ZUF1dG9DbG9zZWRBY3Rpb25zKCk7XG5cdFx0aWYgKHRoaXMuX2VtaXRTdGF0ZUNoYW5nZWRJZk5lY2Vzc2FyeShldmVudHNDb2xsZWN0b3IsIHNvdXJjZSwgY3Vyc29yQ2hhbmdlUmVhc29uLCBvbGRTdGF0ZSwgZmFsc2UpKSB7XG5cdFx0XHR0aGlzLnJldmVhbEFsbChldmVudHNDb2xsZWN0b3IsIHNvdXJjZSwgZmFsc2UsIFZlcnRpY2FsUmV2ZWFsVHlwZS5TaW1wbGUsIHRydWUsIGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLlNtb290aCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldEF1dG9DbG9zZWRDaGFyYWN0ZXJzKCk6IFJhbmdlW10ge1xuXHRcdHJldHVybiBBdXRvQ2xvc2VkQWN0aW9uLmdldEFsbEF1dG9DbG9zZWRDaGFyYWN0ZXJzKHRoaXMuX2F1dG9DbG9zZWRBY3Rpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBzdGFydENvbXBvc2l0aW9uKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yKTogdm9pZCB7XG5cdFx0dGhpcy5fY29tcG9zaXRpb25TdGF0ZSA9IG5ldyBDb21wb3NpdGlvblN0YXRlKHRoaXMuX21vZGVsLCB0aGlzLmdldFNlbGVjdGlvbnMoKSk7XG5cdH1cblxuXHRwdWJsaWMgZW5kQ29tcG9zaXRpb24oZXZlbnRzQ29sbGVjdG9yOiBWaWV3TW9kZWxFdmVudHNDb2xsZWN0b3IsIHNvdXJjZT86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBjb21wb3NpdGlvbk91dGNvbWUgPSB0aGlzLl9jb21wb3NpdGlvblN0YXRlID8gdGhpcy5fY29tcG9zaXRpb25TdGF0ZS5kZWR1Y2VPdXRjb21lKHRoaXMuX21vZGVsLCB0aGlzLmdldFNlbGVjdGlvbnMoKSkgOiBudWxsO1xuXHRcdHRoaXMuX2NvbXBvc2l0aW9uU3RhdGUgPSBudWxsO1xuXG5cdFx0dGhpcy5fZXhlY3V0ZUVkaXQoKCkgPT4ge1xuXHRcdFx0aWYgKHNvdXJjZSA9PT0gJ2tleWJvYXJkJykge1xuXHRcdFx0XHQvLyBjb21wb3NpdGlvbiBmaW5pc2hlcywgbGV0J3MgY2hlY2sgaWYgd2UgbmVlZCB0byBhdXRvIGNvbXBsZXRlIGlmIG5lY2Vzc2FyeS5cblx0XHRcdFx0dGhpcy5fZXhlY3V0ZUVkaXRPcGVyYXRpb24oVHlwZU9wZXJhdGlvbnMuY29tcG9zaXRpb25FbmRXaXRoSW50ZXJjZXB0b3JzKHRoaXMuX3ByZXZFZGl0T3BlcmF0aW9uVHlwZSwgdGhpcy5jb250ZXh0LmN1cnNvckNvbmZpZywgdGhpcy5fbW9kZWwsIGNvbXBvc2l0aW9uT3V0Y29tZSwgdGhpcy5nZXRTZWxlY3Rpb25zKCksIHRoaXMuZ2V0QXV0b0Nsb3NlZENoYXJhY3RlcnMoKSkpO1xuXHRcdFx0fVxuXHRcdH0sIGV2ZW50c0NvbGxlY3Rvciwgc291cmNlKTtcblx0fVxuXG5cdHB1YmxpYyB0eXBlKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yLCB0ZXh0OiBzdHJpbmcsIHNvdXJjZT86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl9leGVjdXRlRWRpdCgoKSA9PiB7XG5cdFx0XHRpZiAoc291cmNlID09PSAna2V5Ym9hcmQnKSB7XG5cdFx0XHRcdC8vIElmIHRoaXMgZXZlbnQgaXMgY29taW5nIHN0cmFpZ2h0IGZyb20gdGhlIGtleWJvYXJkLCBsb29rIGZvciBlbGVjdHJpYyBjaGFyYWN0ZXJzIGFuZCBlbnRlclxuXG5cdFx0XHRcdGNvbnN0IGxlbiA9IHRleHQubGVuZ3RoO1xuXHRcdFx0XHRsZXQgb2Zmc2V0ID0gMDtcblx0XHRcdFx0d2hpbGUgKG9mZnNldCA8IGxlbikge1xuXHRcdFx0XHRcdGNvbnN0IGNoYXJMZW5ndGggPSBzdHJpbmdzLm5leHRDaGFyTGVuZ3RoKHRleHQsIG9mZnNldCk7XG5cdFx0XHRcdFx0Y29uc3QgY2hyID0gdGV4dC5zdWJzdHIob2Zmc2V0LCBjaGFyTGVuZ3RoKTtcblxuXHRcdFx0XHRcdC8vIEhlcmUgd2UgbXVzdCBpbnRlcnByZXQgZWFjaCB0eXBlZCBjaGFyYWN0ZXIgaW5kaXZpZHVhbGx5XG5cdFx0XHRcdFx0dGhpcy5fZXhlY3V0ZUVkaXRPcGVyYXRpb24oVHlwZU9wZXJhdGlvbnMudHlwZVdpdGhJbnRlcmNlcHRvcnMoISF0aGlzLl9jb21wb3NpdGlvblN0YXRlLCB0aGlzLl9wcmV2RWRpdE9wZXJhdGlvblR5cGUsIHRoaXMuY29udGV4dC5jdXJzb3JDb25maWcsIHRoaXMuX21vZGVsLCB0aGlzLmdldFNlbGVjdGlvbnMoKSwgdGhpcy5nZXRBdXRvQ2xvc2VkQ2hhcmFjdGVycygpLCBjaHIpKTtcblxuXHRcdFx0XHRcdG9mZnNldCArPSBjaGFyTGVuZ3RoO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2V4ZWN1dGVFZGl0T3BlcmF0aW9uKFR5cGVPcGVyYXRpb25zLnR5cGVXaXRob3V0SW50ZXJjZXB0b3JzKHRoaXMuX3ByZXZFZGl0T3BlcmF0aW9uVHlwZSwgdGhpcy5jb250ZXh0LmN1cnNvckNvbmZpZywgdGhpcy5fbW9kZWwsIHRoaXMuZ2V0U2VsZWN0aW9ucygpLCB0ZXh0KSk7XG5cdFx0XHR9XG5cdFx0fSwgZXZlbnRzQ29sbGVjdG9yLCBzb3VyY2UpO1xuXHR9XG5cblx0cHVibGljIGNvbXBvc2l0aW9uVHlwZShldmVudHNDb2xsZWN0b3I6IFZpZXdNb2RlbEV2ZW50c0NvbGxlY3RvciwgdGV4dDogc3RyaW5nLCByZXBsYWNlUHJldkNoYXJDbnQ6IG51bWJlciwgcmVwbGFjZU5leHRDaGFyQ250OiBudW1iZXIsIHBvc2l0aW9uRGVsdGE6IG51bWJlciwgc291cmNlPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCAmJiByZXBsYWNlUHJldkNoYXJDbnQgPT09IDAgJiYgcmVwbGFjZU5leHRDaGFyQ250ID09PSAwKSB7XG5cdFx0XHQvLyB0aGlzIGVkaXQgaXMgYSBuby1vcFxuXHRcdFx0aWYgKHBvc2l0aW9uRGVsdGEgIT09IDApIHtcblx0XHRcdFx0Ly8gYnV0IGl0IHN0aWxsIHdhbnRzIHRvIG1vdmUgdGhlIGN1cnNvclxuXHRcdFx0XHRjb25zdCBuZXdTZWxlY3Rpb25zID0gdGhpcy5nZXRTZWxlY3Rpb25zKCkubWFwKHNlbGVjdGlvbiA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSBzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFNlbGVjdGlvbihwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4gKyBwb3NpdGlvbkRlbHRhLCBwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4gKyBwb3NpdGlvbkRlbHRhKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuc2V0U2VsZWN0aW9ucyhldmVudHNDb2xsZWN0b3IsIHNvdXJjZSwgbmV3U2VsZWN0aW9ucywgQ3Vyc29yQ2hhbmdlUmVhc29uLk5vdFNldCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2V4ZWN1dGVFZGl0KCgpID0+IHtcblx0XHRcdHRoaXMuX2V4ZWN1dGVFZGl0T3BlcmF0aW9uKFR5cGVPcGVyYXRpb25zLmNvbXBvc2l0aW9uVHlwZSh0aGlzLl9wcmV2RWRpdE9wZXJhdGlvblR5cGUsIHRoaXMuY29udGV4dC5jdXJzb3JDb25maWcsIHRoaXMuX21vZGVsLCB0aGlzLmdldFNlbGVjdGlvbnMoKSwgdGV4dCwgcmVwbGFjZVByZXZDaGFyQ250LCByZXBsYWNlTmV4dENoYXJDbnQsIHBvc2l0aW9uRGVsdGEpKTtcblx0XHR9LCBldmVudHNDb2xsZWN0b3IsIHNvdXJjZSk7XG5cdH1cblxuXHRwdWJsaWMgcGFzdGUoZXZlbnRzQ29sbGVjdG9yOiBWaWV3TW9kZWxFdmVudHNDb2xsZWN0b3IsIHRleHQ6IHN0cmluZywgcGFzdGVPbk5ld0xpbmU6IGJvb2xlYW4sIG11bHRpY3Vyc29yVGV4dD86IHN0cmluZ1tdIHwgbnVsbCB8IHVuZGVmaW5lZCwgc291cmNlPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2V4ZWN1dGVFZGl0KCgpID0+IHtcblx0XHRcdHRoaXMuX2V4ZWN1dGVFZGl0T3BlcmF0aW9uKFR5cGVPcGVyYXRpb25zLnBhc3RlKHRoaXMuY29udGV4dC5jdXJzb3JDb25maWcsIHRoaXMuX21vZGVsLCB0aGlzLmdldFNlbGVjdGlvbnMoKSwgdGV4dCwgcGFzdGVPbk5ld0xpbmUsIG11bHRpY3Vyc29yVGV4dCB8fCBbXSkpO1xuXHRcdH0sIGV2ZW50c0NvbGxlY3Rvciwgc291cmNlLCBDdXJzb3JDaGFuZ2VSZWFzb24uUGFzdGUpO1xuXHR9XG5cblx0cHVibGljIGN1dChldmVudHNDb2xsZWN0b3I6IFZpZXdNb2RlbEV2ZW50c0NvbGxlY3Rvciwgc291cmNlPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2V4ZWN1dGVFZGl0KCgpID0+IHtcblx0XHRcdHRoaXMuX2V4ZWN1dGVFZGl0T3BlcmF0aW9uKERlbGV0ZU9wZXJhdGlvbnMuY3V0KHRoaXMuY29udGV4dC5jdXJzb3JDb25maWcsIHRoaXMuX21vZGVsLCB0aGlzLmdldFNlbGVjdGlvbnMoKSkpO1xuXHRcdH0sIGV2ZW50c0NvbGxlY3Rvciwgc291cmNlKTtcblx0fVxuXG5cdHB1YmxpYyBleGVjdXRlQ29tbWFuZChldmVudHNDb2xsZWN0b3I6IFZpZXdNb2RlbEV2ZW50c0NvbGxlY3RvciwgY29tbWFuZDogZWRpdG9yQ29tbW9uLklDb21tYW5kLCBzb3VyY2U/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fZXhlY3V0ZUVkaXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY3Vyc29ycy5raWxsU2Vjb25kYXJ5Q3Vyc29ycygpO1xuXG5cdFx0XHR0aGlzLl9leGVjdXRlRWRpdE9wZXJhdGlvbihuZXcgRWRpdE9wZXJhdGlvblJlc3VsdChFZGl0T3BlcmF0aW9uVHlwZS5PdGhlciwgW2NvbW1hbmRdLCB7XG5cdFx0XHRcdHNob3VsZFB1c2hTdGFja0VsZW1lbnRCZWZvcmU6IGZhbHNlLFxuXHRcdFx0XHRzaG91bGRQdXNoU3RhY2tFbGVtZW50QWZ0ZXI6IGZhbHNlXG5cdFx0XHR9KSk7XG5cdFx0fSwgZXZlbnRzQ29sbGVjdG9yLCBzb3VyY2UpO1xuXHR9XG5cblx0cHVibGljIGV4ZWN1dGVDb21tYW5kcyhldmVudHNDb2xsZWN0b3I6IFZpZXdNb2RlbEV2ZW50c0NvbGxlY3RvciwgY29tbWFuZHM6IGVkaXRvckNvbW1vbi5JQ29tbWFuZFtdLCBzb3VyY2U/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fZXhlY3V0ZUVkaXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZXhlY3V0ZUVkaXRPcGVyYXRpb24obmV3IEVkaXRPcGVyYXRpb25SZXN1bHQoRWRpdE9wZXJhdGlvblR5cGUuT3RoZXIsIGNvbW1hbmRzLCB7XG5cdFx0XHRcdHNob3VsZFB1c2hTdGFja0VsZW1lbnRCZWZvcmU6IGZhbHNlLFxuXHRcdFx0XHRzaG91bGRQdXNoU3RhY2tFbGVtZW50QWZ0ZXI6IGZhbHNlXG5cdFx0XHR9KSk7XG5cdFx0fSwgZXZlbnRzQ29sbGVjdG9yLCBzb3VyY2UpO1xuXHR9XG59XG5cbi8qKlxuICogQSBzbmFwc2hvdCBvZiB0aGUgY3Vyc29yIGFuZCB0aGUgbW9kZWwgc3RhdGVcbiAqL1xuY2xhc3MgQ3Vyc29yTW9kZWxTdGF0ZSB7XG5cdHB1YmxpYyBzdGF0aWMgZnJvbShtb2RlbDogSVRleHRNb2RlbCwgY3Vyc29yOiBDdXJzb3JzQ29udHJvbGxlcik6IEN1cnNvck1vZGVsU3RhdGUge1xuXHRcdHJldHVybiBuZXcgQ3Vyc29yTW9kZWxTdGF0ZShtb2RlbC5nZXRWZXJzaW9uSWQoKSwgY3Vyc29yLmdldEN1cnNvclN0YXRlcygpKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBtb2RlbFZlcnNpb25JZDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBjdXJzb3JTdGF0ZTogQ3Vyc29yU3RhdGVbXSxcblx0KSB7XG5cdH1cblxuXHRwdWJsaWMgZXF1YWxzKG90aGVyOiBDdXJzb3JNb2RlbFN0YXRlIHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRcdGlmICghb3RoZXIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMubW9kZWxWZXJzaW9uSWQgIT09IG90aGVyLm1vZGVsVmVyc2lvbklkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmN1cnNvclN0YXRlLmxlbmd0aCAhPT0gb3RoZXIuY3Vyc29yU3RhdGUubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmN1cnNvclN0YXRlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRpZiAoIXRoaXMuY3Vyc29yU3RhdGVbaV0uZXF1YWxzKG90aGVyLmN1cnNvclN0YXRlW2ldKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5cbmNsYXNzIEF1dG9DbG9zZWRBY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0QWxsQXV0b0Nsb3NlZENoYXJhY3RlcnMoYXV0b0Nsb3NlZEFjdGlvbnM6IEF1dG9DbG9zZWRBY3Rpb25bXSk6IFJhbmdlW10ge1xuXHRcdGxldCBhdXRvQ2xvc2VkQ2hhcmFjdGVyczogUmFuZ2VbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgYXV0b0Nsb3NlZEFjdGlvbiBvZiBhdXRvQ2xvc2VkQWN0aW9ucykge1xuXHRcdFx0YXV0b0Nsb3NlZENoYXJhY3RlcnMgPSBhdXRvQ2xvc2VkQ2hhcmFjdGVycy5jb25jYXQoYXV0b0Nsb3NlZEFjdGlvbi5nZXRBdXRvQ2xvc2VkQ2hhcmFjdGVyc1JhbmdlcygpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGF1dG9DbG9zZWRDaGFyYWN0ZXJzO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWw7XG5cblx0cHJpdmF0ZSBfYXV0b0Nsb3NlZENoYXJhY3RlcnNEZWNvcmF0aW9uczogc3RyaW5nW107XG5cdHByaXZhdGUgX2F1dG9DbG9zZWRFbmNsb3NpbmdEZWNvcmF0aW9uczogc3RyaW5nW107XG5cblx0Y29uc3RydWN0b3IobW9kZWw6IElUZXh0TW9kZWwsIGF1dG9DbG9zZWRDaGFyYWN0ZXJzRGVjb3JhdGlvbnM6IHN0cmluZ1tdLCBhdXRvQ2xvc2VkRW5jbG9zaW5nRGVjb3JhdGlvbnM6IHN0cmluZ1tdKSB7XG5cdFx0dGhpcy5fbW9kZWwgPSBtb2RlbDtcblx0XHR0aGlzLl9hdXRvQ2xvc2VkQ2hhcmFjdGVyc0RlY29yYXRpb25zID0gYXV0b0Nsb3NlZENoYXJhY3RlcnNEZWNvcmF0aW9ucztcblx0XHR0aGlzLl9hdXRvQ2xvc2VkRW5jbG9zaW5nRGVjb3JhdGlvbnMgPSBhdXRvQ2xvc2VkRW5jbG9zaW5nRGVjb3JhdGlvbnM7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9hdXRvQ2xvc2VkQ2hhcmFjdGVyc0RlY29yYXRpb25zID0gdGhpcy5fbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLl9hdXRvQ2xvc2VkQ2hhcmFjdGVyc0RlY29yYXRpb25zLCBbXSk7XG5cdFx0dGhpcy5fYXV0b0Nsb3NlZEVuY2xvc2luZ0RlY29yYXRpb25zID0gdGhpcy5fbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLl9hdXRvQ2xvc2VkRW5jbG9zaW5nRGVjb3JhdGlvbnMsIFtdKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBdXRvQ2xvc2VkQ2hhcmFjdGVyc1JhbmdlcygpOiBSYW5nZVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFJhbmdlW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2F1dG9DbG9zZWRDaGFyYWN0ZXJzRGVjb3JhdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25SYW5nZSA9IHRoaXMuX21vZGVsLmdldERlY29yYXRpb25SYW5nZSh0aGlzLl9hdXRvQ2xvc2VkQ2hhcmFjdGVyc0RlY29yYXRpb25zW2ldKTtcblx0XHRcdGlmIChkZWNvcmF0aW9uUmFuZ2UpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goZGVjb3JhdGlvblJhbmdlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBpc1ZhbGlkKHNlbGVjdGlvbnM6IFJhbmdlW10pOiBib29sZWFuIHtcblx0XHRjb25zdCBlbmNsb3NpbmdSYW5nZXM6IFJhbmdlW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2F1dG9DbG9zZWRFbmNsb3NpbmdEZWNvcmF0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZGVjb3JhdGlvblJhbmdlID0gdGhpcy5fbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKHRoaXMuX2F1dG9DbG9zZWRFbmNsb3NpbmdEZWNvcmF0aW9uc1tpXSk7XG5cdFx0XHRpZiAoZGVjb3JhdGlvblJhbmdlKSB7XG5cdFx0XHRcdGVuY2xvc2luZ1Jhbmdlcy5wdXNoKGRlY29yYXRpb25SYW5nZSk7XG5cdFx0XHRcdGlmIChkZWNvcmF0aW9uUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSBkZWNvcmF0aW9uUmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdC8vIFN0b3AgdHJhY2tpbmcgaWYgdGhlIHJhbmdlIGJlY29tZXMgbXVsdGlsaW5lLi4uXG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVuY2xvc2luZ1Jhbmdlcy5zb3J0KFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyk7XG5cblx0XHRzZWxlY3Rpb25zLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKGkgPj0gZW5jbG9zaW5nUmFuZ2VzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWVuY2xvc2luZ1Jhbmdlc1tpXS5zdHJpY3RDb250YWluc1JhbmdlKHNlbGVjdGlvbnNbaV0pKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSUV4ZWNDb250ZXh0IHtcblx0cmVhZG9ubHkgbW9kZWw6IElUZXh0TW9kZWw7XG5cdHJlYWRvbmx5IHNlbGVjdGlvbnNCZWZvcmU6IFNlbGVjdGlvbltdO1xuXHRyZWFkb25seSB0cmFja2VkUmFuZ2VzOiBzdHJpbmdbXTtcblx0cmVhZG9ubHkgdHJhY2tlZFJhbmdlc0RpcmVjdGlvbjogU2VsZWN0aW9uRGlyZWN0aW9uW107XG59XG5cbmludGVyZmFjZSBJQ29tbWFuZERhdGEge1xuXHRvcGVyYXRpb25zOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXTtcblx0aGFkVHJhY2tlZEVkaXRPcGVyYXRpb246IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJQ29tbWFuZHNEYXRhIHtcblx0b3BlcmF0aW9uczogSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW107XG5cdGhhZFRyYWNrZWRFZGl0T3BlcmF0aW9uOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgQ29tbWFuZEV4ZWN1dG9yIHtcblxuXHRwdWJsaWMgc3RhdGljIGV4ZWN1dGVDb21tYW5kcyhtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uc0JlZm9yZTogU2VsZWN0aW9uW10sIGNvbW1hbmRzOiAoZWRpdG9yQ29tbW9uLklDb21tYW5kIHwgbnVsbClbXSk6IFNlbGVjdGlvbltdIHwgbnVsbCB7XG5cblx0XHRjb25zdCBjdHg6IElFeGVjQ29udGV4dCA9IHtcblx0XHRcdG1vZGVsOiBtb2RlbCxcblx0XHRcdHNlbGVjdGlvbnNCZWZvcmU6IHNlbGVjdGlvbnNCZWZvcmUsXG5cdFx0XHR0cmFja2VkUmFuZ2VzOiBbXSxcblx0XHRcdHRyYWNrZWRSYW5nZXNEaXJlY3Rpb246IFtdXG5cdFx0fTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX2lubmVyRXhlY3V0ZUNvbW1hbmRzKGN0eCwgY29tbWFuZHMpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN0eC50cmFja2VkUmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjdHgubW9kZWwuX3NldFRyYWNrZWRSYW5nZShjdHgudHJhY2tlZFJhbmdlc1tpXSwgbnVsbCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2lubmVyRXhlY3V0ZUNvbW1hbmRzKGN0eDogSUV4ZWNDb250ZXh0LCBjb21tYW5kczogKGVkaXRvckNvbW1vbi5JQ29tbWFuZCB8IG51bGwpW10pOiBTZWxlY3Rpb25bXSB8IG51bGwge1xuXG5cdFx0aWYgKHRoaXMuX2FycmF5SXNFbXB0eShjb21tYW5kcykpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbW1hbmRzRGF0YSA9IHRoaXMuX2dldEVkaXRPcGVyYXRpb25zKGN0eCwgY29tbWFuZHMpO1xuXHRcdGlmIChjb21tYW5kc0RhdGEub3BlcmF0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhd09wZXJhdGlvbnMgPSBjb21tYW5kc0RhdGEub3BlcmF0aW9ucztcblxuXHRcdGNvbnN0IGxvc2VyQ3Vyc29yc01hcCA9IHRoaXMuX2dldExvc2VyQ3Vyc29yTWFwKHJhd09wZXJhdGlvbnMpO1xuXHRcdGlmIChsb3NlckN1cnNvcnNNYXAuaGFzT3duUHJvcGVydHkoJzAnKSkge1xuXHRcdFx0Ly8gVGhlc2UgY29tbWFuZHMgYXJlIHZlcnkgbWVzc2VkIHVwXG5cdFx0XHRjb25zb2xlLndhcm4oJ0lnbm9yaW5nIGNvbW1hbmRzJyk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgb3BlcmF0aW9ucyBiZWxvbmdpbmcgdG8gbG9zaW5nIGN1cnNvcnNcblx0XHRjb25zdCBmaWx0ZXJlZE9wZXJhdGlvbnM6IElJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJhd09wZXJhdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGlmICghbG9zZXJDdXJzb3JzTWFwLmhhc093blByb3BlcnR5KHJhd09wZXJhdGlvbnNbaV0uaWRlbnRpZmllciEubWFqb3IudG9TdHJpbmcoKSkpIHtcblx0XHRcdFx0ZmlsdGVyZWRPcGVyYXRpb25zLnB1c2gocmF3T3BlcmF0aW9uc1tpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVE9ET0BBbGV4OiBmaW5kIGEgYmV0dGVyIHdheSB0byBkbyB0aGlzLlxuXHRcdC8vIGdpdmUgdGhlIGhpbnQgdGhhdCBlZGl0IG9wZXJhdGlvbnMgYXJlIHRyYWNrZWQgdG8gdGhlIG1vZGVsXG5cdFx0aWYgKGNvbW1hbmRzRGF0YS5oYWRUcmFja2VkRWRpdE9wZXJhdGlvbiAmJiBmaWx0ZXJlZE9wZXJhdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0ZmlsdGVyZWRPcGVyYXRpb25zWzBdLl9pc1RyYWNrZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRsZXQgc2VsZWN0aW9uc0FmdGVyID0gY3R4Lm1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhjdHguc2VsZWN0aW9uc0JlZm9yZSwgZmlsdGVyZWRPcGVyYXRpb25zLCAoaW52ZXJzZUVkaXRPcGVyYXRpb25zOiBJVmFsaWRFZGl0T3BlcmF0aW9uW10pOiBTZWxlY3Rpb25bXSA9PiB7XG5cdFx0XHRjb25zdCBncm91cGVkSW52ZXJzZUVkaXRPcGVyYXRpb25zOiBJVmFsaWRFZGl0T3BlcmF0aW9uW11bXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjdHguc2VsZWN0aW9uc0JlZm9yZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRncm91cGVkSW52ZXJzZUVkaXRPcGVyYXRpb25zW2ldID0gW107XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IG9wIG9mIGludmVyc2VFZGl0T3BlcmF0aW9ucykge1xuXHRcdFx0XHRpZiAoIW9wLmlkZW50aWZpZXIpIHtcblx0XHRcdFx0XHQvLyBwZXJoYXBzIGF1dG8gd2hpdGVzcGFjZSB0cmltIGVkaXRzXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Z3JvdXBlZEludmVyc2VFZGl0T3BlcmF0aW9uc1tvcC5pZGVudGlmaWVyLm1ham9yXS5wdXNoKG9wKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG1pbm9yQmFzZWRTb3J0ZXIgPSAoYTogSVZhbGlkRWRpdE9wZXJhdGlvbiwgYjogSVZhbGlkRWRpdE9wZXJhdGlvbikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gYS5pZGVudGlmaWVyIS5taW5vciAtIGIuaWRlbnRpZmllciEubWlub3I7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgY3Vyc29yU2VsZWN0aW9uczogU2VsZWN0aW9uW10gPSBbXTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY3R4LnNlbGVjdGlvbnNCZWZvcmUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGdyb3VwZWRJbnZlcnNlRWRpdE9wZXJhdGlvbnNbaV0ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGdyb3VwZWRJbnZlcnNlRWRpdE9wZXJhdGlvbnNbaV0uc29ydChtaW5vckJhc2VkU29ydGVyKTtcblx0XHRcdFx0XHRjdXJzb3JTZWxlY3Rpb25zW2ldID0gY29tbWFuZHNbaV0hLmNvbXB1dGVDdXJzb3JTdGF0ZShjdHgubW9kZWwsIHtcblx0XHRcdFx0XHRcdGdldEludmVyc2VFZGl0T3BlcmF0aW9uczogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ3JvdXBlZEludmVyc2VFZGl0T3BlcmF0aW9uc1tpXTtcblx0XHRcdFx0XHRcdH0sXG5cblx0XHRcdFx0XHRcdGdldFRyYWNrZWRTZWxlY3Rpb246IChpZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGlkeCA9IHBhcnNlSW50KGlkLCAxMCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJhbmdlID0gY3R4Lm1vZGVsLl9nZXRUcmFja2VkUmFuZ2UoY3R4LnRyYWNrZWRSYW5nZXNbaWR4XSkhO1xuXHRcdFx0XHRcdFx0XHRpZiAoY3R4LnRyYWNrZWRSYW5nZXNEaXJlY3Rpb25baWR4XSA9PT0gU2VsZWN0aW9uRGlyZWN0aW9uLkxUUikge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBuZXcgU2VsZWN0aW9uKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc3RhcnRDb2x1bW4sIHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24ocmFuZ2UuZW5kTGluZU51bWJlciwgcmFuZ2UuZW5kQ29sdW1uLCByYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjdXJzb3JTZWxlY3Rpb25zW2ldID0gY3R4LnNlbGVjdGlvbnNCZWZvcmVbaV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBjdXJzb3JTZWxlY3Rpb25zO1xuXHRcdH0pO1xuXHRcdGlmICghc2VsZWN0aW9uc0FmdGVyKSB7XG5cdFx0XHRzZWxlY3Rpb25zQWZ0ZXIgPSBjdHguc2VsZWN0aW9uc0JlZm9yZTtcblx0XHR9XG5cblx0XHQvLyBFeHRyYWN0IGxvc2luZyBjdXJzb3JzXG5cdFx0Y29uc3QgbG9zaW5nQ3Vyc29yczogbnVtYmVyW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGxvc2luZ0N1cnNvckluZGV4IGluIGxvc2VyQ3Vyc29yc01hcCkge1xuXHRcdFx0aWYgKGxvc2VyQ3Vyc29yc01hcC5oYXNPd25Qcm9wZXJ0eShsb3NpbmdDdXJzb3JJbmRleCkpIHtcblx0XHRcdFx0bG9zaW5nQ3Vyc29ycy5wdXNoKHBhcnNlSW50KGxvc2luZ0N1cnNvckluZGV4LCAxMCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNvcnQgbG9zaW5nIGN1cnNvcnMgZGVzY2VuZGluZ1xuXHRcdGxvc2luZ0N1cnNvcnMuc29ydCgoYTogbnVtYmVyLCBiOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuXHRcdFx0cmV0dXJuIGIgLSBhO1xuXHRcdH0pO1xuXG5cdFx0Ly8gUmVtb3ZlIGxvc2luZyBjdXJzb3JzXG5cdFx0Zm9yIChjb25zdCBsb3NpbmdDdXJzb3Igb2YgbG9zaW5nQ3Vyc29ycykge1xuXHRcdFx0c2VsZWN0aW9uc0FmdGVyLnNwbGljZShsb3NpbmdDdXJzb3IsIDEpO1xuXHRcdH1cblxuXHRcdHJldHVybiBzZWxlY3Rpb25zQWZ0ZXI7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfYXJyYXlJc0VtcHR5KGNvbW1hbmRzOiAoZWRpdG9yQ29tbW9uLklDb21tYW5kIHwgbnVsbClbXSk6IGJvb2xlYW4ge1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjb21tYW5kcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0aWYgKGNvbW1hbmRzW2ldKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZ2V0RWRpdE9wZXJhdGlvbnMoY3R4OiBJRXhlY0NvbnRleHQsIGNvbW1hbmRzOiAoZWRpdG9yQ29tbW9uLklDb21tYW5kIHwgbnVsbClbXSk6IElDb21tYW5kc0RhdGEge1xuXHRcdGxldCBvcGVyYXRpb25zOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGxldCBoYWRUcmFja2VkRWRpdE9wZXJhdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGNvbW1hbmRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gY29tbWFuZHNbaV07XG5cdFx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0XHRjb25zdCByID0gdGhpcy5fZ2V0RWRpdE9wZXJhdGlvbnNGcm9tQ29tbWFuZChjdHgsIGksIGNvbW1hbmQpO1xuXHRcdFx0XHRvcGVyYXRpb25zID0gb3BlcmF0aW9ucy5jb25jYXQoci5vcGVyYXRpb25zKTtcblx0XHRcdFx0aGFkVHJhY2tlZEVkaXRPcGVyYXRpb24gPSBoYWRUcmFja2VkRWRpdE9wZXJhdGlvbiB8fCByLmhhZFRyYWNrZWRFZGl0T3BlcmF0aW9uO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0b3BlcmF0aW9uczogb3BlcmF0aW9ucyxcblx0XHRcdGhhZFRyYWNrZWRFZGl0T3BlcmF0aW9uOiBoYWRUcmFja2VkRWRpdE9wZXJhdGlvblxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZ2V0RWRpdE9wZXJhdGlvbnNGcm9tQ29tbWFuZChjdHg6IElFeGVjQ29udGV4dCwgbWFqb3JJZGVudGlmaWVyOiBudW1iZXIsIGNvbW1hbmQ6IGVkaXRvckNvbW1vbi5JQ29tbWFuZCk6IElDb21tYW5kRGF0YSB7XG5cdFx0Ly8gVGhpcyBtZXRob2QgYWN0cyBhcyBhIHRyYW5zYWN0aW9uLCBpZiB0aGUgY29tbWFuZCBmYWlsc1xuXHRcdC8vIGV2ZXJ5dGhpbmcgaXQgaGFzIGRvbmUgaXMgaWdub3JlZFxuXHRcdGNvbnN0IG9wZXJhdGlvbnM6IElJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0bGV0IG9wZXJhdGlvbk1pbm9yID0gMDtcblxuXHRcdGNvbnN0IGFkZEVkaXRPcGVyYXRpb24gPSAocmFuZ2U6IElSYW5nZSwgdGV4dDogc3RyaW5nIHwgbnVsbCwgZm9yY2VNb3ZlTWFya2VyczogYm9vbGVhbiA9IGZhbHNlKSA9PiB7XG5cdFx0XHRpZiAoUmFuZ2UuaXNFbXB0eShyYW5nZSkgJiYgdGV4dCA9PT0gJycpIHtcblx0XHRcdFx0Ly8gVGhpcyBjb21tYW5kIHdhbnRzIHRvIGFkZCBhIG5vLW9wID0+IG5vIHRoYW5rIHlvdVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRvcGVyYXRpb25zLnB1c2goe1xuXHRcdFx0XHRpZGVudGlmaWVyOiB7XG5cdFx0XHRcdFx0bWFqb3I6IG1ham9ySWRlbnRpZmllcixcblx0XHRcdFx0XHRtaW5vcjogb3BlcmF0aW9uTWlub3IrK1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyYW5nZTogcmFuZ2UsXG5cdFx0XHRcdHRleHQ6IHRleHQsXG5cdFx0XHRcdGZvcmNlTW92ZU1hcmtlcnM6IGZvcmNlTW92ZU1hcmtlcnMsXG5cdFx0XHRcdGlzQXV0b1doaXRlc3BhY2VFZGl0OiBjb21tYW5kLmluc2VydHNBdXRvV2hpdGVzcGFjZVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdGxldCBoYWRUcmFja2VkRWRpdE9wZXJhdGlvbiA9IGZhbHNlO1xuXHRcdGNvbnN0IGFkZFRyYWNrZWRFZGl0T3BlcmF0aW9uID0gKHNlbGVjdGlvbjogSVJhbmdlLCB0ZXh0OiBzdHJpbmcgfCBudWxsLCBmb3JjZU1vdmVNYXJrZXJzPzogYm9vbGVhbikgPT4ge1xuXHRcdFx0aGFkVHJhY2tlZEVkaXRPcGVyYXRpb24gPSB0cnVlO1xuXHRcdFx0YWRkRWRpdE9wZXJhdGlvbihzZWxlY3Rpb24sIHRleHQsIGZvcmNlTW92ZU1hcmtlcnMpO1xuXHRcdH07XG5cblx0XHRjb25zdCB0cmFja1NlbGVjdGlvbiA9IChfc2VsZWN0aW9uOiBJU2VsZWN0aW9uLCB0cmFja1ByZXZpb3VzT25FbXB0eT86IGJvb2xlYW4pID0+IHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IFNlbGVjdGlvbi5saWZ0U2VsZWN0aW9uKF9zZWxlY3Rpb24pO1xuXHRcdFx0bGV0IHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3M7XG5cdFx0XHRpZiAoc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRpZiAodHlwZW9mIHRyYWNrUHJldmlvdXNPbkVtcHR5ID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0XHRpZiAodHJhY2tQcmV2aW91c09uRW1wdHkpIHtcblx0XHRcdFx0XHRcdHN0aWNraW5lc3MgPSBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHN0aWNraW5lc3MgPSBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gVHJ5IHRvIGxvY2sgaXQgd2l0aCBzdXJyb3VuZGluZyB0ZXh0XG5cdFx0XHRcdFx0Y29uc3QgbWF4TGluZUNvbHVtbiA9IGN0eC5tb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChzZWxlY3Rpb24uc3RhcnRDb2x1bW4gPT09IG1heExpbmVDb2x1bW4pIHtcblx0XHRcdFx0XHRcdHN0aWNraW5lc3MgPSBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHN0aWNraW5lc3MgPSBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHN0aWNraW5lc3MgPSBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcztcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbCA9IGN0eC50cmFja2VkUmFuZ2VzLmxlbmd0aDtcblx0XHRcdGNvbnN0IGlkID0gY3R4Lm1vZGVsLl9zZXRUcmFja2VkUmFuZ2UobnVsbCwgc2VsZWN0aW9uLCBzdGlja2luZXNzKTtcblx0XHRcdGN0eC50cmFja2VkUmFuZ2VzW2xdID0gaWQ7XG5cdFx0XHRjdHgudHJhY2tlZFJhbmdlc0RpcmVjdGlvbltsXSA9IHNlbGVjdGlvbi5nZXREaXJlY3Rpb24oKTtcblx0XHRcdHJldHVybiBsLnRvU3RyaW5nKCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGVkaXRPcGVyYXRpb25CdWlsZGVyOiBlZGl0b3JDb21tb24uSUVkaXRPcGVyYXRpb25CdWlsZGVyID0ge1xuXHRcdFx0YWRkRWRpdE9wZXJhdGlvbjogYWRkRWRpdE9wZXJhdGlvbixcblx0XHRcdGFkZFRyYWNrZWRFZGl0T3BlcmF0aW9uOiBhZGRUcmFja2VkRWRpdE9wZXJhdGlvbixcblx0XHRcdHRyYWNrU2VsZWN0aW9uOiB0cmFja1NlbGVjdGlvblxuXHRcdH07XG5cblx0XHR0cnkge1xuXHRcdFx0Y29tbWFuZC5nZXRFZGl0T3BlcmF0aW9ucyhjdHgubW9kZWwsIGVkaXRPcGVyYXRpb25CdWlsZGVyKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHQvLyBUT0RPQEFsZXggdXNlIG5vdGlmaWNhdGlvbiBzZXJ2aWNlIGlmIHRoaXMgc2hvdWxkIGJlIHVzZXIgZmFjaW5nXG5cdFx0XHQvLyBlLmZyaWVuZGx5TWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnY29ycnVwdC5jb21tYW5kcycsIFwiVW5leHBlY3RlZCBleGNlcHRpb24gd2hpbGUgZXhlY3V0aW5nIGNvbW1hbmQuXCIpO1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZSk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRvcGVyYXRpb25zOiBbXSxcblx0XHRcdFx0aGFkVHJhY2tlZEVkaXRPcGVyYXRpb246IGZhbHNlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcGVyYXRpb25zOiBvcGVyYXRpb25zLFxuXHRcdFx0aGFkVHJhY2tlZEVkaXRPcGVyYXRpb246IGhhZFRyYWNrZWRFZGl0T3BlcmF0aW9uXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9nZXRMb3NlckN1cnNvck1hcChvcGVyYXRpb25zOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXSk6IHsgW2luZGV4OiBzdHJpbmddOiBib29sZWFuIH0ge1xuXHRcdC8vIFRoaXMgaXMgZGVzdHJ1Y3RpdmUgb24gdGhlIGFycmF5XG5cdFx0b3BlcmF0aW9ucyA9IG9wZXJhdGlvbnMuc2xpY2UoMCk7XG5cblx0XHQvLyBTb3J0IG9wZXJhdGlvbnMgd2l0aCBsYXN0IG9uZSBmaXJzdFxuXHRcdG9wZXJhdGlvbnMuc29ydCgoYTogSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uLCBiOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb24pOiBudW1iZXIgPT4ge1xuXHRcdFx0Ly8gTm90ZSB0aGUgbWludXMhXG5cdFx0XHRyZXR1cm4gLShSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdFbmRzKGEucmFuZ2UsIGIucmFuZ2UpKTtcblx0XHR9KTtcblxuXHRcdC8vIE9wZXJhdGlvbnMgY2FuIG5vdCBvdmVybGFwIVxuXHRcdGNvbnN0IGxvc2VyQ3Vyc29yc01hcDogeyBbaW5kZXg6IHN0cmluZ106IGJvb2xlYW4gfSA9IHt9O1xuXG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBvcGVyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBwcmV2aW91c09wID0gb3BlcmF0aW9uc1tpIC0gMV07XG5cdFx0XHRjb25zdCBjdXJyZW50T3AgPSBvcGVyYXRpb25zW2ldO1xuXG5cdFx0XHRpZiAoUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbihwcmV2aW91c09wLnJhbmdlKS5pc0JlZm9yZShSYW5nZS5nZXRFbmRQb3NpdGlvbihjdXJyZW50T3AucmFuZ2UpKSkge1xuXG5cdFx0XHRcdGxldCBsb3Nlck1ham9yOiBudW1iZXI7XG5cblx0XHRcdFx0aWYgKHByZXZpb3VzT3AuaWRlbnRpZmllciEubWFqb3IgPiBjdXJyZW50T3AuaWRlbnRpZmllciEubWFqb3IpIHtcblx0XHRcdFx0XHQvLyBwcmV2aW91c09wIGxvc2VzIHRoZSBiYXR0bGVcblx0XHRcdFx0XHRsb3Nlck1ham9yID0gcHJldmlvdXNPcC5pZGVudGlmaWVyIS5tYWpvcjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsb3Nlck1ham9yID0gY3VycmVudE9wLmlkZW50aWZpZXIhLm1ham9yO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bG9zZXJDdXJzb3JzTWFwW2xvc2VyTWFqb3IudG9TdHJpbmcoKV0gPSB0cnVlO1xuXG5cdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDwgb3BlcmF0aW9ucy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdGlmIChvcGVyYXRpb25zW2pdLmlkZW50aWZpZXIhLm1ham9yID09PSBsb3Nlck1ham9yKSB7XG5cdFx0XHRcdFx0XHRvcGVyYXRpb25zLnNwbGljZShqLCAxKTtcblx0XHRcdFx0XHRcdGlmIChqIDwgaSkge1xuXHRcdFx0XHRcdFx0XHRpLS07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRqLS07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGkgPiAwKSB7XG5cdFx0XHRcdFx0aS0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxvc2VyQ3Vyc29yc01hcDtcblx0fVxufVxuXG5jbGFzcyBDb21wb3NpdGlvbkxpbmVTdGF0ZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB0ZXh0OiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGxpbmVOdW1iZXI6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc3RhcnRTZWxlY3Rpb25PZmZzZXQ6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZW5kU2VsZWN0aW9uT2Zmc2V0OiBudW1iZXJcblx0KSB7IH1cbn1cblxuY2xhc3MgQ29tcG9zaXRpb25TdGF0ZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWw6IENvbXBvc2l0aW9uTGluZVN0YXRlW10gfCBudWxsO1xuXG5cdHByaXZhdGUgc3RhdGljIF9jYXB0dXJlKHRleHRNb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uczogU2VsZWN0aW9uW10pOiBDb21wb3NpdGlvbkxpbmVTdGF0ZVtdIHwgbnVsbCB7XG5cdFx0Y29uc3QgcmVzdWx0OiBDb21wb3NpdGlvbkxpbmVTdGF0ZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2Ygc2VsZWN0aW9ucykge1xuXHRcdFx0aWYgKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgIT09IHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRyZXN1bHQucHVzaChuZXcgQ29tcG9zaXRpb25MaW5lU3RhdGUoXG5cdFx0XHRcdHRleHRNb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKSxcblx0XHRcdFx0bGluZU51bWJlcixcblx0XHRcdFx0c2VsZWN0aW9uLnN0YXJ0Q29sdW1uIC0gMSxcblx0XHRcdFx0c2VsZWN0aW9uLmVuZENvbHVtbiAtIDFcblx0XHRcdCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0Y29uc3RydWN0b3IodGV4dE1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSkge1xuXHRcdHRoaXMuX29yaWdpbmFsID0gQ29tcG9zaXRpb25TdGF0ZS5fY2FwdHVyZSh0ZXh0TW9kZWwsIHNlbGVjdGlvbnMpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGluc2VydGVkIHRleHQgZHVyaW5nIHRoaXMgY29tcG9zaXRpb24uXG5cdCAqIElmIHRoZSBjb21wb3NpdGlvbiByZXN1bHRlZCBpbiBleGlzdGluZyB0ZXh0IGJlaW5nIGNoYW5nZWQgKGkuZS4gbm90IGEgcHVyZSBpbnNlcnRpb24pIGl0IHJldHVybnMgbnVsbC5cblx0ICovXG5cdGRlZHVjZU91dGNvbWUodGV4dE1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSk6IENvbXBvc2l0aW9uT3V0Y29tZVtdIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9vcmlnaW5hbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnQgPSBDb21wb3NpdGlvblN0YXRlLl9jYXB0dXJlKHRleHRNb2RlbCwgc2VsZWN0aW9ucyk7XG5cdFx0aWYgKCFjdXJyZW50KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX29yaWdpbmFsLmxlbmd0aCAhPT0gY3VycmVudC5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IENvbXBvc2l0aW9uT3V0Y29tZVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX29yaWdpbmFsLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRyZXN1bHQucHVzaChDb21wb3NpdGlvblN0YXRlLl9kZWR1Y2VPdXRjb21lKHRoaXMuX29yaWdpbmFsW2ldLCBjdXJyZW50W2ldKSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZGVkdWNlT3V0Y29tZShvcmlnaW5hbDogQ29tcG9zaXRpb25MaW5lU3RhdGUsIGN1cnJlbnQ6IENvbXBvc2l0aW9uTGluZVN0YXRlKTogQ29tcG9zaXRpb25PdXRjb21lIHtcblx0XHRjb25zdCBjb21tb25QcmVmaXggPSBNYXRoLm1pbihcblx0XHRcdG9yaWdpbmFsLnN0YXJ0U2VsZWN0aW9uT2Zmc2V0LFxuXHRcdFx0Y3VycmVudC5zdGFydFNlbGVjdGlvbk9mZnNldCxcblx0XHRcdHN0cmluZ3MuY29tbW9uUHJlZml4TGVuZ3RoKG9yaWdpbmFsLnRleHQsIGN1cnJlbnQudGV4dClcblx0XHQpO1xuXHRcdGNvbnN0IGNvbW1vblN1ZmZpeCA9IE1hdGgubWluKFxuXHRcdFx0b3JpZ2luYWwudGV4dC5sZW5ndGggLSBvcmlnaW5hbC5lbmRTZWxlY3Rpb25PZmZzZXQsXG5cdFx0XHRjdXJyZW50LnRleHQubGVuZ3RoIC0gY3VycmVudC5lbmRTZWxlY3Rpb25PZmZzZXQsXG5cdFx0XHRzdHJpbmdzLmNvbW1vblN1ZmZpeExlbmd0aChvcmlnaW5hbC50ZXh0LCBjdXJyZW50LnRleHQpXG5cdFx0KTtcblx0XHRjb25zdCBkZWxldGVkVGV4dCA9IG9yaWdpbmFsLnRleHQuc3Vic3RyaW5nKGNvbW1vblByZWZpeCwgb3JpZ2luYWwudGV4dC5sZW5ndGggLSBjb21tb25TdWZmaXgpO1xuXHRcdGNvbnN0IGluc2VydGVkVGV4dFN0YXJ0T2Zmc2V0ID0gY29tbW9uUHJlZml4O1xuXHRcdGNvbnN0IGluc2VydGVkVGV4dEVuZE9mZnNldCA9IGN1cnJlbnQudGV4dC5sZW5ndGggLSBjb21tb25TdWZmaXg7XG5cdFx0Y29uc3QgaW5zZXJ0ZWRUZXh0ID0gY3VycmVudC50ZXh0LnN1YnN0cmluZyhpbnNlcnRlZFRleHRTdGFydE9mZnNldCwgaW5zZXJ0ZWRUZXh0RW5kT2Zmc2V0KTtcblx0XHRjb25zdCBpbnNlcnRlZFRleHRSYW5nZSA9IG5ldyBSYW5nZShjdXJyZW50LmxpbmVOdW1iZXIsIGluc2VydGVkVGV4dFN0YXJ0T2Zmc2V0ICsgMSwgY3VycmVudC5saW5lTnVtYmVyLCBpbnNlcnRlZFRleHRFbmRPZmZzZXQgKyAxKTtcblx0XHRyZXR1cm4gbmV3IENvbXBvc2l0aW9uT3V0Y29tZShcblx0XHRcdGRlbGV0ZWRUZXh0LFxuXHRcdFx0b3JpZ2luYWwuc3RhcnRTZWxlY3Rpb25PZmZzZXQgLSBjb21tb25QcmVmaXgsXG5cdFx0XHRvcmlnaW5hbC5lbmRTZWxlY3Rpb25PZmZzZXQgLSBjb21tb25QcmVmaXgsXG5cdFx0XHRpbnNlcnRlZFRleHQsXG5cdFx0XHRjdXJyZW50LnN0YXJ0U2VsZWN0aW9uT2Zmc2V0IC0gY29tbW9uUHJlZml4LFxuXHRcdFx0Y3VycmVudC5lbmRTZWxlY3Rpb25PZmZzZXQgLSBjb21tb25QcmVmaXgsXG5cdFx0XHRpbnNlcnRlZFRleHRSYW5nZVxuXHRcdCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFlBQVksYUFBYTtBQUN6QixTQUFTLHdCQUF3QjtBQUNqQyxTQUE4QixhQUFhLHFCQUFxQix5QkFBb0Y7QUFDcEosU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBb0Isc0JBQXNCO0FBQ25ELFNBQVMsc0NBQXNDO0FBRS9DLFNBQVMsYUFBcUI7QUFDOUIsU0FBcUIsV0FBVywwQkFBMEI7QUFDMUQsWUFBWSxrQkFBa0I7QUFDOUIsU0FBcUIsOEJBQWdJO0FBQ3JKLFNBQVMsdUJBQXVCLHFDQUFzRTtBQUN0RyxTQUFTLG9CQUFvQiw2QkFBNkIsbUNBQW1DO0FBQzdGLFNBQVMsU0FBUyxrQkFBa0I7QUFFcEMsU0FBUywrQkFBeUQ7QUFFM0QsTUFBTSwwQkFBMEIsV0FBVztBQUFBLEVBZ0JqRCxZQUFZLE9BQW1CLFdBQStCLHNCQUE2QyxjQUFtQztBQUM3SSxVQUFNO0FBQ04sU0FBSyxTQUFTO0FBQ2QsU0FBSyx1QkFBdUIsS0FBSyxPQUFPLGFBQWE7QUFDckQsU0FBSyxhQUFhO0FB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
