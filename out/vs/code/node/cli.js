import { spawn } from "child_process";
import { chmodSync, existsSync, readFileSync, statSync, truncateSync, unlinkSync } from "fs";
import { homedir, release, tmpdir } from "os";
import { Event } from "../../base/common/event.js";
import { isAbsolute, resolve, join, dirname } from "../../base/common/path.js";
import { isMacintosh, isWindows } from "../../base/common/platform.js";
import { randomPort } from "../../base/common/ports.js";
import { whenDeleted, writeFileSync } from "../../base/node/pfs.js";
import { findFreePort } from "../../base/node/ports.js";
import { watchFileContents } from "../../platform/files/node/watcher/nodejs/nodejsWatcherLib.js";
import { buildHelpMessage, buildVersionMessage, NATIVE_CLI_COMMANDS, OPTIONS } from "../../platform/environment/node/argv.js";
import { addArg, parseCLIProcessArgv } from "../../platform/environment/node/argvHelper.js";
import { getStdinFilePath, hasStdinWithoutTty, readFromStdin, stdinDataListener } from "../../platform/environment/node/stdin.js";
import { createWaitMarkerFileSync } from "../../platform/environment/node/wait.js";
import product from "../../platform/product/common/product.js";
import { CancellationTokenSource } from "../../base/common/cancellation.js";
import { isUNC, randomPath } from "../../base/common/extpath.js";
import { Utils } from "../../platform/profiling/common/profiling.js";
import { FileAccess } from "../../base/common/network.js";
import { cwd } from "../../base/common/process.js";
import { addUNCHostToAllowlist } from "../../base/node/unc.js";
import { URI } from "../../base/common/uri.js";
import { DeferredPromise } from "../../base/common/async.js";
function shouldSpawnCliProcess(argv) {
  return !!argv["install-source"] || !!argv["list-extensions"] || !!argv["install-extension"] || !!argv["uninstall-extension"] || !!argv["update-extensions"] || !!argv["locate-extension"] || !!argv["add-mcp"] || !!argv["telemetry"];
}
async function main(argv) {
  let args;
  try {
    args = parseCLIProcessArgv(argv);
  } catch (err) {
    console.error(err.message);
    return;
  }
  for (const subcommand of NATIVE_CLI_COMMANDS) {
    if (args[subcommand]) {
      if (!product.tunnelApplicationName) {
        console.error(`'${subcommand}' command not supported in ${product.applicationName}`);
        return;
      }
      const env = {
        ...process.env
      };
      delete env["ELECTRON_RUN_AS_NODE"];
      const tunnelArgs = argv.slice(argv.indexOf(subcommand) + 1);
      return new Promise((resolve2, reject) => {
        let tunnelProcess;
        const stdio = ["ignore", "pipe", "pipe"];
        if (process.env["VSCODE_DEV"]) {
          tunnelProcess = spawn("cargo", ["run", "--", subcommand, ...tunnelArgs], { cwd: join(getAppRoot(), "cli"), stdio, env });
        } else {
          const appPath = process.platform === "darwin" ? join(dirname(dirname(process.execPath)), "Resources", "app") : dirname(process.execPath);
          const tunnelCommand = join(appPath, "bin", `${product.tunnelApplicationName}${isWindows ? ".exe" : ""}`);
          tunnelProcess = spawn(tunnelCommand, [subcommand, ...tunnelArgs], { cwd: cwd(), stdio, env });
        }
        tunnelProcess.stdout.pipe(process.stdout);
        tunnelProcess.stderr.pipe(process.stderr);
        tunnelProcess.on("exit", resolve2);
        tunnelProcess.on("error", reject);
      });
    }
  }
  if (args.help) {
    const executable = `${product.applicationName}${isWindows ? ".exe" : ""}`;
    console.log(buildHelpMessage(product.nameLong, executable, product.version, OPTIONS));
  } else if (args.version) {
    console.log(buildVersionMessage(product.version, product.commit));
  } else if (args["locate-shell-integration-path"]) {
    let file;
    switch (args["locate-shell-integration-path"]) {
      // Usage: `[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path bash)"`
      case "bash":
        file = "shellIntegration-bash.sh";
        break;
      // Usage: `if ($env:TERM_PROGRAM -eq "vscode") { . "$(code --locate-shell-integration-path pwsh)" }`
      case "pwsh":
        file = "shellIntegration.ps1";
        break;
      // Usage: `[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"`
      case "zsh":
        file = "shellIntegration-rc.zsh";
        break;
      // Usage: `string match -q "$TERM_PROGRAM" "vscode"; and . (code --locate-shell-integration-path fish)`
      case "fish":
        file = "shellIntegration.fish";
        break;
      default:
        throw new Error("Error using --locate-shell-integration-path: Invalid shell type");
    }
    console.log(join(getAppRoot(), "out", "vs", "workbench", "contrib", "terminal", "common", "scripts", file));
  } else if (shouldSpawnCliProcess(args)) {
    let cliProcessMain;
    if (process.env["VSCODE_DEV"]) {
      cliProcessMain = "./cliProcessMain.js";
    } else {
      cliProcessMain = "./vs/code/node/cliProcessMain.js";
    }
    const cli = await import(cliProcessMain);
    await cli.main(args);
    return;
  } else if (args["file-write"]) {
    const argsFile = args._[0];
    if (!argsFile || !isAbsolute(argsFile) || !existsSync(argsFile) || !statSync(argsFile).isFile()) {
      throw new Error("Using --file-write with invalid arguments.");
    }
    let source;
    let target;
    try {
      const argsContents = JSON.parse(readFileSync(argsFile, "utf8"));
      source = argsContents.source;
      target = argsContents.target;
    } catch (error) {
      throw new Error("Using --file-write with invalid arguments.");
    }
    if (isWindows) {
      for (const path of [source, target]) {
        if (typeof path === "string" && isUNC(path)) {
          addUNCHostToAllowlist(URI.file(path).authority);
        }
      }
    }
    if (!source || !target || source === target || // make sure source and target are provided and are not the same
    !isAbsolute(source) || !isAbsolute(target) || // make sure both source and target are absolute paths
    !existsSync(source) || !statSync(source).isFile() || // make sure source exists as file
    !existsSync(target) || !statSync(target).isFile()) {
      throw new Error("Using --file-write with invalid arguments.");
    }
    try {
      let targetMode = 0;
      let restoreMode = false;
      if (!!args["file-chmod"]) {
        targetMode = statSync(target).mode;
        if (!(targetMode & 128)) {
          chmodSync(target, targetMode | 128);
          restoreMode = true;
        }
      }
      const data = readFileSync(source);
      if (isWindows) {
        truncateSync(target, 0);
        writeFileSync(target, data, { flag: "r+" });
      } else {
        writeFileSync(target, data);
      }
      if (restoreMode) {
        chmodSync(target, targetMode);
      }
    } catch (error) {
      error.message = `Error using --file-write: ${error.message}`;
      throw error;
    }
  } else {
    const env = {
      ...process.env,
      "ELECTRON_NO_ATTACH_CONSOLE": "1"
    };
    delete env["ELECTRON_RUN_AS_NODE"];
    const processCallbacks = [];
    if (args.verbose) {
      env["ELECTRON_ENABLE_LOGGING"] = "1";
    }
    if (args.verbose || args.status) {
      processCallbacks.push(async (child2) => {
        child2.stdout?.on("data", (data) => console.log(data.toString("utf8").trim()));
        child2.stderr?.on("data", (data) => console.log(data.toString("utf8").trim()));
        await Event.toPromise(Event.fromNodeEventEmitter(child2, "exit"));
      });
    }
    const hasReadStdinArg = args._.some((arg) => arg === "-");
    if (hasReadStdinArg) {
      args._ = args._.filter((a) => a !== "-");
      argv = argv.filter((a) => a !== "-");
    }
    let stdinFilePath;
    if (hasStdinWithoutTty()) {
      if (hasReadStdinArg) {
        stdinFilePath = getStdinFilePath();
        try {
          const readFromStdinDone = new DeferredPromise();
          await readFromStdin(stdinFilePath, !!args.verbose, () => readFromStdinDone.complete());
          if (!args.wait) {
            processCallbacks.push(() => readFromStdinDone.p);
          }
          addArg(argv, stdinFilePath);
          addArg(argv, "--skip-add-to-recently-opened");
          console.log(`Reading from stdin via: ${stdinFilePath}`);
        } catch (e) {
          console.log(`Failed to create file to read via stdin: ${e.toString()}`);
          stdinFilePath = void 0;
        }
      } else {
        processCallbacks.push((_) => stdinDataListener(1e3).then((dataReceived) => {
          if (dataReceived) {
            if (isWindows) {
              console.log(`Run with '${product.applicationName} -' to read output from another program (e.g. 'echo Hello World | ${product.applicationName} -').`);
            } else {
              console.log(`Run with '${product.applicationName} -' to read from stdin (e.g. 'ps aux | grep code | ${product.applicationName} -').`);
            }
          }
        }));
      }
    }
    const isMacOSBigSurOrNewer = isMacintosh && release() > "20.0.0";
    let waitMarkerFilePath;
    if (args.wait) {
      waitMarkerFilePath = createWaitMarkerFileSync(args.verbose);
      if (waitMarkerFilePath) {
        addArg(argv, "--waitMarkerFilePath", waitMarkerFilePath);
      }
      processCallbacks.push(async (child2) => {
        let childExitPromise;
        if (isMacOSBigSurOrNewer) {
          childExitPromise = new Promise((resolve2) => {
            child2.on("exit", (code, signal) => {
              if (code !== 0 || signal) {
                resolve2();
              }
            });
          });
        } else {
          childExitPromise = Event.toPromise(Event.fromNodeEventEmitter(child2, "exit"));
        }
        try {
          await Promise.race([
            whenDeleted(waitMarkerFilePath),
            Event.toPromise(Event.fromNodeEventEmitter(child2, "error")),
            childExitPromise
          ]);
        } finally {
          if (stdinFilePath) {
            unlinkSync(stdinFilePath);
          }
        }
      });
    }
    if (args["prof-startup"]) {
      const profileHost = "127.0.0.1";
      const portMain = await findFreePort(randomPort(), 10, 3e3);
      const portRenderer = await findFreePort(portMain + 1, 10, 3e3);
      const portExthost = await findFreePort(portRenderer + 1, 10, 3e3);
      if (portMain * portRenderer * portExthost === 0) {
        throw new Error("Failed to find free ports for profiler. Make sure to shutdown all instances of the editor first.");
      }
      const filenamePrefix = randomPath(homedir(), "prof");
      addArg(argv, `--inspect-brk=${profileHost}:${portMain}`);
      addArg(argv, `--remote-debugging-port=${profileHost}:${portRenderer}`);
      addArg(argv, `--inspect-brk-extensions=${profileHost}:${portExthost}`);
      addArg(argv, `--prof-startup-prefix`, filenamePrefix);
      addArg(argv, `--no-cached-data`);
      writeFileSync(filenamePrefix, argv.slice(-6).join("|"));
      processCallbacks.push(async (_child) => {
        class Profiler {
          static async start(name, filenamePrefix2, opts) {
            const profiler = await import("v8-inspect-profiler");
            let session;
            try {
              session = await profiler.startProfiling({ ...opts, host: profileHost });
            } catch (err) {
              console.error(`FAILED to start profiling for '${name}' on port '${opts.port}'`);
            }
            return {
              async stop() {
                if (!session) {
                  return;
                }
                let suffix = "";
                const result = await session.stop();
                if (!process.env["VSCODE_DEV"]) {
                  result.profile = Utils.rewriteAbsolutePaths(result.profile, "piiRemoved");
                  suffix = ".txt";
                }
                writeFileSync(`${filenamePrefix2}.${name}.cpuprofile${suffix}`, JSON.stringify(result.profile, void 0, 4));
              }
            };
          }
        }
        try {
          const mainProfileRequest = Profiler.start("main", filenamePrefix, { port: portMain });
          const extHostProfileRequest = Profiler.start("extHost", filenamePrefix, { port: portExthost, tries: 300 });
          const rendererProfileRequest = Profiler.start("renderer", filenamePrefix, {
            port: portRenderer,
            tries: 200,
            target: function(targets) {
              return targets.filter((target) => {
                if (!target.webSocketDebuggerUrl) {
                  return false;
                }
                if (target.type === "page") {
                  return target.url.indexOf("workbench/workbench.html") > 0 || target.url.indexOf("workbench/workbench-dev.html") > 0;
                } else {
                  return true;
                }
              })[0];
            }
          });
          const main2 = await mainProfileRequest;
          const extHost = await extHostProfileRequest;
          const renderer = await rendererProfileRequest;
          await whenDeleted(filenamePrefix);
          await main2.stop();
          await renderer.stop();
          await extHost.stop();
          writeFileSync(filenamePrefix, "");
        } catch (e) {
          console.error("Failed to profile startup. Make sure to quit Code first.");
        }
      });
    }
    const options = {
      detached: true,
      env
    };
    if (!args.verbose) {
      options["stdio"] = "ignore";
    }
    let child;
    if (!isMacOSBigSurOrNewer) {
      if (!args.verbose && args.status) {
        options["stdio"] = ["ignore", "pipe", "ignore"];
      }
      child = spawn(process.execPath, argv.slice(2), options);
    } else {
      const spawnArgs = ["-n", "-g"];
      spawnArgs.push("-a", process.execPath);
      if (args.verbose || args.status) {
        spawnArgs.push("--wait-apps");
        for (const outputType of args.verbose ? ["stdout", "stderr"] : ["stdout"]) {
          const tmpName = randomPath(tmpdir(), `code-${outputType}`);
          writeFileSync(tmpName, "");
          spawnArgs.push(`--${outputType}`, tmpName);
          processCallbacks.push(async (child2) => {
            try {
              const stream = outputType === "stdout" ? process.stdout : process.stderr;
              const cts = new CancellationTokenSource();
              child2.on("close", () => {
                setTimeout(() => cts.dispose(true), 200);
              });
              await watchFileContents(tmpName, (chunk) => stream.write(chunk), () => {
              }, cts.token);
            } finally {
              unlinkSync(tmpName);
            }
          });
        }
      }
      for (const e in env) {
        if (e !== "_") {
          spawnArgs.push("--env");
          spawnArgs.push(`${e}=${env[e]}`);
        }
      }
      spawnArgs.push("--args", ...argv.slice(2));
      if (env["VSCODE_DEV"]) {
        const curdir = ".";
        const launchDirIndex = spawnArgs.indexOf(curdir);
        if (launchDirIndex !== -1) {
          spawnArgs[launchDirIndex] = resolve(curdir);
        }
      }
      child = spawn("open", spawnArgs, { ...options, env: {} });
    }
    return Promise.all(processCallbacks.map((callback) => callback(child)));
  }
}
function getAppRoot() {
  return dirname(FileAccess.asFileUri("").fsPath);
}
function eventuallyExit(code) {
  setTimeout(() => process.exit(code), 0);
}
main(process.argv).then(() => eventuallyExit(0)).then(null, (err) => {
  console.error(err.message || err.stack || err);
  eventuallyExit(1);
});
export {
  main
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL25vZGUvY2xpLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hpbGRQcm9jZXNzLCBzcGF3biwgU3Bhd25PcHRpb25zLCBTdGRpb09wdGlvbnMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGNobW9kU3luYywgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jLCBzdGF0U3luYywgdHJ1bmNhdGVTeW5jLCB1bmxpbmtTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgaG9tZWRpciwgcmVsZWFzZSwgdG1wZGlyIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHR5cGUgeyBQcm9maWxpbmdTZXNzaW9uLCBUYXJnZXQgfSBmcm9tICd2OC1pbnNwZWN0LXByb2ZpbGVyJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgaXNBYnNvbHV0ZSwgcmVzb2x2ZSwgam9pbiwgZGlybmFtZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IHJhbmRvbVBvcnQgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wb3J0cy5qcyc7XG5pbXBvcnQgeyB3aGVuRGVsZXRlZCwgd3JpdGVGaWxlU3luYyB9IGZyb20gJy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0IHsgZmluZEZyZWVQb3J0IH0gZnJvbSAnLi4vLi4vYmFzZS9ub2RlL3BvcnRzLmpzJztcbmltcG9ydCB7IHdhdGNoRmlsZUNvbnRlbnRzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvbm9kZS93YXRjaGVyL25vZGVqcy9ub2RlanNXYXRjaGVyTGliLmpzJztcbmltcG9ydCB7IE5hdGl2ZVBhcnNlZEFyZ3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vYXJndi5qcyc7XG5pbXBvcnQgeyBidWlsZEhlbHBNZXNzYWdlLCBidWlsZFZlcnNpb25NZXNzYWdlLCBOQVRJVkVfQ0xJX0NPTU1BTkRTLCBPUFRJT05TIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvbm9kZS9hcmd2LmpzJztcbmltcG9ydCB7IGFkZEFyZywgcGFyc2VDTElQcm9jZXNzQXJndiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L25vZGUvYXJndkhlbHBlci5qcyc7XG5pbXBvcnQgeyBnZXRTdGRpbkZpbGVQYXRoLCBoYXNTdGRpbldpdGhvdXRUdHksIHJlYWRGcm9tU3RkaW4sIHN0ZGluRGF0YUxpc3RlbmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvbm9kZS9zdGRpbi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVXYWl0TWFya2VyRmlsZVN5bmMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9ub2RlL3dhaXQuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc1VOQywgcmFuZG9tUGF0aCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wcm9maWxpbmcvY29tbW9uL3Byb2ZpbGluZy5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBjd2QgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IGFkZFVOQ0hvc3RUb0FsbG93bGlzdCB9IGZyb20gJy4uLy4uL2Jhc2Uvbm9kZS91bmMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcblxuZnVuY3Rpb24gc2hvdWxkU3Bhd25DbGlQcm9jZXNzKGFyZ3Y6IE5hdGl2ZVBhcnNlZEFyZ3MpOiBib29sZWFuIHtcblx0cmV0dXJuICEhYXJndlsnaW5zdGFsbC1zb3VyY2UnXVxuXHRcdHx8ICEhYXJndlsnbGlzdC1leHRlbnNpb25zJ11cblx0XHR8fCAhIWFyZ3ZbJ2luc3RhbGwtZXh0ZW5zaW9uJ11cblx0XHR8fCAhIWFyZ3ZbJ3VuaW5zdGFsbC1leHRlbnNpb24nXVxuXHRcdHx8ICEhYXJndlsndXBkYXRlLWV4dGVuc2lvbnMnXVxuXHRcdHx8ICEhYXJndlsnbG9jYXRlLWV4dGVuc2lvbiddXG5cdFx0fHwgISFhcmd2WydhZGQtbWNwJ11cblx0XHR8fCAhIWFyZ3ZbJ3RlbGVtZXRyeSddO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihhcmd2OiBzdHJpbmdbXSk6IFByb21pc2U8YW55PiB7XG5cdGxldCBhcmdzOiBOYXRpdmVQYXJzZWRBcmdzO1xuXG5cdHRyeSB7XG5cdFx0YXJncyA9IHBhcnNlQ0xJUHJvY2Vzc0FyZ3YoYXJndik7XG5cdH0gY2F0Y2ggKGVycikge1xuXHRcdGNvbnNvbGUuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGZvciAoY29uc3Qgc3ViY29tbWFuZCBvZiBOQVRJVkVfQ0xJX0NPTU1BTkRTKSB7XG5cdFx0aWYgKGFyZ3Nbc3ViY29tbWFuZF0pIHtcblx0XHRcdGlmICghcHJvZHVjdC50dW5uZWxBcHBsaWNhdGlvbk5hbWUpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihgJyR7c3ViY29tbWFuZH0nIGNvbW1hbmQgbm90IHN1cHBvcnRlZCBpbiAke3Byb2R1Y3QuYXBwbGljYXRpb25OYW1lfWApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbnY6IElQcm9jZXNzRW52aXJvbm1lbnQgPSB7XG5cdFx0XHRcdC4uLnByb2Nlc3MuZW52XG5cdFx0XHR9O1xuXHRcdFx0Ly8gYm9vdHN0cmFwLWVzbS5qcyBkZXRlcm1pbmVzIHRoZSBlbGVjdHJvbiBlbnZpcm9ubWVudCBiYXNlZFxuXHRcdFx0Ly8gb24gdGhlIGZvbGxvd2luZyB2YXJpYWJsZS4gRm9yIHRoZSBzZXJ2ZXIgd2UgbmVlZCB0byB1bnNldFxuXHRcdFx0Ly8gaXQgdG8gcHJldmVudCBpbXBvcnRpbmcgYW55IGVsZWN0cm9uIHNwZWNpZmljIG1vZHVsZXMuXG5cdFx0XHQvLyBSZWZzIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMjE4ODNcblx0XHRcdGRlbGV0ZSBlbnZbJ0VMRUNUUk9OX1JVTl9BU19OT0RFJ107XG5cblx0XHRcdGNvbnN0IHR1bm5lbEFyZ3MgPSBhcmd2LnNsaWNlKGFyZ3YuaW5kZXhPZihzdWJjb21tYW5kKSArIDEpOyAvLyBhbGwgYXJndW1lbnRzIGJlaGluZCBgdHVubmVsYFxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0bGV0IHR1bm5lbFByb2Nlc3M6IENoaWxkUHJvY2Vzcztcblx0XHRcdFx0Y29uc3Qgc3RkaW86IFN0ZGlvT3B0aW9ucyA9IFsnaWdub3JlJywgJ3BpcGUnLCAncGlwZSddO1xuXHRcdFx0XHRpZiAocHJvY2Vzcy5lbnZbJ1ZTQ09ERV9ERVYnXSkge1xuXHRcdFx0XHRcdHR1bm5lbFByb2Nlc3MgPSBzcGF3bignY2FyZ28nLCBbJ3J1bicsICctLScsIHN1YmNvbW1hbmQsIC4uLnR1bm5lbEFyZ3NdLCB7IGN3ZDogam9pbihnZXRBcHBSb290KCksICdjbGknKSwgc3RkaW8sIGVudiB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBhcHBQYXRoID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2Rhcndpbidcblx0XHRcdFx0XHRcdC8vIC4vQ29udGVudHMvTWFjT1MvRWxlY3Ryb24gPT4gLi9Db250ZW50cy9SZXNvdXJjZXMvYXBwL2Jpbi9jb2RlLXR1bm5lbC1pbnNpZGVyc1xuXHRcdFx0XHRcdFx0PyBqb2luKGRpcm5hbWUoZGlybmFtZShwcm9jZXNzLmV4ZWNQYXRoKSksICdSZXNvdXJjZXMnLCAnYXBwJylcblx0XHRcdFx0XHRcdDogZGlybmFtZShwcm9jZXNzLmV4ZWNQYXRoKTtcblx0XHRcdFx0XHRjb25zdCB0dW5uZWxDb21tYW5kID0gam9pbihhcHBQYXRoLCAnYmluJywgYCR7cHJvZHVjdC50dW5uZWxBcHBsaWNhdGlvbk5hbWV9JHtpc1dpbmRvd3MgPyAnLmV4ZScgOiAnJ31gKTtcblx0XHRcdFx0XHR0dW5uZWxQcm9jZXNzID0gc3Bhd24odHVubmVsQ29tbWFuZCwgW3N1YmNvbW1hbmQsIC4uLnR1bm5lbEFyZ3NdLCB7IGN3ZDogY3dkKCksIHN0ZGlvLCBlbnYgfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0dW5uZWxQcm9jZXNzLnN0ZG91dCEucGlwZShwcm9jZXNzLnN0ZG91dCk7XG5cdFx0XHRcdHR1bm5lbFByb2Nlc3Muc3RkZXJyIS5waXBlKHByb2Nlc3Muc3RkZXJyKTtcblx0XHRcdFx0dHVubmVsUHJvY2Vzcy5vbignZXhpdCcsIHJlc29sdmUpO1xuXHRcdFx0XHR0dW5uZWxQcm9jZXNzLm9uKCdlcnJvcicsIHJlamVjdCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvLyBIZWxwXG5cdGlmIChhcmdzLmhlbHApIHtcblx0XHRjb25zdCBleGVjdXRhYmxlID0gYCR7cHJvZHVjdC5hcHBsaWNhdGlvbk5hbWV9JHtpc1dpbmRvd3MgPyAnLmV4ZScgOiAnJ31gO1xuXHRcdGNvbnNvbGUubG9nKGJ1aWxkSGVscE1lc3NhZ2UocHJvZHVjdC5uYW1lTG9uZywgZXhlY3V0YWJsZSwgcHJvZHVjdC52ZXJzaW9uLCBPUFRJT05TKSk7XG5cdH1cblxuXHQvLyBWZXJzaW9uIEluZm9cblx0ZWxzZSBpZiAoYXJncy52ZXJzaW9uKSB7XG5cdFx0Y29uc29sZS5sb2coYnVpbGRWZXJzaW9uTWVzc2FnZShwcm9kdWN0LnZlcnNpb24sIHByb2R1Y3QuY29tbWl0KSk7XG5cdH1cblxuXHQvLyBTaGVsbCBpbnRlZ3JhdGlvblxuXHRlbHNlIGlmIChhcmdzWydsb2NhdGUtc2hlbGwtaW50ZWdyYXRpb24tcGF0aCddKSB7XG5cdFx0bGV0IGZpbGU6IHN0cmluZztcblx0XHRzd2l0Y2ggKGFyZ3NbJ2xvY2F0ZS1zaGVsbC1pbnRlZ3JhdGlvbi1wYXRoJ10pIHtcblx0XHRcdC8vIFVzYWdlOiBgW1sgXCIkVEVSTV9QUk9HUkFNXCIgPT0gXCJ2c2NvZGVcIiBdXSAmJiAuIFwiJChjb2RlIC0tbG9jYXRlLXNoZWxsLWludGVncmF0aW9uLXBhdGggYmFzaClcImBcblx0XHRcdGNhc2UgJ2Jhc2gnOiBmaWxlID0gJ3NoZWxsSW50ZWdyYXRpb24tYmFzaC5zaCc7IGJyZWFrO1xuXHRcdFx0Ly8gVXNhZ2U6IGBpZiAoJGVudjpURVJNX1BST0dSQU0gLWVxIFwidnNjb2RlXCIpIHsgLiBcIiQoY29kZSAtLWxvY2F0ZS1zaGVsbC1pbnRlZ3JhdGlvbi1wYXRoIHB3c2gpXCIgfWBcblx0XHRcdGNhc2UgJ3B3c2gnOiBmaWxlID0gJ3NoZWxsSW50ZWdyYXRpb24ucHMxJzsgYnJlYWs7XG5cdFx0XHQvLyBVc2FnZTogYFtbIFwiJFRFUk1fUFJPR1JBTVwiID09IFwidnNjb2RlXCIgXV0gJiYgLiBcIiQoY29kZSAtLWxvY2F0ZS1zaGVsbC1pbnRlZ3JhdGlvbi1wYXRoIHpzaClcImBcblx0XHRcdGNhc2UgJ3pzaCc6IGZpbGUgPSAnc2hlbGxJbnRlZ3JhdGlvbi1yYy56c2gnOyBicmVhaztcblx0XHRcdC8vIFVzYWdlOiBgc3RyaW5nIG1hdGNoIC1xIFwiJFRFUk1fUFJPR1JBTVwiIFwidnNjb2RlXCI7IGFuZCAuIChjb2RlIC0tbG9jYXRlLXNoZWxsLWludGVncmF0aW9uLXBhdGggZmlzaClgXG5cdFx0XHRjYXNlICdmaXNoJzogZmlsZSA9ICdzaGVsbEludGVncmF0aW9uLmZpc2gnOyBicmVhaztcblx0XHRcdGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcignRXJyb3IgdXNpbmcgLS1sb2NhdGUtc2hlbGwtaW50ZWdyYXRpb24tcGF0aDogSW52YWxpZCBzaGVsbCB0eXBlJyk7XG5cdFx0fVxuXHRcdGNvbnNvbGUubG9nKGpvaW4oZ2V0QXBwUm9vdCgpLCAnb3V0JywgJ3ZzJywgJ3dvcmtiZW5jaCcsICdjb250cmliJywgJ3Rlcm1pbmFsJywgJ2NvbW1vbicsICdzY3JpcHRzJywgZmlsZSkpO1xuXHR9XG5cblx0Ly8gRXh0ZW5zaW9ucyBNYW5hZ2VtZW50XG5cdGVsc2UgaWYgKHNob3VsZFNwYXduQ2xpUHJvY2VzcyhhcmdzKSkge1xuXG5cdFx0Ly8gV2UgZG8gbm90IGJ1bmRsZSBgY2xpUHJvY2Vzc01haW4uanNgIGludG8gdGhpcyBmaWxlIGJlY2F1c2Vcblx0XHQvLyBpdCBpcyByYXRoZXIgbGFyZ2UgYW5kIG9ubHkgbmVlZGVkIGZvciB2ZXJ5IGZldyBDTEkgb3BlcmF0aW9ucy5cblx0XHQvLyBUaGlzIGhhcyB0aGUgZG93bnNpZGUgdGhhdCB3ZSBuZWVkIHRvIGtub3cgaWYgd2UgcnVuIE9TUyBvclxuXHRcdC8vIGJ1aWx0LCBiZWNhdXNlIG91ciBsb2NhdGlvbiBvbiBkaXNrIGlzIGRpZmZlcmVudCBpZiBidWlsdC5cblxuXHRcdGxldCBjbGlQcm9jZXNzTWFpbjogc3RyaW5nO1xuXHRcdGlmIChwcm9jZXNzLmVudlsnVlNDT0RFX0RFViddKSB7XG5cdFx0XHRjbGlQcm9jZXNzTWFpbiA9ICcuL2NsaVByb2Nlc3NNYWluLmpzJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2xpUHJvY2Vzc01haW4gPSAnLi92cy9jb2RlL25vZGUvY2xpUHJvY2Vzc01haW4uanMnO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNsaSA9IGF3YWl0IGltcG9ydChjbGlQcm9jZXNzTWFpbik7XG5cdFx0YXdhaXQgY2xpLm1haW4oYXJncyk7XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHQvLyBXcml0ZSBGaWxlXG5cdGVsc2UgaWYgKGFyZ3NbJ2ZpbGUtd3JpdGUnXSkge1xuXHRcdGNvbnN0IGFyZ3NGaWxlID0gYXJncy5fWzBdO1xuXHRcdGlmICghYXJnc0ZpbGUgfHwgIWlzQWJzb2x1dGUoYXJnc0ZpbGUpIHx8ICFleGlzdHNTeW5jKGFyZ3NGaWxlKSB8fCAhc3RhdFN5bmMoYXJnc0ZpbGUpLmlzRmlsZSgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VzaW5nIC0tZmlsZS13cml0ZSB3aXRoIGludmFsaWQgYXJndW1lbnRzLicpO1xuXHRcdH1cblxuXHRcdGxldCBzb3VyY2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRsZXQgdGFyZ2V0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGFyZ3NDb250ZW50czogeyBzb3VyY2U6IHN0cmluZzsgdGFyZ2V0OiBzdHJpbmcgfSA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKGFyZ3NGaWxlLCAndXRmOCcpKTtcblx0XHRcdHNvdXJjZSA9IGFyZ3NDb250ZW50cy5zb3VyY2U7XG5cdFx0XHR0YXJnZXQgPSBhcmdzQ29udGVudHMudGFyZ2V0O1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VzaW5nIC0tZmlsZS13cml0ZSB3aXRoIGludmFsaWQgYXJndW1lbnRzLicpO1xuXHRcdH1cblxuXHRcdC8vIFdpbmRvd3M6IHNldCB0aGUgcGF0aHMgYXMgYWxsb3dlZCBVTkMgcGF0aHMgZ2l2ZW5cblx0XHQvLyB0aGV5IGFyZSBleHBsaWNpdGx5IHByb3ZpZGVkIGJ5IHRoZSB1c2VyIGFzIGFyZ3VtZW50c1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGZvciAoY29uc3QgcGF0aCBvZiBbc291cmNlLCB0YXJnZXRdKSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycgJiYgaXNVTkMocGF0aCkpIHtcblx0XHRcdFx0XHRhZGRVTkNIb3N0VG9BbGxvd2xpc3QoVVJJLmZpbGUocGF0aCkuYXV0aG9yaXR5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFZhbGlkYXRlXG5cdFx0aWYgKFxuXHRcdFx0IXNvdXJjZSB8fCAhdGFyZ2V0IHx8IHNvdXJjZSA9PT0gdGFyZ2V0IHx8XHRcdFx0XHQvLyBtYWtlIHN1cmUgc291cmNlIGFuZCB0YXJnZXQgYXJlIHByb3ZpZGVkIGFuZCBhcmUgbm90IHRoZSBzYW1lXG5cdFx0XHQhaXNBYnNvbHV0ZShzb3VyY2UpIHx8ICFpc0Fic29sdXRlKHRhcmdldCkgfHxcdFx0XHQvLyBtYWtlIHN1cmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBhcmUgYWJzb2x1dGUgcGF0aHNcblx0XHRcdCFleGlzdHNTeW5jKHNvdXJjZSkgfHwgIXN0YXRTeW5jKHNvdXJjZSkuaXNGaWxlKCkgfHxcdC8vIG1ha2Ugc3VyZSBzb3VyY2UgZXhpc3RzIGFzIGZpbGVcblx0XHRcdCFleGlzdHNTeW5jKHRhcmdldCkgfHwgIXN0YXRTeW5jKHRhcmdldCkuaXNGaWxlKClcdFx0Ly8gbWFrZSBzdXJlIHRhcmdldCBleGlzdHMgYXMgZmlsZVxuXHRcdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVc2luZyAtLWZpbGUtd3JpdGUgd2l0aCBpbnZhbGlkIGFyZ3VtZW50cy4nKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXG5cdFx0XHQvLyBDaGVjayBmb3IgcmVhZG9ubHkgc3RhdHVzIGFuZCBjaG1vZCBpZiBzbyBpZiB3ZSBhcmUgdG9sZCBzb1xuXHRcdFx0bGV0IHRhcmdldE1vZGU6IG51bWJlciA9IDA7XG5cdFx0XHRsZXQgcmVzdG9yZU1vZGUgPSBmYWxzZTtcblx0XHRcdGlmICghIWFyZ3NbJ2ZpbGUtY2htb2QnXSkge1xuXHRcdFx0XHR0YXJnZXRNb2RlID0gc3RhdFN5bmModGFyZ2V0KS5tb2RlO1xuXHRcdFx0XHRpZiAoISh0YXJnZXRNb2RlICYgMG8yMDAgLyogRmlsZSBtb2RlIGluZGljYXRpbmcgd3JpdGFibGUgYnkgb3duZXIgKi8pKSB7XG5cdFx0XHRcdFx0Y2htb2RTeW5jKHRhcmdldCwgdGFyZ2V0TW9kZSB8IDBvMjAwKTtcblx0XHRcdFx0XHRyZXN0b3JlTW9kZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gV3JpdGUgc291cmNlIHRvIHRhcmdldFxuXHRcdFx0Y29uc3QgZGF0YSA9IHJlYWRGaWxlU3luYyhzb3VyY2UpO1xuXHRcdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0XHQvLyBPbiBXaW5kb3dzIHdlIHVzZSBhIGRpZmZlcmVudCBzdHJhdGVneSBvZiBzYXZpbmcgdGhlIGZpbGVcblx0XHRcdFx0Ly8gYnkgZmlyc3QgdHJ1bmNhdGluZyB0aGUgZmlsZSBhbmQgdGhlbiB3cml0aW5nIHdpdGggcisgbW9kZS5cblx0XHRcdFx0Ly8gVGhpcyBoZWxwcyB0byBzYXZlIGhpZGRlbiBmaWxlcyBvbiBXaW5kb3dzXG5cdFx0XHRcdC8vIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzkzMSkgYW5kXG5cdFx0XHRcdC8vIHByZXZlbnQgcmVtb3ZpbmcgYWx0ZXJuYXRlIGRhdGEgc3RyZWFtc1xuXHRcdFx0XHQvLyAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy82MzYzKVxuXHRcdFx0XHR0cnVuY2F0ZVN5bmModGFyZ2V0LCAwKTtcblx0XHRcdFx0d3JpdGVGaWxlU3luYyh0YXJnZXQsIGRhdGEsIHsgZmxhZzogJ3IrJyB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHdyaXRlRmlsZVN5bmModGFyZ2V0LCBkYXRhKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVzdG9yZSBwcmV2aW91cyBtb2RlIGFzIG5lZWRlZFxuXHRcdFx0aWYgKHJlc3RvcmVNb2RlKSB7XG5cdFx0XHRcdGNobW9kU3luYyh0YXJnZXQsIHRhcmdldE1vZGUpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRlcnJvci5tZXNzYWdlID0gYEVycm9yIHVzaW5nIC0tZmlsZS13cml0ZTogJHtlcnJvci5tZXNzYWdlfWA7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHQvLyBKdXN0IENvZGVcblx0ZWxzZSB7XG5cdFx0Y29uc3QgZW52OiBJUHJvY2Vzc0Vudmlyb25tZW50ID0ge1xuXHRcdFx0Li4ucHJvY2Vzcy5lbnYsXG5cdFx0XHQnRUxFQ1RST05fTk9fQVRUQUNIX0NPTlNPTEUnOiAnMSdcblx0XHR9O1xuXG5cdFx0ZGVsZXRlIGVudlsnRUxFQ1RST05fUlVOX0FTX05PREUnXTtcblxuXHRcdGNvbnN0IHByb2Nlc3NDYWxsYmFja3M6ICgoY2hpbGQ6IENoaWxkUHJvY2VzcykgPT4gUHJvbWlzZTx2b2lkPilbXSA9IFtdO1xuXG5cdFx0aWYgKGFyZ3MudmVyYm9zZSkge1xuXHRcdFx0ZW52WydFTEVDVFJPTl9FTkFCTEVfTE9HR0lORyddID0gJzEnO1xuXHRcdH1cblxuXHRcdGlmIChhcmdzLnZlcmJvc2UgfHwgYXJncy5zdGF0dXMpIHtcblx0XHRcdHByb2Nlc3NDYWxsYmFja3MucHVzaChhc3luYyBjaGlsZCA9PiB7XG5cdFx0XHRcdGNoaWxkLnN0ZG91dD8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiBjb25zb2xlLmxvZyhkYXRhLnRvU3RyaW5nKCd1dGY4JykudHJpbSgpKSk7XG5cdFx0XHRcdGNoaWxkLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiBjb25zb2xlLmxvZyhkYXRhLnRvU3RyaW5nKCd1dGY4JykudHJpbSgpKSk7XG5cblx0XHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKGNoaWxkLCAnZXhpdCcpKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhhc1JlYWRTdGRpbkFyZyA9IGFyZ3MuXy5zb21lKGFyZyA9PiBhcmcgPT09ICctJyk7XG5cdFx0aWYgKGhhc1JlYWRTdGRpbkFyZykge1xuXHRcdFx0Ly8gcmVtb3ZlIHRoZSBcIi1cIiBhcmd1bWVudCB3aGVuIHdlIHJlYWQgZnJvbSBzdGRpblxuXHRcdFx0YXJncy5fID0gYXJncy5fLmZpbHRlcihhID0+IGEgIT09ICctJyk7XG5cdFx0XHRhcmd2ID0gYXJndi5maWx0ZXIoYSA9PiBhICE9PSAnLScpO1xuXHRcdH1cblxuXHRcdGxldCBzdGRpbkZpbGVQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGhhc1N0ZGluV2l0aG91dFR0eSgpKSB7XG5cblx0XHRcdC8vIFJlYWQgZnJvbSBzdGRpbjogd2UgcmVxdWlyZSBhIHNpbmdsZSBcIi1cIiBhcmd1bWVudCB0byBiZSBwYXNzZWQgaW4gb3JkZXIgdG8gc3RhcnQgcmVhZGluZyBmcm9tXG5cdFx0XHQvLyBzdGRpbi4gV2UgZG8gdGhpcyBiZWNhdXNlIHRoZXJlIGlzIG5vIHJlbGlhYmxlIHdheSB0byBmaW5kIG91dCBpZiBkYXRhIGlzIHBpcGVkIHRvIHN0ZGluLiBKdXN0XG5cdFx0XHQvLyBjaGVja2luZyBmb3Igc3RkaW4gYmVpbmcgY29ubmVjdGVkIHRvIGEgVFRZIGlzIG5vdCBlbm91Z2ggKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80MDM1MSlcblxuXHRcdFx0aWYgKGhhc1JlYWRTdGRpbkFyZykge1xuXHRcdFx0XHRzdGRpbkZpbGVQYXRoID0gZ2V0U3RkaW5GaWxlUGF0aCgpO1xuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVhZEZyb21TdGRpbkRvbmUgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRcdFx0YXdhaXQgcmVhZEZyb21TdGRpbihzdGRpbkZpbGVQYXRoLCAhIWFyZ3MudmVyYm9zZSwgKCkgPT4gcmVhZEZyb21TdGRpbkRvbmUuY29tcGxldGUoKSk7XG5cdFx0XHRcdFx0aWYgKCFhcmdzLndhaXQpIHtcblxuXHRcdFx0XHRcdFx0Ly8gaWYgYC0td2FpdGAgaXMgbm90IHByb3ZpZGVkLCB3ZSBrZWVwIHRoaXMgcHJvY2VzcyBhbGl2ZVxuXHRcdFx0XHRcdFx0Ly8gZm9yIGF0IGxlYXN0IGFzIGxvbmcgYXMgdGhlIHN0ZGluIHN0cmVhbSBpcyBvcGVuIHRvXG5cdFx0XHRcdFx0XHQvLyBlbnN1cmUgdGhhdCB3ZSByZWFkIGFsbCB0aGUgZGF0YS5cblx0XHRcdFx0XHRcdC8vIHRoZSBkb3duc2lkZSBpcyB0aGF0IHRoZSBDb2RlIENMSSBwcm9jZXNzIHdpbGwgdGhlbiBub3Rcblx0XHRcdFx0XHRcdC8vIHRlcm1pbmF0ZSB1bnRpbCBzdGRpbiBpcyBjbG9zZWQsIGJ1dCB1c2VycyBjYW4gYWx3YXlzXG5cdFx0XHRcdFx0XHQvLyBwYXNzIGAtLXdhaXRgIHRvIHByZXZlbnQgdGhhdCBmcm9tIGhhcHBlbmluZyAodGhpcyBpc1xuXHRcdFx0XHRcdFx0Ly8gYWN0dWFsbHkgd2hhdCB3ZSBlbmZvcmNlZCB1bnRpbCB2MS44NS54IGJ1dCB0aGVuIHdhc1xuXHRcdFx0XHRcdFx0Ly8gY2hhbmdlZCB0byBub3QgZW5mb3JjZSBpdCBhbnltb3JlKS5cblx0XHRcdFx0XHRcdC8vIGEgc29sdXRpb24gaW4gdGhlIGZ1dHVyZSB3b3VsZCBwb3NzaWJseSBiZSB0byBleGl0LCB3aGVuXG5cdFx0XHRcdFx0XHQvLyB0aGUgQ29kZSBwcm9jZXNzIGV4aXRzLiB0aGlzIHdvdWxkIHJlcXVpcmUgc29tZSBjYXJlZnVsXG5cdFx0XHRcdFx0XHQvLyBzb2x1dGlvbiB0aG91Z2ggaW4gY2FzZSBDb2RlIGlzIGFscmVhZHkgcnVubmluZyBhbmQgdGhpc1xuXHRcdFx0XHRcdFx0Ly8gaXMgYSBzZWNvbmQgaW5zdGFuY2UgdGVsbGluZyB0aGUgZmlyc3QgaW5zdGFuY2Ugd2hhdCB0b1xuXHRcdFx0XHRcdFx0Ly8gb3Blbi5cblxuXHRcdFx0XHRcdFx0cHJvY2Vzc0NhbGxiYWNrcy5wdXNoKCgpID0+IHJlYWRGcm9tU3RkaW5Eb25lLnApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIE1ha2Ugc3VyZSB0byBvcGVuIHRtcCBmaWxlIGFzIGVkaXRvciBidXQgaWdub3JlIGl0IGluIHRoZSBcInJlY2VudGx5IG9wZW5cIiBsaXN0XG5cdFx0XHRcdFx0YWRkQXJnKGFyZ3YsIHN0ZGluRmlsZVBhdGgpO1xuXHRcdFx0XHRcdGFkZEFyZyhhcmd2LCAnLS1za2lwLWFkZC10by1yZWNlbnRseS1vcGVuZWQnKTtcblxuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGBSZWFkaW5nIGZyb20gc3RkaW4gdmlhOiAke3N0ZGluRmlsZVBhdGh9YCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgRmFpbGVkIHRvIGNyZWF0ZSBmaWxlIHRvIHJlYWQgdmlhIHN0ZGluOiAke2UudG9TdHJpbmcoKX1gKTtcblx0XHRcdFx0XHRzdGRpbkZpbGVQYXRoID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdC8vIElmIHRoZSB1c2VyIHBpcGVzIGRhdGEgdmlhIHN0ZGluIGJ1dCBmb3Jnb3QgdG8gYWRkIHRoZSBcIi1cIiBhcmd1bWVudCwgaGVscCBieSBwcmludGluZyBhIG1lc3NhZ2Vcblx0XHRcdFx0Ly8gaWYgd2UgZGV0ZWN0IHRoYXQgZGF0YSBmbG93cyBpbnRvIHZpYSBzdGRpbiBhZnRlciBhIGNlcnRhaW4gdGltZW91dC5cblx0XHRcdFx0cHJvY2Vzc0NhbGxiYWNrcy5wdXNoKF8gPT4gc3RkaW5EYXRhTGlzdGVuZXIoMTAwMCkudGhlbihkYXRhUmVjZWl2ZWQgPT4ge1xuXHRcdFx0XHRcdGlmIChkYXRhUmVjZWl2ZWQpIHtcblx0XHRcdFx0XHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFJ1biB3aXRoICcke3Byb2R1Y3QuYXBwbGljYXRpb25OYW1lfSAtJyB0byByZWFkIG91dHB1dCBmcm9tIGFub3RoZXIgcHJvZ3JhbSAoZS5nLiAnZWNobyBIZWxsbyBXb3JsZCB8ICR7cHJvZHVjdC5hcHBsaWNhdGlvbk5hbWV9IC0nKS5gKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBSdW4gd2l0aCAnJHtwcm9kdWN0LmFwcGxpY2F0aW9uTmFtZX0gLScgdG8gcmVhZCBmcm9tIHN0ZGluIChlLmcuICdwcyBhdXggfCBncmVwIGNvZGUgfCAke3Byb2R1Y3QuYXBwbGljYXRpb25OYW1lfSAtJykuYCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNNYWNPU0JpZ1N1ck9yTmV3ZXIgPSBpc01hY2ludG9zaCAmJiByZWxlYXNlKCkgPiAnMjAuMC4wJztcblxuXHRcdC8vIElmIHdlIGFyZSBzdGFydGVkIHdpdGggLS13YWl0IGNyZWF0ZSBhIHJhbmRvbSB0ZW1wb3JhcnkgZmlsZVxuXHRcdC8vIGFuZCBwYXNzIGl0IG92ZXIgdG8gdGhlIHN0YXJ0aW5nIGluc3RhbmNlLiBXZSBjYW4gdXNlIHRoaXMgZmlsZVxuXHRcdC8vIHRvIHdhaXQgZm9yIGl0IHRvIGJlIGRlbGV0ZWQgdG8gbW9uaXRvciB0aGF0IHRoZSBlZGl0ZWQgZmlsZVxuXHRcdC8vIGlzIGNsb3NlZCBhbmQgdGhlbiBleGl0IHRoZSB3YWl0aW5nIHByb2Nlc3MuXG5cdFx0bGV0IHdhaXRNYXJrZXJGaWxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChhcmdzLndhaXQpIHtcblx0XHRcdHdhaXRNYXJrZXJGaWxlUGF0aCA9IGNyZWF0ZVdhaXRNYXJrZXJGaWxlU3luYyhhcmdzLnZlcmJvc2UpO1xuXHRcdFx0aWYgKHdhaXRNYXJrZXJGaWxlUGF0aCkge1xuXHRcdFx0XHRhZGRBcmcoYXJndiwgJy0td2FpdE1hcmtlckZpbGVQYXRoJywgd2FpdE1hcmtlckZpbGVQYXRoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gV2hlbiBydW5uaW5nIHdpdGggLS13YWl0LCB3ZSB3YW50IHRvIGNvbnRpbnVlIHJ1bm5pbmcgQ0xJIHByb2Nlc3Ncblx0XHRcdC8vIHVudGlsIGVpdGhlcjpcblx0XHRcdC8vIC0gdGhlIHdhaXQgbWFya2VyIGZpbGUgaGFzIGJlZW4gZGVsZXRlZCAoZS5nLiB3aGVuIGNsb3NpbmcgdGhlIGVkaXRvcilcblx0XHRcdC8vIC0gdGhlIGxhdW5jaGVkIHByb2Nlc3MgdGVybWluYXRlcyAoZS5nLiBkdWUgdG8gYSBjcmFzaClcblx0XHRcdHByb2Nlc3NDYWxsYmFja3MucHVzaChhc3luYyBjaGlsZCA9PiB7XG5cdFx0XHRcdGxldCBjaGlsZEV4aXRQcm9taXNlO1xuXHRcdFx0XHRpZiAoaXNNYWNPU0JpZ1N1ck9yTmV3ZXIpIHtcblx0XHRcdFx0XHQvLyBPbiBCaWcgU3VyLCB3ZSByZXNvbHZlIHRoZSBmb2xsb3dpbmcgcHJvbWlzZSBvbmx5IHdoZW4gdGhlIGNoaWxkLFxuXHRcdFx0XHRcdC8vIGkuZS4gdGhlIG9wZW4gY29tbWFuZCwgZXhpdGVkIHdpdGggYSBzaWduYWwgb3IgZXJyb3IuIE90aGVyd2lzZSwgd2Vcblx0XHRcdFx0XHQvLyB3YWl0IGZvciB0aGUgbWFya2VyIGZpbGUgdG8gYmUgZGVsZXRlZCBvciBmb3IgdGhlIGNoaWxkIHRvIGVycm9yLlxuXHRcdFx0XHRcdGNoaWxkRXhpdFByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdFx0XHRcdC8vIE9ubHkgcmVzb2x2ZSB0aGlzIHByb21pc2UgaWYgdGhlIGNoaWxkIChpLmUuIG9wZW4pIGV4aXRlZCB3aXRoIGFuIGVycm9yXG5cdFx0XHRcdFx0XHRjaGlsZC5vbignZXhpdCcsIChjb2RlLCBzaWduYWwpID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKGNvZGUgIT09IDAgfHwgc2lnbmFsKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBPbiBvdGhlciBwbGF0Zm9ybXMsIHdlIGxpc3RlbiBmb3IgZXhpdCBpbiBjYXNlIHRoZSBjaGlsZCBleGl0cyBiZWZvcmUgdGhlXG5cdFx0XHRcdFx0Ly8gbWFya2VyIGZpbGUgaXMgZGVsZXRlZC5cblx0XHRcdFx0XHRjaGlsZEV4aXRQcm9taXNlID0gRXZlbnQudG9Qcm9taXNlKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKGNoaWxkLCAnZXhpdCcpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdFx0XHR3aGVuRGVsZXRlZCh3YWl0TWFya2VyRmlsZVBhdGghKSxcblx0XHRcdFx0XHRcdEV2ZW50LnRvUHJvbWlzZShFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcihjaGlsZCwgJ2Vycm9yJykpLFxuXHRcdFx0XHRcdFx0Y2hpbGRFeGl0UHJvbWlzZVxuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdGlmIChzdGRpbkZpbGVQYXRoKSB7XG5cdFx0XHRcdFx0XHR1bmxpbmtTeW5jKHN0ZGluRmlsZVBhdGgpOyAvLyBNYWtlIHN1cmUgdG8gZGVsZXRlIHRoZSB0bXAgc3RkaW4gZmlsZSBpZiB3ZSBoYXZlIGFueVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgd2UgaGF2ZSBiZWVuIHN0YXJ0ZWQgd2l0aCBgLS1wcm9mLXN0YXJ0dXBgIHdlIG5lZWQgdG8gZmluZCBmcmVlIHBvcnRzIHRvIHByb2ZpbGVcblx0XHQvLyB0aGUgbWFpbiBwcm9jZXNzLCB0aGUgcmVuZGVyZXIsIGFuZCB0aGUgZXh0ZW5zaW9uIGhvc3QuIFdlIGFsc28gZGlzYWJsZSB2OCBjYWNoZWQgZGF0YVxuXHRcdC8vIHRvIGdldCBiZXR0ZXIgcHJvZmlsZSB0cmFjZXMuIExhc3QsIHdlIGxpc3RlbiBvbiBzdGRvdXQgZm9yIGEgc2lnbmFsIHRoYXQgdGVsbHMgdXMgdG9cblx0XHQvLyBzdG9wIHByb2ZpbGluZy5cblx0XHRpZiAoYXJnc1sncHJvZi1zdGFydHVwJ10pIHtcblx0XHRcdGNvbnN0IHByb2ZpbGVIb3N0ID0gJzEyNy4wLjAuMSc7XG5cdFx0XHRjb25zdCBwb3J0TWFpbiA9IGF3YWl0IGZpbmRGcmVlUG9ydChyYW5kb21Qb3J0KCksIDEwLCAzMDAwKTtcblx0XHRcdGNvbnN0IHBvcnRSZW5kZXJlciA9IGF3YWl0IGZpbmRGcmVlUG9ydChwb3J0TWFpbiArIDEsIDEwLCAzMDAwKTtcblx0XHRcdGNvbnN0IHBvcnRFeHRob3N0ID0gYXdhaXQgZmluZEZyZWVQb3J0KHBvcnRSZW5kZXJlciArIDEsIDEwLCAzMDAwKTtcblxuXHRcdFx0Ly8gZmFpbCB0aGUgb3BlcmF0aW9uIHdoZW4gb25lIG9mIHRoZSBwb3J0cyBjb3VsZG4ndCBiZSBhY3F1aXJlZC5cblx0XHRcdGlmIChwb3J0TWFpbiAqIHBvcnRSZW5kZXJlciAqIHBvcnRFeHRob3N0ID09PSAwKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZpbmQgZnJlZSBwb3J0cyBmb3IgcHJvZmlsZXIuIE1ha2Ugc3VyZSB0byBzaHV0ZG93biBhbGwgaW5zdGFuY2VzIG9mIHRoZSBlZGl0b3IgZmlyc3QuJyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZpbGVuYW1lUHJlZml4ID0gcmFuZG9tUGF0aChob21lZGlyKCksICdwcm9mJyk7XG5cblx0XHRcdGFkZEFyZyhhcmd2LCBgLS1pbnNwZWN0LWJyaz0ke3Byb2ZpbGVIb3N0fToke3BvcnRNYWlufWApO1xuXHRcdFx0YWRkQXJnKGFyZ3YsIGAtLXJlbW90ZS1kZWJ1Z2dpbmctcG9ydD0ke3Byb2ZpbGVIb3N0fToke3BvcnRSZW5kZXJlcn1gKTtcblx0XHRcdGFkZEFyZyhhcmd2LCBgLS1pbnNwZWN0LWJyay1leHRlbnNpb25zPSR7cHJvZmlsZUhvc3R9OiR7cG9ydEV4dGhvc3R9YCk7XG5cdFx0XHRhZGRBcmcoYXJndiwgYC0tcHJvZi1zdGFydHVwLXByZWZpeGAsIGZpbGVuYW1lUHJlZml4KTtcblx0XHRcdGFkZEFyZyhhcmd2LCBgLS1uby1jYWNoZWQtZGF0YWApO1xuXG5cdFx0XHR3cml0ZUZpbGVTeW5jKGZpbGVuYW1lUHJlZml4LCBhcmd2LnNsaWNlKC02KS5qb2luKCd8JykpO1xuXG5cdFx0XHRwcm9jZXNzQ2FsbGJhY2tzLnB1c2goYXN5bmMgX2NoaWxkID0+IHtcblxuXHRcdFx0XHRjbGFzcyBQcm9maWxlciB7XG5cdFx0XHRcdFx0c3RhdGljIGFzeW5jIHN0YXJ0KG5hbWU6IHN0cmluZywgZmlsZW5hbWVQcmVmaXg6IHN0cmluZywgb3B0czogeyBwb3J0OiBudW1iZXI7IHRyaWVzPzogbnVtYmVyOyB0YXJnZXQ/OiAodGFyZ2V0czogVGFyZ2V0W10pID0+IFRhcmdldCB9KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBwcm9maWxlciA9IGF3YWl0IGltcG9ydCgndjgtaW5zcGVjdC1wcm9maWxlcicpO1xuXG5cdFx0XHRcdFx0XHRsZXQgc2Vzc2lvbjogUHJvZmlsaW5nU2Vzc2lvbjtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdHNlc3Npb24gPSBhd2FpdCBwcm9maWxlci5zdGFydFByb2ZpbGluZyh7IC4uLm9wdHMsIGhvc3Q6IHByb2ZpbGVIb3N0IH0pO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoYEZBSUxFRCB0byBzdGFydCBwcm9maWxpbmcgZm9yICcke25hbWV9JyBvbiBwb3J0ICcke29wdHMucG9ydH0nYCk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGFzeW5jIHN0b3AoKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGxldCBzdWZmaXggPSAnJztcblx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZXNzaW9uLnN0b3AoKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoIXByb2Nlc3MuZW52WydWU0NPREVfREVWJ10pIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vIHdoZW4gcnVubmluZyBmcm9tIGEgbm90LWRldmVsb3BtZW50LWJ1aWxkIHdlIHJlbW92ZVxuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gYWJzb2x1dGUgZmlsZW5hbWVzIGJlY2F1c2Ugd2UgZG9uJ3Qgd2FudCB0byByZXZlYWwgYW55dGhpbmdcblx0XHRcdFx0XHRcdFx0XHRcdC8vIGFib3V0IHVzZXJzLiBXZSBhbHNvIGFwcGVuZCB0aGUgYC50eHRgIHN1ZmZpeCB0byBtYWtlIGl0XG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBlYXNpZXIgdG8gYXR0YWNoIHRoZXNlIGZpbGVzIHRvIEdIIGlzc3Vlc1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVzdWx0LnByb2ZpbGUgPSBVdGlscy5yZXdyaXRlQWJzb2x1dGVQYXRocyhyZXN1bHQucHJvZmlsZSwgJ3BpaVJlbW92ZWQnKTtcblx0XHRcdFx0XHRcdFx0XHRcdHN1ZmZpeCA9ICcudHh0Jztcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHR3cml0ZUZpbGVTeW5jKGAke2ZpbGVuYW1lUHJlZml4fS4ke25hbWV9LmNwdXByb2ZpbGUke3N1ZmZpeH1gLCBKU09OLnN0cmluZ2lmeShyZXN1bHQucHJvZmlsZSwgdW5kZWZpbmVkLCA0KSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHQvLyBsb2FkIGFuZCBzdGFydCBwcm9maWxlclxuXHRcdFx0XHRcdGNvbnN0IG1haW5Qcm9maWxlUmVxdWVzdCA9IFByb2ZpbGVyLnN0YXJ0KCdtYWluJywgZmlsZW5hbWVQcmVmaXgsIHsgcG9ydDogcG9ydE1haW4gfSk7XG5cdFx0XHRcdFx0Y29uc3QgZXh0SG9zdFByb2ZpbGVSZXF1ZXN0ID0gUHJvZmlsZXIuc3RhcnQoJ2V4dEhvc3QnLCBmaWxlbmFtZVByZWZpeCwgeyBwb3J0OiBwb3J0RXh0aG9zdCwgdHJpZXM6IDMwMCB9KTtcblx0XHRcdFx0XHRjb25zdCByZW5kZXJlclByb2ZpbGVSZXF1ZXN0ID0gUHJvZmlsZXIuc3RhcnQoJ3JlbmRlcmVyJywgZmlsZW5hbWVQcmVmaXgsIHtcblx0XHRcdFx0XHRcdHBvcnQ6IHBvcnRSZW5kZXJlcixcblx0XHRcdFx0XHRcdHRyaWVzOiAyMDAsXG5cdFx0XHRcdFx0XHR0YXJnZXQ6IGZ1bmN0aW9uICh0YXJnZXRzKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0YXJnZXRzLmZpbHRlcih0YXJnZXQgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmICghdGFyZ2V0LndlYlNvY2tldERlYnVnZ2VyVXJsKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGlmICh0YXJnZXQudHlwZSA9PT0gJ3BhZ2UnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdGFyZ2V0LnVybC5pbmRleE9mKCd3b3JrYmVuY2gvd29ya2JlbmNoLmh0bWwnKSA+IDAgfHwgdGFyZ2V0LnVybC5pbmRleE9mKCd3b3JrYmVuY2gvd29ya2JlbmNoLWRldi5odG1sJykgPiAwO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pWzBdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Y29uc3QgbWFpbiA9IGF3YWl0IG1haW5Qcm9maWxlUmVxdWVzdDtcblx0XHRcdFx0XHRjb25zdCBleHRIb3N0ID0gYXdhaXQgZXh0SG9zdFByb2ZpbGVSZXF1ZXN0O1xuXHRcdFx0XHRcdGNvbnN0IHJlbmRlcmVyID0gYXdhaXQgcmVuZGVyZXJQcm9maWxlUmVxdWVzdDtcblxuXHRcdFx0XHRcdC8vIHdhaXQgZm9yIHRoZSByZW5kZXJlciB0byBkZWxldGUgdGhlIG1hcmtlciBmaWxlXG5cdFx0XHRcdFx0YXdhaXQgd2hlbkRlbGV0ZWQoZmlsZW5hbWVQcmVmaXgpO1xuXG5cdFx0XHRcdFx0Ly8gc3RvcCBwcm9maWxpbmdcblx0XHRcdFx0XHRhd2FpdCBtYWluLnN0b3AoKTtcblx0XHRcdFx0XHRhd2FpdCByZW5kZXJlci5zdG9wKCk7XG5cdFx0XHRcdFx0YXdhaXQgZXh0SG9zdC5zdG9wKCk7XG5cblx0XHRcdFx0XHQvLyByZS1jcmVhdGUgdGhlIG1hcmtlciBmaWxlIHRvIHNpZ25hbCB0aGF0IHByb2ZpbGluZyBpcyBkb25lXG5cdFx0XHRcdFx0d3JpdGVGaWxlU3luYyhmaWxlbmFtZVByZWZpeCwgJycpO1xuXG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gcHJvZmlsZSBzdGFydHVwLiBNYWtlIHN1cmUgdG8gcXVpdCBDb2RlIGZpcnN0LicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBvcHRpb25zOiBTcGF3bk9wdGlvbnMgPSB7XG5cdFx0XHRkZXRhY2hlZDogdHJ1ZSxcblx0XHRcdGVudlxuXHRcdH07XG5cblx0XHRpZiAoIWFyZ3MudmVyYm9zZSkge1xuXHRcdFx0b3B0aW9uc1snc3RkaW8nXSA9ICdpZ25vcmUnO1xuXHRcdH1cblxuXHRcdGxldCBjaGlsZDogQ2hpbGRQcm9jZXNzO1xuXHRcdGlmICghaXNNYWNPU0JpZ1N1ck9yTmV3ZXIpIHtcblx0XHRcdGlmICghYXJncy52ZXJib3NlICYmIGFyZ3Muc3RhdHVzKSB7XG5cdFx0XHRcdG9wdGlvbnNbJ3N0ZGlvJ10gPSBbJ2lnbm9yZScsICdwaXBlJywgJ2lnbm9yZSddOyAvLyByZXN0b3JlIGFiaWxpdHkgdG8gc2VlIG91dHB1dCB3aGVuIC0tc3RhdHVzIGlzIHVzZWRcblx0XHRcdH1cblxuXHRcdFx0Ly8gV2Ugc3Bhd24gcHJvY2Vzcy5leGVjUGF0aCBkaXJlY3RseVxuXHRcdFx0Y2hpbGQgPSBzcGF3bihwcm9jZXNzLmV4ZWNQYXRoLCBhcmd2LnNsaWNlKDIpLCBvcHRpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gT24gQmlnIFN1ciwgd2Ugc3Bhd24gdXNpbmcgdGhlIG9wZW4gY29tbWFuZCB0byBvYnRhaW4gYmVoYXZpb3Jcblx0XHRcdC8vIHNpbWlsYXIgdG8gaWYgdGhlIGFwcCB3YXMgbGF1bmNoZWQgZnJvbSB0aGUgZG9ja1xuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwMjk3NVxuXG5cdFx0XHQvLyBUaGUgZm9sbG93aW5nIGFyZ3MgYXJlIGZvciB0aGUgb3BlbiBjb21tYW5kIGl0c2VsZiwgcmF0aGVyIHRoYW4gZm9yIFZTIENvZGU6XG5cdFx0XHQvLyAtbiBjcmVhdGVzIGEgbmV3IGluc3RhbmNlLlxuXHRcdFx0Ly8gICAgV2l0aG91dCAtbiwgdGhlIG9wZW4gY29tbWFuZCByZS1vcGVucyB0aGUgZXhpc3RpbmcgaW5zdGFuY2UgYXMtaXMuXG5cdFx0XHQvLyAtZyBzdGFydHMgdGhlIG5ldyBpbnN0YW5jZSBpbiB0aGUgYmFja2dyb3VuZC5cblx0XHRcdC8vICAgIExhdGVyLCBFbGVjdHJvbiBicmluZ3MgdGhlIGluc3RhbmNlIHRvIHRoZSBmb3JlZ3JvdW5kLlxuXHRcdFx0Ly8gICAgVGhpcyB3YXksIE1hYyBkb2VzIG5vdCBhdXRvbWF0aWNhbGx5IHRyeSB0byBmb3JlZ3JvdW5kIHRoZSBuZXcgaW5zdGFuY2UsIHdoaWNoIGNhdXNlc1xuXHRcdFx0Ly8gICAgZm9jdXNpbmcgaXNzdWVzIHdoZW4gdGhlIG5ldyBpbnN0YW5jZSBvbmx5IHNlbmRzIGRhdGEgdG8gYSBwcmV2aW91cyBpbnN0YW5jZSBhbmQgdGhlbiBjbG9zZXMuXG5cdFx0XHRjb25zdCBzcGF3bkFyZ3MgPSBbJy1uJywgJy1nJ107XG5cdFx0XHQvLyAtYSBvcGVucyB0aGUgZ2l2ZW4gYXBwbGljYXRpb24uXG5cdFx0XHRzcGF3bkFyZ3MucHVzaCgnLWEnLCBwcm9jZXNzLmV4ZWNQYXRoKTsgLy8gLWE6IG9wZW5zIGEgc3BlY2lmaWMgYXBwbGljYXRpb25cblxuXHRcdFx0aWYgKGFyZ3MudmVyYm9zZSB8fCBhcmdzLnN0YXR1cykge1xuXHRcdFx0XHRzcGF3bkFyZ3MucHVzaCgnLS13YWl0LWFwcHMnKTsgLy8gYG9wZW4gLS13YWl0LWFwcHNgOiBibG9ja3MgdW50aWwgdGhlIGxhdW5jaGVkIGFwcCBpcyBjbG9zZWQgKGV2ZW4gaWYgdGhleSB3ZXJlIGFscmVhZHkgcnVubmluZylcblxuXHRcdFx0XHQvLyBUaGUgb3BlbiBjb21tYW5kIG9ubHkgYWxsb3dzIGZvciByZWRpcmVjdGluZyBzdGRlcnIgYW5kIHN0ZG91dCB0byBmaWxlcyxcblx0XHRcdFx0Ly8gc28gd2UgbWFrZSBpdCByZWRpcmVjdCB0aG9zZSB0byB0ZW1wIGZpbGVzLCBhbmQgdGhlbiB1c2UgYSBsb2dnZXIgdG9cblx0XHRcdFx0Ly8gcmVkaXJlY3QgdGhlIGZpbGUgb3V0cHV0IHRvIHRoZSBjb25zb2xlXG5cdFx0XHRcdGZvciAoY29uc3Qgb3V0cHV0VHlwZSBvZiBhcmdzLnZlcmJvc2UgPyBbJ3N0ZG91dCcsICdzdGRlcnInXSA6IFsnc3Rkb3V0J10pIHtcblxuXHRcdFx0XHRcdC8vIFRtcCBmaWxlIHRvIHRhcmdldCBvdXRwdXQgdG9cblx0XHRcdFx0XHRjb25zdCB0bXBOYW1lID0gcmFuZG9tUGF0aCh0bXBkaXIoKSwgYGNvZGUtJHtvdXRwdXRUeXBlfWApO1xuXHRcdFx0XHRcdHdyaXRlRmlsZVN5bmModG1wTmFtZSwgJycpO1xuXHRcdFx0XHRcdHNwYXduQXJncy5wdXNoKGAtLSR7b3V0cHV0VHlwZX1gLCB0bXBOYW1lKTtcblxuXHRcdFx0XHRcdC8vIExpc3RlbmVyIHRvIHJlZGlyZWN0IGNvbnRlbnQgdG8gc3Rkb3V0L3N0ZGVyclxuXHRcdFx0XHRcdHByb2Nlc3NDYWxsYmFja3MucHVzaChhc3luYyBjaGlsZCA9PiB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzdHJlYW0gPSBvdXRwdXRUeXBlID09PSAnc3Rkb3V0JyA/IHByb2Nlc3Muc3Rkb3V0IDogcHJvY2Vzcy5zdGRlcnI7XG5cblx0XHRcdFx0XHRcdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRcdFx0XHRcdGNoaWxkLm9uKCdjbG9zZScsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHQvLyBXZSBtdXN0IGRpc3Bvc2UgdGhlIHRva2VuIHRvIHN0b3Agd2F0Y2hpbmcsXG5cdFx0XHRcdFx0XHRcdFx0Ly8gYnV0IHRoZSB3YXRjaGVyIG1pZ2h0IHN0aWxsIGJlIHJlYWRpbmcgZGF0YS5cblx0XHRcdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IGN0cy5kaXNwb3NlKHRydWUpLCAyMDApO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgd2F0Y2hGaWxlQ29udGVudHModG1wTmFtZSwgY2h1bmsgPT4gc3RyZWFtLndyaXRlKGNodW5rKSwgKCkgPT4geyAvKiBpZ25vcmUgKi8gfSwgY3RzLnRva2VuKTtcblx0XHRcdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0XHRcdHVubGlua1N5bmModG1wTmFtZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBlIGluIGVudikge1xuXHRcdFx0XHQvLyBJZ25vcmUgdGhlIF8gZW52IHZhciwgYmVjYXVzZSB0aGUgb3BlbiBjb21tYW5kXG5cdFx0XHRcdC8vIGlnbm9yZXMgaXQgYW55d2F5LlxuXHRcdFx0XHQvLyBQYXNzIHRoZSByZXN0IG9mIHRoZSBlbnYgdmFycyBpbiB0byBmaXhcblx0XHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNDY5Ni5cblx0XHRcdFx0aWYgKGUgIT09ICdfJykge1xuXHRcdFx0XHRcdHNwYXduQXJncy5wdXNoKCctLWVudicpO1xuXHRcdFx0XHRcdHNwYXduQXJncy5wdXNoKGAke2V9PSR7ZW52W2VdfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHNwYXduQXJncy5wdXNoKCctLWFyZ3MnLCAuLi5hcmd2LnNsaWNlKDIpKTsgLy8gcGFzcyBvbiBvdXIgYXJndW1lbnRzXG5cblx0XHRcdGlmIChlbnZbJ1ZTQ09ERV9ERVYnXSkge1xuXHRcdFx0XHQvLyBJZiB3ZSdyZSBpbiBkZXZlbG9wbWVudCBtb2RlLCByZXBsYWNlIHRoZSAuIGFyZyB3aXRoIHRoZVxuXHRcdFx0XHQvLyB2c2NvZGUgc291cmNlIGFyZy4gQmVjYXVzZSB0aGUgT1NTIGFwcCBpc24ndCBidW5kbGVkLFxuXHRcdFx0XHQvLyBpdCBuZWVkcyB0aGUgZnVsbCB2c2NvZGUgc291cmNlIGFyZyB0byBsYXVuY2ggcHJvcGVybHkuXG5cdFx0XHRcdGNvbnN0IGN1cmRpciA9ICcuJztcblx0XHRcdFx0Y29uc3QgbGF1bmNoRGlySW5kZXggPSBzcGF3bkFyZ3MuaW5kZXhPZihjdXJkaXIpO1xuXHRcdFx0XHRpZiAobGF1bmNoRGlySW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdFx0c3Bhd25BcmdzW2xhdW5jaERpckluZGV4XSA9IHJlc29sdmUoY3VyZGlyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBXZSBhbHJlYWR5IHBhc3NlZCBvdmVyIHRoZSBlbnYgdmFyaWFibGVzXG5cdFx0XHQvLyB1c2luZyB0aGUgLS1lbnYgZmxhZ3MsIHNvIHdlIGNhbiBsZWF2ZSB0aGVtIG91dCBoZXJlLlxuXHRcdFx0Ly8gQWxzbywgd2UgZG9uJ3QgbmVlZCB0byBwYXNzIGVudi5fLCB3aGljaCBpcyBkaWZmZXJlbnQgZnJvbSBhcmd2Ll9cblx0XHRcdGNoaWxkID0gc3Bhd24oJ29wZW4nLCBzcGF3bkFyZ3MsIHsgLi4ub3B0aW9ucywgZW52OiB7fSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvY2Vzc0NhbGxiYWNrcy5tYXAoY2FsbGJhY2sgPT4gY2FsbGJhY2soY2hpbGQpKSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0QXBwUm9vdCgpIHtcblx0cmV0dXJuIGRpcm5hbWUoRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJycpLmZzUGF0aCk7XG59XG5cbmZ1bmN0aW9uIGV2ZW50dWFsbHlFeGl0KGNvZGU6IG51bWJlcik6IHZvaWQge1xuXHRzZXRUaW1lb3V0KCgpID0+IHByb2Nlc3MuZXhpdChjb2RlKSwgMCk7XG59XG5cbm1haW4ocHJvY2Vzcy5hcmd2KVxuXHQudGhlbigoKSA9PiBldmVudHVhbGx5RXhpdCgwKSlcblx0LnRoZW4obnVsbCwgZXJyID0+IHtcblx0XHRjb25zb2xlLmVycm9yKGVyci5tZXNzYWdlIHx8IGVyci5zdGFjayB8fCBlcnIpO1xuXHRc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USxNQUFNLFFBQVEsV0FBVyxFQUFFLEdBQUcsU0FBUyxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQUEsSUFDekQ7QUFFQSxXQUFPLFFBQVEsSUFBSSxpQkFBaUIsSUFBSSxjQUFZLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFBQSxFQUNyRTtBQUNEO0FBRUEsU0FBUyxhQUFhO0FBQ3JCLFNBQU8sUUFBUSxXQUFXLFVBQVUsRUFBRSxFQUFFLE1BQU07QUFDL0M7QUFFQSxTQUFTLGVBQWUsTUFBb0I7QUFDM0MsYUFBVyxNQUFNLFFBQVEsS0FBSyxJQUFJLEdBQUcsQ0FBQztBQUN2QztBQUVBLEtBQUssUUFBUSxJQUFJLEVBQ2YsS0FBSyxNQUFNLGVBQWUsQ0FBQyxDQUFDLEVBQzVCLEtBQUssTUFBTSxTQUFPO0FBQ2xCLFVBQVEsTUFBTSxJQUFJLFdBQVcsSUFBSSxTQUFTLEdBQUc7QUFDN0MsaUJBQWUsQ0FBQztBQUNqQixDQUFDOyIsCiAgIm5hbWVzIjogWyJyZXNvbHZlIiwgImNoaWxkIiwgImZpbGVuYW1lUHJlZml4IiwgIm1haW4iXQp9Cg==
