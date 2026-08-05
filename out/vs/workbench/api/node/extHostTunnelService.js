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
import * as fs from "fs";
import { exec } from "child_process";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { MovingAverage } from "../../../base/common/numbers.js";
import { isLinux } from "../../../base/common/platform.js";
import * as resources from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import * as pfs from "../../../base/node/pfs.js";
import { SocketCloseEventType } from "../../../base/parts/ipc/common/ipc.net.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ManagedSocket, connectManagedSocket } from "../../../platform/remote/common/managedSocket.js";
import { ManagedRemoteConnection } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { ISignService } from "../../../platform/sign/common/sign.js";
import { isAllInterfaces, isLocalhost } from "../../../platform/tunnel/common/tunnel.js";
import { NodeRemoteTunnel } from "../../../platform/tunnel/node/tunnelService.js";
import { IExtHostInitDataService } from "../common/extHostInitDataService.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
import { ExtHostTunnelService } from "../common/extHostTunnelService.js";
import { parseAddress } from "../../services/remote/common/tunnelModel.js";
function getSockets(stdout) {
  const lines = stdout.trim().split("\n");
  const mapped = [];
  lines.forEach((line) => {
    const match = /\/proc\/(\d+)\/fd\/\d+ -> socket:\[(\d+)\]/.exec(line);
    if (match && match.length >= 3) {
      mapped.push({
        pid: parseInt(match[1], 10),
        socket: parseInt(match[2], 10)
      });
    }
  });
  const socketMap = mapped.reduce((m, socket) => {
    m[socket.socket] = socket;
    return m;
  }, {});
  return socketMap;
}
function loadListeningPorts(...stdouts) {
  const table = [].concat(...stdouts.map(loadConnectionTable));
  return [
    ...new Map(
      table.filter((row) => row.st === "0A").map((row) => {
        const address = row.local_address.split(":");
        return {
          socket: parseInt(row.inode, 10),
          ip: parseIpAddress(address[0]),
          port: parseInt(address[1], 16)
        };
      }).map((port) => [port.ip + ":" + port.port, port])
    ).values()
  ];
}
function parseIpAddress(hex) {
  let result = "";
  if (hex.length === 8) {
    for (let i = hex.length - 2; i >= 0; i -= 2) {
      result += parseInt(hex.substr(i, 2), 16);
      if (i !== 0) {
        result += ".";
      }
    }
  } else {
    for (let i = 0; i < hex.length; i += 8) {
      const word = hex.substring(i, i + 8);
      let subWord = "";
      for (let j = 8; j >= 2; j -= 2) {
        subWord += word.substring(j - 2, j);
        if (j === 6 || j === 2) {
          subWord = parseInt(subWord, 16).toString(16);
          result += `${subWord}`;
          subWord = "";
          if (i + j !== hex.length - 6) {
            result += ":";
          }
        }
      }
    }
  }
  return result;
}
function loadConnectionTable(stdout) {
  const lines = stdout.trim().split("\n");
  const names = lines.shift().trim().split(/\s+/).filter((name) => name !== "rx_queue" && name !== "tm->when");
  const table = lines.map((line) => line.trim().split(/\s+/).reduce((obj, value, i) => {
    obj[names[i] || i] = value;
    return obj;
  }, {}));
  return table;
}
function knownExcludeCmdline(command) {
  if (command.length > 500) {
    return false;
  }
  return !!command.match(/.*\.vscode-server-[a-zA-Z]+\/bin.*/) || command.indexOf("out/server-main.js") !== -1 || command.indexOf("_productName=VSCode") !== -1;
}
function getRootProcesses(stdout) {
  const lines = stdout.trim().split("\n");
  const mapped = [];
  lines.forEach((line) => {
    const match = /^\d+\s+\D+\s+root\s+(\d+)\s+(\d+).+\d+\:\d+\:\d+\s+(.+)$/.exec(line);
    if (match && match.length >= 4) {
      mapped.push({
        pid: parseInt(match[1], 10),
        ppid: parseInt(match[2]),
        cmd: match[3]
      });
    }
  });
  return mapped;
}
async function findPorts(connections, socketMap, processes) {
  const processMap = processes.reduce((m, process2) => {
    m[process2.pid] = process2;
    return m;
  }, {});
  const ports = [];
  connections.forEach(({ socket, ip, port }) => {
    const pid = socketMap[socket] ? socketMap[socket].pid : void 0;
    const command = pid ? processMap[pid]?.cmd : void 0;
    if (pid && command && !knownExcludeCmdline(command)) {
      ports.push({ host: ip, port, detail: command, pid });
    }
  });
  return ports;
}
function tryFindRootPorts(connections, rootProcessesStdout, previousPorts) {
  const ports = /* @__PURE__ */ new Map();
  const rootProcesses = getRootProcesses(rootProcessesStdout);
  for (const connection of connections) {
    const previousPort = previousPorts.get(connection.port);
    if (previousPort) {
      ports.set(connection.port, previousPort);
      continue;
    }
    const rootProcessMatch = rootProcesses.find((value) => value.cmd.includes(`${connection.port}`));
    if (rootProcessMatch) {
      let bestMatch = rootProcessMatch;
      let mostChild;
      do {
        mostChild = rootProcesses.find((value) => value.ppid === bestMatch.pid);
        if (mostChild) {
          bestMatch = mostChild;
        }
      } while (mostChild);
      ports.set(connection.port, { host: connection.ip, port: connection.port, pid: bestMatch.pid, detail: bestMatch.cmd, ppid: bestMatch.ppid });
    } else {
      ports.set(connection.port, { host: connection.ip, port: connection.port, ppid: Number.MAX_VALUE });
    }
  }
  return ports;
}
let NodeExtHostTunnelService = class extends ExtHostTunnelService {
  constructor(extHostRpc, initData, logService, signService) {
    super(extHostRpc, initData, logService);
    this.initData = initData;
    this.signService = signService;
    this._initialCandidates = void 0;
    this._foundRootPorts = /* @__PURE__ */ new Map();
    this._candidateFindingEnabled = false;
    if (isLinux && initData.remote.isRemote && initData.remote.authority) {
      this._proxy.$setRemoteTunnelService(process.pid);
      this.setInitialCandidates();
    }
  }
  async $registerCandidateFinder(enable) {
    if (enable && this._candidateFindingEnabled) {
      return;
    }
    this._candidateFindingEnabled = enable;
    let oldPorts = void 0;
    if (this._initialCandidates) {
      oldPorts = this._initialCandidates;
      await this._proxy.$onFoundNewCandidates(this._initialCandidates);
    }
    const movingAverage = new MovingAverage();
    let scanCount = 0;
    while (this._candidateFindingEnabled) {
      const startTime = (/* @__PURE__ */ new Date()).getTime();
      const newPorts = (await this.findCandidatePorts()).filter((candidate) => isLocalhost(candidate.host) || isAllInterfaces(candidate.host));
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) found candidate ports ${newPorts.map((port) => port.port).join(", ")}`);
      const timeTaken = (/* @__PURE__ */ new Date()).getTime() - startTime;
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) candidate port scan took ${timeTaken} ms.`);
      if (scanCount++ > 3) {
        movingAverage.update(timeTaken);
      }
      if (!oldPorts || JSON.stringify(oldPorts) !== JSON.stringify(newPorts)) {
        oldPorts = newPorts;
        await this._proxy.$onFoundNewCandidates(oldPorts);
      }
      const delay = this.calculateDelay(movingAverage.value);
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) next candidate port scan in ${delay} ms.`);
      await new Promise((resolve) => setTimeout(() => resolve(), delay));
    }
  }
  calculateDelay(movingAverage) {
    return Math.max(movingAverage * 20, 2e3);
  }
  async setInitialCandidates() {
    this._initialCandidates = await this.findCandidatePorts();
    this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) Initial candidates found: ${this._initialCandidates.map((c) => c.port).join(", ")}`);
  }
  async findCandidatePorts() {
    let tcp = "";
    let tcp6 = "";
    try {
      tcp = await fs.promises.readFile("/proc/net/tcp", "utf8");
      tcp6 = await fs.promises.readFile("/proc/net/tcp6", "utf8");
    } catch (e) {
    }
    const connections = loadListeningPorts(tcp, tcp6);
    const procSockets = await new Promise((resolve) => {
      exec("ls -l /proc/[0-9]*/fd/[0-9]* | grep socket:", (error, stdout, stderr) => {
        resolve(stdout);
      });
    });
    const socketMap = getSockets(procSockets);
    const procChildren = await pfs.Promises.readdir("/proc");
    const processes = [];
    for (const childName of procChildren) {
      try {
        const pid = Number(childName);
        const childUri = resources.joinPath(URI.file("/proc"), childName);
        const childStat = await fs.promises.stat(childUri.fsPath);
        if (childStat.isDirectory() && !isNaN(pid)) {
          const cwd = await fs.promises.readlink(resources.joinPath(childUri, "cwd").fsPath);
          const cmd = await fs.promises.readFile(resources.joinPath(childUri, "cmdline").fsPath, "utf8");
          processes.push({ pid, cwd, cmd });
        }
      } catch (e) {
      }
    }
    const unFoundConnections = [];
    const filteredConnections = connections.filter((connection) => {
      const foundConnection = socketMap[connection.socket];
      if (!foundConnection) {
        unFoundConnections.push(connection);
      }
      return foundConnection;
    });
    const foundPorts = findPorts(filteredConnections, socketMap, processes);
    let heuristicPorts;
    this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) number of possible root ports ${unFoundConnections.length}`);
    if (unFoundConnections.length > 0) {
      const rootProcesses = await new Promise((resolve) => {
        exec("ps -F -A -l | grep root", (error, stdout, stderr) => {
          resolve(stdout);
        });
      });
      this._foundRootPorts = tryFindRootPorts(unFoundConnections, rootProcesses, this._foundRootPorts);
      heuristicPorts = Array.from(this._foundRootPorts.values());
      this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) heuristic ports ${heuristicPorts.map((heuristicPort) => heuristicPort.port).join(", ")}`);
    }
    return foundPorts.then((foundCandidates) => {
      if (heuristicPorts) {
        return foundCandidates.concat(heuristicPorts);
      } else {
        return foundCandidates;
      }
    });
  }
  makeManagedTunnelFactory(authority) {
    return async (tunnelOptions) => {
      const t = new NodeRemoteTunnel(
        {
          commit: this.initData.commit,
          quality: this.initData.quality,
          logService: this.logService,
          ipcLogger: null,
          // services and address providers have stubs since we don't need
          // the connection identification that the renderer process uses
          remoteSocketFactoryService: {
            _serviceBrand: void 0,
            async connect(_connectTo, path, query, debugLabel) {
              const result = await authority.makeConnection();
              return ExtHostManagedSocket.connect(result, path, query, debugLabel);
            },
            register() {
              throw new Error("not implemented");
            }
          },
          addressProvider: {
            getAddress() {
              return Promise.resolve({
                connectTo: new ManagedRemoteConnection(0),
                connectionToken: authority.connectionToken
              });
            }
          },
          signService: this.signService
        },
        "localhost",
        tunnelOptions.remoteAddress.host || "localhost",
        tunnelOptions.remoteAddress.port,
        tunnelOptions.localAddressPort
      );
      await t.waitForReady();
      const disposeEmitter = new Emitter();
      return {
        localAddress: parseAddress(t.localAddress) ?? t.localAddress,
        remoteAddress: { port: t.tunnelRemotePort, host: t.tunnelRemoteHost },
        onDidDispose: disposeEmitter.event,
        dispose: () => {
          t.dispose();
          disposeEmitter.fire();
          disposeEmitter.dispose();
        }
      };
    };
  }
};
NodeExtHostTunnelService = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ISignService)
], NodeExtHostTunnelService);
class ExtHostManagedSocket extends ManagedSocket {
  constructor(passing, debugLabel, half) {
    super(debugLabel, half);
    this.passing = passing;
  }
  static connect(passing, path, query, debugLabel) {
    const d = new DisposableStore();
    const half = {
      onClose: d.add(new Emitter()),
      onData: d.add(new Emitter()),
      onEnd: d.add(new Emitter())
    };
    d.add(passing.onDidReceiveMessage((d2) => half.onData.fire(VSBuffer.wrap(d2))));
    d.add(passing.onDidEnd(() => half.onEnd.fire()));
    d.add(passing.onDidClose((error) => half.onClose.fire({
      type: SocketCloseEventType.NodeSocketCloseEvent,
      error,
      hadError: !!error
    })));
    const socket = new ExtHostManagedSocket(passing, debugLabel, half);
    socket._register(d);
    return connectManagedSocket(socket, path, query, debugLabel, half);
  }
  write(buffer) {
    this.passing.send(buffer.buffer);
  }
  closeRemote() {
    this.passing.end();
  }
  async drain() {
    await this.passing.drain?.();
  }
}
export {
  NodeExtHostTunnelService,
  findPorts,
  getRootProcesses,
  getSockets,
  loadConnectionTable,
  loadListeningPorts,
  parseIpAddress,
  tryFindRootPorts
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL25vZGUvZXh0SG9zdFR1bm5lbFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1vdmluZ0F2ZXJhZ2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IGlzTGludXggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBwZnMgZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBJU29ja2V0LCBTb2NrZXRDbG9zZUV2ZW50VHlwZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMubmV0LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgTWFuYWdlZFNvY2tldCwgUmVtb3RlU29ja2V0SGFsZiwgY29ubmVjdE1hbmFnZWRTb2NrZXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL21hbmFnZWRTb2NrZXQuanMnO1xuaW1wb3J0IHsgTWFuYWdlZFJlbW90ZUNvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUF1dGhvcml0eVJlc29sdmVyLmpzJztcbmltcG9ydCB7IElTaWduU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NpZ24vY29tbW9uL3NpZ24uanMnO1xuaW1wb3J0IHsgaXNBbGxJbnRlcmZhY2VzLCBpc0xvY2FsaG9zdCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3R1bm5lbC9jb21tb24vdHVubmVsLmpzJztcbmltcG9ydCB7IE5vZGVSZW1vdGVUdW5uZWwgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90dW5uZWwvbm9kZS90dW5uZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RJbml0RGF0YVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RScGNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RScGNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RUdW5uZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RUdW5uZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENhbmRpZGF0ZVBvcnQsIHBhcnNlQWRkcmVzcyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vdHVubmVsTW9kZWwuanMnO1xuaW1wb3J0ICogYXMgdnNjb2RlIGZyb20gJ3ZzY29kZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTb2NrZXRzKHN0ZG91dDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgeyBwaWQ6IG51bWJlcjsgc29ja2V0OiBudW1iZXIgfT4ge1xuXHRjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpO1xuXHRjb25zdCBtYXBwZWQ6IHsgcGlkOiBudW1iZXI7IHNvY2tldDogbnVtYmVyIH1bXSA9IFtdO1xuXHRsaW5lcy5mb3JFYWNoKGxpbmUgPT4ge1xuXHRcdGNvbnN0IG1hdGNoID0gL1xcL3Byb2NcXC8oXFxkKylcXC9mZFxcL1xcZCsgLT4gc29ja2V0OlxcWyhcXGQrKVxcXS8uZXhlYyhsaW5lKSE7XG5cdFx0aWYgKG1hdGNoICYmIG1hdGNoLmxlbmd0aCA+PSAzKSB7XG5cdFx0XHRtYXBwZWQucHVzaCh7XG5cdFx0XHRcdHBpZDogcGFyc2VJbnQobWF0Y2hbMV0sIDEwKSxcblx0XHRcdFx0c29ja2V0OiBwYXJzZUludChtYXRjaFsyXSwgMTApXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXHRjb25zdCBzb2NrZXRNYXAgPSBtYXBwZWQucmVkdWNlKChtOiBSZWNvcmQ8c3RyaW5nLCB0eXBlb2YgbWFwcGVkWzBdPiwgc29ja2V0KSA9PiB7XG5cdFx0bVtzb2NrZXQuc29ja2V0XSA9IHNvY2tldDtcblx0XHRyZXR1cm4gbTtcblx0fSwge30pO1xuXHRyZXR1cm4gc29ja2V0TWFwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9hZExpc3RlbmluZ1BvcnRzKC4uLnN0ZG91dHM6IHN0cmluZ1tdKTogeyBzb2NrZXQ6IG51bWJlcjsgaXA6IHN0cmluZzsgcG9ydDogbnVtYmVyIH1bXSB7XG5cdGNvbnN0IHRhYmxlID0gKFtdIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz5bXSkuY29uY2F0KC4uLnN0ZG91dHMubWFwKGxvYWRDb25uZWN0aW9uVGFibGUpKTtcblx0cmV0dXJuIFtcblx0XHQuLi5uZXcgTWFwKFxuXHRcdFx0dGFibGUuZmlsdGVyKHJvdyA9PiByb3cuc3QgPT09ICcwQScpXG5cdFx0XHRcdC5tYXAocm93ID0+IHtcblx0XHRcdFx0XHRjb25zdCBhZGRyZXNzID0gcm93LmxvY2FsX2FkZHJlc3Muc3BsaXQoJzonKTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0c29ja2V0OiBwYXJzZUludChyb3cuaW5vZGUsIDEwKSxcblx0XHRcdFx0XHRcdGlwOiBwYXJzZUlwQWRkcmVzcyhhZGRyZXNzWzBdKSxcblx0XHRcdFx0XHRcdHBvcnQ6IHBhcnNlSW50KGFkZHJlc3NbMV0sIDE2KVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pLm1hcChwb3J0ID0+IFtwb3J0LmlwICsgJzonICsgcG9ydC5wb3J0LCBwb3J0XSlcblx0XHQpLnZhbHVlcygpXG5cdF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUlwQWRkcmVzcyhoZXg6IHN0cmluZyk6IHN0cmluZyB7XG5cdGxldCByZXN1bHQgPSAnJztcblx0aWYgKGhleC5sZW5ndGggPT09IDgpIHtcblx0XHRmb3IgKGxldCBpID0gaGV4Lmxlbmd0aCAtIDI7IGkgPj0gMDsgaSAtPSAyKSB7XG5cdFx0XHRyZXN1bHQgKz0gcGFyc2VJbnQoaGV4LnN1YnN0cihpLCAyKSwgMTYpO1xuXHRcdFx0aWYgKGkgIT09IDApIHtcblx0XHRcdFx0cmVzdWx0ICs9ICcuJztcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Ly8gTmljZSBleHBsYW5hdGlvbiBvZiBob3N0IGZvcm1hdCBpbiB0Y3A2IGZpbGU6IGh0dHBzOi8vc2VydmVyZmF1bHQuY29tL3F1ZXN0aW9ucy81OTI1NzQvd2h5LWRvZXMtcHJvYy1uZXQtdGNwNi1yZXByZXNlbnRzLTEtYXMtMTAwMFxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgaGV4Lmxlbmd0aDsgaSArPSA4KSB7XG5cdFx0XHRjb25zdCB3b3JkID0gaGV4LnN1YnN0cmluZyhpLCBpICsgOCk7XG5cdFx0XHRsZXQgc3ViV29yZCA9ICcnO1xuXHRcdFx0Zm9yIChsZXQgaiA9IDg7IGogPj0gMjsgaiAtPSAyKSB7XG5cdFx0XHRcdHN1YldvcmQgKz0gd29yZC5zdWJzdHJpbmcoaiAtIDIsIGopO1xuXHRcdFx0XHRpZiAoKGogPT09IDYpIHx8IChqID09PSAyKSkge1xuXHRcdFx0XHRcdC8vIFRyaW0gbGVhZGluZyB6ZXJvc1xuXHRcdFx0XHRcdHN1YldvcmQgPSBwYXJzZUludChzdWJXb3JkLCAxNikudG9TdHJpbmcoMTYpO1xuXHRcdFx0XHRcdHJlc3VsdCArPSBgJHtzdWJXb3JkfWA7XG5cdFx0XHRcdFx0c3ViV29yZCA9ICcnO1xuXHRcdFx0XHRcdGlmIChpICsgaiAhPT0gaGV4Lmxlbmd0aCAtIDYpIHtcblx0XHRcdFx0XHRcdHJlc3VsdCArPSAnOic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkQ29ubmVjdGlvblRhYmxlKHN0ZG91dDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPltdIHtcblx0Y29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKTtcblx0Y29uc3QgbmFtZXMgPSBsaW5lcy5zaGlmdCgpIS50cmltKCkuc3BsaXQoL1xccysvKVxuXHRcdC5maWx0ZXIobmFtZSA9PiBuYW1lICE9PSAncnhfcXVldWUnICYmIG5hbWUgIT09ICd0bS0+d2hlbicpO1xuXHRjb25zdCB0YWJsZSA9IGxpbmVzLm1hcChsaW5lID0+IGxpbmUudHJpbSgpLnNwbGl0KC9cXHMrLykucmVkdWNlKChvYmo6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sIHZhbHVlLCBpKSA9PiB7XG5cdFx0b2JqW25hbWVzW2ldIHx8IGldID0gdmFsdWU7XG5cdFx0cmV0dXJuIG9iajtcblx0fSwge30pKTtcblx0cmV0dXJuIHRhYmxlO1xufVxuXG5mdW5jdGlvbiBrbm93bkV4Y2x1ZGVDbWRsaW5lKGNvbW1hbmQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRpZiAoY29tbWFuZC5sZW5ndGggPiA1MDApIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cmV0dXJuICEhY29tbWFuZC5tYXRjaCgvLipcXC52c2NvZGUtc2VydmVyLVthLXpBLVpdK1xcL2Jpbi4qLylcblx0XHR8fCAoY29tbWFuZC5pbmRleE9mKCdvdXQvc2VydmVyLW1haW4uanMnKSAhPT0gLTEpXG5cdFx0fHwgKGNvbW1hbmQuaW5kZXhPZignX3Byb2R1Y3ROYW1lPVZTQ29kZScpICE9PSAtMSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSb290UHJvY2Vzc2VzKHN0ZG91dDogc3RyaW5nKSB7XG5cdGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJyk7XG5cdGNvbnN0IG1hcHBlZDogeyBwaWQ6IG51bWJlcjsgY21kOiBzdHJpbmc7IHBwaWQ6IG51bWJlciB9W10gPSBbXTtcblx0bGluZXMuZm9yRWFjaChsaW5lID0+IHtcblx0XHRjb25zdCBtYXRjaCA9IC9eXFxkK1xccytcXEQrXFxzK3Jvb3RcXHMrKFxcZCspXFxzKyhcXGQrKS4rXFxkK1xcOlxcZCtcXDpcXGQrXFxzKyguKykkLy5leGVjKGxpbmUpITtcblx0XHRpZiAobWF0Y2ggJiYgbWF0Y2gubGVuZ3RoID49IDQpIHtcblx0XHRcdG1hcHBlZC5wdXNoKHtcblx0XHRcdFx0cGlkOiBwYXJzZUludChtYXRjaFsxXSwgMTApLFxuXHRcdFx0XHRwcGlkOiBwYXJzZUludChtYXRjaFsyXSksXG5cdFx0XHRcdGNtZDogbWF0Y2hbM11cblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBtYXBwZWQ7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5kUG9ydHMoY29ubmVjdGlvbnM6IHsgc29ja2V0OiBudW1iZXI7IGlwOiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9W10sIHNvY2tldE1hcDogUmVjb3JkPHN0cmluZywgeyBwaWQ6IG51bWJlcjsgc29ja2V0OiBudW1iZXIgfT4sIHByb2Nlc3NlczogeyBwaWQ6IG51bWJlcjsgY3dkOiBzdHJpbmc7IGNtZDogc3RyaW5nIH1bXSk6IFByb21pc2U8Q2FuZGlkYXRlUG9ydFtdPiB7XG5cdGNvbnN0IHByb2Nlc3NNYXAgPSBwcm9jZXNzZXMucmVkdWNlKChtOiBSZWNvcmQ8c3RyaW5nLCB0eXBlb2YgcHJvY2Vzc2VzWzBdPiwgcHJvY2VzcykgPT4ge1xuXHRcdG1bcHJvY2Vzcy5waWRdID0gcHJvY2Vzcztcblx0XHRyZXR1cm4gbTtcblx0fSwge30pO1xuXG5cdGNvbnN0IHBvcnRzOiBDYW5kaWRhdGVQb3J0W10gPSBbXTtcblx0Y29ubmVjdGlvbnMuZm9yRWFjaCgoeyBzb2NrZXQsIGlwLCBwb3J0IH0pID0+IHtcblx0XHRjb25zdCBwaWQgPSBzb2NrZXRNYXBbc29ja2V0XSA/IHNvY2tldE1hcFtzb2NrZXRdLnBpZCA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjb21tYW5kOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBwaWQgPyBwcm9jZXNzTWFwW3BpZF0/LmNtZCA6IHVuZGVmaW5lZDtcblx0XHRpZiAocGlkICYmIGNvbW1hbmQgJiYgIWtub3duRXhjbHVkZUNtZGxpbmUoY29tbWFuZCkpIHtcblx0XHRcdHBvcnRzLnB1c2goeyBob3N0OiBpcCwgcG9ydCwgZGV0YWlsOiBjb21tYW5kLCBwaWQgfSk7XG5cdFx0fVxuXHR9KTtcblx0cmV0dXJuIHBvcnRzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJ5RmluZFJvb3RQb3J0cyhjb25uZWN0aW9uczogeyBzb2NrZXQ6IG51bWJlcjsgaXA6IHN0cmluZzsgcG9ydDogbnVtYmVyIH1bXSwgcm9vdFByb2Nlc3Nlc1N0ZG91dDogc3RyaW5nLCBwcmV2aW91c1BvcnRzOiBNYXA8bnVtYmVyLCBDYW5kaWRhdGVQb3J0ICYgeyBwcGlkOiBudW1iZXIgfT4pOiBNYXA8bnVtYmVyLCBDYW5kaWRhdGVQb3J0ICYgeyBwcGlkOiBudW1iZXIgfT4ge1xuXHRjb25zdCBwb3J0czogTWFwPG51bWJlciwgQ2FuZGlkYXRlUG9ydCAmIHsgcHBpZDogbnVtYmVyIH0+ID0gbmV3IE1hcCgpO1xuXHRjb25zdCByb290UHJvY2Vzc2VzID0gZ2V0Um9vdFByb2Nlc3Nlcyhyb290UHJvY2Vzc2VzU3Rkb3V0KTtcblxuXHRmb3IgKGNvbnN0IGNvbm5lY3Rpb24gb2YgY29ubmVjdGlvbnMpIHtcblx0XHRjb25zdCBwcmV2aW91c1BvcnQgPSBwcmV2aW91c1BvcnRzLmdldChjb25uZWN0aW9uLnBvcnQpO1xuXHRcdGlmIChwcmV2aW91c1BvcnQpIHtcblx0XHRcdHBvcnRzLnNldChjb25uZWN0aW9uLnBvcnQsIHByZXZpb3VzUG9ydCk7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0Y29uc3Qgcm9vdFByb2Nlc3NNYXRjaCA9IHJvb3RQcm9jZXNzZXMuZmluZCgodmFsdWUpID0+IHZhbHVlLmNtZC5pbmNsdWRlcyhgJHtjb25uZWN0aW9uLnBvcnR9YCkpO1xuXHRcdGlmIChyb290UHJvY2Vzc01hdGNoKSB7XG5cdFx0XHRsZXQgYmVzdE1hdGNoID0gcm9vdFByb2Nlc3NNYXRjaDtcblx0XHRcdC8vIFRoZXJlIGFyZSBvZnRlbiBzZXZlcmFsIHByb2Nlc3NlcyB0aGF0IFwibG9va1wiIGxpa2UgdGhleSBjb3VsZCBtYXRjaCB0aGUgcG9ydC5cblx0XHRcdC8vIFRoZSBvbmUgd2Ugd2FudCBpcyB1c3VhbGx5IHRoZSBjaGlsZCBvZiB0aGUgb3RoZXIuIEZpbmQgdGhlIG1vc3QgY2hpbGQgcHJvY2Vzcy5cblx0XHRcdGxldCBtb3N0Q2hpbGQ6IHsgcGlkOiBudW1iZXI7IGNtZDogc3RyaW5nOyBwcGlkOiBudW1iZXIgfSB8IHVuZGVmaW5lZDtcblx0XHRcdGRvIHtcblx0XHRcdFx0bW9zdENoaWxkID0gcm9vdFByb2Nlc3Nlcy5maW5kKHZhbHVlID0+IHZhbHVlLnBwaWQgPT09IGJlc3RNYXRjaC5waWQpO1xuXHRcdFx0XHRpZiAobW9zdENoaWxkKSB7XG5cdFx0XHRcdFx0YmVzdE1hdGNoID0gbW9zdENoaWxkO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlIChtb3N0Q2hpbGQpO1xuXHRcdFx0cG9ydHMuc2V0KGNvbm5lY3Rpb24ucG9ydCwgeyBob3N0OiBjb25uZWN0aW9uLmlwLCBwb3J0OiBjb25uZWN0aW9uLnBvcnQsIHBpZDogYmVzdE1hdGNoLnBpZCwgZGV0YWlsOiBiZXN0TWF0Y2guY21kLCBwcGlkOiBiZXN0TWF0Y2gucHBpZCB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cG9ydHMuc2V0KGNvbm5lY3Rpb24ucG9ydCwgeyBob3N0OiBjb25uZWN0aW9uLmlwLCBwb3J0OiBjb25uZWN0aW9uLnBvcnQsIHBwaWQ6IE51bWJlci5NQVhfVkFMVUUgfSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHBvcnRzO1xufVxuXG5leHBvcnQgY2xhc3MgTm9kZUV4dEhvc3RUdW5uZWxTZXJ2aWNlIGV4dGVuZHMgRXh0SG9zdFR1bm5lbFNlcnZpY2Uge1xuXHRwcml2YXRlIF9pbml0aWFsQ2FuZGlkYXRlczogQ2FuZGlkYXRlUG9ydFtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9mb3VuZFJvb3RQb3J0czogTWFwPG51bWJlciwgQ2FuZGlkYXRlUG9ydCAmIHsgcHBpZDogbnVtYmVyIH0+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIF9jYW5kaWRhdGVGaW5kaW5nRW5hYmxlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwYzogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdEluaXREYXRhU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluaXREYXRhOiBJRXh0SG9zdEluaXREYXRhU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElTaWduU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNpZ25TZXJ2aWNlOiBJU2lnblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGV4dEhvc3RScGMsIGluaXREYXRhLCBsb2dTZXJ2aWNlKTtcblx0XHRpZiAoaXNMaW51eCAmJiBpbml0RGF0YS5yZW1vdGUuaXNSZW1vdGUgJiYgaW5pdERhdGEucmVtb3RlLmF1dGhvcml0eSkge1xuXHRcdFx0dGhpcy5fcHJveHkuJHNldFJlbW90ZVR1bm5lbFNlcnZpY2UocHJvY2Vzcy5waWQpO1xuXHRcdFx0dGhpcy5zZXRJbml0aWFsQ2FuZGlkYXRlcygpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jICRyZWdpc3RlckNhbmRpZGF0ZUZpbmRlcihlbmFibGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoZW5hYmxlICYmIHRoaXMuX2NhbmRpZGF0ZUZpbmRpbmdFbmFibGVkKSB7XG5cdFx0XHQvLyBhbHJlYWR5IGVuYWJsZWRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jYW5kaWRhdGVGaW5kaW5nRW5hYmxlZCA9IGVuYWJsZTtcblx0XHRsZXQgb2xkUG9ydHM6IHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXI7IGRldGFpbD86IHN0cmluZyB9W10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBJZiB3ZSBhbHJlYWR5IGhhdmUgZm91bmQgaW5pdGlhbCBjYW5kaWRhdGVzIHNlbmQgdGhvc2UgaW1tZWRpYXRlbHkuXG5cdFx0aWYgKHRoaXMuX2luaXRpYWxDYW5kaWRhdGVzKSB7XG5cdFx0XHRvbGRQb3J0cyA9IHRoaXMuX2luaXRpYWxDYW5kaWRhdGVzO1xuXHRcdFx0YXdhaXQgdGhpcy5fcHJveHkuJG9uRm91bmROZXdDYW5kaWRhdGVzKHRoaXMuX2luaXRpYWxDYW5kaWRhdGVzKTtcblx0XHR9XG5cblx0XHQvLyBSZWd1bGFybHkgc2NhbiB0byBzZWUgaWYgdGhlIGNhbmRpZGF0ZSBwb3J0cyBoYXZlIGNoYW5nZWQuXG5cdFx0Y29uc3QgbW92aW5nQXZlcmFnZSA9IG5ldyBNb3ZpbmdBdmVyYWdlKCk7XG5cdFx0bGV0IHNjYW5Db3VudCA9IDA7XG5cdFx0d2hpbGUgKHRoaXMuX2NhbmRpZGF0ZUZpbmRpbmdFbmFibGVkKSB7XG5cdFx0XHRjb25zdCBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHRcdGNvbnN0IG5ld1BvcnRzID0gKGF3YWl0IHRoaXMuZmluZENhbmRpZGF0ZVBvcnRzKCkpLmZpbHRlcihjYW5kaWRhdGUgPT4gKGlzTG9jYWxob3N0KGNhbmRpZGF0ZS5ob3N0KSB8fCBpc0FsbEludGVyZmFjZXMoY2FuZGlkYXRlLmhvc3QpKSk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoRXh0SG9zdFR1bm5lbFNlcnZpY2UpIGZvdW5kIGNhbmRpZGF0ZSBwb3J0cyAke25ld1BvcnRzLm1hcChwb3J0ID0+IHBvcnQucG9ydCkuam9pbignLCAnKX1gKTtcblx0XHRcdGNvbnN0IHRpbWVUYWtlbiA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnRUaW1lO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKEV4dEhvc3RUdW5uZWxTZXJ2aWNlKSBjYW5kaWRhdGUgcG9ydCBzY2FuIHRvb2sgJHt0aW1lVGFrZW59IG1zLmApO1xuXHRcdFx0Ly8gRG8gbm90IGNvdW50IHRoZSBmaXJzdCBmZXcgc2NhbnMgdG93YXJkcyB0aGUgbW92aW5nIGF2ZXJhZ2UgYXMgdGhleSBhcmUgbGlrZWx5IHRvIGJlIHNsb3dlci5cblx0XHRcdGlmIChzY2FuQ291bnQrKyA+IDMpIHtcblx0XHRcdFx0bW92aW5nQXZlcmFnZS51cGRhdGUodGltZVRha2VuKTtcblx0XHRcdH1cblx0XHRcdGlmICghb2xkUG9ydHMgfHwgKEpTT04uc3RyaW5naWZ5KG9sZFBvcnRzKSAhPT0gSlNPTi5zdHJpbmdpZnkobmV3UG9ydHMpKSkge1xuXHRcdFx0XHRvbGRQb3J0cyA9IG5ld1BvcnRzO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9wcm94eS4kb25Gb3VuZE5ld0NhbmRpZGF0ZXMob2xkUG9ydHMpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGVsYXkgPSB0aGlzLmNhbGN1bGF0ZURlbGF5KG1vdmluZ0F2ZXJhZ2UudmFsdWUpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKEV4dEhvc3RUdW5uZWxTZXJ2aWNlKSBuZXh0IGNhbmRpZGF0ZSBwb3J0IHNjYW4gaW4gJHtkZWxheX0gbXMuYCk7XG5cdFx0XHRhd2FpdCAobmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KCgpID0+IHJlc29sdmUoKSwgZGVsYXkpKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjYWxjdWxhdGVEZWxheShtb3ZpbmdBdmVyYWdlOiBudW1iZXIpIHtcblx0XHQvLyBTb21lIGxvY2FsIHRlc3RpbmcgaW5kaWNhdGVkIHRoYXQgdGhlIG1vdmluZyBhdmVyYWdlIG1pZ2h0IGJlIGJldHdlZW4gNTAtMTAwIG1zLlxuXHRcdHJldHVybiBNYXRoLm1heChtb3ZpbmdBdmVyYWdlICogMjAsIDIwMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXRJbml0aWFsQ2FuZGlkYXRlcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9pbml0aWFsQ2FuZGlkYXRlcyA9IGF3YWl0IHRoaXMuZmluZENhbmRpZGF0ZVBvcnRzKCk7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKEV4dEhvc3RUdW5uZWxTZXJ2aWNlKSBJbml0aWFsIGNhbmRpZGF0ZXMgZm91bmQ6ICR7dGhpcy5faW5pdGlhbENhbmRpZGF0ZXMubWFwKGMgPT4gYy5wb3J0KS5qb2luKCcsICcpfWApO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmaW5kQ2FuZGlkYXRlUG9ydHMoKTogUHJvbWlzZTxDYW5kaWRhdGVQb3J0W10+IHtcblx0XHRsZXQgdGNwOiBzdHJpbmcgPSAnJztcblx0XHRsZXQgdGNwNjogc3RyaW5nID0gJyc7XG5cdFx0dHJ5IHtcblx0XHRcdHRjcCA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKCcvcHJvYy9uZXQvdGNwJywgJ3V0ZjgnKTtcblx0XHRcdHRjcDYgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZSgnL3Byb2MvbmV0L3RjcDYnLCAndXRmOCcpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIEZpbGUgcmVhZGluZyBlcnJvci4gTm8gYWRkaXRpb25hbCBoYW5kbGluZyBuZWVkZWQuXG5cdFx0fVxuXHRcdGNvbnN0IGNvbm5lY3Rpb25zOiB7IHNvY2tldDogbnVtYmVyOyBpcDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfVtdID0gbG9hZExpc3RlbmluZ1BvcnRzKHRjcCwgdGNwNik7XG5cblx0XHRjb25zdCBwcm9jU29ja2V0czogc3RyaW5nID0gYXdhaXQgKG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0ZXhlYygnbHMgLWwgL3Byb2MvWzAtOV0qL2ZkL1swLTldKiB8IGdyZXAgc29ja2V0OicsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcblx0XHRcdFx0cmVzb2x2ZShzdGRvdXQpO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXHRcdGNvbnN0IHNvY2tldE1hcCA9IGdldFNvY2tldHMocHJvY1NvY2tldHMpO1xuXG5cdFx0Y29uc3QgcHJvY0NoaWxkcmVuID0gYXdhaXQgcGZzLlByb21pc2VzLnJlYWRkaXIoJy9wcm9jJyk7XG5cdFx0Y29uc3QgcHJvY2Vzc2VzOiB7XG5cdFx0XHRwaWQ6IG51bWJlcjsgY3dkOiBzdHJpbmc7IGNtZDogc3RyaW5nO1xuXHRcdH1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY2hpbGROYW1lIG9mIHByb2NDaGlsZHJlbikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcGlkOiBudW1iZXIgPSBOdW1iZXIoY2hpbGROYW1lKTtcblx0XHRcdFx0Y29uc3QgY2hpbGRVcmkgPSByZXNvdXJjZXMuam9pblBhdGgoVVJJLmZpbGUoJy9wcm9jJyksIGNoaWxkTmFtZSk7XG5cdFx0XHRcdGNvbnN0IGNoaWxkU3RhdCA9IGF3YWl0IGZzLnByb21pc2VzLnN0YXQoY2hpbGRVcmkuZnNQYXRoKTtcblx0XHRcdFx0aWYgKGNoaWxkU3RhdC5pc0RpcmVjdG9yeSgpICYmICFpc05hTihwaWQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY3dkID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZGxpbmsocmVzb3VyY2VzLmpvaW5QYXRoKGNoaWxkVXJpLCAnY3dkJykuZnNQYXRoKTtcblx0XHRcdFx0XHRjb25zdCBjbWQgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShyZXNvdXJjZXMuam9pblBhdGgoY2hpbGRVcmksICdjbWRsaW5lJykuZnNQYXRoLCAndXRmOCcpO1xuXHRcdFx0XHRcdHByb2Nlc3Nlcy5wdXNoKHsgcGlkLCBjd2QsIGNtZCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvL1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHVuRm91bmRDb25uZWN0aW9uczogeyBzb2NrZXQ6IG51bWJlcjsgaXA6IHN0cmluZzsgcG9ydDogbnVtYmVyIH1bXSA9IFtdO1xuXHRcdGNvbnN0IGZpbHRlcmVkQ29ubmVjdGlvbnMgPSBjb25uZWN0aW9ucy5maWx0ZXIoKGNvbm5lY3Rpb24gPT4ge1xuXHRcdFx0Y29uc3QgZm91bmRDb25uZWN0aW9uID0gc29ja2V0TWFwW2Nvbm5lY3Rpb24uc29ja2V0XTtcblx0XHRcdGlmICghZm91bmRDb25uZWN0aW9uKSB7XG5cdFx0XHRcdHVuRm91bmRDb25uZWN0aW9ucy5wdXNoKGNvbm5lY3Rpb24pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZvdW5kQ29ubmVjdGlvbjtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBmb3VuZFBvcnRzID0gZmluZFBvcnRzKGZpbHRlcmVkQ29ubmVjdGlvbnMsIHNvY2tldE1hcCwgcHJvY2Vzc2VzKTtcblx0XHRsZXQgaGV1cmlzdGljUG9ydHM6IENhbmRpZGF0ZVBvcnRbXSB8IHVuZGVmaW5lZDtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoRXh0SG9zdFR1bm5lbFNlcnZpY2UpIG51bWJlciBvZiBwb3NzaWJsZSByb290IHBvcnRzICR7dW5Gb3VuZENvbm5lY3Rpb25zLmxlbmd0aH1gKTtcblx0XHRpZiAodW5Gb3VuZENvbm5lY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IHJvb3RQcm9jZXNzZXM6IHN0cmluZyA9IGF3YWl0IChuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0ZXhlYygncHMgLUYgLUEgLWwgfCBncmVwIHJvb3QnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG5cdFx0XHRcdFx0cmVzb2x2ZShzdGRvdXQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX2ZvdW5kUm9vdFBvcnRzID0gdHJ5RmluZFJvb3RQb3J0cyh1bkZvdW5kQ29ubmVjdGlvbnMsIHJvb3RQcm9jZXNzZXMsIHRoaXMuX2ZvdW5kUm9vdFBvcnRzKTtcblx0XHRcdGhldXJpc3RpY1BvcnRzID0gQXJyYXkuZnJvbSh0aGlzLl9mb3VuZFJvb3RQb3J0cy52YWx1ZXMoKSk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoRXh0SG9zdFR1bm5lbFNlcnZpY2UpIGhldXJpc3RpYyBwb3J0cyAke2hldXJpc3RpY1BvcnRzLm1hcChoZXVyaXN0aWNQb3J0ID0+IGhldXJpc3RpY1BvcnQucG9ydCkuam9pbignLCAnKX1gKTtcblxuXHRcdH1cblx0XHRyZXR1cm4gZm91bmRQb3J0cy50aGVuKGZvdW5kQ2FuZGlkYXRlcyA9PiB7XG5cdFx0XHRpZiAoaGV1cmlzdGljUG9ydHMpIHtcblx0XHRcdFx0cmV0dXJuIGZvdW5kQ2FuZGlkYXRlcy5jb25jYXQoaGV1cmlzdGljUG9ydHMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZvdW5kQ2FuZGlkYXRlcztcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBtYWtlTWFuYWdlZFR1bm5lbEZhY3RvcnkoYXV0aG9yaXR5OiB2c2NvZGUuTWFuYWdlZFJlc29sdmVkQXV0aG9yaXR5KTogdnNjb2RlLlJlbW90ZUF1dGhvcml0eVJlc29sdmVyWyd0dW5uZWxGYWN0b3J5J10ge1xuXHRcdHJldHVybiBhc3luYyAodHVubmVsT3B0aW9ucykgPT4ge1xuXHRcdFx0Y29uc3QgdCA9IG5ldyBOb2RlUmVtb3RlVHVubmVsKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29tbWl0OiB0aGlzLmluaXREYXRhLmNvbW1pdCxcblx0XHRcdFx0XHRxdWFsaXR5OiB0aGlzLmluaXREYXRhLnF1YWxpdHksXG5cdFx0XHRcdFx0bG9nU2VydmljZTogdGhpcy5sb2dTZXJ2aWNlLFxuXHRcdFx0XHRcdGlwY0xvZ2dlcjogbnVsbCxcblx0XHRcdFx0XHQvLyBzZXJ2aWNlcyBhbmQgYWRkcmVzcyBwcm92aWRlcnMgaGF2ZSBzdHVicyBzaW5jZSB3ZSBkb24ndCBuZWVkXG5cdFx0XHRcdFx0Ly8gdGhlIGNvbm5lY3Rpb24gaWRlbnRpZmljYXRpb24gdGhhdCB0aGUgcmVuZGVyZXIgcHJvY2VzcyB1c2VzXG5cdFx0XHRcdFx0cmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2U6IHtcblx0XHRcdFx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGFzeW5jIGNvbm5lY3QoX2Nvbm5lY3RUbzogTWFuYWdlZFJlbW90ZUNvbm5lY3Rpb24sIHBhdGg6IHN0cmluZywgcXVlcnk6IHN0cmluZywgZGVidWdMYWJlbDogc3RyaW5nKTogUHJvbWlzZTxJU29ja2V0PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGF1dGhvcml0eS5tYWtlQ29ubmVjdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gRXh0SG9zdE1hbmFnZWRTb2NrZXQuY29ubmVjdChyZXN1bHQsIHBhdGgsIHF1ZXJ5LCBkZWJ1Z0xhYmVsKTtcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRyZWdpc3RlcigpIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhZGRyZXNzUHJvdmlkZXI6IHtcblx0XHRcdFx0XHRcdGdldEFkZHJlc3MoKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuXHRcdFx0XHRcdFx0XHRcdGNvbm5lY3RUbzogbmV3IE1hbmFnZWRSZW1vdGVDb25uZWN0aW9uKDApLFxuXHRcdFx0XHRcdFx0XHRcdGNvbm5lY3Rpb25Ub2tlbjogYXV0aG9yaXR5LmNvbm5lY3Rpb25Ub2tlbixcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2lnblNlcnZpY2U6IHRoaXMuc2lnblNlcnZpY2UsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdsb2NhbGhvc3QnLFxuXHRcdFx0XHR0dW5uZWxPcHRpb25zLnJlbW90ZUFkZHJlc3MuaG9zdCB8fCAnbG9jYWxob3N0Jyxcblx0XHRcdFx0dHVubmVsT3B0aW9ucy5yZW1vdGVBZGRyZXNzLnBvcnQsXG5cdFx0XHRcdHR1bm5lbE9wdGlvbnMubG9jYWxBZGRyZXNzUG9ydCxcblx0XHRcdCk7XG5cblx0XHRcdGF3YWl0IHQud2FpdEZvclJlYWR5KCk7XG5cblx0XHRcdGNvbnN0IGRpc3Bvc2VFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bG9jYWxBZGRyZXNzOiBwYXJzZUFkZHJlc3ModC5sb2NhbEFkZHJlc3MpID8/IHQubG9jYWxBZGRyZXNzLFxuXHRcdFx0XHRyZW1vdGVBZGRyZXNzOiB7IHBvcnQ6IHQudHVubmVsUmVtb3RlUG9ydCwgaG9zdDogdC50dW5uZWxSZW1vdGVIb3N0IH0sXG5cdFx0XHRcdG9uRGlkRGlzcG9zZTogZGlzcG9zZUVtaXR0ZXIuZXZlbnQsXG5cdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHR0LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRkaXNwb3NlRW1pdHRlci5maXJlKCk7XG5cdFx0XHRcdFx0ZGlzcG9zZUVtaXR0ZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fTtcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIEV4dEhvc3RNYW5hZ2VkU29ja2V0IGV4dGVuZHMgTWFuYWdlZFNvY2tldCB7XG5cdHB1YmxpYyBzdGF0aWMgY29ubmVjdChcblx0XHRwYXNzaW5nOiB2c2NvZGUuTWFuYWdlZE1lc3NhZ2VQYXNzaW5nLFxuXHRcdHBhdGg6IHN0cmluZywgcXVlcnk6IHN0cmluZywgZGVidWdMYWJlbDogc3RyaW5nLFxuXHQpOiBQcm9taXNlPEV4dEhvc3RNYW5hZ2VkU29ja2V0PiB7XG5cdFx0Y29uc3QgZCA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBoYWxmOiBSZW1vdGVTb2NrZXRIYWxmID0ge1xuXHRcdFx0b25DbG9zZTogZC5hZGQobmV3IEVtaXR0ZXIoKSksXG5cdFx0XHRvbkRhdGE6IGQuYWRkKG5ldyBFbWl0dGVyKCkpLFxuXHRcdFx0b25FbmQ6IGQuYWRkKG5ldyBFbWl0dGVyKCkpLFxuXHRcdH07XG5cblx0XHRkLmFkZChwYXNzaW5nLm9uRGlkUmVjZWl2ZU1lc3NhZ2UoZCA9PiBoYWxmLm9uRGF0YS5maXJlKFZTQnVmZmVyLndyYXAoZCkpKSk7XG5cdFx0ZC5hZGQocGFzc2luZy5vbkRpZEVuZCgoKSA9PiBoYWxmLm9uRW5kLmZpcmUoKSkpO1xuXHRcdGQuYWRkKHBhc3Npbmcub25EaWRDbG9zZShlcnJvciA9PiBoYWxmLm9uQ2xvc2UuZmlyZSh7XG5cdFx0XHR0eXBlOiBTb2NrZXRDbG9zZUV2ZW50VHlwZS5Ob2RlU29ja2V0Q2xvc2VFdmVudCxcblx0XHRcdGVycm9yLFxuXHRcdFx0aGFkRXJyb3I6ICEhZXJyb3Jcblx0XHR9KSkpO1xuXG5cdFx0Y29uc3Qgc29ja2V0ID0gbmV3IEV4dEhvc3RNYW5hZ2VkU29ja2V0KHBhc3NpbmcsIGRlYnVnTGFiZWwsIGhhbGYpO1xuXHRcdHNvY2tldC5fcmVnaXN0ZXIoZCk7XG5cdFx0cmV0dXJuIGNvbm5lY3RNYW5hZ2VkU29ja2V0KHNvY2tldCwgcGF0aCwgcXVlcnksIGRlYnVnTGFiZWwsIGhhbGYpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwYXNzaW5nOiB2c2NvZGUuTWFuYWdlZE1lc3NhZ2VQYXNzaW5nLFxuXHRcdGRlYnVnTGFiZWw6IHN0cmluZyxcblx0XHRoYWxmOiBSZW1vdGVTb2NrZXRIYWxmLFxuXHQpIHtcblx0XHRzdXBlcihkZWJ1Z0xhYmVsLCBoYWxmKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSB3cml0ZShidWZmZXI6IFZTQnVmZmVyKTogdm9pZCB7XG5cdFx0dGhpcy5wYXNzaW5nLnNlbmQoYnVmZmVyLmJ1ZmZlcik7XG5cdH1cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNsb3NlUmVtb3RlKCk6IHZvaWQge1xuXHRcdHRoaXMucGFzc2luZy5lbmQoKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBkcmFpbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnBhc3NpbmcuZHJhaW4/LigpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7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
