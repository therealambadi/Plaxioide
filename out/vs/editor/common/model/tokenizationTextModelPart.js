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
import { CharCode } from "../../../base/common/charCode.js";
import { BugIndicatingError, onUnexpectedError } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { DisposableMap, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { countEOL } from "../core/eolCounter.js";
import { LineRange } from "../core/lineRange.js";
import { Position } from "../core/position.js";
import { getWordAtText } from "../core/wordHelper.js";
import { StandardTokenType } from "../encodedTokenAttributes.js";
import { TokenizationRegistry, TreeSitterTokenizationRegistry } from "../languages.js";
import { ILanguageService } from "../languages/language.js";
import { ILanguageConfigurationService } from "../languages/languageConfigurationRegistry.js";
import { TextModelPart } from "./textModelPart.js";
import { DefaultBackgroundTokenizer, TokenizerWithStateStoreAndTextModel, TrackingTokenizationStateStore } from "./textModelTokens.js";
import { AbstractTokens, AttachedViewHandler } from "./tokens.js";
import { TreeSitterTokens } from "./treeSitterTokens.js";
import { BackgroundTokenizationState } from "../tokenizationTextModelPart.js";
import { ContiguousMultilineTokensBuilder } from "../tokens/contiguousMultilineTokensBuilder.js";
import { ContiguousTokensStore } from "../tokens/contiguousTokensStore.js";
import { SparseTokensStore } from "../tokens/sparseTokensStore.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
let TokenizationTextModelPart = class extends TextModelPart {
  constructor(_textModel, _bracketPairsTextModelPart, _languageId, _attachedViews, _languageService, _languageConfigurationService, _instantiationService) {
    super();
    this._textModel = _textModel;
    this._bracketPairsTextModelPart = _bracketPairsTextModelPart;
    this._languageId = _languageId;
    this._attachedViews = _attachedViews;
    this._languageService = _languageService;
    this._languageConfigurationService = _languageConfigurationService;
    this._instantiationService = _instantiationService;
    this._semanticTokens = new SparseTokensStore(this._languageService.languageIdCodec);
    this._onDidChangeLanguage = this._register(new Emitter());
    this.onDidChangeLanguage = this._onDidChangeLanguage.event;
    this._onDidChangeLanguageConfiguration = this._register(new Emitter());
    this.onDidChangeLanguageConfiguration = this._onDidChangeLanguageConfiguration.event;
    this._onDidChangeTokens = this._register(new Emitter());
    this.onDidChangeTokens = this._onDidChangeTokens.event;
    this._tokensDisposables = this._register(new DisposableStore());
    this._register(Event.filter(TreeSitterTokenizationRegistry.onDidChange, (e) => e.changedLanguages.includes(this._languageId))(() => {
      this.createPreferredTokenProvider();
    }));
    this.createPreferredTokenProvider();
  }
  createGrammarTokens() {
    return this._register(new GrammarTokens(this._languageService.languageIdCodec, this._textModel, () => this._languageId, this._attachedViews));
  }
  createTreeSitterTokens() {
    return this._register(this._instantiationService.createInstance(TreeSitterTokens, this._languageService.languageIdCodec, this._textModel, () => this._languageId));
  }
  createTokens(useTreeSitter) {
    const needsReset = this._tokens !== void 0;
    this._tokens?.dispose();
    this._tokens = useTreeSitter ? this.createTreeSitterTokens() : this.createGrammarTokens();
    this._tokensDisposables.clear();
    this._tokensDisposables.add(this._tokens.onDidChangeTokens((e) => {
      this._emitModelTokensChangedEvent(e);
    }));
    this._tokensDisposables.add(this._tokens.onDidChangeBackgroundTokenizationState((e) => {
      this._bracketPairsTextModelPart.handleDidChangeBackgroundTokenizationState();
    }));
    if (needsReset) {
      this._tokens.resetTokenization();
    }
  }
  createPreferredTokenProvider() {
    if (TreeSitterTokenizationRegistry.get(this._languageId)) {
      if (!(this._tokens instanceof TreeSitterTokens)) {
        this.createTokens(true);
      }
    } else {
      if (!(this._tokens instanceof GrammarTokens)) {
        this.createTokens(false);
      }
    }
  }
  _hasListeners() {
    return this._onDidChangeLanguage.hasListeners() || this._onDidChangeLanguageConfiguration.hasListeners() || this._onDidChangeTokens.hasListeners();
  }
  handleLanguageConfigurationServiceChange(e) {
    if (e.affects(this._languageId)) {
      this._onDidChangeLanguageConfiguration.fire({});
    }
  }
  handleDidChangeContent(e) {
    if (e.isFlush) {
      this._semanticTokens.flush();
    } else if (!e.isEolChange) {
      for (const c of e.changes) {
        const [eolCount, firstLineLength, lastLineLength] = countEOL(c.text);
        this._semanticTokens.acceptEdit(
          c.range,
          eolCount,
          firstLineLength,
          lastLineLength,
          c.text.length > 0 ? c.text.charCodeAt(0) : CharCode.Null
        );
      }
    }
    this._tokens.handleDidChangeContent(e);
  }
  handleDidChangeAttached() {
    this._tokens.handleDidChangeAttached();
  }
  /**
   * Includes grammar and semantic tokens.
   */
  getLineTokens(lineNumber) {
    this.validateLineNumber(lineNumber);
    const syntacticTokens = this._tokens.getLineTokens(lineNumber);
    return this._semanticTokens.addSparseTokens(lineNumber, syntacticTokens);
  }
  _emitModelTokensChangedEvent(e) {
    if (!this._textModel._isDisposing()) {
      this._bracketPairsTextModelPart.handleDidChangeTokens(e);
      this._onDidChangeTokens.fire(e);
    }
  }
  // #region Grammar Tokens
  validateLineNumber(lineNumber) {
    if (lineNumber < 1 || lineNumber > this._textModel.getLineCount()) {
      throw new BugIndicatingError("Illegal value for lineNumber");
    }
  }
  get hasTokens() {
    return this._tokens.hasTokens;
  }
  resetTokenization() {
    this._tokens.resetTokenization();
  }
  get backgroundTokenizationState() {
    return this._tokens.backgroundTokenizationState;
  }
  forceTokenization(lineNumber) {
    this.validateLineNumber(lineNumber);
    this._tokens.forceTokenization(lineNumber);
  }
  hasAccurateTokensForLine(lineNumber) {
    this.validateLineNumber(lineNumber);
    return this._tokens.hasAccurateTokensForLine(lineNumber);
  }
  isCheapToTokenize(lineNumber) {
    this.validateLineNumber(lineNumber);
    return this._tokens.isCheapToTokenize(lineNumber);
  }
  tokenizeIfCheap(lineNumber) {
    this.validateLineNumber(lineNumber);
    this._tokens.tokenizeIfCheap(lineNumber);
  }
  getTokenTypeIfInsertingCharacter(lineNumber, column, character) {
    return this._tokens.getTokenTypeIfInsertingCharacter(lineNumber, column, character);
  }
  tokenizeLinesAt(lineNumber, lines) {
    return this._tokens.tokenizeLinesAt(lineNumber, lines);
  }
  // #endregion
  // #region Semantic Tokens
  setSemanticTokens(tokens, isComplete) {
    this._semanticTokens.set(tokens, isComplete);
    this._emitModelTokensChangedEvent({
      semanticTokensApplied: tokens !== null,
      ranges: [{ fromLineNumber: 1, toLineNumber: this._textModel.getLineCount() }]
    });
  }
  hasCompleteSemanticTokens() {
    return this._semanticTokens.isComplete();
  }
  hasSomeSemanticTokens() {
    return !this._semanticTokens.isEmpty();
  }
  setPartialSemanticTokens(range, tokens) {
    if (this.hasCompleteSemanticTokens()) {
      return;
    }
    const changedRange = this._textModel.validateRange(
      this._semanticTokens.setPartial(range, tokens)
    );
    this._emitModelTokensChangedEvent({
      semanticTokensApplied: true,
      ranges: [
        {
          fromLineNumber: changedRange.startLineNumber,
          toLineNumber: changedRange.endLineNumber
        }
      ]
    });
  }
  // #endregion
  // #region Utility Methods
  getWordAtPosition(_position) {
    this.assertNotDisposed();
    const position = this._textModel.validatePosition(_position);
    const lineContent = this._textModel.getLineContent(position.lineNumber);
    const lineTokens = this.getLineTokens(position.lineNumber);
    const tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
    const [rbStartOffset, rbEndOffset] = TokenizationTextModelPart._findLanguageBoundaries(lineTokens, tokenIndex);
    const rightBiasedWord = getWordAtText(
      position.column,
      this.getLanguageConfiguration(lineTokens.getLanguageId(tokenIndex)).getWordDefinition(),
      lineContent.substring(rbStartOffset, rbEndOffset),
      rbStartOffset
    );
    if (rightBiasedWord && rightBiasedWord.startColumn <= _position.column && _position.column <= rightBiasedWord.endColumn) {
      return rightBiasedWord;
    }
    if (tokenIndex > 0 && rbStartOffset === position.column - 1) {
      const [lbStartOffset, lbEndOffset] = TokenizationTextModelPart._findLanguageBoundaries(
        lineTokens,
        tokenIndex - 1
      );
      const leftBiasedWord = getWordAtText(
        position.column,
        this.getLanguageConfiguration(lineTokens.getLanguageId(tokenIndex - 1)).getWordDefinition(),
        lineContent.substring(lbStartOffset, lbEndOffset),
        lbStartOffset
      );
      if (leftBiasedWord && leftBiasedWord.startColumn <= _position.column && _position.column <= leftBiasedWord.endColumn) {
        return leftBiasedWord;
      }
    }
    return null;
  }
  getLanguageConfiguration(languageId) {
    return this._languageConfigurationService.getLanguageConfiguration(languageId);
  }
  static _findLanguageBoundaries(lineTokens, tokenIndex) {
    const languageId = lineTokens.getLanguageId(tokenIndex);
    let startOffset = 0;
    for (let i = tokenIndex; i >= 0 && lineTokens.getLanguageId(i) === languageId; i--) {
      startOffset = lineTokens.getStartOffset(i);
    }
    let endOffset = lineTokens.getLineContent().length;
    for (let i = tokenIndex, tokenCount = lineTokens.getCount(); i < tokenCount && lineTokens.getLanguageId(i) === languageId; i++) {
      endOffset = lineTokens.getEndOffset(i);
    }
    return [startOffset, endOffset];
  }
  getWordUntilPosition(position) {
    const wordAtPosition = this.getWordAtPosition(position);
    if (!wordAtPosition) {
      return { word: "", startColumn: position.column, endColumn: position.column };
    }
    return {
      word: wordAtPosition.word.substr(0, position.column - wordAtPosition.startColumn),
      startColumn: wordAtPosition.startColumn,
      endColumn: position.column
    };
  }
  // #endregion
  // #region Language Id handling
  getLanguageId() {
    return this._languageId;
  }
  getLanguageIdAtPosition(lineNumber, column) {
    const position = this._textModel.validatePosition(new Position(lineNumber, column));
    const lineTokens = this.getLineTokens(position.lineNumber);
    return lineTokens.getLanguageId(lineTokens.findTokenIndexAtOffset(position.column - 1));
  }
  setLanguageId(languageId, source = "api") {
    if (this._languageId === languageId) {
      return;
    }
    const e = {
      oldLanguage: this._languageId,
      newLanguage: languageId,
      source
    };
    this._languageId = languageId;
    this._bracketPairsTextModelPart.handleDidChangeLanguage(e);
    this._tokens.resetTokenization();
    this.createPreferredTokenProvider();
    this._onDidChangeLanguage.fire(e);
    this._onDidChangeLanguageConfiguration.fire({});
  }
  // #endregion
};
TokenizationTextModelPart = __decorateClass([
  __decorateParam(4, ILanguageService),
  __decorateParam(5, ILanguageConfigurationService),
  __decorateParam(6, IInstantiationService)
], TokenizationTextModelPart);
class GrammarTokens extends AbstractTokens {
  constructor(languageIdCodec, textModel, getLanguageId, attachedViews) {
    super(languageIdCodec, textModel, getLanguageId);
    this._tokenizer = null;
    this._backgroundTokenizationState = BackgroundTokenizationState.InProgress;
    this._onDidChangeBackgroundTokenizationState = this._register(new Emitter());
    this.onDidChangeBackgroundTokenizationState = this._onDidChangeBackgroundTokenizationState.event;
    this._defaultBackgroundTokenizer = null;
    this._backgroundTokenizer = this._register(new MutableDisposable());
    this._tokens = new ContiguousTokensStore(this._languageIdCodec);
    this._debugBackgroundTokenizer = this._register(new MutableDisposable());
    this._attachedViewStates = this._register(new DisposableMap());
    this._register(TokenizationRegistry.onDidChange((e) => {
      const languageId = this.getLanguageId();
      if (e.changedLanguages.indexOf(languageId) === -1) {
        return;
      }
      this.resetTokenization();
    }));
    this.resetTokenization();
    this._register(attachedViews.onDidChangeVisibleRanges(({ view, state }) => {
      if (state) {
        let existing = this._attachedViewStates.get(view);
        if (!existing) {
          existing = new AttachedViewHandler(() => this.refreshRanges(existing.lineRanges));
          this._attachedViewStates.set(view, existing);
        }
        existing.handleStateChange(state);
      } else {
        this._attachedViewStates.deleteAndDispose(view);
      }
    }));
  }
  resetTokenization(fireTokenChangeEvent = true) {
    this._tokens.flush();
    this._debugBackgroundTokens?.flush();
    if (this._debugBackgroundStates) {
      this._debugBackgroundStates = new TrackingTokenizationStateStore(this._textModel.getLineCount());
    }
    if (fireTokenChangeEvent) {
      this._onDidChangeTokens.fire({
        semanticTokensApplied: false,
        ranges: [
          {
            fromLineNumber: 1,
            toLineNumber: this._textModel.getLineCount()
          }
        ]
      });
    }
    const initializeTokenization = () => {
      if (this._textModel.isTooLargeForTokenization()) {
        return [null, null];
      }
      const tokenizationSupport2 = TokenizationRegistry.get(this.getLanguageId());
      if (!tokenizationSupport2) {
        return [null, null];
      }
      let initialState2;
      try {
        initialState2 = tokenizationSupport2.getInitialState();
      } catch (e) {
        onUnexpectedError(e);
        return [null, null];
      }
      return [tokenizationSupport2, initialState2];
    };
    const [tokenizationSupport, initialState] = initializeTokenization();
    if (tokenizationSupport && initialState) {
      this._tokenizer = new TokenizerWithStateStoreAndTextModel(this._textModel.getLineCount(), tokenizationSupport, this._textModel, this._languageIdCodec);
    } else {
      this._tokenizer = null;
    }
    this._backgroundTokenizer.clear();
    this._defaultBackgroundTokenizer = null;
    if (this._tokenizer) {
      const b = {
        setTokens: (tokens) => {
          this.setTokens(tokens);
        },
        backgroundTokenizationFinished: () => {
          if (this._backgroundTokenizationState === BackgroundTokenizationState.Completed) {
            return;
          }
          const newState = BackgroundTokenizationState.Completed;
          this._backgroundTokenizationState = newState;
          this._onDidChangeBackgroundTokenizationState.fire();
        },
        setEndState: (lineNumber, state) => {
          if (!this._tokenizer) {
            return;
          }
          const firstInvalidEndStateLineNumber = this._tokenizer.store.getFirstInvalidEndStateLineNumber();
          if (firstInvalidEndStateLineNumber !== null && lineNumber >= firstInvalidEndStateLineNumber) {
            this._tokenizer?.store.setEndState(lineNumber, state);
          }
        }
      };
      if (tokenizationSupport && tokenizationSupport.createBackgroundTokenizer && !tokenizationSupport.backgroundTokenizerShouldOnlyVerifyTokens) {
        this._backgroundTokenizer.value = tokenizationSupport.createBackgroundTokenizer(this._textModel, b);
      }
      if (!this._backgroundTokenizer.value && !this._textModel.isTooLargeForTokenization()) {
        this._backgroundTokenizer.value = this._defaultBackgroundTokenizer = new DefaultBackgroundTokenizer(this._tokenizer, b);
        this._defaultBackgroundTokenizer.handleChanges();
      }
      if (tokenizationSupport?.backgroundTokenizerShouldOnlyVerifyTokens && tokenizationSupport.createBackgroundTokenizer) {
        this._debugBackgroundTokens = new ContiguousTokensStore(this._languageIdCodec);
        this._debugBackgroundStates = new TrackingTokenizationStateStore(this._textModel.getLineCount());
        this._debugBackgroundTokenizer.clear();
        this._debugBackgroundTokenizer.value = tokenizationSupport.createBackgroundTokenizer(this._textModel, {
          setTokens: (tokens) => {
            this._debugBackgroundTokens?.setMultilineTokens(tokens, this._textModel);
          },
          backgroundTokenizationFinished() {
          },
          setEndState: (lineNumber, state) => {
            this._debugBackgroundStates?.setEndState(lineNumber, state);
          }
        });
      } else {
        this._debugBackgroundTokens = void 0;
        this._debugBackgroundStates = void 0;
        this._debugBackgroundTokenizer.value = void 0;
      }
    }
    this.refreshAllVisibleLineTokens();
  }
  handleDidChangeAttached() {
    this._defaultBackgroundTokenizer?.handleChanges();
  }
  handleDidChangeContent(e) {
    if (e.isFlush) {
      this.resetTokenization(false);
    } else if (!e.isEolChange) {
      for (const c of e.changes) {
        const [eolCount, firstLineLength] = countEOL(c.text);
        this._tokens.acceptEdit(c.range, eolCount, firstLineLength);
        this._debugBackgroundTokens?.acceptEdit(c.range, eolCount, firstLineLength);
      }
      this._debugBackgroundStates?.acceptChanges(e.changes);
      if (this._tokenizer) {
        this._tokenizer.store.acceptChanges(e.changes);
      }
      this._defaultBackgroundTokenizer?.handleChanges();
    }
  }
  setTokens(tokens) {
    const { changes } = this._tokens.setMultilineTokens(tokens, this._textModel);
    if (changes.length > 0) {
      this._onDidChangeTokens.fire({ semanticTokensApplied: false, ranges: changes });
    }
    return { changes };
  }
  refreshAllVisibleLineTokens() {
    const ranges = LineRange.joinMany([...this._attachedViewStates].map(([_, s]) => s.lineRanges));
    this.refreshRanges(ranges);
  }
  refreshRanges(ranges) {
    for (const range of ranges) {
      this.refreshRange(range.startLineNumber, range.endLineNumberExclusive - 1);
    }
  }
  refreshRange(startLineNumber, endLineNumber) {
    if (!this._tokenizer) {
      return;
    }
    startLineNumber = Math.max(1, Math.min(this._textModel.getLineCount(), startLineNumber));
    endLineNumber = Math.min(this._textModel.getLineCount(), endLineNumber);
    const builder = new ContiguousMultilineTokensBuilder();
    const { heuristicTokens } = this._tokenizer.tokenizeHeuristically(builder, startLineNumber, endLineNumber);
    const changedTokens = this.setTokens(builder.finalize());
    if (heuristicTokens) {
      for (const c of changedTokens.changes) {
        this._backgroundTokenizer.value?.requestTokens(c.fromLineNumber, c.toLineNumber + 1);
      }
    }
    this._defaultBackgroundTokenizer?.checkFinished();
  }
  forceTokenization(lineNumber) {
    const builder = new ContiguousMultilineTokensBuilder();
    this._tokenizer?.updateTokensUntilLine(builder, lineNumber);
    this.setTokens(builder.finalize());
    this._defaultBackgroundTokenizer?.checkFinished();
  }
  hasAccurateTokensForLine(lineNumber) {
    if (!this._tokenizer) {
      return true;
    }
    return this._tokenizer.hasAccurateTokensForLine(lineNumber);
  }
  isCheapToTokenize(lineNumber) {
    if (!this._tokenizer) {
      return true;
    }
    return this._tokenizer.isCheapToTokenize(lineNumber);
  }
  getLineTokens(lineNumber) {
    const lineText = this._textModel.getLineContent(lineNumber);
    const result = this._tokens.getTokens(
      this._textModel.getLanguageId(),
      lineNumber - 1,
      lineText
    );
    if (this._debugBackgroundTokens && this._debugBackgroundStates && this._tokenizer) {
      if (this._debugBackgroundStates.getFirstInvalidEndStateLineNumberOrMax() > lineNumber && this._tokenizer.store.getFirstInvalidEndStateLineNumberOrMax() > lineNumber) {
        const backgroundResult = this._debugBackgroundTokens.getTokens(
          this._textModel.getLanguageId(),
          lineNumber - 1,
          lineText
        );
        if (!result.equals(backgroundResult) && this._debugBackgroundTokenizer.value?.reportMismatchingTokens) {
          this._debugBackgroundTokenizer.value.reportMismatchingTokens(lineNumber);
        }
      }
    }
    return result;
  }
  getTokenTypeIfInsertingCharacter(lineNumber, column, character) {
    if (!this._tokenizer) {
      return StandardTokenType.Other;
    }
    const position = this._textModel.validatePosition(new Position(lineNumber, column));
    this.forceTokenization(position.lineNumber);
    return this._tokenizer.getTokenTypeIfInsertingCharacter(position, character);
  }
  tokenizeLinesAt(lineNumber, lines) {
    if (!this._tokenizer) {
      return null;
    }
    this.forceTokenization(lineNumber);
    return this._tokenizer.tokenizeLinesAt(lineNumber, lines);
  }
  get hasTokens() {
    return this._tokens.hasTokens;
  }
}
export {
  TokenizationTextModelPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL3Rva2VuaXphdGlvblRleHRNb2RlbFBhcnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NoYXJDb2RlLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlTWFwLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGNvdW50RU9MIH0gZnJvbSAnLi4vY29yZS9lb2xDb3VudGVyLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiwgUG9zaXRpb24gfSBmcm9tICcuLi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJV29yZEF0UG9zaXRpb24sIGdldFdvcmRBdFRleHQgfSBmcm9tICcuLi9jb3JlL3dvcmRIZWxwZXIuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IElCYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RvcmUsIElCYWNrZ3JvdW5kVG9rZW5pemVyLCBJTGFuZ3VhZ2VJZENvZGVjLCBJU3RhdGUsIElUb2tlbml6YXRpb25TdXBwb3J0LCBUb2tlbml6YXRpb25SZWdpc3RyeSwgVHJlZVNpdHRlclRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2VDaGFuZ2VFdmVudCwgUmVzb2x2ZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUF0dGFjaGVkVmlldyB9IGZyb20gJy4uL21vZGVsLmpzJztcbmltcG9ydCB7IEJyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQgfSBmcm9tICcuL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzSW1wbC5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWxQYXJ0IH0gZnJvbSAnLi90ZXh0TW9kZWxQYXJ0LmpzJztcbmltcG9ydCB7IERlZmF1bHRCYWNrZ3JvdW5kVG9rZW5pemVyLCBUb2tlbml6ZXJXaXRoU3RhdGVTdG9yZUFuZFRleHRNb2RlbCwgVHJhY2tpbmdUb2tlbml6YXRpb25TdGF0ZVN0b3JlIH0gZnJvbSAnLi90ZXh0TW9kZWxUb2tlbnMuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RUb2tlbnMsIEF0dGFjaGVkVmlld0hhbmRsZXIsIEF0dGFjaGVkVmlld3MgfSBmcm9tICcuL3Rva2Vucy5qcyc7XG5pbXBvcnQgeyBUcmVlU2l0dGVyVG9rZW5zIH0gZnJvbSAnLi90cmVlU2l0dGVyVG9rZW5zLmpzJztcbmltcG9ydCB7IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQsIElNb2RlbExhbmd1YWdlQ2hhbmdlZEV2ZW50LCBJTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIElNb2RlbFRva2Vuc0NoYW5nZWRFdmVudCB9IGZyb20gJy4uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBCYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RhdGUsIElUb2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0IH0gZnJvbSAnLi4vdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5qcyc7XG5pbXBvcnQgeyBDb250aWd1b3VzTXVsdGlsaW5lVG9rZW5zIH0gZnJvbSAnLi4vdG9rZW5zL2NvbnRpZ3VvdXNNdWx0aWxpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgQ29udGlndW91c011bHRpbGluZVRva2Vuc0J1aWxkZXIgfSBmcm9tICcuLi90b2tlbnMvY29udGlndW91c011bHRpbGluZVRva2Vuc0J1aWxkZXIuanMnO1xuaW1wb3J0IHsgQ29udGlndW91c1Rva2Vuc1N0b3JlIH0gZnJvbSAnLi4vdG9rZW5zL2NvbnRpZ3VvdXNUb2tlbnNTdG9yZS5qcyc7XG5pbXBvcnQgeyBMaW5lVG9rZW5zIH0gZnJvbSAnLi4vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgU3BhcnNlTXVsdGlsaW5lVG9rZW5zIH0gZnJvbSAnLi4vdG9rZW5zL3NwYXJzZU11bHRpbGluZVRva2Vucy5qcyc7XG5pbXBvcnQgeyBTcGFyc2VUb2tlbnNTdG9yZSB9IGZyb20gJy4uL3Rva2Vucy9zcGFyc2VUb2tlbnNTdG9yZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuZXhwb3J0IGNsYXNzIFRva2VuaXphdGlvblRleHRNb2RlbFBhcnQgZXh0ZW5kcyBUZXh0TW9kZWxQYXJ0IGltcGxlbWVudHMgSVRva2VuaXphdGlvblRleHRNb2RlbFBhcnQge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zZW1hbnRpY1Rva2VuczogU3BhcnNlVG9rZW5zU3RvcmUgPSBuZXcgU3BhcnNlVG9rZW5zU3RvcmUodGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYyk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VMYW5ndWFnZTogRW1pdHRlcjxJTW9kZWxMYW5ndWFnZUNoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTW9kZWxMYW5ndWFnZUNoYW5nZWRFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUxhbmd1YWdlOiBFdmVudDxJTW9kZWxMYW5ndWFnZUNoYW5nZWRFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZUxhbmd1YWdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTGFuZ3VhZ2VDb25maWd1cmF0aW9uOiBFbWl0dGVyPElNb2RlbExhbmd1YWdlQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VMYW5ndWFnZUNvbmZpZ3VyYXRpb246IEV2ZW50PElNb2RlbExhbmd1YWdlQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZUxhbmd1YWdlQ29uZmlndXJhdGlvbi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVRva2VuczogRW1pdHRlcjxJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vZGVsVG9rZW5zQ2hhbmdlZEV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlVG9rZW5zOiBFdmVudDxJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VUb2tlbnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfdG9rZW5zITogQWJzdHJhY3RUb2tlbnM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Rva2Vuc0Rpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbDogVGV4dE1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQ6IEJyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQsXG5cdFx0cHJpdmF0ZSBfbGFuZ3VhZ2VJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2F0dGFjaGVkVmlld3M6IEF0dGFjaGVkVmlld3MsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8vIFdlIGp1c3QgbG9vayBhdCByZWdpc3RyeSBjaGFuZ2VzIHRvIGRldGVybWluZSB3aGV0aGVyIHRvIHVzZSB0cmVlIHNpdHRlci5cblx0XHQvLyBUaGlzIG1lYW5zIHRoYXQgcmVtb3ZpbmcgYSBsYW5ndWFnZSBmcm9tIHRoZSBzZXR0aW5nIHdpbGwgbm90IGNhdXNlIGEgc3dpdGNoIHRvIHRleHRtYXRlIGFuZCB3aWxsIHJlcXVpcmUgYSByZWxvYWQuXG5cdFx0Ly8gQWRkaW5nIGEgbGFuZ3VhZ2UgdG8gdGhlIHNldHRpbmcgd2lsbCBub3QgbmVlZCBhIHJlbG9hZCwgaG93ZXZlci5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIoVHJlZVNpdHRlclRva2VuaXphdGlvblJlZ2lzdHJ5Lm9uRGlkQ2hhbmdlLCAoZSkgPT4gZS5jaGFuZ2VkTGFuZ3VhZ2VzLmluY2x1ZGVzKHRoaXMuX2xhbmd1YWdlSWQpKSgoKSA9PiB7XG5cdFx0XHR0aGlzLmNyZWF0ZVByZWZlcnJlZFRva2VuUHJvdmlkZXIoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5jcmVhdGVQcmVmZXJyZWRUb2tlblByb3ZpZGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUdyYW1tYXJUb2tlbnMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlZ2lzdGVyKG5ldyBHcmFtbWFyVG9rZW5zKHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMsIHRoaXMuX3RleHRNb2RlbCwgKCkgPT4gdGhpcy5fbGFuZ3VhZ2VJZCwgdGhpcy5fYXR0YWNoZWRWaWV3cykpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUcmVlU2l0dGVyVG9rZW5zKCk6IEFic3RyYWN0VG9rZW5zIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZVNpdHRlclRva2VucywgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYywgdGhpcy5fdGV4dE1vZGVsLCAoKSA9PiB0aGlzLl9sYW5ndWFnZUlkKSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRva2Vucyh1c2VUcmVlU2l0dGVyOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgbmVlZHNSZXNldCA9IHRoaXMuX3Rva2VucyAhPT0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Rva2Vucz8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3Rva2VucyA9IHVzZVRyZWVTaXR0ZXIgPyB0aGlzLmNyZWF0ZVRyZWVTaXR0ZXJUb2tlbnMoKSA6IHRoaXMuY3JlYXRlR3JhbW1hclRva2VucygpO1xuXHRcdHRoaXMuX3Rva2Vuc0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fdG9rZW5zRGlzcG9zYWJsZXMuYWRkKHRoaXMuX3Rva2Vucy5vbkRpZENoYW5nZVRva2VucyhlID0+IHtcblx0XHRcdHRoaXMuX2VtaXRNb2RlbFRva2Vuc0NoYW5nZWRFdmVudChlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl90b2tlbnNEaXNwb3NhYmxlcy5hZGQodGhpcy5fdG9rZW5zLm9uRGlkQ2hhbmdlQmFja2dyb3VuZFRva2VuaXphdGlvblN0YXRlKGUgPT4ge1xuXHRcdFx0dGhpcy5fYnJhY2tldFBhaXJzVGV4dE1vZGVsUGFydC5oYW5kbGVEaWRDaGFuZ2VCYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RhdGUoKTtcblx0XHR9KSk7XG5cdFx0aWYgKG5lZWRzUmVzZXQpIHtcblx0XHRcdC8vIFdlIG5lZWQgdG8gcmVzZXQgdGhlIHRva2VuaXphdGlvbiwgYXMgdGhlIG5ldyB0b2tlbiBwcm92aWRlciBvdGhlcndpc2Ugd29uJ3QgaGF2ZSBhIGNoYW5jZSB0byBwcm92aWRlIHRva2VucyB1bnRpbCBzb21lIGFjdGlvbiBoYXBwZW5zIGluIHRoZSBlZGl0b3IuXG5cdFx0XHR0aGlzLl90b2tlbnMucmVzZXRUb2tlbml6YXRpb24oKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVByZWZlcnJlZFRva2VuUHJvdmlkZXIoKSB7XG5cdFx0aWYgKFRyZWVTaXR0ZXJUb2tlbml6YXRpb25SZWdpc3RyeS5nZXQodGhpcy5fbGFuZ3VhZ2VJZCkpIHtcblx0XHRcdGlmICghKHRoaXMuX3Rva2VucyBpbnN0YW5jZW9mIFRyZWVTaXR0ZXJUb2tlbnMpKSB7XG5cdFx0XHRcdHRoaXMuY3JlYXRlVG9rZW5zKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoISh0aGlzLl90b2tlbnMgaW5zdGFuY2VvZiBHcmFtbWFyVG9rZW5zKSkge1xuXHRcdFx0XHR0aGlzLmNyZWF0ZVRva2VucyhmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0X2hhc0xpc3RlbmVycygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKHRoaXMuX29uRGlkQ2hhbmdlTGFuZ3VhZ2UuaGFzTGlzdGVuZXJzKClcblx0XHRcdHx8IHRoaXMuX29uRGlkQ2hhbmdlTGFuZ3VhZ2VDb25maWd1cmF0aW9uLmhhc0xpc3RlbmVycygpXG5cdFx0XHR8fCB0aGlzLl9vbkRpZENoYW5nZVRva2Vucy5oYXNMaXN0ZW5lcnMoKSk7XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZUNoYW5nZShlOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZS5hZmZlY3RzKHRoaXMuX2xhbmd1YWdlSWQpKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxhbmd1YWdlQ29uZmlndXJhdGlvbi5maXJlKHt9KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlRGlkQ2hhbmdlQ29udGVudChlOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuaXNGbHVzaCkge1xuXHRcdFx0dGhpcy5fc2VtYW50aWNUb2tlbnMuZmx1c2goKTtcblx0XHR9IGVsc2UgaWYgKCFlLmlzRW9sQ2hhbmdlKSB7IC8vIFdlIGRvbid0IGhhdmUgdG8gZG8gYW55dGhpbmcgb24gYW4gRU9MIGNoYW5nZVxuXHRcdFx0Zm9yIChjb25zdCBjIG9mIGUuY2hhbmdlcykge1xuXHRcdFx0XHRjb25zdCBbZW9sQ291bnQsIGZpcnN0TGluZUxlbmd0aCwgbGFzdExpbmVMZW5ndGhdID0gY291bnRFT0woYy50ZXh0KTtcblxuXHRcdFx0XHR0aGlzLl9zZW1hbnRpY1Rva2Vucy5hY2NlcHRFZGl0KFxuXHRcdFx0XHRcdGMucmFuZ2UsXG5cdFx0XHRcdFx0ZW9sQ291bnQsXG5cdFx0XHRcdFx0Zmlyc3RMaW5lTGVuZ3RoLFxuXHRcdFx0XHRcdGxhc3RMaW5lTGVuZ3RoLFxuXHRcdFx0XHRcdGMudGV4dC5sZW5ndGggPiAwID8gYy50ZXh0LmNoYXJDb2RlQXQoMCkgOiBDaGFyQ29kZS5OdWxsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fdG9rZW5zLmhhbmRsZURpZENoYW5nZUNvbnRlbnQoZSk7XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlRGlkQ2hhbmdlQXR0YWNoZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5fdG9rZW5zLmhhbmRsZURpZENoYW5nZUF0dGFjaGVkKCk7XG5cdH1cblxuXHQvKipcblx0ICogSW5jbHVkZXMgZ3JhbW1hciBhbmQgc2VtYW50aWMgdG9rZW5zLlxuXHQgKi9cblx0cHVibGljIGdldExpbmVUb2tlbnMobGluZU51bWJlcjogbnVtYmVyKTogTGluZVRva2VucyB7XG5cdFx0dGhpcy52YWxpZGF0ZUxpbmVOdW1iZXIobGluZU51bWJlcik7XG5cdFx0Y29uc3Qgc3ludGFjdGljVG9rZW5zID0gdGhpcy5fdG9rZW5zLmdldExpbmVUb2tlbnMobGluZU51bWJlcik7XG5cdFx0cmV0dXJuIHRoaXMuX3NlbWFudGljVG9rZW5zLmFkZFNwYXJzZVRva2VucyhsaW5lTnVtYmVyLCBzeW50YWN0aWNUb2tlbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW1pdE1vZGVsVG9rZW5zQ2hhbmdlZEV2ZW50KGU6IElNb2RlbFRva2Vuc0NoYW5nZWRFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fdGV4dE1vZGVsLl9pc0Rpc3Bvc2luZygpKSB7XG5cdFx0XHR0aGlzLl9icmFja2V0UGFpcnNUZXh0TW9kZWxQYXJ0LmhhbmRsZURpZENoYW5nZVRva2VucyhlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVG9rZW5zLmZpcmUoZSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gI3JlZ2lvbiBHcmFtbWFyIFRva2Vuc1xuXG5cdHByaXZhdGUgdmFsaWRhdGVMaW5lTnVtYmVyKGxpbmVOdW1iZXI6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmIChsaW5lTnVtYmVyIDwgMSB8fCBsaW5lTnVtYmVyID4gdGhpcy5fdGV4dE1vZGVsLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdJbGxlZ2FsIHZhbHVlIGZvciBsaW5lTnVtYmVyJyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldCBoYXNUb2tlbnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy5oYXNUb2tlbnM7XG5cdH1cblxuXHRwdWJsaWMgcmVzZXRUb2tlbml6YXRpb24oKSB7XG5cdFx0dGhpcy5fdG9rZW5zLnJlc2V0VG9rZW5pemF0aW9uKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdG9rZW5zLmJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZTtcblx0fVxuXG5cdHB1YmxpYyBmb3JjZVRva2VuaXphdGlvbihsaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZhbGlkYXRlTGluZU51bWJlcihsaW5lTnVtYmVyKTtcblx0XHR0aGlzLl90b2tlbnMuZm9yY2VUb2tlbml6YXRpb24obGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgaGFzQWNjdXJhdGVUb2tlbnNGb3JMaW5lKGxpbmVOdW1iZXI6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHRoaXMudmFsaWRhdGVMaW5lTnVtYmVyKGxpbmVOdW1iZXIpO1xuXHRcdHJldHVybiB0aGlzLl90b2tlbnMuaGFzQWNjdXJhdGVUb2tlbnNGb3JMaW5lKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGlzQ2hlYXBUb1Rva2VuaXplKGxpbmVOdW1iZXI6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHRoaXMudmFsaWRhdGVMaW5lTnVtYmVyKGxpbmVOdW1iZXIpO1xuXHRcdHJldHVybiB0aGlzLl90b2tlbnMuaXNDaGVhcFRvVG9rZW5pemUobGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgdG9rZW5pemVJZkNoZWFwKGxpbmVOdW1iZXI6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMudmFsaWRhdGVMaW5lTnVtYmVyKGxpbmVOdW1iZXIpO1xuXHRcdHRoaXMuX3Rva2Vucy50b2tlbml6ZUlmQ2hlYXAobGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VG9rZW5UeXBlSWZJbnNlcnRpbmdDaGFyYWN0ZXIobGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlciwgY2hhcmFjdGVyOiBzdHJpbmcpOiBTdGFuZGFyZFRva2VuVHlwZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy5nZXRUb2tlblR5cGVJZkluc2VydGluZ0NoYXJhY3RlcihsaW5lTnVtYmVyLCBjb2x1bW4sIGNoYXJhY3Rlcik7XG5cdH1cblxuXHRwdWJsaWMgdG9rZW5pemVMaW5lc0F0KGxpbmVOdW1iZXI6IG51bWJlciwgbGluZXM6IHN0cmluZ1tdKTogTGluZVRva2Vuc1tdIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy50b2tlbml6ZUxpbmVzQXQobGluZU51bWJlciwgbGluZXMpO1xuXHR9XG5cblx0Ly8gI2VuZHJlZ2lvblxuXG5cdC8vICNyZWdpb24gU2VtYW50aWMgVG9rZW5zXG5cblx0cHVibGljIHNldFNlbWFudGljVG9rZW5zKHRva2VuczogU3BhcnNlTXVsdGlsaW5lVG9rZW5zW10gfCBudWxsLCBpc0NvbXBsZXRlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fc2VtYW50aWNUb2tlbnMuc2V0KHRva2VucywgaXNDb21wbGV0ZSk7XG5cblx0XHR0aGlzLl9lbWl0TW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQoe1xuXHRcdFx0c2VtYW50aWNUb2tlbnNBcHBsaWVkOiB0b2tlbnMgIT09IG51bGwsXG5cdFx0XHRyYW5nZXM6IFt7IGZyb21MaW5lTnVtYmVyOiAxLCB0b0xpbmVOdW1iZXI6IHRoaXMuX3RleHRNb2RlbC5nZXRMaW5lQ291bnQoKSB9XSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBoYXNDb21wbGV0ZVNlbWFudGljVG9rZW5zKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zZW1hbnRpY1Rva2Vucy5pc0NvbXBsZXRlKCk7XG5cdH1cblxuXHRwdWJsaWMgaGFzU29tZVNlbWFudGljVG9rZW5zKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5fc2VtYW50aWNUb2tlbnMuaXNFbXB0eSgpO1xuXHR9XG5cblx0cHVibGljIHNldFBhcnRpYWxTZW1hbnRpY1Rva2VucyhyYW5nZTogUmFuZ2UsIHRva2VuczogU3BhcnNlTXVsdGlsaW5lVG9rZW5zW10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5oYXNDb21wbGV0ZVNlbWFudGljVG9rZW5zKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgY2hhbmdlZFJhbmdlID0gdGhpcy5fdGV4dE1vZGVsLnZhbGlkYXRlUmFuZ2UoXG5cdFx0XHR0aGlzLl9zZW1hbnRpY1Rva2Vucy5zZXRQYXJ0aWFsKHJhbmdlLCB0b2tlbnMpXG5cdFx0KTtcblxuXHRcdHRoaXMuX2VtaXRNb2RlbFRva2Vuc0NoYW5nZWRFdmVudCh7XG5cdFx0XHRzZW1hbnRpY1Rva2Vuc0FwcGxpZWQ6IHRydWUsXG5cdFx0XHRyYW5nZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGZyb21MaW5lTnVtYmVyOiBjaGFuZ2VkUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdHRvTGluZU51bWJlcjogY2hhbmdlZFJhbmdlLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0pO1xuXHR9XG5cblx0Ly8gI2VuZHJlZ2lvblxuXG5cdC8vICNyZWdpb24gVXRpbGl0eSBNZXRob2RzXG5cblx0cHVibGljIGdldFdvcmRBdFBvc2l0aW9uKF9wb3NpdGlvbjogSVBvc2l0aW9uKTogSVdvcmRBdFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0dGhpcy5hc3NlcnROb3REaXNwb3NlZCgpO1xuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl90ZXh0TW9kZWwudmFsaWRhdGVQb3NpdGlvbihfcG9zaXRpb24pO1xuXHRcdGNvbnN0IGxpbmVDb250ZW50ID0gdGhpcy5fdGV4dE1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGxpbmVUb2tlbnMgPSB0aGlzLmdldExpbmVUb2tlbnMocG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0Y29uc3QgdG9rZW5JbmRleCA9IGxpbmVUb2tlbnMuZmluZFRva2VuSW5kZXhBdE9mZnNldChwb3NpdGlvbi5jb2x1bW4gLSAxKTtcblxuXHRcdC8vICgxKS4gRmlyc3QgdHJ5IGNoZWNraW5nIHJpZ2h0IGJpYXNlZCB3b3JkXG5cdFx0Y29uc3QgW3JiU3RhcnRPZmZzZXQsIHJiRW5kT2Zmc2V0XSA9IFRva2VuaXphdGlvblRleHRNb2RlbFBhcnQuX2ZpbmRMYW5ndWFnZUJvdW5kYXJpZXMobGluZVRva2VucywgdG9rZW5JbmRleCk7XG5cdFx0Y29uc3QgcmlnaHRCaWFzZWRXb3JkID0gZ2V0V29yZEF0VGV4dChcblx0XHRcdHBvc2l0aW9uLmNvbHVtbixcblx0XHRcdHRoaXMuZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxpbmVUb2tlbnMuZ2V0TGFuZ3VhZ2VJZCh0b2tlbkluZGV4KSkuZ2V0V29yZERlZmluaXRpb24oKSxcblx0XHRcdGxpbmVDb250ZW50LnN1YnN0cmluZyhyYlN0YXJ0T2Zmc2V0LCByYkVuZE9mZnNldCksXG5cdFx0XHRyYlN0YXJ0T2Zmc2V0XG5cdFx0KTtcblx0XHQvLyBNYWtlIHN1cmUgdGhlIHJlc3VsdCB0b3VjaGVzIHRoZSBvcmlnaW5hbCBwYXNzZWQgaW4gcG9zaXRpb25cblx0XHRpZiAoXG5cdFx0XHRyaWdodEJpYXNlZFdvcmQgJiZcblx0XHRcdHJpZ2h0Qmlhc2VkV29yZC5zdGFydENvbHVtbiA8PSBfcG9zaXRpb24uY29sdW1uICYmXG5cdFx0XHRfcG9zaXRpb24uY29sdW1uIDw9IHJpZ2h0Qmlhc2VkV29yZC5lbmRDb2x1bW5cblx0XHQpIHtcblx0XHRcdHJldHVybiByaWdodEJpYXNlZFdvcmQ7XG5cdFx0fVxuXG5cdFx0Ly8gKDIpLiBFbHNlLCBpZiB3ZSB3ZXJlIGF0IGEgbGFuZ3VhZ2UgYm91bmRhcnksIGNoZWNrIHRoZSBsZWZ0IGJpYXNlZCB3b3JkXG5cdFx0aWYgKHRva2VuSW5kZXggPiAwICYmIHJiU3RhcnRPZmZzZXQgPT09IHBvc2l0aW9uLmNvbHVtbiAtIDEpIHtcblx0XHRcdC8vIGVkZ2UgY2FzZSwgd2hlcmUgYHBvc2l0aW9uYCBzaXRzIGJldHdlZW4gdHdvIHRva2VucyBiZWxvbmdpbmcgdG8gdHdvIGRpZmZlcmVudCBsYW5ndWFnZXNcblx0XHRcdGNvbnN0IFtsYlN0YXJ0T2Zmc2V0LCBsYkVuZE9mZnNldF0gPSBUb2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0Ll9maW5kTGFuZ3VhZ2VCb3VuZGFyaWVzKFxuXHRcdFx0XHRsaW5lVG9rZW5zLFxuXHRcdFx0XHR0b2tlbkluZGV4IC0gMVxuXHRcdFx0KTtcblx0XHRcdGNvbnN0IGxlZnRCaWFzZWRXb3JkID0gZ2V0V29yZEF0VGV4dChcblx0XHRcdFx0cG9zaXRpb24uY29sdW1uLFxuXHRcdFx0XHR0aGlzLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihsaW5lVG9rZW5zLmdldExhbmd1YWdlSWQodG9rZW5JbmRleCAtIDEpKS5nZXRXb3JkRGVmaW5pdGlvbigpLFxuXHRcdFx0XHRsaW5lQ29udGVudC5zdWJzdHJpbmcobGJTdGFydE9mZnNldCwgbGJFbmRPZmZzZXQpLFxuXHRcdFx0XHRsYlN0YXJ0T2Zmc2V0XG5cdFx0XHQpO1xuXHRcdFx0Ly8gTWFrZSBzdXJlIHRoZSByZXN1bHQgdG91Y2hlcyB0aGUgb3JpZ2luYWwgcGFzc2VkIGluIHBvc2l0aW9uXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGxlZnRCaWFzZWRXb3JkICYmXG5cdFx0XHRcdGxlZnRCaWFzZWRXb3JkLnN0YXJ0Q29sdW1uIDw9IF9wb3NpdGlvbi5jb2x1bW4gJiZcblx0XHRcdFx0X3Bvc2l0aW9uLmNvbHVtbiA8PSBsZWZ0Qmlhc2VkV29yZC5lbmRDb2x1bW5cblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gbGVmdEJpYXNlZFdvcmQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGdldExhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUlkOiBzdHJpbmcpOiBSZXNvbHZlZExhbmd1YWdlQ29uZmlndXJhdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxhbmd1YWdlSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2ZpbmRMYW5ndWFnZUJvdW5kYXJpZXMobGluZVRva2VuczogTGluZVRva2VucywgdG9rZW5JbmRleDogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IGxpbmVUb2tlbnMuZ2V0TGFuZ3VhZ2VJZCh0b2tlbkluZGV4KTtcblxuXHRcdC8vIGdvIGxlZnQgdW50aWwgYSBkaWZmZXJlbnQgbGFuZ3VhZ2UgaXMgaGl0XG5cdFx0bGV0IHN0YXJ0T2Zmc2V0ID0gMDtcblx0XHRmb3IgKGxldCBpID0gdG9rZW5JbmRleDsgaSA+PSAwICYmIGxpbmVUb2tlbnMuZ2V0TGFuZ3VhZ2VJZChpKSA9PT0gbGFuZ3VhZ2VJZDsgaS0tKSB7XG5cdFx0XHRzdGFydE9mZnNldCA9IGxpbmVUb2tlbnMuZ2V0U3RhcnRPZmZzZXQoaSk7XG5cdFx0fVxuXG5cdFx0Ly8gZ28gcmlnaHQgdW50aWwgYSBkaWZmZXJlbnQgbGFuZ3VhZ2UgaXMgaGl0XG5cdFx0bGV0IGVuZE9mZnNldCA9IGxpbmVUb2tlbnMuZ2V0TGluZUNvbnRlbnQoKS5sZW5ndGg7XG5cdFx0Zm9yIChcblx0XHRcdGxldCBpID0gdG9rZW5JbmRleCwgdG9rZW5Db3VudCA9IGxpbmVUb2tlbnMuZ2V0Q291bnQoKTtcblx0XHRcdGkgPCB0b2tlbkNvdW50ICYmIGxpbmVUb2tlbnMuZ2V0TGFuZ3VhZ2VJZChpKSA9PT0gbGFuZ3VhZ2VJZDtcblx0XHRcdGkrK1xuXHRcdCkge1xuXHRcdFx0ZW5kT2Zmc2V0ID0gbGluZVRva2Vucy5nZXRFbmRPZmZzZXQoaSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtzdGFydE9mZnNldCwgZW5kT2Zmc2V0XTtcblx0fVxuXG5cdHB1YmxpYyBnZXRXb3JkVW50aWxQb3NpdGlvbihwb3NpdGlvbjogSVBvc2l0aW9uKTogSVdvcmRBdFBvc2l0aW9uIHtcblx0XHRjb25zdCB3b3JkQXRQb3NpdGlvbiA9IHRoaXMuZ2V0V29yZEF0UG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdGlmICghd29yZEF0UG9zaXRpb24pIHtcblx0XHRcdHJldHVybiB7IHdvcmQ6ICcnLCBzdGFydENvbHVtbjogcG9zaXRpb24uY29sdW1uLCBlbmRDb2x1bW46IHBvc2l0aW9uLmNvbHVtbiwgfTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHdvcmQ6IHdvcmRBdFBvc2l0aW9uLndvcmQuc3Vic3RyKDAsIHBvc2l0aW9uLmNvbHVtbiAtIHdvcmRBdFBvc2l0aW9uLnN0YXJ0Q29sdW1uKSxcblx0XHRcdHN0YXJ0Q29sdW1uOiB3b3JkQXRQb3NpdGlvbi5zdGFydENvbHVtbixcblx0XHRcdGVuZENvbHVtbjogcG9zaXRpb24uY29sdW1uLFxuXHRcdH07XG5cdH1cblxuXHQvLyAjZW5kcmVnaW9uXG5cblx0Ly8gI3JlZ2lvbiBMYW5ndWFnZSBJZCBoYW5kbGluZ1xuXG5cdHB1YmxpYyBnZXRMYW5ndWFnZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2xhbmd1YWdlSWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGFuZ3VhZ2VJZEF0UG9zaXRpb24obGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlcik6IHN0cmluZyB7XG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl90ZXh0TW9kZWwudmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKSk7XG5cdFx0Y29uc3QgbGluZVRva2VucyA9IHRoaXMuZ2V0TGluZVRva2Vucyhwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gbGluZVRva2Vucy5nZXRMYW5ndWFnZUlkKGxpbmVUb2tlbnMuZmluZFRva2VuSW5kZXhBdE9mZnNldChwb3NpdGlvbi5jb2x1bW4gLSAxKSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0TGFuZ3VhZ2VJZChsYW5ndWFnZUlkOiBzdHJpbmcsIHNvdXJjZTogc3RyaW5nID0gJ2FwaScpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fbGFuZ3VhZ2VJZCA9PT0gbGFuZ3VhZ2VJZCkge1xuXHRcdFx0Ly8gVGhlcmUncyBub3RoaW5nIHRvIGRvXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZTogSU1vZGVsTGFuZ3VhZ2VDaGFuZ2VkRXZlbnQgPSB7XG5cdFx0XHRvbGRMYW5ndWFnZTogdGhpcy5fbGFuZ3VhZ2VJZCxcblx0XHRcdG5ld0xhbmd1YWdlOiBsYW5ndWFnZUlkLFxuXHRcdFx0c291cmNlXG5cdFx0fTtcblxuXHRcdHRoaXMuX2xhbmd1YWdlSWQgPSBsYW5ndWFnZUlkO1xuXG5cdFx0dGhpcy5fYnJhY2tldFBhaXJzVGV4dE1vZGVsUGFydC5oYW5kbGVEaWRDaGFuZ2VMYW5ndWFnZShlKTtcblx0XHR0aGlzLl90b2tlbnMucmVzZXRUb2tlbml6YXRpb24oKTtcblx0XHR0aGlzLmNyZWF0ZVByZWZlcnJlZFRva2VuUHJvdmlkZXIoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUxhbmd1YWdlLmZpcmUoZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VMYW5ndWFnZUNvbmZpZ3VyYXRpb24uZmlyZSh7fSk7XG5cdH1cblxuXHQvLyAjZW5kcmVnaW9uXG59XG5cbmNsYXNzIEdyYW1tYXJUb2tlbnMgZXh0ZW5kcyBBYnN0cmFjdFRva2VucyB7XG5cdHByaXZhdGUgX3Rva2VuaXplcjogVG9rZW5pemVyV2l0aFN0YXRlU3RvcmVBbmRUZXh0TW9kZWwgfCBudWxsID0gbnVsbDtcblx0cHJvdGVjdGVkIF9iYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RhdGU6IEJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZSA9IEJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZS5JblByb2dyZXNzO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQmFja2dyb3VuZFRva2VuaXphdGlvblN0YXRlOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIF9kZWZhdWx0QmFja2dyb3VuZFRva2VuaXplcjogRGVmYXVsdEJhY2tncm91bmRUb2tlbml6ZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfYmFja2dyb3VuZFRva2VuaXplciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJQmFja2dyb3VuZFRva2VuaXplcj4oKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW5zID0gbmV3IENvbnRpZ3VvdXNUb2tlbnNTdG9yZSh0aGlzLl9sYW5ndWFnZUlkQ29kZWMpO1xuXHRwcml2YXRlIF9kZWJ1Z0JhY2tncm91bmRUb2tlbnM6IENvbnRpZ3VvdXNUb2tlbnNTdG9yZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZGVidWdCYWNrZ3JvdW5kU3RhdGVzOiBUcmFja2luZ1Rva2VuaXphdGlvblN0YXRlU3RvcmU8SVN0YXRlPiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z0JhY2tncm91bmRUb2tlbml6ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SUJhY2tncm91bmRUb2tlbml6ZXI+KCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2F0dGFjaGVkVmlld1N0YXRlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPElBdHRhY2hlZFZpZXcsIEF0dGFjaGVkVmlld0hhbmRsZXI+KCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGxhbmd1YWdlSWRDb2RlYzogSUxhbmd1YWdlSWRDb2RlYyxcblx0XHR0ZXh0TW9kZWw6IFRleHRNb2RlbCxcblx0XHRnZXRMYW5ndWFnZUlkOiAoKSA9PiBzdHJpbmcsXG5cdFx0YXR0YWNoZWRWaWV3czogQXR0YWNoZWRWaWV3cyxcblx0KSB7XG5cdFx0c3VwZXIobGFuZ3VhZ2VJZENvZGVjLCB0ZXh0TW9kZWwsIGdldExhbmd1YWdlSWQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoVG9rZW5pemF0aW9uUmVnaXN0cnkub25EaWRDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSB0aGlzLmdldExhbmd1YWdlSWQoKTtcblx0XHRcdGlmIChlLmNoYW5nZWRMYW5ndWFnZXMuaW5kZXhPZihsYW5ndWFnZUlkKSA9PT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZXNldFRva2VuaXphdGlvbigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMucmVzZXRUb2tlbml6YXRpb24oKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF0dGFjaGVkVmlld3Mub25EaWRDaGFuZ2VWaXNpYmxlUmFuZ2VzKCh7IHZpZXcsIHN0YXRlIH0pID0+IHtcblx0XHRcdGlmIChzdGF0ZSkge1xuXHRcdFx0XHRsZXQgZXhpc3RpbmcgPSB0aGlzLl9hdHRhY2hlZFZpZXdTdGF0ZXMuZ2V0KHZpZXcpO1xuXHRcdFx0XHRpZiAoIWV4aXN0aW5nKSB7XG5cdFx0XHRcdFx0ZXhpc3RpbmcgPSBuZXcgQXR0YWNoZWRWaWV3SGFuZGxlcigoKSA9PiB0aGlzLnJlZnJlc2hSYW5nZXMoZXhpc3RpbmchLmxpbmVSYW5nZXMpKTtcblx0XHRcdFx0XHR0aGlzLl9hdHRhY2hlZFZpZXdTdGF0ZXMuc2V0KHZpZXcsIGV4aXN0aW5nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRleGlzdGluZy5oYW5kbGVTdGF0ZUNoYW5nZShzdGF0ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9hdHRhY2hlZFZpZXdTdGF0ZXMuZGVsZXRlQW5kRGlzcG9zZSh2aWV3KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgcmVzZXRUb2tlbml6YXRpb24oZmlyZVRva2VuQ2hhbmdlRXZlbnQ6IGJvb2xlYW4gPSB0cnVlKTogdm9pZCB7XG5cdFx0dGhpcy5fdG9rZW5zLmZsdXNoKCk7XG5cdFx0dGhpcy5fZGVidWdCYWNrZ3JvdW5kVG9rZW5zPy5mbHVzaCgpO1xuXHRcdGlmICh0aGlzLl9kZWJ1Z0JhY2tncm91bmRTdGF0ZXMpIHtcblx0XHRcdHRoaXMuX2RlYnVnQmFja2dyb3VuZFN0YXRlcyA9IG5ldyBUcmFja2luZ1Rva2VuaXphdGlvblN0YXRlU3RvcmUodGhpcy5fdGV4dE1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHR9XG5cdFx0aWYgKGZpcmVUb2tlbkNoYW5nZUV2ZW50KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVRva2Vucy5maXJlKHtcblx0XHRcdFx0c2VtYW50aWNUb2tlbnNBcHBsaWVkOiBmYWxzZSxcblx0XHRcdFx0cmFuZ2VzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZnJvbUxpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdFx0XHR0b0xpbmVOdW1iZXI6IHRoaXMuX3RleHRNb2RlbC5nZXRMaW5lQ291bnQoKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5pdGlhbGl6ZVRva2VuaXphdGlvbiA9ICgpOiBbSVRva2VuaXphdGlvblN1cHBvcnQsIElTdGF0ZV0gfCBbbnVsbCwgbnVsbF0gPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3RleHRNb2RlbC5pc1Rvb0xhcmdlRm9yVG9rZW5pemF0aW9uKCkpIHtcblx0XHRcdFx0cmV0dXJuIFtudWxsLCBudWxsXTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHRva2VuaXphdGlvblN1cHBvcnQgPSBUb2tlbml6YXRpb25SZWdpc3RyeS5nZXQodGhpcy5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdFx0aWYgKCF0b2tlbml6YXRpb25TdXBwb3J0KSB7XG5cdFx0XHRcdHJldHVybiBbbnVsbCwgbnVsbF07XG5cdFx0XHR9XG5cdFx0XHRsZXQgaW5pdGlhbFN0YXRlOiBJU3RhdGU7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpbml0aWFsU3RhdGUgPSB0b2tlbml6YXRpb25TdXBwb3J0LmdldEluaXRpYWxTdGF0ZSgpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlKTtcblx0XHRcdFx0cmV0dXJuIFtudWxsLCBudWxsXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBbdG9rZW5pemF0aW9uU3VwcG9ydCwgaW5pdGlhbFN0YXRlXTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgW3Rva2VuaXphdGlvblN1cHBvcnQsIGluaXRpYWxTdGF0ZV0gPSBpbml0aWFsaXplVG9rZW5pemF0aW9uKCk7XG5cdFx0aWYgKHRva2VuaXphdGlvblN1cHBvcnQgJiYgaW5pdGlhbFN0YXRlKSB7XG5cdFx0XHR0aGlzLl90b2tlbml6ZXIgPSBuZXcgVG9rZW5pemVyV2l0aFN0YXRlU3RvcmVBbmRUZXh0TW9kZWwodGhpcy5fdGV4dE1vZGVsLmdldExpbmVDb3VudCgpLCB0b2tlbml6YXRpb25TdXBwb3J0LCB0aGlzLl90ZXh0TW9kZWwsIHRoaXMuX2xhbmd1YWdlSWRDb2RlYyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3Rva2VuaXplciA9IG51bGw7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYmFja2dyb3VuZFRva2VuaXplci5jbGVhcigpO1xuXG5cdFx0dGhpcy5fZGVmYXVsdEJhY2tncm91bmRUb2tlbml6ZXIgPSBudWxsO1xuXHRcdGlmICh0aGlzLl90b2tlbml6ZXIpIHtcblx0XHRcdGNvbnN0IGI6IElCYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RvcmUgPSB7XG5cdFx0XHRcdHNldFRva2VuczogKHRva2VucykgPT4ge1xuXHRcdFx0XHRcdHRoaXMuc2V0VG9rZW5zKHRva2Vucyk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJhY2tncm91bmRUb2tlbml6YXRpb25GaW5pc2hlZDogKCkgPT4ge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9iYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RhdGUgPT09IEJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZS5Db21wbGV0ZWQpIHtcblx0XHRcdFx0XHRcdC8vIFdlIGFscmVhZHkgZGlkIGEgZnVsbCB0b2tlbml6YXRpb24gYW5kIGRvbid0IGdvIGJhY2sgdG8gcHJvZ3Jlc3NpbmcuXG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IG5ld1N0YXRlID0gQmFja2dyb3VuZFRva2VuaXphdGlvblN0YXRlLkNvbXBsZXRlZDtcblx0XHRcdFx0XHR0aGlzLl9iYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RhdGUgPSBuZXdTdGF0ZTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZS5maXJlKCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNldEVuZFN0YXRlOiAobGluZU51bWJlciwgc3RhdGUpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuX3Rva2VuaXplcikgeyByZXR1cm47IH1cblx0XHRcdFx0XHRjb25zdCBmaXJzdEludmFsaWRFbmRTdGF0ZUxpbmVOdW1iZXIgPSB0aGlzLl90b2tlbml6ZXIuc3RvcmUuZ2V0Rmlyc3RJbnZhbGlkRW5kU3RhdGVMaW5lTnVtYmVyKCk7XG5cdFx0XHRcdFx0Ly8gRG9uJ3QgYWNjZXB0IHN0YXRlcyBmb3IgZGVmaW5pdGVseSB2YWxpZCBzdGF0ZXMsIHRoZSByZW5kZXJlciBpcyBhaGVhZCBvZiB0aGUgd29ya2VyIVxuXHRcdFx0XHRcdGlmIChmaXJzdEludmFsaWRFbmRTdGF0ZUxpbmVOdW1iZXIgIT09IG51bGwgJiYgbGluZU51bWJlciA+PSBmaXJzdEludmFsaWRFbmRTdGF0ZUxpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Rva2VuaXplcj8uc3RvcmUuc2V0RW5kU3RhdGUobGluZU51bWJlciwgc3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH07XG5cblx0XHRcdGlmICh0b2tlbml6YXRpb25TdXBwb3J0ICYmIHRva2VuaXphdGlvblN1cHBvcnQuY3JlYXRlQmFja2dyb3VuZFRva2VuaXplciAmJiAhdG9rZW5pemF0aW9uU3VwcG9ydC5iYWNrZ3JvdW5kVG9rZW5pemVyU2hvdWxkT25seVZlcmlmeVRva2Vucykge1xuXHRcdFx0XHR0aGlzLl9iYWNrZ3JvdW5kVG9rZW5pemVyLnZhbHVlID0gdG9rZW5pemF0aW9uU3VwcG9ydC5jcmVhdGVCYWNrZ3JvdW5kVG9rZW5pemVyKHRoaXMuX3RleHRNb2RlbCwgYik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuX2JhY2tncm91bmRUb2tlbml6ZXIudmFsdWUgJiYgIXRoaXMuX3RleHRNb2RlbC5pc1Rvb0xhcmdlRm9yVG9rZW5pemF0aW9uKCkpIHtcblx0XHRcdFx0dGhpcy5fYmFja2dyb3VuZFRva2VuaXplci52YWx1ZSA9IHRoaXMuX2RlZmF1bHRCYWNrZ3JvdW5kVG9rZW5pemVyID1cblx0XHRcdFx0XHRuZXcgRGVmYXVsdEJhY2tncm91bmRUb2tlbml6ZXIodGhpcy5fdG9rZW5pemVyLCBiKTtcblx0XHRcdFx0dGhpcy5fZGVmYXVsdEJhY2tncm91bmRUb2tlbml6ZXIuaGFuZGxlQ2hhbmdlcygpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodG9rZW5pemF0aW9uU3VwcG9ydD8uYmFja2dyb3VuZFRva2VuaXplclNob3VsZE9ubHlWZXJpZnlUb2tlbnMgJiYgdG9rZW5pemF0aW9uU3VwcG9ydC5jcmVhdGVCYWNrZ3JvdW5kVG9rZW5pemVyKSB7XG5cdFx0XHRcdHRoaXMuX2RlYnVnQmFja2dyb3VuZFRva2VucyA9IG5ldyBDb250aWd1b3VzVG9rZW5zU3RvcmUodGhpcy5fbGFuZ3VhZ2VJZENvZGVjKTtcblx0XHRcdFx0dGhpcy5fZGVidWdCYWNrZ3JvdW5kU3RhdGVzID0gbmV3IFRyYWNraW5nVG9rZW5pemF0aW9uU3RhdGVTdG9yZSh0aGlzLl90ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0XHR0aGlzLl9kZWJ1Z0JhY2tncm91bmRUb2tlbml6ZXIuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5fZGVidWdCYWNrZ3JvdW5kVG9rZW5pemVyLnZhbHVlID0gdG9rZW5pemF0aW9uU3VwcG9ydC5jcmVhdGVCYWNrZ3JvdW5kVG9rZW5pemVyKHRoaXMuX3RleHRNb2RlbCwge1xuXHRcdFx0XHRcdHNldFRva2VuczogKHRva2VucykgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5fZGVidWdCYWNrZ3JvdW5kVG9rZW5zPy5zZXRNdWx0aWxpbmVUb2tlbnModG9rZW5zLCB0aGlzLl90ZXh0TW9kZWwpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YmFja2dyb3VuZFRva2VuaXphdGlvbkZpbmlzaGVkKCkge1xuXHRcdFx0XHRcdFx0Ly8gTk8gT1Bcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHNldEVuZFN0YXRlOiAobGluZU51bWJlciwgc3RhdGUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuX2RlYnVnQmFja2dyb3VuZFN0YXRlcz8uc2V0RW5kU3RhdGUobGluZU51bWJlciwgc3RhdGUpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fZGVidWdCYWNrZ3JvdW5kVG9rZW5zID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9kZWJ1Z0JhY2tncm91bmRTdGF0ZXMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX2RlYnVnQmFja2dyb3VuZFRva2VuaXplci52YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnJlZnJlc2hBbGxWaXNpYmxlTGluZVRva2VucygpO1xuXHR9XG5cblx0cHVibGljIGhhbmRsZURpZENoYW5nZUF0dGFjaGVkKCkge1xuXHRcdHRoaXMuX2RlZmF1bHRCYWNrZ3JvdW5kVG9rZW5pemVyPy5oYW5kbGVDaGFuZ2VzKCk7XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlRGlkQ2hhbmdlQ29udGVudChlOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuaXNGbHVzaCkge1xuXHRcdFx0Ly8gRG9uJ3QgZmlyZSB0aGUgZXZlbnQsIGFzIHRoZSB2aWV3IG1pZ2h0IG5vdCBoYXZlIGdvdCB0aGUgdGV4dCBjaGFuZ2UgZXZlbnQgeWV0XG5cdFx0XHR0aGlzLnJlc2V0VG9rZW5pemF0aW9uKGZhbHNlKTtcblx0XHR9IGVsc2UgaWYgKCFlLmlzRW9sQ2hhbmdlKSB7IC8vIFdlIGRvbid0IGhhdmUgdG8gZG8gYW55dGhpbmcgb24gYW4gRU9MIGNoYW5nZVxuXHRcdFx0Zm9yIChjb25zdCBjIG9mIGUuY2hhbmdlcykge1xuXHRcdFx0XHRjb25zdCBbZW9sQ291bnQsIGZpcnN0TGluZUxlbmd0aF0gPSBjb3VudEVPTChjLnRleHQpO1xuXG5cdFx0XHRcdHRoaXMuX3Rva2Vucy5hY2NlcHRFZGl0KGMucmFuZ2UsIGVvbENvdW50LCBmaXJzdExpbmVMZW5ndGgpO1xuXHRcdFx0XHR0aGlzLl9kZWJ1Z0JhY2tncm91bmRUb2tlbnM/LmFjY2VwdEVkaXQoYy5yYW5nZSwgZW9sQ291bnQsIGZpcnN0TGluZUxlbmd0aCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kZWJ1Z0JhY2tncm91bmRTdGF0ZXM/LmFjY2VwdENoYW5nZXMoZS5jaGFuZ2VzKTtcblxuXHRcdFx0aWYgKHRoaXMuX3Rva2VuaXplcikge1xuXHRcdFx0XHR0aGlzLl90b2tlbml6ZXIuc3RvcmUuYWNjZXB0Q2hhbmdlcyhlLmNoYW5nZXMpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fZGVmYXVsdEJhY2tncm91bmRUb2tlbml6ZXI/LmhhbmRsZUNoYW5nZXMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldFRva2Vucyh0b2tlbnM6IENvbnRpZ3VvdXNNdWx0aWxpbmVUb2tlbnNbXSk6IHsgY2hhbmdlczogeyBmcm9tTGluZU51bWJlcjogbnVtYmVyOyB0b0xpbmVOdW1iZXI6IG51bWJlciB9W10gfSB7XG5cdFx0Y29uc3QgeyBjaGFuZ2VzIH0gPSB0aGlzLl90b2tlbnMuc2V0TXVsdGlsaW5lVG9rZW5zKHRva2VucywgdGhpcy5fdGV4dE1vZGVsKTtcblxuXHRcdGlmIChjaGFuZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVG9rZW5zLmZpcmUoeyBzZW1hbnRpY1Rva2Vuc0FwcGxpZWQ6IGZhbHNlLCByYW5nZXM6IGNoYW5nZXMsIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGNoYW5nZXM6IGNoYW5nZXMgfTtcblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaEFsbFZpc2libGVMaW5lVG9rZW5zKCk6IHZvaWQge1xuXHRcdGNvbnN0IHJhbmdlcyA9IExpbmVSYW5nZS5qb2luTWFueShbLi4udGhpcy5fYXR0YWNoZWRWaWV3U3RhdGVzXS5tYXAoKFtfLCBzXSkgPT4gcy5saW5lUmFuZ2VzKSk7XG5cdFx0dGhpcy5yZWZyZXNoUmFuZ2VzKHJhbmdlcyk7XG5cdH1cblxuXHRwcml2YXRlIHJlZnJlc2hSYW5nZXMocmFuZ2VzOiByZWFkb25seSBMaW5lUmFuZ2VbXSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgcmFuZ2VzKSB7XG5cdFx0XHR0aGlzLnJlZnJlc2hSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZnJlc2hSYW5nZShzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90b2tlbml6ZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzdGFydExpbmVOdW1iZXIgPSBNYXRoLm1heCgxLCBNYXRoLm1pbih0aGlzLl90ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCksIHN0YXJ0TGluZU51bWJlcikpO1xuXHRcdGVuZExpbmVOdW1iZXIgPSBNYXRoLm1pbih0aGlzLl90ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCksIGVuZExpbmVOdW1iZXIpO1xuXG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb250aWd1b3VzTXVsdGlsaW5lVG9rZW5zQnVpbGRlcigpO1xuXHRcdGNvbnN0IHsgaGV1cmlzdGljVG9rZW5zIH0gPSB0aGlzLl90b2tlbml6ZXIudG9rZW5pemVIZXVyaXN0aWNhbGx5KGJ1aWxkZXIsIHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlcik7XG5cdFx0Y29uc3QgY2hhbmdlZFRva2VucyA9IHRoaXMuc2V0VG9rZW5zKGJ1aWxkZXIuZmluYWxpemUoKSk7XG5cblx0XHRpZiAoaGV1cmlzdGljVG9rZW5zKSB7XG5cdFx0XHQvLyBXZSBvdmVycm9kZSB0b2tlbnMgd2l0aCBoZXVyaXN0aWNhbGx5IGNvbXB1dGVkIG9uZXMuXG5cdFx0XHQvLyBCZWNhdXNlIG9sZCBzdGF0ZXMgbWlnaHQgZ2V0IHJldXNlZCAodGh1cyBzdG9wcGluZyBpbnZhbGlkYXRpb24pLFxuXHRcdFx0Ly8gd2UgaGF2ZSB0byBleHBsaWNpdGx5IHJlcXVlc3QgdGhlIHRva2VucyBmb3IgdGhlIGNoYW5nZWQgcmFuZ2VzIGFnYWluLlxuXHRcdFx0Zm9yIChjb25zdCBjIG9mIGNoYW5nZWRUb2tlbnMuY2hhbmdlcykge1xuXHRcdFx0XHR0aGlzLl9iYWNrZ3JvdW5kVG9rZW5pemVyLnZhbHVlPy5yZXF1ZXN0VG9rZW5zKGMuZnJvbUxpbmVOdW1iZXIsIGMudG9MaW5lTnVtYmVyICsgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGVmYXVsdEJhY2tncm91bmRUb2tlbml6ZXI/LmNoZWNrRmluaXNoZWQoKTtcblx0fVxuXG5cdHB1YmxpYyBmb3JjZVRva2VuaXphdGlvbihsaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbnRpZ3VvdXNNdWx0aWxpbmVUb2tlbnNCdWlsZGVyKCk7XG5cdFx0dGhpcy5fdG9rZW5pemVyPy51cGRhdGVUb2tlbnNVbnRpbExpbmUoYnVpbGRlciwgbGluZU51bWJlcik7XG5cdFx0dGhpcy5zZXRUb2tlbnMoYnVpbGRlci5maW5hbGl6ZSgpKTtcblx0XHR0aGlzLl9kZWZhdWx0QmFja2dyb3VuZFRva2VuaXplcj8uY2hlY2tGaW5pc2hlZCgpO1xuXHR9XG5cblx0cHVibGljIGhhc0FjY3VyYXRlVG9rZW5zRm9yTGluZShsaW5lTnVtYmVyOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX3Rva2VuaXplcikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90b2tlbml6ZXIuaGFzQWNjdXJhdGVUb2tlbnNGb3JMaW5lKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGlzQ2hlYXBUb1Rva2VuaXplKGxpbmVOdW1iZXI6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fdG9rZW5pemVyKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2VuaXplci5pc0NoZWFwVG9Ub2tlbml6ZShsaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lVG9rZW5zKGxpbmVOdW1iZXI6IG51bWJlcik6IExpbmVUb2tlbnMge1xuXHRcdGNvbnN0IGxpbmVUZXh0ID0gdGhpcy5fdGV4dE1vZGVsLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX3Rva2Vucy5nZXRUb2tlbnMoXG5cdFx0XHR0aGlzLl90ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLFxuXHRcdFx0bGluZU51bWJlciAtIDEsXG5cdFx0XHRsaW5lVGV4dFxuXHRcdCk7XG5cdFx0aWYgKHRoaXMuX2RlYnVnQmFja2dyb3VuZFRva2VucyAmJiB0aGlzLl9kZWJ1Z0JhY2tncm91bmRTdGF0ZXMgJiYgdGhpcy5fdG9rZW5pemVyKSB7XG5cdFx0XHRpZiAodGhpcy5fZGVidWdCYWNrZ3JvdW5kU3RhdGVzLmdldEZpcnN0SW52YWxpZEVuZFN0YXRlTGluZU51bWJlck9yTWF4KCkgPiBsaW5lTnVtYmVyICYmIHRoaXMuX3Rva2VuaXplci5zdG9yZS5nZXRGaXJzdEludmFsaWRFbmRTdGF0ZUxpbmVOdW1iZXJPck1heCgpID4gbGluZU51bWJlcikge1xuXHRcdFx0XHRjb25zdCBiYWNrZ3JvdW5kUmVzdWx0ID0gdGhpcy5fZGVidWdCYWNrZ3JvdW5kVG9rZW5zLmdldFRva2Vucyhcblx0XHRcdFx0XHR0aGlzLl90ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLFxuXHRcdFx0XHRcdGxpbmVOdW1iZXIgLSAxLFxuXHRcdFx0XHRcdGxpbmVUZXh0XG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmICghcmVzdWx0LmVxdWFscyhiYWNrZ3JvdW5kUmVzdWx0KSAmJiB0aGlzLl9kZWJ1Z0JhY2tncm91bmRUb2tlbml6ZXIudmFsdWU/LnJlcG9ydE1pc21hdGNoaW5nVG9rZW5zKSB7XG5cdFx0XHRcdFx0dGhpcy5fZGVidWdCYWNrZ3JvdW5kVG9rZW5pemVyLnZhbHVlLnJlcG9ydE1pc21hdGNoaW5nVG9rZW5zKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VG9rZW5UeXBlSWZJbnNlcnRpbmdDaGFyYWN0ZXIobGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlciwgY2hhcmFjdGVyOiBzdHJpbmcpOiBTdGFuZGFyZFRva2VuVHlwZSB7XG5cdFx0aWYgKCF0aGlzLl90b2tlbml6ZXIpIHtcblx0XHRcdHJldHVybiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlcjtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX3RleHRNb2RlbC52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pKTtcblx0XHR0aGlzLmZvcmNlVG9rZW5pemF0aW9uKHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdHJldHVybiB0aGlzLl90b2tlbml6ZXIuZ2V0VG9rZW5UeXBlSWZJbnNlcnRpbmdDaGFyYWN0ZXIocG9zaXRpb24sIGNoYXJhY3Rlcik7XG5cdH1cblxuXG5cdHB1YmxpYyB0b2tlbml6ZUxpbmVzQXQobGluZU51bWJlcjogbnVtYmVyLCBsaW5lczogc3RyaW5nW10pOiBMaW5lVG9rZW5zW10gfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX3Rva2VuaXplcikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHRoaXMuZm9yY2VUb2tlbml6YXRpb24obGluZU51bWJlcik7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2VuaXplci50b2tlbml6ZUxpbmVzQXQobGluZU51bWJlciwgbGluZXMpO1xuXHR9XG5cblx0cHVibGljIGdldCBoYXNUb2tlbnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rva2Vucy5oYXNUb2tlbnM7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBb0IseUJBQXlCO0FBQ3RELFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsZUFBZSxpQkFBaUIseUJBQXlCO0FBQ2xFLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQW9CLGdCQUFnQjtBQUVwQyxTQUEwQixxQkFBcUI7QUFDL0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBNkcsc0JBQXNCLHNDQUFzQztBQUN6SyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFDQUE2RztBQUl0SCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDRCQUE0QixxQ0FBcUMsc0NBQXNDO0FBQ2hILFNBQVMsZ0JBQWdCLDJCQUEwQztBQUNuRSxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLG1DQUErRDtBQUV4RSxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLDZCQUE2QjtBQUd0QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUE2QjtBQUUvQixJQUFNLDRCQUFOLGNBQXdDLGNBQW9EO0FBQUEsRUFlbEcsWUFDa0IsWUFDQSw0QkFDVCxhQUNTLGdCQUNrQixrQkFDYSwrQkFDUix1QkFDdkM7QUFDRCxVQUFNO0FBUlc7QUFDQTtBQUNUO0FBQ1M7QUFDa0I7QUFDYTtBQUNSO0FBckJ6QyxTQUFpQixrQkFBcUMsSUFBSSxrQkFBa0IsS0FBSyxp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
