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
import { coalesce } from "../../../base/common/arrays.js";
import { asPromise } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable as DisposableCls, toDisposable } from "../../../base/common/lifecycle.js";
import { ThemeIcon as ThemeIconUtils } from "../../../base/common/themables.js";
import { URI } from "../../../base/common/uri.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { AbstractDebugAdapter } from "../../contrib/debug/common/abstractDebugAdapter.js";
import { DebugVisualizationType } from "../../contrib/debug/common/debug.js";
import { convertToDAPaths, convertToVSCPaths, isDebuggerMainContribution } from "../../contrib/debug/common/debugUtils.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostCommands } from "./extHostCommands.js";
import { IExtHostConfiguration } from "./extHostConfiguration.js";
import { IExtHostEditorTabs } from "./extHostEditorTabs.js";
import { IExtHostExtensionService } from "./extHostExtensionService.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { IExtHostTesting } from "./extHostTesting.js";
import * as Convert from "./extHostTypeConverters.js";
import { DataBreakpoint, DebugAdapterExecutable, DebugAdapterInlineImplementation, DebugAdapterNamedPipeServer, DebugAdapterServer, DebugConsoleMode, DebugStackFrame, DebugThread, Disposable, FunctionBreakpoint, Location, Position, setBreakpointId, SourceBreakpoint, ThemeIcon } from "./extHostTypes.js";
import { IExtHostVariableResolverProvider } from "./extHostVariableResolverService.js";
import { IExtHostWorkspace } from "./extHostWorkspace.js";
const IExtHostDebugService = createDecorator("IExtHostDebugService");
let ExtHostDebugServiceBase = class extends DisposableCls {
  constructor(extHostRpcService, _workspaceService, _extensionService, _configurationService, _editorTabs, _variableResolver, _commands, _testing) {
    super();
    this._workspaceService = _workspaceService;
    this._extensionService = _extensionService;
    this._configurationService = _configurationService;
    this._editorTabs = _editorTabs;
    this._variableResolver = _variableResolver;
    this._commands = _commands;
    this._testing = _testing;
    this._debugSessions = /* @__PURE__ */ new Map();
    this._debugVisualizationTreeItemIdsCounter = 0;
    this._debugVisualizationProviders = /* @__PURE__ */ new Map();
    this._debugVisualizationTrees = /* @__PURE__ */ new Map();
    this._debugVisualizationTreeItemIds = /* @__PURE__ */ new WeakMap();
    this._debugVisualizationElements = /* @__PURE__ */ new Map();
    this._visualizers = /* @__PURE__ */ new Map();
    this._visualizerIdCounter = 0;
    this._configProviderHandleCounter = 0;
    this._configProviders = [];
    this._adapterFactoryHandleCounter = 0;
    this._adapterFactories = [];
    this._trackerFactoryHandleCounter = 0;
    this._trackerFactories = [];
    this._debugAdapters = /* @__PURE__ */ new Map();
    this._debugAdaptersTrackers = /* @__PURE__ */ new Map();
    this._onDidStartDebugSession = this._register(new Emitter());
    this._onDidTerminateDebugSession = this._register(new Emitter());
    this._onDidChangeActiveDebugSession = this._register(new Emitter());
    this._onDidReceiveDebugSessionCustomEvent = this._register(new Emitter());
    this._debugServiceProxy = extHostRpcService.getProxy(MainContext.MainThreadDebugService);
    this._onDidChangeBreakpoints = this._register(new Emitter());
    this._onDidChangeActiveStackItem = this._register(new Emitter());
    this._activeDebugConsole = new ExtHostDebugConsole(this._debugServiceProxy);
    this._breakpoints = /* @__PURE__ */ new Map();
    this._extensionService.getExtensionRegistry().then((extensionRegistry) => {
      this._register(extensionRegistry.onDidChange((_) => {
        this.registerAllDebugTypes(extensionRegistry);
      }));
      this.registerAllDebugTypes(extensionRegistry);
    });
    this._telemetryProxy = extHostRpcService.getProxy(MainContext.MainThreadTelemetry);
  }
  get onDidStartDebugSession() {
    return this._onDidStartDebugSession.event;
  }
  get onDidTerminateDebugSession() {
    return this._onDidTerminateDebugSession.event;
  }
  get onDidChangeActiveDebugSession() {
    return this._onDidChangeActiveDebugSession.event;
  }
  get activeDebugSession() {
    return this._activeDebugSession?.api;
  }
  get onDidReceiveDebugSessionCustomEvent() {
    return this._onDidReceiveDebugSessionCustomEvent.event;
  }
  get activeDebugConsole() {
    return this._activeDebugConsole.value;
  }
  async $getVisualizerTreeItem(treeId, element) {
    const context = this.hydrateVisualizationContext(element);
    if (!context) {
      return void 0;
    }
    const item = await this._debugVisualizationTrees.get(treeId)?.getTreeItem?.(context);
    return item ? this.convertVisualizerTreeItem(treeId, item) : void 0;
  }
  registerDebugVisualizationTree(manifest, id, provider) {
    const extensionId = ExtensionIdentifier.toKey(manifest.identifier);
    const key = this.extensionVisKey(extensionId, id);
    if (this._debugVisualizationProviders.has(key)) {
      throw new Error(`A debug visualization provider with id '${id}' is already registered`);
    }
    this._debugVisualizationTrees.set(key, provider);
    this._debugServiceProxy.$registerDebugVisualizerTree(key, !!provider.editItem);
    return toDisposable(() => {
      this._debugServiceProxy.$unregisterDebugVisualizerTree(key);
      this._debugVisualizationTrees.delete(id);
    });
  }
  async $getVisualizerTreeItemChildren(treeId, element) {
    const item = this._debugVisualizationElements.get(element)?.item;
    if (!item) {
      return [];
    }
    const children = await this._debugVisualizationTrees.get(treeId)?.getChildren?.(item);
    return children?.map((i) => this.convertVisualizerTreeItem(treeId, i)) || [];
  }
  async $editVisualizerTreeItem(element, value) {
    const e = this._debugVisualizationElements.get(element);
    if (!e) {
      return void 0;
    }
    const r = await this._debugVisualizationTrees.get(e.provider)?.editItem?.(e.item, value);
    return this.convertVisualizerTreeItem(e.provider, r || e.item);
  }
  $disposeVisualizedTree(element) {
    const root = this._debugVisualizationElements.get(element);
    if (!root) {
      return;
    }
    const queue = [root.children];
    for (const children of queue) {
      if (children) {
        for (const child of children) {
          queue.push(this._debugVisualizationElements.get(child)?.children);
          this._debugVisualizationElements.delete(child);
        }
      }
    }
  }
  convertVisualizerTreeItem(treeId, item) {
    let id = this._debugVisualizationTreeItemIds.get(item);
    if (!id) {
      id = this._debugVisualizationTreeItemIdsCounter++;
      this._debugVisualizationTreeItemIds.set(item, id);
      this._debugVisualizationElements.set(id, { provider: treeId, item });
    }
    return Convert.DebugTreeItem.from(item, id);
  }
  asDebugSourceUri(src, session) {
    const source = src;
    if (typeof source.sourceReference === "number" && source.sourceReference > 0) {
      let debug = `debug:${encodeURIComponent(source.path || "")}`;
      let sep = "?";
      if (session) {
        debug += `${sep}session=${encodeURIComponent(session.id)}`;
        sep = "&";
      }
      debug += `${sep}ref=${source.sourceReference}`;
      return URI.parse(debug);
    } else if (source.path) {
      return URI.file(source.path);
    } else {
      throw new Error(`cannot create uri from DAP 'source' object; properties 'path' and 'sourceReference' are both missing.`);
    }
  }
  registerAllDebugTypes(extensionRegistry) {
    const debugTypes = [];
    for (const ed of extensionRegistry.getAllExtensionDescriptions()) {
      if (ed.contributes) {
        const debuggers = ed.contributes["debuggers"];
        if (debuggers && debuggers.length > 0) {
          for (const dbg of debuggers) {
            if (isDebuggerMainContribution(dbg)) {
              debugTypes.push(dbg.type);
            }
          }
        }
      }
    }
    this._debugServiceProxy.$registerDebugTypes(debugTypes);
  }
  // extension debug API
  get activeStackItem() {
    return this._activeStackItem;
  }
  get onDidChangeActiveStackItem() {
    return this._onDidChangeActiveStackItem.event;
  }
  get onDidChangeBreakpoints() {
    return this._onDidChangeBreakpoints.event;
  }
  get breakpoints() {
    const result = [];
    this._breakpoints.forEach((bp) => result.push(bp));
    return result;
  }
  async $resolveDebugVisualizer(id, token) {
    const visualizer = this._visualizers.get(id);
    if (!visualizer) {
      throw new Error(`No debug visualizer found with id '${id}'`);
    }
    let { v, provider, extensionId } = visualizer;
    if (!v.visualization) {
      v = await provider.resolveDebugVisualization?.(v, token) || v;
      visualizer.v = v;
    }
    if (!v.visualization) {
      throw new Error(`No visualization returned from resolveDebugVisualization in '${provider}'`);
    }
    return this.serializeVisualization(extensionId, v.visualization);
  }
  async $executeDebugVisualizerCommand(id) {
    const visualizer = this._visualizers.get(id);
    if (!visualizer) {
      throw new Error(`No debug visualizer found with id '${id}'`);
    }
    const command = visualizer.v.visualization;
    if (command && "command" in command) {
      this._commands.executeCommand(command.command, ...command.arguments || []);
    }
  }
  hydrateVisualizationContext(context) {
    const session = this._debugSessions.get(context.sessionId);
    return session && {
      session: session.api,
      variable: context.variable,
      containerId: context.containerId,
      frameId: context.frameId,
      threadId: context.threadId
    };
  }
  async $provideDebugVisualizers(extensionId, id, context, token) {
    const contextHydrated = this.hydrateVisualizationContext(context);
    const key = this.extensionVisKey(extensionId, id);
    const provider = this._debugVisualizationProviders.get(key);
    if (!contextHydrated || !provider) {
      return [];
    }
    const visualizations = await provider.provideDebugVisualization(contextHydrated, token);
    if (!visualizations) {
      return [];
    }
    return visualizations.map((v) => {
      const id2 = ++this._visualizerIdCounter;
      this._visualizers.set(id2, { v, provider, extensionId });
      const icon = v.iconPath ? this.getIconPathOrClass(v.iconPath) : void 0;
      return {
        id: id2,
        name: v.name,
        iconClass: icon?.iconClass,
        iconPath: icon?.iconPath,
        visualization: this.serializeVisualization(extensionId, v.visualization)
      };
    });
  }
  $disposeDebugVisualizers(ids) {
    for (const id of ids) {
      this._visualizers.delete(id);
    }
  }
  registerDebugVisualizationProvider(manifest, id, provider) {
    if (!manifest.contributes?.debugVisualizers?.some((r) => r.id === id)) {
      throw new Error(`Extensions may only call registerDebugVisualizationProvider() for renderers they contribute (got ${id})`);
    }
    const extensionId = ExtensionIdentifier.toKey(manifest.identifier);
    const key = this.extensionVisKey(extensionId, id);
    if (this._debugVisualizationProviders.has(key)) {
      throw new Error(`A debug visualization provider with id '${id}' is already registered`);
    }
    this._debugVisualizationProviders.set(key, provider);
    this._debugServiceProxy.$registerDebugVisualizer(extensionId, id);
    return toDisposable(() => {
      this._debugServiceProxy.$unregisterDebugVisualizer(extensionId, id);
      this._debugVisualizationProviders.delete(id);
    });
  }
  addBreakpoints(breakpoints0) {
    const breakpoints = breakpoints0.filter((bp) => {
      const id = bp.id;
      if (!this._breakpoints.has(id)) {
        this._breakpoints.set(id, bp);
        return true;
      }
      return false;
    });
    this.fireBreakpointChanges(breakpoints, [], []);
    const dtos = [];
    const map = /* @__PURE__ */ new Map();
    for (const bp of breakpoints) {
      if (bp instanceof SourceBreakpoint) {
        let dto = map.get(bp.location.uri.toString());
        if (!dto) {
          dto = {
            type: "sourceMulti",
            uri: bp.location.uri,
            lines: []
          };
          map.set(bp.location.uri.toString(), dto);
          dtos.push(dto);
        }
        dto.lines.push({
          id: bp.id,
          enabled: bp.enabled,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          line: bp.location.range.start.line,
          character: bp.location.range.start.character,
          mode: bp.mode
        });
      } else if (bp instanceof FunctionBreakpoint) {
        dtos.push({
          type: "function",
          id: bp.id,
          enabled: bp.enabled,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          condition: bp.condition,
          functionName: bp.functionName,
          mode: bp.mode
        });
      }
    }
    return this._debugServiceProxy.$registerBreakpoints(dtos);
  }
  removeBreakpoints(breakpoints0) {
    const breakpoints = breakpoints0.filter((b) => this._breakpoints.delete(b.id));
    this.fireBreakpointChanges([], breakpoints, []);
    const ids = breakpoints.filter((bp) => bp instanceof SourceBreakpoint).map((bp) => bp.id);
    const fids = breakpoints.filter((bp) => bp instanceof FunctionBreakpoint).map((bp) => bp.id);
    const dids = breakpoints.filter((bp) => bp instanceof DataBreakpoint).map((bp) => bp.id);
    return this._debugServiceProxy.$unregisterBreakpoints(ids, fids, dids);
  }
  startDebugging(folder, nameOrConfig, options) {
    const testRunMeta = options.testRun && this._testing.getMetadataForRun(options.testRun);
    return this._debugServiceProxy.$startDebugging(folder ? folder.uri : void 0, nameOrConfig, {
      parentSessionID: options.parentSession ? options.parentSession.id : void 0,
      lifecycleManagedByParent: options.lifecycleManagedByParent,
      repl: options.consoleMode === DebugConsoleMode.MergeWithParent ? "mergeWithParent" : "separate",
      noDebug: options.noDebug,
      compact: options.compact,
      suppressSaveBeforeStart: options.suppressSaveBeforeStart,
      testRun: testRunMeta && {
        runId: testRunMeta.runId,
        taskId: testRunMeta.taskId
      },
      // Check debugUI for back-compat, #147264
      suppressDebugStatusbar: options.suppressDebugStatusbar ?? options.debugUI?.simple,
      suppressDebugToolbar: options.suppressDebugToolbar ?? options.debugUI?.simple,
      suppressDebugView: options.suppressDebugView ?? options.debugUI?.simple
    });
  }
  stopDebugging(session) {
    return this._debugServiceProxy.$stopDebugging(session ? session.id : void 0);
  }
  registerDebugConfigurationProvider(type, provider, trigger) {
    if (!provider) {
      return new Disposable(() => {
      });
    }
    const handle = this._configProviderHandleCounter++;
    this._configProviders.push({ type, handle, provider });
    this._debugServiceProxy.$registerDebugConfigurationProvider(
      type,
      trigger,
      !!provider.provideDebugConfigurations,
      !!provider.resolveDebugConfiguration,
      !!provider.resolveDebugConfigurationWithSubstitutedVariables,
      handle
    );
    return new Disposable(() => {
      this._configProviders = this._configProviders.filter((p) => p.provider !== provider);
      this._debugServiceProxy.$unregisterDebugConfigurationProvider(handle);
    });
  }
  registerDebugAdapterDescriptorFactory(extension, type, factory) {
    if (!factory) {
      return new Disposable(() => {
      });
    }
    if (!this.definesDebugType(extension, type)) {
      throw new Error(`a DebugAdapterDescriptorFactory can only be registered from the extension that defines the '${type}' debugger.`);
    }
    if (this.getAdapterDescriptorFactoryByType(type)) {
      throw new Error(`a DebugAdapterDescriptorFactory can only be registered once per a type.`);
    }
    const handle = this._adapterFactoryHandleCounter++;
    this._adapterFactories.push({ type, handle, factory });
    this._debugServiceProxy.$registerDebugAdapterDescriptorFactory(type, handle);
    return new Disposable(() => {
      this._adapterFactories = this._adapterFactories.filter((p) => p.factory !== factory);
      this._debugServiceProxy.$unregisterDebugAdapterDescriptorFactory(handle);
    });
  }
  registerDebugAdapterTrackerFactory(type, factory) {
    if (!factory) {
      return new Disposable(() => {
      });
    }
    const handle = this._trackerFactoryHandleCounter++;
    this._trackerFactories.push({ type, handle, factory });
    return new Disposable(() => {
      this._trackerFactories = this._trackerFactories.filter((p) => p.factory !== factory);
    });
  }
  // RPC methods (ExtHostDebugServiceShape)
  async $runInTerminal(args, sessionId) {
    return Promise.resolve(void 0);
  }
  async $substituteVariables(folderUri, config) {
    let ws;
    const folder = await this.getFolder(folderUri);
    if (folder) {
      ws = {
        uri: folder.uri,
        name: folder.name,
        index: folder.index,
        toResource: () => {
          throw new Error("Not implemented");
        }
      };
    }
    const variableResolver = await this._variableResolver.getResolver();
    return variableResolver.resolveAsync(ws, config);
  }
  createDebugAdapter(adapter, session) {
    if (adapter instanceof DebugAdapterInlineImplementation) {
      return new DirectDebugAdapter(adapter.implementation);
    }
    return void 0;
  }
  createSignService() {
    return void 0;
  }
  async $startDASession(debugAdapterHandle, sessionDto) {
    const mythis = this;
    const session = await this.getSession(sessionDto);
    return this.getAdapterDescriptor(this.getAdapterDescriptorFactoryByType(session.type), session).then((daDescriptor) => {
      if (!daDescriptor) {
        throw new Error(`Couldn't find a debug adapter descriptor for debug type '${session.type}' (extension might have failed to activate)`);
      }
      const da = this.createDebugAdapter(daDescriptor, session);
      if (!da) {
        throw new Error(`Couldn't create a debug adapter for type '${session.type}'.`);
      }
      const debugAdapter = da;
      this._debugAdapters.set(debugAdapterHandle, debugAdapter);
      return this.getDebugAdapterTrackers(session).then((tracker) => {
        if (tracker) {
          this._debugAdaptersTrackers.set(debugAdapterHandle, tracker);
        }
        debugAdapter.onMessage(async (message) => {
          if (message.type === "request" && message.command === "handshake") {
            const request = message;
            const response = {
              type: "response",
              seq: 0,
              command: request.command,
              request_seq: request.seq,
              success: true
            };
            if (!this._signService) {
              this._signService = this.createSignService();
            }
            try {
              if (this._signService) {
                const signature = await this._signService.sign(request.arguments.value);
                response.body = {
                  signature
                };
                debugAdapter.sendResponse(response);
              } else {
                throw new Error("no signer");
              }
            } catch (e) {
              response.success = false;
              response.message = e.message;
              debugAdapter.sendResponse(response);
            }
          } else {
            if (tracker && tracker.onDidSendMessage) {
              tracker.onDidSendMessage(message);
            }
            try {
              message = convertToVSCPaths(message, true);
            } catch (e) {
              const type = message.type + "_" + (message.command ?? message.event ?? "");
              this._telemetryProxy.$publicLog2("debugProtocolMessageError", { type, from: session.type });
              throw e;
            }
            mythis._debugServiceProxy.$acceptDAMessage(debugAdapterHandle, message);
          }
        });
        debugAdapter.onError((err) => {
          if (tracker && tracker.onError) {
            tracker.onError(err);
          }
          this._debugServiceProxy.$acceptDAError(debugAdapterHandle, err.name, err.message, err.stack);
        });
        debugAdapter.onExit((code) => {
          if (tracker && tracker.onExit) {
            tracker.onExit(code ?? void 0, void 0);
          }
          this._debugServiceProxy.$acceptDAExit(debugAdapterHandle, code ?? void 0, void 0);
        });
        if (tracker && tracker.onWillStartSession) {
          tracker.onWillStartSession();
        }
        return debugAdapter.startSession();
      });
    });
  }
  $sendDAMessage(debugAdapterHandle, message) {
    message = convertToDAPaths(message, false);
    const tracker = this._debugAdaptersTrackers.get(debugAdapterHandle);
    if (tracker && tracker.onWillReceiveMessage) {
      tracker.onWillReceiveMessage(message);
    }
    const da = this._debugAdapters.get(debugAdapterHandle);
    da?.sendMessage(message);
  }
  $stopDASession(debugAdapterHandle) {
    const tracker = this._debugAdaptersTrackers.get(debugAdapterHandle);
    this._debugAdaptersTrackers.delete(debugAdapterHandle);
    if (tracker && tracker.onWillStopSession) {
      tracker.onWillStopSession();
    }
    const da = this._debugAdapters.get(debugAdapterHandle);
    this._debugAdapters.delete(debugAdapterHandle);
    if (da) {
      return da.stopSession();
    } else {
      return Promise.resolve(void 0);
    }
  }
  $acceptBreakpointsDelta(delta) {
    const a = [];
    const r = [];
    const c = [];
    if (delta.added) {
      for (const bpd of delta.added) {
        const id = bpd.id;
        if (id && !this._breakpoints.has(id)) {
          let bp;
          if (bpd.type === "function") {
            bp = new FunctionBreakpoint(bpd.functionName, bpd.enabled, bpd.condition, bpd.hitCondition, bpd.logMessage, bpd.mode);
          } else if (bpd.type === "data") {
            bp = new DataBreakpoint(bpd.label, bpd.dataId, bpd.canPersist, bpd.enabled, bpd.hitCondition, bpd.condition, bpd.logMessage, bpd.mode);
          } else {
            const uri = URI.revive(bpd.uri);
            bp = new SourceBreakpoint(new Location(uri, new Position(bpd.line, bpd.character)), bpd.enabled, bpd.condition, bpd.hitCondition, bpd.logMessage, bpd.mode);
          }
          setBreakpointId(bp, id);
          this._breakpoints.set(id, bp);
          a.push(bp);
        }
      }
    }
    if (delta.removed) {
      for (const id of delta.removed) {
        const bp = this._breakpoints.get(id);
        if (bp) {
          this._breakpoints.delete(id);
          r.push(bp);
        }
      }
    }
    if (delta.changed) {
      for (const bpd of delta.changed) {
        if (bpd.id) {
          const bp = this._breakpoints.get(bpd.id);
          if (bp) {
            if (bp instanceof FunctionBreakpoint && bpd.type === "function") {
              const fbp = bp;
              fbp.enabled = bpd.enabled;
              fbp.condition = bpd.condition;
              fbp.hitCondition = bpd.hitCondition;
              fbp.logMessage = bpd.logMessage;
              fbp.functionName = bpd.functionName;
            } else if (bp instanceof SourceBreakpoint && bpd.type === "source") {
              const sbp = bp;
              sbp.enabled = bpd.enabled;
              sbp.condition = bpd.condition;
              sbp.hitCondition = bpd.hitCondition;
              sbp.logMessage = bpd.logMessage;
              sbp.location = new Location(URI.revive(bpd.uri), new Position(bpd.line, bpd.character));
            }
            c.push(bp);
          }
        }
      }
    }
    this.fireBreakpointChanges(a, r, c);
  }
  async $acceptStackFrameFocus(focusDto) {
    let focus;
    if (focusDto) {
      const session = await this.getSession(focusDto.sessionId);
      if (focusDto.kind === "thread") {
        focus = new DebugThread(session.api, focusDto.threadId);
      } else {
        focus = new DebugStackFrame(session.api, focusDto.threadId, focusDto.frameId);
      }
    }
    this._activeStackItem = focus;
    this._onDidChangeActiveStackItem.fire(this._activeStackItem);
  }
  $provideDebugConfigurations(configProviderHandle, folderUri, token) {
    return asPromise(async () => {
      const provider = this.getConfigProviderByHandle(configProviderHandle);
      if (!provider) {
        throw new Error("no DebugConfigurationProvider found");
      }
      if (!provider.provideDebugConfigurations) {
        throw new Error("DebugConfigurationProvider has no method provideDebugConfigurations");
      }
      const folder = await this.getFolder(folderUri);
      return provider.provideDebugConfigurations(folder, token);
    }).then((debugConfigurations) => {
      if (!debugConfigurations) {
        throw new Error("nothing returned from DebugConfigurationProvider.provideDebugConfigurations");
      }
      return debugConfigurations;
    });
  }
  $resolveDebugConfiguration(configProviderHandle, folderUri, debugConfiguration, token) {
    return asPromise(async () => {
      const provider = this.getConfigProviderByHandle(configProviderHandle);
      if (!provider) {
        throw new Error("no DebugConfigurationProvider found");
      }
      if (!provider.resolveDebugConfiguration) {
        throw new Error("DebugConfigurationProvider has no method resolveDebugConfiguration");
      }
      const folder = await this.getFolder(folderUri);
      return provider.resolveDebugConfiguration(folder, debugConfiguration, token);
    });
  }
  $resolveDebugConfigurationWithSubstitutedVariables(configProviderHandle, folderUri, debugConfiguration, token) {
    return asPromise(async () => {
      const provider = this.getConfigProviderByHandle(configProviderHandle);
      if (!provider) {
        throw new Error("no DebugConfigurationProvider found");
      }
      if (!provider.resolveDebugConfigurationWithSubstitutedVariables) {
        throw new Error("DebugConfigurationProvider has no method resolveDebugConfigurationWithSubstitutedVariables");
      }
      const folder = await this.getFolder(folderUri);
      return provider.resolveDebugConfigurationWithSubstitutedVariables(folder, debugConfiguration, token);
    });
  }
  async $provideDebugAdapter(adapterFactoryHandle, sessionDto) {
    const adapterDescriptorFactory = this.getAdapterDescriptorFactoryByHandle(adapterFactoryHandle);
    if (!adapterDescriptorFactory) {
      return Promise.reject(new Error("no adapter descriptor factory found for handle"));
    }
    const session = await this.getSession(sessionDto);
    return this.getAdapterDescriptor(adapterDescriptorFactory, session).then((adapterDescriptor) => {
      if (!adapterDescriptor) {
        throw new Error(`Couldn't find a debug adapter descriptor for debug type '${session.type}'`);
      }
      return this.convertToDto(adapterDescriptor);
    });
  }
  async $acceptDebugSessionStarted(sessionDto) {
    const session = await this.getSession(sessionDto);
    this._onDidStartDebugSession.fire(session.api);
  }
  async $acceptDebugSessionTerminated(sessionDto) {
    const session = await this.getSession(sessionDto);
    if (session) {
      this._onDidTerminateDebugSession.fire(session.api);
      this._debugSessions.delete(session.id);
    }
  }
  async $acceptDebugSessionActiveChanged(sessionDto) {
    this._activeDebugSession = sessionDto ? await this.getSession(sessionDto) : void 0;
    this._onDidChangeActiveDebugSession.fire(this._activeDebugSession?.api);
  }
  async $acceptDebugSessionNameChanged(sessionDto, name) {
    const session = await this.getSession(sessionDto);
    session?._acceptNameChanged(name);
  }
  async $acceptDebugSessionCustomEvent(sessionDto, event) {
    const session = await this.getSession(sessionDto);
    const ee = {
      session: session.api,
      event: event.event,
      body: event.body
    };
    this._onDidReceiveDebugSessionCustomEvent.fire(ee);
  }
  // private & dto helpers
  convertToDto(x) {
    if (x instanceof DebugAdapterExecutable) {
      return this.convertExecutableToDto(x);
    } else if (x instanceof DebugAdapterServer) {
      return this.convertServerToDto(x);
    } else if (x instanceof DebugAdapterNamedPipeServer) {
      return this.convertPipeServerToDto(x);
    } else if (x instanceof DebugAdapterInlineImplementation) {
      return this.convertImplementationToDto(x);
    } else {
      throw new Error("convertToDto unexpected type");
    }
  }
  convertExecutableToDto(x) {
    return {
      type: "executable",
      command: x.command,
      args: x.args,
      options: x.options
    };
  }
  convertServerToDto(x) {
    return {
      type: "server",
      port: x.port,
      host: x.host
    };
  }
  convertPipeServerToDto(x) {
    return {
      type: "pipeServer",
      path: x.path
    };
  }
  convertImplementationToDto(x) {
    return {
      type: "implementation"
    };
  }
  getAdapterDescriptorFactoryByType(type) {
    const results = this._adapterFactories.filter((p) => p.type === type);
    if (results.length > 0) {
      return results[0].factory;
    }
    return void 0;
  }
  getAdapterDescriptorFactoryByHandle(handle) {
    const results = this._adapterFactories.filter((p) => p.handle === handle);
    if (results.length > 0) {
      return results[0].factory;
    }
    return void 0;
  }
  getConfigProviderByHandle(handle) {
    const results = this._configProviders.filter((p) => p.handle === handle);
    if (results.length > 0) {
      return results[0].provider;
    }
    return void 0;
  }
  definesDebugType(ed, type) {
    if (ed.contributes) {
      const debuggers = ed.contributes["debuggers"];
      if (debuggers && debuggers.length > 0) {
        for (const dbg of debuggers) {
          if (dbg.label && dbg.type) {
            if (dbg.type === type) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  getDebugAdapterTrackers(session) {
    const config = session.configuration;
    const type = config.type;
    const promises = this._trackerFactories.filter((tuple) => tuple.type === type || tuple.type === "*").map((tuple) => asPromise(() => tuple.factory.createDebugAdapterTracker(session.api)).then((p) => p, (err) => null));
    return Promise.race([
      Promise.all(promises).then((result) => {
        const trackers = coalesce(result);
        if (trackers.length > 0) {
          return new MultiTracker(trackers);
        }
        return void 0;
      }),
      new Promise((resolve) => setTimeout(() => resolve(void 0), 1e3))
    ]).catch((err) => {
      return void 0;
    });
  }
  async getAdapterDescriptor(adapterDescriptorFactory, session) {
    const serverPort = session.configuration.debugServer;
    if (typeof serverPort === "number") {
      return Promise.resolve(new DebugAdapterServer(serverPort));
    }
    if (adapterDescriptorFactory) {
      const extensionRegistry2 = await this._extensionService.getExtensionRegistry();
      return asPromise(() => adapterDescriptorFactory.createDebugAdapterDescriptor(session.api, this.daExecutableFromPackage(session, extensionRegistry2))).then((daDescriptor) => {
        if (daDescriptor) {
          return daDescriptor;
        }
        return void 0;
      });
    }
    const extensionRegistry = await this._extensionService.getExtensionRegistry();
    return Promise.resolve(this.daExecutableFromPackage(session, extensionRegistry));
  }
  daExecutableFromPackage(session, extensionRegistry) {
    return void 0;
  }
  fireBreakpointChanges(added, removed, changed) {
    if (added.length > 0 || removed.length > 0 || changed.length > 0) {
      this._onDidChangeBreakpoints.fire(Object.freeze({
        added,
        removed,
        changed
      }));
    }
  }
  async getSession(dto) {
    if (dto) {
      if (typeof dto === "string") {
        const ds = this._debugSessions.get(dto);
        if (ds) {
          return ds;
        }
      } else {
        let ds = this._debugSessions.get(dto.id);
        if (!ds) {
          const folder = await this.getFolder(dto.folderUri);
          const parent = dto.parent ? this._debugSessions.get(dto.parent) : void 0;
          ds = new ExtHostDebugSession(this._debugServiceProxy, dto.id, dto.type, dto.name, folder, dto.configuration, parent?.api);
          this._debugSessions.set(ds.id, ds);
          this._debugServiceProxy.$sessionCached(ds.id);
        }
        return ds;
      }
    }
    throw new Error("cannot find session");
  }
  getFolder(_folderUri) {
    if (_folderUri) {
      const folderURI = URI.revive(_folderUri);
      return this._workspaceService.resolveWorkspaceFolder(folderURI);
    }
    return Promise.resolve(void 0);
  }
  extensionVisKey(extensionId, id) {
    return `${extensionId}\0${id}`;
  }
  serializeVisualization(extensionId, viz) {
    if (!viz) {
      return void 0;
    }
    if ("title" in viz && "command" in viz) {
      return { type: DebugVisualizationType.Command };
    }
    if ("treeId" in viz) {
      return { type: DebugVisualizationType.Tree, id: `${extensionId}\0${viz.treeId}` };
    }
    throw new Error("Unsupported debug visualization type");
  }
  getIconPathOrClass(icon) {
    const iconPathOrIconClass = this.getIconUris(icon);
    let iconPath;
    let iconClass;
    if ("id" in iconPathOrIconClass) {
      iconClass = ThemeIconUtils.asClassName(iconPathOrIconClass);
    } else {
      iconPath = iconPathOrIconClass;
    }
    return {
      iconPath,
      iconClass
    };
  }
  getIconUris(iconPath) {
    if (iconPath instanceof ThemeIcon) {
      return { id: iconPath.id };
    }
    const dark = typeof iconPath === "object" && "dark" in iconPath ? iconPath.dark : iconPath;
    const light = typeof iconPath === "object" && "light" in iconPath ? iconPath.light : iconPath;
    return {
      dark: typeof dark === "string" ? URI.file(dark) : dark,
      light: typeof light === "string" ? URI.file(light) : light
    };
  }
};
ExtHostDebugServiceBase = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostWorkspace),
  __decorateParam(2, IExtHostExtensionService),
  __decorateParam(3, IExtHostConfiguration),
  __decorateParam(4, IExtHostEditorTabs),
  __decorateParam(5, IExtHostVariableResolverProvider),
  __decorateParam(6, IExtHostCommands),
  __decorateParam(7, IExtHostTesting)
], ExtHostDebugServiceBase);
class ExtHostDebugSession {
  constructor(_debugServiceProxy, _id, _type, _name, _workspaceFolder, _configuration, _parentSession) {
    this._debugServiceProxy = _debugServiceProxy;
    this._id = _id;
    this._type = _type;
    this._name = _name;
    this._workspaceFolder = _workspaceFolder;
    this._configuration = _configuration;
    this._parentSession = _parentSession;
  }
  get api() {
    const that = this;
    return this.apiSession ??= Object.freeze({
      id: that._id,
      type: that._type,
      get name() {
        return that._name;
      },
      set name(name) {
        that._name = name;
        that._debugServiceProxy.$setDebugSessionName(that._id, name);
      },
      parentSession: that._parentSession,
      workspaceFolder: that._workspaceFolder,
      configuration: that._configuration,
      customRequest(command, args) {
        return that._debugServiceProxy.$customDebugAdapterRequest(that._id, command, args);
      },
      getDebugProtocolBreakpoint(breakpoint) {
        return that._debugServiceProxy.$getDebugProtocolBreakpoint(that._id, breakpoint.id);
      }
    });
  }
  get id() {
    return this._id;
  }
  get type() {
    return this._type;
  }
  _acceptNameChanged(name) {
    this._name = name;
  }
  get configuration() {
    return this._configuration;
  }
}
class ExtHostDebugConsole {
  constructor(proxy) {
    this.value = Object.freeze({
      append(value) {
        proxy.$appendDebugConsole(value);
      },
      appendLine(value) {
        this.append(value + "\n");
      }
    });
  }
}
class MultiTracker {
  constructor(trackers) {
    this.trackers = trackers;
  }
  onWillStartSession() {
    this.trackers.forEach((t) => t.onWillStartSession ? t.onWillStartSession() : void 0);
  }
  onWillReceiveMessage(message) {
    this.trackers.forEach((t) => t.onWillReceiveMessage ? t.onWillReceiveMessage(message) : void 0);
  }
  onDidSendMessage(message) {
    this.trackers.forEach((t) => t.onDidSendMessage ? t.onDidSendMessage(message) : void 0);
  }
  onWillStopSession() {
    this.trackers.forEach((t) => t.onWillStopSession ? t.onWillStopSession() : void 0);
  }
  onError(error) {
    this.trackers.forEach((t) => t.onError ? t.onError(error) : void 0);
  }
  onExit(code, signal) {
    this.trackers.forEach((t) => t.onExit ? t.onExit(code, signal) : void 0);
  }
}
class DirectDebugAdapter extends AbstractDebugAdapter {
  constructor(implementation) {
    super();
    this.implementation = implementation;
    implementation.onDidSendMessage((message) => {
      this.acceptMessage(message);
    });
  }
  startSession() {
    return Promise.resolve(void 0);
  }
  sendMessage(message) {
    this.implementation.handleMessage(message);
  }
  stopSession() {
    this.implementation.dispose();
    return Promise.resolve(void 0);
  }
}
let WorkerExtHostDebugService = class extends ExtHostDebugServiceBase {
  constructor(extHostRpcService, workspaceService, extensionService, configurationService, editorTabs, variableResolver, commands, testing) {
    super(extHostRpcService, workspaceService, extensionService, configurationService, editorTabs, variableResolver, commands, testing);
  }
};
WorkerExtHostDebugService = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostWorkspace),
  __decorateParam(2, IExtHostExtensionService),
  __decorateParam(3, IExtHostConfiguration),
  __decorateParam(4, IExtHostEditorTabs),
  __decorateParam(5, IExtHostVariableResolverProvider),
  __decorateParam(6, IExtHostCommands),
  __decorateParam(7, IExtHostTesting)
], WorkerExtHostDebugService);
export {
  ExtHostDebugConsole,
  ExtHostDebugServiceBase,
  ExtHostDebugSession,
  IExtHostDebugService,
  WorkerExtHostDebugService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0RGVidWdTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGFzUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSBhcyBEaXNwb3NhYmxlQ2xzLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIGFzIFRoZW1lSWNvblV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVNpZ25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vc2lnbi9jb21tb24vc2lnbi5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlRm9sZGVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3REZWJ1Z0FkYXB0ZXIgfSBmcm9tICcuLi8uLi9jb250cmliL2RlYnVnL2NvbW1vbi9hYnN0cmFjdERlYnVnQWRhcHRlci5qcyc7XG5pbXBvcnQgeyBEZWJ1Z1Zpc3VhbGl6YXRpb25UeXBlLCBJQWRhcHRlckRlc2NyaXB0b3IsIElDb25maWcsIElEZWJ1Z0FkYXB0ZXIsIElEZWJ1Z0FkYXB0ZXJFeGVjdXRhYmxlLCBJRGVidWdBZGFwdGVySW1wbCwgSURlYnVnQWRhcHRlck5hbWVkUGlwZVNlcnZlciwgSURlYnVnQWRhcHRlclNlcnZlciwgSURlYnVnZ2VyQ29udHJpYnV0aW9uLCBJRGVidWdWaXN1YWxpemF0aW9uLCBJRGVidWdWaXN1YWxpemF0aW9uQ29udGV4dCwgSURlYnVnVmlzdWFsaXphdGlvblRyZWVJdGVtLCBNYWluVGhyZWFkRGVidWdWaXN1YWxpemF0aW9uIH0gZnJvbSAnLi4vLi4vY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgY29udmVydFRvREFQYXRocywgY29udmVydFRvVlNDUGF0aHMsIGlzRGVidWdnZXJNYWluQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWdVdGlscy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBEdG8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9wcm94eUlkZW50aWZpZXIuanMnO1xuaW1wb3J0IHsgRGVidWdTZXNzaW9uVVVJRCwgRXh0SG9zdERlYnVnU2VydmljZVNoYXBlLCBJQnJlYWtwb2ludHNEZWx0YUR0bywgSURlYnVnU2Vzc2lvbkR0bywgSUZ1bmN0aW9uQnJlYWtwb2ludER0bywgSVNvdXJjZU11bHRpQnJlYWtwb2ludER0bywgSVN0YWNrRnJhbWVGb2N1c0R0bywgSVRocmVhZEZvY3VzRHRvLCBNYWluQ29udGV4dCwgTWFpblRocmVhZERlYnVnU2VydmljZVNoYXBlLCBNYWluVGhyZWFkVGVsZW1ldHJ5U2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0Q29uZmlndXJhdGlvbiB9IGZyb20gJy4vZXh0SG9zdENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RFZGl0b3JUYWJzIH0gZnJvbSAnLi9leHRIb3N0RWRpdG9yVGFicy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdEV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RFeHRlbnNpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRIb3N0UnBjU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdFJwY1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RUZXN0aW5nIH0gZnJvbSAnLi9leHRIb3N0VGVzdGluZy5qcyc7XG5pbXBvcnQgKiBhcyBDb252ZXJ0IGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcbmltcG9ydCB7IEJyZWFrcG9pbnQsIERhdGFCcmVha3BvaW50LCBEZWJ1Z0FkYXB0ZXJFeGVjdXRhYmxlLCBEZWJ1Z0FkYXB0ZXJJbmxpbmVJbXBsZW1lbnRhdGlvbiwgRGVidWdBZGFwdGVyTmFtZWRQaXBlU2VydmVyLCBEZWJ1Z0FkYXB0ZXJTZXJ2ZXIsIERlYnVnQ29uc29sZU1vZGUsIERlYnVnU3RhY2tGcmFtZSwgRGVidWdUaHJlYWQsIERpc3Bvc2FibGUsIEZ1bmN0aW9uQnJlYWtwb2ludCwgTG9jYXRpb24sIFBvc2l0aW9uLCBzZXRCcmVha3BvaW50SWQsIFNvdXJjZUJyZWFrcG9pbnQsIFRoZW1lSWNvbiB9IGZyb20gJy4vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0VmFyaWFibGVSZXNvbHZlclByb3ZpZGVyIH0gZnJvbSAnLi9leHRIb3N0VmFyaWFibGVSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RXb3Jrc3BhY2UgfSBmcm9tICcuL2V4dEhvc3RXb3Jrc3BhY2UuanMnO1xuXG5leHBvcnQgY29uc3QgSUV4dEhvc3REZWJ1Z1NlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUV4dEhvc3REZWJ1Z1NlcnZpY2U+KCdJRXh0SG9zdERlYnVnU2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRIb3N0RGVidWdTZXJ2aWNlIGV4dGVuZHMgRXh0SG9zdERlYnVnU2VydmljZVNoYXBlIHtcblxuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0b25EaWRTdGFydERlYnVnU2Vzc2lvbjogRXZlbnQ8dnNjb2RlLkRlYnVnU2Vzc2lvbj47XG5cdG9uRGlkVGVybWluYXRlRGVidWdTZXNzaW9uOiBFdmVudDx2c2NvZGUuRGVidWdTZXNzaW9uPjtcblx0b25EaWRDaGFuZ2VBY3RpdmVEZWJ1Z1Nlc3Npb246IEV2ZW50PHZzY29kZS5EZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQ+O1xuXHRhY3RpdmVEZWJ1Z1Nlc3Npb246IHZzY29kZS5EZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQ7XG5cdGFjdGl2ZURlYnVnQ29uc29sZTogdnNjb2RlLkRlYnVnQ29uc29sZTtcblx0b25EaWRSZWNlaXZlRGVidWdTZXNzaW9uQ3VzdG9tRXZlbnQ6IEV2ZW50PHZzY29kZS5EZWJ1Z1Nlc3Npb25DdXN0b21FdmVudD47XG5cdG9uRGlkQ2hhbmdlQnJlYWtwb2ludHM6IEV2ZW50PHZzY29kZS5CcmVha3BvaW50c0NoYW5nZUV2ZW50Pjtcblx0YnJlYWtwb2ludHM6IHZzY29kZS5CcmVha3BvaW50W107XG5cdG9uRGlkQ2hhbmdlQWN0aXZlU3RhY2tJdGVtOiBFdmVudDx2c2NvZGUuRGVidWdUaHJlYWQgfCB2c2NvZGUuRGVidWdTdGFja0ZyYW1lIHwgdW5kZWZpbmVkPjtcblx0YWN0aXZlU3RhY2tJdGVtOiB2c2NvZGUuRGVidWdUaHJlYWQgfCB2c2NvZGUuRGVidWdTdGFja0ZyYW1lIHwgdW5kZWZpbmVkO1xuXG5cdGFkZEJyZWFrcG9pbnRzKGJyZWFrcG9pbnRzMDogcmVhZG9ubHkgdnNjb2RlLkJyZWFrcG9pbnRbXSk6IFByb21pc2U8dm9pZD47XG5cdHJlbW92ZUJyZWFrcG9pbnRzKGJyZWFrcG9pbnRzMDogcmVhZG9ubHkgdnNjb2RlLkJyZWFrcG9pbnRbXSk6IFByb21pc2U8dm9pZD47XG5cdHN0YXJ0RGVidWdnaW5nKGZvbGRlcjogdnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCwgbmFtZU9yQ29uZmlnOiBzdHJpbmcgfCB2c2NvZGUuRGVidWdDb25maWd1cmF0aW9uLCBvcHRpb25zOiB2c2NvZGUuRGVidWdTZXNzaW9uT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj47XG5cdHN0b3BEZWJ1Z2dpbmcoc2Vzc2lvbj86IHZzY29kZS5EZWJ1Z1Nlc3Npb24pOiBQcm9taXNlPHZvaWQ+O1xuXHRyZWdpc3RlckRlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyKHR5cGU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5EZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlciwgdHJpZ2dlcjogdnNjb2RlLkRlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyVHJpZ2dlcktpbmQpOiB2c2NvZGUuRGlzcG9zYWJsZTtcblx0cmVnaXN0ZXJEZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeShleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgdHlwZTogc3RyaW5nLCBmYWN0b3J5OiB2c2NvZGUuRGVidWdBZGFwdGVyRGVzY3JpcHRvckZhY3RvcnkpOiB2c2NvZGUuRGlzcG9zYWJsZTtcblx0cmVnaXN0ZXJEZWJ1Z0FkYXB0ZXJUcmFja2VyRmFjdG9yeSh0eXBlOiBzdHJpbmcsIGZhY3Rvcnk6IHZzY29kZS5EZWJ1Z0FkYXB0ZXJUcmFja2VyRmFjdG9yeSk6IHZzY29kZS5EaXNwb3NhYmxlO1xuXHRyZWdpc3RlckRlYnVnVmlzdWFsaXphdGlvblByb3ZpZGVyPFQgZXh0ZW5kcyB2c2NvZGUuRGVidWdWaXN1YWxpemF0aW9uPihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWQ6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5EZWJ1Z1Zpc3VhbGl6YXRpb25Qcm92aWRlcjxUPik6IHZzY29kZS5EaXNwb3NhYmxlO1xuXHRyZWdpc3RlckRlYnVnVmlzdWFsaXphdGlvblRyZWU8VCBleHRlbmRzIHZzY29kZS5EZWJ1Z1RyZWVJdGVtPihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWQ6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5EZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlPFQ+KTogdnNjb2RlLkRpc3Bvc2FibGU7XG5cdGFzRGVidWdTb3VyY2VVcmkoc291cmNlOiB2c2NvZGUuRGVidWdQcm90b2NvbFNvdXJjZSwgc2Vzc2lvbj86IHZzY29kZS5EZWJ1Z1Nlc3Npb24pOiB2c2NvZGUuVXJpO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXh0SG9zdERlYnVnU2VydmljZUJhc2UgZXh0ZW5kcyBEaXNwb3NhYmxlQ2xzIGltcGxlbWVudHMgSUV4dEhvc3REZWJ1Z1NlcnZpY2UsIEV4dEhvc3REZWJ1Z1NlcnZpY2VTaGFwZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2NvbmZpZ1Byb3ZpZGVySGFuZGxlQ291bnRlcjogbnVtYmVyO1xuXHRwcml2YXRlIF9jb25maWdQcm92aWRlcnM6IENvbmZpZ1Byb3ZpZGVyVHVwbGVbXTtcblxuXHRwcml2YXRlIF9hZGFwdGVyRmFjdG9yeUhhbmRsZUNvdW50ZXI6IG51bWJlcjtcblx0cHJpdmF0ZSBfYWRhcHRlckZhY3RvcmllczogRGVzY3JpcHRvckZhY3RvcnlUdXBsZVtdO1xuXG5cdHByaXZhdGUgX3RyYWNrZXJGYWN0b3J5SGFuZGxlQ291bnRlcjogbnVtYmVyO1xuXHRwcml2YXRlIF90cmFja2VyRmFjdG9yaWVzOiBUcmFja2VyRmFjdG9yeVR1cGxlW107XG5cblx0cHJpdmF0ZSBfZGVidWdTZXJ2aWNlUHJveHk6IE1haW5UaHJlYWREZWJ1Z1NlcnZpY2VTaGFwZTtcblx0cHJpdmF0ZSBfZGVidWdTZXNzaW9uczogTWFwPERlYnVnU2Vzc2lvblVVSUQsIEV4dEhvc3REZWJ1Z1Nlc3Npb24+ID0gbmV3IE1hcDxEZWJ1Z1Nlc3Npb25VVUlELCBFeHRIb3N0RGVidWdTZXNzaW9uPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU3RhcnREZWJ1Z1Nlc3Npb246IEVtaXR0ZXI8dnNjb2RlLkRlYnVnU2Vzc2lvbj47XG5cdGdldCBvbkRpZFN0YXJ0RGVidWdTZXNzaW9uKCk6IEV2ZW50PHZzY29kZS5EZWJ1Z1Nlc3Npb24+IHsgcmV0dXJuIHRoaXMuX29uRGlkU3RhcnREZWJ1Z1Nlc3Npb24uZXZlbnQ7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFRlcm1pbmF0ZURlYnVnU2Vzc2lvbjogRW1pdHRlcjx2c2NvZGUuRGVidWdTZXNzaW9uPjtcblx0Z2V0IG9uRGlkVGVybWluYXRlRGVidWdTZXNzaW9uKCk6IEV2ZW50PHZzY29kZS5EZWJ1Z1Nlc3Npb24+IHsgcmV0dXJuIHRoaXMuX29uRGlkVGVybWluYXRlRGVidWdTZXNzaW9uLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVEZWJ1Z1Nlc3Npb246IEVtaXR0ZXI8dnNjb2RlLkRlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZD47XG5cdGdldCBvbkRpZENoYW5nZUFjdGl2ZURlYnVnU2Vzc2lvbigpOiBFdmVudDx2c2NvZGUuRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkPiB7IHJldHVybiB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZURlYnVnU2Vzc2lvbi5ldmVudDsgfVxuXG5cdHByaXZhdGUgX2FjdGl2ZURlYnVnU2Vzc2lvbjogRXh0SG9zdERlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZDtcblx0Z2V0IGFjdGl2ZURlYnVnU2Vzc2lvbigpOiB2c2NvZGUuRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2FjdGl2ZURlYnVnU2Vzc2lvbj8uYXBpOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWNlaXZlRGVidWdTZXNzaW9uQ3VzdG9tRXZlbnQ6IEVtaXR0ZXI8dnNjb2RlLkRlYnVnU2Vzc2lvbkN1c3RvbUV2ZW50Pjtcblx0Z2V0IG9uRGlkUmVjZWl2ZURlYnVnU2Vzc2lvbkN1c3RvbUV2ZW50KCk6IEV2ZW50PHZzY29kZS5EZWJ1Z1Nlc3Npb25DdXN0b21FdmVudD4geyByZXR1cm4gdGhpcy5fb25EaWRSZWNlaXZlRGVidWdTZXNzaW9uQ3VzdG9tRXZlbnQuZXZlbnQ7IH1cblxuXHRwcml2YXRlIF9hY3RpdmVEZWJ1Z0NvbnNvbGU6IEV4dEhvc3REZWJ1Z0NvbnNvbGU7XG5cdGdldCBhY3RpdmVEZWJ1Z0NvbnNvbGUoKTogdnNjb2RlLkRlYnVnQ29uc29sZSB7IHJldHVybiB0aGlzLl9hY3RpdmVEZWJ1Z0NvbnNvbGUudmFsdWU7IH1cblxuXHRwcml2YXRlIF9icmVha3BvaW50czogTWFwPHN0cmluZywgdnNjb2RlLkJyZWFrcG9pbnQ+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQnJlYWtwb2ludHM6IEVtaXR0ZXI8dnNjb2RlLkJyZWFrcG9pbnRzQ2hhbmdlRXZlbnQ+O1xuXG5cdHByaXZhdGUgX2FjdGl2ZVN0YWNrSXRlbTogdnNjb2RlLkRlYnVnVGhyZWFkIHwgdnNjb2RlLkRlYnVnU3RhY2tGcmFtZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVTdGFja0l0ZW06IEVtaXR0ZXI8dnNjb2RlLkRlYnVnVGhyZWFkIHwgdnNjb2RlLkRlYnVnU3RhY2tGcmFtZSB8IHVuZGVmaW5lZD47XG5cblx0cHJpdmF0ZSBfZGVidWdBZGFwdGVyczogTWFwPG51bWJlciwgSURlYnVnQWRhcHRlcj47XG5cdHByaXZhdGUgX2RlYnVnQWRhcHRlcnNUcmFja2VyczogTWFwPG51bWJlciwgdnNjb2RlLkRlYnVnQWRhcHRlclRyYWNrZXI+O1xuXG5cdHByaXZhdGUgX2RlYnVnVmlzdWFsaXphdGlvblRyZWVJdGVtSWRzQ291bnRlciA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnVmlzdWFsaXphdGlvblByb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCB2c2NvZGUuRGVidWdWaXN1YWxpemF0aW9uUHJvdmlkZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnVmlzdWFsaXphdGlvblRyZWVzID0gbmV3IE1hcDxzdHJpbmcsIHZzY29kZS5EZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlSXRlbUlkcyA9IG5ldyBXZWFrTWFwPHZzY29kZS5EZWJ1Z1RyZWVJdGVtLCBudW1iZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnVmlzdWFsaXphdGlvbkVsZW1lbnRzID0gbmV3IE1hcDxudW1iZXIsIHsgcHJvdmlkZXI6IHN0cmluZzsgaXRlbTogdnNjb2RlLkRlYnVnVHJlZUl0ZW07IGNoaWxkcmVuPzogbnVtYmVyW10gfT4oKTtcblxuXHRwcml2YXRlIF9zaWduU2VydmljZTogSVNpZ25TZXJ2aWNlIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Zpc3VhbGl6ZXJzID0gbmV3IE1hcDxudW1iZXIsIHsgdjogdnNjb2RlLkRlYnVnVmlzdWFsaXphdGlvbjsgcHJvdmlkZXI6IHZzY29kZS5EZWJ1Z1Zpc3VhbGl6YXRpb25Qcm92aWRlcjsgZXh0ZW5zaW9uSWQ6IHN0cmluZyB9PigpO1xuXHRwcml2YXRlIF92aXN1YWxpemVySWRDb3VudGVyID0gMDtcblxuXHRwcml2YXRlIF90ZWxlbWV0cnlQcm94eTogTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwY1NlcnZpY2U6IElFeHRIb3N0UnBjU2VydmljZSxcblx0XHRASUV4dEhvc3RXb3Jrc3BhY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF93b3Jrc3BhY2VTZXJ2aWNlOiBJRXh0SG9zdFdvcmtzcGFjZSxcblx0XHRASUV4dEhvc3RFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvblNlcnZpY2U6IElFeHRIb3N0RXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUV4dEhvc3RDb25maWd1cmF0aW9uIHByb3RlY3RlZCByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElFeHRIb3N0Q29uZmlndXJhdGlvbixcblx0XHRASUV4dEhvc3RFZGl0b3JUYWJzIHByb3RlY3RlZCByZWFkb25seSBfZWRpdG9yVGFiczogSUV4dEhvc3RFZGl0b3JUYWJzLFxuXHRcdEBJRXh0SG9zdFZhcmlhYmxlUmVzb2x2ZXJQcm92aWRlciBwcml2YXRlIHJlYWRvbmx5IF92YXJpYWJsZVJlc29sdmVyOiBJRXh0SG9zdFZhcmlhYmxlUmVzb2x2ZXJQcm92aWRlcixcblx0XHRASUV4dEhvc3RDb21tYW5kcyBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kczogSUV4dEhvc3RDb21tYW5kcyxcblx0XHRASUV4dEhvc3RUZXN0aW5nIHByaXZhdGUgcmVhZG9ubHkgX3Rlc3Rpbmc6IElFeHRIb3N0VGVzdGluZyxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2NvbmZpZ1Byb3ZpZGVySGFuZGxlQ291bnRlciA9IDA7XG5cdFx0dGhpcy5fY29uZmlnUHJvdmlkZXJzID0gW107XG5cblx0XHR0aGlzLl9hZGFwdGVyRmFjdG9yeUhhbmRsZUNvdW50ZXIgPSAwO1xuXHRcdHRoaXMuX2FkYXB0ZXJGYWN0b3JpZXMgPSBbXTtcblxuXHRcdHRoaXMuX3RyYWNrZXJGYWN0b3J5SGFuZGxlQ291bnRlciA9IDA7XG5cdFx0dGhpcy5fdHJhY2tlckZhY3RvcmllcyA9IFtdO1xuXG5cdFx0dGhpcy5fZGVidWdBZGFwdGVycyA9IG5ldyBNYXAoKTtcblx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJzVHJhY2tlcnMgPSBuZXcgTWFwKCk7XG5cblx0XHR0aGlzLl9vbkRpZFN0YXJ0RGVidWdTZXNzaW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dnNjb2RlLkRlYnVnU2Vzc2lvbj4oKSk7XG5cdFx0dGhpcy5fb25EaWRUZXJtaW5hdGVEZWJ1Z1Nlc3Npb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2c2NvZGUuRGVidWdTZXNzaW9uPigpKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZURlYnVnU2Vzc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZzY29kZS5EZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQ+KCkpO1xuXHRcdHRoaXMuX29uRGlkUmVjZWl2ZURlYnVnU2Vzc2lvbkN1c3RvbUV2ZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dnNjb2RlLkRlYnVnU2Vzc2lvbkN1c3RvbUV2ZW50PigpKTtcblxuXHRcdHRoaXMuX2RlYnVnU2VydmljZVByb3h5ID0gZXh0SG9zdFJwY1NlcnZpY2UuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZERlYnVnU2VydmljZSk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUJyZWFrcG9pbnRzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dnNjb2RlLkJyZWFrcG9pbnRzQ2hhbmdlRXZlbnQ+KCkpO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTdGFja0l0ZW0gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2c2NvZGUuRGVidWdUaHJlYWQgfCB2c2NvZGUuRGVidWdTdGFja0ZyYW1lIHwgdW5kZWZpbmVkPigpKTtcblxuXHRcdHRoaXMuX2FjdGl2ZURlYnVnQ29uc29sZSA9IG5ldyBFeHRIb3N0RGVidWdDb25zb2xlKHRoaXMuX2RlYnVnU2VydmljZVByb3h5KTtcblxuXHRcdHRoaXMuX2JyZWFrcG9pbnRzID0gbmV3IE1hcDxzdHJpbmcsIHZzY29kZS5CcmVha3BvaW50PigpO1xuXG5cdFx0dGhpcy5fZXh0ZW5zaW9uU2VydmljZS5nZXRFeHRlbnNpb25SZWdpc3RyeSgpLnRoZW4oKGV4dGVuc2lvblJlZ2lzdHJ5OiBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5KSA9PiB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihleHRlbnNpb25SZWdpc3RyeS5vbkRpZENoYW5nZShfID0+IHtcblx0XHRcdFx0dGhpcy5yZWdpc3RlckFsbERlYnVnVHlwZXMoZXh0ZW5zaW9uUmVnaXN0cnkpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5yZWdpc3RlckFsbERlYnVnVHlwZXMoZXh0ZW5zaW9uUmVnaXN0cnkpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fdGVsZW1ldHJ5UHJveHkgPSBleHRIb3N0UnBjU2VydmljZS5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkVGVsZW1ldHJ5KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkZ2V0VmlzdWFsaXplclRyZWVJdGVtKHRyZWVJZDogc3RyaW5nLCBlbGVtZW50OiBJRGVidWdWaXN1YWxpemF0aW9uQ29udGV4dCk6IFByb21pc2U8SURlYnVnVmlzdWFsaXphdGlvblRyZWVJdGVtIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgY29udGV4dCA9IHRoaXMuaHlkcmF0ZVZpc3VhbGl6YXRpb25Db250ZXh0KGVsZW1lbnQpO1xuXHRcdGlmICghY29udGV4dCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBpdGVtID0gYXdhaXQgdGhpcy5fZGVidWdWaXN1YWxpemF0aW9uVHJlZXMuZ2V0KHRyZWVJZCk/LmdldFRyZWVJdGVtPy4oY29udGV4dCk7XG5cdFx0cmV0dXJuIGl0ZW0gPyB0aGlzLmNvbnZlcnRWaXN1YWxpemVyVHJlZUl0ZW0odHJlZUlkLCBpdGVtKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlckRlYnVnVmlzdWFsaXphdGlvblRyZWU8VCBleHRlbmRzIHZzY29kZS5EZWJ1Z1RyZWVJdGVtPihtYW5pZmVzdDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpZDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkRlYnVnVmlzdWFsaXphdGlvblRyZWU8VD4pOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSBFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KG1hbmlmZXN0LmlkZW50aWZpZXIpO1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuZXh0ZW5zaW9uVmlzS2V5KGV4dGVuc2lvbklkLCBpZCk7XG5cdFx0aWYgKHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvblByb3ZpZGVycy5oYXMoa2V5KSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBIGRlYnVnIHZpc3VhbGl6YXRpb24gcHJvdmlkZXIgd2l0aCBpZCAnJHtpZH0nIGlzIGFscmVhZHkgcmVnaXN0ZXJlZGApO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvblRyZWVzLnNldChrZXksIHByb3ZpZGVyKTtcblx0XHR0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kcmVnaXN0ZXJEZWJ1Z1Zpc3VhbGl6ZXJUcmVlKGtleSwgISFwcm92aWRlci5lZGl0SXRlbSk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kdW5yZWdpc3RlckRlYnVnVmlzdWFsaXplclRyZWUoa2V5KTtcblx0XHRcdHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvblRyZWVzLmRlbGV0ZShpZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGdldFZpc3VhbGl6ZXJUcmVlSXRlbUNoaWxkcmVuKHRyZWVJZDogc3RyaW5nLCBlbGVtZW50OiBudW1iZXIpOiBQcm9taXNlPElEZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlSXRlbVtdPiB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvbkVsZW1lbnRzLmdldChlbGVtZW50KT8uaXRlbTtcblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvblRyZWVzLmdldCh0cmVlSWQpPy5nZXRDaGlsZHJlbj8uKGl0ZW0pO1xuXHRcdHJldHVybiBjaGlsZHJlbj8ubWFwKGkgPT4gdGhpcy5jb252ZXJ0VmlzdWFsaXplclRyZWVJdGVtKHRyZWVJZCwgaSkpIHx8IFtdO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRlZGl0VmlzdWFsaXplclRyZWVJdGVtKGVsZW1lbnQ6IG51bWJlciwgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8SURlYnVnVmlzdWFsaXphdGlvblRyZWVJdGVtIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZSA9IHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvbkVsZW1lbnRzLmdldChlbGVtZW50KTtcblx0XHRpZiAoIWUpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0Y29uc3QgciA9IGF3YWl0IHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvblRyZWVzLmdldChlLnByb3ZpZGVyKT8uZWRpdEl0ZW0/LihlLml0ZW0sIHZhbHVlKTtcblx0XHRyZXR1cm4gdGhpcy5jb252ZXJ0VmlzdWFsaXplclRyZWVJdGVtKGUucHJvdmlkZXIsIHIgfHwgZS5pdGVtKTtcblx0fVxuXG5cdHB1YmxpYyAkZGlzcG9zZVZpc3VhbGl6ZWRUcmVlKGVsZW1lbnQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHJvb3QgPSB0aGlzLl9kZWJ1Z1Zpc3VhbGl6YXRpb25FbGVtZW50cy5nZXQoZWxlbWVudCk7XG5cdFx0aWYgKCFyb290KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcXVldWUgPSBbcm9vdC5jaGlsZHJlbl07XG5cdFx0Zm9yIChjb25zdCBjaGlsZHJlbiBvZiBxdWV1ZSkge1xuXHRcdFx0aWYgKGNoaWxkcmVuKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRxdWV1ZS5wdXNoKHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvbkVsZW1lbnRzLmdldChjaGlsZCk/LmNoaWxkcmVuKTtcblx0XHRcdFx0XHR0aGlzLl9kZWJ1Z1Zpc3VhbGl6YXRpb25FbGVtZW50cy5kZWxldGUoY2hpbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjb252ZXJ0VmlzdWFsaXplclRyZWVJdGVtKHRyZWVJZDogc3RyaW5nLCBpdGVtOiB2c2NvZGUuRGVidWdUcmVlSXRlbSk6IElEZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlSXRlbSB7XG5cdFx0bGV0IGlkID0gdGhpcy5fZGVidWdWaXN1YWxpemF0aW9uVHJlZUl0ZW1JZHMuZ2V0KGl0ZW0pO1xuXHRcdGlmICghaWQpIHtcblx0XHRcdGlkID0gdGhpcy5fZGVidWdWaXN1YWxpemF0aW9uVHJlZUl0ZW1JZHNDb3VudGVyKys7XG5cdFx0XHR0aGlzLl9kZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlSXRlbUlkcy5zZXQoaXRlbSwgaWQpO1xuXHRcdFx0dGhpcy5fZGVidWdWaXN1YWxpemF0aW9uRWxlbWVudHMuc2V0KGlkLCB7IHByb3ZpZGVyOiB0cmVlSWQsIGl0ZW0gfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIENvbnZlcnQuRGVidWdUcmVlSXRlbS5mcm9tKGl0ZW0sIGlkKTtcblx0fVxuXG5cdHB1YmxpYyBhc0RlYnVnU291cmNlVXJpKHNyYzogdnNjb2RlLkRlYnVnUHJvdG9jb2xTb3VyY2UsIHNlc3Npb24/OiB2c2NvZGUuRGVidWdTZXNzaW9uKTogVVJJIHtcblxuXHRcdGNvbnN0IHNvdXJjZSA9IDxhbnk+c3JjO1xuXG5cdFx0aWYgKHR5cGVvZiBzb3VyY2Uuc291cmNlUmVmZXJlbmNlID09PSAnbnVtYmVyJyAmJiBzb3VyY2Uuc291cmNlUmVmZXJlbmNlID4gMCkge1xuXHRcdFx0Ly8gc3JjIGNhbiBiZSByZXRyaWV2ZWQgdmlhIERBUCdzIFwic291cmNlXCIgcmVxdWVzdFxuXG5cdFx0XHRsZXQgZGVidWcgPSBgZGVidWc6JHtlbmNvZGVVUklDb21wb25lbnQoc291cmNlLnBhdGggfHwgJycpfWA7XG5cdFx0XHRsZXQgc2VwID0gJz8nO1xuXG5cdFx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0XHRkZWJ1ZyArPSBgJHtzZXB9c2Vzc2lvbj0ke2VuY29kZVVSSUNvbXBvbmVudChzZXNzaW9uLmlkKX1gO1xuXHRcdFx0XHRzZXAgPSAnJic7XG5cdFx0XHR9XG5cblx0XHRcdGRlYnVnICs9IGAke3NlcH1yZWY9JHtzb3VyY2Uuc291cmNlUmVmZXJlbmNlfWA7XG5cblx0XHRcdHJldHVybiBVUkkucGFyc2UoZGVidWcpO1xuXHRcdH0gZWxzZSBpZiAoc291cmNlLnBhdGgpIHtcblx0XHRcdC8vIHNyYyBpcyBqdXN0IGEgbG9jYWwgZmlsZSBwYXRoXG5cdFx0XHRyZXR1cm4gVVJJLmZpbGUoc291cmNlLnBhdGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGNhbm5vdCBjcmVhdGUgdXJpIGZyb20gREFQICdzb3VyY2UnIG9iamVjdDsgcHJvcGVydGllcyAncGF0aCcgYW5kICdzb3VyY2VSZWZlcmVuY2UnIGFyZSBib3RoIG1pc3NpbmcuYCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckFsbERlYnVnVHlwZXMoZXh0ZW5zaW9uUmVnaXN0cnk6IEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkpIHtcblxuXHRcdGNvbnN0IGRlYnVnVHlwZXM6IHN0cmluZ1tdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGVkIG9mIGV4dGVuc2lvblJlZ2lzdHJ5LmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpKSB7XG5cdFx0XHRpZiAoZWQuY29udHJpYnV0ZXMpIHtcblx0XHRcdFx0Y29uc3QgZGVidWdnZXJzID0gPElEZWJ1Z2dlckNvbnRyaWJ1dGlvbltdPmVkLmNvbnRyaWJ1dGVzWydkZWJ1Z2dlcnMnXTtcblx0XHRcdFx0aWYgKGRlYnVnZ2VycyAmJiBkZWJ1Z2dlcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgZGJnIG9mIGRlYnVnZ2Vycykge1xuXHRcdFx0XHRcdFx0aWYgKGlzRGVidWdnZXJNYWluQ29udHJpYnV0aW9uKGRiZykpIHtcblx0XHRcdFx0XHRcdFx0ZGVidWdUeXBlcy5wdXNoKGRiZy50eXBlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kcmVnaXN0ZXJEZWJ1Z1R5cGVzKGRlYnVnVHlwZXMpO1xuXHR9XG5cblx0Ly8gZXh0ZW5zaW9uIGRlYnVnIEFQSVxuXG5cblx0Z2V0IGFjdGl2ZVN0YWNrSXRlbSgpOiB2c2NvZGUuRGVidWdUaHJlYWQgfCB2c2NvZGUuRGVidWdTdGFja0ZyYW1lIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aXZlU3RhY2tJdGVtO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlQWN0aXZlU3RhY2tJdGVtKCk6IEV2ZW50PHZzY29kZS5EZWJ1Z1RocmVhZCB8IHZzY29kZS5EZWJ1Z1N0YWNrRnJhbWUgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTdGFja0l0ZW0uZXZlbnQ7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VCcmVha3BvaW50cygpOiBFdmVudDx2c2NvZGUuQnJlYWtwb2ludHNDaGFuZ2VFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZUJyZWFrcG9pbnRzLmV2ZW50O1xuXHR9XG5cblx0Z2V0IGJyZWFrcG9pbnRzKCk6IHZzY29kZS5CcmVha3BvaW50W10ge1xuXHRcdGNvbnN0IHJlc3VsdDogdnNjb2RlLkJyZWFrcG9pbnRbXSA9IFtdO1xuXHRcdHRoaXMuX2JyZWFrcG9pbnRzLmZvckVhY2goYnAgPT4gcmVzdWx0LnB1c2goYnApKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRyZXNvbHZlRGVidWdWaXN1YWxpemVyKGlkOiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TWFpblRocmVhZERlYnVnVmlzdWFsaXphdGlvbj4ge1xuXHRcdGNvbnN0IHZpc3VhbGl6ZXIgPSB0aGlzLl92aXN1YWxpemVycy5nZXQoaWQpO1xuXHRcdGlmICghdmlzdWFsaXplcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyBkZWJ1ZyB2aXN1YWxpemVyIGZvdW5kIHdpdGggaWQgJyR7aWR9J2ApO1xuXHRcdH1cblxuXHRcdGxldCB7IHYsIHByb3ZpZGVyLCBleHRlbnNpb25JZCB9ID0gdmlzdWFsaXplcjtcblx0XHRpZiAoIXYudmlzdWFsaXphdGlvbikge1xuXHRcdFx0diA9IGF3YWl0IHByb3ZpZGVyLnJlc29sdmVEZWJ1Z1Zpc3VhbGl6YXRpb24/Lih2LCB0b2tlbikgfHwgdjtcblx0XHRcdHZpc3VhbGl6ZXIudiA9IHY7XG5cdFx0fVxuXG5cdFx0aWYgKCF2LnZpc3VhbGl6YXRpb24pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTm8gdmlzdWFsaXphdGlvbiByZXR1cm5lZCBmcm9tIHJlc29sdmVEZWJ1Z1Zpc3VhbGl6YXRpb24gaW4gJyR7cHJvdmlkZXJ9J2ApO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnNlcmlhbGl6ZVZpc3VhbGl6YXRpb24oZXh0ZW5zaW9uSWQsIHYudmlzdWFsaXphdGlvbikhO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRleGVjdXRlRGVidWdWaXN1YWxpemVyQ29tbWFuZChpZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmlzdWFsaXplciA9IHRoaXMuX3Zpc3VhbGl6ZXJzLmdldChpZCk7XG5cdFx0aWYgKCF2aXN1YWxpemVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vIGRlYnVnIHZpc3VhbGl6ZXIgZm91bmQgd2l0aCBpZCAnJHtpZH0nYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tbWFuZCA9IHZpc3VhbGl6ZXIudi52aXN1YWxpemF0aW9uO1xuXHRcdGlmIChjb21tYW5kICYmICdjb21tYW5kJyBpbiBjb21tYW5kKSB7XG5cdFx0XHR0aGlzLl9jb21tYW5kcy5leGVjdXRlQ29tbWFuZChjb21tYW5kLmNvbW1hbmQsIC4uLihjb21tYW5kLmFyZ3VtZW50cyB8fCBbXSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaHlkcmF0ZVZpc3VhbGl6YXRpb25Db250ZXh0KGNvbnRleHQ6IElEZWJ1Z1Zpc3VhbGl6YXRpb25Db250ZXh0KTogdnNjb2RlLkRlYnVnVmlzdWFsaXphdGlvbkNvbnRleHQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLl9kZWJ1Z1Nlc3Npb25zLmdldChjb250ZXh0LnNlc3Npb25JZCk7XG5cdFx0cmV0dXJuIHNlc3Npb24gJiYge1xuXHRcdFx0c2Vzc2lvbjogc2Vzc2lvbi5hcGksXG5cdFx0XHR2YXJpYWJsZTogY29udGV4dC52YXJpYWJsZSxcblx0XHRcdGNvbnRhaW5lcklkOiBjb250ZXh0LmNvbnRhaW5lcklkLFxuXHRcdFx0ZnJhbWVJZDogY29udGV4dC5mcmFtZUlkLFxuXHRcdFx0dGhyZWFkSWQ6IGNvbnRleHQudGhyZWFkSWQsXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkcHJvdmlkZURlYnVnVmlzdWFsaXplcnMoZXh0ZW5zaW9uSWQ6IHN0cmluZywgaWQ6IHN0cmluZywgY29udGV4dDogSURlYnVnVmlzdWFsaXphdGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SURlYnVnVmlzdWFsaXphdGlvbi5TZXJpYWxpemVkW10+IHtcblx0XHRjb25zdCBjb250ZXh0SHlkcmF0ZWQgPSB0aGlzLmh5ZHJhdGVWaXN1YWxpemF0aW9uQ29udGV4dChjb250ZXh0KTtcblx0XHRjb25zdCBrZXkgPSB0aGlzLmV4dGVuc2lvblZpc0tleShleHRlbnNpb25JZCwgaWQpO1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fZGVidWdWaXN1YWxpemF0aW9uUHJvdmlkZXJzLmdldChrZXkpO1xuXHRcdGlmICghY29udGV4dEh5ZHJhdGVkIHx8ICFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIFtdOyAvLyBwcm9iYWJseSBlbmRlZCBpbiB0aGUgbWVhbnRpbWVcblx0XHR9XG5cblx0XHRjb25zdCB2aXN1YWxpemF0aW9ucyA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVEZWJ1Z1Zpc3VhbGl6YXRpb24oY29udGV4dEh5ZHJhdGVkLCB0b2tlbik7XG5cblx0XHRpZiAoIXZpc3VhbGl6YXRpb25zKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpc3VhbGl6YXRpb25zLm1hcCh2ID0+IHtcblx0XHRcdGNvbnN0IGlkID0gKyt0aGlzLl92aXN1YWxpemVySWRDb3VudGVyO1xuXHRcdFx0dGhpcy5fdmlzdWFsaXplcnMuc2V0KGlkLCB7IHYsIHByb3ZpZGVyLCBleHRlbnNpb25JZCB9KTtcblx0XHRcdGNvbnN0IGljb24gPSB2Lmljb25QYXRoID8gdGhpcy5nZXRJY29uUGF0aE9yQ2xhc3Modi5pY29uUGF0aCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0bmFtZTogdi5uYW1lLFxuXHRcdFx0XHRpY29uQ2xhc3M6IGljb24/Lmljb25DbGFzcyxcblx0XHRcdFx0aWNvblBhdGg6IGljb24/Lmljb25QYXRoLFxuXHRcdFx0XHR2aXN1YWxpemF0aW9uOiB0aGlzLnNlcmlhbGl6ZVZpc3VhbGl6YXRpb24oZXh0ZW5zaW9uSWQsIHYudmlzdWFsaXphdGlvbiksXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljICRkaXNwb3NlRGVidWdWaXN1YWxpemVycyhpZHM6IG51bWJlcltdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBpZCBvZiBpZHMpIHtcblx0XHRcdHRoaXMuX3Zpc3VhbGl6ZXJzLmRlbGV0ZShpZCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyRGVidWdWaXN1YWxpemF0aW9uUHJvdmlkZXI8VCBleHRlbmRzIHZzY29kZS5EZWJ1Z1Zpc3VhbGl6YXRpb24+KG1hbmlmZXN0OiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGlkOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuRGVidWdWaXN1YWxpemF0aW9uUHJvdmlkZXI8VD4pOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0aWYgKCFtYW5pZmVzdC5jb250cmlidXRlcz8uZGVidWdWaXN1YWxpemVycz8uc29tZShyID0+IHIuaWQgPT09IGlkKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBFeHRlbnNpb25zIG1heSBvbmx5IGNhbGwgcmVnaXN0ZXJEZWJ1Z1Zpc3VhbGl6YXRpb25Qcm92aWRlcigpIGZvciByZW5kZXJlcnMgdGhleSBjb250cmlidXRlIChnb3QgJHtpZH0pYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSBFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KG1hbmlmZXN0LmlkZW50aWZpZXIpO1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuZXh0ZW5zaW9uVmlzS2V5KGV4dGVuc2lvbklkLCBpZCk7XG5cdFx0aWYgKHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvblByb3ZpZGVycy5oYXMoa2V5KSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBIGRlYnVnIHZpc3VhbGl6YXRpb24gcHJvdmlkZXIgd2l0aCBpZCAnJHtpZH0nIGlzIGFscmVhZHkgcmVnaXN0ZXJlZGApO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RlYnVnVmlzdWFsaXphdGlvblByb3ZpZGVycy5zZXQoa2V5LCBwcm92aWRlcik7XG5cdFx0dGhpcy5fZGVidWdTZXJ2aWNlUHJveHkuJHJlZ2lzdGVyRGVidWdWaXN1YWxpemVyKGV4dGVuc2lvbklkLCBpZCk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kdW5yZWdpc3RlckRlYnVnVmlzdWFsaXplcihleHRlbnNpb25JZCwgaWQpO1xuXHRcdFx0dGhpcy5fZGVidWdWaXN1YWxpemF0aW9uUHJvdmlkZXJzLmRlbGV0ZShpZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYWRkQnJlYWtwb2ludHMoYnJlYWtwb2ludHMwOiB2c2NvZGUuQnJlYWtwb2ludFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gZmlsdGVyIG9ubHkgbmV3IGJyZWFrcG9pbnRzXG5cdFx0Y29uc3QgYnJlYWtwb2ludHMgPSBicmVha3BvaW50czAuZmlsdGVyKGJwID0+IHtcblx0XHRcdGNvbnN0IGlkID0gYnAuaWQ7XG5cdFx0XHRpZiAoIXRoaXMuX2JyZWFrcG9pbnRzLmhhcyhpZCkpIHtcblx0XHRcdFx0dGhpcy5fYnJlYWtwb2ludHMuc2V0KGlkLCBicCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0pO1xuXG5cdFx0Ly8gc2VuZCBub3RpZmljYXRpb24gZm9yIGFkZGVkIGJyZWFrcG9pbnRzXG5cdFx0dGhpcy5maXJlQnJlYWtwb2ludENoYW5nZXMoYnJlYWtwb2ludHMsIFtdLCBbXSk7XG5cblx0XHQvLyBjb252ZXJ0IGFkZGVkIGJyZWFrcG9pbnRzIHRvIERUT3Ncblx0XHRjb25zdCBkdG9zOiBBcnJheTxJU291cmNlTXVsdGlCcmVha3BvaW50RHRvIHwgSUZ1bmN0aW9uQnJlYWtwb2ludER0bz4gPSBbXTtcblx0XHRjb25zdCBtYXAgPSBuZXcgTWFwPHN0cmluZywgSVNvdXJjZU11bHRpQnJlYWtwb2ludER0bz4oKTtcblx0XHRmb3IgKGNvbnN0IGJwIG9mIGJyZWFrcG9pbnRzKSB7XG5cdFx0XHRpZiAoYnAgaW5zdGFuY2VvZiBTb3VyY2VCcmVha3BvaW50KSB7XG5cdFx0XHRcdGxldCBkdG8gPSBtYXAuZ2V0KGJwLmxvY2F0aW9uLnVyaS50b1N0cmluZygpKTtcblx0XHRcdFx0aWYgKCFkdG8pIHtcblx0XHRcdFx0XHRkdG8gPSB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc291cmNlTXVsdGknLFxuXHRcdFx0XHRcdFx0dXJpOiBicC5sb2NhdGlvbi51cmksXG5cdFx0XHRcdFx0XHRsaW5lczogW11cblx0XHRcdFx0XHR9IHNhdGlzZmllcyBJU291cmNlTXVsdGlCcmVha3BvaW50RHRvO1xuXHRcdFx0XHRcdG1hcC5zZXQoYnAubG9jYXRpb24udXJpLnRvU3RyaW5nKCksIGR0byk7XG5cdFx0XHRcdFx0ZHRvcy5wdXNoKGR0byk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZHRvLmxpbmVzLnB1c2goe1xuXHRcdFx0XHRcdGlkOiBicC5pZCxcblx0XHRcdFx0XHRlbmFibGVkOiBicC5lbmFibGVkLFxuXHRcdFx0XHRcdGNvbmRpdGlvbjogYnAuY29uZGl0aW9uLFxuXHRcdFx0XHRcdGhpdENvbmRpdGlvbjogYnAuaGl0Q29uZGl0aW9uLFxuXHRcdFx0XHRcdGxvZ01lc3NhZ2U6IGJwLmxvZ01lc3NhZ2UsXG5cdFx0XHRcdFx0bGluZTogYnAubG9jYXRpb24ucmFuZ2Uuc3RhcnQubGluZSxcblx0XHRcdFx0XHRjaGFyYWN0ZXI6IGJwLmxvY2F0aW9uLnJhbmdlLnN0YXJ0LmNoYXJhY3Rlcixcblx0XHRcdFx0XHRtb2RlOiBicC5tb2RlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAoYnAgaW5zdGFuY2VvZiBGdW5jdGlvbkJyZWFrcG9pbnQpIHtcblx0XHRcdFx0ZHRvcy5wdXNoKHtcblx0XHRcdFx0XHR0eXBlOiAnZnVuY3Rpb24nLFxuXHRcdFx0XHRcdGlkOiBicC5pZCxcblx0XHRcdFx0XHRlbmFibGVkOiBicC5lbmFibGVkLFxuXHRcdFx0XHRcdGhpdENvbmRpdGlvbjogYnAuaGl0Q29uZGl0aW9uLFxuXHRcdFx0XHRcdGxvZ01lc3NhZ2U6IGJwLmxvZ01lc3NhZ2UsXG5cdFx0XHRcdFx0Y29uZGl0aW9uOiBicC5jb25kaXRpb24sXG5cdFx0XHRcdFx0ZnVuY3Rpb25OYW1lOiBicC5mdW5jdGlvbk5hbWUsXG5cdFx0XHRcdFx0bW9kZTogYnAubW9kZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gc2VuZCBEVE9zIHRvIFZTIENvZGVcblx0XHRyZXR1cm4gdGhpcy5fZGVidWdTZXJ2aWNlUHJveHkuJHJlZ2lzdGVyQnJlYWtwb2ludHMoZHRvcyk7XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlQnJlYWtwb2ludHMoYnJlYWtwb2ludHMwOiB2c2NvZGUuQnJlYWtwb2ludFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gcmVtb3ZlIGZyb20gYXJyYXlcblx0XHRjb25zdCBicmVha3BvaW50cyA9IGJyZWFrcG9pbnRzMC5maWx0ZXIoYiA9PiB0aGlzLl9icmVha3BvaW50cy5kZWxldGUoYi5pZCkpO1xuXG5cdFx0Ly8gc2VuZCBub3RpZmljYXRpb25cblx0XHR0aGlzLmZpcmVCcmVha3BvaW50Q2hhbmdlcyhbXSwgYnJlYWtwb2ludHMsIFtdKTtcblxuXHRcdC8vIHVucmVnaXN0ZXIgd2l0aCBWUyBDb2RlXG5cdFx0Y29uc3QgaWRzID0gYnJlYWtwb2ludHMuZmlsdGVyKGJwID0+IGJwIGluc3RhbmNlb2YgU291cmNlQnJlYWtwb2ludCkubWFwKGJwID0+IGJwLmlkKTtcblx0XHRjb25zdCBmaWRzID0gYnJlYWtwb2ludHMuZmlsdGVyKGJwID0+IGJwIGluc3RhbmNlb2YgRnVuY3Rpb25CcmVha3BvaW50KS5tYXAoYnAgPT4gYnAuaWQpO1xuXHRcdGNvbnN0IGRpZHMgPSBicmVha3BvaW50cy5maWx0ZXIoYnAgPT4gYnAgaW5zdGFuY2VvZiBEYXRhQnJlYWtwb2ludCkubWFwKGJwID0+IGJwLmlkKTtcblx0XHRyZXR1cm4gdGhpcy5fZGVidWdTZXJ2aWNlUHJveHkuJHVucmVnaXN0ZXJCcmVha3BvaW50cyhpZHMsIGZpZHMsIGRpZHMpO1xuXHR9XG5cblx0cHVibGljIHN0YXJ0RGVidWdnaW5nKGZvbGRlcjogdnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCwgbmFtZU9yQ29uZmlnOiBzdHJpbmcgfCB2c2NvZGUuRGVidWdDb25maWd1cmF0aW9uLCBvcHRpb25zOiB2c2NvZGUuRGVidWdTZXNzaW9uT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHRlc3RSdW5NZXRhID0gb3B0aW9ucy50ZXN0UnVuICYmIHRoaXMuX3Rlc3RpbmcuZ2V0TWV0YWRhdGFGb3JSdW4ob3B0aW9ucy50ZXN0UnVuKTtcblxuXHRcdHJldHVybiB0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kc3RhcnREZWJ1Z2dpbmcoZm9sZGVyID8gZm9sZGVyLnVyaSA6IHVuZGVmaW5lZCwgbmFtZU9yQ29uZmlnLCB7XG5cdFx0XHRwYXJlbnRTZXNzaW9uSUQ6IG9wdGlvbnMucGFyZW50U2Vzc2lvbiA/IG9wdGlvbnMucGFyZW50U2Vzc2lvbi5pZCA6IHVuZGVmaW5lZCxcblx0XHRcdGxpZmVjeWNsZU1hbmFnZWRCeVBhcmVudDogb3B0aW9ucy5saWZlY3ljbGVNYW5hZ2VkQnlQYXJlbnQsXG5cdFx0XHRyZXBsOiBvcHRpb25zLmNvbnNvbGVNb2RlID09PSBEZWJ1Z0NvbnNvbGVNb2RlLk1lcmdlV2l0aFBhcmVudCA/ICdtZXJnZVdpdGhQYXJlbnQnIDogJ3NlcGFyYXRlJyxcblx0XHRcdG5vRGVidWc6IG9wdGlvbnMubm9EZWJ1Zyxcblx0XHRcdGNvbXBhY3Q6IG9wdGlvbnMuY29tcGFjdCxcblx0XHRcdHN1cHByZXNzU2F2ZUJlZm9yZVN0YXJ0OiBvcHRpb25zLnN1cHByZXNzU2F2ZUJlZm9yZVN0YXJ0LFxuXHRcdFx0dGVzdFJ1bjogdGVzdFJ1bk1ldGEgJiYge1xuXHRcdFx0XHRydW5JZDogdGVzdFJ1bk1ldGEucnVuSWQsXG5cdFx0XHRcdHRhc2tJZDogdGVzdFJ1bk1ldGEudGFza0lkLFxuXHRcdFx0fSxcblxuXHRcdFx0Ly8gQ2hlY2sgZGVidWdVSSBmb3IgYmFjay1jb21wYXQsICMxNDcyNjRcblx0XHRcdHN1cHByZXNzRGVidWdTdGF0dXNiYXI6IG9wdGlvbnMuc3VwcHJlc3NEZWJ1Z1N0YXR1c2JhciA/PyAob3B0aW9ucyBhcyBhbnkpLmRlYnVnVUk/LnNpbXBsZSxcblx0XHRcdHN1cHByZXNzRGVidWdUb29sYmFyOiBvcHRpb25zLnN1cHByZXNzRGVidWdUb29sYmFyID8/IChvcHRpb25zIGFzIGFueSkuZGVidWdVST8uc2ltcGxlLFxuXHRcdFx0c3VwcHJlc3NEZWJ1Z1ZpZXc6IG9wdGlvbnMuc3VwcHJlc3NEZWJ1Z1ZpZXcgPz8gKG9wdGlvbnMgYXMgYW55KS5kZWJ1Z1VJPy5zaW1wbGUsXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgc3RvcERlYnVnZ2luZyhzZXNzaW9uPzogdnNjb2RlLkRlYnVnU2Vzc2lvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kc3RvcERlYnVnZ2luZyhzZXNzaW9uID8gc2Vzc2lvbi5pZCA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcih0eXBlOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIsIHRyaWdnZXI6IHZzY29kZS5EZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlclRyaWdnZXJLaW5kKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIG5ldyBEaXNwb3NhYmxlKCgpID0+IHsgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fY29uZmlnUHJvdmlkZXJIYW5kbGVDb3VudGVyKys7XG5cdFx0dGhpcy5fY29uZmlnUHJvdmlkZXJzLnB1c2goeyB0eXBlLCBoYW5kbGUsIHByb3ZpZGVyIH0pO1xuXG5cdFx0dGhpcy5fZGVidWdTZXJ2aWNlUHJveHkuJHJlZ2lzdGVyRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIodHlwZSwgdHJpZ2dlcixcblx0XHRcdCEhcHJvdmlkZXIucHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMsXG5cdFx0XHQhIXByb3ZpZGVyLnJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb24sXG5cdFx0XHQhIXByb3ZpZGVyLnJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb25XaXRoU3Vic3RpdHV0ZWRWYXJpYWJsZXMsXG5cdFx0XHRoYW5kbGUpO1xuXG5cdFx0cmV0dXJuIG5ldyBEaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX2NvbmZpZ1Byb3ZpZGVycyA9IHRoaXMuX2NvbmZpZ1Byb3ZpZGVycy5maWx0ZXIocCA9PiBwLnByb3ZpZGVyICE9PSBwcm92aWRlcik7XHRcdC8vIHJlbW92ZVxuXHRcdFx0dGhpcy5fZGVidWdTZXJ2aWNlUHJveHkuJHVucmVnaXN0ZXJEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcihoYW5kbGUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyRGVidWdBZGFwdGVyRGVzY3JpcHRvckZhY3RvcnkoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHR5cGU6IHN0cmluZywgZmFjdG9yeTogdnNjb2RlLkRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5KTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXG5cdFx0aWYgKCFmYWN0b3J5KSB7XG5cdFx0XHRyZXR1cm4gbmV3IERpc3Bvc2FibGUoKCkgPT4geyB9KTtcblx0XHR9XG5cblx0XHQvLyBhIERlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5IGNhbiBvbmx5IGJlIHJlZ2lzdGVyZWQgaW4gdGhlIGV4dGVuc2lvbiB0aGF0IGNvbnRyaWJ1dGVzIHRoZSBkZWJ1Z2dlclxuXHRcdGlmICghdGhpcy5kZWZpbmVzRGVidWdUeXBlKGV4dGVuc2lvbiwgdHlwZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgYSBEZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeSBjYW4gb25seSBiZSByZWdpc3RlcmVkIGZyb20gdGhlIGV4dGVuc2lvbiB0aGF0IGRlZmluZXMgdGhlICcke3R5cGV9JyBkZWJ1Z2dlci5gKTtcblx0XHR9XG5cblx0XHQvLyBtYWtlIHN1cmUgdGhhdCBvbmx5IG9uZSBmYWN0b3J5IGZvciB0aGlzIHR5cGUgaXMgcmVnaXN0ZXJlZFxuXHRcdGlmICh0aGlzLmdldEFkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeUJ5VHlwZSh0eXBlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBhIERlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5IGNhbiBvbmx5IGJlIHJlZ2lzdGVyZWQgb25jZSBwZXIgYSB0eXBlLmApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkYXB0ZXJGYWN0b3J5SGFuZGxlQ291bnRlcisrO1xuXHRcdHRoaXMuX2FkYXB0ZXJGYWN0b3JpZXMucHVzaCh7IHR5cGUsIGhhbmRsZSwgZmFjdG9yeSB9KTtcblxuXHRcdHRoaXMuX2RlYnVnU2VydmljZVByb3h5LiRyZWdpc3RlckRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5KHR5cGUsIGhhbmRsZSk7XG5cblx0XHRyZXR1cm4gbmV3IERpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fYWRhcHRlckZhY3RvcmllcyA9IHRoaXMuX2FkYXB0ZXJGYWN0b3JpZXMuZmlsdGVyKHAgPT4gcC5mYWN0b3J5ICE9PSBmYWN0b3J5KTtcdFx0Ly8gcmVtb3ZlXG5cdFx0XHR0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kdW5yZWdpc3RlckRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5KGhhbmRsZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJEZWJ1Z0FkYXB0ZXJUcmFja2VyRmFjdG9yeSh0eXBlOiBzdHJpbmcsIGZhY3Rvcnk6IHZzY29kZS5EZWJ1Z0FkYXB0ZXJUcmFja2VyRmFjdG9yeSk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblxuXHRcdGlmICghZmFjdG9yeSkge1xuXHRcdFx0cmV0dXJuIG5ldyBEaXNwb3NhYmxlKCgpID0+IHsgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fdHJhY2tlckZhY3RvcnlIYW5kbGVDb3VudGVyKys7XG5cdFx0dGhpcy5fdHJhY2tlckZhY3Rvcmllcy5wdXNoKHsgdHlwZSwgaGFuZGxlLCBmYWN0b3J5IH0pO1xuXG5cdFx0cmV0dXJuIG5ldyBEaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX3RyYWNrZXJGYWN0b3JpZXMgPSB0aGlzLl90cmFja2VyRmFjdG9yaWVzLmZpbHRlcihwID0+IHAuZmFjdG9yeSAhPT0gZmFjdG9yeSk7XHRcdC8vIHJlbW92ZVxuXHRcdH0pO1xuXHR9XG5cblx0Ly8gUlBDIG1ldGhvZHMgKEV4dEhvc3REZWJ1Z1NlcnZpY2VTaGFwZSlcblxuXHRwdWJsaWMgYXN5bmMgJHJ1bkluVGVybWluYWwoYXJnczogRGVidWdQcm90b2NvbC5SdW5JblRlcm1pbmFsUmVxdWVzdEFyZ3VtZW50cywgc2Vzc2lvbklkOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkc3Vic3RpdHV0ZVZhcmlhYmxlcyhmb2xkZXJVcmk6IFVyaUNvbXBvbmVudHMgfCB1bmRlZmluZWQsIGNvbmZpZzogSUNvbmZpZyk6IFByb21pc2U8SUNvbmZpZz4ge1xuXHRcdGxldCB3czogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLmdldEZvbGRlcihmb2xkZXJVcmkpO1xuXHRcdGlmIChmb2xkZXIpIHtcblx0XHRcdHdzID0ge1xuXHRcdFx0XHR1cmk6IGZvbGRlci51cmksXG5cdFx0XHRcdG5hbWU6IGZvbGRlci5uYW1lLFxuXHRcdFx0XHRpbmRleDogZm9sZGVyLmluZGV4LFxuXHRcdFx0XHR0b1Jlc291cmNlOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0Y29uc3QgdmFyaWFibGVSZXNvbHZlciA9IGF3YWl0IHRoaXMuX3ZhcmlhYmxlUmVzb2x2ZXIuZ2V0UmVzb2x2ZXIoKTtcblx0XHRyZXR1cm4gdmFyaWFibGVSZXNvbHZlci5yZXNvbHZlQXN5bmMod3MsIGNvbmZpZyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlRGVidWdBZGFwdGVyKGFkYXB0ZXI6IHZzY29kZS5EZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yLCBzZXNzaW9uOiBFeHRIb3N0RGVidWdTZXNzaW9uKTogQWJzdHJhY3REZWJ1Z0FkYXB0ZXIgfCB1bmRlZmluZWQge1xuXHRcdGlmIChhZGFwdGVyIGluc3RhbmNlb2YgRGVidWdBZGFwdGVySW5saW5lSW1wbGVtZW50YXRpb24pIHtcblx0XHRcdHJldHVybiBuZXcgRGlyZWN0RGVidWdBZGFwdGVyKGFkYXB0ZXIuaW1wbGVtZW50YXRpb24pO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZVNpZ25TZXJ2aWNlKCk6IElTaWduU2VydmljZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkc3RhcnREQVNlc3Npb24oZGVidWdBZGFwdGVySGFuZGxlOiBudW1iZXIsIHNlc3Npb25EdG86IElEZWJ1Z1Nlc3Npb25EdG8pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBteXRoaXMgPSB0aGlzO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHRoaXMuZ2V0U2Vzc2lvbihzZXNzaW9uRHRvKTtcblxuXHRcdHJldHVybiB0aGlzLmdldEFkYXB0ZXJEZXNjcmlwdG9yKHRoaXMuZ2V0QWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5QnlUeXBlKHNlc3Npb24udHlwZSksIHNlc3Npb24pLnRoZW4oZGFEZXNjcmlwdG9yID0+IHtcblxuXHRcdFx0aWYgKCFkYURlc2NyaXB0b3IpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGEgZGVidWcgYWRhcHRlciBkZXNjcmlwdG9yIGZvciBkZWJ1ZyB0eXBlICcke3Nlc3Npb24udHlwZX0nIChleHRlbnNpb24gbWlnaHQgaGF2ZSBmYWlsZWQgdG8gYWN0aXZhdGUpYCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRhID0gdGhpcy5jcmVhdGVEZWJ1Z0FkYXB0ZXIoZGFEZXNjcmlwdG9yLCBzZXNzaW9uKTtcblx0XHRcdGlmICghZGEpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBjcmVhdGUgYSBkZWJ1ZyBhZGFwdGVyIGZvciB0eXBlICcke3Nlc3Npb24udHlwZX0nLmApO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZWJ1Z0FkYXB0ZXIgPSBkYTtcblxuXHRcdFx0dGhpcy5fZGVidWdBZGFwdGVycy5zZXQoZGVidWdBZGFwdGVySGFuZGxlLCBkZWJ1Z0FkYXB0ZXIpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5nZXREZWJ1Z0FkYXB0ZXJUcmFja2VycyhzZXNzaW9uKS50aGVuKHRyYWNrZXIgPT4ge1xuXG5cdFx0XHRcdGlmICh0cmFja2VyKSB7XG5cdFx0XHRcdFx0dGhpcy5fZGVidWdBZGFwdGVyc1RyYWNrZXJzLnNldChkZWJ1Z0FkYXB0ZXJIYW5kbGUsIHRyYWNrZXIpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGVidWdBZGFwdGVyLm9uTWVzc2FnZShhc3luYyBtZXNzYWdlID0+IHtcblxuXHRcdFx0XHRcdGlmIChtZXNzYWdlLnR5cGUgPT09ICdyZXF1ZXN0JyAmJiAoPERlYnVnUHJvdG9jb2wuUmVxdWVzdD5tZXNzYWdlKS5jb21tYW5kID09PSAnaGFuZHNoYWtlJykge1xuXG5cdFx0XHRcdFx0XHRjb25zdCByZXF1ZXN0ID0gPERlYnVnUHJvdG9jb2wuUmVxdWVzdD5tZXNzYWdlO1xuXG5cdFx0XHRcdFx0XHRjb25zdCByZXNwb25zZTogRGVidWdQcm90b2NvbC5SZXNwb25zZSA9IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3Jlc3BvbnNlJyxcblx0XHRcdFx0XHRcdFx0c2VxOiAwLFxuXHRcdFx0XHRcdFx0XHRjb21tYW5kOiByZXF1ZXN0LmNvbW1hbmQsXG5cdFx0XHRcdFx0XHRcdHJlcXVlc3Rfc2VxOiByZXF1ZXN0LnNlcSxcblx0XHRcdFx0XHRcdFx0c3VjY2VzczogdHJ1ZVxuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLl9zaWduU2VydmljZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zaWduU2VydmljZSA9IHRoaXMuY3JlYXRlU2lnblNlcnZpY2UoKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuX3NpZ25TZXJ2aWNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qgc2lnbmF0dXJlID0gYXdhaXQgdGhpcy5fc2lnblNlcnZpY2Uuc2lnbihyZXF1ZXN0LmFyZ3VtZW50cy52YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2UuYm9keSA9IHtcblx0XHRcdFx0XHRcdFx0XHRcdHNpZ25hdHVyZTogc2lnbmF0dXJlXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRkZWJ1Z0FkYXB0ZXIuc2VuZFJlc3BvbnNlKHJlc3BvbnNlKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vIHNpZ25lcicpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3BvbnNlLnN1Y2Nlc3MgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0cmVzcG9uc2UubWVzc2FnZSA9IGUubWVzc2FnZTtcblx0XHRcdFx0XHRcdFx0ZGVidWdBZGFwdGVyLnNlbmRSZXNwb25zZShyZXNwb25zZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlmICh0cmFja2VyICYmIHRyYWNrZXIub25EaWRTZW5kTWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHR0cmFja2VyLm9uRGlkU2VuZE1lc3NhZ2UobWVzc2FnZSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIERBIC0+IFZTIENvZGVcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdC8vIFRyeSB0byBjYXRjaCBkZXRhaWxzIGZvciAjMjMzMTY3XG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2UgPSBjb252ZXJ0VG9WU0NQYXRocyhtZXNzYWdlLCB0cnVlKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdHlwZSA9IG1lc3NhZ2UudHlwZSArICdfJyArICgobWVzc2FnZSBhcyBhbnkpLmNvbW1hbmQgPz8gKG1lc3NhZ2UgYXMgYW55KS5ldmVudCA/PyAnJyk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3RlbGVtZXRyeVByb3h5LiRwdWJsaWNMb2cyPERlYnVnUHJvdG9jb2xNZXNzYWdlRXJyb3JFdmVudCwgRGVidWdQcm90b2NvbE1lc3NhZ2VFcnJvckNsYXNzaWZpY2F0aW9uPignZGVidWdQcm90b2NvbE1lc3NhZ2VFcnJvcicsIHsgdHlwZSwgZnJvbTogc2Vzc2lvbi50eXBlIH0pO1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRteXRoaXMuX2RlYnVnU2VydmljZVByb3h5LiRhY2NlcHREQU1lc3NhZ2UoZGVidWdBZGFwdGVySGFuZGxlLCBtZXNzYWdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkZWJ1Z0FkYXB0ZXIub25FcnJvcihlcnIgPT4ge1xuXHRcdFx0XHRcdGlmICh0cmFja2VyICYmIHRyYWNrZXIub25FcnJvcikge1xuXHRcdFx0XHRcdFx0dHJhY2tlci5vbkVycm9yKGVycik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuX2RlYnVnU2VydmljZVByb3h5LiRhY2NlcHREQUVycm9yKGRlYnVnQWRhcHRlckhhbmRsZSwgZXJyLm5hbWUsIGVyci5tZXNzYWdlLCBlcnIuc3RhY2spO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGVidWdBZGFwdGVyLm9uRXhpdCgoY29kZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xuXHRcdFx0XHRcdGlmICh0cmFja2VyICYmIHRyYWNrZXIub25FeGl0KSB7XG5cdFx0XHRcdFx0XHR0cmFja2VyLm9uRXhpdChjb2RlID8/IHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5fZGVidWdTZXJ2aWNlUHJveHkuJGFjY2VwdERBRXhpdChkZWJ1Z0FkYXB0ZXJIYW5kbGUsIGNvZGUgPz8gdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAodHJhY2tlciAmJiB0cmFja2VyLm9uV2lsbFN0YXJ0U2Vzc2lvbikge1xuXHRcdFx0XHRcdHRyYWNrZXIub25XaWxsU3RhcnRTZXNzaW9uKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZGVidWdBZGFwdGVyLnN0YXJ0U2Vzc2lvbigpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgJHNlbmREQU1lc3NhZ2UoZGVidWdBZGFwdGVySGFuZGxlOiBudW1iZXIsIG1lc3NhZ2U6IERlYnVnUHJvdG9jb2wuUHJvdG9jb2xNZXNzYWdlKTogdm9pZCB7XG5cblx0XHQvLyBWUyBDb2RlIC0+IERBXG5cdFx0bWVzc2FnZSA9IGNvbnZlcnRUb0RBUGF0aHMobWVzc2FnZSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgdHJhY2tlciA9IHRoaXMuX2RlYnVnQWRhcHRlcnNUcmFja2Vycy5nZXQoZGVidWdBZGFwdGVySGFuZGxlKTtcdC8vIFRPRE9AQVc6IHNhbWUgaGFuZGxlP1xuXHRcdGlmICh0cmFja2VyICYmIHRyYWNrZXIub25XaWxsUmVjZWl2ZU1lc3NhZ2UpIHtcblx0XHRcdHRyYWNrZXIub25XaWxsUmVjZWl2ZU1lc3NhZ2UobWVzc2FnZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGEgPSB0aGlzLl9kZWJ1Z0FkYXB0ZXJzLmdldChkZWJ1Z0FkYXB0ZXJIYW5kbGUpO1xuXHRcdGRhPy5zZW5kTWVzc2FnZShtZXNzYWdlKTtcblx0fVxuXG5cdHB1YmxpYyAkc3RvcERBU2Vzc2lvbihkZWJ1Z0FkYXB0ZXJIYW5kbGU6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgdHJhY2tlciA9IHRoaXMuX2RlYnVnQWRhcHRlcnNUcmFja2Vycy5nZXQoZGVidWdBZGFwdGVySGFuZGxlKTtcblx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJzVHJhY2tlcnMuZGVsZXRlKGRlYnVnQWRhcHRlckhhbmRsZSk7XG5cdFx0aWYgKHRyYWNrZXIgJiYgdHJhY2tlci5vbldpbGxTdG9wU2Vzc2lvbikge1xuXHRcdFx0dHJhY2tlci5vbldpbGxTdG9wU2Vzc2lvbigpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhID0gdGhpcy5fZGVidWdBZGFwdGVycy5nZXQoZGVidWdBZGFwdGVySGFuZGxlKTtcblx0XHR0aGlzLl9kZWJ1Z0FkYXB0ZXJzLmRlbGV0ZShkZWJ1Z0FkYXB0ZXJIYW5kbGUpO1xuXHRcdGlmIChkYSkge1xuXHRcdFx0cmV0dXJuIGRhLnN0b3BTZXNzaW9uKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodm9pZCAwKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgJGFjY2VwdEJyZWFrcG9pbnRzRGVsdGEoZGVsdGE6IElCcmVha3BvaW50c0RlbHRhRHRvKTogdm9pZCB7XG5cblx0XHRjb25zdCBhOiB2c2NvZGUuQnJlYWtwb2ludFtdID0gW107XG5cdFx0Y29uc3QgcjogdnNjb2RlLkJyZWFrcG9pbnRbXSA9IFtdO1xuXHRcdGNvbnN0IGM6IHZzY29kZS5CcmVha3BvaW50W10gPSBbXTtcblxuXHRcdGlmIChkZWx0YS5hZGRlZCkge1xuXHRcdFx0Zm9yIChjb25zdCBicGQgb2YgZGVsdGEuYWRkZWQpIHtcblx0XHRcdFx0Y29uc3QgaWQgPSBicGQuaWQ7XG5cdFx0XHRcdGlmIChpZCAmJiAhdGhpcy5fYnJlYWtwb2ludHMuaGFzKGlkKSkge1xuXHRcdFx0XHRcdGxldCBicDogQnJlYWtwb2ludDtcblx0XHRcdFx0XHRpZiAoYnBkLnR5cGUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdGJwID0gbmV3IEZ1bmN0aW9uQnJlYWtwb2ludChicGQuZnVuY3Rpb25OYW1lLCBicGQuZW5hYmxlZCwgYnBkLmNvbmRpdGlvbiwgYnBkLmhpdENvbmRpdGlvbiwgYnBkLmxvZ01lc3NhZ2UsIGJwZC5tb2RlKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGJwZC50eXBlID09PSAnZGF0YScpIHtcblx0XHRcdFx0XHRcdGJwID0gbmV3IERhdGFCcmVha3BvaW50KGJwZC5sYWJlbCwgYnBkLmRhdGFJZCwgYnBkLmNhblBlcnNpc3QsIGJwZC5lbmFibGVkLCBicGQuaGl0Q29uZGl0aW9uLCBicGQuY29uZGl0aW9uLCBicGQubG9nTWVzc2FnZSwgYnBkLm1vZGUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKGJwZC51cmkpO1xuXHRcdFx0XHRcdFx0YnAgPSBuZXcgU291cmNlQnJlYWtwb2ludChuZXcgTG9jYXRpb24odXJpLCBuZXcgUG9zaXRpb24oYnBkLmxpbmUsIGJwZC5jaGFyYWN0ZXIpKSwgYnBkLmVuYWJsZWQsIGJwZC5jb25kaXRpb24sIGJwZC5oaXRDb25kaXRpb24sIGJwZC5sb2dNZXNzYWdlLCBicGQubW9kZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNldEJyZWFrcG9pbnRJZChicCwgaWQpO1xuXHRcdFx0XHRcdHRoaXMuX2JyZWFrcG9pbnRzLnNldChpZCwgYnApO1xuXHRcdFx0XHRcdGEucHVzaChicCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZGVsdGEucmVtb3ZlZCkge1xuXHRcdFx0Zm9yIChjb25zdCBpZCBvZiBkZWx0YS5yZW1vdmVkKSB7XG5cdFx0XHRcdGNvbnN0IGJwID0gdGhpcy5fYnJlYWtwb2ludHMuZ2V0KGlkKTtcblx0XHRcdFx0aWYgKGJwKSB7XG5cdFx0XHRcdFx0dGhpcy5fYnJlYWtwb2ludHMuZGVsZXRlKGlkKTtcblx0XHRcdFx0XHRyLnB1c2goYnApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGRlbHRhLmNoYW5nZWQpIHtcblx0XHRcdGZvciAoY29uc3QgYnBkIG9mIGRlbHRhLmNoYW5nZWQpIHtcblx0XHRcdFx0aWYgKGJwZC5pZCkge1xuXHRcdFx0XHRcdGNvbnN0IGJwID0gdGhpcy5fYnJlYWtwb2ludHMuZ2V0KGJwZC5pZCk7XG5cdFx0XHRcdFx0aWYgKGJwKSB7XG5cdFx0XHRcdFx0XHRpZiAoYnAgaW5zdGFuY2VvZiBGdW5jdGlvbkJyZWFrcG9pbnQgJiYgYnBkLnR5cGUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZmJwID0gPGFueT5icDtcblx0XHRcdFx0XHRcdFx0ZmJwLmVuYWJsZWQgPSBicGQuZW5hYmxlZDtcblx0XHRcdFx0XHRcdFx0ZmJwLmNvbmRpdGlvbiA9IGJwZC5jb25kaXRpb247XG5cdFx0XHRcdFx0XHRcdGZicC5oaXRDb25kaXRpb24gPSBicGQuaGl0Q29uZGl0aW9uO1xuXHRcdFx0XHRcdFx0XHRmYnAubG9nTWVzc2FnZSA9IGJwZC5sb2dNZXNzYWdlO1xuXHRcdFx0XHRcdFx0XHRmYnAuZnVuY3Rpb25OYW1lID0gYnBkLmZ1bmN0aW9uTmFtZTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoYnAgaW5zdGFuY2VvZiBTb3VyY2VCcmVha3BvaW50ICYmIGJwZC50eXBlID09PSAnc291cmNlJykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzYnAgPSA8YW55PmJwO1xuXHRcdFx0XHRcdFx0XHRzYnAuZW5hYmxlZCA9IGJwZC5lbmFibGVkO1xuXHRcdFx0XHRcdFx0XHRzYnAuY29uZGl0aW9uID0gYnBkLmNvbmRpdGlvbjtcblx0XHRcdFx0XHRcdFx0c2JwLmhpdENvbmRpdGlvbiA9IGJwZC5oaXRDb25kaXRpb247XG5cdFx0XHRcdFx0XHRcdHNicC5sb2dNZXNzYWdlID0gYnBkLmxvZ01lc3NhZ2U7XG5cdFx0XHRcdFx0XHRcdHNicC5sb2NhdGlvbiA9IG5ldyBMb2NhdGlvbihVUkkucmV2aXZlKGJwZC51cmkpLCBuZXcgUG9zaXRpb24oYnBkLmxpbmUsIGJwZC5jaGFyYWN0ZXIpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGMucHVzaChicCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5maXJlQnJlYWtwb2ludENoYW5nZXMoYSwgciwgYyk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGFjY2VwdFN0YWNrRnJhbWVGb2N1cyhmb2N1c0R0bzogSVRocmVhZEZvY3VzRHRvIHwgSVN0YWNrRnJhbWVGb2N1c0R0byB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBmb2N1czogdnNjb2RlLkRlYnVnVGhyZWFkIHwgdnNjb2RlLkRlYnVnU3RhY2tGcmFtZSB8IHVuZGVmaW5lZDtcblx0XHRpZiAoZm9jdXNEdG8pIHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0aGlzLmdldFNlc3Npb24oZm9jdXNEdG8uc2Vzc2lvbklkKTtcblx0XHRcdGlmIChmb2N1c0R0by5raW5kID09PSAndGhyZWFkJykge1xuXHRcdFx0XHRmb2N1cyA9IG5ldyBEZWJ1Z1RocmVhZChzZXNzaW9uLmFwaSwgZm9jdXNEdG8udGhyZWFkSWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9jdXMgPSBuZXcgRGVidWdTdGFja0ZyYW1lKHNlc3Npb24uYXBpLCBmb2N1c0R0by50aHJlYWRJZCwgZm9jdXNEdG8uZnJhbWVJZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fYWN0aXZlU3RhY2tJdGVtID0gZm9jdXM7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTdGFja0l0ZW0uZmlyZSh0aGlzLl9hY3RpdmVTdGFja0l0ZW0pO1xuXHR9XG5cblx0cHVibGljICRwcm92aWRlRGVidWdDb25maWd1cmF0aW9ucyhjb25maWdQcm92aWRlckhhbmRsZTogbnVtYmVyLCBmb2xkZXJVcmk6IFVyaUNvbXBvbmVudHMgfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dnNjb2RlLkRlYnVnQ29uZmlndXJhdGlvbltdPiB7XG5cdFx0cmV0dXJuIGFzUHJvbWlzZShhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuZ2V0Q29uZmlnUHJvdmlkZXJCeUhhbmRsZShjb25maWdQcm92aWRlckhhbmRsZSk7XG5cdFx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignbm8gRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIgZm91bmQnKTtcblx0XHRcdH1cblx0XHRcdGlmICghcHJvdmlkZXIucHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlciBoYXMgbm8gbWV0aG9kIHByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zJyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLmdldEZvbGRlcihmb2xkZXJVcmkpO1xuXHRcdFx0cmV0dXJuIHByb3ZpZGVyLnByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zKGZvbGRlciwgdG9rZW4pO1xuXHRcdH0pLnRoZW4oZGVidWdDb25maWd1cmF0aW9ucyA9PiB7XG5cdFx0XHRpZiAoIWRlYnVnQ29uZmlndXJhdGlvbnMpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3RoaW5nIHJldHVybmVkIGZyb20gRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIucHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMnKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkZWJ1Z0NvbmZpZ3VyYXRpb25zO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljICRyZXNvbHZlRGVidWdDb25maWd1cmF0aW9uKGNvbmZpZ1Byb3ZpZGVySGFuZGxlOiBudW1iZXIsIGZvbGRlclVyaTogVXJpQ29tcG9uZW50cyB8IHVuZGVmaW5lZCwgZGVidWdDb25maWd1cmF0aW9uOiB2c2NvZGUuRGVidWdDb25maWd1cmF0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5EZWJ1Z0NvbmZpZ3VyYXRpb24gfCBudWxsIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIGFzUHJvbWlzZShhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuZ2V0Q29uZmlnUHJvdmlkZXJCeUhhbmRsZShjb25maWdQcm92aWRlckhhbmRsZSk7XG5cdFx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignbm8gRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIgZm91bmQnKTtcblx0XHRcdH1cblx0XHRcdGlmICghcHJvdmlkZXIucmVzb2x2ZURlYnVnQ29uZmlndXJhdGlvbikge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyIGhhcyBubyBtZXRob2QgcmVzb2x2ZURlYnVnQ29uZmlndXJhdGlvbicpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZm9sZGVyID0gYXdhaXQgdGhpcy5nZXRGb2xkZXIoZm9sZGVyVXJpKTtcblx0XHRcdHJldHVybiBwcm92aWRlci5yZXNvbHZlRGVidWdDb25maWd1cmF0aW9uKGZvbGRlciwgZGVidWdDb25maWd1cmF0aW9uLCB0b2tlbik7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgJHJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb25XaXRoU3Vic3RpdHV0ZWRWYXJpYWJsZXMoY29uZmlnUHJvdmlkZXJIYW5kbGU6IG51bWJlciwgZm9sZGVyVXJpOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkLCBkZWJ1Z0NvbmZpZ3VyYXRpb246IHZzY29kZS5EZWJ1Z0NvbmZpZ3VyYXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dnNjb2RlLkRlYnVnQ29uZmlndXJhdGlvbiB8IG51bGwgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gYXNQcm9taXNlKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5nZXRDb25maWdQcm92aWRlckJ5SGFuZGxlKGNvbmZpZ1Byb3ZpZGVySGFuZGxlKTtcblx0XHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdubyBEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlciBmb3VuZCcpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFwcm92aWRlci5yZXNvbHZlRGVidWdDb25maWd1cmF0aW9uV2l0aFN1YnN0aXR1dGVkVmFyaWFibGVzKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIgaGFzIG5vIG1ldGhvZCByZXNvbHZlRGVidWdDb25maWd1cmF0aW9uV2l0aFN1YnN0aXR1dGVkVmFyaWFibGVzJyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLmdldEZvbGRlcihmb2xkZXJVcmkpO1xuXHRcdFx0cmV0dXJuIHByb3ZpZGVyLnJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb25XaXRoU3Vic3RpdHV0ZWRWYXJpYWJsZXMoZm9sZGVyLCBkZWJ1Z0NvbmZpZ3VyYXRpb24sIHRva2VuKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkcHJvdmlkZURlYnVnQWRhcHRlcihhZGFwdGVyRmFjdG9yeUhhbmRsZTogbnVtYmVyLCBzZXNzaW9uRHRvOiBJRGVidWdTZXNzaW9uRHRvKTogUHJvbWlzZTxEdG88SUFkYXB0ZXJEZXNjcmlwdG9yPj4ge1xuXHRcdGNvbnN0IGFkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeSA9IHRoaXMuZ2V0QWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5QnlIYW5kbGUoYWRhcHRlckZhY3RvcnlIYW5kbGUpO1xuXHRcdGlmICghYWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdubyBhZGFwdGVyIGRlc2NyaXB0b3IgZmFjdG9yeSBmb3VuZCBmb3IgaGFuZGxlJykpO1xuXHRcdH1cblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5nZXRTZXNzaW9uKHNlc3Npb25EdG8pO1xuXHRcdHJldHVybiB0aGlzLmdldEFkYXB0ZXJEZXNjcmlwdG9yKGFkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeSwgc2Vzc2lvbikudGhlbihhZGFwdGVyRGVzY3JpcHRvciA9PiB7XG5cdFx0XHRpZiAoIWFkYXB0ZXJEZXNjcmlwdG9yKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBhIGRlYnVnIGFkYXB0ZXIgZGVzY3JpcHRvciBmb3IgZGVidWcgdHlwZSAnJHtzZXNzaW9uLnR5cGV9J2ApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuY29udmVydFRvRHRvKGFkYXB0ZXJEZXNjcmlwdG9yKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkYWNjZXB0RGVidWdTZXNzaW9uU3RhcnRlZChzZXNzaW9uRHRvOiBJRGVidWdTZXNzaW9uRHRvKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHRoaXMuZ2V0U2Vzc2lvbihzZXNzaW9uRHRvKTtcblx0XHR0aGlzLl9vbkRpZFN0YXJ0RGVidWdTZXNzaW9uLmZpcmUoc2Vzc2lvbi5hcGkpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRhY2NlcHREZWJ1Z1Nlc3Npb25UZXJtaW5hdGVkKHNlc3Npb25EdG86IElEZWJ1Z1Nlc3Npb25EdG8pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5nZXRTZXNzaW9uKHNlc3Npb25EdG8pO1xuXHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFRlcm1pbmF0ZURlYnVnU2Vzc2lvbi5maXJlKHNlc3Npb24uYXBpKTtcblx0XHRcdHRoaXMuX2RlYnVnU2Vzc2lvbnMuZGVsZXRlKHNlc3Npb24uaWQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkYWNjZXB0RGVidWdTZXNzaW9uQWN0aXZlQ2hhbmdlZChzZXNzaW9uRHRvOiBJRGVidWdTZXNzaW9uRHRvIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fYWN0aXZlRGVidWdTZXNzaW9uID0gc2Vzc2lvbkR0byA/IGF3YWl0IHRoaXMuZ2V0U2Vzc2lvbihzZXNzaW9uRHRvKSA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZURlYnVnU2Vzc2lvbi5maXJlKHRoaXMuX2FjdGl2ZURlYnVnU2Vzc2lvbj8uYXBpKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkYWNjZXB0RGVidWdTZXNzaW9uTmFtZUNoYW5nZWQoc2Vzc2lvbkR0bzogSURlYnVnU2Vzc2lvbkR0bywgbmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHRoaXMuZ2V0U2Vzc2lvbihzZXNzaW9uRHRvKTtcblx0XHRzZXNzaW9uPy5fYWNjZXB0TmFtZUNoYW5nZWQobmFtZSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGFjY2VwdERlYnVnU2Vzc2lvbkN1c3RvbUV2ZW50KHNlc3Npb25EdG86IElEZWJ1Z1Nlc3Npb25EdG8sIGV2ZW50OiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5nZXRTZXNzaW9uKHNlc3Npb25EdG8pO1xuXHRcdGNvbnN0IGVlOiB2c2NvZGUuRGVidWdTZXNzaW9uQ3VzdG9tRXZlbnQgPSB7XG5cdFx0XHRzZXNzaW9uOiBzZXNzaW9uLmFwaSxcblx0XHRcdGV2ZW50OiBldmVudC5ldmVudCxcblx0XHRcdGJvZHk6IGV2ZW50LmJvZHlcblx0XHR9O1xuXHRcdHRoaXMuX29uRGlkUmVjZWl2ZURlYnVnU2Vzc2lvbkN1c3RvbUV2ZW50LmZpcmUoZWUpO1xuXHR9XG5cblx0Ly8gcHJpdmF0ZSAmIGR0byBoZWxwZXJzXG5cblx0cHJpdmF0ZSBjb252ZXJ0VG9EdG8oeDogdnNjb2RlLkRlYnVnQWRhcHRlckRlc2NyaXB0b3IpOiBEdG88SUFkYXB0ZXJEZXNjcmlwdG9yPiB7XG5cdFx0aWYgKHggaW5zdGFuY2VvZiBEZWJ1Z0FkYXB0ZXJFeGVjdXRhYmxlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jb252ZXJ0RXhlY3V0YWJsZVRvRHRvKHgpO1xuXHRcdH0gZWxzZSBpZiAoeCBpbnN0YW5jZW9mIERlYnVnQWRhcHRlclNlcnZlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29udmVydFNlcnZlclRvRHRvKHgpO1xuXHRcdH0gZWxzZSBpZiAoeCBpbnN0YW5jZW9mIERlYnVnQWRhcHRlck5hbWVkUGlwZVNlcnZlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29udmVydFBpcGVTZXJ2ZXJUb0R0byh4KTtcblx0XHR9IGVsc2UgaWYgKHggaW5zdGFuY2VvZiBEZWJ1Z0FkYXB0ZXJJbmxpbmVJbXBsZW1lbnRhdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29udmVydEltcGxlbWVudGF0aW9uVG9EdG8oeCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignY29udmVydFRvRHRvIHVuZXhwZWN0ZWQgdHlwZScpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBjb252ZXJ0RXhlY3V0YWJsZVRvRHRvKHg6IERlYnVnQWRhcHRlckV4ZWN1dGFibGUpOiBJRGVidWdBZGFwdGVyRXhlY3V0YWJsZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6ICdleGVjdXRhYmxlJyxcblx0XHRcdGNvbW1hbmQ6IHguY29tbWFuZCxcblx0XHRcdGFyZ3M6IHguYXJncyxcblx0XHRcdG9wdGlvbnM6IHgub3B0aW9uc1xuXHRcdH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgY29udmVydFNlcnZlclRvRHRvKHg6IERlYnVnQWRhcHRlclNlcnZlcik6IElEZWJ1Z0FkYXB0ZXJTZXJ2ZXIge1xuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiAnc2VydmVyJyxcblx0XHRcdHBvcnQ6IHgucG9ydCxcblx0XHRcdGhvc3Q6IHguaG9zdFxuXHRcdH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgY29udmVydFBpcGVTZXJ2ZXJUb0R0byh4OiBEZWJ1Z0FkYXB0ZXJOYW1lZFBpcGVTZXJ2ZXIpOiBJRGVidWdBZGFwdGVyTmFtZWRQaXBlU2VydmVyIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogJ3BpcGVTZXJ2ZXInLFxuXHRcdFx0cGF0aDogeC5wYXRoXG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCBjb252ZXJ0SW1wbGVtZW50YXRpb25Ub0R0byh4OiBEZWJ1Z0FkYXB0ZXJJbmxpbmVJbXBsZW1lbnRhdGlvbik6IElEZWJ1Z0FkYXB0ZXJJbXBsIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogJ2ltcGxlbWVudGF0aW9uJyxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBZGFwdGVyRGVzY3JpcHRvckZhY3RvcnlCeVR5cGUodHlwZTogc3RyaW5nKTogdnNjb2RlLkRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXN1bHRzID0gdGhpcy5fYWRhcHRlckZhY3Rvcmllcy5maWx0ZXIocCA9PiBwLnR5cGUgPT09IHR5cGUpO1xuXHRcdGlmIChyZXN1bHRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybiByZXN1bHRzWzBdLmZhY3Rvcnk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldEFkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeUJ5SGFuZGxlKGhhbmRsZTogbnVtYmVyKTogdnNjb2RlLkRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXN1bHRzID0gdGhpcy5fYWRhcHRlckZhY3Rvcmllcy5maWx0ZXIocCA9PiBwLmhhbmRsZSA9PT0gaGFuZGxlKTtcblx0XHRpZiAocmVzdWx0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0c1swXS5mYWN0b3J5O1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb25maWdQcm92aWRlckJ5SGFuZGxlKGhhbmRsZTogbnVtYmVyKTogdnNjb2RlLkRlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXN1bHRzID0gdGhpcy5fY29uZmlnUHJvdmlkZXJzLmZpbHRlcihwID0+IHAuaGFuZGxlID09PSBoYW5kbGUpO1xuXHRcdGlmIChyZXN1bHRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybiByZXN1bHRzWzBdLnByb3ZpZGVyO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBkZWZpbmVzRGVidWdUeXBlKGVkOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHR5cGU6IHN0cmluZykge1xuXHRcdGlmIChlZC5jb250cmlidXRlcykge1xuXHRcdFx0Y29uc3QgZGVidWdnZXJzID0gZWQuY29udHJpYnV0ZXNbJ2RlYnVnZ2VycyddO1xuXHRcdFx0aWYgKGRlYnVnZ2VycyAmJiBkZWJ1Z2dlcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGRiZyBvZiBkZWJ1Z2dlcnMpIHtcblx0XHRcdFx0XHQvLyBvbmx5IGRlYnVnZ2VyIGNvbnRyaWJ1dGlvbnMgd2l0aCBhIFwibGFiZWxcIiBhcmUgY29uc2lkZXJlZCBhIFwiZGVmaW5pbmdcIiBkZWJ1Z2dlciBjb250cmlidXRpb25cblx0XHRcdFx0XHRpZiAoZGJnLmxhYmVsICYmIGRiZy50eXBlKSB7XG5cdFx0XHRcdFx0XHRpZiAoZGJnLnR5cGUgPT09IHR5cGUpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGVidWdBZGFwdGVyVHJhY2tlcnMoc2Vzc2lvbjogRXh0SG9zdERlYnVnU2Vzc2lvbik6IFByb21pc2U8dnNjb2RlLkRlYnVnQWRhcHRlclRyYWNrZXIgfCB1bmRlZmluZWQ+IHtcblxuXHRcdGNvbnN0IGNvbmZpZyA9IHNlc3Npb24uY29uZmlndXJhdGlvbjtcblx0XHRjb25zdCB0eXBlID0gY29uZmlnLnR5cGU7XG5cblx0XHRjb25zdCBwcm9taXNlcyA9IHRoaXMuX3RyYWNrZXJGYWN0b3JpZXNcblx0XHRcdC5maWx0ZXIodHVwbGUgPT4gdHVwbGUudHlwZSA9PT0gdHlwZSB8fCB0dXBsZS50eXBlID09PSAnKicpXG5cdFx0XHQubWFwKHR1cGxlID0+IGFzUHJvbWlzZTx2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLkRlYnVnQWRhcHRlclRyYWNrZXI+PigoKSA9PiB0dXBsZS5mYWN0b3J5LmNyZWF0ZURlYnVnQWRhcHRlclRyYWNrZXIoc2Vzc2lvbi5hcGkpKS50aGVuKHAgPT4gcCwgZXJyID0+IG51bGwpKTtcblxuXHRcdHJldHVybiBQcm9taXNlLnJhY2UoW1xuXHRcdFx0UHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0Y29uc3QgdHJhY2tlcnMgPSBjb2FsZXNjZShyZXN1bHQpO1x0Ly8gZmlsdGVyIG51bGxcblx0XHRcdFx0aWYgKHRyYWNrZXJzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IE11bHRpVHJhY2tlcih0cmFja2Vycyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0pLFxuXHRcdFx0bmV3IFByb21pc2U8dW5kZWZpbmVkPihyZXNvbHZlID0+IHNldFRpbWVvdXQoKCkgPT4gcmVzb2x2ZSh1bmRlZmluZWQpLCAxMDAwKSksXG5cdFx0XSkuY2F0Y2goZXJyID0+IHtcblx0XHRcdC8vIGlnbm9yZSBlcnJvcnNcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEFkYXB0ZXJEZXNjcmlwdG9yKGFkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeTogdnNjb2RlLkRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5IHwgdW5kZWZpbmVkLCBzZXNzaW9uOiBFeHRIb3N0RGVidWdTZXNzaW9uKTogUHJvbWlzZTx2c2NvZGUuRGVidWdBZGFwdGVyRGVzY3JpcHRvciB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Ly8gYSBcImRlYnVnU2VydmVyXCIgYXR0cmlidXRlIGluIHRoZSBsYXVuY2ggY29uZmlnIHRha2VzIHByZWNlZGVuY2Vcblx0XHRjb25zdCBzZXJ2ZXJQb3J0ID0gc2Vzc2lvbi5jb25maWd1cmF0aW9uLmRlYnVnU2VydmVyO1xuXHRcdGlmICh0eXBlb2Ygc2VydmVyUG9ydCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IERlYnVnQWRhcHRlclNlcnZlcihzZXJ2ZXJQb3J0KSk7XG5cdFx0fVxuXG5cdFx0aWYgKGFkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeSkge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uUmVnaXN0cnkgPSBhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvblJlZ2lzdHJ5KCk7XG5cdFx0XHRyZXR1cm4gYXNQcm9taXNlKCgpID0+IGFkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeS5jcmVhdGVEZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yKHNlc3Npb24uYXBpLCB0aGlzLmRhRXhlY3V0YWJsZUZyb21QYWNrYWdlKHNlc3Npb24sIGV4dGVuc2lvblJlZ2lzdHJ5KSkpLnRoZW4oZGFEZXNjcmlwdG9yID0+IHtcblx0XHRcdFx0aWYgKGRhRGVzY3JpcHRvcikge1xuXHRcdFx0XHRcdHJldHVybiBkYURlc2NyaXB0b3I7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIGZhbGxiYWNrOiB1c2UgZXhlY3V0YWJsZSBpbmZvcm1hdGlvbiBmcm9tIHBhY2thZ2UuanNvblxuXHRcdGNvbnN0IGV4dGVuc2lvblJlZ2lzdHJ5ID0gYXdhaXQgdGhpcy5fZXh0ZW5zaW9uU2VydmljZS5nZXRFeHRlbnNpb25SZWdpc3RyeSgpO1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5kYUV4ZWN1dGFibGVGcm9tUGFja2FnZShzZXNzaW9uLCBleHRlbnNpb25SZWdpc3RyeSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGRhRXhlY3V0YWJsZUZyb21QYWNrYWdlKHNlc3Npb246IEV4dEhvc3REZWJ1Z1Nlc3Npb24sIGV4dGVuc2lvblJlZ2lzdHJ5OiBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5KTogRGVidWdBZGFwdGVyRXhlY3V0YWJsZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZmlyZUJyZWFrcG9pbnRDaGFuZ2VzKGFkZGVkOiB2c2NvZGUuQnJlYWtwb2ludFtdLCByZW1vdmVkOiB2c2NvZGUuQnJlYWtwb2ludFtdLCBjaGFuZ2VkOiB2c2NvZGUuQnJlYWtwb2ludFtdKSB7XG5cdFx0aWYgKGFkZGVkLmxlbmd0aCA+IDAgfHwgcmVtb3ZlZC5sZW5ndGggPiAwIHx8IGNoYW5nZWQubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VCcmVha3BvaW50cy5maXJlKE9iamVjdC5mcmVlemUoe1xuXHRcdFx0XHRhZGRlZCxcblx0XHRcdFx0cmVtb3ZlZCxcblx0XHRcdFx0Y2hhbmdlZCxcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFNlc3Npb24oZHRvOiBJRGVidWdTZXNzaW9uRHRvKTogUHJvbWlzZTxFeHRIb3N0RGVidWdTZXNzaW9uPiB7XG5cdFx0aWYgKGR0bykge1xuXHRcdFx0aWYgKHR5cGVvZiBkdG8gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbnN0IGRzID0gdGhpcy5fZGVidWdTZXNzaW9ucy5nZXQoZHRvKTtcblx0XHRcdFx0aWYgKGRzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRzO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsZXQgZHMgPSB0aGlzLl9kZWJ1Z1Nlc3Npb25zLmdldChkdG8uaWQpO1xuXHRcdFx0XHRpZiAoIWRzKSB7XG5cdFx0XHRcdFx0Y29uc3QgZm9sZGVyID0gYXdhaXQgdGhpcy5nZXRGb2xkZXIoZHRvLmZvbGRlclVyaSk7XG5cdFx0XHRcdFx0Y29uc3QgcGFyZW50ID0gZHRvLnBhcmVudCA/IHRoaXMuX2RlYnVnU2Vzc2lvbnMuZ2V0KGR0by5wYXJlbnQpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGRzID0gbmV3IEV4dEhvc3REZWJ1Z1Nlc3Npb24odGhpcy5fZGVidWdTZXJ2aWNlUHJveHksIGR0by5pZCwgZHRvLnR5cGUsIGR0by5uYW1lLCBmb2xkZXIsIGR0by5jb25maWd1cmF0aW9uLCBwYXJlbnQ/LmFwaSk7XG5cdFx0XHRcdFx0dGhpcy5fZGVidWdTZXNzaW9ucy5zZXQoZHMuaWQsIGRzKTtcblx0XHRcdFx0XHR0aGlzLl9kZWJ1Z1NlcnZpY2VQcm94eS4kc2Vzc2lvbkNhY2hlZChkcy5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGRzO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ2Nhbm5vdCBmaW5kIHNlc3Npb24nKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Rm9sZGVyKF9mb2xkZXJVcmk6IFVyaUNvbXBvbmVudHMgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoX2ZvbGRlclVyaSkge1xuXHRcdFx0Y29uc3QgZm9sZGVyVVJJID0gVVJJLnJldml2ZShfZm9sZGVyVXJpKTtcblx0XHRcdHJldHVybiB0aGlzLl93b3Jrc3BhY2VTZXJ2aWNlLnJlc29sdmVXb3Jrc3BhY2VGb2xkZXIoZm9sZGVyVVJJKTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBleHRlbnNpb25WaXNLZXkoZXh0ZW5zaW9uSWQ6IHN0cmluZywgaWQ6IHN0cmluZykge1xuXHRcdHJldHVybiBgJHtleHRlbnNpb25JZH1cXDAke2lkfWA7XG5cdH1cblxuXHRwcml2YXRlIHNlcmlhbGl6ZVZpc3VhbGl6YXRpb24oZXh0ZW5zaW9uSWQ6IHN0cmluZywgdml6OiB2c2NvZGUuRGVidWdWaXN1YWxpemF0aW9uWyd2aXN1YWxpemF0aW9uJ10pOiBNYWluVGhyZWFkRGVidWdWaXN1YWxpemF0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXZpeikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoJ3RpdGxlJyBpbiB2aXogJiYgJ2NvbW1hbmQnIGluIHZpeikge1xuXHRcdFx0cmV0dXJuIHsgdHlwZTogRGVidWdWaXN1YWxpemF0aW9uVHlwZS5Db21tYW5kIH07XG5cdFx0fVxuXG5cdFx0aWYgKCd0cmVlSWQnIGluIHZpeikge1xuXHRcdFx0cmV0dXJuIHsgdHlwZTogRGVidWdWaXN1YWxpemF0aW9uVHlwZS5UcmVlLCBpZDogYCR7ZXh0ZW5zaW9uSWR9XFwwJHt2aXoudHJlZUlkfWAgfTtcblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIGRlYnVnIHZpc3VhbGl6YXRpb24gdHlwZScpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRJY29uUGF0aE9yQ2xhc3MoaWNvbjogdnNjb2RlLkRlYnVnVmlzdWFsaXphdGlvblsnaWNvblBhdGgnXSkge1xuXHRcdGNvbnN0IGljb25QYXRoT3JJY29uQ2xhc3MgPSB0aGlzLmdldEljb25VcmlzKGljb24pO1xuXHRcdGxldCBpY29uUGF0aDogeyBkYXJrOiBVUkk7IGxpZ2h0PzogVVJJIHwgdW5kZWZpbmVkIH0gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGljb25DbGFzczogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmICgnaWQnIGluIGljb25QYXRoT3JJY29uQ2xhc3MpIHtcblx0XHRcdGljb25DbGFzcyA9IFRoZW1lSWNvblV0aWxzLmFzQ2xhc3NOYW1lKGljb25QYXRoT3JJY29uQ2xhc3MpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpY29uUGF0aCA9IGljb25QYXRoT3JJY29uQ2xhc3M7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGljb25QYXRoLFxuXHRcdFx0aWNvbkNsYXNzXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SWNvblVyaXMoaWNvblBhdGg6IHZzY29kZS5EZWJ1Z1Zpc3VhbGl6YXRpb25bJ2ljb25QYXRoJ10pOiB7IGRhcms6IFVSSTsgbGlnaHQ/OiBVUkkgfSB8IHsgaWQ6IHN0cmluZyB9IHtcblx0XHRpZiAoaWNvblBhdGggaW5zdGFuY2VvZiBUaGVtZUljb24pIHtcblx0XHRcdHJldHVybiB7IGlkOiBpY29uUGF0aC5pZCB9O1xuXHRcdH1cblx0XHRjb25zdCBkYXJrID0gdHlwZW9mIGljb25QYXRoID09PSAnb2JqZWN0JyAmJiAnZGFyaycgaW4gaWNvblBhdGggPyBpY29uUGF0aC5kYXJrIDogaWNvblBhdGg7XG5cdFx0Y29uc3QgbGlnaHQgPSB0eXBlb2YgaWNvblBhdGggPT09ICdvYmplY3QnICYmICdsaWdodCcgaW4gaWNvblBhdGggPyBpY29uUGF0aC5saWdodCA6IGljb25QYXRoO1xuXHRcdHJldHVybiB7XG5cdFx0XHRkYXJrOiAodHlwZW9mIGRhcmsgPT09ICdzdHJpbmcnID8gVVJJLmZpbGUoZGFyaykgOiBkYXJrKSBhcyBVUkksXG5cdFx0XHRsaWdodDogKHR5cGVvZiBsaWdodCA9PT0gJ3N0cmluZycgPyBVUkkuZmlsZShsaWdodCkgOiBsaWdodCkgYXMgVVJJLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dEhvc3REZWJ1Z1Nlc3Npb24ge1xuXHRwcml2YXRlIGFwaVNlc3Npb24/OiB2c2NvZGUuRGVidWdTZXNzaW9uO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9kZWJ1Z1NlcnZpY2VQcm94eTogTWFpblRocmVhZERlYnVnU2VydmljZVNoYXBlLFxuXHRcdHByaXZhdGUgX2lkOiBEZWJ1Z1Nlc3Npb25VVUlELFxuXHRcdHByaXZhdGUgX3R5cGU6IHN0cmluZyxcblx0XHRwcml2YXRlIF9uYW1lOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfd29ya3NwYWNlRm9sZGVyOiB2c2NvZGUuV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgX2NvbmZpZ3VyYXRpb246IHZzY29kZS5EZWJ1Z0NvbmZpZ3VyYXRpb24sXG5cdFx0cHJpdmF0ZSBfcGFyZW50U2Vzc2lvbjogdnNjb2RlLkRlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCkge1xuXHR9XG5cblx0cHVibGljIGdldCBhcGkoKTogdnNjb2RlLkRlYnVnU2Vzc2lvbiB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0cmV0dXJuIHRoaXMuYXBpU2Vzc2lvbiA/Pz0gT2JqZWN0LmZyZWV6ZSh7XG5cdFx0XHRpZDogdGhhdC5faWQsXG5cdFx0XHR0eXBlOiB0aGF0Ll90eXBlLFxuXHRcdFx0Z2V0IG5hbWUoKSB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9uYW1lO1xuXHRcdFx0fSxcblx0XHRcdHNldCBuYW1lKG5hbWU6IHN0cmluZykge1xuXHRcdFx0XHR0aGF0Ll9uYW1lID0gbmFtZTtcblx0XHRcdFx0dGhhdC5fZGVidWdTZXJ2aWNlUHJveHkuJHNldERlYnVnU2Vzc2lvbk5hbWUodGhhdC5faWQsIG5hbWUpO1xuXHRcdFx0fSxcblx0XHRcdHBhcmVudFNlc3Npb246IHRoYXQuX3BhcmVudFNlc3Npb24sXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXI6IHRoYXQuX3dvcmtzcGFjZUZvbGRlcixcblx0XHRcdGNvbmZpZ3VyYXRpb246IHRoYXQuX2NvbmZpZ3VyYXRpb24sXG5cdFx0XHRjdXN0b21SZXF1ZXN0KGNvbW1hbmQ6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX2RlYnVnU2VydmljZVByb3h5LiRjdXN0b21EZWJ1Z0FkYXB0ZXJSZXF1ZXN0KHRoYXQuX2lkLCBjb21tYW5kLCBhcmdzKTtcblx0XHRcdH0sXG5cdFx0XHRnZXREZWJ1Z1Byb3RvY29sQnJlYWtwb2ludChicmVha3BvaW50OiB2c2NvZGUuQnJlYWtwb2ludCk6IFByb21pc2U8dnNjb2RlLkRlYnVnUHJvdG9jb2xCcmVha3BvaW50IHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9kZWJ1Z1NlcnZpY2VQcm94eS4kZ2V0RGVidWdQcm90b2NvbEJyZWFrcG9pbnQodGhhdC5faWQsIGJyZWFrcG9pbnQuaWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldCBpZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9pZDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdHlwZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl90eXBlO1xuXHR9XG5cblx0X2FjY2VwdE5hbWVDaGFuZ2VkKG5hbWU6IHN0cmluZykge1xuXHRcdHRoaXMuX25hbWUgPSBuYW1lO1xuXHR9XG5cblx0cHVibGljIGdldCBjb25maWd1cmF0aW9uKCk6IHZzY29kZS5EZWJ1Z0NvbmZpZ3VyYXRpb24ge1xuXHRcdHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRIb3N0RGVidWdDb25zb2xlIHtcblxuXHRyZWFkb25seSB2YWx1ZTogdnNjb2RlLkRlYnVnQ29uc29sZTtcblxuXHRjb25zdHJ1Y3Rvcihwcm94eTogTWFpblRocmVhZERlYnVnU2VydmljZVNoYXBlKSB7XG5cblx0XHR0aGlzLnZhbHVlID0gT2JqZWN0LmZyZWV6ZSh7XG5cdFx0XHRhcHBlbmQodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0XHRwcm94eS4kYXBwZW5kRGVidWdDb25zb2xlKHZhbHVlKTtcblx0XHRcdH0sXG5cdFx0XHRhcHBlbmRMaW5lKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdFx0dGhpcy5hcHBlbmQodmFsdWUgKyAnXFxuJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIENvbmZpZ1Byb3ZpZGVyVHVwbGUge1xuXHR0eXBlOiBzdHJpbmc7XG5cdGhhbmRsZTogbnVtYmVyO1xuXHRwcm92aWRlcjogdnNjb2RlLkRlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyO1xufVxuXG5pbnRlcmZhY2UgRGVzY3JpcHRvckZhY3RvcnlUdXBsZSB7XG5cdHR5cGU6IHN0cmluZztcblx0aGFuZGxlOiBudW1iZXI7XG5cdGZhY3Rvcnk6IHZzY29kZS5EZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeTtcbn1cblxuaW50ZXJmYWNlIFRyYWNrZXJGYWN0b3J5VHVwbGUge1xuXHR0eXBlOiBzdHJpbmc7XG5cdGhhbmRsZTogbnVtYmVyO1xuXHRmYWN0b3J5OiB2c2NvZGUuRGVidWdBZGFwdGVyVHJhY2tlckZhY3Rvcnk7XG59XG5cbmNsYXNzIE11bHRpVHJhY2tlciBpbXBsZW1lbnRzIHZzY29kZS5EZWJ1Z0FkYXB0ZXJUcmFja2VyIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHRyYWNrZXJzOiB2c2NvZGUuRGVidWdBZGFwdGVyVHJhY2tlcltdKSB7XG5cdH1cblxuXHRvbldpbGxTdGFydFNlc3Npb24oKTogdm9pZCB7XG5cdFx0dGhpcy50cmFja2Vycy5mb3JFYWNoKHQgPT4gdC5vbldpbGxTdGFydFNlc3Npb24gPyB0Lm9uV2lsbFN0YXJ0U2Vzc2lvbigpIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdG9uV2lsbFJlY2VpdmVNZXNzYWdlKG1lc3NhZ2U6IGFueSk6IHZvaWQge1xuXHRcdHRoaXMudHJhY2tlcnMuZm9yRWFjaCh0ID0+IHQub25XaWxsUmVjZWl2ZU1lc3NhZ2UgPyB0Lm9uV2lsbFJlY2VpdmVNZXNzYWdlKG1lc3NhZ2UpIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdG9uRGlkU2VuZE1lc3NhZ2UobWVzc2FnZTogYW55KTogdm9pZCB7XG5cdFx0dGhpcy50cmFja2Vycy5mb3JFYWNoKHQgPT4gdC5vbkRpZFNlbmRNZXNzYWdlID8gdC5vbkRpZFNlbmRNZXNzYWdlKG1lc3NhZ2UpIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdG9uV2lsbFN0b3BTZXNzaW9uKCk6IHZvaWQge1xuXHRcdHRoaXMudHJhY2tlcnMuZm9yRWFjaCh0ID0+IHQub25XaWxsU3RvcFNlc3Npb24gPyB0Lm9uV2lsbFN0b3BTZXNzaW9uKCkgOiB1bmRlZmluZWQpO1xuXHR9XG5cblx0b25FcnJvcihlcnJvcjogRXJyb3IpOiB2b2lkIHtcblx0XHR0aGlzLnRyYWNrZXJzLmZvckVhY2godCA9PiB0Lm9uRXJyb3IgPyB0Lm9uRXJyb3IoZXJyb3IpIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdG9uRXhpdChjb2RlOiBudW1iZXIsIHNpZ25hbDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy50cmFja2Vycy5mb3JFYWNoKHQgPT4gdC5vbkV4aXQgPyB0Lm9uRXhpdChjb2RlLCBzaWduYWwpIDogdW5kZWZpbmVkKTtcblx0fVxufVxuXG4vKlxuICogQ2FsbCBkaXJlY3RseSBpbnRvIGEgZGVidWcgYWRhcHRlciBpbXBsZW1lbnRhdGlvblxuICovXG5jbGFzcyBEaXJlY3REZWJ1Z0FkYXB0ZXIgZXh0ZW5kcyBBYnN0cmFjdERlYnVnQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBpbXBsZW1lbnRhdGlvbjogdnNjb2RlLkRlYnVnQWRhcHRlcikge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpbXBsZW1lbnRhdGlvbi5vbkRpZFNlbmRNZXNzYWdlKChtZXNzYWdlOiB2c2NvZGUuRGVidWdQcm90b2NvbE1lc3NhZ2UpID0+IHtcblx0XHRcdHRoaXMuYWNjZXB0TWVzc2FnZShtZXNzYWdlIGFzIERlYnVnUHJvdG9jb2wuUHJvdG9jb2xNZXNzYWdlKTtcblx0XHR9KTtcblx0fVxuXG5cdHN0YXJ0U2Vzc2lvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRzZW5kTWVzc2FnZShtZXNzYWdlOiBEZWJ1Z1Byb3RvY29sLlByb3RvY29sTWVzc2FnZSk6IHZvaWQge1xuXHRcdHRoaXMuaW1wbGVtZW50YXRpb24uaGFuZGxlTWVzc2FnZShtZXNzYWdlKTtcblx0fVxuXG5cdHN0b3BTZXNzaW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuaW1wbGVtZW50YXRpb24uZGlzcG9zZSgpO1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBXb3JrZXJFeHRIb3N0RGVidWdTZXJ2aWNlIGV4dGVuZHMgRXh0SG9zdERlYnVnU2VydmljZUJhc2Uge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dEhvc3RScGNTZXJ2aWNlIGV4dEhvc3RScGNTZXJ2aWNlOiBJRXh0SG9zdFJwY1NlcnZpY2UsXG5cdFx0QElFeHRIb3N0V29ya3NwYWNlIHdvcmtzcGFjZVNlcnZpY2U6IElFeHRIb3N0V29ya3NwYWNlLFxuXHRcdEBJRXh0SG9zdEV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dEhvc3RFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdENvbmZpZ3VyYXRpb24gY29uZmlndXJhdGlvblNlcnZpY2U6IElFeHRIb3N0Q29uZmlndXJhdGlvbixcblx0XHRASUV4dEhvc3RFZGl0b3JUYWJzIGVkaXRvclRhYnM6IElFeHRIb3N0RWRpdG9yVGFicyxcblx0XHRASUV4dEhvc3RWYXJpYWJsZVJlc29sdmVyUHJvdmlkZXIgdmFyaWFibGVSZXNvbHZlcjogSUV4dEhvc3RWYXJpYWJsZVJlc29sdmVyUHJvdmlkZXIsXG5cdFx0QElFeHRIb3N0Q29tbWFuZHMgY29tbWFuZHM6IElFeHRIb3N0Q29tbWFuZHMsXG5cdFx0QElFeHRIb3N0VGVzdGluZyB0ZXN0aW5nOiBJRXh0SG9zdFRlc3RpbmcsXG5cdCkge1xuXHRcdHN1cGVyKGV4dEhvc3RScGNTZXJ2aWNlLCB3b3Jrc3BhY2VTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgZWRpdG9yVGFicywgdmFyaWFibGVSZXNvbHZlciwgY29tbWFuZHMsIHRlc3RpbmcpO1xuXHR9XG59XG5cbi8vIENvbGxlY3RpbmcgaW5mbyBmb3IgIzIzMzE2NyBzcGVjaWZpY2FsbHlcbnR5cGUgRGVidWdQcm90b2NvbE1lc3NhZ2VFcnJvckNsYXNzaWZpY2F0aW9uID0ge1xuXHRmcm9tOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHR5cGUgb2YgdGhlIGRlYnVnIGFkYXB0ZXIgdGhhdCB0aGUgZXZlbnQgaXMgZnJvbS4nIH07XG5cdHR5cGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdHlwZSBvZiB0aGUgZXZlbnQgdGhhdCB3YXMgbWFsZm9ybWVkLicgfTtcblx0b3duZXI6ICdyb2Jsb3VyZW5zJztcblx0Y29tbWVudDogJ1NlbnQgdG8gY29sbGVjdCBkZXRhaWxzIGFib3V0IG1pc2JlaGF2aW5nIGRlYnVnIGV4dGVuc2lvbnMuJztcbn07XG5cbnR5cGUgRGVidWdQcm90b2NvbE1lc3NhZ2VFcnJvckV2ZW50ID0ge1xuXHRmcm9tOiBzdHJpbmc7XG5cdHR5cGU6IHN0cmluZztcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxjQUFjLGVBQWUsb0JBQW9C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O0FBQUEsRUFDckY7QUFBQSxFQUVBLHFCQUFxQixTQUFvQjtBQUN4QyxTQUFLLFNBQVMsUUFBUSxPQUFLLEVBQUUsdUJBQXVCLEVBQUUscUJBQXFCLE9BQU8sSUFBSSxNQUFTO0FBQUEsRUFDaEc7QUFBQSxFQUVBLGlCQUFpQixTQUFvQjtBQUNwQyxTQUFLLFNBQVMsUUFBUSxPQUFLLEVBQUUsbUJBQW1CLEVBQUUsaUJBQWlCLE9BQU8sSUFBSSxNQUFTO0FBQUEsRUFDeEY7QUFBQSxFQUVBLG9CQUEwQjtBQUN6QixTQUFLLFNBQVMsUUFBUSxPQUFLLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLElBQUksTUFBUztBQUFBLEVBQ25GO0FBQUEsRUFFQSxRQUFRLE9BQW9CO0FBQzNCLFNBQUssU0FBUyxRQUFRLE9BQUssRUFBRSxVQUFVLEVBQUUsUUFBUSxLQUFLLElBQUksTUFBUztBQUFBLEVBQ3BFO0FBQUEsRUFFQSxPQUFPLE1BQWMsUUFBc0I7QUFDMUMsU0FBSyxTQUFTLFFBQVEsT0FBSyxFQUFFLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSxJQUFJLE1BQVM7QUFBQSxFQUN6RTtBQUNEO0FBS0EsTUFBTSwyQkFBMkIscUJBQXFCO0FBQUEsRUFFckQsWUFBb0IsZ0JBQXFDO0FBQ3hELFVBQU07QUFEYTtBQUduQixtQkFBZSxpQkFBaUIsQ0FBQyxZQUF5QztBQUN6RSxXQUFLLGNBQWMsT0FBd0M7QUFBQSxJQUM1RCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsZUFBOEI7QUFDN0IsV0FBTyxRQUFRLFFBQVEsTUFBUztBQUFBLEVBQ2pDO0FBQUEsRUFFQSxZQUFZLFNBQThDO0FBQ3pELFNBQUssZUFBZSxjQUFjLE9BQU87QUFBQSxFQUMxQztBQUFBLEVBRUEsY0FBNkI7QUFDNUIsU0FBSyxlQUFlLFFBQVE7QUFDNUIsV0FBTyxRQUFRLFFBQVEsTUFBUztBQUFBLEVBQ2pDO0FBQ0Q7QUFHTyxJQUFNLDRCQUFOLGNBQXdDLHdCQUF3QjtBQUFBLEVBQ3RFLFlBQ3FCLG1CQUNELGtCQUNPLGtCQUNILHNCQUNILFlBQ2Msa0JBQ2hCLFVBQ0QsU0FDaEI7QUFDRCxVQUFNLG1CQUFtQixrQkFBa0Isa0JBQWtCLHNCQUFzQixZQUFZLGtCQUFrQixVQUFVLE9BQU87QUFBQSxFQUNuSTtBQUNEO0FBYmEsNEJBQU47QUFBQSxFQUVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBVFU7IiwKICAibmFtZXMiOiBbImlkIiwgImV4dGVuc2lvblJlZ2lzdHJ5Il0KfQo=
