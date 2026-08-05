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
import { TerminalShellExecutionCommandLineConfidence } from "./extHostTypes.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { IExtHostTerminalService } from "./extHostTerminalService.js";
import { Emitter } from "../../../base/common/event.js";
import { URI } from "../../../base/common/uri.js";
import { AsyncIterableObject, Barrier } from "../../../base/common/async.js";
const IExtHostTerminalShellIntegration = createDecorator("IExtHostTerminalShellIntegration");
let ExtHostTerminalShellIntegration = class extends Disposable {
  constructor(extHostRpc, _extHostTerminalService) {
    super();
    this._extHostTerminalService = _extHostTerminalService;
    this._activeShellIntegrations = /* @__PURE__ */ new Map();
    this._onDidChangeTerminalShellIntegration = new Emitter();
    this.onDidChangeTerminalShellIntegration = this._onDidChangeTerminalShellIntegration.event;
    this._onDidStartTerminalShellExecution = new Emitter();
    this.onDidStartTerminalShellExecution = this._onDidStartTerminalShellExecution.event;
    this._onDidEndTerminalShellExecution = new Emitter();
    this.onDidEndTerminalShellExecution = this._onDidEndTerminalShellExecution.event;
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadTerminalShellIntegration);
    this._register(toDisposable(() => {
      for (const [_, integration] of this._activeShellIntegrations) {
        integration.dispose();
      }
      this._activeShellIntegrations.clear();
    }));
  }
  $shellIntegrationChange(instanceId) {
    const terminal = this._extHostTerminalService.getTerminalById(instanceId);
    if (!terminal) {
      return;
    }
    const apiTerminal = terminal.value;
    let shellIntegration = this._activeShellIntegrations.get(instanceId);
    if (!shellIntegration) {
      shellIntegration = new InternalTerminalShellIntegration(terminal.value, this._onDidStartTerminalShellExecution);
      this._activeShellIntegrations.set(instanceId, shellIntegration);
      shellIntegration.store.add(terminal.onWillDispose(() => this._activeShellIntegrations.get(instanceId)?.dispose()));
      shellIntegration.store.add(shellIntegration.onDidRequestShellExecution((commandLine) => this._proxy.$executeCommand(instanceId, commandLine)));
      shellIntegration.store.add(shellIntegration.onDidRequestEndExecution((e) => this._onDidEndTerminalShellExecution.fire(e)));
      shellIntegration.store.add(shellIntegration.onDidRequestChangeShellIntegration((e) => this._onDidChangeTerminalShellIntegration.fire(e)));
      terminal.shellIntegration = shellIntegration.value;
    }
    this._onDidChangeTerminalShellIntegration.fire({
      terminal: apiTerminal,
      shellIntegration: shellIntegration.value
    });
  }
  $shellExecutionStart(instanceId, commandLineValue, commandLineConfidence, isTrusted, cwd) {
    if (!this._activeShellIntegrations.has(instanceId)) {
      this.$shellIntegrationChange(instanceId);
    }
    const commandLine = {
      value: commandLineValue,
      confidence: commandLineConfidence,
      isTrusted
    };
    this._activeShellIntegrations.get(instanceId)?.startShellExecution(commandLine, URI.revive(cwd));
  }
  $shellExecutionEnd(instanceId, commandLineValue, commandLineConfidence, isTrusted, exitCode) {
    const commandLine = {
      value: commandLineValue,
      confidence: commandLineConfidence,
      isTrusted
    };
    this._activeShellIntegrations.get(instanceId)?.endShellExecution(commandLine, exitCode);
  }
  $shellExecutionData(instanceId, data) {
    this._activeShellIntegrations.get(instanceId)?.emitData(data);
  }
  $shellEnvChange(instanceId, shellEnvKeys, shellEnvValues, isTrusted) {
    this._activeShellIntegrations.get(instanceId)?.setEnv(shellEnvKeys, shellEnvValues, isTrusted);
  }
  $cwdChange(instanceId, cwd) {
    this._activeShellIntegrations.get(instanceId)?.setCwd(URI.revive(cwd));
  }
  $closeTerminal(instanceId) {
    this._activeShellIntegrations.get(instanceId)?.dispose();
    this._activeShellIntegrations.delete(instanceId);
  }
};
ExtHostTerminalShellIntegration = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostTerminalService)
], ExtHostTerminalShellIntegration);
class InternalTerminalShellIntegration extends Disposable {
  constructor(_terminal, _onDidStartTerminalShellExecution) {
    super();
    this._terminal = _terminal;
    this._onDidStartTerminalShellExecution = _onDidStartTerminalShellExecution;
    this._pendingExecutions = [];
    this.store = this._register(new DisposableStore());
    this._onDidRequestChangeShellIntegration = this._register(new Emitter());
    this.onDidRequestChangeShellIntegration = this._onDidRequestChangeShellIntegration.event;
    this._onDidRequestShellExecution = this._register(new Emitter());
    this.onDidRequestShellExecution = this._onDidRequestShellExecution.event;
    this._onDidRequestEndExecution = this._register(new Emitter());
    this.onDidRequestEndExecution = this._onDidRequestEndExecution.event;
    this._onDidRequestNewExecution = this._register(new Emitter());
    this.onDidRequestNewExecution = this._onDidRequestNewExecution.event;
    const that = this;
    this.value = {
      get cwd() {
        return that._cwd;
      },
      get env() {
        if (!that._env) {
          return void 0;
        }
        return Object.freeze({
          isTrusted: that._env.isTrusted,
          value: Object.freeze({ ...that._env.value })
        });
      },
      // executeCommand(commandLine: string): vscode.TerminalShellExecution;
      // executeCommand(executable: string, args: string[]): vscode.TerminalShellExecution;
      executeCommand(commandLineOrExecutable, args) {
        let commandLineValue = commandLineOrExecutable;
        if (args) {
          for (const arg of args) {
            const wrapInQuotes = !arg.match(/["'`]/) && arg.match(/\s/);
            if (wrapInQuotes) {
              commandLineValue += ` "${arg}"`;
            } else {
              commandLineValue += ` ${arg}`;
            }
          }
        }
        that._onDidRequestShellExecution.fire(commandLineValue);
        const commandLine = {
          value: commandLineValue,
          confidence: TerminalShellExecutionCommandLineConfidence.High,
          isTrusted: true
        };
        const execution = that.requestNewShellExecution(commandLine, that._cwd).value;
        return execution;
      }
    };
  }
  get currentExecution() {
    return this._currentExecution;
  }
  requestNewShellExecution(commandLine, cwd) {
    const execution = new InternalTerminalShellExecution(commandLine, cwd ?? this._cwd);
    const unresolvedCommandLines = splitAndSanitizeCommandLine(commandLine.value);
    if (unresolvedCommandLines.length > 1) {
      this._currentExecutionProperties = {
        isMultiLine: true,
        unresolvedCommandLines: splitAndSanitizeCommandLine(commandLine.value)
      };
    }
    this._pendingExecutions.push(execution);
    this._onDidRequestNewExecution.fire(commandLine.value);
    return execution;
  }
  startShellExecution(commandLine, cwd) {
    if (this._pendingEndingExecution) {
      this._onDidRequestEndExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: this._pendingEndingExecution.value, exitCode: void 0 });
      this._pendingEndingExecution = void 0;
    }
    if (this._currentExecution) {
      if (this._currentExecutionProperties?.isMultiLine && this._currentExecutionProperties.unresolvedCommandLines) {
        const subExecutionResult = isSubExecution(this._currentExecutionProperties.unresolvedCommandLines, commandLine);
        if (subExecutionResult) {
          this._currentExecutionProperties.unresolvedCommandLines = subExecutionResult.unresolvedCommandLines;
          return;
        }
      }
      this._currentExecution.endExecution(void 0);
      this._currentExecution.flush();
      this._onDidRequestEndExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: this._currentExecution.value, exitCode: void 0 });
    }
    let currentExecution;
    if (commandLine.confidence === TerminalShellExecutionCommandLineConfidence.High) {
      for (const [i, execution] of this._pendingExecutions.entries()) {
        if (execution.value.commandLine.value === commandLine.value) {
          currentExecution = execution;
          this._currentExecutionProperties = {
            isMultiLine: false,
            unresolvedCommandLines: void 0
          };
          currentExecution = execution;
          this._pendingExecutions.splice(i, 1);
          break;
        } else {
          const subExecutionResult = isSubExecution(splitAndSanitizeCommandLine(execution.value.commandLine.value), commandLine);
          if (subExecutionResult) {
            this._currentExecutionProperties = {
              isMultiLine: true,
              unresolvedCommandLines: subExecutionResult.unresolvedCommandLines
            };
            currentExecution = execution;
            this._pendingExecutions.splice(i, 1);
            break;
          }
        }
      }
    } else {
      currentExecution = this._pendingExecutions.shift();
    }
    if (!currentExecution) {
      currentExecution = new InternalTerminalShellExecution(commandLine, cwd ?? this._cwd);
    }
    this._currentExecution = currentExecution;
    this._onDidStartTerminalShellExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: this._currentExecution.value });
  }
  emitData(data) {
    this.currentExecution?.emitData(data);
  }
  endShellExecution(commandLine, exitCode) {
    if (this._currentExecutionProperties?.isMultiLine) {
      if (this._currentExecutionProperties.unresolvedCommandLines && this._currentExecutionProperties.unresolvedCommandLines.length > 0) {
        return;
      }
    }
    if (this._currentExecution) {
      const commandLineForEvent = this._currentExecutionProperties?.isMultiLine ? this._currentExecution.value.commandLine : commandLine;
      this._currentExecution.endExecution(commandLineForEvent);
      const currentExecution = this._currentExecution;
      this._pendingEndingExecution = currentExecution;
      this._currentExecution = void 0;
      currentExecution.flush().then(() => {
        if (this._pendingEndingExecution === currentExecution) {
          this._onDidRequestEndExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: currentExecution.value, exitCode });
          this._pendingEndingExecution = void 0;
        }
      });
    }
  }
  setEnv(keys, values, isTrusted) {
    const env = {};
    for (let i = 0; i < keys.length; i++) {
      env[keys[i]] = values[i];
    }
    this._env = { value: env, isTrusted };
    this._fireChangeEvent();
  }
  setCwd(cwd) {
    let wasChanged = false;
    if (URI.isUri(this._cwd)) {
      wasChanged = !URI.isUri(cwd) || this._cwd.toString() !== cwd.toString();
    } else if (this._cwd !== cwd) {
      wasChanged = true;
    }
    if (wasChanged) {
      this._cwd = cwd;
      this._fireChangeEvent();
    }
  }
  _fireChangeEvent() {
    this._onDidRequestChangeShellIntegration.fire({ terminal: this._terminal, shellIntegration: this.value });
  }
}
class InternalTerminalShellExecution {
  constructor(_commandLine, cwd) {
    this._commandLine = _commandLine;
    this.cwd = cwd;
    this._isEnded = false;
    const that = this;
    this.value = {
      get commandLine() {
        return that._commandLine;
      },
      get cwd() {
        return that.cwd;
      },
      read() {
        return that._createDataStream();
      }
    };
  }
  _createDataStream() {
    if (!this._dataStream) {
      if (this._isEnded) {
        return AsyncIterableObject.EMPTY;
      }
      this._dataStream = new ShellExecutionDataStream();
    }
    return this._dataStream.createIterable();
  }
  emitData(data) {
    if (!this._isEnded) {
      this._dataStream?.emitData(data);
    }
  }
  endExecution(commandLine) {
    if (commandLine) {
      this._commandLine = commandLine;
    }
    this._dataStream?.endExecution();
    this._isEnded = true;
  }
  async flush() {
    if (this._dataStream) {
      await this._dataStream.flush();
      this._dataStream.dispose();
      this._dataStream = void 0;
    }
  }
}
class ShellExecutionDataStream extends Disposable {
  constructor() {
    super(...arguments);
    this._iterables = [];
    this._emitters = [];
  }
  createIterable() {
    if (!this._barrier) {
      this._barrier = new Barrier();
    }
    const barrier = this._barrier;
    const iterable = new AsyncIterableObject(async (emitter) => {
      this._emitters.push(emitter);
      await barrier.wait();
    });
    this._iterables.push(iterable);
    return iterable;
  }
  emitData(data) {
    for (const emitter of this._emitters) {
      emitter.emitOne(data);
    }
  }
  endExecution() {
    this._barrier?.open();
  }
  async flush() {
    await Promise.all(this._iterables.map((e) => e.toPromise()));
  }
}
function splitAndSanitizeCommandLine(commandLine) {
  return commandLine.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}
