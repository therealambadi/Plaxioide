var ScanError = /* @__PURE__ */ ((ScanError2) => {
  ScanError2[ScanError2["None"] = 0] = "None";
  ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
  return ScanError2;
})(ScanError || {});
var SyntaxKind = /* @__PURE__ */ ((SyntaxKind2) => {
  SyntaxKind2[SyntaxKind2["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind2[SyntaxKind2["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind2[SyntaxKind2["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind2[SyntaxKind2["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind2[SyntaxKind2["CommaToken"] = 5] = "CommaToken";
  SyntaxKind2[SyntaxKind2["ColonToken"] = 6] = "ColonToken";
  SyntaxKind2[SyntaxKind2["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind2[SyntaxKind2["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind2[SyntaxKind2["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind2[SyntaxKind2["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind2[SyntaxKind2["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind2[SyntaxKind2["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind2[SyntaxKind2["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind2[SyntaxKind2["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind2[SyntaxKind2["Trivia"] = 15] = "Trivia";
  SyntaxKind2[SyntaxKind2["Unknown"] = 16] = "Unknown";
  SyntaxKind2[SyntaxKind2["EOF"] = 17] = "EOF";
  return SyntaxKind2;
})(SyntaxKind || {});
var ParseErrorCode = /* @__PURE__ */ ((ParseErrorCode2) => {
  ParseErrorCode2[ParseErrorCode2["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode2[ParseErrorCode2["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode2[ParseErrorCode2["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode2[ParseErrorCode2["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode2[ParseErrorCode2["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode2[ParseErrorCode2["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode2[ParseErrorCode2["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode2[ParseErrorCode2["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode2[ParseErrorCode2["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode2[ParseErrorCode2["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode2[ParseErrorCode2["InvalidCharacter"] = 16] = "InvalidCharacter";
  return ParseErrorCode2;
})(ParseErrorCode || {});
var ParseOptions;
((ParseOptions2) => {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: true
  };
})(ParseOptions || (ParseOptions = {}));
function createScanner(text, ignoreTrivia = false) {
  let pos = 0;
  const len = text.length;
  let value = "";
  let tokenOffset = 0;
  let token = 16 /* Unknown */;
  let scanError = 0 /* None */;
  function scanHexDigits(count) {
    let digits = 0;
    let hexValue = 0;
    while (digits < count) {
      const ch = text.charCodeAt(pos);
      if (ch >= 48 /* _0 */ && ch <= 57 /* _9 */) {
        hexValue = hexValue * 16 + ch - 48 /* _0 */;
      } else if (ch >= 65 /* A */ && ch <= 70 /* F */) {
        hexValue = hexValue * 16 + ch - 65 /* A */ + 10;
      } else if (ch >= 97 /* a */ && ch <= 102 /* f */) {
        hexValue = hexValue * 16 + ch - 97 /* a */ + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      hexValue = -1;
    }
    return hexValue;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16 /* Unknown */;
    scanError = 0 /* None */;
  }
  function scanNumber() {
    const start = pos;
    if (text.charCodeAt(pos) === 48 /* _0 */) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46 /* dot */) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3 /* UnexpectedEndOfNumber */;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 /* E */ || text.charCodeAt(pos) === 101 /* e */)) {
      pos++;
      if (pos < text.length && text.charCodeAt(pos) === 43 /* plus */ || text.charCodeAt(pos) === 45 /* minus */) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3 /* UnexpectedEndOfNumber */;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2 /* UnexpectedEndOfString */;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34 /* doubleQuote */) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92 /* backslash */) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2 /* UnexpectedEndOfString */;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case 34 /* doubleQuote */:
            result += '"';
            break;
          case 92 /* backslash */:
            result += "\\";
            break;
          case 47 /* slash */:
            result += "/";
            break;
          case 98 /* b */:
            result += "\b";
            break;
          case 102 /* f */:
            result += "\f";
            break;
          case 110 /* n */:
            result += "\n";
            break;
          case 114 /* r */:
            result += "\r";
            break;
          case 116 /* t */:
            result += "	";
            break;
          case 117 /* u */: {
            const ch3 = scanHexDigits(4);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4 /* InvalidUnicode */;
            }
            break;
          }
          default:
            scanError = 5 /* InvalidEscapeCharacter */;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = 2 /* UnexpectedEndOfString */;
          break;
        } else {
          scanError = 6 /* InvalidCharacter */;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0 /* None */;
    tokenOffset = pos;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17 /* EOF */;
    }
    let code = text.charCodeAt(pos);
    if (isWhitespace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhitespace(code));
      return token = 15 /* Trivia */;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 /* carriageReturn */ && text.charCodeAt(pos) === 10 /* lineFeed */) {
        pos++;
        value += "\n";
      }
      return token = 14 /* LineBreakTrivia */;
    }
    switch (code) {
      // tokens: []{}:,
      case 123 /* openBrace */:
        pos++;
        return token = 1 /* OpenBraceToken */;
      case 125 /* closeBrace */:
        pos++;
        return token = 2 /* CloseBraceToken */;
      case 91 /* openBracket */:
        pos++;
        return token = 3 /* OpenBracketToken */;
      case 93 /* closeBracket */:
        pos++;
        return token = 4 /* CloseBracketToken */;
      case 58 /* colon */:
        pos++;
        return token = 6 /* ColonToken */;
      case 44 /* comma */:
        pos++;
        return token = 5 /* CommaToken */;
      // strings
      case 34 /* doubleQuote */:
        pos++;
        value = scanString();
        return token = 10 /* StringLiteral */;
      // comments
      case 47 /* slash */: {
        const start = pos - 1;
        if (text.charCodeAt(pos + 1) === 47 /* slash */) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = 12 /* LineCommentTrivia */;
        }
        if (text.charCodeAt(pos + 1) === 42 /* asterisk */) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 /* asterisk */ && text.charCodeAt(pos + 1) === 47 /* slash */) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
          }
          if (!commentClosed) {
            pos++;
            scanError = 1 /* UnexpectedEndOfComment */;
          }
          value = text.substring(start, pos);
          return token = 13 /* BlockCommentTrivia */;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16 /* Unknown */;
      }
      // numbers
      case 45 /* minus */:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return token = 16 /* Unknown */;
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48 /* _0 */:
      case 49 /* _1 */:
      case 50 /* _2 */:
      case 51 /* _3 */:
      case 52 /* _4 */:
      case 53 /* _5 */:
      case 54 /* _6 */:
      case 55 /* _7 */:
      case 56 /* _8 */:
      case 57 /* _9 */:
        value += scanNumber();
        return token = 11 /* NumericLiteral */;
      // literals and unknown symbols
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8 /* TrueKeyword */;
            case "false":
              return token = 9 /* FalseKeyword */;
            case "null":
              return token = 7 /* NullKeyword */;
          }
          return token = 16 /* Unknown */;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16 /* Unknown */;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhitespace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125 /* closeBrace */:
      case 93 /* closeBracket */:
      case 123 /* openBrace */:
      case 91 /* openBracket */:
      case 34 /* doubleQuote */:
      case 58 /* colon */:
      case 44 /* comma */:
      case 47 /* slash */:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 /* LineCommentTrivia */ && result <= 15 /* Trivia */);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenError: () => scanError
  };
}
function isWhitespace(ch) {
  return ch === 32 /* space */ || ch === 9 /* tab */ || ch === 11 /* verticalTab */ || ch === 12 /* formFeed */ || ch === 160 /* nonBreakingSpace */ || ch === 5760 /* ogham */ || ch >= 8192 /* enQuad */ && ch <= 8203 /* zeroWidthSpace */ || ch === 8239 /* narrowNoBreakSpace */ || ch === 8287 /* mathematicalSpace */ || ch === 12288 /* ideographicSpace */ || ch === 65279 /* byteOrderMark */;
}
function isLineBreak(ch) {
  return ch === 10 /* lineFeed */ || ch === 13 /* carriageReturn */ || ch === 8232 /* lineSeparator */ || ch === 8233 /* paragraphSeparator */;
}
function isDigit(ch) {
  return ch >= 48 /* _0 */ && ch <= 57 /* _9 */;
}
var CharacterCodes = /* @__PURE__ */ ((CharacterCodes2) => {
  CharacterCodes2[CharacterCodes2["nullCharacter"] = 0] = "nullCharacter";
  CharacterCodes2[CharacterCodes2["maxAsciiCharacter"] = 127] = "maxAsciiCharacter";
  CharacterCodes2[CharacterCodes2["lineFeed"] = 10] = "lineFeed";
  CharacterCodes2[CharacterCodes2["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes2[CharacterCodes2["lineSeparator"] = 8232] = "lineSeparator";
  CharacterCodes2[CharacterCodes2["paragraphSeparator"] = 8233] = "paragraphSeparator";
  CharacterCodes2[CharacterCodes2["nextLine"] = 133] = "nextLine";
  CharacterCodes2[CharacterCodes2["space"] = 32] = "space";
  CharacterCodes2[CharacterCodes2["nonBreakingSpace"] = 160] = "nonBreakingSpace";
  CharacterCodes2[CharacterCodes2["enQuad"] = 8192] = "enQuad";
  CharacterCodes2[CharacterCodes2["emQuad"] = 8193] = "emQuad";
  CharacterCodes2[CharacterCodes2["enSpace"] = 8194] = "enSpace";
  CharacterCodes2[CharacterCodes2["emSpace"] = 8195] = "emSpace";
  CharacterCodes2[CharacterCodes2["threePerEmSpace"] = 8196] = "threePerEmSpace";
  CharacterCodes2[CharacterCodes2["fourPerEmSpace"] = 8197] = "fourPerEmSpace";
  CharacterCodes2[CharacterCodes2["sixPerEmSpace"] = 8198] = "sixPerEmSpace";
  CharacterCodes2[CharacterCodes2["figureSpace"] = 8199] = "figureSpace";
  CharacterCodes2[CharacterCodes2["punctuationSpace"] = 8200] = "punctuationSpace";
  CharacterCodes2[CharacterCodes2["thinSpace"] = 8201] = "thinSpace";
  CharacterCodes2[CharacterCodes2["hairSpace"] = 8202] = "hairSpace";
  CharacterCodes2[CharacterCodes2["zeroWidthSpace"] = 8203] = "zeroWidthSpace";
  CharacterCodes2[CharacterCodes2["narrowNoBreakSpace"] = 8239] = "narrowNoBreakSpace";
  CharacterCodes2[CharacterCodes2["ideographicSpace"] = 12288] = "ideographicSpace";
  CharacterCodes2[CharacterCodes2["mathematicalSpace"] = 8287] = "mathematicalSpace";
  CharacterCodes2[CharacterCodes2["ogham"] = 5760] = "ogham";
  CharacterCodes2[CharacterCodes2["_"] = 95] = "_";
  CharacterCodes2[CharacterCodes2["$"] = 36] = "$";
  CharacterCodes2[CharacterCodes2["_0"] = 48] = "_0";
  CharacterCodes2[CharacterCodes2["_1"] = 49] = "_1";
  CharacterCodes2[CharacterCodes2["_2"] = 50] = "_2";
  CharacterCodes2[CharacterCodes2["_3"] = 51] = "_3";
  CharacterCodes2[CharacterCodes2["_4"] = 52] = "_4";
  CharacterCodes2[CharacterCodes2["_5"] = 53] = "_5";
  CharacterCodes2[CharacterCodes2["_6"] = 54] = "_6";
  CharacterCodes2[CharacterCodes2["_7"] = 55] = "_7";
  CharacterCodes2[CharacterCodes2["_8"] = 56] = "_8";
  CharacterCodes2[CharacterCodes2["_9"] = 57] = "_9";
  CharacterCodes2[CharacterCodes2["a"] = 97] = "a";
  CharacterCodes2[CharacterCodes2["b"] = 98] = "b";
  CharacterCodes2[CharacterCodes2["c"] = 99] = "c";
  CharacterCodes2[CharacterCodes2["d"] = 100] = "d";
  CharacterCodes2[CharacterCodes2["e"] = 101] = "e";
  CharacterCodes2[CharacterCodes2["f"] = 102] = "f";
  CharacterCodes2[CharacterCodes2["g"] = 103] = "g";
  CharacterCodes2[CharacterCodes2["h"] = 104] = "h";
  CharacterCodes2[CharacterCodes2["i"] = 105] = "i";
  CharacterCodes2[CharacterCodes2["j"] = 106] = "j";
  CharacterCodes2[CharacterCodes2["k"] = 107] = "k";
  CharacterCodes2[CharacterCodes2["l"] = 108] = "l";
  CharacterCodes2[CharacterCodes2["m"] = 109] = "m";
  CharacterCodes2[CharacterCodes2["n"] = 110] = "n";
  CharacterCodes2[CharacterCodes2["o"] = 111] = "o";
  CharacterCodes2[CharacterCodes2["p"] = 112] = "p";
  CharacterCodes2[CharacterCodes2["q"] = 113] = "q";
  CharacterCodes2[CharacterCodes2["r"] = 114] = "r";
  CharacterCodes2[CharacterCodes2["s"] = 115] = "s";
  CharacterCodes2[CharacterCodes2["t"] = 116] = "t";
  CharacterCodes2[CharacterCodes2["u"] = 117] = "u";
  CharacterCodes2[CharacterCodes2["v"] = 118] = "v";
  CharacterCodes2[CharacterCodes2["w"] = 119] = "w";
  CharacterCodes2[CharacterCodes2["x"] = 120] = "x";
  CharacterCodes2[CharacterCodes2["y"] = 121] = "y";
  CharacterCodes2[CharacterCodes2["z"] = 122] = "z";
  CharacterCodes2[CharacterCodes2["A"] = 65] = "A";
  CharacterCodes2[CharacterCodes2["B"] = 66] = "B";
  CharacterCodes2[CharacterCodes2["C"] = 67] = "C";
  CharacterCodes2[CharacterCodes2["D"] = 68] = "D";
  CharacterCodes2[CharacterCodes2["E"] = 69] = "E";
  CharacterCodes2[CharacterCodes2["F"] = 70] = "F";
  CharacterCodes2[CharacterCodes2["G"] = 71] = "G";
  CharacterCodes2[CharacterCodes2["H"] = 72] = "H";
  CharacterCodes2[CharacterCodes2["I"] = 73] = "I";
  CharacterCodes2[CharacterCodes2["J"] = 74] = "J";
  CharacterCodes2[CharacterCodes2["K"] = 75] = "K";
  CharacterCodes2[CharacterCodes2["L"] = 76] = "L";
  CharacterCodes2[CharacterCodes2["M"] = 77] = "M";
  CharacterCodes2[CharacterCodes2["N"] = 78] = "N";
  CharacterCodes2[CharacterCodes2["O"] = 79] = "O";
  CharacterCodes2[CharacterCodes2["P"] = 80] = "P";
  CharacterCodes2[CharacterCodes2["Q"] = 81] = "Q";
  CharacterCodes2[CharacterCodes2["R"] = 82] = "R";
  CharacterCodes2[CharacterCodes2["S"] = 83] = "S";
  CharacterCodes2[CharacterCodes2["T"] = 84] = "T";
  CharacterCodes2[CharacterCodes2["U"] = 85] = "U";
  CharacterCodes2[CharacterCodes2["V"] = 86] = "V";
  CharacterCodes2[CharacterCodes2["W"] = 87] = "W";
  CharacterCodes2[CharacterCodes2["X"] = 88] = "X";
  CharacterCodes2[CharacterCodes2["Y"] = 89] = "Y";
  CharacterCodes2[CharacterCodes2["Z"] = 90] = "Z";
  CharacterCodes2[CharacterCodes2["ampersand"] = 38] = "ampersand";
  CharacterCodes2[CharacterCodes2["asterisk"] = 42] = "asterisk";
  CharacterCodes2[CharacterCodes2["at"] = 64] = "at";
  CharacterCodes2[CharacterCodes2["backslash"] = 92] = "backslash";
  CharacterCodes2[CharacterCodes2["bar"] = 124] = "bar";
  CharacterCodes2[CharacterCodes2["caret"] = 94] = "caret";
  CharacterCodes2[CharacterCodes2["closeBrace"] = 125] = "closeBrace";
  CharacterCodes2[CharacterCodes2["closeBracket"] = 93] = "closeBracket";
  CharacterCodes2[CharacterCodes2["closeParen"] = 41] = "closeParen";
  CharacterCodes2[CharacterCodes2["colon"] = 58] = "colon";
  CharacterCodes2[CharacterCodes2["comma"] = 44] = "comma";
  CharacterCodes2[CharacterCodes2["dot"] = 46] = "dot";
  CharacterCodes2[CharacterCodes2["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes2[CharacterCodes2["equals"] = 61] = "equals";
  CharacterCodes2[CharacterCodes2["exclamation"] = 33] = "exclamation";
  CharacterCodes2[CharacterCodes2["greaterThan"] = 62] = "greaterThan";
  CharacterCodes2[CharacterCodes2["lessThan"] = 60] = "lessThan";
  CharacterCodes2[CharacterCodes2["minus"] = 45] = "minus";
  CharacterCodes2[CharacterCodes2["openBrace"] = 123] = "openBrace";
  CharacterCodes2[CharacterCodes2["openBracket"] = 91] = "openBracket";
  CharacterCodes2[CharacterCodes2["openParen"] = 40] = "openParen";
  CharacterCodes2[CharacterCodes2["percent"] = 37] = "percent";
  CharacterCodes2[CharacterCodes2["plus"] = 43] = "plus";
  CharacterCodes2[CharacterCodes2["question"] = 63] = "question";
  CharacterCodes2[CharacterCodes2["semicolon"] = 59] = "semicolon";
  CharacterCodes2[CharacterCodes2["singleQuote"] = 39] = "singleQuote";
  CharacterCodes2[CharacterCodes2["slash"] = 47] = "slash";
  CharacterCodes2[CharacterCodes2["tilde"] = 126] = "tilde";
  CharacterCodes2[CharacterCodes2["backspace"] = 8] = "backspace";
  CharacterCodes2[CharacterCodes2["formFeed"] = 12] = "formFeed";
  CharacterCodes2[CharacterCodes2["byteOrderMark"] = 65279] = "byteOrderMark";
  CharacterCodes2[CharacterCodes2["tab"] = 9] = "tab";
  CharacterCodes2[CharacterCodes2["verticalTab"] = 11] = "verticalTab";
  return CharacterCodes2;
})(CharacterCodes || {});
function getLocation(text, position) {
  const segments = [];
  const earlyReturnException = new Object();
  let previousNode = void 0;
  const previousNodeInst = {
    value: {},
    offset: 0,
    length: 0,
    type: "object",
    parent: void 0
  };
  let isAtPropertyKey = false;
  function setPreviousNode(value, offset, length, type) {
    previousNodeInst.value = value;
    previousNodeInst.offset = offset;
    previousNodeInst.length = length;
    previousNodeInst.type = type;
    previousNodeInst.colonOffset = void 0;
    previousNode = previousNodeInst;
  }
  try {
    visit(text, {
      onObjectBegin: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        isAtPropertyKey = position > offset;
        segments.push("");
      },
      onObjectProperty: (name, offset, length) => {
        if (position < offset) {
          throw earlyReturnException;
        }
        setPreviousNode(name, offset, length, "property");
        segments[segments.length - 1] = name;
        if (position <= offset + length) {
          throw earlyReturnException;
        }
      },
      onObjectEnd: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.pop();
      },
      onArrayBegin: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.push(0);
      },
      onArrayEnd: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.pop();
      },
      onLiteralValue: (value, offset, length) => {
        if (position < offset) {
          throw earlyReturnException;
        }
        setPreviousNode(value, offset, length, getNodeType(value));
        if (position <= offset + length) {
          throw earlyReturnException;
        }
      },
      onSeparator: (sep, offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        if (sep === ":" && previousNode && previousNode.type === "property") {
          previousNode.colonOffset = offset;
          isAtPropertyKey = false;
          previousNode = void 0;
        } else if (sep === ",") {
          const last = segments[segments.length - 1];
          if (typeof last === "number") {
            segments[segments.length - 1] = last + 1;
          } else {
            isAtPropertyKey = true;
            segments[segments.length - 1] = "";
          }
          previousNode = void 0;
        }
      }
    });
  } catch (e) {
    if (e !== earlyReturnException) {
      throw e;
    }
  }
  return {
    path: segments,
    previousNode,
    isAtPropertyKey,
    matches: (pattern) => {
      let k = 0;
      for (let i = 0; k < pattern.length && i < segments.length; i++) {
        if (pattern[k] === segments[i] || pattern[k] === "*") {
          k++;
        } else if (pattern[k] !== "**") {
          return false;
        }
      }
      return k === pattern.length;
    }
  };
}
function parse(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];
  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }
  const visitor = {
    onObjectBegin: () => {
      const object = {};
      onValue(object);
      previousParents.push(currentParent);
      currentParent = object;
      currentProperty = null;
    },
    onObjectProperty: (name) => {
      currentProperty = name;
    },
    onObjectEnd: () => {
      currentParent = previousParents.pop();
    },
    onArrayBegin: () => {
      const array = [];
      onValue(array);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: () => {
      currentParent = previousParents.pop();
    },
    onLiteralValue: onValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  return currentParent[0];
}
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentParent.type === "property") {
        if (sep === ":") {
          currentParent.colonOffset = offset;
        } else if (sep === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (const segment of path) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function getNodePath(node) {
  if (!node.parent || !node.parent.children) {
    return [];
  }
  const path = getNodePath(node.parent);
  if (node.parent.type === "property") {
    const key = node.parent.children[0].value;
    path.push(key);
  } else if (node.parent.type === "array") {
    const index = node.parent.children.indexOf(node);
    if (index !== -1) {
      path.push(index);
    }
  }
  return path;
}
function getNodeValue(node) {
  switch (node.type) {
    case "array":
      return node.children.map(getNodeValue);
    case "object": {
      const obj = /* @__PURE__ */ Object.create(null);
      for (const prop of node.children) {
        const valueNode = prop.children[1];
        if (valueNode) {
          obj[prop.children[0].value] = getNodeValue(valueNode);
        }
      }
      return obj;
    }
    case "null":
    case "string":
    case "number":
    case "boolean":
      return node.value;
    default:
      return void 0;
  }
}
function contains(node, offset, includeRightBound = false) {
  return offset >= node.offset && offset < node.offset + node.length || includeRightBound && offset === node.offset + node.length;
}
function findNodeAtOffset(node, offset, includeRightBound = false) {
  if (contains(node, offset, includeRightBound)) {
    const children = node.children;
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length && children[i].offset <= offset; i++) {
        const item = findNodeAtOffset(children[i], offset, includeRightBound);
        if (item) {
          return item;
        }
      }
    }
    return node;
  }
  return void 0;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength()) : () => true;
  }
  const onObjectBegin = toNoArgVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisit(visitor.onObjectProperty), onObjectEnd = toNoArgVisit(visitor.onObjectEnd), onArrayBegin = toNoArgVisit(visitor.onArrayBegin), onArrayEnd = toNoArgVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisit(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4 /* InvalidUnicode */:
          handleError(14 /* InvalidUnicode */);
          break;
        case 5 /* InvalidEscapeCharacter */:
          handleError(15 /* InvalidEscapeCharacter */);
          break;
        case 3 /* UnexpectedEndOfNumber */:
          handleError(13 /* UnexpectedEndOfNumber */);
          break;
        case 1 /* UnexpectedEndOfComment */:
          if (!disallowComments) {
            handleError(11 /* UnexpectedEndOfComment */);
          }
          break;
        case 2 /* UnexpectedEndOfString */:
          handleError(12 /* UnexpectedEndOfString */);
          break;
        case 6 /* InvalidCharacter */:
          handleError(16 /* InvalidCharacter */);
          break;
      }
      switch (token) {
        case 12 /* LineCommentTrivia */:
        case 13 /* BlockCommentTrivia */:
          if (disallowComments) {
            handleError(10 /* InvalidCommentToken */);
          } else {
            onComment();
          }
          break;
        case 16 /* Unknown */:
          handleError(1 /* InvalidSymbol */);
          break;
        case 15 /* Trivia */:
        case 14 /* LineBreakTrivia */:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17 /* EOF */) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11 /* NumericLiteral */: {
        let value = 0;
        try {
          value = JSON.parse(_scanner.getTokenValue());
          if (typeof value !== "number") {
            handleError(2 /* InvalidNumberFormat */);
            value = 0;
          }
        } catch (e) {
          handleError(2 /* InvalidNumberFormat */);
        }
        onLiteralValue(value);
        break;
      }
      case 7 /* NullKeyword */:
        onLiteralValue(null);
        break;
      case 8 /* TrueKeyword */:
        onLiteralValue(true);
        break;
      case 9 /* FalseKeyword */:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10 /* StringLiteral */) {
      handleError(3 /* PropertyNameExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6 /* ColonToken */) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError(4 /* ValueExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
      }
    } else {
      handleError(5 /* ColonExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
    }
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 /* CloseBraceToken */ && _scanner.getToken() !== 17 /* EOF */) {
      if (_scanner.getToken() === 5 /* CommaToken */) {
        if (!needsComma) {
          handleError(4 /* ValueExpected */, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 /* CloseBraceToken */ && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6 /* CommaExpected */, [], []);
      }
      if (!parseProperty()) {
        handleError(4 /* ValueExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2 /* CloseBraceToken */) {
      handleError(7 /* CloseBraceExpected */, [2 /* CloseBraceToken */], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 4 /* CloseBracketToken */ && _scanner.getToken() !== 17 /* EOF */) {
      if (_scanner.getToken() === 5 /* CommaToken */) {
        if (!needsComma) {
          handleError(4 /* ValueExpected */, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 /* CloseBracketToken */ && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6 /* CommaExpected */, [], []);
      }
      if (!parseValue()) {
        handleError(4 /* ValueExpected */, [], [4 /* CloseBracketToken */, 5 /* CommaToken */]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (_scanner.getToken() !== 4 /* CloseBracketToken */) {
      handleError(8 /* CloseBracketExpected */, [4 /* CloseBracketToken */], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3 /* OpenBracketToken */:
        return parseArray();
      case 1 /* OpenBraceToken */:
        return parseObject();
      case 10 /* StringLiteral */:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17 /* EOF */) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4 /* ValueExpected */, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4 /* ValueExpected */, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17 /* EOF */) {
    handleError(9 /* EndOfFileExpected */, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}
export {
  ParseErrorCode,
  ParseOptions,
  ScanError,
  SyntaxKind,
  contains,
  createScanner,
  findNodeAtLocation,
  findNodeAtOffset,
  getLocation,
  getNodePath,
  getNodeType,
  getNodeValue,
  parse,
  parseTree,
  visit
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9qc29uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZXhwb3J0IGNvbnN0IGVudW0gU2NhbkVycm9yIHtcblx0Tm9uZSA9IDAsXG5cdFVuZXhwZWN0ZWRFbmRPZkNvbW1lbnQgPSAxLFxuXHRVbmV4cGVjdGVkRW5kT2ZTdHJpbmcgPSAyLFxuXHRVbmV4cGVjdGVkRW5kT2ZOdW1iZXIgPSAzLFxuXHRJbnZhbGlkVW5pY29kZSA9IDQsXG5cdEludmFsaWRFc2NhcGVDaGFyYWN0ZXIgPSA1LFxuXHRJbnZhbGlkQ2hhcmFjdGVyID0gNlxufVxuXG5leHBvcnQgY29uc3QgZW51bSBTeW50YXhLaW5kIHtcblx0T3BlbkJyYWNlVG9rZW4gPSAxLFxuXHRDbG9zZUJyYWNlVG9rZW4gPSAyLFxuXHRPcGVuQnJhY2tldFRva2VuID0gMyxcblx0Q2xvc2VCcmFja2V0VG9rZW4gPSA0LFxuXHRDb21tYVRva2VuID0gNSxcblx0Q29sb25Ub2tlbiA9IDYsXG5cdE51bGxLZXl3b3JkID0gNyxcblx0VHJ1ZUtleXdvcmQgPSA4LFxuXHRGYWxzZUtleXdvcmQgPSA5LFxuXHRTdHJpbmdMaXRlcmFsID0gMTAsXG5cdE51bWVyaWNMaXRlcmFsID0gMTEsXG5cdExpbmVDb21tZW50VHJpdmlhID0gMTIsXG5cdEJsb2NrQ29tbWVudFRyaXZpYSA9IDEzLFxuXHRMaW5lQnJlYWtUcml2aWEgPSAxNCxcblx0VHJpdmlhID0gMTUsXG5cdFVua25vd24gPSAxNixcblx0RU9GID0gMTdcbn1cblxuLyoqXG4gKiBUaGUgc2Nhbm5lciBvYmplY3QsIHJlcHJlc2VudGluZyBhIEpTT04gc2Nhbm5lciBhdCBhIHBvc2l0aW9uIGluIHRoZSBpbnB1dCBzdHJpbmcuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSlNPTlNjYW5uZXIge1xuXHQvKipcblx0ICogU2V0cyB0aGUgc2NhbiBwb3NpdGlvbiB0byBhIG5ldyBvZmZzZXQuIEEgY2FsbCB0byAnc2NhbicgaXMgbmVlZGVkIHRvIGdldCB0aGUgZmlyc3QgdG9rZW4uXG5cdCAqL1xuXHRzZXRQb3NpdGlvbihwb3M6IG51bWJlcik6IHZvaWQ7XG5cdC8qKlxuXHQgKiBSZWFkIHRoZSBuZXh0IHRva2VuLiBSZXR1cm5zIHRoZSB0b2tlbiBjb2RlLlxuXHQgKi9cblx0c2NhbigpOiBTeW50YXhLaW5kO1xuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY3VycmVudCBzY2FuIHBvc2l0aW9uLCB3aGljaCBpcyBhZnRlciB0aGUgbGFzdCByZWFkIHRva2VuLlxuXHQgKi9cblx0Z2V0UG9zaXRpb24oKTogbnVtYmVyO1xuXHQvKipcblx0ICogUmV0dXJucyB0aGUgbGFzdCByZWFkIHRva2VuLlxuXHQgKi9cblx0Z2V0VG9rZW4oKTogU3ludGF4S2luZDtcblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGxhc3QgcmVhZCB0b2tlbiB2YWx1ZS4gVGhlIHZhbHVlIGZvciBzdHJpbmdzIGlzIHRoZSBkZWNvZGVkIHN0cmluZyBjb250ZW50LiBGb3IgbnVtYmVycyBpdHMgb2YgdHlwZSBudW1iZXIsIGZvciBib29sZWFuIGl0J3MgdHJ1ZSBvciBmYWxzZS5cblx0ICovXG5cdGdldFRva2VuVmFsdWUoKTogc3RyaW5nO1xuXHQvKipcblx0ICogVGhlIHN0YXJ0IG9mZnNldCBvZiB0aGUgbGFzdCByZWFkIHRva2VuLlxuXHQgKi9cblx0Z2V0VG9rZW5PZmZzZXQoKTogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIGxlbmd0aCBvZiB0aGUgbGFzdCByZWFkIHRva2VuLlxuXHQgKi9cblx0Z2V0VG9rZW5MZW5ndGgoKTogbnVtYmVyO1xuXHQvKipcblx0ICogQW4gZXJyb3IgY29kZSBvZiB0aGUgbGFzdCBzY2FuLlxuXHQgKi9cblx0Z2V0VG9rZW5FcnJvcigpOiBTY2FuRXJyb3I7XG59XG5cblxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlRXJyb3Ige1xuXHRlcnJvcjogUGFyc2VFcnJvckNvZGU7XG5cdG9mZnNldDogbnVtYmVyO1xuXHRsZW5ndGg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gUGFyc2VFcnJvckNvZGUge1xuXHRJbnZhbGlkU3ltYm9sID0gMSxcblx0SW52YWxpZE51bWJlckZvcm1hdCA9IDIsXG5cdFByb3BlcnR5TmFtZUV4cGVjdGVkID0gMyxcblx0VmFsdWVFeHBlY3RlZCA9IDQsXG5cdENvbG9uRXhwZWN0ZWQgPSA1LFxuXHRDb21tYUV4cGVjdGVkID0gNixcblx0Q2xvc2VCcmFjZUV4cGVjdGVkID0gNyxcblx0Q2xvc2VCcmFja2V0RXhwZWN0ZWQgPSA4LFxuXHRFbmRPZkZpbGVFeHBlY3RlZCA9IDksXG5cdEludmFsaWRDb21tZW50VG9rZW4gPSAxMCxcblx0VW5leHBlY3RlZEVuZE9mQ29tbWVudCA9IDExLFxuXHRVbmV4cGVjdGVkRW5kT2ZTdHJpbmcgPSAxMixcblx0VW5leHBlY3RlZEVuZE9mTnVtYmVyID0gMTMsXG5cdEludmFsaWRVbmljb2RlID0gMTQsXG5cdEludmFsaWRFc2NhcGVDaGFyYWN0ZXIgPSAxNSxcblx0SW52YWxpZENoYXJhY3RlciA9IDE2XG59XG5cbmV4cG9ydCB0eXBlIE5vZGVUeXBlID0gJ29iamVjdCcgfCAnYXJyYXknIHwgJ3Byb3BlcnR5JyB8ICdzdHJpbmcnIHwgJ251bWJlcicgfCAnYm9vbGVhbicgfCAnbnVsbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG5cdHJlYWRvbmx5IHR5cGU6IE5vZGVUeXBlO1xuXHRyZWFkb25seSB2YWx1ZT86IGFueTtcblx0cmVhZG9ubHkgb2Zmc2V0OiBudW1iZXI7XG5cdHJlYWRvbmx5IGxlbmd0aDogbnVtYmVyO1xuXHRyZWFkb25seSBjb2xvbk9mZnNldD86IG51bWJlcjtcblx0cmVhZG9ubHkgcGFyZW50PzogTm9kZTtcblx0cmVhZG9ubHkgY2hpbGRyZW4/OiBOb2RlW107XG59XG5cbmV4cG9ydCB0eXBlIFNlZ21lbnQgPSBzdHJpbmcgfCBudW1iZXI7XG5leHBvcnQgdHlwZSBKU09OUGF0aCA9IFNlZ21lbnRbXTtcblxuZXhwb3J0IGludGVyZmFjZSBMb2NhdGlvbiB7XG5cdC8qKlxuXHQgKiBUaGUgcHJldmlvdXMgcHJvcGVydHkga2V5IG9yIGxpdGVyYWwgdmFsdWUgKHN0cmluZywgbnVtYmVyLCBib29sZWFuIG9yIG51bGwpIG9yIHVuZGVmaW5lZC5cblx0ICovXG5cdHByZXZpb3VzTm9kZT86IE5vZGU7XG5cdC8qKlxuXHQgKiBUaGUgcGF0aCBkZXNjcmliaW5nIHRoZSBsb2NhdGlvbiBpbiB0aGUgSlNPTiBkb2N1bWVudC4gVGhlIHBhdGggY29uc2lzdHMgb2YgYSBzZXF1ZW5jZSBzdHJpbmdzXG5cdCAqIHJlcHJlc2VudGluZyBhbiBvYmplY3QgcHJvcGVydHkgb3IgbnVtYmVycyBmb3IgYXJyYXkgaW5kaWNlcy5cblx0ICovXG5cdHBhdGg6IEpTT05QYXRoO1xuXHQvKipcblx0ICogTWF0Y2hlcyB0aGUgbG9jYXRpb25zIHBhdGggYWdhaW5zdCBhIHBhdHRlcm4gY29uc2lzdGluZyBvZiBzdHJpbmdzIChmb3IgcHJvcGVydGllcykgYW5kIG51bWJlcnMgKGZvciBhcnJheSBpbmRpY2VzKS5cblx0ICogJyonIHdpbGwgbWF0Y2ggYSBzaW5nbGUgc2VnbWVudCwgb2YgYW55IHByb3BlcnR5IG5hbWUgb3IgaW5kZXguXG5cdCAqICcqKicgd2lsbCBtYXRjaCBhIHNlcXVlbmNlIG9mIHNlZ21lbnRzIG9yIG5vIHNlZ21lbnQsIG9mIGFueSBwcm9wZXJ0eSBuYW1lIG9yIGluZGV4LlxuXHQgKi9cblx0bWF0Y2hlczogKHBhdHRlcm5zOiBKU09OUGF0aCkgPT4gYm9vbGVhbjtcblx0LyoqXG5cdCAqIElmIHNldCwgdGhlIGxvY2F0aW9uJ3Mgb2Zmc2V0IGlzIGF0IGEgcHJvcGVydHkga2V5LlxuXHQgKi9cblx0aXNBdFByb3BlcnR5S2V5OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlT3B0aW9ucyB7XG5cdGRpc2FsbG93Q29tbWVudHM/OiBib29sZWFuO1xuXHRhbGxvd1RyYWlsaW5nQ29tbWE/OiBib29sZWFuO1xuXHRhbGxvd0VtcHR5Q29udGVudD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgUGFyc2VPcHRpb25zIHtcblx0ZXhwb3J0IGNvbnN0IERFRkFVTFQgPSB7XG5cdFx0YWxsb3dUcmFpbGluZ0NvbW1hOiB0cnVlXG5cdH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSlNPTlZpc2l0b3Ige1xuXHQvKipcblx0ICogSW52b2tlZCB3aGVuIGFuIG9wZW4gYnJhY2UgaXMgZW5jb3VudGVyZWQgYW5kIGFuIG9iamVjdCBpcyBzdGFydGVkLiBUaGUgb2Zmc2V0IGFuZCBsZW5ndGggcmVwcmVzZW50IHRoZSBsb2NhdGlvbiBvZiB0aGUgb3BlbiBicmFjZS5cblx0ICovXG5cdG9uT2JqZWN0QmVnaW4/OiAob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBJbnZva2VkIHdoZW4gYSBwcm9wZXJ0eSBpcyBlbmNvdW50ZXJlZC4gVGhlIG9mZnNldCBhbmQgbGVuZ3RoIHJlcHJlc2VudCB0aGUgbG9jYXRpb24gb2YgdGhlIHByb3BlcnR5IG5hbWUuXG5cdCAqL1xuXHRvbk9iamVjdFByb3BlcnR5PzogKHByb3BlcnR5OiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4gdm9pZDtcblxuXHQvKipcblx0ICogSW52b2tlZCB3aGVuIGEgY2xvc2luZyBicmFjZSBpcyBlbmNvdW50ZXJlZCBhbmQgYW4gb2JqZWN0IGlzIGNvbXBsZXRlZC4gVGhlIG9mZnNldCBhbmQgbGVuZ3RoIHJlcHJlc2VudCB0aGUgbG9jYXRpb24gb2YgdGhlIGNsb3NpbmcgYnJhY2UuXG5cdCAqL1xuXHRvbk9iamVjdEVuZD86IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEludm9rZWQgd2hlbiBhbiBvcGVuIGJyYWNrZXQgaXMgZW5jb3VudGVyZWQuIFRoZSBvZmZzZXQgYW5kIGxlbmd0aCByZXByZXNlbnQgdGhlIGxvY2F0aW9uIG9mIHRoZSBvcGVuIGJyYWNrZXQuXG5cdCAqL1xuXHRvbkFycmF5QmVnaW4/OiAob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBJbnZva2VkIHdoZW4gYSBjbG9zaW5nIGJyYWNrZXQgaXMgZW5jb3VudGVyZWQuIFRoZSBvZmZzZXQgYW5kIGxlbmd0aCByZXByZXNlbnQgdGhlIGxvY2F0aW9uIG9mIHRoZSBjbG9zaW5nIGJyYWNrZXQuXG5cdCAqL1xuXHRvbkFycmF5RW5kPzogKG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4gdm9pZDtcblxuXHQvKipcblx0ICogSW52b2tlZCB3aGVuIGEgbGl0ZXJhbCB2YWx1ZSBpcyBlbmNvdW50ZXJlZC4gVGhlIG9mZnNldCBhbmQgbGVuZ3RoIHJlcHJlc2VudCB0aGUgbG9jYXRpb24gb2YgdGhlIGxpdGVyYWwgdmFsdWUuXG5cdCAqL1xuXHRvbkxpdGVyYWxWYWx1ZT86ICh2YWx1ZTogYW55LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEludm9rZWQgd2hlbiBhIGNvbW1hIG9yIGNvbG9uIHNlcGFyYXRvciBpcyBlbmNvdW50ZXJlZC4gVGhlIG9mZnNldCBhbmQgbGVuZ3RoIHJlcHJlc2VudCB0aGUgbG9jYXRpb24gb2YgdGhlIHNlcGFyYXRvci5cblx0ICovXG5cdG9uU2VwYXJhdG9yPzogKGNoYXJhY3Rlcjogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHZvaWQ7XG5cblx0LyoqXG5cdCAqIFdoZW4gY29tbWVudHMgYXJlIGFsbG93ZWQsIGludm9rZWQgd2hlbiBhIGxpbmUgb3IgYmxvY2sgY29tbWVudCBpcyBlbmNvdW50ZXJlZC4gVGhlIG9mZnNldCBhbmQgbGVuZ3RoIHJlcHJlc2VudCB0aGUgbG9jYXRpb24gb2YgdGhlIGNvbW1lbnQuXG5cdCAqL1xuXHRvbkNvbW1lbnQ/OiAob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBJbnZva2VkIG9uIGFuIGVycm9yLlxuXHQgKi9cblx0b25FcnJvcj86IChlcnJvcjogUGFyc2VFcnJvckNvZGUsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4gdm9pZDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgSlNPTiBzY2FubmVyIG9uIHRoZSBnaXZlbiB0ZXh0LlxuICogSWYgaWdub3JlVHJpdmlhIGlzIHNldCwgd2hpdGVzcGFjZXMgb3IgY29tbWVudHMgYXJlIGlnbm9yZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTY2FubmVyKHRleHQ6IHN0cmluZywgaWdub3JlVHJpdmlhOiBib29sZWFuID0gZmFsc2UpOiBKU09OU2Nhbm5lciB7XG5cblx0bGV0IHBvcyA9IDA7XG5cdGNvbnN0IGxlbiA9IHRleHQubGVuZ3RoO1xuXHRsZXQgdmFsdWU6IHN0cmluZyA9ICcnO1xuXHRsZXQgdG9rZW5PZmZzZXQgPSAwO1xuXHRsZXQgdG9rZW46IFN5bnRheEtpbmQgPSBTeW50YXhLaW5kLlVua25vd247XG5cdGxldCBzY2FuRXJyb3I6IFNjYW5FcnJvciA9IFNjYW5FcnJvci5Ob25lO1xuXG5cdGZ1bmN0aW9uIHNjYW5IZXhEaWdpdHMoY291bnQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0bGV0IGRpZ2l0cyA9IDA7XG5cdFx0bGV0IGhleFZhbHVlID0gMDtcblx0XHR3aGlsZSAoZGlnaXRzIDwgY291bnQpIHtcblx0XHRcdGNvbnN0IGNoID0gdGV4dC5jaGFyQ29kZUF0KHBvcyk7XG5cdFx0XHRpZiAoY2ggPj0gQ2hhcmFjdGVyQ29kZXMuXzAgJiYgY2ggPD0gQ2hhcmFjdGVyQ29kZXMuXzkpIHtcblx0XHRcdFx0aGV4VmFsdWUgPSBoZXhWYWx1ZSAqIDE2ICsgY2ggLSBDaGFyYWN0ZXJDb2Rlcy5fMDtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNoID49IENoYXJhY3RlckNvZGVzLkEgJiYgY2ggPD0gQ2hhcmFjdGVyQ29kZXMuRikge1xuXHRcdFx0XHRoZXhWYWx1ZSA9IGhleFZhbHVlICogMTYgKyBjaCAtIENoYXJhY3RlckNvZGVzLkEgKyAxMDtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNoID49IENoYXJhY3RlckNvZGVzLmEgJiYgY2ggPD0gQ2hhcmFjdGVyQ29kZXMuZikge1xuXHRcdFx0XHRoZXhWYWx1ZSA9IGhleFZhbHVlICogMTYgKyBjaCAtIENoYXJhY3RlckNvZGVzLmEgKyAxMDtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdHBvcysrO1xuXHRcdFx0ZGlnaXRzKys7XG5cdFx0fVxuXHRcdGlmIChkaWdpdHMgPCBjb3VudCkge1xuXHRcdFx0aGV4VmFsdWUgPSAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIGhleFZhbHVlO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0UG9zaXRpb24obmV3UG9zaXRpb246IG51bWJlcikge1xuXHRcdHBvcyA9IG5ld1Bvc2l0aW9uO1xuXHRcdHZhbHVlID0gJyc7XG5cdFx0dG9rZW5PZmZzZXQgPSAwO1xuXHRcdHRva2VuID0gU3ludGF4S2luZC5Vbmtub3duO1xuXHRcdHNjYW5FcnJvciA9IFNjYW5FcnJvci5Ob25lO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2Nhbk51bWJlcigpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHN0YXJ0ID0gcG9zO1xuXHRcdGlmICh0ZXh0LmNoYXJDb2RlQXQocG9zKSA9PT0gQ2hhcmFjdGVyQ29kZXMuXzApIHtcblx0XHRcdHBvcysrO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwb3MrKztcblx0XHRcdHdoaWxlIChwb3MgPCB0ZXh0Lmxlbmd0aCAmJiBpc0RpZ2l0KHRleHQuY2hhckNvZGVBdChwb3MpKSkge1xuXHRcdFx0XHRwb3MrKztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHBvcyA8IHRleHQubGVuZ3RoICYmIHRleHQuY2hhckNvZGVBdChwb3MpID09PSBDaGFyYWN0ZXJDb2Rlcy5kb3QpIHtcblx0XHRcdHBvcysrO1xuXHRcdFx0aWYgKHBvcyA8IHRleHQubGVuZ3RoICYmIGlzRGlnaXQodGV4dC5jaGFyQ29kZUF0KHBvcykpKSB7XG5cdFx0XHRcdHBvcysrO1xuXHRcdFx0XHR3aGlsZSAocG9zIDwgdGV4dC5sZW5ndGggJiYgaXNEaWdpdCh0ZXh0LmNoYXJDb2RlQXQocG9zKSkpIHtcblx0XHRcdFx0XHRwb3MrKztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2NhbkVycm9yID0gU2NhbkVycm9yLlVuZXhwZWN0ZWRFbmRPZk51bWJlcjtcblx0XHRcdFx0cmV0dXJuIHRleHQuc3Vic3RyaW5nKHN0YXJ0LCBwb3MpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRsZXQgZW5kID0gcG9zO1xuXHRcdGlmIChwb3MgPCB0ZXh0Lmxlbmd0aCAmJiAodGV4dC5jaGFyQ29kZUF0KHBvcykgPT09IENoYXJhY3RlckNvZGVzLkUgfHwgdGV4dC5jaGFyQ29kZUF0KHBvcykgPT09IENoYXJhY3RlckNvZGVzLmUpKSB7XG5cdFx0XHRwb3MrKztcblx0XHRcdGlmIChwb3MgPCB0ZXh0Lmxlbmd0aCAmJiB0ZXh0LmNoYXJDb2RlQXQocG9zKSA9PT0gQ2hhcmFjdGVyQ29kZXMucGx1cyB8fCB0ZXh0LmNoYXJDb2RlQXQocG9zKSA9PT0gQ2hhcmFjdGVyQ29kZXMubWludXMpIHtcblx0XHRcdFx0cG9zKys7XG5cdFx0XHR9XG5cdFx0XHRpZiAocG9zIDwgdGV4dC5sZW5ndGggJiYgaXNEaWdpdCh0ZXh0LmNoYXJDb2RlQXQocG9zKSkpIHtcblx0XHRcdFx0cG9zKys7XG5cdFx0XHRcdHdoaWxlIChwb3MgPCB0ZXh0Lmxlbmd0aCAmJiBpc0RpZ2l0KHRleHQuY2hhckNvZGVBdChwb3MpKSkge1xuXHRcdFx0XHRcdHBvcysrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVuZCA9IHBvcztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNjYW5FcnJvciA9IFNjYW5FcnJvci5VbmV4cGVjdGVkRW5kT2ZOdW1iZXI7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0ZXh0LnN1YnN0cmluZyhzdGFydCwgZW5kKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNjYW5TdHJpbmcoKTogc3RyaW5nIHtcblxuXHRcdGxldCByZXN1bHQgPSAnJyxcblx0XHRcdHN0YXJ0ID0gcG9zO1xuXG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGlmIChwb3MgPj0gbGVuKSB7XG5cdFx0XHRcdHJlc3VsdCArPSB0ZXh0LnN1YnN0cmluZyhzdGFydCwgcG9zKTtcblx0XHRcdFx0c2NhbkVycm9yID0gU2NhbkVycm9yLlVuZXhwZWN0ZWRFbmRPZlN0cmluZztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjaCA9IHRleHQuY2hhckNvZGVBdChwb3MpO1xuXHRcdFx0aWYgKGNoID09PSBDaGFyYWN0ZXJDb2Rlcy5kb3VibGVRdW90ZSkge1xuXHRcdFx0XHRyZXN1bHQgKz0gdGV4dC5zdWJzdHJpbmcoc3RhcnQsIHBvcyk7XG5cdFx0XHRcdHBvcysrO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGlmIChjaCA9PT0gQ2hhcmFjdGVyQ29kZXMuYmFja3NsYXNoKSB7XG5cdFx0XHRcdHJlc3VsdCArPSB0ZXh0LnN1YnN0cmluZyhzdGFydCwgcG9zKTtcblx0XHRcdFx0cG9zKys7XG5cdFx0XHRcdGlmIChwb3MgPj0gbGVuKSB7XG5cdFx0XHRcdFx0c2NhbkVycm9yID0gU2NhbkVycm9yLlVuZXhwZWN0ZWRFbmRPZlN0cmluZztcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjaDIgPSB0ZXh0LmNoYXJDb2RlQXQocG9zKyspO1xuXHRcdFx0XHRzd2l0Y2ggKGNoMikge1xuXHRcdFx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMuZG91YmxlUXVvdGU6XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gJ1xcXCInO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5iYWNrc2xhc2g6XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gJ1xcXFwnO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5zbGFzaDpcblx0XHRcdFx0XHRcdHJlc3VsdCArPSAnLyc7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLmI6XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gJ1xcYic7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLmY6XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gJ1xcZic7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLm46XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gJ1xcbic7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLnI6XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gJ1xccic7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLnQ6XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gJ1xcdCc7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLnU6IHtcblx0XHRcdFx0XHRcdGNvbnN0IGNoMyA9IHNjYW5IZXhEaWdpdHMoNCk7XG5cdFx0XHRcdFx0XHRpZiAoY2gzID49IDApIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY2gzKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHNjYW5FcnJvciA9IFNjYW5FcnJvci5JbnZhbGlkVW5pY29kZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0c2NhbkVycm9yID0gU2NhbkVycm9yLkludmFsaWRFc2NhcGVDaGFyYWN0ZXI7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RhcnQgPSBwb3M7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNoID49IDAgJiYgY2ggPD0gMHgxRikge1xuXHRcdFx0XHRpZiAoaXNMaW5lQnJlYWsoY2gpKSB7XG5cdFx0XHRcdFx0cmVzdWx0ICs9IHRleHQuc3Vic3RyaW5nKHN0YXJ0LCBwb3MpO1xuXHRcdFx0XHRcdHNjYW5FcnJvciA9IFNjYW5FcnJvci5VbmV4cGVjdGVkRW5kT2ZTdHJpbmc7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2NhbkVycm9yID0gU2NhbkVycm9yLkludmFsaWRDaGFyYWN0ZXI7XG5cdFx0XHRcdFx0Ly8gbWFyayBhcyBlcnJvciBidXQgY29udGludWUgd2l0aCBzdHJpbmdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cG9zKys7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBzY2FuTmV4dCgpOiBTeW50YXhLaW5kIHtcblxuXHRcdHZhbHVlID0gJyc7XG5cdFx0c2NhbkVycm9yID0gU2NhbkVycm9yLk5vbmU7XG5cblx0XHR0b2tlbk9mZnNldCA9IHBvcztcblxuXHRcdGlmIChwb3MgPj0gbGVuKSB7XG5cdFx0XHQvLyBhdCB0aGUgZW5kXG5cdFx0XHR0b2tlbk9mZnNldCA9IGxlbjtcblx0XHRcdHJldHVybiB0b2tlbiA9IFN5bnRheEtpbmQuRU9GO1xuXHRcdH1cblxuXHRcdGxldCBjb2RlID0gdGV4dC5jaGFyQ29kZUF0KHBvcyk7XG5cdFx0Ly8gdHJpdmlhOiB3aGl0ZXNwYWNlXG5cdFx0aWYgKGlzV2hpdGVzcGFjZShjb2RlKSkge1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRwb3MrKztcblx0XHRcdFx0dmFsdWUgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKTtcblx0XHRcdFx0Y29kZSA9IHRleHQuY2hhckNvZGVBdChwb3MpO1xuXHRcdFx0fSB3aGlsZSAoaXNXaGl0ZXNwYWNlKGNvZGUpKTtcblxuXHRcdFx0cmV0dXJuIHRva2VuID0gU3ludGF4S2luZC5Ucml2aWE7XG5cdFx0fVxuXG5cdFx0Ly8gdHJpdmlhOiBuZXdsaW5lc1xuXHRcdGlmIChpc0xpbmVCcmVhayhjb2RlKSkge1xuXHRcdFx0cG9zKys7XG5cdFx0XHR2YWx1ZSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpO1xuXHRcdFx0aWYgKGNvZGUgPT09IENoYXJhY3RlckNvZGVzLmNhcnJpYWdlUmV0dXJuICYmIHRleHQuY2hhckNvZGVBdChwb3MpID09PSBDaGFyYWN0ZXJDb2Rlcy5saW5lRmVlZCkge1xuXHRcdFx0XHRwb3MrKztcblx0XHRcdFx0dmFsdWUgKz0gJ1xcbic7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLkxpbmVCcmVha1RyaXZpYTtcblx0XHR9XG5cblx0XHRzd2l0Y2ggKGNvZGUpIHtcblx0XHRcdC8vIHRva2VuczogW117fTosXG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLm9wZW5CcmFjZTpcblx0XHRcdFx0cG9zKys7XG5cdFx0XHRcdHJldHVybiB0b2tlbiA9IFN5bnRheEtpbmQuT3BlbkJyYWNlVG9rZW47XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLmNsb3NlQnJhY2U6XG5cdFx0XHRcdHBvcysrO1xuXHRcdFx0XHRyZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLkNsb3NlQnJhY2VUb2tlbjtcblx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMub3BlbkJyYWNrZXQ6XG5cdFx0XHRcdHBvcysrO1xuXHRcdFx0XHRyZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLk9wZW5CcmFja2V0VG9rZW47XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLmNsb3NlQnJhY2tldDpcblx0XHRcdFx0cG9zKys7XG5cdFx0XHRcdHJldHVybiB0b2tlbiA9IFN5bnRheEtpbmQuQ2xvc2VCcmFja2V0VG9rZW47XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLmNvbG9uOlxuXHRcdFx0XHRwb3MrKztcblx0XHRcdFx0cmV0dXJuIHRva2VuID0gU3ludGF4S2luZC5Db2xvblRva2VuO1xuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5jb21tYTpcblx0XHRcdFx0cG9zKys7XG5cdFx0XHRcdHJldHVybiB0b2tlbiA9IFN5bnRheEtpbmQuQ29tbWFUb2tlbjtcblxuXHRcdFx0Ly8gc3RyaW5nc1xuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5kb3VibGVRdW90ZTpcblx0XHRcdFx0cG9zKys7XG5cdFx0XHRcdHZhbHVlID0gc2NhblN0cmluZygpO1xuXHRcdFx0XHRyZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLlN0cmluZ0xpdGVyYWw7XG5cblx0XHRcdC8vIGNvbW1lbnRzXG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLnNsYXNoOiB7XG5cdFx0XHRcdGNvbnN0IHN0YXJ0ID0gcG9zIC0gMTtcblx0XHRcdFx0Ly8gU2luZ2xlLWxpbmUgY29tbWVudFxuXHRcdFx0XHRpZiAodGV4dC5jaGFyQ29kZUF0KHBvcyArIDEpID09PSBDaGFyYWN0ZXJDb2Rlcy5zbGFzaCkge1xuXHRcdFx0XHRcdHBvcyArPSAyO1xuXG5cdFx0XHRcdFx0d2hpbGUgKHBvcyA8IGxlbikge1xuXHRcdFx0XHRcdFx0aWYgKGlzTGluZUJyZWFrKHRleHQuY2hhckNvZGVBdChwb3MpKSkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHBvcysrO1xuXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhbHVlID0gdGV4dC5zdWJzdHJpbmcoc3RhcnQsIHBvcyk7XG5cdFx0XHRcdFx0cmV0dXJuIHRva2VuID0gU3ludGF4S2luZC5MaW5lQ29tbWVudFRyaXZpYTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE11bHRpLWxpbmUgY29tbWVudFxuXHRcdFx0XHRpZiAodGV4dC5jaGFyQ29kZUF0KHBvcyArIDEpID09PSBDaGFyYWN0ZXJDb2Rlcy5hc3Rlcmlzaykge1xuXHRcdFx0XHRcdHBvcyArPSAyO1xuXG5cdFx0XHRcdFx0Y29uc3Qgc2FmZUxlbmd0aCA9IGxlbiAtIDE7IC8vIEZvciBsb29rYWhlYWQuXG5cdFx0XHRcdFx0bGV0IGNvbW1lbnRDbG9zZWQgPSBmYWxzZTtcblx0XHRcdFx0XHR3aGlsZSAocG9zIDwgc2FmZUxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY2ggPSB0ZXh0LmNoYXJDb2RlQXQocG9zKTtcblxuXHRcdFx0XHRcdFx0aWYgKGNoID09PSBDaGFyYWN0ZXJDb2Rlcy5hc3RlcmlzayAmJiB0ZXh0LmNoYXJDb2RlQXQocG9zICsgMSkgPT09IENoYXJhY3RlckNvZGVzLnNsYXNoKSB7XG5cdFx0XHRcdFx0XHRcdHBvcyArPSAyO1xuXHRcdFx0XHRcdFx0XHRjb21tZW50Q2xvc2VkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRwb3MrKztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWNvbW1lbnRDbG9zZWQpIHtcblx0XHRcdFx0XHRcdHBvcysrO1xuXHRcdFx0XHRcdFx0c2NhbkVycm9yID0gU2NhbkVycm9yLlVuZXhwZWN0ZWRFbmRPZkNvbW1lbnQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFsdWUgPSB0ZXh0LnN1YnN0cmluZyhzdGFydCwgcG9zKTtcblx0XHRcdFx0XHRyZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLkJsb2NrQ29tbWVudFRyaXZpYTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBqdXN0IGEgc2luZ2xlIHNsYXNoXG5cdFx0XHRcdHZhbHVlICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY29kZSk7XG5cdFx0XHRcdHBvcysrO1xuXHRcdFx0XHRyZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLlVua25vd247XG5cdFx0XHR9XG5cdFx0XHQvLyBudW1iZXJzXG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLm1pbnVzOlxuXHRcdFx0XHR2YWx1ZSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpO1xuXHRcdFx0XHRwb3MrKztcblx0XHRcdFx0aWYgKHBvcyA9PT0gbGVuIHx8ICFpc0RpZ2l0KHRleHQuY2hhckNvZGVBdChwb3MpKSkge1xuXHRcdFx0XHRcdHJldHVybiB0b2tlbiA9IFN5bnRheEtpbmQuVW5rbm93bjtcblx0XHRcdFx0fVxuXHRcdFx0Ly8gZm91bmQgYSBtaW51cywgZm9sbG93ZWQgYnkgYSBudW1iZXIgc29cblx0XHRcdC8vIHdlIGZhbGwgdGhyb3VnaCB0byBwcm9jZWVkIHdpdGggc2Nhbm5pbmdcblx0XHRcdC8vIG51bWJlcnNcblx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMuXzA6XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLl8xOlxuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5fMjpcblx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMuXzM6XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLl80OlxuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5fNTpcblx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMuXzY6XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLl83OlxuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5fODpcblx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMuXzk6XG5cdFx0XHRcdHZhbHVlICs9IHNjYW5OdW1iZXIoKTtcblx0XHRcdFx0cmV0dXJuIHRva2VuID0gU3ludGF4S2luZC5OdW1lcmljTGl0ZXJhbDtcblx0XHRcdC8vIGxpdGVyYWxzIGFuZCB1bmtub3duIHN5bWJvbHNcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdC8vIGlzIGEgbGl0ZXJhbD8gUmVhZCB0aGUgZnVsbCB3b3JkLlxuXHRcdFx0XHR3aGlsZSAocG9zIDwgbGVuICYmIGlzVW5rbm93bkNvbnRlbnRDaGFyYWN0ZXIoY29kZSkpIHtcblx0XHRcdFx0XHRwb3MrKztcblx0XHRcdFx0XHRjb2RlID0gdGV4dC5jaGFyQ29kZUF0KHBvcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRva2VuT2Zmc2V0ICE9PSBwb3MpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRleHQuc3Vic3RyaW5nKHRva2VuT2Zmc2V0LCBwb3MpO1xuXHRcdFx0XHRcdC8vIGtleXdvcmRzOiB0cnVlLCBmYWxzZSwgbnVsbFxuXHRcdFx0XHRcdHN3aXRjaCAodmFsdWUpIHtcblx0XHRcdFx0XHRcdGNhc2UgJ3RydWUnOiByZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLlRydWVLZXl3b3JkO1xuXHRcdFx0XHRcdFx0Y2FzZSAnZmFsc2UnOiByZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLkZhbHNlS2V5d29yZDtcblx0XHRcdFx0XHRcdGNhc2UgJ251bGwnOiByZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLk51bGxLZXl3b3JkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdG9rZW4gPSBTeW50YXhLaW5kLlVua25vd247XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gc29tZVxuXHRcdFx0XHR2YWx1ZSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpO1xuXHRcdFx0XHRwb3MrKztcblx0XHRcdFx0cmV0dXJuIHRva2VuID0gU3ludGF4S2luZC5Vbmtub3duO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGlzVW5rbm93bkNvbnRlbnRDaGFyYWN0ZXIoY29kZTogQ2hhcmFjdGVyQ29kZXMpIHtcblx0XHRpZiAoaXNXaGl0ZXNwYWNlKGNvZGUpIHx8IGlzTGluZUJyZWFrKGNvZGUpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHN3aXRjaCAoY29kZSkge1xuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5jbG9zZUJyYWNlOlxuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5jbG9zZUJyYWNrZXQ6XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLm9wZW5CcmFjZTpcblx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMub3BlbkJyYWNrZXQ6XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLmRvdWJsZVF1b3RlOlxuXHRcdFx0Y2FzZSBDaGFyYWN0ZXJDb2Rlcy5jb2xvbjpcblx0XHRcdGNhc2UgQ2hhcmFjdGVyQ29kZXMuY29tbWE6XG5cdFx0XHRjYXNlIENoYXJhY3RlckNvZGVzLnNsYXNoOlxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblxuXHRmdW5jdGlvbiBzY2FuTmV4dE5vblRyaXZpYSgpOiBTeW50YXhLaW5kIHtcblx0XHRsZXQgcmVzdWx0OiBTeW50YXhLaW5kO1xuXHRcdGRvIHtcblx0XHRcdHJlc3VsdCA9IHNjYW5OZXh0KCk7XG5cdFx0fSB3aGlsZSAocmVzdWx0ID49IFN5bnRheEtpbmQuTGluZUNvbW1lbnRUcml2aWEgJiYgcmVzdWx0IDw9IFN5bnRheEtpbmQuVHJpdmlhKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRzZXRQb3NpdGlvbjogc2V0UG9zaXRpb24sXG5cdFx0Z2V0UG9zaXRpb246ICgpID0+IHBvcyxcblx0XHRzY2FuOiBpZ25vcmVUcml2aWEgPyBzY2FuTmV4dE5vblRyaXZpYSA6IHNjYW5OZXh0LFxuXHRcdGdldFRva2VuOiAoKSA9PiB0b2tlbixcblx0XHRnZXRUb2tlblZhbHVlOiAoKSA9PiB2YWx1ZSxcblx0XHRnZXRUb2tlbk9mZnNldDogKCkgPT4gdG9rZW5PZmZzZXQsXG5cdFx0Z2V0VG9rZW5MZW5ndGg6ICgpID0+IHBvcyAtIHRva2VuT2Zmc2V0LFxuXHRcdGdldFRva2VuRXJyb3I6ICgpID0+IHNjYW5FcnJvclxuXHR9O1xufVxuXG5mdW5jdGlvbiBpc1doaXRlc3BhY2UoY2g6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gY2ggPT09IENoYXJhY3RlckNvZGVzLnNwYWNlIHx8IGNoID09PSBDaGFyYWN0ZXJDb2Rlcy50YWIgfHwgY2ggPT09IENoYXJhY3RlckNvZGVzLnZlcnRpY2FsVGFiIHx8IGNoID09PSBDaGFyYWN0ZXJDb2Rlcy5mb3JtRmVlZCB8fFxuXHRcdGNoID09PSBDaGFyYWN0ZXJDb2Rlcy5ub25CcmVha2luZ1NwYWNlIHx8IGNoID09PSBDaGFyYWN0ZXJDb2Rlcy5vZ2hhbSB8fCBjaCA+PSBDaGFyYWN0ZXJDb2Rlcy5lblF1YWQgJiYgY2ggPD0gQ2hhcmFjdGVyQ29kZXMuemVyb1dpZHRoU3BhY2UgfHxcblx0XHRjaCA9PT0gQ2hhcmFjdGVyQ29kZXMubmFycm93Tm9CcmVha1NwYWNlIHx8IGNoID09PSBDaGFyYWN0ZXJDb2Rlcy5tYXRoZW1hdGljYWxTcGFjZSB8fCBjaCA9PT0gQ2hhcmFjdGVyQ29kZXMuaWRlb2dyYXBoaWNTcGFjZSB8fCBjaCA9PT0gQ2hhcmFjdGVyQ29kZXMuYnl0ZU9yZGVyTWFyaztcbn1cblxuZnVuY3Rpb24gaXNMaW5lQnJlYWsoY2g6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gY2ggPT09IENoYXJhY3RlckNvZGVzLmxpbmVGZWVkIHx8IGNoID09PSBDaGFyYWN0ZXJDb2Rlcy5jYXJyaWFnZVJldHVybiB8fCBjaCA9PT0gQ2hhcmFjdGVyQ29kZXMubGluZVNlcGFyYXRvciB8fCBjaCA9PT0gQ2hhcmFjdGVyQ29kZXMucGFyYWdyYXBoU2VwYXJhdG9yO1xufVxuXG5mdW5jdGlvbiBpc0RpZ2l0KGNoOiBudW1iZXIpOiBib29sZWFuIHtcblx0cmV0dXJuIGNoID49IENoYXJhY3RlckNvZGVzLl8wICYmIGNoIDw9IENoYXJhY3RlckNvZGVzLl85O1xufVxuXG5jb25zdCBlbnVtIENoYXJhY3RlckNvZGVzIHtcblx0bnVsbENoYXJhY3RlciA9IDAsXG5cdG1heEFzY2lpQ2hhcmFjdGVyID0gMHg3RixcblxuXHRsaW5lRmVlZCA9IDB4MEEsICAgICAgICAgICAgICAvLyBcXG5cblx0Y2FycmlhZ2VSZXR1cm4gPSAweDBELCAgICAgICAgLy8gXFxyXG5cdGxpbmVTZXBhcmF0b3IgPSAweDIwMjgsXG5cdHBhcmFncmFwaFNlcGFyYXRvciA9IDB4MjAyOSxcblxuXHQvLyBSRVZJRVc6IGRvIHdlIG5lZWQgdG8gc3VwcG9ydCB0aGlzPyAgVGhlIHNjYW5uZXIgZG9lc24ndCwgYnV0IG91ciBJVGV4dCBkb2VzLiAgVGhpcyBzZWVtc1xuXHQvLyBsaWtlIGFuIG9kZCBkaXNwYXJpdHk/ICAoT3IgbWF5YmUgaXQncyBjb21wbGV0ZWx5IGZpbmUgZm9yIHRoZW0gdG8gYmUgZGlmZmVyZW50KS5cblx0bmV4dExpbmUgPSAweDAwODUsXG5cblx0Ly8gVW5pY29kZSAzLjAgc3BhY2UgY2hhcmFjdGVyc1xuXHRzcGFjZSA9IDB4MDAyMCwgICAvLyBcIiBcIlxuXHRub25CcmVha2luZ1NwYWNlID0gMHgwMEEwLCAgIC8vXG5cdGVuUXVhZCA9IDB4MjAwMCxcblx0ZW1RdWFkID0gMHgyMDAxLFxuXHRlblNwYWNlID0gMHgyMDAyLFxuXHRlbVNwYWNlID0gMHgyMDAzLFxuXHR0aHJlZVBlckVtU3BhY2UgPSAweDIwMDQsXG5cdGZvdXJQZXJFbVNwYWNlID0gMHgyMDA1LFxuXHRzaXhQZXJFbVNwYWNlID0gMHgyMDA2LFxuXHRmaWd1cmVTcGFjZSA9IDB4MjAwNyxcblx0cHVuY3R1YXRpb25TcGFjZSA9IDB4MjAwOCxcblx0dGhpblNwYWNlID0gMHgyMDA5LFxuXHRoYWlyU3BhY2UgPSAweDIwMEEsXG5cdHplcm9XaWR0aFNwYWNlID0gMHgyMDBCLFxuXHRuYXJyb3dOb0JyZWFrU3BhY2UgPSAweDIwMkYsXG5cdGlkZW9ncmFwaGljU3BhY2UgPSAweDMwMDAsXG5cdG1hdGhlbWF0aWNhbFNwYWNlID0gMHgyMDVGLFxuXHRvZ2hhbSA9IDB4MTY4MCxcblxuXHRfID0gMHg1Rixcblx0JCA9IDB4MjQsXG5cblx0XzAgPSAweDMwLFxuXHRfMSA9IDB4MzEsXG5cdF8yID0gMHgzMixcblx0XzMgPSAweDMzLFxuXHRfNCA9IDB4MzQsXG5cdF81ID0gMHgzNSxcblx0XzYgPSAweDM2LFxuXHRfNyA9IDB4MzcsXG5cdF84ID0gMHgzOCxcblx0XzkgPSAweDM5LFxuXG5cdGEgPSAweDYxLFxuXHRiID0gMHg2Mixcblx0YyA9IDB4NjMsXG5cdGQgPSAweDY0LFxuXHRlID0gMHg2NSxcblx0ZiA9IDB4NjYsXG5cdGcgPSAweDY3LFxuXHRoID0gMHg2OCxcblx0aSA9IDB4NjksXG5cdGogPSAweDZBLFxuXHRrID0gMHg2Qixcblx0bCA9IDB4NkMsXG5cdG0gPSAweDZELFxuXHRuID0gMHg2RSxcblx0byA9IDB4NkYsXG5cdHAgPSAweDcwLFxuXHRxID0gMHg3MSxcblx0ciA9IDB4NzIsXG5cdHMgPSAweDczLFxuXHR0ID0gMHg3NCxcblx0dSA9IDB4NzUsXG5cdHYgPSAweDc2LFxuXHR3ID0gMHg3Nyxcblx0eCA9IDB4NzgsXG5cdHkgPSAweDc5LFxuXHR6ID0gMHg3QSxcblxuXHRBID0gMHg0MSxcblx0QiA9IDB4NDIsXG5cdEMgPSAweDQzLFxuXHREID0gMHg0NCxcblx0RSA9IDB4NDUsXG5cdEYgPSAweDQ2LFxuXHRHID0gMHg0Nyxcblx0SCA9IDB4NDgsXG5cdEkgPSAweDQ5LFxuXHRKID0gMHg0QSxcblx0SyA9IDB4NEIsXG5cdEwgPSAweDRDLFxuXHRNID0gMHg0RCxcblx0TiA9IDB4NEUsXG5cdE8gPSAweDRGLFxuXHRQID0gMHg1MCxcblx0USA9IDB4NTEsXG5cdFIgPSAweDUyLFxuXHRTID0gMHg1Myxcblx0VCA9IDB4NTQsXG5cdFUgPSAweDU1LFxuXHRWID0gMHg1Nixcblx0VyA9IDB4NTcsXG5cdFggPSAweDU4LFxuXHRZID0gMHg1OSxcblx0WiA9IDB4NUEsXG5cblx0YW1wZXJzYW5kID0gMHgyNiwgICAgICAgICAgICAgLy8gJlxuXHRhc3RlcmlzayA9IDB4MkEsICAgICAgICAgICAgICAvLyAqXG5cdGF0ID0gMHg0MCwgICAgICAgICAgICAgICAgICAgIC8vIEBcblx0YmFja3NsYXNoID0gMHg1QywgICAgICAgICAgICAgLy8gXFxcblx0YmFyID0gMHg3QywgICAgICAgICAgICAgICAgICAgLy8gfFxuXHRjYXJldCA9IDB4NUUsICAgICAgICAgICAgICAgICAvLyBeXG5cdGNsb3NlQnJhY2UgPSAweDdELCAgICAgICAgICAgIC8vIH1cblx0Y2xvc2VCcmFja2V0ID0gMHg1RCwgICAgICAgICAgLy8gXVxuXHRjbG9zZVBhcmVuID0gMHgyOSwgICAgICAgICAgICAvLyApXG5cdGNvbG9uID0gMHgzQSwgICAgICAgICAgICAgICAgIC8vIDpcblx0Y29tbWEgPSAweDJDLCAgICAgICAgICAgICAgICAgLy8gLFxuXHRkb3QgPSAweDJFLCAgICAgICAgICAgICAgICAgICAvLyAuXG5cdGRvdWJsZVF1b3RlID0gMHgyMiwgICAgICAgICAgIC8vIFwiXG5cdGVxdWFscyA9IDB4M0QsICAgICAgICAgICAgICAgIC8vID1cblx0ZXhjbGFtYXRpb24gPSAweDIxLCAgICAgICAgICAgLy8gIVxuXHRncmVhdGVyVGhhbiA9IDB4M0UsICAgICAgICAgICAvLyA+XG5cdGxlc3NUaGFuID0gMHgzQywgICAgICAgICAgICAgIC8vIDxcblx0bWludXMgPSAweDJELCAgICAgICAgICAgICAgICAgLy8gLVxuXHRvcGVuQnJhY2UgPSAweDdCLCAgICAgICAgICAgICAvLyB7XG5cdG9wZW5CcmFja2V0ID0gMHg1QiwgICAgICAgICAgIC8vIFtcblx0b3BlblBhcmVuID0gMHgyOCwgICAgICAgICAgICAgLy8gKFxuXHRwZXJjZW50ID0gMHgyNSwgICAgICAgICAgICAgICAvLyAlXG5cdHBsdXMgPSAweDJCLCAgICAgICAgICAgICAgICAgIC8vICtcblx0cXVlc3Rpb24gPSAweDNGLCAgICAgICAgICAgICAgLy8gP1xuXHRzZW1pY29sb24gPSAweDNCLCAgICAgICAgICAgICAvLyA7XG5cdHNpbmdsZVF1b3RlID0gMHgyNywgICAgICAgICAgIC8vICdcblx0c2xhc2ggPSAweDJGLCAgICAgICAgICAgICAgICAgLy8gL1xuXHR0aWxkZSA9IDB4N0UsICAgICAgICAgICAgICAgICAvLyB+XG5cblx0YmFja3NwYWNlID0gMHgwOCwgICAgICAgICAgICAgLy8gXFxiXG5cdGZvcm1GZWVkID0gMHgwQywgICAgICAgICAgICAgIC8vIFxcZlxuXHRieXRlT3JkZXJNYXJrID0gMHhGRUZGLFxuXHR0YWIgPSAweDA5LCAgICAgICAgICAgICAgICAgICAvLyBcXHRcblx0dmVydGljYWxUYWIgPSAweDBCLCAgICAgICAgICAgLy8gXFx2XG59XG5cbmludGVyZmFjZSBOb2RlSW1wbCBleHRlbmRzIE5vZGUge1xuXHR0eXBlOiBOb2RlVHlwZTtcblx0dmFsdWU/OiBhbnk7XG5cdG9mZnNldDogbnVtYmVyO1xuXHRsZW5ndGg6IG51bWJlcjtcblx0Y29sb25PZmZzZXQ/OiBudW1iZXI7XG5cdHBhcmVudD86IE5vZGVJbXBsO1xuXHRjaGlsZHJlbj86IE5vZGVJbXBsW107XG59XG5cbi8qKlxuICogRm9yIGEgZ2l2ZW4gb2Zmc2V0LCBldmFsdWF0ZSB0aGUgbG9jYXRpb24gaW4gdGhlIEpTT04gZG9jdW1lbnQuIEVhY2ggc2VnbWVudCBpbiB0aGUgbG9jYXRpb24gcGF0aCBpcyBlaXRoZXIgYSBwcm9wZXJ0eSBuYW1lIG9yIGFuIGFycmF5IGluZGV4LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYXRpb24odGV4dDogc3RyaW5nLCBwb3NpdGlvbjogbnVtYmVyKTogTG9jYXRpb24ge1xuXHRjb25zdCBzZWdtZW50czogU2VnbWVudFtdID0gW107IC8vIHN0cmluZ3Mgb3IgbnVtYmVyc1xuXHRjb25zdCBlYXJseVJldHVybkV4Y2VwdGlvbiA9IG5ldyBPYmplY3QoKTtcblx0bGV0IHByZXZpb3VzTm9kZTogTm9kZUltcGwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGNvbnN0IHByZXZpb3VzTm9kZUluc3Q6IE5vZGVJbXBsID0ge1xuXHRcdHZhbHVlOiB7fSxcblx0XHRvZmZzZXQ6IDAsXG5cdFx0bGVuZ3RoOiAwLFxuXHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdHBhcmVudDogdW5kZWZpbmVkXG5cdH07XG5cdGxldCBpc0F0UHJvcGVydHlLZXkgPSBmYWxzZTtcblx0ZnVuY3Rpb24gc2V0UHJldmlvdXNOb2RlKHZhbHVlOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgdHlwZTogTm9kZVR5cGUpIHtcblx0XHRwcmV2aW91c05vZGVJbnN0LnZhbHVlID0gdmFsdWU7XG5cdFx0cHJldmlvdXNOb2RlSW5zdC5vZmZzZXQgPSBvZmZzZXQ7XG5cdFx0cHJldmlvdXNOb2RlSW5zdC5sZW5ndGggPSBsZW5ndGg7XG5cdFx0cHJldmlvdXNOb2RlSW5zdC50eXBlID0gdHlwZTtcblx0XHRwcmV2aW91c05vZGVJbnN0LmNvbG9uT2Zmc2V0ID0gdW5kZWZpbmVkO1xuXHRcdHByZXZpb3VzTm9kZSA9IHByZXZpb3VzTm9kZUluc3Q7XG5cdH1cblx0dHJ5IHtcblxuXHRcdHZpc2l0KHRleHQsIHtcblx0XHRcdG9uT2JqZWN0QmVnaW46IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdFx0aWYgKHBvc2l0aW9uIDw9IG9mZnNldCkge1xuXHRcdFx0XHRcdHRocm93IGVhcmx5UmV0dXJuRXhjZXB0aW9uO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZXZpb3VzTm9kZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aXNBdFByb3BlcnR5S2V5ID0gcG9zaXRpb24gPiBvZmZzZXQ7XG5cdFx0XHRcdHNlZ21lbnRzLnB1c2goJycpOyAvLyBwdXNoIGEgcGxhY2Vob2xkZXIgKHdpbGwgYmUgcmVwbGFjZWQpXG5cdFx0XHR9LFxuXHRcdFx0b25PYmplY3RQcm9wZXJ0eTogKG5hbWU6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdGlmIChwb3NpdGlvbiA8IG9mZnNldCkge1xuXHRcdFx0XHRcdHRocm93IGVhcmx5UmV0dXJuRXhjZXB0aW9uO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNldFByZXZpb3VzTm9kZShuYW1lLCBvZmZzZXQsIGxlbmd0aCwgJ3Byb3BlcnR5Jyk7XG5cdFx0XHRcdHNlZ21lbnRzW3NlZ21lbnRzLmxlbmd0aCAtIDFdID0gbmFtZTtcblx0XHRcdFx0aWYgKHBvc2l0aW9uIDw9IG9mZnNldCArIGxlbmd0aCkge1xuXHRcdFx0XHRcdHRocm93IGVhcmx5UmV0dXJuRXhjZXB0aW9uO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b25PYmplY3RFbmQ6IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdFx0aWYgKHBvc2l0aW9uIDw9IG9mZnNldCkge1xuXHRcdFx0XHRcdHRocm93IGVhcmx5UmV0dXJuRXhjZXB0aW9uO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZXZpb3VzTm9kZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0c2VnbWVudHMucG9wKCk7XG5cdFx0XHR9LFxuXHRcdFx0b25BcnJheUJlZ2luOiAob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdGlmIChwb3NpdGlvbiA8PSBvZmZzZXQpIHtcblx0XHRcdFx0XHR0aHJvdyBlYXJseVJldHVybkV4Y2VwdGlvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcmV2aW91c05vZGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHNlZ21lbnRzLnB1c2goMCk7XG5cdFx0XHR9LFxuXHRcdFx0b25BcnJheUVuZDogKG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRpZiAocG9zaXRpb24gPD0gb2Zmc2V0KSB7XG5cdFx0XHRcdFx0dGhyb3cgZWFybHlSZXR1cm5FeGNlcHRpb247XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJldmlvdXNOb2RlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRzZWdtZW50cy5wb3AoKTtcblx0XHRcdH0sXG5cdFx0XHRvbkxpdGVyYWxWYWx1ZTogKHZhbHVlOiBhbnksIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRpZiAocG9zaXRpb24gPCBvZmZzZXQpIHtcblx0XHRcdFx0XHR0aHJvdyBlYXJseVJldHVybkV4Y2VwdGlvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZXRQcmV2aW91c05vZGUodmFsdWUsIG9mZnNldCwgbGVuZ3RoLCBnZXROb2RlVHlwZSh2YWx1ZSkpO1xuXG5cdFx0XHRcdGlmIChwb3NpdGlvbiA8PSBvZmZzZXQgKyBsZW5ndGgpIHtcblx0XHRcdFx0XHR0aHJvdyBlYXJseVJldHVybkV4Y2VwdGlvbjtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uU2VwYXJhdG9yOiAoc2VwOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRpZiAocG9zaXRpb24gPD0gb2Zmc2V0KSB7XG5cdFx0XHRcdFx0dGhyb3cgZWFybHlSZXR1cm5FeGNlcHRpb247XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHNlcCA9PT0gJzonICYmIHByZXZpb3VzTm9kZSAmJiBwcmV2aW91c05vZGUudHlwZSA9PT0gJ3Byb3BlcnR5Jykge1xuXHRcdFx0XHRcdHByZXZpb3VzTm9kZS5jb2xvbk9mZnNldCA9IG9mZnNldDtcblx0XHRcdFx0XHRpc0F0UHJvcGVydHlLZXkgPSBmYWxzZTtcblx0XHRcdFx0XHRwcmV2aW91c05vZGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAoc2VwID09PSAnLCcpIHtcblx0XHRcdFx0XHRjb25zdCBsYXN0ID0gc2VnbWVudHNbc2VnbWVudHMubGVuZ3RoIC0gMV07XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBsYXN0ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0c2VnbWVudHNbc2VnbWVudHMubGVuZ3RoIC0gMV0gPSBsYXN0ICsgMTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aXNBdFByb3BlcnR5S2V5ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHNlZ21lbnRzW3NlZ21lbnRzLmxlbmd0aCAtIDFdID0gJyc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHByZXZpb3VzTm9kZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0aWYgKGUgIT09IGVhcmx5UmV0dXJuRXhjZXB0aW9uKSB7XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7XG5cdFx0cGF0aDogc2VnbWVudHMsXG5cdFx0cHJldmlvdXNOb2RlLFxuXHRcdGlzQXRQcm9wZXJ0eUtleSxcblx0XHRtYXRjaGVzOiAocGF0dGVybjogU2VnbWVudFtdKSA9PiB7XG5cdFx0XHRsZXQgayA9IDA7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgayA8IHBhdHRlcm4ubGVuZ3RoICYmIGkgPCBzZWdtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAocGF0dGVybltrXSA9PT0gc2VnbWVudHNbaV0gfHwgcGF0dGVybltrXSA9PT0gJyonKSB7XG5cdFx0XHRcdFx0aysrO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHBhdHRlcm5ba10gIT09ICcqKicpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBrID09PSBwYXR0ZXJuLmxlbmd0aDtcblx0XHR9XG5cdH07XG59XG5cblxuLyoqXG4gKiBQYXJzZXMgdGhlIGdpdmVuIHRleHQgYW5kIHJldHVybnMgdGhlIG9iamVjdCB0aGUgSlNPTiBjb250ZW50IHJlcHJlc2VudHMuIE9uIGludmFsaWQgaW5wdXQsIHRoZSBwYXJzZXIgdHJpZXMgdG8gYmUgYXMgZmF1bHQgdG9sZXJhbnQgYXMgcG9zc2libGUsIGJ1dCBzdGlsbCByZXR1cm4gYSByZXN1bHQuXG4gKiBUaGVyZWZvcmUgYWx3YXlzIGNoZWNrIHRoZSBlcnJvcnMgbGlzdCB0byBmaW5kIG91dCBpZiB0aGUgaW5wdXQgd2FzIHZhbGlkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2UodGV4dDogc3RyaW5nLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdLCBvcHRpb25zOiBQYXJzZU9wdGlvbnMgPSBQYXJzZU9wdGlvbnMuREVGQVVMVCk6IGFueSB7XG5cdGxldCBjdXJyZW50UHJvcGVydHk6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRsZXQgY3VycmVudFBhcmVudDogYW55ID0gW107XG5cdGNvbnN0IHByZXZpb3VzUGFyZW50czogYW55W10gPSBbXTtcblxuXHRmdW5jdGlvbiBvblZhbHVlKHZhbHVlOiBhbnkpIHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50UGFyZW50KSkge1xuXHRcdFx0KDxhbnlbXT5jdXJyZW50UGFyZW50KS5wdXNoKHZhbHVlKTtcblx0XHR9IGVsc2UgaWYgKGN1cnJlbnRQcm9wZXJ0eSAhPT0gbnVsbCkge1xuXHRcdFx0Y3VycmVudFBhcmVudFtjdXJyZW50UHJvcGVydHldID0gdmFsdWU7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgdmlzaXRvcjogSlNPTlZpc2l0b3IgPSB7XG5cdFx0b25PYmplY3RCZWdpbjogKCkgPT4ge1xuXHRcdFx0Y29uc3Qgb2JqZWN0ID0ge307XG5cdFx0XHRvblZhbHVlKG9iamVjdCk7XG5cdFx0XHRwcmV2aW91c1BhcmVudHMucHVzaChjdXJyZW50UGFyZW50KTtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBvYmplY3Q7XG5cdFx0XHRjdXJyZW50UHJvcGVydHkgPSBudWxsO1xuXHRcdH0sXG5cdFx0b25PYmplY3RQcm9wZXJ0eTogKG5hbWU6IHN0cmluZykgPT4ge1xuXHRcdFx0Y3VycmVudFByb3BlcnR5ID0gbmFtZTtcblx0XHR9LFxuXHRcdG9uT2JqZWN0RW5kOiAoKSA9PiB7XG5cdFx0XHRjdXJyZW50UGFyZW50ID0gcHJldmlvdXNQYXJlbnRzLnBvcCgpO1xuXHRcdH0sXG5cdFx0b25BcnJheUJlZ2luOiAoKSA9PiB7XG5cdFx0XHRjb25zdCBhcnJheTogYW55W10gPSBbXTtcblx0XHRcdG9uVmFsdWUoYXJyYXkpO1xuXHRcdFx0cHJldmlvdXNQYXJlbnRzLnB1c2goY3VycmVudFBhcmVudCk7XG5cdFx0XHRjdXJyZW50UGFyZW50ID0gYXJyYXk7XG5cdFx0XHRjdXJyZW50UHJvcGVydHkgPSBudWxsO1xuXHRcdH0sXG5cdFx0b25BcnJheUVuZDogKCkgPT4ge1xuXHRcdFx0Y3VycmVudFBhcmVudCA9IHByZXZpb3VzUGFyZW50cy5wb3AoKTtcblx0XHR9LFxuXHRcdG9uTGl0ZXJhbFZhbHVlOiBvblZhbHVlLFxuXHRcdG9uRXJyb3I6IChlcnJvcjogUGFyc2VFcnJvckNvZGUsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2goeyBlcnJvciwgb2Zmc2V0LCBsZW5ndGggfSk7XG5cdFx0fVxuXHR9O1xuXHR2aXNpdCh0ZXh0LCB2aXNpdG9yLCBvcHRpb25zKTtcblx0cmV0dXJuIGN1cnJlbnRQYXJlbnRbMF07XG59XG5cblxuLyoqXG4gKiBQYXJzZXMgdGhlIGdpdmVuIHRleHQgYW5kIHJldHVybnMgYSB0cmVlIHJlcHJlc2VudGF0aW9uIHRoZSBKU09OIGNvbnRlbnQuIE9uIGludmFsaWQgaW5wdXQsIHRoZSBwYXJzZXIgdHJpZXMgdG8gYmUgYXMgZmF1bHQgdG9sZXJhbnQgYXMgcG9zc2libGUsIGJ1dCBzdGlsbCByZXR1cm4gYSByZXN1bHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRyZWUodGV4dDogc3RyaW5nLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdLCBvcHRpb25zOiBQYXJzZU9wdGlvbnMgPSBQYXJzZU9wdGlvbnMuREVGQVVMVCk6IE5vZGUge1xuXHRsZXQgY3VycmVudFBhcmVudDogTm9kZUltcGwgPSB7IHR5cGU6ICdhcnJheScsIG9mZnNldDogLTEsIGxlbmd0aDogLTEsIGNoaWxkcmVuOiBbXSwgcGFyZW50OiB1bmRlZmluZWQgfTsgLy8gYXJ0aWZpY2lhbCByb290XG5cblx0ZnVuY3Rpb24gZW5zdXJlUHJvcGVydHlDb21wbGV0ZShlbmRPZmZzZXQ6IG51bWJlcikge1xuXHRcdGlmIChjdXJyZW50UGFyZW50LnR5cGUgPT09ICdwcm9wZXJ0eScpIHtcblx0XHRcdGN1cnJlbnRQYXJlbnQubGVuZ3RoID0gZW5kT2Zmc2V0IC0gY3VycmVudFBhcmVudC5vZmZzZXQ7XG5cdFx0XHRjdXJyZW50UGFyZW50ID0gY3VycmVudFBhcmVudC5wYXJlbnQhO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIG9uVmFsdWUodmFsdWVOb2RlOiBOb2RlKTogTm9kZSB7XG5cdFx0Y3VycmVudFBhcmVudC5jaGlsZHJlbiEucHVzaCh2YWx1ZU5vZGUpO1xuXHRcdHJldHVybiB2YWx1ZU5vZGU7XG5cdH1cblxuXHRjb25zdCB2aXNpdG9yOiBKU09OVmlzaXRvciA9IHtcblx0XHRvbk9iamVjdEJlZ2luOiAob2Zmc2V0OiBudW1iZXIpID0+IHtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBvblZhbHVlKHsgdHlwZTogJ29iamVjdCcsIG9mZnNldCwgbGVuZ3RoOiAtMSwgcGFyZW50OiBjdXJyZW50UGFyZW50LCBjaGlsZHJlbjogW10gfSk7XG5cdFx0fSxcblx0XHRvbk9iamVjdFByb3BlcnR5OiAobmFtZTogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBvblZhbHVlKHsgdHlwZTogJ3Byb3BlcnR5Jywgb2Zmc2V0LCBsZW5ndGg6IC0xLCBwYXJlbnQ6IGN1cnJlbnRQYXJlbnQsIGNoaWxkcmVuOiBbXSB9KTtcblx0XHRcdGN1cnJlbnRQYXJlbnQuY2hpbGRyZW4hLnB1c2goeyB0eXBlOiAnc3RyaW5nJywgdmFsdWU6IG5hbWUsIG9mZnNldCwgbGVuZ3RoLCBwYXJlbnQ6IGN1cnJlbnRQYXJlbnQgfSk7XG5cdFx0fSxcblx0XHRvbk9iamVjdEVuZDogKG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4ge1xuXHRcdFx0Y3VycmVudFBhcmVudC5sZW5ndGggPSBvZmZzZXQgKyBsZW5ndGggLSBjdXJyZW50UGFyZW50Lm9mZnNldDtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBjdXJyZW50UGFyZW50LnBhcmVudCE7XG5cdFx0XHRlbnN1cmVQcm9wZXJ0eUNvbXBsZXRlKG9mZnNldCArIGxlbmd0aCk7XG5cdFx0fSxcblx0XHRvbkFycmF5QmVnaW46IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBvblZhbHVlKHsgdHlwZTogJ2FycmF5Jywgb2Zmc2V0LCBsZW5ndGg6IC0xLCBwYXJlbnQ6IGN1cnJlbnRQYXJlbnQsIGNoaWxkcmVuOiBbXSB9KTtcblx0XHR9LFxuXHRcdG9uQXJyYXlFbmQ6IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdGN1cnJlbnRQYXJlbnQubGVuZ3RoID0gb2Zmc2V0ICsgbGVuZ3RoIC0gY3VycmVudFBhcmVudC5vZmZzZXQ7XG5cdFx0XHRjdXJyZW50UGFyZW50ID0gY3VycmVudFBhcmVudC5wYXJlbnQhO1xuXHRcdFx0ZW5zdXJlUHJvcGVydHlDb21wbGV0ZShvZmZzZXQgKyBsZW5ndGgpO1xuXHRcdH0sXG5cdFx0b25MaXRlcmFsVmFsdWU6ICh2YWx1ZTogYW55LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdG9uVmFsdWUoeyB0eXBlOiBnZXROb2RlVHlwZSh2YWx1ZSksIG9mZnNldCwgbGVuZ3RoLCBwYXJlbnQ6IGN1cnJlbnRQYXJlbnQsIHZhbHVlIH0pO1xuXHRcdFx0ZW5zdXJlUHJvcGVydHlDb21wbGV0ZShvZmZzZXQgKyBsZW5ndGgpO1xuXHRcdH0sXG5cdFx0b25TZXBhcmF0b3I6IChzZXA6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB7XG5cdFx0XHRpZiAoY3VycmVudFBhcmVudC50eXBlID09PSAncHJvcGVydHknKSB7XG5cdFx0XHRcdGlmIChzZXAgPT09ICc6Jykge1xuXHRcdFx0XHRcdGN1cnJlbnRQYXJlbnQuY29sb25PZmZzZXQgPSBvZmZzZXQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAoc2VwID09PSAnLCcpIHtcblx0XHRcdFx0XHRlbnN1cmVQcm9wZXJ0eUNvbXBsZXRlKG9mZnNldCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdG9uRXJyb3I6IChlcnJvcjogUGFyc2VFcnJvckNvZGUsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2goeyBlcnJvciwgb2Zmc2V0LCBsZW5ndGggfSk7XG5cdFx0fVxuXHR9O1xuXHR2aXNpdCh0ZXh0LCB2aXNpdG9yLCBvcHRpb25zKTtcblxuXHRjb25zdCByZXN1bHQgPSBjdXJyZW50UGFyZW50LmNoaWxkcmVuIVswXTtcblx0aWYgKHJlc3VsdCkge1xuXHRcdGRlbGV0ZSByZXN1bHQucGFyZW50O1xuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRmluZHMgdGhlIG5vZGUgYXQgdGhlIGdpdmVuIHBhdGggaW4gYSBKU09OIERPTS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmROb2RlQXRMb2NhdGlvbihyb290OiBOb2RlLCBwYXRoOiBKU09OUGF0aCk6IE5vZGUgfCB1bmRlZmluZWQge1xuXHRpZiAoIXJvb3QpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGxldCBub2RlID0gcm9vdDtcblx0Zm9yIChjb25zdCBzZWdtZW50IG9mIHBhdGgpIHtcblx0XHRpZiAodHlwZW9mIHNlZ21lbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRpZiAobm9kZS50eXBlICE9PSAnb2JqZWN0JyB8fCAhQXJyYXkuaXNBcnJheShub2RlLmNoaWxkcmVuKSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGZvdW5kID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IHByb3BlcnR5Tm9kZSBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHByb3BlcnR5Tm9kZS5jaGlsZHJlbikgJiYgcHJvcGVydHlOb2RlLmNoaWxkcmVuWzBdLnZhbHVlID09PSBzZWdtZW50KSB7XG5cdFx0XHRcdFx0bm9kZSA9IHByb3BlcnR5Tm9kZS5jaGlsZHJlblsxXTtcblx0XHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghZm91bmQpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgaW5kZXggPSA8bnVtYmVyPnNlZ21lbnQ7XG5cdFx0XHRpZiAobm9kZS50eXBlICE9PSAnYXJyYXknIHx8IGluZGV4IDwgMCB8fCAhQXJyYXkuaXNBcnJheShub2RlLmNoaWxkcmVuKSB8fCBpbmRleCA+PSBub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0bm9kZSA9IG5vZGUuY2hpbGRyZW5baW5kZXhdO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gbm9kZTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBKU09OIHBhdGggb2YgdGhlIGdpdmVuIEpTT04gRE9NIG5vZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5vZGVQYXRoKG5vZGU6IE5vZGUpOiBKU09OUGF0aCB7XG5cdGlmICghbm9kZS5wYXJlbnQgfHwgIW5vZGUucGFyZW50LmNoaWxkcmVuKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdGNvbnN0IHBhdGggPSBnZXROb2RlUGF0aChub2RlLnBhcmVudCk7XG5cdGlmIChub2RlLnBhcmVudC50eXBlID09PSAncHJvcGVydHknKSB7XG5cdFx0Y29uc3Qga2V5ID0gbm9kZS5wYXJlbnQuY2hpbGRyZW5bMF0udmFsdWU7XG5cdFx0cGF0aC5wdXNoKGtleSk7XG5cdH0gZWxzZSBpZiAobm9kZS5wYXJlbnQudHlwZSA9PT0gJ2FycmF5Jykge1xuXHRcdGNvbnN0IGluZGV4ID0gbm9kZS5wYXJlbnQuY2hpbGRyZW4uaW5kZXhPZihub2RlKTtcblx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRwYXRoLnB1c2goaW5kZXgpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBFdmFsdWF0ZXMgdGhlIEphdmFTY3JpcHQgb2JqZWN0IG9mIHRoZSBnaXZlbiBKU09OIERPTSBub2RlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROb2RlVmFsdWUobm9kZTogTm9kZSk6IGFueSB7XG5cdHN3aXRjaCAobm9kZS50eXBlKSB7XG5cdFx0Y2FzZSAnYXJyYXknOlxuXHRcdFx0cmV0dXJuIG5vZGUuY2hpbGRyZW4hLm1hcChnZXROb2RlVmFsdWUpO1xuXHRcdGNhc2UgJ29iamVjdCc6IHtcblx0XHRcdGNvbnN0IG9iaiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0XHRmb3IgKGNvbnN0IHByb3Agb2Ygbm9kZS5jaGlsZHJlbiEpIHtcblx0XHRcdFx0Y29uc3QgdmFsdWVOb2RlID0gcHJvcC5jaGlsZHJlbiFbMV07XG5cdFx0XHRcdGlmICh2YWx1ZU5vZGUpIHtcblx0XHRcdFx0XHRvYmpbcHJvcC5jaGlsZHJlbiFbMF0udmFsdWVdID0gZ2V0Tm9kZVZhbHVlKHZhbHVlTm9kZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBvYmo7XG5cdFx0fVxuXHRcdGNhc2UgJ251bGwnOlxuXHRcdGNhc2UgJ3N0cmluZyc6XG5cdFx0Y2FzZSAnbnVtYmVyJzpcblx0XHRjYXNlICdib29sZWFuJzpcblx0XHRcdHJldHVybiBub2RlLnZhbHVlO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnRhaW5zKG5vZGU6IE5vZGUsIG9mZnNldDogbnVtYmVyLCBpbmNsdWRlUmlnaHRCb3VuZCA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdHJldHVybiAob2Zmc2V0ID49IG5vZGUub2Zmc2V0ICYmIG9mZnNldCA8IChub2RlLm9mZnNldCArIG5vZGUubGVuZ3RoKSkgfHwgaW5jbHVkZVJpZ2h0Qm91bmQgJiYgKG9mZnNldCA9PT0gKG5vZGUub2Zmc2V0ICsgbm9kZS5sZW5ndGgpKTtcbn1cblxuLyoqXG4gKiBGaW5kcyB0aGUgbW9zdCBpbm5lciBub2RlIGF0IHRoZSBnaXZlbiBvZmZzZXQuIElmIGluY2x1ZGVSaWdodEJvdW5kIGlzIHNldCwgYWxzbyBmaW5kcyBub2RlcyB0aGF0IGVuZCBhdCB0aGUgZ2l2ZW4gb2Zmc2V0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZE5vZGVBdE9mZnNldChub2RlOiBOb2RlLCBvZmZzZXQ6IG51bWJlciwgaW5jbHVkZVJpZ2h0Qm91bmQgPSBmYWxzZSk6IE5vZGUgfCB1bmRlZmluZWQge1xuXHRpZiAoY29udGFpbnMobm9kZSwgb2Zmc2V0LCBpbmNsdWRlUmlnaHRCb3VuZCkpIHtcblx0XHRjb25zdCBjaGlsZHJlbiA9IG5vZGUuY2hpbGRyZW47XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY2hpbGRyZW4pKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aCAmJiBjaGlsZHJlbltpXS5vZmZzZXQgPD0gb2Zmc2V0OyBpKyspIHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IGZpbmROb2RlQXRPZmZzZXQoY2hpbGRyZW5baV0sIG9mZnNldCwgaW5jbHVkZVJpZ2h0Qm91bmQpO1xuXHRcdFx0XHRpZiAoaXRlbSkge1xuXHRcdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH1cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuXG4vKipcbiAqIFBhcnNlcyB0aGUgZ2l2ZW4gdGV4dCBhbmQgaW52b2tlcyB0aGUgdmlzaXRvciBmdW5jdGlvbnMgZm9yIGVhY2ggb2JqZWN0LCBhcnJheSBhbmQgbGl0ZXJhbCByZWFjaGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmlzaXQodGV4dDogc3RyaW5nLCB2aXNpdG9yOiBKU09OVmlzaXRvciwgb3B0aW9uczogUGFyc2VPcHRpb25zID0gUGFyc2VPcHRpb25zLkRFRkFVTFQpOiBhbnkge1xuXG5cdGNvbnN0IF9zY2FubmVyID0gY3JlYXRlU2Nhbm5lcih0ZXh0LCBmYWxzZSk7XG5cblx0ZnVuY3Rpb24gdG9Ob0FyZ1Zpc2l0KHZpc2l0RnVuY3Rpb24/OiAob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG5cdFx0cmV0dXJuIHZpc2l0RnVuY3Rpb24gPyAoKSA9PiB2aXNpdEZ1bmN0aW9uKF9zY2FubmVyLmdldFRva2VuT2Zmc2V0KCksIF9zY2FubmVyLmdldFRva2VuTGVuZ3RoKCkpIDogKCkgPT4gdHJ1ZTtcblx0fVxuXHRmdW5jdGlvbiB0b09uZUFyZ1Zpc2l0PFQ+KHZpc2l0RnVuY3Rpb24/OiAoYXJnOiBULCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHZvaWQpOiAoYXJnOiBUKSA9PiB2b2lkIHtcblx0XHRyZXR1cm4gdmlzaXRGdW5jdGlvbiA/IChhcmc6IFQpID0+IHZpc2l0RnVuY3Rpb24oYXJnLCBfc2Nhbm5lci5nZXRUb2tlbk9mZnNldCgpLCBfc2Nhbm5lci5nZXRUb2tlbkxlbmd0aCgpKSA6ICgpID0+IHRydWU7XG5cdH1cblxuXHRjb25zdCBvbk9iamVjdEJlZ2luID0gdG9Ob0FyZ1Zpc2l0KHZpc2l0b3Iub25PYmplY3RCZWdpbiksXG5cdFx0b25PYmplY3RQcm9wZXJ0eSA9IHRvT25lQXJnVmlzaXQodmlzaXRvci5vbk9iamVjdFByb3BlcnR5KSxcblx0XHRvbk9iamVjdEVuZCA9IHRvTm9BcmdWaXNpdCh2aXNpdG9yLm9uT2JqZWN0RW5kKSxcblx0XHRvbkFycmF5QmVnaW4gPSB0b05vQXJnVmlzaXQodmlzaXRvci5vbkFycmF5QmVnaW4pLFxuXHRcdG9uQXJyYXlFbmQgPSB0b05vQXJnVmlzaXQodmlzaXRvci5vbkFycmF5RW5kKSxcblx0XHRvbkxpdGVyYWxWYWx1ZSA9IHRvT25lQXJnVmlzaXQodmlzaXRvci5vbkxpdGVyYWxWYWx1ZSksXG5cdFx0b25TZXBhcmF0b3IgPSB0b09uZUFyZ1Zpc2l0KHZpc2l0b3Iub25TZXBhcmF0b3IpLFxuXHRcdG9uQ29tbWVudCA9IHRvTm9BcmdWaXNpdCh2aXNpdG9yLm9uQ29tbWVudCksXG5cdFx0b25FcnJvciA9IHRvT25lQXJnVmlzaXQodmlzaXRvci5vbkVycm9yKTtcblxuXHRjb25zdCBkaXNhbGxvd0NvbW1lbnRzID0gb3B0aW9ucyAmJiBvcHRpb25zLmRpc2FsbG93Q29tbWVudHM7XG5cdGNvbnN0IGFsbG93VHJhaWxpbmdDb21tYSA9IG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd1RyYWlsaW5nQ29tbWE7XG5cdGZ1bmN0aW9uIHNjYW5OZXh0KCk6IFN5bnRheEtpbmQge1xuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRjb25zdCB0b2tlbiA9IF9zY2FubmVyLnNjYW4oKTtcblx0XHRcdHN3aXRjaCAoX3NjYW5uZXIuZ2V0VG9rZW5FcnJvcigpKSB7XG5cdFx0XHRcdGNhc2UgU2NhbkVycm9yLkludmFsaWRVbmljb2RlOlxuXHRcdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLkludmFsaWRVbmljb2RlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTY2FuRXJyb3IuSW52YWxpZEVzY2FwZUNoYXJhY3Rlcjpcblx0XHRcdFx0XHRoYW5kbGVFcnJvcihQYXJzZUVycm9yQ29kZS5JbnZhbGlkRXNjYXBlQ2hhcmFjdGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTY2FuRXJyb3IuVW5leHBlY3RlZEVuZE9mTnVtYmVyOlxuXHRcdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLlVuZXhwZWN0ZWRFbmRPZk51bWJlcik7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU2NhbkVycm9yLlVuZXhwZWN0ZWRFbmRPZkNvbW1lbnQ6XG5cdFx0XHRcdFx0aWYgKCFkaXNhbGxvd0NvbW1lbnRzKSB7XG5cdFx0XHRcdFx0XHRoYW5kbGVFcnJvcihQYXJzZUVycm9yQ29kZS5VbmV4cGVjdGVkRW5kT2ZDb21tZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU2NhbkVycm9yLlVuZXhwZWN0ZWRFbmRPZlN0cmluZzpcblx0XHRcdFx0XHRoYW5kbGVFcnJvcihQYXJzZUVycm9yQ29kZS5VbmV4cGVjdGVkRW5kT2ZTdHJpbmcpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFNjYW5FcnJvci5JbnZhbGlkQ2hhcmFjdGVyOlxuXHRcdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLkludmFsaWRDaGFyYWN0ZXIpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0c3dpdGNoICh0b2tlbikge1xuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuTGluZUNvbW1lbnRUcml2aWE6XG5cdFx0XHRcdGNhc2UgU3ludGF4S2luZC5CbG9ja0NvbW1lbnRUcml2aWE6XG5cdFx0XHRcdFx0aWYgKGRpc2FsbG93Q29tbWVudHMpIHtcblx0XHRcdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLkludmFsaWRDb21tZW50VG9rZW4pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRvbkNvbW1lbnQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU3ludGF4S2luZC5Vbmtub3duOlxuXHRcdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLkludmFsaWRTeW1ib2wpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuVHJpdmlhOlxuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuTGluZUJyZWFrVHJpdmlhOlxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHJldHVybiB0b2tlbjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBoYW5kbGVFcnJvcihlcnJvcjogUGFyc2VFcnJvckNvZGUsIHNraXBVbnRpbEFmdGVyOiBTeW50YXhLaW5kW10gPSBbXSwgc2tpcFVudGlsOiBTeW50YXhLaW5kW10gPSBbXSk6IHZvaWQge1xuXHRcdG9uRXJyb3IoZXJyb3IpO1xuXHRcdGlmIChza2lwVW50aWxBZnRlci5sZW5ndGggKyBza2lwVW50aWwubGVuZ3RoID4gMCkge1xuXHRcdFx0bGV0IHRva2VuID0gX3NjYW5uZXIuZ2V0VG9rZW4oKTtcblx0XHRcdHdoaWxlICh0b2tlbiAhPT0gU3ludGF4S2luZC5FT0YpIHtcblx0XHRcdFx0aWYgKHNraXBVbnRpbEFmdGVyLmluZGV4T2YodG9rZW4pICE9PSAtMSkge1xuXHRcdFx0XHRcdHNjYW5OZXh0KCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH0gZWxzZSBpZiAoc2tpcFVudGlsLmluZGV4T2YodG9rZW4pICE9PSAtMSkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRva2VuID0gc2Nhbk5leHQoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVN0cmluZyhpc1ZhbHVlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgdmFsdWUgPSBfc2Nhbm5lci5nZXRUb2tlblZhbHVlKCk7XG5cdFx0aWYgKGlzVmFsdWUpIHtcblx0XHRcdG9uTGl0ZXJhbFZhbHVlKHZhbHVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b25PYmplY3RQcm9wZXJ0eSh2YWx1ZSk7XG5cdFx0fVxuXHRcdHNjYW5OZXh0KCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZUxpdGVyYWwoKTogYm9vbGVhbiB7XG5cdFx0c3dpdGNoIChfc2Nhbm5lci5nZXRUb2tlbigpKSB7XG5cdFx0XHRjYXNlIFN5bnRheEtpbmQuTnVtZXJpY0xpdGVyYWw6IHtcblx0XHRcdFx0bGV0IHZhbHVlID0gMDtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR2YWx1ZSA9IEpTT04ucGFyc2UoX3NjYW5uZXIuZ2V0VG9rZW5WYWx1ZSgpKTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuSW52YWxpZE51bWJlckZvcm1hdCk7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuSW52YWxpZE51bWJlckZvcm1hdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0b25MaXRlcmFsVmFsdWUodmFsdWUpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgU3ludGF4S2luZC5OdWxsS2V5d29yZDpcblx0XHRcdFx0b25MaXRlcmFsVmFsdWUobnVsbCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTeW50YXhLaW5kLlRydWVLZXl3b3JkOlxuXHRcdFx0XHRvbkxpdGVyYWxWYWx1ZSh0cnVlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFN5bnRheEtpbmQuRmFsc2VLZXl3b3JkOlxuXHRcdFx0XHRvbkxpdGVyYWxWYWx1ZShmYWxzZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRzY2FuTmV4dCgpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFyc2VQcm9wZXJ0eSgpOiBib29sZWFuIHtcblx0XHRpZiAoX3NjYW5uZXIuZ2V0VG9rZW4oKSAhPT0gU3ludGF4S2luZC5TdHJpbmdMaXRlcmFsKSB7XG5cdFx0XHRoYW5kbGVFcnJvcihQYXJzZUVycm9yQ29kZS5Qcm9wZXJ0eU5hbWVFeHBlY3RlZCwgW10sIFtTeW50YXhLaW5kLkNsb3NlQnJhY2VUb2tlbiwgU3ludGF4S2luZC5Db21tYVRva2VuXSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHBhcnNlU3RyaW5nKGZhbHNlKTtcblx0XHRpZiAoX3NjYW5uZXIuZ2V0VG9rZW4oKSA9PT0gU3ludGF4S2luZC5Db2xvblRva2VuKSB7XG5cdFx0XHRvblNlcGFyYXRvcignOicpO1xuXHRcdFx0c2Nhbk5leHQoKTsgLy8gY29uc3VtZSBjb2xvblxuXG5cdFx0XHRpZiAoIXBhcnNlVmFsdWUoKSkge1xuXHRcdFx0XHRoYW5kbGVFcnJvcihQYXJzZUVycm9yQ29kZS5WYWx1ZUV4cGVjdGVkLCBbXSwgW1N5bnRheEtpbmQuQ2xvc2VCcmFjZVRva2VuLCBTeW50YXhLaW5kLkNvbW1hVG9rZW5dKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuQ29sb25FeHBlY3RlZCwgW10sIFtTeW50YXhLaW5kLkNsb3NlQnJhY2VUb2tlbiwgU3ludGF4S2luZC5Db21tYVRva2VuXSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFyc2VPYmplY3QoKTogYm9vbGVhbiB7XG5cdFx0b25PYmplY3RCZWdpbigpO1xuXHRcdHNjYW5OZXh0KCk7IC8vIGNvbnN1bWUgb3BlbiBicmFjZVxuXG5cdFx0bGV0IG5lZWRzQ29tbWEgPSBmYWxzZTtcblx0XHR3aGlsZSAoX3NjYW5uZXIuZ2V0VG9rZW4oKSAhPT0gU3ludGF4S2luZC5DbG9zZUJyYWNlVG9rZW4gJiYgX3NjYW5uZXIuZ2V0VG9rZW4oKSAhPT0gU3ludGF4S2luZC5FT0YpIHtcblx0XHRcdGlmIChfc2Nhbm5lci5nZXRUb2tlbigpID09PSBTeW50YXhLaW5kLkNvbW1hVG9rZW4pIHtcblx0XHRcdFx0aWYgKCFuZWVkc0NvbW1hKSB7XG5cdFx0XHRcdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuVmFsdWVFeHBlY3RlZCwgW10sIFtdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRvblNlcGFyYXRvcignLCcpO1xuXHRcdFx0XHRzY2FuTmV4dCgpOyAvLyBjb25zdW1lIGNvbW1hXG5cdFx0XHRcdGlmIChfc2Nhbm5lci5nZXRUb2tlbigpID09PSBTeW50YXhLaW5kLkNsb3NlQnJhY2VUb2tlbiAmJiBhbGxvd1RyYWlsaW5nQ29tbWEpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChuZWVkc0NvbW1hKSB7XG5cdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLkNvbW1hRXhwZWN0ZWQsIFtdLCBbXSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXBhcnNlUHJvcGVydHkoKSkge1xuXHRcdFx0XHRoYW5kbGVFcnJvcihQYXJzZUVycm9yQ29kZS5WYWx1ZUV4cGVjdGVkLCBbXSwgW1N5bnRheEtpbmQuQ2xvc2VCcmFjZVRva2VuLCBTeW50YXhLaW5kLkNvbW1hVG9rZW5dKTtcblx0XHRcdH1cblx0XHRcdG5lZWRzQ29tbWEgPSB0cnVlO1xuXHRcdH1cblx0XHRvbk9iamVjdEVuZCgpO1xuXHRcdGlmIChfc2Nhbm5lci5nZXRUb2tlbigpICE9PSBTeW50YXhLaW5kLkNsb3NlQnJhY2VUb2tlbikge1xuXHRcdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuQ2xvc2VCcmFjZUV4cGVjdGVkLCBbU3ludGF4S2luZC5DbG9zZUJyYWNlVG9rZW5dLCBbXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNjYW5OZXh0KCk7IC8vIGNvbnN1bWUgY2xvc2UgYnJhY2Vcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZUFycmF5KCk6IGJvb2xlYW4ge1xuXHRcdG9uQXJyYXlCZWdpbigpO1xuXHRcdHNjYW5OZXh0KCk7IC8vIGNvbnN1bWUgb3BlbiBicmFja2V0XG5cblx0XHRsZXQgbmVlZHNDb21tYSA9IGZhbHNlO1xuXHRcdHdoaWxlIChfc2Nhbm5lci5nZXRUb2tlbigpICE9PSBTeW50YXhLaW5kLkNsb3NlQnJhY2tldFRva2VuICYmIF9zY2FubmVyLmdldFRva2VuKCkgIT09IFN5bnRheEtpbmQuRU9GKSB7XG5cdFx0XHRpZiAoX3NjYW5uZXIuZ2V0VG9rZW4oKSA9PT0gU3ludGF4S2luZC5Db21tYVRva2VuKSB7XG5cdFx0XHRcdGlmICghbmVlZHNDb21tYSkge1xuXHRcdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLlZhbHVlRXhwZWN0ZWQsIFtdLCBbXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0b25TZXBhcmF0b3IoJywnKTtcblx0XHRcdFx0c2Nhbk5leHQoKTsgLy8gY29uc3VtZSBjb21tYVxuXHRcdFx0XHRpZiAoX3NjYW5uZXIuZ2V0VG9rZW4oKSA9PT0gU3ludGF4S2luZC5DbG9zZUJyYWNrZXRUb2tlbiAmJiBhbGxvd1RyYWlsaW5nQ29tbWEpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChuZWVkc0NvbW1hKSB7XG5cdFx0XHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLkNvbW1hRXhwZWN0ZWQsIFtdLCBbXSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXBhcnNlVmFsdWUoKSkge1xuXHRcdFx0XHRoYW5kbGVFcnJvcihQYXJzZUVycm9yQ29kZS5WYWx1ZUV4cGVjdGVkLCBbXSwgW1N5bnRheEtpbmQuQ2xvc2VCcmFja2V0VG9rZW4sIFN5bnRheEtpbmQuQ29tbWFUb2tlbl0pO1xuXHRcdFx0fVxuXHRcdFx0bmVlZHNDb21tYSA9IHRydWU7XG5cdFx0fVxuXHRcdG9uQXJyYXlFbmQoKTtcblx0XHRpZiAoX3NjYW5uZXIuZ2V0VG9rZW4oKSAhPT0gU3ludGF4S2luZC5DbG9zZUJyYWNrZXRUb2tlbikge1xuXHRcdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuQ2xvc2VCcmFja2V0RXhwZWN0ZWQsIFtTeW50YXhLaW5kLkNsb3NlQnJhY2tldFRva2VuXSwgW10pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzY2FuTmV4dCgpOyAvLyBjb25zdW1lIGNsb3NlIGJyYWNrZXRcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVZhbHVlKCk6IGJvb2xlYW4ge1xuXHRcdHN3aXRjaCAoX3NjYW5uZXIuZ2V0VG9rZW4oKSkge1xuXHRcdFx0Y2FzZSBTeW50YXhLaW5kLk9wZW5CcmFja2V0VG9rZW46XG5cdFx0XHRcdHJldHVybiBwYXJzZUFycmF5KCk7XG5cdFx0XHRjYXNlIFN5bnRheEtpbmQuT3BlbkJyYWNlVG9rZW46XG5cdFx0XHRcdHJldHVybiBwYXJzZU9iamVjdCgpO1xuXHRcdFx0Y2FzZSBTeW50YXhLaW5kLlN0cmluZ0xpdGVyYWw6XG5cdFx0XHRcdHJldHVybiBwYXJzZVN0cmluZyh0cnVlKTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBwYXJzZUxpdGVyYWwoKTtcblx0XHR9XG5cdH1cblxuXHRzY2FuTmV4dCgpO1xuXHRpZiAoX3NjYW5uZXIuZ2V0VG9rZW4oKSA9PT0gU3ludGF4S2luZC5FT0YpIHtcblx0XHRpZiAob3B0aW9ucy5hbGxvd0VtcHR5Q29udGVudCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGhhbmRsZUVycm9yKFBhcnNlRXJyb3JDb2RlLlZhbHVlRXhwZWN0ZWQsIFtdLCBbXSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmICghcGFyc2VWYWx1ZSgpKSB7XG5cdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuVmFsdWVFeHBlY3RlZCwgW10sIFtdKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKF9zY2FubmVyLmdldFRva2VuKCkgIT09IFN5bnRheEtpbmQuRU9GKSB7XG5cdFx0aGFuZGxlRXJyb3IoUGFyc2VFcnJvckNvZGUuRW5kT2ZGaWxlRXhwZWN0ZWQsIFtdLCBbXSk7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROb2RlVHlwZSh2YWx1ZTogYW55KTogTm9kZVR5cGUge1xuXHRzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuXHRcdGNhc2UgJ2Jvb2xlYW4nOiByZXR1cm4gJ2Jvb2xlYW4nO1xuXHRcdGNhc2UgJ251bWJlcic6IHJldHVybiAnbnVtYmVyJztcblx0XHRjYXNlICdzdHJpbmcnOiByZXR1cm4gJ3N0cmluZyc7XG5cdFx0Y2FzZSAnb2JqZWN0Jzoge1xuXHRcdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gJ251bGwnO1xuXHRcdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0XHRyZXR1cm4gJ2FycmF5Jztcblx0XHRcdH1cblx0XHRcdHJldHVybiAnb2JqZWN0Jztcblx0XHR9XG5cdFx0ZGVmYXVsdDogcmV0dXJuICdudWxsJztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS08sSUFBVyxZQUFYLGtCQUFXQSxlQUFYO0FBQ04sRUFBQUEsc0JBQUEsVUFBTyxLQUFQO0FBQ0EsRUFBQUEsc0JBQUEsNEJBQXlCLEtBQXpCO0FBQ0EsRUFBQUEsc0JBQUEsMkJBQXdCLEtBQXhCO0FBQ0EsRUFBQUEsc0JBQUEsMkJBQXdCLEtBQXhCO0FBQ0EsRUFBQUEsc0JBQUEsb0JBQWlCLEtBQWpCO0FBQ0EsRUFBQUEsc0JBQUEsNEJBQXlCLEtBQXpCO0FBQ0EsRUFBQUEsc0JBQUEsc0JBQW1CLEtBQW5CO0FBUGlCLFNBQUFBO0FBQUEsR0FBQTtBQVVYLElBQVcsYUFBWCxrQkFBV0MsZ0JBQVg7QUFDTixFQUFBQSx3QkFBQSxvQkFBaUIsS0FBakI7QUFDQSxFQUFBQSx3QkFBQSxxQkFBa0IsS0FBbEI7QUFDQSxFQUFBQSx3QkFBQSxzQkFBbUIsS0FBbkI7QUFDQSxFQUFBQSx3QkFBQSx1QkFBb0IsS0FBcEI7QUFDQSxFQUFBQSx3QkFBQSxnQkFBYSxLQUFiO0FBQ0EsRUFBQUEsd0JBQUEsZ0JBQWEsS0FBYjtBQUNBLEVBQUFBLHdCQUFBLGlCQUFjLEtBQWQ7QUFDQSxFQUFBQSx3QkFBQSxpQkFBYyxLQUFkO0FBQ0EsRUFBQUEsd0JBQUEsa0JBQWUsS0FBZjtBQUNBLEVBQUFBLHdCQUFBLG1CQUFnQixNQUFoQjtBQUNBLEVBQUFBLHdCQUFBLG9CQUFpQixNQUFqQjtBQUNBLEVBQUFBLHdCQUFBLHVCQUFvQixNQUFwQjtBQUNBLEVBQUFBLHdCQUFBLHdCQUFxQixNQUFyQjtBQUNBLEVBQUFBLHdCQUFBLHFCQUFrQixNQUFsQjtBQUNBLEVBQUFBLHdCQUFBLFlBQVMsTUFBVDtBQUNBLEVBQUFBLHdCQUFBLGFBQVUsTUFBVjtBQUNBLEVBQUFBLHdCQUFBLFNBQU0sTUFBTjtBQWpCaUIsU0FBQUE7QUFBQSxHQUFBO0FBa0VYLElBQVcsaUJBQVgsa0JBQVdDLG9CQUFYO0FBQ04sRUFBQUEsZ0NBQUEsbUJBQWdCLEtBQWhCO0FBQ0EsRUFBQUEsZ0NBQUEseUJBQXNCLEtBQXRCO0FBQ0EsRUFBQUEsZ0NBQUEsMEJBQXVCLEtBQXZCO0FBQ0EsRUFBQUEsZ0NBQUEsbUJBQWdCLEtBQWhCO0FBQ0EsRUFBQUEsZ0NBQUEsbUJBQWdCLEtBQWhCO0FBQ0EsRUFBQUEsZ0NBQUEsbUJBQWdCLEtBQWhCO0FBQ0EsRUFBQUEsZ0NBQUEsd0JBQXFCLEtBQXJCO0FBQ0EsRUFBQUEsZ0NBQUEsMEJBQXVCLEtBQXZCO0FBQ0EsRUFBQUEsZ0NBQUEsdUJBQW9CLEtBQXBCO0FBQ0EsRUFBQUEsZ0NBQUEseUJBQXNCLE1BQXRCO0FBQ0EsRUFBQUEsZ0NBQUEsNEJBQXlCLE1BQXpCO0FBQ0EsRUFBQUEsZ0NBQUEsMkJBQXdCLE1BQXhCO0FBQ0EsRUFBQUEsZ0NBQUEsMkJBQXdCLE1BQXhCO0FBQ0EsRUFBQUEsZ0NBQUEsb0JBQWlCLE1BQWpCO0FBQ0EsRUFBQUEsZ0NBQUEsNEJBQXlCLE1BQXpCO0FBQ0EsRUFBQUEsZ0NBQUEsc0JBQW1CLE1BQW5CO0FBaEJpQixTQUFBQTtBQUFBLEdBQUE7QUE4RFgsSUFBVTtBQUFBLENBQVYsQ0FBVUMsa0JBQVY7QUFDQyxFQUFNQSxjQUFBLFVBQVU7QUFBQSxJQUN0QixvQkFBb0I7QUFBQSxFQUNyQjtBQUFBLEdBSGdCO0FBeURWLFNBQVMsY0FBYyxNQUFjLGVBQXdCLE9BQW9CO0FBRXZGLE1BQUksTUFBTTtBQUNWLFFBQU0sTUFBTSxLQUFLO0FBQ2pCLE1BQUksUUFBZ0I7QUFDcEIsTUFBSSxjQUFjO0FBQ2xCLE1BQUksUUFBb0I7QUFDeEIsTUFBSSxZQUF1QjtBQUUzQixXQUFTLGNBQWMsT0FBdUI7QUFDN0MsUUFBSSxTQUFTO0FBQ2IsUUFBSSxXQUFXO0FBQ2YsV0FBTyxTQUFTLE9BQU87QUFDdEIsWUFBTSxLQUFLLEtBQUssV0FBVyxHQUFHO0FBQzlCLFVBQUksTUFBTSxlQUFxQixNQUFNLGFBQW1CO0FBQ3ZELG1CQUFXLFdBQVcsS0FBSyxLQUFLO0FBQUEsTUFDakMsV0FDUyxNQUFNLGNBQW9CLE1BQU0sWUFBa0I7QUFDMUQsbUJBQVcsV0FBVyxLQUFLLEtBQUssYUFBbUI7QUFBQSxNQUNwRCxXQUNTLE1BQU0sY0FBb0IsTUFBTSxhQUFrQjtBQUMxRCxtQkFBVyxXQUFXLEtBQUssS0FBSyxhQUFtQjtBQUFBLE1BQ3BELE9BQ0s7QUFDSjtBQUFBLE1BQ0Q7QUFDQTtBQUNBO0FBQUEsSUFDRDtBQUNBLFFBQUksU0FBUyxPQUFPO0FBQ25CLGlCQUFXO0FBQUEsSUFDWjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBRUEsV0FBUyxZQUFZLGFBQXFCO0FBQ3pDLFVBQU07QUFDTixZQUFRO0FBQ1Isa0JBQWM7QUFDZCxZQUFRO0FBQ1IsZ0JBQVk7QUFBQSxFQUNiO0FBRUEsV0FBUyxhQUFxQjtBQUM3QixVQUFNLFFBQVE7QUFDZCxRQUFJLEtBQUssV0FBVyxHQUFHLE1BQU0sYUFBbUI7QUFDL0M7QUFBQSxJQUNELE9BQU87QUFDTjtBQUNBLGFBQU8sTUFBTSxLQUFLLFVBQVUsUUFBUSxLQUFLLFdBQVcsR0FBRyxDQUFDLEdBQUc7QUFDMUQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFFBQUksTUFBTSxLQUFLLFVBQVUsS0FBSyxXQUFXLEdBQUcsTUFBTSxjQUFvQjtBQUNyRTtBQUNBLFVBQUksTUFBTSxLQUFLLFVBQVUsUUFBUSxLQUFLLFdBQVcsR0FBRyxDQUFDLEdBQUc7QUFDdkQ7QUFDQSxlQUFPLE1BQU0sS0FBSyxVQUFVLFFBQVEsS0FBSyxXQUFXLEdBQUcsQ0FBQyxHQUFHO0FBQzFEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsT0FBTztBQUNOLG9CQUFZO0FBQ1osZUFBTyxLQUFLLFVBQVUsT0FBTyxHQUFHO0FBQUEsTUFDakM7QUFBQSxJQUNEO0FBQ0EsUUFBSSxNQUFNO0FBQ1YsUUFBSSxNQUFNLEtBQUssV0FBVyxLQUFLLFdBQVcsR0FBRyxNQUFNLGNBQW9CLEtBQUssV0FBVyxHQUFHLE1BQU0sY0FBbUI7QUFDbEg7QUFDQSxVQUFJLE1BQU0sS0FBSyxVQUFVLEtBQUssV0FBVyxHQUFHLE1BQU0saUJBQXVCLEtBQUssV0FBVyxHQUFHLE1BQU0sZ0JBQXNCO0FBQ3ZIO0FBQUEsTUFDRDtBQUNBLFVBQUksTUFBTSxLQUFLLFVBQVUsUUFBUSxLQUFLLFdBQVcsR0FBRyxDQUFDLEdBQUc7QUFDdkQ7QUFDQSxlQUFPLE1BQU0sS0FBSyxVQUFVLFFBQVEsS0FBSyxXQUFXLEdBQUcsQ0FBQyxHQUFHO0FBQzFEO0FBQUEsUUFDRDtBQUNBLGNBQU07QUFBQSxNQUNQLE9BQU87QUFDTixvQkFBWTtBQUFBLE1BQ2I7QUFBQSxJQUNEO0FBQ0EsV0FBTyxLQUFLLFVBQVUsT0FBTyxHQUFHO0FBQUEsRUFDakM7QUFFQSxXQUFTLGFBQXFCO0FBRTdCLFFBQUksU0FBUyxJQUNaLFFBQVE7QUFFVCxXQUFPLE1BQU07QUFDWixVQUFJLE9BQU8sS0FBSztBQUNmLGtCQUFVLEtBQUssVUFBVSxPQUFPLEdBQUc7QUFDbkMsb0JBQVk7QUFDWjtBQUFBLE1BQ0Q7QUFDQSxZQUFNLEtBQUssS0FBSyxXQUFXLEdBQUc7QUFDOUIsVUFBSSxPQUFPLHNCQUE0QjtBQUN0QyxrQkFBVSxLQUFLLFVBQVUsT0FBTyxHQUFHO0FBQ25DO0FBQ0E7QUFBQSxNQUNEO0FBQ0EsVUFBSSxPQUFPLG9CQUEwQjtBQUNwQyxrQkFBVSxLQUFLLFVBQVUsT0FBTyxHQUFHO0FBQ25DO0FBQ0EsWUFBSSxPQUFPLEtBQUs7QUFDZixzQkFBWTtBQUNaO0FBQUEsUUFDRDtBQUNBLGNBQU0sTUFBTSxLQUFLLFdBQVcsS0FBSztBQUNqQyxnQkFBUSxLQUFLO0FBQUEsVUFDWixLQUFLO0FBQ0osc0JBQVU7QUFDVjtBQUFBLFVBQ0QsS0FBSztBQUNKLHNCQUFVO0FBQ1Y7QUFBQSxVQUNELEtBQUs7QUFDSixzQkFBVTtBQUNWO0FBQUEsVUFDRCxLQUFLO0FBQ0osc0JBQVU7QUFDVjtBQUFBLFVBQ0QsS0FBSztBQUNKLHNCQUFVO0FBQ1Y7QUFBQSxVQUNELEtBQUs7QUFDSixzQkFBVTtBQUNWO0FBQUEsVUFDRCxLQUFLO0FBQ0osc0JBQVU7QUFDVjtBQUFBLFVBQ0QsS0FBSztBQUNKLHNCQUFVO0FBQ1Y7QUFBQSxVQUNELEtBQUssYUFBa0I7QUFDdEIsa0JBQU0sTUFBTSxjQUFjLENBQUM7QUFDM0IsZ0JBQUksT0FBTyxHQUFHO0FBQ2Isd0JBQVUsT0FBTyxhQUFhLEdBQUc7QUFBQSxZQUNsQyxPQUFPO0FBQ04sMEJBQVk7QUFBQSxZQUNiO0FBQ0E7QUFBQSxVQUNEO0FBQUEsVUFDQTtBQUNDLHdCQUFZO0FBQUEsUUFDZDtBQUNBLGdCQUFRO0FBQ1I7QUFBQSxNQUNEO0FBQ0EsVUFBSSxNQUFNLEtBQUssTUFBTSxJQUFNO0FBQzFCLFlBQUksWUFBWSxFQUFFLEdBQUc7QUFDcEIsb0JBQVUsS0FBSyxVQUFVLE9BQU8sR0FBRztBQUNuQyxzQkFBWTtBQUNaO0FBQUEsUUFDRCxPQUFPO0FBQ04sc0JBQVk7QUFBQSxRQUViO0FBQUEsTUFDRDtBQUNBO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBRUEsV0FBUyxXQUF1QjtBQUUvQixZQUFRO0FBQ1IsZ0JBQVk7QUFFWixrQkFBYztBQUVkLFFBQUksT0FBTyxLQUFLO0FBRWYsb0JBQWM7QUFDZCxhQUFPLFFBQVE7QUFBQSxJQUNoQjtBQUVBLFFBQUksT0FBTyxLQUFLLFdBQVcsR0FBRztBQUU5QixRQUFJLGFBQWEsSUFBSSxHQUFHO0FBQ3ZCLFNBQUc7QUFDRjtBQUNBLGlCQUFTLE9BQU8sYUFBYSxJQUFJO0FBQ2pDLGVBQU8sS0FBSyxXQUFXLEdBQUc7QUFBQSxNQUMzQixTQUFTLGFBQWEsSUFBSTtBQUUxQixhQUFPLFFBQVE7QUFBQSxJQUNoQjtBQUdBLFFBQUksWUFBWSxJQUFJLEdBQUc7QUFDdEI7QUFDQSxlQUFTLE9BQU8sYUFBYSxJQUFJO0FBQ2pDLFVBQUksU0FBUywyQkFBaUMsS0FBSyxXQUFXLEdBQUcsTUFBTSxtQkFBeUI7QUFDL0Y7QUFDQSxpQkFBUztBQUFBLE1BQ1Y7QUFDQSxhQUFPLFFBQVE7QUFBQSxJQUNoQjtBQUVBLFlBQVEsTUFBTTtBQUFBO0FBQUEsTUFFYixLQUFLO0FBQ0o7QUFDQSxlQUFPLFFBQVE7QUFBQSxNQUNoQixLQUFLO0FBQ0o7QUFDQSxlQUFPLFFBQVE7QUFBQSxNQUNoQixLQUFLO0FBQ0o7QUFDQSxlQUFPLFFBQVE7QUFBQSxNQUNoQixLQUFLO0FBQ0o7QUFDQSxlQUFPLFFBQVE7QUFBQSxNQUNoQixLQUFLO0FBQ0o7QUFDQSxlQUFPLFFBQVE7QUFBQSxNQUNoQixLQUFLO0FBQ0o7QUFDQSxlQUFPLFFBQVE7QUFBQTtBQUFBLE1BR2hCLEtBQUs7QUFDSjtBQUNBLGdCQUFRLFdBQVc7QUFDbkIsZUFBTyxRQUFRO0FBQUE7QUFBQSxNQUdoQixLQUFLLGdCQUFzQjtBQUMxQixjQUFNLFFBQVEsTUFBTTtBQUVwQixZQUFJLEtBQUssV0FBVyxNQUFNLENBQUMsTUFBTSxnQkFBc0I7QUFDdEQsaUJBQU87QUFFUCxpQkFBTyxNQUFNLEtBQUs7QUFDakIsZ0JBQUksWUFBWSxLQUFLLFdBQVcsR0FBRyxDQUFDLEdBQUc7QUFDdEM7QUFBQSxZQUNEO0FBQ0E7QUFBQSxVQUVEO0FBQ0Esa0JBQVEsS0FBSyxVQUFVLE9BQU8sR0FBRztBQUNqQyxpQkFBTyxRQUFRO0FBQUEsUUFDaEI7QUFHQSxZQUFJLEtBQUssV0FBVyxNQUFNLENBQUMsTUFBTSxtQkFBeUI7QUFDekQsaUJBQU87QUFFUCxnQkFBTSxhQUFhLE1BQU07QUFDekIsY0FBSSxnQkFBZ0I7QUFDcEIsaUJBQU8sTUFBTSxZQUFZO0FBQ3hCLGtCQUFNLEtBQUssS0FBSyxXQUFXLEdBQUc7QUFFOUIsZ0JBQUksT0FBTyxxQkFBMkIsS0FBSyxXQUFXLE1BQU0sQ0FBQyxNQUFNLGdCQUFzQjtBQUN4RixxQkFBTztBQUNQLDhCQUFnQjtBQUNoQjtBQUFBLFlBQ0Q7QUFDQTtBQUFBLFVBQ0Q7QUFFQSxjQUFJLENBQUMsZUFBZTtBQUNuQjtBQUNBLHdCQUFZO0FBQUEsVUFDYjtBQUVBLGtCQUFRLEtBQUssVUFBVSxPQUFPLEdBQUc7QUFDakMsaUJBQU8sUUFBUTtBQUFBLFFBQ2hCO0FBRUEsaUJBQVMsT0FBTyxhQUFhLElBQUk7QUFDakM7QUFDQSxlQUFPLFFBQVE7QUFBQSxNQUNoQjtBQUFBO0FBQUEsTUFFQSxLQUFLO0FBQ0osaUJBQVMsT0FBTyxhQUFhLElBQUk7QUFDakM7QUFDQSxZQUFJLFFBQVEsT0FBTyxDQUFDLFFBQVEsS0FBSyxXQUFXLEdBQUcsQ0FBQyxHQUFHO0FBQ2xELGlCQUFPLFFBQVE7QUFBQSxRQUNoQjtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BSUQsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUNKLGlCQUFTLFdBQVc7QUFDcEIsZUFBTyxRQUFRO0FBQUE7QUFBQSxNQUVoQjtBQUVDLGVBQU8sTUFBTSxPQUFPLDBCQUEwQixJQUFJLEdBQUc7QUFDcEQ7QUFDQSxpQkFBTyxLQUFLLFdBQVcsR0FBRztBQUFBLFFBQzNCO0FBQ0EsWUFBSSxnQkFBZ0IsS0FBSztBQUN4QixrQkFBUSxLQUFLLFVBQVUsYUFBYSxHQUFHO0FBRXZDLGtCQUFRLE9BQU87QUFBQSxZQUNkLEtBQUs7QUFBUSxxQkFBTyxRQUFRO0FBQUEsWUFDNUIsS0FBSztBQUFTLHFCQUFPLFFBQVE7QUFBQSxZQUM3QixLQUFLO0FBQVEscUJBQU8sUUFBUTtBQUFBLFVBQzdCO0FBQ0EsaUJBQU8sUUFBUTtBQUFBLFFBQ2hCO0FBRUEsaUJBQVMsT0FBTyxhQUFhLElBQUk7QUFDakM7QUFDQSxlQUFPLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0Q7QUFFQSxXQUFTLDBCQUEwQixNQUFzQjtBQUN4RCxRQUFJLGFBQWEsSUFBSSxLQUFLLFlBQVksSUFBSSxHQUFHO0FBQzVDLGFBQU87QUFBQSxJQUNSO0FBQ0EsWUFBUSxNQUFNO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQ0osZUFBTztBQUFBLElBQ1Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUdBLFdBQVMsb0JBQWdDO0FBQ3hDLFFBQUk7QUFDSixPQUFHO0FBQ0YsZUFBUyxTQUFTO0FBQUEsSUFDbkIsU0FBUyxVQUFVLDhCQUFnQyxVQUFVO0FBQzdELFdBQU87QUFBQSxFQUNSO0FBRUEsU0FBTztBQUFBLElBQ047QUFBQSxJQUNBLGFBQWEsTUFBTTtBQUFBLElBQ25CLE1BQU0sZUFBZSxvQkFBb0I7QUFBQSxJQUN6QyxVQUFVLE1BQU07QUFBQSxJQUNoQixlQUFlLE1BQU07QUFBQSxJQUNyQixnQkFBZ0IsTUFBTTtBQUFBLElBQ3RCLGdCQUFnQixNQUFNLE1BQU07QUFBQSxJQUM1QixlQUFlLE1BQU07QUFBQSxFQUN0QjtBQUNEO0FBRUEsU0FBUyxhQUFhLElBQXFCO0FBQzFDLFNBQU8sT0FBTyxrQkFBd0IsT0FBTyxlQUFzQixPQUFPLHdCQUE4QixPQUFPLHFCQUM5RyxPQUFPLDhCQUFtQyxPQUFPLG9CQUF3QixNQUFNLHFCQUF5QixNQUFNLDZCQUM5RyxPQUFPLGlDQUFxQyxPQUFPLGdDQUFvQyxPQUFPLGdDQUFtQyxPQUFPO0FBQzFJO0FBRUEsU0FBUyxZQUFZLElBQXFCO0FBQ3pDLFNBQU8sT0FBTyxxQkFBMkIsT0FBTywyQkFBaUMsT0FBTyw0QkFBZ0MsT0FBTztBQUNoSTtBQUVBLFNBQVMsUUFBUSxJQUFxQjtBQUNyQyxTQUFPLE1BQU0sZUFBcUIsTUFBTTtBQUN6QztBQUVBLElBQVcsaUJBQVgsa0JBQVdDLG9CQUFYO0FBQ0MsRUFBQUEsZ0NBQUEsbUJBQWdCLEtBQWhCO0FBQ0EsRUFBQUEsZ0NBQUEsdUJBQW9CLE9BQXBCO0FBRUEsRUFBQUEsZ0NBQUEsY0FBVyxNQUFYO0FBQ0EsRUFBQUEsZ0NBQUEsb0JBQWlCLE1BQWpCO0FBQ0EsRUFBQUEsZ0NBQUEsbUJBQWdCLFFBQWhCO0FBQ0EsRUFBQUEsZ0NBQUEsd0JBQXFCLFFBQXJCO0FBSUEsRUFBQUEsZ0NBQUEsY0FBVyxPQUFYO0FBR0EsRUFBQUEsZ0NBQUEsV0FBUSxNQUFSO0FBQ0EsRUFBQUEsZ0NBQUEsc0JBQW1CLE9BQW5CO0FBQ0EsRUFBQUEsZ0NBQUEsWUFBUyxRQUFUO0FBQ0EsRUFBQUEsZ0NBQUEsWUFBUyxRQUFUO0FBQ0EsRUFBQUEsZ0NBQUEsYUFBVSxRQUFWO0FBQ0EsRUFBQUEsZ0NBQUEsYUFBVSxRQUFWO0FBQ0EsRUFBQUEsZ0NBQUEscUJBQWtCLFFBQWxCO0FBQ0EsRUFBQUEsZ0NBQUEsb0JBQWlCLFFBQWpCO0FBQ0EsRUFBQUEsZ0NBQUEsbUJBQWdCLFFBQWhCO0FBQ0EsRUFBQUEsZ0NBQUEsaUJBQWMsUUFBZDtBQUNBLEVBQUFBLGdDQUFBLHNCQUFtQixRQUFuQjtBQUNBLEVBQUFBLGdDQUFBLGVBQVksUUFBWjtBQUNBLEVBQUFBLGdDQUFBLGVBQVksUUFBWjtBQUNBLEVBQUFBLGdDQUFBLG9CQUFpQixRQUFqQjtBQUNBLEVBQUFBLGdDQUFBLHdCQUFxQixRQUFyQjtBQUNBLEVBQUFBLGdDQUFBLHNCQUFtQixTQUFuQjtBQUNBLEVBQUFBLGdDQUFBLHVCQUFvQixRQUFwQjtBQUNBLEVBQUFBLGdDQUFBLFdBQVEsUUFBUjtBQUVBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUVBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUNBLEVBQUFBLGdDQUFBLFFBQUssTUFBTDtBQUVBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksT0FBSjtBQUVBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFBLGdDQUFBLE9BQUksTUFBSjtBQUNBLEVBQUFB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V0FBVyxHQUFHO0FBQ2xCLGdCQUFZLHVCQUE4QixDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2hELFdBQU87QUFBQSxFQUNSO0FBQ0EsTUFBSSxTQUFTLFNBQVMsTUFBTSxjQUFnQjtBQUMzQyxnQkFBWSwyQkFBa0MsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUFBLEVBQ3JEO0FBQ0EsU0FBTztBQUNSO0FBRU8sU0FBUyxZQUFZLE9BQXNCO0FBQ2pELFVBQVEsT0FBTyxPQUFPO0FBQUEsSUFDckIsS0FBSztBQUFXLGFBQU87QUFBQSxJQUN2QixLQUFLO0FBQVUsYUFBTztBQUFBLElBQ3RCLEtBQUs7QUFBVSxhQUFPO0FBQUEsSUFDdEIsS0FBSyxVQUFVO0FBQ2QsVUFBSSxDQUFDLE9BQU87QUFDWCxlQUFPO0FBQUEsTUFDUixXQUFXLE1BQU0sUUFBUSxLQUFLLEdBQUc7QUFDaEMsZUFBTztBQUFBLE1BQ1I7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUFBLElBQ0E7QUFBUyxhQUFPO0FBQUEsRUFDakI7QUFDRDsiLAogICJuYW1lcyI6IFsiU2NhbkVycm9yIiwgIlN5bnRheEtpbmQiLCAiUGFyc2VFcnJvckNvZGUiLCAiUGFyc2VPcHRpb25zIiwgIkNoYXJhY3RlckNvZGVzIl0KfQo=
