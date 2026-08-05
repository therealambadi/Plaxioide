import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { BracketInfo, BracketPairWithMinIndentationInfo } from "../../../textModelBracketPairs.js";
import { AstNodeKind } from "./ast.js";
import { TextEditInfo } from "./beforeEditPositionMapper.js";
import { LanguageAgnosticBracketTokens } from "./brackets.js";
import { lengthAdd, lengthGreaterThanEqual, lengthLessThan, lengthLessThanEqual, lengthsToRange, lengthZero, positionToLength, toLength } from "./length.js";
import { parseDocument } from "./parser.js";
import { DenseKeyProvider } from "./smallImmutableSet.js";
import { FastTokenizer, TextBufferTokenizer } from "./tokenizer.js";
import { BackgroundTokenizationState } from "../../../tokenizationTextModelPart.js";
import { CallbackIterable } from "../../../../../base/common/arrays.js";
import { combineTextEditInfos } from "./combineTextEditInfos.js";
class BracketPairsTree extends Disposable {
  constructor(textModel, getLanguageConfiguration) {
    super();
    this.textModel = textModel;
    this.getLanguageConfiguration = getLanguageConfiguration;
    this.didChangeEmitter = new Emitter();
    this.denseKeyProvider = new DenseKeyProvider();
    this.brackets = new LanguageAgnosticBracketTokens(this.denseKeyProvider, this.getLanguageConfiguration);
    this.onDidChange = this.didChangeEmitter.event;
    this.queuedTextEditsForInitialAstWithoutTokens = [];
    this.queuedTextEdits = [];
    if (!textModel.tokenization.hasTokens) {
      const brackets = this.brackets.getSingleLanguageBracketTokens(this.textModel.getLanguageId());
      const tokenizer = new FastTokenizer(this.textModel.getValue(), brackets);
      this.initialAstWithoutTokens = parseDocument(tokenizer, [], void 0, true);
      this.astWithTokens = this.initialAstWithoutTokens;
    } else if (textModel.tokenization.backgroundTokenizationState === BackgroundTokenizationState.Completed) {
      this.initialAstWithoutTokens = void 0;
      this.astWithTokens = this.parseDocumentFromTextBuffer([], void 0, false);
    } else {
      this.initialAstWithoutTokens = this.parseDocumentFromTextBuffer([], void 0, true);
      this.astWithTokens = this.initialAstWithoutTokens;
    }
  }
  didLanguageChange(languageId) {
    return this.brackets.didLanguageChange(languageId);
  }
  //#region TextModel events
  handleDidChangeBackgroundTokenizationState() {
    if (this.textModel.tokenization.backgroundTokenizationState === BackgroundTokenizationState.Completed) {
      const wasUndefined = this.initialAstWithoutTokens === void 0;
      this.initialAstWithoutTokens = void 0;
      if (!wasUndefined) {
        this.didChangeEmitter.fire();
      }
    }
  }
  handleDidChangeTokens({ ranges }) {
    const edits = ranges.map(
      (r) => new TextEditInfo(
        toLength(r.fromLineNumber - 1, 0),
        toLength(r.toLineNumber, 0),
        toLength(r.toLineNumber - r.fromLineNumber + 1, 0)
      )
    );
    this.handleEdits(edits, true);
    if (!this.initialAstWithoutTokens) {
      this.didChangeEmitter.fire();
    }
  }
  handleContentChanged(change) {
    const edits = TextEditInfo.fromModelContentChanges(change.changes);
    this.handleEdits(edits, false);
  }
  handleEdits(edits, tokenChange) {
    const result = combineTextEditInfos(this.queuedTextEdits, edits);
    this.queuedTextEdits = result;
    if (this.initialAstWithoutTokens && !tokenChange) {
      this.queuedTextEditsForInitialAstWithoutTokens = combineTextEditInfos(this.queuedTextEditsForInitialAstWithoutTokens, edits);
    }
  }
  //#endregion
  flushQueue() {
    if (this.queuedTextEdits.length > 0) {
      this.astWithTokens = this.parseDocumentFromTextBuffer(this.queuedTextEdits, this.astWithTokens, false);
      this.queuedTextEdits = [];
    }
    if (this.queuedTextEditsForInitialAstWithoutTokens.length > 0) {
      if (this.initialAstWithoutTokens) {
        this.initialAstWithoutTokens = this.parseDocumentFromTextBuffer(this.queuedTextEditsForInitialAstWithoutTokens, this.initialAstWithoutTokens, false);
      }
      this.queuedTextEditsForInitialAstWithoutTokens = [];
    }
  }
  /**
   * @pure (only if isPure = true)
  */
  parseDocumentFromTextBuffer(edits, previousAst, immutable) {
    const isPure = false;
    const previousAstClone = isPure ? previousAst?.deepClone() : previousAst;
    const tokenizer = new TextBufferTokenizer(this.textModel, this.brackets);
    const result = parseDocument(tokenizer, edits, previousAstClone, immutable);
    return result;
  }
  getBracketsInRange(range, onlyColorizedBrackets) {
    this.flushQueue();
    const startOffset = toLength(range.startLineNumber - 1, range.startColumn - 1);
    const endOffset = toLength(range.endLineNumber - 1, range.endColumn - 1);
    return new CallbackIterable((cb) => {
      const node = this.initialAstWithoutTokens || this.astWithTokens;
      collectBrackets(node, lengthZero, node.length, startOffset, endOffset, cb, 0, 0, /* @__PURE__ */ new Map(), onlyColorizedBrackets);
    });
  }
  getBracketPairsInRange(range, includeMinIndentation) {
    this.flushQueue();
    const startLength = positionToLength(range.getStartPosition());
    const endLength = positionToLength(range.getEndPosition());
    return new CallbackIterable((cb) => {
      const node = this.initialAstWithoutTokens || this.astWithTokens;
      const context = new CollectBracketPairsContext(cb, includeMinIndentation, this.textModel);
      collectBracketPairs(node, lengthZero, node.length, startLength, endLength, context, 0, /* @__PURE__ */ new Map());
    });
  }
  getFirstBracketAfter(position) {
    this.flushQueue();
    const node = this.initialAstWithoutTokens || this.astWithTokens;
    return getFirstBracketAfter(node, lengthZero, node.length, positionToLength(position));
  }
  getFirstBracketBefore(position) {
    this.flushQueue();
    const node = this.initialAstWithoutTokens || this.astWithTokens;
    return getFirstBracketBefore(node, lengthZero, node.length, positionToLength(position));
  }
}
function getFirstBracketBefore(node, nodeOffsetStart, nodeOffsetEnd, position) {
  if (node.kind === AstNodeKind.List || node.kind === AstNodeKind.Pair) {
    const lengths = [];
    for (const child of node.children) {
      nodeOffsetEnd = lengthAdd(nodeOffsetStart, child.length);
      lengths.push({ nodeOffsetStart, nodeOffsetEnd });
      nodeOffsetStart = nodeOffsetEnd;
    }
    for (let i = lengths.length - 1; i >= 0; i--) {
      const { nodeOffsetStart: nodeOffsetStart2, nodeOffsetEnd: nodeOffsetEnd2 } = lengths[i];
      if (lengthLessThan(nodeOffsetStart2, position)) {
        const result = getFirstBracketBefore(node.children[i], nodeOffsetStart2, nodeOffsetEnd2, position);
        if (result) {
          return result;
        }
      }
    }
    return null;
  } else if (node.kind === AstNodeKind.UnexpectedClosingBracket) {
    return null;
  } else if (node.kind === AstNodeKind.Bracket) {
    const range = lengthsToRange(nodeOffsetStart, nodeOffsetEnd);
    return {
      bracketInfo: node.bracketInfo,
      range
    };
  }
  return null;
}
function getFirstBracketAfter(node, nodeOffsetStart, nodeOffsetEnd, position) {
  if (node.kind === AstNodeKind.List || node.kind === AstNodeKind.Pair) {
    for (const child of node.children) {
      nodeOffsetEnd = lengthAdd(nodeOffsetStart, child.length);
      if (lengthLessThan(position, nodeOffsetEnd)) {
        const result = getFirstBracketAfter(child, nodeOffsetStart, nodeOffsetEnd, position);
        if (result) {
          return result;
        }
      }
      nodeOffsetStart = nodeOffsetEnd;
    }
    return null;
  } else if (node.kind === AstNodeKind.UnexpectedClosingBracket) {
    return null;
  } else if (node.kind === AstNodeKind.Bracket) {
    const range = lengthsToRange(nodeOffsetStart, nodeOffsetEnd);
    return {
      bracketInfo: node.bracketInfo,
      range
    };
  }
  return null;
}
function collectBrackets(node, nodeOffsetStart, nodeOffsetEnd, startOffset, endOffset, push, level, nestingLevelOfEqualBracketType, levelPerBracketType, onlyColorizedBrackets, parentPairIsIncomplete = false) {
  if (level > 200) {
    return true;
  }
  whileLoop:
    while (true) {
      switch (node.kind) {
        case AstNodeKind.List: {
          const childCount = node.childrenLength;
          for (let i = 0; i < childCount; i++) {
            const child = node.getChild(i);
            if (!child) {
              continue;
            }
            nodeOffsetEnd = lengthAdd(nodeOffsetStart, child.length);
            if (lengthLessThanEqual(nodeOffsetStart, endOffset) && lengthGreaterThanEqual(nodeOffsetEnd, startOffset)) {
              const childEndsAfterEnd = lengthGreaterThanEqual(nodeOffsetEnd, endOffset);
              if (childEndsAfterEnd) {
                node = child;
                continue whileLoop;
              }
              const shouldContinue = collectBrackets(child, nodeOffsetStart, nodeOffsetEnd, startOffset, endOffset, push, level, 0, levelPerBracketType, onlyColorizedBrackets);
              if (!shouldContinue) {
                return false;
              }
            }
            nodeOffsetStart = nodeOffsetEnd;
          }
          return true;
        }
        case AstNodeKind.Pair: {
          const colorize = !onlyColorizedBrackets || !node.closingBracket || node.closingBracket.bracketInfo.closesColorized(node.openingBracket.bracketInfo);
          let levelPerBracket = 0;
          if (levelPerBracketType) {
            let existing = levelPerBracketType.get(node.openingBracket.text);
            if (existing === void 0) {
              existing = 0;
            }
            levelPerBracket = existing;
            if (colorize) {
              existing++;
              levelPerBracketType.set(node.openingBracket.text, existing);
            }
          }
          const childCount = node.childrenLength;
          for (let i = 0; i < childCount; i++) {
            const child = node.getChild(i);
            if (!child) {
              continue;
            }
            nodeOffsetEnd = lengthAdd(nodeOffsetStart, child.length);
            if (lengthLessThanEqual(nodeOffsetStart, endOffset) && lengthGreaterThanEqual(nodeOffsetEnd, startOffset)) {
              const childEndsAfterEnd = lengthGreaterThanEqual(nodeOffsetEnd, endOffset);
              if (childEndsAfterEnd && child.kind !== AstNodeKind.Bracket) {
                node = child;
                if (colorize) {
                  level++;
                  nestingLevelOfEqualBracketType = levelPerBracket + 1;
                } else {
                  nestingLevelOfEqualBracketType = levelPerBracket;
                }
                continue whileLoop;
              }
              if (colorize || child.kind !== AstNodeKind.Bracket || !node.closingBracket) {
                const shouldContinue = collectBrackets(
                  child,
                  nodeOffsetStart,
                  nodeOffsetEnd,
                  startOffset,
                  endOffset,
                  push,
                  colorize ? level + 1 : level,
                  colorize ? levelPerBracket + 1 : levelPerBracket,
                  levelPerBracketType,
                  onlyColorizedBrackets,
                  !node.closingBracket
                );
                if (!shouldContinue) {
                  return false;
                }
              }
            }
            nodeOffsetStart = nodeOffsetEnd;
          }
          levelPerBracketType?.set(node.openingBracket.text, levelPerBracket);
          return true;
        }
        case AstNodeKind.UnexpectedClosingBracket: {
          const range = lengthsToRange(nodeOffsetStart, nodeOffsetEnd);
          return push(new BracketInfo(range, level - 1, 0, true));
        }
        case AstNodeKind.Bracket: {
          const range = lengthsToRange(nodeOffsetStart, nodeOffsetEnd);
          return push(new BracketInfo(range, level - 1, nestingLevelOfEqualBracketType - 1, parentPairIsIncomplete));
        }
        case AstNodeKind.Text:
          return true;
      }
    }
}
class CollectBracketPairsContext {
  constructor(push, includeMinIndentation, textModel) {
    this.push = push;
    this.includeMinIndentation = includeMinIndentation;
    this.textModel = textModel;
  }
}
function collectBracketPairs(node, nodeOffsetStart, nodeOffsetEnd, startOffset, endOffset, context, level, levelPerBracketType) {
  if (level > 200) {
    return true;
  }
  let shouldContinue = true;
  if (node.kind === AstNodeKind.Pair) {
    let levelPerBracket = 0;
    if (levelPerBracketType) {
      let existing = levelPerBracketType.get(node.openingBracket.text);
      if (existing === void 0) {
        existing = 0;
      }
      levelPerBracket = existing;
      existing++;
      levelPerBracketType.set(node.openingBracket.text, existing);
    }
    const openingBracketEnd = lengthAdd(nodeOffsetStart, node.openingBracket.length);
    let minIndentation = -1;
    if (context.includeMinIndentation) {
      minIndentation = node.computeMinIndentation(
        nodeOffsetStart,
        context.textModel
      );
    }
    shouldContinue = context.push(
      new BracketPairWithMinIndentationInfo(
        lengthsToRange(nodeOffsetStart, nodeOffsetEnd),
        lengthsToRange(nodeOffsetStart, openingBracketEnd),
        node.closingBracket ? lengthsToRange(
          lengthAdd(openingBracketEnd, node.child?.length || lengthZero),
          nodeOffsetEnd
        ) : void 0,
        level,
        levelPerBracket,
        node,
        minIndentation
      )
    );
    nodeOffsetStart = openingBracketEnd;
    if (shouldContinue && node.child) {
      const child = node.child;
      nodeOffsetEnd = lengthAdd(nodeOffsetStart, child.length);
      if (lengthLessThanEqual(nodeOffsetStart, endOffset) && lengthGreaterThanEqual(nodeOffsetEnd, startOffset)) {
        shouldContinue = collectBracketPairs(
          child,
          nodeOffsetStart,
          nodeOffsetEnd,
          startOffset,
          endOffset,
          context,
          level + 1,
          levelPerBracketType
        );
        if (!shouldContinue) {
          return false;
        }
      }
    }
    levelPerBracketType?.set(node.openingBracket.text, levelPerBracket);
  } else {
    let curOffset = nodeOffsetStart;
    for (const child of node.children) {
      const childOffset = curOffset;
      curOffset = lengthAdd(curOffset, child.length);
      if (lengthLessThanEqual(childOffset, endOffset) && lengthLessThanEqual(startOffset, curOffset)) {
        shouldContinue = collectBracketPairs(
          child,
          childOffset,
          curOffset,
          startOffset,
          endOffset,
          context,
          level,
          levelPerBracketType
        );
        if (!shouldContinue) {
          return false;
        }
      }
    }
  }
  return shouldContinue;
}
export {
  BracketPairsTree
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzVHJlZS9icmFja2V0UGFpcnNUcmVlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBCcmFja2V0SW5mbywgQnJhY2tldFBhaXJXaXRoTWluSW5kZW50YXRpb25JbmZvLCBJRm91bmRCcmFja2V0IH0gZnJvbSAnLi4vLi4vLi4vdGV4dE1vZGVsQnJhY2tldFBhaXJzLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50LCBJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQXN0Tm9kZSwgQXN0Tm9kZUtpbmQgfSBmcm9tICcuL2FzdC5qcyc7XG5pbXBvcnQgeyBUZXh0RWRpdEluZm8gfSBmcm9tICcuL2JlZm9yZUVkaXRQb3NpdGlvbk1hcHBlci5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUFnbm9zdGljQnJhY2tldFRva2VucyB9IGZyb20gJy4vYnJhY2tldHMuanMnO1xuaW1wb3J0IHsgTGVuZ3RoLCBsZW5ndGhBZGQsIGxlbmd0aEdyZWF0ZXJUaGFuRXF1YWwsIGxlbmd0aExlc3NUaGFuLCBsZW5ndGhMZXNzVGhhbkVxdWFsLCBsZW5ndGhzVG9SYW5nZSwgbGVuZ3RoWmVybywgcG9zaXRpb25Ub0xlbmd0aCwgdG9MZW5ndGggfSBmcm9tICcuL2xlbmd0aC5qcyc7XG5pbXBvcnQgeyBwYXJzZURvY3VtZW50IH0gZnJvbSAnLi9wYXJzZXIuanMnO1xuaW1wb3J0IHsgRGVuc2VLZXlQcm92aWRlciB9IGZyb20gJy4vc21hbGxJbW11dGFibGVTZXQuanMnO1xuaW1wb3J0IHsgRmFzdFRva2VuaXplciwgVGV4dEJ1ZmZlclRva2VuaXplciB9IGZyb20gJy4vdG9rZW5pemVyLmpzJztcbmltcG9ydCB7IEJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZSB9IGZyb20gJy4uLy4uLy4uL3Rva2VuaXphdGlvblRleHRNb2RlbFBhcnQuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IENhbGxiYWNrSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgY29tYmluZVRleHRFZGl0SW5mb3MgfSBmcm9tICcuL2NvbWJpbmVUZXh0RWRpdEluZm9zLmpzJztcbmltcG9ydCB7IENsb3NpbmdCcmFja2V0S2luZCwgT3BlbmluZ0JyYWNrZXRLaW5kIH0gZnJvbSAnLi4vLi4vLi4vbGFuZ3VhZ2VzL3N1cHBvcnRzL2xhbmd1YWdlQnJhY2tldHNDb25maWd1cmF0aW9uLmpzJztcblxuZXhwb3J0IGNsYXNzIEJyYWNrZXRQYWlyc1RyZWUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBkaWRDaGFuZ2VFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblxuXHQvKlxuXHRcdFRoZXJlIGFyZSB0d28gdHJlZXM6XG5cdFx0KiBUaGUgaW5pdGlhbCB0cmVlIHRoYXQgaGFzIG5vIHRva2VuIGluZm9ybWF0aW9uIGFuZCBpcyB1c2VkIGZvciBwZXJmb3JtYW50IGluaXRpYWwgYnJhY2tldCBjb2xvcml6YXRpb24uXG5cdFx0KiBUaGUgdHJlZSB0aGF0IHVzZWQgdG9rZW4gaW5mb3JtYXRpb24gdG8gZGV0ZWN0IGJyYWNrZXQgcGFpcnMuXG5cblx0XHRUbyBwcmV2ZW50IGZsaWNrZXJpbmcsIHdlIG9ubHkgc3dpdGNoIGZyb20gdGhlIGluaXRpYWwgdHJlZSB0byB0cmVlIHdpdGggdG9rZW4gaW5mb3JtYXRpb25cblx0XHR3aGVuIHRva2VuaXphdGlvbiBjb21wbGV0ZXMuXG5cdFx0U2luY2UgdGhlIHRleHQgY2FuIGJlIGVkaXRlZCB3aGlsZSBiYWNrZ3JvdW5kIHRva2VuaXphdGlvbiBpcyBpbiBwcm9ncmVzcywgd2UgbmVlZCB0byB1cGRhdGUgYm90aCB0cmVlcy5cblx0Ki9cblx0cHJpdmF0ZSBpbml0aWFsQXN0V2l0aG91dFRva2VuczogQXN0Tm9kZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBhc3RXaXRoVG9rZW5zOiBBc3ROb2RlIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGVuc2VLZXlQcm92aWRlciA9IG5ldyBEZW5zZUtleVByb3ZpZGVyPHN0cmluZz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBicmFja2V0cyA9IG5ldyBMYW5ndWFnZUFnbm9zdGljQnJhY2tldFRva2Vucyh0aGlzLmRlbnNlS2V5UHJvdmlkZXIsIHRoaXMuZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKTtcblxuXHRwdWJsaWMgZGlkTGFuZ3VhZ2VDaGFuZ2UobGFuZ3VhZ2VJZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuYnJhY2tldHMuZGlkTGFuZ3VhZ2VDaGFuZ2UobGFuZ3VhZ2VJZCk7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLmRpZENoYW5nZUVtaXR0ZXIuZXZlbnQ7XG5cdHByaXZhdGUgcXVldWVkVGV4dEVkaXRzRm9ySW5pdGlhbEFzdFdpdGhvdXRUb2tlbnM6IFRleHRFZGl0SW5mb1tdID0gW107XG5cdHByaXZhdGUgcXVldWVkVGV4dEVkaXRzOiBUZXh0RWRpdEluZm9bXSA9IFtdO1xuXG5cdHB1YmxpYyBjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbDogVGV4dE1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uOiAobGFuZ3VhZ2VJZDogc3RyaW5nKSA9PiBSZXNvbHZlZExhbmd1YWdlQ29uZmlndXJhdGlvblxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKCF0ZXh0TW9kZWwudG9rZW5pemF0aW9uLmhhc1Rva2Vucykge1xuXHRcdFx0Y29uc3QgYnJhY2tldHMgPSB0aGlzLmJyYWNrZXRzLmdldFNpbmdsZUxhbmd1YWdlQnJhY2tldFRva2Vucyh0aGlzLnRleHRNb2RlbC5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdFx0Y29uc3QgdG9rZW5pemVyID0gbmV3IEZhc3RUb2tlbml6ZXIodGhpcy50ZXh0TW9kZWwuZ2V0VmFsdWUoKSwgYnJhY2tldHMpO1xuXHRcdFx0dGhpcy5pbml0aWFsQXN0V2l0aG91dFRva2VucyA9IHBhcnNlRG9jdW1lbnQodG9rZW5pemVyLCBbXSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdHRoaXMuYXN0V2l0aFRva2VucyA9IHRoaXMuaW5pdGlhbEFzdFdpdGhvdXRUb2tlbnM7XG5cdFx0fSBlbHNlIGlmICh0ZXh0TW9kZWwudG9rZW5pemF0aW9uLmJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZSA9PT0gQmFja2dyb3VuZFRva2VuaXphdGlvblN0YXRlLkNvbXBsZXRlZCkge1xuXHRcdFx0Ly8gU2tpcCB0aGUgaW5pdGlhbCBhc3QsIGFzIHRoZXJlIGlzIG5vIGZsaWNrZXJpbmcuXG5cdFx0XHQvLyBEaXJlY3RseSBjcmVhdGUgdGhlIHRyZWUgd2l0aCB0b2tlbiBpbmZvcm1hdGlvbi5cblx0XHRcdHRoaXMuaW5pdGlhbEFzdFdpdGhvdXRUb2tlbnMgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLmFzdFdpdGhUb2tlbnMgPSB0aGlzLnBhcnNlRG9jdW1lbnRGcm9tVGV4dEJ1ZmZlcihbXSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFdlIG1pc3NlZCBzb21lIHRva2VuIGNoYW5nZXMgYWxyZWFkeSwgc28gd2UgY2Fubm90IHVzZSB0aGUgZmFzdCB0b2tlbml6ZXIgKyBkZWx0YSBpbmNyZW1lbnRzXG5cdFx0XHR0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zID0gdGhpcy5wYXJzZURvY3VtZW50RnJvbVRleHRCdWZmZXIoW10sIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHR0aGlzLmFzdFdpdGhUb2tlbnMgPSB0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zO1xuXHRcdH1cblx0fVxuXG5cdC8vI3JlZ2lvbiBUZXh0TW9kZWwgZXZlbnRzXG5cblx0cHVibGljIGhhbmRsZURpZENoYW5nZUJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy50ZXh0TW9kZWwudG9rZW5pemF0aW9uLmJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZSA9PT0gQmFja2dyb3VuZFRva2VuaXphdGlvblN0YXRlLkNvbXBsZXRlZCkge1xuXHRcdFx0Y29uc3Qgd2FzVW5kZWZpbmVkID0gdGhpcy5pbml0aWFsQXN0V2l0aG91dFRva2VucyA9PT0gdW5kZWZpbmVkO1xuXHRcdFx0Ly8gQ2xlYXIgdGhlIGluaXRpYWwgdHJlZSBhcyB3ZSBjYW4gdXNlIHRoZSB0cmVlIHdpdGggdG9rZW4gaW5mb3JtYXRpb24gbm93LlxuXHRcdFx0dGhpcy5pbml0aWFsQXN0V2l0aG91dFRva2VucyA9IHVuZGVmaW5lZDtcblx0XHRcdGlmICghd2FzVW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMuZGlkQ2hhbmdlRW1pdHRlci5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGhhbmRsZURpZENoYW5nZVRva2Vucyh7IHJhbmdlcyB9OiBJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0cyA9IHJhbmdlcy5tYXAociA9PlxuXHRcdFx0bmV3IFRleHRFZGl0SW5mbyhcblx0XHRcdFx0dG9MZW5ndGgoci5mcm9tTGluZU51bWJlciAtIDEsIDApLFxuXHRcdFx0XHR0b0xlbmd0aChyLnRvTGluZU51bWJlciwgMCksXG5cdFx0XHRcdHRvTGVuZ3RoKHIudG9MaW5lTnVtYmVyIC0gci5mcm9tTGluZU51bWJlciArIDEsIDApXG5cdFx0XHQpXG5cdFx0KTtcblxuXHRcdHRoaXMuaGFuZGxlRWRpdHMoZWRpdHMsIHRydWUpO1xuXG5cdFx0aWYgKCF0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zKSB7XG5cdFx0XHR0aGlzLmRpZENoYW5nZUVtaXR0ZXIuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBoYW5kbGVDb250ZW50Q2hhbmdlZChjaGFuZ2U6IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQpIHtcblx0XHRjb25zdCBlZGl0cyA9IFRleHRFZGl0SW5mby5mcm9tTW9kZWxDb250ZW50Q2hhbmdlcyhjaGFuZ2UuY2hhbmdlcyk7XG5cdFx0dGhpcy5oYW5kbGVFZGl0cyhlZGl0cywgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVFZGl0cyhlZGl0czogVGV4dEVkaXRJbmZvW10sIHRva2VuQ2hhbmdlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Ly8gTGF6aWx5IHF1ZXVlIHRoZSBlZGl0cyBhbmQgb25seSBhcHBseSB0aGVtIHdoZW4gdGhlIHRyZWUgaXMgYWNjZXNzZWQuXG5cdFx0Y29uc3QgcmVzdWx0ID0gY29tYmluZVRleHRFZGl0SW5mb3ModGhpcy5xdWV1ZWRUZXh0RWRpdHMsIGVkaXRzKTtcblxuXHRcdHRoaXMucXVldWVkVGV4dEVkaXRzID0gcmVzdWx0O1xuXHRcdGlmICh0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zICYmICF0b2tlbkNoYW5nZSkge1xuXHRcdFx0dGhpcy5xdWV1ZWRUZXh0RWRpdHNGb3JJbml0aWFsQXN0V2l0aG91dFRva2VucyA9IGNvbWJpbmVUZXh0RWRpdEluZm9zKHRoaXMucXVldWVkVGV4dEVkaXRzRm9ySW5pdGlhbEFzdFdpdGhvdXRUb2tlbnMsIGVkaXRzKTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIGZsdXNoUXVldWUoKSB7XG5cdFx0aWYgKHRoaXMucXVldWVkVGV4dEVkaXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuYXN0V2l0aFRva2VucyA9IHRoaXMucGFyc2VEb2N1bWVudEZyb21UZXh0QnVmZmVyKHRoaXMucXVldWVkVGV4dEVkaXRzLCB0aGlzLmFzdFdpdGhUb2tlbnMsIGZhbHNlKTtcblx0XHRcdHRoaXMucXVldWVkVGV4dEVkaXRzID0gW107XG5cdFx0fVxuXHRcdGlmICh0aGlzLnF1ZXVlZFRleHRFZGl0c0ZvckluaXRpYWxBc3RXaXRob3V0VG9rZW5zLmxlbmd0aCA+IDApIHtcblx0XHRcdGlmICh0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zKSB7XG5cdFx0XHRcdHRoaXMuaW5pdGlhbEFzdFdpdGhvdXRUb2tlbnMgPSB0aGlzLnBhcnNlRG9jdW1lbnRGcm9tVGV4dEJ1ZmZlcih0aGlzLnF1ZXVlZFRleHRFZGl0c0ZvckluaXRpYWxBc3RXaXRob3V0VG9rZW5zLCB0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnF1ZXVlZFRleHRFZGl0c0ZvckluaXRpYWxBc3RXaXRob3V0VG9rZW5zID0gW107XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwdXJlIChvbmx5IGlmIGlzUHVyZSA9IHRydWUpXG5cdCovXG5cdHByaXZhdGUgcGFyc2VEb2N1bWVudEZyb21UZXh0QnVmZmVyKGVkaXRzOiBUZXh0RWRpdEluZm9bXSwgcHJldmlvdXNBc3Q6IEFzdE5vZGUgfCB1bmRlZmluZWQsIGltbXV0YWJsZTogYm9vbGVhbik6IEFzdE5vZGUge1xuXHRcdC8vIElzIG11Y2ggZmFzdGVyIGlmIGBpc1B1cmUgPSBmYWxzZWAuXG5cdFx0Y29uc3QgaXNQdXJlID0gZmFsc2U7XG5cdFx0Y29uc3QgcHJldmlvdXNBc3RDbG9uZSA9IGlzUHVyZSA/IHByZXZpb3VzQXN0Py5kZWVwQ2xvbmUoKSA6IHByZXZpb3VzQXN0O1xuXHRcdGNvbnN0IHRva2VuaXplciA9IG5ldyBUZXh0QnVmZmVyVG9rZW5pemVyKHRoaXMudGV4dE1vZGVsLCB0aGlzLmJyYWNrZXRzKTtcblx0XHRjb25zdCByZXN1bHQgPSBwYXJzZURvY3VtZW50KHRva2VuaXplciwgZWRpdHMsIHByZXZpb3VzQXN0Q2xvbmUsIGltbXV0YWJsZSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBnZXRCcmFja2V0c0luUmFuZ2UocmFuZ2U6IFJhbmdlLCBvbmx5Q29sb3JpemVkQnJhY2tldHM6IGJvb2xlYW4pOiBDYWxsYmFja0l0ZXJhYmxlPEJyYWNrZXRJbmZvPiB7XG5cdFx0dGhpcy5mbHVzaFF1ZXVlKCk7XG5cblx0XHRjb25zdCBzdGFydE9mZnNldCA9IHRvTGVuZ3RoKHJhbmdlLnN0YXJ0TGluZU51bWJlciAtIDEsIHJhbmdlLnN0YXJ0Q29sdW1uIC0gMSk7XG5cdFx0Y29uc3QgZW5kT2Zmc2V0ID0gdG9MZW5ndGgocmFuZ2UuZW5kTGluZU51bWJlciAtIDEsIHJhbmdlLmVuZENvbHVtbiAtIDEpO1xuXHRcdHJldHVybiBuZXcgQ2FsbGJhY2tJdGVyYWJsZShjYiA9PiB7XG5cdFx0XHRjb25zdCBub2RlID0gdGhpcy5pbml0aWFsQXN0V2l0aG91dFRva2VucyB8fCB0aGlzLmFzdFdpdGhUb2tlbnMhO1xuXHRcdFx0Y29sbGVjdEJyYWNrZXRzKG5vZGUsIGxlbmd0aFplcm8sIG5vZGUubGVuZ3RoLCBzdGFydE9mZnNldCwgZW5kT2Zmc2V0LCBjYiwgMCwgMCwgbmV3IE1hcCgpLCBvbmx5Q29sb3JpemVkQnJhY2tldHMpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldEJyYWNrZXRQYWlyc0luUmFuZ2UocmFuZ2U6IFJhbmdlLCBpbmNsdWRlTWluSW5kZW50YXRpb246IGJvb2xlYW4pOiBDYWxsYmFja0l0ZXJhYmxlPEJyYWNrZXRQYWlyV2l0aE1pbkluZGVudGF0aW9uSW5mbz4ge1xuXHRcdHRoaXMuZmx1c2hRdWV1ZSgpO1xuXG5cdFx0Y29uc3Qgc3RhcnRMZW5ndGggPSBwb3NpdGlvblRvTGVuZ3RoKHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0Y29uc3QgZW5kTGVuZ3RoID0gcG9zaXRpb25Ub0xlbmd0aChyYW5nZS5nZXRFbmRQb3NpdGlvbigpKTtcblxuXHRcdHJldHVybiBuZXcgQ2FsbGJhY2tJdGVyYWJsZShjYiA9PiB7XG5cdFx0XHRjb25zdCBub2RlID0gdGhpcy5pbml0aWFsQXN0V2l0aG91dFRva2VucyB8fCB0aGlzLmFzdFdpdGhUb2tlbnMhO1xuXHRcdFx0Y29uc3QgY29udGV4dCA9IG5ldyBDb2xsZWN0QnJhY2tldFBhaXJzQ29udGV4dChjYiwgaW5jbHVkZU1pbkluZGVudGF0aW9uLCB0aGlzLnRleHRNb2RlbCk7XG5cdFx0XHRjb2xsZWN0QnJhY2tldFBhaXJzKG5vZGUsIGxlbmd0aFplcm8sIG5vZGUubGVuZ3RoLCBzdGFydExlbmd0aCwgZW5kTGVuZ3RoLCBjb250ZXh0LCAwLCBuZXcgTWFwKCkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldEZpcnN0QnJhY2tldEFmdGVyKHBvc2l0aW9uOiBQb3NpdGlvbik6IElGb3VuZEJyYWNrZXQgfCBudWxsIHtcblx0XHR0aGlzLmZsdXNoUXVldWUoKTtcblxuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zIHx8IHRoaXMuYXN0V2l0aFRva2VucyE7XG5cdFx0cmV0dXJuIGdldEZpcnN0QnJhY2tldEFmdGVyKG5vZGUsIGxlbmd0aFplcm8sIG5vZGUubGVuZ3RoLCBwb3NpdGlvblRvTGVuZ3RoKHBvc2l0aW9uKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Rmlyc3RCcmFja2V0QmVmb3JlKHBvc2l0aW9uOiBQb3NpdGlvbik6IElGb3VuZEJyYWNrZXQgfCBudWxsIHtcblx0XHR0aGlzLmZsdXNoUXVldWUoKTtcblxuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLmluaXRpYWxBc3RXaXRob3V0VG9rZW5zIHx8IHRoaXMuYXN0V2l0aFRva2VucyE7XG5cdFx0cmV0dXJuIGdldEZpcnN0QnJhY2tldEJlZm9yZShub2RlLCBsZW5ndGhaZXJvLCBub2RlLmxlbmd0aCwgcG9zaXRpb25Ub0xlbmd0aChwb3NpdGlvbikpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldEZpcnN0QnJhY2tldEJlZm9yZShub2RlOiBBc3ROb2RlLCBub2RlT2Zmc2V0U3RhcnQ6IExlbmd0aCwgbm9kZU9mZnNldEVuZDogTGVuZ3RoLCBwb3NpdGlvbjogTGVuZ3RoKTogSUZvdW5kQnJhY2tldCB8IG51bGwge1xuXHRpZiAobm9kZS5raW5kID09PSBBc3ROb2RlS2luZC5MaXN0IHx8IG5vZGUua2luZCA9PT0gQXN0Tm9kZUtpbmQuUGFpcikge1xuXHRcdGNvbnN0IGxlbmd0aHM6IHsgbm9kZU9mZnNldFN0YXJ0OiBMZW5ndGg7IG5vZGVPZmZzZXRFbmQ6IExlbmd0aCB9W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdG5vZGVPZmZzZXRFbmQgPSBsZW5ndGhBZGQobm9kZU9mZnNldFN0YXJ0LCBjaGlsZC5sZW5ndGgpO1xuXHRcdFx0bGVuZ3Rocy5wdXNoKHsgbm9kZU9mZnNldFN0YXJ0LCBub2RlT2Zmc2V0RW5kIH0pO1xuXHRcdFx0bm9kZU9mZnNldFN0YXJ0ID0gbm9kZU9mZnNldEVuZDtcblx0XHR9XG5cdFx0Zm9yIChsZXQgaSA9IGxlbmd0aHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IHsgbm9kZU9mZnNldFN0YXJ0LCBub2RlT2Zmc2V0RW5kIH0gPSBsZW5ndGhzW2ldO1xuXHRcdFx0aWYgKGxlbmd0aExlc3NUaGFuKG5vZGVPZmZzZXRTdGFydCwgcG9zaXRpb24pKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGdldEZpcnN0QnJhY2tldEJlZm9yZShub2RlLmNoaWxkcmVuW2ldLCBub2RlT2Zmc2V0U3RhcnQsIG5vZGVPZmZzZXRFbmQsIHBvc2l0aW9uKTtcblx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0gZWxzZSBpZiAobm9kZS5raW5kID09PSBBc3ROb2RlS2luZC5VbmV4cGVjdGVkQ2xvc2luZ0JyYWNrZXQpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fSBlbHNlIGlmIChub2RlLmtpbmQgPT09IEFzdE5vZGVLaW5kLkJyYWNrZXQpIHtcblx0XHRjb25zdCByYW5nZSA9IGxlbmd0aHNUb1JhbmdlKG5vZGVPZmZzZXRTdGFydCwgbm9kZU9mZnNldEVuZCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGJyYWNrZXRJbmZvOiBub2RlLmJyYWNrZXRJbmZvLFxuXHRcdFx0cmFuZ2Vcblx0XHR9O1xuXHR9XG5cdHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRGaXJzdEJyYWNrZXRBZnRlcihub2RlOiBBc3ROb2RlLCBub2RlT2Zmc2V0U3RhcnQ6IExlbmd0aCwgbm9kZU9mZnNldEVuZDogTGVuZ3RoLCBwb3NpdGlvbjogTGVuZ3RoKTogSUZvdW5kQnJhY2tldCB8IG51bGwge1xuXHRpZiAobm9kZS5raW5kID09PSBBc3ROb2RlS2luZC5MaXN0IHx8IG5vZGUua2luZCA9PT0gQXN0Tm9kZUtpbmQuUGFpcikge1xuXHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuXHRcdFx0bm9kZU9mZnNldEVuZCA9IGxlbmd0aEFkZChub2RlT2Zmc2V0U3RhcnQsIGNoaWxkLmxlbmd0aCk7XG5cdFx0XHRpZiAobGVuZ3RoTGVzc1RoYW4ocG9zaXRpb24sIG5vZGVPZmZzZXRFbmQpKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGdldEZpcnN0QnJhY2tldEFmdGVyKGNoaWxkLCBub2RlT2Zmc2V0U3RhcnQsIG5vZGVPZmZzZXRFbmQsIHBvc2l0aW9uKTtcblx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG5vZGVPZmZzZXRTdGFydCA9IG5vZGVPZmZzZXRFbmQ7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9IGVsc2UgaWYgKG5vZGUua2luZCA9PT0gQXN0Tm9kZUtpbmQuVW5leHBlY3RlZENsb3NpbmdCcmFja2V0KSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0gZWxzZSBpZiAobm9kZS5raW5kID09PSBBc3ROb2RlS2luZC5CcmFja2V0KSB7XG5cdFx0Y29uc3QgcmFuZ2UgPSBsZW5ndGhzVG9SYW5nZShub2RlT2Zmc2V0U3RhcnQsIG5vZGVPZmZzZXRFbmQpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRicmFja2V0SW5mbzogbm9kZS5icmFja2V0SW5mbyxcblx0XHRcdHJhbmdlXG5cdFx0fTtcblx0fVxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY29sbGVjdEJyYWNrZXRzKFxuXHRub2RlOiBBc3ROb2RlLFxuXHRub2RlT2Zmc2V0U3RhcnQ6IExlbmd0aCxcblx0bm9kZU9mZnNldEVuZDogTGVuZ3RoLFxuXHRzdGFydE9mZnNldDogTGVuZ3RoLFxuXHRlbmRPZmZzZXQ6IExlbmd0aCxcblx0cHVzaDogKGl0ZW06IEJyYWNrZXRJbmZvKSA9PiBib29sZWFuLFxuXHRsZXZlbDogbnVtYmVyLFxuXHRuZXN0aW5nTGV2ZWxPZkVxdWFsQnJhY2tldFR5cGU6IG51bWJlcixcblx0bGV2ZWxQZXJCcmFja2V0VHlwZTogTWFwPHN0cmluZywgbnVtYmVyPixcblx0b25seUNvbG9yaXplZEJyYWNrZXRzOiBib29sZWFuLFxuXHRwYXJlbnRQYWlySXNJbmNvbXBsZXRlOiBib29sZWFuID0gZmFsc2UsXG4pOiBib29sZWFuIHtcblx0aWYgKGxldmVsID4gMjAwKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHR3aGlsZUxvb3A6XG5cdHdoaWxlICh0cnVlKSB7XG5cdFx0c3dpdGNoIChub2RlLmtpbmQpIHtcblx0XHRcdGNhc2UgQXN0Tm9kZUtpbmQuTGlzdDoge1xuXHRcdFx0XHRjb25zdCBjaGlsZENvdW50ID0gbm9kZS5jaGlsZHJlbkxlbmd0aDtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZENvdW50OyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBjaGlsZCA9IG5vZGUuZ2V0Q2hpbGQoaSk7XG5cdFx0XHRcdFx0aWYgKCFjaGlsZCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5vZGVPZmZzZXRFbmQgPSBsZW5ndGhBZGQobm9kZU9mZnNldFN0YXJ0LCBjaGlsZC5sZW5ndGgpO1xuXHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdGxlbmd0aExlc3NUaGFuRXF1YWwobm9kZU9mZnNldFN0YXJ0LCBlbmRPZmZzZXQpICYmXG5cdFx0XHRcdFx0XHRsZW5ndGhHcmVhdGVyVGhhbkVxdWFsKG5vZGVPZmZzZXRFbmQsIHN0YXJ0T2Zmc2V0KVxuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY2hpbGRFbmRzQWZ0ZXJFbmQgPSBsZW5ndGhHcmVhdGVyVGhhbkVxdWFsKG5vZGVPZmZzZXRFbmQsIGVuZE9mZnNldCk7XG5cdFx0XHRcdFx0XHRpZiAoY2hpbGRFbmRzQWZ0ZXJFbmQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gTm8gY2hpbGQgYWZ0ZXIgdGhpcyBjaGlsZCBpbiB0aGUgcmVxdWVzdGVkIHdpbmRvdywgZG9uJ3QgcmVjdXJzZVxuXHRcdFx0XHRcdFx0XHRub2RlID0gY2hpbGQ7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlIHdoaWxlTG9vcDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3Qgc2hvdWxkQ29udGludWUgPSBjb2xsZWN0QnJhY2tldHMoY2hpbGQsIG5vZGVPZmZzZXRTdGFydCwgbm9kZU9mZnNldEVuZCwgc3RhcnRPZmZzZXQsIGVuZE9mZnNldCwgcHVzaCwgbGV2ZWwsIDAsIGxldmVsUGVyQnJhY2tldFR5cGUsIG9ubHlDb2xvcml6ZWRCcmFja2V0cyk7XG5cdFx0XHRcdFx0XHRpZiAoIXNob3VsZENvbnRpbnVlKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bm9kZU9mZnNldFN0YXJ0ID0gbm9kZU9mZnNldEVuZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGNhc2UgQXN0Tm9kZUtpbmQuUGFpcjoge1xuXHRcdFx0XHRjb25zdCBjb2xvcml6ZSA9ICFvbmx5Q29sb3JpemVkQnJhY2tldHMgfHwgIW5vZGUuY2xvc2luZ0JyYWNrZXQgfHwgKG5vZGUuY2xvc2luZ0JyYWNrZXQuYnJhY2tldEluZm8gYXMgQ2xvc2luZ0JyYWNrZXRLaW5kKS5jbG9zZXNDb2xvcml6ZWQobm9kZS5vcGVuaW5nQnJhY2tldC5icmFja2V0SW5mbyBhcyBPcGVuaW5nQnJhY2tldEtpbmQpO1xuXG5cdFx0XHRcdGxldCBsZXZlbFBlckJyYWNrZXQgPSAwO1xuXHRcdFx0XHRpZiAobGV2ZWxQZXJCcmFja2V0VHlwZSkge1xuXHRcdFx0XHRcdGxldCBleGlzdGluZyA9IGxldmVsUGVyQnJhY2tldFR5cGUuZ2V0KG5vZGUub3BlbmluZ0JyYWNrZXQudGV4dCk7XG5cdFx0XHRcdFx0aWYgKGV4aXN0aW5nID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGV4aXN0aW5nID0gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGV2ZWxQZXJCcmFja2V0ID0gZXhpc3Rpbmc7XG5cdFx0XHRcdFx0aWYgKGNvbG9yaXplKSB7XG5cdFx0XHRcdFx0XHRleGlzdGluZysrO1xuXHRcdFx0XHRcdFx0bGV2ZWxQZXJCcmFja2V0VHlwZS5zZXQobm9kZS5vcGVuaW5nQnJhY2tldC50ZXh0LCBleGlzdGluZyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY2hpbGRDb3VudCA9IG5vZGUuY2hpbGRyZW5MZW5ndGg7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRDb3VudDsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hpbGQgPSBub2RlLmdldENoaWxkKGkpO1xuXHRcdFx0XHRcdGlmICghY2hpbGQpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRub2RlT2Zmc2V0RW5kID0gbGVuZ3RoQWRkKG5vZGVPZmZzZXRTdGFydCwgY2hpbGQubGVuZ3RoKTtcblx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRsZW5ndGhMZXNzVGhhbkVxdWFsKG5vZGVPZmZzZXRTdGFydCwgZW5kT2Zmc2V0KSAmJlxuXHRcdFx0XHRcdFx0bGVuZ3RoR3JlYXRlclRoYW5FcXVhbChub2RlT2Zmc2V0RW5kLCBzdGFydE9mZnNldClcblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNoaWxkRW5kc0FmdGVyRW5kID0gbGVuZ3RoR3JlYXRlclRoYW5FcXVhbChub2RlT2Zmc2V0RW5kLCBlbmRPZmZzZXQpO1xuXHRcdFx0XHRcdFx0aWYgKGNoaWxkRW5kc0FmdGVyRW5kICYmIGNoaWxkLmtpbmQgIT09IEFzdE5vZGVLaW5kLkJyYWNrZXQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gTm8gY2hpbGQgYWZ0ZXIgdGhpcyBjaGlsZCBpbiB0aGUgcmVxdWVzdGVkIHdpbmRvdywgZG9uJ3QgcmVjdXJzZVxuXHRcdFx0XHRcdFx0XHQvLyBEb24ndCBkbyB0aGlzIGZvciBicmFja2V0cyBiZWNhdXNlIG9mIHVuY2xvc2VkL3Vub3BlbmVkIGJyYWNrZXRzXG5cdFx0XHRcdFx0XHRcdG5vZGUgPSBjaGlsZDtcblx0XHRcdFx0XHRcdFx0aWYgKGNvbG9yaXplKSB7XG5cdFx0XHRcdFx0XHRcdFx0bGV2ZWwrKztcblx0XHRcdFx0XHRcdFx0XHRuZXN0aW5nTGV2ZWxPZkVxdWFsQnJhY2tldFR5cGUgPSBsZXZlbFBlckJyYWNrZXQgKyAxO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdG5lc3RpbmdMZXZlbE9mRXF1YWxCcmFja2V0VHlwZSA9IGxldmVsUGVyQnJhY2tldDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRjb250aW51ZSB3aGlsZUxvb3A7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmIChjb2xvcml6ZSB8fCBjaGlsZC5raW5kICE9PSBBc3ROb2RlS2luZC5CcmFja2V0IHx8ICFub2RlLmNsb3NpbmdCcmFja2V0KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHNob3VsZENvbnRpbnVlID0gY29sbGVjdEJyYWNrZXRzKFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkLFxuXHRcdFx0XHRcdFx0XHRcdG5vZGVPZmZzZXRTdGFydCxcblx0XHRcdFx0XHRcdFx0XHRub2RlT2Zmc2V0RW5kLFxuXHRcdFx0XHRcdFx0XHRcdHN0YXJ0T2Zmc2V0LFxuXHRcdFx0XHRcdFx0XHRcdGVuZE9mZnNldCxcblx0XHRcdFx0XHRcdFx0XHRwdXNoLFxuXHRcdFx0XHRcdFx0XHRcdGNvbG9yaXplID8gbGV2ZWwgKyAxIDogbGV2ZWwsXG5cdFx0XHRcdFx0XHRcdFx0Y29sb3JpemUgPyBsZXZlbFBlckJyYWNrZXQgKyAxIDogbGV2ZWxQZXJCcmFja2V0LFxuXHRcdFx0XHRcdFx0XHRcdGxldmVsUGVyQnJhY2tldFR5cGUsXG5cdFx0XHRcdFx0XHRcdFx0b25seUNvbG9yaXplZEJyYWNrZXRzLFxuXHRcdFx0XHRcdFx0XHRcdCFub2RlLmNsb3NpbmdCcmFja2V0LFxuXHRcdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIXNob3VsZENvbnRpbnVlKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5vZGVPZmZzZXRTdGFydCA9IG5vZGVPZmZzZXRFbmQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXZlbFBlckJyYWNrZXRUeXBlPy5zZXQobm9kZS5vcGVuaW5nQnJhY2tldC50ZXh0LCBsZXZlbFBlckJyYWNrZXQpO1xuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBBc3ROb2RlS2luZC5VbmV4cGVjdGVkQ2xvc2luZ0JyYWNrZXQ6IHtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSBsZW5ndGhzVG9SYW5nZShub2RlT2Zmc2V0U3RhcnQsIG5vZGVPZmZzZXRFbmQpO1xuXHRcdFx0XHRyZXR1cm4gcHVzaChuZXcgQnJhY2tldEluZm8ocmFuZ2UsIGxldmVsIC0gMSwgMCwgdHJ1ZSkpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBBc3ROb2RlS2luZC5CcmFja2V0OiB7XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gbGVuZ3Roc1RvUmFuZ2Uobm9kZU9mZnNldFN0YXJ0LCBub2RlT2Zmc2V0RW5kKTtcblx0XHRcdFx0cmV0dXJuIHB1c2gobmV3IEJyYWNrZXRJbmZvKHJhbmdlLCBsZXZlbCAtIDEsIG5lc3RpbmdMZXZlbE9mRXF1YWxCcmFja2V0VHlwZSAtIDEsIHBhcmVudFBhaXJJc0luY29tcGxldGUpKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgQXN0Tm9kZUtpbmQuVGV4dDpcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIENvbGxlY3RCcmFja2V0UGFpcnNDb250ZXh0IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHB1c2g6IChpdGVtOiBCcmFja2V0UGFpcldpdGhNaW5JbmRlbnRhdGlvbkluZm8pID0+IGJvb2xlYW4sXG5cdFx0cHVibGljIHJlYWRvbmx5IGluY2x1ZGVNaW5JbmRlbnRhdGlvbjogYm9vbGVhbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgdGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHQpIHtcblx0fVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0QnJhY2tldFBhaXJzKFxuXHRub2RlOiBBc3ROb2RlLFxuXHRub2RlT2Zmc2V0U3RhcnQ6IExlbmd0aCxcblx0bm9kZU9mZnNldEVuZDogTGVuZ3RoLFxuXHRzdGFydE9mZnNldDogTGVuZ3RoLFxuXHRlbmRPZmZzZXQ6IExlbmd0aCxcblx0Y29udGV4dDogQ29sbGVjdEJyYWNrZXRQYWlyc0NvbnRleHQsXG5cdGxldmVsOiBudW1iZXIsXG5cdGxldmVsUGVyQnJhY2tldFR5cGU6IE1hcDxzdHJpbmcsIG51bWJlcj5cbik6IGJvb2xlYW4ge1xuXHRpZiAobGV2ZWwgPiAyMDApIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGxldCBzaG91bGRDb250aW51ZSA9IHRydWU7XG5cblx0aWYgKG5vZGUua2luZCA9PT0gQXN0Tm9kZUtpbmQuUGFpcikge1xuXHRcdGxldCBsZXZlbFBlckJyYWNrZXQgPSAwO1xuXHRcdGlmIChsZXZlbFBlckJyYWNrZXRUeXBlKSB7XG5cdFx0XHRsZXQgZXhpc3RpbmcgPSBsZXZlbFBlckJyYWNrZXRUeXBlLmdldChub2RlLm9wZW5pbmdCcmFja2V0LnRleHQpO1xuXHRcdFx0aWYgKGV4aXN0aW5nID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0ZXhpc3RpbmcgPSAwO1xuXHRcdFx0fVxuXHRcdFx0bGV2ZWxQZXJCcmFja2V0ID0gZXhpc3Rpbmc7XG5cdFx0XHRleGlzdGluZysrO1xuXHRcdFx0bGV2ZWxQZXJCcmFja2V0VHlwZS5zZXQobm9kZS5vcGVuaW5nQnJhY2tldC50ZXh0LCBleGlzdGluZyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3BlbmluZ0JyYWNrZXRFbmQgPSBsZW5ndGhBZGQobm9kZU9mZnNldFN0YXJ0LCBub2RlLm9wZW5pbmdCcmFja2V0Lmxlbmd0aCk7XG5cdFx0bGV0IG1pbkluZGVudGF0aW9uID0gLTE7XG5cdFx0aWYgKGNvbnRleHQuaW5jbHVkZU1pbkluZGVudGF0aW9uKSB7XG5cdFx0XHRtaW5JbmRlbnRhdGlvbiA9IG5vZGUuY29tcHV0ZU1pbkluZGVudGF0aW9uKFxuXHRcdFx0XHRub2RlT2Zmc2V0U3RhcnQsXG5cdFx0XHRcdGNvbnRleHQudGV4dE1vZGVsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHNob3VsZENvbnRpbnVlID0gY29udGV4dC5wdXNoKFxuXHRcdFx0bmV3IEJyYWNrZXRQYWlyV2l0aE1pbkluZGVudGF0aW9uSW5mbyhcblx0XHRcdFx0bGVuZ3Roc1RvUmFuZ2Uobm9kZU9mZnNldFN0YXJ0LCBub2RlT2Zmc2V0RW5kKSxcblx0XHRcdFx0bGVuZ3Roc1RvUmFuZ2Uobm9kZU9mZnNldFN0YXJ0LCBvcGVuaW5nQnJhY2tldEVuZCksXG5cdFx0XHRcdG5vZGUuY2xvc2luZ0JyYWNrZXRcblx0XHRcdFx0XHQ/IGxlbmd0aHNUb1JhbmdlKFxuXHRcdFx0XHRcdFx0bGVuZ3RoQWRkKG9wZW5pbmdCcmFja2V0RW5kLCBub2RlLmNoaWxkPy5sZW5ndGggfHwgbGVuZ3RoWmVybyksXG5cdFx0XHRcdFx0XHRub2RlT2Zmc2V0RW5kXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdFx0XHRsZXZlbCxcblx0XHRcdFx0bGV2ZWxQZXJCcmFja2V0LFxuXHRcdFx0XHRub2RlLFxuXHRcdFx0XHRtaW5JbmRlbnRhdGlvblxuXHRcdFx0KVxuXHRcdCk7XG5cblx0XHRub2RlT2Zmc2V0U3RhcnQgPSBvcGVuaW5nQnJhY2tldEVuZDtcblx0XHRpZiAoc2hvdWxkQ29udGludWUgJiYgbm9kZS5jaGlsZCkge1xuXHRcdFx0Y29uc3QgY2hpbGQgPSBub2RlLmNoaWxkO1xuXHRcdFx0bm9kZU9mZnNldEVuZCA9IGxlbmd0aEFkZChub2RlT2Zmc2V0U3RhcnQsIGNoaWxkLmxlbmd0aCk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGxlbmd0aExlc3NUaGFuRXF1YWwobm9kZU9mZnNldFN0YXJ0LCBlbmRPZmZzZXQpICYmXG5cdFx0XHRcdGxlbmd0aEdyZWF0ZXJUaGFuRXF1YWwobm9kZU9mZnNldEVuZCwgc3RhcnRPZmZzZXQpXG5cdFx0XHQpIHtcblx0XHRcdFx0c2hvdWxkQ29udGludWUgPSBjb2xsZWN0QnJhY2tldFBhaXJzKFxuXHRcdFx0XHRcdGNoaWxkLFxuXHRcdFx0XHRcdG5vZGVPZmZzZXRTdGFydCxcblx0XHRcdFx0XHRub2RlT2Zmc2V0RW5kLFxuXHRcdFx0XHRcdHN0YXJ0T2Zmc2V0LFxuXHRcdFx0XHRcdGVuZE9mZnNldCxcblx0XHRcdFx0XHRjb250ZXh0LFxuXHRcdFx0XHRcdGxldmVsICsgMSxcblx0XHRcdFx0XHRsZXZlbFBlckJyYWNrZXRUeXBlXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmICghc2hvdWxkQ29udGludWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXZlbFBlckJyYWNrZXRUeXBlPy5zZXQobm9kZS5vcGVuaW5nQnJhY2tldC50ZXh0LCBsZXZlbFBlckJyYWNrZXQpO1xuXHR9IGVsc2Uge1xuXHRcdGxldCBjdXJPZmZzZXQgPSBub2RlT2Zmc2V0U3RhcnQ7XG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRjb25zdCBjaGlsZE9mZnNldCA9IGN1ck9mZnNldDtcblx0XHRcdGN1ck9mZnNldCA9IGxlbmd0aEFkZChjdXJPZmZzZXQsIGNoaWxkLmxlbmd0aCk7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0bGVuZ3RoTGVzc1RoYW5FcXVhbChjaGlsZE9mZnNldCwgZW5kT2Zmc2V0KSAmJlxuXHRcdFx0XHRsZW5ndGhMZXNzVGhhbkVxdWFsKHN0YXJ0T2Zmc2V0LCBjdXJPZmZzZXQpXG5cdFx0XHQpIHtcblx0XHRcdFx0c2hvdWxkQ29udGludWUgPSBjb2xsZWN0QnJhY2tldFBhaXJzKFxuXHRcdFx0XHRcdGNoaWxkLFxuXHRcdFx0XHRcdGNoaWxkT2Zmc2V0LFxuXHRcdFx0XHRcdGN1ck9mZnNldCxcblx0XHRcdFx0XHRzdGFydE9mZnNldCxcblx0XHRcdFx0XHRlbmRPZmZzZXQsXG5cdFx0XHRcdFx0Y29udGV4dCxcblx0XHRcdFx0XHRsZXZlbCxcblx0XHRcdFx0XHRsZXZlbFBlckJyYWNrZXRUeXBlXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmICghc2hvdWxkQ29udGludWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIHNob3VsZENvbnRpbnVlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBRzNCLFNBQVMsYUFBYSx5Q0FBd0Q7QUFJOUUsU0FBa0IsbUJBQW1CO0FBQ3JDLFNBQVMsb0JB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
