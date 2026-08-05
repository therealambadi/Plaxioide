import * as strings from "../../../../base/common/strings.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { buildReplaceStringWithCasePreserved } from "../../../../base/common/search.js";
class ReplacePattern {
  constructor(replaceString, arg2, arg3) {
    this._hasParameters = false;
    this._replacePattern = replaceString;
    let searchPatternInfo;
    let parseParameters;
    if (typeof arg2 === "boolean") {
      parseParameters = arg2;
      this._regExp = arg3;
    } else {
      searchPatternInfo = arg2;
      parseParameters = !!searchPatternInfo.isRegExp;
      this._regExp = strings.createRegExp(searchPatternInfo.pattern, !!searchPatternInfo.isRegExp, { matchCase: searchPatternInfo.isCaseSensitive, wholeWord: searchPatternInfo.isWordMatch, multiline: searchPatternInfo.isMultiline, global: false, unicode: true });
    }
    if (parseParameters) {
      this.parseReplaceString(replaceString);
    }
    if (this._regExp.global) {
      this._regExp = strings.createRegExp(this._regExp.source, true, { matchCase: !this._regExp.ignoreCase, wholeWord: false, multiline: this._regExp.multiline, global: false });
    }
    this._caseOpsRegExp = new RegExp(/([\s\S]*?)((?:\\[uUlL])+?|)(\$[0-9]+)([\s\S]*?)/g);
  }
  get hasParameters() {
    return this._hasParameters;
  }
  get pattern() {
    return this._replacePattern;
  }
  get regExp() {
    return this._regExp;
  }
  /**
  * Returns the replace string for the first match in the given text.
  * If text has no matches then returns null.
  */
  getReplaceString(text, preserveCase) {
    this._regExp.lastIndex = 0;
    const match = this._regExp.exec(text);
    if (match) {
      if (this.hasParameters) {
        const replaceString = this.replaceWithCaseOperations(text, this._regExp, this.buildReplaceString(match, preserveCase));
        if (match[0] === text) {
          return replaceString;
        }
        return replaceString.substr(match.index, match[0].length - (text.length - replaceString.length));
      }
      return this.buildReplaceString(match, preserveCase);
    }
    return null;
  }
  /**
   * replaceWithCaseOperations applies case operations to relevant replacement strings and applies
   * the affected $N arguments. It then passes unaffected $N arguments through to string.replace().
   *
   * \u			=> upper-cases one character in a match.
   * \U			=> upper-cases ALL remaining characters in a match.
   * \l			=> lower-cases one character in a match.
   * \L			=> lower-cases ALL remaining characters in a match.
   */
  replaceWithCaseOperations(text, regex, replaceString) {
    if (!/\\[uUlL]/.test(replaceString)) {
      return text.replace(regex, replaceString);
    }
    const firstMatch = regex.exec(text);
    if (firstMatch === null) {
      return text.replace(regex, replaceString);
    }
    let patMatch;
    let newReplaceString = "";
    let lastIndex = 0;
    let lastMatch = "";
    while ((patMatch = this._caseOpsRegExp.exec(replaceString)) !== null) {
      lastIndex = patMatch.index;
      const fullMatch = patMatch[0];
      lastMatch = fullMatch;
      let caseOps = patMatch[2];
      const money = patMatch[3];
      if (!caseOps) {
        newReplaceString += fullMatch;
        continue;
      }
      const replacement = firstMatch[parseInt(money.slice(1))];
      if (!replacement) {
        newReplaceString += fullMatch;
        continue;
      }
      const replacementLen = replacement.length;
      newReplaceString += patMatch[1];
      caseOps = caseOps.replace(/\\/g, "");
      let i = 0;
      for (; i < caseOps.length; i++) {
        switch (caseOps[i]) {
          case "U":
            newReplaceString += replacement.slice(i).toUpperCase();
            i = replacementLen;
            break;
          case "u":
            newReplaceString += replacement[i].toUpperCase();
            break;
          case "L":
            newReplaceString += replacement.slice(i).toLowerCase();
            i = replacementLen;
            break;
          case "l":
            newReplaceString += replacement[i].toLowerCase();
            break;
        }
      }
      if (i < replacementLen) {
        newReplaceString += replacement.slice(i);
      }
      newReplaceString += patMatch[4];
    }
    newReplaceString += replaceString.slice(lastIndex + lastMatch.length);
    return text.replace(regex, newReplaceString);
  }
  buildReplaceString(matches, preserveCase) {
    if (preserveCase) {
      return buildReplaceStringWithCasePreserved(matches, this._replacePattern);
    } else {
      return this._replacePattern;
    }
  }
  /**
   * \n => LF
   * \t => TAB
   * \\ => \
   * $0 => $& (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter)
   * everything else stays untouched
   */
  parseReplaceString(replaceString) {
    if (!replaceString || replaceString.length === 0) {
      return;
    }
    let substrFrom = 0, result = "";
    for (let i = 0, len = replaceString.length; i < len; i++) {
      const chCode = replaceString.charCodeAt(i);
      if (chCode === CharCode.Backslash) {
        i++;
        if (i >= len) {
          break;
        }
        const nextChCode = replaceString.charCodeAt(i);
        let replaceWithCharacter = null;
        switch (nextChCode) {
          case CharCode.Backslash:
            replaceWithCharacter = "\\";
            break;
          case CharCode.n:
            replaceWithCharacter = "\n";
            break;
          case CharCode.t:
            replaceWithCharacter = "	";
            break;
        }
        if (replaceWithCharacter) {
          result += replaceString.substring(substrFrom, i - 1) + replaceWithCharacter;
          substrFrom = i + 1;
        }
      }
      if (chCode === CharCode.DollarSign) {
        i++;
        if (i >= len) {
          break;
        }
        const nextChCode = replaceString.charCodeAt(i);
        let replaceWithCharacter = null;
        switch (nextChCode) {
          case CharCode.Digit0:
            replaceWithCharacter = "$&";
            this._hasParameters = true;
            break;
          case CharCode.BackTick:
          case CharCode.SingleQuote:
            this._hasParameters = true;
            break;
          default: {
            if (!this.between(nextChCode, CharCode.Digit1, CharCode.Digit9)) {
              break;
            }
            if (i === replaceString.length - 1) {
              this._hasParameters = true;
              break;
            }
            let charCode = replaceString.charCodeAt(++i);
            if (!this.between(charCode, CharCode.Digit0, CharCode.Digit9)) {
              this._hasParameters = true;
              --i;
              break;
            }
            if (i === replaceString.length - 1) {
              this._hasParameters = true;
              break;
            }
            charCode = replaceString.charCodeAt(++i);
            if (!this.between(charCode, CharCode.Digit0, CharCode.Digit9)) {
              this._hasParameters = true;
              --i;
              break;
            }
            break;
          }
        }
        if (replaceWithCharacter) {
          result += replaceString.substring(substrFrom, i - 1) + replaceWithCharacter;
          substrFrom = i + 1;
        }
      }
    }
    if (substrFrom === 0) {
      return;
    }
    this._replacePattern = result + replaceString.substring(substrFrom);
  }
  between(value, from, to) {
    return from <= value && value <= to;
  }
}
export {
  ReplacePattern
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2NvbW1vbi9yZXBsYWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElQYXR0ZXJuSW5mbyB9IGZyb20gJy4vc2VhcmNoLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgYnVpbGRSZXBsYWNlU3RyaW5nV2l0aENhc2VQcmVzZXJ2ZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZWFyY2guanMnO1xuXG5leHBvcnQgY2xhc3MgUmVwbGFjZVBhdHRlcm4ge1xuXG5cdHByaXZhdGUgX3JlcGxhY2VQYXR0ZXJuOiBzdHJpbmc7XG5cdHByaXZhdGUgX2hhc1BhcmFtZXRlcnM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfcmVnRXhwOiBSZWdFeHA7XG5cdHByaXZhdGUgX2Nhc2VPcHNSZWdFeHA6IFJlZ0V4cDtcblxuXHRjb25zdHJ1Y3RvcihyZXBsYWNlU3RyaW5nOiBzdHJpbmcsIHNlYXJjaFBhdHRlcm5JbmZvOiBJUGF0dGVybkluZm8pO1xuXHRjb25zdHJ1Y3RvcihyZXBsYWNlU3RyaW5nOiBzdHJpbmcsIHBhcnNlUGFyYW1ldGVyczogYm9vbGVhbiwgcmVnRXg6IFJlZ0V4cCk7XG5cdGNvbnN0cnVjdG9yKHJlcGxhY2VTdHJpbmc6IHN0cmluZywgYXJnMjogYW55LCBhcmczPzogYW55KSB7XG5cdFx0dGhpcy5fcmVwbGFjZVBhdHRlcm4gPSByZXBsYWNlU3RyaW5nO1xuXHRcdGxldCBzZWFyY2hQYXR0ZXJuSW5mbzogSVBhdHRlcm5JbmZvO1xuXHRcdGxldCBwYXJzZVBhcmFtZXRlcnM6IGJvb2xlYW47XG5cdFx0aWYgKHR5cGVvZiBhcmcyID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHBhcnNlUGFyYW1ldGVycyA9IGFyZzI7XG5cdFx0XHR0aGlzLl9yZWdFeHAgPSBhcmczO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlYXJjaFBhdHRlcm5JbmZvID0gYXJnMjtcblx0XHRcdHBhcnNlUGFyYW1ldGVycyA9ICEhc2VhcmNoUGF0dGVybkluZm8uaXNSZWdFeHA7XG5cdFx0XHR0aGlzLl9yZWdFeHAgPSBzdHJpbmdzLmNyZWF0ZVJlZ0V4cChzZWFyY2hQYXR0ZXJuSW5mby5wYXR0ZXJuLCAhIXNlYXJjaFBhdHRlcm5JbmZvLmlzUmVnRXhwLCB7IG1hdGNoQ2FzZTogc2VhcmNoUGF0dGVybkluZm8uaXNDYXNlU2Vuc2l0aXZlLCB3aG9sZVdvcmQ6IHNlYXJjaFBhdHRlcm5JbmZvLmlzV29yZE1hdGNoLCBtdWx0aWxpbmU6IHNlYXJjaFBhdHRlcm5JbmZvLmlzTXVsdGlsaW5lLCBnbG9iYWw6IGZhbHNlLCB1bmljb2RlOiB0cnVlIH0pO1xuXHRcdH1cblxuXHRcdGlmIChwYXJzZVBhcmFtZXRlcnMpIHtcblx0XHRcdHRoaXMucGFyc2VSZXBsYWNlU3RyaW5nKHJlcGxhY2VTdHJpbmcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9yZWdFeHAuZ2xvYmFsKSB7XG5cdFx0XHR0aGlzLl9yZWdFeHAgPSBzdHJpbmdzLmNyZWF0ZVJlZ0V4cCh0aGlzLl9yZWdFeHAuc291cmNlLCB0cnVlLCB7IG1hdGNoQ2FzZTogIXRoaXMuX3JlZ0V4cC5pZ25vcmVDYXNlLCB3aG9sZVdvcmQ6IGZhbHNlLCBtdWx0aWxpbmU6IHRoaXMuX3JlZ0V4cC5tdWx0aWxpbmUsIGdsb2JhbDogZmFsc2UgfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY2FzZU9wc1JlZ0V4cCA9IG5ldyBSZWdFeHAoLyhbXFxzXFxTXSo/KSgoPzpcXFxcW3VVbExdKSs/fCkoXFwkWzAtOV0rKShbXFxzXFxTXSo/KS9nKTtcblx0fVxuXG5cdGdldCBoYXNQYXJhbWV0ZXJzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9oYXNQYXJhbWV0ZXJzO1xuXHR9XG5cblx0Z2V0IHBhdHRlcm4oKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVwbGFjZVBhdHRlcm47XG5cdH1cblxuXHRnZXQgcmVnRXhwKCk6IFJlZ0V4cCB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlZ0V4cDtcblx0fVxuXG5cdC8qKlxuXHQqIFJldHVybnMgdGhlIHJlcGxhY2Ugc3RyaW5nIGZvciB0aGUgZmlyc3QgbWF0Y2ggaW4gdGhlIGdpdmVuIHRleHQuXG5cdCogSWYgdGV4dCBoYXMgbm8gbWF0Y2hlcyB0aGVuIHJldHVybnMgbnVsbC5cblx0Ki9cblx0Z2V0UmVwbGFjZVN0cmluZyh0ZXh0OiBzdHJpbmcsIHByZXNlcnZlQ2FzZT86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcblx0XHR0aGlzLl9yZWdFeHAubGFzdEluZGV4ID0gMDtcblx0XHRjb25zdCBtYXRjaCA9IHRoaXMuX3JlZ0V4cC5leGVjKHRleHQpO1xuXHRcdGlmIChtYXRjaCkge1xuXHRcdFx0aWYgKHRoaXMuaGFzUGFyYW1ldGVycykge1xuXHRcdFx0XHRjb25zdCByZXBsYWNlU3RyaW5nID0gdGhpcy5yZXBsYWNlV2l0aENhc2VPcGVyYXRpb25zKHRleHQsIHRoaXMuX3JlZ0V4cCwgdGhpcy5idWlsZFJlcGxhY2VTdHJpbmcobWF0Y2gsIHByZXNlcnZlQ2FzZSkpO1xuXHRcdFx0XHRpZiAobWF0Y2hbMF0gPT09IHRleHQpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVwbGFjZVN0cmluZztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVwbGFjZVN0cmluZy5zdWJzdHIobWF0Y2guaW5kZXgsIG1hdGNoWzBdLmxlbmd0aCAtICh0ZXh0Lmxlbmd0aCAtIHJlcGxhY2VTdHJpbmcubGVuZ3RoKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5idWlsZFJlcGxhY2VTdHJpbmcobWF0Y2gsIHByZXNlcnZlQ2FzZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogcmVwbGFjZVdpdGhDYXNlT3BlcmF0aW9ucyBhcHBsaWVzIGNhc2Ugb3BlcmF0aW9ucyB0byByZWxldmFudCByZXBsYWNlbWVudCBzdHJpbmdzIGFuZCBhcHBsaWVzXG5cdCAqIHRoZSBhZmZlY3RlZCAkTiBhcmd1bWVudHMuIEl0IHRoZW4gcGFzc2VzIHVuYWZmZWN0ZWQgJE4gYXJndW1lbnRzIHRocm91Z2ggdG8gc3RyaW5nLnJlcGxhY2UoKS5cblx0ICpcblx0ICogXFx1XHRcdFx0PT4gdXBwZXItY2FzZXMgb25lIGNoYXJhY3RlciBpbiBhIG1hdGNoLlxuXHQgKiBcXFVcdFx0XHQ9PiB1cHBlci1jYXNlcyBBTEwgcmVtYWluaW5nIGNoYXJhY3RlcnMgaW4gYSBtYXRjaC5cblx0ICogXFxsXHRcdFx0PT4gbG93ZXItY2FzZXMgb25lIGNoYXJhY3RlciBpbiBhIG1hdGNoLlxuXHQgKiBcXExcdFx0XHQ9PiBsb3dlci1jYXNlcyBBTEwgcmVtYWluaW5nIGNoYXJhY3RlcnMgaW4gYSBtYXRjaC5cblx0ICovXG5cdHByaXZhdGUgcmVwbGFjZVdpdGhDYXNlT3BlcmF0aW9ucyh0ZXh0OiBzdHJpbmcsIHJlZ2V4OiBSZWdFeHAsIHJlcGxhY2VTdHJpbmc6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Ly8gU2hvcnQtY2lyY3VpdCB0aGUgY29tbW9uIHBhdGguXG5cdFx0aWYgKCEvXFxcXFt1VWxMXS8udGVzdChyZXBsYWNlU3RyaW5nKSkge1xuXHRcdFx0cmV0dXJuIHRleHQucmVwbGFjZShyZWdleCwgcmVwbGFjZVN0cmluZyk7XG5cdFx0fVxuXHRcdC8vIFN0b3JlIHRoZSB2YWx1ZXMgb2YgdGhlIHNlYXJjaCBwYXJhbWV0ZXJzLlxuXHRcdGNvbnN0IGZpcnN0TWF0Y2ggPSByZWdleC5leGVjKHRleHQpO1xuXHRcdGlmIChmaXJzdE1hdGNoID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdGV4dC5yZXBsYWNlKHJlZ2V4LCByZXBsYWNlU3RyaW5nKTtcblx0XHR9XG5cblx0XHRsZXQgcGF0TWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG5cdFx0bGV0IG5ld1JlcGxhY2VTdHJpbmcgPSAnJztcblx0XHRsZXQgbGFzdEluZGV4ID0gMDtcblx0XHRsZXQgbGFzdE1hdGNoID0gJyc7XG5cdFx0Ly8gRm9yIGVhY2ggYW5ub3RhdGVkICROLCBwZXJmb3JtIHRleHQgcHJvY2Vzc2luZyBvbiB0aGUgcGFyYW1ldGVycyBhbmQgcGVyZm9ybSB0aGUgc3Vic3RpdHV0aW9uLlxuXHRcdHdoaWxlICgocGF0TWF0Y2ggPSB0aGlzLl9jYXNlT3BzUmVnRXhwLmV4ZWMocmVwbGFjZVN0cmluZykpICE9PSBudWxsKSB7XG5cdFx0XHRsYXN0SW5kZXggPSBwYXRNYXRjaC5pbmRleDtcblx0XHRcdGNvbnN0IGZ1bGxNYXRjaCA9IHBhdE1hdGNoWzBdO1xuXHRcdFx0bGFzdE1hdGNoID0gZnVsbE1hdGNoO1xuXHRcdFx0bGV0IGNhc2VPcHMgPSBwYXRNYXRjaFsyXTsgLy8gXFx1LCBcXGxcXHUsIGV0Yy5cblx0XHRcdGNvbnN0IG1vbmV5ID0gcGF0TWF0Y2hbM107IC8vICQxLCAkMiwgZXRjLlxuXG5cdFx0XHRpZiAoIWNhc2VPcHMpIHtcblx0XHRcdFx0bmV3UmVwbGFjZVN0cmluZyArPSBmdWxsTWF0Y2g7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVwbGFjZW1lbnQgPSBmaXJzdE1hdGNoW3BhcnNlSW50KG1vbmV5LnNsaWNlKDEpKV07XG5cdFx0XHRpZiAoIXJlcGxhY2VtZW50KSB7XG5cdFx0XHRcdG5ld1JlcGxhY2VTdHJpbmcgKz0gZnVsbE1hdGNoO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlcGxhY2VtZW50TGVuID0gcmVwbGFjZW1lbnQubGVuZ3RoO1xuXG5cdFx0XHRuZXdSZXBsYWNlU3RyaW5nICs9IHBhdE1hdGNoWzFdOyAvLyBwcmVmaXhcblx0XHRcdGNhc2VPcHMgPSBjYXNlT3BzLnJlcGxhY2UoL1xcXFwvZywgJycpO1xuXHRcdFx0bGV0IGkgPSAwO1xuXHRcdFx0Zm9yICg7IGkgPCBjYXNlT3BzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHN3aXRjaCAoY2FzZU9wc1tpXSkge1xuXHRcdFx0XHRcdGNhc2UgJ1UnOlxuXHRcdFx0XHRcdFx0bmV3UmVwbGFjZVN0cmluZyArPSByZXBsYWNlbWVudC5zbGljZShpKS50b1VwcGVyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0aSA9IHJlcGxhY2VtZW50TGVuO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAndSc6XG5cdFx0XHRcdFx0XHRuZXdSZXBsYWNlU3RyaW5nICs9IHJlcGxhY2VtZW50W2ldLnRvVXBwZXJDYXNlKCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdMJzpcblx0XHRcdFx0XHRcdG5ld1JlcGxhY2VTdHJpbmcgKz0gcmVwbGFjZW1lbnQuc2xpY2UoaSkudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRcdGkgPSByZXBsYWNlbWVudExlbjtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ2wnOlxuXHRcdFx0XHRcdFx0bmV3UmVwbGFjZVN0cmluZyArPSByZXBsYWNlbWVudFtpXS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIEFwcGVuZCBhbnkgcmVtYWluaW5nIHJlcGxhY2VtZW50IHN0cmluZyBjb250ZW50IG5vdCBjb3ZlcmVkIGJ5IGNhc2Ugb3BlcmF0aW9ucy5cblx0XHRcdGlmIChpIDwgcmVwbGFjZW1lbnRMZW4pIHtcblx0XHRcdFx0bmV3UmVwbGFjZVN0cmluZyArPSByZXBsYWNlbWVudC5zbGljZShpKTtcblx0XHRcdH1cblxuXHRcdFx0bmV3UmVwbGFjZVN0cmluZyArPSBwYXRNYXRjaFs0XTsgLy8gc3VmZml4XG5cdFx0fVxuXG5cdFx0Ly8gQXBwZW5kIGFueSByZW1haW5pbmcgdHJhaWxpbmcgY29udGVudCBhZnRlciB0aGUgZmluYWwgcmVnZXggbWF0Y2guXG5cdFx0bmV3UmVwbGFjZVN0cmluZyArPSByZXBsYWNlU3RyaW5nLnNsaWNlKGxhc3RJbmRleCArIGxhc3RNYXRjaC5sZW5ndGgpO1xuXG5cdFx0cmV0dXJuIHRleHQucmVwbGFjZShyZWdleCwgbmV3UmVwbGFjZVN0cmluZyk7XG5cdH1cblxuXHRwdWJsaWMgYnVpbGRSZXBsYWNlU3RyaW5nKG1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCwgcHJlc2VydmVDYXNlPzogYm9vbGVhbik6IHN0cmluZyB7XG5cdFx0aWYgKHByZXNlcnZlQ2FzZSkge1xuXHRcdFx0cmV0dXJuIGJ1aWxkUmVwbGFjZVN0cmluZ1dpdGhDYXNlUHJlc2VydmVkKG1hdGNoZXMsIHRoaXMuX3JlcGxhY2VQYXR0ZXJuKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3JlcGxhY2VQYXR0ZXJuO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBcXG4gPT4gTEZcblx0ICogXFx0ID0+IFRBQlxuXHQgKiBcXFxcID0+IFxcXG5cdCAqICQwID0+ICQmIChzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvU3RyaW5nL3JlcGxhY2UjU3BlY2lmeWluZ19hX3N0cmluZ19hc19hX3BhcmFtZXRlcilcblx0ICogZXZlcnl0aGluZyBlbHNlIHN0YXlzIHVudG91Y2hlZFxuXHQgKi9cblx0cHJpdmF0ZSBwYXJzZVJlcGxhY2VTdHJpbmcocmVwbGFjZVN0cmluZzogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCFyZXBsYWNlU3RyaW5nIHx8IHJlcGxhY2VTdHJpbmcubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHN1YnN0ckZyb20gPSAwLCByZXN1bHQgPSAnJztcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcmVwbGFjZVN0cmluZy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgY2hDb2RlID0gcmVwbGFjZVN0cmluZy5jaGFyQ29kZUF0KGkpO1xuXG5cdFx0XHRpZiAoY2hDb2RlID09PSBDaGFyQ29kZS5CYWNrc2xhc2gpIHtcblxuXHRcdFx0XHQvLyBtb3ZlIHRvIG5leHQgY2hhclxuXHRcdFx0XHRpKys7XG5cblx0XHRcdFx0aWYgKGkgPj0gbGVuKSB7XG5cdFx0XHRcdFx0Ly8gc3RyaW5nIGVuZHMgd2l0aCBhIFxcXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBuZXh0Q2hDb2RlID0gcmVwbGFjZVN0cmluZy5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0XHRsZXQgcmVwbGFjZVdpdGhDaGFyYWN0ZXI6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG5cdFx0XHRcdHN3aXRjaCAobmV4dENoQ29kZSkge1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuQmFja3NsYXNoOlxuXHRcdFx0XHRcdFx0Ly8gXFxcXCA9PiBcXFxuXHRcdFx0XHRcdFx0cmVwbGFjZVdpdGhDaGFyYWN0ZXIgPSAnXFxcXCc7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLm46XG5cdFx0XHRcdFx0XHQvLyBcXG4gPT4gTEZcblx0XHRcdFx0XHRcdHJlcGxhY2VXaXRoQ2hhcmFjdGVyID0gJ1xcbic7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLnQ6XG5cdFx0XHRcdFx0XHQvLyBcXHQgPT4gVEFCXG5cdFx0XHRcdFx0XHRyZXBsYWNlV2l0aENoYXJhY3RlciA9ICdcXHQnO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocmVwbGFjZVdpdGhDaGFyYWN0ZXIpIHtcblx0XHRcdFx0XHRyZXN1bHQgKz0gcmVwbGFjZVN0cmluZy5zdWJzdHJpbmcoc3Vic3RyRnJvbSwgaSAtIDEpICsgcmVwbGFjZVdpdGhDaGFyYWN0ZXI7XG5cdFx0XHRcdFx0c3Vic3RyRnJvbSA9IGkgKyAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjaENvZGUgPT09IENoYXJDb2RlLkRvbGxhclNpZ24pIHtcblxuXHRcdFx0XHQvLyBtb3ZlIHRvIG5leHQgY2hhclxuXHRcdFx0XHRpKys7XG5cblx0XHRcdFx0aWYgKGkgPj0gbGVuKSB7XG5cdFx0XHRcdFx0Ly8gc3RyaW5nIGVuZHMgd2l0aCBhICRcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG5leHRDaENvZGUgPSByZXBsYWNlU3RyaW5nLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRcdGxldCByZXBsYWNlV2l0aENoYXJhY3Rlcjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cblx0XHRcdFx0c3dpdGNoIChuZXh0Q2hDb2RlKSB7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5EaWdpdDA6XG5cdFx0XHRcdFx0XHQvLyAkMCA9PiAkJlxuXHRcdFx0XHRcdFx0cmVwbGFjZVdpdGhDaGFyYWN0ZXIgPSAnJCYnO1xuXHRcdFx0XHRcdFx0dGhpcy5faGFzUGFyYW1ldGVycyA9IHRydWU7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLkJhY2tUaWNrOlxuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuU2luZ2xlUXVvdGU6XG5cdFx0XHRcdFx0XHR0aGlzLl9oYXNQYXJhbWV0ZXJzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHRcdC8vIGNoZWNrIGlmIGl0IGlzIGEgdmFsaWQgc3RyaW5nIHBhcmFtZXRlciAkbiAoMCA8PSBuIDw9IDk5KS4gJDAgaXMgYWxyZWFkeSBoYW5kbGVkIGJ5IG5vdy5cblx0XHRcdFx0XHRcdGlmICghdGhpcy5iZXR3ZWVuKG5leHRDaENvZGUsIENoYXJDb2RlLkRpZ2l0MSwgQ2hhckNvZGUuRGlnaXQ5KSkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChpID09PSByZXBsYWNlU3RyaW5nLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5faGFzUGFyYW1ldGVycyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0bGV0IGNoYXJDb2RlID0gcmVwbGFjZVN0cmluZy5jaGFyQ29kZUF0KCsraSk7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMuYmV0d2VlbihjaGFyQ29kZSwgQ2hhckNvZGUuRGlnaXQwLCBDaGFyQ29kZS5EaWdpdDkpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2hhc1BhcmFtZXRlcnMgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHQtLWk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGkgPT09IHJlcGxhY2VTdHJpbmcubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9oYXNQYXJhbWV0ZXJzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjaGFyQ29kZSA9IHJlcGxhY2VTdHJpbmcuY2hhckNvZGVBdCgrK2kpO1xuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLmJldHdlZW4oY2hhckNvZGUsIENoYXJDb2RlLkRpZ2l0MCwgQ2hhckNvZGUuRGlnaXQ5KSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9oYXNQYXJhbWV0ZXJzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0LS1pO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChyZXBsYWNlV2l0aENoYXJhY3Rlcikge1xuXHRcdFx0XHRcdHJlc3VsdCArPSByZXBsYWNlU3RyaW5nLnN1YnN0cmluZyhzdWJzdHJGcm9tLCBpIC0gMSkgKyByZXBsYWNlV2l0aENoYXJhY3Rlcjtcblx0XHRcdFx0XHRzdWJzdHJGcm9tID0gaSArIDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoc3Vic3RyRnJvbSA9PT0gMCkge1xuXHRcdFx0Ly8gbm8gcmVwbGFjZW1lbnQgb2NjdXJyZWRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZXBsYWNlUGF0dGVybiA9IHJlc3VsdCArIHJlcGxhY2VTdHJpbmcuc3Vic3RyaW5nKHN1YnN0ckZyb20pO1xuXHR9XG5cblx0cHJpdmF0ZSBiZXR3ZWVuKHZhbHVlOiBudW1iZXIsIGZyb206IG51bWJlciwgdG86IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmcm9tIDw9IHZhbHVlICYmIHZhbHVlIDw9IHRvO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLGFBQWE7QUFFekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywyQ0FBMkM7QUFFN0MsTUFBTSxlQUFlO0FBQUEsRUFTM0IsWUFBWSxl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
