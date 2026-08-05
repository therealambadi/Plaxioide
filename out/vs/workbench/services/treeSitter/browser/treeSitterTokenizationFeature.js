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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import { FileAccess } from "../../../../base/common/network.js";
import { LazyTokenizationSupport, TreeSitterTokenizationRegistry } from "../../../../editor/common/languages.js";
import { EDITOR_EXPERIMENTAL_PREFER_TREESITTER, ITreeSitterParserService, ITreeSitterImporter, TREESITTER_ALLOWED_SUPPORT } from "../../../../editor/common/services/treeSitterParserService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { findMetadata } from "../../themes/common/colorThemeData.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { ITreeSitterTokenizationStoreService } from "../../../../editor/common/model/treeSitterTokenStoreService.js";
import { TokenQuality } from "../../../../editor/common/model/tokenStore.js";
import { Range } from "../../../../editor/common/core/range.js";
import { setTimeout0 } from "../../../../base/common/platform.js";
import { findLikelyRelevantLines } from "../../../../editor/common/model/textModelTokens.js";
import { TreeSitterCodeEditors } from "./treeSitterCodeEditors.js";
import { IWorkbenchThemeService } from "../../themes/common/workbenchThemeService.js";
import { Position } from "../../../../editor/common/core/position.js";
const ITreeSitterTokenizationFeature = createDecorator("treeSitterTokenizationFeature");
const TREESITTER_BASE_SCOPES = {
  "css": "source.css",
  "typescript": "source.ts",
  "ini": "source.ini",
  "regex": "source.regex"
};
const BRACKETS = /[\{\}\[\]\<\>\(\)]/g;
let TreeSitterTokenizationFeature = class extends Disposable {
  constructor(_treeSitterImporter, _languageService, _configurationService, _instantiationService, _fileService) {
    super();
    this._treeSitterImporter = _treeSitterImporter;
    this._languageService = _languageService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._fileService = _fileService;
    this._tokenizersRegistrations = this._register(new DisposableMap());
    this._handleGrammarsExtPoint();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(EDITOR_EXPERIMENTAL_PREFER_TREESITTER)) {
        this._handleGrammarsExtPoint();
      }
    }));
  }
  _getSetting(languageId) {
    return this._configurationService.getValue(`${EDITOR_EXPERIMENTAL_PREFER_TREESITTER}.${languageId}`);
  }
  _handleGrammarsExtPoint() {
    for (const languageId of TREESITTER_ALLOWED_SUPPORT) {
      const setting = this._getSetting(languageId);
      if (setting && !this._tokenizersRegistrations.has(languageId)) {
        const lazyTokenizationSupport = new LazyTokenizationSupport(() => this._createTokenizationSupport(languageId));
        const disposableStore = new DisposableStore();
        disposableStore.add(lazyTokenizationSupport);
        disposableStore.add(TreeSitterTokenizationRegistry.registerFactory(languageId, lazyTokenizationSupport));
        this._tokenizersRegistrations.set(languageId, disposableStore);
        TreeSitterTokenizationRegistry.getOrCreate(languageId);
      }
    }
    const languagesToUnregister = [...this._tokenizersRegistrations.keys()].filter((languageId) => !this._getSetting(languageId));
    for (const languageId of languagesToUnregister) {
      this._tokenizersRegistrations.deleteAndDispose(languageId);
    }
  }
  async _fetchQueries(newLanguage) {
    const languageLocation = `vs/editor/common/languages/highlights/${newLanguage}.scm`;
    const query = await this._fileService.readFile(FileAccess.asFileUri(languageLocation));
    return query.value.toString();
  }
  async _createTokenizationSupport(languageId) {
    const queries = await this._fetchQueries(languageId);
    const Query = await this._treeSitterImporter.getQueryClass();
    return this._instantiationService.createInstance(TreeSitterTokenizationSupport, queries, Query, languageId, this._languageService.languageIdCodec);
  }
};
TreeSitterTokenizationFeature = __decorateClass([
  __decorateParam(0, ITreeSitterImporter),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IFileService)
], TreeSitterTokenizationFeature);
let TreeSitterTokenizationSupport = class extends Disposable {
  constructor(_queries, Query, _languageId, _languageIdCodec, _treeSitterService, _themeService, _tokenizationStoreService, _instantiationService) {
    super();
    this._queries = _queries;
    this.Query = Query;
    this._languageId = _languageId;
    this._languageIdCodec = _languageIdCodec;
    this._treeSitterService = _treeSitterService;
    this._themeService = _themeService;
    this._tokenizationStoreService = _tokenizationStoreService;
    this._instantiationService = _instantiationService;
    this._onDidChangeTokens = this._register(new Emitter());
    this.onDidChangeTokens = this._onDidChangeTokens.event;
    this._onDidCompleteBackgroundTokenization = this._register(new Emitter());
    this.onDidChangeBackgroundTokenization = this._onDidCompleteBackgroundTokenization.event;
    this._codeEditors = this._instantiationService.createInstance(TreeSitterCodeEditors, this._languageId);
    this._register(this._codeEditors.onDidChangeViewport((e) => {
      this._parseAndTokenizeViewPort(e.model, e.ranges);
    }));
    this._codeEditors.getInitialViewPorts().then(async (viewports) => {
      for (const viewport of viewports) {
        this._parseAndTokenizeViewPort(viewport.model, viewport.ranges);
      }
    });
    this._register(Event.runAndSubscribe(this._themeService.onDidColorThemeChange, (e) => this._updateTheme(e)));
    this._register(this._treeSitterService.onDidUpdateTree((e) => {
      if (e.languageId !== this._languageId) {
        return;
      }
      if (this._tokenizationStoreService.hasTokens(e.textModel)) {
        for (const range of e.ranges) {
          this._tokenizationStoreService.markForRefresh(e.textModel, range.newRange);
        }
      }
      if (e.versionId !== e.textModel.getVersionId()) {
        return;
      }
      if (!this._tokenizationStoreService.hasTokens(e.textModel)) {
        this._firstTreeUpdate(e.textModel, e.versionId, e.tree);
      } else {
        this._handleTreeUpdate(e.ranges, e.textModel, e.versionId, e.tree);
      }
    }));
  }
  get _encodedLanguageId() {
    if (!this._encodedLanguage) {
      this._encodedLanguage = this._languageIdCodec.encodeLanguageId(this._languageId);
    }
    return this._encodedLanguage;
  }
  _setInitialTokens(textModel) {
    const tokens = this._createEmptyTokens(textModel);
    this._tokenizationStoreService.setTokens(textModel, tokens, TokenQuality.None);
  }
  _forceParseAndTokenizeContent(model, range, startOffsetOfRangeInDocument, endOffsetOfRangeInDocument, content, asUpdate) {
    const likelyRelevantLines = findLikelyRelevantLines(model, range.startLineNumber).likelyRelevantLines;
    const likelyRelevantPrefix = likelyRelevantLines.join(model.getEOL());
    const tree = this._treeSitterService.getTreeSync(`${likelyRelevantPrefix}${content}`, this._languageId);
    if (!tree) {
      return;
    }
    const treeRange = new Range(1, 1, range.endLineNumber - range.startLineNumber + 1 + likelyRelevantLines.length, range.endColumn);
    const captures = this._captureAtRange(treeRange, tree);
    const tokens = this._tokenizeCapturesWithMetadata(tree, captures, likelyRelevantPrefix.length, endOffsetOfRangeInDocument - startOffsetOfRangeInDocument + likelyRelevantPrefix.length);
    if (!tokens) {
      return;
    }
    if (asUpdate) {
      return this._rangeTokensAsUpdates(startOffsetOfRangeInDocument, tokens.endOffsetsAndMetadata, likelyRelevantPrefix.length);
    } else {
      return tokens.endOffsetsAndMetadata;
    }
  }
  async _parseAndTokenizeViewPort(model, viewportRanges) {
    if (!this._tokenizationStoreService.hasTokens(model)) {
      this._setInitialTokens(model);
    }
    for (const range of viewportRanges) {
      const startOffsetOfRangeInDocument = model.getOffsetAt(range.getStartPosition());
      const endOffsetOfRangeInDocument = model.getOffsetAt(range.getEndPosition());
      const version = model.getVersionId();
      if (this._tokenizationStoreService.rangeHasTokens(model, range, TokenQuality.ViewportGuess)) {
        continue;
      }
      const content = model.getValueInRange(range);
      const tokenUpdates = await this._forceParseAndTokenizeContent(model, range, startOffsetOfRangeInDocument, endOffsetOfRangeInDocument, content, true);
      if (!tokenUpdates || this._tokenizationStoreService.rangeHasTokens(model, range, TokenQuality.ViewportGuess)) {
        continue;
      }
      if (tokenUpdates.length === 0) {
        continue;
      }
      const lastToken = tokenUpdates[tokenUpdates.length - 1];
      const oldRangeLength = lastToken.startOffsetInclusive + lastToken.length - tokenUpdates[0].startOffsetInclusive;
      this._tokenizationStoreService.updateTokens(model, version, [{ newTokens: tokenUpdates, oldRangeLength }], TokenQuality.ViewportGuess);
      this._onDidChangeTokens.fire({ textModel: model, changes: { semanticTokensApplied: false, ranges: [{ fromLineNumber: range.startLineNumber, toLineNumber: range.endLineNumber }] } });
    }
  }
  guessTokensForLinesContent(lineNumber, textModel, lines) {
    if (lines.length === 0) {
      return void 0;
    }
    const lineContent = lines.join(textModel.getEOL());
    const range = new Range(1, 1, lineNumber + lines.length, lines[lines.length - 1].length + 1);
    const startOffset = textModel.getOffsetAt({ lineNumber, column: 1 });
    const tokens = this._forceParseAndTokenizeContent(textModel, range, startOffset, startOffset + lineContent.length, lineContent, false);
    if (!tokens) {
      return void 0;
    }
    const tokensByLine = new Array(lines.length);
    let tokensIndex = 0;
    let tokenStartOffset = 0;
    let lineStartOffset = 0;
    for (let i = 0; i < lines.length; i++) {
      const tokensForLine = [];
      let moveToNextLine = false;
      for (let j = tokensIndex; !moveToNextLine && j < tokens.length; j++) {
        const token = tokens[j];
        const lineAdjustedEndOffset = token.endOffset - lineStartOffset;
        const lineAdjustedStartOffset = tokenStartOffset - lineStartOffset;
        if (lineAdjustedEndOffset <= lines[i].length) {
          tokensForLine.push({ endOffset: lineAdjustedEndOffset, metadata: token.metadata });
          tokensIndex++;
        } else if (lineAdjustedStartOffset < lines[i].length) {
          const partialToken = { endOffset: lines[i].length, metadata: token.metadata };
          tokensForLine.push(partialToken);
          moveToNextLine = true;
        } else {
          moveToNextLine = true;
        }
        tokenStartOffset = token.endOffset;
      }
      tokensByLine[i] = this._endOffsetTokensToUint32Array(tokensForLine);
      lineStartOffset += lines[i].length + textModel.getEOL().length;
    }
    return tokensByLine;
  }
  _emptyTokensForOffsetAndLength(offset, length, emptyToken) {
    return { token: emptyToken, length: offset + length, startOffsetInclusive: 0 };
  }
  _createEmptyTokens(textModel) {
    const emptyToken = this._emptyToken();
    const modelEndOffset = textModel.getValueLength();
    const emptyTokens = [this._emptyTokensForOffsetAndLength(0, modelEndOffset, emptyToken)];
    return emptyTokens;
  }
  _firstTreeUpdate(textModel, versionId, tree) {
    this._setInitialTokens(textModel);
    return this._setViewPortTokens(textModel, versionId, tree);
  }
  _setViewPortTokens(textModel, versionId, tree) {
    const maxLine = textModel.getLineCount();
    let rangeChanges;
    const editor = this._codeEditors.getEditorForModel(textModel);
    if (editor) {
      const viewPort = editor.getVisibleRangesPlusViewportAboveBelow();
      const ranges = new Array(viewPort.length);
      rangeChanges = new Array(viewPort.length);
      for (let i = 0; i < viewPort.length; i++) {
        const range = viewPort[i];
        ranges[i] = { fromLineNumber: range.startLineNumber, toLineNumber: range.endLineNumber < maxLine ? range.endLineNumber : maxLine };
        const newRangeStartOffset = textModel.getOffsetAt(range.getStartPosition());
        const newRangeEndOffset = textModel.getOffsetAt(range.getEndPosition());
        rangeChanges[i] = {
          newRange: range,
          newRangeStartOffset,
          newRangeEndOffset
        };
      }
    } else {
      const valueLength = textModel.getValueLength();
      rangeChanges = [{ newRange: new Range(1, 1, maxLine, textModel.getLineMaxColumn(maxLine)), newRangeStartOffset: 0, newRangeEndOffset: valueLength }];
    }
    return this._handleTreeUpdate(rangeChanges, textModel, versionId, tree);
  }
  /**
   * Do not await in this method, it will cause a race
   */
  _handleTreeUpdate(ranges, textModel, versionId, textModelTreeSitter) {
    const tree = textModelTreeSitter.parseResult?.tree;
    if (!tree) {
      return;
    }
    const rangeChanges = [];
    const chunkSize = 1e3;
    for (let i = 0; i < ranges.length; i++) {
      const rangeLinesLength = ranges[i].newRange.endLineNumber - ranges[i].newRange.startLineNumber;
      if (rangeLinesLength > chunkSize) {
        const fullRangeEndLineNumber = ranges[i].newRange.endLineNumber;
        let chunkLineStart = ranges[i].newRange.startLineNumber;
        let chunkColumnStart = ranges[i].newRange.startColumn;
        let chunkLineEnd = chunkLineStart + chunkSize;
        do {
          const chunkStartingPosition = new Position(chunkLineStart, chunkColumnStart);
          const chunkEndColumn = chunkLineEnd === ranges[i].newRange.endLineNumber ? ranges[i].newRange.endColumn : textModel.getLineMaxColumn(chunkLineEnd);
          const chunkEndPosition = new Position(chunkLineEnd, chunkEndColumn);
          const chunkRange = Range.fromPositions(chunkStartingPosition, chunkEndPosition);
          rangeChanges.push({
            range: chunkRange,
            startOffset: textModel.getOffsetAt(chunkRange.getStartPosition()),
            endOffset: textModel.getOffsetAt(chunkRange.getEndPosition())
          });
          chunkLineStart = chunkLineEnd + 1;
          chunkColumnStart = 1;
          if (chunkLineEnd < fullRangeEndLineNumber && chunkLineEnd + chunkSize > fullRangeEndLineNumber) {
            chunkLineEnd = fullRangeEndLineNumber;
          } else {
            chunkLineEnd = chunkLineEnd + chunkSize;
          }
        } while (chunkLineEnd <= fullRangeEndLineNumber);
      } else {
        if (i === 0 || rangeChanges[i - 1].endOffset < ranges[i].newRangeStartOffset) {
          rangeChanges.push({
            range: ranges[i].newRange,
            startOffset: ranges[i].newRangeStartOffset,
            endOffset: ranges[i].newRangeEndOffset
          });
        } else if (rangeChanges[i - 1].endOffset < ranges[i].newRangeEndOffset) {
          const startPosition = textModel.getPositionAt(rangeChanges[i - 1].endOffset + 1);
          const range = new Range(startPosition.lineNumber, startPosition.column, ranges[i].newRange.endLineNumber, ranges[i].newRange.endColumn);
          rangeChanges.push({
            range,
            startOffset: rangeChanges[i - 1].endOffset + 1,
            endOffset: ranges[i].newRangeEndOffset
          });
        }
      }
    }
    const captures = rangeChanges.map((range) => this._getCaptures(range.range, textModelTreeSitter, tree));
    return this._updateTreeForRanges(textModel, rangeChanges, versionId, tree, captures).then(() => {
      const tree2 = this._getTree(textModel);
      if (!textModel.isDisposed() && tree2?.parseResult?.versionId === textModel.getVersionId()) {
        this._refreshNeedsRefresh(textModel, versionId);
      }
    });
  }
  async _updateTreeForRanges(textModel, rangeChanges, versionId, tree, captures) {
    let tokenUpdate;
    for (let i = 0; i < rangeChanges.length; i++) {
      if (!textModel.isDisposed() && versionId !== textModel.getVersionId()) {
        break;
      }
      const capture = captures[i];
      const range = rangeChanges[i];
      const updates = this.getTokensInRange(textModel, range.range, range.startOffset, range.endOffset, tree, capture);
      if (updates) {
        tokenUpdate = { newTokens: updates };
      } else {
        tokenUpdate = { newTokens: [] };
      }
      this._tokenizationStoreService.updateTokens(textModel, versionId, [tokenUpdate], TokenQuality.Accurate);
      this._onDidChangeTokens.fire({
        textModel,
        changes: {
          semanticTokensApplied: false,
          ranges: [{ fromLineNumber: range.range.getStartPosition().lineNumber, toLineNumber: range.range.getEndPosition().lineNumber }]
        }
      });
      await new Promise((resolve) => setTimeout0(resolve));
    }
    this._onDidCompleteBackgroundTokenization.fire({ textModel });
  }
  _refreshNeedsRefresh(textModel, versionId) {
    const rangesToRefresh = this._tokenizationStoreService.getNeedsRefresh(textModel);
    if (rangesToRefresh.length === 0) {
      return;
    }
    const rangeChanges = new Array(rangesToRefresh.length);
    for (let i = 0; i < rangesToRefresh.length; i++) {
      const range = rangesToRefresh[i];
      rangeChanges[i] = {
        newRange: range.range,
        newRangeStartOffset: range.startOffset,
        newRangeEndOffset: range.endOffset
      };
    }
    const tree = this._getTree(textModel);
    if (tree?.parseResult?.tree && tree.parseResult.versionId === versionId) {
      this._handleTreeUpdate(rangeChanges, textModel, versionId, tree);
    }
  }
  _rangeTokensAsUpdates(rangeOffset, endOffsetToken, startingOffsetInArray) {
    const updates = [];
    let lastEnd = 0;
    for (const token of endOffsetToken) {
      if (token.endOffset <= lastEnd || startingOffsetInArray && token.endOffset < startingOffsetInArray) {
        continue;
      }
      let tokenUpdate;
      if (startingOffsetInArray && lastEnd < startingOffsetInArray) {
        tokenUpdate = { startOffsetInclusive: rangeOffset + startingOffsetInArray, length: token.endOffset - startingOffsetInArray, token: token.metadata };
      } else {
        tokenUpdate = { startOffsetInclusive: rangeOffset + lastEnd, length: token.endOffset - lastEnd, token: token.metadata };
      }
      updates.push(tokenUpdate);
      lastEnd = token.endOffset;
    }
    return updates;
  }
  getTokensInRange(textModel, range, rangeStartOffset, rangeEndOffset, tree, captures) {
    const tokens = captures ? this._tokenizeCapturesWithMetadata(tree, captures, rangeStartOffset, rangeEndOffset) : this._tokenize(range, rangeStartOffset, rangeEndOffset, textModel);
    if (tokens?.endOffsetsAndMetadata) {
      return this._rangeTokensAsUpdates(rangeStartOffset, tokens.endOffsetsAndMetadata);
    }
    return void 0;
  }
  _getTree(textModel) {
    return this._treeSitterService.getParseResult(textModel);
  }
  _ensureQuery() {
    if (!this._query) {
      const language = this._treeSitterService.getOrInitLanguage(this._languageId);
      if (!language) {
        if (!this._languageAddedListener) {
          this._languageAddedListener = this._register(Event.onceIf(this._treeSitterService.onDidAddLanguage, (e) => e.id === this._languageId)((e) => {
            this._query = new this.Query(e.language, this._queries);
          }));
        }
        return;
      }
      this._query = new this.Query(language, this._queries);
    }
    return this._query;
  }
  _updateTheme(e) {
    this._colorThemeData = this._themeService.getColorTheme();
    for (const model of this._codeEditors.textModels) {
      const modelRange = model.getFullModelRange();
      this._tokenizationStoreService.markForRefresh(model, modelRange);
      const editor = this._codeEditors.getEditorForModel(model);
      if (editor) {
        this._parseAndTokenizeViewPort(model, editor.getVisibleRangesPlusViewportAboveBelow());
      }
    }
  }
  captureAtPosition(lineNumber, column, textModel) {
    const textModelTreeSitter = this._getTree(textModel);
    if (!textModelTreeSitter?.parseResult?.tree) {
      return [];
    }
    const captures = this._captureAtRangeWithInjections(new Range(lineNumber, column, lineNumber, column + 1), textModelTreeSitter, textModelTreeSitter.parseResult.tree);
    return captures;
  }
  captureAtRangeTree(range, tree, textModelTreeSitter) {
    const captures = textModelTreeSitter ? this._captureAtRangeWithInjections(range, textModelTreeSitter, tree) : this._captureAtRange(range, tree);
    return captures;
  }
  _captureAtRange(range, tree) {
    const query = this._ensureQuery();
    if (!tree || !query) {
      return [];
    }
    return query.captures(tree.rootNode, { startPosition: { row: range.startLineNumber - 1, column: range.startColumn - 1 }, endPosition: { row: range.endLineNumber - 1, column: range.endColumn - 1 } }).map((capture) => ({
      name: capture.name,
      text: capture.node.text,
      node: {
        startIndex: capture.node.startIndex,
        endIndex: capture.node.endIndex,
        startPosition: {
          lineNumber: capture.node.startPosition.row + 1,
          column: capture.node.startPosition.column + 1
        },
        endPosition: {
          lineNumber: capture.node.endPosition.row + 1,
          column: capture.node.endPosition.column + 1
        }
      },
      encodedLanguageId: this._encodedLanguageId
    }));
  }
  _captureAtRangeWithInjections(range, textModelTreeSitter, tree) {
    const query = this._ensureQuery();
    if (!textModelTreeSitter?.parseResult || !query) {
      return [];
    }
    const captures = this._captureAtRange(range, tree);
    for (let i = 0; i < captures.length; i++) {
      const capture = captures[i];
      const capStartLine = capture.node.startPosition.lineNumber;
      const capEndLine = capture.node.endPosition.lineNumber;
      const capStartColumn = capture.node.startPosition.column;
      const capEndColumn = capture.node.endPosition.column;
      const startLine = capStartLine > range.startLineNumber && capStartLine < range.endLineNumber ? capStartLine : range.startLineNumber;
      const endLine = capEndLine > range.startLineNumber && capEndLine < range.endLineNumber ? capEndLine : range.endLineNumber;
      const startColumn = capStartLine === range.startLineNumber ? capStartColumn < range.startColumn ? range.startColumn : capStartColumn : capStartLine < range.startLineNumber ? range.startColumn : capStartColumn;
      const endColumn = capEndLine === range.endLineNumber ? capEndColumn > range.endColumn ? range.endColumn : capEndColumn : capEndLine > range.endLineNumber ? range.endColumn : capEndColumn;
      const injectionRange = new Range(startLine, startColumn, endLine, endColumn);
      const injection = this._getInjectionCaptures(textModelTreeSitter, capture, injectionRange);
      if (injection && injection.length > 0) {
        captures.splice(i + 1, 0, ...injection);
        i += injection.length;
      }
    }
    return captures;
  }
  /**
   * Gets the tokens for a given line.
   * Each token takes 2 elements in the array. The first element is the offset of the end of the token *in the line, not in the document*, and the second element is the metadata.
   *
   * @param lineNumber
   * @returns
   */
  tokenizeEncoded(lineNumber, textModel) {
    const tokens = this._tokenizeEncoded(lineNumber, textModel);
    if (!tokens) {
      return void 0;
    }
    const updates = this._rangeTokensAsUpdates(textModel.getOffsetAt({ lineNumber, column: 1 }), tokens.result);
    if (tokens.versionId === textModel.getVersionId()) {
      this._tokenizationStoreService.updateTokens(textModel, tokens.versionId, [{ newTokens: updates, oldRangeLength: textModel.getLineLength(lineNumber) }], TokenQuality.Accurate);
    }
  }
  tokenizeEncodedInstrumented(lineNumber, textModel) {
    const tokens = this._tokenizeEncoded(lineNumber, textModel);
    if (!tokens) {
      return void 0;
    }
    return { result: this._endOffsetTokensToUint32Array(tokens.result), captureTime: tokens.captureTime, metadataTime: tokens.metadataTime };
  }
  _getCaptures(range, textModelTreeSitter, tree) {
    const captures = this._captureAtRangeWithInjections(range, textModelTreeSitter, tree);
    return captures;
  }
  _tokenize(range, rangeStartOffset, rangeEndOffset, textModel) {
    const tree = this._getTree(textModel);
    if (!tree?.parseResult?.tree) {
      return void 0;
    }
    const captures = this._getCaptures(range, tree, tree.parseResult.tree);
    const result = this._tokenizeCapturesWithMetadata(tree.parseResult.tree, captures, rangeStartOffset, rangeEndOffset);
    if (!result) {
      return void 0;
    }
    return { ...result, versionId: tree.parseResult.versionId };
  }
  _createTokensFromCaptures(tree, captures, rangeStartOffset, rangeEndOffset) {
    const stopwatch = StopWatch.create();
    const rangeLength = rangeEndOffset - rangeStartOffset;
    const encodedLanguageId = this._languageIdCodec.encodeLanguageId(this._languageId);
    const baseScope = TREESITTER_BASE_SCOPES[this._languageId] || "source";
    if (captures.length === 0) {
      if (tree) {
        stopwatch.stop();
        const endOffsetsAndMetadata = [{ endOffset: rangeLength, scopes: [], encodedLanguageId }];
        return { endOffsets: endOffsetsAndMetadata, captureTime: stopwatch.elapsed() };
      }
      return void 0;
    }
    const endOffsetsAndScopes = Array(captures.length);
    endOffsetsAndScopes.fill({ endOffset: 0, scopes: [baseScope], encodedLanguageId });
    let tokenIndex = 0;
    const increaseSizeOfTokensByOneToken = () => {
      endOffsetsAndScopes.push({ endOffset: 0, scopes: [baseScope], encodedLanguageId });
    };
    const brackets = (capture, startOffset) => {
      return capture.name.includes("punctuation") && capture.text ? Array.from(capture.text.matchAll(BRACKETS)).map((match) => startOffset + match.index) : void 0;
    };
    const addCurrentTokenToArray = (capture, startOffset, endOffset, position) => {
      if (position !== void 0) {
        const oldScopes = endOffsetsAndScopes[position].scopes;
        let oldBracket = endOffsetsAndScopes[position].bracket;
        const prevEndOffset = position > 0 ? endOffsetsAndScopes[position - 1].endOffset : 0;
        if (prevEndOffset !== startOffset) {
          let preInsertBracket = void 0;
          if (oldBracket && oldBracket.length > 0) {
            preInsertBracket = [];
            const postInsertBracket = [];
            for (let i = 0; i < oldBracket.length; i++) {
              const bracket = oldBracket[i];
              if (bracket < startOffset) {
                preInsertBracket.push(bracket);
              } else if (bracket > endOffset) {
                postInsertBracket.push(bracket);
              }
            }
            if (preInsertBracket.length === 0) {
              preInsertBracket = void 0;
            }
            if (postInsertBracket.length === 0) {
              oldBracket = void 0;
            } else {
              oldBracket = postInsertBracket;
            }
          }
          endOffsetsAndScopes.splice(position, 0, { endOffset: startOffset, scopes: [...oldScopes], bracket: preInsertBracket, encodedLanguageId: capture.encodedLanguageId });
          position++;
          increaseSizeOfTokensByOneToken();
          tokenIndex++;
        }
        endOffsetsAndScopes.splice(position, 0, { endOffset, scopes: [...oldScopes, capture.name], bracket: brackets(capture, startOffset), encodedLanguageId: capture.encodedLanguageId });
        endOffsetsAndScopes[tokenIndex].bracket = oldBracket;
      } else {
        endOffsetsAndScopes[tokenIndex] = { endOffset, scopes: [baseScope, capture.name], bracket: brackets(capture, startOffset), encodedLanguageId: capture.encodedLanguageId };
      }
      tokenIndex++;
    };
    for (let captureIndex = 0; captureIndex < captures.length; captureIndex++) {
      const capture = captures[captureIndex];
      const tokenEndIndex = capture.node.endIndex < rangeEndOffset ? capture.node.endIndex < rangeStartOffset ? rangeStartOffset : capture.node.endIndex : rangeEndOffset;
      const tokenStartIndex = capture.node.startIndex < rangeStartOffset ? rangeStartOffset : capture.node.startIndex;
      const endOffset = tokenEndIndex - rangeStartOffset;
      let previousEndOffset;
      const currentTokenLength = tokenEndIndex - tokenStartIndex;
      if (captureIndex > 0) {
        previousEndOffset = endOffsetsAndScopes[tokenIndex - 1].endOffset;
      } else {
        previousEndOffset = tokenStartIndex - rangeStartOffset - 1;
      }
      const startOffset = endOffset - currentTokenLength;
      if (previousEndOffset >= 0 && previousEndOffset < startOffset) {
        endOffsetsAndScopes[tokenIndex] = { endOffset: startOffset, scopes: [baseScope], encodedLanguageId: this._encodedLanguageId };
        tokenIndex++;
        increaseSizeOfTokensByOneToken();
      }
      if (currentTokenLength < 0) {
        continue;
      }
      if (previousEndOffset >= endOffset) {
        let withinTokenIndex = tokenIndex - 1;
        let previousTokenEndOffset = endOffsetsAndScopes[withinTokenIndex].endOffset;
        let previousTokenStartOffset = withinTokenIndex >= 2 ? endOffsetsAndScopes[withinTokenIndex - 1].endOffset : 0;
        do {
          if (previousTokenStartOffset + currentTokenLength === previousTokenEndOffset) {
            if (previousTokenStartOffset === startOffset) {
              endOffsetsAndScopes[withinTokenIndex].scopes.push(capture.name);
              const oldBracket = endOffsetsAndScopes[withinTokenIndex].bracket;
              endOffsetsAndScopes[withinTokenIndex].bracket = oldBracket && oldBracket.length > 0 ? oldBracket : brackets(capture, startOffset);
            }
          } else if (previousTokenStartOffset <= startOffset) {
            addCurrentTokenToArray(capture, startOffset, endOffset, withinTokenIndex);
            break;
          }
          withinTokenIndex--;
          previousTokenStartOffset = withinTokenIndex >= 1 ? endOffsetsAndScopes[withinTokenIndex - 1].endOffset : 0;
          previousTokenEndOffset = withinTokenIndex >= 0 ? endOffsetsAndScopes[withinTokenIndex].endOffset : 0;
        } while (previousTokenEndOffset > startOffset);
      } else {
        addCurrentTokenToArray(capture, startOffset, endOffset);
      }
    }
    if (endOffsetsAndScopes[tokenIndex - 1].endOffset < rangeLength) {
      if (rangeLength - endOffsetsAndScopes[tokenIndex - 1].endOffset > 0) {
        increaseSizeOfTokensByOneToken();
        endOffsetsAndScopes[tokenIndex] = { endOffset: rangeLength, scopes: endOffsetsAndScopes[tokenIndex].scopes, encodedLanguageId: this._encodedLanguageId };
        tokenIndex++;
      }
    }
    for (let i = 0; i < endOffsetsAndScopes.length; i++) {
      const token = endOffsetsAndScopes[i];
      if (token.endOffset === 0 && token.scopes.length === 0 && i !== 0) {
        endOffsetsAndScopes.splice(i, endOffsetsAndScopes.length - i);
        break;
      }
    }
    const captureTime = stopwatch.elapsed();
    return { endOffsets: endOffsetsAndScopes, captureTime };
  }
  _getInjectionCaptures(textModelTreeSitter, parentCapture, range) {
    const injection = textModelTreeSitter.getInjection(parentCapture.node.startIndex, this._languageId);
    if (!injection?.tree || injection.versionId !== textModelTreeSitter.parseResult?.versionId) {
      return void 0;
    }
    const feature = TreeSitterTokenizationRegistry.get(injection.languageId);
    if (!feature) {
      return void 0;
    }
    return feature.captureAtRangeTree(range, injection.tree, textModelTreeSitter);
  }
  _tokenizeCapturesWithMetadata(tree, captures, rangeStartOffset, rangeEndOffset) {
    const stopwatch = StopWatch.create();
    const emptyTokens = this._createTokensFromCaptures(tree, captures, rangeStartOffset, rangeEndOffset);
    if (!emptyTokens) {
      return void 0;
    }
    const endOffsetsAndScopes = emptyTokens.endOffsets;
    for (let i = 0; i < endOffsetsAndScopes.length; i++) {
      const token = endOffsetsAndScopes[i];
      token.metadata = findMetadata(this._colorThemeData, token.scopes, token.encodedLanguageId, !!token.bracket && token.bracket.length > 0);
    }
    const metadataTime = stopwatch.elapsed();
    return { endOffsetsAndMetadata: endOffsetsAndScopes, captureTime: emptyTokens.captureTime, metadataTime };
  }
  _emptyToken() {
    return findMetadata(this._colorThemeData, [], this._encodedLanguageId, false);
  }
  _tokenizeEncoded(lineNumber, textModel) {
    const lineOffset = textModel.getOffsetAt({ lineNumber, column: 1 });
    const maxLine = textModel.getLineCount();
    const lineEndOffset = lineNumber + 1 <= maxLine ? textModel.getOffsetAt({ lineNumber: lineNumber + 1, column: 1 }) : textModel.getValueLength();
    const lineLength = lineEndOffset - lineOffset;
    const result = this._tokenize(new Range(lineNumber, 1, lineNumber, lineLength + 1), lineOffset, lineEndOffset, textModel);
    if (!result) {
      return void 0;
    }
    return { result: result.endOffsetsAndMetadata, captureTime: result.captureTime, metadataTime: result.metadataTime, versionId: result.versionId };
  }
  _endOffsetTokensToUint32Array(endOffsetsAndMetadata) {
    const uint32Array = new Uint32Array(endOffsetsAndMetadata.length * 2);
    for (let i = 0; i < endOffsetsAndMetadata.length; i++) {
      uint32Array[i * 2] = endOffsetsAndMetadata[i].endOffset;
      uint32Array[i * 2 + 1] = endOffsetsAndMetadata[i].metadata;
    }
    return uint32Array;
  }
  dispose() {
    super.dispose();
    this._query?.delete();
    this._query = void 0;
  }
};
TreeSitterTokenizationSupport = __decorateClass([
  __decorateParam(4, ITreeSitterParserService),
  __decorateParam(5, IWorkbenchThemeService),
  __decorateParam(6, ITreeSitterTokenizationStoreService),
  __decorateParam(7, IInstantiationService)
], TreeSitterTokenizationSupport);
registerSingleton(ITreeSitterTokenizationFeature, TreeSitterTokenizationFeature, InstantiationType.Eager);
export {
  ITreeSitterTokenizationFeature,
  TREESITTER_BASE_SCOPES,
  TreeSitterTokenizationFeature,
  TreeSitterTokenizationSupport
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdHJlZVNpdHRlci9icm93c2VyL3RyZWVTaXR0ZXJUb2tlbml6YXRpb25GZWF0dXJlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgKiBhcyBQYXJzZXIgZnJvbSAnQHZzY29kZS90cmVlLXNpdHRlci13YXNtJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBBcHBSZXNvdXJjZVBhdGgsIEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUlkQ29kZWMsIElUcmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydCwgTGF6eVRva2VuaXphdGlvblN1cHBvcnQsIFF1ZXJ5Q2FwdHVyZSwgVHJlZVNpdHRlclRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgRURJVE9SX0VYUEVSSU1FTlRBTF9QUkVGRVJfVFJFRVNJVFRFUiwgSVRyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLCBSYW5nZUNoYW5nZSwgSVRyZWVTaXR0ZXJJbXBvcnRlciwgVFJFRVNJVFRFUl9BTExPV0VEX1NVUFBPUlQsIFJhbmdlV2l0aE9mZnNldHMsIElUZXh0TW9kZWxUcmVlU2l0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90cmVlU2l0dGVyUGFyc2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciwgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2xvclRoZW1lRGF0YSwgZmluZE1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vdGhlbWVzL2NvbW1vbi9jb2xvclRoZW1lRGF0YS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IElUcmVlU2l0dGVyVG9rZW5pemF0aW9uU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90cmVlU2l0dGVyVG9rZW5TdG9yZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBUb2tlblF1YWxpdHksIFRva2VuVXBkYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90b2tlblN0b3JlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IHNldFRpbWVvdXQwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZmluZExpa2VseVJlbGV2YW50TGluZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbFRva2Vucy5qcyc7XG5pbXBvcnQgeyBUcmVlU2l0dGVyQ29kZUVkaXRvcnMgfSBmcm9tICcuL3RyZWVTaXR0ZXJDb2RlRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29sb3JUaGVtZSwgSVdvcmtiZW5jaFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uL3RoZW1lcy9jb21tb24vd29ya2JlbmNoVGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcblxudHlwZSBUcmVlU2l0dGVyUXVlcmllcyA9IHN0cmluZztcblxuZXhwb3J0IGNvbnN0IElUcmVlU2l0dGVyVG9rZW5pemF0aW9uRmVhdHVyZSA9IGNyZWF0ZURlY29yYXRvcjxJVHJlZVNpdHRlclRva2VuaXphdGlvbkZlYXR1cmU+KCd0cmVlU2l0dGVyVG9rZW5pemF0aW9uRmVhdHVyZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElUcmVlU2l0dGVyVG9rZW5pemF0aW9uRmVhdHVyZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIEVuZE9mZnNldFRva2VuIHtcblx0ZW5kT2Zmc2V0OiBudW1iZXI7XG5cdG1ldGFkYXRhOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBFbmRPZmZzZXRBbmRTY29wZXMge1xuXHRlbmRPZmZzZXQ6IG51bWJlcjtcblx0c2NvcGVzOiBzdHJpbmdbXTtcblx0YnJhY2tldD86IG51bWJlcltdO1xuXHRlbmNvZGVkTGFuZ3VhZ2VJZDogTGFuZ3VhZ2VJZDtcbn1cblxuaW50ZXJmYWNlIEVuZE9mZnNldFdpdGhNZXRhIGV4dGVuZHMgRW5kT2Zmc2V0QW5kU2NvcGVzIHtcblx0bWV0YWRhdGE/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjb25zdCBUUkVFU0lUVEVSX0JBU0VfU0NPUEVTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuXHQnY3NzJzogJ3NvdXJjZS5jc3MnLFxuXHQndHlwZXNjcmlwdCc6ICdzb3VyY2UudHMnLFxuXHQnaW5pJzogJ3NvdXJjZS5pbmknLFxuXHQncmVnZXgnOiAnc291cmNlLnJlZ2V4Jyxcbn07XG5cbmNvbnN0IEJSQUNLRVRTID0gL1tcXHtcXH1cXFtcXF1cXDxcXD5cXChcXCldL2c7XG5cbmV4cG9ydCBjbGFzcyBUcmVlU2l0dGVyVG9rZW5pemF0aW9uRmVhdHVyZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVHJlZVNpdHRlclRva2VuaXphdGlvbkZlYXR1cmUge1xuXHRwdWJsaWMgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b2tlbml6ZXJzUmVnaXN0cmF0aW9uczogRGlzcG9zYWJsZU1hcDxzdHJpbmcsIERpc3Bvc2FibGVTdG9yZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcCgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRyZWVTaXR0ZXJJbXBvcnRlciBwcml2YXRlIHJlYWRvbmx5IF90cmVlU2l0dGVySW1wb3J0ZXI6IElUcmVlU2l0dGVySW1wb3J0ZXIsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9oYW5kbGVHcmFtbWFyc0V4dFBvaW50KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oRURJVE9SX0VYUEVSSU1FTlRBTF9QUkVGRVJfVFJFRVNJVFRFUikpIHtcblx0XHRcdFx0dGhpcy5faGFuZGxlR3JhbW1hcnNFeHRQb2ludCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFNldHRpbmcobGFuZ3VhZ2VJZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KGAke0VESVRPUl9FWFBFUklNRU5UQUxfUFJFRkVSX1RSRUVTSVRURVJ9LiR7bGFuZ3VhZ2VJZH1gKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZUdyYW1tYXJzRXh0UG9pbnQoKTogdm9pZCB7XG5cdFx0Ly8gRXZlbnR1YWxseSwgdGhpcyBzaG91bGQgYWN0dWFsbHkgdXNlIGFuIGV4dGVuc2lvbiBwb2ludCB0byBhZGQgdHJlZSBzaXR0ZXIgZ3JhbW1hcnMsIGJ1dCBmb3Igbm93IHRoZXkgYXJlIGhhcmQgY29kZWQgaW4gY29yZVxuXHRcdGZvciAoY29uc3QgbGFuZ3VhZ2VJZCBvZiBUUkVFU0lUVEVSX0FMTE9XRURfU1VQUE9SVCkge1xuXHRcdFx0Y29uc3Qgc2V0dGluZyA9IHRoaXMuX2dldFNldHRpbmcobGFuZ3VhZ2VJZCk7XG5cdFx0XHRpZiAoc2V0dGluZyAmJiAhdGhpcy5fdG9rZW5pemVyc1JlZ2lzdHJhdGlvbnMuaGFzKGxhbmd1YWdlSWQpKSB7XG5cdFx0XHRcdGNvbnN0IGxhenlUb2tlbml6YXRpb25TdXBwb3J0ID0gbmV3IExhenlUb2tlbml6YXRpb25TdXBwb3J0KCgpID0+IHRoaXMuX2NyZWF0ZVRva2VuaXphdGlvblN1cHBvcnQobGFuZ3VhZ2VJZCkpO1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQobGF6eVRva2VuaXphdGlvblN1cHBvcnQpO1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKFRyZWVTaXR0ZXJUb2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlckZhY3RvcnkobGFuZ3VhZ2VJZCwgbGF6eVRva2VuaXphdGlvblN1cHBvcnQpKTtcblx0XHRcdFx0dGhpcy5fdG9rZW5pemVyc1JlZ2lzdHJhdGlvbnMuc2V0KGxhbmd1YWdlSWQsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0XHRcdFRyZWVTaXR0ZXJUb2tlbml6YXRpb25SZWdpc3RyeS5nZXRPckNyZWF0ZShsYW5ndWFnZUlkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgbGFuZ3VhZ2VzVG9VbnJlZ2lzdGVyID0gWy4uLnRoaXMuX3Rva2VuaXplcnNSZWdpc3RyYXRpb25zLmtleXMoKV0uZmlsdGVyKGxhbmd1YWdlSWQgPT4gIXRoaXMuX2dldFNldHRpbmcobGFuZ3VhZ2VJZCkpO1xuXHRcdGZvciAoY29uc3QgbGFuZ3VhZ2VJZCBvZiBsYW5ndWFnZXNUb1VucmVnaXN0ZXIpIHtcblx0XHRcdHRoaXMuX3Rva2VuaXplcnNSZWdpc3RyYXRpb25zLmRlbGV0ZUFuZERpc3Bvc2UobGFuZ3VhZ2VJZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZmV0Y2hRdWVyaWVzKG5ld0xhbmd1YWdlOiBzdHJpbmcpOiBQcm9taXNlPFRyZWVTaXR0ZXJRdWVyaWVzPiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VMb2NhdGlvbjogQXBwUmVzb3VyY2VQYXRoID0gYHZzL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2hpZ2hsaWdodHMvJHtuZXdMYW5ndWFnZX0uc2NtYDtcblx0XHRjb25zdCBxdWVyeSA9IGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLnJlYWRGaWxlKEZpbGVBY2Nlc3MuYXNGaWxlVXJpKGxhbmd1YWdlTG9jYXRpb24pKTtcblx0XHRyZXR1cm4gcXVlcnkudmFsdWUudG9TdHJpbmcoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NyZWF0ZVRva2VuaXphdGlvblN1cHBvcnQobGFuZ3VhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTxJVHJlZVNpdHRlclRva2VuaXphdGlvblN1cHBvcnQgJiBJRGlzcG9zYWJsZSB8IG51bGw+IHtcblx0XHRjb25zdCBxdWVyaWVzID0gYXdhaXQgdGhpcy5fZmV0Y2hRdWVyaWVzKGxhbmd1YWdlSWQpO1xuXHRcdGNvbnN0IFF1ZXJ5ID0gYXdhaXQgdGhpcy5fdHJlZVNpdHRlckltcG9ydGVyLmdldFF1ZXJ5Q2xhc3MoKTtcblx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZVNpdHRlclRva2VuaXphdGlvblN1cHBvcnQsIHF1ZXJpZXMsIFF1ZXJ5LCBsYW5ndWFnZUlkLCB0aGlzLl9sYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVHJlZVNpdHRlclRva2VuaXphdGlvblN1cHBvcnQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0IHtcblx0cHJpdmF0ZSBfcXVlcnk6IFBhcnNlci5RdWVyeSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VUb2tlbnM6IEVtaXR0ZXI8eyB0ZXh0TW9kZWw6IElUZXh0TW9kZWw7IGNoYW5nZXM6IElNb2RlbFRva2Vuc0NoYW5nZWRFdmVudCB9PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyKCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VUb2tlbnM6IEV2ZW50PHsgdGV4dE1vZGVsOiBJVGV4dE1vZGVsOyBjaGFuZ2VzOiBJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQgfT4gPSB0aGlzLl9vbkRpZENoYW5nZVRva2Vucy5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDb21wbGV0ZUJhY2tncm91bmRUb2tlbml6YXRpb246IEVtaXR0ZXI8eyB0ZXh0TW9kZWw6IElUZXh0TW9kZWwgfT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlQmFja2dyb3VuZFRva2VuaXphdGlvbjogRXZlbnQ8eyB0ZXh0TW9kZWw6IElUZXh0TW9kZWwgfT4gPSB0aGlzLl9vbkRpZENvbXBsZXRlQmFja2dyb3VuZFRva2VuaXphdGlvbi5ldmVudDtcblx0cHJpdmF0ZSBfY29sb3JUaGVtZURhdGEhOiBDb2xvclRoZW1lRGF0YTtcblx0cHJpdmF0ZSBfbGFuZ3VhZ2VBZGRlZExpc3RlbmVyOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY29kZUVkaXRvcnM6IFRyZWVTaXR0ZXJDb2RlRWRpdG9ycztcblx0cHJpdmF0ZSBfZW5jb2RlZExhbmd1YWdlOiBMYW5ndWFnZUlkIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3F1ZXJpZXM6IFRyZWVTaXR0ZXJRdWVyaWVzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgUXVlcnk6IHR5cGVvZiBQYXJzZXIuUXVlcnksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlSWRDb2RlYzogSUxhbmd1YWdlSWRDb2RlYyxcblx0XHRASVRyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RyZWVTaXR0ZXJTZXJ2aWNlOiBJVHJlZVNpdHRlclBhcnNlclNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlLFxuXHRcdEBJVHJlZVNpdHRlclRva2VuaXphdGlvblN0b3JlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90b2tlbml6YXRpb25TdG9yZVNlcnZpY2U6IElUcmVlU2l0dGVyVG9rZW5pemF0aW9uU3RvcmVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9jb2RlRWRpdG9ycyA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRyZWVTaXR0ZXJDb2RlRWRpdG9ycywgdGhpcy5fbGFuZ3VhZ2VJZCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29kZUVkaXRvcnMub25EaWRDaGFuZ2VWaWV3cG9ydChlID0+IHtcblx0XHRcdHRoaXMuX3BhcnNlQW5kVG9rZW5pemVWaWV3UG9ydChlLm1vZGVsLCBlLnJhbmdlcyk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2NvZGVFZGl0b3JzLmdldEluaXRpYWxWaWV3UG9ydHMoKS50aGVuKGFzeW5jICh2aWV3cG9ydHMpID0+IHtcblx0XHRcdGZvciAoY29uc3Qgdmlld3BvcnQgb2Ygdmlld3BvcnRzKSB7XG5cdFx0XHRcdHRoaXMuX3BhcnNlQW5kVG9rZW5pemVWaWV3UG9ydCh2aWV3cG9ydC5tb2RlbCwgdmlld3BvcnQucmFuZ2VzKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5fdGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSwgKGUpID0+IHRoaXMuX3VwZGF0ZVRoZW1lKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdHJlZVNpdHRlclNlcnZpY2Uub25EaWRVcGRhdGVUcmVlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5sYW5ndWFnZUlkICE9PSB0aGlzLl9sYW5ndWFnZUlkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl90b2tlbml6YXRpb25TdG9yZVNlcnZpY2UuaGFzVG9rZW5zKGUudGV4dE1vZGVsKSkge1xuXHRcdFx0XHQvLyBNYXJrIHRoZSByYW5nZSBmb3IgcmVmcmVzaCBpbW1lZGlhdGVseVxuXHRcdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIGUucmFuZ2VzKSB7XG5cdFx0XHRcdFx0dGhpcy5fdG9rZW5pemF0aW9uU3RvcmVTZXJ2aWNlLm1hcmtGb3JSZWZyZXNoKGUudGV4dE1vZGVsLCByYW5nZS5uZXdSYW5nZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChlLnZlcnNpb25JZCAhPT0gZS50ZXh0TW9kZWwuZ2V0VmVyc2lvbklkKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGaXJzdCB0aW1lIHdlIHNlZSBhIHRyZWUgd2UgbmVlZCB0byBidWlsZCBhIHRva2VuIHN0b3JlLlxuXHRcdFx0aWYgKCF0aGlzLl90b2tlbml6YXRpb25TdG9yZVNlcnZpY2UuaGFzVG9rZW5zKGUudGV4dE1vZGVsKSkge1xuXHRcdFx0XHQvLyBUaGlzIHdpbGwgbGlrZWx5IG5vdCBoYXBwZW4gYXMgd2UgZmlyc3QgaGFuZGxlIGFsbCBtb2RlbHMsIHdoaWNoIGFyZSByZWFkeSBiZWZvcmUgdHJlZXMuXG5cdFx0XHRcdHRoaXMuX2ZpcnN0VHJlZVVwZGF0ZShlLnRleHRNb2RlbCwgZS52ZXJzaW9uSWQsIGUudHJlZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9oYW5kbGVUcmVlVXBkYXRlKGUucmFuZ2VzLCBlLnRleHRNb2RlbCwgZS52ZXJzaW9uSWQsIGUudHJlZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgX2VuY29kZWRMYW5ndWFnZUlkKCk6IExhbmd1YWdlSWQge1xuXHRcdGlmICghdGhpcy5fZW5jb2RlZExhbmd1YWdlKSB7XG5cdFx0XHR0aGlzLl9lbmNvZGVkTGFuZ3VhZ2UgPSB0aGlzLl9sYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZCh0aGlzLl9sYW5ndWFnZUlkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2VuY29kZWRMYW5ndWFnZTtcblx0fVxuXG5cdHByaXZhdGUgX3NldEluaXRpYWxUb2tlbnModGV4dE1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cdFx0Y29uc3QgdG9rZW5zOiBUb2tlblVwZGF0ZVtdID0gdGhpcy5fY3JlYXRlRW1wdHlUb2tlbnModGV4dE1vZGVsKTtcblx0XHR0aGlzLl90b2tlbml6YXRpb25TdG9yZVNlcnZpY2Uuc2V0VG9rZW5zKHRleHRNb2RlbCwgdG9rZW5zLCBUb2tlblF1YWxpdHkuTm9uZSk7XG5cdH1cblxuXHRwcml2YXRlIF9mb3JjZVBhcnNlQW5kVG9rZW5pemVDb250ZW50KG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZTogUmFuZ2UsIHN0YXJ0T2Zmc2V0T2ZSYW5nZUluRG9jdW1lbnQ6IG51bWJlciwgZW5kT2Zmc2V0T2ZSYW5nZUluRG9jdW1lbnQ6IG51bWJlciwgY29udGVudDogc3RyaW5nLCBhc1VwZGF0ZTogdHJ1ZSk6IFRva2VuVXBkYXRlW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2ZvcmNlUGFyc2VBbmRUb2tlbml6ZUNvbnRlbnQobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlOiBSYW5nZSwgc3RhcnRPZmZzZXRPZlJhbmdlSW5Eb2N1bWVudDogbnVtYmVyLCBlbmRPZmZzZXRPZlJhbmdlSW5Eb2N1bWVudDogbnVtYmVyLCBjb250ZW50OiBzdHJpbmcsIGFzVXBkYXRlOiBmYWxzZSk6IEVuZE9mZnNldFRva2VuW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2ZvcmNlUGFyc2VBbmRUb2tlbml6ZUNvbnRlbnQobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlOiBSYW5nZSwgc3RhcnRPZmZzZXRPZlJhbmdlSW5Eb2N1bWVudDogbnVtYmVyLCBlbmRPZmZzZXRPZlJhbmdlSW5Eb2N1bWVudDogbnVtYmVyLCBjb250ZW50OiBzdHJpbmcsIGFzVXBkYXRlOiBib29sZWFuKTogRW5kT2Zmc2V0VG9rZW5bXSB8IFRva2VuVXBkYXRlW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGxpa2VseVJlbGV2YW50TGluZXMgPSBmaW5kTGlrZWx5UmVsZXZhbnRMaW5lcyhtb2RlbCwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKS5saWtlbHlSZWxldmFudExpbmVzO1xuXHRcdGNvbnN0IGxpa2VseVJlbGV2YW50UHJlZml4ID0gbGlrZWx5UmVsZXZhbnRMaW5lcy5qb2luKG1vZGVsLmdldEVPTCgpKTtcblx0XHRjb25zdCB0cmVlID0gdGhpcy5fdHJlZVNpdHRlclNlcnZpY2UuZ2V0VHJlZVN5bmMoYCR7bGlrZWx5UmVsZXZhbnRQcmVmaXh9JHtjb250ZW50fWAsIHRoaXMuX2xhbmd1YWdlSWQpO1xuXHRcdGlmICghdHJlZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWVSYW5nZSA9IG5ldyBSYW5nZSgxLCAxLCByYW5nZS5lbmRMaW5lTnVtYmVyIC0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgMSArIGxpa2VseVJlbGV2YW50TGluZXMubGVuZ3RoLCByYW5nZS5lbmRDb2x1bW4pO1xuXHRcdGNvbnN0IGNhcHR1cmVzID0gdGhpcy5fY2FwdHVyZUF0UmFuZ2UodHJlZVJhbmdlLCB0cmVlKTtcblx0XHRjb25zdCB0b2tlbnMgPSB0aGlzLl90b2tlbml6ZUNhcHR1cmVzV2l0aE1ldGFkYXRhKHRyZWUsIGNhcHR1cmVzLCBsaWtlbHlSZWxldmFudFByZWZpeC5sZW5ndGgsIGVuZE9mZnNldE9mUmFuZ2VJbkRvY3VtZW50IC0gc3RhcnRPZmZzZXRPZlJhbmdlSW5Eb2N1bWVudCArIGxpa2VseVJlbGV2YW50UHJlZml4Lmxlbmd0aCk7XG5cdFx0aWYgKCF0b2tlbnMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoYXNVcGRhdGUpIHtcblx0XHRcdHJldHVybiB0aGlzLl9yYW5nZVRva2Vuc0FzVXBkYXRlcyhzdGFydE9mZnNldE9mUmFuZ2VJbkRvY3VtZW50LCB0b2tlbnMuZW5kT2Zmc2V0c0FuZE1ldGFkYXRhLCBsaWtlbHlSZWxldmFudFByZWZpeC5sZW5ndGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdG9rZW5zLmVuZE9mZnNldHNBbmRNZXRhZGF0YTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wYXJzZUFuZFRva2VuaXplVmlld1BvcnQobW9kZWw6IElUZXh0TW9kZWwsIHZpZXdwb3J0UmFuZ2VzOiBSYW5nZVtdKSB7XG5cdFx0aWYgKCF0aGlzLl90b2tlbml6YXRpb25TdG9yZVNlcnZpY2UuaGFzVG9rZW5zKG1vZGVsKSkge1xuXHRcdFx0dGhpcy5fc2V0SW5pdGlhbFRva2Vucyhtb2RlbCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCByYW5nZSBvZiB2aWV3cG9ydFJhbmdlcykge1xuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXRPZlJhbmdlSW5Eb2N1bWVudCA9IG1vZGVsLmdldE9mZnNldEF0KHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0XHRjb25zdCBlbmRPZmZzZXRPZlJhbmdlSW5Eb2N1bWVudCA9IG1vZGVsLmdldE9mZnNldEF0KHJhbmdlLmdldEVuZFBvc2l0aW9uKCkpO1xuXHRcdFx0Y29uc3QgdmVyc2lvbiA9IG1vZGVsLmdldFZlcnNpb25JZCgpO1xuXHRcdFx0aWYgKHRoaXMuX3Rva2VuaXphdGlvblN0b3JlU2VydmljZS5yYW5nZUhhc1Rva2Vucyhtb2RlbCwgcmFuZ2UsIFRva2VuUXVhbGl0eS5WaWV3cG9ydEd1ZXNzKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UocmFuZ2UpO1xuXHRcdFx0Y29uc3QgdG9rZW5VcGRhdGVzID0gYXdhaXQgdGhpcy5fZm9yY2VQYXJzZUFuZFRva2VuaXplQ29udGVudChtb2RlbCwgcmFuZ2UsIHN0YXJ0T2Zmc2V0T2ZSYW5nZUluRG9jdW1lbnQsIGVuZE9mZnNldE9mUmFuZ2VJbkRvY3VtZW50LCBjb250ZW50LCB0cnVlKTtcblx0XHRcdGlmICghdG9rZW5VcGRhdGVzIHx8IHRoaXMuX3Rva2VuaXphdGlvblN0b3JlU2VydmljZS5yYW5nZUhhc1Rva2Vucyhtb2RlbCwgcmFuZ2UsIFRva2VuUXVhbGl0eS5WaWV3cG9ydEd1ZXNzKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0b2tlblVwZGF0ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGFzdFRva2VuID0gdG9rZW5VcGRhdGVzW3Rva2VuVXBkYXRlcy5sZW5ndGggLSAxXTtcblx0XHRcdGNvbnN0IG9sZFJhbmdlTGVuZ3RoID0gbGFzdFRva2VuLnN0YXJ0T2Zmc2V0SW5jbHVzaXZlICsgbGFzdFRva2VuLmxlbmd0aCAtIHRva2VuVXBkYXRlc1swXS5zdGFydE9mZnNldEluY2x1c2l2ZTtcblx0XHRcdHRoaXMuX3Rva2VuaXphdGlvblN0b3JlU2VydmljZS51cGRhdGVUb2tlbnMobW9kZWwsIHZlcnNpb24sIFt7IG5ld1Rva2VuczogdG9rZW5VcGRhdGVzLCBvbGRSYW5nZUxlbmd0aCB9XSwgVG9rZW5RdWFsaXR5LlZpZXdwb3J0R3Vlc3MpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VUb2tlbnMuZmlyZSh7IHRleHRNb2RlbDogbW9kZWwsIGNoYW5nZXM6IHsgc2VtYW50aWNUb2tlbnNBcHBsaWVkOiBmYWxzZSwgcmFuZ2VzOiBbeyBmcm9tTGluZU51bWJlcjogcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCB0b0xpbmVOdW1iZXI6IHJhbmdlLmVuZExpbmVOdW1iZXIgfV0gfSB9KTtcblx0XHR9XG5cdH1cblxuXHRndWVzc1Rva2Vuc0ZvckxpbmVzQ29udGVudChsaW5lTnVtYmVyOiBudW1iZXIsIHRleHRNb2RlbDogSVRleHRNb2RlbCwgbGluZXM6IHN0cmluZ1tdKTogVWludDMyQXJyYXlbXSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGxpbmVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBsaW5lcy5qb2luKHRleHRNb2RlbC5nZXRFT0woKSk7XG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2UoMSwgMSwgbGluZU51bWJlciArIGxpbmVzLmxlbmd0aCwgbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoICsgMSk7XG5cdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0ZXh0TW9kZWwuZ2V0T2Zmc2V0QXQoeyBsaW5lTnVtYmVyLCBjb2x1bW46IDEgfSk7XG5cdFx0Y29uc3QgdG9rZW5zID0gdGhpcy5fZm9yY2VQYXJzZUFuZFRva2VuaXplQ29udGVudCh0ZXh0TW9kZWwsIHJhbmdlLCBzdGFydE9mZnNldCwgc3RhcnRPZmZzZXQgKyBsaW5lQ29udGVudC5sZW5ndGgsIGxpbmVDb250ZW50LCBmYWxzZSk7XG5cdFx0aWYgKCF0b2tlbnMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHRva2Vuc0J5TGluZTogVWludDMyQXJyYXlbXSA9IG5ldyBBcnJheShsaW5lcy5sZW5ndGgpO1xuXHRcdGxldCB0b2tlbnNJbmRleDogbnVtYmVyID0gMDtcblx0XHRsZXQgdG9rZW5TdGFydE9mZnNldCA9IDA7XG5cdFx0bGV0IGxpbmVTdGFydE9mZnNldCA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgdG9rZW5zRm9yTGluZTogRW5kT2Zmc2V0VG9rZW5bXSA9IFtdO1xuXHRcdFx0bGV0IG1vdmVUb05leHRMaW5lID0gZmFsc2U7XG5cdFx0XHRmb3IgKGxldCBqID0gdG9rZW5zSW5kZXg7ICghbW92ZVRvTmV4dExpbmUgJiYgKGogPCB0b2tlbnMubGVuZ3RoKSk7IGorKykge1xuXHRcdFx0XHRjb25zdCB0b2tlbiA9IHRva2Vuc1tqXTtcblx0XHRcdFx0Y29uc3QgbGluZUFkanVzdGVkRW5kT2Zmc2V0ID0gdG9rZW4uZW5kT2Zmc2V0IC0gbGluZVN0YXJ0T2Zmc2V0O1xuXHRcdFx0XHRjb25zdCBsaW5lQWRqdXN0ZWRTdGFydE9mZnNldCA9IHRva2VuU3RhcnRPZmZzZXQgLSBsaW5lU3RhcnRPZmZzZXQ7XG5cdFx0XHRcdGlmIChsaW5lQWRqdXN0ZWRFbmRPZmZzZXQgPD0gbGluZXNbaV0ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dG9rZW5zRm9yTGluZS5wdXNoKHsgZW5kT2Zmc2V0OiBsaW5lQWRqdXN0ZWRFbmRPZmZzZXQsIG1ldGFkYXRhOiB0b2tlbi5tZXRhZGF0YSB9KTtcblx0XHRcdFx0XHR0b2tlbnNJbmRleCsrO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGxpbmVBZGp1c3RlZFN0YXJ0T2Zmc2V0IDwgbGluZXNbaV0ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGFydGlhbFRva2VuOiBFbmRPZmZzZXRUb2tlbiA9IHsgZW5kT2Zmc2V0OiBsaW5lc1tpXS5sZW5ndGgsIG1ldGFkYXRhOiB0b2tlbi5tZXRhZGF0YSB9O1xuXHRcdFx0XHRcdHRva2Vuc0ZvckxpbmUucHVzaChwYXJ0aWFsVG9rZW4pO1xuXHRcdFx0XHRcdG1vdmVUb05leHRMaW5lID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtb3ZlVG9OZXh0TGluZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9rZW5TdGFydE9mZnNldCA9IHRva2VuLmVuZE9mZnNldDtcblx0XHRcdH1cblxuXHRcdFx0dG9rZW5zQnlMaW5lW2ldID0gdGhpcy5fZW5kT2Zmc2V0VG9rZW5zVG9VaW50MzJBcnJheSh0b2tlbnNGb3JMaW5lKTtcblx0XHRcdGxpbmVTdGFydE9mZnNldCArPSBsaW5lc1tpXS5sZW5ndGggKyB0ZXh0TW9kZWwuZ2V0RU9MKCkubGVuZ3RoO1xuXHRcdH1cblxuXHRcdHJldHVybiB0b2tlbnNCeUxpbmU7XG5cdH1cblxuXHRwcml2YXRlIF9lbXB0eVRva2Vuc0Zvck9mZnNldEFuZExlbmd0aChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIGVtcHR5VG9rZW46IG51bWJlcik6IFRva2VuVXBkYXRlIHtcblx0XHRyZXR1cm4geyB0b2tlbjogZW1wdHlUb2tlbiwgbGVuZ3RoOiBvZmZzZXQgKyBsZW5ndGgsIHN0YXJ0T2Zmc2V0SW5jbHVzaXZlOiAwIH07XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVFbXB0eVRva2Vucyh0ZXh0TW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHRjb25zdCBlbXB0eVRva2VuID0gdGhpcy5fZW1wdHlUb2tlbigpO1xuXHRcdGNvbnN0IG1vZGVsRW5kT2Zmc2V0ID0gdGV4dE1vZGVsLmdldFZhbHVlTGVuZ3RoKCk7XG5cblx0XHRjb25zdCBlbXB0eVRva2VuczogVG9rZW5VcGRhdGVbXSA9IFt0aGlzLl9lbXB0eVRva2Vuc0Zvck9mZnNldEFuZExlbmd0aCgwLCBtb2RlbEVuZE9mZnNldCwgZW1wdHlUb2tlbildO1xuXHRcdHJldHVybiBlbXB0eVRva2Vucztcblx0fVxuXG5cdHByaXZhdGUgX2ZpcnN0VHJlZVVwZGF0ZSh0ZXh0TW9kZWw6IElUZXh0TW9kZWwsIHZlcnNpb25JZDogbnVtYmVyLCB0cmVlOiBJVGV4dE1vZGVsVHJlZVNpdHRlcikge1xuXHRcdHRoaXMuX3NldEluaXRpYWxUb2tlbnModGV4dE1vZGVsKTtcblx0XHRyZXR1cm4gdGhpcy5fc2V0Vmlld1BvcnRUb2tlbnModGV4dE1vZGVsLCB2ZXJzaW9uSWQsIHRyZWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0Vmlld1BvcnRUb2tlbnModGV4dE1vZGVsOiBJVGV4dE1vZGVsLCB2ZXJzaW9uSWQ6IG51bWJlciwgdHJlZTogSVRleHRNb2RlbFRyZWVTaXR0ZXIpIHtcblx0XHRjb25zdCBtYXhMaW5lID0gdGV4dE1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdGxldCByYW5nZUNoYW5nZXM6IFJhbmdlQ2hhbmdlW107XG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fY29kZUVkaXRvcnMuZ2V0RWRpdG9yRm9yTW9kZWwodGV4dE1vZGVsKTtcblx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRjb25zdCB2aWV3UG9ydCA9IGVkaXRvci5nZXRWaXNpYmxlUmFuZ2VzUGx1c1ZpZXdwb3J0QWJvdmVCZWxvdygpO1xuXHRcdFx0Y29uc3QgcmFuZ2VzOiB7IHJlYWRvbmx5IGZyb21MaW5lTnVtYmVyOiBudW1iZXI7IHJlYWRvbmx5IHRvTGluZU51bWJlcjogbnVtYmVyIH1bXSA9IG5ldyBBcnJheSh2aWV3UG9ydC5sZW5ndGgpO1xuXHRcdFx0cmFuZ2VDaGFuZ2VzID0gbmV3IEFycmF5KHZpZXdQb3J0Lmxlbmd0aCk7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdmlld1BvcnQubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSB2aWV3UG9ydFtpXTtcblx0XHRcdFx0cmFuZ2VzW2ldID0geyBmcm9tTGluZU51bWJlcjogcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCB0b0xpbmVOdW1iZXI6IHJhbmdlLmVuZExpbmVOdW1iZXIgPCBtYXhMaW5lID8gcmFuZ2UuZW5kTGluZU51bWJlciA6IG1heExpbmUgfTtcblx0XHRcdFx0Y29uc3QgbmV3UmFuZ2VTdGFydE9mZnNldCA9IHRleHRNb2RlbC5nZXRPZmZzZXRBdChyYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRjb25zdCBuZXdSYW5nZUVuZE9mZnNldCA9IHRleHRNb2RlbC5nZXRPZmZzZXRBdChyYW5nZS5nZXRFbmRQb3NpdGlvbigpKTtcblx0XHRcdFx0cmFuZ2VDaGFuZ2VzW2ldID0ge1xuXHRcdFx0XHRcdG5ld1JhbmdlOiByYW5nZSxcblx0XHRcdFx0XHRuZXdSYW5nZVN0YXJ0T2Zmc2V0LFxuXHRcdFx0XHRcdG5ld1JhbmdlRW5kT2Zmc2V0LFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB2YWx1ZUxlbmd0aCA9IHRleHRNb2RlbC5nZXRWYWx1ZUxlbmd0aCgpO1xuXHRcdFx0cmFuZ2VDaGFuZ2VzID0gW3sgbmV3UmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCBtYXhMaW5lLCB0ZXh0TW9kZWwuZ2V0TGluZU1heENvbHVtbihtYXhMaW5lKSksIG5ld1JhbmdlU3RhcnRPZmZzZXQ6IDAsIG5ld1JhbmdlRW5kT2Zmc2V0OiB2YWx1ZUxlbmd0aCB9XTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2hhbmRsZVRyZWVVcGRhdGUocmFuZ2VDaGFuZ2VzLCB0ZXh0TW9kZWwsIHZlcnNpb25JZCwgdHJlZSk7XG5cdH1cblxuXHQvKipcblx0ICogRG8gbm90IGF3YWl0IGluIHRoaXMgbWV0aG9kLCBpdCB3aWxsIGNhdXNlIGEgcmFjZVxuXHQgKi9cblx0cHJpdmF0ZSBfaGFuZGxlVHJlZVVwZGF0ZShyYW5nZXM6IFJhbmdlQ2hhbmdlW10sIHRleHRNb2RlbDogSVRleHRNb2RlbCwgdmVyc2lvbklkOiBudW1iZXIsIHRleHRNb2RlbFRyZWVTaXR0ZXI6IElUZXh0TW9kZWxUcmVlU2l0dGVyKSB7XG5cdFx0Y29uc3QgdHJlZSA9IHRleHRNb2RlbFRyZWVTaXR0ZXIucGFyc2VSZXN1bHQ/LnRyZWU7XG5cdFx0aWYgKCF0cmVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmFuZ2VDaGFuZ2VzOiBSYW5nZVdpdGhPZmZzZXRzW10gPSBbXTtcblx0XHRjb25zdCBjaHVua1NpemUgPSAxMDAwO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByYW5nZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHJhbmdlTGluZXNMZW5ndGggPSByYW5nZXNbaV0ubmV3UmFuZ2UuZW5kTGluZU51bWJlciAtIHJhbmdlc1tpXS5uZXdSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRpZiAocmFuZ2VMaW5lc0xlbmd0aCA+IGNodW5rU2l6ZSkge1xuXHRcdFx0XHQvLyBTcGxpdCB0aGUgcmFuZ2UgaW50byBjaHVua3MgdG8gYXZvaWQgbG9uZyBvcGVyYXRpb25zXG5cdFx0XHRcdGNvbnN0IGZ1bGxSYW5nZUVuZExpbmVOdW1iZXIgPSByYW5nZXNbaV0ubmV3UmFuZ2UuZW5kTGluZU51bWJlcjtcblx0XHRcdFx0bGV0IGNodW5rTGluZVN0YXJ0ID0gcmFuZ2VzW2ldLm5ld1JhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0bGV0IGNodW5rQ29sdW1uU3RhcnQgPSByYW5nZXNbaV0ubmV3UmFuZ2Uuc3RhcnRDb2x1bW47XG5cdFx0XHRcdGxldCBjaHVua0xpbmVFbmQgPSBjaHVua0xpbmVTdGFydCArIGNodW5rU2l6ZTtcblx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdGNvbnN0IGNodW5rU3RhcnRpbmdQb3NpdGlvbiA9IG5ldyBQb3NpdGlvbihjaHVua0xpbmVTdGFydCwgY2h1bmtDb2x1bW5TdGFydCk7XG5cdFx0XHRcdFx0Y29uc3QgY2h1bmtFbmRDb2x1bW4gPSAoKGNodW5rTGluZUVuZCA9PT0gcmFuZ2VzW2ldLm5ld1JhbmdlLmVuZExpbmVOdW1iZXIpID8gcmFuZ2VzW2ldLm5ld1JhbmdlLmVuZENvbHVtbiA6IHRleHRNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGNodW5rTGluZUVuZCkpO1xuXHRcdFx0XHRcdGNvbnN0IGNodW5rRW5kUG9zaXRpb24gPSBuZXcgUG9zaXRpb24oY2h1bmtMaW5lRW5kLCBjaHVua0VuZENvbHVtbik7XG5cdFx0XHRcdFx0Y29uc3QgY2h1bmtSYW5nZSA9IFJhbmdlLmZyb21Qb3NpdGlvbnMoY2h1bmtTdGFydGluZ1Bvc2l0aW9uLCBjaHVua0VuZFBvc2l0aW9uKTtcblxuXHRcdFx0XHRcdHJhbmdlQ2hhbmdlcy5wdXNoKHtcblx0XHRcdFx0XHRcdHJhbmdlOiBjaHVua1JhbmdlLFxuXHRcdFx0XHRcdFx0c3RhcnRPZmZzZXQ6IHRleHRNb2RlbC5nZXRPZmZzZXRBdChjaHVua1JhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSksXG5cdFx0XHRcdFx0XHRlbmRPZmZzZXQ6IHRleHRNb2RlbC5nZXRPZmZzZXRBdChjaHVua1JhbmdlLmdldEVuZFBvc2l0aW9uKCkpXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRjaHVua0xpbmVTdGFydCA9IGNodW5rTGluZUVuZCArIDE7XG5cdFx0XHRcdFx0Y2h1bmtDb2x1bW5TdGFydCA9IDE7XG5cdFx0XHRcdFx0aWYgKGNodW5rTGluZUVuZCA8IGZ1bGxSYW5nZUVuZExpbmVOdW1iZXIgJiYgY2h1bmtMaW5lRW5kICsgY2h1bmtTaXplID4gZnVsbFJhbmdlRW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0Y2h1bmtMaW5lRW5kID0gZnVsbFJhbmdlRW5kTGluZU51bWJlcjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y2h1bmtMaW5lRW5kID0gY2h1bmtMaW5lRW5kICsgY2h1bmtTaXplO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSB3aGlsZSAoY2h1bmtMaW5lRW5kIDw9IGZ1bGxSYW5nZUVuZExpbmVOdW1iZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gQ2hlY2sgdGhhdCB0aGUgcHJldmlvdXMgcmFuZ2UgZG9lc24ndCBvdmVybGFwXG5cdFx0XHRcdGlmICgoaSA9PT0gMCkgfHwgKHJhbmdlQ2hhbmdlc1tpIC0gMV0uZW5kT2Zmc2V0IDwgcmFuZ2VzW2ldLm5ld1JhbmdlU3RhcnRPZmZzZXQpKSB7XG5cdFx0XHRcdFx0cmFuZ2VDaGFuZ2VzLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IHJhbmdlc1tpXS5uZXdSYW5nZSxcblx0XHRcdFx0XHRcdHN0YXJ0T2Zmc2V0OiByYW5nZXNbaV0ubmV3UmFuZ2VTdGFydE9mZnNldCxcblx0XHRcdFx0XHRcdGVuZE9mZnNldDogcmFuZ2VzW2ldLm5ld1JhbmdlRW5kT2Zmc2V0XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAocmFuZ2VDaGFuZ2VzW2kgLSAxXS5lbmRPZmZzZXQgPCByYW5nZXNbaV0ubmV3UmFuZ2VFbmRPZmZzZXQpIHtcblx0XHRcdFx0XHQvLyBjbGlwIHRoZSByYW5nZSB0byB0aGUgcHJldmlvdXMgcmFuZ2Vcblx0XHRcdFx0XHRjb25zdCBzdGFydFBvc2l0aW9uID0gdGV4dE1vZGVsLmdldFBvc2l0aW9uQXQocmFuZ2VDaGFuZ2VzW2kgLSAxXS5lbmRPZmZzZXQgKyAxKTtcblx0XHRcdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShzdGFydFBvc2l0aW9uLmxpbmVOdW1iZXIsIHN0YXJ0UG9zaXRpb24uY29sdW1uLCByYW5nZXNbaV0ubmV3UmFuZ2UuZW5kTGluZU51bWJlciwgcmFuZ2VzW2ldLm5ld1JhbmdlLmVuZENvbHVtbik7XG5cdFx0XHRcdFx0cmFuZ2VDaGFuZ2VzLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRzdGFydE9mZnNldDogcmFuZ2VDaGFuZ2VzW2kgLSAxXS5lbmRPZmZzZXQgKyAxLFxuXHRcdFx0XHRcdFx0ZW5kT2Zmc2V0OiByYW5nZXNbaV0ubmV3UmFuZ2VFbmRPZmZzZXRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0Ly8gR2V0IHRoZSBjYXB0dXJlcyBpbW1lZGlhdGVseSB3aGlsZSB0aGUgdGV4dCBtb2RlbCBpcyBjb3JyZWN0XG5cdFx0Y29uc3QgY2FwdHVyZXMgPSByYW5nZUNoYW5nZXMubWFwKHJhbmdlID0+IHRoaXMuX2dldENhcHR1cmVzKHJhbmdlLnJhbmdlLCB0ZXh0TW9kZWxUcmVlU2l0dGVyLCB0cmVlKSk7XG5cdFx0Ly8gRG9uJ3QgYmxvY2tcblx0XHRyZXR1cm4gdGhpcy5fdXBkYXRlVHJlZUZvclJhbmdlcyh0ZXh0TW9kZWwsIHJhbmdlQ2hhbmdlcywgdmVyc2lvbklkLCB0cmVlLCBjYXB0dXJlcykudGhlbigoKSA9PiB7XG5cdFx0XHRjb25zdCB0cmVlID0gdGhpcy5fZ2V0VHJlZSh0ZXh0TW9kZWwpO1xuXHRcdFx0aWYgKCF0ZXh0TW9kZWwuaXNEaXNwb3NlZCgpICYmICh0cmVlPy5wYXJzZVJlc3VsdD8udmVyc2lvbklkID09PSB0ZXh0TW9kZWwuZ2V0VmVyc2lvbklkKCkpKSB7XG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hOZWVkc1JlZnJlc2godGV4dE1vZGVsLCB2ZXJzaW9uSWQpO1xuXHRcdFx0fVxuXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVUcmVlRm9yUmFuZ2VzKHRleHRNb2RlbDogSVRleHRNb2RlbCwgcmFuZ2VDaGFuZ2VzOiBSYW5nZVdpdGhPZmZzZXRzW10sIHZlcnNpb25JZDogbnVtYmVyLCB0cmVlOiBQYXJzZXIuVHJlZSwgY2FwdHVyZXM6IFF1ZXJ5Q2FwdHVyZVtdW10pIHtcblx0XHRsZXQgdG9rZW5VcGRhdGU6IHsgbmV3VG9rZW5zOiBUb2tlblVwZGF0ZVtdIH0gfCB1bmRlZmluZWQ7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJhbmdlQ2hhbmdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKCF0ZXh0TW9kZWwuaXNEaXNwb3NlZCgpICYmIHZlcnNpb25JZCAhPT0gdGV4dE1vZGVsLmdldFZlcnNpb25JZCgpKSB7XG5cdFx0XHRcdC8vIE91ciBjYXB0dXJlcyBoYXZlIGJlY29tZSBpbnZhbGlkIGFuZCB3ZSBuZWVkIHRvIHJlLWNhcHR1cmVcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjYXB0dXJlID0gY2FwdHVyZXNbaV07XG5cdFx0XHRjb25zdCByYW5nZSA9IHJhbmdlQ2hhbmdlc1tpXTtcblxuXHRcdFx0Y29uc3QgdXBkYXRlcyA9IHRoaXMuZ2V0VG9rZW5zSW5SYW5nZSh0ZXh0TW9kZWwsIHJhbmdlLnJhbmdlLCByYW5nZS5zdGFydE9mZnNldCwgcmFuZ2UuZW5kT2Zmc2V0LCB0cmVlLCBjYXB0dXJlKTtcblx0XHRcdGlmICh1cGRhdGVzKSB7XG5cdFx0XHRcdHRva2VuVXBkYXRlID0geyBuZXdUb2tlbnM6IHVwZGF0ZXMgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRva2VuVXBkYXRlID0geyBuZXdUb2tlbnM6IFtdIH07XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl90b2tlbml6YXRpb25TdG9yZVNlcnZpY2UudXBkYXRlVG9rZW5zKHRleHRNb2RlbCwgdmVyc2lvbklkLCBbdG9rZW5VcGRhdGVdLCBUb2tlblF1YWxpdHkuQWNjdXJhdGUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VUb2tlbnMuZmlyZSh7XG5cdFx0XHRcdHRleHRNb2RlbDogdGV4dE1vZGVsLFxuXHRcdFx0XHRjaGFuZ2VzOiB7XG5cdFx0XHRcdFx0c2VtYW50aWNUb2tlbnNBcHBsaWVkOiBmYWxzZSxcblx0XHRcdFx0XHRyYW5nZXM6IFt7IGZyb21MaW5lTnVtYmVyOiByYW5nZS5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkubGluZU51bWJlciwgdG9MaW5lTnVtYmVyOiByYW5nZS5yYW5nZS5nZXRFbmRQb3NpdGlvbigpLmxpbmVOdW1iZXIgfV1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldFRpbWVvdXQwKHJlc29sdmUpKTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDb21wbGV0ZUJhY2tncm91bmRUb2tlbml6YXRpb24uZmlyZSh7IHRleHRNb2RlbCB9KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZnJlc2hOZWVkc1JlZnJlc2godGV4dE1vZGVsOiBJVGV4dE1vZGVsLCB2ZXJzaW9uSWQ6IG51bWJlcikge1xuXHRcdGNvbnN0IHJhbmdlc1RvUmVmcmVzaCA9IHRoaXMuX3Rva2VuaXphdGlvblN0b3JlU2VydmljZS5nZXROZWVkc1JlZnJlc2godGV4dE1vZGVsKTtcblx0XHRpZiAocmFuZ2VzVG9SZWZyZXNoLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCByYW5nZUNoYW5nZXM6IFJhbmdlQ2hhbmdlW10gPSBuZXcgQXJyYXkocmFuZ2VzVG9SZWZyZXNoLmxlbmd0aCk7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJhbmdlc1RvUmVmcmVzaC5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSByYW5nZXNUb1JlZnJlc2hbaV07XG5cdFx0XHRyYW5nZUNoYW5nZXNbaV0gPSB7XG5cdFx0XHRcdG5ld1JhbmdlOiByYW5nZS5yYW5nZSxcblx0XHRcdFx0bmV3UmFuZ2VTdGFydE9mZnNldDogcmFuZ2Uuc3RhcnRPZmZzZXQsXG5cdFx0XHRcdG5ld1JhbmdlRW5kT2Zmc2V0OiByYW5nZS5lbmRPZmZzZXRcblx0XHRcdH07XG5cdFx0fVxuXHRcdGNvbnN0IHRyZWUgPSB0aGlzLl9nZXRUcmVlKHRleHRNb2RlbCk7XG5cdFx0aWYgKHRyZWU/LnBhcnNlUmVzdWx0Py50cmVlICYmIHRyZWUucGFyc2VSZXN1bHQudmVyc2lvbklkID09PSB2ZXJzaW9uSWQpIHtcblx0XHRcdHRoaXMuX2hhbmRsZVRyZWVVcGRhdGUocmFuZ2VDaGFuZ2VzLCB0ZXh0TW9kZWwsIHZlcnNpb25JZCwgdHJlZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmFuZ2VUb2tlbnNBc1VwZGF0ZXMocmFuZ2VPZmZzZXQ6IG51bWJlciwgZW5kT2Zmc2V0VG9rZW46IEVuZE9mZnNldFRva2VuW10sIHN0YXJ0aW5nT2Zmc2V0SW5BcnJheT86IG51bWJlcikge1xuXHRcdGNvbnN0IHVwZGF0ZXM6IFRva2VuVXBkYXRlW10gPSBbXTtcblx0XHRsZXQgbGFzdEVuZCA9IDA7XG5cdFx0Zm9yIChjb25zdCB0b2tlbiBvZiBlbmRPZmZzZXRUb2tlbikge1xuXHRcdFx0aWYgKHRva2VuLmVuZE9mZnNldCA8PSBsYXN0RW5kIHx8IChzdGFydGluZ09mZnNldEluQXJyYXkgJiYgKHRva2VuLmVuZE9mZnNldCA8IHN0YXJ0aW5nT2Zmc2V0SW5BcnJheSkpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0bGV0IHRva2VuVXBkYXRlOiBUb2tlblVwZGF0ZTtcblx0XHRcdGlmIChzdGFydGluZ09mZnNldEluQXJyYXkgJiYgKGxhc3RFbmQgPCBzdGFydGluZ09mZnNldEluQXJyYXkpKSB7XG5cdFx0XHRcdHRva2VuVXBkYXRlID0geyBzdGFydE9mZnNldEluY2x1c2l2ZTogcmFuZ2VPZmZzZXQgKyBzdGFydGluZ09mZnNldEluQXJyYXksIGxlbmd0aDogdG9rZW4uZW5kT2Zmc2V0IC0gc3RhcnRpbmdPZmZzZXRJbkFycmF5LCB0b2tlbjogdG9rZW4ubWV0YWRhdGEgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRva2VuVXBkYXRlID0geyBzdGFydE9mZnNldEluY2x1c2l2ZTogcmFuZ2VPZmZzZXQgKyBsYXN0RW5kLCBsZW5ndGg6IHRva2VuLmVuZE9mZnNldCAtIGxhc3RFbmQsIHRva2VuOiB0b2tlbi5tZXRhZGF0YSB9O1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlcy5wdXNoKHRva2VuVXBkYXRlKTtcblx0XHRcdGxhc3RFbmQgPSB0b2tlbi5lbmRPZmZzZXQ7XG5cdFx0fVxuXHRcdHJldHVybiB1cGRhdGVzO1xuXHR9XG5cblx0cHVibGljIGdldFRva2Vuc0luUmFuZ2UodGV4dE1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZTogUmFuZ2UsIHJhbmdlU3RhcnRPZmZzZXQ6IG51bWJlciwgcmFuZ2VFbmRPZmZzZXQ6IG51bWJlciwgdHJlZT86IFBhcnNlci5UcmVlLCBjYXB0dXJlcz86IFF1ZXJ5Q2FwdHVyZVtdKTogVG9rZW5VcGRhdGVbXSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgdG9rZW5zID0gY2FwdHVyZXMgPyB0aGlzLl90b2tlbml6ZUNhcHR1cmVzV2l0aE1ldGFkYXRhKHRyZWUsIGNhcHR1cmVzLCByYW5nZVN0YXJ0T2Zmc2V0LCByYW5nZUVuZE9mZnNldCkgOiB0aGlzLl90b2tlbml6ZShyYW5nZSwgcmFuZ2VTdGFydE9mZnNldCwgcmFuZ2VFbmRPZmZzZXQsIHRleHRNb2RlbCk7XG5cdFx0aWYgKHRva2Vucz8uZW5kT2Zmc2V0c0FuZE1ldGFkYXRhKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmFuZ2VUb2tlbnNBc1VwZGF0ZXMocmFuZ2VTdGFydE9mZnNldCwgdG9rZW5zLmVuZE9mZnNldHNBbmRNZXRhZGF0YSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRUcmVlKHRleHRNb2RlbDogSVRleHRNb2RlbCk6IElUZXh0TW9kZWxUcmVlU2l0dGVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdHJlZVNpdHRlclNlcnZpY2UuZ2V0UGFyc2VSZXN1bHQodGV4dE1vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgX2Vuc3VyZVF1ZXJ5KCkge1xuXHRcdGlmICghdGhpcy5fcXVlcnkpIHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlID0gdGhpcy5fdHJlZVNpdHRlclNlcnZpY2UuZ2V0T3JJbml0TGFuZ3VhZ2UodGhpcy5fbGFuZ3VhZ2VJZCk7XG5cdFx0XHRpZiAoIWxhbmd1YWdlKSB7XG5cdFx0XHRcdGlmICghdGhpcy5fbGFuZ3VhZ2VBZGRlZExpc3RlbmVyKSB7XG5cdFx0XHRcdFx0dGhpcy5fbGFuZ3VhZ2VBZGRlZExpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIoRXZlbnQub25jZUlmKHRoaXMuX3RyZWVTaXR0ZXJTZXJ2aWNlLm9uRGlkQWRkTGFuZ3VhZ2UsIGUgPT4gZS5pZCA9PT0gdGhpcy5fbGFuZ3VhZ2VJZCkoKGUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuX3F1ZXJ5ID0gbmV3IHRoaXMuUXVlcnkoZS5sYW5ndWFnZSwgdGhpcy5fcXVlcmllcyk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3F1ZXJ5ID0gbmV3IHRoaXMuUXVlcnkobGFuZ3VhZ2UsIHRoaXMuX3F1ZXJpZXMpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcXVlcnk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVUaGVtZShlOiBJV29ya2JlbmNoQ29sb3JUaGVtZSB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2NvbG9yVGhlbWVEYXRhID0gdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSBhcyBDb2xvclRoZW1lRGF0YTtcblx0XHRmb3IgKGNvbnN0IG1vZGVsIG9mIHRoaXMuX2NvZGVFZGl0b3JzLnRleHRNb2RlbHMpIHtcblx0XHRcdGNvbnN0IG1vZGVsUmFuZ2UgPSBtb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpO1xuXHRcdFx0dGhpcy5fdG9rZW5pemF0aW9uU3RvcmVTZXJ2aWNlLm1hcmtGb3JSZWZyZXNoKG1vZGVsLCBtb2RlbFJhbmdlKTtcblx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX2NvZGVFZGl0b3JzLmdldEVkaXRvckZvck1vZGVsKG1vZGVsKTtcblx0XHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdFx0dGhpcy5fcGFyc2VBbmRUb2tlbml6ZVZpZXdQb3J0KG1vZGVsLCBlZGl0b3IuZ2V0VmlzaWJsZVJhbmdlc1BsdXNWaWV3cG9ydEFib3ZlQmVsb3coKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y2FwdHVyZUF0UG9zaXRpb24obGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlciwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsKTogUXVlcnlDYXB0dXJlW10ge1xuXHRcdGNvbnN0IHRleHRNb2RlbFRyZWVTaXR0ZXIgPSB0aGlzLl9nZXRUcmVlKHRleHRNb2RlbCk7XG5cdFx0aWYgKCF0ZXh0TW9kZWxUcmVlU2l0dGVyPy5wYXJzZVJlc3VsdD8udHJlZSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRjb25zdCBjYXB0dXJlcyA9IHRoaXMuX2NhcHR1cmVBdFJhbmdlV2l0aEluamVjdGlvbnMobmV3IFJhbmdlKGxpbmVOdW1iZXIsIGNvbHVtbiwgbGluZU51bWJlciwgY29sdW1uICsgMSksIHRleHRNb2RlbFRyZWVTaXR0ZXIsIHRleHRNb2RlbFRyZWVTaXR0ZXIucGFyc2VSZXN1bHQudHJlZSk7XG5cdFx0cmV0dXJuIGNhcHR1cmVzO1xuXHR9XG5cblx0Y2FwdHVyZUF0UmFuZ2VUcmVlKHJhbmdlOiBSYW5nZSwgdHJlZTogUGFyc2VyLlRyZWUsIHRleHRNb2RlbFRyZWVTaXR0ZXI6IElUZXh0TW9kZWxUcmVlU2l0dGVyIHwgdW5kZWZpbmVkKTogUXVlcnlDYXB0dXJlW10ge1xuXHRcdGNvbnN0IGNhcHR1cmVzID0gdGV4dE1vZGVsVHJlZVNpdHRlciA/IHRoaXMuX2NhcHR1cmVBdFJhbmdlV2l0aEluamVjdGlvbnMocmFuZ2UsIHRleHRNb2RlbFRyZWVTaXR0ZXIsIHRyZWUpIDogdGhpcy5fY2FwdHVyZUF0UmFuZ2UocmFuZ2UsIHRyZWUpO1xuXHRcdHJldHVybiBjYXB0dXJlcztcblx0fVxuXG5cdHByaXZhdGUgX2NhcHR1cmVBdFJhbmdlKHJhbmdlOiBSYW5nZSwgdHJlZTogUGFyc2VyLlRyZWUgfCB1bmRlZmluZWQpOiBRdWVyeUNhcHR1cmVbXSB7XG5cdFx0Y29uc3QgcXVlcnkgPSB0aGlzLl9lbnN1cmVRdWVyeSgpO1xuXHRcdGlmICghdHJlZSB8fCAhcXVlcnkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Ly8gVHJlZSBzaXR0ZXIgcm93IGlzIDAgYmFzZWQsIGNvbHVtbiBpcyAwIGJhc2VkXG5cdFx0cmV0dXJuIHF1ZXJ5LmNhcHR1cmVzKHRyZWUucm9vdE5vZGUsIHsgc3RhcnRQb3NpdGlvbjogeyByb3c6IHJhbmdlLnN0YXJ0TGluZU51bWJlciAtIDEsIGNvbHVtbjogcmFuZ2Uuc3RhcnRDb2x1bW4gLSAxIH0sIGVuZFBvc2l0aW9uOiB7IHJvdzogcmFuZ2UuZW5kTGluZU51bWJlciAtIDEsIGNvbHVtbjogcmFuZ2UuZW5kQ29sdW1uIC0gMSB9IH0pLm1hcChjYXB0dXJlID0+IChcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogY2FwdHVyZS5uYW1lLFxuXHRcdFx0XHR0ZXh0OiBjYXB0dXJlLm5vZGUudGV4dCxcblx0XHRcdFx0bm9kZToge1xuXHRcdFx0XHRcdHN0YXJ0SW5kZXg6IGNhcHR1cmUubm9kZS5zdGFydEluZGV4LFxuXHRcdFx0XHRcdGVuZEluZGV4OiBjYXB0dXJlLm5vZGUuZW5kSW5kZXgsXG5cdFx0XHRcdFx0c3RhcnRQb3NpdGlvbjoge1xuXHRcdFx0XHRcdFx0bGluZU51bWJlcjogY2FwdHVyZS5ub2RlLnN0YXJ0UG9zaXRpb24ucm93ICsgMSxcblx0XHRcdFx0XHRcdGNvbHVtbjogY2FwdHVyZS5ub2RlLnN0YXJ0UG9zaXRpb24uY29sdW1uICsgMVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZW5kUG9zaXRpb246IHtcblx0XHRcdFx0XHRcdGxpbmVOdW1iZXI6IGNhcHR1cmUubm9kZS5lbmRQb3NpdGlvbi5yb3cgKyAxLFxuXHRcdFx0XHRcdFx0Y29sdW1uOiBjYXB0dXJlLm5vZGUuZW5kUG9zaXRpb24uY29sdW1uICsgMVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0ZW5jb2RlZExhbmd1YWdlSWQ6IHRoaXMuX2VuY29kZWRMYW5ndWFnZUlkXG5cdFx0XHR9XG5cdFx0KSk7XG5cdH1cblxuXHRwcml2YXRlIF9jYXB0dXJlQXRSYW5nZVdpdGhJbmplY3Rpb25zKHJhbmdlOiBSYW5nZSwgdGV4dE1vZGVsVHJlZVNpdHRlcjogSVRleHRNb2RlbFRyZWVTaXR0ZXIsIHRyZWU6IFBhcnNlci5UcmVlKTogUXVlcnlDYXB0dXJlW10ge1xuXHRcdGNvbnN0IHF1ZXJ5ID0gdGhpcy5fZW5zdXJlUXVlcnkoKTtcblx0XHRpZiAoIXRleHRNb2RlbFRyZWVTaXR0ZXI/LnBhcnNlUmVzdWx0IHx8ICFxdWVyeSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRjb25zdCBjYXB0dXJlczogUXVlcnlDYXB0dXJlW10gPSB0aGlzLl9jYXB0dXJlQXRSYW5nZShyYW5nZSwgdHJlZSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjYXB0dXJlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgY2FwdHVyZSA9IGNhcHR1cmVzW2ldO1xuXG5cdFx0XHRjb25zdCBjYXBTdGFydExpbmUgPSBjYXB0dXJlLm5vZGUuc3RhcnRQb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgY2FwRW5kTGluZSA9IGNhcHR1cmUubm9kZS5lbmRQb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgY2FwU3RhcnRDb2x1bW4gPSBjYXB0dXJlLm5vZGUuc3RhcnRQb3NpdGlvbi5jb2x1bW47XG5cdFx0XHRjb25zdCBjYXBFbmRDb2x1bW4gPSBjYXB0dXJlLm5vZGUuZW5kUG9zaXRpb24uY29sdW1uO1xuXG5cdFx0XHRjb25zdCBzdGFydExpbmUgPSAoKGNhcFN0YXJ0TGluZSA+IHJhbmdlLnN0YXJ0TGluZU51bWJlcikgJiYgKGNhcFN0YXJ0TGluZSA8IHJhbmdlLmVuZExpbmVOdW1iZXIpKSA/IGNhcFN0YXJ0TGluZSA6IHJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGNvbnN0IGVuZExpbmUgPSAoKGNhcEVuZExpbmUgPiByYW5nZS5zdGFydExpbmVOdW1iZXIpICYmIChjYXBFbmRMaW5lIDwgcmFuZ2UuZW5kTGluZU51bWJlcikpID8gY2FwRW5kTGluZSA6IHJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IChjYXBTdGFydExpbmUgPT09IHJhbmdlLnN0YXJ0TGluZU51bWJlcikgPyAoY2FwU3RhcnRDb2x1bW4gPCByYW5nZS5zdGFydENvbHVtbiA/IHJhbmdlLnN0YXJ0Q29sdW1uIDogY2FwU3RhcnRDb2x1bW4pIDogKGNhcFN0YXJ0TGluZSA8IHJhbmdlLnN0YXJ0TGluZU51bWJlciA/IHJhbmdlLnN0YXJ0Q29sdW1uIDogY2FwU3RhcnRDb2x1bW4pO1xuXHRcdFx0Y29uc3QgZW5kQ29sdW1uID0gKGNhcEVuZExpbmUgPT09IHJhbmdlLmVuZExpbmVOdW1iZXIpID8gKGNhcEVuZENvbHVtbiA+IHJhbmdlLmVuZENvbHVtbiA/IHJhbmdlLmVuZENvbHVtbiA6IGNhcEVuZENvbHVtbikgOiAoY2FwRW5kTGluZSA+IHJhbmdlLmVuZExpbmVOdW1iZXIgPyByYW5nZS5lbmRDb2x1bW4gOiBjYXBFbmRDb2x1bW4pO1xuXHRcdFx0Y29uc3QgaW5qZWN0aW9uUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnRMaW5lLCBzdGFydENvbHVtbiwgZW5kTGluZSwgZW5kQ29sdW1uKTtcblxuXHRcdFx0Y29uc3QgaW5qZWN0aW9uID0gdGhpcy5fZ2V0SW5qZWN0aW9uQ2FwdHVyZXModGV4dE1vZGVsVHJlZVNpdHRlciwgY2FwdHVyZSwgaW5qZWN0aW9uUmFuZ2UpO1xuXHRcdFx0aWYgKGluamVjdGlvbiAmJiBpbmplY3Rpb24ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjYXB0dXJlcy5zcGxpY2UoaSArIDEsIDAsIC4uLmluamVjdGlvbik7XG5cdFx0XHRcdGkgKz0gaW5qZWN0aW9uLmxlbmd0aDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNhcHR1cmVzO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIHRva2VucyBmb3IgYSBnaXZlbiBsaW5lLlxuXHQgKiBFYWNoIHRva2VuIHRha2VzIDIgZWxlbWVudHMgaW4gdGhlIGFycmF5LiBUaGUgZmlyc3QgZWxlbWVudCBpcyB0aGUgb2Zmc2V0IG9mIHRoZSBlbmQgb2YgdGhlIHRva2VuICppbiB0aGUgbGluZSwgbm90IGluIHRoZSBkb2N1bWVudCosIGFuZCB0aGUgc2Vjb25kIGVsZW1lbnQgaXMgdGhlIG1ldGFkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0gbGluZU51bWJlclxuXHQgKiBAcmV0dXJuc1xuXHQgKi9cblx0cHVibGljIHRva2VuaXplRW5jb2RlZChsaW5lTnVtYmVyOiBudW1iZXIsIHRleHRNb2RlbDogSVRleHRNb2RlbCkge1xuXHRcdGNvbnN0IHRva2VucyA9IHRoaXMuX3Rva2VuaXplRW5jb2RlZChsaW5lTnVtYmVyLCB0ZXh0TW9kZWwpO1xuXHRcdGlmICghdG9rZW5zKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCB1cGRhdGVzID0gdGhpcy5fcmFuZ2VUb2tlbnNBc1VwZGF0ZXModGV4dE1vZGVsLmdldE9mZnNldEF0KHsgbGluZU51bWJlciwgY29sdW1uOiAxIH0pLCB0b2tlbnMucmVzdWx0KTtcblx0XHRpZiAodG9rZW5zLnZlcnNpb25JZCA9PT0gdGV4dE1vZGVsLmdldFZlcnNpb25JZCgpKSB7XG5cdFx0XHR0aGlzLl90b2tlbml6YXRpb25TdG9yZVNlcnZpY2UudXBkYXRlVG9rZW5zKHRleHRNb2RlbCwgdG9rZW5zLnZlcnNpb25JZCwgW3sgbmV3VG9rZW5zOiB1cGRhdGVzLCBvbGRSYW5nZUxlbmd0aDogdGV4dE1vZGVsLmdldExpbmVMZW5ndGgobGluZU51bWJlcikgfV0sIFRva2VuUXVhbGl0eS5BY2N1cmF0ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHRva2VuaXplRW5jb2RlZEluc3RydW1lbnRlZChsaW5lTnVtYmVyOiBudW1iZXIsIHRleHRNb2RlbDogSVRleHRNb2RlbCk6IHsgcmVzdWx0OiBVaW50MzJBcnJheTsgY2FwdHVyZVRpbWU6IG51bWJlcjsgbWV0YWRhdGFUaW1lOiBudW1iZXIgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgdG9rZW5zID0gdGhpcy5fdG9rZW5pemVFbmNvZGVkKGxpbmVOdW1iZXIsIHRleHRNb2RlbCk7XG5cdFx0aWYgKCF0b2tlbnMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB7IHJlc3VsdDogdGhpcy5fZW5kT2Zmc2V0VG9rZW5zVG9VaW50MzJBcnJheSh0b2tlbnMucmVzdWx0KSwgY2FwdHVyZVRpbWU6IHRva2Vucy5jYXB0dXJlVGltZSwgbWV0YWRhdGFUaW1lOiB0b2tlbnMubWV0YWRhdGFUaW1lIH07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDYXB0dXJlcyhyYW5nZTogUmFuZ2UsIHRleHRNb2RlbFRyZWVTaXR0ZXI6IElUZXh0TW9kZWxUcmVlU2l0dGVyLCB0cmVlOiBQYXJzZXIuVHJlZSk6IFF1ZXJ5Q2FwdHVyZVtdIHtcblx0XHRjb25zdCBjYXB0dXJlcyA9IHRoaXMuX2NhcHR1cmVBdFJhbmdlV2l0aEluamVjdGlvbnMocmFuZ2UsIHRleHRNb2RlbFRyZWVTaXR0ZXIsIHRyZWUpO1xuXHRcdHJldHVybiBjYXB0dXJlcztcblx0fVxuXG5cdHByaXZhdGUgX3Rva2VuaXplKHJhbmdlOiBSYW5nZSwgcmFuZ2VTdGFydE9mZnNldDogbnVtYmVyLCByYW5nZUVuZE9mZnNldDogbnVtYmVyLCB0ZXh0TW9kZWw6IElUZXh0TW9kZWwpOiB7IGVuZE9mZnNldHNBbmRNZXRhZGF0YTogeyBlbmRPZmZzZXQ6IG51bWJlcjsgbWV0YWRhdGE6IG51bWJlciB9W107IHZlcnNpb25JZDogbnVtYmVyOyBjYXB0dXJlVGltZTogbnVtYmVyOyBtZXRhZGF0YVRpbWU6IG51bWJlciB9IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB0cmVlID0gdGhpcy5fZ2V0VHJlZSh0ZXh0TW9kZWwpO1xuXHRcdGlmICghdHJlZT8ucGFyc2VSZXN1bHQ/LnRyZWUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGNhcHR1cmVzID0gdGhpcy5fZ2V0Q2FwdHVyZXMocmFuZ2UsIHRyZWUsIHRyZWUucGFyc2VSZXN1bHQudHJlZSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fdG9rZW5pemVDYXB0dXJlc1dpdGhNZXRhZGF0YSh0cmVlLnBhcnNlUmVzdWx0LnRyZWUsIGNhcHR1cmVzLCByYW5nZVN0YXJ0T2Zmc2V0LCByYW5nZUVuZE9mZnNldCk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB7IC4uLnJlc3VsdCwgdmVyc2lvbklkOiB0cmVlLnBhcnNlUmVzdWx0LnZlcnNpb25JZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlVG9rZW5zRnJvbUNhcHR1cmVzKHRyZWU6IFBhcnNlci5UcmVlIHwgdW5kZWZpbmVkLCBjYXB0dXJlczogUXVlcnlDYXB0dXJlW10sIHJhbmdlU3RhcnRPZmZzZXQ6IG51bWJlciwgcmFuZ2VFbmRPZmZzZXQ6IG51bWJlcik6IHsgZW5kT2Zmc2V0czogRW5kT2Zmc2V0QW5kU2NvcGVzW107IGNhcHR1cmVUaW1lOiBudW1iZXIgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgc3RvcHdhdGNoID0gU3RvcFdhdGNoLmNyZWF0ZSgpO1xuXHRcdGNvbnN0IHJhbmdlTGVuZ3RoID0gcmFuZ2VFbmRPZmZzZXQgLSByYW5nZVN0YXJ0T2Zmc2V0O1xuXHRcdGNvbnN0IGVuY29kZWRMYW5ndWFnZUlkID0gdGhpcy5fbGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQodGhpcy5fbGFuZ3VhZ2VJZCk7XG5cdFx0Y29uc3QgYmFzZVNjb3BlOiBzdHJpbmcgPSBUUkVFU0lUVEVSX0JBU0VfU0NPUEVTW3RoaXMuX2xhbmd1YWdlSWRdIHx8ICdzb3VyY2UnO1xuXG5cdFx0aWYgKGNhcHR1cmVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0aWYgKHRyZWUpIHtcblx0XHRcdFx0c3RvcHdhdGNoLnN0b3AoKTtcblx0XHRcdFx0Y29uc3QgZW5kT2Zmc2V0c0FuZE1ldGFkYXRhID0gW3sgZW5kT2Zmc2V0OiByYW5nZUxlbmd0aCwgc2NvcGVzOiBbXSwgZW5jb2RlZExhbmd1YWdlSWQgfV07XG5cdFx0XHRcdHJldHVybiB7IGVuZE9mZnNldHM6IGVuZE9mZnNldHNBbmRNZXRhZGF0YSwgY2FwdHVyZVRpbWU6IHN0b3B3YXRjaC5lbGFwc2VkKCkgfTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZW5kT2Zmc2V0c0FuZFNjb3BlczogRW5kT2Zmc2V0QW5kU2NvcGVzW10gPSBBcnJheShjYXB0dXJlcy5sZW5ndGgpO1xuXHRcdGVuZE9mZnNldHNBbmRTY29wZXMuZmlsbCh7IGVuZE9mZnNldDogMCwgc2NvcGVzOiBbYmFzZVNjb3BlXSwgZW5jb2RlZExhbmd1YWdlSWQgfSk7XG5cdFx0bGV0IHRva2VuSW5kZXggPSAwO1xuXG5cdFx0Y29uc3QgaW5jcmVhc2VTaXplT2ZUb2tlbnNCeU9uZVRva2VuID0gKCkgPT4ge1xuXHRcdFx0ZW5kT2Zmc2V0c0FuZFNjb3Blcy5wdXNoKHsgZW5kT2Zmc2V0OiAwLCBzY29wZXM6IFtiYXNlU2NvcGVdLCBlbmNvZGVkTGFuZ3VhZ2VJZCB9KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgYnJhY2tldHMgPSAoY2FwdHVyZTogUXVlcnlDYXB0dXJlLCBzdGFydE9mZnNldDogbnVtYmVyKTogbnVtYmVyW10gfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0cmV0dXJuIChjYXB0dXJlLm5hbWUuaW5jbHVkZXMoJ3B1bmN0dWF0aW9uJykgJiYgY2FwdHVyZS50ZXh0KSA/IEFycmF5LmZyb20oY2FwdHVyZS50ZXh0Lm1hdGNoQWxsKEJSQUNLRVRTKSkubWFwKG1hdGNoID0+IHN0YXJ0T2Zmc2V0ICsgbWF0Y2guaW5kZXgpIDogdW5kZWZpbmVkO1xuXHRcdH07XG5cblx0XHRjb25zdCBhZGRDdXJyZW50VG9rZW5Ub0FycmF5ID0gKGNhcHR1cmU6IFF1ZXJ5Q2FwdHVyZSwgc3RhcnRPZmZzZXQ6IG51bWJlciwgZW5kT2Zmc2V0OiBudW1iZXIsIHBvc2l0aW9uPzogbnVtYmVyKSA9PiB7XG5cdFx0XHRpZiAocG9zaXRpb24gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBvbGRTY29wZXMgPSBlbmRPZmZzZXRzQW5kU2NvcGVzW3Bvc2l0aW9uXS5zY29wZXM7XG5cdFx0XHRcdGxldCBvbGRCcmFja2V0ID0gZW5kT2Zmc2V0c0FuZFNjb3Blc1twb3NpdGlvbl0uYnJhY2tldDtcblx0XHRcdFx0Ly8gQ2hlY2sgdGhhdCB0aGUgcHJldmlvdXMgdG9rZW4gZW5kcyBhdCB0aGUgc2FtZSBwb2ludCB0aGF0IHRoZSBjdXJyZW50IHRva2VuIHN0YXJ0c1xuXHRcdFx0XHRjb25zdCBwcmV2RW5kT2Zmc2V0ID0gcG9zaXRpb24gPiAwID8gZW5kT2Zmc2V0c0FuZFNjb3Blc1twb3NpdGlvbiAtIDFdLmVuZE9mZnNldCA6IDA7XG5cdFx0XHRcdGlmIChwcmV2RW5kT2Zmc2V0ICE9PSBzdGFydE9mZnNldCkge1xuXHRcdFx0XHRcdGxldCBwcmVJbnNlcnRCcmFja2V0OiBudW1iZXJbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRpZiAob2xkQnJhY2tldCAmJiBvbGRCcmFja2V0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdHByZUluc2VydEJyYWNrZXQgPSBbXTtcblx0XHRcdFx0XHRcdGNvbnN0IHBvc3RJbnNlcnRCcmFja2V0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBvbGRCcmFja2V0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGJyYWNrZXQgPSBvbGRCcmFja2V0W2ldO1xuXHRcdFx0XHRcdFx0XHRpZiAoYnJhY2tldCA8IHN0YXJ0T2Zmc2V0KSB7XG5cdFx0XHRcdFx0XHRcdFx0cHJlSW5zZXJ0QnJhY2tldC5wdXNoKGJyYWNrZXQpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGJyYWNrZXQgPiBlbmRPZmZzZXQpIHtcblx0XHRcdFx0XHRcdFx0XHRwb3N0SW5zZXJ0QnJhY2tldC5wdXNoKGJyYWNrZXQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAocHJlSW5zZXJ0QnJhY2tldC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdFx0cHJlSW5zZXJ0QnJhY2tldCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChwb3N0SW5zZXJ0QnJhY2tldC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdFx0b2xkQnJhY2tldCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG9sZEJyYWNrZXQgPSBwb3N0SW5zZXJ0QnJhY2tldDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gV2UgbmVlZCB0byBhZGQgc29tZSBvZiB0aGUgcG9zaXRpb24gdG9rZW4gdG8gY292ZXIgdGhlIHNwYWNlXG5cdFx0XHRcdFx0ZW5kT2Zmc2V0c0FuZFNjb3Blcy5zcGxpY2UocG9zaXRpb24sIDAsIHsgZW5kT2Zmc2V0OiBzdGFydE9mZnNldCwgc2NvcGVzOiBbLi4ub2xkU2NvcGVzXSwgYnJhY2tldDogcHJlSW5zZXJ0QnJhY2tldCwgZW5jb2RlZExhbmd1YWdlSWQ6IGNhcHR1cmUuZW5jb2RlZExhbmd1YWdlSWQgfSk7XG5cdFx0XHRcdFx0cG9zaXRpb24rKztcblx0XHRcdFx0XHRpbmNyZWFzZVNpemVPZlRva2Vuc0J5T25lVG9rZW4oKTtcblx0XHRcdFx0XHR0b2tlbkluZGV4Kys7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlbmRPZmZzZXRzQW5kU2NvcGVzLnNwbGljZShwb3NpdGlvbiwgMCwgeyBlbmRPZmZzZXQ6IGVuZE9mZnNldCwgc2NvcGVzOiBbLi4ub2xkU2NvcGVzLCBjYXB0dXJlLm5hbWVdLCBicmFja2V0OiBicmFja2V0cyhjYXB0dXJlLCBzdGFydE9mZnNldCksIGVuY29kZWRMYW5ndWFnZUlkOiBjYXB0dXJlLmVuY29kZWRMYW5ndWFnZUlkIH0pO1xuXHRcdFx0XHRlbmRPZmZzZXRzQW5kU2NvcGVzW3Rva2VuSW5kZXhdLmJyYWNrZXQgPSBvbGRCcmFja2V0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW5kT2Zmc2V0c0FuZFNjb3Blc1t0b2tlbkluZGV4XSA9IHsgZW5kT2Zmc2V0OiBlbmRPZmZzZXQsIHNjb3BlczogW2Jhc2VTY29wZSwgY2FwdHVyZS5uYW1lXSwgYnJhY2tldDogYnJhY2tldHMoY2FwdHVyZSwgc3RhcnRPZmZzZXQpLCBlbmNvZGVkTGFuZ3VhZ2VJZDogY2FwdHVyZS5lbmNvZGVkTGFuZ3VhZ2VJZCB9O1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5JbmRleCsrO1xuXHRcdH07XG5cblx0XHRmb3IgKGxldCBjYXB0dXJlSW5kZXggPSAwOyBjYXB0dXJlSW5kZXggPCBjYXB0dXJlcy5sZW5ndGg7IGNhcHR1cmVJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBjYXB0dXJlID0gY2FwdHVyZXNbY2FwdHVyZUluZGV4XTtcblx0XHRcdGNvbnN0IHRva2VuRW5kSW5kZXggPSBjYXB0dXJlLm5vZGUuZW5kSW5kZXggPCByYW5nZUVuZE9mZnNldCA/ICgoY2FwdHVyZS5ub2RlLmVuZEluZGV4IDwgcmFuZ2VTdGFydE9mZnNldCkgPyByYW5nZVN0YXJ0T2Zmc2V0IDogY2FwdHVyZS5ub2RlLmVuZEluZGV4KSA6IHJhbmdlRW5kT2Zmc2V0O1xuXHRcdFx0Y29uc3QgdG9rZW5TdGFydEluZGV4ID0gY2FwdHVyZS5ub2RlLnN0YXJ0SW5kZXggPCByYW5nZVN0YXJ0T2Zmc2V0ID8gcmFuZ2VTdGFydE9mZnNldCA6IGNhcHR1cmUubm9kZS5zdGFydEluZGV4O1xuXG5cdFx0XHRjb25zdCBlbmRPZmZzZXQgPSB0b2tlbkVuZEluZGV4IC0gcmFuZ2VTdGFydE9mZnNldDtcblxuXHRcdFx0Ly8gTm90IGV2ZXJ5IGNoYXJhY3RlciB3aWxsIGdldCBjYXB0dXJlZCwgc28gd2UgbmVlZCB0byBtYWtlIHN1cmUgdGhhdCBvdXIgY3VycmVudCBjYXB0dXJlIGRvZXNuJ3QgYmxlZWQgdG93YXJkIHRoZSBzdGFydCBvZiB0aGUgbGluZSBhbmQgY292ZXIgY2hhcmFjdGVycyB0aGF0IGl0IGRvZXNuJ3QgYXBwbHkgdG8uXG5cdFx0XHQvLyBXZSBkbyB0aGlzIGJ5IGNyZWF0aW5nIGEgbmV3IHRva2VuIGluIHRoZSBhcnJheSBpZiB0aGUgcHJldmlvdXMgdG9rZW4gZW5kcyBiZWZvcmUgdGhlIGN1cnJlbnQgdG9rZW4gc3RhcnRzLlxuXHRcdFx0bGV0IHByZXZpb3VzRW5kT2Zmc2V0OiBudW1iZXI7XG5cdFx0XHRjb25zdCBjdXJyZW50VG9rZW5MZW5ndGggPSB0b2tlbkVuZEluZGV4IC0gdG9rZW5TdGFydEluZGV4O1xuXHRcdFx0aWYgKGNhcHR1cmVJbmRleCA+IDApIHtcblx0XHRcdFx0cHJldmlvdXNFbmRPZmZzZXQgPSBlbmRPZmZzZXRzQW5kU2NvcGVzWyh0b2tlbkluZGV4IC0gMSldLmVuZE9mZnNldDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHByZXZpb3VzRW5kT2Zmc2V0ID0gdG9rZW5TdGFydEluZGV4IC0gcmFuZ2VTdGFydE9mZnNldCAtIDE7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzdGFydE9mZnNldCA9IGVuZE9mZnNldCAtIGN1cnJlbnRUb2tlbkxlbmd0aDtcblx0XHRcdGlmICgocHJldmlvdXNFbmRPZmZzZXQgPj0gMCkgJiYgKHByZXZpb3VzRW5kT2Zmc2V0IDwgc3RhcnRPZmZzZXQpKSB7XG5cdFx0XHRcdC8vIEFkZCBlbiBlbXB0eSB0b2tlbiB0byBjb3ZlciB0aGUgc3BhY2Ugd2hlcmUgdGhlcmUgd2VyZSBubyBjYXB0dXJlc1xuXHRcdFx0XHRlbmRPZmZzZXRzQW5kU2NvcGVzW3Rva2VuSW5kZXhdID0geyBlbmRPZmZzZXQ6IHN0YXJ0T2Zmc2V0LCBzY29wZXM6IFtiYXNlU2NvcGVdLCBlbmNvZGVkTGFuZ3VhZ2VJZDogdGhpcy5fZW5jb2RlZExhbmd1YWdlSWQgfTtcblx0XHRcdFx0dG9rZW5JbmRleCsrO1xuXG5cdFx0XHRcdGluY3JlYXNlU2l6ZU9mVG9rZW5zQnlPbmVUb2tlbigpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY3VycmVudFRva2VuTGVuZ3RoIDwgMCkge1xuXHRcdFx0XHQvLyBUaGlzIGhhcHBlbnMgd2hlbiB3ZSBoYXZlIGEgdG9rZW4gXCJnYXBcIiByaWdodCBhdCB0aGUgZW5kIG9mIHRoZSBjYXB0dXJlIHJhbmdlLiBUaGUgbGFzdCBjYXB0dXJlIGlzbid0IHVzZWQgYmVjYXVzZSBpdCdzIHN0YXJ0IGluZGV4IGlzbid0IGluY2x1ZGVkIGluIHRoZSByYW5nZS5cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwcmV2aW91c0VuZE9mZnNldCA+PSBlbmRPZmZzZXQpIHtcblx0XHRcdFx0Ly8gd2FsayBiYWNrIHRocm91Z2ggdGhlIHRva2VucyB1bnRpbCB3ZSBmaW5kIHRoZSBvbmUgdGhhdCBjb250YWlucyB0aGUgY3VycmVudCB0b2tlblxuXHRcdFx0XHRsZXQgd2l0aGluVG9rZW5JbmRleCA9IHRva2VuSW5kZXggLSAxO1xuXHRcdFx0XHRsZXQgcHJldmlvdXNUb2tlbkVuZE9mZnNldCA9IGVuZE9mZnNldHNBbmRTY29wZXNbd2l0aGluVG9rZW5JbmRleF0uZW5kT2Zmc2V0O1xuXG5cdFx0XHRcdGxldCBwcmV2aW91c1Rva2VuU3RhcnRPZmZzZXQgPSAoKHdpdGhpblRva2VuSW5kZXggPj0gMikgPyBlbmRPZmZzZXRzQW5kU2NvcGVzW3dpdGhpblRva2VuSW5kZXggLSAxXS5lbmRPZmZzZXQgOiAwKTtcblx0XHRcdFx0ZG8ge1xuXG5cdFx0XHRcdFx0Ly8gQ2hlY2sgdGhhdCB0aGUgY3VycmVudCB0b2tlbiBkb2Vzbid0IGp1c3QgcmVwbGFjZSB0aGUgbGFzdCB0b2tlblxuXHRcdFx0XHRcdGlmICgocHJldmlvdXNUb2tlblN0YXJ0T2Zmc2V0ICsgY3VycmVudFRva2VuTGVuZ3RoKSA9PT0gcHJldmlvdXNUb2tlbkVuZE9mZnNldCkge1xuXHRcdFx0XHRcdFx0aWYgKHByZXZpb3VzVG9rZW5TdGFydE9mZnNldCA9PT0gc3RhcnRPZmZzZXQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gQ3VycmVudCB0b2tlbiBhbmQgcHJldmlvdXMgdG9rZW4gc3BhbiB0aGUgZXhhY3Qgc2FtZSBjaGFyYWN0ZXJzLCBhZGQgdGhlIHNjb3BlcyB0byB0aGUgcHJldmlvdXMgdG9rZW5cblx0XHRcdFx0XHRcdFx0ZW5kT2Zmc2V0c0FuZFNjb3Blc1t3aXRoaW5Ub2tlbkluZGV4XS5zY29wZXMucHVzaChjYXB0dXJlLm5hbWUpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvbGRCcmFja2V0ID0gZW5kT2Zmc2V0c0FuZFNjb3Blc1t3aXRoaW5Ub2tlbkluZGV4XS5icmFja2V0O1xuXHRcdFx0XHRcdFx0XHRlbmRPZmZzZXRzQW5kU2NvcGVzW3dpdGhpblRva2VuSW5kZXhdLmJyYWNrZXQgPSAoKG9sZEJyYWNrZXQgJiYgKG9sZEJyYWNrZXQubGVuZ3RoID4gMCkpID8gb2xkQnJhY2tldCA6IGJyYWNrZXRzKGNhcHR1cmUsIHN0YXJ0T2Zmc2V0KSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChwcmV2aW91c1Rva2VuU3RhcnRPZmZzZXQgPD0gc3RhcnRPZmZzZXQpIHtcblx0XHRcdFx0XHRcdGFkZEN1cnJlbnRUb2tlblRvQXJyYXkoY2FwdHVyZSwgc3RhcnRPZmZzZXQsIGVuZE9mZnNldCwgd2l0aGluVG9rZW5JbmRleCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2l0aGluVG9rZW5JbmRleC0tO1xuXHRcdFx0XHRcdHByZXZpb3VzVG9rZW5TdGFydE9mZnNldCA9ICgod2l0aGluVG9rZW5JbmRleCA+PSAxKSA/IGVuZE9mZnNldHNBbmRTY29wZXNbd2l0aGluVG9rZW5JbmRleCAtIDFdLmVuZE9mZnNldCA6IDApO1xuXHRcdFx0XHRcdHByZXZpb3VzVG9rZW5FbmRPZmZzZXQgPSAoKHdpdGhpblRva2VuSW5kZXggPj0gMCkgPyBlbmRPZmZzZXRzQW5kU2NvcGVzW3dpdGhpblRva2VuSW5kZXhdLmVuZE9mZnNldCA6IDApO1xuXHRcdFx0XHR9IHdoaWxlIChwcmV2aW91c1Rva2VuRW5kT2Zmc2V0ID4gc3RhcnRPZmZzZXQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gSnVzdCBhZGQgdGhlIHRva2VuIHRvIHRoZSBhcnJheVxuXHRcdFx0XHRhZGRDdXJyZW50VG9rZW5Ub0FycmF5KGNhcHR1cmUsIHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFjY291bnQgZm9yIHVuY2FwdHVyZWQgY2hhcmFjdGVycyBhdCB0aGUgZW5kIG9mIHRoZSBsaW5lXG5cdFx0aWYgKChlbmRPZmZzZXRzQW5kU2NvcGVzW3Rva2VuSW5kZXggLSAxXS5lbmRPZmZzZXQgPCByYW5nZUxlbmd0aCkpIHtcblx0XHRcdGlmIChyYW5nZUxlbmd0aCAtIGVuZE9mZnNldHNBbmRTY29wZXNbdG9rZW5JbmRleCAtIDFdLmVuZE9mZnNldCA+IDApIHtcblx0XHRcdFx0aW5jcmVhc2VTaXplT2ZUb2tlbnNCeU9uZVRva2VuKCk7XG5cdFx0XHRcdGVuZE9mZnNldHNBbmRTY29wZXNbdG9rZW5JbmRleF0gPSB7IGVuZE9mZnNldDogcmFuZ2VMZW5ndGgsIHNjb3BlczogZW5kT2Zmc2V0c0FuZFNjb3Blc1t0b2tlbkluZGV4XS5zY29wZXMsIGVuY29kZWRMYW5ndWFnZUlkOiB0aGlzLl9lbmNvZGVkTGFuZ3VhZ2VJZCB9O1xuXHRcdFx0XHR0b2tlbkluZGV4Kys7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZW5kT2Zmc2V0c0FuZFNjb3Blcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgdG9rZW4gPSBlbmRPZmZzZXRzQW5kU2NvcGVzW2ldO1xuXHRcdFx0aWYgKHRva2VuLmVuZE9mZnNldCA9PT0gMCAmJiB0b2tlbi5zY29wZXMubGVuZ3RoID09PSAwICYmIGkgIT09IDApIHtcblx0XHRcdFx0ZW5kT2Zmc2V0c0FuZFNjb3Blcy5zcGxpY2UoaSwgZW5kT2Zmc2V0c0FuZFNjb3Blcy5sZW5ndGggLSBpKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGNhcHR1cmVUaW1lID0gc3RvcHdhdGNoLmVsYXBzZWQoKTtcblx0XHRyZXR1cm4geyBlbmRPZmZzZXRzOiBlbmRPZmZzZXRzQW5kU2NvcGVzIGFzIHsgZW5kT2Zmc2V0OiBudW1iZXI7IHNjb3Blczogc3RyaW5nW107IGVuY29kZWRMYW5ndWFnZUlkOiBMYW5ndWFnZUlkIH1bXSwgY2FwdHVyZVRpbWUgfTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEluamVjdGlvbkNhcHR1cmVzKHRleHRNb2RlbFRyZWVTaXR0ZXI6IElUZXh0TW9kZWxUcmVlU2l0dGVyLCBwYXJlbnRDYXB0dXJlOiBRdWVyeUNhcHR1cmUsIHJhbmdlOiBSYW5nZSkge1xuXHRcdGNvbnN0IGluamVjdGlvbiA9IHRleHRNb2RlbFRyZWVTaXR0ZXIuZ2V0SW5qZWN0aW9uKHBhcmVudENhcHR1cmUubm9kZS5zdGFydEluZGV4LCB0aGlzLl9sYW5ndWFnZUlkKTtcblx0XHRpZiAoIWluamVjdGlvbj8udHJlZSB8fCBpbmplY3Rpb24udmVyc2lvbklkICE9PSB0ZXh0TW9kZWxUcmVlU2l0dGVyLnBhcnNlUmVzdWx0Py52ZXJzaW9uSWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmVhdHVyZSA9IFRyZWVTaXR0ZXJUb2tlbml6YXRpb25SZWdpc3RyeS5nZXQoaW5qZWN0aW9uLmxhbmd1YWdlSWQpO1xuXHRcdGlmICghZmVhdHVyZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIGZlYXR1cmUuY2FwdHVyZUF0UmFuZ2VUcmVlKHJhbmdlLCBpbmplY3Rpb24udHJlZSwgdGV4dE1vZGVsVHJlZVNpdHRlcik7XG5cdH1cblxuXHRwcml2YXRlIF90b2tlbml6ZUNhcHR1cmVzV2l0aE1ldGFkYXRhKHRyZWU6IFBhcnNlci5UcmVlIHwgdW5kZWZpbmVkLCBjYXB0dXJlczogUXVlcnlDYXB0dXJlW10sIHJhbmdlU3RhcnRPZmZzZXQ6IG51bWJlciwgcmFuZ2VFbmRPZmZzZXQ6IG51bWJlcik6IHsgZW5kT2Zmc2V0c0FuZE1ldGFkYXRhOiBFbmRPZmZzZXRUb2tlbltdOyBjYXB0dXJlVGltZTogbnVtYmVyOyBtZXRhZGF0YVRpbWU6IG51bWJlciB9IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzdG9wd2F0Y2ggPSBTdG9wV2F0Y2guY3JlYXRlKCk7XG5cdFx0Y29uc3QgZW1wdHlUb2tlbnMgPSB0aGlzLl9jcmVhdGVUb2tlbnNGcm9tQ2FwdHVyZXModHJlZSwgY2FwdHVyZXMsIHJhbmdlU3RhcnRPZmZzZXQsIHJhbmdlRW5kT2Zmc2V0KTtcblx0XHRpZiAoIWVtcHR5VG9rZW5zKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBlbmRPZmZzZXRzQW5kU2NvcGVzOiBFbmRPZmZzZXRXaXRoTWV0YVtdID0gZW1wdHlUb2tlbnMuZW5kT2Zmc2V0cztcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGVuZE9mZnNldHNBbmRTY29wZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHRva2VuID0gZW5kT2Zmc2V0c0FuZFNjb3Blc1tpXTtcblx0XHRcdHRva2VuLm1ldGFkYXRhID0gZmluZE1ldGFkYXRhKHRoaXMuX2NvbG9yVGhlbWVEYXRhLCB0b2tlbi5zY29wZXMsIHRva2VuLmVuY29kZWRMYW5ndWFnZUlkLCAhIXRva2VuLmJyYWNrZXQgJiYgKHRva2VuLmJyYWNrZXQubGVuZ3RoID4gMCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1ldGFkYXRhVGltZSA9IHN0b3B3YXRjaC5lbGFwc2VkKCk7XG5cdFx0cmV0dXJuIHsgZW5kT2Zmc2V0c0FuZE1ldGFkYXRhOiBlbmRPZmZzZXRzQW5kU2NvcGVzIGFzIHsgZW5kT2Zmc2V0OiBudW1iZXI7IHNjb3Blczogc3RyaW5nW107IG1ldGFkYXRhOiBudW1iZXIgfVtdLCBjYXB0dXJlVGltZTogZW1wdHlUb2tlbnMuY2FwdHVyZVRpbWUsIG1ldGFkYXRhVGltZSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfZW1wdHlUb2tlbigpIHtcblx0XHRyZXR1cm4gZmluZE1ldGFkYXRhKHRoaXMuX2NvbG9yVGhlbWVEYXRhLCBbXSwgdGhpcy5fZW5jb2RlZExhbmd1YWdlSWQsIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgX3Rva2VuaXplRW5jb2RlZChsaW5lTnVtYmVyOiBudW1iZXIsIHRleHRNb2RlbDogSVRleHRNb2RlbCk6IHsgcmVzdWx0OiBFbmRPZmZzZXRUb2tlbltdOyBjYXB0dXJlVGltZTogbnVtYmVyOyBtZXRhZGF0YVRpbWU6IG51bWJlcjsgdmVyc2lvbklkOiBudW1iZXIgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbGluZU9mZnNldCA9IHRleHRNb2RlbC5nZXRPZmZzZXRBdCh7IGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsIGNvbHVtbjogMSB9KTtcblx0XHRjb25zdCBtYXhMaW5lID0gdGV4dE1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IGxpbmVFbmRPZmZzZXQgPSAobGluZU51bWJlciArIDEgPD0gbWF4TGluZSkgPyB0ZXh0TW9kZWwuZ2V0T2Zmc2V0QXQoeyBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyICsgMSwgY29sdW1uOiAxIH0pIDogdGV4dE1vZGVsLmdldFZhbHVlTGVuZ3RoKCk7XG5cdFx0Y29uc3QgbGluZUxlbmd0aCA9IGxpbmVFbmRPZmZzZXQgLSBsaW5lT2Zmc2V0O1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fdG9rZW5pemUobmV3IFJhbmdlKGxpbmVOdW1iZXIsIDEsIGxpbmVOdW1iZXIsIGxpbmVMZW5ndGggKyAxKSwgbGluZU9mZnNldCwgbGluZUVuZE9mZnNldCwgdGV4dE1vZGVsKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHsgcmVzdWx0OiByZXN1bHQuZW5kT2Zmc2V0c0FuZE1ldGFkYXRhLCBjYXB0dXJlVGltZTogcmVzdWx0LmNhcHR1cmVUaW1lLCBtZXRhZGF0YVRpbWU6IHJlc3VsdC5tZXRhZGF0YVRpbWUsIHZlcnNpb25JZDogcmVzdWx0LnZlcnNpb25JZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5kT2Zmc2V0VG9rZW5zVG9VaW50MzJBcnJheShlbmRPZmZzZXRzQW5kTWV0YWRhdGE6IEVuZE9mZnNldFRva2VuW10pOiBVaW50MzJBcnJheSB7XG5cblx0XHRjb25zdCB1aW50MzJBcnJheSA9IG5ldyBVaW50MzJBcnJheShlbmRPZmZzZXRzQW5kTWV0YWRhdGEubGVuZ3RoICogMik7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlbmRPZmZzZXRzQW5kTWV0YWRhdGEubGVuZ3RoOyBpKyspIHtcblx0XHRcdHVpbnQzMkFycmF5W2kgKiAyXSA9IGVuZE9mZnNldHNBbmRNZXRhZGF0YVtpXS5lbmRPZmZzZXQ7XG5cdFx0XHR1aW50MzJBcnJheVtpICogMiArIDFdID0gZW5kT2Zmc2V0c0FuZE1ldGFkYXRhW2ldLm1ldGFkYXRhO1xuXHRcdH1cblx0XHRyZXR1cm4gdWludDMyQXJyYXk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9xdWVyeT8uZGVsZXRlKCk7XG5cdFx0dGhpcy5fcXVlcnkgPSB1bmRlZmluZWQ7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVRyZWVTaXR0ZXJUb2tlbml6YXRpb25GZWF0dXJlLCBUcmVlU2l0dGVyVG9rZW5pemF0aW9uRmVhdHVyZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBWSxlQUFlLHVCQUFvQztBQUN4RSxTQUEwQixrQkFBa0I7QUFDNUMsU0FBMkQseUJBQXVDLHNDQUFzQztBQUV4SSxTQUFTLHVDQUF1QywwQkFBdUMscUJBQXFCLGtDQUEwRTtBQUV0TCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyxpQkFBaUIsNkJBQTZCO0FBQ3ZELFNBQXlCLG9CQUFvQjtBQUM3QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDJDQUEyQztBQUVwRCxTQUFTLG9CQUFpQztBQUMxQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBK0IsOEJBQThCO0FBQzdELFNBQVMsZ0JBQWdCO0FBSWxCLE1BQU0saUNBQWlDLGdCQUFnRCwrQkFBK0I7QUFzQnRILE1BQU0seUJBQWlEO0FBQUEsRUFDN0QsT0FBTztBQUFBLEVBQ1AsY0FBYztBQUFBLEVBQ2QsT0FBTztBQUFBLEVBQ1AsU0FBUztBQUNWO0FBRUEsTUFB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
