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
import { ArrayQueue, pushMany } from "../../../base/common/arrays.js";
import { Color } from "../../../base/common/color.js";
import { BugIndicatingError, illegalArgument, onUnexpectedError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, MutableDisposable, combinedDisposable } from "../../../base/common/lifecycle.js";
import { listenStream } from "../../../base/common/stream.js";
import * as strings from "../../../base/common/strings.js";
import { Constants } from "../../../base/common/uint.js";
import { URI } from "../../../base/common/uri.js";
import { countEOL } from "../core/eolCounter.js";
import { normalizeIndentation } from "../core/indentation.js";
import { Position } from "../core/position.js";
import { Range } from "../core/range.js";
import { Selection } from "../core/selection.js";
import { EDITOR_MODEL_DEFAULTS } from "../core/textModelDefaults.js";
import { ILanguageService } from "../languages/language.js";
import { ILanguageConfigurationService } from "../languages/languageConfigurationRegistry.js";
import * as model from "../model.js";
import { BracketPairsTextModelPart } from "./bracketPairsTextModelPart/bracketPairsImpl.js";
import { ColorizedBracketPairsDecorationProvider } from "./bracketPairsTextModelPart/colorizedBracketPairsDecorationProvider.js";
import { EditStack } from "./editStack.js";
import { GuidesTextModelPart } from "./guidesTextModelPart.js";
import { guessIndentation } from "./indentationGuesser.js";
import { IntervalNode, IntervalTree, recomputeMaxEnd } from "./intervalTree.js";
import { PieceTreeTextBuffer } from "./pieceTreeTextBuffer/pieceTreeTextBuffer.js";
import { PieceTreeTextBufferBuilder } from "./pieceTreeTextBuffer/pieceTreeTextBufferBuilder.js";
import { SearchParams, TextModelSearch } from "./textModelSearch.js";
import { TokenizationTextModelPart } from "./tokenizationTextModelPart.js";
import { AttachedViews } from "./tokens.js";
import { InternalModelContentChangeEvent, LineInjectedText, ModelInjectedTextChangedEvent, ModelRawContentChangedEvent, ModelRawEOLChanged, ModelRawFlush, ModelRawLineChanged, ModelRawLinesDeleted, ModelRawLinesInserted } from "../textModelEvents.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { IUndoRedoService } from "../../../platform/undoRedo/common/undoRedo.js";
function createTextBufferFactory(text) {
  const builder = new PieceTreeTextBufferBuilder();
  builder.acceptChunk(text);
  return builder.finish();
}
function createTextBufferFactoryFromStream(stream) {
  return new Promise((resolve, reject) => {
    const builder = new PieceTreeTextBufferBuilder();
    let done = false;
    listenStream(stream, {
      onData: (chunk) => {
        builder.acceptChunk(typeof chunk === "string" ? chunk : chunk.toString());
      },
      onError: (error) => {
        if (!done) {
          done = true;
          reject(error);
        }
      },
      onEnd: () => {
        if (!done) {
          done = true;
          resolve(builder.finish());
        }
      }
    });
  });
}
function createTextBufferFactoryFromSnapshot(snapshot) {
  const builder = new PieceTreeTextBufferBuilder();
  let chunk;
  while (typeof (chunk = snapshot.read()) === "string") {
    builder.acceptChunk(chunk);
  }
  return builder.finish();
}
function createTextBuffer(value, defaultEOL) {
  let factory;
  if (typeof value === "string") {
    factory = createTextBufferFactory(value);
  } else if (model.isITextSnapshot(value)) {
    factory = createTextBufferFactoryFromSnapshot(value);
  } else {
    factory = value;
  }
  return factory.create(defaultEOL);
}
let MODEL_ID = 0;
const LIMIT_FIND_COUNT = 999;
const LONG_LINE_BOUNDARY = 1e4;
class TextModelSnapshot {
  constructor(source) {
    this._source = source;
    this._eos = false;
  }
  read() {
    if (this._eos) {
      return null;
    }
    const result = [];
    let resultCnt = 0;
    let resultLength = 0;
    do {
      const tmp = this._source.read();
      if (tmp === null) {
        this._eos = true;
        if (resultCnt === 0) {
          return null;
        } else {
          return result.join("");
        }
      }
      if (tmp.length > 0) {
        result[resultCnt++] = tmp;
        resultLength += tmp.length;
      }
      if (resultLength >= 64 * 1024) {
        return result.join("");
      }
    } while (true);
  }
}
const invalidFunc = () => {
  throw new Error(`Invalid change accessor`);
};
var StringOffsetValidationType = /* @__PURE__ */ ((StringOffsetValidationType2) => {
  StringOffsetValidationType2[StringOffsetValidationType2["Relaxed"] = 0] = "Relaxed";
  StringOffsetValidationType2[StringOffsetValidationType2["SurrogatePairs"] = 1] = "SurrogatePairs";
  return StringOffsetValidationType2;
})(StringOffsetValidationType || {});
let TextModel = class extends Disposable {
  constructor(source, languageIdOrSelection, creationOptions, associatedResource = null, _undoRedoService, _languageService, _languageConfigurationService, instantiationService) {
    super();
    this._undoRedoService = _undoRedoService;
    this._languageService = _languageService;
    this._languageConfigurationService = _languageConfigurationService;
    this.instantiationService = instantiationService;
    //#region Events
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._onDidChangeDecorations = this._register(new DidChangeDecorationsEmitter((affectedInjectedTextLines) => this.handleBeforeFireDecorationsChangedEvent(affectedInjectedTextLines)));
    this.onDidChangeDecorations = this._onDidChangeDecorations.event;
    this._onDidChangeOptions = this._register(new Emitter());
    this.onDidChangeOptions = this._onDidChangeOptions.event;
    this._onDidChangeAttached = this._register(new Emitter());
    this.onDidChangeAttached = this._onDidChangeAttached.event;
    this._onDidChangeInjectedText = this._register(new Emitter());
    this._eventEmitter = this._register(new DidChangeContentEmitter());
    this._languageSelectionListener = this._register(new MutableDisposable());
    this._deltaDecorationCallCnt = 0;
    this._attachedViews = new AttachedViews();
    MODEL_ID++;
    this.id = "$model" + MODEL_ID;
    this.isForSimpleWidget = creationOptions.isForSimpleWidget;
    if (typeof associatedResource === "undefined" || associatedResource === null) {
      this._associatedResource = URI.parse("inmemory://model/" + MODEL_ID);
    } else {
      this._associatedResource = associatedResource;
    }
    this._attachedEditorCount = 0;
    const { textBuffer, disposable } = createTextBuffer(source, creationOptions.defaultEOL);
    this._buffer = textBuffer;
    this._bufferDisposable = disposable;
    const bufferLineCount = this._buffer.getLineCount();
    const bufferTextLength = this._buffer.getValueLengthInRange(new Range(1, 1, bufferLineCount, this._buffer.getLineLength(bufferLineCount) + 1), model.EndOfLinePreference.TextDefined);
    if (creationOptions.largeFileOptimizations) {
      this._isTooLargeForTokenization = bufferTextLength > TextModel.LARGE_FILE_SIZE_THRESHOLD || bufferLineCount > TextModel.LARGE_FILE_LINE_COUNT_THRESHOLD;
      this._isTooLargeForHeapOperation = bufferTextLength > TextModel.LARGE_FILE_HEAP_OPERATION_THRESHOLD;
    } else {
      this._isTooLargeForTokenization = false;
      this._isTooLargeForHeapOperation = false;
    }
    this._options = TextModel.resolveOptions(this._buffer, creationOptions);
    const languageId = typeof languageIdOrSelection === "string" ? languageIdOrSelection : languageIdOrSelection.languageId;
    if (typeof languageIdOrSelection !== "string") {
      this._languageSelectionListener.value = languageIdOrSelection.onDidChange(() => this._setLanguage(languageIdOrSelection.languageId));
    }
    this._bracketPairs = this._register(new BracketPairsTextModelPart(this, this._languageConfigurationService));
    this._guidesTextModelPart = this._register(new GuidesTextModelPart(this, this._languageConfigurationService));
    this._decorationProvider = this._register(new ColorizedBracketPairsDecorationProvider(this));
    this._tokenizationTextModelPart = this.instantiationService.createInstance(
      TokenizationTextModelPart,
      this,
      this._bracketPairs,
      languageId,
      this._attachedViews
    );
    this._isTooLargeForSyncing = bufferTextLength > TextModel._MODEL_SYNC_LIMIT;
    this._versionId = 1;
    this._alternativeVersionId = 1;
    this._initialUndoRedoSnapshot = null;
    this._isDisposed = false;
    this.__isDisposing = false;
    this._instanceId = strings.singleLetterHash(MODEL_ID);
    this._lastDecorationId = 0;
    this._decorations = /* @__PURE__ */ Object.create(null);
    this._decorationsTree = new DecorationsTrees();
    this._commandManager = new EditStack(this, this._undoRedoService);
    this._isUndoing = false;
    this._isRedoing = false;
    this._trimAutoWhitespaceLines = null;
    this._register(this._decorationProvider.onDidChange(() => {
      this._onDidChangeDecorations.beginDeferredEmit();
      this._onDidChangeDecorations.fire();
      this._onDidChangeDecorations.endDeferredEmit();
    }));
    this._languageService.requestRichLanguageFeatures(languageId);
    this._register(this._languageConfigurationService.onDidChange((e) => {
      this._bracketPairs.handleLanguageConfigurationServiceChange(e);
      this._tokenizationTextModelPart.handleLanguageConfigurationServiceChange(e);
    }));
  }
  static resolveOptions(textBuffer, options) {
    if (options.detectIndentation) {
      const guessedIndentation = guessIndentation(textBuffer, options.tabSize, options.insertSpaces);
      return new model.TextModelResolvedOptions({
        tabSize: guessedIndentation.tabSize,
        indentSize: "tabSize",
        // TODO@Alex: guess indentSize independent of tabSize
        insertSpaces: guessedIndentation.insertSpaces,
        trimAutoWhitespace: options.trimAutoWhitespace,
        defaultEOL: options.defaultEOL,
        bracketPairColorizationOptions: options.bracketPairColorizationOptions
      });
    }
    return new model.TextModelResolvedOptions(options);
  }
  get onDidChangeLanguage() {
    return this._tokenizationTextModelPart.onDidChangeLanguage;
  }
  get onDidChangeLanguageConfiguration() {
    return this._tokenizationTextModelPart.onDidChangeLanguageConfiguration;
  }
  get onDidChangeTokens() {
    return this._tokenizationTextModelPart.onDidChangeTokens;
  }
  onDidChangeContent(listener) {
    return this._eventEmitter.slowEvent((e) => listener(e.contentChangedEvent));
  }
  onDidChangeContentOrInjectedText(listener) {
    return combinedDisposable(
      this._eventEmitter.fastEvent((e) => listener(e)),
      this._onDidChangeInjectedText.event((e) => listener(e))
    );
  }
  _isDisposing() {
    return this.__isDisposing;
  }
  get tokenization() {
    return this._tokenizationTextModelPart;
  }
  get bracketPairs() {
    return this._bracketPairs;
  }
  get guides() {
    return this._guidesTextModelPart;
  }
  dispose() {
    this.__isDisposing = true;
    this._onWillDispose.fire();
    this._tokenizationTextModelPart.dispose();
    this._isDisposed = true;
    super.dispose();
    this._bufferDisposable.dispose();
    this.__isDisposing = false;
    const emptyDisposedTextBuffer = new PieceTreeTextBuffer([], "", "\n", false, false, true, true);
    emptyDisposedTextBuffer.dispose();
    this._buffer = emptyDisposedTextBuffer;
    this._bufferDisposable = Disposable.None;
  }
  _hasListeners() {
    return this._onWillDispose.hasListeners() || this._onDidChangeDecorations.hasListeners() || this._tokenizationTextModelPart._hasListeners() || this._onDidChangeOptions.hasListeners() || this._onDidChangeAttached.hasListeners() || this._onDidChangeInjectedText.hasListeners() || this._eventEmitter.hasListeners();
  }
  _assertNotDisposed() {
    if (this._isDisposed) {
      throw new BugIndicatingError("Model is disposed!");
    }
  }
  equalsTextBuffer(other) {
    this._assertNotDisposed();
    return this._buffer.equals(other);
  }
  getTextBuffer() {
    this._assertNotDisposed();
    return this._buffer;
  }
  _emitContentChangedEvent(rawChange, change) {
    if (this.__isDisposing) {
      return;
    }
    this._tokenizationTextModelPart.handleDidChangeContent(change);
    this._bracketPairs.handleDidChangeContent(change);
    this._eventEmitter.fire(new InternalModelContentChangeEvent(rawChange, change));
  }
  setValue(value) {
    this._assertNotDisposed();
    if (value === null || value === void 0) {
      throw illegalArgument();
    }
    const { textBuffer, disposable } = createTextBuffer(value, this._options.defaultEOL);
    this._setValueFromTextBuffer(textBuffer, disposable);
  }
  _createContentChanged2(range, rangeOffset, rangeLength, rangeEndPosition, text, isUndoing, isRedoing, isFlush, isEolChange) {
    return {
      changes: [{
        range,
        rangeOffset,
        rangeLength,
        text
      }],
      eol: this._buffer.getEOL(),
      isEolChange,
      versionId: this.getVersionId(),
      isUndoing,
      isRedoing,
      isFlush
    };
  }
  _setValueFromTextBuffer(textBuffer, textBufferDisposable) {
    this._assertNotDisposed();
    const oldFullModelRange = this.getFullModelRange();
    const oldModelValueLength = this.getValueLengthInRange(oldFullModelRange);
    const endLineNumber = this.getLineCount();
    const endColumn = this.getLineMaxColumn(endLineNumber);
    this._buffer = textBuffer;
    this._bufferDisposable.dispose();
    this._bufferDisposable = textBufferDisposable;
    this._increaseVersionId();
    this._decorations = /* @__PURE__ */ Object.create(null);
    this._decorationsTree = new DecorationsTrees();
    this._commandManager.clear();
    this._trimAutoWhitespaceLines = null;
    this._emitContentChangedEvent(
      new ModelRawContentChangedEvent(
        [
          new ModelRawFlush()
        ],
        this._versionId,
        false,
        false
      ),
      this._createContentChanged2(new Range(1, 1, endLineNumber, endColumn), 0, oldModelValueLength, new Position(endLineNumber, endColumn), this.getValue(), false, false, true, false)
    );
  }
  setEOL(eol) {
    this._assertNotDisposed();
    const newEOL = eol === model.EndOfLineSequence.CRLF ? "\r\n" : "\n";
    if (this._buffer.getEOL() === newEOL) {
      return;
    }
    const oldFullModelRange = this.getFullModelRange();
    const oldModelValueLength = this.getValueLengthInRange(oldFullModelRange);
    const endLineNumber = this.getLineCount();
    const endColumn = this.getLineMaxColumn(endLineNumber);
    this._onBeforeEOLChange();
    this._buffer.setEOL(newEOL);
    this._increaseVersionId();
    this._onAfterEOLChange();
    this._emitContentChangedEvent(
      new ModelRawContentChangedEvent(
        [
          new ModelRawEOLChanged()
        ],
        this._versionId,
        false,
        false
      ),
      this._createContentChanged2(new Range(1, 1, endLineNumber, endColumn), 0, oldModelValueLength, new Position(endLineNumber, endColumn), this.getValue(), false, false, false, true)
    );
  }
  _onBeforeEOLChange() {
    this._decorationsTree.ensureAllNodesHaveRanges(this);
  }
  _onAfterEOLChange() {
    const versionId = this.getVersionId();
    const allDecorations = this._decorationsTree.collectNodesPostOrder();
    for (let i = 0, len = allDecorations.length; i < len; i++) {
      const node = allDecorations[i];
      const range = node.range;
      const delta = node.cachedAbsoluteStart - node.start;
      const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
      const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
      node.cachedAbsoluteStart = startOffset;
      node.cachedAbsoluteEnd = endOffset;
      node.cachedVersionId = versionId;
      node.start = startOffset - delta;
      node.end = endOffset - delta;
      recomputeMaxEnd(node);
    }
  }
  onBeforeAttached() {
    this._attachedEditorCount++;
    if (this._attachedEditorCount === 1) {
      this._tokenizationTextModelPart.handleDidChangeAttached();
      this._onDidChangeAttached.fire(void 0);
    }
    return this._attachedViews.attachView();
  }
  onBeforeDetached(view) {
    this._attachedEditorCount--;
    if (this._attachedEditorCount === 0) {
      this._tokenizationTextModelPart.handleDidChangeAttached();
      this._onDidChangeAttached.fire(void 0);
    }
    this._attachedViews.detachView(view);
  }
  isAttachedToEditor() {
    return this._attachedEditorCount > 0;
  }
  getAttachedEditorCount() {
    return this._attachedEditorCount;
  }
  isTooLargeForSyncing() {
    return this._isTooLargeForSyncing;
  }
  isTooLargeForTokenization() {
    return this._isTooLargeForTokenization;
  }
  isTooLargeForHeapOperation() {
    return this._isTooLargeForHeapOperation;
  }
  isDisposed() {
    return this._isDisposed;
  }
  isDominatedByLongLines() {
    this._assertNotDisposed();
    if (this.isTooLargeForTokenization()) {
      return false;
    }
    let smallLineCharCount = 0;
    let longLineCharCount = 0;
    const lineCount = this._buffer.getLineCount();
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      const lineLength = this._buffer.getLineLength(lineNumber);
      if (lineLength >= LONG_LINE_BOUNDARY) {
        longLineCharCount += lineLength;
      } else {
        smallLineCharCount += lineLength;
      }
    }
    return longLineCharCount > smallLineCharCount;
  }
  get uri() {
    return this._associatedResource;
  }
  //#region Options
  getOptions() {
    this._assertNotDisposed();
    return this._options;
  }
  getFormattingOptions() {
    return {
      tabSize: this._options.indentSize,
      insertSpaces: this._options.insertSpaces
    };
  }
  updateOptions(_newOpts) {
    this._assertNotDisposed();
    const tabSize = typeof _newOpts.tabSize !== "undefined" ? _newOpts.tabSize : this._options.tabSize;
    const indentSize = typeof _newOpts.indentSize !== "undefined" ? _newOpts.indentSize : this._options.originalIndentSize;
    const insertSpaces = typeof _newOpts.insertSpaces !== "undefined" ? _newOpts.insertSpaces : this._options.insertSpaces;
    const trimAutoWhitespace = typeof _newOpts.trimAutoWhitespace !== "undefined" ? _newOpts.trimAutoWhitespace : this._options.trimAutoWhitespace;
    const bracketPairColorizationOptions = typeof _newOpts.bracketColorizationOptions !== "undefined" ? _newOpts.bracketColorizationOptions : this._options.bracketPairColorizationOptions;
    const newOpts = new model.TextModelResolvedOptions({
      tabSize,
      indentSize,
      insertSpaces,
      defaultEOL: this._options.defaultEOL,
      trimAutoWhitespace,
      bracketPairColorizationOptions
    });
    if (this._options.equals(newOpts)) {
      return;
    }
    const e = this._options.createChangeEvent(newOpts);
    this._options = newOpts;
    this._bracketPairs.handleDidChangeOptions(e);
    this._decorationProvider.handleDidChangeOptions(e);
    this._onDidChangeOptions.fire(e);
  }
  detectIndentation(defaultInsertSpaces, defaultTabSize) {
    this._assertNotDisposed();
    const guessedIndentation = guessIndentation(this._buffer, defaultTabSize, defaultInsertSpaces);
    this.updateOptions({
      insertSpaces: guessedIndentation.insertSpaces,
      tabSize: guessedIndentation.tabSize,
      indentSize: guessedIndentation.tabSize
      // TODO@Alex: guess indentSize independent of tabSize
    });
  }
  normalizeIndentation(str) {
    this._assertNotDisposed();
    return normalizeIndentation(str, this._options.indentSize, this._options.insertSpaces);
  }
  //#endregion
  //#region Reading
  getVersionId() {
    this._assertNotDisposed();
    return this._versionId;
  }
  mightContainRTL() {
    return this._buffer.mightContainRTL();
  }
  mightContainUnusualLineTerminators() {
    return this._buffer.mightContainUnusualLineTerminators();
  }
  removeUnusualLineTerminators(selections = null) {
    const matches = this.findMatches(strings.UNUSUAL_LINE_TERMINATORS.source, false, true, false, null, false, Constants.MAX_SAFE_SMALL_INTEGER);
    this._buffer.resetMightContainUnusualLineTerminators();
    this.pushEditOperations(selections, matches.map((m) => ({ range: m.range, text: null })), () => null);
  }
  mightContainNonBasicASCII() {
    return this._buffer.mightContainNonBasicASCII();
  }
  getAlternativeVersionId() {
    this._assertNotDisposed();
    return this._alternativeVersionId;
  }
  getInitialUndoRedoSnapshot() {
    this._assertNotDisposed();
    return this._initialUndoRedoSnapshot;
  }
  getOffsetAt(rawPosition) {
    this._assertNotDisposed();
    const position = this._validatePosition(rawPosition.lineNumber, rawPosition.column, 0 /* Relaxed */);
    return this._buffer.getOffsetAt(position.lineNumber, position.column);
  }
  getPositionAt(rawOffset) {
    this._assertNotDisposed();
    const offset = Math.min(this._buffer.getLength(), Math.max(0, rawOffset));
    return this._buffer.getPositionAt(offset);
  }
  _increaseVersionId() {
    this._versionId = this._versionId + 1;
    this._alternativeVersionId = this._versionId;
  }
  _overwriteVersionId(versionId) {
    this._versionId = versionId;
  }
  _overwriteAlternativeVersionId(newAlternativeVersionId) {
    this._alternativeVersionId = newAlternativeVersionId;
  }
  _overwriteInitialUndoRedoSnapshot(newInitialUndoRedoSnapshot) {
    this._initialUndoRedoSnapshot = newInitialUndoRedoSnapshot;
  }
  getValue(eol, preserveBOM = false) {
    this._assertNotDisposed();
    if (this.isTooLargeForHeapOperation()) {
      throw new BugIndicatingError("Operation would exceed heap memory limits");
    }
    const fullModelRange = this.getFullModelRange();
    const fullModelValue = this.getValueInRange(fullModelRange, eol);
    if (preserveBOM) {
      return this._buffer.getBOM() + fullModelValue;
    }
    return fullModelValue;
  }
  createSnapshot(preserveBOM = false) {
    return new TextModelSnapshot(this._buffer.createSnapshot(preserveBOM));
  }
  getValueLength(eol, preserveBOM = false) {
    this._assertNotDisposed();
    const fullModelRange = this.getFullModelRange();
    const fullModelValue = this.getValueLengthInRange(fullModelRange, eol);
    if (preserveBOM) {
      return this._buffer.getBOM().length + fullModelValue;
    }
    return fullModelValue;
  }
  getValueInRange(rawRange, eol = model.EndOfLinePreference.TextDefined) {
    this._assertNotDisposed();
    return this._buffer.getValueInRange(this.validateRange(rawRange), eol);
  }
  getValueLengthInRange(rawRange, eol = model.EndOfLinePreference.TextDefined) {
    this._assertNotDisposed();
    return this._buffer.getValueLengthInRange(this.validateRange(rawRange), eol);
  }
  getCharacterCountInRange(rawRange, eol = model.EndOfLinePreference.TextDefined) {
    this._assertNotDisposed();
    return this._buffer.getCharacterCountInRange(this.validateRange(rawRange), eol);
  }
  getLineCount() {
    this._assertNotDisposed();
    return this._buffer.getLineCount();
  }
  getLineContent(lineNumber) {
    this._assertNotDisposed();
    if (lineNumber < 1 || lineNumber > this.getLineCount()) {
      throw new BugIndicatingError("Illegal value for lineNumber");
    }
    return this._buffer.getLineContent(lineNumber);
  }
  getLineLength(lineNumber) {
    this._assertNotDisposed();
    if (lineNumber < 1 || lineNumber > this.getLineCount()) {
      throw new BugIndicatingError("Illegal value for lineNumber");
    }
    return this._buffer.getLineLength(lineNumber);
  }
  getLinesContent() {
    this._assertNotDisposed();
    if (this.isTooLargeForHeapOperation()) {
      throw new BugIndicatingError("Operation would exceed heap memory limits");
    }
    return this._buffer.getLinesContent();
  }
  getEOL() {
    this._assertNotDisposed();
    return this._buffer.getEOL();
  }
  getEndOfLineSequence() {
    this._assertNotDisposed();
    return this._buffer.getEOL() === "\n" ? model.EndOfLineSequence.LF : model.EndOfLineSequence.CRLF;
  }
  getLineMinColumn(lineNumber) {
    this._assertNotDisposed();
    return 1;
  }
  getLineMaxColumn(lineNumber) {
    this._assertNotDisposed();
    if (lineNumber < 1 || lineNumber > this.getLineCount()) {
      throw new BugIndicatingError("Illegal value for lineNumber");
    }
    return this._buffer.getLineLength(lineNumber) + 1;
  }
  getLineFirstNonWhitespaceColumn(lineNumber) {
    this._assertNotDisposed();
    if (lineNumber < 1 || lineNumber > this.getLineCount()) {
      throw new BugIndicatingError("Illegal value for lineNumber");
    }
    return this._buffer.getLineFirstNonWhitespaceColumn(lineNumber);
  }
  getLineLastNonWhitespaceColumn(lineNumber) {
    this._assertNotDisposed();
    if (lineNumber < 1 || lineNumber > this.getLineCount()) {
      throw new BugIndicatingError("Illegal value for lineNumber");
    }
    return this._buffer.getLineLastNonWhitespaceColumn(lineNumber);
  }
  /**
   * Validates `range` is within buffer bounds, but allows it to sit in between surrogate pairs, etc.
   * Will try to not allocate if possible.
   */
  _validateRangeRelaxedNoAllocations(range) {
    const linesCount = this._buffer.getLineCount();
    const initialStartLineNumber = range.startLineNumber;
    const initialStartColumn = range.startColumn;
    let startLineNumber = Math.floor(typeof initialStartLineNumber === "number" && !isNaN(initialStartLineNumber) ? initialStartLineNumber : 1);
    let startColumn = Math.floor(typeof initialStartColumn === "number" && !isNaN(initialStartColumn) ? initialStartColumn : 1);
    if (startLineNumber < 1) {
      startLineNumber = 1;
      startColumn = 1;
    } else if (startLineNumber > linesCount) {
      startLineNumber = linesCount;
      startColumn = this.getLineMaxColumn(startLineNumber);
    } else {
      if (startColumn <= 1) {
        startColumn = 1;
      } else {
        const maxColumn = this.getLineMaxColumn(startLineNumber);
        if (startColumn >= maxColumn) {
          startColumn = maxColumn;
        }
      }
    }
    const initialEndLineNumber = range.endLineNumber;
    const initialEndColumn = range.endColumn;
    let endLineNumber = Math.floor(typeof initialEndLineNumber === "number" && !isNaN(initialEndLineNumber) ? initialEndLineNumber : 1);
    let endColumn = Math.floor(typeof initialEndColumn === "number" && !isNaN(initialEndColumn) ? initialEndColumn : 1);
    if (endLineNumber < 1) {
      endLineNumber = 1;
      endColumn = 1;
    } else if (endLineNumber > linesCount) {
      endLineNumber = linesCount;
      endColumn = this.getLineMaxColumn(endLineNumber);
    } else {
      if (endColumn <= 1) {
        endColumn = 1;
      } else {
        const maxColumn = this.getLineMaxColumn(endLineNumber);
        if (endColumn >= maxColumn) {
          endColumn = maxColumn;
        }
      }
    }
    if (initialStartLineNumber === startLineNumber && initialStartColumn === startColumn && initialEndLineNumber === endLineNumber && initialEndColumn === endColumn && range instanceof Range && !(range instanceof Selection)) {
      return range;
    }
    return new Range(startLineNumber, startColumn, endLineNumber, endColumn);
  }
  _isValidPosition(lineNumber, column, validationType) {
    if (typeof lineNumber !== "number" || typeof column !== "number") {
      return false;
    }
    if (isNaN(lineNumber) || isNaN(column)) {
      return false;
    }
    if (lineNumber < 1 || column < 1) {
      return false;
    }
    if ((lineNumber | 0) !== lineNumber || (column | 0) !== column) {
      return false;
    }
    const lineCount = this._buffer.getLineCount();
    if (lineNumber > lineCount) {
      return false;
    }
    if (column === 1) {
      return true;
    }
    const maxColumn = this.getLineMaxColumn(lineNumber);
    if (column > maxColumn) {
      return false;
    }
    if (validationType === 1 /* SurrogatePairs */) {
      const charCodeBefore = this._buffer.getLineCharCode(lineNumber, column - 2);
      if (strings.isHighSurrogate(charCodeBefore)) {
        return false;
      }
    }
    return true;
  }
  _validatePosition(_lineNumber, _column, validationType) {
    const lineNumber = Math.floor(typeof _lineNumber === "number" && !isNaN(_lineNumber) ? _lineNumber : 1);
    const column = Math.floor(typeof _column === "number" && !isNaN(_column) ? _column : 1);
    const lineCount = this._buffer.getLineCount();
    if (lineNumber < 1) {
      return new Position(1, 1);
    }
    if (lineNumber > lineCount) {
      return new Position(lineCount, this.getLineMaxColumn(lineCount));
    }
    if (column <= 1) {
      return new Position(lineNumber, 1);
    }
    const maxColumn = this.getLineMaxColumn(lineNumber);
    if (column >= maxColumn) {
      return new Position(lineNumber, maxColumn);
    }
    if (validationType === 1 /* SurrogatePairs */) {
      const charCodeBefore = this._buffer.getLineCharCode(lineNumber, column - 2);
      if (strings.isHighSurrogate(charCodeBefore)) {
        return new Position(lineNumber, column - 1);
      }
    }
    return new Position(lineNumber, column);
  }
  validatePosition(position) {
    const validationType = 1 /* SurrogatePairs */;
    this._assertNotDisposed();
    if (position instanceof Position) {
      if (this._isValidPosition(position.lineNumber, position.column, validationType)) {
        return position;
      }
    }
    return this._validatePosition(position.lineNumber, position.column, validationType);
  }
  isValidRange(range) {
    return this._isValidRange(range, 1 /* SurrogatePairs */);
  }
  _isValidRange(range, validationType) {
    const startLineNumber = range.startLineNumber;
    const startColumn = range.startColumn;
    const endLineNumber = range.endLineNumber;
    const endColumn = range.endColumn;
    if (!this._isValidPosition(startLineNumber, startColumn, 0 /* Relaxed */)) {
      return false;
    }
    if (!this._isValidPosition(endLineNumber, endColumn, 0 /* Relaxed */)) {
      return false;
    }
    if (validationType === 1 /* SurrogatePairs */) {
      const charCodeBeforeStart = startColumn > 1 ? this._buffer.getLineCharCode(startLineNumber, startColumn - 2) : 0;
      const charCodeBeforeEnd = endColumn > 1 && endColumn <= this._buffer.getLineLength(endLineNumber) ? this._buffer.getLineCharCode(endLineNumber, endColumn - 2) : 0;
      const startInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeStart);
      const endInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeEnd);
      if (!startInsideSurrogatePair && !endInsideSurrogatePair) {
        return true;
      }
      return false;
    }
    return true;
  }
  validateRange(_range) {
    const validationType = 1 /* SurrogatePairs */;
    this._assertNotDisposed();
    if (_range instanceof Range && !(_range instanceof Selection)) {
      if (this._isValidRange(_range, validationType)) {
        return _range;
      }
    }
    const start = this._validatePosition(_range.startLineNumber, _range.startColumn, 0 /* Relaxed */);
    const end = this._validatePosition(_range.endLineNumber, _range.endColumn, 0 /* Relaxed */);
    const startLineNumber = start.lineNumber;
    const startColumn = start.column;
    const endLineNumber = end.lineNumber;
    const endColumn = end.column;
    if (validationType === 1 /* SurrogatePairs */) {
      const charCodeBeforeStart = startColumn > 1 ? this._buffer.getLineCharCode(startLineNumber, startColumn - 2) : 0;
      const charCodeBeforeEnd = endColumn > 1 && endColumn <= this._buffer.getLineLength(endLineNumber) ? this._buffer.getLineCharCode(endLineNumber, endColumn - 2) : 0;
      const startInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeStart);
      const endInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeEnd);
      if (!startInsideSurrogatePair && !endInsideSurrogatePair) {
        return new Range(startLineNumber, startColumn, endLineNumber, endColumn);
      }
      if (startLineNumber === endLineNumber && startColumn === endColumn) {
        return new Range(startLineNumber, startColumn - 1, endLineNumber, endColumn - 1);
      }
      if (startInsideSurrogatePair && endInsideSurrogatePair) {
        return new Range(startLineNumber, startColumn - 1, endLineNumber, endColumn + 1);
      }
      if (startInsideSurrogatePair) {
        return new Range(startLineNumber, startColumn - 1, endLineNumber, endColumn);
      }
      return new Range(startLineNumber, startColumn, endLineNumber, endColumn + 1);
    }
    return new Range(startLineNumber, startColumn, endLineNumber, endColumn);
  }
  modifyPosition(rawPosition, offset) {
    this._assertNotDisposed();
    const candidate = this.getOffsetAt(rawPosition) + offset;
    return this.getPositionAt(Math.min(this._buffer.getLength(), Math.max(0, candidate)));
  }
  getFullModelRange() {
    this._assertNotDisposed();
    const lineCount = this.getLineCount();
    return new Range(1, 1, lineCount, this.getLineMaxColumn(lineCount));
  }
  findMatchesLineByLine(searchRange, searchData, captureMatches, limitResultCount) {
    return this._buffer.findMatchesLineByLine(searchRange, searchData, captureMatches, limitResultCount);
  }
  findMatches(searchString, rawSearchScope, isRegex, matchCase, wordSeparators, captureMatches, limitResultCount = LIMIT_FIND_COUNT) {
    this._assertNotDisposed();
    let searchRanges = null;
    if (rawSearchScope !== null) {
      if (!Array.isArray(rawSearchScope)) {
        rawSearchScope = [rawSearchScope];
      }
      if (rawSearchScope.every((searchScope) => Range.isIRange(searchScope))) {
        searchRanges = rawSearchScope.map((searchScope) => this.validateRange(searchScope));
      }
    }
    if (searchRanges === null) {
      searchRanges = [this.getFullModelRange()];
    }
    searchRanges = searchRanges.sort((d1, d2) => d1.startLineNumber - d2.startLineNumber || d1.startColumn - d2.startColumn);
    const uniqueSearchRanges = [];
    uniqueSearchRanges.push(searchRanges.reduce((prev, curr) => {
      if (Range.areIntersecting(prev, curr)) {
        return prev.plusRange(curr);
      }
      uniqueSearchRanges.push(prev);
      return curr;
    }));
    let matchMapper;
    if (!isRegex && searchString.indexOf("\n") < 0) {
      const searchParams = new SearchParams(searchString, isRegex, matchCase, wordSeparators);
      const searchData = searchParams.parseSearchRequest();
      if (!searchData) {
        return [];
      }
      matchMapper = (searchRange) => this.findMatchesLineByLine(searchRange, searchData, captureMatches, limitResultCount);
    } else {
      matchMapper = (searchRange) => TextModelSearch.findMatches(this, new SearchParams(searchString, isRegex, matchCase, wordSeparators), searchRange, captureMatches, limitResultCount);
    }
    return uniqueSearchRanges.map(matchMapper).reduce((arr, matches) => arr.concat(matches), []);
  }
  findNextMatch(searchString, rawSearchStart, isRegex, matchCase, wordSeparators, captureMatches) {
    this._assertNotDisposed();
    const searchStart = this.validatePosition(rawSearchStart);
    if (!isRegex && searchString.indexOf("\n") < 0) {
      const searchParams = new SearchParams(searchString, isRegex, matchCase, wordSeparators);
      const searchData = searchParams.parseSearchRequest();
      if (!searchData) {
        return null;
      }
      const lineCount = this.getLineCount();
      let searchRange = new Range(searchStart.lineNumber, searchStart.column, lineCount, this.getLineMaxColumn(lineCount));
      let ret = this.findMatchesLineByLine(searchRange, searchData, captureMatches, 1);
      TextModelSearch.findNextMatch(this, new SearchParams(searchString, isRegex, matchCase, wordSeparators), searchStart, captureMatches);
      if (ret.length > 0) {
        return ret[0];
      }
      searchRange = new Range(1, 1, searchStart.lineNumber, this.getLineMaxColumn(searchStart.lineNumber));
      ret = this.findMatchesLineByLine(searchRange, searchData, captureMatches, 1);
      if (ret.length > 0) {
        return ret[0];
      }
      return null;
    }
    return TextModelSearch.findNextMatch(this, new SearchParams(searchString, isRegex, matchCase, wordSeparators), searchStart, captureMatches);
  }
  findPreviousMatch(searchString, rawSearchStart, isRegex, matchCase, wordSeparators, captureMatches) {
    this._assertNotDisposed();
    const searchStart = this.validatePosition(rawSearchStart);
    return TextModelSearch.findPreviousMatch(this, new SearchParams(searchString, isRegex, matchCase, wordSeparators), searchStart, captureMatches);
  }
  //#endregion
  //#region Editing
  pushStackElement() {
    this._commandManager.pushStackElement();
  }
  popStackElement() {
    this._commandManager.popStackElement();
  }
  pushEOL(eol) {
    const currentEOL = this.getEOL() === "\n" ? model.EndOfLineSequence.LF : model.EndOfLineSequence.CRLF;
    if (currentEOL === eol) {
      return;
    }
    try {
      this._onDidChangeDecorations.beginDeferredEmit();
      this._eventEmitter.beginDeferredEmit();
      if (this._initialUndoRedoSnapshot === null) {
        this._initialUndoRedoSnapshot = this._undoRedoService.createSnapshot(this.uri);
      }
      this._commandManager.pushEOL(eol);
    } finally {
      this._eventEmitter.endDeferredEmit();
      this._onDidChangeDecorations.endDeferredEmit();
    }
  }
  _validateEditOperation(rawOperation) {
    if (rawOperation instanceof model.ValidAnnotatedEditOperation) {
      return rawOperation;
    }
    return new model.ValidAnnotatedEditOperation(
      rawOperation.identifier || null,
      this.validateRange(rawOperation.range),
      rawOperation.text,
      rawOperation.forceMoveMarkers || false,
      rawOperation.isAutoWhitespaceEdit || false,
      rawOperation._isTracked || false
    );
  }
  _validateEditOperations(rawOperations) {
    const result = [];
    for (let i = 0, len = rawOperations.length; i < len; i++) {
      result[i] = this._validateEditOperation(rawOperations[i]);
    }
    return result;
  }
  pushEditOperations(beforeCursorState, editOperations, cursorStateComputer, group) {
    try {
      this._onDidChangeDecorations.beginDeferredEmit();
      this._eventEmitter.beginDeferredEmit();
      return this._pushEditOperations(beforeCursorState, this._validateEditOperations(editOperations), cursorStateComputer, group);
    } finally {
      this._eventEmitter.endDeferredEmit();
      this._onDidChangeDecorations.endDeferredEmit();
    }
  }
  _pushEditOperations(beforeCursorState, editOperations, cursorStateComputer, group) {
    if (this._options.trimAutoWhitespace && this._trimAutoWhitespaceLines) {
      const incomingEdits = editOperations.map((op) => {
        return {
          range: this.validateRange(op.range),
          text: op.text
        };
      });
      let editsAreNearCursors = true;
      if (beforeCursorState) {
        for (let i = 0, len = beforeCursorState.length; i < len; i++) {
          const sel = beforeCursorState[i];
          let foundEditNearSel = false;
          for (let j = 0, lenJ = incomingEdits.length; j < lenJ; j++) {
            const editRange = incomingEdits[j].range;
            const selIsAbove = editRange.startLineNumber > sel.endLineNumber;
            const selIsBelow = sel.startLineNumber > editRange.endLineNumber;
            if (!selIsAbove && !selIsBelow) {
              foundEditNearSel = true;
              break;
            }
          }
          if (!foundEditNearSel) {
            editsAreNearCursors = false;
            break;
          }
        }
      }
      if (editsAreNearCursors) {
        for (let i = 0, len = this._trimAutoWhitespaceLines.length; i < len; i++) {
          const trimLineNumber = this._trimAutoWhitespaceLines[i];
          const maxLineColumn = this.getLineMaxColumn(trimLineNumber);
          let allowTrimLine = true;
          for (let j = 0, lenJ = incomingEdits.length; j < lenJ; j++) {
            const editRange = incomingEdits[j].range;
            const editText = incomingEdits[j].text;
            if (trimLineNumber < editRange.startLineNumber || trimLineNumber > editRange.endLineNumber) {
              continue;
            }
            if (trimLineNumber === editRange.startLineNumber && editRange.startColumn === maxLineColumn && editRange.isEmpty() && editText && editText.length > 0 && editText.charAt(0) === "\n") {
              continue;
            }
            if (trimLineNumber === editRange.startLineNumber && editRange.startColumn === 1 && editRange.isEmpty() && editText && editText.length > 0 && editText.charAt(editText.length - 1) === "\n") {
              continue;
            }
            allowTrimLine = false;
            break;
          }
          if (allowTrimLine) {
            const trimRange = new Range(trimLineNumber, 1, trimLineNumber, maxLineColumn);
            editOperations.push(new model.ValidAnnotatedEditOperation(null, trimRange, null, false, false, false));
          }
        }
      }
      this._trimAutoWhitespaceLines = null;
    }
    if (this._initialUndoRedoSnapshot === null) {
      this._initialUndoRedoSnapshot = this._undoRedoService.createSnapshot(this.uri);
    }
    return this._commandManager.pushEditOperation(beforeCursorState, editOperations, cursorStateComputer, group);
  }
  _applyUndo(changes, eol, resultingAlternativeVersionId, resultingSelection) {
    const edits = changes.map((change) => {
      const rangeStart = this.getPositionAt(change.newPosition);
      const rangeEnd = this.getPositionAt(change.newEnd);
      return {
        range: new Range(rangeStart.lineNumber, rangeStart.column, rangeEnd.lineNumber, rangeEnd.column),
        text: change.oldText
      };
    });
    this._applyUndoRedoEdits(edits, eol, true, false, resultingAlternativeVersionId, resultingSelection);
  }
  _applyRedo(changes, eol, resultingAlternativeVersionId, resultingSelection) {
    const edits = changes.map((change) => {
      const rangeStart = this.getPositionAt(change.oldPosition);
      const rangeEnd = this.getPositionAt(change.oldEnd);
      return {
        range: new Range(rangeStart.lineNumber, rangeStart.column, rangeEnd.lineNumber, rangeEnd.column),
        text: change.newText
      };
    });
    this._applyUndoRedoEdits(edits, eol, false, true, resultingAlternativeVersionId, resultingSelection);
  }
  _applyUndoRedoEdits(edits, eol, isUndoing, isRedoing, resultingAlternativeVersionId, resultingSelection) {
    try {
      this._onDidChangeDecorations.beginDeferredEmit();
      this._eventEmitter.beginDeferredEmit();
      this._isUndoing = isUndoing;
      this._isRedoing = isRedoing;
      this.applyEdits(edits, false);
      this.setEOL(eol);
      this._overwriteAlternativeVersionId(resultingAlternativeVersionId);
    } finally {
      this._isUndoing = false;
      this._isRedoing = false;
      this._eventEmitter.endDeferredEmit(resultingSelection);
      this._onDidChangeDecorations.endDeferredEmit();
    }
  }
  applyEdits(rawOperations, computeUndoEdits = false) {
    try {
      this._onDidChangeDecorations.beginDeferredEmit();
      this._eventEmitter.beginDeferredEmit();
      const operations = this._validateEditOperations(rawOperations);
      return this._doApplyEdits(operations, computeUndoEdits);
    } finally {
      this._eventEmitter.endDeferredEmit();
      this._onDidChangeDecorations.endDeferredEmit();
    }
  }
  _doApplyEdits(rawOperations, computeUndoEdits) {
    const oldLineCount = this._buffer.getLineCount();
    const result = this._buffer.applyEdits(rawOperations, this._options.trimAutoWhitespace, computeUndoEdits);
    const newLineCount = this._buffer.getLineCount();
    const contentChanges = result.changes;
    this._trimAutoWhitespaceLines = result.trimAutoWhitespaceLineNumbers;
    if (contentChanges.length !== 0) {
      for (let i = 0, len = contentChanges.length; i < len; i++) {
        const change = contentChanges[i];
        this._decorationsTree.acceptReplace(change.rangeOffset, change.rangeLength, change.text.length, change.forceMoveMarkers);
      }
      const rawContentChanges = [];
      this._increaseVersionId();
      let lineCount = oldLineCount;
      for (let i = 0, len = contentChanges.length; i < len; i++) {
        const change = contentChanges[i];
        const [eolCount] = countEOL(change.text);
        this._onDidChangeDecorations.fire();
        const startLineNumber = change.range.startLineNumber;
        const endLineNumber = change.range.endLineNumber;
        const deletingLinesCnt = endLineNumber - startLineNumber;
        const insertingLinesCnt = eolCount;
        const editingLinesCnt = Math.min(deletingLinesCnt, insertingLinesCnt);
        const changeLineCountDelta = insertingLinesCnt - deletingLinesCnt;
        const currentEditStartLineNumber = newLineCount - lineCount - changeLineCountDelta + startLineNumber;
        const firstEditLineNumber = currentEditStartLineNumber;
        const lastInsertedLineNumber = currentEditStartLineNumber + insertingLinesCnt;
        const decorationsWithInjectedTextInEditedRange = this._decorationsTree.getInjectedTextInInterval(
          this,
          this.getOffsetAt(new Position(firstEditLineNumber, 1)),
          this.getOffsetAt(new Position(lastInsertedLineNumber, this.getLineMaxColumn(lastInsertedLineNumber))),
          0
        );
        const injectedTextInEditedRange = LineInjectedText.fromDecorations(decorationsWithInjectedTextInEditedRange);
        const injectedTextInEditedRangeQueue = new ArrayQueue(injectedTextInEditedRange);
        for (let j = editingLinesCnt; j >= 0; j--) {
          const editLineNumber = startLineNumber + j;
          const currentEditLineNumber = currentEditStartLineNumber + j;
          injectedTextInEditedRangeQueue.takeFromEndWhile((r) => r.lineNumber > currentEditLineNumber);
          const decorationsInCurrentLine = injectedTextInEditedRangeQueue.takeFromEndWhile((r) => r.lineNumber === currentEditLineNumber);
          rawContentChanges.push(
            new ModelRawLineChanged(
              editLineNumber,
              this.getLineContent(currentEditLineNumber),
              decorationsInCurrentLine
            )
          );
        }
        if (editingLinesCnt < deletingLinesCnt) {
          const spliceStartLineNumber = startLineNumber + editingLinesCnt;
          rawContentChanges.push(new ModelRawLinesDeleted(spliceStartLineNumber + 1, endLineNumber));
        }
        if (editingLinesCnt < insertingLinesCnt) {
          const injectedTextInEditedRangeQueue2 = new ArrayQueue(injectedTextInEditedRange);
          const spliceLineNumber = startLineNumber + editingLinesCnt;
          const cnt = insertingLinesCnt - editingLinesCnt;
          const fromLineNumber = newLineCount - lineCount - cnt + spliceLineNumber + 1;
          const injectedTexts = [];
          const newLines = [];
          for (let i2 = 0; i2 < cnt; i2++) {
            const lineNumber = fromLineNumber + i2;
            newLines[i2] = this.getLineContent(lineNumber);
            injectedTextInEditedRangeQueue2.takeWhile((r) => r.lineNumber < lineNumber);
            injectedTexts[i2] = injectedTextInEditedRangeQueue2.takeWhile((r) => r.lineNumber === lineNumber);
          }
          rawContentChanges.push(
            new ModelRawLinesInserted(
              spliceLineNumber + 1,
              startLineNumber + insertingLinesCnt,
              newLines,
              injectedTexts
            )
          );
        }
        lineCount += changeLineCountDelta;
      }
      this._emitContentChangedEvent(
        new ModelRawContentChangedEvent(
          rawContentChanges,
          this.getVersionId(),
          this._isUndoing,
          this._isRedoing
        ),
        {
          changes: contentChanges,
          eol: this._buffer.getEOL(),
          isEolChange: false,
          versionId: this.getVersionId(),
          isUndoing: this._isUndoing,
          isRedoing: this._isRedoing,
          isFlush: false
        }
      );
    }
    return result.reverseEdits === null ? void 0 : result.reverseEdits;
  }
  undo() {
    return this._undoRedoService.undo(this.uri);
  }
  canUndo() {
    return this._undoRedoService.canUndo(this.uri);
  }
  redo() {
    return this._undoRedoService.redo(this.uri);
  }
  canRedo() {
    return this._undoRedoService.canRedo(this.uri);
  }
  //#endregion
  //#region Decorations
  handleBeforeFireDecorationsChangedEvent(affectedInjectedTextLines) {
    if (affectedInjectedTextLines === null || affectedInjectedTextLines.size === 0) {
      return;
    }
    const affectedLines = Array.from(affectedInjectedTextLines);
    const lineChangeEvents = affectedLines.map((lineNumber) => new ModelRawLineChanged(lineNumber, this.getLineContent(lineNumber), this._getInjectedTextInLine(lineNumber)));
    this._onDidChangeInjectedText.fire(new ModelInjectedTextChangedEvent(lineChangeEvents));
  }
  changeDecorations(callback, ownerId = 0) {
    this._assertNotDisposed();
    try {
      this._onDidChangeDecorations.beginDeferredEmit();
      return this._changeDecorations(ownerId, callback);
    } finally {
      this._onDidChangeDecorations.endDeferredEmit();
    }
  }
  _changeDecorations(ownerId, callback) {
    const changeAccessor = {
      addDecoration: (range, options) => {
        return this._deltaDecorationsImpl(ownerId, [], [{ range, options }])[0];
      },
      changeDecoration: (id, newRange) => {
        this._changeDecorationImpl(id, newRange);
      },
      changeDecorationOptions: (id, options) => {
        this._changeDecorationOptionsImpl(id, _normalizeOptions(options));
      },
      removeDecoration: (id) => {
        this._deltaDecorationsImpl(ownerId, [id], []);
      },
      deltaDecorations: (oldDecorations, newDecorations) => {
        if (oldDecorations.length === 0 && newDecorations.length === 0) {
          return [];
        }
        return this._deltaDecorationsImpl(ownerId, oldDecorations, newDecorations);
      }
    };
    let result = null;
    try {
      result = callback(changeAccessor);
    } catch (e) {
      onUnexpectedError(e);
    }
    changeAccessor.addDecoration = invalidFunc;
    changeAccessor.changeDecoration = invalidFunc;
    changeAccessor.changeDecorationOptions = invalidFunc;
    changeAccessor.removeDecoration = invalidFunc;
    changeAccessor.deltaDecorations = invalidFunc;
    return result;
  }
  deltaDecorations(oldDecorations, newDecorations, ownerId = 0) {
    this._assertNotDisposed();
    if (!oldDecorations) {
      oldDecorations = [];
    }
    if (oldDecorations.length === 0 && newDecorations.length === 0) {
      return [];
    }
    try {
      this._deltaDecorationCallCnt++;
      if (this._deltaDecorationCallCnt > 1) {
        console.warn(`Invoking deltaDecorations recursively could lead to leaking decorations.`);
        onUnexpectedError(new Error(`Invoking deltaDecorations recursively could lead to leaking decorations.`));
      }
      this._onDidChangeDecorations.beginDeferredEmit();
      return this._deltaDecorationsImpl(ownerId, oldDecorations, newDecorations);
    } finally {
      this._onDidChangeDecorations.endDeferredEmit();
      this._deltaDecorationCallCnt--;
    }
  }
  _getTrackedRange(id) {
    return this.getDecorationRange(id);
  }
  _setTrackedRange(id, newRange, newStickiness) {
    const node = id ? this._decorations[id] : null;
    if (!node) {
      if (!newRange) {
        return null;
      }
      return this._deltaDecorationsImpl(0, [], [{ range: newRange, options: TRACKED_RANGE_OPTIONS[newStickiness] }], true)[0];
    }
    if (!newRange) {
      this._decorationsTree.delete(node);
      delete this._decorations[node.id];
      return null;
    }
    const range = this._validateRangeRelaxedNoAllocations(newRange);
    const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
    const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
    this._decorationsTree.delete(node);
    node.reset(this.getVersionId(), startOffset, endOffset, range);
    node.setOptions(TRACKED_RANGE_OPTIONS[newStickiness]);
    this._decorationsTree.insert(node);
    return node.id;
  }
  removeAllDecorationsWithOwnerId(ownerId) {
    if (this._isDisposed) {
      return;
    }
    const nodes = this._decorationsTree.collectNodesFromOwner(ownerId);
    for (let i = 0, len = nodes.length; i < len; i++) {
      const node = nodes[i];
      this._decorationsTree.delete(node);
      delete this._decorations[node.id];
    }
  }
  getDecorationOptions(decorationId) {
    const node = this._decorations[decorationId];
    if (!node) {
      return null;
    }
    return node.options;
  }
  getDecorationRange(decorationId) {
    const node = this._decorations[decorationId];
    if (!node) {
      return null;
    }
    return this._decorationsTree.getNodeRange(this, node);
  }
  getLineDecorations(lineNumber, ownerId = 0, filterOutValidation = false) {
    if (lineNumber < 1 || lineNumber > this.getLineCount()) {
      return [];
    }
    return this.getLinesDecorations(lineNumber, lineNumber, ownerId, filterOutValidation);
  }
  getLinesDecorations(_startLineNumber, _endLineNumber, ownerId = 0, filterOutValidation = false, onlyMarginDecorations = false) {
    const lineCount = this.getLineCount();
    const startLineNumber = Math.min(lineCount, Math.max(1, _startLineNumber));
    const endLineNumber = Math.min(lineCount, Math.max(1, _endLineNumber));
    const endColumn = this.getLineMaxColumn(endLineNumber);
    const range = new Range(startLineNumber, 1, endLineNumber, endColumn);
    const decorations = this._getDecorationsInRange(range, ownerId, filterOutValidation, onlyMarginDecorations);
    pushMany(decorations, this._decorationProvider.getDecorationsInRange(range, ownerId, filterOutValidation));
    return decorations;
  }
  getDecorationsInRange(range, ownerId = 0, filterOutValidation = false, onlyMinimapDecorations = false, onlyMarginDecorations = false) {
    const validatedRange = this.validateRange(range);
    const decorations = this._getDecorationsInRange(validatedRange, ownerId, filterOutValidation, onlyMarginDecorations);
    pushMany(decorations, this._decorationProvider.getDecorationsInRange(validatedRange, ownerId, filterOutValidation, onlyMinimapDecorations));
    return decorations;
  }
  getOverviewRulerDecorations(ownerId = 0, filterOutValidation = false) {
    return this._decorationsTree.getAll(this, ownerId, filterOutValidation, true, false);
  }
  getInjectedTextDecorations(ownerId = 0) {
    return this._decorationsTree.getAllInjectedText(this, ownerId);
  }
  _getInjectedTextInLine(lineNumber) {
    const startOffset = this._buffer.getOffsetAt(lineNumber, 1);
    const endOffset = startOffset + this._buffer.getLineLength(lineNumber);
    const result = this._decorationsTree.getInjectedTextInInterval(this, startOffset, endOffset, 0);
    return LineInjectedText.fromDecorations(result).filter((t) => t.lineNumber === lineNumber);
  }
  getAllDecorations(ownerId = 0, filterOutValidation = false) {
    let result = this._decorationsTree.getAll(this, ownerId, filterOutValidation, false, false);
    result = result.concat(this._decorationProvider.getAllDecorations(ownerId, filterOutValidation));
    return result;
  }
  getAllMarginDecorations(ownerId = 0) {
    return this._decorationsTree.getAll(this, ownerId, false, false, true);
  }
  _getDecorationsInRange(filterRange, filterOwnerId, filterOutValidation, onlyMarginDecorations) {
    const startOffset = this._buffer.getOffsetAt(filterRange.startLineNumber, filterRange.startColumn);
    const endOffset = this._buffer.getOffsetAt(filterRange.endLineNumber, filterRange.endColumn);
    return this._decorationsTree.getAllInInterval(this, startOffset, endOffset, filterOwnerId, filterOutValidation, onlyMarginDecorations);
  }
  getRangeAt(start, end) {
    return this._buffer.getRangeAt(start, end - start);
  }
  _changeDecorationImpl(decorationId, _range) {
    const node = this._decorations[decorationId];
    if (!node) {
      return;
    }
    if (node.options.after) {
      const oldRange = this.getDecorationRange(decorationId);
      this._onDidChangeDecorations.recordLineAffectedByInjectedText(oldRange.endLineNumber);
    }
    if (node.options.before) {
      const oldRange = this.getDecorationRange(decorationId);
      this._onDidChangeDecorations.recordLineAffectedByInjectedText(oldRange.startLineNumber);
    }
    const range = this._validateRangeRelaxedNoAllocations(_range);
    const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
    const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
    this._decorationsTree.delete(node);
    node.reset(this.getVersionId(), startOffset, endOffset, range);
    this._decorationsTree.insert(node);
    this._onDidChangeDecorations.checkAffectedAndFire(node.options);
    if (node.options.after) {
      this._onDidChangeDecorations.recordLineAffectedByInjectedText(range.endLineNumber);
    }
    if (node.options.before) {
      this._onDidChangeDecorations.recordLineAffectedByInjectedText(range.startLineNumber);
    }
  }
  _changeDecorationOptionsImpl(decorationId, options) {
    const node = this._decorations[decorationId];
    if (!node) {
      return;
    }
    const nodeWasInOverviewRuler = node.options.overviewRuler && node.options.overviewRuler.color ? true : false;
    const nodeIsInOverviewRuler = options.overviewRuler && options.overviewRuler.color ? true : false;
    this._onDidChangeDecorations.checkAffectedAndFire(node.options);
    this._onDidChangeDecorations.checkAffectedAndFire(options);
    if (node.options.after || options.after) {
      const nodeRange = this._decorationsTree.getNodeRange(this, node);
      this._onDidChangeDecorations.recordLineAffectedByInjectedText(nodeRange.endLineNumber);
    }
    if (node.options.before || options.before) {
      const nodeRange = this._decorationsTree.getNodeRange(this, node);
      this._onDidChangeDecorations.recordLineAffectedByInjectedText(nodeRange.startLineNumber);
    }
    const movedInOverviewRuler = nodeWasInOverviewRuler !== nodeIsInOverviewRuler;
    const changedWhetherInjectedText = isOptionsInjectedText(options) !== isNodeInjectedText(node);
    if (movedInOverviewRuler || changedWhetherInjectedText) {
      this._decorationsTree.delete(node);
      node.setOptions(options);
      this._decorationsTree.insert(node);
    } else {
      node.setOptions(options);
    }
  }
  _deltaDecorationsImpl(ownerId, oldDecorationsIds, newDecorations, suppressEvents = false) {
    const versionId = this.getVersionId();
    const oldDecorationsLen = oldDecorationsIds.length;
    let oldDecorationIndex = 0;
    const newDecorationsLen = newDecorations.length;
    let newDecorationIndex = 0;
    this._onDidChangeDecorations.beginDeferredEmit();
    try {
      const result = new Array(newDecorationsLen);
      while (oldDecorationIndex < oldDecorationsLen || newDecorationIndex < newDecorationsLen) {
        let node = null;
        if (oldDecorationIndex < oldDecorationsLen) {
          do {
            node = this._decorations[oldDecorationsIds[oldDecorationIndex++]];
          } while (!node && oldDecorationIndex < oldDecorationsLen);
          if (node) {
            if (node.options.after) {
              const nodeRange = this._decorationsTree.getNodeRange(this, node);
              this._onDidChangeDecorations.recordLineAffectedByInjectedText(nodeRange.endLineNumber);
            }
            if (node.options.before) {
              const nodeRange = this._decorationsTree.getNodeRange(this, node);
              this._onDidChangeDecorations.recordLineAffectedByInjectedText(nodeRange.startLineNumber);
            }
            this._decorationsTree.delete(node);
            if (!suppressEvents) {
              this._onDidChangeDecorations.checkAffectedAndFire(node.options);
            }
          }
        }
        if (newDecorationIndex < newDecorationsLen) {
          if (!node) {
            const internalDecorationId = ++this._lastDecorationId;
            const decorationId = `${this._instanceId};${internalDecorationId}`;
            node = new IntervalNode(decorationId, 0, 0);
            this._decorations[decorationId] = node;
          }
          const newDecoration = newDecorations[newDecorationIndex];
          const range = this._validateRangeRelaxedNoAllocations(newDecoration.range);
          const options = _normalizeOptions(newDecoration.options);
          const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
          const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
          node.ownerId = ownerId;
          node.reset(versionId, startOffset, endOffset, range);
          node.setOptions(options);
          if (node.options.after) {
            this._onDidChangeDecorations.recordLineAffectedByInjectedText(range.endLineNumber);
          }
          if (node.options.before) {
            this._onDidChangeDecorations.recordLineAffectedByInjectedText(range.startLineNumber);
          }
          if (!suppressEvents) {
            this._onDidChangeDecorations.checkAffectedAndFire(options);
          }
          this._decorationsTree.insert(node);
          result[newDecorationIndex] = node.id;
          newDecorationIndex++;
        } else {
          if (node) {
            delete this._decorations[node.id];
          }
        }
      }
      return result;
    } finally {
      this._onDidChangeDecorations.endDeferredEmit();
    }
  }
  //#endregion
  //#region Tokenization
  // TODO move them to the tokenization part.
  getLanguageId() {
    return this.tokenization.getLanguageId();
  }
  setLanguage(languageIdOrSelection, source) {
    if (typeof languageIdOrSelection === "string") {
      this._languageSelectionListener.clear();
      this._setLanguage(languageIdOrSelection, source);
    } else {
      this._languageSelectionListener.value = languageIdOrSelection.onDidChange(() => this._setLanguage(languageIdOrSelection.languageId, source));
      this._setLanguage(languageIdOrSelection.languageId, source);
    }
  }
  _setLanguage(languageId, source) {
    this.tokenization.setLanguageId(languageId, source);
    this._languageService.requestRichLanguageFeatures(languageId);
  }
  getLanguageIdAtPosition(lineNumber, column) {
    return this.tokenization.getLanguageIdAtPosition(lineNumber, column);
  }
  getWordAtPosition(position) {
    return this._tokenizationTextModelPart.getWordAtPosition(position);
  }
  getWordUntilPosition(position) {
    return this._tokenizationTextModelPart.getWordUntilPosition(position);
  }
  //#endregion
  normalizePosition(position, affinity) {
    return position;
  }
  /**
   * Gets the column at which indentation stops at a given line.
   * @internal
  */
  getLineIndentColumn(lineNumber) {
    return indentOfLine(this.getLineContent(lineNumber)) + 1;
  }
  toString() {
    return `TextModel(${this.uri.toString()})`;
  }
};
TextModel._MODEL_SYNC_LIMIT = 50 * 1024 * 1024;
// 50 MB,  // used in tests
TextModel.LARGE_FILE_SIZE_THRESHOLD = 20 * 1024 * 1024;
// 20 MB;
TextModel.LARGE_FILE_LINE_COUNT_THRESHOLD = 300 * 1e3;
// 300K lines
TextModel.LARGE_FILE_HEAP_OPERATION_THRESHOLD = 256 * 1024 * 1024;
// 256M characters, usually ~> 512MB memory usage
TextModel.DEFAULT_CREATION_OPTIONS = {
  isForSimpleWidget: false,
  tabSize: EDITOR_MODEL_DEFAULTS.tabSize,
  indentSize: EDITOR_MODEL_DEFAULTS.indentSize,
  insertSpaces: EDITOR_MODEL_DEFAULTS.insertSpaces,
  detectIndentation: false,
  defaultEOL: model.DefaultEndOfLine.LF,
  trimAutoWhitespace: EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
  largeFileOptimizations: EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
  bracketPairColorizationOptions: EDITOR_MODEL_DEFAULTS.bracketPairColorizationOptions
};
TextModel = __decorateClass([
  __decorateParam(4, IUndoRedoService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, ILanguageConfigurationService),
  __decorateParam(7, IInstantiationService)
], TextModel);
function indentOfLine(line) {
  let indent = 0;
  for (const c of line) {
    if (c === " " || c === "	") {
      indent++;
    } else {
      break;
    }
  }
  return indent;
}
function isNodeInOverviewRuler(node) {
  return node.options.overviewRuler && node.options.overviewRuler.color ? true : false;
}
function isOptionsInjectedText(options) {
  return !!options.after || !!options.before;
}
function isNodeInjectedText(node) {
  return !!node.options.after || !!node.options.before;
}
class DecorationsTrees {
  constructor() {
    this._decorationsTree0 = new IntervalTree();
    this._decorationsTree1 = new IntervalTree();
    this._injectedTextDecorationsTree = new IntervalTree();
  }
  ensureAllNodesHaveRanges(host) {
    this.getAll(host, 0, false, false, false);
  }
  _ensureNodesHaveRanges(host, nodes) {
    for (const node of nodes) {
      if (node.range === null) {
        node.range = host.getRangeAt(node.cachedAbsoluteStart, node.cachedAbsoluteEnd);
      }
    }
    return nodes;
  }
  getAllInInterval(host, start, end, filterOwnerId, filterOutValidation, onlyMarginDecorations) {
    const versionId = host.getVersionId();
    const result = this._intervalSearch(start, end, filterOwnerId, filterOutValidation, versionId, onlyMarginDecorations);
    return this._ensureNodesHaveRanges(host, result);
  }
  _intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations) {
    const r0 = this._decorationsTree0.intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
    const r1 = this._decorationsTree1.intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
    const r2 = this._injectedTextDecorationsTree.intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
    return r0.concat(r1).concat(r2);
  }
  getInjectedTextInInterval(host, start, end, filterOwnerId) {
    const versionId = host.getVersionId();
    const result = this._injectedTextDecorationsTree.intervalSearch(start, end, filterOwnerId, false, versionId, false);
    return this._ensureNodesHaveRanges(host, result).filter((i) => i.options.showIfCollapsed || !i.range.isEmpty());
  }
  getAllInjectedText(host, filterOwnerId) {
    const versionId = host.getVersionId();
    const result = this._injectedTextDecorationsTree.search(filterOwnerId, false, versionId, false);
    return this._ensureNodesHaveRanges(host, result).filter((i) => i.options.showIfCollapsed || !i.range.isEmpty());
  }
  getAll(host, filterOwnerId, filterOutValidation, overviewRulerOnly, onlyMarginDecorations) {
    const versionId = host.getVersionId();
    const result = this._search(filterOwnerId, filterOutValidation, overviewRulerOnly, versionId, onlyMarginDecorations);
    return this._ensureNodesHaveRanges(host, result);
  }
  _search(filterOwnerId, filterOutValidation, overviewRulerOnly, cachedVersionId, onlyMarginDecorations) {
    if (overviewRulerOnly) {
      return this._decorationsTree1.search(filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
    } else {
      const r0 = this._decorationsTree0.search(filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
      const r1 = this._decorationsTree1.search(filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
      const r2 = this._injectedTextDecorationsTree.search(filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
      return r0.concat(r1).concat(r2);
    }
  }
  collectNodesFromOwner(ownerId) {
    const r0 = this._decorationsTree0.collectNodesFromOwner(ownerId);
    const r1 = this._decorationsTree1.collectNodesFromOwner(ownerId);
    const r2 = this._injectedTextDecorationsTree.collectNodesFromOwner(ownerId);
    return r0.concat(r1).concat(r2);
  }
  collectNodesPostOrder() {
    const r0 = this._decorationsTree0.collectNodesPostOrder();
    const r1 = this._decorationsTree1.collectNodesPostOrder();
    const r2 = this._injectedTextDecorationsTree.collectNodesPostOrder();
    return r0.concat(r1).concat(r2);
  }
  insert(node) {
    if (isNodeInjectedText(node)) {
      this._injectedTextDecorationsTree.insert(node);
    } else if (isNodeInOverviewRuler(node)) {
      this._decorationsTree1.insert(node);
    } else {
      this._decorationsTree0.insert(node);
    }
  }
  delete(node) {
    if (isNodeInjectedText(node)) {
      this._injectedTextDecorationsTree.delete(node);
    } else if (isNodeInOverviewRuler(node)) {
      this._decorationsTree1.delete(node);
    } else {
      this._decorationsTree0.delete(node);
    }
  }
  getNodeRange(host, node) {
    const versionId = host.getVersionId();
    if (node.cachedVersionId !== versionId) {
      this._resolveNode(node, versionId);
    }
    if (node.range === null) {
      node.range = host.getRangeAt(node.cachedAbsoluteStart, node.cachedAbsoluteEnd);
    }
    return node.range;
  }
  _resolveNode(node, cachedVersionId) {
    if (isNodeInjectedText(node)) {
      this._injectedTextDecorationsTree.resolveNode(node, cachedVersionId);
    } else if (isNodeInOverviewRuler(node)) {
      this._decorationsTree1.resolveNode(node, cachedVersionId);
    } else {
      this._decorationsTree0.resolveNode(node, cachedVersionId);
    }
  }
  acceptReplace(offset, length, textLength, forceMoveMarkers) {
    this._decorationsTree0.acceptReplace(offset, length, textLength, forceMoveMarkers);
    this._decorationsTree1.acceptReplace(offset, length, textLength, forceMoveMarkers);
    this._injectedTextDecorationsTree.acceptReplace(offset, length, textLength, forceMoveMarkers);
  }
}
function cleanClassName(className) {
  return className.replace(/[^a-z0-9\-_]/gi, " ");
}
class DecorationOptions {
  constructor(options) {
    this.color = options.color || "";
    this.darkColor = options.darkColor || "";
  }
}
class ModelDecorationOverviewRulerOptions extends DecorationOptions {
  constructor(options) {
    super(options);
    this._resolvedColor = null;
    this.position = typeof options.position === "number" ? options.position : model.OverviewRulerLane.Center;
  }
  getColor(theme) {
    if (!this._resolvedColor) {
      if (theme.type !== "light" && this.darkColor) {
        this._resolvedColor = this._resolveColor(this.darkColor, theme);
      } else {
        this._resolvedColor = this._resolveColor(this.color, theme);
      }
    }
    return this._resolvedColor;
  }
  invalidateCachedColor() {
    this._resolvedColor = null;
  }
  _resolveColor(color, theme) {
    if (typeof color === "string") {
      return color;
    }
    const c = color ? theme.getColor(color.id) : null;
    if (!c) {
      return "";
    }
    return c.toString();
  }
}
class ModelDecorationGlyphMarginOptions {
  constructor(options) {
    this.position = options?.position ?? model.GlyphMarginLane.Center;
    this.persistLane = options?.persistLane;
  }
}
class ModelDecorationMinimapOptions extends DecorationOptions {
  constructor(options) {
    super(options);
    this.position = options.position;
    this.sectionHeaderStyle = options.sectionHeaderStyle ?? null;
    this.sectionHeaderText = options.sectionHeaderText ?? null;
  }
  getColor(theme) {
    if (!this._resolvedColor) {
      if (theme.type !== "light" && this.darkColor) {
        this._resolvedColor = this._resolveColor(this.darkColor, theme);
      } else {
        this._resolvedColor = this._resolveColor(this.color, theme);
      }
    }
    return this._resolvedColor;
  }
  invalidateCachedColor() {
    this._resolvedColor = void 0;
  }
  _resolveColor(color, theme) {
    if (typeof color === "string") {
      return Color.fromHex(color);
    }
    return theme.getColor(color.id);
  }
}
class ModelDecorationInjectedTextOptions {
  static from(options) {
    if (options instanceof ModelDecorationInjectedTextOptions) {
      return options;
    }
    return new ModelDecorationInjectedTextOptions(options);
  }
  constructor(options) {
    this.content = options.content || "";
    this.tokens = options.tokens ?? null;
    this.inlineClassName = options.inlineClassName || null;
    this.inlineClassNameAffectsLetterSpacing = options.inlineClassNameAffectsLetterSpacing || false;
    this.attachedData = options.attachedData || null;
    this.cursorStops = options.cursorStops || null;
  }
}
class ModelDecorationOptions {
  static register(options) {
    return new ModelDecorationOptions(options);
  }
  static createDynamic(options) {
    return new ModelDecorationOptions(options);
  }
  constructor(options) {
    this.description = options.description;
    this.blockClassName = options.blockClassName ? cleanClassName(options.blockClassName) : null;
    this.blockDoesNotCollapse = options.blockDoesNotCollapse ?? null;
    this.blockIsAfterEnd = options.blockIsAfterEnd ?? null;
    this.blockPadding = options.blockPadding ?? null;
    this.stickiness = options.stickiness || model.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
    this.zIndex = options.zIndex || 0;
    this.className = options.className ? cleanClassName(options.className) : null;
    this.shouldFillLineOnLineBreak = options.shouldFillLineOnLineBreak ?? null;
    this.hoverMessage = options.hoverMessage || null;
    this.glyphMarginHoverMessage = options.glyphMarginHoverMessage || null;
    this.lineNumberHoverMessage = options.lineNumberHoverMessage || null;
    this.isWholeLine = options.isWholeLine || false;
    this.showIfCollapsed = options.showIfCollapsed || false;
    this.collapseOnReplaceEdit = options.collapseOnReplaceEdit || false;
    this.overviewRuler = options.overviewRuler ? new ModelDecorationOverviewRulerOptions(options.overviewRuler) : null;
    this.minimap = options.minimap ? new ModelDecorationMinimapOptions(options.minimap) : null;
    this.glyphMargin = options.glyphMarginClassName ? new ModelDecorationGlyphMarginOptions(options.glyphMargin) : null;
    this.glyphMarginClassName = options.glyphMarginClassName ? cleanClassName(options.glyphMarginClassName) : null;
    this.linesDecorationsClassName = options.linesDecorationsClassName ? cleanClassName(options.linesDecorationsClassName) : null;
    this.lineNumberClassName = options.lineNumberClassName ? cleanClassName(options.lineNumberClassName) : null;
    this.linesDecorationsTooltip = options.linesDecorationsTooltip ? strings.htmlAttributeEncodeValue(options.linesDecorationsTooltip) : null;
    this.firstLineDecorationClassName = options.firstLineDecorationClassName ? cleanClassName(options.firstLineDecorationClassName) : null;
    this.marginClassName = options.marginClassName ? cleanClassName(options.marginClassName) : null;
    this.inlineClassName = options.inlineClassName ? cleanClassName(options.inlineClassName) : null;
    this.inlineClassNameAffectsLetterSpacing = options.inlineClassNameAffectsLetterSpacing || false;
    this.beforeContentClassName = options.beforeContentClassName ? cleanClassName(options.beforeContentClassName) : null;
    this.afterContentClassName = options.afterContentClassName ? cleanClassName(options.afterContentClassName) : null;
    this.after = options.after ? ModelDecorationInjectedTextOptions.from(options.after) : null;
    this.before = options.before ? ModelDecorationInjectedTextOptions.from(options.before) : null;
    this.hideInCommentTokens = options.hideInCommentTokens ?? false;
    this.hideInStringTokens = options.hideInStringTokens ?? false;
  }
}
ModelDecorationOptions.EMPTY = ModelDecorationOptions.register({ description: "empty" });
const TRACKED_RANGE_OPTIONS = [
  ModelDecorationOptions.register({ description: "tracked-range-always-grows-when-typing-at-edges", stickiness: model.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges }),
  ModelDecorationOptions.register({ description: "tracked-range-never-grows-when-typing-at-edges", stickiness: model.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }),
  ModelDecorationOptions.register({ description: "tracked-range-grows-only-when-typing-before", stickiness: model.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore }),
  ModelDecorationOptions.register({ description: "tracked-range-grows-only-when-typing-after", stickiness: model.TrackedRangeStickiness.GrowsOnlyWhenTypingAfter })
];
function _normalizeOptions(options) {
  if (options instanceof ModelDecorationOptions) {
    return options;
  }
  return ModelDecorationOptions.createDynamic(options);
}
class DidChangeDecorationsEmitter extends Disposable {
  constructor(handleBeforeFire) {
    super();
    this.handleBeforeFire = handleBeforeFire;
    this._actual = this._register(new Emitter());
    this.event = this._actual.event;
    this._affectedInjectedTextLines = null;
    this._deferredCnt = 0;
    this._shouldFireDeferred = false;
    this._affectsMinimap = false;
    this._affectsOverviewRuler = false;
    this._affectsGlyphMargin = false;
    this._affectsLineNumber = false;
  }
  hasListeners() {
    return this._actual.hasListeners();
  }
  beginDeferredEmit() {
    this._deferredCnt++;
  }
  endDeferredEmit() {
    this._deferredCnt--;
    if (this._deferredCnt === 0) {
      if (this._shouldFireDeferred) {
        this.doFire();
      }
      this._affectedInjectedTextLines?.clear();
      this._affectedInjectedTextLines = null;
    }
  }
  recordLineAffectedByInjectedText(lineNumber) {
    if (!this._affectedInjectedTextLines) {
      this._affectedInjectedTextLines = /* @__PURE__ */ new Set();
    }
    this._affectedInjectedTextLines.add(lineNumber);
  }
  checkAffectedAndFire(options) {
    this._affectsMinimap ||= !!options.minimap?.position;
    this._affectsOverviewRuler ||= !!options.overviewRuler?.color;
    this._affectsGlyphMargin ||= !!options.glyphMarginClassName;
    this._affectsLineNumber ||= !!options.lineNumberClassName;
    this.tryFire();
  }
  fire() {
    this._affectsMinimap = true;
    this._affectsOverviewRuler = true;
    this._affectsGlyphMargin = true;
    this.tryFire();
  }
  tryFire() {
    if (this._deferredCnt === 0) {
      this.doFire();
    } else {
      this._shouldFireDeferred = true;
    }
  }
  doFire() {
    this.handleBeforeFire(this._affectedInjectedTextLines);
    const event = {
      affectsMinimap: this._affectsMinimap,
      affectsOverviewRuler: this._affectsOverviewRuler,
      affectsGlyphMargin: this._affectsGlyphMargin,
      affectsLineNumber: this._affectsLineNumber
    };
    this._shouldFireDeferred = false;
    this._affectsMinimap = false;
    this._affectsOverviewRuler = false;
    this._affectsGlyphMargin = false;
    this._actual.fire(event);
  }
}
class DidChangeContentEmitter extends Disposable {
  constructor() {
    super();
    /**
     * Both `fastEvent` and `slowEvent` work the same way and contain the same events, but first we invoke `fastEvent` and then `slowEvent`.
     */
    this._fastEmitter = this._register(new Emitter());
    this.fastEvent = this._fastEmitter.event;
    this._slowEmitter = this._register(new Emitter());
    this.slowEvent = this._slowEmitter.event;
    this._deferredCnt = 0;
    this._deferredEvent = null;
  }
  hasListeners() {
    return this._fastEmitter.hasListeners() || this._slowEmitter.hasListeners();
  }
  beginDeferredEmit() {
    this._deferredCnt++;
  }
  endDeferredEmit(resultingSelection = null) {
    this._deferredCnt--;
    if (this._deferredCnt === 0) {
      if (this._deferredEvent !== null) {
        this._deferredEvent.rawContentChangedEvent.resultingSelection = resultingSelection;
        const e = this._deferredEvent;
        this._deferredEvent = null;
        this._fastEmitter.fire(e);
        this._slowEmitter.fire(e);
      }
    }
  }
  fire(e) {
    if (this._deferredCnt > 0) {
      if (this._deferredEvent) {
        this._deferredEvent = this._deferredEvent.merge(e);
      } else {
        this._deferredEvent = e;
      }
      return;
    }
    this._fastEmitter.fire(e);
    this._slowEmitter.fire(e);
  }
}
export {
  ModelDecorationGlyphMarginOptions,
  ModelDecorationInjectedTextOptions,
  ModelDecorationMinimapOptions,
  ModelDecorationOptions,
  ModelDecorationOverviewRulerOptions,
  TextModel,
  createTextBuffer,
  createTextBufferFactory,
  createTextBufferFactoryFromSnapshot,
  createTextBufferFactoryFromStream,
  indentOfLine
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFycmF5UXVldWUsIHB1c2hNYW55IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyLCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yLCBpbGxlZ2FsQXJndW1lbnQsIG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCBjb21iaW5lZERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbGlzdGVuU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBUaGVtZUNvbG9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IENvbnN0YW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VpbnQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IGNvdW50RU9MIH0gZnJvbSAnLi4vY29yZS9lb2xDb3VudGVyLmpzJztcbmltcG9ydCB7IG5vcm1hbGl6ZUluZGVudGF0aW9uIH0gZnJvbSAnLi4vY29yZS9pbmRlbnRhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXh0Q2hhbmdlIH0gZnJvbSAnLi4vY29yZS90ZXh0Q2hhbmdlLmpzJztcbmltcG9ydCB7IEVESVRPUl9NT0RFTF9ERUZBVUxUUyB9IGZyb20gJy4uL2NvcmUvdGV4dE1vZGVsRGVmYXVsdHMuanMnO1xuaW1wb3J0IHsgSVdvcmRBdFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS93b3JkSGVscGVyLmpzJztcbmltcG9ydCB7IEZvcm1hdHRpbmdPcHRpb25zIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlbGVjdGlvbiwgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgKiBhcyBtb2RlbCBmcm9tICcuLi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBCcmFja2V0UGFpcnNUZXh0TW9kZWxQYXJ0IH0gZnJvbSAnLi9icmFja2V0UGFpcnNUZXh0TW9kZWxQYXJ0L2JyYWNrZXRQYWlyc0ltcGwuanMnO1xuaW1wb3J0IHsgQ29sb3JpemVkQnJhY2tldFBhaXJzRGVjb3JhdGlvblByb3ZpZGVyIH0gZnJvbSAnLi9icmFja2V0UGFpcnNUZXh0TW9kZWxQYXJ0L2NvbG9yaXplZEJyYWNrZXRQYWlyc0RlY29yYXRpb25Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBFZGl0U3RhY2sgfSBmcm9tICcuL2VkaXRTdGFjay5qcyc7XG5pbXBvcnQgeyBHdWlkZXNUZXh0TW9kZWxQYXJ0IH0gZnJvbSAnLi9ndWlkZXNUZXh0TW9kZWxQYXJ0LmpzJztcbmltcG9ydCB7IGd1ZXNzSW5kZW50YXRpb24gfSBmcm9tICcuL2luZGVudGF0aW9uR3Vlc3Nlci5qcyc7XG5pbXBvcnQgeyBJbnRlcnZhbE5vZGUsIEludGVydmFsVHJlZSwgcmVjb21wdXRlTWF4RW5kIH0gZnJvbSAnLi9pbnRlcnZhbFRyZWUuanMnO1xuaW1wb3J0IHsgUGllY2VUcmVlVGV4dEJ1ZmZlciB9IGZyb20gJy4vcGllY2VUcmVlVGV4dEJ1ZmZlci9waWVjZVRyZWVUZXh0QnVmZmVyLmpzJztcbmltcG9ydCB7IFBpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyIH0gZnJvbSAnLi9waWVjZVRyZWVUZXh0QnVmZmVyL3BpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyLmpzJztcbmltcG9ydCB7IFNlYXJjaFBhcmFtcywgVGV4dE1vZGVsU2VhcmNoIH0gZnJvbSAnLi90ZXh0TW9kZWxTZWFyY2guanMnO1xuaW1wb3J0IHsgVG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydCB9IGZyb20gJy4vdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5qcyc7XG5pbXBvcnQgeyBBdHRhY2hlZFZpZXdzIH0gZnJvbSAnLi90b2tlbnMuanMnO1xuaW1wb3J0IHsgSUJyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQgfSBmcm9tICcuLi90ZXh0TW9kZWxCcmFja2V0UGFpcnMuanMnO1xuaW1wb3J0IHsgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCwgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQsIElNb2RlbE9wdGlvbnNDaGFuZ2VkRXZlbnQsIEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQsIExpbmVJbmplY3RlZFRleHQsIE1vZGVsSW5qZWN0ZWRUZXh0Q2hhbmdlZEV2ZW50LCBNb2RlbFJhd0NoYW5nZSwgTW9kZWxSYXdDb250ZW50Q2hhbmdlZEV2ZW50LCBNb2RlbFJhd0VPTENoYW5nZWQsIE1vZGVsUmF3Rmx1c2gsIE1vZGVsUmF3TGluZUNoYW5nZWQsIE1vZGVsUmF3TGluZXNEZWxldGVkLCBNb2RlbFJhd0xpbmVzSW5zZXJ0ZWQgfSBmcm9tICcuLi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgSUd1aWRlc1RleHRNb2RlbFBhcnQgfSBmcm9tICcuLi90ZXh0TW9kZWxHdWlkZXMuanMnO1xuaW1wb3J0IHsgSVRva2VuaXphdGlvblRleHRNb2RlbFBhcnQgfSBmcm9tICcuLi90b2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbG9yVGhlbWUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVbmRvUmVkb1NlcnZpY2UsIFJlc291cmNlRWRpdFN0YWNrU25hcHNob3QsIFVuZG9SZWRvR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgVG9rZW5BcnJheSB9IGZyb20gJy4uL3Rva2Vucy90b2tlbkFycmF5LmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KHRleHQ6IHN0cmluZyk6IG1vZGVsLklUZXh0QnVmZmVyRmFjdG9yeSB7XG5cdGNvbnN0IGJ1aWxkZXIgPSBuZXcgUGllY2VUcmVlVGV4dEJ1ZmZlckJ1aWxkZXIoKTtcblx0YnVpbGRlci5hY2NlcHRDaHVuayh0ZXh0KTtcblx0cmV0dXJuIGJ1aWxkZXIuZmluaXNoKCk7XG59XG5cbmludGVyZmFjZSBJVGV4dFN0cmVhbSB7XG5cdG9uKGV2ZW50OiAnZGF0YScsIGNhbGxiYWNrOiAoZGF0YTogc3RyaW5nKSA9PiB2b2lkKTogdm9pZDtcblx0b24oZXZlbnQ6ICdlcnJvcicsIGNhbGxiYWNrOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG5cdG9uKGV2ZW50OiAnZW5kJywgY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkO1xuXHRvbihldmVudDogc3RyaW5nLCBjYWxsYmFjazogYW55KTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5RnJvbVN0cmVhbShzdHJlYW06IElUZXh0U3RyZWFtKTogUHJvbWlzZTxtb2RlbC5JVGV4dEJ1ZmZlckZhY3Rvcnk+O1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5RnJvbVN0cmVhbShzdHJlYW06IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0pOiBQcm9taXNlPG1vZGVsLklUZXh0QnVmZmVyRmFjdG9yeT47XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU3RyZWFtKHN0cmVhbTogSVRleHRTdHJlYW0gfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtKTogUHJvbWlzZTxtb2RlbC5JVGV4dEJ1ZmZlckZhY3Rvcnk+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPG1vZGVsLklUZXh0QnVmZmVyRmFjdG9yeT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgUGllY2VUcmVlVGV4dEJ1ZmZlckJ1aWxkZXIoKTtcblxuXHRcdGxldCBkb25lID0gZmFsc2U7XG5cblx0XHRsaXN0ZW5TdHJlYW08c3RyaW5nIHwgVlNCdWZmZXI+KHN0cmVhbSwge1xuXHRcdFx0b25EYXRhOiBjaHVuayA9PiB7XG5cdFx0XHRcdGJ1aWxkZXIuYWNjZXB0Q2h1bmsoKHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycpID8gY2h1bmsgOiBjaHVuay50b1N0cmluZygpKTtcblx0XHRcdH0sXG5cdFx0XHRvbkVycm9yOiBlcnJvciA9PiB7XG5cdFx0XHRcdGlmICghZG9uZSkge1xuXHRcdFx0XHRcdGRvbmUgPSB0cnVlO1xuXHRcdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkVuZDogKCkgPT4ge1xuXHRcdFx0XHRpZiAoIWRvbmUpIHtcblx0XHRcdFx0XHRkb25lID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXNvbHZlKGJ1aWxkZXIuZmluaXNoKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU25hcHNob3Qoc25hcHNob3Q6IG1vZGVsLklUZXh0U25hcHNob3QpOiBtb2RlbC5JVGV4dEJ1ZmZlckZhY3Rvcnkge1xuXHRjb25zdCBidWlsZGVyID0gbmV3IFBpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyKCk7XG5cblx0bGV0IGNodW5rOiBzdHJpbmcgfCBudWxsO1xuXHR3aGlsZSAodHlwZW9mIChjaHVuayA9IHNuYXBzaG90LnJlYWQoKSkgPT09ICdzdHJpbmcnKSB7XG5cdFx0YnVpbGRlci5hY2NlcHRDaHVuayhjaHVuayk7XG5cdH1cblxuXHRyZXR1cm4gYnVpbGRlci5maW5pc2goKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRleHRCdWZmZXIodmFsdWU6IHN0cmluZyB8IG1vZGVsLklUZXh0QnVmZmVyRmFjdG9yeSB8IG1vZGVsLklUZXh0U25hcHNob3QsIGRlZmF1bHRFT0w6IG1vZGVsLkRlZmF1bHRFbmRPZkxpbmUpOiB7IHRleHRCdWZmZXI6IG1vZGVsLklUZXh0QnVmZmVyOyBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB9IHtcblx0bGV0IGZhY3Rvcnk6IG1vZGVsLklUZXh0QnVmZmVyRmFjdG9yeTtcblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRmYWN0b3J5ID0gY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkodmFsdWUpO1xuXHR9IGVsc2UgaWYgKG1vZGVsLmlzSVRleHRTbmFwc2hvdCh2YWx1ZSkpIHtcblx0XHRmYWN0b3J5ID0gY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU25hcHNob3QodmFsdWUpO1xuXHR9IGVsc2Uge1xuXHRcdGZhY3RvcnkgPSB2YWx1ZTtcblx0fVxuXHRyZXR1cm4gZmFjdG9yeS5jcmVhdGUoZGVmYXVsdEVPTCk7XG59XG5cbmxldCBNT0RFTF9JRCA9IDA7XG5cbmNvbnN0IExJTUlUX0ZJTkRfQ09VTlQgPSA5OTk7XG5jb25zdCBMT05HX0xJTkVfQk9VTkRBUlkgPSAxMDAwMDtcblxuY2xhc3MgVGV4dE1vZGVsU25hcHNob3QgaW1wbGVtZW50cyBtb2RlbC5JVGV4dFNuYXBzaG90IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zb3VyY2U6IG1vZGVsLklUZXh0U25hcHNob3Q7XG5cdHByaXZhdGUgX2VvczogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihzb3VyY2U6IG1vZGVsLklUZXh0U25hcHNob3QpIHtcblx0XHR0aGlzLl9zb3VyY2UgPSBzb3VyY2U7XG5cdFx0dGhpcy5fZW9zID0gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgcmVhZCgpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAodGhpcy5fZW9zKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0bGV0IHJlc3VsdENudCA9IDA7XG5cdFx0bGV0IHJlc3VsdExlbmd0aCA9IDA7XG5cblx0XHRkbyB7XG5cdFx0XHRjb25zdCB0bXAgPSB0aGlzLl9zb3VyY2UucmVhZCgpO1xuXG5cdFx0XHRpZiAodG1wID09PSBudWxsKSB7XG5cdFx0XHRcdC8vIGVuZC1vZi1zdHJlYW1cblx0XHRcdFx0dGhpcy5fZW9zID0gdHJ1ZTtcblx0XHRcdFx0aWYgKHJlc3VsdENudCA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQuam9pbignJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHRtcC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRDbnQrK10gPSB0bXA7XG5cdFx0XHRcdHJlc3VsdExlbmd0aCArPSB0bXAubGVuZ3RoO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzdWx0TGVuZ3RoID49IDY0ICogMTAyNCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0LmpvaW4oJycpO1xuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKHRydWUpO1xuXHR9XG59XG5cbmNvbnN0IGludmFsaWRGdW5jID0gKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2hhbmdlIGFjY2Vzc29yYCk7IH07XG5cbmNvbnN0IGVudW0gU3RyaW5nT2Zmc2V0VmFsaWRhdGlvblR5cGUge1xuXHQvKipcblx0ICogRXZlbiBhbGxvd2VkIGluIHN1cnJvZ2F0ZSBwYWlyc1xuXHQgKi9cblx0UmVsYXhlZCA9IDAsXG5cdC8qKlxuXHQgKiBOb3QgYWxsb3dlZCBpbiBzdXJyb2dhdGUgcGFpcnNcblx0ICovXG5cdFN1cnJvZ2F0ZVBhaXJzID0gMSxcbn1cblxuZXhwb3J0IGNsYXNzIFRleHRNb2RlbCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBtb2RlbC5JVGV4dE1vZGVsLCBJRGVjb3JhdGlvbnNUcmVlc0hvc3Qge1xuXG5cdHN0YXRpYyBfTU9ERUxfU1lOQ19MSU1JVCA9IDUwICogMTAyNCAqIDEwMjQ7IC8vIDUwIE1CLCAgLy8gdXNlZCBpbiB0ZXN0c1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBMQVJHRV9GSUxFX1NJWkVfVEhSRVNIT0xEID0gMjAgKiAxMDI0ICogMTAyNDsgLy8gMjAgTUI7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IExBUkdFX0ZJTEVfTElORV9DT1VOVF9USFJFU0hPTEQgPSAzMDAgKiAxMDAwOyAvLyAzMDBLIGxpbmVzXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IExBUkdFX0ZJTEVfSEVBUF9PUEVSQVRJT05fVEhSRVNIT0xEID0gMjU2ICogMTAyNCAqIDEwMjQ7IC8vIDI1Nk0gY2hhcmFjdGVycywgdXN1YWxseSB+PiA1MTJNQiBtZW1vcnkgdXNhZ2VcblxuXHRwdWJsaWMgc3RhdGljIERFRkFVTFRfQ1JFQVRJT05fT1BUSU9OUzogbW9kZWwuSVRleHRNb2RlbENyZWF0aW9uT3B0aW9ucyA9IHtcblx0XHRpc0ZvclNpbXBsZVdpZGdldDogZmFsc2UsXG5cdFx0dGFiU2l6ZTogRURJVE9SX01PREVMX0RFRkFVTFRTLnRhYlNpemUsXG5cdFx0aW5kZW50U2l6ZTogRURJVE9SX01PREVMX0RFRkFVTFRTLmluZGVudFNpemUsXG5cdFx0aW5zZXJ0U3BhY2VzOiBFRElUT1JfTU9ERUxfREVGQVVMVFMuaW5zZXJ0U3BhY2VzLFxuXHRcdGRldGVjdEluZGVudGF0aW9uOiBmYWxzZSxcblx0XHRkZWZhdWx0RU9MOiBtb2RlbC5EZWZhdWx0RW5kT2ZMaW5lLkxGLFxuXHRcdHRyaW1BdXRvV2hpdGVzcGFjZTogRURJVE9SX01PREVMX0RFRkFVTFRTLnRyaW1BdXRvV2hpdGVzcGFjZSxcblx0XHRsYXJnZUZpbGVPcHRpbWl6YXRpb25zOiBFRElUT1JfTU9ERUxfREVGQVVMVFMubGFyZ2VGaWxlT3B0aW1pemF0aW9ucyxcblx0XHRicmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnM6IEVESVRPUl9NT0RFTF9ERUZBVUxUUy5icmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnMsXG5cdH07XG5cblx0cHVibGljIHN0YXRpYyByZXNvbHZlT3B0aW9ucyh0ZXh0QnVmZmVyOiBtb2RlbC5JVGV4dEJ1ZmZlciwgb3B0aW9uczogbW9kZWwuSVRleHRNb2RlbENyZWF0aW9uT3B0aW9ucyk6IG1vZGVsLlRleHRNb2RlbFJlc29sdmVkT3B0aW9ucyB7XG5cdFx0aWYgKG9wdGlvbnMuZGV0ZWN0SW5kZW50YXRpb24pIHtcblx0XHRcdGNvbnN0IGd1ZXNzZWRJbmRlbnRhdGlvbiA9IGd1ZXNzSW5kZW50YXRpb24odGV4dEJ1ZmZlciwgb3B0aW9ucy50YWJTaXplLCBvcHRpb25zLmluc2VydFNwYWNlcyk7XG5cdFx0XHRyZXR1cm4gbmV3IG1vZGVsLlRleHRNb2RlbFJlc29sdmVkT3B0aW9ucyh7XG5cdFx0XHRcdHRhYlNpemU6IGd1ZXNzZWRJbmRlbnRhdGlvbi50YWJTaXplLFxuXHRcdFx0XHRpbmRlbnRTaXplOiAndGFiU2l6ZScsIC8vIFRPRE9AQWxleDogZ3Vlc3MgaW5kZW50U2l6ZSBpbmRlcGVuZGVudCBvZiB0YWJTaXplXG5cdFx0XHRcdGluc2VydFNwYWNlczogZ3Vlc3NlZEluZGVudGF0aW9uLmluc2VydFNwYWNlcyxcblx0XHRcdFx0dHJpbUF1dG9XaGl0ZXNwYWNlOiBvcHRpb25zLnRyaW1BdXRvV2hpdGVzcGFjZSxcblx0XHRcdFx0ZGVmYXVsdEVPTDogb3B0aW9ucy5kZWZhdWx0RU9MLFxuXHRcdFx0XHRicmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnM6IG9wdGlvbnMuYnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBtb2RlbC5UZXh0TW9kZWxSZXNvbHZlZE9wdGlvbnMob3B0aW9ucyk7XG5cdH1cblxuXHQvLyNyZWdpb24gRXZlbnRzXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbERpc3Bvc2U6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uV2lsbERpc3Bvc2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25XaWxsRGlzcG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZURlY29yYXRpb25zOiBEaWRDaGFuZ2VEZWNvcmF0aW9uc0VtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlkQ2hhbmdlRGVjb3JhdGlvbnNFbWl0dGVyKGFmZmVjdGVkSW5qZWN0ZWRUZXh0TGluZXMgPT4gdGhpcy5oYW5kbGVCZWZvcmVGaXJlRGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQoYWZmZWN0ZWRJbmplY3RlZFRleHRMaW5lcykpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGVjb3JhdGlvbnM6IEV2ZW50PElNb2RlbERlY29yYXRpb25zQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZXZlbnQ7XG5cblx0cHVibGljIGdldCBvbkRpZENoYW5nZUxhbmd1YWdlKCkgeyByZXR1cm4gdGhpcy5fdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5vbkRpZENoYW5nZUxhbmd1YWdlOyB9XG5cdHB1YmxpYyBnZXQgb25EaWRDaGFuZ2VMYW5ndWFnZUNvbmZpZ3VyYXRpb24oKSB7IHJldHVybiB0aGlzLl90b2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0Lm9uRGlkQ2hhbmdlTGFuZ3VhZ2VDb25maWd1cmF0aW9uOyB9XG5cdHB1YmxpYyBnZXQgb25EaWRDaGFuZ2VUb2tlbnMoKSB7IHJldHVybiB0aGlzLl90b2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0Lm9uRGlkQ2hhbmdlVG9rZW5zOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VPcHRpb25zOiBFbWl0dGVyPElNb2RlbE9wdGlvbnNDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vZGVsT3B0aW9uc0NoYW5nZWRFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU9wdGlvbnM6IEV2ZW50PElNb2RlbE9wdGlvbnNDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VPcHRpb25zLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQXR0YWNoZWQ6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlQXR0YWNoZWQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VBdHRhY2hlZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUluamVjdGVkVGV4dDogRW1pdHRlcjxNb2RlbEluamVjdGVkVGV4dENoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxNb2RlbEluamVjdGVkVGV4dENoYW5nZWRFdmVudD4oKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZXZlbnRFbWl0dGVyOiBEaWRDaGFuZ2VDb250ZW50RW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaWRDaGFuZ2VDb250ZW50RW1pdHRlcigpKTtcblx0cHVibGljIG9uRGlkQ2hhbmdlQ29udGVudChsaXN0ZW5lcjogKGU6IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2V2ZW50RW1pdHRlci5zbG93RXZlbnQoKGU6IEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQpID0+IGxpc3RlbmVyKGUuY29udGVudENoYW5nZWRFdmVudCkpO1xuXHR9XG5cdHB1YmxpYyBvbkRpZENoYW5nZUNvbnRlbnRPckluamVjdGVkVGV4dChsaXN0ZW5lcjogKGU6IEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQgfCBNb2RlbEluamVjdGVkVGV4dENoYW5nZWRFdmVudCkgPT4gdm9pZCk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gY29tYmluZWREaXNwb3NhYmxlKFxuXHRcdFx0dGhpcy5fZXZlbnRFbWl0dGVyLmZhc3RFdmVudChlID0+IGxpc3RlbmVyKGUpKSxcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSW5qZWN0ZWRUZXh0LmV2ZW50KGUgPT4gbGlzdGVuZXIoZSkpXG5cdFx0KTtcblx0fVxuXHQvLyNlbmRyZWdpb25cblxuXHRwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IGlzRm9yU2ltcGxlV2lkZ2V0OiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hc3NvY2lhdGVkUmVzb3VyY2U6IFVSSTtcblx0cHJpdmF0ZSBfYXR0YWNoZWRFZGl0b3JDb3VudDogbnVtYmVyO1xuXHRwcml2YXRlIF9idWZmZXI6IG1vZGVsLklUZXh0QnVmZmVyO1xuXHRwcml2YXRlIF9idWZmZXJEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSBfb3B0aW9uczogbW9kZWwuVGV4dE1vZGVsUmVzb2x2ZWRPcHRpb25zO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlbGVjdGlvbkxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPigpKTtcblxuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkOiBib29sZWFuO1xuXHRwcml2YXRlIF9faXNEaXNwb3Npbmc6IGJvb2xlYW47XG5cdHB1YmxpYyBfaXNEaXNwb3NpbmcoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9faXNEaXNwb3Npbmc7IH1cblx0cHJpdmF0ZSBfdmVyc2lvbklkOiBudW1iZXI7XG5cdC8qKlxuXHQgKiBVbmxpa2UsIHZlcnNpb25JZCwgdGhpcyBjYW4gZ28gZG93biAodmlhIHVuZG8pIG9yIGdvIHRvIHByZXZpb3VzIHZhbHVlcyAodmlhIHJlZG8pXG5cdCAqL1xuXHRwcml2YXRlIF9hbHRlcm5hdGl2ZVZlcnNpb25JZDogbnVtYmVyO1xuXHRwcml2YXRlIF9pbml0aWFsVW5kb1JlZG9TbmFwc2hvdDogUmVzb3VyY2VFZGl0U3RhY2tTbmFwc2hvdCB8IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lzVG9vTGFyZ2VGb3JTeW5jaW5nOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc1Rvb0xhcmdlRm9yVG9rZW5pemF0aW9uOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc1Rvb0xhcmdlRm9ySGVhcE9wZXJhdGlvbjogYm9vbGVhbjtcblxuXHQvLyNyZWdpb24gRWRpdGluZ1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kTWFuYWdlcjogRWRpdFN0YWNrO1xuXHRwcml2YXRlIF9pc1VuZG9pbmc6IGJvb2xlYW47XG5cdHByaXZhdGUgX2lzUmVkb2luZzogYm9vbGVhbjtcblx0cHJpdmF0ZSBfdHJpbUF1dG9XaGl0ZXNwYWNlTGluZXM6IG51bWJlcltdIHwgbnVsbDtcblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIERlY29yYXRpb25zXG5cdC8qKlxuXHQgKiBVc2VkIHRvIHdvcmthcm91bmQgYnJva2VuIGNsaWVudHMgdGhhdCBtaWdodCBhdHRlbXB0IHVzaW5nIGEgZGVjb3JhdGlvbiBpZCBnZW5lcmF0ZWQgYnkgYSBkaWZmZXJlbnQgbW9kZWwuXG5cdCAqIEl0IGlzIG5vdCBnbG9iYWxseSB1bmlxdWUgaW4gb3JkZXIgdG8gbGltaXQgaXQgdG8gb25lIGNoYXJhY3Rlci5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbmNlSWQ6IHN0cmluZztcblx0cHJpdmF0ZSBfZGVsdGFEZWNvcmF0aW9uQ2FsbENudDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfbGFzdERlY29yYXRpb25JZDogbnVtYmVyO1xuXHRwcml2YXRlIF9kZWNvcmF0aW9uczogeyBbZGVjb3JhdGlvbklkOiBzdHJpbmddOiBJbnRlcnZhbE5vZGUgfTtcblx0cHJpdmF0ZSBfZGVjb3JhdGlvbnNUcmVlOiBEZWNvcmF0aW9uc1RyZWVzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uUHJvdmlkZXI6IENvbG9yaXplZEJyYWNrZXRQYWlyc0RlY29yYXRpb25Qcm92aWRlcjtcblx0Ly8jZW5kcmVnaW9uXG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydDogVG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydDtcblx0cHVibGljIGdldCB0b2tlbml6YXRpb24oKTogSVRva2VuaXphdGlvblRleHRNb2RlbFBhcnQgeyByZXR1cm4gdGhpcy5fdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2JyYWNrZXRQYWlyczogQnJhY2tldFBhaXJzVGV4dE1vZGVsUGFydDtcblx0cHVibGljIGdldCBicmFja2V0UGFpcnMoKTogSUJyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQgeyByZXR1cm4gdGhpcy5fYnJhY2tldFBhaXJzOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZ3VpZGVzVGV4dE1vZGVsUGFydDogR3VpZGVzVGV4dE1vZGVsUGFydDtcblx0cHVibGljIGdldCBndWlkZXMoKTogSUd1aWRlc1RleHRNb2RlbFBhcnQgeyByZXR1cm4gdGhpcy5fZ3VpZGVzVGV4dE1vZGVsUGFydDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2F0dGFjaGVkVmlld3MgPSBuZXcgQXR0YWNoZWRWaWV3cygpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHNvdXJjZTogc3RyaW5nIHwgbW9kZWwuSVRleHRCdWZmZXJGYWN0b3J5LFxuXHRcdGxhbmd1YWdlSWRPclNlbGVjdGlvbjogc3RyaW5nIHwgSUxhbmd1YWdlU2VsZWN0aW9uLFxuXHRcdGNyZWF0aW9uT3B0aW9uczogbW9kZWwuSVRleHRNb2RlbENyZWF0aW9uT3B0aW9ucyxcblx0XHRhc3NvY2lhdGVkUmVzb3VyY2U6IFVSSSB8IG51bGwgPSBudWxsLFxuXHRcdEBJVW5kb1JlZG9TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBHZW5lcmF0ZSBhIG5ldyB1bmlxdWUgbW9kZWwgaWRcblx0XHRNT0RFTF9JRCsrO1xuXHRcdHRoaXMuaWQgPSAnJG1vZGVsJyArIE1PREVMX0lEO1xuXHRcdHRoaXMuaXNGb3JTaW1wbGVXaWRnZXQgPSBjcmVhdGlvbk9wdGlvbnMuaXNGb3JTaW1wbGVXaWRnZXQ7XG5cdFx0aWYgKHR5cGVvZiBhc3NvY2lhdGVkUmVzb3VyY2UgPT09ICd1bmRlZmluZWQnIHx8IGFzc29jaWF0ZWRSZXNvdXJjZSA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy5fYXNzb2NpYXRlZFJlc291cmNlID0gVVJJLnBhcnNlKCdpbm1lbW9yeTovL21vZGVsLycgKyBNT0RFTF9JRCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2Fzc29jaWF0ZWRSZXNvdXJjZSA9IGFzc29jaWF0ZWRSZXNvdXJjZTtcblx0XHR9XG5cdFx0dGhpcy5fYXR0YWNoZWRFZGl0b3JDb3VudCA9IDA7XG5cblx0XHRjb25zdCB7IHRleHRCdWZmZXIsIGRpc3Bvc2FibGUgfSA9IGNyZWF0ZVRleHRCdWZmZXIoc291cmNlLCBjcmVhdGlvbk9wdGlvbnMuZGVmYXVsdEVPTCk7XG5cdFx0dGhpcy5fYnVmZmVyID0gdGV4dEJ1ZmZlcjtcblx0XHR0aGlzLl9idWZmZXJEaXNwb3NhYmxlID0gZGlzcG9zYWJsZTtcblxuXHRcdGNvbnN0IGJ1ZmZlckxpbmVDb3VudCA9IHRoaXMuX2J1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCBidWZmZXJUZXh0TGVuZ3RoID0gdGhpcy5fYnVmZmVyLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgYnVmZmVyTGluZUNvdW50LCB0aGlzLl9idWZmZXIuZ2V0TGluZUxlbmd0aChidWZmZXJMaW5lQ291bnQpICsgMSksIG1vZGVsLkVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpO1xuXG5cdFx0Ly8gISEhIE1ha2UgYSBkZWNpc2lvbiBpbiB0aGUgY3RvciBhbmQgcGVybWFuZW50bHkgcmVzcGVjdCB0aGlzIGRlY2lzaW9uICEhIVxuXHRcdC8vIElmIGEgbW9kZWwgaXMgdG9vIGxhcmdlIGF0IGNvbnN0cnVjdGlvbiB0aW1lLCBpdCB3aWxsIG5ldmVyIGdldCB0b2tlbml6ZWQsXG5cdFx0Ly8gdW5kZXIgbm8gY2lyY3Vtc3RhbmNlcy5cblx0XHRpZiAoY3JlYXRpb25PcHRpb25zLmxhcmdlRmlsZU9wdGltaXphdGlvbnMpIHtcblx0XHRcdHRoaXMuX2lzVG9vTGFyZ2VGb3JUb2tlbml6YXRpb24gPSAoXG5cdFx0XHRcdChidWZmZXJUZXh0TGVuZ3RoID4gVGV4dE1vZGVsLkxBUkdFX0ZJTEVfU0laRV9USFJFU0hPTEQpXG5cdFx0XHRcdHx8IChidWZmZXJMaW5lQ291bnQgPiBUZXh0TW9kZWwuTEFSR0VfRklMRV9MSU5FX0NPVU5UX1RIUkVTSE9MRClcblx0XHRcdCk7XG5cblx0XHRcdHRoaXMuX2lzVG9vTGFyZ2VGb3JIZWFwT3BlcmF0aW9uID0gYnVmZmVyVGV4dExlbmd0aCA+IFRleHRNb2RlbC5MQVJHRV9GSUxFX0hFQVBfT1BFUkFUSU9OX1RIUkVTSE9MRDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5faXNUb29MYXJnZUZvclRva2VuaXphdGlvbiA9IGZhbHNlO1xuXHRcdFx0dGhpcy5faXNUb29MYXJnZUZvckhlYXBPcGVyYXRpb24gPSBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLl9vcHRpb25zID0gVGV4dE1vZGVsLnJlc29sdmVPcHRpb25zKHRoaXMuX2J1ZmZlciwgY3JlYXRpb25PcHRpb25zKTtcblxuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAodHlwZW9mIGxhbmd1YWdlSWRPclNlbGVjdGlvbiA9PT0gJ3N0cmluZycgPyBsYW5ndWFnZUlkT3JTZWxlY3Rpb24gOiBsYW5ndWFnZUlkT3JTZWxlY3Rpb24ubGFuZ3VhZ2VJZCk7XG5cdFx0aWYgKHR5cGVvZiBsYW5ndWFnZUlkT3JTZWxlY3Rpb24gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLl9sYW5ndWFnZVNlbGVjdGlvbkxpc3RlbmVyLnZhbHVlID0gbGFuZ3VhZ2VJZE9yU2VsZWN0aW9uLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMuX3NldExhbmd1YWdlKGxhbmd1YWdlSWRPclNlbGVjdGlvbi5sYW5ndWFnZUlkKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYnJhY2tldFBhaXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEJyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQodGhpcywgdGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHRcdHRoaXMuX2d1aWRlc1RleHRNb2RlbFBhcnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgR3VpZGVzVGV4dE1vZGVsUGFydCh0aGlzLCB0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvblByb3ZpZGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvbG9yaXplZEJyYWNrZXRQYWlyc0RlY29yYXRpb25Qcm92aWRlcih0aGlzKSk7XG5cdFx0dGhpcy5fdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydCxcblx0XHRcdHRoaXMsXG5cdFx0XHR0aGlzLl9icmFja2V0UGFpcnMsXG5cdFx0XHRsYW5ndWFnZUlkLFxuXHRcdFx0dGhpcy5fYXR0YWNoZWRWaWV3c1xuXHRcdCk7XG5cblx0XHR0aGlzLl9pc1Rvb0xhcmdlRm9yU3luY2luZyA9IChidWZmZXJUZXh0TGVuZ3RoID4gVGV4dE1vZGVsLl9NT0RFTF9TWU5DX0xJTUlUKTtcblxuXHRcdHRoaXMuX3ZlcnNpb25JZCA9IDE7XG5cdFx0dGhpcy5fYWx0ZXJuYXRpdmVWZXJzaW9uSWQgPSAxO1xuXHRcdHRoaXMuX2luaXRpYWxVbmRvUmVkb1NuYXBzaG90ID0gbnVsbDtcblxuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSBmYWxzZTtcblx0XHR0aGlzLl9faXNEaXNwb3NpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuX2luc3RhbmNlSWQgPSBzdHJpbmdzLnNpbmdsZUxldHRlckhhc2goTU9ERUxfSUQpO1xuXHRcdHRoaXMuX2xhc3REZWNvcmF0aW9uSWQgPSAwO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUgPSBuZXcgRGVjb3JhdGlvbnNUcmVlcygpO1xuXG5cdFx0dGhpcy5fY29tbWFuZE1hbmFnZXIgPSBuZXcgRWRpdFN0YWNrKHRoaXMsIHRoaXMuX3VuZG9SZWRvU2VydmljZSk7XG5cdFx0dGhpcy5faXNVbmRvaW5nID0gZmFsc2U7XG5cdFx0dGhpcy5faXNSZWRvaW5nID0gZmFsc2U7XG5cdFx0dGhpcy5fdHJpbUF1dG9XaGl0ZXNwYWNlTGluZXMgPSBudWxsO1xuXG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWNvcmF0aW9uUHJvdmlkZXIub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5iZWdpbkRlZmVycmVkRW1pdCgpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5maXJlKCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmVuZERlZmVycmVkRW1pdCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2xhbmd1YWdlU2VydmljZS5yZXF1ZXN0UmljaExhbmd1YWdlRmVhdHVyZXMobGFuZ3VhZ2VJZCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0dGhpcy5fYnJhY2tldFBhaXJzLmhhbmRsZUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2VDaGFuZ2UoZSk7XG5cdFx0XHR0aGlzLl90b2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0LmhhbmRsZUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2VDaGFuZ2UoZSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fX2lzRGlzcG9zaW5nID0gdHJ1ZTtcblx0XHR0aGlzLl9vbldpbGxEaXNwb3NlLmZpcmUoKTtcblx0XHR0aGlzLl90b2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fYnVmZmVyRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fX2lzRGlzcG9zaW5nID0gZmFsc2U7XG5cdFx0Ly8gTWFudWFsbHkgcmVsZWFzZSByZWZlcmVuY2UgdG8gcHJldmlvdXMgdGV4dCBidWZmZXIgdG8gYXZvaWQgbGFyZ2UgbGVha3Ncblx0XHQvLyBpbiBjYXNlIHNvbWVvbmUgbGVha3MgYSBUZXh0TW9kZWwgcmVmZXJlbmNlXG5cdFx0Y29uc3QgZW1wdHlEaXNwb3NlZFRleHRCdWZmZXIgPSBuZXcgUGllY2VUcmVlVGV4dEJ1ZmZlcihbXSwgJycsICdcXG4nLCBmYWxzZSwgZmFsc2UsIHRydWUsIHRydWUpO1xuXHRcdGVtcHR5RGlzcG9zZWRUZXh0QnVmZmVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9idWZmZXIgPSBlbXB0eURpc3Bvc2VkVGV4dEJ1ZmZlcjtcblx0XHR0aGlzLl9idWZmZXJEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXHR9XG5cblx0X2hhc0xpc3RlbmVycygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0dGhpcy5fb25XaWxsRGlzcG9zZS5oYXNMaXN0ZW5lcnMoKVxuXHRcdFx0fHwgdGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5oYXNMaXN0ZW5lcnMoKVxuXHRcdFx0fHwgdGhpcy5fdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5faGFzTGlzdGVuZXJzKClcblx0XHRcdHx8IHRoaXMuX29uRGlkQ2hhbmdlT3B0aW9ucy5oYXNMaXN0ZW5lcnMoKVxuXHRcdFx0fHwgdGhpcy5fb25EaWRDaGFuZ2VBdHRhY2hlZC5oYXNMaXN0ZW5lcnMoKVxuXHRcdFx0fHwgdGhpcy5fb25EaWRDaGFuZ2VJbmplY3RlZFRleHQuaGFzTGlzdGVuZXJzKClcblx0XHRcdHx8IHRoaXMuX2V2ZW50RW1pdHRlci5oYXNMaXN0ZW5lcnMoKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIF9hc3NlcnROb3REaXNwb3NlZCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignTW9kZWwgaXMgZGlzcG9zZWQhJyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGVxdWFsc1RleHRCdWZmZXIob3RoZXI6IG1vZGVsLklUZXh0QnVmZmVyKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyLmVxdWFscyhvdGhlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VGV4dEJ1ZmZlcigpOiBtb2RlbC5JVGV4dEJ1ZmZlciB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW1pdENvbnRlbnRDaGFuZ2VkRXZlbnQocmF3Q2hhbmdlOiBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQsIGNoYW5nZTogSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9faXNEaXNwb3NpbmcpIHtcblx0XHRcdC8vIERvIG5vdCBjb25mdXNlIGxpc3RlbmVycyBieSBlbWl0dGluZyBhbnkgZXZlbnQgYWZ0ZXIgZGlzcG9zaW5nXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3Rva2VuaXphdGlvblRleHRNb2RlbFBhcnQuaGFuZGxlRGlkQ2hhbmdlQ29udGVudChjaGFuZ2UpO1xuXHRcdHRoaXMuX2JyYWNrZXRQYWlycy5oYW5kbGVEaWRDaGFuZ2VDb250ZW50KGNoYW5nZSk7XG5cdFx0dGhpcy5fZXZlbnRFbWl0dGVyLmZpcmUobmV3IEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQocmF3Q2hhbmdlLCBjaGFuZ2UpKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nIHwgbW9kZWwuSVRleHRTbmFwc2hvdCk6IHZvaWQge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cblx0XHRpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyB0ZXh0QnVmZmVyLCBkaXNwb3NhYmxlIH0gPSBjcmVhdGVUZXh0QnVmZmVyKHZhbHVlLCB0aGlzLl9vcHRpb25zLmRlZmF1bHRFT0wpO1xuXHRcdHRoaXMuX3NldFZhbHVlRnJvbVRleHRCdWZmZXIodGV4dEJ1ZmZlciwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVDb250ZW50Q2hhbmdlZDIocmFuZ2U6IFJhbmdlLCByYW5nZU9mZnNldDogbnVtYmVyLCByYW5nZUxlbmd0aDogbnVtYmVyLCByYW5nZUVuZFBvc2l0aW9uOiBQb3NpdGlvbiwgdGV4dDogc3RyaW5nLCBpc1VuZG9pbmc6IGJvb2xlYW4sIGlzUmVkb2luZzogYm9vbGVhbiwgaXNGbHVzaDogYm9vbGVhbiwgaXNFb2xDaGFuZ2U6IGJvb2xlYW4pOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2hhbmdlczogW3tcblx0XHRcdFx0cmFuZ2U6IHJhbmdlLFxuXHRcdFx0XHRyYW5nZU9mZnNldDogcmFuZ2VPZmZzZXQsXG5cdFx0XHRcdHJhbmdlTGVuZ3RoOiByYW5nZUxlbmd0aCxcblx0XHRcdFx0dGV4dDogdGV4dCxcblx0XHRcdH1dLFxuXHRcdFx0ZW9sOiB0aGlzLl9idWZmZXIuZ2V0RU9MKCksXG5cdFx0XHRpc0VvbENoYW5nZTogaXNFb2xDaGFuZ2UsXG5cdFx0XHR2ZXJzaW9uSWQ6IHRoaXMuZ2V0VmVyc2lvbklkKCksXG5cdFx0XHRpc1VuZG9pbmc6IGlzVW5kb2luZyxcblx0XHRcdGlzUmVkb2luZzogaXNSZWRvaW5nLFxuXHRcdFx0aXNGbHVzaDogaXNGbHVzaFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9zZXRWYWx1ZUZyb21UZXh0QnVmZmVyKHRleHRCdWZmZXI6IG1vZGVsLklUZXh0QnVmZmVyLCB0ZXh0QnVmZmVyRGlzcG9zYWJsZTogSURpc3Bvc2FibGUpOiB2b2lkIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdGNvbnN0IG9sZEZ1bGxNb2RlbFJhbmdlID0gdGhpcy5nZXRGdWxsTW9kZWxSYW5nZSgpO1xuXHRcdGNvbnN0IG9sZE1vZGVsVmFsdWVMZW5ndGggPSB0aGlzLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShvbGRGdWxsTW9kZWxSYW5nZSk7XG5cdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuZ2V0TGluZUNvdW50KCk7XG5cdFx0Y29uc3QgZW5kQ29sdW1uID0gdGhpcy5nZXRMaW5lTWF4Q29sdW1uKGVuZExpbmVOdW1iZXIpO1xuXG5cdFx0dGhpcy5fYnVmZmVyID0gdGV4dEJ1ZmZlcjtcblx0XHR0aGlzLl9idWZmZXJEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9idWZmZXJEaXNwb3NhYmxlID0gdGV4dEJ1ZmZlckRpc3Bvc2FibGU7XG5cdFx0dGhpcy5faW5jcmVhc2VWZXJzaW9uSWQoKTtcblxuXHRcdC8vIERlc3Ryb3kgYWxsIG15IGRlY29yYXRpb25zXG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZSA9IG5ldyBEZWNvcmF0aW9uc1RyZWVzKCk7XG5cblx0XHQvLyBEZXN0cm95IG15IGVkaXQgaGlzdG9yeSBhbmQgc2V0dGluZ3Ncblx0XHR0aGlzLl9jb21tYW5kTWFuYWdlci5jbGVhcigpO1xuXHRcdHRoaXMuX3RyaW1BdXRvV2hpdGVzcGFjZUxpbmVzID0gbnVsbDtcblxuXHRcdHRoaXMuX2VtaXRDb250ZW50Q2hhbmdlZEV2ZW50KFxuXHRcdFx0bmV3IE1vZGVsUmF3Q29udGVudENoYW5nZWRFdmVudChcblx0XHRcdFx0W1xuXHRcdFx0XHRcdG5ldyBNb2RlbFJhd0ZsdXNoKClcblx0XHRcdFx0XSxcblx0XHRcdFx0dGhpcy5fdmVyc2lvbklkLFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0ZmFsc2Vcblx0XHRcdCksXG5cdFx0XHR0aGlzLl9jcmVhdGVDb250ZW50Q2hhbmdlZDIobmV3IFJhbmdlKDEsIDEsIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbiksIDAsIG9sZE1vZGVsVmFsdWVMZW5ndGgsIG5ldyBQb3NpdGlvbihlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pLCB0aGlzLmdldFZhbHVlKCksIGZhbHNlLCBmYWxzZSwgdHJ1ZSwgZmFsc2UpXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzZXRFT0woZW9sOiBtb2RlbC5FbmRPZkxpbmVTZXF1ZW5jZSk6IHZvaWQge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0Y29uc3QgbmV3RU9MID0gKGVvbCA9PT0gbW9kZWwuRW5kT2ZMaW5lU2VxdWVuY2UuQ1JMRiA/ICdcXHJcXG4nIDogJ1xcbicpO1xuXHRcdGlmICh0aGlzLl9idWZmZXIuZ2V0RU9MKCkgPT09IG5ld0VPTCkge1xuXHRcdFx0Ly8gTm90aGluZyB0byBkb1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9sZEZ1bGxNb2RlbFJhbmdlID0gdGhpcy5nZXRGdWxsTW9kZWxSYW5nZSgpO1xuXHRcdGNvbnN0IG9sZE1vZGVsVmFsdWVMZW5ndGggPSB0aGlzLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShvbGRGdWxsTW9kZWxSYW5nZSk7XG5cdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuZ2V0TGluZUNvdW50KCk7XG5cdFx0Y29uc3QgZW5kQ29sdW1uID0gdGhpcy5nZXRMaW5lTWF4Q29sdW1uKGVuZExpbmVOdW1iZXIpO1xuXG5cdFx0dGhpcy5fb25CZWZvcmVFT0xDaGFuZ2UoKTtcblx0XHR0aGlzLl9idWZmZXIuc2V0RU9MKG5ld0VPTCk7XG5cdFx0dGhpcy5faW5jcmVhc2VWZXJzaW9uSWQoKTtcblx0XHR0aGlzLl9vbkFmdGVyRU9MQ2hhbmdlKCk7XG5cblx0XHR0aGlzLl9lbWl0Q29udGVudENoYW5nZWRFdmVudChcblx0XHRcdG5ldyBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRuZXcgTW9kZWxSYXdFT0xDaGFuZ2VkKClcblx0XHRcdFx0XSxcblx0XHRcdFx0dGhpcy5fdmVyc2lvbklkLFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0ZmFsc2Vcblx0XHRcdCksXG5cdFx0XHR0aGlzLl9jcmVhdGVDb250ZW50Q2hhbmdlZDIobmV3IFJhbmdlKDEsIDEsIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbiksIDAsIG9sZE1vZGVsVmFsdWVMZW5ndGgsIG5ldyBQb3NpdGlvbihlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pLCB0aGlzLmdldFZhbHVlKCksIGZhbHNlLCBmYWxzZSwgZmFsc2UsIHRydWUpXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgX29uQmVmb3JlRU9MQ2hhbmdlKCk6IHZvaWQge1xuXHRcdC8vIEVuc3VyZSBhbGwgZGVjb3JhdGlvbnMgZ2V0IHRoZWlyIGByYW5nZWAgc2V0LlxuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5lbnN1cmVBbGxOb2Rlc0hhdmVSYW5nZXModGhpcyk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkFmdGVyRU9MQ2hhbmdlKCk6IHZvaWQge1xuXHRcdC8vIFRyYW5zZm9ybSBiYWNrIGByYW5nZWAgdG8gb2Zmc2V0c1xuXHRcdGNvbnN0IHZlcnNpb25JZCA9IHRoaXMuZ2V0VmVyc2lvbklkKCk7XG5cdFx0Y29uc3QgYWxsRGVjb3JhdGlvbnMgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUuY29sbGVjdE5vZGVzUG9zdE9yZGVyKCk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGFsbERlY29yYXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBub2RlID0gYWxsRGVjb3JhdGlvbnNbaV07XG5cdFx0XHRjb25zdCByYW5nZSA9IG5vZGUucmFuZ2UhOyAvLyB0aGUgcmFuZ2UgaXMgZGVmaW5lZCBkdWUgdG8gYF9vbkJlZm9yZUVPTENoYW5nZWBcblxuXHRcdFx0Y29uc3QgZGVsdGEgPSBub2RlLmNhY2hlZEFic29sdXRlU3RhcnQgLSBub2RlLnN0YXJ0O1xuXG5cdFx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMuX2J1ZmZlci5nZXRPZmZzZXRBdChyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRcdGNvbnN0IGVuZE9mZnNldCA9IHRoaXMuX2J1ZmZlci5nZXRPZmZzZXRBdChyYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4pO1xuXG5cdFx0XHRub2RlLmNhY2hlZEFic29sdXRlU3RhcnQgPSBzdGFydE9mZnNldDtcblx0XHRcdG5vZGUuY2FjaGVkQWJzb2x1dGVFbmQgPSBlbmRPZmZzZXQ7XG5cdFx0XHRub2RlLmNhY2hlZFZlcnNpb25JZCA9IHZlcnNpb25JZDtcblxuXHRcdFx0bm9kZS5zdGFydCA9IHN0YXJ0T2Zmc2V0IC0gZGVsdGE7XG5cdFx0XHRub2RlLmVuZCA9IGVuZE9mZnNldCAtIGRlbHRhO1xuXG5cdFx0XHRyZWNvbXB1dGVNYXhFbmQobm9kZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG9uQmVmb3JlQXR0YWNoZWQoKTogbW9kZWwuSUF0dGFjaGVkVmlldyB7XG5cdFx0dGhpcy5fYXR0YWNoZWRFZGl0b3JDb3VudCsrO1xuXHRcdGlmICh0aGlzLl9hdHRhY2hlZEVkaXRvckNvdW50ID09PSAxKSB7XG5cdFx0XHR0aGlzLl90b2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0LmhhbmRsZURpZENoYW5nZUF0dGFjaGVkKCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUF0dGFjaGVkLmZpcmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2F0dGFjaGVkVmlld3MuYXR0YWNoVmlldygpO1xuXHR9XG5cblx0cHVibGljIG9uQmVmb3JlRGV0YWNoZWQodmlldzogbW9kZWwuSUF0dGFjaGVkVmlldyk6IHZvaWQge1xuXHRcdHRoaXMuX2F0dGFjaGVkRWRpdG9yQ291bnQtLTtcblx0XHRpZiAodGhpcy5fYXR0YWNoZWRFZGl0b3JDb3VudCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5oYW5kbGVEaWRDaGFuZ2VBdHRhY2hlZCgpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBdHRhY2hlZC5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdHRoaXMuX2F0dGFjaGVkVmlld3MuZGV0YWNoVmlldyh2aWV3KTtcblx0fVxuXG5cdHB1YmxpYyBpc0F0dGFjaGVkVG9FZGl0b3IoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2F0dGFjaGVkRWRpdG9yQ291bnQgPiAwO1xuXHR9XG5cblx0cHVibGljIGdldEF0dGFjaGVkRWRpdG9yQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fYXR0YWNoZWRFZGl0b3JDb3VudDtcblx0fVxuXG5cdHB1YmxpYyBpc1Rvb0xhcmdlRm9yU3luY2luZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNUb29MYXJnZUZvclN5bmNpbmc7XG5cdH1cblxuXHRwdWJsaWMgaXNUb29MYXJnZUZvclRva2VuaXphdGlvbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNUb29MYXJnZUZvclRva2VuaXphdGlvbjtcblx0fVxuXG5cdHB1YmxpYyBpc1Rvb0xhcmdlRm9ySGVhcE9wZXJhdGlvbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNUb29MYXJnZUZvckhlYXBPcGVyYXRpb247XG5cdH1cblxuXHRwdWJsaWMgaXNEaXNwb3NlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNEaXNwb3NlZDtcblx0fVxuXG5cdHB1YmxpYyBpc0RvbWluYXRlZEJ5TG9uZ0xpbmVzKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0aWYgKHRoaXMuaXNUb29MYXJnZUZvclRva2VuaXphdGlvbigpKSB7XG5cdFx0XHQvLyBDYW5ub3Qgd29yZCB3cmFwIGh1Z2UgZmlsZXMgYW55d2F5cywgc28gaXQgZG9lc24ndCByZWFsbHkgbWF0dGVyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGxldCBzbWFsbExpbmVDaGFyQ291bnQgPSAwO1xuXHRcdGxldCBsb25nTGluZUNoYXJDb3VudCA9IDA7XG5cblx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLl9idWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IDE7IGxpbmVOdW1iZXIgPD0gbGluZUNvdW50OyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IGxpbmVMZW5ndGggPSB0aGlzLl9idWZmZXIuZ2V0TGluZUxlbmd0aChsaW5lTnVtYmVyKTtcblx0XHRcdGlmIChsaW5lTGVuZ3RoID49IExPTkdfTElORV9CT1VOREFSWSkge1xuXHRcdFx0XHRsb25nTGluZUNoYXJDb3VudCArPSBsaW5lTGVuZ3RoO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c21hbGxMaW5lQ2hhckNvdW50ICs9IGxpbmVMZW5ndGg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChsb25nTGluZUNoYXJDb3VudCA+IHNtYWxsTGluZUNoYXJDb3VudCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHVyaSgpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLl9hc3NvY2lhdGVkUmVzb3VyY2U7XG5cdH1cblxuXHQvLyNyZWdpb24gT3B0aW9uc1xuXG5cdHB1YmxpYyBnZXRPcHRpb25zKCk6IG1vZGVsLlRleHRNb2RlbFJlc29sdmVkT3B0aW9ucyB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5fb3B0aW9ucztcblx0fVxuXG5cdHB1YmxpYyBnZXRGb3JtYXR0aW5nT3B0aW9ucygpOiBGb3JtYXR0aW5nT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHRhYlNpemU6IHRoaXMuX29wdGlvbnMuaW5kZW50U2l6ZSxcblx0XHRcdGluc2VydFNwYWNlczogdGhpcy5fb3B0aW9ucy5pbnNlcnRTcGFjZXNcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZU9wdGlvbnMoX25ld09wdHM6IG1vZGVsLklUZXh0TW9kZWxVcGRhdGVPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRjb25zdCB0YWJTaXplID0gKHR5cGVvZiBfbmV3T3B0cy50YWJTaXplICE9PSAndW5kZWZpbmVkJykgPyBfbmV3T3B0cy50YWJTaXplIDogdGhpcy5fb3B0aW9ucy50YWJTaXplO1xuXHRcdGNvbnN0IGluZGVudFNpemUgPSAodHlwZW9mIF9uZXdPcHRzLmluZGVudFNpemUgIT09ICd1bmRlZmluZWQnKSA/IF9uZXdPcHRzLmluZGVudFNpemUgOiB0aGlzLl9vcHRpb25zLm9yaWdpbmFsSW5kZW50U2l6ZTtcblx0XHRjb25zdCBpbnNlcnRTcGFjZXMgPSAodHlwZW9mIF9uZXdPcHRzLmluc2VydFNwYWNlcyAhPT0gJ3VuZGVmaW5lZCcpID8gX25ld09wdHMuaW5zZXJ0U3BhY2VzIDogdGhpcy5fb3B0aW9ucy5pbnNlcnRTcGFjZXM7XG5cdFx0Y29uc3QgdHJpbUF1dG9XaGl0ZXNwYWNlID0gKHR5cGVvZiBfbmV3T3B0cy50cmltQXV0b1doaXRlc3BhY2UgIT09ICd1bmRlZmluZWQnKSA/IF9uZXdPcHRzLnRyaW1BdXRvV2hpdGVzcGFjZSA6IHRoaXMuX29wdGlvbnMudHJpbUF1dG9XaGl0ZXNwYWNlO1xuXHRcdGNvbnN0IGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uT3B0aW9ucyA9ICh0eXBlb2YgX25ld09wdHMuYnJhY2tldENvbG9yaXphdGlvbk9wdGlvbnMgIT09ICd1bmRlZmluZWQnKSA/IF9uZXdPcHRzLmJyYWNrZXRDb2xvcml6YXRpb25PcHRpb25zIDogdGhpcy5fb3B0aW9ucy5icmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnM7XG5cblx0XHRjb25zdCBuZXdPcHRzID0gbmV3IG1vZGVsLlRleHRNb2RlbFJlc29sdmVkT3B0aW9ucyh7XG5cdFx0XHR0YWJTaXplOiB0YWJTaXplLFxuXHRcdFx0aW5kZW50U2l6ZTogaW5kZW50U2l6ZSxcblx0XHRcdGluc2VydFNwYWNlczogaW5zZXJ0U3BhY2VzLFxuXHRcdFx0ZGVmYXVsdEVPTDogdGhpcy5fb3B0aW9ucy5kZWZhdWx0RU9MLFxuXHRcdFx0dHJpbUF1dG9XaGl0ZXNwYWNlOiB0cmltQXV0b1doaXRlc3BhY2UsXG5cdFx0XHRicmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnMsXG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5fb3B0aW9ucy5lcXVhbHMobmV3T3B0cykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlID0gdGhpcy5fb3B0aW9ucy5jcmVhdGVDaGFuZ2VFdmVudChuZXdPcHRzKTtcblx0XHR0aGlzLl9vcHRpb25zID0gbmV3T3B0cztcblxuXHRcdHRoaXMuX2JyYWNrZXRQYWlycy5oYW5kbGVEaWRDaGFuZ2VPcHRpb25zKGUpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25Qcm92aWRlci5oYW5kbGVEaWRDaGFuZ2VPcHRpb25zKGUpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlT3B0aW9ucy5maXJlKGUpO1xuXHR9XG5cblx0cHVibGljIGRldGVjdEluZGVudGF0aW9uKGRlZmF1bHRJbnNlcnRTcGFjZXM6IGJvb2xlYW4sIGRlZmF1bHRUYWJTaXplOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdGNvbnN0IGd1ZXNzZWRJbmRlbnRhdGlvbiA9IGd1ZXNzSW5kZW50YXRpb24odGhpcy5fYnVmZmVyLCBkZWZhdWx0VGFiU2l6ZSwgZGVmYXVsdEluc2VydFNwYWNlcyk7XG5cdFx0dGhpcy51cGRhdGVPcHRpb25zKHtcblx0XHRcdGluc2VydFNwYWNlczogZ3Vlc3NlZEluZGVudGF0aW9uLmluc2VydFNwYWNlcyxcblx0XHRcdHRhYlNpemU6IGd1ZXNzZWRJbmRlbnRhdGlvbi50YWJTaXplLFxuXHRcdFx0aW5kZW50U2l6ZTogZ3Vlc3NlZEluZGVudGF0aW9uLnRhYlNpemUsIC8vIFRPRE9AQWxleDogZ3Vlc3MgaW5kZW50U2l6ZSBpbmRlcGVuZGVudCBvZiB0YWJTaXplXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgbm9ybWFsaXplSW5kZW50YXRpb24oc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0cmV0dXJuIG5vcm1hbGl6ZUluZGVudGF0aW9uKHN0ciwgdGhpcy5fb3B0aW9ucy5pbmRlbnRTaXplLCB0aGlzLl9vcHRpb25zLmluc2VydFNwYWNlcyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gUmVhZGluZ1xuXG5cdHB1YmxpYyBnZXRWZXJzaW9uSWQoKTogbnVtYmVyIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdHJldHVybiB0aGlzLl92ZXJzaW9uSWQ7XG5cdH1cblxuXHRwdWJsaWMgbWlnaHRDb250YWluUlRMKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9idWZmZXIubWlnaHRDb250YWluUlRMKCk7XG5cdH1cblxuXHRwdWJsaWMgbWlnaHRDb250YWluVW51c3VhbExpbmVUZXJtaW5hdG9ycygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyLm1pZ2h0Q29udGFpblVudXN1YWxMaW5lVGVybWluYXRvcnMoKTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVVbnVzdWFsTGluZVRlcm1pbmF0b3JzKHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdIHwgbnVsbCA9IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCBtYXRjaGVzID0gdGhpcy5maW5kTWF0Y2hlcyhzdHJpbmdzLlVOVVNVQUxfTElORV9URVJNSU5BVE9SUy5zb3VyY2UsIGZhbHNlLCB0cnVlLCBmYWxzZSwgbnVsbCwgZmFsc2UsIENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSKTtcblx0XHR0aGlzLl9idWZmZXIucmVzZXRNaWdodENvbnRhaW5VbnVzdWFsTGluZVRlcm1pbmF0b3JzKCk7XG5cdFx0dGhpcy5wdXNoRWRpdE9wZXJhdGlvbnMoc2VsZWN0aW9ucywgbWF0Y2hlcy5tYXAobSA9PiAoeyByYW5nZTogbS5yYW5nZSwgdGV4dDogbnVsbCB9KSksICgpID0+IG51bGwpO1xuXHR9XG5cblx0cHVibGljIG1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2J1ZmZlci5taWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKTogbnVtYmVyIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdHJldHVybiB0aGlzLl9hbHRlcm5hdGl2ZVZlcnNpb25JZDtcblx0fVxuXG5cdHB1YmxpYyBnZXRJbml0aWFsVW5kb1JlZG9TbmFwc2hvdCgpOiBSZXNvdXJjZUVkaXRTdGFja1NuYXBzaG90IHwgbnVsbCB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5faW5pdGlhbFVuZG9SZWRvU25hcHNob3Q7XG5cdH1cblxuXHRwdWJsaWMgZ2V0T2Zmc2V0QXQocmF3UG9zaXRpb246IElQb3NpdGlvbik6IG51bWJlciB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX3ZhbGlkYXRlUG9zaXRpb24ocmF3UG9zaXRpb24ubGluZU51bWJlciwgcmF3UG9zaXRpb24uY29sdW1uLCBTdHJpbmdPZmZzZXRWYWxpZGF0aW9uVHlwZS5SZWxheGVkKTtcblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyLmdldE9mZnNldEF0KHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UG9zaXRpb25BdChyYXdPZmZzZXQ6IG51bWJlcik6IFBvc2l0aW9uIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdGNvbnN0IG9mZnNldCA9IChNYXRoLm1pbih0aGlzLl9idWZmZXIuZ2V0TGVuZ3RoKCksIE1hdGgubWF4KDAsIHJhd09mZnNldCkpKTtcblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyLmdldFBvc2l0aW9uQXQob2Zmc2V0KTtcblx0fVxuXG5cdHByaXZhdGUgX2luY3JlYXNlVmVyc2lvbklkKCk6IHZvaWQge1xuXHRcdHRoaXMuX3ZlcnNpb25JZCA9IHRoaXMuX3ZlcnNpb25JZCArIDE7XG5cdFx0dGhpcy5fYWx0ZXJuYXRpdmVWZXJzaW9uSWQgPSB0aGlzLl92ZXJzaW9uSWQ7XG5cdH1cblxuXHRwdWJsaWMgX292ZXJ3cml0ZVZlcnNpb25JZCh2ZXJzaW9uSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3ZlcnNpb25JZCA9IHZlcnNpb25JZDtcblx0fVxuXG5cdHB1YmxpYyBfb3ZlcndyaXRlQWx0ZXJuYXRpdmVWZXJzaW9uSWQobmV3QWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2FsdGVybmF0aXZlVmVyc2lvbklkID0gbmV3QWx0ZXJuYXRpdmVWZXJzaW9uSWQ7XG5cdH1cblxuXHRwdWJsaWMgX292ZXJ3cml0ZUluaXRpYWxVbmRvUmVkb1NuYXBzaG90KG5ld0luaXRpYWxVbmRvUmVkb1NuYXBzaG90OiBSZXNvdXJjZUVkaXRTdGFja1NuYXBzaG90IHwgbnVsbCk6IHZvaWQge1xuXHRcdHRoaXMuX2luaXRpYWxVbmRvUmVkb1NuYXBzaG90ID0gbmV3SW5pdGlhbFVuZG9SZWRvU25hcHNob3Q7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmFsdWUoZW9sPzogbW9kZWwuRW5kT2ZMaW5lUHJlZmVyZW5jZSwgcHJlc2VydmVCT006IGJvb2xlYW4gPSBmYWxzZSk6IHN0cmluZyB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRpZiAodGhpcy5pc1Rvb0xhcmdlRm9ySGVhcE9wZXJhdGlvbigpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdPcGVyYXRpb24gd291bGQgZXhjZWVkIGhlYXAgbWVtb3J5IGxpbWl0cycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZ1bGxNb2RlbFJhbmdlID0gdGhpcy5nZXRGdWxsTW9kZWxSYW5nZSgpO1xuXHRcdGNvbnN0IGZ1bGxNb2RlbFZhbHVlID0gdGhpcy5nZXRWYWx1ZUluUmFuZ2UoZnVsbE1vZGVsUmFuZ2UsIGVvbCk7XG5cblx0XHRpZiAocHJlc2VydmVCT00pIHtcblx0XHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0Qk9NKCkgKyBmdWxsTW9kZWxWYWx1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZnVsbE1vZGVsVmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlU25hcHNob3QocHJlc2VydmVCT006IGJvb2xlYW4gPSBmYWxzZSk6IG1vZGVsLklUZXh0U25hcHNob3Qge1xuXHRcdHJldHVybiBuZXcgVGV4dE1vZGVsU25hcHNob3QodGhpcy5fYnVmZmVyLmNyZWF0ZVNuYXBzaG90KHByZXNlcnZlQk9NKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmFsdWVMZW5ndGgoZW9sPzogbW9kZWwuRW5kT2ZMaW5lUHJlZmVyZW5jZSwgcHJlc2VydmVCT006IGJvb2xlYW4gPSBmYWxzZSk6IG51bWJlciB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRjb25zdCBmdWxsTW9kZWxSYW5nZSA9IHRoaXMuZ2V0RnVsbE1vZGVsUmFuZ2UoKTtcblx0XHRjb25zdCBmdWxsTW9kZWxWYWx1ZSA9IHRoaXMuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKGZ1bGxNb2RlbFJhbmdlLCBlb2wpO1xuXG5cdFx0aWYgKHByZXNlcnZlQk9NKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyLmdldEJPTSgpLmxlbmd0aCArIGZ1bGxNb2RlbFZhbHVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmdWxsTW9kZWxWYWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWYWx1ZUluUmFuZ2UocmF3UmFuZ2U6IElSYW5nZSwgZW9sOiBtb2RlbC5FbmRPZkxpbmVQcmVmZXJlbmNlID0gbW9kZWwuRW5kT2ZMaW5lUHJlZmVyZW5jZS5UZXh0RGVmaW5lZCk6IHN0cmluZyB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyLmdldFZhbHVlSW5SYW5nZSh0aGlzLnZhbGlkYXRlUmFuZ2UocmF3UmFuZ2UpLCBlb2wpO1xuXHR9XG5cblx0cHVibGljIGdldFZhbHVlTGVuZ3RoSW5SYW5nZShyYXdSYW5nZTogSVJhbmdlLCBlb2w6IG1vZGVsLkVuZE9mTGluZVByZWZlcmVuY2UgPSBtb2RlbC5FbmRPZkxpbmVQcmVmZXJlbmNlLlRleHREZWZpbmVkKTogbnVtYmVyIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKHRoaXMudmFsaWRhdGVSYW5nZShyYXdSYW5nZSksIGVvbCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q2hhcmFjdGVyQ291bnRJblJhbmdlKHJhd1JhbmdlOiBJUmFuZ2UsIGVvbDogbW9kZWwuRW5kT2ZMaW5lUHJlZmVyZW5jZSA9IG1vZGVsLkVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpOiBudW1iZXIge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0cmV0dXJuIHRoaXMuX2J1ZmZlci5nZXRDaGFyYWN0ZXJDb3VudEluUmFuZ2UodGhpcy52YWxpZGF0ZVJhbmdlKHJhd1JhbmdlKSwgZW9sKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lQ291bnQoKTogbnVtYmVyIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdGlmIChsaW5lTnVtYmVyIDwgMSB8fCBsaW5lTnVtYmVyID4gdGhpcy5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignSWxsZWdhbCB2YWx1ZSBmb3IgbGluZU51bWJlcicpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZUxlbmd0aChsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0aWYgKGxpbmVOdW1iZXIgPCAxIHx8IGxpbmVOdW1iZXIgPiB0aGlzLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdJbGxlZ2FsIHZhbHVlIGZvciBsaW5lTnVtYmVyJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2J1ZmZlci5nZXRMaW5lTGVuZ3RoKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVzQ29udGVudCgpOiBzdHJpbmdbXSB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRpZiAodGhpcy5pc1Rvb0xhcmdlRm9ySGVhcE9wZXJhdGlvbigpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdPcGVyYXRpb24gd291bGQgZXhjZWVkIGhlYXAgbWVtb3J5IGxpbWl0cycpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0TGluZXNDb250ZW50KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RU9MKCk6IHN0cmluZyB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVyLmdldEVPTCgpO1xuXHR9XG5cblx0cHVibGljIGdldEVuZE9mTGluZVNlcXVlbmNlKCk6IG1vZGVsLkVuZE9mTGluZVNlcXVlbmNlIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdHJldHVybiAoXG5cdFx0XHR0aGlzLl9idWZmZXIuZ2V0RU9MKCkgPT09ICdcXG4nXG5cdFx0XHRcdD8gbW9kZWwuRW5kT2ZMaW5lU2VxdWVuY2UuTEZcblx0XHRcdFx0OiBtb2RlbC5FbmRPZkxpbmVTZXF1ZW5jZS5DUkxGXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lTWluQ29sdW1uKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRpZiAobGluZU51bWJlciA8IDEgfHwgbGluZU51bWJlciA+IHRoaXMuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0lsbGVnYWwgdmFsdWUgZm9yIGxpbmVOdW1iZXInKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2J1ZmZlci5nZXRMaW5lTGVuZ3RoKGxpbmVOdW1iZXIpICsgMTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRpZiAobGluZU51bWJlciA8IDEgfHwgbGluZU51bWJlciA+IHRoaXMuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0lsbGVnYWwgdmFsdWUgZm9yIGxpbmVOdW1iZXInKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2J1ZmZlci5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0aWYgKGxpbmVOdW1iZXIgPCAxIHx8IGxpbmVOdW1iZXIgPiB0aGlzLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdJbGxlZ2FsIHZhbHVlIGZvciBsaW5lTnVtYmVyJyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFZhbGlkYXRlcyBgcmFuZ2VgIGlzIHdpdGhpbiBidWZmZXIgYm91bmRzLCBidXQgYWxsb3dzIGl0IHRvIHNpdCBpbiBiZXR3ZWVuIHN1cnJvZ2F0ZSBwYWlycywgZXRjLlxuXHQgKiBXaWxsIHRyeSB0byBub3QgYWxsb2NhdGUgaWYgcG9zc2libGUuXG5cdCAqL1xuXHRwdWJsaWMgX3ZhbGlkYXRlUmFuZ2VSZWxheGVkTm9BbGxvY2F0aW9ucyhyYW5nZTogSVJhbmdlKTogUmFuZ2Uge1xuXHRcdGNvbnN0IGxpbmVzQ291bnQgPSB0aGlzLl9idWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cblx0XHRjb25zdCBpbml0aWFsU3RhcnRMaW5lTnVtYmVyID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IGluaXRpYWxTdGFydENvbHVtbiA9IHJhbmdlLnN0YXJ0Q29sdW1uO1xuXHRcdGxldCBzdGFydExpbmVOdW1iZXIgPSBNYXRoLmZsb29yKCh0eXBlb2YgaW5pdGlhbFN0YXJ0TGluZU51bWJlciA9PT0gJ251bWJlcicgJiYgIWlzTmFOKGluaXRpYWxTdGFydExpbmVOdW1iZXIpKSA/IGluaXRpYWxTdGFydExpbmVOdW1iZXIgOiAxKTtcblx0XHRsZXQgc3RhcnRDb2x1bW4gPSBNYXRoLmZsb29yKCh0eXBlb2YgaW5pdGlhbFN0YXJ0Q29sdW1uID09PSAnbnVtYmVyJyAmJiAhaXNOYU4oaW5pdGlhbFN0YXJ0Q29sdW1uKSkgPyBpbml0aWFsU3RhcnRDb2x1bW4gOiAxKTtcblxuXHRcdGlmIChzdGFydExpbmVOdW1iZXIgPCAxKSB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXIgPSAxO1xuXHRcdFx0c3RhcnRDb2x1bW4gPSAxO1xuXHRcdH0gZWxzZSBpZiAoc3RhcnRMaW5lTnVtYmVyID4gbGluZXNDb3VudCkge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyID0gbGluZXNDb3VudDtcblx0XHRcdHN0YXJ0Q29sdW1uID0gdGhpcy5nZXRMaW5lTWF4Q29sdW1uKHN0YXJ0TGluZU51bWJlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChzdGFydENvbHVtbiA8PSAxKSB7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uID0gMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG1heENvbHVtbiA9IHRoaXMuZ2V0TGluZU1heENvbHVtbihzdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRpZiAoc3RhcnRDb2x1bW4gPj0gbWF4Q29sdW1uKSB7XG5cdFx0XHRcdFx0c3RhcnRDb2x1bW4gPSBtYXhDb2x1bW47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBpbml0aWFsRW5kTGluZU51bWJlciA9IHJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgaW5pdGlhbEVuZENvbHVtbiA9IHJhbmdlLmVuZENvbHVtbjtcblx0XHRsZXQgZW5kTGluZU51bWJlciA9IE1hdGguZmxvb3IoKHR5cGVvZiBpbml0aWFsRW5kTGluZU51bWJlciA9PT0gJ251bWJlcicgJiYgIWlzTmFOKGluaXRpYWxFbmRMaW5lTnVtYmVyKSkgPyBpbml0aWFsRW5kTGluZU51bWJlciA6IDEpO1xuXHRcdGxldCBlbmRDb2x1bW4gPSBNYXRoLmZsb29yKCh0eXBlb2YgaW5pdGlhbEVuZENvbHVtbiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKGluaXRpYWxFbmRDb2x1bW4pKSA/IGluaXRpYWxFbmRDb2x1bW4gOiAxKTtcblxuXHRcdGlmIChlbmRMaW5lTnVtYmVyIDwgMSkge1xuXHRcdFx0ZW5kTGluZU51bWJlciA9IDE7XG5cdFx0XHRlbmRDb2x1bW4gPSAxO1xuXHRcdH0gZWxzZSBpZiAoZW5kTGluZU51bWJlciA+IGxpbmVzQ291bnQpIHtcblx0XHRcdGVuZExpbmVOdW1iZXIgPSBsaW5lc0NvdW50O1xuXHRcdFx0ZW5kQ29sdW1uID0gdGhpcy5nZXRMaW5lTWF4Q29sdW1uKGVuZExpbmVOdW1iZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoZW5kQ29sdW1uIDw9IDEpIHtcblx0XHRcdFx0ZW5kQ29sdW1uID0gMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG1heENvbHVtbiA9IHRoaXMuZ2V0TGluZU1heENvbHVtbihlbmRMaW5lTnVtYmVyKTtcblx0XHRcdFx0aWYgKGVuZENvbHVtbiA+PSBtYXhDb2x1bW4pIHtcblx0XHRcdFx0XHRlbmRDb2x1bW4gPSBtYXhDb2x1bW47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHRpbml0aWFsU3RhcnRMaW5lTnVtYmVyID09PSBzdGFydExpbmVOdW1iZXJcblx0XHRcdCYmIGluaXRpYWxTdGFydENvbHVtbiA9PT0gc3RhcnRDb2x1bW5cblx0XHRcdCYmIGluaXRpYWxFbmRMaW5lTnVtYmVyID09PSBlbmRMaW5lTnVtYmVyXG5cdFx0XHQmJiBpbml0aWFsRW5kQ29sdW1uID09PSBlbmRDb2x1bW5cblx0XHRcdCYmIHJhbmdlIGluc3RhbmNlb2YgUmFuZ2Vcblx0XHRcdCYmICEocmFuZ2UgaW5zdGFuY2VvZiBTZWxlY3Rpb24pXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gcmFuZ2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNWYWxpZFBvc2l0aW9uKGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIsIHZhbGlkYXRpb25UeXBlOiBTdHJpbmdPZmZzZXRWYWxpZGF0aW9uVHlwZSk6IGJvb2xlYW4ge1xuXHRcdGlmICh0eXBlb2YgbGluZU51bWJlciAhPT0gJ251bWJlcicgfHwgdHlwZW9mIGNvbHVtbiAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoaXNOYU4obGluZU51bWJlcikgfHwgaXNOYU4oY29sdW1uKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChsaW5lTnVtYmVyIDwgMSB8fCBjb2x1bW4gPCAxKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKChsaW5lTnVtYmVyIHwgMCkgIT09IGxpbmVOdW1iZXIgfHwgKGNvbHVtbiB8IDApICE9PSBjb2x1bW4pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLl9idWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cdFx0aWYgKGxpbmVOdW1iZXIgPiBsaW5lQ291bnQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoY29sdW1uID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBtYXhDb2x1bW4gPSB0aGlzLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0aWYgKGNvbHVtbiA+IG1heENvbHVtbikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh2YWxpZGF0aW9uVHlwZSA9PT0gU3RyaW5nT2Zmc2V0VmFsaWRhdGlvblR5cGUuU3Vycm9nYXRlUGFpcnMpIHtcblx0XHRcdC8vICEhQXQgdGhpcyBwb2ludCwgY29sdW1uID4gMVxuXHRcdFx0Y29uc3QgY2hhckNvZGVCZWZvcmUgPSB0aGlzLl9idWZmZXIuZ2V0TGluZUNoYXJDb2RlKGxpbmVOdW1iZXIsIGNvbHVtbiAtIDIpO1xuXHRcdFx0aWYgKHN0cmluZ3MuaXNIaWdoU3Vycm9nYXRlKGNoYXJDb2RlQmVmb3JlKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIF92YWxpZGF0ZVBvc2l0aW9uKF9saW5lTnVtYmVyOiBudW1iZXIsIF9jb2x1bW46IG51bWJlciwgdmFsaWRhdGlvblR5cGU6IFN0cmluZ09mZnNldFZhbGlkYXRpb25UeXBlKTogUG9zaXRpb24ge1xuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBNYXRoLmZsb29yKCh0eXBlb2YgX2xpbmVOdW1iZXIgPT09ICdudW1iZXInICYmICFpc05hTihfbGluZU51bWJlcikpID8gX2xpbmVOdW1iZXIgOiAxKTtcblx0XHRjb25zdCBjb2x1bW4gPSBNYXRoLmZsb29yKCh0eXBlb2YgX2NvbHVtbiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKF9jb2x1bW4pKSA/IF9jb2x1bW4gOiAxKTtcblx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLl9idWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cblx0XHRpZiAobGluZU51bWJlciA8IDEpIHtcblx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24oMSwgMSk7XG5cdFx0fVxuXG5cdFx0aWYgKGxpbmVOdW1iZXIgPiBsaW5lQ291bnQpIHtcblx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZUNvdW50LCB0aGlzLmdldExpbmVNYXhDb2x1bW4obGluZUNvdW50KSk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbHVtbiA8PSAxKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIDEpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1heENvbHVtbiA9IHRoaXMuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKTtcblx0XHRpZiAoY29sdW1uID49IG1heENvbHVtbikge1xuXHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBtYXhDb2x1bW4pO1xuXHRcdH1cblxuXHRcdGlmICh2YWxpZGF0aW9uVHlwZSA9PT0gU3RyaW5nT2Zmc2V0VmFsaWRhdGlvblR5cGUuU3Vycm9nYXRlUGFpcnMpIHtcblx0XHRcdC8vIElmIHRoZSBwb3NpdGlvbiB3b3VsZCBlbmQgdXAgaW4gdGhlIG1pZGRsZSBvZiBhIGhpZ2gtbG93IHN1cnJvZ2F0ZSBwYWlyLFxuXHRcdFx0Ly8gd2UgbW92ZSBpdCB0byBiZWZvcmUgdGhlIHBhaXJcblx0XHRcdC8vICEhQXQgdGhpcyBwb2ludCwgY29sdW1uID4gMVxuXHRcdFx0Y29uc3QgY2hhckNvZGVCZWZvcmUgPSB0aGlzLl9idWZmZXIuZ2V0TGluZUNoYXJDb2RlKGxpbmVOdW1iZXIsIGNvbHVtbiAtIDIpO1xuXHRcdFx0aWYgKHN0cmluZ3MuaXNIaWdoU3Vycm9nYXRlKGNoYXJDb2RlQmVmb3JlKSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbiAtIDEpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZVBvc2l0aW9uKHBvc2l0aW9uOiBJUG9zaXRpb24pOiBQb3NpdGlvbiB7XG5cdFx0Y29uc3QgdmFsaWRhdGlvblR5cGUgPSBTdHJpbmdPZmZzZXRWYWxpZGF0aW9uVHlwZS5TdXJyb2dhdGVQYWlycztcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXG5cdFx0Ly8gQXZvaWQgb2JqZWN0IGFsbG9jYXRpb24gYW5kIGNvdmVyIG1vc3QgbGlrZWx5IGNhc2Vcblx0XHRpZiAocG9zaXRpb24gaW5zdGFuY2VvZiBQb3NpdGlvbikge1xuXHRcdFx0aWYgKHRoaXMuX2lzVmFsaWRQb3NpdGlvbihwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4sIHZhbGlkYXRpb25UeXBlKSkge1xuXHRcdFx0XHRyZXR1cm4gcG9zaXRpb247XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3ZhbGlkYXRlUG9zaXRpb24ocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCB2YWxpZGF0aW9uVHlwZSk7XG5cdH1cblxuXHRwdWJsaWMgaXNWYWxpZFJhbmdlKHJhbmdlOiBSYW5nZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9pc1ZhbGlkUmFuZ2UocmFuZ2UsIFN0cmluZ09mZnNldFZhbGlkYXRpb25UeXBlLlN1cnJvZ2F0ZVBhaXJzKTtcblx0fVxuXG5cdHByaXZhdGUgX2lzVmFsaWRSYW5nZShyYW5nZTogUmFuZ2UsIHZhbGlkYXRpb25UeXBlOiBTdHJpbmdPZmZzZXRWYWxpZGF0aW9uVHlwZSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBzdGFydENvbHVtbiA9IHJhbmdlLnN0YXJ0Q29sdW1uO1xuXHRcdGNvbnN0IGVuZExpbmVOdW1iZXIgPSByYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IGVuZENvbHVtbiA9IHJhbmdlLmVuZENvbHVtbjtcblxuXHRcdGlmICghdGhpcy5faXNWYWxpZFBvc2l0aW9uKHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sIFN0cmluZ09mZnNldFZhbGlkYXRpb25UeXBlLlJlbGF4ZWQpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5faXNWYWxpZFBvc2l0aW9uKGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbiwgU3RyaW5nT2Zmc2V0VmFsaWRhdGlvblR5cGUuUmVsYXhlZCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodmFsaWRhdGlvblR5cGUgPT09IFN0cmluZ09mZnNldFZhbGlkYXRpb25UeXBlLlN1cnJvZ2F0ZVBhaXJzKSB7XG5cdFx0XHRjb25zdCBjaGFyQ29kZUJlZm9yZVN0YXJ0ID0gKHN0YXJ0Q29sdW1uID4gMSA/IHRoaXMuX2J1ZmZlci5nZXRMaW5lQ2hhckNvZGUoc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiAtIDIpIDogMCk7XG5cdFx0XHRjb25zdCBjaGFyQ29kZUJlZm9yZUVuZCA9IChlbmRDb2x1bW4gPiAxICYmIGVuZENvbHVtbiA8PSB0aGlzLl9idWZmZXIuZ2V0TGluZUxlbmd0aChlbmRMaW5lTnVtYmVyKSA/IHRoaXMuX2J1ZmZlci5nZXRMaW5lQ2hhckNvZGUoZW5kTGluZU51bWJlciwgZW5kQ29sdW1uIC0gMikgOiAwKTtcblxuXHRcdFx0Y29uc3Qgc3RhcnRJbnNpZGVTdXJyb2dhdGVQYWlyID0gc3RyaW5ncy5pc0hpZ2hTdXJyb2dhdGUoY2hhckNvZGVCZWZvcmVTdGFydCk7XG5cdFx0XHRjb25zdCBlbmRJbnNpZGVTdXJyb2dhdGVQYWlyID0gc3RyaW5ncy5pc0hpZ2hTdXJyb2dhdGUoY2hhckNvZGVCZWZvcmVFbmQpO1xuXG5cdFx0XHRpZiAoIXN0YXJ0SW5zaWRlU3Vycm9nYXRlUGFpciAmJiAhZW5kSW5zaWRlU3Vycm9nYXRlUGFpcikge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZVJhbmdlKF9yYW5nZTogSVJhbmdlKTogUmFuZ2Uge1xuXHRcdGNvbnN0IHZhbGlkYXRpb25UeXBlID0gU3RyaW5nT2Zmc2V0VmFsaWRhdGlvblR5cGUuU3Vycm9nYXRlUGFpcnM7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblxuXHRcdC8vIEF2b2lkIG9iamVjdCBhbGxvY2F0aW9uIGFuZCBjb3ZlciBtb3N0IGxpa2VseSBjYXNlXG5cdFx0aWYgKChfcmFuZ2UgaW5zdGFuY2VvZiBSYW5nZSkgJiYgIShfcmFuZ2UgaW5zdGFuY2VvZiBTZWxlY3Rpb24pKSB7XG5cdFx0XHRpZiAodGhpcy5faXNWYWxpZFJhbmdlKF9yYW5nZSwgdmFsaWRhdGlvblR5cGUpKSB7XG5cdFx0XHRcdHJldHVybiBfcmFuZ2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhcnQgPSB0aGlzLl92YWxpZGF0ZVBvc2l0aW9uKF9yYW5nZS5zdGFydExpbmVOdW1iZXIsIF9yYW5nZS5zdGFydENvbHVtbiwgU3RyaW5nT2Zmc2V0VmFsaWRhdGlvblR5cGUuUmVsYXhlZCk7XG5cdFx0Y29uc3QgZW5kID0gdGhpcy5fdmFsaWRhdGVQb3NpdGlvbihfcmFuZ2UuZW5kTGluZU51bWJlciwgX3JhbmdlLmVuZENvbHVtbiwgU3RyaW5nT2Zmc2V0VmFsaWRhdGlvblR5cGUuUmVsYXhlZCk7XG5cblx0XHRjb25zdCBzdGFydExpbmVOdW1iZXIgPSBzdGFydC5saW5lTnVtYmVyO1xuXHRcdGNvbnN0IHN0YXJ0Q29sdW1uID0gc3RhcnQuY29sdW1uO1xuXHRcdGNvbnN0IGVuZExpbmVOdW1iZXIgPSBlbmQubGluZU51bWJlcjtcblx0XHRjb25zdCBlbmRDb2x1bW4gPSBlbmQuY29sdW1uO1xuXG5cdFx0aWYgKHZhbGlkYXRpb25UeXBlID09PSBTdHJpbmdPZmZzZXRWYWxpZGF0aW9uVHlwZS5TdXJyb2dhdGVQYWlycykge1xuXHRcdFx0Y29uc3QgY2hhckNvZGVCZWZvcmVTdGFydCA9IChzdGFydENvbHVtbiA+IDEgPyB0aGlzLl9idWZmZXIuZ2V0TGluZUNoYXJDb2RlKHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4gLSAyKSA6IDApO1xuXHRcdFx0Y29uc3QgY2hhckNvZGVCZWZvcmVFbmQgPSAoZW5kQ29sdW1uID4gMSAmJiBlbmRDb2x1bW4gPD0gdGhpcy5fYnVmZmVyLmdldExpbmVMZW5ndGgoZW5kTGluZU51bWJlcikgPyB0aGlzLl9idWZmZXIuZ2V0TGluZUNoYXJDb2RlKGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbiAtIDIpIDogMCk7XG5cblx0XHRcdGNvbnN0IHN0YXJ0SW5zaWRlU3Vycm9nYXRlUGFpciA9IHN0cmluZ3MuaXNIaWdoU3Vycm9nYXRlKGNoYXJDb2RlQmVmb3JlU3RhcnQpO1xuXHRcdFx0Y29uc3QgZW5kSW5zaWRlU3Vycm9nYXRlUGFpciA9IHN0cmluZ3MuaXNIaWdoU3Vycm9nYXRlKGNoYXJDb2RlQmVmb3JlRW5kKTtcblxuXHRcdFx0aWYgKCFzdGFydEluc2lkZVN1cnJvZ2F0ZVBhaXIgJiYgIWVuZEluc2lkZVN1cnJvZ2F0ZVBhaXIpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RhcnRMaW5lTnVtYmVyID09PSBlbmRMaW5lTnVtYmVyICYmIHN0YXJ0Q29sdW1uID09PSBlbmRDb2x1bW4pIHtcblx0XHRcdFx0Ly8gZG8gbm90IGV4cGFuZCBhIGNvbGxhcHNlZCByYW5nZSwgc2ltcGx5IG1vdmUgaXQgdG8gYSB2YWxpZCBsb2NhdGlvblxuXHRcdFx0XHRyZXR1cm4gbmV3IFJhbmdlKHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4gLSAxLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4gLSAxKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXJ0SW5zaWRlU3Vycm9nYXRlUGFpciAmJiBlbmRJbnNpZGVTdXJyb2dhdGVQYWlyKSB7XG5cdFx0XHRcdC8vIGV4cGFuZCByYW5nZSBhdCBib3RoIGVuZHNcblx0XHRcdFx0cmV0dXJuIG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uIC0gMSwgZW5kTGluZU51bWJlciwgZW5kQ29sdW1uICsgMSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGFydEluc2lkZVN1cnJvZ2F0ZVBhaXIpIHtcblx0XHRcdFx0Ly8gb25seSBleHBhbmQgcmFuZ2UgYXQgdGhlIHN0YXJ0XG5cdFx0XHRcdHJldHVybiBuZXcgUmFuZ2Uoc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiAtIDEsIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIG9ubHkgZXhwYW5kIHJhbmdlIGF0IHRoZSBlbmRcblx0XHRcdHJldHVybiBuZXcgUmFuZ2Uoc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgZW5kTGluZU51bWJlciwgZW5kQ29sdW1uICsgMSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pO1xuXHR9XG5cblx0cHVibGljIG1vZGlmeVBvc2l0aW9uKHJhd1Bvc2l0aW9uOiBJUG9zaXRpb24sIG9mZnNldDogbnVtYmVyKTogUG9zaXRpb24ge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0Y29uc3QgY2FuZGlkYXRlID0gdGhpcy5nZXRPZmZzZXRBdChyYXdQb3NpdGlvbikgKyBvZmZzZXQ7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UG9zaXRpb25BdChNYXRoLm1pbih0aGlzLl9idWZmZXIuZ2V0TGVuZ3RoKCksIE1hdGgubWF4KDAsIGNhbmRpZGF0ZSkpKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRGdWxsTW9kZWxSYW5nZSgpOiBSYW5nZSB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLmdldExpbmVDb3VudCgpO1xuXHRcdHJldHVybiBuZXcgUmFuZ2UoMSwgMSwgbGluZUNvdW50LCB0aGlzLmdldExpbmVNYXhDb2x1bW4obGluZUNvdW50KSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRNYXRjaGVzTGluZUJ5TGluZShzZWFyY2hSYW5nZTogUmFuZ2UsIHNlYXJjaERhdGE6IG1vZGVsLlNlYXJjaERhdGEsIGNhcHR1cmVNYXRjaGVzOiBib29sZWFuLCBsaW1pdFJlc3VsdENvdW50OiBudW1iZXIpOiBtb2RlbC5GaW5kTWF0Y2hbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2J1ZmZlci5maW5kTWF0Y2hlc0xpbmVCeUxpbmUoc2VhcmNoUmFuZ2UsIHNlYXJjaERhdGEsIGNhcHR1cmVNYXRjaGVzLCBsaW1pdFJlc3VsdENvdW50KTtcblx0fVxuXG5cdHB1YmxpYyBmaW5kTWF0Y2hlcyhzZWFyY2hTdHJpbmc6IHN0cmluZywgcmF3U2VhcmNoU2NvcGU6IGFueSwgaXNSZWdleDogYm9vbGVhbiwgbWF0Y2hDYXNlOiBib29sZWFuLCB3b3JkU2VwYXJhdG9yczogc3RyaW5nIHwgbnVsbCwgY2FwdHVyZU1hdGNoZXM6IGJvb2xlYW4sIGxpbWl0UmVzdWx0Q291bnQ6IG51bWJlciA9IExJTUlUX0ZJTkRfQ09VTlQpOiBtb2RlbC5GaW5kTWF0Y2hbXSB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblxuXHRcdGxldCBzZWFyY2hSYW5nZXM6IFJhbmdlW10gfCBudWxsID0gbnVsbDtcblxuXHRcdGlmIChyYXdTZWFyY2hTY29wZSAhPT0gbnVsbCkge1xuXHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KHJhd1NlYXJjaFNjb3BlKSkge1xuXHRcdFx0XHRyYXdTZWFyY2hTY29wZSA9IFtyYXdTZWFyY2hTY29wZV07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyYXdTZWFyY2hTY29wZS5ldmVyeSgoc2VhcmNoU2NvcGU6IFJhbmdlKSA9PiBSYW5nZS5pc0lSYW5nZShzZWFyY2hTY29wZSkpKSB7XG5cdFx0XHRcdHNlYXJjaFJhbmdlcyA9IHJhd1NlYXJjaFNjb3BlLm1hcCgoc2VhcmNoU2NvcGU6IFJhbmdlKSA9PiB0aGlzLnZhbGlkYXRlUmFuZ2Uoc2VhcmNoU2NvcGUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoc2VhcmNoUmFuZ2VzID09PSBudWxsKSB7XG5cdFx0XHRzZWFyY2hSYW5nZXMgPSBbdGhpcy5nZXRGdWxsTW9kZWxSYW5nZSgpXTtcblx0XHR9XG5cblx0XHRzZWFyY2hSYW5nZXMgPSBzZWFyY2hSYW5nZXMuc29ydCgoZDEsIGQyKSA9PiBkMS5zdGFydExpbmVOdW1iZXIgLSBkMi5zdGFydExpbmVOdW1iZXIgfHwgZDEuc3RhcnRDb2x1bW4gLSBkMi5zdGFydENvbHVtbik7XG5cblx0XHRjb25zdCB1bmlxdWVTZWFyY2hSYW5nZXM6IFJhbmdlW10gPSBbXTtcblx0XHR1bmlxdWVTZWFyY2hSYW5nZXMucHVzaChzZWFyY2hSYW5nZXMucmVkdWNlKChwcmV2LCBjdXJyKSA9PiB7XG5cdFx0XHRpZiAoUmFuZ2UuYXJlSW50ZXJzZWN0aW5nKHByZXYsIGN1cnIpKSB7XG5cdFx0XHRcdHJldHVybiBwcmV2LnBsdXNSYW5nZShjdXJyKTtcblx0XHRcdH1cblxuXHRcdFx0dW5pcXVlU2VhcmNoUmFuZ2VzLnB1c2gocHJldik7XG5cdFx0XHRyZXR1cm4gY3Vycjtcblx0XHR9KSk7XG5cblx0XHRsZXQgbWF0Y2hNYXBwZXI6ICh2YWx1ZTogUmFuZ2UsIGluZGV4OiBudW1iZXIsIGFycmF5OiBSYW5nZVtdKSA9PiBtb2RlbC5GaW5kTWF0Y2hbXTtcblx0XHRpZiAoIWlzUmVnZXggJiYgc2VhcmNoU3RyaW5nLmluZGV4T2YoJ1xcbicpIDwgMCkge1xuXHRcdFx0Ly8gbm90IHJlZ2V4LCBub3QgbXVsdGkgbGluZVxuXHRcdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcyhzZWFyY2hTdHJpbmcsIGlzUmVnZXgsIG1hdGNoQ2FzZSwgd29yZFNlcGFyYXRvcnMpO1xuXHRcdFx0Y29uc3Qgc2VhcmNoRGF0YSA9IHNlYXJjaFBhcmFtcy5wYXJzZVNlYXJjaFJlcXVlc3QoKTtcblxuXHRcdFx0aWYgKCFzZWFyY2hEYXRhKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0bWF0Y2hNYXBwZXIgPSAoc2VhcmNoUmFuZ2U6IFJhbmdlKSA9PiB0aGlzLmZpbmRNYXRjaGVzTGluZUJ5TGluZShzZWFyY2hSYW5nZSwgc2VhcmNoRGF0YSwgY2FwdHVyZU1hdGNoZXMsIGxpbWl0UmVzdWx0Q291bnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtYXRjaE1hcHBlciA9IChzZWFyY2hSYW5nZTogUmFuZ2UpID0+IFRleHRNb2RlbFNlYXJjaC5maW5kTWF0Y2hlcyh0aGlzLCBuZXcgU2VhcmNoUGFyYW1zKHNlYXJjaFN0cmluZywgaXNSZWdleCwgbWF0Y2hDYXNlLCB3b3JkU2VwYXJhdG9ycyksIHNlYXJjaFJhbmdlLCBjYXB0dXJlTWF0Y2hlcywgbGltaXRSZXN1bHRDb3VudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuaXF1ZVNlYXJjaFJhbmdlcy5tYXAobWF0Y2hNYXBwZXIpLnJlZHVjZSgoYXJyLCBtYXRjaGVzOiBtb2RlbC5GaW5kTWF0Y2hbXSkgPT4gYXJyLmNvbmNhdChtYXRjaGVzKSwgW10pO1xuXHR9XG5cblx0cHVibGljIGZpbmROZXh0TWF0Y2goc2VhcmNoU3RyaW5nOiBzdHJpbmcsIHJhd1NlYXJjaFN0YXJ0OiBJUG9zaXRpb24sIGlzUmVnZXg6IGJvb2xlYW4sIG1hdGNoQ2FzZTogYm9vbGVhbiwgd29yZFNlcGFyYXRvcnM6IHN0cmluZywgY2FwdHVyZU1hdGNoZXM6IGJvb2xlYW4pOiBtb2RlbC5GaW5kTWF0Y2ggfCBudWxsIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdGNvbnN0IHNlYXJjaFN0YXJ0ID0gdGhpcy52YWxpZGF0ZVBvc2l0aW9uKHJhd1NlYXJjaFN0YXJ0KTtcblxuXHRcdGlmICghaXNSZWdleCAmJiBzZWFyY2hTdHJpbmcuaW5kZXhPZignXFxuJykgPCAwKSB7XG5cdFx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKHNlYXJjaFN0cmluZywgaXNSZWdleCwgbWF0Y2hDYXNlLCB3b3JkU2VwYXJhdG9ycyk7XG5cdFx0XHRjb25zdCBzZWFyY2hEYXRhID0gc2VhcmNoUGFyYW1zLnBhcnNlU2VhcmNoUmVxdWVzdCgpO1xuXHRcdFx0aWYgKCFzZWFyY2hEYXRhKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLmdldExpbmVDb3VudCgpO1xuXHRcdFx0bGV0IHNlYXJjaFJhbmdlID0gbmV3IFJhbmdlKHNlYXJjaFN0YXJ0LmxpbmVOdW1iZXIsIHNlYXJjaFN0YXJ0LmNvbHVtbiwgbGluZUNvdW50LCB0aGlzLmdldExpbmVNYXhDb2x1bW4obGluZUNvdW50KSk7XG5cdFx0XHRsZXQgcmV0ID0gdGhpcy5maW5kTWF0Y2hlc0xpbmVCeUxpbmUoc2VhcmNoUmFuZ2UsIHNlYXJjaERhdGEsIGNhcHR1cmVNYXRjaGVzLCAxKTtcblx0XHRcdFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKHRoaXMsIG5ldyBTZWFyY2hQYXJhbXMoc2VhcmNoU3RyaW5nLCBpc1JlZ2V4LCBtYXRjaENhc2UsIHdvcmRTZXBhcmF0b3JzKSwgc2VhcmNoU3RhcnQsIGNhcHR1cmVNYXRjaGVzKTtcblx0XHRcdGlmIChyZXQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXR1cm4gcmV0WzBdO1xuXHRcdFx0fVxuXG5cdFx0XHRzZWFyY2hSYW5nZSA9IG5ldyBSYW5nZSgxLCAxLCBzZWFyY2hTdGFydC5saW5lTnVtYmVyLCB0aGlzLmdldExpbmVNYXhDb2x1bW4oc2VhcmNoU3RhcnQubGluZU51bWJlcikpO1xuXHRcdFx0cmV0ID0gdGhpcy5maW5kTWF0Y2hlc0xpbmVCeUxpbmUoc2VhcmNoUmFuZ2UsIHNlYXJjaERhdGEsIGNhcHR1cmVNYXRjaGVzLCAxKTtcblxuXHRcdFx0aWYgKHJldC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHJldHVybiByZXRbMF07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaCh0aGlzLCBuZXcgU2VhcmNoUGFyYW1zKHNlYXJjaFN0cmluZywgaXNSZWdleCwgbWF0Y2hDYXNlLCB3b3JkU2VwYXJhdG9ycyksIHNlYXJjaFN0YXJ0LCBjYXB0dXJlTWF0Y2hlcyk7XG5cdH1cblxuXHRwdWJsaWMgZmluZFByZXZpb3VzTWF0Y2goc2VhcmNoU3RyaW5nOiBzdHJpbmcsIHJhd1NlYXJjaFN0YXJ0OiBJUG9zaXRpb24sIGlzUmVnZXg6IGJvb2xlYW4sIG1hdGNoQ2FzZTogYm9vbGVhbiwgd29yZFNlcGFyYXRvcnM6IHN0cmluZywgY2FwdHVyZU1hdGNoZXM6IGJvb2xlYW4pOiBtb2RlbC5GaW5kTWF0Y2ggfCBudWxsIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdGNvbnN0IHNlYXJjaFN0YXJ0ID0gdGhpcy52YWxpZGF0ZVBvc2l0aW9uKHJhd1NlYXJjaFN0YXJ0KTtcblx0XHRyZXR1cm4gVGV4dE1vZGVsU2VhcmNoLmZpbmRQcmV2aW91c01hdGNoKHRoaXMsIG5ldyBTZWFyY2hQYXJhbXMoc2VhcmNoU3RyaW5nLCBpc1JlZ2V4LCBtYXRjaENhc2UsIHdvcmRTZXBhcmF0b3JzKSwgc2VhcmNoU3RhcnQsIGNhcHR1cmVNYXRjaGVzKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBFZGl0aW5nXG5cblx0cHVibGljIHB1c2hTdGFja0VsZW1lbnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fY29tbWFuZE1hbmFnZXIucHVzaFN0YWNrRWxlbWVudCgpO1xuXHR9XG5cblx0cHVibGljIHBvcFN0YWNrRWxlbWVudCgpOiB2b2lkIHtcblx0XHR0aGlzLl9jb21tYW5kTWFuYWdlci5wb3BTdGFja0VsZW1lbnQoKTtcblx0fVxuXG5cdHB1YmxpYyBwdXNoRU9MKGVvbDogbW9kZWwuRW5kT2ZMaW5lU2VxdWVuY2UpOiB2b2lkIHtcblx0XHRjb25zdCBjdXJyZW50RU9MID0gKHRoaXMuZ2V0RU9MKCkgPT09ICdcXG4nID8gbW9kZWwuRW5kT2ZMaW5lU2VxdWVuY2UuTEYgOiBtb2RlbC5FbmRPZkxpbmVTZXF1ZW5jZS5DUkxGKTtcblx0XHRpZiAoY3VycmVudEVPTCA9PT0gZW9sKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmJlZ2luRGVmZXJyZWRFbWl0KCk7XG5cdFx0XHR0aGlzLl9ldmVudEVtaXR0ZXIuYmVnaW5EZWZlcnJlZEVtaXQoKTtcblx0XHRcdGlmICh0aGlzLl9pbml0aWFsVW5kb1JlZG9TbmFwc2hvdCA9PT0gbnVsbCkge1xuXHRcdFx0XHR0aGlzLl9pbml0aWFsVW5kb1JlZG9TbmFwc2hvdCA9IHRoaXMuX3VuZG9SZWRvU2VydmljZS5jcmVhdGVTbmFwc2hvdCh0aGlzLnVyaSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jb21tYW5kTWFuYWdlci5wdXNoRU9MKGVvbCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2V2ZW50RW1pdHRlci5lbmREZWZlcnJlZEVtaXQoKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZW5kRGVmZXJyZWRFbWl0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdmFsaWRhdGVFZGl0T3BlcmF0aW9uKHJhd09wZXJhdGlvbjogbW9kZWwuSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uKTogbW9kZWwuVmFsaWRBbm5vdGF0ZWRFZGl0T3BlcmF0aW9uIHtcblx0XHRpZiAocmF3T3BlcmF0aW9uIGluc3RhbmNlb2YgbW9kZWwuVmFsaWRBbm5vdGF0ZWRFZGl0T3BlcmF0aW9uKSB7XG5cdFx0XHRyZXR1cm4gcmF3T3BlcmF0aW9uO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IG1vZGVsLlZhbGlkQW5ub3RhdGVkRWRpdE9wZXJhdGlvbihcblx0XHRcdHJhd09wZXJhdGlvbi5pZGVudGlmaWVyIHx8IG51bGwsXG5cdFx0XHR0aGlzLnZhbGlkYXRlUmFuZ2UocmF3T3BlcmF0aW9uLnJhbmdlKSxcblx0XHRcdHJhd09wZXJhdGlvbi50ZXh0LFxuXHRcdFx0cmF3T3BlcmF0aW9uLmZvcmNlTW92ZU1hcmtlcnMgfHwgZmFsc2UsXG5cdFx0XHRyYXdPcGVyYXRpb24uaXNBdXRvV2hpdGVzcGFjZUVkaXQgfHwgZmFsc2UsXG5cdFx0XHRyYXdPcGVyYXRpb24uX2lzVHJhY2tlZCB8fCBmYWxzZVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIF92YWxpZGF0ZUVkaXRPcGVyYXRpb25zKHJhd09wZXJhdGlvbnM6IHJlYWRvbmx5IG1vZGVsLklJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbltdKTogbW9kZWwuVmFsaWRBbm5vdGF0ZWRFZGl0T3BlcmF0aW9uW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogbW9kZWwuVmFsaWRBbm5vdGF0ZWRFZGl0T3BlcmF0aW9uW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcmF3T3BlcmF0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0cmVzdWx0W2ldID0gdGhpcy5fdmFsaWRhdGVFZGl0T3BlcmF0aW9uKHJhd09wZXJhdGlvbnNbaV0pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIHB1c2hFZGl0T3BlcmF0aW9ucyhiZWZvcmVDdXJzb3JTdGF0ZTogU2VsZWN0aW9uW10gfCBudWxsLCBlZGl0T3BlcmF0aW9uczogbW9kZWwuSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW10sIGN1cnNvclN0YXRlQ29tcHV0ZXI6IG1vZGVsLklDdXJzb3JTdGF0ZUNvbXB1dGVyIHwgbnVsbCwgZ3JvdXA/OiBVbmRvUmVkb0dyb3VwKTogU2VsZWN0aW9uW10gfCBudWxsIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5iZWdpbkRlZmVycmVkRW1pdCgpO1xuXHRcdFx0dGhpcy5fZXZlbnRFbWl0dGVyLmJlZ2luRGVmZXJyZWRFbWl0KCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcHVzaEVkaXRPcGVyYXRpb25zKGJlZm9yZUN1cnNvclN0YXRlLCB0aGlzLl92YWxpZGF0ZUVkaXRPcGVyYXRpb25zKGVkaXRPcGVyYXRpb25zKSwgY3Vyc29yU3RhdGVDb21wdXRlciwgZ3JvdXApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9ldmVudEVtaXR0ZXIuZW5kRGVmZXJyZWRFbWl0KCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmVuZERlZmVycmVkRW1pdCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3B1c2hFZGl0T3BlcmF0aW9ucyhiZWZvcmVDdXJzb3JTdGF0ZTogU2VsZWN0aW9uW10gfCBudWxsLCBlZGl0T3BlcmF0aW9uczogbW9kZWwuVmFsaWRBbm5vdGF0ZWRFZGl0T3BlcmF0aW9uW10sIGN1cnNvclN0YXRlQ29tcHV0ZXI6IG1vZGVsLklDdXJzb3JTdGF0ZUNvbXB1dGVyIHwgbnVsbCwgZ3JvdXA/OiBVbmRvUmVkb0dyb3VwKTogU2VsZWN0aW9uW10gfCBudWxsIHtcblx0XHRpZiAodGhpcy5fb3B0aW9ucy50cmltQXV0b1doaXRlc3BhY2UgJiYgdGhpcy5fdHJpbUF1dG9XaGl0ZXNwYWNlTGluZXMpIHtcblx0XHRcdC8vIEdvIHRocm91Z2ggZWFjaCBzYXZlZCBsaW5lIG51bWJlciBhbmQgaW5zZXJ0IGEgdHJpbSB3aGl0ZXNwYWNlIGVkaXRcblx0XHRcdC8vIGlmIGl0IGlzIHNhZmUgdG8gZG8gc28gKG5vIGNvbmZsaWN0cyB3aXRoIG90aGVyIGVkaXRzKS5cblxuXHRcdFx0Y29uc3QgaW5jb21pbmdFZGl0cyA9IGVkaXRPcGVyYXRpb25zLm1hcCgob3ApID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyYW5nZTogdGhpcy52YWxpZGF0ZVJhbmdlKG9wLnJhbmdlKSxcblx0XHRcdFx0XHR0ZXh0OiBvcC50ZXh0XG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gU29tZXRpbWVzLCBhdXRvLWZvcm1hdHRlcnMgY2hhbmdlIHJhbmdlcyBhdXRvbWF0aWNhbGx5IHdoaWNoIGNhbiBjYXVzZSB1bmRlc2lyZWQgYXV0byB3aGl0ZXNwYWNlIHRyaW1taW5nIG5lYXIgdGhlIGN1cnNvclxuXHRcdFx0Ly8gV2UnbGwgdXNlIHRoZSBmb2xsb3dpbmcgaGV1cmlzdGljOiBpZiB0aGUgZWRpdHMgb2NjdXIgbmVhciB0aGUgY3Vyc29yLCB0aGVuIGl0J3Mgb2sgdG8gdHJpbSBhdXRvIHdoaXRlc3BhY2Vcblx0XHRcdGxldCBlZGl0c0FyZU5lYXJDdXJzb3JzID0gdHJ1ZTtcblx0XHRcdGlmIChiZWZvcmVDdXJzb3JTdGF0ZSkge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYmVmb3JlQ3Vyc29yU3RhdGUubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBzZWwgPSBiZWZvcmVDdXJzb3JTdGF0ZVtpXTtcblx0XHRcdFx0XHRsZXQgZm91bmRFZGl0TmVhclNlbCA9IGZhbHNlO1xuXHRcdFx0XHRcdGZvciAobGV0IGogPSAwLCBsZW5KID0gaW5jb21pbmdFZGl0cy5sZW5ndGg7IGogPCBsZW5KOyBqKyspIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRSYW5nZSA9IGluY29taW5nRWRpdHNbal0ucmFuZ2U7XG5cdFx0XHRcdFx0XHRjb25zdCBzZWxJc0Fib3ZlID0gZWRpdFJhbmdlLnN0YXJ0TGluZU51bWJlciA+IHNlbC5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2VsSXNCZWxvdyA9IHNlbC5zdGFydExpbmVOdW1iZXIgPiBlZGl0UmFuZ2UuZW5kTGluZU51bWJlcjtcblx0XHRcdFx0XHRcdGlmICghc2VsSXNBYm92ZSAmJiAhc2VsSXNCZWxvdykge1xuXHRcdFx0XHRcdFx0XHRmb3VuZEVkaXROZWFyU2VsID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICghZm91bmRFZGl0TmVhclNlbCkge1xuXHRcdFx0XHRcdFx0ZWRpdHNBcmVOZWFyQ3Vyc29ycyA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlZGl0c0FyZU5lYXJDdXJzb3JzKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl90cmltQXV0b1doaXRlc3BhY2VMaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IHRyaW1MaW5lTnVtYmVyID0gdGhpcy5fdHJpbUF1dG9XaGl0ZXNwYWNlTGluZXNbaV07XG5cdFx0XHRcdFx0Y29uc3QgbWF4TGluZUNvbHVtbiA9IHRoaXMuZ2V0TGluZU1heENvbHVtbih0cmltTGluZU51bWJlcik7XG5cblx0XHRcdFx0XHRsZXQgYWxsb3dUcmltTGluZSA9IHRydWU7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaiA9IDAsIGxlbkogPSBpbmNvbWluZ0VkaXRzLmxlbmd0aDsgaiA8IGxlbko7IGorKykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZWRpdFJhbmdlID0gaW5jb21pbmdFZGl0c1tqXS5yYW5nZTtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRUZXh0ID0gaW5jb21pbmdFZGl0c1tqXS50ZXh0O1xuXG5cdFx0XHRcdFx0XHRpZiAodHJpbUxpbmVOdW1iZXIgPCBlZGl0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIHx8IHRyaW1MaW5lTnVtYmVyID4gZWRpdFJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdFx0Ly8gYHRyaW1MaW5lYCBpcyBjb21wbGV0ZWx5IG91dHNpZGUgdGhpcyBlZGl0XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBBdCB0aGlzIHBvaW50OlxuXHRcdFx0XHRcdFx0Ly8gICBlZGl0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIDw9IHRyaW1MaW5lIDw9IGVkaXRSYW5nZS5lbmRMaW5lTnVtYmVyXG5cblx0XHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdFx0dHJpbUxpbmVOdW1iZXIgPT09IGVkaXRSYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgZWRpdFJhbmdlLnN0YXJ0Q29sdW1uID09PSBtYXhMaW5lQ29sdW1uXG5cdFx0XHRcdFx0XHRcdCYmIGVkaXRSYW5nZS5pc0VtcHR5KCkgJiYgZWRpdFRleHQgJiYgZWRpdFRleHQubGVuZ3RoID4gMCAmJiBlZGl0VGV4dC5jaGFyQXQoMCkgPT09ICdcXG4nXG5cdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gVGhpcyBlZGl0IGluc2VydHMgYSBuZXcgbGluZSAoYW5kIG1heWJlIG90aGVyIHRleHQpIGFmdGVyIGB0cmltTGluZWBcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdFx0dHJpbUxpbmVOdW1iZXIgPT09IGVkaXRSYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgZWRpdFJhbmdlLnN0YXJ0Q29sdW1uID09PSAxXG5cdFx0XHRcdFx0XHRcdCYmIGVkaXRSYW5nZS5pc0VtcHR5KCkgJiYgZWRpdFRleHQgJiYgZWRpdFRleHQubGVuZ3RoID4gMCAmJiBlZGl0VGV4dC5jaGFyQXQoZWRpdFRleHQubGVuZ3RoIC0gMSkgPT09ICdcXG4nXG5cdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gVGhpcyBlZGl0IGluc2VydHMgYSBuZXcgbGluZSAoYW5kIG1heWJlIG90aGVyIHRleHQpIGJlZm9yZSBgdHJpbUxpbmVgXG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBMb29rcyBsaWtlIHdlIGNhbid0IHRyaW0gdGhpcyBsaW5lIGFzIGl0IHdvdWxkIGludGVyZmVyZSB3aXRoIGFuIGluY29taW5nIGVkaXRcblx0XHRcdFx0XHRcdGFsbG93VHJpbUxpbmUgPSBmYWxzZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChhbGxvd1RyaW1MaW5lKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB0cmltUmFuZ2UgPSBuZXcgUmFuZ2UodHJpbUxpbmVOdW1iZXIsIDEsIHRyaW1MaW5lTnVtYmVyLCBtYXhMaW5lQ29sdW1uKTtcblx0XHRcdFx0XHRcdGVkaXRPcGVyYXRpb25zLnB1c2gobmV3IG1vZGVsLlZhbGlkQW5ub3RhdGVkRWRpdE9wZXJhdGlvbihudWxsLCB0cmltUmFuZ2UsIG51bGwsIGZhbHNlLCBmYWxzZSwgZmFsc2UpKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl90cmltQXV0b1doaXRlc3BhY2VMaW5lcyA9IG51bGw7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9pbml0aWFsVW5kb1JlZG9TbmFwc2hvdCA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy5faW5pdGlhbFVuZG9SZWRvU25hcHNob3QgPSB0aGlzLl91bmRvUmVkb1NlcnZpY2UuY3JlYXRlU25hcHNob3QodGhpcy51cmkpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY29tbWFuZE1hbmFnZXIucHVzaEVkaXRPcGVyYXRpb24oYmVmb3JlQ3Vyc29yU3RhdGUsIGVkaXRPcGVyYXRpb25zLCBjdXJzb3JTdGF0ZUNvbXB1dGVyLCBncm91cCk7XG5cdH1cblxuXHRfYXBwbHlVbmRvKGNoYW5nZXM6IFRleHRDaGFuZ2VbXSwgZW9sOiBtb2RlbC5FbmRPZkxpbmVTZXF1ZW5jZSwgcmVzdWx0aW5nQWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IG51bWJlciwgcmVzdWx0aW5nU2VsZWN0aW9uOiBTZWxlY3Rpb25bXSB8IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0cyA9IGNoYW5nZXMubWFwPElTaW5nbGVFZGl0T3BlcmF0aW9uPigoY2hhbmdlKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZVN0YXJ0ID0gdGhpcy5nZXRQb3NpdGlvbkF0KGNoYW5nZS5uZXdQb3NpdGlvbik7XG5cdFx0XHRjb25zdCByYW5nZUVuZCA9IHRoaXMuZ2V0UG9zaXRpb25BdChjaGFuZ2UubmV3RW5kKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UocmFuZ2VTdGFydC5saW5lTnVtYmVyLCByYW5nZVN0YXJ0LmNvbHVtbiwgcmFuZ2VFbmQubGluZU51bWJlciwgcmFuZ2VFbmQuY29sdW1uKSxcblx0XHRcdFx0dGV4dDogY2hhbmdlLm9sZFRleHRcblx0XHRcdH07XG5cdFx0fSk7XG5cdFx0dGhpcy5fYXBwbHlVbmRvUmVkb0VkaXRzKGVkaXRzLCBlb2wsIHRydWUsIGZhbHNlLCByZXN1bHRpbmdBbHRlcm5hdGl2ZVZlcnNpb25JZCwgcmVzdWx0aW5nU2VsZWN0aW9uKTtcblx0fVxuXG5cdF9hcHBseVJlZG8oY2hhbmdlczogVGV4dENoYW5nZVtdLCBlb2w6IG1vZGVsLkVuZE9mTGluZVNlcXVlbmNlLCByZXN1bHRpbmdBbHRlcm5hdGl2ZVZlcnNpb25JZDogbnVtYmVyLCByZXN1bHRpbmdTZWxlY3Rpb246IFNlbGVjdGlvbltdIHwgbnVsbCk6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRzID0gY2hhbmdlcy5tYXA8SVNpbmdsZUVkaXRPcGVyYXRpb24+KChjaGFuZ2UpID0+IHtcblx0XHRcdGNvbnN0IHJhbmdlU3RhcnQgPSB0aGlzLmdldFBvc2l0aW9uQXQoY2hhbmdlLm9sZFBvc2l0aW9uKTtcblx0XHRcdGNvbnN0IHJhbmdlRW5kID0gdGhpcy5nZXRQb3NpdGlvbkF0KGNoYW5nZS5vbGRFbmQpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShyYW5nZVN0YXJ0LmxpbmVOdW1iZXIsIHJhbmdlU3RhcnQuY29sdW1uLCByYW5nZUVuZC5saW5lTnVtYmVyLCByYW5nZUVuZC5jb2x1bW4pLFxuXHRcdFx0XHR0ZXh0OiBjaGFuZ2UubmV3VGV4dFxuXHRcdFx0fTtcblx0XHR9KTtcblx0XHR0aGlzLl9hcHBseVVuZG9SZWRvRWRpdHMoZWRpdHMsIGVvbCwgZmFsc2UsIHRydWUsIHJlc3VsdGluZ0FsdGVybmF0aXZlVmVyc2lvbklkLCByZXN1bHRpbmdTZWxlY3Rpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlVbmRvUmVkb0VkaXRzKGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdLCBlb2w6IG1vZGVsLkVuZE9mTGluZVNlcXVlbmNlLCBpc1VuZG9pbmc6IGJvb2xlYW4sIGlzUmVkb2luZzogYm9vbGVhbiwgcmVzdWx0aW5nQWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IG51bWJlciwgcmVzdWx0aW5nU2VsZWN0aW9uOiBTZWxlY3Rpb25bXSB8IG51bGwpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5iZWdpbkRlZmVycmVkRW1pdCgpO1xuXHRcdFx0dGhpcy5fZXZlbnRFbWl0dGVyLmJlZ2luRGVmZXJyZWRFbWl0KCk7XG5cdFx0XHR0aGlzLl9pc1VuZG9pbmcgPSBpc1VuZG9pbmc7XG5cdFx0XHR0aGlzLl9pc1JlZG9pbmcgPSBpc1JlZG9pbmc7XG5cdFx0XHR0aGlzLmFwcGx5RWRpdHMoZWRpdHMsIGZhbHNlKTtcblx0XHRcdHRoaXMuc2V0RU9MKGVvbCk7XG5cdFx0XHR0aGlzLl9vdmVyd3JpdGVBbHRlcm5hdGl2ZVZlcnNpb25JZChyZXN1bHRpbmdBbHRlcm5hdGl2ZVZlcnNpb25JZCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2lzVW5kb2luZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5faXNSZWRvaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9ldmVudEVtaXR0ZXIuZW5kRGVmZXJyZWRFbWl0KHJlc3VsdGluZ1NlbGVjdGlvbik7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmVuZERlZmVycmVkRW1pdCgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhcHBseUVkaXRzKG9wZXJhdGlvbnM6IHJlYWRvbmx5IG1vZGVsLklJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbltdKTogdm9pZDtcblx0cHVibGljIGFwcGx5RWRpdHMob3BlcmF0aW9uczogcmVhZG9ubHkgbW9kZWwuSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW10sIGNvbXB1dGVVbmRvRWRpdHM6IGZhbHNlKTogdm9pZDtcblx0cHVibGljIGFwcGx5RWRpdHMob3BlcmF0aW9uczogcmVhZG9ubHkgbW9kZWwuSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW10sIGNvbXB1dGVVbmRvRWRpdHM6IHRydWUpOiBtb2RlbC5JVmFsaWRFZGl0T3BlcmF0aW9uW107XG5cdHB1YmxpYyBhcHBseUVkaXRzKHJhd09wZXJhdGlvbnM6IHJlYWRvbmx5IG1vZGVsLklJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbltdLCBjb21wdXRlVW5kb0VkaXRzOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHwgbW9kZWwuSVZhbGlkRWRpdE9wZXJhdGlvbltdIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5iZWdpbkRlZmVycmVkRW1pdCgpO1xuXHRcdFx0dGhpcy5fZXZlbnRFbWl0dGVyLmJlZ2luRGVmZXJyZWRFbWl0KCk7XG5cdFx0XHRjb25zdCBvcGVyYXRpb25zID0gdGhpcy5fdmFsaWRhdGVFZGl0T3BlcmF0aW9ucyhyYXdPcGVyYXRpb25zKTtcblx0XHRcdHJldHVybiB0aGlzLl9kb0FwcGx5RWRpdHMob3BlcmF0aW9ucywgY29tcHV0ZVVuZG9FZGl0cyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2V2ZW50RW1pdHRlci5lbmREZWZlcnJlZEVtaXQoKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZW5kRGVmZXJyZWRFbWl0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZG9BcHBseUVkaXRzKHJhd09wZXJhdGlvbnM6IG1vZGVsLlZhbGlkQW5ub3RhdGVkRWRpdE9wZXJhdGlvbltdLCBjb21wdXRlVW5kb0VkaXRzOiBib29sZWFuKTogdm9pZCB8IG1vZGVsLklWYWxpZEVkaXRPcGVyYXRpb25bXSB7XG5cblx0XHRjb25zdCBvbGRMaW5lQ291bnQgPSB0aGlzLl9idWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fYnVmZmVyLmFwcGx5RWRpdHMocmF3T3BlcmF0aW9ucywgdGhpcy5fb3B0aW9ucy50cmltQXV0b1doaXRlc3BhY2UsIGNvbXB1dGVVbmRvRWRpdHMpO1xuXHRcdGNvbnN0IG5ld0xpbmVDb3VudCA9IHRoaXMuX2J1ZmZlci5nZXRMaW5lQ291bnQoKTtcblxuXHRcdGNvbnN0IGNvbnRlbnRDaGFuZ2VzID0gcmVzdWx0LmNoYW5nZXM7XG5cdFx0dGhpcy5fdHJpbUF1dG9XaGl0ZXNwYWNlTGluZXMgPSByZXN1bHQudHJpbUF1dG9XaGl0ZXNwYWNlTGluZU51bWJlcnM7XG5cblx0XHRpZiAoY29udGVudENoYW5nZXMubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHQvLyBXZSBkbyBhIGZpcnN0IHBhc3MgdG8gdXBkYXRlIGRlY29yYXRpb25zXG5cdFx0XHQvLyBiZWNhdXNlIHdlIHdhbnQgdG8gcmVhZCBkZWNvcmF0aW9ucyBpbiB0aGUgc2Vjb25kIHBhc3Ncblx0XHRcdC8vIHdoZXJlIHdlIHdpbGwgZW1pdCBjb250ZW50IGNoYW5nZSBldmVudHNcblx0XHRcdC8vIGFuZCB3ZSB3YW50IHRvIHJlYWQgdGhlIGZpbmFsIGRlY29yYXRpb25zXG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gY29udGVudENoYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgY2hhbmdlID0gY29udGVudENoYW5nZXNbaV07XG5cdFx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5hY2NlcHRSZXBsYWNlKGNoYW5nZS5yYW5nZU9mZnNldCwgY2hhbmdlLnJhbmdlTGVuZ3RoLCBjaGFuZ2UudGV4dC5sZW5ndGgsIGNoYW5nZS5mb3JjZU1vdmVNYXJrZXJzKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmF3Q29udGVudENoYW5nZXM6IE1vZGVsUmF3Q2hhbmdlW10gPSBbXTtcblxuXHRcdFx0dGhpcy5faW5jcmVhc2VWZXJzaW9uSWQoKTtcblxuXHRcdFx0bGV0IGxpbmVDb3VudCA9IG9sZExpbmVDb3VudDtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjb250ZW50Q2hhbmdlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBjaGFuZ2UgPSBjb250ZW50Q2hhbmdlc1tpXTtcblx0XHRcdFx0Y29uc3QgW2VvbENvdW50XSA9IGNvdW50RU9MKGNoYW5nZS50ZXh0KTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5maXJlKCk7XG5cblx0XHRcdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gY2hhbmdlLnJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IGNoYW5nZS5yYW5nZS5lbmRMaW5lTnVtYmVyO1xuXG5cdFx0XHRcdGNvbnN0IGRlbGV0aW5nTGluZXNDbnQgPSBlbmRMaW5lTnVtYmVyIC0gc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCBpbnNlcnRpbmdMaW5lc0NudCA9IGVvbENvdW50O1xuXHRcdFx0XHRjb25zdCBlZGl0aW5nTGluZXNDbnQgPSBNYXRoLm1pbihkZWxldGluZ0xpbmVzQ250LCBpbnNlcnRpbmdMaW5lc0NudCk7XG5cblx0XHRcdFx0Y29uc3QgY2hhbmdlTGluZUNvdW50RGVsdGEgPSAoaW5zZXJ0aW5nTGluZXNDbnQgLSBkZWxldGluZ0xpbmVzQ250KTtcblxuXHRcdFx0XHRjb25zdCBjdXJyZW50RWRpdFN0YXJ0TGluZU51bWJlciA9IG5ld0xpbmVDb3VudCAtIGxpbmVDb3VudCAtIGNoYW5nZUxpbmVDb3VudERlbHRhICsgc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCBmaXJzdEVkaXRMaW5lTnVtYmVyID0gY3VycmVudEVkaXRTdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdGNvbnN0IGxhc3RJbnNlcnRlZExpbmVOdW1iZXIgPSBjdXJyZW50RWRpdFN0YXJ0TGluZU51bWJlciArIGluc2VydGluZ0xpbmVzQ250O1xuXG5cdFx0XHRcdGNvbnN0IGRlY29yYXRpb25zV2l0aEluamVjdGVkVGV4dEluRWRpdGVkUmFuZ2UgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUuZ2V0SW5qZWN0ZWRUZXh0SW5JbnRlcnZhbChcblx0XHRcdFx0XHR0aGlzLFxuXHRcdFx0XHRcdHRoaXMuZ2V0T2Zmc2V0QXQobmV3IFBvc2l0aW9uKGZpcnN0RWRpdExpbmVOdW1iZXIsIDEpKSxcblx0XHRcdFx0XHR0aGlzLmdldE9mZnNldEF0KG5ldyBQb3NpdGlvbihsYXN0SW5zZXJ0ZWRMaW5lTnVtYmVyLCB0aGlzLmdldExpbmVNYXhDb2x1bW4obGFzdEluc2VydGVkTGluZU51bWJlcikpKSxcblx0XHRcdFx0XHQwXG5cdFx0XHRcdCk7XG5cblxuXHRcdFx0XHRjb25zdCBpbmplY3RlZFRleHRJbkVkaXRlZFJhbmdlID0gTGluZUluamVjdGVkVGV4dC5mcm9tRGVjb3JhdGlvbnMoZGVjb3JhdGlvbnNXaXRoSW5qZWN0ZWRUZXh0SW5FZGl0ZWRSYW5nZSk7XG5cdFx0XHRcdGNvbnN0IGluamVjdGVkVGV4dEluRWRpdGVkUmFuZ2VRdWV1ZSA9IG5ldyBBcnJheVF1ZXVlKGluamVjdGVkVGV4dEluRWRpdGVkUmFuZ2UpO1xuXG5cdFx0XHRcdGZvciAobGV0IGogPSBlZGl0aW5nTGluZXNDbnQ7IGogPj0gMDsgai0tKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdExpbmVOdW1iZXIgPSBzdGFydExpbmVOdW1iZXIgKyBqO1xuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRFZGl0TGluZU51bWJlciA9IGN1cnJlbnRFZGl0U3RhcnRMaW5lTnVtYmVyICsgajtcblxuXHRcdFx0XHRcdGluamVjdGVkVGV4dEluRWRpdGVkUmFuZ2VRdWV1ZS50YWtlRnJvbUVuZFdoaWxlKHIgPT4gci5saW5lTnVtYmVyID4gY3VycmVudEVkaXRMaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRjb25zdCBkZWNvcmF0aW9uc0luQ3VycmVudExpbmUgPSBpbmplY3RlZFRleHRJbkVkaXRlZFJhbmdlUXVldWUudGFrZUZyb21FbmRXaGlsZShyID0+IHIubGluZU51bWJlciA9PT0gY3VycmVudEVkaXRMaW5lTnVtYmVyKTtcblxuXHRcdFx0XHRcdHJhd0NvbnRlbnRDaGFuZ2VzLnB1c2goXG5cdFx0XHRcdFx0XHRuZXcgTW9kZWxSYXdMaW5lQ2hhbmdlZChcblx0XHRcdFx0XHRcdFx0ZWRpdExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRcdHRoaXMuZ2V0TGluZUNvbnRlbnQoY3VycmVudEVkaXRMaW5lTnVtYmVyKSxcblx0XHRcdFx0XHRcdFx0ZGVjb3JhdGlvbnNJbkN1cnJlbnRMaW5lXG5cdFx0XHRcdFx0XHQpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlZGl0aW5nTGluZXNDbnQgPCBkZWxldGluZ0xpbmVzQ250KSB7XG5cdFx0XHRcdFx0Ly8gTXVzdCBkZWxldGUgc29tZSBsaW5lc1xuXHRcdFx0XHRcdGNvbnN0IHNwbGljZVN0YXJ0TGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlciArIGVkaXRpbmdMaW5lc0NudDtcblx0XHRcdFx0XHRyYXdDb250ZW50Q2hhbmdlcy5wdXNoKG5ldyBNb2RlbFJhd0xpbmVzRGVsZXRlZChzcGxpY2VTdGFydExpbmVOdW1iZXIgKyAxLCBlbmRMaW5lTnVtYmVyKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZWRpdGluZ0xpbmVzQ250IDwgaW5zZXJ0aW5nTGluZXNDbnQpIHtcblx0XHRcdFx0XHRjb25zdCBpbmplY3RlZFRleHRJbkVkaXRlZFJhbmdlUXVldWUgPSBuZXcgQXJyYXlRdWV1ZShpbmplY3RlZFRleHRJbkVkaXRlZFJhbmdlKTtcblx0XHRcdFx0XHQvLyBNdXN0IGluc2VydCBzb21lIGxpbmVzXG5cdFx0XHRcdFx0Y29uc3Qgc3BsaWNlTGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlciArIGVkaXRpbmdMaW5lc0NudDtcblx0XHRcdFx0XHRjb25zdCBjbnQgPSBpbnNlcnRpbmdMaW5lc0NudCAtIGVkaXRpbmdMaW5lc0NudDtcblx0XHRcdFx0XHRjb25zdCBmcm9tTGluZU51bWJlciA9IG5ld0xpbmVDb3VudCAtIGxpbmVDb3VudCAtIGNudCArIHNwbGljZUxpbmVOdW1iZXIgKyAxO1xuXHRcdFx0XHRcdGNvbnN0IGluamVjdGVkVGV4dHM6IChMaW5lSW5qZWN0ZWRUZXh0W10gfCBudWxsKVtdID0gW107XG5cdFx0XHRcdFx0Y29uc3QgbmV3TGluZXM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjbnQ7IGkrKykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IGZyb21MaW5lTnVtYmVyICsgaTtcblx0XHRcdFx0XHRcdG5ld0xpbmVzW2ldID0gdGhpcy5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblxuXHRcdFx0XHRcdFx0aW5qZWN0ZWRUZXh0SW5FZGl0ZWRSYW5nZVF1ZXVlLnRha2VXaGlsZShyID0+IHIubGluZU51bWJlciA8IGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0aW5qZWN0ZWRUZXh0c1tpXSA9IGluamVjdGVkVGV4dEluRWRpdGVkUmFuZ2VRdWV1ZS50YWtlV2hpbGUociA9PiByLmxpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJhd0NvbnRlbnRDaGFuZ2VzLnB1c2goXG5cdFx0XHRcdFx0XHRuZXcgTW9kZWxSYXdMaW5lc0luc2VydGVkKFxuXHRcdFx0XHRcdFx0XHRzcGxpY2VMaW5lTnVtYmVyICsgMSxcblx0XHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyICsgaW5zZXJ0aW5nTGluZXNDbnQsXG5cdFx0XHRcdFx0XHRcdG5ld0xpbmVzLFxuXHRcdFx0XHRcdFx0XHRpbmplY3RlZFRleHRzXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxpbmVDb3VudCArPSBjaGFuZ2VMaW5lQ291bnREZWx0YTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZW1pdENvbnRlbnRDaGFuZ2VkRXZlbnQoXG5cdFx0XHRcdG5ldyBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQoXG5cdFx0XHRcdFx0cmF3Q29udGVudENoYW5nZXMsXG5cdFx0XHRcdFx0dGhpcy5nZXRWZXJzaW9uSWQoKSxcblx0XHRcdFx0XHR0aGlzLl9pc1VuZG9pbmcsXG5cdFx0XHRcdFx0dGhpcy5faXNSZWRvaW5nXG5cdFx0XHRcdCksXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjaGFuZ2VzOiBjb250ZW50Q2hhbmdlcyxcblx0XHRcdFx0XHRlb2w6IHRoaXMuX2J1ZmZlci5nZXRFT0woKSxcblx0XHRcdFx0XHRpc0VvbENoYW5nZTogZmFsc2UsXG5cdFx0XHRcdFx0dmVyc2lvbklkOiB0aGlzLmdldFZlcnNpb25JZCgpLFxuXHRcdFx0XHRcdGlzVW5kb2luZzogdGhpcy5faXNVbmRvaW5nLFxuXHRcdFx0XHRcdGlzUmVkb2luZzogdGhpcy5faXNSZWRvaW5nLFxuXHRcdFx0XHRcdGlzRmx1c2g6IGZhbHNlXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChyZXN1bHQucmV2ZXJzZUVkaXRzID09PSBudWxsID8gdW5kZWZpbmVkIDogcmVzdWx0LnJldmVyc2VFZGl0cyk7XG5cdH1cblxuXHRwdWJsaWMgdW5kbygpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VuZG9SZWRvU2VydmljZS51bmRvKHRoaXMudXJpKTtcblx0fVxuXG5cdHB1YmxpYyBjYW5VbmRvKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl91bmRvUmVkb1NlcnZpY2UuY2FuVW5kbyh0aGlzLnVyaSk7XG5cdH1cblxuXHRwdWJsaWMgcmVkbygpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VuZG9SZWRvU2VydmljZS5yZWRvKHRoaXMudXJpKTtcblx0fVxuXG5cdHB1YmxpYyBjYW5SZWRvKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl91bmRvUmVkb1NlcnZpY2UuY2FuUmVkbyh0aGlzLnVyaSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRGVjb3JhdGlvbnNcblxuXHRwcml2YXRlIGhhbmRsZUJlZm9yZUZpcmVEZWNvcmF0aW9uc0NoYW5nZWRFdmVudChhZmZlY3RlZEluamVjdGVkVGV4dExpbmVzOiBTZXQ8bnVtYmVyPiB8IG51bGwpOiB2b2lkIHtcblx0XHQvLyBUaGlzIGlzIGNhbGxlZCBiZWZvcmUgdGhlIGRlY29yYXRpb24gY2hhbmdlZCBldmVudCBpcyBmaXJlZC5cblxuXHRcdGlmIChhZmZlY3RlZEluamVjdGVkVGV4dExpbmVzID09PSBudWxsIHx8IGFmZmVjdGVkSW5qZWN0ZWRUZXh0TGluZXMuc2l6ZSA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFmZmVjdGVkTGluZXMgPSBBcnJheS5mcm9tKGFmZmVjdGVkSW5qZWN0ZWRUZXh0TGluZXMpO1xuXHRcdGNvbnN0IGxpbmVDaGFuZ2VFdmVudHMgPSBhZmZlY3RlZExpbmVzLm1hcChsaW5lTnVtYmVyID0+IG5ldyBNb2RlbFJhd0xpbmVDaGFuZ2VkKGxpbmVOdW1iZXIsIHRoaXMuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlciksIHRoaXMuX2dldEluamVjdGVkVGV4dEluTGluZShsaW5lTnVtYmVyKSkpO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VJbmplY3RlZFRleHQuZmlyZShuZXcgTW9kZWxJbmplY3RlZFRleHRDaGFuZ2VkRXZlbnQobGluZUNoYW5nZUV2ZW50cykpO1xuXHR9XG5cblx0cHVibGljIGNoYW5nZURlY29yYXRpb25zPFQ+KGNhbGxiYWNrOiAoY2hhbmdlQWNjZXNzb3I6IG1vZGVsLklNb2RlbERlY29yYXRpb25zQ2hhbmdlQWNjZXNzb3IpID0+IFQsIG93bmVySWQ6IG51bWJlciA9IDApOiBUIHwgbnVsbCB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmJlZ2luRGVmZXJyZWRFbWl0KCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY2hhbmdlRGVjb3JhdGlvbnMob3duZXJJZCwgY2FsbGJhY2spO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmVuZERlZmVycmVkRW1pdCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NoYW5nZURlY29yYXRpb25zPFQ+KG93bmVySWQ6IG51bWJlciwgY2FsbGJhY2s6IChjaGFuZ2VBY2Nlc3NvcjogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvcikgPT4gVCk6IFQgfCBudWxsIHtcblx0XHRjb25zdCBjaGFuZ2VBY2Nlc3NvcjogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciA9IHtcblx0XHRcdGFkZERlY29yYXRpb246IChyYW5nZTogSVJhbmdlLCBvcHRpb25zOiBtb2RlbC5JTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyk6IHN0cmluZyA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9kZWx0YURlY29yYXRpb25zSW1wbChvd25lcklkLCBbXSwgW3sgcmFuZ2U6IHJhbmdlLCBvcHRpb25zOiBvcHRpb25zIH1dKVswXTtcblx0XHRcdH0sXG5cdFx0XHRjaGFuZ2VEZWNvcmF0aW9uOiAoaWQ6IHN0cmluZywgbmV3UmFuZ2U6IElSYW5nZSk6IHZvaWQgPT4ge1xuXHRcdFx0XHR0aGlzLl9jaGFuZ2VEZWNvcmF0aW9uSW1wbChpZCwgbmV3UmFuZ2UpO1xuXHRcdFx0fSxcblx0XHRcdGNoYW5nZURlY29yYXRpb25PcHRpb25zOiAoaWQ6IHN0cmluZywgb3B0aW9uczogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpID0+IHtcblx0XHRcdFx0dGhpcy5fY2hhbmdlRGVjb3JhdGlvbk9wdGlvbnNJbXBsKGlkLCBfbm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlRGVjb3JhdGlvbjogKGlkOiBzdHJpbmcpOiB2b2lkID0+IHtcblx0XHRcdFx0dGhpcy5fZGVsdGFEZWNvcmF0aW9uc0ltcGwob3duZXJJZCwgW2lkXSwgW10pO1xuXHRcdFx0fSxcblx0XHRcdGRlbHRhRGVjb3JhdGlvbnM6IChvbGREZWNvcmF0aW9uczogc3RyaW5nW10sIG5ld0RlY29yYXRpb25zOiBtb2RlbC5JTW9kZWxEZWx0YURlY29yYXRpb25bXSk6IHN0cmluZ1tdID0+IHtcblx0XHRcdFx0aWYgKG9sZERlY29yYXRpb25zLmxlbmd0aCA9PT0gMCAmJiBuZXdEZWNvcmF0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHQvLyBub3RoaW5nIHRvIGRvXG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLl9kZWx0YURlY29yYXRpb25zSW1wbChvd25lcklkLCBvbGREZWNvcmF0aW9ucywgbmV3RGVjb3JhdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0bGV0IHJlc3VsdDogVCB8IG51bGwgPSBudWxsO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXN1bHQgPSBjYWxsYmFjayhjaGFuZ2VBY2Nlc3Nvcik7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZSk7XG5cdFx0fVxuXHRcdC8vIEludmFsaWRhdGUgY2hhbmdlIGFjY2Vzc29yXG5cdFx0Y2hhbmdlQWNjZXNzb3IuYWRkRGVjb3JhdGlvbiA9IGludmFsaWRGdW5jO1xuXHRcdGNoYW5nZUFjY2Vzc29yLmNoYW5nZURlY29yYXRpb24gPSBpbnZhbGlkRnVuYztcblx0XHRjaGFuZ2VBY2Nlc3Nvci5jaGFuZ2VEZWNvcmF0aW9uT3B0aW9ucyA9IGludmFsaWRGdW5jO1xuXHRcdGNoYW5nZUFjY2Vzc29yLnJlbW92ZURlY29yYXRpb24gPSBpbnZhbGlkRnVuYztcblx0XHRjaGFuZ2VBY2Nlc3Nvci5kZWx0YURlY29yYXRpb25zID0gaW52YWxpZEZ1bmM7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBkZWx0YURlY29yYXRpb25zKG9sZERlY29yYXRpb25zOiBzdHJpbmdbXSwgbmV3RGVjb3JhdGlvbnM6IG1vZGVsLklNb2RlbERlbHRhRGVjb3JhdGlvbltdLCBvd25lcklkOiBudW1iZXIgPSAwKTogc3RyaW5nW10ge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0aWYgKCFvbGREZWNvcmF0aW9ucykge1xuXHRcdFx0b2xkRGVjb3JhdGlvbnMgPSBbXTtcblx0XHR9XG5cdFx0aWYgKG9sZERlY29yYXRpb25zLmxlbmd0aCA9PT0gMCAmJiBuZXdEZWNvcmF0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIG5vdGhpbmcgdG8gZG9cblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fZGVsdGFEZWNvcmF0aW9uQ2FsbENudCsrO1xuXHRcdFx0aWYgKHRoaXMuX2RlbHRhRGVjb3JhdGlvbkNhbGxDbnQgPiAxKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgSW52b2tpbmcgZGVsdGFEZWNvcmF0aW9ucyByZWN1cnNpdmVseSBjb3VsZCBsZWFkIHRvIGxlYWtpbmcgZGVjb3JhdGlvbnMuYCk7XG5cdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKG5ldyBFcnJvcihgSW52b2tpbmcgZGVsdGFEZWNvcmF0aW9ucyByZWN1cnNpdmVseSBjb3VsZCBsZWFkIHRvIGxlYWtpbmcgZGVjb3JhdGlvbnMuYCkpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5iZWdpbkRlZmVycmVkRW1pdCgpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX2RlbHRhRGVjb3JhdGlvbnNJbXBsKG93bmVySWQsIG9sZERlY29yYXRpb25zLCBuZXdEZWNvcmF0aW9ucyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZW5kRGVmZXJyZWRFbWl0KCk7XG5cdFx0XHR0aGlzLl9kZWx0YURlY29yYXRpb25DYWxsQ250LS07XG5cdFx0fVxuXHR9XG5cblx0X2dldFRyYWNrZWRSYW5nZShpZDogc3RyaW5nKTogUmFuZ2UgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5nZXREZWNvcmF0aW9uUmFuZ2UoaWQpO1xuXHR9XG5cblx0X3NldFRyYWNrZWRSYW5nZShpZDogc3RyaW5nIHwgbnVsbCwgbmV3UmFuZ2U6IG51bGwsIG5ld1N0aWNraW5lc3M6IG1vZGVsLlRyYWNrZWRSYW5nZVN0aWNraW5lc3MpOiBudWxsO1xuXHRfc2V0VHJhY2tlZFJhbmdlKGlkOiBzdHJpbmcgfCBudWxsLCBuZXdSYW5nZTogUmFuZ2UsIG5ld1N0aWNraW5lc3M6IG1vZGVsLlRyYWNrZWRSYW5nZVN0aWNraW5lc3MpOiBzdHJpbmc7XG5cdF9zZXRUcmFja2VkUmFuZ2UoaWQ6IHN0cmluZyB8IG51bGwsIG5ld1JhbmdlOiBSYW5nZSB8IG51bGwsIG5ld1N0aWNraW5lc3M6IG1vZGVsLlRyYWNrZWRSYW5nZVN0aWNraW5lc3MpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRjb25zdCBub2RlID0gKGlkID8gdGhpcy5fZGVjb3JhdGlvbnNbaWRdIDogbnVsbCk7XG5cblx0XHRpZiAoIW5vZGUpIHtcblx0XHRcdGlmICghbmV3UmFuZ2UpIHtcblx0XHRcdFx0Ly8gbm9kZSBkb2Vzbid0IGV4aXN0LCB0aGUgcmVxdWVzdCBpcyB0byBkZWxldGUgPT4gbm90aGluZyB0byBkb1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdC8vIG5vZGUgZG9lc24ndCBleGlzdCwgdGhlIHJlcXVlc3QgaXMgdG8gc2V0ID0+IGFkZCB0aGUgdHJhY2tlZCByYW5nZVxuXHRcdFx0cmV0dXJuIHRoaXMuX2RlbHRhRGVjb3JhdGlvbnNJbXBsKDAsIFtdLCBbeyByYW5nZTogbmV3UmFuZ2UsIG9wdGlvbnM6IFRSQUNLRURfUkFOR0VfT1BUSU9OU1tuZXdTdGlja2luZXNzXSB9XSwgdHJ1ZSlbMF07XG5cdFx0fVxuXG5cdFx0aWYgKCFuZXdSYW5nZSkge1xuXHRcdFx0Ly8gbm9kZSBleGlzdHMsIHRoZSByZXF1ZXN0IGlzIHRvIGRlbGV0ZSA9PiBkZWxldGUgbm9kZVxuXHRcdFx0dGhpcy5fZGVjb3JhdGlvbnNUcmVlLmRlbGV0ZShub2RlKTtcblx0XHRcdGRlbGV0ZSB0aGlzLl9kZWNvcmF0aW9uc1tub2RlLmlkXTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdC8vIG5vZGUgZXhpc3RzLCB0aGUgcmVxdWVzdCBpcyB0byBzZXQgPT4gY2hhbmdlIHRoZSB0cmFja2VkIHJhbmdlIGFuZCBpdHMgb3B0aW9uc1xuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fdmFsaWRhdGVSYW5nZVJlbGF4ZWROb0FsbG9jYXRpb25zKG5ld1JhbmdlKTtcblx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMuX2J1ZmZlci5nZXRPZmZzZXRBdChyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRjb25zdCBlbmRPZmZzZXQgPSB0aGlzLl9idWZmZXIuZ2V0T2Zmc2V0QXQocmFuZ2UuZW5kTGluZU51bWJlciwgcmFuZ2UuZW5kQ29sdW1uKTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUuZGVsZXRlKG5vZGUpO1xuXHRcdG5vZGUucmVzZXQodGhpcy5nZXRWZXJzaW9uSWQoKSwgc3RhcnRPZmZzZXQsIGVuZE9mZnNldCwgcmFuZ2UpO1xuXHRcdG5vZGUuc2V0T3B0aW9ucyhUUkFDS0VEX1JBTkdFX09QVElPTlNbbmV3U3RpY2tpbmVzc10pO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5pbnNlcnQobm9kZSk7XG5cdFx0cmV0dXJuIG5vZGUuaWQ7XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlQWxsRGVjb3JhdGlvbnNXaXRoT3duZXJJZChvd25lcklkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBub2RlcyA9IHRoaXMuX2RlY29yYXRpb25zVHJlZS5jb2xsZWN0Tm9kZXNGcm9tT3duZXIob3duZXJJZCk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IG5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBub2RlID0gbm9kZXNbaV07XG5cblx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5kZWxldGUobm9kZSk7XG5cdFx0XHRkZWxldGUgdGhpcy5fZGVjb3JhdGlvbnNbbm9kZS5pZF07XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldERlY29yYXRpb25PcHRpb25zKGRlY29yYXRpb25JZDogc3RyaW5nKTogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgfCBudWxsIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5fZGVjb3JhdGlvbnNbZGVjb3JhdGlvbklkXTtcblx0XHRpZiAoIW5vZGUpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gbm9kZS5vcHRpb25zO1xuXHR9XG5cblx0cHVibGljIGdldERlY29yYXRpb25SYW5nZShkZWNvcmF0aW9uSWQ6IHN0cmluZyk6IFJhbmdlIHwgbnVsbCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuX2RlY29yYXRpb25zW2RlY29yYXRpb25JZF07XG5cdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2RlY29yYXRpb25zVHJlZS5nZXROb2RlUmFuZ2UodGhpcywgbm9kZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZURlY29yYXRpb25zKGxpbmVOdW1iZXI6IG51bWJlciwgb3duZXJJZDogbnVtYmVyID0gMCwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiA9IGZhbHNlKTogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRpZiAobGluZU51bWJlciA8IDEgfHwgbGluZU51bWJlciA+IHRoaXMuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TGluZXNEZWNvcmF0aW9ucyhsaW5lTnVtYmVyLCBsaW5lTnVtYmVyLCBvd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lc0RlY29yYXRpb25zKF9zdGFydExpbmVOdW1iZXI6IG51bWJlciwgX2VuZExpbmVOdW1iZXI6IG51bWJlciwgb3duZXJJZDogbnVtYmVyID0gMCwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiA9IGZhbHNlLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnM6IGJvb2xlYW4gPSBmYWxzZSk6IG1vZGVsLklNb2RlbERlY29yYXRpb25bXSB7XG5cdFx0Y29uc3QgbGluZUNvdW50ID0gdGhpcy5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCBzdGFydExpbmVOdW1iZXIgPSBNYXRoLm1pbihsaW5lQ291bnQsIE1hdGgubWF4KDEsIF9zdGFydExpbmVOdW1iZXIpKTtcblx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gTWF0aC5taW4obGluZUNvdW50LCBNYXRoLm1heCgxLCBfZW5kTGluZU51bWJlcikpO1xuXHRcdGNvbnN0IGVuZENvbHVtbiA9IHRoaXMuZ2V0TGluZU1heENvbHVtbihlbmRMaW5lTnVtYmVyKTtcblx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIDEsIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbik7XG5cblx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IHRoaXMuX2dldERlY29yYXRpb25zSW5SYW5nZShyYW5nZSwgb3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0XHRwdXNoTWFueShkZWNvcmF0aW9ucywgdGhpcy5fZGVjb3JhdGlvblByb3ZpZGVyLmdldERlY29yYXRpb25zSW5SYW5nZShyYW5nZSwgb3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbikpO1xuXHRcdHJldHVybiBkZWNvcmF0aW9ucztcblx0fVxuXG5cdHB1YmxpYyBnZXREZWNvcmF0aW9uc0luUmFuZ2UocmFuZ2U6IElSYW5nZSwgb3duZXJJZDogbnVtYmVyID0gMCwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiA9IGZhbHNlLCBvbmx5TWluaW1hcERlY29yYXRpb25zOiBib29sZWFuID0gZmFsc2UsIG9ubHlNYXJnaW5EZWNvcmF0aW9uczogYm9vbGVhbiA9IGZhbHNlKTogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRjb25zdCB2YWxpZGF0ZWRSYW5nZSA9IHRoaXMudmFsaWRhdGVSYW5nZShyYW5nZSk7XG5cblx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IHRoaXMuX2dldERlY29yYXRpb25zSW5SYW5nZSh2YWxpZGF0ZWRSYW5nZSwgb3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0XHRwdXNoTWFueShkZWNvcmF0aW9ucywgdGhpcy5fZGVjb3JhdGlvblByb3ZpZGVyLmdldERlY29yYXRpb25zSW5SYW5nZSh2YWxpZGF0ZWRSYW5nZSwgb3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb25seU1pbmltYXBEZWNvcmF0aW9ucykpO1xuXHRcdHJldHVybiBkZWNvcmF0aW9ucztcblx0fVxuXG5cdHB1YmxpYyBnZXRPdmVydmlld1J1bGVyRGVjb3JhdGlvbnMob3duZXJJZDogbnVtYmVyID0gMCwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiA9IGZhbHNlKTogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLmdldEFsbCh0aGlzLCBvd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uLCB0cnVlLCBmYWxzZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0SW5qZWN0ZWRUZXh0RGVjb3JhdGlvbnMob3duZXJJZDogbnVtYmVyID0gMCk6IG1vZGVsLklNb2RlbERlY29yYXRpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlY29yYXRpb25zVHJlZS5nZXRBbGxJbmplY3RlZFRleHQodGhpcywgb3duZXJJZCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRJbmplY3RlZFRleHRJbkxpbmUobGluZU51bWJlcjogbnVtYmVyKTogTGluZUluamVjdGVkVGV4dFtdIHtcblx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMuX2J1ZmZlci5nZXRPZmZzZXRBdChsaW5lTnVtYmVyLCAxKTtcblx0XHRjb25zdCBlbmRPZmZzZXQgPSBzdGFydE9mZnNldCArIHRoaXMuX2J1ZmZlci5nZXRMaW5lTGVuZ3RoKGxpbmVOdW1iZXIpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLmdldEluamVjdGVkVGV4dEluSW50ZXJ2YWwodGhpcywgc3RhcnRPZmZzZXQsIGVuZE9mZnNldCwgMCk7XG5cdFx0cmV0dXJuIExpbmVJbmplY3RlZFRleHQuZnJvbURlY29yYXRpb25zKHJlc3VsdCkuZmlsdGVyKHQgPT4gdC5saW5lTnVtYmVyID09PSBsaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBbGxEZWNvcmF0aW9ucyhvd25lcklkOiBudW1iZXIgPSAwLCBmaWx0ZXJPdXRWYWxpZGF0aW9uOiBib29sZWFuID0gZmFsc2UpOiBtb2RlbC5JTW9kZWxEZWNvcmF0aW9uW10ge1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUuZ2V0QWxsKHRoaXMsIG93bmVySWQsIGZpbHRlck91dFZhbGlkYXRpb24sIGZhbHNlLCBmYWxzZSk7XG5cdFx0cmVzdWx0ID0gcmVzdWx0LmNvbmNhdCh0aGlzLl9kZWNvcmF0aW9uUHJvdmlkZXIuZ2V0QWxsRGVjb3JhdGlvbnMob3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbikpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWxsTWFyZ2luRGVjb3JhdGlvbnMob3duZXJJZDogbnVtYmVyID0gMCk6IG1vZGVsLklNb2RlbERlY29yYXRpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlY29yYXRpb25zVHJlZS5nZXRBbGwodGhpcywgb3duZXJJZCwgZmFsc2UsIGZhbHNlLCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldERlY29yYXRpb25zSW5SYW5nZShmaWx0ZXJSYW5nZTogUmFuZ2UsIGZpbHRlck93bmVySWQ6IG51bWJlciwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiwgb25seU1hcmdpbkRlY29yYXRpb25zOiBib29sZWFuKTogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMuX2J1ZmZlci5nZXRPZmZzZXRBdChmaWx0ZXJSYW5nZS5zdGFydExpbmVOdW1iZXIsIGZpbHRlclJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRjb25zdCBlbmRPZmZzZXQgPSB0aGlzLl9idWZmZXIuZ2V0T2Zmc2V0QXQoZmlsdGVyUmFuZ2UuZW5kTGluZU51bWJlciwgZmlsdGVyUmFuZ2UuZW5kQ29sdW1uKTtcblx0XHRyZXR1cm4gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLmdldEFsbEluSW50ZXJ2YWwodGhpcywgc3RhcnRPZmZzZXQsIGVuZE9mZnNldCwgZmlsdGVyT3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRSYW5nZUF0KHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyKTogUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0UmFuZ2VBdChzdGFydCwgZW5kIC0gc3RhcnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2hhbmdlRGVjb3JhdGlvbkltcGwoZGVjb3JhdGlvbklkOiBzdHJpbmcsIF9yYW5nZTogSVJhbmdlKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuX2RlY29yYXRpb25zW2RlY29yYXRpb25JZF07XG5cdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUub3B0aW9ucy5hZnRlcikge1xuXHRcdFx0Y29uc3Qgb2xkUmFuZ2UgPSB0aGlzLmdldERlY29yYXRpb25SYW5nZShkZWNvcmF0aW9uSWQpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5yZWNvcmRMaW5lQWZmZWN0ZWRCeUluamVjdGVkVGV4dChvbGRSYW5nZSEuZW5kTGluZU51bWJlcik7XG5cdFx0fVxuXHRcdGlmIChub2RlLm9wdGlvbnMuYmVmb3JlKSB7XG5cdFx0XHRjb25zdCBvbGRSYW5nZSA9IHRoaXMuZ2V0RGVjb3JhdGlvblJhbmdlKGRlY29yYXRpb25JZCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLnJlY29yZExpbmVBZmZlY3RlZEJ5SW5qZWN0ZWRUZXh0KG9sZFJhbmdlIS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fdmFsaWRhdGVSYW5nZVJlbGF4ZWROb0FsbG9jYXRpb25zKF9yYW5nZSk7XG5cdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0aGlzLl9idWZmZXIuZ2V0T2Zmc2V0QXQocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbik7XG5cdFx0Y29uc3QgZW5kT2Zmc2V0ID0gdGhpcy5fYnVmZmVyLmdldE9mZnNldEF0KHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbik7XG5cblx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUuZGVsZXRlKG5vZGUpO1xuXHRcdG5vZGUucmVzZXQodGhpcy5nZXRWZXJzaW9uSWQoKSwgc3RhcnRPZmZzZXQsIGVuZE9mZnNldCwgcmFuZ2UpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5pbnNlcnQobm9kZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5jaGVja0FmZmVjdGVkQW5kRmlyZShub2RlLm9wdGlvbnMpO1xuXG5cdFx0aWYgKG5vZGUub3B0aW9ucy5hZnRlcikge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5yZWNvcmRMaW5lQWZmZWN0ZWRCeUluamVjdGVkVGV4dChyYW5nZS5lbmRMaW5lTnVtYmVyKTtcblx0XHR9XG5cdFx0aWYgKG5vZGUub3B0aW9ucy5iZWZvcmUpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMucmVjb3JkTGluZUFmZmVjdGVkQnlJbmplY3RlZFRleHQocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jaGFuZ2VEZWNvcmF0aW9uT3B0aW9uc0ltcGwoZGVjb3JhdGlvbklkOiBzdHJpbmcsIG9wdGlvbnM6IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpOiB2b2lkIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5fZGVjb3JhdGlvbnNbZGVjb3JhdGlvbklkXTtcblx0XHRpZiAoIW5vZGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBub2RlV2FzSW5PdmVydmlld1J1bGVyID0gKG5vZGUub3B0aW9ucy5vdmVydmlld1J1bGVyICYmIG5vZGUub3B0aW9ucy5vdmVydmlld1J1bGVyLmNvbG9yID8gdHJ1ZSA6IGZhbHNlKTtcblx0XHRjb25zdCBub2RlSXNJbk92ZXJ2aWV3UnVsZXIgPSAob3B0aW9ucy5vdmVydmlld1J1bGVyICYmIG9wdGlvbnMub3ZlcnZpZXdSdWxlci5jb2xvciA/IHRydWUgOiBmYWxzZSk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmNoZWNrQWZmZWN0ZWRBbmRGaXJlKG5vZGUub3B0aW9ucyk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5jaGVja0FmZmVjdGVkQW5kRmlyZShvcHRpb25zKTtcblxuXHRcdGlmIChub2RlLm9wdGlvbnMuYWZ0ZXIgfHwgb3B0aW9ucy5hZnRlcikge1xuXHRcdFx0Y29uc3Qgbm9kZVJhbmdlID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLmdldE5vZGVSYW5nZSh0aGlzLCBub2RlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMucmVjb3JkTGluZUFmZmVjdGVkQnlJbmplY3RlZFRleHQobm9kZVJhbmdlLmVuZExpbmVOdW1iZXIpO1xuXHRcdH1cblx0XHRpZiAobm9kZS5vcHRpb25zLmJlZm9yZSB8fCBvcHRpb25zLmJlZm9yZSkge1xuXHRcdFx0Y29uc3Qgbm9kZVJhbmdlID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLmdldE5vZGVSYW5nZSh0aGlzLCBub2RlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMucmVjb3JkTGluZUFmZmVjdGVkQnlJbmplY3RlZFRleHQobm9kZVJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW92ZWRJbk92ZXJ2aWV3UnVsZXIgPSBub2RlV2FzSW5PdmVydmlld1J1bGVyICE9PSBub2RlSXNJbk92ZXJ2aWV3UnVsZXI7XG5cdFx0Y29uc3QgY2hhbmdlZFdoZXRoZXJJbmplY3RlZFRleHQgPSBpc09wdGlvbnNJbmplY3RlZFRleHQob3B0aW9ucykgIT09IGlzTm9kZUluamVjdGVkVGV4dChub2RlKTtcblx0XHRpZiAobW92ZWRJbk92ZXJ2aWV3UnVsZXIgfHwgY2hhbmdlZFdoZXRoZXJJbmplY3RlZFRleHQpIHtcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5kZWxldGUobm9kZSk7XG5cdFx0XHRub2RlLnNldE9wdGlvbnMob3B0aW9ucyk7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUuaW5zZXJ0KG5vZGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRub2RlLnNldE9wdGlvbnMob3B0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZGVsdGFEZWNvcmF0aW9uc0ltcGwob3duZXJJZDogbnVtYmVyLCBvbGREZWNvcmF0aW9uc0lkczogc3RyaW5nW10sIG5ld0RlY29yYXRpb25zOiBtb2RlbC5JTW9kZWxEZWx0YURlY29yYXRpb25bXSwgc3VwcHJlc3NFdmVudHM6IGJvb2xlYW4gPSBmYWxzZSk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCB2ZXJzaW9uSWQgPSB0aGlzLmdldFZlcnNpb25JZCgpO1xuXG5cdFx0Y29uc3Qgb2xkRGVjb3JhdGlvbnNMZW4gPSBvbGREZWNvcmF0aW9uc0lkcy5sZW5ndGg7XG5cdFx0bGV0IG9sZERlY29yYXRpb25JbmRleCA9IDA7XG5cblx0XHRjb25zdCBuZXdEZWNvcmF0aW9uc0xlbiA9IG5ld0RlY29yYXRpb25zLmxlbmd0aDtcblx0XHRsZXQgbmV3RGVjb3JhdGlvbkluZGV4ID0gMDtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuYmVnaW5EZWZlcnJlZEVtaXQoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gbmV3IEFycmF5PHN0cmluZz4obmV3RGVjb3JhdGlvbnNMZW4pO1xuXHRcdFx0d2hpbGUgKG9sZERlY29yYXRpb25JbmRleCA8IG9sZERlY29yYXRpb25zTGVuIHx8IG5ld0RlY29yYXRpb25JbmRleCA8IG5ld0RlY29yYXRpb25zTGVuKSB7XG5cblx0XHRcdFx0bGV0IG5vZGU6IEludGVydmFsTm9kZSB8IG51bGwgPSBudWxsO1xuXG5cdFx0XHRcdGlmIChvbGREZWNvcmF0aW9uSW5kZXggPCBvbGREZWNvcmF0aW9uc0xlbikge1xuXHRcdFx0XHRcdC8vICgxKSBnZXQgb3Vyc2VsdmVzIGFuIG9sZCBub2RlXG5cdFx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdFx0bm9kZSA9IHRoaXMuX2RlY29yYXRpb25zW29sZERlY29yYXRpb25zSWRzW29sZERlY29yYXRpb25JbmRleCsrXV07XG5cdFx0XHRcdFx0fSB3aGlsZSAoIW5vZGUgJiYgb2xkRGVjb3JhdGlvbkluZGV4IDwgb2xkRGVjb3JhdGlvbnNMZW4pO1xuXG5cdFx0XHRcdFx0Ly8gKDIpIHJlbW92ZSB0aGUgbm9kZSBmcm9tIHRoZSB0cmVlIChpZiBpdCBleGlzdHMpXG5cdFx0XHRcdFx0aWYgKG5vZGUpIHtcblx0XHRcdFx0XHRcdGlmIChub2RlLm9wdGlvbnMuYWZ0ZXIpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgbm9kZVJhbmdlID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLmdldE5vZGVSYW5nZSh0aGlzLCBub2RlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5yZWNvcmRMaW5lQWZmZWN0ZWRCeUluamVjdGVkVGV4dChub2RlUmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAobm9kZS5vcHRpb25zLmJlZm9yZSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBub2RlUmFuZ2UgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUuZ2V0Tm9kZVJhbmdlKHRoaXMsIG5vZGUpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLnJlY29yZExpbmVBZmZlY3RlZEJ5SW5qZWN0ZWRUZXh0KG5vZGVSYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUuZGVsZXRlKG5vZGUpO1xuXG5cdFx0XHRcdFx0XHRpZiAoIXN1cHByZXNzRXZlbnRzKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuY2hlY2tBZmZlY3RlZEFuZEZpcmUobm9kZS5vcHRpb25zKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobmV3RGVjb3JhdGlvbkluZGV4IDwgbmV3RGVjb3JhdGlvbnNMZW4pIHtcblx0XHRcdFx0XHQvLyAoMykgY3JlYXRlIGEgbmV3IG5vZGUgaWYgbmVjZXNzYXJ5XG5cdFx0XHRcdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpbnRlcm5hbERlY29yYXRpb25JZCA9ICgrK3RoaXMuX2xhc3REZWNvcmF0aW9uSWQpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbklkID0gYCR7dGhpcy5faW5zdGFuY2VJZH07JHtpbnRlcm5hbERlY29yYXRpb25JZH1gO1xuXHRcdFx0XHRcdFx0bm9kZSA9IG5ldyBJbnRlcnZhbE5vZGUoZGVjb3JhdGlvbklkLCAwLCAwKTtcblx0XHRcdFx0XHRcdHRoaXMuX2RlY29yYXRpb25zW2RlY29yYXRpb25JZF0gPSBub2RlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vICg0KSBpbml0aWFsaXplIG5vZGVcblx0XHRcdFx0XHRjb25zdCBuZXdEZWNvcmF0aW9uID0gbmV3RGVjb3JhdGlvbnNbbmV3RGVjb3JhdGlvbkluZGV4XTtcblx0XHRcdFx0XHRjb25zdCByYW5nZSA9IHRoaXMuX3ZhbGlkYXRlUmFuZ2VSZWxheGVkTm9BbGxvY2F0aW9ucyhuZXdEZWNvcmF0aW9uLnJhbmdlKTtcblx0XHRcdFx0XHRjb25zdCBvcHRpb25zID0gX25vcm1hbGl6ZU9wdGlvbnMobmV3RGVjb3JhdGlvbi5vcHRpb25zKTtcblx0XHRcdFx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRoaXMuX2J1ZmZlci5nZXRPZmZzZXRBdChyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRcdFx0XHRjb25zdCBlbmRPZmZzZXQgPSB0aGlzLl9idWZmZXIuZ2V0T2Zmc2V0QXQocmFuZ2UuZW5kTGluZU51bWJlciwgcmFuZ2UuZW5kQ29sdW1uKTtcblxuXHRcdFx0XHRcdG5vZGUub3duZXJJZCA9IG93bmVySWQ7XG5cdFx0XHRcdFx0bm9kZS5yZXNldCh2ZXJzaW9uSWQsIHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQsIHJhbmdlKTtcblx0XHRcdFx0XHRub2RlLnNldE9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRcdFx0XHRpZiAobm9kZS5vcHRpb25zLmFmdGVyKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLnJlY29yZExpbmVBZmZlY3RlZEJ5SW5qZWN0ZWRUZXh0KHJhbmdlLmVuZExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAobm9kZS5vcHRpb25zLmJlZm9yZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5yZWNvcmRMaW5lQWZmZWN0ZWRCeUluamVjdGVkVGV4dChyYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghc3VwcHJlc3NFdmVudHMpIHtcblx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuY2hlY2tBZmZlY3RlZEFuZEZpcmUob3B0aW9ucyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbnNUcmVlLmluc2VydChub2RlKTtcblxuXHRcdFx0XHRcdHJlc3VsdFtuZXdEZWNvcmF0aW9uSW5kZXhdID0gbm9kZS5pZDtcblxuXHRcdFx0XHRcdG5ld0RlY29yYXRpb25JbmRleCsrO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChub2RlKSB7XG5cdFx0XHRcdFx0XHRkZWxldGUgdGhpcy5fZGVjb3JhdGlvbnNbbm9kZS5pZF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZW5kRGVmZXJyZWRFbWl0KCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFRva2VuaXphdGlvblxuXG5cdC8vIFRPRE8gbW92ZSB0aGVtIHRvIHRoZSB0b2tlbml6YXRpb24gcGFydC5cblx0cHVibGljIGdldExhbmd1YWdlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy50b2tlbml6YXRpb24uZ2V0TGFuZ3VhZ2VJZCgpO1xuXHR9XG5cblx0cHVibGljIHNldExhbmd1YWdlKGxhbmd1YWdlSWRPclNlbGVjdGlvbjogc3RyaW5nIHwgSUxhbmd1YWdlU2VsZWN0aW9uLCBzb3VyY2U/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIGxhbmd1YWdlSWRPclNlbGVjdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuX2xhbmd1YWdlU2VsZWN0aW9uTGlzdGVuZXIuY2xlYXIoKTtcblx0XHRcdHRoaXMuX3NldExhbmd1YWdlKGxhbmd1YWdlSWRPclNlbGVjdGlvbiwgc291cmNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fbGFuZ3VhZ2VTZWxlY3Rpb25MaXN0ZW5lci52YWx1ZSA9IGxhbmd1YWdlSWRPclNlbGVjdGlvbi5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLl9zZXRMYW5ndWFnZShsYW5ndWFnZUlkT3JTZWxlY3Rpb24ubGFuZ3VhZ2VJZCwgc291cmNlKSk7XG5cdFx0XHR0aGlzLl9zZXRMYW5ndWFnZShsYW5ndWFnZUlkT3JTZWxlY3Rpb24ubGFuZ3VhZ2VJZCwgc291cmNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zZXRMYW5ndWFnZShsYW5ndWFnZUlkOiBzdHJpbmcsIHNvdXJjZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMudG9rZW5pemF0aW9uLnNldExhbmd1YWdlSWQobGFuZ3VhZ2VJZCwgc291cmNlKTtcblx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UucmVxdWVzdFJpY2hMYW5ndWFnZUZlYXR1cmVzKGxhbmd1YWdlSWQpO1xuXHR9XG5cblx0cHVibGljIGdldExhbmd1YWdlSWRBdFBvc2l0aW9uKGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnRva2VuaXphdGlvbi5nZXRMYW5ndWFnZUlkQXRQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pO1xuXHR9XG5cblx0cHVibGljIGdldFdvcmRBdFBvc2l0aW9uKHBvc2l0aW9uOiBJUG9zaXRpb24pOiBJV29yZEF0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5nZXRXb3JkQXRQb3NpdGlvbihwb3NpdGlvbik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zaXRpb246IElQb3NpdGlvbik6IElXb3JkQXRQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2VuaXphdGlvblRleHRNb2RlbFBhcnQuZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zaXRpb24pO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cdG5vcm1hbGl6ZVBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbiwgYWZmaW5pdHk6IG1vZGVsLlBvc2l0aW9uQWZmaW5pdHkpOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGNvbHVtbiBhdCB3aGljaCBpbmRlbnRhdGlvbiBzdG9wcyBhdCBhIGdpdmVuIGxpbmUuXG5cdCAqIEBpbnRlcm5hbFxuXHQqL1xuXHRwdWJsaWMgZ2V0TGluZUluZGVudENvbHVtbihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdC8vIENvbHVtbnMgc3RhcnQgd2l0aCAxLlxuXHRcdHJldHVybiBpbmRlbnRPZkxpbmUodGhpcy5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKSkgKyAxO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBUZXh0TW9kZWwoJHt0aGlzLnVyaS50b1N0cmluZygpfSlgO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmRlbnRPZkxpbmUobGluZTogc3RyaW5nKTogbnVtYmVyIHtcblx0bGV0IGluZGVudCA9IDA7XG5cdGZvciAoY29uc3QgYyBvZiBsaW5lKSB7XG5cdFx0aWYgKGMgPT09ICcgJyB8fCBjID09PSAnXFx0Jykge1xuXHRcdFx0aW5kZW50Kys7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gaW5kZW50O1xufVxuXG4vLyNyZWdpb24gRGVjb3JhdGlvbnNcblxuZnVuY3Rpb24gaXNOb2RlSW5PdmVydmlld1J1bGVyKG5vZGU6IEludGVydmFsTm9kZSk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gKG5vZGUub3B0aW9ucy5vdmVydmlld1J1bGVyICYmIG5vZGUub3B0aW9ucy5vdmVydmlld1J1bGVyLmNvbG9yID8gdHJ1ZSA6IGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gaXNPcHRpb25zSW5qZWN0ZWRUZXh0KG9wdGlvbnM6IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpOiBib29sZWFuIHtcblx0cmV0dXJuICEhb3B0aW9ucy5hZnRlciB8fCAhIW9wdGlvbnMuYmVmb3JlO1xufVxuXG5mdW5jdGlvbiBpc05vZGVJbmplY3RlZFRleHQobm9kZTogSW50ZXJ2YWxOb2RlKTogYm9vbGVhbiB7XG5cdHJldHVybiAhIW5vZGUub3B0aW9ucy5hZnRlciB8fCAhIW5vZGUub3B0aW9ucy5iZWZvcmU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURlY29yYXRpb25zVHJlZXNIb3N0IHtcblx0Z2V0VmVyc2lvbklkKCk6IG51bWJlcjtcblx0Z2V0UmFuZ2VBdChzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcik6IFJhbmdlO1xufVxuXG5jbGFzcyBEZWNvcmF0aW9uc1RyZWVzIHtcblxuXHQvKipcblx0ICogVGhpcyB0cmVlIGhvbGRzIGRlY29yYXRpb25zIHRoYXQgZG8gbm90IHNob3cgdXAgaW4gdGhlIG92ZXJ2aWV3IHJ1bGVyLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfZGVjb3JhdGlvbnNUcmVlMDogSW50ZXJ2YWxUcmVlO1xuXG5cdC8qKlxuXHQgKiBUaGlzIHRyZWUgaG9sZHMgZGVjb3JhdGlvbnMgdGhhdCBzaG93IHVwIGluIHRoZSBvdmVydmlldyBydWxlci5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlY29yYXRpb25zVHJlZTE6IEludGVydmFsVHJlZTtcblxuXHQvKipcblx0ICogVGhpcyB0cmVlIGhvbGRzIGRlY29yYXRpb25zIHRoYXQgY29udGFpbiBpbmplY3RlZCB0ZXh0LlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfaW5qZWN0ZWRUZXh0RGVjb3JhdGlvbnNUcmVlOiBJbnRlcnZhbFRyZWU7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnNUcmVlMCA9IG5ldyBJbnRlcnZhbFRyZWUoKTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUxID0gbmV3IEludGVydmFsVHJlZSgpO1xuXHRcdHRoaXMuX2luamVjdGVkVGV4dERlY29yYXRpb25zVHJlZSA9IG5ldyBJbnRlcnZhbFRyZWUoKTtcblx0fVxuXG5cdHB1YmxpYyBlbnN1cmVBbGxOb2Rlc0hhdmVSYW5nZXMoaG9zdDogSURlY29yYXRpb25zVHJlZXNIb3N0KTogdm9pZCB7XG5cdFx0dGhpcy5nZXRBbGwoaG9zdCwgMCwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIF9lbnN1cmVOb2Rlc0hhdmVSYW5nZXMoaG9zdDogSURlY29yYXRpb25zVHJlZXNIb3N0LCBub2RlczogSW50ZXJ2YWxOb2RlW10pOiBtb2RlbC5JTW9kZWxEZWNvcmF0aW9uW10ge1xuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuXHRcdFx0aWYgKG5vZGUucmFuZ2UgPT09IG51bGwpIHtcblx0XHRcdFx0bm9kZS5yYW5nZSA9IGhvc3QuZ2V0UmFuZ2VBdChub2RlLmNhY2hlZEFic29sdXRlU3RhcnQsIG5vZGUuY2FjaGVkQWJzb2x1dGVFbmQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gPG1vZGVsLklNb2RlbERlY29yYXRpb25bXT5ub2Rlcztcblx0fVxuXG5cdHB1YmxpYyBnZXRBbGxJbkludGVydmFsKGhvc3Q6IElEZWNvcmF0aW9uc1RyZWVzSG9zdCwgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGZpbHRlck93bmVySWQ6IG51bWJlciwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiwgb25seU1hcmdpbkRlY29yYXRpb25zOiBib29sZWFuKTogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRjb25zdCB2ZXJzaW9uSWQgPSBob3N0LmdldFZlcnNpb25JZCgpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX2ludGVydmFsU2VhcmNoKHN0YXJ0LCBlbmQsIGZpbHRlck93bmVySWQsIGZpbHRlck91dFZhbGlkYXRpb24sIHZlcnNpb25JZCwgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0XHRyZXR1cm4gdGhpcy5fZW5zdXJlTm9kZXNIYXZlUmFuZ2VzKGhvc3QsIHJlc3VsdCk7XG5cdH1cblxuXHRwcml2YXRlIF9pbnRlcnZhbFNlYXJjaChzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlciwgZmlsdGVyT3duZXJJZDogbnVtYmVyLCBmaWx0ZXJPdXRWYWxpZGF0aW9uOiBib29sZWFuLCBjYWNoZWRWZXJzaW9uSWQ6IG51bWJlciwgb25seU1hcmdpbkRlY29yYXRpb25zOiBib29sZWFuKTogSW50ZXJ2YWxOb2RlW10ge1xuXHRcdGNvbnN0IHIwID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlMC5pbnRlcnZhbFNlYXJjaChzdGFydCwgZW5kLCBmaWx0ZXJPd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uLCBjYWNoZWRWZXJzaW9uSWQsIG9ubHlNYXJnaW5EZWNvcmF0aW9ucyk7XG5cdFx0Y29uc3QgcjEgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUxLmludGVydmFsU2VhcmNoKHN0YXJ0LCBlbmQsIGZpbHRlck93bmVySWQsIGZpbHRlck91dFZhbGlkYXRpb24sIGNhY2hlZFZlcnNpb25JZCwgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0XHRjb25zdCByMiA9IHRoaXMuX2luamVjdGVkVGV4dERlY29yYXRpb25zVHJlZS5pbnRlcnZhbFNlYXJjaChzdGFydCwgZW5kLCBmaWx0ZXJPd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uLCBjYWNoZWRWZXJzaW9uSWQsIG9ubHlNYXJnaW5EZWNvcmF0aW9ucyk7XG5cdFx0cmV0dXJuIHIwLmNvbmNhdChyMSkuY29uY2F0KHIyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRJbmplY3RlZFRleHRJbkludGVydmFsKGhvc3Q6IElEZWNvcmF0aW9uc1RyZWVzSG9zdCwgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGZpbHRlck93bmVySWQ6IG51bWJlcik6IG1vZGVsLklNb2RlbERlY29yYXRpb25bXSB7XG5cdFx0Y29uc3QgdmVyc2lvbklkID0gaG9zdC5nZXRWZXJzaW9uSWQoKTtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9pbmplY3RlZFRleHREZWNvcmF0aW9uc1RyZWUuaW50ZXJ2YWxTZWFyY2goc3RhcnQsIGVuZCwgZmlsdGVyT3duZXJJZCwgZmFsc2UsIHZlcnNpb25JZCwgZmFsc2UpO1xuXHRcdHJldHVybiB0aGlzLl9lbnN1cmVOb2Rlc0hhdmVSYW5nZXMoaG9zdCwgcmVzdWx0KS5maWx0ZXIoKGkpID0+IGkub3B0aW9ucy5zaG93SWZDb2xsYXBzZWQgfHwgIWkucmFuZ2UuaXNFbXB0eSgpKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBbGxJbmplY3RlZFRleHQoaG9zdDogSURlY29yYXRpb25zVHJlZXNIb3N0LCBmaWx0ZXJPd25lcklkOiBudW1iZXIpOiBtb2RlbC5JTW9kZWxEZWNvcmF0aW9uW10ge1xuXHRcdGNvbnN0IHZlcnNpb25JZCA9IGhvc3QuZ2V0VmVyc2lvbklkKCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5faW5qZWN0ZWRUZXh0RGVjb3JhdGlvbnNUcmVlLnNlYXJjaChmaWx0ZXJPd25lcklkLCBmYWxzZSwgdmVyc2lvbklkLCBmYWxzZSk7XG5cdFx0cmV0dXJuIHRoaXMuX2Vuc3VyZU5vZGVzSGF2ZVJhbmdlcyhob3N0LCByZXN1bHQpLmZpbHRlcigoaSkgPT4gaS5vcHRpb25zLnNob3dJZkNvbGxhcHNlZCB8fCAhaS5yYW5nZS5pc0VtcHR5KCkpO1xuXHR9XG5cblx0cHVibGljIGdldEFsbChob3N0OiBJRGVjb3JhdGlvbnNUcmVlc0hvc3QsIGZpbHRlck93bmVySWQ6IG51bWJlciwgZmlsdGVyT3V0VmFsaWRhdGlvbjogYm9vbGVhbiwgb3ZlcnZpZXdSdWxlck9ubHk6IGJvb2xlYW4sIG9ubHlNYXJnaW5EZWNvcmF0aW9uczogYm9vbGVhbik6IG1vZGVsLklNb2RlbERlY29yYXRpb25bXSB7XG5cdFx0Y29uc3QgdmVyc2lvbklkID0gaG9zdC5nZXRWZXJzaW9uSWQoKTtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9zZWFyY2goZmlsdGVyT3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgb3ZlcnZpZXdSdWxlck9ubHksIHZlcnNpb25JZCwgb25seU1hcmdpbkRlY29yYXRpb25zKTtcblx0XHRyZXR1cm4gdGhpcy5fZW5zdXJlTm9kZXNIYXZlUmFuZ2VzKGhvc3QsIHJlc3VsdCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZWFyY2goZmlsdGVyT3duZXJJZDogbnVtYmVyLCBmaWx0ZXJPdXRWYWxpZGF0aW9uOiBib29sZWFuLCBvdmVydmlld1J1bGVyT25seTogYm9vbGVhbiwgY2FjaGVkVmVyc2lvbklkOiBudW1iZXIsIG9ubHlNYXJnaW5EZWNvcmF0aW9uczogYm9vbGVhbik6IEludGVydmFsTm9kZVtdIHtcblx0XHRpZiAob3ZlcnZpZXdSdWxlck9ubHkpIHtcblx0XHRcdHJldHVybiB0aGlzLl9kZWNvcmF0aW9uc1RyZWUxLnNlYXJjaChmaWx0ZXJPd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uLCBjYWNoZWRWZXJzaW9uSWQsIG9ubHlNYXJnaW5EZWNvcmF0aW9ucyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHIwID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlMC5zZWFyY2goZmlsdGVyT3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgY2FjaGVkVmVyc2lvbklkLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnMpO1xuXHRcdFx0Y29uc3QgcjEgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUxLnNlYXJjaChmaWx0ZXJPd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uLCBjYWNoZWRWZXJzaW9uSWQsIG9ubHlNYXJnaW5EZWNvcmF0aW9ucyk7XG5cdFx0XHRjb25zdCByMiA9IHRoaXMuX2luamVjdGVkVGV4dERlY29yYXRpb25zVHJlZS5zZWFyY2goZmlsdGVyT3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgY2FjaGVkVmVyc2lvbklkLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnMpO1xuXHRcdFx0cmV0dXJuIHIwLmNvbmNhdChyMSkuY29uY2F0KHIyKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY29sbGVjdE5vZGVzRnJvbU93bmVyKG93bmVySWQ6IG51bWJlcik6IEludGVydmFsTm9kZVtdIHtcblx0XHRjb25zdCByMCA9IHRoaXMuX2RlY29yYXRpb25zVHJlZTAuY29sbGVjdE5vZGVzRnJvbU93bmVyKG93bmVySWQpO1xuXHRcdGNvbnN0IHIxID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlMS5jb2xsZWN0Tm9kZXNGcm9tT3duZXIob3duZXJJZCk7XG5cdFx0Y29uc3QgcjIgPSB0aGlzLl9pbmplY3RlZFRleHREZWNvcmF0aW9uc1RyZWUuY29sbGVjdE5vZGVzRnJvbU93bmVyKG93bmVySWQpO1xuXHRcdHJldHVybiByMC5jb25jYXQocjEpLmNvbmNhdChyMik7XG5cdH1cblxuXHRwdWJsaWMgY29sbGVjdE5vZGVzUG9zdE9yZGVyKCk6IEludGVydmFsTm9kZVtdIHtcblx0XHRjb25zdCByMCA9IHRoaXMuX2RlY29yYXRpb25zVHJlZTAuY29sbGVjdE5vZGVzUG9zdE9yZGVyKCk7XG5cdFx0Y29uc3QgcjEgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUxLmNvbGxlY3ROb2Rlc1Bvc3RPcmRlcigpO1xuXHRcdGNvbnN0IHIyID0gdGhpcy5faW5qZWN0ZWRUZXh0RGVjb3JhdGlvbnNUcmVlLmNvbGxlY3ROb2Rlc1Bvc3RPcmRlcigpO1xuXHRcdHJldHVybiByMC5jb25jYXQocjEpLmNvbmNhdChyMik7XG5cdH1cblxuXHRwdWJsaWMgaW5zZXJ0KG5vZGU6IEludGVydmFsTm9kZSk6IHZvaWQge1xuXHRcdGlmIChpc05vZGVJbmplY3RlZFRleHQobm9kZSkpIHtcblx0XHRcdHRoaXMuX2luamVjdGVkVGV4dERlY29yYXRpb25zVHJlZS5pbnNlcnQobm9kZSk7XG5cdFx0fSBlbHNlIGlmIChpc05vZGVJbk92ZXJ2aWV3UnVsZXIobm9kZSkpIHtcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZTEuaW5zZXJ0KG5vZGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUwLmluc2VydChub2RlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZGVsZXRlKG5vZGU6IEludGVydmFsTm9kZSk6IHZvaWQge1xuXHRcdGlmIChpc05vZGVJbmplY3RlZFRleHQobm9kZSkpIHtcblx0XHRcdHRoaXMuX2luamVjdGVkVGV4dERlY29yYXRpb25zVHJlZS5kZWxldGUobm9kZSk7XG5cdFx0fSBlbHNlIGlmIChpc05vZGVJbk92ZXJ2aWV3UnVsZXIobm9kZSkpIHtcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZTEuZGVsZXRlKG5vZGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUwLmRlbGV0ZShub2RlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0Tm9kZVJhbmdlKGhvc3Q6IElEZWNvcmF0aW9uc1RyZWVzSG9zdCwgbm9kZTogSW50ZXJ2YWxOb2RlKTogUmFuZ2Uge1xuXHRcdGNvbnN0IHZlcnNpb25JZCA9IGhvc3QuZ2V0VmVyc2lvbklkKCk7XG5cdFx0aWYgKG5vZGUuY2FjaGVkVmVyc2lvbklkICE9PSB2ZXJzaW9uSWQpIHtcblx0XHRcdHRoaXMuX3Jlc29sdmVOb2RlKG5vZGUsIHZlcnNpb25JZCk7XG5cdFx0fVxuXHRcdGlmIChub2RlLnJhbmdlID09PSBudWxsKSB7XG5cdFx0XHRub2RlLnJhbmdlID0gaG9zdC5nZXRSYW5nZUF0KG5vZGUuY2FjaGVkQWJzb2x1dGVTdGFydCwgbm9kZS5jYWNoZWRBYnNvbHV0ZUVuZCk7XG5cdFx0fVxuXHRcdHJldHVybiBub2RlLnJhbmdlO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzb2x2ZU5vZGUobm9kZTogSW50ZXJ2YWxOb2RlLCBjYWNoZWRWZXJzaW9uSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmIChpc05vZGVJbmplY3RlZFRleHQobm9kZSkpIHtcblx0XHRcdHRoaXMuX2luamVjdGVkVGV4dERlY29yYXRpb25zVHJlZS5yZXNvbHZlTm9kZShub2RlLCBjYWNoZWRWZXJzaW9uSWQpO1xuXHRcdH0gZWxzZSBpZiAoaXNOb2RlSW5PdmVydmlld1J1bGVyKG5vZGUpKSB7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUxLnJlc29sdmVOb2RlKG5vZGUsIGNhY2hlZFZlcnNpb25JZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZTAucmVzb2x2ZU5vZGUobm9kZSwgY2FjaGVkVmVyc2lvbklkKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYWNjZXB0UmVwbGFjZShvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHRleHRMZW5ndGg6IG51bWJlciwgZm9yY2VNb3ZlTWFya2VyczogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZTAuYWNjZXB0UmVwbGFjZShvZmZzZXQsIGxlbmd0aCwgdGV4dExlbmd0aCwgZm9yY2VNb3ZlTWFya2Vycyk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnNUcmVlMS5hY2NlcHRSZXBsYWNlKG9mZnNldCwgbGVuZ3RoLCB0ZXh0TGVuZ3RoLCBmb3JjZU1vdmVNYXJrZXJzKTtcblx0XHR0aGlzLl9pbmplY3RlZFRleHREZWNvcmF0aW9uc1RyZWUuYWNjZXB0UmVwbGFjZShvZmZzZXQsIGxlbmd0aCwgdGV4dExlbmd0aCwgZm9yY2VNb3ZlTWFya2Vycyk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY2xlYW5DbGFzc05hbWUoY2xhc3NOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gY2xhc3NOYW1lLnJlcGxhY2UoL1teYS16MC05XFwtX10vZ2ksICcgJyk7XG59XG5cbmNsYXNzIERlY29yYXRpb25PcHRpb25zIGltcGxlbWVudHMgbW9kZWwuSURlY29yYXRpb25PcHRpb25zIHtcblx0cmVhZG9ubHkgY29sb3I6IHN0cmluZyB8IFRoZW1lQ29sb3I7XG5cdHJlYWRvbmx5IGRhcmtDb2xvcjogc3RyaW5nIHwgVGhlbWVDb2xvcjtcblxuXHRjb25zdHJ1Y3RvcihvcHRpb25zOiBtb2RlbC5JRGVjb3JhdGlvbk9wdGlvbnMpIHtcblx0XHR0aGlzLmNvbG9yID0gb3B0aW9ucy5jb2xvciB8fCAnJztcblx0XHR0aGlzLmRhcmtDb2xvciA9IG9wdGlvbnMuZGFya0NvbG9yIHx8ICcnO1xuXG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGVsRGVjb3JhdGlvbk92ZXJ2aWV3UnVsZXJPcHRpb25zIGV4dGVuZHMgRGVjb3JhdGlvbk9wdGlvbnMge1xuXHRyZWFkb25seSBwb3NpdGlvbjogbW9kZWwuT3ZlcnZpZXdSdWxlckxhbmU7XG5cdHByaXZhdGUgX3Jlc29sdmVkQ29sb3I6IHN0cmluZyB8IG51bGw7XG5cblx0Y29uc3RydWN0b3Iob3B0aW9uczogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbk92ZXJ2aWV3UnVsZXJPcHRpb25zKSB7XG5cdFx0c3VwZXIob3B0aW9ucyk7XG5cdFx0dGhpcy5fcmVzb2x2ZWRDb2xvciA9IG51bGw7XG5cdFx0dGhpcy5wb3NpdGlvbiA9ICh0eXBlb2Ygb3B0aW9ucy5wb3NpdGlvbiA9PT0gJ251bWJlcicgPyBvcHRpb25zLnBvc2l0aW9uIDogbW9kZWwuT3ZlcnZpZXdSdWxlckxhbmUuQ2VudGVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb2xvcih0aGVtZTogSUNvbG9yVGhlbWUpOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5fcmVzb2x2ZWRDb2xvcikge1xuXHRcdFx0aWYgKHRoZW1lLnR5cGUgIT09ICdsaWdodCcgJiYgdGhpcy5kYXJrQ29sb3IpIHtcblx0XHRcdFx0dGhpcy5fcmVzb2x2ZWRDb2xvciA9IHRoaXMuX3Jlc29sdmVDb2xvcih0aGlzLmRhcmtDb2xvciwgdGhlbWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fcmVzb2x2ZWRDb2xvciA9IHRoaXMuX3Jlc29sdmVDb2xvcih0aGlzLmNvbG9yLCB0aGVtZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yZXNvbHZlZENvbG9yO1xuXHR9XG5cblx0cHVibGljIGludmFsaWRhdGVDYWNoZWRDb2xvcigpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXNvbHZlZENvbG9yID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc29sdmVDb2xvcihjb2xvcjogc3RyaW5nIHwgVGhlbWVDb2xvciwgdGhlbWU6IElDb2xvclRoZW1lKTogc3RyaW5nIHtcblx0XHRpZiAodHlwZW9mIGNvbG9yID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIGNvbG9yO1xuXHRcdH1cblx0XHRjb25zdCBjID0gY29sb3IgPyB0aGVtZS5nZXRDb2xvcihjb2xvci5pZCkgOiBudWxsO1xuXHRcdGlmICghYykge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gYy50b1N0cmluZygpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb2RlbERlY29yYXRpb25HbHlwaE1hcmdpbk9wdGlvbnMge1xuXHRyZWFkb25seSBwb3NpdGlvbjogbW9kZWwuR2x5cGhNYXJnaW5MYW5lO1xuXHRyZWFkb25seSBwZXJzaXN0TGFuZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihvcHRpb25zOiBtb2RlbC5JTW9kZWxEZWNvcmF0aW9uR2x5cGhNYXJnaW5PcHRpb25zIHwgbnVsbCB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMucG9zaXRpb24gPSBvcHRpb25zPy5wb3NpdGlvbiA/PyBtb2RlbC5HbHlwaE1hcmdpbkxhbmUuQ2VudGVyO1xuXHRcdHRoaXMucGVyc2lzdExhbmUgPSBvcHRpb25zPy5wZXJzaXN0TGFuZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTW9kZWxEZWNvcmF0aW9uTWluaW1hcE9wdGlvbnMgZXh0ZW5kcyBEZWNvcmF0aW9uT3B0aW9ucyB7XG5cdHJlYWRvbmx5IHBvc2l0aW9uOiBtb2RlbC5NaW5pbWFwUG9zaXRpb247XG5cdHJlYWRvbmx5IHNlY3Rpb25IZWFkZXJTdHlsZTogbW9kZWwuTWluaW1hcFNlY3Rpb25IZWFkZXJTdHlsZSB8IG51bGw7XG5cdHJlYWRvbmx5IHNlY3Rpb25IZWFkZXJUZXh0OiBzdHJpbmcgfCBudWxsO1xuXHRwcml2YXRlIF9yZXNvbHZlZENvbG9yOiBDb2xvciB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihvcHRpb25zOiBtb2RlbC5JTW9kZWxEZWNvcmF0aW9uTWluaW1hcE9wdGlvbnMpIHtcblx0XHRzdXBlcihvcHRpb25zKTtcblx0XHR0aGlzLnBvc2l0aW9uID0gb3B0aW9ucy5wb3NpdGlvbjtcblx0XHR0aGlzLnNlY3Rpb25IZWFkZXJTdHlsZSA9IG9wdGlvbnMuc2VjdGlvbkhlYWRlclN0eWxlID8/IG51bGw7XG5cdFx0dGhpcy5zZWN0aW9uSGVhZGVyVGV4dCA9IG9wdGlvbnMuc2VjdGlvbkhlYWRlclRleHQgPz8gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb2xvcih0aGVtZTogSUNvbG9yVGhlbWUpOiBDb2xvciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLl9yZXNvbHZlZENvbG9yKSB7XG5cdFx0XHRpZiAodGhlbWUudHlwZSAhPT0gJ2xpZ2h0JyAmJiB0aGlzLmRhcmtDb2xvcikge1xuXHRcdFx0XHR0aGlzLl9yZXNvbHZlZENvbG9yID0gdGhpcy5fcmVzb2x2ZUNvbG9yKHRoaXMuZGFya0NvbG9yLCB0aGVtZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9yZXNvbHZlZENvbG9yID0gdGhpcy5fcmVzb2x2ZUNvbG9yKHRoaXMuY29sb3IsIHRoZW1lKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcmVzb2x2ZWRDb2xvcjtcblx0fVxuXG5cdHB1YmxpYyBpbnZhbGlkYXRlQ2FjaGVkQ29sb3IoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVzb2x2ZWRDb2xvciA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc29sdmVDb2xvcihjb2xvcjogc3RyaW5nIHwgVGhlbWVDb2xvciwgdGhlbWU6IElDb2xvclRoZW1lKTogQ29sb3IgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0eXBlb2YgY29sb3IgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gQ29sb3IuZnJvbUhleChjb2xvcik7XG5cdFx0fVxuXHRcdHJldHVybiB0aGVtZS5nZXRDb2xvcihjb2xvci5pZCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGVsRGVjb3JhdGlvbkluamVjdGVkVGV4dE9wdGlvbnMgaW1wbGVtZW50cyBtb2RlbC5JbmplY3RlZFRleHRPcHRpb25zIHtcblx0cHVibGljIHN0YXRpYyBmcm9tKG9wdGlvbnM6IG1vZGVsLkluamVjdGVkVGV4dE9wdGlvbnMpOiBNb2RlbERlY29yYXRpb25JbmplY3RlZFRleHRPcHRpb25zIHtcblx0XHRpZiAob3B0aW9ucyBpbnN0YW5jZW9mIE1vZGVsRGVjb3JhdGlvbkluamVjdGVkVGV4dE9wdGlvbnMpIHtcblx0XHRcdHJldHVybiBvcHRpb25zO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IE1vZGVsRGVjb3JhdGlvbkluamVjdGVkVGV4dE9wdGlvbnMob3B0aW9ucyk7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgY29udGVudDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgdG9rZW5zOiBUb2tlbkFycmF5IHwgbnVsbDtcblx0cmVhZG9ubHkgaW5saW5lQ2xhc3NOYW1lOiBzdHJpbmcgfCBudWxsO1xuXHRyZWFkb25seSBpbmxpbmVDbGFzc05hbWVBZmZlY3RzTGV0dGVyU3BhY2luZzogYm9vbGVhbjtcblx0cmVhZG9ubHkgYXR0YWNoZWREYXRhOiB1bmtub3duIHwgbnVsbDtcblx0cmVhZG9ubHkgY3Vyc29yU3RvcHM6IG1vZGVsLkluamVjdGVkVGV4dEN1cnNvclN0b3BzIHwgbnVsbDtcblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKG9wdGlvbnM6IG1vZGVsLkluamVjdGVkVGV4dE9wdGlvbnMpIHtcblx0XHR0aGlzLmNvbnRlbnQgPSBvcHRpb25zLmNvbnRlbnQgfHwgJyc7XG5cdFx0dGhpcy50b2tlbnMgPSBvcHRpb25zLnRva2VucyA/PyBudWxsO1xuXHRcdHRoaXMuaW5saW5lQ2xhc3NOYW1lID0gb3B0aW9ucy5pbmxpbmVDbGFzc05hbWUgfHwgbnVsbDtcblx0XHR0aGlzLmlubGluZUNsYXNzTmFtZUFmZmVjdHNMZXR0ZXJTcGFjaW5nID0gb3B0aW9ucy5pbmxpbmVDbGFzc05hbWVBZmZlY3RzTGV0dGVyU3BhY2luZyB8fCBmYWxzZTtcblx0XHR0aGlzLmF0dGFjaGVkRGF0YSA9IG9wdGlvbnMuYXR0YWNoZWREYXRhIHx8IG51bGw7XG5cdFx0dGhpcy5jdXJzb3JTdG9wcyA9IG9wdGlvbnMuY3Vyc29yU3RvcHMgfHwgbnVsbDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyBpbXBsZW1lbnRzIG1vZGVsLklNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblxuXHRwdWJsaWMgc3RhdGljIEVNUFRZOiBNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVnaXN0ZXIob3B0aW9uczogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpOiBNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0XHRyZXR1cm4gbmV3IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMob3B0aW9ucyk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZUR5bmFtaWMob3B0aW9uczogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpOiBNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0XHRyZXR1cm4gbmV3IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMob3B0aW9ucyk7XG5cdH1cblx0cmVhZG9ubHkgZGVzY3JpcHRpb246IHN0cmluZztcblx0cmVhZG9ubHkgYmxvY2tDbGFzc05hbWU6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IGJsb2NrSXNBZnRlckVuZDogYm9vbGVhbiB8IG51bGw7XG5cdHJlYWRvbmx5IGJsb2NrRG9lc05vdENvbGxhcHNlPzogYm9vbGVhbiB8IG51bGw7XG5cdHJlYWRvbmx5IGJsb2NrUGFkZGluZzogW3RvcDogbnVtYmVyLCByaWdodDogbnVtYmVyLCBib3R0b206IG51bWJlciwgbGVmdDogbnVtYmVyXSB8IG51bGw7XG5cdHJlYWRvbmx5IHN0aWNraW5lc3M6IG1vZGVsLlRyYWNrZWRSYW5nZVN0aWNraW5lc3M7XG5cdHJlYWRvbmx5IHpJbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBjbGFzc05hbWU6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IHNob3VsZEZpbGxMaW5lT25MaW5lQnJlYWs6IGJvb2xlYW4gfCBudWxsO1xuXHRyZWFkb25seSBob3Zlck1lc3NhZ2U6IElNYXJrZG93blN0cmluZyB8IElNYXJrZG93blN0cmluZ1tdIHwgbnVsbDtcblx0cmVhZG9ubHkgZ2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2U6IElNYXJrZG93blN0cmluZyB8IElNYXJrZG93blN0cmluZ1tdIHwgbnVsbDtcblx0cmVhZG9ubHkgaXNXaG9sZUxpbmU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNob3dJZkNvbGxhcHNlZDogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29sbGFwc2VPblJlcGxhY2VFZGl0OiBib29sZWFuO1xuXHRyZWFkb25seSBvdmVydmlld1J1bGVyOiBNb2RlbERlY29yYXRpb25PdmVydmlld1J1bGVyT3B0aW9ucyB8IG51bGw7XG5cdHJlYWRvbmx5IG1pbmltYXA6IE1vZGVsRGVjb3JhdGlvbk1pbmltYXBPcHRpb25zIHwgbnVsbDtcblx0cmVhZG9ubHkgZ2x5cGhNYXJnaW4/OiBtb2RlbC5JTW9kZWxEZWNvcmF0aW9uR2x5cGhNYXJnaW5PcHRpb25zIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZ2x5cGhNYXJnaW5DbGFzc05hbWU6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IGxpbmVzRGVjb3JhdGlvbnNDbGFzc05hbWU6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IGxpbmVOdW1iZXJDbGFzc05hbWU6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IGxpbmVOdW1iZXJIb3Zlck1lc3NhZ2U6IElNYXJrZG93blN0cmluZyB8IElNYXJrZG93blN0cmluZ1tdIHwgbnVsbDtcblx0cmVhZG9ubHkgbGluZXNEZWNvcmF0aW9uc1Rvb2x0aXA6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IGZpcnN0TGluZURlY29yYXRpb25DbGFzc05hbWU6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IG1hcmdpbkNsYXNzTmFtZTogc3RyaW5nIHwgbnVsbDtcblx0cmVhZG9ubHkgaW5saW5lQ2xhc3NOYW1lOiBzdHJpbmcgfCBudWxsO1xuXHRyZWFkb25seSBpbmxpbmVDbGFzc05hbWVBZmZlY3RzTGV0dGVyU3BhY2luZzogYm9vbGVhbjtcblx0cmVhZG9ubHkgYmVmb3JlQ29udGVudENsYXNzTmFtZTogc3RyaW5nIHwgbnVsbDtcblx0cmVhZG9ubHkgYWZ0ZXJDb250ZW50Q2xhc3NOYW1lOiBzdHJpbmcgfCBudWxsO1xuXHRyZWFkb25seSBhZnRlcjogTW9kZWxEZWNvcmF0aW9uSW5qZWN0ZWRUZXh0T3B0aW9ucyB8IG51bGw7XG5cdHJlYWRvbmx5IGJlZm9yZTogTW9kZWxEZWNvcmF0aW9uSW5qZWN0ZWRUZXh0T3B0aW9ucyB8IG51bGw7XG5cdHJlYWRvbmx5IGhpZGVJbkNvbW1lbnRUb2tlbnM6IGJvb2xlYW4gfCBudWxsO1xuXHRyZWFkb25seSBoaWRlSW5TdHJpbmdUb2tlbnM6IGJvb2xlYW4gfCBudWxsO1xuXG5cdHByaXZhdGUgY29uc3RydWN0b3Iob3B0aW9uczogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpIHtcblx0XHR0aGlzLmRlc2NyaXB0aW9uID0gb3B0aW9ucy5kZXNjcmlwdGlvbjtcblx0XHR0aGlzLmJsb2NrQ2xhc3NOYW1lID0gb3B0aW9ucy5ibG9ja0NsYXNzTmFtZSA/IGNsZWFuQ2xhc3NOYW1lKG9wdGlvbnMuYmxvY2tDbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmJsb2NrRG9lc05vdENvbGxhcHNlID0gb3B0aW9ucy5ibG9ja0RvZXNOb3RDb2xsYXBzZSA/PyBudWxsO1xuXHRcdHRoaXMuYmxvY2tJc0FmdGVyRW5kID0gb3B0aW9ucy5ibG9ja0lzQWZ0ZXJFbmQgPz8gbnVsbDtcblx0XHR0aGlzLmJsb2NrUGFkZGluZyA9IG9wdGlvbnMuYmxvY2tQYWRkaW5nID8/IG51bGw7XG5cdFx0dGhpcy5zdGlja2luZXNzID0gb3B0aW9ucy5zdGlja2luZXNzIHx8IG1vZGVsLlRyYWNrZWRSYW5nZVN0aWNraW5lc3MuQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcztcblx0XHR0aGlzLnpJbmRleCA9IG9wdGlvbnMuekluZGV4IHx8IDA7XG5cdFx0dGhpcy5jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSA/IGNsZWFuQ2xhc3NOYW1lKG9wdGlvbnMuY2xhc3NOYW1lKSA6IG51bGw7XG5cdFx0dGhpcy5zaG91bGRGaWxsTGluZU9uTGluZUJyZWFrID0gb3B0aW9ucy5zaG91bGRGaWxsTGluZU9uTGluZUJyZWFrID8/IG51bGw7XG5cdFx0dGhpcy5ob3Zlck1lc3NhZ2UgPSBvcHRpb25zLmhvdmVyTWVzc2FnZSB8fCBudWxsO1xuXHRcdHRoaXMuZ2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2UgPSBvcHRpb25zLmdseXBoTWFyZ2luSG92ZXJNZXNzYWdlIHx8IG51bGw7XG5cdFx0dGhpcy5saW5lTnVtYmVySG92ZXJNZXNzYWdlID0gb3B0aW9ucy5saW5lTnVtYmVySG92ZXJNZXNzYWdlIHx8IG51bGw7XG5cdFx0dGhpcy5pc1dob2xlTGluZSA9IG9wdGlvbnMuaXNXaG9sZUxpbmUgfHwgZmFsc2U7XG5cdFx0dGhpcy5zaG93SWZDb2xsYXBzZWQgPSBvcHRpb25zLnNob3dJZkNvbGxhcHNlZCB8fCBmYWxzZTtcblx0XHR0aGlzLmNvbGxhcHNlT25SZXBsYWNlRWRpdCA9IG9wdGlvbnMuY29sbGFwc2VPblJlcGxhY2VFZGl0IHx8IGZhbHNlO1xuXHRcdHRoaXMub3ZlcnZpZXdSdWxlciA9IG9wdGlvbnMub3ZlcnZpZXdSdWxlciA/IG5ldyBNb2RlbERlY29yYXRpb25PdmVydmlld1J1bGVyT3B0aW9ucyhvcHRpb25zLm92ZXJ2aWV3UnVsZXIpIDogbnVsbDtcblx0XHR0aGlzLm1pbmltYXAgPSBvcHRpb25zLm1pbmltYXAgPyBuZXcgTW9kZWxEZWNvcmF0aW9uTWluaW1hcE9wdGlvbnMob3B0aW9ucy5taW5pbWFwKSA6IG51bGw7XG5cdFx0dGhpcy5nbHlwaE1hcmdpbiA9IG9wdGlvbnMuZ2x5cGhNYXJnaW5DbGFzc05hbWUgPyBuZXcgTW9kZWxEZWNvcmF0aW9uR2x5cGhNYXJnaW5PcHRpb25zKG9wdGlvbnMuZ2x5cGhNYXJnaW4pIDogbnVsbDtcblx0XHR0aGlzLmdseXBoTWFyZ2luQ2xhc3NOYW1lID0gb3B0aW9ucy5nbHlwaE1hcmdpbkNsYXNzTmFtZSA/IGNsZWFuQ2xhc3NOYW1lKG9wdGlvbnMuZ2x5cGhNYXJnaW5DbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmxpbmVzRGVjb3JhdGlvbnNDbGFzc05hbWUgPSBvcHRpb25zLmxpbmVzRGVjb3JhdGlvbnNDbGFzc05hbWUgPyBjbGVhbkNsYXNzTmFtZShvcHRpb25zLmxpbmVzRGVjb3JhdGlvbnNDbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmxpbmVOdW1iZXJDbGFzc05hbWUgPSBvcHRpb25zLmxpbmVOdW1iZXJDbGFzc05hbWUgPyBjbGVhbkNsYXNzTmFtZShvcHRpb25zLmxpbmVOdW1iZXJDbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmxpbmVzRGVjb3JhdGlvbnNUb29sdGlwID0gb3B0aW9ucy5saW5lc0RlY29yYXRpb25zVG9vbHRpcCA/IHN0cmluZ3MuaHRtbEF0dHJpYnV0ZUVuY29kZVZhbHVlKG9wdGlvbnMubGluZXNEZWNvcmF0aW9uc1Rvb2x0aXApIDogbnVsbDtcblx0XHR0aGlzLmZpcnN0TGluZURlY29yYXRpb25DbGFzc05hbWUgPSBvcHRpb25zLmZpcnN0TGluZURlY29yYXRpb25DbGFzc05hbWUgPyBjbGVhbkNsYXNzTmFtZShvcHRpb25zLmZpcnN0TGluZURlY29yYXRpb25DbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLm1hcmdpbkNsYXNzTmFtZSA9IG9wdGlvbnMubWFyZ2luQ2xhc3NOYW1lID8gY2xlYW5DbGFzc05hbWUob3B0aW9ucy5tYXJnaW5DbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmlubGluZUNsYXNzTmFtZSA9IG9wdGlvbnMuaW5saW5lQ2xhc3NOYW1lID8gY2xlYW5DbGFzc05hbWUob3B0aW9ucy5pbmxpbmVDbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmlubGluZUNsYXNzTmFtZUFmZmVjdHNMZXR0ZXJTcGFjaW5nID0gb3B0aW9ucy5pbmxpbmVDbGFzc05hbWVBZmZlY3RzTGV0dGVyU3BhY2luZyB8fCBmYWxzZTtcblx0XHR0aGlzLmJlZm9yZUNvbnRlbnRDbGFzc05hbWUgPSBvcHRpb25zLmJlZm9yZUNvbnRlbnRDbGFzc05hbWUgPyBjbGVhbkNsYXNzTmFtZShvcHRpb25zLmJlZm9yZUNvbnRlbnRDbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmFmdGVyQ29udGVudENsYXNzTmFtZSA9IG9wdGlvbnMuYWZ0ZXJDb250ZW50Q2xhc3NOYW1lID8gY2xlYW5DbGFzc05hbWUob3B0aW9ucy5hZnRlckNvbnRlbnRDbGFzc05hbWUpIDogbnVsbDtcblx0XHR0aGlzLmFmdGVyID0gb3B0aW9ucy5hZnRlciA/IE1vZGVsRGVjb3JhdGlvbkluamVjdGVkVGV4dE9wdGlvbnMuZnJvbShvcHRpb25zLmFmdGVyKSA6IG51bGw7XG5cdFx0dGhpcy5iZWZvcmUgPSBvcHRpb25zLmJlZm9yZSA/IE1vZGVsRGVjb3JhdGlvbkluamVjdGVkVGV4dE9wdGlvbnMuZnJvbShvcHRpb25zLmJlZm9yZSkgOiBudWxsO1xuXHRcdHRoaXMuaGlkZUluQ29tbWVudFRva2VucyA9IG9wdGlvbnMuaGlkZUluQ29tbWVudFRva2VucyA/PyBmYWxzZTtcblx0XHR0aGlzLmhpZGVJblN0cmluZ1Rva2VucyA9IG9wdGlvbnMuaGlkZUluU3RyaW5nVG9rZW5zID8/IGZhbHNlO1xuXHR9XG59XG5Nb2RlbERlY29yYXRpb25PcHRpb25zLkVNUFRZID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7IGRlc2NyaXB0aW9uOiAnZW1wdHknIH0pO1xuXG4vKipcbiAqIFRoZSBvcmRlciBjYXJlZnVsbHkgbWF0Y2hlcyB0aGUgdmFsdWVzIG9mIHRoZSBlbnVtLlxuICovXG5jb25zdCBUUkFDS0VEX1JBTkdFX09QVElPTlMgPSBbXG5cdE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoeyBkZXNjcmlwdGlvbjogJ3RyYWNrZWQtcmFuZ2UtYWx3YXlzLWdyb3dzLXdoZW4tdHlwaW5nLWF0LWVkZ2VzJywgc3RpY2tpbmVzczogbW9kZWwuVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzIH0pLFxuXHRNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHsgZGVzY3JpcHRpb246ICd0cmFja2VkLXJhbmdlLW5ldmVyLWdyb3dzLXdoZW4tdHlwaW5nLWF0LWVkZ2VzJywgc3RpY2tpbmVzczogbW9kZWwuVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMgfSksXG5cdE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoeyBkZXNjcmlwdGlvbjogJ3RyYWNrZWQtcmFuZ2UtZ3Jvd3Mtb25seS13aGVuLXR5cGluZy1iZWZvcmUnLCBzdGlja2luZXNzOiBtb2RlbC5UcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdCZWZvcmUgfSksXG5cdE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoeyBkZXNjcmlwdGlvbjogJ3RyYWNrZWQtcmFuZ2UtZ3Jvd3Mtb25seS13aGVuLXR5cGluZy1hZnRlcicsIHN0aWNraW5lc3M6IG1vZGVsLlRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyIH0pLFxuXTtcblxuZnVuY3Rpb24gX25vcm1hbGl6ZU9wdGlvbnMob3B0aW9uczogbW9kZWwuSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpOiBNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0aWYgKG9wdGlvbnMgaW5zdGFuY2VvZiBNb2RlbERlY29yYXRpb25PcHRpb25zKSB7XG5cdFx0cmV0dXJuIG9wdGlvbnM7XG5cdH1cblx0cmV0dXJuIE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMuY3JlYXRlRHluYW1pYyhvcHRpb25zKTtcbn1cblxuY2xhc3MgRGlkQ2hhbmdlRGVjb3JhdGlvbnNFbWl0dGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWN0dWFsOiBFbWl0dGVyPElNb2RlbERlY29yYXRpb25zQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElNb2RlbERlY29yYXRpb25zQ2hhbmdlZEV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IGV2ZW50OiBFdmVudDxJTW9kZWxEZWNvcmF0aW9uc0NoYW5nZWRFdmVudD4gPSB0aGlzLl9hY3R1YWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfZGVmZXJyZWRDbnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfc2hvdWxkRmlyZURlZmVycmVkOiBib29sZWFuO1xuXHRwcml2YXRlIF9hZmZlY3RzTWluaW1hcDogYm9vbGVhbjtcblx0cHJpdmF0ZSBfYWZmZWN0c092ZXJ2aWV3UnVsZXI6IGJvb2xlYW47XG5cdHByaXZhdGUgX2FmZmVjdGVkSW5qZWN0ZWRUZXh0TGluZXM6IFNldDxudW1iZXI+IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2FmZmVjdHNHbHlwaE1hcmdpbjogYm9vbGVhbjtcblx0cHJpdmF0ZSBfYWZmZWN0c0xpbmVOdW1iZXI6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBoYW5kbGVCZWZvcmVGaXJlOiAoYWZmZWN0ZWRJbmplY3RlZFRleHRMaW5lczogU2V0PG51bWJlcj4gfCBudWxsKSA9PiB2b2lkKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9kZWZlcnJlZENudCA9IDA7XG5cdFx0dGhpcy5fc2hvdWxkRmlyZURlZmVycmVkID0gZmFsc2U7XG5cdFx0dGhpcy5fYWZmZWN0c01pbmltYXAgPSBmYWxzZTtcblx0XHR0aGlzLl9hZmZlY3RzT3ZlcnZpZXdSdWxlciA9IGZhbHNlO1xuXHRcdHRoaXMuX2FmZmVjdHNHbHlwaE1hcmdpbiA9IGZhbHNlO1xuXHRcdHRoaXMuX2FmZmVjdHNMaW5lTnVtYmVyID0gZmFsc2U7XG5cdH1cblxuXHRoYXNMaXN0ZW5lcnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbC5oYXNMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHB1YmxpYyBiZWdpbkRlZmVycmVkRW1pdCgpOiB2b2lkIHtcblx0XHR0aGlzLl9kZWZlcnJlZENudCsrO1xuXHR9XG5cblx0cHVibGljIGVuZERlZmVycmVkRW1pdCgpOiB2b2lkIHtcblx0XHR0aGlzLl9kZWZlcnJlZENudC0tO1xuXHRcdGlmICh0aGlzLl9kZWZlcnJlZENudCA9PT0gMCkge1xuXHRcdFx0aWYgKHRoaXMuX3Nob3VsZEZpcmVEZWZlcnJlZCkge1xuXHRcdFx0XHR0aGlzLmRvRmlyZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9hZmZlY3RlZEluamVjdGVkVGV4dExpbmVzPy5jbGVhcigpO1xuXHRcdFx0dGhpcy5fYWZmZWN0ZWRJbmplY3RlZFRleHRMaW5lcyA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlY29yZExpbmVBZmZlY3RlZEJ5SW5qZWN0ZWRUZXh0KGxpbmVOdW1iZXI6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fYWZmZWN0ZWRJbmplY3RlZFRleHRMaW5lcykge1xuXHRcdFx0dGhpcy5fYWZmZWN0ZWRJbmplY3RlZFRleHRMaW5lcyA9IG5ldyBTZXQoKTtcblx0XHR9XG5cdFx0dGhpcy5fYWZmZWN0ZWRJbmplY3RlZFRleHRMaW5lcy5hZGQobGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgY2hlY2tBZmZlY3RlZEFuZEZpcmUob3B0aW9uczogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuX2FmZmVjdHNNaW5pbWFwIHx8PSAhIW9wdGlvbnMubWluaW1hcD8ucG9zaXRpb247XG5cdFx0dGhpcy5fYWZmZWN0c092ZXJ2aWV3UnVsZXIgfHw9ICEhb3B0aW9ucy5vdmVydmlld1J1bGVyPy5jb2xvcjtcblx0XHR0aGlzLl9hZmZlY3RzR2x5cGhNYXJnaW4gfHw9ICEhb3B0aW9ucy5nbHlwaE1hcmdpbkNsYXNzTmFtZTtcblx0XHR0aGlzLl9hZmZlY3RzTGluZU51bWJlciB8fD0gISFvcHRpb25zLmxpbmVOdW1iZXJDbGFzc05hbWU7XG5cdFx0dGhpcy50cnlGaXJlKCk7XG5cdH1cblxuXHRwdWJsaWMgZmlyZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9hZmZlY3RzTWluaW1hcCA9IHRydWU7XG5cdFx0dGhpcy5fYWZmZWN0c092ZXJ2aWV3UnVsZXIgPSB0cnVlO1xuXHRcdHRoaXMuX2FmZmVjdHNHbHlwaE1hcmdpbiA9IHRydWU7XG5cdFx0dGhpcy50cnlGaXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIHRyeUZpcmUoKSB7XG5cdFx0aWYgKHRoaXMuX2RlZmVycmVkQ250ID09PSAwKSB7XG5cdFx0XHR0aGlzLmRvRmlyZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zaG91bGRGaXJlRGVmZXJyZWQgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9GaXJlKCkge1xuXHRcdHRoaXMuaGFuZGxlQmVmb3JlRmlyZSh0aGlzLl9hZmZlY3RlZEluamVjdGVkVGV4dExpbmVzKTtcblxuXHRcdGNvbnN0IGV2ZW50OiBJTW9kZWxEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCA9IHtcblx0XHRcdGFmZmVjdHNNaW5pbWFwOiB0aGlzLl9hZmZlY3RzTWluaW1hcCxcblx0XHRcdGFmZmVjdHNPdmVydmlld1J1bGVyOiB0aGlzLl9hZmZlY3RzT3ZlcnZpZXdSdWxlcixcblx0XHRcdGFmZmVjdHNHbHlwaE1hcmdpbjogdGhpcy5fYWZmZWN0c0dseXBoTWFyZ2luLFxuXHRcdFx0YWZmZWN0c0xpbmVOdW1iZXI6IHRoaXMuX2FmZmVjdHNMaW5lTnVtYmVyLFxuXHRcdH07XG5cdFx0dGhpcy5fc2hvdWxkRmlyZURlZmVycmVkID0gZmFsc2U7XG5cdFx0dGhpcy5fYWZmZWN0c01pbmltYXAgPSBmYWxzZTtcblx0XHR0aGlzLl9hZmZlY3RzT3ZlcnZpZXdSdWxlciA9IGZhbHNlO1xuXHRcdHRoaXMuX2FmZmVjdHNHbHlwaE1hcmdpbiA9IGZhbHNlO1xuXHRcdHRoaXMuX2FjdHVhbC5maXJlKGV2ZW50KTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuY2xhc3MgRGlkQ2hhbmdlQ29udGVudEVtaXR0ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHQvKipcblx0ICogQm90aCBgZmFzdEV2ZW50YCBhbmQgYHNsb3dFdmVudGAgd29yayB0aGUgc2FtZSB3YXkgYW5kIGNvbnRhaW4gdGhlIHNhbWUgZXZlbnRzLCBidXQgZmlyc3Qgd2UgaW52b2tlIGBmYXN0RXZlbnRgIGFuZCB0aGVuIGBzbG93RXZlbnRgLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfZmFzdEVtaXR0ZXI6IEVtaXR0ZXI8SW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJbnRlcm5hbE1vZGVsQ29udGVudENoYW5nZUV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IGZhc3RFdmVudDogRXZlbnQ8SW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudD4gPSB0aGlzLl9mYXN0RW1pdHRlci5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfc2xvd0VtaXR0ZXI6IEVtaXR0ZXI8SW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJbnRlcm5hbE1vZGVsQ29udGVudENoYW5nZUV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IHNsb3dFdmVudDogRXZlbnQ8SW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudD4gPSB0aGlzLl9zbG93RW1pdHRlci5ldmVudDtcblxuXHRwcml2YXRlIF9kZWZlcnJlZENudDogbnVtYmVyO1xuXHRwcml2YXRlIF9kZWZlcnJlZEV2ZW50OiBJbnRlcm5hbE1vZGVsQ29udGVudENoYW5nZUV2ZW50IHwgbnVsbDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2RlZmVycmVkQ250ID0gMDtcblx0XHR0aGlzLl9kZWZlcnJlZEV2ZW50ID0gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBoYXNMaXN0ZW5lcnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHRoaXMuX2Zhc3RFbWl0dGVyLmhhc0xpc3RlbmVycygpXG5cdFx0XHR8fCB0aGlzLl9zbG93RW1pdHRlci5oYXNMaXN0ZW5lcnMoKVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgYmVnaW5EZWZlcnJlZEVtaXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGVmZXJyZWRDbnQrKztcblx0fVxuXG5cdHB1YmxpYyBlbmREZWZlcnJlZEVtaXQocmVzdWx0aW5nU2VsZWN0aW9uOiBTZWxlY3Rpb25bXSB8IG51bGwgPSBudWxsKTogdm9pZCB7XG5cdFx0dGhpcy5fZGVmZXJyZWRDbnQtLTtcblx0XHRpZiAodGhpcy5fZGVmZXJyZWRDbnQgPT09IDApIHtcblx0XHRcdGlmICh0aGlzLl9kZWZlcnJlZEV2ZW50ICE9PSBudWxsKSB7XG5cdFx0XHRcdHRoaXMuX2RlZmVycmVkRXZlbnQucmF3Q29udGVudENoYW5nZWRFdmVudC5yZXN1bHRpbmdTZWxlY3Rpb24gPSByZXN1bHRpbmdTZWxlY3Rpb247XG5cdFx0XHRcdGNvbnN0IGUgPSB0aGlzLl9kZWZlcnJlZEV2ZW50O1xuXHRcdFx0XHR0aGlzLl9kZWZlcnJlZEV2ZW50ID0gbnVsbDtcblx0XHRcdFx0dGhpcy5fZmFzdEVtaXR0ZXIuZmlyZShlKTtcblx0XHRcdFx0dGhpcy5fc2xvd0VtaXR0ZXIuZmlyZShlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZmlyZShlOiBJbnRlcm5hbE1vZGVsQ29udGVudENoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2RlZmVycmVkQ250ID4gMCkge1xuXHRcdFx0aWYgKHRoaXMuX2RlZmVycmVkRXZlbnQpIHtcblx0XHRcdFx0dGhpcy5fZGVmZXJyZWRFdmVudCA9IHRoaXMuX2RlZmVycmVkRXZlbnQubWVyZ2UoZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9kZWZlcnJlZEV2ZW50ID0gZTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fZmFzdEVtaXR0ZXIuZmlyZShlKTtcblx0XHR0aGlzLl9zbG93RW1pdHRlci5maXJlKGUpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsWUFBWSxnQkFBZ0I7QUFFckMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsb0JBQW9CLGlCQUFpQix5QkFBeUI7QUFDdkUsU0FBUyxlQUFzQjtBQUUvQixTQUFTLFlBQXlCLG1CQUFtQiwwQkFBMEI7QUFDL0UsU0FBUyxvQkFBb0I7QUFDN0IsWUFBWSxhQUFhO0FBRXpCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVztBQUVwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFvQixnQkFBZ0I7QUFDcEMsU0FBaUIsYUFBYTtBQUM5QixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLDZCQUE2QjtBQUd0QyxTQUE2Qix3QkFBd0I7QUFDckQsU0FBUyxxQ0FBcUM7QUFDOUMsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsY0FBYyxjQUFjLHVCQUF1QjtBQUM1RCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGNBQWMsdUJBQXVCO0FBQzlDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMscUJBQXFCO0FBRTlCLFNBQThGLGlDQUFpQyxrQkFBa0IsK0JBQStDLDZCQUE2QixvQkFB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