function isSubExecution(unresolvedCommandLines, commandLine) {
  if (unresolvedCommandLines.length === 0) {
    return false;
  }
  const newUnresolvedCommandLines = [...unresolvedCommandLines];
  const subExecutionLines = splitAndSanitizeCommandLine(commandLine.value);
  if (newUnresolvedCommandLines && newUnresolvedCommandLines.length > 0) {
    while (newUnresolvedCommandLines.length > 0) {
      if (newUnresolvedCommandLines[0] !== subExecutionLines[0]) {
        break;
      }
      newUnresolvedCommandLines.shift();
      subExecutionLines.shift();
    }
    if (subExecutionLines.length === 0) {
      return { unresolvedCommandLines: newUnresolvedCommandLines };
    }
  }
  return false;
}
export {
  ExtHostTerminalShellIntegration,
  IExtHostTerminalShellIntegration,
  InternalTerminalShellIntegration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGVybWluYWxTaGVsbEludGVncmF0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IFRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZUNvbmZpZGVuY2UgfSBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IE1haW5Db250ZXh0LCB0eXBlIEV4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb25TaGFwZSwgdHlwZSBNYWluVGhyZWFkVGVybWluYWxTaGVsbEludGVncmF0aW9uU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RScGNTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0UnBjU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdFRlcm1pbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCB0eXBlIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgVVJJLCB0eXBlIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQXN5bmNJdGVyYWJsZU9iamVjdCwgQmFycmllciwgdHlwZSBBc3luY0l0ZXJhYmxlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJRXh0SG9zdFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbiBleHRlbmRzIEV4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb25TaGFwZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZVRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbjogRXZlbnQ8dnNjb2RlLlRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbkNoYW5nZUV2ZW50Pjtcblx0cmVhZG9ubHkgb25EaWRTdGFydFRlcm1pbmFsU2hlbGxFeGVjdXRpb246IEV2ZW50PHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uU3RhcnRFdmVudD47XG5cdHJlYWRvbmx5IG9uRGlkRW5kVGVybWluYWxTaGVsbEV4ZWN1dGlvbjogRXZlbnQ8dnNjb2RlLlRlcm1pbmFsU2hlbGxFeGVjdXRpb25FbmRFdmVudD47XG59XG5leHBvcnQgY29uc3QgSUV4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24gPSBjcmVhdGVEZWNvcmF0b3I8SUV4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24+KCdJRXh0SG9zdFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbicpO1xuXG5leHBvcnQgY2xhc3MgRXh0SG9zdFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0SG9zdFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbiB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByb3RlY3RlZCBfcHJveHk6IE1haW5UaHJlYWRUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb25TaGFwZTtcblxuXHRwcml2YXRlIF9hY3RpdmVTaGVsbEludGVncmF0aW9uczogTWFwPC8qaW5zdGFuY2VJZCovbnVtYmVyLCBJbnRlcm5hbFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbj4gPSBuZXcgTWFwKCk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZVRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbiA9IG5ldyBFbWl0dGVyPHZzY29kZS5UZXJtaW5hbFNoZWxsSW50ZWdyYXRpb25DaGFuZ2VFdmVudD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24gPSB0aGlzLl9vbkRpZENoYW5nZVRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbi5ldmVudDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFN0YXJ0VGVybWluYWxTaGVsbEV4ZWN1dGlvbiA9IG5ldyBFbWl0dGVyPHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uU3RhcnRFdmVudD4oKTtcblx0cmVhZG9ubHkgb25EaWRTdGFydFRlcm1pbmFsU2hlbGxFeGVjdXRpb24gPSB0aGlzLl9vbkRpZFN0YXJ0VGVybWluYWxTaGVsbEV4ZWN1dGlvbi5ldmVudDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZEVuZFRlcm1pbmFsU2hlbGxFeGVjdXRpb24gPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGVybWluYWxTaGVsbEV4ZWN1dGlvbkVuZEV2ZW50PigpO1xuXHRyZWFkb25seSBvbkRpZEVuZFRlcm1pbmFsU2hlbGxFeGVjdXRpb24gPSB0aGlzLl9vbkRpZEVuZFRlcm1pbmFsU2hlbGxFeGVjdXRpb24uZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRIb3N0UnBjU2VydmljZSBleHRIb3N0UnBjOiBJRXh0SG9zdFJwY1NlcnZpY2UsXG5cdFx0QElFeHRIb3N0VGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dEhvc3RUZXJtaW5hbFNlcnZpY2U6IElFeHRIb3N0VGVybWluYWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcHJveHkgPSBleHRIb3N0UnBjLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24pO1xuXG5cdFx0Ly8gQ2xlYW4gdXAgbGlzdGVuZXJzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGZvciAoY29uc3QgW18sIGludGVncmF0aW9uXSBvZiB0aGlzLl9hY3RpdmVTaGVsbEludGVncmF0aW9ucykge1xuXHRcdFx0XHRpbnRlZ3JhdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9hY3RpdmVTaGVsbEludGVncmF0aW9ucy5jbGVhcigpO1xuXHRcdH0pKTtcblxuXHRcdC8vIENvbnZlbmllbnQgdGVzdCBjb2RlOlxuXHRcdC8vIHRoaXMub25EaWRDaGFuZ2VUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24oZSA9PiB7XG5cdFx0Ly8gXHRjb25zb2xlLmxvZygnKioqIG9uRGlkQ2hhbmdlVGVybWluYWxTaGVsbEludGVncmF0aW9uJywgZSk7XG5cdFx0Ly8gfSk7XG5cdFx0Ly8gdGhpcy5vbkRpZFN0YXJ0VGVybWluYWxTaGVsbEV4ZWN1dGlvbihhc3luYyBlID0+IHtcblx0XHQvLyBcdGNvbnNvbGUubG9nKCcqKiogb25EaWRTdGFydFRlcm1pbmFsU2hlbGxFeGVjdXRpb24nLCBlKTtcblx0XHQvLyBcdC8vIG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4ge1xuXHRcdC8vIFx0Ly8gXHQoYXN5bmMgKCkgPT4ge1xuXHRcdC8vIFx0Ly8gXHRcdGZvciBhd2FpdCAoY29uc3QgZCBvZiBlLmV4ZWN1dGlvbi5yZWFkKCkpIHtcblx0XHQvLyBcdC8vIFx0XHRcdGNvbnNvbGUubG9nKCdkYXRhMicsIGQpO1xuXHRcdC8vIFx0Ly8gXHRcdH1cblx0XHQvLyBcdC8vIFx0fSkoKTtcblx0XHQvLyBcdC8vIH0pO1xuXHRcdC8vIFx0Zm9yIGF3YWl0IChjb25zdCBkIG9mIGUuZXhlY3V0aW9uLnJlYWQoKSkge1xuXHRcdC8vIFx0XHRjb25zb2xlLmxvZygnZGF0YScsIGQpO1xuXHRcdC8vIFx0fVxuXHRcdC8vIH0pO1xuXHRcdC8vIHRoaXMub25EaWRFbmRUZXJtaW5hbFNoZWxsRXhlY3V0aW9uKGUgPT4ge1xuXHRcdC8vIFx0Y29uc29sZS5sb2coJyoqKiBvbkRpZEVuZFRlcm1pbmFsU2hlbGxFeGVjdXRpb24nLCBlKTtcblx0XHQvLyB9KTtcblx0XHQvLyBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHQvLyBcdGNvbnNvbGUubG9nKCdiZWZvcmUgZXhlY3V0ZUNvbW1hbmQoXFxcImVjaG8gaGVsbG9cXFwiKScpO1xuXHRcdC8vIFx0QXJyYXkuZnJvbSh0aGlzLl9hY3RpdmVTaGVsbEludGVncmF0aW9ucy52YWx1ZXMoKSlbMF0udmFsdWUuZXhlY3V0ZUNvbW1hbmQoJ2VjaG8gaGVsbG8nKTtcblx0XHQvLyBcdGNvbnNvbGUubG9nKCdhZnRlciBleGVjdXRlQ29tbWFuZChcXFwiZWNobyBoZWxsb1xcXCIpJyk7XG5cdFx0Ly8gfSwgNDAwMCk7XG5cdH1cblxuXHRwdWJsaWMgJHNoZWxsSW50ZWdyYXRpb25DaGFuZ2UoaW5zdGFuY2VJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgdGVybWluYWwgPSB0aGlzLl9leHRIb3N0VGVybWluYWxTZXJ2aWNlLmdldFRlcm1pbmFsQnlJZChpbnN0YW5jZUlkKTtcblx0XHRpZiAoIXRlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXBpVGVybWluYWwgPSB0ZXJtaW5hbC52YWx1ZTtcblx0XHRsZXQgc2hlbGxJbnRlZ3JhdGlvbiA9IHRoaXMuX2FjdGl2ZVNoZWxsSW50ZWdyYXRpb25zLmdldChpbnN0YW5jZUlkKTtcblx0XHRpZiAoIXNoZWxsSW50ZWdyYXRpb24pIHtcblx0XHRcdHNoZWxsSW50ZWdyYXRpb24gPSBuZXcgSW50ZXJuYWxUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24odGVybWluYWwudmFsdWUsIHRoaXMuX29uRGlkU3RhcnRUZXJtaW5hbFNoZWxsRXhlY3V0aW9uKTtcblx0XHRcdHRoaXMuX2FjdGl2ZVNoZWxsSW50ZWdyYXRpb25zLnNldChpbnN0YW5jZUlkLCBzaGVsbEludGVncmF0aW9uKTtcblx0XHRcdHNoZWxsSW50ZWdyYXRpb24uc3RvcmUuYWRkKHRlcm1pbmFsLm9uV2lsbERpc3Bvc2UoKCkgPT4gdGhpcy5fYWN0aXZlU2hlbGxJbnRlZ3JhdGlvbnMuZ2V0KGluc3RhbmNlSWQpPy5kaXNwb3NlKCkpKTtcblx0XHRcdHNoZWxsSW50ZWdyYXRpb24uc3RvcmUuYWRkKHNoZWxsSW50ZWdyYXRpb24ub25EaWRSZXF1ZXN0U2hlbGxFeGVjdXRpb24oY29tbWFuZExpbmUgPT4gdGhpcy5fcHJveHkuJGV4ZWN1dGVDb21tYW5kKGluc3RhbmNlSWQsIGNvbW1hbmRMaW5lKSkpO1xuXHRcdFx0c2hlbGxJbnRlZ3JhdGlvbi5zdG9yZS5hZGQoc2hlbGxJbnRlZ3JhdGlvbi5vbkRpZFJlcXVlc3RFbmRFeGVjdXRpb24oZSA9PiB0aGlzLl9vbkRpZEVuZFRlcm1pbmFsU2hlbGxFeGVjdXRpb24uZmlyZShlKSkpO1xuXHRcdFx0c2hlbGxJbnRlZ3JhdGlvbi5zdG9yZS5hZGQoc2hlbGxJbnRlZ3JhdGlvbi5vbkRpZFJlcXVlc3RDaGFuZ2VTaGVsbEludGVncmF0aW9uKGUgPT4gdGhpcy5fb25EaWRDaGFuZ2VUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24uZmlyZShlKSkpO1xuXHRcdFx0dGVybWluYWwuc2hlbGxJbnRlZ3JhdGlvbiA9IHNoZWxsSW50ZWdyYXRpb24udmFsdWU7XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVGVybWluYWxTaGVsbEludGVncmF0aW9uLmZpcmUoe1xuXHRcdFx0dGVybWluYWw6IGFwaVRlcm1pbmFsLFxuXHRcdFx0c2hlbGxJbnRlZ3JhdGlvbjogc2hlbGxJbnRlZ3JhdGlvbi52YWx1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljICRzaGVsbEV4ZWN1dGlvblN0YXJ0KGluc3RhbmNlSWQ6IG51bWJlciwgY29tbWFuZExpbmVWYWx1ZTogc3RyaW5nLCBjb21tYW5kTGluZUNvbmZpZGVuY2U6IFRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZUNvbmZpZGVuY2UsIGlzVHJ1c3RlZDogYm9vbGVhbiwgY3dkOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Ly8gRm9yY2Ugc2hlbGxJbnRlZ3JhdGlvbiBjcmVhdGlvbiBpZiBpdCBoYXNuJ3QgYmVlbiBjcmVhdGVkIHlldCwgdGhpcyBjb3VsZCB3aGVuIGV2ZW50c1xuXHRcdC8vIGRvbid0IGNvbWUgdGhyb3VnaCBvbiBzdGFydHVwXG5cdFx0aWYgKCF0aGlzLl9hY3RpdmVTaGVsbEludGVncmF0aW9ucy5oYXMoaW5zdGFuY2VJZCkpIHtcblx0XHRcdHRoaXMuJHNoZWxsSW50ZWdyYXRpb25DaGFuZ2UoaW5zdGFuY2VJZCk7XG5cdFx0fVxuXHRcdGNvbnN0IGNvbW1hbmRMaW5lOiB2c2NvZGUuVGVybWluYWxTaGVsbEV4ZWN1dGlvbkNvbW1hbmRMaW5lID0ge1xuXHRcdFx0dmFsdWU6IGNvbW1hbmRMaW5lVmFsdWUsXG5cdFx0XHRjb25maWRlbmNlOiBjb21tYW5kTGluZUNvbmZpZGVuY2UsXG5cdFx0XHRpc1RydXN0ZWRcblx0XHR9O1xuXHRcdHRoaXMuX2FjdGl2ZVNoZWxsSW50ZWdyYXRpb25zLmdldChpbnN0YW5jZUlkKT8uc3RhcnRTaGVsbEV4ZWN1dGlvbihjb21tYW5kTGluZSwgVVJJLnJldml2ZShjd2QpKTtcblx0fVxuXG5cdHB1YmxpYyAkc2hlbGxFeGVjdXRpb25FbmQoaW5zdGFuY2VJZDogbnVtYmVyLCBjb21tYW5kTGluZVZhbHVlOiBzdHJpbmcsIGNvbW1hbmRMaW5lQ29uZmlkZW5jZTogVGVybWluYWxTaGVsbEV4ZWN1dGlvbkNvbW1hbmRMaW5lQ29uZmlkZW5jZSwgaXNUcnVzdGVkOiBib29sZWFuLCBleGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgY29tbWFuZExpbmU6IHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmUgPSB7XG5cdFx0XHR2YWx1ZTogY29tbWFuZExpbmVWYWx1ZSxcblx0XHRcdGNvbmZpZGVuY2U6IGNvbW1hbmRMaW5lQ29uZmlkZW5jZSxcblx0XHRcdGlzVHJ1c3RlZFxuXHRcdH07XG5cdFx0dGhpcy5fYWN0aXZlU2hlbGxJbnRlZ3JhdGlvbnMuZ2V0KGluc3RhbmNlSWQpPy5lbmRTaGVsbEV4ZWN1dGlvbihjb21tYW5kTGluZSwgZXhpdENvZGUpO1xuXHR9XG5cblx0cHVibGljICRzaGVsbEV4ZWN1dGlvbkRhdGEoaW5zdGFuY2VJZDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9hY3RpdmVTaGVsbEludGVncmF0aW9ucy5nZXQoaW5zdGFuY2VJZCk/LmVtaXREYXRhKGRhdGEpO1xuXHR9XG5cblx0cHVibGljICRzaGVsbEVudkNoYW5nZShpbnN0YW5jZUlkOiBudW1iZXIsIHNoZWxsRW52S2V5czogc3RyaW5nW10sIHNoZWxsRW52VmFsdWVzOiBzdHJpbmdbXSwgaXNUcnVzdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fYWN0aXZlU2hlbGxJbnRlZ3JhdGlvbnMuZ2V0KGluc3RhbmNlSWQpPy5zZXRFbnYoc2hlbGxFbnZLZXlzLCBzaGVsbEVudlZhbHVlcywgaXNUcnVzdGVkKTtcblx0fVxuXG5cdHB1YmxpYyAkY3dkQ2hhbmdlKGluc3RhbmNlSWQ6IG51bWJlciwgY3dkOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fYWN0aXZlU2hlbGxJbnRlZ3JhdGlvbnMuZ2V0KGluc3RhbmNlSWQpPy5zZXRDd2QoVVJJLnJldml2ZShjd2QpKTtcblx0fVxuXG5cdHB1YmxpYyAkY2xvc2VUZXJtaW5hbChpbnN0YW5jZUlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9hY3RpdmVTaGVsbEludGVncmF0aW9ucy5nZXQoaW5zdGFuY2VJZCk/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9hY3RpdmVTaGVsbEludGVncmF0aW9ucy5kZWxldGUoaW5zdGFuY2VJZCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElFeGVjdXRpb25Qcm9wZXJ0aWVzIHtcblx0aXNNdWx0aUxpbmU6IGJvb2xlYW47XG5cdHVucmVzb2x2ZWRDb21tYW5kTGluZXM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY2xhc3MgSW50ZXJuYWxUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfcGVuZGluZ0V4ZWN1dGlvbnM6IEludGVybmFsVGVybWluYWxTaGVsbEV4ZWN1dGlvbltdID0gW107XG5cdHByaXZhdGUgX3BlbmRpbmdFbmRpbmdFeGVjdXRpb246IEludGVybmFsVGVybWluYWxTaGVsbEV4ZWN1dGlvbiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllczogSUV4ZWN1dGlvblByb3BlcnRpZXMgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2N1cnJlbnRFeGVjdXRpb246IEludGVybmFsVGVybWluYWxTaGVsbEV4ZWN1dGlvbiB8IHVuZGVmaW5lZDtcblx0Z2V0IGN1cnJlbnRFeGVjdXRpb24oKTogSW50ZXJuYWxUZXJtaW5hbFNoZWxsRXhlY3V0aW9uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2N1cnJlbnRFeGVjdXRpb247IH1cblxuXG5cdHByaXZhdGUgX2VudjogdnNjb2RlLlRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbkVudmlyb25tZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jd2Q6IFVSSSB8IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBzdG9yZTogRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRyZWFkb25seSB2YWx1ZTogdnNjb2RlLlRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbjtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkUmVxdWVzdENoYW5nZVNoZWxsSW50ZWdyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2c2NvZGUuVGVybWluYWxTaGVsbEludGVncmF0aW9uQ2hhbmdlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3RDaGFuZ2VTaGVsbEludGVncmF0aW9uID0gdGhpcy5fb25EaWRSZXF1ZXN0Q2hhbmdlU2hlbGxJbnRlZ3JhdGlvbi5ldmVudDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3RTaGVsbEV4ZWN1dGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVxdWVzdFNoZWxsRXhlY3V0aW9uID0gdGhpcy5fb25EaWRSZXF1ZXN0U2hlbGxFeGVjdXRpb24uZXZlbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRSZXF1ZXN0RW5kRXhlY3V0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dnNjb2RlLlRlcm1pbmFsU2hlbGxFeGVjdXRpb25FbmRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVxdWVzdEVuZEV4ZWN1dGlvbiA9IHRoaXMuX29uRGlkUmVxdWVzdEVuZEV4ZWN1dGlvbi5ldmVudDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3ROZXdFeGVjdXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3ROZXdFeGVjdXRpb24gPSB0aGlzLl9vbkRpZFJlcXVlc3ROZXdFeGVjdXRpb24uZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGVybWluYWw6IHZzY29kZS5UZXJtaW5hbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFN0YXJ0VGVybWluYWxTaGVsbEV4ZWN1dGlvbjogRW1pdHRlcjx2c2NvZGUuVGVybWluYWxTaGVsbEV4ZWN1dGlvblN0YXJ0RXZlbnQ+XG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLnZhbHVlID0ge1xuXHRcdFx0Z2V0IGN3ZCgpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5fY3dkO1xuXHRcdFx0fSxcblx0XHRcdGdldCBlbnYoKTogdnNjb2RlLlRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbkVudmlyb25tZW50IHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0aWYgKCF0aGF0Ll9lbnYpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKHtcblx0XHRcdFx0XHRpc1RydXN0ZWQ6IHRoYXQuX2Vudi5pc1RydXN0ZWQsXG5cdFx0XHRcdFx0dmFsdWU6IE9iamVjdC5mcmVlemUoeyAuLi50aGF0Ll9lbnYudmFsdWUgfSlcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gZXhlY3V0ZUNvbW1hbmQoY29tbWFuZExpbmU6IHN0cmluZyk6IHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uO1xuXHRcdFx0Ly8gZXhlY3V0ZUNvbW1hbmQoZXhlY3V0YWJsZTogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSk6IHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uO1xuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQoY29tbWFuZExpbmVPckV4ZWN1dGFibGU6IHN0cmluZywgYXJncz86IHN0cmluZ1tdKTogdnNjb2RlLlRlcm1pbmFsU2hlbGxFeGVjdXRpb24ge1xuXHRcdFx0XHRsZXQgY29tbWFuZExpbmVWYWx1ZSA9IGNvbW1hbmRMaW5lT3JFeGVjdXRhYmxlO1xuXHRcdFx0XHRpZiAoYXJncykge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgYXJnIG9mIGFyZ3MpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHdyYXBJblF1b3RlcyA9ICFhcmcubWF0Y2goL1tcIidgXS8pICYmIGFyZy5tYXRjaCgvXFxzLyk7XG5cdFx0XHRcdFx0XHRpZiAod3JhcEluUXVvdGVzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbW1hbmRMaW5lVmFsdWUgKz0gYCBcIiR7YXJnfVwiYDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvbW1hbmRMaW5lVmFsdWUgKz0gYCAke2FyZ31gO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoYXQuX29uRGlkUmVxdWVzdFNoZWxsRXhlY3V0aW9uLmZpcmUoY29tbWFuZExpbmVWYWx1ZSk7XG5cdFx0XHRcdC8vIEZpcmUgdGhlIGV2ZW50IGluIGEgbWljcm90YXNrIHRvIGFsbG93IHRoZSBleHRlbnNpb24gdG8gdXNlIHRoZSBleGVjdXRpb24gYmVmb3JlXG5cdFx0XHRcdC8vIHRoZSBzdGFydCBldmVudCBmaXJlc1xuXHRcdFx0XHRjb25zdCBjb21tYW5kTGluZTogdnNjb2RlLlRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZSA9IHtcblx0XHRcdFx0XHR2YWx1ZTogY29tbWFuZExpbmVWYWx1ZSxcblx0XHRcdFx0XHRjb25maWRlbmNlOiBUZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmVDb25maWRlbmNlLkhpZ2gsXG5cdFx0XHRcdFx0aXNUcnVzdGVkOiB0cnVlXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IGV4ZWN1dGlvbiA9IHRoYXQucmVxdWVzdE5ld1NoZWxsRXhlY3V0aW9uKGNvbW1hbmRMaW5lLCB0aGF0Ll9jd2QpLnZhbHVlO1xuXHRcdFx0XHRyZXR1cm4gZXhlY3V0aW9uO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRyZXF1ZXN0TmV3U2hlbGxFeGVjdXRpb24oY29tbWFuZExpbmU6IHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmUsIGN3ZDogVVJJIHwgdW5kZWZpbmVkKSB7XG5cdFx0Y29uc3QgZXhlY3V0aW9uID0gbmV3IEludGVybmFsVGVybWluYWxTaGVsbEV4ZWN1dGlvbihjb21tYW5kTGluZSwgY3dkID8/IHRoaXMuX2N3ZCk7XG5cdFx0Y29uc3QgdW5yZXNvbHZlZENvbW1hbmRMaW5lcyA9IHNwbGl0QW5kU2FuaXRpemVDb21tYW5kTGluZShjb21tYW5kTGluZS52YWx1ZSk7XG5cdFx0aWYgKHVucmVzb2x2ZWRDb21tYW5kTGluZXMubGVuZ3RoID4gMSkge1xuXHRcdFx0dGhpcy5fY3VycmVudEV4ZWN1dGlvblByb3BlcnRpZXMgPSB7XG5cdFx0XHRcdGlzTXVsdGlMaW5lOiB0cnVlLFxuXHRcdFx0XHR1bnJlc29sdmVkQ29tbWFuZExpbmVzOiBzcGxpdEFuZFNhbml0aXplQ29tbWFuZExpbmUoY29tbWFuZExpbmUudmFsdWUpLFxuXHRcdFx0fTtcblx0XHR9XG5cdFx0dGhpcy5fcGVuZGluZ0V4ZWN1dGlvbnMucHVzaChleGVjdXRpb24pO1xuXHRcdHRoaXMuX29uRGlkUmVxdWVzdE5ld0V4ZWN1dGlvbi5maXJlKGNvbW1hbmRMaW5lLnZhbHVlKTtcblx0XHRyZXR1cm4gZXhlY3V0aW9uO1xuXHR9XG5cblx0c3RhcnRTaGVsbEV4ZWN1dGlvbihjb21tYW5kTGluZTogdnNjb2RlLlRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZSwgY3dkOiBVUkkgfCB1bmRlZmluZWQpOiB1bmRlZmluZWQge1xuXHRcdC8vIFNpbmNlIGFuIGV4ZWN1dGlvbiBpcyBzdGFydGluZywgZmlyZSB0aGUgZW5kIGV2ZW50IGZvciBhbnkgZXhlY3V0aW9uIHRoYXQgaXMgYXdhaXRpbmcgdG9cblx0XHQvLyBlbmQuIFdoZW4gdGhpcyBoYXBwZW5zIGl0IG1lYW5zIHRoYXQgdGhlIGRhdGEgc3RyZWFtIG1heSBub3QgYmUgZmx1c2hlZCBhbmQgdGhlcmVmb3JlIG1heVxuXHRcdC8vIGZpcmUgZXZlbnRzIGFmdGVyIHRoZSBlbmQgZXZlbnQuXG5cdFx0aWYgKHRoaXMuX3BlbmRpbmdFbmRpbmdFeGVjdXRpb24pIHtcblx0XHRcdHRoaXMuX29uRGlkUmVxdWVzdEVuZEV4ZWN1dGlvbi5maXJlKHsgdGVybWluYWw6IHRoaXMuX3Rlcm1pbmFsLCBzaGVsbEludGVncmF0aW9uOiB0aGlzLnZhbHVlLCBleGVjdXRpb246IHRoaXMuX3BlbmRpbmdFbmRpbmdFeGVjdXRpb24udmFsdWUsIGV4aXRDb2RlOiB1bmRlZmluZWQgfSk7XG5cdFx0XHR0aGlzLl9wZW5kaW5nRW5kaW5nRXhlY3V0aW9uID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jdXJyZW50RXhlY3V0aW9uKSB7XG5cdFx0XHQvLyBJZiB0aGUgY3VycmVudCBleGVjdXRpb24gaXMgbXVsdGktbGluZSwgY2hlY2sgaWYgdGhpcyBjb21tYW5kIGxpbmUgaXMgcGFydCBvZiBpdC5cblx0XHRcdGlmICh0aGlzLl9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllcz8uaXNNdWx0aUxpbmUgJiYgdGhpcy5fY3VycmVudEV4ZWN1dGlvblByb3BlcnRpZXMudW5yZXNvbHZlZENvbW1hbmRMaW5lcykge1xuXHRcdFx0XHRjb25zdCBzdWJFeGVjdXRpb25SZXN1bHQgPSBpc1N1YkV4ZWN1dGlvbih0aGlzLl9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllcy51bnJlc29sdmVkQ29tbWFuZExpbmVzLCBjb21tYW5kTGluZSk7XG5cdFx0XHRcdGlmIChzdWJFeGVjdXRpb25SZXN1bHQpIHtcblx0XHRcdFx0XHR0aGlzLl9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllcy51bnJlc29sdmVkQ29tbWFuZExpbmVzID0gc3ViRXhlY3V0aW9uUmVzdWx0LnVucmVzb2x2ZWRDb21tYW5kTGluZXM7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jdXJyZW50RXhlY3V0aW9uLmVuZEV4ZWN1dGlvbih1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5fY3VycmVudEV4ZWN1dGlvbi5mbHVzaCgpO1xuXHRcdFx0dGhpcy5fb25EaWRSZXF1ZXN0RW5kRXhlY3V0aW9uLmZpcmUoeyB0ZXJtaW5hbDogdGhpcy5fdGVybWluYWwsIHNoZWxsSW50ZWdyYXRpb246IHRoaXMudmFsdWUsIGV4ZWN1dGlvbjogdGhpcy5fY3VycmVudEV4ZWN1dGlvbi52YWx1ZSwgZXhpdENvZGU6IHVuZGVmaW5lZCB9KTtcblx0XHR9XG5cblx0XHQvLyBHZXQgdGhlIG1hdGNoaW5nIHBlbmRpbmcgZXhlY3V0aW9uLCBob3cgc3RyaWN0IHRoaXMgaXMgZGVwZW5kcyBvbiB0aGUgY29uZmlkZW5jZSBvZiB0aGVcblx0XHQvLyBjb21tYW5kIGxpbmVcblx0XHRsZXQgY3VycmVudEV4ZWN1dGlvbjogSW50ZXJuYWxUZXJtaW5hbFNoZWxsRXhlY3V0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChjb21tYW5kTGluZS5jb25maWRlbmNlID09PSBUZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmVDb25maWRlbmNlLkhpZ2gpIHtcblx0XHRcdGZvciAoY29uc3QgW2ksIGV4ZWN1dGlvbl0gb2YgdGhpcy5fcGVuZGluZ0V4ZWN1dGlvbnMuZW50cmllcygpKSB7XG5cdFx0XHRcdGlmIChleGVjdXRpb24udmFsdWUuY29tbWFuZExpbmUudmFsdWUgPT09IGNvbW1hbmRMaW5lLnZhbHVlKSB7XG5cdFx0XHRcdFx0Y3VycmVudEV4ZWN1dGlvbiA9IGV4ZWN1dGlvbjtcblx0XHRcdFx0XHR0aGlzLl9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllcyA9IHtcblx0XHRcdFx0XHRcdGlzTXVsdGlMaW5lOiBmYWxzZSxcblx0XHRcdFx0XHRcdHVucmVzb2x2ZWRDb21tYW5kTGluZXM6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGN1cnJlbnRFeGVjdXRpb24gPSBleGVjdXRpb247XG5cdFx0XHRcdFx0dGhpcy5fcGVuZGluZ0V4ZWN1dGlvbnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHN1YkV4ZWN1dGlvblJlc3VsdCA9IGlzU3ViRXhlY3V0aW9uKHNwbGl0QW5kU2FuaXRpemVDb21tYW5kTGluZShleGVjdXRpb24udmFsdWUuY29tbWFuZExpbmUudmFsdWUpLCBjb21tYW5kTGluZSk7XG5cdFx0XHRcdFx0aWYgKHN1YkV4ZWN1dGlvblJlc3VsdCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fY3VycmVudEV4ZWN1dGlvblByb3BlcnRpZXMgPSB7XG5cdFx0XHRcdFx0XHRcdGlzTXVsdGlMaW5lOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHR1bnJlc29sdmVkQ29tbWFuZExpbmVzOiBzdWJFeGVjdXRpb25SZXN1bHQudW5yZXNvbHZlZENvbW1hbmRMaW5lcyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRjdXJyZW50RXhlY3V0aW9uID0gZXhlY3V0aW9uO1xuXHRcdFx0XHRcdFx0dGhpcy5fcGVuZGluZ0V4ZWN1dGlvbnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN1cnJlbnRFeGVjdXRpb24gPSB0aGlzLl9wZW5kaW5nRXhlY3V0aW9ucy5zaGlmdCgpO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZXJlIGlzIG5vIGV4ZWN1dGlvbiwgY3JlYXRlIGEgbmV3IG9uZVxuXHRcdGlmICghY3VycmVudEV4ZWN1dGlvbikge1xuXHRcdFx0Ly8gRmFsbGJhY2sgdG8gdGhlIHNoZWxsIGludGVncmF0aW9uJ3MgY3dkIGFzIHRoZSBjd2QgbWF5IG5vdCBoYXZlIGJlZW4gcmVzdG9yZWQgYWZ0ZXIgYSByZWxvYWRcblx0XHRcdGN1cnJlbnRFeGVjdXRpb24gPSBuZXcgSW50ZXJuYWxUZXJtaW5hbFNoZWxsRXhlY3V0aW9uKGNvbW1hbmRMaW5lLCBjd2QgPz8gdGhpcy5fY3dkKTtcblx0XHR9XG5cblx0XHR0aGlzLl9jdXJyZW50RXhlY3V0aW9uID0gY3VycmVudEV4ZWN1dGlvbjtcblx0XHR0aGlzLl9vbkRpZFN0YXJ0VGVybWluYWxTaGVsbEV4ZWN1dGlvbi5maXJlKHsgdGVybWluYWw6IHRoaXMuX3Rlcm1pbmFsLCBzaGVsbEludGVncmF0aW9uOiB0aGlzLnZhbHVlLCBleGVjdXRpb246IHRoaXMuX2N1cnJlbnRFeGVjdXRpb24udmFsdWUgfSk7XG5cdH1cblxuXHRlbWl0RGF0YShkYXRhOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmN1cnJlbnRFeGVjdXRpb24/LmVtaXREYXRhKGRhdGEpO1xuXHR9XG5cblx0ZW5kU2hlbGxFeGVjdXRpb24oY29tbWFuZExpbmU6IHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmUgfCB1bmRlZmluZWQsIGV4aXRDb2RlOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHQvLyBJZiB0aGUgY3VycmVudCBleGVjdXRpb24gaXMgbXVsdGktbGluZSwgZG9uJ3QgZW5kIGl0IHVudGlsIHRoZSBuZXh0IGNvbW1hbmQgbGluZSBpc1xuXHRcdC8vIGNvbmZpcm1lZCB0byBub3QgYmUgYSBwYXJ0IG9mIGl0LlxuXHRcdGlmICh0aGlzLl9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllcz8uaXNNdWx0aUxpbmUpIHtcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllcy51bnJlc29sdmVkQ29tbWFuZExpbmVzICYmIHRoaXMuX2N1cnJlbnRFeGVjdXRpb25Qcm9wZXJ0aWVzLnVucmVzb2x2ZWRDb21tYW5kTGluZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRFeGVjdXRpb24pIHtcblx0XHRcdGNvbnN0IGNvbW1hbmRMaW5lRm9yRXZlbnQgPSB0aGlzLl9jdXJyZW50RXhlY3V0aW9uUHJvcGVydGllcz8uaXNNdWx0aUxpbmUgPyB0aGlzLl9jdXJyZW50RXhlY3V0aW9uLnZhbHVlLmNvbW1hbmRMaW5lIDogY29tbWFuZExpbmU7XG5cdFx0XHR0aGlzLl9jdXJyZW50RXhlY3V0aW9uLmVuZEV4ZWN1dGlvbihjb21tYW5kTGluZUZvckV2ZW50KTtcblx0XHRcdGNvbnN0IGN1cnJlbnRFeGVjdXRpb24gPSB0aGlzLl9jdXJyZW50RXhlY3V0aW9uO1xuXHRcdFx0dGhpcy5fcGVuZGluZ0VuZGluZ0V4ZWN1dGlvbiA9IGN1cnJlbnRFeGVjdXRpb247XG5cdFx0XHR0aGlzLl9jdXJyZW50RXhlY3V0aW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0Ly8gSU1QT1JUQU5UOiBFbnN1cmUgdGhlIGN1cnJlbnQgZXhlY3V0aW9uJ3MgZGF0YSBldmVudHMgYXJlIGZsdXNoZWQgaW4gb3JkZXIgdG9cblx0XHRcdC8vIHByZXZlbnQgZGF0YSBldmVudHMgZmlyaW5nIGFmdGVyIHRoZSBlbmQgZXZlbnQgZmlyZXMuXG5cdFx0XHRjdXJyZW50RXhlY3V0aW9uLmZsdXNoKCkudGhlbigoKSA9PiB7XG5cdFx0XHRcdC8vIE9ubHkgZmlyZSBpZiBpdCdzIHN0aWxsIHRoZSBzYW1lIGV4ZWN1dGlvbiwgaWYgaXQncyBjaGFuZ2VkIGl0IHdvdWxkIGhhdmUgYWxyZWFkeVxuXHRcdFx0XHQvLyBiZWVuIGZpcmVkLlxuXHRcdFx0XHRpZiAodGhpcy5fcGVuZGluZ0VuZGluZ0V4ZWN1dGlvbiA9PT0gY3VycmVudEV4ZWN1dGlvbikge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkUmVxdWVzdEVuZEV4ZWN1dGlvbi5maXJlKHsgdGVybWluYWw6IHRoaXMuX3Rlcm1pbmFsLCBzaGVsbEludGVncmF0aW9uOiB0aGlzLnZhbHVlLCBleGVjdXRpb246IGN1cnJlbnRFeGVjdXRpb24udmFsdWUsIGV4aXRDb2RlIH0pO1xuXHRcdFx0XHRcdHRoaXMuX3BlbmRpbmdFbmRpbmdFeGVjdXRpb24gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHNldEVudihrZXlzOiBzdHJpbmdbXSwgdmFsdWVzOiBzdHJpbmdbXSwgaXNUcnVzdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgZW52OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZCB9ID0ge307XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRlbnZba2V5c1tpXV0gPSB2YWx1ZXNbaV07XG5cdFx0fVxuXHRcdHRoaXMuX2VudiA9IHsgdmFsdWU6IGVudiwgaXNUcnVzdGVkIH07XG5cdFx0dGhpcy5fZmlyZUNoYW5nZUV2ZW50KCk7XG5cdH1cblxuXHRzZXRDd2QoY3dkOiBVUkkgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRsZXQgd2FzQ2hhbmdlZCA9IGZhbHNlO1xuXHRcdGlmIChVUkkuaXNVcmkodGhpcy5fY3dkKSkge1xuXHRcdFx0d2FzQ2hhbmdlZCA9ICFVUkkuaXNVcmkoY3dkKSB8fCB0aGlzLl9jd2QudG9TdHJpbmcoKSAhPT0gY3dkLnRvU3RyaW5nKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9jd2QgIT09IGN3ZCkge1xuXHRcdFx0d2FzQ2hhbmdlZCA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICh3YXNDaGFuZ2VkKSB7XG5cdFx0XHR0aGlzLl9jd2QgPSBjd2Q7XG5cdFx0XHR0aGlzLl9maXJlQ2hhbmdlRXZlbnQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9maXJlQ2hhbmdlRXZlbnQoKSB7XG5cdFx0dGhpcy5fb25EaWRSZXF1ZXN0Q2hhbmdlU2hlbGxJbnRlZ3JhdGlvbi5maXJlKHsgdGVybWluYWw6IHRoaXMuX3Rlcm1pbmFsLCBzaGVsbEludGVncmF0aW9uOiB0aGlzLnZhbHVlIH0pO1xuXHR9XG59XG5cbmNsYXNzIEludGVybmFsVGVybWluYWxTaGVsbEV4ZWN1dGlvbiB7XG5cdHJlYWRvbmx5IHZhbHVlOiB2c2NvZGUuVGVybWluYWxTaGVsbEV4ZWN1dGlvbjtcblxuXHRwcml2YXRlIF9kYXRhU3RyZWFtOiBTaGVsbEV4ZWN1dGlvbkRhdGFTdHJlYW0gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2lzRW5kZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9jb21tYW5kTGluZTogdnNjb2RlLlRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZSxcblx0XHRyZWFkb25seSBjd2Q6IFVSSSB8IHVuZGVmaW5lZCxcblx0KSB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0dGhpcy52YWx1ZSA9IHtcblx0XHRcdGdldCBjb21tYW5kTGluZSgpOiB2c2NvZGUuVGVybWluYWxTaGVsbEV4ZWN1dGlvbkNvbW1hbmRMaW5lIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX2NvbW1hbmRMaW5lO1xuXHRcdFx0fSxcblx0XHRcdGdldCBjd2QoKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuY3dkO1xuXHRcdFx0fSxcblx0XHRcdHJlYWQoKTogQXN5bmNJdGVyYWJsZTxzdHJpbmc+IHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX2NyZWF0ZURhdGFTdHJlYW0oKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlRGF0YVN0cmVhbSgpOiBBc3luY0l0ZXJhYmxlPHN0cmluZz4ge1xuXHRcdGlmICghdGhpcy5fZGF0YVN0cmVhbSkge1xuXHRcdFx0aWYgKHRoaXMuX2lzRW5kZWQpIHtcblx0XHRcdFx0cmV0dXJuIEFzeW5jSXRlcmFibGVPYmplY3QuRU1QVFk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kYXRhU3RyZWFtID0gbmV3IFNoZWxsRXhlY3V0aW9uRGF0YVN0cmVhbSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZGF0YVN0cmVhbS5jcmVhdGVJdGVyYWJsZSgpO1xuXHR9XG5cblx0ZW1pdERhdGEoZGF0YTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9pc0VuZGVkKSB7XG5cdFx0XHR0aGlzLl9kYXRhU3RyZWFtPy5lbWl0RGF0YShkYXRhKTtcblx0XHR9XG5cdH1cblxuXHRlbmRFeGVjdXRpb24oY29tbWFuZExpbmU6IHZzY29kZS5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoY29tbWFuZExpbmUpIHtcblx0XHRcdHRoaXMuX2NvbW1hbmRMaW5lID0gY29tbWFuZExpbmU7XG5cdFx0fVxuXHRcdHRoaXMuX2RhdGFTdHJlYW0/LmVuZEV4ZWN1dGlvbigpO1xuXHRcdHRoaXMuX2lzRW5kZWQgPSB0cnVlO1xuXHR9XG5cblx0YXN5bmMgZmx1c2goKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX2RhdGFTdHJlYW0pIHtcblx0XHRcdGF3YWl0IHRoaXMuX2RhdGFTdHJlYW0uZmx1c2goKTtcblx0XHRcdHRoaXMuX2RhdGFTdHJlYW0uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fZGF0YVN0cmVhbSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgU2hlbGxFeGVjdXRpb25EYXRhU3RyZWFtIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX2JhcnJpZXI6IEJhcnJpZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2l0ZXJhYmxlczogQXN5bmNJdGVyYWJsZU9iamVjdDxzdHJpbmc+W10gPSBbXTtcblx0cHJpdmF0ZSBfZW1pdHRlcnM6IEFzeW5jSXRlcmFibGVFbWl0dGVyPHN0cmluZz5bXSA9IFtdO1xuXG5cdGNyZWF0ZUl0ZXJhYmxlKCk6IEFzeW5jSXRlcmFibGU8c3RyaW5nPiB7XG5cdFx0aWYgKCF0aGlzLl9iYXJyaWVyKSB7XG5cdFx0XHR0aGlzLl9iYXJyaWVyID0gbmV3IEJhcnJpZXIoKTtcblx0XHR9XG5cdFx0Y29uc3QgYmFycmllciA9IHRoaXMuX2JhcnJpZXI7XG5cdFx0Y29uc3QgaXRlcmFibGUgPSBuZXcgQXN5bmNJdGVyYWJsZU9iamVjdDxzdHJpbmc+KGFzeW5jIGVtaXR0ZXIgPT4ge1xuXHRcdFx0dGhpcy5fZW1pdHRlcnMucHVzaChlbWl0dGVyKTtcblx0XHRcdGF3YWl0IGJhcnJpZXIud2FpdCgpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX2l0ZXJhYmxlcy5wdXNoKGl0ZXJhYmxlKTtcblx0XHRyZXR1cm4gaXRlcmFibGU7XG5cdH1cblxuXHRlbWl0RGF0YShkYXRhOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGVtaXR0ZXIgb2YgdGhpcy5fZW1pdHRlcnMpIHtcblx0XHRcdGVtaXR0ZXIuZW1pdE9uZShkYXRhKTtcblx0XHR9XG5cdH1cblxuXHRlbmRFeGVjdXRpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5fYmFycmllcj8ub3BlbigpO1xuXHR9XG5cblx0YXN5bmMgZmx1c2goKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwodGhpcy5faXRlcmFibGVzLm1hcChlID0+IGUudG9Qcm9taXNlKCkpKTtcblx0fVxufVxuXG5mdW5jdGlvbiBzcGxpdEFuZFNhbml0aXplQ29tbWFuZExpbmUoY29tbWFuZExpbmU6IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0cmV0dXJuIGNvbW1hbmRMaW5lXG5cdFx0LnNwbGl0KCdcXG4nKVxuXHRcdC5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSlcblx0XHQuZmlsdGVyKGxpbmUgPT4gbGluZS5sZW5ndGggPiAwKTtcbn1cblxuLyoqXG4gKiBXaGVuIGV4ZWN1dGluZyBzb21ldGhpbmcgdGhhdCB0aGUgc2hlbGwgY29uc2lkZXJzIG11bHRpcGxlIGNvbW1hbmRzLCBzdWNoIGFzXG4gKiBhIGNvbW1lbnQgZm9sbG93ZWQgYnkgYSBjb21tYW5kLCB0aGlzIG5lZWRzIHRvIGFsbCBiZSB0cmFja2VkIHVuZGVyIGEgc2luZ2xlXG4gKiBleGVjdXRpb24uXG4gKi9cbmZ1bmN0aW9uIGlzU3ViRXhlY3V0aW9uKHVucmVzb2x2ZWRDb21tYW5kTGluZXM6IHN0cmluZ1tdLCBjb21tYW5kTGluZTogdnNjb2RlLlRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZSk6IHsgdW5yZXNvbHZlZENvbW1hbmRMaW5lczogc3RyaW5nW10gfSB8IGZhbHNlIHtcblx0aWYgKHVucmVzb2x2ZWRDb21tYW5kTGluZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGNvbnN0IG5ld1VucmVzb2x2ZWRDb21tYW5kTGluZXMgPSBbLi4udW5yZXNvbHZlZENvbW1hbmRMaW5lc107XG5cdGNvbnN0IHN1YkV4ZWN1dGlvbkxpbmVzID0gc3BsaXRBbmRTYW5pdGl6ZUNvbW1hbmRMaW5lKGNvbW1hbmRMaW5lLnZhbHVlKTtcblx0aWYgKG5ld1VucmVzb2x2ZWRDb21tYW5kTGluZXMgJiYgbmV3VW5yZXNvbHZlZENvbW1hbmRMaW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0Ly8gSWYgYWxsIHN1Yi1leGVjdXRpb24gbGluZXMgYXJlIGluIHRoZSBjb21tYW5kIGxpbmUsIHRoaXMgaXMgcGFydCBvZiB0aGVcblx0XHQvLyBtdWx0aS1saW5lIGV4ZWN1dGlvbi5cblx0XHR3aGlsZSAobmV3VW5yZXNvbHZlZENvbW1hbmRMaW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRpZiAobmV3VW5yZXNvbHZlZENvbW1hbmRMaW5lc1swXSAhPT0gc3ViRXhlY3V0aW9uTGluZXNbMF0pIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRuZXdVbnJlc29sdmVkQ29tbWFuZExpbmVzLnNoaWZ0KCk7XG5cdFx0XHRzdWJFeGVjdXRpb25MaW5lcy5zaGlmdCgpO1xuXHRcdH1cblxuXHRcdGlmIChzdWJFeGVjdXRpb25MaW5lcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB7IHVucmVzb2x2ZWRDb21tYW5kTGluZXM6IG5ld1VucmVzb2x2ZWRDb21tYW5kTGluZXMgfTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGZhbHNlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLG1EQUFtRDtBQUM1RCxTQUFTLFlBQVksaUJBQWlCLG9CQUFvQjtBQUMxRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUE0RztBQUNySCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGVBQTJCO0FBQ3BDLFNBQVMsV0FBK0I7QUFDeEMsU0FBUyxxQkFBcUIsZUFBMEM7QUFTakUsTUFBTSxtQ0FBbUMsZ0JBQWtELGtDQUFrQztBQUU3SCxJQUFNLGtDQUFOLGNBQThDLFdBQXVEO0FBQUEsRUFlM0csWUFDcUIsWUFDc0IseUJBQ3pDO0FBQ0QsVUFBTTtBQUZvQztBQVgzQyxTQUFRLDJCQUF3RixvQkFBSSxJQUFJO0FBRXhHLFNBQW1CLHVDQUF1QyxJQUFJLFFBQW9EO0FBQ2xILFNBQVMsc0NBQXNDLEtBQUsscUNBQXFDO0FBQ3pGLFNBQW1CLG9DQUFvQyxJQUFJLFFBQWlEO0FBQzVHLFNBQVMsbUNBQW1DLEtBQUssa0NBQWtDO0FBQ25GLFNBQW1CLGtDQUFrQyxJQUFJLFFBQStDO0FBQ3hHLFNBQVMsaUNBQWlDLEtBQUssZ0NBQWdDO0FBUTlFLFNBQUssU0FBUyxXQUFXLFNBQVMsWUFBWSxrQ0FBa0M7QUFHaEYsU0FBSyxVQUFVLGFBQWEsTUFBTTtBQUNqQyxp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
