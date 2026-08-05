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
import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { equals } from "../../../../base/common/objects.js";
import { autorun, observableValue, transaction } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { StorageScope } from "../../../../platform/storage/common/storage.js";
import { ILanguageModelToolsService } from "../../chat/common/languageModelToolsService.js";
import { IMcpRegistry } from "./mcpRegistryTypes.js";
import { McpServer, McpServerMetadataCache } from "./mcpServer.js";
import { McpServerDefinition, McpServerToolsState } from "./mcpTypes.js";
let McpService = class extends Disposable {
  constructor(_instantiationService, _mcpRegistry, _toolsService, _logService) {
    super();
    this._instantiationService = _instantiationService;
    this._mcpRegistry = _mcpRegistry;
    this._toolsService = _toolsService;
    this._logService = _logService;
    this._servers = observableValue(this, []);
    this.servers = this._servers.map((servers) => servers.map((s) => s.object));
    this.userCache = this._register(_instantiationService.createInstance(McpServerMetadataCache, StorageScope.PROFILE));
    this.workspaceCache = this._register(_instantiationService.createInstance(McpServerMetadataCache, StorageScope.WORKSPACE));
    const updateThrottle = this._store.add(new RunOnceScheduler(() => this._updateCollectedServers(), 500));
    this._register(autorun((reader) => {
      for (const collection of this._mcpRegistry.collections.read(reader)) {
        collection.serverDefinitions.read(reader);
      }
      updateThrottle.schedule(500);
    }));
  }
  get lazyCollectionState() {
    return this._mcpRegistry.lazyCollectionState;
  }
  resetCaches() {
    this.userCache.reset();
    this.workspaceCache.reset();
  }
  async activateCollections() {
    const collections = await this._mcpRegistry.discoverCollections();
    const collectionIds = new Set(collections.map((c) => c.id));
    this._updateCollectedServers();
    const todo = [];
    for (const { object: server } of this._servers.get()) {
      if (collectionIds.has(server.collection.id)) {
        const state = server.toolsState.get();
        if (state === McpServerToolsState.Unknown) {
          todo.push(server.start());
        }
      }
    }
    await Promise.all(todo);
  }
  _syncTools(server, store) {
    const tools = /* @__PURE__ */ new Map();
    store.add(autorun((reader) => {
      const toDelete = new Set(tools.keys());
      for (const tool of server.tools.read(reader)) {
        const existing = tools.get(tool.id);
        const collection = this._mcpRegistry.collections.get().find((c) => c.id === server.collection.id);
        const toolData = {
          id: tool.id,
          source: { type: "mcp", collectionId: server.collection.id, definitionId: server.definition.id },
          icon: Codicon.tools,
          displayName: tool.definition.name,
          toolReferenceName: tool.definition.name,
          modelDescription: tool.definition.description ?? "",
          userDescription: tool.definition.description ?? "",
          inputSchema: tool.definition.inputSchema,
          canBeReferencedInPrompt: true,
          supportsToolPicker: true,
          runsInWorkspace: collection?.scope === StorageScope.WORKSPACE || !!collection?.remoteAuthority,
          tags: ["mcp"]
        };
        if (existing) {
          if (!equals(existing.toolData, toolData)) {
            existing.toolData = toolData;
            existing.toolDispose.dispose();
            existing.toolDispose = this._toolsService.registerToolData(toolData);
          }
          toDelete.delete(tool.id);
        } else {
          tools.set(tool.id, {
            toolData,
            toolDispose: this._toolsService.registerToolData(toolData),
            implDispose: this._toolsService.registerToolImplementation(tool.id, this._instantiationService.createInstance(McpToolImplementation, tool, server))
          });
        }
      }
      for (const id of toDelete) {
        const tool = tools.get(id);
        if (tool) {
          tool.toolDispose.dispose();
          tool.implDispose.dispose();
          tools.delete(id);
        }
      }
    }));
    store.add(toDisposable(() => {
      for (const tool of tools.values()) {
        tool.toolDispose.dispose();
        tool.implDispose.dispose();
      }
    }));
  }
  _updateCollectedServers() {
    const definitions = this._mcpRegistry.collections.get().flatMap(
      (collectionDefinition) => collectionDefinition.serverDefinitions.get().map((serverDefinition) => ({
        serverDefinition,
        collectionDefinition
      }))
    );
    const nextDefinitions = new Set(definitions);
    const currentServers = this._servers.get();
    const nextServers = [];
    const pushMatch = (match, rec) => {
      nextDefinitions.delete(match);
      nextServers.push(rec);
      const connection = rec.object.connection.get();
      if (connection && !McpServerDefinition.equals(connection.definition, match.serverDefinition)) {
        rec.object.stop();
        this._logService.debug(`MCP server ${rec.object.definition.id} stopped because the definition changed`);
      }
    };
    for (const server of currentServers) {
      const match = definitions.find((d) => defsEqual(server.object, d));
      if (match) {
        pushMatch(match, server);
      } else {
        server.dispose();
      }
    }
    for (const def of nextDefinitions) {
      const store = new DisposableStore();
      const object = this._instantiationService.createInstance(
        McpServer,
        def.collectionDefinition,
        def.serverDefinition,
        def.serverDefinition.roots,
        !!def.collectionDefinition.lazy,
        def.collectionDefinition.scope === StorageScope.WORKSPACE ? this.workspaceCache : this.userCache
      );
      store.add(object);
      this._syncTools(object, store);
      nextServers.push({ object, dispose: () => store.dispose() });
    }
    transaction((tx) => {
      this._servers.set(nextServers, tx);
    });
  }
  dispose() {
    this._servers.get().forEach((s) => s.dispose());
    super.dispose();
  }
};
McpService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, ILanguageModelToolsService),
  __decorateParam(3, ILogService)
], McpService);
function defsEqual(server, def) {
  return server.collection.id === def.collectionDefinition.id && server.definition.id === def.serverDefinition.id;
}
let McpToolImplementation = class {
  constructor(_tool, _server, _productService) {
    this._tool = _tool;
    this._server = _server;
    this._productService = _productService;
  }
  async prepareToolInvocation(parameters) {
    const tool = this._tool;
    const server = this._server;
    const mcpToolWarning = localize(
      "mcp.tool.warning",
      "{0} This tool is from '{1}' (MCP Server). Note that MCP servers or malicious conversation content may attempt to misuse '{2}' through tools. Please carefully review any requested actions.",
      "$(info)",
      server.definition.label,
      this._productService.nameShort
    );
    return {
      confirmationMessages: {
        title: localize("msg.title", "Run `{0}`", tool.definition.name, server.definition.label),
        message: new MarkdownString(localize("msg.msg", "{0}\n\n {1}", tool.definition.description, mcpToolWarning), { supportThemeIcons: true }),
        allowAutoConfirm: true
      },
      invocationMessage: new MarkdownString(localize("msg.run", "Running `{0}`", tool.definition.name, server.definition.label)),
      pastTenseMessage: new MarkdownString(localize("msg.ran", "Ran `{0}` ", tool.definition.name, server.definition.label)),
      toolSpecificData: {
        kind: "input",
        rawInput: parameters
      }
    };
  }
  async invoke(invocation, _countTokens, token) {
    const result = {
      content: []
    };
    const outputParts = [];
    const callResult = await this._tool.call(invocation.parameters, token);
    for (const item of callResult.content) {
      if (item.type === "text") {
        result.content.push({
          kind: "text",
          value: item.text
        });
        outputParts.push(item.text);
      } else {
      }
    }
    result.toolResultDetails = {
      input: JSON.stringify(invocation.parameters, void 0, 2),
      output: outputParts.join("\n")
    };
    return result;
  }
};
McpToolImplementation = __decorateClass([
  __decorateParam(2, IProductService)
], McpToolImplementation);
export {
  McpService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgSVJlZmVyZW5jZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgSU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZSwgdHJhbnNhY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTdG9yYWdlU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IENvdW50VG9rZW5zQ2FsbGJhY2ssIElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLCBJUHJlcGFyZWRUb29sSW52b2NhdGlvbiwgSVRvb2xEYXRhLCBJVG9vbEltcGwsIElUb29sSW52b2NhdGlvbiwgSVRvb2xSZXN1bHQgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNY3BSZWdpc3RyeSB9IGZyb20gJy4vbWNwUmVnaXN0cnlUeXBlcy5qcyc7XG5pbXBvcnQgeyBNY3BTZXJ2ZXIsIE1jcFNlcnZlck1ldGFkYXRhQ2FjaGUgfSBmcm9tICcuL21jcFNlcnZlci5qcyc7XG5pbXBvcnQgeyBJTWNwU2VydmVyLCBJTWNwU2VydmljZSwgSU1jcFRvb2wsIE1jcENvbGxlY3Rpb25EZWZpbml0aW9uLCBNY3BTZXJ2ZXJEZWZpbml0aW9uLCBNY3BTZXJ2ZXJUb29sc1N0YXRlIH0gZnJvbSAnLi9tY3BUeXBlcy5qcyc7XG5cbmludGVyZmFjZSBJU3luY2VkVG9vbERhdGEge1xuXHR0b29sRGF0YTogSVRvb2xEYXRhO1xuXHR0b29sRGlzcG9zZTogSURpc3Bvc2FibGU7XG5cdGltcGxEaXNwb3NlOiBJRGlzcG9zYWJsZTtcbn1cblxudHlwZSBJTWNwU2VydmVyUmVjID0gSVJlZmVyZW5jZTxJTWNwU2VydmVyPjtcblxuZXhwb3J0IGNsYXNzIE1jcFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU1jcFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlcnZlcnMgPSBvYnNlcnZhYmxlVmFsdWU8cmVhZG9ubHkgSU1jcFNlcnZlclJlY1tdPih0aGlzLCBbXSk7XG5cdHB1YmxpYyByZWFkb25seSBzZXJ2ZXJzOiBJT2JzZXJ2YWJsZTxyZWFkb25seSBJTWNwU2VydmVyW10+ID0gdGhpcy5fc2VydmVycy5tYXAoc2VydmVycyA9PiBzZXJ2ZXJzLm1hcChzID0+IHMub2JqZWN0KSk7XG5cblx0cHVibGljIGdldCBsYXp5Q29sbGVjdGlvblN0YXRlKCkgeyByZXR1cm4gdGhpcy5fbWNwUmVnaXN0cnkubGF6eUNvbGxlY3Rpb25TdGF0ZTsgfVxuXG5cdHByb3RlY3RlZCByZWFkb25seSB1c2VyQ2FjaGU6IE1jcFNlcnZlck1ldGFkYXRhQ2FjaGU7XG5cdHByb3RlY3RlZCByZWFkb25seSB3b3Jrc3BhY2VDYWNoZTogTWNwU2VydmVyTWV0YWRhdGFDYWNoZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElNY3BSZWdpc3RyeSBwcml2YXRlIHJlYWRvbmx5IF9tY3BSZWdpc3RyeTogSU1jcFJlZ2lzdHJ5LFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90b29sc1NlcnZpY2U6IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMudXNlckNhY2hlID0gdGhpcy5fcmVnaXN0ZXIoX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1jcFNlcnZlck1ldGFkYXRhQ2FjaGUsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKSk7XG5cdFx0dGhpcy53b3Jrc3BhY2VDYWNoZSA9IHRoaXMuX3JlZ2lzdGVyKF9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNY3BTZXJ2ZXJNZXRhZGF0YUNhY2hlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKSk7XG5cblx0XHRjb25zdCB1cGRhdGVUaHJvdHRsZSA9IHRoaXMuX3N0b3JlLmFkZChuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLl91cGRhdGVDb2xsZWN0ZWRTZXJ2ZXJzKCksIDUwMCkpO1xuXG5cdFx0Ly8gVGhyb3R0bGUgY2hhbmdlcyBzbyB0aGF0IGlmIGEgY29sbGVjdGlvbiBpcyBjaGFuZ2VkLCBvciBhIHNlcnZlciBpc1xuXHRcdC8vIHVucmVnaXN0ZXJlZC9yZWdpc3RlcmVkLCB3ZSBkb24ndCBzdG9wIHNlcnZlcnMgdW5uZWNlc3NhcmlseS5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGNvbGxlY3Rpb24gb2YgdGhpcy5fbWNwUmVnaXN0cnkuY29sbGVjdGlvbnMucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdGNvbGxlY3Rpb24uc2VydmVyRGVmaW5pdGlvbnMucmVhZChyZWFkZXIpO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlVGhyb3R0bGUuc2NoZWR1bGUoNTAwKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgcmVzZXRDYWNoZXMoKTogdm9pZCB7XG5cdFx0dGhpcy51c2VyQ2FjaGUucmVzZXQoKTtcblx0XHR0aGlzLndvcmtzcGFjZUNhY2hlLnJlc2V0KCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgYWN0aXZhdGVDb2xsZWN0aW9ucygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb2xsZWN0aW9ucyA9IGF3YWl0IHRoaXMuX21jcFJlZ2lzdHJ5LmRpc2NvdmVyQ29sbGVjdGlvbnMoKTtcblx0XHRjb25zdCBjb2xsZWN0aW9uSWRzID0gbmV3IFNldChjb2xsZWN0aW9ucy5tYXAoYyA9PiBjLmlkKSk7XG5cblx0XHR0aGlzLl91cGRhdGVDb2xsZWN0ZWRTZXJ2ZXJzKCk7XG5cblx0XHQvLyBEaXNjb3ZlciBhbnkgbmV3bHktY29sbGVjdGVkIHNlcnZlcnMgd2l0aCB1bmtub3duIHRvb2xzXG5cdFx0Y29uc3QgdG9kbzogUHJvbWlzZTx1bmtub3duPltdID0gW107XG5cdFx0Zm9yIChjb25zdCB7IG9iamVjdDogc2VydmVyIH0gb2YgdGhpcy5fc2VydmVycy5nZXQoKSkge1xuXHRcdFx0aWYgKGNvbGxlY3Rpb25JZHMuaGFzKHNlcnZlci5jb2xsZWN0aW9uLmlkKSkge1xuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IHNlcnZlci50b29sc1N0YXRlLmdldCgpO1xuXHRcdFx0XHRpZiAoc3RhdGUgPT09IE1jcFNlcnZlclRvb2xzU3RhdGUuVW5rbm93bikge1xuXHRcdFx0XHRcdHRvZG8ucHVzaChzZXJ2ZXIuc3RhcnQoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbCh0b2RvKTtcblx0fVxuXG5cdHByaXZhdGUgX3N5bmNUb29scyhzZXJ2ZXI6IE1jcFNlcnZlciwgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSkge1xuXHRcdGNvbnN0IHRvb2xzID0gbmV3IE1hcDwvKiB0b29sIElEICovc3RyaW5nLCBJU3luY2VkVG9vbERhdGE+KCk7XG5cblx0XHRzdG9yZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgdG9EZWxldGUgPSBuZXcgU2V0KHRvb2xzLmtleXMoKSk7XG5cdFx0XHRmb3IgKGNvbnN0IHRvb2wgb2Ygc2VydmVyLnRvb2xzLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0XHRjb25zdCBleGlzdGluZyA9IHRvb2xzLmdldCh0b29sLmlkKTtcblx0XHRcdFx0Y29uc3QgY29sbGVjdGlvbiA9IHRoaXMuX21jcFJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpLmZpbmQoYyA9PiBjLmlkID09PSBzZXJ2ZXIuY29sbGVjdGlvbi5pZCk7XG5cdFx0XHRcdGNvbnN0IHRvb2xEYXRhOiBJVG9vbERhdGEgPSB7XG5cdFx0XHRcdFx0aWQ6IHRvb2wuaWQsXG5cdFx0XHRcdFx0c291cmNlOiB7IHR5cGU6ICdtY3AnLCBjb2xsZWN0aW9uSWQ6IHNlcnZlci5jb2xsZWN0aW9uLmlkLCBkZWZpbml0aW9uSWQ6IHNlcnZlci5kZWZpbml0aW9uLmlkIH0sXG5cdFx0XHRcdFx0aWNvbjogQ29kaWNvbi50b29scyxcblx0XHRcdFx0XHRkaXNwbGF5TmFtZTogdG9vbC5kZWZpbml0aW9uLm5hbWUsXG5cdFx0XHRcdFx0dG9vbFJlZmVyZW5jZU5hbWU6IHRvb2wuZGVmaW5pdGlvbi5uYW1lLFxuXHRcdFx0XHRcdG1vZGVsRGVzY3JpcHRpb246IHRvb2wuZGVmaW5pdGlvbi5kZXNjcmlwdGlvbiA/PyAnJyxcblx0XHRcdFx0XHR1c2VyRGVzY3JpcHRpb246IHRvb2wuZGVmaW5pdGlvbi5kZXNjcmlwdGlvbiA/PyAnJyxcblx0XHRcdFx0XHRpbnB1dFNjaGVtYTogdG9vbC5kZWZpbml0aW9uLmlucHV0U2NoZW1hLFxuXHRcdFx0XHRcdGNhbkJlUmVmZXJlbmNlZEluUHJvbXB0OiB0cnVlLFxuXHRcdFx0XHRcdHN1cHBvcnRzVG9vbFBpY2tlcjogdHJ1ZSxcblx0XHRcdFx0XHRydW5zSW5Xb3Jrc3BhY2U6IGNvbGxlY3Rpb24/LnNjb3BlID09PSBTdG9yYWdlU2NvcGUuV09SS1NQQUNFIHx8ICEhY29sbGVjdGlvbj8ucmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0XHRcdHRhZ3M6IFsnbWNwJ10sXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRcdFx0aWYgKCFlcXVhbHMoZXhpc3RpbmcudG9vbERhdGEsIHRvb2xEYXRhKSkge1xuXHRcdFx0XHRcdFx0ZXhpc3RpbmcudG9vbERhdGEgPSB0b29sRGF0YTtcblx0XHRcdFx0XHRcdGV4aXN0aW5nLnRvb2xEaXNwb3NlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdGV4aXN0aW5nLnRvb2xEaXNwb3NlID0gdGhpcy5fdG9vbHNTZXJ2aWNlLnJlZ2lzdGVyVG9vbERhdGEodG9vbERhdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0b0RlbGV0ZS5kZWxldGUodG9vbC5pZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dG9vbHMuc2V0KHRvb2wuaWQsIHtcblx0XHRcdFx0XHRcdHRvb2xEYXRhLFxuXHRcdFx0XHRcdFx0dG9vbERpc3Bvc2U6IHRoaXMuX3Rvb2xzU2VydmljZS5yZWdpc3RlclRvb2xEYXRhKHRvb2xEYXRhKSxcblx0XHRcdFx0XHRcdGltcGxEaXNwb3NlOiB0aGlzLl90b29sc1NlcnZpY2UucmVnaXN0ZXJUb29sSW1wbGVtZW50YXRpb24odG9vbC5pZCwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWNwVG9vbEltcGxlbWVudGF0aW9uLCB0b29sLCBzZXJ2ZXIpKSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIHRvRGVsZXRlKSB7XG5cdFx0XHRcdGNvbnN0IHRvb2wgPSB0b29scy5nZXQoaWQpO1xuXHRcdFx0XHRpZiAodG9vbCkge1xuXHRcdFx0XHRcdHRvb2wudG9vbERpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRvb2wuaW1wbERpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRvb2xzLmRlbGV0ZShpZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGZvciAoY29uc3QgdG9vbCBvZiB0b29scy52YWx1ZXMoKSkge1xuXHRcdFx0XHR0b29sLnRvb2xEaXNwb3NlLmRpc3Bvc2UoKTtcblx0XHRcdFx0dG9vbC5pbXBsRGlzcG9zZS5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQ29sbGVjdGVkU2VydmVycygpIHtcblx0XHRjb25zdCBkZWZpbml0aW9ucyA9IHRoaXMuX21jcFJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpLmZsYXRNYXAoY29sbGVjdGlvbkRlZmluaXRpb24gPT5cblx0XHRcdGNvbGxlY3Rpb25EZWZpbml0aW9uLnNlcnZlckRlZmluaXRpb25zLmdldCgpLm1hcChzZXJ2ZXJEZWZpbml0aW9uID0+ICh7XG5cdFx0XHRcdHNlcnZlckRlZmluaXRpb24sXG5cdFx0XHRcdGNvbGxlY3Rpb25EZWZpbml0aW9uLFxuXHRcdFx0fSkpXG5cdFx0KTtcblxuXHRcdGNvbnN0IG5leHREZWZpbml0aW9ucyA9IG5ldyBTZXQoZGVmaW5pdGlvbnMpO1xuXHRcdGNvbnN0IGN1cnJlbnRTZXJ2ZXJzID0gdGhpcy5fc2VydmVycy5nZXQoKTtcblx0XHRjb25zdCBuZXh0U2VydmVyczogSU1jcFNlcnZlclJlY1tdID0gW107XG5cdFx0Y29uc3QgcHVzaE1hdGNoID0gKG1hdGNoOiAodHlwZW9mIGRlZmluaXRpb25zKVswXSwgcmVjOiBJTWNwU2VydmVyUmVjKSA9PiB7XG5cdFx0XHRuZXh0RGVmaW5pdGlvbnMuZGVsZXRlKG1hdGNoKTtcblx0XHRcdG5leHRTZXJ2ZXJzLnB1c2gocmVjKTtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24gPSByZWMub2JqZWN0LmNvbm5lY3Rpb24uZ2V0KCk7XG5cdFx0XHQvLyBpZiB0aGUgZGVmaW5pdGlvbiB3YXMgbW9kaWZpZWQsIHN0b3AgdGhlIHNlcnZlcjsgaXQnbGwgYmUgcmVzdGFydGVkIGFnYWluIG9uLWRlbWFuZFxuXHRcdFx0aWYgKGNvbm5lY3Rpb24gJiYgIU1jcFNlcnZlckRlZmluaXRpb24uZXF1YWxzKGNvbm5lY3Rpb24uZGVmaW5pdGlvbiwgbWF0Y2guc2VydmVyRGVmaW5pdGlvbikpIHtcblx0XHRcdFx0cmVjLm9iamVjdC5zdG9wKCk7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYE1DUCBzZXJ2ZXIgJHtyZWMub2JqZWN0LmRlZmluaXRpb24uaWR9IHN0b3BwZWQgYmVjYXVzZSB0aGUgZGVmaW5pdGlvbiBjaGFuZ2VkYCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIFRyYW5zZmVyIG92ZXIgYW55IHNlcnZlcnMgdGhhdCBhcmUgc3RpbGwgdmFsaWQuXG5cdFx0Zm9yIChjb25zdCBzZXJ2ZXIgb2YgY3VycmVudFNlcnZlcnMpIHtcblx0XHRcdGNvbnN0IG1hdGNoID0gZGVmaW5pdGlvbnMuZmluZChkID0+IGRlZnNFcXVhbChzZXJ2ZXIub2JqZWN0LCBkKSk7XG5cdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0cHVzaE1hdGNoKG1hdGNoLCBzZXJ2ZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2VydmVyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgYW55IG5ldyBzZXJ2ZXJzIHRoYXQgYXJlIG5lZWRlZC5cblx0XHRmb3IgKGNvbnN0IGRlZiBvZiBuZXh0RGVmaW5pdGlvbnMpIHtcblx0XHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3Qgb2JqZWN0ID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdE1jcFNlcnZlcixcblx0XHRcdFx0ZGVmLmNvbGxlY3Rpb25EZWZpbml0aW9uLFxuXHRcdFx0XHRkZWYuc2VydmVyRGVmaW5pdGlvbixcblx0XHRcdFx0ZGVmLnNlcnZlckRlZmluaXRpb24ucm9vdHMsXG5cdFx0XHRcdCEhZGVmLmNvbGxlY3Rpb25EZWZpbml0aW9uLmxhenksXG5cdFx0XHRcdGRlZi5jb2xsZWN0aW9uRGVmaW5pdGlvbi5zY29wZSA9PT0gU3RvcmFnZVNjb3BlLldPUktTUEFDRSA/IHRoaXMud29ya3NwYWNlQ2FjaGUgOiB0aGlzLnVzZXJDYWNoZSxcblx0XHRcdCk7XG5cdFx0XHRzdG9yZS5hZGQob2JqZWN0KTtcblx0XHRcdHRoaXMuX3N5bmNUb29scyhvYmplY3QsIHN0b3JlKTtcblxuXHRcdFx0bmV4dFNlcnZlcnMucHVzaCh7IG9iamVjdCwgZGlzcG9zZTogKCkgPT4gc3RvcmUuZGlzcG9zZSgpIH0pO1xuXHRcdH1cblxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMuX3NlcnZlcnMuc2V0KG5leHRTZXJ2ZXJzLCB0eCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXJ2ZXJzLmdldCgpLmZvckVhY2gocyA9PiBzLmRpc3Bvc2UoKSk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGRlZnNFcXVhbChzZXJ2ZXI6IElNY3BTZXJ2ZXIsIGRlZjogeyBzZXJ2ZXJEZWZpbml0aW9uOiBNY3BTZXJ2ZXJEZWZpbml0aW9uOyBjb2xsZWN0aW9uRGVmaW5pdGlvbjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gfSkge1xuXHRyZXR1cm4gc2VydmVyLmNvbGxlY3Rpb24uaWQgPT09IGRlZi5jb2xsZWN0aW9uRGVmaW5pdGlvbi5pZCAmJiBzZXJ2ZXIuZGVmaW5pdGlvbi5pZCA9PT0gZGVmLnNlcnZlckRlZmluaXRpb24uaWQ7XG59XG5cbmNsYXNzIE1jcFRvb2xJbXBsZW1lbnRhdGlvbiBpbXBsZW1lbnRzIElUb29sSW1wbCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rvb2w6IElNY3BUb29sLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3NlcnZlcjogSU1jcFNlcnZlcixcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJlcGFyZVRvb2xJbnZvY2F0aW9uKHBhcmFtZXRlcnM6IGFueSk6IFByb21pc2U8SVByZXBhcmVkVG9vbEludm9jYXRpb24+IHtcblx0XHRjb25zdCB0b29sID0gdGhpcy5fdG9vbDtcblx0XHRjb25zdCBzZXJ2ZXIgPSB0aGlzLl9zZXJ2ZXI7XG5cblx0XHRjb25zdCBtY3BUb29sV2FybmluZyA9IGxvY2FsaXplKFxuXHRcdFx0J21jcC50b29sLndhcm5pbmcnLFxuXHRcdFx0XCJ7MH0gVGhpcyB0b29sIGlzIGZyb20gXFwnezF9XFwnIChNQ1AgU2VydmVyKS4gTm90ZSB0aGF0IE1DUCBzZXJ2ZXJzIG9yIG1hbGljaW91cyBjb252ZXJzYXRpb24gY29udGVudCBtYXkgYXR0ZW1wdCB0byBtaXN1c2UgJ3syfScgdGhyb3VnaCB0b29scy4gUGxlYXNlIGNhcmVmdWxseSByZXZpZXcgYW55IHJlcXVlc3RlZCBhY3Rpb25zLlwiLFxuXHRcdFx0JyQoaW5mbyknLFxuXHRcdFx0c2VydmVyLmRlZmluaXRpb24ubGFiZWwsXG5cdFx0XHR0aGlzLl9wcm9kdWN0U2VydmljZS5uYW1lU2hvcnRcblx0XHQpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvbmZpcm1hdGlvbk1lc3NhZ2VzOiB7XG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbXNnLnRpdGxlJywgXCJSdW4gYHswfWBcIiwgdG9vbC5kZWZpbml0aW9uLm5hbWUsIHNlcnZlci5kZWZpbml0aW9uLmxhYmVsKSxcblx0XHRcdFx0bWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdtc2cubXNnJywgXCJ7MH1cXG5cXG4gezF9XCIsIHRvb2wuZGVmaW5pdGlvbi5kZXNjcmlwdGlvbiwgbWNwVG9vbFdhcm5pbmcpLCB7IHN1cHBvcnRUaGVtZUljb25zOiB0cnVlIH0pLFxuXHRcdFx0XHRhbGxvd0F1dG9Db25maXJtOiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdGludm9jYXRpb25NZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcobG9jYWxpemUoJ21zZy5ydW4nLCBcIlJ1bm5pbmcgYHswfWBcIiwgdG9vbC5kZWZpbml0aW9uLm5hbWUsIHNlcnZlci5kZWZpbml0aW9uLmxhYmVsKSksXG5cdFx0XHRwYXN0VGVuc2VNZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcobG9jYWxpemUoJ21zZy5yYW4nLCBcIlJhbiBgezB9YCBcIiwgdG9vbC5kZWZpbml0aW9uLm5hbWUsIHNlcnZlci5kZWZpbml0aW9uLmxhYmVsKSksXG5cdFx0XHR0b29sU3BlY2lmaWNEYXRhOiB7XG5cdFx0XHRcdGtpbmQ6ICdpbnB1dCcsXG5cdFx0XHRcdHJhd0lucHV0OiBwYXJhbWV0ZXJzXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIGludm9rZShpbnZvY2F0aW9uOiBJVG9vbEludm9jYXRpb24sIF9jb3VudFRva2VuczogQ291bnRUb2tlbnNDYWxsYmFjaywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cblx0XHRjb25zdCByZXN1bHQ6IElUb29sUmVzdWx0ID0ge1xuXHRcdFx0Y29udGVudDogW11cblx0XHR9O1xuXG5cdFx0Y29uc3Qgb3V0cHV0UGFydHM6IHN0cmluZ1tdID0gW107XG5cblx0XHRjb25zdCBjYWxsUmVzdWx0ID0gYXdhaXQgdGhpcy5fdG9vbC5jYWxsKGludm9jYXRpb24ucGFyYW1ldGVycyBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+LCB0b2tlbik7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGNhbGxSZXN1bHQuY29udGVudCkge1xuXHRcdFx0aWYgKGl0ZW0udHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHRcdHJlc3VsdC5jb250ZW50LnB1c2goe1xuXHRcdFx0XHRcdGtpbmQ6ICd0ZXh0Jyxcblx0XHRcdFx0XHR2YWx1ZTogaXRlbS50ZXh0XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdG91dHB1dFBhcnRzLnB1c2goaXRlbS50ZXh0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFRPRE9AanJpZWtlbiBoYW5kbGUgZGlmZmVyZW50IGl0ZW0gdHlwZXNcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXN1bHQudG9vbFJlc3VsdERldGFpbHMgPSB7XG5cdFx0XHRpbnB1dDogSlNPTi5zdHJpbmdpZnkoaW52b2NhdGlvbi5wYXJhbWV0ZXJzLCB1bmRlZmluZWQsIDIpLFxuXHRcdFx0b3V0cHV0OiBvdXRwdXRQYXJ0cy5qb2luKCdcXG4nKVxuXHRcdH07XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFlBQVksaUJBQTBDLG9CQUFvQjtBQUNuRixTQUFTLGNBQWM7QUFDdkIsU0FBUyxTQUFzQixpQkFBaUIsbUJBQW1CO0FBQ25FLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQThCLGtDQUErRztBQUM3SSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFdBQVcsOEJBQThCO0FBQ2xELFNBQXFFLHFCQUFxQiwyQkFBMkI7QUFVOUcsSUFBTSxhQUFOLGNBQXlCLFdBQWtDO0FBQUEsRUFZakUsWUFDeUMsdUJBQ1QsY0FDYyxlQUNmLGFBQzdCO0FBQ0QsVUFBTTtBQUxrQztBQUNUO0FBQ2M7QUFDZjtBQVovQixTQUFpQixXQUFXLGdCQUEwQyxNQUFNLENBQUMsQ0FBQztBQUM5RSxTQUFnQixVQUE4QyxLQUFLLFNBQVMsSUFBSSxhQUFXLFFBQVEsSUFBSSxPQUFLLEVBQUUsTUFBTSxDQUFDO0FBZXBILFNBQUssWUFBWSxLQUFLLFVBQVUsc0JBQXNCLGVBQWUsd0JBQXdCLGFBQWEsT0FBTyxDQUFDO0FBQ2xILFNBQUssaUJBQWlCLEtBQUssVUFBVSxzQkFBc0IsZUFBZSx3QkFBd0IsYUFBYSxTQUFTLENBQUM7QUFFekgsVUFBTSxpQkFBaUIsS0FBSyxPQUFPLElBQUksSUFBSSxpQkFBaUIsTUFBTSxLQUFLLHdCQUF3QixHQUFHLEdBQUcsQ0FBQztBQUl0RyxTQUFLLFVBQVUsUUFBUSxZQUFVO0FBQ2hDLGlCQUFXLGNBQWMsS0FBSyxhQUFhLFlBQVksS0FBSyxNQUFNLEdBQUc7QUFDcEUsbUJBQVcsa0JBQWtCLEtBQUssTUFBTTtBQUFBLE1BQ3pDO0FBQ0EscUJBQWUsU0FBUyxHQUFHO0FBQUEsSUFDNUIsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBMUJBLElBQVcsc0JBQXNCO0FBQUUsV0FBTyxLQUFLLGFBQWE7QUFBQSxFQUFxQjtBQUFBLEVBNEIxRSxjQUFvQjtBQUMxQixTQUFLLFVBQVUsTUFBTTtBQUNyQixTQUFLLGVBQWUsTUFBTTtBQUFBLEVBQzNCO0FBQUEsRUFFQSxNQUFhLHNCQUFxQztBQUNqRCxVQUFNLGNBQWMsTUFBTSxLQUFLLGFBQWEsb0JBQW9CO0FBQ2hFLFVBQU0sZ0JBQWdCLElBQUksSUFBSSxZQUFZLElBQUksT0FBSyxFQUFFLEVBQUUsQ0FBQztBQUV4RCxTQUFLLHdCQUF3QjtBQUc3QixVQUFNLE9BQTJCLENBQUM7QUFDbEMsZUFBVyxFQUFFLFFBQVEsT0FBTyxLQUFLLEtBQUssU0FBUyxJQUFJLEdBQUc7QUFDckQsVUFBSSxjQUFjLElBQUksT0FBTyxXQUFXLEVBQUUsR0FBRztBQUM1QyxjQUFNLFFBQVEsT0FBTyxXQUFXLElBQUk7QUFDcEMsWUFBSSxVQUFVLG9CQUFvQixTQUFTO0FBQzFDLGVBQUssS0FBSyxPQUFPLE1BQU0sQ0FBQztBQUFBLFFBQ3pCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFFBQVEsSUFBSSxJQUFJO0FBQUEsRUFDdkI7QUFBQSxFQUVRLFdBQVcsUUFBbUIsT0FBd0I7QUFDN0QsVUFBTSxRQUFRLG9CQUFJLElBQTBDO0FBRTVELFVBQU0sSUFBSSxRQUFRLFlBQVU7QUFDM0IsWUFBTSxXQUFXLElBQUksSUFBSSxNQUFNLEtBQUssQ0FBQztBQUNyQyxpQkFBVyxRQUFRLE9BQU8sTUFBTSxLQUFLLE1BQU0sR0FBRztBQUM3QyxjQUFNLFdBQVcsTUFBTSxJQUFJLEtBQUssRUFBRTtBQUNsQyxjQUFNLGFBQWEsS0FBSyxhQUFhLFlBQVksSUFBSSxFQUFFLEtBQUssT0FBSyxFQUFFLE9BQU8sT0FBTyxXQUFXLEVBQUU7QUFDOUYsY0FBTSxXQUFzQjtBQUFBLFVBQzNCLElBQUksS0FBSztBQUFBLFVBQ1QsUUFBUSxFQUFFLE1BQU0sT0FBTyxjQUFjLE9BQU8sV0FBVyxJQUFJLGNBQWMsT0FBTyxXQUFXLEdBQUc7QUFBQSxVQUM5RixNQUFNLFFBQVE7QUFBQSxVQUNkLGFBQWEsS0FBSyxXQUFXO0FBQUEsVUFDN0IsbUJBQW1CLEtBQUssV0FBVztBQUFBLFVBQ25DLGtCQUFrQixLQUFLLFdBQVcsZUFBZTtBQUFBLFVBQ2pELGlCQUFpQixLQUFLLFdBQVcsZUFBZTtBQUFBLFVBQ2hELGFBQWEsS0FBSyxXQUFXO0FBQUEsVUFDN0IseUJBQXlCO0FBQUEsVUFDekIsb0JBQW9CO0FBQUEsVUFDcEIsaUJBQWlCLFlBQVksVUFBVSxhQUFhLGFBQWEsQ0FBQyxDQUFDLFlBQVk7QUFBQSxVQUMvRSxNQUFNLENBQUMsS0FBSztBQUFBLFFBQ2I7QUFFQSxZQUFJLFVBQVU7QUFDYixjQUFJLENBQUMsT0FBTyxTQUFTLFVBQVUsUUFBUSxHQUFHO0FBQ3pDLHFCQUFTLFdBQVc7QUFDcEIscUJBQVMsWUFBWSxRQUFRO0FBQzdCLHFCQUFTLGNBQWMsS0FBSyxjQUFjLGlCQUFpQixRQUFRO0FBQUEsVUFDcEU7QUFDQSxtQkFBUyxPQUFPLEtBQUssRUFBRTtBQUFBLFFBQ3hCLE9BQU87QUFDTixnQkFBTSxJQUFJLEtBQUssSUFBSTtBQUFBLFlBQ2xCO0FBQUEsWUFDQSxhQUFhLEtBQUssY0FBYyxpQkFBaUIsUUFBUTtBQUFBLFlBQ3pELGFBQWEsS0FBSyxjQUFjLDJCQUEyQixLQUFLLElBQUksS0FBSyxzQkFBc0IsZUFBZSx1QkFBdUIsTUFBTSxNQUFNLENBQUM7QUFBQSxVQUNuSixDQUFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Q7QUFFQSxpQkFBVyxNQUFNLFVBQVU7QUFDMUIsY0FBTSxPQUFPLE1BQU0sSUFBSSxFQUFFO0FBQ3pCLFlBQUksTUFBTTtBQUNULGVBQUssWUFBWSxRQUFRO0FBQ3pCLGVBQUssWUFBWSxRQUFRO0FBQ3pCLGdCQUFNLE9BQU8sRUFBRTtBQUFBLFFBQ2hCO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxJQUFJLGFBQWEsTUFBTTtBQUM1QixpQkFBVyxRQUFRLE1BQU0sT0FBTyxHQUFHO0FBQ2xDLGFBQUssWUFBWSxRQUFRO0FBQ3pCLGFBQUssWUFBWSxRQUFRO0FBQUEsTUFDMUI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLDBCQUEwQjtBQUNqQyxVQUFNLGNBQWMsS0FBSyxhQUFhLFlBQVksSUFBSSxFQUFFO0FBQUEsTUFBUSwwQkFDL0QscUJBQXFCLGtCQUFrQixJQUFJLEVBQUUsSUFBSSx1QkFBcUI7QUFBQSxRQUNyRTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUU7QUFBQSxJQUNIO0FBRUEsVUFBTSxrQkFBa0IsSUFBSSxJQUFJLFdBQVc7QUFDM0MsVUFBTSxpQkFBaUIsS0FBSyxTQUFTLElBQUk7QUFDekMsVUFBTSxjQUErQixDQUFDO0FBQ3RDLFVBQU0sWUFBWSxDQUFDLE9BQWdDLFFBQXVCO0FBQ3pFLHNCQUFnQixPQUFPLEtBQUs7QUFDNUIsa0JBQVksS0FBSyxHQUFHO0FBQ3BCLFlBQU0sYUFBYSxJQUFJLE9BQU8sV0FBVyxJQUFJO0FBRTdDLFVBQUksY0FBYyxDQUFDLG9CQUFvQixPQUFPLFdBQVcsWUFBWSxNQUFNLGdCQUFnQixHQUFHO0FBQzdGLFlBQUksT0FBTyxLQUFLO0FBQ2hCLGFBQUssWUFBWSxNQUFNLGNBQWMsSUFBSSxPQUFPLFdBQVcsRUFBRSx5Q0FBeUM7QUFBQSxNQUN2RztBQUFBLElBQ0Q7QUFHQSxlQUFXLFVBQVUsZ0JBQWdCO0FBQ3BDLFlBQU0sUUFBUSxZQUFZLEtBQUssT0FBSyxVQUFVLE9BQU8sUUFBUSxDQUFDLENBQUM7QUFDL0QsVUFBSSxPQUFPO0FBQ1Ysa0JBQVUsT0FBTyxNQUFNO0FBQUEsTUFDeEIsT0FBTztBQUNOLGVBQU8sUUFBUTtBQUFBLE1BQ2hCO0FBQUEsSUFDRDtBQUdBLGVBQVcsT0FBTyxpQkFBaUI7QUFDbEMsWUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFlBQU0sU0FBUyxLQUFLLHNCQUFzQjtBQUFBLFFBQ3pDO0FBQUEsUUFDQSxJQUFJO0FBQUEsUUFDSixJQUFJO0FBQUEsUUFDSixJQUFJLGlCQUFpQjtBQUFBLFFBQ3JCLENBQUMsQ0FBQyxJQUFJLHFCQUFxQjtBQUFBLFFBQzNCLElBQUkscUJBQXFCLFVBQVUsYUFBYSxZQUFZLEtBQUssaUJBQWlCLEtBQUs7QUFBQSxNQUN4RjtBQUNBLFlBQU0sSUFBSSxNQUFNO0FBQ2hCLFdBQUssV0FBVyxRQUFRLEtBQUs7QUFFN0Isa0JBQVksS0FBSyxFQUFFLFFBQVEsU0FBUyxNQUFNLE1BQU0sUUFBUSxFQUFFLENBQUM7QUFBQSxJQUM1RDtBQUVBLGdCQUFZLFFBQU07QUFDakIsV0FBSyxTQUFTLElBQUksYUFBYSxFQUFFO0FBQUEsSUFDbEMsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixTQUFLLFNBQVMsSUFBSSxFQUFFLFFBQVEsT0FBSyxFQUFFLFFBQVEsQ0FBQztBQUM1QyxVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQ0Q7QUEvS2EsYUFBTjtBQUFBLEVBYUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWhCVTtBQWlMYixTQUFTLFVBQVUsUUFBb0IsS0FBK0Y7QUFDckksU0FBTyxPQUFPLFdBQVcsT0FBTyxJQUFJLHFCQUFxQixNQUFNLE9BQU8sV0FBVyxPQUFPLElBQUksaUJBQWlCO0FBQzlHO0FBRUEsSUFBTSx3QkFBTixNQUFpRDtBQUFBLEVBQ2hELFlBQ2tCLE9BQ0EsU0FDaUIsaUJBQ2pDO0FBSGdCO0FBQ0E7QUFDaUI7QUFBQSxFQUMvQjtBQUFBLEVBRUosTUFBTSxzQkFBc0IsWUFBbUQ7QUFDOUUsVUFBTSxPQUFPLEtBQUs7QUFDbEIsVUFBTSxTQUFTLEtBQUs7QUFFcEIsVUFBTSxpQkFBaUI7QUFBQSxNQUN0QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxPQUFPLFdBQVc7QUFBQSxNQUNsQixLQUFLLGdCQUFnQjtBQUFBLElBQ3RCO0FBRUEsV0FBTztBQUFBLE1BQ04sc0JBQXNCO0FBQUEsUUFDckIsT0FBTyxTQUFTLGFBQWEsYUFBYSxLQUFLLFdBQVcsTUFBTSxPQUFPLFdBQVcsS0FBSztBQUFBLFFBQ3ZGLFNBQVMsSUFBSSxlQUFlLFNBQVMsV0FBVyxlQUFlLEtBQUssV0FBVyxhQUFhLGNBQWMsR0FBRyxFQUFFLG1CQUFtQixLQUFLLENBQUM7QUFBQSxRQUN4SSxrQkFBa0I7QUFBQSxNQUNuQjtBQUFBLE1BQ0EsbUJBQW1CLElBQUksZUFBZSxTQUFTLFdBQVcsaUJBQWlCLEtBQUssV0FBVyxNQUFNLE9BQU8sV0FBVyxLQUFLLENBQUM7QUFBQSxNQUN6SCxrQkFBa0IsSUFBSSxlQUFlLFNBQVMsV0FBVyxjQUFjLEtBQUssV0FBVyxNQUFNLE9BQU8sV0FBVyxLQUFLLENBQUM7QUFBQSxNQUNySCxrQkFBa0I7QUFBQSxRQUNqQixNQUFNO0FBQUEsUUFDTixVQUFVO0FBQUEsTUFDWDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLE9BQU8sWUFBNkIsY0FBbUMsT0FBMEI7QUFFdEcsVUFBTSxTQUFzQjtBQUFBLE1BQzNCLFNBQVMsQ0FBQztBQUFBLElBQ1g7QUFFQSxVQUFNLGNBQXdCLENBQUM7QUFFL0IsVUFBTSxhQUFhLE1BQU0sS0FBSyxNQUFNLEtBQUssV0FBVyxZQUFtQyxLQUFLO0FBQzVGLGVBQVcsUUFBUSxXQUFXLFNBQVM7QUFDdEMsVUFBSSxLQUFLLFNBQVMsUUFBUTtBQUN6QixlQUFPLFFBQVEsS0FBSztBQUFBLFVBQ25CLE1BQU07QUFBQSxVQUNOLE9BQU8sS0FBSztBQUFBLFFBQ2IsQ0FBQztBQUVELG9CQUFZLEtBQUssS0FBSyxJQUFJO0FBQUEsTUFDM0IsT0FBTztBQUFBLE1BRVA7QUFBQSxJQUNEO0FBRUEsV0FBTyxvQkFBb0I7QUFBQSxNQUMxQixPQUFPLEtBQUssVUFBVSxXQUFXLFlBQVksUUFBVyxDQUFDO0FBQUEsTUFDekQsUUFBUSxZQUFZLEtBQUssSUFBSTtBQUFBLElBQzlCO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQS9ETSx3QkFBTjtBQUFBLEVBSUc7QUFBQSxHQUpHOyIsCiAgIm5hbWVzIjogW10KfQo=
