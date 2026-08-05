import minimist from "minimist";
import { isWindows } from "../../../base/common/platform.js";
import { localize } from "../../../nls.js";
const helpCategories = {
  o: localize("optionsUpperCase", "Options"),
  e: localize("extensionsManagement", "Extensions Management"),
  t: localize("troubleshooting", "Troubleshooting")
};
const NATIVE_CLI_COMMANDS = ["tunnel", "serve-web"];
const OPTIONS = {
  "tunnel": {
    type: "subcommand",
    description: "Make the current machine accessible from vscode.dev or other machines through a secure tunnel",
    options: {
      "cli-data-dir": { type: "string", args: "dir", description: localize("cliDataDir", "Directory where CLI metadata should be stored.") },
      "disable-telemetry": { type: "boolean" },
      "telemetry-level": { type: "string" },
      user: {
        type: "subcommand",
        options: {
          login: {
            type: "subcommand",
            options: {
              provider: { type: "string" },
              "access-token": { type: "string" }
            }
          }
        }
      }
    }
  },
  "serve-web": {
    type: "subcommand",
    description: "Run a server that displays the editor UI in browsers.",
    options: {
      "cli-data-dir": { type: "string", args: "dir", description: localize("cliDataDir", "Directory where CLI metadata should be stored.") },
      "disable-telemetry": { type: "boolean" },
      "telemetry-level": { type: "string" }
    }
  },
  "diff": { type: "boolean", cat: "o", alias: "d", args: ["file", "file"], description: localize("diff", "Compare two files with each other.") },
  "merge": { type: "boolean", cat: "o", alias: "m", args: ["path1", "path2", "base", "result"], description: localize("merge", "Perform a three-way merge by providing paths for two modified versions of a file, the common origin of both modified versions and the output file to save merge results.") },
  "add": { type: "boolean", cat: "o", alias: "a", args: "folder", description: localize("add", "Add folder(s) to the last active window.") },
  "remove": { type: "boolean", cat: "o", args: "folder", description: localize("remove", "Remove folder(s) from the last active window.") },
  "goto": { type: "boolean", cat: "o", alias: "g", args: "file:line[:character]", description: localize("goto", "Open a file at the path on the specified line and character position.") },
  "new-window": { type: "boolean", cat: "o", alias: "n", description: localize("newWindow", "Force to open a new window.") },
  "reuse-window": { type: "boolean", cat: "o", alias: "r", description: localize("reuseWindow", "Force to open a file or folder in an already opened window.") },
  "wait": { type: "boolean", cat: "o", alias: "w", description: localize("wait", "Wait for the files to be closed before returning.") },
  "waitMarkerFilePath": { type: "string" },
  "locale": { type: "string", cat: "o", args: "locale", description: localize("locale", "The locale to use (e.g. en-US or zh-TW).") },
  "user-data-dir": { type: "string", cat: "o", args: "dir", description: localize("userDataDir", "Specifies the directory that user data is kept in. Can be used to open multiple distinct instances of Code.") },
  "profile": { type: "string", "cat": "o", args: "profileName", description: localize("profileName", "Opens the provided folder or workspace with the given profile and associates the profile with the workspace. If the profile does not exist, a new empty one is created.") },
  "help": { type: "boolean", cat: "o", alias: "h", description: localize("help", "Print usage.") },
  "extensions-dir": { type: "string", deprecates: ["extensionHomePath"], cat: "e", args: "dir", description: localize("extensionHomePath", "Set the root path for extensions.") },
  "extensions-download-dir": { type: "string" },
  "builtin-extensions-dir": { type: "string" },
  "list-extensions": { type: "boolean", cat: "e", description: localize("listExtensions", "List the installed extensions.") },
  "show-versions": { type: "boolean", cat: "e", description: localize("showVersions", "Show versions of installed extensions, when using --list-extensions.") },
  "category": { type: "string", allowEmptyValue: true, cat: "e", description: localize("category", "Filters installed extensions by provided category, when using --list-extensions."), args: "category" },
  "install-extension": { type: "string[]", cat: "e", args: "ext-id | path", description: localize("installExtension", "Installs or updates an extension. The argument is either an extension id or a path to a VSIX. The identifier of an extension is '${publisher}.${name}'. Use '--force' argument to update to latest version. To install a specific version provide '@${version}'. For example: 'vscode.csharp@1.2.3'.") },
  "pre-release": { type: "boolean", cat: "e", description: localize("install prerelease", "Installs the pre-release version of the extension, when using --install-extension") },
  "uninstall-extension": { type: "string[]", cat: "e", args: "ext-id", description: localize("uninstallExtension", "Uninstalls an extension.") },
  "update-extensions": { type: "boolean", cat: "e", description: localize("updateExtensions", "Update the installed extensions.") },
  "enable-proposed-api": { type: "string[]", allowEmptyValue: true, cat: "e", args: "ext-id", description: localize("experimentalApis", "Enables proposed API features for extensions. Can receive one or more extension IDs to enable individually.") },
  "add-mcp": { type: "string[]", cat: "o", args: "json", description: localize("addMcp", `Adds a Model Context Protocol server definition to the user profile, or workspace or folder when used with --mcp-workspace. Accepts JSON input in the form '{"name":"server-name","command":...}'`) },
  "version": { type: "boolean", cat: "t", alias: "v", description: localize("version", "Print version.") },
  "verbose": { type: "boolean", cat: "t", global: true, description: localize("verbose", "Print verbose output (implies --wait).") },
  "log": { type: "string[]", cat: "t", args: "level", global: true, description: localize("log", "Log level to use. Default is 'info'. Allowed values are 'critical', 'error', 'warn', 'info', 'debug', 'trace', 'off'. You can also configure the log level of an extension by passing extension id and log level in the following format: '${publisher}.${name}:${logLevel}'. For example: 'vscode.csharp:trace'. Can receive one or more such entries.") },
  "status": { type: "boolean", alias: "s", cat: "t", description: localize("status", "Print process usage and diagnostics information.") },
  "prof-startup": { type: "boolean", cat: "t", description: localize("prof-startup", "Run CPU profiler during startup.") },
  "prof-append-timers": { type: "string" },
  "prof-duration-markers": { type: "string[]" },
  "prof-duration-markers-file": { type: "string" },
  "no-cached-data": { type: "boolean" },
  "prof-startup-prefix": { type: "string" },
  "prof-v8-extensions": { type: "boolean" },
  "disable-extensions": { type: "boolean", deprecates: ["disableExtensions"], cat: "t", description: localize("disableExtensions", "Disable all installed extensions. This option is not persisted and is effective only when the command opens a new window.") },
  "disable-extension": { type: "string[]", cat: "t", args: "ext-id", description: localize("disableExtension", "Disable the provided extension. This option is not persisted and is effective only when the command opens a new window.") },
  "sync": { type: "string", cat: "t", description: localize("turn sync", "Turn sync on or off."), args: ["on | off"] },
  "inspect-extensions": { type: "string", allowEmptyValue: true, deprecates: ["debugPluginHost"], args: "port", cat: "t", description: localize("inspect-extensions", "Allow debugging and profiling of extensions. Check the developer tools for the connection URI.") },
  "inspect-brk-extensions": { type: "string", allowEmptyValue: true, deprecates: ["debugBrkPluginHost"], args: "port", cat: "t", description: localize("inspect-brk-extensions", "Allow debugging and profiling of extensions with the extension host being paused after start. Check the developer tools for the connection URI.") },
  "disable-lcd-text": { type: "boolean", cat: "t", description: localize("disableLCDText", "Disable LCD font rendering.") },
  "disable-gpu": { type: "boolean", cat: "t", description: localize("disableGPU", "Disable GPU hardware acceleration.") },
  "disable-chromium-sandbox": { type: "boolean", cat: "t", description: localize("disableChromiumSandbox", "Use this option only when there is requirement to launch the application as sudo user on Linux or when running as an elevated user in an applocker environment on Windows.") },
  "sandbox": { type: "boolean" },
  "locate-shell-integration-path": { type: "string", cat: "t", args: ["shell"], description: localize("locateShellIntegrationPath", "Print the path to a terminal shell integration script. Allowed values are 'bash', 'pwsh', 'zsh' or 'fish'.") },
  "telemetry": { type: "boolean", cat: "t", description: localize("telemetry", "Shows all telemetry events which VS code collects.") },
  "remote": { type: "string", allowEmptyValue: true },
  "folder-uri": { type: "string[]", cat: "o", args: "uri" },
  "file-uri": { type: "string[]", cat: "o", args: "uri" },
  "locate-extension": { type: "string[]" },
  "extensionDevelopmentPath": { type: "string[]" },
  "extensionDevelopmentKind": { type: "string[]" },
  "extensionTestsPath": { type: "string" },
  "extensionEnvironment": { type: "string" },
  "debugId": { type: "string" },
  "debugRenderer": { type: "boolean" },
  "inspect-ptyhost": { type: "string", allowEmptyValue: true },
  "inspect-brk-ptyhost": { type: "string", allowEmptyValue: true },
  "inspect-search": { type: "string", deprecates: ["debugSearch"], allowEmptyValue: true },
  "inspect-brk-search": { type: "string", deprecates: ["debugBrkSearch"], allowEmptyValue: true },
  "inspect-sharedprocess": { type: "string", allowEmptyValue: true },
  "inspect-brk-sharedprocess": { type: "string", allowEmptyValue: true },
  "export-default-configuration": { type: "string" },
  "install-source": { type: "string" },
  "enable-smoke-test-driver": { type: "boolean" },
  "logExtensionHostCommunication": { type: "boolean" },
  "skip-release-notes": { type: "boolean" },
  "skip-welcome": { type: "boolean" },
  "disable-telemetry": { type: "boolean" },
  "disable-updates": { type: "boolean" },
  "use-inmemory-secretstorage": { type: "boolean", deprecates: ["disable-keytar"] },
  "password-store": { type: "string" },
  "disable-workspace-trust": { type: "boolean" },
  "disable-crash-reporter": { type: "boolean" },
  "crash-reporter-directory": { type: "string" },
  "crash-reporter-id": { type: "string" },
  "skip-add-to-recently-opened": { type: "boolean" },
  "open-url": { type: "boolean" },
  "file-write": { type: "boolean" },
  "file-chmod": { type: "boolean" },
  "install-builtin-extension": { type: "string[]" },
  "force": { type: "boolean" },
  "do-not-sync": { type: "boolean" },
  "do-not-include-pack-dependencies": { type: "boolean" },
  "trace": { type: "boolean" },
  "trace-memory-infra": { type: "boolean" },
  "trace-category-filter": { type: "string" },
  "trace-options": { type: "string" },
  "preserve-env": { type: "boolean" },
  "force-user-env": { type: "boolean" },
  "force-disable-user-env": { type: "boolean" },
  "open-devtools": { type: "boolean" },
  "disable-gpu-sandbox": { type: "boolean" },
  "logsPath": { type: "string" },
  "__enable-file-policy": { type: "boolean" },
  "editSessionId": { type: "string" },
  "continueOn": { type: "string" },
  "enable-coi": { type: "boolean" },
  "unresponsive-sample-interval": { type: "string" },
  "unresponsive-sample-period": { type: "string" },
  // chromium flags
  "no-proxy-server": { type: "boolean" },
  // Minimist incorrectly parses keys that start with `--no`
  // https://github.com/substack/minimist/blob/aeb3e27dae0412de5c0494e9563a5f10c82cc7a9/index.js#L118-L121
  // If --no-sandbox is passed via cli wrapper it will be treated as --sandbox which is incorrect, we use
  // the alias here to make sure --no-sandbox is always respected.
  // For https://github.com/microsoft/vscode/issues/128279
  "no-sandbox": { type: "boolean", alias: "sandbox" },
  "proxy-server": { type: "string" },
  "proxy-bypass-list": { type: "string" },
  "proxy-pac-url": { type: "string" },
  "js-flags": { type: "string" },
  // chrome js flags
  "inspect": { type: "string", allowEmptyValue: true },
  "inspect-brk": { type: "string", allowEmptyValue: true },
  "nolazy": { type: "boolean" },
  // node inspect
  "force-device-scale-factor": { type: "string" },
  "force-renderer-accessibility": { type: "boolean" },
  "ignore-certificate-errors": { type: "boolean" },
  "allow-insecure-localhost": { type: "boolean" },
  "log-net-log": { type: "string" },
  "vmodule": { type: "string" },
  "_urls": { type: "string[]" },
  "disable-dev-shm-usage": { type: "boolean" },
  "profile-temp": { type: "boolean" },
  "ozone-platform": { type: "string" },
  "enable-tracing": { type: "string" },
  "trace-startup-format": { type: "string" },
  "trace-startup-file": { type: "string" },
  "trace-startup-duration": { type: "string" },
  "xdg-portal-required-version": { type: "string" },
  _: { type: "string[]" }
  // main arguments
};
const ignoringReporter = {
  onUnknownOption: () => {
  },
  onMultipleValues: () => {
  },
  onEmptyValue: () => {
  },
  onDeprecatedOption: () => {
  }
};
function parseArgs(args, options, errorReporter = ignoringReporter) {
  const firstArg = args.find((a) => a.length > 0 && a[0] !== "-");
  const alias = {};
  const stringOptions = ["_"];
  const booleanOptions = [];
  const globalOptions = {};
  let command = void 0;
  for (const optionId in options) {
    const o = options[optionId];
    if (o.type === "subcommand") {
      if (optionId === firstArg) {
        command = o;
      }
    } else {
      if (o.alias) {
        alias[optionId] = o.alias;
      }
      if (o.type === "string" || o.type === "string[]") {
        stringOptions.push(optionId);
        if (o.deprecates) {
          stringOptions.push(...o.deprecates);
        }
      } else if (o.type === "boolean") {
        booleanOptions.push(optionId);
        if (o.deprecates) {
          booleanOptions.push(...o.deprecates);
        }
      }
      if (o.global) {
        globalOptions[optionId] = o;
      }
    }
  }
  if (command && firstArg) {
    const options2 = globalOptions;
    for (const optionId in command.options) {
      options2[optionId] = command.options[optionId];
    }
    const newArgs = args.filter((a) => a !== firstArg);
    const reporter = errorReporter.getSubcommandReporter ? errorReporter.getSubcommandReporter(firstArg) : void 0;
    const subcommandOptions = parseArgs(newArgs, options2, reporter);
    return {
      [firstArg]: subcommandOptions,
      _: []
    };
  }
  const parsedArgs = minimist(args, { string: stringOptions, boolean: booleanOptions, alias });
  const cleanedArgs = {};
  const remainingArgs = parsedArgs;
  cleanedArgs._ = parsedArgs._.map((arg) => String(arg)).filter((arg) => arg.length > 0);
  delete remainingArgs._;
  for (const optionId in options) {
    const o = options[optionId];
    if (o.type === "subcommand") {
      continue;
    }
    if (o.alias) {
      delete remainingArgs[o.alias];
    }
    let val = remainingArgs[optionId];
    if (o.deprecates) {
      for (const deprecatedId of o.deprecates) {
        if (remainingArgs.hasOwnProperty(deprecatedId)) {
          if (!val) {
            val = remainingArgs[deprecatedId];
            if (val) {
              errorReporter.onDeprecatedOption(deprecatedId, o.deprecationMessage || localize("deprecated.useInstead", "Use {0} instead.", optionId));
            }
          }
          delete remainingArgs[deprecatedId];
        }
      }
    }
    if (typeof val !== "undefined") {
      if (o.type === "string[]") {
        if (!Array.isArray(val)) {
          val = [val];
        }
        if (!o.allowEmptyValue) {
          const sanitized = val.filter((v) => v.length > 0);
          if (sanitized.length !== val.length) {
            errorReporter.onEmptyValue(optionId);
            val = sanitized.length > 0 ? sanitized : void 0;
          }
        }
      } else if (o.type === "string") {
        if (Array.isArray(val)) {
          val = val.pop();
          errorReporter.onMultipleValues(optionId, val);
        } else if (!val && !o.allowEmptyValue) {
          errorReporter.onEmptyValue(optionId);
          val = void 0;
        }
      }
      cleanedArgs[optionId] = val;
      if (o.deprecationMessage) {
        errorReporter.onDeprecatedOption(optionId, o.deprecationMessage);
      }
    }
    delete remainingArgs[optionId];
  }
  for (const key in remainingArgs) {
    errorReporter.onUnknownOption(key);
  }
  return cleanedArgs;
}
function formatUsage(optionId, option) {
  let args = "";
  if (option.args) {
    if (Array.isArray(option.args)) {
      args = ` <${option.args.join("> <")}>`;
    } else {
      args = ` <${option.args}>`;
    }
  }
  if (option.alias) {
    return `-${option.alias} --${optionId}${args}`;
  }
  return `--${optionId}${args}`;
}
function formatOptions(options, columns) {
  const usageTexts = [];
  for (const optionId in options) {
    const o = options[optionId];
    const usageText = formatUsage(optionId, o);
    usageTexts.push([usageText, o.description]);
  }
  return formatUsageTexts(usageTexts, columns);
}
function formatUsageTexts(usageTexts, columns) {
  const maxLength = usageTexts.reduce((previous, e) => Math.max(previous, e[0].length), 12);
  const argLength = maxLength + 2 + 1;
  if (columns - argLength < 25) {
    return usageTexts.reduce((r, ut) => r.concat([`  ${ut[0]}`, `      ${ut[1]}`]), []);
  }
  const descriptionColumns = columns - argLength - 1;
  const result = [];
  for (const ut of usageTexts) {
    const usage = ut[0];
    const wrappedDescription = wrapText(ut[1], descriptionColumns);
    const keyPadding = indent(
      argLength - usage.length - 2
      /*left padding*/
    );
    result.push("  " + usage + keyPadding + wrappedDescription[0]);
    for (let i = 1; i < wrappedDescription.length; i++) {
      result.push(indent(argLength) + wrappedDescription[i]);
    }
  }
  return result;
}
function indent(count) {
  return " ".repeat(count);
}
function wrapText(text, columns) {
  const lines = [];
  while (text.length) {
    let index = text.length < columns ? text.length : text.lastIndexOf(" ", columns);
    if (index === 0) {
      index = columns;
    }
    const line = text.slice(0, index).trim();
    text = text.slice(index).trimStart();
    lines.push(line);
  }
  return lines;
}
function buildHelpMessage(productName, executableName, version, options, capabilities) {
  const columns = process.stdout.isTTY && process.stdout.columns || 80;
  const inputFiles = capabilities?.noInputFiles !== true ? `[${localize("paths", "paths")}...]` : "";
  const help = [`${productName} ${version}`];
  help.push("");
  help.push(`${localize("usage", "Usage")}: ${executableName} [${localize("options", "options")}]${inputFiles}`);
  help.push("");
  if (capabilities?.noPipe !== true) {
    if (isWindows) {
      help.push(localize("stdinWindows", "To read output from another program, append '-' (e.g. 'echo Hello World | {0} -')", executableName));
    } else {
      help.push(localize("stdinUnix", "To read from stdin, append '-' (e.g. 'ps aux | grep code | {0} -')", executableName));
    }
    help.push("");
  }
  const optionsByCategory = {};
  const subcommands = [];
  for (const optionId in options) {
    const o = options[optionId];
    if (o.type === "subcommand") {
      if (o.description) {
        subcommands.push({ command: optionId, description: o.description });
      }
    } else if (o.description && o.cat) {
      let optionsByCat = optionsByCategory[o.cat];
      if (!optionsByCat) {
        optionsByCategory[o.cat] = optionsByCat = {};
      }
      optionsByCat[optionId] = o;
    }
  }
  for (const helpCategoryKey in optionsByCategory) {
    const key = helpCategoryKey;
    const categoryOptions = optionsByCategory[key];
    if (categoryOptions) {
      help.push(helpCategories[key]);
      help.push(...formatOptions(categoryOptions, columns));
      help.push("");
    }
  }
  if (subcommands.length) {
    help.push(localize("subcommands", "Subcommands"));
    help.push(...formatUsageTexts(subcommands.map((s) => [s.command, s.description]), columns));
    help.push("");
  }
  return help.join("\n");
}
function buildVersionMessage(version, commit) {
  return `${version || localize("unknownVersion", "Unknown version")}
${commit || localize("unknownCommit", "Unknown commit")}
${process.arch}`;
}
export {
  NATIVE_CLI_COMMANDS,
  OPTIONS,
  buildHelpMessage,
  buildVersionMessage,
  formatOptions,
  parseArgs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9lbnZpcm9ubWVudC9ub2RlL2FyZ3YudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgbWluaW1pc3QgZnJvbSAnbWluaW1pc3QnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTmF0aXZlUGFyc2VkQXJncyB9IGZyb20gJy4uL2NvbW1vbi9hcmd2LmpzJztcblxuLyoqXG4gKiBUaGlzIGNvZGUgaXMgYWxzbyB1c2VkIGJ5IHN0YW5kYWxvbmUgY2xpJ3MuIEF2b2lkIGFkZGluZyBhbnkgb3RoZXIgZGVwZW5kZW5jaWVzLlxuICovXG5jb25zdCBoZWxwQ2F0ZWdvcmllcyA9IHtcblx0bzogbG9jYWxpemUoJ29wdGlvbnNVcHBlckNhc2UnLCBcIk9wdGlvbnNcIiksXG5cdGU6IGxvY2FsaXplKCdleHRlbnNpb25zTWFuYWdlbWVudCcsIFwiRXh0ZW5zaW9ucyBNYW5hZ2VtZW50XCIpLFxuXHR0OiBsb2NhbGl6ZSgndHJvdWJsZXNob290aW5nJywgXCJUcm91Ymxlc2hvb3RpbmdcIilcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3B0aW9uPE9wdGlvblR5cGU+IHtcblx0dHlwZTogT3B0aW9uVHlwZTtcblx0YWxpYXM/OiBzdHJpbmc7XG5cdGRlcHJlY2F0ZXM/OiBzdHJpbmdbXTsgLy8gb2xkIGRlcHJlY2F0ZWQgaWRzXG5cdGFyZ3M/OiBzdHJpbmcgfCBzdHJpbmdbXTtcblx0ZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdGRlcHJlY2F0aW9uTWVzc2FnZT86IHN0cmluZztcblx0YWxsb3dFbXB0eVZhbHVlPzogYm9vbGVhbjtcblx0Y2F0Pzoga2V5b2YgdHlwZW9mIGhlbHBDYXRlZ29yaWVzO1xuXHRnbG9iYWw/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1YmNvbW1hbmQ8VD4ge1xuXHR0eXBlOiAnc3ViY29tbWFuZCc7XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRkZXByZWNhdGlvbk1lc3NhZ2U/OiBzdHJpbmc7XG5cdG9wdGlvbnM6IE9wdGlvbkRlc2NyaXB0aW9uczxSZXF1aXJlZDxUPj47XG59XG5cbmV4cG9ydCB0eXBlIE9wdGlvbkRlc2NyaXB0aW9uczxUPiA9IHtcblx0W1AgaW4ga2V5b2YgVF06XG5cdFRbUF0gZXh0ZW5kcyBib29sZWFuIHwgdW5kZWZpbmVkID8gT3B0aW9uPCdib29sZWFuJz4gOlxuXHRUW1BdIGV4dGVuZHMgc3RyaW5nIHwgdW5kZWZpbmVkID8gT3B0aW9uPCdzdHJpbmcnPiA6XG5cdFRbUF0gZXh0ZW5kcyBzdHJpbmdbXSB8IHVuZGVmaW5lZCA/IE9wdGlvbjwnc3RyaW5nW10nPiA6XG5cdFN1YmNvbW1hbmQ8VFtQXT5cbn07XG5cbmV4cG9ydCBjb25zdCBOQVRJVkVfQ0xJX0NPTU1BTkRTID0gWyd0dW5uZWwnLCAnc2VydmUtd2ViJ10gYXMgY29uc3Q7XG5cbmV4cG9ydCBjb25zdCBPUFRJT05TOiBPcHRpb25EZXNjcmlwdGlvbnM8UmVxdWlyZWQ8TmF0aXZlUGFyc2VkQXJncz4+ID0ge1xuXHQndHVubmVsJzoge1xuXHRcdHR5cGU6ICdzdWJjb21tYW5kJyxcblx0XHRkZXNjcmlwdGlvbjogJ01ha2UgdGhlIGN1cnJlbnQgbWFjaGluZSBhY2Nlc3NpYmxlIGZyb20gdnNjb2RlLmRldiBvciBvdGhlciBtYWNoaW5lcyB0aHJvdWdoIGEgc2VjdXJlIHR1bm5lbCcsXG5cdFx0b3B0aW9uczoge1xuXHRcdFx0J2NsaS1kYXRhLWRpcic6IHsgdHlwZTogJ3N0cmluZycsIGFyZ3M6ICdkaXInLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NsaURhdGFEaXInLCBcIkRpcmVjdG9yeSB3aGVyZSBDTEkgbWV0YWRhdGEgc2hvdWxkIGJlIHN0b3JlZC5cIikgfSxcblx0XHRcdCdkaXNhYmxlLXRlbGVtZXRyeSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdFx0XHQndGVsZW1ldHJ5LWxldmVsJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHRcdFx0dXNlcjoge1xuXHRcdFx0XHR0eXBlOiAnc3ViY29tbWFuZCcsXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRsb2dpbjoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N1YmNvbW1hbmQnLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRwcm92aWRlcjogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHRcdFx0XHRcdFx0XHQnYWNjZXNzLXRva2VuJzogeyB0eXBlOiAnc3RyaW5nJyB9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXHQnc2VydmUtd2ViJzoge1xuXHRcdHR5cGU6ICdzdWJjb21tYW5kJyxcblx0XHRkZXNjcmlwdGlvbjogJ1J1biBhIHNlcnZlciB0aGF0IGRpc3BsYXlzIHRoZSBlZGl0b3IgVUkgaW4gYnJvd3NlcnMuJyxcblx0XHRvcHRpb25zOiB7XG5cdFx0XHQnY2xpLWRhdGEtZGlyJzogeyB0eXBlOiAnc3RyaW5nJywgYXJnczogJ2RpcicsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2xpRGF0YURpcicsIFwiRGlyZWN0b3J5IHdoZXJlIENMSSBtZXRhZGF0YSBzaG91bGQgYmUgc3RvcmVkLlwiKSB9LFxuXHRcdFx0J2Rpc2FibGUtdGVsZW1ldHJ5JzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdCd0ZWxlbWV0cnktbGV2ZWwnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0fVxuXHR9LFxuXG5cdCdkaWZmJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ28nLCBhbGlhczogJ2QnLCBhcmdzOiBbJ2ZpbGUnLCAnZmlsZSddLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2RpZmYnLCBcIkNvbXBhcmUgdHdvIGZpbGVzIHdpdGggZWFjaCBvdGhlci5cIikgfSxcblx0J21lcmdlJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ28nLCBhbGlhczogJ20nLCBhcmdzOiBbJ3BhdGgxJywgJ3BhdGgyJywgJ2Jhc2UnLCAncmVzdWx0J10sIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVyZ2UnLCBcIlBlcmZvcm0gYSB0aHJlZS13YXkgbWVyZ2UgYnkgcHJvdmlkaW5nIHBhdGhzIGZvciB0d28gbW9kaWZpZWQgdmVyc2lvbnMgb2YgYSBmaWxlLCB0aGUgY29tbW9uIG9yaWdpbiBvZiBib3RoIG1vZGlmaWVkIHZlcnNpb25zIGFuZCB0aGUgb3V0cHV0IGZpbGUgdG8gc2F2ZSBtZXJnZSByZXN1bHRzLlwiKSB9LFxuXHQnYWRkJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ28nLCBhbGlhczogJ2EnLCBhcmdzOiAnZm9sZGVyJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdhZGQnLCBcIkFkZCBmb2xkZXIocykgdG8gdGhlIGxhc3QgYWN0aXZlIHdpbmRvdy5cIikgfSxcblx0J3JlbW92ZSc6IHsgdHlwZTogJ2Jvb2xlYW4nLCBjYXQ6ICdvJywgYXJnczogJ2ZvbGRlcicsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3ZlJywgXCJSZW1vdmUgZm9sZGVyKHMpIGZyb20gdGhlIGxhc3QgYWN0aXZlIHdpbmRvdy5cIikgfSxcblx0J2dvdG8nOiB7IHR5cGU6ICdib29sZWFuJywgY2F0OiAnbycsIGFsaWFzOiAnZycsIGFyZ3M6ICdmaWxlOmxpbmVbOmNoYXJhY3Rlcl0nLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dvdG8nLCBcIk9wZW4gYSBmaWxlIGF0IHRoZSBwYXRoIG9uIHRoZSBzcGVjaWZpZWQgbGluZSBhbmQgY2hhcmFjdGVyIHBvc2l0aW9uLlwiKSB9LFxuXHQnbmV3LXdpbmRvdyc6IHsgdHlwZTogJ2Jvb2xlYW4nLCBjYXQ6ICdvJywgYWxpYXM6ICduJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCduZXdXaW5kb3cnLCBcIkZvcmNlIHRvIG9wZW4gYSBuZXcgd2luZG93LlwiKSB9LFxuXHQncmV1c2Utd2luZG93JzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ28nLCBhbGlhczogJ3InLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JldXNlV2luZG93JywgXCJGb3JjZSB0byBvcGVuIGEgZmlsZSBvciBmb2xkZXIgaW4gYW4gYWxyZWFkeSBvcGVuZWQgd2luZG93LlwiKSB9LFxuXHQnd2FpdCc6IHsgdHlwZTogJ2Jvb2xlYW4nLCBjYXQ6ICdvJywgYWxpYXM6ICd3JywgZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWl0JywgXCJXYWl0IGZvciB0aGUgZmlsZXMgdG8gYmUgY2xvc2VkIGJlZm9yZSByZXR1cm5pbmcuXCIpIH0sXG5cdCd3YWl0TWFya2VyRmlsZVBhdGgnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCdsb2NhbGUnOiB7IHR5cGU6ICdzdHJpbmcnLCBjYXQ6ICdvJywgYXJnczogJ2xvY2FsZScsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbG9jYWxlJywgXCJUaGUgbG9jYWxlIHRvIHVzZSAoZS5nLiBlbi1VUyBvciB6aC1UVykuXCIpIH0sXG5cdCd1c2VyLWRhdGEtZGlyJzogeyB0eXBlOiAnc3RyaW5nJywgY2F0OiAnbycsIGFyZ3M6ICdkaXInLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3VzZXJEYXRhRGlyJywgXCJTcGVjaWZpZXMgdGhlIGRpcmVjdG9yeSB0aGF0IHVzZXIgZGF0YSBpcyBrZXB0IGluLiBDYW4gYmUgdXNlZCB0byBvcGVuIG11bHRpcGxlIGRpc3RpbmN0IGluc3RhbmNlcyBvZiBDb2RlLlwiKSB9LFxuXHQncHJvZmlsZSc6IHsgdHlwZTogJ3N0cmluZycsICdjYXQnOiAnbycsIGFyZ3M6ICdwcm9maWxlTmFtZScsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncHJvZmlsZU5hbWUnLCBcIk9wZW5zIHRoZSBwcm92aWRlZCBmb2xkZXIgb3Igd29ya3NwYWNlIHdpdGggdGhlIGdpdmVuIHByb2ZpbGUgYW5kIGFzc29jaWF0ZXMgdGhlIHByb2ZpbGUgd2l0aCB0aGUgd29ya3NwYWNlLiBJZiB0aGUgcHJvZmlsZSBkb2VzIG5vdCBleGlzdCwgYSBuZXcgZW1wdHkgb25lIGlzIGNyZWF0ZWQuXCIpIH0sXG5cdCdoZWxwJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ28nLCBhbGlhczogJ2gnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2hlbHAnLCBcIlByaW50IHVzYWdlLlwiKSB9LFxuXG5cdCdleHRlbnNpb25zLWRpcic6IHsgdHlwZTogJ3N0cmluZycsIGRlcHJlY2F0ZXM6IFsnZXh0ZW5zaW9uSG9tZVBhdGgnXSwgY2F0OiAnZScsIGFyZ3M6ICdkaXInLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbkhvbWVQYXRoJywgXCJTZXQgdGhlIHJvb3QgcGF0aCBmb3IgZXh0ZW5zaW9ucy5cIikgfSxcblx0J2V4dGVuc2lvbnMtZG93bmxvYWQtZGlyJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQnYnVpbHRpbi1leHRlbnNpb25zLWRpcic6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J2xpc3QtZXh0ZW5zaW9ucyc6IHsgdHlwZTogJ2Jvb2xlYW4nLCBjYXQ6ICdlJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdsaXN0RXh0ZW5zaW9ucycsIFwiTGlzdCB0aGUgaW5zdGFsbGVkIGV4dGVuc2lvbnMuXCIpIH0sXG5cdCdzaG93LXZlcnNpb25zJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ2UnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Nob3dWZXJzaW9ucycsIFwiU2hvdyB2ZXJzaW9ucyBvZiBpbnN0YWxsZWQgZXh0ZW5zaW9ucywgd2hlbiB1c2luZyAtLWxpc3QtZXh0ZW5zaW9ucy5cIikgfSxcblx0J2NhdGVnb3J5JzogeyB0eXBlOiAnc3RyaW5nJywgYWxsb3dFbXB0eVZhbHVlOiB0cnVlLCBjYXQ6ICdlJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdjYXRlZ29yeScsIFwiRmlsdGVycyBpbnN0YWxsZWQgZXh0ZW5zaW9ucyBieSBwcm92aWRlZCBjYXRlZ29yeSwgd2hlbiB1c2luZyAtLWxpc3QtZXh0ZW5zaW9ucy5cIiksIGFyZ3M6ICdjYXRlZ29yeScgfSxcblx0J2luc3RhbGwtZXh0ZW5zaW9uJzogeyB0eXBlOiAnc3RyaW5nW10nLCBjYXQ6ICdlJywgYXJnczogJ2V4dC1pZCB8IHBhdGgnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2luc3RhbGxFeHRlbnNpb24nLCBcIkluc3RhbGxzIG9yIHVwZGF0ZXMgYW4gZXh0ZW5zaW9uLiBUaGUgYXJndW1lbnQgaXMgZWl0aGVyIGFuIGV4dGVuc2lvbiBpZCBvciBhIHBhdGggdG8gYSBWU0lYLiBUaGUgaWRlbnRpZmllciBvZiBhbiBleHRlbnNpb24gaXMgJyR7cHVibGlzaGVyfS4ke25hbWV9Jy4gVXNlICctLWZvcmNlJyBhcmd1bWVudCB0byB1cGRhdGUgdG8gbGF0ZXN0IHZlcnNpb24uIFRvIGluc3RhbGwgYSBzcGVjaWZpYyB2ZXJzaW9uIHByb3ZpZGUgJ0Ake3ZlcnNpb259Jy4gRm9yIGV4YW1wbGU6ICd2c2NvZGUuY3NoYXJwQDEuMi4zJy5cIikgfSxcblx0J3ByZS1yZWxlYXNlJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ2UnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2luc3RhbGwgcHJlcmVsZWFzZScsIFwiSW5zdGFsbHMgdGhlIHByZS1yZWxlYXNlIHZlcnNpb24gb2YgdGhlIGV4dGVuc2lvbiwgd2hlbiB1c2luZyAtLWluc3RhbGwtZXh0ZW5zaW9uXCIpIH0sXG5cdCd1bmluc3RhbGwtZXh0ZW5zaW9uJzogeyB0eXBlOiAnc3RyaW5nW10nLCBjYXQ6ICdlJywgYXJnczogJ2V4dC1pZCcsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndW5pbnN0YWxsRXh0ZW5zaW9uJywgXCJVbmluc3RhbGxzIGFuIGV4dGVuc2lvbi5cIikgfSxcblx0J3VwZGF0ZS1leHRlbnNpb25zJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ2UnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3VwZGF0ZUV4dGVuc2lvbnMnLCBcIlVwZGF0ZSB0aGUgaW5zdGFsbGVkIGV4dGVuc2lvbnMuXCIpIH0sXG5cdCdlbmFibGUtcHJvcG9zZWQtYXBpJzogeyB0eXBlOiAnc3RyaW5nW10nLCBhbGxvd0VtcHR5VmFsdWU6IHRydWUsIGNhdDogJ2UnLCBhcmdzOiAnZXh0LWlkJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdleHBlcmltZW50YWxBcGlzJywgXCJFbmFibGVzIHByb3Bvc2VkIEFQSSBmZWF0dXJlcyBmb3IgZXh0ZW5zaW9ucy4gQ2FuIHJlY2VpdmUgb25lIG9yIG1vcmUgZXh0ZW5zaW9uIElEcyB0byBlbmFibGUgaW5kaXZpZHVhbGx5LlwiKSB9LFxuXG5cdCdhZGQtbWNwJzogeyB0eXBlOiAnc3RyaW5nW10nLCBjYXQ6ICdvJywgYXJnczogJ2pzb24nLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FkZE1jcCcsIFwiQWRkcyBhIE1vZGVsIENvbnRleHQgUHJvdG9jb2wgc2VydmVyIGRlZmluaXRpb24gdG8gdGhlIHVzZXIgcHJvZmlsZSwgb3Igd29ya3NwYWNlIG9yIGZvbGRlciB3aGVuIHVzZWQgd2l0aCAtLW1jcC13b3Jrc3BhY2UuIEFjY2VwdHMgSlNPTiBpbnB1dCBpbiB0aGUgZm9ybSAne1xcXCJuYW1lXFxcIjpcXFwic2VydmVyLW5hbWVcXFwiLFxcXCJjb21tYW5kXFxcIjouLi59J1wiKSB9LFxuXG5cdCd2ZXJzaW9uJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ3QnLCBhbGlhczogJ3YnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZlcnNpb24nLCBcIlByaW50IHZlcnNpb24uXCIpIH0sXG5cdCd2ZXJib3NlJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ3QnLCBnbG9iYWw6IHRydWUsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmVyYm9zZScsIFwiUHJpbnQgdmVyYm9zZSBvdXRwdXQgKGltcGxpZXMgLS13YWl0KS5cIikgfSxcblx0J2xvZyc6IHsgdHlwZTogJ3N0cmluZ1tdJywgY2F0OiAndCcsIGFyZ3M6ICdsZXZlbCcsIGdsb2JhbDogdHJ1ZSwgZGVzY3JpcHRpb246IGxvY2FsaXplKCdsb2cnLCBcIkxvZyBsZXZlbCB0byB1c2UuIERlZmF1bHQgaXMgJ2luZm8nLiBBbGxvd2VkIHZhbHVlcyBhcmUgJ2NyaXRpY2FsJywgJ2Vycm9yJywgJ3dhcm4nLCAnaW5mbycsICdkZWJ1ZycsICd0cmFjZScsICdvZmYnLiBZb3UgY2FuIGFsc28gY29uZmlndXJlIHRoZSBsb2cgbGV2ZWwgb2YgYW4gZXh0ZW5zaW9uIGJ5IHBhc3NpbmcgZXh0ZW5zaW9uIGlkIGFuZCBsb2cgbGV2ZWwgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXQ6ICcke3B1Ymxpc2hlcn0uJHtuYW1lfToke2xvZ0xldmVsfScuIEZvciBleGFtcGxlOiAndnNjb2RlLmNzaGFycDp0cmFjZScuIENhbiByZWNlaXZlIG9uZSBvciBtb3JlIHN1Y2ggZW50cmllcy5cIikgfSxcblx0J3N0YXR1cyc6IHsgdHlwZTogJ2Jvb2xlYW4nLCBhbGlhczogJ3MnLCBjYXQ6ICd0JywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdzdGF0dXMnLCBcIlByaW50IHByb2Nlc3MgdXNhZ2UgYW5kIGRpYWdub3N0aWNzIGluZm9ybWF0aW9uLlwiKSB9LFxuXHQncHJvZi1zdGFydHVwJzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ3QnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Byb2Ytc3RhcnR1cCcsIFwiUnVuIENQVSBwcm9maWxlciBkdXJpbmcgc3RhcnR1cC5cIikgfSxcblx0J3Byb2YtYXBwZW5kLXRpbWVycyc6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J3Byb2YtZHVyYXRpb24tbWFya2Vycyc6IHsgdHlwZTogJ3N0cmluZ1tdJyB9LFxuXHQncHJvZi1kdXJhdGlvbi1tYXJrZXJzLWZpbGUnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCduby1jYWNoZWQtZGF0YSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCdwcm9mLXN0YXJ0dXAtcHJlZml4JzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQncHJvZi12OC1leHRlbnNpb25zJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2Rpc2FibGUtZXh0ZW5zaW9ucyc6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXByZWNhdGVzOiBbJ2Rpc2FibGVFeHRlbnNpb25zJ10sIGNhdDogJ3QnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2Rpc2FibGVFeHRlbnNpb25zJywgXCJEaXNhYmxlIGFsbCBpbnN0YWxsZWQgZXh0ZW5zaW9ucy4gVGhpcyBvcHRpb24gaXMgbm90IHBlcnNpc3RlZCBhbmQgaXMgZWZmZWN0aXZlIG9ubHkgd2hlbiB0aGUgY29tbWFuZCBvcGVucyBhIG5ldyB3aW5kb3cuXCIpIH0sXG5cdCdkaXNhYmxlLWV4dGVuc2lvbic6IHsgdHlwZTogJ3N0cmluZ1tdJywgY2F0OiAndCcsIGFyZ3M6ICdleHQtaWQnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2Rpc2FibGVFeHRlbnNpb24nLCBcIkRpc2FibGUgdGhlIHByb3ZpZGVkIGV4dGVuc2lvbi4gVGhpcyBvcHRpb24gaXMgbm90IHBlcnNpc3RlZCBhbmQgaXMgZWZmZWN0aXZlIG9ubHkgd2hlbiB0aGUgY29tbWFuZCBvcGVucyBhIG5ldyB3aW5kb3cuXCIpIH0sXG5cdCdzeW5jJzogeyB0eXBlOiAnc3RyaW5nJywgY2F0OiAndCcsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndHVybiBzeW5jJywgXCJUdXJuIHN5bmMgb24gb3Igb2ZmLlwiKSwgYXJnczogWydvbiB8IG9mZiddIH0sXG5cblx0J2luc3BlY3QtZXh0ZW5zaW9ucyc6IHsgdHlwZTogJ3N0cmluZycsIGFsbG93RW1wdHlWYWx1ZTogdHJ1ZSwgZGVwcmVjYXRlczogWydkZWJ1Z1BsdWdpbkhvc3QnXSwgYXJnczogJ3BvcnQnLCBjYXQ6ICd0JywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdpbnNwZWN0LWV4dGVuc2lvbnMnLCBcIkFsbG93IGRlYnVnZ2luZyBhbmQgcHJvZmlsaW5nIG9mIGV4dGVuc2lvbnMuIENoZWNrIHRoZSBkZXZlbG9wZXIgdG9vbHMgZm9yIHRoZSBjb25uZWN0aW9uIFVSSS5cIikgfSxcblx0J2luc3BlY3QtYnJrLWV4dGVuc2lvbnMnOiB7IHR5cGU6ICdzdHJpbmcnLCBhbGxvd0VtcHR5VmFsdWU6IHRydWUsIGRlcHJlY2F0ZXM6IFsnZGVidWdCcmtQbHVnaW5Ib3N0J10sIGFyZ3M6ICdwb3J0JywgY2F0OiAndCcsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaW5zcGVjdC1icmstZXh0ZW5zaW9ucycsIFwiQWxsb3cgZGVidWdnaW5nIGFuZCBwcm9maWxpbmcgb2YgZXh0ZW5zaW9ucyB3aXRoIHRoZSBleHRlbnNpb24gaG9zdCBiZWluZyBwYXVzZWQgYWZ0ZXIgc3RhcnQuIENoZWNrIHRoZSBkZXZlbG9wZXIgdG9vbHMgZm9yIHRoZSBjb25uZWN0aW9uIFVSSS5cIikgfSxcblx0J2Rpc2FibGUtbGNkLXRleHQnOiB7IHR5cGU6ICdib29sZWFuJywgY2F0OiAndCcsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZGlzYWJsZUxDRFRleHQnLCBcIkRpc2FibGUgTENEIGZvbnQgcmVuZGVyaW5nLlwiKSB9LFxuXHQnZGlzYWJsZS1ncHUnOiB7IHR5cGU6ICdib29sZWFuJywgY2F0OiAndCcsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZGlzYWJsZUdQVScsIFwiRGlzYWJsZSBHUFUgaGFyZHdhcmUgYWNjZWxlcmF0aW9uLlwiKSB9LFxuXHQnZGlzYWJsZS1jaHJvbWl1bS1zYW5kYm94JzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ3QnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2Rpc2FibGVDaHJvbWl1bVNhbmRib3gnLCBcIlVzZSB0aGlzIG9wdGlvbiBvbmx5IHdoZW4gdGhlcmUgaXMgcmVxdWlyZW1lbnQgdG8gbGF1bmNoIHRoZSBhcHBsaWNhdGlvbiBhcyBzdWRvIHVzZXIgb24gTGludXggb3Igd2hlbiBydW5uaW5nIGFzIGFuIGVsZXZhdGVkIHVzZXIgaW4gYW4gYXBwbG9ja2VyIGVudmlyb25tZW50IG9uIFdpbmRvd3MuXCIpIH0sXG5cdCdzYW5kYm94JzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2xvY2F0ZS1zaGVsbC1pbnRlZ3JhdGlvbi1wYXRoJzogeyB0eXBlOiAnc3RyaW5nJywgY2F0OiAndCcsIGFyZ3M6IFsnc2hlbGwnXSwgZGVzY3JpcHRpb246IGxvY2FsaXplKCdsb2NhdGVTaGVsbEludGVncmF0aW9uUGF0aCcsIFwiUHJpbnQgdGhlIHBhdGggdG8gYSB0ZXJtaW5hbCBzaGVsbCBpbnRlZ3JhdGlvbiBzY3JpcHQuIEFsbG93ZWQgdmFsdWVzIGFyZSAnYmFzaCcsICdwd3NoJywgJ3pzaCcgb3IgJ2Zpc2gnLlwiKSB9LFxuXHQndGVsZW1ldHJ5JzogeyB0eXBlOiAnYm9vbGVhbicsIGNhdDogJ3QnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3RlbGVtZXRyeScsIFwiU2hvd3MgYWxsIHRlbGVtZXRyeSBldmVudHMgd2hpY2ggVlMgY29kZSBjb2xsZWN0cy5cIikgfSxcblxuXHQncmVtb3RlJzogeyB0eXBlOiAnc3RyaW5nJywgYWxsb3dFbXB0eVZhbHVlOiB0cnVlIH0sXG5cdCdmb2xkZXItdXJpJzogeyB0eXBlOiAnc3RyaW5nW10nLCBjYXQ6ICdvJywgYXJnczogJ3VyaScgfSxcblx0J2ZpbGUtdXJpJzogeyB0eXBlOiAnc3RyaW5nW10nLCBjYXQ6ICdvJywgYXJnczogJ3VyaScgfSxcblxuXHQnbG9jYXRlLWV4dGVuc2lvbic6IHsgdHlwZTogJ3N0cmluZ1tdJyB9LFxuXHQnZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoJzogeyB0eXBlOiAnc3RyaW5nW10nIH0sXG5cdCdleHRlbnNpb25EZXZlbG9wbWVudEtpbmQnOiB7IHR5cGU6ICdzdHJpbmdbXScgfSxcblx0J2V4dGVuc2lvblRlc3RzUGF0aCc6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J2V4dGVuc2lvbkVudmlyb25tZW50JzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQnZGVidWdJZCc6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J2RlYnVnUmVuZGVyZXInOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnaW5zcGVjdC1wdHlob3N0JzogeyB0eXBlOiAnc3RyaW5nJywgYWxsb3dFbXB0eVZhbHVlOiB0cnVlIH0sXG5cdCdpbnNwZWN0LWJyay1wdHlob3N0JzogeyB0eXBlOiAnc3RyaW5nJywgYWxsb3dFbXB0eVZhbHVlOiB0cnVlIH0sXG5cdCdpbnNwZWN0LXNlYXJjaCc6IHsgdHlwZTogJ3N0cmluZycsIGRlcHJlY2F0ZXM6IFsnZGVidWdTZWFyY2gnXSwgYWxsb3dFbXB0eVZhbHVlOiB0cnVlIH0sXG5cdCdpbnNwZWN0LWJyay1zZWFyY2gnOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXByZWNhdGVzOiBbJ2RlYnVnQnJrU2VhcmNoJ10sIGFsbG93RW1wdHlWYWx1ZTogdHJ1ZSB9LFxuXHQnaW5zcGVjdC1zaGFyZWRwcm9jZXNzJzogeyB0eXBlOiAnc3RyaW5nJywgYWxsb3dFbXB0eVZhbHVlOiB0cnVlIH0sXG5cdCdpbnNwZWN0LWJyay1zaGFyZWRwcm9jZXNzJzogeyB0eXBlOiAnc3RyaW5nJywgYWxsb3dFbXB0eVZhbHVlOiB0cnVlIH0sXG5cdCdleHBvcnQtZGVmYXVsdC1jb25maWd1cmF0aW9uJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQnaW5zdGFsbC1zb3VyY2UnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCdlbmFibGUtc21va2UtdGVzdC1kcml2ZXInOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnbG9nRXh0ZW5zaW9uSG9zdENvbW11bmljYXRpb24nOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnc2tpcC1yZWxlYXNlLW5vdGVzJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J3NraXAtd2VsY29tZSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCdkaXNhYmxlLXRlbGVtZXRyeSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCdkaXNhYmxlLXVwZGF0ZXMnOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQndXNlLWlubWVtb3J5LXNlY3JldHN0b3JhZ2UnOiB7IHR5cGU6ICdib29sZWFuJywgZGVwcmVjYXRlczogWydkaXNhYmxlLWtleXRhciddIH0sXG5cdCdwYXNzd29yZC1zdG9yZSc6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J2Rpc2FibGUtd29ya3NwYWNlLXRydXN0JzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2Rpc2FibGUtY3Jhc2gtcmVwb3J0ZXInOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnY3Jhc2gtcmVwb3J0ZXItZGlyZWN0b3J5JzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQnY3Jhc2gtcmVwb3J0ZXItaWQnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCdza2lwLWFkZC10by1yZWNlbnRseS1vcGVuZWQnOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnb3Blbi11cmwnOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnZmlsZS13cml0ZSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCdmaWxlLWNobW9kJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2luc3RhbGwtYnVpbHRpbi1leHRlbnNpb24nOiB7IHR5cGU6ICdzdHJpbmdbXScgfSxcblx0J2ZvcmNlJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2RvLW5vdC1zeW5jJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2RvLW5vdC1pbmNsdWRlLXBhY2stZGVwZW5kZW5jaWVzJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J3RyYWNlJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J3RyYWNlLW1lbW9yeS1pbmZyYSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCd0cmFjZS1jYXRlZ29yeS1maWx0ZXInOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCd0cmFjZS1vcHRpb25zJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQncHJlc2VydmUtZW52JzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2ZvcmNlLXVzZXItZW52JzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2ZvcmNlLWRpc2FibGUtdXNlci1lbnYnOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnb3Blbi1kZXZ0b29scyc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCdkaXNhYmxlLWdwdS1zYW5kYm94JzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J2xvZ3NQYXRoJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQnX19lbmFibGUtZmlsZS1wb2xpY3knOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnZWRpdFNlc3Npb25JZCc6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J2NvbnRpbnVlT24nOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCdlbmFibGUtY29pJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0J3VucmVzcG9uc2l2ZS1zYW1wbGUtaW50ZXJ2YWwnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCd1bnJlc3BvbnNpdmUtc2FtcGxlLXBlcmlvZCc6IHsgdHlwZTogJ3N0cmluZycgfSxcblxuXHQvLyBjaHJvbWl1bSBmbGFnc1xuXHQnbm8tcHJveHktc2VydmVyJzogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0Ly8gTWluaW1pc3QgaW5jb3JyZWN0bHkgcGFyc2VzIGtleXMgdGhhdCBzdGFydCB3aXRoIGAtLW5vYFxuXHQvLyBodHRwczovL2dpdGh1Yi5jb20vc3Vic3RhY2svbWluaW1pc3QvYmxvYi9hZWIzZTI3ZGFlMDQxMmRlNWMwNDk0ZTk1NjNhNWYxMGM4MmNjN2E5L2luZGV4LmpzI0wxMTgtTDEyMVxuXHQvLyBJZiAtLW5vLXNhbmRib3ggaXMgcGFzc2VkIHZpYSBjbGkgd3JhcHBlciBpdCB3aWxsIGJlIHRyZWF0ZWQgYXMgLS1zYW5kYm94IHdoaWNoIGlzIGluY29ycmVjdCwgd2UgdXNlXG5cdC8vIHRoZSBhbGlhcyBoZXJlIHRvIG1ha2Ugc3VyZSAtLW5vLXNhbmRib3ggaXMgYWx3YXlzIHJlc3BlY3RlZC5cblx0Ly8gRm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjgyNzlcblx0J25vLXNhbmRib3gnOiB7IHR5cGU6ICdib29sZWFuJywgYWxpYXM6ICdzYW5kYm94JyB9LFxuXHQncHJveHktc2VydmVyJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQncHJveHktYnlwYXNzLWxpc3QnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCdwcm94eS1wYWMtdXJsJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQnanMtZmxhZ3MnOiB7IHR5cGU6ICdzdHJpbmcnIH0sIC8vIGNocm9tZSBqcyBmbGFnc1xuXHQnaW5zcGVjdCc6IHsgdHlwZTogJ3N0cmluZycsIGFsbG93RW1wdHlWYWx1ZTogdHJ1ZSB9LFxuXHQnaW5zcGVjdC1icmsnOiB7IHR5cGU6ICdzdHJpbmcnLCBhbGxvd0VtcHR5VmFsdWU6IHRydWUgfSxcblx0J25vbGF6eSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sIC8vIG5vZGUgaW5zcGVjdFxuXHQnZm9yY2UtZGV2aWNlLXNjYWxlLWZhY3Rvcic6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J2ZvcmNlLXJlbmRlcmVyLWFjY2Vzc2liaWxpdHknOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnaWdub3JlLWNlcnRpZmljYXRlLWVycm9ycyc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCdhbGxvdy1pbnNlY3VyZS1sb2NhbGhvc3QnOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnbG9nLW5ldC1sb2cnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCd2bW9kdWxlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQnX3VybHMnOiB7IHR5cGU6ICdzdHJpbmdbXScgfSxcblx0J2Rpc2FibGUtZGV2LXNobS11c2FnZSc6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdCdwcm9maWxlLXRlbXAnOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHQnb3pvbmUtcGxhdGZvcm0nOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdCdlbmFibGUtdHJhY2luZyc6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J3RyYWNlLXN0YXJ0dXAtZm9ybWF0JzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQndHJhY2Utc3RhcnR1cC1maWxlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHQndHJhY2Utc3RhcnR1cC1kdXJhdGlvbic6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0J3hkZy1wb3J0YWwtcmVxdWlyZWQtdmVyc2lvbic6IHsgdHlwZTogJ3N0cmluZycgfSxcblxuXHRfOiB7IHR5cGU6ICdzdHJpbmdbXScgfSAvLyBtYWluIGFyZ3VtZW50c1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBFcnJvclJlcG9ydGVyIHtcblx0b25Vbmtub3duT3B0aW9uKGlkOiBzdHJpbmcpOiB2b2lkO1xuXHRvbk11bHRpcGxlVmFsdWVzKGlkOiBzdHJpbmcsIHVzZWRWYWx1ZTogc3RyaW5nKTogdm9pZDtcblx0b25FbXB0eVZhbHVlKGlkOiBzdHJpbmcpOiB2b2lkO1xuXHRvbkRlcHJlY2F0ZWRPcHRpb24oZGVwcmVjYXRlZElkOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQ7XG5cblx0Z2V0U3ViY29tbWFuZFJlcG9ydGVyPyhjb21tYW5kOiBzdHJpbmcpOiBFcnJvclJlcG9ydGVyO1xufVxuXG5jb25zdCBpZ25vcmluZ1JlcG9ydGVyID0ge1xuXHRvblVua25vd25PcHRpb246ICgpID0+IHsgfSxcblx0b25NdWx0aXBsZVZhbHVlczogKCkgPT4geyB9LFxuXHRvbkVtcHR5VmFsdWU6ICgpID0+IHsgfSxcblx0b25EZXByZWNhdGVkT3B0aW9uOiAoKSA9PiB7IH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFyZ3M8VD4oYXJnczogc3RyaW5nW10sIG9wdGlvbnM6IE9wdGlvbkRlc2NyaXB0aW9uczxUPiwgZXJyb3JSZXBvcnRlcjogRXJyb3JSZXBvcnRlciA9IGlnbm9yaW5nUmVwb3J0ZXIpOiBUIHtcblx0Y29uc3QgZmlyc3RBcmcgPSBhcmdzLmZpbmQoYSA9PiBhLmxlbmd0aCA+IDAgJiYgYVswXSAhPT0gJy0nKTtcblxuXHRjb25zdCBhbGlhczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuXHRjb25zdCBzdHJpbmdPcHRpb25zOiBzdHJpbmdbXSA9IFsnXyddO1xuXHRjb25zdCBib29sZWFuT3B0aW9uczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgZ2xvYmFsT3B0aW9uczogT3B0aW9uRGVzY3JpcHRpb25zPGFueT4gPSB7fTtcblx0bGV0IGNvbW1hbmQ6IFN1YmNvbW1hbmQ8YW55PiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Zm9yIChjb25zdCBvcHRpb25JZCBpbiBvcHRpb25zKSB7XG5cdFx0Y29uc3QgbyA9IG9wdGlvbnNbb3B0aW9uSWRdO1xuXHRcdGlmIChvLnR5cGUgPT09ICdzdWJjb21tYW5kJykge1xuXHRcdFx0aWYgKG9wdGlvbklkID09PSBmaXJzdEFyZykge1xuXHRcdFx0XHRjb21tYW5kID0gbztcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKG8uYWxpYXMpIHtcblx0XHRcdFx0YWxpYXNbb3B0aW9uSWRdID0gby5hbGlhcztcblx0XHRcdH1cblxuXHRcdFx0aWYgKG8udHlwZSA9PT0gJ3N0cmluZycgfHwgby50eXBlID09PSAnc3RyaW5nW10nKSB7XG5cdFx0XHRcdHN0cmluZ09wdGlvbnMucHVzaChvcHRpb25JZCk7XG5cdFx0XHRcdGlmIChvLmRlcHJlY2F0ZXMpIHtcblx0XHRcdFx0XHRzdHJpbmdPcHRpb25zLnB1c2goLi4uby5kZXByZWNhdGVzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChvLnR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRib29sZWFuT3B0aW9ucy5wdXNoKG9wdGlvbklkKTtcblx0XHRcdFx0aWYgKG8uZGVwcmVjYXRlcykge1xuXHRcdFx0XHRcdGJvb2xlYW5PcHRpb25zLnB1c2goLi4uby5kZXByZWNhdGVzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG8uZ2xvYmFsKSB7XG5cdFx0XHRcdGdsb2JhbE9wdGlvbnNbb3B0aW9uSWRdID0gbztcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0aWYgKGNvbW1hbmQgJiYgZmlyc3RBcmcpIHtcblx0XHRjb25zdCBvcHRpb25zID0gZ2xvYmFsT3B0aW9ucztcblx0XHRmb3IgKGNvbnN0IG9wdGlvbklkIGluIGNvbW1hbmQub3B0aW9ucykge1xuXHRcdFx0b3B0aW9uc1tvcHRpb25JZF0gPSBjb21tYW5kLm9wdGlvbnNbb3B0aW9uSWRdO1xuXHRcdH1cblx0XHRjb25zdCBuZXdBcmdzID0gYXJncy5maWx0ZXIoYSA9PiBhICE9PSBmaXJzdEFyZyk7XG5cdFx0Y29uc3QgcmVwb3J0ZXIgPSBlcnJvclJlcG9ydGVyLmdldFN1YmNvbW1hbmRSZXBvcnRlciA/IGVycm9yUmVwb3J0ZXIuZ2V0U3ViY29tbWFuZFJlcG9ydGVyKGZpcnN0QXJnKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzdWJjb21tYW5kT3B0aW9ucyA9IHBhcnNlQXJncyhuZXdBcmdzLCBvcHRpb25zLCByZXBvcnRlcik7XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9uc1xuXHRcdHJldHVybiA8VD57XG5cdFx0XHRbZmlyc3RBcmddOiBzdWJjb21tYW5kT3B0aW9ucyxcblx0XHRcdF86IFtdXG5cdFx0fTtcblx0fVxuXG5cblx0Ly8gcmVtb3ZlIGFsaWFzZXMgdG8gYXZvaWQgY29uZnVzaW9uXG5cdGNvbnN0IHBhcnNlZEFyZ3MgPSBtaW5pbWlzdChhcmdzLCB7IHN0cmluZzogc3RyaW5nT3B0aW9ucywgYm9vbGVhbjogYm9vbGVhbk9wdGlvbnMsIGFsaWFzIH0pO1xuXG5cdGNvbnN0IGNsZWFuZWRBcmdzOiBhbnkgPSB7fTtcblx0Y29uc3QgcmVtYWluaW5nQXJnczogYW55ID0gcGFyc2VkQXJncztcblxuXHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNTgxNzcsIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDY2MTdcblx0Y2xlYW5lZEFyZ3MuXyA9IHBhcnNlZEFyZ3MuXy5tYXAoYXJnID0+IFN0cmluZyhhcmcpKS5maWx0ZXIoYXJnID0+IGFyZy5sZW5ndGggPiAwKTtcblxuXHRkZWxldGUgcmVtYWluaW5nQXJncy5fO1xuXG5cdGZvciAoY29uc3Qgb3B0aW9uSWQgaW4gb3B0aW9ucykge1xuXHRcdGNvbnN0IG8gPSBvcHRpb25zW29wdGlvbklkXTtcblx0XHRpZiAoby50eXBlID09PSAnc3ViY29tbWFuZCcpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0XHRpZiAoby5hbGlhcykge1xuXHRcdFx0ZGVsZXRlIHJlbWFpbmluZ0FyZ3Nbby5hbGlhc107XG5cdFx0fVxuXG5cdFx0bGV0IHZhbCA9IHJlbWFpbmluZ0FyZ3Nbb3B0aW9uSWRdO1xuXHRcdGlmIChvLmRlcHJlY2F0ZXMpIHtcblx0XHRcdGZvciAoY29uc3QgZGVwcmVjYXRlZElkIG9mIG8uZGVwcmVjYXRlcykge1xuXHRcdFx0XHRpZiAocmVtYWluaW5nQXJncy5oYXNPd25Qcm9wZXJ0eShkZXByZWNhdGVkSWQpKSB7XG5cdFx0XHRcdFx0aWYgKCF2YWwpIHtcblx0XHRcdFx0XHRcdHZhbCA9IHJlbWFpbmluZ0FyZ3NbZGVwcmVjYXRlZElkXTtcblx0XHRcdFx0XHRcdGlmICh2YWwpIHtcblx0XHRcdFx0XHRcdFx0ZXJyb3JSZXBvcnRlci5vbkRlcHJlY2F0ZWRPcHRpb24oZGVwcmVjYXRlZElkLCBvLmRlcHJlY2F0aW9uTWVzc2FnZSB8fCBsb2NhbGl6ZSgnZGVwcmVjYXRlZC51c2VJbnN0ZWFkJywgJ1VzZSB7MH0gaW5zdGVhZC4nLCBvcHRpb25JZCkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkZWxldGUgcmVtYWluaW5nQXJnc1tkZXByZWNhdGVkSWRdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB2YWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRpZiAoby50eXBlID09PSAnc3RyaW5nW10nKSB7XG5cdFx0XHRcdGlmICghQXJyYXkuaXNBcnJheSh2YWwpKSB7XG5cdFx0XHRcdFx0dmFsID0gW3ZhbF07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFvLmFsbG93RW1wdHlWYWx1ZSkge1xuXHRcdFx0XHRcdGNvbnN0IHNhbml0aXplZCA9IHZhbC5maWx0ZXIoKHY6IHN0cmluZykgPT4gdi5sZW5ndGggPiAwKTtcblx0XHRcdFx0XHRpZiAoc2FuaXRpemVkLmxlbmd0aCAhPT0gdmFsLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZXJyb3JSZXBvcnRlci5vbkVtcHR5VmFsdWUob3B0aW9uSWQpO1xuXHRcdFx0XHRcdFx0dmFsID0gc2FuaXRpemVkLmxlbmd0aCA+IDAgPyBzYW5pdGl6ZWQgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKG8udHlwZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsKSkge1xuXHRcdFx0XHRcdHZhbCA9IHZhbC5wb3AoKTsgLy8gdGFrZSB0aGUgbGFzdFxuXHRcdFx0XHRcdGVycm9yUmVwb3J0ZXIub25NdWx0aXBsZVZhbHVlcyhvcHRpb25JZCwgdmFsKTtcblx0XHRcdFx0fSBlbHNlIGlmICghdmFsICYmICFvLmFsbG93RW1wdHlWYWx1ZSkge1xuXHRcdFx0XHRcdGVycm9yUmVwb3J0ZXIub25FbXB0eVZhbHVlKG9wdGlvbklkKTtcblx0XHRcdFx0XHR2YWwgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNsZWFuZWRBcmdzW29wdGlvbklkXSA9IHZhbDtcblxuXHRcdFx0aWYgKG8uZGVwcmVjYXRpb25NZXNzYWdlKSB7XG5cdFx0XHRcdGVycm9yUmVwb3J0ZXIub25EZXByZWNhdGVkT3B0aW9uKG9wdGlvbklkLCBvLmRlcHJlY2F0aW9uTWVzc2FnZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGRlbGV0ZSByZW1haW5pbmdBcmdzW29wdGlvbklkXTtcblx0fVxuXG5cdGZvciAoY29uc3Qga2V5IGluIHJlbWFpbmluZ0FyZ3MpIHtcblx0XHRlcnJvclJlcG9ydGVyLm9uVW5rbm93bk9wdGlvbihrZXkpO1xuXHR9XG5cblx0cmV0dXJuIGNsZWFuZWRBcmdzO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRVc2FnZShvcHRpb25JZDogc3RyaW5nLCBvcHRpb246IE9wdGlvbjxhbnk+KSB7XG5cdGxldCBhcmdzID0gJyc7XG5cdGlmIChvcHRpb24uYXJncykge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KG9wdGlvbi5hcmdzKSkge1xuXHRcdFx0YXJncyA9IGAgPCR7b3B0aW9uLmFyZ3Muam9pbignPiA8Jyl9PmA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFyZ3MgPSBgIDwke29wdGlvbi5hcmdzfT5gO1xuXHRcdH1cblx0fVxuXHRpZiAob3B0aW9uLmFsaWFzKSB7XG5cdFx0cmV0dXJuIGAtJHtvcHRpb24uYWxpYXN9IC0tJHtvcHRpb25JZH0ke2FyZ3N9YDtcblx0fVxuXHRyZXR1cm4gYC0tJHtvcHRpb25JZH0ke2FyZ3N9YDtcbn1cblxuLy8gZXhwb3J0ZWQgb25seSBmb3IgdGVzdGluZ1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdE9wdGlvbnMob3B0aW9uczogT3B0aW9uRGVzY3JpcHRpb25zPGFueT4sIGNvbHVtbnM6IG51bWJlcik6IHN0cmluZ1tdIHtcblx0Y29uc3QgdXNhZ2VUZXh0czogW3N0cmluZywgc3RyaW5nXVtdID0gW107XG5cdGZvciAoY29uc3Qgb3B0aW9uSWQgaW4gb3B0aW9ucykge1xuXHRcdGNvbnN0IG8gPSBvcHRpb25zW29wdGlvbklkXTtcblx0XHRjb25zdCB1c2FnZVRleHQgPSBmb3JtYXRVc2FnZShvcHRpb25JZCwgbyk7XG5cdFx0dXNhZ2VUZXh0cy5wdXNoKFt1c2FnZVRleHQsIG8uZGVzY3JpcHRpb24hXSk7XG5cdH1cblx0cmV0dXJuIGZvcm1hdFVzYWdlVGV4dHModXNhZ2VUZXh0cywgY29sdW1ucyk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFVzYWdlVGV4dHModXNhZ2VUZXh0czogW3N0cmluZywgc3RyaW5nXVtdLCBjb2x1bW5zOiBudW1iZXIpIHtcblx0Y29uc3QgbWF4TGVuZ3RoID0gdXNhZ2VUZXh0cy5yZWR1Y2UoKHByZXZpb3VzLCBlKSA9PiBNYXRoLm1heChwcmV2aW91cywgZVswXS5sZW5ndGgpLCAxMik7XG5cdGNvbnN0IGFyZ0xlbmd0aCA9IG1heExlbmd0aCArIDIvKmxlZnQgcGFkZGluZyovICsgMS8qcmlnaHQgcGFkZGluZyovO1xuXHRpZiAoY29sdW1ucyAtIGFyZ0xlbmd0aCA8IDI1KSB7XG5cdFx0Ly8gVXNlIGEgY29uZGVuc2VkIHZlcnNpb24gb24gbmFycm93IHRlcm1pbmFsc1xuXHRcdHJldHVybiB1c2FnZVRleHRzLnJlZHVjZTxzdHJpbmdbXT4oKHIsIHV0KSA9PiByLmNvbmNhdChbYCAgJHt1dFswXX1gLCBgICAgICAgJHt1dFsxXX1gXSksIFtdKTtcblx0fVxuXHRjb25zdCBkZXNjcmlwdGlvbkNvbHVtbnMgPSBjb2x1bW5zIC0gYXJnTGVuZ3RoIC0gMTtcblx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IHV0IG9mIHVzYWdlVGV4dHMpIHtcblx0XHRjb25zdCB1c2FnZSA9IHV0WzBdO1xuXHRcdGNvbnN0IHdyYXBwZWREZXNjcmlwdGlvbiA9IHdyYXBUZXh0KHV0WzFdLCBkZXNjcmlwdGlvbkNvbHVtbnMpO1xuXHRcdGNvbnN0IGtleVBhZGRpbmcgPSBpbmRlbnQoYXJnTGVuZ3RoIC0gdXNhZ2UubGVuZ3RoIC0gMi8qbGVmdCBwYWRkaW5nKi8pO1xuXHRcdHJlc3VsdC5wdXNoKCcgICcgKyB1c2FnZSArIGtleVBhZGRpbmcgKyB3cmFwcGVkRGVzY3JpcHRpb25bMF0pO1xuXHRcdGZvciAobGV0IGkgPSAxOyBpIDwgd3JhcHBlZERlc2NyaXB0aW9uLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRyZXN1bHQucHVzaChpbmRlbnQoYXJnTGVuZ3RoKSArIHdyYXBwZWREZXNjcmlwdGlvbltpXSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGluZGVudChjb3VudDogbnVtYmVyKTogc3RyaW5nIHtcblx0cmV0dXJuICcgJy5yZXBlYXQoY291bnQpO1xufVxuXG5mdW5jdGlvbiB3cmFwVGV4dCh0ZXh0OiBzdHJpbmcsIGNvbHVtbnM6IG51bWJlcik6IHN0cmluZ1tdIHtcblx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdHdoaWxlICh0ZXh0Lmxlbmd0aCkge1xuXHRcdGxldCBpbmRleCA9IHRleHQubGVuZ3RoIDwgY29sdW1ucyA/IHRleHQubGVuZ3RoIDogdGV4dC5sYXN0SW5kZXhPZignICcsIGNvbHVtbnMpO1xuXHRcdGlmIChpbmRleCA9PT0gMCkge1xuXHRcdFx0aW5kZXggPSBjb2x1bW5zO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lID0gdGV4dC5zbGljZSgwLCBpbmRleCkudHJpbSgpO1xuXHRcdHRleHQgPSB0ZXh0LnNsaWNlKGluZGV4KS50cmltU3RhcnQoKTtcblx0XHRsaW5lcy5wdXNoKGxpbmUpO1xuXHR9XG5cdHJldHVybiBsaW5lcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkSGVscE1lc3NhZ2UocHJvZHVjdE5hbWU6IHN0cmluZywgZXhlY3V0YWJsZU5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nLCBvcHRpb25zOiBPcHRpb25EZXNjcmlwdGlvbnM8YW55PiwgY2FwYWJpbGl0aWVzPzogeyBub1BpcGU/OiBib29sZWFuOyBub0lucHV0RmlsZXM6IGJvb2xlYW4gfSk6IHN0cmluZyB7XG5cdGNvbnN0IGNvbHVtbnMgPSAocHJvY2Vzcy5zdGRvdXQpLmlzVFRZICYmIChwcm9jZXNzLnN0ZG91dCkuY29sdW1ucyB8fCA4MDtcblx0Y29uc3QgaW5wdXRGaWxlcyA9IGNhcGFiaWxpdGllcz8ubm9JbnB1dEZpbGVzICE9PSB0cnVlID8gYFske2xvY2FsaXplKCdwYXRocycsICdwYXRocycpfS4uLl1gIDogJyc7XG5cblx0Y29uc3QgaGVscCA9IFtgJHtwcm9kdWN0TmFtZX0gJHt2ZXJzaW9ufWBdO1xuXHRoZWxwLnB1c2goJycpO1xuXHRoZWxwLnB1c2goYCR7bG9jYWxpemUoJ3VzYWdlJywgXCJVc2FnZVwiKX06ICR7ZXhlY3V0YWJsZU5hbWV9IFske2xvY2FsaXplKCdvcHRpb25zJywgXCJvcHRpb25zXCIpfV0ke2lucHV0RmlsZXN9YCk7XG5cdGhlbHAucHVzaCgnJyk7XG5cdGlmIChjYXBhYmlsaXRpZXM/Lm5vUGlwZSAhPT0gdHJ1ZSkge1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGhlbHAucHVzaChsb2NhbGl6ZSgnc3RkaW5XaW5kb3dzJywgXCJUbyByZWFkIG91dHB1dCBmcm9tIGFub3RoZXIgcHJvZ3JhbSwgYXBwZW5kICctJyAoZS5nLiAnZWNobyBIZWxsbyBXb3JsZCB8IHswfSAtJylcIiwgZXhlY3V0YWJsZU5hbWUpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGVscC5wdXNoKGxvY2FsaXplKCdzdGRpblVuaXgnLCBcIlRvIHJlYWQgZnJvbSBzdGRpbiwgYXBwZW5kICctJyAoZS5nLiAncHMgYXV4IHwgZ3JlcCBjb2RlIHwgezB9IC0nKVwiLCBleGVjdXRhYmxlTmFtZSkpO1xuXHRcdH1cblx0XHRoZWxwLnB1c2goJycpO1xuXHR9XG5cdGNvbnN0IG9wdGlvbnNCeUNhdGVnb3J5OiB7IFtQIGluIGtleW9mIHR5cGVvZiBoZWxwQ2F0ZWdvcmllc10/OiBPcHRpb25EZXNjcmlwdGlvbnM8YW55PiB9ID0ge307XG5cdGNvbnN0IHN1YmNvbW1hbmRzOiB7IGNvbW1hbmQ6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZyB9W10gPSBbXTtcblx0Zm9yIChjb25zdCBvcHRpb25JZCBpbiBvcHRpb25zKSB7XG5cdFx0Y29uc3QgbyA9IG9wdGlvbnNbb3B0aW9uSWRdO1xuXHRcdGlmIChvLnR5cGUgPT09ICdzdWJjb21tYW5kJykge1xuXHRcdFx0aWYgKG8uZGVzY3JpcHRpb24pIHtcblx0XHRcdFx0c3ViY29tbWFuZHMucHVzaCh7IGNvbW1hbmQ6IG9wdGlvbklkLCBkZXNjcmlwdGlvbjogby5kZXNjcmlwdGlvbiB9KTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKG8uZGVzY3JpcHRpb24gJiYgby5jYXQpIHtcblx0XHRcdGxldCBvcHRpb25zQnlDYXQgPSBvcHRpb25zQnlDYXRlZ29yeVtvLmNhdF07XG5cdFx0XHRpZiAoIW9wdGlvbnNCeUNhdCkge1xuXHRcdFx0XHRvcHRpb25zQnlDYXRlZ29yeVtvLmNhdF0gPSBvcHRpb25zQnlDYXQgPSB7fTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnNCeUNhdFtvcHRpb25JZF0gPSBvO1xuXHRcdH1cblx0fVxuXG5cdGZvciAoY29uc3QgaGVscENhdGVnb3J5S2V5IGluIG9wdGlvbnNCeUNhdGVnb3J5KSB7XG5cdFx0Y29uc3Qga2V5ID0gPGtleW9mIHR5cGVvZiBoZWxwQ2F0ZWdvcmllcz5oZWxwQ2F0ZWdvcnlLZXk7XG5cblx0XHRjb25zdCBjYXRlZ29yeU9wdGlvbnMgPSBvcHRpb25zQnlDYXRlZ29yeVtrZXldO1xuXHRcdGlmIChjYXRlZ29yeU9wdGlvbnMpIHtcblx0XHRcdGhlbHAucHVzaChoZWxwQ2F0ZWdvcmllc1trZXldKTtcblx0XHRcdGhlbHAucHVzaCguLi5mb3JtYXRPcHRpb25zKGNhdGVnb3J5T3B0aW9ucywgY29sdW1ucykpO1xuXHRcdFx0aGVscC5wdXNoKCcnKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoc3ViY29tbWFuZHMubGVuZ3RoKSB7XG5cdFx0aGVscC5wdXNoKGxvY2FsaXplKCdzdWJjb21tYW5kcycsIFwiU3ViY29tbWFuZHNcIikpO1xuXHRcdGhlbHAucHVzaCguLi5mb3JtYXRVc2FnZVRleHRzKHN1YmNvbW1hbmRzLm1hcChzID0+IFtzLmNvbW1hbmQsIHMuZGVzY3JpcHRpb25dKSwgY29sdW1ucykpO1xuXHRcdGhlbHAucHVzaCgnJyk7XG5cdH1cblxuXHRyZXR1cm4gaGVscC5qb2luKCdcXG4nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkVmVyc2lvbk1lc3NhZ2UodmVyc2lvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBjb21taXQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG5cdHJldHVybiBgJHt2ZXJzaW9uIHx8IGxvY2FsaXplKCd1bmtub3duVmVyc2lvbicsIFwiVW5rbm93biB2ZXJzaW9uXCIpfVxcbiR7Y29tbWl0IHx8IGxvY2FsaXplKCd1bmtub3duQ29tbWl0JywgXCJVbmtub3duIGNvbW1pdFwiKX1cXG4ke3Byb2Nlc3MuYXJjaH1gO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0JBQWdCO0FBTXpCLE1BQU0saUJBQWlCO0FBQUEsRUFDdEIsR0FBRyxTQUFTLG9CQUFvQixTQUFT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
