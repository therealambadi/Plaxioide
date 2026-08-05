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
import { URI } from "../../../base/common/uri.js";
import { Emitter } from "../../../base/common/event.js";
import { dispose } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IDecorationsService } from "../../services/decorations/common/decorations.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
class DecorationRequestsQueue {
  constructor(_proxy, _handle) {
    this._proxy = _proxy;
    this._handle = _handle;
    this._idPool = 0;
    this._requests = /* @__PURE__ */ new Map();
    this._resolver = /* @__PURE__ */ new Map();
  }
  enqueue(uri, token) {
    const id = ++this._idPool;
    const result = new Promise((resolve) => {
      this._requests.set(id, { id, uri });
      this._resolver.set(id, resolve);
      this._processQueue();
    });
    const sub = token.onCancellationRequested(() => {
      this._requests.delete(id);
      this._resolver.delete(id);
    });
    return result.finally(() => sub.dispose());
  }
  _processQueue() {
    if (typeof this._timer === "number") {
      return;
    }
    this._timer = setTimeout(() => {
      const requests = this._requests;
      const resolver = this._resolver;
      this._proxy.$provideDecorations(this._handle, [...requests.values()], CancellationToken.None).then((data) => {
        for (const [id, resolve] of resolver) {
          resolve(data[id]);
        }
      });
      this._requests = /* @__PURE__ */ new Map();
      this._resolver = /* @__PURE__ */ new Map();
      this._timer = void 0;
    }, 0);
  }
}
let MainThreadDecorations = class {
  constructor(context, _decorationsService) {
    this._decorationsService = _decorationsService;
    this._provider = /* @__PURE__ */ new Map();
    this._proxy = context.getProxy(ExtHostContext.ExtHostDecorations);
  }
  dispose() {
    this._provider.forEach((value) => dispose(value));
    this._provider.clear();
  }
  $registerDecorationProvider(handle, label) {
    const emitter = new Emitter();
    const queue = new DecorationRequestsQueue(this._proxy, handle);
    const registration = this._decorationsService.registerDecorationsProvider({
      label,
      onDidChange: emitter.event,
      provideDecorations: async (uri, token) => {
        const data = await queue.enqueue(uri, token);
        if (!data) {
          return void 0;
        }
        const [bubble, tooltip, letter, themeColor] = data;
        return {
          weight: 10,
          bubble: bubble ?? false,
          color: themeColor?.id,
          tooltip,
          letter
        };
      }
    });
    this._provider.set(handle, [emitter, registration]);
  }
  $onDidChange(handle, resources) {
    const provider = this._provider.get(handle);
    if (provider) {
      const [emitter] = provider;
      emitter.fire(resources && resources.map((r) => URI.revive(r)));
    }
  }
  $unregisterDecorationProvider(handle) {
    const provider = this._provider.get(handle);
    if (provider) {
      dispose(provider);
      this._provider.delete(handle);
    }
  }
};
MainThreadDecorations = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDecorations),
  __decorateParam(1, IDecorationsService)
], MainThreadDecorations);
export {
  MainThreadDecorations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZERlY29yYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q29udGV4dCwgTWFpbkNvbnRleHQsIE1haW5UaHJlYWREZWNvcmF0aW9uc1NoYXBlLCBFeHRIb3N0RGVjb3JhdGlvbnNTaGFwZSwgRGVjb3JhdGlvbkRhdGEsIERlY29yYXRpb25SZXF1ZXN0IH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgSURlY29yYXRpb25zU2VydmljZSwgSURlY29yYXRpb25EYXRhIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZGVjb3JhdGlvbnMvY29tbW9uL2RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcblxuY2xhc3MgRGVjb3JhdGlvblJlcXVlc3RzUXVldWUge1xuXG5cdHByaXZhdGUgX2lkUG9vbCA9IDA7XG5cdHByaXZhdGUgX3JlcXVlc3RzID0gbmV3IE1hcDxudW1iZXIsIERlY29yYXRpb25SZXF1ZXN0PigpO1xuXHRwcml2YXRlIF9yZXNvbHZlciA9IG5ldyBNYXA8bnVtYmVyLCAoZGF0YTogRGVjb3JhdGlvbkRhdGEpID0+IGFueT4oKTtcblxuXHRwcml2YXRlIF90aW1lcjogYW55O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0RGVjb3JhdGlvbnNTaGFwZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9oYW5kbGU6IG51bWJlclxuXHQpIHtcblx0XHQvL1xuXHR9XG5cblx0ZW5xdWV1ZSh1cmk6IFVSSSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxEZWNvcmF0aW9uRGF0YT4ge1xuXHRcdGNvbnN0IGlkID0gKyt0aGlzLl9pZFBvb2w7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFByb21pc2U8RGVjb3JhdGlvbkRhdGE+KHJlc29sdmUgPT4ge1xuXHRcdFx0dGhpcy5fcmVxdWVzdHMuc2V0KGlkLCB7IGlkLCB1cmkgfSk7XG5cdFx0XHR0aGlzLl9yZXNvbHZlci5zZXQoaWQsIHJlc29sdmUpO1xuXHRcdFx0dGhpcy5fcHJvY2Vzc1F1ZXVlKCk7XG5cdFx0fSk7XG5cdFx0Y29uc3Qgc3ViID0gdG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fcmVxdWVzdHMuZGVsZXRlKGlkKTtcblx0XHRcdHRoaXMuX3Jlc29sdmVyLmRlbGV0ZShpZCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdC5maW5hbGx5KCgpID0+IHN1Yi5kaXNwb3NlKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcHJvY2Vzc1F1ZXVlKCk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fdGltZXIgPT09ICdudW1iZXInKSB7XG5cdFx0XHQvLyBhbHJlYWR5IHF1ZXVlZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl90aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0Ly8gbWFrZSByZXF1ZXN0XG5cdFx0XHRjb25zdCByZXF1ZXN0cyA9IHRoaXMuX3JlcXVlc3RzO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZXIgPSB0aGlzLl9yZXNvbHZlcjtcblx0XHRcdHRoaXMuX3Byb3h5LiRwcm92aWRlRGVjb3JhdGlvbnModGhpcy5faGFuZGxlLCBbLi4ucmVxdWVzdHMudmFsdWVzKCldLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKS50aGVuKGRhdGEgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IFtpZCwgcmVzb2x2ZV0gb2YgcmVzb2x2ZXIpIHtcblx0XHRcdFx0XHRyZXNvbHZlKGRhdGFbaWRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIHJlc2V0XG5cdFx0XHR0aGlzLl9yZXF1ZXN0cyA9IG5ldyBNYXAoKTtcblx0XHRcdHRoaXMuX3Jlc29sdmVyID0gbmV3IE1hcCgpO1xuXHRcdFx0dGhpcy5fdGltZXIgPSB1bmRlZmluZWQ7XG5cdFx0fSwgMCk7XG5cdH1cbn1cblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWREZWNvcmF0aW9ucylcbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkRGVjb3JhdGlvbnMgaW1wbGVtZW50cyBNYWluVGhyZWFkRGVjb3JhdGlvbnNTaGFwZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXIgPSBuZXcgTWFwPG51bWJlciwgW0VtaXR0ZXI8VVJJW10+LCBJRGlzcG9zYWJsZV0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0RGVjb3JhdGlvbnNTaGFwZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElEZWNvcmF0aW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGVjb3JhdGlvbnNTZXJ2aWNlOiBJRGVjb3JhdGlvbnNTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX3Byb3h5ID0gY29udGV4dC5nZXRQcm94eShFeHRIb3N0Q29udGV4dC5FeHRIb3N0RGVjb3JhdGlvbnMpO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9wcm92aWRlci5mb3JFYWNoKHZhbHVlID0+IGRpc3Bvc2UodmFsdWUpKTtcblx0XHR0aGlzLl9wcm92aWRlci5jbGVhcigpO1xuXHR9XG5cblx0JHJlZ2lzdGVyRGVjb3JhdGlvblByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBsYWJlbDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPFVSSVtdPigpO1xuXHRcdGNvbnN0IHF1ZXVlID0gbmV3IERlY29yYXRpb25SZXF1ZXN0c1F1ZXVlKHRoaXMuX3Byb3h5LCBoYW5kbGUpO1xuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbiA9IHRoaXMuX2RlY29yYXRpb25zU2VydmljZS5yZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIoe1xuXHRcdFx0bGFiZWwsXG5cdFx0XHRvbkRpZENoYW5nZTogZW1pdHRlci5ldmVudCxcblx0XHRcdHByb3ZpZGVEZWNvcmF0aW9uczogYXN5bmMgKHVyaSwgdG9rZW4pOiBQcm9taXNlPElEZWNvcmF0aW9uRGF0YSB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgcXVldWUuZW5xdWV1ZSh1cmksIHRva2VuKTtcblx0XHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBbYnViYmxlLCB0b29sdGlwLCBsZXR0ZXIsIHRoZW1lQ29sb3JdID0gZGF0YTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR3ZWlnaHQ6IDEwLFxuXHRcdFx0XHRcdGJ1YmJsZTogYnViYmxlID8/IGZhbHNlLFxuXHRcdFx0XHRcdGNvbG9yOiB0aGVtZUNvbG9yPy5pZCxcblx0XHRcdFx0XHR0b29sdGlwLFxuXHRcdFx0XHRcdGxldHRlclxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3Byb3ZpZGVyLnNldChoYW5kbGUsIFtlbWl0dGVyLCByZWdpc3RyYXRpb25dKTtcblx0fVxuXG5cdCRvbkRpZENoYW5nZShoYW5kbGU6IG51bWJlciwgcmVzb3VyY2VzOiBVcmlDb21wb25lbnRzW10pOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX3Byb3ZpZGVyLmdldChoYW5kbGUpO1xuXHRcdGlmIChwcm92aWRlcikge1xuXHRcdFx0Y29uc3QgW2VtaXR0ZXJdID0gcHJvdmlkZXI7XG5cdFx0XHRlbWl0dGVyLmZpcmUocmVzb3VyY2VzICYmIHJlc291cmNlcy5tYXAociA9PiBVUkkucmV2aXZlKHIpKSk7XG5cdFx0fVxuXHR9XG5cblx0JHVucmVnaXN0ZXJEZWNvcmF0aW9uUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX3Byb3ZpZGVyLmdldChoYW5kbGUpO1xuXHRcdGlmIChwcm92aWRlcikge1xuXHRcdFx0ZGlzcG9zZShwcm92aWRlcik7XG5cdFx0XHR0aGlzLl9wcm92aWRlci5kZWxldGUoaGFuZGxlKTtcblx0XHR9XG5cdH1cbn1cbiJd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
