import { CharCode } from "./charCode.js";
import { LRUCache } from "./map.js";
import { getKoreanAltChars } from "./naturalLanguage/korean.js";
import * as strings from "./strings.js";
function or(...filter) {
  return function(word, wordToMatchAgainst) {
    for (let i = 0, len = filter.length; i < len; i++) {
      const match = filter[i](word, wordToMatchAgainst);
      if (match) {
        return match;
      }
    }
    return null;
  };
}
const matchesStrictPrefix = _matchesPrefix.bind(void 0, false);
const matchesPrefix = _matchesPrefix.bind(void 0, true);
function _matchesPrefix(ignoreCase, word, wordToMatchAgainst) {
  if (!wordToMatchAgainst || wordToMatchAgainst.length < word.length) {
    return null;
  }
  let matches;
  if (ignoreCase) {
    matches = strings.startsWithIgnoreCase(wordToMatchAgainst, word);
  } else {
    matches = wordToMatchAgainst.indexOf(word) === 0;
  }
  if (!matches) {
    return null;
  }
  return word.length > 0 ? [{ start: 0, end: word.length }] : [];
}
function matchesContiguousSubString(word, wordToMatchAgainst) {
  const index = wordToMatchAgainst.toLowerCase().indexOf(word.toLowerCase());
  if (index === -1) {
    return null;
  }
  return [{ start: index, end: index + word.length }];
}
function matchesSubString(word, wordToMatchAgainst) {
  return _matchesSubString(word.toLowerCase(), wordToMatchAgainst.toLowerCase(), 0, 0);
}
function _matchesSubString(word, wordToMatchAgainst, i, j) {
  if (i === word.length) {
    return [];
  } else if (j === wordToMatchAgainst.length) {
    return null;
  } else {
    if (word[i] === wordToMatchAgainst[j]) {
      let result = null;
      if (result = _matchesSubString(word, wordToMatchAgainst, i + 1, j + 1)) {
        return join({ start: j, end: j + 1 }, result);
      }
      return null;
    }
    return _matchesSubString(word, wordToMatchAgainst, i, j + 1);
  }
}
function isLower(code) {
  return CharCode.a <= code && code <= CharCode.z;
}
function isUpper(code) {
  return CharCode.A <= code && code <= CharCode.Z;
}
function isNumber(code) {
  return CharCode.Digit0 <= code && code <= CharCode.Digit9;
}
function isWhitespace(code) {
  return code === CharCode.Space || code === CharCode.Tab || code === CharCode.LineFeed || code === CharCode.CarriageReturn;
}
const wordSeparators = /* @__PURE__ */ new Set();
"()[]{}<>`'\"-/;:,.?!".split("").forEach((s) => wordSeparators.add(s.charCodeAt(0)));
function isWordSeparator(code) {
  return isWhitespace(code) || wordSeparators.has(code);
}
function charactersMatch(codeA, codeB) {
  return codeA === codeB || isWordSeparator(codeA) && isWordSeparator(codeB);
}
const alternateCharsCache = /* @__PURE__ */ new Map();
function getAlternateCodes(code) {
  if (alternateCharsCache.has(code)) {
    return alternateCharsCache.get(code);
  }
  let result;
  const codes = getKoreanAltChars(code);
  if (codes) {
    result = codes;
  }
  alternateCharsCache.set(code, result);
  return result;
}
function isAlphanumeric(code) {
  return isLower(code) || isUpper(code) || isNumber(code);
}
function join(head, tail) {
  if (tail.length === 0) {
    tail = [head];
  } else if (head.end === tail[0].start) {
    tail[0].start = head.start;
  } else {
    tail.unshift(head);
  }
  return tail;
}
function nextAnchor(camelCaseWord, start) {
  for (let i = start; i < camelCaseWord.length; i++) {
    const c = camelCaseWord.charCodeAt(i);
    if (isUpper(c) || isNumber(c) || i > 0 && !isAlphanumeric(camelCaseWord.charCodeAt(i - 1))) {
      return i;
    }
  }
  return camelCaseWord.length;
}
function _matchesCamelCase(word, camelCaseWord, i, j) {
  if (i === word.length) {
    return [];
  } else if (j === camelCaseWord.length) {
    return null;
  } else if (word[i] !== camelCaseWord[j].toLowerCase()) {
    return null;
  } else {
    let result = null;
    let nextUpperIndex = j + 1;
    result = _matchesCamelCase(word, camelCaseWord, i + 1, j + 1);
    while (!result && (nextUpperIndex = nextAnchor(camelCaseWord, nextUpperIndex)) < camelCaseWord.length) {
      result = _matchesCamelCase(word, camelCaseWord, i + 1, nextUpperIndex);
      nextUpperIndex++;
    }
    return result === null ? null : join({ start: j, end: j + 1 }, result);
  }
}
function analyzeCamelCaseWord(word) {
  let upper = 0, lower = 0, alpha = 0, numeric = 0, code = 0;
  for (let i = 0; i < word.length; i++) {
    code = word.charCodeAt(i);
    if (isUpper(code)) {
      upper++;
    }
    if (isLower(code)) {
      lower++;
    }
    if (isAlphanumeric(code)) {
      alpha++;
    }
    if (isNumber(code)) {
      numeric++;
    }
  }
  const upperPercent = upper / word.length;
  const lowerPercent = lower / word.length;
  const alphaPercent = alpha / word.length;
  const numericPercent = numeric / word.length;
  return { upperPercent, lowerPercent, alphaPercent, numericPercent };
}
function isUpperCaseWord(analysis) {
  const { upperPercent, lowerPercent } = analysis;
  return lowerPercent === 0 && upperPercent > 0.6;
}
function isCamelCaseWord(analysis) {
  const { upperPercent, lowerPercent, alphaPercent, numericPercent } = analysis;
  return lowerPercent > 0.2 && upperPercent < 0.8 && alphaPercent > 0.6 && numericPercent < 0.2;
}
function isCamelCasePattern(word) {
  let upper = 0, lower = 0, code = 0, whitespace = 0;
  for (let i = 0; i < word.length; i++) {
    code = word.charCodeAt(i);
    if (isUpper(code)) {
      upper++;
    }
    if (isLower(code)) {
      lower++;
    }
    if (isWhitespace(code)) {
      whitespace++;
    }
  }
  if ((upper === 0 || lower === 0) && whitespace === 0) {
    return word.length <= 30;
  } else {
    return upper <= 5;
  }
}
function matchesCamelCase(word, camelCaseWord) {
  if (!camelCaseWord) {
    return null;
  }
  camelCaseWord = camelCaseWord.trim();
  if (camelCaseWord.length === 0) {
    return null;
  }
  if (!isCamelCasePattern(word)) {
    return null;
  }
  if (camelCaseWord.length > 60) {
    camelCaseWord = camelCaseWord.substring(0, 60);
  }
  const analysis = analyzeCamelCaseWord(camelCaseWord);
  if (!isCamelCaseWord(analysis)) {
    if (!isUpperCaseWord(analysis)) {
      return null;
    }
    camelCaseWord = camelCaseWord.toLowerCase();
  }
  let result = null;
  let i = 0;
  word = word.toLowerCase();
  while (i < camelCaseWord.length && (result = _matchesCamelCase(word, camelCaseWord, 0, i)) === null) {
    i = nextAnchor(camelCaseWord, i + 1);
  }
  return result;
}
function matchesWords(word, target, contiguous = false) {
  if (!target || target.length === 0) {
    return null;
  }
  let result = null;
  let targetIndex = 0;
  word = word.toLowerCase();
  target = target.toLowerCase();
  while (targetIndex < target.length) {
    result = _matchesWords(word, target, 0, targetIndex, contiguous);
    if (result !== null) {
      break;
    }
    targetIndex = nextWord(target, targetIndex + 1);
  }
  return result;
}
function _matchesWords(word, target, wordIndex, targetIndex, contiguous) {
  let targetIndexOffset = 0;
  if (wordIndex === word.length) {
    return [];
  } else if (targetIndex === target.length) {
    return null;
  } else if (!charactersMatch(word.charCodeAt(wordIndex), target.charCodeAt(targetIndex))) {
    const altChars = getAlternateCodes(word.charCodeAt(wordIndex));
    if (!altChars) {
      return null;
    }
    for (let k = 0; k < altChars.length; k++) {
      if (!charactersMatch(altChars[k], target.charCodeAt(targetIndex + k))) {
        return null;
      }
    }
    targetIndexOffset += altChars.length - 1;
  }
  let result = null;
  let nextWordIndex = targetIndex + targetIndexOffset + 1;
  result = _matchesWords(word, target, wordIndex + 1, nextWordIndex, contiguous);
  if (!contiguous) {
    while (!result && (nextWordIndex = nextWord(target, nextWordIndex)) < target.length) {
      result = _matchesWords(word, target, wordIndex + 1, nextWordIndex, contiguous);
      nextWordIndex++;
    }
  }
  if (!result) {
    return null;
  }
  if (word.charCodeAt(wordIndex) !== target.charCodeAt(targetIndex)) {
    const altChars = getAlternateCodes(word.charCodeAt(wordIndex));
    if (!altChars) {
      return result;
    }
    for (let k = 0; k < altChars.length; k++) {
      if (altChars[k] !== target.charCodeAt(targetIndex + k)) {
        return result;
      }
    }
  }
  return join({ start: targetIndex, end: targetIndex + targetIndexOffset + 1 }, result);
}
function nextWord(word, start) {
  for (let i = start; i < word.length; i++) {
    if (isWordSeparator(word.charCodeAt(i)) || i > 0 && isWordSeparator(word.charCodeAt(i - 1))) {
      return i;
    }
  }
  return word.length;
}
const fuzzyContiguousFilter = or(matchesPrefix, matchesCamelCase, matchesContiguousSubString);
const fuzzySeparateFilter = or(matchesPrefix, matchesCamelCase, matchesSubString);
const fuzzyRegExpCache = new LRUCache(1e4);
function matchesFuzzy(word, wordToMatchAgainst, enableSeparateSubstringMatching = false) {
  if (typeof word !== "string" || typeof wordToMatchAgainst !== "string") {
    return null;
  }
  let regexp = fuzzyRegExpCache.get(word);
  if (!regexp) {
    regexp = new RegExp(strings.convertSimple2RegExpPattern(word), "i");
    fuzzyRegExpCache.set(word, regexp);
  }
  const match = regexp.exec(wordToMatchAgainst);
  if (match) {
    return [{ start: match.index, end: match.index + match[0].length }];
  }
  return enableSeparateSubstringMatching ? fuzzySeparateFilter(word, wordToMatchAgainst) : fuzzyContiguousFilter(word, wordToMatchAgainst);
}
function matchesFuzzy2(pattern, word) {
  const score = fuzzyScore(pattern, pattern.toLowerCase(), 0, word, word.toLowerCase(), 0, { firstMatchCanBeWeak: true, boostFullMatch: true });
  return score ? createMatches(score) : null;
}
function anyScore(pattern, lowPattern, patternPos, word, lowWord, wordPos) {
  const max = Math.min(13, pattern.length);
  for (; patternPos < max; patternPos++) {
    const result = fuzzyScore(pattern, lowPattern, patternPos, word, lowWord, wordPos, { firstMatchCanBeWeak: true, boostFullMatch: true });
    if (result) {
      return result;
    }
  }
  return [0, wordPos];
}
function createMatches(score) {
  if (typeof score === "undefined") {
    return [];
  }
  const res = [];
  const wordPos = score[1];
  for (let i = score.length - 1; i > 1; i--) {
    const pos = score[i] + wordPos;
    const last = res[res.length - 1];
    if (last && last.end === pos) {
      last.end = pos + 1;
    } else {
      res.push({ start: pos, end: pos + 1 });
    }
  }
  return res;
}
const _maxLen = 128;
function initTable() {
  const table = [];
  const row = [];
  for (let i = 0; i <= _maxLen; i++) {
    row[i] = 0;
  }
  for (let i = 0; i <= _maxLen; i++) {
    table.push(row.slice(0));
  }
  return table;
}
function initArr(maxLen) {
  const row = [];
  for (let i = 0; i <= maxLen; i++) {
    row[i] = 0;
  }
  return row;
}
const _minWordMatchPos = initArr(2 * _maxLen);
const _maxWordMatchPos = initArr(2 * _maxLen);
const _diag = initTable();
const _table = initTable();
const _arrows = initTable();
const _debug = false;
function printTable(table, pattern, patternLen, word, wordLen) {
  function pad(s, n, pad2 = " ") {
    while (s.length < n) {
      s = pad2 + s;
    }
    return s;
  }
  let ret = ` |   |${word.split("").map((c) => pad(c, 3)).join("|")}
`;
  for (let i = 0; i <= patternLen; i++) {
    if (i === 0) {
      ret += " |";
    } else {
      ret += `${pattern[i - 1]}|`;
    }
    ret += table[i].slice(0, wordLen + 1).map((n) => pad(n.toString(), 3)).join("|") + "\n";
  }
  return ret;
}
function printTables(pattern, patternStart, word, wordStart) {
  pattern = pattern.substr(patternStart);
  word = word.substr(wordStart);
  console.log(printTable(_table, pattern, pattern.length, word, word.length));
  console.log(printTable(_arrows, pattern, pattern.length, word, word.length));
  console.log(printTable(_diag, pattern, pattern.length, word, word.length));
}
function isSeparatorAtPos(value, index) {
  if (index < 0 || index >= value.length) {
    return false;
  }
  const code = value.codePointAt(index);
  switch (code) {
    case CharCode.Underline:
    case CharCode.Dash:
    case CharCode.Period:
    case CharCode.Space:
    case CharCode.Slash:
    case CharCode.Backslash:
    case CharCode.SingleQuote:
    case CharCode.DoubleQuote:
    case CharCode.Colon:
    case CharCode.DollarSign:
    case CharCode.LessThan:
    case CharCode.GreaterThan:
    case CharCode.OpenParen:
    case CharCode.CloseParen:
    case CharCode.OpenSquareBracket:
    case CharCode.CloseSquareBracket:
    case CharCode.OpenCurlyBrace:
    case CharCode.CloseCurlyBrace:
      return true;
    case void 0:
      return false;
    default:
      if (strings.isEmojiImprecise(code)) {
        return true;
      }
      return false;
  }
}
function isWhitespaceAtPos(value, index) {
  if (index < 0 || index >= value.length) {
    return false;
  }
  const code = value.charCodeAt(index);
  switch (code) {
    case CharCode.Space:
    case CharCode.Tab:
      return true;
    default:
      return false;
  }
}
function isUpperCaseAtPos(pos, word, wordLow) {
  return word[pos] !== wordLow[pos];
}
function isPatternInWord(patternLow, patternPos, patternLen, wordLow, wordPos, wordLen, fillMinWordPosArr = false) {
  while (patternPos < patternLen && wordPos < wordLen) {
    if (patternLow[patternPos] === wordLow[wordPos]) {
      if (fillMinWordPosArr) {
        _minWordMatchPos[patternPos] = wordPos;
      }
      patternPos += 1;
    }
    wordPos += 1;
  }
  return patternPos === patternLen;
}
var Arrow = /* @__PURE__ */ ((Arrow2) => {
  Arrow2[Arrow2["Diag"] = 1] = "Diag";
  Arrow2[Arrow2["Left"] = 2] = "Left";
  Arrow2[Arrow2["LeftLeft"] = 3] = "LeftLeft";
  return Arrow2;
})(Arrow || {});
var FuzzyScore;
((FuzzyScore2) => {
  FuzzyScore2.Default = [-100, 0];
  function isDefault(score) {
    return !score || score.length === 2 && score[0] === -100 && score[1] === 0;
  }
  FuzzyScore2.isDefault = isDefault;
})(FuzzyScore || (FuzzyScore = {}));
class FuzzyScoreOptions {
  constructor(firstMatchCanBeWeak, boostFullMatch) {
    this.firstMatchCanBeWeak = firstMatchCanBeWeak;
    this.boostFullMatch = boostFullMatch;
  }
}
FuzzyScoreOptions.default = { boostFullMatch: true, firstMatchCanBeWeak: false };
function fuzzyScore(pattern, patternLow, patternStart, word, wordLow, wordStart, options = FuzzyScoreOptions.default) {
  const patternLen = pattern.length > _maxLen ? _maxLen : pattern.length;
  const wordLen = word.length > _maxLen ? _maxLen : word.length;
  if (patternStart >= patternLen || wordStart >= wordLen || patternLen - patternStart > wordLen - wordStart) {
    return void 0;
  }
  if (!isPatternInWord(patternLow, patternStart, patternLen, wordLow, wordStart, wordLen, true)) {
    return void 0;
  }
  _fillInMaxWordMatchPos(patternLen, wordLen, patternStart, wordStart, patternLow, wordLow);
  let row = 1;
  let column = 1;
  let patternPos = patternStart;
  let wordPos = wordStart;
  const hasStrongFirstMatch = [false];
  for (row = 1, patternPos = patternStart; patternPos < patternLen; row++, patternPos++) {
    const minWordMatchPos = _minWordMatchPos[patternPos];
    const maxWordMatchPos = _maxWordMatchPos[patternPos];
    const nextMaxWordMatchPos = patternPos + 1 < patternLen ? _maxWordMatchPos[patternPos + 1] : wordLen;
    for (column = minWordMatchPos - wordStart + 1, wordPos = minWordMatchPos; wordPos < nextMaxWordMatchPos; column++, wordPos++) {
      let score = Number.MIN_SAFE_INTEGER;
      let canComeDiag = false;
      if (wordPos <= maxWordMatchPos) {
        score = _doScore(
          pattern,
          patternLow,
          patternPos,
          patternStart,
          word,
          wordLow,
          wordPos,
          wordLen,
          wordStart,
          _diag[row - 1][column - 1] === 0,
          hasStrongFirstMatch
        );
      }
      let diagScore = 0;
      if (score !== Number.MIN_SAFE_INTEGER) {
        canComeDiag = true;
        diagScore = score + _table[row - 1][column - 1];
      }
      const canComeLeft = wordPos > minWordMatchPos;
      const leftScore = canComeLeft ? _table[row][column - 1] + (_diag[row][column - 1] > 0 ? -5 : 0) : 0;
      const canComeLeftLeft = wordPos > minWordMatchPos + 1 && _diag[row][column - 1] > 0;
      const leftLeftScore = canComeLeftLeft ? _table[row][column - 2] + (_diag[row][column - 2] > 0 ? -5 : 0) : 0;
      if (canComeLeftLeft && (!canComeLeft || leftLeftScore >= leftScore) && (!canComeDiag || leftLeftScore >= diagScore)) {
        _table[row][column] = leftLeftScore;
        _arrows[row][column] = 3 /* LeftLeft */;
        _diag[row][column] = 0;
      } else if (canComeLeft && (!canComeDiag || leftScore >= diagScore)) {
        _table[row][column] = leftScore;
        _arrows[row][column] = 2 /* Left */;
        _diag[row][column] = 0;
      } else if (canComeDiag) {
        _table[row][column] = diagScore;
        _arrows[row][column] = 1 /* Diag */;
        _diag[row][column] = _diag[row - 1][column - 1] + 1;
      } else {
        throw new Error(`not possible`);
      }
    }
  }
  if (_debug) {
    printTables(pattern, patternStart, word, wordStart);
  }
  if (!hasStrongFirstMatch[0] && !options.firstMatchCanBeWeak) {
    return void 0;
  }
  row--;
  column--;
  const result = [_table[row][column], wordStart];
  let backwardsDiagLength = 0;
  let maxMatchColumn = 0;
  while (row >= 1) {
    let diagColumn = column;
    do {
      const arrow = _arrows[row][diagColumn];
      if (arrow === 3 /* LeftLeft */) {
        diagColumn = diagColumn - 2;
      } else if (arrow === 2 /* Left */) {
        diagColumn = diagColumn - 1;
      } else {
        break;
      }
    } while (diagColumn >= 1);
    if (backwardsDiagLength > 1 && patternLow[patternStart + row - 1] === wordLow[wordStart + column - 1] && !isUpperCaseAtPos(diagColumn + wordStart - 1, word, wordLow) && backwardsDiagLength + 1 > _diag[row][diagColumn]) {
      diagColumn = column;
    }
    if (diagColumn === column) {
      backwardsDiagLength++;
    } else {
      backwardsDiagLength = 1;
    }
    if (!maxMatchColumn) {
      maxMatchColumn = diagColumn;
    }
    row--;
    column = diagColumn - 1;
    result.push(column);
  }
  if (wordLen - wordStart === patternLen && options.boostFullMatch) {
    result[0] += 2;
  }
  const skippedCharsCount = maxMatchColumn - patternLen;
  result[0] -= skippedCharsCount;
  return result;
}
function _fillInMaxWordMatchPos(patternLen, wordLen, patternStart, wordStart, patternLow, wordLow) {
  let patternPos = patternLen - 1;
  let wordPos = wordLen - 1;
  while (patternPos >= patternStart && wordPos >= wordStart) {
    if (patternLow[patternPos] === wordLow[wordPos]) {
      _maxWordMatchPos[patternPos] = wordPos;
      patternPos--;
    }
    wordPos--;
  }
}
function _doScore(pattern, patternLow, patternPos, patternStart, word, wordLow, wordPos, wordLen, wordStart, newMatchStart, outFirstMatchStrong) {
  if (patternLow[patternPos] !== wordLow[wordPos]) {
    return Number.MIN_SAFE_INTEGER;
  }
  let score = 1;
  let isGapLocation = false;
  if (wordPos === patternPos - patternStart) {
    score = pattern[patternPos] === word[wordPos] ? 7 : 5;
  } else if (isUpperCaseAtPos(wordPos, word, wordLow) && (wordPos === 0 || !isUpperCaseAtPos(wordPos - 1, word, wordLow))) {
    score = pattern[patternPos] === word[wordPos] ? 7 : 5;
    isGapLocation = true;
  } else if (isSeparatorAtPos(wordLow, wordPos) && (wordPos === 0 || !isSeparatorAtPos(wordLow, wordPos - 1))) {
    score = 5;
  } else if (isSeparatorAtPos(wordLow, wordPos - 1) || isWhitespaceAtPos(wordLow, wordPos - 1)) {
    score = 5;
    isGapLocation = true;
  }
  if (score > 1 && patternPos === patternStart) {
    outFirstMatchStrong[0] = true;
  }
  if (!isGapLocation) {
    isGapLocation = isUpperCaseAtPos(wordPos, word, wordLow) || isSeparatorAtPos(wordLow, wordPos - 1) || isWhitespaceAtPos(wordLow, wordPos - 1);
  }
  if (patternPos === patternStart) {
    if (wordPos > wordStart) {
      score -= isGapLocation ? 3 : 5;
    }
  } else {
    if (newMatchStart) {
      score += isGapLocation ? 2 : 0;
    } else {
      score += isGapLocation ? 0 : 1;
    }
  }
  if (wordPos + 1 === wordLen) {
    score -= isGapLocation ? 3 : 5;
  }
  return score;
}
function fuzzyScoreGracefulAggressive(pattern, lowPattern, patternPos, word, lowWord, wordPos, options) {
  return fuzzyScoreWithPermutations(pattern, lowPattern, patternPos, word, lowWord, wordPos, true, options);
}
function fuzzyScoreGraceful(pattern, lowPattern, patternPos, word, lowWord, wordPos, options) {
  return fuzzyScoreWithPermutations(pattern, lowPattern, patternPos, word, lowWord, wordPos, false, options);
}
function fuzzyScoreWithPermutations(pattern, lowPattern, patternPos, word, lowWord, wordPos, aggressive, options) {
  let top = fuzzyScore(pattern, lowPattern, patternPos, word, lowWord, wordPos, options);
  if (top && !aggressive) {
    return top;
  }
  if (pattern.length >= 3) {
    const tries = Math.min(7, pattern.length - 1);
    for (let movingPatternPos = patternPos + 1; movingPatternPos < tries; movingPatternPos++) {
      const newPattern = nextTypoPermutation(pattern, movingPatternPos);
      if (newPattern) {
        const candidate = fuzzyScore(newPattern, newPattern.toLowerCase(), patternPos, word, lowWord, wordPos, options);
        if (candidate) {
          candidate[0] -= 3;
          if (!top || candidate[0] > top[0]) {
            top = candidate;
          }
        }
      }
    }
  }
  return top;
}
function nextTypoPermutation(pattern, patternPos) {
  if (patternPos + 1 >= pattern.length) {
    return void 0;
  }
  const swap1 = pattern[patternPos];
  const swap2 = pattern[patternPos + 1];
  if (swap1 === swap2) {
    return void 0;
  }
  return pattern.slice(0, patternPos) + swap2 + swap1 + pattern.slice(patternPos + 2);
}
export {
  FuzzyScore,
  FuzzyScoreOptions,
  anyScore,
  createMatches,
  fuzzyScore,
  fuzzyScoreGraceful,
  fuzzyScoreGracefulAggressive,
  isPatternInWord,
  isUpper,
  matchesCamelCase,
  matchesContiguousSubString,
  matchesFuzzy,
  matchesFuzzy2,
  matchesPrefix,
  matchesStrictPrefix,
  matchesSubString,
  matchesWords,
  or
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9maWx0ZXJzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuL2NoYXJDb2RlLmpzJztcbmltcG9ydCB7IExSVUNhY2hlIH0gZnJvbSAnLi9tYXAuanMnO1xuaW1wb3J0IHsgZ2V0S29yZWFuQWx0Q2hhcnMgfSBmcm9tICcuL25hdHVyYWxMYW5ndWFnZS9rb3JlYW4uanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuL3N0cmluZ3MuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElGaWx0ZXIge1xuXHQvLyBSZXR1cm5zIG51bGwgaWYgd29yZCBkb2Vzbid0IG1hdGNoLlxuXHQod29yZDogc3RyaW5nLCB3b3JkVG9NYXRjaEFnYWluc3Q6IHN0cmluZyk6IElNYXRjaFtdIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWF0Y2gge1xuXHRzdGFydDogbnVtYmVyO1xuXHRlbmQ6IG51bWJlcjtcbn1cblxuLy8gQ29tYmluZWQgZmlsdGVyc1xuXG4vKipcbiAqIEByZXR1cm5zIEEgZmlsdGVyIHdoaWNoIGNvbWJpbmVzIHRoZSBwcm92aWRlZCBzZXRcbiAqIG9mIGZpbHRlcnMgd2l0aCBhbiBvci4gVGhlICpmaXJzdCogZmlsdGVycyB0aGF0XG4gKiBtYXRjaGVzIGRlZmluZWQgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgcmV0dXJuZWRcbiAqIGZpbHRlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9yKC4uLmZpbHRlcjogSUZpbHRlcltdKTogSUZpbHRlciB7XG5cdHJldHVybiBmdW5jdGlvbiAod29yZDogc3RyaW5nLCB3b3JkVG9NYXRjaEFnYWluc3Q6IHN0cmluZyk6IElNYXRjaFtdIHwgbnVsbCB7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGZpbHRlci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgbWF0Y2ggPSBmaWx0ZXJbaV0od29yZCwgd29yZFRvTWF0Y2hBZ2FpbnN0KTtcblx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRyZXR1cm4gbWF0Y2g7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9O1xufVxuXG4vLyBQcmVmaXhcblxuZXhwb3J0IGNvbnN0IG1hdGNoZXNTdHJpY3RQcmVmaXg6IElGaWx0ZXIgPSBfbWF0Y2hlc1ByZWZpeC5iaW5kKHVuZGVmaW5lZCwgZmFsc2UpO1xuZXhwb3J0IGNvbnN0IG1hdGNoZXNQcmVmaXg6IElGaWx0ZXIgPSBfbWF0Y2hlc1ByZWZpeC5iaW5kKHVuZGVmaW5lZCwgdHJ1ZSk7XG5cbmZ1bmN0aW9uIF9tYXRjaGVzUHJlZml4KGlnbm9yZUNhc2U6IGJvb2xlYW4sIHdvcmQ6IHN0cmluZywgd29yZFRvTWF0Y2hBZ2FpbnN0OiBzdHJpbmcpOiBJTWF0Y2hbXSB8IG51bGwge1xuXHRpZiAoIXdvcmRUb01hdGNoQWdhaW5zdCB8fCB3b3JkVG9NYXRjaEFnYWluc3QubGVuZ3RoIDwgd29yZC5sZW5ndGgpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGxldCBtYXRjaGVzOiBib29sZWFuO1xuXHRpZiAoaWdub3JlQ2FzZSkge1xuXHRcdG1hdGNoZXMgPSBzdHJpbmdzLnN0YXJ0c1dpdGhJZ25vcmVDYXNlKHdvcmRUb01hdGNoQWdhaW5zdCwgd29yZCk7XG5cdH0gZWxzZSB7XG5cdFx0bWF0Y2hlcyA9IHdvcmRUb01hdGNoQWdhaW5zdC5pbmRleE9mKHdvcmQpID09PSAwO1xuXHR9XG5cblx0aWYgKCFtYXRjaGVzKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRyZXR1cm4gd29yZC5sZW5ndGggPiAwID8gW3sgc3RhcnQ6IDAsIGVuZDogd29yZC5sZW5ndGggfV0gOiBbXTtcbn1cblxuLy8gQ29udGlndW91cyBTdWJzdHJpbmdcblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoZXNDb250aWd1b3VzU3ViU3RyaW5nKHdvcmQ6IHN0cmluZywgd29yZFRvTWF0Y2hBZ2FpbnN0OiBzdHJpbmcpOiBJTWF0Y2hbXSB8IG51bGwge1xuXHRjb25zdCBpbmRleCA9IHdvcmRUb01hdGNoQWdhaW5zdC50b0xvd2VyQ2FzZSgpLmluZGV4T2Yod29yZC50b0xvd2VyQ2FzZSgpKTtcblx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cmV0dXJuIFt7IHN0YXJ0OiBpbmRleCwgZW5kOiBpbmRleCArIHdvcmQubGVuZ3RoIH1dO1xufVxuXG4vLyBTdWJzdHJpbmdcblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoZXNTdWJTdHJpbmcod29yZDogc3RyaW5nLCB3b3JkVG9NYXRjaEFnYWluc3Q6IHN0cmluZyk6IElNYXRjaFtdIHwgbnVsbCB7XG5cdHJldHVybiBfbWF0Y2hlc1N1YlN0cmluZyh3b3JkLnRvTG93ZXJDYXNlKCksIHdvcmRUb01hdGNoQWdhaW5zdC50b0xvd2VyQ2FzZSgpLCAwLCAwKTtcbn1cblxuZnVuY3Rpb24gX21hdGNoZXNTdWJTdHJpbmcod29yZDogc3RyaW5nLCB3b3JkVG9NYXRjaEFnYWluc3Q6IHN0cmluZywgaTogbnVtYmVyLCBqOiBudW1iZXIpOiBJTWF0Y2hbXSB8IG51bGwge1xuXHRpZiAoaSA9PT0gd29yZC5sZW5ndGgpIHtcblx0XHRyZXR1cm4gW107XG5cdH0gZWxzZSBpZiAoaiA9PT0gd29yZFRvTWF0Y2hBZ2FpbnN0Lmxlbmd0aCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdGlmICh3b3JkW2ldID09PSB3b3JkVG9NYXRjaEFnYWluc3Rbal0pIHtcblx0XHRcdGxldCByZXN1bHQ6IElNYXRjaFtdIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRpZiAocmVzdWx0ID0gX21hdGNoZXNTdWJTdHJpbmcod29yZCwgd29yZFRvTWF0Y2hBZ2FpbnN0LCBpICsgMSwgaiArIDEpKSB7XG5cdFx0XHRcdHJldHVybiBqb2luKHsgc3RhcnQ6IGosIGVuZDogaiArIDEgfSwgcmVzdWx0KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBfbWF0Y2hlc1N1YlN0cmluZyh3b3JkLCB3b3JkVG9NYXRjaEFnYWluc3QsIGksIGogKyAxKTtcblx0fVxufVxuXG4vLyBDYW1lbENhc2VcblxuZnVuY3Rpb24gaXNMb3dlcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcblx0cmV0dXJuIENoYXJDb2RlLmEgPD0gY29kZSAmJiBjb2RlIDw9IENoYXJDb2RlLno7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1VwcGVyKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gQ2hhckNvZGUuQSA8PSBjb2RlICYmIGNvZGUgPD0gQ2hhckNvZGUuWjtcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG5cdHJldHVybiBDaGFyQ29kZS5EaWdpdDAgPD0gY29kZSAmJiBjb2RlIDw9IENoYXJDb2RlLkRpZ2l0OTtcbn1cblxuZnVuY3Rpb24gaXNXaGl0ZXNwYWNlKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gKFxuXHRcdGNvZGUgPT09IENoYXJDb2RlLlNwYWNlXG5cdFx0fHwgY29kZSA9PT0gQ2hhckNvZGUuVGFiXG5cdFx0fHwgY29kZSA9PT0gQ2hhckNvZGUuTGluZUZlZWRcblx0XHR8fCBjb2RlID09PSBDaGFyQ29kZS5DYXJyaWFnZVJldHVyblxuXHQpO1xufVxuXG5jb25zdCB3b3JkU2VwYXJhdG9ycyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuLy8gVGhlc2UgYXJlIGNob3NlbiBhcyBuYXR1cmFsIHdvcmQgc2VwYXJhdG9ycyBiYXNlZCBvbiB3cml0ZW4gdGV4dC5cbi8vIEl0IGlzIGEgc3Vic2V0IG9mIHRoZSB3b3JkIHNlcGFyYXRvcnMgdXNlZCBieSB0aGUgbW9uYWNvIGVkaXRvci5cbicoKVtde308PmBcXCdcIi0vOzosLj8hJ1xuXHQuc3BsaXQoJycpXG5cdC5mb3JFYWNoKHMgPT4gd29yZFNlcGFyYXRvcnMuYWRkKHMuY2hhckNvZGVBdCgwKSkpO1xuXG5mdW5jdGlvbiBpc1dvcmRTZXBhcmF0b3IoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG5cdHJldHVybiBpc1doaXRlc3BhY2UoY29kZSkgfHwgd29yZFNlcGFyYXRvcnMuaGFzKGNvZGUpO1xufVxuXG5mdW5jdGlvbiBjaGFyYWN0ZXJzTWF0Y2goY29kZUE6IG51bWJlciwgY29kZUI6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gKGNvZGVBID09PSBjb2RlQikgfHwgKGlzV29yZFNlcGFyYXRvcihjb2RlQSkgJiYgaXNXb3JkU2VwYXJhdG9yKGNvZGVCKSk7XG59XG5cbmNvbnN0IGFsdGVybmF0ZUNoYXJzQ2FjaGU6IE1hcDxudW1iZXIsIEFycmF5TGlrZTxudW1iZXI+IHwgdW5kZWZpbmVkPiA9IG5ldyBNYXAoKTtcbi8qKlxuICogR2V0cyBhbHRlcm5hdGl2ZSBjb2RlcyB0byB0aGUgY2hhcmFjdGVyIGNvZGUgcGFzc2VkIGluLiBUaGlzIGNvbWVzIGluIHRoZVxuICogZm9ybSBvZiBhbiBhcnJheSBvZiBjaGFyYWN0ZXIgY29kZXMsIGFsbCBvZiB3aGljaCBtdXN0IG1hdGNoIF9pbiBvcmRlcl8gdG9cbiAqIHN1Y2Nlc3NmdWxseSBtYXRjaC5cbiAqXG4gKiBAcGFyYW0gY29kZSBUaGUgY2hhcmFjdGVyIGNvZGUgdG8gY2hlY2suXG4gKi9cbmZ1bmN0aW9uIGdldEFsdGVybmF0ZUNvZGVzKGNvZGU6IG51bWJlcik6IEFycmF5TGlrZTxudW1iZXI+IHwgdW5kZWZpbmVkIHtcblx0aWYgKGFsdGVybmF0ZUNoYXJzQ2FjaGUuaGFzKGNvZGUpKSB7XG5cdFx0cmV0dXJuIGFsdGVybmF0ZUNoYXJzQ2FjaGUuZ2V0KGNvZGUpO1xuXHR9XG5cblx0Ly8gTk9URTogVGhpcyBmdW5jdGlvbiBpcyB3cml0dGVuIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgZXh0ZW5kZWQgaW5cblx0Ly8gdGhlIGZ1dHVyZSwgYnV0IHJpZ2h0IG5vdyB0aGUgcmV0dXJuIHR5cGUgdGFrZXMgaW50byBhY2NvdW50IGl0J3Mgb25seVxuXHQvLyBzdXBwb3J0ZWQgYnkgYSBzaW5nbGUgXCJhbHQgY29kZXMgcHJvdmlkZXJcIi5cblx0Ly8gYEFycmF5TGlrZTxBcnJheUxpa2U8bnVtYmVyPj5gIGlzIGEgbW9yZSBhcHByb3ByaWF0ZSB0eXBlIGlmIGNoYW5nZWQuXG5cdGxldCByZXN1bHQ6IEFycmF5TGlrZTxudW1iZXI+IHwgdW5kZWZpbmVkO1xuXHRjb25zdCBjb2RlcyA9IGdldEtvcmVhbkFsdENoYXJzKGNvZGUpO1xuXHRpZiAoY29kZXMpIHtcblx0XHRyZXN1bHQgPSBjb2Rlcztcblx0fVxuXG5cdGFsdGVybmF0ZUNoYXJzQ2FjaGUuc2V0KGNvZGUsIHJlc3VsdCk7XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGlzQWxwaGFudW1lcmljKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gaXNMb3dlcihjb2RlKSB8fCBpc1VwcGVyKGNvZGUpIHx8IGlzTnVtYmVyKGNvZGUpO1xufVxuXG5mdW5jdGlvbiBqb2luKGhlYWQ6IElNYXRjaCwgdGFpbDogSU1hdGNoW10pOiBJTWF0Y2hbXSB7XG5cdGlmICh0YWlsLmxlbmd0aCA9PT0gMCkge1xuXHRcdHRhaWwgPSBbaGVhZF07XG5cdH0gZWxzZSBpZiAoaGVhZC5lbmQgPT09IHRhaWxbMF0uc3RhcnQpIHtcblx0XHR0YWlsWzBdLnN0YXJ0ID0gaGVhZC5zdGFydDtcblx0fSBlbHNlIHtcblx0XHR0YWlsLnVuc2hpZnQoaGVhZCk7XG5cdH1cblx0cmV0dXJuIHRhaWw7XG59XG5cbmZ1bmN0aW9uIG5leHRBbmNob3IoY2FtZWxDYXNlV29yZDogc3RyaW5nLCBzdGFydDogbnVtYmVyKTogbnVtYmVyIHtcblx0Zm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgY2FtZWxDYXNlV29yZC5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGMgPSBjYW1lbENhc2VXb3JkLmNoYXJDb2RlQXQoaSk7XG5cdFx0aWYgKGlzVXBwZXIoYykgfHwgaXNOdW1iZXIoYykgfHwgKGkgPiAwICYmICFpc0FscGhhbnVtZXJpYyhjYW1lbENhc2VXb3JkLmNoYXJDb2RlQXQoaSAtIDEpKSkpIHtcblx0XHRcdHJldHVybiBpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gY2FtZWxDYXNlV29yZC5sZW5ndGg7XG59XG5cbmZ1bmN0aW9uIF9tYXRjaGVzQ2FtZWxDYXNlKHdvcmQ6IHN0cmluZywgY2FtZWxDYXNlV29yZDogc3RyaW5nLCBpOiBudW1iZXIsIGo6IG51bWJlcik6IElNYXRjaFtdIHwgbnVsbCB7XG5cdGlmIChpID09PSB3b3JkLmxlbmd0aCkge1xuXHRcdHJldHVybiBbXTtcblx0fSBlbHNlIGlmIChqID09PSBjYW1lbENhc2VXb3JkLmxlbmd0aCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9IGVsc2UgaWYgKHdvcmRbaV0gIT09IGNhbWVsQ2FzZVdvcmRbal0udG9Mb3dlckNhc2UoKSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdGxldCByZXN1bHQ6IElNYXRjaFtdIHwgbnVsbCA9IG51bGw7XG5cdFx0bGV0IG5leHRVcHBlckluZGV4ID0gaiArIDE7XG5cdFx0cmVzdWx0ID0gX21hdGNoZXNDYW1lbENhc2Uod29yZCwgY2FtZWxDYXNlV29yZCwgaSArIDEsIGogKyAxKTtcblx0XHR3aGlsZSAoIXJlc3VsdCAmJiAobmV4dFVwcGVySW5kZXggPSBuZXh0QW5jaG9yKGNhbWVsQ2FzZVdvcmQsIG5leHRVcHBlckluZGV4KSkgPCBjYW1lbENhc2VXb3JkLmxlbmd0aCkge1xuXHRcdFx0cmVzdWx0ID0gX21hdGNoZXNDYW1lbENhc2Uod29yZCwgY2FtZWxDYXNlV29yZCwgaSArIDEsIG5leHRVcHBlckluZGV4KTtcblx0XHRcdG5leHRVcHBlckluZGV4Kys7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQgPT09IG51bGwgPyBudWxsIDogam9pbih7IHN0YXJ0OiBqLCBlbmQ6IGogKyAxIH0sIHJlc3VsdCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElDYW1lbENhc2VBbmFseXNpcyB7XG5cdHVwcGVyUGVyY2VudDogbnVtYmVyO1xuXHRsb3dlclBlcmNlbnQ6IG51bWJlcjtcblx0YWxwaGFQZXJjZW50OiBudW1iZXI7XG5cdG51bWVyaWNQZXJjZW50OiBudW1iZXI7XG59XG5cbi8vIEhldXJpc3RpYyB0byBhdm9pZCBjb21wdXRpbmcgY2FtZWwgY2FzZSBtYXRjaGVyIGZvciB3b3JkcyB0aGF0IGRvbid0XG4vLyBsb29rIGxpa2UgY2FtZWxDYXNlV29yZHMuXG5mdW5jdGlvbiBhbmFseXplQ2FtZWxDYXNlV29yZCh3b3JkOiBzdHJpbmcpOiBJQ2FtZWxDYXNlQW5hbHlzaXMge1xuXHRsZXQgdXBwZXIgPSAwLCBsb3dlciA9IDAsIGFscGhhID0gMCwgbnVtZXJpYyA9IDAsIGNvZGUgPSAwO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgd29yZC5sZW5ndGg7IGkrKykge1xuXHRcdGNvZGUgPSB3b3JkLmNoYXJDb2RlQXQoaSk7XG5cblx0XHRpZiAoaXNVcHBlcihjb2RlKSkgeyB1cHBlcisrOyB9XG5cdFx0aWYgKGlzTG93ZXIoY29kZSkpIHsgbG93ZXIrKzsgfVxuXHRcdGlmIChpc0FscGhhbnVtZXJpYyhjb2RlKSkgeyBhbHBoYSsrOyB9XG5cdFx0aWYgKGlzTnVtYmVyKGNvZGUpKSB7IG51bWVyaWMrKzsgfVxuXHR9XG5cblx0Y29uc3QgdXBwZXJQZXJjZW50ID0gdXBwZXIgLyB3b3JkLmxlbmd0aDtcblx0Y29uc3QgbG93ZXJQZXJjZW50ID0gbG93ZXIgLyB3b3JkLmxlbmd0aDtcblx0Y29uc3QgYWxwaGFQZXJjZW50ID0gYWxwaGEgLyB3b3JkLmxlbmd0aDtcblx0Y29uc3QgbnVtZXJpY1BlcmNlbnQgPSBudW1lcmljIC8gd29yZC5sZW5ndGg7XG5cblx0cmV0dXJuIHsgdXBwZXJQZXJjZW50LCBsb3dlclBlcmNlbnQsIGFscGhhUGVyY2VudCwgbnVtZXJpY1BlcmNlbnQgfTtcbn1cblxuZnVuY3Rpb24gaXNVcHBlckNhc2VXb3JkKGFuYWx5c2lzOiBJQ2FtZWxDYXNlQW5hbHlzaXMpOiBib29sZWFuIHtcblx0Y29uc3QgeyB1cHBlclBlcmNlbnQsIGxvd2VyUGVyY2VudCB9ID0gYW5hbHlzaXM7XG5cdHJldHVybiBsb3dlclBlcmNlbnQgPT09IDAgJiYgdXBwZXJQZXJjZW50ID4gMC42O1xufVxuXG5mdW5jdGlvbiBpc0NhbWVsQ2FzZVdvcmQoYW5hbHlzaXM6IElDYW1lbENhc2VBbmFseXNpcyk6IGJvb2xlYW4ge1xuXHRjb25zdCB7IHVwcGVyUGVyY2VudCwgbG93ZXJQZXJjZW50LCBhbHBoYVBlcmNlbnQsIG51bWVyaWNQZXJjZW50IH0gPSBhbmFseXNpcztcblx0cmV0dXJuIGxvd2VyUGVyY2VudCA+IDAuMiAmJiB1cHBlclBlcmNlbnQgPCAwLjggJiYgYWxwaGFQZXJjZW50ID4gMC42ICYmIG51bWVyaWNQZXJjZW50IDwgMC4yO1xufVxuXG4vLyBIZXVyaXN0aWMgdG8gYXZvaWQgY29tcHV0aW5nIGNhbWVsIGNhc2UgbWF0Y2hlciBmb3Igd29yZHMgdGhhdCBkb24ndFxuLy8gbG9vayBsaWtlIGNhbWVsIGNhc2UgcGF0dGVybnMuXG5mdW5jdGlvbiBpc0NhbWVsQ2FzZVBhdHRlcm4od29yZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdGxldCB1cHBlciA9IDAsIGxvd2VyID0gMCwgY29kZSA9IDAsIHdoaXRlc3BhY2UgPSAwO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgd29yZC5sZW5ndGg7IGkrKykge1xuXHRcdGNvZGUgPSB3b3JkLmNoYXJDb2RlQXQoaSk7XG5cblx0XHRpZiAoaXNVcHBlcihjb2RlKSkgeyB1cHBlcisrOyB9XG5cdFx0aWYgKGlzTG93ZXIoY29kZSkpIHsgbG93ZXIrKzsgfVxuXHRcdGlmIChpc1doaXRlc3BhY2UoY29kZSkpIHsgd2hpdGVzcGFjZSsrOyB9XG5cdH1cblxuXHRpZiAoKHVwcGVyID09PSAwIHx8IGxvd2VyID09PSAwKSAmJiB3aGl0ZXNwYWNlID09PSAwKSB7XG5cdFx0cmV0dXJuIHdvcmQubGVuZ3RoIDw9IDMwO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB1cHBlciA8PSA1O1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaGVzQ2FtZWxDYXNlKHdvcmQ6IHN0cmluZywgY2FtZWxDYXNlV29yZDogc3RyaW5nKTogSU1hdGNoW10gfCBudWxsIHtcblx0aWYgKCFjYW1lbENhc2VXb3JkKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjYW1lbENhc2VXb3JkID0gY2FtZWxDYXNlV29yZC50cmltKCk7XG5cblx0aWYgKGNhbWVsQ2FzZVdvcmQubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRpZiAoIWlzQ2FtZWxDYXNlUGF0dGVybih3b3JkKSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Ly8gVE9ETzogQ29uc2lkZXIgcmVtb3ZpbmcgdGhpcyBjaGVja1xuXHRpZiAoY2FtZWxDYXNlV29yZC5sZW5ndGggPiA2MCkge1xuXHRcdGNhbWVsQ2FzZVdvcmQgPSBjYW1lbENhc2VXb3JkLnN1YnN0cmluZygwLCA2MCk7XG5cdH1cblxuXHRjb25zdCBhbmFseXNpcyA9IGFuYWx5emVDYW1lbENhc2VXb3JkKGNhbWVsQ2FzZVdvcmQpO1xuXG5cdGlmICghaXNDYW1lbENhc2VXb3JkKGFuYWx5c2lzKSkge1xuXHRcdGlmICghaXNVcHBlckNhc2VXb3JkKGFuYWx5c2lzKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y2FtZWxDYXNlV29yZCA9IGNhbWVsQ2FzZVdvcmQudG9Mb3dlckNhc2UoKTtcblx0fVxuXG5cdGxldCByZXN1bHQ6IElNYXRjaFtdIHwgbnVsbCA9IG51bGw7XG5cdGxldCBpID0gMDtcblxuXHR3b3JkID0gd29yZC50b0xvd2VyQ2FzZSgpO1xuXHR3aGlsZSAoaSA8IGNhbWVsQ2FzZVdvcmQubGVuZ3RoICYmIChyZXN1bHQgPSBfbWF0Y2hlc0NhbWVsQ2FzZSh3b3JkLCBjYW1lbENhc2VXb3JkLCAwLCBpKSkgPT09IG51bGwpIHtcblx0XHRpID0gbmV4dEFuY2hvcihjYW1lbENhc2VXb3JkLCBpICsgMSk7XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBNYXRjaGVzIGJlZ2lubmluZyBvZiB3b3JkcyBzdXBwb3J0aW5nIG5vbi1BU0NJSSBsYW5ndWFnZXNcbi8vIElmIGBjb250aWd1b3VzYCBpcyB0cnVlIHRoZW4gbWF0Y2hlcyB3b3JkIHdpdGggYmVnaW5uaW5ncyBvZiB0aGUgd29yZHMgaW4gdGhlIHRhcmdldC4gRS5nLiBcInB1bFwiIHdpbGwgbWF0Y2ggXCJHaXQ6IFB1bGxcIlxuLy8gT3RoZXJ3aXNlIGFsc28gbWF0Y2hlcyBzdWIgc3RyaW5nIG9mIHRoZSB3b3JkIHdpdGggYmVnaW5uaW5ncyBvZiB0aGUgd29yZHMgaW4gdGhlIHRhcmdldC4gRS5nLiBcImdwXCIgb3IgXCJnIHBcIiB3aWxsIG1hdGNoIFwiR2l0OiBQdWxsXCJcbi8vIFVzZWZ1bCBpbiBjYXNlcyB3aGVyZSB0aGUgdGFyZ2V0IGlzIHdvcmRzIChlLmcuIGNvbW1hbmQgbGFiZWxzKVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hlc1dvcmRzKHdvcmQ6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIGNvbnRpZ3VvdXM6IGJvb2xlYW4gPSBmYWxzZSk6IElNYXRjaFtdIHwgbnVsbCB7XG5cdGlmICghdGFyZ2V0IHx8IHRhcmdldC5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGxldCByZXN1bHQ6IElNYXRjaFtdIHwgbnVsbCA9IG51bGw7XG5cdGxldCB0YXJnZXRJbmRleCA9IDA7XG5cblx0d29yZCA9IHdvcmQudG9Mb3dlckNhc2UoKTtcblx0dGFyZ2V0ID0gdGFyZ2V0LnRvTG93ZXJDYXNlKCk7XG5cdHdoaWxlICh0YXJnZXRJbmRleCA8IHRhcmdldC5sZW5ndGgpIHtcblx0XHRyZXN1bHQgPSBfbWF0Y2hlc1dvcmRzKHdvcmQsIHRhcmdldCwgMCwgdGFyZ2V0SW5kZXgsIGNvbnRpZ3VvdXMpO1xuXHRcdGlmIChyZXN1bHQgIT09IG51bGwpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHR0YXJnZXRJbmRleCA9IG5leHRXb3JkKHRhcmdldCwgdGFyZ2V0SW5kZXggKyAxKTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIF9tYXRjaGVzV29yZHMod29yZDogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgd29yZEluZGV4OiBudW1iZXIsIHRhcmdldEluZGV4OiBudW1iZXIsIGNvbnRpZ3VvdXM6IGJvb2xlYW4pOiBJTWF0Y2hbXSB8IG51bGwge1xuXHRsZXQgdGFyZ2V0SW5kZXhPZmZzZXQgPSAwO1xuXG5cdGlmICh3b3JkSW5kZXggPT09IHdvcmQubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9IGVsc2UgaWYgKHRhcmdldEluZGV4ID09PSB0YXJnZXQubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0gZWxzZSBpZiAoIWNoYXJhY3RlcnNNYXRjaCh3b3JkLmNoYXJDb2RlQXQod29yZEluZGV4KSwgdGFyZ2V0LmNoYXJDb2RlQXQodGFyZ2V0SW5kZXgpKSkge1xuXHRcdC8vIFZlcmlmeSBhbHRlcm5hdGUgY2hhcmFjdGVycyBiZWZvcmUgZXhpdGluZ1xuXHRcdGNvbnN0IGFsdENoYXJzID0gZ2V0QWx0ZXJuYXRlQ29kZXMod29yZC5jaGFyQ29kZUF0KHdvcmRJbmRleCkpO1xuXHRcdGlmICghYWx0Q2hhcnMpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRmb3IgKGxldCBrID0gMDsgayA8IGFsdENoYXJzLmxlbmd0aDsgaysrKSB7XG5cdFx0XHRpZiAoIWNoYXJhY3RlcnNNYXRjaChhbHRDaGFyc1trXSwgdGFyZ2V0LmNoYXJDb2RlQXQodGFyZ2V0SW5kZXggKyBrKSkpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRhcmdldEluZGV4T2Zmc2V0ICs9IGFsdENoYXJzLmxlbmd0aCAtIDE7XG5cdH1cblxuXHRsZXQgcmVzdWx0OiBJTWF0Y2hbXSB8IG51bGwgPSBudWxsO1xuXHRsZXQgbmV4dFdvcmRJbmRleCA9IHRhcmdldEluZGV4ICsgdGFyZ2V0SW5kZXhPZmZzZXQgKyAxO1xuXHRyZXN1bHQgPSBfbWF0Y2hlc1dvcmRzKHdvcmQsIHRhcmdldCwgd29yZEluZGV4ICsgMSwgbmV4dFdvcmRJbmRleCwgY29udGlndW91cyk7XG5cdGlmICghY29udGlndW91cykge1xuXHRcdHdoaWxlICghcmVzdWx0ICYmIChuZXh0V29yZEluZGV4ID0gbmV4dFdvcmQodGFyZ2V0LCBuZXh0V29yZEluZGV4KSkgPCB0YXJnZXQubGVuZ3RoKSB7XG5cdFx0XHRyZXN1bHQgPSBfbWF0Y2hlc1dvcmRzKHdvcmQsIHRhcmdldCwgd29yZEluZGV4ICsgMSwgbmV4dFdvcmRJbmRleCwgY29udGlndW91cyk7XG5cdFx0XHRuZXh0V29yZEluZGV4Kys7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFyZXN1bHQpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8vIElmIHRoZSBjaGFyYWN0ZXJzIGRvbid0IGV4YWN0bHkgbWF0Y2gsIHRoZW4gdGhleSBtdXN0IGJlIHdvcmQgc2VwYXJhdG9ycyAoc2VlIGNoYXJhY3RlcnNNYXRjaCguLi4pKS5cblx0Ly8gV2UgZG9uJ3Qgd2FudCB0byBpbmNsdWRlIHRoaXMgaW4gdGhlIG1hdGNoZXMgYnV0IHdlIGRvbid0IHdhbnQgdG8gdGhyb3cgdGhlIHRhcmdldCBvdXQgYWxsIHRvZ2V0aGVyIHNvIHdlIHJldHVybiBgcmVzdWx0YC5cblx0aWYgKHdvcmQuY2hhckNvZGVBdCh3b3JkSW5kZXgpICE9PSB0YXJnZXQuY2hhckNvZGVBdCh0YXJnZXRJbmRleCkpIHtcblx0XHQvLyBWZXJpZnkgYWx0ZXJuYXRlIGNoYXJhY3RlcnMgYmVmb3JlIGV4aXRpbmdcblx0XHRjb25zdCBhbHRDaGFycyA9IGdldEFsdGVybmF0ZUNvZGVzKHdvcmQuY2hhckNvZGVBdCh3b3JkSW5kZXgpKTtcblx0XHRpZiAoIWFsdENoYXJzKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHRmb3IgKGxldCBrID0gMDsgayA8IGFsdENoYXJzLmxlbmd0aDsgaysrKSB7XG5cdFx0XHRpZiAoYWx0Q2hhcnNba10gIT09IHRhcmdldC5jaGFyQ29kZUF0KHRhcmdldEluZGV4ICsgaykpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gam9pbih7IHN0YXJ0OiB0YXJnZXRJbmRleCwgZW5kOiB0YXJnZXRJbmRleCArIHRhcmdldEluZGV4T2Zmc2V0ICsgMSB9LCByZXN1bHQpO1xufVxuXG5mdW5jdGlvbiBuZXh0V29yZCh3b3JkOiBzdHJpbmcsIHN0YXJ0OiBudW1iZXIpOiBudW1iZXIge1xuXHRmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCB3b3JkLmxlbmd0aDsgaSsrKSB7XG5cdFx0aWYgKGlzV29yZFNlcGFyYXRvcih3b3JkLmNoYXJDb2RlQXQoaSkpIHx8XG5cdFx0XHQoaSA+IDAgJiYgaXNXb3JkU2VwYXJhdG9yKHdvcmQuY2hhckNvZGVBdChpIC0gMSkpKSkge1xuXHRcdFx0cmV0dXJuIGk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB3b3JkLmxlbmd0aDtcbn1cblxuLy8gRnV6enlcblxuY29uc3QgZnV6enlDb250aWd1b3VzRmlsdGVyID0gb3IobWF0Y2hlc1ByZWZpeCwgbWF0Y2hlc0NhbWVsQ2FzZSwgbWF0Y2hlc0NvbnRpZ3VvdXNTdWJTdHJpbmcpO1xuY29uc3QgZnV6enlTZXBhcmF0ZUZpbHRlciA9IG9yKG1hdGNoZXNQcmVmaXgsIG1hdGNoZXNDYW1lbENhc2UsIG1hdGNoZXNTdWJTdHJpbmcpO1xuY29uc3QgZnV6enlSZWdFeHBDYWNoZSA9IG5ldyBMUlVDYWNoZTxzdHJpbmcsIFJlZ0V4cD4oMTAwMDApOyAvLyBib3VuZGVkIHRvIDEwMDAwIGVsZW1lbnRzXG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaGVzRnV6enkod29yZDogc3RyaW5nLCB3b3JkVG9NYXRjaEFnYWluc3Q6IHN0cmluZywgZW5hYmxlU2VwYXJhdGVTdWJzdHJpbmdNYXRjaGluZyA9IGZhbHNlKTogSU1hdGNoW10gfCBudWxsIHtcblx0aWYgKHR5cGVvZiB3b3JkICE9PSAnc3RyaW5nJyB8fCB0eXBlb2Ygd29yZFRvTWF0Y2hBZ2FpbnN0ICE9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBudWxsOyAvLyByZXR1cm4gZWFybHkgZm9yIGludmFsaWQgaW5wdXRcblx0fVxuXG5cdC8vIEZvcm0gUmVnRXhwIGZvciB3aWxkY2FyZCBtYXRjaGVzXG5cdGxldCByZWdleHAgPSBmdXp6eVJlZ0V4cENhY2hlLmdldCh3b3JkKTtcblx0aWYgKCFyZWdleHApIHtcblx0XHRyZWdleHAgPSBuZXcgUmVnRXhwKHN0cmluZ3MuY29udmVydFNpbXBsZTJSZWdFeHBQYXR0ZXJuKHdvcmQpLCAnaScpO1xuXHRcdGZ1enp5UmVnRXhwQ2FjaGUuc2V0KHdvcmQsIHJlZ2V4cCk7XG5cdH1cblxuXHQvLyBSZWdFeHAgRmlsdGVyXG5cdGNvbnN0IG1hdGNoID0gcmVnZXhwLmV4ZWMod29yZFRvTWF0Y2hBZ2FpbnN0KTtcblx0aWYgKG1hdGNoKSB7XG5cdFx0cmV0dXJuIFt7IHN0YXJ0OiBtYXRjaC5pbmRleCwgZW5kOiBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCB9XTtcblx0fVxuXG5cdC8vIERlZmF1bHQgRmlsdGVyXG5cdHJldHVybiBlbmFibGVTZXBhcmF0ZVN1YnN0cmluZ01hdGNoaW5nID8gZnV6enlTZXBhcmF0ZUZpbHRlcih3b3JkLCB3b3JkVG9NYXRjaEFnYWluc3QpIDogZnV6enlDb250aWd1b3VzRmlsdGVyKHdvcmQsIHdvcmRUb01hdGNoQWdhaW5zdCk7XG59XG5cbi8qKlxuICogTWF0Y2ggcGF0dGVybiBhZ2FpbnN0IHdvcmQgaW4gYSBmdXp6eSB3YXkuIEFzIGluIEludGVsbGlTZW5zZSBhbmQgZmFzdGVyIGFuZCBtb3JlXG4gKiBwb3dlcmZ1bCB0aGFuIGBtYXRjaGVzRnV6enlgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaGVzRnV6enkyKHBhdHRlcm46IHN0cmluZywgd29yZDogc3RyaW5nKTogSU1hdGNoW10gfCBudWxsIHtcblx0Y29uc3Qgc2NvcmUgPSBmdXp6eVNjb3JlKHBhdHRlcm4sIHBhdHRlcm4udG9Mb3dlckNhc2UoKSwgMCwgd29yZCwgd29yZC50b0xvd2VyQ2FzZSgpLCAwLCB7IGZpcnN0TWF0Y2hDYW5CZVdlYWs6IHRydWUsIGJvb3N0RnVsbE1hdGNoOiB0cnVlIH0pO1xuXHRyZXR1cm4gc2NvcmUgPyBjcmVhdGVNYXRjaGVzKHNjb3JlKSA6IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhbnlTY29yZShwYXR0ZXJuOiBzdHJpbmcsIGxvd1BhdHRlcm46IHN0cmluZywgcGF0dGVyblBvczogbnVtYmVyLCB3b3JkOiBzdHJpbmcsIGxvd1dvcmQ6IHN0cmluZywgd29yZFBvczogbnVtYmVyKTogRnV6enlTY29yZSB7XG5cdGNvbnN0IG1heCA9IE1hdGgubWluKDEzLCBwYXR0ZXJuLmxlbmd0aCk7XG5cdGZvciAoOyBwYXR0ZXJuUG9zIDwgbWF4OyBwYXR0ZXJuUG9zKyspIHtcblx0XHRjb25zdCByZXN1bHQgPSBmdXp6eVNjb3JlKHBhdHRlcm4sIGxvd1BhdHRlcm4sIHBhdHRlcm5Qb3MsIHdvcmQsIGxvd1dvcmQsIHdvcmRQb3MsIHsgZmlyc3RNYXRjaENhbkJlV2VhazogdHJ1ZSwgYm9vc3RGdWxsTWF0Y2g6IHRydWUgfSk7XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIFswLCB3b3JkUG9zXTtcbn1cblxuLy8jcmVnaW9uIC0tLSBmdXp6eVNjb3JlIC0tLVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWF0Y2hlcyhzY29yZTogdW5kZWZpbmVkIHwgRnV6enlTY29yZSk6IElNYXRjaFtdIHtcblx0aWYgKHR5cGVvZiBzY29yZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblx0Y29uc3QgcmVzOiBJTWF0Y2hbXSA9IFtdO1xuXHRjb25zdCB3b3JkUG9zID0gc2NvcmVbMV07XG5cdGZvciAobGV0IGkgPSBzY29yZS5sZW5ndGggLSAxOyBpID4gMTsgaS0tKSB7XG5cdFx0Y29uc3QgcG9zID0gc2NvcmVbaV0gKyB3b3JkUG9zO1xuXHRcdGNvbnN0IGxhc3QgPSByZXNbcmVzLmxlbmd0aCAtIDFdO1xuXHRcdGlmIChsYXN0ICYmIGxhc3QuZW5kID09PSBwb3MpIHtcblx0XHRcdGxhc3QuZW5kID0gcG9zICsgMTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzLnB1c2goeyBzdGFydDogcG9zLCBlbmQ6IHBvcyArIDEgfSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXM7XG59XG5cbmNvbnN0IF9tYXhMZW4gPSAxMjg7XG5cbmZ1bmN0aW9uIGluaXRUYWJsZSgpIHtcblx0Y29uc3QgdGFibGU6IG51bWJlcltdW10gPSBbXTtcblx0Y29uc3Qgcm93OiBudW1iZXJbXSA9IFtdO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8PSBfbWF4TGVuOyBpKyspIHtcblx0XHRyb3dbaV0gPSAwO1xuXHR9XG5cdGZvciAobGV0IGkgPSAwOyBpIDw9IF9tYXhMZW47IGkrKykge1xuXHRcdHRhYmxlLnB1c2gocm93LnNsaWNlKDApKTtcblx0fVxuXHRyZXR1cm4gdGFibGU7XG59XG5cbmZ1bmN0aW9uIGluaXRBcnIobWF4TGVuOiBudW1iZXIpIHtcblx0Y29uc3Qgcm93OiBudW1iZXJbXSA9IFtdO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8PSBtYXhMZW47IGkrKykge1xuXHRcdHJvd1tpXSA9IDA7XG5cdH1cblx0cmV0dXJuIHJvdztcbn1cblxuY29uc3QgX21pbldvcmRNYXRjaFBvcyA9IGluaXRBcnIoMiAqIF9tYXhMZW4pOyAvLyBtaW4gd29yZCBwb3NpdGlvbiBmb3IgYSBjZXJ0YWluIHBhdHRlcm4gcG9zaXRpb25cbmNvbnN0IF9tYXhXb3JkTWF0Y2hQb3MgPSBpbml0QXJyKDIgKiBfbWF4TGVuKTsgLy8gbWF4IHdvcmQgcG9zaXRpb24gZm9yIGEgY2VydGFpbiBwYXR0ZXJuIHBvc2l0aW9uXG5jb25zdCBfZGlhZyA9IGluaXRUYWJsZSgpOyAvLyB0aGUgbGVuZ3RoIG9mIGEgY29udGlndW91cyBkaWFnb25hbCBtYXRjaFxuY29uc3QgX3RhYmxlID0gaW5pdFRhYmxlKCk7XG5jb25zdCBfYXJyb3dzID0gPEFycm93W11bXT5pbml0VGFibGUoKTtcbmNvbnN0IF9kZWJ1ZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBwcmludFRhYmxlKHRhYmxlOiBudW1iZXJbXVtdLCBwYXR0ZXJuOiBzdHJpbmcsIHBhdHRlcm5MZW46IG51bWJlciwgd29yZDogc3RyaW5nLCB3b3JkTGVuOiBudW1iZXIpOiBzdHJpbmcge1xuXHRmdW5jdGlvbiBwYWQoczogc3RyaW5nLCBuOiBudW1iZXIsIHBhZCA9ICcgJykge1xuXHRcdHdoaWxlIChzLmxlbmd0aCA8IG4pIHtcblx0XHRcdHMgPSBwYWQgKyBzO1xuXHRcdH1cblx0XHRyZXR1cm4gcztcblx0fVxuXHRsZXQgcmV0ID0gYCB8ICAgfCR7d29yZC5zcGxpdCgnJykubWFwKGMgPT4gcGFkKGMsIDMpKS5qb2luKCd8Jyl9XFxuYDtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8PSBwYXR0ZXJuTGVuOyBpKyspIHtcblx0XHRpZiAoaSA9PT0gMCkge1xuXHRcdFx0cmV0ICs9ICcgfCc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldCArPSBgJHtwYXR0ZXJuW2kgLSAxXX18YDtcblx0XHR9XG5cdFx0cmV0ICs9IHRhYmxlW2ldLnNsaWNlKDAsIHdvcmRMZW4gKyAxKS5tYXAobiA9PiBwYWQobi50b1N0cmluZygpLCAzKSkuam9pbignfCcpICsgJ1xcbic7XG5cdH1cblx0cmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gcHJpbnRUYWJsZXMocGF0dGVybjogc3RyaW5nLCBwYXR0ZXJuU3RhcnQ6IG51bWJlciwgd29yZDogc3RyaW5nLCB3b3JkU3RhcnQ6IG51bWJlcik6IHZvaWQge1xuXHRwYXR0ZXJuID0gcGF0dGVybi5zdWJzdHIocGF0dGVyblN0YXJ0KTtcblx0d29yZCA9IHdvcmQuc3Vic3RyKHdvcmRTdGFydCk7XG5cdGNvbnNvbGUubG9nKHByaW50VGFibGUoX3RhYmxlLCBwYXR0ZXJuLCBwYXR0ZXJuLmxlbmd0aCwgd29yZCwgd29yZC5sZW5ndGgpKTtcblx0Y29uc29sZS5sb2cocHJpbnRUYWJsZShfYXJyb3dzLCBwYXR0ZXJuLCBwYXR0ZXJuLmxlbmd0aCwgd29yZCwgd29yZC5sZW5ndGgpKTtcblx0Y29uc29sZS5sb2cocHJpbnRUYWJsZShfZGlhZywgcGF0dGVybiwgcGF0dGVybi5sZW5ndGgsIHdvcmQsIHdvcmQubGVuZ3RoKSk7XG59XG5cbmZ1bmN0aW9uIGlzU2VwYXJhdG9yQXRQb3ModmFsdWU6IHN0cmluZywgaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHZhbHVlLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRjb25zdCBjb2RlID0gdmFsdWUuY29kZVBvaW50QXQoaW5kZXgpO1xuXHRzd2l0Y2ggKGNvZGUpIHtcblx0XHRjYXNlIENoYXJDb2RlLlVuZGVybGluZTpcblx0XHRjYXNlIENoYXJDb2RlLkRhc2g6XG5cdFx0Y2FzZSBDaGFyQ29kZS5QZXJpb2Q6XG5cdFx0Y2FzZSBDaGFyQ29kZS5TcGFjZTpcblx0XHRjYXNlIENoYXJDb2RlLlNsYXNoOlxuXHRcdGNhc2UgQ2hhckNvZGUuQmFja3NsYXNoOlxuXHRcdGNhc2UgQ2hhckNvZGUuU2luZ2xlUXVvdGU6XG5cdFx0Y2FzZSBDaGFyQ29kZS5Eb3VibGVRdW90ZTpcblx0XHRjYXNlIENoYXJDb2RlLkNvbG9uOlxuXHRcdGNhc2UgQ2hhckNvZGUuRG9sbGFyU2lnbjpcblx0XHRjYXNlIENoYXJDb2RlLkxlc3NUaGFuOlxuXHRcdGNhc2UgQ2hhckNvZGUuR3JlYXRlclRoYW46XG5cdFx0Y2FzZSBDaGFyQ29kZS5PcGVuUGFyZW46XG5cdFx0Y2FzZSBDaGFyQ29kZS5DbG9zZVBhcmVuOlxuXHRcdGNhc2UgQ2hhckNvZGUuT3BlblNxdWFyZUJyYWNrZXQ6XG5cdFx0Y2FzZSBDaGFyQ29kZS5DbG9zZVNxdWFyZUJyYWNrZXQ6XG5cdFx0Y2FzZSBDaGFyQ29kZS5PcGVuQ3VybHlCcmFjZTpcblx0XHRjYXNlIENoYXJDb2RlLkNsb3NlQ3VybHlCcmFjZTpcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdGNhc2UgdW5kZWZpbmVkOlxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRpZiAoc3RyaW5ncy5pc0Vtb2ppSW1wcmVjaXNlKGNvZGUpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzV2hpdGVzcGFjZUF0UG9zKHZhbHVlOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcblx0aWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB2YWx1ZS5sZW5ndGgpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Y29uc3QgY29kZSA9IHZhbHVlLmNoYXJDb2RlQXQoaW5kZXgpO1xuXHRzd2l0Y2ggKGNvZGUpIHtcblx0XHRjYXNlIENoYXJDb2RlLlNwYWNlOlxuXHRcdGNhc2UgQ2hhckNvZGUuVGFiOlxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5mdW5jdGlvbiBpc1VwcGVyQ2FzZUF0UG9zKHBvczogbnVtYmVyLCB3b3JkOiBzdHJpbmcsIHdvcmRMb3c6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gd29yZFtwb3NdICE9PSB3b3JkTG93W3Bvc107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1BhdHRlcm5JbldvcmQocGF0dGVybkxvdzogc3RyaW5nLCBwYXR0ZXJuUG9zOiBudW1iZXIsIHBhdHRlcm5MZW46IG51bWJlciwgd29yZExvdzogc3RyaW5nLCB3b3JkUG9zOiBudW1iZXIsIHdvcmRMZW46IG51bWJlciwgZmlsbE1pbldvcmRQb3NBcnIgPSBmYWxzZSk6IGJvb2xlYW4ge1xuXHR3aGlsZSAocGF0dGVyblBvcyA8IHBhdHRlcm5MZW4gJiYgd29yZFBvcyA8IHdvcmRMZW4pIHtcblx0XHRpZiAocGF0dGVybkxvd1twYXR0ZXJuUG9zXSA9PT0gd29yZExvd1t3b3JkUG9zXSkge1xuXHRcdFx0aWYgKGZpbGxNaW5Xb3JkUG9zQXJyKSB7XG5cdFx0XHRcdC8vIFJlbWVtYmVyIHRoZSBtaW4gd29yZCBwb3NpdGlvbiBmb3IgZWFjaCBwYXR0ZXJuIHBvc2l0aW9uXG5cdFx0XHRcdF9taW5Xb3JkTWF0Y2hQb3NbcGF0dGVyblBvc10gPSB3b3JkUG9zO1xuXHRcdFx0fVxuXHRcdFx0cGF0dGVyblBvcyArPSAxO1xuXHRcdH1cblx0XHR3b3JkUG9zICs9IDE7XG5cdH1cblx0cmV0dXJuIHBhdHRlcm5Qb3MgPT09IHBhdHRlcm5MZW47IC8vIHBhdHRlcm4gbXVzdCBiZSBleGhhdXN0ZWRcbn1cblxuY29uc3QgZW51bSBBcnJvdyB7IERpYWcgPSAxLCBMZWZ0ID0gMiwgTGVmdExlZnQgPSAzIH1cblxuLyoqXG4gKiBBbiBhcnJheSByZXByZXNlbnRpbmcgYSBmdXp6eSBtYXRjaC5cbiAqXG4gKiAwLiB0aGUgc2NvcmVcbiAqIDEuIHRoZSBvZmZzZXQgYXQgd2hpY2ggbWF0Y2hpbmcgc3RhcnRlZFxuICogMi4gYDxtYXRjaF9wb3NfTj5gXG4gKiAzLiBgPG1hdGNoX3Bvc18xPmBcbiAqIDQuIGA8bWF0Y2hfcG9zXzA+YCBldGNcbiAqL1xuZXhwb3J0IHR5cGUgRnV6enlTY29yZSA9IFtzY29yZTogbnVtYmVyLCB3b3JkU3RhcnQ6IG51bWJlciwgLi4ubWF0Y2hlczogbnVtYmVyW11dO1xuXG5leHBvcnQgbmFtZXNwYWNlIEZ1enp5U2NvcmUge1xuXHQvKipcblx0ICogTm8gbWF0Y2hlcyBhbmQgdmFsdWUgYC0xMDBgXG5cdCAqL1xuXHRleHBvcnQgY29uc3QgRGVmYXVsdDogRnV6enlTY29yZSA9IChbLTEwMCwgMF0pO1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc0RlZmF1bHQoc2NvcmU/OiBGdXp6eVNjb3JlKTogc2NvcmUgaXMgWy0xMDAsIDBdIHtcblx0XHRyZXR1cm4gIXNjb3JlIHx8IChzY29yZS5sZW5ndGggPT09IDIgJiYgc2NvcmVbMF0gPT09IC0xMDAgJiYgc2NvcmVbMV0gPT09IDApO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBGdXp6eVNjb3JlT3B0aW9ucyB7XG5cblx0c3RhdGljIGRlZmF1bHQgPSB7IGJvb3N0RnVsbE1hdGNoOiB0cnVlLCBmaXJzdE1hdGNoQ2FuQmVXZWFrOiBmYWxzZSB9O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGZpcnN0TWF0Y2hDYW5CZVdlYWs6IGJvb2xlYW4sXG5cdFx0cmVhZG9ubHkgYm9vc3RGdWxsTWF0Y2g6IGJvb2xlYW4sXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRnV6enlTY29yZXIge1xuXHQocGF0dGVybjogc3RyaW5nLCBsb3dQYXR0ZXJuOiBzdHJpbmcsIHBhdHRlcm5Qb3M6IG51bWJlciwgd29yZDogc3RyaW5nLCBsb3dXb3JkOiBzdHJpbmcsIHdvcmRQb3M6IG51bWJlciwgb3B0aW9ucz86IEZ1enp5U2NvcmVPcHRpb25zKTogRnV6enlTY29yZSB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZ1enp5U2NvcmUocGF0dGVybjogc3RyaW5nLCBwYXR0ZXJuTG93OiBzdHJpbmcsIHBhdHRlcm5TdGFydDogbnVtYmVyLCB3b3JkOiBzdHJpbmcsIHdvcmRMb3c6IHN0cmluZywgd29yZFN0YXJ0OiBudW1iZXIsIG9wdGlvbnM6IEZ1enp5U2NvcmVPcHRpb25zID0gRnV6enlTY29yZU9wdGlvbnMuZGVmYXVsdCk6IEZ1enp5U2NvcmUgfCB1bmRlZmluZWQge1xuXG5cdGNvbnN0IHBhdHRlcm5MZW4gPSBwYXR0ZXJuLmxlbmd0aCA+IF9tYXhMZW4gPyBfbWF4TGVuIDogcGF0dGVybi5sZW5ndGg7XG5cdGNvbnN0IHdvcmRMZW4gPSB3b3JkLmxlbmd0aCA+IF9tYXhMZW4gPyBfbWF4TGVuIDogd29yZC5sZW5ndGg7XG5cblx0aWYgKHBhdHRlcm5TdGFydCA+PSBwYXR0ZXJuTGVuIHx8IHdvcmRTdGFydCA+PSB3b3JkTGVuIHx8IChwYXR0ZXJuTGVuIC0gcGF0dGVyblN0YXJ0KSA+ICh3b3JkTGVuIC0gd29yZFN0YXJ0KSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvLyBSdW4gYSBzaW1wbGUgY2hlY2sgaWYgdGhlIGNoYXJhY3RlcnMgb2YgcGF0dGVybiBvY2N1clxuXHQvLyAoaW4gb3JkZXIpIGF0IGFsbCBpbiB3b3JkLiBJZiB0aGF0IGlzbid0IHRoZSBjYXNlIHdlXG5cdC8vIHN0b3AgYmVjYXVzZSBubyBtYXRjaCB3aWxsIGJlIHBvc3NpYmxlXG5cdGlmICghaXNQYXR0ZXJuSW5Xb3JkKHBhdHRlcm5Mb3csIHBhdHRlcm5TdGFydCwgcGF0dGVybkxlbiwgd29yZExvdywgd29yZFN0YXJ0LCB3b3JkTGVuLCB0cnVlKSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvLyBGaW5kIHRoZSBtYXggbWF0Y2hpbmcgd29yZCBwb3NpdGlvbiBmb3IgZWFjaCBwYXR0ZXJuIHBvc2l0aW9uXG5cdC8vIE5PVEU6IHRoZSBtaW4gbWF0Y2hpbmcgd29yZCBwb3NpdGlvbiB3YXMgZmlsbGVkIGluIGFib3ZlLCBpbiB0aGUgYGlzUGF0dGVybkluV29yZGAgY2FsbFxuXHRfZmlsbEluTWF4V29yZE1hdGNoUG9zKHBhdHRlcm5MZW4sIHdvcmRMZW4sIHBhdHRlcm5TdGFydCwgd29yZFN0YXJ0LCBwYXR0ZXJuTG93LCB3b3JkTG93KTtcblxuXHRsZXQgcm93OiBudW1iZXIgPSAxO1xuXHRsZXQgY29sdW1uOiBudW1iZXIgPSAxO1xuXHRsZXQgcGF0dGVyblBvcyA9IHBhdHRlcm5TdGFydDtcblx0bGV0IHdvcmRQb3MgPSB3b3JkU3RhcnQ7XG5cblx0Y29uc3QgaGFzU3Ryb25nRmlyc3RNYXRjaCA9IFtmYWxzZV07XG5cblx0Ly8gVGhlcmUgd2lsbCBiZSBhIG1hdGNoLCBmaWxsIGluIHRhYmxlc1xuXHRmb3IgKHJvdyA9IDEsIHBhdHRlcm5Qb3MgPSBwYXR0ZXJuU3RhcnQ7IHBhdHRlcm5Qb3MgPCBwYXR0ZXJuTGVuOyByb3crKywgcGF0dGVyblBvcysrKSB7XG5cblx0XHQvLyBSZWR1Y2Ugc2VhcmNoIHNwYWNlIHRvIHBvc3NpYmxlIG1hdGNoaW5nIHdvcmQgcG9zaXRpb25zIGFuZCB0byBwb3NzaWJsZSBhY2Nlc3MgZnJvbSBuZXh0IHJvd1xuXHRcdGNvbnN0IG1pbldvcmRNYXRjaFBvcyA9IF9taW5Xb3JkTWF0Y2hQb3NbcGF0dGVyblBvc107XG5cdFx0Y29uc3QgbWF4V29yZE1hdGNoUG9zID0gX21heFdvcmRNYXRjaFBvc1twYXR0ZXJuUG9zXTtcblx0XHRjb25zdCBuZXh0TWF4V29yZE1hdGNoUG9zID0gKHBhdHRlcm5Qb3MgKyAxIDwgcGF0dGVybkxlbiA/IF9tYXhXb3JkTWF0Y2hQb3NbcGF0dGVyblBvcyArIDFdIDogd29yZExlbik7XG5cblx0XHRmb3IgKGNvbHVtbiA9IG1pbldvcmRNYXRjaFBvcyAtIHdvcmRTdGFydCArIDEsIHdvcmRQb3MgPSBtaW5Xb3JkTWF0Y2hQb3M7IHdvcmRQb3MgPCBuZXh0TWF4V29yZE1hdGNoUG9zOyBjb2x1bW4rKywgd29yZFBvcysrKSB7XG5cblx0XHRcdGxldCBzY29yZSA9IE51bWJlci5NSU5fU0FGRV9JTlRFR0VSO1xuXHRcdFx0bGV0IGNhbkNvbWVEaWFnID0gZmFsc2U7XG5cblx0XHRcdGlmICh3b3JkUG9zIDw9IG1heFdvcmRNYXRjaFBvcykge1xuXHRcdFx0XHRzY29yZSA9IF9kb1Njb3JlKFxuXHRcdFx0XHRcdHBhdHRlcm4sIHBhdHRlcm5Mb3csIHBhdHRlcm5Qb3MsIHBhdHRlcm5TdGFydCxcblx0XHRcdFx0XHR3b3JkLCB3b3JkTG93LCB3b3JkUG9zLCB3b3JkTGVuLCB3b3JkU3RhcnQsXG5cdFx0XHRcdFx0X2RpYWdbcm93IC0gMV1bY29sdW1uIC0gMV0gPT09IDAsXG5cdFx0XHRcdFx0aGFzU3Ryb25nRmlyc3RNYXRjaFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgZGlhZ1Njb3JlID0gMDtcblx0XHRcdGlmIChzY29yZSAhPT0gTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVIpIHtcblx0XHRcdFx0Y2FuQ29tZURpYWcgPSB0cnVlO1xuXHRcdFx0XHRkaWFnU2NvcmUgPSBzY29yZSArIF90YWJsZVtyb3cgLSAxXVtjb2x1bW4gLSAxXTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY2FuQ29tZUxlZnQgPSB3b3JkUG9zID4gbWluV29yZE1hdGNoUG9zO1xuXHRcdFx0Y29uc3QgbGVmdFNjb3JlID0gY2FuQ29tZUxlZnQgPyBfdGFibGVbcm93XVtjb2x1bW4gLSAxXSArIChfZGlhZ1tyb3ddW2NvbHVtbiAtIDFdID4gMCA/IC01IDogMCkgOiAwOyAvLyBwZW5hbHR5IGZvciBhIGdhcCBzdGFydFxuXG5cdFx0XHRjb25zdCBjYW5Db21lTGVmdExlZnQgPSB3b3JkUG9zID4gbWluV29yZE1hdGNoUG9zICsgMSAmJiBfZGlhZ1tyb3ddW2NvbHVtbiAtIDFdID4gMDtcblx0XHRcdGNvbnN0IGxlZnRMZWZ0U2NvcmUgPSBjYW5Db21lTGVmdExlZnQgPyBfdGFibGVbcm93XVtjb2x1bW4gLSAyXSArIChfZGlhZ1tyb3ddW2NvbHVtbiAtIDJdID4gMCA/IC01IDogMCkgOiAwOyAvLyBwZW5hbHR5IGZvciBhIGdhcCBzdGFydFxuXG5cdFx0XHRpZiAoY2FuQ29tZUxlZnRMZWZ0ICYmICghY2FuQ29tZUxlZnQgfHwgbGVmdExlZnRTY29yZSA+PSBsZWZ0U2NvcmUpICYmICghY2FuQ29tZURpYWcgfHwgbGVmdExlZnRTY29yZSA+PSBkaWFnU2NvcmUpKSB7XG5cdFx0XHRcdC8vIGFsd2F5cyBwcmVmZXIgY2hvb3NpbmcgbGVmdCBsZWZ0IHRvIGp1bXAgb3ZlciBhIGRpYWdvbmFsIGJlY2F1c2UgdGhhdCBtZWFucyBhIG1hdGNoIGlzIGVhcmxpZXIgaW4gdGhlIHdvcmRcblx0XHRcdFx0X3RhYmxlW3Jvd11bY29sdW1uXSA9IGxlZnRMZWZ0U2NvcmU7XG5cdFx0XHRcdF9hcnJvd3Nbcm93XVtjb2x1bW5dID0gQXJyb3cuTGVmdExlZnQ7XG5cdFx0XHRcdF9kaWFnW3Jvd11bY29sdW1uXSA9IDA7XG5cdFx0XHR9IGVsc2UgaWYgKGNhbkNvbWVMZWZ0ICYmICghY2FuQ29tZURpYWcgfHwgbGVmdFNjb3JlID49IGRpYWdTY29yZSkpIHtcblx0XHRcdFx0Ly8gYWx3YXlzIHByZWZlciBjaG9vc2luZyBsZWZ0IHNpbmNlIHRoYXQgbWVhbnMgYSBtYXRjaCBpcyBlYXJsaWVyIGluIHRoZSB3b3JkXG5cdFx0XHRcdF90YWJsZVtyb3ddW2NvbHVtbl0gPSBsZWZ0U2NvcmU7XG5cdFx0XHRcdF9hcnJvd3Nbcm93XVtjb2x1bW5dID0gQXJyb3cuTGVmdDtcblx0XHRcdFx0X2RpYWdbcm93XVtjb2x1bW5dID0gMDtcblx0XHRcdH0gZWxzZSBpZiAoY2FuQ29tZURpYWcpIHtcblx0XHRcdFx0X3RhYmxlW3Jvd11bY29sdW1uXSA9IGRpYWdTY29yZTtcblx0XHRcdFx0X2Fycm93c1tyb3ddW2NvbHVtbl0gPSBBcnJvdy5EaWFnO1xuXHRcdFx0XHRfZGlhZ1tyb3ddW2NvbHVtbl0gPSBfZGlhZ1tyb3cgLSAxXVtjb2x1bW4gLSAxXSArIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYG5vdCBwb3NzaWJsZWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChfZGVidWcpIHtcblx0XHRwcmludFRhYmxlcyhwYXR0ZXJuLCBwYXR0ZXJuU3RhcnQsIHdvcmQsIHdvcmRTdGFydCk7XG5cdH1cblxuXHRpZiAoIWhhc1N0cm9uZ0ZpcnN0TWF0Y2hbMF0gJiYgIW9wdGlvbnMuZmlyc3RNYXRjaENhbkJlV2Vhaykge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRyb3ctLTtcblx0Y29sdW1uLS07XG5cblx0Y29uc3QgcmVzdWx0OiBGdXp6eVNjb3JlID0gW190YWJsZVtyb3ddW2NvbHVtbl0sIHdvcmRTdGFydF07XG5cblx0bGV0IGJhY2t3YXJkc0RpYWdMZW5ndGggPSAwO1xuXHRsZXQgbWF4TWF0Y2hDb2x1bW4gPSAwO1xuXG5cdHdoaWxlIChyb3cgPj0gMSkge1xuXHRcdC8vIEZpbmQgdGhlIGNvbHVtbiB3aGVyZSB3ZSBnbyBkaWFnb25hbGx5IHVwXG5cdFx0bGV0IGRpYWdDb2x1bW4gPSBjb2x1bW47XG5cdFx0ZG8ge1xuXHRcdFx0Y29uc3QgYXJyb3cgPSBfYXJyb3dzW3Jvd11bZGlhZ0NvbHVtbl07XG5cdFx0XHRpZiAoYXJyb3cgPT09IEFycm93LkxlZnRMZWZ0KSB7XG5cdFx0XHRcdGRpYWdDb2x1bW4gPSBkaWFnQ29sdW1uIC0gMjtcblx0XHRcdH0gZWxzZSBpZiAoYXJyb3cgPT09IEFycm93LkxlZnQpIHtcblx0XHRcdFx0ZGlhZ0NvbHVtbiA9IGRpYWdDb2x1bW4gLSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gZm91bmQgdGhlIGRpYWdvbmFsXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKGRpYWdDb2x1bW4gPj0gMSk7XG5cblx0XHQvLyBPdmVydHVybiB0aGUgXCJmb3J3YXJkc1wiIGRlY2lzaW9uIGlmIGtlZXBpbmcgdGhlIFwiYmFja3dhcmRzXCIgZGlhZ29uYWwgd291bGQgZ2l2ZSBhIGJldHRlciBtYXRjaFxuXHRcdGlmIChcblx0XHRcdGJhY2t3YXJkc0RpYWdMZW5ndGggPiAxIC8vIG9ubHkgaWYgd2Ugd291bGQgaGF2ZSBhIGNvbnRpZ3VvdXMgbWF0Y2ggb2YgMyBjaGFyYWN0ZXJzXG5cdFx0XHQmJiBwYXR0ZXJuTG93W3BhdHRlcm5TdGFydCArIHJvdyAtIDFdID09PSB3b3JkTG93W3dvcmRTdGFydCArIGNvbHVtbiAtIDFdIC8vIG9ubHkgaWYgd2UgY2FuIGRvIGEgY29udGlndW91cyBtYXRjaCBkaWFnb25hbGx5XG5cdFx0XHQmJiAhaXNVcHBlckNhc2VBdFBvcyhkaWFnQ29sdW1uICsgd29yZFN0YXJ0IC0gMSwgd29yZCwgd29yZExvdykgLy8gb25seSBpZiB0aGUgZm9yd2FyZHMgY2hvc2UgZGlhZ29uYWwgaXMgbm90IGFuIHVwcGVyY2FzZVxuXHRcdFx0JiYgYmFja3dhcmRzRGlhZ0xlbmd0aCArIDEgPiBfZGlhZ1tyb3ddW2RpYWdDb2x1bW5dIC8vIG9ubHkgaWYgb3VyIGNvbnRpZ3VvdXMgbWF0Y2ggd291bGQgYmUgbG9uZ2VyIHRoYW4gdGhlIFwiZm9yd2FyZHNcIiBjb250aWd1b3VzIG1hdGNoXG5cdFx0KSB7XG5cdFx0XHRkaWFnQ29sdW1uID0gY29sdW1uO1xuXHRcdH1cblxuXHRcdGlmIChkaWFnQ29sdW1uID09PSBjb2x1bW4pIHtcblx0XHRcdC8vIHRoaXMgaXMgYSBjb250aWd1b3VzIG1hdGNoXG5cdFx0XHRiYWNrd2FyZHNEaWFnTGVuZ3RoKys7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJhY2t3YXJkc0RpYWdMZW5ndGggPSAxO1xuXHRcdH1cblxuXHRcdGlmICghbWF4TWF0Y2hDb2x1bW4pIHtcblx0XHRcdC8vIHJlbWVtYmVyIHRoZSBsYXN0IG1hdGNoZWQgY29sdW1uXG5cdFx0XHRtYXhNYXRjaENvbHVtbiA9IGRpYWdDb2x1bW47XG5cdFx0fVxuXG5cdFx0cm93LS07XG5cdFx0Y29sdW1uID0gZGlhZ0NvbHVtbiAtIDE7XG5cdFx0cmVzdWx0LnB1c2goY29sdW1uKTtcblx0fVxuXG5cdGlmICh3b3JkTGVuIC0gd29yZFN0YXJ0ID09PSBwYXR0ZXJuTGVuICYmIG9wdGlvbnMuYm9vc3RGdWxsTWF0Y2gpIHtcblx0XHQvLyB0aGUgd29yZCBtYXRjaGVzIHRoZSBwYXR0ZXJuIHdpdGggYWxsIGNoYXJhY3RlcnMhXG5cdFx0Ly8gZ2l2aW5nIHRoZSBzY29yZSBhIHRvdGFsIG1hdGNoIGJvb3N0ICh0byBjb21lIHVwIGFoZWFkIG90aGVyIHdvcmRzKVxuXHRcdHJlc3VsdFswXSArPSAyO1xuXHR9XG5cblx0Ly8gQWRkIDEgcGVuYWx0eSBmb3IgZWFjaCBza2lwcGVkIGNoYXJhY3RlciBpbiB0aGUgd29yZFxuXHRjb25zdCBza2lwcGVkQ2hhcnNDb3VudCA9IG1heE1hdGNoQ29sdW1uIC0gcGF0dGVybkxlbjtcblx0cmVzdWx0WzBdIC09IHNraXBwZWRDaGFyc0NvdW50O1xuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIF9maWxsSW5NYXhXb3JkTWF0Y2hQb3MocGF0dGVybkxlbjogbnVtYmVyLCB3b3JkTGVuOiBudW1iZXIsIHBhdHRlcm5TdGFydDogbnVtYmVyLCB3b3JkU3RhcnQ6IG51bWJlciwgcGF0dGVybkxvdzogc3RyaW5nLCB3b3JkTG93OiBzdHJpbmcpIHtcblx0bGV0IHBhdHRlcm5Qb3MgPSBwYXR0ZXJuTGVuIC0gMTtcblx0bGV0IHdvcmRQb3MgPSB3b3JkTGVuIC0gMTtcblx0d2hpbGUgKHBhdHRlcm5Qb3MgPj0gcGF0dGVyblN0YXJ0ICYmIHdvcmRQb3MgPj0gd29yZFN0YXJ0KSB7XG5cdFx0aWYgKHBhdHRlcm5Mb3dbcGF0dGVyblBvc10gPT09IHdvcmRMb3dbd29yZFBvc10pIHtcblx0XHRcdF9tYXhXb3JkTWF0Y2hQb3NbcGF0dGVyblBvc10gPSB3b3JkUG9zO1xuXHRcdFx0cGF0dGVyblBvcy0tO1xuXHRcdH1cblx0XHR3b3JkUG9zLS07XG5cdH1cbn1cblxuZnVuY3Rpb24gX2RvU2NvcmUoXG5cdHBhdHRlcm46IHN0cmluZywgcGF0dGVybkxvdzogc3RyaW5nLCBwYXR0ZXJuUG9zOiBudW1iZXIsIHBhdHRlcm5TdGFydDogbnVtYmVyLFxuXHR3b3JkOiBzdHJpbmcsIHdvcmRMb3c6IHN0cmluZywgd29yZFBvczogbnVtYmVyLCB3b3JkTGVuOiBudW1iZXIsIHdvcmRTdGFydDogbnVtYmVyLFxuXHRuZXdNYXRjaFN0YXJ0OiBib29sZWFuLFxuXHRvdXRGaXJzdE1hdGNoU3Ryb25nOiBib29sZWFuW10sXG4pOiBudW1iZXIge1xuXHRpZiAocGF0dGVybkxvd1twYXR0ZXJuUG9zXSAhPT0gd29yZExvd1t3b3JkUG9zXSkge1xuXHRcdHJldHVybiBOdW1iZXIuTUlOX1NBRkVfSU5URUdFUjtcblx0fVxuXG5cdGxldCBzY29yZSA9IDE7XG5cdGxldCBpc0dhcExvY2F0aW9uID0gZmFsc2U7XG5cdGlmICh3b3JkUG9zID09PSAocGF0dGVyblBvcyAtIHBhdHRlcm5TdGFydCkpIHtcblx0XHQvLyBjb21tb24gcHJlZml4OiBgZm9vYmFyIDwtPiBmb29iYXpgXG5cdFx0Ly8gICAgICAgICAgICAgICAgICAgICAgICAgICAgXl5eXl5cblx0XHRzY29yZSA9IHBhdHRlcm5bcGF0dGVyblBvc10gPT09IHdvcmRbd29yZFBvc10gPyA3IDogNTtcblxuXHR9IGVsc2UgaWYgKGlzVXBwZXJDYXNlQXRQb3Mod29yZFBvcywgd29yZCwgd29yZExvdykgJiYgKHdvcmRQb3MgPT09IDAgfHwgIWlzVXBwZXJDYXNlQXRQb3Mod29yZFBvcyAtIDEsIHdvcmQsIHdvcmRMb3cpKSkge1xuXHRcdC8vIGhpdHRpbmcgdXBwZXItY2FzZTogYGZvbyA8LT4gZm9yT3RoZXJzYFxuXHRcdC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXl4gXlxuXHRcdHNjb3JlID0gcGF0dGVybltwYXR0ZXJuUG9zXSA9PT0gd29yZFt3b3JkUG9zXSA/IDcgOiA1O1xuXHRcdGlzR2FwTG9jYXRpb24gPSB0cnVlO1xuXG5cdH0gZWxzZSBpZiAoaXNTZXBhcmF0b3JBdFBvcyh3b3JkTG93LCB3b3JkUG9zKSAmJiAod29yZFBvcyA9PT0gMCB8fCAhaXNTZXBhcmF0b3JBdFBvcyh3b3JkTG93LCB3b3JkUG9zIC0gMSkpKSB7XG5cdFx0Ly8gaGl0dGluZyBhIHNlcGFyYXRvcjogYC4gPC0+IGZvby5iYXJgXG5cdFx0Ly8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF5cblx0XHRzY29yZSA9IDU7XG5cblx0fSBlbHNlIGlmIChpc1NlcGFyYXRvckF0UG9zKHdvcmRMb3csIHdvcmRQb3MgLSAxKSB8fCBpc1doaXRlc3BhY2VBdFBvcyh3b3JkTG93LCB3b3JkUG9zIC0gMSkpIHtcblx0XHQvLyBwb3N0IHNlcGFyYXRvcjogYGZvbyA8LT4gYmFyX2Zvb2Bcblx0XHQvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF5eXlxuXHRcdHNjb3JlID0gNTtcblx0XHRpc0dhcExvY2F0aW9uID0gdHJ1ZTtcblx0fVxuXG5cdGlmIChzY29yZSA+IDEgJiYgcGF0dGVyblBvcyA9PT0gcGF0dGVyblN0YXJ0KSB7XG5cdFx0b3V0Rmlyc3RNYXRjaFN0cm9uZ1swXSA9IHRydWU7XG5cdH1cblxuXHRpZiAoIWlzR2FwTG9jYXRpb24pIHtcblx0XHRpc0dhcExvY2F0aW9uID0gaXNVcHBlckNhc2VBdFBvcyh3b3JkUG9zLCB3b3JkLCB3b3JkTG93KSB8fCBpc1NlcGFyYXRvckF0UG9zKHdvcmRMb3csIHdvcmRQb3MgLSAxKSB8fCBpc1doaXRlc3BhY2VBdFBvcyh3b3JkTG93LCB3b3JkUG9zIC0gMSk7XG5cdH1cblxuXHQvL1xuXHRpZiAocGF0dGVyblBvcyA9PT0gcGF0dGVyblN0YXJ0KSB7IC8vIGZpcnN0IGNoYXJhY3RlciBpbiBwYXR0ZXJuXG5cdFx0aWYgKHdvcmRQb3MgPiB3b3JkU3RhcnQpIHtcblx0XHRcdC8vIHRoZSBmaXJzdCBwYXR0ZXJuIGNoYXJhY3RlciB3b3VsZCBtYXRjaCBhIHdvcmQgY2hhcmFjdGVyIHRoYXQgaXMgbm90IGF0IHRoZSB3b3JkIHN0YXJ0XG5cdFx0XHQvLyBzbyBpbnRyb2R1Y2UgYSBwZW5hbHR5IHRvIGFjY291bnQgZm9yIHRoZSBnYXAgcHJlY2VkaW5nIHRoaXMgbWF0Y2hcblx0XHRcdHNjb3JlIC09IGlzR2FwTG9jYXRpb24gPyAzIDogNTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0aWYgKG5ld01hdGNoU3RhcnQpIHtcblx0XHRcdC8vIHRoaXMgd291bGQgYmUgdGhlIGJlZ2lubmluZyBvZiBhIG5ldyBtYXRjaCAoaS5lLiB0aGVyZSB3b3VsZCBiZSBhIGdhcCBiZWZvcmUgdGhpcyBsb2NhdGlvbilcblx0XHRcdHNjb3JlICs9IGlzR2FwTG9jYXRpb24gPyAyIDogMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gdGhpcyBpcyBwYXJ0IG9mIGEgY29udGlndW91cyBtYXRjaCwgc28gZ2l2ZSBpdCBhIHNsaWdodCBib251cywgYnV0IGRvIHNvIG9ubHkgaWYgaXQgd291bGQgbm90IGJlIGEgcHJlZmVycmVkIGdhcCBsb2NhdGlvblxuXHRcdFx0c2NvcmUgKz0gaXNHYXBMb2NhdGlvbiA/IDAgOiAxO1xuXHRcdH1cblx0fVxuXG5cdGlmICh3b3JkUG9zICsgMSA9PT0gd29yZExlbikge1xuXHRcdC8vIHdlIGFsd2F5cyBwZW5hbGl6ZSBnYXBzLCBidXQgdGhpcyBnaXZlcyB1bmZhaXIgYWR2YW50YWdlcyB0byBhIG1hdGNoIHRoYXQgd291bGQgbWF0Y2ggdGhlIGxhc3QgY2hhcmFjdGVyIGluIHRoZSB3b3JkXG5cdFx0Ly8gc28gcHJldGVuZCB0aGVyZSBpcyBhIGdhcCBhZnRlciB0aGUgbGFzdCBjaGFyYWN0ZXIgaW4gdGhlIHdvcmQgdG8gbm9ybWFsaXplIHRoaW5nc1xuXHRcdHNjb3JlIC09IGlzR2FwTG9jYXRpb24gPyAzIDogNTtcblx0fVxuXG5cdHJldHVybiBzY29yZTtcbn1cblxuLy8jZW5kcmVnaW9uXG5cblxuLy8jcmVnaW9uIC0tLSBncmFjZWZ1bCAtLS1cblxuZXhwb3J0IGZ1bmN0aW9uIGZ1enp5U2NvcmVHcmFjZWZ1bEFnZ3Jlc3NpdmUocGF0dGVybjogc3RyaW5nLCBsb3dQYXR0ZXJuOiBzdHJpbmcsIHBhdHRlcm5Qb3M6IG51bWJlciwgd29yZDogc3RyaW5nLCBsb3dXb3JkOiBzdHJpbmcsIHdvcmRQb3M6IG51bWJlciwgb3B0aW9ucz86IEZ1enp5U2NvcmVPcHRpb25zKTogRnV6enlTY29yZSB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBmdXp6eVNjb3JlV2l0aFBlcm11dGF0aW9ucyhwYXR0ZXJuLCBsb3dQYXR0ZXJuLCBwYXR0ZXJuUG9zLCB3b3JkLCBsb3dXb3JkLCB3b3JkUG9zLCB0cnVlLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZ1enp5U2NvcmVHcmFjZWZ1bChwYXR0ZXJuOiBzdHJpbmcsIGxvd1BhdHRlcm46IHN0cmluZywgcGF0dGVyblBvczogbnVtYmVyLCB3b3JkOiBzdHJpbmcsIGxvd1dvcmQ6IHN0cmluZywgd29yZFBvczogbnVtYmVyLCBvcHRpb25zPzogRnV6enlTY29yZU9wdGlvbnMpOiBGdXp6eVNjb3JlIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIGZ1enp5U2NvcmVXaXRoUGVybXV0YXRpb25zKHBhdHRlcm4sIGxvd1BhdHRlcm4sIHBhdHRlcm5Qb3MsIHdvcmQsIGxvd1dvcmQsIHdvcmRQb3MsIGZhbHNlLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gZnV6enlTY29yZVdpdGhQZXJtdXRhdGlvbnMocGF0dGVybjogc3RyaW5nLCBsb3dQYXR0ZXJuOiBzdHJpbmcsIHBhdHRlcm5Qb3M6IG51bWJlciwgd29yZDogc3RyaW5nLCBsb3dXb3JkOiBzdHJpbmcsIHdvcmRQb3M6IG51bWJlciwgYWdncmVzc2l2ZTogYm9vbGVhbiwgb3B0aW9ucz86IEZ1enp5U2NvcmVPcHRpb25zKTogRnV6enlTY29yZSB8IHVuZGVmaW5lZCB7XG5cdGxldCB0b3AgPSBmdXp6eVNjb3JlKHBhdHRlcm4sIGxvd1BhdHRlcm4sIHBhdHRlcm5Qb3MsIHdvcmQsIGxvd1dvcmQsIHdvcmRQb3MsIG9wdGlvbnMpO1xuXG5cdGlmICh0b3AgJiYgIWFnZ3Jlc3NpdmUpIHtcblx0XHQvLyB3aGVuIHVzaW5nIHRoZSBvcmlnaW5hbCBwYXR0ZXJuIHlpZWxkIGEgcmVzdWx0IHdlYFxuXHRcdC8vIHJldHVybiBpdCB1bmxlc3Mgd2UgYXJlIGFnZ3Jlc3NpdmUgYW5kIHRyeSB0byBmaW5kXG5cdFx0Ly8gYSBiZXR0ZXIgYWxpZ25tZW50LCBlLmcuIGBjbm9gIC0+IGBeY29ebnNeb2xlYCBvciBgXmNeb15uc29sZWAuXG5cdFx0cmV0dXJuIHRvcDtcblx0fVxuXG5cdGlmIChwYXR0ZXJuLmxlbmd0aCA+PSAzKSB7XG5cdFx0Ly8gV2hlbiB0aGUgcGF0dGVybiBpcyBsb25nIGVub3VnaCB0aGVuIHRyeSBhIGZldyAobWF4IDcpXG5cdFx0Ly8gcGVybXV0YXRpb25zIG9mIHRoZSBwYXR0ZXJuIHRvIGZpbmQgYSBiZXR0ZXIgbWF0Y2guIFRoZVxuXHRcdC8vIHBlcm11dGF0aW9ucyBvbmx5IHN3YXAgbmVpZ2hib3VyaW5nIGNoYXJhY3RlcnMsIGUuZ1xuXHRcdC8vIGBjbm9zb2AgYmVjb21lcyBgY29uc29gLCBgY25zb29gLCBgY25vb3NgLlxuXHRcdGNvbnN0IHRyaWVzID0gTWF0aC5taW4oNywgcGF0dGVybi5sZW5ndGggLSAxKTtcblx0XHRmb3IgKGxldCBtb3ZpbmdQYXR0ZXJuUG9zID0gcGF0dGVyblBvcyArIDE7IG1vdmluZ1BhdHRlcm5Qb3MgPCB0cmllczsgbW92aW5nUGF0dGVyblBvcysrKSB7XG5cdFx0XHRjb25zdCBuZXdQYXR0ZXJuID0gbmV4dFR5cG9QZXJtdXRhdGlvbihwYXR0ZXJuLCBtb3ZpbmdQYXR0ZXJuUG9zKTtcblx0XHRcdGlmIChuZXdQYXR0ZXJuKSB7XG5cdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IGZ1enp5U2NvcmUobmV3UGF0dGVybiwgbmV3UGF0dGVybi50b0xvd2VyQ2FzZSgpLCBwYXR0ZXJuUG9zLCB3b3JkLCBsb3dXb3JkLCB3b3JkUG9zLCBvcHRpb25zKTtcblx0XHRcdFx0aWYgKGNhbmRpZGF0ZSkge1xuXHRcdFx0XHRcdGNhbmRpZGF0ZVswXSAtPSAzOyAvLyBwZXJtdXRhdGlvbiBwZW5hbHR5XG5cdFx0XHRcdFx0aWYgKCF0b3AgfHwgY2FuZGlkYXRlWzBdID4gdG9wWzBdKSB7XG5cdFx0XHRcdFx0XHR0b3AgPSBjYW5kaWRhdGU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRvcDtcbn1cblxuZnVuY3Rpb24gbmV4dFR5cG9QZXJtdXRhdGlvbihwYXR0ZXJuOiBzdHJpbmcsIHBhdHRlcm5Qb3M6IG51bWJlcik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cblx0aWYgKHBhdHRlcm5Qb3MgKyAxID49IHBhdHRlcm4ubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGNvbnN0IHN3YXAxID0gcGF0dGVybltwYXR0ZXJuUG9zXTtcblx0Y29uc3Qgc3dhcDIgPSBwYXR0ZXJuW3BhdHRlcm5Qb3MgKyAxXTtcblxuXHRpZiAoc3dhcDEgPT09IHN3YXAyKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHJldHVybiBwYXR0ZXJuLnNsaWNlKDAsIHBhdHRlcm5Qb3MpXG5cdFx0KyBzd2FwMlxuXHRcdCsgc3dhcDFcblx0XHQrIHBhdHRlcm4uc2xpY2UocGF0dGVyblBvcyArIDIpO1xufVxuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNB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LFlBQVk7QUFDZixjQUFNLFlBQVksV0FBVyxZQUFZLFdBQVcsWUFBWSxHQUFHLFlBQVksTUFBTSxTQUFTLFNBQVMsT0FBTztBQUM5RyxZQUFJLFdBQVc7QUFDZCxvQkFBVSxDQUFDLEtBQUs7QUFDaEIsY0FBSSxDQUFDLE9BQU8sVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUc7QUFDbEMsa0JBQU07QUFBQSxVQUNQO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFDUjtBQUVBLFNBQVMsb0JBQW9CLFNBQWlCLFlBQXdDO0FBRXJGLE1BQUksYUFBYSxLQUFLLFFBQVEsUUFBUTtBQUNyQyxXQUFPO0FBQUEsRUFDUjtBQUVBLFFBQU0sUUFBUSxRQUFRLFVBQVU7QUFDaEMsUUFBTSxRQUFRLFFBQVEsYUFBYSxDQUFDO0FBRXBDLE1BQUksVUFBVSxPQUFPO0FBQ3BCLFdBQU87QUFBQSxFQUNSO0FBRUEsU0FBTyxRQUFRLE1BQU0sR0FBRyxVQUFVLElBQy9CLFFBQ0EsUUFDQSxRQUFRLE1BQU0sYUFBYSxDQUFDO0FBQ2hDOyIsCiAgIm5hbWVzIjogWyJwYWQiLCAiQXJyb3ciLCAiRnV6enlTY29yZSJdCn0K
