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
import { handleVetos } from "../../../../platform/lifecycle/common/lifecycle.js";
import { ILifecycleService, WillShutdownJoinerOrder } from "../common/lifecycle.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-sandbox/globals.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractLifecycleService } from "../common/lifecycleService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { Promises, disposableTimeout, raceCancellation } from "../../../../base/common/async.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
let NativeLifecycleService = class extends AbstractLifecycleService {
  constructor(nativeHostService, storageService, logService) {
    super(logService, storageService);
    this.nativeHostService = nativeHostService;
    this.registerListeners();
  }
  registerListeners() {
    const windowId = this.nativeHostService.windowId;
    ipcRenderer.on("vscode:onBeforeUnload", async (event, reply) => {
      this.logService.trace(`[lifecycle] onBeforeUnload (reason: ${reply.reason})`);
      const veto = await this.handleBeforeShutdown(reply.reason);
      if (veto) {
        this.logService.trace("[lifecycle] onBeforeUnload prevented via veto");
        this._onShutdownVeto.fire();
        ipcRenderer.send(reply.cancelChannel, windowId);
      } else {
        this.logService.trace("[lifecycle] onBeforeUnload continues without veto");
        this.shutdownReason = reply.reason;
        ipcRenderer.send(reply.okChannel, windowId);
      }
    });
    ipcRenderer.on("vscode:onWillUnload", async (event, reply) => {
      this.logService.trace(`[lifecycle] onWillUnload (reason: ${reply.reason})`);
      await this.handleWillShutdown(reply.reason);
      this._onDidShutdown.fire();
      ipcRenderer.send(reply.replyChannel, windowId);
    });
  }
  async handleBeforeShutdown(reason) {
    const logService = this.logService;
    const vetos = [];
    const pendingVetos = /* @__PURE__ */ new Set();
    let finalVeto = void 0;
    let finalVetoId = void 0;
    this._onBeforeShutdown.fire({
      reason,
      veto(value, id) {
        vetos.push(value);
        if (value === true) {
          logService.info(`[lifecycle]: Shutdown was prevented (id: ${id})`);
        } else if (value instanceof Promise) {
          pendingVetos.add(id);
          value.then((veto) => {
            if (veto === true) {
              logService.info(`[lifecycle]: Shutdown was prevented (id: ${id})`);
            }
          }).finally(() => pendingVetos.delete(id));
        }
      },
      finalVeto(value, id) {
        if (!finalVeto) {
          finalVeto = value;
          finalVetoId = id;
        } else {
          throw new Error(`[lifecycle]: Final veto is already defined (id: ${id})`);
        }
      }
    });
    const longRunningBeforeShutdownWarning = disposableTimeout(() => {
      logService.warn(`[lifecycle] onBeforeShutdown is taking a long time, pending operations: ${Array.from(pendingVetos).join(", ")}`);
    }, NativeLifecycleService.BEFORE_SHUTDOWN_WARNING_DELAY);
    try {
      let veto = await handleVetos(vetos, (error) => this.handleBeforeShutdownError(error, reason));
      if (veto) {
        return veto;
      }
      if (finalVeto) {
        try {
          pendingVetos.add(finalVetoId);
          veto = await finalVeto();
          if (veto) {
            logService.info(`[lifecycle]: Shutdown was prevented by final veto (id: ${finalVetoId})`);
          }
        } catch (error) {
          veto = true;
          this.handleBeforeShutdownError(error, reason);
        }
      }
      return veto;
    } finally {
      longRunningBeforeShutdownWarning.dispose();
    }
  }
  handleBeforeShutdownError(error, reason) {
    this.logService.error(`[lifecycle]: Error during before-shutdown phase (error: ${toErrorMessage(error)})`);
    this._onBeforeShutdownError.fire({ reason, error });
  }
  async handleWillShutdown(reason) {
    this._willShutdown = true;
    const joiners = [];
    const lastJoiners = [];
    const pendingJoiners = /* @__PURE__ */ new Set();
    const cts = new CancellationTokenSource();
    this._onWillShutdown.fire({
      reason,
      token: cts.token,
      joiners: () => Array.from(pendingJoiners.values()),
      join(promiseOrPromiseFn, joiner) {
        pendingJoiners.add(joiner);
        if (joiner.order === WillShutdownJoinerOrder.Last) {
          const promiseFn = typeof promiseOrPromiseFn === "function" ? promiseOrPromiseFn : () => promiseOrPromiseFn;
          lastJoiners.push(() => promiseFn().finally(() => pendingJoiners.delete(joiner)));
        } else {
          const promise = typeof promiseOrPromiseFn === "function" ? promiseOrPromiseFn() : promiseOrPromiseFn;
          promise.finally(() => pendingJoiners.delete(joiner));
          joiners.push(promise);
        }
      },
      force: () => {
        cts.dispose(true);
      }
    });
    const longRunningWillShutdownWarning = disposableTimeout(() => {
      this.logService.warn(`[lifecycle] onWillShutdown is taking a long time, pending operations: ${Array.from(pendingJoiners).map((joiner) => joiner.id).join(", ")}`);
    }, NativeLifecycleService.WILL_SHUTDOWN_WARNING_DELAY);
    try {
      await raceCancellation(Promises.settled(joiners), cts.token);
    } catch (error) {
      this.logService.error(`[lifecycle]: Error during will-shutdown phase in default joiners (error: ${toErrorMessage(error)})`);
    }
    try {
      await raceCancellation(Promises.settled(lastJoiners.map((lastJoiner) => lastJoiner())), cts.token);
    } catch (error) {
      this.logService.error(`[lifecycle]: Error during will-shutdown phase in last joiners (error: ${toErrorMessage(error)})`);
    }
    longRunningWillShutdownWarning.dispose();
  }
  shutdown() {
    return this.nativeHostService.closeWindow();
  }
};
NativeLifecycleService.BEFORE_SHUTDOWN_WARNING_DELAY = 5e3;
NativeLifecycleService.WILL_SHUTDOWN_WARNING_DELAY = 800;
NativeLifecycleService = __decorateClass([
  __decorateParam(0, INativeHostService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, ILogService)
], NativeLifecycleService);
registerSingleton(ILifecycleService, NativeLifecycleService, InstantiationType.Eager);
export {
  NativeLifecycleService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvbGlmZWN5Y2xlL2VsZWN0cm9uLXNhbmRib3gvbGlmZWN5Y2xlU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGhhbmRsZVZldG9zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2h1dGRvd25SZWFzb24sIElMaWZlY3ljbGVTZXJ2aWNlLCBJV2lsbFNodXRkb3duRXZlbnRKb2luZXIsIFdpbGxTaHV0ZG93bkpvaW5lck9yZGVyIH0gZnJvbSAnLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGlwY1JlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9wYXJ0cy9zYW5kYm94L2VsZWN0cm9uLXNhbmRib3gvZ2xvYmFscy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IEFic3RyYWN0TGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9saWZlY3ljbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMsIGRpc3Bvc2FibGVUaW1lb3V0LCByYWNlQ2FuY2VsbGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuXG5leHBvcnQgY2xhc3MgTmF0aXZlTGlmZWN5Y2xlU2VydmljZSBleHRlbmRzIEFic3RyYWN0TGlmZWN5Y2xlU2VydmljZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQkVGT1JFX1NIVVRET1dOX1dBUk5JTkdfREVMQVkgPSA1MDAwO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBXSUxMX1NIVVRET1dOX1dBUk5JTkdfREVMQVkgPSA4MDA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5hdGl2ZUhvc3RTZXJ2aWNlOiBJTmF0aXZlSG9zdFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihsb2dTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdGNvbnN0IHdpbmRvd0lkID0gdGhpcy5uYXRpdmVIb3N0U2VydmljZS53aW5kb3dJZDtcblxuXHRcdC8vIE1haW4gc2lkZSBpbmRpY2F0ZXMgdGhhdCB3aW5kb3cgaXMgYWJvdXQgdG8gdW5sb2FkLCBjaGVjayBmb3IgdmV0b3Ncblx0XHRpcGNSZW5kZXJlci5vbigndnNjb2RlOm9uQmVmb3JlVW5sb2FkJywgYXN5bmMgKGV2ZW50OiB1bmtub3duLCByZXBseTogeyBva0NoYW5uZWw6IHN0cmluZzsgY2FuY2VsQ2hhbm5lbDogc3RyaW5nOyByZWFzb246IFNodXRkb3duUmVhc29uIH0pID0+IHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW2xpZmVjeWNsZV0gb25CZWZvcmVVbmxvYWQgKHJlYXNvbjogJHtyZXBseS5yZWFzb259KWApO1xuXG5cdFx0XHQvLyB0cmlnZ2VyIG9uQmVmb3JlU2h1dGRvd24gZXZlbnRzIGFuZCB2ZXRvIGNvbGxlY3Rpbmdcblx0XHRcdGNvbnN0IHZldG8gPSBhd2FpdCB0aGlzLmhhbmRsZUJlZm9yZVNodXRkb3duKHJlcGx5LnJlYXNvbik7XG5cblx0XHRcdC8vIHZldG86IGNhbmNlbCB1bmxvYWRcblx0XHRcdGlmICh2ZXRvKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW2xpZmVjeWNsZV0gb25CZWZvcmVVbmxvYWQgcHJldmVudGVkIHZpYSB2ZXRvJyk7XG5cblx0XHRcdFx0Ly8gSW5kaWNhdGUgYXMgZXZlbnRcblx0XHRcdFx0dGhpcy5fb25TaHV0ZG93blZldG8uZmlyZSgpO1xuXG5cdFx0XHRcdGlwY1JlbmRlcmVyLnNlbmQocmVwbHkuY2FuY2VsQ2hhbm5lbCwgd2luZG93SWQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBubyB2ZXRvOiBhbGxvdyB1bmxvYWRcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ1tsaWZlY3ljbGVdIG9uQmVmb3JlVW5sb2FkIGNvbnRpbnVlcyB3aXRob3V0IHZldG8nKTtcblxuXHRcdFx0XHR0aGlzLnNodXRkb3duUmVhc29uID0gcmVwbHkucmVhc29uO1xuXHRcdFx0XHRpcGNSZW5kZXJlci5zZW5kKHJlcGx5Lm9rQ2hhbm5lbCwgd2luZG93SWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gTWFpbiBzaWRlIGluZGljYXRlcyB0aGF0IHdlIHdpbGwgaW5kZWVkIHNodXRkb3duXG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTpvbldpbGxVbmxvYWQnLCBhc3luYyAoZXZlbnQ6IHVua25vd24sIHJlcGx5OiB7IHJlcGx5Q2hhbm5lbDogc3RyaW5nOyByZWFzb246IFNodXRkb3duUmVhc29uIH0pID0+IHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW2xpZmVjeWNsZV0gb25XaWxsVW5sb2FkIChyZWFzb246ICR7cmVwbHkucmVhc29ufSlgKTtcblxuXHRcdFx0Ly8gdHJpZ2dlciBvbldpbGxTaHV0ZG93biBldmVudHMgYW5kIGpvaW5pbmdcblx0XHRcdGF3YWl0IHRoaXMuaGFuZGxlV2lsbFNodXRkb3duKHJlcGx5LnJlYXNvbik7XG5cblx0XHRcdC8vIHRyaWdnZXIgb25EaWRTaHV0ZG93biBldmVudCBub3cgdGhhdCB3ZSBrbm93IHdlIHdpbGwgcXVpdFxuXHRcdFx0dGhpcy5fb25EaWRTaHV0ZG93bi5maXJlKCk7XG5cblx0XHRcdC8vIGFja25vd2xlZGdlIHRvIG1haW4gc2lkZVxuXHRcdFx0aXBjUmVuZGVyZXIuc2VuZChyZXBseS5yZXBseUNoYW5uZWwsIHdpbmRvd0lkKTtcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBoYW5kbGVCZWZvcmVTaHV0ZG93bihyZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IHRoaXMubG9nU2VydmljZTtcblxuXHRcdGNvbnN0IHZldG9zOiAoYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4pW10gPSBbXTtcblx0XHRjb25zdCBwZW5kaW5nVmV0b3MgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHRcdGxldCBmaW5hbFZldG86ICgoKSA9PiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPikgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGZpbmFsVmV0b0lkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBiZWZvcmUtc2h1dGRvd24gZXZlbnQgd2l0aCB2ZXRvIHN1cHBvcnRcblx0XHR0aGlzLl9vbkJlZm9yZVNodXRkb3duLmZpcmUoe1xuXHRcdFx0cmVhc29uLFxuXHRcdFx0dmV0byh2YWx1ZSwgaWQpIHtcblx0XHRcdFx0dmV0b3MucHVzaCh2YWx1ZSk7XG5cblx0XHRcdFx0Ly8gTG9nIGFueSB2ZXRvIGluc3RhbnRseVxuXHRcdFx0XHRpZiAodmFsdWUgPT09IHRydWUpIHtcblx0XHRcdFx0XHRsb2dTZXJ2aWNlLmluZm8oYFtsaWZlY3ljbGVdOiBTaHV0ZG93biB3YXMgcHJldmVudGVkIChpZDogJHtpZH0pYCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBUcmFjayBwcm9taXNlIGNvbXBsZXRpb25cblx0XHRcdFx0ZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG5cdFx0XHRcdFx0cGVuZGluZ1ZldG9zLmFkZChpZCk7XG5cdFx0XHRcdFx0dmFsdWUudGhlbih2ZXRvID0+IHtcblx0XHRcdFx0XHRcdGlmICh2ZXRvID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuaW5mbyhgW2xpZmVjeWNsZV06IFNodXRkb3duIHdhcyBwcmV2ZW50ZWQgKGlkOiAke2lkfSlgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KS5maW5hbGx5KCgpID0+IHBlbmRpbmdWZXRvcy5kZWxldGUoaWQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpbmFsVmV0byh2YWx1ZSwgaWQpIHtcblx0XHRcdFx0aWYgKCFmaW5hbFZldG8pIHtcblx0XHRcdFx0XHRmaW5hbFZldG8gPSB2YWx1ZTtcblx0XHRcdFx0XHRmaW5hbFZldG9JZCA9IGlkO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgW2xpZmVjeWNsZV06IEZpbmFsIHZldG8gaXMgYWxyZWFkeSBkZWZpbmVkIChpZDogJHtpZH0pYCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGxvbmdSdW5uaW5nQmVmb3JlU2h1dGRvd25XYXJuaW5nID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0bG9nU2VydmljZS53YXJuKGBbbGlmZWN5Y2xlXSBvbkJlZm9yZVNodXRkb3duIGlzIHRha2luZyBhIGxvbmcgdGltZSwgcGVuZGluZyBvcGVyYXRpb25zOiAke0FycmF5LmZyb20ocGVuZGluZ1ZldG9zKS5qb2luKCcsICcpfWApO1xuXHRcdH0sIE5hdGl2ZUxpZmVjeWNsZVNlcnZpY2UuQkVGT1JFX1NIVVRET1dOX1dBUk5JTkdfREVMQVkpO1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gRmlyc3Q6IHJ1biBsaXN0IG9mIHZldG9zIGluIHBhcmFsbGVsXG5cdFx0XHRsZXQgdmV0byA9IGF3YWl0IGhhbmRsZVZldG9zKHZldG9zLCBlcnJvciA9PiB0aGlzLmhhbmRsZUJlZm9yZVNodXRkb3duRXJyb3IoZXJyb3IsIHJlYXNvbikpO1xuXHRcdFx0aWYgKHZldG8pIHtcblx0XHRcdFx0cmV0dXJuIHZldG87XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNlY29uZDogcnVuIHRoZSBmaW5hbCB2ZXRvIGlmIGRlZmluZWRcblx0XHRcdGlmIChmaW5hbFZldG8pIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRwZW5kaW5nVmV0b3MuYWRkKGZpbmFsVmV0b0lkIGFzIHVua25vd24gYXMgc3RyaW5nKTtcblx0XHRcdFx0XHR2ZXRvID0gYXdhaXQgKGZpbmFsVmV0byBhcyAoKSA9PiBQcm9taXNlPGJvb2xlYW4+KSgpO1xuXHRcdFx0XHRcdGlmICh2ZXRvKSB7XG5cdFx0XHRcdFx0XHRsb2dTZXJ2aWNlLmluZm8oYFtsaWZlY3ljbGVdOiBTaHV0ZG93biB3YXMgcHJldmVudGVkIGJ5IGZpbmFsIHZldG8gKGlkOiAke2ZpbmFsVmV0b0lkfSlgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dmV0byA9IHRydWU7IC8vIHRyZWF0IGVycm9yIGFzIHZldG9cblxuXHRcdFx0XHRcdHRoaXMuaGFuZGxlQmVmb3JlU2h1dGRvd25FcnJvcihlcnJvciwgcmVhc29uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdmV0bztcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0bG9uZ1J1bm5pbmdCZWZvcmVTaHV0ZG93bldhcm5pbmcuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQmVmb3JlU2h1dGRvd25FcnJvcihlcnJvcjogRXJyb3IsIHJlYXNvbjogU2h1dGRvd25SZWFzb24pOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtsaWZlY3ljbGVdOiBFcnJvciBkdXJpbmcgYmVmb3JlLXNodXRkb3duIHBoYXNlIChlcnJvcjogJHt0b0Vycm9yTWVzc2FnZShlcnJvcil9KWApO1xuXG5cdFx0dGhpcy5fb25CZWZvcmVTaHV0ZG93bkVycm9yLmZpcmUoeyByZWFzb24sIGVycm9yIH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGhhbmRsZVdpbGxTaHV0ZG93bihyZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fd2lsbFNodXRkb3duID0gdHJ1ZTtcblxuXHRcdGNvbnN0IGpvaW5lcnM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXHRcdGNvbnN0IGxhc3RKb2luZXJzOiAoKCkgPT4gUHJvbWlzZTx2b2lkPilbXSA9IFtdO1xuXHRcdGNvbnN0IHBlbmRpbmdKb2luZXJzID0gbmV3IFNldDxJV2lsbFNodXRkb3duRXZlbnRKb2luZXI+KCk7XG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dGhpcy5fb25XaWxsU2h1dGRvd24uZmlyZSh7XG5cdFx0XHRyZWFzb24sXG5cdFx0XHR0b2tlbjogY3RzLnRva2VuLFxuXHRcdFx0am9pbmVyczogKCkgPT4gQXJyYXkuZnJvbShwZW5kaW5nSm9pbmVycy52YWx1ZXMoKSksXG5cdFx0XHRqb2luKHByb21pc2VPclByb21pc2VGbiwgam9pbmVyKSB7XG5cdFx0XHRcdHBlbmRpbmdKb2luZXJzLmFkZChqb2luZXIpO1xuXG5cdFx0XHRcdGlmIChqb2luZXIub3JkZXIgPT09IFdpbGxTaHV0ZG93bkpvaW5lck9yZGVyLkxhc3QpIHtcblx0XHRcdFx0XHRjb25zdCBwcm9taXNlRm4gPSB0eXBlb2YgcHJvbWlzZU9yUHJvbWlzZUZuID09PSAnZnVuY3Rpb24nID8gcHJvbWlzZU9yUHJvbWlzZUZuIDogKCkgPT4gcHJvbWlzZU9yUHJvbWlzZUZuO1xuXHRcdFx0XHRcdGxhc3RKb2luZXJzLnB1c2goKCkgPT4gcHJvbWlzZUZuKCkuZmluYWxseSgoKSA9PiBwZW5kaW5nSm9pbmVycy5kZWxldGUoam9pbmVyKSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHByb21pc2UgPSB0eXBlb2YgcHJvbWlzZU9yUHJvbWlzZUZuID09PSAnZnVuY3Rpb24nID8gcHJvbWlzZU9yUHJvbWlzZUZuKCkgOiBwcm9taXNlT3JQcm9taXNlRm47XG5cdFx0XHRcdFx0cHJvbWlzZS5maW5hbGx5KCgpID0+IHBlbmRpbmdKb2luZXJzLmRlbGV0ZShqb2luZXIpKTtcblx0XHRcdFx0XHRqb2luZXJzLnB1c2gocHJvbWlzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmb3JjZTogKCkgPT4ge1xuXHRcdFx0XHRjdHMuZGlzcG9zZSh0cnVlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGxvbmdSdW5uaW5nV2lsbFNodXRkb3duV2FybmluZyA9IGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBbbGlmZWN5Y2xlXSBvbldpbGxTaHV0ZG93biBpcyB0YWtpbmcgYSBsb25nIHRpbWUsIHBlbmRpbmcgb3BlcmF0aW9uczogJHtBcnJheS5mcm9tKHBlbmRpbmdKb2luZXJzKS5tYXAoam9pbmVyID0+IGpvaW5lci5pZCkuam9pbignLCAnKX1gKTtcblx0XHR9LCBOYXRpdmVMaWZlY3ljbGVTZXJ2aWNlLldJTExfU0hVVERPV05fV0FSTklOR19ERUxBWSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgcmFjZUNhbmNlbGxhdGlvbihQcm9taXNlcy5zZXR0bGVkKGpvaW5lcnMpLCBjdHMudG9rZW4pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtsaWZlY3ljbGVdOiBFcnJvciBkdXJpbmcgd2lsbC1zaHV0ZG93biBwaGFzZSBpbiBkZWZhdWx0IGpvaW5lcnMgKGVycm9yOiAke3RvRXJyb3JNZXNzYWdlKGVycm9yKX0pYCk7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHJhY2VDYW5jZWxsYXRpb24oUHJvbWlzZXMuc2V0dGxlZChsYXN0Sm9pbmVycy5tYXAobGFzdEpvaW5lciA9PiBsYXN0Sm9pbmVyKCkpKSwgY3RzLnRva2VuKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBbbGlmZWN5Y2xlXTogRXJyb3IgZHVyaW5nIHdpbGwtc2h1dGRvd24gcGhhc2UgaW4gbGFzdCBqb2luZXJzIChlcnJvcjogJHt0b0Vycm9yTWVzc2FnZShlcnJvcil9KWApO1xuXHRcdH1cblxuXHRcdGxvbmdSdW5uaW5nV2lsbFNodXRkb3duV2FybmluZy5kaXNwb3NlKCk7XG5cdH1cblxuXHRzaHV0ZG93bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5uYXRpdmVIb3N0U2VydmljZS5jbG9zZVdpbmRvdygpO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElMaWZlY3ljbGVTZXJ2aWNlLCBOYXRpdmVMaWZlY3ljbGVTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsbUJBQW1CO0FBQzVCLFNBQXlCLG1CQUE2QywrQkFBK0I7QUFDckcsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsVUFBVSxtQkFBbUIsd0JBQXdCO0FBQzlELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsK0JBQStCO0FBRWpDLElBQU0seUJBQU4sY0FBcUMseUJBQXlCO0FBQUEsRUFLcEUsWUFDc0MsbUJBQ3BCLGdCQUNKLFlBQ1o7QUFDRCxVQUFNLFlBQVksY0FBYztBQUpLO0FBTXJDLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLG9CQUEwQjtBQUNqQyxVQUFNLFdBQVcsS0FBSyxrQkFBa0I7QUFHeEMsZ0JBQVksR0FBRyx5QkFBeUIsT0FBTyxPQUFnQixVQUFnRjtBQUM5SSxXQUFLLFdBQVcsTUFBTSx1Q0FBdUMsTUFBTSxNQUFNLEdBQUc7QUFHNUUsWUFBTSxPQUFPLE1BQU0sS0FB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
