import { CharCode } from "../../../../base/common/charCode.js";
import { buildReplaceStringWithCasePreserved } from "../../../../base/common/search.js";
var ReplacePatternKind = /* @__PURE__ */ ((ReplacePatternKind2) => {
  ReplacePatternKind2[ReplacePatternKind2["StaticValue"] = 0] = "StaticValue";
  ReplacePatternKind2[ReplacePatternKind2["DynamicPieces"] = 1] = "DynamicPieces";
  return ReplacePatternKind2;
})(ReplacePatternKind || {});
class StaticValueReplacePattern {
  constructor(staticValue) {
    this.staticValue = staticValue;
    this.kind = 0 /* StaticValue */;
  }
}
class DynamicPiecesReplacePattern {
  constructor(pieces) {
    this.pieces = pieces;
    this.kind = 1 /* DynamicPieces */;
  }
}
class ReplacePattern {
  static fromStaticValue(value) {
    return new ReplacePattern([ReplacePiece.staticValue(value)]);
  }
  get hasReplacementPatterns() {
    return this._state.kind === 1 /* DynamicPieces */;
  }
  constructor(pieces) {
    if (!pieces || pieces.length === 0) {
      this._state = new StaticValueReplacePattern("");
    } else if (pieces.length === 1 && pieces[0].staticValue !== null) {
      this._state = new StaticValueReplacePattern(pieces[0].staticValue);
    } else {
      this._state = new DynamicPiecesReplacePattern(pieces);
    }
  }
  buildReplaceString(matches, preserveCase) {
    if (this._state.kind === 0 /* StaticValue */) {
      if (preserveCase) {
        return buildReplaceStringWithCasePreserved(matches, this._state.staticValue);
      } else {
        return this._state.staticValue;
      }
    }
    let result = "";
    for (let i = 0, len = this._state.pieces.length; i < len; i++) {
      const piece = this._state.pieces[i];
      if (piece.staticValue !== null) {
        result += piece.staticValue;
        continue;
      }
      let match = ReplacePattern._substitute(piece.matchIndex, matches);
      if (piece.caseOps !== null && piece.caseOps.length > 0) {
        const repl = [];
        const lenOps = piece.caseOps.length;
        let opIdx = 0;
        for (let idx = 0, len2 = match.length; idx < len2; idx++) {
          if (opIdx >= lenOps) {
            repl.push(match.slice(idx));
            break;
          }
          switch (piece.caseOps[opIdx]) {
            case "U":
              repl.push(match[idx].toUpperCase());
              break;
            case "u":
              repl.push(match[idx].toUpperCase());
              opIdx++;
              break;
            case "L":
              repl.push(match[idx].toLowerCase());
              break;
            case "l":
              repl.push(match[idx].toLowerCase());
              opIdx++;
              break;
            default:
              repl.push(match[idx]);
          }
        }
        match = repl.join("");
      }
      result += match;
    }
    return result;
  }
  static _substitute(matchIndex, matches) {
    if (matches === null) {
      return "";
    }
    if (matchIndex === 0) {
      return matches[0];
    }
    let remainder = "";
    while (matchIndex > 0) {
      if (matchIndex < matches.length) {
        const match = matches[matchIndex] || "";
        return match + remainder;
      }
      remainder = String(matchIndex % 10) + remainder;
      matchIndex = Math.floor(matchIndex / 10);
    }
    return "$" + remainder;
  }
}
class ReplacePiece {
  static staticValue(value) {
    return new ReplacePiece(value, -1, null);
  }
  static matchIndex(index) {
    return new ReplacePiece(null, index, null);
  }
  static caseOps(index, caseOps) {
    return new ReplacePiece(null, index, caseOps);
  }
  constructor(staticValue, matchIndex, caseOps) {
    this.staticValue = staticValue;
    this.matchIndex = matchIndex;
    if (!caseOps || caseOps.length === 0) {
      this.caseOps = null;
    } else {
      this.caseOps = caseOps.slice(0);
    }
  }
}
class ReplacePieceBuilder {
  constructor(source) {
    this._source = source;
    this._lastCharIndex = 0;
    this._result = [];
    this._resultLen = 0;
    this._currentStaticPiece = "";
  }
  emitUnchanged(toCharIndex) {
    this._emitStatic(this._source.substring(this._lastCharIndex, toCharIndex));
    this._lastCharIndex = toCharIndex;
  }
  emitStatic(value, toCharIndex) {
    this._emitStatic(value);
    this._lastCharIndex = toCharIndex;
  }
  _emitStatic(value) {
    if (value.length === 0) {
      return;
    }
    this._currentStaticPiece += value;
  }
  emitMatchIndex(index, toCharIndex, caseOps) {
    if (this._currentStaticPiece.length !== 0) {
      this._result[this._resultLen++] = ReplacePiece.staticValue(this._currentStaticPiece);
      this._currentStaticPiece = "";
    }
    this._result[this._resultLen++] = ReplacePiece.caseOps(index, caseOps);
    this._lastCharIndex = toCharIndex;
  }
  finalize() {
    this.emitUnchanged(this._source.length);
    if (this._currentStaticPiece.length !== 0) {
      this._result[this._resultLen++] = ReplacePiece.staticValue(this._currentStaticPiece);
      this._currentStaticPiece = "";
    }
    return new ReplacePattern(this._result);
  }
}
function parseReplaceString(replaceString) {
  if (!replaceString || replaceString.length === 0) {
    return new ReplacePattern(null);
  }
  const caseOps = [];
  const result = new ReplacePieceBuilder(replaceString);
  for (let i = 0, len = replaceString.length; i < len; i++) {
    const chCode = replaceString.charCodeAt(i);
    if (chCode === CharCode.Backslash) {
      i++;
      if (i >= len) {
        break;
      }
      const nextChCode = replaceString.charCodeAt(i);
      switch (nextChCode) {
        case CharCode.Backslash:
          result.emitUnchanged(i - 1);
          result.emitStatic("\\", i + 1);
          break;
        case CharCode.n:
          result.emitUnchanged(i - 1);
          result.emitStatic("\n", i + 1);
          break;
        case CharCode.t:
          result.emitUnchanged(i - 1);
          result.emitStatic("	", i + 1);
          break;
        // Case modification of string replacements, patterned after Boost, but only applied
        // to the replacement text, not subsequent content.
        case CharCode.u:
        // \u => upper-cases one character.
        case CharCode.U:
        // \U => upper-cases ALL following characters.
        case CharCode.l:
        // \l => lower-cases one character.
        case CharCode.L:
          result.emitUnchanged(i - 1);
          result.emitStatic("", i + 1);
          caseOps.push(String.fromCharCode(nextChCode));
          break;
      }
      continue;
    }
    if (chCode === CharCode.DollarSign) {
      i++;
      if (i >= len) {
        break;
      }
      const nextChCode = replaceString.charCodeAt(i);
      if (nextChCode === CharCode.DollarSign) {
        result.emitUnchanged(i - 1);
        result.emitStatic("$", i + 1);
        continue;
      }
      if (nextChCode === CharCode.Digit0 || nextChCode === CharCode.Ampersand) {
        result.emitUnchanged(i - 1);
        result.emitMatchIndex(0, i + 1, caseOps);
        caseOps.length = 0;
        continue;
      }
      if (CharCode.Digit1 <= nextChCode && nextChCode <= CharCode.Digit9) {
        let matchIndex = nextChCode - CharCode.Digit0;
        if (i + 1 < len) {
          const nextNextChCode = replaceString.charCodeAt(i + 1);
          if (CharCode.Digit0 <= nextNextChCode && nextNextChCode <= CharCode.Digit9) {
            i++;
            matchIndex = matchIndex * 10 + (nextNextChCode - CharCode.Digit0);
            result.emitUnchanged(i - 2);
            result.emitMatchIndex(matchIndex, i + 1, caseOps);
            caseOps.length = 0;
            continue;
          }
        }
        result.emitUnchanged(i - 1);
        result.emitMatchIndex(matchIndex, i + 1, caseOps);
        caseOps.length = 0;
        continue;
      }
    }
  }
  return result.finalize();
}
export {
  ReplacePattern,
  ReplacePiece,
  parseReplaceString
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvcmVwbGFjZVBhdHRlcm4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NoYXJDb2RlLmpzJztcbmltcG9ydCB7IGJ1aWxkUmVwbGFjZVN0cmluZ1dpdGhDYXNlUHJlc2VydmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2VhcmNoLmpzJztcblxuY29uc3QgZW51bSBSZXBsYWNlUGF0dGVybktpbmQge1xuXHRTdGF0aWNWYWx1ZSA9IDAsXG5cdER5bmFtaWNQaWVjZXMgPSAxXG59XG5cbi8qKlxuICogQXNzaWduZWQgd2hlbiB0aGUgcmVwbGFjZSBwYXR0ZXJuIGlzIGVudGlyZWx5IHN0YXRpYy5cbiAqL1xuY2xhc3MgU3RhdGljVmFsdWVSZXBsYWNlUGF0dGVybiB7XG5cdHB1YmxpYyByZWFkb25seSBraW5kID0gUmVwbGFjZVBhdHRlcm5LaW5kLlN0YXRpY1ZhbHVlO1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgc3RhdGljVmFsdWU6IHN0cmluZykgeyB9XG59XG5cbi8qKlxuICogQXNzaWduZWQgd2hlbiB0aGUgcmVwbGFjZSBwYXR0ZXJuIGhhcyByZXBsYWNlbWVudCBwYXR0ZXJucy5cbiAqL1xuY2xhc3MgRHluYW1pY1BpZWNlc1JlcGxhY2VQYXR0ZXJuIHtcblx0cHVibGljIHJlYWRvbmx5IGtpbmQgPSBSZXBsYWNlUGF0dGVybktpbmQuRHluYW1pY1BpZWNlcztcblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHBpZWNlczogUmVwbGFjZVBpZWNlW10pIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVwbGFjZVBhdHRlcm4ge1xuXG5cdHB1YmxpYyBzdGF0aWMgZnJvbVN0YXRpY1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiBSZXBsYWNlUGF0dGVybiB7XG5cdFx0cmV0dXJuIG5ldyBSZXBsYWNlUGF0dGVybihbUmVwbGFjZVBpZWNlLnN0YXRpY1ZhbHVlKHZhbHVlKV0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RhdGU6IFN0YXRpY1ZhbHVlUmVwbGFjZVBhdHRlcm4gfCBEeW5hbWljUGllY2VzUmVwbGFjZVBhdHRlcm47XG5cblx0cHVibGljIGdldCBoYXNSZXBsYWNlbWVudFBhdHRlcm5zKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5fc3RhdGUua2luZCA9PT0gUmVwbGFjZVBhdHRlcm5LaW5kLkR5bmFtaWNQaWVjZXMpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IocGllY2VzOiBSZXBsYWNlUGllY2VbXSB8IG51bGwpIHtcblx0XHRpZiAoIXBpZWNlcyB8fCBwaWVjZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZSA9IG5ldyBTdGF0aWNWYWx1ZVJlcGxhY2VQYXR0ZXJuKCcnKTtcblx0XHR9IGVsc2UgaWYgKHBpZWNlcy5sZW5ndGggPT09IDEgJiYgcGllY2VzWzBdLnN0YXRpY1ZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZSA9IG5ldyBTdGF0aWNWYWx1ZVJlcGxhY2VQYXR0ZXJuKHBpZWNlc1swXS5zdGF0aWNWYWx1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3N0YXRlID0gbmV3IER5bmFtaWNQaWVjZXNSZXBsYWNlUGF0dGVybihwaWVjZXMpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBidWlsZFJlcGxhY2VTdHJpbmcobWF0Y2hlczogc3RyaW5nW10gfCBudWxsLCBwcmVzZXJ2ZUNhc2U/OiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5fc3RhdGUua2luZCA9PT0gUmVwbGFjZVBhdHRlcm5LaW5kLlN0YXRpY1ZhbHVlKSB7XG5cdFx0XHRpZiAocHJlc2VydmVDYXNlKSB7XG5cdFx0XHRcdHJldHVybiBidWlsZFJlcGxhY2VTdHJpbmdXaXRoQ2FzZVByZXNlcnZlZChtYXRjaGVzLCB0aGlzLl9zdGF0ZS5zdGF0aWNWYWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fc3RhdGUuc3RhdGljVmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHJlc3VsdCA9ICcnO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9zdGF0ZS5waWVjZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHBpZWNlID0gdGhpcy5fc3RhdGUucGllY2VzW2ldO1xuXHRcdFx0aWYgKHBpZWNlLnN0YXRpY1ZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHRcdC8vIHN0YXRpYyB2YWx1ZSBSZXBsYWNlUGllY2Vcblx0XHRcdFx0cmVzdWx0ICs9IHBpZWNlLnN0YXRpY1ZhbHVlO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gbWF0Y2ggaW5kZXggUmVwbGFjZVBpZWNlXG5cdFx0XHRsZXQgbWF0Y2g6IHN0cmluZyA9IFJlcGxhY2VQYXR0ZXJuLl9zdWJzdGl0dXRlKHBpZWNlLm1hdGNoSW5kZXgsIG1hdGNoZXMpO1xuXHRcdFx0aWYgKHBpZWNlLmNhc2VPcHMgIT09IG51bGwgJiYgcGllY2UuY2FzZU9wcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHJlcGw6IHN0cmluZ1tdID0gW107XG5cdFx0XHRcdGNvbnN0IGxlbk9wczogbnVtYmVyID0gcGllY2UuY2FzZU9wcy5sZW5ndGg7XG5cdFx0XHRcdGxldCBvcElkeDogbnVtYmVyID0gMDtcblx0XHRcdFx0Zm9yIChsZXQgaWR4OiBudW1iZXIgPSAwLCBsZW46IG51bWJlciA9IG1hdGNoLmxlbmd0aDsgaWR4IDwgbGVuOyBpZHgrKykge1xuXHRcdFx0XHRcdGlmIChvcElkeCA+PSBsZW5PcHMpIHtcblx0XHRcdFx0XHRcdHJlcGwucHVzaChtYXRjaC5zbGljZShpZHgpKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzd2l0Y2ggKHBpZWNlLmNhc2VPcHNbb3BJZHhdKSB7XG5cdFx0XHRcdFx0XHRjYXNlICdVJzpcblx0XHRcdFx0XHRcdFx0cmVwbC5wdXNoKG1hdGNoW2lkeF0udG9VcHBlckNhc2UoKSk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAndSc6XG5cdFx0XHRcdFx0XHRcdHJlcGwucHVzaChtYXRjaFtpZHhdLnRvVXBwZXJDYXNlKCkpO1xuXHRcdFx0XHRcdFx0XHRvcElkeCsrO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdGNhc2UgJ0wnOlxuXHRcdFx0XHRcdFx0XHRyZXBsLnB1c2gobWF0Y2hbaWR4XS50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRjYXNlICdsJzpcblx0XHRcdFx0XHRcdFx0cmVwbC5wdXNoKG1hdGNoW2lkeF0udG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdFx0XHRcdG9wSWR4Kys7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdFx0cmVwbC5wdXNoKG1hdGNoW2lkeF0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRtYXRjaCA9IHJlcGwuam9pbignJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQgKz0gbWF0Y2g7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9zdWJzdGl0dXRlKG1hdGNoSW5kZXg6IG51bWJlciwgbWF0Y2hlczogc3RyaW5nW10gfCBudWxsKTogc3RyaW5nIHtcblx0XHRpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRpZiAobWF0Y2hJbmRleCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG1hdGNoZXNbMF07XG5cdFx0fVxuXG5cdFx0bGV0IHJlbWFpbmRlciA9ICcnO1xuXHRcdHdoaWxlIChtYXRjaEluZGV4ID4gMCkge1xuXHRcdFx0aWYgKG1hdGNoSW5kZXggPCBtYXRjaGVzLmxlbmd0aCkge1xuXHRcdFx0XHQvLyBBIG1hdGNoIGNhbiBiZSB1bmRlZmluZWRcblx0XHRcdFx0Y29uc3QgbWF0Y2ggPSAobWF0Y2hlc1ttYXRjaEluZGV4XSB8fCAnJyk7XG5cdFx0XHRcdHJldHVybiBtYXRjaCArIHJlbWFpbmRlcjtcblx0XHRcdH1cblx0XHRcdHJlbWFpbmRlciA9IFN0cmluZyhtYXRjaEluZGV4ICUgMTApICsgcmVtYWluZGVyO1xuXHRcdFx0bWF0Y2hJbmRleCA9IE1hdGguZmxvb3IobWF0Y2hJbmRleCAvIDEwKTtcblx0XHR9XG5cdFx0cmV0dXJuICckJyArIHJlbWFpbmRlcjtcblx0fVxufVxuXG4vKipcbiAqIEEgcmVwbGFjZSBwaWVjZSBjYW4gZWl0aGVyIGJlIGEgc3RhdGljIHN0cmluZyBvciBhbiBpbmRleCB0byBhIHNwZWNpZmljIG1hdGNoLlxuICovXG5leHBvcnQgY2xhc3MgUmVwbGFjZVBpZWNlIHtcblxuXHRwdWJsaWMgc3RhdGljIHN0YXRpY1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiBSZXBsYWNlUGllY2Uge1xuXHRcdHJldHVybiBuZXcgUmVwbGFjZVBpZWNlKHZhbHVlLCAtMSwgbnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIG1hdGNoSW5kZXgoaW5kZXg6IG51bWJlcik6IFJlcGxhY2VQaWVjZSB7XG5cdFx0cmV0dXJuIG5ldyBSZXBsYWNlUGllY2UobnVsbCwgaW5kZXgsIG51bGwpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBjYXNlT3BzKGluZGV4OiBudW1iZXIsIGNhc2VPcHM6IHN0cmluZ1tdKTogUmVwbGFjZVBpZWNlIHtcblx0XHRyZXR1cm4gbmV3IFJlcGxhY2VQaWVjZShudWxsLCBpbmRleCwgY2FzZU9wcyk7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgc3RhdGljVmFsdWU6IHN0cmluZyB8IG51bGw7XG5cdHB1YmxpYyByZWFkb25seSBtYXRjaEluZGV4OiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBjYXNlT3BzOiBzdHJpbmdbXSB8IG51bGw7XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcihzdGF0aWNWYWx1ZTogc3RyaW5nIHwgbnVsbCwgbWF0Y2hJbmRleDogbnVtYmVyLCBjYXNlT3BzOiBzdHJpbmdbXSB8IG51bGwpIHtcblx0XHR0aGlzLnN0YXRpY1ZhbHVlID0gc3RhdGljVmFsdWU7XG5cdFx0dGhpcy5tYXRjaEluZGV4ID0gbWF0Y2hJbmRleDtcblx0XHRpZiAoIWNhc2VPcHMgfHwgY2FzZU9wcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMuY2FzZU9wcyA9IG51bGw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY2FzZU9wcyA9IGNhc2VPcHMuc2xpY2UoMCk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFJlcGxhY2VQaWVjZUJ1aWxkZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NvdXJjZTogc3RyaW5nO1xuXHRwcml2YXRlIF9sYXN0Q2hhckluZGV4OiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Jlc3VsdDogUmVwbGFjZVBpZWNlW107XG5cdHByaXZhdGUgX3Jlc3VsdExlbjogbnVtYmVyO1xuXHRwcml2YXRlIF9jdXJyZW50U3RhdGljUGllY2U6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcihzb3VyY2U6IHN0cmluZykge1xuXHRcdHRoaXMuX3NvdXJjZSA9IHNvdXJjZTtcblx0XHR0aGlzLl9sYXN0Q2hhckluZGV4ID0gMDtcblx0XHR0aGlzLl9yZXN1bHQgPSBbXTtcblx0XHR0aGlzLl9yZXN1bHRMZW4gPSAwO1xuXHRcdHRoaXMuX2N1cnJlbnRTdGF0aWNQaWVjZSA9ICcnO1xuXHR9XG5cblx0cHVibGljIGVtaXRVbmNoYW5nZWQodG9DaGFySW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2VtaXRTdGF0aWModGhpcy5fc291cmNlLnN1YnN0cmluZyh0aGlzLl9sYXN0Q2hhckluZGV4LCB0b0NoYXJJbmRleCkpO1xuXHRcdHRoaXMuX2xhc3RDaGFySW5kZXggPSB0b0NoYXJJbmRleDtcblx0fVxuXG5cdHB1YmxpYyBlbWl0U3RhdGljKHZhbHVlOiBzdHJpbmcsIHRvQ2hhckluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9lbWl0U3RhdGljKHZhbHVlKTtcblx0XHR0aGlzLl9sYXN0Q2hhckluZGV4ID0gdG9DaGFySW5kZXg7XG5cdH1cblxuXHRwcml2YXRlIF9lbWl0U3RhdGljKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodmFsdWUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2N1cnJlbnRTdGF0aWNQaWVjZSArPSB2YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBlbWl0TWF0Y2hJbmRleChpbmRleDogbnVtYmVyLCB0b0NoYXJJbmRleDogbnVtYmVyLCBjYXNlT3BzOiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9jdXJyZW50U3RhdGljUGllY2UubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHR0aGlzLl9yZXN1bHRbdGhpcy5fcmVzdWx0TGVuKytdID0gUmVwbGFjZVBpZWNlLnN0YXRpY1ZhbHVlKHRoaXMuX2N1cnJlbnRTdGF0aWNQaWVjZSk7XG5cdFx0XHR0aGlzLl9jdXJyZW50U3RhdGljUGllY2UgPSAnJztcblx0XHR9XG5cdFx0dGhpcy5fcmVzdWx0W3RoaXMuX3Jlc3VsdExlbisrXSA9IFJlcGxhY2VQaWVjZS5jYXNlT3BzKGluZGV4LCBjYXNlT3BzKTtcblx0XHR0aGlzLl9sYXN0Q2hhckluZGV4ID0gdG9DaGFySW5kZXg7XG5cdH1cblxuXG5cdHB1YmxpYyBmaW5hbGl6ZSgpOiBSZXBsYWNlUGF0dGVybiB7XG5cdFx0dGhpcy5lbWl0VW5jaGFuZ2VkKHRoaXMuX3NvdXJjZS5sZW5ndGgpO1xuXHRcdGlmICh0aGlzLl9jdXJyZW50U3RhdGljUGllY2UubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHR0aGlzLl9yZXN1bHRbdGhpcy5fcmVzdWx0TGVuKytdID0gUmVwbGFjZVBpZWNlLnN0YXRpY1ZhbHVlKHRoaXMuX2N1cnJlbnRTdGF0aWNQaWVjZSk7XG5cdFx0XHR0aGlzLl9jdXJyZW50U3RhdGljUGllY2UgPSAnJztcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBSZXBsYWNlUGF0dGVybih0aGlzLl9yZXN1bHQpO1xuXHR9XG59XG5cbi8qKlxuICogXFxuXHRcdFx0PT4gaW5zZXJ0cyBhIExGXG4gKiBcXHRcdFx0XHQ9PiBpbnNlcnRzIGEgVEFCXG4gKiBcXFxcXHRcdFx0PT4gaW5zZXJ0cyBhIFwiXFxcIi5cbiAqIFxcdVx0XHRcdD0+IHVwcGVyLWNhc2VzIG9uZSBjaGFyYWN0ZXIgaW4gYSBtYXRjaC5cbiAqIFxcVVx0XHRcdD0+IHVwcGVyLWNhc2VzIEFMTCByZW1haW5pbmcgY2hhcmFjdGVycyBpbiBhIG1hdGNoLlxuICogXFxsXHRcdFx0PT4gbG93ZXItY2FzZXMgb25lIGNoYXJhY3RlciBpbiBhIG1hdGNoLlxuICogXFxMXHRcdFx0PT4gbG93ZXItY2FzZXMgQUxMIHJlbWFpbmluZyBjaGFyYWN0ZXJzIGluIGEgbWF0Y2guXG4gKiAkJFx0XHRcdD0+IGluc2VydHMgYSBcIiRcIi5cbiAqICQmIGFuZCAkMFx0PT4gaW5zZXJ0cyB0aGUgbWF0Y2hlZCBzdWJzdHJpbmcuXG4gKiAkblx0XHRcdD0+IFdoZXJlIG4gaXMgYSBub24tbmVnYXRpdmUgaW50ZWdlciBsZXNzZXIgdGhhbiAxMDAsIGluc2VydHMgdGhlIG50aCBwYXJlbnRoZXNpemVkIHN1Ym1hdGNoIHN0cmluZ1xuICogZXZlcnl0aGluZyBlbHNlIHN0YXlzIHVudG91Y2hlZFxuICpcbiAqIEFsc28gc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL1N0cmluZy9yZXBsYWNlI1NwZWNpZnlpbmdfYV9zdHJpbmdfYXNfYV9wYXJhbWV0ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUmVwbGFjZVN0cmluZyhyZXBsYWNlU3RyaW5nOiBzdHJpbmcpOiBSZXBsYWNlUGF0dGVybiB7XG5cdGlmICghcmVwbGFjZVN0cmluZyB8fCByZXBsYWNlU3RyaW5nLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiBuZXcgUmVwbGFjZVBhdHRlcm4obnVsbCk7XG5cdH1cblxuXHRjb25zdCBjYXNlT3BzOiBzdHJpbmdbXSA9IFtdO1xuXHRjb25zdCByZXN1bHQgPSBuZXcgUmVwbGFjZVBpZWNlQnVpbGRlcihyZXBsYWNlU3RyaW5nKTtcblxuXHRmb3IgKGxldCBpID0gMCwgbGVuID0gcmVwbGFjZVN0cmluZy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdGNvbnN0IGNoQ29kZSA9IHJlcGxhY2VTdHJpbmcuY2hhckNvZGVBdChpKTtcblxuXHRcdGlmIChjaENvZGUgPT09IENoYXJDb2RlLkJhY2tzbGFzaCkge1xuXG5cdFx0XHQvLyBtb3ZlIHRvIG5leHQgY2hhclxuXHRcdFx0aSsrO1xuXG5cdFx0XHRpZiAoaSA+PSBsZW4pIHtcblx0XHRcdFx0Ly8gc3RyaW5nIGVuZHMgd2l0aCBhIFxcXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXh0Q2hDb2RlID0gcmVwbGFjZVN0cmluZy5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0Ly8gbGV0IHJlcGxhY2VXaXRoQ2hhcmFjdGVyOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuXHRcdFx0c3dpdGNoIChuZXh0Q2hDb2RlKSB7XG5cdFx0XHRcdGNhc2UgQ2hhckNvZGUuQmFja3NsYXNoOlxuXHRcdFx0XHRcdC8vIFxcXFwgPT4gaW5zZXJ0cyBhIFwiXFxcIlxuXHRcdFx0XHRcdHJlc3VsdC5lbWl0VW5jaGFuZ2VkKGkgLSAxKTtcblx0XHRcdFx0XHRyZXN1bHQuZW1pdFN0YXRpYygnXFxcXCcsIGkgKyAxKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5uOlxuXHRcdFx0XHRcdC8vIFxcbiA9PiBpbnNlcnRzIGEgTEZcblx0XHRcdFx0XHRyZXN1bHQuZW1pdFVuY2hhbmdlZChpIC0gMSk7XG5cdFx0XHRcdFx0cmVzdWx0LmVtaXRTdGF0aWMoJ1xcbicsIGkgKyAxKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS50OlxuXHRcdFx0XHRcdC8vIFxcdCA9PiBpbnNlcnRzIGEgVEFCXG5cdFx0XHRcdFx0cmVzdWx0LmVtaXRVbmNoYW5nZWQoaSAtIDEpO1xuXHRcdFx0XHRcdHJlc3VsdC5lbWl0U3RhdGljKCdcXHQnLCBpICsgMSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdC8vIENhc2UgbW9kaWZpY2F0aW9uIG9mIHN0cmluZyByZXBsYWNlbWVudHMsIHBhdHRlcm5lZCBhZnRlciBCb29zdCwgYnV0IG9ubHkgYXBwbGllZFxuXHRcdFx0XHQvLyB0byB0aGUgcmVwbGFjZW1lbnQgdGV4dCwgbm90IHN1YnNlcXVlbnQgY29udGVudC5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS51OlxuXHRcdFx0XHQvLyBcXHUgPT4gdXBwZXItY2FzZXMgb25lIGNoYXJhY3Rlci5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5VOlxuXHRcdFx0XHQvLyBcXFUgPT4gdXBwZXItY2FzZXMgQUxMIGZvbGxvd2luZyBjaGFyYWN0ZXJzLlxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLmw6XG5cdFx0XHRcdC8vIFxcbCA9PiBsb3dlci1jYXNlcyBvbmUgY2hhcmFjdGVyLlxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLkw6XG5cdFx0XHRcdFx0Ly8gXFxMID0+IGxvd2VyLWNhc2VzIEFMTCBmb2xsb3dpbmcgY2hhcmFjdGVycy5cblx0XHRcdFx0XHRyZXN1bHQuZW1pdFVuY2hhbmdlZChpIC0gMSk7XG5cdFx0XHRcdFx0cmVzdWx0LmVtaXRTdGF0aWMoJycsIGkgKyAxKTtcblx0XHRcdFx0XHRjYXNlT3BzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZShuZXh0Q2hDb2RlKSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGlmIChjaENvZGUgPT09IENoYXJDb2RlLkRvbGxhclNpZ24pIHtcblxuXHRcdFx0Ly8gbW92ZSB0byBuZXh0IGNoYXJcblx0XHRcdGkrKztcblxuXHRcdFx0aWYgKGkgPj0gbGVuKSB7XG5cdFx0XHRcdC8vIHN0cmluZyBlbmRzIHdpdGggYSAkXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXh0Q2hDb2RlID0gcmVwbGFjZVN0cmluZy5jaGFyQ29kZUF0KGkpO1xuXG5cdFx0XHRpZiAobmV4dENoQ29kZSA9PT0gQ2hhckNvZGUuRG9sbGFyU2lnbikge1xuXHRcdFx0XHQvLyAkJCA9PiBpbnNlcnRzIGEgXCIkXCJcblx0XHRcdFx0cmVzdWx0LmVtaXRVbmNoYW5nZWQoaSAtIDEpO1xuXHRcdFx0XHRyZXN1bHQuZW1pdFN0YXRpYygnJCcsIGkgKyAxKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChuZXh0Q2hDb2RlID09PSBDaGFyQ29kZS5EaWdpdDAgfHwgbmV4dENoQ29kZSA9PT0gQ2hhckNvZGUuQW1wZXJzYW5kKSB7XG5cdFx0XHRcdC8vICQmIGFuZCAkMCA9PiBpbnNlcnRzIHRoZSBtYXRjaGVkIHN1YnN0cmluZy5cblx0XHRcdFx0cmVzdWx0LmVtaXRVbmNoYW5nZWQoaSAtIDEpO1xuXHRcdFx0XHRyZXN1bHQuZW1pdE1hdGNoSW5kZXgoMCwgaSArIDEsIGNhc2VPcHMpO1xuXHRcdFx0XHRjYXNlT3BzLmxlbmd0aCA9IDA7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoQ2hhckNvZGUuRGlnaXQxIDw9IG5leHRDaENvZGUgJiYgbmV4dENoQ29kZSA8PSBDaGFyQ29kZS5EaWdpdDkpIHtcblx0XHRcdFx0Ly8gJG5cblxuXHRcdFx0XHRsZXQgbWF0Y2hJbmRleCA9IG5leHRDaENvZGUgLSBDaGFyQ29kZS5EaWdpdDA7XG5cblx0XHRcdFx0Ly8gcGVlayBuZXh0IGNoYXIgdG8gcHJvYmUgZm9yICRublxuXHRcdFx0XHRpZiAoaSArIDEgPCBsZW4pIHtcblx0XHRcdFx0XHRjb25zdCBuZXh0TmV4dENoQ29kZSA9IHJlcGxhY2VTdHJpbmcuY2hhckNvZGVBdChpICsgMSk7XG5cdFx0XHRcdFx0aWYgKENoYXJDb2RlLkRpZ2l0MCA8PSBuZXh0TmV4dENoQ29kZSAmJiBuZXh0TmV4dENoQ29kZSA8PSBDaGFyQ29kZS5EaWdpdDkpIHtcblx0XHRcdFx0XHRcdC8vICRublxuXG5cdFx0XHRcdFx0XHQvLyBtb3ZlIHRvIG5leHQgY2hhclxuXHRcdFx0XHRcdFx0aSsrO1xuXHRcdFx0XHRcdFx0bWF0Y2hJbmRleCA9IG1hdGNoSW5kZXggKiAxMCArIChuZXh0TmV4dENoQ29kZSAtIENoYXJDb2RlLkRpZ2l0MCk7XG5cblx0XHRcdFx0XHRcdHJlc3VsdC5lbWl0VW5jaGFuZ2VkKGkgLSAyKTtcblx0XHRcdFx0XHRcdHJlc3VsdC5lbWl0TWF0Y2hJbmRleChtYXRjaEluZGV4LCBpICsgMSwgY2FzZU9wcyk7XG5cdFx0XHRcdFx0XHRjYXNlT3BzLmxlbmd0aCA9IDA7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXN1bHQuZW1pdFVuY2hhbmdlZChpIC0gMSk7XG5cdFx0XHRcdHJlc3VsdC5lbWl0TWF0Y2hJbmRleChtYXRjaEluZGV4LCBpICsgMSwgY2FzZU9wcyk7XG5cdFx0XHRcdGNhc2VPcHMubGVuZ3RoID0gMDtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJlc3VsdC5maW5hbGl6ZSgpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywyQ0FBMkM7QUFFcEQsSUFBVyxxQkFBWCxrQkFBV0Esd0JBQVg7QUFDQyxFQUFBQSx3Q0FBQSxpQkFBYyxLQUFkO0FBQ0EsRUFBQUEsd0NBQUEsbUJBQWdCLEtBQWhCO0FBRlUsU0FBQUE7QUFBQSxHQUFBO0FBUVgsTUFBTSwwQkFBMEI7QUFBQSxFQUUvQixZQUE0QixhQUFxQjtBQUFyQjtBQUQ1QixTQUFnQixPQUFPO0FBQUEsRUFDNEI7QUFDcEQ7QUFLQSxNQUFNLDRCQUE0QjtBQUFBLEVBRWpDLFlBQTRCLFFBQXdCO0FBQXhCO0FBRDVCLFNBQWdCLE9BQU87QUFBQSxFQUMrQjtBQUN2RDtBQUVPLE1BQU0sZUFBZTtBQUFBLEVBRTNCLE9BQWMsZ0JBQWdCLE9BQStCO0FBQzVELFdBQU8sSUFBSSxlQUFlLENBQUMsYUFBYSxZQUFZLEtBQUssQ0FBQyxDQUFDO0FBQUEsRUFDNUQ7QUFBQSxFQUlBLElBQVcseUJBQWtDO0FBQzVDLFdBQVEsS0FBSyxPQUFPLFNBQVM7QUFBQSxFQUM5QjtBQUFBLEVBRUEsWUFBWSxRQUErQjtBQUMxQyxRQUFJLENBQUMsVUFBVSxPQUFPLFdBQVcsR0FBRztBQUNuQyxXQUFLLFNBQVMsSUFBSSwwQkFBMEIsRUFBRTtBQUFBLElBQy9DLFdBQVcsT0FBTyxXQUFXLEtBQUssT0FBTyxDQUFD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
