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
import { IntervalTimer } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import * as errors from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import * as nls from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { RemoteAuthorityResolverErrorCode, getRemoteAuthorityPrefix } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { ExtHostCustomersRegistry } from "./extHostCustomers.js";
import { extensionHostKindToString } from "./extensionHostKind.js";
import { ActivationKind } from "./extensions.js";
import { RPCProtocol, RequestInitiator } from "./rpcProtocol.js";
const LOG_EXTENSION_HOST_COMMUNICATION = false;
const LOG_USE_COLORS = true;
let ExtensionHostManager = class extends Disposable {
  constructor(extensionHost, initialActivationEvents, _internalExtensionService, _instantiationService, _environmentService, _telemetryService, _logService) {
    super();
    this._internalExtensionService = _internalExtensionService;
    this._instantiationService = _instantiationService;
    this._environmentService = _environmentService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._onDidChangeResponsiveState = this._register(new Emitter());
    this.onDidChangeResponsiveState = this._onDidChangeResponsiveState.event;
    this._hasStarted = false;
    this._cachedActivationEvents = /* @__PURE__ */ new Map();
    this._resolvedActivationEvents = /* @__PURE__ */ new Set();
    this._rpcProtocol = null;
    this._customers = [];
    this._extensionHost = extensionHost;
    this.onDidExit = this._extensionHost.onExit;
    const startingTelemetryEvent = {
      time: Date.now(),
      action: "starting",
      kind: extensionHostKindToString(this.kind)
    };
    this._telemetryService.publicLog2("extensionHostStartup", startingTelemetryEvent);
    this._proxy = this._extensionHost.start().then(
      (protocol) => {
        this._hasStarted = true;
        const successTelemetryEvent = {
          time: Date.now(),
          action: "success",
          kind: extensionHostKindToString(this.kind)
        };
        this._telemetryService.publicLog2("extensionHostStartup", successTelemetryEvent);
        return this._createExtensionHostCustomers(this.kind, protocol);
      },
      (err) => {
        this._logService.error(`Error received from starting extension host (kind: ${extensionHostKindToString(this.kind)})`);
        this._logService.error(err);
        const failureTelemetryEvent = {
          time: Date.now(),
          action: "error",
          kind: extensionHostKindToString(this.kind)
        };
        if (err && err.name) {
          failureTelemetryEvent.errorName = err.name;
        }
        if (err && err.message) {
          failureTelemetryEvent.errorMessage = err.message;
        }
        if (err && err.stack) {
          failureTelemetryEvent.errorStack = err.stack;
        }
        this._telemetryService.publicLog2("extensionHostStartup", failureTelemetryEvent);
        return null;
      }
    );
    this._proxy.then(() => {
      initialActivationEvents.forEach((activationEvent) => this.activateByEvent(activationEvent, ActivationKind.Normal));
      this._register(registerLatencyTestProvider({
        measure: () => this.measure()
      }));
    });
  }
  get pid() {
    return this._extensionHost.pid;
  }
  get kind() {
    return this._extensionHost.runningLocation.kind;
  }
  get startup() {
    return this._extensionHost.startup;
  }
  get friendyName() {
    return friendlyExtHostName(this.kind, this.pid);
  }
  async disconnect() {
    await this._extensionHost?.disconnect?.();
  }
  dispose() {
    this._extensionHost?.dispose();
    this._rpcProtocol?.dispose();
    for (let i = 0, len = this._customers.length; i < len; i++) {
      const customer = this._customers[i];
      try {
        customer.dispose();
      } catch (err) {
        errors.onUnexpectedError(err);
      }
    }
    this._proxy = null;
    super.dispose();
  }
  async measure() {
    const proxy = await this._proxy;
    if (!proxy) {
      return null;
    }
    const latency = await this._measureLatency(proxy);
    const down = await this._measureDown(proxy);
    const up = await this._measureUp(proxy);
    return {
      remoteAuthority: this._extensionHost.remoteAuthority,
      latency,
      down,
      up
    };
  }
  async ready() {
    await this._proxy;
  }
  async _measureLatency(proxy) {
    const COUNT = 10;
    let sum = 0;
    for (let i = 0; i < COUNT; i++) {
      const sw = StopWatch.create();
      await proxy.test_latency(i);
      sw.stop();
      sum += sw.elapsed();
    }
    return sum / COUNT;
  }
  static _convert(byteCount, elapsedMillis) {
    return byteCount * 1e3 * 8 / elapsedMillis;
  }
  async _measureUp(proxy) {
    const SIZE = 10 * 1024 * 1024;
    const buff = VSBuffer.alloc(SIZE);
    const value = Math.ceil(Math.random() * 256);
    for (let i = 0; i < buff.byteLength; i++) {
      buff.writeUInt8(i, value);
    }
    const sw = StopWatch.create();
    await proxy.test_up(buff);
    sw.stop();
    return ExtensionHostManager._convert(SIZE, sw.elapsed());
  }
  async _measureDown(proxy) {
    const SIZE = 10 * 1024 * 1024;
    const sw = StopWatch.create();
    await proxy.test_down(SIZE);
    sw.stop();
    return ExtensionHostManager._convert(SIZE, sw.elapsed());
  }
  _createExtensionHostCustomers(kind, protocol) {
    let logger = null;
    if (LOG_EXTENSION_HOST_COMMUNICATION || this._environmentService.logExtensionHostCommunication) {
      logger = new RPCLogger(kind);
    } else if (TelemetryRPCLogger.isEnabled()) {
      logger = new TelemetryRPCLogger(this._telemetryService);
    }
    this._rpcProtocol = new RPCProtocol(protocol, logger);
    this._register(this._rpcProtocol.onDidChangeResponsiveState((responsiveState) => this._onDidChangeResponsiveState.fire(responsiveState)));
    let extensionHostProxy = null;
    let mainProxyIdentifiers = [];
    const extHostContext = {
      remoteAuthority: this._extensionHost.remoteAuthority,
      extensionHostKind: this.kind,
      getProxy: (identifier) => this._rpcProtocol.getProxy(identifier),
      set: (identifier, instance) => this._rpcProtocol.set(identifier, instance),
      dispose: () => this._rpcProtocol.dispose(),
      assertRegistered: (identifiers) => this._rpcProtocol.assertRegistered(identifiers),
      drain: () => this._rpcProtocol.drain(),
      //#region internal
      internalExtensionService: this._internalExtensionService,
      _setExtensionHostProxy: (value) => {
        extensionHostProxy = value;
      },
      _setAllMainProxyIdentifiers: (value) => {
        mainProxyIdentifiers = value;
      }
      //#endregion
    };
    const namedCustomers = ExtHostCustomersRegistry.getNamedCustomers();
    for (let i = 0, len = namedCustomers.length; i < len; i++) {
      const [id, ctor] = namedCustomers[i];
      try {
        const instance = this._instantiationService.createInstance(ctor, extHostContext);
        this._customers.push(instance);
        this._rpcProtocol.set(id, instance);
      } catch (err) {
        this._logService.error(`Cannot instantiate named customer: '${id.sid}'`);
        this._logService.error(err);
        errors.onUnexpectedError(err);
      }
    }
    const customers = ExtHostCustomersRegistry.getCustomers();
    for (const ctor of customers) {
      try {
        const instance = this._instantiationService.createInstance(ctor, extHostContext);
        this._customers.push(instance);
      } catch (err) {
        this._logService.error(err);
        errors.onUnexpectedError(err);
      }
    }
    if (!extensionHostProxy) {
      throw new Error(`Missing IExtensionHostProxy!`);
    }
    this._rpcProtocol.assertRegistered(mainProxyIdentifiers);
    return extensionHostProxy;
  }
  async activate(extension, reason) {
    const proxy = await this._proxy;
    if (!proxy) {
      return false;
    }
    return proxy.activate(extension, reason);
  }
  activateByEvent(activationEvent, activationKind) {
    if (activationKind === ActivationKind.Immediate && !this._hasStarted) {
      return Promise.resolve();
    }
    if (!this._cachedActivationEvents.has(activationEvent)) {
      this._cachedActivationEvents.set(activationEvent, this._activateByEvent(activationEvent, activationKind));
    }
    return this._cachedActivationEvents.get(activationEvent);
  }
  activationEventIsDone(activationEvent) {
    return this._resolvedActivationEvents.has(activationEvent);
  }
  async _activateByEvent(activationEvent, activationKind) {
    if (!this._proxy) {
      return;
    }
    const proxy = await this._proxy;
    if (!proxy) {
      return;
    }
    if (!this._extensionHost.extensions.containsActivationEvent(activationEvent)) {
      this._resolvedActivationEvents.add(activationEvent);
      return;
    }
    await proxy.activateByEvent(activationEvent, activationKind);
    this._resolvedActivationEvents.add(activationEvent);
  }
  async getInspectPort(tryEnableInspector) {
    if (this._extensionHost) {
      if (tryEnableInspector) {
        await this._extensionHost.enableInspectPort();
      }
      const port = this._extensionHost.getInspectPort();
      if (port) {
        return port;
      }
    }
    return void 0;
  }
  async resolveAuthority(remoteAuthority, resolveAttempt) {
    const sw = StopWatch.create(false);
    const prefix = () => `[${extensionHostKindToString(this._extensionHost.runningLocation.kind)}${this._extensionHost.runningLocation.affinity}][resolveAuthority(${getRemoteAuthorityPrefix(remoteAuthority)},${resolveAttempt})][${sw.elapsed()}ms] `;
    const logInfo = (msg) => this._logService.info(`${prefix()}${msg}`);
    const logError = (msg, err = void 0) => this._logService.error(`${prefix()}${msg}`, err);
    logInfo(`obtaining proxy...`);
    const proxy = await this._proxy;
    if (!proxy) {
      logError(`no proxy`);
      return {
        type: "error",
        error: {
          message: `Cannot resolve authority`,
          code: RemoteAuthorityResolverErrorCode.Unknown,
          detail: void 0
        }
      };
    }
    logInfo(`invoking...`);
    const intervalLogger = new IntervalTimer();
    try {
      intervalLogger.cancelAndSet(() => logInfo("waiting..."), 1e3);
      const resolverResult = await proxy.resolveAuthority(remoteAuthority, resolveAttempt);
      intervalLogger.dispose();
      if (resolverResult.type === "ok") {
        logInfo(`returned ${resolverResult.value.authority.connectTo}`);
      } else {
        logError(`returned an error`, resolverResult.error);
      }
      return resolverResult;
    } catch (err) {
      intervalLogger.dispose();
      logError(`returned an error`, err);
      return {
        type: "error",
        error: {
          message: err.message,
          code: RemoteAuthorityResolverErrorCode.Unknown,
          detail: err
        }
      };
    }
  }
  async getCanonicalURI(remoteAuthority, uri) {
    const proxy = await this._proxy;
    if (!proxy) {
      throw new Error(`Cannot resolve canonical URI`);
    }
    return proxy.getCanonicalURI(remoteAuthority, uri);
  }
  async start(extensionRegistryVersionId, allExtensions, myExtensions) {
    const proxy = await this._proxy;
    if (!proxy) {
      return;
    }
    const deltaExtensions = this._extensionHost.extensions.set(extensionRegistryVersionId, allExtensions, myExtensions);
    return proxy.startExtensionHost(deltaExtensions);
  }
  async extensionTestsExecute() {
    const proxy = await this._proxy;
    if (!proxy) {
      throw new Error("Could not obtain Extension Host Proxy");
    }
    return proxy.extensionTestsExecute();
  }
  representsRunningLocation(runningLocation) {
    return this._extensionHost.runningLocation.equals(runningLocation);
  }
  async deltaExtensions(incomingExtensionsDelta) {
    const proxy = await this._proxy;
    if (!proxy) {
      return;
    }
    const outgoingExtensionsDelta = this._extensionHost.extensions.delta(incomingExtensionsDelta);
    if (!outgoingExtensionsDelta) {
      return;
    }
    return proxy.deltaExtensions(outgoingExtensionsDelta);
  }
  containsExtension(extensionId) {
    return this._extensionHost.extensions?.containsExtension(extensionId) ?? false;
  }
  async setRemoteEnvironment(env) {
    const proxy = await this._proxy;
    if (!proxy) {
      return;
    }
    return proxy.setRemoteEnvironment(env);
  }
};
ExtensionHostManager = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, ILogService)
], ExtensionHostManager);
function friendlyExtHostName(kind, pid) {
  if (pid) {
    return `${extensionHostKindToString(kind)} pid: ${pid}`;
  }
  return `${extensionHostKindToString(kind)}`;
}
const colorTables = [
  ["#2977B1", "#FC802D", "#34A13A", "#D3282F", "#9366BA"],
  ["#8B564C", "#E177C0", "#7F7F7F", "#BBBE3D", "#2EBECD"]
];
function prettyWithoutArrays(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object" && typeof data.toString === "function") {
    const result = data.toString();
    if (result !== "[object Object]") {
      return result;
    }
  }
  return data;
}
function pretty(data) {
  if (Array.isArray(data)) {
    return data.map(prettyWithoutArrays);
  }
  return prettyWithoutArrays(data);
}
class RPCLogger {
  constructor(_kind) {
    this._kind = _kind;
    this._totalIncoming = 0;
    this._totalOutgoing = 0;
  }
  _log(direction, totalLength, msgLength, req, initiator, str, data) {
    data = pretty(data);
    const colorTable = colorTables[initiator];
    const color = LOG_USE_COLORS ? colorTable[req % colorTable.length] : "#000000";
    let args = [`%c[${extensionHostKindToString(this._kind)}][${direction}]%c[${String(totalLength).padStart(7)}]%c[len: ${String(msgLength).padStart(5)}]%c${String(req).padStart(5)} - ${str}`, "color: darkgreen", "color: grey", "color: grey", `color: ${color}`];
    if (/\($/.test(str)) {
      args = args.concat(data);
      args.push(")");
    } else {
      args.push(data);
    }
    console.log.apply(console, args);
  }
  logIncoming(msgLength, req, initiator, str, data) {
    this._totalIncoming += msgLength;
    this._log("Ext \u2192 Win", this._totalIncoming, msgLength, req, initiator, str, data);
  }
  logOutgoing(msgLength, req, initiator, str, data) {
    this._totalOutgoing += msgLength;
    this._log("Win \u2192 Ext", this._totalOutgoing, msgLength, req, initiator, str, data);
  }
}
let TelemetryRPCLogger = class {
  constructor(_telemetryService) {
    this._telemetryService = _telemetryService;
    this._pendingRequests = /* @__PURE__ */ new Map();
  }
  static isEnabled() {
    return Math.random() < 1e-4;
  }
  logIncoming(msgLength, req, initiator, str) {
    if (initiator === RequestInitiator.LocalSide && /^receiveReply(Err)?:/.test(str)) {
      const requestStr = this._pendingRequests.get(req) ?? "unknown_reply";
      this._pendingRequests.delete(req);
      this._telemetryService.publicLog2("extensionhost.incoming", {
        type: `${str} ${requestStr}`,
        length: msgLength
      });
    }
    if (initiator === RequestInitiator.OtherSide && /^receiveRequest /.test(str)) {
      this._telemetryService.publicLog2("extensionhost.incoming", {
        type: `${str}`,
        length: msgLength
      });
    }
  }
  logOutgoing(msgLength, req, initiator, str) {
    if (initiator === RequestInitiator.LocalSide && str.startsWith("request: ")) {
      this._pendingRequests.set(req, str);
      this._telemetryService.publicLog2("extensionhost.outgoing", {
        type: str,
        length: msgLength
      });
    }
  }
};
TelemetryRPCLogger = __decorateClass([
  __decorateParam(0, ITelemetryService)
], TelemetryRPCLogger);
const providers = [];
function registerLatencyTestProvider(provider) {
  providers.push(provider);
  return {
    dispose: () => {
      for (let i = 0; i < providers.length; i++) {
        if (providers[i] === provider) {
          providers.splice(i, 1);
          return;
        }
      }
    }
  };
}
function getLatencyTestProviders() {
  return providers.slice(0);
}
registerAction2(class MeasureExtHostLatencyAction extends Action2 {
  constructor() {
    super({
      id: "editor.action.measureExtHostLatency",
      title: nls.localize2("measureExtHostLatency", "Measure Extension Host Latency"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const measurements = await Promise.all(getLatencyTestProviders().map((provider) => provider.measure()));
    editorService.openEditor({ resource: void 0, contents: measurements.map(MeasureExtHostLatencyAction._print).join("\n\n"), options: { pinned: true } });
  }
  static _print(m) {
    if (!m) {
      return "";
    }
    return `${m.remoteAuthority ? `Authority: ${m.remoteAuthority}
` : ``}Roundtrip latency: ${m.latency.toFixed(3)}ms
Up: ${MeasureExtHostLatencyAction._printSpeed(m.up)}
Down: ${MeasureExtHostLatencyAction._printSpeed(m.down)}
`;
  }
  static _printSpeed(n) {
    if (n <= 1024) {
      return `${n} bps`;
    }
    if (n < 1024 * 1024) {
      return `${(n / 1024).toFixed(1)} kbps`;
    }
    return `${(n / 1024 / 1024).toFixed(1)} Mbps`;
  }
});
export {
  ExtensionHostManager,
  friendlyExtHostName
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uSG9zdE1hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJbnRlcnZhbFRpbWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0ICogYXMgZXJyb3JzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3JDb2RlLCBnZXRSZW1vdGVBdXRob3JpdHlQcmVmaXggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUF1dGhvcml0eVJlc29sdmVyLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0SG9zdEN1c3RvbWVyc1JlZ2lzdHJ5LCBJSW50ZXJuYWxFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25Ib3N0S2luZCwgZXh0ZW5zaW9uSG9zdEtpbmRUb1N0cmluZyB9IGZyb20gJy4vZXh0ZW5zaW9uSG9zdEtpbmQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkhvc3RNYW5hZ2VyIH0gZnJvbSAnLi9leHRlbnNpb25Ib3N0TWFuYWdlcnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uRGVsdGEgfSBmcm9tICcuL2V4dGVuc2lvbkhvc3RQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSG9zdFByb3h5LCBJUmVzb2x2ZUF1dGhvcml0eVJlc3VsdCB9IGZyb20gJy4vZXh0ZW5zaW9uSG9zdFByb3h5LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvbiB9IGZyb20gJy4vZXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uLmpzJztcbmltcG9ydCB7IEFjdGl2YXRpb25LaW5kLCBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uLCBFeHRlbnNpb25Ib3N0U3RhcnR1cCwgSUV4dGVuc2lvbkhvc3QsIElJbnRlcm5hbEV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUHJveGllZCwgUHJveHlJZGVudGlmaWVyIH0gZnJvbSAnLi9wcm94eUlkZW50aWZpZXIuanMnO1xuaW1wb3J0IHsgSVJQQ1Byb3RvY29sTG9nZ2VyLCBSUENQcm90b2NvbCwgUmVxdWVzdEluaXRpYXRvciwgUmVzcG9uc2l2ZVN0YXRlIH0gZnJvbSAnLi9ycGNQcm90b2NvbC5qcyc7XG5cbi8vIEVuYWJsZSB0byBzZWUgZGV0YWlsZWQgbWVzc2FnZSBjb21tdW5pY2F0aW9uIGJldHdlZW4gd2luZG93IGFuZCBleHRlbnNpb24gaG9zdFxuY29uc3QgTE9HX0VYVEVOU0lPTl9IT1NUX0NPTU1VTklDQVRJT04gPSBmYWxzZTtcbmNvbnN0IExPR19VU0VfQ09MT1JTID0gdHJ1ZTtcblxudHlwZSBFeHRlbnNpb25Ib3N0U3RhcnR1cENsYXNzaWZpY2F0aW9uID0ge1xuXHRvd25lcjogJ2FsZXhkaW1hJztcblx0Y29tbWVudDogJ1RoZSBzdGFydHVwIHN0YXRlIG9mIHRoZSBleHRlbnNpb24gaG9zdCc7XG5cdHRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdGltZSByZXBvcnRlZCBieSBEYXRlLm5vdygpLicgfTtcblx0YWN0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGFjdGlvbjogc3RhcnRpbmcsIHN1Y2Nlc3Mgb3IgZXJyb3IuJyB9O1xuXHRraW5kOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiBob3N0IGtpbmQ6IExvY2FsUHJvY2VzcywgTG9jYWxXZWJXb3JrZXIgb3IgUmVtb3RlLicgfTtcblx0ZXJyb3JOYW1lPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBlcnJvciBuYW1lLicgfTtcblx0ZXJyb3JNZXNzYWdlPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBlcnJvciBtZXNzYWdlLicgfTtcblx0ZXJyb3JTdGFjaz86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgZXJyb3Igc3RhY2suJyB9O1xufTtcblxudHlwZSBFeHRlbnNpb25Ib3N0U3RhcnR1cEV2ZW50ID0ge1xuXHR0aW1lOiBudW1iZXI7XG5cdGFjdGlvbjogJ3N0YXJ0aW5nJyB8ICdzdWNjZXNzJyB8ICdlcnJvcic7XG5cdGtpbmQ6IHN0cmluZztcblx0ZXJyb3JOYW1lPzogc3RyaW5nO1xuXHRlcnJvck1lc3NhZ2U/OiBzdHJpbmc7XG5cdGVycm9yU3RhY2s/OiBzdHJpbmc7XG59O1xuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uSG9zdE1hbmFnZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUV4dGVuc2lvbkhvc3RNYW5hZ2VyIHtcblxuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRFeGl0OiBFdmVudDxbbnVtYmVyLCBzdHJpbmcgfCBudWxsXT47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VSZXNwb25zaXZlU3RhdGU6IEVtaXR0ZXI8UmVzcG9uc2l2ZVN0YXRlPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFJlc3BvbnNpdmVTdGF0ZT4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVJlc3BvbnNpdmVTdGF0ZTogRXZlbnQ8UmVzcG9uc2l2ZVN0YXRlPiA9IHRoaXMuX29uRGlkQ2hhbmdlUmVzcG9uc2l2ZVN0YXRlLmV2ZW50O1xuXG5cdC8qKlxuXHQgKiBBIG1hcCBvZiBhbHJlYWR5IHJlcXVlc3RlZCBhY3RpdmF0aW9uIGV2ZW50cyB0byBzcGVlZCB0aGluZ3MgdXAgaWYgdGhlIHNhbWUgYWN0aXZhdGlvbiBldmVudCBpcyB0cmlnZ2VyZWQgbXVsdGlwbGUgdGltZXMuXG5cdCAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jYWNoZWRBY3RpdmF0aW9uRXZlbnRzOiBNYXA8c3RyaW5nLCBQcm9taXNlPHZvaWQ+Pjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVzb2x2ZWRBY3RpdmF0aW9uRXZlbnRzOiBTZXQ8c3RyaW5nPjtcblx0cHJpdmF0ZSBfcnBjUHJvdG9jb2w6IFJQQ1Byb3RvY29sIHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfY3VzdG9tZXJzOiBJRGlzcG9zYWJsZVtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25Ib3N0OiBJRXh0ZW5zaW9uSG9zdDtcblx0cHJpdmF0ZSBfcHJveHk6IFByb21pc2U8SUV4dGVuc2lvbkhvc3RQcm94eSB8IG51bGw+IHwgbnVsbDtcblx0cHJpdmF0ZSBfaGFzU3RhcnRlZCA9IGZhbHNlO1xuXG5cdHB1YmxpYyBnZXQgcGlkKCk6IG51bWJlciB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0LnBpZDtcblx0fVxuXG5cdHB1YmxpYyBnZXQga2luZCgpOiBFeHRlbnNpb25Ib3N0S2luZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2V4dGVuc2lvbkhvc3QucnVubmluZ0xvY2F0aW9uLmtpbmQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHN0YXJ0dXAoKTogRXh0ZW5zaW9uSG9zdFN0YXJ0dXAge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0LnN0YXJ0dXA7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGZyaWVuZHlOYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGZyaWVuZGx5RXh0SG9zdE5hbWUodGhpcy5raW5kLCB0aGlzLnBpZCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRlbnNpb25Ib3N0OiBJRXh0ZW5zaW9uSG9zdCxcblx0XHRpbml0aWFsQWN0aXZhdGlvbkV2ZW50czogc3RyaW5nW10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW50ZXJuYWxFeHRlbnNpb25TZXJ2aWNlOiBJSW50ZXJuYWxFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9jYWNoZWRBY3RpdmF0aW9uRXZlbnRzID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8dm9pZD4+KCk7XG5cdFx0dGhpcy5fcmVzb2x2ZWRBY3RpdmF0aW9uRXZlbnRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0dGhpcy5fcnBjUHJvdG9jb2wgPSBudWxsO1xuXHRcdHRoaXMuX2N1c3RvbWVycyA9IFtdO1xuXG5cdFx0dGhpcy5fZXh0ZW5zaW9uSG9zdCA9IGV4dGVuc2lvbkhvc3Q7XG5cdFx0dGhpcy5vbkRpZEV4aXQgPSB0aGlzLl9leHRlbnNpb25Ib3N0Lm9uRXhpdDtcblxuXHRcdGNvbnN0IHN0YXJ0aW5nVGVsZW1ldHJ5RXZlbnQ6IEV4dGVuc2lvbkhvc3RTdGFydHVwRXZlbnQgPSB7XG5cdFx0XHR0aW1lOiBEYXRlLm5vdygpLFxuXHRcdFx0YWN0aW9uOiAnc3RhcnRpbmcnLFxuXHRcdFx0a2luZDogZXh0ZW5zaW9uSG9zdEtpbmRUb1N0cmluZyh0aGlzLmtpbmQpXG5cdFx0fTtcblx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RXh0ZW5zaW9uSG9zdFN0YXJ0dXBFdmVudCwgRXh0ZW5zaW9uSG9zdFN0YXJ0dXBDbGFzc2lmaWNhdGlvbj4oJ2V4dGVuc2lvbkhvc3RTdGFydHVwJywgc3RhcnRpbmdUZWxlbWV0cnlFdmVudCk7XG5cblx0XHR0aGlzLl9wcm94eSA9IHRoaXMuX2V4dGVuc2lvbkhvc3Quc3RhcnQoKS50aGVuKFxuXHRcdFx0KHByb3RvY29sKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2hhc1N0YXJ0ZWQgPSB0cnVlO1xuXG5cdFx0XHRcdC8vIFRyYWNrIGhlYWx0aHkgZXh0ZW5zaW9uIGhvc3Qgc3RhcnR1cFxuXHRcdFx0XHRjb25zdCBzdWNjZXNzVGVsZW1ldHJ5RXZlbnQ6IEV4dGVuc2lvbkhvc3RTdGFydHVwRXZlbnQgPSB7XG5cdFx0XHRcdFx0dGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0XHRhY3Rpb246ICdzdWNjZXNzJyxcblx0XHRcdFx0XHRraW5kOiBleHRlbnNpb25Ib3N0S2luZFRvU3RyaW5nKHRoaXMua2luZClcblx0XHRcdFx0fTtcblx0XHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEV4dGVuc2lvbkhvc3RTdGFydHVwRXZlbnQsIEV4dGVuc2lvbkhvc3RTdGFydHVwQ2xhc3NpZmljYXRpb24+KCdleHRlbnNpb25Ib3N0U3RhcnR1cCcsIHN1Y2Nlc3NUZWxlbWV0cnlFdmVudCk7XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZUV4dGVuc2lvbkhvc3RDdXN0b21lcnModGhpcy5raW5kLCBwcm90b2NvbCk7XG5cdFx0XHR9LFxuXHRcdFx0KGVycikgPT4ge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBFcnJvciByZWNlaXZlZCBmcm9tIHN0YXJ0aW5nIGV4dGVuc2lvbiBob3N0IChraW5kOiAke2V4dGVuc2lvbkhvc3RLaW5kVG9TdHJpbmcodGhpcy5raW5kKX0pYCk7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblxuXHRcdFx0XHQvLyBUcmFjayBlcnJvcnMgZHVyaW5nIGV4dGVuc2lvbiBob3N0IHN0YXJ0dXBcblx0XHRcdFx0Y29uc3QgZmFpbHVyZVRlbGVtZXRyeUV2ZW50OiBFeHRlbnNpb25Ib3N0U3RhcnR1cEV2ZW50ID0ge1xuXHRcdFx0XHRcdHRpbWU6IERhdGUubm93KCksXG5cdFx0XHRcdFx0YWN0aW9uOiAnZXJyb3InLFxuXHRcdFx0XHRcdGtpbmQ6IGV4dGVuc2lvbkhvc3RLaW5kVG9TdHJpbmcodGhpcy5raW5kKVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGlmIChlcnIgJiYgZXJyLm5hbWUpIHtcblx0XHRcdFx0XHRmYWlsdXJlVGVsZW1ldHJ5RXZlbnQuZXJyb3JOYW1lID0gZXJyLm5hbWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGVyciAmJiBlcnIubWVzc2FnZSkge1xuXHRcdFx0XHRcdGZhaWx1cmVUZWxlbWV0cnlFdmVudC5lcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXJyICYmIGVyci5zdGFjaykge1xuXHRcdFx0XHRcdGZhaWx1cmVUZWxlbWV0cnlFdmVudC5lcnJvclN0YWNrID0gZXJyLnN0YWNrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxFeHRlbnNpb25Ib3N0U3RhcnR1cEV2ZW50LCBFeHRlbnNpb25Ib3N0U3RhcnR1cENsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uSG9zdFN0YXJ0dXAnLCBmYWlsdXJlVGVsZW1ldHJ5RXZlbnQpO1xuXG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdCk7XG5cdFx0dGhpcy5fcHJveHkudGhlbigoKSA9PiB7XG5cdFx0XHRpbml0aWFsQWN0aXZhdGlvbkV2ZW50cy5mb3JFYWNoKChhY3RpdmF0aW9uRXZlbnQpID0+IHRoaXMuYWN0aXZhdGVCeUV2ZW50KGFjdGl2YXRpb25FdmVudCwgQWN0aXZhdGlvbktpbmQuTm9ybWFsKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckxhdGVuY3lUZXN0UHJvdmlkZXIoe1xuXHRcdFx0XHRtZWFzdXJlOiAoKSA9PiB0aGlzLm1lYXN1cmUoKVxuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGRpc2Nvbm5lY3QoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uSG9zdD8uZGlzY29ubmVjdD8uKCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9leHRlbnNpb25Ib3N0Py5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcnBjUHJvdG9jb2w/LmRpc3Bvc2UoKTtcblxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9jdXN0b21lcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGN1c3RvbWVyID0gdGhpcy5fY3VzdG9tZXJzW2ldO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y3VzdG9tZXIuZGlzcG9zZSgpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGVycm9ycy5vblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9wcm94eSA9IG51bGw7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG1lYXN1cmUoKTogUHJvbWlzZTxFeHRIb3N0TGF0ZW5jeVJlc3VsdCB8IG51bGw+IHtcblx0XHRjb25zdCBwcm94eSA9IGF3YWl0IHRoaXMuX3Byb3h5O1xuXHRcdGlmICghcHJveHkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBsYXRlbmN5ID0gYXdhaXQgdGhpcy5fbWVhc3VyZUxhdGVuY3kocHJveHkpO1xuXHRcdGNvbnN0IGRvd24gPSBhd2FpdCB0aGlzLl9tZWFzdXJlRG93bihwcm94eSk7XG5cdFx0Y29uc3QgdXAgPSBhd2FpdCB0aGlzLl9tZWFzdXJlVXAocHJveHkpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IHRoaXMuX2V4dGVuc2lvbkhvc3QucmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0bGF0ZW5jeSxcblx0XHRcdGRvd24sXG5cdFx0XHR1cFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcHJveHk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9tZWFzdXJlTGF0ZW5jeShwcm94eTogSUV4dGVuc2lvbkhvc3RQcm94eSk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0Y29uc3QgQ09VTlQgPSAxMDtcblxuXHRcdGxldCBzdW0gPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgQ09VTlQ7IGkrKykge1xuXHRcdFx0Y29uc3Qgc3cgPSBTdG9wV2F0Y2guY3JlYXRlKCk7XG5cdFx0XHRhd2FpdCBwcm94eS50ZXN0X2xhdGVuY3koaSk7XG5cdFx0XHRzdy5zdG9wKCk7XG5cdFx0XHRzdW0gKz0gc3cuZWxhcHNlZCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gKHN1bSAvIENPVU5UKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jb252ZXJ0KGJ5dGVDb3VudDogbnVtYmVyLCBlbGFwc2VkTWlsbGlzOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiAoYnl0ZUNvdW50ICogMTAwMCAqIDgpIC8gZWxhcHNlZE1pbGxpcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX21lYXN1cmVVcChwcm94eTogSUV4dGVuc2lvbkhvc3RQcm94eSk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0Y29uc3QgU0laRSA9IDEwICogMTAyNCAqIDEwMjQ7IC8vIDEwTUJcblxuXHRcdGNvbnN0IGJ1ZmYgPSBWU0J1ZmZlci5hbGxvYyhTSVpFKTtcblx0XHRjb25zdCB2YWx1ZSA9IE1hdGguY2VpbChNYXRoLnJhbmRvbSgpICogMjU2KTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmYuYnl0ZUxlbmd0aDsgaSsrKSB7XG5cdFx0XHRidWZmLndyaXRlVUludDgoaSwgdmFsdWUpO1xuXHRcdH1cblx0XHRjb25zdCBzdyA9IFN0b3BXYXRjaC5jcmVhdGUoKTtcblx0XHRhd2FpdCBwcm94eS50ZXN0X3VwKGJ1ZmYpO1xuXHRcdHN3LnN0b3AoKTtcblx0XHRyZXR1cm4gRXh0ZW5zaW9uSG9zdE1hbmFnZXIuX2NvbnZlcnQoU0laRSwgc3cuZWxhcHNlZCgpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX21lYXN1cmVEb3duKHByb3h5OiBJRXh0ZW5zaW9uSG9zdFByb3h5KTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRjb25zdCBTSVpFID0gMTAgKiAxMDI0ICogMTAyNDsgLy8gMTBNQlxuXG5cdFx0Y29uc3Qgc3cgPSBTdG9wV2F0Y2guY3JlYXRlKCk7XG5cdFx0YXdhaXQgcHJveHkudGVzdF9kb3duKFNJWkUpO1xuXHRcdHN3LnN0b3AoKTtcblx0XHRyZXR1cm4gRXh0ZW5zaW9uSG9zdE1hbmFnZXIuX2NvbnZlcnQoU0laRSwgc3cuZWxhcHNlZCgpKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUV4dGVuc2lvbkhvc3RDdXN0b21lcnMoa2luZDogRXh0ZW5zaW9uSG9zdEtpbmQsIHByb3RvY29sOiBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCk6IElFeHRlbnNpb25Ib3N0UHJveHkge1xuXG5cdFx0bGV0IGxvZ2dlcjogSVJQQ1Byb3RvY29sTG9nZ2VyIHwgbnVsbCA9IG51bGw7XG5cdFx0aWYgKExPR19FWFRFTlNJT05fSE9TVF9DT01NVU5JQ0FUSU9OIHx8IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5sb2dFeHRlbnNpb25Ib3N0Q29tbXVuaWNhdGlvbikge1xuXHRcdFx0bG9nZ2VyID0gbmV3IFJQQ0xvZ2dlcihraW5kKTtcblx0XHR9IGVsc2UgaWYgKFRlbGVtZXRyeVJQQ0xvZ2dlci5pc0VuYWJsZWQoKSkge1xuXHRcdFx0bG9nZ2VyID0gbmV3IFRlbGVtZXRyeVJQQ0xvZ2dlcih0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9ycGNQcm90b2NvbCA9IG5ldyBSUENQcm90b2NvbChwcm90b2NvbCwgbG9nZ2VyKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ycGNQcm90b2NvbC5vbkRpZENoYW5nZVJlc3BvbnNpdmVTdGF0ZSgocmVzcG9uc2l2ZVN0YXRlOiBSZXNwb25zaXZlU3RhdGUpID0+IHRoaXMuX29uRGlkQ2hhbmdlUmVzcG9uc2l2ZVN0YXRlLmZpcmUocmVzcG9uc2l2ZVN0YXRlKSkpO1xuXHRcdGxldCBleHRlbnNpb25Ib3N0UHJveHk6IElFeHRlbnNpb25Ib3N0UHJveHkgfCBudWxsID0gbnVsbCBhcyBJRXh0ZW5zaW9uSG9zdFByb3h5IHwgbnVsbDtcblx0XHRsZXQgbWFpblByb3h5SWRlbnRpZmllcnM6IFByb3h5SWRlbnRpZmllcjxhbnk+W10gPSBbXTtcblx0XHRjb25zdCBleHRIb3N0Q29udGV4dDogSUludGVybmFsRXh0SG9zdENvbnRleHQgPSB7XG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IHRoaXMuX2V4dGVuc2lvbkhvc3QucmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0ZXh0ZW5zaW9uSG9zdEtpbmQ6IHRoaXMua2luZCxcblx0XHRcdGdldFByb3h5OiA8VD4oaWRlbnRpZmllcjogUHJveHlJZGVudGlmaWVyPFQ+KTogUHJveGllZDxUPiA9PiB0aGlzLl9ycGNQcm90b2NvbCEuZ2V0UHJveHkoaWRlbnRpZmllciksXG5cdFx0XHRzZXQ6IDxULCBSIGV4dGVuZHMgVD4oaWRlbnRpZmllcjogUHJveHlJZGVudGlmaWVyPFQ+LCBpbnN0YW5jZTogUik6IFIgPT4gdGhpcy5fcnBjUHJvdG9jb2whLnNldChpZGVudGlmaWVyLCBpbnN0YW5jZSksXG5cdFx0XHRkaXNwb3NlOiAoKTogdm9pZCA9PiB0aGlzLl9ycGNQcm90b2NvbCEuZGlzcG9zZSgpLFxuXHRcdFx0YXNzZXJ0UmVnaXN0ZXJlZDogKGlkZW50aWZpZXJzOiBQcm94eUlkZW50aWZpZXI8YW55PltdKTogdm9pZCA9PiB0aGlzLl9ycGNQcm90b2NvbCEuYXNzZXJ0UmVnaXN0ZXJlZChpZGVudGlmaWVycyksXG5cdFx0XHRkcmFpbjogKCk6IFByb21pc2U8dm9pZD4gPT4gdGhpcy5fcnBjUHJvdG9jb2whLmRyYWluKCksXG5cblx0XHRcdC8vI3JlZ2lvbiBpbnRlcm5hbFxuXHRcdFx0aW50ZXJuYWxFeHRlbnNpb25TZXJ2aWNlOiB0aGlzLl9pbnRlcm5hbEV4dGVuc2lvblNlcnZpY2UsXG5cdFx0XHRfc2V0RXh0ZW5zaW9uSG9zdFByb3h5OiAodmFsdWU6IElFeHRlbnNpb25Ib3N0UHJveHkpOiB2b2lkID0+IHtcblx0XHRcdFx0ZXh0ZW5zaW9uSG9zdFByb3h5ID0gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0X3NldEFsbE1haW5Qcm94eUlkZW50aWZpZXJzOiAodmFsdWU6IFByb3h5SWRlbnRpZmllcjxhbnk+W10pOiB2b2lkID0+IHtcblx0XHRcdFx0bWFpblByb3h5SWRlbnRpZmllcnMgPSB2YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHQvLyNlbmRyZWdpb25cblx0XHR9O1xuXG5cdFx0Ly8gTmFtZWQgY3VzdG9tZXJzXG5cdFx0Y29uc3QgbmFtZWRDdXN0b21lcnMgPSBFeHRIb3N0Q3VzdG9tZXJzUmVnaXN0cnkuZ2V0TmFtZWRDdXN0b21lcnMoKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbmFtZWRDdXN0b21lcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IFtpZCwgY3Rvcl0gPSBuYW1lZEN1c3RvbWVyc1tpXTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoY3RvciwgZXh0SG9zdENvbnRleHQpO1xuXHRcdFx0XHR0aGlzLl9jdXN0b21lcnMucHVzaChpbnN0YW5jZSk7XG5cdFx0XHRcdHRoaXMuX3JwY1Byb3RvY29sLnNldChpZCwgaW5zdGFuY2UpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYENhbm5vdCBpbnN0YW50aWF0ZSBuYW1lZCBjdXN0b21lcjogJyR7aWQuc2lkfSdgKTtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRlcnJvcnMub25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDdXN0b21lcnNcblx0XHRjb25zdCBjdXN0b21lcnMgPSBFeHRIb3N0Q3VzdG9tZXJzUmVnaXN0cnkuZ2V0Q3VzdG9tZXJzKCk7XG5cdFx0Zm9yIChjb25zdCBjdG9yIG9mIGN1c3RvbWVycykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShjdG9yLCBleHRIb3N0Q29udGV4dCk7XG5cdFx0XHRcdHRoaXMuX2N1c3RvbWVycy5wdXNoKGluc3RhbmNlKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdGVycm9ycy5vblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghZXh0ZW5zaW9uSG9zdFByb3h5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE1pc3NpbmcgSUV4dGVuc2lvbkhvc3RQcm94eSFgKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayB0aGF0IG5vIG5hbWVkIGN1c3RvbWVycyBhcmUgbWlzc2luZ1xuXHRcdHRoaXMuX3JwY1Byb3RvY29sLmFzc2VydFJlZ2lzdGVyZWQobWFpblByb3h5SWRlbnRpZmllcnMpO1xuXG5cdFx0cmV0dXJuIGV4dGVuc2lvbkhvc3RQcm94eTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBhY3RpdmF0ZShleHRlbnNpb246IEV4dGVuc2lvbklkZW50aWZpZXIsIHJlYXNvbjogRXh0ZW5zaW9uQWN0aXZhdGlvblJlYXNvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHByb3h5ID0gYXdhaXQgdGhpcy5fcHJveHk7XG5cdFx0aWYgKCFwcm94eSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gcHJveHkuYWN0aXZhdGUoZXh0ZW5zaW9uLCByZWFzb24pO1xuXHR9XG5cblx0cHVibGljIGFjdGl2YXRlQnlFdmVudChhY3RpdmF0aW9uRXZlbnQ6IHN0cmluZywgYWN0aXZhdGlvbktpbmQ6IEFjdGl2YXRpb25LaW5kKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGFjdGl2YXRpb25LaW5kID09PSBBY3RpdmF0aW9uS2luZC5JbW1lZGlhdGUgJiYgIXRoaXMuX2hhc1N0YXJ0ZWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2NhY2hlZEFjdGl2YXRpb25FdmVudHMuaGFzKGFjdGl2YXRpb25FdmVudCkpIHtcblx0XHRcdHRoaXMuX2NhY2hlZEFjdGl2YXRpb25FdmVudHMuc2V0KGFjdGl2YXRpb25FdmVudCwgdGhpcy5fYWN0aXZhdGVCeUV2ZW50KGFjdGl2YXRpb25FdmVudCwgYWN0aXZhdGlvbktpbmQpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NhY2hlZEFjdGl2YXRpb25FdmVudHMuZ2V0KGFjdGl2YXRpb25FdmVudCkhO1xuXHR9XG5cblx0cHVibGljIGFjdGl2YXRpb25FdmVudElzRG9uZShhY3RpdmF0aW9uRXZlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9yZXNvbHZlZEFjdGl2YXRpb25FdmVudHMuaGFzKGFjdGl2YXRpb25FdmVudCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50OiBzdHJpbmcsIGFjdGl2YXRpb25LaW5kOiBBY3RpdmF0aW9uS2luZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fcHJveHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcHJveHkgPSBhd2FpdCB0aGlzLl9wcm94eTtcblx0XHRpZiAoIXByb3h5KSB7XG5cdFx0XHQvLyB0aGlzIGNhc2UgaXMgYWxyZWFkeSBjb3ZlcmVkIGFib3ZlIGFuZCBsb2dnZWQuXG5cdFx0XHQvLyBpLmUuIHRoZSBleHRlbnNpb24gaG9zdCBjb3VsZCBub3QgYmUgc3RhcnRlZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fZXh0ZW5zaW9uSG9zdC5leHRlbnNpb25zIS5jb250YWluc0FjdGl2YXRpb25FdmVudChhY3RpdmF0aW9uRXZlbnQpKSB7XG5cdFx0XHR0aGlzLl9yZXNvbHZlZEFjdGl2YXRpb25FdmVudHMuYWRkKGFjdGl2YXRpb25FdmVudCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgcHJveHkuYWN0aXZhdGVCeUV2ZW50KGFjdGl2YXRpb25FdmVudCwgYWN0aXZhdGlvbktpbmQpO1xuXHRcdHRoaXMuX3Jlc29sdmVkQWN0aXZhdGlvbkV2ZW50cy5hZGQoYWN0aXZhdGlvbkV2ZW50KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRJbnNwZWN0UG9ydCh0cnlFbmFibGVJbnNwZWN0b3I6IGJvb2xlYW4pOiBQcm9taXNlPHsgcG9ydDogbnVtYmVyOyBob3N0OiBzdHJpbmcgfSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0aGlzLl9leHRlbnNpb25Ib3N0KSB7XG5cdFx0XHRpZiAodHJ5RW5hYmxlSW5zcGVjdG9yKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX2V4dGVuc2lvbkhvc3QuZW5hYmxlSW5zcGVjdFBvcnQoKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHBvcnQgPSB0aGlzLl9leHRlbnNpb25Ib3N0LmdldEluc3BlY3RQb3J0KCk7XG5cdFx0XHRpZiAocG9ydCkge1xuXHRcdFx0XHRyZXR1cm4gcG9ydDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJlc29sdmVBdXRob3JpdHkocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcsIHJlc29sdmVBdHRlbXB0OiBudW1iZXIpOiBQcm9taXNlPElSZXNvbHZlQXV0aG9yaXR5UmVzdWx0PiB7XG5cdFx0Y29uc3Qgc3cgPSBTdG9wV2F0Y2guY3JlYXRlKGZhbHNlKTtcblx0XHRjb25zdCBwcmVmaXggPSAoKSA9PiBgWyR7ZXh0ZW5zaW9uSG9zdEtpbmRUb1N0cmluZyh0aGlzLl9leHRlbnNpb25Ib3N0LnJ1bm5pbmdMb2NhdGlvbi5raW5kKX0ke3RoaXMuX2V4dGVuc2lvbkhvc3QucnVubmluZ0xvY2F0aW9uLmFmZmluaXR5fV1bcmVzb2x2ZUF1dGhvcml0eSgke2dldFJlbW90ZUF1dGhvcml0eVByZWZpeChyZW1vdGVBdXRob3JpdHkpfSwke3Jlc29sdmVBdHRlbXB0fSldWyR7c3cuZWxhcHNlZCgpfW1zXSBgO1xuXHRcdGNvbnN0IGxvZ0luZm8gPSAobXNnOiBzdHJpbmcpID0+IHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgJHtwcmVmaXgoKX0ke21zZ31gKTtcblx0XHRjb25zdCBsb2dFcnJvciA9IChtc2c6IHN0cmluZywgZXJyOiBhbnkgPSB1bmRlZmluZWQpID0+IHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYCR7cHJlZml4KCl9JHttc2d9YCwgZXJyKTtcblxuXHRcdGxvZ0luZm8oYG9idGFpbmluZyBwcm94eS4uLmApO1xuXHRcdGNvbnN0IHByb3h5ID0gYXdhaXQgdGhpcy5fcHJveHk7XG5cdFx0aWYgKCFwcm94eSkge1xuXHRcdFx0bG9nRXJyb3IoYG5vIHByb3h5YCk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiAnZXJyb3InLFxuXHRcdFx0XHRlcnJvcjoge1xuXHRcdFx0XHRcdG1lc3NhZ2U6IGBDYW5ub3QgcmVzb2x2ZSBhdXRob3JpdHlgLFxuXHRcdFx0XHRcdGNvZGU6IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3JDb2RlLlVua25vd24sXG5cdFx0XHRcdFx0ZGV0YWlsOiB1bmRlZmluZWRcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0bG9nSW5mbyhgaW52b2tpbmcuLi5gKTtcblx0XHRjb25zdCBpbnRlcnZhbExvZ2dlciA9IG5ldyBJbnRlcnZhbFRpbWVyKCk7XG5cdFx0dHJ5IHtcblx0XHRcdGludGVydmFsTG9nZ2VyLmNhbmNlbEFuZFNldCgoKSA9PiBsb2dJbmZvKCd3YWl0aW5nLi4uJyksIDEwMDApO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZXJSZXN1bHQgPSBhd2FpdCBwcm94eS5yZXNvbHZlQXV0aG9yaXR5KHJlbW90ZUF1dGhvcml0eSwgcmVzb2x2ZUF0dGVtcHQpO1xuXHRcdFx0aW50ZXJ2YWxMb2dnZXIuZGlzcG9zZSgpO1xuXHRcdFx0aWYgKHJlc29sdmVyUmVzdWx0LnR5cGUgPT09ICdvaycpIHtcblx0XHRcdFx0bG9nSW5mbyhgcmV0dXJuZWQgJHtyZXNvbHZlclJlc3VsdC52YWx1ZS5hdXRob3JpdHkuY29ubmVjdFRvfWApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bG9nRXJyb3IoYHJldHVybmVkIGFuIGVycm9yYCwgcmVzb2x2ZXJSZXN1bHQuZXJyb3IpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc29sdmVyUmVzdWx0O1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0aW50ZXJ2YWxMb2dnZXIuZGlzcG9zZSgpO1xuXHRcdFx0bG9nRXJyb3IoYHJldHVybmVkIGFuIGVycm9yYCwgZXJyKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6ICdlcnJvcicsXG5cdFx0XHRcdGVycm9yOiB7XG5cdFx0XHRcdFx0bWVzc2FnZTogZXJyLm1lc3NhZ2UsXG5cdFx0XHRcdFx0Y29kZTogUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvckNvZGUuVW5rbm93bixcblx0XHRcdFx0XHRkZXRhaWw6IGVyclxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRDYW5vbmljYWxVUkkocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcsIHVyaTogVVJJKTogUHJvbWlzZTxVUkkgfCBudWxsPiB7XG5cdFx0Y29uc3QgcHJveHkgPSBhd2FpdCB0aGlzLl9wcm94eTtcblx0XHRpZiAoIXByb3h5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCByZXNvbHZlIGNhbm9uaWNhbCBVUklgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHByb3h5LmdldENhbm9uaWNhbFVSSShyZW1vdGVBdXRob3JpdHksIHVyaSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc3RhcnQoZXh0ZW5zaW9uUmVnaXN0cnlWZXJzaW9uSWQ6IG51bWJlciwgYWxsRXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIG15RXh0ZW5zaW9uczogRXh0ZW5zaW9uSWRlbnRpZmllcltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJveHkgPSBhd2FpdCB0aGlzLl9wcm94eTtcblx0XHRpZiAoIXByb3h5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGRlbHRhRXh0ZW5zaW9ucyA9IHRoaXMuX2V4dGVuc2lvbkhvc3QuZXh0ZW5zaW9ucyEuc2V0KGV4dGVuc2lvblJlZ2lzdHJ5VmVyc2lvbklkLCBhbGxFeHRlbnNpb25zLCBteUV4dGVuc2lvbnMpO1xuXHRcdHJldHVybiBwcm94eS5zdGFydEV4dGVuc2lvbkhvc3QoZGVsdGFFeHRlbnNpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBleHRlbnNpb25UZXN0c0V4ZWN1dGUoKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRjb25zdCBwcm94eSA9IGF3YWl0IHRoaXMuX3Byb3h5O1xuXHRcdGlmICghcHJveHkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IG9idGFpbiBFeHRlbnNpb24gSG9zdCBQcm94eScpO1xuXHRcdH1cblx0XHRyZXR1cm4gcHJveHkuZXh0ZW5zaW9uVGVzdHNFeGVjdXRlKCk7XG5cdH1cblxuXHRwdWJsaWMgcmVwcmVzZW50c1J1bm5pbmdMb2NhdGlvbihydW5uaW5nTG9jYXRpb246IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvbik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0LnJ1bm5pbmdMb2NhdGlvbi5lcXVhbHMocnVubmluZ0xvY2F0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBkZWx0YUV4dGVuc2lvbnMoaW5jb21pbmdFeHRlbnNpb25zRGVsdGE6IElFeHRlbnNpb25EZXNjcmlwdGlvbkRlbHRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJveHkgPSBhd2FpdCB0aGlzLl9wcm94eTtcblx0XHRpZiAoIXByb3h5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG91dGdvaW5nRXh0ZW5zaW9uc0RlbHRhID0gdGhpcy5fZXh0ZW5zaW9uSG9zdC5leHRlbnNpb25zIS5kZWx0YShpbmNvbWluZ0V4dGVuc2lvbnNEZWx0YSk7XG5cdFx0aWYgKCFvdXRnb2luZ0V4dGVuc2lvbnNEZWx0YSkge1xuXHRcdFx0Ly8gVGhlIGV4dGVuc2lvbiBob3N0IGFscmVhZHkgaGFzIHRoaXMgdmVyc2lvbiBvZiB0aGUgZXh0ZW5zaW9ucy5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIHByb3h5LmRlbHRhRXh0ZW5zaW9ucyhvdXRnb2luZ0V4dGVuc2lvbnNEZWx0YSk7XG5cdH1cblxuXHRwdWJsaWMgY29udGFpbnNFeHRlbnNpb24oZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdC5leHRlbnNpb25zPy5jb250YWluc0V4dGVuc2lvbihleHRlbnNpb25JZCkgPz8gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc2V0UmVtb3RlRW52aXJvbm1lbnQoZW52OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB8IG51bGwgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHByb3h5ID0gYXdhaXQgdGhpcy5fcHJveHk7XG5cdFx0aWYgKCFwcm94eSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiBwcm94eS5zZXRSZW1vdGVFbnZpcm9ubWVudChlbnYpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmcmllbmRseUV4dEhvc3ROYW1lKGtpbmQ6IEV4dGVuc2lvbkhvc3RLaW5kLCBwaWQ6IG51bWJlciB8IG51bGwpIHtcblx0aWYgKHBpZCkge1xuXHRcdHJldHVybiBgJHtleHRlbnNpb25Ib3N0S2luZFRvU3RyaW5nKGtpbmQpfSBwaWQ6ICR7cGlkfWA7XG5cdH1cblx0cmV0dXJuIGAke2V4dGVuc2lvbkhvc3RLaW5kVG9TdHJpbmcoa2luZCl9YDtcbn1cblxuY29uc3QgY29sb3JUYWJsZXMgPSBbXG5cdFsnIzI5NzdCMScsICcjRkM4MDJEJywgJyMzNEExM0EnLCAnI0QzMjgyRicsICcjOTM2NkJBJ10sXG5cdFsnIzhCNTY0QycsICcjRTE3N0MwJywgJyM3RjdGN0YnLCAnI0JCQkUzRCcsICcjMkVCRUNEJ11cbl07XG5cbmZ1bmN0aW9uIHByZXR0eVdpdGhvdXRBcnJheXMoZGF0YTogYW55KTogYW55IHtcblx0aWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXHRpZiAoZGF0YSAmJiB0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGRhdGEudG9TdHJpbmcgPT09ICdmdW5jdGlvbicpIHtcblx0XHRjb25zdCByZXN1bHQgPSBkYXRhLnRvU3RyaW5nKCk7XG5cdFx0aWYgKHJlc3VsdCAhPT0gJ1tvYmplY3QgT2JqZWN0XScpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBkYXRhO1xufVxuXG5mdW5jdGlvbiBwcmV0dHkoZGF0YTogYW55KTogYW55IHtcblx0aWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcblx0XHRyZXR1cm4gZGF0YS5tYXAocHJldHR5V2l0aG91dEFycmF5cyk7XG5cdH1cblx0cmV0dXJuIHByZXR0eVdpdGhvdXRBcnJheXMoZGF0YSk7XG59XG5cbmNsYXNzIFJQQ0xvZ2dlciBpbXBsZW1lbnRzIElSUENQcm90b2NvbExvZ2dlciB7XG5cblx0cHJpdmF0ZSBfdG90YWxJbmNvbWluZyA9IDA7XG5cdHByaXZhdGUgX3RvdGFsT3V0Z29pbmcgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2tpbmQ6IEV4dGVuc2lvbkhvc3RLaW5kXG5cdCkgeyB9XG5cblx0cHJpdmF0ZSBfbG9nKGRpcmVjdGlvbjogc3RyaW5nLCB0b3RhbExlbmd0aDogbnVtYmVyLCBtc2dMZW5ndGg6IG51bWJlciwgcmVxOiBudW1iZXIsIGluaXRpYXRvcjogUmVxdWVzdEluaXRpYXRvciwgc3RyOiBzdHJpbmcsIGRhdGE6IGFueSk6IHZvaWQge1xuXHRcdGRhdGEgPSBwcmV0dHkoZGF0YSk7XG5cblx0XHRjb25zdCBjb2xvclRhYmxlID0gY29sb3JUYWJsZXNbaW5pdGlhdG9yXTtcblx0XHRjb25zdCBjb2xvciA9IExPR19VU0VfQ09MT1JTID8gY29sb3JUYWJsZVtyZXEgJSBjb2xvclRhYmxlLmxlbmd0aF0gOiAnIzAwMDAwMCc7XG5cdFx0bGV0IGFyZ3MgPSBbYCVjWyR7ZXh0ZW5zaW9uSG9zdEtpbmRUb1N0cmluZyh0aGlzLl9raW5kKX1dWyR7ZGlyZWN0aW9ufV0lY1ske1N0cmluZyh0b3RhbExlbmd0aCkucGFkU3RhcnQoNyl9XSVjW2xlbjogJHtTdHJpbmcobXNnTGVuZ3RoKS5wYWRTdGFydCg1KX1dJWMke1N0cmluZyhyZXEpLnBhZFN0YXJ0KDUpfSAtICR7c3RyfWAsICdjb2xvcjogZGFya2dyZWVuJywgJ2NvbG9yOiBncmV5JywgJ2NvbG9yOiBncmV5JywgYGNvbG9yOiAke2NvbG9yfWBdO1xuXHRcdGlmICgvXFwoJC8udGVzdChzdHIpKSB7XG5cdFx0XHRhcmdzID0gYXJncy5jb25jYXQoZGF0YSk7XG5cdFx0XHRhcmdzLnB1c2goJyknKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXJncy5wdXNoKGRhdGEpO1xuXHRcdH1cblx0XHRjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmdzIGFzIFtzdHJpbmcsIC4uLnN0cmluZ1tdXSk7XG5cdH1cblxuXHRsb2dJbmNvbWluZyhtc2dMZW5ndGg6IG51bWJlciwgcmVxOiBudW1iZXIsIGluaXRpYXRvcjogUmVxdWVzdEluaXRpYXRvciwgc3RyOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLl90b3RhbEluY29taW5nICs9IG1zZ0xlbmd0aDtcblx0XHR0aGlzLl9sb2coJ0V4dCBcXHUyMTkyIFdpbicsIHRoaXMuX3RvdGFsSW5jb21pbmcsIG1zZ0xlbmd0aCwgcmVxLCBpbml0aWF0b3IsIHN0ciwgZGF0YSk7XG5cdH1cblxuXHRsb2dPdXRnb2luZyhtc2dMZW5ndGg6IG51bWJlciwgcmVxOiBudW1iZXIsIGluaXRpYXRvcjogUmVxdWVzdEluaXRpYXRvciwgc3RyOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLl90b3RhbE91dGdvaW5nICs9IG1zZ0xlbmd0aDtcblx0XHR0aGlzLl9sb2coJ1dpbiBcXHUyMTkyIEV4dCcsIHRoaXMuX3RvdGFsT3V0Z29pbmcsIG1zZ0xlbmd0aCwgcmVxLCBpbml0aWF0b3IsIHN0ciwgZGF0YSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIFJQQ1RlbGVtZXRyeURhdGEge1xuXHR0eXBlOiBzdHJpbmc7XG5cdGxlbmd0aDogbnVtYmVyO1xufVxuXG50eXBlIFJQQ1RlbGVtZXRyeURhdGFDbGFzc2lmaWNhdGlvbiA9IHtcblx0b3duZXI6ICdqcmlla2VuJztcblx0Y29tbWVudDogJ0luc2lnaHRzIGFib3V0IFJQQyBtZXNzYWdlIHNpemVzJztcblx0dHlwZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSB0eXBlIG9mIHRoZSBSUEMgbWVzc2FnZScgfTtcblx0bGVuZ3RoOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGJ5dGUtbGVuZ3RoIG9mIHRoZSBSUEMgbWVzc2FnZScgfTtcbn07XG5cbmNsYXNzIFRlbGVtZXRyeVJQQ0xvZ2dlciBpbXBsZW1lbnRzIElSUENQcm90b2NvbExvZ2dlciB7XG5cblx0c3RhdGljIGlzRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gTWF0aC5yYW5kb20oKSA8IDAuMDAwMTsgLy8gMC4wMSUgb2YgdXNlcnNcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlbmRpbmdSZXF1ZXN0cyA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KCk7XG5cblx0Y29uc3RydWN0b3IoQElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlKSB7IH1cblxuXHRsb2dJbmNvbWluZyhtc2dMZW5ndGg6IG51bWJlciwgcmVxOiBudW1iZXIsIGluaXRpYXRvcjogUmVxdWVzdEluaXRpYXRvciwgc3RyOiBzdHJpbmcpOiB2b2lkIHtcblxuXHRcdGlmIChpbml0aWF0b3IgPT09IFJlcXVlc3RJbml0aWF0b3IuTG9jYWxTaWRlICYmIC9ecmVjZWl2ZVJlcGx5KEVycik/Oi8udGVzdChzdHIpKSB7XG5cdFx0XHQvLyBsb2cgdGhlIHNpemUgb2YgcmVwbHkgbWVzc2FnZXNcblx0XHRcdGNvbnN0IHJlcXVlc3RTdHIgPSB0aGlzLl9wZW5kaW5nUmVxdWVzdHMuZ2V0KHJlcSkgPz8gJ3Vua25vd25fcmVwbHknO1xuXHRcdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZShyZXEpO1xuXHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJQQ1RlbGVtZXRyeURhdGEsIFJQQ1RlbGVtZXRyeURhdGFDbGFzc2lmaWNhdGlvbj4oJ2V4dGVuc2lvbmhvc3QuaW5jb21pbmcnLCB7XG5cdFx0XHRcdHR5cGU6IGAke3N0cn0gJHtyZXF1ZXN0U3RyfWAsXG5cdFx0XHRcdGxlbmd0aDogbXNnTGVuZ3RoXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoaW5pdGlhdG9yID09PSBSZXF1ZXN0SW5pdGlhdG9yLk90aGVyU2lkZSAmJiAvXnJlY2VpdmVSZXF1ZXN0IC8udGVzdChzdHIpKSB7XG5cdFx0XHQvLyBpbmNvbWluZyByZXF1ZXN0XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8UlBDVGVsZW1ldHJ5RGF0YSwgUlBDVGVsZW1ldHJ5RGF0YUNsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uaG9zdC5pbmNvbWluZycsIHtcblx0XHRcdFx0dHlwZTogYCR7c3RyfWAsXG5cdFx0XHRcdGxlbmd0aDogbXNnTGVuZ3RoXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRsb2dPdXRnb2luZyhtc2dMZW5ndGg6IG51bWJlciwgcmVxOiBudW1iZXIsIGluaXRpYXRvcjogUmVxdWVzdEluaXRpYXRvciwgc3RyOiBzdHJpbmcpOiB2b2lkIHtcblxuXHRcdGlmIChpbml0aWF0b3IgPT09IFJlcXVlc3RJbml0aWF0b3IuTG9jYWxTaWRlICYmIHN0ci5zdGFydHNXaXRoKCdyZXF1ZXN0OiAnKSkge1xuXHRcdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLnNldChyZXEsIHN0cik7XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8UlBDVGVsZW1ldHJ5RGF0YSwgUlBDVGVsZW1ldHJ5RGF0YUNsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uaG9zdC5vdXRnb2luZycsIHtcblx0XHRcdFx0dHlwZTogc3RyLFxuXHRcdFx0XHRsZW5ndGg6IG1zZ0xlbmd0aFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59XG5cbmludGVyZmFjZSBFeHRIb3N0TGF0ZW5jeVJlc3VsdCB7XG5cdHJlbW90ZUF1dGhvcml0eTogc3RyaW5nIHwgbnVsbDtcblx0dXA6IG51bWJlcjtcblx0ZG93bjogbnVtYmVyO1xuXHRsYXRlbmN5OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBFeHRIb3N0TGF0ZW5jeVByb3ZpZGVyIHtcblx0bWVhc3VyZSgpOiBQcm9taXNlPEV4dEhvc3RMYXRlbmN5UmVzdWx0IHwgbnVsbD47XG59XG5cbmNvbnN0IHByb3ZpZGVyczogRXh0SG9zdExhdGVuY3lQcm92aWRlcltdID0gW107XG5mdW5jdGlvbiByZWdpc3RlckxhdGVuY3lUZXN0UHJvdmlkZXIocHJvdmlkZXI6IEV4dEhvc3RMYXRlbmN5UHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdHByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcblx0cmV0dXJuIHtcblx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHByb3ZpZGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAocHJvdmlkZXJzW2ldID09PSBwcm92aWRlcikge1xuXHRcdFx0XHRcdHByb3ZpZGVycy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRMYXRlbmN5VGVzdFByb3ZpZGVycygpOiBFeHRIb3N0TGF0ZW5jeVByb3ZpZGVyW10ge1xuXHRyZXR1cm4gcHJvdmlkZXJzLnNsaWNlKDApO1xufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgTWVhc3VyZUV4dEhvc3RMYXRlbmN5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLm1lYXN1cmVFeHRIb3N0TGF0ZW5jeScsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignbWVhc3VyZUV4dEhvc3RMYXRlbmN5JywgXCJNZWFzdXJlIEV4dGVuc2lvbiBIb3N0IExhdGVuY3lcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG1lYXN1cmVtZW50cyA9IGF3YWl0IFByb21pc2UuYWxsKGdldExhdGVuY3lUZXN0UHJvdmlkZXJzKCkubWFwKHByb3ZpZGVyID0+IHByb3ZpZGVyLm1lYXN1cmUoKSkpO1xuXHRcdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB1bmRlZmluZWQsIGNvbnRlbnRzOiBtZWFzdXJlbWVudHMubWFwKE1lYXN1cmVFeHRIb3N0TGF0ZW5jeUFjdGlvbi5fcHJpbnQpLmpvaW4oJ1xcblxcbicpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3ByaW50KG06IEV4dEhvc3RMYXRlbmN5UmVzdWx0IHwgbnVsbCk6IHN0cmluZyB7XG5cdFx0aWYgKCFtKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdHJldHVybiBgJHttLnJlbW90ZUF1dGhvcml0eSA/IGBBdXRob3JpdHk6ICR7bS5yZW1vdGVBdXRob3JpdHl9XFxuYCA6IGBgfVJvdW5kdHJpcCBsYXRlbmN5OiAke20ubGF0ZW5jeS50b0ZpeGVkKDMpfW1zXFxuVXA6ICR7TWVhc3VyZUV4dEhvc3RMYXRlbmN5QWN0aW9uLl9wcmludFNwZWVkKG0udXApfVxcbkRvd246ICR7TWVhc3VyZUV4dEhvc3RMYXRlbmN5QWN0aW9uLl9wcmludFNwZWVkKG0uZG93bil9XFxuYDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9wcmludFNwZWVkKG46IG51bWJlcik6IHN0cmluZyB7XG5cdFx0aWYgKG4gPD0gMTAyNCkge1xuXHRcdFx0cmV0dXJuIGAke259IGJwc2A7XG5cdFx0fVxuXHRcdGlmIChuIDwgMTAyNCAqIDEwMjQpIHtcblx0XHRcdHJldHVybiBgJHsobiAvIDEwMjQpLnRvRml4ZWQoMSl9IGticHNgO1xuXHRcdH1cblx0XHRyZXR1cm4gYCR7KG4gLyAxMDI0IC8gMTAyNCkudG9GaXhlZCgxKX0gTWJwc2A7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixZQUFZLFlBQVk7QUFDeEIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLGtCQUErQjtBQUN4QyxTQUFTLGlCQUFpQjtBQUcxQixZQUFZLFNBQVM7QUFDckIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLHVCQUF1QjtBQUV6QyxTQUFTLDZCQUErQztBQUN4RCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGtDQUFrQyxnQ0FBZ0M7QUFDM0UsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxnQ0FBeUQ7QUFDbEUsU0FBNEIsaUNBQWlDO0FBSzdELFNBQVMsc0JBQWtIO0FBRTNILFNBQTZCLGFBQWEsd0JBQXlDO0FBR25GLE1BQU0sbUNBQW1DO0FBQ3pDLE1BQU0saUJBQWlCO0FBc0JoQixJQUFNLHVCQUFOLGNBQW1DLFdBQTRDO0FBQUEsRUFrQ3JGLFlBQ0MsZUFDQSx5QkFDaUIsMkJBQ3VCLHVCQUNPLHFCQUNYLG1CQUNOLGFBQzdCO0FBQ0QsVUFBTTtBQU5XO0FBQ3VCO0FBQ087QUFDWDtBQUNOO0FBckMvQixTQUFpQiw4QkFBd0QsS0FBSyxVQUFVLElBQUksUUFB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Q2QsZUFBUyxJQUFJLEdBQUcsSUFBSSxVQUFVLFFBQVEsS0FBSztBQUMxQyxZQUFJLFVBQVUsQ0FBQyxNQUFNLFVBQVU7QUFDOUIsb0JBQVUsT0FBTyxHQUFHLENBQUM7QUFDckI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxTQUFTLDBCQUFvRDtBQUM1RCxTQUFPLFVBQVUsTUFBTSxDQUFDO0FBQ3pCO0FBRUEsZ0JBQWdCLE1BQU0sb0NBQW9DLFFBQVE7QUFBQSxFQUVqRSxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxJQUFJLFVBQVUseUJBQXlCLGdDQUFnQztBQUFBLE1BQzlFLFVBQVUsV0FBVztBQUFBLE1BQ3JCLElBQUk7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLElBQUksVUFBNEI7QUFFckMsVUFBTSxnQkFBZ0IsU0FBUyxJQUFJLGNBQWM7QUFFakQsVUFBTSxlQUFlLE1BQU0sUUFBUSxJQUFJLHdCQUF3QixFQUFFLElBQUksY0FBWSxTQUFTLFFBQVEsQ0FBQyxDQUFDO0FBQ3BHLGtCQUFjLFdBQVcsRUFBRSxVQUFVLFFBQVcsVUFBVSxhQUFhLElBQUksNEJBQTRCLE1BQU0sRUFBRSxLQUFLLE1BQU0sR0FBRyxTQUFTLEVBQUUsUUFBUSxLQUFLLEVBQUUsQ0FBQztBQUFBLEVBQ3pKO0FBQUEsRUFFQSxPQUFlLE9BQU8sR0FBd0M7QUFDN0QsUUFBSSxDQUFDLEdBQUc7QUFDUCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sR0FBRyxFQUFFLGtCQUFrQixjQUFjLEVBQUUsZUFBZTtBQUFBLElBQU8sRUFBRSxzQkFBc0IsRUFBRSxRQUFRLFFBQVEsQ0FBQyxDQUFDO0FBQUEsTUFBVyw0QkFBNEIsWUFBWSxFQUFFLEVBQUUsQ0FBQztBQUFBLFFBQVcsNEJBQTRCLFlBQVksRUFBRSxJQUFJLENBQUM7QUFBQTtBQUFBLEVBQ25PO0FBQUEsRUFFQSxPQUFlLFlBQVksR0FBbUI7QUFDN0MsUUFBSSxLQUFLLE1BQU07QUFDZCxhQUFPLEdBQUcsQ0FBQztBQUFBLElBQ1o7QUFDQSxRQUFJLElBQUksT0FBTyxNQUFNO0FBQ3BCLGFBQU8sSUFBSSxJQUFJLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFBQSxJQUNoQztBQUNBLFdBQU8sSUFBSSxJQUFJLE9BQU8sTUFBTSxRQUFRLENBQUMsQ0FBQztBQUFBLEVBQ3ZDO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
