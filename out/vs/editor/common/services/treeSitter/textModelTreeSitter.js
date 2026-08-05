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
import { ITreeSitterImporter } from "../treeSitterParserService.js";
import { Disposable, DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { setTimeout0 } from "../../../../base/common/platform.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { cancelOnDispose } from "../../../../base/common/cancellation.js";
import { Range } from "../../core/range.js";
import { LimitedQueue } from "../../../../base/common/async.js";
import { TextLength } from "../../core/textLength.js";
import { FileAccess } from "../../../../base/common/network.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { CancellationError, isCancellationError } from "../../../../base/common/errors.js";
import { getClosestPreviousNodes, gotoNthChild, gotoParent, nextSiblingOrParentSibling } from "./cursorUtils.js";
var TelemetryParseType = /* @__PURE__ */ ((TelemetryParseType2) => {
  TelemetryParseType2["Full"] = "fullParse";
  TelemetryParseType2["Incremental"] = "incrementalParse";
  return TelemetryParseType2;
})(TelemetryParseType || {});
let TextModelTreeSitter = class extends Disposable {
  constructor(textModel, _treeSitterLanguages, parseImmediately = true, _treeSitterImporter, _logService, _telemetryService, _fileService) {
    super();
    this.textModel = textModel;
    this._treeSitterLanguages = _treeSitterLanguages;
    this._treeSitterImporter = _treeSitterImporter;
    this._logService = _logService;
    this._telemetryService = _telemetryService;
    this._fileService = _fileService;
    this._onDidChangeParseResult = this._register(new Emitter());
    this.onDidChangeParseResult = this._onDidChangeParseResult.event;
    // TODO: @alexr00 use a better data structure for this
    this._injectionTreeSitterTrees = /* @__PURE__ */ new Map();
    this._versionId = 0;
    this._parseSessionDisposables = this._register(new DisposableStore());
    if (parseImmediately) {
      this._register(Event.runAndSubscribe(this.textModel.onDidChangeLanguage, (e) => this._onDidChangeLanguage(e ? e.newLanguage : this.textModel.getLanguageId())));
    } else {
      this._register(this.textModel.onDidChangeLanguage((e) => this._onDidChangeLanguage(e ? e.newLanguage : this.textModel.getLanguageId())));
    }
  }
  get parseResult() {
    return this._rootTreeSitterTree;
  }
  async _onDidChangeLanguage(languageId) {
    this.parse(languageId);
  }
  /**
   * Be very careful when making changes to this method as it is easy to introduce race conditions.
   */
  async parse(languageId = this.textModel.getLanguageId()) {
    this._parseSessionDisposables.clear();
    this._rootTreeSitterTree = void 0;
    const token = cancelOnDispose(this._parseSessionDisposables);
    let language;
    try {
      language = await this._getLanguage(languageId, token);
    } catch (e) {
      if (isCancellationError(e)) {
        return;
      }
      throw e;
    }
    const Parser = await this._treeSitterImporter.getParserClass();
    if (token.isCancellationRequested) {
      return;
    }
    const treeSitterTree = this._parseSessionDisposables.add(new TreeSitterParseResult(new Parser(), languageId, language, this._logService, this._telemetryService));
    this._rootTreeSitterTree = treeSitterTree;
    this._parseSessionDisposables.add(treeSitterTree.onDidUpdate((e) => this._handleTreeUpdate(e)));
    this._parseSessionDisposables.add(this.textModel.onDidChangeContent((e) => this._onDidChangeContent(treeSitterTree, [e])));
    this._onDidChangeContent(treeSitterTree, void 0);
    if (token.isCancellationRequested) {
      return;
    }
    return this._rootTreeSitterTree;
  }
  _getLanguage(languageId, token) {
    const language = this._treeSitterLanguages.getOrInitLanguage(languageId);
    if (language) {
      return Promise.resolve(language);
    }
    const disposables = [];
    return new Promise((resolve, reject) => {
      disposables.push(this._treeSitterLanguages.onDidAddLanguage((e) => {
        if (e.id === languageId) {
          dispose(disposables);
          resolve(e.language);
        }
      }));
      token.onCancellationRequested(() => {
        dispose(disposables);
        reject(new CancellationError());
      }, void 0, disposables);
    });
  }
  async _handleTreeUpdate(e, parentTreeResult, parentLanguage) {
    if (e.ranges && e.versionId >= this._versionId) {
      this._versionId = e.versionId;
      const tree = parentTreeResult ?? this._rootTreeSitterTree;
      let injections;
      if (tree.tree) {
        injections = await this._collectInjections(tree.tree);
        if (injections) {
          this._processInjections(injections, tree, parentLanguage ?? this.textModel.getLanguageId(), e.includedModelChanges);
        }
      }
      this._onDidChangeParseResult.fire({ ranges: e.ranges, versionId: e.versionId, tree: this, languageId: this.textModel.getLanguageId(), hasInjections: !!injections && injections.size > 0 });
    }
  }
  async _ensureInjectionQueries() {
    if (!this._queries) {
      const injectionsQueriesLocation = `vs/editor/common/languages/injections/${this.textModel.getLanguageId()}.scm`;
      const uri = FileAccess.asFileUri(injectionsQueriesLocation);
      if (!await this._fileService.exists(uri)) {
        this._queries = "";
      } else if (this._fileService.hasProvider(uri)) {
        const query = await this._fileService.readFile(uri);
        this._queries = query.value.toString();
      } else {
        this._queries = "";
      }
    }
    return this._queries;
  }
  async _getQuery() {
    if (!this._query) {
      const language = await this._treeSitterLanguages.getLanguage(this.textModel.getLanguageId());
      if (!language) {
        return;
      }
      const queries = await this._ensureInjectionQueries();
      if (queries === "") {
        return;
      }
      const Query = await this._treeSitterImporter.getQueryClass();
      this._query = new Query(language, queries);
    }
    return this._query;
  }
  async _collectInjections(tree) {
    const query = await this._getQuery();
    if (!query) {
      return;
    }
    if (!tree?.rootNode) {
      return;
    }
    const cursor = tree.walk();
    const injections = /* @__PURE__ */ new Map();
    let hasNext = true;
    while (hasNext) {
      hasNext = await this._processNode(cursor, query, injections);
      await new Promise((resolve) => setTimeout0(resolve));
    }
    return this._mergeAdjacentRanges(injections);
  }
  _processNode(cursor, query, injections) {
    const node = cursor.currentNode;
    const nodeLineCount = node.endPosition.row - node.startPosition.row;
    if (nodeLineCount <= 1e3) {
      this._processCaptures(query, node, injections);
      return cursor.gotoNextSibling() || this.gotoNextSiblingOfAncestor(cursor);
    } else {
      return cursor.gotoFirstChild() || cursor.gotoNextSibling() || this.gotoNextSiblingOfAncestor(cursor);
    }
  }
  _processCaptures(query, node, injections) {
    const captures = query.captures(node);
    for (const capture of captures) {
      const injectionLanguage = capture.setProperties?.["injection.language"];
      if (injectionLanguage) {
        const range = this._createRangeFromNode(capture.node);
        if (!injections.has(injectionLanguage)) {
          injections.set(injectionLanguage, []);
        }
        injections.get(injectionLanguage)?.push(range);
      }
    }
  }
  _createRangeFromNode(node) {
    return {
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startPosition: { row: node.startPosition.row, column: node.startPosition.column },
      endPosition: { row: node.endPosition.row, column: node.endPosition.column }
    };
  }
  _mergeAdjacentRanges(injections) {
    for (const [languageId, ranges] of injections) {
      if (ranges.length <= 1) {
        continue;
      }
      const mergedRanges = [];
      let current = ranges[0];
      for (let i = 1; i < ranges.length; i++) {
        const next = ranges[i];
        if (next.startIndex <= current.endIndex) {
          current = this._mergeRanges(current, next);
        } else {
          mergedRanges.push(current);
          current = next;
        }
      }
      mergedRanges.push(current);
      injections.set(languageId, mergedRanges);
    }
    return injections;
  }
  _mergeRanges(current, next) {
    return {
      startIndex: current.startIndex,
      endIndex: Math.max(current.endIndex, next.endIndex),
      startPosition: current.startPosition,
      endPosition: next.endPosition.row > current.endPosition.row ? next.endPosition : current.endPosition
    };
  }
  async _processInjections(injections, parentTree, parentLanguage, modelChanges) {
    for (const [languageId, ranges] of injections) {
      const language = await this._treeSitterLanguages.getLanguage(languageId);
      if (!language) {
        continue;
      }
      const treeSitterTree = await this._getOrCreateInjectedTree(languageId, language, parentTree, parentLanguage);
      if (treeSitterTree) {
        this._onDidChangeContent(treeSitterTree, modelChanges, ranges);
      }
    }
  }
  async _getOrCreateInjectedTree(languageId, language, parentTree, parentLanguage) {
    let treeSitterTree = this._injectionTreeSitterTrees.get(languageId);
    if (!treeSitterTree) {
      const Parser = await this._treeSitterImporter.getParserClass();
      treeSitterTree = new TreeSitterParseResult(new Parser(), languageId, language, this._logService, this._telemetryService);
      this._parseSessionDisposables.add(treeSitterTree.onDidUpdate((e) => this._handleTreeUpdate(e, parentTree, parentLanguage)));
      this._injectionTreeSitterTrees.set(languageId, treeSitterTree);
    }
    return treeSitterTree;
  }
  gotoNextSiblingOfAncestor(cursor) {
    while (cursor.gotoParent()) {
      if (cursor.gotoNextSibling()) {
        return true;
      }
    }
    return false;
  }
  getInjection(offset, parentLanguage) {
    if (this._injectionTreeSitterTrees.size === 0) {
      return void 0;
    }
    let hasFoundParentLanguage = parentLanguage === this.textModel.getLanguageId();
    for (const [_, treeSitterTree] of this._injectionTreeSitterTrees) {
      if (treeSitterTree.tree) {
        if (hasFoundParentLanguage && treeSitterTree.ranges?.find((r) => r.startIndex <= offset && r.endIndex >= offset)) {
          return treeSitterTree;
        }
        if (!hasFoundParentLanguage && treeSitterTree.languageId === parentLanguage) {
          hasFoundParentLanguage = true;
        }
      }
    }
    return void 0;
  }
  _onDidChangeContent(treeSitterTree, change, ranges) {
    treeSitterTree.onDidChangeContent(this.textModel, change, ranges);
  }
};
TextModelTreeSitter = __decorateClass([
  __decorateParam(3, ITreeSitterImporter),
  __decorateParam(4, ILogService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IFileService)
], TextModelTreeSitter);
class TreeSitterParseResult {
  constructor(parser, languageId, language, _logService, _telemetryService) {
    this.parser = parser;
    this.languageId = languageId;
    this.language = language;
    this._logService = _logService;
    this._telemetryService = _telemetryService;
    this._onDidUpdate = new Emitter();
    this.onDidUpdate = this._onDidUpdate.event;
    this._versionId = 0;
    this._editVersion = 0;
    this._isDisposed = false;
    this._onDidChangeContentQueue = new LimitedQueue();
    this._lastYieldTime = 0;
    this.parser.setLanguage(language);
  }
  get versionId() {
    return this._versionId;
  }
  dispose() {
    this._isDisposed = true;
    this._onDidUpdate.dispose();
    this._tree?.delete();
    this._lastFullyParsed?.delete();
    this._lastFullyParsedWithEdits?.delete();
    this.parser?.delete();
  }
  get tree() {
    return this._lastFullyParsed;
  }
  get isDisposed() {
    return this._isDisposed;
  }
  findChangedNodes(newTree, oldTree) {
    const newCursor = newTree.walk();
    const oldCursor = oldTree.walk();
    const nodes = [];
    let next = true;
    do {
      if (newCursor.currentNode.hasChanges) {
        const newChildren = newCursor.currentNode.children;
        const indexChangedChildren = [];
        const changedChildren = newChildren.filter((c, index) => {
          if (c?.hasChanges || oldCursor.currentNode.children.length <= index) {
            indexChangedChildren.push(index);
            return true;
          }
          return false;
        });
        if (changedChildren.length === 0 || newCursor.currentNode.hasError !== oldCursor.currentNode.hasError) {
          while (newCursor.currentNode.parent && next && !newCursor.currentNode.isNamed) {
            next = gotoParent(newCursor, oldCursor);
          }
          const newNode = newCursor.currentNode;
          const closestPreviousNode = getClosestPreviousNodes(newCursor, newTree) ?? newNode;
          nodes.push({
            startIndex: closestPreviousNode.startIndex,
            endIndex: newNode.endIndex,
            startPosition: closestPreviousNode.startPosition,
            endPosition: newNode.endPosition
          });
          next = nextSiblingOrParentSibling(newCursor, oldCursor);
        } else if (changedChildren.length >= 1) {
          next = gotoNthChild(newCursor, oldCursor, indexChangedChildren[0]);
        }
      } else {
        next = nextSiblingOrParentSibling(newCursor, oldCursor);
      }
    } while (next);
    return nodes;
  }
  findTreeChanges(newTree, changedNodes, newRanges) {
    let newRangeIndex = 0;
    const mergedChanges = [];
    for (let nodeIndex = 0; nodeIndex < changedNodes.length; nodeIndex++) {
      const node = changedNodes[nodeIndex];
      if (mergedChanges.length > 0) {
        if (node.startIndex >= mergedChanges[mergedChanges.length - 1].newRangeStartOffset && node.endIndex <= mergedChanges[mergedChanges.length - 1].newRangeEndOffset) {
          continue;
        }
      }
      const cursor = newTree.walk();
      const cursorContainersNode = () => cursor.startIndex < node.startIndex && cursor.endIndex > node.endIndex;
      while (cursorContainersNode()) {
        let child = cursor.gotoFirstChild();
        let foundChild = false;
        while (child) {
          if (cursorContainersNode() && cursor.currentNode.isNamed) {
            foundChild = true;
            break;
          } else {
            child = cursor.gotoNextSibling();
          }
        }
        if (!foundChild) {
          cursor.gotoParent();
          break;
        }
        if (cursor.currentNode.childCount === 0) {
          break;
        }
      }
      let nodesInRange;
      const foundNodeSize = cursor.endIndex - cursor.startIndex;
      if (foundNodeSize > 5e3) {
        let child = cursor.gotoFirstChild();
        nodesInRange = [];
        while (child) {
          if (cursor.endIndex > node.startIndex) {
            nodesInRange.push(cursor.currentNode);
            do {
              child = cursor.gotoNextSibling();
            } while (child && cursor.endIndex < node.endIndex);
            nodesInRange.push(cursor.currentNode);
            break;
          }
          child = cursor.gotoNextSibling();
        }
      } else {
        nodesInRange = [cursor.currentNode];
      }
      while (cursor.currentNode.id !== nodesInRange[0].id) {
        cursor.gotoPreviousSibling();
      }
      const previousNode = getClosestPreviousNodes(cursor, newTree);
      const startPosition = previousNode ? previousNode.endPosition : nodesInRange[0].startPosition;
      const startIndex = previousNode ? previousNode.endIndex : nodesInRange[0].startIndex;
      const endPosition = nodesInRange[nodesInRange.length - 1].endPosition;
      const endIndex = nodesInRange[nodesInRange.length - 1].endIndex;
      const newChange = { newRange: new Range(startPosition.row + 1, startPosition.column + 1, endPosition.row + 1, endPosition.column + 1), newRangeStartOffset: startIndex, newRangeEndOffset: endIndex };
      if (newRangeIndex < newRanges.length && rangesIntersect(newRanges[newRangeIndex], { startIndex, endIndex, startPosition, endPosition })) {
        if (newRanges[newRangeIndex].startIndex < newChange.newRangeStartOffset) {
          newChange.newRange = newChange.newRange.setStartPosition(newRanges[newRangeIndex].startPosition.row + 1, newRanges[newRangeIndex].startPosition.column + 1);
          newChange.newRangeStartOffset = newRanges[newRangeIndex].startIndex;
        }
        if (newRanges[newRangeIndex].endIndex > newChange.newRangeEndOffset) {
          newChange.newRange = newChange.newRange.setEndPosition(newRanges[newRangeIndex].endPosition.row + 1, newRanges[newRangeIndex].endPosition.column + 1);
          newChange.newRangeEndOffset = newRanges[newRangeIndex].endIndex;
        }
        newRangeIndex++;
      } else if (newRangeIndex < newRanges.length && newRanges[newRangeIndex].endIndex < newChange.newRangeStartOffset) {
        mergedChanges.push({
          newRange: new Range(newRanges[newRangeIndex].startPosition.row + 1, newRanges[newRangeIndex].startPosition.column + 1, newRanges[newRangeIndex].endPosition.row + 1, newRanges[newRangeIndex].endPosition.column + 1),
          newRangeStartOffset: newRanges[newRangeIndex].startIndex,
          newRangeEndOffset: newRanges[newRangeIndex].endIndex
        });
      }
      if (mergedChanges.length > 0 && mergedChanges[mergedChanges.length - 1].newRangeEndOffset >= newChange.newRangeStartOffset) {
        mergedChanges[mergedChanges.length - 1].newRange = Range.fromPositions(mergedChanges[mergedChanges.length - 1].newRange.getStartPosition(), newChange.newRange.getEndPosition());
        mergedChanges[mergedChanges.length - 1].newRangeEndOffset = newChange.newRangeEndOffset;
      } else {
        mergedChanges.push(newChange);
      }
    }
    return this._constrainRanges(mergedChanges);
  }
  _constrainRanges(changes) {
    if (!this.ranges) {
      return changes;
    }
    const constrainedChanges = [];
    let changesIndex = 0;
    let rangesIndex = 0;
    while (changesIndex < changes.length && rangesIndex < this.ranges.length) {
      const change = changes[changesIndex];
      const range = this.ranges[rangesIndex];
      if (change.newRangeEndOffset < range.startIndex) {
        changesIndex++;
      } else if (change.newRangeStartOffset > range.endIndex) {
        rangesIndex++;
      } else {
        const newRangeStartOffset = Math.max(change.newRangeStartOffset, range.startIndex);
        const newRangeEndOffset = Math.min(change.newRangeEndOffset, range.endIndex);
        const newRange = change.newRange.intersectRanges(new Range(range.startPosition.row + 1, range.startPosition.column + 1, range.endPosition.row + 1, range.endPosition.column + 1));
        constrainedChanges.push({
          newRange,
          newRangeEndOffset,
          newRangeStartOffset
        });
        if (newRangeEndOffset < change.newRangeEndOffset) {
          change.newRange = Range.fromPositions(newRange.getEndPosition(), change.newRange.getEndPosition());
          change.newRangeStartOffset = newRangeEndOffset + 1;
        } else {
          changesIndex++;
        }
      }
    }
    return constrainedChanges;
  }
  onDidChangeContent(model, changes, ranges) {
    const version = model.getVersionId();
    if (version === this._editVersion) {
      return;
    }
    let newRanges = [];
    if (ranges) {
      newRanges = this._setRanges(ranges);
    }
    if (changes && changes.length > 0) {
      if (this._unfiredChanges) {
        this._unfiredChanges.push(...changes);
      } else {
        this._unfiredChanges = changes;
      }
      for (const change of changes) {
        this._applyEdits(change.changes, version);
      }
    } else {
      this._applyEdits([], version);
    }
    this._onDidChangeContentQueue.queue(async () => {
      if (this.isDisposed) {
        return;
      }
      const oldTree = this._lastFullyParsed;
      let changedNodes;
      if (this._lastFullyParsedWithEdits && this._lastFullyParsed) {
        changedNodes = this.findChangedNodes(this._lastFullyParsedWithEdits, this._lastFullyParsed);
      }
      const completed = await this._parseAndUpdateTree(model, version);
      if (completed) {
        let ranges2;
        if (!changedNodes) {
          if (this._ranges) {
            ranges2 = this._ranges.map((r) => ({ newRange: new Range(r.startPosition.row + 1, r.startPosition.column + 1, r.endPosition.row + 1, r.endPosition.column + 1), oldRangeLength: r.endIndex - r.startIndex, newRangeStartOffset: r.startIndex, newRangeEndOffset: r.endIndex }));
          } else {
            ranges2 = [{ newRange: model.getFullModelRange(), newRangeStartOffset: 0, newRangeEndOffset: model.getValueLength() }];
          }
        } else if (oldTree && changedNodes) {
          ranges2 = this.findTreeChanges(completed, changedNodes, newRanges);
        }
        const changes2 = this._unfiredChanges ?? [];
        this._unfiredChanges = void 0;
        this._onDidUpdate.fire({ language: this.languageId, ranges: ranges2, versionId: version, tree: completed, includedModelChanges: changes2 });
      }
    });
  }
  _applyEdits(changes, version) {
    for (const change of changes) {
      const originalTextLength = TextLength.ofRange(Range.lift(change.range));
      const newTextLength = TextLength.ofText(change.text);
      const summedTextLengths = change.text.length === 0 ? newTextLength : originalTextLength.add(newTextLength);
      const edit = {
        startIndex: change.rangeOffset,
        oldEndIndex: change.rangeOffset + change.rangeLength,
        newEndIndex: change.rangeOffset + change.text.length,
        startPosition: { row: change.range.startLineNumber - 1, column: change.range.startColumn - 1 },
        oldEndPosition: { row: change.range.endLineNumber - 1, column: change.range.endColumn - 1 },
        newEndPosition: { row: change.range.startLineNumber + summedTextLengths.lineCount - 1, column: summedTextLengths.lineCount ? summedTextLengths.columnCount : change.range.endColumn + summedTextLengths.columnCount }
      };
      this._tree?.edit(edit);
      this._lastFullyParsedWithEdits?.edit(edit);
    }
    this._editVersion = version;
  }
  async _parseAndUpdateTree(model, version) {
    const tree = await this._parse(model);
    if (tree) {
      this._tree?.delete();
      this._tree = tree;
      this._lastFullyParsed?.delete();
      this._lastFullyParsed = tree.copy();
      this._lastFullyParsedWithEdits?.delete();
      this._lastFullyParsedWithEdits = tree.copy();
      this._versionId = version;
      return tree;
    } else if (!this._tree) {
      this.parser.reset();
    }
    return void 0;
  }
  _parse(model) {
    let parseType = "fullParse" /* Full */;
    if (this.tree) {
      parseType = "incrementalParse" /* Incremental */;
    }
    return this._parseAndYield(model, parseType);
  }
  async _parseAndYield(model, parseType) {
    let time = 0;
    let passes = 0;
    const inProgressVersion = this._editVersion;
    let newTree;
    this._lastYieldTime = performance.now();
    do {
      const timer = performance.now();
      try {
        newTree = this.parser.parse((index, position) => this._parseCallback(model, index), this._tree, { progressCallback: this._parseProgressCallback.bind(this), includedRanges: this._ranges });
      } catch (e) {
      } finally {
        time += performance.now() - timer;
        passes++;
      }
      await new Promise((resolve) => setTimeout0(resolve));
    } while (!model.isDisposed() && !this.isDisposed && !newTree && inProgressVersion === model.getVersionId());
    this.sendParseTimeTelemetry(parseType, time, passes);
    return newTree && inProgressVersion === model.getVersionId() ? newTree : void 0;
  }
  _parseProgressCallback(state) {
    const now = performance.now();
    if (now - this._lastYieldTime > 50) {
      this._lastYieldTime = now;
      return true;
    }
    return false;
  }
  _parseCallback(textModel, index) {
    try {
      return textModel.getTextBuffer().getNearestChunk(index);
    } catch (e) {
      this._logService.debug("Error getting chunk for tree-sitter parsing", e);
    }
    return void 0;
  }
  _setRanges(newRanges) {
    const unKnownRanges = [];
    if (this._ranges) {
      for (const newRange of newRanges) {
        let isFullyIncluded = false;
        for (let i = 0; i < this._ranges.length; i++) {
          const existingRange = this._ranges[i];
          if (rangesEqual(existingRange, newRange) || rangesIntersect(existingRange, newRange)) {
            isFullyIncluded = true;
            break;
          }
        }
        if (!isFullyIncluded) {
          unKnownRanges.push(newRange);
        }
      }
    } else {
      unKnownRanges.push(...newRanges);
    }
    this._ranges = newRanges;
    return unKnownRanges;
  }
  get ranges() {
    return this._ranges;
  }
  sendParseTimeTelemetry(parseType, time, passes) {
    this._logService.debug(`Tree parsing (${parseType}) took ${time} ms and ${passes} passes.`);
    if (parseType === "fullParse" /* Full */) {
      this._telemetryService.publicLog2(`treeSitter.fullParse`, { languageId: this.languageId, time, passes });
    } else {
      this._telemetryService.publicLog2(`treeSitter.incrementalParse`, { languageId: this.languageId, time, passes });
    }
  }
}
function rangesEqual(a, b) {
  return a.startPosition.row === b.startPosition.row && a.startPosition.column === b.startPosition.column && a.endPosition.row === b.endPosition.row && a.endPosition.column === b.endPosition.column && a.startIndex === b.startIndex && a.endIndex === b.endIndex;
}
function rangesIntersect(a, b) {
  return a.startIndex <= b.startIndex && a.endIndex >= b.startIndex || b.startIndex <= a.startIndex && b.endIndex >= a.startIndex;
}
export {
  TextModelTreeSitter,
  TreeSitterParseResult
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RyZWVTaXR0ZXIvdGV4dE1vZGVsVHJlZVNpdHRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlICogYXMgUGFyc2VyIGZyb20gJ0B2c2NvZGUvdHJlZS1zaXR0ZXItd2FzbSc7XG5pbXBvcnQgeyBJVHJlZVNpdHRlclBhcnNlUmVzdWx0LCBJVGV4dE1vZGVsVHJlZVNpdHRlciwgUmFuZ2VDaGFuZ2UsIFRyZWVQYXJzZVVwZGF0ZUV2ZW50LCBJVHJlZVNpdHRlckltcG9ydGVyLCBNb2RlbFRyZWVVcGRhdGVFdmVudCB9IGZyb20gJy4uL3RyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbENvbnRlbnRDaGFuZ2UsIElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IHNldFRpbWVvdXQwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgY2FuY2VsT25EaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBMaW1pdGVkUXVldWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBUZXh0TGVuZ3RoIH0gZnJvbSAnLi4vLi4vY29yZS90ZXh0TGVuZ3RoLmpzJztcbmltcG9ydCB7IFRyZWVTaXR0ZXJMYW5ndWFnZXMgfSBmcm9tICcuL3RyZWVTaXR0ZXJMYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgQXBwUmVzb3VyY2VQYXRoLCBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uRXJyb3IsIGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgZ2V0Q2xvc2VzdFByZXZpb3VzTm9kZXMsIGdvdG9OdGhDaGlsZCwgZ290b1BhcmVudCwgbmV4dFNpYmxpbmdPclBhcmVudFNpYmxpbmcgfSBmcm9tICcuL2N1cnNvclV0aWxzLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBUZXh0TW9kZWxUcmVlU2l0dGVySXRlbSB7XG5cdGRpc3Bvc2UoKTogdm9pZDtcblx0dGV4dE1vZGVsVHJlZVNpdHRlcjogVGV4dE1vZGVsVHJlZVNpdHRlcjtcblx0ZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuY29uc3QgZW51bSBUZWxlbWV0cnlQYXJzZVR5cGUge1xuXHRGdWxsID0gJ2Z1bGxQYXJzZScsXG5cdEluY3JlbWVudGFsID0gJ2luY3JlbWVudGFsUGFyc2UnXG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0TW9kZWxUcmVlU2l0dGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXh0TW9kZWxUcmVlU2l0dGVyIHtcblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VQYXJzZVJlc3VsdDogRW1pdHRlcjxNb2RlbFRyZWVVcGRhdGVFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxNb2RlbFRyZWVVcGRhdGVFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVBhcnNlUmVzdWx0OiBFdmVudDxNb2RlbFRyZWVVcGRhdGVFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZVBhcnNlUmVzdWx0LmV2ZW50O1xuXHRwcml2YXRlIF9yb290VHJlZVNpdHRlclRyZWU6IFRyZWVTaXR0ZXJQYXJzZVJlc3VsdCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9xdWVyeTogUGFyc2VyLlF1ZXJ5IHwgdW5kZWZpbmVkO1xuXHQvLyBUT0RPOiBAYWxleHIwMCB1c2UgYSBiZXR0ZXIgZGF0YSBzdHJ1Y3R1cmUgZm9yIHRoaXNcblx0cHJpdmF0ZSBfaW5qZWN0aW9uVHJlZVNpdHRlclRyZWVzOiBNYXA8c3RyaW5nLCBUcmVlU2l0dGVyUGFyc2VSZXN1bHQ+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIF92ZXJzaW9uSWQ6IG51bWJlciA9IDA7XG5cblx0Z2V0IHBhcnNlUmVzdWx0KCk6IElUcmVlU2l0dGVyUGFyc2VSZXN1bHQgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fcm9vdFRyZWVTaXR0ZXJUcmVlOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgdGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RyZWVTaXR0ZXJMYW5ndWFnZXM6IFRyZWVTaXR0ZXJMYW5ndWFnZXMsXG5cdFx0cGFyc2VJbW1lZGlhdGVseTogYm9vbGVhbiA9IHRydWUsXG5cdFx0QElUcmVlU2l0dGVySW1wb3J0ZXIgcHJpdmF0ZSByZWFkb25seSBfdHJlZVNpdHRlckltcG9ydGVyOiBJVHJlZVNpdHRlckltcG9ydGVyLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0aWYgKHBhcnNlSW1tZWRpYXRlbHkpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZSh0aGlzLnRleHRNb2RlbC5vbkRpZENoYW5nZUxhbmd1YWdlLCAoZSA9PiB0aGlzLl9vbkRpZENoYW5nZUxhbmd1YWdlKGUgPyBlLm5ld0xhbmd1YWdlIDogdGhpcy50ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKSkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0TW9kZWwub25EaWRDaGFuZ2VMYW5ndWFnZShlID0+IHRoaXMuX29uRGlkQ2hhbmdlTGFuZ3VhZ2UoZSA/IGUubmV3TGFuZ3VhZ2UgOiB0aGlzLnRleHRNb2RlbC5nZXRMYW5ndWFnZUlkKCkpKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcGFyc2VTZXNzaW9uRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIGFzeW5jIF9vbkRpZENoYW5nZUxhbmd1YWdlKGxhbmd1YWdlSWQ6IHN0cmluZykge1xuXHRcdHRoaXMucGFyc2UobGFuZ3VhZ2VJZCk7XG5cdH1cblxuXHQvKipcblx0ICogQmUgdmVyeSBjYXJlZnVsIHdoZW4gbWFraW5nIGNoYW5nZXMgdG8gdGhpcyBtZXRob2QgYXMgaXQgaXMgZWFzeSB0byBpbnRyb2R1Y2UgcmFjZSBjb25kaXRpb25zLlxuXHQgKi9cblx0cHVibGljIGFzeW5jIHBhcnNlKGxhbmd1YWdlSWQ6IHN0cmluZyA9IHRoaXMudGV4dE1vZGVsLmdldExhbmd1YWdlSWQoKSk6IFByb21pc2U8SVRyZWVTaXR0ZXJQYXJzZVJlc3VsdCB8IHVuZGVmaW5lZD4ge1xuXHRcdHRoaXMuX3BhcnNlU2Vzc2lvbkRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fcm9vdFRyZWVTaXR0ZXJUcmVlID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgdG9rZW4gPSBjYW5jZWxPbkRpc3Bvc2UodGhpcy5fcGFyc2VTZXNzaW9uRGlzcG9zYWJsZXMpO1xuXHRcdGxldCBsYW5ndWFnZTogUGFyc2VyLkxhbmd1YWdlIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRsYW5ndWFnZSA9IGF3YWl0IHRoaXMuX2dldExhbmd1YWdlKGxhbmd1YWdlSWQsIHRva2VuKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAoaXNDYW5jZWxsYXRpb25FcnJvcihlKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblxuXHRcdGNvbnN0IFBhcnNlciA9IGF3YWl0IHRoaXMuX3RyZWVTaXR0ZXJJbXBvcnRlci5nZXRQYXJzZXJDbGFzcygpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWVTaXR0ZXJUcmVlID0gdGhpcy5fcGFyc2VTZXNzaW9uRGlzcG9zYWJsZXMuYWRkKG5ldyBUcmVlU2l0dGVyUGFyc2VSZXN1bHQobmV3IFBhcnNlcigpLCBsYW5ndWFnZUlkLCBsYW5ndWFnZSwgdGhpcy5fbG9nU2VydmljZSwgdGhpcy5fdGVsZW1ldHJ5U2VydmljZSkpO1xuXHRcdHRoaXMuX3Jvb3RUcmVlU2l0dGVyVHJlZSA9IHRyZWVTaXR0ZXJUcmVlO1xuXHRcdHRoaXMuX3BhcnNlU2Vzc2lvbkRpc3Bvc2FibGVzLmFkZCh0cmVlU2l0dGVyVHJlZS5vbkRpZFVwZGF0ZShlID0+IHRoaXMuX2hhbmRsZVRyZWVVcGRhdGUoZSkpKTtcblx0XHR0aGlzLl9wYXJzZVNlc3Npb25EaXNwb3NhYmxlcy5hZGQodGhpcy50ZXh0TW9kZWwub25EaWRDaGFuZ2VDb250ZW50KGUgPT4gdGhpcy5fb25EaWRDaGFuZ2VDb250ZW50KHRyZWVTaXR0ZXJUcmVlLCBbZV0pKSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50KHRyZWVTaXR0ZXJUcmVlLCB1bmRlZmluZWQpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9yb290VHJlZVNpdHRlclRyZWU7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRMYW5ndWFnZShsYW5ndWFnZUlkOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UGFyc2VyLkxhbmd1YWdlPiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2UgPSB0aGlzLl90cmVlU2l0dGVyTGFuZ3VhZ2VzLmdldE9ySW5pdExhbmd1YWdlKGxhbmd1YWdlSWQpO1xuXHRcdGlmIChsYW5ndWFnZSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShsYW5ndWFnZSk7XG5cdFx0fVxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMucHVzaCh0aGlzLl90cmVlU2l0dGVyTGFuZ3VhZ2VzLm9uRGlkQWRkTGFuZ3VhZ2UoZSA9PiB7XG5cdFx0XHRcdGlmIChlLmlkID09PSBsYW5ndWFnZUlkKSB7XG5cdFx0XHRcdFx0ZGlzcG9zZShkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0cmVzb2x2ZShlLmxhbmd1YWdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4ge1xuXHRcdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0cmVqZWN0KG5ldyBDYW5jZWxsYXRpb25FcnJvcigpKTtcblx0XHRcdH0sIHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfaGFuZGxlVHJlZVVwZGF0ZShlOiBUcmVlUGFyc2VVcGRhdGVFdmVudCwgcGFyZW50VHJlZVJlc3VsdD86IElUcmVlU2l0dGVyUGFyc2VSZXN1bHQsIHBhcmVudExhbmd1YWdlPzogc3RyaW5nKSB7XG5cdFx0aWYgKGUucmFuZ2VzICYmIChlLnZlcnNpb25JZCA+PSB0aGlzLl92ZXJzaW9uSWQpKSB7XG5cdFx0XHR0aGlzLl92ZXJzaW9uSWQgPSBlLnZlcnNpb25JZDtcblx0XHRcdGNvbnN0IHRyZWUgPSBwYXJlbnRUcmVlUmVzdWx0ID8/IHRoaXMuX3Jvb3RUcmVlU2l0dGVyVHJlZSE7XG5cdFx0XHRsZXQgaW5qZWN0aW9uczogTWFwPHN0cmluZywgUGFyc2VyLlJhbmdlW10+IHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHRyZWUudHJlZSkge1xuXHRcdFx0XHRpbmplY3Rpb25zID0gYXdhaXQgdGhpcy5fY29sbGVjdEluamVjdGlvbnModHJlZS50cmVlKTtcblx0XHRcdFx0Ly8ga2ljayBvZmYgY2hlY2sgZm9yIGluamVjdGVkIGxhbmd1YWdlc1xuXHRcdFx0XHRpZiAoaW5qZWN0aW9ucykge1xuXHRcdFx0XHRcdHRoaXMuX3Byb2Nlc3NJbmplY3Rpb25zKGluamVjdGlvbnMsIHRyZWUsIHBhcmVudExhbmd1YWdlID8/IHRoaXMudGV4dE1vZGVsLmdldExhbmd1YWdlSWQoKSwgZS5pbmNsdWRlZE1vZGVsQ2hhbmdlcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VQYXJzZVJlc3VsdC5maXJlKHsgcmFuZ2VzOiBlLnJhbmdlcywgdmVyc2lvbklkOiBlLnZlcnNpb25JZCwgdHJlZTogdGhpcywgbGFuZ3VhZ2VJZDogdGhpcy50ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLCBoYXNJbmplY3Rpb25zOiAhIWluamVjdGlvbnMgJiYgaW5qZWN0aW9ucy5zaXplID4gMCB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9xdWVyaWVzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYXN5bmMgX2Vuc3VyZUluamVjdGlvblF1ZXJpZXMoKSB7XG5cdFx0aWYgKCF0aGlzLl9xdWVyaWVzKSB7XG5cdFx0XHRjb25zdCBpbmplY3Rpb25zUXVlcmllc0xvY2F0aW9uOiBBcHBSZXNvdXJjZVBhdGggPSBgdnMvZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvaW5qZWN0aW9ucy8ke3RoaXMudGV4dE1vZGVsLmdldExhbmd1YWdlSWQoKX0uc2NtYDtcblx0XHRcdGNvbnN0IHVyaSA9IEZpbGVBY2Nlc3MuYXNGaWxlVXJpKGluamVjdGlvbnNRdWVyaWVzTG9jYXRpb24pO1xuXHRcdFx0aWYgKCEoYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UuZXhpc3RzKHVyaSkpKSB7XG5cdFx0XHRcdHRoaXMuX3F1ZXJpZXMgPSAnJztcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5fZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIodXJpKSkge1xuXHRcdFx0XHRjb25zdCBxdWVyeSA9IGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLnJlYWRGaWxlKHVyaSk7XG5cdFx0XHRcdHRoaXMuX3F1ZXJpZXMgPSBxdWVyeS52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fcXVlcmllcyA9ICcnO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcXVlcmllcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dldFF1ZXJ5KCkge1xuXHRcdGlmICghdGhpcy5fcXVlcnkpIHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlID0gYXdhaXQgdGhpcy5fdHJlZVNpdHRlckxhbmd1YWdlcy5nZXRMYW5ndWFnZSh0aGlzLnRleHRNb2RlbC5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdFx0aWYgKCFsYW5ndWFnZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBxdWVyaWVzID0gYXdhaXQgdGhpcy5fZW5zdXJlSW5qZWN0aW9uUXVlcmllcygpO1xuXHRcdFx0aWYgKHF1ZXJpZXMgPT09ICcnKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IFF1ZXJ5ID0gYXdhaXQgdGhpcy5fdHJlZVNpdHRlckltcG9ydGVyLmdldFF1ZXJ5Q2xhc3MoKTtcblx0XHRcdHRoaXMuX3F1ZXJ5ID0gbmV3IFF1ZXJ5KGxhbmd1YWdlLCBxdWVyaWVzKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3F1ZXJ5O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY29sbGVjdEluamVjdGlvbnModHJlZTogUGFyc2VyLlRyZWUpOiBQcm9taXNlPE1hcDxzdHJpbmcsIFBhcnNlci5SYW5nZVtdPiB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHF1ZXJ5ID0gYXdhaXQgdGhpcy5fZ2V0UXVlcnkoKTtcblx0XHRpZiAoIXF1ZXJ5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0cmVlPy5yb290Tm9kZSkge1xuXHRcdFx0Ly8gbmVlZCB0byBjaGVjayB0aGUgcm9vdCBub2RlIGhlcmUgYXMgYHdhbGtgIHdpbGwgdGhyb3cgaWYgbm90IGRlZmluZWQuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3Vyc29yID0gdHJlZS53YWxrKCk7XG5cdFx0Y29uc3QgaW5qZWN0aW9uczogTWFwPHN0cmluZywgUGFyc2VyLlJhbmdlW10+ID0gbmV3IE1hcCgpO1xuXHRcdGxldCBoYXNOZXh0ID0gdHJ1ZTtcblxuXHRcdHdoaWxlIChoYXNOZXh0KSB7XG5cdFx0XHRoYXNOZXh0ID0gYXdhaXQgdGhpcy5fcHJvY2Vzc05vZGUoY3Vyc29yLCBxdWVyeSwgaW5qZWN0aW9ucyk7XG5cdFx0XHQvLyBZaWVsZCBwZXJpb2RpY2FsbHlcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0VGltZW91dDAocmVzb2x2ZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9tZXJnZUFkamFjZW50UmFuZ2VzKGluamVjdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcHJvY2Vzc05vZGUoY3Vyc29yOiBQYXJzZXIuVHJlZUN1cnNvciwgcXVlcnk6IFBhcnNlci5RdWVyeSwgaW5qZWN0aW9uczogTWFwPHN0cmluZywgUGFyc2VyLlJhbmdlW10+KTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgbm9kZSA9IGN1cnNvci5jdXJyZW50Tm9kZTtcblx0XHRjb25zdCBub2RlTGluZUNvdW50ID0gbm9kZS5lbmRQb3NpdGlvbi5yb3cgLSBub2RlLnN0YXJ0UG9zaXRpb24ucm93O1xuXG5cdFx0Ly8gV2UgY2hlY2sgdGhlIG5vZGUgbGluZSBjb3VudCB0byBhdm9pZCBwcm9jZXNzaW5nIGxhcmdlIG5vZGVzIGluIG9uZSBnbyBhcyB0aGF0IGNhbiBjYXVzZSBwZXJmb3JtYW5jZSBpc3N1ZXMuXG5cdFx0aWYgKG5vZGVMaW5lQ291bnQgPD0gMTAwMCkge1xuXHRcdFx0dGhpcy5fcHJvY2Vzc0NhcHR1cmVzKHF1ZXJ5LCBub2RlLCBpbmplY3Rpb25zKTtcblx0XHRcdC8vIE1vdmUgdG8gbmV4dCBzaWJsaW5nIG9yIHVwIGFuZCBvdmVyXG5cdFx0XHRyZXR1cm4gY3Vyc29yLmdvdG9OZXh0U2libGluZygpIHx8IHRoaXMuZ290b05leHRTaWJsaW5nT2ZBbmNlc3RvcihjdXJzb3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBOb2RlIGlzIHRvbyBsYXJnZSwgZ28gdG8gZmlyc3QgY2hpbGQgb3IgbmV4dCBzaWJsaW5nXG5cdFx0XHRyZXR1cm4gY3Vyc29yLmdvdG9GaXJzdENoaWxkKCkgfHwgY3Vyc29yLmdvdG9OZXh0U2libGluZygpIHx8IHRoaXMuZ290b05leHRTaWJsaW5nT2ZBbmNlc3RvcihjdXJzb3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Byb2Nlc3NDYXB0dXJlcyhxdWVyeTogUGFyc2VyLlF1ZXJ5LCBub2RlOiBQYXJzZXIuTm9kZSwgaW5qZWN0aW9uczogTWFwPHN0cmluZywgUGFyc2VyLlJhbmdlW10+KTogdm9pZCB7XG5cdFx0Y29uc3QgY2FwdHVyZXMgPSBxdWVyeS5jYXB0dXJlcyhub2RlKTtcblx0XHRmb3IgKGNvbnN0IGNhcHR1cmUgb2YgY2FwdHVyZXMpIHtcblx0XHRcdGNvbnN0IGluamVjdGlvbkxhbmd1YWdlID0gY2FwdHVyZS5zZXRQcm9wZXJ0aWVzPy5bJ2luamVjdGlvbi5sYW5ndWFnZSddO1xuXHRcdFx0aWYgKGluamVjdGlvbkxhbmd1YWdlKSB7XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fY3JlYXRlUmFuZ2VGcm9tTm9kZShjYXB0dXJlLm5vZGUpO1xuXHRcdFx0XHRpZiAoIWluamVjdGlvbnMuaGFzKGluamVjdGlvbkxhbmd1YWdlKSkge1xuXHRcdFx0XHRcdGluamVjdGlvbnMuc2V0KGluamVjdGlvbkxhbmd1YWdlLCBbXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5qZWN0aW9ucy5nZXQoaW5qZWN0aW9uTGFuZ3VhZ2UpPy5wdXNoKHJhbmdlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVSYW5nZUZyb21Ob2RlKG5vZGU6IFBhcnNlci5Ob2RlKTogUGFyc2VyLlJhbmdlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnRJbmRleDogbm9kZS5zdGFydEluZGV4LFxuXHRcdFx0ZW5kSW5kZXg6IG5vZGUuZW5kSW5kZXgsXG5cdFx0XHRzdGFydFBvc2l0aW9uOiB7IHJvdzogbm9kZS5zdGFydFBvc2l0aW9uLnJvdywgY29sdW1uOiBub2RlLnN0YXJ0UG9zaXRpb24uY29sdW1uIH0sXG5cdFx0XHRlbmRQb3NpdGlvbjogeyByb3c6IG5vZGUuZW5kUG9zaXRpb24ucm93LCBjb2x1bW46IG5vZGUuZW5kUG9zaXRpb24uY29sdW1uIH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfbWVyZ2VBZGphY2VudFJhbmdlcyhpbmplY3Rpb25zOiBNYXA8c3RyaW5nLCBQYXJzZXIuUmFuZ2VbXT4pOiBNYXA8c3RyaW5nLCBQYXJzZXIuUmFuZ2VbXT4ge1xuXHRcdGZvciAoY29uc3QgW2xhbmd1YWdlSWQsIHJhbmdlc10gb2YgaW5qZWN0aW9ucykge1xuXHRcdFx0aWYgKHJhbmdlcy5sZW5ndGggPD0gMSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbWVyZ2VkUmFuZ2VzOiBQYXJzZXIuUmFuZ2VbXSA9IFtdO1xuXHRcdFx0bGV0IGN1cnJlbnQgPSByYW5nZXNbMF07XG5cblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IG5leHQgPSByYW5nZXNbaV07XG5cdFx0XHRcdGlmIChuZXh0LnN0YXJ0SW5kZXggPD0gY3VycmVudC5lbmRJbmRleCkge1xuXHRcdFx0XHRcdGN1cnJlbnQgPSB0aGlzLl9tZXJnZVJhbmdlcyhjdXJyZW50LCBuZXh0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtZXJnZWRSYW5nZXMucHVzaChjdXJyZW50KTtcblx0XHRcdFx0XHRjdXJyZW50ID0gbmV4dDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bWVyZ2VkUmFuZ2VzLnB1c2goY3VycmVudCk7XG5cblx0XHRcdGluamVjdGlvbnMuc2V0KGxhbmd1YWdlSWQsIG1lcmdlZFJhbmdlcyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGluamVjdGlvbnM7XG5cdH1cblxuXHRwcml2YXRlIF9tZXJnZVJhbmdlcyhjdXJyZW50OiBQYXJzZXIuUmFuZ2UsIG5leHQ6IFBhcnNlci5SYW5nZSk6IFBhcnNlci5SYW5nZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0SW5kZXg6IGN1cnJlbnQuc3RhcnRJbmRleCxcblx0XHRcdGVuZEluZGV4OiBNYXRoLm1heChjdXJyZW50LmVuZEluZGV4LCBuZXh0LmVuZEluZGV4KSxcblx0XHRcdHN0YXJ0UG9zaXRpb246IGN1cnJlbnQuc3RhcnRQb3NpdGlvbixcblx0XHRcdGVuZFBvc2l0aW9uOiBuZXh0LmVuZFBvc2l0aW9uLnJvdyA+IGN1cnJlbnQuZW5kUG9zaXRpb24ucm93ID9cblx0XHRcdFx0bmV4dC5lbmRQb3NpdGlvbiA6XG5cdFx0XHRcdGN1cnJlbnQuZW5kUG9zaXRpb25cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcHJvY2Vzc0luamVjdGlvbnMoXG5cdFx0aW5qZWN0aW9uczogTWFwPHN0cmluZywgUGFyc2VyLlJhbmdlW10+LFxuXHRcdHBhcmVudFRyZWU6IElUcmVlU2l0dGVyUGFyc2VSZXN1bHQsXG5cdFx0cGFyZW50TGFuZ3VhZ2U6IHN0cmluZyxcblx0XHRtb2RlbENoYW5nZXM6IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnRbXSB8IHVuZGVmaW5lZFxuXHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmb3IgKGNvbnN0IFtsYW5ndWFnZUlkLCByYW5nZXNdIG9mIGluamVjdGlvbnMpIHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlID0gYXdhaXQgdGhpcy5fdHJlZVNpdHRlckxhbmd1YWdlcy5nZXRMYW5ndWFnZShsYW5ndWFnZUlkKTtcblx0XHRcdGlmICghbGFuZ3VhZ2UpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRyZWVTaXR0ZXJUcmVlID0gYXdhaXQgdGhpcy5fZ2V0T3JDcmVhdGVJbmplY3RlZFRyZWUobGFuZ3VhZ2VJZCwgbGFuZ3VhZ2UsIHBhcmVudFRyZWUsIHBhcmVudExhbmd1YWdlKTtcblx0XHRcdGlmICh0cmVlU2l0dGVyVHJlZSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnQodHJlZVNpdHRlclRyZWUsIG1vZGVsQ2hhbmdlcywgcmFuZ2VzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRPckNyZWF0ZUluamVjdGVkVHJlZShcblx0XHRsYW5ndWFnZUlkOiBzdHJpbmcsXG5cdFx0bGFuZ3VhZ2U6IFBhcnNlci5MYW5ndWFnZSxcblx0XHRwYXJlbnRUcmVlOiBJVHJlZVNpdHRlclBhcnNlUmVzdWx0LFxuXHRcdHBhcmVudExhbmd1YWdlOiBzdHJpbmdcblx0KTogUHJvbWlzZTxUcmVlU2l0dGVyUGFyc2VSZXN1bHQgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgdHJlZVNpdHRlclRyZWUgPSB0aGlzLl9pbmplY3Rpb25UcmVlU2l0dGVyVHJlZXMuZ2V0KGxhbmd1YWdlSWQpO1xuXHRcdGlmICghdHJlZVNpdHRlclRyZWUpIHtcblx0XHRcdGNvbnN0IFBhcnNlciA9IGF3YWl0IHRoaXMuX3RyZWVTaXR0ZXJJbXBvcnRlci5nZXRQYXJzZXJDbGFzcygpO1xuXHRcdFx0dHJlZVNpdHRlclRyZWUgPSBuZXcgVHJlZVNpdHRlclBhcnNlUmVzdWx0KG5ldyBQYXJzZXIoKSwgbGFuZ3VhZ2VJZCwgbGFuZ3VhZ2UsIHRoaXMuX2xvZ1NlcnZpY2UsIHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5fcGFyc2VTZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHRyZWVTaXR0ZXJUcmVlLm9uRGlkVXBkYXRlKGUgPT4gdGhpcy5faGFuZGxlVHJlZVVwZGF0ZShlLCBwYXJlbnRUcmVlLCBwYXJlbnRMYW5ndWFnZSkpKTtcblx0XHRcdHRoaXMuX2luamVjdGlvblRyZWVTaXR0ZXJUcmVlcy5zZXQobGFuZ3VhZ2VJZCwgdHJlZVNpdHRlclRyZWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJlZVNpdHRlclRyZWU7XG5cdH1cblxuXHRwcml2YXRlIGdvdG9OZXh0U2libGluZ09mQW5jZXN0b3IoY3Vyc29yOiBQYXJzZXIuVHJlZUN1cnNvcik6IGJvb2xlYW4ge1xuXHRcdHdoaWxlIChjdXJzb3IuZ290b1BhcmVudCgpKSB7XG5cdFx0XHRpZiAoY3Vyc29yLmdvdG9OZXh0U2libGluZygpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRnZXRJbmplY3Rpb24ob2Zmc2V0OiBudW1iZXIsIHBhcmVudExhbmd1YWdlOiBzdHJpbmcpOiBJVHJlZVNpdHRlclBhcnNlUmVzdWx0IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5faW5qZWN0aW9uVHJlZVNpdHRlclRyZWVzLnNpemUgPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxldCBoYXNGb3VuZFBhcmVudExhbmd1YWdlID0gcGFyZW50TGFuZ3VhZ2UgPT09IHRoaXMudGV4dE1vZGVsLmdldExhbmd1YWdlSWQoKTtcblxuXHRcdGZvciAoY29uc3QgW18sIHRyZWVTaXR0ZXJUcmVlXSBvZiB0aGlzLl9pbmplY3Rpb25UcmVlU2l0dGVyVHJlZXMpIHtcblx0XHRcdGlmICh0cmVlU2l0dGVyVHJlZS50cmVlKSB7XG5cdFx0XHRcdGlmIChoYXNGb3VuZFBhcmVudExhbmd1YWdlICYmIHRyZWVTaXR0ZXJUcmVlLnJhbmdlcz8uZmluZChyID0+IHIuc3RhcnRJbmRleCA8PSBvZmZzZXQgJiYgci5lbmRJbmRleCA+PSBvZmZzZXQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRyZWVTaXR0ZXJUcmVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghaGFzRm91bmRQYXJlbnRMYW5ndWFnZSAmJiB0cmVlU2l0dGVyVHJlZS5sYW5ndWFnZUlkID09PSBwYXJlbnRMYW5ndWFnZSkge1xuXHRcdFx0XHRcdGhhc0ZvdW5kUGFyZW50TGFuZ3VhZ2UgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUNvbnRlbnQodHJlZVNpdHRlclRyZWU6IFRyZWVTaXR0ZXJQYXJzZVJlc3VsdCwgY2hhbmdlOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50W10gfCB1bmRlZmluZWQsIHJhbmdlcz86IFBhcnNlci5SYW5nZVtdKSB7XG5cdFx0dHJlZVNpdHRlclRyZWUub25EaWRDaGFuZ2VDb250ZW50KHRoaXMudGV4dE1vZGVsLCBjaGFuZ2UsIHJhbmdlcyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyZWVTaXR0ZXJQYXJzZVJlc3VsdCBpbXBsZW1lbnRzIElEaXNwb3NhYmxlLCBJVHJlZVNpdHRlclBhcnNlUmVzdWx0IHtcblx0cHJpdmF0ZSBfdHJlZTogUGFyc2VyLlRyZWUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhc3RGdWxseVBhcnNlZDogUGFyc2VyLlRyZWUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhc3RGdWxseVBhcnNlZFdpdGhFZGl0czogUGFyc2VyLlRyZWUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVXBkYXRlOiBFbWl0dGVyPFRyZWVQYXJzZVVwZGF0ZUV2ZW50PiA9IG5ldyBFbWl0dGVyPFRyZWVQYXJzZVVwZGF0ZUV2ZW50PigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRVcGRhdGU6IEV2ZW50PFRyZWVQYXJzZVVwZGF0ZUV2ZW50PiA9IHRoaXMuX29uRGlkVXBkYXRlLmV2ZW50O1xuXHRwcml2YXRlIF92ZXJzaW9uSWQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX2VkaXRWZXJzaW9uOiBudW1iZXIgPSAwO1xuXHRnZXQgdmVyc2lvbklkKCkge1xuXHRcdHJldHVybiB0aGlzLl92ZXJzaW9uSWQ7XG5cdH1cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgcGFyc2VyOiBQYXJzZXIuUGFyc2VyLFxuXHRcdHB1YmxpYyByZWFkb25seSBsYW5ndWFnZUlkOiBzdHJpbmcsXG5cdFx0cHVibGljIC8qKiBleHBvc2VkIGZvciB0ZXN0cyAqKi8gcmVhZG9ubHkgbGFuZ3VhZ2U6IFBhcnNlci5MYW5ndWFnZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSkge1xuXHRcdHRoaXMucGFyc2VyLnNldExhbmd1YWdlKGxhbmd1YWdlKTtcblx0fVxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl90cmVlPy5kZWxldGUoKTtcblx0XHR0aGlzLl9sYXN0RnVsbHlQYXJzZWQ/LmRlbGV0ZSgpO1xuXHRcdHRoaXMuX2xhc3RGdWxseVBhcnNlZFdpdGhFZGl0cz8uZGVsZXRlKCk7XG5cdFx0dGhpcy5wYXJzZXI/LmRlbGV0ZSgpO1xuXHR9XG5cdGdldCB0cmVlKCkgeyByZXR1cm4gdGhpcy5fbGFzdEZ1bGx5UGFyc2VkOyB9XG5cdGdldCBpc0Rpc3Bvc2VkKCkgeyByZXR1cm4gdGhpcy5faXNEaXNwb3NlZDsgfVxuXG5cdHByaXZhdGUgZmluZENoYW5nZWROb2RlcyhuZXdUcmVlOiBQYXJzZXIuVHJlZSwgb2xkVHJlZTogUGFyc2VyLlRyZWUpOiBQYXJzZXIuUmFuZ2VbXSB7XG5cdFx0Y29uc3QgbmV3Q3Vyc29yID0gbmV3VHJlZS53YWxrKCk7XG5cdFx0Y29uc3Qgb2xkQ3Vyc29yID0gb2xkVHJlZS53YWxrKCk7XG5cblx0XHRjb25zdCBub2RlczogUGFyc2VyLlJhbmdlW10gPSBbXTtcblx0XHRsZXQgbmV4dCA9IHRydWU7XG5cblx0XHRkbyB7XG5cdFx0XHRpZiAobmV3Q3Vyc29yLmN1cnJlbnROb2RlLmhhc0NoYW5nZXMpIHtcblx0XHRcdFx0Ly8gQ2hlY2sgaWYgb25seSBvbmUgb2YgdGhlIGNoaWxkcmVuIGhhcyBjaGFuZ2VzLlxuXHRcdFx0XHQvLyBJZiBpdCdzIG9ubHkgb25lLCB0aGVuIHdlIGdvIHRvIHRoYXQgY2hpbGQuXG5cdFx0XHRcdC8vIElmIGl0J3MgbW9yZSB0aGVuLCB3ZSBuZWVkIHRvIGdvIHRvIGVhY2ggY2hpbGRcblx0XHRcdFx0Ly8gSWYgaXQncyBub25lLCB0aGVuIHdlJ3ZlIGZvdW5kIG9uZSBvZiBvdXIgcmFuZ2VzXG5cdFx0XHRcdGNvbnN0IG5ld0NoaWxkcmVuID0gbmV3Q3Vyc29yLmN1cnJlbnROb2RlLmNoaWxkcmVuO1xuXHRcdFx0XHRjb25zdCBpbmRleENoYW5nZWRDaGlsZHJlbjogbnVtYmVyW10gPSBbXTtcblx0XHRcdFx0Y29uc3QgY2hhbmdlZENoaWxkcmVuID0gbmV3Q2hpbGRyZW4uZmlsdGVyKChjLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRcdGlmIChjPy5oYXNDaGFuZ2VzIHx8IChvbGRDdXJzb3IuY3VycmVudE5vZGUuY2hpbGRyZW4ubGVuZ3RoIDw9IGluZGV4KSkge1xuXHRcdFx0XHRcdFx0aW5kZXhDaGFuZ2VkQ2hpbGRyZW4ucHVzaChpbmRleCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Ly8gSWYgd2UgaGF2ZSBjaGFuZ2VzIGFuZCB3ZSAqaGFkKiBhbiBlcnJvciwgdGhlIHdob2xlIG5vZGUgc2hvdWxkIGJlIHJlZnJlc2hlZC5cblx0XHRcdFx0aWYgKChjaGFuZ2VkQ2hpbGRyZW4ubGVuZ3RoID09PSAwKSB8fCAobmV3Q3Vyc29yLmN1cnJlbnROb2RlLmhhc0Vycm9yICE9PSBvbGRDdXJzb3IuY3VycmVudE5vZGUuaGFzRXJyb3IpKSB7XG5cdFx0XHRcdFx0Ly8gd2FsayB1cCBhZ2FpbiB1bnRpbCB3ZSBnZXQgdG8gdGhlIGZpcnN0IG9uZSB0aGF0J3MgbmFtZWQgYXMgdW5uYW1lZCBub2RlcyBjYW4gYmUgdG9vIGdyYW51bGFyXG5cdFx0XHRcdFx0d2hpbGUgKG5ld0N1cnNvci5jdXJyZW50Tm9kZS5wYXJlbnQgJiYgbmV4dCAmJiAhbmV3Q3Vyc29yLmN1cnJlbnROb2RlLmlzTmFtZWQpIHtcblx0XHRcdFx0XHRcdG5leHQgPSBnb3RvUGFyZW50KG5ld0N1cnNvciwgb2xkQ3Vyc29yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gVXNlIHRoZSBlbmQgcG9zaXRpb24gb2YgdGhlIHByZXZpb3VzIG5vZGUgYW5kIHRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGUgY3VycmVudCBub2RlXG5cdFx0XHRcdFx0Y29uc3QgbmV3Tm9kZSA9IG5ld0N1cnNvci5jdXJyZW50Tm9kZTtcblx0XHRcdFx0XHRjb25zdCBjbG9zZXN0UHJldmlvdXNOb2RlID0gZ2V0Q2xvc2VzdFByZXZpb3VzTm9kZXMobmV3Q3Vyc29yLCBuZXdUcmVlKSA/PyBuZXdOb2RlO1xuXHRcdFx0XHRcdG5vZGVzLnB1c2goe1xuXHRcdFx0XHRcdFx0c3RhcnRJbmRleDogY2xvc2VzdFByZXZpb3VzTm9kZS5zdGFydEluZGV4LFxuXHRcdFx0XHRcdFx0ZW5kSW5kZXg6IG5ld05vZGUuZW5kSW5kZXgsXG5cdFx0XHRcdFx0XHRzdGFydFBvc2l0aW9uOiBjbG9zZXN0UHJldmlvdXNOb2RlLnN0YXJ0UG9zaXRpb24sXG5cdFx0XHRcdFx0XHRlbmRQb3NpdGlvbjogbmV3Tm9kZS5lbmRQb3NpdGlvblxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdG5leHQgPSBuZXh0U2libGluZ09yUGFyZW50U2libGluZyhuZXdDdXJzb3IsIG9sZEN1cnNvcik7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2hhbmdlZENoaWxkcmVuLmxlbmd0aCA+PSAxKSB7XG5cdFx0XHRcdFx0bmV4dCA9IGdvdG9OdGhDaGlsZChuZXdDdXJzb3IsIG9sZEN1cnNvciwgaW5kZXhDaGFuZ2VkQ2hpbGRyZW5bMF0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXh0ID0gbmV4dFNpYmxpbmdPclBhcmVudFNpYmxpbmcobmV3Q3Vyc29yLCBvbGRDdXJzb3IpO1xuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKG5leHQpO1xuXG5cdFx0cmV0dXJuIG5vZGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kVHJlZUNoYW5nZXMobmV3VHJlZTogUGFyc2VyLlRyZWUsIGNoYW5nZWROb2RlczogUGFyc2VyLlJhbmdlW10sIG5ld1JhbmdlczogUGFyc2VyLlJhbmdlW10pOiBSYW5nZUNoYW5nZVtdIHtcblx0XHRsZXQgbmV3UmFuZ2VJbmRleCA9IDA7XG5cdFx0Y29uc3QgbWVyZ2VkQ2hhbmdlczogUmFuZ2VDaGFuZ2VbXSA9IFtdO1xuXG5cdFx0Ly8gRmluZCB0aGUgcGFyZW50IGluIHRoZSBuZXcgdHJlZSBvZiB0aGUgY2hhbmdlZCBub2RlXG5cdFx0Zm9yIChsZXQgbm9kZUluZGV4ID0gMDsgbm9kZUluZGV4IDwgY2hhbmdlZE5vZGVzLmxlbmd0aDsgbm9kZUluZGV4KyspIHtcblx0XHRcdGNvbnN0IG5vZGUgPSBjaGFuZ2VkTm9kZXNbbm9kZUluZGV4XTtcblxuXHRcdFx0aWYgKG1lcmdlZENoYW5nZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRpZiAoKG5vZGUuc3RhcnRJbmRleCA+PSBtZXJnZWRDaGFuZ2VzW21lcmdlZENoYW5nZXMubGVuZ3RoIC0gMV0ubmV3UmFuZ2VTdGFydE9mZnNldCkgJiYgKG5vZGUuZW5kSW5kZXggPD0gbWVyZ2VkQ2hhbmdlc1ttZXJnZWRDaGFuZ2VzLmxlbmd0aCAtIDFdLm5ld1JhbmdlRW5kT2Zmc2V0KSkge1xuXHRcdFx0XHRcdC8vIFRoaXMgbm9kZSBpcyB3aXRoaW4gdGhlIHByZXZpb3VzIHJhbmdlLCBza2lwIGl0XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3Vyc29yID0gbmV3VHJlZS53YWxrKCk7XG5cdFx0XHRjb25zdCBjdXJzb3JDb250YWluZXJzTm9kZSA9ICgpID0+IGN1cnNvci5zdGFydEluZGV4IDwgbm9kZS5zdGFydEluZGV4ICYmIGN1cnNvci5lbmRJbmRleCA+IG5vZGUuZW5kSW5kZXg7XG5cblx0XHRcdHdoaWxlIChjdXJzb3JDb250YWluZXJzTm9kZSgpKSB7XG5cdFx0XHRcdC8vIFNlZSBpZiB3ZSBjYW4gZ28gdG8gYSBjaGlsZFxuXHRcdFx0XHRsZXQgY2hpbGQgPSBjdXJzb3IuZ290b0ZpcnN0Q2hpbGQoKTtcblx0XHRcdFx0bGV0IGZvdW5kQ2hpbGQgPSBmYWxzZTtcblx0XHRcdFx0d2hpbGUgKGNoaWxkKSB7XG5cdFx0XHRcdFx0aWYgKGN1cnNvckNvbnRhaW5lcnNOb2RlKCkgJiYgY3Vyc29yLmN1cnJlbnROb2RlLmlzTmFtZWQpIHtcblx0XHRcdFx0XHRcdGZvdW5kQ2hpbGQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNoaWxkID0gY3Vyc29yLmdvdG9OZXh0U2libGluZygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIWZvdW5kQ2hpbGQpIHtcblx0XHRcdFx0XHRjdXJzb3IuZ290b1BhcmVudCgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjdXJzb3IuY3VycmVudE5vZGUuY2hpbGRDb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGxldCBub2Rlc0luUmFuZ2U6IFBhcnNlci5Ob2RlW107XG5cdFx0XHQvLyBJdCdzIHBvc3NpYmxlIHdlIGVuZCB1cCB3aXRoIGEgcmVhbGx5IGxhcmdlIHJhbmdlIGlmIHRoZSBwYXJlbnQgbm9kZSBpcyBiaWdcblx0XHRcdC8vIFRyeSB0byBhdm9pZCB0aGlzIGxhcmdlIHJhbmdlIGJ5IGZpbmRpbmcgc2V2ZXJhbCBzbWFsbGVyIG5vZGVzIHRoYXQgdG9nZXRoZXIgZW5jb21wYXNzIHRoZSByYW5nZSBvZiB0aGUgY2hhbmdlZCBub2RlLlxuXHRcdFx0Y29uc3QgZm91bmROb2RlU2l6ZSA9IGN1cnNvci5lbmRJbmRleCAtIGN1cnNvci5zdGFydEluZGV4O1xuXHRcdFx0aWYgKGZvdW5kTm9kZVNpemUgPiA1MDAwKSB7XG5cdFx0XHRcdC8vIFRyeSB0byBmaW5kIDMgY29uc2VjdXRpdmUgbm9kZXMgdGhhdCB0b2dldGhlciBlbmNvbXBhc3MgdGhlIGNoYW5nZWQgbm9kZS5cblx0XHRcdFx0bGV0IGNoaWxkID0gY3Vyc29yLmdvdG9GaXJzdENoaWxkKCk7XG5cdFx0XHRcdG5vZGVzSW5SYW5nZSA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoY2hpbGQpIHtcblx0XHRcdFx0XHRpZiAoY3Vyc29yLmVuZEluZGV4ID4gbm9kZS5zdGFydEluZGV4KSB7XG5cdFx0XHRcdFx0XHQvLyBGb3VuZCB0aGUgc3RhcnRpbmcgcG9pbnQgb2Ygb3VyIG5vZGVzXG5cdFx0XHRcdFx0XHRub2Rlc0luUmFuZ2UucHVzaChjdXJzb3IuY3VycmVudE5vZGUpO1xuXHRcdFx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdFx0XHRjaGlsZCA9IGN1cnNvci5nb3RvTmV4dFNpYmxpbmcoKTtcblx0XHRcdFx0XHRcdH0gd2hpbGUgKGNoaWxkICYmIChjdXJzb3IuZW5kSW5kZXggPCBub2RlLmVuZEluZGV4KSk7XG5cblx0XHRcdFx0XHRcdG5vZGVzSW5SYW5nZS5wdXNoKGN1cnNvci5jdXJyZW50Tm9kZSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hpbGQgPSBjdXJzb3IuZ290b05leHRTaWJsaW5nKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5vZGVzSW5SYW5nZSA9IFtjdXJzb3IuY3VycmVudE5vZGVdO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGaWxsIGluIGdhcHMgYmV0d2VlbiBub2Rlc1xuXHRcdFx0Ly8gUmVzZXQgdGhlIGN1cnNvciB0byB0aGUgZmlyc3Qgbm9kZSBpbiB0aGUgcmFuZ2U7XG5cdFx0XHR3aGlsZSAoY3Vyc29yLmN1cnJlbnROb2RlLmlkICE9PSBub2Rlc0luUmFuZ2VbMF0uaWQpIHtcblx0XHRcdFx0Y3Vyc29yLmdvdG9QcmV2aW91c1NpYmxpbmcoKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHByZXZpb3VzTm9kZSA9IGdldENsb3Nlc3RQcmV2aW91c05vZGVzKGN1cnNvciwgbmV3VHJlZSk7XG5cdFx0XHRjb25zdCBzdGFydFBvc2l0aW9uID0gcHJldmlvdXNOb2RlID8gcHJldmlvdXNOb2RlLmVuZFBvc2l0aW9uIDogbm9kZXNJblJhbmdlWzBdLnN0YXJ0UG9zaXRpb247XG5cdFx0XHRjb25zdCBzdGFydEluZGV4ID0gcHJldmlvdXNOb2RlID8gcHJldmlvdXNOb2RlLmVuZEluZGV4IDogbm9kZXNJblJhbmdlWzBdLnN0YXJ0SW5kZXg7XG5cdFx0XHRjb25zdCBlbmRQb3NpdGlvbiA9IG5vZGVzSW5SYW5nZVtub2Rlc0luUmFuZ2UubGVuZ3RoIC0gMV0uZW5kUG9zaXRpb247XG5cdFx0XHRjb25zdCBlbmRJbmRleCA9IG5vZGVzSW5SYW5nZVtub2Rlc0luUmFuZ2UubGVuZ3RoIC0gMV0uZW5kSW5kZXg7XG5cblx0XHRcdGNvbnN0IG5ld0NoYW5nZSA9IHsgbmV3UmFuZ2U6IG5ldyBSYW5nZShzdGFydFBvc2l0aW9uLnJvdyArIDEsIHN0YXJ0UG9zaXRpb24uY29sdW1uICsgMSwgZW5kUG9zaXRpb24ucm93ICsgMSwgZW5kUG9zaXRpb24uY29sdW1uICsgMSksIG5ld1JhbmdlU3RhcnRPZmZzZXQ6IHN0YXJ0SW5kZXgsIG5ld1JhbmdlRW5kT2Zmc2V0OiBlbmRJbmRleCB9O1xuXHRcdFx0aWYgKChuZXdSYW5nZUluZGV4IDwgbmV3UmFuZ2VzLmxlbmd0aCkgJiYgcmFuZ2VzSW50ZXJzZWN0KG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XSwgeyBzdGFydEluZGV4LCBlbmRJbmRleCwgc3RhcnRQb3NpdGlvbiwgZW5kUG9zaXRpb24gfSkpIHtcblx0XHRcdFx0Ly8gY29tYmluZSB0aGUgbmV3IGNoYW5nZSB3aXRoIHRoZSByYW5nZVxuXHRcdFx0XHRpZiAobmV3UmFuZ2VzW25ld1JhbmdlSW5kZXhdLnN0YXJ0SW5kZXggPCBuZXdDaGFuZ2UubmV3UmFuZ2VTdGFydE9mZnNldCkge1xuXHRcdFx0XHRcdG5ld0NoYW5nZS5uZXdSYW5nZSA9IG5ld0NoYW5nZS5uZXdSYW5nZS5zZXRTdGFydFBvc2l0aW9uKG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5zdGFydFBvc2l0aW9uLnJvdyArIDEsIG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5zdGFydFBvc2l0aW9uLmNvbHVtbiArIDEpO1xuXHRcdFx0XHRcdG5ld0NoYW5nZS5uZXdSYW5nZVN0YXJ0T2Zmc2V0ID0gbmV3UmFuZ2VzW25ld1JhbmdlSW5kZXhdLnN0YXJ0SW5kZXg7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5lbmRJbmRleCA+IG5ld0NoYW5nZS5uZXdSYW5nZUVuZE9mZnNldCkge1xuXHRcdFx0XHRcdG5ld0NoYW5nZS5uZXdSYW5nZSA9IG5ld0NoYW5nZS5uZXdSYW5nZS5zZXRFbmRQb3NpdGlvbihuZXdSYW5nZXNbbmV3UmFuZ2VJbmRleF0uZW5kUG9zaXRpb24ucm93ICsgMSwgbmV3UmFuZ2VzW25ld1JhbmdlSW5kZXhdLmVuZFBvc2l0aW9uLmNvbHVtbiArIDEpO1xuXHRcdFx0XHRcdG5ld0NoYW5nZS5uZXdSYW5nZUVuZE9mZnNldCA9IG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5lbmRJbmRleDtcblx0XHRcdFx0fVxuXHRcdFx0XHRuZXdSYW5nZUluZGV4Kys7XG5cdFx0XHR9IGVsc2UgaWYgKG5ld1JhbmdlSW5kZXggPCBuZXdSYW5nZXMubGVuZ3RoICYmIG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5lbmRJbmRleCA8IG5ld0NoYW5nZS5uZXdSYW5nZVN0YXJ0T2Zmc2V0KSB7XG5cdFx0XHRcdC8vIGFkZCB0aGUgZnVsbCByYW5nZSB0byB0aGUgbWVyZ2VkIGNoYW5nZXNcblx0XHRcdFx0bWVyZ2VkQ2hhbmdlcy5wdXNoKHtcblx0XHRcdFx0XHRuZXdSYW5nZTogbmV3IFJhbmdlKG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5zdGFydFBvc2l0aW9uLnJvdyArIDEsIG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5zdGFydFBvc2l0aW9uLmNvbHVtbiArIDEsIG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5lbmRQb3NpdGlvbi5yb3cgKyAxLCBuZXdSYW5nZXNbbmV3UmFuZ2VJbmRleF0uZW5kUG9zaXRpb24uY29sdW1uICsgMSksXG5cdFx0XHRcdFx0bmV3UmFuZ2VTdGFydE9mZnNldDogbmV3UmFuZ2VzW25ld1JhbmdlSW5kZXhdLnN0YXJ0SW5kZXgsXG5cdFx0XHRcdFx0bmV3UmFuZ2VFbmRPZmZzZXQ6IG5ld1Jhbmdlc1tuZXdSYW5nZUluZGV4XS5lbmRJbmRleFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKChtZXJnZWRDaGFuZ2VzLmxlbmd0aCA+IDApICYmIChtZXJnZWRDaGFuZ2VzW21lcmdlZENoYW5nZXMubGVuZ3RoIC0gMV0ubmV3UmFuZ2VFbmRPZmZzZXQgPj0gbmV3Q2hhbmdlLm5ld1JhbmdlU3RhcnRPZmZzZXQpKSB7XG5cdFx0XHRcdC8vIE1lcmdlIHRoZSBjaGFuZ2VzXG5cdFx0XHRcdG1lcmdlZENoYW5nZXNbbWVyZ2VkQ2hhbmdlcy5sZW5ndGggLSAxXS5uZXdSYW5nZSA9IFJhbmdlLmZyb21Qb3NpdGlvbnMobWVyZ2VkQ2hhbmdlc1ttZXJnZWRDaGFuZ2VzLmxlbmd0aCAtIDFdLm5ld1JhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSwgbmV3Q2hhbmdlLm5ld1JhbmdlLmdldEVuZFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRtZXJnZWRDaGFuZ2VzW21lcmdlZENoYW5nZXMubGVuZ3RoIC0gMV0ubmV3UmFuZ2VFbmRPZmZzZXQgPSBuZXdDaGFuZ2UubmV3UmFuZ2VFbmRPZmZzZXQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZXJnZWRDaGFuZ2VzLnB1c2gobmV3Q2hhbmdlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnN0cmFpblJhbmdlcyhtZXJnZWRDaGFuZ2VzKTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbnN0cmFpblJhbmdlcyhjaGFuZ2VzOiBSYW5nZUNoYW5nZVtdKTogUmFuZ2VDaGFuZ2VbXSB7XG5cdFx0aWYgKCF0aGlzLnJhbmdlcykge1xuXHRcdFx0cmV0dXJuIGNoYW5nZXM7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29uc3RyYWluZWRDaGFuZ2VzOiBSYW5nZUNoYW5nZVtdID0gW107XG5cdFx0bGV0IGNoYW5nZXNJbmRleCA9IDA7XG5cdFx0bGV0IHJhbmdlc0luZGV4ID0gMDtcblx0XHR3aGlsZSAoY2hhbmdlc0luZGV4IDwgY2hhbmdlcy5sZW5ndGggJiYgcmFuZ2VzSW5kZXggPCB0aGlzLnJhbmdlcy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGNoYW5nZSA9IGNoYW5nZXNbY2hhbmdlc0luZGV4XTtcblx0XHRcdGNvbnN0IHJhbmdlID0gdGhpcy5yYW5nZXNbcmFuZ2VzSW5kZXhdO1xuXHRcdFx0aWYgKGNoYW5nZS5uZXdSYW5nZUVuZE9mZnNldCA8IHJhbmdlLnN0YXJ0SW5kZXgpIHtcblx0XHRcdFx0Ly8gQ2hhbmdlIGlzIGJlZm9yZSB0aGUgcmFuZ2UsIG1vdmUgdG8gdGhlIG5leHQgY2hhbmdlXG5cdFx0XHRcdGNoYW5nZXNJbmRleCsrO1xuXHRcdFx0fSBlbHNlIGlmIChjaGFuZ2UubmV3UmFuZ2VTdGFydE9mZnNldCA+IHJhbmdlLmVuZEluZGV4KSB7XG5cdFx0XHRcdC8vIENoYW5nZSBpcyBhZnRlciB0aGUgcmFuZ2UsIG1vdmUgdG8gdGhlIG5leHQgcmFuZ2Vcblx0XHRcdFx0cmFuZ2VzSW5kZXgrKztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIENoYW5nZSBpcyB3aXRoaW4gdGhlIHJhbmdlLCBjb25zdHJhaW4gaXRcblx0XHRcdFx0Y29uc3QgbmV3UmFuZ2VTdGFydE9mZnNldCA9IE1hdGgubWF4KGNoYW5nZS5uZXdSYW5nZVN0YXJ0T2Zmc2V0LCByYW5nZS5zdGFydEluZGV4KTtcblx0XHRcdFx0Y29uc3QgbmV3UmFuZ2VFbmRPZmZzZXQgPSBNYXRoLm1pbihjaGFuZ2UubmV3UmFuZ2VFbmRPZmZzZXQsIHJhbmdlLmVuZEluZGV4KTtcblx0XHRcdFx0Y29uc3QgbmV3UmFuZ2UgPSBjaGFuZ2UubmV3UmFuZ2UuaW50ZXJzZWN0UmFuZ2VzKG5ldyBSYW5nZShyYW5nZS5zdGFydFBvc2l0aW9uLnJvdyArIDEsIHJhbmdlLnN0YXJ0UG9zaXRpb24uY29sdW1uICsgMSwgcmFuZ2UuZW5kUG9zaXRpb24ucm93ICsgMSwgcmFuZ2UuZW5kUG9zaXRpb24uY29sdW1uICsgMSkpITtcblx0XHRcdFx0Y29uc3RyYWluZWRDaGFuZ2VzLnB1c2goe1xuXHRcdFx0XHRcdG5ld1JhbmdlLFxuXHRcdFx0XHRcdG5ld1JhbmdlRW5kT2Zmc2V0LFxuXHRcdFx0XHRcdG5ld1JhbmdlU3RhcnRPZmZzZXRcblx0XHRcdFx0fSk7XG5cdFx0XHRcdC8vIFJlbW92ZSB0aGUgaW50ZXJzZWN0ZWQgcmFuZ2UgZnJvbSB0aGUgY3VycmVudCBjaGFuZ2Vcblx0XHRcdFx0aWYgKG5ld1JhbmdlRW5kT2Zmc2V0IDwgY2hhbmdlLm5ld1JhbmdlRW5kT2Zmc2V0KSB7XG5cdFx0XHRcdFx0Y2hhbmdlLm5ld1JhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhuZXdSYW5nZS5nZXRFbmRQb3NpdGlvbigpLCBjaGFuZ2UubmV3UmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSk7XG5cdFx0XHRcdFx0Y2hhbmdlLm5ld1JhbmdlU3RhcnRPZmZzZXQgPSBuZXdSYW5nZUVuZE9mZnNldCArIDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gTW92ZSB0byB0aGUgbmV4dCBjaGFuZ2Vcblx0XHRcdFx0XHRjaGFuZ2VzSW5kZXgrKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBjb25zdHJhaW5lZENoYW5nZXM7XG5cdH1cblxuXHRwcml2YXRlIF91bmZpcmVkQ2hhbmdlczogSU1vZGVsQ29udGVudENoYW5nZWRFdmVudFtdIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9vbkRpZENoYW5nZUNvbnRlbnRRdWV1ZTogTGltaXRlZFF1ZXVlID0gbmV3IExpbWl0ZWRRdWV1ZSgpO1xuXHRwdWJsaWMgb25EaWRDaGFuZ2VDb250ZW50KG1vZGVsOiBJVGV4dE1vZGVsLCBjaGFuZ2VzOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50W10gfCB1bmRlZmluZWQsIHJhbmdlcz86IFBhcnNlci5SYW5nZVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgdmVyc2lvbiA9IG1vZGVsLmdldFZlcnNpb25JZCgpO1xuXHRcdGlmICh2ZXJzaW9uID09PSB0aGlzLl9lZGl0VmVyc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBuZXdSYW5nZXM6IFBhcnNlci5SYW5nZVtdID0gW107XG5cdFx0aWYgKHJhbmdlcykge1xuXHRcdFx0bmV3UmFuZ2VzID0gdGhpcy5fc2V0UmFuZ2VzKHJhbmdlcyk7XG5cdFx0fVxuXG5cdFx0aWYgKGNoYW5nZXMgJiYgY2hhbmdlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRpZiAodGhpcy5fdW5maXJlZENoYW5nZXMpIHtcblx0XHRcdFx0dGhpcy5fdW5maXJlZENoYW5nZXMucHVzaCguLi5jaGFuZ2VzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3VuZmlyZWRDaGFuZ2VzID0gY2hhbmdlcztcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIGNoYW5nZXMpIHtcblx0XHRcdFx0dGhpcy5fYXBwbHlFZGl0cyhjaGFuZ2UuY2hhbmdlcywgdmVyc2lvbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2FwcGx5RWRpdHMoW10sIHZlcnNpb24pO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudFF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0Ly8gTm8gbmVlZCB0byBjb250aW51ZSB0aGUgcXVldWUgaWYgd2UgYXJlIGRpc3Bvc2VkXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb2xkVHJlZSA9IHRoaXMuX2xhc3RGdWxseVBhcnNlZDtcblx0XHRcdGxldCBjaGFuZ2VkTm9kZXM6IFBhcnNlci5SYW5nZVtdIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHRoaXMuX2xhc3RGdWxseVBhcnNlZFdpdGhFZGl0cyAmJiB0aGlzLl9sYXN0RnVsbHlQYXJzZWQpIHtcblx0XHRcdFx0Y2hhbmdlZE5vZGVzID0gdGhpcy5maW5kQ2hhbmdlZE5vZGVzKHRoaXMuX2xhc3RGdWxseVBhcnNlZFdpdGhFZGl0cywgdGhpcy5fbGFzdEZ1bGx5UGFyc2VkKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29tcGxldGVkID0gYXdhaXQgdGhpcy5fcGFyc2VBbmRVcGRhdGVUcmVlKG1vZGVsLCB2ZXJzaW9uKTtcblx0XHRcdGlmIChjb21wbGV0ZWQpIHtcblx0XHRcdFx0bGV0IHJhbmdlczogUmFuZ2VDaGFuZ2VbXSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKCFjaGFuZ2VkTm9kZXMpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5fcmFuZ2VzKSB7XG5cdFx0XHRcdFx0XHRyYW5nZXMgPSB0aGlzLl9yYW5nZXMubWFwKHIgPT4gKHsgbmV3UmFuZ2U6IG5ldyBSYW5nZShyLnN0YXJ0UG9zaXRpb24ucm93ICsgMSwgci5zdGFydFBvc2l0aW9uLmNvbHVtbiArIDEsIHIuZW5kUG9zaXRpb24ucm93ICsgMSwgci5lbmRQb3NpdGlvbi5jb2x1bW4gKyAxKSwgb2xkUmFuZ2VMZW5ndGg6IHIuZW5kSW5kZXggLSByLnN0YXJ0SW5kZXgsIG5ld1JhbmdlU3RhcnRPZmZzZXQ6IHIuc3RhcnRJbmRleCwgbmV3UmFuZ2VFbmRPZmZzZXQ6IHIuZW5kSW5kZXggfSkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyYW5nZXMgPSBbeyBuZXdSYW5nZTogbW9kZWwuZ2V0RnVsbE1vZGVsUmFuZ2UoKSwgbmV3UmFuZ2VTdGFydE9mZnNldDogMCwgbmV3UmFuZ2VFbmRPZmZzZXQ6IG1vZGVsLmdldFZhbHVlTGVuZ3RoKCkgfV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKG9sZFRyZWUgJiYgY2hhbmdlZE5vZGVzKSB7XG5cdFx0XHRcdFx0cmFuZ2VzID0gdGhpcy5maW5kVHJlZUNoYW5nZXMoY29tcGxldGVkLCBjaGFuZ2VkTm9kZXMsIG5ld1Jhbmdlcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgY2hhbmdlcyA9IHRoaXMuX3VuZmlyZWRDaGFuZ2VzID8/IFtdO1xuXHRcdFx0XHR0aGlzLl91bmZpcmVkQ2hhbmdlcyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fb25EaWRVcGRhdGUuZmlyZSh7IGxhbmd1YWdlOiB0aGlzLmxhbmd1YWdlSWQsIHJhbmdlcywgdmVyc2lvbklkOiB2ZXJzaW9uLCB0cmVlOiBjb21wbGV0ZWQsIGluY2x1ZGVkTW9kZWxDaGFuZ2VzOiBjaGFuZ2VzIH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlFZGl0cyhjaGFuZ2VzOiBJTW9kZWxDb250ZW50Q2hhbmdlW10sIHZlcnNpb246IG51bWJlcikge1xuXHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIGNoYW5nZXMpIHtcblx0XHRcdGNvbnN0IG9yaWdpbmFsVGV4dExlbmd0aCA9IFRleHRMZW5ndGgub2ZSYW5nZShSYW5nZS5saWZ0KGNoYW5nZS5yYW5nZSkpO1xuXHRcdFx0Y29uc3QgbmV3VGV4dExlbmd0aCA9IFRleHRMZW5ndGgub2ZUZXh0KGNoYW5nZS50ZXh0KTtcblx0XHRcdGNvbnN0IHN1bW1lZFRleHRMZW5ndGhzID0gY2hhbmdlLnRleHQubGVuZ3RoID09PSAwID8gbmV3VGV4dExlbmd0aCA6IG9yaWdpbmFsVGV4dExlbmd0aC5hZGQobmV3VGV4dExlbmd0aCk7XG5cdFx0XHRjb25zdCBlZGl0ID0ge1xuXHRcdFx0XHRzdGFydEluZGV4OiBjaGFuZ2UucmFuZ2VPZmZzZXQsXG5cdFx0XHRcdG9sZEVuZEluZGV4OiBjaGFuZ2UucmFuZ2VPZmZzZXQgKyBjaGFuZ2UucmFuZ2VMZW5ndGgsXG5cdFx0XHRcdG5ld0VuZEluZGV4OiBjaGFuZ2UucmFuZ2VPZmZzZXQgKyBjaGFuZ2UudGV4dC5sZW5ndGgsXG5cdFx0XHRcdHN0YXJ0UG9zaXRpb246IHsgcm93OiBjaGFuZ2UucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gMSwgY29sdW1uOiBjaGFuZ2UucmFuZ2Uuc3RhcnRDb2x1bW4gLSAxIH0sXG5cdFx0XHRcdG9sZEVuZFBvc2l0aW9uOiB7IHJvdzogY2hhbmdlLnJhbmdlLmVuZExpbmVOdW1iZXIgLSAxLCBjb2x1bW46IGNoYW5nZS5yYW5nZS5lbmRDb2x1bW4gLSAxIH0sXG5cdFx0XHRcdG5ld0VuZFBvc2l0aW9uOiB7IHJvdzogY2hhbmdlLnJhbmdlLnN0YXJ0TGluZU51bWJlciArIHN1bW1lZFRleHRMZW5ndGhzLmxpbmVDb3VudCAtIDEsIGNvbHVtbjogc3VtbWVkVGV4dExlbmd0aHMubGluZUNvdW50ID8gc3VtbWVkVGV4dExlbmd0aHMuY29sdW1uQ291bnQgOiAoY2hhbmdlLnJhbmdlLmVuZENvbHVtbiArIHN1bW1lZFRleHRMZW5ndGhzLmNvbHVtbkNvdW50KSB9XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fdHJlZT8uZWRpdChlZGl0KTtcblx0XHRcdHRoaXMuX2xhc3RGdWxseVBhcnNlZFdpdGhFZGl0cz8uZWRpdChlZGl0KTtcblx0XHR9XG5cdFx0dGhpcy5fZWRpdFZlcnNpb24gPSB2ZXJzaW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcGFyc2VBbmRVcGRhdGVUcmVlKG1vZGVsOiBJVGV4dE1vZGVsLCB2ZXJzaW9uOiBudW1iZXIpOiBQcm9taXNlPFBhcnNlci5UcmVlIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdHJlZSA9IGF3YWl0IHRoaXMuX3BhcnNlKG1vZGVsKTtcblx0XHRpZiAodHJlZSkge1xuXHRcdFx0dGhpcy5fdHJlZT8uZGVsZXRlKCk7XG5cdFx0XHR0aGlzLl90cmVlID0gdHJlZTtcblx0XHRcdHRoaXMuX2xhc3RGdWxseVBhcnNlZD8uZGVsZXRlKCk7XG5cdFx0XHR0aGlzLl9sYXN0RnVsbHlQYXJzZWQgPSB0cmVlLmNvcHkoKTtcblx0XHRcdHRoaXMuX2xhc3RGdWxseVBhcnNlZFdpdGhFZGl0cz8uZGVsZXRlKCk7XG5cdFx0XHR0aGlzLl9sYXN0RnVsbHlQYXJzZWRXaXRoRWRpdHMgPSB0cmVlLmNvcHkoKTtcblx0XHRcdHRoaXMuX3ZlcnNpb25JZCA9IHZlcnNpb247XG5cdFx0XHRyZXR1cm4gdHJlZTtcblx0XHR9IGVsc2UgaWYgKCF0aGlzLl90cmVlKSB7XG5cdFx0XHQvLyBObyB0cmVlIG1lYW5zIHRoaXMgaXMgdGhlIGluaXRpYWwgcGFyc2UgYW5kIHRoZXJlIHdlcmUgZWRpdHNcblx0XHRcdC8vIHBhcnNlIGZ1bmN0aW9uIGRvZXNuJ3QgaGFuZGxlIHRoaXMgd2VsbCBhbmQgd2UgY2FuIGVuZCB1cCB3aXRoIGFuIGluY29ycmVjdCB0cmVlLCBzbyB3ZSByZXNldFxuXHRcdFx0dGhpcy5wYXJzZXIucmVzZXQoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX3BhcnNlKG1vZGVsOiBJVGV4dE1vZGVsKTogUHJvbWlzZTxQYXJzZXIuVHJlZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBwYXJzZVR5cGU6IFRlbGVtZXRyeVBhcnNlVHlwZSA9IFRlbGVtZXRyeVBhcnNlVHlwZS5GdWxsO1xuXHRcdGlmICh0aGlzLnRyZWUpIHtcblx0XHRcdHBhcnNlVHlwZSA9IFRlbGVtZXRyeVBhcnNlVHlwZS5JbmNyZW1lbnRhbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3BhcnNlQW5kWWllbGQobW9kZWwsIHBhcnNlVHlwZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wYXJzZUFuZFlpZWxkKG1vZGVsOiBJVGV4dE1vZGVsLCBwYXJzZVR5cGU6IFRlbGVtZXRyeVBhcnNlVHlwZSk6IFByb21pc2U8UGFyc2VyLlRyZWUgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgdGltZTogbnVtYmVyID0gMDtcblx0XHRsZXQgcGFzc2VzOiBudW1iZXIgPSAwO1xuXHRcdGNvbnN0IGluUHJvZ3Jlc3NWZXJzaW9uID0gdGhpcy5fZWRpdFZlcnNpb247XG5cdFx0bGV0IG5ld1RyZWU6IFBhcnNlci5UcmVlIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9sYXN0WWllbGRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cblx0XHRkbyB7XG5cdFx0XHRjb25zdCB0aW1lciA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bmV3VHJlZSA9IHRoaXMucGFyc2VyLnBhcnNlKChpbmRleDogbnVtYmVyLCBwb3NpdGlvbj86IFBhcnNlci5Qb2ludCkgPT4gdGhpcy5fcGFyc2VDYWxsYmFjayhtb2RlbCwgaW5kZXgpLCB0aGlzLl90cmVlLCB7IHByb2dyZXNzQ2FsbGJhY2s6IHRoaXMuX3BhcnNlUHJvZ3Jlc3NDYWxsYmFjay5iaW5kKHRoaXMpLCBpbmNsdWRlZFJhbmdlczogdGhpcy5fcmFuZ2VzIH0pO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBwYXJzaW5nIGNhbiBmYWlsIHdoZW4gdGhlIHRpbWVvdXQgaXMgcmVhY2hlZCwgd2lsbCByZXN1bWUgdXBvbiBuZXh0IGxvb3Bcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRpbWUgKz0gcGVyZm9ybWFuY2Uubm93KCkgLSB0aW1lcjtcblx0XHRcdFx0cGFzc2VzKys7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNvIGxvbmcgYXMgdGhpcyBpc24ndCB0aGUgaW5pdGlhbCBwYXJzZSwgZXZlbiBpZiB0aGUgbW9kZWwgY2hhbmdlcyBhbmQgZWRpdHMgYXJlIGFwcGxpZWQsIHRoZSB0cmVlIHBhcnNpbmcgd2lsbCBjb250aW51ZSBjb3JyZWN0bHkgYWZ0ZXIgdGhlIGF3YWl0LlxuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRUaW1lb3V0MChyZXNvbHZlKSk7XG5cblx0XHR9IHdoaWxlICghbW9kZWwuaXNEaXNwb3NlZCgpICYmICF0aGlzLmlzRGlzcG9zZWQgJiYgIW5ld1RyZWUgJiYgaW5Qcm9ncmVzc1ZlcnNpb24gPT09IG1vZGVsLmdldFZlcnNpb25JZCgpKTtcblx0XHR0aGlzLnNlbmRQYXJzZVRpbWVUZWxlbWV0cnkocGFyc2VUeXBlLCB0aW1lLCBwYXNzZXMpO1xuXHRcdHJldHVybiAobmV3VHJlZSAmJiAoaW5Qcm9ncmVzc1ZlcnNpb24gPT09IG1vZGVsLmdldFZlcnNpb25JZCgpKSkgPyBuZXdUcmVlIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGFzdFlpZWxkVGltZTogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfcGFyc2VQcm9ncmVzc0NhbGxiYWNrKHN0YXRlOiBQYXJzZXIuUGFyc2VTdGF0ZSkge1xuXHRcdGNvbnN0IG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHRcdGlmIChub3cgLSB0aGlzLl9sYXN0WWllbGRUaW1lID4gNTApIHtcblx0XHRcdHRoaXMuX2xhc3RZaWVsZFRpbWUgPSBub3c7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGFyc2VDYWxsYmFjayh0ZXh0TW9kZWw6IElUZXh0TW9kZWwsIGluZGV4OiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gdGV4dE1vZGVsLmdldFRleHRCdWZmZXIoKS5nZXROZWFyZXN0Q2h1bmsoaW5kZXgpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0Vycm9yIGdldHRpbmcgY2h1bmsgZm9yIHRyZWUtc2l0dGVyIHBhcnNpbmcnLCBlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX3JhbmdlczogUGFyc2VyLlJhbmdlW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3NldFJhbmdlcyhuZXdSYW5nZXM6IFBhcnNlci5SYW5nZVtdKTogUGFyc2VyLlJhbmdlW10ge1xuXHRcdGNvbnN0IHVuS25vd25SYW5nZXM6IFBhcnNlci5SYW5nZVtdID0gW107XG5cdFx0Ly8gSWYgd2UgaGF2ZSBleGlzdGluZyByYW5nZXMsIGZpbmQgdGhlIHBhcnRzIG9mIHRoZSBuZXcgcmFuZ2VzIHRoYXQgYXJlIG5vdCBpbmNsdWRlZCBpbiB0aGUgZXhpc3Rpbmcgb25lc1xuXHRcdGlmICh0aGlzLl9yYW5nZXMpIHtcblx0XHRcdGZvciAoY29uc3QgbmV3UmFuZ2Ugb2YgbmV3UmFuZ2VzKSB7XG5cdFx0XHRcdGxldCBpc0Z1bGx5SW5jbHVkZWQgPSBmYWxzZTtcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3Jhbmdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGV4aXN0aW5nUmFuZ2UgPSB0aGlzLl9yYW5nZXNbaV07XG5cblx0XHRcdFx0XHRpZiAocmFuZ2VzRXF1YWwoZXhpc3RpbmdSYW5nZSwgbmV3UmFuZ2UpIHx8IHJhbmdlc0ludGVyc2VjdChleGlzdGluZ1JhbmdlLCBuZXdSYW5nZSkpIHtcblx0XHRcdFx0XHRcdGlzRnVsbHlJbmNsdWRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWlzRnVsbHlJbmNsdWRlZCkge1xuXHRcdFx0XHRcdHVuS25vd25SYW5nZXMucHVzaChuZXdSYW5nZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gTm8gZXhpc3RpbmcgcmFuZ2VzLCBhbGwgbmV3IHJhbmdlcyBhcmUgdW5rbm93blxuXHRcdFx0dW5Lbm93blJhbmdlcy5wdXNoKC4uLm5ld1Jhbmdlcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmFuZ2VzID0gbmV3UmFuZ2VzO1xuXHRcdHJldHVybiB1bktub3duUmFuZ2VzO1xuXHR9XG5cblx0Z2V0IHJhbmdlcygpOiBQYXJzZXIuUmFuZ2VbXSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jhbmdlcztcblx0fVxuXG5cdHByaXZhdGUgc2VuZFBhcnNlVGltZVRlbGVtZXRyeShwYXJzZVR5cGU6IFRlbGVtZXRyeVBhcnNlVHlwZSwgdGltZTogbnVtYmVyLCBwYXNzZXM6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYFRyZWUgcGFyc2luZyAoJHtwYXJzZVR5cGV9KSB0b29rICR7dGltZX0gbXMgYW5kICR7cGFzc2VzfSBwYXNzZXMuYCk7XG5cdFx0dHlwZSBQYXJzZVRpbWVDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAnYWxleHIwMCc7XG5cdFx0XHRjb21tZW50OiAnVXNlZCB0byB1bmRlcnN0YW5kIGhvdyBsb25nIGl0IHRha2VzIHRvIHBhcnNlIGEgdHJlZS1zaXR0ZXIgdHJlZSc7XG5cdFx0XHRsYW5ndWFnZUlkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIHByb2dyYW1taW5nIGxhbmd1YWdlIElELicgfTtcblx0XHRcdHRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGlzTWVhc3VyZW1lbnQ6IHRydWU7IGNvbW1lbnQ6ICdUaGUgbXMgaXQgdG9vayB0byBwYXJzZScgfTtcblx0XHRcdHBhc3NlczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgaXNNZWFzdXJlbWVudDogdHJ1ZTsgY29tbWVudDogJ1RoZSBudW1iZXIgb2YgcGFzc2VzIGl0IHRvb2sgdG8gcGFyc2UnIH07XG5cdFx0fTtcblx0XHRpZiAocGFyc2VUeXBlID09PSBUZWxlbWV0cnlQYXJzZVR5cGUuRnVsbCkge1xuXHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPHsgbGFuZ3VhZ2VJZDogc3RyaW5nOyB0aW1lOiBudW1iZXI7IHBhc3NlczogbnVtYmVyIH0sIFBhcnNlVGltZUNsYXNzaWZpY2F0aW9uPihgdHJlZVNpdHRlci5mdWxsUGFyc2VgLCB7IGxhbmd1YWdlSWQ6IHRoaXMubGFuZ3VhZ2VJZCwgdGltZSwgcGFzc2VzIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8eyBsYW5ndWFnZUlkOiBzdHJpbmc7IHRpbWU6IG51bWJlcjsgcGFzc2VzOiBudW1iZXIgfSwgUGFyc2VUaW1lQ2xhc3NpZmljYXRpb24+KGB0cmVlU2l0dGVyLmluY3JlbWVudGFsUGFyc2VgLCB7IGxhbmd1YWdlSWQ6IHRoaXMubGFuZ3VhZ2VJZCwgdGltZSwgcGFzc2VzIH0pO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiByYW5nZXNFcXVhbChhOiBQYXJzZXIuUmFuZ2UsIGI6IFBhcnNlci5SYW5nZSkge1xuXHRyZXR1cm4gKGEuc3RhcnRQb3NpdGlvbi5yb3cgPT09IGIuc3RhcnRQb3NpdGlvbi5yb3cpXG5cdFx0JiYgKGEuc3RhcnRQb3NpdGlvbi5jb2x1bW4gPT09IGIuc3RhcnRQb3NpdGlvbi5jb2x1bW4pXG5cdFx0JiYgKGEuZW5kUG9zaXRpb24ucm93ID09PSBiLmVuZFBvc2l0aW9uLnJvdylcblx0XHQmJiAoYS5lbmRQb3NpdGlvbi5jb2x1bW4gPT09IGIuZW5kUG9zaXRpb24uY29sdW1uKVxuXHRcdCYmIChhLnN0YXJ0SW5kZXggPT09IGIuc3RhcnRJbmRleClcblx0XHQmJiAoYS5lbmRJbmRleCA9PT0gYi5lbmRJbmRleCk7XG59XG5cbmZ1bmN0aW9uIHJhbmdlc0ludGVyc2VjdChhOiBQYXJzZXIuUmFuZ2UsIGI6IFBhcnNlci5SYW5nZSkge1xuXHRyZXR1cm4gKGEuc3RhcnRJbmRleCA8PSBiLnN0YXJ0SW5kZXggJiYgYS5lbmRJbmRleCA+PSBiLnN0YXJ0SW5kZXgpIHx8XG5cdFx0KGIuc3RhcnRJbmRleCA8PSBhLnN0YXJ0SW5kZXggJiYgYi5lbmRJbmRleCA+PSBhLnN0YXJ0SW5kZXgpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUEwRiwyQkFBaUQ7QUFDM0ksU0FBUyxZQUFZLGlCQUFpQixlQUE0QjtBQUdsRSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUE0Qix1QkFBdUI7QUFDbkQsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQTBCLGtCQUFrQjtBQUM1QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQiwyQkFBMkI7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QSxFQUdRLFdBQVcsV0FBMkM7QUFDN0QsVUFBTSxnQkFBZ0MsQ0FBQztBQUV2QyxRQUFJLEtBQUssU0FBUztBQUNqQixpQkFBVyxZQUFZLFdBQVc7QUFDakMsWUFBSSxrQkFBa0I7QUFFdEIsaUJBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxRQUFRLFFBQVEsS0FBSztBQUM3QyxnQkFBTSxnQkFBZ0IsS0FBSyxRQUFRLENBQUM7QUFFcEMsY0FBSSxZQUFZLGVBQWUsUUFBUSxLQUFLLGdCQUFnQixlQUFlLFFBQVEsR0FBRztBQUNyRiw4QkFBa0I7QUFDbEI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUVBLFlBQUksQ0FBQyxpQkFBaUI7QUFDckIsd0JBQWMsS0FBSyxRQUFRO0FBQUEsUUFDNUI7QUFBQSxNQUNEO0FBQUEsSUFDRCxPQUFPO0FBRU4sb0JBQWMsS0FBSyxHQUFHLFNBQVM7QUFBQSxJQUNoQztBQUVBLFNBQUssVUFBVTtBQUNmLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxJQUFJLFNBQXFDO0FBQ3hDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVRLHVCQUF1QixXQUErQixNQUFjLFFBQXNCO0FBQ2pHLFNBQUssWUFBWSxNQUFNLGlCQUFpQixTQUFTLFVBQVUsSUFBSSxXQUFXLE1BQU0sVUFBVTtBQVExRixRQUFJLGNBQWMsd0JBQXlCO0FBQzFDLFdBQUssa0JBQWtCLFdBQTBGLHdCQUF3QixFQUFFLFlBQVksS0FBSyxZQUFZLE1BQU0sT0FBTyxDQUFDO0FBQUEsSUFDdkwsT0FBTztBQUNOLFdBQUssa0JBQWtCLFdBQTBGLCtCQUErQixFQUFFLFlBQVksS0FBSyxZQUFZLE1BQU0sT0FBTyxDQUFDO0FBQUEsSUFDOUw7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxTQUFTLFlBQVksR0FBaUIsR0FBaUI7QUFDdEQsU0FBUSxFQUFFLGNBQWMsUUFBUSxFQUFFLGNBQWMsT0FDM0MsRUFBRSxjQUFjLFdBQVcsRUFBRSxjQUFjLFVBQzNDLEVBQUUsWUFBWSxRQUFRLEVBQUUsWUFBWSxPQUNwQyxFQUFFLFlBQVksV0FBVyxFQUFFLFlBQVksVUFDdkMsRUFBRSxlQUFlLEVBQUUsY0FDbkIsRUFBRSxhQUFhLEVBQUU7QUFDdkI7QUFFQSxTQUFTLGdCQUFnQixHQUFpQixHQUFpQjtBQUMxRCxTQUFRLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsY0FDdEQsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRTtBQUNuRDsiLAogICJuYW1lcyI6IFsiVGVsZW1ldHJ5UGFyc2VUeXBlIiwgInJhbmdlcyIsICJjaGFuZ2VzIl0KfQo=
