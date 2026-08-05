import * as fs from "fs";
import * as url from "url";
import * as cp from "child_process";
import * as http from "http";
import { cwd } from "../../base/common/process.js";
import { dirname, extname, resolve, join } from "../../base/common/path.js";
import { parseArgs, buildHelpMessage, buildVersionMessage, OPTIONS } from "../../platform/environment/node/argv.js";
import { createWaitMarkerFileSync } from "../../platform/environment/node/wait.js";
import { hasStdinWithoutTty, getStdinFilePath, readFromStdin } from "../../platform/environment/node/stdin.js";
import { DeferredPromise } from "../../base/common/async.js";
import { FileAccess } from "../../base/common/network.js";
const isSupportedForCmd = (optionId) => {
  switch (optionId) {
    case "user-data-dir":
    case "extensions-dir":
    case "export-default-configuration":
    case "install-source":
    case "enable-smoke-test-driver":
    case "extensions-download-dir":
    case "builtin-extensions-dir":
    case "telemetry":
      return false;
    default:
      return true;
  }
};
const isSupportedForPipe = (optionId) => {
  switch (optionId) {
    case "version":
    case "help":
    case "folder-uri":
    case "file-uri":
    case "add":
    case "diff":
    case "merge":
    case "wait":
    case "goto":
    case "reuse-window":
    case "new-window":
    case "status":
    case "install-extension":
    case "uninstall-extension":
    case "update-extensions":
    case "list-extensions":
    case "force":
    case "do-not-include-pack-dependencies":
    case "show-versions":
    case "category":
    case "verbose":
    case "remote":
    case "locate-shell-integration-path":
      return true;
    default:
      return false;
  }
};
const cliPipe = process.env["VSCODE_IPC_HOOK_CLI"];
const cliCommand = process.env["VSCODE_CLIENT_COMMAND"];
const cliCommandCwd = process.env["VSCODE_CLIENT_COMMAND_CWD"];
const cliRemoteAuthority = process.env["VSCODE_CLI_AUTHORITY"];
const cliStdInFilePath = process.env["VSCODE_STDIN_FILE_PATH"];
async function main(desc, args) {
  if (!cliPipe && !cliCommand) {
    console.log("Command is only available in WSL or inside a Visual Studio Code terminal.");
    return;
  }
  const options = { ...OPTIONS, gitCredential: { type: "string" }, openExternal: { type: "boolean" } };
  const isSupported = cliCommand ? isSupportedForCmd : isSupportedForPipe;
  for (const optionId in OPTIONS) {
    const optId = optionId;
    if (!isSupported(optId)) {
      delete options[optId];
    }
  }
  if (cliPipe) {
    options["openExternal"] = { type: "boolean" };
  }
  const errorReporter = {
    onMultipleValues: (id, usedValue) => {
      console.error(`Option '${id}' can only be defined once. Using value ${usedValue}.`);
    },
    onEmptyValue: (id) => {
      console.error(`Ignoring option '${id}': Value must not be empty.`);
    },
    onUnknownOption: (id) => {
      console.error(`Ignoring option '${id}': not supported for ${desc.executableName}.`);
    },
    onDeprecatedOption: (deprecatedOption, message) => {
      console.warn(`Option '${deprecatedOption}' is deprecated: ${message}`);
    }
  };
  const parsedArgs = parseArgs(args, options, errorReporter);
  const mapFileUri = cliRemoteAuthority ? mapFileToRemoteUri : (uri) => uri;
  const verbose = !!parsedArgs["verbose"];
  if (parsedArgs.help) {
    console.log(buildHelpMessage(desc.productName, desc.executableName, desc.version, options));
    return;
  }
  if (parsedArgs.version) {
    console.log(buildVersionMessage(desc.version, desc.commit));
    return;
  }
  if (parsedArgs["locate-shell-integration-path"]) {
    let file;
    switch (parsedArgs["locate-shell-integration-path"]) {
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
    return;
  }
  if (cliPipe) {
    if (parsedArgs["openExternal"]) {
      await openInBrowser(parsedArgs["_"], verbose);
      return;
    }
  }
  let remote = parsedArgs.remote;
  if (remote === "local" || remote === "false" || remote === "") {
    remote = null;
  }
  const folderURIs = (parsedArgs["folder-uri"] || []).map(mapFileUri);
  parsedArgs["folder-uri"] = folderURIs;
  const fileURIs = (parsedArgs["file-uri"] || []).map(mapFileUri);
  parsedArgs["file-uri"] = fileURIs;
  const inputPaths = parsedArgs["_"];
  let hasReadStdinArg = false;
  for (const input of inputPaths) {
    if (input === "-") {
      hasReadStdinArg = true;
    } else {
      translatePath(input, mapFileUri, folderURIs, fileURIs);
    }
  }
  parsedArgs["_"] = [];
  let readFromStdinPromise;
  let stdinFilePath;
  if (hasReadStdinArg && hasStdinWithoutTty()) {
    try {
      stdinFilePath = cliStdInFilePath;
      if (!stdinFilePath) {
        stdinFilePath = getStdinFilePath();
        const readFromStdinDone = new DeferredPromise();
        await readFromStdin(stdinFilePath, verbose, () => readFromStdinDone.complete());
        if (!parsedArgs.wait) {
          readFromStdinPromise = readFromStdinDone.p;
        }
      }
      translatePath(stdinFilePath, mapFileUri, folderURIs, fileURIs);
      parsedArgs["skip-add-to-recently-opened"] = true;
      console.log(`Reading from stdin via: ${stdinFilePath}`);
    } catch (e) {
      console.log(`Failed to create file to read via stdin: ${e.toString()}`);
    }
  }
  if (parsedArgs.extensionDevelopmentPath) {
    parsedArgs.extensionDevelopmentPath = parsedArgs.extensionDevelopmentPath.map((p) => mapFileUri(pathToURI(p).href));
  }
  if (parsedArgs.extensionTestsPath) {
    parsedArgs.extensionTestsPath = mapFileUri(pathToURI(parsedArgs["extensionTestsPath"]).href);
  }
  const crashReporterDirectory = parsedArgs["crash-reporter-directory"];
  if (crashReporterDirectory !== void 0 && !crashReporterDirectory.match(/^([a-zA-Z]:[\\\/])/)) {
    console.log(`The crash reporter directory '${crashReporterDirectory}' must be an absolute Windows path (e.g. c:/crashes)`);
    return;
  }
  if (cliCommand) {
    if (parsedArgs["install-extension"] !== void 0 || parsedArgs["uninstall-extension"] !== void 0 || parsedArgs["list-extensions"] || parsedArgs["update-extensions"]) {
      const cmdLine = [];
      parsedArgs["install-extension"]?.forEach((id) => cmdLine.push("--install-extension", id));
      parsedArgs["uninstall-extension"]?.forEach((id) => cmdLine.push("--uninstall-extension", id));
      ["list-extensions", "force", "show-versions", "category"].forEach((opt) => {
        const value = parsedArgs[opt];
        if (value !== void 0) {
          cmdLine.push(`--${opt}=${value}`);
        }
      });
      if (parsedArgs["update-extensions"]) {
        cmdLine.push("--update-extensions");
      }
      const childProcess = cp.fork(FileAccess.asFileUri("server-main").fsPath, cmdLine, { stdio: "inherit" });
      childProcess.on("error", (err) => console.log(err));
      return;
    }
    const newCommandline = [];
    for (const key in parsedArgs) {
      const val = parsedArgs[key];
      if (typeof val === "boolean") {
        if (val) {
          newCommandline.push("--" + key);
        }
      } else if (Array.isArray(val)) {
        for (const entry of val) {
          newCommandline.push(`--${key}=${entry.toString()}`);
        }
      } else if (val) {
        newCommandline.push(`--${key}=${val.toString()}`);
      }
    }
    if (remote !== null) {
      newCommandline.push(`--remote=${remote || cliRemoteAuthority}`);
    }
    const ext = extname(cliCommand);
    if (ext === ".bat" || ext === ".cmd") {
      const processCwd = cliCommandCwd || cwd();
      if (verbose) {
        console.log(`Invoking: cmd.exe /C ${cliCommand} ${newCommandline.join(" ")} in ${processCwd}`);
      }
      cp.spawn("cmd.exe", ["/C", cliCommand, ...newCommandline], {
        stdio: "inherit",
        cwd: processCwd
      });
    } else {
      const cliCwd = dirname(cliCommand);
      const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
      newCommandline.unshift("resources/app/out/cli.js");
      if (verbose) {
        console.log(`Invoking: cd "${cliCwd}" && ELECTRON_RUN_AS_NODE=1 "${cliCommand}" "${newCommandline.join('" "')}"`);
      }
      if (runningInWSL2()) {
        if (verbose) {
          console.log(`Using pipes for output.`);
        }
        const childProcess = cp.spawn(cliCommand, newCommandline, { cwd: cliCwd, env, stdio: ["inherit", "pipe", "pipe"] });
        childProcess.stdout.on("data", (data) => process.stdout.write(data));
        childProcess.stderr.on("data", (data) => process.stderr.write(data));
      } else {
        cp.spawn(cliCommand, newCommandline, { cwd: cliCwd, env, stdio: "inherit" });
      }
    }
  } else {
    if (parsedArgs.status) {
      await sendToPipe({
        type: "status"
      }, verbose).then((res) => {
        console.log(res);
      }).catch((e) => {
        console.error("Error when requesting status:", e);
      });
      return;
    }
    if (parsedArgs["install-extension"] !== void 0 || parsedArgs["uninstall-extension"] !== void 0 || parsedArgs["list-extensions"] || parsedArgs["update-extensions"]) {
      await sendToPipe({
        type: "extensionManagement",
        list: parsedArgs["list-extensions"] ? { showVersions: parsedArgs["show-versions"], category: parsedArgs["category"] } : void 0,
        install: asExtensionIdOrVSIX(parsedArgs["install-extension"]),
        uninstall: asExtensionIdOrVSIX(parsedArgs["uninstall-extension"]),
        force: parsedArgs["force"]
      }, verbose).then((res) => {
        console.log(res);
      }).catch((e) => {
        console.error("Error when invoking the extension management command:", e);
      });
      return;
    }
    let waitMarkerFilePath = void 0;
    if (parsedArgs["wait"]) {
      if (!fileURIs.length) {
        console.log("At least one file must be provided to wait for.");
        return;
      }
      waitMarkerFilePath = createWaitMarkerFileSync(verbose);
    }
    await sendToPipe({
      type: "open",
      fileURIs,
      folderURIs,
      diffMode: parsedArgs.diff,
      mergeMode: parsedArgs.merge,
      addMode: parsedArgs.add,
      removeMode: parsedArgs.remove,
      gotoLineMode: parsedArgs.goto,
      forceReuseWindow: parsedArgs["reuse-window"],
      forceNewWindow: parsedArgs["new-window"],
      waitMarkerFilePath,
      remoteAuthority: remote
    }, verbose).catch((e) => {
      console.error("Error when invoking the open command:", e);
    });
    if (waitMarkerFilePath) {
      await waitForFileDeleted(waitMarkerFilePath);
    }
    if (readFromStdinPromise) {
      await readFromStdinPromise;
    }
    if (waitMarkerFilePath && stdinFilePath) {
      try {
        fs.unlinkSync(stdinFilePath);
      } catch (e) {
      }
    }
  }
}
function runningInWSL2() {
  if (!!process.env["WSL_DISTRO_NAME"]) {
    try {
      return cp.execSync("uname -r", { encoding: "utf8" }).includes("-microsoft-");
    } catch (_e) {
    }
  }
  return false;
}
async function waitForFileDeleted(path) {
  while (fs.existsSync(path)) {
    await new Promise((res) => setTimeout(res, 1e3));
  }
}
async function openInBrowser(args, verbose) {
  const uris = [];
  for (const location of args) {
    try {
      if (/^[a-z-]+:\/\/.+/.test(location)) {
        uris.push(url.parse(location).href);
      } else {
        uris.push(pathToURI(location).href);
      }
    } catch (e) {
      console.log(`Invalid url: ${location}`);
    }
  }
  if (uris.length) {
    await sendToPipe({
      type: "openExternal",
      uris
    }, verbose).catch((e) => {
      console.error("Error when invoking the open external command:", e);
    });
  }
}
function sendToPipe(args, verbose) {
  if (verbose) {
    console.log(JSON.stringify(args, null, "  "));
  }
  return new Promise((resolve2, reject) => {
    const message = JSON.stringify(args);
    if (!cliPipe) {
      console.log("Message " + message);
      resolve2("");
      return;
    }
    const opts = {
      socketPath: cliPipe,
      path: "/",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      }
    };
    const req = http.request(opts, (res) => {
      if (res.headers["content-type"] !== "application/json") {
        reject("Error in response: Invalid content type: Expected 'application/json', is: " + res.headers["content-type"]);
        return;
      }
      const chunks = [];
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        chunks.push(chunk);
      });
      res.on("error", (err) => fatal("Error in response.", err));
      res.on("end", () => {
        const content = chunks.join("");
        try {
          const obj = JSON.parse(content);
          if (res.statusCode === 200) {
            resolve2(obj);
          } else {
            reject(obj);
          }
        } catch (e) {
          reject("Error in response: Unable to parse response as JSON: " + content);
        }
      });
    });
    req.on("error", (err) => fatal("Error in request.", err));
    req.write(message);
    req.end();
  });
}
function asExtensionIdOrVSIX(inputs) {
  return inputs?.map((input) => /\.vsix$/i.test(input) ? pathToURI(input).href : input);
}
function fatal(message, err) {
  console.error("Unable to connect to VS Code server: " + message);
  console.error(err);
  process.exit(1);
}
const preferredCwd = process.env.PWD || cwd();
function pathToURI(input) {
  input = input.trim();
  input = resolve(preferredCwd, input);
  return url.pathToFileURL(input);
}
function translatePath(input, mapFileUri, folderURIS, fileURIS) {
  const url2 = pathToURI(input);
  const mappedUri = mapFileUri(url2.href);
  try {
    const stat = fs.lstatSync(fs.realpathSync(input));
    if (stat.isFile()) {
      fileURIS.push(mappedUri);
    } else if (stat.isDirectory()) {
      folderURIS.push(mappedUri);
    } else if (input === "/dev/null") {
      fileURIS.push(mappedUri);
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      fileURIS.push(mappedUri);
    } else {
      console.log(`Problem accessing file ${input}. Ignoring file`, e);
    }
  }
}
function mapFileToRemoteUri(uri) {
  return uri.replace(/^file:\/\//, "vscode-remote://" + cliRemoteAuthority);
}
function getAppRoot() {
  return dirname(FileAccess.asFileUri("").fsPath);
}
const [, , productName, version, commit, executableName, ...remainingArgs] = process.argv;
main({ productName, version, commit, executableName }, remainingArgs).then(null, (err) => {
  console.error(err.message || err.stack || err);
});
export {
  main
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9zZXJ2ZXIvbm9kZS9zZXJ2ZXIuY2xpLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgKiBhcyBjcCBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyBjd2QgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIGV4dG5hbWUsIHJlc29sdmUsIGpvaW4gfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IHBhcnNlQXJncywgYnVpbGRIZWxwTWVzc2FnZSwgYnVpbGRWZXJzaW9uTWVzc2FnZSwgT1BUSU9OUywgT3B0aW9uRGVzY3JpcHRpb25zLCBFcnJvclJlcG9ydGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvbm9kZS9hcmd2LmpzJztcbmltcG9ydCB7IE5hdGl2ZVBhcnNlZEFyZ3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vYXJndi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVXYWl0TWFya2VyRmlsZVN5bmMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9ub2RlL3dhaXQuanMnO1xuaW1wb3J0IHsgUGlwZUNvbW1hbmQgfSBmcm9tICcuLi8uLi93b3JrYmVuY2gvYXBpL25vZGUvZXh0SG9zdENMSVNlcnZlci5qcyc7XG5pbXBvcnQgeyBoYXNTdGRpbldpdGhvdXRUdHksIGdldFN0ZGluRmlsZVBhdGgsIHJlYWRGcm9tU3RkaW4gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9ub2RlL3N0ZGluLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcblxuLypcbiAqIEltcGxlbWVudHMgYSBzdGFuZGFsb25lIENMSSBhcHAgdGhhdCBvcGVucyBWUyBDb2RlIGZyb20gYSByZW1vdGUgdGVybWluYWwuXG4gKiAgLSBJbiBpbnRlZ3JhdGVkIHRlcm1pbmFscyBmb3IgcmVtb3RlIHdpbmRvd3MgdGhpcyBjb25uZWN0cyB0byB0aGUgcmVtb3RlIHNlcnZlciB0aG91Z2ggYSBwaXBlLlxuICogICAgVGhlIHBpcGUgaXMgcGFzc2VkIGluIGVudiBWU0NPREVfSVBDX0hPT0tfQ0xJLlxuICogIC0gSW4gZXh0ZXJuYWwgdGVybWluYWxzIGZvciBXU0wgdGhpcyBjYWxscyBWUyBDb2RlIG9uIHRoZSBXaW5kb3dzIHNpZGUuXG4gKiAgICBUaGUgVlMgQ29kZSBkZXNrdG9wIGV4ZWN1dGFibGUgcGF0aCBpcyBwYXNzZWQgaW4gZW52IFZTQ09ERV9DTElFTlRfQ09NTUFORC5cbiAqL1xuXG5cbmludGVyZmFjZSBQcm9kdWN0RGVzY3JpcHRpb24ge1xuXHRwcm9kdWN0TmFtZTogc3RyaW5nO1xuXHR2ZXJzaW9uOiBzdHJpbmc7XG5cdGNvbW1pdDogc3RyaW5nO1xuXHRleGVjdXRhYmxlTmFtZTogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUmVtb3RlUGFyc2VkQXJncyBleHRlbmRzIE5hdGl2ZVBhcnNlZEFyZ3MgeyAnZ2l0Q3JlZGVudGlhbCc/OiBzdHJpbmc7ICdvcGVuRXh0ZXJuYWwnPzogYm9vbGVhbiB9XG5cblxuY29uc3QgaXNTdXBwb3J0ZWRGb3JDbWQgPSAob3B0aW9uSWQ6IGtleW9mIFJlbW90ZVBhcnNlZEFyZ3MpID0+IHtcblx0c3dpdGNoIChvcHRpb25JZCkge1xuXHRcdGNhc2UgJ3VzZXItZGF0YS1kaXInOlxuXHRcdGNhc2UgJ2V4dGVuc2lvbnMtZGlyJzpcblx0XHRjYXNlICdleHBvcnQtZGVmYXVsdC1jb25maWd1cmF0aW9uJzpcblx0XHRjYXNlICdpbnN0YWxsLXNvdXJjZSc6XG5cdFx0Y2FzZSAnZW5hYmxlLXNtb2tlLXRlc3QtZHJpdmVyJzpcblx0XHRjYXNlICdleHRlbnNpb25zLWRvd25sb2FkLWRpcic6XG5cdFx0Y2FzZSAnYnVpbHRpbi1leHRlbnNpb25zLWRpcic6XG5cdFx0Y2FzZSAndGVsZW1ldHJ5Jzpcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRkZWZhdWx0OlxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdH1cbn07XG5cbmNvbnN0IGlzU3VwcG9ydGVkRm9yUGlwZSA9IChvcHRpb25JZDoga2V5b2YgUmVtb3RlUGFyc2VkQXJncykgPT4ge1xuXHRzd2l0Y2ggKG9wdGlvbklkKSB7XG5cdFx0Y2FzZSAndmVyc2lvbic6XG5cdFx0Y2FzZSAnaGVscCc6XG5cdFx0Y2FzZSAnZm9sZGVyLXVyaSc6XG5cdFx0Y2FzZSAnZmlsZS11cmknOlxuXHRcdGNhc2UgJ2FkZCc6XG5cdFx0Y2FzZSAnZGlmZic6XG5cdFx0Y2FzZSAnbWVyZ2UnOlxuXHRcdGNhc2UgJ3dhaXQnOlxuXHRcdGNhc2UgJ2dvdG8nOlxuXHRcdGNhc2UgJ3JldXNlLXdpbmRvdyc6XG5cdFx0Y2FzZSAnbmV3LXdpbmRvdyc6XG5cdFx0Y2FzZSAnc3RhdHVzJzpcblx0XHRjYXNlICdpbnN0YWxsLWV4dGVuc2lvbic6XG5cdFx0Y2FzZSAndW5pbnN0YWxsLWV4dGVuc2lvbic6XG5cdFx0Y2FzZSAndXBkYXRlLWV4dGVuc2lvbnMnOlxuXHRcdGNhc2UgJ2xpc3QtZXh0ZW5zaW9ucyc6XG5cdFx0Y2FzZSAnZm9yY2UnOlxuXHRcdGNhc2UgJ2RvLW5vdC1pbmNsdWRlLXBhY2stZGVwZW5kZW5jaWVzJzpcblx0XHRjYXNlICdzaG93LXZlcnNpb25zJzpcblx0XHRjYXNlICdjYXRlZ29yeSc6XG5cdFx0Y2FzZSAndmVyYm9zZSc6XG5cdFx0Y2FzZSAncmVtb3RlJzpcblx0XHRjYXNlICdsb2NhdGUtc2hlbGwtaW50ZWdyYXRpb24tcGF0aCc6XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRkZWZhdWx0OlxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xuXG5jb25zdCBjbGlQaXBlID0gcHJvY2Vzcy5lbnZbJ1ZTQ09ERV9JUENfSE9PS19DTEknXSBhcyBzdHJpbmc7XG5jb25zdCBjbGlDb21tYW5kID0gcHJvY2Vzcy5lbnZbJ1ZTQ09ERV9DTElFTlRfQ09NTUFORCddIGFzIHN0cmluZztcbmNvbnN0IGNsaUNvbW1hbmRDd2QgPSBwcm9jZXNzLmVudlsnVlNDT0RFX0NMSUVOVF9DT01NQU5EX0NXRCddIGFzIHN0cmluZztcbmNvbnN0IGNsaVJlbW90ZUF1dGhvcml0eSA9IHByb2Nlc3MuZW52WydWU0NPREVfQ0xJX0FVVEhPUklUWSddIGFzIHN0cmluZztcbmNvbnN0IGNsaVN0ZEluRmlsZVBhdGggPSBwcm9jZXNzLmVudlsnVlNDT0RFX1NURElOX0ZJTEVfUEFUSCddIGFzIHN0cmluZztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oZGVzYzogUHJvZHVjdERlc2NyaXB0aW9uLCBhcmdzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRpZiAoIWNsaVBpcGUgJiYgIWNsaUNvbW1hbmQpIHtcblx0XHRjb25zb2xlLmxvZygnQ29tbWFuZCBpcyBvbmx5IGF2YWlsYWJsZSBpbiBXU0wgb3IgaW5zaWRlIGEgVmlzdWFsIFN0dWRpbyBDb2RlIHRlcm1pbmFsLicpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdC8vIHRha2UgdGhlIGxvY2FsIG9wdGlvbnMgYW5kIHJlbW92ZSB0aGUgb25lcyB0aGF0IGRvbid0IGFwcGx5XG5cdGNvbnN0IG9wdGlvbnM6IE9wdGlvbkRlc2NyaXB0aW9uczxSZXF1aXJlZDxSZW1vdGVQYXJzZWRBcmdzPj4gPSB7IC4uLk9QVElPTlMsIGdpdENyZWRlbnRpYWw6IHsgdHlwZTogJ3N0cmluZycgfSwgb3BlbkV4dGVybmFsOiB7IHR5cGU6ICdib29sZWFuJyB9IH07XG5cdGNvbnN0IGlzU3VwcG9ydGVkID0gY2xpQ29tbWFuZCA/IGlzU3VwcG9ydGVkRm9yQ21kIDogaXNTdXBwb3J0ZWRGb3JQaXBlO1xuXHRmb3IgKGNvbnN0IG9wdGlvbklkIGluIE9QVElPTlMpIHtcblx0XHRjb25zdCBvcHRJZCA9IDxrZXlvZiBSZW1vdGVQYXJzZWRBcmdzPm9wdGlvbklkO1xuXHRcdGlmICghaXNTdXBwb3J0ZWQob3B0SWQpKSB7XG5cdFx0XHRkZWxldGUgb3B0aW9uc1tvcHRJZF07XG5cdFx0fVxuXHR9XG5cblx0aWYgKGNsaVBpcGUpIHtcblx0XHRvcHRpb25zWydvcGVuRXh0ZXJuYWwnXSA9IHsgdHlwZTogJ2Jvb2xlYW4nIH07XG5cdH1cblxuXHRjb25zdCBlcnJvclJlcG9ydGVyOiBFcnJvclJlcG9ydGVyID0ge1xuXHRcdG9uTXVsdGlwbGVWYWx1ZXM6IChpZDogc3RyaW5nLCB1c2VkVmFsdWU6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgT3B0aW9uICcke2lkfScgY2FuIG9ubHkgYmUgZGVmaW5lZCBvbmNlLiBVc2luZyB2YWx1ZSAke3VzZWRWYWx1ZX0uYCk7XG5cdFx0fSxcblx0XHRvbkVtcHR5VmFsdWU6IChpZCkgPT4ge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgSWdub3Jpbmcgb3B0aW9uICcke2lkfSc6IFZhbHVlIG11c3Qgbm90IGJlIGVtcHR5LmApO1xuXHRcdH0sXG5cdFx0b25Vbmtub3duT3B0aW9uOiAoaWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgSWdub3Jpbmcgb3B0aW9uICcke2lkfSc6IG5vdCBzdXBwb3J0ZWQgZm9yICR7ZGVzYy5leGVjdXRhYmxlTmFtZX0uYCk7XG5cdFx0fSxcblx0XHRvbkRlcHJlY2F0ZWRPcHRpb246IChkZXByZWNhdGVkT3B0aW9uOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc29sZS53YXJuKGBPcHRpb24gJyR7ZGVwcmVjYXRlZE9wdGlvbn0nIGlzIGRlcHJlY2F0ZWQ6ICR7bWVzc2FnZX1gKTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgcGFyc2VkQXJncyA9IHBhcnNlQXJncyhhcmdzLCBvcHRpb25zLCBlcnJvclJlcG9ydGVyKTtcblx0Y29uc3QgbWFwRmlsZVVyaSA9IGNsaVJlbW90ZUF1dGhvcml0eSA/IG1hcEZpbGVUb1JlbW90ZVVyaSA6ICh1cmk6IHN0cmluZykgPT4gdXJpO1xuXG5cdGNvbnN0IHZlcmJvc2UgPSAhIXBhcnNlZEFyZ3NbJ3ZlcmJvc2UnXTtcblxuXHRpZiAocGFyc2VkQXJncy5oZWxwKSB7XG5cdFx0Y29uc29sZS5sb2coYnVpbGRIZWxwTWVzc2FnZShkZXNjLnByb2R1Y3ROYW1lLCBkZXNjLmV4ZWN1dGFibGVOYW1lLCBkZXNjLnZlcnNpb24sIG9wdGlvbnMpKTtcblx0XHRyZXR1cm47XG5cdH1cblx0aWYgKHBhcnNlZEFyZ3MudmVyc2lvbikge1xuXHRcdGNvbnNvbGUubG9nKGJ1aWxkVmVyc2lvbk1lc3NhZ2UoZGVzYy52ZXJzaW9uLCBkZXNjLmNvbW1pdCkpO1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAocGFyc2VkQXJnc1snbG9jYXRlLXNoZWxsLWludGVncmF0aW9uLXBhdGgnXSkge1xuXHRcdGxldCBmaWxlOiBzdHJpbmc7XG5cdFx0c3dpdGNoIChwYXJzZWRBcmdzWydsb2NhdGUtc2hlbGwtaW50ZWdyYXRpb24tcGF0aCddKSB7XG5cdFx0XHQvLyBVc2FnZTogYFtbIFwiJFRFUk1fUFJPR1JBTVwiID09IFwidnNjb2RlXCIgXV0gJiYgLiBcIiQoY29kZSAtLWxvY2F0ZS1zaGVsbC1pbnRlZ3JhdGlvbi1wYXRoIGJhc2gpXCJgXG5cdFx0XHRjYXNlICdiYXNoJzogZmlsZSA9ICdzaGVsbEludGVncmF0aW9uLWJhc2guc2gnOyBicmVhaztcblx0XHRcdC8vIFVzYWdlOiBgaWYgKCRlbnY6VEVSTV9QUk9HUkFNIC1lcSBcInZzY29kZVwiKSB7IC4gXCIkKGNvZGUgLS1sb2NhdGUtc2hlbGwtaW50ZWdyYXRpb24tcGF0aCBwd3NoKVwiIH1gXG5cdFx0XHRjYXNlICdwd3NoJzogZmlsZSA9ICdzaGVsbEludGVncmF0aW9uLnBzMSc7IGJyZWFrO1xuXHRcdFx0Ly8gVXNhZ2U6IGBbWyBcIiRURVJNX1BST0dSQU1cIiA9PSBcInZzY29kZVwiIF1dICYmIC4gXCIkKGNvZGUgLS1sb2NhdGUtc2hlbGwtaW50ZWdyYXRpb24tcGF0aCB6c2gpXCJgXG5cdFx0XHRjYXNlICd6c2gnOiBmaWxlID0gJ3NoZWxsSW50ZWdyYXRpb24tcmMuenNoJzsgYnJlYWs7XG5cdFx0XHQvLyBVc2FnZTogYHN0cmluZyBtYXRjaCAtcSBcIiRURVJNX1BST0dSQU1cIiBcInZzY29kZVwiOyBhbmQgLiAoY29kZSAtLWxvY2F0ZS1zaGVsbC1pbnRlZ3JhdGlvbi1wYXRoIGZpc2gpYFxuXHRcdFx0Y2FzZSAnZmlzaCc6IGZpbGUgPSAnc2hlbGxJbnRlZ3JhdGlvbi5maXNoJzsgYnJlYWs7XG5cdFx0XHRkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIHVzaW5nIC0tbG9jYXRlLXNoZWxsLWludGVncmF0aW9uLXBhdGg6IEludmFsaWQgc2hlbGwgdHlwZScpO1xuXHRcdH1cblx0XHRjb25zb2xlLmxvZyhqb2luKGdldEFwcFJvb3QoKSwgJ291dCcsICd2cycsICd3b3JrYmVuY2gnLCAnY29udHJpYicsICd0ZXJtaW5hbCcsICdjb21tb24nLCAnc2NyaXB0cycsIGZpbGUpKTtcblx0XHRyZXR1cm47XG5cdH1cblx0aWYgKGNsaVBpcGUpIHtcblx0XHRpZiAocGFyc2VkQXJnc1snb3BlbkV4dGVybmFsJ10pIHtcblx0XHRcdGF3YWl0IG9wZW5JbkJyb3dzZXIocGFyc2VkQXJnc1snXyddLCB2ZXJib3NlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRsZXQgcmVtb3RlOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkID0gcGFyc2VkQXJncy5yZW1vdGU7XG5cdGlmIChyZW1vdGUgPT09ICdsb2NhbCcgfHwgcmVtb3RlID09PSAnZmFsc2UnIHx8IHJlbW90ZSA9PT0gJycpIHtcblx0XHRyZW1vdGUgPSBudWxsOyAvLyBudWxsIHJlcHJlc2VudCBhIGxvY2FsIHdpbmRvd1xuXHR9XG5cblx0Y29uc3QgZm9sZGVyVVJJcyA9IChwYXJzZWRBcmdzWydmb2xkZXItdXJpJ10gfHwgW10pLm1hcChtYXBGaWxlVXJpKTtcblx0cGFyc2VkQXJnc1snZm9sZGVyLXVyaSddID0gZm9sZGVyVVJJcztcblxuXHRjb25zdCBmaWxlVVJJcyA9IChwYXJzZWRBcmdzWydmaWxlLXVyaSddIHx8IFtdKS5tYXAobWFwRmlsZVVyaSk7XG5cdHBhcnNlZEFyZ3NbJ2ZpbGUtdXJpJ10gPSBmaWxlVVJJcztcblxuXHRjb25zdCBpbnB1dFBhdGhzID0gcGFyc2VkQXJnc1snXyddO1xuXHRsZXQgaGFzUmVhZFN0ZGluQXJnID0gZmFsc2U7XG5cdGZvciAoY29uc3QgaW5wdXQgb2YgaW5wdXRQYXRocykge1xuXHRcdGlmIChpbnB1dCA9PT0gJy0nKSB7XG5cdFx0XHRoYXNSZWFkU3RkaW5BcmcgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0cmFuc2xhdGVQYXRoKGlucHV0LCBtYXBGaWxlVXJpLCBmb2xkZXJVUklzLCBmaWxlVVJJcyk7XG5cdFx0fVxuXHR9XG5cblx0cGFyc2VkQXJnc1snXyddID0gW107XG5cblx0bGV0IHJlYWRGcm9tU3RkaW5Qcm9taXNlOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXHRsZXQgc3RkaW5GaWxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdGlmIChoYXNSZWFkU3RkaW5BcmcgJiYgaGFzU3RkaW5XaXRob3V0VHR5KCkpIHtcblx0XHR0cnkge1xuXHRcdFx0c3RkaW5GaWxlUGF0aCA9IGNsaVN0ZEluRmlsZVBhdGg7XG5cdFx0XHRpZiAoIXN0ZGluRmlsZVBhdGgpIHtcblx0XHRcdFx0c3RkaW5GaWxlUGF0aCA9IGdldFN0ZGluRmlsZVBhdGgoKTtcblx0XHRcdFx0Y29uc3QgcmVhZEZyb21TdGRpbkRvbmUgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRcdGF3YWl0IHJlYWRGcm9tU3RkaW4oc3RkaW5GaWxlUGF0aCwgdmVyYm9zZSwgKCkgPT4gcmVhZEZyb21TdGRpbkRvbmUuY29tcGxldGUoKSk7IC8vIHRocm93cyBlcnJvciBpZiBmaWxlIGNhbiBub3QgYmUgd3JpdHRlblxuXHRcdFx0XHRpZiAoIXBhcnNlZEFyZ3Mud2FpdCkge1xuXHRcdFx0XHRcdC8vIGlmIGAtLXdhaXRgIGlzIG5vdCBwcm92aWRlZCwgd2Uga2VlcCB0aGlzIHByb2Nlc3MgYWxpdmVcblx0XHRcdFx0XHQvLyBmb3IgYXQgbGVhc3QgYXMgbG9uZyBhcyB0aGUgc3RkaW4gc3RyZWFtIGlzIG9wZW4gdG9cblx0XHRcdFx0XHQvLyBlbnN1cmUgdGhhdCB3ZSByZWFkIGFsbCB0aGUgZGF0YS5cblx0XHRcdFx0XHRyZWFkRnJvbVN0ZGluUHJvbWlzZSA9IHJlYWRGcm9tU3RkaW5Eb25lLnA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gTWFrZSBzdXJlIHRvIG9wZW4gdG1wIGZpbGVcblx0XHRcdHRyYW5zbGF0ZVBhdGgoc3RkaW5GaWxlUGF0aCwgbWFwRmlsZVVyaSwgZm9sZGVyVVJJcywgZmlsZVVSSXMpO1xuXG5cdFx0XHQvLyBJZ25vcmUgYWRkaW5nIHRoaXMgdG8gaGlzdG9yeVxuXHRcdFx0cGFyc2VkQXJnc1snc2tpcC1hZGQtdG8tcmVjZW50bHktb3BlbmVkJ10gPSB0cnVlO1xuXG5cdFx0XHRjb25zb2xlLmxvZyhgUmVhZGluZyBmcm9tIHN0ZGluIHZpYTogJHtzdGRpbkZpbGVQYXRofWApO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKGBGYWlsZWQgdG8gY3JlYXRlIGZpbGUgdG8gcmVhZCB2aWEgc3RkaW46ICR7ZS50b1N0cmluZygpfWApO1xuXHRcdH1cblx0fVxuXG5cdGlmIChwYXJzZWRBcmdzLmV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCkge1xuXHRcdHBhcnNlZEFyZ3MuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoID0gcGFyc2VkQXJncy5leHRlbnNpb25EZXZlbG9wbWVudFBhdGgubWFwKHAgPT4gbWFwRmlsZVVyaShwYXRoVG9VUkkocCkuaHJlZikpO1xuXHR9XG5cblx0aWYgKHBhcnNlZEFyZ3MuZXh0ZW5zaW9uVGVzdHNQYXRoKSB7XG5cdFx0cGFyc2VkQXJncy5leHRlbnNpb25UZXN0c1BhdGggPSBtYXBGaWxlVXJpKHBhdGhUb1VSSShwYXJzZWRBcmdzWydleHRlbnNpb25UZXN0c1BhdGgnXSkuaHJlZik7XG5cdH1cblxuXHRjb25zdCBjcmFzaFJlcG9ydGVyRGlyZWN0b3J5ID0gcGFyc2VkQXJnc1snY3Jhc2gtcmVwb3J0ZXItZGlyZWN0b3J5J107XG5cdGlmIChjcmFzaFJlcG9ydGVyRGlyZWN0b3J5ICE9PSB1bmRlZmluZWQgJiYgIWNyYXNoUmVwb3J0ZXJEaXJlY3RvcnkubWF0Y2goL14oW2EtekEtWl06W1xcXFxcXC9dKS8pKSB7XG5cdFx0Y29uc29sZS5sb2coYFRoZSBjcmFzaCByZXBvcnRlciBkaXJlY3RvcnkgJyR7Y3Jhc2hSZXBvcnRlckRpcmVjdG9yeX0nIG11c3QgYmUgYW4gYWJzb2x1dGUgV2luZG93cyBwYXRoIChlLmcuIGM6L2NyYXNoZXMpYCk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKGNsaUNvbW1hbmQpIHtcblx0XHRpZiAocGFyc2VkQXJnc1snaW5zdGFsbC1leHRlbnNpb24nXSAhPT0gdW5kZWZpbmVkIHx8IHBhcnNlZEFyZ3NbJ3VuaW5zdGFsbC1leHRlbnNpb24nXSAhPT0gdW5kZWZpbmVkIHx8IHBhcnNlZEFyZ3NbJ2xpc3QtZXh0ZW5zaW9ucyddIHx8IHBhcnNlZEFyZ3NbJ3VwZGF0ZS1leHRlbnNpb25zJ10pIHtcblx0XHRcdGNvbnN0IGNtZExpbmU6IHN0cmluZ1tdID0gW107XG5cdFx0XHRwYXJzZWRBcmdzWydpbnN0YWxsLWV4dGVuc2lvbiddPy5mb3JFYWNoKGlkID0+IGNtZExpbmUucHVzaCgnLS1pbnN0YWxsLWV4dGVuc2lvbicsIGlkKSk7XG5cdFx0XHRwYXJzZWRBcmdzWyd1bmluc3RhbGwtZXh0ZW5zaW9uJ10/LmZvckVhY2goaWQgPT4gY21kTGluZS5wdXNoKCctLXVuaW5zdGFsbC1leHRlbnNpb24nLCBpZCkpO1xuXHRcdFx0WydsaXN0LWV4dGVuc2lvbnMnLCAnZm9yY2UnLCAnc2hvdy12ZXJzaW9ucycsICdjYXRlZ29yeSddLmZvckVhY2gob3B0ID0+IHtcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBwYXJzZWRBcmdzWzxrZXlvZiBOYXRpdmVQYXJzZWRBcmdzPm9wdF07XG5cdFx0XHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y21kTGluZS5wdXNoKGAtLSR7b3B0fT0ke3ZhbHVlfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGlmIChwYXJzZWRBcmdzWyd1cGRhdGUtZXh0ZW5zaW9ucyddKSB7XG5cdFx0XHRcdGNtZExpbmUucHVzaCgnLS11cGRhdGUtZXh0ZW5zaW9ucycpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjaGlsZFByb2Nlc3MgPSBjcC5mb3JrKEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCdzZXJ2ZXItbWFpbicpLmZzUGF0aCwgY21kTGluZSwgeyBzdGRpbzogJ2luaGVyaXQnIH0pO1xuXHRcdFx0Y2hpbGRQcm9jZXNzLm9uKCdlcnJvcicsIGVyciA9PiBjb25zb2xlLmxvZyhlcnIpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdDb21tYW5kbGluZTogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGtleSBpbiBwYXJzZWRBcmdzKSB7XG5cdFx0XHRjb25zdCB2YWwgPSBwYXJzZWRBcmdzW2tleSBhcyBrZXlvZiB0eXBlb2YgcGFyc2VkQXJnc107XG5cdFx0XHRpZiAodHlwZW9mIHZhbCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRcdGlmICh2YWwpIHtcblx0XHRcdFx0XHRuZXdDb21tYW5kbGluZS5wdXNoKCctLScgKyBrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsKSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHZhbCkge1xuXHRcdFx0XHRcdG5ld0NvbW1hbmRsaW5lLnB1c2goYC0tJHtrZXl9PSR7ZW50cnkudG9TdHJpbmcoKX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICh2YWwpIHtcblx0XHRcdFx0bmV3Q29tbWFuZGxpbmUucHVzaChgLS0ke2tleX09JHt2YWwudG9TdHJpbmcoKX1gKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHJlbW90ZSAhPT0gbnVsbCkge1xuXHRcdFx0bmV3Q29tbWFuZGxpbmUucHVzaChgLS1yZW1vdGU9JHtyZW1vdGUgfHwgY2xpUmVtb3RlQXV0aG9yaXR5fWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dCA9IGV4dG5hbWUoY2xpQ29tbWFuZCk7XG5cdFx0aWYgKGV4dCA9PT0gJy5iYXQnIHx8IGV4dCA9PT0gJy5jbWQnKSB7XG5cdFx0XHRjb25zdCBwcm9jZXNzQ3dkID0gY2xpQ29tbWFuZEN3ZCB8fCBjd2QoKTtcblx0XHRcdGlmICh2ZXJib3NlKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBJbnZva2luZzogY21kLmV4ZSAvQyAke2NsaUNvbW1hbmR9ICR7bmV3Q29tbWFuZGxpbmUuam9pbignICcpfSBpbiAke3Byb2Nlc3NDd2R9YCk7XG5cdFx0XHR9XG5cdFx0XHRjcC5zcGF3bignY21kLmV4ZScsIFsnL0MnLCBjbGlDb21tYW5kLCAuLi5uZXdDb21tYW5kbGluZV0sIHtcblx0XHRcdFx0c3RkaW86ICdpbmhlcml0Jyxcblx0XHRcdFx0Y3dkOiBwcm9jZXNzQ3dkXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgY2xpQ3dkID0gZGlybmFtZShjbGlDb21tYW5kKTtcblx0XHRcdGNvbnN0IGVudiA9IHsgLi4ucHJvY2Vzcy5lbnYsIEVMRUNUUk9OX1JVTl9BU19OT0RFOiAnMScgfTtcblx0XHRcdG5ld0NvbW1hbmRsaW5lLnVuc2hpZnQoJ3Jlc291cmNlcy9hcHAvb3V0L2NsaS5qcycpO1xuXHRcdFx0aWYgKHZlcmJvc2UpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEludm9raW5nOiBjZCBcIiR7Y2xpQ3dkfVwiICYmIEVMRUNUUk9OX1JVTl9BU19OT0RFPTEgXCIke2NsaUNvbW1hbmR9XCIgXCIke25ld0NvbW1hbmRsaW5lLmpvaW4oJ1wiIFwiJyl9XCJgKTtcblx0XHRcdH1cblx0XHRcdGlmIChydW5uaW5nSW5XU0wyKCkpIHtcblx0XHRcdFx0aWYgKHZlcmJvc2UpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgVXNpbmcgcGlwZXMgZm9yIG91dHB1dC5gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjaGlsZFByb2Nlc3MgPSBjcC5zcGF3bihjbGlDb21tYW5kLCBuZXdDb21tYW5kbGluZSwgeyBjd2Q6IGNsaUN3ZCwgZW52LCBzdGRpbzogWydpbmhlcml0JywgJ3BpcGUnLCAncGlwZSddIH0pO1xuXHRcdFx0XHRjaGlsZFByb2Nlc3Muc3Rkb3V0Lm9uKCdkYXRhJywgZGF0YSA9PiBwcm9jZXNzLnN0ZG91dC53cml0ZShkYXRhKSk7XG5cdFx0XHRcdGNoaWxkUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHByb2Nlc3Muc3RkZXJyLndyaXRlKGRhdGEpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNwLnNwYXduKGNsaUNvbW1hbmQsIG5ld0NvbW1hbmRsaW5lLCB7IGN3ZDogY2xpQ3dkLCBlbnYsIHN0ZGlvOiAnaW5oZXJpdCcgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGlmIChwYXJzZWRBcmdzLnN0YXR1cykge1xuXHRcdFx0YXdhaXQgc2VuZFRvUGlwZSh7XG5cdFx0XHRcdHR5cGU6ICdzdGF0dXMnXG5cdFx0XHR9LCB2ZXJib3NlKS50aGVuKChyZXM6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhyZXMpO1xuXHRcdFx0fSkuY2F0Y2goZSA9PiB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdoZW4gcmVxdWVzdGluZyBzdGF0dXM6JywgZSk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAocGFyc2VkQXJnc1snaW5zdGFsbC1leHRlbnNpb24nXSAhPT0gdW5kZWZpbmVkIHx8IHBhcnNlZEFyZ3NbJ3VuaW5zdGFsbC1leHRlbnNpb24nXSAhPT0gdW5kZWZpbmVkIHx8IHBhcnNlZEFyZ3NbJ2xpc3QtZXh0ZW5zaW9ucyddIHx8IHBhcnNlZEFyZ3NbJ3VwZGF0ZS1leHRlbnNpb25zJ10pIHtcblx0XHRcdGF3YWl0IHNlbmRUb1BpcGUoe1xuXHRcdFx0XHR0eXBlOiAnZXh0ZW5zaW9uTWFuYWdlbWVudCcsXG5cdFx0XHRcdGxpc3Q6IHBhcnNlZEFyZ3NbJ2xpc3QtZXh0ZW5zaW9ucyddID8geyBzaG93VmVyc2lvbnM6IHBhcnNlZEFyZ3NbJ3Nob3ctdmVyc2lvbnMnXSwgY2F0ZWdvcnk6IHBhcnNlZEFyZ3NbJ2NhdGVnb3J5J10gfSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0aW5zdGFsbDogYXNFeHRlbnNpb25JZE9yVlNJWChwYXJzZWRBcmdzWydpbnN0YWxsLWV4dGVuc2lvbiddKSxcblx0XHRcdFx0dW5pbnN0YWxsOiBhc0V4dGVuc2lvbklkT3JWU0lYKHBhcnNlZEFyZ3NbJ3VuaW5zdGFsbC1leHRlbnNpb24nXSksXG5cdFx0XHRcdGZvcmNlOiBwYXJzZWRBcmdzWydmb3JjZSddXG5cdFx0XHR9LCB2ZXJib3NlKS50aGVuKChyZXM6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhyZXMpO1xuXHRcdFx0fSkuY2F0Y2goZSA9PiB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdoZW4gaW52b2tpbmcgdGhlIGV4dGVuc2lvbiBtYW5hZ2VtZW50IGNvbW1hbmQ6JywgZSk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgd2FpdE1hcmtlckZpbGVQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHBhcnNlZEFyZ3NbJ3dhaXQnXSkge1xuXHRcdFx0aWYgKCFmaWxlVVJJcy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0F0IGxlYXN0IG9uZSBmaWxlIG11c3QgYmUgcHJvdmlkZWQgdG8gd2FpdCBmb3IuJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHdhaXRNYXJrZXJGaWxlUGF0aCA9IGNyZWF0ZVdhaXRNYXJrZXJGaWxlU3luYyh2ZXJib3NlKTtcblx0XHR9XG5cblx0XHRhd2FpdCBzZW5kVG9QaXBlKHtcblx0XHRcdHR5cGU6ICdvcGVuJyxcblx0XHRcdGZpbGVVUklzLFxuXHRcdFx0Zm9sZGVyVVJJcyxcblx0XHRcdGRpZmZNb2RlOiBwYXJzZWRBcmdzLmRpZmYsXG5cdFx0XHRtZXJnZU1vZGU6IHBhcnNlZEFyZ3MubWVyZ2UsXG5cdFx0XHRhZGRNb2RlOiBwYXJzZWRBcmdzLmFkZCxcblx0XHRcdHJlbW92ZU1vZGU6IHBhcnNlZEFyZ3MucmVtb3ZlLFxuXHRcdFx0Z290b0xpbmVNb2RlOiBwYXJzZWRBcmdzLmdvdG8sXG5cdFx0XHRmb3JjZVJldXNlV2luZG93OiBwYXJzZWRBcmdzWydyZXVzZS13aW5kb3cnXSxcblx0XHRcdGZvcmNlTmV3V2luZG93OiBwYXJzZWRBcmdzWyduZXctd2luZG93J10sXG5cdFx0XHR3YWl0TWFya2VyRmlsZVBhdGgsXG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IHJlbW90ZVxuXHRcdH0sIHZlcmJvc2UpLmNhdGNoKGUgPT4ge1xuXHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3Igd2hlbiBpbnZva2luZyB0aGUgb3BlbiBjb21tYW5kOicsIGUpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHdhaXRNYXJrZXJGaWxlUGF0aCkge1xuXHRcdFx0YXdhaXQgd2FpdEZvckZpbGVEZWxldGVkKHdhaXRNYXJrZXJGaWxlUGF0aCk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlYWRGcm9tU3RkaW5Qcm9taXNlKSB7XG5cdFx0XHRhd2FpdCByZWFkRnJvbVN0ZGluUHJvbWlzZTtcblxuXHRcdH1cblxuXHRcdGlmICh3YWl0TWFya2VyRmlsZVBhdGggJiYgc3RkaW5GaWxlUGF0aCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0ZnMudW5saW5rU3luYyhzdGRpbkZpbGVQYXRoKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly9pZ25vcmVcblx0XHRcdH1cblx0XHR9XG5cdH1cblxufVxuXG5mdW5jdGlvbiBydW5uaW5nSW5XU0wyKCk6IGJvb2xlYW4ge1xuXHRpZiAoISFwcm9jZXNzLmVudlsnV1NMX0RJU1RST19OQU1FJ10pIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGNwLmV4ZWNTeW5jKCd1bmFtZSAtcicsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS5pbmNsdWRlcygnLW1pY3Jvc29mdC0nKTtcblx0XHR9IGNhdGNoIChfZSkge1xuXHRcdFx0Ly8gSWdub3JlXG5cdFx0fVxuXHR9XG5cdHJldHVybiBmYWxzZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gd2FpdEZvckZpbGVEZWxldGVkKHBhdGg6IHN0cmluZykge1xuXHR3aGlsZSAoZnMuZXhpc3RzU3luYyhwYXRoKSkge1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlcyA9PiBzZXRUaW1lb3V0KHJlcywgMTAwMCkpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW5JbkJyb3dzZXIoYXJnczogc3RyaW5nW10sIHZlcmJvc2U6IGJvb2xlYW4pIHtcblx0Y29uc3QgdXJpczogc3RyaW5nW10gPSBbXTtcblx0Zm9yIChjb25zdCBsb2NhdGlvbiBvZiBhcmdzKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICgvXlthLXotXSs6XFwvXFwvLisvLnRlc3QobG9jYXRpb24pKSB7XG5cdFx0XHRcdHVyaXMucHVzaCh1cmwucGFyc2UobG9jYXRpb24pLmhyZWYpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dXJpcy5wdXNoKHBhdGhUb1VSSShsb2NhdGlvbikuaHJlZik7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5sb2coYEludmFsaWQgdXJsOiAke2xvY2F0aW9ufWApO1xuXHRcdH1cblx0fVxuXHRpZiAodXJpcy5sZW5ndGgpIHtcblx0XHRhd2FpdCBzZW5kVG9QaXBlKHtcblx0XHRcdHR5cGU6ICdvcGVuRXh0ZXJuYWwnLFxuXHRcdFx0dXJpc1xuXHRcdH0sIHZlcmJvc2UpLmNhdGNoKGUgPT4ge1xuXHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3Igd2hlbiBpbnZva2luZyB0aGUgb3BlbiBleHRlcm5hbCBjb21tYW5kOicsIGUpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHNlbmRUb1BpcGUoYXJnczogUGlwZUNvbW1hbmQsIHZlcmJvc2U6IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRpZiAodmVyYm9zZSkge1xuXHRcdGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGFyZ3MsIG51bGwsICcgICcpKTtcblx0fVxuXHRyZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IEpTT04uc3RyaW5naWZ5KGFyZ3MpO1xuXHRcdGlmICghY2xpUGlwZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ01lc3NhZ2UgJyArIG1lc3NhZ2UpO1xuXHRcdFx0cmVzb2x2ZSgnJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3B0czogaHR0cC5SZXF1ZXN0T3B0aW9ucyA9IHtcblx0XHRcdHNvY2tldFBhdGg6IGNsaVBpcGUsXG5cdFx0XHRwYXRoOiAnLycsXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0J2FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCByZXEgPSBodHRwLnJlcXVlc3Qob3B0cywgcmVzID0+IHtcblx0XHRcdGlmIChyZXMuaGVhZGVyc1snY29udGVudC10eXBlJ10gIT09ICdhcHBsaWNhdGlvbi9qc29uJykge1xuXHRcdFx0XHRyZWplY3QoJ0Vycm9yIGluIHJlc3BvbnNlOiBJbnZhbGlkIGNvbnRlbnQgdHlwZTogRXhwZWN0ZWQgXFwnYXBwbGljYXRpb24vanNvblxcJywgaXM6ICcgKyByZXMuaGVhZGVyc1snY29udGVudC10eXBlJ10pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNodW5rczogc3RyaW5nW10gPSBbXTtcblx0XHRcdHJlcy5zZXRFbmNvZGluZygndXRmOCcpO1xuXHRcdFx0cmVzLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuXHRcdFx0XHRjaHVua3MucHVzaChjaHVuayk7XG5cdFx0XHR9KTtcblx0XHRcdHJlcy5vbignZXJyb3InLCAoZXJyKSA9PiBmYXRhbCgnRXJyb3IgaW4gcmVzcG9uc2UuJywgZXJyKSk7XG5cdFx0XHRyZXMub24oJ2VuZCcsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgY29udGVudCA9IGNodW5rcy5qb2luKCcnKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBvYmogPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuXHRcdFx0XHRcdGlmIChyZXMuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKG9iaik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlamVjdChvYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHJlamVjdCgnRXJyb3IgaW4gcmVzcG9uc2U6IFVuYWJsZSB0byBwYXJzZSByZXNwb25zZSBhcyBKU09OOiAnICsgY29udGVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0cmVxLm9uKCdlcnJvcicsIChlcnIpID0+IGZhdGFsKCdFcnJvciBpbiByZXF1ZXN0LicsIGVycikpO1xuXHRcdHJlcS53cml0ZShtZXNzYWdlKTtcblx0XHRyZXEuZW5kKCk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBhc0V4dGVuc2lvbklkT3JWU0lYKGlucHV0czogc3RyaW5nW10gfCB1bmRlZmluZWQpIHtcblx0cmV0dXJuIGlucHV0cz8ubWFwKGlucHV0ID0+IC9cXC52c2l4JC9pLnRlc3QoaW5wdXQpID8gcGF0aFRvVVJJKGlucHV0KS5ocmVmIDogaW5wdXQpO1xufVxuXG5mdW5jdGlvbiBmYXRhbChtZXNzYWdlOiBzdHJpbmcsIGVycjogYW55KTogdm9pZCB7XG5cdGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBjb25uZWN0IHRvIFZTIENvZGUgc2VydmVyOiAnICsgbWVzc2FnZSk7XG5cdGNvbnNvbGUuZXJyb3IoZXJyKTtcblx0cHJvY2Vzcy5leGl0KDEpO1xufVxuXG5jb25zdCBwcmVmZXJyZWRDd2QgPSBwcm9jZXNzLmVudi5QV0QgfHwgY3dkKCk7IC8vIHByZWZlciBwcm9jZXNzLmVudi5QV0QgYXMgaXQgZG9lcyBub3QgZm9sbG93IHN5bWxpbmtzXG5cbmZ1bmN0aW9uIHBhdGhUb1VSSShpbnB1dDogc3RyaW5nKTogdXJsLlVSTCB7XG5cdGlucHV0ID0gaW5wdXQudHJpbSgpO1xuXHRpbnB1dCA9IHJlc29sdmUocHJlZmVycmVkQ3dkLCBpbnB1dCk7XG5cblx0cmV0dXJuIHVybC5wYXRoVG9GaWxlVVJMKGlucHV0KTtcbn1cblxuZnVuY3Rpb24gdHJhbnNsYXRlUGF0aChpbnB1dDogc3RyaW5nLCBtYXBGaWxlVXJpOiAoaW5wdXQ6IHN0cmluZykgPT4gc3RyaW5nLCBmb2xkZXJVUklTOiBzdHJpbmdbXSwgZmlsZVVSSVM6IHN0cmluZ1tdKSB7XG5cdGNvbnN0IHVybCA9IHBhdGhUb1VSSShpbnB1dCk7XG5cdGNvbnN0IG1hcHBlZFVyaSA9IG1hcEZpbGVVcmkodXJsLmhyZWYpO1xuXHR0cnkge1xuXHRcdGNvbnN0IHN0YXQgPSBmcy5sc3RhdFN5bmMoZnMucmVhbHBhdGhTeW5jKGlucHV0KSk7XG5cblx0XHRpZiAoc3RhdC5pc0ZpbGUoKSkge1xuXHRcdFx0ZmlsZVVSSVMucHVzaChtYXBwZWRVcmkpO1xuXHRcdH0gZWxzZSBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG5cdFx0XHRmb2xkZXJVUklTLnB1c2gobWFwcGVkVXJpKTtcblx0XHR9IGVsc2UgaWYgKGlucHV0ID09PSAnL2Rldi9udWxsJykge1xuXHRcdFx0Ly8gaGFuZGxlIC9kZXYvbnVsbCBwYXNzZWQgdG8gdXMgYnkgZXh0ZXJuYWwgdG9vbHMgc3VjaCBhcyBgZ2l0IGRpZmZ0b29sYFxuXHRcdFx0ZmlsZVVSSVMucHVzaChtYXBwZWRVcmkpO1xuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdGlmIChlLmNvZGUgPT09ICdFTk9FTlQnKSB7XG5cdFx0XHRmaWxlVVJJUy5wdXNoKG1hcHBlZFVyaSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUubG9nKGBQcm9ibGVtIGFjY2Vzc2luZyBmaWxlICR7aW5wdXR9LiBJZ25vcmluZyBmaWxlYCwgZSk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIG1hcEZpbGVUb1JlbW90ZVVyaSh1cmk6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB1cmkucmVwbGFjZSgvXmZpbGU6XFwvXFwvLywgJ3ZzY29kZS1yZW1vdGU6Ly8nICsgY2xpUmVtb3RlQXV0aG9yaXR5KTtcbn1cblxuZnVuY3Rpb24gZ2V0QXBwUm9vdCgpIHtcblx0cmV0dXJuIGRpcm5hbWUoRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJycpLmZzUGF0aCk7XG59XG5cbmNvbnN0IFssICwgcHJvZHVjdE5hbWUsIHZlcnNpb24sIGNvbW1pdCwgZXhlY3V0YWJsZU5hbWUsIC4uLnJlbWFpbmluZ0FyZ3NdID0gcHJvY2Vzcy5hcmd2O1xubWFpbih7IHByb2R1Y3ROYW1lLCB2ZXJzaW9uLCBjb21taXQsIGV4ZWN1dGFibGVOYW1lIH0sIHJlbWFpbmluZ0FyZ3MpLnRoZW4obnVsbCwgZXJyID0+IHtcblx0Y29uc29sZS5lcnJvcihlcnIubWVzc2FnZSB8fCBlcnIuc3RhY2sgfHwgZXJyKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxRQUFRO0FBQ3BCLFlBQVksU0FBUztBQUNyQixZQUFZLFFBQVE7QUFDcEIsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsV0FBVztBQUNwQixTQUFTLFNBQVMsU0FBUyxTQUFTLFlBQVk7QUFDaEQsU0FBUyxXQUFXLGtCQUFrQixxQkFBcUIsZUFBa0Q7QUFFN0csU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyxvQkFBb0Isa0JBQWtCLHFCQUFxQjtBQUNwRSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGtCQUFrQjtBQXFCM0IsTUFBTSxvQkFBb0IsQ0FBQyxhQUFxQztBQUMvRCxVQUFRLFVBQVU7QUFBQSxJQUNqQixLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxL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
