import minimist from "minimist";
import * as net from "net";
import { ProcessTimeRunOnceScheduler } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { isCancellationError, isSigPipeError, onUnexpectedError } from "../../../base/common/errors.js";
import * as performance from "../../../base/common/performance.js";
import { realpath } from "../../../base/node/extpath.js";
import { Promises } from "../../../base/node/pfs.js";
import { BufferedEmitter, PersistentProtocol, ProtocolConstants } from "../../../base/parts/ipc/common/ipc.net.js";
import { NodeSocket, WebSocketNodeSocket } from "../../../base/parts/ipc/node/ipc.net.js";
import { boolean } from "../../../editor/common/config/editorOptions.js";
import product from "../../../platform/product/common/product.js";
import { ExtensionHostMain } from "../common/extensionHostMain.js";
import { createURITransformer } from "./uriTransformer.js";
import { ExtHostConnectionType, readExtHostConnection } from "../../services/extensions/common/extensionHostEnv.js";
import { ExtensionHostExitCode, MessageType, createMessageOfType, isMessageOfType } from "../../services/extensions/common/extensionHostProtocol.js";
import "../common/extHost.common.services.js";
import "./extHost.node.services.js";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
(function removeInspectPort() {
  for (let i = 0; i < process.execArgv.length; i++) {
    if (process.execArgv[i] === "--inspect-port=0") {
      process.execArgv.splice(i, 1);
      i--;
    }
  }
})();
const args = minimist(process.argv.slice(2), {
  boolean: [
    "transformURIs",
    "skipWorkspaceStorageLock"
  ],
  string: [
    "useHostProxy"
    // 'true' | 'false' | undefined
  ]
});
(function() {
  const Module = require2("module");
  const originalLoad = Module._load;
  Module._load = function(request) {
    if (request === "natives") {
      throw new Error('Either the extension or an NPM dependency is using the [unsupported "natives" node module](https://go.microsoft.com/fwlink/?linkid=871887).');
    }
    return originalLoad.apply(this, arguments);
  };
})();
const nativeExit = process.exit.bind(process);
const nativeOn = process.on.bind(process);
function patchProcess(allowExit) {
  process.exit = function(code) {
    if (allowExit) {
      nativeExit(code);
    } else {
      const err = new Error("An extension called process.exit() and this was prevented.");
      console.warn(err.stack);
    }
  };
  process.crash = function() {
    const err = new Error("An extension called process.crash() and this was prevented.");
    console.warn(err.stack);
  };
  process.env["ELECTRON_RUN_AS_NODE"] = "1";
  process.on = function(event, listener) {
    if (event === "uncaughtException") {
      const actualListener = listener;
      listener = function(...args2) {
        try {
          return actualListener.apply(void 0, args2);
        } catch {
        }
      };
    }
    nativeOn(event, listener);
  };
}
let onTerminate = function(reason) {
  nativeExit();
};
function _createExtHostProtocol() {
  const extHostConnection = readExtHostConnection(process.env);
  if (extHostConnection.type === ExtHostConnectionType.MessagePort) {
    return new Promise((resolve, reject) => {
      const withPorts = (ports) => {
        const port = ports[0];
        const onMessage = new BufferedEmitter();
        port.on("message", (e) => onMessage.fire(VSBuffer.wrap(e.data)));
        port.on("close", () => {
          onTerminate("renderer closed the MessagePort");
        });
        port.start();
        resolve({
          onMessage: onMessage.event,
          send: (message) => port.postMessage(message.buffer)
        });
      };
      process.parentPort.on("message", (e) => withPorts(e.ports));
    });
  } else if (extHostConnection.type === ExtHostConnectionType.Socket) {
    return new Promise((resolve, reject) => {
      let protocol = null;
      const timer = setTimeout(() => {
        onTerminate("VSCODE_EXTHOST_IPC_SOCKET timeout");
      }, 6e4);
      const reconnectionGraceTime = ProtocolConstants.ReconnectionGraceTime;
      const reconnectionShortGraceTime = ProtocolConstants.ReconnectionShortGraceTime;
      const disconnectRunner1 = new ProcessTimeRunOnceScheduler(() => onTerminate("renderer disconnected for too long (1)"), reconnectionGraceTime);
      const disconnectRunner2 = new ProcessTimeRunOnceScheduler(() => onTerminate("renderer disconnected for too long (2)"), reconnectionShortGraceTime);
      process.on("message", (msg, handle) => {
        if (msg && msg.type === "VSCODE_EXTHOST_IPC_SOCKET") {
          handle.setNoDelay(true);
          const initialDataChunk = VSBuffer.wrap(Buffer.from(msg.initialDataChunk, "base64"));
          let socket;
          if (msg.skipWebSocketFrames) {
            socket = new NodeSocket(handle, "extHost-socket");
          } else {
            const inflateBytes = VSBuffer.wrap(Buffer.from(msg.inflateBytes, "base64"));
            socket = new WebSocketNodeSocket(new NodeSocket(handle, "extHost-socket"), msg.permessageDeflate, inflateBytes, false);
          }
          if (protocol) {
            disconnectRunner1.cancel();
            disconnectRunner2.cancel();
            protocol.beginAcceptReconnection(socket, initialDataChunk);
            protocol.endAcceptReconnection();
            protocol.sendResume();
          } else {
            clearTimeout(timer);
            protocol = new PersistentProtocol({ socket, initialChunk: initialDataChunk });
            protocol.sendResume();
            protocol.onDidDispose(() => onTerminate("renderer disconnected"));
            resolve(protocol);
            protocol.onSocketClose(() => {
              disconnectRunner1.schedule();
            });
          }
        }
        if (msg && msg.type === "VSCODE_EXTHOST_IPC_REDUCE_GRACE_TIME") {
          if (disconnectRunner2.isScheduled()) {
            return;
          }
          if (disconnectRunner1.isScheduled()) {
            disconnectRunner2.schedule();
          }
        }
      });
      const req = { type: "VSCODE_EXTHOST_IPC_READY" };
      process.send?.(req);
    });
  } else {
    const pipeName = extHostConnection.pipeName;
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(pipeName, () => {
        socket.removeListener("error", reject);
        const protocol = new PersistentProtocol({ socket: new NodeSocket(socket, "extHost-renderer") });
        protocol.sendResume();
        resolve(protocol);
      });
      socket.once("error", reject);
      socket.on("close", () => {
        onTerminate("renderer closed the socket");
      });
    });
  }
}
async function createExtHostProtocol() {
  const protocol = await _createExtHostProtocol();
  return new class {
    constructor() {
      this._onMessage = new BufferedEmitter();
      this.onMessage = this._onMessage.event;
      this._terminating = false;
      this._protocolListener = protocol.onMessage((msg) => {
        if (isMessageOfType(msg, MessageType.Terminate)) {
          this._terminating = true;
          this._protocolListener.dispose();
          onTerminate("received terminate message from renderer");
        } else {
          this._onMessage.fire(msg);
        }
      });
    }
    send(msg) {
      if (!this._terminating) {
        protocol.send(msg);
      }
    }
    async drain() {
      if (protocol.drain) {
        return protocol.drain();
      }
    }
  }();
}
function connectToRenderer(protocol) {
  return new Promise((c) => {
    const first = protocol.onMessage((raw) => {
      first.dispose();
      const initData = JSON.parse(raw.toString());
      const rendererCommit = initData.commit;
      const myCommit = product.commit;
      if (rendererCommit && myCommit) {
        if (rendererCommit !== myCommit) {
          nativeExit(ExtensionHostExitCode.VersionMismatch);
        }
      }
      if (initData.parentPid) {
        let epermErrors = 0;
        setInterval(function() {
          try {
            process.kill(initData.parentPid, 0);
            epermErrors = 0;
          } catch (e) {
            if (e && e.code === "EPERM") {
              epermErrors++;
              if (epermErrors >= 3) {
                onTerminate(`parent process ${initData.parentPid} does not exist anymore (3 x EPERM): ${e.message} (code: ${e.code}) (errno: ${e.errno})`);
              }
            } else {
              onTerminate(`parent process ${initData.parentPid} does not exist anymore: ${e.message} (code: ${e.code}) (errno: ${e.errno})`);
            }
          }
        }, 1e3);
        let watchdog;
        try {
          watchdog = require2("native-watchdog");
          watchdog.start(initData.parentPid);
        } catch (err) {
          onUnexpectedError(err);
        }
      }
      protocol.send(createMessageOfType(MessageType.Initialized));
      c({ protocol, initData });
    });
    protocol.send(createMessageOfType(MessageType.Ready));
  });
}
async function startExtensionHostProcess() {
  const unhandledPromises = [];
  process.on("unhandledRejection", (reason, promise) => {
    unhandledPromises.push(promise);
    setTimeout(() => {
      const idx = unhandledPromises.indexOf(promise);
      if (idx >= 0) {
        promise.catch((e) => {
          unhandledPromises.splice(idx, 1);
          if (!isCancellationError(e)) {
            console.warn(`rejected promise not handled within 1 second: ${e}`);
            if (e && e.stack) {
              console.warn(`stack trace: ${e.stack}`);
            }
            if (reason) {
              onUnexpectedError(reason);
            }
          }
        });
      }
    }, 1e3);
  });
  process.on("rejectionHandled", (promise) => {
    const idx = unhandledPromises.indexOf(promise);
    if (idx >= 0) {
      unhandledPromises.splice(idx, 1);
    }
  });
  process.on("uncaughtException", function(err) {
    if (!isSigPipeError(err)) {
      onUnexpectedError(err);
    }
  });
  performance.mark(`code/extHost/willConnectToRenderer`);
  const protocol = await createExtHostProtocol();
  performance.mark(`code/extHost/didConnectToRenderer`);
  const renderer = await connectToRenderer(protocol);
  performance.mark(`code/extHost/didWaitForInitData`);
  const { initData } = renderer;
  patchProcess(!!initData.environment.extensionTestsLocationURI);
  initData.environment.useHostProxy = args.useHostProxy !== void 0 ? args.useHostProxy !== "false" : void 0;
  initData.environment.skipWorkspaceStorageLock = boolean(args.skipWorkspaceStorageLock, false);
  const hostUtils = new class NodeHost {
    constructor() {
      this.pid = process.pid;
    }
    exit(code) {
      nativeExit(code);
    }
    fsExists(path) {
      return Promises.exists(path);
    }
    fsRealpath(path) {
      return realpath(path);
    }
  }();
  let uriTransformer = null;
  if (initData.remote.authority && args.transformURIs) {
    uriTransformer = createURITransformer(initData.remote.authority);
  }
  const extensionHostMain = new ExtensionHostMain(
    renderer.protocol,
    initData,
    hostUtils,
    uriTransformer
  );
  onTerminate = (reason) => extensionHostMain.terminate(reason);
}
startExtensionHostProcess().catch((err) => console.log(err));
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL25vZGUvZXh0ZW5zaW9uSG9zdFByb2Nlc3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgbWluaW1pc3QgZnJvbSAnbWluaW1pc3QnO1xuaW1wb3J0ICogYXMgbmF0aXZlV2F0Y2hkb2cgZnJvbSAnbmF0aXZlLXdhdGNoZG9nJztcbmltcG9ydCAqIGFzIG5ldCBmcm9tICduZXQnO1xuaW1wb3J0IHsgUHJvY2Vzc1RpbWVSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciwgaXNTaWdQaXBlRXJyb3IsIG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0ICogYXMgcGVyZm9ybWFuY2UgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgSVVSSVRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpSXBjLmpzJztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL25vZGUvcGZzLmpzJztcbmltcG9ydCB7IElNZXNzYWdlUGFzc2luZ1Byb3RvY29sIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBCdWZmZXJlZEVtaXR0ZXIsIFBlcnNpc3RlbnRQcm90b2NvbCwgUHJvdG9jb2xDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLm5ldC5qcyc7XG5pbXBvcnQgeyBOb2RlU29ja2V0LCBXZWJTb2NrZXROb2RlU29ja2V0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvbm9kZS9pcGMubmV0LmpzJztcbmltcG9ydCB0eXBlIHsgTWVzc2FnZVBvcnRNYWluIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9zYW5kYm94L25vZGUvZWxlY3Ryb25UeXBlcy5qcyc7XG5pbXBvcnQgeyBib29sZWFuIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3RNYWluLCBJRXhpdEZuIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbkhvc3RNYWluLmpzJztcbmltcG9ydCB7IElIb3N0VXRpbHMgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdEV4dGVuc2lvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlVVJJVHJhbnNmb3JtZXIgfSBmcm9tICcuL3VyaVRyYW5zZm9ybWVyLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb25uZWN0aW9uVHlwZSwgcmVhZEV4dEhvc3RDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uSG9zdEVudi5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25Ib3N0RXhpdENvZGUsIElFeHRIb3N0UmVhZHlNZXNzYWdlLCBJRXh0SG9zdFJlZHVjZUdyYWNlVGltZU1lc3NhZ2UsIElFeHRIb3N0U29ja2V0TWVzc2FnZSwgSUV4dGVuc2lvbkhvc3RJbml0RGF0YSwgTWVzc2FnZVR5cGUsIGNyZWF0ZU1lc3NhZ2VPZlR5cGUsIGlzTWVzc2FnZU9mVHlwZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbkhvc3RQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgJy4uL2NvbW1vbi9leHRIb3N0LmNvbW1vbi5zZXJ2aWNlcy5qcyc7XG5pbXBvcnQgJy4vZXh0SG9zdC5ub2RlLnNlcnZpY2VzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5jb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1xuXG5pbnRlcmZhY2UgUGFyc2VkRXh0SG9zdEFyZ3Mge1xuXHR0cmFuc2Zvcm1VUklzPzogYm9vbGVhbjtcblx0c2tpcFdvcmtzcGFjZVN0b3JhZ2VMb2NrPzogYm9vbGVhbjtcblx0dXNlSG9zdFByb3h5PzogJ3RydWUnIHwgJ2ZhbHNlJzsgLy8gdXNlIGEgc3RyaW5nLCBhcyB1bmRlZmluZWQgaXMgYWxzbyBhIHZhbGlkIHZhbHVlXG59XG5cbi8vIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy84NTQ5MFxuLy8gcmVtb3ZlIC0taW5zcGVjdC1wb3J0PTAgYWZ0ZXIgc3RhcnQgc28gdGhhdCBpdCBkb2Vzbid0IHRyaWdnZXIgTFNQIGRlYnVnZ2luZ1xuKGZ1bmN0aW9uIHJlbW92ZUluc3BlY3RQb3J0KCkge1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IHByb2Nlc3MuZXhlY0FyZ3YubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAocHJvY2Vzcy5leGVjQXJndltpXSA9PT0gJy0taW5zcGVjdC1wb3J0PTAnKSB7XG5cdFx0XHRwcm9jZXNzLmV4ZWNBcmd2LnNwbGljZShpLCAxKTtcblx0XHRcdGktLTtcblx0XHR9XG5cdH1cbn0pKCk7XG5cbmNvbnN0IGFyZ3MgPSBtaW5pbWlzdChwcm9jZXNzLmFyZ3Yuc2xpY2UoMiksIHtcblx0Ym9vbGVhbjogW1xuXHRcdCd0cmFuc2Zvcm1VUklzJyxcblx0XHQnc2tpcFdvcmtzcGFjZVN0b3JhZ2VMb2NrJ1xuXHRdLFxuXHRzdHJpbmc6IFtcblx0XHQndXNlSG9zdFByb3h5JyAvLyAndHJ1ZScgfCAnZmFsc2UnIHwgdW5kZWZpbmVkXG5cdF1cbn0pIGFzIFBhcnNlZEV4dEhvc3RBcmdzO1xuXG4vLyBXaXRoIEVsZWN0cm9uIDIueCBhbmQgbm9kZS5qcyA4LnggdGhlIFwibmF0aXZlc1wiIG1vZHVsZVxuLy8gY2FuIGNhdXNlIGEgbmF0aXZlIGNyYXNoIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2lzc3Vlcy8xOTg5MSBhbmRcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMTA5MDUpLiBUbyBwcmV2ZW50IHRoaXMgZnJvbVxuLy8gaGFwcGVuaW5nIHdlIGVzc2VudGlhbGx5IGJsb2NrbGlzdCB0aGlzIG1vZHVsZSBmcm9tIGdldHRpbmcgbG9hZGVkIGluIGFueVxuLy8gZXh0ZW5zaW9uIGJ5IHBhdGNoaW5nIHRoZSBub2RlIHJlcXVpcmUoKSBmdW5jdGlvbi5cbihmdW5jdGlvbiAoKSB7XG5cdGNvbnN0IE1vZHVsZSA9IHJlcXVpcmUoJ21vZHVsZScpO1xuXHRjb25zdCBvcmlnaW5hbExvYWQgPSBNb2R1bGUuX2xvYWQ7XG5cblx0TW9kdWxlLl9sb2FkID0gZnVuY3Rpb24gKHJlcXVlc3Q6IHN0cmluZykge1xuXHRcdGlmIChyZXF1ZXN0ID09PSAnbmF0aXZlcycpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRWl0aGVyIHRoZSBleHRlbnNpb24gb3IgYW4gTlBNIGRlcGVuZGVuY3kgaXMgdXNpbmcgdGhlIFt1bnN1cHBvcnRlZCBcIm5hdGl2ZXNcIiBub2RlIG1vZHVsZV0oaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/bGlua2lkPTg3MTg4NykuJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9yaWdpbmFsTG9hZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHR9O1xufSkoKTtcblxuLy8gY3VzdG9tIHByb2Nlc3MuZXhpdCBsb2dpYy4uLlxuY29uc3QgbmF0aXZlRXhpdDogSUV4aXRGbiA9IHByb2Nlc3MuZXhpdC5iaW5kKHByb2Nlc3MpO1xuY29uc3QgbmF0aXZlT24gPSBwcm9jZXNzLm9uLmJpbmQocHJvY2Vzcyk7XG5mdW5jdGlvbiBwYXRjaFByb2Nlc3MoYWxsb3dFeGl0OiBib29sZWFuKSB7XG5cdHByb2Nlc3MuZXhpdCA9IGZ1bmN0aW9uIChjb2RlPzogbnVtYmVyKSB7XG5cdFx0aWYgKGFsbG93RXhpdCkge1xuXHRcdFx0bmF0aXZlRXhpdChjb2RlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZXJyID0gbmV3IEVycm9yKCdBbiBleHRlbnNpb24gY2FsbGVkIHByb2Nlc3MuZXhpdCgpIGFuZCB0aGlzIHdhcyBwcmV2ZW50ZWQuJyk7XG5cdFx0XHRjb25zb2xlLndhcm4oZXJyLnN0YWNrKTtcblx0XHR9XG5cdH0gYXMgKGNvZGU/OiBudW1iZXIpID0+IG5ldmVyO1xuXG5cdC8vIG92ZXJyaWRlIEVsZWN0cm9uJ3MgcHJvY2Vzcy5jcmFzaCgpIG1ldGhvZFxuXHRwcm9jZXNzLmNyYXNoID0gZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGVyciA9IG5ldyBFcnJvcignQW4gZXh0ZW5zaW9uIGNhbGxlZCBwcm9jZXNzLmNyYXNoKCkgYW5kIHRoaXMgd2FzIHByZXZlbnRlZC4nKTtcblx0XHRjb25zb2xlLndhcm4oZXJyLnN0YWNrKTtcblx0fTtcblxuXHQvLyBTZXQgRUxFQ1RST05fUlVOX0FTX05PREUgZW52aXJvbm1lbnQgdmFyaWFibGUgZm9yIGV4dGVuc2lvbnMgdGhhdCB1c2Vcblx0Ly8gY2hpbGRfcHJvY2Vzcy5zcGF3biB3aXRoIHByb2Nlc3MuZXhlY1BhdGggYW5kIGV4cGVjdCB0byBydW4gYXMgbm9kZSBwcm9jZXNzXG5cdC8vIG9uIHRoZSBkZXNrdG9wLlxuXHQvLyBSZWZzIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNTEwMTIjaXNzdWVjb21tZW50LTExNTY1OTMyMjhcblx0cHJvY2Vzcy5lbnZbJ0VMRUNUUk9OX1JVTl9BU19OT0RFJ10gPSAnMSc7XG5cblx0cHJvY2Vzcy5vbiA9IDxhbnk+ZnVuY3Rpb24gKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpIHtcblx0XHRpZiAoZXZlbnQgPT09ICd1bmNhdWdodEV4Y2VwdGlvbicpIHtcblx0XHRcdGNvbnN0IGFjdHVhbExpc3RlbmVyID0gbGlzdGVuZXI7XG5cdFx0XHRsaXN0ZW5lciA9IGZ1bmN0aW9uICguLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJldHVybiBhY3R1YWxMaXN0ZW5lci5hcHBseSh1bmRlZmluZWQsIGFyZ3MpO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHQvLyBETyBOT1QgSEFORExFIE5PUiBQUklOVCB0aGUgZXJyb3IgaGVyZSBiZWNhdXNlIHRoaXMgY2FuIGFuZCB3aWxsIGxlYWQgdG9cblx0XHRcdFx0XHQvLyBtb3JlIGVycm9ycyB3aGljaCB3aWxsIGNhdXNlIGVycm9yIGhhbmRsaW5nIHRvIGJlIHJlZW50cmFudCBhbmQgZXZlbnR1YWxseVxuXHRcdFx0XHRcdC8vIG92ZXJmbG93aW5nIHRoZSBzdGFjay4gRG8gbm90IGJlIHNhZCwgd2UgZG8gaGFuZGxlIGFuZCBhbm5vdGF0ZSB1bmNhdWdodFxuXHRcdFx0XHRcdC8vIGVycm9ycyBwcm9wZXJseSBpbiAnZXh0ZW5zaW9uSG9zdE1haW4nXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdG5hdGl2ZU9uKGV2ZW50LCBsaXN0ZW5lcik7XG5cdH07XG5cbn1cblxuaW50ZXJmYWNlIElSZW5kZXJlckNvbm5lY3Rpb24ge1xuXHRwcm90b2NvbDogSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w7XG5cdGluaXREYXRhOiBJRXh0ZW5zaW9uSG9zdEluaXREYXRhO1xufVxuXG4vLyBUaGlzIGNhbGxzIGV4aXQgZGlyZWN0bHkgaW4gY2FzZSB0aGUgaW5pdGlhbGl6YXRpb24gaXMgbm90IGZpbmlzaGVkIGFuZCB3ZSBuZWVkIHRvIGV4aXRcbi8vIE90aGVyd2lzZSwgaWYgaW5pdGlhbGl6YXRpb24gY29tcGxldGVkIHdlIGdvIHRvIGV4dGVuc2lvbkhvc3RNYWluLnRlcm1pbmF0ZSgpXG5sZXQgb25UZXJtaW5hdGUgPSBmdW5jdGlvbiAocmVhc29uOiBzdHJpbmcpIHtcblx0bmF0aXZlRXhpdCgpO1xufTtcblxuZnVuY3Rpb24gX2NyZWF0ZUV4dEhvc3RQcm90b2NvbCgpOiBQcm9taXNlPElNZXNzYWdlUGFzc2luZ1Byb3RvY29sPiB7XG5cdGNvbnN0IGV4dEhvc3RDb25uZWN0aW9uID0gcmVhZEV4dEhvc3RDb25uZWN0aW9uKHByb2Nlc3MuZW52KTtcblxuXHRpZiAoZXh0SG9zdENvbm5lY3Rpb24udHlwZSA9PT0gRXh0SG9zdENvbm5lY3Rpb25UeXBlLk1lc3NhZ2VQb3J0KSB7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8SU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuXHRcdFx0Y29uc3Qgd2l0aFBvcnRzID0gKHBvcnRzOiBNZXNzYWdlUG9ydE1haW5bXSkgPT4ge1xuXHRcdFx0XHRjb25zdCBwb3J0ID0gcG9ydHNbMF07XG5cdFx0XHRcdGNvbnN0IG9uTWVzc2FnZSA9IG5ldyBCdWZmZXJlZEVtaXR0ZXI8VlNCdWZmZXI+KCk7XG5cdFx0XHRcdHBvcnQub24oJ21lc3NhZ2UnLCAoZSkgPT4gb25NZXNzYWdlLmZpcmUoVlNCdWZmZXIud3JhcChlLmRhdGEpKSk7XG5cdFx0XHRcdHBvcnQub24oJ2Nsb3NlJywgKCkgPT4ge1xuXHRcdFx0XHRcdG9uVGVybWluYXRlKCdyZW5kZXJlciBjbG9zZWQgdGhlIE1lc3NhZ2VQb3J0Jyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRwb3J0LnN0YXJ0KCk7XG5cblx0XHRcdFx0cmVzb2x2ZSh7XG5cdFx0XHRcdFx0b25NZXNzYWdlOiBvbk1lc3NhZ2UuZXZlbnQsXG5cdFx0XHRcdFx0c2VuZDogbWVzc2FnZSA9PiBwb3J0LnBvc3RNZXNzYWdlKG1lc3NhZ2UuYnVmZmVyKVxuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cblx0XHRcdHByb2Nlc3MucGFyZW50UG9ydC5vbignbWVzc2FnZScsIChlOiBFbGVjdHJvbi5NZXNzYWdlRXZlbnQpID0+IHdpdGhQb3J0cyhlLnBvcnRzKSk7XG5cdFx0fSk7XG5cblx0fSBlbHNlIGlmIChleHRIb3N0Q29ubmVjdGlvbi50eXBlID09PSBFeHRIb3N0Q29ubmVjdGlvblR5cGUuU29ja2V0KSB7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8UGVyc2lzdGVudFByb3RvY29sPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblx0XHRcdGxldCBwcm90b2NvbDogUGVyc2lzdGVudFByb3RvY29sIHwgbnVsbCA9IG51bGw7XG5cblx0XHRcdGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdG9uVGVybWluYXRlKCdWU0NPREVfRVhUSE9TVF9JUENfU09DS0VUIHRpbWVvdXQnKTtcblx0XHRcdH0sIDYwMDAwKTtcblxuXHRcdFx0Y29uc3QgcmVjb25uZWN0aW9uR3JhY2VUaW1lID0gUHJvdG9jb2xDb25zdGFudHMuUmVjb25uZWN0aW9uR3JhY2VUaW1lO1xuXHRcdFx0Y29uc3QgcmVjb25uZWN0aW9uU2hvcnRHcmFjZVRpbWUgPSBQcm90b2NvbENvbnN0YW50cy5SZWNvbm5lY3Rpb25TaG9ydEdyYWNlVGltZTtcblx0XHRcdGNvbnN0IGRpc2Nvbm5lY3RSdW5uZXIxID0gbmV3IFByb2Nlc3NUaW1lUnVuT25jZVNjaGVkdWxlcigoKSA9PiBvblRlcm1pbmF0ZSgncmVuZGVyZXIgZGlzY29ubmVjdGVkIGZvciB0b28gbG9uZyAoMSknKSwgcmVjb25uZWN0aW9uR3JhY2VUaW1lKTtcblx0XHRcdGNvbnN0IGRpc2Nvbm5lY3RSdW5uZXIyID0gbmV3IFByb2Nlc3NUaW1lUnVuT25jZVNjaGVkdWxlcigoKSA9PiBvblRlcm1pbmF0ZSgncmVuZGVyZXIgZGlzY29ubmVjdGVkIGZvciB0b28gbG9uZyAoMiknKSwgcmVjb25uZWN0aW9uU2hvcnRHcmFjZVRpbWUpO1xuXG5cdFx0XHRwcm9jZXNzLm9uKCdtZXNzYWdlJywgKG1zZzogSUV4dEhvc3RTb2NrZXRNZXNzYWdlIHwgSUV4dEhvc3RSZWR1Y2VHcmFjZVRpbWVNZXNzYWdlLCBoYW5kbGU6IG5ldC5Tb2NrZXQpID0+IHtcblx0XHRcdFx0aWYgKG1zZyAmJiBtc2cudHlwZSA9PT0gJ1ZTQ09ERV9FWFRIT1NUX0lQQ19TT0NLRVQnKSB7XG5cdFx0XHRcdFx0Ly8gRGlzYWJsZSBOYWdsZSdzIGFsZ29yaXRobS4gV2UgYWxzbyBkbyB0aGlzIG9uIHRoZSBzZXJ2ZXIgcHJvY2Vzcyxcblx0XHRcdFx0XHQvLyBidXQgbm9kZWpzIGRvZXNuJ3QgZG9jdW1lbnQgaWYgdGhpcyBvcHRpb24gaXMgdHJhbnNmZXJyZWQgd2l0aCB0aGUgc29ja2V0XG5cdFx0XHRcdFx0aGFuZGxlLnNldE5vRGVsYXkodHJ1ZSk7XG5cblx0XHRcdFx0XHRjb25zdCBpbml0aWFsRGF0YUNodW5rID0gVlNCdWZmZXIud3JhcChCdWZmZXIuZnJvbShtc2cuaW5pdGlhbERhdGFDaHVuaywgJ2Jhc2U2NCcpKTtcblx0XHRcdFx0XHRsZXQgc29ja2V0OiBOb2RlU29ja2V0IHwgV2ViU29ja2V0Tm9kZVNvY2tldDtcblx0XHRcdFx0XHRpZiAobXNnLnNraXBXZWJTb2NrZXRGcmFtZXMpIHtcblx0XHRcdFx0XHRcdHNvY2tldCA9IG5ldyBOb2RlU29ja2V0KGhhbmRsZSwgJ2V4dEhvc3Qtc29ja2V0Jyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IGluZmxhdGVCeXRlcyA9IFZTQnVmZmVyLndyYXAoQnVmZmVyLmZyb20obXNnLmluZmxhdGVCeXRlcywgJ2Jhc2U2NCcpKTtcblx0XHRcdFx0XHRcdHNvY2tldCA9IG5ldyBXZWJTb2NrZXROb2RlU29ja2V0KG5ldyBOb2RlU29ja2V0KGhhbmRsZSwgJ2V4dEhvc3Qtc29ja2V0JyksIG1zZy5wZXJtZXNzYWdlRGVmbGF0ZSwgaW5mbGF0ZUJ5dGVzLCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChwcm90b2NvbCkge1xuXHRcdFx0XHRcdFx0Ly8gcmVjb25uZWN0aW9uIGNhc2Vcblx0XHRcdFx0XHRcdGRpc2Nvbm5lY3RSdW5uZXIxLmNhbmNlbCgpO1xuXHRcdFx0XHRcdFx0ZGlzY29ubmVjdFJ1bm5lcjIuY2FuY2VsKCk7XG5cdFx0XHRcdFx0XHRwcm90b2NvbC5iZWdpbkFjY2VwdFJlY29ubmVjdGlvbihzb2NrZXQsIGluaXRpYWxEYXRhQ2h1bmspO1xuXHRcdFx0XHRcdFx0cHJvdG9jb2wuZW5kQWNjZXB0UmVjb25uZWN0aW9uKCk7XG5cdFx0XHRcdFx0XHRwcm90b2NvbC5zZW5kUmVzdW1lKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNsZWFyVGltZW91dCh0aW1lcik7XG5cdFx0XHRcdFx0XHRwcm90b2NvbCA9IG5ldyBQZXJzaXN0ZW50UHJvdG9jb2woeyBzb2NrZXQsIGluaXRpYWxDaHVuazogaW5pdGlhbERhdGFDaHVuayB9KTtcblx0XHRcdFx0XHRcdHByb3RvY29sLnNlbmRSZXN1bWUoKTtcblx0XHRcdFx0XHRcdHByb3RvY29sLm9uRGlkRGlzcG9zZSgoKSA9PiBvblRlcm1pbmF0ZSgncmVuZGVyZXIgZGlzY29ubmVjdGVkJykpO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZShwcm90b2NvbCk7XG5cblx0XHRcdFx0XHRcdC8vIFdhaXQgZm9yIHJpY2ggY2xpZW50IHRvIHJlY29ubmVjdFxuXHRcdFx0XHRcdFx0cHJvdG9jb2wub25Tb2NrZXRDbG9zZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdC8vIFRoZSBzb2NrZXQgaGFzIGNsb3NlZCwgbGV0J3MgZ2l2ZSB0aGUgcmVuZGVyZXIgYSBjZXJ0YWluIGFtb3VudCBvZiB0aW1lIHRvIHJlY29ubmVjdFxuXHRcdFx0XHRcdFx0XHRkaXNjb25uZWN0UnVubmVyMS5zY2hlZHVsZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtc2cgJiYgbXNnLnR5cGUgPT09ICdWU0NPREVfRVhUSE9TVF9JUENfUkVEVUNFX0dSQUNFX1RJTUUnKSB7XG5cdFx0XHRcdFx0aWYgKGRpc2Nvbm5lY3RSdW5uZXIyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0XHRcdC8vIHdlIGFyZSBkaXNjb25uZWN0ZWQgYW5kIGFscmVhZHkgcnVubmluZyB0aGUgc2hvcnQgcmVjb25uZWN0aW9uIHRpbWVyXG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChkaXNjb25uZWN0UnVubmVyMS5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdFx0XHQvLyB3ZSBhcmUgZGlzY29ubmVjdGVkIGFuZCBydW5uaW5nIHRoZSBsb25nIHJlY29ubmVjdGlvbiB0aW1lclxuXHRcdFx0XHRcdFx0ZGlzY29ubmVjdFJ1bm5lcjIuc2NoZWR1bGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBOb3cgdGhhdCB3ZSBoYXZlIG1hbmFnZWQgdG8gaW5zdGFsbCBhIG1lc3NhZ2UgbGlzdGVuZXIsIGFzayB0aGUgb3RoZXIgc2lkZSB0byBzZW5kIHVzIHRoZSBzb2NrZXRcblx0XHRcdGNvbnN0IHJlcTogSUV4dEhvc3RSZWFkeU1lc3NhZ2UgPSB7IHR5cGU6ICdWU0NPREVfRVhUSE9TVF9JUENfUkVBRFknIH07XG5cdFx0XHRwcm9jZXNzLnNlbmQ/LihyZXEpO1xuXHRcdH0pO1xuXG5cdH0gZWxzZSB7XG5cblx0XHRjb25zdCBwaXBlTmFtZSA9IGV4dEhvc3RDb25uZWN0aW9uLnBpcGVOYW1lO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPFBlcnNpc3RlbnRQcm90b2NvbD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cdFx0XHRjb25zdCBzb2NrZXQgPSBuZXQuY3JlYXRlQ29ubmVjdGlvbihwaXBlTmFtZSwgKCkgPT4ge1xuXHRcdFx0XHRzb2NrZXQucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgcmVqZWN0KTtcblx0XHRcdFx0Y29uc3QgcHJvdG9jb2wgPSBuZXcgUGVyc2lzdGVudFByb3RvY29sKHsgc29ja2V0OiBuZXcgTm9kZVNvY2tldChzb2NrZXQsICdleHRIb3N0LXJlbmRlcmVyJykgfSk7XG5cdFx0XHRcdHByb3RvY29sLnNlbmRSZXN1bWUoKTtcblx0XHRcdFx0cmVzb2x2ZShwcm90b2NvbCk7XG5cdFx0XHR9KTtcblx0XHRcdHNvY2tldC5vbmNlKCdlcnJvcicsIHJlamVjdCk7XG5cblx0XHRcdHNvY2tldC5vbignY2xvc2UnLCAoKSA9PiB7XG5cdFx0XHRcdG9uVGVybWluYXRlKCdyZW5kZXJlciBjbG9zZWQgdGhlIHNvY2tldCcpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlRXh0SG9zdFByb3RvY29sKCk6IFByb21pc2U8SU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w+IHtcblxuXHRjb25zdCBwcm90b2NvbCA9IGF3YWl0IF9jcmVhdGVFeHRIb3N0UHJvdG9jb2woKTtcblxuXHRyZXR1cm4gbmV3IGNsYXNzIGltcGxlbWVudHMgSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wge1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb25NZXNzYWdlID0gbmV3IEJ1ZmZlcmVkRW1pdHRlcjxWU0J1ZmZlcj4oKTtcblx0XHRyZWFkb25seSBvbk1lc3NhZ2U6IEV2ZW50PFZTQnVmZmVyPiA9IHRoaXMuX29uTWVzc2FnZS5ldmVudDtcblxuXHRcdHByaXZhdGUgX3Rlcm1pbmF0aW5nOiBib29sZWFuO1xuXHRcdHByaXZhdGUgX3Byb3RvY29sTGlzdGVuZXI6IElEaXNwb3NhYmxlO1xuXG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hdGluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5fcHJvdG9jb2xMaXN0ZW5lciA9IHByb3RvY29sLm9uTWVzc2FnZSgobXNnKSA9PiB7XG5cdFx0XHRcdGlmIChpc01lc3NhZ2VPZlR5cGUobXNnLCBNZXNzYWdlVHlwZS5UZXJtaW5hdGUpKSB7XG5cdFx0XHRcdFx0dGhpcy5fdGVybWluYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHRcdHRoaXMuX3Byb3RvY29sTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdG9uVGVybWluYXRlKCdyZWNlaXZlZCB0ZXJtaW5hdGUgbWVzc2FnZSBmcm9tIHJlbmRlcmVyJyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fb25NZXNzYWdlLmZpcmUobXNnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0c2VuZChtc2c6IGFueSk6IHZvaWQge1xuXHRcdFx0aWYgKCF0aGlzLl90ZXJtaW5hdGluZykge1xuXHRcdFx0XHRwcm90b2NvbC5zZW5kKG1zZyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXN5bmMgZHJhaW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRpZiAocHJvdG9jb2wuZHJhaW4pIHtcblx0XHRcdFx0cmV0dXJuIHByb3RvY29sLmRyYWluKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufVxuXG5mdW5jdGlvbiBjb25uZWN0VG9SZW5kZXJlcihwcm90b2NvbDogSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wpOiBQcm9taXNlPElSZW5kZXJlckNvbm5lY3Rpb24+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPElSZW5kZXJlckNvbm5lY3Rpb24+KChjKSA9PiB7XG5cblx0XHQvLyBMaXN0ZW4gaW5pdCBkYXRhIG1lc3NhZ2Vcblx0XHRjb25zdCBmaXJzdCA9IHByb3RvY29sLm9uTWVzc2FnZShyYXcgPT4ge1xuXHRcdFx0Zmlyc3QuZGlzcG9zZSgpO1xuXG5cdFx0XHRjb25zdCBpbml0RGF0YSA9IDxJRXh0ZW5zaW9uSG9zdEluaXREYXRhPkpTT04ucGFyc2UocmF3LnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRjb25zdCByZW5kZXJlckNvbW1pdCA9IGluaXREYXRhLmNvbW1pdDtcblx0XHRcdGNvbnN0IG15Q29tbWl0ID0gcHJvZHVjdC5jb21taXQ7XG5cblx0XHRcdGlmIChyZW5kZXJlckNvbW1pdCAmJiBteUNvbW1pdCkge1xuXHRcdFx0XHQvLyBSdW5uaW5nIGluIHRoZSBidWlsdCB2ZXJzaW9uIHdoZXJlIGNvbW1pdHMgYXJlIGRlZmluZWRcblx0XHRcdFx0aWYgKHJlbmRlcmVyQ29tbWl0ICE9PSBteUNvbW1pdCkge1xuXHRcdFx0XHRcdG5hdGl2ZUV4aXQoRXh0ZW5zaW9uSG9zdEV4aXRDb2RlLlZlcnNpb25NaXNtYXRjaCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGluaXREYXRhLnBhcmVudFBpZCkge1xuXHRcdFx0XHQvLyBLaWxsIG9uZXNlbGYgaWYgb25lJ3MgcGFyZW50IGRpZXMuIE11Y2ggZHJhbWEuXG5cdFx0XHRcdGxldCBlcGVybUVycm9ycyA9IDA7XG5cdFx0XHRcdHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0cHJvY2Vzcy5raWxsKGluaXREYXRhLnBhcmVudFBpZCwgMCk7IC8vIHRocm93cyBhbiBleGNlcHRpb24gaWYgdGhlIG1haW4gcHJvY2VzcyBkb2Vzbid0IGV4aXN0IGFueW1vcmUuXG5cdFx0XHRcdFx0XHRlcGVybUVycm9ycyA9IDA7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0aWYgKGUgJiYgZS5jb2RlID09PSAnRVBFUk0nKSB7XG5cdFx0XHRcdFx0XHRcdC8vIEV2ZW4gaWYgdGhlIHBhcmVudCBwcm9jZXNzIGlzIHN0aWxsIGFsaXZlLFxuXHRcdFx0XHRcdFx0XHQvLyBzb21lIGFudGl2aXJ1cyBzb2Z0d2FyZSBjYW4gbGVhZCB0byBhbiBFUEVSTSBlcnJvciB0byBiZSB0aHJvd24gaGVyZS5cblx0XHRcdFx0XHRcdFx0Ly8gTGV0J3MgdGVybWluYXRlIG9ubHkgaWYgd2UgZ2V0IDMgY29uc2VjdXRpdmUgRVBFUk0gZXJyb3JzLlxuXHRcdFx0XHRcdFx0XHRlcGVybUVycm9ycysrO1xuXHRcdFx0XHRcdFx0XHRpZiAoZXBlcm1FcnJvcnMgPj0gMykge1xuXHRcdFx0XHRcdFx0XHRcdG9uVGVybWluYXRlKGBwYXJlbnQgcHJvY2VzcyAke2luaXREYXRhLnBhcmVudFBpZH0gZG9lcyBub3QgZXhpc3QgYW55bW9yZSAoMyB4IEVQRVJNKTogJHtlLm1lc3NhZ2V9IChjb2RlOiAke2UuY29kZX0pIChlcnJubzogJHtlLmVycm5vfSlgKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0b25UZXJtaW5hdGUoYHBhcmVudCBwcm9jZXNzICR7aW5pdERhdGEucGFyZW50UGlkfSBkb2VzIG5vdCBleGlzdCBhbnltb3JlOiAke2UubWVzc2FnZX0gKGNvZGU6ICR7ZS5jb2RlfSkgKGVycm5vOiAke2UuZXJybm99KWApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgMTAwMCk7XG5cblx0XHRcdFx0Ly8gSW4gY2VydGFpbiBjYXNlcywgdGhlIGV2ZW50IGxvb3AgY2FuIGJlY29tZSBidXN5IGFuZCBuZXZlciB5aWVsZFxuXHRcdFx0XHQvLyBlLmcuIHdoaWxlLXRydWUgb3IgcHJvY2Vzcy5uZXh0VGljayBlbmRsZXNzIGxvb3BzXG5cdFx0XHRcdC8vIFNvIGFsc28gdXNlIHRoZSBuYXRpdmUgbm9kZSBtb2R1bGUgdG8gZG8gaXQgZnJvbSBhIHNlcGFyYXRlIHRocmVhZFxuXHRcdFx0XHRsZXQgd2F0Y2hkb2c6IHR5cGVvZiBuYXRpdmVXYXRjaGRvZztcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR3YXRjaGRvZyA9IHJlcXVpcmUoJ25hdGl2ZS13YXRjaGRvZycpO1xuXHRcdFx0XHRcdHdhdGNoZG9nLnN0YXJ0KGluaXREYXRhLnBhcmVudFBpZCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdC8vIG5vIHByb2JsZW0uLi5cblx0XHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRlbGwgdGhlIG91dHNpZGUgdGhhdCB3ZSBhcmUgaW5pdGlhbGl6ZWRcblx0XHRcdHByb3RvY29sLnNlbmQoY3JlYXRlTWVzc2FnZU9mVHlwZShNZXNzYWdlVHlwZS5Jbml0aWFsaXplZCkpO1xuXG5cdFx0XHRjKHsgcHJvdG9jb2wsIGluaXREYXRhIH0pO1xuXHRcdH0pO1xuXG5cdFx0Ly8gVGVsbCB0aGUgb3V0c2lkZSB0aGF0IHdlIGFyZSByZWFkeSB0byByZWNlaXZlIG1lc3NhZ2VzXG5cdFx0cHJvdG9jb2wuc2VuZChjcmVhdGVNZXNzYWdlT2ZUeXBlKE1lc3NhZ2VUeXBlLlJlYWR5KSk7XG5cdH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzdGFydEV4dGVuc2lvbkhvc3RQcm9jZXNzKCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdC8vIFByaW50IGEgY29uc29sZSBtZXNzYWdlIHdoZW4gcmVqZWN0aW9uIGlzbid0IGhhbmRsZWQgd2l0aGluIE4gc2Vjb25kcy4gRm9yIGRldGFpbHM6XG5cdC8vIHNlZSBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX2V2ZW50X3VuaGFuZGxlZHJlamVjdGlvblxuXHQvLyBhbmQgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19ldmVudF9yZWplY3Rpb25oYW5kbGVkXG5cdGNvbnN0IHVuaGFuZGxlZFByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXHRwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCAocmVhc29uOiBhbnksIHByb21pc2U6IFByb21pc2U8YW55PikgPT4ge1xuXHRcdHVuaGFuZGxlZFByb21pc2VzLnB1c2gocHJvbWlzZSk7XG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRjb25zdCBpZHggPSB1bmhhbmRsZWRQcm9taXNlcy5pbmRleE9mKHByb21pc2UpO1xuXHRcdFx0aWYgKGlkeCA+PSAwKSB7XG5cdFx0XHRcdHByb21pc2UuY2F0Y2goZSA9PiB7XG5cdFx0XHRcdFx0dW5oYW5kbGVkUHJvbWlzZXMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRcdFx0aWYgKCFpc0NhbmNlbGxhdGlvbkVycm9yKGUpKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oYHJlamVjdGVkIHByb21pc2Ugbm90IGhhbmRsZWQgd2l0aGluIDEgc2Vjb25kOiAke2V9YCk7XG5cdFx0XHRcdFx0XHRpZiAoZSAmJiBlLnN0YWNrKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUud2Fybihgc3RhY2sgdHJhY2U6ICR7ZS5zdGFja31gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChyZWFzb24pIHtcblx0XHRcdFx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IocmVhc29uKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0sIDEwMDApO1xuXHR9KTtcblxuXHRwcm9jZXNzLm9uKCdyZWplY3Rpb25IYW5kbGVkJywgKHByb21pc2U6IFByb21pc2U8YW55PikgPT4ge1xuXHRcdGNvbnN0IGlkeCA9IHVuaGFuZGxlZFByb21pc2VzLmluZGV4T2YocHJvbWlzZSk7XG5cdFx0aWYgKGlkeCA+PSAwKSB7XG5cdFx0XHR1bmhhbmRsZWRQcm9taXNlcy5zcGxpY2UoaWR4LCAxKTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFByaW50IGEgY29uc29sZSBtZXNzYWdlIHdoZW4gYW4gZXhjZXB0aW9uIGlzbid0IGhhbmRsZWQuXG5cdHByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgZnVuY3Rpb24gKGVycjogRXJyb3IpIHtcblx0XHRpZiAoIWlzU2lnUGlwZUVycm9yKGVycikpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0fVxuXHR9KTtcblxuXHRwZXJmb3JtYW5jZS5tYXJrKGBjb2RlL2V4dEhvc3Qvd2lsbENvbm5lY3RUb1JlbmRlcmVyYCk7XG5cdGNvbnN0IHByb3RvY29sID0gYXdhaXQgY3JlYXRlRXh0SG9zdFByb3RvY29sKCk7XG5cdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvZXh0SG9zdC9kaWRDb25uZWN0VG9SZW5kZXJlcmApO1xuXHRjb25zdCByZW5kZXJlciA9IGF3YWl0IGNvbm5lY3RUb1JlbmRlcmVyKHByb3RvY29sKTtcblx0cGVyZm9ybWFuY2UubWFyayhgY29kZS9leHRIb3N0L2RpZFdhaXRGb3JJbml0RGF0YWApO1xuXHRjb25zdCB7IGluaXREYXRhIH0gPSByZW5kZXJlcjtcblx0Ly8gc2V0dXAgdGhpbmdzXG5cdHBhdGNoUHJvY2VzcyghIWluaXREYXRhLmVudmlyb25tZW50LmV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkpOyAvLyB0byBzdXBwb3J0IG90aGVyIHRlc3QgZnJhbWV3b3JrcyBsaWtlIEphc21pbiB0aGF0IHVzZSBwcm9jZXNzLmV4aXQgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8zNzcwOClcblx0aW5pdERhdGEuZW52aXJvbm1lbnQudXNlSG9zdFByb3h5ID0gYXJncy51c2VIb3N0UHJveHkgIT09IHVuZGVmaW5lZCA/IGFyZ3MudXNlSG9zdFByb3h5ICE9PSAnZmFsc2UnIDogdW5kZWZpbmVkO1xuXHRpbml0RGF0YS5lbnZpcm9ubWVudC5za2lwV29ya3NwYWNlU3RvcmFnZUxvY2sgPSBib29sZWFuKGFyZ3Muc2tpcFdvcmtzcGFjZVN0b3JhZ2VMb2NrLCBmYWxzZSk7XG5cblx0Ly8gaG9zdCBhYnN0cmFjdGlvblxuXHRjb25zdCBob3N0VXRpbHMgPSBuZXcgY2xhc3MgTm9kZUhvc3QgaW1wbGVtZW50cyBJSG9zdFV0aWxzIHtcblx0XHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0XHRwdWJsaWMgcmVhZG9ubHkgcGlkID0gcHJvY2Vzcy5waWQ7XG5cdFx0ZXhpdChjb2RlOiBudW1iZXIpIHsgbmF0aXZlRXhpdChjb2RlKTsgfVxuXHRcdGZzRXhpc3RzKHBhdGg6IHN0cmluZykgeyByZXR1cm4gUHJvbWlzZXMuZXhpc3RzKHBhdGgpOyB9XG5cdFx0ZnNSZWFscGF0aChwYXRoOiBzdHJpbmcpIHsgcmV0dXJuIHJlYWxwYXRoKHBhdGgpOyB9XG5cdH07XG5cblx0Ly8gQXR0ZW1wdCB0byBsb2FkIHVyaSB0cmFuc2Zvcm1lclxuXHRsZXQgdXJpVHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IG51bGwgPSBudWxsO1xuXHRpZiAoaW5pdERhdGEucmVtb3RlLmF1dGhvcml0eSAmJiBhcmdzLnRyYW5zZm9ybVVSSXMpIHtcblx0XHR1cmlUcmFuc2Zvcm1lciA9IGNyZWF0ZVVSSVRyYW5zZm9ybWVyKGluaXREYXRhLnJlbW90ZS5hdXRob3JpdHkpO1xuXHR9XG5cblx0Y29uc3QgZXh0ZW5zaW9uSG9zdE1haW4gPSBuZXcgRXh0ZW5zaW9uSG9zdE1haW4oXG5cdFx0cmVuZGVyZXIucHJvdG9jb2wsXG5cdFx0aW5pdERhdGEsXG5cdFx0aG9zdFV0aWxzLFxuXHRcdHVyaVRyYW5zZm9ybWVyXG5cdCk7XG5cblx0Ly8gcmV3cml0ZSBvblRlcm1pbmF0ZS1mdW5jdGlvbiB0byBiZSBhIHByb3BlciBzaHV0ZG93blxuXHRvblRlcm1pbmF0ZSA9IChyZWFzb246IHN0cmluZykgPT4gZXh0ZW5zaW9uSG9zdE1haW4udGVybWluYXRlKHJlYXNvbik7XG59XG5cbnN0YXJ0RXh0ZW5zaW9uSG9zdFByb2Nlc3MoKS5jYXRjaCgoZXJyKSA9PiBjb25zb2xlLmxvZyhlcnIpKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sY0FBYztBQUVyQixZQUFZLFNBQVM7QUFDckIsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxxQkFBcUIsZ0JBQWdCLHlCQUF5QjtBQUV2RSxZQUFZLGlCQUFpQjtBQUU3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGlCQUFpQixvQkFBb0IseUJBQXlCO0FBQ3ZFLFNBQVMsWUFBWSwyQkFBMkI7QUFFaEQsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sYUFBYTtBQUNwQixTQUFTLHlCQUFrQztBQUUzQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1Qiw2QkFBNkI7QUFDN0QsU0FBUyx1QkFBNEgsYUFBYSxxQkFBcUIsdUJBQXVCO0FBRTlMLE9BQU87QUFDUCxPQUFPO0FBQ1AsU0FBUyxxQkFBcUI7QUFDOUIsTUFBTUEsV0FBVSxjQUFjLFlBQVksR0FBRztBQUFBLENBVTVDLFNBQVMsb0JBQW9CO0FBQzdCLFdBQVMsSUFBSSxHQUFHLElBQUksUUFBUSxTQUFTLFFBQVEsS0FBSztBQUNqRCxRQUFJLFFBQVEsU0FBUyxDQUFDLE1BQU0sb0JBQW9CO0FBQy9DLGNBQVEsU0FBUyxPQUFPLEdBQUcsQ0FBQztBQUM1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
