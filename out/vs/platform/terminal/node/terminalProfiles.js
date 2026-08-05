import * as fs from "fs";
import * as cp from "child_process";
import { Codicon } from "../../../base/common/codicons.js";
import { basename, delimiter, normalize } from "../../../base/common/path.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { findExecutable } from "../../../base/node/processes.js";
import { isString } from "../../../base/common/types.js";
import * as pfs from "../../../base/node/pfs.js";
import { enumeratePowerShellInstallations } from "../../../base/node/powershell.js";
import { ProfileSource, TerminalSettingId } from "../common/terminal.js";
import { getWindowsBuildNumber } from "./terminalEnvironment.js";
import { dirname, resolve } from "path";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2["UnixShellsPath"] = "/etc/shells";
  return Constants2;
})(Constants || {});
let profileSources;
let logIfWslNotInstalled = true;
function detectAvailableProfiles(profiles, defaultProfile, includeDetectedProfiles, configurationService, shellEnv = process.env, fsProvider, logService, variableResolver, testPwshSourcePaths) {
  fsProvider = fsProvider || {
    existsFile: pfs.SymlinkSupport.existsFile,
    readFile: fs.promises.readFile
  };
  if (isWindows) {
    return detectAvailableWindowsProfiles(
      includeDetectedProfiles,
      fsProvider,
      shellEnv,
      logService,
      configurationService.getValue(TerminalSettingId.UseWslProfiles) !== false,
      profiles && typeof profiles === "object" ? { ...profiles } : configurationService.getValue(TerminalSettingId.ProfilesWindows),
      typeof defaultProfile === "string" ? defaultProfile : configurationService.getValue(TerminalSettingId.DefaultProfileWindows),
      testPwshSourcePaths,
      variableResolver
    );
  }
  return detectAvailableUnixProfiles(
    fsProvider,
    logService,
    includeDetectedProfiles,
    profiles && typeof profiles === "object" ? { ...profiles } : configurationService.getValue(isLinux ? TerminalSettingId.ProfilesLinux : TerminalSettingId.ProfilesMacOs),
    typeof defaultProfile === "string" ? defaultProfile : configurationService.getValue(isLinux ? TerminalSettingId.DefaultProfileLinux : TerminalSettingId.DefaultProfileMacOs),
    testPwshSourcePaths,
    variableResolver,
    shellEnv
  );
}
async function detectAvailableWindowsProfiles(includeDetectedProfiles, fsProvider, shellEnv, logService, useWslProfiles, configProfiles, defaultProfileName, testPwshSourcePaths, variableResolver) {
  const is32ProcessOn64Windows = process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432");
  const system32Path = `${process.env["windir"]}\\${is32ProcessOn64Windows ? "Sysnative" : "System32"}`;
  let useWSLexe = false;
  if (getWindowsBuildNumber() >= 16299) {
    useWSLexe = true;
  }
  await initializeWindowsProfiles(testPwshSourcePaths);
  const detectedProfiles = /* @__PURE__ */ new Map();
  if (includeDetectedProfiles) {
    detectedProfiles.set("PowerShell", {
      source: ProfileSource.Pwsh,
      icon: Codicon.terminalPowershell,
      isAutoDetected: true
    });
    detectedProfiles.set("Windows PowerShell", {
      path: `${system32Path}\\WindowsPowerShell\\v1.0\\powershell.exe`,
      icon: Codicon.terminalPowershell,
      isAutoDetected: true
    });
    detectedProfiles.set("Git Bash", {
      source: ProfileSource.GitBash,
      isAutoDetected: true
    });
    detectedProfiles.set("Command Prompt", {
      path: `${system32Path}\\cmd.exe`,
      icon: Codicon.terminalCmd,
      isAutoDetected: true
    });
    detectedProfiles.set("Cygwin", {
      path: [
        { path: `${process.env["HOMEDRIVE"]}\\cygwin64\\bin\\bash.exe`, isUnsafe: true },
        { path: `${process.env["HOMEDRIVE"]}\\cygwin\\bin\\bash.exe`, isUnsafe: true }
      ],
      args: ["--login"],
      isAutoDetected: true
    });
    detectedProfiles.set("bash (MSYS2)", {
      path: [
        { path: `${process.env["HOMEDRIVE"]}\\msys64\\usr\\bin\\bash.exe`, isUnsafe: true }
      ],
      args: ["--login", "-i"],
      // CHERE_INVOKING retains current working directory
      env: { CHERE_INVOKING: "1" },
      icon: Codicon.terminalBash,
      isAutoDetected: true
    });
    const cmderPath = `${process.env["CMDER_ROOT"] || `${process.env["HOMEDRIVE"]}\\cmder`}\\vendor\\bin\\vscode_init.cmd`;
    detectedProfiles.set("Cmder", {
      path: `${system32Path}\\cmd.exe`,
      args: ["/K", cmderPath],
      // The path is safe if it was derived from CMDER_ROOT
      requiresPath: process.env["CMDER_ROOT"] ? cmderPath : { path: cmderPath, isUnsafe: true },
      isAutoDetected: true
    });
  }
  applyConfigProfilesToMap(configProfiles, detectedProfiles);
  const resultProfiles = await transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName, fsProvider, shellEnv, logService, variableResolver);
  if (includeDetectedProfiles && useWslProfiles) {
    try {
      const result = await getWslProfiles(`${system32Path}\\${useWSLexe ? "wsl" : "bash"}.exe`, defaultProfileName);
      for (const wslProfile of result) {
        if (!configProfiles || !(wslProfile.profileName in configProfiles)) {
          resultProfiles.push(wslProfile);
        }
      }
    } catch (e) {
      if (logIfWslNotInstalled) {
        logService?.trace("WSL is not installed, so could not detect WSL profiles");
        logIfWslNotInstalled = false;
      }
    }
  }
  return resultProfiles;
}
async function transformToTerminalProfiles(entries, defaultProfileName, fsProvider, shellEnv = process.env, logService, variableResolver) {
  const promises = [];
  for (const [profileName, profile] of entries) {
    promises.push(getValidatedProfile(profileName, profile, defaultProfileName, fsProvider, shellEnv, logService, variableResolver));
  }
  return (await Promise.all(promises)).filter((e) => !!e);
}
async function getValidatedProfile(profileName, profile, defaultProfileName, fsProvider, shellEnv = process.env, logService, variableResolver) {
  if (profile === null) {
    return void 0;
  }
  let originalPaths;
  let args;
  let icon = void 0;
  if ("source" in profile && !("path" in profile)) {
    const source = profileSources?.get(profile.source);
    if (!source) {
      return void 0;
    }
    originalPaths = source.paths;
    args = profile.args || source.args;
    if (profile.icon) {
      icon = validateIcon(profile.icon);
    } else if (source.icon) {
      icon = source.icon;
    }
  } else {
    originalPaths = Array.isArray(profile.path) ? profile.path : [profile.path];
    args = isWindows ? profile.args : Array.isArray(profile.args) ? profile.args : void 0;
    icon = validateIcon(profile.icon);
  }
  let paths;
  if (variableResolver) {
    const mapped = originalPaths.map((e) => typeof e === "string" ? e : e.path);
    const resolved = await variableResolver(mapped);
    paths = new Array(originalPaths.length);
    for (let i = 0; i < originalPaths.length; i++) {
      if (typeof originalPaths[i] === "string") {
        paths[i] = resolved[i];
      } else {
        paths[i] = {
          path: resolved[i],
          isUnsafe: true
        };
      }
    }
  } else {
    paths = originalPaths.slice();
  }
  let requiresUnsafePath;
  if (profile.requiresPath) {
    let actualRequiredPath;
    if (isString(profile.requiresPath)) {
      actualRequiredPath = profile.requiresPath;
    } else {
      actualRequiredPath = profile.requiresPath.path;
      if (profile.requiresPath.isUnsafe) {
        requiresUnsafePath = actualRequiredPath;
      }
    }
    const result = await fsProvider.existsFile(actualRequiredPath);
    if (!result) {
      return;
    }
  }
  const validatedProfile = await validateProfilePaths(profileName, defaultProfileName, paths, fsProvider, shellEnv, args, profile.env, profile.overrideName, profile.isAutoDetected, requiresUnsafePath);
  if (!validatedProfile) {
    logService?.debug("Terminal profile not validated", profileName, originalPaths);
    return void 0;
  }
  validatedProfile.isAutoDetected = profile.isAutoDetected;
  validatedProfile.icon = icon;
  validatedProfile.color = profile.color;
  return validatedProfile;
}
function validateIcon(icon) {
  if (typeof icon === "string") {
    return { id: icon };
  }
  return icon;
}
async function initializeWindowsProfiles(testPwshSourcePaths) {
  if (profileSources && !testPwshSourcePaths) {
    return;
  }
  const [gitBashPaths, pwshPaths] = await Promise.all([getGitBashPaths(), testPwshSourcePaths || getPowershellPaths()]);
  profileSources = /* @__PURE__ */ new Map();
  profileSources.set(
    ProfileSource.GitBash,
    {
      profileName: "Git Bash",
      paths: gitBashPaths,
      args: ["--login", "-i"]
    }
  );
  profileSources.set(ProfileSource.Pwsh, {
    profileName: "PowerShell",
    paths: pwshPaths,
    icon: Codicon.terminalPowershell
  });
}
async function getGitBashPaths() {
  const gitDirs = /* @__PURE__ */ new Set();
  const gitExePath = await findExecutable("git.exe");
  if (gitExePath) {
    const gitExeDir = dirname(gitExePath);
    gitDirs.add(resolve(gitExeDir, "../.."));
  }
  function addTruthy(set, value) {
    if (value) {
      set.add(value);
    }
  }
  addTruthy(gitDirs, process.env["ProgramW6432"]);
  addTruthy(gitDirs, process.env["ProgramFiles"]);
  addTruthy(gitDirs, process.env["ProgramFiles(X86)"]);
  addTruthy(gitDirs, `${process.env["LocalAppData"]}\\Program`);
  const gitBashPaths = [];
  for (const gitDir of gitDirs) {
    gitBashPaths.push(
      `${gitDir}\\Git\\bin\\bash.exe`,
      `${gitDir}\\Git\\usr\\bin\\bash.exe`,
      `${gitDir}\\usr\\bin\\bash.exe`
      // using Git for Windows SDK
    );
  }
  gitBashPaths.push(`${process.env["UserProfile"]}\\scoop\\apps\\git\\current\\bin\\bash.exe`);
  gitBashPaths.push(`${process.env["UserProfile"]}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`);
  return gitBashPaths;
}
async function getPowershellPaths() {
  const paths = [];
  for await (const pwshExe of enumeratePowerShellInstallations()) {
    paths.push(pwshExe.exePath);
  }
  return paths;
}
async function getWslProfiles(wslPath, defaultProfileName) {
  const profiles = [];
  const distroOutput = await new Promise((resolve2, reject) => {
    cp.exec("wsl.exe -l -q", { encoding: "utf16le", timeout: 1e3 }, (err, stdout) => {
      if (err) {
        return reject("Problem occurred when getting wsl distros");
      }
      resolve2(stdout);
    });
  });
  if (!distroOutput) {
    return [];
  }
  const regex = new RegExp(/[\r?\n]/);
  const distroNames = distroOutput.split(regex).filter((t) => t.trim().length > 0 && t !== "");
  for (const distroName of distroNames) {
    if (distroName === "") {
      continue;
    }
    if (distroName.startsWith("docker-desktop")) {
      continue;
    }
    const profileName = `${distroName} (WSL)`;
    const profile = {
      profileName,
      path: wslPath,
      args: [`-d`, `${distroName}`],
      isDefault: profileName === defaultProfileName,
      icon: getWslIcon(distroName),
      isAutoDetected: false
    };
    profiles.push(profile);
  }
  return profiles;
}
function getWslIcon(distroName) {
  if (distroName.includes("Ubuntu")) {
    return Codicon.terminalUbuntu;
  } else if (distroName.includes("Debian")) {
    return Codicon.terminalDebian;
  } else {
    return Codicon.terminalLinux;
  }
}
async function detectAvailableUnixProfiles(fsProvider, logService, includeDetectedProfiles, configProfiles, defaultProfileName, testPaths, variableResolver, shellEnv) {
  const detectedProfiles = /* @__PURE__ */ new Map();
  if (includeDetectedProfiles && await fsProvider.existsFile("/etc/shells" /* UnixShellsPath */)) {
    const contents = (await fsProvider.readFile("/etc/shells" /* UnixShellsPath */)).toString();
    const profiles = (testPaths || contents.split("\n")).map((e) => {
      const index = e.indexOf("#");
      return index === -1 ? e : e.substring(0, index);
    }).filter((e) => e.trim().length > 0);
    const counts = /* @__PURE__ */ new Map();
    for (const profile of profiles) {
      let profileName = basename(profile);
      let count = counts.get(profileName) || 0;
      count++;
      if (count > 1) {
        profileName = `${profileName} (${count})`;
      }
      counts.set(profileName, count);
      detectedProfiles.set(profileName, { path: profile, isAutoDetected: true });
    }
  }
  applyConfigProfilesToMap(configProfiles, detectedProfiles);
  return await transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName, fsProvider, shellEnv, logService, variableResolver);
}
function applyConfigProfilesToMap(configProfiles, profilesMap) {
  if (!configProfiles) {
    return;
  }
  for (const [profileName, value] of Object.entries(configProfiles)) {
    if (value === null || typeof value !== "object" || !("path" in value) && !("source" in value)) {
      profilesMap.delete(profileName);
    } else {
      value.icon = value.icon || profilesMap.get(profileName)?.icon;
      profilesMap.set(profileName, value);
    }
  }
}
async function validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected, requiresUnsafePath) {
  if (potentialPaths.length === 0) {
    return Promise.resolve(void 0);
  }
  const path = potentialPaths.shift();
  if (path === "") {
    return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected);
  }
  const isUnsafePath = typeof path !== "string" && path.isUnsafe;
  const actualPath = typeof path === "string" ? path : path.path;
  const profile = {
    profileName,
    path: actualPath,
    args,
    env,
    overrideName,
    isAutoDetected,
    isDefault: profileName === defaultProfileName,
    isUnsafePath,
    requiresUnsafePath
  };
  if (basename(actualPath) === actualPath) {
    const envPaths = shellEnv.PATH ? shellEnv.PATH.split(delimiter) : void 0;
    const executable = await findExecutable(actualPath, void 0, envPaths, void 0, fsProvider.existsFile);
    if (!executable) {
      return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args);
    }
    profile.path = executable;
    profile.isFromPath = true;
    return profile;
  }
  const result = await fsProvider.existsFile(normalize(actualPath));
  if (result) {
    return profile;
  }
  return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected);
}
export {
  detectAvailableProfiles
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3Rlcm1pbmFsUHJvZmlsZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBjcCBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGVsaW1pdGVyLCBub3JtYWxpemUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGZpbmRFeGVjdXRhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Byb2Nlc3Nlcy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBwZnMgZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBlbnVtZXJhdGVQb3dlclNoZWxsSW5zdGFsbGF0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9wb3dlcnNoZWxsLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxFbnZpcm9ubWVudCwgSVRlcm1pbmFsRXhlY3V0YWJsZSwgSVRlcm1pbmFsUHJvZmlsZSwgSVRlcm1pbmFsUHJvZmlsZVNvdXJjZSwgSVRlcm1pbmFsVW5zYWZlUGF0aCwgUHJvZmlsZVNvdXJjZSwgVGVybWluYWxJY29uLCBUZXJtaW5hbFNldHRpbmdJZCB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBnZXRXaW5kb3dzQnVpbGROdW1iZXIgfSBmcm9tICcuL3Rlcm1pbmFsRW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIHJlc29sdmUgfSBmcm9tICdwYXRoJztcblxuY29uc3QgZW51bSBDb25zdGFudHMge1xuXHRVbml4U2hlbGxzUGF0aCA9ICcvZXRjL3NoZWxscydcbn1cblxubGV0IHByb2ZpbGVTb3VyY2VzOiBNYXA8c3RyaW5nLCBJUG90ZW50aWFsVGVybWluYWxQcm9maWxlPiB8IHVuZGVmaW5lZDtcbmxldCBsb2dJZldzbE5vdEluc3RhbGxlZDogYm9vbGVhbiA9IHRydWU7XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RBdmFpbGFibGVQcm9maWxlcyhcblx0cHJvZmlsZXM6IHVua25vd24sXG5cdGRlZmF1bHRQcm9maWxlOiB1bmtub3duLFxuXHRpbmNsdWRlRGV0ZWN0ZWRQcm9maWxlczogYm9vbGVhbixcblx0Y29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0c2hlbGxFbnY6IHR5cGVvZiBwcm9jZXNzLmVudiA9IHByb2Nlc3MuZW52LFxuXHRmc1Byb3ZpZGVyPzogSUZzUHJvdmlkZXIsXG5cdGxvZ1NlcnZpY2U/OiBJTG9nU2VydmljZSxcblx0dmFyaWFibGVSZXNvbHZlcj86ICh0ZXh0OiBzdHJpbmdbXSkgPT4gUHJvbWlzZTxzdHJpbmdbXT4sXG5cdHRlc3RQd3NoU291cmNlUGF0aHM/OiBzdHJpbmdbXVxuKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlW10+IHtcblx0ZnNQcm92aWRlciA9IGZzUHJvdmlkZXIgfHwge1xuXHRcdGV4aXN0c0ZpbGU6IHBmcy5TeW1saW5rU3VwcG9ydC5leGlzdHNGaWxlLFxuXHRcdHJlYWRGaWxlOiBmcy5wcm9taXNlcy5yZWFkRmlsZVxuXHR9O1xuXHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0cmV0dXJuIGRldGVjdEF2YWlsYWJsZVdpbmRvd3NQcm9maWxlcyhcblx0XHRcdGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzLFxuXHRcdFx0ZnNQcm92aWRlcixcblx0XHRcdHNoZWxsRW52LFxuXHRcdFx0bG9nU2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLlVzZVdzbFByb2ZpbGVzKSAhPT0gZmFsc2UsXG5cdFx0XHRwcm9maWxlcyAmJiB0eXBlb2YgcHJvZmlsZXMgPT09ICdvYmplY3QnID8geyAuLi5wcm9maWxlcyB9IDogY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8eyBba2V5OiBzdHJpbmddOiBJVW5yZXNvbHZlZFRlcm1pbmFsUHJvZmlsZSB9PihUZXJtaW5hbFNldHRpbmdJZC5Qcm9maWxlc1dpbmRvd3MpLFxuXHRcdFx0dHlwZW9mIGRlZmF1bHRQcm9maWxlID09PSAnc3RyaW5nJyA/IGRlZmF1bHRQcm9maWxlIDogY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPihUZXJtaW5hbFNldHRpbmdJZC5EZWZhdWx0UHJvZmlsZVdpbmRvd3MpLFxuXHRcdFx0dGVzdFB3c2hTb3VyY2VQYXRocyxcblx0XHRcdHZhcmlhYmxlUmVzb2x2ZXJcblx0XHQpO1xuXHR9XG5cdHJldHVybiBkZXRlY3RBdmFpbGFibGVVbml4UHJvZmlsZXMoXG5cdFx0ZnNQcm92aWRlcixcblx0XHRsb2dTZXJ2aWNlLFxuXHRcdGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzLFxuXHRcdHByb2ZpbGVzICYmIHR5cGVvZiBwcm9maWxlcyA9PT0gJ29iamVjdCcgPyB7IC4uLnByb2ZpbGVzIH0gOiBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTx7IFtrZXk6IHN0cmluZ106IElVbnJlc29sdmVkVGVybWluYWxQcm9maWxlIH0+KGlzTGludXggPyBUZXJtaW5hbFNldHRpbmdJZC5Qcm9maWxlc0xpbnV4IDogVGVybWluYWxTZXR0aW5nSWQuUHJvZmlsZXNNYWNPcyksXG5cdFx0dHlwZW9mIGRlZmF1bHRQcm9maWxlID09PSAnc3RyaW5nJyA/IGRlZmF1bHRQcm9maWxlIDogY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPihpc0xpbnV4ID8gVGVybWluYWxTZXR0aW5nSWQuRGVmYXVsdFByb2ZpbGVMaW51eCA6IFRlcm1pbmFsU2V0dGluZ0lkLkRlZmF1bHRQcm9maWxlTWFjT3MpLFxuXHRcdHRlc3RQd3NoU291cmNlUGF0aHMsXG5cdFx0dmFyaWFibGVSZXNvbHZlcixcblx0XHRzaGVsbEVudlxuXHQpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBkZXRlY3RBdmFpbGFibGVXaW5kb3dzUHJvZmlsZXMoXG5cdGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzOiBib29sZWFuLFxuXHRmc1Byb3ZpZGVyOiBJRnNQcm92aWRlcixcblx0c2hlbGxFbnY6IHR5cGVvZiBwcm9jZXNzLmVudixcblx0bG9nU2VydmljZT86IElMb2dTZXJ2aWNlLFxuXHR1c2VXc2xQcm9maWxlcz86IGJvb2xlYW4sXG5cdGNvbmZpZ1Byb2ZpbGVzPzogeyBba2V5OiBzdHJpbmddOiBJVW5yZXNvbHZlZFRlcm1pbmFsUHJvZmlsZSB9LFxuXHRkZWZhdWx0UHJvZmlsZU5hbWU/OiBzdHJpbmcsXG5cdHRlc3RQd3NoU291cmNlUGF0aHM/OiBzdHJpbmdbXSxcblx0dmFyaWFibGVSZXNvbHZlcj86ICh0ZXh0OiBzdHJpbmdbXSkgPT4gUHJvbWlzZTxzdHJpbmdbXT5cbik6IFByb21pc2U8SVRlcm1pbmFsUHJvZmlsZVtdPiB7XG5cdC8vIERldGVybWluZSB0aGUgY29ycmVjdCBTeXN0ZW0zMiBwYXRoLiBXZSB3YW50IHRvIHBvaW50IHRvIFN5c25hdGl2ZVxuXHQvLyB3aGVuIHRoZSAzMi1iaXQgdmVyc2lvbiBvZiBWUyBDb2RlIGlzIHJ1bm5pbmcgb24gYSA2NC1iaXQgbWFjaGluZS5cblx0Ly8gVGhlIHJlYXNvbiBmb3IgdGhpcyBpcyBiZWNhdXNlIFBvd2VyU2hlbGwncyBpbXBvcnRhbnQgUFNSZWFkbGluZVxuXHQvLyBtb2R1bGUgZG9lc24ndCB3b3JrIGlmIHRoaXMgaXMgbm90IHRoZSBjYXNlLiBTZWUgIzI3OTE1LlxuXHRjb25zdCBpczMyUHJvY2Vzc09uNjRXaW5kb3dzID0gcHJvY2Vzcy5lbnYuaGFzT3duUHJvcGVydHkoJ1BST0NFU1NPUl9BUkNISVRFVzY0MzInKTtcblx0Y29uc3Qgc3lzdGVtMzJQYXRoID0gYCR7cHJvY2Vzcy5lbnZbJ3dpbmRpciddfVxcXFwke2lzMzJQcm9jZXNzT242NFdpbmRvd3MgPyAnU3lzbmF0aXZlJyA6ICdTeXN0ZW0zMid9YDtcblxuXHRsZXQgdXNlV1NMZXhlID0gZmFsc2U7XG5cblx0aWYgKGdldFdpbmRvd3NCdWlsZE51bWJlcigpID49IDE2Mjk5KSB7XG5cdFx0dXNlV1NMZXhlID0gdHJ1ZTtcblx0fVxuXG5cdGF3YWl0IGluaXRpYWxpemVXaW5kb3dzUHJvZmlsZXModGVzdFB3c2hTb3VyY2VQYXRocyk7XG5cblx0Y29uc3QgZGV0ZWN0ZWRQcm9maWxlczogTWFwPHN0cmluZywgSVVucmVzb2x2ZWRUZXJtaW5hbFByb2ZpbGU+ID0gbmV3IE1hcCgpO1xuXG5cdC8vIEFkZCBhdXRvIGRldGVjdGVkIHByb2ZpbGVzXG5cdGlmIChpbmNsdWRlRGV0ZWN0ZWRQcm9maWxlcykge1xuXHRcdGRldGVjdGVkUHJvZmlsZXMuc2V0KCdQb3dlclNoZWxsJywge1xuXHRcdFx0c291cmNlOiBQcm9maWxlU291cmNlLlB3c2gsXG5cdFx0XHRpY29uOiBDb2RpY29uLnRlcm1pbmFsUG93ZXJzaGVsbCxcblx0XHRcdGlzQXV0b0RldGVjdGVkOiB0cnVlXG5cdFx0fSk7XG5cdFx0ZGV0ZWN0ZWRQcm9maWxlcy5zZXQoJ1dpbmRvd3MgUG93ZXJTaGVsbCcsIHtcblx0XHRcdHBhdGg6IGAke3N5c3RlbTMyUGF0aH1cXFxcV2luZG93c1Bvd2VyU2hlbGxcXFxcdjEuMFxcXFxwb3dlcnNoZWxsLmV4ZWAsXG5cdFx0XHRpY29uOiBDb2RpY29uLnRlcm1pbmFsUG93ZXJzaGVsbCxcblx0XHRcdGlzQXV0b0RldGVjdGVkOiB0cnVlXG5cdFx0fSk7XG5cdFx0ZGV0ZWN0ZWRQcm9maWxlcy5zZXQoJ0dpdCBCYXNoJywge1xuXHRcdFx0c291cmNlOiBQcm9maWxlU291cmNlLkdpdEJhc2gsXG5cdFx0XHRpc0F1dG9EZXRlY3RlZDogdHJ1ZVxuXHRcdH0pO1xuXHRcdGRldGVjdGVkUHJvZmlsZXMuc2V0KCdDb21tYW5kIFByb21wdCcsIHtcblx0XHRcdHBhdGg6IGAke3N5c3RlbTMyUGF0aH1cXFxcY21kLmV4ZWAsXG5cdFx0XHRpY29uOiBDb2RpY29uLnRlcm1pbmFsQ21kLFxuXHRcdFx0aXNBdXRvRGV0ZWN0ZWQ6IHRydWVcblx0XHR9KTtcblx0XHRkZXRlY3RlZFByb2ZpbGVzLnNldCgnQ3lnd2luJywge1xuXHRcdFx0cGF0aDogW1xuXHRcdFx0XHR7IHBhdGg6IGAke3Byb2Nlc3MuZW52WydIT01FRFJJVkUnXX1cXFxcY3lnd2luNjRcXFxcYmluXFxcXGJhc2guZXhlYCwgaXNVbnNhZmU6IHRydWUgfSxcblx0XHRcdFx0eyBwYXRoOiBgJHtwcm9jZXNzLmVudlsnSE9NRURSSVZFJ119XFxcXGN5Z3dpblxcXFxiaW5cXFxcYmFzaC5leGVgLCBpc1Vuc2FmZTogdHJ1ZSB9XG5cdFx0XHRdLFxuXHRcdFx0YXJnczogWyctLWxvZ2luJ10sXG5cdFx0XHRpc0F1dG9EZXRlY3RlZDogdHJ1ZVxuXHRcdH0pO1xuXHRcdGRldGVjdGVkUHJvZmlsZXMuc2V0KCdiYXNoIChNU1lTMiknLCB7XG5cdFx0XHRwYXRoOiBbXG5cdFx0XHRcdHsgcGF0aDogYCR7cHJvY2Vzcy5lbnZbJ0hPTUVEUklWRSddfVxcXFxtc3lzNjRcXFxcdXNyXFxcXGJpblxcXFxiYXNoLmV4ZWAsIGlzVW5zYWZlOiB0cnVlIH0sXG5cdFx0XHRdLFxuXHRcdFx0YXJnczogWyctLWxvZ2luJywgJy1pJ10sXG5cdFx0XHQvLyBDSEVSRV9JTlZPS0lORyByZXRhaW5zIGN1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnlcblx0XHRcdGVudjogeyBDSEVSRV9JTlZPS0lORzogJzEnIH0sXG5cdFx0XHRpY29uOiBDb2RpY29uLnRlcm1pbmFsQmFzaCxcblx0XHRcdGlzQXV0b0RldGVjdGVkOiB0cnVlXG5cdFx0fSk7XG5cdFx0Y29uc3QgY21kZXJQYXRoID0gYCR7cHJvY2Vzcy5lbnZbJ0NNREVSX1JPT1QnXSB8fCBgJHtwcm9jZXNzLmVudlsnSE9NRURSSVZFJ119XFxcXGNtZGVyYH1cXFxcdmVuZG9yXFxcXGJpblxcXFx2c2NvZGVfaW5pdC5jbWRgO1xuXHRcdGRldGVjdGVkUHJvZmlsZXMuc2V0KCdDbWRlcicsIHtcblx0XHRcdHBhdGg6IGAke3N5c3RlbTMyUGF0aH1cXFxcY21kLmV4ZWAsXG5cdFx0XHRhcmdzOiBbJy9LJywgY21kZXJQYXRoXSxcblx0XHRcdC8vIFRoZSBwYXRoIGlzIHNhZmUgaWYgaXQgd2FzIGRlcml2ZWQgZnJvbSBDTURFUl9ST09UXG5cdFx0XHRyZXF1aXJlc1BhdGg6IHByb2Nlc3MuZW52WydDTURFUl9ST09UJ10gPyBjbWRlclBhdGggOiB7IHBhdGg6IGNtZGVyUGF0aCwgaXNVbnNhZmU6IHRydWUgfSxcblx0XHRcdGlzQXV0b0RldGVjdGVkOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRhcHBseUNvbmZpZ1Byb2ZpbGVzVG9NYXAoY29uZmlnUHJvZmlsZXMsIGRldGVjdGVkUHJvZmlsZXMpO1xuXG5cdGNvbnN0IHJlc3VsdFByb2ZpbGVzOiBJVGVybWluYWxQcm9maWxlW10gPSBhd2FpdCB0cmFuc2Zvcm1Ub1Rlcm1pbmFsUHJvZmlsZXMoZGV0ZWN0ZWRQcm9maWxlcy5lbnRyaWVzKCksIGRlZmF1bHRQcm9maWxlTmFtZSwgZnNQcm92aWRlciwgc2hlbGxFbnYsIGxvZ1NlcnZpY2UsIHZhcmlhYmxlUmVzb2x2ZXIpO1xuXG5cdGlmIChpbmNsdWRlRGV0ZWN0ZWRQcm9maWxlcyAmJiB1c2VXc2xQcm9maWxlcykge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBnZXRXc2xQcm9maWxlcyhgJHtzeXN0ZW0zMlBhdGh9XFxcXCR7dXNlV1NMZXhlID8gJ3dzbCcgOiAnYmFzaCd9LmV4ZWAsIGRlZmF1bHRQcm9maWxlTmFtZSk7XG5cdFx0XHRmb3IgKGNvbnN0IHdzbFByb2ZpbGUgb2YgcmVzdWx0KSB7XG5cdFx0XHRcdGlmICghY29uZmlnUHJvZmlsZXMgfHwgISh3c2xQcm9maWxlLnByb2ZpbGVOYW1lIGluIGNvbmZpZ1Byb2ZpbGVzKSkge1xuXHRcdFx0XHRcdHJlc3VsdFByb2ZpbGVzLnB1c2god3NsUHJvZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAobG9nSWZXc2xOb3RJbnN0YWxsZWQpIHtcblx0XHRcdFx0bG9nU2VydmljZT8udHJhY2UoJ1dTTCBpcyBub3QgaW5zdGFsbGVkLCBzbyBjb3VsZCBub3QgZGV0ZWN0IFdTTCBwcm9maWxlcycpO1xuXHRcdFx0XHRsb2dJZldzbE5vdEluc3RhbGxlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXN1bHRQcm9maWxlcztcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJhbnNmb3JtVG9UZXJtaW5hbFByb2ZpbGVzKFxuXHRlbnRyaWVzOiBJdGVyYWJsZUl0ZXJhdG9yPFtzdHJpbmcsIElVbnJlc29sdmVkVGVybWluYWxQcm9maWxlXT4sXG5cdGRlZmF1bHRQcm9maWxlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRmc1Byb3ZpZGVyOiBJRnNQcm92aWRlcixcblx0c2hlbGxFbnY6IHR5cGVvZiBwcm9jZXNzLmVudiA9IHByb2Nlc3MuZW52LFxuXHRsb2dTZXJ2aWNlPzogSUxvZ1NlcnZpY2UsXG5cdHZhcmlhYmxlUmVzb2x2ZXI/OiAodGV4dDogc3RyaW5nW10pID0+IFByb21pc2U8c3RyaW5nW10+LFxuKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlW10+IHtcblx0Y29uc3QgcHJvbWlzZXM6IFByb21pc2U8SVRlcm1pbmFsUHJvZmlsZSB8IHVuZGVmaW5lZD5bXSA9IFtdO1xuXHRmb3IgKGNvbnN0IFtwcm9maWxlTmFtZSwgcHJvZmlsZV0gb2YgZW50cmllcykge1xuXHRcdHByb21pc2VzLnB1c2goZ2V0VmFsaWRhdGVkUHJvZmlsZShwcm9maWxlTmFtZSwgcHJvZmlsZSwgZGVmYXVsdFByb2ZpbGVOYW1lLCBmc1Byb3ZpZGVyLCBzaGVsbEVudiwgbG9nU2VydmljZSwgdmFyaWFibGVSZXNvbHZlcikpO1xuXHR9XG5cdHJldHVybiAoYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpKS5maWx0ZXIoZSA9PiAhIWUpIGFzIElUZXJtaW5hbFByb2ZpbGVbXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0VmFsaWRhdGVkUHJvZmlsZShcblx0cHJvZmlsZU5hbWU6IHN0cmluZyxcblx0cHJvZmlsZTogSVVucmVzb2x2ZWRUZXJtaW5hbFByb2ZpbGUsXG5cdGRlZmF1bHRQcm9maWxlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRmc1Byb3ZpZGVyOiBJRnNQcm92aWRlcixcblx0c2hlbGxFbnY6IHR5cGVvZiBwcm9jZXNzLmVudiA9IHByb2Nlc3MuZW52LFxuXHRsb2dTZXJ2aWNlPzogSUxvZ1NlcnZpY2UsXG5cdHZhcmlhYmxlUmVzb2x2ZXI/OiAodGV4dDogc3RyaW5nW10pID0+IFByb21pc2U8c3RyaW5nW10+XG4pOiBQcm9taXNlPElUZXJtaW5hbFByb2ZpbGUgfCB1bmRlZmluZWQ+IHtcblx0aWYgKHByb2ZpbGUgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGxldCBvcmlnaW5hbFBhdGhzOiAoc3RyaW5nIHwgSVRlcm1pbmFsVW5zYWZlUGF0aClbXTtcblx0bGV0IGFyZ3M6IHN0cmluZ1tdIHwgc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsZXQgaWNvbjogVGhlbWVJY29uIHwgVVJJIHwgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Ly8gdXNlIGNhbGN1bGF0ZWQgdmFsdWVzIGlmIHBhdGggaXMgbm90IHNwZWNpZmllZFxuXHRpZiAoJ3NvdXJjZScgaW4gcHJvZmlsZSAmJiAhKCdwYXRoJyBpbiBwcm9maWxlKSkge1xuXHRcdGNvbnN0IHNvdXJjZSA9IHByb2ZpbGVTb3VyY2VzPy5nZXQocHJvZmlsZS5zb3VyY2UpO1xuXHRcdGlmICghc291cmNlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRvcmlnaW5hbFBhdGhzID0gc291cmNlLnBhdGhzO1xuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIGNvbmZpZ3VyZWQgYXJncywgb3ZlcnJpZGUgdGhlIGRlZmF1bHQgb25lc1xuXHRcdGFyZ3MgPSBwcm9maWxlLmFyZ3MgfHwgc291cmNlLmFyZ3M7XG5cdFx0aWYgKHByb2ZpbGUuaWNvbikge1xuXHRcdFx0aWNvbiA9IHZhbGlkYXRlSWNvbihwcm9maWxlLmljb24pO1xuXHRcdH0gZWxzZSBpZiAoc291cmNlLmljb24pIHtcblx0XHRcdGljb24gPSBzb3VyY2UuaWNvbjtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0b3JpZ2luYWxQYXRocyA9IEFycmF5LmlzQXJyYXkocHJvZmlsZS5wYXRoKSA/IHByb2ZpbGUucGF0aCA6IFtwcm9maWxlLnBhdGhdO1xuXHRcdGFyZ3MgPSBpc1dpbmRvd3MgPyBwcm9maWxlLmFyZ3MgOiBBcnJheS5pc0FycmF5KHByb2ZpbGUuYXJncykgPyBwcm9maWxlLmFyZ3MgOiB1bmRlZmluZWQ7XG5cdFx0aWNvbiA9IHZhbGlkYXRlSWNvbihwcm9maWxlLmljb24pO1xuXHR9XG5cblx0bGV0IHBhdGhzOiAoc3RyaW5nIHwgSVRlcm1pbmFsVW5zYWZlUGF0aClbXTtcblx0aWYgKHZhcmlhYmxlUmVzb2x2ZXIpIHtcblx0XHQvLyBDb252ZXJ0IHRvIHN0cmluZ1tdIGZvciByZXNvbHZlXG5cdFx0Y29uc3QgbWFwcGVkID0gb3JpZ2luYWxQYXRocy5tYXAoZSA9PiB0eXBlb2YgZSA9PT0gJ3N0cmluZycgPyBlIDogZS5wYXRoKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgdmFyaWFibGVSZXNvbHZlcihtYXBwZWQpO1xuXHRcdC8vIENvbnZlcnQgcmVzb2x2ZWQgYmFjayB0byAoVCB8IHN0cmluZylbXVxuXHRcdHBhdGhzID0gbmV3IEFycmF5KG9yaWdpbmFsUGF0aHMubGVuZ3RoKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG9yaWdpbmFsUGF0aHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICh0eXBlb2Ygb3JpZ2luYWxQYXRoc1tpXSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0cGF0aHNbaV0gPSByZXNvbHZlZFtpXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBhdGhzW2ldID0ge1xuXHRcdFx0XHRcdHBhdGg6IHJlc29sdmVkW2ldLFxuXHRcdFx0XHRcdGlzVW5zYWZlOiB0cnVlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHBhdGhzID0gb3JpZ2luYWxQYXRocy5zbGljZSgpO1xuXHR9XG5cblx0bGV0IHJlcXVpcmVzVW5zYWZlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRpZiAocHJvZmlsZS5yZXF1aXJlc1BhdGgpIHtcblx0XHQvLyBWYWxpZGF0ZSByZXF1aXJlc1BhdGggZXhpc3RzXG5cdFx0bGV0IGFjdHVhbFJlcXVpcmVkUGF0aDogc3RyaW5nO1xuXHRcdGlmIChpc1N0cmluZyhwcm9maWxlLnJlcXVpcmVzUGF0aCkpIHtcblx0XHRcdGFjdHVhbFJlcXVpcmVkUGF0aCA9IHByb2ZpbGUucmVxdWlyZXNQYXRoO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY3R1YWxSZXF1aXJlZFBhdGggPSBwcm9maWxlLnJlcXVpcmVzUGF0aC5wYXRoO1xuXHRcdFx0aWYgKHByb2ZpbGUucmVxdWlyZXNQYXRoLmlzVW5zYWZlKSB7XG5cdFx0XHRcdHJlcXVpcmVzVW5zYWZlUGF0aCA9IGFjdHVhbFJlcXVpcmVkUGF0aDtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZnNQcm92aWRlci5leGlzdHNGaWxlKGFjdHVhbFJlcXVpcmVkUGF0aCk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRjb25zdCB2YWxpZGF0ZWRQcm9maWxlID0gYXdhaXQgdmFsaWRhdGVQcm9maWxlUGF0aHMocHJvZmlsZU5hbWUsIGRlZmF1bHRQcm9maWxlTmFtZSwgcGF0aHMsIGZzUHJvdmlkZXIsIHNoZWxsRW52LCBhcmdzLCBwcm9maWxlLmVudiwgcHJvZmlsZS5vdmVycmlkZU5hbWUsIHByb2ZpbGUuaXNBdXRvRGV0ZWN0ZWQsIHJlcXVpcmVzVW5zYWZlUGF0aCk7XG5cdGlmICghdmFsaWRhdGVkUHJvZmlsZSkge1xuXHRcdGxvZ1NlcnZpY2U/LmRlYnVnKCdUZXJtaW5hbCBwcm9maWxlIG5vdCB2YWxpZGF0ZWQnLCBwcm9maWxlTmFtZSwgb3JpZ2luYWxQYXRocyk7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHZhbGlkYXRlZFByb2ZpbGUuaXNBdXRvRGV0ZWN0ZWQgPSBwcm9maWxlLmlzQXV0b0RldGVjdGVkO1xuXHR2YWxpZGF0ZWRQcm9maWxlLmljb24gPSBpY29uO1xuXHR2YWxpZGF0ZWRQcm9maWxlLmNvbG9yID0gcHJvZmlsZS5jb2xvcjtcblx0cmV0dXJuIHZhbGlkYXRlZFByb2ZpbGU7XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlSWNvbihpY29uOiBzdHJpbmcgfCBUZXJtaW5hbEljb24gfCB1bmRlZmluZWQpOiBUZXJtaW5hbEljb24gfCB1bmRlZmluZWQge1xuXHRpZiAodHlwZW9mIGljb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIHsgaWQ6IGljb24gfTtcblx0fVxuXHRyZXR1cm4gaWNvbjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZVdpbmRvd3NQcm9maWxlcyh0ZXN0UHdzaFNvdXJjZVBhdGhzPzogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0aWYgKHByb2ZpbGVTb3VyY2VzICYmICF0ZXN0UHdzaFNvdXJjZVBhdGhzKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgW2dpdEJhc2hQYXRocywgcHdzaFBhdGhzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtnZXRHaXRCYXNoUGF0aHMoKSwgdGVzdFB3c2hTb3VyY2VQYXRocyB8fCBnZXRQb3dlcnNoZWxsUGF0aHMoKV0pO1xuXG5cdHByb2ZpbGVTb3VyY2VzID0gbmV3IE1hcCgpO1xuXHRwcm9maWxlU291cmNlcy5zZXQoXG5cdFx0UHJvZmlsZVNvdXJjZS5HaXRCYXNoLCB7XG5cdFx0cHJvZmlsZU5hbWU6ICdHaXQgQmFzaCcsXG5cdFx0cGF0aHM6IGdpdEJhc2hQYXRocyxcblx0XHRhcmdzOiBbJy0tbG9naW4nLCAnLWknXVxuXHR9KTtcblx0cHJvZmlsZVNvdXJjZXMuc2V0KFByb2ZpbGVTb3VyY2UuUHdzaCwge1xuXHRcdHByb2ZpbGVOYW1lOiAnUG93ZXJTaGVsbCcsXG5cdFx0cGF0aHM6IHB3c2hQYXRocyxcblx0XHRpY29uOiBDb2RpY29uLnRlcm1pbmFsUG93ZXJzaGVsbFxuXHR9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0R2l0QmFzaFBhdGhzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0Y29uc3QgZ2l0RGlyczogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cblx0Ly8gTG9vayBmb3IgZ2l0LmV4ZSBvbiB0aGUgUEFUSCBhbmQgdXNlIHRoYXQgaWYgZm91bmQuIGdpdC5leGUgaXMgbG9jYXRlZCBhdFxuXHQvLyBgPGluc3RhbGxkaXI+L2NtZC9naXQuZXhlYC4gVGhpcyBpcyBub3QgYW4gdW5zYWZlIGxvY2F0aW9uIGJlY2F1c2UgdGhlIGdpdCBleGVjdXRhYmxlIGlzXG5cdC8vIGxvY2F0ZWQgb24gdGhlIFBBVEggd2hpY2ggaXMgb25seSBjb250cm9sbGVkIGJ5IHRoZSB1c2VyL2FkbWluLlxuXHRjb25zdCBnaXRFeGVQYXRoID0gYXdhaXQgZmluZEV4ZWN1dGFibGUoJ2dpdC5leGUnKTtcblx0aWYgKGdpdEV4ZVBhdGgpIHtcblx0XHRjb25zdCBnaXRFeGVEaXIgPSBkaXJuYW1lKGdpdEV4ZVBhdGgpO1xuXHRcdGdpdERpcnMuYWRkKHJlc29sdmUoZ2l0RXhlRGlyLCAnLi4vLi4nKSk7XG5cdH1cblx0ZnVuY3Rpb24gYWRkVHJ1dGh5PFQ+KHNldDogU2V0PFQ+LCB2YWx1ZTogVCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0c2V0LmFkZCh2YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gQWRkIGNvbW1vbiBnaXQgaW5zdGFsbCBsb2NhdGlvbnNcblx0YWRkVHJ1dGh5KGdpdERpcnMsIHByb2Nlc3MuZW52WydQcm9ncmFtVzY0MzInXSk7XG5cdGFkZFRydXRoeShnaXREaXJzLCBwcm9jZXNzLmVudlsnUHJvZ3JhbUZpbGVzJ10pO1xuXHRhZGRUcnV0aHkoZ2l0RGlycywgcHJvY2Vzcy5lbnZbJ1Byb2dyYW1GaWxlcyhYODYpJ10pO1xuXHRhZGRUcnV0aHkoZ2l0RGlycywgYCR7cHJvY2Vzcy5lbnZbJ0xvY2FsQXBwRGF0YSddfVxcXFxQcm9ncmFtYCk7XG5cblx0Y29uc3QgZ2l0QmFzaFBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGdpdERpciBvZiBnaXREaXJzKSB7XG5cdFx0Z2l0QmFzaFBhdGhzLnB1c2goXG5cdFx0XHRgJHtnaXREaXJ9XFxcXEdpdFxcXFxiaW5cXFxcYmFzaC5leGVgLFxuXHRcdFx0YCR7Z2l0RGlyfVxcXFxHaXRcXFxcdXNyXFxcXGJpblxcXFxiYXNoLmV4ZWAsXG5cdFx0XHRgJHtnaXREaXJ9XFxcXHVzclxcXFxiaW5cXFxcYmFzaC5leGVgIC8vIHVzaW5nIEdpdCBmb3IgV2luZG93cyBTREtcblx0XHQpO1xuXHR9XG5cblx0Ly8gQWRkIHNwZWNpYWwgaW5zdGFsbHMgdGhhdCBkb24ndCBmb2xsb3cgdGhlIHN0YW5kYXJkIGRpcmVjdG9yeSBzdHJ1Y3R1cmVcblx0Z2l0QmFzaFBhdGhzLnB1c2goYCR7cHJvY2Vzcy5lbnZbJ1VzZXJQcm9maWxlJ119XFxcXHNjb29wXFxcXGFwcHNcXFxcZ2l0XFxcXGN1cnJlbnRcXFxcYmluXFxcXGJhc2guZXhlYCk7XG5cdGdpdEJhc2hQYXRocy5wdXNoKGAke3Byb2Nlc3MuZW52WydVc2VyUHJvZmlsZSddfVxcXFxzY29vcFxcXFxhcHBzXFxcXGdpdC13aXRoLW9wZW5zc2hcXFxcY3VycmVudFxcXFxiaW5cXFxcYmFzaC5leGVgKTtcblxuXHRyZXR1cm4gZ2l0QmFzaFBhdGhzO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRQb3dlcnNoZWxsUGF0aHMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuXHRjb25zdCBwYXRoczogc3RyaW5nW10gPSBbXTtcblx0Ly8gQWRkIGFsbCBvZiB0aGUgZGlmZmVyZW50IGtpbmRzIG9mIFBvd2VyU2hlbGxzXG5cdGZvciBhd2FpdCAoY29uc3QgcHdzaEV4ZSBvZiBlbnVtZXJhdGVQb3dlclNoZWxsSW5zdGFsbGF0aW9ucygpKSB7XG5cdFx0cGF0aHMucHVzaChwd3NoRXhlLmV4ZVBhdGgpO1xuXHR9XG5cdHJldHVybiBwYXRocztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0V3NsUHJvZmlsZXMod3NsUGF0aDogc3RyaW5nLCBkZWZhdWx0UHJvZmlsZU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8SVRlcm1pbmFsUHJvZmlsZVtdPiB7XG5cdGNvbnN0IHByb2ZpbGVzOiBJVGVybWluYWxQcm9maWxlW10gPSBbXTtcblx0Y29uc3QgZGlzdHJvT3V0cHV0ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Ly8gd3NsLmV4ZSBvdXRwdXQgaXMgZW5jb2RlZCBpbiB1dGYxNmxlIChpZS4gQSAtPiAweDQxMDApXG5cdFx0Y3AuZXhlYygnd3NsLmV4ZSAtbCAtcScsIHsgZW5jb2Rpbmc6ICd1dGYxNmxlJywgdGltZW91dDogMTAwMCB9LCAoZXJyLCBzdGRvdXQpID0+IHtcblx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0cmV0dXJuIHJlamVjdCgnUHJvYmxlbSBvY2N1cnJlZCB3aGVuIGdldHRpbmcgd3NsIGRpc3Ryb3MnKTtcblx0XHRcdH1cblx0XHRcdHJlc29sdmUoc3Rkb3V0KTtcblx0XHR9KTtcblx0fSk7XG5cdGlmICghZGlzdHJvT3V0cHV0KSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cCgvW1xccj9cXG5dLyk7XG5cdGNvbnN0IGRpc3Ryb05hbWVzID0gZGlzdHJvT3V0cHV0LnNwbGl0KHJlZ2V4KS5maWx0ZXIodCA9PiB0LnRyaW0oKS5sZW5ndGggPiAwICYmIHQgIT09ICcnKTtcblx0Zm9yIChjb25zdCBkaXN0cm9OYW1lIG9mIGRpc3Ryb05hbWVzKSB7XG5cdFx0Ly8gU2tpcCBlbXB0eSBsaW5lc1xuXHRcdGlmIChkaXN0cm9OYW1lID09PSAnJykge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Ly8gZG9ja2VyLWRlc2t0b3AgYW5kIGRvY2tlci1kZXNrdG9wLWRhdGEgYXJlIHRyZWF0ZWQgYXMgaW1wbGVtZW50YXRpb24gZGV0YWlscyBvZlxuXHRcdC8vIERvY2tlciBEZXNrdG9wIGZvciBXaW5kb3dzIGFuZCB0aGVyZWZvcmUgbm90IGV4cG9zZWRcblx0XHRpZiAoZGlzdHJvTmFtZS5zdGFydHNXaXRoKCdkb2NrZXItZGVza3RvcCcpKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgdGhlIHByb2ZpbGUsIGFkZGluZyB0aGUgaWNvbiBkZXBlbmRpbmcgb24gdGhlIGRpc3Ryb1xuXHRcdGNvbnN0IHByb2ZpbGVOYW1lID0gYCR7ZGlzdHJvTmFtZX0gKFdTTClgO1xuXHRcdGNvbnN0IHByb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGUgPSB7XG5cdFx0XHRwcm9maWxlTmFtZSxcblx0XHRcdHBhdGg6IHdzbFBhdGgsXG5cdFx0XHRhcmdzOiBbYC1kYCwgYCR7ZGlzdHJvTmFtZX1gXSxcblx0XHRcdGlzRGVmYXVsdDogcHJvZmlsZU5hbWUgPT09IGRlZmF1bHRQcm9maWxlTmFtZSxcblx0XHRcdGljb246IGdldFdzbEljb24oZGlzdHJvTmFtZSksXG5cdFx0XHRpc0F1dG9EZXRlY3RlZDogZmFsc2Vcblx0XHR9O1xuXHRcdC8vIEFkZCB0aGUgcHJvZmlsZVxuXHRcdHByb2ZpbGVzLnB1c2gocHJvZmlsZSk7XG5cdH1cblx0cmV0dXJuIHByb2ZpbGVzO1xufVxuXG5mdW5jdGlvbiBnZXRXc2xJY29uKGRpc3Ryb05hbWU6IHN0cmluZyk6IFRoZW1lSWNvbiB7XG5cdGlmIChkaXN0cm9OYW1lLmluY2x1ZGVzKCdVYnVudHUnKSkge1xuXHRcdHJldHVybiBDb2RpY29uLnRlcm1pbmFsVWJ1bnR1O1xuXHR9IGVsc2UgaWYgKGRpc3Ryb05hbWUuaW5jbHVkZXMoJ0RlYmlhbicpKSB7XG5cdFx0cmV0dXJuIENvZGljb24udGVybWluYWxEZWJpYW47XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIENvZGljb24udGVybWluYWxMaW51eDtcblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBkZXRlY3RBdmFpbGFibGVVbml4UHJvZmlsZXMoXG5cdGZzUHJvdmlkZXI6IElGc1Byb3ZpZGVyLFxuXHRsb2dTZXJ2aWNlPzogSUxvZ1NlcnZpY2UsXG5cdGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzPzogYm9vbGVhbixcblx0Y29uZmlnUHJvZmlsZXM/OiB7IFtrZXk6IHN0cmluZ106IElVbnJlc29sdmVkVGVybWluYWxQcm9maWxlIH0sXG5cdGRlZmF1bHRQcm9maWxlTmFtZT86IHN0cmluZyxcblx0dGVzdFBhdGhzPzogc3RyaW5nW10sXG5cdHZhcmlhYmxlUmVzb2x2ZXI/OiAodGV4dDogc3RyaW5nW10pID0+IFByb21pc2U8c3RyaW5nW10+LFxuXHRzaGVsbEVudj86IHR5cGVvZiBwcm9jZXNzLmVudlxuKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlW10+IHtcblx0Y29uc3QgZGV0ZWN0ZWRQcm9maWxlczogTWFwPHN0cmluZywgSVVucmVzb2x2ZWRUZXJtaW5hbFByb2ZpbGU+ID0gbmV3IE1hcCgpO1xuXG5cdC8vIEFkZCBub24tcXVpY2sgbGF1bmNoIHByb2ZpbGVzXG5cdGlmIChpbmNsdWRlRGV0ZWN0ZWRQcm9maWxlcyAmJiBhd2FpdCBmc1Byb3ZpZGVyLmV4aXN0c0ZpbGUoQ29uc3RhbnRzLlVuaXhTaGVsbHNQYXRoKSkge1xuXHRcdGNvbnN0IGNvbnRlbnRzID0gKGF3YWl0IGZzUHJvdmlkZXIucmVhZEZpbGUoQ29uc3RhbnRzLlVuaXhTaGVsbHNQYXRoKSkudG9TdHJpbmcoKTtcblx0XHRjb25zdCBwcm9maWxlcyA9IChcblx0XHRcdCh0ZXN0UGF0aHMgfHwgY29udGVudHMuc3BsaXQoJ1xcbicpKVxuXHRcdFx0XHQubWFwKGUgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gZS5pbmRleE9mKCcjJyk7XG5cdFx0XHRcdFx0cmV0dXJuIGluZGV4ID09PSAtMSA/IGUgOiBlLnN1YnN0cmluZygwLCBpbmRleCk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5maWx0ZXIoZSA9PiBlLnRyaW0oKS5sZW5ndGggPiAwKVxuXHRcdCk7XG5cdFx0Y29uc3QgY291bnRzOiBNYXA8c3RyaW5nLCBudW1iZXI+ID0gbmV3IE1hcCgpO1xuXHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiBwcm9maWxlcykge1xuXHRcdFx0bGV0IHByb2ZpbGVOYW1lID0gYmFzZW5hbWUocHJvZmlsZSk7XG5cdFx0XHRsZXQgY291bnQgPSBjb3VudHMuZ2V0KHByb2ZpbGVOYW1lKSB8fCAwO1xuXHRcdFx0Y291bnQrKztcblx0XHRcdGlmIChjb3VudCA+IDEpIHtcblx0XHRcdFx0cHJvZmlsZU5hbWUgPSBgJHtwcm9maWxlTmFtZX0gKCR7Y291bnR9KWA7XG5cdFx0XHR9XG5cdFx0XHRjb3VudHMuc2V0KHByb2ZpbGVOYW1lLCBjb3VudCk7XG5cdFx0XHRkZXRlY3RlZFByb2ZpbGVzLnNldChwcm9maWxlTmFtZSwgeyBwYXRoOiBwcm9maWxlLCBpc0F1dG9EZXRlY3RlZDogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRhcHBseUNvbmZpZ1Byb2ZpbGVzVG9NYXAoY29uZmlnUHJvZmlsZXMsIGRldGVjdGVkUHJvZmlsZXMpO1xuXG5cdHJldHVybiBhd2FpdCB0cmFuc2Zvcm1Ub1Rlcm1pbmFsUHJvZmlsZXMoZGV0ZWN0ZWRQcm9maWxlcy5lbnRyaWVzKCksIGRlZmF1bHRQcm9maWxlTmFtZSwgZnNQcm92aWRlciwgc2hlbGxFbnYsIGxvZ1NlcnZpY2UsIHZhcmlhYmxlUmVzb2x2ZXIpO1xufVxuXG5mdW5jdGlvbiBhcHBseUNvbmZpZ1Byb2ZpbGVzVG9NYXAoY29uZmlnUHJvZmlsZXM6IHsgW2tleTogc3RyaW5nXTogSVVucmVzb2x2ZWRUZXJtaW5hbFByb2ZpbGUgfSB8IHVuZGVmaW5lZCwgcHJvZmlsZXNNYXA6IE1hcDxzdHJpbmcsIElVbnJlc29sdmVkVGVybWluYWxQcm9maWxlPikge1xuXHRpZiAoIWNvbmZpZ1Byb2ZpbGVzKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGZvciAoY29uc3QgW3Byb2ZpbGVOYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29uZmlnUHJvZmlsZXMpKSB7XG5cdFx0aWYgKHZhbHVlID09PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcgfHwgKCEoJ3BhdGgnIGluIHZhbHVlKSAmJiAhKCdzb3VyY2UnIGluIHZhbHVlKSkpIHtcblx0XHRcdHByb2ZpbGVzTWFwLmRlbGV0ZShwcm9maWxlTmFtZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhbHVlLmljb24gPSB2YWx1ZS5pY29uIHx8IHByb2ZpbGVzTWFwLmdldChwcm9maWxlTmFtZSk/Lmljb247XG5cdFx0XHRwcm9maWxlc01hcC5zZXQocHJvZmlsZU5hbWUsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdmFsaWRhdGVQcm9maWxlUGF0aHMocHJvZmlsZU5hbWU6IHN0cmluZywgZGVmYXVsdFByb2ZpbGVOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsIHBvdGVudGlhbFBhdGhzOiAoc3RyaW5nIHwgSVRlcm1pbmFsVW5zYWZlUGF0aClbXSwgZnNQcm92aWRlcjogSUZzUHJvdmlkZXIsIHNoZWxsRW52OiB0eXBlb2YgcHJvY2Vzcy5lbnYsIGFyZ3M/OiBzdHJpbmdbXSB8IHN0cmluZywgZW52PzogSVRlcm1pbmFsRW52aXJvbm1lbnQsIG92ZXJyaWRlTmFtZT86IGJvb2xlYW4sIGlzQXV0b0RldGVjdGVkPzogYm9vbGVhbiwgcmVxdWlyZXNVbnNhZmVQYXRoPzogc3RyaW5nKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlIHwgdW5kZWZpbmVkPiB7XG5cdGlmIChwb3RlbnRpYWxQYXRocy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdH1cblx0Y29uc3QgcGF0aCA9IHBvdGVudGlhbFBhdGhzLnNoaWZ0KCkhO1xuXHRpZiAocGF0aCA9PT0gJycpIHtcblx0XHRyZXR1cm4gdmFsaWRhdGVQcm9maWxlUGF0aHMocHJvZmlsZU5hbWUsIGRlZmF1bHRQcm9maWxlTmFtZSwgcG90ZW50aWFsUGF0aHMsIGZzUHJvdmlkZXIsIHNoZWxsRW52LCBhcmdzLCBlbnYsIG92ZXJyaWRlTmFtZSwgaXNBdXRvRGV0ZWN0ZWQpO1xuXHR9XG5cdGNvbnN0IGlzVW5zYWZlUGF0aCA9IHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJyAmJiBwYXRoLmlzVW5zYWZlO1xuXHRjb25zdCBhY3R1YWxQYXRoID0gdHlwZW9mIHBhdGggPT09ICdzdHJpbmcnID8gcGF0aCA6IHBhdGgucGF0aDtcblxuXHRjb25zdCBwcm9maWxlOiBJVGVybWluYWxQcm9maWxlID0ge1xuXHRcdHByb2ZpbGVOYW1lLFxuXHRcdHBhdGg6IGFjdHVhbFBhdGgsXG5cdFx0YXJncyxcblx0XHRlbnYsXG5cdFx0b3ZlcnJpZGVOYW1lLFxuXHRcdGlzQXV0b0RldGVjdGVkLFxuXHRcdGlzRGVmYXVsdDogcHJvZmlsZU5hbWUgPT09IGRlZmF1bHRQcm9maWxlTmFtZSxcblx0XHRpc1Vuc2FmZVBhdGgsXG5cdFx0cmVxdWlyZXNVbnNhZmVQYXRoXG5cdH07XG5cblx0Ly8gRm9yIG5vbi1hYnNvbHV0ZSBwYXRocywgY2hlY2sgaWYgaXQncyBhdmFpbGFibGUgb24gJFBBVEhcblx0aWYgKGJhc2VuYW1lKGFjdHVhbFBhdGgpID09PSBhY3R1YWxQYXRoKSB7XG5cdFx0Ly8gVGhlIGV4ZWN1dGFibGUgaXNuJ3QgYW4gYWJzb2x1dGUgcGF0aCwgdHJ5IGZpbmQgaXQgb24gdGhlIFBBVEhcblx0XHRjb25zdCBlbnZQYXRoczogc3RyaW5nW10gfCB1bmRlZmluZWQgPSBzaGVsbEVudi5QQVRIID8gc2hlbGxFbnYuUEFUSC5zcGxpdChkZWxpbWl0ZXIpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGV4ZWN1dGFibGUgPSBhd2FpdCBmaW5kRXhlY3V0YWJsZShhY3R1YWxQYXRoLCB1bmRlZmluZWQsIGVudlBhdGhzLCB1bmRlZmluZWQsIGZzUHJvdmlkZXIuZXhpc3RzRmlsZSk7XG5cdFx0aWYgKCFleGVjdXRhYmxlKSB7XG5cdFx0XHRyZXR1cm4gdmFsaWRhdGVQcm9maWxlUGF0aHMocHJvZmlsZU5hbWUsIGRlZmF1bHRQcm9maWxlTmFtZSwgcG90ZW50aWFsUGF0aHMsIGZzUHJvdmlkZXIsIHNoZWxsRW52LCBhcmdzKTtcblx0XHR9XG5cdFx0cHJvZmlsZS5wYXRoID0gZXhlY3V0YWJsZTtcblx0XHRwcm9maWxlLmlzRnJvbVBhdGggPSB0cnVlO1xuXHRcdHJldHVybiBwcm9maWxlO1xuXHR9XG5cblx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZnNQcm92aWRlci5leGlzdHNGaWxlKG5vcm1hbGl6ZShhY3R1YWxQYXRoKSk7XG5cdGlmIChyZXN1bHQpIHtcblx0XHRyZXR1cm4gcHJvZmlsZTtcblx0fVxuXG5cdHJldHVybiB2YWxpZGF0ZVByb2ZpbGVQYXRocyhwcm9maWxlTmFtZSwgZGVmYXVsdFByb2ZpbGVOYW1lLCBwb3RlbnRpYWxQYXRocywgZnNQcm92aWRlciwgc2hlbGxFbnYsIGFyZ3MsIGVudiwgb3ZlcnJpZGVOYW1lLCBpc0F1dG9EZXRlY3RlZCk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZzUHJvdmlkZXIge1xuXHRleGlzdHNGaWxlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj47XG5cdHJlYWRGaWxlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8QnVmZmVyPjtcbn1cblxuaW50ZXJmYWNlIElQb3RlbnRpYWxUZXJtaW5hbFByb2ZpbGUge1xuXHRwcm9maWxlTmFtZTogc3RyaW5nO1xuXHRwYXRoczogc3RyaW5nW107XG5cdGFyZ3M/OiBzdHJpbmdbXTtcblx0aWNvbj86IFRoZW1lSWNvbiB8IFVSSSB8IHsgbGlnaHQ6IFVSSTsgZGFyazogVVJJIH07XG59XG5cbmV4cG9ydCB0eXBlIElVbnJlc29sdmVkVGVybWluYWxQcm9maWxlID0gSVRlcm1pbmFsRXhlY3V0YWJsZSB8IElUZXJtaW5hbFByb2ZpbGVTb3VyY2UgfCBudWxsO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxRQUFRO0FBQ3BCLFlBQVksUUFBUTtBQUNwQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxVQUFVLFdBQVcsaUJBQWlCO0FBQy9DLFNBQVMsU0FBUyxpQkFBaUI7QUFDbkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFFekIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsd0NBQXdDO0FBR2pELFNBQW1ILGVBQTZCLHlCQUF5QjtBQUN6SyxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLFNBQVMsZUFBZTtBQUVqQyxJQUFXLFlBQVgsa0JBQVdBLGVBQVg7QUFDQyxFQUFBQSxXQUFBLG9CQUFpQjtBQURQLFNBQUFBO0FBQUEsR0FBQTtBQUlYLElBQUk7QUFDSixJQUFJLHVCQUFnQztBQUU3QixTQUFTLHdCQUNmLFVBQ0EsZ0JBQ0EseUJBQ0Esc0JBQ0EsV0FBK0IsUUFBUSxLQUN2QyxZQUNBLFlBQ0Esa0JBQ0EscUJBQzhCO0FBQzlCLGVBQWEsY0FBYztBQUFBLElBQzFCLFlBQVksSUFBSSxlQUFlO0FBQUEsSUFDL0IsVUFBVSxHQUFHLFNBQVM7QUFBQSxFQUN2QjtBQUNBLE1BQUksV0FBVztBQUNkLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxxQkFBcUIsU0FBUyxrQkFBa0IsY0FBYyxNQUFNO0FBQUEsTUFDcEUsWUFBWSxPQUFPLGFBQWEsV0FBVyxFQUFFLEdBQUcsU0FBUyxJQUFJLHFCQUFxQixTQUF3RCxrQkFBa0IsZUFBZTtBQUFBLE1BQzNLLE9BQU8sbUJBQW1CLFdBQVcsaUJBQWlCLHFCQUFxQixTQUFpQixrQkFBa0IscUJBQXFCO0FBQUEsTUFDbkk7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQUEsSUFDTjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQSxZQUFZLE9BQU8sYUFBYSxXQUFXLEVBQUUsR0FBRyxTQUFTLElBQUkscUJBQXFCLFNBQXdELFVBQVUsa0JBQWtCLGdCQUFnQixrQkFBa0IsYUFBYTtBQUFBLElBQ3JOLE9BQU8sbUJBQW1CLFdBQVcsaUJBQWlCLHFCQUFxQixTQUFpQixVQUFVLGtCQUFrQixzQkFBc0Isa0JBQWtCLG1CQUFtQjtBQUFBLElBQ25MO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxlQUFlLCtCQUNkLHlCQUNBLFlBQ0EsVUFDQSxZQUNBLGdCQUNBLGdCQUNBLG9CQUNBLHFCQUNBLGtCQUM4QjtBQUs5QixRQUFNLHlCQUF5QixRQUFRLElBQUksZUFBZSx3QkFBd0I7QUFDbEYsUUFBTSxlQUFlLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxLQUFLLHlCQUF5QixjQUFjLFVBQVU7QUFFbkcsTUFBSSxZQUFZO0FBRWhCLE1BQUksc0JBQXNCLEtBQUssT0FBTztBQUNyQyxnQkFBWTtBQUFBLEVBQ2I7QUFFQSxRQUFNLDBCQUEwQixtQkFBbUI7QUFFbkQsUUFBTSxtQkFBNEQsb0JBQUksSUFBSTtBQUcxRSxNQUFJLHlCQUF5QjtBQUM1QixxQkFBaUIsSUFBSSxjQUFjO0FBQUEsTUFDbEMsUUFBUSxjQUFjO0FBQUEsTUFDdEIsTUFBTSxRQUFRO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxJQUNqQixDQUFDO0FBQ0QscUJBQWlCLElBQUksc0JBQXNCO0FBQUEsTUFDMUMsTUFBTSxHQUFHLFlBQVk7QUFBQSxNQUNyQixNQUFNLFFBQVE7QUFBQSxNQUNkLGdCQUFnQjtBQUFBLElBQ2pCLENBQUM7QUFDRCxxQkFBaUIsSUFBSSxZQUFZO0FBQUEsTUFDaEMsUUFBUSxjQUFjO0FBQUEsTUFDdEIsZ0JBQWdCO0FBQUEsSUFDakIsQ0FBQztBQUNELHFCQUFpQixJQUFJLGtCQUFrQjtBQUFBLE1BQ3RDLE1BQU0sR0FBRyxZQUFZO0FBQUEsTUFDckIsTUFBTSxRQUFRO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxJQUNqQixDQUFDO0FBQ0QscUJBQWlCLElBQUksVUFBVTtBQUFBLE1BQzlCLE1BQU07QUFBQSxRQUNMLEVBQUUsTUFBTSxHQUFHLFFBQVEsSUFBSSxXQUFXLENBQUMsNkJBQTZCLFVBQVUsS0FBSztBQUFBLFFBQy9FLEVBQUUsTUFBTSxHQUFHLFFBQVEsSUFBSSxXQUFXLENBQUMsMkJBQTJCLFVBQVUsS0FBSztBQUFBLE1BQzlFO0FBQUEsTUFDQSxNQUFNLENBQUMsU0FBUztBQUFBLE1BQ2hCLGdCQUFnQjtBQUFBLElBQ2pCLENBQUM7QUFDRCxxQkFBaUIsSUFBSSxnQkFBZ0I7QUFBQSxNQUNwQyxNQUFNO0FBQUEsUUFDTCxFQUFFLE1BQU0sR0FBRyxRQUFRLElBQUksV0FBVyxDQUFDLGdDQUFnQyxVQUFVLEtBQUs7QUFBQSxNQUNuRjtBQUFBLE1BQ0EsTUFBTSxDQUFDLFdBQVcsSUFBSTtBQUFBO0FBQUEsTUFFdEIsS0FBSyxFQUFFLGdCQUFnQixJQUFJO0FBQUEsTUFDM0IsTUFBTSxRQUFRO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxJQUNqQixDQUFDO0FBQ0QsVUFBTSxZQUFZLEdBQUcsUUFBUSxJQUFJLFlBQVksS0FBSyxHQUFHLFFBQVEsSUFBSSxXQUFXLENBQUMsU0FBUztBQUN0RixxQkFBaUIsSUFBSSxTQUFTO0FBQUEsTUFDN0IsTUFBTSxHQUFHLFlBQVk7QUFBQSxNQUNyQixNQUFNLENBQUMsTUFBTSxTQUFTO0FBQUE7QUFBQSxNQUV0QixjQUFjLFFBQVEsSUFBSSxZQUFZLElBQUksWUFBWSxFQUFFLE1BQU0sV0FBVyxVQUFVLEtBQUs7QUFBQSxNQUN4RixnQkFBZ0I7QUFBQSxJQUNqQixDQUFDO0FBQUEsRUFDRjtBQUVBLDJCQUF5QixnQkFBZ0IsZ0JBQWdCO0FBRXpELFFBQU0saUJBQXFDLE1BQU0sNEJBQTRCLGlCQUFpQixRQUFRLEdBQUcsb0JBQW9CLFlBQVksVUFBVSxZQUFZLGdCQUFnQjtBQUUvSyxNQUFJLDJCQUEyQixnQkFBZ0I7QUFDOUMsUUFBSTtBQUNILFlBQU0sU0FBUyxNQUFNLGVBQWUsR0FBRyxZQUFZLEtBQUssWUFBWSxRQUFRLE1BQU0sUUFBUSxrQkFBa0I7QUFDNUcsaUJBQVcsY0FBYyxRQUFRO0FBQ2hDLFlBQUksQ0FBQyxrQkFBa0IsRUFBRSxXQUFXLGVBQWUsaUJBQWlCO0FBQ25FLHlCQUFlLEtBQUssVUFBVTtBQUFBLFFBQy9CO0FBQUEsTUFDRDtBQUFBLElBQ0QsU0FBUyxHQUFHO0FBQ1gsVUFBSSxzQkFBc0I7QUFDekIsb0JBQVksTUFBTSx3REFBd0Q7QUFDMUUsK0JBQXVCO0FBQUEsTUFDeEI7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFDUjtBQUVBLGVBQWUsNEJBQ2QsU0FDQSxvQkFDQSxZQUNBLFdBQStCLFFBQVEsS0FDdkMsWUFDQSxrQkFDOEI7QUFDOUIsUUFBTSxXQUFvRCxDQUFDO0FBQzNELGFBQVcsQ0FBQyxhQUFhLE9BQU8sS0FBSyxTQUFTO0FBQzdDLGFBQVMsS0FBSyxvQkFBb0IsYUFBYSxTQUFTLG9CQUFvQixZQUFZLFVBQVUsWUFBWSxnQkFBZ0IsQ0FBQztBQUFBLEVBQ2hJO0FBQ0EsVUFBUSxNQUFNLFFBQVEsSUFBSSxRQUFRLEdBQUcsT0FBTyxPQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3JEO0FBRUEsZUFBZSxvQkFDZCxhQUNBLFNBQ0Esb0JBQ0EsWUFDQSxXQUErQixRQUFRLEtBQ3ZDLFlBQ0Esa0JBQ3dDO0FBQ3hDLE1BQUksWUFBWSxNQUFNO0FBQ3JCLFdBQU87QUFBQSxFQUNSO0FBQ0EsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJLE9BQWdFO0FBRXBFLE1BQUksWUFBWSxXQUFXLEVBQUUsVUFBVSxVQUFVO0FBQ2hELFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxRQUFRLE1BQU07QUFDakQsUUFBSSxDQUFDLFFBQVE7QUFDWixhQUFPO0FBQUEsSUFDUjtBQUNBLG9CQUFnQixPQUFPO0FBR3ZCLFdBQU8sUUFBUSxRQUFRLE9BQU87QUFDOUIsUUFBSSxRQUFRLE1BQU07QUFDakIsYUFBTyxhQUFhLFFBQVEsSUFBSTtBQUFBLElBQ2pDLFdBQVcsT0FBTyxNQUFNO0FBQ3ZCLGFBQU8sT0FBTztBQUFBLElBQ2Y7QUFBQSxFQUNELE9BQU87QUFDTixvQkFBZ0IsTUFBTSxRQUFRLFFBQVEsSUFBSSxJQUFJLFFBQVEsT0FBTyxDQUFDLFFBQVEsSUFBSTtBQUMxRSxXQUFPLFlBQVksUUFBUSxPQUFPLE1BQU0sUUFBUSxRQUFRLElBQUksSUFBSSxRQUFRLE9BQU87QUFDL0UsV0FBTyxhQUFhLFFBQVEsSUFBSTtBQUFBLEVBQ2pDO0FBRUEsTUFBSTtBQUNKLE1BQUksa0JBQWtCO0FBRXJCLFVBQU0sU0FBUyxjQUFjLElBQUksT0FBSyxPQUFPLE1BQU0sV0FBVyxJQUFJLEVBQUUsSUFBSTtBQUV4RSxVQUFNLFdBQVcsTUFBTSxpQkFBaUIsTUFBTTtBQUU5QyxZQUFRLElBQUksTUFBTSxjQUFjLE1BQU07QUFDdEMsYUFBUyxJQUFJLEdBQUcsSUFBSSxjQUFjLFFBQVEsS0FBSztBQUM5QyxVQUFJLE9BQU8sY0FBYyxDQUFDLE1BQU0sVUFBVTtBQUN6QyxjQUFNLENBQUMsSUFBSSxTQUFTLENBQUM7QUFBQSxNQUN0QixPQUFPO0FBQ04sY0FBTSxDQUFDLElBQUk7QUFBQSxVQUNWLE1BQU0sU0FBUyxDQUFDO0FBQUEsVUFDaEIsVUFBVTtBQUFBLFFBQ1g7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsT0FBTztBQUNOLFlBQVEsY0FBYyxNQUFNO0FBQUEsRUFDN0I7QUFFQSxNQUFJO0FBQ0osTUFBSSxRQUFRLGNBQWM7QUFFekIsUUFBSTtBQUNKLFFBQUksU0FBUyxRQUFRLFlBQVksR0FBRztBQUNuQywyQkFBcUIsUUFBUTtBQUFBLElBQzlCLE9BQU87QUFDTiwyQkFBcUIsUUFBUSxhQUFhO0FBQzFDLFVBQUksUUFBUSxhQUFhLFVBQVU7QUFDbEMsNkJBQXFCO0FBQUEsTUFDdEI7QUFBQSxJQUNEO0FBQ0EsVUFBTSxTQUFTLE1BQU0sV0FBVyxXQUFXLGtCQUFrQjtBQUM3RCxRQUFJLENBQUMsUUFBUTtBQUNaO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxRQUFNLG1CQUFtQixNQUFNLHFCQUFxQixhQUFhLG9CQUFvQixPQUFPLFlBQVksVUFBVSxNQUFNLFFBQVEsS0FBSyxRQUFRLGNBQWMsUUFBUSxnQkFBZ0Isa0JBQWtCO0FBQ3JNLE1BQUksQ0FBQyxrQkFBa0I7QUFDdEIsZ0JBQVksTUFBTSxrQ0FBa0MsYUFBYSxhQUFhO0FBQzlFLFdBQU87QUFBQSxFQUNSO0FBRUEsbUJBQWlCLGlCQUFpQixRQUFRO0FBQzFDLG1CQUFpQixPQUFPO0FBQ3hCLG1CQUFpQixRQUFRLFFBQVE7QUFDakMsU0FBTztBQUNSO0FBRUEsU0FBUyxhQUFhLE1BQW1FO0FBQ3hGLE1BQUksT0FBTyxTQUFTLFVBQVU7QUFDN0IsV0FBTyxFQUFFLElBQUksS0FBSztBQUFBLEVBQ25CO0FBQ0EsU0FBTztBQUNSO0FBRUEsZUFBZSwwQkFBMEIscUJBQStDO0FBQ3ZGLE1BQUksa0JBQWtCLENBQUMscUJBQXFCO0FBQzNDO0FBQUEsRUFDRDtBQUVBLFFBQU0sQ0FBQyxjQUFjLFNBQVMsSUFBSSxNQUFNLFFBQVEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLHVCQUF1QixtQkFBbUIsQ0FBQyxDQUFDO0FBRXBILG1CQUFpQixvQkFBSSxJQUFJO0FBQ3pCLGlCQUFlO0FBQUEsSUFDZCxjQUFjO0FBQUEsSUFBUztBQUFBLE1BQ3ZCLGFBQWE7QUFBQSxNQUNiLE9BQU87QUFBQSxNQUNQLE1BQU0sQ0FBQyxXQUFXLElBQUk7QUFBQSxJQUN2QjtBQUFBLEVBQUM7QUFDRCxpQkFBZSxJQUFJLGNBQWMsTUFBTTtBQUFBLElBQ3RDLGFBQWE7QUFBQSxJQUNiLE9BQU87QUFBQSxJQUNQLE1BQU0sUUFBUTtBQUFBLEVBQ2YsQ0FBQztBQUNGO0FBRUEsZUFBZSxrQkFBcUM7QUFDbkQsUUFBTSxVQUF1QixvQkFBSSxJQUFJO0FBS3JDLFFBQU0sYUFBYSxNQUFNLGVBQWUsU0FBUztBQUNqRCxNQUFJLFlBQVk7QUFDZixVQUFNLFlBQVksUUFBUSxVQUFVO0FBQ3BDLFlBQVEsSUFBSSxRQUFRLFdBQVcsT0FBTyxDQUFDO0FBQUEsRUFDeEM7QUFDQSxXQUFTLFVBQWEsS0FBYSxPQUE0QjtBQUM5RCxRQUFJLE9BQU87QUFDVixVQUFJLElBQUksS0FBSztBQUFBLElBQ2Q7QUFBQSxFQUNEO0FBR0EsWUFBVSxTQUFTLFFBQVEsSUFBSSxjQUFjLENBQUM7QUFDOUMsWUFBVSxTQUFTLFFBQVEsSUFBSSxjQUFjLENBQUM7QUFDOUMsWUFBVSxTQUFTLFFBQVEsSUFBSSxtQkFBbUIsQ0FBQztBQUNuRCxZQUFVLFNBQVMsR0FBRyxRQUFRLElBQUksY0FBYyxDQUFDLFdBQVc7QUFFNUQsUUFBTSxlQUF5QixDQUFDO0FBQ2hDLGFBQVcsVUFBVSxTQUFTO0FBQzdCLGlCQUFhO0FBQUEsTUFDWixHQUFHLE1BQU07QUFBQSxNQUNULEdBQUcsTUFBTTtBQUFBLE1BQ1QsR0FBRyxNQUFNO0FBQUE7QUFBQSxJQUNWO0FBQUEsRUFDRDtBQUdBLGVBQWEsS0FBSyxHQUFHLFFBQVEsSUFBSSxhQUFhLENBQUMsNENBQTRDO0FBQzNGLGVBQWEsS0FBSyxHQUFHLFFBQVEsSUFBSSxhQUFhLENBQUMseURBQXlEO0FBRXhHLFNBQU87QUFDUjtBQUVBLGVBQWUscUJBQXdDO0FBQ3RELFFBQU0sUUFBa0IsQ0FBQztBQUV6QixtQkFBaUIsV0FBVyxpQ0FBaUMsR0FBRztBQUMvRCxVQUFNLEtBQUssUUFBUSxPQUFPO0FBQUEsRUFDM0I7QUFDQSxTQUFPO0FBQ1I7QUFFQSxlQUFlLGVBQWUsU0FBaUIsb0JBQXFFO0FBQ25ILFFBQU0sV0FBK0IsQ0FBQztBQUN0QyxRQUFNLGVBQWUsTUFBTSxJQUFJLFFBQWdCLENBQUNDLFVBQVMsV0FBVztBQUVuRSxPQUFHLEtBQUssaUJBQWlCLEVBQUUsVUFBVSxXQUFXLFNBQVMsSUFBSyxHQUFHLENBQUMsS0FBSyxXQUFXO0FBQ2pGLFVBQUksS0FBSztBQUNSLGVBQU8sT0FBTywyQ0FBMkM7QUFBQSxNQUMxRDtBQUNBLE1BQUFBLFNBQVEsTUFBTTtBQUFBLElBQ2YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNELE1BQUksQ0FBQyxjQUFjO0FBQ2xCLFdBQU8sQ0FBQztBQUFBLEVBQ1Q7QUFDQSxRQUFNLFFBQVEsSUFBSSxPQUFPLFNBQVM7QUFDbEMsUUFBTSxjQUFjLGFBQWEsTUFBTSxLQUFLLEVBQUUsT0FBTyxPQUFLLEVBQUUsS0FBSyxFQUFFLFNBQVMsS0FBSyxNQUFNLEVBQUU7QUFDekYsYUFBVyxjQUFjLGFBQWE7QUFFckMsUUFBSSxlQUFlLElBQUk7QUFDdEI7QUFBQSxJQUNEO0FBSUEsUUFBSSxXQUFXLFdBQVcsZ0JBQWdCLEdBQUc7QUFDNUM7QUFBQSxJQUNEO0FBR0EsVUFBTSxjQUFjLEdBQUcsVUFBVTtBQUNqQyxVQUFNLFVBQTRCO0FBQUEsTUFDakM7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLE1BQU0sQ0FBQyxNQUFNLEdBQUcsVUFBVSxFQUFFO0FBQUEsTUFDNUIsV0FBVyxnQkFBZ0I7QUFBQSxNQUMzQixNQUFNLFdBQVcsVUFBVTtBQUFBLE1BQzNCLGdCQUFnQjtBQUFBLElBQ2pCO0FBRUEsYUFBUyxLQUFLLE9BQU87QUFBQSxFQUN0QjtBQUNBLFNBQU87QUFDUjtBQUVBLFNBQVMsV0FBVyxZQUErQjtBQUNsRCxNQUFJLFdBQVcsU0FBUyxRQUFRLEdBQUc7QUFDbEMsV0FBTyxRQUFRO0FBQUEsRUFDaEIsV0FBVyxXQUFXLFNBQVMsUUFBUSxHQUFHO0FBQ3pDLFdBQU8sUUFBUTtBQUFBLEVBQ2hCLE9BQU87QUFDTixXQUFPLFFBQVE7QUFBQSxFQUNoQjtBQUNEO0FBRUEsZUFBZSw0QkFDZCxZQUNBLFlBQ0EseUJBQ0EsZ0JBQ0Esb0JBQ0EsV0FDQSxrQkFDQSxVQUM4QjtBQUM5QixRQUFNLG1CQUE0RCxvQkFBSSxJQUFJO0FBRzFFLE1BQUksMkJBQTJCLE1BQU0sV0FBVyxXQUFXLGtDQUF3QixHQUFHO0FBQ3JGLFVBQU0sWUFBWSxNQUFNLFdBQVcsU0FBUyxrQ0FBd0IsR0FBRyxTQUFTO0FBQ2hGLFVBQU0sWUFDSixhQUFhLFNBQVMsTUFBTSxJQUFJLEdBQy9CLElBQUksT0FBSztBQUNULFlBQU0sUUFBUSxFQUFFLFFBQVEsR0FBRztBQUMzQixhQUFPLFVBQVUsS0FBSyxJQUFJLEVBQUUsVUFBVSxHQUFHLEtBQUs7QUFBQSxJQUMvQyxDQUFDLEVBQ0EsT0FBTyxPQUFLLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQztBQUVsQyxVQUFNLFNBQThCLG9CQUFJLElBQUk7QUFDNUMsZUFBVyxXQUFXLFVBQVU7QUFDL0IsVUFBSSxjQUFjLFNBQVMsT0FBTztBQUNsQyxVQUFJLFFBQVEsT0FBTyxJQUFJLFdBQVcsS0FBSztBQUN2QztBQUNBLFVBQUksUUFBUSxHQUFHO0FBQ2Qsc0JBQWMsR0FBRyxXQUFXLEtBQUssS0FBSztBQUFBLE1BQ3ZDO0FBQ0EsYUFBTyxJQUFJLGFBQWEsS0FBSztBQUM3Qix1QkFBaUIsSUFBSSxhQUFhLEVBQUUsTUFBTSxTQUFTLGdCQUFnQixLQUFLLENBQUM7QUFBQSxJQUMxRTtBQUFBLEVBQ0Q7QUFFQSwyQkFBeUIsZ0JBQWdCLGdCQUFnQjtBQUV6RCxTQUFPLE1BQU0sNEJBQTRCLGlCQUFpQixRQUFRLEdBQUcsb0JBQW9CLFlBQVksVUFBVSxZQUFZLGdCQUFnQjtBQUM1STtBQUVBLFNBQVMseUJBQXlCLGdCQUEyRSxhQUFzRDtBQUNsSyxNQUFJLENBQUMsZ0JBQWdCO0FBQ3BCO0FBQUEsRUFDRDtBQUNBLGFBQVcsQ0FBQyxhQUFhLEtBQUssS0FBSyxPQUFPLFFBQVEsY0FBYyxHQUFHO0FBQ2xFLFFBQUksVUFBVSxRQUFRLE9BQU8sVUFBVSxZQUFhLEVBQUUsVUFBVSxVQUFVLEVBQUUsWUFBWSxRQUFTO0FBQ2hHLGtCQUFZLE9BQU8sV0FBVztBQUFBLElBQy9CLE9BQU87QUFDTixZQUFNLE9BQU8sTUFBTSxRQUFRLFlBQVksSUFBSSxXQUFXLEdBQUc7QUFDekQsa0JBQVksSUFBSSxhQUFhLEtBQUs7QUFBQSxJQUNuQztBQUFBLEVBQ0Q7QUFDRDtBQUVBLGVBQWUscUJBQXFCLGFBQXFCLG9CQUF3QyxnQkFBa0QsWUFBeUIsVUFBOEIsTUFBMEIsS0FBNEIsY0FBd0IsZ0JBQTBCLG9CQUFvRTtBQUNyWCxNQUFJLGVBQWUsV0FBVyxHQUFHO0FBQ2hDLFdBQU8sUUFBUSxRQUFRLE1BQVM7QUFBQSxFQUNqQztBQUNBLFFBQU0sT0FBTyxlQUFlLE1BQU07QUFDbEMsTUFBSSxTQUFTLElBQUk7QUFDaEIsV0FBTyxxQkFBcUIsYUFBYSxvQkFBb0IsZ0JBQWdCLFlBQVksVUFBVSxNQUFNLEtBQUssY0FBYyxjQUFjO0FBQUEsRUFDM0k7QUFDQSxRQUFNLGVBQWUsT0FBTyxTQUFTLFlBQVksS0FBSztBQUN0RCxRQUFNLGFBQWEsT0FBTyxTQUFTLFdBQVcsT0FBTyxLQUFLO0FBRTFELFFBQU0sVUFBNEI7QUFBQSxJQUNqQztBQUFBLElBQ0EsTUFBTTtBQUFBLElBQ047QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBLFdBQVcsZ0JBQWdCO0FBQUEsSUFDM0I7QUFBQSxJQUNBO0FBQUEsRUFDRDtBQUdBLE1BQUksU0FBUyxVQUFVLE1BQU0sWUFBWTtBQUV4QyxVQUFNLFdBQWlDLFNBQVMsT0FBTyxTQUFTLEtBQUssTUFBTSxTQUFTLElBQUk7QUFDeEYsVUFBTSxhQUFhLE1BQU0sZUFBZSxZQUFZLFFBQVcsVUFBVSxRQUFXLFdBQVcsVUFBVTtBQUN6RyxRQUFJLENBQUMsWUFBWTtBQUNoQixhQUFPLHFCQUFxQixhQUFhLG9CQUFvQixnQkFBZ0IsWUFBWSxVQUFVLElBQUk7QUFBQSxJQUN4RztBQUNBLFlBQVEsT0FBTztBQUNmLFlBQVEsYUFBYTtBQUNyQixXQUFPO0FBQUEsRUFDUjtBQUVBLFFBQU0sU0FBUyxNQUFNLFdBQVcsV0FBVyxVQUFVLFVBQVUsQ0FBQztBQUNoRSxNQUFJLFFBQVE7QUFDWCxXQUFPO0FBQUEsRUFDUjtBQUVBLFNBQU8scUJBQXFCLGFBQWEsb0JBQW9CLGdCQUFnQixZQUFZLFVBQVUsTUFBTSxLQUFLLGNBQWMsY0FBYztBQUMzSTsiLAogICJuYW1lcyI6IFsiQ29uc3RhbnRzIiwgInJlc29sdmUiXQp9Cg==
