import * as nls from "../../../nls.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Emitter } from "../../../base/common/event.js";
import { hash } from "../../../base/common/hash.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { isWindows } from "../../../base/common/platform.js";
import { joinPath } from "../../../base/common/resources.js";
import { isNumber, isString } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { RawContextKey } from "../../contextkey/common/contextkey.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const ILogService = createDecorator("logService");
const ILoggerService = createDecorator("loggerService");
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function isLogLevel(thing) {
  return isNumber(thing);
}
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["Off"] = 0] = "Off";
  LogLevel2[LogLevel2["Trace"] = 1] = "Trace";
  LogLevel2[LogLevel2["Debug"] = 2] = "Debug";
  LogLevel2[LogLevel2["Info"] = 3] = "Info";
  LogLevel2[LogLevel2["Warning"] = 4] = "Warning";
  LogLevel2[LogLevel2["Error"] = 5] = "Error";
  return LogLevel2;
})(LogLevel || {});
const DEFAULT_LOG_LEVEL = 3 /* Info */;
function canLog(loggerLevel, messageLevel) {
  return loggerLevel !== 0 /* Off */ && loggerLevel <= messageLevel;
}
function log(logger, level, message) {
  switch (level) {
    case 1 /* Trace */:
      logger.trace(message);
      break;
    case 2 /* Debug */:
      logger.debug(message);
      break;
    case 3 /* Info */:
      logger.info(message);
      break;
    case 4 /* Warning */:
      logger.warn(message);
      break;
    case 5 /* Error */:
      logger.error(message);
      break;
    case 0 /* Off */:
      break;
    default:
      throw new Error(`Invalid log level ${level}`);
  }
}
function format(args, verbose = false) {
  let result = "";
  for (let i = 0; i < args.length; i++) {
    let a = args[i];
    if (a instanceof Error) {
      a = toErrorMessage(a, verbose);
    }
    if (typeof a === "object") {
      try {
        a = JSON.stringify(a);
      } catch (e) {
      }
    }
    result += (i > 0 ? " " : "") + a;
  }
  return result;
}
class AbstractLogger extends Disposable {
  constructor() {
    super(...arguments);
    this.level = DEFAULT_LOG_LEVEL;
    this._onDidChangeLogLevel = this._register(new Emitter());
    this.onDidChangeLogLevel = this._onDidChangeLogLevel.event;
  }
  setLevel(level) {
    if (this.level !== level) {
      this.level = level;
      this._onDidChangeLogLevel.fire(this.level);
    }
  }
  getLevel() {
    return this.level;
  }
  checkLogLevel(level) {
    return canLog(this.level, level);
  }
  canLog(level) {
    if (this._store.isDisposed) {
      return false;
    }
    return this.checkLogLevel(level);
  }
}
class AbstractMessageLogger extends AbstractLogger {
  constructor(logAlways) {
    super();
    this.logAlways = logAlways;
  }
  checkLogLevel(level) {
    return this.logAlways || super.checkLogLevel(level);
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      this.log(1 /* Trace */, format([message, ...args], true));
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      this.log(2 /* Debug */, format([message, ...args]));
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      this.log(3 /* Info */, format([message, ...args]));
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      this.log(4 /* Warning */, format([message, ...args]));
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      if (message instanceof Error) {
        const array = Array.prototype.slice.call(arguments);
        array[0] = message.stack;
        this.log(5 /* Error */, format(array));
      } else {
        this.log(5 /* Error */, format([message, ...args]));
      }
    }
  }
  flush() {
  }
}
class ConsoleMainLogger extends AbstractLogger {
  constructor(logLevel = DEFAULT_LOG_LEVEL) {
    super();
    this.setLevel(logLevel);
    this.useColors = !isWindows;
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      if (this.useColors) {
        console.log(`\x1B[90m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        console.log(`[main ${now()}]`, message, ...args);
      }
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      if (this.useColors) {
        console.log(`\x1B[90m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        console.log(`[main ${now()}]`, message, ...args);
      }
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      if (this.useColors) {
        console.log(`\x1B[90m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        console.log(`[main ${now()}]`, message, ...args);
      }
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      if (this.useColors) {
        console.warn(`\x1B[93m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        console.warn(`[main ${now()}]`, message, ...args);
      }
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      if (this.useColors) {
        console.error(`\x1B[91m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        console.error(`[main ${now()}]`, message, ...args);
      }
    }
  }
  flush() {
  }
}
class ConsoleLogger extends AbstractLogger {
  constructor(logLevel = DEFAULT_LOG_LEVEL, useColors = true) {
    super();
    this.useColors = useColors;
    this.setLevel(logLevel);
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      if (this.useColors) {
        console.log("%cTRACE", "color: #888", message, ...args);
      } else {
        console.log(message, ...args);
      }
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      if (this.useColors) {
        console.log("%cDEBUG", "background: #eee; color: #888", message, ...args);
      } else {
        console.log(message, ...args);
      }
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      if (this.useColors) {
        console.log("%c INFO", "color: #33f", message, ...args);
      } else {
        console.log(message, ...args);
      }
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      if (this.useColors) {
        console.warn("%c WARN", "color: #993", message, ...args);
      } else {
        console.log(message, ...args);
      }
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      if (this.useColors) {
        console.error("%c  ERR", "color: #f33", message, ...args);
      } else {
        console.error(message, ...args);
      }
    }
  }
  flush() {
  }
}
class AdapterLogger extends AbstractLogger {
  constructor(adapter, logLevel = DEFAULT_LOG_LEVEL) {
    super();
    this.adapter = adapter;
    this.setLevel(logLevel);
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      this.adapter.log(1 /* Trace */, [this.extractMessage(message), ...args]);
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      this.adapter.log(2 /* Debug */, [this.extractMessage(message), ...args]);
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      this.adapter.log(3 /* Info */, [this.extractMessage(message), ...args]);
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      this.adapter.log(4 /* Warning */, [this.extractMessage(message), ...args]);
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      this.adapter.log(5 /* Error */, [this.extractMessage(message), ...args]);
    }
  }
  extractMessage(msg) {
    if (typeof msg === "string") {
      return msg;
    }
    return toErrorMessage(msg, this.canLog(1 /* Trace */));
  }
  flush() {
  }
}
class MultiplexLogger extends AbstractLogger {
  constructor(loggers) {
    super();
    this.loggers = loggers;
    if (loggers.length) {
      this.setLevel(loggers[0].getLevel());
    }
  }
  setLevel(level) {
    for (const logger of this.loggers) {
      logger.setLevel(level);
    }
    super.setLevel(level);
  }
  trace(message, ...args) {
    for (const logger of this.loggers) {
      logger.trace(message, ...args);
    }
  }
  debug(message, ...args) {
    for (const logger of this.loggers) {
      logger.debug(message, ...args);
    }
  }
  info(message, ...args) {
    for (const logger of this.loggers) {
      logger.info(message, ...args);
    }
  }
  warn(message, ...args) {
    for (const logger of this.loggers) {
      logger.warn(message, ...args);
    }
  }
  error(message, ...args) {
    for (const logger of this.loggers) {
      logger.error(message, ...args);
    }
  }
  flush() {
    for (const logger of this.loggers) {
      logger.flush();
    }
  }
  dispose() {
    for (const logger of this.loggers) {
      logger.dispose();
    }
    super.dispose();
  }
}
class AbstractLoggerService extends Disposable {
  constructor(logLevel, logsHome, loggerResources) {
    super();
    this.logLevel = logLevel;
    this.logsHome = logsHome;
    this._loggers = new ResourceMap();
    this._onDidChangeLoggers = this._register(new Emitter());
    this.onDidChangeLoggers = this._onDidChangeLoggers.event;
    this._onDidChangeLogLevel = this._register(new Emitter());
    this.onDidChangeLogLevel = this._onDidChangeLogLevel.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    if (loggerResources) {
      for (const loggerResource of loggerResources) {
        this._loggers.set(loggerResource.resource, { logger: void 0, info: loggerResource });
      }
    }
  }
  getLoggerEntry(resourceOrId) {
    if (isString(resourceOrId)) {
      return [...this._loggers.values()].find((logger) => logger.info.id === resourceOrId);
    }
    return this._loggers.get(resourceOrId);
  }
  getLogger(resourceOrId) {
    return this.getLoggerEntry(resourceOrId)?.logger;
  }
  createLogger(idOrResource, options) {
    const resource = this.toResource(idOrResource);
    const id = isString(idOrResource) ? idOrResource : options?.id ?? hash(resource.toString()).toString(16);
    let logger = this._loggers.get(resource)?.logger;
    const logLevel = options?.logLevel === "always" ? 1 /* Trace */ : options?.logLevel;
    if (!logger) {
      logger = this.doCreateLogger(resource, logLevel ?? this.getLogLevel(resource) ?? this.logLevel, { ...options, id });
    }
    const loggerEntry = {
      logger,
      info: {
        resource,
        id,
        logLevel,
        name: options?.name,
        hidden: options?.hidden,
        group: options?.group,
        extensionId: options?.extensionId,
        when: options?.when
      }
    };
    this.registerLogger(loggerEntry.info);
    this._loggers.set(resource, loggerEntry);
    return logger;
  }
  toResource(idOrResource) {
    return isString(idOrResource) ? joinPath(this.logsHome, `${idOrResource}.log`) : idOrResource;
  }
  setLogLevel(arg1, arg2) {
    if (URI.isUri(arg1)) {
      const resource = arg1;
      const logLevel = arg2;
      const logger = this._loggers.get(resource);
      if (logger && logLevel !== logger.info.logLevel) {
        logger.info.logLevel = logLevel === this.logLevel ? void 0 : logLevel;
        logger.logger?.setLevel(logLevel);
        this._loggers.set(logger.info.resource, logger);
        this._onDidChangeLogLevel.fire([resource, logLevel]);
      }
    } else {
      this.logLevel = arg1;
      for (const [resource, logger] of this._loggers.entries()) {
        if (this._loggers.get(resource)?.info.logLevel === void 0) {
          logger.logger?.setLevel(this.logLevel);
        }
      }
      this._onDidChangeLogLevel.fire(this.logLevel);
    }
  }
  setVisibility(resourceOrId, visibility) {
    const logger = this.getLoggerEntry(resourceOrId);
    if (logger && visibility !== !logger.info.hidden) {
      logger.info.hidden = !visibility;
      this._loggers.set(logger.info.resource, logger);
      this._onDidChangeVisibility.fire([logger.info.resource, visibility]);
    }
  }
  getLogLevel(resource) {
    let logLevel;
    if (resource) {
      logLevel = this._loggers.get(resource)?.info.logLevel;
    }
    return logLevel ?? this.logLevel;
  }
  registerLogger(resource) {
    const existing = this._loggers.get(resource.resource);
    if (existing) {
      if (existing.info.hidden !== resource.hidden) {
        this.setVisibility(resource.resource, !resource.hidden);
      }
    } else {
      this._loggers.set(resource.resource, { info: resource, logger: void 0 });
      this._onDidChangeLoggers.fire({ added: [resource], removed: [] });
    }
  }
  deregisterLogger(idOrResource) {
    const resource = this.toResource(idOrResource);
    const existing = this._loggers.get(resource);
    if (existing) {
      if (existing.logger) {
        existing.logger.dispose();
      }
      this._loggers.delete(resource);
      this._onDidChangeLoggers.fire({ added: [], removed: [existing.info] });
    }
  }
  *getRegisteredLoggers() {
    for (const entry of this._loggers.values()) {
      yield entry.info;
    }
  }
  getRegisteredLogger(resource) {
    return this._loggers.get(resource)?.info;
  }
  dispose() {
    this._loggers.forEach((logger) => logger.logger?.dispose());
    this._loggers.clear();
    super.dispose();
  }
}
class NullLogger {
  constructor() {
    this.onDidChangeLogLevel = new Emitter().event;
  }
  setLevel(level) {
  }
  getLevel() {
    return 3 /* Info */;
  }
  trace(message, ...args) {
  }
  debug(message, ...args) {
  }
  info(message, ...args) {
  }
  warn(message, ...args) {
  }
  error(message, ...args) {
  }
  critical(message, ...args) {
  }
  dispose() {
  }
  flush() {
  }
}
class NullLogService extends NullLogger {
}
function getLogLevel(environmentService) {
  if (environmentService.verbose) {
    return 1 /* Trace */;
  }
  if (typeof environmentService.logLevel === "string") {
    const logLevel = parseLogLevel(environmentService.logLevel.toLowerCase());
    if (logLevel !== void 0) {
      return logLevel;
    }
  }
  return DEFAULT_LOG_LEVEL;
}
function LogLevelToString(logLevel) {
  switch (logLevel) {
    case 1 /* Trace */:
      return "trace";
    case 2 /* Debug */:
      return "debug";
    case 3 /* Info */:
      return "info";
    case 4 /* Warning */:
      return "warn";
    case 5 /* Error */:
      return "error";
    case 0 /* Off */:
      return "off";
  }
}
function LogLevelToLocalizedString(logLevel) {
  switch (logLevel) {
    case 1 /* Trace */:
      return { original: "Trace", value: nls.localize("trace", "Trace") };
    case 2 /* Debug */:
      return { original: "Debug", value: nls.localize("debug", "Debug") };
    case 3 /* Info */:
      return { original: "Info", value: nls.localize("info", "Info") };
    case 4 /* Warning */:
      return { original: "Warning", value: nls.localize("warn", "Warning") };
    case 5 /* Error */:
      return { original: "Error", value: nls.localize("error", "Error") };
    case 0 /* Off */:
      return { original: "Off", value: nls.localize("off", "Off") };
  }
}
function parseLogLevel(logLevel) {
  switch (logLevel) {
    case "trace":
      return 1 /* Trace */;
    case "debug":
      return 2 /* Debug */;
    case "info":
      return 3 /* Info */;
    case "warn":
      return 4 /* Warning */;
    case "error":
      return 5 /* Error */;
    case "critical":
      return 5 /* Error */;
    case "off":
      return 0 /* Off */;
  }
  return void 0;
}
const CONTEXT_LOG_LEVEL = new RawContextKey("logLevel", LogLevelToString(3 /* Info */));
export {
  AbstractLogger,
  AbstractLoggerService,
  AbstractMessageLogger,
  AdapterLogger,
  CONTEXT_LOG_LEVEL,
  ConsoleLogger,
  ConsoleMainLogger,
  DEFAULT_LOG_LEVEL,
  ILogService,
  ILoggerService,
  LogLevel,
  LogLevelToLocalizedString,
  LogLevelToString,
  MultiplexLogger,
  NullLogService,
  NullLogger,
  canLog,
  getLogLevel,
  isLogLevel,
  log,
  parseLogLevel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBNdXRhYmxlLCBpc051bWJlciwgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5cbmV4cG9ydCBjb25zdCBJTG9nU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJTG9nU2VydmljZT4oJ2xvZ1NlcnZpY2UnKTtcbmV4cG9ydCBjb25zdCBJTG9nZ2VyU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJTG9nZ2VyU2VydmljZT4oJ2xvZ2dlclNlcnZpY2UnKTtcblxuZnVuY3Rpb24gbm93KCk6IHN0cmluZyB7XG5cdHJldHVybiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0xvZ0xldmVsKHRoaW5nOiB1bmtub3duKTogdGhpbmcgaXMgTG9nTGV2ZWwge1xuXHRyZXR1cm4gaXNOdW1iZXIodGhpbmcpO1xufVxuXG5leHBvcnQgZW51bSBMb2dMZXZlbCB7XG5cdE9mZixcblx0VHJhY2UsXG5cdERlYnVnLFxuXHRJbmZvLFxuXHRXYXJuaW5nLFxuXHRFcnJvclxufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9MT0dfTEVWRUw6IExvZ0xldmVsID0gTG9nTGV2ZWwuSW5mbztcblxuZXhwb3J0IGludGVyZmFjZSBJTG9nZ2VyIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRvbkRpZENoYW5nZUxvZ0xldmVsOiBFdmVudDxMb2dMZXZlbD47XG5cdGdldExldmVsKCk6IExvZ0xldmVsO1xuXHRzZXRMZXZlbChsZXZlbDogTG9nTGV2ZWwpOiB2b2lkO1xuXG5cdHRyYWNlKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkO1xuXHRkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZDtcblx0aW5mbyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZDtcblx0d2FybihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZDtcblx0ZXJyb3IobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZDtcblxuXHQvKipcblx0ICogQW4gb3BlcmF0aW9uIHRvIGZsdXNoIHRoZSBjb250ZW50cy4gQ2FuIGJlIHN5bmNocm9ub3VzLlxuXHQgKi9cblx0Zmx1c2goKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbkxvZyhsb2dnZXJMZXZlbDogTG9nTGV2ZWwsIG1lc3NhZ2VMZXZlbDogTG9nTGV2ZWwpOiBib29sZWFuIHtcblx0cmV0dXJuIGxvZ2dlckxldmVsICE9PSBMb2dMZXZlbC5PZmYgJiYgbG9nZ2VyTGV2ZWwgPD0gbWVzc2FnZUxldmVsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9nKGxvZ2dlcjogSUxvZ2dlciwgbGV2ZWw6IExvZ0xldmVsLCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0c3dpdGNoIChsZXZlbCkge1xuXHRcdGNhc2UgTG9nTGV2ZWwuVHJhY2U6IGxvZ2dlci50cmFjZShtZXNzYWdlKTsgYnJlYWs7XG5cdFx0Y2FzZSBMb2dMZXZlbC5EZWJ1ZzogbG9nZ2VyLmRlYnVnKG1lc3NhZ2UpOyBicmVhaztcblx0XHRjYXNlIExvZ0xldmVsLkluZm86IGxvZ2dlci5pbmZvKG1lc3NhZ2UpOyBicmVhaztcblx0XHRjYXNlIExvZ0xldmVsLldhcm5pbmc6IGxvZ2dlci53YXJuKG1lc3NhZ2UpOyBicmVhaztcblx0XHRjYXNlIExvZ0xldmVsLkVycm9yOiBsb2dnZXIuZXJyb3IobWVzc2FnZSk7IGJyZWFrO1xuXHRcdGNhc2UgTG9nTGV2ZWwuT2ZmOiAvKiBkbyBub3RoaW5nICovIGJyZWFrO1xuXHRcdGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsb2cgbGV2ZWwgJHtsZXZlbH1gKTtcblx0fVxufVxuXG5mdW5jdGlvbiBmb3JtYXQoYXJnczogYW55LCB2ZXJib3NlOiBib29sZWFuID0gZmFsc2UpOiBzdHJpbmcge1xuXHRsZXQgcmVzdWx0ID0gJyc7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG5cdFx0bGV0IGEgPSBhcmdzW2ldO1xuXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0YSA9IHRvRXJyb3JNZXNzYWdlKGEsIHZlcmJvc2UpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgYSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGEgPSBKU09OLnN0cmluZ2lmeShhKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHsgfVxuXHRcdH1cblxuXHRcdHJlc3VsdCArPSAoaSA+IDAgPyAnICcgOiAnJykgKyBhO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IHR5cGUgTG9nZ2VyR3JvdXAgPSB7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxvZ1NlcnZpY2UgZXh0ZW5kcyBJTG9nZ2VyIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMb2dnZXJPcHRpb25zIHtcblxuXHQvKipcblx0ICogSWQgb2YgdGhlIGxvZ2dlci5cblx0ICovXG5cdGlkPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBOYW1lIG9mIHRoZSBsb2dnZXIuXG5cdCAqL1xuXHRuYW1lPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBEbyBub3QgY3JlYXRlIHJvdGF0aW5nIGZpbGVzIGlmIG1heCBzaXplIGV4Y2VlZHMuXG5cdCAqL1xuXHRkb25vdFJvdGF0ZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIERvIG5vdCB1c2UgZm9ybWF0dGVycy5cblx0ICovXG5cdGRvbm90VXNlRm9ybWF0dGVycz86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFdoZW4gdG8gbG9nLiBTZXQgdG8gYGFsd2F5c2AgdG8gbG9nIGFsd2F5cy5cblx0ICovXG5cdGxvZ0xldmVsPzogJ2Fsd2F5cycgfCBMb2dMZXZlbDtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgbG9nIHNob3VsZCBiZSBoaWRkZW4gZnJvbSB0aGUgdXNlci5cblx0ICovXG5cdGhpZGRlbj86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbmRpdGlvbiB3aGljaCBtdXN0IGJlIHRydWUgdG8gc2hvdyB0aGlzIGxvZ2dlclxuXHQgKi9cblx0d2hlbj86IHN0cmluZztcblxuXHQvKipcblx0ICogSWQgb2YgdGhlIGV4dGVuc2lvbiB0aGF0IGNyZWF0ZWQgdGhpcyBsb2dnZXIuXG5cdCAqL1xuXHRleHRlbnNpb25JZD86IHN0cmluZztcblxuXHQvKipcblx0ICogR3JvdXAgb2YgdGhlIGxvZ2dlci5cblx0ICovXG5cdGdyb3VwPzogTG9nZ2VyR3JvdXA7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxvZ2dlclJlc291cmNlIHtcblx0cmVhZG9ubHkgcmVzb3VyY2U6IFVSSTtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgbmFtZT86IHN0cmluZztcblx0cmVhZG9ubHkgbG9nTGV2ZWw/OiBMb2dMZXZlbDtcblx0cmVhZG9ubHkgaGlkZGVuPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgd2hlbj86IHN0cmluZztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uSWQ/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGdyb3VwPzogTG9nZ2VyR3JvdXA7XG59XG5cbmV4cG9ydCB0eXBlIERpZENoYW5nZUxvZ2dlcnNFdmVudCA9IHtcblx0cmVhZG9ubHkgYWRkZWQ6IEl0ZXJhYmxlPElMb2dnZXJSZXNvdXJjZT47XG5cdHJlYWRvbmx5IHJlbW92ZWQ6IEl0ZXJhYmxlPElMb2dnZXJSZXNvdXJjZT47XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIElMb2dnZXJTZXJ2aWNlIHtcblxuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBsb2dnZXIgZm9yIHRoZSBnaXZlbiByZXNvdXJjZSwgb3IgZ2V0cyBvbmUgaWYgaXQgYWxyZWFkeSBleGlzdHMuXG5cdCAqXG5cdCAqIFRoaXMgd2lsbCBhbHNvIHJlZ2lzdGVyIHRoZSBsb2dnZXIgd2l0aCB0aGUgbG9nZ2VyIHNlcnZpY2UuXG5cdCAqL1xuXHRjcmVhdGVMb2dnZXIocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElMb2dnZXJPcHRpb25zKTogSUxvZ2dlcjtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIGxvZ2dlciB3aXRoIHRoZSBnaXZlbiBpZCBpbiB0aGUgbG9ncyBmb2xkZXIsIG9yIGdldHMgb25lIGlmIGl0IGFscmVhZHkgZXhpc3RzLlxuXHQgKlxuXHQgKiBUaGlzIHdpbGwgYWxzbyByZWdpc3RlciB0aGUgbG9nZ2VyIHdpdGggdGhlIGxvZ2dlciBzZXJ2aWNlLlxuXHQgKi9cblx0Y3JlYXRlTG9nZ2VyKGlkOiBzdHJpbmcsIG9wdGlvbnM/OiBPbWl0PElMb2dnZXJPcHRpb25zLCAnaWQnPik6IElMb2dnZXI7XG5cblx0LyoqXG5cdCAqIEdldHMgYW4gZXhpc3RpbmcgbG9nZ2VyLCBpZiBhbnkuXG5cdCAqL1xuXHRnZXRMb2dnZXIocmVzb3VyY2VPcklkOiBVUkkgfCBzdHJpbmcpOiBJTG9nZ2VyIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCB3aGljaCBmaXJlcyB3aGVuIHRoZSBsb2cgbGV2ZWwgb2YgYSBsb2dnZXIgaGFzIGNoYW5nZWRcblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTG9nTGV2ZWw6IEV2ZW50PExvZ0xldmVsIHwgW1VSSSwgTG9nTGV2ZWxdPjtcblxuXHQvKipcblx0ICogU2V0IGRlZmF1bHQgbG9nIGxldmVsLlxuXHQgKi9cblx0c2V0TG9nTGV2ZWwobGV2ZWw6IExvZ0xldmVsKTogdm9pZDtcblxuXHQvKipcblx0ICogU2V0IGxvZyBsZXZlbCBmb3IgYSBsb2dnZXIuXG5cdCAqL1xuXHRzZXRMb2dMZXZlbChyZXNvdXJjZTogVVJJLCBsZXZlbDogTG9nTGV2ZWwpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBHZXQgbG9nIGxldmVsIGZvciBhIGxvZ2dlciBvciB0aGUgZGVmYXVsdCBsb2cgbGV2ZWwuXG5cdCAqL1xuXHRnZXRMb2dMZXZlbChyZXNvdXJjZT86IFVSSSk6IExvZ0xldmVsO1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCB3aGljaCBmaXJlcyB3aGVuIHRoZSB2aXNpYmlsaXR5IG9mIGEgbG9nZ2VyIGhhcyBjaGFuZ2VkXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpc2liaWxpdHk6IEV2ZW50PFtVUkksIGJvb2xlYW5dPjtcblxuXHQvKipcblx0ICogU2V0IHRoZSB2aXNpYmlsaXR5IG9mIGEgbG9nZ2VyLlxuXHQgKi9cblx0c2V0VmlzaWJpbGl0eShyZXNvdXJjZU9ySWQ6IFVSSSB8IHN0cmluZywgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHdoaWNoIGZpcmVzIHdoZW4gdGhlIGxvZ2dlciByZXNvdXJjZXMgYXJlIGNoYW5nZWRcblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTG9nZ2VyczogRXZlbnQ8RGlkQ2hhbmdlTG9nZ2Vyc0V2ZW50PjtcblxuXHQvKipcblx0ICogUmVnaXN0ZXIgYSBsb2dnZXIgd2l0aCB0aGUgbG9nZ2VyIHNlcnZpY2UuXG5cdCAqXG5cdCAqIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGNyZWF0ZSBhIGxvZ2dlciwgYnV0IG9ubHkgcmVnaXN0ZXIgaXQuXG5cdCAqXG5cdCAqIFVzZSBgY3JlYXRlTG9nZ2VyYCB0byBjcmVhdGUgYSBsb2dnZXIgYW5kIHJlZ2lzdGVyIGl0LlxuXHQgKlxuXHQgKiBVc2UgaXQgd2hlbiB5b3Ugd2FudCB0byByZWdpc3RlciBhIGxvZ2dlciB0aGF0IGlzIG5vdCBjcmVhdGVkIGJ5IHRoZSBsb2dnZXIgc2VydmljZS5cblx0ICovXG5cdHJlZ2lzdGVyTG9nZ2VyKHJlc291cmNlOiBJTG9nZ2VyUmVzb3VyY2UpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBEZXJlZ2lzdGVyIHRoZSBsb2dnZXIgZm9yIHRoZSBnaXZlbiByZXNvdXJjZS5cblx0ICovXG5cdGRlcmVnaXN0ZXJMb2dnZXIoaWRPclJlc291cmNlOiBVUkkgfCBzdHJpbmcpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBHZXQgYWxsIHJlZ2lzdGVyZWQgbG9nZ2Vyc1xuXHQgKi9cblx0Z2V0UmVnaXN0ZXJlZExvZ2dlcnMoKTogSXRlcmFibGU8SUxvZ2dlclJlc291cmNlPjtcblxuXHQvKipcblx0ICogR2V0IHRoZSByZWdpc3RlcmVkIGxvZ2dlciBmb3IgdGhlIGdpdmVuIHJlc291cmNlLlxuXHQgKi9cblx0Z2V0UmVnaXN0ZXJlZExvZ2dlcihyZXNvdXJjZTogVVJJKTogSUxvZ2dlclJlc291cmNlIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RMb2dnZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUxvZ2dlciB7XG5cblx0cHJpdmF0ZSBsZXZlbDogTG9nTGV2ZWwgPSBERUZBVUxUX0xPR19MRVZFTDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VMb2dMZXZlbDogRW1pdHRlcjxMb2dMZXZlbD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxMb2dMZXZlbD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTG9nTGV2ZWw6IEV2ZW50PExvZ0xldmVsPiA9IHRoaXMuX29uRGlkQ2hhbmdlTG9nTGV2ZWwuZXZlbnQ7XG5cblx0c2V0TGV2ZWwobGV2ZWw6IExvZ0xldmVsKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGV2ZWwgIT09IGxldmVsKSB7XG5cdFx0XHR0aGlzLmxldmVsID0gbGV2ZWw7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxvZ0xldmVsLmZpcmUodGhpcy5sZXZlbCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0TGV2ZWwoKTogTG9nTGV2ZWwge1xuXHRcdHJldHVybiB0aGlzLmxldmVsO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNoZWNrTG9nTGV2ZWwobGV2ZWw6IExvZ0xldmVsKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGNhbkxvZyh0aGlzLmxldmVsLCBsZXZlbCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY2FuTG9nKGxldmVsOiBMb2dMZXZlbCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmNoZWNrTG9nTGV2ZWwobGV2ZWwpO1xuXHR9XG5cblx0YWJzdHJhY3QgdHJhY2UobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQ7XG5cdGFic3RyYWN0IGRlYnVnKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkO1xuXHRhYnN0cmFjdCBpbmZvKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkO1xuXHRhYnN0cmFjdCB3YXJuKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkO1xuXHRhYnN0cmFjdCBlcnJvcihtZXNzYWdlOiBzdHJpbmcgfCBFcnJvciwgLi4uYXJnczogYW55W10pOiB2b2lkO1xuXHRhYnN0cmFjdCBmbHVzaCgpOiB2b2lkO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RNZXNzYWdlTG9nZ2VyIGV4dGVuZHMgQWJzdHJhY3RMb2dnZXIgaW1wbGVtZW50cyBJTG9nZ2VyIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGxvZ0Fsd2F5cz86IGJvb2xlYW4pIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNoZWNrTG9nTGV2ZWwobGV2ZWw6IExvZ0xldmVsKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubG9nQWx3YXlzIHx8IHN1cGVyLmNoZWNrTG9nTGV2ZWwobGV2ZWwpO1xuXHR9XG5cblx0dHJhY2UobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5UcmFjZSkpIHtcblx0XHRcdHRoaXMubG9nKExvZ0xldmVsLlRyYWNlLCBmb3JtYXQoW21lc3NhZ2UsIC4uLmFyZ3NdLCB0cnVlKSk7XG5cdFx0fVxuXHR9XG5cblx0ZGVidWcobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5EZWJ1ZykpIHtcblx0XHRcdHRoaXMubG9nKExvZ0xldmVsLkRlYnVnLCBmb3JtYXQoW21lc3NhZ2UsIC4uLmFyZ3NdKSk7XG5cdFx0fVxuXHR9XG5cblx0aW5mbyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLkluZm8pKSB7XG5cdFx0XHR0aGlzLmxvZyhMb2dMZXZlbC5JbmZvLCBmb3JtYXQoW21lc3NhZ2UsIC4uLmFyZ3NdKSk7XG5cdFx0fVxuXHR9XG5cblx0d2FybihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLldhcm5pbmcpKSB7XG5cdFx0XHR0aGlzLmxvZyhMb2dMZXZlbC5XYXJuaW5nLCBmb3JtYXQoW21lc3NhZ2UsIC4uLmFyZ3NdKSk7XG5cdFx0fVxuXHR9XG5cblx0ZXJyb3IobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLkVycm9yKSkge1xuXHRcdFx0aWYgKG1lc3NhZ2UgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0XHRjb25zdCBhcnJheSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykgYXMgYW55W107XG5cdFx0XHRcdGFycmF5WzBdID0gbWVzc2FnZS5zdGFjaztcblx0XHRcdFx0dGhpcy5sb2coTG9nTGV2ZWwuRXJyb3IsIGZvcm1hdChhcnJheSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5sb2coTG9nTGV2ZWwuRXJyb3IsIGZvcm1hdChbbWVzc2FnZSwgLi4uYXJnc10pKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmbHVzaCgpOiB2b2lkIHsgfVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBsb2cobGV2ZWw6IExvZ0xldmVsLCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBDb25zb2xlTWFpbkxvZ2dlciBleHRlbmRzIEFic3RyYWN0TG9nZ2VyIGltcGxlbWVudHMgSUxvZ2dlciB7XG5cblx0cHJpdmF0ZSB1c2VDb2xvcnM6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IobG9nTGV2ZWw6IExvZ0xldmVsID0gREVGQVVMVF9MT0dfTEVWRUwpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuc2V0TGV2ZWwobG9nTGV2ZWwpO1xuXHRcdHRoaXMudXNlQ29sb3JzID0gIWlzV2luZG93cztcblx0fVxuXG5cdHRyYWNlKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jYW5Mb2coTG9nTGV2ZWwuVHJhY2UpKSB7XG5cdFx0XHRpZiAodGhpcy51c2VDb2xvcnMpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFxceDFiWzkwbVttYWluICR7bm93KCl9XVxceDFiWzBtYCwgbWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgW21haW4gJHtub3coKX1dYCwgbWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZGVidWcobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5EZWJ1ZykpIHtcblx0XHRcdGlmICh0aGlzLnVzZUNvbG9ycykge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgXFx4MWJbOTBtW21haW4gJHtub3coKX1dXFx4MWJbMG1gLCBtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBbbWFpbiAke25vdygpfV1gLCBtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpbmZvKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jYW5Mb2coTG9nTGV2ZWwuSW5mbykpIHtcblx0XHRcdGlmICh0aGlzLnVzZUNvbG9ycykge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgXFx4MWJbOTBtW21haW4gJHtub3coKX1dXFx4MWJbMG1gLCBtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBbbWFpbiAke25vdygpfV1gLCBtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR3YXJuKG1lc3NhZ2U6IHN0cmluZyB8IEVycm9yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5XYXJuaW5nKSkge1xuXHRcdFx0aWYgKHRoaXMudXNlQ29sb3JzKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgXFx4MWJbOTNtW21haW4gJHtub3coKX1dXFx4MWJbMG1gLCBtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgW21haW4gJHtub3coKX1dYCwgbWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZXJyb3IobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5FcnJvcikpIHtcblx0XHRcdGlmICh0aGlzLnVzZUNvbG9ycykge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKGBcXHgxYls5MW1bbWFpbiAke25vdygpfV1cXHgxYlswbWAsIG1lc3NhZ2UsIC4uLmFyZ3MpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihgW21haW4gJHtub3coKX1dYCwgbWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Zmx1c2goKTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIENvbnNvbGVMb2dnZXIgZXh0ZW5kcyBBYnN0cmFjdExvZ2dlciBpbXBsZW1lbnRzIElMb2dnZXIge1xuXG5cdGNvbnN0cnVjdG9yKGxvZ0xldmVsOiBMb2dMZXZlbCA9IERFRkFVTFRfTE9HX0xFVkVMLCBwcml2YXRlIHJlYWRvbmx5IHVzZUNvbG9yczogYm9vbGVhbiA9IHRydWUpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuc2V0TGV2ZWwobG9nTGV2ZWwpO1xuXHR9XG5cblx0dHJhY2UobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5UcmFjZSkpIHtcblx0XHRcdGlmICh0aGlzLnVzZUNvbG9ycykge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnJWNUUkFDRScsICdjb2xvcjogIzg4OCcsIG1lc3NhZ2UsIC4uLmFyZ3MpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2cobWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZGVidWcobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5EZWJ1ZykpIHtcblx0XHRcdGlmICh0aGlzLnVzZUNvbG9ycykge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnJWNERUJVRycsICdiYWNrZ3JvdW5kOiAjZWVlOyBjb2xvcjogIzg4OCcsIG1lc3NhZ2UsIC4uLmFyZ3MpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2cobWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aW5mbyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLkluZm8pKSB7XG5cdFx0XHRpZiAodGhpcy51c2VDb2xvcnMpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJyVjIElORk8nLCAnY29sb3I6ICMzM2YnLCBtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKG1lc3NhZ2UsIC4uLmFyZ3MpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHdhcm4obWVzc2FnZTogc3RyaW5nIHwgRXJyb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLldhcm5pbmcpKSB7XG5cdFx0XHRpZiAodGhpcy51c2VDb2xvcnMpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCclYyBXQVJOJywgJ2NvbG9yOiAjOTkzJywgbWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRlcnJvcihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLkVycm9yKSkge1xuXHRcdFx0aWYgKHRoaXMudXNlQ29sb3JzKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJyVjICBFUlInLCAnY29sb3I6ICNmMzMnLCBtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IobWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblxuXHRmbHVzaCgpOiB2b2lkIHtcblx0XHQvLyBub29wXG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEFkYXB0ZXJMb2dnZXIgZXh0ZW5kcyBBYnN0cmFjdExvZ2dlciBpbXBsZW1lbnRzIElMb2dnZXIge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYWRhcHRlcjogeyBsb2c6IChsb2dMZXZlbDogTG9nTGV2ZWwsIGFyZ3M6IGFueVtdKSA9PiB2b2lkIH0sIGxvZ0xldmVsOiBMb2dMZXZlbCA9IERFRkFVTFRfTE9HX0xFVkVMKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnNldExldmVsKGxvZ0xldmVsKTtcblx0fVxuXG5cdHRyYWNlKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jYW5Mb2coTG9nTGV2ZWwuVHJhY2UpKSB7XG5cdFx0XHR0aGlzLmFkYXB0ZXIubG9nKExvZ0xldmVsLlRyYWNlLCBbdGhpcy5leHRyYWN0TWVzc2FnZShtZXNzYWdlKSwgLi4uYXJnc10pO1xuXHRcdH1cblx0fVxuXG5cdGRlYnVnKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jYW5Mb2coTG9nTGV2ZWwuRGVidWcpKSB7XG5cdFx0XHR0aGlzLmFkYXB0ZXIubG9nKExvZ0xldmVsLkRlYnVnLCBbdGhpcy5leHRyYWN0TWVzc2FnZShtZXNzYWdlKSwgLi4uYXJnc10pO1xuXHRcdH1cblx0fVxuXG5cdGluZm8obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNhbkxvZyhMb2dMZXZlbC5JbmZvKSkge1xuXHRcdFx0dGhpcy5hZGFwdGVyLmxvZyhMb2dMZXZlbC5JbmZvLCBbdGhpcy5leHRyYWN0TWVzc2FnZShtZXNzYWdlKSwgLi4uYXJnc10pO1xuXHRcdH1cblx0fVxuXG5cdHdhcm4obWVzc2FnZTogc3RyaW5nIHwgRXJyb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLldhcm5pbmcpKSB7XG5cdFx0XHR0aGlzLmFkYXB0ZXIubG9nKExvZ0xldmVsLldhcm5pbmcsIFt0aGlzLmV4dHJhY3RNZXNzYWdlKG1lc3NhZ2UpLCAuLi5hcmdzXSk7XG5cdFx0fVxuXHR9XG5cblx0ZXJyb3IobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FuTG9nKExvZ0xldmVsLkVycm9yKSkge1xuXHRcdFx0dGhpcy5hZGFwdGVyLmxvZyhMb2dMZXZlbC5FcnJvciwgW3RoaXMuZXh0cmFjdE1lc3NhZ2UobWVzc2FnZSksIC4uLmFyZ3NdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGV4dHJhY3RNZXNzYWdlKG1zZzogc3RyaW5nIHwgRXJyb3IpOiBzdHJpbmcge1xuXHRcdGlmICh0eXBlb2YgbXNnID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIG1zZztcblx0XHR9XG5cblx0XHRyZXR1cm4gdG9FcnJvck1lc3NhZ2UobXNnLCB0aGlzLmNhbkxvZyhMb2dMZXZlbC5UcmFjZSkpO1xuXHR9XG5cblx0Zmx1c2goKTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNdWx0aXBsZXhMb2dnZXIgZXh0ZW5kcyBBYnN0cmFjdExvZ2dlciBpbXBsZW1lbnRzIElMb2dnZXIge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgbG9nZ2VyczogUmVhZG9ubHlBcnJheTxJTG9nZ2VyPikge1xuXHRcdHN1cGVyKCk7XG5cdFx0aWYgKGxvZ2dlcnMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnNldExldmVsKGxvZ2dlcnNbMF0uZ2V0TGV2ZWwoKSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgc2V0TGV2ZWwobGV2ZWw6IExvZ0xldmVsKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBsb2dnZXIgb2YgdGhpcy5sb2dnZXJzKSB7XG5cdFx0XHRsb2dnZXIuc2V0TGV2ZWwobGV2ZWwpO1xuXHRcdH1cblx0XHRzdXBlci5zZXRMZXZlbChsZXZlbCk7XG5cdH1cblxuXHR0cmFjZShtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBsb2dnZXIgb2YgdGhpcy5sb2dnZXJzKSB7XG5cdFx0XHRsb2dnZXIudHJhY2UobWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0fVxuXHR9XG5cblx0ZGVidWcobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgbG9nZ2VyIG9mIHRoaXMubG9nZ2Vycykge1xuXHRcdFx0bG9nZ2VyLmRlYnVnKG1lc3NhZ2UsIC4uLmFyZ3MpO1xuXHRcdH1cblx0fVxuXG5cdGluZm8obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgbG9nZ2VyIG9mIHRoaXMubG9nZ2Vycykge1xuXHRcdFx0bG9nZ2VyLmluZm8obWVzc2FnZSwgLi4uYXJncyk7XG5cdFx0fVxuXHR9XG5cblx0d2FybihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBsb2dnZXIgb2YgdGhpcy5sb2dnZXJzKSB7XG5cdFx0XHRsb2dnZXIud2FybihtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHR9XG5cdH1cblxuXHRlcnJvcihtZXNzYWdlOiBzdHJpbmcgfCBFcnJvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGxvZ2dlciBvZiB0aGlzLmxvZ2dlcnMpIHtcblx0XHRcdGxvZ2dlci5lcnJvcihtZXNzYWdlLCAuLi5hcmdzKTtcblx0XHR9XG5cdH1cblxuXHRmbHVzaCgpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGxvZ2dlciBvZiB0aGlzLmxvZ2dlcnMpIHtcblx0XHRcdGxvZ2dlci5mbHVzaCgpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBsb2dnZXIgb2YgdGhpcy5sb2dnZXJzKSB7XG5cdFx0XHRsb2dnZXIuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxudHlwZSBMb2dnZXJFbnRyeSA9IHsgbG9nZ2VyOiBJTG9nZ2VyIHwgdW5kZWZpbmVkOyBpbmZvOiBNdXRhYmxlPElMb2dnZXJSZXNvdXJjZT4gfTtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0TG9nZ2VyU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTG9nZ2VyU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbG9nZ2VycyA9IG5ldyBSZXNvdXJjZU1hcDxMb2dnZXJFbnRyeT4oKTtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUxvZ2dlcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGFkZGVkOiBJTG9nZ2VyUmVzb3VyY2VbXTsgcmVtb3ZlZDogSUxvZ2dlclJlc291cmNlW10gfT4pO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUxvZ2dlcnMgPSB0aGlzLl9vbkRpZENoYW5nZUxvZ2dlcnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VMb2dMZXZlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPExvZ0xldmVsIHwgW1VSSSwgTG9nTGV2ZWxdPik7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTG9nTGV2ZWwgPSB0aGlzLl9vbkRpZENoYW5nZUxvZ0xldmVsLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlVmlzaWJpbGl0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFtVUkksIGJvb2xlYW5dPik7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eSA9IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgbG9nTGV2ZWw6IExvZ0xldmVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9nc0hvbWU6IFVSSSxcblx0XHRsb2dnZXJSZXNvdXJjZXM/OiBJdGVyYWJsZTxJTG9nZ2VyUmVzb3VyY2U+LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGlmIChsb2dnZXJSZXNvdXJjZXMpIHtcblx0XHRcdGZvciAoY29uc3QgbG9nZ2VyUmVzb3VyY2Ugb2YgbG9nZ2VyUmVzb3VyY2VzKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ2dlcnMuc2V0KGxvZ2dlclJlc291cmNlLnJlc291cmNlLCB7IGxvZ2dlcjogdW5kZWZpbmVkLCBpbmZvOiBsb2dnZXJSZXNvdXJjZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldExvZ2dlckVudHJ5KHJlc291cmNlT3JJZDogVVJJIHwgc3RyaW5nKTogTG9nZ2VyRW50cnkgfCB1bmRlZmluZWQge1xuXHRcdGlmIChpc1N0cmluZyhyZXNvdXJjZU9ySWQpKSB7XG5cdFx0XHRyZXR1cm4gWy4uLnRoaXMuX2xvZ2dlcnMudmFsdWVzKCldLmZpbmQobG9nZ2VyID0+IGxvZ2dlci5pbmZvLmlkID09PSByZXNvdXJjZU9ySWQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbG9nZ2Vycy5nZXQocmVzb3VyY2VPcklkKTtcblx0fVxuXG5cdGdldExvZ2dlcihyZXNvdXJjZU9ySWQ6IFVSSSB8IHN0cmluZyk6IElMb2dnZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdldExvZ2dlckVudHJ5KHJlc291cmNlT3JJZCk/LmxvZ2dlcjtcblx0fVxuXG5cdGNyZWF0ZUxvZ2dlcihpZE9yUmVzb3VyY2U6IFVSSSB8IHN0cmluZywgb3B0aW9ucz86IElMb2dnZXJPcHRpb25zKTogSUxvZ2dlciB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLnRvUmVzb3VyY2UoaWRPclJlc291cmNlKTtcblx0XHRjb25zdCBpZCA9IGlzU3RyaW5nKGlkT3JSZXNvdXJjZSkgPyBpZE9yUmVzb3VyY2UgOiAob3B0aW9ucz8uaWQgPz8gaGFzaChyZXNvdXJjZS50b1N0cmluZygpKS50b1N0cmluZygxNikpO1xuXHRcdGxldCBsb2dnZXIgPSB0aGlzLl9sb2dnZXJzLmdldChyZXNvdXJjZSk/LmxvZ2dlcjtcblx0XHRjb25zdCBsb2dMZXZlbCA9IG9wdGlvbnM/LmxvZ0xldmVsID09PSAnYWx3YXlzJyA/IExvZ0xldmVsLlRyYWNlIDogb3B0aW9ucz8ubG9nTGV2ZWw7XG5cdFx0aWYgKCFsb2dnZXIpIHtcblx0XHRcdGxvZ2dlciA9IHRoaXMuZG9DcmVhdGVMb2dnZXIocmVzb3VyY2UsIGxvZ0xldmVsID8/IHRoaXMuZ2V0TG9nTGV2ZWwocmVzb3VyY2UpID8/IHRoaXMubG9nTGV2ZWwsIHsgLi4ub3B0aW9ucywgaWQgfSk7XG5cdFx0fVxuXHRcdGNvbnN0IGxvZ2dlckVudHJ5OiBMb2dnZXJFbnRyeSA9IHtcblx0XHRcdGxvZ2dlcixcblx0XHRcdGluZm86IHtcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRsb2dMZXZlbCxcblx0XHRcdFx0bmFtZTogb3B0aW9ucz8ubmFtZSxcblx0XHRcdFx0aGlkZGVuOiBvcHRpb25zPy5oaWRkZW4sXG5cdFx0XHRcdGdyb3VwOiBvcHRpb25zPy5ncm91cCxcblx0XHRcdFx0ZXh0ZW5zaW9uSWQ6IG9wdGlvbnM/LmV4dGVuc2lvbklkLFxuXHRcdFx0XHR3aGVuOiBvcHRpb25zPy53aGVuXG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLnJlZ2lzdGVyTG9nZ2VyKGxvZ2dlckVudHJ5LmluZm8pO1xuXHRcdC8vIFRPRE86IEBzYW5keTA4MSBSZW1vdmUgdGhpcyBvbmNlIHJlZ2lzdGVyTG9nZ2VyIGNhbiB0YWtlIElMb2dnZXJcblx0XHR0aGlzLl9sb2dnZXJzLnNldChyZXNvdXJjZSwgbG9nZ2VyRW50cnkpO1xuXHRcdHJldHVybiBsb2dnZXI7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdG9SZXNvdXJjZShpZE9yUmVzb3VyY2U6IHN0cmluZyB8IFVSSSk6IFVSSSB7XG5cdFx0cmV0dXJuIGlzU3RyaW5nKGlkT3JSZXNvdXJjZSkgPyBqb2luUGF0aCh0aGlzLmxvZ3NIb21lLCBgJHtpZE9yUmVzb3VyY2V9LmxvZ2ApIDogaWRPclJlc291cmNlO1xuXHR9XG5cblx0c2V0TG9nTGV2ZWwobG9nTGV2ZWw6IExvZ0xldmVsKTogdm9pZDtcblx0c2V0TG9nTGV2ZWwocmVzb3VyY2U6IFVSSSwgbG9nTGV2ZWw6IExvZ0xldmVsKTogdm9pZDtcblx0c2V0TG9nTGV2ZWwoYXJnMTogYW55LCBhcmcyPzogYW55KTogdm9pZCB7XG5cdFx0aWYgKFVSSS5pc1VyaShhcmcxKSkge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBhcmcxO1xuXHRcdFx0Y29uc3QgbG9nTGV2ZWwgPSBhcmcyO1xuXHRcdFx0Y29uc3QgbG9nZ2VyID0gdGhpcy5fbG9nZ2Vycy5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKGxvZ2dlciAmJiBsb2dMZXZlbCAhPT0gbG9nZ2VyLmluZm8ubG9nTGV2ZWwpIHtcblx0XHRcdFx0bG9nZ2VyLmluZm8ubG9nTGV2ZWwgPSBsb2dMZXZlbCA9PT0gdGhpcy5sb2dMZXZlbCA/IHVuZGVmaW5lZCA6IGxvZ0xldmVsO1xuXHRcdFx0XHRsb2dnZXIubG9nZ2VyPy5zZXRMZXZlbChsb2dMZXZlbCk7XG5cdFx0XHRcdHRoaXMuX2xvZ2dlcnMuc2V0KGxvZ2dlci5pbmZvLnJlc291cmNlLCBsb2dnZXIpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxvZ0xldmVsLmZpcmUoW3Jlc291cmNlLCBsb2dMZXZlbF0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmxvZ0xldmVsID0gYXJnMTtcblx0XHRcdGZvciAoY29uc3QgW3Jlc291cmNlLCBsb2dnZXJdIG9mIHRoaXMuX2xvZ2dlcnMuZW50cmllcygpKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9sb2dnZXJzLmdldChyZXNvdXJjZSk/LmluZm8ubG9nTGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGxvZ2dlci5sb2dnZXI/LnNldExldmVsKHRoaXMubG9nTGV2ZWwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxvZ0xldmVsLmZpcmUodGhpcy5sb2dMZXZlbCk7XG5cdFx0fVxuXHR9XG5cblx0c2V0VmlzaWJpbGl0eShyZXNvdXJjZU9ySWQ6IFVSSSB8IHN0cmluZywgdmlzaWJpbGl0eTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGxvZ2dlciA9IHRoaXMuZ2V0TG9nZ2VyRW50cnkocmVzb3VyY2VPcklkKTtcblx0XHRpZiAobG9nZ2VyICYmIHZpc2liaWxpdHkgIT09ICFsb2dnZXIuaW5mby5oaWRkZW4pIHtcblx0XHRcdGxvZ2dlci5pbmZvLmhpZGRlbiA9ICF2aXNpYmlsaXR5O1xuXHRcdFx0dGhpcy5fbG9nZ2Vycy5zZXQobG9nZ2VyLmluZm8ucmVzb3VyY2UsIGxvZ2dlcik7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZpc2liaWxpdHkuZmlyZShbbG9nZ2VyLmluZm8ucmVzb3VyY2UsIHZpc2liaWxpdHldKTtcblx0XHR9XG5cdH1cblxuXHRnZXRMb2dMZXZlbChyZXNvdXJjZT86IFVSSSk6IExvZ0xldmVsIHtcblx0XHRsZXQgbG9nTGV2ZWw7XG5cdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHRsb2dMZXZlbCA9IHRoaXMuX2xvZ2dlcnMuZ2V0KHJlc291cmNlKT8uaW5mby5sb2dMZXZlbDtcblx0XHR9XG5cdFx0cmV0dXJuIGxvZ0xldmVsID8/IHRoaXMubG9nTGV2ZWw7XG5cdH1cblxuXHRyZWdpc3RlckxvZ2dlcihyZXNvdXJjZTogSUxvZ2dlclJlc291cmNlKTogdm9pZCB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLl9sb2dnZXJzLmdldChyZXNvdXJjZS5yZXNvdXJjZSk7XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRpZiAoZXhpc3RpbmcuaW5mby5oaWRkZW4gIT09IHJlc291cmNlLmhpZGRlbikge1xuXHRcdFx0XHR0aGlzLnNldFZpc2liaWxpdHkocmVzb3VyY2UucmVzb3VyY2UsICFyZXNvdXJjZS5oaWRkZW4pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9sb2dnZXJzLnNldChyZXNvdXJjZS5yZXNvdXJjZSwgeyBpbmZvOiByZXNvdXJjZSwgbG9nZ2VyOiB1bmRlZmluZWQgfSk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxvZ2dlcnMuZmlyZSh7IGFkZGVkOiBbcmVzb3VyY2VdLCByZW1vdmVkOiBbXSB9KTtcblx0XHR9XG5cdH1cblxuXHRkZXJlZ2lzdGVyTG9nZ2VyKGlkT3JSZXNvdXJjZTogVVJJIHwgc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLnRvUmVzb3VyY2UoaWRPclJlc291cmNlKTtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX2xvZ2dlcnMuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdGlmIChleGlzdGluZy5sb2dnZXIpIHtcblx0XHRcdFx0ZXhpc3RpbmcubG9nZ2VyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2xvZ2dlcnMuZGVsZXRlKHJlc291cmNlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTG9nZ2Vycy5maXJlKHsgYWRkZWQ6IFtdLCByZW1vdmVkOiBbZXhpc3RpbmcuaW5mb10gfSk7XG5cdFx0fVxuXHR9XG5cblx0KmdldFJlZ2lzdGVyZWRMb2dnZXJzKCk6IEl0ZXJhYmxlPElMb2dnZXJSZXNvdXJjZT4ge1xuXHRcdGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5fbG9nZ2Vycy52YWx1ZXMoKSkge1xuXHRcdFx0eWllbGQgZW50cnkuaW5mbztcblx0XHR9XG5cdH1cblxuXHRnZXRSZWdpc3RlcmVkTG9nZ2VyKHJlc291cmNlOiBVUkkpOiBJTG9nZ2VyUmVzb3VyY2UgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9sb2dnZXJzLmdldChyZXNvdXJjZSk/LmluZm87XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2xvZ2dlcnMuZm9yRWFjaChsb2dnZXIgPT4gbG9nZ2VyLmxvZ2dlcj8uZGlzcG9zZSgpKTtcblx0XHR0aGlzLl9sb2dnZXJzLmNsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGRvQ3JlYXRlTG9nZ2VyKHJlc291cmNlOiBVUkksIGxvZ0xldmVsOiBMb2dMZXZlbCwgb3B0aW9ucz86IElMb2dnZXJPcHRpb25zKTogSUxvZ2dlcjtcbn1cblxuZXhwb3J0IGNsYXNzIE51bGxMb2dnZXIgaW1wbGVtZW50cyBJTG9nZ2VyIHtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VMb2dMZXZlbDogRXZlbnQ8TG9nTGV2ZWw+ID0gbmV3IEVtaXR0ZXI8TG9nTGV2ZWw+KCkuZXZlbnQ7XG5cdHNldExldmVsKGxldmVsOiBMb2dMZXZlbCk6IHZvaWQgeyB9XG5cdGdldExldmVsKCk6IExvZ0xldmVsIHsgcmV0dXJuIExvZ0xldmVsLkluZm87IH1cblx0dHJhY2UobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQgeyB9XG5cdGRlYnVnKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHsgfVxuXHRpbmZvKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHsgfVxuXHR3YXJuKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHsgfVxuXHRlcnJvcihtZXNzYWdlOiBzdHJpbmcgfCBFcnJvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHsgfVxuXHRjcml0aWNhbChtZXNzYWdlOiBzdHJpbmcgfCBFcnJvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHsgfVxuXHRkaXNwb3NlKCk6IHZvaWQgeyB9XG5cdGZsdXNoKCk6IHZvaWQgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBOdWxsTG9nU2VydmljZSBleHRlbmRzIE51bGxMb2dnZXIgaW1wbGVtZW50cyBJTG9nU2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9nTGV2ZWwoZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlKTogTG9nTGV2ZWwge1xuXHRpZiAoZW52aXJvbm1lbnRTZXJ2aWNlLnZlcmJvc2UpIHtcblx0XHRyZXR1cm4gTG9nTGV2ZWwuVHJhY2U7XG5cdH1cblx0aWYgKHR5cGVvZiBlbnZpcm9ubWVudFNlcnZpY2UubG9nTGV2ZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0Y29uc3QgbG9nTGV2ZWwgPSBwYXJzZUxvZ0xldmVsKGVudmlyb25tZW50U2VydmljZS5sb2dMZXZlbC50b0xvd2VyQ2FzZSgpKTtcblx0XHRpZiAobG9nTGV2ZWwgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGxvZ0xldmVsO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gREVGQVVMVF9MT0dfTEVWRUw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBMb2dMZXZlbFRvU3RyaW5nKGxvZ0xldmVsOiBMb2dMZXZlbCk6IHN0cmluZyB7XG5cdHN3aXRjaCAobG9nTGV2ZWwpIHtcblx0XHRjYXNlIExvZ0xldmVsLlRyYWNlOiByZXR1cm4gJ3RyYWNlJztcblx0XHRjYXNlIExvZ0xldmVsLkRlYnVnOiByZXR1cm4gJ2RlYnVnJztcblx0XHRjYXNlIExvZ0xldmVsLkluZm86IHJldHVybiAnaW5mbyc7XG5cdFx0Y2FzZSBMb2dMZXZlbC5XYXJuaW5nOiByZXR1cm4gJ3dhcm4nO1xuXHRcdGNhc2UgTG9nTGV2ZWwuRXJyb3I6IHJldHVybiAnZXJyb3InO1xuXHRcdGNhc2UgTG9nTGV2ZWwuT2ZmOiByZXR1cm4gJ29mZic7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIExvZ0xldmVsVG9Mb2NhbGl6ZWRTdHJpbmcobG9nTGV2ZWw6IExvZ0xldmVsKTogSUxvY2FsaXplZFN0cmluZyB7XG5cdHN3aXRjaCAobG9nTGV2ZWwpIHtcblx0XHRjYXNlIExvZ0xldmVsLlRyYWNlOiByZXR1cm4geyBvcmlnaW5hbDogJ1RyYWNlJywgdmFsdWU6IG5scy5sb2NhbGl6ZSgndHJhY2UnLCBcIlRyYWNlXCIpIH07XG5cdFx0Y2FzZSBMb2dMZXZlbC5EZWJ1ZzogcmV0dXJuIHsgb3JpZ2luYWw6ICdEZWJ1ZycsIHZhbHVlOiBubHMubG9jYWxpemUoJ2RlYnVnJywgXCJEZWJ1Z1wiKSB9O1xuXHRcdGNhc2UgTG9nTGV2ZWwuSW5mbzogcmV0dXJuIHsgb3JpZ2luYWw6ICdJbmZvJywgdmFsdWU6IG5scy5sb2NhbGl6ZSgnaW5mbycsIFwiSW5mb1wiKSB9O1xuXHRcdGNhc2UgTG9nTGV2ZWwuV2FybmluZzogcmV0dXJuIHsgb3JpZ2luYWw6ICdXYXJuaW5nJywgdmFsdWU6IG5scy5sb2NhbGl6ZSgnd2FybicsIFwiV2FybmluZ1wiKSB9O1xuXHRcdGNhc2UgTG9nTGV2ZWwuRXJyb3I6IHJldHVybiB7IG9yaWdpbmFsOiAnRXJyb3InLCB2YWx1ZTogbmxzLmxvY2FsaXplKCdlcnJvcicsIFwiRXJyb3JcIikgfTtcblx0XHRjYXNlIExvZ0xldmVsLk9mZjogcmV0dXJuIHsgb3JpZ2luYWw6ICdPZmYnLCB2YWx1ZTogbmxzLmxvY2FsaXplKCdvZmYnLCBcIk9mZlwiKSB9O1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUxvZ0xldmVsKGxvZ0xldmVsOiBzdHJpbmcpOiBMb2dMZXZlbCB8IHVuZGVmaW5lZCB7XG5cdHN3aXRjaCAobG9nTGV2ZWwpIHtcblx0XHRjYXNlICd0cmFjZSc6XG5cdFx0XHRyZXR1cm4gTG9nTGV2ZWwuVHJhY2U7XG5cdFx0Y2FzZSAnZGVidWcnOlxuXHRcdFx0cmV0dXJuIExvZ0xldmVsLkRlYnVnO1xuXHRcdGNhc2UgJ2luZm8nOlxuXHRcdFx0cmV0dXJuIExvZ0xldmVsLkluZm87XG5cdFx0Y2FzZSAnd2Fybic6XG5cdFx0XHRyZXR1cm4gTG9nTGV2ZWwuV2FybmluZztcblx0XHRjYXNlICdlcnJvcic6XG5cdFx0XHRyZXR1cm4gTG9nTGV2ZWwuRXJyb3I7XG5cdFx0Y2FzZSAnY3JpdGljYWwnOlxuXHRcdFx0cmV0dXJuIExvZ0xldmVsLkVycm9yO1xuXHRcdGNhc2UgJ29mZic6XG5cdFx0XHRyZXR1cm4gTG9nTGV2ZWwuT2ZmO1xuXHR9XG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8vIENvbnRleHRzXG5leHBvcnQgY29uc3QgQ09OVEVYVF9MT0dfTEVWRUwgPSBuZXcgUmF3Q29udGV4dEtleTxzdHJpbmc+KCdsb2dMZXZlbCcsIExvZ0xldmVsVG9TdHJpbmcoTG9nTGV2ZWwuSW5mbykpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBc0I7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V0FBTztBQUFBLEVBQ1I7QUFDQSxNQUFJLE9BQU8sbUJBQW1CLGFBQWEsVUFBVTtBQUNwRCxVQUFNLFdBQVcsY0FBYyxtQkFBbUIsU0FBUyxZQUFZLENBQUM7QUFDeEUsUUFBSSxhQUFhLFFBQVc7QUFDM0IsYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBQ0EsU0FBTztBQUNSO0FBRU8sU0FBUyxpQkFBaUIsVUFBNEI7QUFDNUQsVUFBUSxVQUFVO0FBQUEsSUFDakIsS0FBSztBQUFnQixhQUFPO0FBQUEsSUFDNUIsS0FBSztBQUFnQixhQUFPO0FBQUEsSUFDNUIsS0FBSztBQUFlLGFBQU87QUFBQSxJQUMzQixLQUFLO0FBQWtCLGFBQU87QUFBQSxJQUM5QixLQUFLO0FBQWdCLGFBQU87QUFBQSxJQUM1QixLQUFLO0FBQWMsYUFBTztBQUFBLEVBQzNCO0FBQ0Q7QUFFTyxTQUFTLDBCQUEwQixVQUFzQztBQUMvRSxVQUFRLFVBQVU7QUFBQSxJQUNqQixLQUFLO0FBQWdCLGFBQU8sRUFBRSxVQUFVLFNBQVMsT0FBTyxJQUFJLFNBQVMsU0FBUyxPQUFPLEVBQUU7QUFBQSxJQUN2RixLQUFLO0FBQWdCLGFBQU8sRUFBRSxVQUFVLFNBQVMsT0FBTyxJQUFJLFNBQVMsU0FBUyxPQUFPLEVBQUU7QUFBQSxJQUN2RixLQUFLO0FBQWUsYUFBTyxFQUFFLFVBQVUsUUFBUSxPQUFPLElBQUksU0FBUyxRQUFRLE1BQU0sRUFBRTtBQUFBLElBQ25GLEtBQUs7QUFBa0IsYUFBTyxFQUFFLFVBQVUsV0FBVyxPQUFPLElBQUksU0FBUyxRQUFRLFNBQVMsRUFBRTtBQUFBLElBQzVGLEtBQUs7QUFBZ0IsYUFBTyxFQUFFLFVBQVUsU0FBUyxPQUFPLElBQUksU0FBUyxTQUFTLE9BQU8sRUFBRTtBQUFBLElBQ3ZGLEtBQUs7QUFBYyxhQUFPLEVBQUUsVUFBVSxPQUFPLE9BQU8sSUFBSSxTQUFTLE9BQU8sS0FBSyxFQUFFO0FBQUEsRUFDaEY7QUFDRDtBQUVPLFNBQVMsY0FBYyxVQUF3QztBQUNyRSxVQUFRLFVBQVU7QUFBQSxJQUNqQixLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU87QUFBQSxJQUNSLEtBQUs7QUFDSixhQUFPO0FBQUEsSUFDUixLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU87QUFBQSxJQUNSLEtBQUs7QUFDSixhQUFPO0FBQUEsSUFDUixLQUFLO0FBQ0osYUFBTztBQUFBLEVBQ1Q7QUFDQSxTQUFPO0FBQ1I7QUFHTyxNQUFNLG9CQUFvQixJQUFJLGNBQXNCLFlBQVksaUJBQWlCLFlBQWEsQ0FBQzsiLAogICJuYW1lcyI6IFsiTG9nTGV2ZWwiXQp9Cg==
