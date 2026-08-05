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
import { computeLevenshteinDistance } from "../../../../base/common/diff/diff.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { markdownCommandLink, MarkdownString } from "../../../../base/common/htmlContent.js";
import { findNodeAtLocation, parseTree } from "../../../../base/common/json.js";
import { Disposable, DisposableStore, dispose, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { localize } from "../../../../nls.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { ConfigurationResolverExpression } from "../../../services/configurationResolver/common/configurationResolverExpression.js";
import { IMcpConfigPathsService } from "../common/mcpConfigPathsService.js";
import { mcpConfigurationSection } from "../common/mcpConfiguration.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
import { IMcpService, McpConnectionState } from "../common/mcpTypes.js";
import { EditStoredInput, RemoveStoredInput, RestartServer, ShowOutput, StartServer, StopServer } from "./mcpCommands.js";
const diagnosticOwner = "vscode.mcp";
let McpLanguageFeatures = class extends Disposable {
  constructor(languageFeaturesService, _mcpRegistry, _mcpConfigPathsService, _mcpService, _markerService, _configurationResolverService) {
    super();
    this._mcpRegistry = _mcpRegistry;
    this._mcpConfigPathsService = _mcpConfigPathsService;
    this._mcpService = _mcpService;
    this._markerService = _markerService;
    this._configurationResolverService = _configurationResolverService;
    this._cachedMcpSection = this._register(new MutableDisposable());
    const patterns = [
      { pattern: "**/.vscode/mcp.json" },
      { pattern: "**/settings.json" },
      { pattern: "**/workspace.json" }
    ];
    const onDidChangeCodeLens = this._register(new Emitter());
    const codeLensProvider = {
      onDidChange: onDidChangeCodeLens.event,
      provideCodeLenses: (model, range) => this._provideCodeLenses(model, () => onDidChangeCodeLens.fire(codeLensProvider))
    };
    this._register(languageFeaturesService.codeLensProvider.register(patterns, codeLensProvider));
    this._register(languageFeaturesService.inlayHintsProvider.register(patterns, {
      onDidChangeInlayHints: _mcpRegistry.onDidChangeInputs,
      provideInlayHints: (model, range) => this._provideInlayHints(model, range)
    }));
  }
  /** Simple mechanism to avoid extra json parsing for hints+lenses */
  _parseModel(model) {
    if (this._cachedMcpSection.value?.model === model) {
      return this._cachedMcpSection.value;
    }
    const uri = model.uri;
    const inConfig = this._mcpConfigPathsService.paths.get().find((u) => isEqual(u.uri, uri));
    if (!inConfig) {
      return void 0;
    }
    const value = model.getValue();
    const tree = parseTree(value);
    const listeners = [
      model.onDidChangeContent(() => this._cachedMcpSection.clear()),
      model.onWillDispose(() => this._cachedMcpSection.clear())
    ];
    this._addDiagnostics(model, value, tree, inConfig);
    return this._cachedMcpSection.value = {
      model,
      tree,
      inConfig,
      dispose: () => {
        this._markerService.remove(diagnosticOwner, [uri]);
        dispose(listeners);
      }
    };
  }
  _addDiagnostics(tm, value, tree, inConfig) {
    const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, "servers"] : ["servers"]);
    if (!serversNode) {
      return;
    }
    const getClosestMatchingVariable = (name) => {
      let bestValue = "";
      let bestDistance = Infinity;
      for (const variable of this._configurationResolverService.resolvableVariables) {
        const distance = computeLevenshteinDistance(name, variable);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestValue = variable;
        }
      }
      return bestValue;
    };
    const diagnostics = [];
    forEachPropertyWithReplacement(serversNode, (node) => {
      const expr = ConfigurationResolverExpression.parse(node.value);
      for (const { id, name, arg } of expr.unresolved()) {
        if (!this._configurationResolverService.resolvableVariables.has(name)) {
          const position = value.indexOf(id, node.offset);
          if (position === -1) {
            continue;
          }
          const start = tm.getPositionAt(position);
          const end = tm.getPositionAt(position + id.length);
          diagnostics.push({
            severity: MarkerSeverity.Warning,
            message: localize("mcp.variableNotFound", "Variable `{0}` not found, did you mean ${{1}}?", name, getClosestMatchingVariable(name) + (arg ? `:${arg}` : "")),
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
            modelVersionId: tm.getVersionId()
          });
        }
      }
    });
    if (diagnostics.length) {
      this._markerService.changeOne(diagnosticOwner, tm.uri, diagnostics);
    } else {
      this._markerService.remove(diagnosticOwner, [tm.uri]);
    }
  }
  _provideCodeLenses(model, onDidChangeCodeLens) {
    const parsed = this._parseModel(model);
    if (!parsed) {
      return void 0;
    }
    const { tree, inConfig } = parsed;
    const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, "servers"] : ["servers"]);
    if (!serversNode) {
      return void 0;
    }
    const store = new DisposableStore();
    const lenses = { lenses: [], dispose: () => store.dispose() };
    const read = (observable) => {
      store.add(Event.fromObservableLight(observable)(onDidChangeCodeLens));
      return observable.get();
    };
    const collection = read(this._mcpRegistry.collections).find((c) => isEqual(c.presentation?.origin, model.uri));
    if (!collection) {
      return lenses;
    }
    const mcpServers = read(this._mcpService.servers).filter((s) => s.collection.id === collection.id);
    for (const node of serversNode.children || []) {
      if (node.type !== "property" || node.children?.[0]?.type !== "string") {
        continue;
      }
      const name = node.children[0].value;
      const server = mcpServers.find((s) => s.definition.label === name);
      if (!server) {
        continue;
      }
      const range = Range.fromPositions(model.getPositionAt(node.children[0].offset));
      switch (read(server.connectionState).state) {
        case McpConnectionState.Kind.Error:
          lenses.lenses.push({
            range,
            command: {
              id: ShowOutput.ID,
              title: "$(error) " + localize("server.error", "Error"),
              arguments: [server.definition.id]
            }
          }, {
            range,
            command: {
              id: RestartServer.ID,
              title: localize("mcp.restart", "Restart"),
              arguments: [server.definition.id]
            }
          });
          break;
        case McpConnectionState.Kind.Starting:
          lenses.lenses.push({
            range,
            command: {
              id: ShowOutput.ID,
              title: "$(loading~spin) " + localize("server.starting", "Starting"),
              arguments: [server.definition.id]
            }
          }, {
            range,
            command: {
              id: StopServer.ID,
              title: localize("cancel", "Cancel"),
              arguments: [server.definition.id]
            }
          });
          break;
        case McpConnectionState.Kind.Running:
          lenses.lenses.push({
            range,
            command: {
              id: ShowOutput.ID,
              title: "$(check) " + localize("server.running", "Running"),
              arguments: [server.definition.id]
            }
          }, {
            range,
            command: {
              id: StopServer.ID,
              title: localize("mcp.stop", "Stop"),
              arguments: [server.definition.id]
            }
          }, {
            range,
            command: {
              id: RestartServer.ID,
              title: localize("mcp.restart", "Restart"),
              arguments: [server.definition.id]
            }
          }, {
            range,
            command: {
              id: "",
              title: localize("server.toolCount", "{0} tools", read(server.tools).length)
            }
          });
          break;
        case McpConnectionState.Kind.Stopped: {
          lenses.lenses.push({
            range,
            command: {
              id: StartServer.ID,
              title: "$(debug-start) " + localize("mcp.start", "Start"),
              arguments: [server.definition.id]
            }
          });
          const toolCount = read(server.tools).length;
          if (toolCount) {
            lenses.lenses.push({
              range,
              command: {
                id: "",
                title: localize("server.toolCountCached", "{0} cached tools", toolCount)
              }
            });
          }
        }
      }
    }
    return lenses;
  }
  async _provideInlayHints(model, range) {
    const parsed = this._parseModel(model);
    if (!parsed) {
      return void 0;
    }
    const { tree, inConfig } = parsed;
    const mcpSection = inConfig.section ? findNodeAtLocation(tree, [...inConfig.section]) : tree;
    if (!mcpSection) {
      return void 0;
    }
    const inputsNode = findNodeAtLocation(mcpSection, ["inputs"]);
    if (!inputsNode) {
      return void 0;
    }
    const inputs = await this._mcpRegistry.getSavedInputs(inConfig.scope);
    const hints = [];
    const serversNode = findNodeAtLocation(mcpSection, ["servers"]);
    if (serversNode) {
      annotateServers(serversNode);
    }
    annotateInputs(inputsNode);
    return { hints, dispose: () => {
    } };
    function annotateServers(servers) {
      forEachPropertyWithReplacement(servers, (node) => {
        const expr = ConfigurationResolverExpression.parse(node.value);
        for (const { id } of expr.unresolved()) {
          const saved = inputs[id];
          if (saved) {
            pushAnnotation(id, node.offset + node.value.indexOf(id) + id.length, saved);
          }
        }
      });
    }
    function annotateInputs(node) {
      if (node.type !== "array" || !node.children) {
        return;
      }
      for (const input of node.children) {
        if (input.type !== "object" || !input.children) {
          continue;
        }
        const idProp = input.children.find((c) => c.type === "property" && c.children?.[0].value === "id");
        if (!idProp) {
          continue;
        }
        const id = idProp.children[1];
        if (!id || id.type !== "string" || !id.value) {
          continue;
        }
        const savedId = "${input:" + id.value + "}";
        const saved = inputs[savedId];
        if (saved) {
          pushAnnotation(savedId, id.offset + 1 + id.length, saved);
        }
      }
    }
    function pushAnnotation(savedId, offset, saved) {
      const tooltip = new MarkdownString([
        markdownCommandLink({ id: EditStoredInput.ID, title: localize("edit", "Edit"), arguments: [savedId, model.uri, mcpConfigurationSection, inConfig.target] }),
        markdownCommandLink({ id: RemoveStoredInput.ID, title: localize("clear", "Clear"), arguments: [inConfig.scope, savedId] }),
        markdownCommandLink({ id: RemoveStoredInput.ID, title: localize("clearAll", "Clear All"), arguments: [inConfig.scope] })
      ].join(" | "), { isTrusted: true });
      const hint = {
        label: "= " + (saved.input?.type === "promptString" && saved.input.password ? "*".repeat(10) : saved.value || ""),
        position: model.getPositionAt(offset),
        tooltip,
        paddingLeft: true
      };
      hints.push(hint);
      return hint;
    }
  }
};
McpLanguageFeatures = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, IMcpConfigPathsService),
  __decorateParam(3, IMcpService),
  __decorateParam(4, IMarkerService),
  __decorateParam(5, IConfigurationResolverService)
], McpLanguageFeatures);
function forEachPropertyWithReplacement(node, callback) {
  if (node.type === "string" && typeof node.value === "string" && node.value.includes(ConfigurationResolverExpression.VARIABLE_LHS)) {
    callback(node);
  } else if (node.type === "property") {
    node.children?.slice(1).forEach((n) => forEachPropertyWithReplacement(n, callback));
  } else {
    node.children?.forEach((n) => forEachPropertyWithReplacement(n, callback));
  }
}
export {
  McpLanguageFeatures
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BMYW5ndWFnZUZlYXR1cmVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY29tcHV0ZUxldmVuc2h0ZWluRGlzdGFuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kaWZmL2RpZmYuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBtYXJrZG93bkNvbW1hbmRMaW5rLCBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IGZpbmROb2RlQXRMb2NhdGlvbiwgTm9kZSwgcGFyc2VUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBDb2RlTGVuc0xpc3QsIENvZGVMZW5zUHJvdmlkZXIsIElubGF5SGludCwgSW5sYXlIaW50TGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTWFya2VyRGF0YSwgSU1hcmtlclNlcnZpY2UsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLCBJUmVzb2x2ZWRWYWx1ZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5qcyc7XG5pbXBvcnQgeyBJTWNwQ29uZmlnUGF0aCwgSU1jcENvbmZpZ1BhdGhzU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9tY3BDb25maWdQYXRoc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgbWNwQ29uZmlndXJhdGlvblNlY3Rpb24gfSBmcm9tICcuLi9jb21tb24vbWNwQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWNwUmVnaXN0cnkgfSBmcm9tICcuLi9jb21tb24vbWNwUmVnaXN0cnlUeXBlcy5qcyc7XG5pbXBvcnQgeyBJTWNwU2VydmljZSwgTWNwQ29ubmVjdGlvblN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL21jcFR5cGVzLmpzJztcbmltcG9ydCB7IEVkaXRTdG9yZWRJbnB1dCwgUmVtb3ZlU3RvcmVkSW5wdXQsIFJlc3RhcnRTZXJ2ZXIsIFNob3dPdXRwdXQsIFN0YXJ0U2VydmVyLCBTdG9wU2VydmVyIH0gZnJvbSAnLi9tY3BDb21tYW5kcy5qcyc7XG5cbmNvbnN0IGRpYWdub3N0aWNPd25lciA9ICd2c2NvZGUubWNwJztcblxuZXhwb3J0IGNsYXNzIE1jcExhbmd1YWdlRmVhdHVyZXMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlZE1jcFNlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8eyBtb2RlbDogSVRleHRNb2RlbDsgaW5Db25maWc6IElNY3BDb25maWdQYXRoOyB0cmVlOiBOb2RlIH0gJiBJRGlzcG9zYWJsZT4oKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJTWNwUmVnaXN0cnkgcHJpdmF0ZSByZWFkb25seSBfbWNwUmVnaXN0cnk6IElNY3BSZWdpc3RyeSxcblx0XHRASU1jcENvbmZpZ1BhdGhzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tY3BDb25maWdQYXRoc1NlcnZpY2U6IElNY3BDb25maWdQYXRoc1NlcnZpY2UsXG5cdFx0QElNY3BTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21jcFNlcnZpY2U6IElNY3BTZXJ2aWNlLFxuXHRcdEBJTWFya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tYXJrZXJTZXJ2aWNlOiBJTWFya2VyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZTogSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBwYXR0ZXJucyA9IFtcblx0XHRcdHsgcGF0dGVybjogJyoqLy52c2NvZGUvbWNwLmpzb24nIH0sXG5cdFx0XHR7IHBhdHRlcm46ICcqKi9zZXR0aW5ncy5qc29uJyB9LFxuXHRcdFx0eyBwYXR0ZXJuOiAnKiovd29ya3NwYWNlLmpzb24nIH0sXG5cdFx0XTtcblxuXHRcdGNvbnN0IG9uRGlkQ2hhbmdlQ29kZUxlbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDb2RlTGVuc1Byb3ZpZGVyPigpKTtcblx0XHRjb25zdCBjb2RlTGVuc1Byb3ZpZGVyOiBDb2RlTGVuc1Byb3ZpZGVyID0ge1xuXHRcdFx0b25EaWRDaGFuZ2U6IG9uRGlkQ2hhbmdlQ29kZUxlbnMuZXZlbnQsXG5cdFx0XHRwcm92aWRlQ29kZUxlbnNlczogKG1vZGVsLCByYW5nZSkgPT4gdGhpcy5fcHJvdmlkZUNvZGVMZW5zZXMobW9kZWwsICgpID0+IG9uRGlkQ2hhbmdlQ29kZUxlbnMuZmlyZShjb2RlTGVuc1Byb3ZpZGVyKSksXG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlTGVuc1Byb3ZpZGVyLnJlZ2lzdGVyKHBhdHRlcm5zLCBjb2RlTGVuc1Byb3ZpZGVyKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbmxheUhpbnRzUHJvdmlkZXIucmVnaXN0ZXIocGF0dGVybnMsIHtcblx0XHRcdG9uRGlkQ2hhbmdlSW5sYXlIaW50czogX21jcFJlZ2lzdHJ5Lm9uRGlkQ2hhbmdlSW5wdXRzLFxuXHRcdFx0cHJvdmlkZUlubGF5SGludHM6IChtb2RlbCwgcmFuZ2UpID0+IHRoaXMuX3Byb3ZpZGVJbmxheUhpbnRzKG1vZGVsLCByYW5nZSksXG5cdFx0fSkpO1xuXHR9XG5cblx0LyoqIFNpbXBsZSBtZWNoYW5pc20gdG8gYXZvaWQgZXh0cmEganNvbiBwYXJzaW5nIGZvciBoaW50cytsZW5zZXMgKi9cblx0cHJpdmF0ZSBfcGFyc2VNb2RlbChtb2RlbDogSVRleHRNb2RlbCkge1xuXHRcdGlmICh0aGlzLl9jYWNoZWRNY3BTZWN0aW9uLnZhbHVlPy5tb2RlbCA9PT0gbW9kZWwpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jYWNoZWRNY3BTZWN0aW9uLnZhbHVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVyaSA9IG1vZGVsLnVyaTtcblx0XHRjb25zdCBpbkNvbmZpZyA9IHRoaXMuX21jcENvbmZpZ1BhdGhzU2VydmljZS5wYXRocy5nZXQoKS5maW5kKHUgPT4gaXNFcXVhbCh1LnVyaSwgdXJpKSk7XG5cdFx0aWYgKCFpbkNvbmZpZykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZSA9IG1vZGVsLmdldFZhbHVlKCk7XG5cdFx0Y29uc3QgdHJlZSA9IHBhcnNlVHJlZSh2YWx1ZSk7XG5cdFx0Y29uc3QgbGlzdGVuZXJzID0gW1xuXHRcdFx0bW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHRoaXMuX2NhY2hlZE1jcFNlY3Rpb24uY2xlYXIoKSksXG5cdFx0XHRtb2RlbC5vbldpbGxEaXNwb3NlKCgpID0+IHRoaXMuX2NhY2hlZE1jcFNlY3Rpb24uY2xlYXIoKSksXG5cdFx0XTtcblx0XHR0aGlzLl9hZGREaWFnbm9zdGljcyhtb2RlbCwgdmFsdWUsIHRyZWUsIGluQ29uZmlnKTtcblxuXHRcdHJldHVybiB0aGlzLl9jYWNoZWRNY3BTZWN0aW9uLnZhbHVlID0ge1xuXHRcdFx0bW9kZWwsXG5cdFx0XHR0cmVlLFxuXHRcdFx0aW5Db25maWcsXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX21hcmtlclNlcnZpY2UucmVtb3ZlKGRpYWdub3N0aWNPd25lciwgW3VyaV0pO1xuXHRcdFx0XHRkaXNwb3NlKGxpc3RlbmVycyk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZERpYWdub3N0aWNzKHRtOiBJVGV4dE1vZGVsLCB2YWx1ZTogc3RyaW5nLCB0cmVlOiBOb2RlLCBpbkNvbmZpZzogSU1jcENvbmZpZ1BhdGgpIHtcblx0XHRjb25zdCBzZXJ2ZXJzTm9kZSA9IGZpbmROb2RlQXRMb2NhdGlvbih0cmVlLCBpbkNvbmZpZy5zZWN0aW9uID8gWy4uLmluQ29uZmlnLnNlY3Rpb24sICdzZXJ2ZXJzJ10gOiBbJ3NlcnZlcnMnXSk7XG5cdFx0aWYgKCFzZXJ2ZXJzTm9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGdldENsb3Nlc3RNYXRjaGluZ1ZhcmlhYmxlID0gKG5hbWU6IHN0cmluZykgPT4ge1xuXHRcdFx0bGV0IGJlc3RWYWx1ZSA9ICcnO1xuXHRcdFx0bGV0IGJlc3REaXN0YW5jZSA9IEluZmluaXR5O1xuXHRcdFx0Zm9yIChjb25zdCB2YXJpYWJsZSBvZiB0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmFibGVWYXJpYWJsZXMpIHtcblx0XHRcdFx0Y29uc3QgZGlzdGFuY2UgPSBjb21wdXRlTGV2ZW5zaHRlaW5EaXN0YW5jZShuYW1lLCB2YXJpYWJsZSk7XG5cdFx0XHRcdGlmIChkaXN0YW5jZSA8IGJlc3REaXN0YW5jZSkge1xuXHRcdFx0XHRcdGJlc3REaXN0YW5jZSA9IGRpc3RhbmNlO1xuXHRcdFx0XHRcdGJlc3RWYWx1ZSA9IHZhcmlhYmxlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYmVzdFZhbHVlO1xuXHRcdH07XG5cblx0XHRjb25zdCBkaWFnbm9zdGljczogSU1hcmtlckRhdGFbXSA9IFtdO1xuXHRcdGZvckVhY2hQcm9wZXJ0eVdpdGhSZXBsYWNlbWVudChzZXJ2ZXJzTm9kZSwgbm9kZSA9PiB7XG5cdFx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZShub2RlLnZhbHVlKTtcblxuXHRcdFx0Zm9yIChjb25zdCB7IGlkLCBuYW1lLCBhcmcgfSBvZiBleHByLnVucmVzb2x2ZWQoKSkge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UucmVzb2x2YWJsZVZhcmlhYmxlcy5oYXMobmFtZSkpIHtcblx0XHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IHZhbHVlLmluZGV4T2YoaWQsIG5vZGUub2Zmc2V0KTtcblx0XHRcdFx0XHRpZiAocG9zaXRpb24gPT09IC0xKSB7IGNvbnRpbnVlOyB9IC8vIHVucmVhY2hhYmxlP1xuXG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnQgPSB0bS5nZXRQb3NpdGlvbkF0KHBvc2l0aW9uKTtcblx0XHRcdFx0XHRjb25zdCBlbmQgPSB0bS5nZXRQb3NpdGlvbkF0KHBvc2l0aW9uICsgaWQubGVuZ3RoKTtcblx0XHRcdFx0XHRkaWFnbm9zdGljcy5wdXNoKHtcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ21jcC52YXJpYWJsZU5vdEZvdW5kJywgJ1ZhcmlhYmxlIGB7MH1gIG5vdCBmb3VuZCwgZGlkIHlvdSBtZWFuICR7ezF9fT8nLCBuYW1lLCBnZXRDbG9zZXN0TWF0Y2hpbmdWYXJpYWJsZShuYW1lKSArIChhcmcgPyBgOiR7YXJnfWAgOiAnJykpLFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzdGFydC5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IHN0YXJ0LmNvbHVtbixcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IGVuZC5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiBlbmQuY29sdW1uLFxuXHRcdFx0XHRcdFx0bW9kZWxWZXJzaW9uSWQ6IHRtLmdldFZlcnNpb25JZCgpLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9tYXJrZXJTZXJ2aWNlLmNoYW5nZU9uZShkaWFnbm9zdGljT3duZXIsIHRtLnVyaSwgZGlhZ25vc3RpY3MpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9tYXJrZXJTZXJ2aWNlLnJlbW92ZShkaWFnbm9zdGljT3duZXIsIFt0bS51cmldKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9wcm92aWRlQ29kZUxlbnNlcyhtb2RlbDogSVRleHRNb2RlbCwgb25EaWRDaGFuZ2VDb2RlTGVuczogKCkgPT4gdm9pZCk6IENvZGVMZW5zTGlzdCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcGFyc2VkID0gdGhpcy5fcGFyc2VNb2RlbChtb2RlbCk7XG5cdFx0aWYgKCFwYXJzZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyB0cmVlLCBpbkNvbmZpZyB9ID0gcGFyc2VkO1xuXHRcdGNvbnN0IHNlcnZlcnNOb2RlID0gZmluZE5vZGVBdExvY2F0aW9uKHRyZWUsIGluQ29uZmlnLnNlY3Rpb24gPyBbLi4uaW5Db25maWcuc2VjdGlvbiwgJ3NlcnZlcnMnXSA6IFsnc2VydmVycyddKTtcblx0XHRpZiAoIXNlcnZlcnNOb2RlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxlbnNlczogQ29kZUxlbnNMaXN0ID0geyBsZW5zZXM6IFtdLCBkaXNwb3NlOiAoKSA9PiBzdG9yZS5kaXNwb3NlKCkgfTtcblx0XHRjb25zdCByZWFkID0gPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogVCA9PiB7XG5cdFx0XHRzdG9yZS5hZGQoRXZlbnQuZnJvbU9ic2VydmFibGVMaWdodChvYnNlcnZhYmxlKShvbkRpZENoYW5nZUNvZGVMZW5zKSk7XG5cdFx0XHRyZXR1cm4gb2JzZXJ2YWJsZS5nZXQoKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IHJlYWQodGhpcy5fbWNwUmVnaXN0cnkuY29sbGVjdGlvbnMpLmZpbmQoYyA9PiBpc0VxdWFsKGMucHJlc2VudGF0aW9uPy5vcmlnaW4sIG1vZGVsLnVyaSkpO1xuXHRcdGlmICghY29sbGVjdGlvbikge1xuXHRcdFx0cmV0dXJuIGxlbnNlcztcblx0XHR9XG5cblx0XHRjb25zdCBtY3BTZXJ2ZXJzID0gcmVhZCh0aGlzLl9tY3BTZXJ2aWNlLnNlcnZlcnMpLmZpbHRlcihzID0+IHMuY29sbGVjdGlvbi5pZCA9PT0gY29sbGVjdGlvbi5pZCk7XG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHNlcnZlcnNOb2RlLmNoaWxkcmVuIHx8IFtdKSB7XG5cdFx0XHRpZiAobm9kZS50eXBlICE9PSAncHJvcGVydHknIHx8IG5vZGUuY2hpbGRyZW4/LlswXT8udHlwZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5hbWUgPSBub2RlLmNoaWxkcmVuWzBdLnZhbHVlIGFzIHN0cmluZztcblx0XHRcdGNvbnN0IHNlcnZlciA9IG1jcFNlcnZlcnMuZmluZChzID0+IHMuZGVmaW5pdGlvbi5sYWJlbCA9PT0gbmFtZSk7XG5cdFx0XHRpZiAoIXNlcnZlcikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmFuZ2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKG1vZGVsLmdldFBvc2l0aW9uQXQobm9kZS5jaGlsZHJlblswXS5vZmZzZXQpKTtcblx0XHRcdHN3aXRjaCAocmVhZChzZXJ2ZXIuY29ubmVjdGlvblN0YXRlKS5zdGF0ZSkge1xuXHRcdFx0XHRjYXNlIE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLkVycm9yOlxuXHRcdFx0XHRcdGxlbnNlcy5sZW5zZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdFx0aWQ6IFNob3dPdXRwdXQuSUQsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiAnJChlcnJvcikgJyArIGxvY2FsaXplKCdzZXJ2ZXIuZXJyb3InLCAnRXJyb3InKSxcblx0XHRcdFx0XHRcdFx0YXJndW1lbnRzOiBbc2VydmVyLmRlZmluaXRpb24uaWRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdFx0aWQ6IFJlc3RhcnRTZXJ2ZXIuSUQsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbWNwLnJlc3RhcnQnLCBcIlJlc3RhcnRcIiksXG5cdFx0XHRcdFx0XHRcdGFyZ3VtZW50czogW3NlcnZlci5kZWZpbml0aW9uLmlkXSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuU3RhcnRpbmc6XG5cdFx0XHRcdFx0bGVuc2VzLmxlbnNlcy5wdXNoKHtcblx0XHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0XHRpZDogU2hvd091dHB1dC5JRCxcblx0XHRcdFx0XHRcdFx0dGl0bGU6ICckKGxvYWRpbmd+c3BpbikgJyArIGxvY2FsaXplKCdzZXJ2ZXIuc3RhcnRpbmcnLCAnU3RhcnRpbmcnKSxcblx0XHRcdFx0XHRcdFx0YXJndW1lbnRzOiBbc2VydmVyLmRlZmluaXRpb24uaWRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdFx0aWQ6IFN0b3BTZXJ2ZXIuSUQsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY2FuY2VsJywgXCJDYW5jZWxcIiksXG5cdFx0XHRcdFx0XHRcdGFyZ3VtZW50czogW3NlcnZlci5kZWZpbml0aW9uLmlkXSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuUnVubmluZzpcblx0XHRcdFx0XHRsZW5zZXMubGVuc2VzLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRcdGlkOiBTaG93T3V0cHV0LklELFxuXHRcdFx0XHRcdFx0XHR0aXRsZTogJyQoY2hlY2spICcgKyBsb2NhbGl6ZSgnc2VydmVyLnJ1bm5pbmcnLCAnUnVubmluZycpLFxuXHRcdFx0XHRcdFx0XHRhcmd1bWVudHM6IFtzZXJ2ZXIuZGVmaW5pdGlvbi5pZF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0XHRpZDogU3RvcFNlcnZlci5JRCxcblx0XHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdtY3Auc3RvcCcsIFwiU3RvcFwiKSxcblx0XHRcdFx0XHRcdFx0YXJndW1lbnRzOiBbc2VydmVyLmRlZmluaXRpb24uaWRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdFx0aWQ6IFJlc3RhcnRTZXJ2ZXIuSUQsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbWNwLnJlc3RhcnQnLCBcIlJlc3RhcnRcIiksXG5cdFx0XHRcdFx0XHRcdGFyZ3VtZW50czogW3NlcnZlci5kZWZpbml0aW9uLmlkXSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRcdGlkOiAnJyxcblx0XHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZXJ2ZXIudG9vbENvdW50JywgJ3swfSB0b29scycsIHJlYWQoc2VydmVyLnRvb2xzKS5sZW5ndGgpLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBNY3BDb25uZWN0aW9uU3RhdGUuS2luZC5TdG9wcGVkOiB7XG5cdFx0XHRcdFx0bGVuc2VzLmxlbnNlcy5wdXNoKHtcblx0XHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0XHRpZDogU3RhcnRTZXJ2ZXIuSUQsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiAnJChkZWJ1Zy1zdGFydCkgJyArIGxvY2FsaXplKCdtY3Auc3RhcnQnLCBcIlN0YXJ0XCIpLFxuXHRcdFx0XHRcdFx0XHRhcmd1bWVudHM6IFtzZXJ2ZXIuZGVmaW5pdGlvbi5pZF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGNvbnN0IHRvb2xDb3VudCA9IHJlYWQoc2VydmVyLnRvb2xzKS5sZW5ndGg7XG5cdFx0XHRcdFx0aWYgKHRvb2xDb3VudCkge1xuXHRcdFx0XHRcdFx0bGVuc2VzLmxlbnNlcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdFx0XHRpZDogJycsXG5cdFx0XHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZXJ2ZXIudG9vbENvdW50Q2FjaGVkJywgJ3swfSBjYWNoZWQgdG9vbHMnLCB0b29sQ291bnQpLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbGVuc2VzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcHJvdmlkZUlubGF5SGludHMobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlOiBSYW5nZSk6IFByb21pc2U8SW5sYXlIaW50TGlzdCB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHBhcnNlZCA9IHRoaXMuX3BhcnNlTW9kZWwobW9kZWwpO1xuXHRcdGlmICghcGFyc2VkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgdHJlZSwgaW5Db25maWcgfSA9IHBhcnNlZDtcblx0XHRjb25zdCBtY3BTZWN0aW9uID0gaW5Db25maWcuc2VjdGlvbiA/IGZpbmROb2RlQXRMb2NhdGlvbih0cmVlLCBbLi4uaW5Db25maWcuc2VjdGlvbl0pIDogdHJlZTtcblx0XHRpZiAoIW1jcFNlY3Rpb24pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXRzTm9kZSA9IGZpbmROb2RlQXRMb2NhdGlvbihtY3BTZWN0aW9uLCBbJ2lucHV0cyddKTtcblx0XHRpZiAoIWlucHV0c05vZGUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXRzID0gYXdhaXQgdGhpcy5fbWNwUmVnaXN0cnkuZ2V0U2F2ZWRJbnB1dHMoaW5Db25maWcuc2NvcGUpO1xuXHRcdGNvbnN0IGhpbnRzOiBJbmxheUhpbnRbXSA9IFtdO1xuXG5cdFx0Y29uc3Qgc2VydmVyc05vZGUgPSBmaW5kTm9kZUF0TG9jYXRpb24obWNwU2VjdGlvbiwgWydzZXJ2ZXJzJ10pO1xuXHRcdGlmIChzZXJ2ZXJzTm9kZSkge1xuXHRcdFx0YW5ub3RhdGVTZXJ2ZXJzKHNlcnZlcnNOb2RlKTtcblx0XHR9XG5cdFx0YW5ub3RhdGVJbnB1dHMoaW5wdXRzTm9kZSk7XG5cblx0XHRyZXR1cm4geyBoaW50cywgZGlzcG9zZTogKCkgPT4geyB9IH07XG5cblx0XHRmdW5jdGlvbiBhbm5vdGF0ZVNlcnZlcnMoc2VydmVyczogTm9kZSkge1xuXHRcdFx0Zm9yRWFjaFByb3BlcnR5V2l0aFJlcGxhY2VtZW50KHNlcnZlcnMsIG5vZGUgPT4ge1xuXHRcdFx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZShub2RlLnZhbHVlKTtcblx0XHRcdFx0Zm9yIChjb25zdCB7IGlkIH0gb2YgZXhwci51bnJlc29sdmVkKCkpIHtcblx0XHRcdFx0XHRjb25zdCBzYXZlZCA9IGlucHV0c1tpZF07XG5cdFx0XHRcdFx0aWYgKHNhdmVkKSB7XG5cdFx0XHRcdFx0XHRwdXNoQW5ub3RhdGlvbihpZCwgbm9kZS5vZmZzZXQgKyBub2RlLnZhbHVlLmluZGV4T2YoaWQpICsgaWQubGVuZ3RoLCBzYXZlZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhbm5vdGF0ZUlucHV0cyhub2RlOiBOb2RlKSB7XG5cdFx0XHRpZiAobm9kZS50eXBlICE9PSAnYXJyYXknIHx8ICFub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBpbnB1dCBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdGlmIChpbnB1dC50eXBlICE9PSAnb2JqZWN0JyB8fCAhaW5wdXQuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGlkUHJvcCA9IGlucHV0LmNoaWxkcmVuLmZpbmQoYyA9PiBjLnR5cGUgPT09ICdwcm9wZXJ0eScgJiYgYy5jaGlsZHJlbj8uWzBdLnZhbHVlID09PSAnaWQnKTtcblx0XHRcdFx0aWYgKCFpZFByb3ApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGlkID0gaWRQcm9wLmNoaWxkcmVuIVsxXTtcblx0XHRcdFx0aWYgKCFpZCB8fCBpZC50eXBlICE9PSAnc3RyaW5nJyB8fCAhaWQudmFsdWUpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHNhdmVkSWQgPSAnJHtpbnB1dDonICsgaWQudmFsdWUgKyAnfSc7XG5cdFx0XHRcdGNvbnN0IHNhdmVkID0gaW5wdXRzW3NhdmVkSWRdO1xuXHRcdFx0XHRpZiAoc2F2ZWQpIHtcblx0XHRcdFx0XHRwdXNoQW5ub3RhdGlvbihzYXZlZElkLCBpZC5vZmZzZXQgKyAxICsgaWQubGVuZ3RoLCBzYXZlZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBwdXNoQW5ub3RhdGlvbihzYXZlZElkOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBzYXZlZDogSVJlc29sdmVkVmFsdWUpOiBJbmxheUhpbnQge1xuXHRcdFx0Y29uc3QgdG9vbHRpcCA9IG5ldyBNYXJrZG93blN0cmluZyhbXG5cdFx0XHRcdG1hcmtkb3duQ29tbWFuZExpbmsoeyBpZDogRWRpdFN0b3JlZElucHV0LklELCB0aXRsZTogbG9jYWxpemUoJ2VkaXQnLCAnRWRpdCcpLCBhcmd1bWVudHM6IFtzYXZlZElkLCBtb2RlbC51cmksIG1jcENvbmZpZ3VyYXRpb25TZWN0aW9uLCBpbkNvbmZpZyEudGFyZ2V0XSB9KSxcblx0XHRcdFx0bWFya2Rvd25Db21tYW5kTGluayh7IGlkOiBSZW1vdmVTdG9yZWRJbnB1dC5JRCwgdGl0bGU6IGxvY2FsaXplKCdjbGVhcicsICdDbGVhcicpLCBhcmd1bWVudHM6IFtpbkNvbmZpZyEuc2NvcGUsIHNhdmVkSWRdIH0pLFxuXHRcdFx0XHRtYXJrZG93bkNvbW1hbmRMaW5rKHsgaWQ6IFJlbW92ZVN0b3JlZElucHV0LklELCB0aXRsZTogbG9jYWxpemUoJ2NsZWFyQWxsJywgJ0NsZWFyIEFsbCcpLCBhcmd1bWVudHM6IFtpbkNvbmZpZyEuc2NvcGVdIH0pLFxuXHRcdFx0XS5qb2luKCcgfCAnKSwgeyBpc1RydXN0ZWQ6IHRydWUgfSk7XG5cblx0XHRcdGNvbnN0IGhpbnQ6IElubGF5SGludCA9IHtcblx0XHRcdFx0bGFiZWw6ICc9ICcgKyAoc2F2ZWQuaW5wdXQ/LnR5cGUgPT09ICdwcm9tcHRTdHJpbmcnICYmIHNhdmVkLmlucHV0LnBhc3N3b3JkID8gJyonLnJlcGVhdCgxMCkgOiAoc2F2ZWQudmFsdWUgfHwgJycpKSxcblx0XHRcdFx0cG9zaXRpb246IG1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0KSxcblx0XHRcdFx0dG9vbHRpcCxcblx0XHRcdFx0cGFkZGluZ0xlZnQ6IHRydWUsXG5cdFx0XHR9O1xuXG5cdFx0XHRoaW50cy5wdXNoKGhpbnQpO1xuXHRcdFx0cmV0dXJuIGhpbnQ7XG5cdFx0fVxuXHR9XG59XG5cblxuXG5mdW5jdGlvbiBmb3JFYWNoUHJvcGVydHlXaXRoUmVwbGFjZW1lbnQobm9kZTogTm9kZSwgY2FsbGJhY2s6IChub2RlOiBOb2RlKSA9PiB2b2lkKSB7XG5cdGlmIChub2RlLnR5cGUgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBub2RlLnZhbHVlID09PSAnc3RyaW5nJyAmJiBub2RlLnZhbHVlLmluY2x1ZGVzKENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24uVkFSSUFCTEVfTEhTKSkge1xuXHRcdGNhbGxiYWNrKG5vZGUpO1xuXHR9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gJ3Byb3BlcnR5Jykge1xuXHRcdC8vIHNraXAgdGhlIHByb3BlcnR5IG5hbWVcblx0XHRub2RlLmNoaWxkcmVuPy5zbGljZSgxKS5mb3JFYWNoKG4gPT4gZm9yRWFjaFByb3BlcnR5V2l0aFJlcGxhY2VtZW50KG4sIGNhbGxiYWNrKSk7XG5cdH0gZWxzZSB7XG5cdFx0bm9kZS5jaGlsZHJlbj8uZm9yRWFjaChuID0+IGZvckVhY2hQcm9wZXJ0eVdpdGhSZXBsYWNlbWVudChuLCBjYWxsYmFjaykpO1xuXHR9XG59XG5cblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHFCQUFxQixzQkFBc0I7QUFDcEQsU0FBUyxvQkFBMEIsaUJBQWlCO0FBQ3BELFNBQVMsWUFBWSxpQkFBaUIsU0FBc0IseUJBQXlCO0FBRXJGLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFHdEIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBc0IsZ0JBQWdCLHNCQUFzQjtBQUU1RCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHVDQUF1RDtBQUNoRSxTQUF5Qiw4QkFBOEI7QUFDdkQsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxhQUFhLDBCQUEwQjtBQUNoRCxTQUFTLGlCQUFpQixtQkFBbUIsZUFBZSxZQUFZLGFBQWEsa0JBQWtCO0FBRXZHLE1BQU0sa0JBQWtCO0FBRWpCLElBQU0sc0JBQU4sY0FBa0MsV0FBNkM7QUFBQSxFQUdyRixZQUMyQix5QkFDSyxjQUNVLHdCQUNYLGFBQ0csZ0JBQ2UsK0JBQy9DO0FBQ0QsVUFBTTtBQU55QjtBQUNVO0FBQ1g7QUFDRztBQUNlO0FBUmpELFNBQWlCLG9CQUFvQixLQUFLLFVBQVUsSUFBSSxrQkFBNkYsQ0FBQztBQVlySixVQUFNLFdB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
