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
import { createRandomIPCHandle } from "../../../base/parts/ipc/node/ipc.net.js";
import * as http from "http";
import * as fs from "fs";
import { IExtHostCommands } from "../common/extHostCommands.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { hasWorkspaceFileExtension } from "../../../platform/workspace/common/workspace.js";
class CLIServerBase {
  constructor(_commands, logService, _ipcHandlePath) {
    this._commands = _commands;
    this.logService = logService;
    this._ipcHandlePath = _ipcHandlePath;
    this._server = http.createServer((req, res) => this.onRequest(req, res));
    this.setup().catch((err) => {
      logService.error(err);
      return "";
    });
  }
  get ipcHandlePath() {
    return this._ipcHandlePath;
  }
  async setup() {
    try {
      this._server.listen(this.ipcHandlePath);
      this._server.on("error", (err) => this.logService.error(err));
    } catch (err) {
      this.logService.error("Could not start open from terminal server.");
    }
    return this._ipcHandlePath;
  }
  onRequest(req, res) {
    const sendResponse = (statusCode, returnObj) => {
      res.writeHead(statusCode, { "content-type": "application/json" });
      res.end(JSON.stringify(returnObj || null), (err) => err && this.logService.error(err));
    };
    const chunks = [];
    req.setEncoding("utf8");
    req.on("data", (d) => chunks.push(d));
    req.on("end", async () => {
      try {
        const data = JSON.parse(chunks.join(""));
        let returnObj;
        switch (data.type) {
          case "open":
            returnObj = await this.open(data);
            break;
          case "openExternal":
            returnObj = await this.openExternal(data);
            break;
          case "status":
            returnObj = await this.getStatus(data);
            break;
          case "extensionManagement":
            returnObj = await this.manageExtensions(data);
            break;
          default:
            sendResponse(404, `Unknown message type: ${data.type}`);
            break;
        }
        sendResponse(200, returnObj);
      } catch (e) {
        const message = e instanceof Error ? e.message : JSON.stringify(e);
        sendResponse(500, message);
        this.logService.error("Error while processing pipe request", e);
      }
    });
  }
  async open(data) {
    const { fileURIs, folderURIs, forceNewWindow, diffMode, mergeMode, addMode, removeMode, forceReuseWindow, gotoLineMode, waitMarkerFilePath, remoteAuthority } = data;
    const urisToOpen = [];
    if (Array.isArray(folderURIs)) {
      for (const s of folderURIs) {
        try {
          urisToOpen.push({ folderUri: URI.parse(s) });
        } catch (e) {
        }
      }
    }
    if (Array.isArray(fileURIs)) {
      for (const s of fileURIs) {
        try {
          if (hasWorkspaceFileExtension(s)) {
            urisToOpen.push({ workspaceUri: URI.parse(s) });
          } else {
            urisToOpen.push({ fileUri: URI.parse(s) });
          }
        } catch (e) {
        }
      }
    }
    const waitMarkerFileURI = waitMarkerFilePath ? URI.file(waitMarkerFilePath) : void 0;
    const preferNewWindow = !forceReuseWindow && !waitMarkerFileURI && !addMode && !removeMode;
    const windowOpenArgs = { forceNewWindow, diffMode, mergeMode, addMode, removeMode, gotoLineMode, forceReuseWindow, preferNewWindow, waitMarkerFileURI, remoteAuthority };
    this._commands.executeCommand("_remoteCLI.windowOpen", urisToOpen, windowOpenArgs);
  }
  async openExternal(data) {
    for (const uriString of data.uris) {
      const uri = URI.parse(uriString);
      const urioOpen = uri.scheme === "file" ? uri : uriString;
      await this._commands.executeCommand("_remoteCLI.openExternal", urioOpen);
    }
  }
  async manageExtensions(data) {
    const toExtOrVSIX = (inputs) => inputs?.map((input) => /\.vsix$/i.test(input) ? URI.parse(input) : input);
    const commandArgs = {
      list: data.list,
      install: toExtOrVSIX(data.install),
      uninstall: toExtOrVSIX(data.uninstall),
      force: data.force
    };
    return await this._commands.executeCommand("_remoteCLI.manageExtensions", commandArgs);
  }
  async getStatus(data) {
    return await this._commands.executeCommand("_remoteCLI.getSystemStatus");
  }
  dispose() {
    this._server.close();
    if (this._ipcHandlePath && process.platform !== "win32" && fs.existsSync(this._ipcHandlePath)) {
      fs.unlinkSync(this._ipcHandlePath);
    }
  }
}
let CLIServer = class extends CLIServerBase {
  constructor(commands, logService) {
    super(commands, logService, createRandomIPCHandle());
  }
};
CLIServer = __decorateClass([
  __decorateParam(0, IExtHostCommands),
  __decorateParam(1, ILogService)
], CLIServer);
export {
  CLIServer,
  CLIServerBase
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL25vZGUvZXh0SG9zdENMSVNlcnZlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGNyZWF0ZVJhbmRvbUlQQ0hhbmRsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL25vZGUvaXBjLm5ldC5qcyc7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgSUV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSVdpbmRvd09wZW5hYmxlLCBJT3BlbldpbmRvd09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS93aW5kb3cvY29tbW9uL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBoYXNXb3Jrc3BhY2VGaWxlRXh0ZW5zaW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9wZW5Db21tYW5kUGlwZUFyZ3Mge1xuXHR0eXBlOiAnb3Blbic7XG5cdGZpbGVVUklzPzogc3RyaW5nW107XG5cdGZvbGRlclVSSXM/OiBzdHJpbmdbXTtcblx0Zm9yY2VOZXdXaW5kb3c/OiBib29sZWFuO1xuXHRkaWZmTW9kZT86IGJvb2xlYW47XG5cdG1lcmdlTW9kZT86IGJvb2xlYW47XG5cdGFkZE1vZGU/OiBib29sZWFuO1xuXHRyZW1vdmVNb2RlPzogYm9vbGVhbjtcblx0Z290b0xpbmVNb2RlPzogYm9vbGVhbjtcblx0Zm9yY2VSZXVzZVdpbmRvdz86IGJvb2xlYW47XG5cdHdhaXRNYXJrZXJGaWxlUGF0aD86IHN0cmluZztcblx0cmVtb3RlQXV0aG9yaXR5Pzogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPcGVuRXh0ZXJuYWxDb21tYW5kUGlwZUFyZ3Mge1xuXHR0eXBlOiAnb3BlbkV4dGVybmFsJztcblx0dXJpczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdHVzUGlwZUFyZ3Mge1xuXHR0eXBlOiAnc3RhdHVzJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHRlbnNpb25NYW5hZ2VtZW50UGlwZUFyZ3Mge1xuXHR0eXBlOiAnZXh0ZW5zaW9uTWFuYWdlbWVudCc7XG5cdGxpc3Q/OiB7IHNob3dWZXJzaW9ucz86IGJvb2xlYW47IGNhdGVnb3J5Pzogc3RyaW5nIH07XG5cdGluc3RhbGw/OiBzdHJpbmdbXTtcblx0dW5pbnN0YWxsPzogc3RyaW5nW107XG5cdGZvcmNlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgUGlwZUNvbW1hbmQgPSBPcGVuQ29tbWFuZFBpcGVBcmdzIHwgU3RhdHVzUGlwZUFyZ3MgfCBPcGVuRXh0ZXJuYWxDb21tYW5kUGlwZUFyZ3MgfCBFeHRlbnNpb25NYW5hZ2VtZW50UGlwZUFyZ3M7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbW1hbmRzRXhlY3V0ZXIge1xuXHRleGVjdXRlQ29tbWFuZDxUPihpZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8VD47XG59XG5cbmV4cG9ydCBjbGFzcyBDTElTZXJ2ZXJCYXNlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfc2VydmVyOiBodHRwLlNlcnZlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kczogSUNvbW1hbmRzRXhlY3V0ZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pcGNIYW5kbGVQYXRoOiBzdHJpbmcsXG5cdCkge1xuXHRcdHRoaXMuX3NlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKChyZXEsIHJlcykgPT4gdGhpcy5vblJlcXVlc3QocmVxLCByZXMpKTtcblx0XHR0aGlzLnNldHVwKCkuY2F0Y2goZXJyID0+IHtcblx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHRcdHJldHVybiAnJztcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaXBjSGFuZGxlUGF0aCgpIHtcblx0XHRyZXR1cm4gdGhpcy5faXBjSGFuZGxlUGF0aDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2V0dXAoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fc2VydmVyLmxpc3Rlbih0aGlzLmlwY0hhbmRsZVBhdGgpO1xuXHRcdFx0dGhpcy5fc2VydmVyLm9uKCdlcnJvcicsIGVyciA9PiB0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyKSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0NvdWxkIG5vdCBzdGFydCBvcGVuIGZyb20gdGVybWluYWwgc2VydmVyLicpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9pcGNIYW5kbGVQYXRoO1xuXHR9XG5cblx0cHJpdmF0ZSBvblJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VuZFJlc3BvbnNlID0gKHN0YXR1c0NvZGU6IG51bWJlciwgcmV0dXJuT2JqOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdHJlcy53cml0ZUhlYWQoc3RhdHVzQ29kZSwgeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuXHRcdFx0cmVzLmVuZChKU09OLnN0cmluZ2lmeShyZXR1cm5PYmogfHwgbnVsbCksIChlcnI/OiBhbnkpID0+IGVyciAmJiB0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyKSk7IC8vIENvZGVRTCBbU00wMTUyNF0gT25seSB0aGUgbWVzc2FnZSBwb3J0aW9uIG9mIGVycm9ycyBhcmUgcGFzc2VkIGluLlxuXHRcdH07XG5cblx0XHRjb25zdCBjaHVua3M6IHN0cmluZ1tdID0gW107XG5cdFx0cmVxLnNldEVuY29kaW5nKCd1dGY4Jyk7XG5cdFx0cmVxLm9uKCdkYXRhJywgKGQ6IHN0cmluZykgPT4gY2h1bmtzLnB1c2goZCkpO1xuXHRcdHJlcS5vbignZW5kJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgZGF0YTogUGlwZUNvbW1hbmQgfCBhbnkgPSBKU09OLnBhcnNlKGNodW5rcy5qb2luKCcnKSk7XG5cdFx0XHRcdGxldCByZXR1cm5PYmo6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdFx0c3dpdGNoIChkYXRhLnR5cGUpIHtcblx0XHRcdFx0XHRjYXNlICdvcGVuJzpcblx0XHRcdFx0XHRcdHJldHVybk9iaiA9IGF3YWl0IHRoaXMub3BlbihkYXRhKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ29wZW5FeHRlcm5hbCc6XG5cdFx0XHRcdFx0XHRyZXR1cm5PYmogPSBhd2FpdCB0aGlzLm9wZW5FeHRlcm5hbChkYXRhKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ3N0YXR1cyc6XG5cdFx0XHRcdFx0XHRyZXR1cm5PYmogPSBhd2FpdCB0aGlzLmdldFN0YXR1cyhkYXRhKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ2V4dGVuc2lvbk1hbmFnZW1lbnQnOlxuXHRcdFx0XHRcdFx0cmV0dXJuT2JqID0gYXdhaXQgdGhpcy5tYW5hZ2VFeHRlbnNpb25zKGRhdGEpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdHNlbmRSZXNwb25zZSg0MDQsIGBVbmtub3duIG1lc3NhZ2UgdHlwZTogJHtkYXRhLnR5cGV9YCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRzZW5kUmVzcG9uc2UoMjAwLCByZXR1cm5PYmopO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogSlNPTi5zdHJpbmdpZnkoZSk7XG5cdFx0XHRcdHNlbmRSZXNwb25zZSg1MDAsIG1lc3NhZ2UpO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0Vycm9yIHdoaWxlIHByb2Nlc3NpbmcgcGlwZSByZXF1ZXN0JywgZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW4oZGF0YTogT3BlbkNvbW1hbmRQaXBlQXJncyk6IFByb21pc2U8dW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgeyBmaWxlVVJJcywgZm9sZGVyVVJJcywgZm9yY2VOZXdXaW5kb3csIGRpZmZNb2RlLCBtZXJnZU1vZGUsIGFkZE1vZGUsIHJlbW92ZU1vZGUsIGZvcmNlUmV1c2VXaW5kb3csIGdvdG9MaW5lTW9kZSwgd2FpdE1hcmtlckZpbGVQYXRoLCByZW1vdGVBdXRob3JpdHkgfSA9IGRhdGE7XG5cdFx0Y29uc3QgdXJpc1RvT3BlbjogSVdpbmRvd09wZW5hYmxlW10gPSBbXTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShmb2xkZXJVUklzKSkge1xuXHRcdFx0Zm9yIChjb25zdCBzIG9mIGZvbGRlclVSSXMpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR1cmlzVG9PcGVuLnB1c2goeyBmb2xkZXJVcmk6IFVSSS5wYXJzZShzKSB9KTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChBcnJheS5pc0FycmF5KGZpbGVVUklzKSkge1xuXHRcdFx0Zm9yIChjb25zdCBzIG9mIGZpbGVVUklzKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0aWYgKGhhc1dvcmtzcGFjZUZpbGVFeHRlbnNpb24ocykpIHtcblx0XHRcdFx0XHRcdHVyaXNUb09wZW4ucHVzaCh7IHdvcmtzcGFjZVVyaTogVVJJLnBhcnNlKHMpIH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR1cmlzVG9PcGVuLnB1c2goeyBmaWxlVXJpOiBVUkkucGFyc2UocykgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0Ly8gaWdub3JlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgd2FpdE1hcmtlckZpbGVVUkkgPSB3YWl0TWFya2VyRmlsZVBhdGggPyBVUkkuZmlsZSh3YWl0TWFya2VyRmlsZVBhdGgpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHByZWZlck5ld1dpbmRvdyA9ICFmb3JjZVJldXNlV2luZG93ICYmICF3YWl0TWFya2VyRmlsZVVSSSAmJiAhYWRkTW9kZSAmJiAhcmVtb3ZlTW9kZTtcblx0XHRjb25zdCB3aW5kb3dPcGVuQXJnczogSU9wZW5XaW5kb3dPcHRpb25zID0geyBmb3JjZU5ld1dpbmRvdywgZGlmZk1vZGUsIG1lcmdlTW9kZSwgYWRkTW9kZSwgcmVtb3ZlTW9kZSwgZ290b0xpbmVNb2RlLCBmb3JjZVJldXNlV2luZG93LCBwcmVmZXJOZXdXaW5kb3csIHdhaXRNYXJrZXJGaWxlVVJJLCByZW1vdGVBdXRob3JpdHkgfTtcblx0XHR0aGlzLl9jb21tYW5kcy5leGVjdXRlQ29tbWFuZCgnX3JlbW90ZUNMSS53aW5kb3dPcGVuJywgdXJpc1RvT3Blbiwgd2luZG93T3BlbkFyZ3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuRXh0ZXJuYWwoZGF0YTogT3BlbkV4dGVybmFsQ29tbWFuZFBpcGVBcmdzKTogUHJvbWlzZTx1bmRlZmluZWQ+IHtcblx0XHRmb3IgKGNvbnN0IHVyaVN0cmluZyBvZiBkYXRhLnVyaXMpIHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSh1cmlTdHJpbmcpO1xuXHRcdFx0Y29uc3QgdXJpb09wZW4gPSB1cmkuc2NoZW1lID09PSAnZmlsZScgPyB1cmkgOiB1cmlTdHJpbmc7IC8vIHdvcmthcm91bmQgZm9yICMxMTI1Nzdcblx0XHRcdGF3YWl0IHRoaXMuX2NvbW1hbmRzLmV4ZWN1dGVDb21tYW5kKCdfcmVtb3RlQ0xJLm9wZW5FeHRlcm5hbCcsIHVyaW9PcGVuKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG1hbmFnZUV4dGVuc2lvbnMoZGF0YTogRXh0ZW5zaW9uTWFuYWdlbWVudFBpcGVBcmdzKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB0b0V4dE9yVlNJWCA9IChpbnB1dHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkKSA9PiBpbnB1dHM/Lm1hcChpbnB1dCA9PiAvXFwudnNpeCQvaS50ZXN0KGlucHV0KSA/IFVSSS5wYXJzZShpbnB1dCkgOiBpbnB1dCk7XG5cdFx0Y29uc3QgY29tbWFuZEFyZ3MgPSB7XG5cdFx0XHRsaXN0OiBkYXRhLmxpc3QsXG5cdFx0XHRpbnN0YWxsOiB0b0V4dE9yVlNJWChkYXRhLmluc3RhbGwpLFxuXHRcdFx0dW5pbnN0YWxsOiB0b0V4dE9yVlNJWChkYXRhLnVuaW5zdGFsbCksXG5cdFx0XHRmb3JjZTogZGF0YS5mb3JjZVxuXHRcdH07XG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuX2NvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHN0cmluZyB8IHVuZGVmaW5lZD4oJ19yZW1vdGVDTEkubWFuYWdlRXh0ZW5zaW9ucycsIGNvbW1hbmRBcmdzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0U3RhdHVzKGRhdGE6IFN0YXR1c1BpcGVBcmdzKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5fY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8c3RyaW5nIHwgdW5kZWZpbmVkPignX3JlbW90ZUNMSS5nZXRTeXN0ZW1TdGF0dXMnKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2VydmVyLmNsb3NlKCk7XG5cblx0XHRpZiAodGhpcy5faXBjSGFuZGxlUGF0aCAmJiBwcm9jZXNzLnBsYXRmb3JtICE9PSAnd2luMzInICYmIGZzLmV4aXN0c1N5bmModGhpcy5faXBjSGFuZGxlUGF0aCkpIHtcblx0XHRcdGZzLnVubGlua1N5bmModGhpcy5faXBjSGFuZGxlUGF0aCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDTElTZXJ2ZXIgZXh0ZW5kcyBDTElTZXJ2ZXJCYXNlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRIb3N0Q29tbWFuZHMgY29tbWFuZHM6IElFeHRIb3N0Q29tbWFuZHMsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGNvbW1hbmRzLCBsb2dTZXJ2aWNlLCBjcmVhdGVSYW5kb21JUENIYW5kbGUoKSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyw2QkFBNkI7QUFDdEMsWUFBWSxVQUFVO0FBQ3RCLFlBQVksUUFBUTtBQUNwQixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxpQ0FBaUM7QUF3Q25DLE1BQU0sY0FBYztBQUFBLEVBRzFCLFlBQ2tCLFdBQ0EsWUFDQSxnQkFDaEI7QUFIZ0I7QUFDQTtBQUNBO0FBRWpCLFNBQUssVUFBVSxLQUFLLGFBQWEsQ0FBQyxLQUFLLFFBQVEsS0FBSyxVQUFVLEtBQUssR0FBRyxDQUFDO0FBQ3ZFLFNBQUssTUFBTSxFQUFFLE1BQU0sU0FBTztBQUN6QixpQkFBVyxNQUFNLEdBQUc7QUFDcEIsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLElBQVcsZ0JBQWdCO0FBQzFCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLE1BQWMsUUFBeUI7QUFDdEMsUUFBSTtBQUNILFdBQUssUUFBUSxPQUFPLEtBQUssYUFBYTtBQUN0QyxXQUFLLFFBQVEsR0FBRyxTQUFTLFNBQU8sS0FBSyxXQUFXLE1BQU0sR0FBRyxDQUFDO0FBQUEsSUFDM0QsU0FBUyxLQUFLO0FBQ2IsV0FBSyxXQUFXLE1BQU0sNENBQTRDO0FBQUEsSUFDbkU7QUFFQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFUSxVQUFVLEtBQTJCLEtBQWdDO0FBQzVFLFVBQU0sZUFBZSxDQUFDLFlBQW9CLGNBQWtDO0FBQzNFLFVBQUksVUFBVSxZQUFZLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ2hFLFVBQUksSUFBSSxLQUFLLFVBQVUsYUFBYSxJQUFJLEdBQUcsQ0FBQyxRQUFjLE9BQU8sS0FBSyxXQUFXLE1BQU0sR0FBRyxDQUFDO0FBQUEsSUFDNUY7QUFFQSxVQUFNLFNBQW1CLENBQUM7QUFDMUIsUUFBSSxZQUFZLE1BQU07QUFDdEIsUUFBSSxHQUFHLFFBQVEsQ0FBQyxNQUFjLE9BQU8sS0FBSyxDQUFDLENBQUM7QUFDNUMsUUFBSSxHQUFHLE9BQU8sWUFBWTtBQUN6QixVQUFJO0FBQ0gsY0FBTSxPQUEwQixLQUFLLE1BQU0sT0FBTyxLQUFLLEVBQUUsQ0FBQztBQUMxRCxZQUFJO0FBQ0osZ0JBQVEsS0FBSyxNQUFNO0FBQUEsVUFDbEIsS0FBSztBQUNKLHdCQUFZLE1BQU0sS0FBSyxLQUFLLElBQUk7QUFDaEM7QUFBQSxVQUNELEtBQUs7QUFDSix3QkFBWSxNQUFNLEtBQUssYUFBYSxJQUFJO0FBQ3hDO0FBQUEsVUFDRCxLQUFLO0FBQ0osd0JBQVksTUFBTSxLQUFLLFVBQVUsSUFBSTtBQUNyQztBQUFBLFVBQ0QsS0FBSztBQUNKLHdCQUFZLE1BQU0sS0FBSyxpQkFBaUIsSUFBSTtBQUM1QztBQUFBLFVBQ0Q7QUFDQyx5QkFBYSxLQUFLLHlCQUF5QixLQUFLLElBQUksRUFBRTtBQUN0RDtBQUFBLFFBQ0Y7QUFDQSxxQkFBYSxLQUFLLFNBQVM7QUFBQSxNQUM1QixTQUFTLEdBQUc7QUFDWCxjQUFNLFVBQVUsYUFBYSxRQUFRLEVBQUUsVUFBVSxLQUFLLFVBQVUsQ0FBQztBQUNqRSxxQkFBYSxLQUFLLE9BQU87QUFDekIsYUFBSyxXQUFXLE1BQU0sdUNBQXVDLENBQUM7QUFBQSxNQUMvRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsS0FBSyxNQUErQztBQUNqRSxVQUFNLEVBQUUsVUFBVSxZQUFZLGdCQUFnQixVQUFVLFdBQVcsU0FBUyxZQUFZLGtCQUFrQixjQUFjLG9CQUFvQixnQkFBZ0IsSUFBSTtBQUNoSyxVQUFNLGFBQWdDLENBQUM7QUFDdkMsUUFBSSxNQUFNLFFBQVEsVUFBVSxHQUFHO0FBQzlCLGlCQUFXLEtBQUssWUFBWTtBQUMzQixZQUFJO0FBQ0gscUJBQVcsS0FBSyxFQUFFLFdBQVcsSUFBSSxNQUFNLENBQUMsRUFBRSxDQUFDO0FBQUEsUUFDNUMsU0FBUyxHQUFHO0FBQUEsUUFFWjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsUUFBSSxNQUFNLFFBQVEsUUFBUSxHQUFHO0FBQzVCLGlCQUFXLEtBQUssVUFBVTtBQUN6QixZQUFJO0FBQ0gsY0FBSSwwQkFBMEIsQ0FBQyxHQUFHO0FBQ2pDLHVCQUFXLEtBQUssRUFBRSxjQUFjLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQztBQUFBLFVBQy9DLE9BQU87QUFDTix1QkFBVyxLQUFLLEVBQUUsU0FBUyxJQUFJLE1BQU0sQ0FBQyxFQUFFLENBQUM7QUFBQSxVQUMxQztBQUFBLFFBQ0QsU0FBUyxHQUFHO0FBQUEsUUFFWjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsVUFBTSxvQkFBb0IscUJBQXFCLElBQUksS0FBSyxrQkFBa0IsSUFBSTtBQUM5RSxVQUFNLGtCQUFrQixDQUFDLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQztBQUNoRixVQUFNLGlCQUFxQyxFQUFFLGdCQUFnQixVQUFVLFdBQVcsU0FBUyxZQUFZLGNBQWMsa0JBQWtCLGlCQUFpQixtQkFBbUIsZ0JBQWdCO0FBQzNMLFNBQUssVUFBVSxlQUFlLHlCQUF5QixZQUFZLGNBQWM7QUFBQSxFQUNsRjtBQUFBLEVBRUEsTUFBYyxhQUFhLE1BQXVEO0FBQ2pGLGVBQVcsYUFBYSxLQUFLLE1BQU07QUFDbEMsWUFBTSxNQUFNLElBQUksTUFBTSxTQUFTO0FBQy9CLFlBQU0sV0FBVyxJQUFJLFdBQVcsU0FBUyxNQUFNO0FBQy9DLFlBQU0sS0FBSyxVQUFVLGVBQWUsMkJBQTJCLFFBQVE7QUFBQSxJQUN4RTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsaUJBQWlCLE1BQWdFO0FBQzlGLFVBQU0sY0FBYyxDQUFDLFdBQWlDLFFBQVEsSUFBSSxXQUFTLFdBQVcsS0FBSyxLQUFLLElBQUksSUFBSSxNQUFNLEtBQUssSUFBSSxLQUFLO0FBQzVILFVBQU0sY0FBYztBQUFBLE1BQ25CLE1BQU0sS0FBSztBQUFBLE1BQ1gsU0FBUyxZQUFZLEtBQUssT0FBTztBQUFBLE1BQ2pDLFdBQVcsWUFBWSxLQUFLLFNBQVM7QUFBQSxNQUNyQyxPQUFPLEtBQUs7QUFBQSxJQUNiO0FBQ0EsV0FBTyxNQUFNLEtBQUssVUFBVSxlQUFtQywrQkFBK0IsV0FBVztBQUFBLEVBQzFHO0FBQUEsRUFFQSxNQUFjLFVBQVUsTUFBbUQ7QUFDMUUsV0FBTyxNQUFNLEtBQUssVUFBVSxlQUFtQyw0QkFBNEI7QUFBQSxFQUM1RjtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLFFBQVEsTUFBTTtBQUVuQixRQUFJLEtBQUssa0JBQWtCLFFBQVEsYUFBYSxXQUFXLEdBQUcsV0FBVyxLQUFLLGNBQWMsR0FBRztBQUM5RixTQUFHLFdBQVcsS0FBSyxjQUFjO0FBQUEsSUFDbEM7QUFBQSxFQUNEO0FBQ0Q7QUFFTyxJQUFNLFlBQU4sY0FBd0IsY0FBYztBQUFBLEVBQzVDLFlBQ21CLFVBQ0wsWUFDWjtBQUNELFVBQU0sVUFBVSxZQUFZLHNCQUFzQixDQUFDO0FBQUEsRUFDcEQ7QUFDRDtBQVBhLFlBQU47QUFBQSxFQUVKO0FBQUEsRUFDQTtBQUFBLEdBSFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
