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
import { importAMDNodeModule } from "../../../amdX.js";
import { DeferredPromise, Sequencer } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Lazy } from "../../../base/common/lazy.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { StorageScope } from "../../../platform/storage/common/storage.js";
import { extensionPrefixedIdentifier, McpConnectionState, McpServerLaunch, McpServerTransportType } from "../../contrib/mcp/common/mcpTypes.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { LogLevel } from "../../../platform/log/common/log.js";
const IExtHostMpcService = createDecorator("IExtHostMpcService");
let ExtHostMcpService = class extends Disposable {
  constructor(extHostRpc) {
    super();
    this._initialProviderPromises = /* @__PURE__ */ new Set();
    this._sseEventSources = this._register(new DisposableMap());
    this._eventSource = new Lazy(async () => {
      const es = await importAMDNodeModule("@c4312/eventsource-umd", "dist/index.umd.js");
      return es.EventSource;
    });
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadMcp);
  }
  $startMcp(id, launch) {
    this._startMcp(id, McpServerLaunch.fromSerialized(launch));
  }
  _startMcp(id, launch) {
    if (launch.type === McpServerTransportType.SSE) {
      this._sseEventSources.set(id, new McpSSEHandle(this._eventSource.value, id, launch, this._proxy));
      return;
    }
    throw new Error("not implemented");
  }
  $stopMcp(id) {
    if (this._sseEventSources.has(id)) {
      this._sseEventSources.deleteAndDispose(id);
      this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Stopped });
    }
  }
  $sendMessage(id, message) {
    this._sseEventSources.get(id)?.send(message);
  }
  async $waitForInitialCollectionProviders() {
    await Promise.all(this._initialProviderPromises);
  }
  /** {@link vscode.lm.registerMcpConfigurationProvider} */
  registerMcpConfigurationProvider(extension, id, provider) {
    const store = new DisposableStore();
    const metadata = extension.contributes?.modelContextServerCollections?.find((m) => m.id === id);
    if (!metadata) {
      throw new Error(`MCP configuration providers must be registered in the contributes.modelContextServerCollections array within your package.json, but "${id}" was not`);
    }
    const mcp = {
      id: extensionPrefixedIdentifier(extension.identifier, id),
      isTrustedByDefault: true,
      label: metadata?.label ?? extension.displayName ?? extension.name,
      scope: StorageScope.WORKSPACE
    };
    const update = async () => {
      const list = await provider.provideMcpServerDefinitions(CancellationToken.None);
      function isSSEConfig(candidate) {
        return !!candidate.uri;
      }
      const servers = [];
      for (const item of list ?? []) {
        servers.push({
          id: ExtensionIdentifier.toKey(extension.identifier),
          label: item.label,
          launch: isSSEConfig(item) ? {
            type: McpServerTransportType.SSE,
            uri: item.uri,
            headers: item.headers
          } : {
            type: McpServerTransportType.Stdio,
            cwd: item.cwd,
            args: item.args,
            command: item.command,
            env: item.env,
            envFile: void 0
          }
        });
      }
      this._proxy.$upsertMcpCollection(mcp, servers);
    };
    store.add(toDisposable(() => {
      this._proxy.$deleteMcpCollection(mcp.id);
    }));
    if (provider.onDidChange) {
      store.add(provider.onDidChange(update));
    }
    const promise = new Promise((resolve) => {
      setTimeout(() => update().finally(() => {
        this._initialProviderPromises.delete(promise);
        resolve();
      }), 0);
    });
    this._initialProviderPromises.add(promise);
    return store;
  }
};
ExtHostMcpService = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostMcpService);
class McpSSEHandle extends Disposable {
  constructor(eventSourceCtor, _id, launch, _proxy) {
    super();
    this._id = _id;
    this._proxy = _proxy;
    this._requestSequencer = new Sequencer();
    this._postEndpoint = new DeferredPromise();
    eventSourceCtor.then((EventSourceCtor) => this._attach(EventSourceCtor, launch));
  }
  _attach(EventSourceCtor, launch) {
    if (this._store.isDisposed) {
      return;
    }
    const eventSource = new EventSourceCtor(launch.uri.toString(), {
      // recommended way to do things https://github.com/EventSource/eventsource?tab=readme-ov-file#setting-http-request-headers
      fetch: (input, init) => fetch(input, {
        ...init,
        headers: {
          ...Object.fromEntries(launch.headers),
          ...init?.headers
        }
      }).then(async (res) => {
        if (res.status >= 300) {
          this._proxy.$onDidChangeState(this._id, { state: McpConnectionState.Kind.Error, message: `${res.status} status connecting to ${launch.uri}: ${await this._getErrText(res)}` });
          eventSource.close();
        }
        return res;
      }, (err) => {
        this._proxy.$onDidChangeState(this._id, { state: McpConnectionState.Kind.Error, message: `Error connecting to ${launch.uri}: ${String(err)}` });
        eventSource.close();
        return Promise.reject(err);
      })
    });
    this._register(toDisposable(() => eventSource.close()));
    eventSource.addEventListener("endpoint", (e) => {
      this._postEndpoint.complete(new URL(e.data, launch.uri.toString()).toString());
    });
    eventSource.addEventListener("message", (e) => {
      this._proxy.$onDidReceiveMessage(this._id, e.data);
    });
    eventSource.addEventListener("open", () => {
      this._proxy.$onDidChangeState(this._id, { state: McpConnectionState.Kind.Running });
    });
    eventSource.addEventListener("error", (err) => {
      this._postEndpoint.cancel();
      this._proxy.$onDidChangeState(this._id, {
        state: McpConnectionState.Kind.Error,
        message: `Error connecting to ${launch.uri}: ${err.code || 0} ${err.message || JSON.stringify(err)}`
      });
      eventSource.close();
    });
  }
  async send(message) {
    try {
      const res = await this._requestSequencer.queue(async () => {
        const endpoint = await this._postEndpoint.p;
        const asBytes = new TextEncoder().encode(message);
        return fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(asBytes.length)
          },
          body: asBytes
        });
      });
      if (res.status >= 300) {
        this._proxy.$onDidPublishLog(this._id, LogLevel.Warning, `${res.status} status sending message to ${this._postEndpoint}: ${await this._getErrText(res)}`);
      }
    } catch (err) {
    }
  }
  async _getErrText(res) {
    try {
      return await res.text();
    } catch {
      return res.statusText;
    }
  }
}
export {
  ExtHostMcpService,
  IExtHostMpcService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0TWNwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgKiBhcyBFUyBmcm9tICdAYzQzMTIvZXZlbnRzb3VyY2UtdW1kJztcbmltcG9ydCAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgaW1wb3J0QU1ETm9kZU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uL2FtZFguanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCBTZXF1ZW5jZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFN0b3JhZ2VTY29wZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgZXh0ZW5zaW9uUHJlZml4ZWRJZGVudGlmaWVyLCBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbiwgTWNwQ29ubmVjdGlvblN0YXRlLCBNY3BTZXJ2ZXJEZWZpbml0aW9uLCBNY3BTZXJ2ZXJMYXVuY2gsIE1jcFNlcnZlclRyYW5zcG9ydFNTRSwgTWNwU2VydmVyVHJhbnNwb3J0VHlwZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BUeXBlcy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0TWNwU2hhcGUsIE1haW5Db250ZXh0LCBNYWluVGhyZWFkTWNwU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RScGNTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0UnBjU2VydmljZS5qcyc7XG5pbXBvcnQgeyBMb2dMZXZlbCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcblxuZXhwb3J0IGNvbnN0IElFeHRIb3N0TXBjU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJRXh0SG9zdE1wY1NlcnZpY2U+KCdJRXh0SG9zdE1wY1NlcnZpY2UnKTtcblxuZXhwb3J0IGludGVyZmFjZSBJRXh0SG9zdE1wY1NlcnZpY2UgZXh0ZW5kcyBFeHRIb3N0TWNwU2hhcGUge1xuXHRyZWdpc3Rlck1jcENvbmZpZ3VyYXRpb25Qcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWQ6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5NY3BDb25maWd1cmF0aW9uUHJvdmlkZXIpOiBJRGlzcG9zYWJsZTtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dEhvc3RNY3BTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRIb3N0TXBjU2VydmljZSB7XG5cdHByb3RlY3RlZCBfcHJveHk6IE1haW5UaHJlYWRNY3BTaGFwZTtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5pdGlhbFByb3ZpZGVyUHJvbWlzZXMgPSBuZXcgU2V0PFByb21pc2U8dm9pZD4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NzZUV2ZW50U291cmNlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPG51bWJlciwgTWNwU1NFSGFuZGxlPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZXZlbnRTb3VyY2UgPSBuZXcgTGF6eShhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZXMgPSBhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBFUz4oJ0BjNDMxMi9ldmVudHNvdXJjZS11bWQnLCAnZGlzdC9pbmRleC51bWQuanMnKTtcblx0XHRyZXR1cm4gZXMuRXZlbnRTb3VyY2U7XG5cdH0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwYzogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdFJwYy5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkTWNwKTtcblx0fVxuXG5cdCRzdGFydE1jcChpZDogbnVtYmVyLCBsYXVuY2g6IE1jcFNlcnZlckxhdW5jaC5TZXJpYWxpemVkKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RhcnRNY3AoaWQsIE1jcFNlcnZlckxhdW5jaC5mcm9tU2VyaWFsaXplZChsYXVuY2gpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfc3RhcnRNY3AoaWQ6IG51bWJlciwgbGF1bmNoOiBNY3BTZXJ2ZXJMYXVuY2gpOiB2b2lkIHtcblx0XHRpZiAobGF1bmNoLnR5cGUgPT09IE1jcFNlcnZlclRyYW5zcG9ydFR5cGUuU1NFKSB7XG5cdFx0XHR0aGlzLl9zc2VFdmVudFNvdXJjZXMuc2V0KGlkLCBuZXcgTWNwU1NFSGFuZGxlKHRoaXMuX2V2ZW50U291cmNlLnZhbHVlLCBpZCwgbGF1bmNoLCB0aGlzLl9wcm94eSkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG5cdH1cblxuXHQkc3RvcE1jcChpZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3NzZUV2ZW50U291cmNlcy5oYXMoaWQpKSB7XG5cdFx0XHR0aGlzLl9zc2VFdmVudFNvdXJjZXMuZGVsZXRlQW5kRGlzcG9zZShpZCk7XG5cdFx0XHR0aGlzLl9wcm94eS4kb25EaWRDaGFuZ2VTdGF0ZShpZCwgeyBzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuU3RvcHBlZCB9KTtcblx0XHR9XG5cdH1cblxuXHQkc2VuZE1lc3NhZ2UoaWQ6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fc3NlRXZlbnRTb3VyY2VzLmdldChpZCk/LnNlbmQobWVzc2FnZSk7XG5cdH1cblxuXHRhc3luYyAkd2FpdEZvckluaXRpYWxDb2xsZWN0aW9uUHJvdmlkZXJzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKHRoaXMuX2luaXRpYWxQcm92aWRlclByb21pc2VzKTtcblx0fVxuXG5cdC8qKiB7QGxpbmsgdnNjb2RlLmxtLnJlZ2lzdGVyTWNwQ29uZmlndXJhdGlvblByb3ZpZGVyfSAqL1xuXHRwdWJsaWMgcmVnaXN0ZXJNY3BDb25maWd1cmF0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGlkOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuTWNwQ29uZmlndXJhdGlvblByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3QgbWV0YWRhdGEgPSBleHRlbnNpb24uY29udHJpYnV0ZXM/Lm1vZGVsQ29udGV4dFNlcnZlckNvbGxlY3Rpb25zPy5maW5kKG0gPT4gbS5pZCA9PT0gaWQpO1xuXHRcdGlmICghbWV0YWRhdGEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTUNQIGNvbmZpZ3VyYXRpb24gcHJvdmlkZXJzIG11c3QgYmUgcmVnaXN0ZXJlZCBpbiB0aGUgY29udHJpYnV0ZXMubW9kZWxDb250ZXh0U2VydmVyQ29sbGVjdGlvbnMgYXJyYXkgd2l0aGluIHlvdXIgcGFja2FnZS5qc29uLCBidXQgXCIke2lkfVwiIHdhcyBub3RgKTtcblx0XHR9XG5cblx0XHRjb25zdCBtY3A6IE1jcENvbGxlY3Rpb25EZWZpbml0aW9uLkZyb21FeHRIb3N0ID0ge1xuXHRcdFx0aWQ6IGV4dGVuc2lvblByZWZpeGVkSWRlbnRpZmllcihleHRlbnNpb24uaWRlbnRpZmllciwgaWQpLFxuXHRcdFx0aXNUcnVzdGVkQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0bGFiZWw6IG1ldGFkYXRhPy5sYWJlbCA/PyBleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLm5hbWUsXG5cdFx0XHRzY29wZTogU3RvcmFnZVNjb3BlLldPUktTUEFDRVxuXHRcdH07XG5cblx0XHRjb25zdCB1cGRhdGUgPSBhc3luYyAoKSA9PiB7XG5cblx0XHRcdGNvbnN0IGxpc3QgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlTWNwU2VydmVyRGVmaW5pdGlvbnMoQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRcdGZ1bmN0aW9uIGlzU1NFQ29uZmlnKGNhbmRpZGF0ZTogdnNjb2RlLk1jcFNlcnZlckRlZmluaXRpb24pOiBjYW5kaWRhdGUgaXMgdnNjb2RlLk1jcFNTRVNlcnZlckRlZmluaXRpb24ge1xuXHRcdFx0XHRyZXR1cm4gISEoY2FuZGlkYXRlIGFzIHZzY29kZS5NY3BTU0VTZXJ2ZXJEZWZpbml0aW9uKS51cmk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNlcnZlcnM6IE1jcFNlcnZlckRlZmluaXRpb25bXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgbGlzdCA/PyBbXSkge1xuXHRcdFx0XHRzZXJ2ZXJzLnB1c2goe1xuXHRcdFx0XHRcdGlkOiBFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbi5pZGVudGlmaWVyKSxcblx0XHRcdFx0XHRsYWJlbDogaXRlbS5sYWJlbCxcblx0XHRcdFx0XHRsYXVuY2g6IGlzU1NFQ29uZmlnKGl0ZW0pXG5cdFx0XHRcdFx0XHQ/IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogTWNwU2VydmVyVHJhbnNwb3J0VHlwZS5TU0UsXG5cdFx0XHRcdFx0XHRcdHVyaTogaXRlbS51cmksXG5cdFx0XHRcdFx0XHRcdGhlYWRlcnM6IGl0ZW0uaGVhZGVycyxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdDoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiBNY3BTZXJ2ZXJUcmFuc3BvcnRUeXBlLlN0ZGlvLFxuXHRcdFx0XHRcdFx0XHRjd2Q6IGl0ZW0uY3dkLFxuXHRcdFx0XHRcdFx0XHRhcmdzOiBpdGVtLmFyZ3MsXG5cdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IGl0ZW0uY29tbWFuZCxcblx0XHRcdFx0XHRcdFx0ZW52OiBpdGVtLmVudixcblx0XHRcdFx0XHRcdFx0ZW52RmlsZTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcHJveHkuJHVwc2VydE1jcENvbGxlY3Rpb24obWNwLCBzZXJ2ZXJzKTtcblx0XHR9O1xuXG5cdFx0c3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9wcm94eS4kZGVsZXRlTWNwQ29sbGVjdGlvbihtY3AuaWQpO1xuXHRcdH0pKTtcblxuXHRcdGlmIChwcm92aWRlci5vbkRpZENoYW5nZSkge1xuXHRcdFx0c3RvcmUuYWRkKHByb3ZpZGVyLm9uRGlkQ2hhbmdlKHVwZGF0ZSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4gdXBkYXRlKCkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2luaXRpYWxQcm92aWRlclByb21pc2VzLmRlbGV0ZShwcm9taXNlKTtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0fSksIDApO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5faW5pdGlhbFByb3ZpZGVyUHJvbWlzZXMuYWRkKHByb21pc2UpO1xuXG5cdFx0cmV0dXJuIHN0b3JlO1xuXHR9XG59XG5cbmNsYXNzIE1jcFNTRUhhbmRsZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXF1ZXN0U2VxdWVuY2VyID0gbmV3IFNlcXVlbmNlcigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wb3N0RW5kcG9pbnQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHN0cmluZz4oKTtcblx0Y29uc3RydWN0b3IoXG5cdFx0ZXZlbnRTb3VyY2VDdG9yOiBQcm9taXNlPHR5cGVvZiBFUy5FdmVudFNvdXJjZT4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaWQ6IG51bWJlcixcblx0XHRsYXVuY2g6IE1jcFNlcnZlclRyYW5zcG9ydFNTRSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogTWFpblRocmVhZE1jcFNoYXBlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0ZXZlbnRTb3VyY2VDdG9yLnRoZW4oRXZlbnRTb3VyY2VDdG9yID0+IHRoaXMuX2F0dGFjaChFdmVudFNvdXJjZUN0b3IsIGxhdW5jaCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXR0YWNoKEV2ZW50U291cmNlQ3RvcjogdHlwZW9mIEVTLkV2ZW50U291cmNlLCBsYXVuY2g6IE1jcFNlcnZlclRyYW5zcG9ydFNTRSkge1xuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXZlbnRTb3VyY2UgPSBuZXcgRXZlbnRTb3VyY2VDdG9yKGxhdW5jaC51cmkudG9TdHJpbmcoKSwge1xuXHRcdFx0Ly8gcmVjb21tZW5kZWQgd2F5IHRvIGRvIHRoaW5ncyBodHRwczovL2dpdGh1Yi5jb20vRXZlbnRTb3VyY2UvZXZlbnRzb3VyY2U/dGFiPXJlYWRtZS1vdi1maWxlI3NldHRpbmctaHR0cC1yZXF1ZXN0LWhlYWRlcnNcblx0XHRcdGZldGNoOiAoaW5wdXQsIGluaXQpID0+XG5cdFx0XHRcdGZldGNoKGlucHV0LCB7XG5cdFx0XHRcdFx0Li4uaW5pdCxcblx0XHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0XHQuLi5PYmplY3QuZnJvbUVudHJpZXMobGF1bmNoLmhlYWRlcnMpLFxuXHRcdFx0XHRcdFx0Li4uaW5pdD8uaGVhZGVycyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KS50aGVuKGFzeW5jIHJlcyA9PiB7XG5cdFx0XHRcdFx0Ly8gd2UgZ2V0IG1vcmUgZGV0YWlscyBvbiBmYWlsdXJlIGF0IHRoaXMgcG9pbnQsIHNvIGhhbmRsZSBpdCBleHBsaWNpdGx5OlxuXHRcdFx0XHRcdGlmIChyZXMuc3RhdHVzID49IDMwMCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fcHJveHkuJG9uRGlkQ2hhbmdlU3RhdGUodGhpcy5faWQsIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLkVycm9yLCBtZXNzYWdlOiBgJHtyZXMuc3RhdHVzfSBzdGF0dXMgY29ubmVjdGluZyB0byAke2xhdW5jaC51cml9OiAke2F3YWl0IHRoaXMuX2dldEVyclRleHQocmVzKX1gIH0pO1xuXHRcdFx0XHRcdFx0ZXZlbnRTb3VyY2UuY2xvc2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHJlcztcblx0XHRcdFx0fSwgZXJyID0+IHtcblx0XHRcdFx0XHR0aGlzLl9wcm94eS4kb25EaWRDaGFuZ2VTdGF0ZSh0aGlzLl9pZCwgeyBzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuRXJyb3IsIG1lc3NhZ2U6IGBFcnJvciBjb25uZWN0aW5nIHRvICR7bGF1bmNoLnVyaX06ICR7U3RyaW5nKGVycil9YCB9KTtcblxuXHRcdFx0XHRcdGV2ZW50U291cmNlLmNsb3NlKCk7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG5cdFx0XHRcdH0pXG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gZXZlbnRTb3VyY2UuY2xvc2UoKSkpO1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21vZGVsY29udGV4dHByb3RvY29sL3R5cGVzY3JpcHQtc2RrL2Jsb2IvMGZhMjM5NzE3NGViYTMwOWI1NDU3NTI5NGQ1Njc1NGM1MmIxM2E2NS9zcmMvc2VydmVyL3NzZS50cyNMNTJcblx0XHRldmVudFNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdlbmRwb2ludCcsIGUgPT4ge1xuXHRcdFx0dGhpcy5fcG9zdEVuZHBvaW50LmNvbXBsZXRlKG5ldyBVUkwoZS5kYXRhLCBsYXVuY2gudXJpLnRvU3RyaW5nKCkpLnRvU3RyaW5nKCkpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21vZGVsY29udGV4dHByb3RvY29sL3R5cGVzY3JpcHQtc2RrL2Jsb2IvMGZhMjM5NzE3NGViYTMwOWI1NDU3NTI5NGQ1Njc1NGM1MmIxM2E2NS9zcmMvc2VydmVyL3NzZS50cyNMMTMzXG5cdFx0ZXZlbnRTb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGUgPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJG9uRGlkUmVjZWl2ZU1lc3NhZ2UodGhpcy5faWQsIGUuZGF0YSk7XG5cdFx0fSk7XG5cblx0XHRldmVudFNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJG9uRGlkQ2hhbmdlU3RhdGUodGhpcy5faWQsIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlJ1bm5pbmcgfSk7XG5cdFx0fSk7XG5cblx0XHRldmVudFNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIChlcnIpID0+IHtcblx0XHRcdHRoaXMuX3Bvc3RFbmRwb2ludC5jYW5jZWwoKTtcblx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZENoYW5nZVN0YXRlKHRoaXMuX2lkLCB7XG5cdFx0XHRcdHN0YXRlOiBNY3BDb25uZWN0aW9uU3RhdGUuS2luZC5FcnJvcixcblx0XHRcdFx0bWVzc2FnZTogYEVycm9yIGNvbm5lY3RpbmcgdG8gJHtsYXVuY2gudXJpfTogJHtlcnIuY29kZSB8fCAwfSAke2Vyci5tZXNzYWdlIHx8IEpTT04uc3RyaW5naWZ5KGVycil9YCxcblx0XHRcdH0pO1xuXHRcdFx0ZXZlbnRTb3VyY2UuY2xvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHNlbmQobWVzc2FnZTogc3RyaW5nKSB7XG5cdFx0Ly8gb25seSB0aGUgc2VuZGluZyBvZiB0aGUgcmVxdWVzdCBuZWVkcyB0byBiZSBzZXF1ZW5jZWRcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzID0gYXdhaXQgdGhpcy5fcmVxdWVzdFNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVuZHBvaW50ID0gYXdhaXQgdGhpcy5fcG9zdEVuZHBvaW50LnA7XG5cdFx0XHRcdGNvbnN0IGFzQnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUobWVzc2FnZSk7XG5cblx0XHRcdFx0cmV0dXJuIGZldGNoKGVuZHBvaW50LCB7XG5cdFx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0XHRcdCdDb250ZW50LUxlbmd0aCc6IFN0cmluZyhhc0J5dGVzLmxlbmd0aCksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRib2R5OiBhc0J5dGVzLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAocmVzLnN0YXR1cyA+PSAzMDApIHtcblx0XHRcdFx0dGhpcy5fcHJveHkuJG9uRGlkUHVibGlzaExvZyh0aGlzLl9pZCwgTG9nTGV2ZWwuV2FybmluZywgYCR7cmVzLnN0YXR1c30gc3RhdHVzIHNlbmRpbmcgbWVzc2FnZSB0byAke3RoaXMuX3Bvc3RFbmRwb2ludH06ICR7YXdhaXQgdGhpcy5fZ2V0RXJyVGV4dChyZXMpfWApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Ly8gaWdub3JlZFxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dldEVyclRleHQocmVzOiBSZXNwb25zZSkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgcmVzLnRleHQoKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiByZXMuc3RhdHVzVGV4dDtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBT0EsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxpQkFBaUIsaUJBQWlCO0FBQzNDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsWUFBWTtBQUNyQixTQUFTLFlBQVksZUFBZSxpQkFBOEIsb0JBQW9CO0FBQ3RGLFNBQVMsMkJBQWtEO0FBQzNELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQXNELG9CQUF5QyxpQkFBd0MsOEJBQThCO0FBQzlLLFNBQTBC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
