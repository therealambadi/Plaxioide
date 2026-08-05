import { createServer } from "net";
import { ExtensionHostDebugBroadcastChannel } from "../common/extensionHostDebugIpc.js";
import { OPTIONS, parseArgs } from "../../environment/node/argv.js";
import { OpenContext } from "../../windows/electron-main/windows.js";
class ElectronExtensionHostDebugBroadcastChannel extends ExtensionHostDebugBroadcastChannel {
  constructor(windowsMainService) {
    super();
    this.windowsMainService = windowsMainService;
  }
  call(ctx, command, arg) {
    if (command === "openExtensionDevelopmentHostWindow") {
      return this.openExtensionDevelopmentHostWindow(arg[0], arg[1]);
    } else {
      return super.call(ctx, command, arg);
    }
  }
  async openExtensionDevelopmentHostWindow(args, debugRenderer) {
    const pargs = parseArgs(args, OPTIONS);
    pargs.debugRenderer = debugRenderer;
    const extDevPaths = pargs.extensionDevelopmentPath;
    if (!extDevPaths) {
      return { success: false };
    }
    const [codeWindow] = await this.windowsMainService.openExtensionDevelopmentHostWindow(extDevPaths, {
      context: OpenContext.API,
      cli: pargs,
      forceProfile: pargs.profile,
      forceTempProfile: pargs["profile-temp"]
    });
    if (!debugRenderer) {
      return { success: true };
    }
    const win = codeWindow.win;
    if (!win) {
      return { success: true };
    }
    const debug = win.webContents.debugger;
    let listeners = debug.isAttached() ? Infinity : 0;
    const server = createServer((listener) => {
      if (listeners++ === 0) {
        debug.attach();
      }
      let closed = false;
      const writeMessage = (message) => {
        if (!closed) {
          listener.write(JSON.stringify(message) + "\0");
        }
      };
      const onMessage = (_event, method, params, sessionId) => writeMessage({ method, params, sessionId });
      win.on("close", () => {
        debug.removeListener("message", onMessage);
        listener.end();
        closed = true;
      });
      debug.addListener("message", onMessage);
      let buf = Buffer.alloc(0);
      listener.on("data", (data) => {
        buf = Buffer.concat([buf, data]);
        for (let delimiter = buf.indexOf(0); delimiter !== -1; delimiter = buf.indexOf(0)) {
          let data2;
          try {
            const contents = buf.slice(0, delimiter).toString("utf8");
            buf = buf.slice(delimiter + 1);
            data2 = JSON.parse(contents);
          } catch (e) {
            console.error("error reading cdp line", e);
          }
          debug.sendCommand(data2.method, data2.params, data2.sessionId).then((result) => writeMessage({ id: data2.id, sessionId: data2.sessionId, result })).catch((error) => writeMessage({ id: data2.id, sessionId: data2.sessionId, error: { code: 0, message: error.message } }));
        }
      });
      listener.on("error", (err) => {
        console.error("error on cdp pipe:", err);
      });
      listener.on("close", () => {
        closed = true;
        if (--listeners === 0) {
          debug.detach();
        }
      });
    });
    await new Promise((r) => server.listen(0, r));
    win.on("close", () => server.close());
    return { rendererDebugPort: server.address().port, success: true };
  }
}
export {
  ElectronExtensionHostDebugBroadcastChannel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9kZWJ1Zy9lbGVjdHJvbi1tYWluL2V4dGVuc2lvbkhvc3REZWJ1Z0lwYy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFkZHJlc3NJbmZvLCBjcmVhdGVTZXJ2ZXIgfSBmcm9tICduZXQnO1xuaW1wb3J0IHsgSU9wZW5FeHRlbnNpb25XaW5kb3dSZXN1bHQgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uSG9zdERlYnVnLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3REZWJ1Z0Jyb2FkY2FzdENoYW5uZWwgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uSG9zdERlYnVnSXBjLmpzJztcbmltcG9ydCB7IE9QVElPTlMsIHBhcnNlQXJncyB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L25vZGUvYXJndi5qcyc7XG5pbXBvcnQgeyBJV2luZG93c01haW5TZXJ2aWNlLCBPcGVuQ29udGV4dCB9IGZyb20gJy4uLy4uL3dpbmRvd3MvZWxlY3Ryb24tbWFpbi93aW5kb3dzLmpzJztcblxuZXhwb3J0IGNsYXNzIEVsZWN0cm9uRXh0ZW5zaW9uSG9zdERlYnVnQnJvYWRjYXN0Q2hhbm5lbDxUQ29udGV4dD4gZXh0ZW5kcyBFeHRlbnNpb25Ib3N0RGVidWdCcm9hZGNhc3RDaGFubmVsPFRDb250ZXh0PiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB3aW5kb3dzTWFpblNlcnZpY2U6IElXaW5kb3dzTWFpblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGNhbGwoY3R4OiBUQ29udGV4dCwgY29tbWFuZDogc3RyaW5nLCBhcmc/OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuXHRcdGlmIChjb21tYW5kID09PSAnb3BlbkV4dGVuc2lvbkRldmVsb3BtZW50SG9zdFdpbmRvdycpIHtcblx0XHRcdHJldHVybiB0aGlzLm9wZW5FeHRlbnNpb25EZXZlbG9wbWVudEhvc3RXaW5kb3coYXJnWzBdLCBhcmdbMV0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gc3VwZXIuY2FsbChjdHgsIGNvbW1hbmQsIGFyZyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuRXh0ZW5zaW9uRGV2ZWxvcG1lbnRIb3N0V2luZG93KGFyZ3M6IHN0cmluZ1tdLCBkZWJ1Z1JlbmRlcmVyOiBib29sZWFuKTogUHJvbWlzZTxJT3BlbkV4dGVuc2lvbldpbmRvd1Jlc3VsdD4ge1xuXHRcdGNvbnN0IHBhcmdzID0gcGFyc2VBcmdzKGFyZ3MsIE9QVElPTlMpO1xuXHRcdHBhcmdzLmRlYnVnUmVuZGVyZXIgPSBkZWJ1Z1JlbmRlcmVyO1xuXG5cdFx0Y29uc3QgZXh0RGV2UGF0aHMgPSBwYXJncy5leHRlbnNpb25EZXZlbG9wbWVudFBhdGg7XG5cdFx0aWYgKCFleHREZXZQYXRocykge1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcblx0XHR9XG5cblx0XHRjb25zdCBbY29kZVdpbmRvd10gPSBhd2FpdCB0aGlzLndpbmRvd3NNYWluU2VydmljZS5vcGVuRXh0ZW5zaW9uRGV2ZWxvcG1lbnRIb3N0V2luZG93KGV4dERldlBhdGhzLCB7XG5cdFx0XHRjb250ZXh0OiBPcGVuQ29udGV4dC5BUEksXG5cdFx0XHRjbGk6IHBhcmdzLFxuXHRcdFx0Zm9yY2VQcm9maWxlOiBwYXJncy5wcm9maWxlLFxuXHRcdFx0Zm9yY2VUZW1wUHJvZmlsZTogcGFyZ3NbJ3Byb2ZpbGUtdGVtcCddXG5cdFx0fSk7XG5cblx0XHRpZiAoIWRlYnVnUmVuZGVyZXIpIHtcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcblx0XHR9XG5cblx0XHRjb25zdCB3aW4gPSBjb2RlV2luZG93Lndpbjtcblx0XHRpZiAoIXdpbikge1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlYnVnID0gd2luLndlYkNvbnRlbnRzLmRlYnVnZ2VyO1xuXG5cdFx0bGV0IGxpc3RlbmVycyA9IGRlYnVnLmlzQXR0YWNoZWQoKSA/IEluZmluaXR5IDogMDtcblx0XHRjb25zdCBzZXJ2ZXIgPSBjcmVhdGVTZXJ2ZXIobGlzdGVuZXIgPT4ge1xuXHRcdFx0aWYgKGxpc3RlbmVycysrID09PSAwKSB7XG5cdFx0XHRcdGRlYnVnLmF0dGFjaCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgY2xvc2VkID0gZmFsc2U7XG5cdFx0XHRjb25zdCB3cml0ZU1lc3NhZ2UgPSAobWVzc2FnZTogb2JqZWN0KSA9PiB7XG5cdFx0XHRcdGlmICghY2xvc2VkKSB7IC8vIGluIGNhc2Ugc2VuZENvbW1hbmQgcHJvbWlzZXMgc2V0dGxlIGFmdGVyIGNsb3NlZFxuXHRcdFx0XHRcdGxpc3RlbmVyLndyaXRlKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpICsgJ1xcMCcpOyAvLyBudWxsLWRlbGltaXRlZCwgQ0RQLWNvbXBhdGlibGVcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3Qgb25NZXNzYWdlID0gKF9ldmVudDogRWxlY3Ryb24uRXZlbnQsIG1ldGhvZDogc3RyaW5nLCBwYXJhbXM6IHVua25vd24sIHNlc3Npb25JZD86IHN0cmluZykgPT5cblx0XHRcdFx0d3JpdGVNZXNzYWdlKCh7IG1ldGhvZCwgcGFyYW1zLCBzZXNzaW9uSWQgfSkpO1xuXG5cdFx0XHR3aW4ub24oJ2Nsb3NlJywgKCkgPT4ge1xuXHRcdFx0XHRkZWJ1Zy5yZW1vdmVMaXN0ZW5lcignbWVzc2FnZScsIG9uTWVzc2FnZSk7XG5cdFx0XHRcdGxpc3RlbmVyLmVuZCgpO1xuXHRcdFx0XHRjbG9zZWQgPSB0cnVlO1xuXHRcdFx0fSk7XG5cblx0XHRcdGRlYnVnLmFkZExpc3RlbmVyKCdtZXNzYWdlJywgb25NZXNzYWdlKTtcblxuXHRcdFx0bGV0IGJ1ZiA9IEJ1ZmZlci5hbGxvYygwKTtcblx0XHRcdGxpc3RlbmVyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRcdGJ1ZiA9IEJ1ZmZlci5jb25jYXQoW2J1ZiwgZGF0YV0pO1xuXHRcdFx0XHRmb3IgKGxldCBkZWxpbWl0ZXIgPSBidWYuaW5kZXhPZigwKTsgZGVsaW1pdGVyICE9PSAtMTsgZGVsaW1pdGVyID0gYnVmLmluZGV4T2YoMCkpIHtcblx0XHRcdFx0XHRsZXQgZGF0YTogeyBpZDogbnVtYmVyOyBzZXNzaW9uSWQ6IHN0cmluZzsgcGFyYW1zOiB7fSB9O1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250ZW50cyA9IGJ1Zi5zbGljZSgwLCBkZWxpbWl0ZXIpLnRvU3RyaW5nKCd1dGY4Jyk7XG5cdFx0XHRcdFx0XHRidWYgPSBidWYuc2xpY2UoZGVsaW1pdGVyICsgMSk7XG5cdFx0XHRcdFx0XHRkYXRhID0gSlNPTi5wYXJzZShjb250ZW50cyk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcignZXJyb3IgcmVhZGluZyBjZHAgbGluZScsIGUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIGRlcGVuZHMgb24gYSBuZXcgQVBJIGZvciB3aGljaCBlbGVjdHJvbi5kLnRzIGhhcyBub3QgYmVlbiB1cGRhdGVkOlxuXHRcdFx0XHRcdC8vIEB0cy1pZ25vcmVcblx0XHRcdFx0XHRkZWJ1Zy5zZW5kQ29tbWFuZChkYXRhLm1ldGhvZCwgZGF0YS5wYXJhbXMsIGRhdGEuc2Vzc2lvbklkKVxuXHRcdFx0XHRcdFx0LnRoZW4oKHJlc3VsdDogb2JqZWN0KSA9PiB3cml0ZU1lc3NhZ2UoeyBpZDogZGF0YS5pZCwgc2Vzc2lvbklkOiBkYXRhLnNlc3Npb25JZCwgcmVzdWx0IH0pKVxuXHRcdFx0XHRcdFx0LmNhdGNoKChlcnJvcjogRXJyb3IpID0+IHdyaXRlTWVzc2FnZSh7IGlkOiBkYXRhLmlkLCBzZXNzaW9uSWQ6IGRhdGEuc2Vzc2lvbklkLCBlcnJvcjogeyBjb2RlOiAwLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0gfSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0bGlzdGVuZXIub24oJ2Vycm9yJywgZXJyID0+IHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignZXJyb3Igb24gY2RwIHBpcGU6JywgZXJyKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRsaXN0ZW5lci5vbignY2xvc2UnLCAoKSA9PiB7XG5cdFx0XHRcdGNsb3NlZCA9IHRydWU7XG5cdFx0XHRcdGlmICgtLWxpc3RlbmVycyA9PT0gMCkge1xuXHRcdFx0XHRcdGRlYnVnLmRldGFjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4gc2VydmVyLmxpc3RlbigwLCByKSk7XG5cdFx0d2luLm9uKCdjbG9zZScsICgpID0+IHNlcnZlci5jbG9zZSgpKTtcblxuXHRcdHJldHVybiB7IHJlbmRlcmVyRGVidWdQb3J0OiAoc2VydmVyLmFkZHJlc3MoKSBhcyBBZGRyZXNzSW5mbykucG9ydCwgc3VjY2VzczogdHJ1ZSB9O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFzQixvQkFBb0I7QUFFMUMsU0FBUyww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
