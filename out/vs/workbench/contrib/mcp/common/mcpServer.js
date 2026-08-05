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
import { raceCancellationError, Sequencer } from "../../../../base/common/async.js";
import * as json from "../../../../base/common/json.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../base/common/map.js";
import { autorun, autorunWithStore, derived, disposableObservableValue, observableFromEvent, ObservablePromise, observableValue, transaction } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { mcpActivationEvent } from "./mcpConfiguration.js";
import { IMcpRegistry } from "./mcpRegistryTypes.js";
import { extensionMcpCollectionPrefix, McpConnectionFailedError, McpConnectionState, McpServerToolsState } from "./mcpTypes.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
const toolInvalidCharRe = /[^a-z0-9_-]/gi;
let McpServerMetadataCache = class extends Disposable {
  constructor(scope, storageService) {
    super();
    this.didChange = false;
    this.cache = new LRUCache(128);
    this.extensionServers = /* @__PURE__ */ new Map();
    const storageKey = "mcpToolCache";
    this._register(storageService.onWillSaveState(() => {
      if (this.didChange) {
        storageService.store(storageKey, {
          extensionServers: [...this.extensionServers],
          serverTools: this.cache.toJSON()
        }, scope, StorageTarget.MACHINE);
        this.didChange = false;
      }
    }));
    try {
      const cached = storageService.getObject(storageKey, scope);
      this.extensionServers = new Map(cached?.extensionServers ?? []);
      cached?.serverTools?.forEach(([k, v]) => this.cache.set(k, v));
    } catch {
    }
  }
  /** Resets the cache for tools and extension servers */
  reset() {
    this.cache.clear();
    this.extensionServers.clear();
    this.didChange = true;
  }
  /** Gets cached tools for a server (used before a server is running) */
  getTools(definitionId) {
    return this.cache.get(definitionId)?.tools;
  }
  /** Sets cached tools for a server */
  storeTools(definitionId, tools) {
    this.cache.set(definitionId, { ...this.cache.get(definitionId), tools });
    this.didChange = true;
  }
  /** Gets cached servers for a collection (used for extensions, before the extension activates) */
  getServers(collectionId) {
    return this.extensionServers.get(collectionId);
  }
  /** Sets cached servers for a collection */
  storeServers(collectionId, entry) {
    if (entry) {
      this.extensionServers.set(collectionId, entry);
    } else {
      this.extensionServers.delete(collectionId);
    }
    this.didChange = true;
  }
};
McpServerMetadataCache = __decorateClass([
  __decorateParam(1, IStorageService)
], McpServerMetadataCache);
let McpServer = class extends Disposable {
  constructor(collection, definition, explicitRoots, _requiresExtensionActivation, _toolCache, _mcpRegistry, workspacesService, _extensionService, _loggerService, _outputService, _telemetryService, _commandService, _instantiationService) {
    super();
    this.collection = collection;
    this.definition = definition;
    this._requiresExtensionActivation = _requiresExtensionActivation;
    this._toolCache = _toolCache;
    this._mcpRegistry = _mcpRegistry;
    this._extensionService = _extensionService;
    this._loggerService = _loggerService;
    this._outputService = _outputService;
    this._telemetryService = _telemetryService;
    this._commandService = _commandService;
    this._instantiationService = _instantiationService;
    this._connectionSequencer = new Sequencer();
    this._connection = this._register(disposableObservableValue(this, void 0));
    this.connection = this._connection;
    this.connectionState = derived((reader) => this._connection.read(reader)?.state.read(reader) ?? { state: McpConnectionState.Kind.Stopped });
    this.toolsFromServerPromise = observableValue(this, void 0);
    this.toolsFromServer = derived((reader) => this.toolsFromServerPromise.read(reader)?.promiseResult.read(reader)?.data);
    this.toolsState = derived((reader) => {
      const fromServer = this.toolsFromServerPromise.read(reader);
      const connectionState = this.connectionState.read(reader);
      const isIdle = McpConnectionState.canBeStarted(connectionState.state) && !fromServer;
      if (isIdle) {
        return this.toolsFromCache ? McpServerToolsState.Cached : McpServerToolsState.Unknown;
      }
      const fromServerResult = fromServer?.promiseResult.read(reader);
      if (!fromServerResult) {
        return this.toolsFromCache ? McpServerToolsState.RefreshingFromCached : McpServerToolsState.RefreshingFromUnknown;
      }
      return fromServerResult.error ? this.toolsFromCache ? McpServerToolsState.Cached : McpServerToolsState.Unknown : McpServerToolsState.Live;
    });
    this._loggerId = `mcpServer.${definition.id}`;
    this._logger = this._register(_loggerService.createLogger(this._loggerId, { hidden: true, name: `MCP: ${definition.label}` }));
    this._register(toDisposable(() => _loggerService.deregisterLogger(this._loggerId)));
    const workspaces = explicitRoots ? observableValue(this, explicitRoots.map((uri) => ({ uri, name: basename(uri) }))) : observableFromEvent(
      this,
      workspacesService.onDidChangeWorkspaceFolders,
      () => workspacesService.getWorkspace().folders
    );
    this._register(autorunWithStore((reader) => {
      const cnx = this._connection.read(reader)?.handler.read(reader);
      if (!cnx) {
        return;
      }
      cnx.roots = workspaces.read(reader).map((wf) => ({
        uri: wf.uri.toString(),
        name: wf.name
      }));
    }));
    this._register(autorunWithStore((reader, store) => {
      const cnx = this._connection.read(reader)?.handler.read(reader);
      if (cnx) {
        this.populateLiveData(cnx, store);
      } else {
        this.resetLiveData();
      }
    }));
    this._register(autorun((reader) => {
      const tools = this.toolsFromServer.read(reader);
      if (tools) {
        this._toolCache.storeTools(definition.id, tools);
      }
    }));
    const toolPrefix = this._mcpRegistry.collectionToolPrefix(this.collection);
    this.tools = derived((reader) => {
      const serverTools = this.toolsFromServer.read(reader);
      const definitions = serverTools ?? this.toolsFromCache ?? [];
      const prefix = toolPrefix.read(reader);
      return definitions.map((def) => new McpTool(this, prefix, def));
    });
  }
  get toolsFromCache() {
    return this._toolCache.getTools(this.definition.id);
  }
  get trusted() {
    return this._mcpRegistry.getTrust(this.collection);
  }
  showOutput() {
    this._loggerService.setVisibility(this._loggerId, true);
    this._outputService.showChannel(this._loggerId);
  }
  start(isFromInteraction) {
    return this._connectionSequencer.queue(async () => {
      const activationEvent = mcpActivationEvent(this.collection.id.slice(extensionMcpCollectionPrefix.length));
      if (this._requiresExtensionActivation && !this._extensionService.activationEventIsDone(activationEvent)) {
        await this._extensionService.activateByEvent(activationEvent);
        await Promise.all(this._mcpRegistry.delegates.map((r) => r.waitForInitialProviderPromises()));
        if (this._store.isDisposed) {
          return { state: McpConnectionState.Kind.Stopped };
        }
      }
      let connection = this._connection.get();
      if (connection && McpConnectionState.canBeStarted(connection.state.get().state)) {
        connection.dispose();
        connection = void 0;
        this._connection.set(connection, void 0);
      }
      if (!connection) {
        connection = await this._mcpRegistry.resolveConnection({
          logger: this._logger,
          collectionRef: this.collection,
          definitionRef: this.definition,
          forceTrust: isFromInteraction
        });
        if (!connection) {
          return { state: McpConnectionState.Kind.Stopped };
        }
        if (this._store.isDisposed) {
          connection.dispose();
          return { state: McpConnectionState.Kind.Stopped };
        }
        this._connection.set(connection, void 0);
      }
      const start = Date.now();
      const state = await connection.start();
      this._telemetryService.publicLog2("mcp/serverBootState", {
        state: McpConnectionState.toKindString(state.state),
        time: Date.now() - start
      });
      return state;
    });
  }
  stop() {
    return this._connection.get()?.stop() || Promise.resolve();
  }
  resetLiveData() {
    transaction((tx) => {
      this.toolsFromServerPromise.set(void 0, tx);
    });
  }
  async _normalizeTool(originalTool) {
    const tool = { ...originalTool, serverToolName: originalTool.name };
    if (!tool.description) {
      this._logger.warn(`Tool ${tool.name} does not have a description. Tools must be accurately described to be called`);
      tool.description = "<empty>";
    }
    if (toolInvalidCharRe.test(tool.name)) {
      this._logger.warn(`Tool ${JSON.stringify(tool.name)} is invalid. Tools names may only contain [a-z0-9_-]`);
      tool.name = tool.name.replace(toolInvalidCharRe, "_");
    }
    let diagnostics = [];
    const toolJson = JSON.stringify(tool.inputSchema);
    try {
      const schemaUri = URI.parse("https://json-schema.org/draft-07/schema");
      diagnostics = await this._commandService.executeCommand("json.validate", schemaUri, toolJson) || [];
    } catch (e) {
    }
    if (!diagnostics.length) {
      return tool;
    }
    const tree = json.parseTree(toolJson);
    const messages = diagnostics.map((d) => {
      const node = json.findNodeAtOffset(tree, d.range[0].character);
      const path = node && `/${json.getNodePath(node).join("/")}`;
      return d.message + (path ? ` (at ${path})` : "");
    });
    return { error: messages };
  }
  async _getValidatedTools(handler, tools) {
    let error = "";
    const validations = await Promise.all(tools.map((t) => this._normalizeTool(t)));
    const validated = [];
    for (const [i, result] of validations.entries()) {
      if ("error" in result) {
        error += localize("mcpBadSchema.tool", "Tool `{0}` has invalid JSON parameters:", tools[i].name) + "\n";
        for (const message of result.error) {
          error += `	- ${message}
`;
        }
        error += `	- Schema: ${JSON.stringify(tools[i].inputSchema)}

`;
      } else {
        validated.push(result);
      }
    }
    if (error) {
      handler.logger.warn(`${tools.length - validated.length} tools have invalid JSON schemas and will be omitted`);
      warnInvalidTools(this._instantiationService, this.definition.label, error);
    }
    return validated;
  }
  populateLiveData(handler, store) {
    const cts = new CancellationTokenSource();
    store.add(toDisposable(() => cts.dispose(true)));
    const updateTools = (tx) => {
      const toolPromise = handler.capabilities.tools ? handler.listTools({}, cts.token) : Promise.resolve([]);
      const toolPromiseSafe = toolPromise.then(async (tools) => {
        handler.logger.info(`Discovered ${tools.length} tools`);
        return this._getValidatedTools(handler, tools);
      });
      this.toolsFromServerPromise.set(new ObservablePromise(toolPromiseSafe), tx);
      return [toolPromise];
    };
    store.add(handler.onDidChangeToolList(() => {
      handler.logger.info("Tool list changed, refreshing tools...");
      updateTools(void 0);
    }));
    let promises;
    transaction((tx) => {
      promises = updateTools(tx);
    });
    Promise.all(promises).then(([tools]) => {
      this._telemetryService.publicLog2("mcp/serverBoot", {
        supportsLogging: !!handler.capabilities.logging,
        supportsPrompts: !!handler.capabilities.prompts,
        supportsResources: !!handler.capabilities.resources,
        toolCount: tools.length
      });
    });
  }
  /**
   * Helper function to call the function on the handler once it's online. The
   * connection started if it is not already.
   */
  async callOn(fn, token = CancellationToken.None) {
    await this.start();
    let ranOnce = false;
    let d;
    const callPromise = new Promise((resolve, reject) => {
      d = autorun((reader) => {
        const connection = this._connection.read(reader);
        if (!connection || ranOnce) {
          return;
        }
        const handler = connection.handler.read(reader);
        if (!handler) {
          const state = connection.state.read(reader);
          if (state.state === McpConnectionState.Kind.Error) {
            reject(new McpConnectionFailedError(`MCP server could not be started: ${state.message}`));
            return;
          } else if (state.state === McpConnectionState.Kind.Stopped) {
            reject(new McpConnectionFailedError("MCP server has stopped"));
            return;
          } else {
            return;
          }
        }
        resolve(fn(handler));
        ranOnce = true;
      });
    });
    return raceCancellationError(callPromise, token).finally(() => d.dispose());
  }
};
McpServer = __decorateClass([
  __decorateParam(5, IMcpRegistry),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, ILoggerService),
  __decorateParam(9, IOutputService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, ICommandService),
  __decorateParam(12, IInstantiationService)
], McpServer);
class McpTool {
  constructor(_server, idPrefix, _definition) {
    this._server = _server;
    this._definition = _definition;
    this.id = (idPrefix + _definition.name).replaceAll(".", "_");
  }
  get definition() {
    return this._definition;
  }
  call(params, token) {
    const name = this._definition.serverToolName ?? this._definition.name;
    return this._server.callOn((h) => h.callTool({ name, arguments: params }), token);
  }
}
function warnInvalidTools(instaService, serverName, errorText) {
  instaService.invokeFunction((accessor) => {
    const notificationService = accessor.get(INotificationService);
    const editorService = accessor.get(IEditorService);
    notificationService.notify({
      severity: Severity.Warning,
      message: localize("mcpBadSchema", "MCP server `{0}` has tools with invalid parameters which will be omitted.", serverName),
      actions: {
        primary: [{
          class: void 0,
          enabled: true,
          id: "mcpBadSchema.show",
          tooltip: "",
          label: localize("mcpBadSchema.show", "Show"),
          run: () => {
            editorService.openEditor({
              resource: void 0,
              contents: errorText
            });
          }
        }]
      }
    });
  });
}
export {
  McpServer,
  McpServerMetadataCache,
  McpTool
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcFNlcnZlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHJhY2VDYW5jZWxsYXRpb25FcnJvciwgU2VxdWVuY2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0ICogYXMganNvbiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTFJVQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgZGlzcG9zYWJsZU9ic2VydmFibGVWYWx1ZSwgSU9ic2VydmFibGUsIElUcmFuc2FjdGlvbiwgb2JzZXJ2YWJsZUZyb21FdmVudCwgT2JzZXJ2YWJsZVByb21pc2UsIG9ic2VydmFibGVWYWx1ZSwgdHJhbnNhY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUxvZ2dlciwgSUxvZ2dlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSU91dHB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9vdXRwdXQvY29tbW9uL291dHB1dC5qcyc7XG5pbXBvcnQgeyBtY3BBY3RpdmF0aW9uRXZlbnQgfSBmcm9tICcuL21jcENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSU1jcFJlZ2lzdHJ5IH0gZnJvbSAnLi9tY3BSZWdpc3RyeVR5cGVzLmpzJztcbmltcG9ydCB7IE1jcFNlcnZlclJlcXVlc3RIYW5kbGVyIH0gZnJvbSAnLi9tY3BTZXJ2ZXJSZXF1ZXN0SGFuZGxlci5qcyc7XG5pbXBvcnQgeyBleHRlbnNpb25NY3BDb2xsZWN0aW9uUHJlZml4LCBJTWNwU2VydmVyLCBJTWNwU2VydmVyQ29ubmVjdGlvbiwgSU1jcFRvb2wsIE1jcENvbGxlY3Rpb25SZWZlcmVuY2UsIE1jcENvbm5lY3Rpb25GYWlsZWRFcnJvciwgTWNwQ29ubmVjdGlvblN0YXRlLCBNY3BEZWZpbml0aW9uUmVmZXJlbmNlLCBNY3BTZXJ2ZXJEZWZpbml0aW9uLCBNY3BTZXJ2ZXJUb29sc1N0YXRlIH0gZnJvbSAnLi9tY3BUeXBlcy5qcyc7XG5pbXBvcnQgeyBNQ1AgfSBmcm9tICcuL21vZGVsQ29udGV4dFByb3RvY29sLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuXG50eXBlIFNlcnZlckJvb3REYXRhID0ge1xuXHRzdXBwb3J0c0xvZ2dpbmc6IGJvb2xlYW47XG5cdHN1cHBvcnRzUHJvbXB0czogYm9vbGVhbjtcblx0c3VwcG9ydHNSZXNvdXJjZXM6IGJvb2xlYW47XG5cdHRvb2xDb3VudDogbnVtYmVyO1xufTtcbnR5cGUgU2VydmVyQm9vdENsYXNzaWZpY2F0aW9uID0ge1xuXHRvd25lcjogJ2Nvbm5vcjQzMTInO1xuXHRjb21tZW50OiAnRGV0YWlscyB0aGUgY2FwYWJpbGl0aWVzIG9mIHRoZSBNQ1Agc2VydmVyJztcblx0c3VwcG9ydHNMb2dnaW5nOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgc2VydmVyIHN1cHBvcnRzIGxvZ2dpbmcnIH07XG5cdHN1cHBvcnRzUHJvbXB0czogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIHNlcnZlciBzdXBwb3J0cyBwcm9tcHRzJyB9O1xuXHRzdXBwb3J0c1Jlc291cmNlczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIHNlcnZlciBzdXBwb3J0cyByZXNvdXJjZScgfTtcblx0dG9vbENvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIG51bWJlciBvZiB0b29scyB0aGUgc2VydmVyIGFkdmVydGlzZXMnIH07XG59O1xuXG50eXBlIFNlcnZlckJvb3RTdGF0ZSA9IHtcblx0c3RhdGU6IHN0cmluZztcblx0dGltZTogbnVtYmVyO1xufTtcbnR5cGUgU2VydmVyQm9vdFN0YXRlQ2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnY29ubm9yNDMxMic7XG5cdGNvbW1lbnQ6ICdEZXRhaWxzIHRoZSBjYXBhYmlsaXRpZXMgb2YgdGhlIE1DUCBzZXJ2ZXInO1xuXHRzdGF0ZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBzZXJ2ZXIgb3V0Y29tZScgfTtcblx0dGltZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0R1cmF0aW9uIGluIG1pbGxpc2Vjb25kcyB0byByZWFjaCB0aGF0IHN0YXRlJyB9O1xufTtcblxuaW50ZXJmYWNlIElUb29sQ2FjaGVFbnRyeSB7XG5cdC8qKiBDYWNoZWQgdG9vbHMgc28gd2UgY2FuIHNob3cgd2hhdCdzIGF2YWlsYWJsZSBiZWZvcmUgaXQncyBzdGFydGVkICovXG5cdHJlYWRvbmx5IHRvb2xzOiByZWFkb25seSBJVmFsaWRhdGVkTWNwVG9vbFtdO1xufVxuXG5pbnRlcmZhY2UgSVNlcnZlckNhY2hlRW50cnkge1xuXHRyZWFkb25seSBzZXJ2ZXJzOiByZWFkb25seSBNY3BTZXJ2ZXJEZWZpbml0aW9uLlNlcmlhbGl6ZWRbXTtcbn1cblxuY29uc3QgdG9vbEludmFsaWRDaGFyUmUgPSAvW15hLXowLTlfLV0vZ2k7XG5cbmV4cG9ydCBjbGFzcyBNY3BTZXJ2ZXJNZXRhZGF0YUNhY2hlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgZGlkQ2hhbmdlID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgY2FjaGUgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBJVG9vbENhY2hlRW50cnk+KDEyOCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmVycyA9IG5ldyBNYXA8LyogY29sbGVjdGlvbiBJRCAqL3N0cmluZywgSVNlcnZlckNhY2hlRW50cnk+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0c2NvcGU6IFN0b3JhZ2VTY29wZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0eXBlIFN0b3JlZFR5cGUgPSB7XG5cdFx0XHRleHRlbnNpb25TZXJ2ZXJzOiBbc3RyaW5nLCBJU2VydmVyQ2FjaGVFbnRyeV1bXTtcblx0XHRcdHNlcnZlclRvb2xzOiBbc3RyaW5nLCBJVG9vbENhY2hlRW50cnldW107XG5cdFx0fTtcblxuXHRcdGNvbnN0IHN0b3JhZ2VLZXkgPSAnbWNwVG9vbENhY2hlJztcblx0XHR0aGlzLl9yZWdpc3RlcihzdG9yYWdlU2VydmljZS5vbldpbGxTYXZlU3RhdGUoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZGlkQ2hhbmdlKSB7XG5cdFx0XHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKHN0b3JhZ2VLZXksIHtcblx0XHRcdFx0XHRleHRlbnNpb25TZXJ2ZXJzOiBbLi4udGhpcy5leHRlbnNpb25TZXJ2ZXJzXSxcblx0XHRcdFx0XHRzZXJ2ZXJUb29sczogdGhpcy5jYWNoZS50b0pTT04oKSxcblx0XHRcdFx0fSBzYXRpc2ZpZXMgU3RvcmVkVHlwZSwgc2NvcGUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHRcdHRoaXMuZGlkQ2hhbmdlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNhY2hlZDogU3RvcmVkVHlwZSB8IHVuZGVmaW5lZCA9IHN0b3JhZ2VTZXJ2aWNlLmdldE9iamVjdChzdG9yYWdlS2V5LCBzY29wZSk7XG5cdFx0XHR0aGlzLmV4dGVuc2lvblNlcnZlcnMgPSBuZXcgTWFwKGNhY2hlZD8uZXh0ZW5zaW9uU2VydmVycyA/PyBbXSk7XG5cdFx0XHRjYWNoZWQ/LnNlcnZlclRvb2xzPy5mb3JFYWNoKChbaywgdl0pID0+IHRoaXMuY2FjaGUuc2V0KGssIHYpKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIGlnbm9yZWRcblx0XHR9XG5cdH1cblxuXHQvKiogUmVzZXRzIHRoZSBjYWNoZSBmb3IgdG9vbHMgYW5kIGV4dGVuc2lvbiBzZXJ2ZXJzICovXG5cdHJlc2V0KCkge1xuXHRcdHRoaXMuY2FjaGUuY2xlYXIoKTtcblx0XHR0aGlzLmV4dGVuc2lvblNlcnZlcnMuY2xlYXIoKTtcblx0XHR0aGlzLmRpZENoYW5nZSA9IHRydWU7XG5cdH1cblxuXHQvKiogR2V0cyBjYWNoZWQgdG9vbHMgZm9yIGEgc2VydmVyICh1c2VkIGJlZm9yZSBhIHNlcnZlciBpcyBydW5uaW5nKSAqL1xuXHRnZXRUb29scyhkZWZpbml0aW9uSWQ6IHN0cmluZyk6IHJlYWRvbmx5IElWYWxpZGF0ZWRNY3BUb29sW10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNhY2hlLmdldChkZWZpbml0aW9uSWQpPy50b29scztcblx0fVxuXG5cdC8qKiBTZXRzIGNhY2hlZCB0b29scyBmb3IgYSBzZXJ2ZXIgKi9cblx0c3RvcmVUb29scyhkZWZpbml0aW9uSWQ6IHN0cmluZywgdG9vbHM6IHJlYWRvbmx5IElWYWxpZGF0ZWRNY3BUb29sW10pOiB2b2lkIHtcblx0XHR0aGlzLmNhY2hlLnNldChkZWZpbml0aW9uSWQsIHsgLi4udGhpcy5jYWNoZS5nZXQoZGVmaW5pdGlvbklkKSwgdG9vbHMgfSk7XG5cdFx0dGhpcy5kaWRDaGFuZ2UgPSB0cnVlO1xuXHR9XG5cblx0LyoqIEdldHMgY2FjaGVkIHNlcnZlcnMgZm9yIGEgY29sbGVjdGlvbiAodXNlZCBmb3IgZXh0ZW5zaW9ucywgYmVmb3JlIHRoZSBleHRlbnNpb24gYWN0aXZhdGVzKSAqL1xuXHRnZXRTZXJ2ZXJzKGNvbGxlY3Rpb25JZDogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uU2VydmVycy5nZXQoY29sbGVjdGlvbklkKTtcblx0fVxuXG5cdC8qKiBTZXRzIGNhY2hlZCBzZXJ2ZXJzIGZvciBhIGNvbGxlY3Rpb24gKi9cblx0c3RvcmVTZXJ2ZXJzKGNvbGxlY3Rpb25JZDogc3RyaW5nLCBlbnRyeTogSVNlcnZlckNhY2hlRW50cnkgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoZW50cnkpIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uU2VydmVycy5zZXQoY29sbGVjdGlvbklkLCBlbnRyeSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uU2VydmVycy5kZWxldGUoY29sbGVjdGlvbklkKTtcblx0XHR9XG5cdFx0dGhpcy5kaWRDaGFuZ2UgPSB0cnVlO1xuXHR9XG59XG5cbmludGVyZmFjZSBJVmFsaWRhdGVkTWNwVG9vbCBleHRlbmRzIE1DUC5Ub29sIHtcblx0LyoqXG5cdCAqIFRvb2wgbmFtZSBhcyBwdWJsaXNoZWQgYnkgdGhlIE1DUCBzZXJ2ZXIuIFRoaXMgbWF5XG5cdCAqIGJlIGRpZmZlcmVudCB0aGFuIHRoZSBvbmUgaW4ge0BsaW5rIGRlZmluaXRpb259IGR1ZSB0byBuYW1lIG5vcm1hbGl6YXRpb25cblx0ICogaW4ge0BsaW5rIE1jcFNlcnZlci5fZ2V0VmFsaWRhdGVkVG9vbHN9LlxuXHQgKi9cblx0c2VydmVyVG9vbE5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1jcFNlcnZlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTWNwU2VydmVyIHtcblx0cHJpdmF0ZSByZWFkb25seSBfY29ubmVjdGlvblNlcXVlbmNlciA9IG5ldyBTZXF1ZW5jZXIoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY29ubmVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKGRpc3Bvc2FibGVPYnNlcnZhYmxlVmFsdWU8SU1jcFNlcnZlckNvbm5lY3Rpb24gfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCkpO1xuXG5cdHB1YmxpYyByZWFkb25seSBjb25uZWN0aW9uID0gdGhpcy5fY29ubmVjdGlvbjtcblx0cHVibGljIHJlYWRvbmx5IGNvbm5lY3Rpb25TdGF0ZTogSU9ic2VydmFibGU8TWNwQ29ubmVjdGlvblN0YXRlPiA9IGRlcml2ZWQocmVhZGVyID0+IHRoaXMuX2Nvbm5lY3Rpb24ucmVhZChyZWFkZXIpPy5zdGF0ZS5yZWFkKHJlYWRlcikgPz8geyBzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuU3RvcHBlZCB9KTtcblxuXHRwcml2YXRlIGdldCB0b29sc0Zyb21DYWNoZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdG9vbENhY2hlLmdldFRvb2xzKHRoaXMuZGVmaW5pdGlvbi5pZCk7XG5cdH1cblx0cHJpdmF0ZSByZWFkb25seSB0b29sc0Zyb21TZXJ2ZXJQcm9taXNlID0gb2JzZXJ2YWJsZVZhbHVlPE9ic2VydmFibGVQcm9taXNlPHJlYWRvbmx5IElWYWxpZGF0ZWRNY3BUb29sW10+IHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHRvb2xzRnJvbVNlcnZlciA9IGRlcml2ZWQocmVhZGVyID0+IHRoaXMudG9vbHNGcm9tU2VydmVyUHJvbWlzZS5yZWFkKHJlYWRlcik/LnByb21pc2VSZXN1bHQucmVhZChyZWFkZXIpPy5kYXRhKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgdG9vbHM6IElPYnNlcnZhYmxlPHJlYWRvbmx5IElNY3BUb29sW10+O1xuXG5cdHB1YmxpYyByZWFkb25seSB0b29sc1N0YXRlID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGZyb21TZXJ2ZXIgPSB0aGlzLnRvb2xzRnJvbVNlcnZlclByb21pc2UucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb25TdGF0ZSA9IHRoaXMuY29ubmVjdGlvblN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBpc0lkbGUgPSBNY3BDb25uZWN0aW9uU3RhdGUuY2FuQmVTdGFydGVkKGNvbm5lY3Rpb25TdGF0ZS5zdGF0ZSkgJiYgIWZyb21TZXJ2ZXI7XG5cdFx0aWYgKGlzSWRsZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudG9vbHNGcm9tQ2FjaGUgPyBNY3BTZXJ2ZXJUb29sc1N0YXRlLkNhY2hlZCA6IE1jcFNlcnZlclRvb2xzU3RhdGUuVW5rbm93bjtcblx0XHR9XG5cblx0XHRjb25zdCBmcm9tU2VydmVyUmVzdWx0ID0gZnJvbVNlcnZlcj8ucHJvbWlzZVJlc3VsdC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFmcm9tU2VydmVyUmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50b29sc0Zyb21DYWNoZSA/IE1jcFNlcnZlclRvb2xzU3RhdGUuUmVmcmVzaGluZ0Zyb21DYWNoZWQgOiBNY3BTZXJ2ZXJUb29sc1N0YXRlLlJlZnJlc2hpbmdGcm9tVW5rbm93bjtcblx0XHR9XG5cblx0XHRyZXR1cm4gZnJvbVNlcnZlclJlc3VsdC5lcnJvciA/ICh0aGlzLnRvb2xzRnJvbUNhY2hlID8gTWNwU2VydmVyVG9vbHNTdGF0ZS5DYWNoZWQgOiBNY3BTZXJ2ZXJUb29sc1N0YXRlLlVua25vd24pIDogTWNwU2VydmVyVG9vbHNTdGF0ZS5MaXZlO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dnZXJJZDogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dnZXI6IElMb2dnZXI7XG5cblx0cHVibGljIGdldCB0cnVzdGVkKCkge1xuXHRcdHJldHVybiB0aGlzLl9tY3BSZWdpc3RyeS5nZXRUcnVzdCh0aGlzLmNvbGxlY3Rpb24pO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGNvbGxlY3Rpb246IE1jcENvbGxlY3Rpb25SZWZlcmVuY2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IGRlZmluaXRpb246IE1jcERlZmluaXRpb25SZWZlcmVuY2UsXG5cdFx0ZXhwbGljaXRSb290czogVVJJW10gfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVxdWlyZXNFeHRlbnNpb25BY3RpdmF0aW9uOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rvb2xDYWNoZTogTWNwU2VydmVyTWV0YWRhdGFDYWNoZSxcblx0XHRASU1jcFJlZ2lzdHJ5IHByaXZhdGUgcmVhZG9ubHkgX21jcFJlZ2lzdHJ5OiBJTWNwUmVnaXN0cnksXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB3b3Jrc3BhY2VzU2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUxvZ2dlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nZ2VyU2VydmljZTogSUxvZ2dlclNlcnZpY2UsXG5cdFx0QElPdXRwdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX291dHB1dFNlcnZpY2U6IElPdXRwdXRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fbG9nZ2VySWQgPSBgbWNwU2VydmVyLiR7ZGVmaW5pdGlvbi5pZH1gO1xuXHRcdHRoaXMuX2xvZ2dlciA9IHRoaXMuX3JlZ2lzdGVyKF9sb2dnZXJTZXJ2aWNlLmNyZWF0ZUxvZ2dlcih0aGlzLl9sb2dnZXJJZCwgeyBoaWRkZW46IHRydWUsIG5hbWU6IGBNQ1A6ICR7ZGVmaW5pdGlvbi5sYWJlbH1gIH0pKTtcblx0XHQvLyBJZiB0aGUgbG9nZ2VyIGlzIGRpc3Bvc2VkIGJ1dCBub3QgZGVyZWdpc3RlcmVkLCB0aGVuIHRoZSBkaXNwb3NlZCBpbnN0YW5jZVxuXHRcdC8vIGlzIHJldXNlZCBhbmQgbm8tb3BzLiB0b2RvQHNhbmR5MDgxIHRoaXMgc2VlbXMgbGlrZSBhIGJ1Zy5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gX2xvZ2dlclNlcnZpY2UuZGVyZWdpc3RlckxvZ2dlcih0aGlzLl9sb2dnZXJJZCkpKTtcblxuXHRcdC8vIDEuIFJlZmxlY3Qgd29ya3NwYWNlcyBpbnRvIHRoZSBNQ1Agcm9vdHNcblx0XHRjb25zdCB3b3Jrc3BhY2VzID0gZXhwbGljaXRSb290c1xuXHRcdFx0PyBvYnNlcnZhYmxlVmFsdWUodGhpcywgZXhwbGljaXRSb290cy5tYXAodXJpID0+ICh7IHVyaSwgbmFtZTogYmFzZW5hbWUodXJpKSB9KSkpXG5cdFx0XHQ6IG9ic2VydmFibGVGcm9tRXZlbnQoXG5cdFx0XHRcdHRoaXMsXG5cdFx0XHRcdHdvcmtzcGFjZXNTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycyxcblx0XHRcdFx0KCkgPT4gd29ya3NwYWNlc1NlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycyxcblx0XHRcdCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBjbnggPSB0aGlzLl9jb25uZWN0aW9uLnJlYWQocmVhZGVyKT8uaGFuZGxlci5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIWNueCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNueC5yb290cyA9IHdvcmtzcGFjZXMucmVhZChyZWFkZXIpLm1hcCh3ZiA9PiAoe1xuXHRcdFx0XHR1cmk6IHdmLnVyaS50b1N0cmluZygpLFxuXHRcdFx0XHRuYW1lOiB3Zi5uYW1lLFxuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblxuXHRcdC8vIDIuIFBvcHVsYXRlIHRoaXMudG9vbHMgd2hlbiB3ZSBjb25uZWN0IHRvIGEgc2VydmVyLlxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdGNvbnN0IGNueCA9IHRoaXMuX2Nvbm5lY3Rpb24ucmVhZChyZWFkZXIpPy5oYW5kbGVyLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChjbngpIHtcblx0XHRcdFx0dGhpcy5wb3B1bGF0ZUxpdmVEYXRhKGNueCwgc3RvcmUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5yZXNldExpdmVEYXRhKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gMy4gVXBkYXRlIHRoZSBjYWNoZSB3aGVuIHRvb2xzIHVwZGF0ZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IHRvb2xzID0gdGhpcy50b29sc0Zyb21TZXJ2ZXIucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKHRvb2xzKSB7XG5cdFx0XHRcdHRoaXMuX3Rvb2xDYWNoZS5zdG9yZVRvb2xzKGRlZmluaXRpb24uaWQsIHRvb2xzKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyA0LiBQdWJsaXNoIHRvb2xzXG5cdFx0Y29uc3QgdG9vbFByZWZpeCA9IHRoaXMuX21jcFJlZ2lzdHJ5LmNvbGxlY3Rpb25Ub29sUHJlZml4KHRoaXMuY29sbGVjdGlvbik7XG5cdFx0dGhpcy50b29scyA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IHNlcnZlclRvb2xzID0gdGhpcy50b29sc0Zyb21TZXJ2ZXIucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgZGVmaW5pdGlvbnMgPSBzZXJ2ZXJUb29scyA/PyB0aGlzLnRvb2xzRnJvbUNhY2hlID8/IFtdO1xuXHRcdFx0Y29uc3QgcHJlZml4ID0gdG9vbFByZWZpeC5yZWFkKHJlYWRlcik7XG5cdFx0XHRyZXR1cm4gZGVmaW5pdGlvbnMubWFwKGRlZiA9PiBuZXcgTWNwVG9vbCh0aGlzLCBwcmVmaXgsIGRlZikpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHNob3dPdXRwdXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9nZ2VyU2VydmljZS5zZXRWaXNpYmlsaXR5KHRoaXMuX2xvZ2dlcklkLCB0cnVlKTtcblx0XHR0aGlzLl9vdXRwdXRTZXJ2aWNlLnNob3dDaGFubmVsKHRoaXMuX2xvZ2dlcklkKTtcblx0fVxuXG5cdHB1YmxpYyBzdGFydChpc0Zyb21JbnRlcmFjdGlvbj86IGJvb2xlYW4pOiBQcm9taXNlPE1jcENvbm5lY3Rpb25TdGF0ZT4ge1xuXHRcdHJldHVybiB0aGlzLl9jb25uZWN0aW9uU2VxdWVuY2VyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGFjdGl2YXRpb25FdmVudCA9IG1jcEFjdGl2YXRpb25FdmVudCh0aGlzLmNvbGxlY3Rpb24uaWQuc2xpY2UoZXh0ZW5zaW9uTWNwQ29sbGVjdGlvblByZWZpeC5sZW5ndGgpKTtcblx0XHRcdGlmICh0aGlzLl9yZXF1aXJlc0V4dGVuc2lvbkFjdGl2YXRpb24gJiYgIXRoaXMuX2V4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGlvbkV2ZW50SXNEb25lKGFjdGl2YXRpb25FdmVudCkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50KTtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwodGhpcy5fbWNwUmVnaXN0cnkuZGVsZWdhdGVzXG5cdFx0XHRcdFx0Lm1hcChyID0+IHIud2FpdEZvckluaXRpYWxQcm92aWRlclByb21pc2VzKCkpKTtcblx0XHRcdFx0Ly8gVGhpcyBjYW4gaGFwcGVuIGlmIHRoZSBzZXJ2ZXIgd2FzIGNyZWF0ZWQgZnJvbSBhIGNhY2hlZCBNQ1Agc2VydmVyIHNlZW5cblx0XHRcdFx0Ly8gZnJvbSBhbiBleHRlbnNpb24sIGJ1dCB0aGVuIGl0IHdhc24ndCByZWdpc3RlcmVkIHdoZW4gdGhlIGV4dGVuc2lvbiBhY3RpdmF0ZWQuXG5cdFx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlN0b3BwZWQgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRsZXQgY29ubmVjdGlvbiA9IHRoaXMuX2Nvbm5lY3Rpb24uZ2V0KCk7XG5cdFx0XHRpZiAoY29ubmVjdGlvbiAmJiBNY3BDb25uZWN0aW9uU3RhdGUuY2FuQmVTdGFydGVkKGNvbm5lY3Rpb24uc3RhdGUuZ2V0KCkuc3RhdGUpKSB7XG5cdFx0XHRcdGNvbm5lY3Rpb24uZGlzcG9zZSgpO1xuXHRcdFx0XHRjb25uZWN0aW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9jb25uZWN0aW9uLnNldChjb25uZWN0aW9uLCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWNvbm5lY3Rpb24pIHtcblx0XHRcdFx0Y29ubmVjdGlvbiA9IGF3YWl0IHRoaXMuX21jcFJlZ2lzdHJ5LnJlc29sdmVDb25uZWN0aW9uKHtcblx0XHRcdFx0XHRsb2dnZXI6IHRoaXMuX2xvZ2dlcixcblx0XHRcdFx0XHRjb2xsZWN0aW9uUmVmOiB0aGlzLmNvbGxlY3Rpb24sXG5cdFx0XHRcdFx0ZGVmaW5pdGlvblJlZjogdGhpcy5kZWZpbml0aW9uLFxuXHRcdFx0XHRcdGZvcmNlVHJ1c3Q6IGlzRnJvbUludGVyYWN0aW9uLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCFjb25uZWN0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlN0b3BwZWQgfTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0Y29ubmVjdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlN0b3BwZWQgfTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2Nvbm5lY3Rpb24uc2V0KGNvbm5lY3Rpb24sIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcblx0XHRcdGNvbnN0IHN0YXRlID0gYXdhaXQgY29ubmVjdGlvbi5zdGFydCgpO1xuXHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFNlcnZlckJvb3RTdGF0ZSwgU2VydmVyQm9vdFN0YXRlQ2xhc3NpZmljYXRpb24+KCdtY3Avc2VydmVyQm9vdFN0YXRlJywge1xuXHRcdFx0XHRzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLnRvS2luZFN0cmluZyhzdGF0ZS5zdGF0ZSksXG5cdFx0XHRcdHRpbWU6IERhdGUubm93KCkgLSBzdGFydCxcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gc3RhdGU7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgc3RvcCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fY29ubmVjdGlvbi5nZXQoKT8uc3RvcCgpIHx8IFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNldExpdmVEYXRhKCkge1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMudG9vbHNGcm9tU2VydmVyUHJvbWlzZS5zZXQodW5kZWZpbmVkLCB0eCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9ub3JtYWxpemVUb29sKG9yaWdpbmFsVG9vbDogTUNQLlRvb2wpOiBQcm9taXNlPElWYWxpZGF0ZWRNY3BUb29sIHwgeyBlcnJvcjogc3RyaW5nW10gfT4ge1xuXHRcdGNvbnN0IHRvb2w6IElWYWxpZGF0ZWRNY3BUb29sID0geyAuLi5vcmlnaW5hbFRvb2wsIHNlcnZlclRvb2xOYW1lOiBvcmlnaW5hbFRvb2wubmFtZSB9O1xuXHRcdGlmICghdG9vbC5kZXNjcmlwdGlvbikge1xuXHRcdFx0Ly8gRW5zdXJlIGEgZGVzY3JpcHRpb24gaXMgcHJvdmlkZWQgZm9yIGVhY2ggdG9vbCwgIzI0MzkxOVxuXHRcdFx0dGhpcy5fbG9nZ2VyLndhcm4oYFRvb2wgJHt0b29sLm5hbWV9IGRvZXMgbm90IGhhdmUgYSBkZXNjcmlwdGlvbi4gVG9vbHMgbXVzdCBiZSBhY2N1cmF0ZWx5IGRlc2NyaWJlZCB0byBiZSBjYWxsZWRgKTtcblx0XHRcdHRvb2wuZGVzY3JpcHRpb24gPSAnPGVtcHR5Pic7XG5cdFx0fVxuXG5cdFx0aWYgKHRvb2xJbnZhbGlkQ2hhclJlLnRlc3QodG9vbC5uYW1lKSkge1xuXHRcdFx0dGhpcy5fbG9nZ2VyLndhcm4oYFRvb2wgJHtKU09OLnN0cmluZ2lmeSh0b29sLm5hbWUpfSBpcyBpbnZhbGlkLiBUb29scyBuYW1lcyBtYXkgb25seSBjb250YWluIFthLXowLTlfLV1gKTtcblx0XHRcdHRvb2wubmFtZSA9IHRvb2wubmFtZS5yZXBsYWNlKHRvb2xJbnZhbGlkQ2hhclJlLCAnXycpO1xuXHRcdH1cblxuXHRcdHR5cGUgSnNvbkRpYWdub3N0aWMgPSB7IG1lc3NhZ2U6IHN0cmluZzsgcmFuZ2U6IHsgbGluZTogbnVtYmVyOyBjaGFyYWN0ZXI6IG51bWJlciB9W10gfTtcblxuXHRcdGxldCBkaWFnbm9zdGljczogSnNvbkRpYWdub3N0aWNbXSA9IFtdO1xuXHRcdGNvbnN0IHRvb2xKc29uID0gSlNPTi5zdHJpbmdpZnkodG9vbC5pbnB1dFNjaGVtYSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNjaGVtYVVyaSA9IFVSSS5wYXJzZSgnaHR0cHM6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQtMDcvc2NoZW1hJyk7XG5cdFx0XHRkaWFnbm9zdGljcyA9IGF3YWl0IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kPEpzb25EaWFnbm9zdGljW10+KCdqc29uLnZhbGlkYXRlJywgc2NoZW1hVXJpLCB0b29sSnNvbikgfHwgW107XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gaWdub3JlZCAoZXJyb3IgaW4ganNvbiBleHRlbnNpb24/KTtcblx0XHR9XG5cblx0XHRpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRvb2w7XG5cdFx0fVxuXG5cdFx0Ly8gYmVjYXVzZSBpdCdzIGFsbCBvbmUgbGluZSBmcm9tIEpTT04uc3RyaW5naWZ5LCB3ZSBjYW4gdHJlYXQgY2hhcmFjdGVycyBhcyBvZmZzZXRzLlxuXHRcdGNvbnN0IHRyZWUgPSBqc29uLnBhcnNlVHJlZSh0b29sSnNvbik7XG5cdFx0Y29uc3QgbWVzc2FnZXMgPSBkaWFnbm9zdGljcy5tYXAoZCA9PiB7XG5cdFx0XHRjb25zdCBub2RlID0ganNvbi5maW5kTm9kZUF0T2Zmc2V0KHRyZWUsIGQucmFuZ2VbMF0uY2hhcmFjdGVyKTtcblx0XHRcdGNvbnN0IHBhdGggPSBub2RlICYmIGAvJHtqc29uLmdldE5vZGVQYXRoKG5vZGUpLmpvaW4oJy8nKX1gO1xuXHRcdFx0cmV0dXJuIGQubWVzc2FnZSArIChwYXRoID8gYCAoYXQgJHtwYXRofSlgIDogJycpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHsgZXJyb3I6IG1lc3NhZ2VzIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRWYWxpZGF0ZWRUb29scyhoYW5kbGVyOiBNY3BTZXJ2ZXJSZXF1ZXN0SGFuZGxlciwgdG9vbHM6IE1DUC5Ub29sW10pOiBQcm9taXNlPElWYWxpZGF0ZWRNY3BUb29sW10+IHtcblx0XHRsZXQgZXJyb3IgPSAnJztcblxuXHRcdGNvbnN0IHZhbGlkYXRpb25zID0gYXdhaXQgUHJvbWlzZS5hbGwodG9vbHMubWFwKHQgPT4gdGhpcy5fbm9ybWFsaXplVG9vbCh0KSkpO1xuXHRcdGNvbnN0IHZhbGlkYXRlZDogSVZhbGlkYXRlZE1jcFRvb2xbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2ksIHJlc3VsdF0gb2YgdmFsaWRhdGlvbnMuZW50cmllcygpKSB7XG5cdFx0XHRpZiAoJ2Vycm9yJyBpbiByZXN1bHQpIHtcblx0XHRcdFx0ZXJyb3IgKz0gbG9jYWxpemUoJ21jcEJhZFNjaGVtYS50b29sJywgJ1Rvb2wgYHswfWAgaGFzIGludmFsaWQgSlNPTiBwYXJhbWV0ZXJzOicsIHRvb2xzW2ldLm5hbWUpICsgJ1xcbic7XG5cdFx0XHRcdGZvciAoY29uc3QgbWVzc2FnZSBvZiByZXN1bHQuZXJyb3IpIHtcblx0XHRcdFx0XHRlcnJvciArPSBgXFx0LSAke21lc3NhZ2V9XFxuYDtcblx0XHRcdFx0fVxuXHRcdFx0XHRlcnJvciArPSBgXFx0LSBTY2hlbWE6ICR7SlNPTi5zdHJpbmdpZnkodG9vbHNbaV0uaW5wdXRTY2hlbWEpfVxcblxcbmA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YWxpZGF0ZWQucHVzaChyZXN1bHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlcnJvcikge1xuXHRcdFx0aGFuZGxlci5sb2dnZXIud2FybihgJHt0b29scy5sZW5ndGggLSB2YWxpZGF0ZWQubGVuZ3RofSB0b29scyBoYXZlIGludmFsaWQgSlNPTiBzY2hlbWFzIGFuZCB3aWxsIGJlIG9taXR0ZWRgKTtcblx0XHRcdHdhcm5JbnZhbGlkVG9vbHModGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UsIHRoaXMuZGVmaW5pdGlvbi5sYWJlbCwgZXJyb3IpO1xuXHRcdH1cblxuXHRcdHJldHVybiB2YWxpZGF0ZWQ7XG5cdH1cblxuXHRwcml2YXRlIHBvcHVsYXRlTGl2ZURhdGEoaGFuZGxlcjogTWNwU2VydmVyUmVxdWVzdEhhbmRsZXIsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpIHtcblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cblx0XHQvLyB0b2RvOiBhZGQgbW9yZSB0aGFuIGp1c3QgdG9vbHMgaGVyZVxuXG5cdFx0Y29uc3QgdXBkYXRlVG9vbHMgPSAodHg6IElUcmFuc2FjdGlvbiB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0Y29uc3QgdG9vbFByb21pc2UgPSBoYW5kbGVyLmNhcGFiaWxpdGllcy50b29scyA/IGhhbmRsZXIubGlzdFRvb2xzKHt9LCBjdHMudG9rZW4pIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcblx0XHRcdGNvbnN0IHRvb2xQcm9taXNlU2FmZSA9IHRvb2xQcm9taXNlLnRoZW4oYXN5bmMgdG9vbHMgPT4ge1xuXHRcdFx0XHRoYW5kbGVyLmxvZ2dlci5pbmZvKGBEaXNjb3ZlcmVkICR7dG9vbHMubGVuZ3RofSB0b29sc2ApO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZ2V0VmFsaWRhdGVkVG9vbHMoaGFuZGxlciwgdG9vbHMpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLnRvb2xzRnJvbVNlcnZlclByb21pc2Uuc2V0KG5ldyBPYnNlcnZhYmxlUHJvbWlzZSh0b29sUHJvbWlzZVNhZmUpLCB0eCk7XG5cblx0XHRcdHJldHVybiBbdG9vbFByb21pc2VdO1xuXHRcdH07XG5cblx0XHRzdG9yZS5hZGQoaGFuZGxlci5vbkRpZENoYW5nZVRvb2xMaXN0KCgpID0+IHtcblx0XHRcdGhhbmRsZXIubG9nZ2VyLmluZm8oJ1Rvb2wgbGlzdCBjaGFuZ2VkLCByZWZyZXNoaW5nIHRvb2xzLi4uJyk7XG5cdFx0XHR1cGRhdGVUb29scyh1bmRlZmluZWQpO1xuXHRcdH0pKTtcblxuXHRcdGxldCBwcm9taXNlczogUmV0dXJuVHlwZTx0eXBlb2YgdXBkYXRlVG9vbHM+O1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHByb21pc2VzID0gdXBkYXRlVG9vbHModHgpO1xuXHRcdH0pO1xuXG5cdFx0UHJvbWlzZS5hbGwocHJvbWlzZXMhKS50aGVuKChbdG9vbHNdKSA9PiB7XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8U2VydmVyQm9vdERhdGEsIFNlcnZlckJvb3RDbGFzc2lmaWNhdGlvbj4oJ21jcC9zZXJ2ZXJCb290Jywge1xuXHRcdFx0XHRzdXBwb3J0c0xvZ2dpbmc6ICEhaGFuZGxlci5jYXBhYmlsaXRpZXMubG9nZ2luZyxcblx0XHRcdFx0c3VwcG9ydHNQcm9tcHRzOiAhIWhhbmRsZXIuY2FwYWJpbGl0aWVzLnByb21wdHMsXG5cdFx0XHRcdHN1cHBvcnRzUmVzb3VyY2VzOiAhIWhhbmRsZXIuY2FwYWJpbGl0aWVzLnJlc291cmNlcyxcblx0XHRcdFx0dG9vbENvdW50OiB0b29scy5sZW5ndGgsXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBIZWxwZXIgZnVuY3Rpb24gdG8gY2FsbCB0aGUgZnVuY3Rpb24gb24gdGhlIGhhbmRsZXIgb25jZSBpdCdzIG9ubGluZS4gVGhlXG5cdCAqIGNvbm5lY3Rpb24gc3RhcnRlZCBpZiBpdCBpcyBub3QgYWxyZWFkeS5cblx0ICovXG5cdHB1YmxpYyBhc3luYyBjYWxsT248Uj4oZm46IChoYW5kbGVyOiBNY3BTZXJ2ZXJSZXF1ZXN0SGFuZGxlcikgPT4gUHJvbWlzZTxSPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk6IFByb21pc2U8Uj4ge1xuXG5cdFx0YXdhaXQgdGhpcy5zdGFydCgpOyAvLyBpZGVtcG90ZW50XG5cblx0XHRsZXQgcmFuT25jZSA9IGZhbHNlO1xuXHRcdGxldCBkOiBJRGlzcG9zYWJsZTtcblxuXHRcdGNvbnN0IGNhbGxQcm9taXNlID0gbmV3IFByb21pc2U8Uj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cdFx0XHRkID0gYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRjb25zdCBjb25uZWN0aW9uID0gdGhpcy5fY29ubmVjdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGlmICghY29ubmVjdGlvbiB8fCByYW5PbmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaGFuZGxlciA9IGNvbm5lY3Rpb24uaGFuZGxlci5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGlmICghaGFuZGxlcikge1xuXHRcdFx0XHRcdGNvbnN0IHN0YXRlID0gY29ubmVjdGlvbi5zdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdFx0aWYgKHN0YXRlLnN0YXRlID09PSBNY3BDb25uZWN0aW9uU3RhdGUuS2luZC5FcnJvcikge1xuXHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBNY3BDb25uZWN0aW9uRmFpbGVkRXJyb3IoYE1DUCBzZXJ2ZXIgY291bGQgbm90IGJlIHN0YXJ0ZWQ6ICR7c3RhdGUubWVzc2FnZX1gKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzdGF0ZS5zdGF0ZSA9PT0gTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuU3RvcHBlZCkge1xuXHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBNY3BDb25uZWN0aW9uRmFpbGVkRXJyb3IoJ01DUCBzZXJ2ZXIgaGFzIHN0b3BwZWQnKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIGtlZXAgd2FpdGluZyBmb3IgaGFuZGxlclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJlc29sdmUoZm4oaGFuZGxlcikpO1xuXHRcdFx0XHRyYW5PbmNlID0gdHJ1ZTsgLy8gYWdncmVzc2l2ZSBwcmV2ZW50IG11bHRpcGxlIHJhY2V5IGNhbGxzLCBkb24ndCBkaXNwb3NlIGJlY2F1c2UgYXV0b3J1biBpcyBzeW5jXG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiByYWNlQ2FuY2VsbGF0aW9uRXJyb3IoY2FsbFByb21pc2UsIHRva2VuKS5maW5hbGx5KCgpID0+IGQuZGlzcG9zZSgpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWNwVG9vbCBpbXBsZW1lbnRzIElNY3BUb29sIHtcblxuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXG5cdHB1YmxpYyBnZXQgZGVmaW5pdGlvbigpOiBNQ1AuVG9vbCB7IHJldHVybiB0aGlzLl9kZWZpbml0aW9uOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2VydmVyOiBNY3BTZXJ2ZXIsXG5cdFx0aWRQcmVmaXg6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kZWZpbml0aW9uOiBJVmFsaWRhdGVkTWNwVG9vbCxcblx0KSB7XG5cdFx0dGhpcy5pZCA9IChpZFByZWZpeCArIF9kZWZpbml0aW9uLm5hbWUpLnJlcGxhY2VBbGwoJy4nLCAnXycpO1xuXHR9XG5cblx0Y2FsbChwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxNQ1AuQ2FsbFRvb2xSZXN1bHQ+IHtcblx0XHQvLyBzZXJ2ZXJUb29sTmFtZSBpcyBhbHdheXMgc2V0IG5vdywgYnV0IG9sZGVyIGNhY2hlIGVudHJpZXMgKGZyb20gMS45OS1JbnNpZGVycykgbWF5IG5vdCBoYXZlIGl0LlxuXHRcdGNvbnN0IG5hbWUgPSB0aGlzLl9kZWZpbml0aW9uLnNlcnZlclRvb2xOYW1lID8/IHRoaXMuX2RlZmluaXRpb24ubmFtZTtcblx0XHRyZXR1cm4gdGhpcy5fc2VydmVyLmNhbGxPbihoID0+IGguY2FsbFRvb2woeyBuYW1lLCBhcmd1bWVudHM6IHBhcmFtcyB9KSwgdG9rZW4pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHdhcm5JbnZhbGlkVG9vbHMoaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIHNlcnZlck5hbWU6IHN0cmluZywgZXJyb3JUZXh0OiBzdHJpbmcpIHtcblx0aW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdG5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ21jcEJhZFNjaGVtYScsICdNQ1Agc2VydmVyIGB7MH1gIGhhcyB0b29scyB3aXRoIGludmFsaWQgcGFyYW1ldGVycyB3aGljaCB3aWxsIGJlIG9taXR0ZWQuJywgc2VydmVyTmFtZSksXG5cdFx0XHRhY3Rpb25zOiB7XG5cdFx0XHRcdHByaW1hcnk6IFt7XG5cdFx0XHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdGlkOiAnbWNwQmFkU2NoZW1hLnNob3cnLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbWNwQmFkU2NoZW1hLnNob3cnLCAnU2hvdycpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0ZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRcdFx0cmVzb3VyY2U6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0Y29udGVudHM6IGVycm9yVGV4dCxcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCLGlCQUFpQjtBQUNqRCxZQUFZLFVBQVU7QUFDdEIsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMsWUFBMEMsb0JBQW9CO0FBQ3ZFLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsU0FBUyxrQkFBa0IsU0FBUywyQkFBc0QscUJBQXFCLG1CQUFtQixpQkFBaUIsbUJBQW1CO0FBQy9LLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFrQixzQkFBc0I7QUFDeEMsU0FBUyxpQkFBK0IscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xD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
