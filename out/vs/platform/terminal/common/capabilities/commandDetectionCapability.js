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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { debounce } from "../../../../base/common/decorators.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, MandatoryMutableDisposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../log/common/log.js";
import { CommandInvalidationReason, TerminalCapability } from "./capabilities.js";
import { PartialTerminalCommand, TerminalCommand } from "./commandDetection/terminalCommand.js";
import { PromptInputModel } from "./commandDetection/promptInputModel.js";
let CommandDetectionCapability = class extends Disposable {
  constructor(_terminal, _logService) {
    super();
    this._terminal = _terminal;
    this._logService = _logService;
    this.type = TerminalCapability.CommandDetection;
    this._commands = [];
    this._currentCommand = new PartialTerminalCommand(this._terminal);
    this._commandMarkers = [];
    this.__isCommandStorageDisabled = false;
    this._hasRichCommandDetection = false;
    this._onCommandStarted = this._register(new Emitter());
    this.onCommandStarted = this._onCommandStarted.event;
    this._onCommandStartChanged = this._register(new Emitter());
    this.onCommandStartChanged = this._onCommandStartChanged.event;
    this._onBeforeCommandFinished = this._register(new Emitter());
    this.onBeforeCommandFinished = this._onBeforeCommandFinished.event;
    this._onCommandFinished = this._register(new Emitter());
    this.onCommandFinished = this._onCommandFinished.event;
    this._onCommandExecuted = this._register(new Emitter());
    this.onCommandExecuted = this._onCommandExecuted.event;
    this._onCommandInvalidated = this._register(new Emitter());
    this.onCommandInvalidated = this._onCommandInvalidated.event;
    this._onCurrentCommandInvalidated = this._register(new Emitter());
    this.onCurrentCommandInvalidated = this._onCurrentCommandInvalidated.event;
    this._onSetRichCommandDetection = this._register(new Emitter());
    this.onSetRichCommandDetection = this._onSetRichCommandDetection.event;
    this._promptInputModel = this._register(new PromptInputModel(this._terminal, this.onCommandStarted, this.onCommandStartChanged, this.onCommandExecuted, this._logService));
    this._register(this.onCommandExecuted((command) => {
      if (command.commandLineConfidence !== "high") {
        const typedCommand = command;
        command.command = typedCommand.extractCommandLine();
        command.commandLineConfidence = "low";
        if ("getOutput" in typedCommand) {
          if (
            // Markers exist
            typedCommand.promptStartMarker && typedCommand.marker && typedCommand.executedMarker && // Single line command
            command.command.indexOf("\n") === -1 && // Start marker is not on the left-most column
            typedCommand.startX !== void 0 && typedCommand.startX > 0
          ) {
            command.commandLineConfidence = "medium";
          }
        } else {
          if (
            // Markers exist
            typedCommand.promptStartMarker && typedCommand.commandStartMarker && typedCommand.commandExecutedMarker && // Single line command
            command.command.indexOf("\n") === -1 && // Start marker is not on the left-most column
            typedCommand.commandStartX !== void 0 && typedCommand.commandStartX > 0
          ) {
            command.commandLineConfidence = "medium";
          }
        }
      }
    }));
    const that = this;
    this._ptyHeuristicsHooks = new class {
      get onCurrentCommandInvalidatedEmitter() {
        return that._onCurrentCommandInvalidated;
      }
      get onCommandStartedEmitter() {
        return that._onCommandStarted;
      }
      get onCommandExecutedEmitter() {
        return that._onCommandExecuted;
      }
      get dimensions() {
        return that._dimensions;
      }
      get isCommandStorageDisabled() {
        return that.__isCommandStorageDisabled;
      }
      get commandMarkers() {
        return that._commandMarkers;
      }
      set commandMarkers(value) {
        that._commandMarkers = value;
      }
      get clearCommandsInViewport() {
        return that._clearCommandsInViewport.bind(that);
      }
    }();
    this._ptyHeuristics = this._register(new MandatoryMutableDisposable(new UnixPtyHeuristics(this._terminal, this, this._ptyHeuristicsHooks, this._logService)));
    this._dimensions = {
      cols: this._terminal.cols,
      rows: this._terminal.rows
    };
    this._register(this._terminal.onResize((e) => this._handleResize(e)));
    this._register(this._terminal.onCursorMove(() => this._handleCursorMove()));
  }
  get promptInputModel() {
    return this._promptInputModel;
  }
  get hasRichCommandDetection() {
    return this._hasRichCommandDetection;
  }
  get commands() {
    return this._commands;
  }
  get executingCommand() {
    return this._currentCommand.command;
  }
  get executingCommandObject() {
    if (this._currentCommand.commandStartMarker) {
      return this._currentCommand.promoteToFullCommand(this._cwd, void 0, this._handleCommandStartOptions?.ignoreCommandLine ?? false, void 0);
    }
    return void 0;
  }
  get executingCommandConfidence() {
    const casted = this._currentCommand;
    return "commandLineConfidence" in casted ? casted.commandLineConfidence : void 0;
  }
  get currentCommand() {
    return this._currentCommand;
  }
  get cwd() {
    return this._cwd;
  }
  get promptTerminator() {
    return this._promptTerminator;
  }
  _handleResize(e) {
    this._ptyHeuristics.value.preHandleResize?.(e);
    this._dimensions.cols = e.cols;
    this._dimensions.rows = e.rows;
  }
  _handleCursorMove() {
    if (this._store.isDisposed) {
      return;
    }
    if (this._terminal.buffer.active === this._terminal.buffer.normal && this._currentCommand.commandStartMarker) {
      if (this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY < this._currentCommand.commandStartMarker.line) {
        this._clearCommandsInViewport();
        this._currentCommand.isInvalid = true;
        this._onCurrentCommandInvalidated.fire({ reason: CommandInvalidationReason.Windows });
      }
    }
  }
  _clearCommandsInViewport() {
    let count = 0;
    for (let i = this._commands.length - 1; i >= 0; i--) {
      const line = this._commands[i].marker?.line;
      if (line && line < this._terminal.buffer.active.baseY) {
        break;
      }
      count++;
    }
    if (count > 0) {
      this._onCommandInvalidated.fire(this._commands.splice(this._commands.length - count, count));
    }
  }
  setContinuationPrompt(value) {
    this._promptInputModel.setContinuationPrompt(value);
  }
  // TODO: Simplify this, can everything work off the last line?
  setPromptTerminator(promptTerminator, lastPromptLine) {
    this._logService.debug("CommandDetectionCapability#setPromptTerminator", promptTerminator);
    this._promptTerminator = promptTerminator;
    this._promptInputModel.setLastPromptLine(lastPromptLine);
  }
  setCwd(value) {
    this._cwd = value;
  }
  setIsWindowsPty(value) {
    if (value && !(this._ptyHeuristics.value instanceof WindowsPtyHeuristics)) {
      const that = this;
      this._ptyHeuristics.value = new WindowsPtyHeuristics(
        this._terminal,
        this,
        new class {
          get onCurrentCommandInvalidatedEmitter() {
            return that._onCurrentCommandInvalidated;
          }
          get onCommandStartedEmitter() {
            return that._onCommandStarted;
          }
          get onCommandExecutedEmitter() {
            return that._onCommandExecuted;
          }
          get dimensions() {
            return that._dimensions;
          }
          get isCommandStorageDisabled() {
            return that.__isCommandStorageDisabled;
          }
          get commandMarkers() {
            return that._commandMarkers;
          }
          set commandMarkers(value2) {
            that._commandMarkers = value2;
          }
          get clearCommandsInViewport() {
            return that._clearCommandsInViewport.bind(that);
          }
        }(),
        this._logService
      );
    } else if (!value && !(this._ptyHeuristics.value instanceof UnixPtyHeuristics)) {
      this._ptyHeuristics.value = new UnixPtyHeuristics(this._terminal, this, this._ptyHeuristicsHooks, this._logService);
    }
  }
  setHasRichCommandDetection(value) {
    this._hasRichCommandDetection = value;
    this._onSetRichCommandDetection.fire(value);
  }
  setIsCommandStorageDisabled() {
    this.__isCommandStorageDisabled = true;
  }
  getCommandForLine(line) {
    if (this._currentCommand.promptStartMarker && line >= this._currentCommand.promptStartMarker?.line) {
      return this._currentCommand;
    }
    if (this._commands.length === 0) {
      return void 0;
    }
    if ((this._commands[0].promptStartMarker ?? this._commands[0].marker).line > line) {
      return void 0;
    }
    for (let i = this.commands.length - 1; i >= 0; i--) {
      if ((this.commands[i].promptStartMarker ?? this.commands[i].marker).line <= line) {
        return this.commands[i];
      }
    }
    return void 0;
  }
  getCwdForLine(line) {
    if (this._currentCommand.promptStartMarker && line >= this._currentCommand.promptStartMarker?.line) {
      return this._cwd;
    }
    const command = this.getCommandForLine(line);
    if (command && "cwd" in command) {
      return command.cwd;
    }
    return void 0;
  }
  handlePromptStart(options) {
    const lastCommand = this.commands.at(-1);
    if (lastCommand?.endMarker && lastCommand?.executedMarker && lastCommand.endMarker.line === lastCommand.executedMarker.line) {
      this._logService.debug("CommandDetectionCapability#handlePromptStart adjusted commandFinished", `${lastCommand.endMarker.line} -> ${lastCommand.executedMarker.line + 1}`);
      lastCommand.endMarker = cloneMarker(this._terminal, lastCommand.executedMarker, 1);
    }
    this._currentCommand.promptStartMarker = options?.marker || (lastCommand?.endMarker ? cloneMarker(this._terminal, lastCommand.endMarker) : this._terminal.registerMarker(0));
    this._logService.debug("CommandDetectionCapability#handlePromptStart", this._terminal.buffer.active.cursorX, this._currentCommand.promptStartMarker?.line);
  }
  handleContinuationStart() {
    this._currentCommand.currentContinuationMarker = this._terminal.registerMarker(0);
    this._logService.debug("CommandDetectionCapability#handleContinuationStart", this._currentCommand.currentContinuationMarker);
  }
  handleContinuationEnd() {
    if (!this._currentCommand.currentContinuationMarker) {
      this._logService.warn("CommandDetectionCapability#handleContinuationEnd Received continuation end without start");
      return;
    }
    if (!this._currentCommand.continuations) {
      this._currentCommand.continuations = [];
    }
    this._currentCommand.continuations.push({
      marker: this._currentCommand.currentContinuationMarker,
      end: this._terminal.buffer.active.cursorX
    });
    this._currentCommand.currentContinuationMarker = void 0;
    this._logService.debug("CommandDetectionCapability#handleContinuationEnd", this._currentCommand.continuations[this._currentCommand.continuations.length - 1]);
  }
  handleRightPromptStart() {
    this._currentCommand.commandRightPromptStartX = this._terminal.buffer.active.cursorX;
    this._logService.debug("CommandDetectionCapability#handleRightPromptStart", this._currentCommand.commandRightPromptStartX);
  }
  handleRightPromptEnd() {
    this._currentCommand.commandRightPromptEndX = this._terminal.buffer.active.cursorX;
    this._logService.debug("CommandDetectionCapability#handleRightPromptEnd", this._currentCommand.commandRightPromptEndX);
  }
  handleCommandStart(options) {
    this._handleCommandStartOptions = options;
    this._currentCommand.cwd = this._cwd;
    this._currentCommand.commandStartMarker = options?.marker || this._currentCommand.commandStartMarker;
    if (this._currentCommand.commandStartMarker?.line === this._terminal.buffer.active.cursorY) {
      this._currentCommand.commandStartX = this._terminal.buffer.active.cursorX;
      this._onCommandStartChanged.fire();
      this._logService.debug("CommandDetectionCapability#handleCommandStart", this._currentCommand.commandStartX, this._currentCommand.commandStartMarker?.line);
      return;
    }
    this._ptyHeuristics.value.handleCommandStart(options);
  }
  handleCommandExecuted(options) {
    this._ptyHeuristics.value.handleCommandExecuted(options);
    this._currentCommand.markExecutedTime();
  }
  handleCommandFinished(exitCode, options) {
    if (!this._currentCommand.commandExecutedMarker) {
      this.handleCommandExecuted();
    }
    this._currentCommand.markFinishedTime();
    this._ptyHeuristics.value.preHandleCommandFinished?.();
    this._logService.debug("CommandDetectionCapability#handleCommandFinished", this._terminal.buffer.active.cursorX, options?.marker?.line, this._currentCommand.command, this._currentCommand);
    if (exitCode === void 0) {
      const lastCommand = this.commands.length > 0 ? this.commands[this.commands.length - 1] : void 0;
      if (this._currentCommand.command && this._currentCommand.command.length > 0 && lastCommand?.command === this._currentCommand.command) {
        exitCode = lastCommand.exitCode;
      }
    }
    if (this._currentCommand.commandStartMarker === void 0 || !this._terminal.buffer.active) {
      return;
    }
    this._currentCommand.commandFinishedMarker = options?.marker || this._terminal.registerMarker(0);
    this._ptyHeuristics.value.postHandleCommandFinished?.();
    const newCommand = this._currentCommand.promoteToFullCommand(this._cwd, exitCode, this._handleCommandStartOptions?.ignoreCommandLine ?? false, options?.markProperties);
    if (newCommand) {
      this._commands.push(newCommand);
      this._onBeforeCommandFinished.fire(newCommand);
      if (!this._currentCommand.isInvalid) {
        this._logService.debug("CommandDetectionCapability#onCommandFinished", newCommand);
        this._onCommandFinished.fire(newCommand);
      }
    }
    this._currentCommand = new PartialTerminalCommand(this._terminal);
    this._handleCommandStartOptions = void 0;
  }
  setCommandLine(commandLine, isTrusted) {
    this._logService.debug("CommandDetectionCapability#setCommandLine", commandLine, isTrusted);
    this._currentCommand.command = commandLine;
    this._currentCommand.commandLineConfidence = "high";
    this._currentCommand.isTrusted = isTrusted;
    if (isTrusted) {
      this._promptInputModel.setConfidentCommandLine(commandLine);
    }
  }
  serialize() {
    const commands = this.commands.map((e) => e.serialize(this.__isCommandStorageDisabled));
    const partialCommand = this._currentCommand.serialize(this._cwd);
    if (partialCommand) {
      commands.push(partialCommand);
    }
    return {
      isWindowsPty: this._ptyHeuristics.value instanceof WindowsPtyHeuristics,
      hasRichCommandDetection: this._hasRichCommandDetection,
      commands,
      promptInputModel: this._promptInputModel.serialize()
    };
  }
  deserialize(serialized) {
    if (serialized.isWindowsPty) {
      this.setIsWindowsPty(serialized.isWindowsPty);
    }
    if (serialized.hasRichCommandDetection) {
      this.setHasRichCommandDetection(serialized.hasRichCommandDetection);
    }
    const buffer = this._terminal.buffer.normal;
    for (const e of serialized.commands) {
      if (!e.endLine) {
        const marker = e.startLine !== void 0 ? this._terminal.registerMarker(e.startLine - (buffer.baseY + buffer.cursorY)) : void 0;
        if (!marker) {
          continue;
        }
        this._currentCommand.commandStartMarker = e.startLine !== void 0 ? this._terminal.registerMarker(e.startLine - (buffer.baseY + buffer.cursorY)) : void 0;
        this._currentCommand.commandStartX = e.startX;
        this._currentCommand.promptStartMarker = e.promptStartLine !== void 0 ? this._terminal.registerMarker(e.promptStartLine - (buffer.baseY + buffer.cursorY)) : void 0;
        this._cwd = e.cwd;
        this._onCommandStarted.fire({ marker });
        continue;
      }
      const newCommand = TerminalCommand.deserialize(this._terminal, e, this.__isCommandStorageDisabled);
      if (!newCommand) {
        continue;
      }
      this._commands.push(newCommand);
      this._logService.debug("CommandDetectionCapability#onCommandFinished", newCommand);
      this._onCommandFinished.fire(newCommand);
    }
    if (serialized.promptInputModel) {
      this._promptInputModel.deserialize(serialized.promptInputModel);
    }
  }
};
__decorateClass([
  debounce(500)
], CommandDetectionCapability.prototype, "_handleCursorMove", 1);
CommandDetectionCapability = __decorateClass([
  __decorateParam(1, ILogService)
], CommandDetectionCapability);
class UnixPtyHeuristics extends Disposable {
  constructor(_terminal, _capability, _hooks, _logService) {
    super();
    this._terminal = _terminal;
    this._capability = _capability;
    this._hooks = _hooks;
    this._logService = _logService;
    this._register(_terminal.parser.registerCsiHandler({ final: "J" }, (params) => {
      if (params.length >= 1 && (params[0] === 2 || params[0] === 3)) {
        _hooks.clearCommandsInViewport();
      }
      return false;
    }));
  }
  handleCommandStart(options) {
    const currentCommand = this._capability.currentCommand;
    currentCommand.commandStartX = this._terminal.buffer.active.cursorX;
    currentCommand.commandStartMarker = options?.marker || this._terminal.registerMarker(0);
    currentCommand.commandExecutedMarker?.dispose();
    currentCommand.commandExecutedMarker = void 0;
    currentCommand.commandExecutedX = void 0;
    for (const m of this._hooks.commandMarkers) {
      m.dispose();
    }
    this._hooks.commandMarkers.length = 0;
    this._hooks.onCommandStartedEmitter.fire({ marker: options?.marker || currentCommand.commandStartMarker, markProperties: options?.markProperties });
    this._logService.debug("CommandDetectionCapability#handleCommandStart", currentCommand.commandStartX, currentCommand.commandStartMarker?.line);
  }
  handleCommandExecuted(options) {
    const currentCommand = this._capability.currentCommand;
    currentCommand.commandExecutedMarker = options?.marker || this._terminal.registerMarker(0);
    currentCommand.commandExecutedX = this._terminal.buffer.active.cursorX;
    this._logService.debug("CommandDetectionCapability#handleCommandExecuted", currentCommand.commandExecutedX, currentCommand.commandExecutedMarker?.line);
    if (!currentCommand.commandStartMarker || !currentCommand.commandExecutedMarker || currentCommand.commandStartX === void 0) {
      return;
    }
    currentCommand.command = this._hooks.isCommandStorageDisabled ? "" : this._terminal.buffer.active.getLine(currentCommand.commandStartMarker.line)?.translateToString(true, currentCommand.commandStartX, currentCommand.commandRightPromptStartX).trim();
    let y = currentCommand.commandStartMarker.line + 1;
    const commandExecutedLine = currentCommand.commandExecutedMarker.line;
    for (; y < commandExecutedLine; y++) {
      const line = this._terminal.buffer.active.getLine(y);
      if (line) {
        const continuation = currentCommand.continuations?.find((e) => e.marker.line === y);
        if (continuation) {
          currentCommand.command += "\n";
        }
        const startColumn = continuation?.end ?? 0;
        currentCommand.command += line.translateToString(true, startColumn);
      }
    }
    if (y === commandExecutedLine) {
      currentCommand.command += this._terminal.buffer.active.getLine(commandExecutedLine)?.translateToString(true, void 0, currentCommand.commandExecutedX) || "";
    }
    this._hooks.onCommandExecutedEmitter.fire(currentCommand);
  }
}
var AdjustCommandStartMarkerConstants = /* @__PURE__ */ ((AdjustCommandStartMarkerConstants2) => {
  AdjustCommandStartMarkerConstants2[AdjustCommandStartMarkerConstants2["MaxCheckLineCount"] = 10] = "MaxCheckLineCount";
  AdjustCommandStartMarkerConstants2[AdjustCommandStartMarkerConstants2["Interval"] = 20] = "Interval";
  AdjustCommandStartMarkerConstants2[AdjustCommandStartMarkerConstants2["MaximumPollCount"] = 10] = "MaximumPollCount";
  return AdjustCommandStartMarkerConstants2;
})(AdjustCommandStartMarkerConstants || {});
let WindowsPtyHeuristics = class extends Disposable {
  constructor(_terminal, _capability, _hooks, _logService) {
    super();
    this._terminal = _terminal;
    this._capability = _capability;
    this._hooks = _hooks;
    this._logService = _logService;
    this._onCursorMoveListener = this._register(new MutableDisposable());
    this._tryAdjustCommandStartMarkerScannedLineCount = 0;
    this._tryAdjustCommandStartMarkerPollCount = 0;
    this._register(_terminal.parser.registerCsiHandler({ final: "J" }, (params) => {
      if (params.length >= 1 && (params[0] === 2 || params[0] === 3)) {
        this._hooks.clearCommandsInViewport();
      }
      return false;
    }));
    this._register(this._capability.onBeforeCommandFinished((command) => {
      if (command.command.trim().toLowerCase() === "clear" || command.command.trim().toLowerCase() === "cls") {
        this._tryAdjustCommandStartMarkerScheduler?.cancel();
        this._tryAdjustCommandStartMarkerScheduler = void 0;
        this._hooks.clearCommandsInViewport();
        this._capability.currentCommand.isInvalid = true;
        this._hooks.onCurrentCommandInvalidatedEmitter.fire({ reason: CommandInvalidationReason.Windows });
      }
    }));
  }
  preHandleResize(e) {
    const baseY = this._terminal.buffer.active.baseY;
    const rowsDifference = e.rows - this._hooks.dimensions.rows;
    if (rowsDifference > 0) {
      this._waitForCursorMove().then(() => {
        const potentialShiftedLineCount = Math.min(rowsDifference, baseY);
        for (let i = this._capability.commands.length - 1; i >= 0; i--) {
          const command = this._capability.commands[i];
          if (!command.marker || command.marker.line < baseY || command.commandStartLineContent === void 0) {
            break;
          }
          const line = this._terminal.buffer.active.getLine(command.marker.line);
          if (!line || line.translateToString(true) === command.commandStartLineContent) {
            continue;
          }
          const shiftedY = command.marker.line - potentialShiftedLineCount;
          const shiftedLine = this._terminal.buffer.active.getLine(shiftedY);
          if (shiftedLine?.translateToString(true) !== command.commandStartLineContent) {
            continue;
          }
          this._terminal._core._bufferService.buffer.lines.onDeleteEmitter.fire({
            index: this._terminal.buffer.active.baseY,
            amount: potentialShiftedLineCount
          });
        }
      });
    }
  }
  handleCommandStart() {
    this._capability.currentCommand.commandStartX = this._terminal.buffer.active.cursorX;
    this._hooks.commandMarkers.length = 0;
    const initialCommandStartMarker = this._capability.currentCommand.commandStartMarker = this._capability.currentCommand.promptStartMarker ? cloneMarker(this._terminal, this._capability.currentCommand.promptStartMarker) : this._terminal.registerMarker(0);
    this._capability.currentCommand.commandStartX = 0;
    this._tryAdjustCommandStartMarkerScannedLineCount = 0;
    this._tryAdjustCommandStartMarkerPollCount = 0;
    this._tryAdjustCommandStartMarkerScheduler = new RunOnceScheduler(() => this._tryAdjustCommandStartMarker(initialCommandStartMarker), 20 /* Interval */);
    this._tryAdjustCommandStartMarkerScheduler.schedule();
  }
  _tryAdjustCommandStartMarker(start) {
    if (this._store.isDisposed) {
      return;
    }
    const buffer = this._terminal.buffer.active;
    let scannedLineCount = this._tryAdjustCommandStartMarkerScannedLineCount;
    while (scannedLineCount < 10 /* MaxCheckLineCount */ && start.line + scannedLineCount < buffer.baseY + this._terminal.rows) {
      if (this._cursorOnNextLine()) {
        const prompt = this._getWindowsPrompt(start.line + scannedLineCount);
        if (prompt) {
          const adjustedPrompt = typeof prompt === "string" ? prompt : prompt.prompt;
          this._capability.currentCommand.commandStartMarker = this._terminal.registerMarker(0);
          if (typeof prompt === "object" && prompt.likelySingleLine) {
            this._logService.debug("CommandDetectionCapability#_tryAdjustCommandStartMarker adjusted promptStart", `${this._capability.currentCommand.promptStartMarker?.line} -> ${this._capability.currentCommand.commandStartMarker.line}`);
            this._capability.currentCommand.promptStartMarker?.dispose();
            this._capability.currentCommand.promptStartMarker = cloneMarker(this._terminal, this._capability.currentCommand.commandStartMarker);
            const lastCommand = this._capability.commands.at(-1);
            if (lastCommand && this._capability.currentCommand.commandStartMarker.line !== lastCommand.endMarker?.line) {
              lastCommand.endMarker?.dispose();
              lastCommand.endMarker = cloneMarker(this._terminal, this._capability.currentCommand.commandStartMarker);
            }
          }
          this._capability.currentCommand.commandStartX = adjustedPrompt.length;
          this._logService.debug("CommandDetectionCapability#_tryAdjustCommandStartMarker adjusted commandStart", `${start.line} -> ${this._capability.currentCommand.commandStartMarker.line}:${this._capability.currentCommand.commandStartX}`);
          this._flushPendingHandleCommandStartTask();
          return;
        }
      }
      scannedLineCount++;
    }
    if (scannedLineCount < 10 /* MaxCheckLineCount */) {
      this._tryAdjustCommandStartMarkerScannedLineCount = scannedLineCount;
      if (++this._tryAdjustCommandStartMarkerPollCount < 10 /* MaximumPollCount */) {
        this._tryAdjustCommandStartMarkerScheduler?.schedule();
      } else {
        this._flushPendingHandleCommandStartTask();
      }
    } else {
      this._flushPendingHandleCommandStartTask();
    }
  }
  _flushPendingHandleCommandStartTask() {
    if (this._tryAdjustCommandStartMarkerScheduler) {
      this._tryAdjustCommandStartMarkerPollCount = 10 /* MaximumPollCount */;
      this._tryAdjustCommandStartMarkerScheduler.flush();
      this._tryAdjustCommandStartMarkerScheduler = void 0;
    }
    if (!this._capability.currentCommand.commandExecutedMarker) {
      this._onCursorMoveListener.value = this._terminal.onCursorMove(() => {
        if (this._hooks.commandMarkers.length === 0 || this._hooks.commandMarkers[this._hooks.commandMarkers.length - 1].line !== this._terminal.buffer.active.cursorY) {
          const marker = this._terminal.registerMarker(0);
          if (marker) {
            this._hooks.commandMarkers.push(marker);
          }
        }
      });
    }
    if (this._capability.currentCommand.commandStartMarker) {
      const line = this._terminal.buffer.active.getLine(this._capability.currentCommand.commandStartMarker.line);
      if (line) {
        this._capability.currentCommand.commandStartLineContent = line.translateToString(true);
      }
    }
    this._hooks.onCommandStartedEmitter.fire({ marker: this._capability.currentCommand.commandStartMarker });
    this._logService.debug("CommandDetectionCapability#_handleCommandStartWindows", this._capability.currentCommand.commandStartX, this._capability.currentCommand.commandStartMarker?.line);
  }
  handleCommandExecuted(options) {
    if (this._tryAdjustCommandStartMarkerScheduler) {
      this._flushPendingHandleCommandStartTask();
    }
    this._onCursorMoveListener.clear();
    this._evaluateCommandMarkers();
    this._capability.currentCommand.commandExecutedX = this._terminal.buffer.active.cursorX;
    this._hooks.onCommandExecutedEmitter.fire(this._capability.currentCommand);
    this._logService.debug("CommandDetectionCapability#handleCommandExecuted", this._capability.currentCommand.commandExecutedX, this._capability.currentCommand.commandExecutedMarker?.line);
  }
  preHandleCommandFinished() {
    if (this._capability.currentCommand.commandExecutedMarker) {
      return;
    }
    if (this._hooks.commandMarkers.length === 0) {
      if (!this._capability.currentCommand.commandStartMarker) {
        this._capability.currentCommand.commandStartMarker = this._terminal.registerMarker(0);
      }
      if (this._capability.currentCommand.commandStartMarker) {
        this._hooks.commandMarkers.push(this._capability.currentCommand.commandStartMarker);
      }
    }
    this._evaluateCommandMarkers();
  }
  postHandleCommandFinished() {
    const currentCommand = this._capability.currentCommand;
    const commandText = currentCommand.command;
    const commandLine = currentCommand.commandStartMarker?.line;
    const executedLine = currentCommand.commandExecutedMarker?.line;
    if (!commandText || commandText.length === 0 || commandLine === void 0 || commandLine === -1 || executedLine === void 0 || executedLine === -1) {
      return;
    }
    let current = 0;
    let found = false;
    for (let i = commandLine; i <= executedLine; i++) {
      const line = this._terminal.buffer.active.getLine(i);
      if (!line) {
        break;
      }
      const text = line.translateToString(true);
      for (let j = 0; j < text.length; j++) {
        while (commandText.length < current && commandText[current] === " ") {
          current++;
        }
        if (text[j] === commandText[current]) {
          current++;
        }
        if (current === commandText.length) {
          const wrapsToNextLine = j >= this._terminal.cols - 1;
          currentCommand.commandExecutedMarker = this._terminal.registerMarker(i - (this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY) + (wrapsToNextLine ? 1 : 0));
          currentCommand.commandExecutedX = wrapsToNextLine ? 0 : j + 1;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
  }
  _evaluateCommandMarkers() {
    if (this._hooks.commandMarkers.length === 0) {
      return;
    }
    this._hooks.commandMarkers = this._hooks.commandMarkers.sort((a, b) => a.line - b.line);
    this._capability.currentCommand.commandStartMarker = this._hooks.commandMarkers[0];
    if (this._capability.currentCommand.commandStartMarker) {
      const line = this._terminal.buffer.active.getLine(this._capability.currentCommand.commandStartMarker.line);
      if (line) {
        this._capability.currentCommand.commandStartLineContent = line.translateToString(true);
      }
    }
    this._capability.currentCommand.commandExecutedMarker = this._hooks.commandMarkers[this._hooks.commandMarkers.length - 1];
    this._hooks.onCommandExecutedEmitter.fire(this._capability.currentCommand);
  }
  _cursorOnNextLine() {
    const lastCommand = this._capability.commands.at(-1);
    if (!lastCommand) {
      return true;
    }
    const cursorYAbsolute = this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY;
    const lastCommandYAbsolute = (lastCommand.endMarker ? lastCommand.endMarker.line : lastCommand.marker?.line) ?? -1;
    return cursorYAbsolute > lastCommandYAbsolute;
  }
  _waitForCursorMove() {
    const cursorX = this._terminal.buffer.active.cursorX;
    const cursorY = this._terminal.buffer.active.cursorY;
    let totalDelay = 0;
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (cursorX !== this._terminal.buffer.active.cursorX || cursorY !== this._terminal.buffer.active.cursorY) {
          resolve();
          clearInterval(interval);
          return;
        }
        totalDelay += 10;
        if (totalDelay > 1e3) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });
  }
  _getWindowsPrompt(y = this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY) {
    const line = this._terminal.buffer.active.getLine(y);
    if (!line) {
      return;
    }
    const lineText = line.translateToString(true);
    if (!lineText) {
      return;
    }
    const pwshPrompt = lineText.match(/(?<prompt>(\(.+\)\s)?(?:PS.+>\s?))/)?.groups?.prompt;
    if (pwshPrompt) {
      const adjustedPrompt = this._adjustPrompt(pwshPrompt, lineText, ">");
      if (adjustedPrompt) {
        return {
          prompt: adjustedPrompt,
          likelySingleLine: true
        };
      }
    }
    const customPrompt = lineText.match(/.*\u276f(?=[^\u276f]*$)/g)?.[0];
    if (customPrompt) {
      const adjustedPrompt = this._adjustPrompt(customPrompt, lineText, "\u276F");
      if (adjustedPrompt) {
        return adjustedPrompt;
      }
    }
    const bashPrompt = lineText.match(/^(?<prompt>\$)/)?.groups?.prompt;
    if (bashPrompt) {
      const adjustedPrompt = this._adjustPrompt(bashPrompt, lineText, "$");
      if (adjustedPrompt) {
        return adjustedPrompt;
      }
    }
    const pythonPrompt = lineText.match(/^(?<prompt>>>> )/g)?.groups?.prompt;
    if (pythonPrompt) {
      return {
        prompt: pythonPrompt,
        likelySingleLine: true
      };
    }
    if (this._capability.promptTerminator && lineText.trim().endsWith(this._capability.promptTerminator)) {
      const adjustedPrompt = this._adjustPrompt(lineText, lineText, this._capability.promptTerminator);
      if (adjustedPrompt) {
        return adjustedPrompt;
      }
    }
    const cmdMatch = lineText.match(/^(?<prompt>(\(.+\)\s)?(?:[A-Z]:\\.*>))/);
    return cmdMatch?.groups?.prompt ? {
      prompt: cmdMatch.groups.prompt,
      likelySingleLine: true
    } : void 0;
  }
  _adjustPrompt(prompt, lineText, char) {
    if (!prompt) {
      return;
    }
    if (lineText === prompt && prompt.endsWith(char)) {
      prompt += " ";
    }
    return prompt;
  }
};
WindowsPtyHeuristics = __decorateClass([
  __decorateParam(3, ILogService)
], WindowsPtyHeuristics);
function getLinesForCommand(buffer, command, cols, outputMatcher) {
  if (!outputMatcher) {
    return void 0;
  }
  const executedMarker = command.executedMarker;
  const endMarker = command.endMarker;
  if (!executedMarker || !endMarker) {
    return void 0;
  }
  const startLine = executedMarker.line;
  const endLine = endMarker.line;
  const linesToCheck = outputMatcher.length;
  const lines = [];
  if (outputMatcher.anchor === "bottom") {
    for (let i = endLine - (outputMatcher.offset || 0); i >= startLine; i--) {
      let wrappedLineStart = i;
      const wrappedLineEnd = i;
      while (wrappedLineStart >= startLine && buffer.getLine(wrappedLineStart)?.isWrapped) {
        wrappedLineStart--;
      }
      i = wrappedLineStart;
      lines.unshift(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, cols));
      if (lines.length > linesToCheck) {
        lines.pop();
      }
    }
  } else {
    for (let i = startLine + (outputMatcher.offset || 0); i < endLine; i++) {
      const wrappedLineStart = i;
      let wrappedLineEnd = i;
      while (wrappedLineEnd + 1 < endLine && buffer.getLine(wrappedLineEnd + 1)?.isWrapped) {
        wrappedLineEnd++;
      }
      i = wrappedLineEnd;
      lines.push(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, cols));
      if (lines.length === linesToCheck) {
        lines.shift();
      }
    }
  }
  return lines;
}
function getXtermLineContent(buffer, lineStart, lineEnd, cols) {
  const maxLineLength = Math.max(2048 / cols * 2);
  lineEnd = Math.min(lineEnd, lineStart + maxLineLength);
  let content = "";
  for (let i = lineStart; i <= lineEnd; i++) {
    const line = buffer.getLine(i);
    if (line) {
      content += line.translateToString(true, 0, cols);
    }
  }
  return content;
}
function cloneMarker(xterm, marker, offset = 0) {
  return xterm.registerMarker(marker.line - (xterm.buffer.active.baseY + xterm.buffer.active.cursorY) + offset);
}
export {
  CommandDetectionCapability,
  getLinesForCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGRlYm91bmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgTWFuZGF0b3J5TXV0YWJsZURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQ29tbWFuZEludmFsaWRhdGlvblJlYXNvbiwgSUNvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LCBJQ29tbWFuZEludmFsaWRhdGlvblJlcXVlc3QsIElIYW5kbGVDb21tYW5kT3B0aW9ucywgSVNlcmlhbGl6ZWRDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSwgSVNlcmlhbGl6ZWRUZXJtaW5hbENvbW1hbmQsIElUZXJtaW5hbENvbW1hbmQsIElYdGVybU1hcmtlciwgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsT3V0cHV0TWF0Y2hlciB9IGZyb20gJy4uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElDdXJyZW50UGFydGlhbENvbW1hbmQsIFBhcnRpYWxUZXJtaW5hbENvbW1hbmQsIFRlcm1pbmFsQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZERldGVjdGlvbi90ZXJtaW5hbENvbW1hbmQuanMnO1xuaW1wb3J0IHsgUHJvbXB0SW5wdXRNb2RlbCwgdHlwZSBJUHJvbXB0SW5wdXRNb2RlbCB9IGZyb20gJy4vY29tbWFuZERldGVjdGlvbi9wcm9tcHRJbnB1dE1vZGVsLmpzJztcbmltcG9ydCB0eXBlIHsgSUJ1ZmZlciwgSURpc3Bvc2FibGUsIElNYXJrZXIsIFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL2hlYWRsZXNzJztcblxuaW50ZXJmYWNlIElUZXJtaW5hbERpbWVuc2lvbnMge1xuXHRjb2xzOiBudW1iZXI7XG5cdHJvd3M6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSB7XG5cdHJlYWRvbmx5IHR5cGUgPSBUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm9tcHRJbnB1dE1vZGVsOiBQcm9tcHRJbnB1dE1vZGVsO1xuXHRnZXQgcHJvbXB0SW5wdXRNb2RlbCgpOiBJUHJvbXB0SW5wdXRNb2RlbCB7IHJldHVybiB0aGlzLl9wcm9tcHRJbnB1dE1vZGVsOyB9XG5cblx0cHJvdGVjdGVkIF9jb21tYW5kczogVGVybWluYWxDb21tYW5kW10gPSBbXTtcblx0cHJpdmF0ZSBfY3dkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Byb21wdFRlcm1pbmF0b3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY3VycmVudENvbW1hbmQ6IFBhcnRpYWxUZXJtaW5hbENvbW1hbmQgPSBuZXcgUGFydGlhbFRlcm1pbmFsQ29tbWFuZCh0aGlzLl90ZXJtaW5hbCk7XG5cdHByaXZhdGUgX2NvbW1hbmRNYXJrZXJzOiBJTWFya2VyW10gPSBbXTtcblx0cHJpdmF0ZSBfZGltZW5zaW9uczogSVRlcm1pbmFsRGltZW5zaW9ucztcblx0cHJpdmF0ZSBfX2lzQ29tbWFuZFN0b3JhZ2VEaXNhYmxlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9oYW5kbGVDb21tYW5kU3RhcnRPcHRpb25zPzogSUhhbmRsZUNvbW1hbmRPcHRpb25zO1xuXHRwcml2YXRlIF9oYXNSaWNoQ29tbWFuZERldGVjdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuXHRnZXQgaGFzUmljaENvbW1hbmREZXRlY3Rpb24oKSB7IHJldHVybiB0aGlzLl9oYXNSaWNoQ29tbWFuZERldGVjdGlvbjsgfVxuXG5cdHByaXZhdGUgX3B0eUhldXJpc3RpY3NIb29rczogSUNvbW1hbmREZXRlY3Rpb25IZXVyaXN0aWNzSG9va3M7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3B0eUhldXJpc3RpY3M6IE1hbmRhdG9yeU11dGFibGVEaXNwb3NhYmxlPElQdHlIZXVyaXN0aWNzPjtcblxuXHRnZXQgY29tbWFuZHMoKTogcmVhZG9ubHkgVGVybWluYWxDb21tYW5kW10geyByZXR1cm4gdGhpcy5fY29tbWFuZHM7IH1cblx0Z2V0IGV4ZWN1dGluZ0NvbW1hbmQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmQ7IH1cblx0Z2V0IGV4ZWN1dGluZ0NvbW1hbmRPYmplY3QoKTogSVRlcm1pbmFsQ29tbWFuZCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcikge1xuXHRcdFx0Ly8gSEFDSzogVGhpcyBkb2VzIGEgbG90IG1vcmUgdGhhbiB0aGUgY29uc3VtZXIgb2YgdGhlIEFQSSBuZWVkcy4gSXQncyBhbHNvIGEgbGl0dGxlXG5cdFx0XHQvLyAgICAgICBtaXNsZWFkaW5nIHNpbmNlIGl0J3Mgbm90IHByb21vdGluZyB0aGUgY3VycmVudCBjb21tYW5kIHlldC5cblx0XHRcdHJldHVybiB0aGlzLl9jdXJyZW50Q29tbWFuZC5wcm9tb3RlVG9GdWxsQ29tbWFuZCh0aGlzLl9jd2QsIHVuZGVmaW5lZCwgdGhpcy5faGFuZGxlQ29tbWFuZFN0YXJ0T3B0aW9ucz8uaWdub3JlQ29tbWFuZExpbmUgPz8gZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0Z2V0IGV4ZWN1dGluZ0NvbW1hbmRDb25maWRlbmNlKCk6ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNhc3RlZCA9IHRoaXMuX2N1cnJlbnRDb21tYW5kIGFzIFBhcnRpYWxUZXJtaW5hbENvbW1hbmQgfCBJVGVybWluYWxDb21tYW5kO1xuXHRcdHJldHVybiAnY29tbWFuZExpbmVDb25maWRlbmNlJyBpbiBjYXN0ZWQgPyBjYXN0ZWQuY29tbWFuZExpbmVDb25maWRlbmNlIDogdW5kZWZpbmVkO1xuXHR9XG5cdGdldCBjdXJyZW50Q29tbWFuZCgpOiBJQ3VycmVudFBhcnRpYWxDb21tYW5kIHtcblx0XHRyZXR1cm4gdGhpcy5fY3VycmVudENvbW1hbmQ7XG5cdH1cblx0Z2V0IGN3ZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fY3dkOyB9XG5cdGdldCBwcm9tcHRUZXJtaW5hdG9yKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9wcm9tcHRUZXJtaW5hdG9yOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Db21tYW5kU3RhcnRlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbENvbW1hbmQ+KCkpO1xuXHRyZWFkb25seSBvbkNvbW1hbmRTdGFydGVkID0gdGhpcy5fb25Db21tYW5kU3RhcnRlZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Db21tYW5kU3RhcnRDaGFuZ2VkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uQ29tbWFuZFN0YXJ0Q2hhbmdlZCA9IHRoaXMuX29uQ29tbWFuZFN0YXJ0Q2hhbmdlZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25CZWZvcmVDb21tYW5kRmluaXNoZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxDb21tYW5kPigpKTtcblx0cmVhZG9ubHkgb25CZWZvcmVDb21tYW5kRmluaXNoZWQgPSB0aGlzLl9vbkJlZm9yZUNvbW1hbmRGaW5pc2hlZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Db21tYW5kRmluaXNoZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxDb21tYW5kPigpKTtcblx0cmVhZG9ubHkgb25Db21tYW5kRmluaXNoZWQgPSB0aGlzLl9vbkNvbW1hbmRGaW5pc2hlZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Db21tYW5kRXhlY3V0ZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxDb21tYW5kPigpKTtcblx0cmVhZG9ubHkgb25Db21tYW5kRXhlY3V0ZWQgPSB0aGlzLl9vbkNvbW1hbmRFeGVjdXRlZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Db21tYW5kSW52YWxpZGF0ZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxDb21tYW5kW10+KCkpO1xuXHRyZWFkb25seSBvbkNvbW1hbmRJbnZhbGlkYXRlZCA9IHRoaXMuX29uQ29tbWFuZEludmFsaWRhdGVkLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkN1cnJlbnRDb21tYW5kSW52YWxpZGF0ZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ29tbWFuZEludmFsaWRhdGlvblJlcXVlc3Q+KCkpO1xuXHRyZWFkb25seSBvbkN1cnJlbnRDb21tYW5kSW52YWxpZGF0ZWQgPSB0aGlzLl9vbkN1cnJlbnRDb21tYW5kSW52YWxpZGF0ZWQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uU2V0UmljaENvbW1hbmREZXRlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25TZXRSaWNoQ29tbWFuZERldGVjdGlvbiA9IHRoaXMuX29uU2V0UmljaENvbW1hbmREZXRlY3Rpb24uZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGVybWluYWw6IFRlcm1pbmFsLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcHJvbXB0SW5wdXRNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQcm9tcHRJbnB1dE1vZGVsKHRoaXMuX3Rlcm1pbmFsLCB0aGlzLm9uQ29tbWFuZFN0YXJ0ZWQsIHRoaXMub25Db21tYW5kU3RhcnRDaGFuZ2VkLCB0aGlzLm9uQ29tbWFuZEV4ZWN1dGVkLCB0aGlzLl9sb2dTZXJ2aWNlKSk7XG5cblx0XHQvLyBQdWxsIGNvbW1hbmQgbGluZSBmcm9tIHRoZSBidWZmZXIgaWYgaXQgd2FzIG5vdCBzZXQgZXhwbGljaXRseVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25Db21tYW5kRXhlY3V0ZWQoY29tbWFuZCA9PiB7XG5cdFx0XHRpZiAoY29tbWFuZC5jb21tYW5kTGluZUNvbmZpZGVuY2UgIT09ICdoaWdoJykge1xuXHRcdFx0XHQvLyBIQUNLOiBvbkNvbW1hbmRFeGVjdXRlZCBhY3R1YWxseSBmaXJlZCB3aXRoIFBhcnRpYWxUZXJtaW5hbENvbW1hbmRcblx0XHRcdFx0Y29uc3QgdHlwZWRDb21tYW5kID0gKGNvbW1hbmQgYXMgSVRlcm1pbmFsQ29tbWFuZCB8IFBhcnRpYWxUZXJtaW5hbENvbW1hbmQpO1xuXHRcdFx0XHRjb21tYW5kLmNvbW1hbmQgPSB0eXBlZENvbW1hbmQuZXh0cmFjdENvbW1hbmRMaW5lKCk7XG5cdFx0XHRcdGNvbW1hbmQuY29tbWFuZExpbmVDb25maWRlbmNlID0gJ2xvdyc7XG5cblx0XHRcdFx0Ly8gSVRlcm1pbmFsQ29tbWFuZFxuXHRcdFx0XHRpZiAoJ2dldE91dHB1dCcgaW4gdHlwZWRDb21tYW5kKSB7XG5cdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0Ly8gTWFya2VycyBleGlzdFxuXHRcdFx0XHRcdFx0dHlwZWRDb21tYW5kLnByb21wdFN0YXJ0TWFya2VyICYmIHR5cGVkQ29tbWFuZC5tYXJrZXIgJiYgdHlwZWRDb21tYW5kLmV4ZWN1dGVkTWFya2VyICYmXG5cdFx0XHRcdFx0XHQvLyBTaW5nbGUgbGluZSBjb21tYW5kXG5cdFx0XHRcdFx0XHRjb21tYW5kLmNvbW1hbmQuaW5kZXhPZignXFxuJykgPT09IC0xICYmXG5cdFx0XHRcdFx0XHQvLyBTdGFydCBtYXJrZXIgaXMgbm90IG9uIHRoZSBsZWZ0LW1vc3QgY29sdW1uXG5cdFx0XHRcdFx0XHR0eXBlZENvbW1hbmQuc3RhcnRYICE9PSB1bmRlZmluZWQgJiYgdHlwZWRDb21tYW5kLnN0YXJ0WCA+IDBcblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdGNvbW1hbmQuY29tbWFuZExpbmVDb25maWRlbmNlID0gJ21lZGl1bSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFBhcnRpYWxUZXJtaW5hbENvbW1hbmRcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0Ly8gTWFya2VycyBleGlzdFxuXHRcdFx0XHRcdFx0dHlwZWRDb21tYW5kLnByb21wdFN0YXJ0TWFya2VyICYmIHR5cGVkQ29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIgJiYgdHlwZWRDb21tYW5kLmNvbW1hbmRFeGVjdXRlZE1hcmtlciAmJlxuXHRcdFx0XHRcdFx0Ly8gU2luZ2xlIGxpbmUgY29tbWFuZFxuXHRcdFx0XHRcdFx0Y29tbWFuZC5jb21tYW5kLmluZGV4T2YoJ1xcbicpID09PSAtMSAmJlxuXHRcdFx0XHRcdFx0Ly8gU3RhcnQgbWFya2VyIGlzIG5vdCBvbiB0aGUgbGVmdC1tb3N0IGNvbHVtblxuXHRcdFx0XHRcdFx0dHlwZWRDb21tYW5kLmNvbW1hbmRTdGFydFggIT09IHVuZGVmaW5lZCAmJiB0eXBlZENvbW1hbmQuY29tbWFuZFN0YXJ0WCA+IDBcblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdGNvbW1hbmQuY29tbWFuZExpbmVDb25maWRlbmNlID0gJ21lZGl1bSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gU2V0IHVwIHBsYXRmb3JtLXNwZWNpZmljIGJlaGF2aW9yc1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3B0eUhldXJpc3RpY3NIb29rcyA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElDb21tYW5kRGV0ZWN0aW9uSGV1cmlzdGljc0hvb2tzIHtcblx0XHRcdGdldCBvbkN1cnJlbnRDb21tYW5kSW52YWxpZGF0ZWRFbWl0dGVyKCkgeyByZXR1cm4gdGhhdC5fb25DdXJyZW50Q29tbWFuZEludmFsaWRhdGVkOyB9XG5cdFx0XHRnZXQgb25Db21tYW5kU3RhcnRlZEVtaXR0ZXIoKSB7IHJldHVybiB0aGF0Ll9vbkNvbW1hbmRTdGFydGVkOyB9XG5cdFx0XHRnZXQgb25Db21tYW5kRXhlY3V0ZWRFbWl0dGVyKCkgeyByZXR1cm4gdGhhdC5fb25Db21tYW5kRXhlY3V0ZWQ7IH1cblx0XHRcdGdldCBkaW1lbnNpb25zKCkgeyByZXR1cm4gdGhhdC5fZGltZW5zaW9uczsgfVxuXHRcdFx0Z2V0IGlzQ29tbWFuZFN0b3JhZ2VEaXNhYmxlZCgpIHsgcmV0dXJuIHRoYXQuX19pc0NvbW1hbmRTdG9yYWdlRGlzYWJsZWQ7IH1cblx0XHRcdGdldCBjb21tYW5kTWFya2VycygpIHsgcmV0dXJuIHRoYXQuX2NvbW1hbmRNYXJrZXJzOyB9XG5cdFx0XHRzZXQgY29tbWFuZE1hcmtlcnModmFsdWUpIHsgdGhhdC5fY29tbWFuZE1hcmtlcnMgPSB2YWx1ZTsgfVxuXHRcdFx0Z2V0IGNsZWFyQ29tbWFuZHNJblZpZXdwb3J0KCkgeyByZXR1cm4gdGhhdC5fY2xlYXJDb21tYW5kc0luVmlld3BvcnQuYmluZCh0aGF0KTsgfVxuXHRcdH07XG5cdFx0dGhpcy5fcHR5SGV1cmlzdGljcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNYW5kYXRvcnlNdXRhYmxlRGlzcG9zYWJsZShuZXcgVW5peFB0eUhldXJpc3RpY3ModGhpcy5fdGVybWluYWwsIHRoaXMsIHRoaXMuX3B0eUhldXJpc3RpY3NIb29rcywgdGhpcy5fbG9nU2VydmljZSkpKTtcblxuXHRcdHRoaXMuX2RpbWVuc2lvbnMgPSB7XG5cdFx0XHRjb2xzOiB0aGlzLl90ZXJtaW5hbC5jb2xzLFxuXHRcdFx0cm93czogdGhpcy5fdGVybWluYWwucm93c1xuXHRcdH07XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWwub25SZXNpemUoZSA9PiB0aGlzLl9oYW5kbGVSZXNpemUoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbC5vbkN1cnNvck1vdmUoKCkgPT4gdGhpcy5faGFuZGxlQ3Vyc29yTW92ZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVSZXNpemUoZTogeyBjb2xzOiBudW1iZXI7IHJvd3M6IG51bWJlciB9KSB7XG5cdFx0dGhpcy5fcHR5SGV1cmlzdGljcy52YWx1ZS5wcmVIYW5kbGVSZXNpemU/LihlKTtcblx0XHR0aGlzLl9kaW1lbnNpb25zLmNvbHMgPSBlLmNvbHM7XG5cdFx0dGhpcy5fZGltZW5zaW9ucy5yb3dzID0gZS5yb3dzO1xuXHR9XG5cblx0QGRlYm91bmNlKDUwMClcblx0cHJpdmF0ZSBfaGFuZGxlQ3Vyc29yTW92ZSgpIHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBFYXJseSB2ZXJzaW9ucyBvZiBjb25wdHkgZG8gbm90IGhhdmUgcmVhbCBzdXBwb3J0IGZvciBhbiBhbHQgYnVmZmVyLCBpbiBhZGRpdGlvbiBjZXJ0YWluXG5cdFx0Ly8gY29tbWFuZHMgc3VjaCBhcyB0c2Mgd2F0Y2ggd2lsbCB3cml0ZSB0byB0aGUgdG9wIG9mIHRoZSBub3JtYWwgYnVmZmVyLiBUaGUgZm9sbG93aW5nXG5cdFx0Ly8gY2hlY2tzIHdoZW4gdGhlIGN1cnNvciBoYXMgbW92ZWQgd2hpbGUgdGhlIG5vcm1hbCBidWZmZXIgaXMgZW1wdHkgYW5kIGlmIGl0IGlzIGFib3ZlIHRoZVxuXHRcdC8vIGN1cnJlbnQgY29tbWFuZCwgYWxsIGRlY29yYXRpb25zIHdpdGhpbiB0aGUgdmlld3BvcnQgd2lsbCBiZSBpbnZhbGlkYXRlZC5cblx0XHQvL1xuXHRcdC8vIFRoaXMgZnVuY3Rpb24gaXMgZGVib3VuY2VkIHNvIHRoYXQgdGhlIGN1cnNvciBpcyBvbmx5IGNoZWNrZWQgd2hlbiBpdCBpcyBzdGFibGUgc29cblx0XHQvLyBjb25wdHkncyBzY3JlZW4gcmVwcmludGluZyB3aWxsIG5vdCB0cmlnZ2VyIGRlY29yYXRpb24gY2xlYXJpbmcuXG5cdFx0Ly9cblx0XHQvLyBUaGlzIGlzIG1vc3RseSBhIHdvcmthcm91bmQgZm9yIFdpbmRvd3MgYnV0IGFwcGxpZXMgdG8gYWxsIE9TJyBiZWNhdXNlIG9mIHRoZSB0c2Mgd2F0Y2hcblx0XHQvLyBjYXNlLlxuXHRcdGlmICh0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlID09PSB0aGlzLl90ZXJtaW5hbC5idWZmZXIubm9ybWFsICYmIHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcikge1xuXHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuYmFzZVkgKyB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclkgPCB0aGlzLl9jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIubGluZSkge1xuXHRcdFx0XHR0aGlzLl9jbGVhckNvbW1hbmRzSW5WaWV3cG9ydCgpO1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50Q29tbWFuZC5pc0ludmFsaWQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9vbkN1cnJlbnRDb21tYW5kSW52YWxpZGF0ZWQuZmlyZSh7IHJlYXNvbjogQ29tbWFuZEludmFsaWRhdGlvblJlYXNvbi5XaW5kb3dzIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NsZWFyQ29tbWFuZHNJblZpZXdwb3J0KCk6IHZvaWQge1xuXHRcdC8vIEZpbmQgdGhlIG51bWJlciBvZiBjb21tYW5kcyBvbiB0aGUgdGFpbCBlbmQgb2YgdGhlIGFycmF5IHRoYXQgYXJlIHdpdGhpbiB0aGUgdmlld3BvcnRcblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGZvciAobGV0IGkgPSB0aGlzLl9jb21tYW5kcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgbGluZSA9IHRoaXMuX2NvbW1hbmRzW2ldLm1hcmtlcj8ubGluZTtcblx0XHRcdGlmIChsaW5lICYmIGxpbmUgPCB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmJhc2VZKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y291bnQrKztcblx0XHR9XG5cdFx0Ly8gUmVtb3ZlIHRoZW1cblx0XHRpZiAoY291bnQgPiAwKSB7XG5cdFx0XHR0aGlzLl9vbkNvbW1hbmRJbnZhbGlkYXRlZC5maXJlKHRoaXMuX2NvbW1hbmRzLnNwbGljZSh0aGlzLl9jb21tYW5kcy5sZW5ndGggLSBjb3VudCwgY291bnQpKTtcblx0XHR9XG5cdH1cblxuXHRzZXRDb250aW51YXRpb25Qcm9tcHQodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb21wdElucHV0TW9kZWwuc2V0Q29udGludWF0aW9uUHJvbXB0KHZhbHVlKTtcblx0fVxuXG5cdC8vIFRPRE86IFNpbXBsaWZ5IHRoaXMsIGNhbiBldmVyeXRoaW5nIHdvcmsgb2ZmIHRoZSBsYXN0IGxpbmU/XG5cdHNldFByb21wdFRlcm1pbmF0b3IocHJvbXB0VGVybWluYXRvcjogc3RyaW5nLCBsYXN0UHJvbXB0TGluZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjc2V0UHJvbXB0VGVybWluYXRvcicsIHByb21wdFRlcm1pbmF0b3IpO1xuXHRcdHRoaXMuX3Byb21wdFRlcm1pbmF0b3IgPSBwcm9tcHRUZXJtaW5hdG9yO1xuXHRcdHRoaXMuX3Byb21wdElucHV0TW9kZWwuc2V0TGFzdFByb21wdExpbmUobGFzdFByb21wdExpbmUpO1xuXHR9XG5cblx0c2V0Q3dkKHZhbHVlOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9jd2QgPSB2YWx1ZTtcblx0fVxuXG5cdHNldElzV2luZG93c1B0eSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdGlmICh2YWx1ZSAmJiAhKHRoaXMuX3B0eUhldXJpc3RpY3MudmFsdWUgaW5zdGFuY2VvZiBXaW5kb3dzUHR5SGV1cmlzdGljcykpIHtcblx0XHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy5fcHR5SGV1cmlzdGljcy52YWx1ZSA9IG5ldyBXaW5kb3dzUHR5SGV1cmlzdGljcyhcblx0XHRcdFx0dGhpcy5fdGVybWluYWwsXG5cdFx0XHRcdHRoaXMsXG5cdFx0XHRcdG5ldyBjbGFzcyB7XG5cdFx0XHRcdFx0Z2V0IG9uQ3VycmVudENvbW1hbmRJbnZhbGlkYXRlZEVtaXR0ZXIoKSB7IHJldHVybiB0aGF0Ll9vbkN1cnJlbnRDb21tYW5kSW52YWxpZGF0ZWQ7IH1cblx0XHRcdFx0XHRnZXQgb25Db21tYW5kU3RhcnRlZEVtaXR0ZXIoKSB7IHJldHVybiB0aGF0Ll9vbkNvbW1hbmRTdGFydGVkOyB9XG5cdFx0XHRcdFx0Z2V0IG9uQ29tbWFuZEV4ZWN1dGVkRW1pdHRlcigpIHsgcmV0dXJuIHRoYXQuX29uQ29tbWFuZEV4ZWN1dGVkOyB9XG5cdFx0XHRcdFx0Z2V0IGRpbWVuc2lvbnMoKSB7IHJldHVybiB0aGF0Ll9kaW1lbnNpb25zOyB9XG5cdFx0XHRcdFx0Z2V0IGlzQ29tbWFuZFN0b3JhZ2VEaXNhYmxlZCgpIHsgcmV0dXJuIHRoYXQuX19pc0NvbW1hbmRTdG9yYWdlRGlzYWJsZWQ7IH1cblx0XHRcdFx0XHRnZXQgY29tbWFuZE1hcmtlcnMoKSB7IHJldHVybiB0aGF0Ll9jb21tYW5kTWFya2VyczsgfVxuXHRcdFx0XHRcdHNldCBjb21tYW5kTWFya2Vycyh2YWx1ZSkgeyB0aGF0Ll9jb21tYW5kTWFya2VycyA9IHZhbHVlOyB9XG5cdFx0XHRcdFx0Z2V0IGNsZWFyQ29tbWFuZHNJblZpZXdwb3J0KCkgeyByZXR1cm4gdGhhdC5fY2xlYXJDb21tYW5kc0luVmlld3BvcnQuYmluZCh0aGF0KTsgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlXG5cdFx0XHQpO1xuXHRcdH0gZWxzZSBpZiAoIXZhbHVlICYmICEodGhpcy5fcHR5SGV1cmlzdGljcy52YWx1ZSBpbnN0YW5jZW9mIFVuaXhQdHlIZXVyaXN0aWNzKSkge1xuXHRcdFx0dGhpcy5fcHR5SGV1cmlzdGljcy52YWx1ZSA9IG5ldyBVbml4UHR5SGV1cmlzdGljcyh0aGlzLl90ZXJtaW5hbCwgdGhpcywgdGhpcy5fcHR5SGV1cmlzdGljc0hvb2tzLCB0aGlzLl9sb2dTZXJ2aWNlKTtcblx0XHR9XG5cdH1cblxuXHRzZXRIYXNSaWNoQ29tbWFuZERldGVjdGlvbih2YWx1ZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2hhc1JpY2hDb21tYW5kRGV0ZWN0aW9uID0gdmFsdWU7XG5cdFx0dGhpcy5fb25TZXRSaWNoQ29tbWFuZERldGVjdGlvbi5maXJlKHZhbHVlKTtcblx0fVxuXG5cdHNldElzQ29tbWFuZFN0b3JhZ2VEaXNhYmxlZCgpOiB2b2lkIHtcblx0XHR0aGlzLl9faXNDb21tYW5kU3RvcmFnZURpc2FibGVkID0gdHJ1ZTtcblx0fVxuXG5cdGdldENvbW1hbmRGb3JMaW5lKGxpbmU6IG51bWJlcik6IElUZXJtaW5hbENvbW1hbmQgfCBJQ3VycmVudFBhcnRpYWxDb21tYW5kIHwgdW5kZWZpbmVkIHtcblx0XHQvLyBIYW5kbGUgdGhlIGN1cnJlbnQgcGFydGlhbCBjb21tYW5kIGZpcnN0LCBhbnl0aGluZyBiZWxvdyBpdCdzIHByb21wdCBpcyBjb25zaWRlcmVkIHBhcnRcblx0XHQvLyBvZiB0aGUgY3VycmVudCBjb21tYW5kXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRDb21tYW5kLnByb21wdFN0YXJ0TWFya2VyICYmIGxpbmUgPj0gdGhpcy5fY3VycmVudENvbW1hbmQucHJvbXB0U3RhcnRNYXJrZXI/LmxpbmUpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jdXJyZW50Q29tbWFuZDtcblx0XHR9XG5cblx0XHQvLyBObyBjb21tYW5kc1xuXHRcdGlmICh0aGlzLl9jb21tYW5kcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gTGluZSBpcyBiZWZvcmUgYW55IHJlZ2lzdGVyZWQgY29tbWFuZHNcblx0XHRpZiAoKHRoaXMuX2NvbW1hbmRzWzBdLnByb21wdFN0YXJ0TWFya2VyID8/IHRoaXMuX2NvbW1hbmRzWzBdLm1hcmtlciEpLmxpbmUgPiBsaW5lKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIEl0ZXJhdGUgYmFja3dhcmRzIHRocm91Z2ggY29tbWFuZHMgdG8gZmluZCB0aGUgcmlnaHQgb25lXG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMuY29tbWFuZHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGlmICgodGhpcy5jb21tYW5kc1tpXS5wcm9tcHRTdGFydE1hcmtlciA/PyB0aGlzLmNvbW1hbmRzW2ldLm1hcmtlciEpLmxpbmUgPD0gbGluZSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5jb21tYW5kc1tpXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0Q3dkRm9yTGluZShsaW5lOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdC8vIEhhbmRsZSB0aGUgY3VycmVudCBwYXJ0aWFsIGNvbW1hbmQgZmlyc3QsIGFueXRoaW5nIGJlbG93IGl0J3MgcHJvbXB0IGlzIGNvbnNpZGVyZWQgcGFydFxuXHRcdC8vIG9mIHRoZSBjdXJyZW50IGNvbW1hbmRcblx0XHRpZiAodGhpcy5fY3VycmVudENvbW1hbmQucHJvbXB0U3RhcnRNYXJrZXIgJiYgbGluZSA+PSB0aGlzLl9jdXJyZW50Q29tbWFuZC5wcm9tcHRTdGFydE1hcmtlcj8ubGluZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2N3ZDtcblx0XHR9XG5cblx0XHRjb25zdCBjb21tYW5kID0gdGhpcy5nZXRDb21tYW5kRm9yTGluZShsaW5lKTtcblx0XHRpZiAoY29tbWFuZCAmJiAnY3dkJyBpbiBjb21tYW5kKSB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZC5jd2Q7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGhhbmRsZVByb21wdFN0YXJ0KG9wdGlvbnM/OiBJSGFuZGxlQ29tbWFuZE9wdGlvbnMpOiB2b2lkIHtcblx0XHQvLyBBZGp1c3QgdGhlIGxhc3QgY29tbWFuZCdzIGZpbmlzaGVkIG1hcmtlciB3aGVuIG5lZWRlZC4gVGhlIHN0YW5kYXJkIHBvc2l0aW9uIGZvciB0aGVcblx0XHQvLyBmaW5pc2hlZCBtYXJrZXIgYERgIHRvIGFwcGVhciBpcyBhdCB0aGUgc2FtZSBwb3NpdGlvbiBhcyB0aGUgZm9sbG93aW5nIHByb21wdCBzdGFydGVkXG5cdFx0Ly8gYEFgLlxuXHRcdGNvbnN0IGxhc3RDb21tYW5kID0gdGhpcy5jb21tYW5kcy5hdCgtMSk7XG5cdFx0aWYgKGxhc3RDb21tYW5kPy5lbmRNYXJrZXIgJiYgbGFzdENvbW1hbmQ/LmV4ZWN1dGVkTWFya2VyICYmIGxhc3RDb21tYW5kLmVuZE1hcmtlci5saW5lID09PSBsYXN0Q29tbWFuZC5leGVjdXRlZE1hcmtlci5saW5lKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSNoYW5kbGVQcm9tcHRTdGFydCBhZGp1c3RlZCBjb21tYW5kRmluaXNoZWQnLCBgJHtsYXN0Q29tbWFuZC5lbmRNYXJrZXIubGluZX0gLT4gJHtsYXN0Q29tbWFuZC5leGVjdXRlZE1hcmtlci5saW5lICsgMX1gKTtcblx0XHRcdGxhc3RDb21tYW5kLmVuZE1hcmtlciA9IGNsb25lTWFya2VyKHRoaXMuX3Rlcm1pbmFsLCBsYXN0Q29tbWFuZC5leGVjdXRlZE1hcmtlciwgMSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3VycmVudENvbW1hbmQucHJvbXB0U3RhcnRNYXJrZXIgPSBvcHRpb25zPy5tYXJrZXIgfHwgKGxhc3RDb21tYW5kPy5lbmRNYXJrZXIgPyBjbG9uZU1hcmtlcih0aGlzLl90ZXJtaW5hbCwgbGFzdENvbW1hbmQuZW5kTWFya2VyKSA6IHRoaXMuX3Rlcm1pbmFsLnJlZ2lzdGVyTWFya2VyKDApKTtcblxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0NvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5I2hhbmRsZVByb21wdFN0YXJ0JywgdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JYLCB0aGlzLl9jdXJyZW50Q29tbWFuZC5wcm9tcHRTdGFydE1hcmtlcj8ubGluZSk7XG5cdH1cblxuXHRoYW5kbGVDb250aW51YXRpb25TdGFydCgpOiB2b2lkIHtcblx0XHR0aGlzLl9jdXJyZW50Q29tbWFuZC5jdXJyZW50Q29udGludWF0aW9uTWFya2VyID0gdGhpcy5fdGVybWluYWwucmVnaXN0ZXJNYXJrZXIoMCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjaGFuZGxlQ29udGludWF0aW9uU3RhcnQnLCB0aGlzLl9jdXJyZW50Q29tbWFuZC5jdXJyZW50Q29udGludWF0aW9uTWFya2VyKTtcblx0fVxuXG5cdGhhbmRsZUNvbnRpbnVhdGlvbkVuZCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRDb21tYW5kLmN1cnJlbnRDb250aW51YXRpb25NYXJrZXIpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybignQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjaGFuZGxlQ29udGludWF0aW9uRW5kIFJlY2VpdmVkIGNvbnRpbnVhdGlvbiBlbmQgd2l0aG91dCBzdGFydCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbnRpbnVhdGlvbnMpIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbnRpbnVhdGlvbnMgPSBbXTtcblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudENvbW1hbmQuY29udGludWF0aW9ucy5wdXNoKHtcblx0XHRcdG1hcmtlcjogdGhpcy5fY3VycmVudENvbW1hbmQuY3VycmVudENvbnRpbnVhdGlvbk1hcmtlcixcblx0XHRcdGVuZDogdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JYXG5cdFx0fSk7XG5cdFx0dGhpcy5fY3VycmVudENvbW1hbmQuY3VycmVudENvbnRpbnVhdGlvbk1hcmtlciA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSNoYW5kbGVDb250aW51YXRpb25FbmQnLCB0aGlzLl9jdXJyZW50Q29tbWFuZC5jb250aW51YXRpb25zW3RoaXMuX2N1cnJlbnRDb21tYW5kLmNvbnRpbnVhdGlvbnMubGVuZ3RoIC0gMV0pO1xuXHR9XG5cblx0aGFuZGxlUmlnaHRQcm9tcHRTdGFydCgpOiB2b2lkIHtcblx0XHR0aGlzLl9jdXJyZW50Q29tbWFuZC5jb21tYW5kUmlnaHRQcm9tcHRTdGFydFggPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclg7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjaGFuZGxlUmlnaHRQcm9tcHRTdGFydCcsIHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmRSaWdodFByb21wdFN0YXJ0WCk7XG5cdH1cblxuXHRoYW5kbGVSaWdodFByb21wdEVuZCgpOiB2b2lkIHtcblx0XHR0aGlzLl9jdXJyZW50Q29tbWFuZC5jb21tYW5kUmlnaHRQcm9tcHRFbmRYID0gdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JYO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0NvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5I2hhbmRsZVJpZ2h0UHJvbXB0RW5kJywgdGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZFJpZ2h0UHJvbXB0RW5kWCk7XG5cdH1cblxuXHRoYW5kbGVDb21tYW5kU3RhcnQob3B0aW9ucz86IElIYW5kbGVDb21tYW5kT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuX2hhbmRsZUNvbW1hbmRTdGFydE9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kLmN3ZCA9IHRoaXMuX2N3ZDtcblx0XHQvLyBPbmx5IHVwZGF0ZSB0aGUgY29sdW1uIGlmIHRoZSBsaW5lIGhhcyBhbHJlYWR5IGJlZW4gc2V0XG5cdFx0dGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyID0gb3B0aW9ucz8ubWFya2VyIHx8IHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcjtcblx0XHRpZiAodGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyPy5saW5lID09PSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclkpIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydFggPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclg7XG5cdFx0XHR0aGlzLl9vbkNvbW1hbmRTdGFydENoYW5nZWQuZmlyZSgpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjaGFuZGxlQ29tbWFuZFN0YXJ0JywgdGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0WCwgdGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyPy5saW5lKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcHR5SGV1cmlzdGljcy52YWx1ZS5oYW5kbGVDb21tYW5kU3RhcnQob3B0aW9ucyk7XG5cdH1cblxuXHRoYW5kbGVDb21tYW5kRXhlY3V0ZWQob3B0aW9ucz86IElIYW5kbGVDb21tYW5kT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuX3B0eUhldXJpc3RpY3MudmFsdWUuaGFuZGxlQ29tbWFuZEV4ZWN1dGVkKG9wdGlvbnMpO1xuXHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kLm1hcmtFeGVjdXRlZFRpbWUoKTtcblx0fVxuXG5cdGhhbmRsZUNvbW1hbmRGaW5pc2hlZChleGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSUhhbmRsZUNvbW1hbmRPcHRpb25zKTogdm9pZCB7XG5cdFx0Ly8gQ29tbWFuZCBleGVjdXRlZCBtYXkgbm90IGhhdmUgaGFwcGVuZWQgeWV0LCBpZiBub3QgaGFuZGxlIGl0IG5vdyBzbyB0aGUgZXhwZWN0ZWQgZXZlbnRzXG5cdFx0Ly8gcHJvcGVybHkgcHJvcG9nYXRlLiBUaGlzIG1heSBjYXVzZSB0aGUgb3V0cHV0IHRvIHNob3cgdXAgaW4gdGhlIGNvbXB1dGVkIGNvbW1hbmQgbGluZSxcblx0XHQvLyBidXQgdGhlIGNvbW1hbmQgbGluZSBjb25maWRlbmNlIHdpbGwgYmUgbG93IGluIHRoZSBleHRlbnNpb24gaG9zdCBmb3IgZXhhbXBsZSBhbmRcblx0XHQvLyB0aGVyZWZvcmUgY2Fubm90IGJlIHRydXN0ZWQgYW55d2F5LlxuXHRcdGlmICghdGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyKSB7XG5cdFx0XHR0aGlzLmhhbmRsZUNvbW1hbmRFeGVjdXRlZCgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kLm1hcmtGaW5pc2hlZFRpbWUoKTtcblx0XHR0aGlzLl9wdHlIZXVyaXN0aWNzLnZhbHVlLnByZUhhbmRsZUNvbW1hbmRGaW5pc2hlZD8uKCk7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSNoYW5kbGVDb21tYW5kRmluaXNoZWQnLCB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclgsIG9wdGlvbnM/Lm1hcmtlcj8ubGluZSwgdGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZCwgdGhpcy5fY3VycmVudENvbW1hbmQpO1xuXG5cdFx0Ly8gSEFDSzogSGFuZGxlIGEgc3BlY2lhbCBjYXNlIG9uIHNvbWUgdmVyc2lvbnMgb2YgYmFzaCB3aGVyZSBpZGVudGljYWwgY29tbWFuZHMgZ2V0IG1lcmdlZFxuXHRcdC8vIGluIHRoZSBvdXRwdXQgb2YgYGhpc3RvcnlgLCB0aGlzIGRldGVjdHMgdGhhdCBjYXNlIGFuZCBzZXRzIHRoZSBleGl0IGNvZGUgdG8gdGhlIGxhc3Rcblx0XHQvLyBjb21tYW5kJ3MgZXhpdCBjb2RlLiBUaGlzIGNvdmVyZWQgdGhlIG1ham9yaXR5IG9mIGNhc2VzIGJ1dCB3aWxsIGZhaWwgaWYgdGhlIHNhbWUgY29tbWFuZFxuXHRcdC8vIHJ1bnMgd2l0aCBhIGRpZmZlcmVudCBleGl0IGNvZGUsIHRoYXQgd2lsbCBuZWVkIGEgbW9yZSByb2J1c3QgZml4IHdoZXJlIHdlIHNlbmQgdGhlXG5cdFx0Ly8gY29tbWFuZCBJRCBhbmQgZXhpdCBjb2RlIG92ZXIgdG8gdGhlIGNhcGFiaWxpdHkgdG8gYWRqdXN0IHRoZXJlLlxuXHRcdGlmIChleGl0Q29kZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBsYXN0Q29tbWFuZCA9IHRoaXMuY29tbWFuZHMubGVuZ3RoID4gMCA/IHRoaXMuY29tbWFuZHNbdGhpcy5jb21tYW5kcy5sZW5ndGggLSAxXSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50Q29tbWFuZC5jb21tYW5kICYmIHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmQubGVuZ3RoID4gMCAmJiBsYXN0Q29tbWFuZD8uY29tbWFuZCA9PT0gdGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZCkge1xuXHRcdFx0XHRleGl0Q29kZSA9IGxhc3RDb21tYW5kLmV4aXRDb2RlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIgPT09IHVuZGVmaW5lZCB8fCAhdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmRGaW5pc2hlZE1hcmtlciA9IG9wdGlvbnM/Lm1hcmtlciB8fCB0aGlzLl90ZXJtaW5hbC5yZWdpc3Rlck1hcmtlcigwKTtcblxuXHRcdHRoaXMuX3B0eUhldXJpc3RpY3MudmFsdWUucG9zdEhhbmRsZUNvbW1hbmRGaW5pc2hlZD8uKCk7XG5cblx0XHRjb25zdCBuZXdDb21tYW5kID0gdGhpcy5fY3VycmVudENvbW1hbmQucHJvbW90ZVRvRnVsbENvbW1hbmQodGhpcy5fY3dkLCBleGl0Q29kZSwgdGhpcy5faGFuZGxlQ29tbWFuZFN0YXJ0T3B0aW9ucz8uaWdub3JlQ29tbWFuZExpbmUgPz8gZmFsc2UsIG9wdGlvbnM/Lm1hcmtQcm9wZXJ0aWVzKTtcblxuXHRcdGlmIChuZXdDb21tYW5kKSB7XG5cdFx0XHR0aGlzLl9jb21tYW5kcy5wdXNoKG5ld0NvbW1hbmQpO1xuXHRcdFx0dGhpcy5fb25CZWZvcmVDb21tYW5kRmluaXNoZWQuZmlyZShuZXdDb21tYW5kKTtcblx0XHRcdGlmICghdGhpcy5fY3VycmVudENvbW1hbmQuaXNJbnZhbGlkKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0NvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5I29uQ29tbWFuZEZpbmlzaGVkJywgbmV3Q29tbWFuZCk7XG5cdFx0XHRcdHRoaXMuX29uQ29tbWFuZEZpbmlzaGVkLmZpcmUobmV3Q29tbWFuZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kID0gbmV3IFBhcnRpYWxUZXJtaW5hbENvbW1hbmQodGhpcy5fdGVybWluYWwpO1xuXHRcdHRoaXMuX2hhbmRsZUNvbW1hbmRTdGFydE9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRzZXRDb21tYW5kTGluZShjb21tYW5kTGluZTogc3RyaW5nLCBpc1RydXN0ZWQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSNzZXRDb21tYW5kTGluZScsIGNvbW1hbmRMaW5lLCBpc1RydXN0ZWQpO1xuXHRcdHRoaXMuX2N1cnJlbnRDb21tYW5kLmNvbW1hbmQgPSBjb21tYW5kTGluZTtcblx0XHR0aGlzLl9jdXJyZW50Q29tbWFuZC5jb21tYW5kTGluZUNvbmZpZGVuY2UgPSAnaGlnaCc7XG5cdFx0dGhpcy5fY3VycmVudENvbW1hbmQuaXNUcnVzdGVkID0gaXNUcnVzdGVkO1xuXG5cdFx0aWYgKGlzVHJ1c3RlZCkge1xuXHRcdFx0dGhpcy5fcHJvbXB0SW5wdXRNb2RlbC5zZXRDb25maWRlbnRDb21tYW5kTGluZShjb21tYW5kTGluZSk7XG5cdFx0fVxuXHR9XG5cblx0c2VyaWFsaXplKCk6IElTZXJpYWxpemVkQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkge1xuXHRcdGNvbnN0IGNvbW1hbmRzOiBJU2VyaWFsaXplZFRlcm1pbmFsQ29tbWFuZFtdID0gdGhpcy5jb21tYW5kcy5tYXAoZSA9PiBlLnNlcmlhbGl6ZSh0aGlzLl9faXNDb21tYW5kU3RvcmFnZURpc2FibGVkKSk7XG5cdFx0Y29uc3QgcGFydGlhbENvbW1hbmQgPSB0aGlzLl9jdXJyZW50Q29tbWFuZC5zZXJpYWxpemUodGhpcy5fY3dkKTtcblx0XHRpZiAocGFydGlhbENvbW1hbmQpIHtcblx0XHRcdGNvbW1hbmRzLnB1c2gocGFydGlhbENvbW1hbmQpO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0aXNXaW5kb3dzUHR5OiB0aGlzLl9wdHlIZXVyaXN0aWNzLnZhbHVlIGluc3RhbmNlb2YgV2luZG93c1B0eUhldXJpc3RpY3MsXG5cdFx0XHRoYXNSaWNoQ29tbWFuZERldGVjdGlvbjogdGhpcy5faGFzUmljaENvbW1hbmREZXRlY3Rpb24sXG5cdFx0XHRjb21tYW5kcyxcblx0XHRcdHByb21wdElucHV0TW9kZWw6IHRoaXMuX3Byb21wdElucHV0TW9kZWwuc2VyaWFsaXplKCksXG5cdFx0fTtcblx0fVxuXG5cdGRlc2VyaWFsaXplKHNlcmlhbGl6ZWQ6IElTZXJpYWxpemVkQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkpOiB2b2lkIHtcblx0XHRpZiAoc2VyaWFsaXplZC5pc1dpbmRvd3NQdHkpIHtcblx0XHRcdHRoaXMuc2V0SXNXaW5kb3dzUHR5KHNlcmlhbGl6ZWQuaXNXaW5kb3dzUHR5KTtcblx0XHR9XG5cdFx0aWYgKHNlcmlhbGl6ZWQuaGFzUmljaENvbW1hbmREZXRlY3Rpb24pIHtcblx0XHRcdHRoaXMuc2V0SGFzUmljaENvbW1hbmREZXRlY3Rpb24oc2VyaWFsaXplZC5oYXNSaWNoQ29tbWFuZERldGVjdGlvbik7XG5cdFx0fVxuXHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5ub3JtYWw7XG5cdFx0Zm9yIChjb25zdCBlIG9mIHNlcmlhbGl6ZWQuY29tbWFuZHMpIHtcblx0XHRcdC8vIFBhcnRpYWwgY29tbWFuZFxuXHRcdFx0aWYgKCFlLmVuZExpbmUpIHtcblx0XHRcdFx0Ly8gQ2hlY2sgZm9yIGludmFsaWQgY29tbWFuZFxuXHRcdFx0XHRjb25zdCBtYXJrZXIgPSBlLnN0YXJ0TGluZSAhPT0gdW5kZWZpbmVkID8gdGhpcy5fdGVybWluYWwucmVnaXN0ZXJNYXJrZXIoZS5zdGFydExpbmUgLSAoYnVmZmVyLmJhc2VZICsgYnVmZmVyLmN1cnNvclkpKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKCFtYXJrZXIpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIgPSBlLnN0YXJ0TGluZSAhPT0gdW5kZWZpbmVkID8gdGhpcy5fdGVybWluYWwucmVnaXN0ZXJNYXJrZXIoZS5zdGFydExpbmUgLSAoYnVmZmVyLmJhc2VZICsgYnVmZmVyLmN1cnNvclkpKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0WCA9IGUuc3RhcnRYO1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50Q29tbWFuZC5wcm9tcHRTdGFydE1hcmtlciA9IGUucHJvbXB0U3RhcnRMaW5lICE9PSB1bmRlZmluZWQgPyB0aGlzLl90ZXJtaW5hbC5yZWdpc3Rlck1hcmtlcihlLnByb21wdFN0YXJ0TGluZSAtIChidWZmZXIuYmFzZVkgKyBidWZmZXIuY3Vyc29yWSkpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9jd2QgPSBlLmN3ZDtcblx0XHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9uc1xuXHRcdFx0XHR0aGlzLl9vbkNvbW1hbmRTdGFydGVkLmZpcmUoeyBtYXJrZXIgfSBhcyBJVGVybWluYWxDb21tYW5kKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZ1bGwgY29tbWFuZFxuXHRcdFx0Y29uc3QgbmV3Q29tbWFuZCA9IFRlcm1pbmFsQ29tbWFuZC5kZXNlcmlhbGl6ZSh0aGlzLl90ZXJtaW5hbCwgZSwgdGhpcy5fX2lzQ29tbWFuZFN0b3JhZ2VEaXNhYmxlZCk7XG5cdFx0XHRpZiAoIW5ld0NvbW1hbmQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2NvbW1hbmRzLnB1c2gobmV3Q29tbWFuZCk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSNvbkNvbW1hbmRGaW5pc2hlZCcsIG5ld0NvbW1hbmQpO1xuXHRcdFx0dGhpcy5fb25Db21tYW5kRmluaXNoZWQuZmlyZShuZXdDb21tYW5kKTtcblx0XHR9XG5cdFx0aWYgKHNlcmlhbGl6ZWQucHJvbXB0SW5wdXRNb2RlbCkge1xuXHRcdFx0dGhpcy5fcHJvbXB0SW5wdXRNb2RlbC5kZXNlcmlhbGl6ZShzZXJpYWxpemVkLnByb21wdElucHV0TW9kZWwpO1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIEFkZGl0aW9uYWwgaG9va3MgdG8gcHJpdmF0ZSBtZXRob2RzIG9uIHtAbGluayBDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eX0gdGhhdCBhcmUgbmVlZGVkIGJ5IHRoZVxuICogaGV1cmlzdGljcyBvYmplY3RzLlxuICovXG5pbnRlcmZhY2UgSUNvbW1hbmREZXRlY3Rpb25IZXVyaXN0aWNzSG9va3Mge1xuXHRyZWFkb25seSBvbkN1cnJlbnRDb21tYW5kSW52YWxpZGF0ZWRFbWl0dGVyOiBFbWl0dGVyPElDb21tYW5kSW52YWxpZGF0aW9uUmVxdWVzdD47XG5cdHJlYWRvbmx5IG9uQ29tbWFuZFN0YXJ0ZWRFbWl0dGVyOiBFbWl0dGVyPElUZXJtaW5hbENvbW1hbmQ+O1xuXHRyZWFkb25seSBvbkNvbW1hbmRFeGVjdXRlZEVtaXR0ZXI6IEVtaXR0ZXI8SVRlcm1pbmFsQ29tbWFuZD47XG5cdHJlYWRvbmx5IGRpbWVuc2lvbnM6IElUZXJtaW5hbERpbWVuc2lvbnM7XG5cdHJlYWRvbmx5IGlzQ29tbWFuZFN0b3JhZ2VEaXNhYmxlZDogYm9vbGVhbjtcblxuXHRjb21tYW5kTWFya2VyczogSU1hcmtlcltdO1xuXG5cdGNsZWFyQ29tbWFuZHNJblZpZXdwb3J0KCk6IHZvaWQ7XG59XG5cbnR5cGUgSVB0eUhldXJpc3RpY3MgPSAoXG5cdC8vIEFsbCBvcHRpb25hbCBtZXRob2RzXG5cdFBhcnRpYWw8VW5peFB0eUhldXJpc3RpY3M+ICYgUGFydGlhbDxXaW5kb3dzUHR5SGV1cmlzdGljcz4gJlxuXHQvLyBBbGwgY29tbW9uIG1ldGhvZHNcblx0KFVuaXhQdHlIZXVyaXN0aWNzIHwgV2luZG93c1B0eUhldXJpc3RpY3MpICZcblx0SURpc3Bvc2FibGVcbik7XG5cbi8qKlxuICogTm9uLVdpbmRvd3Mtc3BlY2lmaWMgYmVoYXZpb3IuXG4gKi9cbmNsYXNzIFVuaXhQdHlIZXVyaXN0aWNzIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsOiBUZXJtaW5hbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jYXBhYmlsaXR5OiBDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ob29rczogSUNvbW1hbmREZXRlY3Rpb25IZXVyaXN0aWNzSG9va3MsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfdGVybWluYWwucGFyc2VyLnJlZ2lzdGVyQ3NpSGFuZGxlcih7IGZpbmFsOiAnSicgfSwgcGFyYW1zID0+IHtcblx0XHRcdGlmIChwYXJhbXMubGVuZ3RoID49IDEgJiYgKHBhcmFtc1swXSA9PT0gMiB8fCBwYXJhbXNbMF0gPT09IDMpKSB7XG5cdFx0XHRcdF9ob29rcy5jbGVhckNvbW1hbmRzSW5WaWV3cG9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gV2UgZG9uJ3Qgd2FudCB0byBvdmVycmlkZSB4dGVybS5qcycgZGVmYXVsdCBiZWhhdmlvciwganVzdCBhdWdtZW50IGl0XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSkpO1xuXHR9XG5cblx0aGFuZGxlQ29tbWFuZFN0YXJ0KG9wdGlvbnM/OiBJSGFuZGxlQ29tbWFuZE9wdGlvbnMpIHtcblx0XHRjb25zdCBjdXJyZW50Q29tbWFuZCA9IHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQ7XG5cdFx0Y3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0WCA9IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuY3Vyc29yWDtcblx0XHRjdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIgPSBvcHRpb25zPy5tYXJrZXIgfHwgdGhpcy5fdGVybWluYWwucmVnaXN0ZXJNYXJrZXIoMCk7XG5cblx0XHQvLyBDbGVhciBleGVjdXRlZCBhcyBpdCBtdXN0IGhhcHBlbiBhZnRlciBjb21tYW5kIHN0YXJ0XG5cdFx0Y3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyPy5kaXNwb3NlKCk7XG5cdFx0Y3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyID0gdW5kZWZpbmVkO1xuXHRcdGN1cnJlbnRDb21tYW5kLmNvbW1hbmRFeGVjdXRlZFggPSB1bmRlZmluZWQ7XG5cdFx0Zm9yIChjb25zdCBtIG9mIHRoaXMuX2hvb2tzLmNvbW1hbmRNYXJrZXJzKSB7XG5cdFx0XHRtLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0dGhpcy5faG9va3MuY29tbWFuZE1hcmtlcnMubGVuZ3RoID0gMDtcblxuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLWRhbmdlcm91cy10eXBlLWFzc2VydGlvbnNcblx0XHR0aGlzLl9ob29rcy5vbkNvbW1hbmRTdGFydGVkRW1pdHRlci5maXJlKHsgbWFya2VyOiBvcHRpb25zPy5tYXJrZXIgfHwgY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyLCBtYXJrUHJvcGVydGllczogb3B0aW9ucz8ubWFya1Byb3BlcnRpZXMgfSBhcyBJVGVybWluYWxDb21tYW5kKTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSNoYW5kbGVDb21tYW5kU3RhcnQnLCBjdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRYLCBjdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXI/LmxpbmUpO1xuXHR9XG5cblx0aGFuZGxlQ29tbWFuZEV4ZWN1dGVkKG9wdGlvbnM/OiBJSGFuZGxlQ29tbWFuZE9wdGlvbnMpIHtcblx0XHRjb25zdCBjdXJyZW50Q29tbWFuZCA9IHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQ7XG5cdFx0Y3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyID0gb3B0aW9ucz8ubWFya2VyIHx8IHRoaXMuX3Rlcm1pbmFsLnJlZ2lzdGVyTWFya2VyKDApO1xuXHRcdGN1cnJlbnRDb21tYW5kLmNvbW1hbmRFeGVjdXRlZFggPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclg7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjaGFuZGxlQ29tbWFuZEV4ZWN1dGVkJywgY3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkWCwgY3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyPy5saW5lKTtcblxuXHRcdC8vIFNhbml0eSBjaGVjayBvcHRpb25hbCBwcm9wc1xuXHRcdGlmICghY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyIHx8ICFjdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRNYXJrZXIgfHwgY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0WCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQ2FsY3VsYXRlIHRoZSBjb21tYW5kXG5cdFx0Y3VycmVudENvbW1hbmQuY29tbWFuZCA9IHRoaXMuX2hvb2tzLmlzQ29tbWFuZFN0b3JhZ2VEaXNhYmxlZCA/ICcnIDogdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5nZXRMaW5lKGN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlci5saW5lKT8udHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSwgY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0WCwgY3VycmVudENvbW1hbmQuY29tbWFuZFJpZ2h0UHJvbXB0U3RhcnRYKS50cmltKCk7XG5cdFx0bGV0IHkgPSBjdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIubGluZSArIDE7XG5cdFx0Y29uc3QgY29tbWFuZEV4ZWN1dGVkTGluZSA9IGN1cnJlbnRDb21tYW5kLmNvbW1hbmRFeGVjdXRlZE1hcmtlci5saW5lO1xuXHRcdGZvciAoOyB5IDwgY29tbWFuZEV4ZWN1dGVkTGluZTsgeSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5nZXRMaW5lKHkpO1xuXHRcdFx0aWYgKGxpbmUpIHtcblx0XHRcdFx0Y29uc3QgY29udGludWF0aW9uID0gY3VycmVudENvbW1hbmQuY29udGludWF0aW9ucz8uZmluZChlID0+IGUubWFya2VyLmxpbmUgPT09IHkpO1xuXHRcdFx0XHRpZiAoY29udGludWF0aW9uKSB7XG5cdFx0XHRcdFx0Y3VycmVudENvbW1hbmQuY29tbWFuZCArPSAnXFxuJztcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IGNvbnRpbnVhdGlvbj8uZW5kID8/IDA7XG5cdFx0XHRcdGN1cnJlbnRDb21tYW5kLmNvbW1hbmQgKz0gbGluZS50cmFuc2xhdGVUb1N0cmluZyh0cnVlLCBzdGFydENvbHVtbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh5ID09PSBjb21tYW5kRXhlY3V0ZWRMaW5lKSB7XG5cdFx0XHRjdXJyZW50Q29tbWFuZC5jb21tYW5kICs9IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuZ2V0TGluZShjb21tYW5kRXhlY3V0ZWRMaW5lKT8udHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSwgdW5kZWZpbmVkLCBjdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRYKSB8fCAnJztcblx0XHR9XG5cdFx0dGhpcy5faG9va3Mub25Db21tYW5kRXhlY3V0ZWRFbWl0dGVyLmZpcmUoY3VycmVudENvbW1hbmQgYXMgSVRlcm1pbmFsQ29tbWFuZCk7XG5cdH1cbn1cblxuY29uc3QgZW51bSBBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJDb25zdGFudHMge1xuXHRNYXhDaGVja0xpbmVDb3VudCA9IDEwLFxuXHRJbnRlcnZhbCA9IDIwLFxuXHRNYXhpbXVtUG9sbENvdW50ID0gMTAsXG59XG5cbi8qKlxuICogQW4gb2JqZWN0IHRoYXQgaW50ZWdyYXRlZCB3aXRoIGFuZCBkZWNvcmF0ZXMgdGhlIGNvbW1hbmQgZGV0ZWN0aW9uIGNhcGFiaWxpdHkgdG8gYWRkIGhldXJpc3RpY3NcbiAqIHRoYXQgYWRqdXN0IHZhcmlvdXMgbWFya2VycyB0byB3b3JrIGJldHRlciB3aXRoIFdpbmRvd3MgYW5kIENvblBUWS4gVGhpcyBpc24ndCBkZXBlbmRlZCB1cG9uIHRoZVxuICogZnJvbnRlbmQgT1MsIG9yIGV2ZW4gdGhlIGJhY2tlbmQgT1MsIGJ1dCB0aGUgYElzV2luZG93c2AgcHJvcGVydHkgd2hpY2ggdGVjaG5pY2FsbHkgYSBub24tV2luZG93c1xuICogY2xpZW50IGNhbiBlbWl0IChmb3IgZXhhbXBsZSBpbiB0ZXN0cykuXG4gKi9cbmNsYXNzIFdpbmRvd3NQdHlIZXVyaXN0aWNzIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25DdXJzb3JNb3ZlTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSBfdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2NoZWR1bGVyPzogUnVuT25jZVNjaGVkdWxlcjtcblx0cHJpdmF0ZSBfdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2Nhbm5lZExpbmVDb3VudDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyUG9sbENvdW50OiBudW1iZXIgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsOiBUZXJtaW5hbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jYXBhYmlsaXR5OiBDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ob29rczogSUNvbW1hbmREZXRlY3Rpb25IZXVyaXN0aWNzSG9va3MsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoX3Rlcm1pbmFsLnBhcnNlci5yZWdpc3RlckNzaUhhbmRsZXIoeyBmaW5hbDogJ0onIH0sIHBhcmFtcyA9PiB7XG5cdFx0XHQvLyBDbGVhciBjb21tYW5kcyB3aGVuIHRoZSB2aWV3cG9ydCBpcyBjbGVhcmVkXG5cdFx0XHRpZiAocGFyYW1zLmxlbmd0aCA+PSAxICYmIChwYXJhbXNbMF0gPT09IDIgfHwgcGFyYW1zWzBdID09PSAzKSkge1xuXHRcdFx0XHR0aGlzLl9ob29rcy5jbGVhckNvbW1hbmRzSW5WaWV3cG9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gV2UgZG9uJ3Qgd2FudCB0byBvdmVycmlkZSB4dGVybS5qcycgZGVmYXVsdCBiZWhhdmlvciwganVzdCBhdWdtZW50IGl0XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY2FwYWJpbGl0eS5vbkJlZm9yZUNvbW1hbmRGaW5pc2hlZChjb21tYW5kID0+IHtcblx0XHRcdC8vIEZvciBvbGRlciBXaW5kb3dzIGJhY2tlbmRzIHdlIGNhbm5vdCBsaXN0ZW4gdG8gQ1NJIEosIGluc3RlYWQgd2UgYXNzdW1lIHJ1bm5pbmcgY2xlYXJcblx0XHRcdC8vIG9yIGNscyB3aWxsIGNsZWFyIGFsbCBjb21tYW5kcyBpbiB0aGUgdmlld3BvcnQuIFRoaXMgaXMgbm90IHBlcmZlY3QgYnV0IGl0J3MgcmlnaHRcblx0XHRcdC8vIG1vc3Qgb2YgdGhlIHRpbWUuXG5cdFx0XHRpZiAoY29tbWFuZC5jb21tYW5kLnRyaW0oKS50b0xvd2VyQ2FzZSgpID09PSAnY2xlYXInIHx8IGNvbW1hbmQuY29tbWFuZC50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gJ2NscycpIHtcblx0XHRcdFx0dGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2NoZWR1bGVyPy5jYW5jZWwoKTtcblx0XHRcdFx0dGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2NoZWR1bGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9ob29rcy5jbGVhckNvbW1hbmRzSW5WaWV3cG9ydCgpO1xuXHRcdFx0XHR0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmlzSW52YWxpZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX2hvb2tzLm9uQ3VycmVudENvbW1hbmRJbnZhbGlkYXRlZEVtaXR0ZXIuZmlyZSh7IHJlYXNvbjogQ29tbWFuZEludmFsaWRhdGlvblJlYXNvbi5XaW5kb3dzIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByZUhhbmRsZVJlc2l6ZShlOiB7IGNvbHM6IG51bWJlcjsgcm93czogbnVtYmVyIH0pIHtcblx0XHQvLyBSZXNpemUgYmVoYXZpb3IgaXMgZGlmZmVyZW50IHVuZGVyIGNvbnB0eTsgaW5zdGVhZCBvZiBicmluZ2luZyBwYXJ0cyBvZiB0aGUgc2Nyb2xsYmFja1xuXHRcdC8vIGJhY2sgaW50byB0aGUgdmlld3BvcnQsIG5ldyBsaW5lcyBhcmUgaW5zZXJ0ZWQgYXQgdGhlIGJvdHRvbSAoaWUuIHRoZSBzYW1lIGJlaGF2aW9yIGFzIGlmXG5cdFx0Ly8gdGhlcmUgd2FzIG5vIHNjcm9sbGJhY2spLlxuXHRcdC8vXG5cdFx0Ly8gT24gcmVzaXplIHRoaXMgd29ya2Fyb3VuZCB3aWxsIHdhaXQgZm9yIGEgY29ucHR5IHJlcHJpbnQgdG8gb2NjdXIgYnkgd2FpdGluZyBmb3IgdGhlXG5cdFx0Ly8gY3Vyc29yIHRvIG1vdmUsIGl0IHdpbGwgdGhlbiBjYWxjdWxhdGUgdGhlIG51bWJlciBvZiBsaW5lcyB0aGF0IHRoZSBjb21tYW5kcyB3aXRoaW4gdGhlXG5cdFx0Ly8gdmlld3BvcnQgX21heSBoYXZlXyBzaGlmdGVkLiBBZnRlciB2ZXJpZnlpbmcgdGhlIGNvbnRlbnQgb2YgdGhlIGN1cnJlbnQgbGluZSBpc1xuXHRcdC8vIGluY29ycmVjdCwgdGhlIGxpbmUgYWZ0ZXIgc2hpZnRpbmcgaXMgY2hlY2tlZCBhbmQgaWYgdGhhdCBtYXRjaGVzIGRlbGV0ZSBldmVudHMgYXJlIGZpcmVkXG5cdFx0Ly8gb24gdGhlIHh0ZXJtLmpzIGJ1ZmZlciB0byBtb3ZlIHRoZSBtYXJrZXJzLlxuXHRcdC8vXG5cdFx0Ly8gV2hpbGUgYSBiaXQgaGFja3ksIHRoaXMgYXBwcm9hY2ggaXMgcXVpdGUgc2FmZSBhbmQgc2VlbXMgdG8gd29yayBncmVhdCBhdCBsZWFzdCBmb3IgcHdzaC5cblx0XHRjb25zdCBiYXNlWSA9IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuYmFzZVk7XG5cdFx0Y29uc3Qgcm93c0RpZmZlcmVuY2UgPSBlLnJvd3MgLSB0aGlzLl9ob29rcy5kaW1lbnNpb25zLnJvd3M7XG5cdFx0Ly8gT25seSBkbyB3aGVuIHJvd3MgaW5jcmVhc2UsIGRvIGluIHRoZSBuZXh0IGZyYW1lIGFzIHRoaXMgbmVlZHMgdG8gaGFwcGVuIGFmdGVyXG5cdFx0Ly8gY29ucHR5IHJlcHJpbnRzIHRoZSBzY3JlZW5cblx0XHRpZiAocm93c0RpZmZlcmVuY2UgPiAwKSB7XG5cdFx0XHR0aGlzLl93YWl0Rm9yQ3Vyc29yTW92ZSgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHQvLyBDYWxjdWxhdGUgdGhlIG51bWJlciBvZiBsaW5lcyB0aGUgY29udGVudCBtYXkgaGF2ZSBzaGlmdGVkLCB0aGlzIHdpbGwgbWF4IG91dCBhdFxuXHRcdFx0XHQvLyBzY3JvbGxiYWNrIGNvdW50IHNpbmNlIHRoZSBzdGFuZGFyZCBiZWhhdmlvciB3aWxsIGJlIHVzZWQgdGhlblxuXHRcdFx0XHRjb25zdCBwb3RlbnRpYWxTaGlmdGVkTGluZUNvdW50ID0gTWF0aC5taW4ocm93c0RpZmZlcmVuY2UsIGJhc2VZKTtcblx0XHRcdFx0Ly8gRm9yIGVhY2ggY29tbWFuZCB3aXRoaW4gdGhlIHZpZXdwb3J0LCBhc3N1bWUgY29tbWFuZHMgYXJlIGluIHRoZSBjb3JyZWN0IG9yZGVyXG5cdFx0XHRcdGZvciAobGV0IGkgPSB0aGlzLl9jYXBhYmlsaXR5LmNvbW1hbmRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IHRoaXMuX2NhcGFiaWxpdHkuY29tbWFuZHNbaV07XG5cdFx0XHRcdFx0aWYgKCFjb21tYW5kLm1hcmtlciB8fCBjb21tYW5kLm1hcmtlci5saW5lIDwgYmFzZVkgfHwgY29tbWFuZC5jb21tYW5kU3RhcnRMaW5lQ29udGVudCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgbGluZSA9IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuZ2V0TGluZShjb21tYW5kLm1hcmtlci5saW5lKTtcblx0XHRcdFx0XHRpZiAoIWxpbmUgfHwgbGluZS50cmFuc2xhdGVUb1N0cmluZyh0cnVlKSA9PT0gY29tbWFuZC5jb21tYW5kU3RhcnRMaW5lQ29udGVudCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHNoaWZ0ZWRZID0gY29tbWFuZC5tYXJrZXIubGluZSAtIHBvdGVudGlhbFNoaWZ0ZWRMaW5lQ291bnQ7XG5cdFx0XHRcdFx0Y29uc3Qgc2hpZnRlZExpbmUgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmdldExpbmUoc2hpZnRlZFkpO1xuXHRcdFx0XHRcdGlmIChzaGlmdGVkTGluZT8udHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSkgIT09IGNvbW1hbmQuY29tbWFuZFN0YXJ0TGluZUNvbnRlbnQpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBIQUNLOiB4dGVybS5qcyBkb2Vzbid0IGV4cG9zZSB0aGlzIGJ5IGRlc2lnbiBhcyBpdCdzIGFuIGludGVybmFsIGNvcmVcblx0XHRcdFx0XHQvLyBmdW5jdGlvbiBhbiBlbWJlZGRlciBjb3VsZCBlYXNpbHkgZG8gZGFtYWdlIHdpdGguIEFkZGl0aW9uYWxseSwgdGhpc1xuXHRcdFx0XHRcdC8vIGNhbid0IHJlYWxseSBiZSB1cHN0cmVhbWVkIHNpbmNlIHRoZSBldmVudCByZWxpZXMgb24gc2hlbGwgaW50ZWdyYXRpb24gdG9cblx0XHRcdFx0XHQvLyB2ZXJpZnkgdGhlIHNoaWZ0aW5nIGlzIG5lY2Vzc2FyeS5cblx0XHRcdFx0XHQodGhpcy5fdGVybWluYWwgYXMgYW55KS5fY29yZS5fYnVmZmVyU2VydmljZS5idWZmZXIubGluZXMub25EZWxldGVFbWl0dGVyLmZpcmUoe1xuXHRcdFx0XHRcdFx0aW5kZXg6IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuYmFzZVksXG5cdFx0XHRcdFx0XHRhbW91bnQ6IHBvdGVudGlhbFNoaWZ0ZWRMaW5lQ291bnRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlQ29tbWFuZFN0YXJ0KCkge1xuXHRcdHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0WCA9IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuY3Vyc29yWDtcblxuXHRcdC8vIE9uIFdpbmRvd3MgdHJhY2sgYWxsIGN1cnNvciBtb3ZlbWVudHMgYWZ0ZXIgdGhlIGNvbW1hbmQgc3RhcnQgc2VxdWVuY2Vcblx0XHR0aGlzLl9ob29rcy5jb21tYW5kTWFya2Vycy5sZW5ndGggPSAwO1xuXG5cdFx0Y29uc3QgaW5pdGlhbENvbW1hbmRTdGFydE1hcmtlciA9IHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyID0gKFxuXHRcdFx0dGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5wcm9tcHRTdGFydE1hcmtlclxuXHRcdFx0XHQ/IGNsb25lTWFya2VyKHRoaXMuX3Rlcm1pbmFsLCB0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLnByb21wdFN0YXJ0TWFya2VyKVxuXHRcdFx0XHQ6IHRoaXMuX3Rlcm1pbmFsLnJlZ2lzdGVyTWFya2VyKDApXG5cdFx0KSE7XG5cdFx0dGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRYID0gMDtcblxuXHRcdC8vIERFQlVHOiBBZGQgYSBkZWNvcmF0aW9uIGZvciB0aGUgb3JpZ2luYWwgdW5hZGp1c3RlZCBjb21tYW5kIHN0YXJ0IHBvc2l0aW9uXG5cdFx0Ly8gaWYgKCdyZWdpc3RlckRlY29yYXRpb24nIGluIHRoaXMuX3Rlcm1pbmFsKSB7XG5cdFx0Ly8gXHRjb25zdCBkID0gKHRoaXMuX3Rlcm1pbmFsIGFzIGFueSkucmVnaXN0ZXJEZWNvcmF0aW9uKHtcblx0XHQvLyBcdFx0bWFya2VyOiB0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcixcblx0XHQvLyBcdFx0eDogdGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRYXG5cdFx0Ly8gXHR9KTtcblx0XHQvLyBcdGQ/Lm9uUmVuZGVyKChlOiBIVE1MRWxlbWVudCkgPT4ge1xuXHRcdC8vIFx0XHRlLnRleHRDb250ZW50ID0gJ2InO1xuXHRcdC8vIFx0XHRlLmNsYXNzTGlzdC5hZGQoJ3h0ZXJtLXNlcXVlbmNlLWRlY29yYXRpb24nLCAndG9wJywgJ3JpZ2h0Jyk7XG5cdFx0Ly8gXHRcdGUudGl0bGUgPSAnSW5pdGlhbCBjb21tYW5kIHN0YXJ0IHBvc2l0aW9uJztcblx0XHQvLyBcdH0pO1xuXHRcdC8vIH1cblxuXHRcdC8vIFRoZSBjb21tYW5kIHN0YXJ0ZWQgc2VxdWVuY2UgbWF5IGJlIHByaW50ZWQgYmVmb3JlIHRoZSBhY3R1YWwgcHJvbXB0IGlzLCBmb3IgZXhhbXBsZSBhXG5cdFx0Ly8gbXVsdGktbGluZSBwcm9tcHQgd2lsbCB0eXBpY2FsbHkgbG9vayBsaWtlIHRoaXMgd2hlcmUgRCwgQSBhbmQgQiBzaWduaWZ5IHRoZSBjb21tYW5kXG5cdFx0Ly8gZmluaXNoZWQsIHByb21wdCBzdGFydGVkIGFuZCBjb21tYW5kIHN0YXJ0ZWQgc2VxdWVuY2VzIHJlc3BlY3RpdmVseTpcblx0XHQvL1xuXHRcdC8vICAgICBEL215L2N3ZEJcblx0XHQvLyAgICAgPiBDXG5cdFx0Ly9cblx0XHQvLyBEdWUgdG8gdGhpcywgaXQncyBsaWtlbHkgdGhhdCB0aGlzIHdpbGwgYmUgY2FsbGVkIGJlZm9yZSB0aGUgbGluZSBoYXMgYmVlbiBwYXJzZWQuXG5cdFx0Ly8gVW5mb3J0dW5hdGVseSwgaXQgaXMgYWxzbyB0aGUgY2FzZSB0aGF0IHRoZSBhY3R1YWwgY29tbWFuZCBzdGFydCBkYXRhIG1heSBub3QgYmUgcGFyc2VkXG5cdFx0Ly8gYnkgdGhlIGVuZCBvZiB0aGUgdGFzayBlaXRoZXIsIHNvIGEgbWljcm90YXNrIGNhbm5vdCBiZSB1c2VkLlxuXHRcdC8vXG5cdFx0Ly8gVGhlIHN0cmF0ZWd5IHVzZWQgaXMgdG8gYmVnaW4gcG9sbGluZyBhbmQgc2Nhbm5pbmcgZG93bndhcmRzIGZvciB1cCB0byB0aGUgbmV4dCA1IGxpbmVzLlxuXHRcdC8vIElmIGl0IGxvb2tzIGxpa2UgYSBwcm9tcHQgaXMgZm91bmQsIHRoZSBjb21tYW5kIHN0YXJ0ZWQgbG9jYXRpb24gaXMgYWRqdXN0ZWQuIElmIHRoZVxuXHRcdC8vIGNvbW1hbmQgZXhlY3V0ZWQgc2VxdWVuY2VzIGNvbWVzIGluIGJlZm9yZSBwb2xsaW5nIGlzIGRvbmUsIHBvbGxpbmcgaXMgY2FuY2VsZWQgYW5kIHRoZVxuXHRcdC8vIGZpbmFsIHBvbGxpbmcgdGFzayBpcyBleGVjdXRlZCBzeW5jaHJvbm91c2x5LlxuXHRcdHRoaXMuX3RyeUFkanVzdENvbW1hbmRTdGFydE1hcmtlclNjYW5uZWRMaW5lQ291bnQgPSAwO1xuXHRcdHRoaXMuX3RyeUFkanVzdENvbW1hbmRTdGFydE1hcmtlclBvbGxDb3VudCA9IDA7XG5cdFx0dGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyKGluaXRpYWxDb21tYW5kU3RhcnRNYXJrZXIpLCBBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJDb25zdGFudHMuSW50ZXJ2YWwpO1xuXHRcdHRoaXMuX3RyeUFkanVzdENvbW1hbmRTdGFydE1hcmtlclNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXG5cdFx0Ly8gVE9ETzogQ2FjaGUgZGV0YWlscyBhYm91dCBwb2xsaW5nIGZvciB0aGUgZnV0dXJlIC0gZWcuIGlmIGl0IGFsd2F5cyBmYWlscywgc3RvcCBib3RoZXJpbmdcblx0fVxuXG5cdHByaXZhdGUgX3RyeUFkanVzdENvbW1hbmRTdGFydE1hcmtlcihzdGFydDogSU1hcmtlcikge1xuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGJ1ZmZlciA9IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmU7XG5cdFx0bGV0IHNjYW5uZWRMaW5lQ291bnQgPSB0aGlzLl90cnlBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJTY2FubmVkTGluZUNvdW50O1xuXHRcdHdoaWxlIChzY2FubmVkTGluZUNvdW50IDwgQWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyQ29uc3RhbnRzLk1heENoZWNrTGluZUNvdW50ICYmIHN0YXJ0LmxpbmUgKyBzY2FubmVkTGluZUNvdW50IDwgYnVmZmVyLmJhc2VZICsgdGhpcy5fdGVybWluYWwucm93cykge1xuXHRcdFx0aWYgKHRoaXMuX2N1cnNvck9uTmV4dExpbmUoKSkge1xuXHRcdFx0XHRjb25zdCBwcm9tcHQgPSB0aGlzLl9nZXRXaW5kb3dzUHJvbXB0KHN0YXJ0LmxpbmUgKyBzY2FubmVkTGluZUNvdW50KTtcblx0XHRcdFx0aWYgKHByb21wdCkge1xuXHRcdFx0XHRcdGNvbnN0IGFkanVzdGVkUHJvbXB0ID0gdHlwZW9mIHByb21wdCA9PT0gJ3N0cmluZycgPyBwcm9tcHQgOiBwcm9tcHQucHJvbXB0O1xuXHRcdFx0XHRcdHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyID0gdGhpcy5fdGVybWluYWwucmVnaXN0ZXJNYXJrZXIoMCkhO1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgcHJvbXB0ID09PSAnb2JqZWN0JyAmJiBwcm9tcHQubGlrZWx5U2luZ2xlTGluZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjX3RyeUFkanVzdENvbW1hbmRTdGFydE1hcmtlciBhZGp1c3RlZCBwcm9tcHRTdGFydCcsIGAke3RoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQucHJvbXB0U3RhcnRNYXJrZXI/LmxpbmV9IC0+ICR7dGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIubGluZX1gKTtcblx0XHRcdFx0XHRcdHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQucHJvbXB0U3RhcnRNYXJrZXI/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQucHJvbXB0U3RhcnRNYXJrZXIgPSBjbG9uZU1hcmtlcih0aGlzLl90ZXJtaW5hbCwgdGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIpO1xuXHRcdFx0XHRcdFx0Ly8gQWRqdXN0IHRoZSBsYXN0IGNvbW1hbmQgaWYgaXQncyBub3QgaW4gdGhlIHNhbWUgcG9zaXRpb24gYXMgdGhlIGZvbGxvd2luZ1xuXHRcdFx0XHRcdFx0Ly8gcHJvbXB0IHN0YXJ0IG1hcmtlclxuXHRcdFx0XHRcdFx0Y29uc3QgbGFzdENvbW1hbmQgPSB0aGlzLl9jYXBhYmlsaXR5LmNvbW1hbmRzLmF0KC0xKTtcblx0XHRcdFx0XHRcdGlmIChsYXN0Q29tbWFuZCAmJiB0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlci5saW5lICE9PSBsYXN0Q29tbWFuZC5lbmRNYXJrZXI/LmxpbmUpIHtcblx0XHRcdFx0XHRcdFx0bGFzdENvbW1hbmQuZW5kTWFya2VyPy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdGxhc3RDb21tYW5kLmVuZE1hcmtlciA9IGNsb25lTWFya2VyKHRoaXMuX3Rlcm1pbmFsLCB0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIHVzZSB0aGUgcmVnZXggdG8gc2V0IHRoZSBwb3NpdGlvbiBhcyBpdCdzIHBvc3NpYmxlIGlucHV0IGhhcyBvY2N1cnJlZFxuXHRcdFx0XHRcdHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0WCA9IGFkanVzdGVkUHJvbXB0Lmxlbmd0aDtcblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSNfdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyIGFkanVzdGVkIGNvbW1hbmRTdGFydCcsIGAke3N0YXJ0LmxpbmV9IC0+ICR7dGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIubGluZX06JHt0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydFh9YCk7XG5cdFx0XHRcdFx0dGhpcy5fZmx1c2hQZW5kaW5nSGFuZGxlQ29tbWFuZFN0YXJ0VGFzaygpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c2Nhbm5lZExpbmVDb3VudCsrO1xuXHRcdH1cblx0XHRpZiAoc2Nhbm5lZExpbmVDb3VudCA8IEFkanVzdENvbW1hbmRTdGFydE1hcmtlckNvbnN0YW50cy5NYXhDaGVja0xpbmVDb3VudCkge1xuXHRcdFx0dGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2Nhbm5lZExpbmVDb3VudCA9IHNjYW5uZWRMaW5lQ291bnQ7XG5cdFx0XHRpZiAoKyt0aGlzLl90cnlBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJQb2xsQ291bnQgPCBBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJDb25zdGFudHMuTWF4aW11bVBvbGxDb3VudCkge1xuXHRcdFx0XHR0aGlzLl90cnlBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJTY2hlZHVsZXI/LnNjaGVkdWxlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9mbHVzaFBlbmRpbmdIYW5kbGVDb21tYW5kU3RhcnRUYXNrKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2ZsdXNoUGVuZGluZ0hhbmRsZUNvbW1hbmRTdGFydFRhc2soKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9mbHVzaFBlbmRpbmdIYW5kbGVDb21tYW5kU3RhcnRUYXNrKCkge1xuXHRcdC8vIFBlcmZvcm0gZmluYWwgdHJ5IGFkanVzdCBpZiBuZWNlc3Nhcnlcblx0XHRpZiAodGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2NoZWR1bGVyKSB7XG5cdFx0XHQvLyBNYXggb3V0IHBvbGwgY291bnQgdG8gZW5zdXJlIGl0J3MgdGhlIGxhc3QgcnVuXG5cdFx0XHR0aGlzLl90cnlBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJQb2xsQ291bnQgPSBBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJDb25zdGFudHMuTWF4aW11bVBvbGxDb3VudDtcblx0XHRcdHRoaXMuX3RyeUFkanVzdENvbW1hbmRTdGFydE1hcmtlclNjaGVkdWxlci5mbHVzaCgpO1xuXHRcdFx0dGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2NoZWR1bGVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRNYXJrZXIpIHtcblx0XHRcdHRoaXMuX29uQ3Vyc29yTW92ZUxpc3RlbmVyLnZhbHVlID0gdGhpcy5fdGVybWluYWwub25DdXJzb3JNb3ZlKCgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2hvb2tzLmNvbW1hbmRNYXJrZXJzLmxlbmd0aCA9PT0gMCB8fCB0aGlzLl9ob29rcy5jb21tYW5kTWFya2Vyc1t0aGlzLl9ob29rcy5jb21tYW5kTWFya2Vycy5sZW5ndGggLSAxXS5saW5lICE9PSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclkpIHtcblx0XHRcdFx0XHRjb25zdCBtYXJrZXIgPSB0aGlzLl90ZXJtaW5hbC5yZWdpc3Rlck1hcmtlcigwKTtcblx0XHRcdFx0XHRpZiAobWFya2VyKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9ob29rcy5jb21tYW5kTWFya2Vycy5wdXNoKG1hcmtlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIpIHtcblx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmdldExpbmUodGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIubGluZSk7XG5cdFx0XHRpZiAobGluZSkge1xuXHRcdFx0XHR0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydExpbmVDb250ZW50ID0gbGluZS50cmFuc2xhdGVUb1N0cmluZyh0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9uc1xuXHRcdHRoaXMuX2hvb2tzLm9uQ29tbWFuZFN0YXJ0ZWRFbWl0dGVyLmZpcmUoeyBtYXJrZXI6IHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyIH0gYXMgSVRlcm1pbmFsQ29tbWFuZCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjX2hhbmRsZUNvbW1hbmRTdGFydFdpbmRvd3MnLCB0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydFgsIHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyPy5saW5lKTtcblx0fVxuXG5cdGhhbmRsZUNvbW1hbmRFeGVjdXRlZChvcHRpb25zOiBJSGFuZGxlQ29tbWFuZE9wdGlvbnMgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fdHJ5QWRqdXN0Q29tbWFuZFN0YXJ0TWFya2VyU2NoZWR1bGVyKSB7XG5cdFx0XHR0aGlzLl9mbHVzaFBlbmRpbmdIYW5kbGVDb21tYW5kU3RhcnRUYXNrKCk7XG5cdFx0fVxuXHRcdC8vIFVzZSB0aGUgZ2F0aGVyZWQgY3Vyc29yIG1vdmUgbWFya2VycyB0byBjb3JyZWN0IHRoZSBjb21tYW5kIHN0YXJ0IGFuZCBleGVjdXRlZCBtYXJrZXJzXG5cdFx0dGhpcy5fb25DdXJzb3JNb3ZlTGlzdGVuZXIuY2xlYXIoKTtcblx0XHR0aGlzLl9ldmFsdWF0ZUNvbW1hbmRNYXJrZXJzKCk7XG5cdFx0dGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRYID0gdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JYO1xuXHRcdHRoaXMuX2hvb2tzLm9uQ29tbWFuZEV4ZWN1dGVkRW1pdHRlci5maXJlKHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQgYXMgSVRlcm1pbmFsQ29tbWFuZCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkjaGFuZGxlQ29tbWFuZEV4ZWN1dGVkJywgdGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRYLCB0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRFeGVjdXRlZE1hcmtlcj8ubGluZSk7XG5cdH1cblxuXHRwcmVIYW5kbGVDb21tYW5kRmluaXNoZWQoKSB7XG5cdFx0aWYgKHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIFRoaXMgaXMgZG9uZSBvbiBjb21tYW5kIGZpbmlzaGVkIGp1c3QgaW4gY2FzZSBjb21tYW5kIGV4ZWN1dGVkIG5ldmVyIGhhcHBlbnMgKGZvciBleGFtcGxlXG5cdFx0Ly8gUFNSZWFkTGluZSB0YWIgY29tcGxldGlvbilcblx0XHRpZiAodGhpcy5faG9va3MuY29tbWFuZE1hcmtlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvLyBJZiB0aGUgY29tbWFuZCBzdGFydCB0aW1lb3V0IGRvZXNuJ3QgaGFwcGVuIGJlZm9yZSBjb21tYW5kIGZpbmlzaGVkLCBqdXN0IHVzZSB0aGVcblx0XHRcdC8vIGN1cnJlbnQgbWFya2VyLlxuXHRcdFx0aWYgKCF0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcikge1xuXHRcdFx0XHR0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlciA9IHRoaXMuX3Rlcm1pbmFsLnJlZ2lzdGVyTWFya2VyKDApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQuY29tbWFuZFN0YXJ0TWFya2VyKSB7XG5cdFx0XHRcdHRoaXMuX2hvb2tzLmNvbW1hbmRNYXJrZXJzLnB1c2godGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9ldmFsdWF0ZUNvbW1hbmRNYXJrZXJzKCk7XG5cdH1cblxuXHRwb3N0SGFuZGxlQ29tbWFuZEZpbmlzaGVkKCk6IHZvaWQge1xuXHRcdGNvbnN0IGN1cnJlbnRDb21tYW5kID0gdGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZDtcblx0XHRjb25zdCBjb21tYW5kVGV4dCA9IGN1cnJlbnRDb21tYW5kLmNvbW1hbmQ7XG5cdFx0Y29uc3QgY29tbWFuZExpbmUgPSBjdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXI/LmxpbmU7XG5cdFx0Y29uc3QgZXhlY3V0ZWRMaW5lID0gY3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyPy5saW5lO1xuXHRcdGlmIChcblx0XHRcdCFjb21tYW5kVGV4dCB8fCBjb21tYW5kVGV4dC5sZW5ndGggPT09IDAgfHxcblx0XHRcdGNvbW1hbmRMaW5lID09PSB1bmRlZmluZWQgfHwgY29tbWFuZExpbmUgPT09IC0xIHx8XG5cdFx0XHRleGVjdXRlZExpbmUgPT09IHVuZGVmaW5lZCB8fCBleGVjdXRlZExpbmUgPT09IC0xXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU2NhbiBkb3dud2FyZHMgZnJvbSB0aGUgY29tbWFuZCBzdGFydCBsaW5lIGFuZCBzZWFyY2ggZm9yIGV2ZXJ5IGNoYXJhY3RlciBpbiB0aGUgYWN0dWFsXG5cdFx0Ly8gY29tbWFuZCBsaW5lLiBUaGlzIG1heSBlbmQgdXAgbWF0Y2hpbmcgdGhlIHdyb25nIGNoYXJhY3RlcnMsIGJ1dCBpdCBzaG91bGRuJ3QgbWF0dGVyIGF0XG5cdFx0Ly8gbGVhc3QgaW4gdGhlIHR5cGljYWwgY2FzZSBhcyB0aGUgZW50aXJlIGNvbW1hbmQgd2lsbCBzdGlsbCBnZXQgbWF0Y2hlZC5cblx0XHRsZXQgY3VycmVudCA9IDA7XG5cdFx0bGV0IGZvdW5kID0gZmFsc2U7XG5cdFx0Zm9yIChsZXQgaSA9IGNvbW1hbmRMaW5lOyBpIDw9IGV4ZWN1dGVkTGluZTsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5nZXRMaW5lKGkpO1xuXHRcdFx0aWYgKCFsaW5lKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdGV4dCA9IGxpbmUudHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSk7XG5cdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8IHRleHQubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0Ly8gU2tpcCB3aGl0ZXNwYWNlIGluIGNhc2UgaXQgd2FzIG5vdCBhY3R1YWxseSByZW5kZXJlZCBvciBjb3VsZCBiZSB0cmltbWVkIGZyb20gdGhlXG5cdFx0XHRcdC8vIGVuZCBvZiB0aGUgbGluZVxuXHRcdFx0XHR3aGlsZSAoY29tbWFuZFRleHQubGVuZ3RoIDwgY3VycmVudCAmJiBjb21tYW5kVGV4dFtjdXJyZW50XSA9PT0gJyAnKSB7XG5cdFx0XHRcdFx0Y3VycmVudCsrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQ2hhcmFjdGVyIG1hdGNoXG5cdFx0XHRcdGlmICh0ZXh0W2pdID09PSBjb21tYW5kVGV4dFtjdXJyZW50XSkge1xuXHRcdFx0XHRcdGN1cnJlbnQrKztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEZ1bGwgY29tbWFuZCBtYXRjaFxuXHRcdFx0XHRpZiAoY3VycmVudCA9PT0gY29tbWFuZFRleHQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Ly8gSXQncyBhbWJpZ3VvdXMgd2hldGhlciB0aGUgY29tbWFuZCBleGVjdXRlZCBtYXJrZXIgc2hvdWxkIGlkZWFsbHkgYXBwZWFyIGF0XG5cdFx0XHRcdFx0Ly8gdGhlIGVuZCBvZiB0aGUgbGluZSBvciBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBuZXh0IGxpbmUuIFNpbmNlIGl0J3MgbW9yZVxuXHRcdFx0XHRcdC8vIHVzZWZ1bCBmb3IgZXh0cmFjdGluZyB0aGUgY29tbWFuZCBhdCB0aGUgZW5kIG9mIHRoZSBjdXJyZW50IGxpbmUgd2UgZ28gd2l0aFxuXHRcdFx0XHRcdC8vIHRoYXQuXG5cdFx0XHRcdFx0Y29uc3Qgd3JhcHNUb05leHRMaW5lID0gaiA+PSB0aGlzLl90ZXJtaW5hbC5jb2xzIC0gMTtcblx0XHRcdFx0XHRjdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRNYXJrZXIgPSB0aGlzLl90ZXJtaW5hbC5yZWdpc3Rlck1hcmtlcihpIC0gKHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuYmFzZVkgKyB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclkpICsgKHdyYXBzVG9OZXh0TGluZSA/IDEgOiAwKSk7XG5cdFx0XHRcdFx0Y3VycmVudENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkWCA9IHdyYXBzVG9OZXh0TGluZSA/IDAgOiBqICsgMTtcblx0XHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9ldmFsdWF0ZUNvbW1hbmRNYXJrZXJzKCk6IHZvaWQge1xuXHRcdC8vIE9uIFdpbmRvd3MsIHVzZSB0aGUgZ2F0aGVyZWQgY3Vyc29yIG1vdmUgbWFya2VycyB0byBjb3JyZWN0IHRoZSBjb21tYW5kIHN0YXJ0IGFuZFxuXHRcdC8vIGV4ZWN1dGVkIG1hcmtlcnMuXG5cdFx0aWYgKHRoaXMuX2hvb2tzLmNvbW1hbmRNYXJrZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9ob29rcy5jb21tYW5kTWFya2VycyA9IHRoaXMuX2hvb2tzLmNvbW1hbmRNYXJrZXJzLnNvcnQoKGEsIGIpID0+IGEubGluZSAtIGIubGluZSk7XG5cdFx0dGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIgPSB0aGlzLl9ob29rcy5jb21tYW5kTWFya2Vyc1swXTtcblx0XHRpZiAodGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIpIHtcblx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmdldExpbmUodGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXIubGluZSk7XG5cdFx0XHRpZiAobGluZSkge1xuXHRcdFx0XHR0aGlzLl9jYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kLmNvbW1hbmRTdGFydExpbmVDb250ZW50ID0gbGluZS50cmFuc2xhdGVUb1N0cmluZyh0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fY2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRNYXJrZXIgPSB0aGlzLl9ob29rcy5jb21tYW5kTWFya2Vyc1t0aGlzLl9ob29rcy5jb21tYW5kTWFya2Vycy5sZW5ndGggLSAxXTtcblx0XHQvLyBGaXJlIHRoaXMgbm93IHRvIHByZXZlbnQgaXNzdWVzIGxpa2UgIzE5NzQwOVxuXHRcdHRoaXMuX2hvb2tzLm9uQ29tbWFuZEV4ZWN1dGVkRW1pdHRlci5maXJlKHRoaXMuX2NhcGFiaWxpdHkuY3VycmVudENvbW1hbmQgYXMgSVRlcm1pbmFsQ29tbWFuZCk7XG5cdH1cblxuXHRwcml2YXRlIF9jdXJzb3JPbk5leHRMaW5lKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGxhc3RDb21tYW5kID0gdGhpcy5fY2FwYWJpbGl0eS5jb21tYW5kcy5hdCgtMSk7XG5cblx0XHQvLyBUaGVyZSBpcyBvbmx5IGEgc2luZ2xlIGNvbW1hbmQsIHNvIHRoaXMgY2hlY2sgaXMgdW5uZWNlc3Nhcnlcblx0XHRpZiAoIWxhc3RDb21tYW5kKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBjdXJzb3JZQWJzb2x1dGUgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmJhc2VZICsgdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JZO1xuXHRcdC8vIElmIHRoZSBjdXJzb3IgcG9zaXRpb24gaXMgd2l0aGluIHRoZSBsYXN0IGNvbW1hbmQsIHdlIHNob3VsZCBwb2xsLlxuXHRcdGNvbnN0IGxhc3RDb21tYW5kWUFic29sdXRlID0gKGxhc3RDb21tYW5kLmVuZE1hcmtlciA/IGxhc3RDb21tYW5kLmVuZE1hcmtlci5saW5lIDogbGFzdENvbW1hbmQubWFya2VyPy5saW5lKSA/PyAtMTtcblx0XHRyZXR1cm4gY3Vyc29yWUFic29sdXRlID4gbGFzdENvbW1hbmRZQWJzb2x1dGU7XG5cdH1cblxuXHRwcml2YXRlIF93YWl0Rm9yQ3Vyc29yTW92ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjdXJzb3JYID0gdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JYO1xuXHRcdGNvbnN0IGN1cnNvclkgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclk7XG5cdFx0bGV0IHRvdGFsRGVsYXkgPSAwO1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdFx0aWYgKGN1cnNvclggIT09IHRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuY3Vyc29yWCB8fCBjdXJzb3JZICE9PSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclkpIHtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0Y2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRvdGFsRGVsYXkgKz0gMTA7XG5cdFx0XHRcdGlmICh0b3RhbERlbGF5ID4gMTAwMCkge1xuXHRcdFx0XHRcdGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMTApO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0V2luZG93c1Byb21wdCh5OiBudW1iZXIgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmJhc2VZICsgdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JZKTogc3RyaW5nIHwgeyBwcm9tcHQ6IHN0cmluZzsgbGlrZWx5U2luZ2xlTGluZTogdHJ1ZSB9IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBsaW5lID0gdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5nZXRMaW5lKHkpO1xuXHRcdGlmICghbGluZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lVGV4dCA9IGxpbmUudHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSk7XG5cdFx0aWYgKCFsaW5lVGV4dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFBvd2VyU2hlbGxcblx0XHRjb25zdCBwd3NoUHJvbXB0ID0gbGluZVRleHQubWF0Y2goLyg/PHByb21wdD4oXFwoLitcXClcXHMpPyg/OlBTLis+XFxzPykpLyk/Lmdyb3Vwcz8ucHJvbXB0O1xuXHRcdGlmIChwd3NoUHJvbXB0KSB7XG5cdFx0XHRjb25zdCBhZGp1c3RlZFByb21wdCA9IHRoaXMuX2FkanVzdFByb21wdChwd3NoUHJvbXB0LCBsaW5lVGV4dCwgJz4nKTtcblx0XHRcdGlmIChhZGp1c3RlZFByb21wdCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHByb21wdDogYWRqdXN0ZWRQcm9tcHQsXG5cdFx0XHRcdFx0bGlrZWx5U2luZ2xlTGluZTogdHJ1ZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEN1c3RvbSBwcm9tcHRzIGxpa2Ugc3RhcnNoaXAgZW5kIGluIHRoZSBjb21tb24gXFx1Mjc2ZiBjaGFyYWN0ZXJcblx0XHRjb25zdCBjdXN0b21Qcm9tcHQgPSBsaW5lVGV4dC5tYXRjaCgvLipcXHUyNzZmKD89W15cXHUyNzZmXSokKS9nKT8uWzBdO1xuXHRcdGlmIChjdXN0b21Qcm9tcHQpIHtcblx0XHRcdGNvbnN0IGFkanVzdGVkUHJvbXB0ID0gdGhpcy5fYWRqdXN0UHJvbXB0KGN1c3RvbVByb21wdCwgbGluZVRleHQsICdcXHUyNzZmJyk7XG5cdFx0XHRpZiAoYWRqdXN0ZWRQcm9tcHQpIHtcblx0XHRcdFx0cmV0dXJuIGFkanVzdGVkUHJvbXB0O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEJhc2ggUHJvbXB0XG5cdFx0Y29uc3QgYmFzaFByb21wdCA9IGxpbmVUZXh0Lm1hdGNoKC9eKD88cHJvbXB0PlxcJCkvKT8uZ3JvdXBzPy5wcm9tcHQ7XG5cdFx0aWYgKGJhc2hQcm9tcHQpIHtcblx0XHRcdGNvbnN0IGFkanVzdGVkUHJvbXB0ID0gdGhpcy5fYWRqdXN0UHJvbXB0KGJhc2hQcm9tcHQsIGxpbmVUZXh0LCAnJCcpO1xuXHRcdFx0aWYgKGFkanVzdGVkUHJvbXB0KSB7XG5cdFx0XHRcdHJldHVybiBhZGp1c3RlZFByb21wdDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBQeXRob24gUHJvbXB0XG5cdFx0Y29uc3QgcHl0aG9uUHJvbXB0ID0gbGluZVRleHQubWF0Y2goL14oPzxwcm9tcHQ+Pj4+ICkvZyk/Lmdyb3Vwcz8ucHJvbXB0O1xuXHRcdGlmIChweXRob25Qcm9tcHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHByb21wdDogcHl0aG9uUHJvbXB0LFxuXHRcdFx0XHRsaWtlbHlTaW5nbGVMaW5lOiB0cnVlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIER5bmFtaWMgcHJvbXB0IGRldGVjdGlvblxuXHRcdGlmICh0aGlzLl9jYXBhYmlsaXR5LnByb21wdFRlcm1pbmF0b3IgJiYgbGluZVRleHQudHJpbSgpLmVuZHNXaXRoKHRoaXMuX2NhcGFiaWxpdHkucHJvbXB0VGVybWluYXRvcikpIHtcblx0XHRcdGNvbnN0IGFkanVzdGVkUHJvbXB0ID0gdGhpcy5fYWRqdXN0UHJvbXB0KGxpbmVUZXh0LCBsaW5lVGV4dCwgdGhpcy5fY2FwYWJpbGl0eS5wcm9tcHRUZXJtaW5hdG9yKTtcblx0XHRcdGlmIChhZGp1c3RlZFByb21wdCkge1xuXHRcdFx0XHRyZXR1cm4gYWRqdXN0ZWRQcm9tcHQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ29tbWFuZCBQcm9tcHRcblx0XHRjb25zdCBjbWRNYXRjaCA9IGxpbmVUZXh0Lm1hdGNoKC9eKD88cHJvbXB0PihcXCguK1xcKVxccyk/KD86W0EtWl06XFxcXC4qPikpLyk7XG5cdFx0cmV0dXJuIGNtZE1hdGNoPy5ncm91cHM/LnByb21wdCA/IHtcblx0XHRcdHByb21wdDogY21kTWF0Y2guZ3JvdXBzLnByb21wdCxcblx0XHRcdGxpa2VseVNpbmdsZUxpbmU6IHRydWVcblx0XHR9IDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWRqdXN0UHJvbXB0KHByb21wdDogc3RyaW5nIHwgdW5kZWZpbmVkLCBsaW5lVGV4dDogc3RyaW5nLCBjaGFyOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICghcHJvbXB0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIENvbnB0eSBtYXkgbm90ICdyZW5kZXInIHRoZSBzcGFjZSBhdCB0aGUgZW5kIG9mIHRoZSBwcm9tcHRcblx0XHRpZiAobGluZVRleHQgPT09IHByb21wdCAmJiBwcm9tcHQuZW5kc1dpdGgoY2hhcikpIHtcblx0XHRcdHByb21wdCArPSAnICc7XG5cdFx0fVxuXHRcdHJldHVybiBwcm9tcHQ7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldExpbmVzRm9yQ29tbWFuZChidWZmZXI6IElCdWZmZXIsIGNvbW1hbmQ6IElUZXJtaW5hbENvbW1hbmQsIGNvbHM6IG51bWJlciwgb3V0cHV0TWF0Y2hlcj86IElUZXJtaW5hbE91dHB1dE1hdGNoZXIpOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCB7XG5cdGlmICghb3V0cHV0TWF0Y2hlcikge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0Y29uc3QgZXhlY3V0ZWRNYXJrZXIgPSBjb21tYW5kLmV4ZWN1dGVkTWFya2VyO1xuXHRjb25zdCBlbmRNYXJrZXIgPSBjb21tYW5kLmVuZE1hcmtlcjtcblx0aWYgKCFleGVjdXRlZE1hcmtlciB8fCAhZW5kTWFya2VyKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCBzdGFydExpbmUgPSBleGVjdXRlZE1hcmtlci5saW5lO1xuXHRjb25zdCBlbmRMaW5lID0gZW5kTWFya2VyLmxpbmU7XG5cblx0Y29uc3QgbGluZXNUb0NoZWNrID0gb3V0cHV0TWF0Y2hlci5sZW5ndGg7XG5cdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXHRpZiAob3V0cHV0TWF0Y2hlci5hbmNob3IgPT09ICdib3R0b20nKSB7XG5cdFx0Zm9yIChsZXQgaSA9IGVuZExpbmUgLSAob3V0cHV0TWF0Y2hlci5vZmZzZXQgfHwgMCk7IGkgPj0gc3RhcnRMaW5lOyBpLS0pIHtcblx0XHRcdGxldCB3cmFwcGVkTGluZVN0YXJ0ID0gaTtcblx0XHRcdGNvbnN0IHdyYXBwZWRMaW5lRW5kID0gaTtcblx0XHRcdHdoaWxlICh3cmFwcGVkTGluZVN0YXJ0ID49IHN0YXJ0TGluZSAmJiBidWZmZXIuZ2V0TGluZSh3cmFwcGVkTGluZVN0YXJ0KT8uaXNXcmFwcGVkKSB7XG5cdFx0XHRcdHdyYXBwZWRMaW5lU3RhcnQtLTtcblx0XHRcdH1cblx0XHRcdGkgPSB3cmFwcGVkTGluZVN0YXJ0O1xuXHRcdFx0bGluZXMudW5zaGlmdChnZXRYdGVybUxpbmVDb250ZW50KGJ1ZmZlciwgd3JhcHBlZExpbmVTdGFydCwgd3JhcHBlZExpbmVFbmQsIGNvbHMpKTtcblx0XHRcdGlmIChsaW5lcy5sZW5ndGggPiBsaW5lc1RvQ2hlY2spIHtcblx0XHRcdFx0bGluZXMucG9wKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGZvciAobGV0IGkgPSBzdGFydExpbmUgKyAob3V0cHV0TWF0Y2hlci5vZmZzZXQgfHwgMCk7IGkgPCBlbmRMaW5lOyBpKyspIHtcblx0XHRcdGNvbnN0IHdyYXBwZWRMaW5lU3RhcnQgPSBpO1xuXHRcdFx0bGV0IHdyYXBwZWRMaW5lRW5kID0gaTtcblx0XHRcdHdoaWxlICh3cmFwcGVkTGluZUVuZCArIDEgPCBlbmRMaW5lICYmIGJ1ZmZlci5nZXRMaW5lKHdyYXBwZWRMaW5lRW5kICsgMSk/LmlzV3JhcHBlZCkge1xuXHRcdFx0XHR3cmFwcGVkTGluZUVuZCsrO1xuXHRcdFx0fVxuXHRcdFx0aSA9IHdyYXBwZWRMaW5lRW5kO1xuXHRcdFx0bGluZXMucHVzaChnZXRYdGVybUxpbmVDb250ZW50KGJ1ZmZlciwgd3JhcHBlZExpbmVTdGFydCwgd3JhcHBlZExpbmVFbmQsIGNvbHMpKTtcblx0XHRcdGlmIChsaW5lcy5sZW5ndGggPT09IGxpbmVzVG9DaGVjaykge1xuXHRcdFx0XHRsaW5lcy5zaGlmdCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gbGluZXM7XG59XG5cbmZ1bmN0aW9uIGdldFh0ZXJtTGluZUNvbnRlbnQoYnVmZmVyOiBJQnVmZmVyLCBsaW5lU3RhcnQ6IG51bWJlciwgbGluZUVuZDogbnVtYmVyLCBjb2xzOiBudW1iZXIpOiBzdHJpbmcge1xuXHQvLyBDYXAgdGhlIG1heGltdW0gbnVtYmVyIG9mIGxpbmVzIGdlbmVyYXRlZCB0byBwcmV2ZW50IHBvdGVudGlhbCBwZXJmb3JtYW5jZSBwcm9ibGVtcy4gVGhpcyBpc1xuXHQvLyBtb3JlIG9mIGEgc2FuaXR5IGNoZWNrIGFzIHRoZSB3cmFwcGVkIGxpbmUgc2hvdWxkIGFscmVhZHkgYmUgdHJpbW1lZCBkb3duIGF0IHRoaXMgcG9pbnQuXG5cdGNvbnN0IG1heExpbmVMZW5ndGggPSBNYXRoLm1heCgyMDQ4IC8gY29scyAqIDIpO1xuXHRsaW5lRW5kID0gTWF0aC5taW4obGluZUVuZCwgbGluZVN0YXJ0ICsgbWF4TGluZUxlbmd0aCk7XG5cdGxldCBjb250ZW50ID0gJyc7XG5cdGZvciAobGV0IGkgPSBsaW5lU3RhcnQ7IGkgPD0gbGluZUVuZDsgaSsrKSB7XG5cdFx0Ly8gTWFrZSBzdXJlIG9ubHkgMCB0byBjb2xzIGFyZSBjb25zaWRlcmVkIGFzIHJlc2l6aW5nIHdoZW4gd2luZG93cyBtb2RlIGlzIGVuYWJsZWQgd2lsbFxuXHRcdC8vIHJldGFpbiBidWZmZXIgZGF0YSBvdXRzaWRlIG9mIHRoZSB0ZXJtaW5hbCB3aWR0aCBhcyByZWZsb3cgaXMgZGlzYWJsZWQuXG5cdFx0Y29uc3QgbGluZSA9IGJ1ZmZlci5nZXRMaW5lKGkpO1xuXHRcdGlmIChsaW5lKSB7XG5cdFx0XHRjb250ZW50ICs9IGxpbmUudHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSwgMCwgY29scyk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBjb250ZW50O1xufVxuXG5mdW5jdGlvbiBjbG9uZU1hcmtlcih4dGVybTogVGVybWluYWwsIG1hcmtlcjogSVh0ZXJtTWFya2VyLCBvZmZzZXQ6IG51bWJlciA9IDApOiBJWHRlcm1NYXJrZXIgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4geHRlcm0ucmVnaXN0ZXJNYXJrZXIobWFya2VyLmxpbmUgLSAoeHRlcm0uYnVmZmVyLmFjdGl2ZS5iYXNlWSArIHh0ZXJtLmJ1ZmZlci5hY3RpdmUuY3Vyc29yWSkgKyBvZmZzZXQpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLDRCQUE0Qix5QkFBeUI7QUFDMUUsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywyQkFBK00sMEJBQTBCO0FBRWxQLFNBQWlDLHdCQUF3Qix1QkFBdUI7QUFDaEYsU0FBUyx3QkFBZ0Q7QUFRbEQsSUFBTSw2QkFBTixjQUF5QyxXQUFrRDtBQUFBLEVBeURqRyxZQUNrQixXQUNhLGFBQzdCO0FBQ0QsVUFBTTtBQUhXO0FBQ2E7QUExRC9CLFNBQVMsT0FBTyxtQkFBbUI7QUFLbkMsU0FBVSxZQUErQixDQUFDO0FBRzFDLFNBQVEsa0JBQTBDLElBQUksdUJBQXVCLEtBQUssU0FBUztBQUMzRixTQUFRLGtCQUE2QixDQUFDO0FBRXRDLFNBQVEsNkJBQXNDO0FBRTlDLFNBQVEsMkJBQW9DO0FBMEI1QyxTQUFpQixvQkFBb0IsS0FBSyxVQUFVLElBQUksUUFBMEIsQ0FBQztBQUNuRixTQUFTLG1CQUFtQixLQUFLLGtCQUFrQjtBQUNuRCxTQUFpQix5QkFBeUIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQzVFLFNBQVMsd0JB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QUFXLGNBQWMsVUFBVSxJQUFJLEtBQUssV0FBVyxLQUFLO0FBQ3hFLFVBQUksbUJBQW1CO0FBQ3ZCLFlBQU0saUJBQWlCO0FBQ3ZCLGFBQU8sb0JBQW9CLGFBQWEsT0FBTyxRQUFRLGdCQUFnQixHQUFHLFdBQVc7QUFDcEY7QUFBQSxNQUNEO0FBQ0EsVUFBSTtBQUNKLFlBQU0sUUFBUSxvQkFBb0IsUUFBUSxrQkFBa0IsZ0JBQWdCLElBQUksQ0FBQztBQUNqRixVQUFJLE1BQU0sU0FBUyxjQUFjO0FBQ2hDLGNBQU0sSUFBSTtBQUFBLE1BQ1g7QUFBQSxJQUNEO0FBQUEsRUFDRCxPQUFPO0FBQ04sYUFBUyxJQUFJLGFBQWEsY0FBYyxVQUFVLElBQUksSUFBSSxTQUFTLEtBQUs7QUFDdkUsWUFBTSxtQkFBbUI7QUFDekIsVUFBSSxpQkFBaUI7QUFDckIsYUFBTyxpQkFBaUIsSUFBSSxXQUFXLE9BQU8sUUFBUSxpQkFBaUIsQ0FBQyxHQUFHLFdBQVc7QUFDckY7QUFBQSxNQUNEO0FBQ0EsVUFBSTtBQUNKLFlBQU0sS0FBSyxvQkFBb0IsUUFBUSxrQkFBa0IsZ0JBQWdCLElBQUksQ0FBQztBQUM5RSxVQUFJLE1BQU0sV0FBVyxjQUFjO0FBQ2xDLGNBQU0sTUFBTTtBQUFBLE1BQ2I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNBLFNBQU87QUFDUjtBQUVBLFNBQVMsb0JBQW9CLFFBQWlCLFdBQW1CLFNBQWlCLE1BQXNCO0FBR3ZHLFFBQU0sZ0JBQWdCLEtBQUssSUFBSSxPQUFPLE9BQU8sQ0FBQztBQUM5QyxZQUFVLEtBQUssSUFBSSxTQUFTLFlBQVksYUFBYTtBQUNyRCxNQUFJLFVBQVU7QUFDZCxXQUFTLElBQUksV0FBVyxLQUFLLFNBQVMsS0FBSztBQUcxQyxVQUFNLE9BQU8sT0FBTyxRQUFRLENBQUM7QUFDN0IsUUFBSSxNQUFNO0FBQ1QsaUJBQVcsS0FBSyxrQkFBa0IsTUFBTSxHQUFHLElBQUk7QUFBQSxJQUNoRDtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLFlBQVksT0FBaUIsUUFBc0IsU0FBaUIsR0FBNkI7QUFDekcsU0FBTyxNQUFNLGVBQWUsT0FBTyxRQUFRLE1BQU0sT0FBTyxPQUFPLFFBQVEsTUFBTSxPQUFPLE9BQU8sV0FBVyxNQUFNO0FBQzdHOyIsCiAgIm5hbWVzIjogWyJ2YWx1ZSIsICJBZGp1c3RDb21tYW5kU3RhcnRNYXJrZXJDb25zdGFudHMiXQp9Cg==
