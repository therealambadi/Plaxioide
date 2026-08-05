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
import * as cp from "child_process";
import { memoize } from "../../../base/common/decorators.js";
import { FileAccess } from "../../../base/common/network.js";
import * as path from "../../../base/common/path.js";
import * as env from "../../../base/common/platform.js";
import { sanitizeProcessEnvironment } from "../../../base/common/processes.js";
import * as pfs from "../../../base/node/pfs.js";
import * as processes from "../../../base/node/processes.js";
import * as nls from "../../../nls.js";
import { DEFAULT_TERMINAL_OSX } from "../common/externalTerminal.js";
const TERMINAL_TITLE = nls.localize("console.title", "VS Code Console");
class ExternalTerminalService {
  async getDefaultTerminalForPlatforms() {
    return {
      windows: WindowsExternalTerminalService.getDefaultTerminalWindows(),
      linux: await LinuxExternalTerminalService.getDefaultTerminalLinuxReady(),
      osx: "xterm"
    };
  }
}
const _WindowsExternalTerminalService = class _WindowsExternalTerminalService extends ExternalTerminalService {
  openTerminal(configuration, cwd) {
    return this.spawnTerminal(cp, configuration, processes.getWindowsShell(), cwd);
  }
  spawnTerminal(spawner, configuration, command, cwd) {
    const exec = configuration.windowsExec || _WindowsExternalTerminalService.getDefaultTerminalWindows();
    if (cwd && cwd[1] === ":") {
      cwd = cwd[0].toUpperCase() + cwd.substr(1);
    }
    const basename = path.basename(exec, ".exe").toLowerCase();
    if (basename === "cmder") {
      spawner.spawn(exec, cwd ? [cwd] : void 0);
      return Promise.resolve(void 0);
    }
    const cmdArgs = ["/c", "start", "/wait"];
    if (exec.indexOf(" ") >= 0) {
      cmdArgs.push(exec);
    }
    cmdArgs.push(exec);
    if (basename === "wt") {
      cmdArgs.push("-d .");
    }
    return new Promise((c, e) => {
      const env2 = getSanitizedEnvironment(process);
      const child = spawner.spawn(command, cmdArgs, { cwd, env: env2, detached: true });
      child.on("error", e);
      child.on("exit", () => c());
    });
  }
  async runInTerminal(title, dir, args, envVars, settings) {
    const exec = "windowsExec" in settings && settings.windowsExec ? settings.windowsExec : _WindowsExternalTerminalService.getDefaultTerminalWindows();
    const wt = await _WindowsExternalTerminalService.getWtExePath();
    return new Promise((resolve, reject) => {
      const title2 = `"${dir} - ${TERMINAL_TITLE}"`;
      const command = `"${args.join('" "')}" & pause`;
      const env2 = Object.assign({}, getSanitizedEnvironment(process), envVars);
      Object.keys(env2).filter((v) => env2[v] === null).forEach((key) => delete env2[key]);
      const options = {
        cwd: dir,
        env: env2,
        windowsVerbatimArguments: true
      };
      let spawnExec;
      let cmdArgs;
      if (path.basename(exec, ".exe") === "wt") {
        spawnExec = exec;
        cmdArgs = ["-d", ".", _WindowsExternalTerminalService.CMD, "/c", command];
      } else if (wt) {
        spawnExec = wt;
        cmdArgs = ["-d", ".", exec, "/c", command];
      } else {
        spawnExec = _WindowsExternalTerminalService.CMD;
        cmdArgs = ["/c", "start", title2, "/wait", exec, "/c", `"${command}"`];
      }
      const cmd = cp.spawn(spawnExec, cmdArgs, options);
      cmd.on("error", (err) => {
        reject(improveError(err));
      });
      resolve(void 0);
    });
  }
  static getDefaultTerminalWindows() {
    if (!_WindowsExternalTerminalService._DEFAULT_TERMINAL_WINDOWS) {
      const isWoW64 = !!process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432");
      _WindowsExternalTerminalService._DEFAULT_TERMINAL_WINDOWS = `${process.env.windir ? process.env.windir : "C:\\Windows"}\\${isWoW64 ? "Sysnative" : "System32"}\\cmd.exe`;
    }
    return _WindowsExternalTerminalService._DEFAULT_TERMINAL_WINDOWS;
  }
  static async getWtExePath() {
    try {
      return await processes.findExecutable("wt");
    } catch {
      return void 0;
    }
  }
};
_WindowsExternalTerminalService.CMD = "cmd.exe";
__decorateClass([
  memoize
], _WindowsExternalTerminalService, "getWtExePath", 1);
let WindowsExternalTerminalService = _WindowsExternalTerminalService;
const _MacExternalTerminalService = class _MacExternalTerminalService extends ExternalTerminalService {
  // osascript is the AppleScript interpreter on OS X
  openTerminal(configuration, cwd) {
    return this.spawnTerminal(cp, configuration, cwd);
  }
  runInTerminal(title, dir, args, envVars, settings) {
    const terminalApp = settings.osxExec || DEFAULT_TERMINAL_OSX;
    return new Promise((resolve, reject) => {
      if (terminalApp === DEFAULT_TERMINAL_OSX || terminalApp === "iTerm.app") {
        const script = terminalApp === DEFAULT_TERMINAL_OSX ? "TerminalHelper" : "iTermHelper";
        const scriptpath = FileAccess.asFileUri(`vs/workbench/contrib/externalTerminal/node/${script}.scpt`).fsPath;
        const osaArgs = [
          scriptpath,
          "-t",
          title || TERMINAL_TITLE,
          "-w",
          dir
        ];
        for (const a of args) {
          osaArgs.push("-a");
          osaArgs.push(a);
        }
        if (envVars) {
          const env2 = Object.assign({}, getSanitizedEnvironment(process), envVars);
          for (const key in env2) {
            const value = env2[key];
            if (value === null) {
              osaArgs.push("-u");
              osaArgs.push(key);
            } else {
              osaArgs.push("-e");
              osaArgs.push(`${key}=${value}`);
            }
          }
        }
        let stderr = "";
        const osa = cp.spawn(_MacExternalTerminalService.OSASCRIPT, osaArgs);
        osa.on("error", (err) => {
          reject(improveError(err));
        });
        osa.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        osa.on("exit", (code) => {
          if (code === 0) {
            resolve(void 0);
          } else {
            if (stderr) {
              const lines = stderr.split("\n", 1);
              reject(new Error(lines[0]));
            } else {
              reject(new Error(nls.localize("mac.terminal.script.failed", "Script '{0}' failed with exit code {1}", script, code)));
            }
          }
        });
      } else {
        reject(new Error(nls.localize("mac.terminal.type.not.supported", "'{0}' not supported", terminalApp)));
      }
    });
  }
  spawnTerminal(spawner, configuration, cwd) {
    const terminalApp = configuration.osxExec || DEFAULT_TERMINAL_OSX;
    return new Promise((c, e) => {
      const args = ["-a", terminalApp];
      if (cwd) {
        args.push(cwd);
      }
      const env2 = getSanitizedEnvironment(process);
      const child = spawner.spawn("/usr/bin/open", args, { cwd, env: env2 });
      child.on("error", e);
      child.on("exit", () => c());
    });
  }
};
_MacExternalTerminalService.OSASCRIPT = "/usr/bin/osascript";
let MacExternalTerminalService = _MacExternalTerminalService;
const _LinuxExternalTerminalService = class _LinuxExternalTerminalService extends ExternalTerminalService {
  openTerminal(configuration, cwd) {
    return this.spawnTerminal(cp, configuration, cwd);
  }
  runInTerminal(title, dir, args, envVars, settings) {
    const execPromise = settings.linuxExec ? Promise.resolve(settings.linuxExec) : _LinuxExternalTerminalService.getDefaultTerminalLinuxReady();
    return new Promise((resolve, reject) => {
      const termArgs = [];
      execPromise.then((exec) => {
        if (exec.indexOf("gnome-terminal") >= 0) {
          termArgs.push("-x");
        } else {
          termArgs.push("-e");
        }
        termArgs.push("bash");
        termArgs.push("-c");
        const bashCommand = `${quote(args)}; echo; read -p "${_LinuxExternalTerminalService.WAIT_MESSAGE}" -n1;`;
        termArgs.push(`''${bashCommand}''`);
        const env2 = Object.assign({}, getSanitizedEnvironment(process), envVars);
        Object.keys(env2).filter((v) => env2[v] === null).forEach((key) => delete env2[key]);
        const options = {
          cwd: dir,
          env: env2
        };
        let stderr = "";
        const cmd = cp.spawn(exec, termArgs, options);
        cmd.on("error", (err) => {
          reject(improveError(err));
        });
        cmd.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        cmd.on("exit", (code) => {
          if (code === 0) {
            resolve(void 0);
          } else {
            if (stderr) {
              const lines = stderr.split("\n", 1);
              reject(new Error(lines[0]));
            } else {
              reject(new Error(nls.localize("linux.term.failed", "'{0}' failed with exit code {1}", exec, code)));
            }
          }
        });
      });
    });
  }
  static async getDefaultTerminalLinuxReady() {
    if (!_LinuxExternalTerminalService._DEFAULT_TERMINAL_LINUX_READY) {
      if (!env.isLinux) {
        _LinuxExternalTerminalService._DEFAULT_TERMINAL_LINUX_READY = Promise.resolve("xterm");
      } else {
        const isDebian = await pfs.Promises.exists("/etc/debian_version");
        _LinuxExternalTerminalService._DEFAULT_TERMINAL_LINUX_READY = new Promise((r) => {
          if (isDebian) {
            r("x-terminal-emulator");
          } else if (process.env.DESKTOP_SESSION === "gnome" || process.env.DESKTOP_SESSION === "gnome-classic") {
            r("gnome-terminal");
          } else if (process.env.DESKTOP_SESSION === "kde-plasma") {
            r("konsole");
          } else if (process.env.COLORTERM) {
            r(process.env.COLORTERM);
          } else if (process.env.TERM) {
            r(process.env.TERM);
          } else {
            r("xterm");
          }
        });
      }
    }
    return _LinuxExternalTerminalService._DEFAULT_TERMINAL_LINUX_READY;
  }
  spawnTerminal(spawner, configuration, cwd) {
    const execPromise = configuration.linuxExec ? Promise.resolve(configuration.linuxExec) : _LinuxExternalTerminalService.getDefaultTerminalLinuxReady();
    return new Promise((c, e) => {
      execPromise.then((exec) => {
        const env2 = getSanitizedEnvironment(process);
        const child = spawner.spawn(exec, [], { cwd, env: env2 });
        child.on("error", e);
        child.on("exit", () => c());
      });
    });
  }
};
_LinuxExternalTerminalService.WAIT_MESSAGE = nls.localize("press.any.key", "Press any key to continue...");
let LinuxExternalTerminalService = _LinuxExternalTerminalService;
function getSanitizedEnvironment(process2) {
  const env2 = { ...process2.env };
  sanitizeProcessEnvironment(env2);
  return env2;
}
function improveError(err) {
  if ("errno" in err && err["errno"] === "ENOENT" && "path" in err && typeof err["path"] === "string") {
    return new Error(nls.localize("ext.term.app.not.found", "can't find terminal application '{0}'", err["path"]));
  }
  return err;
}
function quote(args) {
  let r = "";
  for (const a of args) {
    if (a.indexOf(" ") >= 0) {
      r += '"' + a + '"';
    } else {
      r += a;
    }
    r += " ";
  }
  return r;
}
export {
  LinuxExternalTerminalService,
  MacExternalTerminalService,
  WindowsExternalTerminalService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlcm5hbFRlcm1pbmFsL25vZGUvZXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBjcCBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBlbnYgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgc2FuaXRpemVQcm9jZXNzRW52aXJvbm1lbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzZXMuanMnO1xuaW1wb3J0ICogYXMgcGZzIGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0ICogYXMgcHJvY2Vzc2VzIGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9wcm9jZXNzZXMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX1RFUk1JTkFMX09TWCwgSUV4dGVybmFsVGVybWluYWxTZXJ2aWNlLCBJRXh0ZXJuYWxUZXJtaW5hbFNldHRpbmdzLCBJVGVybWluYWxGb3JQbGF0Zm9ybSB9IGZyb20gJy4uL2NvbW1vbi9leHRlcm5hbFRlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcblxuY29uc3QgVEVSTUlOQUxfVElUTEUgPSBubHMubG9jYWxpemUoJ2NvbnNvbGUudGl0bGUnLCBcIlZTIENvZGUgQ29uc29sZVwiKTtcblxuYWJzdHJhY3QgY2xhc3MgRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2Uge1xuXHRwdWJsaWMgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGFzeW5jIGdldERlZmF1bHRUZXJtaW5hbEZvclBsYXRmb3JtcygpOiBQcm9taXNlPElUZXJtaW5hbEZvclBsYXRmb3JtPiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHdpbmRvd3M6IFdpbmRvd3NFeHRlcm5hbFRlcm1pbmFsU2VydmljZS5nZXREZWZhdWx0VGVybWluYWxXaW5kb3dzKCksXG5cdFx0XHRsaW51eDogYXdhaXQgTGludXhFeHRlcm5hbFRlcm1pbmFsU2VydmljZS5nZXREZWZhdWx0VGVybWluYWxMaW51eFJlYWR5KCksXG5cdFx0XHRvc3g6ICd4dGVybSdcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBXaW5kb3dzRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UgZXh0ZW5kcyBFeHRlcm5hbFRlcm1pbmFsU2VydmljZSBpbXBsZW1lbnRzIElFeHRlcm5hbFRlcm1pbmFsU2VydmljZSB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IENNRCA9ICdjbWQuZXhlJztcblx0cHJpdmF0ZSBzdGF0aWMgX0RFRkFVTFRfVEVSTUlOQUxfV0lORE9XUzogc3RyaW5nO1xuXG5cdHB1YmxpYyBvcGVuVGVybWluYWwoY29uZmlndXJhdGlvbjogSUV4dGVybmFsVGVybWluYWxTZXR0aW5ncywgY3dkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuc3Bhd25UZXJtaW5hbChjcCwgY29uZmlndXJhdGlvbiwgcHJvY2Vzc2VzLmdldFdpbmRvd3NTaGVsbCgpLCBjd2QpO1xuXHR9XG5cblx0cHVibGljIHNwYXduVGVybWluYWwoc3Bhd25lcjogdHlwZW9mIGNwLCBjb25maWd1cmF0aW9uOiBJRXh0ZXJuYWxUZXJtaW5hbFNldHRpbmdzLCBjb21tYW5kOiBzdHJpbmcsIGN3ZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGV4ZWMgPSBjb25maWd1cmF0aW9uLndpbmRvd3NFeGVjIHx8IFdpbmRvd3NFeHRlcm5hbFRlcm1pbmFsU2VydmljZS5nZXREZWZhdWx0VGVybWluYWxXaW5kb3dzKCk7XG5cblx0XHQvLyBNYWtlIHRoZSBkcml2ZSBsZXR0ZXIgdXBwZXJjYXNlIG9uIFdpbmRvd3MgKHNlZSAjOTQ0OClcblx0XHRpZiAoY3dkICYmIGN3ZFsxXSA9PT0gJzonKSB7XG5cdFx0XHRjd2QgPSBjd2RbMF0udG9VcHBlckNhc2UoKSArIGN3ZC5zdWJzdHIoMSk7XG5cdFx0fVxuXG5cdFx0Ly8gY21kZXIgaWdub3JlcyB0aGUgZW52aXJvbm1lbnQgY3dkIGFuZCBpbnN0ZWFkIG9wdHMgdG8gYWx3YXlzIG9wZW4gaW4gJVVTRVJQUk9GSUxFJVxuXHRcdC8vIHVubGVzcyBvdGhlcndpc2Ugc3BlY2lmaWVkXG5cdFx0Y29uc3QgYmFzZW5hbWUgPSBwYXRoLmJhc2VuYW1lKGV4ZWMsICcuZXhlJykudG9Mb3dlckNhc2UoKTtcblx0XHRpZiAoYmFzZW5hbWUgPT09ICdjbWRlcicpIHtcblx0XHRcdHNwYXduZXIuc3Bhd24oZXhlYywgY3dkID8gW2N3ZF0gOiB1bmRlZmluZWQpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNtZEFyZ3MgPSBbJy9jJywgJ3N0YXJ0JywgJy93YWl0J107XG5cdFx0aWYgKGV4ZWMuaW5kZXhPZignICcpID49IDApIHtcblx0XHRcdC8vIFRoZSBcIlwiIGFyZ3VtZW50IGlzIHRoZSB3aW5kb3cgdGl0bGUuIFdpdGhvdXQgdGhpcywgZXhlYyBkb2Vzbid0IHdvcmsgd2hlbiB0aGUgcGF0aFxuXHRcdFx0Ly8gY29udGFpbnMgc3BhY2VzLiAjNjU5MFxuXHRcdFx0Ly8gVGl0bGUgaXMgRXhlY3V0aW9uIFBhdGguICMyMjAxMjlcblx0XHRcdGNtZEFyZ3MucHVzaChleGVjKTtcblx0XHR9XG5cdFx0Y21kQXJncy5wdXNoKGV4ZWMpO1xuXHRcdC8vIEFkZCBzdGFydGluZyBkaXJlY3RvcnkgcGFyYW1ldGVyIGZvciBXaW5kb3dzIFRlcm1pbmFsIChzZWUgIzkwNzM0KVxuXHRcdGlmIChiYXNlbmFtZSA9PT0gJ3d0Jykge1xuXHRcdFx0Y21kQXJncy5wdXNoKCctZCAuJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChjLCBlKSA9PiB7XG5cdFx0XHRjb25zdCBlbnYgPSBnZXRTYW5pdGl6ZWRFbnZpcm9ubWVudChwcm9jZXNzKTtcblx0XHRcdGNvbnN0IGNoaWxkID0gc3Bhd25lci5zcGF3bihjb21tYW5kLCBjbWRBcmdzLCB7IGN3ZCwgZW52LCBkZXRhY2hlZDogdHJ1ZSB9KTtcblx0XHRcdGNoaWxkLm9uKCdlcnJvcicsIGUpO1xuXHRcdFx0Y2hpbGQub24oJ2V4aXQnLCAoKSA9PiBjKCkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bkluVGVybWluYWwodGl0bGU6IHN0cmluZywgZGlyOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBlbnZWYXJzOiBJVGVybWluYWxFbnZpcm9ubWVudCwgc2V0dGluZ3M6IElFeHRlcm5hbFRlcm1pbmFsU2V0dGluZ3MpOiBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGV4ZWMgPSAnd2luZG93c0V4ZWMnIGluIHNldHRpbmdzICYmIHNldHRpbmdzLndpbmRvd3NFeGVjID8gc2V0dGluZ3Mud2luZG93c0V4ZWMgOiBXaW5kb3dzRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuZ2V0RGVmYXVsdFRlcm1pbmFsV2luZG93cygpO1xuXHRcdGNvbnN0IHd0ID0gYXdhaXQgV2luZG93c0V4dGVybmFsVGVybWluYWxTZXJ2aWNlLmdldFd0RXhlUGF0aCgpO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cdFx0XHRjb25zdCB0aXRsZSA9IGBcIiR7ZGlyfSAtICR7VEVSTUlOQUxfVElUTEV9XCJgO1xuXHRcdFx0Y29uc3QgY29tbWFuZCA9IGBcIiR7YXJncy5qb2luKCdcIiBcIicpfVwiICYgcGF1c2VgOyAvLyB1c2UgJ3wnIHRvIG9ubHkgcGF1c2Ugb24gbm9uLXplcm8gZXhpdCBjb2RlXG5cblx0XHRcdC8vIG1lcmdlIGVudmlyb25tZW50IHZhcmlhYmxlcyBpbnRvIGEgY29weSBvZiB0aGUgcHJvY2Vzcy5lbnZcblx0XHRcdGNvbnN0IGVudiA9IE9iamVjdC5hc3NpZ24oe30sIGdldFNhbml0aXplZEVudmlyb25tZW50KHByb2Nlc3MpLCBlbnZWYXJzKTtcblxuXHRcdFx0Ly8gZGVsZXRlIGVudmlyb25tZW50IHZhcmlhYmxlcyB0aGF0IGhhdmUgYSBudWxsIHZhbHVlXG5cdFx0XHRPYmplY3Qua2V5cyhlbnYpLmZpbHRlcih2ID0+IGVudlt2XSA9PT0gbnVsbCkuZm9yRWFjaChrZXkgPT4gZGVsZXRlIGVudltrZXldKTtcblxuXHRcdFx0Y29uc3Qgb3B0aW9uczogYW55ID0ge1xuXHRcdFx0XHRjd2Q6IGRpcixcblx0XHRcdFx0ZW52OiBlbnYsXG5cdFx0XHRcdHdpbmRvd3NWZXJiYXRpbUFyZ3VtZW50czogdHJ1ZVxuXHRcdFx0fTtcblxuXHRcdFx0bGV0IHNwYXduRXhlYzogc3RyaW5nO1xuXHRcdFx0bGV0IGNtZEFyZ3M6IHN0cmluZ1tdO1xuXG5cdFx0XHRpZiAocGF0aC5iYXNlbmFtZShleGVjLCAnLmV4ZScpID09PSAnd3QnKSB7XG5cdFx0XHRcdC8vIEhhbmRsZSBXaW5kb3dzIFRlcm1pbmFsIHNwZWNpYWxseTsgLWQgdG8gc2V0IHRoZSBjd2QgYW5kIHJ1biBhIGNtZC5leGUgaW5zdGFuY2Vcblx0XHRcdFx0Ly8gaW5zaWRlIGl0XG5cdFx0XHRcdHNwYXduRXhlYyA9IGV4ZWM7XG5cdFx0XHRcdGNtZEFyZ3MgPSBbJy1kJywgJy4nLCBXaW5kb3dzRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuQ01ELCAnL2MnLCBjb21tYW5kXTtcblx0XHRcdH0gZWxzZSBpZiAod3QpIHtcblx0XHRcdFx0Ly8gcHJlZmVyIHRvIHVzZSB0aGUgd2luZG93IHRlcm1pbmFsIHRvIHNwYXduIGlmIGl0J3MgYXZhaWxhYmxlIGluc3RlYWRcblx0XHRcdFx0Ly8gb2Ygc3RhcnQsIHNpbmNlIHRoYXQgYWxsb3dzIGN0cmwrYyBoYW5kbGluZyAoIzgxMzIyKVxuXHRcdFx0XHRzcGF3bkV4ZWMgPSB3dDtcblx0XHRcdFx0Y21kQXJncyA9IFsnLWQnLCAnLicsIGV4ZWMsICcvYycsIGNvbW1hbmRdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3Bhd25FeGVjID0gV2luZG93c0V4dGVybmFsVGVybWluYWxTZXJ2aWNlLkNNRDtcblx0XHRcdFx0Y21kQXJncyA9IFsnL2MnLCAnc3RhcnQnLCB0aXRsZSwgJy93YWl0JywgZXhlYywgJy9jJywgYFwiJHtjb21tYW5kfVwiYF07XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNtZCA9IGNwLnNwYXduKHNwYXduRXhlYywgY21kQXJncywgb3B0aW9ucyk7XG5cblx0XHRcdGNtZC5vbignZXJyb3InLCBlcnIgPT4ge1xuXHRcdFx0XHRyZWplY3QoaW1wcm92ZUVycm9yKGVycikpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0RGVmYXVsdFRlcm1pbmFsV2luZG93cygpOiBzdHJpbmcge1xuXHRcdGlmICghV2luZG93c0V4dGVybmFsVGVybWluYWxTZXJ2aWNlLl9ERUZBVUxUX1RFUk1JTkFMX1dJTkRPV1MpIHtcblx0XHRcdGNvbnN0IGlzV29XNjQgPSAhIXByb2Nlc3MuZW52Lmhhc093blByb3BlcnR5KCdQUk9DRVNTT1JfQVJDSElURVc2NDMyJyk7XG5cdFx0XHRXaW5kb3dzRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuX0RFRkFVTFRfVEVSTUlOQUxfV0lORE9XUyA9IGAke3Byb2Nlc3MuZW52LndpbmRpciA/IHByb2Nlc3MuZW52LndpbmRpciA6ICdDOlxcXFxXaW5kb3dzJ31cXFxcJHtpc1dvVzY0ID8gJ1N5c25hdGl2ZScgOiAnU3lzdGVtMzInfVxcXFxjbWQuZXhlYDtcblx0XHR9XG5cdFx0cmV0dXJuIFdpbmRvd3NFeHRlcm5hbFRlcm1pbmFsU2VydmljZS5fREVGQVVMVF9URVJNSU5BTF9XSU5ET1dTO1xuXHR9XG5cblx0QG1lbW9pemVcblx0cHJpdmF0ZSBzdGF0aWMgYXN5bmMgZ2V0V3RFeGVQYXRoKCkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgcHJvY2Vzc2VzLmZpbmRFeGVjdXRhYmxlKCd3dCcpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1hY0V4dGVybmFsVGVybWluYWxTZXJ2aWNlIGV4dGVuZHMgRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UgaW1wbGVtZW50cyBJRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2Uge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBPU0FTQ1JJUFQgPSAnL3Vzci9iaW4vb3Nhc2NyaXB0JztcdC8vIG9zYXNjcmlwdCBpcyB0aGUgQXBwbGVTY3JpcHQgaW50ZXJwcmV0ZXIgb24gT1MgWFxuXG5cdHB1YmxpYyBvcGVuVGVybWluYWwoY29uZmlndXJhdGlvbjogSUV4dGVybmFsVGVybWluYWxTZXR0aW5ncywgY3dkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuc3Bhd25UZXJtaW5hbChjcCwgY29uZmlndXJhdGlvbiwgY3dkKTtcblx0fVxuXG5cdHB1YmxpYyBydW5JblRlcm1pbmFsKHRpdGxlOiBzdHJpbmcsIGRpcjogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSwgZW52VmFyczogSVRlcm1pbmFsRW52aXJvbm1lbnQsIHNldHRpbmdzOiBJRXh0ZXJuYWxUZXJtaW5hbFNldHRpbmdzKTogUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+IHtcblxuXHRcdGNvbnN0IHRlcm1pbmFsQXBwID0gc2V0dGluZ3Mub3N4RXhlYyB8fCBERUZBVUxUX1RFUk1JTkFMX09TWDtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuXHRcdFx0aWYgKHRlcm1pbmFsQXBwID09PSBERUZBVUxUX1RFUk1JTkFMX09TWCB8fCB0ZXJtaW5hbEFwcCA9PT0gJ2lUZXJtLmFwcCcpIHtcblxuXHRcdFx0XHQvLyBPbiBPUyBYIHdlIGxhdW5jaCBhbiBBcHBsZVNjcmlwdCB0aGF0IGNyZWF0ZXMgKG9yIHJldXNlcykgYSBUZXJtaW5hbCB3aW5kb3dcblx0XHRcdFx0Ly8gYW5kIHRoZW4gbGF1bmNoZXMgdGhlIHByb2dyYW0gaW5zaWRlIHRoYXQgd2luZG93LlxuXG5cdFx0XHRcdGNvbnN0IHNjcmlwdCA9IHRlcm1pbmFsQXBwID09PSBERUZBVUxUX1RFUk1JTkFMX09TWCA/ICdUZXJtaW5hbEhlbHBlcicgOiAnaVRlcm1IZWxwZXInO1xuXHRcdFx0XHRjb25zdCBzY3JpcHRwYXRoID0gRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoYHZzL3dvcmtiZW5jaC9jb250cmliL2V4dGVybmFsVGVybWluYWwvbm9kZS8ke3NjcmlwdH0uc2NwdGApLmZzUGF0aDtcblxuXHRcdFx0XHRjb25zdCBvc2FBcmdzID0gW1xuXHRcdFx0XHRcdHNjcmlwdHBhdGgsXG5cdFx0XHRcdFx0Jy10JywgdGl0bGUgfHwgVEVSTUlOQUxfVElUTEUsXG5cdFx0XHRcdFx0Jy13JywgZGlyLFxuXHRcdFx0XHRdO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgYSBvZiBhcmdzKSB7XG5cdFx0XHRcdFx0b3NhQXJncy5wdXNoKCctYScpO1xuXHRcdFx0XHRcdG9zYUFyZ3MucHVzaChhKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlbnZWYXJzKSB7XG5cdFx0XHRcdFx0Ly8gbWVyZ2UgZW52aXJvbm1lbnQgdmFyaWFibGVzIGludG8gYSBjb3B5IG9mIHRoZSBwcm9jZXNzLmVudlxuXHRcdFx0XHRcdGNvbnN0IGVudiA9IE9iamVjdC5hc3NpZ24oe30sIGdldFNhbml0aXplZEVudmlyb25tZW50KHByb2Nlc3MpLCBlbnZWYXJzKTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3Qga2V5IGluIGVudikge1xuXHRcdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSBlbnZba2V5XTtcblx0XHRcdFx0XHRcdGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHRvc2FBcmdzLnB1c2goJy11Jyk7XG5cdFx0XHRcdFx0XHRcdG9zYUFyZ3MucHVzaChrZXkpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0b3NhQXJncy5wdXNoKCctZScpO1xuXHRcdFx0XHRcdFx0XHRvc2FBcmdzLnB1c2goYCR7a2V5fT0ke3ZhbHVlfWApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBzdGRlcnIgPSAnJztcblx0XHRcdFx0Y29uc3Qgb3NhID0gY3Auc3Bhd24oTWFjRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuT1NBU0NSSVBULCBvc2FBcmdzKTtcblx0XHRcdFx0b3NhLm9uKCdlcnJvcicsIGVyciA9PiB7XG5cdFx0XHRcdFx0cmVqZWN0KGltcHJvdmVFcnJvcihlcnIpKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdG9zYS5zdGRlcnIub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xuXHRcdFx0XHRcdHN0ZGVyciArPSBkYXRhLnRvU3RyaW5nKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRvc2Eub24oJ2V4aXQnLCAoY29kZTogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvZGUgPT09IDApIHtcdC8vIE9LXG5cdFx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlmIChzdGRlcnIpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGluZXMgPSBzdGRlcnIuc3BsaXQoJ1xcbicsIDEpO1xuXHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKGxpbmVzWzBdKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnbWFjLnRlcm1pbmFsLnNjcmlwdC5mYWlsZWQnLCBcIlNjcmlwdCAnezB9JyBmYWlsZWQgd2l0aCBleGl0IGNvZGUgezF9XCIsIHNjcmlwdCwgY29kZSkpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoJ21hYy50ZXJtaW5hbC50eXBlLm5vdC5zdXBwb3J0ZWQnLCBcIid7MH0nIG5vdCBzdXBwb3J0ZWRcIiwgdGVybWluYWxBcHApKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRzcGF3blRlcm1pbmFsKHNwYXduZXI6IHR5cGVvZiBjcCwgY29uZmlndXJhdGlvbjogSUV4dGVybmFsVGVybWluYWxTZXR0aW5ncywgY3dkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGVybWluYWxBcHAgPSBjb25maWd1cmF0aW9uLm9zeEV4ZWMgfHwgREVGQVVMVF9URVJNSU5BTF9PU1g7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKGMsIGUpID0+IHtcblx0XHRcdGNvbnN0IGFyZ3MgPSBbJy1hJywgdGVybWluYWxBcHBdO1xuXHRcdFx0aWYgKGN3ZCkge1xuXHRcdFx0XHRhcmdzLnB1c2goY3dkKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudiA9IGdldFNhbml0aXplZEVudmlyb25tZW50KHByb2Nlc3MpO1xuXHRcdFx0Y29uc3QgY2hpbGQgPSBzcGF3bmVyLnNwYXduKCcvdXNyL2Jpbi9vcGVuJywgYXJncywgeyBjd2QsIGVudiB9KTtcblx0XHRcdGNoaWxkLm9uKCdlcnJvcicsIGUpO1xuXHRcdFx0Y2hpbGQub24oJ2V4aXQnLCAoKSA9PiBjKCkpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBMaW51eEV4dGVybmFsVGVybWluYWxTZXJ2aWNlIGV4dGVuZHMgRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UgaW1wbGVtZW50cyBJRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2Uge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFdBSVRfTUVTU0FHRSA9IG5scy5sb2NhbGl6ZSgncHJlc3MuYW55LmtleScsIFwiUHJlc3MgYW55IGtleSB0byBjb250aW51ZS4uLlwiKTtcblxuXHRwdWJsaWMgb3BlblRlcm1pbmFsKGNvbmZpZ3VyYXRpb246IElFeHRlcm5hbFRlcm1pbmFsU2V0dGluZ3MsIGN3ZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLnNwYXduVGVybWluYWwoY3AsIGNvbmZpZ3VyYXRpb24sIGN3ZCk7XG5cdH1cblxuXHRwdWJsaWMgcnVuSW5UZXJtaW5hbCh0aXRsZTogc3RyaW5nLCBkaXI6IHN0cmluZywgYXJnczogc3RyaW5nW10sIGVudlZhcnM6IElUZXJtaW5hbEVudmlyb25tZW50LCBzZXR0aW5nczogSUV4dGVybmFsVGVybWluYWxTZXR0aW5ncyk6IFByb21pc2U8bnVtYmVyIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBleGVjUHJvbWlzZSA9IHNldHRpbmdzLmxpbnV4RXhlYyA/IFByb21pc2UucmVzb2x2ZShzZXR0aW5ncy5saW51eEV4ZWMpIDogTGludXhFeHRlcm5hbFRlcm1pbmFsU2VydmljZS5nZXREZWZhdWx0VGVybWluYWxMaW51eFJlYWR5KCk7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyIHwgdW5kZWZpbmVkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblx0XHRcdGNvbnN0IHRlcm1BcmdzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0Ly90ZXJtQXJncy5wdXNoKCctLXRpdGxlJyk7XG5cdFx0XHQvL3Rlcm1BcmdzLnB1c2goYFwiJHtURVJNSU5BTF9USVRMRX1cImApO1xuXHRcdFx0ZXhlY1Byb21pc2UudGhlbihleGVjID0+IHtcblx0XHRcdFx0aWYgKGV4ZWMuaW5kZXhPZignZ25vbWUtdGVybWluYWwnKSA+PSAwKSB7XG5cdFx0XHRcdFx0dGVybUFyZ3MucHVzaCgnLXgnKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0ZXJtQXJncy5wdXNoKCctZScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRlcm1BcmdzLnB1c2goJ2Jhc2gnKTtcblx0XHRcdFx0dGVybUFyZ3MucHVzaCgnLWMnKTtcblxuXHRcdFx0XHRjb25zdCBiYXNoQ29tbWFuZCA9IGAke3F1b3RlKGFyZ3MpfTsgZWNobzsgcmVhZCAtcCBcIiR7TGludXhFeHRlcm5hbFRlcm1pbmFsU2VydmljZS5XQUlUX01FU1NBR0V9XCIgLW4xO2A7XG5cdFx0XHRcdHRlcm1BcmdzLnB1c2goYCcnJHtiYXNoQ29tbWFuZH0nJ2ApO1x0Ly8gd3JhcHBpbmcgYXJndW1lbnQgaW4gdHdvIHNldHMgb2YgJyBiZWNhdXNlIG5vZGUgaXMgc28gXCJmcmllbmRseVwiIHRoYXQgaXQgcmVtb3ZlcyBvbmUgc2V0Li4uXG5cblxuXHRcdFx0XHQvLyBtZXJnZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgaW50byBhIGNvcHkgb2YgdGhlIHByb2Nlc3MuZW52XG5cdFx0XHRcdGNvbnN0IGVudiA9IE9iamVjdC5hc3NpZ24oe30sIGdldFNhbml0aXplZEVudmlyb25tZW50KHByb2Nlc3MpLCBlbnZWYXJzKTtcblxuXHRcdFx0XHQvLyBkZWxldGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIHRoYXQgaGF2ZSBhIG51bGwgdmFsdWVcblx0XHRcdFx0T2JqZWN0LmtleXMoZW52KS5maWx0ZXIodiA9PiBlbnZbdl0gPT09IG51bGwpLmZvckVhY2goa2V5ID0+IGRlbGV0ZSBlbnZba2V5XSk7XG5cblx0XHRcdFx0Y29uc3Qgb3B0aW9uczogYW55ID0ge1xuXHRcdFx0XHRcdGN3ZDogZGlyLFxuXHRcdFx0XHRcdGVudjogZW52XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0bGV0IHN0ZGVyciA9ICcnO1xuXHRcdFx0XHRjb25zdCBjbWQgPSBjcC5zcGF3bihleGVjLCB0ZXJtQXJncywgb3B0aW9ucyk7XG5cdFx0XHRcdGNtZC5vbignZXJyb3InLCBlcnIgPT4ge1xuXHRcdFx0XHRcdHJlamVjdChpbXByb3ZlRXJyb3IoZXJyKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjbWQuc3RkZXJyLm9uKCdkYXRhJywgKGRhdGEpID0+IHtcblx0XHRcdFx0XHRzdGRlcnIgKz0gZGF0YS50b1N0cmluZygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y21kLm9uKCdleGl0JywgKGNvZGU6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRcdGlmIChjb2RlID09PSAwKSB7XHQvLyBPS1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoc3RkZXJyKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmVzID0gc3RkZXJyLnNwbGl0KCdcXG4nLCAxKTtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihsaW5lc1swXSkpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2xpbnV4LnRlcm0uZmFpbGVkJywgXCInezB9JyBmYWlsZWQgd2l0aCBleGl0IGNvZGUgezF9XCIsIGV4ZWMsIGNvZGUpKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX0RFRkFVTFRfVEVSTUlOQUxfTElOVVhfUkVBRFk6IFByb21pc2U8c3RyaW5nPjtcblxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGdldERlZmF1bHRUZXJtaW5hbExpbnV4UmVhZHkoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAoIUxpbnV4RXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuX0RFRkFVTFRfVEVSTUlOQUxfTElOVVhfUkVBRFkpIHtcblx0XHRcdGlmICghZW52LmlzTGludXgpIHtcblx0XHRcdFx0TGludXhFeHRlcm5hbFRlcm1pbmFsU2VydmljZS5fREVGQVVMVF9URVJNSU5BTF9MSU5VWF9SRUFEWSA9IFByb21pc2UucmVzb2x2ZSgneHRlcm0nKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGlzRGViaWFuID0gYXdhaXQgcGZzLlByb21pc2VzLmV4aXN0cygnL2V0Yy9kZWJpYW5fdmVyc2lvbicpO1xuXHRcdFx0XHRMaW51eEV4dGVybmFsVGVybWluYWxTZXJ2aWNlLl9ERUZBVUxUX1RFUk1JTkFMX0xJTlVYX1JFQURZID0gbmV3IFByb21pc2U8c3RyaW5nPihyID0+IHtcblx0XHRcdFx0XHRpZiAoaXNEZWJpYW4pIHtcblx0XHRcdFx0XHRcdHIoJ3gtdGVybWluYWwtZW11bGF0b3InKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHByb2Nlc3MuZW52LkRFU0tUT1BfU0VTU0lPTiA9PT0gJ2dub21lJyB8fCBwcm9jZXNzLmVudi5ERVNLVE9QX1NFU1NJT04gPT09ICdnbm9tZS1jbGFzc2ljJykge1xuXHRcdFx0XHRcdFx0cignZ25vbWUtdGVybWluYWwnKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHByb2Nlc3MuZW52LkRFU0tUT1BfU0VTU0lPTiA9PT0gJ2tkZS1wbGFzbWEnKSB7XG5cdFx0XHRcdFx0XHRyKCdrb25zb2xlJyk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChwcm9jZXNzLmVudi5DT0xPUlRFUk0pIHtcblx0XHRcdFx0XHRcdHIocHJvY2Vzcy5lbnYuQ09MT1JURVJNKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHByb2Nlc3MuZW52LlRFUk0pIHtcblx0XHRcdFx0XHRcdHIocHJvY2Vzcy5lbnYuVEVSTSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHIoJ3h0ZXJtJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIExpbnV4RXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuX0RFRkFVTFRfVEVSTUlOQUxfTElOVVhfUkVBRFk7XG5cdH1cblxuXHRzcGF3blRlcm1pbmFsKHNwYXduZXI6IHR5cGVvZiBjcCwgY29uZmlndXJhdGlvbjogSUV4dGVybmFsVGVybWluYWxTZXR0aW5ncywgY3dkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXhlY1Byb21pc2UgPSBjb25maWd1cmF0aW9uLmxpbnV4RXhlYyA/IFByb21pc2UucmVzb2x2ZShjb25maWd1cmF0aW9uLmxpbnV4RXhlYykgOiBMaW51eEV4dGVybmFsVGVybWluYWxTZXJ2aWNlLmdldERlZmF1bHRUZXJtaW5hbExpbnV4UmVhZHkoKTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigoYywgZSkgPT4ge1xuXHRcdFx0ZXhlY1Byb21pc2UudGhlbihleGVjID0+IHtcblx0XHRcdFx0Y29uc3QgZW52ID0gZ2V0U2FuaXRpemVkRW52aXJvbm1lbnQocHJvY2Vzcyk7XG5cdFx0XHRcdGNvbnN0IGNoaWxkID0gc3Bhd25lci5zcGF3bihleGVjLCBbXSwgeyBjd2QsIGVudiB9KTtcblx0XHRcdFx0Y2hpbGQub24oJ2Vycm9yJywgZSk7XG5cdFx0XHRcdGNoaWxkLm9uKCdleGl0JywgKCkgPT4gYygpKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldFNhbml0aXplZEVudmlyb25tZW50KHByb2Nlc3M6IE5vZGVKUy5Qcm9jZXNzKSB7XG5cdGNvbnN0IGVudiA9IHsgLi4ucHJvY2Vzcy5lbnYgfTtcblx0c2FuaXRpemVQcm9jZXNzRW52aXJvbm1lbnQoZW52KTtcblx0cmV0dXJuIGVudjtcbn1cblxuLyoqXG4gKiB0cmllcyB0byB0dXJuIE9TIGVycm9ycyBpbnRvIG1vcmUgbWVhbmluZ2Z1bCBlcnJvciBtZXNzYWdlc1xuICovXG5mdW5jdGlvbiBpbXByb3ZlRXJyb3IoZXJyOiBFcnJvciAmIHsgZXJybm8/OiBzdHJpbmc7IHBhdGg/OiBzdHJpbmcgfSk6IEVycm9yIHtcblx0aWYgKCdlcnJubycgaW4gZXJyICYmIGVyclsnZXJybm8nXSA9PT0gJ0VOT0VOVCcgJiYgJ3BhdGgnIGluIGVyciAmJiB0eXBlb2YgZXJyWydwYXRoJ10gPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2V4dC50ZXJtLmFwcC5ub3QuZm91bmQnLCBcImNhbid0IGZpbmQgdGVybWluYWwgYXBwbGljYXRpb24gJ3swfSdcIiwgZXJyWydwYXRoJ10pKTtcblx0fVxuXHRyZXR1cm4gZXJyO1xufVxuXG4vKipcbiAqIFF1b3RlIGFyZ3MgaWYgbmVjZXNzYXJ5IGFuZCBjb21iaW5lIGludG8gYSBzcGFjZSBzZXBhcmF0ZWQgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBxdW90ZShhcmdzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG5cdGxldCByID0gJyc7XG5cdGZvciAoY29uc3QgYSBvZiBhcmdzKSB7XG5cdFx0aWYgKGEuaW5kZXhPZignICcpID49IDApIHtcblx0XHRcdHIgKz0gJ1wiJyArIGEgKyAnXCInO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyICs9IGE7XG5cdFx0fVxuXHRcdHIgKz0gJyAnO1xuXHR9XG5cdHJldHVybiByO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFlBQVksUUFBUTtBQUNwQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsWUFBWSxVQUFVO0FBQ3RCLFlBQVksU0FBUztBQUNyQixTQUFTLGtDQUFrQztBQUMzQyxZQUFZLFNBQVM7QUFDckIsWUFBWSxlQUFlO0FBQzNCLFlBQVksU0FBUztBQUNyQixTQUFTLDRCQUF1RztBQUdoSCxNQUFNLGlCQUFpQixJQUFJLFNBQVMsaUJBQWlCLGlCQUFpQjtBQUV0RSxNQUFlLHdCQUF3QjtBQUFBLEVBR3RDLE1BQU0saUNBQWdFO0FBQ3JFLFdBQU87QUFBQSxNQUNOLFNBQVMsK0JBQStCLDBCQUEwQjtBQUFBLE1BQ2xFLE9BQU8sTUFBTSw2QkFBNkIsNkJBQTZCO0FBQUEsTUFDdkUsS0FBSztBQUFBLElBQ047QUFBQSxFQUNEO0FBQ0Q7QUFFTyxNQUFNLGtDQUFOLE1BQU0sd0NBQXVDLHdCQUE0RDtBQUFBLEVBSXhHLGFBQWEsZUFBMEMsS0FBNkI7QUFDMUYsV0FBTyxLQUFLLGNBQWMsSUFBSSxlQUFlLFVBQVUsZ0JBQWdCLEdBQUcsR0FBRztBQUFBLEVBQzlFO0FBQUEsRUFFTyxjQUFjLFNBQW9CLGVBQTBDLFNBQWlCLEtBQTZCO0FBQ2hJLFVBQU0sT0FBTyxjQUFjLGVBQWUsZ0NBQStCLDBCQUEwQjtBQUduRyxRQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSztBQUMxQixZQUFNLElBQUksQ0FBQyxFQUFFLFlBQVksSUFBSSxJQUFJLE9BQU8sQ0FBQztBQUFBLElBQzFDO0FBSUEsVUFBTSxXQUFXLEtBQUssU0FBUyxNQUFN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NUIsY0FBRSxRQUFRLElBQUksSUFBSTtBQUFBLFVBQ25CLE9BQU87QUFDTixjQUFFLE9BQU87QUFBQSxVQUNWO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0Q7QUFDQSxXQUFPLDhCQUE2QjtBQUFBLEVBQ3JDO0FBQUEsRUFFQSxjQUFjLFNBQW9CLGVBQTBDLEtBQTZCO0FBQ3hHLFVBQU0sY0FBYyxjQUFjLFlBQVksUUFBUSxRQUFRLGNBQWMsU0FBUyxJQUFJLDhCQUE2Qiw2QkFBNkI7QUFFbkosV0FBTyxJQUFJLFFBQWMsQ0FBQyxHQUFHLE1BQU07QUFDbEMsa0JBQVksS0FBSyxVQUFRO0FBQ3hCLGNBQU1BLE9BQU0sd0JBQXdCLE9BQU87QUFDM0MsY0FBTSxRQUFRLFFBQVEsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssS0FBQUEsS0FBSSxDQUFDO0FBQ2xELGNBQU0sR0FBRyxTQUFTLENBQUM7QUFDbkIsY0FBTSxHQUFHLFFBQVEsTUFBTSxFQUFFLENBQUM7QUFBQSxNQUMzQixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRjtBQUNEO0FBekdhLDhCQUVZLGVBQWUsSUFBSSxTQUFTLGlCQUFpQiw4QkFBOEI7QUFGN0YsSUFBTSwrQkFBTjtBQTJHUCxTQUFTLHdCQUF3QkUsVUFBeUI7QUFDekQsUUFBTUYsT0FBTSxFQUFFLEdBQUdFLFNBQVEsSUFBSTtBQUM3Qiw2QkFBMkJGLElBQUc7QUFDOUIsU0FBT0E7QUFDUjtBQUtBLFNBQVMsYUFBYSxLQUF1RDtBQUM1RSxNQUFJLFdBQVcsT0FBTyxJQUFJLE9BQU8sTUFBTSxZQUFZLFVBQVUsT0FBTyxPQUFPLElBQUksTUFBTSxNQUFNLFVBQVU7QUFDcEcsV0FBTyxJQUFJLE1BQU0sSUFBSSxTQUFTLDBCQUEwQix5Q0FBeUMsSUFBSSxNQUFNLENBQUMsQ0FBQztBQUFBLEVBQzlHO0FBQ0EsU0FBTztBQUNSO0FBS0EsU0FBUyxNQUFNLE1BQXdCO0FBQ3RDLE1BQUksSUFBSTtBQUNSLGFBQVcsS0FBSyxNQUFNO0FBQ3JCLFFBQUksRUFBRSxRQUFRLEdBQUcsS0FBSyxHQUFHO0FBQ3hCLFdBQUssTUFBTSxJQUFJO0FBQUEsSUFDaEIsT0FBTztBQUNOLFdBQUs7QUFBQSxJQUNOO0FBQ0EsU0FBSztBQUFBLEVBQ047QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbImVudiIsICJ0aXRsZSIsICJwcm9jZXNzIl0KfQo=
