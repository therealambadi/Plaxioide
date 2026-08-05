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
import electron from "electron";
import { validatedIpcMain } from "../../../base/parts/ipc/electron-main/ipcMain.js";
import { Barrier, Promises, timeout } from "../../../base/common/async.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { cwd } from "../../../base/common/process.js";
import { assertIsDefined } from "../../../base/common/types.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IStateService } from "../../state/node/state.js";
import { UnloadReason } from "../../window/electron-main/window.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { getAllWindowsExcludingOffscreen } from "../../windows/electron-main/windows.js";
const ILifecycleMainService = createDecorator("lifecycleMainService");
var ShutdownReason = /* @__PURE__ */ ((ShutdownReason2) => {
  ShutdownReason2[ShutdownReason2["QUIT"] = 1] = "QUIT";
  ShutdownReason2[ShutdownReason2["KILL"] = 2] = "KILL";
  return ShutdownReason2;
})(ShutdownReason || {});
var LifecycleMainPhase = /* @__PURE__ */ ((LifecycleMainPhase2) => {
  LifecycleMainPhase2[LifecycleMainPhase2["Starting"] = 1] = "Starting";
  LifecycleMainPhase2[LifecycleMainPhase2["Ready"] = 2] = "Ready";
  LifecycleMainPhase2[LifecycleMainPhase2["AfterWindowOpen"] = 3] = "AfterWindowOpen";
  LifecycleMainPhase2[LifecycleMainPhase2["Eventually"] = 4] = "Eventually";
  return LifecycleMainPhase2;
})(LifecycleMainPhase || {});
let LifecycleMainService = class extends Disposable {
  constructor(logService, stateService, environmentMainService) {
    super();
    this.logService = logService;
    this.stateService = stateService;
    this.environmentMainService = environmentMainService;
    this._onBeforeShutdown = this._register(new Emitter());
    this.onBeforeShutdown = this._onBeforeShutdown.event;
    this._onWillShutdown = this._register(new Emitter());
    this.onWillShutdown = this._onWillShutdown.event;
    this._onWillLoadWindow = this._register(new Emitter());
    this.onWillLoadWindow = this._onWillLoadWindow.event;
    this._onBeforeCloseWindow = this._register(new Emitter());
    this.onBeforeCloseWindow = this._onBeforeCloseWindow.event;
    this._quitRequested = false;
    this._wasRestarted = false;
    this._phase = 1 /* Starting */;
    this.windowToCloseRequest = /* @__PURE__ */ new Set();
    this.oneTimeListenerTokenGenerator = 0;
    this.windowCounter = 0;
    this.pendingQuitPromise = void 0;
    this.pendingQuitPromiseResolve = void 0;
    this.pendingWillShutdownPromise = void 0;
    this.mapWindowIdToPendingUnload = /* @__PURE__ */ new Map();
    this.phaseWhen = /* @__PURE__ */ new Map();
    this.relaunchHandler = void 0;
    this.resolveRestarted();
    this.when(2 /* Ready */).then(() => this.registerListeners());
  }
  get quitRequested() {
    return this._quitRequested;
  }
  get wasRestarted() {
    return this._wasRestarted;
  }
  get phase() {
    return this._phase;
  }
  resolveRestarted() {
    this._wasRestarted = !!this.stateService.getItem(LifecycleMainService.QUIT_AND_RESTART_KEY);
    if (this._wasRestarted) {
      this.stateService.removeItem(LifecycleMainService.QUIT_AND_RESTART_KEY);
    }
  }
  registerListeners() {
    const beforeQuitListener = () => {
      if (this._quitRequested) {
        return;
      }
      this.trace("Lifecycle#app.on(before-quit)");
      this._quitRequested = true;
      this.trace("Lifecycle#onBeforeShutdown.fire()");
      this._onBeforeShutdown.fire();
      if (isMacintosh && this.windowCounter === 0) {
        this.fireOnWillShutdown(1 /* QUIT */);
      }
    };
    electron.app.addListener("before-quit", beforeQuitListener);
    const windowAllClosedListener = () => {
      this.trace("Lifecycle#app.on(window-all-closed)");
      if (this._quitRequested || !isMacintosh) {
        electron.app.quit();
      }
    };
    electron.app.addListener("window-all-closed", windowAllClosedListener);
    electron.app.once("will-quit", (e) => {
      this.trace("Lifecycle#app.on(will-quit) - begin");
      e.preventDefault();
      const shutdownPromise = this.fireOnWillShutdown(1 /* QUIT */);
      shutdownPromise.finally(() => {
        this.trace("Lifecycle#app.on(will-quit) - after fireOnWillShutdown");
        this.resolvePendingQuitPromise(
          false
          /* no veto */
        );
        electron.app.removeListener("before-quit", beforeQuitListener);
        electron.app.removeListener("window-all-closed", windowAllClosedListener);
        this.trace("Lifecycle#app.on(will-quit) - calling app.quit()");
        electron.app.quit();
      });
    });
  }
  fireOnWillShutdown(reason) {
    if (this.pendingWillShutdownPromise) {
      return this.pendingWillShutdownPromise;
    }
    const logService = this.logService;
    this.trace("Lifecycle#onWillShutdown.fire()");
    const joiners = [];
    this._onWillShutdown.fire({
      reason,
      join(id, promise) {
        logService.trace(`Lifecycle#onWillShutdown - begin '${id}'`);
        joiners.push(promise.finally(() => {
          logService.trace(`Lifecycle#onWillShutdown - end '${id}'`);
        }));
      }
    });
    this.pendingWillShutdownPromise = (async () => {
      try {
        await Promises.settled(joiners);
      } catch (error) {
        this.logService.error(error);
      }
      try {
        await this.stateService.close();
      } catch (error) {
        this.logService.error(error);
      }
    })();
    return this.pendingWillShutdownPromise;
  }
  set phase(value) {
    if (value < this.phase) {
      throw new Error("Lifecycle cannot go backwards");
    }
    if (this._phase === value) {
      return;
    }
    this.trace(`lifecycle (main): phase changed (value: ${value})`);
    this._phase = value;
    const barrier = this.phaseWhen.get(this._phase);
    if (barrier) {
      barrier.open();
      this.phaseWhen.delete(this._phase);
    }
  }
  async when(phase) {
    if (phase <= this._phase) {
      return;
    }
    let barrier = this.phaseWhen.get(phase);
    if (!barrier) {
      barrier = new Barrier();
      this.phaseWhen.set(phase, barrier);
    }
    await barrier.wait();
  }
  registerWindow(window) {
    const windowListeners = new DisposableStore();
    this.windowCounter++;
    windowListeners.add(window.onWillLoad((e) => this._onWillLoadWindow.fire({ window, workspace: e.workspace, reason: e.reason })));
    const win = assertIsDefined(window.win);
    windowListeners.add(Event.fromNodeEventEmitter(win, "close")((e) => {
      const windowId = window.id;
      if (this.windowToCloseRequest.has(windowId)) {
        this.windowToCloseRequest.delete(windowId);
        return;
      }
      this.trace(`Lifecycle#window.on('close') - window ID ${window.id}`);
      e.preventDefault();
      this.unload(window, UnloadReason.CLOSE).then((veto) => {
        if (veto) {
          this.windowToCloseRequest.delete(windowId);
          return;
        }
        this.windowToCloseRequest.add(windowId);
        this.trace(`Lifecycle#onBeforeCloseWindow.fire() - window ID ${windowId}`);
        this._onBeforeCloseWindow.fire(window);
        window.close();
      });
    }));
    windowListeners.add(Event.fromNodeEventEmitter(win, "closed")(() => {
      this.trace(`Lifecycle#window.on('closed') - window ID ${window.id}`);
      this.windowCounter--;
      windowListeners.dispose();
      if (this.windowCounter === 0 && (!isMacintosh || this._quitRequested)) {
        this.fireOnWillShutdown(1 /* QUIT */);
      }
    }));
  }
  registerAuxWindow(auxWindow) {
    const win = assertIsDefined(auxWindow.win);
    const windowListeners = new DisposableStore();
    windowListeners.add(Event.fromNodeEventEmitter(win, "close")((e) => {
      this.trace(`Lifecycle#auxWindow.on('close') - window ID ${auxWindow.id}`);
      if (this._quitRequested) {
        this.trace(`Lifecycle#auxWindow.on('close') - preventDefault() because quit requested`);
        e.preventDefault();
      }
    }));
    windowListeners.add(Event.fromNodeEventEmitter(win, "closed")(() => {
      this.trace(`Lifecycle#auxWindow.on('closed') - window ID ${auxWindow.id}`);
      windowListeners.dispose();
    }));
  }
  async reload(window, cli) {
    const veto = await this.unload(window, UnloadReason.RELOAD);
    if (!veto) {
      window.reload(cli);
    }
  }
  unload(window, reason) {
    const pendingUnloadPromise = this.mapWindowIdToPendingUnload.get(window.id);
    if (pendingUnloadPromise) {
      return pendingUnloadPromise;
    }
    const unloadPromise = this.doUnload(window, reason).finally(() => {
      this.mapWindowIdToPendingUnload.delete(window.id);
    });
    this.mapWindowIdToPendingUnload.set(window.id, unloadPromise);
    return unloadPromise;
  }
  async doUnload(window, reason) {
    if (!window.isReady) {
      return false;
    }
    this.trace(`Lifecycle#unload() - window ID ${window.id}`);
    const windowUnloadReason = this._quitRequested ? UnloadReason.QUIT : reason;
    const veto = await this.onBeforeUnloadWindowInRenderer(window, windowUnloadReason);
    if (veto) {
      this.trace(`Lifecycle#unload() - veto in renderer (window ID ${window.id})`);
      return this.handleWindowUnloadVeto(veto);
    }
    await this.onWillUnloadWindowInRenderer(window, windowUnloadReason);
    return false;
  }
  handleWindowUnloadVeto(veto) {
    if (!veto) {
      return false;
    }
    this.resolvePendingQuitPromise(
      true
      /* veto */
    );
    this._quitRequested = false;
    return true;
  }
  resolvePendingQuitPromise(veto) {
    if (this.pendingQuitPromiseResolve) {
      this.pendingQuitPromiseResolve(veto);
      this.pendingQuitPromiseResolve = void 0;
      this.pendingQuitPromise = void 0;
    }
  }
  onBeforeUnloadWindowInRenderer(window, reason) {
    return new Promise((resolve) => {
      const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
      const okChannel = `vscode:ok${oneTimeEventToken}`;
      const cancelChannel = `vscode:cancel${oneTimeEventToken}`;
      validatedIpcMain.once(okChannel, () => {
        resolve(false);
      });
      validatedIpcMain.once(cancelChannel, () => {
        resolve(true);
      });
      window.send("vscode:onBeforeUnload", { okChannel, cancelChannel, reason });
    });
  }
  onWillUnloadWindowInRenderer(window, reason) {
    return new Promise((resolve) => {
      const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
      const replyChannel = `vscode:reply${oneTimeEventToken}`;
      validatedIpcMain.once(replyChannel, () => resolve());
      window.send("vscode:onWillUnload", { replyChannel, reason });
    });
  }
  quit(willRestart) {
    return this.doQuit(willRestart).then((veto) => {
      if (!veto && willRestart) {
        try {
          if (isWindows) {
            const currentWorkingDir = cwd();
            if (currentWorkingDir !== process.cwd()) {
              process.chdir(currentWorkingDir);
            }
          }
        } catch (err) {
          this.logService.error(err);
        }
      }
      return veto;
    });
  }
  doQuit(willRestart) {
    this.trace(`Lifecycle#quit() - begin (willRestart: ${willRestart})`);
    if (this.pendingQuitPromise) {
      this.trace("Lifecycle#quit() - returning pending quit promise");
      return this.pendingQuitPromise;
    }
    if (willRestart) {
      this.stateService.setItem(LifecycleMainService.QUIT_AND_RESTART_KEY, true);
    }
    this.pendingQuitPromise = new Promise((resolve) => {
      this.pendingQuitPromiseResolve = resolve;
      this.trace("Lifecycle#quit() - calling app.quit()");
      electron.app.quit();
    });
    return this.pendingQuitPromise;
  }
  trace(msg) {
    if (this.environmentMainService.args["enable-smoke-test-driver"]) {
      this.logService.info(msg);
    } else {
      this.logService.trace(msg);
    }
  }
  setRelaunchHandler(handler) {
    this.relaunchHandler = handler;
  }
  async relaunch(options) {
    this.trace("Lifecycle#relaunch()");
    const args = process.argv.slice(1);
    if (options?.addArgs) {
      args.push(...options.addArgs);
    }
    if (options?.removeArgs) {
      for (const a of options.removeArgs) {
        const idx = args.indexOf(a);
        if (idx >= 0) {
          args.splice(idx, 1);
        }
      }
    }
    const quitListener = () => {
      if (!this.relaunchHandler?.handleRelaunch(options)) {
        this.trace("Lifecycle#relaunch() - calling app.relaunch()");
        electron.app.relaunch({ args });
      }
    };
    electron.app.once("quit", quitListener);
    const veto = await this.quit(
      true
      /* will restart */
    );
    if (veto) {
      electron.app.removeListener("quit", quitListener);
    }
  }
  async kill(code) {
    this.trace("Lifecycle#kill()");
    await this.fireOnWillShutdown(2 /* KILL */);
    await Promise.race([
      // Still do not block more than 1s
      timeout(1e3),
      // Destroy any opened window: we do not unload windows here because
      // there is a chance that the unload is veto'd or long running due
      // to a participant within the window. this is not wanted when we
      // are asked to kill the application.
      (async () => {
        for (const window of getAllWindowsExcludingOffscreen()) {
          if (window && !window.isDestroyed()) {
            let whenWindowClosed;
            if (window.webContents && !window.webContents.isDestroyed()) {
              whenWindowClosed = new Promise((resolve) => window.once("closed", resolve));
            } else {
              whenWindowClosed = Promise.resolve();
            }
            window.destroy();
            await whenWindowClosed;
          }
        }
      })()
    ]);
    electron.app.exit(code);
  }
};
LifecycleMainService.QUIT_AND_RESTART_KEY = "lifecycle.quitAndRestart";
LifecycleMainService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IStateService),
  __decorateParam(2, IEnvironmentMainService)
], LifecycleMainService);
export {
  ILifecycleMainService,
  LifecycleMainPhase,
  LifecycleMainService,
  ShutdownReason
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9saWZlY3ljbGUvZWxlY3Ryb24tbWFpbi9saWZlY3ljbGVNYWluU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBlbGVjdHJvbiBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgeyB2YWxpZGF0ZWRJcGNNYWluIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvZWxlY3Ryb24tbWFpbi9pcGNNYWluLmpzJztcbmltcG9ydCB7IEJhcnJpZXIsIFByb21pc2VzLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGN3ZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3MuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgTmF0aXZlUGFyc2VkQXJncyB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9hcmd2LmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc3RhdGUvbm9kZS9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBJQ29kZVdpbmRvdywgTG9hZFJlYXNvbiwgVW5sb2FkUmVhc29uIH0gZnJvbSAnLi4vLi4vd2luZG93L2VsZWN0cm9uLW1haW4vd2luZG93LmpzJztcbmltcG9ydCB7IElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLCBJV29ya3NwYWNlSWRlbnRpZmllciB9IGZyb20gJy4uLy4uL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvZWxlY3Ryb24tbWFpbi9lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElBdXhpbGlhcnlXaW5kb3cgfSBmcm9tICcuLi8uLi9hdXhpbGlhcnlXaW5kb3cvZWxlY3Ryb24tbWFpbi9hdXhpbGlhcnlXaW5kb3cuanMnO1xuaW1wb3J0IHsgZ2V0QWxsV2luZG93c0V4Y2x1ZGluZ09mZnNjcmVlbiB9IGZyb20gJy4uLy4uL3dpbmRvd3MvZWxlY3Ryb24tbWFpbi93aW5kb3dzLmpzJztcblxuZXhwb3J0IGNvbnN0IElMaWZlY3ljbGVNYWluU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJTGlmZWN5Y2xlTWFpblNlcnZpY2U+KCdsaWZlY3ljbGVNYWluU2VydmljZScpO1xuXG5pbnRlcmZhY2UgV2luZG93TG9hZEV2ZW50IHtcblxuXHQvKipcblx0ICogVGhlIHdpbmRvdyB0aGF0IGlzIGxvYWRlZCB0byBhIG5ldyB3b3Jrc3BhY2UuXG5cdCAqL1xuXHRyZWFkb25seSB3aW5kb3c6IElDb2RlV2luZG93O1xuXG5cdC8qKlxuXHQgKiBUaGUgd29ya3NwYWNlIHRoZSB3aW5kb3cgaXMgbG9hZGVkIGludG8uXG5cdCAqL1xuXHRyZWFkb25seSB3b3Jrc3BhY2U6IElXb3Jrc3BhY2VJZGVudGlmaWVyIHwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIE1vcmUgZGV0YWlscyB3aHkgdGhlIHdpbmRvdyBsb2FkcyB0byBhIG5ldyB3b3Jrc3BhY2UuXG5cdCAqL1xuXHRyZWFkb25seSByZWFzb246IExvYWRSZWFzb247XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFNodXRkb3duUmVhc29uIHtcblxuXHQvKipcblx0ICogVGhlIGFwcGxpY2F0aW9uIGV4aXRzIG5vcm1hbGx5LlxuXHQgKi9cblx0UVVJVCA9IDEsXG5cblx0LyoqXG5cdCAqIFRoZSBhcHBsaWNhdGlvbiBleGl0cyBhYm5vcm1hbGx5IGFuZCBpcyBiZWluZ1xuXHQgKiBraWxsZWQgd2l0aCBhbiBleGl0IGNvZGUgKGUuZy4gZnJvbSBpbnRlZ3JhdGlvblxuXHQgKiB0ZXN0IHJ1bilcblx0ICovXG5cdEtJTExcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTaHV0ZG93bkV2ZW50IHtcblxuXHQvKipcblx0ICogTW9yZSBkZXRhaWxzIHdoeSB0aGUgYXBwbGljYXRpb24gaXMgc2h1dHRpbmcgZG93bi5cblx0ICovXG5cdHJlYXNvbjogU2h1dGRvd25SZWFzb247XG5cblx0LyoqXG5cdCAqIEFsbG93cyB0byBqb2luIHRoZSBzaHV0ZG93bi4gVGhlIHByb21pc2UgY2FuIGJlIGEgbG9uZyBydW5uaW5nIG9wZXJhdGlvbiBidXQgaXRcblx0ICogd2lsbCBibG9jayB0aGUgYXBwbGljYXRpb24gZnJvbSBjbG9zaW5nLlxuXHQgKi9cblx0am9pbihpZDogc3RyaW5nLCBwcm9taXNlOiBQcm9taXNlPHZvaWQ+KTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmVsYXVuY2hIYW5kbGVyIHtcblxuXHQvKipcblx0ICogQWxsb3dzIGEgaGFuZGxlciB0byBkZWFsIHdpdGggcmVsYXVuY2hpbmcgdGhlIGFwcGxpY2F0aW9uLiBUaGUgcmV0dXJuXG5cdCAqIHZhbHVlIGluZGljYXRlcyBpZiB0aGUgcmVsYXVuY2ggaXMgaGFuZGxlZCBvciBub3QuXG5cdCAqL1xuXHRoYW5kbGVSZWxhdW5jaChvcHRpb25zPzogSVJlbGF1bmNoT3B0aW9ucyk6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlbGF1bmNoT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGFkZEFyZ3M/OiBzdHJpbmdbXTtcblx0cmVhZG9ubHkgcmVtb3ZlQXJncz86IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaWZlY3ljbGVNYWluU2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBXaWxsIGJlIHRydWUgaWYgdGhlIHByb2dyYW0gd2FzIHJlc3RhcnRlZCAoZS5nLiBkdWUgdG8gZXhwbGljaXQgcmVxdWVzdCBvciB1cGRhdGUpLlxuXHQgKi9cblx0cmVhZG9ubHkgd2FzUmVzdGFydGVkOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBXaWxsIGJlIHRydWUgaWYgdGhlIHByb2dyYW0gd2FzIHJlcXVlc3RlZCB0byBxdWl0LlxuXHQgKi9cblx0cmVhZG9ubHkgcXVpdFJlcXVlc3RlZDogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQSBmbGFnIGluZGljYXRpbmcgaW4gd2hhdCBwaGFzZSBvZiB0aGUgbGlmZWN5Y2xlIHdlIGN1cnJlbnRseSBhcmUuXG5cdCAqL1xuXHRwaGFzZTogTGlmZWN5Y2xlTWFpblBoYXNlO1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCB0aGF0IGZpcmVzIHdoZW4gdGhlIGFwcGxpY2F0aW9uIGlzIGFib3V0IHRvIHNodXRkb3duIGJlZm9yZSBhbnkgd2luZG93IGlzIGNsb3NlZC5cblx0ICogVGhlIHNodXRkb3duIGNhbiBzdGlsbCBiZSBwcmV2ZW50ZWQgYnkgYW55IHdpbmRvdyB0aGF0IHZldG9zIHRoaXMgZXZlbnQuXG5cdCAqL1xuXHRyZWFkb25seSBvbkJlZm9yZVNodXRkb3duOiBFdmVudDx2b2lkPjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgdGhhdCBmaXJlcyBhZnRlciB0aGUgb25CZWZvcmVTaHV0ZG93biBldmVudCBoYXMgYmVlbiBmaXJlZCBhbmQgYWZ0ZXIgbm8gd2luZG93IGhhc1xuXHQgKiB2ZXRvZWQgdGhlIHNodXRkb3duIHNlcXVlbmNlLiBBdCB0aGlzIHBvaW50IGxpc3RlbmVycyBhcmUgZW5zdXJlZCB0aGF0IHRoZSBhcHBsaWNhdGlvbiB3aWxsXG5cdCAqIHF1aXQgd2l0aG91dCB2ZXRvLlxuXHQgKi9cblx0cmVhZG9ubHkgb25XaWxsU2h1dGRvd246IEV2ZW50PFNodXRkb3duRXZlbnQ+O1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCB0aGF0IGZpcmVzIHdoZW4gYSB3aW5kb3cgaXMgbG9hZGluZy4gVGhpcyBjYW4gZWl0aGVyIGJlIGEgd2luZG93IG9wZW5pbmcgZm9yIHRoZVxuXHQgKiBmaXJzdCB0aW1lIG9yIGEgd2luZG93IHJlbG9hZGluZyBvciBjaGFuZ2luZyB0byBhbm90aGVyIFVSTC5cblx0ICovXG5cdHJlYWRvbmx5IG9uV2lsbExvYWRXaW5kb3c6IEV2ZW50PFdpbmRvd0xvYWRFdmVudD47XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHRoYXQgZmlyZXMgYmVmb3JlIGEgd2luZG93IGNsb3Nlcy4gVGhpcyBldmVudCBpcyBmaXJlZCBhZnRlciBhbnkgdmV0byBoYXMgYmVlbiBkZWFsdFxuXHQgKiB3aXRoIHNvIHRoYXQgbGlzdGVuZXJzIGtub3cgZm9yIHN1cmUgdGhhdCB0aGUgd2luZG93IHdpbGwgY2xvc2Ugd2l0aG91dCB2ZXRvLlxuXHQgKi9cblx0cmVhZG9ubHkgb25CZWZvcmVDbG9zZVdpbmRvdzogRXZlbnQ8SUNvZGVXaW5kb3c+O1xuXG5cdC8qKlxuXHQgKiBNYWtlIGEgYElDb2RlV2luZG93YCBrbm93biB0byB0aGUgbGlmZWN5Y2xlIG1haW4gc2VydmljZS5cblx0ICovXG5cdHJlZ2lzdGVyV2luZG93KHdpbmRvdzogSUNvZGVXaW5kb3cpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBNYWtlIGEgYElBdXhpbGlhcnlXaW5kb3dgIGtub3duIHRvIHRoZSBsaWZlY3ljbGUgbWFpbiBzZXJ2aWNlLlxuXHQgKi9cblx0cmVnaXN0ZXJBdXhXaW5kb3coYXV4V2luZG93OiBJQXV4aWxpYXJ5V2luZG93KTogdm9pZDtcblxuXHQvKipcblx0ICogUmVsb2FkIGEgd2luZG93LiBBbGwgbGlmZWN5Y2xlIGV2ZW50IGhhbmRsZXJzIGFyZSB0cmlnZ2VyZWQuXG5cdCAqL1xuXHRyZWxvYWQod2luZG93OiBJQ29kZVdpbmRvdywgY2xpPzogTmF0aXZlUGFyc2VkQXJncyk6IFByb21pc2U8dm9pZD47XG5cblx0LyoqXG5cdCAqIFVubG9hZCBhIHdpbmRvdyBmb3IgdGhlIHByb3ZpZGVkIHJlYXNvbi4gQWxsIGxpZmVjeWNsZSBldmVudCBoYW5kbGVycyBhcmUgdHJpZ2dlcmVkLlxuXHQgKi9cblx0dW5sb2FkKHdpbmRvdzogSUNvZGVXaW5kb3csIHJlYXNvbjogVW5sb2FkUmVhc29uKTogUHJvbWlzZTxib29sZWFuIC8qIHZldG8gKi8+O1xuXG5cdC8qKlxuXHQgKiBSZXN0YXJ0IHRoZSBhcHBsaWNhdGlvbiB3aXRoIG9wdGlvbmFsIGFyZ3VtZW50cyAoQ0xJKS4gQWxsIGxpZmVjeWNsZSBldmVudCBoYW5kbGVycyBhcmUgdHJpZ2dlcmVkLlxuXHQgKi9cblx0cmVsYXVuY2gob3B0aW9ucz86IElSZWxhdW5jaE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBTZXRzIGEgY3VzdG9tIGhhbmRsZXIgZm9yIHJlbGF1bmNoaW5nIHRoZSBhcHBsaWNhdGlvbi5cblx0ICovXG5cdHNldFJlbGF1bmNoSGFuZGxlcihoYW5kbGVyOiBJUmVsYXVuY2hIYW5kbGVyKTogdm9pZDtcblxuXHQvKipcblx0ICogU2h1dGRvd24gdGhlIGFwcGxpY2F0aW9uIG5vcm1hbGx5LiBBbGwgbGlmZWN5Y2xlIGV2ZW50IGhhbmRsZXJzIGFyZSB0cmlnZ2VyZWQuXG5cdCAqL1xuXHRxdWl0KHdpbGxSZXN0YXJ0PzogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbiAvKiB2ZXRvICovPjtcblxuXHQvKipcblx0ICogRm9yY2VmdWxseSBzaHV0ZG93biB0aGUgYXBwbGljYXRpb24gYW5kIG9wdGlvbmFsbHkgc2V0IGFuIGV4aXQgY29kZS5cblx0ICpcblx0ICogVGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgdXNlZCBpbiByYXJlIHNpdHVhdGlvbnMgd2hlcmUgaXQgaXMgaW1wb3J0YW50XG5cdCAqIHRvIHNldCBhbiBleGl0IGNvZGUgKGUuZy4gcnVubmluZyB0ZXN0cykgb3Igd2hlbiB0aGUgYXBwbGljYXRpb24gaXNcblx0ICogbm90IGluIGEgaGVhbHRoeSBzdGF0ZSBhbmQgc2hvdWxkIHRlcm1pbmF0ZSBhc2FwLlxuXHQgKlxuXHQgKiBUaGlzIG1ldGhvZCBkb2VzIG5vdCBmaXJlIHRoZSBub3JtYWwgbGlmZWN5Y2xlIGV2ZW50cyB0byB0aGUgd2luZG93cyxcblx0ICogdGhhdCBub3JtYWxseSBjYW4gYmUgdmV0b2VkLiBXaW5kb3dzIGFyZSBkZXN0cm95ZWQgd2l0aG91dCBhIGNoYW5jZVxuXHQgKiBvZiBjb21wb25lbnRzIHRvIHBhcnRpY2lwYXRlLiBUaGUgb25seSBsaWZlY3ljbGUgZXZlbnQgaGFuZGxlciB0aGF0XG5cdCAqIGlzIHRyaWdnZXJlZCBpcyBgb25XaWxsU2h1dGRvd25gIGluIHRoZSBtYWluIHByb2Nlc3MuXG5cdCAqL1xuXHRraWxsKGNvZGU/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gYSBjZXJ0YWluIGxpZmVjeWNsZSBwaGFzZVxuXHQgKiBoYXMgc3RhcnRlZC5cblx0ICovXG5cdHdoZW4ocGhhc2U6IExpZmVjeWNsZU1haW5QaGFzZSk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIExpZmVjeWNsZU1haW5QaGFzZSB7XG5cblx0LyoqXG5cdCAqIFRoZSBmaXJzdCBwaGFzZSBzaWduYWxzIHRoYXQgd2UgYXJlIGFib3V0IHRvIHN0YXJ0dXAuXG5cdCAqL1xuXHRTdGFydGluZyA9IDEsXG5cblx0LyoqXG5cdCAqIFNlcnZpY2VzIGFyZSByZWFkeSBhbmQgZmlyc3Qgd2luZG93IGlzIGFib3V0IHRvIG9wZW4uXG5cdCAqL1xuXHRSZWFkeSA9IDIsXG5cblx0LyoqXG5cdCAqIFRoaXMgcGhhc2Ugc2lnbmFscyBhIHBvaW50IGluIHRpbWUgYWZ0ZXIgdGhlIHdpbmRvdyBoYXMgb3BlbmVkXG5cdCAqIGFuZCBpcyB0eXBpY2FsbHkgdGhlIGJlc3QgcGxhY2UgdG8gZG8gd29yayB0aGF0IGlzIG5vdCByZXF1aXJlZFxuXHQgKiBmb3IgdGhlIHdpbmRvdyB0byBvcGVuLlxuXHQgKi9cblx0QWZ0ZXJXaW5kb3dPcGVuID0gMyxcblxuXHQvKipcblx0ICogVGhlIGxhc3QgcGhhc2UgYWZ0ZXIgYSB3aW5kb3cgaGFzIG9wZW5lZCBhbmQgc29tZSB0aW1lIGhhcyBwYXNzZWRcblx0ICogKDItNSBzZWNvbmRzKS5cblx0ICovXG5cdEV2ZW50dWFsbHkgPSA0XG59XG5cbmV4cG9ydCBjbGFzcyBMaWZlY3ljbGVNYWluU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTGlmZWN5Y2xlTWFpblNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFFVSVRfQU5EX1JFU1RBUlRfS0VZID0gJ2xpZmVjeWNsZS5xdWl0QW5kUmVzdGFydCc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25CZWZvcmVTaHV0ZG93biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkJlZm9yZVNodXRkb3duID0gdGhpcy5fb25CZWZvcmVTaHV0ZG93bi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxTaHV0ZG93biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFNodXRkb3duRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxTaHV0ZG93biA9IHRoaXMuX29uV2lsbFNodXRkb3duLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbExvYWRXaW5kb3cgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxXaW5kb3dMb2FkRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxMb2FkV2luZG93ID0gdGhpcy5fb25XaWxsTG9hZFdpbmRvdy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkJlZm9yZUNsb3NlV2luZG93ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUNvZGVXaW5kb3c+KCkpO1xuXHRyZWFkb25seSBvbkJlZm9yZUNsb3NlV2luZG93ID0gdGhpcy5fb25CZWZvcmVDbG9zZVdpbmRvdy5ldmVudDtcblxuXHRwcml2YXRlIF9xdWl0UmVxdWVzdGVkID0gZmFsc2U7XG5cdGdldCBxdWl0UmVxdWVzdGVkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fcXVpdFJlcXVlc3RlZDsgfVxuXG5cdHByaXZhdGUgX3dhc1Jlc3RhcnRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRnZXQgd2FzUmVzdGFydGVkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fd2FzUmVzdGFydGVkOyB9XG5cblx0cHJpdmF0ZSBfcGhhc2UgPSBMaWZlY3ljbGVNYWluUGhhc2UuU3RhcnRpbmc7XG5cdGdldCBwaGFzZSgpOiBMaWZlY3ljbGVNYWluUGhhc2UgeyByZXR1cm4gdGhpcy5fcGhhc2U7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHdpbmRvd1RvQ2xvc2VSZXF1ZXN0ID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdHByaXZhdGUgb25lVGltZUxpc3RlbmVyVG9rZW5HZW5lcmF0b3IgPSAwO1xuXHRwcml2YXRlIHdpbmRvd0NvdW50ZXIgPSAwO1xuXG5cdHByaXZhdGUgcGVuZGluZ1F1aXRQcm9taXNlOiBQcm9taXNlPGJvb2xlYW4+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIHBlbmRpbmdRdWl0UHJvbWlzZVJlc29sdmU6IHsgKHZldG86IGJvb2xlYW4pOiB2b2lkIH0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBwZW5kaW5nV2lsbFNodXRkb3duUHJvbWlzZTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1hcFdpbmRvd0lkVG9QZW5kaW5nVW5sb2FkID0gbmV3IE1hcDxudW1iZXIsIFByb21pc2U8Ym9vbGVhbj4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBwaGFzZVdoZW4gPSBuZXcgTWFwPExpZmVjeWNsZU1haW5QaGFzZSwgQmFycmllcj4oKTtcblxuXHRwcml2YXRlIHJlbGF1bmNoSGFuZGxlcjogSVJlbGF1bmNoSGFuZGxlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVN0YXRlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0YXRlU2VydmljZTogSVN0YXRlU2VydmljZSxcblx0XHRASUVudmlyb25tZW50TWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudE1haW5TZXJ2aWNlOiBJRW52aXJvbm1lbnRNYWluU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZXNvbHZlUmVzdGFydGVkKCk7XG5cdFx0dGhpcy53aGVuKExpZmVjeWNsZU1haW5QaGFzZS5SZWFkeSkudGhlbigoKSA9PiB0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlUmVzdGFydGVkKCk6IHZvaWQge1xuXHRcdHRoaXMuX3dhc1Jlc3RhcnRlZCA9ICEhdGhpcy5zdGF0ZVNlcnZpY2UuZ2V0SXRlbShMaWZlY3ljbGVNYWluU2VydmljZS5RVUlUX0FORF9SRVNUQVJUX0tFWSk7XG5cblx0XHRpZiAodGhpcy5fd2FzUmVzdGFydGVkKSB7XG5cdFx0XHQvLyByZW1vdmUgdGhlIG1hcmtlciByaWdodCBhZnRlciBpZiBmb3VuZFxuXHRcdFx0dGhpcy5zdGF0ZVNlcnZpY2UucmVtb3ZlSXRlbShMaWZlY3ljbGVNYWluU2VydmljZS5RVUlUX0FORF9SRVNUQVJUX0tFWSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIGJlZm9yZS1xdWl0OiBhbiBldmVudCB0aGF0IGlzIGZpcmVkIGlmIGFwcGxpY2F0aW9uIHF1aXQgd2FzXG5cdFx0Ly8gcmVxdWVzdGVkIGJ1dCBiZWZvcmUgYW55IHdpbmRvdyB3YXMgY2xvc2VkLlxuXHRcdGNvbnN0IGJlZm9yZVF1aXRMaXN0ZW5lciA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9xdWl0UmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50cmFjZSgnTGlmZWN5Y2xlI2FwcC5vbihiZWZvcmUtcXVpdCknKTtcblx0XHRcdHRoaXMuX3F1aXRSZXF1ZXN0ZWQgPSB0cnVlO1xuXG5cdFx0XHQvLyBFbWl0IGV2ZW50IHRvIGluZGljYXRlIHRoYXQgd2UgYXJlIGFib3V0IHRvIHNodXRkb3duXG5cdFx0XHR0aGlzLnRyYWNlKCdMaWZlY3ljbGUjb25CZWZvcmVTaHV0ZG93bi5maXJlKCknKTtcblx0XHRcdHRoaXMuX29uQmVmb3JlU2h1dGRvd24uZmlyZSgpO1xuXG5cdFx0XHQvLyBtYWNPUzogY2FuIHJ1biB3aXRob3V0IGFueSB3aW5kb3cgb3Blbi4gaW4gdGhhdCBjYXNlIHdlIGZpcmVcblx0XHRcdC8vIHRoZSBvbldpbGxTaHV0ZG93bigpIGV2ZW50IGRpcmVjdGx5IGJlY2F1c2UgdGhlcmUgaXMgbm8gdmV0b1xuXHRcdFx0Ly8gdG8gYmUgZXhwZWN0ZWQuXG5cdFx0XHRpZiAoaXNNYWNpbnRvc2ggJiYgdGhpcy53aW5kb3dDb3VudGVyID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuZmlyZU9uV2lsbFNodXRkb3duKFNodXRkb3duUmVhc29uLlFVSVQpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0ZWxlY3Ryb24uYXBwLmFkZExpc3RlbmVyKCdiZWZvcmUtcXVpdCcsIGJlZm9yZVF1aXRMaXN0ZW5lcik7XG5cblx0XHQvLyB3aW5kb3ctYWxsLWNsb3NlZDogYW4gZXZlbnQgdGhhdCBvbmx5IGZpcmVzIHdoZW4gdGhlIGxhc3Qgd2luZG93XG5cdFx0Ly8gd2FzIGNsb3NlZC4gV2Ugb3ZlcnJpZGUgdGhpcyBldmVudCB0byBiZSBpbiBjaGFyZ2UgaWYgYXBwLnF1aXQoKVxuXHRcdC8vIHNob3VsZCBiZSBjYWxsZWQgb3Igbm90LlxuXHRcdGNvbnN0IHdpbmRvd0FsbENsb3NlZExpc3RlbmVyID0gKCkgPT4ge1xuXHRcdFx0dGhpcy50cmFjZSgnTGlmZWN5Y2xlI2FwcC5vbih3aW5kb3ctYWxsLWNsb3NlZCknKTtcblxuXHRcdFx0Ly8gV2luZG93cy9MaW51eDogd2UgcXVpdCB3aGVuIGFsbCB3aW5kb3dzIGhhdmUgY2xvc2VkXG5cdFx0XHQvLyBNYWM6IHdlIG9ubHkgcXVpdCB3aGVuIHF1aXQgd2FzIHJlcXVlc3RlZFxuXHRcdFx0aWYgKHRoaXMuX3F1aXRSZXF1ZXN0ZWQgfHwgIWlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdGVsZWN0cm9uLmFwcC5xdWl0KCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRlbGVjdHJvbi5hcHAuYWRkTGlzdGVuZXIoJ3dpbmRvdy1hbGwtY2xvc2VkJywgd2luZG93QWxsQ2xvc2VkTGlzdGVuZXIpO1xuXG5cdFx0Ly8gd2lsbC1xdWl0OiBhbiBldmVudCB0aGF0IGlzIGZpcmVkIGFmdGVyIGFsbCB3aW5kb3dzIGhhdmUgYmVlblxuXHRcdC8vIGNsb3NlZCwgYnV0IGJlZm9yZSBhY3R1YWxseSBxdWl0dGluZy5cblx0XHRlbGVjdHJvbi5hcHAub25jZSgnd2lsbC1xdWl0JywgZSA9PiB7XG5cdFx0XHR0aGlzLnRyYWNlKCdMaWZlY3ljbGUjYXBwLm9uKHdpbGwtcXVpdCkgLSBiZWdpbicpO1xuXG5cdFx0XHQvLyBQcmV2ZW50IHRoZSBxdWl0IHVudGlsIHRoZSBzaHV0ZG93biBwcm9taXNlIHdhcyByZXNvbHZlZFxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHQvLyBTdGFydCBzaHV0ZG93biBzZXF1ZW5jZVxuXHRcdFx0Y29uc3Qgc2h1dGRvd25Qcm9taXNlID0gdGhpcy5maXJlT25XaWxsU2h1dGRvd24oU2h1dGRvd25SZWFzb24uUVVJVCk7XG5cblx0XHRcdC8vIFdhaXQgdW50aWwgc2h1dGRvd24gaXMgc2lnbmFsZWQgdG8gYmUgY29tcGxldGVcblx0XHRcdHNodXRkb3duUHJvbWlzZS5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0dGhpcy50cmFjZSgnTGlmZWN5Y2xlI2FwcC5vbih3aWxsLXF1aXQpIC0gYWZ0ZXIgZmlyZU9uV2lsbFNodXRkb3duJyk7XG5cblx0XHRcdFx0Ly8gUmVzb2x2ZSBwZW5kaW5nIHF1aXQgcHJvbWlzZSBub3cgd2l0aG91dCB2ZXRvXG5cdFx0XHRcdHRoaXMucmVzb2x2ZVBlbmRpbmdRdWl0UHJvbWlzZShmYWxzZSAvKiBubyB2ZXRvICovKTtcblxuXHRcdFx0XHQvLyBRdWl0IGFnYWluLCB0aGlzIHRpbWUgZG8gbm90IHByZXZlbnQgdGhpcywgc2luY2Ugb3VyXG5cdFx0XHRcdC8vIHdpbGwtcXVpdCBsaXN0ZW5lciBpcyBvbmx5IGluc3RhbGxlZCBcIm9uY2VcIi4gQWxzb1xuXHRcdFx0XHQvLyByZW1vdmUgYW55IGxpc3RlbmVyIHdlIGhhdmUgdGhhdCBpcyBubyBsb25nZXIgbmVlZGVkXG5cblx0XHRcdFx0ZWxlY3Ryb24uYXBwLnJlbW92ZUxpc3RlbmVyKCdiZWZvcmUtcXVpdCcsIGJlZm9yZVF1aXRMaXN0ZW5lcik7XG5cdFx0XHRcdGVsZWN0cm9uLmFwcC5yZW1vdmVMaXN0ZW5lcignd2luZG93LWFsbC1jbG9zZWQnLCB3aW5kb3dBbGxDbG9zZWRMaXN0ZW5lcik7XG5cblx0XHRcdFx0dGhpcy50cmFjZSgnTGlmZWN5Y2xlI2FwcC5vbih3aWxsLXF1aXQpIC0gY2FsbGluZyBhcHAucXVpdCgpJyk7XG5cblx0XHRcdFx0ZWxlY3Ryb24uYXBwLnF1aXQoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBmaXJlT25XaWxsU2h1dGRvd24ocmVhc29uOiBTaHV0ZG93blJlYXNvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLnBlbmRpbmdXaWxsU2h1dGRvd25Qcm9taXNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wZW5kaW5nV2lsbFNodXRkb3duUHJvbWlzZTsgLy8gc2h1dGRvd24gaXMgYWxyZWFkeSBydW5uaW5nXG5cdFx0fVxuXG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IHRoaXMubG9nU2VydmljZTtcblx0XHR0aGlzLnRyYWNlKCdMaWZlY3ljbGUjb25XaWxsU2h1dGRvd24uZmlyZSgpJyk7XG5cblx0XHRjb25zdCBqb2luZXJzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblxuXHRcdHRoaXMuX29uV2lsbFNodXRkb3duLmZpcmUoe1xuXHRcdFx0cmVhc29uLFxuXHRcdFx0am9pbihpZCwgcHJvbWlzZSkge1xuXHRcdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKGBMaWZlY3ljbGUjb25XaWxsU2h1dGRvd24gLSBiZWdpbiAnJHtpZH0nYCk7XG5cdFx0XHRcdGpvaW5lcnMucHVzaChwcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoYExpZmVjeWNsZSNvbldpbGxTaHV0ZG93biAtIGVuZCAnJHtpZH0nYCk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucGVuZGluZ1dpbGxTaHV0ZG93blByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHQvLyBTZXR0bGUgYWxsIHNodXRkb3duIGV2ZW50IGpvaW5lcnNcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoam9pbmVycyk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUaGVuLCBhbHdheXMgbWFrZSBzdXJlIGF0IHRoZSBlbmRcblx0XHRcdC8vIHRoZSBzdGF0ZSBzZXJ2aWNlIGlzIGZsdXNoZWQuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnN0YXRlU2VydmljZS5jbG9zZSgpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9KSgpO1xuXG5cdFx0cmV0dXJuIHRoaXMucGVuZGluZ1dpbGxTaHV0ZG93blByb21pc2U7XG5cdH1cblxuXHRzZXQgcGhhc2UodmFsdWU6IExpZmVjeWNsZU1haW5QaGFzZSkge1xuXHRcdGlmICh2YWx1ZSA8IHRoaXMucGhhc2UpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTGlmZWN5Y2xlIGNhbm5vdCBnbyBiYWNrd2FyZHMnKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcGhhc2UgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy50cmFjZShgbGlmZWN5Y2xlIChtYWluKTogcGhhc2UgY2hhbmdlZCAodmFsdWU6ICR7dmFsdWV9KWApO1xuXG5cdFx0dGhpcy5fcGhhc2UgPSB2YWx1ZTtcblxuXHRcdGNvbnN0IGJhcnJpZXIgPSB0aGlzLnBoYXNlV2hlbi5nZXQodGhpcy5fcGhhc2UpO1xuXHRcdGlmIChiYXJyaWVyKSB7XG5cdFx0XHRiYXJyaWVyLm9wZW4oKTtcblx0XHRcdHRoaXMucGhhc2VXaGVuLmRlbGV0ZSh0aGlzLl9waGFzZSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgd2hlbihwaGFzZTogTGlmZWN5Y2xlTWFpblBoYXNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHBoYXNlIDw9IHRoaXMuX3BoYXNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGJhcnJpZXIgPSB0aGlzLnBoYXNlV2hlbi5nZXQocGhhc2UpO1xuXHRcdGlmICghYmFycmllcikge1xuXHRcdFx0YmFycmllciA9IG5ldyBCYXJyaWVyKCk7XG5cdFx0XHR0aGlzLnBoYXNlV2hlbi5zZXQocGhhc2UsIGJhcnJpZXIpO1xuXHRcdH1cblxuXHRcdGF3YWl0IGJhcnJpZXIud2FpdCgpO1xuXHR9XG5cblx0cmVnaXN0ZXJXaW5kb3cod2luZG93OiBJQ29kZVdpbmRvdyk6IHZvaWQge1xuXHRcdGNvbnN0IHdpbmRvd0xpc3RlbmVycyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdC8vIHRyYWNrIHdpbmRvdyBjb3VudFxuXHRcdHRoaXMud2luZG93Q291bnRlcisrO1xuXG5cdFx0Ly8gV2luZG93IFdpbGwgTG9hZFxuXHRcdHdpbmRvd0xpc3RlbmVycy5hZGQod2luZG93Lm9uV2lsbExvYWQoZSA9PiB0aGlzLl9vbldpbGxMb2FkV2luZG93LmZpcmUoeyB3aW5kb3csIHdvcmtzcGFjZTogZS53b3Jrc3BhY2UsIHJlYXNvbjogZS5yZWFzb24gfSkpKTtcblxuXHRcdC8vIFdpbmRvdyBCZWZvcmUgQ2xvc2luZzogTWFpbiAtPiBSZW5kZXJlclxuXHRcdGNvbnN0IHdpbiA9IGFzc2VydElzRGVmaW5lZCh3aW5kb3cud2luKTtcblx0XHR3aW5kb3dMaXN0ZW5lcnMuYWRkKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyPGVsZWN0cm9uLkV2ZW50Pih3aW4sICdjbG9zZScpKGUgPT4ge1xuXG5cdFx0XHQvLyBUaGUgd2luZG93IGFscmVhZHkgYWNrbm93bGVkZ2VkIHRvIGJlIGNsb3NlZFxuXHRcdFx0Y29uc3Qgd2luZG93SWQgPSB3aW5kb3cuaWQ7XG5cdFx0XHRpZiAodGhpcy53aW5kb3dUb0Nsb3NlUmVxdWVzdC5oYXMod2luZG93SWQpKSB7XG5cdFx0XHRcdHRoaXMud2luZG93VG9DbG9zZVJlcXVlc3QuZGVsZXRlKHdpbmRvd0lkKTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudHJhY2UoYExpZmVjeWNsZSN3aW5kb3cub24oJ2Nsb3NlJykgLSB3aW5kb3cgSUQgJHt3aW5kb3cuaWR9YCk7XG5cblx0XHRcdC8vIE90aGVyd2lzZSBwcmV2ZW50IHVubG9hZCBhbmQgaGFuZGxlIGl0IGZyb20gd2luZG93XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLnVubG9hZCh3aW5kb3csIFVubG9hZFJlYXNvbi5DTE9TRSkudGhlbih2ZXRvID0+IHtcblx0XHRcdFx0aWYgKHZldG8pIHtcblx0XHRcdFx0XHR0aGlzLndpbmRvd1RvQ2xvc2VSZXF1ZXN0LmRlbGV0ZSh3aW5kb3dJZCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy53aW5kb3dUb0Nsb3NlUmVxdWVzdC5hZGQod2luZG93SWQpO1xuXG5cdFx0XHRcdC8vIEZpcmUgb25CZWZvcmVDbG9zZVdpbmRvdyBiZWZvcmUgYWN0dWFsbHkgY2xvc2luZ1xuXHRcdFx0XHR0aGlzLnRyYWNlKGBMaWZlY3ljbGUjb25CZWZvcmVDbG9zZVdpbmRvdy5maXJlKCkgLSB3aW5kb3cgSUQgJHt3aW5kb3dJZH1gKTtcblx0XHRcdFx0dGhpcy5fb25CZWZvcmVDbG9zZVdpbmRvdy5maXJlKHdpbmRvdyk7XG5cblx0XHRcdFx0Ly8gTm8gdmV0bywgY2xvc2Ugd2luZG93IG5vd1xuXHRcdFx0XHR3aW5kb3cuY2xvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0XHR3aW5kb3dMaXN0ZW5lcnMuYWRkKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyPGVsZWN0cm9uLkV2ZW50Pih3aW4sICdjbG9zZWQnKSgoKSA9PiB7XG5cdFx0XHR0aGlzLnRyYWNlKGBMaWZlY3ljbGUjd2luZG93Lm9uKCdjbG9zZWQnKSAtIHdpbmRvdyBJRCAke3dpbmRvdy5pZH1gKTtcblxuXHRcdFx0Ly8gdXBkYXRlIHdpbmRvdyBjb3VudFxuXHRcdFx0dGhpcy53aW5kb3dDb3VudGVyLS07XG5cblx0XHRcdC8vIGNsZWFyIHdpbmRvdyBsaXN0ZW5lcnNcblx0XHRcdHdpbmRvd0xpc3RlbmVycy5kaXNwb3NlKCk7XG5cblx0XHRcdC8vIGlmIHRoZXJlIGFyZSBubyBtb3JlIGNvZGUgd2luZG93cyBvcGVuZWQsIGZpcmUgdGhlIG9uV2lsbFNodXRkb3duIGV2ZW50LCB1bmxlc3Ncblx0XHRcdC8vIHdlIGFyZSBvbiBtYWNPUyB3aGVyZSBpdCBpcyBwZXJmZWN0bHkgZmluZSB0byBjbG9zZSB0aGUgbGFzdCB3aW5kb3cgYW5kXG5cdFx0XHQvLyB0aGUgYXBwbGljYXRpb24gY29udGludWVzIHJ1bm5pbmcgKHVubGVzcyBxdWl0IHdhcyBhY3R1YWxseSByZXF1ZXN0ZWQpXG5cdFx0XHRpZiAodGhpcy53aW5kb3dDb3VudGVyID09PSAwICYmICghaXNNYWNpbnRvc2ggfHwgdGhpcy5fcXVpdFJlcXVlc3RlZCkpIHtcblx0XHRcdFx0dGhpcy5maXJlT25XaWxsU2h1dGRvd24oU2h1dGRvd25SZWFzb24uUVVJVCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cmVnaXN0ZXJBdXhXaW5kb3coYXV4V2luZG93OiBJQXV4aWxpYXJ5V2luZG93KTogdm9pZCB7XG5cdFx0Y29uc3Qgd2luID0gYXNzZXJ0SXNEZWZpbmVkKGF1eFdpbmRvdy53aW4pO1xuXG5cdFx0Y29uc3Qgd2luZG93TGlzdGVuZXJzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHdpbmRvd0xpc3RlbmVycy5hZGQoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXI8ZWxlY3Ryb24uRXZlbnQ+KHdpbiwgJ2Nsb3NlJykoZSA9PiB7XG5cdFx0XHR0aGlzLnRyYWNlKGBMaWZlY3ljbGUjYXV4V2luZG93Lm9uKCdjbG9zZScpIC0gd2luZG93IElEICR7YXV4V2luZG93LmlkfWApO1xuXG5cdFx0XHRpZiAodGhpcy5fcXVpdFJlcXVlc3RlZCkge1xuXHRcdFx0XHR0aGlzLnRyYWNlKGBMaWZlY3ljbGUjYXV4V2luZG93Lm9uKCdjbG9zZScpIC0gcHJldmVudERlZmF1bHQoKSBiZWNhdXNlIHF1aXQgcmVxdWVzdGVkYCk7XG5cblx0XHRcdFx0Ly8gV2hlbiBxdWl0IGlzIHJlcXVlc3RlZCwgRWxlY3Ryb24gd2lsbCBjbG9zZSBhbGxcblx0XHRcdFx0Ly8gYXV4aWxpYXJ5IHdpbmRvd3MgYmVmb3JlIGNsb3NpbmcgdGhlIG1haW4gd2luZG93cy5cblx0XHRcdFx0Ly8gVGhpcyBwcmV2ZW50cyB1cyBmcm9tIHN0b3JpbmcgdGhlIGF1eGlsaWFyeSB3aW5kb3dcblx0XHRcdFx0Ly8gc3RhdGUgb24gc2h1dGRvd24gYW5kIHRodXMgd2UgcHJldmVudCBjbG9zaW5nIGlmXG5cdFx0XHRcdC8vIHF1aXQgaXMgcmVxdWVzdGVkLlxuXHRcdFx0XHQvL1xuXHRcdFx0XHQvLyBJbnRlcmVzdGluZ2x5LCB0aGlzIHdpbGwgbm90IHByZXZlbnQgdGhlIGFwcGxpY2F0aW9uXG5cdFx0XHRcdC8vIGZyb20gcXVpdHRpbmcgYmVjYXVzZSB0aGUgYXV4aWxpYXJ5IHdpbmRvd3Mgd2lsbCBzdGlsbFxuXHRcdFx0XHQvLyBjbG9zZSBvbmNlIHRoZSBvd25pbmcgd2luZG93IGNsb3Nlcy5cblxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHdpbmRvd0xpc3RlbmVycy5hZGQoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXI8ZWxlY3Ryb24uRXZlbnQ+KHdpbiwgJ2Nsb3NlZCcpKCgpID0+IHtcblx0XHRcdHRoaXMudHJhY2UoYExpZmVjeWNsZSNhdXhXaW5kb3cub24oJ2Nsb3NlZCcpIC0gd2luZG93IElEICR7YXV4V2luZG93LmlkfWApO1xuXG5cdFx0XHR3aW5kb3dMaXN0ZW5lcnMuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGFzeW5jIHJlbG9hZCh3aW5kb3c6IElDb2RlV2luZG93LCBjbGk/OiBOYXRpdmVQYXJzZWRBcmdzKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBPbmx5IHJlbG9hZCB3aGVuIHRoZSB3aW5kb3cgaGFzIG5vdCB2ZXRvZWQgdGhpc1xuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCB0aGlzLnVubG9hZCh3aW5kb3csIFVubG9hZFJlYXNvbi5SRUxPQUQpO1xuXHRcdGlmICghdmV0bykge1xuXHRcdFx0d2luZG93LnJlbG9hZChjbGkpO1xuXHRcdH1cblx0fVxuXG5cdHVubG9hZCh3aW5kb3c6IElDb2RlV2luZG93LCByZWFzb246IFVubG9hZFJlYXNvbik6IFByb21pc2U8Ym9vbGVhbiAvKiB2ZXRvICovPiB7XG5cblx0XHQvLyBFbnN1cmUgdGhlcmUgaXMgb25seSAxIHVubG9hZCBydW5uaW5nIGF0IHRoZSBzYW1lIHRpbWVcblx0XHRjb25zdCBwZW5kaW5nVW5sb2FkUHJvbWlzZSA9IHRoaXMubWFwV2luZG93SWRUb1BlbmRpbmdVbmxvYWQuZ2V0KHdpbmRvdy5pZCk7XG5cdFx0aWYgKHBlbmRpbmdVbmxvYWRQcm9taXNlKSB7XG5cdFx0XHRyZXR1cm4gcGVuZGluZ1VubG9hZFByb21pc2U7XG5cdFx0fVxuXG5cdFx0Ly8gU3RhcnQgdW5sb2FkIGFuZCByZW1lbWJlciBpbiBtYXAgdW50aWwgZmluaXNoZWRcblx0XHRjb25zdCB1bmxvYWRQcm9taXNlID0gdGhpcy5kb1VubG9hZCh3aW5kb3csIHJlYXNvbikuZmluYWxseSgoKSA9PiB7XG5cdFx0XHR0aGlzLm1hcFdpbmRvd0lkVG9QZW5kaW5nVW5sb2FkLmRlbGV0ZSh3aW5kb3cuaWQpO1xuXHRcdH0pO1xuXHRcdHRoaXMubWFwV2luZG93SWRUb1BlbmRpbmdVbmxvYWQuc2V0KHdpbmRvdy5pZCwgdW5sb2FkUHJvbWlzZSk7XG5cblx0XHRyZXR1cm4gdW5sb2FkUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9VbmxvYWQod2luZG93OiBJQ29kZVdpbmRvdywgcmVhc29uOiBVbmxvYWRSZWFzb24pOiBQcm9taXNlPGJvb2xlYW4gLyogdmV0byAqLz4ge1xuXG5cdFx0Ly8gQWx3YXlzIGFsbG93IHRvIHVubG9hZCBhIHdpbmRvdyB0aGF0IGlzIG5vdCB5ZXQgcmVhZHlcblx0XHRpZiAoIXdpbmRvdy5pc1JlYWR5KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy50cmFjZShgTGlmZWN5Y2xlI3VubG9hZCgpIC0gd2luZG93IElEICR7d2luZG93LmlkfWApO1xuXG5cdFx0Ly8gZmlyc3QgYXNrIHRoZSB3aW5kb3cgaXRzZWxmIGlmIGl0IHZldG9zIHRoZSB1bmxvYWRcblx0XHRjb25zdCB3aW5kb3dVbmxvYWRSZWFzb24gPSB0aGlzLl9xdWl0UmVxdWVzdGVkID8gVW5sb2FkUmVhc29uLlFVSVQgOiByZWFzb247XG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IHRoaXMub25CZWZvcmVVbmxvYWRXaW5kb3dJblJlbmRlcmVyKHdpbmRvdywgd2luZG93VW5sb2FkUmVhc29uKTtcblx0XHRpZiAodmV0bykge1xuXHRcdFx0dGhpcy50cmFjZShgTGlmZWN5Y2xlI3VubG9hZCgpIC0gdmV0byBpbiByZW5kZXJlciAod2luZG93IElEICR7d2luZG93LmlkfSlgKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMuaGFuZGxlV2luZG93VW5sb2FkVmV0byh2ZXRvKTtcblx0XHR9XG5cblx0XHQvLyBmaW5hbGx5IGlmIHRoZXJlIGFyZSBubyB2ZXRvcywgdW5sb2FkIHRoZSByZW5kZXJlclxuXHRcdGF3YWl0IHRoaXMub25XaWxsVW5sb2FkV2luZG93SW5SZW5kZXJlcih3aW5kb3csIHdpbmRvd1VubG9hZFJlYXNvbik7XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVdpbmRvd1VubG9hZFZldG8odmV0bzogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGlmICghdmV0bykge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBubyB2ZXRvXG5cdFx0fVxuXG5cdFx0Ly8gYSB2ZXRvIHJlc29sdmVzIGFueSBwZW5kaW5nIHF1aXQgd2l0aCB2ZXRvXG5cdFx0dGhpcy5yZXNvbHZlUGVuZGluZ1F1aXRQcm9taXNlKHRydWUgLyogdmV0byAqLyk7XG5cblx0XHQvLyBhIHZldG8gcmVzZXRzIHRoZSBwZW5kaW5nIHF1aXQgcmVxdWVzdCBmbGFnXG5cdFx0dGhpcy5fcXVpdFJlcXVlc3RlZCA9IGZhbHNlO1xuXG5cdFx0cmV0dXJuIHRydWU7IC8vIHZldG9cblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZVBlbmRpbmdRdWl0UHJvbWlzZSh2ZXRvOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMucGVuZGluZ1F1aXRQcm9taXNlUmVzb2x2ZSkge1xuXHRcdFx0dGhpcy5wZW5kaW5nUXVpdFByb21pc2VSZXNvbHZlKHZldG8pO1xuXHRcdFx0dGhpcy5wZW5kaW5nUXVpdFByb21pc2VSZXNvbHZlID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5wZW5kaW5nUXVpdFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkJlZm9yZVVubG9hZFdpbmRvd0luUmVuZGVyZXIod2luZG93OiBJQ29kZVdpbmRvdywgcmVhc29uOiBVbmxvYWRSZWFzb24pOiBQcm9taXNlPGJvb2xlYW4gLyogdmV0byAqLz4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihyZXNvbHZlID0+IHtcblx0XHRcdGNvbnN0IG9uZVRpbWVFdmVudFRva2VuID0gdGhpcy5vbmVUaW1lTGlzdGVuZXJUb2tlbkdlbmVyYXRvcisrO1xuXHRcdFx0Y29uc3Qgb2tDaGFubmVsID0gYHZzY29kZTpvayR7b25lVGltZUV2ZW50VG9rZW59YDtcblx0XHRcdGNvbnN0IGNhbmNlbENoYW5uZWwgPSBgdnNjb2RlOmNhbmNlbCR7b25lVGltZUV2ZW50VG9rZW59YDtcblxuXHRcdFx0dmFsaWRhdGVkSXBjTWFpbi5vbmNlKG9rQ2hhbm5lbCwgKCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKGZhbHNlKTsgLy8gbm8gdmV0b1xuXHRcdFx0fSk7XG5cblx0XHRcdHZhbGlkYXRlZElwY01haW4ub25jZShjYW5jZWxDaGFubmVsLCAoKSA9PiB7XG5cdFx0XHRcdHJlc29sdmUodHJ1ZSk7IC8vIHZldG9cblx0XHRcdH0pO1xuXG5cdFx0XHR3aW5kb3cuc2VuZCgndnNjb2RlOm9uQmVmb3JlVW5sb2FkJywgeyBva0NoYW5uZWwsIGNhbmNlbENoYW5uZWwsIHJlYXNvbiB9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb25XaWxsVW5sb2FkV2luZG93SW5SZW5kZXJlcih3aW5kb3c6IElDb2RlV2luZG93LCByZWFzb246IFVubG9hZFJlYXNvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdGNvbnN0IG9uZVRpbWVFdmVudFRva2VuID0gdGhpcy5vbmVUaW1lTGlzdGVuZXJUb2tlbkdlbmVyYXRvcisrO1xuXHRcdFx0Y29uc3QgcmVwbHlDaGFubmVsID0gYHZzY29kZTpyZXBseSR7b25lVGltZUV2ZW50VG9rZW59YDtcblxuXHRcdFx0dmFsaWRhdGVkSXBjTWFpbi5vbmNlKHJlcGx5Q2hhbm5lbCwgKCkgPT4gcmVzb2x2ZSgpKTtcblxuXHRcdFx0d2luZG93LnNlbmQoJ3ZzY29kZTpvbldpbGxVbmxvYWQnLCB7IHJlcGx5Q2hhbm5lbCwgcmVhc29uIH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cXVpdCh3aWxsUmVzdGFydD86IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4gLyogdmV0byAqLz4ge1xuXHRcdHJldHVybiB0aGlzLmRvUXVpdCh3aWxsUmVzdGFydCkudGhlbih2ZXRvID0+IHtcblx0XHRcdGlmICghdmV0byAmJiB3aWxsUmVzdGFydCkge1xuXHRcdFx0XHQvLyBXaW5kb3dzOiB3ZSBhcmUgYWJvdXQgdG8gcmVzdGFydCBhbmQgYXMgc3VjaCB3ZSBuZWVkIHRvIHJlc3RvcmUgdGhlIG9yaWdpbmFsXG5cdFx0XHRcdC8vIGN1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnkgd2UgaGFkIG9uIHN0YXJ0dXAgdG8gZ2V0IHRoZSBleGFjdCBzYW1lIHN0YXJ0dXBcblx0XHRcdFx0Ly8gYmVoYXZpb3VyLiBBcyBzdWNoLCB3ZSBicmllZmx5IGNoYW5nZSBiYWNrIHRvIHRoYXQgZGlyZWN0b3J5IGFuZCB0aGVuIHdoZW5cblx0XHRcdFx0Ly8gQ29kZSBzdGFydHMgaXQgd2lsbCBzZXQgaXQgYmFjayB0byB0aGUgaW5zdGFsbGF0aW9uIGRpcmVjdG9yeSBhZ2Fpbi5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjdXJyZW50V29ya2luZ0RpciA9IGN3ZCgpO1xuXHRcdFx0XHRcdFx0aWYgKGN1cnJlbnRXb3JraW5nRGlyICE9PSBwcm9jZXNzLmN3ZCgpKSB7XG5cdFx0XHRcdFx0XHRcdHByb2Nlc3MuY2hkaXIoY3VycmVudFdvcmtpbmdEaXIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHZldG87XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGRvUXVpdCh3aWxsUmVzdGFydD86IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4gLyogdmV0byAqLz4ge1xuXHRcdHRoaXMudHJhY2UoYExpZmVjeWNsZSNxdWl0KCkgLSBiZWdpbiAod2lsbFJlc3RhcnQ6ICR7d2lsbFJlc3RhcnR9KWApO1xuXG5cdFx0aWYgKHRoaXMucGVuZGluZ1F1aXRQcm9taXNlKSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdMaWZlY3ljbGUjcXVpdCgpIC0gcmV0dXJuaW5nIHBlbmRpbmcgcXVpdCBwcm9taXNlJyk7XG5cblx0XHRcdHJldHVybiB0aGlzLnBlbmRpbmdRdWl0UHJvbWlzZTtcblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBpZiB3ZSBhcmUgYWJvdXQgdG8gcmVzdGFydFxuXHRcdGlmICh3aWxsUmVzdGFydCkge1xuXHRcdFx0dGhpcy5zdGF0ZVNlcnZpY2Uuc2V0SXRlbShMaWZlY3ljbGVNYWluU2VydmljZS5RVUlUX0FORF9SRVNUQVJUX0tFWSwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5wZW5kaW5nUXVpdFByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblxuXHRcdFx0Ly8gU3RvcmUgYXMgZmllbGQgdG8gYWNjZXNzIGl0IGZyb20gYSB3aW5kb3cgY2FuY2VsbGF0aW9uXG5cdFx0XHR0aGlzLnBlbmRpbmdRdWl0UHJvbWlzZVJlc29sdmUgPSByZXNvbHZlO1xuXG5cdFx0XHQvLyBDYWxsaW5nIGFwcC5xdWl0KCkgd2lsbCB0cmlnZ2VyIHRoZSBjbG9zZSBoYW5kbGVycyBvZiBlYWNoIG9wZW5lZCB3aW5kb3dcblx0XHRcdC8vIGFuZCBvbmx5IGlmIG5vIHdpbmRvdyB2ZXRvZWQgdGhlIHNodXRkb3duLCB3ZSB3aWxsIGdldCB0aGUgd2lsbC1xdWl0IGV2ZW50XG5cdFx0XHR0aGlzLnRyYWNlKCdMaWZlY3ljbGUjcXVpdCgpIC0gY2FsbGluZyBhcHAucXVpdCgpJyk7XG5cdFx0XHRlbGVjdHJvbi5hcHAucXVpdCgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRoaXMucGVuZGluZ1F1aXRQcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSB0cmFjZShtc2c6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJnc1snZW5hYmxlLXNtb2tlLXRlc3QtZHJpdmVyJ10pIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKG1zZyk7IC8vIGhlbHBzIGRpYWdub3NlIGlzc3VlcyB3aXRoIGV4aXRpbmcgZnJvbSBzbW9rZSB0ZXN0c1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UobXNnKTtcblx0XHR9XG5cdH1cblxuXHRzZXRSZWxhdW5jaEhhbmRsZXIoaGFuZGxlcjogSVJlbGF1bmNoSGFuZGxlcik6IHZvaWQge1xuXHRcdHRoaXMucmVsYXVuY2hIYW5kbGVyID0gaGFuZGxlcjtcblx0fVxuXG5cdGFzeW5jIHJlbGF1bmNoKG9wdGlvbnM/OiBJUmVsYXVuY2hPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy50cmFjZSgnTGlmZWN5Y2xlI3JlbGF1bmNoKCknKTtcblxuXHRcdGNvbnN0IGFyZ3MgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMSk7XG5cdFx0aWYgKG9wdGlvbnM/LmFkZEFyZ3MpIHtcblx0XHRcdGFyZ3MucHVzaCguLi5vcHRpb25zLmFkZEFyZ3MpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zPy5yZW1vdmVBcmdzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGEgb2Ygb3B0aW9ucy5yZW1vdmVBcmdzKSB7XG5cdFx0XHRcdGNvbnN0IGlkeCA9IGFyZ3MuaW5kZXhPZihhKTtcblx0XHRcdFx0aWYgKGlkeCA+PSAwKSB7XG5cdFx0XHRcdFx0YXJncy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHF1aXRMaXN0ZW5lciA9ICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5yZWxhdW5jaEhhbmRsZXI/LmhhbmRsZVJlbGF1bmNoKG9wdGlvbnMpKSB7XG5cdFx0XHRcdHRoaXMudHJhY2UoJ0xpZmVjeWNsZSNyZWxhdW5jaCgpIC0gY2FsbGluZyBhcHAucmVsYXVuY2goKScpO1xuXHRcdFx0XHRlbGVjdHJvbi5hcHAucmVsYXVuY2goeyBhcmdzIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0ZWxlY3Ryb24uYXBwLm9uY2UoJ3F1aXQnLCBxdWl0TGlzdGVuZXIpO1xuXG5cdFx0Ly8gYGFwcC5yZWxhdW5jaCgpYCBkb2VzIG5vdCBxdWl0IGF1dG9tYXRpY2FsbHksIHNvIHdlIHF1aXQgZmlyc3QsXG5cdFx0Ly8gY2hlY2sgZm9yIHZldG9lcyBhbmQgdGhlbiByZWxhdW5jaCBmcm9tIHRoZSBgYXBwLm9uKCdxdWl0JylgIGV2ZW50XG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IHRoaXMucXVpdCh0cnVlIC8qIHdpbGwgcmVzdGFydCAqLyk7XG5cdFx0aWYgKHZldG8pIHtcblx0XHRcdGVsZWN0cm9uLmFwcC5yZW1vdmVMaXN0ZW5lcigncXVpdCcsIHF1aXRMaXN0ZW5lcik7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMga2lsbChjb2RlPzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy50cmFjZSgnTGlmZWN5Y2xlI2tpbGwoKScpO1xuXG5cdFx0Ly8gR2l2ZSBtYWluIHByb2Nlc3MgcGFydGljaXBhbnRzIGEgY2hhbmNlIHRvIG9yZGVybHkgc2h1dGRvd25cblx0XHRhd2FpdCB0aGlzLmZpcmVPbldpbGxTaHV0ZG93bihTaHV0ZG93blJlYXNvbi5LSUxMKTtcblxuXHRcdC8vIEZyb20gZXh0ZW5zaW9uIHRlc3RzIHdlIGhhdmUgc2VlbiBpc3N1ZXMgd2hlcmUgY2FsbGluZyBhcHAuZXhpdCgpXG5cdFx0Ly8gd2l0aCBhbiBvcGVuZWQgd2luZG93IGNhbiBsZWFkIHRvIG5hdGl2ZSBjcmFzaGVzIChMaW51eCkuIEFzIHN1Y2gsXG5cdFx0Ly8gd2Ugc2hvdWxkIG1ha2Ugc3VyZSB0byBkZXN0cm95IGFueSBvcGVuZWQgd2luZG93IGJlZm9yZSBjYWxsaW5nXG5cdFx0Ly8gYGFwcC5leGl0KClgLlxuXHRcdC8vXG5cdFx0Ly8gTm90ZTogRWxlY3Ryb24gaW1wbGVtZW50cyBhIHNpbWlsYXIgbG9naWMgaGVyZTpcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vYmxvYi9mZTUzMThkNzUzNjM3YzM5MDNlMjNmYzFlZDFiMjYzMDI1ODg3YjZhL3NwZWMtbWFpbi93aW5kb3ctaGVscGVycy50cyNMNVxuXG5cdFx0YXdhaXQgUHJvbWlzZS5yYWNlKFtcblxuXHRcdFx0Ly8gU3RpbGwgZG8gbm90IGJsb2NrIG1vcmUgdGhhbiAxc1xuXHRcdFx0dGltZW91dCgxMDAwKSxcblxuXHRcdFx0Ly8gRGVzdHJveSBhbnkgb3BlbmVkIHdpbmRvdzogd2UgZG8gbm90IHVubG9hZCB3aW5kb3dzIGhlcmUgYmVjYXVzZVxuXHRcdFx0Ly8gdGhlcmUgaXMgYSBjaGFuY2UgdGhhdCB0aGUgdW5sb2FkIGlzIHZldG8nZCBvciBsb25nIHJ1bm5pbmcgZHVlXG5cdFx0XHQvLyB0byBhIHBhcnRpY2lwYW50IHdpdGhpbiB0aGUgd2luZG93LiB0aGlzIGlzIG5vdCB3YW50ZWQgd2hlbiB3ZVxuXHRcdFx0Ly8gYXJlIGFza2VkIHRvIGtpbGwgdGhlIGFwcGxpY2F0aW9uLlxuXHRcdFx0KGFzeW5jICgpID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCB3aW5kb3cgb2YgZ2V0QWxsV2luZG93c0V4Y2x1ZGluZ09mZnNjcmVlbigpKSB7XG5cdFx0XHRcdFx0aWYgKHdpbmRvdyAmJiAhd2luZG93LmlzRGVzdHJveWVkKCkpIHtcblx0XHRcdFx0XHRcdGxldCB3aGVuV2luZG93Q2xvc2VkOiBQcm9taXNlPHZvaWQ+O1xuXHRcdFx0XHRcdFx0aWYgKHdpbmRvdy53ZWJDb250ZW50cyAmJiAhd2luZG93LndlYkNvbnRlbnRzLmlzRGVzdHJveWVkKCkpIHtcblx0XHRcdFx0XHRcdFx0d2hlbldpbmRvd0Nsb3NlZCA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gd2luZG93Lm9uY2UoJ2Nsb3NlZCcsIHJlc29sdmUpKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHdoZW5XaW5kb3dDbG9zZWQgPSBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0d2luZG93LmRlc3Ryb3koKTtcblx0XHRcdFx0XHRcdGF3YWl0IHdoZW5XaW5kb3dDbG9zZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSgpXG5cdFx0XSk7XG5cblx0XHQvLyBOb3cgZXhpdCBlaXRoZXIgYWZ0ZXIgMXMgb3IgYWxsIHdpbmRvd3MgZGVzdHJveWVkXG5cdFx0ZWxlY3Ryb24uYXBwLmV4aXQoY29kZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsU0FBUyxVQUFVLGVBQWU7QUFDM0MsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLGFBQWEsaUJBQWlCO0FBQ3ZDLFNBQVMsV0FBVztBQUNwQixTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHFCQUFxQjtBQUM5QixTQUFrQyxvQkFBb0I7QUFFdEQsU0FBUywrQkFBK0I7QUFFeEMsU0FBUyx1Q0FBdUM7QUFFekMsTUFBTSx3QkFBd0IsZ0JBQXVDLHNCQUFzQjtBQW9CM0YsSUFBVyxpQkFBWCxrQkFBV0Esb0JBQVg7QUFLTixFQUFBQSxnQ0FBQSxVQUFPLEtBQVA7QUFPQSxFQUFBQSxnQ0FBQTtBQVppQixTQUFB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
