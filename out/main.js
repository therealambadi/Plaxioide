import * as path from "path";
import * as fs from "original-fs";
import * as os from "os";
import { performance } from "perf_hooks";
import { configurePortable } from "./bootstrap-node.js";
import { bootstrapESM } from "./bootstrap-esm.js";
import { fileURLToPath } from "url";
import { createRequire as __createRequire } from "module";
const { app, protocol, crashReporter, Menu, contentTracing } = __createRequire(import.meta.url)("electron");
import minimist from "minimist";
import { product } from "./bootstrap-meta.js";
import { parse } from "./vs/base/common/jsonc.js";
import { getUserDataPath } from "./vs/platform/environment/node/userDataPath.js";
import * as perf from "./vs/base/common/performance.js";
import { resolveNLSConfiguration } from "./vs/base/node/nls.js";
import { getUNCHost, addUNCHostToAllowlist } from "./vs/base/node/unc.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
perf.mark("code/didStartMain");
perf.mark("code/willLoadMainBundle", {
  // When built, the main bundle is a single JS file with all
  // dependencies inlined. As such, we mark `willLoadMainBundle`
  // as the start of the main bundle loading process.
  startTime: Math.floor(performance.timeOrigin)
});
perf.mark("code/didLoadMainBundle");
const portable = configurePortable(product);
const args = parseCLIArgs();
const argvConfig = configureCommandlineSwitchesSync(args);
if (args["sandbox"] && !args["disable-chromium-sandbox"] && !argvConfig["disable-chromium-sandbox"]) {
  app.enableSandbox();
} else if (app.commandLine.hasSwitch("no-sandbox") && !app.commandLine.hasSwitch("disable-gpu-sandbox")) {
  app.commandLine.appendSwitch("disable-gpu-sandbox");
} else {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}
const userDataPath = getUserDataPath(args, product.nameShort ?? "code-oss-dev");
if (process.platform === "win32") {
  const userDataUNCHost = getUNCHost(userDataPath);
  if (userDataUNCHost) {
    addUNCHostToAllowlist(userDataUNCHost);
  }
}
app.setPath("userData", userDataPath);
const codeCachePath = getCodeCachePath();
Menu.setApplicationMenu(null);
perf.mark("code/willStartCrashReporter");
if (args["crash-reporter-directory"] || argvConfig["enable-crash-reporter"] && !args["disable-crash-reporter"]) {
  configureCrashReporter();
}
perf.mark("code/didStartCrashReporter");
if (portable && portable.isPortable) {
  app.setAppLogsPath(path.join(userDataPath, "logs"));
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "vscode-webview",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, codeCache: true }
  },
  {
    scheme: "vscode-file",
    privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, codeCache: true }
  }
]);
registerListeners();
let nlsConfigurationPromise = void 0;
const osLocale = processZhLocale((app.getPreferredSystemLanguages()?.[0] ?? "en").toLowerCase());
const userLocale = getUserDefinedLocale(argvConfig);
if (userLocale) {
  nlsConfigurationPromise = resolveNLSConfiguration({
    userLocale,
    osLocale,
    commit: product.commit,
    userDataPath,
    nlsMetadataPath: __dirname
  });
}
if (process.platform === "win32" || process.platform === "linux") {
  const electronLocale = !userLocale || userLocale === "qps-ploc" ? "en" : userLocale;
  app.commandLine.appendSwitch("lang", electronLocale);
}
app.once("ready", function() {
  if (args["trace"]) {
    let traceOptions;
    if (args["trace-memory-infra"]) {
      const customCategories = args["trace-category-filter"]?.split(",") || [];
      customCategories.push("disabled-by-default-memory-infra", "disabled-by-default-memory-infra.v8.code_stats");
      traceOptions = {
        included_categories: customCategories,
        excluded_categories: ["*"],
        memory_dump_config: {
          allowed_dump_modes: ["light", "detailed"],
          triggers: [
            {
              type: "periodic_interval",
              mode: "detailed",
              min_time_between_dumps_ms: 1e4
            },
            {
              type: "periodic_interval",
              mode: "light",
              min_time_between_dumps_ms: 1e3
            }
          ]
        }
      };
    } else {
      traceOptions = {
        categoryFilter: args["trace-category-filter"] || "*",
        traceOptions: args["trace-options"] || "record-until-full,enable-sampling"
      };
    }
    contentTracing.startRecording(traceOptions).finally(() => onReady());
  } else {
    onReady();
  }
});
// HMR intentionally disabled \u2014 auto-reload interrupts active AI tasks.
// To apply React changes: run buildandrun.sh which does a clean relaunch.
function startReactHMR() { }
async function onReady() {
  perf.mark("code/mainAppReady");
  try {
    const [, nlsConfig] = await Promise.all([
      mkdirpIgnoreError(codeCachePath),
      resolveNlsConfiguration()
    ]);
    await startup(codeCachePath, nlsConfig);
  } catch (error) {
    console.error(error);
  } finally {
    startReactHMR();
  }
}
async function startup(codeCachePath2, nlsConfig) {
  process.env["VSCODE_NLS_CONFIG"] = JSON.stringify(nlsConfig);
  process.env["VSCODE_CODE_CACHE_PATH"] = codeCachePath2 || "";
  await bootstrapESM();
  await import("./vs/code/electron-main/main.js");
  perf.mark("code/didRunMainBundle");
}
function configureCommandlineSwitchesSync(cliArgs) {
  const SUPPORTED_ELECTRON_SWITCHES = [
    // alias from us for --disable-gpu
    "disable-hardware-acceleration",
    // override for the color profile to use
    "force-color-profile",
    // disable LCD font rendering, a Chromium flag
    "disable-lcd-text",
    // bypass any specified proxy for the given semi-colon-separated list of hosts
    "proxy-bypass-list"
  ];
  if (process.platform === "linux") {
    SUPPORTED_ELECTRON_SWITCHES.push("force-renderer-accessibility");
    SUPPORTED_ELECTRON_SWITCHES.push("password-store");
  }
  const SUPPORTED_MAIN_PROCESS_SWITCHES = [
    // Persistently enable proposed api via argv.json: https://github.com/microsoft/vscode/issues/99775
    "enable-proposed-api",
    // Log level to use. Default is 'info'. Allowed values are 'error', 'warn', 'info', 'debug', 'trace', 'off'.
    "log-level",
    // Use an in-memory storage for secrets
    "use-inmemory-secretstorage"
  ];
  const argvConfig2 = readArgvConfigSync();
  Object.keys(argvConfig2).forEach((argvKey) => {
    const argvValue = argvConfig2[argvKey];
    if (SUPPORTED_ELECTRON_SWITCHES.indexOf(argvKey) !== -1) {
      if (argvValue === true || argvValue === "true") {
        if (argvKey === "disable-hardware-acceleration") {
          app.disableHardwareAcceleration();
        } else {
          app.commandLine.appendSwitch(argvKey);
        }
      } else if (typeof argvValue === "string" && argvValue) {
        if (argvKey === "password-store") {
          let migratedArgvValue = argvValue;
          if (argvValue === "gnome" || argvValue === "gnome-keyring") {
            migratedArgvValue = "gnome-libsecret";
          }
          app.commandLine.appendSwitch(argvKey, migratedArgvValue);
        } else {
          app.commandLine.appendSwitch(argvKey, argvValue);
        }
      }
    } else if (SUPPORTED_MAIN_PROCESS_SWITCHES.indexOf(argvKey) !== -1) {
      switch (argvKey) {
        case "enable-proposed-api":
          if (Array.isArray(argvValue)) {
            argvValue.forEach((id) => id && typeof id === "string" && process.argv.push("--enable-proposed-api", id));
          } else {
            console.error(`Unexpected value for \`enable-proposed-api\` in argv.json. Expected array of extension ids.`);
          }
          break;
        case "log-level":
          if (typeof argvValue === "string") {
            process.argv.push("--log", argvValue);
          } else if (Array.isArray(argvValue)) {
            for (const value of argvValue) {
              process.argv.push("--log", value);
            }
          }
          break;
        case "use-inmemory-secretstorage":
          if (argvValue) {
            process.argv.push("--use-inmemory-secretstorage");
          }
          break;
      }
    }
  });
  const featuresToEnable = `DocumentPolicyIncludeJSCallStacksInCrashReports, ${app.commandLine.getSwitchValue("enable-features")}`;
  app.commandLine.appendSwitch("enable-features", featuresToEnable);
  const featuresToDisable = `CalculateNativeWinOcclusion,${app.commandLine.getSwitchValue("disable-features")}`;
  app.commandLine.appendSwitch("disable-features", featuresToDisable);
  const blinkFeaturesToDisable = `FontMatchingCTMigration,StandardizedBrowserZoom,${app.commandLine.getSwitchValue("disable-blink-features")}`;
  app.commandLine.appendSwitch("disable-blink-features", blinkFeaturesToDisable);
  const jsFlags = getJSFlags(cliArgs);
  if (jsFlags) {
    app.commandLine.appendSwitch("js-flags", jsFlags);
  }
  app.commandLine.appendSwitch("xdg-portal-required-version", "4");
  return argvConfig2;
}
function readArgvConfigSync() {
  const argvConfigPath = getArgvConfigPath();
  let argvConfig2 = void 0;
  try {
    argvConfig2 = parse(fs.readFileSync(argvConfigPath).toString());
  } catch (error) {
    if (error && error.code === "ENOENT") {
      createDefaultArgvConfigSync(argvConfigPath);
    } else {
      console.warn(`Unable to read argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
    }
  }
  if (!argvConfig2) {
    argvConfig2 = {};
  }
  return argvConfig2;
}
function createDefaultArgvConfigSync(argvConfigPath) {
  try {
    const argvConfigPathDirname = path.dirname(argvConfigPath);
    if (!fs.existsSync(argvConfigPathDirname)) {
      fs.mkdirSync(argvConfigPathDirname);
    }
    const defaultArgvConfigContent = [
      "// This configuration file allows you to pass permanent command line arguments to VS Code.",
      "// Only a subset of arguments is currently supported to reduce the likelihood of breaking",
      "// the installation.",
      "//",
      "// PLEASE DO NOT CHANGE WITHOUT UNDERSTANDING THE IMPACT",
      "//",
      "// NOTE: Changing this file requires a restart of VS Code.",
      "{",
      "	// Use software rendering instead of hardware accelerated rendering.",
      "	// This can help in cases where you see rendering issues in VS Code.",
      '	// "disable-hardware-acceleration": true',
      "}"
    ];
    fs.writeFileSync(argvConfigPath, defaultArgvConfigContent.join("\n"));
  } catch (error) {
    console.error(`Unable to create argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
  }
}
function getArgvConfigPath() {
  const vscodePortable = process.env["VSCODE_PORTABLE"];
  if (vscodePortable) {
    return path.join(vscodePortable, "argv.json");
  }
  let dataFolderName = product.dataFolderName;
  if (process.env["VSCODE_DEV"]) {
    dataFolderName = `${dataFolderName}-dev`;
  }
  return path.join(os.homedir(), dataFolderName, "argv.json");
}
function configureCrashReporter() {
  let crashReporterDirectory = args["crash-reporter-directory"];
  let submitURL = "";
  if (crashReporterDirectory) {
    crashReporterDirectory = path.normalize(crashReporterDirectory);
    if (!path.isAbsolute(crashReporterDirectory)) {
      console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory must be absolute.`);
      app.exit(1);
    }
    if (!fs.existsSync(crashReporterDirectory)) {
      try {
        fs.mkdirSync(crashReporterDirectory, { recursive: true });
      } catch (error) {
        console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory does not seem to exist or cannot be created.`);
        app.exit(1);
      }
    }
    console.log(`Found --crash-reporter-directory argument. Setting crashDumps directory to be '${crashReporterDirectory}'`);
    app.setPath("crashDumps", crashReporterDirectory);
  } else {
    const appCenter = product.appCenter;
    if (appCenter) {
      const isWindows = process.platform === "win32";
      const isLinux = process.platform === "linux";
      const isDarwin = process.platform === "darwin";
      const crashReporterId = argvConfig["crash-reporter-id"];
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (crashReporterId && uuidPattern.test(crashReporterId)) {
        if (isWindows) {
          switch (process.arch) {
            case "x64":
              submitURL = appCenter["win32-x64"];
              break;
            case "arm64":
              submitURL = appCenter["win32-arm64"];
              break;
          }
        } else if (isDarwin) {
          if (product.darwinUniversalAssetId) {
            submitURL = appCenter["darwin-universal"];
          } else {
            switch (process.arch) {
              case "x64":
                submitURL = appCenter["darwin"];
                break;
              case "arm64":
                submitURL = appCenter["darwin-arm64"];
                break;
            }
          }
        } else if (isLinux) {
          submitURL = appCenter["linux-x64"];
        }
        submitURL = submitURL.concat("&uid=", crashReporterId, "&iid=", crashReporterId, "&sid=", crashReporterId);
        const argv = process.argv;
        const endOfArgsMarkerIndex = argv.indexOf("--");
        if (endOfArgsMarkerIndex === -1) {
          argv.push("--crash-reporter-id", crashReporterId);
        } else {
          argv.splice(endOfArgsMarkerIndex, 0, "--crash-reporter-id", crashReporterId);
        }
      }
    }
  }
  const productName = (product.crashReporter ? product.crashReporter.productName : void 0) || product.nameShort;
  const companyName = (product.crashReporter ? product.crashReporter.companyName : void 0) || "Microsoft";
  const uploadToServer = Boolean(!process.env["VSCODE_DEV"] && submitURL && !crashReporterDirectory);
  crashReporter.start({
    companyName,
    productName: process.env["VSCODE_DEV"] ? `${productName} Dev` : productName,
    submitURL,
    uploadToServer,
    compress: true
  });
}
function getJSFlags(cliArgs) {
  const jsFlags = [];
  if (cliArgs["js-flags"]) {
    jsFlags.push(cliArgs["js-flags"]);
  }
  if (process.platform === "linux") {
    jsFlags.push("--nodecommit_pooled_pages");
  }
  return jsFlags.length > 0 ? jsFlags.join(" ") : null;
}
function parseCLIArgs() {
  return minimist(process.argv, {
    string: [
      "user-data-dir",
      "locale",
      "js-flags",
      "crash-reporter-directory"
    ],
    boolean: [
      "disable-chromium-sandbox"
    ],
    default: {
      "sandbox": true
    },
    alias: {
      "no-sandbox": "sandbox"
    }
  });
}
function registerListeners() {
  const macOpenFiles = [];
  globalThis["macOpenFiles"] = macOpenFiles;
  app.on("open-file", function(event, path2) {
    macOpenFiles.push(path2);
  });
  const openUrls = [];
  const onOpenUrl = function(event, url) {
    event.preventDefault();
    openUrls.push(url);
  };
  app.on("will-finish-launching", function() {
    app.on("open-url", onOpenUrl);
  });
  globalThis["getOpenUrls"] = function() {
    app.removeListener("open-url", onOpenUrl);
    return openUrls;
  };
}
function getCodeCachePath() {
  if (process.argv.indexOf("--no-cached-data") > 0) {
    return void 0;
  }
  if (process.env["VSCODE_DEV"]) {
    return void 0;
  }
  const commit = product.commit;
  if (!commit) {
    return void 0;
  }
  return path.join(userDataPath, "CachedData", commit);
}
async function mkdirpIgnoreError(dir) {
  if (typeof dir === "string") {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      return dir;
    } catch (error) {
    }
  }
  return void 0;
}
function processZhLocale(appLocale) {
  if (appLocale.startsWith("zh")) {
    const region = appLocale.split("-")[1];
    if (["hans", "cn", "sg", "my"].includes(region)) {
      return "zh-cn";
    }
    return "zh-tw";
  }
  return appLocale;
}
async function resolveNlsConfiguration() {
  const nlsConfiguration = nlsConfigurationPromise ? await nlsConfigurationPromise : void 0;
  if (nlsConfiguration) {
    return nlsConfiguration;
  }
  let userLocale2 = app.getLocale();
  if (!userLocale2) {
    return {
      userLocale: "en",
      osLocale,
      resolvedLanguage: "en",
      defaultMessagesFile: path.join(__dirname, "nls.messages.json"),
      // NLS: below 2 are a relic from old times only used by vscode-nls and deprecated
      locale: "en",
      availableLanguages: {}
    };
  }
  userLocale2 = processZhLocale(userLocale2.toLowerCase());
  return resolveNLSConfiguration({
    userLocale: userLocale2,
    osLocale,
    commit: product.commit,
    userDataPath,
    nlsMetadataPath: __dirname
  });
}
function getUserDefinedLocale(argvConfig2) {
  const locale = args["locale"];
  if (locale) {
    return locale.toLowerCase();
  }
  return typeof argvConfig2?.locale === "string" ? argvConfig2.locale.toLowerCase() : void 0;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy9tYWluLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ29yaWdpbmFsLWZzJztcbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCB7IHBlcmZvcm1hbmNlIH0gZnJvbSAncGVyZl9ob29rcyc7XG5pbXBvcnQgeyBjb25maWd1cmVQb3J0YWJsZSB9IGZyb20gJy4vYm9vdHN0cmFwLW5vZGUuanMnO1xuaW1wb3J0IHsgYm9vdHN0cmFwRVNNIH0gZnJvbSAnLi9ib290c3RyYXAtZXNtLmpzJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSBhcyBfX2NyZWF0ZVJlcXVpcmUgfSBmcm9tICdtb2R1bGUnO1xuLy8gV29ya2Fyb3VuZDogRWxlY3Ryb24gMzQgb24gbWFjT1MgMjcgY2Fubm90IHN0YXRpYy1FU00taW1wb3J0IHRoZSAnZWxlY3Ryb24nIGJ1aWx0LWluIG1vZHVsZVxuLy8gKGNqc1ByZXBhcnNlTW9kdWxlRXhwb3J0cyBmYWlscyBiZWNhdXNlIHRoZSBidWlsdC1pbiBoYXMgbm8gQ0pTIG1vZHVsZS5leHBvcnRzIHdyYXBwZXIpLlxuLy8gVXNpbmcgY3JlYXRlUmVxdWlyZSBhdCBydW50aW1lIHdvcmtzIGJlY2F1c2UgYnkgdGhlbiB0aGUgcHJvY2VzcyBjb250ZXh0IGlzIHJlYWR5LlxuY29uc3QgeyBhcHAsIHByb3RvY29sLCBjcmFzaFJlcG9ydGVyLCBNZW51LCBjb250ZW50VHJhY2luZyB9ID0gX19jcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCkoJ2VsZWN0cm9uJykgYXMgdHlwZW9mIGltcG9ydCgnZWxlY3Ryb24nKTtcbmltcG9ydCBtaW5pbWlzdCBmcm9tICdtaW5pbWlzdCc7XG5pbXBvcnQgeyBwcm9kdWN0IH0gZnJvbSAnLi9ib290c3RyYXAtbWV0YS5qcyc7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gJy4vdnMvYmFzZS9jb21tb24vanNvbmMuanMnO1xuaW1wb3J0IHsgZ2V0VXNlckRhdGFQYXRoIH0gZnJvbSAnLi92cy9wbGF0Zm9ybS9lbnZpcm9ubWVudC9ub2RlL3VzZXJEYXRhUGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBwZXJmIGZyb20gJy4vdnMvYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZU5MU0NvbmZpZ3VyYXRpb24gfSBmcm9tICcuL3ZzL2Jhc2Uvbm9kZS9ubHMuanMnO1xuaW1wb3J0IHsgZ2V0VU5DSG9zdCwgYWRkVU5DSG9zdFRvQWxsb3dsaXN0IH0gZnJvbSAnLi92cy9iYXNlL25vZGUvdW5jLmpzJztcbmltcG9ydCB7IElOTFNDb25maWd1cmF0aW9uIH0gZnJvbSAnLi92cy9ubHMuanMnO1xuaW1wb3J0IHsgTmF0aXZlUGFyc2VkQXJncyB9IGZyb20gJy4vdnMvcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2FyZ3YuanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcblxucGVyZi5tYXJrKCdjb2RlL2RpZFN0YXJ0TWFpbicpO1xuXG5wZXJmLm1hcmsoJ2NvZGUvd2lsbExvYWRNYWluQnVuZGxlJywge1xuXHQvLyBXaGVuIGJ1aWx0LCB0aGUgbWFpbiBidW5kbGUgaXMgYSBzaW5nbGUgSlMgZmlsZSB3aXRoIGFsbFxuXHQvLyBkZXBlbmRlbmNpZXMgaW5saW5lZC4gQXMgc3VjaCwgd2UgbWFyayBgd2lsbExvYWRNYWluQnVuZGxlYFxuXHQvLyBhcyB0aGUgc3RhcnQgb2YgdGhlIG1haW4gYnVuZGxlIGxvYWRpbmcgcHJvY2Vzcy5cblx0c3RhcnRUaW1lOiBNYXRoLmZsb29yKHBlcmZvcm1hbmNlLnRpbWVPcmlnaW4pXG59KTtcbnBlcmYubWFyaygnY29kZS9kaWRMb2FkTWFpbkJ1bmRsZScpO1xuXG4vLyBFbmFibGUgcG9ydGFibGUgc3VwcG9ydFxuY29uc3QgcG9ydGFibGUgPSBjb25maWd1cmVQb3J0YWJsZShwcm9kdWN0KTtcblxuY29uc3QgYXJncyA9IHBhcnNlQ0xJQXJncygpO1xuLy8gQ29uZmlndXJlIHN0YXRpYyBjb21tYW5kIGxpbmUgYXJndW1lbnRzXG5jb25zdCBhcmd2Q29uZmlnID0gY29uZmlndXJlQ29tbWFuZGxpbmVTd2l0Y2hlc1N5bmMoYXJncyk7XG4vLyBFbmFibGUgc2FuZGJveCBnbG9iYWxseSB1bmxlc3Ncbi8vIDEpIGRpc2FibGVkIHZpYSBjb21tYW5kIGxpbmUgdXNpbmcgZWl0aGVyXG4vLyAgICBgLS1uby1zYW5kYm94YCBvciBgLS1kaXNhYmxlLWNocm9taXVtLXNhbmRib3hgIGFyZ3VtZW50LlxuLy8gMikgYXJndi5qc29uIGNvbnRhaW5zIGBkaXNhYmxlLWNocm9taXVtLXNhbmRib3g6IHRydWVgLlxuaWYgKGFyZ3NbJ3NhbmRib3gnXSAmJlxuXHQhYXJnc1snZGlzYWJsZS1jaHJvbWl1bS1zYW5kYm94J10gJiZcblx0IWFyZ3ZDb25maWdbJ2Rpc2FibGUtY2hyb21pdW0tc2FuZGJveCddKSB7XG5cdGFwcC5lbmFibGVTYW5kYm94KCk7XG59IGVsc2UgaWYgKGFwcC5jb21tYW5kTGluZS5oYXNTd2l0Y2goJ25vLXNhbmRib3gnKSAmJlxuXHQhYXBwLmNvbW1hbmRMaW5lLmhhc1N3aXRjaCgnZGlzYWJsZS1ncHUtc2FuZGJveCcpKSB7XG5cdC8vIERpc2FibGUgR1BVIHNhbmRib3ggd2hlbmV2ZXIgLS1uby1zYW5kYm94IGlzIHVzZWQuXG5cdGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2Rpc2FibGUtZ3B1LXNhbmRib3gnKTtcbn0gZWxzZSB7XG5cdGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ25vLXNhbmRib3gnKTtcblx0YXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS1ncHUtc2FuZGJveCcpO1xufVxuXG4vLyBTZXQgdXNlckRhdGEgcGF0aCBiZWZvcmUgYXBwICdyZWFkeScgZXZlbnRcbmNvbnN0IHVzZXJEYXRhUGF0aCA9IGdldFVzZXJEYXRhUGF0aChhcmdzLCBwcm9kdWN0Lm5hbWVTaG9ydCA/PyAnY29kZS1vc3MtZGV2Jyk7XG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuXHRjb25zdCB1c2VyRGF0YVVOQ0hvc3QgPSBnZXRVTkNIb3N0KHVzZXJEYXRhUGF0aCk7XG5cdGlmICh1c2VyRGF0YVVOQ0hvc3QpIHtcblx0XHRhZGRVTkNIb3N0VG9BbGxvd2xpc3QodXNlckRhdGFVTkNIb3N0KTsgLy8gZW5hYmxlcyB0byB1c2UgVU5DIHBhdGhzIGluIHVzZXJEYXRhUGF0aFxuXHR9XG59XG5hcHAuc2V0UGF0aCgndXNlckRhdGEnLCB1c2VyRGF0YVBhdGgpO1xuXG4vLyBSZXNvbHZlIGNvZGUgY2FjaGUgcGF0aFxuY29uc3QgY29kZUNhY2hlUGF0aCA9IGdldENvZGVDYWNoZVBhdGgoKTtcblxuLy8gRGlzYWJsZSBkZWZhdWx0IG1lbnUgKGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMzU1MTIpXG5NZW51LnNldEFwcGxpY2F0aW9uTWVudShudWxsKTtcblxuLy8gQ29uZmlndXJlIGNyYXNoIHJlcG9ydGVyXG5wZXJmLm1hcmsoJ2NvZGUvd2lsbFN0YXJ0Q3Jhc2hSZXBvcnRlcicpO1xuLy8gSWYgYSBjcmFzaC1yZXBvcnRlci1kaXJlY3RvcnkgaXMgc3BlY2lmaWVkIHdlIHN0b3JlIHRoZSBjcmFzaCByZXBvcnRzXG4vLyBpbiB0aGUgc3BlY2lmaWVkIGRpcmVjdG9yeSBhbmQgZG9uJ3QgdXBsb2FkIHRoZW0gdG8gdGhlIGNyYXNoIHNlcnZlci5cbi8vXG4vLyBBcHBjZW50ZXIgY3Jhc2ggcmVwb3J0aW5nIGlzIGVuYWJsZWQgaWZcbi8vICogZW5hYmxlLWNyYXNoLXJlcG9ydGVyIHJ1bnRpbWUgYXJndW1lbnQgaXMgc2V0IHRvICd0cnVlJ1xuLy8gKiAtLWRpc2FibGUtY3Jhc2gtcmVwb3J0ZXIgY29tbWFuZCBsaW5lIHBhcmFtZXRlciBpcyBub3Qgc2V0XG4vL1xuLy8gRGlzYWJsZSBjcmFzaCByZXBvcnRpbmcgaW4gYWxsIG90aGVyIGNhc2VzLlxuaWYgKGFyZ3NbJ2NyYXNoLXJlcG9ydGVyLWRpcmVjdG9yeSddIHx8IChhcmd2Q29uZmlnWydlbmFibGUtY3Jhc2gtcmVwb3J0ZXInXSAmJiAhYXJnc1snZGlzYWJsZS1jcmFzaC1yZXBvcnRlciddKSkge1xuXHRjb25maWd1cmVDcmFzaFJlcG9ydGVyKCk7XG59XG5wZXJmLm1hcmsoJ2NvZGUvZGlkU3RhcnRDcmFzaFJlcG9ydGVyJyk7XG5cbi8vIFNldCBsb2dzIHBhdGggYmVmb3JlIGFwcCAncmVhZHknIGV2ZW50IGlmIHJ1bm5pbmcgcG9ydGFibGVcbi8vIHRvIGVuc3VyZSB0aGF0IG5vICdsb2dzJyBmb2xkZXIgaXMgY3JlYXRlZCBvbiBkaXNrIGF0IGFcbi8vIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIHBvcnRhYmxlIGRpcmVjdG9yeVxuLy8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy81NjY1MSlcbmlmIChwb3J0YWJsZSAmJiBwb3J0YWJsZS5pc1BvcnRhYmxlKSB7XG5cdGFwcC5zZXRBcHBMb2dzUGF0aChwYXRoLmpvaW4odXNlckRhdGFQYXRoLCAnbG9ncycpKTtcbn1cblxuLy8gUmVnaXN0ZXIgY3VzdG9tIHNjaGVtZXMgd2l0aCBwcml2aWxlZ2VzXG5wcm90b2NvbC5yZWdpc3RlclNjaGVtZXNBc1ByaXZpbGVnZWQoW1xuXHR7XG5cdFx0c2NoZW1lOiAndnNjb2RlLXdlYnZpZXcnLFxuXHRcdHByaXZpbGVnZXM6IHsgc3RhbmRhcmQ6IHRydWUsIHNlY3VyZTogdHJ1ZSwgc3VwcG9ydEZldGNoQVBJOiB0cnVlLCBjb3JzRW5hYmxlZDogdHJ1ZSwgYWxsb3dTZXJ2aWNlV29ya2VyczogdHJ1ZSwgY29kZUNhY2hlOiB0cnVlIH1cblx0fSxcblx0e1xuXHRcdHNjaGVtZTogJ3ZzY29kZS1maWxlJyxcblx0XHRwcml2aWxlZ2VzOiB7IHNlY3VyZTogdHJ1ZSwgc3RhbmRhcmQ6IHRydWUsIHN1cHBvcnRGZXRjaEFQSTogdHJ1ZSwgY29yc0VuYWJsZWQ6IHRydWUsIGNvZGVDYWNoZTogdHJ1ZSB9XG5cdH1cbl0pO1xuXG4vLyBHbG9iYWwgYXBwIGxpc3RlbmVyc1xucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblxuLyoqXG4gKiBXZSBjYW4gcmVzb2x2ZSB0aGUgTkxTIGNvbmZpZ3VyYXRpb24gZWFybHkgaWYgaXQgaXMgZGVmaW5lZFxuICogaW4gYXJndi5qc29uIGJlZm9yZSBgYXBwLnJlYWR5YCBldmVudC4gT3RoZXJ3aXNlIHdlIGNhbiBvbmx5XG4gKiByZXNvbHZlIE5MUyBhZnRlciBgYXBwLnJlYWR5YCBldmVudCB0byByZXNvbHZlIHRoZSBPUyBsb2NhbGUuXG4gKi9cbmxldCBubHNDb25maWd1cmF0aW9uUHJvbWlzZTogUHJvbWlzZTxJTkxTQ29uZmlndXJhdGlvbj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbi8vIFVzZSB0aGUgbW9zdCBwcmVmZXJyZWQgT1MgbGFuZ3VhZ2UgZm9yIGxhbmd1YWdlIHJlY29tbWVuZGF0aW9uLlxuLy8gVGhlIEFQSSBtaWdodCByZXR1cm4gYW4gZW1wdHkgYXJyYXkgb24gTGludXgsIHN1Y2ggYXMgd2hlblxuLy8gdGhlICdDJyBsb2NhbGUgaXMgdGhlIHVzZXIncyBvbmx5IGNvbmZpZ3VyZWQgbG9jYWxlLlxuLy8gTm8gbWF0dGVyIHRoZSBPUywgaWYgdGhlIGFycmF5IGlzIGVtcHR5LCBkZWZhdWx0IGJhY2sgdG8gJ2VuJy5cbmNvbnN0IG9zTG9jYWxlID0gcHJvY2Vzc1poTG9jYWxlKChhcHAuZ2V0UHJlZmVycmVkU3lzdGVtTGFuZ3VhZ2VzKCk/LlswXSA/PyAnZW4nKS50b0xvd2VyQ2FzZSgpKTtcbmNvbnN0IHVzZXJMb2NhbGUgPSBnZXRVc2VyRGVmaW5lZExvY2FsZShhcmd2Q29uZmlnKTtcbmlmICh1c2VyTG9jYWxlKSB7XG5cdG5sc0NvbmZpZ3VyYXRpb25Qcm9taXNlID0gcmVzb2x2ZU5MU0NvbmZpZ3VyYXRpb24oe1xuXHRcdHVzZXJMb2NhbGUsXG5cdFx0b3NMb2NhbGUsXG5cdFx0Y29tbWl0OiBwcm9kdWN0LmNvbW1pdCxcblx0XHR1c2VyRGF0YVBhdGgsXG5cdFx0bmxzTWV0YWRhdGFQYXRoOiBfX2Rpcm5hbWVcblx0fSk7XG59XG5cbi8vIFBhc3MgaW4gdGhlIGxvY2FsZSB0byBFbGVjdHJvbiBzbyB0aGF0IHRoZVxuLy8gV2luZG93cyBDb250cm9sIE92ZXJsYXkgaXMgcmVuZGVyZWQgY29ycmVjdGx5IG9uIFdpbmRvd3MuXG4vLyBGb3Igbm93LCBkb24ndCBwYXNzIGluIHRoZSBsb2NhbGUgb24gbWFjT1MgZHVlIHRvXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTY3NTQzLlxuLy8gSWYgdGhlIGxvY2FsZSBpcyBgcXBzLXBsb2NgLCB0aGUgTWljcm9zb2Z0XG4vLyBQc2V1ZG8gTGFuZ3VhZ2UgTGFuZ3VhZ2UgUGFjayBpcyBiZWluZyB1c2VkLlxuLy8gSW4gdGhhdCBjYXNlLCB1c2UgYGVuYCBhcyB0aGUgRWxlY3Ryb24gbG9jYWxlLlxuXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyB8fCBwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG5cdGNvbnN0IGVsZWN0cm9uTG9jYWxlID0gKCF1c2VyTG9jYWxlIHx8IHVzZXJMb2NhbGUgPT09ICdxcHMtcGxvYycpID8gJ2VuJyA6IHVzZXJMb2NhbGU7XG5cdGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCBlbGVjdHJvbkxvY2FsZSk7XG59XG5cbi8vIExvYWQgb3VyIGNvZGUgb25jZSByZWFkeVxuYXBwLm9uY2UoJ3JlYWR5JywgZnVuY3Rpb24gKCkge1xuXHRpZiAoYXJnc1sndHJhY2UnXSkge1xuXHRcdGxldCB0cmFjZU9wdGlvbnM6IEVsZWN0cm9uLlRyYWNlQ29uZmlnIHwgRWxlY3Ryb24uVHJhY2VDYXRlZ29yaWVzQW5kT3B0aW9ucztcblx0XHRpZiAoYXJnc1sndHJhY2UtbWVtb3J5LWluZnJhJ10pIHtcblx0XHRcdGNvbnN0IGN1c3RvbUNhdGVnb3JpZXMgPSBhcmdzWyd0cmFjZS1jYXRlZ29yeS1maWx0ZXInXT8uc3BsaXQoJywnKSB8fCBbXTtcblx0XHRcdGN1c3RvbUNhdGVnb3JpZXMucHVzaCgnZGlzYWJsZWQtYnktZGVmYXVsdC1tZW1vcnktaW5mcmEnLCAnZGlzYWJsZWQtYnktZGVmYXVsdC1tZW1vcnktaW5mcmEudjguY29kZV9zdGF0cycpO1xuXHRcdFx0dHJhY2VPcHRpb25zID0ge1xuXHRcdFx0XHRpbmNsdWRlZF9jYXRlZ29yaWVzOiBjdXN0b21DYXRlZ29yaWVzLFxuXHRcdFx0XHRleGNsdWRlZF9jYXRlZ29yaWVzOiBbJyonXSxcblx0XHRcdFx0bWVtb3J5X2R1bXBfY29uZmlnOiB7XG5cdFx0XHRcdFx0YWxsb3dlZF9kdW1wX21vZGVzOiBbJ2xpZ2h0JywgJ2RldGFpbGVkJ10sXG5cdFx0XHRcdFx0dHJpZ2dlcnM6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3BlcmlvZGljX2ludGVydmFsJyxcblx0XHRcdFx0XHRcdFx0bW9kZTogJ2RldGFpbGVkJyxcblx0XHRcdFx0XHRcdFx0bWluX3RpbWVfYmV0d2Vlbl9kdW1wc19tczogMTAwMDBcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdwZXJpb2RpY19pbnRlcnZhbCcsXG5cdFx0XHRcdFx0XHRcdG1vZGU6ICdsaWdodCcsXG5cdFx0XHRcdFx0XHRcdG1pbl90aW1lX2JldHdlZW5fZHVtcHNfbXM6IDEwMDBcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRyYWNlT3B0aW9ucyA9IHtcblx0XHRcdFx0Y2F0ZWdvcnlGaWx0ZXI6IGFyZ3NbJ3RyYWNlLWNhdGVnb3J5LWZpbHRlciddIHx8ICcqJyxcblx0XHRcdFx0dHJhY2VPcHRpb25zOiBhcmdzWyd0cmFjZS1vcHRpb25zJ10gfHwgJ3JlY29yZC11bnRpbC1mdWxsLGVuYWJsZS1zYW1wbGluZydcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Y29udGVudFRyYWNpbmcuc3RhcnRSZWNvcmRpbmcodHJhY2VPcHRpb25zKS5maW5hbGx5KCgpID0+IG9uUmVhZHkoKSk7XG5cdH0gZWxzZSB7XG5cdFx0b25SZWFkeSgpO1xuXHR9XG59KTtcblxuLy8gXHUyNTAwXHUyNTAwIERldi1tb2RlIFJlYWN0IGJ1bmRsZSB3YXRjaGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gV2hlbiBWU0NPREVfREVWPTEsIHdhdGNoIHRoZSBjb21waWxlZCBSZWFjdCBidW5kbGVzIHVzaW5nIE5vZGUncyBuYXRpdmVcbi8vIGZzLndhdGNoIChrZXJuZWwtbGV2ZWwsIG5vIHBvbGxpbmcsIHdvcmtzIGluIEVsZWN0cm9uJ3MgbWFpbiBwcm9jZXNzKS5cbi8vIE9uIGFueSAuanMgY2hhbmdlLCByZWxvYWQgYWxsIEJyb3dzZXJXaW5kb3cgd2ViQ29udGVudHMuXG5mdW5jdGlvbiBzdGFydFJlYWN0SE1SKCkge1xuXHRpZiAoIXByb2Nlc3MuZW52WydWU0NPREVfREVWJ10pIHJldHVybjtcblxuXHQvLyBfX2Rpcm5hbWUgaXMgPHJlcG8+L291dC8gYXQgcnVudGltZTsgUmVhY3QgYnVuZGxlcyBsaXZlIGluIDxyZXBvPi9zcmMvLi4uL3JlYWN0L291dC9cblx0Y29uc3QgcmVhY3RPdXREaXIgPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnc3JjJywgJ3ZzJywgJ3dvcmtiZW5jaCcsICdjb250cmliJywgJ3ZvaWQnLCAnYnJvd3NlcicsICdyZWFjdCcsICdvdXQnKTtcblx0bGV0IHJlbG9hZFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdCBkb1JlbG9hZCA9ICgpID0+IHtcblx0XHRpZiAocmVsb2FkVGltZXIpIGNsZWFyVGltZW91dChyZWxvYWRUaW1lcik7XG5cdFx0cmVsb2FkVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGNvbnN0IHsgd2ViQ29udGVudHMgfSA9IF9fY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpKCdlbGVjdHJvbicpIGFzIHR5cGVvZiBpbXBvcnQoJ2VsZWN0cm9uJyk7XG5cdFx0XHRjb25zdCBhbGwgPSB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpO1xuXHRcdFx0Y29uc29sZS5sb2coYFtyZWFjdC1obXJdIEJ1bmRsZSBjaGFuZ2VkIFx1MjAxNCByZWxvYWRpbmcgJHthbGwubGVuZ3RofSB3aW5kb3cocylgKTtcblx0XHRcdGZvciAoY29uc3Qgd2Mgb2YgYWxsKSB7XG5cdFx0XHRcdGlmICghd2MuaXNEZXN0cm95ZWQoKSkgd2MucmVsb2FkKCk7XG5cdFx0XHR9XG5cdFx0fSwgNjAwKTtcblx0fTtcblxuXHQvLyBXYXRjaCBlYWNoIHN1YmRpcmVjdG9yeSAoZnMud2F0Y2ggaXMgbm90IHJlY3Vyc2l2ZSBvbiBMaW51eCB3aXRob3V0IGV4cGxpY2l0IHJlY3Vyc2lvbilcblx0Y29uc3Qgd2F0Y2hEaXIgPSAoZGlyOiBzdHJpbmcpID0+IHtcblx0XHR0cnkge1xuXHRcdFx0ZnMud2F0Y2goZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9LCAoX2V2ZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcgfCBCdWZmZXIgfCBudWxsKSA9PiB7XG5cdFx0XHRcdGlmIChmaWxlbmFtZSAmJiBTdHJpbmcoZmlsZW5hbWUpLmVuZHNXaXRoKCcuanMnKSkge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbcmVhY3QtaG1yXSBDaGFuZ2VkOiAke2ZpbGVuYW1lfWApO1xuXHRcdFx0XHRcdGRvUmVsb2FkKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0Y29uc29sZS5sb2coYFtyZWFjdC1obXJdIFdhdGNoaW5nICR7ZGlyfWApO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUud2FybihgW3JlYWN0LWhtcl0gQ291bGQgbm90IHdhdGNoICR7ZGlyfTpgLCBlKTtcblx0XHR9XG5cdH07XG5cblx0Ly8gRGVsYXkgc3RhcnQgdW50aWwgYWZ0ZXIgdGhlIG1haW4gd2luZG93IGlzIHNob3duIHNvIHRoZSBldmVudCBsb29wIGlzIGZyZWVcblx0c2V0VGltZW91dCgoKSA9PiB3YXRjaERpcihyZWFjdE91dERpciksIDMwMDApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBvblJlYWR5KCkge1xuXHRwZXJmLm1hcmsoJ2NvZGUvbWFpbkFwcFJlYWR5Jyk7XG5cblx0dHJ5IHtcblx0XHRjb25zdCBbLCBubHNDb25maWddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0bWtkaXJwSWdub3JlRXJyb3IoY29kZUNhY2hlUGF0aCksXG5cdFx0XHRyZXNvbHZlTmxzQ29uZmlndXJhdGlvbigpXG5cdFx0XSk7XG5cblx0XHRhd2FpdCBzdGFydHVwKGNvZGVDYWNoZVBhdGgsIG5sc0NvbmZpZyk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0Y29uc29sZS5lcnJvcihlcnJvcik7XG5cdH0gZmluYWxseSB7XG5cdFx0Ly8gU3RhcnQgSE1SIGFmdGVyIGFwcCBzdGFydHVwIChydW5zIGluIGRldiBtb2RlIHJlZ2FyZGxlc3Mgb2Ygc3RhcnR1cCBlcnJvcnMpXG5cdFx0c3RhcnRSZWFjdEhNUigpO1xuXHR9XG59XG5cbi8qKlxuICogTWFpbiBzdGFydHVwIHJvdXRpbmVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gc3RhcnR1cChjb2RlQ2FjaGVQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQsIG5sc0NvbmZpZzogSU5MU0NvbmZpZ3VyYXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0cHJvY2Vzcy5lbnZbJ1ZTQ09ERV9OTFNfQ09ORklHJ10gPSBKU09OLnN0cmluZ2lmeShubHNDb25maWcpO1xuXHRwcm9jZXNzLmVudlsnVlNDT0RFX0NPREVfQ0FDSEVfUEFUSCddID0gY29kZUNhY2hlUGF0aCB8fCAnJztcblxuXHQvLyBCb290c3RyYXAgRVNNXG5cdGF3YWl0IGJvb3RzdHJhcEVTTSgpO1xuXG5cdC8vIExvYWQgTWFpblxuXHRhd2FpdCBpbXBvcnQoJy4vdnMvY29kZS9lbGVjdHJvbi1tYWluL21haW4uanMnKTtcblx0cGVyZi5tYXJrKCdjb2RlL2RpZFJ1bk1haW5CdW5kbGUnKTtcbn1cblxuZnVuY3Rpb24gY29uZmlndXJlQ29tbWFuZGxpbmVTd2l0Y2hlc1N5bmMoY2xpQXJnczogTmF0aXZlUGFyc2VkQXJncykge1xuXHRjb25zdCBTVVBQT1JURURfRUxFQ1RST05fU1dJVENIRVMgPSBbXG5cblx0XHQvLyBhbGlhcyBmcm9tIHVzIGZvciAtLWRpc2FibGUtZ3B1XG5cdFx0J2Rpc2FibGUtaGFyZHdhcmUtYWNjZWxlcmF0aW9uJyxcblxuXHRcdC8vIG92ZXJyaWRlIGZvciB0aGUgY29sb3IgcHJvZmlsZSB0byB1c2Vcblx0XHQnZm9yY2UtY29sb3ItcHJvZmlsZScsXG5cblx0XHQvLyBkaXNhYmxlIExDRCBmb250IHJlbmRlcmluZywgYSBDaHJvbWl1bSBmbGFnXG5cdFx0J2Rpc2FibGUtbGNkLXRleHQnLFxuXG5cdFx0Ly8gYnlwYXNzIGFueSBzcGVjaWZpZWQgcHJveHkgZm9yIHRoZSBnaXZlbiBzZW1pLWNvbG9uLXNlcGFyYXRlZCBsaXN0IG9mIGhvc3RzXG5cdFx0J3Byb3h5LWJ5cGFzcy1saXN0J1xuXHRdO1xuXG5cdGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG5cblx0XHQvLyBGb3JjZSBlbmFibGUgc2NyZWVuIHJlYWRlcnMgb24gTGludXggdmlhIHRoaXMgZmxhZ1xuXHRcdFNVUFBPUlRFRF9FTEVDVFJPTl9TV0lUQ0hFUy5wdXNoKCdmb3JjZS1yZW5kZXJlci1hY2Nlc3NpYmlsaXR5Jyk7XG5cblx0XHQvLyBvdmVycmlkZSB3aGljaCBwYXNzd29yZC1zdG9yZSBpcyB1c2VkIG9uIExpbnV4XG5cdFx0U1VQUE9SVEVEX0VMRUNUUk9OX1NXSVRDSEVTLnB1c2goJ3Bhc3N3b3JkLXN0b3JlJyk7XG5cdH1cblxuXHRjb25zdCBTVVBQT1JURURfTUFJTl9QUk9DRVNTX1NXSVRDSEVTID0gW1xuXG5cdFx0Ly8gUGVyc2lzdGVudGx5IGVuYWJsZSBwcm9wb3NlZCBhcGkgdmlhIGFyZ3YuanNvbjogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk5Nzc1XG5cdFx0J2VuYWJsZS1wcm9wb3NlZC1hcGknLFxuXG5cdFx0Ly8gTG9nIGxldmVsIHRvIHVzZS4gRGVmYXVsdCBpcyAnaW5mbycuIEFsbG93ZWQgdmFsdWVzIGFyZSAnZXJyb3InLCAnd2FybicsICdpbmZvJywgJ2RlYnVnJywgJ3RyYWNlJywgJ29mZicuXG5cdFx0J2xvZy1sZXZlbCcsXG5cblx0XHQvLyBVc2UgYW4gaW4tbWVtb3J5IHN0b3JhZ2UgZm9yIHNlY3JldHNcblx0XHQndXNlLWlubWVtb3J5LXNlY3JldHN0b3JhZ2UnXG5cdF07XG5cblx0Ly8gUmVhZCBhcmd2IGNvbmZpZ1xuXHRjb25zdCBhcmd2Q29uZmlnID0gcmVhZEFyZ3ZDb25maWdTeW5jKCk7XG5cblx0T2JqZWN0LmtleXMoYXJndkNvbmZpZykuZm9yRWFjaChhcmd2S2V5ID0+IHtcblx0XHRjb25zdCBhcmd2VmFsdWUgPSBhcmd2Q29uZmlnW2FyZ3ZLZXldO1xuXG5cdFx0Ly8gQXBwZW5kIEVsZWN0cm9uIGZsYWdzIHRvIEVsZWN0cm9uXG5cdFx0aWYgKFNVUFBPUlRFRF9FTEVDVFJPTl9TV0lUQ0hFUy5pbmRleE9mKGFyZ3ZLZXkpICE9PSAtMSkge1xuXHRcdFx0aWYgKGFyZ3ZWYWx1ZSA9PT0gdHJ1ZSB8fCBhcmd2VmFsdWUgPT09ICd0cnVlJykge1xuXHRcdFx0XHRpZiAoYXJndktleSA9PT0gJ2Rpc2FibGUtaGFyZHdhcmUtYWNjZWxlcmF0aW9uJykge1xuXHRcdFx0XHRcdGFwcC5kaXNhYmxlSGFyZHdhcmVBY2NlbGVyYXRpb24oKTsgLy8gbmVlZHMgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHlcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKGFyZ3ZLZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBhcmd2VmFsdWUgPT09ICdzdHJpbmcnICYmIGFyZ3ZWYWx1ZSkge1xuXHRcdFx0XHRpZiAoYXJndktleSA9PT0gJ3Bhc3N3b3JkLXN0b3JlJykge1xuXHRcdFx0XHRcdC8vIFBhc3N3b3JkIHN0b3JlXG5cdFx0XHRcdFx0Ly8gVE9ET0BUeWxlckxlb25oYXJkdDogUmVtb3ZlIHRoaXMgbWlncmF0aW9uIGluIDMgbW9udGhzXG5cdFx0XHRcdFx0bGV0IG1pZ3JhdGVkQXJndlZhbHVlID0gYXJndlZhbHVlO1xuXHRcdFx0XHRcdGlmIChhcmd2VmFsdWUgPT09ICdnbm9tZScgfHwgYXJndlZhbHVlID09PSAnZ25vbWUta2V5cmluZycpIHtcblx0XHRcdFx0XHRcdG1pZ3JhdGVkQXJndlZhbHVlID0gJ2dub21lLWxpYnNlY3JldCc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goYXJndktleSwgbWlncmF0ZWRBcmd2VmFsdWUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goYXJndktleSwgYXJndlZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFwcGVuZCBtYWluIHByb2Nlc3MgZmxhZ3MgdG8gcHJvY2Vzcy5hcmd2XG5cdFx0ZWxzZSBpZiAoU1VQUE9SVEVEX01BSU5fUFJPQ0VTU19TV0lUQ0hFUy5pbmRleE9mKGFyZ3ZLZXkpICE9PSAtMSkge1xuXHRcdFx0c3dpdGNoIChhcmd2S2V5KSB7XG5cdFx0XHRcdGNhc2UgJ2VuYWJsZS1wcm9wb3NlZC1hcGknOlxuXHRcdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGFyZ3ZWYWx1ZSkpIHtcblx0XHRcdFx0XHRcdGFyZ3ZWYWx1ZS5mb3JFYWNoKGlkID0+IGlkICYmIHR5cGVvZiBpZCA9PT0gJ3N0cmluZycgJiYgcHJvY2Vzcy5hcmd2LnB1c2goJy0tZW5hYmxlLXByb3Bvc2VkLWFwaScsIGlkKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFVuZXhwZWN0ZWQgdmFsdWUgZm9yIFxcYGVuYWJsZS1wcm9wb3NlZC1hcGlcXGAgaW4gYXJndi5qc29uLiBFeHBlY3RlZCBhcnJheSBvZiBleHRlbnNpb24gaWRzLmApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlICdsb2ctbGV2ZWwnOlxuXHRcdFx0XHRcdGlmICh0eXBlb2YgYXJndlZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0cHJvY2Vzcy5hcmd2LnB1c2goJy0tbG9nJywgYXJndlZhbHVlKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJndlZhbHVlKSkge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCB2YWx1ZSBvZiBhcmd2VmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0cHJvY2Vzcy5hcmd2LnB1c2goJy0tbG9nJywgdmFsdWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlICd1c2UtaW5tZW1vcnktc2VjcmV0c3RvcmFnZSc6XG5cdFx0XHRcdFx0aWYgKGFyZ3ZWYWx1ZSkge1xuXHRcdFx0XHRcdFx0cHJvY2Vzcy5hcmd2LnB1c2goJy0tdXNlLWlubWVtb3J5LXNlY3JldHN0b3JhZ2UnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBGb2xsb3dpbmcgZmVhdHVyZXMgYXJlIGVuYWJsZWQgZnJvbSB0aGUgcnVudGltZTpcblx0Ly8gYERvY3VtZW50UG9saWN5SW5jbHVkZUpTQ2FsbFN0YWNrc0luQ3Jhc2hSZXBvcnRzYCAtIGh0dHBzOi8vd3d3LmVsZWN0cm9uanMub3JnL2RvY3MvbGF0ZXN0L2FwaS93ZWItZnJhbWUtbWFpbiNmcmFtZWNvbGxlY3RqYXZhc2NyaXB0Y2FsbHN0YWNrLWV4cGVyaW1lbnRhbFxuXHRjb25zdCBmZWF0dXJlc1RvRW5hYmxlID1cblx0XHRgRG9jdW1lbnRQb2xpY3lJbmNsdWRlSlNDYWxsU3RhY2tzSW5DcmFzaFJlcG9ydHMsICR7YXBwLmNvbW1hbmRMaW5lLmdldFN3aXRjaFZhbHVlKCdlbmFibGUtZmVhdHVyZXMnKX1gO1xuXHRhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdlbmFibGUtZmVhdHVyZXMnLCBmZWF0dXJlc1RvRW5hYmxlKTtcblxuXHQvLyBGb2xsb3dpbmcgZmVhdHVyZXMgYXJlIGRpc2FibGVkIGZyb20gdGhlIHJ1bnRpbWU6XG5cdC8vIGBDYWxjdWxhdGVOYXRpdmVXaW5PY2NsdXNpb25gIC0gRGlzYWJsZSBuYXRpdmUgd2luZG93IG9jY2x1c2lvbiB0cmFja2VyIChodHRwczovL2dyb3Vwcy5nb29nbGUuY29tL2EvY2hyb21pdW0ub3JnL2cvZW1iZWRkZXItZGV2L2MvWkYzdUhIeVdMS3cvbS9WRE4yaERYTUFBQUopXG5cdGNvbnN0IGZlYXR1cmVzVG9EaXNhYmxlID1cblx0XHRgQ2FsY3VsYXRlTmF0aXZlV2luT2NjbHVzaW9uLCR7YXBwLmNvbW1hbmRMaW5lLmdldFN3aXRjaFZhbHVlKCdkaXNhYmxlLWZlYXR1cmVzJyl9YDtcblx0YXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS1mZWF0dXJlcycsIGZlYXR1cmVzVG9EaXNhYmxlKTtcblxuXHQvLyBCbGluayBmZWF0dXJlcyB0byBjb25maWd1cmUuXG5cdC8vIGBGb250TWF0Y2hpbmdDVE1pZ3JhdGlvbmAgLSBTaXd0Y2ggZm9udCBtYXRjaGluZyBvbiBtYWNPUyB0byBBcHBraXQgKFJlZnMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIyNDQ5NiNpc3N1ZWNvbW1lbnQtMjI3MDQxODQ3MCkuXG5cdC8vIGBTdGFuZGFyZGl6ZWRCcm93c2VyWm9vbWAgLSBEaXNhYmxlIHpvb20gYWRqdXN0bWVudCBmb3IgYm91bmRpbmcgYm94IChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjMyNzUwI2lzc3VlY29tbWVudC0yNDU5NDk1Mzk0KVxuXHRjb25zdCBibGlua0ZlYXR1cmVzVG9EaXNhYmxlID1cblx0XHRgRm9udE1hdGNoaW5nQ1RNaWdyYXRpb24sU3RhbmRhcmRpemVkQnJvd3Nlclpvb20sJHthcHAuY29tbWFuZExpbmUuZ2V0U3dpdGNoVmFsdWUoJ2Rpc2FibGUtYmxpbmstZmVhdHVyZXMnKX1gO1xuXHRhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWJsaW5rLWZlYXR1cmVzJywgYmxpbmtGZWF0dXJlc1RvRGlzYWJsZSk7XG5cblx0Ly8gU3VwcG9ydCBKUyBGbGFnc1xuXHRjb25zdCBqc0ZsYWdzID0gZ2V0SlNGbGFncyhjbGlBcmdzKTtcblx0aWYgKGpzRmxhZ3MpIHtcblx0XHRhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdqcy1mbGFncycsIGpzRmxhZ3MpO1xuXHR9XG5cblx0Ly8gVXNlIHBvcnRhbCB2ZXJzaW9uIDQgdGhhdCBzdXBwb3J0cyBjdXJyZW50X2ZvbGRlciBvcHRpb25cblx0Ly8gdG8gYWRkcmVzcyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjEzNzgwXG5cdC8vIFJ1bnRpbWUgc2V0cyB0aGUgZGVmYXVsdCB2ZXJzaW9uIHRvIDMsIHJlZnMgaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL3B1bGwvNDQ0MjZcblx0YXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgneGRnLXBvcnRhbC1yZXF1aXJlZC12ZXJzaW9uJywgJzQnKTtcblxuXHRyZXR1cm4gYXJndkNvbmZpZztcbn1cblxuaW50ZXJmYWNlIElBcmd2Q29uZmlnIHtcblx0W2tleTogc3RyaW5nXTogc3RyaW5nIHwgc3RyaW5nW10gfCBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBsb2NhbGU/OiBzdHJpbmc7XG5cdHJlYWRvbmx5ICdkaXNhYmxlLWxjZC10ZXh0Jz86IGJvb2xlYW47XG5cdHJlYWRvbmx5ICdwcm94eS1ieXBhc3MtbGlzdCc/OiBzdHJpbmc7XG5cdHJlYWRvbmx5ICdkaXNhYmxlLWhhcmR3YXJlLWFjY2VsZXJhdGlvbic/OiBib29sZWFuO1xuXHRyZWFkb25seSAnZm9yY2UtY29sb3ItcHJvZmlsZSc/OiBzdHJpbmc7XG5cdHJlYWRvbmx5ICdlbmFibGUtY3Jhc2gtcmVwb3J0ZXInPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgJ2NyYXNoLXJlcG9ydGVyLWlkJz86IHN0cmluZztcblx0cmVhZG9ubHkgJ2VuYWJsZS1wcm9wb3NlZC1hcGknPzogc3RyaW5nW107XG5cdHJlYWRvbmx5ICdsb2ctbGV2ZWwnPzogc3RyaW5nIHwgc3RyaW5nW107XG5cdHJlYWRvbmx5ICdkaXNhYmxlLWNocm9taXVtLXNhbmRib3gnPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgJ3VzZS1pbm1lbW9yeS1zZWNyZXRzdG9yYWdlJz86IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIHJlYWRBcmd2Q29uZmlnU3luYygpOiBJQXJndkNvbmZpZyB7XG5cblx0Ly8gUmVhZCBvciBjcmVhdGUgdGhlIGFyZ3YuanNvbiBjb25maWcgZmlsZSBzeW5jIGJlZm9yZSBhcHAoJ3JlYWR5Jylcblx0Y29uc3QgYXJndkNvbmZpZ1BhdGggPSBnZXRBcmd2Q29uZmlnUGF0aCgpO1xuXHRsZXQgYXJndkNvbmZpZzogSUFyZ3ZDb25maWcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHRyeSB7XG5cdFx0YXJndkNvbmZpZyA9IHBhcnNlKGZzLnJlYWRGaWxlU3luYyhhcmd2Q29uZmlnUGF0aCkudG9TdHJpbmcoKSk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0aWYgKGVycm9yICYmIGVycm9yLmNvZGUgPT09ICdFTk9FTlQnKSB7XG5cdFx0XHRjcmVhdGVEZWZhdWx0QXJndkNvbmZpZ1N5bmMoYXJndkNvbmZpZ1BhdGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLndhcm4oYFVuYWJsZSB0byByZWFkIGFyZ3YuanNvbiBjb25maWd1cmF0aW9uIGZpbGUgaW4gJHthcmd2Q29uZmlnUGF0aH0sIGZhbGxpbmcgYmFjayB0byBkZWZhdWx0cyAoJHtlcnJvcn0pYCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gRmFsbGJhY2sgdG8gZGVmYXVsdFxuXHRpZiAoIWFyZ3ZDb25maWcpIHtcblx0XHRhcmd2Q29uZmlnID0ge307XG5cdH1cblxuXHRyZXR1cm4gYXJndkNvbmZpZztcbn1cblxuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdEFyZ3ZDb25maWdTeW5jKGFyZ3ZDb25maWdQYXRoOiBzdHJpbmcpOiB2b2lkIHtcblx0dHJ5IHtcblxuXHRcdC8vIEVuc3VyZSBhcmd2IGNvbmZpZyBwYXJlbnQgZXhpc3RzXG5cdFx0Y29uc3QgYXJndkNvbmZpZ1BhdGhEaXJuYW1lID0gcGF0aC5kaXJuYW1lKGFyZ3ZDb25maWdQYXRoKTtcblx0XHRpZiAoIWZzLmV4aXN0c1N5bmMoYXJndkNvbmZpZ1BhdGhEaXJuYW1lKSkge1xuXHRcdFx0ZnMubWtkaXJTeW5jKGFyZ3ZDb25maWdQYXRoRGlybmFtZSk7XG5cdFx0fVxuXG5cdFx0Ly8gRGVmYXVsdCBhcmd2IGNvbnRlbnRcblx0XHRjb25zdCBkZWZhdWx0QXJndkNvbmZpZ0NvbnRlbnQgPSBbXG5cdFx0XHQnLy8gVGhpcyBjb25maWd1cmF0aW9uIGZpbGUgYWxsb3dzIHlvdSB0byBwYXNzIHBlcm1hbmVudCBjb21tYW5kIGxpbmUgYXJndW1lbnRzIHRvIFZTIENvZGUuJyxcblx0XHRcdCcvLyBPbmx5IGEgc3Vic2V0IG9mIGFyZ3VtZW50cyBpcyBjdXJyZW50bHkgc3VwcG9ydGVkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCBvZiBicmVha2luZycsXG5cdFx0XHQnLy8gdGhlIGluc3RhbGxhdGlvbi4nLFxuXHRcdFx0Jy8vJyxcblx0XHRcdCcvLyBQTEVBU0UgRE8gTk9UIENIQU5HRSBXSVRIT1VUIFVOREVSU1RBTkRJTkcgVEhFIElNUEFDVCcsXG5cdFx0XHQnLy8nLFxuXHRcdFx0Jy8vIE5PVEU6IENoYW5naW5nIHRoaXMgZmlsZSByZXF1aXJlcyBhIHJlc3RhcnQgb2YgVlMgQ29kZS4nLFxuXHRcdFx0J3snLFxuXHRcdFx0J1x0Ly8gVXNlIHNvZnR3YXJlIHJlbmRlcmluZyBpbnN0ZWFkIG9mIGhhcmR3YXJlIGFjY2VsZXJhdGVkIHJlbmRlcmluZy4nLFxuXHRcdFx0J1x0Ly8gVGhpcyBjYW4gaGVscCBpbiBjYXNlcyB3aGVyZSB5b3Ugc2VlIHJlbmRlcmluZyBpc3N1ZXMgaW4gVlMgQ29kZS4nLFxuXHRcdFx0J1x0Ly8gXCJkaXNhYmxlLWhhcmR3YXJlLWFjY2VsZXJhdGlvblwiOiB0cnVlJyxcblx0XHRcdCd9J1xuXHRcdF07XG5cblx0XHQvLyBDcmVhdGUgaW5pdGlhbCBhcmd2Lmpzb24gd2l0aCBkZWZhdWx0IGNvbnRlbnRcblx0XHRmcy53cml0ZUZpbGVTeW5jKGFyZ3ZDb25maWdQYXRoLCBkZWZhdWx0QXJndkNvbmZpZ0NvbnRlbnQuam9pbignXFxuJykpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdGNvbnNvbGUuZXJyb3IoYFVuYWJsZSB0byBjcmVhdGUgYXJndi5qc29uIGNvbmZpZ3VyYXRpb24gZmlsZSBpbiAke2FyZ3ZDb25maWdQYXRofSwgZmFsbGluZyBiYWNrIHRvIGRlZmF1bHRzICgke2Vycm9yfSlgKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRBcmd2Q29uZmlnUGF0aCgpOiBzdHJpbmcge1xuXHRjb25zdCB2c2NvZGVQb3J0YWJsZSA9IHByb2Nlc3MuZW52WydWU0NPREVfUE9SVEFCTEUnXTtcblx0aWYgKHZzY29kZVBvcnRhYmxlKSB7XG5cdFx0cmV0dXJuIHBhdGguam9pbih2c2NvZGVQb3J0YWJsZSwgJ2FyZ3YuanNvbicpO1xuXHR9XG5cblx0bGV0IGRhdGFGb2xkZXJOYW1lID0gcHJvZHVjdC5kYXRhRm9sZGVyTmFtZTtcblx0aWYgKHByb2Nlc3MuZW52WydWU0NPREVfREVWJ10pIHtcblx0XHRkYXRhRm9sZGVyTmFtZSA9IGAke2RhdGFGb2xkZXJOYW1lfS1kZXZgO1xuXHR9XG5cblx0cmV0dXJuIHBhdGguam9pbihvcy5ob21lZGlyKCksIGRhdGFGb2xkZXJOYW1lISwgJ2FyZ3YuanNvbicpO1xufVxuXG5mdW5jdGlvbiBjb25maWd1cmVDcmFzaFJlcG9ydGVyKCk6IHZvaWQge1xuXHRsZXQgY3Jhc2hSZXBvcnRlckRpcmVjdG9yeSA9IGFyZ3NbJ2NyYXNoLXJlcG9ydGVyLWRpcmVjdG9yeSddO1xuXHRsZXQgc3VibWl0VVJMID0gJyc7XG5cdGlmIChjcmFzaFJlcG9ydGVyRGlyZWN0b3J5KSB7XG5cdFx0Y3Jhc2hSZXBvcnRlckRpcmVjdG9yeSA9IHBhdGgubm9ybWFsaXplKGNyYXNoUmVwb3J0ZXJEaXJlY3RvcnkpO1xuXG5cdFx0aWYgKCFwYXRoLmlzQWJzb2x1dGUoY3Jhc2hSZXBvcnRlckRpcmVjdG9yeSkpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYFRoZSBwYXRoICcke2NyYXNoUmVwb3J0ZXJEaXJlY3Rvcnl9JyBzcGVjaWZpZWQgZm9yIC0tY3Jhc2gtcmVwb3J0ZXItZGlyZWN0b3J5IG11c3QgYmUgYWJzb2x1dGUuYCk7XG5cdFx0XHRhcHAuZXhpdCgxKTtcblx0XHR9XG5cblx0XHRpZiAoIWZzLmV4aXN0c1N5bmMoY3Jhc2hSZXBvcnRlckRpcmVjdG9yeSkpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGZzLm1rZGlyU3luYyhjcmFzaFJlcG9ydGVyRGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFRoZSBwYXRoICcke2NyYXNoUmVwb3J0ZXJEaXJlY3Rvcnl9JyBzcGVjaWZpZWQgZm9yIC0tY3Jhc2gtcmVwb3J0ZXItZGlyZWN0b3J5IGRvZXMgbm90IHNlZW0gdG8gZXhpc3Qgb3IgY2Fubm90IGJlIGNyZWF0ZWQuYCk7XG5cdFx0XHRcdGFwcC5leGl0KDEpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENyYXNoZXMgYXJlIHN0b3JlZCBpbiB0aGUgY3Jhc2hEdW1wcyBkaXJlY3RvcnkgYnkgZGVmYXVsdCwgc28gd2Vcblx0XHQvLyBuZWVkIHRvIGNoYW5nZSB0aGF0IGRpcmVjdG9yeSB0byB0aGUgcHJvdmlkZWQgb25lXG5cdFx0Y29uc29sZS5sb2coYEZvdW5kIC0tY3Jhc2gtcmVwb3J0ZXItZGlyZWN0b3J5IGFyZ3VtZW50LiBTZXR0aW5nIGNyYXNoRHVtcHMgZGlyZWN0b3J5IHRvIGJlICcke2NyYXNoUmVwb3J0ZXJEaXJlY3Rvcnl9J2ApO1xuXHRcdGFwcC5zZXRQYXRoKCdjcmFzaER1bXBzJywgY3Jhc2hSZXBvcnRlckRpcmVjdG9yeSk7XG5cdH1cblxuXHQvLyBPdGhlcndpc2Ugd2UgY29uZmlndXJlIHRoZSBjcmFzaCByZXBvcnRlciBmcm9tIHByb2R1Y3QuanNvblxuXHRlbHNlIHtcblx0XHRjb25zdCBhcHBDZW50ZXIgPSBwcm9kdWN0LmFwcENlbnRlcjtcblx0XHRpZiAoYXBwQ2VudGVyKSB7XG5cdFx0XHRjb25zdCBpc1dpbmRvd3MgPSAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyk7XG5cdFx0XHRjb25zdCBpc0xpbnV4ID0gKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpO1xuXHRcdFx0Y29uc3QgaXNEYXJ3aW4gPSAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpO1xuXHRcdFx0Y29uc3QgY3Jhc2hSZXBvcnRlcklkID0gYXJndkNvbmZpZ1snY3Jhc2gtcmVwb3J0ZXItaWQnXTtcblx0XHRcdGNvbnN0IHV1aWRQYXR0ZXJuID0gL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMC05YS1mXXs0fS1bMC05YS1mXXs0fS1bMC05YS1mXXsxMn0kL2k7XG5cdFx0XHRpZiAoY3Jhc2hSZXBvcnRlcklkICYmIHV1aWRQYXR0ZXJuLnRlc3QoY3Jhc2hSZXBvcnRlcklkKSkge1xuXHRcdFx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRcdFx0c3dpdGNoIChwcm9jZXNzLmFyY2gpIHtcblx0XHRcdFx0XHRcdGNhc2UgJ3g2NCc6XG5cdFx0XHRcdFx0XHRcdHN1Ym1pdFVSTCA9IGFwcENlbnRlclsnd2luMzIteDY0J107XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAnYXJtNjQnOlxuXHRcdFx0XHRcdFx0XHRzdWJtaXRVUkwgPSBhcHBDZW50ZXJbJ3dpbjMyLWFybTY0J107XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChpc0Rhcndpbikge1xuXHRcdFx0XHRcdGlmIChwcm9kdWN0LmRhcndpblVuaXZlcnNhbEFzc2V0SWQpIHtcblx0XHRcdFx0XHRcdHN1Ym1pdFVSTCA9IGFwcENlbnRlclsnZGFyd2luLXVuaXZlcnNhbCddO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzd2l0Y2ggKHByb2Nlc3MuYXJjaCkge1xuXHRcdFx0XHRcdFx0XHRjYXNlICd4NjQnOlxuXHRcdFx0XHRcdFx0XHRcdHN1Ym1pdFVSTCA9IGFwcENlbnRlclsnZGFyd2luJ107XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2FybTY0Jzpcblx0XHRcdFx0XHRcdFx0XHRzdWJtaXRVUkwgPSBhcHBDZW50ZXJbJ2Rhcndpbi1hcm02NCddO1xuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChpc0xpbnV4KSB7XG5cdFx0XHRcdFx0c3VibWl0VVJMID0gYXBwQ2VudGVyWydsaW51eC14NjQnXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdWJtaXRVUkwgPSBzdWJtaXRVUkwuY29uY2F0KCcmdWlkPScsIGNyYXNoUmVwb3J0ZXJJZCwgJyZpaWQ9JywgY3Jhc2hSZXBvcnRlcklkLCAnJnNpZD0nLCBjcmFzaFJlcG9ydGVySWQpO1xuXHRcdFx0XHQvLyBTZW5kIHRoZSBpZCBmb3IgY2hpbGQgbm9kZSBwcm9jZXNzIHRoYXQgYXJlIGV4cGxpY2l0bHkgc3RhcnRpbmcgY3Jhc2ggcmVwb3J0ZXIuXG5cdFx0XHRcdC8vIEZvciB2c2NvZGUgdGhpcyBpcyBFeHRlbnNpb25Ib3N0IHByb2Nlc3MgY3VycmVudGx5LlxuXHRcdFx0XHRjb25zdCBhcmd2ID0gcHJvY2Vzcy5hcmd2O1xuXHRcdFx0XHRjb25zdCBlbmRPZkFyZ3NNYXJrZXJJbmRleCA9IGFyZ3YuaW5kZXhPZignLS0nKTtcblx0XHRcdFx0aWYgKGVuZE9mQXJnc01hcmtlckluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdGFyZ3YucHVzaCgnLS1jcmFzaC1yZXBvcnRlci1pZCcsIGNyYXNoUmVwb3J0ZXJJZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gaWYgdGhlIHdlIGhhdmUgYW4gYXJndW1lbnQgXCItLVwiIChlbmQgb2YgYXJndW1lbnQgbWFya2VyKVxuXHRcdFx0XHRcdC8vIHdlIGNhbm5vdCBhZGQgYXJndW1lbnRzIGF0IHRoZSBlbmQuIHJhdGhlciwgd2UgYWRkXG5cdFx0XHRcdFx0Ly8gYXJndW1lbnRzIGJlZm9yZSB0aGUgXCItLVwiIG1hcmtlci5cblx0XHRcdFx0XHRhcmd2LnNwbGljZShlbmRPZkFyZ3NNYXJrZXJJbmRleCwgMCwgJy0tY3Jhc2gtcmVwb3J0ZXItaWQnLCBjcmFzaFJlcG9ydGVySWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gU3RhcnQgY3Jhc2ggcmVwb3J0ZXIgZm9yIGFsbCBwcm9jZXNzZXNcblx0Y29uc3QgcHJvZHVjdE5hbWUgPSAocHJvZHVjdC5jcmFzaFJlcG9ydGVyID8gcHJvZHVjdC5jcmFzaFJlcG9ydGVyLnByb2R1Y3ROYW1lIDogdW5kZWZpbmVkKSB8fCBwcm9kdWN0Lm5hbWVTaG9ydDtcblx0Y29uc3QgY29tcGFueU5hbWUgPSAocHJvZHVjdC5jcmFzaFJlcG9ydGVyID8gcHJvZHVjdC5jcmFzaFJlcG9ydGVyLmNvbXBhbnlOYW1lIDogdW5kZWZpbmVkKSB8fCAnTWljcm9zb2Z0Jztcblx0Y29uc3QgdXBsb2FkVG9TZXJ2ZXIgPSBCb29sZWFuKCFwcm9jZXNzLmVudlsnVlNDT0RFX0RFViddICYmIHN1Ym1pdFVSTCAmJiAhY3Jhc2hSZXBvcnRlckRpcmVjdG9yeSk7XG5cdGNyYXNoUmVwb3J0ZXIuc3RhcnQoe1xuXHRcdGNvbXBhbnlOYW1lLFxuXHRcdHByb2R1Y3ROYW1lOiBwcm9jZXNzLmVudlsnVlNDT0RFX0RFViddID8gYCR7cHJvZHVjdE5hbWV9IERldmAgOiBwcm9kdWN0TmFtZSxcblx0XHRzdWJtaXRVUkwsXG5cdFx0dXBsb2FkVG9TZXJ2ZXIsXG5cdFx0Y29tcHJlc3M6IHRydWVcblx0fSk7XG59XG5cbmZ1bmN0aW9uIGdldEpTRmxhZ3MoY2xpQXJnczogTmF0aXZlUGFyc2VkQXJncyk6IHN0cmluZyB8IG51bGwge1xuXHRjb25zdCBqc0ZsYWdzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdC8vIEFkZCBhbnkgZXhpc3RpbmcgSlMgZmxhZ3Mgd2UgYWxyZWFkeSBnb3QgZnJvbSB0aGUgY29tbWFuZCBsaW5lXG5cdGlmIChjbGlBcmdzWydqcy1mbGFncyddKSB7XG5cdFx0anNGbGFncy5wdXNoKGNsaUFyZ3NbJ2pzLWZsYWdzJ10pO1xuXHR9XG5cblx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcblx0XHQvLyBGaXggY3BwZ2MgY3Jhc2ggb24gTGludXggd2l0aCAxNktCIHBhZ2Ugc2l6ZS5cblx0XHQvLyBSZWZzIGh0dHBzOi8vaXNzdWVzLmNocm9taXVtLm9yZy9pc3N1ZXMvMzc4MDE3MDM3XG5cdFx0Ly8gVGhlIGZpeCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9jb21taXQvNmM1YjJlZjU1ZTA4ZGMwYmVkZTAyMzg0NzQ3NTQ5YzFlYWRhYzBlYlxuXHRcdC8vIG9ubHkgYWZmZWN0cyBub24tcmVuZGVyZXIgcHJvY2Vzcy5cblx0XHQvLyBUaGUgZm9sbG93aW5nIHdpbGwgZW5zdXJlIHRoYXQgdGhlIGZsYWcgd2lsbCBiZVxuXHRcdC8vIGFwcGxpZWQgdG8gdGhlIHJlbmRlcmVyIHByb2Nlc3MgYXMgd2VsbC5cblx0XHQvLyBUT0RPKGRlZXBhazE1NTYpOiBSZW1vdmUgdGhpcyBvbmNlIHdlIHVwZGF0ZSB0b1xuXHRcdC8vIENocm9taXVtID49IDEzNC5cblx0XHRqc0ZsYWdzLnB1c2goJy0tbm9kZWNvbW1pdF9wb29sZWRfcGFnZXMnKTtcblx0fVxuXG5cdHJldHVybiBqc0ZsYWdzLmxlbmd0aCA+IDAgPyBqc0ZsYWdzLmpvaW4oJyAnKSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIHBhcnNlQ0xJQXJncygpOiBOYXRpdmVQYXJzZWRBcmdzIHtcblx0cmV0dXJuIG1pbmltaXN0KHByb2Nlc3MuYXJndiwge1xuXHRcdHN0cmluZzogW1xuXHRcdFx0J3VzZXItZGF0YS1kaXInLFxuXHRcdFx0J2xvY2FsZScsXG5cdFx0XHQnanMtZmxhZ3MnLFxuXHRcdFx0J2NyYXNoLXJlcG9ydGVyLWRpcmVjdG9yeSdcblx0XHRdLFxuXHRcdGJvb2xlYW46IFtcblx0XHRcdCdkaXNhYmxlLWNocm9taXVtLXNhbmRib3gnLFxuXHRcdF0sXG5cdFx0ZGVmYXVsdDoge1xuXHRcdFx0J3NhbmRib3gnOiB0cnVlXG5cdFx0fSxcblx0XHRhbGlhczoge1xuXHRcdFx0J25vLXNhbmRib3gnOiAnc2FuZGJveCdcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHQvKipcblx0ICogbWFjT1M6IHdoZW4gc29tZW9uZSBkcm9wcyBhIGZpbGUgdG8gdGhlIG5vdC15ZXQgcnVubmluZyBWU0NvZGUsIHRoZSBvcGVuLWZpbGUgZXZlbnQgZmlyZXMgZXZlbiBiZWZvcmVcblx0ICogdGhlIGFwcC1yZWFkeSBldmVudC4gV2UgbGlzdGVuIHZlcnkgZWFybHkgZm9yIG9wZW4tZmlsZSBhbmQgcmVtZW1iZXIgdGhpcyB1cG9uIHN0YXJ0dXAgYXMgcGF0aCB0byBvcGVuLlxuXHQgKi9cblx0Y29uc3QgbWFjT3BlbkZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuXHQoZ2xvYmFsVGhpcyBhcyBhbnkpWydtYWNPcGVuRmlsZXMnXSA9IG1hY09wZW5GaWxlcztcblx0YXBwLm9uKCdvcGVuLWZpbGUnLCBmdW5jdGlvbiAoZXZlbnQsIHBhdGgpIHtcblx0XHRtYWNPcGVuRmlsZXMucHVzaChwYXRoKTtcblx0fSk7XG5cblx0LyoqXG5cdCAqIG1hY09TOiByZWFjdCB0byBvcGVuLXVybCByZXF1ZXN0cy5cblx0ICovXG5cdGNvbnN0IG9wZW5VcmxzOiBzdHJpbmdbXSA9IFtdO1xuXHRjb25zdCBvbk9wZW5VcmwgPVxuXHRcdGZ1bmN0aW9uIChldmVudDogeyBwcmV2ZW50RGVmYXVsdDogKCkgPT4gdm9pZCB9LCB1cmw6IHN0cmluZykge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0b3BlblVybHMucHVzaCh1cmwpO1xuXHRcdH07XG5cblx0YXBwLm9uKCd3aWxsLWZpbmlzaC1sYXVuY2hpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXBwLm9uKCdvcGVuLXVybCcsIG9uT3BlblVybCk7XG5cdH0pO1xuXG5cdChnbG9iYWxUaGlzIGFzIGFueSlbJ2dldE9wZW5VcmxzJ10gPSBmdW5jdGlvbiAoKSB7XG5cdFx0YXBwLnJlbW92ZUxpc3RlbmVyKCdvcGVuLXVybCcsIG9uT3BlblVybCk7XG5cblx0XHRyZXR1cm4gb3BlblVybHM7XG5cdH07XG59XG5cbmZ1bmN0aW9uIGdldENvZGVDYWNoZVBhdGgoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblxuXHQvLyBleHBsaWNpdGx5IGRpc2FibGVkIHZpYSBDTEkgYXJnc1xuXHRpZiAocHJvY2Vzcy5hcmd2LmluZGV4T2YoJy0tbm8tY2FjaGVkLWRhdGEnKSA+IDApIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Ly8gcnVubmluZyBvdXQgb2Ygc291cmNlc1xuXHRpZiAocHJvY2Vzcy5lbnZbJ1ZTQ09ERV9ERVYnXSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvLyByZXF1aXJlIGNvbW1pdCBpZFxuXHRjb25zdCBjb21taXQgPSBwcm9kdWN0LmNvbW1pdDtcblx0aWYgKCFjb21taXQpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cmV0dXJuIHBhdGguam9pbih1c2VyRGF0YVBhdGgsICdDYWNoZWREYXRhJywgY29tbWl0KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbWtkaXJwSWdub3JlRXJyb3IoZGlyOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRpZiAodHlwZW9mIGRpciA9PT0gJ3N0cmluZycpIHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgZnMucHJvbWlzZXMubWtkaXIoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuXHRcdFx0cmV0dXJuIGRpcjtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gaWdub3JlXG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLy8jcmVnaW9uIE5MUyBTdXBwb3J0XG5cbmZ1bmN0aW9uIHByb2Nlc3NaaExvY2FsZShhcHBMb2NhbGU6IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmIChhcHBMb2NhbGUuc3RhcnRzV2l0aCgnemgnKSkge1xuXHRcdGNvbnN0IHJlZ2lvbiA9IGFwcExvY2FsZS5zcGxpdCgnLScpWzFdO1xuXG5cdFx0Ly8gT24gV2luZG93cyBhbmQgbWFjT1MsIENoaW5lc2UgbGFuZ3VhZ2VzIHJldHVybmVkIGJ5XG5cdFx0Ly8gYXBwLmdldFByZWZlcnJlZFN5c3RlbUxhbmd1YWdlcygpIHN0YXJ0IHdpdGggemgtaGFuc1xuXHRcdC8vIGZvciBTaW1wbGlmaWVkIENoaW5lc2Ugb3IgemgtaGFudCBmb3IgVHJhZGl0aW9uYWwgQ2hpbmVzZSxcblx0XHQvLyBzbyB3ZSBjYW4gZWFzaWx5IGRldGVybWluZSB3aGV0aGVyIHRvIHVzZSBTaW1wbGlmaWVkIG9yIFRyYWRpdGlvbmFsLlxuXHRcdC8vIEhvd2V2ZXIsIG9uIExpbnV4LCBDaGluZXNlIGxhbmd1YWdlcyByZXR1cm5lZCBieSB0aGF0IHNhbWUgQVBJXG5cdFx0Ly8gYXJlIG9mIHRoZSBmb3JtIHpoLVhZLCB3aGVyZSBYWSBpcyBhIGNvdW50cnkgY29kZS5cblx0XHQvLyBGb3IgQ2hpbmEgKENOKSwgU2luZ2Fwb3JlIChTRyksIGFuZCBNYWxheXNpYSAoTVkpXG5cdFx0Ly8gY291bnRyeSBjb2RlcywgYXNzdW1lIHRoZXkgdXNlIFNpbXBsaWZpZWQgQ2hpbmVzZS5cblx0XHQvLyBGb3Igb3RoZXIgY2FzZXMsIGFzc3VtZSB0aGV5IHVzZSBUcmFkaXRpb25hbC5cblx0XHRpZiAoWydoYW5zJywgJ2NuJywgJ3NnJywgJ215J10uaW5jbHVkZXMocmVnaW9uKSkge1xuXHRcdFx0cmV0dXJuICd6aC1jbic7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICd6aC10dyc7XG5cdH1cblxuXHRyZXR1cm4gYXBwTG9jYWxlO1xufVxuXG4vKipcbiAqIFJlc29sdmUgdGhlIE5MUyBjb25maWd1cmF0aW9uXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVObHNDb25maWd1cmF0aW9uKCk6IFByb21pc2U8SU5MU0NvbmZpZ3VyYXRpb24+IHtcblxuXHQvLyBGaXJzdCwgd2UgbmVlZCB0byB0ZXN0IGEgdXNlciBkZWZpbmVkIGxvY2FsZS5cblx0Ly8gSWYgaXQgZmFpbHMgd2UgdHJ5IHRoZSBhcHAgbG9jYWxlLlxuXHQvLyBJZiB0aGF0IGZhaWxzIHdlIGZhbGwgYmFjayB0byBFbmdsaXNoLlxuXG5cdGNvbnN0IG5sc0NvbmZpZ3VyYXRpb24gPSBubHNDb25maWd1cmF0aW9uUHJvbWlzZSA/IGF3YWl0IG5sc0NvbmZpZ3VyYXRpb25Qcm9taXNlIDogdW5kZWZpbmVkO1xuXHRpZiAobmxzQ29uZmlndXJhdGlvbikge1xuXHRcdHJldHVybiBubHNDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0Ly8gVHJ5IHRvIHVzZSB0aGUgYXBwIGxvY2FsZSB3aGljaCBpcyBvbmx5IHZhbGlkXG5cdC8vIGFmdGVyIHRoZSBhcHAgcmVhZHkgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG5cblx0bGV0IHVzZXJMb2NhbGUgPSBhcHAuZ2V0TG9jYWxlKCk7XG5cdGlmICghdXNlckxvY2FsZSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHR1c2VyTG9jYWxlOiAnZW4nLFxuXHRcdFx0b3NMb2NhbGUsXG5cdFx0XHRyZXNvbHZlZExhbmd1YWdlOiAnZW4nLFxuXHRcdFx0ZGVmYXVsdE1lc3NhZ2VzRmlsZTogcGF0aC5qb2luKF9fZGlybmFtZSwgJ25scy5tZXNzYWdlcy5qc29uJyksXG5cblx0XHRcdC8vIE5MUzogYmVsb3cgMiBhcmUgYSByZWxpYyBmcm9tIG9sZCB0aW1lcyBvbmx5IHVzZWQgYnkgdnNjb2RlLW5scyBhbmQgZGVwcmVjYXRlZFxuXHRcdFx0bG9jYWxlOiAnZW4nLFxuXHRcdFx0YXZhaWxhYmxlTGFuZ3VhZ2VzOiB7fVxuXHRcdH07XG5cdH1cblxuXHQvLyBTZWUgYWJvdmUgdGhlIGNvbW1lbnQgYWJvdXQgdGhlIGxvYWRlciBhbmQgY2FzZSBzZW5zaXRpdmVuZXNzXG5cdHVzZXJMb2NhbGUgPSBwcm9jZXNzWmhMb2NhbGUodXNlckxvY2FsZS50b0xvd2VyQ2FzZSgpKTtcblxuXHRyZXR1cm4gcmVzb2x2ZU5MU0NvbmZpZ3VyYXRpb24oe1xuXHRcdHVzZXJMb2NhbGUsXG5cdFx0b3NMb2NhbGUsXG5cdFx0Y29tbWl0OiBwcm9kdWN0LmNvbW1pdCxcblx0XHR1c2VyRGF0YVBhdGgsXG5cdFx0bmxzTWV0YWRhdGFQYXRoOiBfX2Rpcm5hbWVcblx0fSk7XG59XG5cbi8qKlxuICogTGFuZ3VhZ2UgdGFncyBhcmUgY2FzZSBpbnNlbnNpdGl2ZSBob3dldmVyIGFuIEVTTSBsb2FkZXIgaXMgY2FzZSBzZW5zaXRpdmVcbiAqIFRvIG1ha2UgdGhpcyB3b3JrIG9uIGNhc2UgcHJlc2VydmluZyAmIGluc2Vuc2l0aXZlIEZTIHdlIGRvIHRoZSBmb2xsb3dpbmc6XG4gKiB0aGUgbGFuZ3VhZ2UgYnVuZGxlcyBoYXZlIGxvd2VyIGNhc2UgbGFuZ3VhZ2UgdGFncyBhbmQgd2UgYWx3YXlzIGxvd2VyIGNhc2VcbiAqIHRoZSBsb2NhbGUgd2UgcmVjZWl2ZSBmcm9tIHRoZSB1c2VyIG9yIE9TLlxuICovXG5mdW5jdGlvbiBnZXRVc2VyRGVmaW5lZExvY2FsZShhcmd2Q29uZmlnOiBJQXJndkNvbmZpZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGxvY2FsZSA9IGFyZ3NbJ2xvY2FsZSddO1xuXHRpZiAobG9jYWxlKSB7XG5cdFx0cmV0dXJuIGxvY2FsZS50b0xvd2VyQ2FzZSgpOyAvLyBhIGRpcmVjdGx5IHByb3ZpZGVkIC0tbG9jYWxlIGFsd2F5cyB3aW5zXG5cdH1cblxuXHRyZXR1cm4gdHlwZW9mIGFyZ3ZDb25maWc/LmxvY2FsZSA9PT0gJ3N0cmluZycgPyBhcmd2Q29uZmlnLmxvY2FsZS50b0xvd2VyQ2FzZSgpIDogdW5kZWZpbmVkO1xufVxuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksVUFBVTtBQUN0QixZQUFZLFFBQVE7QUFDcEIsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUJBQWlCLHVCQUF1QjtBQUlqRCxNQUFNLEVBQUUsS0FBSyxVQUFVLGVBQWUsTUFBTSxlQUFlLElBQUksZ0JBQWdCLFlBQVksR0FBRyxFQUFFLFVBQVU7QUFDMUcsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFDdEIsU0FBUyx1QkFBdUI7QUFDaEMsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsWUFBWSw2QkFBNkI7QUFJbEQsTUFBTSxZQUFZLEtBQUssUUFBUSxjQUFjLFlBQVksR0FBRyxDQUFDO0FBRTdELEtBQUssS0FBSyxtQkFBbUI7QUFFN0IsS0FBSyxLQUFLLDJCQUEyQjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBSXBDLFdBQVcsS0FBSyxNQUFNLFlBQVksVUFBVTtBQUM3QyxDQUFDO0FBQ0QsS0FBSyxLQUFLLHdCQUF3QjtBQUdsQyxNQUFNLFdBQVcs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O0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBRUEsU0FBTztBQUNSO0FBS0EsZUFBZSwwQkFBc0Q7QUFNcEUsUUFBTSxtQkFBbUIsMEJBQTBCLE1BQU0sMEJBQTBCO0FBQ25GLE1BQUksa0JBQWtCO0FBQ3JCLFdBQU87QUFBQSxFQUNSO0FBS0EsTUFBSUMsY0FBYSxJQUFJLFVBQVU7QUFDL0IsTUFBSSxDQUFDQSxhQUFZO0FBQ2hCLFdBQU87QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaO0FBQUEsTUFDQSxrQkFBa0I7QUFBQSxNQUNsQixxQkFBcUIsS0FBSyxLQUFLLFdBQVcsbUJBQW1CO0FBQUE7QUFBQSxNQUc3RCxRQUFRO0FBQUEsTUFDUixvQkFBb0IsQ0FBQztBQUFBLElBQ3RCO0FBQUEsRUFDRDtBQUdBLEVBQUFBLGNBQWEsZ0JBQWdCQSxZQUFXLFlBQVksQ0FBQztBQUVyRCxTQUFPLHdCQUF3QjtBQUFBLElBQzlCLFlBQUFBO0FBQUEsSUFDQTtBQUFBLElBQ0EsUUFBUSxRQUFRO0FBQUEsSUFDaEI7QUFBQSxJQUNBLGlCQUFpQjtBQUFBLEVBQ2xCLENBQUM7QUFDRjtBQVFBLFNBQVMscUJBQXFCRixhQUE2QztBQUMxRSxRQUFNLFNBQVMsS0FBSyxRQUFRO0FBQzVCLE1BQUksUUFBUTtBQUNYLFdBQU8sT0FBTyxZQUFZO0FBQUEsRUFDM0I7QUFFQSxTQUFPLE9BQU9BLGFBQVksV0FBVyxXQUFXQSxZQUFXLE9BQU8sWUFBWSxJQUFJO0FBQ25GOyIsCiAgIm5hbWVzIjogWyJjb2RlQ2FjaGVQYXRoIiwgImFyZ3ZDb25maWciLCAicGF0aCIsICJ1c2VyTG9jYWxlIl0KfQo=
