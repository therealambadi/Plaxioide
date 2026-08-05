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
import { Promises } from "../../../base/common/async.js";
import { canceled } from "../../../base/common/errors.js";
import { Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { WindowUtilityProcess } from "../../utilityProcess/electron-main/utilityProcess.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
let ExtensionHostStarter = class extends Disposable {
  constructor(_logService, _lifecycleMainService, _windowsMainService, _telemetryService) {
    super();
    this._logService = _logService;
    this._lifecycleMainService = _lifecycleMainService;
    this._windowsMainService = _windowsMainService;
    this._telemetryService = _telemetryService;
    this._extHosts = /* @__PURE__ */ new Map();
    this._shutdown = false;
    this._register(this._lifecycleMainService.onWillShutdown((e) => {
      this._shutdown = true;
      e.join("extHostStarter", this._waitForAllExit(6e3));
    }));
  }
  dispose() {
    super.dispose();
  }
  _getExtHost(id) {
    const extHostProcess = this._extHosts.get(id);
    if (!extHostProcess) {
      throw new Error(`Unknown extension host!`);
    }
    return extHostProcess;
  }
  onDynamicStdout(id) {
    return this._getExtHost(id).onStdout;
  }
  onDynamicStderr(id) {
    return this._getExtHost(id).onStderr;
  }
  onDynamicMessage(id) {
    return this._getExtHost(id).onMessage;
  }
  onDynamicExit(id) {
    return this._getExtHost(id).onExit;
  }
  async createExtensionHost() {
    if (this._shutdown) {
      throw canceled();
    }
    const id = String(++ExtensionHostStarter._lastId);
    const extHost = new WindowUtilityProcess(this._logService, this._windowsMainService, this._telemetryService, this._lifecycleMainService);
    this._extHosts.set(id, extHost);
    const disposable = extHost.onExit(({ pid, code, signal }) => {
      disposable.dispose();
      this._logService.info(`Extension host with pid ${pid} exited with code: ${code}, signal: ${signal}.`);
      setTimeout(() => {
        extHost.dispose();
        this._extHosts.delete(id);
      });
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          this._logService.error(`Extension host with pid ${pid} still exists, forcefully killing it...`);
          process.kill(pid);
        } catch (er) {
        }
      }, 1e3);
    });
    return { id };
  }
  async start(id, opts) {
    if (this._shutdown) {
      throw canceled();
    }
    const extHost = this._getExtHost(id);
    extHost.start({
      ...opts,
      type: "extensionHost",
      entryPoint: "vs/workbench/api/node/extensionHostProcess",
      args: ["--skipWorkspaceStorageLock"],
      execArgv: opts.execArgv,
      allowLoadingUnsignedLibraries: true,
      respondToAuthRequestsFromMainProcess: true,
      correlationId: id
    });
    const pid = await Event.toPromise(extHost.onSpawn);
    return { pid };
  }
  async enableInspectPort(id) {
    if (this._shutdown) {
      throw canceled();
    }
    const extHostProcess = this._extHosts.get(id);
    if (!extHostProcess) {
      return false;
    }
    return extHostProcess.enableInspectPort();
  }
  async kill(id) {
    if (this._shutdown) {
      throw canceled();
    }
    const extHostProcess = this._extHosts.get(id);
    if (!extHostProcess) {
      return;
    }
    extHostProcess.kill();
  }
  async _killAllNow() {
    for (const [, extHost] of this._extHosts) {
      extHost.kill();
    }
  }
  async _waitForAllExit(maxWaitTimeMs) {
    const exitPromises = [];
    for (const [, extHost] of this._extHosts) {
      exitPromises.push(extHost.waitForExit(maxWaitTimeMs));
    }
    return Promises.settled(exitPromises).then(() => {
    });
  }
};
ExtensionHostStarter._lastId = 0;
ExtensionHostStarter = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ILifecycleMainService),
  __decorateParam(2, IWindowsMainService),
  __decorateParam(3, ITelemetryService)
], ExtensionHostStarter);
export {
  ExtensionHostStarter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25zL2VsZWN0cm9uLW1haW4vZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGNhbmNlbGVkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkhvc3RQcm9jZXNzT3B0aW9ucywgSUV4dGVuc2lvbkhvc3RTdGFydGVyIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbkhvc3RTdGFydGVyLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9lbGVjdHJvbi1tYWluL2xpZmVjeWNsZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBXaW5kb3dVdGlsaXR5UHJvY2VzcyB9IGZyb20gJy4uLy4uL3V0aWxpdHlQcm9jZXNzL2VsZWN0cm9uLW1haW4vdXRpbGl0eVByb2Nlc3MuanMnO1xuaW1wb3J0IHsgSVdpbmRvd3NNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3dpbmRvd3MvZWxlY3Ryb24tbWFpbi93aW5kb3dzLmpzJztcblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkhvc3RTdGFydGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElEaXNwb3NhYmxlLCBJRXh0ZW5zaW9uSG9zdFN0YXJ0ZXIge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyBfbGFzdElkOiBudW1iZXIgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2V4dEhvc3RzID0gbmV3IE1hcDxzdHJpbmcsIFdpbmRvd1V0aWxpdHlQcm9jZXNzPigpO1xuXHRwcml2YXRlIF9zaHV0ZG93biA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxpZmVjeWNsZU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xpZmVjeWNsZU1haW5TZXJ2aWNlOiBJTGlmZWN5Y2xlTWFpblNlcnZpY2UsXG5cdFx0QElXaW5kb3dzTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd2luZG93c01haW5TZXJ2aWNlOiBJV2luZG93c01haW5TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8vIE9uIHNodXRkb3duOiBncmFjZWZ1bGx5IGF3YWl0IGV4dGVuc2lvbiBob3N0IHNodXRkb3duc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xpZmVjeWNsZU1haW5TZXJ2aWNlLm9uV2lsbFNodXRkb3duKGUgPT4ge1xuXHRcdFx0dGhpcy5fc2h1dGRvd24gPSB0cnVlO1xuXHRcdFx0ZS5qb2luKCdleHRIb3N0U3RhcnRlcicsIHRoaXMuX3dhaXRGb3JBbGxFeGl0KDYwMDApKTtcblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdC8vIEludGVudGlvbmFsbHkgbm90IGtpbGxpbmcgdGhlIGV4dGVuc2lvbiBob3N0IHByb2Nlc3Nlc1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEV4dEhvc3QoaWQ6IHN0cmluZyk6IFdpbmRvd1V0aWxpdHlQcm9jZXNzIHtcblx0XHRjb25zdCBleHRIb3N0UHJvY2VzcyA9IHRoaXMuX2V4dEhvc3RzLmdldChpZCk7XG5cdFx0aWYgKCFleHRIb3N0UHJvY2Vzcykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGV4dGVuc2lvbiBob3N0IWApO1xuXHRcdH1cblx0XHRyZXR1cm4gZXh0SG9zdFByb2Nlc3M7XG5cdH1cblxuXHRvbkR5bmFtaWNTdGRvdXQoaWQ6IHN0cmluZyk6IEV2ZW50PHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl9nZXRFeHRIb3N0KGlkKS5vblN0ZG91dDtcblx0fVxuXG5cdG9uRHluYW1pY1N0ZGVycihpZDogc3RyaW5nKTogRXZlbnQ8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldEV4dEhvc3QoaWQpLm9uU3RkZXJyO1xuXHR9XG5cblx0b25EeW5hbWljTWVzc2FnZShpZDogc3RyaW5nKTogRXZlbnQ8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldEV4dEhvc3QoaWQpLm9uTWVzc2FnZTtcblx0fVxuXG5cdG9uRHluYW1pY0V4aXQoaWQ6IHN0cmluZyk6IEV2ZW50PHsgY29kZTogbnVtYmVyOyBzaWduYWw6IHN0cmluZyB9PiB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldEV4dEhvc3QoaWQpLm9uRXhpdDtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZUV4dGVuc2lvbkhvc3QoKTogUHJvbWlzZTx7IGlkOiBzdHJpbmcgfT4ge1xuXHRcdGlmICh0aGlzLl9zaHV0ZG93bikge1xuXHRcdFx0dGhyb3cgY2FuY2VsZWQoKTtcblx0XHR9XG5cdFx0Y29uc3QgaWQgPSBTdHJpbmcoKytFeHRlbnNpb25Ib3N0U3RhcnRlci5fbGFzdElkKTtcblx0XHRjb25zdCBleHRIb3N0ID0gbmV3IFdpbmRvd1V0aWxpdHlQcm9jZXNzKHRoaXMuX2xvZ1NlcnZpY2UsIHRoaXMuX3dpbmRvd3NNYWluU2VydmljZSwgdGhpcy5fdGVsZW1ldHJ5U2VydmljZSwgdGhpcy5fbGlmZWN5Y2xlTWFpblNlcnZpY2UpO1xuXHRcdHRoaXMuX2V4dEhvc3RzLnNldChpZCwgZXh0SG9zdCk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGV4dEhvc3Qub25FeGl0KCh7IHBpZCwgY29kZSwgc2lnbmFsIH0pID0+IHtcblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBFeHRlbnNpb24gaG9zdCB3aXRoIHBpZCAke3BpZH0gZXhpdGVkIHdpdGggY29kZTogJHtjb2RlfSwgc2lnbmFsOiAke3NpZ25hbH0uYCk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0ZXh0SG9zdC5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2V4dEhvc3RzLmRlbGV0ZShpZCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xOTQ0Nzdcblx0XHRcdC8vIFdlIGhhdmUgb2JzZXJ2ZWQgdGhhdCBzb21ldGltZXMgdGhlIHByb2Nlc3Mgc2VuZHMgYW4gZXhpdFxuXHRcdFx0Ly8gZXZlbnQsIGJ1dCBkb2VzIG5vdCByZWFsbHkgZXhpdCBhbmQgaXMgc3R1Y2sgaW4gYW4gZW5kbGVzc1xuXHRcdFx0Ly8gbG9vcC4gSW4gdGhlc2UgY2FzZXMgd2Uga2lsbCB0aGUgcHJvY2VzcyBmb3JjZWZ1bGx5IGFmdGVyXG5cdFx0XHQvLyBhIGNlcnRhaW4gdGltZW91dC5cblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHByb2Nlc3Mua2lsbChwaWQsIDApOyAvLyB3aWxsIHRocm93IGlmIHRoZSBwcm9jZXNzIGRvZXNuJ3QgZXhpc3QgYW55bW9yZS5cblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBFeHRlbnNpb24gaG9zdCB3aXRoIHBpZCAke3BpZH0gc3RpbGwgZXhpc3RzLCBmb3JjZWZ1bGx5IGtpbGxpbmcgaXQuLi5gKTtcblx0XHRcdFx0XHRwcm9jZXNzLmtpbGwocGlkKTtcblx0XHRcdFx0fSBjYXRjaCAoZXIpIHtcblx0XHRcdFx0XHQvLyBpZ25vcmUsIGFzIHRoZSBwcm9jZXNzIGlzIGFscmVhZHkgZ29uZVxuXHRcdFx0XHR9XG5cdFx0XHR9LCAxMDAwKTtcblx0XHR9KTtcblx0XHRyZXR1cm4geyBpZCB9O1xuXHR9XG5cblx0YXN5bmMgc3RhcnQoaWQ6IHN0cmluZywgb3B0czogSUV4dGVuc2lvbkhvc3RQcm9jZXNzT3B0aW9ucyk6IFByb21pc2U8eyBwaWQ6IG51bWJlciB8IHVuZGVmaW5lZCB9PiB7XG5cdFx0aWYgKHRoaXMuX3NodXRkb3duKSB7XG5cdFx0XHR0aHJvdyBjYW5jZWxlZCgpO1xuXHRcdH1cblx0XHRjb25zdCBleHRIb3N0ID0gdGhpcy5fZ2V0RXh0SG9zdChpZCk7XG5cdFx0ZXh0SG9zdC5zdGFydCh7XG5cdFx0XHQuLi5vcHRzLFxuXHRcdFx0dHlwZTogJ2V4dGVuc2lvbkhvc3QnLFxuXHRcdFx0ZW50cnlQb2ludDogJ3ZzL3dvcmtiZW5jaC9hcGkvbm9kZS9leHRlbnNpb25Ib3N0UHJvY2VzcycsXG5cdFx0XHRhcmdzOiBbJy0tc2tpcFdvcmtzcGFjZVN0b3JhZ2VMb2NrJ10sXG5cdFx0XHRleGVjQXJndjogb3B0cy5leGVjQXJndixcblx0XHRcdGFsbG93TG9hZGluZ1Vuc2lnbmVkTGlicmFyaWVzOiB0cnVlLFxuXHRcdFx0cmVzcG9uZFRvQXV0aFJlcXVlc3RzRnJvbU1haW5Qcm9jZXNzOiB0cnVlLFxuXHRcdFx0Y29ycmVsYXRpb25JZDogaWRcblx0XHR9KTtcblx0XHRjb25zdCBwaWQgPSBhd2FpdCBFdmVudC50b1Byb21pc2UoZXh0SG9zdC5vblNwYXduKTtcblx0XHRyZXR1cm4geyBwaWQgfTtcblx0fVxuXG5cdGFzeW5jIGVuYWJsZUluc3BlY3RQb3J0KGlkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAodGhpcy5fc2h1dGRvd24pIHtcblx0XHRcdHRocm93IGNhbmNlbGVkKCk7XG5cdFx0fVxuXHRcdGNvbnN0IGV4dEhvc3RQcm9jZXNzID0gdGhpcy5fZXh0SG9zdHMuZ2V0KGlkKTtcblx0XHRpZiAoIWV4dEhvc3RQcm9jZXNzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBleHRIb3N0UHJvY2Vzcy5lbmFibGVJbnNwZWN0UG9ydCgpO1xuXHR9XG5cblx0YXN5bmMga2lsbChpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX3NodXRkb3duKSB7XG5cdFx0XHR0aHJvdyBjYW5jZWxlZCgpO1xuXHRcdH1cblx0XHRjb25zdCBleHRIb3N0UHJvY2VzcyA9IHRoaXMuX2V4dEhvc3RzLmdldChpZCk7XG5cdFx0aWYgKCFleHRIb3N0UHJvY2Vzcykge1xuXHRcdFx0Ly8gYWxyZWFkeSBnb25lIVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRleHRIb3N0UHJvY2Vzcy5raWxsKCk7XG5cdH1cblxuXHRhc3luYyBfa2lsbEFsbE5vdygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmb3IgKGNvbnN0IFssIGV4dEhvc3RdIG9mIHRoaXMuX2V4dEhvc3RzKSB7XG5cdFx0XHRleHRIb3N0LmtpbGwoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBfd2FpdEZvckFsbEV4aXQobWF4V2FpdFRpbWVNczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXhpdFByb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFssIGV4dEhvc3RdIG9mIHRoaXMuX2V4dEhvc3RzKSB7XG5cdFx0XHRleGl0UHJvbWlzZXMucHVzaChleHRIb3N0LndhaXRGb3JFeGl0KG1heFdhaXRUaW1lTXMpKTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2VzLnNldHRsZWQoZXhpdFByb21pc2VzKS50aGVuKCgpID0+IHsgfSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsa0JBQStCO0FBRXhDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsMkJBQTJCO0FBRTdCLElBQU0sdUJBQU4sY0FBbUMsV0FBeUQ7QUFBQSxFQVNsRyxZQUMrQixhQUNVLHVCQUNGLHFCQUNGLG1CQUNuQztBQUNELFVBQU07QUFMd0I7QUFDVTtBQUNGO0FBQ0Y7QUFQckMsU0FBaUIsWUFBWSxvQkFBSSxJQUFrQztBQUNuRSxTQUFRLFlBQVk7QUFXbkIsU0FBSyxVQUFVLEtBQUssc0JBQXNCLGVBQWUsT0FBSztBQUM3RCxXQUFLLFlBQVk7QUFDakIsUUFBRSxLQUFLLGtCQUFrQixL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
