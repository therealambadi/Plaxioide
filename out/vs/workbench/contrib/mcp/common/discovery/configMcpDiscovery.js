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
import { equals as arrayEquals } from "../../../../../base/common/arrays.js";
import { Throttler } from "../../../../../base/common/async.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorunDelta, observableValue } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { getMcpServerMapping } from "../mcpConfigFileUtils.js";
import { IMcpConfigPathsService } from "../mcpConfigPathsService.js";
import { mcpConfigurationSection } from "../mcpConfiguration.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { McpServerDefinition, McpServerTransportType } from "../mcpTypes.js";
let ConfigMcpDiscovery = class extends Disposable {
  constructor(_configurationService, _mcpRegistry, _textModelService, _mcpConfigPathsService) {
    super();
    this._configurationService = _configurationService;
    this._mcpRegistry = _mcpRegistry;
    this._textModelService = _textModelService;
    this._mcpConfigPathsService = _mcpConfigPathsService;
    this.configSources = [];
  }
  start() {
    const throttler = this._register(new Throttler());
    const addPath = (path) => {
      this.configSources.push({
        path,
        serverDefinitions: observableValue(this, []),
        disposable: this._register(new MutableDisposable()),
        getServerToLocationMapping: (uri) => this._getServerIdMapping(uri, path.section ? [...path.section, "servers"] : ["servers"])
      });
    };
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(mcpConfigurationSection)) {
        throttler.queue(() => this.sync());
      }
    }));
    this._register(autorunDelta(this._mcpConfigPathsService.paths, ({ lastValue, newValue }) => {
      for (const last of lastValue || []) {
        if (!newValue.includes(last)) {
          const idx = this.configSources.findIndex((src) => src.path.id === last.id);
          if (idx !== -1) {
            this.configSources[idx].disposable.dispose();
            this.configSources.splice(idx, 1);
          }
        }
      }
      for (const next of newValue) {
        if (!lastValue || !lastValue.includes(next)) {
          addPath(next);
        }
      }
      this.sync();
    }));
  }
  async _getServerIdMapping(resource, pathToServers) {
    const store = new DisposableStore();
    try {
      const ref = await this._textModelService.createModelReference(resource);
      store.add(ref);
      const serverIdMapping = getMcpServerMapping({ model: ref.object.textEditorModel, pathToServers });
      return serverIdMapping;
    } catch {
      return /* @__PURE__ */ new Map();
    } finally {
      store.dispose();
    }
  }
  async sync() {
    const configurationKey = this._configurationService.inspect(mcpConfigurationSection);
    const configMappings = await Promise.all(this.configSources.map((src) => {
      const uri = src.path.uri;
      return uri && src.getServerToLocationMapping(uri);
    }));
    for (const [index, src] of this.configSources.entries()) {
      const collectionId = `mcp.config.${src.path.id}`;
      let value = src.path.workspaceFolder ? this._configurationService.inspect(mcpConfigurationSection, { resource: src.path.workspaceFolder.uri })[src.path.key] : configurationKey[src.path.key];
      if (value?.mcpServers) {
        value = { ...value, servers: { ...value.servers, ...value.mcpServers }, mcpServers: void 0 };
        this._configurationService.updateValue(mcpConfigurationSection, value, {}, src.path.target, { donotNotifyError: true });
      }
      const configMapping = configMappings[index];
      const nextDefinitions = Object.entries(value?.servers || {}).map(([name, value2]) => ({
        id: `${collectionId}.${name}`,
        label: name,
        launch: "type" in value2 && value2.type === "sse" ? {
          type: McpServerTransportType.SSE,
          uri: URI.parse(value2.url),
          headers: Object.entries(value2.headers || {})
        } : {
          type: McpServerTransportType.Stdio,
          args: value2.args || [],
          command: value2.command,
          env: value2.env || {},
          envFile: value2.envFile,
          cwd: void 0
        },
        roots: src.path.workspaceFolder ? [src.path.workspaceFolder.uri] : [],
        variableReplacement: {
          folder: src.path.workspaceFolder,
          section: mcpConfigurationSection,
          target: src.path.target
        },
        presentation: {
          order: src.path.order,
          origin: configMapping?.get(name)
        }
      }));
      if (arrayEquals(nextDefinitions, src.serverDefinitions.get(), McpServerDefinition.equals)) {
        continue;
      }
      if (!nextDefinitions.length) {
        src.disposable.clear();
        src.serverDefinitions.set(nextDefinitions, void 0);
      } else {
        src.serverDefinitions.set(nextDefinitions, void 0);
        src.disposable.value ??= this._mcpRegistry.registerCollection({
          id: collectionId,
          label: src.path.label,
          presentation: { order: src.path.order, origin: src.path.uri },
          remoteAuthority: src.path.remoteAuthority || null,
          serverDefinitions: src.serverDefinitions,
          isTrustedByDefault: true,
          scope: src.path.scope
        });
      }
    }
  }
};
ConfigMcpDiscovery = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IMcpConfigPathsService)
], ConfigMcpDiscovery);
export {
  ConfigMcpDiscovery
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL2Rpc2NvdmVyeS9jb25maWdNY3BEaXNjb3ZlcnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBlcXVhbHMgYXMgYXJyYXlFcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgVGhyb3R0bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1bkRlbHRhLCBJU2V0dGFibGVPYnNlcnZhYmxlLCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRNY3BTZXJ2ZXJNYXBwaW5nIH0gZnJvbSAnLi4vbWNwQ29uZmlnRmlsZVV0aWxzLmpzJztcbmltcG9ydCB7IElNY3BDb25maWdQYXRoLCBJTWNwQ29uZmlnUGF0aHNTZXJ2aWNlIH0gZnJvbSAnLi4vbWNwQ29uZmlnUGF0aHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNY3BDb25maWd1cmF0aW9uLCBtY3BDb25maWd1cmF0aW9uU2VjdGlvbiB9IGZyb20gJy4uL21jcENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSU1jcFJlZ2lzdHJ5IH0gZnJvbSAnLi4vbWNwUmVnaXN0cnlUeXBlcy5qcyc7XG5pbXBvcnQgeyBNY3BTZXJ2ZXJEZWZpbml0aW9uLCBNY3BTZXJ2ZXJUcmFuc3BvcnRUeXBlIH0gZnJvbSAnLi4vbWNwVHlwZXMuanMnO1xuaW1wb3J0IHsgSU1jcERpc2NvdmVyeSB9IGZyb20gJy4vbWNwRGlzY292ZXJ5LmpzJztcblxuaW50ZXJmYWNlIENvbmZpZ1NvdXJjZSB7XG5cdHBhdGg6IElNY3BDb25maWdQYXRoO1xuXHRzZXJ2ZXJEZWZpbml0aW9uczogSVNldHRhYmxlT2JzZXJ2YWJsZTxyZWFkb25seSBNY3BTZXJ2ZXJEZWZpbml0aW9uW10+O1xuXHRkaXNwb3NhYmxlOiBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT47XG5cdGdldFNlcnZlclRvTG9jYXRpb25NYXBwaW5nKHVyaTogVVJJKTogUHJvbWlzZTxNYXA8c3RyaW5nLCBMb2NhdGlvbj4+O1xufVxuXG4vKipcbiAqIERpc2NvdmVycyBNQ1Agc2VydmVycyBiYXNlZCBvbiB2YXJpb3VzIGNvbmZpZyBzb3VyY2VzLlxuICovXG5leHBvcnQgY2xhc3MgQ29uZmlnTWNwRGlzY292ZXJ5IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElNY3BEaXNjb3Zlcnkge1xuXHRwcml2YXRlIGNvbmZpZ1NvdXJjZXM6IENvbmZpZ1NvdXJjZVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTWNwUmVnaXN0cnkgcHJpdmF0ZSByZWFkb25seSBfbWNwUmVnaXN0cnk6IElNY3BSZWdpc3RyeSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElNY3BDb25maWdQYXRoc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWNwQ29uZmlnUGF0aHNTZXJ2aWNlOiBJTWNwQ29uZmlnUGF0aHNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHVibGljIHN0YXJ0KCkge1xuXHRcdGNvbnN0IHRocm90dGxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUaHJvdHRsZXIoKSk7XG5cblx0XHRjb25zdCBhZGRQYXRoID0gKHBhdGg6IElNY3BDb25maWdQYXRoKSA9PiB7XG5cdFx0XHR0aGlzLmNvbmZpZ1NvdXJjZXMucHVzaCh7XG5cdFx0XHRcdHBhdGgsXG5cdFx0XHRcdHNlcnZlckRlZmluaXRpb25zOiBvYnNlcnZhYmxlVmFsdWUodGhpcywgW10pLFxuXHRcdFx0XHRkaXNwb3NhYmxlOiB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSksXG5cdFx0XHRcdGdldFNlcnZlclRvTG9jYXRpb25NYXBwaW5nOiAodXJpKSA9PiB0aGlzLl9nZXRTZXJ2ZXJJZE1hcHBpbmcodXJpLCBwYXRoLnNlY3Rpb24gPyBbLi4ucGF0aC5zZWN0aW9uLCAnc2VydmVycyddIDogWydzZXJ2ZXJzJ10pLFxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG1jcENvbmZpZ3VyYXRpb25TZWN0aW9uKSkge1xuXHRcdFx0XHR0aHJvdHRsZXIucXVldWUoKCkgPT4gdGhpcy5zeW5jKCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5EZWx0YSh0aGlzLl9tY3BDb25maWdQYXRoc1NlcnZpY2UucGF0aHMsICh7IGxhc3RWYWx1ZSwgbmV3VmFsdWUgfSkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBsYXN0IG9mIGxhc3RWYWx1ZSB8fCBbXSkge1xuXHRcdFx0XHRpZiAoIW5ld1ZhbHVlLmluY2x1ZGVzKGxhc3QpKSB7XG5cdFx0XHRcdFx0Y29uc3QgaWR4ID0gdGhpcy5jb25maWdTb3VyY2VzLmZpbmRJbmRleChzcmMgPT4gc3JjLnBhdGguaWQgPT09IGxhc3QuaWQpO1xuXHRcdFx0XHRcdGlmIChpZHggIT09IC0xKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNvbmZpZ1NvdXJjZXNbaWR4XS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdHRoaXMuY29uZmlnU291cmNlcy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBuZXh0IG9mIG5ld1ZhbHVlKSB7XG5cdFx0XHRcdGlmICghbGFzdFZhbHVlIHx8ICFsYXN0VmFsdWUuaW5jbHVkZXMobmV4dCkpIHtcblx0XHRcdFx0XHRhZGRQYXRoKG5leHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc3luYygpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dldFNlcnZlcklkTWFwcGluZyhyZXNvdXJjZTogVVJJLCBwYXRoVG9TZXJ2ZXJzOiBzdHJpbmdbXSk6IFByb21pc2U8TWFwPHN0cmluZywgTG9jYXRpb24+PiB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UocmVzb3VyY2UpO1xuXHRcdFx0c3RvcmUuYWRkKHJlZik7XG5cdFx0XHRjb25zdCBzZXJ2ZXJJZE1hcHBpbmcgPSBnZXRNY3BTZXJ2ZXJNYXBwaW5nKHsgbW9kZWw6IHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLCBwYXRoVG9TZXJ2ZXJzIH0pO1xuXHRcdFx0cmV0dXJuIHNlcnZlcklkTWFwcGluZztcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBuZXcgTWFwKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHN5bmMoKSB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbktleSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Q8SU1jcENvbmZpZ3VyYXRpb24+KG1jcENvbmZpZ3VyYXRpb25TZWN0aW9uKTtcblx0XHRjb25zdCBjb25maWdNYXBwaW5ncyA9IGF3YWl0IFByb21pc2UuYWxsKHRoaXMuY29uZmlnU291cmNlcy5tYXAoc3JjID0+IHtcblx0XHRcdGNvbnN0IHVyaSA9IHNyYy5wYXRoLnVyaTtcblx0XHRcdHJldHVybiB1cmkgJiYgc3JjLmdldFNlcnZlclRvTG9jYXRpb25NYXBwaW5nKHVyaSk7XG5cdFx0fSkpO1xuXG5cdFx0Zm9yIChjb25zdCBbaW5kZXgsIHNyY10gb2YgdGhpcy5jb25maWdTb3VyY2VzLmVudHJpZXMoKSkge1xuXHRcdFx0Y29uc3QgY29sbGVjdGlvbklkID0gYG1jcC5jb25maWcuJHtzcmMucGF0aC5pZH1gO1xuXHRcdFx0Ly8gaW5zcGVjdCgpIHdpbGwgZ2l2ZSB0aGUgZmlyc3Qgd29ya3NwYWNlIGZvbGRlciwgYW5kIG11c3QgYmVcblx0XHRcdC8vIGFza2VkIGZvciBleHBsaWNpdGx5IGZvciBvdGhlciBmb2xkZXJzLlxuXHRcdFx0bGV0IHZhbHVlID0gc3JjLnBhdGgud29ya3NwYWNlRm9sZGVyXG5cdFx0XHRcdD8gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxJTWNwQ29uZmlndXJhdGlvbj4obWNwQ29uZmlndXJhdGlvblNlY3Rpb24sIHsgcmVzb3VyY2U6IHNyYy5wYXRoLndvcmtzcGFjZUZvbGRlci51cmkgfSlbc3JjLnBhdGgua2V5XVxuXHRcdFx0XHQ6IGNvbmZpZ3VyYXRpb25LZXlbc3JjLnBhdGgua2V5XTtcblxuXHRcdFx0Ly8gSWYgd2Ugc2VlIHRoZXJlIGFyZSBNQ1Agc2VydmVycywgbWlncmF0ZSB0aGVtIGF1dG9tYXRpY2FsbHlcblx0XHRcdGlmICh2YWx1ZT8ubWNwU2VydmVycykge1xuXHRcdFx0XHR2YWx1ZSA9IHsgLi4udmFsdWUsIHNlcnZlcnM6IHsgLi4udmFsdWUuc2VydmVycywgLi4udmFsdWUubWNwU2VydmVycyB9LCBtY3BTZXJ2ZXJzOiB1bmRlZmluZWQgfTtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUobWNwQ29uZmlndXJhdGlvblNlY3Rpb24sIHZhbHVlLCB7fSwgc3JjLnBhdGgudGFyZ2V0LCB7IGRvbm90Tm90aWZ5RXJyb3I6IHRydWUgfSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNvbmZpZ01hcHBpbmcgPSBjb25maWdNYXBwaW5nc1tpbmRleF07XG5cdFx0XHRjb25zdCBuZXh0RGVmaW5pdGlvbnMgPSBPYmplY3QuZW50cmllcyh2YWx1ZT8uc2VydmVycyB8fCB7fSkubWFwKChbbmFtZSwgdmFsdWVdKTogTWNwU2VydmVyRGVmaW5pdGlvbiA9PiAoe1xuXHRcdFx0XHRpZDogYCR7Y29sbGVjdGlvbklkfS4ke25hbWV9YCxcblx0XHRcdFx0bGFiZWw6IG5hbWUsXG5cdFx0XHRcdGxhdW5jaDogJ3R5cGUnIGluIHZhbHVlICYmIHZhbHVlLnR5cGUgPT09ICdzc2UnID8ge1xuXHRcdFx0XHRcdHR5cGU6IE1jcFNlcnZlclRyYW5zcG9ydFR5cGUuU1NFLFxuXHRcdFx0XHRcdHVyaTogVVJJLnBhcnNlKHZhbHVlLnVybCksXG5cdFx0XHRcdFx0aGVhZGVyczogT2JqZWN0LmVudHJpZXModmFsdWUuaGVhZGVycyB8fCB7fSksXG5cdFx0XHRcdH0gOiB7XG5cdFx0XHRcdFx0dHlwZTogTWNwU2VydmVyVHJhbnNwb3J0VHlwZS5TdGRpbyxcblx0XHRcdFx0XHRhcmdzOiB2YWx1ZS5hcmdzIHx8IFtdLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IHZhbHVlLmNvbW1hbmQsXG5cdFx0XHRcdFx0ZW52OiB2YWx1ZS5lbnYgfHwge30sXG5cdFx0XHRcdFx0ZW52RmlsZTogdmFsdWUuZW52RmlsZSxcblx0XHRcdFx0XHRjd2Q6IHVuZGVmaW5lZCxcblx0XHRcdFx0fSxcblx0XHRcdFx0cm9vdHM6IHNyYy5wYXRoLndvcmtzcGFjZUZvbGRlciA/IFtzcmMucGF0aC53b3Jrc3BhY2VGb2xkZXIudXJpXSA6IFtdLFxuXHRcdFx0XHR2YXJpYWJsZVJlcGxhY2VtZW50OiB7XG5cdFx0XHRcdFx0Zm9sZGVyOiBzcmMucGF0aC53b3Jrc3BhY2VGb2xkZXIsXG5cdFx0XHRcdFx0c2VjdGlvbjogbWNwQ29uZmlndXJhdGlvblNlY3Rpb24sXG5cdFx0XHRcdFx0dGFyZ2V0OiBzcmMucGF0aC50YXJnZXQsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHByZXNlbnRhdGlvbjoge1xuXHRcdFx0XHRcdG9yZGVyOiBzcmMucGF0aC5vcmRlcixcblx0XHRcdFx0XHRvcmlnaW46IGNvbmZpZ01hcHBpbmc/LmdldChuYW1lKSxcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRpZiAoYXJyYXlFcXVhbHMobmV4dERlZmluaXRpb25zLCBzcmMuc2VydmVyRGVmaW5pdGlvbnMuZ2V0KCksIE1jcFNlcnZlckRlZmluaXRpb24uZXF1YWxzKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFuZXh0RGVmaW5pdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdHNyYy5kaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0XHRcdHNyYy5zZXJ2ZXJEZWZpbml0aW9ucy5zZXQobmV4dERlZmluaXRpb25zLCB1bmRlZmluZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3JjLnNlcnZlckRlZmluaXRpb25zLnNldChuZXh0RGVmaW5pdGlvbnMsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdHNyYy5kaXNwb3NhYmxlLnZhbHVlID8/PSB0aGlzLl9tY3BSZWdpc3RyeS5yZWdpc3RlckNvbGxlY3Rpb24oe1xuXHRcdFx0XHRcdGlkOiBjb2xsZWN0aW9uSWQsXG5cdFx0XHRcdFx0bGFiZWw6IHNyYy5wYXRoLmxhYmVsLFxuXHRcdFx0XHRcdHByZXNlbnRhdGlvbjogeyBvcmRlcjogc3JjLnBhdGgub3JkZXIsIG9yaWdpbjogc3JjLnBhdGgudXJpIH0sXG5cdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBzcmMucGF0aC5yZW1vdGVBdXRob3JpdHkgfHwgbnVsbCxcblx0XHRcdFx0XHRzZXJ2ZXJEZWZpbml0aW9uczogc3JjLnNlcnZlckRlZmluaXRpb25zLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZEJ5RGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRzY29wZTogc3JjLnBhdGguc2NvcGUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRc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
