import { CharCode } from "../../../base/common/charCode.js";
import { illegalState } from "../../../base/common/errors.js";
import { localize } from "../../../nls.js";
var TokenType = /* @__PURE__ */ ((TokenType2) => {
  TokenType2[TokenType2["LParen"] = 0] = "LParen";
  TokenType2[TokenType2["RParen"] = 1] = "RParen";
  TokenType2[TokenType2["Neg"] = 2] = "Neg";
  TokenType2[TokenType2["Eq"] = 3] = "Eq";
  TokenType2[TokenType2["NotEq"] = 4] = "NotEq";
  TokenType2[TokenType2["Lt"] = 5] = "Lt";
  TokenType2[TokenType2["LtEq"] = 6] = "LtEq";
  TokenType2[TokenType2["Gt"] = 7] = "Gt";
  TokenType2[TokenType2["GtEq"] = 8] = "GtEq";
  TokenType2[TokenType2["RegexOp"] = 9] = "RegexOp";
  TokenType2[TokenType2["RegexStr"] = 10] = "RegexStr";
  TokenType2[TokenType2["True"] = 11] = "True";
  TokenType2[TokenType2["False"] = 12] = "False";
  TokenType2[TokenType2["In"] = 13] = "In";
  TokenType2[TokenType2["Not"] = 14] = "Not";
  TokenType2[TokenType2["And"] = 15] = "And";
  TokenType2[TokenType2["Or"] = 16] = "Or";
  TokenType2[TokenType2["Str"] = 17] = "Str";
  TokenType2[TokenType2["QuotedStr"] = 18] = "QuotedStr";
  TokenType2[TokenType2["Error"] = 19] = "Error";
  TokenType2[TokenType2["EOF"] = 20] = "EOF";
  return TokenType2;
})(TokenType || {});
function hintDidYouMean(...meant) {
  switch (meant.length) {
    case 1:
      return localize("contextkey.scanner.hint.didYouMean1", "Did you mean {0}?", meant[0]);
    case 2:
      return localize("contextkey.scanner.hint.didYouMean2", "Did you mean {0} or {1}?", meant[0], meant[1]);
    case 3:
      return localize("contextkey.scanner.hint.didYouMean3", "Did you mean {0}, {1} or {2}?", meant[0], meant[1], meant[2]);
    default:
      return void 0;
  }
}
const hintDidYouForgetToOpenOrCloseQuote = localize("contextkey.scanner.hint.didYouForgetToOpenOrCloseQuote", "Did you forget to open or close the quote?");
const hintDidYouForgetToEscapeSlash = localize("contextkey.scanner.hint.didYouForgetToEscapeSlash", "Did you forget to escape the '/' (slash) character? Put two backslashes before it to escape, e.g., '\\\\/'.");
const _Scanner = class _Scanner {
  constructor() {
    this._input = "";
    this._start = 0;
    this._current = 0;
    this._tokens = [];
    this._errors = [];
    // u - unicode, y - sticky // TODO@ulugbekna: we accept double quotes as part of the string rather than as a delimiter (to preserve old parser's behavior)
    this.stringRe = /[a-zA-Z0-9_<>\-\./\\:\*\?\+\[\]\^,#@;"%\$\p{L}-]+/uy;
  }
  static getLexeme(token) {
    switch (token.type) {
      case 0 /* LParen */:
        return "(";
      case 1 /* RParen */:
        return ")";
      case 2 /* Neg */:
        return "!";
      case 3 /* Eq */:
        return token.isTripleEq ? "===" : "==";
      case 4 /* NotEq */:
        return token.isTripleEq ? "!==" : "!=";
      case 5 /* Lt */:
        return "<";
      case 6 /* LtEq */:
        return "<=";
      case 7 /* Gt */:
        return ">=";
      case 8 /* GtEq */:
        return ">=";
      case 9 /* RegexOp */:
        return "=~";
      case 10 /* RegexStr */:
        return token.lexeme;
      case 11 /* True */:
        return "true";
      case 12 /* False */:
        return "false";
      case 13 /* In */:
        return "in";
      case 14 /* Not */:
        return "not";
      case 15 /* And */:
        return "&&";
      case 16 /* Or */:
        return "||";
      case 17 /* Str */:
        return token.lexeme;
      case 18 /* QuotedStr */:
        return token.lexeme;
      case 19 /* Error */:
        return token.lexeme;
      case 20 /* EOF */:
        return "EOF";
      default:
        throw illegalState(`unhandled token type: ${JSON.stringify(token)}; have you forgotten to add a case?`);
    }
  }
  get errors() {
    return this._errors;
  }
  reset(value) {
    this._input = value;
    this._start = 0;
    this._current = 0;
    this._tokens = [];
    this._errors = [];
    return this;
  }
  scan() {
    while (!this._isAtEnd()) {
      this._start = this._current;
      const ch = this._advance();
      switch (ch) {
        case CharCode.OpenParen:
          this._addToken(0 /* LParen */);
          break;
        case CharCode.CloseParen:
          this._addToken(1 /* RParen */);
          break;
        case CharCode.ExclamationMark:
          if (this._match(CharCode.Equals)) {
            const isTripleEq = this._match(CharCode.Equals);
            this._tokens.push({ type: 4 /* NotEq */, offset: this._start, isTripleEq });
          } else {
            this._addToken(2 /* Neg */);
          }
          break;
        case CharCode.SingleQuote:
          this._quotedString();
          break;
        case CharCode.Slash:
          this._regex();
          break;
        case CharCode.Equals:
          if (this._match(CharCode.Equals)) {
            const isTripleEq = this._match(CharCode.Equals);
            this._tokens.push({ type: 3 /* Eq */, offset: this._start, isTripleEq });
          } else if (this._match(CharCode.Tilde)) {
            this._addToken(9 /* RegexOp */);
          } else {
            this._error(hintDidYouMean("==", "=~"));
          }
          break;
        case CharCode.LessThan:
          this._addToken(this._match(CharCode.Equals) ? 6 /* LtEq */ : 5 /* Lt */);
          break;
        case CharCode.GreaterThan:
          this._addToken(this._match(CharCode.Equals) ? 8 /* GtEq */ : 7 /* Gt */);
          break;
        case CharCode.Ampersand:
          if (this._match(CharCode.Ampersand)) {
            this._addToken(15 /* And */);
          } else {
            this._error(hintDidYouMean("&&"));
          }
          break;
        case CharCode.Pipe:
          if (this._match(CharCode.Pipe)) {
            this._addToken(16 /* Or */);
          } else {
            this._error(hintDidYouMean("||"));
          }
          break;
        // TODO@ulugbekna: 1) rewrite using a regex 2) reconsider what characters are considered whitespace, including unicode, nbsp, etc.
        case CharCode.Space:
        case CharCode.CarriageReturn:
        case CharCode.Tab:
        case CharCode.LineFeed:
        case CharCode.NoBreakSpace:
          break;
        default:
          this._string();
      }
    }
    this._start = this._current;
    this._addToken(20 /* EOF */);
    return Array.from(this._tokens);
  }
  _match(expected) {
    if (this._isAtEnd()) {
      return false;
    }
    if (this._input.charCodeAt(this._current) !== expected) {
      return false;
    }
    this._current++;
    return true;
  }
  _advance() {
    return this._input.charCodeAt(this._current++);
  }
  _peek() {
    return this._isAtEnd() ? CharCode.Null : this._input.charCodeAt(this._current);
  }
  _addToken(type) {
    this._tokens.push({ type, offset: this._start });
  }
  _error(additional) {
    const offset = this._start;
    const lexeme = this._input.substring(this._start, this._current);
    const errToken = { type: 19 /* Error */, offset: this._start, lexeme };
    this._errors.push({ offset, lexeme, additionalInfo: additional });
    this._tokens.push(errToken);
  }
  _string() {
    this.stringRe.lastIndex = this._start;
    const match = this.stringRe.exec(this._input);
    if (match) {
      this._current = this._start + match[0].length;
      const lexeme = this._input.substring(this._start, this._current);
      const keyword = _Scanner._keywords.get(lexeme);
      if (keyword) {
        this._addToken(keyword);
      } else {
        this._tokens.push({ type: 17 /* Str */, lexeme, offset: this._start });
      }
    }
  }
  // captures the lexeme without the leading and trailing '
  _quotedString() {
    while (this._peek() !== CharCode.SingleQuote && !this._isAtEnd()) {
      this._advance();
    }
    if (this._isAtEnd()) {
      this._error(hintDidYouForgetToOpenOrCloseQuote);
      return;
    }
    this._advance();
    this._tokens.push({ type: 18 /* QuotedStr */, lexeme: this._input.substring(this._start + 1, this._current - 1), offset: this._start + 1 });
  }
  /*
   * Lexing a regex expression: /.../[igsmyu]*
   * Based on https://github.com/microsoft/TypeScript/blob/9247ef115e617805983740ba795d7a8164babf89/src/compiler/scanner.ts#L2129-L2181
   *
   * Note that we want slashes within a regex to be escaped, e.g., /file:\\/\\/\\// should match `file:///`
   */
  _regex() {
    let p = this._current;
    let inEscape = false;
    let inCharacterClass = false;
    while (true) {
      if (p >= this._input.length) {
        this._current = p;
        this._error(hintDidYouForgetToEscapeSlash);
        return;
      }
      const ch = this._input.charCodeAt(p);
      if (inEscape) {
        inEscape = false;
      } else if (ch === CharCode.Slash && !inCharacterClass) {
        p++;
        break;
      } else if (ch === CharCode.OpenSquareBracket) {
        inCharacterClass = true;
      } else if (ch === CharCode.Backslash) {
        inEscape = true;
      } else if (ch === CharCode.CloseSquareBracket) {
        inCharacterClass = false;
      }
      p++;
    }
    while (p < this._input.length && _Scanner._regexFlags.has(this._input.charCodeAt(p))) {
      p++;
    }
    this._current = p;
    const lexeme = this._input.substring(this._start, this._current);
    this._tokens.push({ type: 10 /* RegexStr */, lexeme, offset: this._start });
  }
  _isAtEnd() {
    return this._current >= this._input.length;
  }
};
_Scanner._regexFlags = new Set(["i", "g", "s", "m", "y", "u"].map((ch) => ch.charCodeAt(0)));
_Scanner._keywords = /* @__PURE__ */ new Map([
  ["not", 14 /* Not */],
  ["in", 13 /* In */],
  ["false", 12 /* False */],
  ["true", 11 /* True */]
]);
let Scanner = _Scanner;
export {
  Scanner,
  TokenType
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9zY2FubmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgeyBpbGxlZ2FsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuXG5leHBvcnQgY29uc3QgZW51bSBUb2tlblR5cGUge1xuXHRMUGFyZW4sXG5cdFJQYXJlbixcblx0TmVnLFxuXHRFcSxcblx0Tm90RXEsXG5cdEx0LFxuXHRMdEVxLFxuXHRHdCxcblx0R3RFcSxcblx0UmVnZXhPcCxcblx0UmVnZXhTdHIsXG5cdFRydWUsXG5cdEZhbHNlLFxuXHRJbixcblx0Tm90LFxuXHRBbmQsXG5cdE9yLFxuXHRTdHIsXG5cdFF1b3RlZFN0cixcblx0RXJyb3IsXG5cdEVPRixcbn1cblxuZXhwb3J0IHR5cGUgVG9rZW4gPVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLkxQYXJlbjsgb2Zmc2V0OiBudW1iZXIgfVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLlJQYXJlbjsgb2Zmc2V0OiBudW1iZXIgfVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLk5lZzsgb2Zmc2V0OiBudW1iZXIgfVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLkVxOyBvZmZzZXQ6IG51bWJlcjsgaXNUcmlwbGVFcTogYm9vbGVhbiB9XG5cdHwgeyB0eXBlOiBUb2tlblR5cGUuTm90RXE7IG9mZnNldDogbnVtYmVyOyBpc1RyaXBsZUVxOiBib29sZWFuIH1cblx0fCB7IHR5cGU6IFRva2VuVHlwZS5MdDsgb2Zmc2V0OiBudW1iZXIgfVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLkx0RXE7IG9mZnNldDogbnVtYmVyIH1cblx0fCB7IHR5cGU6IFRva2VuVHlwZS5HdDsgb2Zmc2V0OiBudW1iZXIgfVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLkd0RXE7IG9mZnNldDogbnVtYmVyIH1cblx0fCB7IHR5cGU6IFRva2VuVHlwZS5SZWdleE9wOyBvZmZzZXQ6IG51bWJlciB9XG5cdHwgeyB0eXBlOiBUb2tlblR5cGUuUmVnZXhTdHI7IG9mZnNldDogbnVtYmVyOyBsZXhlbWU6IHN0cmluZyB9XG5cdHwgeyB0eXBlOiBUb2tlblR5cGUuVHJ1ZTsgb2Zmc2V0OiBudW1iZXIgfVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLkZhbHNlOyBvZmZzZXQ6IG51bWJlciB9XG5cdHwgeyB0eXBlOiBUb2tlblR5cGUuSW47IG9mZnNldDogbnVtYmVyIH1cblx0fCB7IHR5cGU6IFRva2VuVHlwZS5Ob3Q7IG9mZnNldDogbnVtYmVyIH1cblx0fCB7IHR5cGU6IFRva2VuVHlwZS5BbmQ7IG9mZnNldDogbnVtYmVyIH1cblx0fCB7IHR5cGU6IFRva2VuVHlwZS5Pcjsgb2Zmc2V0OiBudW1iZXIgfVxuXHR8IHsgdHlwZTogVG9rZW5UeXBlLlN0cjsgb2Zmc2V0OiBudW1iZXI7IGxleGVtZTogc3RyaW5nIH1cblx0fCB7IHR5cGU6IFRva2VuVHlwZS5RdW90ZWRTdHI7IG9mZnNldDogbnVtYmVyOyBsZXhlbWU6IHN0cmluZyB9XG5cdHwgeyB0eXBlOiBUb2tlblR5cGUuRXJyb3I7IG9mZnNldDogbnVtYmVyOyBsZXhlbWU6IHN0cmluZyB9XG5cdHwgeyB0eXBlOiBUb2tlblR5cGUuRU9GOyBvZmZzZXQ6IG51bWJlciB9O1xuXG50eXBlIEtleXdvcmRUb2tlblR5cGUgPSBUb2tlblR5cGUuTm90IHwgVG9rZW5UeXBlLkluIHwgVG9rZW5UeXBlLkZhbHNlIHwgVG9rZW5UeXBlLlRydWU7XG50eXBlIFRva2VuVHlwZVdpdGhvdXRMZXhlbWUgPVxuXHRUb2tlblR5cGUuTFBhcmVuIHxcblx0VG9rZW5UeXBlLlJQYXJlbiB8XG5cdFRva2VuVHlwZS5OZWcgfFxuXHRUb2tlblR5cGUuTHQgfFxuXHRUb2tlblR5cGUuTHRFcSB8XG5cdFRva2VuVHlwZS5HdCB8XG5cdFRva2VuVHlwZS5HdEVxIHxcblx0VG9rZW5UeXBlLlJlZ2V4T3AgfFxuXHRUb2tlblR5cGUuVHJ1ZSB8XG5cdFRva2VuVHlwZS5GYWxzZSB8XG5cdFRva2VuVHlwZS5JbiB8XG5cdFRva2VuVHlwZS5Ob3QgfFxuXHRUb2tlblR5cGUuQW5kIHxcblx0VG9rZW5UeXBlLk9yIHxcblx0VG9rZW5UeXBlLkVPRjtcblxuLyoqXG4gKiBFeGFtcGxlOlxuICogYGZvbyA9PSBiYXInYCAtIG5vdGUgaG93IHNpbmdsZSBxdW90ZSBkb2Vzbid0IGhhdmUgYSBjb3JyZXNwb25kaW5nIGNsb3NpbmcgcXVvdGUsXG4gKiBzbyBpdCdzIHJlcG9ydGVkIGFzIHVuZXhwZWN0ZWRcbiAqL1xuZXhwb3J0IHR5cGUgTGV4aW5nRXJyb3IgPSB7XG5cdG9mZnNldDogbnVtYmVyOyAvKiogbm90ZSB0aGF0IHRoaXMgZG9lc24ndCB0YWtlIGludG8gYWNjb3VudCBlc2NhcGUgY2hhcmFjdGVycyBmcm9tIHRoZSBvcmlnaW5hbCBlbmNvZGluZyBvZiB0aGUgc3RyaW5nLCBlLmcuLCB3aXRoaW4gYW4gZXh0ZW5zaW9uIG1hbmlmZXN0IGZpbGUncyBKU09OIGVuY29kaW5nICAqL1xuXHRsZXhlbWU6IHN0cmluZztcblx0YWRkaXRpb25hbEluZm8/OiBzdHJpbmc7XG59O1xuXG5mdW5jdGlvbiBoaW50RGlkWW91TWVhbiguLi5tZWFudDogc3RyaW5nW10pIHtcblx0c3dpdGNoIChtZWFudC5sZW5ndGgpIHtcblx0XHRjYXNlIDE6XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2NvbnRleHRrZXkuc2Nhbm5lci5oaW50LmRpZFlvdU1lYW4xJywgXCJEaWQgeW91IG1lYW4gezB9P1wiLCBtZWFudFswXSk7XG5cdFx0Y2FzZSAyOlxuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdjb250ZXh0a2V5LnNjYW5uZXIuaGludC5kaWRZb3VNZWFuMicsIFwiRGlkIHlvdSBtZWFuIHswfSBvciB7MX0/XCIsIG1lYW50WzBdLCBtZWFudFsxXSk7XG5cdFx0Y2FzZSAzOlxuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdjb250ZXh0a2V5LnNjYW5uZXIuaGludC5kaWRZb3VNZWFuMycsIFwiRGlkIHlvdSBtZWFuIHswfSwgezF9IG9yIHsyfT9cIiwgbWVhbnRbMF0sIG1lYW50WzFdLCBtZWFudFsyXSk7XG5cdFx0ZGVmYXVsdDogLy8gd2UganVzdCBkb24ndCBleHBlY3QgdGhhdCBtYW55XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmNvbnN0IGhpbnREaWRZb3VGb3JnZXRUb09wZW5PckNsb3NlUXVvdGUgPSBsb2NhbGl6ZSgnY29udGV4dGtleS5zY2FubmVyLmhpbnQuZGlkWW91Rm9yZ2V0VG9PcGVuT3JDbG9zZVF1b3RlJywgXCJEaWQgeW91IGZvcmdldCB0byBvcGVuIG9yIGNsb3NlIHRoZSBxdW90ZT9cIik7XG5jb25zdCBoaW50RGlkWW91Rm9yZ2V0VG9Fc2NhcGVTbGFzaCA9IGxvY2FsaXplKCdjb250ZXh0a2V5LnNjYW5uZXIuaGludC5kaWRZb3VGb3JnZXRUb0VzY2FwZVNsYXNoJywgXCJEaWQgeW91IGZvcmdldCB0byBlc2NhcGUgdGhlICcvJyAoc2xhc2gpIGNoYXJhY3Rlcj8gUHV0IHR3byBiYWNrc2xhc2hlcyBiZWZvcmUgaXQgdG8gZXNjYXBlLCBlLmcuLCAnXFxcXFxcXFwvXFwnLlwiKTtcblxuLyoqXG4gKiBBIHNpbXBsZSBzY2FubmVyIGZvciBjb250ZXh0IGtleXMuXG4gKlxuICogRXhhbXBsZTpcbiAqXG4gKiBgYGB0c1xuICogY29uc3Qgc2Nhbm5lciA9IG5ldyBTY2FubmVyKCkucmVzZXQoJ3Jlc291cmNlRmlsZU5hbWUgPX4gL2RvY2tlci8gJiYgIWNvbmZpZy5kb2NrZXIuZW5hYmxlZCcpO1xuICogY29uc3QgdG9rZW5zID0gWy4uLnNjYW5uZXJdO1xuICogaWYgKHNjYW5uZXIuZXJyb3JUb2tlbnMubGVuZ3RoID4gMCkge1xuICogICAgIHNjYW5uZXIuZXJyb3JUb2tlbnMuZm9yRWFjaChlcnIgPT4gY29uc29sZS5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiBhdCAke2Vyci5vZmZzZXR9OiAke2Vyci5sZXhlbWV9XFxuSGludDogJHtlcnIuYWRkaXRpb25hbH1gKSk7XG4gKiB9IGVsc2Uge1xuICogICAgIC8vIHByb2Nlc3MgdG9rZW5zXG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFNjYW5uZXIge1xuXG5cdHN0YXRpYyBnZXRMZXhlbWUodG9rZW46IFRva2VuKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHRva2VuLnR5cGUpIHtcblx0XHRcdGNhc2UgVG9rZW5UeXBlLkxQYXJlbjpcblx0XHRcdFx0cmV0dXJuICcoJztcblx0XHRcdGNhc2UgVG9rZW5UeXBlLlJQYXJlbjpcblx0XHRcdFx0cmV0dXJuICcpJztcblx0XHRcdGNhc2UgVG9rZW5UeXBlLk5lZzpcblx0XHRcdFx0cmV0dXJuICchJztcblx0XHRcdGNhc2UgVG9rZW5UeXBlLkVxOlxuXHRcdFx0XHRyZXR1cm4gdG9rZW4uaXNUcmlwbGVFcSA/ICc9PT0nIDogJz09Jztcblx0XHRcdGNhc2UgVG9rZW5UeXBlLk5vdEVxOlxuXHRcdFx0XHRyZXR1cm4gdG9rZW4uaXNUcmlwbGVFcSA/ICchPT0nIDogJyE9Jztcblx0XHRcdGNhc2UgVG9rZW5UeXBlLkx0OlxuXHRcdFx0XHRyZXR1cm4gJzwnO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuTHRFcTpcblx0XHRcdFx0cmV0dXJuICc8PSc7XG5cdFx0XHRjYXNlIFRva2VuVHlwZS5HdDpcblx0XHRcdFx0cmV0dXJuICc+PSc7XG5cdFx0XHRjYXNlIFRva2VuVHlwZS5HdEVxOlxuXHRcdFx0XHRyZXR1cm4gJz49Jztcblx0XHRcdGNhc2UgVG9rZW5UeXBlLlJlZ2V4T3A6XG5cdFx0XHRcdHJldHVybiAnPX4nO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuUmVnZXhTdHI6XG5cdFx0XHRcdHJldHVybiB0b2tlbi5sZXhlbWU7XG5cdFx0XHRjYXNlIFRva2VuVHlwZS5UcnVlOlxuXHRcdFx0XHRyZXR1cm4gJ3RydWUnO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuRmFsc2U6XG5cdFx0XHRcdHJldHVybiAnZmFsc2UnO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuSW46XG5cdFx0XHRcdHJldHVybiAnaW4nO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuTm90OlxuXHRcdFx0XHRyZXR1cm4gJ25vdCc7XG5cdFx0XHRjYXNlIFRva2VuVHlwZS5BbmQ6XG5cdFx0XHRcdHJldHVybiAnJiYnO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuT3I6XG5cdFx0XHRcdHJldHVybiAnfHwnO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuU3RyOlxuXHRcdFx0XHRyZXR1cm4gdG9rZW4ubGV4ZW1lO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuUXVvdGVkU3RyOlxuXHRcdFx0XHRyZXR1cm4gdG9rZW4ubGV4ZW1lO1xuXHRcdFx0Y2FzZSBUb2tlblR5cGUuRXJyb3I6XG5cdFx0XHRcdHJldHVybiB0b2tlbi5sZXhlbWU7XG5cdFx0XHRjYXNlIFRva2VuVHlwZS5FT0Y6XG5cdFx0XHRcdHJldHVybiAnRU9GJztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IGlsbGVnYWxTdGF0ZShgdW5oYW5kbGVkIHRva2VuIHR5cGU6ICR7SlNPTi5zdHJpbmdpZnkodG9rZW4pfTsgaGF2ZSB5b3UgZm9yZ290dGVuIHRvIGFkZCBhIGNhc2U/YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3JlZ2V4RmxhZ3MgPSBuZXcgU2V0KFsnaScsICdnJywgJ3MnLCAnbScsICd5JywgJ3UnXS5tYXAoY2ggPT4gY2guY2hhckNvZGVBdCgwKSkpO1xuXG5cdHByaXZhdGUgc3RhdGljIF9rZXl3b3JkcyA9IG5ldyBNYXA8c3RyaW5nLCBLZXl3b3JkVG9rZW5UeXBlPihbXG5cdFx0Wydub3QnLCBUb2tlblR5cGUuTm90XSxcblx0XHRbJ2luJywgVG9rZW5UeXBlLkluXSxcblx0XHRbJ2ZhbHNlJywgVG9rZW5UeXBlLkZhbHNlXSxcblx0XHRbJ3RydWUnLCBUb2tlblR5cGUuVHJ1ZV0sXG5cdF0pO1xuXG5cdHByaXZhdGUgX2lucHV0OiBzdHJpbmcgPSAnJztcblx0cHJpdmF0ZSBfc3RhcnQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX2N1cnJlbnQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX3Rva2VuczogVG9rZW5bXSA9IFtdO1xuXHRwcml2YXRlIF9lcnJvcnM6IExleGluZ0Vycm9yW10gPSBbXTtcblxuXHRnZXQgZXJyb3JzKCk6IFJlYWRvbmx5PExleGluZ0Vycm9yW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fZXJyb3JzO1xuXHR9XG5cblx0cmVzZXQodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuX2lucHV0ID0gdmFsdWU7XG5cblx0XHR0aGlzLl9zdGFydCA9IDA7XG5cdFx0dGhpcy5fY3VycmVudCA9IDA7XG5cdFx0dGhpcy5fdG9rZW5zID0gW107XG5cdFx0dGhpcy5fZXJyb3JzID0gW107XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHNjYW4oKSB7XG5cdFx0d2hpbGUgKCF0aGlzLl9pc0F0RW5kKCkpIHtcblxuXHRcdFx0dGhpcy5fc3RhcnQgPSB0aGlzLl9jdXJyZW50O1xuXG5cdFx0XHRjb25zdCBjaCA9IHRoaXMuX2FkdmFuY2UoKTtcblx0XHRcdHN3aXRjaCAoY2gpIHtcblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5PcGVuUGFyZW46IHRoaXMuX2FkZFRva2VuKFRva2VuVHlwZS5MUGFyZW4pOyBicmVhaztcblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5DbG9zZVBhcmVuOiB0aGlzLl9hZGRUb2tlbihUb2tlblR5cGUuUlBhcmVuKTsgYnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5FeGNsYW1hdGlvbk1hcms6XG5cdFx0XHRcdFx0aWYgKHRoaXMuX21hdGNoKENoYXJDb2RlLkVxdWFscykpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGlzVHJpcGxlRXEgPSB0aGlzLl9tYXRjaChDaGFyQ29kZS5FcXVhbHMpOyAvLyBlYXQgbGFzdCBgPWAgaWYgYCE9PWBcblx0XHRcdFx0XHRcdHRoaXMuX3Rva2Vucy5wdXNoKHsgdHlwZTogVG9rZW5UeXBlLk5vdEVxLCBvZmZzZXQ6IHRoaXMuX3N0YXJ0LCBpc1RyaXBsZUVxIH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9hZGRUb2tlbihUb2tlblR5cGUuTmVnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5TaW5nbGVRdW90ZTogdGhpcy5fcXVvdGVkU3RyaW5nKCk7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIENoYXJDb2RlLlNsYXNoOiB0aGlzLl9yZWdleCgpOyBicmVhaztcblxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLkVxdWFsczpcblx0XHRcdFx0XHRpZiAodGhpcy5fbWF0Y2goQ2hhckNvZGUuRXF1YWxzKSkgeyAvLyBzdXBwb3J0IGA9PWBcblx0XHRcdFx0XHRcdGNvbnN0IGlzVHJpcGxlRXEgPSB0aGlzLl9tYXRjaChDaGFyQ29kZS5FcXVhbHMpOyAvLyBlYXQgbGFzdCBgPWAgaWYgYD09PWBcblx0XHRcdFx0XHRcdHRoaXMuX3Rva2Vucy5wdXNoKHsgdHlwZTogVG9rZW5UeXBlLkVxLCBvZmZzZXQ6IHRoaXMuX3N0YXJ0LCBpc1RyaXBsZUVxIH0pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5fbWF0Y2goQ2hhckNvZGUuVGlsZGUpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9hZGRUb2tlbihUb2tlblR5cGUuUmVnZXhPcCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX2Vycm9yKGhpbnREaWRZb3VNZWFuKCc9PScsICc9ficpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5MZXNzVGhhbjogdGhpcy5fYWRkVG9rZW4odGhpcy5fbWF0Y2goQ2hhckNvZGUuRXF1YWxzKSA/IFRva2VuVHlwZS5MdEVxIDogVG9rZW5UeXBlLkx0KTsgYnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5HcmVhdGVyVGhhbjogdGhpcy5fYWRkVG9rZW4odGhpcy5fbWF0Y2goQ2hhckNvZGUuRXF1YWxzKSA/IFRva2VuVHlwZS5HdEVxIDogVG9rZW5UeXBlLkd0KTsgYnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5BbXBlcnNhbmQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMuX21hdGNoKENoYXJDb2RlLkFtcGVyc2FuZCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2FkZFRva2VuKFRva2VuVHlwZS5BbmQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9lcnJvcihoaW50RGlkWW91TWVhbignJiYnKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2UgQ2hhckNvZGUuUGlwZTpcblx0XHRcdFx0XHRpZiAodGhpcy5fbWF0Y2goQ2hhckNvZGUuUGlwZSkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2FkZFRva2VuKFRva2VuVHlwZS5Pcik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX2Vycm9yKGhpbnREaWRZb3VNZWFuKCd8fCcpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Ly8gVE9ET0B1bHVnYmVrbmE6IDEpIHJld3JpdGUgdXNpbmcgYSByZWdleCAyKSByZWNvbnNpZGVyIHdoYXQgY2hhcmFjdGVycyBhcmUgY29uc2lkZXJlZCB3aGl0ZXNwYWNlLCBpbmNsdWRpbmcgdW5pY29kZSwgbmJzcCwgZXRjLlxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLlNwYWNlOlxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLkNhcnJpYWdlUmV0dXJuOlxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLlRhYjpcblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5MaW5lRmVlZDpcblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5Ob0JyZWFrU3BhY2U6IC8vICZuYnNwXG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHR0aGlzLl9zdHJpbmcoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9zdGFydCA9IHRoaXMuX2N1cnJlbnQ7XG5cdFx0dGhpcy5fYWRkVG9rZW4oVG9rZW5UeXBlLkVPRik7XG5cblx0XHRyZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl90b2tlbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbWF0Y2goZXhwZWN0ZWQ6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9pc0F0RW5kKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2lucHV0LmNoYXJDb2RlQXQodGhpcy5fY3VycmVudCkgIT09IGV4cGVjdGVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMuX2N1cnJlbnQrKztcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2FkdmFuY2UoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5faW5wdXQuY2hhckNvZGVBdCh0aGlzLl9jdXJyZW50KyspO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGVlaygpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9pc0F0RW5kKCkgPyBDaGFyQ29kZS5OdWxsIDogdGhpcy5faW5wdXQuY2hhckNvZGVBdCh0aGlzLl9jdXJyZW50KTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZFRva2VuKHR5cGU6IFRva2VuVHlwZVdpdGhvdXRMZXhlbWUpIHtcblx0XHR0aGlzLl90b2tlbnMucHVzaCh7IHR5cGUsIG9mZnNldDogdGhpcy5fc3RhcnQgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9lcnJvcihhZGRpdGlvbmFsPzogc3RyaW5nKSB7XG5cdFx0Y29uc3Qgb2Zmc2V0ID0gdGhpcy5fc3RhcnQ7XG5cdFx0Y29uc3QgbGV4ZW1lID0gdGhpcy5faW5wdXQuc3Vic3RyaW5nKHRoaXMuX3N0YXJ0LCB0aGlzLl9jdXJyZW50KTtcblx0XHRjb25zdCBlcnJUb2tlbjogVG9rZW4gPSB7IHR5cGU6IFRva2VuVHlwZS5FcnJvciwgb2Zmc2V0OiB0aGlzLl9zdGFydCwgbGV4ZW1lIH07XG5cdFx0dGhpcy5fZXJyb3JzLnB1c2goeyBvZmZzZXQsIGxleGVtZSwgYWRkaXRpb25hbEluZm86IGFkZGl0aW9uYWwgfSk7XG5cdFx0dGhpcy5fdG9rZW5zLnB1c2goZXJyVG9rZW4pO1xuXHR9XG5cblx0Ly8gdSAtIHVuaWNvZGUsIHkgLSBzdGlja3kgLy8gVE9ET0B1bHVnYmVrbmE6IHdlIGFjY2VwdCBkb3VibGUgcXVvdGVzIGFzIHBhcnQgb2YgdGhlIHN0cmluZyByYXRoZXIgdGhhbiBhcyBhIGRlbGltaXRlciAodG8gcHJlc2VydmUgb2xkIHBhcnNlcidzIGJlaGF2aW9yKVxuXHRwcml2YXRlIHN0cmluZ1JlID0gL1thLXpBLVowLTlfPD5cXC1cXC4vXFxcXDpcXCpcXD9cXCtcXFtcXF1cXF4sI0A7XCIlXFwkXFxwe0x9LV0rL3V5O1xuXHRwcml2YXRlIF9zdHJpbmcoKSB7XG5cdFx0dGhpcy5zdHJpbmdSZS5sYXN0SW5kZXggPSB0aGlzLl9zdGFydDtcblx0XHRjb25zdCBtYXRjaCA9IHRoaXMuc3RyaW5nUmUuZXhlYyh0aGlzLl9pbnB1dCk7XG5cdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50ID0gdGhpcy5fc3RhcnQgKyBtYXRjaFswXS5sZW5ndGg7XG5cdFx0XHRjb25zdCBsZXhlbWUgPSB0aGlzLl9pbnB1dC5zdWJzdHJpbmcodGhpcy5fc3RhcnQsIHRoaXMuX2N1cnJlbnQpO1xuXHRcdFx0Y29uc3Qga2V5d29yZCA9IFNjYW5uZXIuX2tleXdvcmRzLmdldChsZXhlbWUpO1xuXHRcdFx0aWYgKGtleXdvcmQpIHtcblx0XHRcdFx0dGhpcy5fYWRkVG9rZW4oa2V5d29yZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl90b2tlbnMucHVzaCh7IHR5cGU6IFRva2VuVHlwZS5TdHIsIGxleGVtZSwgb2Zmc2V0OiB0aGlzLl9zdGFydCB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBjYXB0dXJlcyB0aGUgbGV4ZW1lIHdpdGhvdXQgdGhlIGxlYWRpbmcgYW5kIHRyYWlsaW5nICdcblx0cHJpdmF0ZSBfcXVvdGVkU3RyaW5nKCkge1xuXHRcdHdoaWxlICh0aGlzLl9wZWVrKCkgIT09IENoYXJDb2RlLlNpbmdsZVF1b3RlICYmICF0aGlzLl9pc0F0RW5kKCkpIHsgLy8gVE9ET0B1bHVnYmVrbmE6IGFkZCBzdXBwb3J0IGZvciBlc2NhcGluZyAnID9cblx0XHRcdHRoaXMuX2FkdmFuY2UoKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5faXNBdEVuZCgpKSB7XG5cdFx0XHR0aGlzLl9lcnJvcihoaW50RGlkWW91Rm9yZ2V0VG9PcGVuT3JDbG9zZVF1b3RlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBjb25zdW1lIHRoZSBjbG9zaW5nICdcblx0XHR0aGlzLl9hZHZhbmNlKCk7XG5cblx0XHR0aGlzLl90b2tlbnMucHVzaCh7IHR5cGU6IFRva2VuVHlwZS5RdW90ZWRTdHIsIGxleGVtZTogdGhpcy5faW5wdXQuc3Vic3RyaW5nKHRoaXMuX3N0YXJ0ICsgMSwgdGhpcy5fY3VycmVudCAtIDEpLCBvZmZzZXQ6IHRoaXMuX3N0YXJ0ICsgMSB9KTtcblx0fVxuXG5cdC8qXG5cdCAqIExleGluZyBhIHJlZ2V4IGV4cHJlc3Npb246IC8uLi4vW2lnc215dV0qXG5cdCAqIEJhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9ibG9iLzkyNDdlZjExNWU2MTc4MDU5ODM3NDBiYTc5NWQ3YTgxNjRiYWJmODkvc3JjL2NvbXBpbGVyL3NjYW5uZXIudHMjTDIxMjktTDIxODFcblx0ICpcblx0ICogTm90ZSB0aGF0IHdlIHdhbnQgc2xhc2hlcyB3aXRoaW4gYSByZWdleCB0byBiZSBlc2NhcGVkLCBlLmcuLCAvZmlsZTpcXFxcL1xcXFwvXFxcXC8vIHNob3VsZCBtYXRjaCBgZmlsZTovLy9gXG5cdCAqL1xuXHRwcml2YXRlIF9yZWdleCgpIHtcblx0XHRsZXQgcCA9IHRoaXMuX2N1cnJlbnQ7XG5cblx0XHRsZXQgaW5Fc2NhcGUgPSBmYWxzZTtcblx0XHRsZXQgaW5DaGFyYWN0ZXJDbGFzcyA9IGZhbHNlO1xuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRpZiAocCA+PSB0aGlzLl9pbnB1dC5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5fY3VycmVudCA9IHA7XG5cdFx0XHRcdHRoaXMuX2Vycm9yKGhpbnREaWRZb3VGb3JnZXRUb0VzY2FwZVNsYXNoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjaCA9IHRoaXMuX2lucHV0LmNoYXJDb2RlQXQocCk7XG5cblx0XHRcdGlmIChpbkVzY2FwZSkgeyAvLyBwYXJzaW5nIGFuIGVzY2FwZSBjaGFyYWN0ZXJcblx0XHRcdFx0aW5Fc2NhcGUgPSBmYWxzZTtcblx0XHRcdH0gZWxzZSBpZiAoY2ggPT09IENoYXJDb2RlLlNsYXNoICYmICFpbkNoYXJhY3RlckNsYXNzKSB7IC8vIGVuZCBvZiByZWdleFxuXHRcdFx0XHRwKys7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fSBlbHNlIGlmIChjaCA9PT0gQ2hhckNvZGUuT3BlblNxdWFyZUJyYWNrZXQpIHtcblx0XHRcdFx0aW5DaGFyYWN0ZXJDbGFzcyA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKGNoID09PSBDaGFyQ29kZS5CYWNrc2xhc2gpIHtcblx0XHRcdFx0aW5Fc2NhcGUgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmIChjaCA9PT0gQ2hhckNvZGUuQ2xvc2VTcXVhcmVCcmFja2V0KSB7XG5cdFx0XHRcdGluQ2hhcmFjdGVyQ2xhc3MgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHArKztcblx0XHR9XG5cblx0XHQvLyBDb25zdW1lIGZsYWdzIC8vIFRPRE9AdWx1Z2Jla25hOiB1c2UgcmVnZXggaW5zdGVhZFxuXHRcdHdoaWxlIChwIDwgdGhpcy5faW5wdXQubGVuZ3RoICYmIFNjYW5uZXIuX3JlZ2V4RmxhZ3MuaGFzKHRoaXMuX2lucHV0LmNoYXJDb2RlQXQocCkpKSB7XG5cdFx0XHRwKys7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3VycmVudCA9IHA7XG5cblx0XHRjb25zdCBsZXhlbWUgPSB0aGlzLl9pbnB1dC5zdWJzdHJpbmcodGhpcy5fc3RhcnQsIHRoaXMuX2N1cnJlbnQpO1xuXHRcdHRoaXMuX3Rva2Vucy5wdXNoKHsgdHlwZTogVG9rZW5UeXBlLlJlZ2V4U3RyLCBsZXhlbWUsIG9mZnNldDogdGhpcy5fc3RhcnQgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9pc0F0RW5kKCkge1xuXHRcdHJldHVybiB0aGlzLl9jdXJyZW50ID49IHRoaXMuX2lucHV0Lmxlbmd0aDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFFbEIs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QVEsS0FBSyxPQUFPLFVBQVUsS0FBSyxTQUFTLEdBQUcsS0FBSyxXQUFXLENBQUMsR0FBRyxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7QUFBQSxFQUM1STtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBUVEsU0FBUztBQUNoQixRQUFJLElBQUksS0FBSztBQUViLFFBQUksV0FBVztBQUNmLFFBQUksbUJBQW1CO0FBQ3ZCLFdBQU8sTUFBTTtBQUNaLFVBQUksS0FBSyxLQUFLLE9BQU8sUUFBUTtBQUM1QixhQUFLLFdBQVc7QUFDaEIsYUFBSyxPQUFPLDZCQUE2QjtBQUN6QztBQUFBLE1BQ0Q7QUFFQSxZQUFNLEtBQUssS0FBSyxPQUFPLFdBQVcsQ0FBQztBQUVuQyxVQUFJLFVBQVU7QUFDYixtQkFBVztBQUFBLE1BQ1osV0FBVyxPQUFPLFNBQVMsU0FBUyxDQUFDLGtCQUFrQjtBQUN0RDtBQUNBO0FBQUEsTUFDRCxXQUFXLE9BQU8sU0FBUyxtQkFBbUI7QUFDN0MsMkJBQW1CO0FBQUEsTUFDcEIsV0FBVyxPQUFPLFNBQVMsV0FBVztBQUNyQyxtQkFBVztBQUFBLE1BQ1osV0FBVyxPQUFPLFNBQVMsb0JBQW9CO0FBQzlDLDJCQUFtQjtBQUFBLE1BQ3BCO0FBQ0E7QUFBQSxJQUNEO0FBR0EsV0FBTyxJQUFJLEtBQUssT0FBTyxVQUFVLFNBQVEsWUFBWSxJQUFJLEtBQUssT0FBTyxXQUFXLENBQUMsQ0FBQyxHQUFHO0FBQ3BGO0FBQUEsSUFDRDtBQUVBLFNBQUssV0FBVztBQUVoQixVQUFNLFNBQVMsS0FBSyxPQUFPLFVBQVUsS0FBSyxRQUFRLEtBQUssUUFBUTtBQUMvRCxTQUFLLFFBQVEsS0FBSyxFQUFFLE1BQU0sbUJBQW9CLFFBQVEsUUFBUSxLQUFLLE9BQU8sQ0FBQztBQUFBLEVBQzVFO0FBQUEsRUFFUSxXQUFXO0FBQ2xCLFdBQU8sS0FBSyxZQUFZLEtBQUssT0FBTztBQUFBLEVBQ3JDO0FBQ0Q7QUEzUWEsU0FtREcsY0FBYyxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssR0FBRyxFQUFFLElBQUksUUFBTSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFuRG5GLFNBcURHLFlBQVksb0JBQUksSUFBOEI7QUFBQSxFQUM1RCxDQUFDLE9BQU8sWUFBYTtBQUFBLEVBQ3JCLENBQUMsTUFBTSxXQUFZO0FBQUEsRUFDbkIsQ0FBQyxTQUFTLGNBQWU7QUFBQSxFQUN6QixDQUFDLFFBQVEsYUFBYztBQUN4QixDQUFDO0FBMURLLElBQU0sVUFBTjsiLAogICJuYW1lcyI6IFsiVG9rZW5UeXBlIl0KfQo=
