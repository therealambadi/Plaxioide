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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { SocketCloseEventType } from "../../../base/parts/ipc/common/ipc.net.js";
import { ManagedSocket, connectManagedSocket } from "../../../platform/remote/common/managedSocket.js";
import { RemoteConnectionType } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteSocketFactoryService } from "../../../platform/remote/common/remoteSocketFactoryService.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadManagedSockets = class extends Disposable {
  constructor(extHostContext, _remoteSocketFactoryService) {
    super();
    this._remoteSocketFactoryService = _remoteSocketFactoryService;
    this._registrations = /* @__PURE__ */ new Map();
    this._remoteSockets = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostManagedSockets);
  }
  async $registerSocketFactory(socketFactoryId) {
    const that = this;
    const socketFactory = new class {
      supports(connectTo) {
        return connectTo.id === socketFactoryId;
      }
      connect(connectTo, path, query, debugLabel) {
        return new Promise((resolve, reject) => {
          if (connectTo.id !== socketFactoryId) {
            return reject(new Error("Invalid connectTo"));
          }
          const factoryId = connectTo.id;
          that._proxy.$openRemoteSocket(factoryId).then((socketId) => {
            const half = {
              onClose: new Emitter(),
              onData: new Emitter(),
              onEnd: new Emitter()
            };
            that._remoteSockets.set(socketId, half);
            MainThreadManagedSocket.connect(socketId, that._proxy, path, query, debugLabel, half).then(
              (socket) => {
                socket.onDidDispose(() => that._remoteSockets.delete(socketId));
                resolve(socket);
              },
              (err) => {
                that._remoteSockets.delete(socketId);
                reject(err);
              }
            );
          }).catch(reject);
        });
      }
    }();
    this._registrations.set(socketFactoryId, this._remoteSocketFactoryService.register(RemoteConnectionType.Managed, socketFactory));
  }
  async $unregisterSocketFactory(socketFactoryId) {
    this._registrations.get(socketFactoryId)?.dispose();
  }
  $onDidManagedSocketHaveData(socketId, data) {
    this._remoteSockets.get(socketId)?.onData.fire(data);
  }
  $onDidManagedSocketClose(socketId, error) {
    this._remoteSockets.get(socketId)?.onClose.fire({
      type: SocketCloseEventType.NodeSocketCloseEvent,
      error: error ? new Error(error) : void 0,
      hadError: !!error
    });
    this._remoteSockets.delete(socketId);
  }
  $onDidManagedSocketEnd(socketId) {
    this._remoteSockets.get(socketId)?.onEnd.fire();
  }
};
MainThreadManagedSockets = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadManagedSockets),
  __decorateParam(1, IRemoteSocketFactoryService)
], MainThreadManagedSockets);
class MainThreadManagedSocket extends ManagedSocket {
  constructor(socketId, proxy, debugLabel, half) {
    super(debugLabel, half);
    this.socketId = socketId;
    this.proxy = proxy;
  }
  static connect(socketId, proxy, path, query, debugLabel, half) {
    const socket = new MainThreadManagedSocket(socketId, proxy, debugLabel, half);
    return connectManagedSocket(socket, path, query, debugLabel, half);
  }
  write(buffer) {
    this.proxy.$remoteSocketWrite(this.socketId, buffer);
  }
  closeRemote() {
    this.proxy.$remoteSocketEnd(this.socketId);
  }
  drain() {
    return this.proxy.$remoteSocketDrain(this.socketId);
  }
}
export {
  MainThreadManagedSocket,
  MainThreadManagedSockets
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZE1hbmFnZWRTb2NrZXRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElTb2NrZXQsIFNvY2tldENsb3NlRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5uZXQuanMnO1xuaW1wb3J0IHsgTWFuYWdlZFNvY2tldCwgUmVtb3RlU29ja2V0SGFsZiwgY29ubmVjdE1hbmFnZWRTb2NrZXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL21hbmFnZWRTb2NrZXQuanMnO1xuaW1wb3J0IHsgTWFuYWdlZFJlbW90ZUNvbm5lY3Rpb24sIFJlbW90ZUNvbm5lY3Rpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UsIElTb2NrZXRGYWN0b3J5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q29udGV4dCwgRXh0SG9zdE1hbmFnZWRTb2NrZXRzU2hhcGUsIE1haW5Db250ZXh0LCBNYWluVGhyZWFkTWFuYWdlZFNvY2tldHNTaGFwZSB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElFeHRIb3N0Q29udGV4dCwgZXh0SG9zdE5hbWVkQ3VzdG9tZXIgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRIb3N0Q3VzdG9tZXJzLmpzJztcblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWRNYW5hZ2VkU29ja2V0cylcbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkTWFuYWdlZFNvY2tldHMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgTWFpblRocmVhZE1hbmFnZWRTb2NrZXRzU2hhcGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0TWFuYWdlZFNvY2tldHNTaGFwZTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVnaXN0cmF0aW9ucyA9IG5ldyBNYXA8bnVtYmVyLCBJRGlzcG9zYWJsZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVtb3RlU29ja2V0cyA9IG5ldyBNYXA8bnVtYmVyLCBSZW1vdGVTb2NrZXRIYWxmPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElSZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9yZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZTogSVJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdE1hbmFnZWRTb2NrZXRzKTtcblx0fVxuXG5cdGFzeW5jICRyZWdpc3RlclNvY2tldEZhY3Rvcnkoc29ja2V0RmFjdG9yeUlkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBzb2NrZXRGYWN0b3J5ID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSVNvY2tldEZhY3Rvcnk8UmVtb3RlQ29ubmVjdGlvblR5cGUuTWFuYWdlZD4ge1xuXG5cdFx0XHRzdXBwb3J0cyhjb25uZWN0VG86IE1hbmFnZWRSZW1vdGVDb25uZWN0aW9uKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiAoY29ubmVjdFRvLmlkID09PSBzb2NrZXRGYWN0b3J5SWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25uZWN0KGNvbm5lY3RUbzogTWFuYWdlZFJlbW90ZUNvbm5lY3Rpb24sIHBhdGg6IHN0cmluZywgcXVlcnk6IHN0cmluZywgZGVidWdMYWJlbDogc3RyaW5nKTogUHJvbWlzZTxJU29ja2V0PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTxJU29ja2V0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbm5lY3RUby5pZCAhPT0gc29ja2V0RmFjdG9yeUlkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KG5ldyBFcnJvcignSW52YWxpZCBjb25uZWN0VG8nKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZmFjdG9yeUlkID0gY29ubmVjdFRvLmlkO1xuXHRcdFx0XHRcdHRoYXQuX3Byb3h5LiRvcGVuUmVtb3RlU29ja2V0KGZhY3RvcnlJZCkudGhlbihzb2NrZXRJZCA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBoYWxmOiBSZW1vdGVTb2NrZXRIYWxmID0ge1xuXHRcdFx0XHRcdFx0XHRvbkNsb3NlOiBuZXcgRW1pdHRlcigpLFxuXHRcdFx0XHRcdFx0XHRvbkRhdGE6IG5ldyBFbWl0dGVyKCksXG5cdFx0XHRcdFx0XHRcdG9uRW5kOiBuZXcgRW1pdHRlcigpLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHRoYXQuX3JlbW90ZVNvY2tldHMuc2V0KHNvY2tldElkLCBoYWxmKTtcblxuXHRcdFx0XHRcdFx0TWFpblRocmVhZE1hbmFnZWRTb2NrZXQuY29ubmVjdChzb2NrZXRJZCwgdGhhdC5fcHJveHksIHBhdGgsIHF1ZXJ5LCBkZWJ1Z0xhYmVsLCBoYWxmKVxuXHRcdFx0XHRcdFx0XHQudGhlbihcblx0XHRcdFx0XHRcdFx0XHRzb2NrZXQgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0c29ja2V0Lm9uRGlkRGlzcG9zZSgoKSA9PiB0aGF0Ll9yZW1vdGVTb2NrZXRzLmRlbGV0ZShzb2NrZXRJZCkpO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZShzb2NrZXQpO1xuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0ZXJyID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoYXQuX3JlbW90ZVNvY2tldHMuZGVsZXRlKHNvY2tldElkKTtcblx0XHRcdFx0XHRcdFx0XHRcdHJlamVjdChlcnIpO1xuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pLmNhdGNoKHJlamVjdCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoc29ja2V0RmFjdG9yeUlkLCB0aGlzLl9yZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZS5yZWdpc3RlcihSZW1vdGVDb25uZWN0aW9uVHlwZS5NYW5hZ2VkLCBzb2NrZXRGYWN0b3J5KSk7XG5cblx0fVxuXG5cdGFzeW5jICR1bnJlZ2lzdGVyU29ja2V0RmFjdG9yeShzb2NrZXRGYWN0b3J5SWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuZ2V0KHNvY2tldEZhY3RvcnlJZCk/LmRpc3Bvc2UoKTtcblx0fVxuXG5cdCRvbkRpZE1hbmFnZWRTb2NrZXRIYXZlRGF0YShzb2NrZXRJZDogbnVtYmVyLCBkYXRhOiBWU0J1ZmZlcik6IHZvaWQge1xuXHRcdHRoaXMuX3JlbW90ZVNvY2tldHMuZ2V0KHNvY2tldElkKT8ub25EYXRhLmZpcmUoZGF0YSk7XG5cdH1cblxuXHQkb25EaWRNYW5hZ2VkU29ja2V0Q2xvc2Uoc29ja2V0SWQ6IG51bWJlciwgZXJyb3I6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlbW90ZVNvY2tldHMuZ2V0KHNvY2tldElkKT8ub25DbG9zZS5maXJlKHtcblx0XHRcdHR5cGU6IFNvY2tldENsb3NlRXZlbnRUeXBlLk5vZGVTb2NrZXRDbG9zZUV2ZW50LFxuXHRcdFx0ZXJyb3I6IGVycm9yID8gbmV3IEVycm9yKGVycm9yKSA6IHVuZGVmaW5lZCxcblx0XHRcdGhhZEVycm9yOiAhIWVycm9yXG5cdFx0fSk7XG5cdFx0dGhpcy5fcmVtb3RlU29ja2V0cy5kZWxldGUoc29ja2V0SWQpO1xuXHR9XG5cblx0JG9uRGlkTWFuYWdlZFNvY2tldEVuZChzb2NrZXRJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVtb3RlU29ja2V0cy5nZXQoc29ja2V0SWQpPy5vbkVuZC5maXJlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRNYW5hZ2VkU29ja2V0IGV4dGVuZHMgTWFuYWdlZFNvY2tldCB7XG5cdHB1YmxpYyBzdGF0aWMgY29ubmVjdChcblx0XHRzb2NrZXRJZDogbnVtYmVyLFxuXHRcdHByb3h5OiBFeHRIb3N0TWFuYWdlZFNvY2tldHNTaGFwZSxcblx0XHRwYXRoOiBzdHJpbmcsIHF1ZXJ5OiBzdHJpbmcsIGRlYnVnTGFiZWw6IHN0cmluZyxcblx0XHRoYWxmOiBSZW1vdGVTb2NrZXRIYWxmXG5cdCk6IFByb21pc2U8TWFpblRocmVhZE1hbmFnZWRTb2NrZXQ+IHtcblx0XHRjb25zdCBzb2NrZXQgPSBuZXcgTWFpblRocmVhZE1hbmFnZWRTb2NrZXQoc29ja2V0SWQsIHByb3h5LCBkZWJ1Z0xhYmVsLCBoYWxmKTtcblx0XHRyZXR1cm4gY29ubmVjdE1hbmFnZWRTb2NrZXQoc29ja2V0LCBwYXRoLCBxdWVyeSwgZGVidWdMYWJlbCwgaGFsZik7XG5cdH1cblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc29ja2V0SWQ6IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb3h5OiBFeHRIb3N0TWFuYWdlZFNvY2tldHNTaGFwZSxcblx0XHRkZWJ1Z0xhYmVsOiBzdHJpbmcsXG5cdFx0aGFsZjogUmVtb3RlU29ja2V0SGFsZixcblx0KSB7XG5cdFx0c3VwZXIoZGVidWdMYWJlbCwgaGFsZik7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgd3JpdGUoYnVmZmVyOiBWU0J1ZmZlcik6IHZvaWQge1xuXHRcdHRoaXMucHJveHkuJHJlbW90ZVNvY2tldFdyaXRlKHRoaXMuc29ja2V0SWQsIGJ1ZmZlcik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgIGNsb3NlUmVtb3RlKCk6IHZvaWQge1xuXHRcdHRoaXMucHJveHkuJHJlbW90ZVNvY2tldEVuZCh0aGlzLnNvY2tldElkKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkcmFpbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5wcm94eS4kcmVtb3RlU29ja2V0RHJhaW4odGhpcy5zb2NrZXRJZCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEs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
