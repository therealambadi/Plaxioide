import * as cp from "child_process";
import { getDriveLetter } from "../../../../base/common/extpath.js";
import * as platform from "../../../../base/common/platform.js";
function spawnAsPromised(command, args) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    const child = cp.spawn(command, args);
    if (child.pid) {
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
    }
    child.on("error", (err) => {
      reject(err);
    });
    child.on("close", (code) => {
      resolve(stdout);
    });
  });
}
async function hasChildProcesses(processId) {
  if (processId) {
    if (platform.isWindows) {
      const windowsProcessTree = await import("@vscode/windows-process-tree");
      return new Promise((resolve) => {
        windowsProcessTree.getProcessTree(processId, (processTree) => {
          resolve(!!processTree && processTree.children.length > 0);
        });
      });
    } else {
      return spawnAsPromised("/usr/bin/pgrep", ["-lP", String(processId)]).then((stdout) => {
        const r = stdout.trim();
        if (r.length === 0 || r.indexOf(" tmux") >= 0) {
          return false;
        } else {
          return true;
        }
      }, (error) => {
        return true;
      });
    }
  }
  return Promise.resolve(true);
}
var ShellType = /* @__PURE__ */ ((ShellType2) => {
  ShellType2[ShellType2["cmd"] = 0] = "cmd";
  ShellType2[ShellType2["powershell"] = 1] = "powershell";
  ShellType2[ShellType2["bash"] = 2] = "bash";
  return ShellType2;
})(ShellType || {});
function prepareCommand(shell, args, argsCanBeInterpretedByShell, cwd, env) {
  shell = shell.trim().toLowerCase();
  let shellType;
  if (shell.indexOf("powershell") >= 0 || shell.indexOf("pwsh") >= 0) {
    shellType = 1 /* powershell */;
  } else if (shell.indexOf("cmd.exe") >= 0) {
    shellType = 0 /* cmd */;
  } else if (shell.indexOf("bash") >= 0) {
    shellType = 2 /* bash */;
  } else if (platform.isWindows) {
    shellType = 0 /* cmd */;
  } else {
    shellType = 2 /* bash */;
  }
  let quote;
  let command = " ";
  switch (shellType) {
    case 1 /* powershell */:
      quote = (s) => {
        s = s.replace(/\'/g, "''");
        if (s.length > 0 && s.charAt(s.length - 1) === "\\") {
          return `'${s}\\'`;
        }
        return `'${s}'`;
      };
      if (cwd) {
        const driveLetter = getDriveLetter(cwd);
        if (driveLetter) {
          command += `${driveLetter}:; `;
        }
        command += `cd ${quote(cwd)}; `;
      }
      if (env) {
        for (const key in env) {
          const value = env[key];
          if (value === null) {
            command += `Remove-Item env:${key}; `;
          } else {
            command += `\${env:${key}}='${value}'; `;
          }
        }
      }
      if (args.length > 0) {
        const arg = args.shift();
        const cmd = argsCanBeInterpretedByShell ? arg : quote(arg);
        command += cmd[0] === "'" ? `& ${cmd} ` : `${cmd} `;
        for (const a of args) {
          command += a === "<" || a === ">" || argsCanBeInterpretedByShell ? a : quote(a);
          command += " ";
        }
      }
      break;
    case 0 /* cmd */:
      quote = (s) => {
        s = s.replace(/\"/g, '""');
        s = s.replace(/([><!^&|])/g, "^$1");
        return ' "'.split("").some((char) => s.includes(char)) || s.length === 0 ? `"${s}"` : s;
      };
      if (cwd) {
        const driveLetter = getDriveLetter(cwd);
        if (driveLetter) {
          command += `${driveLetter}: && `;
        }
        command += `cd ${quote(cwd)} && `;
      }
      if (env) {
        command += 'cmd /C "';
        for (const key in env) {
          let value = env[key];
          if (value === null) {
            command += `set "${key}=" && `;
          } else {
            value = value.replace(/[&^|<>]/g, (s) => `^${s}`);
            command += `set "${key}=${value}" && `;
          }
        }
      }
      for (const a of args) {
        command += a === "<" || a === ">" || argsCanBeInterpretedByShell ? a : quote(a);
        command += " ";
      }
      if (env) {
        command += '"';
      }
      break;
    case 2 /* bash */: {
      quote = (s) => {
        s = s.replace(/(["'\\\$!><#()\[\]*&^| ;{}?`])/g, "\\$1");
        return s.length === 0 ? `""` : s;
      };
      const hardQuote = (s) => {
        return /[^\w@%\/+=,.:^-]/.test(s) ? `'${s.replace(/'/g, "'\\''")}'` : s;
      };
      if (cwd) {
        command += `cd ${quote(cwd)} ; `;
      }
      if (env) {
        command += "/usr/bin/env";
        for (const key in env) {
          const value = env[key];
          if (value === null) {
            command += ` -u ${hardQuote(key)}`;
          } else {
            command += ` ${hardQuote(`${key}=${value}`)}`;
          }
        }
        command += " ";
      }
      for (const a of args) {
        command += a === "<" || a === ">" || argsCanBeInterpretedByShell ? a : quote(a);
        command += " ";
      }
      break;
    }
  }
  return command;
}
export {
  hasChildProcesses,
  prepareCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9ub2RlL3Rlcm1pbmFscy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGNwIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgZ2V0RHJpdmVMZXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcblxuZnVuY3Rpb24gc3Bhd25Bc1Byb21pc2VkKGNvbW1hbmQ6IHN0cmluZywgYXJnczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGxldCBzdGRvdXQgPSAnJztcblx0XHRjb25zdCBjaGlsZCA9IGNwLnNwYXduKGNvbW1hbmQsIGFyZ3MpO1xuXHRcdGlmIChjaGlsZC5waWQpIHtcblx0XHRcdGNoaWxkLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcblx0XHRcdFx0c3Rkb3V0ICs9IGRhdGEudG9TdHJpbmcoKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRjaGlsZC5vbignZXJyb3InLCBlcnIgPT4ge1xuXHRcdFx0cmVqZWN0KGVycik7XG5cdFx0fSk7XG5cdFx0Y2hpbGQub24oJ2Nsb3NlJywgY29kZSA9PiB7XG5cdFx0XHRyZXNvbHZlKHN0ZG91dCk7XG5cdFx0fSk7XG5cdH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFzQ2hpbGRQcm9jZXNzZXMocHJvY2Vzc0lkOiBudW1iZXIgfCB1bmRlZmluZWQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0aWYgKHByb2Nlc3NJZCkge1xuXG5cdFx0Ly8gaWYgc2hlbGwgaGFzIGF0IGxlYXN0IG9uZSBjaGlsZCBwcm9jZXNzLCBhc3N1bWUgdGhhdCBzaGVsbCBpcyBidXN5XG5cdFx0aWYgKHBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0Y29uc3Qgd2luZG93c1Byb2Nlc3NUcmVlID0gYXdhaXQgaW1wb3J0KCdAdnNjb2RlL3dpbmRvd3MtcHJvY2Vzcy10cmVlJyk7XG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHdpbmRvd3NQcm9jZXNzVHJlZS5nZXRQcm9jZXNzVHJlZShwcm9jZXNzSWQsIHByb2Nlc3NUcmVlID0+IHtcblx0XHRcdFx0XHRyZXNvbHZlKCEhcHJvY2Vzc1RyZWUgJiYgcHJvY2Vzc1RyZWUuY2hpbGRyZW4ubGVuZ3RoID4gMCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBzcGF3bkFzUHJvbWlzZWQoJy91c3IvYmluL3BncmVwJywgWyctbFAnLCBTdHJpbmcocHJvY2Vzc0lkKV0pLnRoZW4oc3Rkb3V0ID0+IHtcblx0XHRcdFx0Y29uc3QgciA9IHN0ZG91dC50cmltKCk7XG5cdFx0XHRcdGlmIChyLmxlbmd0aCA9PT0gMCB8fCByLmluZGV4T2YoJyB0bXV4JykgPj0gMCkgeyAvLyBpZ25vcmUgJ3RtdXgnOyBzZWUgIzQzNjgzXG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBlcnJvciA9PiB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cdC8vIGZhbGwgYmFjayB0byBzYWZlIHNpZGVcblx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcbn1cblxuY29uc3QgZW51bSBTaGVsbFR5cGUgeyBjbWQsIHBvd2Vyc2hlbGwsIGJhc2ggfVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlQ29tbWFuZChzaGVsbDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSwgYXJnc0NhbkJlSW50ZXJwcmV0ZWRCeVNoZWxsOiBib29sZWFuLCBjd2Q/OiBzdHJpbmcsIGVudj86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgbnVsbCB9KTogc3RyaW5nIHtcblxuXHRzaGVsbCA9IHNoZWxsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG5cdC8vIHRyeSB0byBkZXRlcm1pbmUgdGhlIHNoZWxsIHR5cGVcblx0bGV0IHNoZWxsVHlwZTtcblx0aWYgKHNoZWxsLmluZGV4T2YoJ3Bvd2Vyc2hlbGwnKSA+PSAwIHx8IHNoZWxsLmluZGV4T2YoJ3B3c2gnKSA+PSAwKSB7XG5cdFx0c2hlbGxUeXBlID0gU2hlbGxUeXBlLnBvd2Vyc2hlbGw7XG5cdH0gZWxzZSBpZiAoc2hlbGwuaW5kZXhPZignY21kLmV4ZScpID49IDApIHtcblx0XHRzaGVsbFR5cGUgPSBTaGVsbFR5cGUuY21kO1xuXHR9IGVsc2UgaWYgKHNoZWxsLmluZGV4T2YoJ2Jhc2gnKSA+PSAwKSB7XG5cdFx0c2hlbGxUeXBlID0gU2hlbGxUeXBlLmJhc2g7XG5cdH0gZWxzZSBpZiAocGxhdGZvcm0uaXNXaW5kb3dzKSB7XG5cdFx0c2hlbGxUeXBlID0gU2hlbGxUeXBlLmNtZDsgLy8gcGljayBhIGdvb2QgZGVmYXVsdCBmb3IgV2luZG93c1xuXHR9IGVsc2Uge1xuXHRcdHNoZWxsVHlwZSA9IFNoZWxsVHlwZS5iYXNoO1x0Ly8gcGljayBhIGdvb2QgZGVmYXVsdCBmb3IgYW55dGhpbmcgZWxzZVxuXHR9XG5cblx0bGV0IHF1b3RlOiAoczogc3RyaW5nKSA9PiBzdHJpbmc7XG5cdC8vIGJlZ2luIGNvbW1hbmQgd2l0aCBhIHNwYWNlIHRvIGF2b2lkIHBvbGx1dGluZyBzaGVsbCBoaXN0b3J5XG5cdGxldCBjb21tYW5kID0gJyAnO1xuXG5cdHN3aXRjaCAoc2hlbGxUeXBlKSB7XG5cblx0XHRjYXNlIFNoZWxsVHlwZS5wb3dlcnNoZWxsOlxuXG5cdFx0XHRxdW90ZSA9IChzOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0cyA9IHMucmVwbGFjZSgvXFwnL2csICdcXCdcXCcnKTtcblx0XHRcdFx0aWYgKHMubGVuZ3RoID4gMCAmJiBzLmNoYXJBdChzLmxlbmd0aCAtIDEpID09PSAnXFxcXCcpIHtcblx0XHRcdFx0XHRyZXR1cm4gYCcke3N9XFxcXCdgO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBgJyR7c30nYDtcblx0XHRcdH07XG5cblx0XHRcdGlmIChjd2QpIHtcblx0XHRcdFx0Y29uc3QgZHJpdmVMZXR0ZXIgPSBnZXREcml2ZUxldHRlcihjd2QpO1xuXHRcdFx0XHRpZiAoZHJpdmVMZXR0ZXIpIHtcblx0XHRcdFx0XHRjb21tYW5kICs9IGAke2RyaXZlTGV0dGVyfTo7IGA7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tbWFuZCArPSBgY2QgJHtxdW90ZShjd2QpfTsgYDtcblx0XHRcdH1cblx0XHRcdGlmIChlbnYpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBrZXkgaW4gZW52KSB7XG5cdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSBlbnZba2V5XTtcblx0XHRcdFx0XHRpZiAodmFsdWUgPT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGNvbW1hbmQgKz0gYFJlbW92ZS1JdGVtIGVudjoke2tleX07IGA7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbW1hbmQgKz0gYFxcJHtlbnY6JHtrZXl9fT0nJHt2YWx1ZX0nOyBgO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGFyZ3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBhcmcgPSBhcmdzLnNoaWZ0KCkhO1xuXHRcdFx0XHRjb25zdCBjbWQgPSBhcmdzQ2FuQmVJbnRlcnByZXRlZEJ5U2hlbGwgPyBhcmcgOiBxdW90ZShhcmcpO1xuXHRcdFx0XHRjb21tYW5kICs9IChjbWRbMF0gPT09ICdcXCcnKSA/IGAmICR7Y21kfSBgIDogYCR7Y21kfSBgO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGEgb2YgYXJncykge1xuXHRcdFx0XHRcdGNvbW1hbmQgKz0gKGEgPT09ICc8JyB8fCBhID09PSAnPicgfHwgYXJnc0NhbkJlSW50ZXJwcmV0ZWRCeVNoZWxsKSA/IGEgOiBxdW90ZShhKTtcblx0XHRcdFx0XHRjb21tYW5kICs9ICcgJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YnJlYWs7XG5cblx0XHRjYXNlIFNoZWxsVHlwZS5jbWQ6XG5cblx0XHRcdHF1b3RlID0gKHM6IHN0cmluZykgPT4ge1xuXHRcdFx0XHQvLyBOb3RlOiBXcmFwcGluZyBpbiBjbWQgL0MgXCIuLi5cIiBjb21wbGljYXRlcyB0aGUgZXNjYXBpbmcuXG5cdFx0XHRcdC8vIGNtZCAvQyBcIm5vZGUgLWUgXCJjb25zb2xlLmxvZyhwcm9jZXNzLmFyZ3YpXCIgXCJcIlwiQV4+MFwiXCJcIlwiICMgcHJpbnRzIFwiQT4wXCJcblx0XHRcdFx0Ly8gY21kIC9DIFwibm9kZSAtZSBcImNvbnNvbGUubG9nKHByb2Nlc3MuYXJndilcIiBcImZvb14+IGJhclwiXCIgIyBwcmludHMgZm9vPiBiYXJcblx0XHRcdFx0Ly8gT3V0c2lkZSBvZiB0aGUgY21kIC9DLCBpdCBjb3VsZCBiZSBhIHNpbXBsZSBxdW90aW5nLCBidXQgaGVyZSwgdGhlIF4gaXMgbmVlZGVkIHRvb1xuXHRcdFx0XHRzID0gcy5yZXBsYWNlKC9cXFwiL2csICdcIlwiJyk7XG5cdFx0XHRcdHMgPSBzLnJlcGxhY2UoLyhbPjwhXiZ8XSkvZywgJ14kMScpO1xuXHRcdFx0XHRyZXR1cm4gKCcgXCInLnNwbGl0KCcnKS5zb21lKGNoYXIgPT4gcy5pbmNsdWRlcyhjaGFyKSkgfHwgcy5sZW5ndGggPT09IDApID8gYFwiJHtzfVwiYCA6IHM7XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoY3dkKSB7XG5cdFx0XHRcdGNvbnN0IGRyaXZlTGV0dGVyID0gZ2V0RHJpdmVMZXR0ZXIoY3dkKTtcblx0XHRcdFx0aWYgKGRyaXZlTGV0dGVyKSB7XG5cdFx0XHRcdFx0Y29tbWFuZCArPSBgJHtkcml2ZUxldHRlcn06ICYmIGA7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tbWFuZCArPSBgY2QgJHtxdW90ZShjd2QpfSAmJiBgO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGVudikge1xuXHRcdFx0XHRjb21tYW5kICs9ICdjbWQgL0MgXCInO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBlbnYpIHtcblx0XHRcdFx0XHRsZXQgdmFsdWUgPSBlbnZba2V5XTtcblx0XHRcdFx0XHRpZiAodmFsdWUgPT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGNvbW1hbmQgKz0gYHNldCBcIiR7a2V5fT1cIiAmJiBgO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1smXnw8Pl0vZywgcyA9PiBgXiR7c31gKTtcblx0XHRcdFx0XHRcdGNvbW1hbmQgKz0gYHNldCBcIiR7a2V5fT0ke3ZhbHVlfVwiICYmIGA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGEgb2YgYXJncykge1xuXHRcdFx0XHRjb21tYW5kICs9IChhID09PSAnPCcgfHwgYSA9PT0gJz4nIHx8IGFyZ3NDYW5CZUludGVycHJldGVkQnlTaGVsbCkgPyBhIDogcXVvdGUoYSk7XG5cdFx0XHRcdGNvbW1hbmQgKz0gJyAnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGVudikge1xuXHRcdFx0XHRjb21tYW5kICs9ICdcIic7XG5cdFx0XHR9XG5cdFx0XHRicmVhaztcblxuXHRcdGNhc2UgU2hlbGxUeXBlLmJhc2g6IHtcblxuXHRcdFx0cXVvdGUgPSAoczogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdHMgPSBzLnJlcGxhY2UoLyhbXCInXFxcXFxcJCE+PCMoKVxcW1xcXSomXnwgO3t9P2BdKS9nLCAnXFxcXCQxJyk7XG5cdFx0XHRcdHJldHVybiBzLmxlbmd0aCA9PT0gMCA/IGBcIlwiYCA6IHM7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBoYXJkUXVvdGUgPSAoczogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdHJldHVybiAvW15cXHdAJVxcLys9LC46Xi1dLy50ZXN0KHMpID8gYCcke3MucmVwbGFjZSgvJy9nLCAnXFwnXFxcXFxcJ1xcJycpfSdgIDogcztcblx0XHRcdH07XG5cblx0XHRcdGlmIChjd2QpIHtcblx0XHRcdFx0Y29tbWFuZCArPSBgY2QgJHtxdW90ZShjd2QpfSA7IGA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZW52KSB7XG5cdFx0XHRcdGNvbW1hbmQgKz0gJy91c3IvYmluL2Vudic7XG5cdFx0XHRcdGZvciAoY29uc3Qga2V5IGluIGVudikge1xuXHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gZW52W2tleV07XG5cdFx0XHRcdFx0aWYgKHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRjb21tYW5kICs9IGAgLXUgJHtoYXJkUXVvdGUoa2V5KX1gO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb21tYW5kICs9IGAgJHtoYXJkUXVvdGUoYCR7a2V5fT0ke3ZhbHVlfWApfWA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbW1hbmQgKz0gJyAnO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBhIG9mIGFyZ3MpIHtcblx0XHRcdFx0Y29tbWFuZCArPSAoYSA9PT0gJzwnIHx8IGEgPT09ICc+JyB8fCBhcmdzQ2FuQmVJbnRlcnByZXRlZEJ5U2hlbGwpID8gYSA6IHF1b3RlKGEpO1xuXHRcdFx0XHRjb21tYW5kICs9ICcgJztcblx0XHRcdH1cblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBjb21tYW5kO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsc0JBQXNCO0FBQy9CLFlBQVksY0FBYztBQUUxQixTQUFTLGdCQUFnQixTQUFpQixNQUFpQztBQUMxRSxTQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUN2QyxRQUFJLFNBQVM7QUFDYixVQUFNLFFBQVEsR0FBRyxNQUFNLFNBQVMsSUFBSTtBQUNwQyxRQUFJLE1BQU0sS0FBSztBQUNkLFlBQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxTQUFpQjtBQUN6QyxrQkFBVSxLQUFLLFNBQVM7QUFBQSxNQUN6QixDQUFDO0FBQUEsSUFDRjtBQUNBLFVBQU0sR0FBRyxTQUFTLFNBQU87QUFDeEIsYUFBTyxHQUFHO0FBQUEsSUFDWCxDQUFDO0FBQ0QsVUFBTSxHQUFHLFNBQVMsVUFBUTtBQUN6QixjQUFRLE1BQU07QUFBQSxJQUNmLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRjtBQUVBLGVBQXNCLGtCQUFrQixXQUFpRDtBQUN4RixNQUFJLFdBQVc7QUFHZCxRQUFJLFNBQVMsV0FBVztBQUN2QixZQUFNLHFCQUFxQixNQUFNLE9BQU8sOEJBQThCO0FBQ3RFLGFBQU8sSUFBSSxRQUFpQixhQUFXO0FBQ3RDLDJCQUFtQixlQUFlLFdBQVcsaUJBQWU7QUFDM0Qsa0JBQVEsQ0FBQyxDQUFDLGVBQWUsWUFBWSxTQUFTLFNBQVMsQ0FBQztBQUFBLFFBQ3pELENBQUM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNGLE9BQU87QUFDTixhQUFPLGdCQUFnQixrQkFB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QzFCO0FBQ0EsbUJBQVcsTUFBTSxNQUFNLEdBQUcsQ0FBQztBQUFBLE1BQzVCO0FBQ0EsVUFBSSxLQUFLO0FBQ1IsbUJBQVc7QUFDWCxtQkFBVyxPQUFPLEtBQUs7QUFDdEIsY0FBSSxRQUFRLElBQUksR0FBRztBQUNuQixjQUFJLFVBQVUsTUFBTTtBQUNuQix1QkFBVyxRQUFRLEdBQUc7QUFBQSxVQUN2QixPQUFPO0FBQ04sb0JBQVEsTUFBTSxRQUFRLFlBQVksT0FBSyxJQUFJLENBQUMsRUFBRTtBQUM5Qyx1QkFBVyxRQUFRLEdBQUcsSUFBSSxLQUFLO0FBQUEsVUFDaEM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUNBLGlCQUFXLEtBQUssTUFBTTtBQUNyQixtQkFBWSxNQUFNLE9BQU8sTUFBTSxPQUFPLDhCQUErQixJQUFJLE1BQU0sQ0FBQztBQUNoRixtQkFBVztBQUFBLE1BQ1o7QUFDQSxVQUFJLEtBQUs7QUFDUixtQkFBVztBQUFBLE1BQ1o7QUFDQTtBQUFBLElBRUQsS0FBSyxjQUFnQjtBQUVwQixjQUFRLENBQUMsTUFBYztBQUN0QixZQUFJLEVBQUUsUUFBUSxtQ0FBbUMsTUFBTTtBQUN2RCxlQUFPLEVBQUUsV0FBVyxJQUFJLE9BQU87QUFBQSxNQUNoQztBQUVBLFlBQU0sWUFBWSxDQUFDLE1BQWM7QUFDaEMsZUFBTyxtQkFBbUIsS0FBSyxDQUFDLElBQUksSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFVLENBQUMsTUFBTTtBQUFBLE1BQzFFO0FBRUEsVUFBSSxLQUFLO0FBQ1IsbUJBQVcsTUFBTSxNQUFNLEdBQUcsQ0FBQztBQUFBLE1BQzVCO0FBQ0EsVUFBSSxLQUFLO0FBQ1IsbUJBQVc7QUFDWCxtQkFBVyxPQUFPLEtBQUs7QUFDdEIsZ0JBQU0sUUFBUSxJQUFJLEdBQUc7QUFDckIsY0FBSSxVQUFVLE1BQU07QUFDbkIsdUJBQVcsT0FBTyxVQUFVLEdBQUcsQ0FBQztBQUFBLFVBQ2pDLE9BQU87QUFDTix1QkFBVyxJQUFJLFVBQVUsR0FBRyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7QUFBQSxVQUM1QztBQUFBLFFBQ0Q7QUFDQSxtQkFBVztBQUFBLE1BQ1o7QUFDQSxpQkFBVyxLQUFLLE1BQU07QUFDckIsbUJBQVksTUFBTSxPQUFPLE1BQU0sT0FBTyw4QkFBK0IsSUFBSSxNQUFNLENBQUM7QUFDaEYsbUJBQVc7QUFBQSxNQUNaO0FBQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFsiU2hlbGxUeXBlIl0KfQo=
