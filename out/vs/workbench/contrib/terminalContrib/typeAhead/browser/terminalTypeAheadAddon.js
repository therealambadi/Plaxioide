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
import { disposableTimeout } from "../../../../../base/common/async.js";
import { Color, RGBA } from "../../../../../base/common/color.js";
import { debounce } from "../../../../../base/common/decorators.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { TERMINAL_CONFIG_SECTION } from "../../../terminal/common/terminal.js";
import { DEFAULT_LOCAL_ECHO_EXCLUDE } from "../common/terminalTypeAheadConfiguration.js";
var VT = /* @__PURE__ */ ((VT2) => {
  VT2["Esc"] = "\x1B";
  VT2["Csi"] = `\x1B[`;
  VT2["ShowCursor"] = `\x1B[?25h`;
  VT2["HideCursor"] = `\x1B[?25l`;
  VT2["DeleteChar"] = `\x1B[X`;
  VT2["DeleteRestOfLine"] = `\x1B[K`;
  return VT2;
})(VT || {});
const CSI_STYLE_RE = /^\x1b\[[0-9;]*m/;
const CSI_MOVE_RE = /^\x1b\[?([0-9]*)(;[35])?O?([DC])/;
const NOT_WORD_RE = /[^a-z0-9]/i;
var StatsConstants = /* @__PURE__ */ ((StatsConstants2) => {
  StatsConstants2[StatsConstants2["StatsBufferSize"] = 24] = "StatsBufferSize";
  StatsConstants2[StatsConstants2["StatsSendTelemetryEvery"] = 3e5] = "StatsSendTelemetryEvery";
  StatsConstants2[StatsConstants2["StatsMinSamplesToTurnOn"] = 5] = "StatsMinSamplesToTurnOn";
  StatsConstants2[StatsConstants2["StatsMinAccuracyToTurnOn"] = 0.3] = "StatsMinAccuracyToTurnOn";
  StatsConstants2[StatsConstants2["StatsToggleOffThreshold"] = 0.5] = "StatsToggleOffThreshold";
  return StatsConstants2;
})(StatsConstants || {});
const PREDICTION_OMIT_RE = /^(\x1b\[(\??25[hl]|\??[0-9;]+n))+/;
const core = (terminal) => terminal._core;
const flushOutput = (terminal) => {
};
var CursorMoveDirection = /* @__PURE__ */ ((CursorMoveDirection2) => {
  CursorMoveDirection2["Back"] = "D";
  CursorMoveDirection2["Forwards"] = "C";
  return CursorMoveDirection2;
})(CursorMoveDirection || {});
class Cursor {
  constructor(rows, cols, _buffer) {
    this.rows = rows;
    this.cols = cols;
    this._buffer = _buffer;
    this._x = 0;
    this._y = 1;
    this._baseY = 1;
    this._x = _buffer.cursorX;
    this._y = _buffer.cursorY;
    this._baseY = _buffer.baseY;
  }
  get x() {
    return this._x;
  }
  get y() {
    return this._y;
  }
  get baseY() {
    return this._baseY;
  }
  get coordinate() {
    return { x: this._x, y: this._y, baseY: this._baseY };
  }
  getLine() {
    return this._buffer.getLine(this._y + this._baseY);
  }
  getCell(loadInto) {
    return this.getLine()?.getCell(this._x, loadInto);
  }
  moveTo(coordinate) {
    this._x = coordinate.x;
    this._y = coordinate.y + coordinate.baseY - this._baseY;
    return this.moveInstruction();
  }
  clone() {
    const c = new Cursor(this.rows, this.cols, this._buffer);
    c.moveTo(this);
    return c;
  }
  move(x, y) {
    this._x = x;
    this._y = y;
    return this.moveInstruction();
  }
  shift(x = 0, y = 0) {
    this._x += x;
    this._y += y;
    return this.moveInstruction();
  }
  moveInstruction() {
    if (this._y >= this.rows) {
      this._baseY += this._y - (this.rows - 1);
      this._y = this.rows - 1;
    } else if (this._y < 0) {
      this._baseY -= this._y;
      this._y = 0;
    }
    return `${"\x1B[" /* Csi */}${this._y + 1};${this._x + 1}H`;
  }
}
const moveToWordBoundary = (b, cursor, direction) => {
  let ateLeadingWhitespace = false;
  if (direction < 0) {
    cursor.shift(-1);
  }
  let cell;
  while (cursor.x >= 0) {
    cell = cursor.getCell(cell);
    if (!cell?.getCode()) {
      return;
    }
    const chars = cell.getChars();
    if (NOT_WORD_RE.test(chars)) {
      if (ateLeadingWhitespace) {
        break;
      }
    } else {
      ateLeadingWhitespace = true;
    }
    cursor.shift(direction);
  }
  if (direction < 0) {
    cursor.shift(1);
  }
};
var MatchResult = /* @__PURE__ */ ((MatchResult2) => {
  MatchResult2[MatchResult2["Success"] = 0] = "Success";
  MatchResult2[MatchResult2["Failure"] = 1] = "Failure";
  MatchResult2[MatchResult2["Buffer"] = 2] = "Buffer";
  return MatchResult2;
})(MatchResult || {});
class StringReader {
  constructor(_input) {
    this._input = _input;
    this.index = 0;
  }
  get remaining() {
    return this._input.length - this.index;
  }
  get eof() {
    return this.index === this._input.length;
  }
  get rest() {
    return this._input.slice(this.index);
  }
  /**
   * Advances the reader and returns the character if it matches.
   */
  eatChar(char) {
    if (this._input[this.index] !== char) {
      return;
    }
    this.index++;
    return char;
  }
  /**
   * Advances the reader and returns the string if it matches.
   */
  eatStr(substr) {
    if (this._input.slice(this.index, substr.length) !== substr) {
      return;
    }
    this.index += substr.length;
    return substr;
  }
  /**
   * Matches and eats the substring character-by-character. If EOF is reached
   * before the substring is consumed, it will buffer. Index is not moved
   * if it's not a match.
   */
  eatGradually(substr) {
    const prevIndex = this.index;
    for (let i = 0; i < substr.length; i++) {
      if (i > 0 && this.eof) {
        return 2 /* Buffer */;
      }
      if (!this.eatChar(substr[i])) {
        this.index = prevIndex;
        return 1 /* Failure */;
      }
    }
    return 0 /* Success */;
  }
  /**
   * Advances the reader and returns the regex if it matches.
   */
  eatRe(re) {
    const match = re.exec(this._input.slice(this.index));
    if (!match) {
      return;
    }
    this.index += match[0].length;
    return match;
  }
  /**
   * Advances the reader and returns the character if the code matches.
   */
  eatCharCode(min = 0, max = min + 1) {
    const code = this._input.charCodeAt(this.index);
    if (code < min || code >= max) {
      return void 0;
    }
    this.index++;
    return code;
  }
}
class HardBoundary {
  constructor() {
    this.clearAfterTimeout = false;
  }
  apply() {
    return "";
  }
  rollback() {
    return "";
  }
  rollForwards() {
    return "";
  }
  matches() {
    return 1 /* Failure */;
  }
}
class TentativeBoundary {
  constructor(inner) {
    this.inner = inner;
  }
  apply(buffer, cursor) {
    this._appliedCursor = cursor.clone();
    this.inner.apply(buffer, this._appliedCursor);
    return "";
  }
  rollback(cursor) {
    this.inner.rollback(cursor.clone());
    return "";
  }
  rollForwards(cursor, withInput) {
    if (this._appliedCursor) {
      cursor.moveTo(this._appliedCursor);
    }
    return withInput;
  }
  matches(input) {
    return this.inner.matches(input);
  }
}
const isTenativeCharacterPrediction = (p) => p instanceof TentativeBoundary && p.inner instanceof CharacterPrediction;
class CharacterPrediction {
  constructor(_style, _char) {
    this._style = _style;
    this._char = _char;
    this.affectsStyle = true;
  }
  apply(_, cursor) {
    const cell = cursor.getCell();
    this.appliedAt = cell ? { pos: cursor.coordinate, oldAttributes: attributesToSeq(cell), oldChar: cell.getChars() } : { pos: cursor.coordinate, oldAttributes: "", oldChar: "" };
    cursor.shift(1);
    return this._style.apply + this._char + this._style.undo;
  }
  rollback(cursor) {
    if (!this.appliedAt) {
      return "";
    }
    const { oldAttributes, oldChar, pos } = this.appliedAt;
    const r = cursor.moveTo(pos) + (oldChar ? `${oldAttributes}${oldChar}${cursor.moveTo(pos)}` : "\x1B[X" /* DeleteChar */);
    return r;
  }
  rollForwards(cursor, input) {
    if (!this.appliedAt) {
      return "";
    }
    return cursor.clone().moveTo(this.appliedAt.pos) + input;
  }
  matches(input, lookBehind) {
    const startIndex = input.index;
    while (input.eatRe(CSI_STYLE_RE)) {
    }
    if (input.eof) {
      return 2 /* Buffer */;
    }
    if (input.eatChar(this._char)) {
      return 0 /* Success */;
    }
    if (lookBehind instanceof CharacterPrediction) {
      const sillyZshOutcome = input.eatGradually(`\b${lookBehind._char}${this._char}`);
      if (sillyZshOutcome !== 1 /* Failure */) {
        return sillyZshOutcome;
      }
    }
    input.index = startIndex;
    return 1 /* Failure */;
  }
}
class BackspacePrediction {
  constructor(_terminal) {
    this._terminal = _terminal;
  }
  apply(_, cursor) {
    const isLastChar = !cursor.getLine()?.translateToString(void 0, cursor.x).trim();
    const pos = cursor.coordinate;
    const move = cursor.shift(-1);
    const cell = cursor.getCell();
    this._appliedAt = cell ? { isLastChar, pos, oldAttributes: attributesToSeq(cell), oldChar: cell.getChars() } : { isLastChar, pos, oldAttributes: "", oldChar: "" };
    return move + "\x1B[X" /* DeleteChar */;
  }
  rollback(cursor) {
    if (!this._appliedAt) {
      return "";
    }
    const { oldAttributes, oldChar, pos } = this._appliedAt;
    if (!oldChar) {
      return cursor.moveTo(pos) + "\x1B[X" /* DeleteChar */;
    }
    return oldAttributes + oldChar + cursor.moveTo(pos) + attributesToSeq(core(this._terminal)._inputHandler._curAttrData);
  }
  rollForwards() {
    return "";
  }
  matches(input) {
    if (this._appliedAt?.isLastChar) {
      const r1 = input.eatGradually(`\b${"\x1B[" /* Csi */}K`);
      if (r1 !== 1 /* Failure */) {
        return r1;
      }
      const r2 = input.eatGradually(`\b \b`);
      if (r2 !== 1 /* Failure */) {
        return r2;
      }
    }
    return 1 /* Failure */;
  }
}
class NewlinePrediction {
  apply(_, cursor) {
    this._prevPosition = cursor.coordinate;
    cursor.move(0, cursor.y + 1);
    return "\r\n";
  }
  rollback(cursor) {
    return this._prevPosition ? cursor.moveTo(this._prevPosition) : "";
  }
  rollForwards() {
    return "";
  }
  matches(input) {
    return input.eatGradually("\r\n");
  }
}
class LinewrapPrediction extends NewlinePrediction {
  apply(_, cursor) {
    this._prevPosition = cursor.coordinate;
    cursor.move(0, cursor.y + 1);
    return " \r";
  }
  matches(input) {
    const r = input.eatGradually(" \r");
    if (r !== 1 /* Failure */) {
      const r2 = input.eatGradually("\x1B[K" /* DeleteRestOfLine */);
      return r2 === 2 /* Buffer */ ? 2 /* Buffer */ : r;
    }
    return input.eatGradually("\r\n");
  }
}
class CursorMovePrediction {
  constructor(_direction, _moveByWords, _amount) {
    this._direction = _direction;
    this._moveByWords = _moveByWords;
    this._amount = _amount;
  }
  apply(buffer, cursor) {
    const prevPosition = cursor.x;
    const currentCell = cursor.getCell();
    const prevAttrs = currentCell ? attributesToSeq(currentCell) : "";
    const { _amount: amount, _direction: direction, _moveByWords: moveByWords } = this;
    const delta = direction === "D" /* Back */ ? -1 : 1;
    const target = cursor.clone();
    if (moveByWords) {
      for (let i = 0; i < amount; i++) {
        moveToWordBoundary(buffer, target, delta);
      }
    } else {
      target.shift(delta * amount);
    }
    this._applied = {
      amount: Math.abs(cursor.x - target.x),
      prevPosition,
      prevAttrs,
      rollForward: cursor.moveTo(target)
    };
    return this._applied.rollForward;
  }
  rollback(cursor) {
    if (!this._applied) {
      return "";
    }
    return cursor.move(this._applied.prevPosition, cursor.y) + this._applied.prevAttrs;
  }
  rollForwards() {
    return "";
  }
  matches(input) {
    if (!this._applied) {
      return 1 /* Failure */;
    }
    const direction = this._direction;
    const { amount, rollForward } = this._applied;
    if (input.eatStr(`${"\x1B[" /* Csi */}${direction}`.repeat(amount))) {
      return 0 /* Success */;
    }
    if (direction === "D" /* Back */) {
      if (input.eatStr(`\b`.repeat(amount))) {
        return 0 /* Success */;
      }
    }
    if (rollForward) {
      const r = input.eatGradually(rollForward);
      if (r !== 1 /* Failure */) {
        return r;
      }
    }
    return input.eatGradually(`${"\x1B[" /* Csi */}${amount}${direction}`);
  }
}
class PredictionStats extends Disposable {
  constructor(timeline) {
    super();
    this._stats = [];
    this._index = 0;
    this._addedAtTime = /* @__PURE__ */ new WeakMap();
    this._changeEmitter = new Emitter();
    this.onChange = this._changeEmitter.event;
    this._register(timeline.onPredictionAdded((p) => this._addedAtTime.set(p, Date.now())));
    this._register(timeline.onPredictionSucceeded(this._pushStat.bind(this, true)));
    this._register(timeline.onPredictionFailed(this._pushStat.bind(this, false)));
  }
  /**
   * Gets the percent (0-1) of predictions that were accurate.
   */
  get accuracy() {
    let correctCount = 0;
    for (const [, correct] of this._stats) {
      if (correct) {
        correctCount++;
      }
    }
    return correctCount / (this._stats.length || 1);
  }
  /**
   * Gets the number of recorded stats.
   */
  get sampleSize() {
    return this._stats.length;
  }
  /**
   * Gets latency stats of successful predictions.
   */
  get latency() {
    const latencies = this._stats.filter(([, correct]) => correct).map(([s]) => s).sort();
    return {
      count: latencies.length,
      min: latencies[0],
      median: latencies[Math.floor(latencies.length / 2)],
      max: latencies[latencies.length - 1]
    };
  }
  /**
   * Gets the maximum observed latency.
   */
  get maxLatency() {
    let max = -Infinity;
    for (const [latency, correct] of this._stats) {
      if (correct) {
        max = Math.max(latency, max);
      }
    }
    return max;
  }
  _pushStat(correct, prediction) {
    const started = this._addedAtTime.get(prediction);
    this._stats[this._index] = [Date.now() - started, correct];
    this._index = (this._index + 1) % 24 /* StatsBufferSize */;
    this._changeEmitter.fire();
  }
}
class PredictionTimeline {
  constructor(terminal, _style) {
    this.terminal = terminal;
    this._style = _style;
    /**
     * Expected queue of events. Only predictions for the lowest are
     * written into the terminal.
     */
    this._expected = [];
    /**
     * Current prediction generation.
     */
    this._currentGen = 0;
    /**
     * Whether predictions are echoed to the terminal. If false, predictions
     * will still be computed internally for latency metrics, but input will
     * never be adjusted.
     */
    this._showPredictions = false;
    this._addedEmitter = new Emitter();
    this.onPredictionAdded = this._addedEmitter.event;
    this._failedEmitter = new Emitter();
    this.onPredictionFailed = this._failedEmitter.event;
    this._succeededEmitter = new Emitter();
    this.onPredictionSucceeded = this._succeededEmitter.event;
  }
  get _currentGenerationPredictions() {
    return this._expected.filter(({ gen }) => gen === this._expected[0].gen).map(({ p }) => p);
  }
  get isShowingPredictions() {
    return this._showPredictions;
  }
  get length() {
    return this._expected.length;
  }
  setShowPredictions(show) {
    if (show === this._showPredictions) {
      return;
    }
    this._showPredictions = show;
    const buffer = this._getActiveBuffer();
    if (!buffer) {
      return;
    }
    const toApply = this._currentGenerationPredictions;
    if (show) {
      this.clearCursor();
      this._style.expectIncomingStyle(toApply.reduce((count, p) => p.affectsStyle ? count + 1 : count, 0));
      this.terminal.write(toApply.map((p) => p.apply(buffer, this.physicalCursor(buffer))).join(""));
    } else {
      this.terminal.write(toApply.reverse().map((p) => p.rollback(this.physicalCursor(buffer))).join(""));
    }
  }
  /**
   * Undoes any predictions written and resets expectations.
   */
  undoAllPredictions() {
    const buffer = this._getActiveBuffer();
    if (this._showPredictions && buffer) {
      this.terminal.write(this._currentGenerationPredictions.reverse().map((p) => p.rollback(this.physicalCursor(buffer))).join(""));
    }
    this._expected = [];
  }
  /**
   * Should be called when input is incoming to the temrinal.
   */
  beforeServerInput(input) {
    const originalInput = input;
    if (this._inputBuffer) {
      input = this._inputBuffer + input;
      this._inputBuffer = void 0;
    }
    if (!this._expected.length) {
      this._clearPredictionState();
      return input;
    }
    const buffer = this._getActiveBuffer();
    if (!buffer) {
      this._clearPredictionState();
      return input;
    }
    let output = "";
    const reader = new StringReader(input);
    const startingGen = this._expected[0].gen;
    const emitPredictionOmitted = () => {
      const omit = reader.eatRe(PREDICTION_OMIT_RE);
      if (omit) {
        output += omit[0];
      }
    };
    ReadLoop: while (this._expected.length && reader.remaining > 0) {
      emitPredictionOmitted();
      const { p: prediction, gen } = this._expected[0];
      const cursor = this.physicalCursor(buffer);
      const beforeTestReaderIndex = reader.index;
      switch (prediction.matches(reader, this._lookBehind)) {
        case 0 /* Success */: {
          const eaten = input.slice(beforeTestReaderIndex, reader.index);
          if (gen === startingGen) {
            output += prediction.rollForwards?.(cursor, eaten);
          } else {
            prediction.apply(buffer, this.physicalCursor(buffer));
            output += eaten;
          }
          this._succeededEmitter.fire(prediction);
          this._lookBehind = prediction;
          this._expected.shift();
          break;
        }
        case 2 /* Buffer */:
          this._inputBuffer = input.slice(beforeTestReaderIndex);
          reader.index = input.length;
          break ReadLoop;
        case 1 /* Failure */: {
          const rollback = this._expected.filter((p) => p.gen === startingGen).reverse();
          output += rollback.map(({ p }) => p.rollback(this.physicalCursor(buffer))).join("");
          if (rollback.some((r) => r.p.affectsStyle)) {
            output += attributesToSeq(core(this.terminal)._inputHandler._curAttrData);
          }
          this._clearPredictionState();
          this._failedEmitter.fire(prediction);
          break ReadLoop;
        }
      }
    }
    emitPredictionOmitted();
    if (!reader.eof) {
      output += reader.rest;
      this._clearPredictionState();
    }
    if (this._expected.length && startingGen !== this._expected[0].gen) {
      for (const { p, gen } of this._expected) {
        if (gen !== this._expected[0].gen) {
          break;
        }
        if (p.affectsStyle) {
          this._style.expectIncomingStyle();
        }
        output += p.apply(buffer, this.physicalCursor(buffer));
      }
    }
    if (!this._showPredictions) {
      return originalInput;
    }
    if (output.length === 0 || output === input) {
      return output;
    }
    if (this._physicalCursor) {
      output += this._physicalCursor.moveInstruction();
    }
    output = "\x1B[?25l" /* HideCursor */ + output + "\x1B[?25h" /* ShowCursor */;
    return output;
  }
  /**
   * Clears any expected predictions and stored state. Should be called when
   * the pty gives us something we don't recognize.
   */
  _clearPredictionState() {
    this._expected = [];
    this.clearCursor();
    this._lookBehind = void 0;
  }
  /**
   * Appends a typeahead prediction.
   */
  addPrediction(buffer, prediction) {
    this._expected.push({ gen: this._currentGen, p: prediction });
    this._addedEmitter.fire(prediction);
    if (this._currentGen !== this._expected[0].gen) {
      prediction.apply(buffer, this.tentativeCursor(buffer));
      return false;
    }
    const text = prediction.apply(buffer, this.physicalCursor(buffer));
    this._tenativeCursor = void 0;
    if (this._showPredictions && text) {
      if (prediction.affectsStyle) {
        this._style.expectIncomingStyle();
      }
      this.terminal.write(text);
    }
    return true;
  }
  addBoundary(buffer, prediction) {
    let applied = false;
    if (buffer && prediction) {
      applied = this.addPrediction(buffer, new TentativeBoundary(prediction));
      prediction.apply(buffer, this.tentativeCursor(buffer));
    }
    this._currentGen++;
    return applied;
  }
  /**
   * Peeks the last prediction written.
   */
  peekEnd() {
    return this._expected[this._expected.length - 1]?.p;
  }
  /**
   * Peeks the first pending prediction.
   */
  peekStart() {
    return this._expected[0]?.p;
  }
  /**
   * Current position of the cursor in the terminal.
   */
  physicalCursor(buffer) {
    if (!this._physicalCursor) {
      if (this._showPredictions) {
        flushOutput(this.terminal);
      }
      this._physicalCursor = new Cursor(this.terminal.rows, this.terminal.cols, buffer);
    }
    return this._physicalCursor;
  }
  /**
   * Cursor position if all predictions and boundaries that have been inserted
   * so far turn out to be successfully predicted.
   */
  tentativeCursor(buffer) {
    if (!this._tenativeCursor) {
      this._tenativeCursor = this.physicalCursor(buffer).clone();
    }
    return this._tenativeCursor;
  }
  clearCursor() {
    this._physicalCursor = void 0;
    this._tenativeCursor = void 0;
  }
  _getActiveBuffer() {
    const buffer = this.terminal.buffer.active;
    return buffer.type === "normal" ? buffer : void 0;
  }
}
const attributesToArgs = (cell) => {
  if (cell.isAttributeDefault()) {
    return [0];
  }
  const args = [];
  if (cell.isBold()) {
    args.push(1);
  }
  if (cell.isDim()) {
    args.push(2);
  }
  if (cell.isItalic()) {
    args.push(3);
  }
  if (cell.isUnderline()) {
    args.push(4);
  }
  if (cell.isBlink()) {
    args.push(5);
  }
  if (cell.isInverse()) {
    args.push(7);
  }
  if (cell.isInvisible()) {
    args.push(8);
  }
  if (cell.isFgRGB()) {
    args.push(38, 2, cell.getFgColor() >>> 24, cell.getFgColor() >>> 16 & 255, cell.getFgColor() & 255);
  }
  if (cell.isFgPalette()) {
    args.push(38, 5, cell.getFgColor());
  }
  if (cell.isFgDefault()) {
    args.push(39);
  }
  if (cell.isBgRGB()) {
    args.push(48, 2, cell.getBgColor() >>> 24, cell.getBgColor() >>> 16 & 255, cell.getBgColor() & 255);
  }
  if (cell.isBgPalette()) {
    args.push(48, 5, cell.getBgColor());
  }
  if (cell.isBgDefault()) {
    args.push(49);
  }
  return args;
};
const attributesToSeq = (cell) => `${"\x1B[" /* Csi */}${attributesToArgs(cell).join(";")}m`;
const arrayHasPrefixAt = (a, ai, b) => {
  if (a.length - ai > b.length) {
    return false;
  }
  for (let bi = 0; bi < b.length; bi++, ai++) {
    if (b[ai] !== a[ai]) {
      return false;
    }
  }
  return true;
};
const getColorWidth = (params, pos) => {
  const accu = [0, 0, -1, 0, 0, 0];
  let cSpace = 0;
  let advance = 0;
  do {
    const v = params[pos + advance];
    accu[advance + cSpace] = typeof v === "number" ? v : v[0];
    if (typeof v !== "number") {
      let i = 0;
      do {
        if (accu[1] === 5) {
          cSpace = 1;
        }
        accu[advance + i + 1 + cSpace] = v[i];
      } while (++i < v.length && i + advance + 1 + cSpace < accu.length);
      break;
    }
    if (accu[1] === 5 && advance + cSpace >= 2 || accu[1] === 2 && advance + cSpace >= 5) {
      break;
    }
    if (accu[1]) {
      cSpace = 1;
    }
  } while (++advance + pos < params.length && advance + cSpace < accu.length);
  return advance;
};
const _TypeAheadStyle = class _TypeAheadStyle {
  constructor(value, _terminal) {
    this._terminal = _terminal;
    /**
     * Number of typeahead style arguments we expect to read. If this is 0 and
     * we see a style coming in, we know that the PTY actually wanted to update.
     */
    this._expectedIncomingStyles = 0;
    this.onUpdate(value);
  }
  static _compileArgs(args) {
    return `${"\x1B[" /* Csi */}${args.join(";")}m`;
  }
  /**
   * Signals that a style was written to the terminal and we should watch
   * for it coming in.
   */
  expectIncomingStyle(n = 1) {
    this._expectedIncomingStyles += n * 2;
  }
  /**
   * Starts tracking for CSI changes in the terminal.
   */
  startTracking() {
    this._expectedIncomingStyles = 0;
    this._onDidWriteSGR(attributesToArgs(core(this._terminal)._inputHandler._curAttrData));
    this._csiHandler = this._terminal.parser.registerCsiHandler({ final: "m" }, (args) => {
      this._onDidWriteSGR(args);
      return false;
    });
  }
  debounceStopTracking() {
    this._stopTracking();
  }
  /**
   * @inheritdoc
   */
  dispose() {
    this._stopTracking();
  }
  _stopTracking() {
    this._csiHandler?.dispose();
    this._csiHandler = void 0;
  }
  _onDidWriteSGR(args) {
    const originalUndo = this._undoArgs;
    for (let i = 0; i < args.length; ) {
      const px = args[i];
      const p = typeof px === "number" ? px : px[0];
      if (this._expectedIncomingStyles) {
        if (arrayHasPrefixAt(args, i, this._undoArgs)) {
          this._expectedIncomingStyles--;
          i += this._undoArgs.length;
          continue;
        }
        if (arrayHasPrefixAt(args, i, this._applyArgs)) {
          this._expectedIncomingStyles--;
          i += this._applyArgs.length;
          continue;
        }
      }
      const width = p === 38 || p === 48 || p === 58 ? getColorWidth(args, i) : 1;
      switch (this._applyArgs[0]) {
        case 1:
          if (p === 2) {
            this._undoArgs = [22, 2];
          } else if (p === 22 || p === 0) {
            this._undoArgs = [22];
          }
          break;
        case 2:
          if (p === 1) {
            this._undoArgs = [22, 1];
          } else if (p === 22 || p === 0) {
            this._undoArgs = [22];
          }
          break;
        case 38:
          if (p === 0 || p === 39 || p === 100) {
            this._undoArgs = [39];
          } else if (p >= 30 && p <= 38 || p >= 90 && p <= 97) {
            this._undoArgs = args.slice(i, i + width);
          }
          break;
        default:
          if (p === this._applyArgs[0]) {
            this._undoArgs = this._applyArgs;
          } else if (p === 0) {
            this._undoArgs = this._originalUndoArgs;
          }
      }
      i += width;
    }
    if (originalUndo !== this._undoArgs) {
      this.undo = _TypeAheadStyle._compileArgs(this._undoArgs);
    }
  }
  /**
   * Updates the current typeahead style.
   */
  onUpdate(style) {
    const { applyArgs, undoArgs } = this._getArgs(style);
    this._applyArgs = applyArgs;
    this._undoArgs = this._originalUndoArgs = undoArgs;
    this.apply = _TypeAheadStyle._compileArgs(this._applyArgs);
    this.undo = _TypeAheadStyle._compileArgs(this._undoArgs);
  }
  _getArgs(style) {
    switch (style) {
      case "bold":
        return { applyArgs: [1], undoArgs: [22] };
      case "dim":
        return { applyArgs: [2], undoArgs: [22] };
      case "italic":
        return { applyArgs: [3], undoArgs: [23] };
      case "underlined":
        return { applyArgs: [4], undoArgs: [24] };
      case "inverted":
        return { applyArgs: [7], undoArgs: [27] };
      default: {
        let color;
        try {
          color = Color.fromHex(style);
        } catch {
          color = new Color(new RGBA(255, 0, 0, 1));
        }
        const { r, g, b } = color.rgba;
        return { applyArgs: [38, 2, r, g, b], undoArgs: [39] };
      }
    }
  }
};
__decorateClass([
  debounce(2e3)
], _TypeAheadStyle.prototype, "debounceStopTracking", 1);
let TypeAheadStyle = _TypeAheadStyle;
const compileExcludeRegexp = (programs = DEFAULT_LOCAL_ECHO_EXCLUDE) => new RegExp(`\\b(${programs.map(escapeRegExpCharacters).join("|")})\\b`, "i");
var CharPredictState = /* @__PURE__ */ ((CharPredictState2) => {
  CharPredictState2[CharPredictState2["Unknown"] = 0] = "Unknown";
  CharPredictState2[CharPredictState2["HasPendingChar"] = 1] = "HasPendingChar";
  CharPredictState2[CharPredictState2["Validated"] = 2] = "Validated";
  return CharPredictState2;
})(CharPredictState || {});
let TypeAheadAddon = class extends Disposable {
  constructor(_processManager, _configurationService, _telemetryService) {
    super();
    this._processManager = _processManager;
    this._configurationService = _configurationService;
    this._telemetryService = _telemetryService;
    this._typeaheadThreshold = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoLatencyThreshold;
    this._excludeProgramRe = compileExcludeRegexp(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoExcludePrograms);
    this._terminalTitle = "";
    this._register(toDisposable(() => this._clearPredictionDebounce?.dispose()));
  }
  activate(terminal) {
    const style = this._typeaheadStyle = this._register(new TypeAheadStyle(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoStyle, terminal));
    const timeline = this._timeline = new PredictionTimeline(terminal, this._typeaheadStyle);
    const stats = this.stats = this._register(new PredictionStats(this._timeline));
    timeline.setShowPredictions(this._typeaheadThreshold === 0);
    this._register(terminal.onData((e) => this._onUserData(e)));
    this._register(terminal.onTitleChange((title) => {
      this._terminalTitle = title;
      this._reevaluatePredictorState(stats, timeline);
    }));
    this._register(terminal.onResize(() => {
      timeline.setShowPredictions(false);
      timeline.clearCursor();
      this._reevaluatePredictorState(stats, timeline);
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TERMINAL_CONFIG_SECTION)) {
        style.onUpdate(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoStyle);
        this._typeaheadThreshold = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoLatencyThreshold;
        this._excludeProgramRe = compileExcludeRegexp(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoExcludePrograms);
        this._reevaluatePredictorState(stats, timeline);
      }
    }));
    this._register(this._timeline.onPredictionSucceeded((p) => {
      if (this._lastRow?.charState === 1 /* HasPendingChar */ && isTenativeCharacterPrediction(p) && p.inner.appliedAt) {
        if (p.inner.appliedAt.pos.y + p.inner.appliedAt.pos.baseY === this._lastRow.y) {
          this._lastRow.charState = 2 /* Validated */;
        }
      }
    }));
    this._register(this._processManager.onBeforeProcessData((e) => this._onBeforeProcessData(e)));
    let nextStatsSend;
    this._register(stats.onChange(() => {
      if (!nextStatsSend) {
        nextStatsSend = setTimeout(() => {
          this._sendLatencyStats(stats);
          nextStatsSend = void 0;
        }, 3e5 /* StatsSendTelemetryEvery */);
      }
      if (timeline.length === 0) {
        style.debounceStopTracking();
      }
      this._reevaluatePredictorState(stats, timeline);
    }));
  }
  reset() {
    this._lastRow = void 0;
  }
  _deferClearingPredictions() {
    if (!this.stats || !this._timeline) {
      return;
    }
    this._clearPredictionDebounce?.dispose();
    if (this._timeline.length === 0 || this._timeline.peekStart()?.clearAfterTimeout === false) {
      this._clearPredictionDebounce = void 0;
      return;
    }
    this._clearPredictionDebounce = disposableTimeout(
      () => {
        this._timeline?.undoAllPredictions();
        if (this._lastRow?.charState === 1 /* HasPendingChar */) {
          this._lastRow.charState = 0 /* Unknown */;
        }
      },
      Math.max(500, this.stats.maxLatency * 3 / 2),
      this._store
    );
  }
  _reevaluatePredictorState(stats, timeline) {
    this._reevaluatePredictorStateNow(stats, timeline);
  }
  _reevaluatePredictorStateNow(stats, timeline) {
    if (this._excludeProgramRe.test(this._terminalTitle)) {
      timeline.setShowPredictions(false);
    } else if (this._typeaheadThreshold < 0) {
      timeline.setShowPredictions(false);
    } else if (this._typeaheadThreshold === 0) {
      timeline.setShowPredictions(true);
    } else if (stats.sampleSize > 5 /* StatsMinSamplesToTurnOn */ && stats.accuracy > 0.3 /* StatsMinAccuracyToTurnOn */) {
      const latency = stats.latency.median;
      if (latency >= this._typeaheadThreshold) {
        timeline.setShowPredictions(true);
      } else if (latency < this._typeaheadThreshold / 0.5 /* StatsToggleOffThreshold */) {
        timeline.setShowPredictions(false);
      }
    }
  }
  _sendLatencyStats(stats) {
    this._telemetryService.publicLog("terminalLatencyStats", {
      ...stats.latency,
      predictionAccuracy: stats.accuracy
    });
  }
  _onUserData(data) {
    if (this._timeline?.terminal.buffer.active.type !== "normal") {
      return;
    }
    const terminal = this._timeline.terminal;
    const buffer = terminal.buffer.active;
    if (buffer.cursorX === 1 && buffer.cursorY === terminal.rows - 1) {
      if (buffer.getLine(buffer.cursorY + buffer.baseY)?.getCell(0)?.getChars() === ":") {
        return;
      }
    }
    const actualY = buffer.baseY + buffer.cursorY;
    if (actualY !== this._lastRow?.y) {
      this._lastRow = { y: actualY, startingX: buffer.cursorX, endingX: buffer.cursorX, charState: 0 /* Unknown */ };
    } else {
      this._lastRow.startingX = Math.min(this._lastRow.startingX, buffer.cursorX);
      this._lastRow.endingX = Math.max(this._lastRow.endingX, this._timeline.physicalCursor(buffer).x);
    }
    const addLeftNavigating = (p) => this._timeline.tentativeCursor(buffer).x <= this._lastRow.startingX ? this._timeline.addBoundary(buffer, p) : this._timeline.addPrediction(buffer, p);
    const addRightNavigating = (p) => this._timeline.tentativeCursor(buffer).x >= this._lastRow.endingX - 1 ? this._timeline.addBoundary(buffer, p) : this._timeline.addPrediction(buffer, p);
    const reader = new StringReader(data);
    while (reader.remaining > 0) {
      if (reader.eatCharCode(127)) {
        const previous = this._timeline.peekEnd();
        if (previous && previous instanceof CharacterPrediction) {
          this._timeline.addBoundary();
        }
        if (this._timeline.isShowingPredictions) {
          flushOutput(this._timeline.terminal);
        }
        if (this._timeline.tentativeCursor(buffer).x <= this._lastRow.startingX) {
          this._timeline.addBoundary(buffer, new BackspacePrediction(this._timeline.terminal));
        } else {
          this._lastRow.endingX--;
          this._timeline.addPrediction(buffer, new BackspacePrediction(this._timeline.terminal));
        }
        continue;
      }
      if (reader.eatCharCode(32, 126)) {
        const char = data[reader.index - 1];
        const prediction = new CharacterPrediction(this._typeaheadStyle, char);
        if (this._lastRow.charState === 0 /* Unknown */) {
          this._timeline.addBoundary(buffer, prediction);
          this._lastRow.charState = 1 /* HasPendingChar */;
        } else {
          this._timeline.addPrediction(buffer, prediction);
        }
        if (this._timeline.tentativeCursor(buffer).x >= terminal.cols) {
          this._timeline.addBoundary(buffer, new LinewrapPrediction());
        }
        continue;
      }
      const cursorMv = reader.eatRe(CSI_MOVE_RE);
      if (cursorMv) {
        const direction = cursorMv[3];
        const p = new CursorMovePrediction(direction, !!cursorMv[2], Number(cursorMv[1]) || 1);
        if (direction === "D" /* Back */) {
          addLeftNavigating(p);
        } else {
          addRightNavigating(p);
        }
        continue;
      }
      if (reader.eatStr(`${"\x1B" /* Esc */}f`)) {
        addRightNavigating(new CursorMovePrediction("C" /* Forwards */, true, 1));
        continue;
      }
      if (reader.eatStr(`${"\x1B" /* Esc */}b`)) {
        addLeftNavigating(new CursorMovePrediction("D" /* Back */, true, 1));
        continue;
      }
      if (reader.eatChar("\r") && buffer.cursorY < terminal.rows - 1) {
        this._timeline.addPrediction(buffer, new NewlinePrediction());
        continue;
      }
      this._timeline.addBoundary(buffer, new HardBoundary());
      break;
    }
    if (this._timeline.length === 1) {
      this._deferClearingPredictions();
      this._typeaheadStyle.startTracking();
    }
  }
  _onBeforeProcessData(event) {
    if (!this._timeline) {
      return;
    }
    event.data = this._timeline.beforeServerInput(event.data);
    this._deferClearingPredictions();
  }
};
__decorateClass([
  debounce(100)
], TypeAheadAddon.prototype, "_reevaluatePredictorState", 1);
TypeAheadAddon = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITelemetryService)
], TypeAheadAddon);
export {
  CharPredictState,
  PredictionStats,
  PredictionTimeline,
  TypeAheadAddon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvdHlwZUFoZWFkL2Jyb3dzZXIvdGVybWluYWxUeXBlQWhlYWRBZGRvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29sb3IsIFJHQkEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBkZWJvdW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgWHRlcm1BdHRyaWJ1dGVzLCBJWHRlcm1Db3JlIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci94dGVybS1wcml2YXRlLmpzJztcbmltcG9ydCB7IElCZWZvcmVQcm9jZXNzRGF0YUV2ZW50LCBJVGVybWluYWxQcm9jZXNzTWFuYWdlciwgVEVSTUlOQUxfQ09ORklHX1NFQ1RJT04gfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHR5cGUgeyBJQnVmZmVyLCBJQnVmZmVyQ2VsbCwgSURpc3Bvc2FibGUsIElUZXJtaW5hbEFkZG9uLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBERUZBVUxUX0xPQ0FMX0VDSE9fRVhDTFVERSwgdHlwZSBJVGVybWluYWxUeXBlQWhlYWRDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvbi5qcyc7XG5cbmNvbnN0IGVudW0gVlQge1xuXHRFc2MgPSAnXFx4MWInLFxuXHRDc2kgPSBgXFx4MWJbYCxcblx0U2hvd0N1cnNvciA9IGBcXHgxYls/MjVoYCxcblx0SGlkZUN1cnNvciA9IGBcXHgxYls/MjVsYCxcblx0RGVsZXRlQ2hhciA9IGBcXHgxYltYYCxcblx0RGVsZXRlUmVzdE9mTGluZSA9IGBcXHgxYltLYCxcbn1cblxuY29uc3QgQ1NJX1NUWUxFX1JFID0gL15cXHgxYlxcW1swLTk7XSptLztcbmNvbnN0IENTSV9NT1ZFX1JFID0gL15cXHgxYlxcWz8oWzAtOV0qKSg7WzM1XSk/Tz8oW0RDXSkvO1xuY29uc3QgTk9UX1dPUkRfUkUgPSAvW15hLXowLTldL2k7XG5cbmNvbnN0IGVudW0gU3RhdHNDb25zdGFudHMge1xuXHRTdGF0c0J1ZmZlclNpemUgPSAyNCxcblx0U3RhdHNTZW5kVGVsZW1ldHJ5RXZlcnkgPSAxMDAwICogNjAgKiA1LCAvLyBob3cgb2Z0ZW4gdG8gY29sbGVjdCBzdGF0c1xuXHRTdGF0c01pblNhbXBsZXNUb1R1cm5PbiA9IDUsXG5cdFN0YXRzTWluQWNjdXJhY3lUb1R1cm5PbiA9IDAuMyxcblx0U3RhdHNUb2dnbGVPZmZUaHJlc2hvbGQgPSAwLjUsIC8vIGlmIGxhdGVuY3kgaXMgbGVzcyB0aGFuIGB0aHJlc2hvbGQgKiB0aGlzYCwgdHVybiBvZmZcbn1cblxuLyoqXG4gKiBDb2RlcyB0aGF0IHNob3VsZCBiZSBvbWl0dGVkIGZyb20gc2VuZGluZyB0byB0aGUgcHJlZGljdGlvbiBlbmdpbmUgYW5kIGluc3RlYWQgb21pdHRlZCBkaXJlY3RseTpcbiAqIC0gSGlkZSBjdXJzb3IgKERFQ1RDRU0pOiBXZSB3cmFwIHRoZSBsb2NhbCBlY2hvIHNlcXVlbmNlIGluIGhpZGUgYW5kIHNob3dcbiAqICAgQ1NJID8gMiA1IGxcbiAqIC0gU2hvdyBjdXJzb3IgKERFQ1RDRU0pOiBXZSB3cmFwIHRoZSBsb2NhbCBlY2hvIHNlcXVlbmNlIGluIGhpZGUgYW5kIHNob3dcbiAqICAgQ1NJID8gMiA1IGhcbiAqIC0gRGV2aWNlIFN0YXR1cyBSZXBvcnQgKERTUik6IFRoZXNlIHNlcXVlbmNlIGZpcmUgcmVwb3J0IGV2ZW50cyBmcm9tIHh0ZXJtIHdoaWNoIGNvdWxkIGNhdXNlXG4gKiAgIGRvdWJsZSByZXBvcnRpbmcgYW5kIHBvdGVudGlhbGx5IGEgc3RhY2sgb3ZlcmZsb3cgKCMxMTk0NzIpXG4gKiAgIENTSSBQcyBuXG4gKiAgIENTSSA/IFBzIG5cbiAqL1xuY29uc3QgUFJFRElDVElPTl9PTUlUX1JFID0gL14oXFx4MWJcXFsoXFw/PzI1W2hsXXxcXD8/WzAtOTtdK24pKSsvO1xuXG5jb25zdCBjb3JlID0gKHRlcm1pbmFsOiBUZXJtaW5hbCk6IElYdGVybUNvcmUgPT4gKHRlcm1pbmFsIGFzIGFueSkuX2NvcmU7XG5jb25zdCBmbHVzaE91dHB1dCA9ICh0ZXJtaW5hbDogVGVybWluYWwpID0+IHtcblx0Ly8gVE9ETzogRmx1c2hpbmcgb3V0cHV0IGlzIG5vdCBwb3NzaWJsZSBhbnltb3JlIHdpdGhvdXQgYXN5bmNcbn07XG5cbmNvbnN0IGVudW0gQ3Vyc29yTW92ZURpcmVjdGlvbiB7XG5cdEJhY2sgPSAnRCcsXG5cdEZvcndhcmRzID0gJ0MnLFxufVxuXG5pbnRlcmZhY2UgSUNvb3JkaW5hdGUge1xuXHR4OiBudW1iZXI7XG5cdHk6IG51bWJlcjtcblx0YmFzZVk6IG51bWJlcjtcbn1cblxuY2xhc3MgQ3Vyc29yIGltcGxlbWVudHMgSUNvb3JkaW5hdGUge1xuXHRwcml2YXRlIF94ID0gMDtcblx0cHJpdmF0ZSBfeSA9IDE7XG5cdHByaXZhdGUgX2Jhc2VZID0gMTtcblxuXHRnZXQgeCgpIHtcblx0XHRyZXR1cm4gdGhpcy5feDtcblx0fVxuXG5cdGdldCB5KCkge1xuXHRcdHJldHVybiB0aGlzLl95O1xuXHR9XG5cblx0Z2V0IGJhc2VZKCkge1xuXHRcdHJldHVybiB0aGlzLl9iYXNlWTtcblx0fVxuXG5cdGdldCBjb29yZGluYXRlKCk6IElDb29yZGluYXRlIHtcblx0XHRyZXR1cm4geyB4OiB0aGlzLl94LCB5OiB0aGlzLl95LCBiYXNlWTogdGhpcy5fYmFzZVkgfTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHJvd3M6IG51bWJlcixcblx0XHRyZWFkb25seSBjb2xzOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfYnVmZmVyOiBJQnVmZmVyXG5cdCkge1xuXHRcdHRoaXMuX3ggPSBfYnVmZmVyLmN1cnNvclg7XG5cdFx0dGhpcy5feSA9IF9idWZmZXIuY3Vyc29yWTtcblx0XHR0aGlzLl9iYXNlWSA9IF9idWZmZXIuYmFzZVk7XG5cdH1cblxuXHRnZXRMaW5lKCkge1xuXHRcdHJldHVybiB0aGlzLl9idWZmZXIuZ2V0TGluZSh0aGlzLl95ICsgdGhpcy5fYmFzZVkpO1xuXHR9XG5cblx0Z2V0Q2VsbChsb2FkSW50bz86IElCdWZmZXJDZWxsKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TGluZSgpPy5nZXRDZWxsKHRoaXMuX3gsIGxvYWRJbnRvKTtcblx0fVxuXG5cdG1vdmVUbyhjb29yZGluYXRlOiBJQ29vcmRpbmF0ZSkge1xuXHRcdHRoaXMuX3ggPSBjb29yZGluYXRlLng7XG5cdFx0dGhpcy5feSA9IChjb29yZGluYXRlLnkgKyBjb29yZGluYXRlLmJhc2VZKSAtIHRoaXMuX2Jhc2VZO1xuXHRcdHJldHVybiB0aGlzLm1vdmVJbnN0cnVjdGlvbigpO1xuXHR9XG5cblx0Y2xvbmUoKSB7XG5cdFx0Y29uc3QgYyA9IG5ldyBDdXJzb3IodGhpcy5yb3dzLCB0aGlzLmNvbHMsIHRoaXMuX2J1ZmZlcik7XG5cdFx0Yy5tb3ZlVG8odGhpcyk7XG5cdFx0cmV0dXJuIGM7XG5cdH1cblxuXHRtb3ZlKHg6IG51bWJlciwgeTogbnVtYmVyKSB7XG5cdFx0dGhpcy5feCA9IHg7XG5cdFx0dGhpcy5feSA9IHk7XG5cdFx0cmV0dXJuIHRoaXMubW92ZUluc3RydWN0aW9uKCk7XG5cdH1cblxuXHRzaGlmdCh4OiBudW1iZXIgPSAwLCB5OiBudW1iZXIgPSAwKSB7XG5cdFx0dGhpcy5feCArPSB4O1xuXHRcdHRoaXMuX3kgKz0geTtcblx0XHRyZXR1cm4gdGhpcy5tb3ZlSW5zdHJ1Y3Rpb24oKTtcblx0fVxuXG5cdG1vdmVJbnN0cnVjdGlvbigpIHtcblx0XHRpZiAodGhpcy5feSA+PSB0aGlzLnJvd3MpIHtcblx0XHRcdHRoaXMuX2Jhc2VZICs9IHRoaXMuX3kgLSAodGhpcy5yb3dzIC0gMSk7XG5cdFx0XHR0aGlzLl95ID0gdGhpcy5yb3dzIC0gMTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3kgPCAwKSB7XG5cdFx0XHR0aGlzLl9iYXNlWSAtPSB0aGlzLl95O1xuXHRcdFx0dGhpcy5feSA9IDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGAke1ZULkNzaX0ke3RoaXMuX3kgKyAxfTske3RoaXMuX3ggKyAxfUhgO1xuXHR9XG59XG5cbmNvbnN0IG1vdmVUb1dvcmRCb3VuZGFyeSA9IChiOiBJQnVmZmVyLCBjdXJzb3I6IEN1cnNvciwgZGlyZWN0aW9uOiAtMSB8IDEpID0+IHtcblx0bGV0IGF0ZUxlYWRpbmdXaGl0ZXNwYWNlID0gZmFsc2U7XG5cdGlmIChkaXJlY3Rpb24gPCAwKSB7XG5cdFx0Y3Vyc29yLnNoaWZ0KC0xKTtcblx0fVxuXG5cdGxldCBjZWxsOiBJQnVmZmVyQ2VsbCB8IHVuZGVmaW5lZDtcblx0d2hpbGUgKGN1cnNvci54ID49IDApIHtcblx0XHRjZWxsID0gY3Vyc29yLmdldENlbGwoY2VsbCk7XG5cdFx0aWYgKCFjZWxsPy5nZXRDb2RlKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjaGFycyA9IGNlbGwuZ2V0Q2hhcnMoKTtcblx0XHRpZiAoTk9UX1dPUkRfUkUudGVzdChjaGFycykpIHtcblx0XHRcdGlmIChhdGVMZWFkaW5nV2hpdGVzcGFjZSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0YXRlTGVhZGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGN1cnNvci5zaGlmdChkaXJlY3Rpb24pO1xuXHR9XG5cblx0aWYgKGRpcmVjdGlvbiA8IDApIHtcblx0XHRjdXJzb3Iuc2hpZnQoMSk7IC8vIHdlIHdhbnQgdG8gcGxhY2UgdGhlIGN1cnNvciBhZnRlciB0aGUgd2hpdGVzcGFjZSBzdGFydGluZyB0aGUgd29yZFxuXHR9XG59O1xuXG5jb25zdCBlbnVtIE1hdGNoUmVzdWx0IHtcblx0LyoqIG1hdGNoZWQgc3VjY2Vzc2Z1bGx5ICovXG5cdFN1Y2Nlc3MsXG5cdC8qKiBmYWlsZWQgdG8gbWF0Y2ggKi9cblx0RmFpbHVyZSxcblx0LyoqIGJ1ZmZlciBkYXRhLCBpdCBtaWdodCBtYXRjaCBpbiB0aGUgZnV0dXJlIG9uZSBtb3JlIGRhdGEgY29tZXMgaW4gKi9cblx0QnVmZmVyLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQcmVkaWN0aW9uIHtcblx0LyoqXG5cdCAqIFdoZXRoZXIgYXBwbHlpbmcgdGhpcyBwcmVkaWN0aW9uIGNhbiBtb2RpZnkgdGhlIHN0eWxlIGF0dHJpYnV0ZXMgb2YgdGhlXG5cdCAqIHRlcm1pbmFsLiBJZiBzbyBpdCBtZWFucyB3ZSBuZWVkIHRvIHJlc2V0IHRoZSBjdXJzb3Igc3R5bGUgaWYgaXQnc1xuXHQgKiByb2xsZWQgYmFjay5cblx0ICovXG5cdHJlYWRvbmx5IGFmZmVjdHNTdHlsZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIElmIHNldCB0byBmYWxzZSwgdGhlIHByZWRpY3Rpb24gd2lsbCBub3QgYmUgY2xlYXJlZCBpZiBubyBpbnB1dCBpc1xuXHQgKiByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIuXG5cdCAqL1xuXHRyZWFkb25seSBjbGVhckFmdGVyVGltZW91dD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBzZXF1ZW5jZSB0byBhcHBseSB0aGUgcHJlZGljdGlvbi5cblx0ICogQHBhcmFtIGJ1ZmZlciB0byB3cml0ZSB0b1xuXHQgKiBAcGFyYW0gY3Vyc29yIHBvc2l0aW9uIHRvIHdyaXRlIHRoZSBkYXRhLiBTaG91bGQgYWR2YW5jZSB0aGUgY3Vyc29yLlxuXHQgKiBAcmV0dXJucyBhIHN0cmluZyB0byBiZSB3cml0dGVuIHRvIHRoZSB1c2VyIHRlcm1pbmFsLCBvciBvcHRpb25hbGx5IGFcblx0ICogc3RyaW5nIGZvciB0aGUgdXNlciB0ZXJtaW5hbCBhbmQgcmVhbCBwdHkuXG5cdCAqL1xuXHRhcHBseShidWZmZXI6IElCdWZmZXIsIGN1cnNvcjogQ3Vyc29yKTogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc2VxdWVuY2UgdG8gcm9sbCBiYWNrIGEgcHJldmlvdXMgYGFwcGx5KClgIGNhbGwuIElmXG5cdCAqIGByb2xsRm9yd2FyZHNgIGlzIG5vdCBnaXZlbiwgdGhlbiB0aGlzIGlzIGFsc28gY2FsbGVkIGlmIGEgcHJlZGljdGlvblxuXHQgKiBpcyBjb3JyZWN0IGJlZm9yZSBzaG93IHRoZSB1c2VyJ3MgZGF0YS5cblx0ICovXG5cdHJvbGxiYWNrKGN1cnNvcjogQ3Vyc29yKTogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBJZiBhdmFpbGFibGUsIHRoaXMgd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgcHJlZGljdGlvbiBpcyBjb3JyZWN0LlxuXHQgKi9cblx0cm9sbEZvcndhcmRzKGN1cnNvcjogQ3Vyc29yLCB3aXRoSW5wdXQ6IHN0cmluZyk6IHN0cmluZztcblxuXHQvKipcblx0ICogUmV0dXJucyB3aGV0aGVyIHRoZSBnaXZlbiBpbnB1dCBpcyBvbmUgZXhwZWN0ZWQgYnkgdGhpcyBwcmVkaWN0aW9uLlxuXHQgKiBAcGFyYW0gaW5wdXQgcmVhZGVyIGZvciB0aGUgaW5wdXQgdGhlIFBUWSBpcyBnaXZpbmdcblx0ICogQHBhcmFtIGxvb2tCZWhpbmQgdGhlIGxhc3Qgc3VjY2Vzc2Z1bGx5LW1hZGUgcHJlZGljdGlvbiwgaWYgYW55XG5cdCAqL1xuXHRtYXRjaGVzKGlucHV0OiBTdHJpbmdSZWFkZXIsIGxvb2tCZWhpbmQ/OiBJUHJlZGljdGlvbik6IE1hdGNoUmVzdWx0O1xufVxuXG5jbGFzcyBTdHJpbmdSZWFkZXIge1xuXHRpbmRleCA9IDA7XG5cblx0Z2V0IHJlbWFpbmluZygpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5wdXQubGVuZ3RoIC0gdGhpcy5pbmRleDtcblx0fVxuXG5cdGdldCBlb2YoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5kZXggPT09IHRoaXMuX2lucHV0Lmxlbmd0aDtcblx0fVxuXG5cdGdldCByZXN0KCkge1xuXHRcdHJldHVybiB0aGlzLl9pbnB1dC5zbGljZSh0aGlzLmluZGV4KTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lucHV0OiBzdHJpbmdcblx0KSB7IH1cblxuXHQvKipcblx0ICogQWR2YW5jZXMgdGhlIHJlYWRlciBhbmQgcmV0dXJucyB0aGUgY2hhcmFjdGVyIGlmIGl0IG1hdGNoZXMuXG5cdCAqL1xuXHRlYXRDaGFyKGNoYXI6IHN0cmluZykge1xuXHRcdGlmICh0aGlzLl9pbnB1dFt0aGlzLmluZGV4XSAhPT0gY2hhcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5kZXgrKztcblx0XHRyZXR1cm4gY2hhcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZHZhbmNlcyB0aGUgcmVhZGVyIGFuZCByZXR1cm5zIHRoZSBzdHJpbmcgaWYgaXQgbWF0Y2hlcy5cblx0ICovXG5cdGVhdFN0cihzdWJzdHI6IHN0cmluZykge1xuXHRcdGlmICh0aGlzLl9pbnB1dC5zbGljZSh0aGlzLmluZGV4LCBzdWJzdHIubGVuZ3RoKSAhPT0gc3Vic3RyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5pbmRleCArPSBzdWJzdHIubGVuZ3RoO1xuXHRcdHJldHVybiBzdWJzdHI7XG5cdH1cblxuXHQvKipcblx0ICogTWF0Y2hlcyBhbmQgZWF0cyB0aGUgc3Vic3RyaW5nIGNoYXJhY3Rlci1ieS1jaGFyYWN0ZXIuIElmIEVPRiBpcyByZWFjaGVkXG5cdCAqIGJlZm9yZSB0aGUgc3Vic3RyaW5nIGlzIGNvbnN1bWVkLCBpdCB3aWxsIGJ1ZmZlci4gSW5kZXggaXMgbm90IG1vdmVkXG5cdCAqIGlmIGl0J3Mgbm90IGEgbWF0Y2guXG5cdCAqL1xuXHRlYXRHcmFkdWFsbHkoc3Vic3RyOiBzdHJpbmcpOiBNYXRjaFJlc3VsdCB7XG5cdFx0Y29uc3QgcHJldkluZGV4ID0gdGhpcy5pbmRleDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHN1YnN0ci5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKGkgPiAwICYmIHRoaXMuZW9mKSB7XG5cdFx0XHRcdHJldHVybiBNYXRjaFJlc3VsdC5CdWZmZXI7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5lYXRDaGFyKHN1YnN0cltpXSkpIHtcblx0XHRcdFx0dGhpcy5pbmRleCA9IHByZXZJbmRleDtcblx0XHRcdFx0cmV0dXJuIE1hdGNoUmVzdWx0LkZhaWx1cmU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1hdGNoUmVzdWx0LlN1Y2Nlc3M7XG5cdH1cblxuXHQvKipcblx0ICogQWR2YW5jZXMgdGhlIHJlYWRlciBhbmQgcmV0dXJucyB0aGUgcmVnZXggaWYgaXQgbWF0Y2hlcy5cblx0ICovXG5cdGVhdFJlKHJlOiBSZWdFeHApIHtcblx0XHRjb25zdCBtYXRjaCA9IHJlLmV4ZWModGhpcy5faW5wdXQuc2xpY2UodGhpcy5pbmRleCkpO1xuXHRcdGlmICghbWF0Y2gpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmluZGV4ICs9IG1hdGNoWzBdLmxlbmd0aDtcblx0XHRyZXR1cm4gbWF0Y2g7XG5cdH1cblxuXHQvKipcblx0ICogQWR2YW5jZXMgdGhlIHJlYWRlciBhbmQgcmV0dXJucyB0aGUgY2hhcmFjdGVyIGlmIHRoZSBjb2RlIG1hdGNoZXMuXG5cdCAqL1xuXHRlYXRDaGFyQ29kZShtaW4gPSAwLCBtYXggPSBtaW4gKyAxKSB7XG5cdFx0Y29uc3QgY29kZSA9IHRoaXMuX2lucHV0LmNoYXJDb2RlQXQodGhpcy5pbmRleCk7XG5cdFx0aWYgKGNvZGUgPCBtaW4gfHwgY29kZSA+PSBtYXgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5pbmRleCsrO1xuXHRcdHJldHVybiBjb2RlO1xuXHR9XG59XG5cbi8qKlxuICogUHJlaWRjdGlvbiB3aGljaCBuZXZlciB0ZXN0cyB0cnVlLiBXaWxsIGFsd2F5cyBkaXNjYXJkIHByZWRpY3Rpb25zIG1hZGVcbiAqIGFmdGVyIGl0LlxuICovXG5jbGFzcyBIYXJkQm91bmRhcnkgaW1wbGVtZW50cyBJUHJlZGljdGlvbiB7XG5cdHJlYWRvbmx5IGNsZWFyQWZ0ZXJUaW1lb3V0ID0gZmFsc2U7XG5cblx0YXBwbHkoKSB7XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cm9sbGJhY2soKSB7XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cm9sbEZvcndhcmRzKCkge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdG1hdGNoZXMoKSB7XG5cdFx0cmV0dXJuIE1hdGNoUmVzdWx0LkZhaWx1cmU7XG5cdH1cbn1cblxuLyoqXG4gKiBXcmFwcyBhbm90aGVyIHByZWRpY3Rpb24uIERvZXMgbm90IGFwcGx5IHRoZSBwcmVkaWN0aW9uLCBidXQgd2lsbCBwYXNzXG4gKiB0aHJvdWdoIGl0cyBgbWF0Y2hlc2AgcmVxdWVzdC5cbiAqL1xuY2xhc3MgVGVudGF0aXZlQm91bmRhcnkgaW1wbGVtZW50cyBJUHJlZGljdGlvbiB7XG5cdHByaXZhdGUgX2FwcGxpZWRDdXJzb3I/OiBDdXJzb3I7XG5cblx0Y29uc3RydWN0b3IocmVhZG9ubHkgaW5uZXI6IElQcmVkaWN0aW9uKSB7IH1cblxuXHRhcHBseShidWZmZXI6IElCdWZmZXIsIGN1cnNvcjogQ3Vyc29yKSB7XG5cdFx0dGhpcy5fYXBwbGllZEN1cnNvciA9IGN1cnNvci5jbG9uZSgpO1xuXHRcdHRoaXMuaW5uZXIuYXBwbHkoYnVmZmVyLCB0aGlzLl9hcHBsaWVkQ3Vyc29yKTtcblx0XHRyZXR1cm4gJyc7XG5cdH1cblxuXHRyb2xsYmFjayhjdXJzb3I6IEN1cnNvcikge1xuXHRcdHRoaXMuaW5uZXIucm9sbGJhY2soY3Vyc29yLmNsb25lKCkpO1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHJvbGxGb3J3YXJkcyhjdXJzb3I6IEN1cnNvciwgd2l0aElucHV0OiBzdHJpbmcpIHtcblx0XHRpZiAodGhpcy5fYXBwbGllZEN1cnNvcikge1xuXHRcdFx0Y3Vyc29yLm1vdmVUbyh0aGlzLl9hcHBsaWVkQ3Vyc29yKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gd2l0aElucHV0O1xuXHR9XG5cblx0bWF0Y2hlcyhpbnB1dDogU3RyaW5nUmVhZGVyKSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5uZXIubWF0Y2hlcyhpbnB1dCk7XG5cdH1cbn1cblxuY29uc3QgaXNUZW5hdGl2ZUNoYXJhY3RlclByZWRpY3Rpb24gPSAocDogdW5rbm93bik6IHAgaXMgKFRlbnRhdGl2ZUJvdW5kYXJ5ICYgeyBpbm5lcjogQ2hhcmFjdGVyUHJlZGljdGlvbiB9KSA9PlxuXHRwIGluc3RhbmNlb2YgVGVudGF0aXZlQm91bmRhcnkgJiYgcC5pbm5lciBpbnN0YW5jZW9mIENoYXJhY3RlclByZWRpY3Rpb247XG5cbi8qKlxuICogUHJlZGljdGlvbiBmb3IgYSBzaW5nbGUgYWxwaGFudW1lcmljIGNoYXJhY3Rlci5cbiAqL1xuY2xhc3MgQ2hhcmFjdGVyUHJlZGljdGlvbiBpbXBsZW1lbnRzIElQcmVkaWN0aW9uIHtcblx0cmVhZG9ubHkgYWZmZWN0c1N0eWxlID0gdHJ1ZTtcblxuXHRhcHBsaWVkQXQ/OiB7XG5cdFx0cG9zOiBJQ29vcmRpbmF0ZTtcblx0XHRvbGRBdHRyaWJ1dGVzOiBzdHJpbmc7XG5cdFx0b2xkQ2hhcjogc3RyaW5nO1xuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgX3N0eWxlOiBUeXBlQWhlYWRTdHlsZSwgcHJpdmF0ZSByZWFkb25seSBfY2hhcjogc3RyaW5nKSB7IH1cblxuXHRhcHBseShfOiBJQnVmZmVyLCBjdXJzb3I6IEN1cnNvcikge1xuXHRcdGNvbnN0IGNlbGwgPSBjdXJzb3IuZ2V0Q2VsbCgpO1xuXHRcdHRoaXMuYXBwbGllZEF0ID0gY2VsbFxuXHRcdFx0PyB7IHBvczogY3Vyc29yLmNvb3JkaW5hdGUsIG9sZEF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXNUb1NlcShjZWxsKSwgb2xkQ2hhcjogY2VsbC5nZXRDaGFycygpIH1cblx0XHRcdDogeyBwb3M6IGN1cnNvci5jb29yZGluYXRlLCBvbGRBdHRyaWJ1dGVzOiAnJywgb2xkQ2hhcjogJycgfTtcblxuXHRcdGN1cnNvci5zaGlmdCgxKTtcblxuXHRcdHJldHVybiB0aGlzLl9zdHlsZS5hcHBseSArIHRoaXMuX2NoYXIgKyB0aGlzLl9zdHlsZS51bmRvO1xuXHR9XG5cblx0cm9sbGJhY2soY3Vyc29yOiBDdXJzb3IpIHtcblx0XHRpZiAoIXRoaXMuYXBwbGllZEF0KSB7XG5cdFx0XHRyZXR1cm4gJyc7IC8vIG5vdCBhcHBsaWVkXG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBvbGRBdHRyaWJ1dGVzLCBvbGRDaGFyLCBwb3MgfSA9IHRoaXMuYXBwbGllZEF0O1xuXHRcdGNvbnN0IHIgPSBjdXJzb3IubW92ZVRvKHBvcykgKyAob2xkQ2hhciA/IGAke29sZEF0dHJpYnV0ZXN9JHtvbGRDaGFyfSR7Y3Vyc29yLm1vdmVUbyhwb3MpfWAgOiBWVC5EZWxldGVDaGFyKTtcblx0XHRyZXR1cm4gcjtcblx0fVxuXG5cdHJvbGxGb3J3YXJkcyhjdXJzb3I6IEN1cnNvciwgaW5wdXQ6IHN0cmluZykge1xuXHRcdGlmICghdGhpcy5hcHBsaWVkQXQpIHtcblx0XHRcdHJldHVybiAnJzsgLy8gbm90IGFwcGxpZWRcblx0XHR9XG5cblx0XHRyZXR1cm4gY3Vyc29yLmNsb25lKCkubW92ZVRvKHRoaXMuYXBwbGllZEF0LnBvcykgKyBpbnB1dDtcblx0fVxuXG5cdG1hdGNoZXMoaW5wdXQ6IFN0cmluZ1JlYWRlciwgbG9va0JlaGluZD86IElQcmVkaWN0aW9uKSB7XG5cdFx0Y29uc3Qgc3RhcnRJbmRleCA9IGlucHV0LmluZGV4O1xuXG5cdFx0Ly8gcmVtb3ZlIGFueSBzdHlsaW5nIENTSSBiZWZvcmUgY2hlY2tpbmcgdGhlIGNoYXJcblx0XHR3aGlsZSAoaW5wdXQuZWF0UmUoQ1NJX1NUWUxFX1JFKSkgeyB9XG5cblx0XHRpZiAoaW5wdXQuZW9mKSB7XG5cdFx0XHRyZXR1cm4gTWF0Y2hSZXN1bHQuQnVmZmVyO1xuXHRcdH1cblxuXHRcdGlmIChpbnB1dC5lYXRDaGFyKHRoaXMuX2NoYXIpKSB7XG5cdFx0XHRyZXR1cm4gTWF0Y2hSZXN1bHQuU3VjY2Vzcztcblx0XHR9XG5cblx0XHRpZiAobG9va0JlaGluZCBpbnN0YW5jZW9mIENoYXJhY3RlclByZWRpY3Rpb24pIHtcblx0XHRcdC8vIHNlZSAjMTEyODQyXG5cdFx0XHRjb25zdCBzaWxseVpzaE91dGNvbWUgPSBpbnB1dC5lYXRHcmFkdWFsbHkoYFxcYiR7bG9va0JlaGluZC5fY2hhcn0ke3RoaXMuX2NoYXJ9YCk7XG5cdFx0XHRpZiAoc2lsbHlac2hPdXRjb21lICE9PSBNYXRjaFJlc3VsdC5GYWlsdXJlKSB7XG5cdFx0XHRcdHJldHVybiBzaWxseVpzaE91dGNvbWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aW5wdXQuaW5kZXggPSBzdGFydEluZGV4O1xuXHRcdHJldHVybiBNYXRjaFJlc3VsdC5GYWlsdXJlO1xuXHR9XG59XG5cbmNsYXNzIEJhY2tzcGFjZVByZWRpY3Rpb24gaW1wbGVtZW50cyBJUHJlZGljdGlvbiB7XG5cdHByb3RlY3RlZCBfYXBwbGllZEF0Pzoge1xuXHRcdHBvczogSUNvb3JkaW5hdGU7XG5cdFx0b2xkQXR0cmlidXRlczogc3RyaW5nO1xuXHRcdG9sZENoYXI6IHN0cmluZztcblx0XHRpc0xhc3RDaGFyOiBib29sZWFuO1xuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsOiBUZXJtaW5hbCkgeyB9XG5cblx0YXBwbHkoXzogSUJ1ZmZlciwgY3Vyc29yOiBDdXJzb3IpIHtcblx0XHQvLyBhdCBlb2wgaWYgZXZlcnl0aGluZyB0byB0aGUgcmlnaHQgaXMgd2hpdGVzcGFjZSAoenNoIHdpbGwgZW1pdCBhIFwiY2xlYXIgbGluZVwiIGNvZGUgaW4gdGhpcyBjYXNlKVxuXHRcdC8vIHRvZG86IGNhbiBiZSBvcHRpbWl6ZWQgaWYgYGdldFRyaW1tZWRMZW5ndGhgIGlzIGV4cG9zZWQgZnJvbSB4dGVybVxuXHRcdGNvbnN0IGlzTGFzdENoYXIgPSAhY3Vyc29yLmdldExpbmUoKT8udHJhbnNsYXRlVG9TdHJpbmcodW5kZWZpbmVkLCBjdXJzb3IueCkudHJpbSgpO1xuXHRcdGNvbnN0IHBvcyA9IGN1cnNvci5jb29yZGluYXRlO1xuXHRcdGNvbnN0IG1vdmUgPSBjdXJzb3Iuc2hpZnQoLTEpO1xuXHRcdGNvbnN0IGNlbGwgPSBjdXJzb3IuZ2V0Q2VsbCgpO1xuXHRcdHRoaXMuX2FwcGxpZWRBdCA9IGNlbGxcblx0XHRcdD8geyBpc0xhc3RDaGFyLCBwb3MsIG9sZEF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXNUb1NlcShjZWxsKSwgb2xkQ2hhcjogY2VsbC5nZXRDaGFycygpIH1cblx0XHRcdDogeyBpc0xhc3RDaGFyLCBwb3MsIG9sZEF0dHJpYnV0ZXM6ICcnLCBvbGRDaGFyOiAnJyB9O1xuXG5cdFx0cmV0dXJuIG1vdmUgKyBWVC5EZWxldGVDaGFyO1xuXHR9XG5cblx0cm9sbGJhY2soY3Vyc29yOiBDdXJzb3IpIHtcblx0XHRpZiAoIXRoaXMuX2FwcGxpZWRBdCkge1xuXHRcdFx0cmV0dXJuICcnOyAvLyBub3QgYXBwbGllZFxuXHRcdH1cblxuXHRcdGNvbnN0IHsgb2xkQXR0cmlidXRlcywgb2xkQ2hhciwgcG9zIH0gPSB0aGlzLl9hcHBsaWVkQXQ7XG5cdFx0aWYgKCFvbGRDaGFyKSB7XG5cdFx0XHRyZXR1cm4gY3Vyc29yLm1vdmVUbyhwb3MpICsgVlQuRGVsZXRlQ2hhcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gb2xkQXR0cmlidXRlcyArIG9sZENoYXIgKyBjdXJzb3IubW92ZVRvKHBvcykgKyBhdHRyaWJ1dGVzVG9TZXEoY29yZSh0aGlzLl90ZXJtaW5hbCkuX2lucHV0SGFuZGxlci5fY3VyQXR0ckRhdGEpO1xuXHR9XG5cblx0cm9sbEZvcndhcmRzKCkge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdG1hdGNoZXMoaW5wdXQ6IFN0cmluZ1JlYWRlcikge1xuXHRcdGlmICh0aGlzLl9hcHBsaWVkQXQ/LmlzTGFzdENoYXIpIHtcblx0XHRcdGNvbnN0IHIxID0gaW5wdXQuZWF0R3JhZHVhbGx5KGBcXGIke1ZULkNzaX1LYCk7XG5cdFx0XHRpZiAocjEgIT09IE1hdGNoUmVzdWx0LkZhaWx1cmUpIHtcblx0XHRcdFx0cmV0dXJuIHIxO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByMiA9IGlucHV0LmVhdEdyYWR1YWxseShgXFxiIFxcYmApO1xuXHRcdFx0aWYgKHIyICE9PSBNYXRjaFJlc3VsdC5GYWlsdXJlKSB7XG5cdFx0XHRcdHJldHVybiByMjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gTWF0Y2hSZXN1bHQuRmFpbHVyZTtcblx0fVxufVxuXG5jbGFzcyBOZXdsaW5lUHJlZGljdGlvbiBpbXBsZW1lbnRzIElQcmVkaWN0aW9uIHtcblx0cHJvdGVjdGVkIF9wcmV2UG9zaXRpb24/OiBJQ29vcmRpbmF0ZTtcblxuXHRhcHBseShfOiBJQnVmZmVyLCBjdXJzb3I6IEN1cnNvcikge1xuXHRcdHRoaXMuX3ByZXZQb3NpdGlvbiA9IGN1cnNvci5jb29yZGluYXRlO1xuXHRcdGN1cnNvci5tb3ZlKDAsIGN1cnNvci55ICsgMSk7XG5cdFx0cmV0dXJuICdcXHJcXG4nO1xuXHR9XG5cblx0cm9sbGJhY2soY3Vyc29yOiBDdXJzb3IpIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJldlBvc2l0aW9uID8gY3Vyc29yLm1vdmVUbyh0aGlzLl9wcmV2UG9zaXRpb24pIDogJyc7XG5cdH1cblxuXHRyb2xsRm9yd2FyZHMoKSB7XG5cdFx0cmV0dXJuICcnOyAvLyBkb2VzIG5vdCBuZWVkIHRvIHJld3JpdGVcblx0fVxuXG5cdG1hdGNoZXMoaW5wdXQ6IFN0cmluZ1JlYWRlcikge1xuXHRcdHJldHVybiBpbnB1dC5lYXRHcmFkdWFsbHkoJ1xcclxcbicpO1xuXHR9XG59XG5cbi8qKlxuICogUHJlZGljdGlvbiB3aGVuIHRoZSBjdXJzb3IgcmVhY2hlcyB0aGUgZW5kIG9mIHRoZSBsaW5lLiBTaW1pbGFyIHRvIG5ld2xpbmVcbiAqIHByZWRpY3Rpb24sIGJ1dCBzaGVsbHMgaGFuZGxlIGl0IHNsaWdodGx5IGRpZmZlcmVudGx5LlxuICovXG5jbGFzcyBMaW5ld3JhcFByZWRpY3Rpb24gZXh0ZW5kcyBOZXdsaW5lUHJlZGljdGlvbiBpbXBsZW1lbnRzIElQcmVkaWN0aW9uIHtcblx0b3ZlcnJpZGUgYXBwbHkoXzogSUJ1ZmZlciwgY3Vyc29yOiBDdXJzb3IpIHtcblx0XHR0aGlzLl9wcmV2UG9zaXRpb24gPSBjdXJzb3IuY29vcmRpbmF0ZTtcblx0XHRjdXJzb3IubW92ZSgwLCBjdXJzb3IueSArIDEpO1xuXHRcdHJldHVybiAnIFxccic7XG5cdH1cblxuXHRvdmVycmlkZSBtYXRjaGVzKGlucHV0OiBTdHJpbmdSZWFkZXIpIHtcblx0XHQvLyBiYXNoIGFuZCB6c2hlbGwgYWRkIGEgc3BhY2Ugd2hpY2ggd3JhcHMgaW4gdGhlIHRlcm1pbmFsLCB0aGVuIGEgQ1Jcblx0XHRjb25zdCByID0gaW5wdXQuZWF0R3JhZHVhbGx5KCcgXFxyJyk7XG5cdFx0aWYgKHIgIT09IE1hdGNoUmVzdWx0LkZhaWx1cmUpIHtcblx0XHRcdC8vIHpzaGVsbCBhZGRpdGlvbmFsbHkgYWRkcyBhIGNsZWFyIGxpbmUgYWZ0ZXIgd3JhcHBpbmcgdG8gYmUgc2FmZSAtLSBlYXQgaXRcblx0XHRcdGNvbnN0IHIyID0gaW5wdXQuZWF0R3JhZHVhbGx5KFZULkRlbGV0ZVJlc3RPZkxpbmUpO1xuXHRcdFx0cmV0dXJuIHIyID09PSBNYXRjaFJlc3VsdC5CdWZmZXIgPyBNYXRjaFJlc3VsdC5CdWZmZXIgOiByO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbnB1dC5lYXRHcmFkdWFsbHkoJ1xcclxcbicpO1xuXHR9XG59XG5cbmNsYXNzIEN1cnNvck1vdmVQcmVkaWN0aW9uIGltcGxlbWVudHMgSVByZWRpY3Rpb24ge1xuXHRwcml2YXRlIF9hcHBsaWVkPzoge1xuXHRcdHJvbGxGb3J3YXJkOiBzdHJpbmc7XG5cdFx0cHJldlBvc2l0aW9uOiBudW1iZXI7XG5cdFx0cHJldkF0dHJzOiBzdHJpbmc7XG5cdFx0YW1vdW50OiBudW1iZXI7XG5cdH07XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlyZWN0aW9uOiBDdXJzb3JNb3ZlRGlyZWN0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vdmVCeVdvcmRzOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Ftb3VudDogbnVtYmVyLFxuXHQpIHsgfVxuXG5cdGFwcGx5KGJ1ZmZlcjogSUJ1ZmZlciwgY3Vyc29yOiBDdXJzb3IpIHtcblx0XHRjb25zdCBwcmV2UG9zaXRpb24gPSBjdXJzb3IueDtcblx0XHRjb25zdCBjdXJyZW50Q2VsbCA9IGN1cnNvci5nZXRDZWxsKCk7XG5cdFx0Y29uc3QgcHJldkF0dHJzID0gY3VycmVudENlbGwgPyBhdHRyaWJ1dGVzVG9TZXEoY3VycmVudENlbGwpIDogJyc7XG5cblx0XHRjb25zdCB7IF9hbW91bnQ6IGFtb3VudCwgX2RpcmVjdGlvbjogZGlyZWN0aW9uLCBfbW92ZUJ5V29yZHM6IG1vdmVCeVdvcmRzIH0gPSB0aGlzO1xuXHRcdGNvbnN0IGRlbHRhID0gZGlyZWN0aW9uID09PSBDdXJzb3JNb3ZlRGlyZWN0aW9uLkJhY2sgPyAtMSA6IDE7XG5cblx0XHRjb25zdCB0YXJnZXQgPSBjdXJzb3IuY2xvbmUoKTtcblx0XHRpZiAobW92ZUJ5V29yZHMpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYW1vdW50OyBpKyspIHtcblx0XHRcdFx0bW92ZVRvV29yZEJvdW5kYXJ5KGJ1ZmZlciwgdGFyZ2V0LCBkZWx0YSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhcmdldC5zaGlmdChkZWx0YSAqIGFtb3VudCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYXBwbGllZCA9IHtcblx0XHRcdGFtb3VudDogTWF0aC5hYnMoY3Vyc29yLnggLSB0YXJnZXQueCksXG5cdFx0XHRwcmV2UG9zaXRpb24sXG5cdFx0XHRwcmV2QXR0cnMsXG5cdFx0XHRyb2xsRm9yd2FyZDogY3Vyc29yLm1vdmVUbyh0YXJnZXQpLFxuXHRcdH07XG5cblx0XHRyZXR1cm4gdGhpcy5fYXBwbGllZC5yb2xsRm9yd2FyZDtcblx0fVxuXG5cdHJvbGxiYWNrKGN1cnNvcjogQ3Vyc29yKSB7XG5cdFx0aWYgKCF0aGlzLl9hcHBsaWVkKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGN1cnNvci5tb3ZlKHRoaXMuX2FwcGxpZWQucHJldlBvc2l0aW9uLCBjdXJzb3IueSkgKyB0aGlzLl9hcHBsaWVkLnByZXZBdHRycztcblx0fVxuXG5cdHJvbGxGb3J3YXJkcygpIHtcblx0XHRyZXR1cm4gJyc7IC8vIGRvZXMgbm90IG5lZWQgdG8gcmV3cml0ZVxuXHR9XG5cblx0bWF0Y2hlcyhpbnB1dDogU3RyaW5nUmVhZGVyKSB7XG5cdFx0aWYgKCF0aGlzLl9hcHBsaWVkKSB7XG5cdFx0XHRyZXR1cm4gTWF0Y2hSZXN1bHQuRmFpbHVyZTtcblx0XHR9XG5cblx0XHRjb25zdCBkaXJlY3Rpb24gPSB0aGlzLl9kaXJlY3Rpb247XG5cdFx0Y29uc3QgeyBhbW91bnQsIHJvbGxGb3J3YXJkIH0gPSB0aGlzLl9hcHBsaWVkO1xuXG5cblx0XHQvLyBhcmcgY2FuIGJlIG9taXR0ZWQgdG8gbW92ZSBvbmUgY2hhcmFjdGVyLiBXZSBkb24ndCBlYXRHcmFkdWFsbHkoKSBoZXJlXG5cdFx0Ly8gb3IgYmVsb3cgbW92ZXMgdGhhdCBkb24ndCBnbyBhcyBmYXIgYXMgdGhlIGN1cnNvciB3b3VsZCBiZSBidWZmZXJlZFxuXHRcdC8vIGluZGVmaW5pdGVseVxuXHRcdGlmIChpbnB1dC5lYXRTdHIoYCR7VlQuQ3NpfSR7ZGlyZWN0aW9ufWAucmVwZWF0KGFtb3VudCkpKSB7XG5cdFx0XHRyZXR1cm4gTWF0Y2hSZXN1bHQuU3VjY2Vzcztcblx0XHR9XG5cblx0XHQvLyBcXGIgaXMgdGhlIGVxdWl2YWxlbnQgdG8gbW92aW5nIG9uZSBjaGFyYWN0ZXIgYmFja1xuXHRcdGlmIChkaXJlY3Rpb24gPT09IEN1cnNvck1vdmVEaXJlY3Rpb24uQmFjaykge1xuXHRcdFx0aWYgKGlucHV0LmVhdFN0cihgXFxiYC5yZXBlYXQoYW1vdW50KSkpIHtcblx0XHRcdFx0cmV0dXJuIE1hdGNoUmVzdWx0LlN1Y2Nlc3M7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gY2hlY2sgaWYgdGhlIGN1cnNvciBwb3NpdGlvbiBpcyBzZXQgYWJzb2x1dGVseVxuXHRcdGlmIChyb2xsRm9yd2FyZCkge1xuXHRcdFx0Y29uc3QgciA9IGlucHV0LmVhdEdyYWR1YWxseShyb2xsRm9yd2FyZCk7XG5cdFx0XHRpZiAociAhPT0gTWF0Y2hSZXN1bHQuRmFpbHVyZSkge1xuXHRcdFx0XHRyZXR1cm4gcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBjaGVjayBmb3IgYSByZWxhdGl2ZSBtb3ZlIGluIHRoZSBkaXJlY3Rpb25cblx0XHRyZXR1cm4gaW5wdXQuZWF0R3JhZHVhbGx5KGAke1ZULkNzaX0ke2Ftb3VudH0ke2RpcmVjdGlvbn1gKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUHJlZGljdGlvblN0YXRzIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRzOiBbbGF0ZW5jeTogbnVtYmVyLCBjb3JyZWN0OiBib29sZWFuXVtdID0gW107XG5cdHByaXZhdGUgX2luZGV4ID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfYWRkZWRBdFRpbWUgPSBuZXcgV2Vha01hcDxJUHJlZGljdGlvbiwgbnVtYmVyPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGFuZ2VFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25DaGFuZ2UgPSB0aGlzLl9jaGFuZ2VFbWl0dGVyLmV2ZW50O1xuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBwZXJjZW50ICgwLTEpIG9mIHByZWRpY3Rpb25zIHRoYXQgd2VyZSBhY2N1cmF0ZS5cblx0ICovXG5cdGdldCBhY2N1cmFjeSgpIHtcblx0XHRsZXQgY29ycmVjdENvdW50ID0gMDtcblx0XHRmb3IgKGNvbnN0IFssIGNvcnJlY3RdIG9mIHRoaXMuX3N0YXRzKSB7XG5cdFx0XHRpZiAoY29ycmVjdCkge1xuXHRcdFx0XHRjb3JyZWN0Q291bnQrKztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gY29ycmVjdENvdW50IC8gKHRoaXMuX3N0YXRzLmxlbmd0aCB8fCAxKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBudW1iZXIgb2YgcmVjb3JkZWQgc3RhdHMuXG5cdCAqL1xuXHRnZXQgc2FtcGxlU2l6ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdHMubGVuZ3RoO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgbGF0ZW5jeSBzdGF0cyBvZiBzdWNjZXNzZnVsIHByZWRpY3Rpb25zLlxuXHQgKi9cblx0Z2V0IGxhdGVuY3koKSB7XG5cdFx0Y29uc3QgbGF0ZW5jaWVzID0gdGhpcy5fc3RhdHMuZmlsdGVyKChbLCBjb3JyZWN0XSkgPT4gY29ycmVjdCkubWFwKChbc10pID0+IHMpLnNvcnQoKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb3VudDogbGF0ZW5jaWVzLmxlbmd0aCxcblx0XHRcdG1pbjogbGF0ZW5jaWVzWzBdLFxuXHRcdFx0bWVkaWFuOiBsYXRlbmNpZXNbTWF0aC5mbG9vcihsYXRlbmNpZXMubGVuZ3RoIC8gMildLFxuXHRcdFx0bWF4OiBsYXRlbmNpZXNbbGF0ZW5jaWVzLmxlbmd0aCAtIDFdLFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogR2V0cyB0aGUgbWF4aW11bSBvYnNlcnZlZCBsYXRlbmN5LlxuXHQgKi9cblx0Z2V0IG1heExhdGVuY3koKSB7XG5cdFx0bGV0IG1heCA9IC1JbmZpbml0eTtcblx0XHRmb3IgKGNvbnN0IFtsYXRlbmN5LCBjb3JyZWN0XSBvZiB0aGlzLl9zdGF0cykge1xuXHRcdFx0aWYgKGNvcnJlY3QpIHtcblx0XHRcdFx0bWF4ID0gTWF0aC5tYXgobGF0ZW5jeSwgbWF4KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbWF4O1xuXHR9XG5cblx0Y29uc3RydWN0b3IodGltZWxpbmU6IFByZWRpY3Rpb25UaW1lbGluZSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGltZWxpbmUub25QcmVkaWN0aW9uQWRkZWQocCA9PiB0aGlzLl9hZGRlZEF0VGltZS5zZXQocCwgRGF0ZS5ub3coKSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aW1lbGluZS5vblByZWRpY3Rpb25TdWNjZWVkZWQodGhpcy5fcHVzaFN0YXQuYmluZCh0aGlzLCB0cnVlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRpbWVsaW5lLm9uUHJlZGljdGlvbkZhaWxlZCh0aGlzLl9wdXNoU3RhdC5iaW5kKHRoaXMsIGZhbHNlKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcHVzaFN0YXQoY29ycmVjdDogYm9vbGVhbiwgcHJlZGljdGlvbjogSVByZWRpY3Rpb24pIHtcblx0XHRjb25zdCBzdGFydGVkID0gdGhpcy5fYWRkZWRBdFRpbWUuZ2V0KHByZWRpY3Rpb24pITtcblx0XHR0aGlzLl9zdGF0c1t0aGlzLl9pbmRleF0gPSBbRGF0ZS5ub3coKSAtIHN0YXJ0ZWQsIGNvcnJlY3RdO1xuXHRcdHRoaXMuX2luZGV4ID0gKHRoaXMuX2luZGV4ICsgMSkgJSBTdGF0c0NvbnN0YW50cy5TdGF0c0J1ZmZlclNpemU7XG5cdFx0dGhpcy5fY2hhbmdlRW1pdHRlci5maXJlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFByZWRpY3Rpb25UaW1lbGluZSB7XG5cdC8qKlxuXHQgKiBFeHBlY3RlZCBxdWV1ZSBvZiBldmVudHMuIE9ubHkgcHJlZGljdGlvbnMgZm9yIHRoZSBsb3dlc3QgYXJlXG5cdCAqIHdyaXR0ZW4gaW50byB0aGUgdGVybWluYWwuXG5cdCAqL1xuXHRwcml2YXRlIF9leHBlY3RlZDogKHsgZ2VuOiBudW1iZXI7IHA6IElQcmVkaWN0aW9uIH0pW10gPSBbXTtcblxuXHQvKipcblx0ICogQ3VycmVudCBwcmVkaWN0aW9uIGdlbmVyYXRpb24uXG5cdCAqL1xuXHRwcml2YXRlIF9jdXJyZW50R2VuID0gMDtcblxuXHQvKipcblx0ICogQ3VycmVudCBjdXJzb3IgcG9zaXRpb24gLS0ga2VwdCBvdXRzaWRlIHRoZSBidWZmZXIgc2luY2UgaXQgY2FuIGJlIGFoZWFkXG5cdCAqIGlmIHR5cGluZyBzd2lmdGx5LiBUaGUgcG9zaXRpb24gb2YgdGhlIGN1cnNvciB0aGF0IHRoZSB1c2VyIGlzIGN1cnJlbnRseVxuXHQgKiBsb29raW5nIGF0IG9uIHRoZWlyIHNjcmVlbiAob3Igd2lsbCBiZSBsb29raW5nIGF0IGFmdGVyIGFsbCBwZW5kaW5nIHdyaXRlc1xuXHQgKiBhcmUgZmx1c2hlZC4pXG5cdCAqL1xuXHRwcml2YXRlIF9waHlzaWNhbEN1cnNvcjogQ3Vyc29yIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBDdXJzb3IgcG9zaXRpb24gdGFraW5nIGludG8gYWNjb3VudCBhbGwgKHBvc3NpYmx5IG5vdC15ZXQtYXBwbGllZClcblx0ICogcHJlZGljdGlvbnMuIEEgbmV3IHByZWRpY3Rpb24gaW5zZXJ0ZWQsIGlmIGFwcGxpZWQsIHdpbGwgYmUgYXBwbGllZCBhdFxuXHQgKiB0aGUgcG9zaXRpb24gb2YgdGhlIHRlbnRhdGl2ZSBjdXJzb3IuXG5cdCAqL1xuXHRwcml2YXRlIF90ZW5hdGl2ZUN1cnNvcjogQ3Vyc29yIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBQcmV2aW91c2x5IHNlbnQgZGF0YSB0aGF0IHdhcyBidWZmZXJlZCBhbmQgc2hvdWxkIGJlIHByZXBlbmRlZCB0byB0aGVcblx0ICogbmV4dCBpbnB1dC5cblx0ICovXG5cdHByaXZhdGUgX2lucHV0QnVmZmVyPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHByZWRpY3Rpb25zIGFyZSBlY2hvZWQgdG8gdGhlIHRlcm1pbmFsLiBJZiBmYWxzZSwgcHJlZGljdGlvbnNcblx0ICogd2lsbCBzdGlsbCBiZSBjb21wdXRlZCBpbnRlcm5hbGx5IGZvciBsYXRlbmN5IG1ldHJpY3MsIGJ1dCBpbnB1dCB3aWxsXG5cdCAqIG5ldmVyIGJlIGFkanVzdGVkLlxuXHQgKi9cblx0cHJpdmF0ZSBfc2hvd1ByZWRpY3Rpb25zID0gZmFsc2U7XG5cblx0LyoqXG5cdCAqIFRoZSBsYXN0IHN1Y2Nlc3NmdWxseS1tYWRlIHByZWRpY3Rpb24uXG5cdCAqL1xuXHRwcml2YXRlIF9sb29rQmVoaW5kPzogSVByZWRpY3Rpb247XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWRkZWRFbWl0dGVyID0gbmV3IEVtaXR0ZXI8SVByZWRpY3Rpb24+KCk7XG5cdHJlYWRvbmx5IG9uUHJlZGljdGlvbkFkZGVkID0gdGhpcy5fYWRkZWRFbWl0dGVyLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9mYWlsZWRFbWl0dGVyID0gbmV3IEVtaXR0ZXI8SVByZWRpY3Rpb24+KCk7XG5cdHJlYWRvbmx5IG9uUHJlZGljdGlvbkZhaWxlZCA9IHRoaXMuX2ZhaWxlZEVtaXR0ZXIuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N1Y2NlZWRlZEVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxJUHJlZGljdGlvbj4oKTtcblx0cmVhZG9ubHkgb25QcmVkaWN0aW9uU3VjY2VlZGVkID0gdGhpcy5fc3VjY2VlZGVkRW1pdHRlci5ldmVudDtcblxuXHRwcml2YXRlIGdldCBfY3VycmVudEdlbmVyYXRpb25QcmVkaWN0aW9ucygpIHtcblx0XHRyZXR1cm4gdGhpcy5fZXhwZWN0ZWQuZmlsdGVyKCh7IGdlbiB9KSA9PiBnZW4gPT09IHRoaXMuX2V4cGVjdGVkWzBdLmdlbikubWFwKCh7IHAgfSkgPT4gcCk7XG5cdH1cblxuXHRnZXQgaXNTaG93aW5nUHJlZGljdGlvbnMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Nob3dQcmVkaWN0aW9ucztcblx0fVxuXG5cdGdldCBsZW5ndGgoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2V4cGVjdGVkLmxlbmd0aDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHRlcm1pbmFsOiBUZXJtaW5hbCwgcHJpdmF0ZSByZWFkb25seSBfc3R5bGU6IFR5cGVBaGVhZFN0eWxlKSB7IH1cblxuXHRzZXRTaG93UHJlZGljdGlvbnMoc2hvdzogYm9vbGVhbikge1xuXHRcdGlmIChzaG93ID09PSB0aGlzLl9zaG93UHJlZGljdGlvbnMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBjb25zb2xlLmxvZygnc2V0IHByZWRpY3Rpb25zOicsIHNob3cpO1xuXHRcdHRoaXMuX3Nob3dQcmVkaWN0aW9ucyA9IHNob3c7XG5cblx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9nZXRBY3RpdmVCdWZmZXIoKTtcblx0XHRpZiAoIWJ1ZmZlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvQXBwbHkgPSB0aGlzLl9jdXJyZW50R2VuZXJhdGlvblByZWRpY3Rpb25zO1xuXHRcdGlmIChzaG93KSB7XG5cdFx0XHR0aGlzLmNsZWFyQ3Vyc29yKCk7XG5cdFx0XHR0aGlzLl9zdHlsZS5leHBlY3RJbmNvbWluZ1N0eWxlKHRvQXBwbHkucmVkdWNlKChjb3VudCwgcCkgPT4gcC5hZmZlY3RzU3R5bGUgPyBjb3VudCArIDEgOiBjb3VudCwgMCkpO1xuXHRcdFx0dGhpcy50ZXJtaW5hbC53cml0ZSh0b0FwcGx5Lm1hcChwID0+IHAuYXBwbHkoYnVmZmVyLCB0aGlzLnBoeXNpY2FsQ3Vyc29yKGJ1ZmZlcikpKS5qb2luKCcnKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudGVybWluYWwud3JpdGUodG9BcHBseS5yZXZlcnNlKCkubWFwKHAgPT4gcC5yb2xsYmFjayh0aGlzLnBoeXNpY2FsQ3Vyc29yKGJ1ZmZlcikpKS5qb2luKCcnKSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFVuZG9lcyBhbnkgcHJlZGljdGlvbnMgd3JpdHRlbiBhbmQgcmVzZXRzIGV4cGVjdGF0aW9ucy5cblx0ICovXG5cdHVuZG9BbGxQcmVkaWN0aW9ucygpIHtcblx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9nZXRBY3RpdmVCdWZmZXIoKTtcblx0XHRpZiAodGhpcy5fc2hvd1ByZWRpY3Rpb25zICYmIGJ1ZmZlcikge1xuXHRcdFx0dGhpcy50ZXJtaW5hbC53cml0ZSh0aGlzLl9jdXJyZW50R2VuZXJhdGlvblByZWRpY3Rpb25zLnJldmVyc2UoKVxuXHRcdFx0XHQubWFwKHAgPT4gcC5yb2xsYmFjayh0aGlzLnBoeXNpY2FsQ3Vyc29yKGJ1ZmZlcikpKS5qb2luKCcnKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZXhwZWN0ZWQgPSBbXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTaG91bGQgYmUgY2FsbGVkIHdoZW4gaW5wdXQgaXMgaW5jb21pbmcgdG8gdGhlIHRlbXJpbmFsLlxuXHQgKi9cblx0YmVmb3JlU2VydmVySW5wdXQoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgb3JpZ2luYWxJbnB1dCA9IGlucHV0O1xuXHRcdGlmICh0aGlzLl9pbnB1dEJ1ZmZlcikge1xuXHRcdFx0aW5wdXQgPSB0aGlzLl9pbnB1dEJ1ZmZlciArIGlucHV0O1xuXHRcdFx0dGhpcy5faW5wdXRCdWZmZXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9leHBlY3RlZC5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2NsZWFyUHJlZGljdGlvblN0YXRlKCk7XG5cdFx0XHRyZXR1cm4gaW5wdXQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5fZ2V0QWN0aXZlQnVmZmVyKCk7XG5cdFx0aWYgKCFidWZmZXIpIHtcblx0XHRcdHRoaXMuX2NsZWFyUHJlZGljdGlvblN0YXRlKCk7XG5cdFx0XHRyZXR1cm4gaW5wdXQ7XG5cdFx0fVxuXG5cdFx0bGV0IG91dHB1dCA9ICcnO1xuXG5cdFx0Y29uc3QgcmVhZGVyID0gbmV3IFN0cmluZ1JlYWRlcihpbnB1dCk7XG5cdFx0Y29uc3Qgc3RhcnRpbmdHZW4gPSB0aGlzLl9leHBlY3RlZFswXS5nZW47XG5cdFx0Y29uc3QgZW1pdFByZWRpY3Rpb25PbWl0dGVkID0gKCkgPT4ge1xuXHRcdFx0Y29uc3Qgb21pdCA9IHJlYWRlci5lYXRSZShQUkVESUNUSU9OX09NSVRfUkUpO1xuXHRcdFx0aWYgKG9taXQpIHtcblx0XHRcdFx0b3V0cHV0ICs9IG9taXRbMF07XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFJlYWRMb29wOiB3aGlsZSAodGhpcy5fZXhwZWN0ZWQubGVuZ3RoICYmIHJlYWRlci5yZW1haW5pbmcgPiAwKSB7XG5cdFx0XHRlbWl0UHJlZGljdGlvbk9taXR0ZWQoKTtcblxuXHRcdFx0Y29uc3QgeyBwOiBwcmVkaWN0aW9uLCBnZW4gfSA9IHRoaXMuX2V4cGVjdGVkWzBdO1xuXHRcdFx0Y29uc3QgY3Vyc29yID0gdGhpcy5waHlzaWNhbEN1cnNvcihidWZmZXIpO1xuXHRcdFx0Y29uc3QgYmVmb3JlVGVzdFJlYWRlckluZGV4ID0gcmVhZGVyLmluZGV4O1xuXHRcdFx0c3dpdGNoIChwcmVkaWN0aW9uLm1hdGNoZXMocmVhZGVyLCB0aGlzLl9sb29rQmVoaW5kKSkge1xuXHRcdFx0XHRjYXNlIE1hdGNoUmVzdWx0LlN1Y2Nlc3M6IHtcblx0XHRcdFx0XHQvLyBpZiB0aGUgaW5wdXQgY2hhcmFjdGVyIG1hdGNoZXMgd2hhdCB0aGUgbmV4dCBwcmVkaWN0aW9uIGV4cGVjdGVkLCB1bmRvXG5cdFx0XHRcdFx0Ly8gdGhlIHByZWRpY3Rpb24gYW5kIHdyaXRlIHRoZSByZWFsIGNoYXJhY3RlciBvdXQuXG5cdFx0XHRcdFx0Y29uc3QgZWF0ZW4gPSBpbnB1dC5zbGljZShiZWZvcmVUZXN0UmVhZGVySW5kZXgsIHJlYWRlci5pbmRleCk7XG5cdFx0XHRcdFx0aWYgKGdlbiA9PT0gc3RhcnRpbmdHZW4pIHtcblx0XHRcdFx0XHRcdG91dHB1dCArPSBwcmVkaWN0aW9uLnJvbGxGb3J3YXJkcz8uKGN1cnNvciwgZWF0ZW4pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRwcmVkaWN0aW9uLmFwcGx5KGJ1ZmZlciwgdGhpcy5waHlzaWNhbEN1cnNvcihidWZmZXIpKTsgLy8gbW92ZSBjdXJzb3IgZm9yIGFkZGl0aW9uYWwgYXBwbHlcblx0XHRcdFx0XHRcdG91dHB1dCArPSBlYXRlbjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl9zdWNjZWVkZWRFbWl0dGVyLmZpcmUocHJlZGljdGlvbik7XG5cdFx0XHRcdFx0dGhpcy5fbG9va0JlaGluZCA9IHByZWRpY3Rpb247XG5cdFx0XHRcdFx0dGhpcy5fZXhwZWN0ZWQuc2hpZnQoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIE1hdGNoUmVzdWx0LkJ1ZmZlcjpcblx0XHRcdFx0XHQvLyBvbiBhIGJ1ZmZlciwgc3RvcmUgdGhlIHJlbWFpbmluZyBkYXRhIGFuZCBjb21wbGV0ZWx5IHJlYWQgZGF0YVxuXHRcdFx0XHRcdC8vIHRvIGJlIG91dHB1dCBhcyBub3JtYWwuXG5cdFx0XHRcdFx0dGhpcy5faW5wdXRCdWZmZXIgPSBpbnB1dC5zbGljZShiZWZvcmVUZXN0UmVhZGVySW5kZXgpO1xuXHRcdFx0XHRcdHJlYWRlci5pbmRleCA9IGlucHV0Lmxlbmd0aDtcblx0XHRcdFx0XHRicmVhayBSZWFkTG9vcDtcblx0XHRcdFx0Y2FzZSBNYXRjaFJlc3VsdC5GYWlsdXJlOiB7XG5cdFx0XHRcdFx0Ly8gb24gYSBmYWlsdXJlLCByb2xsIGJhY2sgYWxsIHJlbWFpbmluZyBpdGVtcyBpbiB0aGlzIGdlbmVyYXRpb25cblx0XHRcdFx0XHQvLyBhbmQgY2xlYXIgcHJlZGljdGlvbnMsIHNpbmNlIHRoZXkgYXJlIG5vIGxvbmdlciB2YWxpZFxuXHRcdFx0XHRcdGNvbnN0IHJvbGxiYWNrID0gdGhpcy5fZXhwZWN0ZWQuZmlsdGVyKHAgPT4gcC5nZW4gPT09IHN0YXJ0aW5nR2VuKS5yZXZlcnNlKCk7XG5cdFx0XHRcdFx0b3V0cHV0ICs9IHJvbGxiYWNrLm1hcCgoeyBwIH0pID0+IHAucm9sbGJhY2sodGhpcy5waHlzaWNhbEN1cnNvcihidWZmZXIpKSkuam9pbignJyk7XG5cdFx0XHRcdFx0aWYgKHJvbGxiYWNrLnNvbWUociA9PiByLnAuYWZmZWN0c1N0eWxlKSkge1xuXHRcdFx0XHRcdFx0Ly8gcmVhZGluZyB0aGUgY3VycmVudCBzdHlsZSBzaG91bGQgZ2VuZXJhbGx5IGJlIHNhZmUsIHNpbmNlIHByZWRpY3Rpb25zXG5cdFx0XHRcdFx0XHQvLyBhbHdheXMgcmVzdG9yZSB0aGUgc3R5bGUgaWYgdGhleSBtb2RpZnkgaXQuXG5cdFx0XHRcdFx0XHRvdXRwdXQgKz0gYXR0cmlidXRlc1RvU2VxKGNvcmUodGhpcy50ZXJtaW5hbCkuX2lucHV0SGFuZGxlci5fY3VyQXR0ckRhdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9jbGVhclByZWRpY3Rpb25TdGF0ZSgpO1xuXHRcdFx0XHRcdHRoaXMuX2ZhaWxlZEVtaXR0ZXIuZmlyZShwcmVkaWN0aW9uKTtcblx0XHRcdFx0XHRicmVhayBSZWFkTG9vcDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGVtaXRQcmVkaWN0aW9uT21pdHRlZCgpO1xuXG5cdFx0Ly8gRXh0cmEgZGF0YSAobGlrZSB0aGUgcmVzdWx0IG9mIHJ1bm5pbmcgYSBjb21tYW5kKSBzaG91bGQgY2F1c2UgdXMgdG9cblx0XHQvLyByZXNldCB0aGUgY3Vyc29yXG5cdFx0aWYgKCFyZWFkZXIuZW9mKSB7XG5cdFx0XHRvdXRwdXQgKz0gcmVhZGVyLnJlc3Q7XG5cdFx0XHR0aGlzLl9jbGVhclByZWRpY3Rpb25TdGF0ZSgpO1xuXHRcdH1cblxuXHRcdC8vIElmIHdlIHBhc3NlZCBhIGdlbmVyYXRpb24gYm91bmRhcnksIGFwcGx5IHRoZSBjdXJyZW50IGdlbmVyYXRpb24ncyBwcmVkaWN0aW9uc1xuXHRcdGlmICh0aGlzLl9leHBlY3RlZC5sZW5ndGggJiYgc3RhcnRpbmdHZW4gIT09IHRoaXMuX2V4cGVjdGVkWzBdLmdlbikge1xuXHRcdFx0Zm9yIChjb25zdCB7IHAsIGdlbiB9IG9mIHRoaXMuX2V4cGVjdGVkKSB7XG5cdFx0XHRcdGlmIChnZW4gIT09IHRoaXMuX2V4cGVjdGVkWzBdLmdlbikge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChwLmFmZmVjdHNTdHlsZSkge1xuXHRcdFx0XHRcdHRoaXMuX3N0eWxlLmV4cGVjdEluY29taW5nU3R5bGUoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG91dHB1dCArPSBwLmFwcGx5KGJ1ZmZlciwgdGhpcy5waHlzaWNhbEN1cnNvcihidWZmZXIpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX3Nob3dQcmVkaWN0aW9ucykge1xuXHRcdFx0cmV0dXJuIG9yaWdpbmFsSW5wdXQ7XG5cdFx0fVxuXG5cdFx0aWYgKG91dHB1dC5sZW5ndGggPT09IDAgfHwgb3V0cHV0ID09PSBpbnB1dCkge1xuXHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcGh5c2ljYWxDdXJzb3IpIHtcblx0XHRcdG91dHB1dCArPSB0aGlzLl9waHlzaWNhbEN1cnNvci5tb3ZlSW5zdHJ1Y3Rpb24oKTtcblx0XHR9XG5cblx0XHQvLyBwcmV2ZW50IGN1cnNvciBmbGlja2VyaW5nIHdoaWxlIHR5cGluZ1xuXHRcdG91dHB1dCA9IFZULkhpZGVDdXJzb3IgKyBvdXRwdXQgKyBWVC5TaG93Q3Vyc29yO1xuXG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGVhcnMgYW55IGV4cGVjdGVkIHByZWRpY3Rpb25zIGFuZCBzdG9yZWQgc3RhdGUuIFNob3VsZCBiZSBjYWxsZWQgd2hlblxuXHQgKiB0aGUgcHR5IGdpdmVzIHVzIHNvbWV0aGluZyB3ZSBkb24ndCByZWNvZ25pemUuXG5cdCAqL1xuXHRwcml2YXRlIF9jbGVhclByZWRpY3Rpb25TdGF0ZSgpIHtcblx0XHR0aGlzLl9leHBlY3RlZCA9IFtdO1xuXHRcdHRoaXMuY2xlYXJDdXJzb3IoKTtcblx0XHR0aGlzLl9sb29rQmVoaW5kID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGVuZHMgYSB0eXBlYWhlYWQgcHJlZGljdGlvbi5cblx0ICovXG5cdGFkZFByZWRpY3Rpb24oYnVmZmVyOiBJQnVmZmVyLCBwcmVkaWN0aW9uOiBJUHJlZGljdGlvbikge1xuXHRcdHRoaXMuX2V4cGVjdGVkLnB1c2goeyBnZW46IHRoaXMuX2N1cnJlbnRHZW4sIHA6IHByZWRpY3Rpb24gfSk7XG5cdFx0dGhpcy5fYWRkZWRFbWl0dGVyLmZpcmUocHJlZGljdGlvbik7XG5cblx0XHRpZiAodGhpcy5fY3VycmVudEdlbiAhPT0gdGhpcy5fZXhwZWN0ZWRbMF0uZ2VuKSB7XG5cdFx0XHRwcmVkaWN0aW9uLmFwcGx5KGJ1ZmZlciwgdGhpcy50ZW50YXRpdmVDdXJzb3IoYnVmZmVyKSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dCA9IHByZWRpY3Rpb24uYXBwbHkoYnVmZmVyLCB0aGlzLnBoeXNpY2FsQ3Vyc29yKGJ1ZmZlcikpO1xuXHRcdHRoaXMuX3RlbmF0aXZlQ3Vyc29yID0gdW5kZWZpbmVkOyAvLyBuZXh0IHJlYWQgd2lsbCBnZXQgb3IgY2xvbmUgdGhlIHBoeXNpY2FsIGN1cnNvclxuXG5cdFx0aWYgKHRoaXMuX3Nob3dQcmVkaWN0aW9ucyAmJiB0ZXh0KSB7XG5cdFx0XHRpZiAocHJlZGljdGlvbi5hZmZlY3RzU3R5bGUpIHtcblx0XHRcdFx0dGhpcy5fc3R5bGUuZXhwZWN0SW5jb21pbmdTdHlsZSgpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gY29uc29sZS5sb2coJ3ByZWRpY3Q6JywgSlNPTi5zdHJpbmdpZnkodGV4dCkpO1xuXHRcdFx0dGhpcy50ZXJtaW5hbC53cml0ZSh0ZXh0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBlbmRzIGEgcHJlZGljdGlvbiBmb2xsb3dlZCBieSBhIGJvdW5kYXJ5LiBUaGUgcHJlZGljdGlvbnMgYXBwbGllZFxuXHQgKiBhZnRlciB0aGlzIG9uZSB3aWxsIG9ubHkgYmUgZGlzcGxheWVkIGFmdGVyIHRoZSBnaXZlIHByZWRpY3Rpb24gbWF0Y2hlc1xuXHQgKiBwdHkgb3V0cHV0L1xuXHQgKi9cblx0YWRkQm91bmRhcnkoKTogdm9pZDtcblx0YWRkQm91bmRhcnkoYnVmZmVyOiBJQnVmZmVyLCBwcmVkaWN0aW9uOiBJUHJlZGljdGlvbik6IGJvb2xlYW47XG5cdGFkZEJvdW5kYXJ5KGJ1ZmZlcj86IElCdWZmZXIsIHByZWRpY3Rpb24/OiBJUHJlZGljdGlvbikge1xuXHRcdGxldCBhcHBsaWVkID0gZmFsc2U7XG5cdFx0aWYgKGJ1ZmZlciAmJiBwcmVkaWN0aW9uKSB7XG5cdFx0XHQvLyBXZSBhcHBseSB0aGUgcHJlZGljdGlvbiBzbyB0aGF0IGl0J3MgbWF0Y2hlZCBhZ2FpbnN0LCBidXQgd3JhcHBlZFxuXHRcdFx0Ly8gaW4gYSB0ZW50YXRpdmVib3VuZGFyeSBzbyB0aGF0IGl0IGRvZXNuJ3QgYWZmZWN0IHRoZSBwaHlzaWNhbCBjdXJzb3IuXG5cdFx0XHQvLyBUaGVuIHdlIGFwcGx5IGl0IHNwZWNpZmljYWxseSB0byB0aGUgdGVudGF0aXZlIGN1cnNvci5cblx0XHRcdGFwcGxpZWQgPSB0aGlzLmFkZFByZWRpY3Rpb24oYnVmZmVyLCBuZXcgVGVudGF0aXZlQm91bmRhcnkocHJlZGljdGlvbikpO1xuXHRcdFx0cHJlZGljdGlvbi5hcHBseShidWZmZXIsIHRoaXMudGVudGF0aXZlQ3Vyc29yKGJ1ZmZlcikpO1xuXHRcdH1cblx0XHR0aGlzLl9jdXJyZW50R2VuKys7XG5cdFx0cmV0dXJuIGFwcGxpZWQ7XG5cdH1cblxuXHQvKipcblx0ICogUGVla3MgdGhlIGxhc3QgcHJlZGljdGlvbiB3cml0dGVuLlxuXHQgKi9cblx0cGVla0VuZCgpOiBJUHJlZGljdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2V4cGVjdGVkW3RoaXMuX2V4cGVjdGVkLmxlbmd0aCAtIDFdPy5wO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBlZWtzIHRoZSBmaXJzdCBwZW5kaW5nIHByZWRpY3Rpb24uXG5cdCAqL1xuXHRwZWVrU3RhcnQoKTogSVByZWRpY3Rpb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9leHBlY3RlZFswXT8ucDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDdXJyZW50IHBvc2l0aW9uIG9mIHRoZSBjdXJzb3IgaW4gdGhlIHRlcm1pbmFsLlxuXHQgKi9cblx0cGh5c2ljYWxDdXJzb3IoYnVmZmVyOiBJQnVmZmVyKSB7XG5cdFx0aWYgKCF0aGlzLl9waHlzaWNhbEN1cnNvcikge1xuXHRcdFx0aWYgKHRoaXMuX3Nob3dQcmVkaWN0aW9ucykge1xuXHRcdFx0XHRmbHVzaE91dHB1dCh0aGlzLnRlcm1pbmFsKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3BoeXNpY2FsQ3Vyc29yID0gbmV3IEN1cnNvcih0aGlzLnRlcm1pbmFsLnJvd3MsIHRoaXMudGVybWluYWwuY29scywgYnVmZmVyKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcGh5c2ljYWxDdXJzb3I7XG5cdH1cblxuXHQvKipcblx0ICogQ3Vyc29yIHBvc2l0aW9uIGlmIGFsbCBwcmVkaWN0aW9ucyBhbmQgYm91bmRhcmllcyB0aGF0IGhhdmUgYmVlbiBpbnNlcnRlZFxuXHQgKiBzbyBmYXIgdHVybiBvdXQgdG8gYmUgc3VjY2Vzc2Z1bGx5IHByZWRpY3RlZC5cblx0ICovXG5cdHRlbnRhdGl2ZUN1cnNvcihidWZmZXI6IElCdWZmZXIpIHtcblx0XHRpZiAoIXRoaXMuX3RlbmF0aXZlQ3Vyc29yKSB7XG5cdFx0XHR0aGlzLl90ZW5hdGl2ZUN1cnNvciA9IHRoaXMucGh5c2ljYWxDdXJzb3IoYnVmZmVyKS5jbG9uZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl90ZW5hdGl2ZUN1cnNvcjtcblx0fVxuXG5cdGNsZWFyQ3Vyc29yKCkge1xuXHRcdHRoaXMuX3BoeXNpY2FsQ3Vyc29yID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3RlbmF0aXZlQ3Vyc29yID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QWN0aXZlQnVmZmVyKCkge1xuXHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMudGVybWluYWwuYnVmZmVyLmFjdGl2ZTtcblx0XHRyZXR1cm4gYnVmZmVyLnR5cGUgPT09ICdub3JtYWwnID8gYnVmZmVyIDogdW5kZWZpbmVkO1xuXHR9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgZXNjYXBlIHNlcXVlbmNlIGFyZ3MgdG8gcmVzdG9yZSBzdGF0ZS9hcHBlYXJhbmNlIGluIHRoZSBjZWxsLlxuICovXG5jb25zdCBhdHRyaWJ1dGVzVG9BcmdzID0gKGNlbGw6IFh0ZXJtQXR0cmlidXRlcykgPT4ge1xuXHRpZiAoY2VsbC5pc0F0dHJpYnV0ZURlZmF1bHQoKSkgeyByZXR1cm4gWzBdOyB9XG5cblx0Y29uc3QgYXJncyA9IFtdO1xuXHRpZiAoY2VsbC5pc0JvbGQoKSkgeyBhcmdzLnB1c2goMSk7IH1cblx0aWYgKGNlbGwuaXNEaW0oKSkgeyBhcmdzLnB1c2goMik7IH1cblx0aWYgKGNlbGwuaXNJdGFsaWMoKSkgeyBhcmdzLnB1c2goMyk7IH1cblx0aWYgKGNlbGwuaXNVbmRlcmxpbmUoKSkgeyBhcmdzLnB1c2goNCk7IH1cblx0aWYgKGNlbGwuaXNCbGluaygpKSB7IGFyZ3MucHVzaCg1KTsgfVxuXHRpZiAoY2VsbC5pc0ludmVyc2UoKSkgeyBhcmdzLnB1c2goNyk7IH1cblx0aWYgKGNlbGwuaXNJbnZpc2libGUoKSkgeyBhcmdzLnB1c2goOCk7IH1cblxuXHRpZiAoY2VsbC5pc0ZnUkdCKCkpIHsgYXJncy5wdXNoKDM4LCAyLCBjZWxsLmdldEZnQ29sb3IoKSA+Pj4gMjQsIChjZWxsLmdldEZnQ29sb3IoKSA+Pj4gMTYpICYgMHhGRiwgY2VsbC5nZXRGZ0NvbG9yKCkgJiAweEZGKTsgfVxuXHRpZiAoY2VsbC5pc0ZnUGFsZXR0ZSgpKSB7IGFyZ3MucHVzaCgzOCwgNSwgY2VsbC5nZXRGZ0NvbG9yKCkpOyB9XG5cdGlmIChjZWxsLmlzRmdEZWZhdWx0KCkpIHsgYXJncy5wdXNoKDM5KTsgfVxuXG5cdGlmIChjZWxsLmlzQmdSR0IoKSkgeyBhcmdzLnB1c2goNDgsIDIsIGNlbGwuZ2V0QmdDb2xvcigpID4+PiAyNCwgKGNlbGwuZ2V0QmdDb2xvcigpID4+PiAxNikgJiAweEZGLCBjZWxsLmdldEJnQ29sb3IoKSAmIDB4RkYpOyB9XG5cdGlmIChjZWxsLmlzQmdQYWxldHRlKCkpIHsgYXJncy5wdXNoKDQ4LCA1LCBjZWxsLmdldEJnQ29sb3IoKSk7IH1cblx0aWYgKGNlbGwuaXNCZ0RlZmF1bHQoKSkgeyBhcmdzLnB1c2goNDkpOyB9XG5cblx0cmV0dXJuIGFyZ3M7XG59O1xuXG4vKipcbiAqIEdldHMgdGhlIGVzY2FwZSBzZXF1ZW5jZSB0byByZXN0b3JlIHN0YXRlL2FwcGVhcmFuY2UgaW4gdGhlIGNlbGwuXG4gKi9cbmNvbnN0IGF0dHJpYnV0ZXNUb1NlcSA9IChjZWxsOiBYdGVybUF0dHJpYnV0ZXMpID0+IGAke1ZULkNzaX0ke2F0dHJpYnV0ZXNUb0FyZ3MoY2VsbCkuam9pbignOycpfW1gO1xuXG5jb25zdCBhcnJheUhhc1ByZWZpeEF0ID0gPFQ+KGE6IFJlYWRvbmx5QXJyYXk8VD4sIGFpOiBudW1iZXIsIGI6IFJlYWRvbmx5QXJyYXk8VD4pID0+IHtcblx0aWYgKGEubGVuZ3RoIC0gYWkgPiBiLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZvciAobGV0IGJpID0gMDsgYmkgPCBiLmxlbmd0aDsgYmkrKywgYWkrKykge1xuXHRcdGlmIChiW2FpXSAhPT0gYVthaV0pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn07XG5cbi8qKlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20veHRlcm1qcy94dGVybS5qcy9ibG9iLzA2NWViMTNhOWQzMTQ1YmVhNjg3MjM5NjgwZWM5Njk2ZDkxMTJiOGUvc3JjL2NvbW1vbi9JbnB1dEhhbmRsZXIudHMjTDIxMjdcbiAqL1xuY29uc3QgZ2V0Q29sb3JXaWR0aCA9IChwYXJhbXM6IChudW1iZXIgfCBudW1iZXJbXSlbXSwgcG9zOiBudW1iZXIpID0+IHtcblx0Y29uc3QgYWNjdSA9IFswLCAwLCAtMSwgMCwgMCwgMF07XG5cdGxldCBjU3BhY2UgPSAwO1xuXHRsZXQgYWR2YW5jZSA9IDA7XG5cblx0ZG8ge1xuXHRcdGNvbnN0IHYgPSBwYXJhbXNbcG9zICsgYWR2YW5jZV07XG5cdFx0YWNjdVthZHZhbmNlICsgY1NwYWNlXSA9IHR5cGVvZiB2ID09PSAnbnVtYmVyJyA/IHYgOiB2WzBdO1xuXHRcdGlmICh0eXBlb2YgdiAhPT0gJ251bWJlcicpIHtcblx0XHRcdGxldCBpID0gMDtcblx0XHRcdGRvIHtcblx0XHRcdFx0aWYgKGFjY3VbMV0gPT09IDUpIHtcblx0XHRcdFx0XHRjU3BhY2UgPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjY3VbYWR2YW5jZSArIGkgKyAxICsgY1NwYWNlXSA9IHZbaV07XG5cdFx0XHR9IHdoaWxlICgrK2kgPCB2Lmxlbmd0aCAmJiBpICsgYWR2YW5jZSArIDEgKyBjU3BhY2UgPCBhY2N1Lmxlbmd0aCk7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0Ly8gZXhpdCBlYXJseSBpZiBjYW4gZGVjaWRlIGNvbG9yIG1vZGUgd2l0aCBzZW1pY29sb25zXG5cdFx0aWYgKChhY2N1WzFdID09PSA1ICYmIGFkdmFuY2UgKyBjU3BhY2UgPj0gMilcblx0XHRcdHx8IChhY2N1WzFdID09PSAyICYmIGFkdmFuY2UgKyBjU3BhY2UgPj0gNSkpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHQvLyBvZmZzZXQgY29sb3JTcGFjZSBzbG90IGZvciBzZW1pY29sb24gbW9kZVxuXHRcdGlmIChhY2N1WzFdKSB7XG5cdFx0XHRjU3BhY2UgPSAxO1xuXHRcdH1cblx0fSB3aGlsZSAoKythZHZhbmNlICsgcG9zIDwgcGFyYW1zLmxlbmd0aCAmJiBhZHZhbmNlICsgY1NwYWNlIDwgYWNjdS5sZW5ndGgpO1xuXG5cdHJldHVybiBhZHZhbmNlO1xufTtcblxuY2xhc3MgVHlwZUFoZWFkU3R5bGUgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgc3RhdGljIF9jb21waWxlQXJncyhhcmdzOiBSZWFkb25seUFycmF5PG51bWJlcj4pIHtcblx0XHRyZXR1cm4gYCR7VlQuQ3NpfSR7YXJncy5qb2luKCc7Jyl9bWA7XG5cdH1cblxuXHQvKipcblx0ICogTnVtYmVyIG9mIHR5cGVhaGVhZCBzdHlsZSBhcmd1bWVudHMgd2UgZXhwZWN0IHRvIHJlYWQuIElmIHRoaXMgaXMgMCBhbmRcblx0ICogd2Ugc2VlIGEgc3R5bGUgY29taW5nIGluLCB3ZSBrbm93IHRoYXQgdGhlIFBUWSBhY3R1YWxseSB3YW50ZWQgdG8gdXBkYXRlLlxuXHQgKi9cblx0cHJpdmF0ZSBfZXhwZWN0ZWRJbmNvbWluZ1N0eWxlcyA9IDA7XG5cdHByaXZhdGUgX2FwcGx5QXJncyE6IFJlYWRvbmx5QXJyYXk8bnVtYmVyPjtcblx0cHJpdmF0ZSBfb3JpZ2luYWxVbmRvQXJncyE6IFJlYWRvbmx5QXJyYXk8bnVtYmVyPjtcblx0cHJpdmF0ZSBfdW5kb0FyZ3MhOiBSZWFkb25seUFycmF5PG51bWJlcj47XG5cblx0YXBwbHkhOiBzdHJpbmc7XG5cdHVuZG8hOiBzdHJpbmc7XG5cdHByaXZhdGUgX2NzaUhhbmRsZXI/OiBJRGlzcG9zYWJsZTtcblxuXHRjb25zdHJ1Y3Rvcih2YWx1ZTogSVRlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvblsnbG9jYWxFY2hvU3R5bGUnXSwgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWw6IFRlcm1pbmFsKSB7XG5cdFx0dGhpcy5vblVwZGF0ZSh2YWx1ZSk7XG5cdH1cblxuXHQvKipcblx0ICogU2lnbmFscyB0aGF0IGEgc3R5bGUgd2FzIHdyaXR0ZW4gdG8gdGhlIHRlcm1pbmFsIGFuZCB3ZSBzaG91bGQgd2F0Y2hcblx0ICogZm9yIGl0IGNvbWluZyBpbi5cblx0ICovXG5cdGV4cGVjdEluY29taW5nU3R5bGUobiA9IDEpIHtcblx0XHR0aGlzLl9leHBlY3RlZEluY29taW5nU3R5bGVzICs9IG4gKiAyO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyB0cmFja2luZyBmb3IgQ1NJIGNoYW5nZXMgaW4gdGhlIHRlcm1pbmFsLlxuXHQgKi9cblx0c3RhcnRUcmFja2luZygpIHtcblx0XHR0aGlzLl9leHBlY3RlZEluY29taW5nU3R5bGVzID0gMDtcblx0XHR0aGlzLl9vbkRpZFdyaXRlU0dSKGF0dHJpYnV0ZXNUb0FyZ3MoY29yZSh0aGlzLl90ZXJtaW5hbCkuX2lucHV0SGFuZGxlci5fY3VyQXR0ckRhdGEpKTtcblx0XHR0aGlzLl9jc2lIYW5kbGVyID0gdGhpcy5fdGVybWluYWwucGFyc2VyLnJlZ2lzdGVyQ3NpSGFuZGxlcih7IGZpbmFsOiAnbScgfSwgYXJncyA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZFdyaXRlU0dSKGFyZ3MpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN0b3BzIHRyYWNraW5nIHRlcm1pbmFsIENTSSBjaGFuZ2VzLlxuXHQgKi9cblx0QGRlYm91bmNlKDIwMDApXG5cdGRlYm91bmNlU3RvcFRyYWNraW5nKCkge1xuXHRcdHRoaXMuX3N0b3BUcmFja2luZygpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX3N0b3BUcmFja2luZygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RvcFRyYWNraW5nKCkge1xuXHRcdHRoaXMuX2NzaUhhbmRsZXI/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9jc2lIYW5kbGVyID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25EaWRXcml0ZVNHUihhcmdzOiAobnVtYmVyIHwgbnVtYmVyW10pW10pIHtcblx0XHRjb25zdCBvcmlnaW5hbFVuZG8gPSB0aGlzLl91bmRvQXJncztcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOykge1xuXHRcdFx0Y29uc3QgcHggPSBhcmdzW2ldO1xuXHRcdFx0Y29uc3QgcCA9IHR5cGVvZiBweCA9PT0gJ251bWJlcicgPyBweCA6IHB4WzBdO1xuXG5cdFx0XHRpZiAodGhpcy5fZXhwZWN0ZWRJbmNvbWluZ1N0eWxlcykge1xuXHRcdFx0XHRpZiAoYXJyYXlIYXNQcmVmaXhBdChhcmdzLCBpLCB0aGlzLl91bmRvQXJncykpIHtcblx0XHRcdFx0XHR0aGlzLl9leHBlY3RlZEluY29taW5nU3R5bGVzLS07XG5cdFx0XHRcdFx0aSArPSB0aGlzLl91bmRvQXJncy5sZW5ndGg7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGFycmF5SGFzUHJlZml4QXQoYXJncywgaSwgdGhpcy5fYXBwbHlBcmdzKSkge1xuXHRcdFx0XHRcdHRoaXMuX2V4cGVjdGVkSW5jb21pbmdTdHlsZXMtLTtcblx0XHRcdFx0XHRpICs9IHRoaXMuX2FwcGx5QXJncy5sZW5ndGg7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgd2lkdGggPSBwID09PSAzOCB8fCBwID09PSA0OCB8fCBwID09PSA1OCA/IGdldENvbG9yV2lkdGgoYXJncywgaSkgOiAxO1xuXHRcdFx0c3dpdGNoICh0aGlzLl9hcHBseUFyZ3NbMF0pIHtcblx0XHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRcdGlmIChwID09PSAyKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl91bmRvQXJncyA9IFsyMiwgMl07XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChwID09PSAyMiB8fCBwID09PSAwKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl91bmRvQXJncyA9IFsyMl07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIDI6XG5cdFx0XHRcdFx0aWYgKHAgPT09IDEpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3VuZG9BcmdzID0gWzIyLCAxXTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHAgPT09IDIyIHx8IHAgPT09IDApIHtcblx0XHRcdFx0XHRcdHRoaXMuX3VuZG9BcmdzID0gWzIyXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgMzg6XG5cdFx0XHRcdFx0aWYgKHAgPT09IDAgfHwgcCA9PT0gMzkgfHwgcCA9PT0gMTAwKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl91bmRvQXJncyA9IFszOV07XG5cdFx0XHRcdFx0fSBlbHNlIGlmICgocCA+PSAzMCAmJiBwIDw9IDM4KSB8fCAocCA+PSA5MCAmJiBwIDw9IDk3KSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdW5kb0FyZ3MgPSBhcmdzLnNsaWNlKGksIGkgKyB3aWR0aCkgYXMgbnVtYmVyW107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdGlmIChwID09PSB0aGlzLl9hcHBseUFyZ3NbMF0pIHtcblx0XHRcdFx0XHRcdHRoaXMuX3VuZG9BcmdzID0gdGhpcy5fYXBwbHlBcmdzO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAocCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdW5kb0FyZ3MgPSB0aGlzLl9vcmlnaW5hbFVuZG9BcmdzO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0Ly8gbm8tb3Bcblx0XHRcdH1cblxuXHRcdFx0aSArPSB3aWR0aDtcblx0XHR9XG5cblx0XHRpZiAob3JpZ2luYWxVbmRvICE9PSB0aGlzLl91bmRvQXJncykge1xuXHRcdFx0dGhpcy51bmRvID0gVHlwZUFoZWFkU3R5bGUuX2NvbXBpbGVBcmdzKHRoaXMuX3VuZG9BcmdzKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgY3VycmVudCB0eXBlYWhlYWQgc3R5bGUuXG5cdCAqL1xuXHRvblVwZGF0ZShzdHlsZTogSVRlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvblsnbG9jYWxFY2hvU3R5bGUnXSkge1xuXHRcdGNvbnN0IHsgYXBwbHlBcmdzLCB1bmRvQXJncyB9ID0gdGhpcy5fZ2V0QXJncyhzdHlsZSk7XG5cdFx0dGhpcy5fYXBwbHlBcmdzID0gYXBwbHlBcmdzO1xuXHRcdHRoaXMuX3VuZG9BcmdzID0gdGhpcy5fb3JpZ2luYWxVbmRvQXJncyA9IHVuZG9BcmdzO1xuXHRcdHRoaXMuYXBwbHkgPSBUeXBlQWhlYWRTdHlsZS5fY29tcGlsZUFyZ3ModGhpcy5fYXBwbHlBcmdzKTtcblx0XHR0aGlzLnVuZG8gPSBUeXBlQWhlYWRTdHlsZS5fY29tcGlsZUFyZ3ModGhpcy5fdW5kb0FyZ3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QXJncyhzdHlsZTogSVRlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvblsnbG9jYWxFY2hvU3R5bGUnXSkge1xuXHRcdHN3aXRjaCAoc3R5bGUpIHtcblx0XHRcdGNhc2UgJ2JvbGQnOlxuXHRcdFx0XHRyZXR1cm4geyBhcHBseUFyZ3M6IFsxXSwgdW5kb0FyZ3M6IFsyMl0gfTtcblx0XHRcdGNhc2UgJ2RpbSc6XG5cdFx0XHRcdHJldHVybiB7IGFwcGx5QXJnczogWzJdLCB1bmRvQXJnczogWzIyXSB9O1xuXHRcdFx0Y2FzZSAnaXRhbGljJzpcblx0XHRcdFx0cmV0dXJuIHsgYXBwbHlBcmdzOiBbM10sIHVuZG9BcmdzOiBbMjNdIH07XG5cdFx0XHRjYXNlICd1bmRlcmxpbmVkJzpcblx0XHRcdFx0cmV0dXJuIHsgYXBwbHlBcmdzOiBbNF0sIHVuZG9BcmdzOiBbMjRdIH07XG5cdFx0XHRjYXNlICdpbnZlcnRlZCc6XG5cdFx0XHRcdHJldHVybiB7IGFwcGx5QXJnczogWzddLCB1bmRvQXJnczogWzI3XSB9O1xuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRsZXQgY29sb3I6IENvbG9yO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbG9yID0gQ29sb3IuZnJvbUhleChzdHlsZSk7XG5cdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdGNvbG9yID0gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMCwgMCwgMSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgeyByLCBnLCBiIH0gPSBjb2xvci5yZ2JhO1xuXHRcdFx0XHRyZXR1cm4geyBhcHBseUFyZ3M6IFszOCwgMiwgciwgZywgYl0sIHVuZG9BcmdzOiBbMzldIH07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IGNvbXBpbGVFeGNsdWRlUmVnZXhwID0gKHByb2dyYW1zID0gREVGQVVMVF9MT0NBTF9FQ0hPX0VYQ0xVREUpID0+XG5cdG5ldyBSZWdFeHAoYFxcXFxiKCR7cHJvZ3JhbXMubWFwKGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMpLmpvaW4oJ3wnKX0pXFxcXGJgLCAnaScpO1xuXG5leHBvcnQgY29uc3QgZW51bSBDaGFyUHJlZGljdFN0YXRlIHtcblx0LyoqIE5vIGNoYXJhY3RlcnMgdHlwZWQgb24gdGhpcyBsaW5lIHlldCAqL1xuXHRVbmtub3duLFxuXHQvKiogSGFzIGEgcGVuZGluZyBjaGFyYWN0ZXIgcHJlZGljdGlvbiAqL1xuXHRIYXNQZW5kaW5nQ2hhcixcblx0LyoqIENoYXJhY3RlciB2YWxpZGF0ZWQgb24gdGhpcyBsaW5lICovXG5cdFZhbGlkYXRlZCxcbn1cblxuZXhwb3J0IGNsYXNzIFR5cGVBaGVhZEFkZG9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXJtaW5hbEFkZG9uIHtcblx0cHJpdmF0ZSBfdHlwZWFoZWFkU3R5bGU/OiBUeXBlQWhlYWRTdHlsZTtcblx0cHJpdmF0ZSBfdHlwZWFoZWFkVGhyZXNob2xkID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvbj4oVEVSTUlOQUxfQ09ORklHX1NFQ1RJT04pLmxvY2FsRWNob0xhdGVuY3lUaHJlc2hvbGQ7XG5cdHByaXZhdGUgX2V4Y2x1ZGVQcm9ncmFtUmUgPSBjb21waWxlRXhjbHVkZVJlZ2V4cCh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJVGVybWluYWxUeXBlQWhlYWRDb25maWd1cmF0aW9uPihURVJNSU5BTF9DT05GSUdfU0VDVElPTikubG9jYWxFY2hvRXhjbHVkZVByb2dyYW1zKTtcblx0cHJvdGVjdGVkIF9sYXN0Um93PzogeyB5OiBudW1iZXI7IHN0YXJ0aW5nWDogbnVtYmVyOyBlbmRpbmdYOiBudW1iZXI7IGNoYXJTdGF0ZTogQ2hhclByZWRpY3RTdGF0ZSB9O1xuXHRwcm90ZWN0ZWQgX3RpbWVsaW5lPzogUHJlZGljdGlvblRpbWVsaW5lO1xuXHRwcml2YXRlIF90ZXJtaW5hbFRpdGxlID0gJyc7XG5cdHN0YXRzPzogUHJlZGljdGlvblN0YXRzO1xuXG5cdC8qKlxuXHQgKiBEZWJvdW5jZSB0aGF0IGNsZWFycyBwcmVkaWN0aW9ucyBhZnRlciBhIHRpbWVvdXQgaWYgdGhlIFBUWSBkb2Vzbid0IGFwcGx5IHRoZW0uXG5cdCAqL1xuXHRwcml2YXRlIF9jbGVhclByZWRpY3Rpb25EZWJvdW5jZT86IElEaXNwb3NhYmxlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX3Byb2Nlc3NNYW5hZ2VyOiBJVGVybWluYWxQcm9jZXNzTWFuYWdlcixcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9jbGVhclByZWRpY3Rpb25EZWJvdW5jZT8uZGlzcG9zZSgpKSk7XG5cdH1cblxuXHRhY3RpdmF0ZSh0ZXJtaW5hbDogVGVybWluYWwpOiB2b2lkIHtcblx0XHRjb25zdCBzdHlsZSA9IHRoaXMuX3R5cGVhaGVhZFN0eWxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFR5cGVBaGVhZFN0eWxlKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElUZXJtaW5hbFR5cGVBaGVhZENvbmZpZ3VyYXRpb24+KFRFUk1JTkFMX0NPTkZJR19TRUNUSU9OKS5sb2NhbEVjaG9TdHlsZSwgdGVybWluYWwpKTtcblx0XHRjb25zdCB0aW1lbGluZSA9IHRoaXMuX3RpbWVsaW5lID0gbmV3IFByZWRpY3Rpb25UaW1lbGluZSh0ZXJtaW5hbCwgdGhpcy5fdHlwZWFoZWFkU3R5bGUpO1xuXHRcdGNvbnN0IHN0YXRzID0gdGhpcy5zdGF0cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQcmVkaWN0aW9uU3RhdHModGhpcy5fdGltZWxpbmUpKTtcblxuXHRcdHRpbWVsaW5lLnNldFNob3dQcmVkaWN0aW9ucyh0aGlzLl90eXBlYWhlYWRUaHJlc2hvbGQgPT09IDApO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRlcm1pbmFsLm9uRGF0YShlID0+IHRoaXMuX29uVXNlckRhdGEoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXJtaW5hbC5vblRpdGxlQ2hhbmdlKHRpdGxlID0+IHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsVGl0bGUgPSB0aXRsZTtcblx0XHRcdHRoaXMuX3JlZXZhbHVhdGVQcmVkaWN0b3JTdGF0ZShzdGF0cywgdGltZWxpbmUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXJtaW5hbC5vblJlc2l6ZSgoKSA9PiB7XG5cdFx0XHR0aW1lbGluZS5zZXRTaG93UHJlZGljdGlvbnMoZmFsc2UpO1xuXHRcdFx0dGltZWxpbmUuY2xlYXJDdXJzb3IoKTtcblx0XHRcdHRoaXMuX3JlZXZhbHVhdGVQcmVkaWN0b3JTdGF0ZShzdGF0cywgdGltZWxpbmUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihURVJNSU5BTF9DT05GSUdfU0VDVElPTikpIHtcblx0XHRcdFx0c3R5bGUub25VcGRhdGUodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvbj4oVEVSTUlOQUxfQ09ORklHX1NFQ1RJT04pLmxvY2FsRWNob1N0eWxlKTtcblx0XHRcdFx0dGhpcy5fdHlwZWFoZWFkVGhyZXNob2xkID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsVHlwZUFoZWFkQ29uZmlndXJhdGlvbj4oVEVSTUlOQUxfQ09ORklHX1NFQ1RJT04pLmxvY2FsRWNob0xhdGVuY3lUaHJlc2hvbGQ7XG5cdFx0XHRcdHRoaXMuX2V4Y2x1ZGVQcm9ncmFtUmUgPSBjb21waWxlRXhjbHVkZVJlZ2V4cCh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJVGVybWluYWxUeXBlQWhlYWRDb25maWd1cmF0aW9uPihURVJNSU5BTF9DT05GSUdfU0VDVElPTikubG9jYWxFY2hvRXhjbHVkZVByb2dyYW1zKTtcblx0XHRcdFx0dGhpcy5fcmVldmFsdWF0ZVByZWRpY3RvclN0YXRlKHN0YXRzLCB0aW1lbGluZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RpbWVsaW5lLm9uUHJlZGljdGlvblN1Y2NlZWRlZChwID0+IHtcblx0XHRcdGlmICh0aGlzLl9sYXN0Um93Py5jaGFyU3RhdGUgPT09IENoYXJQcmVkaWN0U3RhdGUuSGFzUGVuZGluZ0NoYXIgJiYgaXNUZW5hdGl2ZUNoYXJhY3RlclByZWRpY3Rpb24ocCkgJiYgcC5pbm5lci5hcHBsaWVkQXQpIHtcblx0XHRcdFx0aWYgKHAuaW5uZXIuYXBwbGllZEF0LnBvcy55ICsgcC5pbm5lci5hcHBsaWVkQXQucG9zLmJhc2VZID09PSB0aGlzLl9sYXN0Um93LnkpIHtcblx0XHRcdFx0XHR0aGlzLl9sYXN0Um93LmNoYXJTdGF0ZSA9IENoYXJQcmVkaWN0U3RhdGUuVmFsaWRhdGVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLm9uQmVmb3JlUHJvY2Vzc0RhdGEoZSA9PiB0aGlzLl9vbkJlZm9yZVByb2Nlc3NEYXRhKGUpKSk7XG5cblx0XHRsZXQgbmV4dFN0YXRzU2VuZDogYW55O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHN0YXRzLm9uQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmICghbmV4dFN0YXRzU2VuZCkge1xuXHRcdFx0XHRuZXh0U3RhdHNTZW5kID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fc2VuZExhdGVuY3lTdGF0cyhzdGF0cyk7XG5cdFx0XHRcdFx0bmV4dFN0YXRzU2VuZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fSwgU3RhdHNDb25zdGFudHMuU3RhdHNTZW5kVGVsZW1ldHJ5RXZlcnkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGltZWxpbmUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHN0eWxlLmRlYm91bmNlU3RvcFRyYWNraW5nKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlZXZhbHVhdGVQcmVkaWN0b3JTdGF0ZShzdGF0cywgdGltZWxpbmUpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHJlc2V0KCkge1xuXHRcdHRoaXMuX2xhc3RSb3cgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9kZWZlckNsZWFyaW5nUHJlZGljdGlvbnMoKSB7XG5cdFx0aWYgKCF0aGlzLnN0YXRzIHx8ICF0aGlzLl90aW1lbGluZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NsZWFyUHJlZGljdGlvbkRlYm91bmNlPy5kaXNwb3NlKCk7XG5cdFx0aWYgKHRoaXMuX3RpbWVsaW5lLmxlbmd0aCA9PT0gMCB8fCB0aGlzLl90aW1lbGluZS5wZWVrU3RhcnQoKT8uY2xlYXJBZnRlclRpbWVvdXQgPT09IGZhbHNlKSB7XG5cdFx0XHR0aGlzLl9jbGVhclByZWRpY3Rpb25EZWJvdW5jZSA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jbGVhclByZWRpY3Rpb25EZWJvdW5jZSA9IGRpc3Bvc2FibGVUaW1lb3V0KFxuXHRcdFx0KCkgPT4ge1xuXHRcdFx0XHR0aGlzLl90aW1lbGluZT8udW5kb0FsbFByZWRpY3Rpb25zKCk7XG5cdFx0XHRcdGlmICh0aGlzLl9sYXN0Um93Py5jaGFyU3RhdGUgPT09IENoYXJQcmVkaWN0U3RhdGUuSGFzUGVuZGluZ0NoYXIpIHtcblx0XHRcdFx0XHR0aGlzLl9sYXN0Um93LmNoYXJTdGF0ZSA9IENoYXJQcmVkaWN0U3RhdGUuVW5rbm93bjtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdE1hdGgubWF4KDUwMCwgdGhpcy5zdGF0cy5tYXhMYXRlbmN5ICogMyAvIDIpLFxuXHRcdFx0dGhpcy5fc3RvcmVcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vdGUgb24gZGVib3VuY2U6XG5cdCAqXG5cdCAqIFdlIHdhbnQgdG8gdG9nZ2xlIHRoZSBzdGF0ZSBvbmx5IHdoZW4gdGhlIHVzZXIgaGFzIGEgcGF1c2UgaW4gdGhlaXJcblx0ICogdHlwaW5nLiBPdGhlcndpc2UsIHdlIGNvdWxkIHR1cm4gdGhpcyBvbiB3aGVuIHRoZSBQVFkgc2VudCBkYXRhIGJ1dCB0aGVcblx0ICogdGVybWluYWwgY3Vyc29yIGlzIG5vdCB1cGRhdGVkLCBjYXVzZXMgaXNzdWVzLlxuXHQgKi9cblx0QGRlYm91bmNlKDEwMClcblx0cHJvdGVjdGVkIF9yZWV2YWx1YXRlUHJlZGljdG9yU3RhdGUoc3RhdHM6IFByZWRpY3Rpb25TdGF0cywgdGltZWxpbmU6IFByZWRpY3Rpb25UaW1lbGluZSkge1xuXHRcdHRoaXMuX3JlZXZhbHVhdGVQcmVkaWN0b3JTdGF0ZU5vdyhzdGF0cywgdGltZWxpbmUpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9yZWV2YWx1YXRlUHJlZGljdG9yU3RhdGVOb3coc3RhdHM6IFByZWRpY3Rpb25TdGF0cywgdGltZWxpbmU6IFByZWRpY3Rpb25UaW1lbGluZSkge1xuXHRcdGlmICh0aGlzLl9leGNsdWRlUHJvZ3JhbVJlLnRlc3QodGhpcy5fdGVybWluYWxUaXRsZSkpIHtcblx0XHRcdHRpbWVsaW5lLnNldFNob3dQcmVkaWN0aW9ucyhmYWxzZSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl90eXBlYWhlYWRUaHJlc2hvbGQgPCAwKSB7XG5cdFx0XHR0aW1lbGluZS5zZXRTaG93UHJlZGljdGlvbnMoZmFsc2UpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fdHlwZWFoZWFkVGhyZXNob2xkID09PSAwKSB7XG5cdFx0XHR0aW1lbGluZS5zZXRTaG93UHJlZGljdGlvbnModHJ1ZSk7XG5cdFx0fSBlbHNlIGlmIChzdGF0cy5zYW1wbGVTaXplID4gU3RhdHNDb25zdGFudHMuU3RhdHNNaW5TYW1wbGVzVG9UdXJuT24gJiYgc3RhdHMuYWNjdXJhY3kgPiBTdGF0c0NvbnN0YW50cy5TdGF0c01pbkFjY3VyYWN5VG9UdXJuT24pIHtcblx0XHRcdGNvbnN0IGxhdGVuY3kgPSBzdGF0cy5sYXRlbmN5Lm1lZGlhbjtcblx0XHRcdGlmIChsYXRlbmN5ID49IHRoaXMuX3R5cGVhaGVhZFRocmVzaG9sZCkge1xuXHRcdFx0XHR0aW1lbGluZS5zZXRTaG93UHJlZGljdGlvbnModHJ1ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGxhdGVuY3kgPCB0aGlzLl90eXBlYWhlYWRUaHJlc2hvbGQgLyBTdGF0c0NvbnN0YW50cy5TdGF0c1RvZ2dsZU9mZlRocmVzaG9sZCkge1xuXHRcdFx0XHR0aW1lbGluZS5zZXRTaG93UHJlZGljdGlvbnMoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NlbmRMYXRlbmN5U3RhdHMoc3RhdHM6IFByZWRpY3Rpb25TdGF0cykge1xuXHRcdC8qIF9fR0RQUl9fXG5cdFx0XHRcInRlcm1pbmFsTGF0ZW5jeVN0YXRzXCIgOiB7XG5cdFx0XHRcdFwib3duZXJcIjogXCJUeXJpYXJcIixcblx0XHRcdFx0XCJtaW5cIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIlBlcmZvcm1hbmNlQW5kSGVhbHRoXCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XHRcdFwibWF4XCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJQZXJmb3JtYW5jZUFuZEhlYWx0aFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9LFxuXHRcdFx0XHRcIm1lZGlhblwiIDogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiUGVyZm9ybWFuY2VBbmRIZWFsdGhcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfSxcblx0XHRcdFx0XCJjb3VudFwiIDogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiUGVyZm9ybWFuY2VBbmRIZWFsdGhcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfSxcblx0XHRcdFx0XCJwcmVkaWN0aW9uQWNjdXJhY3lcIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIlBlcmZvcm1hbmNlQW5kSGVhbHRoXCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH1cblx0XHRcdH1cblx0XHQgKi9cblx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygndGVybWluYWxMYXRlbmN5U3RhdHMnLCB7XG5cdFx0XHQuLi5zdGF0cy5sYXRlbmN5LFxuXHRcdFx0cHJlZGljdGlvbkFjY3VyYWN5OiBzdGF0cy5hY2N1cmFjeSxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX29uVXNlckRhdGEoZGF0YTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3RpbWVsaW5lPy50ZXJtaW5hbC5idWZmZXIuYWN0aXZlLnR5cGUgIT09ICdub3JtYWwnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gY29uc29sZS5sb2coJ3VzZXIgZGF0YTonLCBKU09OLnN0cmluZ2lmeShkYXRhKSk7XG5cblx0XHRjb25zdCB0ZXJtaW5hbCA9IHRoaXMuX3RpbWVsaW5lLnRlcm1pbmFsO1xuXHRcdGNvbnN0IGJ1ZmZlciA9IHRlcm1pbmFsLmJ1ZmZlci5hY3RpdmU7XG5cblx0XHQvLyBEZXRlY3QgcHJvZ3JhbXMgbGlrZSBnaXQgbG9nL2xlc3MgdGhhdCB1c2UgdGhlIG5vcm1hbCBidWZmZXIgYnV0IGRvbid0XG5cdFx0Ly8gdGFrZSBpbnB1dCBieSBkZWFmdWx0IChmaXhlcyAjMTA5NTQxKVxuXHRcdGlmIChidWZmZXIuY3Vyc29yWCA9PT0gMSAmJiBidWZmZXIuY3Vyc29yWSA9PT0gdGVybWluYWwucm93cyAtIDEpIHtcblx0XHRcdGlmIChidWZmZXIuZ2V0TGluZShidWZmZXIuY3Vyc29yWSArIGJ1ZmZlci5iYXNlWSk/LmdldENlbGwoMCk/LmdldENoYXJzKCkgPT09ICc6Jykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gdGhlIGZvbGxvd2luZyBjb2RlIGd1YXJkcyB0aGUgdGVybWluYWwgcHJvbXB0IHRvIGF2b2lkIGJlaW5nIGFibGUgdG9cblx0XHQvLyBhcnJvdyBvciBiYWNrc3BhY2UtaW50byB0aGUgcHJvbXB0LiBSZWNvcmQgdGhlIGxvd2VzdCBYIHZhbHVlIGF0IHdoaWNoXG5cdFx0Ly8gdGhlIHVzZXIgZ2F2ZSBpbnB1dCwgYW5kIG1hcmsgYWxsIGFkZGl0aW9ucyBiZWZvcmUgdGhhdCBhcyB0ZW50YXRpdmUuXG5cdFx0Y29uc3QgYWN0dWFsWSA9IGJ1ZmZlci5iYXNlWSArIGJ1ZmZlci5jdXJzb3JZO1xuXHRcdGlmIChhY3R1YWxZICE9PSB0aGlzLl9sYXN0Um93Py55KSB7XG5cdFx0XHR0aGlzLl9sYXN0Um93ID0geyB5OiBhY3R1YWxZLCBzdGFydGluZ1g6IGJ1ZmZlci5jdXJzb3JYLCBlbmRpbmdYOiBidWZmZXIuY3Vyc29yWCwgY2hhclN0YXRlOiBDaGFyUHJlZGljdFN0YXRlLlVua25vd24gfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fbGFzdFJvdy5zdGFydGluZ1ggPSBNYXRoLm1pbih0aGlzLl9sYXN0Um93LnN0YXJ0aW5nWCwgYnVmZmVyLmN1cnNvclgpO1xuXHRcdFx0dGhpcy5fbGFzdFJvdy5lbmRpbmdYID0gTWF0aC5tYXgodGhpcy5fbGFzdFJvdy5lbmRpbmdYLCB0aGlzLl90aW1lbGluZS5waHlzaWNhbEN1cnNvcihidWZmZXIpLngpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFkZExlZnROYXZpZ2F0aW5nID0gKHA6IElQcmVkaWN0aW9uKSA9PlxuXHRcdFx0dGhpcy5fdGltZWxpbmUhLnRlbnRhdGl2ZUN1cnNvcihidWZmZXIpLnggPD0gdGhpcy5fbGFzdFJvdyEuc3RhcnRpbmdYXG5cdFx0XHRcdD8gdGhpcy5fdGltZWxpbmUhLmFkZEJvdW5kYXJ5KGJ1ZmZlciwgcClcblx0XHRcdFx0OiB0aGlzLl90aW1lbGluZSEuYWRkUHJlZGljdGlvbihidWZmZXIsIHApO1xuXG5cdFx0Y29uc3QgYWRkUmlnaHROYXZpZ2F0aW5nID0gKHA6IElQcmVkaWN0aW9uKSA9PlxuXHRcdFx0dGhpcy5fdGltZWxpbmUhLnRlbnRhdGl2ZUN1cnNvcihidWZmZXIpLnggPj0gdGhpcy5fbGFzdFJvdyEuZW5kaW5nWCAtIDFcblx0XHRcdFx0PyB0aGlzLl90aW1lbGluZSEuYWRkQm91bmRhcnkoYnVmZmVyLCBwKVxuXHRcdFx0XHQ6IHRoaXMuX3RpbWVsaW5lIS5hZGRQcmVkaWN0aW9uKGJ1ZmZlciwgcCk7XG5cblx0XHQvKiogQHNlZSBodHRwczovL2dpdGh1Yi5jb20veHRlcm1qcy94dGVybS5qcy9ibG9iLzE5MTNlOTUxMmMwNDhlM2NmNTZiYjVmNWRmNTFiZmZmNjg5OWMxODQvc3JjL2NvbW1vbi9pbnB1dC9LZXlib2FyZC50cyAqL1xuXHRcdGNvbnN0IHJlYWRlciA9IG5ldyBTdHJpbmdSZWFkZXIoZGF0YSk7XG5cdFx0d2hpbGUgKHJlYWRlci5yZW1haW5pbmcgPiAwKSB7XG5cdFx0XHRpZiAocmVhZGVyLmVhdENoYXJDb2RlKDEyNykpIHsgLy8gYmFja3NwYWNlXG5cdFx0XHRcdGNvbnN0IHByZXZpb3VzID0gdGhpcy5fdGltZWxpbmUucGVla0VuZCgpO1xuXHRcdFx0XHRpZiAocHJldmlvdXMgJiYgcHJldmlvdXMgaW5zdGFuY2VvZiBDaGFyYWN0ZXJQcmVkaWN0aW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5fdGltZWxpbmUuYWRkQm91bmRhcnkoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGJhY2tzcGFjZSBtdXN0IGJlIGFibGUgdG8gcmVhZCB0aGUgcHJldmlvdXNseS13cml0dGVuIGNoYXJhY3RlciBpblxuXHRcdFx0XHQvLyB0aGUgZXZlbnQgdGhhdCBpdCBuZWVkcyB0byB1bmRvIGl0XG5cdFx0XHRcdGlmICh0aGlzLl90aW1lbGluZS5pc1Nob3dpbmdQcmVkaWN0aW9ucykge1xuXHRcdFx0XHRcdGZsdXNoT3V0cHV0KHRoaXMuX3RpbWVsaW5lLnRlcm1pbmFsKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl90aW1lbGluZS50ZW50YXRpdmVDdXJzb3IoYnVmZmVyKS54IDw9IHRoaXMuX2xhc3RSb3cuc3RhcnRpbmdYKSB7XG5cdFx0XHRcdFx0dGhpcy5fdGltZWxpbmUuYWRkQm91bmRhcnkoYnVmZmVyLCBuZXcgQmFja3NwYWNlUHJlZGljdGlvbih0aGlzLl90aW1lbGluZS50ZXJtaW5hbCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIEJhY2tzcGFjZSBkZWNyZW1lbnRzIG91ciBhYmlsaXR5IHRvIGdvIHJpZ2h0LlxuXHRcdFx0XHRcdHRoaXMuX2xhc3RSb3cuZW5kaW5nWC0tO1xuXHRcdFx0XHRcdHRoaXMuX3RpbWVsaW5lLmFkZFByZWRpY3Rpb24oYnVmZmVyLCBuZXcgQmFja3NwYWNlUHJlZGljdGlvbih0aGlzLl90aW1lbGluZS50ZXJtaW5hbCkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZWFkZXIuZWF0Q2hhckNvZGUoMzIsIDEyNikpIHsgLy8gYWxwaGFudW1cblx0XHRcdFx0Y29uc3QgY2hhciA9IGRhdGFbcmVhZGVyLmluZGV4IC0gMV07XG5cdFx0XHRcdGNvbnN0IHByZWRpY3Rpb24gPSBuZXcgQ2hhcmFjdGVyUHJlZGljdGlvbih0aGlzLl90eXBlYWhlYWRTdHlsZSEsIGNoYXIpO1xuXHRcdFx0XHRpZiAodGhpcy5fbGFzdFJvdy5jaGFyU3RhdGUgPT09IENoYXJQcmVkaWN0U3RhdGUuVW5rbm93bikge1xuXHRcdFx0XHRcdHRoaXMuX3RpbWVsaW5lLmFkZEJvdW5kYXJ5KGJ1ZmZlciwgcHJlZGljdGlvbik7XG5cdFx0XHRcdFx0dGhpcy5fbGFzdFJvdy5jaGFyU3RhdGUgPSBDaGFyUHJlZGljdFN0YXRlLkhhc1BlbmRpbmdDaGFyO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX3RpbWVsaW5lLmFkZFByZWRpY3Rpb24oYnVmZmVyLCBwcmVkaWN0aW9uKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl90aW1lbGluZS50ZW50YXRpdmVDdXJzb3IoYnVmZmVyKS54ID49IHRlcm1pbmFsLmNvbHMpIHtcblx0XHRcdFx0XHR0aGlzLl90aW1lbGluZS5hZGRCb3VuZGFyeShidWZmZXIsIG5ldyBMaW5ld3JhcFByZWRpY3Rpb24oKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGN1cnNvck12ID0gcmVhZGVyLmVhdFJlKENTSV9NT1ZFX1JFKTtcblx0XHRcdGlmIChjdXJzb3JNdikge1xuXHRcdFx0XHRjb25zdCBkaXJlY3Rpb24gPSBjdXJzb3JNdlszXSBhcyBDdXJzb3JNb3ZlRGlyZWN0aW9uO1xuXHRcdFx0XHRjb25zdCBwID0gbmV3IEN1cnNvck1vdmVQcmVkaWN0aW9uKGRpcmVjdGlvbiwgISFjdXJzb3JNdlsyXSwgTnVtYmVyKGN1cnNvck12WzFdKSB8fCAxKTtcblx0XHRcdFx0aWYgKGRpcmVjdGlvbiA9PT0gQ3Vyc29yTW92ZURpcmVjdGlvbi5CYWNrKSB7XG5cdFx0XHRcdFx0YWRkTGVmdE5hdmlnYXRpbmcocCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWRkUmlnaHROYXZpZ2F0aW5nKHApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVhZGVyLmVhdFN0cihgJHtWVC5Fc2N9ZmApKSB7XG5cdFx0XHRcdGFkZFJpZ2h0TmF2aWdhdGluZyhuZXcgQ3Vyc29yTW92ZVByZWRpY3Rpb24oQ3Vyc29yTW92ZURpcmVjdGlvbi5Gb3J3YXJkcywgdHJ1ZSwgMSkpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlYWRlci5lYXRTdHIoYCR7VlQuRXNjfWJgKSkge1xuXHRcdFx0XHRhZGRMZWZ0TmF2aWdhdGluZyhuZXcgQ3Vyc29yTW92ZVByZWRpY3Rpb24oQ3Vyc29yTW92ZURpcmVjdGlvbi5CYWNrLCB0cnVlLCAxKSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVhZGVyLmVhdENoYXIoJ1xccicpICYmIGJ1ZmZlci5jdXJzb3JZIDwgdGVybWluYWwucm93cyAtIDEpIHtcblx0XHRcdFx0dGhpcy5fdGltZWxpbmUuYWRkUHJlZGljdGlvbihidWZmZXIsIG5ldyBOZXdsaW5lUHJlZGljdGlvbigpKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHNvbWV0aGluZyBlbHNlXG5cdFx0XHR0aGlzLl90aW1lbGluZS5hZGRCb3VuZGFyeShidWZmZXIsIG5ldyBIYXJkQm91bmRhcnkoKSk7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fdGltZWxpbmUubGVuZ3RoID09PSAxKSB7XG5cdFx0XHR0aGlzLl9kZWZlckNsZWFyaW5nUHJlZGljdGlvbnMoKTtcblx0XHRcdHRoaXMuX3R5cGVhaGVhZFN0eWxlIS5zdGFydFRyYWNraW5nKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25CZWZvcmVQcm9jZXNzRGF0YShldmVudDogSUJlZm9yZVByb2Nlc3NEYXRhRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3RpbWVsaW5lKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gY29uc29sZS5sb2coJ2luY29taW5nIGRhdGE6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQuZGF0YSkpO1xuXHRcdGV2ZW50LmRhdGEgPSB0aGlzLl90aW1lbGluZS5iZWZvcmVTZXJ2ZXJJbnB1dChldmVudC5kYXRhKTtcblx0XHQvLyBjb25zb2xlLmxvZygnZW1pdHRlZCBkYXRhOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LmRhdGEpKTtcblxuXHRcdHRoaXMuX2RlZmVyQ2xlYXJpbmdQcmVkaWN0aW9ucygpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsT0FBTyxZQUFZO0FBQzVCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVksb0JBQW9CO0FBQ3pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBRWxDLFNBQTJELCtCQUErQjtBQUUxRixTQUFTLGtDQUF3RTtBQUVqRixJQUFXLEtBQVgsa0JBQVdBLFFBQVg7QUFDQyxFQUFBQSxJQUFBLFNBQU07QUFDTixFQUFBQSxJQUFBLFNB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QUFDTixlQUFLLFVBQVUsY0FBYyxRQUFRLFVBQVU7QUFBQSxRQUNoRDtBQUVBLFlBQUksS0FBSyxVQUFVLGdCQUFnQixNQUFNLEVBQUUsS0FBSyxTQUFTLE1BQU07QUFDOUQsZUFBSyxVQUFVLFlBQVksUUFBUSxJQUFJLG1CQUFtQixDQUFDO0FBQUEsUUFDNUQ7QUFDQTtBQUFBLE1BQ0Q7QUFFQSxZQUFNLFdBQVcsT0FBTyxNQUFNLFdBQVc7QUFDekMsVUFBSSxVQUFVO0FBQ2IsY0FBTSxZQUFZLFNBQVMsQ0FBQztBQUM1QixjQUFNLElBQUksSUFBSSxxQkFBcUIsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDckYsWUFBSSxjQUFjLGdCQUEwQjtBQUMzQyw0QkFBa0IsQ0FBQztBQUFBLFFBQ3BCLE9BQU87QUFDTiw2QkFBbUIsQ0FBQztBQUFBLFFBQ3JCO0FBQ0E7QUFBQSxNQUNEO0FBRUEsVUFBSSxPQUFPLE9BQU8sR0FBRyxnQkFBTSxHQUFHLEdBQUc7QUFDaEMsMkJBQW1CLElBQUkscUJBQXFCLG9CQUE4QixNQUFNLENBQUMsQ0FBQztBQUNsRjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLE9BQU8sT0FBTyxHQUFHLGdCQUFNLEdBQUcsR0FBRztBQUNoQywwQkFBa0IsSUFBSSxxQkFBcUIsZ0JBQTBCLE1BQU0sQ0FBQyxDQUFDO0FBQzdFO0FBQUEsTUFDRDtBQUVBLFVBQUksT0FBTyxRQUFRLElBQUksS0FBSyxPQUFPLFVBQVUsU0FBUyxPQUFPLEdBQUc7QUFDL0QsYUFBSyxVQUFVLGNBQWMsUUFBUSxJQUFJLGtCQUFrQixDQUFDO0FBQzVEO0FBQUEsTUFDRDtBQUdBLFdBQUssVUFBVSxZQUFZLFFBQVEsSUFBSSxhQUFhLENBQUM7QUFDckQ7QUFBQSxJQUNEO0FBRUEsUUFBSSxLQUFLLFVBQVUsV0FBVyxHQUFHO0FBQ2hDLFdBQUssMEJBQTBCO0FBQy9CLFdBQUssZ0JBQWlCLGNBQWM7QUFBQSxJQUNyQztBQUFBLEVBQ0Q7QUFBQSxFQUVRLHFCQUFxQixPQUFzQztBQUNsRSxRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCO0FBQUEsSUFDRDtBQUdBLFVBQU0sT0FBTyxLQUFLLFVBQVUsa0JBQWtCLE1BQU0sSUFBSTtBQUd4RCxTQUFLLDBCQUEwQjtBQUFBLEVBQ2hDO0FBQ0Q7QUF4S1c7QUFBQSxFQURULFNBQVMsR0FBRztBQUFBLEdBM0dELGVBNEdGO0FBNUdFLGlCQUFOO0FBQUEsRUFnQko7QUFBQSxFQUNBO0FBQUEsR0FqQlU7IiwKICAibmFtZXMiOiBbIlZUIiwgIlN0YXRzQ29uc3RhbnRzIiwgIkN1cnNvck1vdmVEaXJlY3Rpb24iLCAiTWF0Y2hSZXN1bHQiLCAiQ2hhclByZWRpY3RTdGF0ZSJdCn0K
