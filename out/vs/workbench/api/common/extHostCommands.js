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
import { validateConstraint } from "../../../base/common/types.js";
import * as extHostTypes from "./extHostTypes.js";
import * as extHostTypeConverter from "./extHostTypeConverters.js";
import { cloneAndChange } from "../../../base/common/objects.js";
import { MainContext } from "./extHost.protocol.js";
import { isNonEmptyArray } from "../../../base/common/arrays.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { revive } from "../../../base/common/marshalling.js";
import { Range } from "../../../editor/common/core/range.js";
import { Position } from "../../../editor/common/core/position.js";
import { URI } from "../../../base/common/uri.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { TestItemImpl } from "./extHostTestItem.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { TelemetryTrustedValue } from "../../../platform/telemetry/common/telemetryUtils.js";
import { IExtHostTelemetry } from "./extHostTelemetry.js";
import { generateUuid } from "../../../base/common/uuid.js";
let ExtHostCommands = class {
  constructor(extHostRpc, logService, extHostTelemetry) {
    this._commands = /* @__PURE__ */ new Map();
    this._apiCommands = /* @__PURE__ */ new Map();
    this.#proxy = extHostRpc.getProxy(MainContext.MainThreadCommands);
    this._logService = logService;
    this.#extHostTelemetry = extHostTelemetry;
    this.#telemetry = extHostRpc.getProxy(MainContext.MainThreadTelemetry);
    this.converter = new CommandsConverter(
      this,
      (id) => {
        const candidate = this._apiCommands.get(id);
        return candidate?.result === ApiCommandResult.Void ? candidate : void 0;
      },
      logService
    );
    this._argumentProcessors = [
      {
        processArgument(a) {
          return revive(a);
        }
      },
      {
        processArgument(arg) {
          return cloneAndChange(arg, function(obj) {
            if (Range.isIRange(obj)) {
              return extHostTypeConverter.Range.to(obj);
            }
            if (Position.isIPosition(obj)) {
              return extHostTypeConverter.Position.to(obj);
            }
            if (Range.isIRange(obj.range) && URI.isUri(obj.uri)) {
              return extHostTypeConverter.location.to(obj);
            }
            if (obj instanceof VSBuffer) {
              return obj.buffer.buffer;
            }
            if (!Array.isArray(obj)) {
              return obj;
            }
          });
        }
      }
    ];
  }
  #proxy;
  #telemetry;
  #extHostTelemetry;
  registerArgumentProcessor(processor) {
    this._argumentProcessors.push(processor);
  }
  registerApiCommand(apiCommand) {
    const registration = this.registerCommand(false, apiCommand.id, async (...apiArgs) => {
      const internalArgs = apiCommand.args.map((arg, i) => {
        if (!arg.validate(apiArgs[i])) {
          throw new Error(`Invalid argument '${arg.name}' when running '${apiCommand.id}', received: ${typeof apiArgs[i] === "object" ? JSON.stringify(apiArgs[i], null, "	") : apiArgs[i]} `);
        }
        return arg.convert(apiArgs[i]);
      });
      const internalResult = await this.executeCommand(apiCommand.internalId, ...internalArgs);
      return apiCommand.result.convert(internalResult, apiArgs, this.converter);
    }, void 0, {
      description: apiCommand.description,
      args: apiCommand.args,
      returns: apiCommand.result.description
    });
    this._apiCommands.set(apiCommand.id, apiCommand);
    return new extHostTypes.Disposable(() => {
      registration.dispose();
      this._apiCommands.delete(apiCommand.id);
    });
  }
  registerCommand(global, id, callback, thisArg, metadata, extension) {
    this._logService.trace("ExtHostCommands#registerCommand", id);
    if (!id.trim().length) {
      throw new Error("invalid id");
    }
    if (this._commands.has(id)) {
      throw new Error(`command '${id}' already exists`);
    }
    this._commands.set(id, { callback, thisArg, metadata, extension });
    if (global) {
      this.#proxy.$registerCommand(id);
    }
    return new extHostTypes.Disposable(() => {
      if (this._commands.delete(id)) {
        if (global) {
          this.#proxy.$unregisterCommand(id);
        }
      }
    });
  }
  executeCommand(id, ...args) {
    this._logService.trace("ExtHostCommands#executeCommand", id);
    return this._doExecuteCommand(id, args, true);
  }
  async _doExecuteCommand(id, args, retry) {
    if (this._commands.has(id)) {
      this.#proxy.$fireCommandActivationEvent(id);
      return this._executeContributedCommand(id, args, false);
    } else {
      let hasBuffers = false;
      const toArgs = cloneAndChange(args, function(value) {
        if (value instanceof extHostTypes.Position) {
          return extHostTypeConverter.Position.from(value);
        } else if (value instanceof extHostTypes.Range) {
          return extHostTypeConverter.Range.from(value);
        } else if (value instanceof extHostTypes.Location) {
          return extHostTypeConverter.location.from(value);
        } else if (extHostTypes.NotebookRange.isNotebookRange(value)) {
          return extHostTypeConverter.NotebookRange.from(value);
        } else if (value instanceof ArrayBuffer) {
          hasBuffers = true;
          return VSBuffer.wrap(new Uint8Array(value));
        } else if (value instanceof Uint8Array) {
          hasBuffers = true;
          return VSBuffer.wrap(value);
        } else if (value instanceof VSBuffer) {
          hasBuffers = true;
          return value;
        }
        if (!Array.isArray(value)) {
          return value;
        }
      });
      try {
        const result = await this.#proxy.$executeCommand(id, hasBuffers ? new SerializableObjectWithBuffers(toArgs) : toArgs, retry);
        return revive(result);
      } catch (e) {
        if (e instanceof Error && e.message === "$executeCommand:retry") {
          return this._doExecuteCommand(id, args, false);
        } else {
          throw e;
        }
      }
    }
  }
  async _executeContributedCommand(id, args, annotateError) {
    const command = this._commands.get(id);
    if (!command) {
      throw new Error("Unknown command");
    }
    const { callback, thisArg, metadata } = command;
    if (metadata?.args) {
      for (let i = 0; i < metadata.args.length; i++) {
        try {
          validateConstraint(args[i], metadata.args[i].constraint);
        } catch (err) {
          throw new Error(`Running the contributed command: '${id}' failed. Illegal argument '${metadata.args[i].name}' - ${metadata.args[i].description}`);
        }
      }
    }
    const stopWatch = StopWatch.create();
    try {
      return await callback.apply(thisArg, args);
    } catch (err) {
      if (id === this.converter.delegatingCommandId) {
        const actual = this.converter.getActualCommand(...args);
        if (actual) {
          id = actual.command;
        }
      }
      this._logService.error(err, id, command.extension?.identifier);
      if (!annotateError) {
        throw err;
      }
      if (command.extension?.identifier) {
        const reported = this.#extHostTelemetry.onExtensionError(command.extension.identifier, err);
        this._logService.trace("forwarded error to extension?", reported, command.extension?.identifier);
      }
      throw new class CommandError extends Error {
        constructor() {
          super(toErrorMessage(err));
          this.id = id;
          this.source = command.extension?.displayName ?? command.extension?.name;
        }
      }();
    } finally {
      this._reportTelemetry(command, id, stopWatch.elapsed());
    }
  }
  _reportTelemetry(command, id, duration) {
    if (!command.extension) {
      return;
    }
    this.#telemetry.$publicLog2("Extension:ActionExecuted", {
      extensionId: command.extension.identifier.value,
      id: new TelemetryTrustedValue(id),
      duration
    });
  }
  $executeContributedCommand(id, ...args) {
    this._logService.trace("ExtHostCommands#$executeContributedCommand", id);
    const cmdHandler = this._commands.get(id);
    if (!cmdHandler) {
      return Promise.reject(new Error(`Contributed command '${id}' does not exist.`));
    } else {
      args = args.map((arg) => this._argumentProcessors.reduce((r, p) => p.processArgument(r, cmdHandler.extension), arg));
      return this._executeContributedCommand(id, args, true);
    }
  }
  getCommands(filterUnderscoreCommands = false) {
    this._logService.trace("ExtHostCommands#getCommands", filterUnderscoreCommands);
    return this.#proxy.$getCommands().then((result) => {
      if (filterUnderscoreCommands) {
        result = result.filter((command) => command[0] !== "_");
      }
      return result;
    });
  }
  $getContributedCommandMetadata() {
    const result = /* @__PURE__ */ Object.create(null);
    for (const [id, command] of this._commands) {
      const { metadata } = command;
      if (metadata) {
        result[id] = metadata;
      }
    }
    return Promise.resolve(result);
  }
};
ExtHostCommands = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtHostTelemetry)
], ExtHostCommands);
const IExtHostCommands = createDecorator("IExtHostCommands");
class CommandsConverter {
  // --- conversion between internal and api commands
  constructor(_commands, _lookupApiCommand, _logService) {
    this._commands = _commands;
    this._lookupApiCommand = _lookupApiCommand;
    this._logService = _logService;
    this.delegatingCommandId = `__vsc${generateUuid()}`;
    this._cache = /* @__PURE__ */ new Map();
    this._cachIdPool = 0;
    this._commands.registerCommand(true, this.delegatingCommandId, this._executeConvertedCommand, this);
  }
  toInternal(command, disposables) {
    if (!command) {
      return void 0;
    }
    const result = {
      $ident: void 0,
      id: command.command,
      title: command.title,
      tooltip: command.tooltip
    };
    if (!command.command) {
      return result;
    }
    const apiCommand = this._lookupApiCommand(command.command);
    if (apiCommand) {
      result.id = apiCommand.internalId;
      result.arguments = apiCommand.args.map((arg, i) => arg.convert(command.arguments && command.arguments[i]));
    } else if (isNonEmptyArray(command.arguments)) {
      const id = `${command.command} /${++this._cachIdPool}`;
      this._cache.set(id, command);
      disposables.add(toDisposable(() => {
        this._cache.delete(id);
        this._logService.trace("CommandsConverter#DISPOSE", id);
      }));
      result.$ident = id;
      result.id = this.delegatingCommandId;
      result.arguments = [id];
      this._logService.trace("CommandsConverter#CREATE", command.command, id);
    }
    return result;
  }
  fromInternal(command) {
    if (typeof command.$ident === "string") {
      return this._cache.get(command.$ident);
    } else {
      return {
        command: command.id,
        title: command.title,
        arguments: command.arguments
      };
    }
  }
  getActualCommand(...args) {
    return this._cache.get(args[0]);
  }
  _executeConvertedCommand(...args) {
    const actualCmd = this.getActualCommand(...args);
    this._logService.trace("CommandsConverter#EXECUTE", args[0], actualCmd ? actualCmd.command : "MISSING");
    if (!actualCmd) {
      return Promise.reject(`Actual command not found, wanted to execute ${args[0]}`);
    }
    return this._commands.executeCommand(actualCmd.command, ...actualCmd.arguments || []);
  }
}
const _ApiCommandArgument = class _ApiCommandArgument {
  constructor(name, description, validate, convert) {
    this.name = name;
    this.description = description;
    this.validate = validate;
    this.convert = convert;
  }
  static Arr(element) {
    return new _ApiCommandArgument(
      `${element.name}_array`,
      `Array of ${element.name}, ${element.description}`,
      (v) => Array.isArray(v) && v.every((e) => element.validate(e)),
      (v) => v.map((e) => element.convert(e))
    );
  }
  optional() {
    return new _ApiCommandArgument(
      this.name,
      `(optional) ${this.description}`,
      (value) => value === void 0 || value === null || this.validate(value),
      (value) => value === void 0 ? void 0 : value === null ? null : this.convert(value)
    );
  }
  with(name, description) {
    return new _ApiCommandArgument(name ?? this.name, description ?? this.description, this.validate, this.convert);
  }
};
_ApiCommandArgument.Uri = new _ApiCommandArgument("uri", "Uri of a text document", (v) => URI.isUri(v), (v) => v);
_ApiCommandArgument.Position = new _ApiCommandArgument("position", "A position in a text document", (v) => extHostTypes.Position.isPosition(v), extHostTypeConverter.Position.from);
_ApiCommandArgument.Range = new _ApiCommandArgument("range", "A range in a text document", (v) => extHostTypes.Range.isRange(v), extHostTypeConverter.Range.from);
_ApiCommandArgument.Selection = new _ApiCommandArgument("selection", "A selection in a text document", (v) => extHostTypes.Selection.isSelection(v), extHostTypeConverter.Selection.from);
_ApiCommandArgument.Number = new _ApiCommandArgument("number", "", (v) => typeof v === "number", (v) => v);
_ApiCommandArgument.String = new _ApiCommandArgument("string", "", (v) => typeof v === "string", (v) => v);
_ApiCommandArgument.StringArray = _ApiCommandArgument.Arr(_ApiCommandArgument.String);
_ApiCommandArgument.CallHierarchyItem = new _ApiCommandArgument("item", "A call hierarchy item", (v) => v instanceof extHostTypes.CallHierarchyItem, extHostTypeConverter.CallHierarchyItem.from);
_ApiCommandArgument.TypeHierarchyItem = new _ApiCommandArgument("item", "A type hierarchy item", (v) => v instanceof extHostTypes.TypeHierarchyItem, extHostTypeConverter.TypeHierarchyItem.from);
_ApiCommandArgument.TestItem = new _ApiCommandArgument("testItem", "A VS Code TestItem", (v) => v instanceof TestItemImpl, extHostTypeConverter.TestItem.from);
_ApiCommandArgument.TestProfile = new _ApiCommandArgument("testProfile", "A VS Code test profile", (v) => v instanceof extHostTypes.TestRunProfileBase, extHostTypeConverter.TestRunProfile.from);
let ApiCommandArgument = _ApiCommandArgument;
const _ApiCommandResult = class _ApiCommandResult {
  constructor(description, convert) {
    this.description = description;
    this.convert = convert;
  }
};
_ApiCommandResult.Void = new _ApiCommandResult("no result", (v) => v);
let ApiCommandResult = _ApiCommandResult;
class ApiCommand {
  constructor(id, internalId, description, args, result) {
    this.id = id;
    this.internalId = internalId;
    this.description = description;
    this.args = args;
    this.result = result;
  }
}
export {
  ApiCommand,
  ApiCommandArgument,
  ApiCommandResult,
  CommandsConverter,
  ExtHostCommands,
  IExtHostCommands
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Q29tbWFuZHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4vKiBlc2xpbnQtZGlzYWJsZSBsb2NhbC9jb2RlLW5vLW5hdGl2ZS1wcml2YXRlICovXG5cbmltcG9ydCB7IHZhbGlkYXRlQ29uc3RyYWludCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElDb21tYW5kTWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0ICogYXMgZXh0SG9zdFR5cGVzIGZyb20gJy4vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCAqIGFzIGV4dEhvc3RUeXBlQ29udmVydGVyIGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcbmltcG9ydCB7IGNsb25lQW5kQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBNYWluQ29udGV4dCwgTWFpblRocmVhZENvbW1hbmRzU2hhcGUsIEV4dEhvc3RDb21tYW5kc1NoYXBlLCBJQ29tbWFuZER0bywgSUNvbW1hbmRNZXRhZGF0YUR0bywgTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlIH0gZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgKiBhcyBsYW5ndWFnZXMgZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgcmV2aXZlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmcuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRIb3N0UnBjU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdFJwY1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgVGVzdEl0ZW1JbXBsIH0gZnJvbSAnLi9leHRIb3N0VGVzdEl0ZW0uanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9wcm94eUlkZW50aWZpZXIuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgVGVsZW1ldHJ5VHJ1c3RlZFZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFRlbGVtZXRyeSB9IGZyb20gJy4vZXh0SG9zdFRlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcblxuaW50ZXJmYWNlIENvbW1hbmRIYW5kbGVyIHtcblx0Y2FsbGJhY2s6IEZ1bmN0aW9uO1xuXHR0aGlzQXJnOiBhbnk7XG5cdG1ldGFkYXRhPzogSUNvbW1hbmRNZXRhZGF0YTtcblx0ZXh0ZW5zaW9uPzogSUV4dGVuc2lvbkRlc2NyaXB0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFyZ3VtZW50UHJvY2Vzc29yIHtcblx0cHJvY2Vzc0FyZ3VtZW50KGFyZzogYW55LCBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiB8IHVuZGVmaW5lZCk6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dEhvc3RDb21tYW5kcyBpbXBsZW1lbnRzIEV4dEhvc3RDb21tYW5kc1NoYXBlIHtcblxuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0I3Byb3h5OiBNYWluVGhyZWFkQ29tbWFuZHNTaGFwZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kcyA9IG5ldyBNYXA8c3RyaW5nLCBDb21tYW5kSGFuZGxlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfYXBpQ29tbWFuZHMgPSBuZXcgTWFwPHN0cmluZywgQXBpQ29tbWFuZD4oKTtcblx0I3RlbGVtZXRyeTogTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlO1xuXHRyZWFkb25seSAjZXh0SG9zdFRlbGVtZXRyeTogSUV4dEhvc3RUZWxlbWV0cnk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FyZ3VtZW50UHJvY2Vzc29yczogQXJndW1lbnRQcm9jZXNzb3JbXTtcblxuXHRyZWFkb25seSBjb252ZXJ0ZXI6IENvbW1hbmRzQ29udmVydGVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwYzogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUV4dEhvc3RUZWxlbWV0cnkgZXh0SG9zdFRlbGVtZXRyeTogSUV4dEhvc3RUZWxlbWV0cnlcblx0KSB7XG5cdFx0dGhpcy4jcHJveHkgPSBleHRIb3N0UnBjLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRDb21tYW5kcyk7XG5cdFx0dGhpcy5fbG9nU2VydmljZSA9IGxvZ1NlcnZpY2U7XG5cdFx0dGhpcy4jZXh0SG9zdFRlbGVtZXRyeSA9IGV4dEhvc3RUZWxlbWV0cnk7XG5cdFx0dGhpcy4jdGVsZW1ldHJ5ID0gZXh0SG9zdFJwYy5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkVGVsZW1ldHJ5KTtcblx0XHR0aGlzLmNvbnZlcnRlciA9IG5ldyBDb21tYW5kc0NvbnZlcnRlcihcblx0XHRcdHRoaXMsXG5cdFx0XHRpZCA9PiB7XG5cdFx0XHRcdC8vIEFQSSBjb21tYW5kcyB0aGF0IGhhdmUgbm8gcmV0dXJuIHR5cGUgKHZvaWQpIGNhbiBiZVxuXHRcdFx0XHQvLyBjb252ZXJ0ZWQgdG8gdGhlaXIgaW50ZXJuYWwgY29tbWFuZCBhbmQgZG9uJ3QgbmVlZFxuXHRcdFx0XHQvLyBhbnkgaW5kaXJlY3Rpb24gY29tbWFuZHNcblx0XHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gdGhpcy5fYXBpQ29tbWFuZHMuZ2V0KGlkKTtcblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZT8ucmVzdWx0ID09PSBBcGlDb21tYW5kUmVzdWx0LlZvaWRcblx0XHRcdFx0XHQ/IGNhbmRpZGF0ZSA6IHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRsb2dTZXJ2aWNlXG5cdFx0KTtcblx0XHR0aGlzLl9hcmd1bWVudFByb2Nlc3NvcnMgPSBbXG5cdFx0XHR7XG5cdFx0XHRcdHByb2Nlc3NBcmd1bWVudChhKSB7XG5cdFx0XHRcdFx0Ly8gVVJJLCBSZWdleFxuXHRcdFx0XHRcdHJldHVybiByZXZpdmUoYSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdHByb2Nlc3NBcmd1bWVudChhcmcpIHtcblx0XHRcdFx0XHRyZXR1cm4gY2xvbmVBbmRDaGFuZ2UoYXJnLCBmdW5jdGlvbiAob2JqKSB7XG5cdFx0XHRcdFx0XHQvLyBSZXZlcnNlIG9mIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2Jsb2IvMWYyOGM1ZmM2ODFmNGMwMTIyNjQ2MGI2ZDFjN2U5MWI4YWNiNGE1Yi9zcmMvdnMvd29ya2JlbmNoL2FwaS9ub2RlL2V4dEhvc3RDb21tYW5kcy50cyNMMTEyLUwxMjdcblx0XHRcdFx0XHRcdGlmIChSYW5nZS5pc0lSYW5nZShvYmopKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBleHRIb3N0VHlwZUNvbnZlcnRlci5SYW5nZS50byhvYmopO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKFBvc2l0aW9uLmlzSVBvc2l0aW9uKG9iaikpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUeXBlQ29udmVydGVyLlBvc2l0aW9uLnRvKG9iaik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoUmFuZ2UuaXNJUmFuZ2UoKG9iaiBhcyBsYW5ndWFnZXMuTG9jYXRpb24pLnJhbmdlKSAmJiBVUkkuaXNVcmkoKG9iaiBhcyBsYW5ndWFnZXMuTG9jYXRpb24pLnVyaSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUeXBlQ29udmVydGVyLmxvY2F0aW9uLnRvKG9iaik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAob2JqIGluc3RhbmNlb2YgVlNCdWZmZXIpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG9iai5idWZmZXIuYnVmZmVyO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KG9iaikpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG9iajtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF07XG5cdH1cblxuXHRyZWdpc3RlckFyZ3VtZW50UHJvY2Vzc29yKHByb2Nlc3NvcjogQXJndW1lbnRQcm9jZXNzb3IpOiB2b2lkIHtcblx0XHR0aGlzLl9hcmd1bWVudFByb2Nlc3NvcnMucHVzaChwcm9jZXNzb3IpO1xuXHR9XG5cblx0cmVnaXN0ZXJBcGlDb21tYW5kKGFwaUNvbW1hbmQ6IEFwaUNvbW1hbmQpOiBleHRIb3N0VHlwZXMuRGlzcG9zYWJsZSB7XG5cblxuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbiA9IHRoaXMucmVnaXN0ZXJDb21tYW5kKGZhbHNlLCBhcGlDb21tYW5kLmlkLCBhc3luYyAoLi4uYXBpQXJncykgPT4ge1xuXG5cdFx0XHRjb25zdCBpbnRlcm5hbEFyZ3MgPSBhcGlDb21tYW5kLmFyZ3MubWFwKChhcmcsIGkpID0+IHtcblx0XHRcdFx0aWYgKCFhcmcudmFsaWRhdGUoYXBpQXJnc1tpXSkpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYXJndW1lbnQgJyR7YXJnLm5hbWV9JyB3aGVuIHJ1bm5pbmcgJyR7YXBpQ29tbWFuZC5pZH0nLCByZWNlaXZlZDogJHt0eXBlb2YgYXBpQXJnc1tpXSA9PT0gJ29iamVjdCcgPyBKU09OLnN0cmluZ2lmeShhcGlBcmdzW2ldLCBudWxsLCAnXFx0JykgOiBhcGlBcmdzW2ldfSBgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYXJnLmNvbnZlcnQoYXBpQXJnc1tpXSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgaW50ZXJuYWxSZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGVDb21tYW5kKGFwaUNvbW1hbmQuaW50ZXJuYWxJZCwgLi4uaW50ZXJuYWxBcmdzKTtcblx0XHRcdHJldHVybiBhcGlDb21tYW5kLnJlc3VsdC5jb252ZXJ0KGludGVybmFsUmVzdWx0LCBhcGlBcmdzLCB0aGlzLmNvbnZlcnRlcik7XG5cdFx0fSwgdW5kZWZpbmVkLCB7XG5cdFx0XHRkZXNjcmlwdGlvbjogYXBpQ29tbWFuZC5kZXNjcmlwdGlvbixcblx0XHRcdGFyZ3M6IGFwaUNvbW1hbmQuYXJncyxcblx0XHRcdHJldHVybnM6IGFwaUNvbW1hbmQucmVzdWx0LmRlc2NyaXB0aW9uXG5cdFx0fSk7XG5cblx0XHR0aGlzLl9hcGlDb21tYW5kcy5zZXQoYXBpQ29tbWFuZC5pZCwgYXBpQ29tbWFuZCk7XG5cblx0XHRyZXR1cm4gbmV3IGV4dEhvc3RUeXBlcy5EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHJlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9hcGlDb21tYW5kcy5kZWxldGUoYXBpQ29tbWFuZC5pZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRyZWdpc3RlckNvbW1hbmQoZ2xvYmFsOiBib29sZWFuLCBpZDogc3RyaW5nLCBjYWxsYmFjazogPFQ+KC4uLmFyZ3M6IGFueVtdKSA9PiBUIHwgVGhlbmFibGU8VD4sIHRoaXNBcmc/OiBhbnksIG1ldGFkYXRhPzogSUNvbW1hbmRNZXRhZGF0YSwgZXh0ZW5zaW9uPzogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogZXh0SG9zdFR5cGVzLkRpc3Bvc2FibGUge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ0V4dEhvc3RDb21tYW5kcyNyZWdpc3RlckNvbW1hbmQnLCBpZCk7XG5cblx0XHRpZiAoIWlkLnRyaW0oKS5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignaW52YWxpZCBpZCcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jb21tYW5kcy5oYXMoaWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGNvbW1hbmQgJyR7aWR9JyBhbHJlYWR5IGV4aXN0c2ApO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NvbW1hbmRzLnNldChpZCwgeyBjYWxsYmFjaywgdGhpc0FyZywgbWV0YWRhdGEsIGV4dGVuc2lvbiB9KTtcblx0XHRpZiAoZ2xvYmFsKSB7XG5cdFx0XHR0aGlzLiNwcm94eS4kcmVnaXN0ZXJDb21tYW5kKGlkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IGV4dEhvc3RUeXBlcy5EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9jb21tYW5kcy5kZWxldGUoaWQpKSB7XG5cdFx0XHRcdGlmIChnbG9iYWwpIHtcblx0XHRcdFx0XHR0aGlzLiNwcm94eS4kdW5yZWdpc3RlckNvbW1hbmQoaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRleGVjdXRlQ29tbWFuZDxUPihpZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8VD4ge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ0V4dEhvc3RDb21tYW5kcyNleGVjdXRlQ29tbWFuZCcsIGlkKTtcblx0XHRyZXR1cm4gdGhpcy5fZG9FeGVjdXRlQ29tbWFuZChpZCwgYXJncywgdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9kb0V4ZWN1dGVDb21tYW5kPFQ+KGlkOiBzdHJpbmcsIGFyZ3M6IGFueVtdLCByZXRyeTogYm9vbGVhbik6IFByb21pc2U8VD4ge1xuXG5cdFx0aWYgKHRoaXMuX2NvbW1hbmRzLmhhcyhpZCkpIHtcblx0XHRcdC8vIC0gV2Ugc3RheSBpbnNpZGUgdGhlIGV4dGVuc2lvbiBob3N0IGFuZCBzdXBwb3J0XG5cdFx0XHQvLyBcdCB0byBwYXNzIGFueSBraW5kIG9mIHBhcmFtZXRlcnMgYXJvdW5kLlxuXHRcdFx0Ly8gLSBXZSBzdGlsbCBlbWl0IHRoZSBjb3JyZXNwb25kaW5nIGFjdGl2YXRpb24gZXZlbnRcblx0XHRcdC8vICAgQlVUIHdlIGRvbid0IGF3YWl0IHRoYXQgZXZlbnRcblx0XHRcdHRoaXMuI3Byb3h5LiRmaXJlQ29tbWFuZEFjdGl2YXRpb25FdmVudChpZCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZXhlY3V0ZUNvbnRyaWJ1dGVkQ29tbWFuZDxUPihpZCwgYXJncywgZmFsc2UpO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGF1dG9tYWdpY2FsbHkgY29udmVydCBzb21lIGFyZ3VtZW50IHR5cGVzXG5cdFx0XHRsZXQgaGFzQnVmZmVycyA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgdG9BcmdzID0gY2xvbmVBbmRDaGFuZ2UoYXJncywgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5Qb3NpdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiBleHRIb3N0VHlwZUNvbnZlcnRlci5Qb3NpdGlvbi5mcm9tKHZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5SYW5nZSkge1xuXHRcdFx0XHRcdHJldHVybiBleHRIb3N0VHlwZUNvbnZlcnRlci5SYW5nZS5mcm9tKHZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5Mb2NhdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiBleHRIb3N0VHlwZUNvbnZlcnRlci5sb2NhdGlvbi5mcm9tKHZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChleHRIb3N0VHlwZXMuTm90ZWJvb2tSYW5nZS5pc05vdGVib29rUmFuZ2UodmFsdWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUeXBlQ29udmVydGVyLk5vdGVib29rUmFuZ2UuZnJvbSh2YWx1ZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuXHRcdFx0XHRcdGhhc0J1ZmZlcnMgPSB0cnVlO1xuXHRcdFx0XHRcdHJldHVybiBWU0J1ZmZlci53cmFwKG5ldyBVaW50OEFycmF5KHZhbHVlKSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG5cdFx0XHRcdFx0aGFzQnVmZmVycyA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuIFZTQnVmZmVyLndyYXAodmFsdWUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgVlNCdWZmZXIpIHtcblx0XHRcdFx0XHRoYXNCdWZmZXJzID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuI3Byb3h5LiRleGVjdXRlQ29tbWFuZChpZCwgaGFzQnVmZmVycyA/IG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh0b0FyZ3MpIDogdG9BcmdzLCByZXRyeSk7XG5cdFx0XHRcdHJldHVybiByZXZpdmU8YW55PihyZXN1bHQpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBSZXJ1biB0aGUgY29tbWFuZCB3aGVuIGl0IHdhc24ndCBrbm93biwgaGFkIGFyZ3VtZW50cywgYW5kIHdoZW4gcmV0cnlcblx0XHRcdFx0Ly8gaXMgZW5hYmxlZC4gV2UgZG8gdGhpcyBiZWNhdXNlIHRoZSBjb21tYW5kIG1pZ2h0IGJlIHJlZ2lzdGVyZWQgaW5zaWRlXG5cdFx0XHRcdC8vIHRoZSBleHRlbnNpb24gaG9zdCBub3cgYW5kIGNhbiB0aGVyZWZvcmUgYWNjZXB0IHRoZSBhcmd1bWVudHMgYXMtaXMuXG5cdFx0XHRcdGlmIChlIGluc3RhbmNlb2YgRXJyb3IgJiYgZS5tZXNzYWdlID09PSAnJGV4ZWN1dGVDb21tYW5kOnJldHJ5Jykge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9kb0V4ZWN1dGVDb21tYW5kKGlkLCBhcmdzLCBmYWxzZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhyb3cgZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2V4ZWN1dGVDb250cmlidXRlZENvbW1hbmQ8VCA9IHVua25vd24+KGlkOiBzdHJpbmcsIGFyZ3M6IGFueVtdLCBhbm5vdGF0ZUVycm9yOiBib29sZWFuKTogUHJvbWlzZTxUPiB7XG5cdFx0Y29uc3QgY29tbWFuZCA9IHRoaXMuX2NvbW1hbmRzLmdldChpZCk7XG5cdFx0aWYgKCFjb21tYW5kKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gY29tbWFuZCcpO1xuXHRcdH1cblx0XHRjb25zdCB7IGNhbGxiYWNrLCB0aGlzQXJnLCBtZXRhZGF0YSB9ID0gY29tbWFuZDtcblx0XHRpZiAobWV0YWRhdGE/LmFyZ3MpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbWV0YWRhdGEuYXJncy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHZhbGlkYXRlQ29uc3RyYWludChhcmdzW2ldLCBtZXRhZGF0YS5hcmdzW2ldLmNvbnN0cmFpbnQpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFJ1bm5pbmcgdGhlIGNvbnRyaWJ1dGVkIGNvbW1hbmQ6ICcke2lkfScgZmFpbGVkLiBJbGxlZ2FsIGFyZ3VtZW50ICcke21ldGFkYXRhLmFyZ3NbaV0ubmFtZX0nIC0gJHttZXRhZGF0YS5hcmdzW2ldLmRlc2NyaXB0aW9ufWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RvcFdhdGNoID0gU3RvcFdhdGNoLmNyZWF0ZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgY2FsbGJhY2suYXBwbHkodGhpc0FyZywgYXJncyk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHQvLyBUaGUgaW5kaXJlY3Rpb24tY29tbWFuZCBmcm9tIHRoZSBjb252ZXJ0ZXIgY2FuIGZhaWwgd2hlbiBpbnZva2luZyB0aGUgYWN0dWFsXG5cdFx0XHQvLyBjb21tYW5kIGFuZCBpbiB0aGF0IGNhc2UgaXQgaXMgYmV0dGVyIHRvIGJsYW1lIHRoZSBjb3JyZWN0IGNvbW1hbmRcblx0XHRcdGlmIChpZCA9PT0gdGhpcy5jb252ZXJ0ZXIuZGVsZWdhdGluZ0NvbW1hbmRJZCkge1xuXHRcdFx0XHRjb25zdCBhY3R1YWwgPSB0aGlzLmNvbnZlcnRlci5nZXRBY3R1YWxDb21tYW5kKC4uLmFyZ3MpO1xuXHRcdFx0XHRpZiAoYWN0dWFsKSB7XG5cdFx0XHRcdFx0aWQgPSBhY3R1YWwuY29tbWFuZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIsIGlkLCBjb21tYW5kLmV4dGVuc2lvbj8uaWRlbnRpZmllcik7XG5cblx0XHRcdGlmICghYW5ub3RhdGVFcnJvcikge1xuXHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjb21tYW5kLmV4dGVuc2lvbj8uaWRlbnRpZmllcikge1xuXHRcdFx0XHRjb25zdCByZXBvcnRlZCA9IHRoaXMuI2V4dEhvc3RUZWxlbWV0cnkub25FeHRlbnNpb25FcnJvcihjb21tYW5kLmV4dGVuc2lvbi5pZGVudGlmaWVyLCBlcnIpO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdmb3J3YXJkZWQgZXJyb3IgdG8gZXh0ZW5zaW9uPycsIHJlcG9ydGVkLCBjb21tYW5kLmV4dGVuc2lvbj8uaWRlbnRpZmllcik7XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IG5ldyBjbGFzcyBDb21tYW5kRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdFx0XHRcdHJlYWRvbmx5IGlkID0gaWQ7XG5cdFx0XHRcdHJlYWRvbmx5IHNvdXJjZSA9IGNvbW1hbmQhLmV4dGVuc2lvbj8uZGlzcGxheU5hbWUgPz8gY29tbWFuZCEuZXh0ZW5zaW9uPy5uYW1lO1xuXHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRzdXBlcih0b0Vycm9yTWVzc2FnZShlcnIpKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZmluYWxseSB7XG5cdFx0XHR0aGlzLl9yZXBvcnRUZWxlbWV0cnkoY29tbWFuZCwgaWQsIHN0b3BXYXRjaC5lbGFwc2VkKCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlcG9ydFRlbGVtZXRyeShjb21tYW5kOiBDb21tYW5kSGFuZGxlciwgaWQ6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuXHRcdGlmICghY29tbWFuZC5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dHlwZSBFeHRlbnNpb25BY3Rpb25UZWxlbWV0cnkgPSB7XG5cdFx0XHRleHRlbnNpb25JZDogc3RyaW5nO1xuXHRcdFx0aWQ6IFRlbGVtZXRyeVRydXN0ZWRWYWx1ZTxzdHJpbmc+O1xuXHRcdFx0ZHVyYXRpb246IG51bWJlcjtcblx0XHR9O1xuXHRcdHR5cGUgRXh0ZW5zaW9uQWN0aW9uVGVsZW1ldHJ5TWV0YSA9IHtcblx0XHRcdGV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGlkIG9mIHRoZSBleHRlbnNpb24gaGFuZGxpbmcgdGhlIGNvbW1hbmQsIGluZm9ybWluZyB3aGljaCBleHRlbnNpb25zIHByb3ZpZGUgbW9zdC11c2VkIGZ1bmN0aW9uYWxpdHkuJyB9O1xuXHRcdFx0aWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgaWQgb2YgdGhlIGNvbW1hbmQsIHRvIHVuZGVyc3RhbmQgd2hpY2ggc3BlY2lmaWMgZXh0ZW5zaW9uIGZlYXR1cmVzIGFyZSBtb3N0IHBvcHVsYXIuJyB9O1xuXHRcdFx0ZHVyYXRpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZHVyYXRpb24gb2YgdGhlIGNvbW1hbmQgZXhlY3V0aW9uLCB0byBkZXRlY3QgcGVyZm9ybWFuY2UgaXNzdWVzJyB9O1xuXHRcdFx0b3duZXI6ICdkaWdpdGFyYWxkJztcblx0XHRcdGNvbW1lbnQ6ICdVc2VkIHRvIGdhaW4gaW5zaWdodCBvbiB0aGUgbW9zdCBwb3B1bGFyIGNvbW1hbmRzIHVzZWQgZnJvbSBleHRlbnNpb25zJztcblx0XHR9O1xuXHRcdHRoaXMuI3RlbGVtZXRyeS4kcHVibGljTG9nMjxFeHRlbnNpb25BY3Rpb25UZWxlbWV0cnksIEV4dGVuc2lvbkFjdGlvblRlbGVtZXRyeU1ldGE+KCdFeHRlbnNpb246QWN0aW9uRXhlY3V0ZWQnLCB7XG5cdFx0XHRleHRlbnNpb25JZDogY29tbWFuZC5leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSxcblx0XHRcdGlkOiBuZXcgVGVsZW1ldHJ5VHJ1c3RlZFZhbHVlKGlkKSxcblx0XHRcdGR1cmF0aW9uOiBkdXJhdGlvbixcblx0XHR9KTtcblx0fVxuXG5cdCRleGVjdXRlQ29udHJpYnV0ZWRDb21tYW5kKGlkOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx1bmtub3duPiB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnRXh0SG9zdENvbW1hbmRzIyRleGVjdXRlQ29udHJpYnV0ZWRDb21tYW5kJywgaWQpO1xuXG5cdFx0Y29uc3QgY21kSGFuZGxlciA9IHRoaXMuX2NvbW1hbmRzLmdldChpZCk7XG5cdFx0aWYgKCFjbWRIYW5kbGVyKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGBDb250cmlidXRlZCBjb21tYW5kICcke2lkfScgZG9lcyBub3QgZXhpc3QuYCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhcmdzID0gYXJncy5tYXAoYXJnID0+IHRoaXMuX2FyZ3VtZW50UHJvY2Vzc29ycy5yZWR1Y2UoKHIsIHApID0+IHAucHJvY2Vzc0FyZ3VtZW50KHIsIGNtZEhhbmRsZXIuZXh0ZW5zaW9uKSwgYXJnKSk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZXhlY3V0ZUNvbnRyaWJ1dGVkQ29tbWFuZChpZCwgYXJncywgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0Q29tbWFuZHMoZmlsdGVyVW5kZXJzY29yZUNvbW1hbmRzOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnRXh0SG9zdENvbW1hbmRzI2dldENvbW1hbmRzJywgZmlsdGVyVW5kZXJzY29yZUNvbW1hbmRzKTtcblxuXHRcdHJldHVybiB0aGlzLiNwcm94eS4kZ2V0Q29tbWFuZHMoKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRpZiAoZmlsdGVyVW5kZXJzY29yZUNvbW1hbmRzKSB7XG5cdFx0XHRcdHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoY29tbWFuZCA9PiBjb21tYW5kWzBdICE9PSAnXycpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KTtcblx0fVxuXG5cdCRnZXRDb250cmlidXRlZENvbW1hbmRNZXRhZGF0YSgpOiBQcm9taXNlPHsgW2lkOiBzdHJpbmddOiBzdHJpbmcgfCBJQ29tbWFuZE1ldGFkYXRhRHRvIH0+IHtcblx0XHRjb25zdCByZXN1bHQ6IHsgW2lkOiBzdHJpbmddOiBzdHJpbmcgfCBJQ29tbWFuZE1ldGFkYXRhIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGZvciAoY29uc3QgW2lkLCBjb21tYW5kXSBvZiB0aGlzLl9jb21tYW5kcykge1xuXHRcdFx0Y29uc3QgeyBtZXRhZGF0YSB9ID0gY29tbWFuZDtcblx0XHRcdGlmIChtZXRhZGF0YSkge1xuXHRcdFx0XHRyZXN1bHRbaWRdID0gbWV0YWRhdGE7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzdWx0KTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRIb3N0Q29tbWFuZHMgZXh0ZW5kcyBFeHRIb3N0Q29tbWFuZHMgeyB9XG5leHBvcnQgY29uc3QgSUV4dEhvc3RDb21tYW5kcyA9IGNyZWF0ZURlY29yYXRvcjxJRXh0SG9zdENvbW1hbmRzPignSUV4dEhvc3RDb21tYW5kcycpO1xuXG5leHBvcnQgY2xhc3MgQ29tbWFuZHNDb252ZXJ0ZXIgaW1wbGVtZW50cyBleHRIb3N0VHlwZUNvbnZlcnRlci5Db21tYW5kLklDb21tYW5kc0NvbnZlcnRlciB7XG5cblx0cmVhZG9ubHkgZGVsZWdhdGluZ0NvbW1hbmRJZDogc3RyaW5nID0gYF9fdnNjJHtnZW5lcmF0ZVV1aWQoKX1gO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCB2c2NvZGUuQ29tbWFuZD4oKTtcblx0cHJpdmF0ZSBfY2FjaElkUG9vbCA9IDA7XG5cblx0Ly8gLS0tIGNvbnZlcnNpb24gYmV0d2VlbiBpbnRlcm5hbCBhbmQgYXBpIGNvbW1hbmRzXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9va3VwQXBpQ29tbWFuZDogKGlkOiBzdHJpbmcpID0+IEFwaUNvbW1hbmQgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fY29tbWFuZHMucmVnaXN0ZXJDb21tYW5kKHRydWUsIHRoaXMuZGVsZWdhdGluZ0NvbW1hbmRJZCwgdGhpcy5fZXhlY3V0ZUNvbnZlcnRlZENvbW1hbmQsIHRoaXMpO1xuXHR9XG5cblx0dG9JbnRlcm5hbChjb21tYW5kOiB2c2NvZGUuQ29tbWFuZCwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IElDb21tYW5kRHRvO1xuXHR0b0ludGVybmFsKGNvbW1hbmQ6IHZzY29kZS5Db21tYW5kIHwgdW5kZWZpbmVkLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogSUNvbW1hbmREdG8gfCB1bmRlZmluZWQ7XG5cdHRvSW50ZXJuYWwoY29tbWFuZDogdnNjb2RlLkNvbW1hbmQgfCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBJQ29tbWFuZER0byB8IHVuZGVmaW5lZCB7XG5cblx0XHRpZiAoIWNvbW1hbmQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0OiBJQ29tbWFuZER0byA9IHtcblx0XHRcdCRpZGVudDogdW5kZWZpbmVkLFxuXHRcdFx0aWQ6IGNvbW1hbmQuY29tbWFuZCxcblx0XHRcdHRpdGxlOiBjb21tYW5kLnRpdGxlLFxuXHRcdFx0dG9vbHRpcDogY29tbWFuZC50b29sdGlwXG5cdFx0fTtcblxuXHRcdGlmICghY29tbWFuZC5jb21tYW5kKSB7XG5cdFx0XHQvLyBmYWxzeSBjb21tYW5kIGlkIC0+IHJldHVybiBjb252ZXJ0ZWQgY29tbWFuZCBidXQgZG9uJ3QgYXR0ZW1wdCBhbnlcblx0XHRcdC8vIGFyZ3VtZW50IG9yIEFQSS1jb21tYW5kIGRhbmNlIHNpbmNlIHRoaXMgY29tbWFuZCB3b24ndCBydW4gYW55d2F5c1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRjb25zdCBhcGlDb21tYW5kID0gdGhpcy5fbG9va3VwQXBpQ29tbWFuZChjb21tYW5kLmNvbW1hbmQpO1xuXHRcdGlmIChhcGlDb21tYW5kKSB7XG5cdFx0XHQvLyBBUEkgY29tbWFuZCB3aXRoIHJldHVybi12YWx1ZSBjYW4gYmUgY29udmVydGVkIGlucGxhY2Vcblx0XHRcdHJlc3VsdC5pZCA9IGFwaUNvbW1hbmQuaW50ZXJuYWxJZDtcblx0XHRcdHJlc3VsdC5hcmd1bWVudHMgPSBhcGlDb21tYW5kLmFyZ3MubWFwKChhcmcsIGkpID0+IGFyZy5jb252ZXJ0KGNvbW1hbmQuYXJndW1lbnRzICYmIGNvbW1hbmQuYXJndW1lbnRzW2ldKSk7XG5cblxuXHRcdH0gZWxzZSBpZiAoaXNOb25FbXB0eUFycmF5KGNvbW1hbmQuYXJndW1lbnRzKSkge1xuXHRcdFx0Ly8gd2UgaGF2ZSBhIGNvbnRyaWJ1dGVkIGNvbW1hbmQgd2l0aCBhcmd1bWVudHMuIHRoYXRcblx0XHRcdC8vIG1lYW5zIHdlIGRvbid0IHdhbnQgdG8gc2VuZCB0aGUgYXJndW1lbnRzIGFyb3VuZFxuXG5cdFx0XHRjb25zdCBpZCA9IGAke2NvbW1hbmQuY29tbWFuZH0gLyR7Kyt0aGlzLl9jYWNoSWRQb29sfWA7XG5cdFx0XHR0aGlzLl9jYWNoZS5zZXQoaWQsIGNvbW1hbmQpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2NhY2hlLmRlbGV0ZShpZCk7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ0NvbW1hbmRzQ29udmVydGVyI0RJU1BPU0UnLCBpZCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRyZXN1bHQuJGlkZW50ID0gaWQ7XG5cblx0XHRcdHJlc3VsdC5pZCA9IHRoaXMuZGVsZWdhdGluZ0NvbW1hbmRJZDtcblx0XHRcdHJlc3VsdC5hcmd1bWVudHMgPSBbaWRdO1xuXG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdDb21tYW5kc0NvbnZlcnRlciNDUkVBVEUnLCBjb21tYW5kLmNvbW1hbmQsIGlkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZnJvbUludGVybmFsKGNvbW1hbmQ6IElDb21tYW5kRHRvKTogdnNjb2RlLkNvbW1hbmQgfCB1bmRlZmluZWQge1xuXG5cdFx0aWYgKHR5cGVvZiBjb21tYW5kLiRpZGVudCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jYWNoZS5nZXQoY29tbWFuZC4kaWRlbnQpO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNvbW1hbmQ6IGNvbW1hbmQuaWQsXG5cdFx0XHRcdHRpdGxlOiBjb21tYW5kLnRpdGxlLFxuXHRcdFx0XHRhcmd1bWVudHM6IGNvbW1hbmQuYXJndW1lbnRzXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cblx0Z2V0QWN0dWFsQ29tbWFuZCguLi5hcmdzOiBhbnlbXSk6IHZzY29kZS5Db21tYW5kIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FjaGUuZ2V0KGFyZ3NbMF0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZXhlY3V0ZUNvbnZlcnRlZENvbW1hbmQ8Uj4oLi4uYXJnczogYW55W10pOiBQcm9taXNlPFI+IHtcblx0XHRjb25zdCBhY3R1YWxDbWQgPSB0aGlzLmdldEFjdHVhbENvbW1hbmQoLi4uYXJncyk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnQ29tbWFuZHNDb252ZXJ0ZXIjRVhFQ1VURScsIGFyZ3NbMF0sIGFjdHVhbENtZCA/IGFjdHVhbENtZC5jb21tYW5kIDogJ01JU1NJTkcnKTtcblxuXHRcdGlmICghYWN0dWFsQ21kKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoYEFjdHVhbCBjb21tYW5kIG5vdCBmb3VuZCwgd2FudGVkIHRvIGV4ZWN1dGUgJHthcmdzWzBdfWApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoYWN0dWFsQ21kLmNvbW1hbmQsIC4uLihhY3R1YWxDbWQuYXJndW1lbnRzIHx8IFtdKSk7XG5cdH1cblxufVxuXG5cbmV4cG9ydCBjbGFzcyBBcGlDb21tYW5kQXJndW1lbnQ8ViwgTyA9IFY+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVXJpID0gbmV3IEFwaUNvbW1hbmRBcmd1bWVudDxVUkk+KCd1cmknLCAnVXJpIG9mIGEgdGV4dCBkb2N1bWVudCcsIHYgPT4gVVJJLmlzVXJpKHYpLCB2ID0+IHYpO1xuXHRzdGF0aWMgcmVhZG9ubHkgUG9zaXRpb24gPSBuZXcgQXBpQ29tbWFuZEFyZ3VtZW50PGV4dEhvc3RUeXBlcy5Qb3NpdGlvbiwgSVBvc2l0aW9uPigncG9zaXRpb24nLCAnQSBwb3NpdGlvbiBpbiBhIHRleHQgZG9jdW1lbnQnLCB2ID0+IGV4dEhvc3RUeXBlcy5Qb3NpdGlvbi5pc1Bvc2l0aW9uKHYpLCBleHRIb3N0VHlwZUNvbnZlcnRlci5Qb3NpdGlvbi5mcm9tKTtcblx0c3RhdGljIHJlYWRvbmx5IFJhbmdlID0gbmV3IEFwaUNvbW1hbmRBcmd1bWVudDxleHRIb3N0VHlwZXMuUmFuZ2UsIElSYW5nZT4oJ3JhbmdlJywgJ0EgcmFuZ2UgaW4gYSB0ZXh0IGRvY3VtZW50JywgdiA9PiBleHRIb3N0VHlwZXMuUmFuZ2UuaXNSYW5nZSh2KSwgZXh0SG9zdFR5cGVDb252ZXJ0ZXIuUmFuZ2UuZnJvbSk7XG5cdHN0YXRpYyByZWFkb25seSBTZWxlY3Rpb24gPSBuZXcgQXBpQ29tbWFuZEFyZ3VtZW50PGV4dEhvc3RUeXBlcy5TZWxlY3Rpb24sIElTZWxlY3Rpb24+KCdzZWxlY3Rpb24nLCAnQSBzZWxlY3Rpb24gaW4gYSB0ZXh0IGRvY3VtZW50JywgdiA9PiBleHRIb3N0VHlwZXMuU2VsZWN0aW9uLmlzU2VsZWN0aW9uKHYpLCBleHRIb3N0VHlwZUNvbnZlcnRlci5TZWxlY3Rpb24uZnJvbSk7XG5cdHN0YXRpYyByZWFkb25seSBOdW1iZXIgPSBuZXcgQXBpQ29tbWFuZEFyZ3VtZW50PG51bWJlcj4oJ251bWJlcicsICcnLCB2ID0+IHR5cGVvZiB2ID09PSAnbnVtYmVyJywgdiA9PiB2KTtcblx0c3RhdGljIHJlYWRvbmx5IFN0cmluZyA9IG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8c3RyaW5nPignc3RyaW5nJywgJycsIHYgPT4gdHlwZW9mIHYgPT09ICdzdHJpbmcnLCB2ID0+IHYpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU3RyaW5nQXJyYXkgPSBBcGlDb21tYW5kQXJndW1lbnQuQXJyKEFwaUNvbW1hbmRBcmd1bWVudC5TdHJpbmcpO1xuXG5cdHN0YXRpYyBBcnI8VCwgSyA9IFQ+KGVsZW1lbnQ6IEFwaUNvbW1hbmRBcmd1bWVudDxULCBLPikge1xuXHRcdHJldHVybiBuZXcgQXBpQ29tbWFuZEFyZ3VtZW50KFxuXHRcdFx0YCR7ZWxlbWVudC5uYW1lfV9hcnJheWAsXG5cdFx0XHRgQXJyYXkgb2YgJHtlbGVtZW50Lm5hbWV9LCAke2VsZW1lbnQuZGVzY3JpcHRpb259YCxcblx0XHRcdCh2OiB1bmtub3duKSA9PiBBcnJheS5pc0FycmF5KHYpICYmIHYuZXZlcnkoZSA9PiBlbGVtZW50LnZhbGlkYXRlKGUpKSxcblx0XHRcdCh2OiBUW10pID0+IHYubWFwKGUgPT4gZWxlbWVudC5jb252ZXJ0KGUpKVxuXHRcdCk7XG5cdH1cblxuXHRzdGF0aWMgcmVhZG9ubHkgQ2FsbEhpZXJhcmNoeUl0ZW0gPSBuZXcgQXBpQ29tbWFuZEFyZ3VtZW50KCdpdGVtJywgJ0EgY2FsbCBoaWVyYXJjaHkgaXRlbScsIHYgPT4gdiBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5DYWxsSGllcmFyY2h5SXRlbSwgZXh0SG9zdFR5cGVDb252ZXJ0ZXIuQ2FsbEhpZXJhcmNoeUl0ZW0uZnJvbSk7XG5cdHN0YXRpYyByZWFkb25seSBUeXBlSGllcmFyY2h5SXRlbSA9IG5ldyBBcGlDb21tYW5kQXJndW1lbnQoJ2l0ZW0nLCAnQSB0eXBlIGhpZXJhcmNoeSBpdGVtJywgdiA9PiB2IGluc3RhbmNlb2YgZXh0SG9zdFR5cGVzLlR5cGVIaWVyYXJjaHlJdGVtLCBleHRIb3N0VHlwZUNvbnZlcnRlci5UeXBlSGllcmFyY2h5SXRlbS5mcm9tKTtcblx0c3RhdGljIHJlYWRvbmx5IFRlc3RJdGVtID0gbmV3IEFwaUNvbW1hbmRBcmd1bWVudCgndGVzdEl0ZW0nLCAnQSBWUyBDb2RlIFRlc3RJdGVtJywgdiA9PiB2IGluc3RhbmNlb2YgVGVzdEl0ZW1JbXBsLCBleHRIb3N0VHlwZUNvbnZlcnRlci5UZXN0SXRlbS5mcm9tKTtcblx0c3RhdGljIHJlYWRvbmx5IFRlc3RQcm9maWxlID0gbmV3IEFwaUNvbW1hbmRBcmd1bWVudCgndGVzdFByb2ZpbGUnLCAnQSBWUyBDb2RlIHRlc3QgcHJvZmlsZScsIHYgPT4gdiBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5UZXN0UnVuUHJvZmlsZUJhc2UsIGV4dEhvc3RUeXBlQ29udmVydGVyLlRlc3RSdW5Qcm9maWxlLmZyb20pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcblx0XHRyZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IHZhbGlkYXRlOiAodjogVikgPT4gYm9vbGVhbixcblx0XHRyZWFkb25seSBjb252ZXJ0OiAodjogVikgPT4gT1xuXHQpIHsgfVxuXG5cdG9wdGlvbmFsKCk6IEFwaUNvbW1hbmRBcmd1bWVudDxWIHwgdW5kZWZpbmVkIHwgbnVsbCwgTyB8IHVuZGVmaW5lZCB8IG51bGw+IHtcblx0XHRyZXR1cm4gbmV3IEFwaUNvbW1hbmRBcmd1bWVudChcblx0XHRcdHRoaXMubmFtZSwgYChvcHRpb25hbCkgJHt0aGlzLmRlc2NyaXB0aW9ufWAsXG5cdFx0XHR2YWx1ZSA9PiB2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsIHx8IHRoaXMudmFsaWRhdGUodmFsdWUpLFxuXHRcdFx0dmFsdWUgPT4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHZhbHVlID09PSBudWxsID8gbnVsbCA6IHRoaXMuY29udmVydCh2YWx1ZSlcblx0XHQpO1xuXHR9XG5cblx0d2l0aChuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBBcGlDb21tYW5kQXJndW1lbnQ8ViwgTz4ge1xuXHRcdHJldHVybiBuZXcgQXBpQ29tbWFuZEFyZ3VtZW50KG5hbWUgPz8gdGhpcy5uYW1lLCBkZXNjcmlwdGlvbiA/PyB0aGlzLmRlc2NyaXB0aW9uLCB0aGlzLnZhbGlkYXRlLCB0aGlzLmNvbnZlcnQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBcGlDb21tYW5kUmVzdWx0PFYsIE8gPSBWPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFZvaWQgPSBuZXcgQXBpQ29tbWFuZFJlc3VsdDx2b2lkLCB2b2lkPignbm8gcmVzdWx0JywgdiA9PiB2KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGNvbnZlcnQ6ICh2OiBWLCBhcGlBcmdzOiBhbnlbXSwgY21kQ29udmVydGVyOiBDb21tYW5kc0NvbnZlcnRlcikgPT4gT1xuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgQXBpQ29tbWFuZCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgaWQ6IHN0cmluZyxcblx0XHRyZWFkb25seSBpbnRlcm5hbElkOiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgZGVzY3JpcHRpb246IHN0cmluZyxcblx0XHRyZWFkb25seSBhcmdzOiBBcGlDb21tYW5kQXJndW1lbnQ8YW55LCBhbnk+W10sXG5cdFx0cmVhZG9ubHkgcmVzdWx0OiBBcGlDb21tYW5kUmVzdWx0PGFueSwgYW55PlxuXHQpIHsgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFPQSxTQUFTLDBCQUEwQjtBQUVuQyxZQUFZLGtCQUFrQjtBQUM5QixZQUFZLDBCQUEwQjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG1CQUE4SDtBQUN2SSxTQUFTLHVCQUF1QjtBQUdoQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGNBQWM7QUFDdkIsU0FBaUIsYUFBYTtBQUM5QixTQUFvQixnQkFBZ0I7QUFDcEMsU0FBUyxXQUFXO0FBQ3BCLFNBQTBCLG9CQUFvQjtBQUM5QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG9CQUFvQjtBQWF0QixJQUFNLGtCQUFOLE1BQXNEO0FBQUEsRUFnQjVELFlBQ3FCLFlBQ1AsWUFDTSxrQkFDbEI7QUFkRixTQUFpQixZQUFZLG9CQUFJLElBQTRCO0FBQzdELFNBQWlCLGVBQWUsb0JBQUksSUFBd0I7QUFjM0QsU0FBSyxTQUFTLFdBQVcsU0FBUyxZQUFZLGtCQUFrQjtBQUNoRSxTQUFLLGNBQWM7QUFDbkIsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxhQUFhLFdBQVcsU0FBUyxZQUFZLG1CQUFtQjtBQUNyRSxTQUFLLFlBQVksSUFBSTtBQUFBLE1BQ3BCO0FBQUEsTUFDQSxRQUFNO0FBSUwsY0FBTSxZQUFZLEtBQUssYUFBYSxJQUFJLEVBQUU7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
