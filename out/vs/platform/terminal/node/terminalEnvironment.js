import * as os from "os";
import { FileAccess } from "../../../base/common/network.js";
import * as path from "../../../base/common/path.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import * as process from "../../../base/common/process.js";
import { format } from "../../../base/common/strings.js";
import { EnvironmentVariableMutatorType } from "../common/environmentVariable.js";
import { deserializeEnvironmentVariableCollections } from "../common/environmentVariableShared.js";
import { MergedEnvironmentVariableCollection } from "../common/environmentVariableCollection.js";
import { chmod, realpathSync, mkdirSync } from "fs";
import { promisify } from "util";
function getWindowsBuildNumber() {
  const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(os.release());
  let buildNumber = 0;
  if (osVersion && osVersion.length === 4) {
    buildNumber = parseInt(osVersion[3]);
  }
  return buildNumber;
}
async function getShellIntegrationInjection(shellLaunchConfig, options, env, logService, productService, skipStickyBit = false) {
  const useWinpty = isWindows && (!options.windowsEnableConpty || getWindowsBuildNumber() < 18309);
  if (
    // The global setting is disabled
    !options.shellIntegration.enabled || // There is no executable (so there's no way to determine how to inject)
    !shellLaunchConfig.executable || // It's a feature terminal (tasks, debug), unless it's explicitly being forced
    shellLaunchConfig.isFeatureTerminal && !shellLaunchConfig.forceShellIntegration || // The ignoreShellIntegration flag is passed (eg. relaunching without shell integration)
    shellLaunchConfig.ignoreShellIntegration || // Winpty is unsupported
    useWinpty
  ) {
    return void 0;
  }
  const originalArgs = shellLaunchConfig.args;
  const shell = process.platform === "win32" ? path.basename(shellLaunchConfig.executable).toLowerCase() : path.basename(shellLaunchConfig.executable);
  const appRoot = path.dirname(FileAccess.asFileUri("").fsPath);
  let newArgs;
  const envMixin = {
    "VSCODE_INJECTION": "1"
  };
  if (options.shellIntegration.nonce) {
    envMixin["VSCODE_NONCE"] = options.shellIntegration.nonce;
  }
  if (shellLaunchConfig.shellIntegrationEnvironmentReporting) {
    if (isWindows) {
      const enableWindowsEnvReporting = options.windowsUseConptyDll || options.windowsEnableConpty && getWindowsBuildNumber() >= 22631 && shell !== "bash.exe";
      if (enableWindowsEnvReporting) {
        envMixin["VSCODE_SHELL_ENV_REPORTING"] = "1";
      }
    } else {
      envMixin["VSCODE_SHELL_ENV_REPORTING"] = "1";
    }
  }
  if (isWindows) {
    if (shell === "pwsh.exe" || shell === "powershell.exe") {
      if (!originalArgs || arePwshImpliedArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("windows-pwsh" /* WindowsPwsh */);
      } else if (arePwshLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("windows-pwsh-login" /* WindowsPwshLogin */);
      }
      if (!newArgs) {
        return void 0;
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot, "");
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      if (options.shellIntegration.suggestEnabled) {
        envMixin["VSCODE_SUGGEST"] = "1";
      }
      return { newArgs, envMixin };
    } else if (shell === "bash.exe") {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        envMixin["VSCODE_SHELL_LOGIN"] = "1";
        addEnvMixinPathPrefix(options, envMixin, shell);
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      }
      if (!newArgs) {
        return void 0;
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot);
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      return { newArgs, envMixin };
    }
    logService.warn(`Shell integration cannot be enabled for executable "${shellLaunchConfig.executable}" and args`, shellLaunchConfig.args);
    return void 0;
  }
  switch (shell) {
    case "bash": {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        envMixin["VSCODE_SHELL_LOGIN"] = "1";
        addEnvMixinPathPrefix(options, envMixin, shell);
        newArgs = shellIntegrationArgs.get("bash" /* Bash */);
      }
      if (!newArgs) {
        return void 0;
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot);
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      return { newArgs, envMixin };
    }
    case "fish": {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("fish" /* Fish */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("fish-login" /* FishLogin */);
      } else if (originalArgs === shellIntegrationArgs.get("fish" /* Fish */) || originalArgs === shellIntegrationArgs.get("fish-login" /* FishLogin */)) {
        newArgs = originalArgs;
      }
      if (!newArgs) {
        return void 0;
      }
      addEnvMixinPathPrefix(options, envMixin, shell);
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot);
      return { newArgs, envMixin };
    }
    case "pwsh": {
      if (!originalArgs || arePwshImpliedArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("pwsh" /* Pwsh */);
      } else if (arePwshLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("pwsh-login" /* PwshLogin */);
      }
      if (!newArgs) {
        return void 0;
      }
      if (options.shellIntegration.suggestEnabled) {
        envMixin["VSCODE_SUGGEST"] = "1";
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot, "");
      envMixin["VSCODE_STABLE"] = productService.quality === "stable" ? "1" : "0";
      return { newArgs, envMixin };
    }
    case "zsh": {
      if (!originalArgs || originalArgs.length === 0) {
        newArgs = shellIntegrationArgs.get("zsh" /* Zsh */);
      } else if (areZshBashFishLoginArgs(originalArgs)) {
        newArgs = shellIntegrationArgs.get("zsh-login" /* ZshLogin */);
        addEnvMixinPathPrefix(options, envMixin, shell);
      } else if (originalArgs === shellIntegrationArgs.get("zsh" /* Zsh */) || originalArgs === shellIntegrationArgs.get("zsh-login" /* ZshLogin */)) {
        newArgs = originalArgs;
      }
      if (!newArgs) {
        return void 0;
      }
      newArgs = [...newArgs];
      newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot);
      let username;
      try {
        username = os.userInfo().username;
      } catch {
        username = "unknown";
      }
      const realTmpDir = realpathSync(os.tmpdir());
      const zdotdir = path.join(realTmpDir, `${username}-${productService.applicationName}-zsh`);
      if (!skipStickyBit) {
        try {
          const chmodAsync = promisify(chmod);
          await chmodAsync(zdotdir, 960);
        } catch (err) {
          if (err.message.includes("ENOENT")) {
            try {
              mkdirSync(zdotdir);
            } catch (err2) {
              logService.error(`Failed to create zdotdir at ${zdotdir}: ${err2}`);
              return void 0;
            }
            try {
              const chmodAsync = promisify(chmod);
              await chmodAsync(zdotdir, 960);
            } catch {
              logService.error(`Failed to set sticky bit on ${zdotdir}: ${err}`);
              return void 0;
            }
          }
          logService.error(`Failed to set sticky bit on ${zdotdir}: ${err}`);
          return void 0;
        }
      }
      envMixin["ZDOTDIR"] = zdotdir;
      const userZdotdir = env?.ZDOTDIR ?? os.homedir() ?? `~`;
      envMixin["USER_ZDOTDIR"] = userZdotdir;
      const filesToCopy = [];
      filesToCopy.push({
        source: path.join(appRoot, "out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-rc.zsh"),
        dest: path.join(zdotdir, ".zshrc")
      });
      filesToCopy.push({
        source: path.join(appRoot, "out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-profile.zsh"),
        dest: path.join(zdotdir, ".zprofile")
      });
      filesToCopy.push({
        source: path.join(appRoot, "out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-env.zsh"),
        dest: path.join(zdotdir, ".zshenv")
      });
      filesToCopy.push({
        source: path.join(appRoot, "out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-login.zsh"),
        dest: path.join(zdotdir, ".zlogin")
      });
      return { newArgs, envMixin, filesToCopy };
    }
  }
  logService.warn(`Shell integration cannot be enabled for executable "${shellLaunchConfig.executable}" and args`, shellLaunchConfig.args);
  return void 0;
}
function addEnvMixinPathPrefix(options, envMixin, shell) {
  if ((isMacintosh || shell === "fish") && options.environmentVariableCollections) {
    const deserialized = deserializeEnvironmentVariableCollections(options.environmentVariableCollections);
    const merged = new MergedEnvironmentVariableCollection(deserialized);
    const pathEntry = merged.getVariableMap({ workspaceFolder: options.workspaceFolder }).get("PATH");
    const prependToPath = [];
    if (pathEntry) {
      for (const mutator of pathEntry) {
        if (mutator.type === EnvironmentVariableMutatorType.Prepend) {
          prependToPath.push(mutator.value);
        }
      }
    }
    if (prependToPath.length > 0) {
      envMixin["VSCODE_PATH_PREFIX"] = prependToPath.join("");
    }
  }
}
var ShellIntegrationExecutable = /* @__PURE__ */ ((ShellIntegrationExecutable2) => {
  ShellIntegrationExecutable2["WindowsPwsh"] = "windows-pwsh";
  ShellIntegrationExecutable2["WindowsPwshLogin"] = "windows-pwsh-login";
  ShellIntegrationExecutable2["Pwsh"] = "pwsh";
  ShellIntegrationExecutable2["PwshLogin"] = "pwsh-login";
  ShellIntegrationExecutable2["Zsh"] = "zsh";
  ShellIntegrationExecutable2["ZshLogin"] = "zsh-login";
  ShellIntegrationExecutable2["Bash"] = "bash";
  ShellIntegrationExecutable2["Fish"] = "fish";
  ShellIntegrationExecutable2["FishLogin"] = "fish-login";
  return ShellIntegrationExecutable2;
})(ShellIntegrationExecutable || {});
const shellIntegrationArgs = /* @__PURE__ */ new Map();
shellIntegrationArgs.set("windows-pwsh" /* WindowsPwsh */, ["-noexit", "-command", 'try { . "{0}\\out\\vs\\workbench\\contrib\\terminal\\common\\scripts\\shellIntegration.ps1" } catch {}{1}']);
shellIntegrationArgs.set("windows-pwsh-login" /* WindowsPwshLogin */, ["-l", "-noexit", "-command", 'try { . "{0}\\out\\vs\\workbench\\contrib\\terminal\\common\\scripts\\shellIntegration.ps1" } catch {}{1}']);
shellIntegrationArgs.set("pwsh" /* Pwsh */, ["-noexit", "-command", '. "{0}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration.ps1"{1}']);
shellIntegrationArgs.set("pwsh-login" /* PwshLogin */, ["-l", "-noexit", "-command", '. "{0}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration.ps1"']);
shellIntegrationArgs.set("zsh" /* Zsh */, ["-i"]);
shellIntegrationArgs.set("zsh-login" /* ZshLogin */, ["-il"]);
shellIntegrationArgs.set("bash" /* Bash */, ["--init-file", "{0}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-bash.sh"]);
shellIntegrationArgs.set("fish" /* Fish */, ["--init-command", 'source "{0}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration.fish"']);
shellIntegrationArgs.set("fish-login" /* FishLogin */, ["-l", "--init-command", 'source "{0}/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration.fish"']);
const pwshLoginArgs = ["-login", "-l"];
const shLoginArgs = ["--login", "-l"];
const shInteractiveArgs = ["-i", "--interactive"];
const pwshImpliedArgs = ["-nol", "-nologo"];
function arePwshLoginArgs(originalArgs) {
  if (typeof originalArgs === "string") {
    return pwshLoginArgs.includes(originalArgs.toLowerCase());
  } else {
    return originalArgs.length === 1 && pwshLoginArgs.includes(originalArgs[0].toLowerCase()) || originalArgs.length === 2 && (pwshLoginArgs.includes(originalArgs[0].toLowerCase()) || pwshLoginArgs.includes(originalArgs[1].toLowerCase())) && (pwshImpliedArgs.includes(originalArgs[0].toLowerCase()) || pwshImpliedArgs.includes(originalArgs[1].toLowerCase()));
  }
}
function arePwshImpliedArgs(originalArgs) {
  if (typeof originalArgs === "string") {
    return pwshImpliedArgs.includes(originalArgs.toLowerCase());
  } else {
    return originalArgs.length === 0 || originalArgs?.length === 1 && pwshImpliedArgs.includes(originalArgs[0].toLowerCase());
  }
}
function areZshBashFishLoginArgs(originalArgs) {
  if (typeof originalArgs !== "string") {
    originalArgs = originalArgs.filter((arg) => !shInteractiveArgs.includes(arg.toLowerCase()));
  }
  return originalArgs === "string" && shLoginArgs.includes(originalArgs.toLowerCase()) || typeof originalArgs !== "string" && originalArgs.length === 1 && shLoginArgs.includes(originalArgs[0].toLowerCase());
}
export {
  getShellIntegrationInjection,
  getWindowsBuildNumber
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3Rlcm1pbmFsRW52aXJvbm1lbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNoZWxsTGF1bmNoQ29uZmlnLCBJVGVybWluYWxFbnZpcm9ubWVudCwgSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlIH0gZnJvbSAnLi4vY29tbW9uL2Vudmlyb25tZW50VmFyaWFibGUuanMnO1xuaW1wb3J0IHsgZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnMgfSBmcm9tICcuLi9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZVNoYXJlZC5qcyc7XG5pbXBvcnQgeyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBjaG1vZCwgcmVhbHBhdGhTeW5jLCBta2RpclN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFdpbmRvd3NCdWlsZE51bWJlcigpOiBudW1iZXIge1xuXHRjb25zdCBvc1ZlcnNpb24gPSAoLyhcXGQrKVxcLihcXGQrKVxcLihcXGQrKS9nKS5leGVjKG9zLnJlbGVhc2UoKSk7XG5cdGxldCBidWlsZE51bWJlcjogbnVtYmVyID0gMDtcblx0aWYgKG9zVmVyc2lvbiAmJiBvc1ZlcnNpb24ubGVuZ3RoID09PSA0KSB7XG5cdFx0YnVpbGROdW1iZXIgPSBwYXJzZUludChvc1ZlcnNpb25bM10pO1xuXHR9XG5cdHJldHVybiBidWlsZE51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2hlbGxJbnRlZ3JhdGlvbkNvbmZpZ0luamVjdGlvbiB7XG5cdC8qKlxuXHQgKiBBIG5ldyBzZXQgb2YgYXJndW1lbnRzIHRvIHVzZS5cblx0ICovXG5cdG5ld0FyZ3M6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXHQvKipcblx0ICogQW4gb3B0aW9uYWwgZW52aXJvbm1lbnQgdG8gbWl4aW5nIHRvIHRoZSByZWFsIGVudmlyb25tZW50LlxuXHQgKi9cblx0ZW52TWl4aW4/OiBJUHJvY2Vzc0Vudmlyb25tZW50O1xuXHQvKipcblx0ICogQW4gb3B0aW9uYWwgYXJyYXkgb2YgZmlsZXMgdG8gY29weSBmcm9tIGBzb3VyY2VgIHRvIGBkZXN0YC5cblx0ICovXG5cdGZpbGVzVG9Db3B5Pzoge1xuXHRcdHNvdXJjZTogc3RyaW5nO1xuXHRcdGRlc3Q6IHN0cmluZztcblx0fVtdO1xufVxuXG4vKipcbiAqIEZvciBhIGdpdmVuIHNoZWxsIGxhdW5jaCBjb25maWcsIHJldHVybnMgYXJndW1lbnRzIHRvIHJlcGxhY2UgYW5kIGFuIG9wdGlvbmFsIGVudmlyb25tZW50IHRvXG4gKiBtaXhpbiB0byB0aGUgU0xDJ3MgZW52aXJvbm1lbnQgdG8gZW5hYmxlIHNoZWxsIGludGVncmF0aW9uLiBUaGlzIG11c3QgYmUgcnVuIHdpdGhpbiB0aGUgY29udGV4dFxuICogdGhhdCBjcmVhdGVzIHRoZSBwcm9jZXNzIHRvIGVuc3VyZSBhY2N1cmFjeS4gUmV0dXJucyB1bmRlZmluZWQgaWYgc2hlbGwgaW50ZWdyYXRpb24gY2Fubm90IGJlXG4gKiBlbmFibGVkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2hlbGxJbnRlZ3JhdGlvbkluamVjdGlvbihcblx0c2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyxcblx0b3B0aW9uczogSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMsXG5cdGVudjogSVRlcm1pbmFsRW52aXJvbm1lbnQgfCB1bmRlZmluZWQsXG5cdGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRza2lwU3RpY2t5Qml0OiBib29sZWFuID0gZmFsc2Vcbik6IFByb21pc2U8SVNoZWxsSW50ZWdyYXRpb25Db25maWdJbmplY3Rpb24gfCB1bmRlZmluZWQ+IHtcblx0Ly8gQ29uZGl0aW9uYWxseSBkaXNhYmxlIHNoZWxsIGludGVncmF0aW9uIGFyZyBpbmplY3Rpb25cblx0Ly8gLSBUaGUgZ2xvYmFsIHNldHRpbmcgaXMgZGlzYWJsZWRcblx0Ly8gLSBUaGVyZSBpcyBubyBleGVjdXRhYmxlIChub3Qgc3VyZSB3aGF0IHNjcmlwdCB0byBydW4pXG5cdC8vIC0gVGhlIHRlcm1pbmFsIGlzIHVzZWQgYnkgYSBmZWF0dXJlIGxpa2UgdGFza3Mgb3IgZGVidWdnaW5nXG5cdGNvbnN0IHVzZVdpbnB0eSA9IGlzV2luZG93cyAmJiAoIW9wdGlvbnMud2luZG93c0VuYWJsZUNvbnB0eSB8fCBnZXRXaW5kb3dzQnVpbGROdW1iZXIoKSA8IDE4MzA5KTtcblx0aWYgKFxuXHRcdC8vIFRoZSBnbG9iYWwgc2V0dGluZyBpcyBkaXNhYmxlZFxuXHRcdCFvcHRpb25zLnNoZWxsSW50ZWdyYXRpb24uZW5hYmxlZCB8fFxuXHRcdC8vIFRoZXJlIGlzIG5vIGV4ZWN1dGFibGUgKHNvIHRoZXJlJ3Mgbm8gd2F5IHRvIGRldGVybWluZSBob3cgdG8gaW5qZWN0KVxuXHRcdCFzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlIHx8XG5cdFx0Ly8gSXQncyBhIGZlYXR1cmUgdGVybWluYWwgKHRhc2tzLCBkZWJ1ZyksIHVubGVzcyBpdCdzIGV4cGxpY2l0bHkgYmVpbmcgZm9yY2VkXG5cdFx0KHNoZWxsTGF1bmNoQ29uZmlnLmlzRmVhdHVyZVRlcm1pbmFsICYmICFzaGVsbExhdW5jaENvbmZpZy5mb3JjZVNoZWxsSW50ZWdyYXRpb24pIHx8XG5cdFx0Ly8gVGhlIGlnbm9yZVNoZWxsSW50ZWdyYXRpb24gZmxhZyBpcyBwYXNzZWQgKGVnLiByZWxhdW5jaGluZyB3aXRob3V0IHNoZWxsIGludGVncmF0aW9uKVxuXHRcdHNoZWxsTGF1bmNoQ29uZmlnLmlnbm9yZVNoZWxsSW50ZWdyYXRpb24gfHxcblx0XHQvLyBXaW5wdHkgaXMgdW5zdXBwb3J0ZWRcblx0XHR1c2VXaW5wdHlcblx0KSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGNvbnN0IG9yaWdpbmFsQXJncyA9IHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3M7XG5cdGNvbnN0IHNoZWxsID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IHBhdGguYmFzZW5hbWUoc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSkudG9Mb3dlckNhc2UoKSA6IHBhdGguYmFzZW5hbWUoc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSk7XG5cdGNvbnN0IGFwcFJvb3QgPSBwYXRoLmRpcm5hbWUoRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJycpLmZzUGF0aCk7XG5cdGxldCBuZXdBcmdzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblx0Y29uc3QgZW52TWl4aW46IElQcm9jZXNzRW52aXJvbm1lbnQgPSB7XG5cdFx0J1ZTQ09ERV9JTkpFQ1RJT04nOiAnMSdcblx0fTtcblxuXHRpZiAob3B0aW9ucy5zaGVsbEludGVncmF0aW9uLm5vbmNlKSB7XG5cdFx0ZW52TWl4aW5bJ1ZTQ09ERV9OT05DRSddID0gb3B0aW9ucy5zaGVsbEludGVncmF0aW9uLm5vbmNlO1xuXHR9XG5cdGlmIChzaGVsbExhdW5jaENvbmZpZy5zaGVsbEludGVncmF0aW9uRW52aXJvbm1lbnRSZXBvcnRpbmcpIHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRjb25zdCBlbmFibGVXaW5kb3dzRW52UmVwb3J0aW5nID0gb3B0aW9ucy53aW5kb3dzVXNlQ29ucHR5RGxsIHx8IG9wdGlvbnMud2luZG93c0VuYWJsZUNvbnB0eSAmJiBnZXRXaW5kb3dzQnVpbGROdW1iZXIoKSA+PSAyMjYzMSAmJiBzaGVsbCAhPT0gJ2Jhc2guZXhlJztcblx0XHRcdGlmIChlbmFibGVXaW5kb3dzRW52UmVwb3J0aW5nKSB7XG5cdFx0XHRcdGVudk1peGluWydWU0NPREVfU0hFTExfRU5WX1JFUE9SVElORyddID0gJzEnO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbnZNaXhpblsnVlNDT0RFX1NIRUxMX0VOVl9SRVBPUlRJTkcnXSA9ICcxJztcblx0XHR9XG5cdH1cblx0Ly8gV2luZG93c1xuXHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0aWYgKHNoZWxsID09PSAncHdzaC5leGUnIHx8IHNoZWxsID09PSAncG93ZXJzaGVsbC5leGUnKSB7XG5cdFx0XHRpZiAoIW9yaWdpbmFsQXJncyB8fCBhcmVQd3NoSW1wbGllZEFyZ3Mob3JpZ2luYWxBcmdzKSkge1xuXHRcdFx0XHRuZXdBcmdzID0gc2hlbGxJbnRlZ3JhdGlvbkFyZ3MuZ2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLldpbmRvd3NQd3NoKTtcblx0XHRcdH0gZWxzZSBpZiAoYXJlUHdzaExvZ2luQXJncyhvcmlnaW5hbEFyZ3MpKSB7XG5cdFx0XHRcdG5ld0FyZ3MgPSBzaGVsbEludGVncmF0aW9uQXJncy5nZXQoU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUuV2luZG93c1B3c2hMb2dpbik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIW5ld0FyZ3MpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdG5ld0FyZ3MgPSBbLi4ubmV3QXJnc107IC8vIFNoYWxsb3cgY2xvbmUgdGhlIGFycmF5IHRvIGF2b2lkIHNldHRpbmcgdGhlIGRlZmF1bHQgYXJyYXlcblx0XHRcdG5ld0FyZ3NbbmV3QXJncy5sZW5ndGggLSAxXSA9IGZvcm1hdChuZXdBcmdzW25ld0FyZ3MubGVuZ3RoIC0gMV0sIGFwcFJvb3QsICcnKTtcblx0XHRcdGVudk1peGluWydWU0NPREVfU1RBQkxFJ10gPSBwcm9kdWN0U2VydmljZS5xdWFsaXR5ID09PSAnc3RhYmxlJyA/ICcxJyA6ICcwJztcblx0XHRcdGlmIChvcHRpb25zLnNoZWxsSW50ZWdyYXRpb24uc3VnZ2VzdEVuYWJsZWQpIHtcblx0XHRcdFx0ZW52TWl4aW5bJ1ZTQ09ERV9TVUdHRVNUJ10gPSAnMSc7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyBuZXdBcmdzLCBlbnZNaXhpbiB9O1xuXHRcdH0gZWxzZSBpZiAoc2hlbGwgPT09ICdiYXNoLmV4ZScpIHtcblx0XHRcdGlmICghb3JpZ2luYWxBcmdzIHx8IG9yaWdpbmFsQXJncy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0bmV3QXJncyA9IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5CYXNoKTtcblx0XHRcdH0gZWxzZSBpZiAoYXJlWnNoQmFzaEZpc2hMb2dpbkFyZ3Mob3JpZ2luYWxBcmdzKSkge1xuXHRcdFx0XHRlbnZNaXhpblsnVlNDT0RFX1NIRUxMX0xPR0lOJ10gPSAnMSc7XG5cdFx0XHRcdGFkZEVudk1peGluUGF0aFByZWZpeChvcHRpb25zLCBlbnZNaXhpbiwgc2hlbGwpO1xuXHRcdFx0XHRuZXdBcmdzID0gc2hlbGxJbnRlZ3JhdGlvbkFyZ3MuZ2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLkJhc2gpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFuZXdBcmdzKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRuZXdBcmdzID0gWy4uLm5ld0FyZ3NdOyAvLyBTaGFsbG93IGNsb25lIHRoZSBhcnJheSB0byBhdm9pZCBzZXR0aW5nIHRoZSBkZWZhdWx0IGFycmF5XG5cdFx0XHRuZXdBcmdzW25ld0FyZ3MubGVuZ3RoIC0gMV0gPSBmb3JtYXQobmV3QXJnc1tuZXdBcmdzLmxlbmd0aCAtIDFdLCBhcHBSb290KTtcblx0XHRcdGVudk1peGluWydWU0NPREVfU1RBQkxFJ10gPSBwcm9kdWN0U2VydmljZS5xdWFsaXR5ID09PSAnc3RhYmxlJyA/ICcxJyA6ICcwJztcblx0XHRcdHJldHVybiB7IG5ld0FyZ3MsIGVudk1peGluIH07XG5cdFx0fVxuXHRcdGxvZ1NlcnZpY2Uud2FybihgU2hlbGwgaW50ZWdyYXRpb24gY2Fubm90IGJlIGVuYWJsZWQgZm9yIGV4ZWN1dGFibGUgXCIke3NoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGV9XCIgYW5kIGFyZ3NgLCBzaGVsbExhdW5jaENvbmZpZy5hcmdzKTtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Ly8gTGludXggJiBtYWNPU1xuXHRzd2l0Y2ggKHNoZWxsKSB7XG5cdFx0Y2FzZSAnYmFzaCc6IHtcblx0XHRcdGlmICghb3JpZ2luYWxBcmdzIHx8IG9yaWdpbmFsQXJncy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0bmV3QXJncyA9IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5CYXNoKTtcblx0XHRcdH0gZWxzZSBpZiAoYXJlWnNoQmFzaEZpc2hMb2dpbkFyZ3Mob3JpZ2luYWxBcmdzKSkge1xuXHRcdFx0XHRlbnZNaXhpblsnVlNDT0RFX1NIRUxMX0xPR0lOJ10gPSAnMSc7XG5cdFx0XHRcdGFkZEVudk1peGluUGF0aFByZWZpeChvcHRpb25zLCBlbnZNaXhpbiwgc2hlbGwpO1xuXHRcdFx0XHRuZXdBcmdzID0gc2hlbGxJbnRlZ3JhdGlvbkFyZ3MuZ2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLkJhc2gpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFuZXdBcmdzKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRuZXdBcmdzID0gWy4uLm5ld0FyZ3NdOyAvLyBTaGFsbG93IGNsb25lIHRoZSBhcnJheSB0byBhdm9pZCBzZXR0aW5nIHRoZSBkZWZhdWx0IGFycmF5XG5cdFx0XHRuZXdBcmdzW25ld0FyZ3MubGVuZ3RoIC0gMV0gPSBmb3JtYXQobmV3QXJnc1tuZXdBcmdzLmxlbmd0aCAtIDFdLCBhcHBSb290KTtcblx0XHRcdGVudk1peGluWydWU0NPREVfU1RBQkxFJ10gPSBwcm9kdWN0U2VydmljZS5xdWFsaXR5ID09PSAnc3RhYmxlJyA/ICcxJyA6ICcwJztcblx0XHRcdHJldHVybiB7IG5ld0FyZ3MsIGVudk1peGluIH07XG5cdFx0fVxuXHRcdGNhc2UgJ2Zpc2gnOiB7XG5cdFx0XHRpZiAoIW9yaWdpbmFsQXJncyB8fCBvcmlnaW5hbEFyZ3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdG5ld0FyZ3MgPSBzaGVsbEludGVncmF0aW9uQXJncy5nZXQoU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUuRmlzaCk7XG5cdFx0XHR9IGVsc2UgaWYgKGFyZVpzaEJhc2hGaXNoTG9naW5BcmdzKG9yaWdpbmFsQXJncykpIHtcblx0XHRcdFx0bmV3QXJncyA9IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5GaXNoTG9naW4pO1xuXHRcdFx0fSBlbHNlIGlmIChvcmlnaW5hbEFyZ3MgPT09IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5GaXNoKSB8fCBvcmlnaW5hbEFyZ3MgPT09IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5GaXNoTG9naW4pKSB7XG5cdFx0XHRcdG5ld0FyZ3MgPSBvcmlnaW5hbEFyZ3M7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIW5ld0FyZ3MpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gT24gZmlzaCwgJyRmaXNoX3VzZXJfcGF0aHMnIGlzIGFsd2F5cyBwcmVwZW5kZWQgdG8gdGhlIFBBVEgsIGZvciBib3RoIGxvZ2luIGFuZCBub24tbG9naW4gc2hlbGxzLCBzbyB3ZSBuZWVkXG5cdFx0XHQvLyB0byBhcHBseSB0aGUgcGF0aCBwcmVmaXggZml4IGFsd2F5cywgbm90IG9ubHkgZm9yIGxvZ2luIHNoZWxscyAoc2VlICMyMzIyOTEpXG5cdFx0XHRhZGRFbnZNaXhpblBhdGhQcmVmaXgob3B0aW9ucywgZW52TWl4aW4sIHNoZWxsKTtcblxuXHRcdFx0bmV3QXJncyA9IFsuLi5uZXdBcmdzXTsgLy8gU2hhbGxvdyBjbG9uZSB0aGUgYXJyYXkgdG8gYXZvaWQgc2V0dGluZyB0aGUgZGVmYXVsdCBhcnJheVxuXHRcdFx0bmV3QXJnc1tuZXdBcmdzLmxlbmd0aCAtIDFdID0gZm9ybWF0KG5ld0FyZ3NbbmV3QXJncy5sZW5ndGggLSAxXSwgYXBwUm9vdCk7XG5cdFx0XHRyZXR1cm4geyBuZXdBcmdzLCBlbnZNaXhpbiB9O1xuXHRcdH1cblx0XHRjYXNlICdwd3NoJzoge1xuXHRcdFx0aWYgKCFvcmlnaW5hbEFyZ3MgfHwgYXJlUHdzaEltcGxpZWRBcmdzKG9yaWdpbmFsQXJncykpIHtcblx0XHRcdFx0bmV3QXJncyA9IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5Qd3NoKTtcblx0XHRcdH0gZWxzZSBpZiAoYXJlUHdzaExvZ2luQXJncyhvcmlnaW5hbEFyZ3MpKSB7XG5cdFx0XHRcdG5ld0FyZ3MgPSBzaGVsbEludGVncmF0aW9uQXJncy5nZXQoU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUuUHdzaExvZ2luKTtcblx0XHRcdH1cblx0XHRcdGlmICghbmV3QXJncykge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9wdGlvbnMuc2hlbGxJbnRlZ3JhdGlvbi5zdWdnZXN0RW5hYmxlZCkge1xuXHRcdFx0XHRlbnZNaXhpblsnVlNDT0RFX1NVR0dFU1QnXSA9ICcxJztcblx0XHRcdH1cblx0XHRcdG5ld0FyZ3MgPSBbLi4ubmV3QXJnc107IC8vIFNoYWxsb3cgY2xvbmUgdGhlIGFycmF5IHRvIGF2b2lkIHNldHRpbmcgdGhlIGRlZmF1bHQgYXJyYXlcblx0XHRcdG5ld0FyZ3NbbmV3QXJncy5sZW5ndGggLSAxXSA9IGZvcm1hdChuZXdBcmdzW25ld0FyZ3MubGVuZ3RoIC0gMV0sIGFwcFJvb3QsICcnKTtcblx0XHRcdGVudk1peGluWydWU0NPREVfU1RBQkxFJ10gPSBwcm9kdWN0U2VydmljZS5xdWFsaXR5ID09PSAnc3RhYmxlJyA/ICcxJyA6ICcwJztcblx0XHRcdHJldHVybiB7IG5ld0FyZ3MsIGVudk1peGluIH07XG5cdFx0fVxuXHRcdGNhc2UgJ3pzaCc6IHtcblx0XHRcdGlmICghb3JpZ2luYWxBcmdzIHx8IG9yaWdpbmFsQXJncy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0bmV3QXJncyA9IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5ac2gpO1xuXHRcdFx0fSBlbHNlIGlmIChhcmVac2hCYXNoRmlzaExvZ2luQXJncyhvcmlnaW5hbEFyZ3MpKSB7XG5cdFx0XHRcdG5ld0FyZ3MgPSBzaGVsbEludGVncmF0aW9uQXJncy5nZXQoU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUuWnNoTG9naW4pO1xuXHRcdFx0XHRhZGRFbnZNaXhpblBhdGhQcmVmaXgob3B0aW9ucywgZW52TWl4aW4sIHNoZWxsKTtcblx0XHRcdH0gZWxzZSBpZiAob3JpZ2luYWxBcmdzID09PSBzaGVsbEludGVncmF0aW9uQXJncy5nZXQoU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUuWnNoKSB8fCBvcmlnaW5hbEFyZ3MgPT09IHNoZWxsSW50ZWdyYXRpb25BcmdzLmdldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5ac2hMb2dpbikpIHtcblx0XHRcdFx0bmV3QXJncyA9IG9yaWdpbmFsQXJncztcblx0XHRcdH1cblx0XHRcdGlmICghbmV3QXJncykge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0bmV3QXJncyA9IFsuLi5uZXdBcmdzXTsgLy8gU2hhbGxvdyBjbG9uZSB0aGUgYXJyYXkgdG8gYXZvaWQgc2V0dGluZyB0aGUgZGVmYXVsdCBhcnJheVxuXHRcdFx0bmV3QXJnc1tuZXdBcmdzLmxlbmd0aCAtIDFdID0gZm9ybWF0KG5ld0FyZ3NbbmV3QXJncy5sZW5ndGggLSAxXSwgYXBwUm9vdCk7XG5cblx0XHRcdC8vIE1vdmUgLnpzaHJjIGludG8gJFpET1RESVIgYXMgdGhlIHdheSB0byBhY3RpdmF0ZSB0aGUgc2NyaXB0XG5cdFx0XHRsZXQgdXNlcm5hbWU6IHN0cmluZztcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHVzZXJuYW1lID0gb3MudXNlckluZm8oKS51c2VybmFtZTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHR1c2VybmFtZSA9ICd1bmtub3duJztcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVzb2x2ZSB0aGUgYWN0dWFsIHRtcCBkaXJlY3Rvcnkgc28gd2UgY2FuIHNldCB0aGUgc3RpY2t5IGJpdFxuXHRcdFx0Y29uc3QgcmVhbFRtcERpciA9IHJlYWxwYXRoU3luYyhvcy50bXBkaXIoKSk7XG5cdFx0XHRjb25zdCB6ZG90ZGlyID0gcGF0aC5qb2luKHJlYWxUbXBEaXIsIGAke3VzZXJuYW1lfS0ke3Byb2R1Y3RTZXJ2aWNlLmFwcGxpY2F0aW9uTmFtZX0tenNoYCk7XG5cblx0XHRcdC8vIFNldCBkaXJlY3RvcnkgcGVybWlzc2lvbnMgdXNpbmcgb2N0YWwgbm90YXRpb246XG5cdFx0XHQvLyAtIDBvMTcwMDpcblx0XHRcdC8vIC0gU3RpY2t5IGJpdCBpcyBzZXQsIHByZXZlbnRpbmcgbm9uLW93bmVycyBmcm9tIGRlbGV0aW5nIG9yIHJlbmFtaW5nIGZpbGVzIHdpdGhpbiB0aGlzIGRpcmVjdG9yeSAoMSlcblx0XHRcdC8vIC0gT3duZXIgaGFzIGZ1bGwgcmVhZCAoNCksIHdyaXRlICgyKSwgZXhlY3V0ZSAoMSkgcGVybWlzc2lvbnNcblx0XHRcdC8vIC0gR3JvdXAgaGFzIG5vIHBlcm1pc3Npb25zICgwKVxuXHRcdFx0Ly8gLSBPdGhlcnMgaGF2ZSBubyBwZXJtaXNzaW9ucyAoMClcblx0XHRcdGlmICghc2tpcFN0aWNreUJpdCkge1xuXHRcdFx0XHQvLyBza2lwIGZvciB0ZXN0c1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGNobW9kQXN5bmMgPSBwcm9taXNpZnkoY2htb2QpO1xuXHRcdFx0XHRcdGF3YWl0IGNobW9kQXN5bmMoemRvdGRpciwgMG8xNzAwKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0aWYgKGVyci5tZXNzYWdlLmluY2x1ZGVzKCdFTk9FTlQnKSkge1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0bWtkaXJTeW5jKHpkb3RkaXIpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgemRvdGRpciBhdCAke3pkb3RkaXJ9OiAke2Vycn1gKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNobW9kQXN5bmMgPSBwcm9taXNpZnkoY2htb2QpO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBjaG1vZEFzeW5jKHpkb3RkaXIsIDBvMTcwMCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRcdFx0bG9nU2VydmljZS5lcnJvcihgRmFpbGVkIHRvIHNldCBzdGlja3kgYml0IG9uICR7emRvdGRpcn06ICR7ZXJyfWApO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRsb2dTZXJ2aWNlLmVycm9yKGBGYWlsZWQgdG8gc2V0IHN0aWNreSBiaXQgb24gJHt6ZG90ZGlyfTogJHtlcnJ9YCk7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZW52TWl4aW5bJ1pET1RESVInXSA9IHpkb3RkaXI7XG5cdFx0XHRjb25zdCB1c2VyWmRvdGRpciA9IGVudj8uWkRPVERJUiA/PyBvcy5ob21lZGlyKCkgPz8gYH5gO1xuXHRcdFx0ZW52TWl4aW5bJ1VTRVJfWkRPVERJUiddID0gdXNlclpkb3RkaXI7XG5cdFx0XHRjb25zdCBmaWxlc1RvQ29weTogSVNoZWxsSW50ZWdyYXRpb25Db25maWdJbmplY3Rpb25bJ2ZpbGVzVG9Db3B5J10gPSBbXTtcblx0XHRcdGZpbGVzVG9Db3B5LnB1c2goe1xuXHRcdFx0XHRzb3VyY2U6IHBhdGguam9pbihhcHBSb290LCAnb3V0L3ZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi9zY3JpcHRzL3NoZWxsSW50ZWdyYXRpb24tcmMuenNoJyksXG5cdFx0XHRcdGRlc3Q6IHBhdGguam9pbih6ZG90ZGlyLCAnLnpzaHJjJylcblx0XHRcdH0pO1xuXHRcdFx0ZmlsZXNUb0NvcHkucHVzaCh7XG5cdFx0XHRcdHNvdXJjZTogcGF0aC5qb2luKGFwcFJvb3QsICdvdXQvdnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvY29tbW9uL3NjcmlwdHMvc2hlbGxJbnRlZ3JhdGlvbi1wcm9maWxlLnpzaCcpLFxuXHRcdFx0XHRkZXN0OiBwYXRoLmpvaW4oemRvdGRpciwgJy56cHJvZmlsZScpXG5cdFx0XHR9KTtcblx0XHRcdGZpbGVzVG9Db3B5LnB1c2goe1xuXHRcdFx0XHRzb3VyY2U6IHBhdGguam9pbihhcHBSb290LCAnb3V0L3ZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi9zY3JpcHRzL3NoZWxsSW50ZWdyYXRpb24tZW52LnpzaCcpLFxuXHRcdFx0XHRkZXN0OiBwYXRoLmpvaW4oemRvdGRpciwgJy56c2hlbnYnKVxuXHRcdFx0fSk7XG5cdFx0XHRmaWxlc1RvQ29weS5wdXNoKHtcblx0XHRcdFx0c291cmNlOiBwYXRoLmpvaW4oYXBwUm9vdCwgJ291dC92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9jb21tb24vc2NyaXB0cy9zaGVsbEludGVncmF0aW9uLWxvZ2luLnpzaCcpLFxuXHRcdFx0XHRkZXN0OiBwYXRoLmpvaW4oemRvdGRpciwgJy56bG9naW4nKVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4geyBuZXdBcmdzLCBlbnZNaXhpbiwgZmlsZXNUb0NvcHkgfTtcblx0XHR9XG5cdH1cblx0bG9nU2VydmljZS53YXJuKGBTaGVsbCBpbnRlZ3JhdGlvbiBjYW5ub3QgYmUgZW5hYmxlZCBmb3IgZXhlY3V0YWJsZSBcIiR7c2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZX1cIiBhbmQgYXJnc2AsIHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MpO1xuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIFRoZXJlIGFyZSBhIGZldyBzaXR1YXRpb25zIHdoZXJlIHNvbWUgZGlyZWN0b3JpZXMgYXJlIGFkZGVkIHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBBVEguXG4gKiAxLiBPbiBtYWNPUyB3aGVuIHRoZSBwcm9maWxlIGNhbGxzIHBhdGhfaGVscGVyLlxuICogMi4gRm9yIGZpc2ggdGVybWluYWxzLCB3aGljaCBhbHdheXMgcHJlcGVuZCBcIiRmaXNoX3VzZXJfcGF0aHNcIiB0byB0aGUgUEFUSC5cbiAqXG4gKiBUaGlzIGNhdXNlcyBzaWduaWZpY2FudCBwcm9ibGVtcyBmb3IgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlXG4gKiBjb2xsZWN0aW9uIEFQSSBhcyB0aGUgY3VzdG9tIHBhdGhzIGFkZGVkIHRvIHRoZSBlbmQgd2lsbCBub3cgYmUgc29tZXdoZXJlIGluIHRoZSBtaWRkbGUgb2ZcbiAqIHRoZSBQQVRILiBUbyBjb21iYXQgdGhpcywgVlNDT0RFX1BBVEhfUFJFRklYIGlzIHVzZWQgdG8gcmUtYXBwbHkgYW55IHByZWZpeCBhZnRlciB0aGUgcHJvZmlsZVxuICogaGFzIHJ1bi4gVGhpcyB3aWxsIGNhdXNlIGR1cGxpY2F0aW9uIGluIHRoZSBQQVRIIGJ1dCBzaG91bGQgZml4IHRoZSBpc3N1ZS5cbiAqXG4gKiBTZWUgIzk5ODc4IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICovXG5mdW5jdGlvbiBhZGRFbnZNaXhpblBhdGhQcmVmaXgob3B0aW9uczogSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMsIGVudk1peGluOiBJUHJvY2Vzc0Vudmlyb25tZW50LCBzaGVsbDogc3RyaW5nKTogdm9pZCB7XG5cdGlmICgoaXNNYWNpbnRvc2ggfHwgc2hlbGwgPT09ICdmaXNoJykgJiYgb3B0aW9ucy5lbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnMpIHtcblx0XHQvLyBEZXNlcmlhbGl6ZSBhbmQgbWVyZ2Vcblx0XHRjb25zdCBkZXNlcmlhbGl6ZWQgPSBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9ucyhvcHRpb25zLmVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9ucyk7XG5cdFx0Y29uc3QgbWVyZ2VkID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGRlc2VyaWFsaXplZCk7XG5cblx0XHQvLyBHZXQgYWxsIHByZXBlbmQgUEFUSCBlbnRyaWVzXG5cdFx0Y29uc3QgcGF0aEVudHJ5ID0gbWVyZ2VkLmdldFZhcmlhYmxlTWFwKHsgd29ya3NwYWNlRm9sZGVyOiBvcHRpb25zLndvcmtzcGFjZUZvbGRlciB9KS5nZXQoJ1BBVEgnKTtcblx0XHRjb25zdCBwcmVwZW5kVG9QYXRoOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGlmIChwYXRoRW50cnkpIHtcblx0XHRcdGZvciAoY29uc3QgbXV0YXRvciBvZiBwYXRoRW50cnkpIHtcblx0XHRcdFx0aWYgKG11dGF0b3IudHlwZSA9PT0gRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQpIHtcblx0XHRcdFx0XHRwcmVwZW5kVG9QYXRoLnB1c2gobXV0YXRvci52YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBZGQgdG8gdGhlIGVudmlyb25tZW50IG1peGluIHRvIGJlIGFwcGxpZWQgaW4gdGhlIHNoZWxsIGludGVncmF0aW9uIHNjcmlwdFxuXHRcdGlmIChwcmVwZW5kVG9QYXRoLmxlbmd0aCA+IDApIHtcblx0XHRcdGVudk1peGluWydWU0NPREVfUEFUSF9QUkVGSVgnXSA9IHByZXBlbmRUb1BhdGguam9pbignJyk7XG5cdFx0fVxuXHR9XG59XG5cbmVudW0gU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUge1xuXHRXaW5kb3dzUHdzaCA9ICd3aW5kb3dzLXB3c2gnLFxuXHRXaW5kb3dzUHdzaExvZ2luID0gJ3dpbmRvd3MtcHdzaC1sb2dpbicsXG5cdFB3c2ggPSAncHdzaCcsXG5cdFB3c2hMb2dpbiA9ICdwd3NoLWxvZ2luJyxcblx0WnNoID0gJ3pzaCcsXG5cdFpzaExvZ2luID0gJ3pzaC1sb2dpbicsXG5cdEJhc2ggPSAnYmFzaCcsXG5cdEZpc2ggPSAnZmlzaCcsXG5cdEZpc2hMb2dpbiA9ICdmaXNoLWxvZ2luJyxcbn1cblxuY29uc3Qgc2hlbGxJbnRlZ3JhdGlvbkFyZ3M6IE1hcDxTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZSwgc3RyaW5nW10+ID0gbmV3IE1hcCgpO1xuLy8gVGhlIHRyeSBjYXRjaCBzd2FsbG93cyBleGVjdXRpb24gcG9saWN5IGVycm9ycyBpbiB0aGUgY2FzZSBvZiB0aGUgYXJjaGl2ZSBkaXN0cmlidXRhYmxlXG5zaGVsbEludGVncmF0aW9uQXJncy5zZXQoU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUuV2luZG93c1B3c2gsIFsnLW5vZXhpdCcsICctY29tbWFuZCcsICd0cnkgeyAuIFxcXCJ7MH1cXFxcb3V0XFxcXHZzXFxcXHdvcmtiZW5jaFxcXFxjb250cmliXFxcXHRlcm1pbmFsXFxcXGNvbW1vblxcXFxzY3JpcHRzXFxcXHNoZWxsSW50ZWdyYXRpb24ucHMxXFxcIiB9IGNhdGNoIHt9ezF9J10pO1xuc2hlbGxJbnRlZ3JhdGlvbkFyZ3Muc2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLldpbmRvd3NQd3NoTG9naW4sIFsnLWwnLCAnLW5vZXhpdCcsICctY29tbWFuZCcsICd0cnkgeyAuIFxcXCJ7MH1cXFxcb3V0XFxcXHZzXFxcXHdvcmtiZW5jaFxcXFxjb250cmliXFxcXHRlcm1pbmFsXFxcXGNvbW1vblxcXFxzY3JpcHRzXFxcXHNoZWxsSW50ZWdyYXRpb24ucHMxXFxcIiB9IGNhdGNoIHt9ezF9J10pO1xuc2hlbGxJbnRlZ3JhdGlvbkFyZ3Muc2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLlB3c2gsIFsnLW5vZXhpdCcsICctY29tbWFuZCcsICcuIFwiezB9L291dC92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9jb21tb24vc2NyaXB0cy9zaGVsbEludGVncmF0aW9uLnBzMVwiezF9J10pO1xuc2hlbGxJbnRlZ3JhdGlvbkFyZ3Muc2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLlB3c2hMb2dpbiwgWyctbCcsICctbm9leGl0JywgJy1jb21tYW5kJywgJy4gXCJ7MH0vb3V0L3ZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi9zY3JpcHRzL3NoZWxsSW50ZWdyYXRpb24ucHMxXCInXSk7XG5zaGVsbEludGVncmF0aW9uQXJncy5zZXQoU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUuWnNoLCBbJy1pJ10pO1xuc2hlbGxJbnRlZ3JhdGlvbkFyZ3Muc2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLlpzaExvZ2luLCBbJy1pbCddKTtcbnNoZWxsSW50ZWdyYXRpb25BcmdzLnNldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5CYXNoLCBbJy0taW5pdC1maWxlJywgJ3swfS9vdXQvdnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvY29tbW9uL3NjcmlwdHMvc2hlbGxJbnRlZ3JhdGlvbi1iYXNoLnNoJ10pO1xuc2hlbGxJbnRlZ3JhdGlvbkFyZ3Muc2V0KFNoZWxsSW50ZWdyYXRpb25FeGVjdXRhYmxlLkZpc2gsIFsnLS1pbml0LWNvbW1hbmQnLCAnc291cmNlIFwiezB9L291dC92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9jb21tb24vc2NyaXB0cy9zaGVsbEludGVncmF0aW9uLmZpc2hcIiddKTtcbnNoZWxsSW50ZWdyYXRpb25BcmdzLnNldChTaGVsbEludGVncmF0aW9uRXhlY3V0YWJsZS5GaXNoTG9naW4sIFsnLWwnLCAnLS1pbml0LWNvbW1hbmQnLCAnc291cmNlIFwiezB9L291dC92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9jb21tb24vc2NyaXB0cy9zaGVsbEludGVncmF0aW9uLmZpc2hcIiddKTtcbmNvbnN0IHB3c2hMb2dpbkFyZ3MgPSBbJy1sb2dpbicsICctbCddO1xuY29uc3Qgc2hMb2dpbkFyZ3MgPSBbJy0tbG9naW4nLCAnLWwnXTtcbmNvbnN0IHNoSW50ZXJhY3RpdmVBcmdzID0gWyctaScsICctLWludGVyYWN0aXZlJ107XG5jb25zdCBwd3NoSW1wbGllZEFyZ3MgPSBbJy1ub2wnLCAnLW5vbG9nbyddO1xuXG5mdW5jdGlvbiBhcmVQd3NoTG9naW5BcmdzKG9yaWdpbmFsQXJnczogc3RyaW5nIHwgc3RyaW5nW10pOiBib29sZWFuIHtcblx0aWYgKHR5cGVvZiBvcmlnaW5hbEFyZ3MgPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIHB3c2hMb2dpbkFyZ3MuaW5jbHVkZXMob3JpZ2luYWxBcmdzLnRvTG93ZXJDYXNlKCkpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBvcmlnaW5hbEFyZ3MubGVuZ3RoID09PSAxICYmIHB3c2hMb2dpbkFyZ3MuaW5jbHVkZXMob3JpZ2luYWxBcmdzWzBdLnRvTG93ZXJDYXNlKCkpIHx8XG5cdFx0XHQob3JpZ2luYWxBcmdzLmxlbmd0aCA9PT0gMiAmJlxuXHRcdFx0XHQoKChwd3NoTG9naW5BcmdzLmluY2x1ZGVzKG9yaWdpbmFsQXJnc1swXS50b0xvd2VyQ2FzZSgpKSkgfHwgcHdzaExvZ2luQXJncy5pbmNsdWRlcyhvcmlnaW5hbEFyZ3NbMV0udG9Mb3dlckNhc2UoKSkpKVxuXHRcdFx0XHQmJiAoKHB3c2hJbXBsaWVkQXJncy5pbmNsdWRlcyhvcmlnaW5hbEFyZ3NbMF0udG9Mb3dlckNhc2UoKSkpIHx8IHB3c2hJbXBsaWVkQXJncy5pbmNsdWRlcyhvcmlnaW5hbEFyZ3NbMV0udG9Mb3dlckNhc2UoKSkpKTtcblx0fVxufVxuXG5mdW5jdGlvbiBhcmVQd3NoSW1wbGllZEFyZ3Mob3JpZ2luYWxBcmdzOiBzdHJpbmcgfCBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuXHRpZiAodHlwZW9mIG9yaWdpbmFsQXJncyA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gcHdzaEltcGxpZWRBcmdzLmluY2x1ZGVzKG9yaWdpbmFsQXJncy50b0xvd2VyQ2FzZSgpKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gb3JpZ2luYWxBcmdzLmxlbmd0aCA9PT0gMCB8fCBvcmlnaW5hbEFyZ3M/Lmxlbmd0aCA9PT0gMSAmJiBwd3NoSW1wbGllZEFyZ3MuaW5jbHVkZXMob3JpZ2luYWxBcmdzWzBdLnRvTG93ZXJDYXNlKCkpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFyZVpzaEJhc2hGaXNoTG9naW5BcmdzKG9yaWdpbmFsQXJnczogc3RyaW5nIHwgc3RyaW5nW10pOiBib29sZWFuIHtcblx0aWYgKHR5cGVvZiBvcmlnaW5hbEFyZ3MgIT09ICdzdHJpbmcnKSB7XG5cdFx0b3JpZ2luYWxBcmdzID0gb3JpZ2luYWxBcmdzLmZpbHRlcihhcmcgPT4gIXNoSW50ZXJhY3RpdmVBcmdzLmluY2x1ZGVzKGFyZy50b0xvd2VyQ2FzZSgpKSk7XG5cdH1cblx0cmV0dXJuIG9yaWdpbmFsQXJncyA9PT0gJ3N0cmluZycgJiYgc2hMb2dpbkFyZ3MuaW5jbHVkZXMob3JpZ2luYWxBcmdzLnRvTG93ZXJDYXNlKCkpXG5cdFx0fHwgdHlwZW9mIG9yaWdpbmFsQXJncyAhPT0gJ3N0cmluZycgJiYgb3JpZ2luYWxBcmdzLmxlbmd0aCA9PT0gMSAmJiBzaExvZ2luQXJncy5pbmNsdWRlcyhvcmlnaW5hbEFyZ3NbMF0udG9Mb3dlckNhc2UoKSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFFBQVE7QUFDcEIsU0FBUyxrQkFBa0I7QUFDM0IsWUFBWSxVQUFVO0FBQ3RCLFNBQThCLGFBQWEsaUJBQWlCO0FBQzVELFlBQVksYUFBYTtBQUN6QixTQUFTLGNBQWM7QUFJdkIsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxpREFBaUQ7QUFDMUQsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUyxPQUFPLGNBQWMsaUJBQWlCO0FBQy9DLFNBQVMsaUJBQWlCO0FBRW5CLFNBQVMsd0JBQWdDO0FBQy9DLFFBQU0sWUFBYSx1QkFBd0IsS0FBSyxHQUFHLFFBQVEsQ0FBQztBQUM1RCxNQUFJLGNBQXNCO0FBQzFCLE1BQUksYUFBYSxVQUFVLFdBQVcsR0FBRztBQUN4QyxrQkFBYyxTQUFTLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDcEM7QUFDQSxTQUFPO0FBQ1I7QUEwQkEsZUFBc0IsNkJBQ3JCLG1CQUNBLFNBQ0EsS0FDQSxZQUNBLGdCQUNBLGdCQUF5QixPQUMrQjtBQUt4RCxRQUFNLFlBQVksY0FBYyxDQUFDLFFBQVEsdUJBQXVCLHNCQUFzQixJQUFJO0FBQzFGO0FBQUE7QUFBQSxJQUVDLENBQUMsUUFBUSxpQkFBaUI7QUFBQSxJQUUxQixDQUFDLGtCQUFrQjtBQUFBLElBRWxCLGtCQUFrQixxQkFBcUIsQ0FBQyxrQkFBa0I7QUFBQSxJQUUzRCxrQkFBa0I7QUFBQSxJQUVsQjtBQUFBLElBQ0M7QUFDRCxXQUFPO0FBQUEsRUFDUjtBQUVBLFFBQU0sZUFBZSxrQkFBa0I7QUFDdkMsUUFBTSxRQUFRLFFBQVEsYUFBYSxVQUFVLEtBQUssU0FBUyxrQkFBa0IsVUFBVSxFQUFFLFlBQVksSUFBSSxLQUFLLFNBQVMsa0JBQWtCLFVBQVU7QUFDbkosUUFBTSxVQUFVLEtBQUssUUFBUSxXQUFXLFVBQVUsRUFBRSxFQUFFLE1BQU07QUFDNUQsTUFBSTtBQUNKLFFBQU0sV0FBZ0M7QUFBQSxJQUNyQyxvQkFBb0I7QUFBQSxFQUNyQjtBQUVBLE1BQUksUUFBUSxpQkFBaUIsT0FBTztBQUNuQyxhQUFTLGNBQWMsSUFBSSxRQUFRLGlCQUFpQjtBQUFBLEVBQ3JEO0FBQ0EsTUFBSSxrQkFBa0Isc0NBQXNDO0FBQzNELFFBQUksV0FBVztBQUNkLFlBQU0sNEJBQTRCLFFBQVEsdUJBQXVCLFFBQVEsdUJBQXVCLHNCQUFzQixLQUFLLFNBQVMsVUFBVTtBQUM5SSxVQUFJLDJCQUEyQjtBQUM5QixpQkFBUyw0QkFBNEIsSUFBSTtBQUFBLE1BQzFDO0FBQUEsSUFDRCxPQUFPO0FBQ04sZUFBUyw0QkFBNEIsSUFBSTtBQUFBLElBQzFDO0FBQUEsRUFDRDtBQUVBLE1BQUksV0FBVztBQUNkLFFBQUksVUFBVSxjQUFjLFVBQVUsa0JBQWtCO0FBQ3ZELFVBQUksQ0FBQyxnQkFBZ0IsbUJBQW1CLFlBQVksR0FBRztBQUN0RCxrQkFBVSxxQkFBcUIsSUFBSSxnQ0FBc0M7QUFBQSxNQUMxRSxXQUFXLGlCQUFpQixZQUFZLEdBQUc7QUFDMUMsa0JBQVUscUJBQXFCLElBQUksMkNBQTJDO0FBQUEsTUFDL0U7QUFDQSxVQUFJLENBQUMsU0FBUztBQUNiLGVBQU87QUFBQSxNQUNSO0FBQ0EsZ0JBQVUsQ0FBQyxHQUFHLE9BQU87QUFDckIsY0FBUSxRQUFRLFNBQVMsQ0FBQyxJQUFJLE9BQU8sUUFBUSxRQUFRLFNBQVMsQ0FBQyxHQUFHLFNBQVMsRUFBRTtBQUM3RSxlQUFTLGVBQWUsSUFBSSxlQUFlLFlBQVksV0FBVyxNQUFNO0FBQ3hFLFVBQUksUUFBUSxpQkFBaUIsZ0JBQWdCO0FBQzVDLGlCQUFTLGdCQUFnQixJQUFJO0FBQUEsTUFDOUI7QUFDQSxhQUFPLEVBQUUsU0FBUyxTQUFTO0FBQUEsSUFDNUIsV0FBVyxVQUFVLFlBQVk7QUFDaEMsVUFBSSxDQUFDLGdCQUFnQixhQUFhLFdBQVcsR0FBRztBQUMvQyxrQkFBVSxxQkFBcUIsSUFBSSxpQkFBK0I7QUFBQSxNQUNuRSxXQUFXLHdCQUF3QixZQUFZLEdBQUc7QUFDakQsaUJBQVMsb0JBQW9CLElBQUk7QUFDakMsOEJBQXNCLFNBQVMsVUFBVSxLQUFLO0FBQzlDLGtCQUFVLHFCQUFxQixJQUFJLGlCQUErQjtBQUFBLE1BQ25FO0FBQ0EsVUFBSSxDQUFDLFNBQVM7QUFDYixlQUFPO0FBQUEsTUFDUjtBQUNBLGdCQUFVLENBQUMsR0FBRyxPQUFPO0FBQ3JCLGNBQVEsUUFBUSxTQUFTLENBQUMsSUFBSSxPQUFPLFFBQVEsUUFBUSxTQUFTLENBQUMsR0FBRyxPQUFPO0FBQ3pFLGVBQVMsZUFBZSxJQUFJLGVBQWUsWUFBWSxXQUFXLE1BQU07QUFDeEUsYUFBTyxFQUFFLFNBQVMsU0FBUztBQUFBLElBQzVCO0FBQ0EsZUFBVyxLQUFLLHVEQUF1RCxrQkFBa0IsVUFBVSxjQUFjLGtCQUFrQixJQUFJO0FBQ3ZJLFdBQU87QUFBQSxFQUNSO0FBR0EsVUFBUSxPQUFPO0FBQUEsSUFDZCxLQUFLLFFBQVE7QUFDWixVQUFJLENBQUMsZ0JBQWdCLGFBQWEsV0FBVyxHQUFHO0FBQy9DLGtCQUFVLHFCQUFxQixJQUFJLGlCQUErQjtBQUFBLE1BQ25FLFdBQVcsd0JBQXdCLFlBQVksR0FBRztBQUNqRCxpQkFBUyxvQkFBb0IsSUFBSTtBQUNqQyw4QkFBc0IsU0FBUyxVQUFVLEtBQUs7QUFDOUMsa0JBQVUscUJBQXFCLElBQUksaUJBQStCO0FBQUEsTUFDbkU7QUFDQSxVQUFJLENBQUMsU0FBUztBQUNiLGVBQU87QUFBQSxNQUNSO0FBQ0EsZ0JBQVUsQ0FBQyxHQUFHLE9BQU87QUFDckIsY0FBUSxRQUFRLFNBQVMsQ0FBQyxJQUFJLE9BQU8sUUFBUSxRQUFRLFNBQVMsQ0FBQyxHQUFHLE9BQU87QUFDekUsZUFBUyxlQUFlLElBQUksZUFBZSxZQUFZLFdBQVcsTUFBTTtBQUN4RSxhQUFPLEVBQUUsU0FBUyxTQUFTO0FBQUEsSUFDNUI7QUFBQSxJQUNBLEtBQUssUUFBUTtBQUNaLFVBQUksQ0FBQyxnQkFBZ0IsYUFBYSxXQUFXLEdBQUc7QUFDL0Msa0JBQVUscUJBQXFCLElBQUksaUJBQStCO0FBQUEsTUFDbkUsV0FBVyx3QkFBd0IsWUFBWSxHQUFHO0FBQ2pELGtCQUFVLHFCQUFxQixJQUFJLDRCQUFvQztBQUFBLE1BQ3hFLFdBQVcsaUJBQWlCLHFCQUFxQixJQUFJLGlCQUErQixLQUFLLGlCQUFpQixxQkFBcUIsSUFBSSw0QkFBb0MsR0FBRztBQUN6SyxrQkFBVTtBQUFBLE1BQ1g7QUFDQSxVQUFJLENBQUMsU0FBUztBQUNiLGVBQU87QUFBQSxNQUNSO0FBSUEsNEJBQXNCLFNBQVMsVUFBVSxLQUFLO0FBRTlDLGdCQUFVLENBQUMsR0FBRyxPQUFPO0FBQ3JCLGNBQVEsUUFBUSxTQUFTLENBQUMsSUFBSSxPQUFPLFFBQVEsUUFBUSxTQUFTLENBQUMsR0FBRyxPQUFPO0FBQ3pFLGFBQU8sRUFBRSxTQUFTLFNBQVM7QUFBQSxJQUM1QjtBQUFBLElBQ0EsS0FBSyxRQUFRO0FBQ1osVUFBSSxDQUFDLGdCQUFnQixtQkFBbUIsWUFBWSxHQUFHO0FBQ3RELGtCQUFVLHFCQUFxQixJQUFJLGlCQUErQjtBQUFBLE1BQ25FLFdBQVcsaUJBQWlCLFlBQVksR0FBRztBQUMxQyxrQkFBVSxxQkFBcUIsSUFBSSw0QkFBb0M7QUFBQSxNQUN4RTtBQUNBLFVBQUksQ0FBQyxTQUFTO0FBQ2IsZUFBTztBQUFBLE1BQ1I7QUFDQSxVQUFJLFFBQVEsaUJBQWlCLGdCQUFnQjtBQUM1QyxpQkFBUyxnQkFBZ0IsSUFBSTtBQUFBLE1BQzlCO0FBQ0EsZ0JBQVUsQ0FBQyxHQUFHLE9BQU87QUFDckIsY0FBUSxRQUFRLFNBQVMsQ0FBQyxJQUFJLE9BQU8sUUFBUSxRQUFRLFNBQVMsQ0FBQyxHQUFHLFNBQVMsRUFBRTtBQUM3RSxlQUFTLGVBQWUsSUFBSSxlQUFlLFlBQVksV0FBVyxNQUFNO0FBQ3hFLGFBQU8sRUFBRSxTQUFTLFNBQVM7QUFBQSxJQUM1QjtBQUFBLElBQ0EsS0FBSyxPQUFPO0FBQ1gsVUFBSSxDQUFDLGdCQUFnQixhQUFhLFdBQVcsR0FBRztBQUMvQyxrQkFBVSxxQkFBcUIsSUFBSSxlQUE4QjtBQUFBLE1BQ2xFLFdBQVcsd0JBQXdCLFlBQVksR0FBRztBQUNqRCxrQkFBVSxxQkFBcUIsSUFBSSwwQkFBbUM7QUFDdEUsOEJBQXNCLFNBQVMsVUFBVSxLQUFLO0FBQUEsTUFDL0MsV0FBVyxpQkFBaUIscUJBQXFCLElBQUksZUFBOEIsS0FBSyxpQkFBaUIscUJBQXFCLElBQUksMEJBQW1DLEdBQUc7QUFDdkssa0JBQVU7QUFBQSxNQUNYO0FBQ0EsVUFBSSxDQUFDLFNBQVM7QUFDYixlQUFPO0FBQUEsTUFDUjtBQUNBLGdCQUFVLENBQUMsR0FBRyxPQUFPO0FBQ3JCLGNBQVEsUUFBUSxTQUFTLENBQUMsSUFBSSxPQUFPLFFBQVEsUUFBUSxTQUFTLENBQUMsR0FBRyxPQUFPO0FBR3pFLFVBQUk7QUFDSixVQUFJO0FBQ0gsbUJBQVcsR0FBRyxTQUFTLEVBQUU7QUFBQSxNQUMxQixRQUFRO0FBQ1AsbUJBQVc7QUFBQSxNQUNaO0FBR0EsWUFBTSxhQUFhLGFBQWEsR0FBRyxPQUFPLENBQUM7QUFDM0MsWUFBTSxVQUFVLEtBQUssS0FBSyxZQUFZLEdBQUcsUUFBUSxJQUFJLGVBQWUsZUFBZSxNQUFNO0FBUXpGLFVBQUksQ0FBQyxlQUFlO0FBRW5CLFlBQUk7QUFDSCxnQkFBTSxhQUFhLFVBQVUsS0FBSztBQUNsQyxnQkFBTSxXQUFXLFNBQVMsR0FBTTtBQUFBLFFBQ2pDLFNBQVMsS0FBSztBQUNiLGNBQUksSUFBSSxRQUFRLFNBQVMsUUFBUSxHQUFHO0FBQ25DLGdCQUFJO0FBQ0gsd0JBQVUsT0FBTztBQUFBLFlBQ2xCLFNBQVNBLE1BQUs7QUFDYix5QkFBVyxNQUFNLCtCQUErQixPQUFPLEtBQUtBLElBQUcsRUFBRTtBQUNqRSxxQkFBTztBQUFBLFlBQ1I7QUFDQSxnQkFBSTtBQUNILG9CQUFNLGFBQWEsVUFBVSxLQUFLO0FBQ2xDLG9CQUFNLFdBQVcsU0FBUyxHQUFNO0FBQUEsWUFDakMsUUFBUTtBQUNQLHlCQUFXLE1BQU0sK0JBQStCLE9BQU8sS0FBSyxHQUFHLEVBQUU7QUFDakUscUJBQU87QUFBQSxZQUNSO0FBQUEsVUFDRDtBQUNBLHFCQUFXLE1BQU0sK0JBQStCLE9BQU8sS0FBSyxHQUFHLEVBQUU7QUFDakUsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUNBLGVBQVMsU0FBUyxJQUFJO0FBQ3RCLFlBQU0sY0FBYyxLQUFLLFdBQVcsR0FBRyxRQUFRLEtBQUs7QUFDcEQsZUFBUyxjQUFjLElBQUk7QUFDM0IsWUFBTSxjQUErRCxDQUFDO0FBQ3RFLGtCQUFZLEtBQUs7QUFBQSxRQUNoQixRQUFRLEtBQUssS0FBSyxTQUFTLDBFQUEwRTtBQUFBLFFBQ3JHLE1BQU0sS0FBSyxLQUFLLFNBQVMsUUFBUTtBQUFBLE1BQ2xDLENBQUM7QUFDRCxrQkFBWSxLQUFLO0FBQUEsUUFDaEIsUUFBUSxLQUFLLEtBQUssU0FBUywrRUFBK0U7QUFBQSxRQUMxRyxNQUFNLEtBQUssS0FBSyxTQUFTLFdBQVc7QUFBQSxNQUNyQyxDQUFDO0FBQ0Qsa0JBQVksS0FBSztBQUFBLFFBQ2hCLFFBQVEsS0FBSyxLQUFLLFNBQVMsMkVBQTJFO0FBQUEsUUFDdEcsTUFBTSxLQUFLLEtBQUssU0FBUyxTQUFTO0FBQUEsTUFDbkMsQ0FBQztBQUNELGtCQUFZLEtBQUs7QUFBQSxRQUNoQixRQUFRLEtBQUssS0FBSyxTQUFTLDZFQUE2RTtBQUFBLFFBQ3hHLE1BQU0sS0FBSyxLQUFLLFNBQVMsU0FBUztBQUFBLE1BQ25DLENBQUM7QUFDRCxhQUFPLEVBQUUsU0FBUyxVQUFVLFlBQVk7QUFBQSxJQUN6QztBQUFBLEVBQ0Q7QUFDQSxhQUFXLEtBQUssdURBQXVELGtCQUFrQixVQUFVLGNBQWMsa0JBQWtCLElBQUk7QUFDdkksU0FBTztBQUNSO0FBY0EsU0FBUyxzQkFBc0IsU0FBa0MsVUFBK0IsT0FBcUI7QUFDcEgsT0FBSyxlQUFlLFVBQVUsV0FBVyxRQUFRLGdDQUFnQztBQUVoRixVQUFNLGVBQWUsMENBQTBDLFFBQVEsOEJBQThCO0FBQ3JHLFVBQU0sU0FBUyxJQUFJLG9DQUFvQyxZQUFZO0FBR25FLFVBQU0sWUFBWSxPQUFPLGVBQWUsRUFBRSxpQkFBaUIsUUFBUSxnQkFBZ0IsQ0FBQyxFQUFFLElBQUksTUFBTTtBQUNoRyxVQUFNLGdCQUEwQixDQUFDO0FBQ2pDLFFBQUksV0FBVztBQUNkLGlCQUFXLFdBQVcsV0FBVztBQUNoQyxZQUFJLFFBQVEsU0FBUywrQkFBK0IsU0FBUztBQUM1RCx3QkFBYyxLQUFLLFFBQVEsS0FBSztBQUFBLFFBQ2pDO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxRQUFJLGNBQWMsU0FBUyxHQUFHO0FBQzdCLGVBQVMsb0JBQW9CLElBQUksY0FBYyxLQUFLLEVBQUU7QUFBQSxJQUN2RDtBQUFBLEVBQ0Q7QUFDRDtBQUVBLElBQUssNkJBQUwsa0JBQUtDLGdDQUFMO0FBQ0MsRUFBQUEsNEJBQUEsaUJBQWM7QUFDZCxFQUFBQSw0QkFBQSxzQkFBbUI7QUFDbkIsRUFBQUEsNEJBQUEsVUFBTztBQUNQLEVBQUFBLDRCQUFBLGVBQVk7QUFDWixFQUFBQSw0QkFBQSxTQUFNO0FBQ04sRUFBQUEsNEJBQUEsY0FBVztBQUNYLEVBQUFBLDRCQUFBLFVBQU87QUFDUCxFQUFBQSw0QkFBQSxVQUFPO0FBQ1AsRUFBQUEsNEJBQUEsZUFBWTtBQVRSLFNBQUFBO0FBQUEsR0FBQTtBQVlMLE1BQU0sdUJBQWtFLG9CQUFJLElBQUk7QUFFaEYscUJBQXFCLElBQUksa0NBQXdDLENBQUMsV0FBVyxZQUFZLDJHQUE2RyxDQUFDO0FBQ3ZNLHFCQUFxQixJQUFJLDZDQUE2QyxDQUFDLE1BQU0sV0FBVyxZQUFZLDJHQUE2RyxDQUFDO0FBQ2xOLHFCQUFxQixJQUFJLG1CQUFpQyxDQUFDLFdBQVcsWUFBWSxrRkFBa0YsQ0FBQztBQUNySyxxQkFBcUIsSUFBSSw4QkFBc0MsQ0FBQyxNQUFNLFdBQVcsWUFBWSwrRUFBK0UsQ0FBQztBQUM3SyxxQkFBcUIsSUFBSSxpQkFBZ0MsQ0FBQyxJQUFJLENBQUM7QUFDL0QscUJBQXFCLElBQUksNEJBQXFDLENBQUMsS0FBSyxDQUFDO0FBQ3JFLHFCQUFxQixJQUFJLG1CQUFpQyxDQUFDLGVBQWUsK0VBQStFLENBQUM7QUFDMUoscUJBQXFCLElBQUksbUJBQWlDLENBQUMsa0JBQWtCLHFGQUFxRixDQUFDO0FBQ25LLHFCQUFxQixJQUFJLDhCQUFzQyxDQUFDLE1BQU0sa0JBQWtCLHFGQUFxRixDQUFDO0FBQzlLLE1BQU0sZ0JBQWdCLENBQUMsVUFBVSxJQUFJO0FBQ3JDLE1BQU0sY0FBYyxDQUFDLFdBQVcsSUFBSTtBQUNwQyxNQUFNLG9CQUFvQixDQUFDLE1BQU0sZUFBZTtBQUNoRCxNQUFNLGtCQUFrQixDQUFDLFFBQVEsU0FBUztBQUUxQyxTQUFTLGlCQUFpQixjQUEwQztBQUNuRSxNQUFJLE9BQU8saUJBQWlCLFVBQVU7QUFDckMsV0FBTyxjQUFjLFNBQVMsYUFBYSxZQUFZLENBQUM7QUFBQSxFQUN6RCxPQUFPO0FBQ04sV0FBTyxhQUFhLFdBQVcsS0FBSyxjQUFjLFNBQVMsYUFBYSxDQUFDLEVBQUUsWUFBWSxDQUFDLEtBQ3RGLGFBQWEsV0FBVyxNQUNyQixjQUFjLFNBQVMsYUFBYSxDQUFDLEVBQUUsWUFBWSxDQUFDLEtBQU0sY0FBYyxTQUFTLGFBQWEsQ0FBQyxFQUFFLFlBQVksQ0FBQyxPQUM1RyxnQkFBZ0IsU0FBUyxhQUFhLENBQUMsRUFBRSxZQUFZLENBQUMsS0FBTSxnQkFBZ0IsU0FBUyxhQUFhLENBQUMsRUFBRSxZQUFZLENBQUM7QUFBQSxFQUMxSDtBQUNEO0FBRUEsU0FBUyxtQkFBbUIsY0FBMEM7QUFDckUsTUFBSSxPQUFPLGlCQUFpQixVQUFVO0FBQ3JDLFdBQU8sZ0JBQWdCLFNBQVMsYUFBYSxZQUFZLENBQUM7QUFBQSxFQUMzRCxPQUFPO0FBQ04sV0FBTyxhQUFhLFdBQVcsS0FBSyxjQUFjLFdBQVcsS0FBSyxnQkFBZ0IsU0FBUyxhQUFhLENBQUMsRUFBRSxZQUFZLENBQUM7QUFBQSxFQUN6SDtBQUNEO0FBRUEsU0FBUyx3QkFBd0IsY0FBMEM7QUFDMUUsTUFBSSxPQUFPLGlCQUFpQixVQUFVO0FBQ3JDLG1CQUFlLGFBQWEsT0FBTyxTQUFPLENBQUMsa0JBQWtCLFNBQVMsSUFBSSxZQUFZLENBQUMsQ0FBQztBQUFBLEVBQ3pGO0FBQ0EsU0FBTyxpQkFBaUIsWUFBWSxZQUFZLFNBQVMsYUFBYSxZQUFZLENBQUMsS0FDL0UsT0FBTyxpQkFBaUIsWUFBWSxhQUFhLFdBQVcsS0FBSyxZQUFZLFNBQVMsYUFBYSxDQUFDLEVBQUUsWUFBWSxDQUFDO0FBQ3hIOyIsCiAgIm5hbWVzIjogWyJlcnIiLCAiU2hlbGxJbnRlZ3JhdGlvbkV4ZWN1dGFibGUiXQp9Cg==
