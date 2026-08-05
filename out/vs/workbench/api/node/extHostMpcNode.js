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
import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { parseEnvFile } from "../../../base/common/envfile.js";
import { URI } from "../../../base/common/uri.js";
import { StreamSplitter } from "../../../base/node/nodeStreams.js";
import { LogLevel } from "../../../platform/log/common/log.js";
import { McpConnectionState, McpServerTransportType } from "../../contrib/mcp/common/mcpTypes.js";
import { ExtHostMcpService } from "../common/extHostMcp.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
import { findExecutable } from "../../../base/node/processes.js";
let NodeExtHostMpcService = class extends ExtHostMcpService {
  constructor(extHostRpc) {
    super(extHostRpc);
    this.nodeServers = /* @__PURE__ */ new Map();
  }
  _startMcp(id, launch) {
    if (launch.type === McpServerTransportType.Stdio) {
      this.startNodeMpc(id, launch);
    } else {
      super._startMcp(id, launch);
    }
  }
  $stopMcp(id) {
    const nodeServer = this.nodeServers.get(id);
    if (nodeServer) {
      nodeServer.abortCtrl.abort();
      this.nodeServers.delete(id);
    } else {
      super.$stopMcp(id);
    }
  }
  $sendMessage(id, message) {
    const nodeServer = this.nodeServers.get(id);
    if (nodeServer) {
      nodeServer.child.stdin.write(message + "\n");
    } else {
      super.$sendMessage(id, message);
    }
  }
  async startNodeMpc(id, launch) {
    const onError = (err) => this._proxy.$onDidChangeState(id, {
      state: McpConnectionState.Kind.Error,
      message: typeof err === "string" ? err : err.message
    });
    const env = { ...process.env };
    if (launch.envFile) {
      try {
        for (const [key, value] of parseEnvFile(await readFile(launch.envFile, "utf-8"))) {
          env[key] = value;
        }
      } catch (e) {
        onError(`Failed to read envFile '${launch.envFile}': ${e.message}`);
        return;
      }
    }
    for (const [key, value] of Object.entries(launch.env)) {
      env[key] = value === null ? void 0 : String(value);
    }
    const abortCtrl = new AbortController();
    let child;
    try {
      const cwd = launch.cwd ? URI.revive(launch.cwd).fsPath : homedir();
      const { executable, args, shell } = await formatSubprocessArguments(launch.command, launch.args, cwd, env);
      this._proxy.$onDidPublishLog(id, LogLevel.Debug, `Server command line: ${executable} ${args.join(" ")}`);
      child = spawn(executable, args, {
        stdio: "pipe",
        cwd: launch.cwd ? URI.revive(launch.cwd).fsPath : homedir(),
        signal: abortCtrl.signal,
        env,
        shell
      });
    } catch (e) {
      onError(e);
      abortCtrl.abort();
      return;
    }
    this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Starting });
    child.stdout.pipe(new StreamSplitter("\n")).on("data", (line) => this._proxy.$onDidReceiveMessage(id, line.toString()));
    child.stdin.on("error", onError);
    child.stdout.on("error", onError);
    child.stderr.pipe(new StreamSplitter("\n")).on("data", (line) => this._proxy.$onDidPublishLog(id, LogLevel.Warning, `[server stderr] ${line.toString().trimEnd()}`));
    child.on("spawn", () => this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Running }));
    child.on("error", (e) => {
      if (abortCtrl.signal.aborted) {
        this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Stopped });
      } else {
        onError(e);
      }
    });
    child.on(
      "exit",
      (code) => code === 0 || abortCtrl.signal.aborted ? this._proxy.$onDidChangeState(id, { state: McpConnectionState.Kind.Stopped }) : this._proxy.$onDidChangeState(id, {
        state: McpConnectionState.Kind.Error,
        message: `Process exited with code ${code}`
      })
    );
    this.nodeServers.set(id, { abortCtrl, child });
  }
};
NodeExtHostMpcService = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], NodeExtHostMpcService);
const windowsShellScriptRe = /\.(bat|cmd)$/i;
const formatSubprocessArguments = async (executable, args, cwd, env) => {
  if (process.platform !== "win32") {
    return { executable, args, shell: false };
  }
  const found = await findExecutable(executable, cwd, void 0, env);
  if (found && windowsShellScriptRe.test(found)) {
    const quote = (s) => s.includes(" ") ? `"${s}"` : s;
    return {
      executable: quote(found),
      args: args.map(quote),
      shell: true
    };
  }
  return { executable, args, shell: false };
};
export {
  NodeExtHostMpcService,
  formatSubprocessArguments
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL25vZGUvZXh0SG9zdE1wY05vZGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDaGlsZFByb2Nlc3NXaXRob3V0TnVsbFN0cmVhbXMsIHNwYXduIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCB7IGhvbWVkaXIgfSBmcm9tICdvcyc7XG5pbXBvcnQgeyBwYXJzZUVudkZpbGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lbnZmaWxlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBTdHJlYW1TcGxpdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9ub2RlU3RyZWFtcy5qcyc7XG5pbXBvcnQgeyBMb2dMZXZlbCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IE1jcENvbm5lY3Rpb25TdGF0ZSwgTWNwU2VydmVyTGF1bmNoLCBNY3BTZXJ2ZXJUcmFuc3BvcnRTdGRpbywgTWNwU2VydmVyVHJhbnNwb3J0VHlwZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BUeXBlcy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0TWNwU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0TWNwLmpzJztcbmltcG9ydCB7IElFeHRIb3N0UnBjU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0UnBjU2VydmljZS5qcyc7XG5pbXBvcnQgeyBmaW5kRXhlY3V0YWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9wcm9jZXNzZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgTm9kZUV4dEhvc3RNcGNTZXJ2aWNlIGV4dGVuZHMgRXh0SG9zdE1jcFNlcnZpY2Uge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dEhvc3RScGNTZXJ2aWNlIGV4dEhvc3RScGM6IElFeHRIb3N0UnBjU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoZXh0SG9zdFJwYyk7XG5cdH1cblxuXHRwcml2YXRlIG5vZGVTZXJ2ZXJzID0gbmV3IE1hcDxudW1iZXIsIHtcblx0XHRhYm9ydEN0cmw6IEFib3J0Q29udHJvbGxlcjtcblx0XHRjaGlsZDogQ2hpbGRQcm9jZXNzV2l0aG91dE51bGxTdHJlYW1zO1xuXHR9PigpO1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfc3RhcnRNY3AoaWQ6IG51bWJlciwgbGF1bmNoOiBNY3BTZXJ2ZXJMYXVuY2gpOiB2b2lkIHtcblx0XHRpZiAobGF1bmNoLnR5cGUgPT09IE1jcFNlcnZlclRyYW5zcG9ydFR5cGUuU3RkaW8pIHtcblx0XHRcdHRoaXMuc3RhcnROb2RlTXBjKGlkLCBsYXVuY2gpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdXBlci5fc3RhcnRNY3AoaWQsIGxhdW5jaCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgJHN0b3BNY3AoaWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGVTZXJ2ZXIgPSB0aGlzLm5vZGVTZXJ2ZXJzLmdldChpZCk7XG5cdFx0aWYgKG5vZGVTZXJ2ZXIpIHtcblx0XHRcdG5vZGVTZXJ2ZXIuYWJvcnRDdHJsLmFib3J0KCk7XG5cdFx0XHR0aGlzLm5vZGVTZXJ2ZXJzLmRlbGV0ZShpZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN1cGVyLiRzdG9wTWNwKGlkKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSAkc2VuZE1lc3NhZ2UoaWQ6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZVNlcnZlciA9IHRoaXMubm9kZVNlcnZlcnMuZ2V0KGlkKTtcblx0XHRpZiAobm9kZVNlcnZlcikge1xuXHRcdFx0bm9kZVNlcnZlci5jaGlsZC5zdGRpbi53cml0ZShtZXNzYWdlICsgJ1xcbicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdXBlci4kc2VuZE1lc3NhZ2UoaWQsIG1lc3NhZ2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3RhcnROb2RlTXBjKGlkOiBudW1iZXIsIGxhdW5jaDogTWNwU2VydmVyVHJhbnNwb3J0U3RkaW8pIHtcblx0XHRjb25zdCBvbkVycm9yID0gKGVycjogRXJyb3IgfCBzdHJpbmcpID0+IHRoaXMuX3Byb3h5LiRvbkRpZENoYW5nZVN0YXRlKGlkLCB7XG5cdFx0XHRzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuRXJyb3IsXG5cdFx0XHRtZXNzYWdlOiB0eXBlb2YgZXJyID09PSAnc3RyaW5nJyA/IGVyciA6IGVyci5tZXNzYWdlLFxuXHRcdH0pO1xuXG5cdFx0Ly8gTUNQIHNlcnZlcnMgYXJlIHJ1biBvbiB0aGUgc2FtZSBhdXRob3JpdHkgd2hlcmUgdGhleSBhcmUgZGVmaW5lZCwgc29cblx0XHQvLyByZWFkaW5nIHRoZSBlbnZmaWxlIGJhc2VkIG9uIGl0cyBwYXRoIG9mZiB0aGUgZmlsZXN5c3RlbSBoZXJlIGlzIGZpbmUuXG5cdFx0Y29uc3QgZW52ID0geyAuLi5wcm9jZXNzLmVudiB9O1xuXHRcdGlmIChsYXVuY2guZW52RmlsZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgcGFyc2VFbnZGaWxlKGF3YWl0IHJlYWRGaWxlKGxhdW5jaC5lbnZGaWxlLCAndXRmLTgnKSkpIHtcblx0XHRcdFx0XHRlbnZba2V5XSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdG9uRXJyb3IoYEZhaWxlZCB0byByZWFkIGVudkZpbGUgJyR7bGF1bmNoLmVudkZpbGV9JzogJHtlLm1lc3NhZ2V9YCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMobGF1bmNoLmVudikpIHtcblx0XHRcdGVudltrZXldID0gdmFsdWUgPT09IG51bGwgPyB1bmRlZmluZWQgOiBTdHJpbmcodmFsdWUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFib3J0Q3RybCA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblx0XHRsZXQgY2hpbGQ6IENoaWxkUHJvY2Vzc1dpdGhvdXROdWxsU3RyZWFtcztcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY3dkID0gbGF1bmNoLmN3ZCA/IFVSSS5yZXZpdmUobGF1bmNoLmN3ZCkuZnNQYXRoIDogaG9tZWRpcigpO1xuXHRcdFx0Y29uc3QgeyBleGVjdXRhYmxlLCBhcmdzLCBzaGVsbCB9ID0gYXdhaXQgZm9ybWF0U3VicHJvY2Vzc0FyZ3VtZW50cyhsYXVuY2guY29tbWFuZCwgbGF1bmNoLmFyZ3MsIGN3ZCwgZW52KTtcblx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZFB1Ymxpc2hMb2coaWQsIExvZ0xldmVsLkRlYnVnLCBgU2VydmVyIGNvbW1hbmQgbGluZTogJHtleGVjdXRhYmxlfSAke2FyZ3Muam9pbignICcpfWApO1xuXHRcdFx0Y2hpbGQgPSBzcGF3bihleGVjdXRhYmxlLCBhcmdzLCB7XG5cdFx0XHRcdHN0ZGlvOiAncGlwZScsXG5cdFx0XHRcdGN3ZDogbGF1bmNoLmN3ZCA/IFVSSS5yZXZpdmUobGF1bmNoLmN3ZCkuZnNQYXRoIDogaG9tZWRpcigpLFxuXHRcdFx0XHRzaWduYWw6IGFib3J0Q3RybC5zaWduYWwsXG5cdFx0XHRcdGVudixcblx0XHRcdFx0c2hlbGwsXG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRvbkVycm9yKGUpO1xuXHRcdFx0YWJvcnRDdHJsLmFib3J0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJveHkuJG9uRGlkQ2hhbmdlU3RhdGUoaWQsIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlN0YXJ0aW5nIH0pO1xuXG5cdFx0Y2hpbGQuc3Rkb3V0LnBpcGUobmV3IFN0cmVhbVNwbGl0dGVyKCdcXG4nKSkub24oJ2RhdGEnLCBsaW5lID0+IHRoaXMuX3Byb3h5LiRvbkRpZFJlY2VpdmVNZXNzYWdlKGlkLCBsaW5lLnRvU3RyaW5nKCkpKTtcblxuXHRcdGNoaWxkLnN0ZGluLm9uKCdlcnJvcicsIG9uRXJyb3IpO1xuXHRcdGNoaWxkLnN0ZG91dC5vbignZXJyb3InLCBvbkVycm9yKTtcblxuXHRcdC8vIFN0ZGVyciBoYW5kbGluZyBpcyBub3QgY3VycmVudGx5IHNwZWNpZmllZCBodHRwczovL2dpdGh1Yi5jb20vbW9kZWxjb250ZXh0cHJvdG9jb2wvc3BlY2lmaWNhdGlvbi9pc3N1ZXMvMTc3XG5cdFx0Ly8gSnVzdCB0cmVhdCBpdCBhcyBnZW5lcmljIGxvZyBkYXRhIGZvciBub3dcblx0XHRjaGlsZC5zdGRlcnIucGlwZShuZXcgU3RyZWFtU3BsaXR0ZXIoJ1xcbicpKS5vbignZGF0YScsIGxpbmUgPT4gdGhpcy5fcHJveHkuJG9uRGlkUHVibGlzaExvZyhpZCwgTG9nTGV2ZWwuV2FybmluZywgYFtzZXJ2ZXIgc3RkZXJyXSAke2xpbmUudG9TdHJpbmcoKS50cmltRW5kKCl9YCkpO1xuXG5cdFx0Y2hpbGQub24oJ3NwYXduJywgKCkgPT4gdGhpcy5fcHJveHkuJG9uRGlkQ2hhbmdlU3RhdGUoaWQsIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlJ1bm5pbmcgfSkpO1xuXG5cdFx0Y2hpbGQub24oJ2Vycm9yJywgZSA9PiB7XG5cdFx0XHRpZiAoYWJvcnRDdHJsLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZENoYW5nZVN0YXRlKGlkLCB7IHN0YXRlOiBNY3BDb25uZWN0aW9uU3RhdGUuS2luZC5TdG9wcGVkIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b25FcnJvcihlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRjaGlsZC5vbignZXhpdCcsIGNvZGUgPT5cblx0XHRcdGNvZGUgPT09IDAgfHwgYWJvcnRDdHJsLnNpZ25hbC5hYm9ydGVkXG5cdFx0XHRcdD8gdGhpcy5fcHJveHkuJG9uRGlkQ2hhbmdlU3RhdGUoaWQsIHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlN0b3BwZWQgfSlcblx0XHRcdFx0OiB0aGlzLl9wcm94eS4kb25EaWRDaGFuZ2VTdGF0ZShpZCwge1xuXHRcdFx0XHRcdHN0YXRlOiBNY3BDb25uZWN0aW9uU3RhdGUuS2luZC5FcnJvcixcblx0XHRcdFx0XHRtZXNzYWdlOiBgUHJvY2VzcyBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gLFxuXHRcdFx0XHR9KVxuXHRcdCk7XG5cblx0XHR0aGlzLm5vZGVTZXJ2ZXJzLnNldChpZCwgeyBhYm9ydEN0cmwsIGNoaWxkIH0pO1xuXHR9XG59XG5cbmNvbnN0IHdpbmRvd3NTaGVsbFNjcmlwdFJlID0gL1xcLihiYXR8Y21kKSQvaTtcblxuLyoqXG4gKiBGb3JtYXRzIGFyZ3VtZW50cyB0byBhdm9pZCBpc3N1ZXMgb24gV2luZG93cyBmb3IgQ1ZFLTIwMjQtMjc5ODAuXG4gKi9cbmV4cG9ydCBjb25zdCBmb3JtYXRTdWJwcm9jZXNzQXJndW1lbnRzID0gYXN5bmMgKFxuXHRleGVjdXRhYmxlOiBzdHJpbmcsXG5cdGFyZ3M6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPixcblx0Y3dkOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdGVudjogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPixcbikgPT4ge1xuXHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuXHRcdHJldHVybiB7IGV4ZWN1dGFibGUsIGFyZ3MsIHNoZWxsOiBmYWxzZSB9O1xuXHR9XG5cblx0Y29uc3QgZm91bmQgPSBhd2FpdCBmaW5kRXhlY3V0YWJsZShleGVjdXRhYmxlLCBjd2QsIHVuZGVmaW5lZCwgZW52KTtcblx0aWYgKGZvdW5kICYmIHdpbmRvd3NTaGVsbFNjcmlwdFJlLnRlc3QoZm91bmQpKSB7XG5cdFx0Y29uc3QgcXVvdGUgPSAoczogc3RyaW5nKSA9PiBzLmluY2x1ZGVzKCcgJykgPyBgXCIke3N9XCJgIDogcztcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZXhlY3V0YWJsZTogcXVvdGUoZm91bmQpLFxuXHRcdFx0YXJnczogYXJncy5tYXAocXVvdGUpLFxuXHRcdFx0c2hlbGw6IHRydWUsXG5cdFx0fTtcblx0fVxuXG5cdHJldHVybiB7IGV4ZWN1dGFibGUsIGFyZ3MsIHNoZWxsOiBmYWxzZSB9O1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBeUMsYUFBYTtBQUN0RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQThELDhCQUE4QjtBQUNyRyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHNCQUFzQjtBQUV4QixJQUFNLHdCQUFOLGNBQW9DLGtCQUFrQjtBQUFBLEVBQzVELFlBQ3FCLFlBQ25CO0FBQ0QsVUFBTSxVQUFV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
