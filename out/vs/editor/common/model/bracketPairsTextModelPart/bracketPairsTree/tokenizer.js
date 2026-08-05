import { NotSupportedError } from "../../../../../base/common/errors.js";
import { StandardTokenType, TokenMetadata } from "../../../encodedTokenAttributes.js";
import { TextAstNode } from "./ast.js";
import { lengthAdd, lengthDiff, lengthGetColumnCountIfZeroLineCount, lengthToObj, lengthZero, toLength } from "./length.js";
import { SmallImmutableSet } from "./smallImmutableSet.js";
var TokenKind = /* @__PURE__ */ ((TokenKind2) => {
  TokenKind2[TokenKind2["Text"] = 0] = "Text";
  TokenKind2[TokenKind2["OpeningBracket"] = 1] = "OpeningBracket";
  TokenKind2[TokenKind2["ClosingBracket"] = 2] = "ClosingBracket";
  return TokenKind2;
})(TokenKind || {});
class Token {
  constructor(length, kind, bracketId, bracketIds, astNode) {
    this.length = length;
    this.kind = kind;
    this.bracketId = bracketId;
    this.bracketIds = bracketIds;
    this.astNode = astNode;
  }
}
class TextBufferTokenizer {
  constructor(textModel, bracketTokens) {
    this.textModel = textModel;
    this.bracketTokens = bracketTokens;
    this.reader = new NonPeekableTextBufferTokenizer(this.textModel, this.bracketTokens);
    this._offset = lengthZero;
    this.didPeek = false;
    this.peeked = null;
    this.textBufferLineCount = textModel.getLineCount();
    this.textBufferLastLineLength = textModel.getLineLength(this.textBufferLineCount);
  }
  get offset() {
    return this._offset;
  }
  get length() {
    return toLength(this.textBufferLineCount - 1, this.textBufferLastLineLength);
  }
  getText() {
    return this.textModel.getValue();
  }
  skip(length) {
    this.didPeek = false;
    this._offset = lengthAdd(this._offset, length);
    const obj = lengthToObj(this._offset);
    this.reader.setPosition(obj.lineCount, obj.columnCount);
  }
  read() {
    let token;
    if (this.peeked) {
      this.didPeek = false;
      token = this.peeked;
    } else {
      token = this.reader.read();
    }
    if (token) {
      this._offset = lengthAdd(this._offset, token.length);
    }
    return token;
  }
  peek() {
    if (!this.didPeek) {
      this.peeked = this.reader.read();
      this.didPeek = true;
    }
    return this.peeked;
  }
}
class NonPeekableTextBufferTokenizer {
  constructor(textModel, bracketTokens) {
    this.textModel = textModel;
    this.bracketTokens = bracketTokens;
    this.lineIdx = 0;
    this.line = null;
    this.lineCharOffset = 0;
    this.lineTokens = null;
    this.lineTokenOffset = 0;
    /** Must be a zero line token. The end of the document cannot be peeked. */
    this.peekedToken = null;
    this.textBufferLineCount = textModel.getLineCount();
    this.textBufferLastLineLength = textModel.getLineLength(this.textBufferLineCount);
  }
  setPosition(lineIdx, column) {
    if (lineIdx === this.lineIdx) {
      this.lineCharOffset = column;
      if (this.line !== null) {
        this.lineTokenOffset = this.lineCharOffset === 0 ? 0 : this.lineTokens.findTokenIndexAtOffset(this.lineCharOffset);
      }
    } else {
      this.lineIdx = lineIdx;
      this.lineCharOffset = column;
      this.line = null;
    }
    this.peekedToken = null;
  }
  read() {
    if (this.peekedToken) {
      const token = this.peekedToken;
      this.peekedToken = null;
      this.lineCharOffset += lengthGetColumnCountIfZeroLineCount(token.length);
      return token;
    }
    if (this.lineIdx > this.textBufferLineCount - 1 || this.lineIdx === this.textBufferLineCount - 1 && this.lineCharOffset >= this.textBufferLastLineLength) {
      return null;
    }
    if (this.line === null) {
      this.lineTokens = this.textModel.tokenization.getLineTokens(this.lineIdx + 1);
      this.line = this.lineTokens.getLineContent();
      this.lineTokenOffset = this.lineCharOffset === 0 ? 0 : this.lineTokens.findTokenIndexAtOffset(this.lineCharOffset);
    }
    const startLineIdx = this.lineIdx;
    const startLineCharOffset = this.lineCharOffset;
    let lengthHeuristic = 0;
    while (true) {
      const lineTokens = this.lineTokens;
      const tokenCount = lineTokens.getCount();
      let peekedBracketToken = null;
      if (this.lineTokenOffset < tokenCount) {
        const tokenMetadata = lineTokens.getMetadata(this.lineTokenOffset);
        while (this.lineTokenOffset + 1 < tokenCount && tokenMetadata === lineTokens.getMetadata(this.lineTokenOffset + 1)) {
          this.lineTokenOffset++;
        }
        const isOther = TokenMetadata.getTokenType(tokenMetadata) === StandardTokenType.Other;
        const containsBracketType = TokenMetadata.containsBalancedBrackets(tokenMetadata);
        const endOffset = lineTokens.getEndOffset(this.lineTokenOffset);
        if (containsBracketType && isOther && this.lineCharOffset < endOffset) {
          const languageId = lineTokens.getLanguageId(this.lineTokenOffset);
          const text = this.line.substring(this.lineCharOffset, endOffset);
          const brackets = this.bracketTokens.getSingleLanguageBracketTokens(languageId);
          const regexp = brackets.regExpGlobal;
          if (regexp) {
            regexp.lastIndex = 0;
            const match = regexp.exec(text);
            if (match) {
              peekedBracketToken = brackets.getToken(match[0]);
              if (peekedBracketToken) {
                this.lineCharOffset += match.index;
              }
            }
          }
        }
        lengthHeuristic += endOffset - this.lineCharOffset;
        if (peekedBracketToken) {
          if (startLineIdx !== this.lineIdx || startLineCharOffset !== this.lineCharOffset) {
            this.peekedToken = peekedBracketToken;
            break;
          } else {
            this.lineCharOffset += lengthGetColumnCountIfZeroLineCount(peekedBracketToken.length);
            return peekedBracketToken;
          }
        } else {
          this.lineTokenOffset++;
          this.lineCharOffset = endOffset;
        }
      } else {
        if (this.lineIdx === this.textBufferLineCount - 1) {
          break;
        }
        this.lineIdx++;
        this.lineTokens = this.textModel.tokenization.getLineTokens(this.lineIdx + 1);
        this.lineTokenOffset = 0;
        this.line = this.lineTokens.getLineContent();
        this.lineCharOffset = 0;
        lengthHeuristic += 33;
        if (lengthHeuristic > 1e3) {
          break;
        }
      }
      if (lengthHeuristic > 1500) {
        break;
      }
    }
    const length = lengthDiff(startLineIdx, startLineCharOffset, this.lineIdx, this.lineCharOffset);
    return new Token(length, 0 /* Text */, -1, SmallImmutableSet.getEmpty(), new TextAstNode(length));
  }
}
class FastTokenizer {
  constructor(text, brackets) {
    this.text = text;
    this._offset = lengthZero;
    this.idx = 0;
    const regExpStr = brackets.getRegExpStr();
    const regexp = regExpStr ? new RegExp(regExpStr + "|\n", "gi") : null;
    const tokens = [];
    let match;
    let curLineCount = 0;
    let lastLineBreakOffset = 0;
    let lastTokenEndOffset = 0;
    let lastTokenEndLine = 0;
    const smallTextTokens0Line = [];
    for (let i = 0; i < 60; i++) {
      smallTextTokens0Line.push(
        new Token(
          toLength(0, i),
          0 /* Text */,
          -1,
          SmallImmutableSet.getEmpty(),
          new TextAstNode(toLength(0, i))
        )
      );
    }
    const smallTextTokens1Line = [];
    for (let i = 0; i < 60; i++) {
      smallTextTokens1Line.push(
        new Token(
          toLength(1, i),
          0 /* Text */,
          -1,
          SmallImmutableSet.getEmpty(),
          new TextAstNode(toLength(1, i))
        )
      );
    }
    if (regexp) {
      regexp.lastIndex = 0;
      while ((match = regexp.exec(text)) !== null) {
        const curOffset = match.index;
        const value = match[0];
        if (value === "\n") {
          curLineCount++;
          lastLineBreakOffset = curOffset + 1;
        } else {
          if (lastTokenEndOffset !== curOffset) {
            let token;
            if (lastTokenEndLine === curLineCount) {
              const colCount = curOffset - lastTokenEndOffset;
              if (colCount < smallTextTokens0Line.length) {
                token = smallTextTokens0Line[colCount];
              } else {
                const length = toLength(0, colCount);
                token = new Token(length, 0 /* Text */, -1, SmallImmutableSet.getEmpty(), new TextAstNode(length));
              }
            } else {
              const lineCount = curLineCount - lastTokenEndLine;
              const colCount = curOffset - lastLineBreakOffset;
              if (lineCount === 1 && colCount < smallTextTokens1Line.length) {
                token = smallTextTokens1Line[colCount];
              } else {
                const length = toLength(lineCount, colCount);
                token = new Token(length, 0 /* Text */, -1, SmallImmutableSet.getEmpty(), new TextAstNode(length));
              }
            }
            tokens.push(token);
          }
          tokens.push(brackets.getToken(value));
          lastTokenEndOffset = curOffset + value.length;
          lastTokenEndLine = curLineCount;
        }
      }
    }
    const offset = text.length;
    if (lastTokenEndOffset !== offset) {
      const length = lastTokenEndLine === curLineCount ? toLength(0, offset - lastTokenEndOffset) : toLength(curLineCount - lastTokenEndLine, offset - lastLineBreakOffset);
      tokens.push(new Token(length, 0 /* Text */, -1, SmallImmutableSet.getEmpty(), new TextAstNode(length)));
    }
    this.length = toLength(curLineCount, offset - lastLineBreakOffset);
    this.tokens = tokens;
  }
  get offset() {
    return this._offset;
  }
  read() {
    return this.tokens[this.idx++] || null;
  }
  peek() {
    return this.tokens[this.idx] || null;
  }
  skip(length) {
    throw new NotSupportedError();
  }
  getText() {
    return this.text;
  }
}
export {
  FastTokenizer,
  TextBufferTokenizer,
  Token,
  TokenKind
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzVHJlZS90b2tlbml6ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBOb3RTdXBwb3J0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZFRva2VuVHlwZSwgVG9rZW5NZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgSVZpZXdMaW5lVG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgQnJhY2tldEFzdE5vZGUsIFRleHRBc3ROb2RlIH0gZnJvbSAnLi9hc3QuanMnO1xuaW1wb3J0IHsgQnJhY2tldFRva2VucywgTGFuZ3VhZ2VBZ25vc3RpY0JyYWNrZXRUb2tlbnMgfSBmcm9tICcuL2JyYWNrZXRzLmpzJztcbmltcG9ydCB7IExlbmd0aCwgbGVuZ3RoQWRkLCBsZW5ndGhEaWZmLCBsZW5ndGhHZXRDb2x1bW5Db3VudElmWmVyb0xpbmVDb3VudCwgbGVuZ3RoVG9PYmosIGxlbmd0aFplcm8sIHRvTGVuZ3RoIH0gZnJvbSAnLi9sZW5ndGguanMnO1xuaW1wb3J0IHsgU21hbGxJbW11dGFibGVTZXQgfSBmcm9tICcuL3NtYWxsSW1tdXRhYmxlU2V0LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBUb2tlbml6ZXIge1xuXHRyZWFkb25seSBvZmZzZXQ6IExlbmd0aDtcblx0cmVhZG9ubHkgbGVuZ3RoOiBMZW5ndGg7XG5cblx0cmVhZCgpOiBUb2tlbiB8IG51bGw7XG5cdHBlZWsoKTogVG9rZW4gfCBudWxsO1xuXHRza2lwKGxlbmd0aDogTGVuZ3RoKTogdm9pZDtcblxuXHRnZXRUZXh0KCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gVG9rZW5LaW5kIHtcblx0VGV4dCA9IDAsXG5cdE9wZW5pbmdCcmFja2V0ID0gMSxcblx0Q2xvc2luZ0JyYWNrZXQgPSAyLFxufVxuXG5leHBvcnQgdHlwZSBPcGVuaW5nQnJhY2tldElkID0gbnVtYmVyO1xuXG5leHBvcnQgY2xhc3MgVG9rZW4ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBsZW5ndGg6IExlbmd0aCxcblx0XHRyZWFkb25seSBraW5kOiBUb2tlbktpbmQsXG5cdFx0LyoqXG5cdFx0ICogSWYgdGhpcyB0b2tlbiBpcyBhbiBvcGVuaW5nIGJyYWNrZXQsIHRoaXMgaXMgdGhlIGlkIG9mIHRoZSBvcGVuaW5nIGJyYWNrZXQuXG5cdFx0ICogSWYgdGhpcyB0b2tlbiBpcyBhIGNsb3NpbmcgYnJhY2tldCwgdGhpcyBpcyB0aGUgaWQgb2YgdGhlIGZpcnN0IG9wZW5pbmcgYnJhY2tldCB0aGF0IGlzIGNsb3NlZCBieSB0aGlzIGJyYWNrZXQuXG5cdFx0ICogT3RoZXJ3aXNlLCBpdCBpcyAtMS5cblx0XHQgKi9cblx0XHRyZWFkb25seSBicmFja2V0SWQ6IE9wZW5pbmdCcmFja2V0SWQsXG5cdFx0LyoqXG5cdFx0ICogSWYgdGhpcyB0b2tlbiBpcyBhbiBvcGVuaW5nIGJyYWNrZXQsIHRoaXMganVzdCBjb250YWlucyBgYnJhY2tldElkYC5cblx0XHQgKiBJZiB0aGlzIHRva2VuIGlzIGEgY2xvc2luZyBicmFja2V0LCB0aGlzIGxpc3RzIGFsbCBvcGVuaW5nIGJyYWNrZXQgaWRzLCB0aGF0IGl0IGNsb3Nlcy5cblx0XHQgKiBPdGhlcndpc2UsIGl0IGlzIGVtcHR5LlxuXHRcdCAqL1xuXHRcdHJlYWRvbmx5IGJyYWNrZXRJZHM6IFNtYWxsSW1tdXRhYmxlU2V0PE9wZW5pbmdCcmFja2V0SWQ+LFxuXHRcdHJlYWRvbmx5IGFzdE5vZGU6IEJyYWNrZXRBc3ROb2RlIHwgVGV4dEFzdE5vZGUgfCB1bmRlZmluZWQsXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRva2VuaXplclNvdXJjZSB7XG5cdGdldFZhbHVlKCk6IHN0cmluZztcblx0Z2V0TGluZUNvdW50KCk6IG51bWJlcjtcblx0Z2V0TGluZUxlbmd0aChsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXI7XG5cblx0dG9rZW5pemF0aW9uOiB7XG5cdFx0Z2V0TGluZVRva2VucyhsaW5lTnVtYmVyOiBudW1iZXIpOiBJVmlld0xpbmVUb2tlbnM7XG5cdH07XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0QnVmZmVyVG9rZW5pemVyIGltcGxlbWVudHMgVG9rZW5pemVyIHtcblx0cHJpdmF0ZSByZWFkb25seSB0ZXh0QnVmZmVyTGluZUNvdW50OiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgdGV4dEJ1ZmZlckxhc3RMaW5lTGVuZ3RoOiBudW1iZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSByZWFkZXIgPSBuZXcgTm9uUGVla2FibGVUZXh0QnVmZmVyVG9rZW5pemVyKHRoaXMudGV4dE1vZGVsLCB0aGlzLmJyYWNrZXRUb2tlbnMpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsOiBJVG9rZW5pemVyU291cmNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYnJhY2tldFRva2VuczogTGFuZ3VhZ2VBZ25vc3RpY0JyYWNrZXRUb2tlbnNcblx0KSB7XG5cdFx0dGhpcy50ZXh0QnVmZmVyTGluZUNvdW50ID0gdGV4dE1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdHRoaXMudGV4dEJ1ZmZlckxhc3RMaW5lTGVuZ3RoID0gdGV4dE1vZGVsLmdldExpbmVMZW5ndGgodGhpcy50ZXh0QnVmZmVyTGluZUNvdW50KTtcblx0fVxuXG5cdHByaXZhdGUgX29mZnNldDogTGVuZ3RoID0gbGVuZ3RoWmVybztcblxuXHRnZXQgb2Zmc2V0KCkge1xuXHRcdHJldHVybiB0aGlzLl9vZmZzZXQ7XG5cdH1cblxuXHRnZXQgbGVuZ3RoKCkge1xuXHRcdHJldHVybiB0b0xlbmd0aCh0aGlzLnRleHRCdWZmZXJMaW5lQ291bnQgLSAxLCB0aGlzLnRleHRCdWZmZXJMYXN0TGluZUxlbmd0aCk7XG5cdH1cblxuXHRnZXRUZXh0KCkge1xuXHRcdHJldHVybiB0aGlzLnRleHRNb2RlbC5nZXRWYWx1ZSgpO1xuXHR9XG5cblx0c2tpcChsZW5ndGg6IExlbmd0aCk6IHZvaWQge1xuXHRcdHRoaXMuZGlkUGVlayA9IGZhbHNlO1xuXHRcdHRoaXMuX29mZnNldCA9IGxlbmd0aEFkZCh0aGlzLl9vZmZzZXQsIGxlbmd0aCk7XG5cdFx0Y29uc3Qgb2JqID0gbGVuZ3RoVG9PYmoodGhpcy5fb2Zmc2V0KTtcblx0XHR0aGlzLnJlYWRlci5zZXRQb3NpdGlvbihvYmoubGluZUNvdW50LCBvYmouY29sdW1uQ291bnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBkaWRQZWVrID0gZmFsc2U7XG5cdHByaXZhdGUgcGVla2VkOiBUb2tlbiB8IG51bGwgPSBudWxsO1xuXG5cdHJlYWQoKTogVG9rZW4gfCBudWxsIHtcblx0XHRsZXQgdG9rZW46IFRva2VuIHwgbnVsbDtcblx0XHRpZiAodGhpcy5wZWVrZWQpIHtcblx0XHRcdHRoaXMuZGlkUGVlayA9IGZhbHNlO1xuXHRcdFx0dG9rZW4gPSB0aGlzLnBlZWtlZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9rZW4gPSB0aGlzLnJlYWRlci5yZWFkKCk7XG5cdFx0fVxuXHRcdGlmICh0b2tlbikge1xuXHRcdFx0dGhpcy5fb2Zmc2V0ID0gbGVuZ3RoQWRkKHRoaXMuX29mZnNldCwgdG9rZW4ubGVuZ3RoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRva2VuO1xuXHR9XG5cblx0cGVlaygpOiBUb2tlbiB8IG51bGwge1xuXHRcdGlmICghdGhpcy5kaWRQZWVrKSB7XG5cdFx0XHR0aGlzLnBlZWtlZCA9IHRoaXMucmVhZGVyLnJlYWQoKTtcblx0XHRcdHRoaXMuZGlkUGVlayA9IHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnBlZWtlZDtcblx0fVxufVxuXG4vKipcbiAqIERvZXMgbm90IHN1cHBvcnQgcGVlay5cbiovXG5jbGFzcyBOb25QZWVrYWJsZVRleHRCdWZmZXJUb2tlbml6ZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IHRleHRCdWZmZXJMaW5lQ291bnQ6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSB0ZXh0QnVmZmVyTGFzdExpbmVMZW5ndGg6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbDogSVRva2VuaXplclNvdXJjZSwgcHJpdmF0ZSByZWFkb25seSBicmFja2V0VG9rZW5zOiBMYW5ndWFnZUFnbm9zdGljQnJhY2tldFRva2Vucykge1xuXHRcdHRoaXMudGV4dEJ1ZmZlckxpbmVDb3VudCA9IHRleHRNb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHR0aGlzLnRleHRCdWZmZXJMYXN0TGluZUxlbmd0aCA9IHRleHRNb2RlbC5nZXRMaW5lTGVuZ3RoKHRoaXMudGV4dEJ1ZmZlckxpbmVDb3VudCk7XG5cdH1cblxuXHRwcml2YXRlIGxpbmVJZHggPSAwO1xuXHRwcml2YXRlIGxpbmU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGxpbmVDaGFyT2Zmc2V0ID0gMDtcblx0cHJpdmF0ZSBsaW5lVG9rZW5zOiBJVmlld0xpbmVUb2tlbnMgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBsaW5lVG9rZW5PZmZzZXQgPSAwO1xuXG5cdHB1YmxpYyBzZXRQb3NpdGlvbihsaW5lSWR4OiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKTogdm9pZCB7XG5cdFx0Ly8gV2UgbXVzdCBub3QganVtcCBpbnRvIGEgdG9rZW4hXG5cdFx0aWYgKGxpbmVJZHggPT09IHRoaXMubGluZUlkeCkge1xuXHRcdFx0dGhpcy5saW5lQ2hhck9mZnNldCA9IGNvbHVtbjtcblx0XHRcdGlmICh0aGlzLmxpbmUgIT09IG51bGwpIHtcblx0XHRcdFx0dGhpcy5saW5lVG9rZW5PZmZzZXQgPSB0aGlzLmxpbmVDaGFyT2Zmc2V0ID09PSAwID8gMCA6IHRoaXMubGluZVRva2VucyEuZmluZFRva2VuSW5kZXhBdE9mZnNldCh0aGlzLmxpbmVDaGFyT2Zmc2V0KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5saW5lSWR4ID0gbGluZUlkeDtcblx0XHRcdHRoaXMubGluZUNoYXJPZmZzZXQgPSBjb2x1bW47XG5cdFx0XHR0aGlzLmxpbmUgPSBudWxsO1xuXHRcdH1cblx0XHR0aGlzLnBlZWtlZFRva2VuID0gbnVsbDtcblx0fVxuXG5cdC8qKiBNdXN0IGJlIGEgemVybyBsaW5lIHRva2VuLiBUaGUgZW5kIG9mIHRoZSBkb2N1bWVudCBjYW5ub3QgYmUgcGVla2VkLiAqL1xuXHRwcml2YXRlIHBlZWtlZFRva2VuOiBUb2tlbiB8IG51bGwgPSBudWxsO1xuXG5cdHB1YmxpYyByZWFkKCk6IFRva2VuIHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMucGVla2VkVG9rZW4pIHtcblx0XHRcdGNvbnN0IHRva2VuID0gdGhpcy5wZWVrZWRUb2tlbjtcblx0XHRcdHRoaXMucGVla2VkVG9rZW4gPSBudWxsO1xuXHRcdFx0dGhpcy5saW5lQ2hhck9mZnNldCArPSBsZW5ndGhHZXRDb2x1bW5Db3VudElmWmVyb0xpbmVDb3VudCh0b2tlbi5sZW5ndGgpO1xuXHRcdFx0cmV0dXJuIHRva2VuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmxpbmVJZHggPiB0aGlzLnRleHRCdWZmZXJMaW5lQ291bnQgLSAxIHx8ICh0aGlzLmxpbmVJZHggPT09IHRoaXMudGV4dEJ1ZmZlckxpbmVDb3VudCAtIDEgJiYgdGhpcy5saW5lQ2hhck9mZnNldCA+PSB0aGlzLnRleHRCdWZmZXJMYXN0TGluZUxlbmd0aCkpIHtcblx0XHRcdC8vIFdlIGFyZSBhZnRlciB0aGUgZW5kXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5saW5lID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLmxpbmVUb2tlbnMgPSB0aGlzLnRleHRNb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2Vucyh0aGlzLmxpbmVJZHggKyAxKTtcblx0XHRcdHRoaXMubGluZSA9IHRoaXMubGluZVRva2Vucy5nZXRMaW5lQ29udGVudCgpO1xuXHRcdFx0dGhpcy5saW5lVG9rZW5PZmZzZXQgPSB0aGlzLmxpbmVDaGFyT2Zmc2V0ID09PSAwID8gMCA6IHRoaXMubGluZVRva2Vucy5maW5kVG9rZW5JbmRleEF0T2Zmc2V0KHRoaXMubGluZUNoYXJPZmZzZXQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXJ0TGluZUlkeCA9IHRoaXMubGluZUlkeDtcblx0XHRjb25zdCBzdGFydExpbmVDaGFyT2Zmc2V0ID0gdGhpcy5saW5lQ2hhck9mZnNldDtcblxuXHRcdC8vIGxpbWl0cyB0aGUgbGVuZ3RoIG9mIHRleHQgdG9rZW5zLlxuXHRcdC8vIElmIHRleHQgdG9rZW5zIGdldCB0b28gbG9uZywgaW5jcmVtZW50YWwgdXBkYXRlcyB3aWxsIGJlIHNsb3dcblx0XHRsZXQgbGVuZ3RoSGV1cmlzdGljID0gMDtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0Y29uc3QgbGluZVRva2VucyA9IHRoaXMubGluZVRva2VucyE7XG5cdFx0XHRjb25zdCB0b2tlbkNvdW50ID0gbGluZVRva2Vucy5nZXRDb3VudCgpO1xuXG5cdFx0XHRsZXQgcGVla2VkQnJhY2tldFRva2VuOiBUb2tlbiB8IG51bGwgPSBudWxsO1xuXG5cdFx0XHRpZiAodGhpcy5saW5lVG9rZW5PZmZzZXQgPCB0b2tlbkNvdW50KSB7XG5cdFx0XHRcdGNvbnN0IHRva2VuTWV0YWRhdGEgPSBsaW5lVG9rZW5zLmdldE1ldGFkYXRhKHRoaXMubGluZVRva2VuT2Zmc2V0KTtcblx0XHRcdFx0d2hpbGUgKHRoaXMubGluZVRva2VuT2Zmc2V0ICsgMSA8IHRva2VuQ291bnQgJiYgdG9rZW5NZXRhZGF0YSA9PT0gbGluZVRva2Vucy5nZXRNZXRhZGF0YSh0aGlzLmxpbmVUb2tlbk9mZnNldCArIDEpKSB7XG5cdFx0XHRcdFx0Ly8gU2tpcCB0b2tlbnMgdGhhdCBhcmUgaWRlbnRpY2FsLlxuXHRcdFx0XHRcdC8vIFNvbWV0aW1lcywgKGJyYWNrZXQpIGlkZW50aWZpZXJzIGFyZSBzcGxpdCB1cCBpbnRvIG11bHRpcGxlIHRva2Vucy5cblx0XHRcdFx0XHR0aGlzLmxpbmVUb2tlbk9mZnNldCsrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaXNPdGhlciA9IFRva2VuTWV0YWRhdGEuZ2V0VG9rZW5UeXBlKHRva2VuTWV0YWRhdGEpID09PSBTdGFuZGFyZFRva2VuVHlwZS5PdGhlcjtcblx0XHRcdFx0Y29uc3QgY29udGFpbnNCcmFja2V0VHlwZSA9IFRva2VuTWV0YWRhdGEuY29udGFpbnNCYWxhbmNlZEJyYWNrZXRzKHRva2VuTWV0YWRhdGEpO1xuXG5cdFx0XHRcdGNvbnN0IGVuZE9mZnNldCA9IGxpbmVUb2tlbnMuZ2V0RW5kT2Zmc2V0KHRoaXMubGluZVRva2VuT2Zmc2V0KTtcblx0XHRcdFx0Ly8gSXMgdGhlcmUgYSBicmFja2V0IHRva2VuIG5leHQ/IE9ubHkgY29uc3VtZSB0ZXh0LlxuXHRcdFx0XHRpZiAoY29udGFpbnNCcmFja2V0VHlwZSAmJiBpc090aGVyICYmIHRoaXMubGluZUNoYXJPZmZzZXQgPCBlbmRPZmZzZXQpIHtcblx0XHRcdFx0XHRjb25zdCBsYW5ndWFnZUlkID0gbGluZVRva2Vucy5nZXRMYW5ndWFnZUlkKHRoaXMubGluZVRva2VuT2Zmc2V0KTtcblx0XHRcdFx0XHRjb25zdCB0ZXh0ID0gdGhpcy5saW5lLnN1YnN0cmluZyh0aGlzLmxpbmVDaGFyT2Zmc2V0LCBlbmRPZmZzZXQpO1xuXG5cdFx0XHRcdFx0Y29uc3QgYnJhY2tldHMgPSB0aGlzLmJyYWNrZXRUb2tlbnMuZ2V0U2luZ2xlTGFuZ3VhZ2VCcmFja2V0VG9rZW5zKGxhbmd1YWdlSWQpO1xuXHRcdFx0XHRcdGNvbnN0IHJlZ2V4cCA9IGJyYWNrZXRzLnJlZ0V4cEdsb2JhbDtcblx0XHRcdFx0XHRpZiAocmVnZXhwKSB7XG5cdFx0XHRcdFx0XHRyZWdleHAubGFzdEluZGV4ID0gMDtcblx0XHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gcmVnZXhwLmV4ZWModGV4dCk7XG5cdFx0XHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRcdFx0cGVla2VkQnJhY2tldFRva2VuID0gYnJhY2tldHMuZ2V0VG9rZW4obWF0Y2hbMF0pITtcblx0XHRcdFx0XHRcdFx0aWYgKHBlZWtlZEJyYWNrZXRUb2tlbikge1xuXHRcdFx0XHRcdFx0XHRcdC8vIENvbnN1bWUgbGVhZGluZyB0ZXh0IG9mIHRoZSB0b2tlblxuXHRcdFx0XHRcdFx0XHRcdHRoaXMubGluZUNoYXJPZmZzZXQgKz0gbWF0Y2guaW5kZXg7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZW5ndGhIZXVyaXN0aWMgKz0gZW5kT2Zmc2V0IC0gdGhpcy5saW5lQ2hhck9mZnNldDtcblxuXHRcdFx0XHRpZiAocGVla2VkQnJhY2tldFRva2VuKSB7XG5cdFx0XHRcdFx0Ly8gRG9uJ3Qgc2tpcCB0aGUgZW50aXJlIHRva2VuLCBhcyBhIHNpbmdsZSB0b2tlbiBjb3VsZCBjb250YWluIG11bHRpcGxlIGJyYWNrZXRzLlxuXG5cdFx0XHRcdFx0aWYgKHN0YXJ0TGluZUlkeCAhPT0gdGhpcy5saW5lSWR4IHx8IHN0YXJ0TGluZUNoYXJPZmZzZXQgIT09IHRoaXMubGluZUNoYXJPZmZzZXQpIHtcblx0XHRcdFx0XHRcdC8vIFRoZXJlIGlzIHRleHQgYmVmb3JlIHRoZSBicmFja2V0XG5cdFx0XHRcdFx0XHR0aGlzLnBlZWtlZFRva2VuID0gcGVla2VkQnJhY2tldFRva2VuO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIENvbnN1bWUgdGhlIHBlZWtlZCB0b2tlblxuXHRcdFx0XHRcdFx0dGhpcy5saW5lQ2hhck9mZnNldCArPSBsZW5ndGhHZXRDb2x1bW5Db3VudElmWmVyb0xpbmVDb3VudChwZWVrZWRCcmFja2V0VG9rZW4ubGVuZ3RoKTtcblx0XHRcdFx0XHRcdHJldHVybiBwZWVrZWRCcmFja2V0VG9rZW47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFNraXAgdGhlIGVudGlyZSB0b2tlbiwgYXMgdGhlIHRva2VuIGNvbnRhaW5zIG5vIGJyYWNrZXRzIGF0IGFsbC5cblx0XHRcdFx0XHR0aGlzLmxpbmVUb2tlbk9mZnNldCsrO1xuXHRcdFx0XHRcdHRoaXMubGluZUNoYXJPZmZzZXQgPSBlbmRPZmZzZXQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLmxpbmVJZHggPT09IHRoaXMudGV4dEJ1ZmZlckxpbmVDb3VudCAtIDEpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmxpbmVJZHgrKztcblx0XHRcdFx0dGhpcy5saW5lVG9rZW5zID0gdGhpcy50ZXh0TW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnModGhpcy5saW5lSWR4ICsgMSk7XG5cdFx0XHRcdHRoaXMubGluZVRva2VuT2Zmc2V0ID0gMDtcblx0XHRcdFx0dGhpcy5saW5lID0gdGhpcy5saW5lVG9rZW5zLmdldExpbmVDb250ZW50KCk7XG5cdFx0XHRcdHRoaXMubGluZUNoYXJPZmZzZXQgPSAwO1xuXG5cdFx0XHRcdGxlbmd0aEhldXJpc3RpYyArPSAzMzsgLy8gbWF4IDEwMDAvMzMgPSAzMCBsaW5lc1xuXHRcdFx0XHQvLyBUaGlzIGxpbWl0cyB0aGUgYW1vdW50IG9mIHdvcmsgdG8gcmVjb21wdXRlIG1pbi1pbmRlbnRhdGlvblxuXG5cdFx0XHRcdGlmIChsZW5ndGhIZXVyaXN0aWMgPiAxMDAwKSB7XG5cdFx0XHRcdFx0Ly8gb25seSBicmVhayAoYXV0b21hdGljYWxseSkgYXQgdGhlIGVuZCBvZiBsaW5lLlxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChsZW5ndGhIZXVyaXN0aWMgPiAxNTAwKSB7XG5cdFx0XHRcdC8vIEV2ZW50dWFsbHkgYnJlYWsgcmVnYXJkbGVzcyBvZiB0aGUgbGluZSBsZW5ndGggc28gdGhhdFxuXHRcdFx0XHQvLyB2ZXJ5IGxvbmcgbGluZXMgZG8gbm90IGNhdXNlIGJhZCBwZXJmb3JtYW5jZS5cblx0XHRcdFx0Ly8gVGhpcyBlZmZlY3RpdmUgbGltaXRzIG1heCBpbmRlbnRhdGlvbiB0byA1MDAsIGFzXG5cdFx0XHRcdC8vIGluZGVudGF0aW9uIGlzIG5vdCBjb21wdXRlZCBhY3Jvc3MgbXVsdGlwbGUgdGV4dCBub2Rlcy5cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgYSB0b2tlbiBjb250YWlucyBzb21lIHByb3BlciBpbmRlbnRhdGlvbiwgaXQgYWxzbyBjb250YWlucyBcXG57SU5ERU5UQVRJT04rfSg/IXtJTkRFTlRBVElPTn0pLFxuXHRcdC8vIHVubGVzcyB0aGUgbGluZSBpcyB0b28gbG9uZy5cblx0XHQvLyBUaHVzLCB0aGUgbWluIGluZGVudGF0aW9uIG9mIHRoZSBkb2N1bWVudCBpcyB0aGUgbWluaW11bSBtaW4gaW5kZW50YXRpb24gb2YgZXZlcnkgdGV4dCBub2RlLlxuXHRcdGNvbnN0IGxlbmd0aCA9IGxlbmd0aERpZmYoc3RhcnRMaW5lSWR4LCBzdGFydExpbmVDaGFyT2Zmc2V0LCB0aGlzLmxpbmVJZHgsIHRoaXMubGluZUNoYXJPZmZzZXQpO1xuXHRcdHJldHVybiBuZXcgVG9rZW4obGVuZ3RoLCBUb2tlbktpbmQuVGV4dCwgLTEsIFNtYWxsSW1tdXRhYmxlU2V0LmdldEVtcHR5KCksIG5ldyBUZXh0QXN0Tm9kZShsZW5ndGgpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRmFzdFRva2VuaXplciBpbXBsZW1lbnRzIFRva2VuaXplciB7XG5cdHByaXZhdGUgX29mZnNldDogTGVuZ3RoID0gbGVuZ3RoWmVybztcblx0cHJpdmF0ZSByZWFkb25seSB0b2tlbnM6IHJlYWRvbmx5IFRva2VuW107XG5cdHByaXZhdGUgaWR4ID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHRleHQ6IHN0cmluZywgYnJhY2tldHM6IEJyYWNrZXRUb2tlbnMpIHtcblx0XHRjb25zdCByZWdFeHBTdHIgPSBicmFja2V0cy5nZXRSZWdFeHBTdHIoKTtcblx0XHRjb25zdCByZWdleHAgPSByZWdFeHBTdHIgPyBuZXcgUmVnRXhwKHJlZ0V4cFN0ciArICd8XFxuJywgJ2dpJykgOiBudWxsO1xuXG5cdFx0Y29uc3QgdG9rZW5zOiBUb2tlbltdID0gW107XG5cblx0XHRsZXQgbWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG5cdFx0bGV0IGN1ckxpbmVDb3VudCA9IDA7XG5cdFx0bGV0IGxhc3RMaW5lQnJlYWtPZmZzZXQgPSAwO1xuXG5cdFx0bGV0IGxhc3RUb2tlbkVuZE9mZnNldCA9IDA7XG5cdFx0bGV0IGxhc3RUb2tlbkVuZExpbmUgPSAwO1xuXG5cdFx0Y29uc3Qgc21hbGxUZXh0VG9rZW5zMExpbmU6IFRva2VuW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDYwOyBpKyspIHtcblx0XHRcdHNtYWxsVGV4dFRva2VuczBMaW5lLnB1c2goXG5cdFx0XHRcdG5ldyBUb2tlbihcblx0XHRcdFx0XHR0b0xlbmd0aCgwLCBpKSwgVG9rZW5LaW5kLlRleHQsIC0xLCBTbWFsbEltbXV0YWJsZVNldC5nZXRFbXB0eSgpLFxuXHRcdFx0XHRcdG5ldyBUZXh0QXN0Tm9kZSh0b0xlbmd0aCgwLCBpKSlcblx0XHRcdFx0KVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRjb25zdCBzbWFsbFRleHRUb2tlbnMxTGluZTogVG9rZW5bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNjA7IGkrKykge1xuXHRcdFx0c21hbGxUZXh0VG9rZW5zMUxpbmUucHVzaChcblx0XHRcdFx0bmV3IFRva2VuKFxuXHRcdFx0XHRcdHRvTGVuZ3RoKDEsIGkpLCBUb2tlbktpbmQuVGV4dCwgLTEsIFNtYWxsSW1tdXRhYmxlU2V0LmdldEVtcHR5KCksXG5cdFx0XHRcdFx0bmV3IFRleHRBc3ROb2RlKHRvTGVuZ3RoKDEsIGkpKVxuXHRcdFx0XHQpXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGlmIChyZWdleHApIHtcblx0XHRcdHJlZ2V4cC5sYXN0SW5kZXggPSAwO1xuXHRcdFx0Ly8gSWYgYSB0b2tlbiBjb250YWlucyBpbmRlbnRhdGlvbiwgaXQgYWxzbyBjb250YWlucyBcXG57SU5ERU5UQVRJT04rfSg/IXtJTkRFTlRBVElPTn0pXG5cdFx0XHR3aGlsZSAoKG1hdGNoID0gcmVnZXhwLmV4ZWModGV4dCkpICE9PSBudWxsKSB7XG5cdFx0XHRcdGNvbnN0IGN1ck9mZnNldCA9IG1hdGNoLmluZGV4O1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IG1hdGNoWzBdO1xuXHRcdFx0XHRpZiAodmFsdWUgPT09ICdcXG4nKSB7XG5cdFx0XHRcdFx0Y3VyTGluZUNvdW50Kys7XG5cdFx0XHRcdFx0bGFzdExpbmVCcmVha09mZnNldCA9IGN1ck9mZnNldCArIDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGxhc3RUb2tlbkVuZE9mZnNldCAhPT0gY3VyT2Zmc2V0KSB7XG5cdFx0XHRcdFx0XHRsZXQgdG9rZW46IFRva2VuO1xuXHRcdFx0XHRcdFx0aWYgKGxhc3RUb2tlbkVuZExpbmUgPT09IGN1ckxpbmVDb3VudCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjb2xDb3VudCA9IGN1ck9mZnNldCAtIGxhc3RUb2tlbkVuZE9mZnNldDtcblx0XHRcdFx0XHRcdFx0aWYgKGNvbENvdW50IDwgc21hbGxUZXh0VG9rZW5zMExpbmUubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdFx0dG9rZW4gPSBzbWFsbFRleHRUb2tlbnMwTGluZVtjb2xDb3VudF07XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgbGVuZ3RoID0gdG9MZW5ndGgoMCwgY29sQ291bnQpO1xuXHRcdFx0XHRcdFx0XHRcdHRva2VuID0gbmV3IFRva2VuKGxlbmd0aCwgVG9rZW5LaW5kLlRleHQsIC0xLCBTbWFsbEltbXV0YWJsZVNldC5nZXRFbXB0eSgpLCBuZXcgVGV4dEFzdE5vZGUobGVuZ3RoKSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IGN1ckxpbmVDb3VudCAtIGxhc3RUb2tlbkVuZExpbmU7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbENvdW50ID0gY3VyT2Zmc2V0IC0gbGFzdExpbmVCcmVha09mZnNldDtcblx0XHRcdFx0XHRcdFx0aWYgKGxpbmVDb3VudCA9PT0gMSAmJiBjb2xDb3VudCA8IHNtYWxsVGV4dFRva2VuczFMaW5lLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdHRva2VuID0gc21hbGxUZXh0VG9rZW5zMUxpbmVbY29sQ291bnRdO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGxlbmd0aCA9IHRvTGVuZ3RoKGxpbmVDb3VudCwgY29sQ291bnQpO1xuXHRcdFx0XHRcdFx0XHRcdHRva2VuID0gbmV3IFRva2VuKGxlbmd0aCwgVG9rZW5LaW5kLlRleHQsIC0xLCBTbWFsbEltbXV0YWJsZVNldC5nZXRFbXB0eSgpLCBuZXcgVGV4dEFzdE5vZGUobGVuZ3RoKSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRva2Vucy5wdXNoKHRva2VuKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyB2YWx1ZSBpcyBtYXRjaGVkIGJ5IHJlZ2V4cCwgc28gdGhlIHRva2VuIG11c3QgZXhpc3Rcblx0XHRcdFx0XHR0b2tlbnMucHVzaChicmFja2V0cy5nZXRUb2tlbih2YWx1ZSkhKTtcblxuXHRcdFx0XHRcdGxhc3RUb2tlbkVuZE9mZnNldCA9IGN1ck9mZnNldCArIHZhbHVlLmxlbmd0aDtcblx0XHRcdFx0XHRsYXN0VG9rZW5FbmRMaW5lID0gY3VyTGluZUNvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gdGV4dC5sZW5ndGg7XG5cblx0XHRpZiAobGFzdFRva2VuRW5kT2Zmc2V0ICE9PSBvZmZzZXQpIHtcblx0XHRcdGNvbnN0IGxlbmd0aCA9IChsYXN0VG9rZW5FbmRMaW5lID09PSBjdXJMaW5lQ291bnQpXG5cdFx0XHRcdD8gdG9MZW5ndGgoMCwgb2Zmc2V0IC0gbGFzdFRva2VuRW5kT2Zmc2V0KVxuXHRcdFx0XHQ6IHRvTGVuZ3RoKGN1ckxpbmVDb3VudCAtIGxhc3RUb2tlbkVuZExpbmUsIG9mZnNldCAtIGxhc3RMaW5lQnJlYWtPZmZzZXQpO1xuXHRcdFx0dG9rZW5zLnB1c2gobmV3IFRva2VuKGxlbmd0aCwgVG9rZW5LaW5kLlRleHQsIC0xLCBTbWFsbEltbXV0YWJsZVNldC5nZXRFbXB0eSgpLCBuZXcgVGV4dEFzdE5vZGUobGVuZ3RoKSkpO1xuXHRcdH1cblxuXHRcdHRoaXMubGVuZ3RoID0gdG9MZW5ndGgoY3VyTGluZUNvdW50LCBvZmZzZXQgLSBsYXN0TGluZUJyZWFrT2Zmc2V0KTtcblx0XHR0aGlzLnRva2VucyA9IHRva2Vucztcblx0fVxuXG5cdGdldCBvZmZzZXQoKTogTGVuZ3RoIHtcblx0XHRyZXR1cm4gdGhpcy5fb2Zmc2V0O1xuXHR9XG5cblx0cmVhZG9ubHkgbGVuZ3RoOiBMZW5ndGg7XG5cblx0cmVhZCgpOiBUb2tlbiB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLnRva2Vuc1t0aGlzLmlkeCsrXSB8fCBudWxsO1xuXHR9XG5cblx0cGVlaygpOiBUb2tlbiB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLnRva2Vuc1t0aGlzLmlkeF0gfHwgbnVsbDtcblx0fVxuXG5cdHNraXAobGVuZ3RoOiBMZW5ndGgpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgTm90U3VwcG9ydGVkRXJyb3IoKTtcblx0fVxuXG5cdGdldFRleHQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy50ZXh0O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG1CQUFtQixxQkFBcUI7QUFFakQsU0FBeUIsbUJBQW1CO0FBRTVDLFNBQWlCLFdBQVcsWUFBWSxxQ0FBcUMsYUFBYSxZQUFZLGdCQUFnQjtBQUN0SCxTQUFTLHlCQUF5QjtBQWEzQixJQUFXLFlBQVgsa0JBQVdBLGVBQVg7QUFDTixFQUFBQSxzQkFBQSxVQUFPLEtBQVA7QUFDQSxFQUFBQSxzQkFBQSxvQkFBaUIsS0FBakI7QUFDQSxFQUFBQSxzQkFBQSxvQkFBaUIsS0FBakI7QUFIaUIsU0FBQUE7QUFBQSxHQUFBO0FBUVgsTUFBTSxNQUFNO0FBQUEsRUFDbEIsWUFDVSxRQUNBLE1BTUEsV0FNQSxZQUNBLFNBQ1I7QUFmUTtBQUNBO0FBTUE7QUFNQTtBQUNBO0FBQUEsRUFDTjtBQUNMO0FBWU8sTUFBTSxvQkFBeUM7QUFBQSxFQU1yRCxZQUNrQixXQUNBLGVBQ2hCO0FBRmdCO0FBQ0E7QUFKbEIsU0FBaUIsU0FBUyxJ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
