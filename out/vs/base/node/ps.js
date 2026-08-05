import { exec } from "child_process";
import { FileAccess } from "../common/network.js";
function listProcesses(rootPid) {
  return new Promise((resolve, reject) => {
    let rootItem;
    const map = /* @__PURE__ */ new Map();
    function addToTree(pid, ppid, cmd, load, mem) {
      const parent = map.get(ppid);
      if (pid === rootPid || parent) {
        const item = {
          name: findName(cmd),
          cmd,
          pid,
          ppid,
          load,
          mem
        };
        map.set(pid, item);
        if (pid === rootPid) {
          rootItem = item;
        }
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(item);
          if (parent.children.length > 1) {
            parent.children = parent.children.sort((a, b) => a.pid - b.pid);
          }
        }
      }
    }
    function findName(cmd) {
      const UTILITY_NETWORK_HINT = /--utility-sub-type=network/i;
      const WINDOWS_CRASH_REPORTER = /--crashes-directory/i;
      const WINPTY = /\\pipe\\winpty-control/i;
      const CONPTY = /conhost\.exe.+--headless/i;
      const TYPE = /--type=([a-zA-Z-]+)/;
      if (WINDOWS_CRASH_REPORTER.exec(cmd)) {
        return "electron-crash-reporter";
      }
      if (WINPTY.exec(cmd)) {
        return "winpty-agent";
      }
      if (CONPTY.exec(cmd)) {
        return "conpty-agent";
      }
      let matches = TYPE.exec(cmd);
      if (matches && matches.length === 2) {
        if (matches[1] === "renderer") {
          return `window`;
        } else if (matches[1] === "utility") {
          if (UTILITY_NETWORK_HINT.exec(cmd)) {
            return "utility-network-service";
          }
          return "utility-process";
        } else if (matches[1] === "extensionHost") {
          return "extension-host";
        }
        return matches[1];
      }
      const JS = /[a-zA-Z-]+\.js/g;
      let result = "";
      do {
        matches = JS.exec(cmd);
        if (matches) {
          result += matches + " ";
        }
      } while (matches);
      if (result) {
        if (cmd.indexOf("node ") < 0 && cmd.indexOf("node.exe") < 0) {
          return `electron-nodejs (${result})`;
        }
      }
      return cmd;
    }
    if (process.platform === "win32") {
      const cleanUNCPrefix = (value) => {
        if (value.indexOf("\\\\?\\") === 0) {
          return value.substring(4);
        } else if (value.indexOf("\\??\\") === 0) {
          return value.substring(4);
        } else if (value.indexOf('"\\\\?\\') === 0) {
          return '"' + value.substring(5);
        } else if (value.indexOf('"\\??\\') === 0) {
          return '"' + value.substring(5);
        } else {
          return value;
        }
      };
      import("@vscode/windows-process-tree").then((windowsProcessTree) => {
        windowsProcessTree.getProcessList(rootPid, (processList) => {
          if (!processList) {
            reject(new Error(`Root process ${rootPid} not found`));
            return;
          }
          windowsProcessTree.getProcessCpuUsage(processList, (completeProcessList) => {
            const processItems = /* @__PURE__ */ new Map();
            completeProcessList.forEach((process2) => {
              const commandLine = cleanUNCPrefix(process2.commandLine || "");
              processItems.set(process2.pid, {
                name: findName(commandLine),
                cmd: commandLine,
                pid: process2.pid,
                ppid: process2.ppid,
                load: process2.cpu || 0,
                mem: process2.memory || 0
              });
            });
            rootItem = processItems.get(rootPid);
            if (rootItem) {
              processItems.forEach((item) => {
                const parent = processItems.get(item.ppid);
                if (parent) {
                  if (!parent.children) {
                    parent.children = [];
                  }
                  parent.children.push(item);
                }
              });
              processItems.forEach((item) => {
                if (item.children) {
                  item.children = item.children.sort((a, b) => a.pid - b.pid);
                }
              });
              resolve(rootItem);
            } else {
              reject(new Error(`Root process ${rootPid} not found`));
            }
          });
        }, windowsProcessTree.ProcessDataFlag.CommandLine | windowsProcessTree.ProcessDataFlag.Memory);
      });
    } else {
      let calculateLinuxCpuUsage2 = function() {
        let processes = [rootItem];
        const pids = [];
        while (processes.length) {
          const process2 = processes.shift();
          if (process2) {
            pids.push(process2.pid);
            if (process2.children) {
              processes = processes.concat(process2.children);
            }
          }
        }
        let cmd = JSON.stringify(FileAccess.asFileUri("vs/base/node/cpuUsage.sh").fsPath);
        cmd += " " + pids.join(" ");
        exec(cmd, {}, (err, stdout, stderr) => {
          if (err || stderr) {
            reject(err || new Error(stderr.toString()));
          } else {
            const cpuUsage = stdout.toString().split("\n");
            for (let i = 0; i < pids.length; i++) {
              const processInfo = map.get(pids[i]);
              processInfo.load = parseFloat(cpuUsage[i]);
            }
            if (!rootItem) {
              reject(new Error(`Root process ${rootPid} not found`));
              return;
            }
            resolve(rootItem);
          }
        });
      };
      var calculateLinuxCpuUsage = calculateLinuxCpuUsage2;
      exec("which ps", {}, (err, stdout, stderr) => {
        if (err || stderr) {
          if (process.platform !== "linux") {
            reject(err || new Error(stderr.toString()));
          } else {
            const cmd = JSON.stringify(FileAccess.asFileUri("vs/base/node/ps.sh").fsPath);
            exec(cmd, {}, (err2, stdout2, stderr2) => {
              if (err2 || stderr2) {
                reject(err2 || new Error(stderr2.toString()));
              } else {
                parsePsOutput(stdout2, addToTree);
                calculateLinuxCpuUsage2();
              }
            });
          }
        } else {
          const ps = stdout.toString().trim();
          const args = "-ax -o pid=,ppid=,pcpu=,pmem=,command=";
          exec(`${ps} ${args}`, { maxBuffer: 1e3 * 1024, env: { LC_NUMERIC: "en_US.UTF-8" } }, (err2, stdout2, stderr2) => {
            if (err2 || stderr2 && !stderr2.includes("screen size is bogus")) {
              reject(err2 || new Error(stderr2.toString()));
            } else {
              parsePsOutput(stdout2, addToTree);
              if (process.platform === "linux") {
                calculateLinuxCpuUsage2();
              } else {
                if (!rootItem) {
                  reject(new Error(`Root process ${rootPid} not found`));
                } else {
                  resolve(rootItem);
                }
              }
            }
          });
        }
      });
    }
  });
}
function parsePsOutput(stdout, addToTree) {
  const PID_CMD = /^\s*([0-9]+)\s+([0-9]+)\s+([0-9]+\.[0-9]+)\s+([0-9]+\.[0-9]+)\s+(.+)$/;
  const lines = stdout.toString().split("\n");
  for (const line of lines) {
    const matches = PID_CMD.exec(line.trim());
    if (matches && matches.length === 6) {
      addToTree(parseInt(matches[1]), parseInt(matches[2]), matches[5], parseFloat(matches[3]), parseFloat(matches[4]));
    }
  }
}
export {
  listProcesses
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL25vZGUvcHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgUHJvY2Vzc0l0ZW0gfSBmcm9tICcuLi9jb21tb24vcHJvY2Vzc2VzLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RQcm9jZXNzZXMocm9vdFBpZDogbnVtYmVyKTogUHJvbWlzZTxQcm9jZXNzSXRlbT4ge1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblx0XHRsZXQgcm9vdEl0ZW06IFByb2Nlc3NJdGVtIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1hcCA9IG5ldyBNYXA8bnVtYmVyLCBQcm9jZXNzSXRlbT4oKTtcblxuXG5cdFx0ZnVuY3Rpb24gYWRkVG9UcmVlKHBpZDogbnVtYmVyLCBwcGlkOiBudW1iZXIsIGNtZDogc3RyaW5nLCBsb2FkOiBudW1iZXIsIG1lbTogbnVtYmVyKSB7XG5cblx0XHRcdGNvbnN0IHBhcmVudCA9IG1hcC5nZXQocHBpZCk7XG5cdFx0XHRpZiAocGlkID09PSByb290UGlkIHx8IHBhcmVudCkge1xuXG5cdFx0XHRcdGNvbnN0IGl0ZW06IFByb2Nlc3NJdGVtID0ge1xuXHRcdFx0XHRcdG5hbWU6IGZpbmROYW1lKGNtZCksXG5cdFx0XHRcdFx0Y21kLFxuXHRcdFx0XHRcdHBpZCxcblx0XHRcdFx0XHRwcGlkLFxuXHRcdFx0XHRcdGxvYWQsXG5cdFx0XHRcdFx0bWVtXG5cdFx0XHRcdH07XG5cdFx0XHRcdG1hcC5zZXQocGlkLCBpdGVtKTtcblxuXHRcdFx0XHRpZiAocGlkID09PSByb290UGlkKSB7XG5cdFx0XHRcdFx0cm9vdEl0ZW0gPSBpdGVtO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRcdGlmICghcGFyZW50LmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRwYXJlbnQuY2hpbGRyZW4gPSBbXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cGFyZW50LmNoaWxkcmVuLnB1c2goaXRlbSk7XG5cdFx0XHRcdFx0aWYgKHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdFx0XHRwYXJlbnQuY2hpbGRyZW4gPSBwYXJlbnQuY2hpbGRyZW4uc29ydCgoYSwgYikgPT4gYS5waWQgLSBiLnBpZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZmluZE5hbWUoY21kOiBzdHJpbmcpOiBzdHJpbmcge1xuXG5cdFx0XHRjb25zdCBVVElMSVRZX05FVFdPUktfSElOVCA9IC8tLXV0aWxpdHktc3ViLXR5cGU9bmV0d29yay9pO1xuXHRcdFx0Y29uc3QgV0lORE9XU19DUkFTSF9SRVBPUlRFUiA9IC8tLWNyYXNoZXMtZGlyZWN0b3J5L2k7XG5cdFx0XHRjb25zdCBXSU5QVFkgPSAvXFxcXHBpcGVcXFxcd2lucHR5LWNvbnRyb2wvaTtcblx0XHRcdGNvbnN0IENPTlBUWSA9IC9jb25ob3N0XFwuZXhlListLWhlYWRsZXNzL2k7XG5cdFx0XHRjb25zdCBUWVBFID0gLy0tdHlwZT0oW2EtekEtWi1dKykvO1xuXG5cdFx0XHQvLyBmaW5kIHdpbmRvd3MgY3Jhc2ggcmVwb3J0ZXJcblx0XHRcdGlmIChXSU5ET1dTX0NSQVNIX1JFUE9SVEVSLmV4ZWMoY21kKSkge1xuXHRcdFx0XHRyZXR1cm4gJ2VsZWN0cm9uLWNyYXNoLXJlcG9ydGVyJztcblx0XHRcdH1cblxuXHRcdFx0Ly8gZmluZCB3aW5wdHkgcHJvY2Vzc1xuXHRcdFx0aWYgKFdJTlBUWS5leGVjKGNtZCkpIHtcblx0XHRcdFx0cmV0dXJuICd3aW5wdHktYWdlbnQnO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBmaW5kIGNvbnB0eSBwcm9jZXNzXG5cdFx0XHRpZiAoQ09OUFRZLmV4ZWMoY21kKSkge1xuXHRcdFx0XHRyZXR1cm4gJ2NvbnB0eS1hZ2VudCc7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGZpbmQgXCItLXR5cGU9eHh4eFwiXG5cdFx0XHRsZXQgbWF0Y2hlcyA9IFRZUEUuZXhlYyhjbWQpO1xuXHRcdFx0aWYgKG1hdGNoZXMgJiYgbWF0Y2hlcy5sZW5ndGggPT09IDIpIHtcblx0XHRcdFx0aWYgKG1hdGNoZXNbMV0gPT09ICdyZW5kZXJlcicpIHtcblx0XHRcdFx0XHRyZXR1cm4gYHdpbmRvd2A7XG5cdFx0XHRcdH0gZWxzZSBpZiAobWF0Y2hlc1sxXSA9PT0gJ3V0aWxpdHknKSB7XG5cdFx0XHRcdFx0aWYgKFVUSUxJVFlfTkVUV09SS19ISU5ULmV4ZWMoY21kKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuICd1dGlsaXR5LW5ldHdvcmstc2VydmljZSc7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuICd1dGlsaXR5LXByb2Nlc3MnO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG1hdGNoZXNbMV0gPT09ICdleHRlbnNpb25Ib3N0Jykge1xuXHRcdFx0XHRcdHJldHVybiAnZXh0ZW5zaW9uLWhvc3QnOyAvLyBub3JtYWxpemUgcmVtb3RlIGV4dGVuc2lvbiBob3N0IHR5cGVcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbWF0Y2hlc1sxXTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZmluZCBhbGwgeHh4eC5qc1xuXHRcdFx0Y29uc3QgSlMgPSAvW2EtekEtWi1dK1xcLmpzL2c7XG5cdFx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdG1hdGNoZXMgPSBKUy5leGVjKGNtZCk7XG5cdFx0XHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRcdFx0cmVzdWx0ICs9IG1hdGNoZXMgKyAnICc7XG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKG1hdGNoZXMpO1xuXG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGlmIChjbWQuaW5kZXhPZignbm9kZSAnKSA8IDAgJiYgY21kLmluZGV4T2YoJ25vZGUuZXhlJykgPCAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGBlbGVjdHJvbi1ub2RlanMgKCR7cmVzdWx0fSlgO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjbWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcblxuXHRcdFx0Y29uc3QgY2xlYW5VTkNQcmVmaXggPSAodmFsdWU6IHN0cmluZyk6IHN0cmluZyA9PiB7XG5cdFx0XHRcdGlmICh2YWx1ZS5pbmRleE9mKCdcXFxcXFxcXD9cXFxcJykgPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gdmFsdWUuc3Vic3RyaW5nKDQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlLmluZGV4T2YoJ1xcXFw/P1xcXFwnKSA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiB2YWx1ZS5zdWJzdHJpbmcoNCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodmFsdWUuaW5kZXhPZignXCJcXFxcXFxcXD9cXFxcJykgPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gJ1wiJyArIHZhbHVlLnN1YnN0cmluZyg1KTtcblx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZS5pbmRleE9mKCdcIlxcXFw/P1xcXFwnKSA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiAnXCInICsgdmFsdWUuc3Vic3RyaW5nKDUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0KGltcG9ydCgnQHZzY29kZS93aW5kb3dzLXByb2Nlc3MtdHJlZScpKS50aGVuKHdpbmRvd3NQcm9jZXNzVHJlZSA9PiB7XG5cdFx0XHRcdHdpbmRvd3NQcm9jZXNzVHJlZS5nZXRQcm9jZXNzTGlzdChyb290UGlkLCAocHJvY2Vzc0xpc3QpID0+IHtcblx0XHRcdFx0XHRpZiAoIXByb2Nlc3NMaXN0KSB7XG5cdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKGBSb290IHByb2Nlc3MgJHtyb290UGlkfSBub3QgZm91bmRgKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHdpbmRvd3NQcm9jZXNzVHJlZS5nZXRQcm9jZXNzQ3B1VXNhZ2UocHJvY2Vzc0xpc3QsIChjb21wbGV0ZVByb2Nlc3NMaXN0KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBwcm9jZXNzSXRlbXM6IE1hcDxudW1iZXIsIFByb2Nlc3NJdGVtPiA9IG5ldyBNYXAoKTtcblx0XHRcdFx0XHRcdGNvbXBsZXRlUHJvY2Vzc0xpc3QuZm9yRWFjaChwcm9jZXNzID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29tbWFuZExpbmUgPSBjbGVhblVOQ1ByZWZpeChwcm9jZXNzLmNvbW1hbmRMaW5lIHx8ICcnKTtcblx0XHRcdFx0XHRcdFx0cHJvY2Vzc0l0ZW1zLnNldChwcm9jZXNzLnBpZCwge1xuXHRcdFx0XHRcdFx0XHRcdG5hbWU6IGZpbmROYW1lKGNvbW1hbmRMaW5lKSxcblx0XHRcdFx0XHRcdFx0XHRjbWQ6IGNvbW1hbmRMaW5lLFxuXHRcdFx0XHRcdFx0XHRcdHBpZDogcHJvY2Vzcy5waWQsXG5cdFx0XHRcdFx0XHRcdFx0cHBpZDogcHJvY2Vzcy5wcGlkLFxuXHRcdFx0XHRcdFx0XHRcdGxvYWQ6IHByb2Nlc3MuY3B1IHx8IDAsXG5cdFx0XHRcdFx0XHRcdFx0bWVtOiBwcm9jZXNzLm1lbW9yeSB8fCAwXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdHJvb3RJdGVtID0gcHJvY2Vzc0l0ZW1zLmdldChyb290UGlkKTtcblx0XHRcdFx0XHRcdGlmIChyb290SXRlbSkge1xuXHRcdFx0XHRcdFx0XHRwcm9jZXNzSXRlbXMuZm9yRWFjaChpdGVtID0+IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBwYXJlbnQgPSBwcm9jZXNzSXRlbXMuZ2V0KGl0ZW0ucHBpZCk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKCFwYXJlbnQuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cGFyZW50LmNoaWxkcmVuID0gW107XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRwYXJlbnQuY2hpbGRyZW4ucHVzaChpdGVtKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdHByb2Nlc3NJdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChpdGVtLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpdGVtLmNoaWxkcmVuID0gaXRlbS5jaGlsZHJlbi5zb3J0KChhLCBiKSA9PiBhLnBpZCAtIGIucGlkKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKHJvb3RJdGVtKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoYFJvb3QgcHJvY2VzcyAke3Jvb3RQaWR9IG5vdCBmb3VuZGApKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSwgd2luZG93c1Byb2Nlc3NUcmVlLlByb2Nlc3NEYXRhRmxhZy5Db21tYW5kTGluZSB8IHdpbmRvd3NQcm9jZXNzVHJlZS5Qcm9jZXNzRGF0YUZsYWcuTWVtb3J5KTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XHQvLyBPUyBYICYgTGludXhcblx0XHRcdGZ1bmN0aW9uIGNhbGN1bGF0ZUxpbnV4Q3B1VXNhZ2UoKSB7XG5cdFx0XHRcdC8vIEZsYXR0ZW4gcm9vdEl0ZW0gdG8gZ2V0IGEgbGlzdCBvZiBhbGwgVlNDb2RlIHByb2Nlc3Nlc1xuXHRcdFx0XHRsZXQgcHJvY2Vzc2VzID0gW3Jvb3RJdGVtXTtcblx0XHRcdFx0Y29uc3QgcGlkczogbnVtYmVyW10gPSBbXTtcblx0XHRcdFx0d2hpbGUgKHByb2Nlc3Nlcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRjb25zdCBwcm9jZXNzID0gcHJvY2Vzc2VzLnNoaWZ0KCk7XG5cdFx0XHRcdFx0aWYgKHByb2Nlc3MpIHtcblx0XHRcdFx0XHRcdHBpZHMucHVzaChwcm9jZXNzLnBpZCk7XG5cdFx0XHRcdFx0XHRpZiAocHJvY2Vzcy5jaGlsZHJlbikge1xuXHRcdFx0XHRcdFx0XHRwcm9jZXNzZXMgPSBwcm9jZXNzZXMuY29uY2F0KHByb2Nlc3MuY2hpbGRyZW4pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRoZSBjcHUgdXNhZ2UgdmFsdWUgcmVwb3J0ZWQgb24gTGludXggaXMgdGhlIGF2ZXJhZ2Ugb3ZlciB0aGUgcHJvY2VzcyBsaWZldGltZSxcblx0XHRcdFx0Ly8gcmVjYWxjdWxhdGUgdGhlIHVzYWdlIG92ZXIgYSBvbmUgc2Vjb25kIGludGVydmFsXG5cdFx0XHRcdC8vIEpTT04uc3RyaW5naWZ5IGlzIG5lZWRlZCB0byBlc2NhcGUgc3BhY2VzLCBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvaXNzdWVzLzY4MDNcblx0XHRcdFx0bGV0IGNtZCA9IEpTT04uc3RyaW5naWZ5KEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy9iYXNlL25vZGUvY3B1VXNhZ2Uuc2gnKS5mc1BhdGgpO1xuXHRcdFx0XHRjbWQgKz0gJyAnICsgcGlkcy5qb2luKCcgJyk7XG5cblx0XHRcdFx0ZXhlYyhjbWQsIHt9LCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuXHRcdFx0XHRcdGlmIChlcnIgfHwgc3RkZXJyKSB7XG5cdFx0XHRcdFx0XHRyZWplY3QoZXJyIHx8IG5ldyBFcnJvcihzdGRlcnIudG9TdHJpbmcoKSkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjcHVVc2FnZSA9IHN0ZG91dC50b1N0cmluZygpLnNwbGl0KCdcXG4nKTtcblx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcGlkcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBwcm9jZXNzSW5mbyA9IG1hcC5nZXQocGlkc1tpXSkhO1xuXHRcdFx0XHRcdFx0XHRwcm9jZXNzSW5mby5sb2FkID0gcGFyc2VGbG9hdChjcHVVc2FnZVtpXSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICghcm9vdEl0ZW0pIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihgUm9vdCBwcm9jZXNzICR7cm9vdFBpZH0gbm90IGZvdW5kYCkpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJlc29sdmUocm9vdEl0ZW0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGV4ZWMoJ3doaWNoIHBzJywge30sIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG5cdFx0XHRcdGlmIChlcnIgfHwgc3RkZXJyKSB7XG5cdFx0XHRcdFx0aWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcpIHtcblx0XHRcdFx0XHRcdHJlamVjdChlcnIgfHwgbmV3IEVycm9yKHN0ZGVyci50b1N0cmluZygpKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNtZCA9IEpTT04uc3RyaW5naWZ5KEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy9iYXNlL25vZGUvcHMuc2gnKS5mc1BhdGgpO1xuXHRcdFx0XHRcdFx0ZXhlYyhjbWQsIHt9LCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoZXJyIHx8IHN0ZGVycikge1xuXHRcdFx0XHRcdFx0XHRcdHJlamVjdChlcnIgfHwgbmV3IEVycm9yKHN0ZGVyci50b1N0cmluZygpKSk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyc2VQc091dHB1dChzdGRvdXQsIGFkZFRvVHJlZSk7XG5cdFx0XHRcdFx0XHRcdFx0Y2FsY3VsYXRlTGludXhDcHVVc2FnZSgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgcHMgPSBzdGRvdXQudG9TdHJpbmcoKS50cmltKCk7XG5cdFx0XHRcdFx0Y29uc3QgYXJncyA9ICctYXggLW8gcGlkPSxwcGlkPSxwY3B1PSxwbWVtPSxjb21tYW5kPSc7XG5cblx0XHRcdFx0XHQvLyBTZXQgbnVtZXJpYyBsb2NhbGUgdG8gZW5zdXJlICcuJyBpcyB1c2VkIGFzIHRoZSBkZWNpbWFsIHNlcGFyYXRvclxuXHRcdFx0XHRcdGV4ZWMoYCR7cHN9ICR7YXJnc31gLCB7IG1heEJ1ZmZlcjogMTAwMCAqIDEwMjQsIGVudjogeyBMQ19OVU1FUklDOiAnZW5fVVMuVVRGLTgnIH0gfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcblx0XHRcdFx0XHRcdC8vIFNpbGVudGx5IGlnbm9yaW5nIHRoZSBzY3JlZW4gc2l6ZSBpcyBib2d1cyBlcnJvci4gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85ODU5MFxuXHRcdFx0XHRcdFx0aWYgKGVyciB8fCAoc3RkZXJyICYmICFzdGRlcnIuaW5jbHVkZXMoJ3NjcmVlbiBzaXplIGlzIGJvZ3VzJykpKSB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdChlcnIgfHwgbmV3IEVycm9yKHN0ZGVyci50b1N0cmluZygpKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRwYXJzZVBzT3V0cHV0KHN0ZG91dCwgYWRkVG9UcmVlKTtcblxuXHRcdFx0XHRcdFx0XHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuXHRcdFx0XHRcdFx0XHRcdGNhbGN1bGF0ZUxpbnV4Q3B1VXNhZ2UoKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoIXJvb3RJdGVtKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKGBSb290IHByb2Nlc3MgJHtyb290UGlkfSBub3QgZm91bmRgKSk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlc29sdmUocm9vdEl0ZW0pO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBwYXJzZVBzT3V0cHV0KHN0ZG91dDogc3RyaW5nLCBhZGRUb1RyZWU6IChwaWQ6IG51bWJlciwgcHBpZDogbnVtYmVyLCBjbWQ6IHN0cmluZywgbG9hZDogbnVtYmVyLCBtZW06IG51bWJlcikgPT4gdm9pZCk6IHZvaWQge1xuXHRjb25zdCBQSURfQ01EID0gL15cXHMqKFswLTldKylcXHMrKFswLTldKylcXHMrKFswLTldK1xcLlswLTldKylcXHMrKFswLTldK1xcLlswLTldKylcXHMrKC4rKSQvO1xuXHRjb25zdCBsaW5lcyA9IHN0ZG91dC50b1N0cmluZygpLnNwbGl0KCdcXG4nKTtcblx0Zm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG5cdFx0Y29uc3QgbWF0Y2hlcyA9IFBJRF9DTUQuZXhlYyhsaW5lLnRyaW0oKSk7XG5cdFx0aWYgKG1hdGNoZXMgJiYgbWF0Y2hlcy5sZW5ndGggPT09IDYpIHtcblx0XHRcdGFkZFRvVHJlZShwYXJzZUludChtYXRjaGVzWzFdKSwgcGFyc2VJbnQobWF0Y2hlc1syXSksIG1hdGNoZXNbNV0sIHBhcnNlRmxvYXQobWF0Y2hlc1szXSksIHBhcnNlRmxvYXQobWF0Y2hlc1s0XSkpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsa0JBQWtCO0FBR3BCLFNBQVMsY0FBYyxTQUF1QztBQUVwRSxTQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUV2QyxRQUFJO0FBQ0osVUFBTSxNQUFNLG9CQUFJLElBQXlCO0FBR3pDLGFBQVMsVUFBVSxLQUFhLE1BQWMsS0FBYSxNQUFjLEtBQWE7QUFFckYsWUFBTSxTQUFTLElBQUksSUFBSSxJQUFJO0FBQzNCLFVBQUksUUFBUSxXQUFXLFFBQVE7QUFFOUIsY0FBTSxPQUFvQjtBQUFBLFVBQ3pCLE1BQU0sU0FBUyxHQUFHO0FBQUEsVUFDbEI7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUNBLFlBQUksSUFBSSxLQUFLLElBQUk7QUFFakIsWUFBSSxRQUFRLFNBQVM7QUFDcEIscUJBQVc7QUFBQSxRQUNaO0FBRUEsWUFBSSxRQUFRO0FBQ1gsY0FBSSxDQUFDLE9BQU8sVUFBVTtBQUNyQixtQkFBTyxXQUFXLENBQUM7QUFBQSxVQUNwQjtBQUNBLGlCQUFPLFNBQVMsS0FBSyxJQUFJO0FBQ3pCLGNBQUksT0FBTyxTQUFTLFNBQVMsR0FBRztBQUMvQixtQkFBTyxXQUFXLE9BQU8sU0FBUyxLQUFL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
