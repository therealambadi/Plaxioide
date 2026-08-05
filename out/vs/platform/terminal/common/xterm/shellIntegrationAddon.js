import { ShellIntegrationStatus } from "../terminal.js";
import { Disposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { TerminalCapabilityStore } from "../capabilities/terminalCapabilityStore.js";
import { CommandDetectionCapability } from "../capabilities/commandDetectionCapability.js";
import { CwdDetectionCapability } from "../capabilities/cwdDetectionCapability.js";
import { TerminalCapability } from "../capabilities/capabilities.js";
import { PartialCommandDetectionCapability } from "../capabilities/partialCommandDetectionCapability.js";
import { Emitter } from "../../../../base/common/event.js";
import { BufferMarkCapability } from "../capabilities/bufferMarkCapability.js";
import { URI } from "../../../../base/common/uri.js";
import { sanitizeCwd } from "../terminalEnvironment.js";
import { removeAnsiEscapeCodesFromPrompt } from "../../../../base/common/strings.js";
import { ShellEnvDetectionCapability } from "../capabilities/shellEnvDetectionCapability.js";
var ShellIntegrationOscPs = /* @__PURE__ */ ((ShellIntegrationOscPs2) => {
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["FinalTerm"] = 133] = "FinalTerm";
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["VSCode"] = 633] = "VSCode";
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["ITerm"] = 1337] = "ITerm";
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["SetCwd"] = 7] = "SetCwd";
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["SetWindowsFriendlyCwd"] = 9] = "SetWindowsFriendlyCwd";
  return ShellIntegrationOscPs2;
})(ShellIntegrationOscPs || {});
var FinalTermOscPt = /* @__PURE__ */ ((FinalTermOscPt2) => {
  FinalTermOscPt2["PromptStart"] = "A";
  FinalTermOscPt2["CommandStart"] = "B";
  FinalTermOscPt2["CommandExecuted"] = "C";
  FinalTermOscPt2["CommandFinished"] = "D";
  return FinalTermOscPt2;
})(FinalTermOscPt || {});
var VSCodeOscPt = /* @__PURE__ */ ((VSCodeOscPt2) => {
  VSCodeOscPt2["PromptStart"] = "A";
  VSCodeOscPt2["CommandStart"] = "B";
  VSCodeOscPt2["CommandExecuted"] = "C";
  VSCodeOscPt2["CommandFinished"] = "D";
  VSCodeOscPt2["CommandLine"] = "E";
  VSCodeOscPt2["ContinuationStart"] = "F";
  VSCodeOscPt2["ContinuationEnd"] = "G";
  VSCodeOscPt2["RightPromptStart"] = "H";
  VSCodeOscPt2["RightPromptEnd"] = "I";
  VSCodeOscPt2["Property"] = "P";
  VSCodeOscPt2["SetMark"] = "SetMark";
  VSCodeOscPt2["EnvJson"] = "EnvJson";
  VSCodeOscPt2["EnvSingleDelete"] = "EnvSingleDelete";
  VSCodeOscPt2["EnvSingleStart"] = "EnvSingleStart";
  VSCodeOscPt2["EnvSingleEntry"] = "EnvSingleEntry";
  VSCodeOscPt2["EnvSingleEnd"] = "EnvSingleEnd";
  return VSCodeOscPt2;
})(VSCodeOscPt || {});
var ITermOscPt = /* @__PURE__ */ ((ITermOscPt2) => {
  ITermOscPt2["SetMark"] = "SetMark";
  ITermOscPt2["CurrentDir"] = "CurrentDir";
  return ITermOscPt2;
})(ITermOscPt || {});
class ShellIntegrationAddon extends Disposable {
  constructor(_nonce, _disableTelemetry, _telemetryService, _logService) {
    super();
    this._nonce = _nonce;
    this._disableTelemetry = _disableTelemetry;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this.capabilities = this._register(new TerminalCapabilityStore());
    this._hasUpdatedTelemetry = false;
    this._commonProtocolDisposables = [];
    this._seenSequences = /* @__PURE__ */ new Set();
    this._status = ShellIntegrationStatus.Off;
    this._onDidChangeStatus = new Emitter();
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this._onDidChangeSeenSequences = new Emitter();
    this.onDidChangeSeenSequences = this._onDidChangeSeenSequences.event;
    this._register(toDisposable(() => {
      this._clearActivationTimeout();
      this._disposeCommonProtocol();
    }));
  }
  get seenSequences() {
    return this._seenSequences;
  }
  get status() {
    return this._status;
  }
  _disposeCommonProtocol() {
    dispose(this._commonProtocolDisposables);
    this._commonProtocolDisposables.length = 0;
  }
  activate(xterm) {
    this._terminal = xterm;
    this.capabilities.add(TerminalCapability.PartialCommandDetection, this._register(new PartialCommandDetectionCapability(this._terminal)));
    this._register(xterm.parser.registerOscHandler(633 /* VSCode */, (data) => this._handleVSCodeSequence(data)));
    this._register(xterm.parser.registerOscHandler(1337 /* ITerm */, (data) => this._doHandleITermSequence(data)));
    this._commonProtocolDisposables.push(
      xterm.parser.registerOscHandler(133 /* FinalTerm */, (data) => this._handleFinalTermSequence(data))
    );
    this._register(xterm.parser.registerOscHandler(7 /* SetCwd */, (data) => this._doHandleSetCwd(data)));
    this._register(xterm.parser.registerOscHandler(9 /* SetWindowsFriendlyCwd */, (data) => this._doHandleSetWindowsFriendlyCwd(data)));
    this._ensureCapabilitiesOrAddFailureTelemetry();
  }
  getMarkerId(terminal, vscodeMarkerId) {
    this._createOrGetBufferMarkDetection(terminal).getMark(vscodeMarkerId);
  }
  _markSequenceSeen(sequence) {
    if (!this._seenSequences.has(sequence)) {
      this._seenSequences.add(sequence);
      this._onDidChangeSeenSequences.fire(this._seenSequences);
    }
  }
  _handleFinalTermSequence(data) {
    const didHandle = this._doHandleFinalTermSequence(data);
    if (this._status === ShellIntegrationStatus.Off) {
      this._status = ShellIntegrationStatus.FinalTerm;
      this._onDidChangeStatus.fire(this._status);
    }
    return didHandle;
  }
  _doHandleFinalTermSequence(data) {
    if (!this._terminal) {
      return false;
    }
    const [command, ...args] = data.split(";");
    this._markSequenceSeen(command);
    switch (command) {
      case "A" /* PromptStart */:
        this._createOrGetCommandDetection(this._terminal).handlePromptStart();
        return true;
      case "B" /* CommandStart */:
        this._createOrGetCommandDetection(this._terminal).handleCommandStart({ ignoreCommandLine: true });
        return true;
      case "C" /* CommandExecuted */:
        this._createOrGetCommandDetection(this._terminal).handleCommandExecuted();
        return true;
      case "D" /* CommandFinished */: {
        const exitCode = args.length === 1 ? parseInt(args[0]) : void 0;
        this._createOrGetCommandDetection(this._terminal).handleCommandFinished(exitCode);
        return true;
      }
    }
    return false;
  }
  _handleVSCodeSequence(data) {
    const didHandle = this._doHandleVSCodeSequence(data);
    if (!this._hasUpdatedTelemetry && didHandle) {
      this._telemetryService?.publicLog2("terminal/shellIntegrationActivationSucceeded");
      this._hasUpdatedTelemetry = true;
      this._clearActivationTimeout();
    }
    if (this._status !== ShellIntegrationStatus.VSCode) {
      this._status = ShellIntegrationStatus.VSCode;
      this._onDidChangeStatus.fire(this._status);
    }
    return didHandle;
  }
  async _ensureCapabilitiesOrAddFailureTelemetry() {
    if (!this._telemetryService || this._disableTelemetry) {
      return;
    }
    this._activationTimeout = setTimeout(() => {
      if (!this.capabilities.get(TerminalCapability.CommandDetection) && !this.capabilities.get(TerminalCapability.CwdDetection)) {
        this._telemetryService?.publicLog2("terminal/shellIntegrationActivationTimeout");
        this._logService.warn("Shell integration failed to add capabilities within 10 seconds");
      }
      this._hasUpdatedTelemetry = true;
    }, 1e4);
  }
  _clearActivationTimeout() {
    if (this._activationTimeout !== void 0) {
      clearTimeout(this._activationTimeout);
      this._activationTimeout = void 0;
    }
  }
  _doHandleVSCodeSequence(data) {
    if (!this._terminal) {
      return false;
    }
    const argsIndex = data.indexOf(";");
    const command = argsIndex === -1 ? data : data.substring(0, argsIndex);
    this._markSequenceSeen(command);
    const args = argsIndex === -1 ? [] : data.substring(argsIndex + 1).split(";");
    switch (command) {
      case "A" /* PromptStart */:
        this._createOrGetCommandDetection(this._terminal).handlePromptStart();
        return true;
      case "B" /* CommandStart */:
        this._createOrGetCommandDetection(this._terminal).handleCommandStart();
        return true;
      case "C" /* CommandExecuted */:
        this._createOrGetCommandDetection(this._terminal).handleCommandExecuted();
        return true;
      case "D" /* CommandFinished */: {
        const arg0 = args[0];
        const exitCode = arg0 !== void 0 ? parseInt(arg0) : void 0;
        this._createOrGetCommandDetection(this._terminal).handleCommandFinished(exitCode);
        return true;
      }
      case "E" /* CommandLine */: {
        const arg0 = args[0];
        const arg1 = args[1];
        let commandLine;
        if (arg0 !== void 0) {
          commandLine = deserializeMessage(arg0);
        } else {
          commandLine = "";
        }
        this._createOrGetCommandDetection(this._terminal).setCommandLine(commandLine, arg1 === this._nonce);
        return true;
      }
      case "F" /* ContinuationStart */: {
        this._createOrGetCommandDetection(this._terminal).handleContinuationStart();
        return true;
      }
      case "G" /* ContinuationEnd */: {
        this._createOrGetCommandDetection(this._terminal).handleContinuationEnd();
        return true;
      }
      case "EnvJson" /* EnvJson */: {
        const arg0 = args[0];
        const arg1 = args[1];
        if (arg0 !== void 0) {
          try {
            const env = JSON.parse(deserializeMessage(arg0));
            this._createOrGetShellEnvDetection().setEnvironment(env, arg1 === this._nonce);
          } catch (e) {
            this._logService.warn("Failed to parse environment from shell integration sequence", arg0);
          }
        }
        return true;
      }
      case "EnvSingleStart" /* EnvSingleStart */: {
        this._createOrGetShellEnvDetection().startEnvironmentSingleVar(args[0] === "1", args[1] === this._nonce);
        return true;
      }
      case "EnvSingleDelete" /* EnvSingleDelete */: {
        const arg0 = args[0];
        const arg1 = args[1];
        const arg2 = args[2];
        if (arg0 !== void 0 && arg1 !== void 0) {
          const env = deserializeMessage(arg1);
          this._createOrGetShellEnvDetection().deleteEnvironmentSingleVar(arg0, env, arg2 === this._nonce);
        }
        return true;
      }
      case "EnvSingleEntry" /* EnvSingleEntry */: {
        const arg0 = args[0];
        const arg1 = args[1];
        const arg2 = args[2];
        if (arg0 !== void 0 && arg1 !== void 0) {
          const env = deserializeMessage(arg1);
          this._createOrGetShellEnvDetection().setEnvironmentSingleVar(arg0, env, arg2 === this._nonce);
        }
        return true;
      }
      case "EnvSingleEnd" /* EnvSingleEnd */: {
        this._createOrGetShellEnvDetection().endEnvironmentSingleVar(args[0] === this._nonce);
        return true;
      }
      case "H" /* RightPromptStart */: {
        this._createOrGetCommandDetection(this._terminal).handleRightPromptStart();
        return true;
      }
      case "I" /* RightPromptEnd */: {
        this._createOrGetCommandDetection(this._terminal).handleRightPromptEnd();
        return true;
      }
      case "P" /* Property */: {
        const arg0 = args[0];
        const deserialized = arg0 !== void 0 ? deserializeMessage(arg0) : "";
        const { key, value } = parseKeyValueAssignment(deserialized);
        if (value === void 0) {
          return true;
        }
        switch (key) {
          case "ContinuationPrompt": {
            this._updateContinuationPrompt(removeAnsiEscapeCodesFromPrompt(value));
            return true;
          }
          case "Cwd": {
            this._updateCwd(value);
            return true;
          }
          case "IsWindows": {
            this._createOrGetCommandDetection(this._terminal).setIsWindowsPty(value === "True" ? true : false);
            return true;
          }
          case "HasRichCommandDetection": {
            this._createOrGetCommandDetection(this._terminal).setHasRichCommandDetection(value === "True" ? true : false);
            return true;
          }
          case "Prompt": {
            const sanitizedValue = value.replace(/\x1b\[[0-9;]*m/g, "");
            this._updatePromptTerminator(sanitizedValue);
            return true;
          }
          case "Task": {
            this._createOrGetBufferMarkDetection(this._terminal);
            this.capabilities.get(TerminalCapability.CommandDetection)?.setIsCommandStorageDisabled();
            return true;
          }
        }
      }
      case "SetMark" /* SetMark */: {
        this._createOrGetBufferMarkDetection(this._terminal).addMark(parseMarkSequence(args));
        return true;
      }
    }
    return false;
  }
  _updateContinuationPrompt(value) {
    if (!this._terminal) {
      return;
    }
    this._createOrGetCommandDetection(this._terminal).setContinuationPrompt(value);
  }
  _updatePromptTerminator(prompt) {
    if (!this._terminal) {
      return;
    }
    const lastPromptLine = prompt.substring(prompt.lastIndexOf("\n") + 1);
    const promptTerminator = lastPromptLine.substring(lastPromptLine.lastIndexOf(" "));
    if (promptTerminator) {
      this._createOrGetCommandDetection(this._terminal).setPromptTerminator(promptTerminator, lastPromptLine);
    }
  }
  _updateCwd(value) {
    value = sanitizeCwd(value);
    this._createOrGetCwdDetection().updateCwd(value);
    const commandDetection = this.capabilities.get(TerminalCapability.CommandDetection);
    commandDetection?.setCwd(value);
  }
  _doHandleITermSequence(data) {
    if (!this._terminal) {
      return false;
    }
    const [command] = data.split(";");
    this._markSequenceSeen(`${1337 /* ITerm */};${command}`);
    switch (command) {
      case "SetMark" /* SetMark */: {
        this._createOrGetBufferMarkDetection(this._terminal).addMark();
      }
      default: {
        const { key, value } = parseKeyValueAssignment(command);
        if (value === void 0) {
          return true;
        }
        switch (key) {
          case "CurrentDir" /* CurrentDir */:
            this._updateCwd(value);
            return true;
        }
      }
    }
    return false;
  }
  _doHandleSetWindowsFriendlyCwd(data) {
    if (!this._terminal) {
      return false;
    }
    const [command, ...args] = data.split(";");
    this._markSequenceSeen(`${9 /* SetWindowsFriendlyCwd */};${command}`);
    switch (command) {
      case "9":
        if (args.length) {
          this._updateCwd(args[0]);
        }
        return true;
    }
    return false;
  }
  /**
   * Handles the sequence: `OSC 7 ; scheme://cwd ST`
   */
  _doHandleSetCwd(data) {
    if (!this._terminal) {
      return false;
    }
    const [command] = data.split(";");
    this._markSequenceSeen(`${7 /* SetCwd */};${command}`);
    if (command.match(/^file:\/\/.*\//)) {
      const uri = URI.parse(command);
      if (uri.path && uri.path.length > 0) {
        this._updateCwd(uri.path);
        return true;
      }
    }
    return false;
  }
  serialize() {
    if (!this._terminal || !this.capabilities.has(TerminalCapability.CommandDetection)) {
      return {
        isWindowsPty: false,
        hasRichCommandDetection: false,
        commands: [],
        promptInputModel: void 0
      };
    }
    const result = this._createOrGetCommandDetection(this._terminal).serialize();
    return result;
  }
  deserialize(serialized) {
    if (!this._terminal) {
      throw new Error("Cannot restore commands before addon is activated");
    }
    const commandDetection = this._createOrGetCommandDetection(this._terminal);
    commandDetection.deserialize(serialized);
    if (commandDetection.cwd) {
      this._updateCwd(commandDetection.cwd);
    }
  }
  _createOrGetCwdDetection() {
    let cwdDetection = this.capabilities.get(TerminalCapability.CwdDetection);
    if (!cwdDetection) {
      cwdDetection = this._register(new CwdDetectionCapability());
      this.capabilities.add(TerminalCapability.CwdDetection, cwdDetection);
    }
    return cwdDetection;
  }
  _createOrGetCommandDetection(terminal) {
    let commandDetection = this.capabilities.get(TerminalCapability.CommandDetection);
    if (!commandDetection) {
      commandDetection = this._register(new CommandDetectionCapability(terminal, this._logService));
      this.capabilities.add(TerminalCapability.CommandDetection, commandDetection);
    }
    return commandDetection;
  }
  _createOrGetBufferMarkDetection(terminal) {
    let bufferMarkDetection = this.capabilities.get(TerminalCapability.BufferMarkDetection);
    if (!bufferMarkDetection) {
      bufferMarkDetection = this._register(new BufferMarkCapability(terminal));
      this.capabilities.add(TerminalCapability.BufferMarkDetection, bufferMarkDetection);
    }
    return bufferMarkDetection;
  }
  _createOrGetShellEnvDetection() {
    let shellEnvDetection = this.capabilities.get(TerminalCapability.ShellEnvDetection);
    if (!shellEnvDetection) {
      shellEnvDetection = this._register(new ShellEnvDetectionCapability());
      this.capabilities.add(TerminalCapability.ShellEnvDetection, shellEnvDetection);
    }
    return shellEnvDetection;
  }
}
function deserializeMessage(message) {
  return message.replaceAll(
    // Backslash ('\') followed by an escape operator: either another '\', or 'x' and two hex chars.
    /\\(\\|x([0-9a-f]{2}))/gi,
    // If it's a hex value, parse it to a character.
    // Otherwise the operator is '\', which we return literally, now unescaped.
    (_match, op, hex) => hex ? String.fromCharCode(parseInt(hex, 16)) : op
  );
}
function parseKeyValueAssignment(message) {
  const separatorIndex = message.indexOf("=");
  if (separatorIndex === -1) {
    return { key: message, value: void 0 };
  }
  return {
    key: message.substring(0, separatorIndex),
    value: message.substring(1 + separatorIndex)
  };
}
function parseMarkSequence(sequence) {
  let id = void 0;
  let hidden = false;
  for (const property of sequence) {
    if (property === void 0) {
      continue;
    }
    if (property === "Hidden") {
      hidden = true;
    }
    if (property.startsWith("Id=")) {
      id = property.substring(3);
    }
  }
  return { id, hidden };
}
export {
  ShellIntegrationAddon,
  ShellIntegrationOscPs,
  deserializeMessage,
  parseKeyValueAssignment,
  parseMarkSequence
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24veHRlcm0vc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVNoZWxsSW50ZWdyYXRpb24sIFNoZWxsSW50ZWdyYXRpb25TdGF0dXMgfSBmcm9tICcuLi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlIH0gZnJvbSAnLi4vY2FwYWJpbGl0aWVzL3Rlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLmpzJztcbmltcG9ydCB7IENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IH0gZnJvbSAnLi4vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LmpzJztcbmltcG9ydCB7IEN3ZERldGVjdGlvbkNhcGFiaWxpdHkgfSBmcm9tICcuLi9jYXBhYmlsaXRpZXMvY3dkRGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQnVmZmVyTWFya0NhcGFiaWxpdHksIElDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSwgSUN3ZERldGVjdGlvbkNhcGFiaWxpdHksIElTZXJpYWxpemVkQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHksIElTaGVsbEVudkRldGVjdGlvbkNhcGFiaWxpdHksIFRlcm1pbmFsQ2FwYWJpbGl0eSB9IGZyb20gJy4uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgUGFydGlhbENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IH0gZnJvbSAnLi4vY2FwYWJpbGl0aWVzL3BhcnRpYWxDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEJ1ZmZlck1hcmtDYXBhYmlsaXR5IH0gZnJvbSAnLi4vY2FwYWJpbGl0aWVzL2J1ZmZlck1hcmtDYXBhYmlsaXR5LmpzJztcbmltcG9ydCB0eXBlIHsgSVRlcm1pbmFsQWRkb24sIFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL2hlYWRsZXNzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBzYW5pdGl6ZUN3ZCB9IGZyb20gJy4uL3Rlcm1pbmFsRW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgcmVtb3ZlQW5zaUVzY2FwZUNvZGVzRnJvbVByb21wdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgU2hlbGxFbnZEZXRlY3Rpb25DYXBhYmlsaXR5IH0gZnJvbSAnLi4vY2FwYWJpbGl0aWVzL3NoZWxsRW52RGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5cblxuLyoqXG4gKiBTaGVsbCBpbnRlZ3JhdGlvbiBpcyBhIGZlYXR1cmUgdGhhdCBlbmhhbmNlcyB0aGUgdGVybWluYWwncyB1bmRlcnN0YW5kaW5nIG9mIHdoYXQncyBoYXBwZW5pbmdcbiAqIGluIHRoZSBzaGVsbCBieSBpbmplY3Rpbmcgc3BlY2lhbCBzZXF1ZW5jZXMgaW50byB0aGUgc2hlbGwncyBwcm9tcHQgdXNpbmcgdGhlIFwiU2V0IFRleHRcbiAqIFBhcmFtZXRlcnNcIiBzZXF1ZW5jZSAoYE9TQyBQcyA7IFB0IFNUYCkuXG4gKlxuICogRGVmaW5pdGlvbnM6XG4gKiAtIE9TQzogYFxceDFiXWBcbiAqIC0gUHM6ICBBIHNpbmdsZSAodXN1YWxseSBvcHRpb25hbCkgbnVtZXJpYyBwYXJhbWV0ZXIsIGNvbXBvc2VkIG9mIG9uZSBvciBtb3JlIGRpZ2l0cy5cbiAqIC0gUHQ6ICBBIHRleHQgcGFyYW1ldGVyIGNvbXBvc2VkIG9mIHByaW50YWJsZSBjaGFyYWN0ZXJzLlxuICogLSBTVDogYFxceDdgXG4gKlxuICogVGhpcyBpcyBpbnNwaXJlZCBieSBhIGZlYXR1cmUgb2YgdGhlIHNhbWUgbmFtZSBpbiB0aGUgRmluYWxUZXJtLCBpVGVybTIgYW5kIGtpdHR5IHRlcm1pbmFscy5cbiAqL1xuXG4vKipcbiAqIFRoZSBpZGVudGlmaWVyIGZvciB0aGUgZmlyc3QgbnVtZXJpYyBwYXJhbWV0ZXIgKGBQc2ApIGZvciBPU0MgY29tbWFuZHMgdXNlZCBieSBzaGVsbCBpbnRlZ3JhdGlvbi5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gU2hlbGxJbnRlZ3JhdGlvbk9zY1BzIHtcblx0LyoqXG5cdCAqIFNlcXVlbmNlcyBwaW9uZWVyZWQgYnkgRmluYWxUZXJtLlxuXHQgKi9cblx0RmluYWxUZXJtID0gMTMzLFxuXHQvKipcblx0ICogU2VxdWVuY2VzIHBpb25lZXJlZCBieSBWUyBDb2RlLiBUaGUgbnVtYmVyIGlzIGRlcml2ZWQgZnJvbSB0aGUgbGVhc3Qgc2lnbmlmaWNhbnQgZGlnaXQgb2Zcblx0ICogXCJWU0NcIiB3aGVuIGVuY29kZWQgaW4gaGV4IChcIlZTQ1wiID0gMHg1NiwgMHg1MywgMHg0MykuXG5cdCAqL1xuXHRWU0NvZGUgPSA2MzMsXG5cdC8qKlxuXHQgKiBTZXF1ZW5jZXMgcGlvbmVlcmVkIGJ5IGlUZXJtLlxuXHQgKi9cblx0SVRlcm0gPSAxMzM3LFxuXHRTZXRDd2QgPSA3LFxuXHRTZXRXaW5kb3dzRnJpZW5kbHlDd2QgPSA5XG59XG5cbi8qKlxuICogU2VxdWVuY2VzIHBpb25lZXJlZCBieSBGaW5hbFRlcm0uXG4gKi9cbmNvbnN0IGVudW0gRmluYWxUZXJtT3NjUHQge1xuXHQvKipcblx0ICogVGhlIHN0YXJ0IG9mIHRoZSBwcm9tcHQsIHRoaXMgaXMgZXhwZWN0ZWQgdG8gYWx3YXlzIGFwcGVhciBhdCB0aGUgc3RhcnQgb2YgYSBsaW5lLlxuXHQgKlxuXHQgKiBGb3JtYXQ6IGBPU0MgMTMzIDsgQSBTVGBcblx0ICovXG5cdFByb21wdFN0YXJ0ID0gJ0EnLFxuXG5cdC8qKlxuXHQgKiBUaGUgc3RhcnQgb2YgYSBjb21tYW5kLCBpZS4gd2hlcmUgdGhlIHVzZXIgaW5wdXRzIHRoZWlyIGNvbW1hbmQuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyAxMzMgOyBCIFNUYFxuXHQgKi9cblx0Q29tbWFuZFN0YXJ0ID0gJ0InLFxuXG5cdC8qKlxuXHQgKiBTZW50IGp1c3QgYmVmb3JlIHRoZSBjb21tYW5kIG91dHB1dCBiZWdpbnMuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyAxMzMgOyBDIFNUYFxuXHQgKi9cblx0Q29tbWFuZEV4ZWN1dGVkID0gJ0MnLFxuXG5cdC8qKlxuXHQgKiBTZW50IGp1c3QgYWZ0ZXIgYSBjb21tYW5kIGhhcyBmaW5pc2hlZC4gVGhlIGV4aXQgY29kZSBpcyBvcHRpb25hbCwgd2hlbiBub3Qgc3BlY2lmaWVkIGl0XG5cdCAqIG1lYW5zIG5vIGNvbW1hbmQgd2FzIHJ1biAoaWUuIGVudGVyIG9uIGVtcHR5IHByb21wdCBvciBjdHJsK2MpLlxuXHQgKlxuXHQgKiBGb3JtYXQ6IGBPU0MgMTMzIDsgRCBbOyA8RXhpdENvZGU+XSBTVGBcblx0ICovXG5cdENvbW1hbmRGaW5pc2hlZCA9ICdEJyxcbn1cblxuLyoqXG4gKiBWUyBDb2RlLXNwZWNpZmljIHNoZWxsIGludGVncmF0aW9uIHNlcXVlbmNlcy4gU29tZSBvZiB0aGVzZSBhcmUgYmFzZWQgb24gbW9yZSBjb21tb24gYWx0ZXJuYXRpdmVzXG4gKiBsaWtlIHRob3NlIHBpb25lZXJlZCBpbiB7QGxpbmsgRmluYWxUZXJtT3NjUHQgRmluYWxUZXJtfS4gVGhlIGRlY2lzaW9uIHRvIG1vdmUgdG8gZW50aXJlbHkgY3VzdG9tXG4gKiBzZXF1ZW5jZXMgd2FzIHRvIHRyeSB0byBpbXByb3ZlIHJlbGlhYmlsaXR5IGFuZCBwcmV2ZW50IHRoZSBwb3NzaWJpbGl0eSBvZiBhcHBsaWNhdGlvbnMgY29uZnVzaW5nXG4gKiB0aGUgdGVybWluYWwuIElmIG11bHRpcGxlIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdHMgcnVuLCBWUyBDb2RlIHdpbGwgcHJpb3JpdGl6ZSB0aGUgVlNcbiAqIENvZGUtc3BlY2lmaWMgb25lcy5cbiAqXG4gKiBJdCdzIHJlY29tbWVuZGVkIHRoYXQgYXV0aG9ycyBvZiBzaGVsbCBpbnRlZ3JhdGlvbiBzY3JpcHRzIHVzZSB0aGUgY29tbW9uIHNlcXVlbmNlcyAoYDEzM2ApXG4gKiB3aGVuIGJ1aWxkaW5nIGdlbmVyYWwgcHVycG9zZSBzY3JpcHRzIGFuZCB0aGUgVlMgQ29kZS1zcGVjaWZpYyAoYDYzM2ApIHdoZW4gdGFyZ2V0aW5nIG9ubHkgVlNcbiAqIENvZGUgb3Igd2hlbiB0aGVyZSBhcmUgbm8gb3RoZXIgYWx0ZXJuYXRpdmVzIChlZy4ge0BsaW5rIENvbW1hbmRMaW5lIGA2MzMgOyBFYH0pLiBUaGVzZSBzZXF1ZW5jZXNcbiAqIHN1cHBvcnQgbWl4LWFuZC1tYXRjaGluZy5cbiAqL1xuY29uc3QgZW51bSBWU0NvZGVPc2NQdCB7XG5cdC8qKlxuXHQgKiBUaGUgc3RhcnQgb2YgdGhlIHByb21wdCwgdGhpcyBpcyBleHBlY3RlZCB0byBhbHdheXMgYXBwZWFyIGF0IHRoZSBzdGFydCBvZiBhIGxpbmUuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyA2MzMgOyBBIFNUYFxuXHQgKlxuXHQgKiBCYXNlZCBvbiB7QGxpbmsgRmluYWxUZXJtT3NjUHQuUHJvbXB0U3RhcnR9LlxuXHQgKi9cblx0UHJvbXB0U3RhcnQgPSAnQScsXG5cblx0LyoqXG5cdCAqIFRoZSBzdGFydCBvZiBhIGNvbW1hbmQsIGllLiB3aGVyZSB0aGUgdXNlciBpbnB1dHMgdGhlaXIgY29tbWFuZC5cblx0ICpcblx0ICogRm9ybWF0OiBgT1NDIDYzMyA7IEIgU1RgXG5cdCAqXG5cdCAqIEJhc2VkIG9uICB7QGxpbmsgRmluYWxUZXJtT3NjUHQuQ29tbWFuZFN0YXJ0fS5cblx0ICovXG5cdENvbW1hbmRTdGFydCA9ICdCJyxcblxuXHQvKipcblx0ICogU2VudCBqdXN0IGJlZm9yZSB0aGUgY29tbWFuZCBvdXRwdXQgYmVnaW5zLlxuXHQgKlxuXHQgKiBGb3JtYXQ6IGBPU0MgNjMzIDsgQyBTVGBcblx0ICpcblx0ICogQmFzZWQgb24ge0BsaW5rIEZpbmFsVGVybU9zY1B0LkNvbW1hbmRFeGVjdXRlZH0uXG5cdCAqL1xuXHRDb21tYW5kRXhlY3V0ZWQgPSAnQycsXG5cblx0LyoqXG5cdCAqIFNlbnQganVzdCBhZnRlciBhIGNvbW1hbmQgaGFzIGZpbmlzaGVkLiBUaGlzIHNob3VsZCBnZW5lcmFsbHkgYmUgdXNlZCBvbiB0aGUgbmV3IGxpbmVcblx0ICogZm9sbG93aW5nIHRoZSBlbmQgb2YgYSBjb21tYW5kJ3Mgb3V0cHV0LCBqdXN0IGJlZm9yZSB7QGxpbmsgUHJvbXB0U3RhcnR9LiBUaGUgZXhpdCBjb2RlIGlzXG5cdCAqIG9wdGlvbmFsLCB3aGVuIG5vdCBzcGVjaWZpZWQgaXQgbWVhbnMgbm8gY29tbWFuZCB3YXMgcnVuIChpZS4gZW50ZXIgb24gZW1wdHkgcHJvbXB0IG9yXG5cdCAqIGN0cmwrYykuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyA2MzMgOyBEIFs7IDxFeGl0Q29kZT5dIFNUYFxuXHQgKlxuXHQgKiBCYXNlZCBvbiB7QGxpbmsgRmluYWxUZXJtT3NjUHQuQ29tbWFuZEZpbmlzaGVkfS5cblx0ICovXG5cdENvbW1hbmRGaW5pc2hlZCA9ICdEJyxcblxuXHQvKipcblx0ICogRXhwbGljaXRseSBzZXQgdGhlIGNvbW1hbmQgbGluZS4gVGhpcyBoZWxwcyB3b3JrYXJvdW5kIHBlcmZvcm1hbmNlIGFuZCByZWxpYWJpbGl0eSBwcm9ibGVtc1xuXHQgKiB3aXRoIHBhcnNpbmcgb3V0IHRoZSBjb21tYW5kLCBzdWNoIGFzIGNvbnB0eSBub3QgZ3VhcmFudGVlaW5nIHRoZSBwb3NpdGlvbiBvZiB0aGUgc2VxdWVuY2Ugb3Jcblx0ICogdGhlIHNoZWxsIG5vdCBndWFyYW50ZWVpbmcgdGhhdCB0aGUgZW50aXJlIGNvbW1hbmQgaXMgZXZlbiB2aXNpYmxlLiBJZGVhbGx5IHRoaXMgaXMgY2FsbGVkXG5cdCAqIGltbWVkaWF0ZWx5IGJlZm9yZSB7QGxpbmsgQ29tbWFuZEV4ZWN1dGVkfSwgaW1tZWRpYXRlbHkgYmVmb3JlIHtAbGluayBDb21tYW5kRmluaXNoZWR9IHdpbGxcblx0ICogYWxzbyB3b3JrIGJ1dCB0aGF0IG1lYW5zIHRlcm1pbmFsIHdpbGwgb25seSBrbm93IHRoZSBhY2N1cmF0ZSBjb21tYW5kIGxpbmUgd2hlbiB0aGUgY29tbWFuZCBpc1xuXHQgKiBmaW5pc2hlZC5cblx0ICpcblx0ICogVGhlIGNvbW1hbmQgbGluZSBjYW4gZXNjYXBlIGFzY2lpIGNoYXJhY3RlcnMgdXNpbmcgdGhlIGBcXHhBQmAgZm9ybWF0LCB3aGVyZSBBQiBhcmUgdGhlXG5cdCAqIGhleGFkZWNpbWFsIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBjaGFyYWN0ZXIgY29kZSAoY2FzZSBpbnNlbnNpdGl2ZSksIGFuZCBlc2NhcGUgdGhlIGBcXGBcblx0ICogY2hhcmFjdGVyIHVzaW5nIGBcXFxcYC4gSXQncyByZXF1aXJlZCB0byBlc2NhcGUgc2VtaS1jb2xvbiAoYDB4M2JgKSBhbmQgY2hhcmFjdGVycyAweDIwIGFuZFxuXHQgKiBiZWxvdywgdGhpcyBpcyBwYXJ0aWN1bGFybHkgaW1wb3J0YW50IGZvciBuZXcgbGluZSBhbmQgc2VtaS1jb2xvbi5cblx0ICpcblx0ICogU29tZSBleGFtcGxlczpcblx0ICpcblx0ICogYGBgXG5cdCAqIFwiXFxcIiAgLT4gXCJcXFxcXCJcblx0ICogXCJcXG5cIiAtPiBcIlxceDBhXCJcblx0ICogXCI7XCIgIC0+IFwiXFx4M2JcIlxuXHQgKiBgYGBcblx0ICpcblx0ICogQW4gb3B0aW9uYWwgbm9uY2UgY2FuIGJlIHByb3ZpZGVkIHdoaWNoIGlzIG1heSBiZSByZXF1aXJlZCBieSB0aGUgdGVybWluYWwgaW4gb3JkZXIgZW5hYmxlXG5cdCAqIHNvbWUgZmVhdHVyZXMuIFRoaXMgaGVscHMgZW5zdXJlIG5vIG1hbGljaW91cyBjb21tYW5kIGluamVjdGlvbiBoYXMgb2NjdXJyZWQuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyA2MzMgOyBFIFs7IDxDb21tYW5kTGluZT4gWzsgPE5vbmNlPl1dIFNUYFxuXHQgKi9cblx0Q29tbWFuZExpbmUgPSAnRScsXG5cblx0LyoqXG5cdCAqIFNpbWlsYXIgdG8gcHJvbXB0IHN0YXJ0IGJ1dCBmb3IgbGluZSBjb250aW51YXRpb25zLlxuXHQgKlxuXHQgKiBXQVJOSU5HOiBUaGlzIHNlcXVlbmNlIGlzIHVuZmluYWxpemVkLCBETyBOT1QgdXNlIHRoaXMgaW4geW91ciBzaGVsbCBpbnRlZ3JhdGlvbiBzY3JpcHQuXG5cdCAqL1xuXHRDb250aW51YXRpb25TdGFydCA9ICdGJyxcblxuXHQvKipcblx0ICogU2ltaWxhciB0byBjb21tYW5kIHN0YXJ0IGJ1dCBmb3IgbGluZSBjb250aW51YXRpb25zLlxuXHQgKlxuXHQgKiBXQVJOSU5HOiBUaGlzIHNlcXVlbmNlIGlzIHVuZmluYWxpemVkLCBETyBOT1QgdXNlIHRoaXMgaW4geW91ciBzaGVsbCBpbnRlZ3JhdGlvbiBzY3JpcHQuXG5cdCAqL1xuXHRDb250aW51YXRpb25FbmQgPSAnRycsXG5cblx0LyoqXG5cdCAqIFRoZSBzdGFydCBvZiB0aGUgcmlnaHQgcHJvbXB0LlxuXHQgKlxuXHQgKiBXQVJOSU5HOiBUaGlzIHNlcXVlbmNlIGlzIHVuZmluYWxpemVkLCBETyBOT1QgdXNlIHRoaXMgaW4geW91ciBzaGVsbCBpbnRlZ3JhdGlvbiBzY3JpcHQuXG5cdCAqL1xuXHRSaWdodFByb21wdFN0YXJ0ID0gJ0gnLFxuXG5cdC8qKlxuXHQgKiBUaGUgZW5kIG9mIHRoZSByaWdodCBwcm9tcHQuXG5cdCAqXG5cdCAqIFdBUk5JTkc6IFRoaXMgc2VxdWVuY2UgaXMgdW5maW5hbGl6ZWQsIERPIE5PVCB1c2UgdGhpcyBpbiB5b3VyIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdC5cblx0ICovXG5cdFJpZ2h0UHJvbXB0RW5kID0gJ0knLFxuXG5cdC8qKlxuXHQgKiBTZXQgdGhlIHZhbHVlIG9mIGFuIGFyYml0cmFyeSBwcm9wZXJ0eSwgb25seSBrbm93biBwcm9wZXJ0aWVzIHdpbGwgYmUgaGFuZGxlZCBieSBWUyBDb2RlLlxuXHQgKlxuXHQgKiBGb3JtYXQ6IGBPU0MgNjMzIDsgUCA7IDxQcm9wZXJ0eT49PFZhbHVlPiBTVGBcblx0ICpcblx0ICogS25vd24gcHJvcGVydGllczpcblx0ICpcblx0ICogLSBgQ3dkYCAtIFJlcG9ydHMgdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgdG8gdGhlIHRlcm1pbmFsLlxuXHQgKiAtIGBJc1dpbmRvd3NgIC0gUmVwb3J0cyB3aGV0aGVyIHRoZSBzaGVsbCBpcyB1c2luZyBhIFdpbmRvd3MgYmFja2VuZCBsaWtlIHdpbnB0eSBvciBjb25wdHkuXG5cdCAqICAgVGhpcyBtYXkgYmUgdXNlZCB0byBlbmFibGUgYWRkaXRpb25hbCBoZXVyaXN0aWNzIGFzIHRoZSBwb3NpdGlvbmluZyBvZiB0aGUgc2hlbGxcblx0ICogICBpbnRlZ3JhdGlvbiBzZXF1ZW5jZXMgYXJlIG5vdCBndWFyYW50ZWVkIHRvIGJlIGNvcnJlY3QuIFZhbGlkIHZhbHVlczogYFRydWVgLCBgRmFsc2VgLlxuXHQgKiAtIGBDb250aW51YXRpb25Qcm9tcHRgIC0gUmVwb3J0cyB0aGUgY29udGludWF0aW9uIHByb21wdCB0aGF0IGlzIHByaW50ZWQgYXQgdGhlIHN0YXJ0IG9mXG5cdCAqICAgbXVsdGktbGluZSBpbnB1dHMuXG5cdCAqIC0gYEhhc1JpY2hDb21tYW5kRGV0ZWN0aW9uYCAtIFJlcG9ydHMgd2hldGhlciB0aGUgc2hlbGwgaGFzIHJpY2ggY29tbWFuZCBsaW5lIGRldGVjdGlvbixcblx0ICogICBtZWFuaW5nIHRoYXQgc2VxdWVuY2VzIEEsIEIsIEMsIEQgYW5kIEUgYXJlIGV4YWN0bHkgd2hlcmUgdGhleSdyZSBtZWFudCB0byBiZS4gSW5cblx0ICogICBwYXJ0aWN1bGFyLCB7QGxpbmsgQ29tbWFuZExpbmV9IG11c3QgaGFwcGVuIGltbWVkaWF0ZWx5IGJlZm9yZSB7QGxpbmsgQ29tbWFuZEV4ZWN1dGVkfSBzb1xuXHQgKiAgIFZTIENvZGUga25vd3MgdGhlIGNvbW1hbmQgbGluZSB3aGVuIHRoZSBleGVjdXRpb24gYmVnaW5zLlxuXHQgKlxuXHQgKiBXQVJOSU5HOiBBbnkgb3RoZXIgcHJvcGVydGllcyBtYXkgYmUgY2hhbmdlZCBhbmQgYXJlIG5vdCBndWFyYW50ZWVkIHRvIHdvcmsgaW4gdGhlIGZ1dHVyZS5cblx0ICovXG5cdFByb3BlcnR5ID0gJ1AnLFxuXG5cdC8qKlxuXHQgKiBTZXRzIGEgbWFyay9wb2ludC1vZi1pbnRlcmVzdCBpbiB0aGUgYnVmZmVyLlxuXHQgKlxuXHQgKiBGb3JtYXQ6IGBPU0MgNjMzIDsgU2V0TWFyayBbOyBJZD08c3RyaW5nPl0gWzsgSGlkZGVuXWBcblx0ICpcblx0ICogYElkYCAtIFRoZSBpZGVudGlmaWVyIG9mIHRoZSBtYXJrIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVmZXJlbmNlIGl0XG5cdCAqIGBIaWRkZW5gIC0gV2hlbiBzZXQsIHRoZSBtYXJrIHdpbGwgYmUgYXZhaWxhYmxlIHRvIHJlZmVyZW5jZSBpbnRlcm5hbGx5IGJ1dCB3aWxsIG5vdCB2aXNpYmxlXG5cdCAqXG5cdCAqIFdBUk5JTkc6IFRoaXMgc2VxdWVuY2UgaXMgdW5maW5hbGl6ZWQsIERPIE5PVCB1c2UgdGhpcyBpbiB5b3VyIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdC5cblx0ICovXG5cdFNldE1hcmsgPSAnU2V0TWFyaycsXG5cblx0LyoqXG5cdCAqIFNlbmRzIHRoZSBzaGVsbCdzIGNvbXBsZXRlIGVudmlyb25tZW50IGluIEpTT04gZm9ybWF0LlxuXHQgKlxuXHQgKiBGb3JtYXQ6IGBPU0MgNjMzIDsgRW52SnNvbiA7IDxFbnZpcm9ubWVudD4gOyA8Tm9uY2U+YFxuXHQgKlxuXHQgKiAtIGBFbnZpcm9ubWVudGAgLSBBIHN0cmluZ2lmaWVkIEpTT04gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHNoZWxsJ3MgY29tcGxldGUgZW52aXJvbm1lbnQuIFRoZVxuXHQgKiAgICB2YXJpYWJsZXMgYW5kIHZhbHVlcyB1c2UgdGhlIHNhbWUgZW5jb2RpbmcgcnVsZXMgYXMgdGhlIHtAbGluayBDb21tYW5kTGluZX0gc2VxdWVuY2UuXG5cdCAqIC0gYE5vbmNlYCAtIEFuIF9tYW5kYXRvcnlfIG5vbmNlIGNhbiBiZSBwcm92aWRlZCB3aGljaCBtYXkgYmUgcmVxdWlyZWQgYnkgdGhlIHRlcm1pbmFsIGluIG9yZGVyXG5cdCAqICAgdG8gZW5hYmxlIHNvbWUgZmVhdHVyZXMuIFRoaXMgaGVscHMgZW5zdXJlIG5vIG1hbGljaW91cyBjb21tYW5kIGluamVjdGlvbiBoYXMgb2NjdXJyZWQuXG5cdCAqXG5cdCAqIFdBUk5JTkc6IFRoaXMgc2VxdWVuY2UgaXMgdW5maW5hbGl6ZWQsIERPIE5PVCB1c2UgdGhpcyBpbiB5b3VyIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdC5cblx0ICovXG5cdEVudkpzb24gPSAnRW52SnNvbicsXG5cblx0LyoqXG5cdCAqIERlbGV0ZSBhIHNpbmdsZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBmcm9tIGNhY2hlZCBlbnZpcm9ubWVudC5cblx0ICpcblx0ICogRm9ybWF0OiBgT1NDIDYzMyA7IEVudlNpbmdsZURlbGV0ZSA7IDxFbnZpcm9ubWVudEtleT4gOyA8RW52aXJvbm1lbnRWYWx1ZT4gWzsgPE5vbmNlPl1gXG5cdCAqXG5cdCAqIC0gYE5vbmNlYCAtIEFuIG9wdGlvbmFsIG5vbmNlIGNhbiBiZSBwcm92aWRlZCB3aGljaCBtYXkgYmUgcmVxdWlyZWQgYnkgdGhlIHRlcm1pbmFsIGluIG9yZGVyXG5cdCAqICAgdG8gZW5hYmxlIHNvbWUgZmVhdHVyZXMuIFRoaXMgaGVscHMgZW5zdXJlIG5vIG1hbGljaW91cyBjb21tYW5kIGluamVjdGlvbiBoYXMgb2NjdXJyZWQuXG5cdCAqXG5cdCAqIFdBUk5JTkc6IFRoaXMgc2VxdWVuY2UgaXMgdW5maW5hbGl6ZWQsIERPIE5PVCB1c2UgdGhpcyBpbiB5b3VyIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdC5cblx0ICovXG5cdEVudlNpbmdsZURlbGV0ZSA9ICdFbnZTaW5nbGVEZWxldGUnLFxuXG5cdC8qKlxuXHQgKiBUaGUgc3RhcnQgb2YgdGhlIGNvbGxlY3RpbmcgdXNlcidzIGVudmlyb25tZW50IHZhcmlhYmxlcyBpbmRpdmlkdWFsbHkuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyA2MzMgOyBFbnZTaW5nbGVTdGFydCA7IDxDbGVhcj4gWzsgPE5vbmNlPl1gXG5cdCAqXG5cdCAqIC0gYENsZWFyYCAtIEFuIF9tYW5kYXRvcnlfIGZsYWcgaW5kaWNhdGluZyBhbnkgY2FjaGVkIGVudmlyb25tZW50IHZhcmlhYmxlcyB3aWxsIGJlIGNsZWFyZWQuXG5cdCAqIC0gYE5vbmNlYCAtIEFuIG9wdGlvbmFsIG5vbmNlIGNhbiBiZSBwcm92aWRlZCB3aGljaCBtYXkgYmUgcmVxdWlyZWQgYnkgdGhlIHRlcm1pbmFsIGluIG9yZGVyXG5cdCAqICAgdG8gZW5hYmxlIHNvbWUgZmVhdHVyZXMuIFRoaXMgaGVscHMgZW5zdXJlIG5vIG1hbGljaW91cyBjb21tYW5kIGluamVjdGlvbiBoYXMgb2NjdXJyZWQuXG5cdCAqXG5cdCAqIFdBUk5JTkc6IFRoaXMgc2VxdWVuY2UgaXMgdW5maW5hbGl6ZWQsIERPIE5PVCB1c2UgdGhpcyBpbiB5b3VyIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdC5cblx0ICovXG5cdEVudlNpbmdsZVN0YXJ0ID0gJ0VudlNpbmdsZVN0YXJ0JyxcblxuXHQvKipcblx0ICogU2V0cyBhbiBlbnRyeSBvZiBzaW5nbGUgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gdHJhbnNhY3Rpb25hbCBwZW5kaW5nIG1hcCBvZiBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyA2MzMgOyBFbnZTaW5nbGVFbnRyeSA7IDxFbnZpcm9ubWVudEtleT4gOyA8RW52aXJvbm1lbnRWYWx1ZT4gWzsgPE5vbmNlPl1gXG5cdCAqXG5cdCAqIC0gYE5vbmNlYCAtIEFuIG9wdGlvbmFsIG5vbmNlIGNhbiBiZSBwcm92aWRlZCB3aGljaCBtYXkgYmUgcmVxdWlyZWQgYnkgdGhlIHRlcm1pbmFsIGluIG9yZGVyXG5cdCAqICAgdG8gZW5hYmxlIHNvbWUgZmVhdHVyZXMuIFRoaXMgaGVscHMgZW5zdXJlIG5vIG1hbGljaW91cyBjb21tYW5kIGluamVjdGlvbiBoYXMgb2NjdXJyZWQuXG5cdCAqXG5cdCAqIFdBUk5JTkc6IFRoaXMgc2VxdWVuY2UgaXMgdW5maW5hbGl6ZWQsIERPIE5PVCB1c2UgdGhpcyBpbiB5b3VyIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdC5cblx0ICovXG5cdEVudlNpbmdsZUVudHJ5ID0gJ0VudlNpbmdsZUVudHJ5JyxcblxuXHQvKipcblx0ICogVGhlIGVuZCBvZiB0aGUgY29sbGVjdGluZyB1c2VyJ3MgZW52aXJvbm1lbnQgdmFyaWFibGVzIGluZGl2aWR1YWxseS5cblx0ICogQ2xlYXJzIGFueSBwZW5kaW5nIGVudmlyb25tZW50IHZhcmlhYmxlcyBhbmQgZmlyZXMgYW4gZXZlbnQgdGhhdCBjb250YWlucyB1c2VyJ3MgZW52aXJvbm1lbnQuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyA2MzMgOyBFbnZTaW5nbGVFbmQgWzsgPE5vbmNlPl1gXG5cdCAqXG5cdCAqIC0gYE5vbmNlYCAtIEFuIG9wdGlvbmFsIG5vbmNlIGNhbiBiZSBwcm92aWRlZCB3aGljaCBtYXkgYmUgcmVxdWlyZWQgYnkgdGhlIHRlcm1pbmFsIGluIG9yZGVyXG5cdCAqICAgdG8gZW5hYmxlIHNvbWUgZmVhdHVyZXMuIFRoaXMgaGVscHMgZW5zdXJlIG5vIG1hbGljaW91cyBjb21tYW5kIGluamVjdGlvbiBoYXMgb2NjdXJyZWQuXG5cdCAqXG5cdCAqIFdBUk5JTkc6IFRoaXMgc2VxdWVuY2UgaXMgdW5maW5hbGl6ZWQsIERPIE5PVCB1c2UgdGhpcyBpbiB5b3VyIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdC5cblx0ICovXG5cdEVudlNpbmdsZUVuZCA9ICdFbnZTaW5nbGVFbmQnXG59XG5cbi8qKlxuICogSVRlcm0gc2VxdWVuY2VzXG4gKi9cbmNvbnN0IGVudW0gSVRlcm1Pc2NQdCB7XG5cdC8qKlxuXHQgKiBTZXRzIGEgbWFyay9wb2ludC1vZi1pbnRlcmVzdCBpbiB0aGUgYnVmZmVyLlxuXHQgKlxuXHQgKiBGb3JtYXQ6IGBPU0MgMTMzNyA7IFNldE1hcmtgXG5cdCAqL1xuXHRTZXRNYXJrID0gJ1NldE1hcmsnLFxuXG5cdC8qKlxuXHQgKiBSZXBvcnRzIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgKENXRCkuXG5cdCAqXG5cdCAqIEZvcm1hdDogYE9TQyAxMzM3IDsgQ3VycmVudERpcj08Q3dkPiBTVGBcblx0ICovXG5cdEN1cnJlbnREaXIgPSAnQ3VycmVudERpcidcbn1cblxuLyoqXG4gKiBUaGUgc2hlbGwgaW50ZWdyYXRpb24gYWRkb24gZXh0ZW5kcyB4dGVybSBieSByZWFkaW5nIHNoZWxsIGludGVncmF0aW9uIHNlcXVlbmNlcyBhbmQgY3JlYXRpbmdcbiAqIGNhcGFiaWxpdGllcyBhbmQgcGFzc2luZyBhbG9uZyByZWxldmFudCBzZXF1ZW5jZXMgdG8gdGhlIGNhcGFiaWxpdGllcy4gVGhpcyBpcyBtZWFudCB0b1xuICogZW5jYXBzdWxhdGUgYWxsIGhhbmRsaW5nL3BhcnNpbmcgb2Ygc2VxdWVuY2VzIHNvIHRoZSBjYXBhYmlsaXRpZXMgZG9uJ3QgbmVlZCB0by5cbiAqL1xuZXhwb3J0IGNsYXNzIFNoZWxsSW50ZWdyYXRpb25BZGRvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJU2hlbGxJbnRlZ3JhdGlvbiwgSVRlcm1pbmFsQWRkb24ge1xuXHRwcml2YXRlIF90ZXJtaW5hbD86IFRlcm1pbmFsO1xuXHRyZWFkb25seSBjYXBhYmlsaXRpZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUoKSk7XG5cdHByaXZhdGUgX2hhc1VwZGF0ZWRUZWxlbWV0cnk6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfYWN0aXZhdGlvblRpbWVvdXQ6IGFueTtcblx0cHJpdmF0ZSBfY29tbW9uUHJvdG9jb2xEaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdHByaXZhdGUgX3NlZW5TZXF1ZW5jZXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXHRnZXQgc2VlblNlcXVlbmNlcygpOiBSZWFkb25seVNldDxzdHJpbmc+IHsgcmV0dXJuIHRoaXMuX3NlZW5TZXF1ZW5jZXM7IH1cblxuXHRwcml2YXRlIF9zdGF0dXM6IFNoZWxsSW50ZWdyYXRpb25TdGF0dXMgPSBTaGVsbEludGVncmF0aW9uU3RhdHVzLk9mZjtcblx0Z2V0IHN0YXR1cygpOiBTaGVsbEludGVncmF0aW9uU3RhdHVzIHsgcmV0dXJuIHRoaXMuX3N0YXR1czsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RhdHVzID0gbmV3IEVtaXR0ZXI8U2hlbGxJbnRlZ3JhdGlvblN0YXR1cz4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTdGF0dXMgPSB0aGlzLl9vbkRpZENoYW5nZVN0YXR1cy5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTZWVuU2VxdWVuY2VzID0gbmV3IEVtaXR0ZXI8UmVhZG9ubHlTZXQ8c3RyaW5nPj4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTZWVuU2VxdWVuY2VzID0gdGhpcy5fb25EaWRDaGFuZ2VTZWVuU2VxdWVuY2VzLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX25vbmNlOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlzYWJsZVRlbGVtZXRyeTogYm9vbGVhbiB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jbGVhckFjdGl2YXRpb25UaW1lb3V0KCk7XG5cdFx0XHR0aGlzLl9kaXNwb3NlQ29tbW9uUHJvdG9jb2woKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9kaXNwb3NlQ29tbW9uUHJvdG9jb2woKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLl9jb21tb25Qcm90b2NvbERpc3Bvc2FibGVzKTtcblx0XHR0aGlzLl9jb21tb25Qcm90b2NvbERpc3Bvc2FibGVzLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRhY3RpdmF0ZSh4dGVybTogVGVybWluYWwpIHtcblx0XHR0aGlzLl90ZXJtaW5hbCA9IHh0ZXJtO1xuXHRcdHRoaXMuY2FwYWJpbGl0aWVzLmFkZChUZXJtaW5hbENhcGFiaWxpdHkuUGFydGlhbENvbW1hbmREZXRlY3Rpb24sIHRoaXMuX3JlZ2lzdGVyKG5ldyBQYXJ0aWFsQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkodGhpcy5fdGVybWluYWwpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ucGFyc2VyLnJlZ2lzdGVyT3NjSGFuZGxlcihTaGVsbEludGVncmF0aW9uT3NjUHMuVlNDb2RlLCBkYXRhID0+IHRoaXMuX2hhbmRsZVZTQ29kZVNlcXVlbmNlKGRhdGEpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ucGFyc2VyLnJlZ2lzdGVyT3NjSGFuZGxlcihTaGVsbEludGVncmF0aW9uT3NjUHMuSVRlcm0sIGRhdGEgPT4gdGhpcy5fZG9IYW5kbGVJVGVybVNlcXVlbmNlKGRhdGEpKSk7XG5cdFx0dGhpcy5fY29tbW9uUHJvdG9jb2xEaXNwb3NhYmxlcy5wdXNoKFxuXHRcdFx0eHRlcm0ucGFyc2VyLnJlZ2lzdGVyT3NjSGFuZGxlcihTaGVsbEludGVncmF0aW9uT3NjUHMuRmluYWxUZXJtLCBkYXRhID0+IHRoaXMuX2hhbmRsZUZpbmFsVGVybVNlcXVlbmNlKGRhdGEpKVxuXHRcdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ucGFyc2VyLnJlZ2lzdGVyT3NjSGFuZGxlcihTaGVsbEludGVncmF0aW9uT3NjUHMuU2V0Q3dkLCBkYXRhID0+IHRoaXMuX2RvSGFuZGxlU2V0Q3dkKGRhdGEpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ucGFyc2VyLnJlZ2lzdGVyT3NjSGFuZGxlcihTaGVsbEludGVncmF0aW9uT3NjUHMuU2V0V2luZG93c0ZyaWVuZGx5Q3dkLCBkYXRhID0+IHRoaXMuX2RvSGFuZGxlU2V0V2luZG93c0ZyaWVuZGx5Q3dkKGRhdGEpKSk7XG5cdFx0dGhpcy5fZW5zdXJlQ2FwYWJpbGl0aWVzT3JBZGRGYWlsdXJlVGVsZW1ldHJ5KCk7XG5cdH1cblxuXHRnZXRNYXJrZXJJZCh0ZXJtaW5hbDogVGVybWluYWwsIHZzY29kZU1hcmtlcklkOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9jcmVhdGVPckdldEJ1ZmZlck1hcmtEZXRlY3Rpb24odGVybWluYWwpLmdldE1hcmsodnNjb2RlTWFya2VySWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbWFya1NlcXVlbmNlU2VlbihzZXF1ZW5jZTogc3RyaW5nKSB7XG5cdFx0aWYgKCF0aGlzLl9zZWVuU2VxdWVuY2VzLmhhcyhzZXF1ZW5jZSkpIHtcblx0XHRcdHRoaXMuX3NlZW5TZXF1ZW5jZXMuYWRkKHNlcXVlbmNlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2VlblNlcXVlbmNlcy5maXJlKHRoaXMuX3NlZW5TZXF1ZW5jZXMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZUZpbmFsVGVybVNlcXVlbmNlKGRhdGE6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGRpZEhhbmRsZSA9IHRoaXMuX2RvSGFuZGxlRmluYWxUZXJtU2VxdWVuY2UoZGF0YSk7XG5cdFx0aWYgKHRoaXMuX3N0YXR1cyA9PT0gU2hlbGxJbnRlZ3JhdGlvblN0YXR1cy5PZmYpIHtcblx0XHRcdHRoaXMuX3N0YXR1cyA9IFNoZWxsSW50ZWdyYXRpb25TdGF0dXMuRmluYWxUZXJtO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0dXMuZmlyZSh0aGlzLl9zdGF0dXMpO1xuXHRcdH1cblx0XHRyZXR1cm4gZGlkSGFuZGxlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZG9IYW5kbGVGaW5hbFRlcm1TZXF1ZW5jZShkYXRhOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gUGFzcyB0aGUgc2VxdWVuY2UgYWxvbmcgdG8gdGhlIGNhcGFiaWxpdHlcblx0XHQvLyBJdCB3YXMgY29uc2lkZXJlZCB0byBkaXNhYmxlIHRoZSBjb21tb24gcHJvdG9jb2wgaW4gb3JkZXIgdG8gbm90IGNvbmZ1c2UgdGhlIFZTIENvZGVcblx0XHQvLyBzaGVsbCBpbnRlZ3JhdGlvbiBpZiBib3RoIGhhcHBlbiBmb3Igc29tZSByZWFzb24uIFRoaXMgZG9lc24ndCB3b3JrIGZvciBwb3dlcmxldmVsMTBrXG5cdFx0Ly8gd2hlbiBpbnN0YW50IHByb21wdCBpcyBlbmFibGVkIHRob3VnaC4gSWYgdGhpcyBkb2VzIGVuZCB1cCBiZWluZyBhIHByb2JsZW0gd2UgY291bGQgcGFzc1xuXHRcdC8vIGEgdHlwZSBmbGFnIHRocm91Z2ggdGhlIGNhcGFiaWxpdHkgY2FsbHNcblx0XHRjb25zdCBbY29tbWFuZCwgLi4uYXJnc10gPSBkYXRhLnNwbGl0KCc7Jyk7XG5cdFx0dGhpcy5fbWFya1NlcXVlbmNlU2Vlbihjb21tYW5kKTtcblx0XHRzd2l0Y2ggKGNvbW1hbmQpIHtcblx0XHRcdGNhc2UgRmluYWxUZXJtT3NjUHQuUHJvbXB0U3RhcnQ6XG5cdFx0XHRcdHRoaXMuX2NyZWF0ZU9yR2V0Q29tbWFuZERldGVjdGlvbih0aGlzLl90ZXJtaW5hbCkuaGFuZGxlUHJvbXB0U3RhcnQoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIEZpbmFsVGVybU9zY1B0LkNvbW1hbmRTdGFydDpcblx0XHRcdFx0Ly8gSWdub3JlIHRoZSBjb21tYW5kIGxpbmUgZm9yIHRoZXNlIHNlcXVlbmNlcyBhcyBpdCdzIHVucmVsaWFibGUgZm9yIGV4YW1wbGUgaW4gcG93ZXJsZXZlbDEwa1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmhhbmRsZUNvbW1hbmRTdGFydCh7IGlnbm9yZUNvbW1hbmRMaW5lOiB0cnVlIH0pO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgRmluYWxUZXJtT3NjUHQuQ29tbWFuZEV4ZWN1dGVkOlxuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmhhbmRsZUNvbW1hbmRFeGVjdXRlZCgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgRmluYWxUZXJtT3NjUHQuQ29tbWFuZEZpbmlzaGVkOiB7XG5cdFx0XHRcdGNvbnN0IGV4aXRDb2RlID0gYXJncy5sZW5ndGggPT09IDEgPyBwYXJzZUludChhcmdzWzBdKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fY3JlYXRlT3JHZXRDb21tYW5kRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKS5oYW5kbGVDb21tYW5kRmluaXNoZWQoZXhpdENvZGUpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlVlNDb2RlU2VxdWVuY2UoZGF0YTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZGlkSGFuZGxlID0gdGhpcy5fZG9IYW5kbGVWU0NvZGVTZXF1ZW5jZShkYXRhKTtcblx0XHRpZiAoIXRoaXMuX2hhc1VwZGF0ZWRUZWxlbWV0cnkgJiYgZGlkSGFuZGxlKSB7XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlPy5wdWJsaWNMb2cyPHt9LCB7IG93bmVyOiAnbWVnYW5yb2dnZSc7IGNvbW1lbnQ6ICdJbmRpY2F0ZXMgc2hlbGwgaW50ZWdyYXRpb24gd2FzIGFjdGl2YXRlZCcgfT4oJ3Rlcm1pbmFsL3NoZWxsSW50ZWdyYXRpb25BY3RpdmF0aW9uU3VjY2VlZGVkJyk7XG5cdFx0XHR0aGlzLl9oYXNVcGRhdGVkVGVsZW1ldHJ5ID0gdHJ1ZTtcblx0XHRcdHRoaXMuX2NsZWFyQWN0aXZhdGlvblRpbWVvdXQoKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3N0YXR1cyAhPT0gU2hlbGxJbnRlZ3JhdGlvblN0YXR1cy5WU0NvZGUpIHtcblx0XHRcdHRoaXMuX3N0YXR1cyA9IFNoZWxsSW50ZWdyYXRpb25TdGF0dXMuVlNDb2RlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0dXMuZmlyZSh0aGlzLl9zdGF0dXMpO1xuXHRcdH1cblx0XHRyZXR1cm4gZGlkSGFuZGxlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZW5zdXJlQ2FwYWJpbGl0aWVzT3JBZGRGYWlsdXJlVGVsZW1ldHJ5KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fdGVsZW1ldHJ5U2VydmljZSB8fCB0aGlzLl9kaXNhYmxlVGVsZW1ldHJ5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2FjdGl2YXRpb25UaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbikgJiYgIXRoaXMuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ3dkRGV0ZWN0aW9uKSkge1xuXHRcdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlPy5wdWJsaWNMb2cyPHt9LCB7IG93bmVyOiAnbWVnYW5yb2dnZSc7IGNvbW1lbnQ6ICdJbmRpY2F0ZXMgc2hlbGwgaW50ZWdyYXRpb24gYWN0aXZhdGlvbiB0aW1lb3V0JyB9PigndGVybWluYWwvc2hlbGxJbnRlZ3JhdGlvbkFjdGl2YXRpb25UaW1lb3V0Jyk7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybignU2hlbGwgaW50ZWdyYXRpb24gZmFpbGVkIHRvIGFkZCBjYXBhYmlsaXRpZXMgd2l0aGluIDEwIHNlY29uZHMnKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2hhc1VwZGF0ZWRUZWxlbWV0cnkgPSB0cnVlO1xuXHRcdH0sIDEwMDAwKTtcblx0fVxuXG5cdHByaXZhdGUgX2NsZWFyQWN0aXZhdGlvblRpbWVvdXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2FjdGl2YXRpb25UaW1lb3V0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl9hY3RpdmF0aW9uVGltZW91dCk7XG5cdFx0XHR0aGlzLl9hY3RpdmF0aW9uVGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kb0hhbmRsZVZTQ29kZVNlcXVlbmNlKGRhdGE6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBQYXNzIHRoZSBzZXF1ZW5jZSBhbG9uZyB0byB0aGUgY2FwYWJpbGl0eVxuXHRcdGNvbnN0IGFyZ3NJbmRleCA9IGRhdGEuaW5kZXhPZignOycpO1xuXHRcdGNvbnN0IGNvbW1hbmQgPSBhcmdzSW5kZXggPT09IC0xID8gZGF0YSA6IGRhdGEuc3Vic3RyaW5nKDAsIGFyZ3NJbmRleCk7XG5cdFx0dGhpcy5fbWFya1NlcXVlbmNlU2Vlbihjb21tYW5kKTtcblx0XHQvLyBDYXN0IHRvIHN0cmljdCBjaGVja2VkIGluZGV4IGFjY2Vzc1xuXHRcdGNvbnN0IGFyZ3M6IChzdHJpbmcgfCB1bmRlZmluZWQpW10gPSBhcmdzSW5kZXggPT09IC0xID8gW10gOiBkYXRhLnN1YnN0cmluZyhhcmdzSW5kZXggKyAxKS5zcGxpdCgnOycpO1xuXHRcdHN3aXRjaCAoY29tbWFuZCkge1xuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5Qcm9tcHRTdGFydDpcblx0XHRcdFx0dGhpcy5fY3JlYXRlT3JHZXRDb21tYW5kRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKS5oYW5kbGVQcm9tcHRTdGFydCgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgVlNDb2RlT3NjUHQuQ29tbWFuZFN0YXJ0OlxuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmhhbmRsZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgVlNDb2RlT3NjUHQuQ29tbWFuZEV4ZWN1dGVkOlxuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmhhbmRsZUNvbW1hbmRFeGVjdXRlZCgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgVlNDb2RlT3NjUHQuQ29tbWFuZEZpbmlzaGVkOiB7XG5cdFx0XHRcdGNvbnN0IGFyZzAgPSBhcmdzWzBdO1xuXHRcdFx0XHRjb25zdCBleGl0Q29kZSA9IGFyZzAgIT09IHVuZGVmaW5lZCA/IHBhcnNlSW50KGFyZzApIDogdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmhhbmRsZUNvbW1hbmRGaW5pc2hlZChleGl0Q29kZSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5Db21tYW5kTGluZToge1xuXHRcdFx0XHRjb25zdCBhcmcwID0gYXJnc1swXTtcblx0XHRcdFx0Y29uc3QgYXJnMSA9IGFyZ3NbMV07XG5cdFx0XHRcdGxldCBjb21tYW5kTGluZTogc3RyaW5nO1xuXHRcdFx0XHRpZiAoYXJnMCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y29tbWFuZExpbmUgPSBkZXNlcmlhbGl6ZU1lc3NhZ2UoYXJnMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29tbWFuZExpbmUgPSAnJztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLnNldENvbW1hbmRMaW5lKGNvbW1hbmRMaW5lLCBhcmcxID09PSB0aGlzLl9ub25jZSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5Db250aW51YXRpb25TdGFydDoge1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmhhbmRsZUNvbnRpbnVhdGlvblN0YXJ0KCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5Db250aW51YXRpb25FbmQ6IHtcblx0XHRcdFx0dGhpcy5fY3JlYXRlT3JHZXRDb21tYW5kRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKS5oYW5kbGVDb250aW51YXRpb25FbmQoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFZTQ29kZU9zY1B0LkVudkpzb246IHtcblx0XHRcdFx0Y29uc3QgYXJnMCA9IGFyZ3NbMF07XG5cdFx0XHRcdGNvbnN0IGFyZzEgPSBhcmdzWzFdO1xuXHRcdFx0XHRpZiAoYXJnMCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IGVudiA9IEpTT04ucGFyc2UoZGVzZXJpYWxpemVNZXNzYWdlKGFyZzApKTtcblx0XHRcdFx0XHRcdHRoaXMuX2NyZWF0ZU9yR2V0U2hlbGxFbnZEZXRlY3Rpb24oKS5zZXRFbnZpcm9ubWVudChlbnYsIGFyZzEgPT09IHRoaXMuX25vbmNlKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oJ0ZhaWxlZCB0byBwYXJzZSBlbnZpcm9ubWVudCBmcm9tIHNoZWxsIGludGVncmF0aW9uIHNlcXVlbmNlJywgYXJnMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5FbnZTaW5nbGVTdGFydDoge1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldFNoZWxsRW52RGV0ZWN0aW9uKCkuc3RhcnRFbnZpcm9ubWVudFNpbmdsZVZhcihhcmdzWzBdID09PSAnMScsIGFyZ3NbMV0gPT09IHRoaXMuX25vbmNlKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFZTQ29kZU9zY1B0LkVudlNpbmdsZURlbGV0ZToge1xuXHRcdFx0XHRjb25zdCBhcmcwID0gYXJnc1swXTtcblxuXHRcdFx0XHRjb25zdCBhcmcxID0gYXJnc1sxXTtcblx0XHRcdFx0Y29uc3QgYXJnMiA9IGFyZ3NbMl07XG5cdFx0XHRcdGlmIChhcmcwICE9PSB1bmRlZmluZWQgJiYgYXJnMSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y29uc3QgZW52ID0gZGVzZXJpYWxpemVNZXNzYWdlKGFyZzEpO1xuXHRcdFx0XHRcdHRoaXMuX2NyZWF0ZU9yR2V0U2hlbGxFbnZEZXRlY3Rpb24oKS5kZWxldGVFbnZpcm9ubWVudFNpbmdsZVZhcihhcmcwLCBlbnYsIGFyZzIgPT09IHRoaXMuX25vbmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGNhc2UgVlNDb2RlT3NjUHQuRW52U2luZ2xlRW50cnk6IHtcblx0XHRcdFx0Y29uc3QgYXJnMCA9IGFyZ3NbMF07XG5cdFx0XHRcdGNvbnN0IGFyZzEgPSBhcmdzWzFdO1xuXHRcdFx0XHRjb25zdCBhcmcyID0gYXJnc1syXTtcblx0XHRcdFx0aWYgKGFyZzAgIT09IHVuZGVmaW5lZCAmJiBhcmcxICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjb25zdCBlbnYgPSBkZXNlcmlhbGl6ZU1lc3NhZ2UoYXJnMSk7XG5cdFx0XHRcdFx0dGhpcy5fY3JlYXRlT3JHZXRTaGVsbEVudkRldGVjdGlvbigpLnNldEVudmlyb25tZW50U2luZ2xlVmFyKGFyZzAsIGVudiwgYXJnMiA9PT0gdGhpcy5fbm9uY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5FbnZTaW5nbGVFbmQ6IHtcblx0XHRcdFx0dGhpcy5fY3JlYXRlT3JHZXRTaGVsbEVudkRldGVjdGlvbigpLmVuZEVudmlyb25tZW50U2luZ2xlVmFyKGFyZ3NbMF0gPT09IHRoaXMuX25vbmNlKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFZTQ29kZU9zY1B0LlJpZ2h0UHJvbXB0U3RhcnQ6IHtcblx0XHRcdFx0dGhpcy5fY3JlYXRlT3JHZXRDb21tYW5kRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKS5oYW5kbGVSaWdodFByb21wdFN0YXJ0KCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5SaWdodFByb21wdEVuZDoge1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmhhbmRsZVJpZ2h0UHJvbXB0RW5kKCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBWU0NvZGVPc2NQdC5Qcm9wZXJ0eToge1xuXHRcdFx0XHRjb25zdCBhcmcwID0gYXJnc1swXTtcblx0XHRcdFx0Y29uc3QgZGVzZXJpYWxpemVkID0gYXJnMCAhPT0gdW5kZWZpbmVkID8gZGVzZXJpYWxpemVNZXNzYWdlKGFyZzApIDogJyc7XG5cdFx0XHRcdGNvbnN0IHsga2V5LCB2YWx1ZSB9ID0gcGFyc2VLZXlWYWx1ZUFzc2lnbm1lbnQoZGVzZXJpYWxpemVkKTtcblx0XHRcdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2l0Y2ggKGtleSkge1xuXHRcdFx0XHRcdGNhc2UgJ0NvbnRpbnVhdGlvblByb21wdCc6IHtcblx0XHRcdFx0XHRcdHRoaXMuX3VwZGF0ZUNvbnRpbnVhdGlvblByb21wdChyZW1vdmVBbnNpRXNjYXBlQ29kZXNGcm9tUHJvbXB0KHZhbHVlKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2FzZSAnQ3dkJzoge1xuXHRcdFx0XHRcdFx0dGhpcy5fdXBkYXRlQ3dkKHZhbHVlKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlICdJc1dpbmRvd3MnOiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLnNldElzV2luZG93c1B0eSh2YWx1ZSA9PT0gJ1RydWUnID8gdHJ1ZSA6IGZhbHNlKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlICdIYXNSaWNoQ29tbWFuZERldGVjdGlvbic6IHtcblx0XHRcdFx0XHRcdHRoaXMuX2NyZWF0ZU9yR2V0Q29tbWFuZERldGVjdGlvbih0aGlzLl90ZXJtaW5hbCkuc2V0SGFzUmljaENvbW1hbmREZXRlY3Rpb24odmFsdWUgPT09ICdUcnVlJyA/IHRydWUgOiBmYWxzZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2FzZSAnUHJvbXB0Jzoge1xuXHRcdFx0XHRcdFx0Ly8gUmVtb3ZlIGVzY2FwZSBzZXF1ZW5jZXMgZnJvbSB0aGUgdXNlcidzIHByb21wdFxuXHRcdFx0XHRcdFx0Y29uc3Qgc2FuaXRpemVkVmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9cXHgxYlxcW1swLTk7XSptL2csICcnKTtcblx0XHRcdFx0XHRcdHRoaXMuX3VwZGF0ZVByb21wdFRlcm1pbmF0b3Ioc2FuaXRpemVkVmFsdWUpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhc2UgJ1Rhc2snOiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldEJ1ZmZlck1hcmtEZXRlY3Rpb24odGhpcy5fdGVybWluYWwpO1xuXHRcdFx0XHRcdFx0dGhpcy5jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKT8uc2V0SXNDb21tYW5kU3RvcmFnZURpc2FibGVkKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNhc2UgVlNDb2RlT3NjUHQuU2V0TWFyazoge1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVPckdldEJ1ZmZlck1hcmtEZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLmFkZE1hcmsocGFyc2VNYXJrU2VxdWVuY2UoYXJncykpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBVbnJlY29nbml6ZWQgc2VxdWVuY2Vcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDb250aW51YXRpb25Qcm9tcHQodmFsdWU6IHN0cmluZykge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fY3JlYXRlT3JHZXRDb21tYW5kRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKS5zZXRDb250aW51YXRpb25Qcm9tcHQodmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlUHJvbXB0VGVybWluYXRvcihwcm9tcHQ6IHN0cmluZykge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbGFzdFByb21wdExpbmUgPSBwcm9tcHQuc3Vic3RyaW5nKHByb21wdC5sYXN0SW5kZXhPZignXFxuJykgKyAxKTtcblx0XHRjb25zdCBwcm9tcHRUZXJtaW5hdG9yID0gbGFzdFByb21wdExpbmUuc3Vic3RyaW5nKGxhc3RQcm9tcHRMaW5lLmxhc3RJbmRleE9mKCcgJykpO1xuXHRcdGlmIChwcm9tcHRUZXJtaW5hdG9yKSB7XG5cdFx0XHR0aGlzLl9jcmVhdGVPckdldENvbW1hbmREZXRlY3Rpb24odGhpcy5fdGVybWluYWwpLnNldFByb21wdFRlcm1pbmF0b3IocHJvbXB0VGVybWluYXRvciwgbGFzdFByb21wdExpbmUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUN3ZCh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dmFsdWUgPSBzYW5pdGl6ZUN3ZCh2YWx1ZSk7XG5cdFx0dGhpcy5fY3JlYXRlT3JHZXRDd2REZXRlY3Rpb24oKS51cGRhdGVDd2QodmFsdWUpO1xuXHRcdGNvbnN0IGNvbW1hbmREZXRlY3Rpb24gPSB0aGlzLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pO1xuXHRcdGNvbW1hbmREZXRlY3Rpb24/LnNldEN3ZCh2YWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9kb0hhbmRsZUlUZXJtU2VxdWVuY2UoZGF0YTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IFtjb21tYW5kXSA9IGRhdGEuc3BsaXQoJzsnKTtcblx0XHR0aGlzLl9tYXJrU2VxdWVuY2VTZWVuKGAke1NoZWxsSW50ZWdyYXRpb25Pc2NQcy5JVGVybX07JHtjb21tYW5kfWApO1xuXHRcdHN3aXRjaCAoY29tbWFuZCkge1xuXHRcdFx0Y2FzZSBJVGVybU9zY1B0LlNldE1hcms6IHtcblx0XHRcdFx0dGhpcy5fY3JlYXRlT3JHZXRCdWZmZXJNYXJrRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKS5hZGRNYXJrKCk7XG5cdFx0XHR9XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdC8vIENoZWNraW5nIGZvciBrbm93biBgPGtleT49PHZhbHVlPmAgcGFpcnMuXG5cdFx0XHRcdC8vIE5vdGUgdGhhdCB1bmxpa2UgYFZTQ29kZU9zY1B0LlByb3BlcnR5YCwgaVRlcm0yIGRvZXMgbm90IGludGVycHJldCBiYWNrc2xhc2ggb3IgaGV4LWVzY2FwZSBzZXF1ZW5jZXMuXG5cdFx0XHRcdC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2duYWNobWFuL2lUZXJtMi9ibG9iL2JiMDg4MjMzMmNlYzUxOTZlNGRlNGE0MjI1OTc4ZDc0NmU5MzUyNzkvc291cmNlcy9WVDEwMFRlcm1pbmFsLm0jTDIwODktTDIxMDVcblx0XHRcdFx0Y29uc3QgeyBrZXksIHZhbHVlIH0gPSBwYXJzZUtleVZhbHVlQXNzaWdubWVudChjb21tYW5kKTtcblxuXHRcdFx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdC8vIE5vICc9JyB3YXMgZm91bmQsIHNvIGl0J3Mgbm90IGEgcHJvcGVydHkgYXNzaWdubWVudC5cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN3aXRjaCAoa2V5KSB7XG5cdFx0XHRcdFx0Y2FzZSBJVGVybU9zY1B0LkN1cnJlbnREaXI6XG5cdFx0XHRcdFx0XHQvLyBFbmNvdW50ZXJlZDogYE9TQyAxMzM3IDsgQ3VycmVudERpcj08Q3dkPiBTVGBcblx0XHRcdFx0XHRcdHRoaXMuX3VwZGF0ZUN3ZCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVucmVjb2duaXplZCBzZXF1ZW5jZVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX2RvSGFuZGxlU2V0V2luZG93c0ZyaWVuZGx5Q3dkKGRhdGE6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBbY29tbWFuZCwgLi4uYXJnc10gPSBkYXRhLnNwbGl0KCc7Jyk7XG5cdFx0dGhpcy5fbWFya1NlcXVlbmNlU2VlbihgJHtTaGVsbEludGVncmF0aW9uT3NjUHMuU2V0V2luZG93c0ZyaWVuZGx5Q3dkfTske2NvbW1hbmR9YCk7XG5cdFx0c3dpdGNoIChjb21tYW5kKSB7XG5cdFx0XHRjYXNlICc5Jzpcblx0XHRcdFx0Ly8gRW5jb3VudGVyZWQgYE9TQyA5IDsgOSA7IDxjd2Q+IFNUYFxuXHRcdFx0XHRpZiAoYXJncy5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLl91cGRhdGVDd2QoYXJnc1swXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gVW5yZWNvZ25pemVkIHNlcXVlbmNlXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZXMgdGhlIHNlcXVlbmNlOiBgT1NDIDcgOyBzY2hlbWU6Ly9jd2QgU1RgXG5cdCAqL1xuXHRwcml2YXRlIF9kb0hhbmRsZVNldEN3ZChkYXRhOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgW2NvbW1hbmRdID0gZGF0YS5zcGxpdCgnOycpO1xuXHRcdHRoaXMuX21hcmtTZXF1ZW5jZVNlZW4oYCR7U2hlbGxJbnRlZ3JhdGlvbk9zY1BzLlNldEN3ZH07JHtjb21tYW5kfWApO1xuXG5cdFx0aWYgKGNvbW1hbmQubWF0Y2goL15maWxlOlxcL1xcLy4qXFwvLykpIHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShjb21tYW5kKTtcblx0XHRcdGlmICh1cmkucGF0aCAmJiB1cmkucGF0aC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUN3ZCh1cmkucGF0aCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVucmVjb2duaXplZCBzZXF1ZW5jZVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHNlcmlhbGl6ZSgpOiBJU2VyaWFsaXplZENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsIHx8ICF0aGlzLmNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpc1dpbmRvd3NQdHk6IGZhbHNlLFxuXHRcdFx0XHRoYXNSaWNoQ29tbWFuZERldGVjdGlvbjogZmFsc2UsXG5cdFx0XHRcdGNvbW1hbmRzOiBbXSxcblx0XHRcdFx0cHJvbXB0SW5wdXRNb2RlbDogdW5kZWZpbmVkLFxuXHRcdFx0fTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fY3JlYXRlT3JHZXRDb21tYW5kRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKS5zZXJpYWxpemUoKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZGVzZXJpYWxpemUoc2VyaWFsaXplZDogSVNlcmlhbGl6ZWRDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlc3RvcmUgY29tbWFuZHMgYmVmb3JlIGFkZG9uIGlzIGFjdGl2YXRlZCcpO1xuXHRcdH1cblx0XHRjb25zdCBjb21tYW5kRGV0ZWN0aW9uID0gdGhpcy5fY3JlYXRlT3JHZXRDb21tYW5kRGV0ZWN0aW9uKHRoaXMuX3Rlcm1pbmFsKTtcblx0XHRjb21tYW5kRGV0ZWN0aW9uLmRlc2VyaWFsaXplKHNlcmlhbGl6ZWQpO1xuXHRcdGlmIChjb21tYW5kRGV0ZWN0aW9uLmN3ZCkge1xuXHRcdFx0Ly8gQ3dkIGdldHMgc2V0IHdoZW4gdGhlIGNvbW1hbmQgaXMgZGVzZXJpYWxpemVkLCBzbyB3ZSBuZWVkIHRvIHVwZGF0ZSBpdCBoZXJlXG5cdFx0XHR0aGlzLl91cGRhdGVDd2QoY29tbWFuZERldGVjdGlvbi5jd2QpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfY3JlYXRlT3JHZXRDd2REZXRlY3Rpb24oKTogSUN3ZERldGVjdGlvbkNhcGFiaWxpdHkge1xuXHRcdGxldCBjd2REZXRlY3Rpb24gPSB0aGlzLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkN3ZERldGVjdGlvbik7XG5cdFx0aWYgKCFjd2REZXRlY3Rpb24pIHtcblx0XHRcdGN3ZERldGVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDd2REZXRlY3Rpb25DYXBhYmlsaXR5KCkpO1xuXHRcdFx0dGhpcy5jYXBhYmlsaXRpZXMuYWRkKFRlcm1pbmFsQ2FwYWJpbGl0eS5Dd2REZXRlY3Rpb24sIGN3ZERldGVjdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiBjd2REZXRlY3Rpb247XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2NyZWF0ZU9yR2V0Q29tbWFuZERldGVjdGlvbih0ZXJtaW5hbDogVGVybWluYWwpOiBJQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkge1xuXHRcdGxldCBjb21tYW5kRGV0ZWN0aW9uID0gdGhpcy5jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblx0XHRpZiAoIWNvbW1hbmREZXRlY3Rpb24pIHtcblx0XHRcdGNvbW1hbmREZXRlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkodGVybWluYWwsIHRoaXMuX2xvZ1NlcnZpY2UpKTtcblx0XHRcdHRoaXMuY2FwYWJpbGl0aWVzLmFkZChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiwgY29tbWFuZERldGVjdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiBjb21tYW5kRGV0ZWN0aW9uO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9jcmVhdGVPckdldEJ1ZmZlck1hcmtEZXRlY3Rpb24odGVybWluYWw6IFRlcm1pbmFsKTogSUJ1ZmZlck1hcmtDYXBhYmlsaXR5IHtcblx0XHRsZXQgYnVmZmVyTWFya0RldGVjdGlvbiA9IHRoaXMuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQnVmZmVyTWFya0RldGVjdGlvbik7XG5cdFx0aWYgKCFidWZmZXJNYXJrRGV0ZWN0aW9uKSB7XG5cdFx0XHRidWZmZXJNYXJrRGV0ZWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEJ1ZmZlck1hcmtDYXBhYmlsaXR5KHRlcm1pbmFsKSk7XG5cdFx0XHR0aGlzLmNhcGFiaWxpdGllcy5hZGQoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24sIGJ1ZmZlck1hcmtEZXRlY3Rpb24pO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZmVyTWFya0RldGVjdGlvbjtcblx0fVxuXG5cdHByb3RlY3RlZCBfY3JlYXRlT3JHZXRTaGVsbEVudkRldGVjdGlvbigpOiBJU2hlbGxFbnZEZXRlY3Rpb25DYXBhYmlsaXR5IHtcblx0XHRsZXQgc2hlbGxFbnZEZXRlY3Rpb24gPSB0aGlzLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LlNoZWxsRW52RGV0ZWN0aW9uKTtcblx0XHRpZiAoIXNoZWxsRW52RGV0ZWN0aW9uKSB7XG5cdFx0XHRzaGVsbEVudkRldGVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaGVsbEVudkRldGVjdGlvbkNhcGFiaWxpdHkoKSk7XG5cdFx0XHR0aGlzLmNhcGFiaWxpdGllcy5hZGQoVGVybWluYWxDYXBhYmlsaXR5LlNoZWxsRW52RGV0ZWN0aW9uLCBzaGVsbEVudkRldGVjdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiBzaGVsbEVudkRldGVjdGlvbjtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVzZXJpYWxpemVNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBtZXNzYWdlLnJlcGxhY2VBbGwoXG5cdFx0Ly8gQmFja3NsYXNoICgnXFwnKSBmb2xsb3dlZCBieSBhbiBlc2NhcGUgb3BlcmF0b3I6IGVpdGhlciBhbm90aGVyICdcXCcsIG9yICd4JyBhbmQgdHdvIGhleCBjaGFycy5cblx0XHQvXFxcXChcXFxcfHgoWzAtOWEtZl17Mn0pKS9naSxcblx0XHQvLyBJZiBpdCdzIGEgaGV4IHZhbHVlLCBwYXJzZSBpdCB0byBhIGNoYXJhY3Rlci5cblx0XHQvLyBPdGhlcndpc2UgdGhlIG9wZXJhdG9yIGlzICdcXCcsIHdoaWNoIHdlIHJldHVybiBsaXRlcmFsbHksIG5vdyB1bmVzY2FwZWQuXG5cdFx0KF9tYXRjaDogc3RyaW5nLCBvcDogc3RyaW5nLCBoZXg/OiBzdHJpbmcpID0+IGhleCA/IFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoaGV4LCAxNikpIDogb3ApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VLZXlWYWx1ZUFzc2lnbm1lbnQobWVzc2FnZTogc3RyaW5nKTogeyBrZXk6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCB9IHtcblx0Y29uc3Qgc2VwYXJhdG9ySW5kZXggPSBtZXNzYWdlLmluZGV4T2YoJz0nKTtcblx0aWYgKHNlcGFyYXRvckluZGV4ID09PSAtMSkge1xuXHRcdHJldHVybiB7IGtleTogbWVzc2FnZSwgdmFsdWU6IHVuZGVmaW5lZCB9OyAvLyBObyAnPScgd2FzIGZvdW5kLlxuXHR9XG5cdHJldHVybiB7XG5cdFx0a2V5OiBtZXNzYWdlLnN1YnN0cmluZygwLCBzZXBhcmF0b3JJbmRleCksXG5cdFx0dmFsdWU6IG1lc3NhZ2Uuc3Vic3RyaW5nKDEgKyBzZXBhcmF0b3JJbmRleClcblx0fTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VNYXJrU2VxdWVuY2Uoc2VxdWVuY2U6IChzdHJpbmcgfCB1bmRlZmluZWQpW10pOiB7IGlkPzogc3RyaW5nOyBoaWRkZW4/OiBib29sZWFuIH0ge1xuXHRsZXQgaWQgPSB1bmRlZmluZWQ7XG5cdGxldCBoaWRkZW4gPSBmYWxzZTtcblx0Zm9yIChjb25zdCBwcm9wZXJ0eSBvZiBzZXF1ZW5jZSkge1xuXHRcdC8vIFNhbml0eSBjaGVjaywgdGhpcyBzaG91bGRuJ3QgaGFwcGVuIGluIHByYWN0aWNlXG5cdFx0aWYgKHByb3BlcnR5ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0XHRpZiAocHJvcGVydHkgPT09ICdIaWRkZW4nKSB7XG5cdFx0XHRoaWRkZW4gPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAocHJvcGVydHkuc3RhcnRzV2l0aCgnSWQ9JykpIHtcblx0XHRcdGlkID0gcHJvcGVydHkuc3Vic3RyaW5nKDMpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4geyBpZCwgaGlkZGVuIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUE0Qiw4QkFBOEI7QUFDMUQsU0FBUyxZQUFZLFNBQXNCLG9CQUFvQjtBQUMvRCxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUEySiwwQkFBMEI7QUFDckwsU0FBUyx5Q0FBeUM7QUFHbEQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsV0FBVztBQUNwQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHVDQUF1QztBQUNoRCxTQUFTLG1DQUFtQztBQW9CckMsSUFBVyx3QkFBWCxrQkFBV0EsMkJBQVg7QUFJTixFQUFBQSw4Q0FBQSxlQUFZLE9BQVo7QUFLQSxFQUFBQSw4Q0FBQSxZQUFTLE9BQVQ7QUFJQSxFQUFBQSw4Q0FBQSxXQUFRLFFBQVI7QUFDQSxFQUFBQSw4Q0FBQSxZQUFTLEtBQVQ7QUFDQSxFQUFBQSw4Q0FBQSwyQkFBd0IsS0FBeEI7QUFmaUIsU0FBQUE7QUFBQSxHQUFBO0FBcUJsQixJQUFXLGlCQUFYLGtCQUFXQyxvQkFBWDtBQU1DLEVBQUFBLGdCQUFBLGlCQUFjO0FBT2QsRUFBQUEsZ0JBQUEsa0JBQWU7QUFPZixFQUFBQSxnQkFBQSxxQkFBa0I7QUFRbEIsRUFBQUEsZ0JBQUEscUJBQWtCO0FBNUJSLFNBQUFBO0FBQUEsR0FBQTtBQTJDWCxJQUFXLGNBQVgsa0JBQVdDLGlCQUFYO0FBUUMsRUFBQUEsYUFBQSxpQkFBYztBQVNkLEVBQUFBLGFBQUEsa0JBQWU7QUFTZixFQUFBQSxhQUFBLHFCQUFrQjtBQVlsQixFQUFBQSxhQUFBLHFCQUFrQjtBQTRCbEIsRUFBQUEsYUFBQSxpQkFBYztBQU9kLEVBQUFBLGFBQUEsdUJBQW9CO0FBT3BCLEVBQUFBLGFBQUEscUJBQWtCO0FBT2xCLEVBQUFBLGFBQUEsc0JBQW1C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QUFDLG1CQUFtQjtBQUN2QiwwQkFBb0IsS0FBSyxVQUFVLElBQUksNEJBQTRCLENBQUM7QUFDcEUsV0FBSyxhQUFhLElBQUksbUJBQW1CLG1CQUFtQixpQkFBaUI7QUFBQSxJQUM5RTtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFFTyxTQUFTLG1CQUFtQixTQUF5QjtBQUMzRCxTQUFPLFFBQVE7QUFBQTtBQUFBLElBRWQ7QUFBQTtBQUFBO0FBQUEsSUFHQSxDQUFDLFFBQWdCLElBQVksUUFBaUIsTUFBTSxPQUFPLGFBQWEsU0FBUyxLQUFLLEVBQUUsQ0FBQyxJQUFJO0FBQUEsRUFBRTtBQUNqRztBQUVPLFNBQVMsd0JBQXdCLFNBQTZEO0FBQ3BHLFFBQU0saUJBQWlCLFFBQVEsUUFBUSxHQUFHO0FBQzFDLE1BQUksbUJBQW1CLElBQUk7QUFDMUIsV0FBTyxFQUFFLEtBQUssU0FBUyxPQUFPLE9BQVU7QUFBQSxFQUN6QztBQUNBLFNBQU87QUFBQSxJQUNOLEtBQUssUUFBUSxVQUFVLEdBQUcsY0FBYztBQUFBLElBQ3hDLE9BQU8sUUFBUSxVQUFVLElBQUksY0FBYztBQUFBLEVBQzVDO0FBQ0Q7QUFHTyxTQUFTLGtCQUFrQixVQUFxRTtBQUN0RyxNQUFJLEtBQUs7QUFDVCxNQUFJLFNBQVM7QUFDYixhQUFXLFlBQVksVUFBVTtBQUVoQyxRQUFJLGFBQWEsUUFBVztBQUMzQjtBQUFBLElBQ0Q7QUFDQSxRQUFJLGFBQWEsVUFBVTtBQUMxQixlQUFTO0FBQUEsSUFDVjtBQUNBLFFBQUksU0FBUyxXQUFXLEtBQUssR0FBRztBQUMvQixXQUFLLFNBQVMsVUFBVSxDQUFDO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQ0EsU0FBTyxFQUFFLElBQUksT0FBTztBQUNyQjsiLAogICJuYW1lcyI6IFsiU2hlbGxJbnRlZ3JhdGlvbk9zY1BzIiwgIkZpbmFsVGVybU9zY1B0IiwgIlZTQ29kZU9zY1B0IiwgIklUZXJtT3NjUHQiXQp9Cg==
