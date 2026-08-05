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
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ILogService, LogLevel } from "../../../../log/common/log.js";
import { throttle } from "../../../../../base/common/decorators.js";
import { PosixShellType } from "../../terminal.js";
var PromptInputState = /* @__PURE__ */ ((PromptInputState2) => {
  PromptInputState2[PromptInputState2["Unknown"] = 0] = "Unknown";
  PromptInputState2[PromptInputState2["Input"] = 1] = "Input";
  PromptInputState2[PromptInputState2["Execute"] = 2] = "Execute";
  return PromptInputState2;
})(PromptInputState || {});
let PromptInputModel = class extends Disposable {
  constructor(_xterm, onCommandStart, onCommandStartChanged, onCommandExecuted, _logService) {
    super();
    this._xterm = _xterm;
    this._logService = _logService;
    this._state = 0 /* Unknown */;
    this._commandStartX = 0;
    this._lastUserInput = "";
    this._value = "";
    this._cursorIndex = 0;
    this._ghostTextIndex = -1;
    this._onDidStartInput = this._register(new Emitter());
    this.onDidStartInput = this._onDidStartInput.event;
    this._onDidChangeInput = this._register(new Emitter());
    this.onDidChangeInput = this._onDidChangeInput.event;
    this._onDidFinishInput = this._register(new Emitter());
    this.onDidFinishInput = this._onDidFinishInput.event;
    this._onDidInterrupt = this._register(new Emitter());
    this.onDidInterrupt = this._onDidInterrupt.event;
    this._register(Event.any(
      this._xterm.onCursorMove,
      this._xterm.onData,
      this._xterm.onWriteParsed
    )(() => this._sync()));
    this._register(this._xterm.onData((e) => this._handleUserInput(e)));
    this._register(onCommandStart((e) => this._handleCommandStart(e)));
    this._register(onCommandStartChanged(() => this._handleCommandStartChanged()));
    this._register(onCommandExecuted(() => this._handleCommandExecuted()));
    this._register(this.onDidStartInput(() => this._logCombinedStringIfTrace("PromptInputModel#onDidStartInput")));
    this._register(this.onDidChangeInput(() => this._logCombinedStringIfTrace("PromptInputModel#onDidChangeInput")));
    this._register(this.onDidFinishInput(() => this._logCombinedStringIfTrace("PromptInputModel#onDidFinishInput")));
    this._register(this.onDidInterrupt(() => this._logCombinedStringIfTrace("PromptInputModel#onDidInterrupt")));
  }
  get value() {
    return this._value;
  }
  get prefix() {
    return this._value.substring(0, this._cursorIndex);
  }
  get suffix() {
    return this._value.substring(this._cursorIndex, this._ghostTextIndex === -1 ? void 0 : this._ghostTextIndex);
  }
  get cursorIndex() {
    return this._cursorIndex;
  }
  get ghostTextIndex() {
    return this._ghostTextIndex;
  }
  _logCombinedStringIfTrace(message) {
    if (this._logService.getLevel() === LogLevel.Trace) {
      this._logService.trace(message, this.getCombinedString());
    }
  }
  setShellType(shellType) {
    this._shellType = shellType;
  }
  setContinuationPrompt(value) {
    this._continuationPrompt = value;
    this._sync();
  }
  setLastPromptLine(value) {
    this._lastPromptLine = value;
    this._sync();
  }
  setConfidentCommandLine(value) {
    if (this._value !== value) {
      this._value = value;
      this._cursorIndex = -1;
      this._ghostTextIndex = -1;
      this._onDidChangeInput.fire(this._createStateObject());
    }
  }
  getCombinedString(emptyStringWhenEmpty) {
    const value = this._value.replaceAll("\n", "\u23CE");
    if (this._cursorIndex === -1) {
      return value;
    }
    let result = `${value.substring(0, this.cursorIndex)}|`;
    if (this.ghostTextIndex !== -1) {
      result += `${value.substring(this.cursorIndex, this.ghostTextIndex)}[`;
      result += `${value.substring(this.ghostTextIndex)}]`;
    } else {
      result += value.substring(this.cursorIndex);
    }
    if (result === "|" && emptyStringWhenEmpty) {
      return "";
    }
    return result;
  }
  serialize() {
    return {
      modelState: this._createStateObject(),
      commandStartX: this._commandStartX,
      lastPromptLine: this._lastPromptLine,
      continuationPrompt: this._continuationPrompt,
      lastUserInput: this._lastUserInput
    };
  }
  deserialize(serialized) {
    this._value = serialized.modelState.value;
    this._cursorIndex = serialized.modelState.cursorIndex;
    this._ghostTextIndex = serialized.modelState.ghostTextIndex;
    this._commandStartX = serialized.commandStartX;
    this._lastPromptLine = serialized.lastPromptLine;
    this._continuationPrompt = serialized.continuationPrompt;
    this._lastUserInput = serialized.lastUserInput;
  }
  _handleCommandStart(command) {
    if (this._state === 1 /* Input */) {
      return;
    }
    this._state = 1 /* Input */;
    this._commandStartMarker = command.marker;
    this._commandStartX = this._xterm.buffer.active.cursorX;
    this._value = "";
    this._cursorIndex = 0;
    this._onDidStartInput.fire(this._createStateObject());
    this._onDidChangeInput.fire(this._createStateObject());
    if (this._lastPromptLine) {
      if (this._commandStartX !== this._lastPromptLine.length) {
        const line = this._xterm.buffer.active.getLine(this._commandStartMarker.line);
        if (line?.translateToString(true).startsWith(this._lastPromptLine)) {
          this._commandStartX = this._lastPromptLine.length;
          this._sync();
        }
      }
    }
  }
  _handleCommandStartChanged() {
    if (this._state !== 1 /* Input */) {
      return;
    }
    this._commandStartX = this._xterm.buffer.active.cursorX;
    this._onDidChangeInput.fire(this._createStateObject());
    this._sync();
  }
  _handleCommandExecuted() {
    if (this._state === 2 /* Execute */) {
      return;
    }
    this._cursorIndex = -1;
    if (this._ghostTextIndex !== -1) {
      this._value = this._value.substring(0, this._ghostTextIndex);
      this._ghostTextIndex = -1;
    }
    const event = this._createStateObject();
    if (this._lastUserInput === "") {
      this._lastUserInput = "";
      this._onDidInterrupt.fire(event);
    }
    this._state = 2 /* Execute */;
    this._onDidFinishInput.fire(event);
    this._onDidChangeInput.fire(event);
  }
  _sync() {
    try {
      this._doSync();
    } catch (e) {
      this._logService.error("Error while syncing prompt input model", e);
    }
  }
  _doSync() {
    if (this._state !== 1 /* Input */) {
      return;
    }
    let commandStartY = this._commandStartMarker?.line;
    if (commandStartY === void 0) {
      return;
    }
    const buffer = this._xterm.buffer.active;
    let line = buffer.getLine(commandStartY);
    const absoluteCursorY = buffer.baseY + buffer.cursorY;
    let cursorIndex;
    let commandLine = line?.translateToString(true, this._commandStartX);
    if (this._shellType === PosixShellType.Fish && (!line || !commandLine)) {
      commandStartY += 1;
      line = buffer.getLine(commandStartY);
      if (line) {
        commandLine = line.translateToString(true);
        cursorIndex = absoluteCursorY === commandStartY ? buffer.cursorX : commandLine?.trimEnd().length;
      }
    }
    if (line === void 0 || commandLine === void 0) {
      this._logService.trace(`PromptInputModel#_sync: no line`);
      return;
    }
    let value = commandLine;
    let ghostTextIndex = -1;
    if (cursorIndex === void 0) {
      if (absoluteCursorY === commandStartY) {
        cursorIndex = this._getRelativeCursorIndex(this._commandStartX, buffer, line);
      } else {
        cursorIndex = commandLine.trimEnd().length;
      }
    }
    for (let y = commandStartY + 1; y <= absoluteCursorY; y++) {
      const nextLine = buffer.getLine(y);
      const lineText = nextLine?.translateToString(true);
      if (lineText && nextLine) {
        if (nextLine.isWrapped || absoluteCursorY === y && this._continuationPrompt && !this._lineContainsContinuationPrompt(lineText)) {
          value += `${lineText}`;
          const relativeCursorIndex = this._getRelativeCursorIndex(0, buffer, nextLine);
          if (absoluteCursorY === y) {
            cursorIndex += relativeCursorIndex;
          } else {
            cursorIndex += lineText.length;
          }
        } else if (this._shellType === PosixShellType.Fish) {
          if (value.endsWith("\\")) {
            value = value.substring(0, value.length - 1);
            value += `${lineText.trim()}`;
            cursorIndex += lineText.trim().length - 1;
          } else {
            if (/^ {6,}/.test(lineText)) {
              value += `
${lineText.trim()}`;
              cursorIndex += lineText.trim().length + 1;
            } else {
              value += lineText;
              cursorIndex += lineText.length;
            }
          }
        } else if (this._continuationPrompt === void 0 || this._lineContainsContinuationPrompt(lineText)) {
          const trimmedLineText = this._trimContinuationPrompt(lineText);
          value += `
${trimmedLineText}`;
          if (absoluteCursorY === y) {
            const continuationCellWidth = this._getContinuationPromptCellWidth(nextLine, lineText);
            const relativeCursorIndex = this._getRelativeCursorIndex(continuationCellWidth, buffer, nextLine);
            cursorIndex += relativeCursorIndex + 1;
          } else {
            cursorIndex += trimmedLineText.length + 1;
          }
        }
      }
    }
    for (let y = absoluteCursorY + 1; y < buffer.baseY + this._xterm.rows; y++) {
      const belowCursorLine = buffer.getLine(y);
      const lineText = belowCursorLine?.translateToString(true);
      if (lineText && belowCursorLine) {
        if (this._shellType === PosixShellType.Fish) {
          value += `${lineText}`;
        } else if (this._continuationPrompt === void 0 || this._lineContainsContinuationPrompt(lineText)) {
          value += `
${this._trimContinuationPrompt(lineText)}`;
        } else {
          value += lineText;
        }
      } else {
        break;
      }
    }
    if (this._logService.getLevel() === LogLevel.Trace) {
      this._logService.trace(`PromptInputModel#_sync: ${this.getCombinedString()}`);
    }
    {
      let trailingWhitespace = this._value.length - this._value.trimEnd().length;
      if (this._lastUserInput === "\x7F") {
        this._lastUserInput = "";
        if (cursorIndex === this._cursorIndex - 1) {
          if (this._value.trimEnd().length > value.trimEnd().length && value.trimEnd().length <= cursorIndex) {
            trailingWhitespace = Math.max(this._value.length - 1 - value.trimEnd().length, 0);
          } else {
            trailingWhitespace = Math.max(trailingWhitespace - 1, 0);
          }
        }
      }
      if (this._lastUserInput === "\x1B[3~") {
        this._lastUserInput = "";
        if (cursorIndex === this._cursorIndex) {
          trailingWhitespace = Math.max(trailingWhitespace - 1, 0);
        }
      }
      const valueLines = value.split("\n");
      const isMultiLine = valueLines.length > 1;
      const valueEndTrimmed = value.trimEnd();
      if (!isMultiLine) {
        if (valueEndTrimmed.length < value.length) {
          if (this._lastUserInput === " ") {
            this._lastUserInput = "";
            if (cursorIndex > valueEndTrimmed.length && cursorIndex > this._cursorIndex) {
              trailingWhitespace++;
            }
          }
          trailingWhitespace = Math.max(cursorIndex - valueEndTrimmed.length, trailingWhitespace, 0);
        }
        const charBeforeCursor = cursorIndex === 0 ? "" : value[cursorIndex - 1];
        if (trailingWhitespace > 0 && cursorIndex === this._cursorIndex + 1 && this._lastUserInput !== "" && charBeforeCursor !== " ") {
          trailingWhitespace = this._value.length - this._cursorIndex;
        }
      }
      if (isMultiLine) {
        valueLines[valueLines.length - 1] = valueLines.at(-1)?.trimEnd() ?? "";
        const continuationOffset = (valueLines.length - 1) * (this._continuationPrompt?.length ?? 0);
        trailingWhitespace = Math.max(0, cursorIndex - value.length - continuationOffset);
      }
      value = valueLines.map((e) => e.trimEnd()).join("\n") + " ".repeat(trailingWhitespace);
    }
    ghostTextIndex = this._scanForGhostText(buffer, line, cursorIndex);
    if (this._value !== value || this._cursorIndex !== cursorIndex || this._ghostTextIndex !== ghostTextIndex) {
      this._value = value;
      this._cursorIndex = cursorIndex;
      this._ghostTextIndex = ghostTextIndex;
      this._onDidChangeInput.fire(this._createStateObject());
    }
  }
  _handleUserInput(e) {
    this._lastUserInput = e;
  }
  /**
   * Detect ghost text by looking for italic or dim text in or after the cursor and
   * non-italic/dim text in the first non-whitespace cell following command start and before the cursor.
   */
  _scanForGhostText(buffer, line, cursorIndex) {
    if (!this.value.trim().length) {
      return -1;
    }
    let ghostTextIndex = -1;
    let proceedWithGhostTextCheck = false;
    let x = buffer.cursorX;
    while (x > 0) {
      const cell = line.getCell(--x);
      if (!cell) {
        break;
      }
      if (cell.getChars().trim().length > 0) {
        proceedWithGhostTextCheck = !this._isCellStyledLikeGhostText(cell);
        break;
      }
    }
    if (proceedWithGhostTextCheck) {
      let potentialGhostIndexOffset = 0;
      let x2 = buffer.cursorX;
      while (x2 < line.length) {
        const cell = line.getCell(x2++);
        if (!cell || cell.getCode() === 0) {
          break;
        }
        if (this._isCellStyledLikeGhostText(cell)) {
          ghostTextIndex = cursorIndex + potentialGhostIndexOffset;
          break;
        }
        potentialGhostIndexOffset += cell.getChars().length;
      }
    }
    if (ghostTextIndex === -1) {
      ghostTextIndex = this._scanForGhostTextAdvanced(buffer, line, cursorIndex);
    }
    if (ghostTextIndex > -1 && this.value.substring(ghostTextIndex).endsWith(" ")) {
      this._value = this.value.trim();
      if (!this.value.substring(ghostTextIndex)) {
        ghostTextIndex = -1;
      }
    }
    return ghostTextIndex;
  }
  _scanForGhostTextAdvanced(buffer, line, cursorIndex) {
    let ghostTextIndex = -1;
    let currentPos = buffer.cursorX;
    const styleMap = /* @__PURE__ */ new Map();
    let lastNonWhitespaceCell = line.getCell(currentPos);
    let nextCell = lastNonWhitespaceCell;
    while (nextCell && currentPos < line.length) {
      const styleKey = this._getCellStyleAsString(nextCell);
      styleMap.set(styleKey, [...styleMap.get(styleKey) ?? [], currentPos]);
      nextCell = line.getCell(++currentPos);
      if (nextCell?.getChars().trim().length) {
        lastNonWhitespaceCell = nextCell;
      }
    }
    if (!lastNonWhitespaceCell?.getChars().trim().length || this._cellStylesMatch(line.getCell(this._commandStartX), lastNonWhitespaceCell)) {
      return -1;
    }
    const positionsWithGhostStyle = styleMap.get(this._getCellStyleAsString(lastNonWhitespaceCell));
    if (positionsWithGhostStyle) {
      for (let i = 1; i < positionsWithGhostStyle.length; i++) {
        if (positionsWithGhostStyle[i] !== positionsWithGhostStyle[i - 1] + 1) {
          return -1;
        }
      }
      if (buffer.baseY + buffer.cursorY === this._commandStartMarker?.line) {
        ghostTextIndex = positionsWithGhostStyle[0] - this._commandStartX;
      } else {
        ghostTextIndex = positionsWithGhostStyle[0];
      }
    }
    if (ghostTextIndex !== -1) {
      for (let checkPos = buffer.cursorX; checkPos >= this._commandStartX; checkPos--) {
        const checkCell = line.getCell(checkPos);
        if (!checkCell?.getChars.length) {
          continue;
        }
        if (checkCell && checkCell.getCode() !== 0 && this._cellStylesMatch(lastNonWhitespaceCell, checkCell)) {
          return -1;
        }
      }
    }
    return ghostTextIndex >= cursorIndex ? ghostTextIndex : -1;
  }
  _getCellStyleAsString(cell) {
    return `${cell.getFgColor()}${cell.getBgColor()}${cell.isBold()}${cell.isItalic()}${cell.isDim()}${cell.isUnderline()}${cell.isBlink()}${cell.isInverse()}${cell.isInvisible()}${cell.isStrikethrough()}${cell.isOverline()}${cell.getFgColorMode()}${cell.getBgColorMode()}`;
  }
  _cellStylesMatch(a, b) {
    if (!a || !b) {
      return false;
    }
    return a.getFgColor() === b.getFgColor() && a.getBgColor() === b.getBgColor() && a.isBold() === b.isBold() && a.isItalic() === b.isItalic() && a.isDim() === b.isDim() && a.isUnderline() === b.isUnderline() && a.isBlink() === b.isBlink() && a.isInverse() === b.isInverse() && a.isInvisible() === b.isInvisible() && a.isStrikethrough() === b.isStrikethrough() && a.isOverline() === b.isOverline() && a?.getBgColorMode() === b?.getBgColorMode() && a?.getFgColorMode() === b?.getFgColorMode();
  }
  _trimContinuationPrompt(lineText) {
    if (this._lineContainsContinuationPrompt(lineText)) {
      lineText = lineText.substring(this._continuationPrompt.length);
    }
    return lineText;
  }
  _lineContainsContinuationPrompt(lineText) {
    return !!(this._continuationPrompt && lineText.startsWith(this._continuationPrompt.trimEnd()));
  }
  _getContinuationPromptCellWidth(line, lineText) {
    if (!this._continuationPrompt || !lineText.startsWith(this._continuationPrompt.trimEnd())) {
      return 0;
    }
    let buffer = "";
    let x = 0;
    let cell;
    while (buffer !== this._continuationPrompt) {
      cell = line.getCell(x++);
      if (!cell) {
        break;
      }
      buffer += cell.getChars();
    }
    return x;
  }
  _getRelativeCursorIndex(startCellX, buffer, line) {
    return line?.translateToString(true, startCellX, buffer.cursorX).length ?? 0;
  }
  _isCellStyledLikeGhostText(cell) {
    return !!(cell.isItalic() || cell.isDim());
  }
  _createStateObject() {
    return Object.freeze({
      value: this._value,
      prefix: this.prefix,
      suffix: this.suffix,
      cursorIndex: this._cursorIndex,
      ghostTextIndex: this._ghostTextIndex
    });
  }
};
__decorateClass([
  throttle(0)
], PromptInputModel.prototype, "_sync", 1);
PromptInputModel = __decorateClass([
  __decorateParam(4, ILogService)
], PromptInputModel);
export {
  PromptInputModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb24vcHJvbXB0SW5wdXRNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTG9nTGV2ZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgdHlwZSB7IElUZXJtaW5hbENvbW1hbmQgfSBmcm9tICcuLi9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgdGhyb3R0bGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcblxuaW1wb3J0IHR5cGUgeyBUZXJtaW5hbCwgSU1hcmtlciwgSUJ1ZmZlckNlbGwsIElCdWZmZXJMaW5lLCBJQnVmZmVyIH0gZnJvbSAnQHh0ZXJtL2hlYWRsZXNzJztcbmltcG9ydCB7IFBvc2l4U2hlbGxUeXBlLCBUZXJtaW5hbFNoZWxsVHlwZSB9IGZyb20gJy4uLy4uL3Rlcm1pbmFsLmpzJztcblxuY29uc3QgZW51bSBQcm9tcHRJbnB1dFN0YXRlIHtcblx0VW5rbm93biA9IDAsXG5cdElucHV0ID0gMSxcblx0RXhlY3V0ZSA9IDIsXG59XG5cbi8qKlxuICogQSBtb2RlbCBvZiB0aGUgcHJvbXB0IGlucHV0IHN0YXRlIHVzaW5nIHNoZWxsIGludGVncmF0aW9uIGFuZCBhbmFseXppbmcgdGhlIHRlcm1pbmFsIGJ1ZmZlci4gVGhpc1xuICogbWF5IG5vdCBiZSAxMDAlIGFjY3VyYXRlIGJ1dCBwcm92aWRlcyBhIGJlc3QgZ3Vlc3MuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVByb21wdElucHV0TW9kZWwgZXh0ZW5kcyBJUHJvbXB0SW5wdXRNb2RlbFN0YXRlIHtcblx0cmVhZG9ubHkgb25EaWRTdGFydElucHV0OiBFdmVudDxJUHJvbXB0SW5wdXRNb2RlbFN0YXRlPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VJbnB1dDogRXZlbnQ8SVByb21wdElucHV0TW9kZWxTdGF0ZT47XG5cdHJlYWRvbmx5IG9uRGlkRmluaXNoSW5wdXQ6IEV2ZW50PElQcm9tcHRJbnB1dE1vZGVsU3RhdGU+O1xuXHQvKipcblx0ICogRmlyZXMgaW1tZWRpYXRlbHkgYmVmb3JlIHtAbGluayBvbkRpZEZpbmlzaElucHV0fSB3aGVuIGEgU0lHSU5UL0N0cmwrQy9eQyBpcyBkZXRlY3RlZC5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkSW50ZXJydXB0OiBFdmVudDxJUHJvbXB0SW5wdXRNb2RlbFN0YXRlPjtcblxuXHQvKipcblx0ICogR2V0cyB0aGUgcHJvbXB0IGlucHV0IGFzIGEgdXNlci1mcmllbmRseSBzdHJpbmcgd2hlcmUgYHxgIGlzIHRoZSBjdXJzb3IgcG9zaXRpb24gYW5kIGBbYCBhbmRcblx0ICogYF1gIHdyYXAgYW55IGdob3N0IHRleHQuXG5cdCAqXG5cdCAqIEBwYXJhbSBlbXB0eVN0cmluZ1doZW5FbXB0eSBJZiB0cnVlLCBhbiBlbXB0eSBzdHJpbmcgaXMgcmV0dXJuZWQgd2hlbiB0aGUgcHJvbXB0IGlucHV0IGlzXG5cdCAqIGVtcHR5IChhcyBvcHBvc2VkIHRvICd8JykuXG5cdCAqL1xuXHRnZXRDb21iaW5lZFN0cmluZyhlbXB0eVN0cmluZ1doZW5FbXB0eT86IGJvb2xlYW4pOiBzdHJpbmc7XG5cblx0c2V0U2hlbGxUeXBlKHNoZWxsVHlwZT86IFRlcm1pbmFsU2hlbGxUeXBlKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJvbXB0SW5wdXRNb2RlbFN0YXRlIHtcblx0LyoqXG5cdCAqIFRoZSBmdWxsIHByb21wdCBpbnB1dCBpbmNsdWRlIGdob3N0IHRleHQuXG5cdCAqL1xuXHRyZWFkb25seSB2YWx1ZTogc3RyaW5nO1xuXHQvKipcblx0ICogVGhlIHByb21wdCBpbnB1dCB1cCB0byB0aGUgY3Vyc29yIGluZGV4LCB0aGlzIHdpbGwgYWx3YXlzIGV4Y2x1ZGUgdGhlIGdob3N0IHRleHQuXG5cdCAqL1xuXHRyZWFkb25seSBwcmVmaXg6IHN0cmluZztcblx0LyoqXG5cdCAqIFRoZSBwcm9tcHQgaW5wdXQgZnJvbSB0aGUgY3Vyc29yIHRvIHRoZSBlbmQsIHRoaXMgX2RvZXMgbm90XyBpbmNsdWRlIGdob3N0IHRleHQuXG5cdCAqL1xuXHRyZWFkb25seSBzdWZmaXg6IHN0cmluZztcblx0LyoqXG5cdCAqIFRoZSBpbmRleCBvZiB0aGUgY3Vyc29yIGluIHtAbGluayB2YWx1ZX0uXG5cdCAqL1xuXHRyZWFkb25seSBjdXJzb3JJbmRleDogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIGluZGV4IG9mIHRoZSBzdGFydCBvZiBnaG9zdCB0ZXh0IGluIHtAbGluayB2YWx1ZX0uIFRoaXMgaXMgLTEgd2hlbiB0aGVyZSBpcyBubyBnaG9zdFxuXHQgKiB0ZXh0LlxuXHQgKi9cblx0cmVhZG9ubHkgZ2hvc3RUZXh0SW5kZXg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2VyaWFsaXplZFByb21wdElucHV0TW9kZWwge1xuXHRyZWFkb25seSBtb2RlbFN0YXRlOiBJUHJvbXB0SW5wdXRNb2RlbFN0YXRlO1xuXHRyZWFkb25seSBjb21tYW5kU3RhcnRYOiBudW1iZXI7XG5cdHJlYWRvbmx5IGxhc3RQcm9tcHRMaW5lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNvbnRpbnVhdGlvblByb21wdDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBsYXN0VXNlcklucHV0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBQcm9tcHRJbnB1dE1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElQcm9tcHRJbnB1dE1vZGVsIHtcblx0cHJpdmF0ZSBfc3RhdGU6IFByb21wdElucHV0U3RhdGUgPSBQcm9tcHRJbnB1dFN0YXRlLlVua25vd247XG5cblx0cHJpdmF0ZSBfY29tbWFuZFN0YXJ0TWFya2VyOiBJTWFya2VyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jb21tYW5kU3RhcnRYOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9sYXN0UHJvbXB0TGluZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jb250aW51YXRpb25Qcm9tcHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9sYXN0VXNlcklucHV0OiBzdHJpbmcgPSAnJztcblxuXHRwcml2YXRlIF92YWx1ZTogc3RyaW5nID0gJyc7XG5cdGdldCB2YWx1ZSgpIHsgcmV0dXJuIHRoaXMuX3ZhbHVlOyB9XG5cdGdldCBwcmVmaXgoKSB7IHJldHVybiB0aGlzLl92YWx1ZS5zdWJzdHJpbmcoMCwgdGhpcy5fY3Vyc29ySW5kZXgpOyB9XG5cdGdldCBzdWZmaXgoKSB7IHJldHVybiB0aGlzLl92YWx1ZS5zdWJzdHJpbmcodGhpcy5fY3Vyc29ySW5kZXgsIHRoaXMuX2dob3N0VGV4dEluZGV4ID09PSAtMSA/IHVuZGVmaW5lZCA6IHRoaXMuX2dob3N0VGV4dEluZGV4KTsgfVxuXG5cdHByaXZhdGUgX2N1cnNvckluZGV4OiBudW1iZXIgPSAwO1xuXHRnZXQgY3Vyc29ySW5kZXgoKSB7IHJldHVybiB0aGlzLl9jdXJzb3JJbmRleDsgfVxuXG5cdHByaXZhdGUgX2dob3N0VGV4dEluZGV4OiBudW1iZXIgPSAtMTtcblx0Z2V0IGdob3N0VGV4dEluZGV4KCkgeyByZXR1cm4gdGhpcy5fZ2hvc3RUZXh0SW5kZXg7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFN0YXJ0SW5wdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvbXB0SW5wdXRNb2RlbFN0YXRlPigpKTtcblx0cmVhZG9ubHkgb25EaWRTdGFydElucHV0ID0gdGhpcy5fb25EaWRTdGFydElucHV0LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUlucHV0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVByb21wdElucHV0TW9kZWxTdGF0ZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlSW5wdXQgPSB0aGlzLl9vbkRpZENoYW5nZUlucHV0LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZpbmlzaElucHV0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVByb21wdElucHV0TW9kZWxTdGF0ZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRmluaXNoSW5wdXQgPSB0aGlzLl9vbkRpZEZpbmlzaElucHV0LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEludGVycnVwdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElQcm9tcHRJbnB1dE1vZGVsU3RhdGU+KCkpO1xuXHRyZWFkb25seSBvbkRpZEludGVycnVwdCA9IHRoaXMuX29uRGlkSW50ZXJydXB0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3h0ZXJtOiBUZXJtaW5hbCxcblx0XHRvbkNvbW1hbmRTdGFydDogRXZlbnQ8SVRlcm1pbmFsQ29tbWFuZD4sXG5cdFx0b25Db21tYW5kU3RhcnRDaGFuZ2VkOiBFdmVudDx2b2lkPixcblx0XHRvbkNvbW1hbmRFeGVjdXRlZDogRXZlbnQ8SVRlcm1pbmFsQ29tbWFuZD4sXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkoXG5cdFx0XHR0aGlzLl94dGVybS5vbkN1cnNvck1vdmUsXG5cdFx0XHR0aGlzLl94dGVybS5vbkRhdGEsXG5cdFx0XHR0aGlzLl94dGVybS5vbldyaXRlUGFyc2VkLFxuXHRcdCkoKCkgPT4gdGhpcy5fc3luYygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5feHRlcm0ub25EYXRhKGUgPT4gdGhpcy5faGFuZGxlVXNlcklucHV0KGUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihvbkNvbW1hbmRTdGFydChlID0+IHRoaXMuX2hhbmRsZUNvbW1hbmRTdGFydChlIGFzIHsgbWFya2VyOiBJTWFya2VyIH0pKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob25Db21tYW5kU3RhcnRDaGFuZ2VkKCgpID0+IHRoaXMuX2hhbmRsZUNvbW1hbmRTdGFydENoYW5nZWQoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uQ29tbWFuZEV4ZWN1dGVkKCgpID0+IHRoaXMuX2hhbmRsZUNvbW1hbmRFeGVjdXRlZCgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkU3RhcnRJbnB1dCgoKSA9PiB0aGlzLl9sb2dDb21iaW5lZFN0cmluZ0lmVHJhY2UoJ1Byb21wdElucHV0TW9kZWwjb25EaWRTdGFydElucHV0JykpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlSW5wdXQoKCkgPT4gdGhpcy5fbG9nQ29tYmluZWRTdHJpbmdJZlRyYWNlKCdQcm9tcHRJbnB1dE1vZGVsI29uRGlkQ2hhbmdlSW5wdXQnKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRGaW5pc2hJbnB1dCgoKSA9PiB0aGlzLl9sb2dDb21iaW5lZFN0cmluZ0lmVHJhY2UoJ1Byb21wdElucHV0TW9kZWwjb25EaWRGaW5pc2hJbnB1dCcpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZEludGVycnVwdCgoKSA9PiB0aGlzLl9sb2dDb21iaW5lZFN0cmluZ0lmVHJhY2UoJ1Byb21wdElucHV0TW9kZWwjb25EaWRJbnRlcnJ1cHQnKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9nQ29tYmluZWRTdHJpbmdJZlRyYWNlKG1lc3NhZ2U6IHN0cmluZykge1xuXHRcdC8vIE9ubHkgZ2VuZXJhdGUgdGhlIGNvbWJpbmVkIHN0cmluZyBpZiB0cmFjZVxuXHRcdGlmICh0aGlzLl9sb2dTZXJ2aWNlLmdldExldmVsKCkgPT09IExvZ0xldmVsLlRyYWNlKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKG1lc3NhZ2UsIHRoaXMuZ2V0Q29tYmluZWRTdHJpbmcoKSk7XG5cdFx0fVxuXHR9XG5cblx0c2V0U2hlbGxUeXBlKHNoZWxsVHlwZTogVGVybWluYWxTaGVsbFR5cGUpOiB2b2lkIHtcblx0XHR0aGlzLl9zaGVsbFR5cGUgPSBzaGVsbFR5cGU7XG5cdH1cblxuXHRzZXRDb250aW51YXRpb25Qcm9tcHQodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRpbnVhdGlvblByb21wdCA9IHZhbHVlO1xuXHRcdHRoaXMuX3N5bmMoKTtcblx0fVxuXG5cdHNldExhc3RQcm9tcHRMaW5lKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9sYXN0UHJvbXB0TGluZSA9IHZhbHVlO1xuXHRcdHRoaXMuX3N5bmMoKTtcblx0fVxuXG5cdHNldENvbmZpZGVudENvbW1hbmRMaW5lKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fdmFsdWUgIT09IHZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5fY3Vyc29ySW5kZXggPSAtMTtcblx0XHRcdHRoaXMuX2dob3N0VGV4dEluZGV4ID0gLTE7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUlucHV0LmZpcmUodGhpcy5fY3JlYXRlU3RhdGVPYmplY3QoKSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0Q29tYmluZWRTdHJpbmcoZW1wdHlTdHJpbmdXaGVuRW1wdHk/OiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuX3ZhbHVlLnJlcGxhY2VBbGwoJ1xcbicsICdcXHUyM0NFJyk7XG5cdFx0aWYgKHRoaXMuX2N1cnNvckluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblx0XHRsZXQgcmVzdWx0ID0gYCR7dmFsdWUuc3Vic3RyaW5nKDAsIHRoaXMuY3Vyc29ySW5kZXgpfXxgO1xuXHRcdGlmICh0aGlzLmdob3N0VGV4dEluZGV4ICE9PSAtMSkge1xuXHRcdFx0cmVzdWx0ICs9IGAke3ZhbHVlLnN1YnN0cmluZyh0aGlzLmN1cnNvckluZGV4LCB0aGlzLmdob3N0VGV4dEluZGV4KX1bYDtcblx0XHRcdHJlc3VsdCArPSBgJHt2YWx1ZS5zdWJzdHJpbmcodGhpcy5naG9zdFRleHRJbmRleCl9XWA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdCArPSB2YWx1ZS5zdWJzdHJpbmcodGhpcy5jdXJzb3JJbmRleCk7XG5cdFx0fVxuXHRcdGlmIChyZXN1bHQgPT09ICd8JyAmJiBlbXB0eVN0cmluZ1doZW5FbXB0eSkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0c2VyaWFsaXplKCk6IElTZXJpYWxpemVkUHJvbXB0SW5wdXRNb2RlbCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG1vZGVsU3RhdGU6IHRoaXMuX2NyZWF0ZVN0YXRlT2JqZWN0KCksXG5cdFx0XHRjb21tYW5kU3RhcnRYOiB0aGlzLl9jb21tYW5kU3RhcnRYLFxuXHRcdFx0bGFzdFByb21wdExpbmU6IHRoaXMuX2xhc3RQcm9tcHRMaW5lLFxuXHRcdFx0Y29udGludWF0aW9uUHJvbXB0OiB0aGlzLl9jb250aW51YXRpb25Qcm9tcHQsXG5cdFx0XHRsYXN0VXNlcklucHV0OiB0aGlzLl9sYXN0VXNlcklucHV0XG5cdFx0fTtcblx0fVxuXG5cdGRlc2VyaWFsaXplKHNlcmlhbGl6ZWQ6IElTZXJpYWxpemVkUHJvbXB0SW5wdXRNb2RlbCk6IHZvaWQge1xuXHRcdHRoaXMuX3ZhbHVlID0gc2VyaWFsaXplZC5tb2RlbFN0YXRlLnZhbHVlO1xuXHRcdHRoaXMuX2N1cnNvckluZGV4ID0gc2VyaWFsaXplZC5tb2RlbFN0YXRlLmN1cnNvckluZGV4O1xuXHRcdHRoaXMuX2dob3N0VGV4dEluZGV4ID0gc2VyaWFsaXplZC5tb2RlbFN0YXRlLmdob3N0VGV4dEluZGV4O1xuXHRcdHRoaXMuX2NvbW1hbmRTdGFydFggPSBzZXJpYWxpemVkLmNvbW1hbmRTdGFydFg7XG5cdFx0dGhpcy5fbGFzdFByb21wdExpbmUgPSBzZXJpYWxpemVkLmxhc3RQcm9tcHRMaW5lO1xuXHRcdHRoaXMuX2NvbnRpbnVhdGlvblByb21wdCA9IHNlcmlhbGl6ZWQuY29udGludWF0aW9uUHJvbXB0O1xuXHRcdHRoaXMuX2xhc3RVc2VySW5wdXQgPSBzZXJpYWxpemVkLmxhc3RVc2VySW5wdXQ7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVDb21tYW5kU3RhcnQoY29tbWFuZDogeyBtYXJrZXI6IElNYXJrZXIgfSkge1xuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gUHJvbXB0SW5wdXRTdGF0ZS5JbnB1dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3N0YXRlID0gUHJvbXB0SW5wdXRTdGF0ZS5JbnB1dDtcblx0XHR0aGlzLl9jb21tYW5kU3RhcnRNYXJrZXIgPSBjb21tYW5kLm1hcmtlcjtcblx0XHR0aGlzLl9jb21tYW5kU3RhcnRYID0gdGhpcy5feHRlcm0uYnVmZmVyLmFjdGl2ZS5jdXJzb3JYO1xuXHRcdHRoaXMuX3ZhbHVlID0gJyc7XG5cdFx0dGhpcy5fY3Vyc29ySW5kZXggPSAwO1xuXHRcdHRoaXMuX29uRGlkU3RhcnRJbnB1dC5maXJlKHRoaXMuX2NyZWF0ZVN0YXRlT2JqZWN0KCkpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlSW5wdXQuZmlyZSh0aGlzLl9jcmVhdGVTdGF0ZU9iamVjdCgpKTtcblxuXHRcdC8vIFRyaWdnZXIgYSBzeW5jIGlmIHByb21wdCB0ZXJtaW5hdG9yIGlzIHNldCBhcyB0aGF0IGNvdWxkIGFkanVzdCB0aGUgY29tbWFuZCBzdGFydCBYXG5cdFx0aWYgKHRoaXMuX2xhc3RQcm9tcHRMaW5lKSB7XG5cdFx0XHRpZiAodGhpcy5fY29tbWFuZFN0YXJ0WCAhPT0gdGhpcy5fbGFzdFByb21wdExpbmUubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLl94dGVybS5idWZmZXIuYWN0aXZlLmdldExpbmUodGhpcy5fY29tbWFuZFN0YXJ0TWFya2VyLmxpbmUpO1xuXHRcdFx0XHRpZiAobGluZT8udHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSkuc3RhcnRzV2l0aCh0aGlzLl9sYXN0UHJvbXB0TGluZSkpIHtcblx0XHRcdFx0XHR0aGlzLl9jb21tYW5kU3RhcnRYID0gdGhpcy5fbGFzdFByb21wdExpbmUubGVuZ3RoO1xuXHRcdFx0XHRcdHRoaXMuX3N5bmMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZUNvbW1hbmRTdGFydENoYW5nZWQoKSB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlICE9PSBQcm9tcHRJbnB1dFN0YXRlLklucHV0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29tbWFuZFN0YXJ0WCA9IHRoaXMuX3h0ZXJtLmJ1ZmZlci5hY3RpdmUuY3Vyc29yWDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUlucHV0LmZpcmUodGhpcy5fY3JlYXRlU3RhdGVPYmplY3QoKSk7XG5cdFx0dGhpcy5fc3luYygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlQ29tbWFuZEV4ZWN1dGVkKCkge1xuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gUHJvbXB0SW5wdXRTdGF0ZS5FeGVjdXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3Vyc29ySW5kZXggPSAtMTtcblxuXHRcdC8vIFJlbW92ZSBhbnkgZ2hvc3QgdGV4dCBmcm9tIHRoZSBpbnB1dCBpZiBpdCBleGlzdHMgb24gZXhlY3V0ZVxuXHRcdGlmICh0aGlzLl9naG9zdFRleHRJbmRleCAhPT0gLTEpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdGhpcy5fdmFsdWUuc3Vic3RyaW5nKDAsIHRoaXMuX2dob3N0VGV4dEluZGV4KTtcblx0XHRcdHRoaXMuX2dob3N0VGV4dEluZGV4ID0gLTE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXZlbnQgPSB0aGlzLl9jcmVhdGVTdGF0ZU9iamVjdCgpO1xuXHRcdGlmICh0aGlzLl9sYXN0VXNlcklucHV0ID09PSAnXFx1MDAwMycpIHtcblx0XHRcdHRoaXMuX2xhc3RVc2VySW5wdXQgPSAnJztcblx0XHRcdHRoaXMuX29uRGlkSW50ZXJydXB0LmZpcmUoZXZlbnQpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3N0YXRlID0gUHJvbXB0SW5wdXRTdGF0ZS5FeGVjdXRlO1xuXHRcdHRoaXMuX29uRGlkRmluaXNoSW5wdXQuZmlyZShldmVudCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VJbnB1dC5maXJlKGV2ZW50KTtcblx0fVxuXG5cdEB0aHJvdHRsZSgwKVxuXHRwcml2YXRlIF9zeW5jKCkge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9kb1N5bmMoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKCdFcnJvciB3aGlsZSBzeW5jaW5nIHByb21wdCBpbnB1dCBtb2RlbCcsIGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2RvU3luYygpIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgIT09IFByb21wdElucHV0U3RhdGUuSW5wdXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgY29tbWFuZFN0YXJ0WSA9IHRoaXMuX2NvbW1hbmRTdGFydE1hcmtlcj8ubGluZTtcblx0XHRpZiAoY29tbWFuZFN0YXJ0WSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYnVmZmVyID0gdGhpcy5feHRlcm0uYnVmZmVyLmFjdGl2ZTtcblx0XHRsZXQgbGluZSA9IGJ1ZmZlci5nZXRMaW5lKGNvbW1hbmRTdGFydFkpO1xuXHRcdGNvbnN0IGFic29sdXRlQ3Vyc29yWSA9IGJ1ZmZlci5iYXNlWSArIGJ1ZmZlci5jdXJzb3JZO1xuXHRcdGxldCBjdXJzb3JJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0bGV0IGNvbW1hbmRMaW5lID0gbGluZT8udHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSwgdGhpcy5fY29tbWFuZFN0YXJ0WCk7XG5cdFx0aWYgKHRoaXMuX3NoZWxsVHlwZSA9PT0gUG9zaXhTaGVsbFR5cGUuRmlzaCAmJiAoIWxpbmUgfHwgIWNvbW1hbmRMaW5lKSkge1xuXHRcdFx0Y29tbWFuZFN0YXJ0WSArPSAxO1xuXHRcdFx0bGluZSA9IGJ1ZmZlci5nZXRMaW5lKGNvbW1hbmRTdGFydFkpO1xuXHRcdFx0aWYgKGxpbmUpIHtcblx0XHRcdFx0Y29tbWFuZExpbmUgPSBsaW5lLnRyYW5zbGF0ZVRvU3RyaW5nKHRydWUpO1xuXHRcdFx0XHRjdXJzb3JJbmRleCA9IGFic29sdXRlQ3Vyc29yWSA9PT0gY29tbWFuZFN0YXJ0WSA/IGJ1ZmZlci5jdXJzb3JYIDogY29tbWFuZExpbmU/LnRyaW1FbmQoKS5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChsaW5lID09PSB1bmRlZmluZWQgfHwgY29tbWFuZExpbmUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgUHJvbXB0SW5wdXRNb2RlbCNfc3luYzogbm8gbGluZWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCB2YWx1ZSA9IGNvbW1hbmRMaW5lO1xuXHRcdGxldCBnaG9zdFRleHRJbmRleCA9IC0xO1xuXHRcdGlmIChjdXJzb3JJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpZiAoYWJzb2x1dGVDdXJzb3JZID09PSBjb21tYW5kU3RhcnRZKSB7XG5cdFx0XHRcdGN1cnNvckluZGV4ID0gdGhpcy5fZ2V0UmVsYXRpdmVDdXJzb3JJbmRleCh0aGlzLl9jb21tYW5kU3RhcnRYLCBidWZmZXIsIGxpbmUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y3Vyc29ySW5kZXggPSBjb21tYW5kTGluZS50cmltRW5kKCkubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZyb20gY29tbWFuZCBzdGFydCBsaW5lIHRvIGN1cnNvciBsaW5lXG5cdFx0Zm9yIChsZXQgeSA9IGNvbW1hbmRTdGFydFkgKyAxOyB5IDw9IGFic29sdXRlQ3Vyc29yWTsgeSsrKSB7XG5cdFx0XHRjb25zdCBuZXh0TGluZSA9IGJ1ZmZlci5nZXRMaW5lKHkpO1xuXHRcdFx0Y29uc3QgbGluZVRleHQgPSBuZXh0TGluZT8udHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSk7XG5cdFx0XHRpZiAobGluZVRleHQgJiYgbmV4dExpbmUpIHtcblx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGxpbmUgd3JhcHBlZCB3aXRob3V0IGEgbmV3IGxpbmUgKGNvbnRpbnVhdGlvbikgb3Jcblx0XHRcdFx0Ly8gd2UncmUgb24gdGhlIGxhc3QgbGluZSBhbmQgdGhlIGNvbnRpbnVhdGlvbiBwcm9tcHQgaXMgbm90IHByZXNlbnQsIHNvIHdlIG5lZWQgdG8gYWRkIHRoZSB2YWx1ZVxuXHRcdFx0XHRpZiAobmV4dExpbmUuaXNXcmFwcGVkIHx8IChhYnNvbHV0ZUN1cnNvclkgPT09IHkgJiYgdGhpcy5fY29udGludWF0aW9uUHJvbXB0ICYmICF0aGlzLl9saW5lQ29udGFpbnNDb250aW51YXRpb25Qcm9tcHQobGluZVRleHQpKSkge1xuXHRcdFx0XHRcdHZhbHVlICs9IGAke2xpbmVUZXh0fWA7XG5cdFx0XHRcdFx0Y29uc3QgcmVsYXRpdmVDdXJzb3JJbmRleCA9IHRoaXMuX2dldFJlbGF0aXZlQ3Vyc29ySW5kZXgoMCwgYnVmZmVyLCBuZXh0TGluZSk7XG5cdFx0XHRcdFx0aWYgKGFic29sdXRlQ3Vyc29yWSA9PT0geSkge1xuXHRcdFx0XHRcdFx0Y3Vyc29ySW5kZXggKz0gcmVsYXRpdmVDdXJzb3JJbmRleDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y3Vyc29ySW5kZXggKz0gbGluZVRleHQubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLl9zaGVsbFR5cGUgPT09IFBvc2l4U2hlbGxUeXBlLkZpc2gpIHtcblx0XHRcdFx0XHRpZiAodmFsdWUuZW5kc1dpdGgoJ1xcXFwnKSkge1xuXHRcdFx0XHRcdFx0Ly8gVHJpbSBvZmYgdGhlIHRyYWlsaW5nIGJhY2tzbGFzaFxuXHRcdFx0XHRcdFx0dmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMCwgdmFsdWUubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdFx0XHR2YWx1ZSArPSBgJHtsaW5lVGV4dC50cmltKCl9YDtcblx0XHRcdFx0XHRcdGN1cnNvckluZGV4ICs9IGxpbmVUZXh0LnRyaW0oKS5sZW5ndGggLSAxO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoL14gezYsfS8udGVzdChsaW5lVGV4dCkpIHtcblx0XHRcdFx0XHRcdFx0Ly8gV2FzIGxpa2VseSBhIG5ldyBsaW5lXG5cdFx0XHRcdFx0XHRcdHZhbHVlICs9IGBcXG4ke2xpbmVUZXh0LnRyaW0oKX1gO1xuXHRcdFx0XHRcdFx0XHRjdXJzb3JJbmRleCArPSBsaW5lVGV4dC50cmltKCkubGVuZ3RoICsgMTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlICs9IGxpbmVUZXh0O1xuXHRcdFx0XHRcdFx0XHRjdXJzb3JJbmRleCArPSBsaW5lVGV4dC5sZW5ndGg7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFZlcmlmeSBjb250aW51YXRpb24gcHJvbXB0IGlmIHdlIGhhdmUgaXQsIGlmIHRoaXMgbGluZSBkb2Vzbid0IGhhdmUgaXQgdGhlbiB0aGVcblx0XHRcdFx0Ly8gdXNlciBsaWtlbHkganVzdCBwcmVzc2VkIGVudGVyLlxuXHRcdFx0XHRlbHNlIGlmICh0aGlzLl9jb250aW51YXRpb25Qcm9tcHQgPT09IHVuZGVmaW5lZCB8fCB0aGlzLl9saW5lQ29udGFpbnNDb250aW51YXRpb25Qcm9tcHQobGluZVRleHQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgdHJpbW1lZExpbmVUZXh0ID0gdGhpcy5fdHJpbUNvbnRpbnVhdGlvblByb21wdChsaW5lVGV4dCk7XG5cdFx0XHRcdFx0dmFsdWUgKz0gYFxcbiR7dHJpbW1lZExpbmVUZXh0fWA7XG5cdFx0XHRcdFx0aWYgKGFic29sdXRlQ3Vyc29yWSA9PT0geSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY29udGludWF0aW9uQ2VsbFdpZHRoID0gdGhpcy5fZ2V0Q29udGludWF0aW9uUHJvbXB0Q2VsbFdpZHRoKG5leHRMaW5lLCBsaW5lVGV4dCk7XG5cdFx0XHRcdFx0XHRjb25zdCByZWxhdGl2ZUN1cnNvckluZGV4ID0gdGhpcy5fZ2V0UmVsYXRpdmVDdXJzb3JJbmRleChjb250aW51YXRpb25DZWxsV2lkdGgsIGJ1ZmZlciwgbmV4dExpbmUpO1xuXHRcdFx0XHRcdFx0Y3Vyc29ySW5kZXggKz0gcmVsYXRpdmVDdXJzb3JJbmRleCArIDE7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGN1cnNvckluZGV4ICs9IHRyaW1tZWRMaW5lVGV4dC5sZW5ndGggKyAxO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEJlbG93IGN1cnNvciBsaW5lXG5cdFx0Zm9yIChsZXQgeSA9IGFic29sdXRlQ3Vyc29yWSArIDE7IHkgPCBidWZmZXIuYmFzZVkgKyB0aGlzLl94dGVybS5yb3dzOyB5KyspIHtcblx0XHRcdGNvbnN0IGJlbG93Q3Vyc29yTGluZSA9IGJ1ZmZlci5nZXRMaW5lKHkpO1xuXHRcdFx0Y29uc3QgbGluZVRleHQgPSBiZWxvd0N1cnNvckxpbmU/LnRyYW5zbGF0ZVRvU3RyaW5nKHRydWUpO1xuXHRcdFx0aWYgKGxpbmVUZXh0ICYmIGJlbG93Q3Vyc29yTGluZSkge1xuXHRcdFx0XHRpZiAodGhpcy5fc2hlbGxUeXBlID09PSBQb3NpeFNoZWxsVHlwZS5GaXNoKSB7XG5cdFx0XHRcdFx0dmFsdWUgKz0gYCR7bGluZVRleHR9YDtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLl9jb250aW51YXRpb25Qcm9tcHQgPT09IHVuZGVmaW5lZCB8fCB0aGlzLl9saW5lQ29udGFpbnNDb250aW51YXRpb25Qcm9tcHQobGluZVRleHQpKSB7XG5cdFx0XHRcdFx0dmFsdWUgKz0gYFxcbiR7dGhpcy5fdHJpbUNvbnRpbnVhdGlvblByb21wdChsaW5lVGV4dCl9YDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YWx1ZSArPSBsaW5lVGV4dDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2xvZ1NlcnZpY2UuZ2V0TGV2ZWwoKSA9PT0gTG9nTGV2ZWwuVHJhY2UpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFByb21wdElucHV0TW9kZWwjX3N5bmM6ICR7dGhpcy5nZXRDb21iaW5lZFN0cmluZygpfWApO1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCB0cmFpbGluZyB3aGl0ZXNwYWNlXG5cdFx0e1xuXHRcdFx0bGV0IHRyYWlsaW5nV2hpdGVzcGFjZSA9IHRoaXMuX3ZhbHVlLmxlbmd0aCAtIHRoaXMuX3ZhbHVlLnRyaW1FbmQoKS5sZW5ndGg7XG5cblx0XHRcdC8vIEhhbmRsZSBiYWNrc3BhY2Uga2V5XG5cdFx0XHRpZiAodGhpcy5fbGFzdFVzZXJJbnB1dCA9PT0gJ1xceDdGJykge1xuXHRcdFx0XHR0aGlzLl9sYXN0VXNlcklucHV0ID0gJyc7XG5cdFx0XHRcdGlmIChjdXJzb3JJbmRleCA9PT0gdGhpcy5fY3Vyc29ySW5kZXggLSAxKSB7XG5cdFx0XHRcdFx0Ly8gSWYgdHJhaWxpbmcgd2hpdGVzcGFjZSBpcyBiZWluZyBpbmNyZWFzZWQgYnkgcmVtb3ZpbmcgYSBub24td2hpdGVzcGFjZSBjaGFyYWN0ZXJcblx0XHRcdFx0XHRpZiAodGhpcy5fdmFsdWUudHJpbUVuZCgpLmxlbmd0aCA+IHZhbHVlLnRyaW1FbmQoKS5sZW5ndGggJiYgdmFsdWUudHJpbUVuZCgpLmxlbmd0aCA8PSBjdXJzb3JJbmRleCkge1xuXHRcdFx0XHRcdFx0dHJhaWxpbmdXaGl0ZXNwYWNlID0gTWF0aC5tYXgoKHRoaXMuX3ZhbHVlLmxlbmd0aCAtIDEpIC0gdmFsdWUudHJpbUVuZCgpLmxlbmd0aCwgMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIFN0YW5kYXJkIGNhc2U7IHN1YnRyYWN0IGZyb20gdHJhaWxpbmcgd2hpdGVzcGFjZVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0dHJhaWxpbmdXaGl0ZXNwYWNlID0gTWF0aC5tYXgodHJhaWxpbmdXaGl0ZXNwYWNlIC0gMSwgMCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIGRlbGV0ZSBrZXlcblx0XHRcdGlmICh0aGlzLl9sYXN0VXNlcklucHV0ID09PSAnXFx4MWJbM34nKSB7XG5cdFx0XHRcdHRoaXMuX2xhc3RVc2VySW5wdXQgPSAnJztcblx0XHRcdFx0aWYgKGN1cnNvckluZGV4ID09PSB0aGlzLl9jdXJzb3JJbmRleCkge1xuXHRcdFx0XHRcdHRyYWlsaW5nV2hpdGVzcGFjZSA9IE1hdGgubWF4KHRyYWlsaW5nV2hpdGVzcGFjZSAtIDEsIDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHZhbHVlTGluZXMgPSB2YWx1ZS5zcGxpdCgnXFxuJyk7XG5cdFx0XHRjb25zdCBpc011bHRpTGluZSA9IHZhbHVlTGluZXMubGVuZ3RoID4gMTtcblx0XHRcdGNvbnN0IHZhbHVlRW5kVHJpbW1lZCA9IHZhbHVlLnRyaW1FbmQoKTtcblx0XHRcdGlmICghaXNNdWx0aUxpbmUpIHtcblx0XHRcdFx0Ly8gQWRqdXN0IHRyaW1tZWQgd2hpdGVzcGFjZSB2YWx1ZSBiYXNlZCBvbiBjdXJzb3IgcG9zaXRpb25cblx0XHRcdFx0aWYgKHZhbHVlRW5kVHJpbW1lZC5sZW5ndGggPCB2YWx1ZS5sZW5ndGgpIHtcblx0XHRcdFx0XHQvLyBIYW5kbGUgc3BhY2Uga2V5XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2xhc3RVc2VySW5wdXQgPT09ICcgJykge1xuXHRcdFx0XHRcdFx0dGhpcy5fbGFzdFVzZXJJbnB1dCA9ICcnO1xuXHRcdFx0XHRcdFx0aWYgKGN1cnNvckluZGV4ID4gdmFsdWVFbmRUcmltbWVkLmxlbmd0aCAmJiBjdXJzb3JJbmRleCA+IHRoaXMuX2N1cnNvckluZGV4KSB7XG5cdFx0XHRcdFx0XHRcdHRyYWlsaW5nV2hpdGVzcGFjZSsrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0cmFpbGluZ1doaXRlc3BhY2UgPSBNYXRoLm1heChjdXJzb3JJbmRleCAtIHZhbHVlRW5kVHJpbW1lZC5sZW5ndGgsIHRyYWlsaW5nV2hpdGVzcGFjZSwgMCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBIYW5kbGUgY2FzZSB3aGVyZSBhIG5vbi1zcGFjZSBjaGFyYWN0ZXIgaXMgaW5zZXJ0ZWQgaW4gdGhlIG1pZGRsZSBvZiB0cmFpbGluZyB3aGl0ZXNwYWNlXG5cdFx0XHRcdGNvbnN0IGNoYXJCZWZvcmVDdXJzb3IgPSBjdXJzb3JJbmRleCA9PT0gMCA/ICcnIDogdmFsdWVbY3Vyc29ySW5kZXggLSAxXTtcblx0XHRcdFx0aWYgKHRyYWlsaW5nV2hpdGVzcGFjZSA+IDAgJiYgY3Vyc29ySW5kZXggPT09IHRoaXMuX2N1cnNvckluZGV4ICsgMSAmJiB0aGlzLl9sYXN0VXNlcklucHV0ICE9PSAnJyAmJiBjaGFyQmVmb3JlQ3Vyc29yICE9PSAnICcpIHtcblx0XHRcdFx0XHR0cmFpbGluZ1doaXRlc3BhY2UgPSB0aGlzLl92YWx1ZS5sZW5ndGggLSB0aGlzLl9jdXJzb3JJbmRleDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNNdWx0aUxpbmUpIHtcblx0XHRcdFx0dmFsdWVMaW5lc1t2YWx1ZUxpbmVzLmxlbmd0aCAtIDFdID0gdmFsdWVMaW5lcy5hdCgtMSk/LnRyaW1FbmQoKSA/PyAnJztcblx0XHRcdFx0Y29uc3QgY29udGludWF0aW9uT2Zmc2V0ID0gKHZhbHVlTGluZXMubGVuZ3RoIC0gMSkgKiAodGhpcy5fY29udGludWF0aW9uUHJvbXB0Py5sZW5ndGggPz8gMCk7XG5cdFx0XHRcdHRyYWlsaW5nV2hpdGVzcGFjZSA9IE1hdGgubWF4KDAsIGN1cnNvckluZGV4IC0gdmFsdWUubGVuZ3RoIC0gY29udGludWF0aW9uT2Zmc2V0KTtcblx0XHRcdH1cblxuXHRcdFx0dmFsdWUgPSB2YWx1ZUxpbmVzLm1hcChlID0+IGUudHJpbUVuZCgpKS5qb2luKCdcXG4nKSArICcgJy5yZXBlYXQodHJhaWxpbmdXaGl0ZXNwYWNlKTtcblx0XHR9XG5cblx0XHRnaG9zdFRleHRJbmRleCA9IHRoaXMuX3NjYW5Gb3JHaG9zdFRleHQoYnVmZmVyLCBsaW5lLCBjdXJzb3JJbmRleCk7XG5cblx0XHRpZiAodGhpcy5fdmFsdWUgIT09IHZhbHVlIHx8IHRoaXMuX2N1cnNvckluZGV4ICE9PSBjdXJzb3JJbmRleCB8fCB0aGlzLl9naG9zdFRleHRJbmRleCAhPT0gZ2hvc3RUZXh0SW5kZXgpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLl9jdXJzb3JJbmRleCA9IGN1cnNvckluZGV4O1xuXHRcdFx0dGhpcy5fZ2hvc3RUZXh0SW5kZXggPSBnaG9zdFRleHRJbmRleDtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSW5wdXQuZmlyZSh0aGlzLl9jcmVhdGVTdGF0ZU9iamVjdCgpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVVc2VySW5wdXQoZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fbGFzdFVzZXJJbnB1dCA9IGU7XG5cdH1cblxuXHQvKipcblx0ICogRGV0ZWN0IGdob3N0IHRleHQgYnkgbG9va2luZyBmb3IgaXRhbGljIG9yIGRpbSB0ZXh0IGluIG9yIGFmdGVyIHRoZSBjdXJzb3IgYW5kXG5cdCAqIG5vbi1pdGFsaWMvZGltIHRleHQgaW4gdGhlIGZpcnN0IG5vbi13aGl0ZXNwYWNlIGNlbGwgZm9sbG93aW5nIGNvbW1hbmQgc3RhcnQgYW5kIGJlZm9yZSB0aGUgY3Vyc29yLlxuXHQgKi9cblx0cHJpdmF0ZSBfc2NhbkZvckdob3N0VGV4dChidWZmZXI6IElCdWZmZXIsIGxpbmU6IElCdWZmZXJMaW5lLCBjdXJzb3JJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMudmFsdWUudHJpbSgpLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0XHQvLyBDaGVjayBsYXN0IG5vbi13aGl0ZXNwYWNlIGNoYXJhY3RlciBoYXMgbm9uLWdob3N0IHRleHQgc3R5bGVzXG5cdFx0bGV0IGdob3N0VGV4dEluZGV4ID0gLTE7XG5cdFx0bGV0IHByb2NlZWRXaXRoR2hvc3RUZXh0Q2hlY2sgPSBmYWxzZTtcblx0XHRsZXQgeCA9IGJ1ZmZlci5jdXJzb3JYO1xuXHRcdHdoaWxlICh4ID4gMCkge1xuXHRcdFx0Y29uc3QgY2VsbCA9IGxpbmUuZ2V0Q2VsbCgtLXgpO1xuXHRcdFx0aWYgKCFjZWxsKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNlbGwuZ2V0Q2hhcnMoKS50cmltKCkubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRwcm9jZWVkV2l0aEdob3N0VGV4dENoZWNrID0gIXRoaXMuX2lzQ2VsbFN0eWxlZExpa2VHaG9zdFRleHQoY2VsbCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENoZWNrIHRvIHRoZSBlbmQgb2YgdGhlIGxpbmUgZm9yIHBvc3NpYmxlIGdob3N0IHRleHQuIEZvciBleGFtcGxlIHB3c2gncyBnaG9zdCB0ZXh0XG5cdFx0Ly8gY2FuIGxvb2sgbGlrZSB0aGlzIGBHZXQtfENoW2lsZEl0ZW1dYFxuXHRcdGlmIChwcm9jZWVkV2l0aEdob3N0VGV4dENoZWNrKSB7XG5cdFx0XHRsZXQgcG90ZW50aWFsR2hvc3RJbmRleE9mZnNldCA9IDA7XG5cdFx0XHRsZXQgeCA9IGJ1ZmZlci5jdXJzb3JYO1xuXG5cdFx0XHR3aGlsZSAoeCA8IGxpbmUubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSBsaW5lLmdldENlbGwoeCsrKTtcblx0XHRcdFx0aWYgKCFjZWxsIHx8IGNlbGwuZ2V0Q29kZSgpID09PSAwKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuX2lzQ2VsbFN0eWxlZExpa2VHaG9zdFRleHQoY2VsbCkpIHtcblx0XHRcdFx0XHRnaG9zdFRleHRJbmRleCA9IGN1cnNvckluZGV4ICsgcG90ZW50aWFsR2hvc3RJbmRleE9mZnNldDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHBvdGVudGlhbEdob3N0SW5kZXhPZmZzZXQgKz0gY2VsbC5nZXRDaGFycygpLmxlbmd0aDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBHaG9zdCB0ZXh0IG1heSBub3QgYmUgaXRhbGljIG9yIGRpbW1lZCwgYnV0IHdpbGwgaGF2ZSBhIGRpZmZlcmVudCBzdHlsZSB0aGFuIHRoZVxuXHRcdC8vIHJlc3Qgb2YgdGhlIGxpbmUgdGhhdCBwcmVjZWRlcyBpdC5cblx0XHRpZiAoZ2hvc3RUZXh0SW5kZXggPT09IC0xKSB7XG5cdFx0XHRnaG9zdFRleHRJbmRleCA9IHRoaXMuX3NjYW5Gb3JHaG9zdFRleHRBZHZhbmNlZChidWZmZXIsIGxpbmUsIGN1cnNvckluZGV4KTtcblx0XHR9XG5cblx0XHRpZiAoZ2hvc3RUZXh0SW5kZXggPiAtMSAmJiB0aGlzLnZhbHVlLnN1YnN0cmluZyhnaG9zdFRleHRJbmRleCkuZW5kc1dpdGgoJyAnKSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB0aGlzLnZhbHVlLnRyaW0oKTtcblx0XHRcdGlmICghdGhpcy52YWx1ZS5zdWJzdHJpbmcoZ2hvc3RUZXh0SW5kZXgpKSB7XG5cdFx0XHRcdGdob3N0VGV4dEluZGV4ID0gLTE7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBnaG9zdFRleHRJbmRleDtcblx0fVxuXG5cdHByaXZhdGUgX3NjYW5Gb3JHaG9zdFRleHRBZHZhbmNlZChidWZmZXI6IElCdWZmZXIsIGxpbmU6IElCdWZmZXJMaW5lLCBjdXJzb3JJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRsZXQgZ2hvc3RUZXh0SW5kZXggPSAtMTtcblx0XHRsZXQgY3VycmVudFBvcyA9IGJ1ZmZlci5jdXJzb3JYOyAvLyBTdGFydCBzY2FubmluZyBmcm9tIHRoZSBjdXJzb3IgcG9zaXRpb25cblxuXHRcdC8vIE1hcCB0byBzdG9yZSBzdHlsZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgcG9zaXRpb25zXG5cdFx0Y29uc3Qgc3R5bGVNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyW10+KCk7XG5cblx0XHQvLyBJZGVudGlmeSB0aGUgbGFzdCBub24td2hpdGVzcGFjZSBjaGFyYWN0ZXIgaW4gdGhlIGxpbmVcblx0XHRsZXQgbGFzdE5vbldoaXRlc3BhY2VDZWxsID0gbGluZS5nZXRDZWxsKGN1cnJlbnRQb3MpO1xuXHRcdGxldCBuZXh0Q2VsbDogSUJ1ZmZlckNlbGwgfCB1bmRlZmluZWQgPSBsYXN0Tm9uV2hpdGVzcGFjZUNlbGw7XG5cblx0XHQvLyBTY2FuIGZyb20gdGhlIGN1cnNvciBwb3NpdGlvbiB0byB0aGUgZW5kIG9mIHRoZSBsaW5lXG5cdFx0d2hpbGUgKG5leHRDZWxsICYmIGN1cnJlbnRQb3MgPCBsaW5lLmxlbmd0aCkge1xuXHRcdFx0Y29uc3Qgc3R5bGVLZXkgPSB0aGlzLl9nZXRDZWxsU3R5bGVBc1N0cmluZyhuZXh0Q2VsbCk7XG5cblx0XHRcdC8vIFRyYWNrIGFsbCBvY2N1cnJlbmNlcyBvZiBlYWNoIHVuaXF1ZSBzdHlsZSBpbiB0aGUgbGluZVxuXHRcdFx0c3R5bGVNYXAuc2V0KHN0eWxlS2V5LCBbLi4uKHN0eWxlTWFwLmdldChzdHlsZUtleSkgPz8gW10pLCBjdXJyZW50UG9zXSk7XG5cblx0XHRcdC8vIE1vdmUgdG8gdGhlIG5leHQgY2VsbFxuXHRcdFx0bmV4dENlbGwgPSBsaW5lLmdldENlbGwoKytjdXJyZW50UG9zKTtcblxuXHRcdFx0Ly8gVXBkYXRlIGBsYXN0Tm9uV2hpdGVzcGFjZUNlbGxgIG9ubHkgaWYgdGhlIG5ldyBjZWxsIGNvbnRhaW5zIHZpc2libGUgY2hhcmFjdGVyc1xuXHRcdFx0aWYgKG5leHRDZWxsPy5nZXRDaGFycygpLnRyaW0oKS5sZW5ndGgpIHtcblx0XHRcdFx0bGFzdE5vbldoaXRlc3BhY2VDZWxsID0gbmV4dENlbGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlcmUncyBubyB2YWxpZCBsYXN0IG5vbi13aGl0ZXNwYWNlIGNlbGwgT1IgdGhlIGZpcnN0IGFuZCBsYXN0IHN0eWxlcyBtYXRjaCAoaW5kaWNhdGluZyBubyBnaG9zdCB0ZXh0KVxuXHRcdGlmICghbGFzdE5vbldoaXRlc3BhY2VDZWxsPy5nZXRDaGFycygpLnRyaW0oKS5sZW5ndGggfHxcblx0XHRcdHRoaXMuX2NlbGxTdHlsZXNNYXRjaChsaW5lLmdldENlbGwodGhpcy5fY29tbWFuZFN0YXJ0WCksIGxhc3ROb25XaGl0ZXNwYWNlQ2VsbCkpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHQvLyBSZXRyaWV2ZSB0aGUgcG9zaXRpb25zIG9mIGFsbCBjZWxscyB3aXRoIHRoZSBzYW1lIHN0eWxlIGFzIGBsYXN0Tm9uV2hpdGVzcGFjZUNlbGxgXG5cdFx0Y29uc3QgcG9zaXRpb25zV2l0aEdob3N0U3R5bGUgPSBzdHlsZU1hcC5nZXQodGhpcy5fZ2V0Q2VsbFN0eWxlQXNTdHJpbmcobGFzdE5vbldoaXRlc3BhY2VDZWxsKSk7XG5cdFx0aWYgKHBvc2l0aW9uc1dpdGhHaG9zdFN0eWxlKSB7XG5cdFx0XHQvLyBFbnN1cmUgdGhlc2UgcG9zaXRpb25zIGFyZSBjb250aWd1b3VzXG5cdFx0XHRmb3IgKGxldCBpID0gMTsgaSA8IHBvc2l0aW9uc1dpdGhHaG9zdFN0eWxlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChwb3NpdGlvbnNXaXRoR2hvc3RTdHlsZVtpXSAhPT0gcG9zaXRpb25zV2l0aEdob3N0U3R5bGVbaSAtIDFdICsgMSkge1xuXHRcdFx0XHRcdC8vIERpc2NvbnRpbnVvdXMgc3R5bGVzLCBzbyBtYXkgYmUgc3ludGF4IGhpZ2hsaWdodGluZyB2cyBnaG9zdCB0ZXh0XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBDYWxjdWxhdGUgdGhlIGdob3N0IHRleHQgc3RhcnQgaW5kZXhcblx0XHRcdGlmIChidWZmZXIuYmFzZVkgKyBidWZmZXIuY3Vyc29yWSA9PT0gdGhpcy5fY29tbWFuZFN0YXJ0TWFya2VyPy5saW5lKSB7XG5cdFx0XHRcdGdob3N0VGV4dEluZGV4ID0gcG9zaXRpb25zV2l0aEdob3N0U3R5bGVbMF0gLSB0aGlzLl9jb21tYW5kU3RhcnRYO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z2hvc3RUZXh0SW5kZXggPSBwb3NpdGlvbnNXaXRoR2hvc3RTdHlsZVswXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBFbnN1cmUgbm8gZWFybGllciBjZWxscyBpbiB0aGUgbGluZSBtYXRjaCBgbGFzdE5vbldoaXRlc3BhY2VDZWxsYCdzIHN0eWxlLFxuXHRcdC8vIHdoaWNoIHdvdWxkIGluZGljYXRlIHRoZSB0ZXh0IGlzIG5vdCBnaG9zdCB0ZXh0LlxuXHRcdGlmIChnaG9zdFRleHRJbmRleCAhPT0gLTEpIHtcblx0XHRcdGZvciAobGV0IGNoZWNrUG9zID0gYnVmZmVyLmN1cnNvclg7IGNoZWNrUG9zID49IHRoaXMuX2NvbW1hbmRTdGFydFg7IGNoZWNrUG9zLS0pIHtcblx0XHRcdFx0Y29uc3QgY2hlY2tDZWxsID0gbGluZS5nZXRDZWxsKGNoZWNrUG9zKTtcblx0XHRcdFx0aWYgKCFjaGVja0NlbGw/LmdldENoYXJzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjaGVja0NlbGwgJiYgY2hlY2tDZWxsLmdldENvZGUoKSAhPT0gMCAmJiB0aGlzLl9jZWxsU3R5bGVzTWF0Y2gobGFzdE5vbldoaXRlc3BhY2VDZWxsLCBjaGVja0NlbGwpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGdob3N0VGV4dEluZGV4ID49IGN1cnNvckluZGV4ID8gZ2hvc3RUZXh0SW5kZXggOiAtMTtcblx0fVxuXG5cdHByaXZhdGUgX2dldENlbGxTdHlsZUFzU3RyaW5nKGNlbGw6IElCdWZmZXJDZWxsKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7Y2VsbC5nZXRGZ0NvbG9yKCl9JHtjZWxsLmdldEJnQ29sb3IoKX0ke2NlbGwuaXNCb2xkKCl9JHtjZWxsLmlzSXRhbGljKCl9JHtjZWxsLmlzRGltKCl9JHtjZWxsLmlzVW5kZXJsaW5lKCl9JHtjZWxsLmlzQmxpbmsoKX0ke2NlbGwuaXNJbnZlcnNlKCl9JHtjZWxsLmlzSW52aXNpYmxlKCl9JHtjZWxsLmlzU3RyaWtldGhyb3VnaCgpfSR7Y2VsbC5pc092ZXJsaW5lKCl9JHtjZWxsLmdldEZnQ29sb3JNb2RlKCl9JHtjZWxsLmdldEJnQ29sb3JNb2RlKCl9YDtcblx0fVxuXG5cdHByaXZhdGUgX2NlbGxTdHlsZXNNYXRjaChhOiBJQnVmZmVyQ2VsbCB8IHVuZGVmaW5lZCwgYjogSUJ1ZmZlckNlbGwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAoIWEgfHwgIWIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGEuZ2V0RmdDb2xvcigpID09PSBiLmdldEZnQ29sb3IoKVxuXHRcdFx0JiYgYS5nZXRCZ0NvbG9yKCkgPT09IGIuZ2V0QmdDb2xvcigpXG5cdFx0XHQmJiBhLmlzQm9sZCgpID09PSBiLmlzQm9sZCgpXG5cdFx0XHQmJiBhLmlzSXRhbGljKCkgPT09IGIuaXNJdGFsaWMoKVxuXHRcdFx0JiYgYS5pc0RpbSgpID09PSBiLmlzRGltKClcblx0XHRcdCYmIGEuaXNVbmRlcmxpbmUoKSA9PT0gYi5pc1VuZGVybGluZSgpXG5cdFx0XHQmJiBhLmlzQmxpbmsoKSA9PT0gYi5pc0JsaW5rKClcblx0XHRcdCYmIGEuaXNJbnZlcnNlKCkgPT09IGIuaXNJbnZlcnNlKClcblx0XHRcdCYmIGEuaXNJbnZpc2libGUoKSA9PT0gYi5pc0ludmlzaWJsZSgpXG5cdFx0XHQmJiBhLmlzU3RyaWtldGhyb3VnaCgpID09PSBiLmlzU3RyaWtldGhyb3VnaCgpXG5cdFx0XHQmJiBhLmlzT3ZlcmxpbmUoKSA9PT0gYi5pc092ZXJsaW5lKClcblx0XHRcdCYmIGE/LmdldEJnQ29sb3JNb2RlKCkgPT09IGI/LmdldEJnQ29sb3JNb2RlKClcblx0XHRcdCYmIGE/LmdldEZnQ29sb3JNb2RlKCkgPT09IGI/LmdldEZnQ29sb3JNb2RlKCk7XG5cdH1cblxuXHRwcml2YXRlIF90cmltQ29udGludWF0aW9uUHJvbXB0KGxpbmVUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLl9saW5lQ29udGFpbnNDb250aW51YXRpb25Qcm9tcHQobGluZVRleHQpKSB7XG5cdFx0XHRsaW5lVGV4dCA9IGxpbmVUZXh0LnN1YnN0cmluZyh0aGlzLl9jb250aW51YXRpb25Qcm9tcHQhLmxlbmd0aCk7XG5cdFx0fVxuXHRcdHJldHVybiBsaW5lVGV4dDtcblx0fVxuXG5cdHByaXZhdGUgX2xpbmVDb250YWluc0NvbnRpbnVhdGlvblByb21wdChsaW5lVGV4dDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhKHRoaXMuX2NvbnRpbnVhdGlvblByb21wdCAmJiBsaW5lVGV4dC5zdGFydHNXaXRoKHRoaXMuX2NvbnRpbnVhdGlvblByb21wdC50cmltRW5kKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldENvbnRpbnVhdGlvblByb21wdENlbGxXaWR0aChsaW5lOiBJQnVmZmVyTGluZSwgbGluZVRleHQ6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9jb250aW51YXRpb25Qcm9tcHQgfHwgIWxpbmVUZXh0LnN0YXJ0c1dpdGgodGhpcy5fY29udGludWF0aW9uUHJvbXB0LnRyaW1FbmQoKSkpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0XHRsZXQgYnVmZmVyID0gJyc7XG5cdFx0bGV0IHggPSAwO1xuXHRcdGxldCBjZWxsOiBJQnVmZmVyQ2VsbCB8IHVuZGVmaW5lZDtcblx0XHR3aGlsZSAoYnVmZmVyICE9PSB0aGlzLl9jb250aW51YXRpb25Qcm9tcHQpIHtcblx0XHRcdGNlbGwgPSBsaW5lLmdldENlbGwoeCsrKTtcblx0XHRcdGlmICghY2VsbCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGJ1ZmZlciArPSBjZWxsLmdldENoYXJzKCk7XG5cdFx0fVxuXHRcdHJldHVybiB4O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UmVsYXRpdmVDdXJzb3JJbmRleChzdGFydENlbGxYOiBudW1iZXIsIGJ1ZmZlcjogSUJ1ZmZlciwgbGluZTogSUJ1ZmZlckxpbmUpOiBudW1iZXIge1xuXHRcdHJldHVybiBsaW5lPy50cmFuc2xhdGVUb1N0cmluZyh0cnVlLCBzdGFydENlbGxYLCBidWZmZXIuY3Vyc29yWCkubGVuZ3RoID8/IDA7XG5cdH1cblxuXHRwcml2YXRlIF9pc0NlbGxTdHlsZWRMaWtlR2hvc3RUZXh0KGNlbGw6IElCdWZmZXJDZWxsKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhKGNlbGwuaXNJdGFsaWMoKSB8fCBjZWxsLmlzRGltKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlU3RhdGVPYmplY3QoKTogSVByb21wdElucHV0TW9kZWxTdGF0ZSB7XG5cdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoe1xuXHRcdFx0dmFsdWU6IHRoaXMuX3ZhbHVlLFxuXHRcdFx0cHJlZml4OiB0aGlzLnByZWZpeCxcblx0XHRcdHN1ZmZpeDogdGhpcy5zdWZmaXgsXG5cdFx0XHRjdXJzb3JJbmRleDogdGhpcy5fY3Vyc29ySW5kZXgsXG5cdFx0XHRnaG9zdFRleHRJbmRleDogdGhpcy5fZ2hvc3RUZXh0SW5kZXhcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGFBQWEsZ0JBQWdCO0FBRXRDLFNBQVMsZ0JBQWdCO0FBR3pCLFNBQVMsc0JBQXlDO0FBRWxELElBQVcsbUJBQVgsa0JBQVdBLHNCQUFYO0FBQ0MsRUFBQUEsb0NBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsb0NBQUEsV0FBUSxLQUFSO0FBQ0EsRUFBQUEsb0NBQUEsYUFBVSxLQUFWO0FBSFUsU0FBQUE7QUFBQSxHQUFBO0FBK0RKLElBQU0sbUJBQU4sY0FBK0IsV0FBd0M7QUFBQSxFQStCN0UsWUFD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
