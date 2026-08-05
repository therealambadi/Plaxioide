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
import { DisposableMap, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { URI as uri } from "../../../base/common/uri.js";
import { IDebugService, IDebugVisualization, DataBreakpointSetType } from "../../contrib/debug/common/debug.js";
import {
  ExtHostContext,
  MainContext
} from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import severity from "../../../base/common/severity.js";
import { AbstractDebugAdapter } from "../../contrib/debug/common/abstractDebugAdapter.js";
import { convertToVSCPaths, convertToDAPaths, isSessionAttach } from "../../contrib/debug/common/debugUtils.js";
import { ErrorNoTelemetry } from "../../../base/common/errors.js";
import { IDebugVisualizerService } from "../../contrib/debug/common/debugVisualizers.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { Event } from "../../../base/common/event.js";
import { isDefined } from "../../../base/common/types.js";
let MainThreadDebugService = class {
  constructor(extHostContext, debugService, visualizerService) {
    this.debugService = debugService;
    this.visualizerService = visualizerService;
    this._toDispose = new DisposableStore();
    this._debugAdaptersHandleCounter = 1;
    this._visualizerHandles = /* @__PURE__ */ new Map();
    this._visualizerTreeHandles = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDebugService);
    const sessionListeners = new DisposableMap();
    this._toDispose.add(sessionListeners);
    this._toDispose.add(debugService.onDidNewSession((session) => {
      this._proxy.$acceptDebugSessionStarted(this.getSessionDto(session));
      const store = sessionListeners.get(session);
      store?.add(session.onDidChangeName((name) => {
        this._proxy.$acceptDebugSessionNameChanged(this.getSessionDto(session), name);
      }));
    }));
    this._toDispose.add(debugService.onWillNewSession((session) => {
      let store = sessionListeners.get(session);
      if (!store) {
        store = new DisposableStore();
        sessionListeners.set(session, store);
      }
      store.add(session.onDidCustomEvent((event) => this._proxy.$acceptDebugSessionCustomEvent(this.getSessionDto(session), event)));
    }));
    this._toDispose.add(debugService.onDidEndSession(({ session, restart }) => {
      this._proxy.$acceptDebugSessionTerminated(this.getSessionDto(session));
      this._extHostKnownSessions.delete(session.getId());
      if (!restart) {
        sessionListeners.deleteAndDispose(session);
      }
      for (const [handle, value] of this._debugAdapters) {
        if (value.session === session) {
          this._debugAdapters.delete(handle);
        }
      }
    }));
    this._toDispose.add(debugService.getViewModel().onDidFocusSession((session) => {
      this._proxy.$acceptDebugSessionActiveChanged(this.getSessionDto(session));
    }));
    this._toDispose.add(toDisposable(() => {
      for (const [handle, da] of this._debugAdapters) {
        da.fireError(handle, new Error("Extension host shut down"));
      }
    }));
    this._debugAdapters = /* @__PURE__ */ new Map();
    this._debugConfigurationProviders = /* @__PURE__ */ new Map();
    this._debugAdapterDescriptorFactories = /* @__PURE__ */ new Map();
    this._extHostKnownSessions = /* @__PURE__ */ new Set();
    const viewModel = this.debugService.getViewModel();
    this._toDispose.add(Event.any(viewModel.onDidFocusStackFrame, viewModel.onDidFocusThread)(() => {
      const stackFrame = viewModel.focusedStackFrame;
      const thread = viewModel.focusedThread;
      if (stackFrame) {
        this._proxy.$acceptStackFrameFocus({
          kind: "stackFrame",
          threadId: stackFrame.thread.threadId,
          frameId: stackFrame.frameId,
          sessionId: stackFrame.thread.session.getId()
        });
      } else if (thread) {
        this._proxy.$acceptStackFrameFocus({
          kind: "thread",
          threadId: thread.threadId,
          sessionId: thread.session.getId()
        });
      } else {
        this._proxy.$acceptStackFrameFocus(void 0);
      }
    }));
    this.sendBreakpointsAndListen();
  }
  $registerDebugVisualizerTree(treeId, canEdit) {
    this._visualizerTreeHandles.set(treeId, this.visualizerService.registerTree(treeId, {
      disposeItem: (id) => this._proxy.$disposeVisualizedTree(id),
      getChildren: (e) => this._proxy.$getVisualizerTreeItemChildren(treeId, e),
      getTreeItem: (e) => this._proxy.$getVisualizerTreeItem(treeId, e),
      editItem: canEdit ? (e, v) => this._proxy.$editVisualizerTreeItem(e, v) : void 0
    }));
  }
  $unregisterDebugVisualizerTree(treeId) {
    this._visualizerTreeHandles.get(treeId)?.dispose();
    this._visualizerTreeHandles.delete(treeId);
  }
  $registerDebugVisualizer(extensionId, id) {
    const handle = this.visualizerService.register({
      extensionId: new ExtensionIdentifier(extensionId),
      id,
      disposeDebugVisualizers: (ids) => this._proxy.$disposeDebugVisualizers(ids),
      executeDebugVisualizerCommand: (id2) => this._proxy.$executeDebugVisualizerCommand(id2),
      provideDebugVisualizers: (context, token) => this._proxy.$provideDebugVisualizers(extensionId, id, context, token).then((r) => r.map(IDebugVisualization.deserialize)),
      resolveDebugVisualizer: (viz, token) => this._proxy.$resolveDebugVisualizer(viz.id, token)
    });
    this._visualizerHandles.set(`${extensionId}/${id}`, handle);
  }
  $unregisterDebugVisualizer(extensionId, id) {
    const key = `${extensionId}/${id}`;
    this._visualizerHandles.get(key)?.dispose();
    this._visualizerHandles.delete(key);
  }
  sendBreakpointsAndListen() {
    this._toDispose.add(this.debugService.getModel().onDidChangeBreakpoints((e) => {
      if (e && !e.sessionOnly) {
        const delta = {};
        if (e.added) {
          delta.added = this.convertToDto(e.added);
        }
        if (e.removed) {
          delta.removed = e.removed.map((x) => x.getId());
        }
        if (e.changed) {
          delta.changed = this.convertToDto(e.changed);
        }
        if (delta.added || delta.removed || delta.changed) {
          this._proxy.$acceptBreakpointsDelta(delta);
        }
      }
    }));
    const bps = this.debugService.getModel().getBreakpoints();
    const fbps = this.debugService.getModel().getFunctionBreakpoints();
    const dbps = this.debugService.getModel().getDataBreakpoints();
    if (bps.length > 0 || fbps.length > 0) {
      this._proxy.$acceptBreakpointsDelta({
        added: this.convertToDto(bps).concat(this.convertToDto(fbps)).concat(this.convertToDto(dbps))
      });
    }
  }
  dispose() {
    this._toDispose.dispose();
  }
  // interface IDebugAdapterProvider
  createDebugAdapter(session) {
    const handle = this._debugAdaptersHandleCounter++;
    const da = new ExtensionHostDebugAdapter(this, handle, this._proxy, session);
    this._debugAdapters.set(handle, da);
    return da;
  }
  substituteVariables(folder, config) {
    return Promise.resolve(this._proxy.$substituteVariables(folder ? folder.uri : void 0, config));
  }
  runInTerminal(args, sessionId) {
    return this._proxy.$runInTerminal(args, sessionId);
  }
  // RPC methods (MainThreadDebugServiceShape)
  $registerDebugTypes(debugTypes) {
    this._toDispose.add(this.debugService.getAdapterManager().registerDebugAdapterFactory(debugTypes, this));
  }
  $registerBreakpoints(DTOs) {
    for (const dto of DTOs) {
      if (dto.type === "sourceMulti") {
        const rawbps = dto.lines.map((l) => ({
          id: l.id,
          enabled: l.enabled,
          lineNumber: l.line + 1,
          column: l.character > 0 ? l.character + 1 : void 0,
          // a column value of 0 results in an omitted column attribute; see #46784
          condition: l.condition,
          hitCondition: l.hitCondition,
          logMessage: l.logMessage,
          mode: l.mode
        }));
        this.debugService.addBreakpoints(uri.revive(dto.uri), rawbps);
      } else if (dto.type === "function") {
        this.debugService.addFunctionBreakpoint({
          name: dto.functionName,
          mode: dto.mode,
          condition: dto.condition,
          hitCondition: dto.hitCondition,
          enabled: dto.enabled,
          logMessage: dto.logMessage
        }, dto.id);
      } else if (dto.type === "data") {
        this.debugService.addDataBreakpoint({
          description: dto.label,
          src: { type: DataBreakpointSetType.Variable, dataId: dto.dataId },
          canPersist: dto.canPersist,
          accessTypes: dto.accessTypes,
          accessType: dto.accessType,
          mode: dto.mode
        });
      }
    }
    return Promise.resolve();
  }
  $unregisterBreakpoints(breakpointIds, functionBreakpointIds, dataBreakpointIds) {
    breakpointIds.forEach((id) => this.debugService.removeBreakpoints(id));
    functionBreakpointIds.forEach((id) => this.debugService.removeFunctionBreakpoints(id));
    dataBreakpointIds.forEach((id) => this.debugService.removeDataBreakpoints(id));
    return Promise.resolve();
  }
  $registerDebugConfigurationProvider(debugType, providerTriggerKind, hasProvide, hasResolve, hasResolve2, handle) {
    const provider = {
      type: debugType,
      triggerKind: providerTriggerKind
    };
    if (hasProvide) {
      provider.provideDebugConfigurations = (folder, token) => {
        return this._proxy.$provideDebugConfigurations(handle, folder, token);
      };
    }
    if (hasResolve) {
      provider.resolveDebugConfiguration = (folder, config, token) => {
        return this._proxy.$resolveDebugConfiguration(handle, folder, config, token);
      };
    }
    if (hasResolve2) {
      provider.resolveDebugConfigurationWithSubstitutedVariables = (folder, config, token) => {
        return this._proxy.$resolveDebugConfigurationWithSubstitutedVariables(handle, folder, config, token);
      };
    }
    this._debugConfigurationProviders.set(handle, provider);
    this._toDispose.add(this.debugService.getConfigurationManager().registerDebugConfigurationProvider(provider));
    return Promise.resolve(void 0);
  }
  $unregisterDebugConfigurationProvider(handle) {
    const provider = this._debugConfigurationProviders.get(handle);
    if (provider) {
      this._debugConfigurationProviders.delete(handle);
      this.debugService.getConfigurationManager().unregisterDebugConfigurationProvider(provider);
    }
  }
  $registerDebugAdapterDescriptorFactory(debugType, handle) {
    const provider = {
      type: debugType,
      createDebugAdapterDescriptor: (session) => {
        return Promise.resolve(this._proxy.$provideDebugAdapter(handle, this.getSessionDto(session)));
      }
    };
    this._debugAdapterDescriptorFactories.set(handle, provider);
    this._toDispose.add(this.debugService.getAdapterManager().registerDebugAdapterDescriptorFactory(provider));
    return Promise.resolve(void 0);
  }
  $unregisterDebugAdapterDescriptorFactory(handle) {
    const provider = this._debugAdapterDescriptorFactories.get(handle);
    if (provider) {
      this._debugAdapterDescriptorFactories.delete(handle);
      this.debugService.getAdapterManager().unregisterDebugAdapterDescriptorFactory(provider);
    }
  }
  getSession(sessionId) {
    if (sessionId) {
      return this.debugService.getModel().getSession(sessionId, true);
    }
    return void 0;
  }
  async $startDebugging(folder, nameOrConfig, options) {
    const folderUri = folder ? uri.revive(folder) : void 0;
    const launch = this.debugService.getConfigurationManager().getLaunch(folderUri);
    const parentSession = this.getSession(options.parentSessionID);
    const saveBeforeStart = typeof options.suppressSaveBeforeStart === "boolean" ? !options.suppressSaveBeforeStart : void 0;
    const debugOptions = {
      noDebug: options.noDebug,
      parentSession,
      lifecycleManagedByParent: options.lifecycleManagedByParent,
      repl: options.repl,
      compact: options.compact,
      compoundRoot: parentSession?.compoundRoot,
      saveBeforeRestart: saveBeforeStart,
      testRun: options.testRun,
      suppressDebugStatusbar: options.suppressDebugStatusbar,
      suppressDebugToolbar: options.suppressDebugToolbar,
      suppressDebugView: options.suppressDebugView
    };
    try {
      return this.debugService.startDebugging(launch, nameOrConfig, debugOptions, saveBeforeStart);
    } catch (err) {
      throw new ErrorNoTelemetry(err && err.message ? err.message : "cannot start debugging");
    }
  }
  $setDebugSessionName(sessionId, name) {
    const session = this.debugService.getModel().getSession(sessionId);
    session?.setName(name);
  }
  $customDebugAdapterRequest(sessionId, request, args) {
    const session = this.debugService.getModel().getSession(sessionId, true);
    if (session) {
      return session.customRequest(request, args).then((response) => {
        if (response && response.success) {
          return response.body;
        } else {
          return Promise.reject(new ErrorNoTelemetry(response ? response.message : "custom request failed"));
        }
      });
    }
    return Promise.reject(new ErrorNoTelemetry("debug session not found"));
  }
  $getDebugProtocolBreakpoint(sessionId, breakpoinId) {
    const session = this.debugService.getModel().getSession(sessionId, true);
    if (session) {
      return Promise.resolve(session.getDebugProtocolBreakpoint(breakpoinId));
    }
    return Promise.reject(new ErrorNoTelemetry("debug session not found"));
  }
  $stopDebugging(sessionId) {
    if (sessionId) {
      const session = this.debugService.getModel().getSession(sessionId, true);
      if (session) {
        return this.debugService.stopSession(session, isSessionAttach(session));
      }
    } else {
      return this.debugService.stopSession(void 0);
    }
    return Promise.reject(new ErrorNoTelemetry("debug session not found"));
  }
  $appendDebugConsole(value) {
    const session = this.debugService.getViewModel().focusedSession;
    session?.appendToRepl({ output: value, sev: severity.Warning });
  }
  $acceptDAMessage(handle, message) {
    this.getDebugAdapter(handle).acceptMessage(convertToVSCPaths(message, false));
  }
  $acceptDAError(handle, name, message, stack) {
    this._debugAdapters.get(handle)?.fireError(handle, new Error(`${name}: ${message}
${stack}`));
  }
  $acceptDAExit(handle, code, signal) {
    this._debugAdapters.get(handle)?.fireExit(handle, code, signal);
  }
  getDebugAdapter(handle) {
    const adapter = this._debugAdapters.get(handle);
    if (!adapter) {
      throw new Error("Invalid debug adapter");
    }
    return adapter;
  }
  // dto helpers
  $sessionCached(sessionID) {
    this._extHostKnownSessions.add(sessionID);
  }
  getSessionDto(session) {
    if (session) {
      const sessionID = session.getId();
      if (this._extHostKnownSessions.has(sessionID)) {
        return sessionID;
      } else {
        return {
          id: sessionID,
          type: session.configuration.type,
          name: session.name,
          folderUri: session.root ? session.root.uri : void 0,
          configuration: session.configuration,
          parent: session.parentSession?.getId()
        };
      }
    }
    return void 0;
  }
  convertToDto(bps) {
    return bps.map((bp) => {
      if ("name" in bp) {
        const fbp = bp;
        return {
          type: "function",
          id: fbp.getId(),
          enabled: fbp.enabled,
          condition: fbp.condition,
          hitCondition: fbp.hitCondition,
          logMessage: fbp.logMessage,
          functionName: fbp.name
        };
      } else if ("src" in bp) {
        const dbp = bp;
        return {
          type: "data",
          id: dbp.getId(),
          dataId: dbp.src.type === DataBreakpointSetType.Variable ? dbp.src.dataId : dbp.src.address,
          enabled: dbp.enabled,
          condition: dbp.condition,
          hitCondition: dbp.hitCondition,
          logMessage: dbp.logMessage,
          accessType: dbp.accessType,
          label: dbp.description,
          canPersist: dbp.canPersist
        };
      } else if ("uri" in bp) {
        const sbp = bp;
        return {
          type: "source",
          id: sbp.getId(),
          enabled: sbp.enabled,
          condition: sbp.condition,
          hitCondition: sbp.hitCondition,
          logMessage: sbp.logMessage,
          uri: sbp.uri,
          line: sbp.lineNumber > 0 ? sbp.lineNumber - 1 : 0,
          character: typeof sbp.column === "number" && sbp.column > 0 ? sbp.column - 1 : 0
        };
      } else {
        return void 0;
      }
    }).filter(isDefined);
  }
};
MainThreadDebugService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDebugService),
  __decorateParam(1, IDebugService),
  __decorateParam(2, IDebugVisualizerService)
], MainThreadDebugService);
class ExtensionHostDebugAdapter extends AbstractDebugAdapter {
  constructor(_ds, _handle, _proxy, session) {
    super();
    this._ds = _ds;
    this._handle = _handle;
    this._proxy = _proxy;
    this.session = session;
  }
  fireError(handle, err) {
    this._onError.fire(err);
  }
  fireExit(handle, code, signal) {
    this._onExit.fire(code);
  }
  startSession() {
    return Promise.resolve(this._proxy.$startDASession(this._handle, this._ds.getSessionDto(this.session)));
  }
  sendMessage(message) {
    this._proxy.$sendDAMessage(this._handle, convertToDAPaths(message, true));
  }
  async stopSession() {
    await this.cancelPendingRequests();
    return Promise.resolve(this._proxy.$stopDASession(this._handle));
  }
}
export {
  MainThreadDebugService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZERlYnVnU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgYXMgdXJpLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElEZWJ1Z1NlcnZpY2UsIElDb25maWcsIElEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlciwgSUJyZWFrcG9pbnQsIElGdW5jdGlvbkJyZWFrcG9pbnQsIElCcmVha3BvaW50RGF0YSwgSURlYnVnQWRhcHRlciwgSURlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5LCBJRGVidWdTZXNzaW9uLCBJRGVidWdBZGFwdGVyRmFjdG9yeSwgSURhdGFCcmVha3BvaW50LCBJRGVidWdTZXNzaW9uT3B0aW9ucywgSUluc3RydWN0aW9uQnJlYWtwb2ludCwgRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXJUcmlnZ2VyS2luZCwgSURlYnVnVmlzdWFsaXphdGlvbiwgRGF0YUJyZWFrcG9pbnRTZXRUeXBlIH0gZnJvbSAnLi4vLi4vY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHtcblx0RXh0SG9zdENvbnRleHQsIEV4dEhvc3REZWJ1Z1NlcnZpY2VTaGFwZSwgTWFpblRocmVhZERlYnVnU2VydmljZVNoYXBlLCBEZWJ1Z1Nlc3Npb25VVUlELCBNYWluQ29udGV4dCxcblx0SUJyZWFrcG9pbnRzRGVsdGFEdG8sIElTb3VyY2VNdWx0aUJyZWFrcG9pbnREdG8sIElTb3VyY2VCcmVha3BvaW50RHRvLCBJRnVuY3Rpb25CcmVha3BvaW50RHRvLCBJRGVidWdTZXNzaW9uRHRvLCBJRGF0YUJyZWFrcG9pbnREdG8sIElTdGFydERlYnVnZ2luZ09wdGlvbnMsIElEZWJ1Z0NvbmZpZ3VyYXRpb24sIElUaHJlYWRGb2N1c0R0bywgSVN0YWNrRnJhbWVGb2N1c0R0b1xufSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBleHRIb3N0TmFtZWRDdXN0b21lciwgSUV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgc2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3REZWJ1Z0FkYXB0ZXIgfSBmcm9tICcuLi8uLi9jb250cmliL2RlYnVnL2NvbW1vbi9hYnN0cmFjdERlYnVnQWRhcHRlci5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlRm9sZGVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgY29udmVydFRvVlNDUGF0aHMsIGNvbnZlcnRUb0RBUGF0aHMsIGlzU2Vzc2lvbkF0dGFjaCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvZGVidWcvY29tbW9uL2RlYnVnVXRpbHMuanMnO1xuaW1wb3J0IHsgRXJyb3JOb1RlbGVtZXRyeSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJRGVidWdWaXN1YWxpemVyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvZGVidWcvY29tbW9uL2RlYnVnVmlzdWFsaXplcnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5cbkBleHRIb3N0TmFtZWRDdXN0b21lcihNYWluQ29udGV4dC5NYWluVGhyZWFkRGVidWdTZXJ2aWNlKVxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWREZWJ1Z1NlcnZpY2UgaW1wbGVtZW50cyBNYWluVGhyZWFkRGVidWdTZXJ2aWNlU2hhcGUsIElEZWJ1Z0FkYXB0ZXJGYWN0b3J5IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdERlYnVnU2VydmljZVNoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnQWRhcHRlcnM6IE1hcDxudW1iZXIsIEV4dGVuc2lvbkhvc3REZWJ1Z0FkYXB0ZXI+O1xuXHRwcml2YXRlIF9kZWJ1Z0FkYXB0ZXJzSGFuZGxlQ291bnRlciA9IDE7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyczogTWFwPG51bWJlciwgSURlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyPjtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVidWdBZGFwdGVyRGVzY3JpcHRvckZhY3RvcmllczogTWFwPG51bWJlciwgSURlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5Pjtcblx0cHJpdmF0ZSByZWFkb25seSBfZXh0SG9zdEtub3duU2Vzc2lvbnM6IFNldDxEZWJ1Z1Nlc3Npb25VVUlEPjtcblx0cHJpdmF0ZSByZWFkb25seSBfdmlzdWFsaXplckhhbmRsZXMgPSBuZXcgTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Zpc3VhbGl6ZXJUcmVlSGFuZGxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJRGlzcG9zYWJsZT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRIb3N0Q29udGV4dDogSUV4dEhvc3RDb250ZXh0LFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJRGVidWdWaXN1YWxpemVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpc3VhbGl6ZXJTZXJ2aWNlOiBJRGVidWdWaXN1YWxpemVyU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fcHJveHkgPSBleHRIb3N0Q29udGV4dC5nZXRQcm94eShFeHRIb3N0Q29udGV4dC5FeHRIb3N0RGVidWdTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHNlc3Npb25MaXN0ZW5lcnMgPSBuZXcgRGlzcG9zYWJsZU1hcDxJRGVidWdTZXNzaW9uLCBEaXNwb3NhYmxlU3RvcmU+KCk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChzZXNzaW9uTGlzdGVuZXJzKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKGRlYnVnU2VydmljZS5vbkRpZE5ld1Nlc3Npb24oc2Vzc2lvbiA9PiB7XG5cdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0RGVidWdTZXNzaW9uU3RhcnRlZCh0aGlzLmdldFNlc3Npb25EdG8oc2Vzc2lvbikpO1xuXHRcdFx0Y29uc3Qgc3RvcmUgPSBzZXNzaW9uTGlzdGVuZXJzLmdldChzZXNzaW9uKTtcblx0XHRcdHN0b3JlPy5hZGQoc2Vzc2lvbi5vbkRpZENoYW5nZU5hbWUobmFtZSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHREZWJ1Z1Nlc3Npb25OYW1lQ2hhbmdlZCh0aGlzLmdldFNlc3Npb25EdG8oc2Vzc2lvbiksIG5hbWUpO1xuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0XHQvLyBOZWVkIHRvIHN0YXJ0IGxpc3RlbmluZyBlYXJseSB0byBuZXcgc2Vzc2lvbiBldmVudHMgYmVjYXVzZSBhIGN1c3RvbSBldmVudCBjYW4gY29tZSB3aGlsZSBhIHNlc3Npb24gaXMgaW5pdGlhbGlzaW5nXG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChkZWJ1Z1NlcnZpY2Uub25XaWxsTmV3U2Vzc2lvbihzZXNzaW9uID0+IHtcblx0XHRcdGxldCBzdG9yZSA9IHNlc3Npb25MaXN0ZW5lcnMuZ2V0KHNlc3Npb24pO1xuXHRcdFx0aWYgKCFzdG9yZSkge1xuXHRcdFx0XHRzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0c2Vzc2lvbkxpc3RlbmVycy5zZXQoc2Vzc2lvbiwgc3RvcmUpO1xuXHRcdFx0fVxuXHRcdFx0c3RvcmUuYWRkKHNlc3Npb24ub25EaWRDdXN0b21FdmVudChldmVudCA9PiB0aGlzLl9wcm94eS4kYWNjZXB0RGVidWdTZXNzaW9uQ3VzdG9tRXZlbnQodGhpcy5nZXRTZXNzaW9uRHRvKHNlc3Npb24pLCBldmVudCkpKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChkZWJ1Z1NlcnZpY2Uub25EaWRFbmRTZXNzaW9uKCh7IHNlc3Npb24sIHJlc3RhcnQgfSkgPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdERlYnVnU2Vzc2lvblRlcm1pbmF0ZWQodGhpcy5nZXRTZXNzaW9uRHRvKHNlc3Npb24pKTtcblx0XHRcdHRoaXMuX2V4dEhvc3RLbm93blNlc3Npb25zLmRlbGV0ZShzZXNzaW9uLmdldElkKCkpO1xuXG5cdFx0XHQvLyBrZWVwIHRoZSBzZXNzaW9uIGxpc3RlbmVycyBhcm91bmQgc2luY2Ugd2Ugc3RpbGwgd2lsbCBnZXQgZXZlbnRzIGFmdGVyIHRoZXkgcmVzdGFydFxuXHRcdFx0aWYgKCFyZXN0YXJ0KSB7XG5cdFx0XHRcdHNlc3Npb25MaXN0ZW5lcnMuZGVsZXRlQW5kRGlzcG9zZShzZXNzaW9uKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gYW55IHJlc3RhcnRlZCBzZXNzaW9uIHdpbGwgY3JlYXRlIGEgbmV3IERBLCBzbyBhbHdheXMgdGhyb3cgdGhlIG9sZCBvbmUgYXdheS5cblx0XHRcdGZvciAoY29uc3QgW2hhbmRsZSwgdmFsdWVdIG9mIHRoaXMuX2RlYnVnQWRhcHRlcnMpIHtcblx0XHRcdFx0aWYgKHZhbHVlLnNlc3Npb24gPT09IHNlc3Npb24pIHtcblx0XHRcdFx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0XHRcdC8vIGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQoZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLm9uRGlkRm9jdXNTZXNzaW9uKHNlc3Npb24gPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdERlYnVnU2Vzc2lvbkFjdGl2ZUNoYW5nZWQodGhpcy5nZXRTZXNzaW9uRHRvKHNlc3Npb24pKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBbaGFuZGxlLCBkYV0gb2YgdGhpcy5fZGVidWdBZGFwdGVycykge1xuXHRcdFx0XHRkYS5maXJlRXJyb3IoaGFuZGxlLCBuZXcgRXJyb3IoJ0V4dGVuc2lvbiBob3N0IHNodXQgZG93bicpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJzID0gbmV3IE1hcCgpO1xuXHRcdHRoaXMuX2RlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVycyA9IG5ldyBNYXAoKTtcblx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yaWVzID0gbmV3IE1hcCgpO1xuXHRcdHRoaXMuX2V4dEhvc3RLbm93blNlc3Npb25zID0gbmV3IFNldCgpO1xuXG5cdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChFdmVudC5hbnkodmlld01vZGVsLm9uRGlkRm9jdXNTdGFja0ZyYW1lLCB2aWV3TW9kZWwub25EaWRGb2N1c1RocmVhZCkoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc3RhY2tGcmFtZSA9IHZpZXdNb2RlbC5mb2N1c2VkU3RhY2tGcmFtZTtcblx0XHRcdGNvbnN0IHRocmVhZCA9IHZpZXdNb2RlbC5mb2N1c2VkVGhyZWFkO1xuXHRcdFx0aWYgKHN0YWNrRnJhbWUpIHtcblx0XHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdFN0YWNrRnJhbWVGb2N1cyh7XG5cdFx0XHRcdFx0a2luZDogJ3N0YWNrRnJhbWUnLFxuXHRcdFx0XHRcdHRocmVhZElkOiBzdGFja0ZyYW1lLnRocmVhZC50aHJlYWRJZCxcblx0XHRcdFx0XHRmcmFtZUlkOiBzdGFja0ZyYW1lLmZyYW1lSWQsXG5cdFx0XHRcdFx0c2Vzc2lvbklkOiBzdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uLmdldElkKCksXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElTdGFja0ZyYW1lRm9jdXNEdG8pO1xuXHRcdFx0fSBlbHNlIGlmICh0aHJlYWQpIHtcblx0XHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdFN0YWNrRnJhbWVGb2N1cyh7XG5cdFx0XHRcdFx0a2luZDogJ3RocmVhZCcsXG5cdFx0XHRcdFx0dGhyZWFkSWQ6IHRocmVhZC50aHJlYWRJZCxcblx0XHRcdFx0XHRzZXNzaW9uSWQ6IHRocmVhZC5zZXNzaW9uLmdldElkKCksXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElUaHJlYWRGb2N1c0R0byk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0U3RhY2tGcmFtZUZvY3VzKHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5zZW5kQnJlYWtwb2ludHNBbmRMaXN0ZW4oKTtcblx0fVxuXG5cdCRyZWdpc3RlckRlYnVnVmlzdWFsaXplclRyZWUodHJlZUlkOiBzdHJpbmcsIGNhbkVkaXQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl92aXN1YWxpemVyVHJlZUhhbmRsZXMuc2V0KHRyZWVJZCwgdGhpcy52aXN1YWxpemVyU2VydmljZS5yZWdpc3RlclRyZWUodHJlZUlkLCB7XG5cdFx0XHRkaXNwb3NlSXRlbTogaWQgPT4gdGhpcy5fcHJveHkuJGRpc3Bvc2VWaXN1YWxpemVkVHJlZShpZCksXG5cdFx0XHRnZXRDaGlsZHJlbjogZSA9PiB0aGlzLl9wcm94eS4kZ2V0VmlzdWFsaXplclRyZWVJdGVtQ2hpbGRyZW4odHJlZUlkLCBlKSxcblx0XHRcdGdldFRyZWVJdGVtOiBlID0+IHRoaXMuX3Byb3h5LiRnZXRWaXN1YWxpemVyVHJlZUl0ZW0odHJlZUlkLCBlKSxcblx0XHRcdGVkaXRJdGVtOiBjYW5FZGl0ID8gKChlLCB2KSA9PiB0aGlzLl9wcm94eS4kZWRpdFZpc3VhbGl6ZXJUcmVlSXRlbShlLCB2KSkgOiB1bmRlZmluZWRcblx0XHR9KSk7XG5cdH1cblxuXHQkdW5yZWdpc3RlckRlYnVnVmlzdWFsaXplclRyZWUodHJlZUlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl92aXN1YWxpemVyVHJlZUhhbmRsZXMuZ2V0KHRyZWVJZCk/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl92aXN1YWxpemVyVHJlZUhhbmRsZXMuZGVsZXRlKHRyZWVJZCk7XG5cdH1cblxuXHQkcmVnaXN0ZXJEZWJ1Z1Zpc3VhbGl6ZXIoZXh0ZW5zaW9uSWQ6IHN0cmluZywgaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMudmlzdWFsaXplclNlcnZpY2UucmVnaXN0ZXIoe1xuXHRcdFx0ZXh0ZW5zaW9uSWQ6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKGV4dGVuc2lvbklkKSxcblx0XHRcdGlkLFxuXHRcdFx0ZGlzcG9zZURlYnVnVmlzdWFsaXplcnM6IGlkcyA9PiB0aGlzLl9wcm94eS4kZGlzcG9zZURlYnVnVmlzdWFsaXplcnMoaWRzKSxcblx0XHRcdGV4ZWN1dGVEZWJ1Z1Zpc3VhbGl6ZXJDb21tYW5kOiBpZCA9PiB0aGlzLl9wcm94eS4kZXhlY3V0ZURlYnVnVmlzdWFsaXplckNvbW1hbmQoaWQpLFxuXHRcdFx0cHJvdmlkZURlYnVnVmlzdWFsaXplcnM6IChjb250ZXh0LCB0b2tlbikgPT4gdGhpcy5fcHJveHkuJHByb3ZpZGVEZWJ1Z1Zpc3VhbGl6ZXJzKGV4dGVuc2lvbklkLCBpZCwgY29udGV4dCwgdG9rZW4pLnRoZW4ociA9PiByLm1hcChJRGVidWdWaXN1YWxpemF0aW9uLmRlc2VyaWFsaXplKSksXG5cdFx0XHRyZXNvbHZlRGVidWdWaXN1YWxpemVyOiAodml6LCB0b2tlbikgPT4gdGhpcy5fcHJveHkuJHJlc29sdmVEZWJ1Z1Zpc3VhbGl6ZXIodml6LmlkLCB0b2tlbiksXG5cdFx0fSk7XG5cdFx0dGhpcy5fdmlzdWFsaXplckhhbmRsZXMuc2V0KGAke2V4dGVuc2lvbklkfS8ke2lkfWAsIGhhbmRsZSk7XG5cdH1cblxuXHQkdW5yZWdpc3RlckRlYnVnVmlzdWFsaXplcihleHRlbnNpb25JZDogc3RyaW5nLCBpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5ID0gYCR7ZXh0ZW5zaW9uSWR9LyR7aWR9YDtcblx0XHR0aGlzLl92aXN1YWxpemVySGFuZGxlcy5nZXQoa2V5KT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3Zpc3VhbGl6ZXJIYW5kbGVzLmRlbGV0ZShrZXkpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZW5kQnJlYWtwb2ludHNBbmRMaXN0ZW4oKTogdm9pZCB7XG5cdFx0Ly8gc2V0IHVwIGEgaGFuZGxlciB0byBzZW5kIG1vcmVcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkub25EaWRDaGFuZ2VCcmVha3BvaW50cyhlID0+IHtcblx0XHRcdC8vIElnbm9yZSBzZXNzaW9uIG9ubHkgYnJlYWtwb2ludCBldmVudHMgc2luY2UgdGhleSBzaG91bGQgb25seSByZWZsZWN0IGluIHRoZSBVSVxuXHRcdFx0aWYgKGUgJiYgIWUuc2Vzc2lvbk9ubHkpIHtcblx0XHRcdFx0Y29uc3QgZGVsdGE6IElCcmVha3BvaW50c0RlbHRhRHRvID0ge307XG5cdFx0XHRcdGlmIChlLmFkZGVkKSB7XG5cdFx0XHRcdFx0ZGVsdGEuYWRkZWQgPSB0aGlzLmNvbnZlcnRUb0R0byhlLmFkZGVkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZS5yZW1vdmVkKSB7XG5cdFx0XHRcdFx0ZGVsdGEucmVtb3ZlZCA9IGUucmVtb3ZlZC5tYXAoeCA9PiB4LmdldElkKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLmNoYW5nZWQpIHtcblx0XHRcdFx0XHRkZWx0YS5jaGFuZ2VkID0gdGhpcy5jb252ZXJ0VG9EdG8oZS5jaGFuZ2VkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChkZWx0YS5hZGRlZCB8fCBkZWx0YS5yZW1vdmVkIHx8IGRlbHRhLmNoYW5nZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0QnJlYWtwb2ludHNEZWx0YShkZWx0YSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBzZW5kIGFsbCBicmVha3BvaW50c1xuXHRcdGNvbnN0IGJwcyA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0QnJlYWtwb2ludHMoKTtcblx0XHRjb25zdCBmYnBzID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRGdW5jdGlvbkJyZWFrcG9pbnRzKCk7XG5cdFx0Y29uc3QgZGJwcyA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0RGF0YUJyZWFrcG9pbnRzKCk7XG5cdFx0aWYgKGJwcy5sZW5ndGggPiAwIHx8IGZicHMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdEJyZWFrcG9pbnRzRGVsdGEoe1xuXHRcdFx0XHRhZGRlZDogdGhpcy5jb252ZXJ0VG9EdG8oYnBzKS5jb25jYXQodGhpcy5jb252ZXJ0VG9EdG8oZmJwcykpLmNvbmNhdCh0aGlzLmNvbnZlcnRUb0R0byhkYnBzKSlcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5kaXNwb3NlKCk7XG5cdH1cblxuXHQvLyBpbnRlcmZhY2UgSURlYnVnQWRhcHRlclByb3ZpZGVyXG5cblx0Y3JlYXRlRGVidWdBZGFwdGVyKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24pOiBJRGVidWdBZGFwdGVyIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9kZWJ1Z0FkYXB0ZXJzSGFuZGxlQ291bnRlcisrO1xuXHRcdGNvbnN0IGRhID0gbmV3IEV4dGVuc2lvbkhvc3REZWJ1Z0FkYXB0ZXIodGhpcywgaGFuZGxlLCB0aGlzLl9wcm94eSwgc2Vzc2lvbik7XG5cdFx0dGhpcy5fZGVidWdBZGFwdGVycy5zZXQoaGFuZGxlLCBkYSk7XG5cdFx0cmV0dXJuIGRhO1xuXHR9XG5cblx0c3Vic3RpdHV0ZVZhcmlhYmxlcyhmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsIGNvbmZpZzogSUNvbmZpZyk6IFByb21pc2U8SUNvbmZpZz4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fcHJveHkuJHN1YnN0aXR1dGVWYXJpYWJsZXMoZm9sZGVyID8gZm9sZGVyLnVyaSA6IHVuZGVmaW5lZCwgY29uZmlnKSk7XG5cdH1cblxuXHRydW5JblRlcm1pbmFsKGFyZ3M6IERlYnVnUHJvdG9jb2wuUnVuSW5UZXJtaW5hbFJlcXVlc3RBcmd1bWVudHMsIHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHJ1bkluVGVybWluYWwoYXJncywgc2Vzc2lvbklkKTtcblx0fVxuXG5cdC8vIFJQQyBtZXRob2RzIChNYWluVGhyZWFkRGVidWdTZXJ2aWNlU2hhcGUpXG5cblx0cHVibGljICRyZWdpc3RlckRlYnVnVHlwZXMoZGVidWdUeXBlczogc3RyaW5nW10pIHtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkucmVnaXN0ZXJEZWJ1Z0FkYXB0ZXJGYWN0b3J5KGRlYnVnVHlwZXMsIHRoaXMpKTtcblx0fVxuXG5cdHB1YmxpYyAkcmVnaXN0ZXJCcmVha3BvaW50cyhEVE9zOiBBcnJheTxJU291cmNlTXVsdGlCcmVha3BvaW50RHRvIHwgSUZ1bmN0aW9uQnJlYWtwb2ludER0byB8IElEYXRhQnJlYWtwb2ludER0bz4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGZvciAoY29uc3QgZHRvIG9mIERUT3MpIHtcblx0XHRcdGlmIChkdG8udHlwZSA9PT0gJ3NvdXJjZU11bHRpJykge1xuXHRcdFx0XHRjb25zdCByYXdicHMgPSBkdG8ubGluZXMubWFwKChsKTogSUJyZWFrcG9pbnREYXRhID0+ICh7XG5cdFx0XHRcdFx0aWQ6IGwuaWQsXG5cdFx0XHRcdFx0ZW5hYmxlZDogbC5lbmFibGVkLFxuXHRcdFx0XHRcdGxpbmVOdW1iZXI6IGwubGluZSArIDEsXG5cdFx0XHRcdFx0Y29sdW1uOiBsLmNoYXJhY3RlciA+IDAgPyBsLmNoYXJhY3RlciArIDEgOiB1bmRlZmluZWQsIC8vIGEgY29sdW1uIHZhbHVlIG9mIDAgcmVzdWx0cyBpbiBhbiBvbWl0dGVkIGNvbHVtbiBhdHRyaWJ1dGU7IHNlZSAjNDY3ODRcblx0XHRcdFx0XHRjb25kaXRpb246IGwuY29uZGl0aW9uLFxuXHRcdFx0XHRcdGhpdENvbmRpdGlvbjogbC5oaXRDb25kaXRpb24sXG5cdFx0XHRcdFx0bG9nTWVzc2FnZTogbC5sb2dNZXNzYWdlLFxuXHRcdFx0XHRcdG1vZGU6IGwubW9kZSxcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS5hZGRCcmVha3BvaW50cyh1cmkucmV2aXZlKGR0by51cmkpLCByYXdicHMpO1xuXHRcdFx0fSBlbHNlIGlmIChkdG8udHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS5hZGRGdW5jdGlvbkJyZWFrcG9pbnQoe1xuXHRcdFx0XHRcdG5hbWU6IGR0by5mdW5jdGlvbk5hbWUsXG5cdFx0XHRcdFx0bW9kZTogZHRvLm1vZGUsXG5cdFx0XHRcdFx0Y29uZGl0aW9uOiBkdG8uY29uZGl0aW9uLFxuXHRcdFx0XHRcdGhpdENvbmRpdGlvbjogZHRvLmhpdENvbmRpdGlvbixcblx0XHRcdFx0XHRlbmFibGVkOiBkdG8uZW5hYmxlZCxcblx0XHRcdFx0XHRsb2dNZXNzYWdlOiBkdG8ubG9nTWVzc2FnZVxuXHRcdFx0XHR9LCBkdG8uaWQpO1xuXHRcdFx0fSBlbHNlIGlmIChkdG8udHlwZSA9PT0gJ2RhdGEnKSB7XG5cdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmFkZERhdGFCcmVha3BvaW50KHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogZHRvLmxhYmVsLFxuXHRcdFx0XHRcdHNyYzogeyB0eXBlOiBEYXRhQnJlYWtwb2ludFNldFR5cGUuVmFyaWFibGUsIGRhdGFJZDogZHRvLmRhdGFJZCB9LFxuXHRcdFx0XHRcdGNhblBlcnNpc3Q6IGR0by5jYW5QZXJzaXN0LFxuXHRcdFx0XHRcdGFjY2Vzc1R5cGVzOiBkdG8uYWNjZXNzVHlwZXMsXG5cdFx0XHRcdFx0YWNjZXNzVHlwZTogZHRvLmFjY2Vzc1R5cGUsXG5cdFx0XHRcdFx0bW9kZTogZHRvLm1vZGVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdHB1YmxpYyAkdW5yZWdpc3RlckJyZWFrcG9pbnRzKGJyZWFrcG9pbnRJZHM6IHN0cmluZ1tdLCBmdW5jdGlvbkJyZWFrcG9pbnRJZHM6IHN0cmluZ1tdLCBkYXRhQnJlYWtwb2ludElkczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRicmVha3BvaW50SWRzLmZvckVhY2goaWQgPT4gdGhpcy5kZWJ1Z1NlcnZpY2UucmVtb3ZlQnJlYWtwb2ludHMoaWQpKTtcblx0XHRmdW5jdGlvbkJyZWFrcG9pbnRJZHMuZm9yRWFjaChpZCA9PiB0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVGdW5jdGlvbkJyZWFrcG9pbnRzKGlkKSk7XG5cdFx0ZGF0YUJyZWFrcG9pbnRJZHMuZm9yRWFjaChpZCA9PiB0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVEYXRhQnJlYWtwb2ludHMoaWQpKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRwdWJsaWMgJHJlZ2lzdGVyRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIoZGVidWdUeXBlOiBzdHJpbmcsIHByb3ZpZGVyVHJpZ2dlcktpbmQ6IERlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyVHJpZ2dlcktpbmQsIGhhc1Byb3ZpZGU6IGJvb2xlYW4sIGhhc1Jlc29sdmU6IGJvb2xlYW4sIGhhc1Jlc29sdmUyOiBib29sZWFuLCBoYW5kbGU6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgcHJvdmlkZXI6IElEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlciA9IHtcblx0XHRcdHR5cGU6IGRlYnVnVHlwZSxcblx0XHRcdHRyaWdnZXJLaW5kOiBwcm92aWRlclRyaWdnZXJLaW5kXG5cdFx0fTtcblx0XHRpZiAoaGFzUHJvdmlkZSkge1xuXHRcdFx0cHJvdmlkZXIucHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMgPSAoZm9sZGVyLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zKGhhbmRsZSwgZm9sZGVyLCB0b2tlbik7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRpZiAoaGFzUmVzb2x2ZSkge1xuXHRcdFx0cHJvdmlkZXIucmVzb2x2ZURlYnVnQ29uZmlndXJhdGlvbiA9IChmb2xkZXIsIGNvbmZpZywgdG9rZW4pID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRyZXNvbHZlRGVidWdDb25maWd1cmF0aW9uKGhhbmRsZSwgZm9sZGVyLCBjb25maWcsIHRva2VuKTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdGlmIChoYXNSZXNvbHZlMikge1xuXHRcdFx0cHJvdmlkZXIucmVzb2x2ZURlYnVnQ29uZmlndXJhdGlvbldpdGhTdWJzdGl0dXRlZFZhcmlhYmxlcyA9IChmb2xkZXIsIGNvbmZpZywgdG9rZW4pID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRyZXNvbHZlRGVidWdDb25maWd1cmF0aW9uV2l0aFN1YnN0aXR1dGVkVmFyaWFibGVzKGhhbmRsZSwgZm9sZGVyLCBjb25maWcsIHRva2VuKTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdHRoaXMuX2RlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVycy5zZXQoaGFuZGxlLCBwcm92aWRlcik7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLmRlYnVnU2VydmljZS5nZXRDb25maWd1cmF0aW9uTWFuYWdlcigpLnJlZ2lzdGVyRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIocHJvdmlkZXIpKTtcblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyAkdW5yZWdpc3RlckRlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyKGhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9kZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcnMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKHByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLl9kZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcnMuZGVsZXRlKGhhbmRsZSk7XG5cdFx0XHR0aGlzLmRlYnVnU2VydmljZS5nZXRDb25maWd1cmF0aW9uTWFuYWdlcigpLnVucmVnaXN0ZXJEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcihwcm92aWRlcik7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljICRyZWdpc3RlckRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5KGRlYnVnVHlwZTogc3RyaW5nLCBoYW5kbGU6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgcHJvdmlkZXI6IElEZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeSA9IHtcblx0XHRcdHR5cGU6IGRlYnVnVHlwZSxcblx0XHRcdGNyZWF0ZURlYnVnQWRhcHRlckRlc2NyaXB0b3I6IHNlc3Npb24gPT4ge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX3Byb3h5LiRwcm92aWRlRGVidWdBZGFwdGVyKGhhbmRsZSwgdGhpcy5nZXRTZXNzaW9uRHRvKHNlc3Npb24pKSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yaWVzLnNldChoYW5kbGUsIHByb3ZpZGVyKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkucmVnaXN0ZXJEZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeShwcm92aWRlcikpO1xuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHVibGljICR1bnJlZ2lzdGVyRGVidWdBZGFwdGVyRGVzY3JpcHRvckZhY3RvcnkoaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX2RlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3JpZXMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKHByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yaWVzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0QWRhcHRlck1hbmFnZXIoKS51bnJlZ2lzdGVyRGVidWdBZGFwdGVyRGVzY3JpcHRvckZhY3RvcnkocHJvdmlkZXIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0U2Vzc2lvbihzZXNzaW9uSWQ6IERlYnVnU2Vzc2lvblVVSUQgfCB1bmRlZmluZWQpOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoc2Vzc2lvbklkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9uKHNlc3Npb25JZCwgdHJ1ZSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJHN0YXJ0RGVidWdnaW5nKGZvbGRlcjogVXJpQ29tcG9uZW50cyB8IHVuZGVmaW5lZCwgbmFtZU9yQ29uZmlnOiBzdHJpbmcgfCBJRGVidWdDb25maWd1cmF0aW9uLCBvcHRpb25zOiBJU3RhcnREZWJ1Z2dpbmdPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgZm9sZGVyVXJpID0gZm9sZGVyID8gdXJpLnJldml2ZShmb2xkZXIpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGxhdW5jaCA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldENvbmZpZ3VyYXRpb25NYW5hZ2VyKCkuZ2V0TGF1bmNoKGZvbGRlclVyaSk7XG5cdFx0Y29uc3QgcGFyZW50U2Vzc2lvbiA9IHRoaXMuZ2V0U2Vzc2lvbihvcHRpb25zLnBhcmVudFNlc3Npb25JRCk7XG5cdFx0Y29uc3Qgc2F2ZUJlZm9yZVN0YXJ0ID0gdHlwZW9mIG9wdGlvbnMuc3VwcHJlc3NTYXZlQmVmb3JlU3RhcnQgPT09ICdib29sZWFuJyA/ICFvcHRpb25zLnN1cHByZXNzU2F2ZUJlZm9yZVN0YXJ0IDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGRlYnVnT3B0aW9uczogSURlYnVnU2Vzc2lvbk9wdGlvbnMgPSB7XG5cdFx0XHRub0RlYnVnOiBvcHRpb25zLm5vRGVidWcsXG5cdFx0XHRwYXJlbnRTZXNzaW9uLFxuXHRcdFx0bGlmZWN5Y2xlTWFuYWdlZEJ5UGFyZW50OiBvcHRpb25zLmxpZmVjeWNsZU1hbmFnZWRCeVBhcmVudCxcblx0XHRcdHJlcGw6IG9wdGlvbnMucmVwbCxcblx0XHRcdGNvbXBhY3Q6IG9wdGlvbnMuY29tcGFjdCxcblx0XHRcdGNvbXBvdW5kUm9vdDogcGFyZW50U2Vzc2lvbj8uY29tcG91bmRSb290LFxuXHRcdFx0c2F2ZUJlZm9yZVJlc3RhcnQ6IHNhdmVCZWZvcmVTdGFydCxcblx0XHRcdHRlc3RSdW46IG9wdGlvbnMudGVzdFJ1bixcblxuXHRcdFx0c3VwcHJlc3NEZWJ1Z1N0YXR1c2Jhcjogb3B0aW9ucy5zdXBwcmVzc0RlYnVnU3RhdHVzYmFyLFxuXHRcdFx0c3VwcHJlc3NEZWJ1Z1Rvb2xiYXI6IG9wdGlvbnMuc3VwcHJlc3NEZWJ1Z1Rvb2xiYXIsXG5cdFx0XHRzdXBwcmVzc0RlYnVnVmlldzogb3B0aW9ucy5zdXBwcmVzc0RlYnVnVmlldyxcblx0XHR9O1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWJ1Z1NlcnZpY2Uuc3RhcnREZWJ1Z2dpbmcobGF1bmNoLCBuYW1lT3JDb25maWcsIGRlYnVnT3B0aW9ucywgc2F2ZUJlZm9yZVN0YXJ0KTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvck5vVGVsZW1ldHJ5KGVyciAmJiBlcnIubWVzc2FnZSA/IGVyci5tZXNzYWdlIDogJ2Nhbm5vdCBzdGFydCBkZWJ1Z2dpbmcnKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgJHNldERlYnVnU2Vzc2lvbk5hbWUoc2Vzc2lvbklkOiBEZWJ1Z1Nlc3Npb25VVUlELCBuYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9uKHNlc3Npb25JZCk7XG5cdFx0c2Vzc2lvbj8uc2V0TmFtZShuYW1lKTtcblx0fVxuXG5cdHB1YmxpYyAkY3VzdG9tRGVidWdBZGFwdGVyUmVxdWVzdChzZXNzaW9uSWQ6IERlYnVnU2Vzc2lvblVVSUQsIHJlcXVlc3Q6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9uKHNlc3Npb25JZCwgdHJ1ZSk7XG5cdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdHJldHVybiBzZXNzaW9uLmN1c3RvbVJlcXVlc3QocmVxdWVzdCwgYXJncykudGhlbihyZXNwb25zZSA9PiB7XG5cdFx0XHRcdGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3BvbnNlLmJvZHk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvck5vVGVsZW1ldHJ5KHJlc3BvbnNlID8gcmVzcG9uc2UubWVzc2FnZSA6ICdjdXN0b20gcmVxdWVzdCBmYWlsZWQnKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yTm9UZWxlbWV0cnkoJ2RlYnVnIHNlc3Npb24gbm90IGZvdW5kJykpO1xuXHR9XG5cblx0cHVibGljICRnZXREZWJ1Z1Byb3RvY29sQnJlYWtwb2ludChzZXNzaW9uSWQ6IERlYnVnU2Vzc2lvblVVSUQsIGJyZWFrcG9pbklkOiBzdHJpbmcpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludCB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb24oc2Vzc2lvbklkLCB0cnVlKTtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShzZXNzaW9uLmdldERlYnVnUHJvdG9jb2xCcmVha3BvaW50KGJyZWFrcG9pbklkKSk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3JOb1RlbGVtZXRyeSgnZGVidWcgc2Vzc2lvbiBub3QgZm91bmQnKSk7XG5cdH1cblxuXHRwdWJsaWMgJHN0b3BEZWJ1Z2dpbmcoc2Vzc2lvbklkOiBEZWJ1Z1Nlc3Npb25VVUlEIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHNlc3Npb25JZCkge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbihzZXNzaW9uSWQsIHRydWUpO1xuXHRcdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZGVidWdTZXJ2aWNlLnN0b3BTZXNzaW9uKHNlc3Npb24sIGlzU2Vzc2lvbkF0dGFjaChzZXNzaW9uKSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcdC8vIHN0b3AgYWxsXG5cdFx0XHRyZXR1cm4gdGhpcy5kZWJ1Z1NlcnZpY2Uuc3RvcFNlc3Npb24odW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvck5vVGVsZW1ldHJ5KCdkZWJ1ZyBzZXNzaW9uIG5vdCBmb3VuZCcpKTtcblx0fVxuXG5cdHB1YmxpYyAkYXBwZW5kRGVidWdDb25zb2xlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyBVc2Ugd2FybmluZyBhcyBzZXZlcml0eSB0byBnZXQgdGhlIG9yYW5nZSBjb2xvciBmb3IgbWVzc2FnZXMgY29taW5nIGZyb20gdGhlIGRlYnVnIGV4dGVuc2lvblxuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRzZXNzaW9uPy5hcHBlbmRUb1JlcGwoeyBvdXRwdXQ6IHZhbHVlLCBzZXY6IHNldmVyaXR5Lldhcm5pbmcgfSk7XG5cdH1cblxuXHRwdWJsaWMgJGFjY2VwdERBTWVzc2FnZShoYW5kbGU6IG51bWJlciwgbWVzc2FnZTogRGVidWdQcm90b2NvbC5Qcm90b2NvbE1lc3NhZ2UpIHtcblx0XHR0aGlzLmdldERlYnVnQWRhcHRlcihoYW5kbGUpLmFjY2VwdE1lc3NhZ2UoY29udmVydFRvVlNDUGF0aHMobWVzc2FnZSwgZmFsc2UpKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0REFFcnJvcihoYW5kbGU6IG51bWJlciwgbmFtZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIHN0YWNrOiBzdHJpbmcpIHtcblx0XHQvLyBkb24ndCB1c2UgZ2V0RGVidWdBZGFwdGVyIHNpbmNlIGFuIGVycm9yIGNhbiBiZSBleHBlY3RlZCBvbiBhIHBvc3QtY2xvc2Vcblx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJzLmdldChoYW5kbGUpPy5maXJlRXJyb3IoaGFuZGxlLCBuZXcgRXJyb3IoYCR7bmFtZX06ICR7bWVzc2FnZX1cXG4ke3N0YWNrfWApKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0REFFeGl0KGhhbmRsZTogbnVtYmVyLCBjb2RlOiBudW1iZXIsIHNpZ25hbDogc3RyaW5nKSB7XG5cdFx0Ly8gZG9uJ3QgdXNlIGdldERlYnVnQWRhcHRlciBzaW5jZSBhbiBlcnJvciBjYW4gYmUgZXhwZWN0ZWQgb24gYSBwb3N0LWNsb3NlXG5cdFx0dGhpcy5fZGVidWdBZGFwdGVycy5nZXQoaGFuZGxlKT8uZmlyZUV4aXQoaGFuZGxlLCBjb2RlLCBzaWduYWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREZWJ1Z0FkYXB0ZXIoaGFuZGxlOiBudW1iZXIpOiBFeHRlbnNpb25Ib3N0RGVidWdBZGFwdGVyIHtcblx0XHRjb25zdCBhZGFwdGVyID0gdGhpcy5fZGVidWdBZGFwdGVycy5nZXQoaGFuZGxlKTtcblx0XHRpZiAoIWFkYXB0ZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkZWJ1ZyBhZGFwdGVyJyk7XG5cdFx0fVxuXHRcdHJldHVybiBhZGFwdGVyO1xuXHR9XG5cblx0Ly8gZHRvIGhlbHBlcnNcblxuXHRwdWJsaWMgJHNlc3Npb25DYWNoZWQoc2Vzc2lvbklEOiBzdHJpbmcpIHtcblx0XHQvLyByZW1lbWJlciB0aGF0IHRoZSBFSCBoYXMgY2FjaGVkIHRoZSBzZXNzaW9uIGFuZCB3ZSBkbyBub3QgaGF2ZSB0byBzZW5kIGl0IGFnYWluXG5cdFx0dGhpcy5fZXh0SG9zdEtub3duU2Vzc2lvbnMuYWRkKHNlc3Npb25JRCk7XG5cdH1cblxuXG5cdGdldFNlc3Npb25EdG8oc2Vzc2lvbjogdW5kZWZpbmVkKTogdW5kZWZpbmVkO1xuXHRnZXRTZXNzaW9uRHRvKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24pOiBJRGVidWdTZXNzaW9uRHRvO1xuXHRnZXRTZXNzaW9uRHRvKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQpOiBJRGVidWdTZXNzaW9uRHRvIHwgdW5kZWZpbmVkO1xuXHRnZXRTZXNzaW9uRHRvKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQpOiBJRGVidWdTZXNzaW9uRHRvIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbklEID0gPERlYnVnU2Vzc2lvblVVSUQ+c2Vzc2lvbi5nZXRJZCgpO1xuXHRcdFx0aWYgKHRoaXMuX2V4dEhvc3RLbm93blNlc3Npb25zLmhhcyhzZXNzaW9uSUQpKSB7XG5cdFx0XHRcdHJldHVybiBzZXNzaW9uSUQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyB0aGlzLl9zZXNzaW9ucy5hZGQoc2Vzc2lvbklEKTsgXHQvLyAjNjk1MzQ6IHNlZSAkc2Vzc2lvbkNhY2hlZCBhYm92ZVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGlkOiBzZXNzaW9uSUQsXG5cdFx0XHRcdFx0dHlwZTogc2Vzc2lvbi5jb25maWd1cmF0aW9uLnR5cGUsXG5cdFx0XHRcdFx0bmFtZTogc2Vzc2lvbi5uYW1lLFxuXHRcdFx0XHRcdGZvbGRlclVyaTogc2Vzc2lvbi5yb290ID8gc2Vzc2lvbi5yb290LnVyaSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRjb25maWd1cmF0aW9uOiBzZXNzaW9uLmNvbmZpZ3VyYXRpb24sXG5cdFx0XHRcdFx0cGFyZW50OiBzZXNzaW9uLnBhcmVudFNlc3Npb24/LmdldElkKCksXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGNvbnZlcnRUb0R0byhicHM6IChSZWFkb25seUFycmF5PElCcmVha3BvaW50IHwgSUZ1bmN0aW9uQnJlYWtwb2ludCB8IElEYXRhQnJlYWtwb2ludCB8IElJbnN0cnVjdGlvbkJyZWFrcG9pbnQ+KSk6IEFycmF5PElTb3VyY2VCcmVha3BvaW50RHRvIHwgSUZ1bmN0aW9uQnJlYWtwb2ludER0byB8IElEYXRhQnJlYWtwb2ludER0bz4ge1xuXHRcdHJldHVybiBicHMubWFwKGJwID0+IHtcblx0XHRcdGlmICgnbmFtZScgaW4gYnApIHtcblx0XHRcdFx0Y29uc3QgZmJwOiBJRnVuY3Rpb25CcmVha3BvaW50ID0gYnA7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Z1bmN0aW9uJyxcblx0XHRcdFx0XHRpZDogZmJwLmdldElkKCksXG5cdFx0XHRcdFx0ZW5hYmxlZDogZmJwLmVuYWJsZWQsXG5cdFx0XHRcdFx0Y29uZGl0aW9uOiBmYnAuY29uZGl0aW9uLFxuXHRcdFx0XHRcdGhpdENvbmRpdGlvbjogZmJwLmhpdENvbmRpdGlvbixcblx0XHRcdFx0XHRsb2dNZXNzYWdlOiBmYnAubG9nTWVzc2FnZSxcblx0XHRcdFx0XHRmdW5jdGlvbk5hbWU6IGZicC5uYW1lXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElGdW5jdGlvbkJyZWFrcG9pbnREdG87XG5cdFx0XHR9IGVsc2UgaWYgKCdzcmMnIGluIGJwKSB7XG5cdFx0XHRcdGNvbnN0IGRicDogSURhdGFCcmVha3BvaW50ID0gYnA7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ2RhdGEnLFxuXHRcdFx0XHRcdGlkOiBkYnAuZ2V0SWQoKSxcblx0XHRcdFx0XHRkYXRhSWQ6IGRicC5zcmMudHlwZSA9PT0gRGF0YUJyZWFrcG9pbnRTZXRUeXBlLlZhcmlhYmxlID8gZGJwLnNyYy5kYXRhSWQgOiBkYnAuc3JjLmFkZHJlc3MsXG5cdFx0XHRcdFx0ZW5hYmxlZDogZGJwLmVuYWJsZWQsXG5cdFx0XHRcdFx0Y29uZGl0aW9uOiBkYnAuY29uZGl0aW9uLFxuXHRcdFx0XHRcdGhpdENvbmRpdGlvbjogZGJwLmhpdENvbmRpdGlvbixcblx0XHRcdFx0XHRsb2dNZXNzYWdlOiBkYnAubG9nTWVzc2FnZSxcblx0XHRcdFx0XHRhY2Nlc3NUeXBlOiBkYnAuYWNjZXNzVHlwZSxcblx0XHRcdFx0XHRsYWJlbDogZGJwLmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdGNhblBlcnNpc3Q6IGRicC5jYW5QZXJzaXN0XG5cdFx0XHRcdH0gc2F0aXNmaWVzIElEYXRhQnJlYWtwb2ludER0bztcblx0XHRcdH0gZWxzZSBpZiAoJ3VyaScgaW4gYnApIHtcblx0XHRcdFx0Y29uc3Qgc2JwOiBJQnJlYWtwb2ludCA9IGJwO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHR5cGU6ICdzb3VyY2UnLFxuXHRcdFx0XHRcdGlkOiBzYnAuZ2V0SWQoKSxcblx0XHRcdFx0XHRlbmFibGVkOiBzYnAuZW5hYmxlZCxcblx0XHRcdFx0XHRjb25kaXRpb246IHNicC5jb25kaXRpb24sXG5cdFx0XHRcdFx0aGl0Q29uZGl0aW9uOiBzYnAuaGl0Q29uZGl0aW9uLFxuXHRcdFx0XHRcdGxvZ01lc3NhZ2U6IHNicC5sb2dNZXNzYWdlLFxuXHRcdFx0XHRcdHVyaTogc2JwLnVyaSxcblx0XHRcdFx0XHRsaW5lOiBzYnAubGluZU51bWJlciA+IDAgPyBzYnAubGluZU51bWJlciAtIDEgOiAwLFxuXHRcdFx0XHRcdGNoYXJhY3RlcjogKHR5cGVvZiBzYnAuY29sdW1uID09PSAnbnVtYmVyJyAmJiBzYnAuY29sdW1uID4gMCkgPyBzYnAuY29sdW1uIC0gMSA6IDAsXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElTb3VyY2VCcmVha3BvaW50RHRvO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KS5maWx0ZXIoaXNEZWZpbmVkKTtcblx0fVxufVxuXG4vKipcbiAqIERlYnVnQWRhcHRlciB0aGF0IGNvbW11bmljYXRlcyB2aWEgZXh0ZW5zaW9uIHByb3RvY29sIHdpdGggYW5vdGhlciBkZWJ1ZyBhZGFwdGVyLlxuICovXG5jbGFzcyBFeHRlbnNpb25Ib3N0RGVidWdBZGFwdGVyIGV4dGVuZHMgQWJzdHJhY3REZWJ1Z0FkYXB0ZXIge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgX2RzOiBNYWluVGhyZWFkRGVidWdTZXJ2aWNlLCBwcml2YXRlIF9oYW5kbGU6IG51bWJlciwgcHJpdmF0ZSBfcHJveHk6IEV4dEhvc3REZWJ1Z1NlcnZpY2VTaGFwZSwgcmVhZG9ubHkgc2Vzc2lvbjogSURlYnVnU2Vzc2lvbikge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRmaXJlRXJyb3IoaGFuZGxlOiBudW1iZXIsIGVycjogRXJyb3IpIHtcblx0XHR0aGlzLl9vbkVycm9yLmZpcmUoZXJyKTtcblx0fVxuXG5cdGZpcmVFeGl0KGhhbmRsZTogbnVtYmVyLCBjb2RlOiBudW1iZXIsIHNpZ25hbDogc3RyaW5nKSB7XG5cdFx0dGhpcy5fb25FeGl0LmZpcmUoY29kZSk7XG5cdH1cblxuXHRzdGFydFNlc3Npb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9wcm94eS4kc3RhcnREQVNlc3Npb24odGhpcy5faGFuZGxlLCB0aGlzLl9kcy5nZXRTZXNzaW9uRHRvKHRoaXMuc2Vzc2lvbikpKTtcblx0fVxuXG5cdHNlbmRNZXNzYWdlKG1lc3NhZ2U6IERlYnVnUHJvdG9jb2wuUHJvdG9jb2xNZXNzYWdlKTogdm9pZCB7XG5cdFx0dGhpcy5fcHJveHkuJHNlbmREQU1lc3NhZ2UodGhpcy5faGFuZGxlLCBjb252ZXJ0VG9EQVBhdGhzKG1lc3NhZ2UsIHRydWUpKTtcblx0fVxuXG5cdGFzeW5jIHN0b3BTZXNzaW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuY2FuY2VsUGVuZGluZ1JlcXVlc3RzKCk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9wcm94eS4kc3RvcERBU2Vzc2lvbih0aGlzLl9oYW5kbGUpKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWUsaUJBQThCLG9CQUFvQjtBQUMxRSxTQUFTLE9BQU8sV0FBMEI7QUFDMUMsU0FBUyxlQUFrUyxxQkFBcUIsNkJBQTZCO0FBQzdWO0FBQUEsRUFDQztBQUFBLEVBQXlGO0FBQUEsT0FFbkY7QUFDUCxTQUFTLDRCQUE2QztBQUN0RCxPQUFPLGNBQWM7QUFDckIsU0FBUyw0QkFBNEI7QUFFckMsU0FBUyxtQkFBbUIsa0JBQWtCLHVCQUF1QjtBQUNyRSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxpQkFBaUI7QUFHbkIsSUFBTSx5QkFBTixNQUEwRjtBQUFBLEVBWWhHLFlBQ0MsZ0JBQ2dDLGNBQ1UsbUJBQ3pDO0FBRitCO0FBQ1U7QUFaM0MsU0FBaUIsYUFBYSxJQUFJLGdCQUFnQjtBQUVsRCxTQUFRLDhCQUE4QjtBQUl0QyxTQUFp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
