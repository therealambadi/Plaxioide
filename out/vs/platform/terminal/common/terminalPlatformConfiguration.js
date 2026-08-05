import { getAllCodicons } from "../../../base/common/codicons.js";
import { OperatingSystem, Platform, PlatformToString } from "../../../base/common/platform.js";
import { localize } from "../../../nls.js";
import { ConfigurationScope, Extensions } from "../../configuration/common/configurationRegistry.js";
import { Registry } from "../../registry/common/platform.js";
import { TerminalSettingId } from "./terminal.js";
import { createProfileSchemaEnums } from "./terminalProfiles.js";
const terminalColorSchema = {
  type: ["string", "null"],
  enum: [
    "terminal.ansiBlack",
    "terminal.ansiRed",
    "terminal.ansiGreen",
    "terminal.ansiYellow",
    "terminal.ansiBlue",
    "terminal.ansiMagenta",
    "terminal.ansiCyan",
    "terminal.ansiWhite"
  ],
  default: null
};
const terminalIconSchema = {
  type: "string",
  enum: Array.from(getAllCodicons(), (icon) => icon.id),
  markdownEnumDescriptions: Array.from(getAllCodicons(), (icon) => `$(${icon.id})`)
};
const terminalProfileBaseProperties = {
  args: {
    description: localize("terminalProfile.args", "An optional set of arguments to run the shell executable with."),
    type: "array",
    items: {
      type: "string"
    }
  },
  overrideName: {
    description: localize("terminalProfile.overrideName", "Whether or not to replace the dynamic terminal title that detects what program is running with the static profile name."),
    type: "boolean"
  },
  icon: {
    description: localize("terminalProfile.icon", "A codicon ID to associate with the terminal icon."),
    ...terminalIconSchema
  },
  color: {
    description: localize("terminalProfile.color", "A theme color ID to associate with the terminal icon."),
    ...terminalColorSchema
  },
  env: {
    markdownDescription: localize("terminalProfile.env", "An object with environment variables that will be added to the terminal profile process. Set to `null` to delete environment variables from the base environment."),
    type: "object",
    additionalProperties: {
      type: ["string", "null"]
    },
    default: {}
  }
};
const terminalProfileSchema = {
  type: "object",
  required: ["path"],
  properties: {
    path: {
      description: localize("terminalProfile.path", "A single path to a shell executable or an array of paths that will be used as fallbacks when one fails."),
      type: ["string", "array"],
      items: {
        type: "string"
      }
    },
    ...terminalProfileBaseProperties
  }
};
const terminalAutomationProfileSchema = {
  type: "object",
  required: ["path"],
  properties: {
    path: {
      description: localize("terminalAutomationProfile.path", "A single path to a shell executable."),
      type: ["string"],
      items: {
        type: "string"
      }
    },
    ...terminalProfileBaseProperties
  }
};
function createTerminalProfileMarkdownDescription(platform) {
  const key = platform === Platform.Linux ? "linux" : platform === Platform.Mac ? "osx" : "windows";
  return localize(
    {
      key: "terminal.integrated.profile",
      comment: ["{0} is the platform, {1} is a code block, {2} and {3} are a link start and end"]
    },
    "A set of terminal profile customizations for {0} which allows adding, removing or changing how terminals are launched. Profiles are made up of a mandatory path, optional arguments and other presentation options.\n\nTo override an existing profile use its profile name as the key, for example:\n\n{1}\n\n{2}Read more about configuring profiles{3}.",
    PlatformToString(platform),
    '```json\n"terminal.integrated.profile.' + key + '": {\n  "bash": null\n}\n```',
    "[",
    "](https://code.visualstudio.com/docs/terminal/profiles)"
  );
}
const terminalPlatformConfiguration = {
  id: "terminal",
  order: 100,
  title: localize("terminalIntegratedConfigurationTitle", "Integrated Terminal"),
  type: "object",
  properties: {
    [TerminalSettingId.AutomationProfileLinux]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.automationProfile.linux", "The terminal profile to use on Linux for automation-related terminal usage like tasks and debug."),
      type: ["object", "null"],
      default: null,
      "anyOf": [
        { type: "null" },
        terminalAutomationProfileSchema
      ],
      defaultSnippets: [
        {
          body: {
            path: "${1}",
            icon: "${2}"
          }
        }
      ]
    },
    [TerminalSettingId.AutomationProfileMacOs]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.automationProfile.osx", "The terminal profile to use on macOS for automation-related terminal usage like tasks and debug."),
      type: ["object", "null"],
      default: null,
      "anyOf": [
        { type: "null" },
        terminalAutomationProfileSchema
      ],
      defaultSnippets: [
        {
          body: {
            path: "${1}",
            icon: "${2}"
          }
        }
      ]
    },
    [TerminalSettingId.AutomationProfileWindows]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.automationProfile.windows", "The terminal profile to use for automation-related terminal usage like tasks and debug. This setting will currently be ignored if {0} (now deprecated) is set.", "`terminal.integrated.automationShell.windows`"),
      type: ["object", "null"],
      default: null,
      "anyOf": [
        { type: "null" },
        terminalAutomationProfileSchema
      ],
      defaultSnippets: [
        {
          body: {
            path: "${1}",
            icon: "${2}"
          }
        }
      ]
    },
    [TerminalSettingId.ProfilesWindows]: {
      restricted: true,
      markdownDescription: createTerminalProfileMarkdownDescription(Platform.Windows),
      type: "object",
      default: {
        "PowerShell": {
          source: "PowerShell",
          icon: "terminal-powershell"
        },
        "Command Prompt": {
          path: [
            "${env:windir}\\Sysnative\\cmd.exe",
            "${env:windir}\\System32\\cmd.exe"
          ],
          args: [],
          icon: "terminal-cmd"
        },
        "Git Bash": {
          source: "Git Bash"
        }
      },
      additionalProperties: {
        "anyOf": [
          {
            type: "object",
            required: ["source"],
            properties: {
              source: {
                description: localize("terminalProfile.windowsSource", "A profile source that will auto detect the paths to the shell. Note that non-standard executable locations are not supported and must be created manually in a new profile."),
                enum: ["PowerShell", "Git Bash"]
              },
              ...terminalProfileBaseProperties
            }
          },
          {
            type: "object",
            required: ["extensionIdentifier", "id", "title"],
            properties: {
              extensionIdentifier: {
                description: localize("terminalProfile.windowsExtensionIdentifier", "The extension that contributed this profile."),
                type: "string"
              },
              id: {
                description: localize("terminalProfile.windowsExtensionId", "The id of the extension terminal"),
                type: "string"
              },
              title: {
                description: localize("terminalProfile.windowsExtensionTitle", "The name of the extension terminal"),
                type: "string"
              },
              ...terminalProfileBaseProperties
            }
          },
          { type: "null" },
          terminalProfileSchema
        ]
      }
    },
    [TerminalSettingId.ProfilesMacOs]: {
      restricted: true,
      markdownDescription: createTerminalProfileMarkdownDescription(Platform.Mac),
      type: "object",
      default: {
        "bash": {
          path: "bash",
          args: ["-l"],
          icon: "terminal-bash"
        },
        "zsh": {
          path: "zsh",
          args: ["-l"]
        },
        "fish": {
          path: "fish",
          args: ["-l"]
        },
        "tmux": {
          path: "tmux",
          icon: "terminal-tmux"
        },
        "pwsh": {
          path: "pwsh",
          icon: "terminal-powershell"
        }
      },
      additionalProperties: {
        "anyOf": [
          {
            type: "object",
            required: ["extensionIdentifier", "id", "title"],
            properties: {
              extensionIdentifier: {
                description: localize("terminalProfile.osxExtensionIdentifier", "The extension that contributed this profile."),
                type: "string"
              },
              id: {
                description: localize("terminalProfile.osxExtensionId", "The id of the extension terminal"),
                type: "string"
              },
              title: {
                description: localize("terminalProfile.osxExtensionTitle", "The name of the extension terminal"),
                type: "string"
              },
              ...terminalProfileBaseProperties
            }
          },
          { type: "null" },
          terminalProfileSchema
        ]
      }
    },
    [TerminalSettingId.ProfilesLinux]: {
      restricted: true,
      markdownDescription: createTerminalProfileMarkdownDescription(Platform.Linux),
      type: "object",
      default: {
        "bash": {
          path: "bash",
          icon: "terminal-bash"
        },
        "zsh": {
          path: "zsh"
        },
        "fish": {
          path: "fish"
        },
        "tmux": {
          path: "tmux",
          icon: "terminal-tmux"
        },
        "pwsh": {
          path: "pwsh",
          icon: "terminal-powershell"
        }
      },
      additionalProperties: {
        "anyOf": [
          {
            type: "object",
            required: ["extensionIdentifier", "id", "title"],
            properties: {
              extensionIdentifier: {
                description: localize("terminalProfile.linuxExtensionIdentifier", "The extension that contributed this profile."),
                type: "string"
              },
              id: {
                description: localize("terminalProfile.linuxExtensionId", "The id of the extension terminal"),
                type: "string"
              },
              title: {
                description: localize("terminalProfile.linuxExtensionTitle", "The name of the extension terminal"),
                type: "string"
              },
              ...terminalProfileBaseProperties
            }
          },
          { type: "null" },
          terminalProfileSchema
        ]
      }
    },
    [TerminalSettingId.UseWslProfiles]: {
      description: localize("terminal.integrated.useWslProfiles", "Controls whether or not WSL distros are shown in the terminal dropdown"),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.InheritEnv]: {
      scope: ConfigurationScope.APPLICATION,
      description: localize("terminal.integrated.inheritEnv", "Whether new shells should inherit their environment from VS Code, which may source a login shell to ensure $PATH and other development variables are initialized. This has no effect on Windows."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.PersistentSessionScrollback]: {
      scope: ConfigurationScope.APPLICATION,
      markdownDescription: localize("terminal.integrated.persistentSessionScrollback", "Controls the maximum amount of lines that will be restored when reconnecting to a persistent terminal session. Increasing this will restore more lines of scrollback at the cost of more memory and increase the time it takes to connect to terminals on start up. This setting requires a restart to take effect and should be set to a value less than or equal to `#terminal.integrated.scrollback#`."),
      type: "number",
      default: 100
    },
    [TerminalSettingId.ShowLinkHover]: {
      scope: ConfigurationScope.APPLICATION,
      description: localize("terminal.integrated.showLinkHover", "Whether to show hovers for links in the terminal output."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.IgnoreProcessNames]: {
      markdownDescription: localize("terminal.integrated.confirmIgnoreProcesses", "A set of process names to ignore when using the {0} setting.", "`#terminal.integrated.confirmOnKill#`"),
      type: "array",
      items: {
        type: "string",
        uniqueItems: true
      },
      default: [
        // Popular prompt programs, these should not count as child processes
        "starship",
        "oh-my-posh",
        // Git bash may runs a subprocess of itself (bin\bash.exe -> usr\bin\bash.exe)
        "bash",
        "zsh"
      ]
    }
  }
};
function registerTerminalPlatformConfiguration() {
  Registry.as(Extensions.Configuration).registerConfiguration(terminalPlatformConfiguration);
  registerTerminalDefaultProfileConfiguration();
}
let defaultProfilesConfiguration;
function registerTerminalDefaultProfileConfiguration(detectedProfiles, extensionContributedProfiles) {
  const registry = Registry.as(Extensions.Configuration);
  let profileEnum;
  if (detectedProfiles) {
    profileEnum = createProfileSchemaEnums(detectedProfiles?.profiles, extensionContributedProfiles);
  }
  const oldDefaultProfilesConfiguration = defaultProfilesConfiguration;
  defaultProfilesConfiguration = {
    id: "terminal",
    order: 100,
    title: localize("terminalIntegratedConfigurationTitle", "Integrated Terminal"),
    type: "object",
    properties: {
      [TerminalSettingId.DefaultProfileLinux]: {
        restricted: true,
        markdownDescription: localize("terminal.integrated.defaultProfile.linux", "The default terminal profile on Linux."),
        type: ["string", "null"],
        default: null,
        enum: detectedProfiles?.os === OperatingSystem.Linux ? profileEnum?.values : void 0,
        markdownEnumDescriptions: detectedProfiles?.os === OperatingSystem.Linux ? profileEnum?.markdownDescriptions : void 0
      },
      [TerminalSettingId.DefaultProfileMacOs]: {
        restricted: true,
        markdownDescription: localize("terminal.integrated.defaultProfile.osx", "The default terminal profile on macOS."),
        type: ["string", "null"],
        default: null,
        enum: detectedProfiles?.os === OperatingSystem.Macintosh ? profileEnum?.values : void 0,
        markdownEnumDescriptions: detectedProfiles?.os === OperatingSystem.Macintosh ? profileEnum?.markdownDescriptions : void 0
      },
      [TerminalSettingId.DefaultProfileWindows]: {
        restricted: true,
        markdownDescription: localize("terminal.integrated.defaultProfile.windows", "The default terminal profile on Windows."),
        type: ["string", "null"],
        default: null,
        enum: detectedProfiles?.os === OperatingSystem.Windows ? profileEnum?.values : void 0,
        markdownEnumDescriptions: detectedProfiles?.os === OperatingSystem.Windows ? profileEnum?.markdownDescriptions : void 0
      }
    }
  };
  registry.updateConfigurations({ add: [defaultProfilesConfiguration], remove: oldDefaultProfilesConfiguration ? [oldDefaultProfilesConfiguration] : [] });
}
export {
  registerTerminalDefaultProfileConfiguration,
  registerTerminalPlatformConfiguration,
  terminalColorSchema,
  terminalIconSchema
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxQbGF0Zm9ybUNvbmZpZ3VyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBnZXRBbGxDb2RpY29ucyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hLCBJSlNPTlNjaGVtYU1hcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgT3BlcmF0aW5nU3lzdGVtLCBQbGF0Zm9ybSwgUGxhdGZvcm1Ub1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TY29wZSwgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25Ob2RlLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25UZXJtaW5hbFByb2ZpbGUsIElUZXJtaW5hbFByb2ZpbGUsIFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVQcm9maWxlU2NoZW1hRW51bXMgfSBmcm9tICcuL3Rlcm1pbmFsUHJvZmlsZXMuanMnO1xuXG5leHBvcnQgY29uc3QgdGVybWluYWxDb2xvclNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXSxcblx0ZW51bTogW1xuXHRcdCd0ZXJtaW5hbC5hbnNpQmxhY2snLFxuXHRcdCd0ZXJtaW5hbC5hbnNpUmVkJyxcblx0XHQndGVybWluYWwuYW5zaUdyZWVuJyxcblx0XHQndGVybWluYWwuYW5zaVllbGxvdycsXG5cdFx0J3Rlcm1pbmFsLmFuc2lCbHVlJyxcblx0XHQndGVybWluYWwuYW5zaU1hZ2VudGEnLFxuXHRcdCd0ZXJtaW5hbC5hbnNpQ3lhbicsXG5cdFx0J3Rlcm1pbmFsLmFuc2lXaGl0ZSdcblx0XSxcblx0ZGVmYXVsdDogbnVsbFxufTtcblxuZXhwb3J0IGNvbnN0IHRlcm1pbmFsSWNvblNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdzdHJpbmcnLFxuXHRlbnVtOiBBcnJheS5mcm9tKGdldEFsbENvZGljb25zKCksIGljb24gPT4gaWNvbi5pZCksXG5cdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogQXJyYXkuZnJvbShnZXRBbGxDb2RpY29ucygpLCBpY29uID0+IGAkKCR7aWNvbi5pZH0pYCksXG59O1xuXG5jb25zdCB0ZXJtaW5hbFByb2ZpbGVCYXNlUHJvcGVydGllczogSUpTT05TY2hlbWFNYXAgPSB7XG5cdGFyZ3M6IHtcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsUHJvZmlsZS5hcmdzJywgJ0FuIG9wdGlvbmFsIHNldCBvZiBhcmd1bWVudHMgdG8gcnVuIHRoZSBzaGVsbCBleGVjdXRhYmxlIHdpdGguJyksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczoge1xuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9XG5cdH0sXG5cdG92ZXJyaWRlTmFtZToge1xuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWxQcm9maWxlLm92ZXJyaWRlTmFtZScsICdXaGV0aGVyIG9yIG5vdCB0byByZXBsYWNlIHRoZSBkeW5hbWljIHRlcm1pbmFsIHRpdGxlIHRoYXQgZGV0ZWN0cyB3aGF0IHByb2dyYW0gaXMgcnVubmluZyB3aXRoIHRoZSBzdGF0aWMgcHJvZmlsZSBuYW1lLicpLFxuXHRcdHR5cGU6ICdib29sZWFuJ1xuXHR9LFxuXHRpY29uOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUuaWNvbicsICdBIGNvZGljb24gSUQgdG8gYXNzb2NpYXRlIHdpdGggdGhlIHRlcm1pbmFsIGljb24uJyksXG5cdFx0Li4udGVybWluYWxJY29uU2NoZW1hXG5cdH0sXG5cdGNvbG9yOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUuY29sb3InLCAnQSB0aGVtZSBjb2xvciBJRCB0byBhc3NvY2lhdGUgd2l0aCB0aGUgdGVybWluYWwgaWNvbi4nKSxcblx0XHQuLi50ZXJtaW5hbENvbG9yU2NoZW1hXG5cdH0sXG5cdGVudjoge1xuXHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUuZW52JywgXCJBbiBvYmplY3Qgd2l0aCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSB0ZXJtaW5hbCBwcm9maWxlIHByb2Nlc3MuIFNldCB0byBgbnVsbGAgdG8gZGVsZXRlIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIHRoZSBiYXNlIGVudmlyb25tZW50LlwiKSxcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0dHlwZTogWydzdHJpbmcnLCAnbnVsbCddXG5cdFx0fSxcblx0XHRkZWZhdWx0OiB7fVxuXHR9XG59O1xuXG5jb25zdCB0ZXJtaW5hbFByb2ZpbGVTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cmVxdWlyZWQ6IFsncGF0aCddLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0cGF0aDoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUucGF0aCcsICdBIHNpbmdsZSBwYXRoIHRvIGEgc2hlbGwgZXhlY3V0YWJsZSBvciBhbiBhcnJheSBvZiBwYXRocyB0aGF0IHdpbGwgYmUgdXNlZCBhcyBmYWxsYmFja3Mgd2hlbiBvbmUgZmFpbHMuJyksXG5cdFx0XHR0eXBlOiBbJ3N0cmluZycsICdhcnJheSddLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH1cblx0XHR9LFxuXHRcdC4uLnRlcm1pbmFsUHJvZmlsZUJhc2VQcm9wZXJ0aWVzXG5cdH1cbn07XG5cbmNvbnN0IHRlcm1pbmFsQXV0b21hdGlvblByb2ZpbGVTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cmVxdWlyZWQ6IFsncGF0aCddLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0cGF0aDoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbEF1dG9tYXRpb25Qcm9maWxlLnBhdGgnLCAnQSBzaW5nbGUgcGF0aCB0byBhIHNoZWxsIGV4ZWN1dGFibGUuJyksXG5cdFx0XHR0eXBlOiBbJ3N0cmluZyddLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH1cblx0XHR9LFxuXHRcdC4uLnRlcm1pbmFsUHJvZmlsZUJhc2VQcm9wZXJ0aWVzXG5cdH1cbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZVRlcm1pbmFsUHJvZmlsZU1hcmtkb3duRGVzY3JpcHRpb24ocGxhdGZvcm06IFBsYXRmb3JtLkxpbnV4IHwgUGxhdGZvcm0uTWFjIHwgUGxhdGZvcm0uV2luZG93cyk6IHN0cmluZyB7XG5cdGNvbnN0IGtleSA9IHBsYXRmb3JtID09PSBQbGF0Zm9ybS5MaW51eCA/ICdsaW51eCcgOiBwbGF0Zm9ybSA9PT0gUGxhdGZvcm0uTWFjID8gJ29zeCcgOiAnd2luZG93cyc7XG5cdHJldHVybiBsb2NhbGl6ZShcblx0XHR7XG5cdFx0XHRrZXk6ICd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnByb2ZpbGUnLFxuXHRcdFx0Y29tbWVudDogWyd7MH0gaXMgdGhlIHBsYXRmb3JtLCB7MX0gaXMgYSBjb2RlIGJsb2NrLCB7Mn0gYW5kIHszfSBhcmUgYSBsaW5rIHN0YXJ0IGFuZCBlbmQnXVxuXHRcdH0sXG5cdFx0XCJBIHNldCBvZiB0ZXJtaW5hbCBwcm9maWxlIGN1c3RvbWl6YXRpb25zIGZvciB7MH0gd2hpY2ggYWxsb3dzIGFkZGluZywgcmVtb3Zpbmcgb3IgY2hhbmdpbmcgaG93IHRlcm1pbmFscyBhcmUgbGF1bmNoZWQuIFByb2ZpbGVzIGFyZSBtYWRlIHVwIG9mIGEgbWFuZGF0b3J5IHBhdGgsIG9wdGlvbmFsIGFyZ3VtZW50cyBhbmQgb3RoZXIgcHJlc2VudGF0aW9uIG9wdGlvbnMuXFxuXFxuVG8gb3ZlcnJpZGUgYW4gZXhpc3RpbmcgcHJvZmlsZSB1c2UgaXRzIHByb2ZpbGUgbmFtZSBhcyB0aGUga2V5LCBmb3IgZXhhbXBsZTpcXG5cXG57MX1cXG5cXG57Mn1SZWFkIG1vcmUgYWJvdXQgY29uZmlndXJpbmcgcHJvZmlsZXN7M30uXCIsXG5cdFx0UGxhdGZvcm1Ub1N0cmluZyhwbGF0Zm9ybSksXG5cdFx0J2BgYGpzb25cXG5cInRlcm1pbmFsLmludGVncmF0ZWQucHJvZmlsZS4nICsga2V5ICsgJ1wiOiB7XFxuICBcImJhc2hcIjogbnVsbFxcbn1cXG5gYGAnLFxuXHRcdCdbJyxcblx0XHQnXShodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9kb2NzL3Rlcm1pbmFsL3Byb2ZpbGVzKSdcblx0KTtcbn1cblxuY29uc3QgdGVybWluYWxQbGF0Zm9ybUNvbmZpZ3VyYXRpb246IElDb25maWd1cmF0aW9uTm9kZSA9IHtcblx0aWQ6ICd0ZXJtaW5hbCcsXG5cdG9yZGVyOiAxMDAsXG5cdHRpdGxlOiBsb2NhbGl6ZSgndGVybWluYWxJbnRlZ3JhdGVkQ29uZmlndXJhdGlvblRpdGxlJywgXCJJbnRlZ3JhdGVkIFRlcm1pbmFsXCIpLFxuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cHJvcGVydGllczoge1xuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5BdXRvbWF0aW9uUHJvZmlsZUxpbnV4XToge1xuXHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmF1dG9tYXRpb25Qcm9maWxlLmxpbnV4JywgXCJUaGUgdGVybWluYWwgcHJvZmlsZSB0byB1c2Ugb24gTGludXggZm9yIGF1dG9tYXRpb24tcmVsYXRlZCB0ZXJtaW5hbCB1c2FnZSBsaWtlIHRhc2tzIGFuZCBkZWJ1Zy5cIiksXG5cdFx0XHR0eXBlOiBbJ29iamVjdCcsICdudWxsJ10sXG5cdFx0XHRkZWZhdWx0OiBudWxsLFxuXHRcdFx0J2FueU9mJzogW1xuXHRcdFx0XHR7IHR5cGU6ICdudWxsJyB9LFxuXHRcdFx0XHR0ZXJtaW5hbEF1dG9tYXRpb25Qcm9maWxlU2NoZW1hXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRib2R5OiB7XG5cdFx0XHRcdFx0XHRwYXRoOiAnJHsxfScsXG5cdFx0XHRcdFx0XHRpY29uOiAnJHsyfSdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5BdXRvbWF0aW9uUHJvZmlsZU1hY09zXToge1xuXHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmF1dG9tYXRpb25Qcm9maWxlLm9zeCcsIFwiVGhlIHRlcm1pbmFsIHByb2ZpbGUgdG8gdXNlIG9uIG1hY09TIGZvciBhdXRvbWF0aW9uLXJlbGF0ZWQgdGVybWluYWwgdXNhZ2UgbGlrZSB0YXNrcyBhbmQgZGVidWcuXCIpLFxuXHRcdFx0dHlwZTogWydvYmplY3QnLCAnbnVsbCddLFxuXHRcdFx0ZGVmYXVsdDogbnVsbCxcblx0XHRcdCdhbnlPZic6IFtcblx0XHRcdFx0eyB0eXBlOiAnbnVsbCcgfSxcblx0XHRcdFx0dGVybWluYWxBdXRvbWF0aW9uUHJvZmlsZVNjaGVtYVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHRTbmlwcGV0czogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Ym9keToge1xuXHRcdFx0XHRcdFx0cGF0aDogJyR7MX0nLFxuXHRcdFx0XHRcdFx0aWNvbjogJyR7Mn0nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuQXV0b21hdGlvblByb2ZpbGVXaW5kb3dzXToge1xuXHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmF1dG9tYXRpb25Qcm9maWxlLndpbmRvd3MnLCBcIlRoZSB0ZXJtaW5hbCBwcm9maWxlIHRvIHVzZSBmb3IgYXV0b21hdGlvbi1yZWxhdGVkIHRlcm1pbmFsIHVzYWdlIGxpa2UgdGFza3MgYW5kIGRlYnVnLiBUaGlzIHNldHRpbmcgd2lsbCBjdXJyZW50bHkgYmUgaWdub3JlZCBpZiB7MH0gKG5vdyBkZXByZWNhdGVkKSBpcyBzZXQuXCIsICdgdGVybWluYWwuaW50ZWdyYXRlZC5hdXRvbWF0aW9uU2hlbGwud2luZG93c2AnKSxcblx0XHRcdHR5cGU6IFsnb2JqZWN0JywgJ251bGwnXSxcblx0XHRcdGRlZmF1bHQ6IG51bGwsXG5cdFx0XHQnYW55T2YnOiBbXG5cdFx0XHRcdHsgdHlwZTogJ251bGwnIH0sXG5cdFx0XHRcdHRlcm1pbmFsQXV0b21hdGlvblByb2ZpbGVTY2hlbWFcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0U25pcHBldHM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGJvZHk6IHtcblx0XHRcdFx0XHRcdHBhdGg6ICckezF9Jyxcblx0XHRcdFx0XHRcdGljb246ICckezJ9J1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlByb2ZpbGVzV2luZG93c106IHtcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBjcmVhdGVUZXJtaW5hbFByb2ZpbGVNYXJrZG93bkRlc2NyaXB0aW9uKFBsYXRmb3JtLldpbmRvd3MpLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdCdQb3dlclNoZWxsJzoge1xuXHRcdFx0XHRcdHNvdXJjZTogJ1Bvd2VyU2hlbGwnLFxuXHRcdFx0XHRcdGljb246ICd0ZXJtaW5hbC1wb3dlcnNoZWxsJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQnQ29tbWFuZCBQcm9tcHQnOiB7XG5cdFx0XHRcdFx0cGF0aDogW1xuXHRcdFx0XHRcdFx0JyR7ZW52OndpbmRpcn1cXFxcU3lzbmF0aXZlXFxcXGNtZC5leGUnLFxuXHRcdFx0XHRcdFx0JyR7ZW52OndpbmRpcn1cXFxcU3lzdGVtMzJcXFxcY21kLmV4ZSdcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGFyZ3M6IFtdLFxuXHRcdFx0XHRcdGljb246ICd0ZXJtaW5hbC1jbWQnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdHaXQgQmFzaCc6IHtcblx0XHRcdFx0XHRzb3VyY2U6ICdHaXQgQmFzaCdcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCdhbnlPZic6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ3NvdXJjZSddLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRzb3VyY2U6IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsUHJvZmlsZS53aW5kb3dzU291cmNlJywgJ0EgcHJvZmlsZSBzb3VyY2UgdGhhdCB3aWxsIGF1dG8gZGV0ZWN0IHRoZSBwYXRocyB0byB0aGUgc2hlbGwuIE5vdGUgdGhhdCBub24tc3RhbmRhcmQgZXhlY3V0YWJsZSBsb2NhdGlvbnMgYXJlIG5vdCBzdXBwb3J0ZWQgYW5kIG11c3QgYmUgY3JlYXRlZCBtYW51YWxseSBpbiBhIG5ldyBwcm9maWxlLicpLFxuXHRcdFx0XHRcdFx0XHRcdGVudW06IFsnUG93ZXJTaGVsbCcsICdHaXQgQmFzaCddXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdC4uLnRlcm1pbmFsUHJvZmlsZUJhc2VQcm9wZXJ0aWVzXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2V4dGVuc2lvbklkZW50aWZpZXInLCAnaWQnLCAndGl0bGUnXSxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uSWRlbnRpZmllcjoge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWxQcm9maWxlLndpbmRvd3NFeHRlbnNpb25JZGVudGlmaWVyJywgJ1RoZSBleHRlbnNpb24gdGhhdCBjb250cmlidXRlZCB0aGlzIHByb2ZpbGUuJyksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsUHJvZmlsZS53aW5kb3dzRXh0ZW5zaW9uSWQnLCAnVGhlIGlkIG9mIHRoZSBleHRlbnNpb24gdGVybWluYWwnKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR0aXRsZToge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWxQcm9maWxlLndpbmRvd3NFeHRlbnNpb25UaXRsZScsICdUaGUgbmFtZSBvZiB0aGUgZXh0ZW5zaW9uIHRlcm1pbmFsJyksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Li4udGVybWluYWxQcm9maWxlQmFzZVByb3BlcnRpZXNcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHsgdHlwZTogJ251bGwnIH0sXG5cdFx0XHRcdFx0dGVybWluYWxQcm9maWxlU2NoZW1hXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5Qcm9maWxlc01hY09zXToge1xuXHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGNyZWF0ZVRlcm1pbmFsUHJvZmlsZU1hcmtkb3duRGVzY3JpcHRpb24oUGxhdGZvcm0uTWFjKSxcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHQnYmFzaCc6IHtcblx0XHRcdFx0XHRwYXRoOiAnYmFzaCcsXG5cdFx0XHRcdFx0YXJnczogWyctbCddLFxuXHRcdFx0XHRcdGljb246ICd0ZXJtaW5hbC1iYXNoJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQnenNoJzoge1xuXHRcdFx0XHRcdHBhdGg6ICd6c2gnLFxuXHRcdFx0XHRcdGFyZ3M6IFsnLWwnXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZmlzaCc6IHtcblx0XHRcdFx0XHRwYXRoOiAnZmlzaCcsXG5cdFx0XHRcdFx0YXJnczogWyctbCddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCd0bXV4Jzoge1xuXHRcdFx0XHRcdHBhdGg6ICd0bXV4Jyxcblx0XHRcdFx0XHRpY29uOiAndGVybWluYWwtdG11eCdcblx0XHRcdFx0fSxcblx0XHRcdFx0J3B3c2gnOiB7XG5cdFx0XHRcdFx0cGF0aDogJ3B3c2gnLFxuXHRcdFx0XHRcdGljb246ICd0ZXJtaW5hbC1wb3dlcnNoZWxsJ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0J2FueU9mJzogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsnZXh0ZW5zaW9uSWRlbnRpZmllcicsICdpZCcsICd0aXRsZSddLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRleHRlbnNpb25JZGVudGlmaWVyOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUub3N4RXh0ZW5zaW9uSWRlbnRpZmllcicsICdUaGUgZXh0ZW5zaW9uIHRoYXQgY29udHJpYnV0ZWQgdGhpcyBwcm9maWxlLicpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUub3N4RXh0ZW5zaW9uSWQnLCAnVGhlIGlkIG9mIHRoZSBleHRlbnNpb24gdGVybWluYWwnKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR0aXRsZToge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWxQcm9maWxlLm9zeEV4dGVuc2lvblRpdGxlJywgJ1RoZSBuYW1lIG9mIHRoZSBleHRlbnNpb24gdGVybWluYWwnKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHQuLi50ZXJtaW5hbFByb2ZpbGVCYXNlUHJvcGVydGllc1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0eyB0eXBlOiAnbnVsbCcgfSxcblx0XHRcdFx0XHR0ZXJtaW5hbFByb2ZpbGVTY2hlbWFcblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlByb2ZpbGVzTGludXhdOiB7XG5cdFx0XHRyZXN0cmljdGVkOiB0cnVlLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogY3JlYXRlVGVybWluYWxQcm9maWxlTWFya2Rvd25EZXNjcmlwdGlvbihQbGF0Zm9ybS5MaW51eCksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0J2Jhc2gnOiB7XG5cdFx0XHRcdFx0cGF0aDogJ2Jhc2gnLFxuXHRcdFx0XHRcdGljb246ICd0ZXJtaW5hbC1iYXNoJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQnenNoJzoge1xuXHRcdFx0XHRcdHBhdGg6ICd6c2gnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdmaXNoJzoge1xuXHRcdFx0XHRcdHBhdGg6ICdmaXNoJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQndG11eCc6IHtcblx0XHRcdFx0XHRwYXRoOiAndG11eCcsXG5cdFx0XHRcdFx0aWNvbjogJ3Rlcm1pbmFsLXRtdXgnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdwd3NoJzoge1xuXHRcdFx0XHRcdHBhdGg6ICdwd3NoJyxcblx0XHRcdFx0XHRpY29uOiAndGVybWluYWwtcG93ZXJzaGVsbCdcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCdhbnlPZic6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2V4dGVuc2lvbklkZW50aWZpZXInLCAnaWQnLCAndGl0bGUnXSxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uSWRlbnRpZmllcjoge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWxQcm9maWxlLmxpbnV4RXh0ZW5zaW9uSWRlbnRpZmllcicsICdUaGUgZXh0ZW5zaW9uIHRoYXQgY29udHJpYnV0ZWQgdGhpcyBwcm9maWxlLicpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUubGludXhFeHRlbnNpb25JZCcsICdUaGUgaWQgb2YgdGhlIGV4dGVuc2lvbiB0ZXJtaW5hbCcpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGUubGludXhFeHRlbnNpb25UaXRsZScsICdUaGUgbmFtZSBvZiB0aGUgZXh0ZW5zaW9uIHRlcm1pbmFsJyksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Li4udGVybWluYWxQcm9maWxlQmFzZVByb3BlcnRpZXNcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHsgdHlwZTogJ251bGwnIH0sXG5cdFx0XHRcdFx0dGVybWluYWxQcm9maWxlU2NoZW1hXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5Vc2VXc2xQcm9maWxlc106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC51c2VXc2xQcm9maWxlcycsICdDb250cm9scyB3aGV0aGVyIG9yIG5vdCBXU0wgZGlzdHJvcyBhcmUgc2hvd24gaW4gdGhlIHRlcm1pbmFsIGRyb3Bkb3duJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuSW5oZXJpdEVudl06IHtcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuaW5oZXJpdEVudicsIFwiV2hldGhlciBuZXcgc2hlbGxzIHNob3VsZCBpbmhlcml0IHRoZWlyIGVudmlyb25tZW50IGZyb20gVlMgQ29kZSwgd2hpY2ggbWF5IHNvdXJjZSBhIGxvZ2luIHNoZWxsIHRvIGVuc3VyZSAkUEFUSCBhbmQgb3RoZXIgZGV2ZWxvcG1lbnQgdmFyaWFibGVzIGFyZSBpbml0aWFsaXplZC4gVGhpcyBoYXMgbm8gZWZmZWN0IG9uIFdpbmRvd3MuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlBlcnNpc3RlbnRTZXNzaW9uU2Nyb2xsYmFja106IHtcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5wZXJzaXN0ZW50U2Vzc2lvblNjcm9sbGJhY2snLCBcIkNvbnRyb2xzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiBsaW5lcyB0aGF0IHdpbGwgYmUgcmVzdG9yZWQgd2hlbiByZWNvbm5lY3RpbmcgdG8gYSBwZXJzaXN0ZW50IHRlcm1pbmFsIHNlc3Npb24uIEluY3JlYXNpbmcgdGhpcyB3aWxsIHJlc3RvcmUgbW9yZSBsaW5lcyBvZiBzY3JvbGxiYWNrIGF0IHRoZSBjb3N0IG9mIG1vcmUgbWVtb3J5IGFuZCBpbmNyZWFzZSB0aGUgdGltZSBpdCB0YWtlcyB0byBjb25uZWN0IHRvIHRlcm1pbmFscyBvbiBzdGFydCB1cC4gVGhpcyBzZXR0aW5nIHJlcXVpcmVzIGEgcmVzdGFydCB0byB0YWtlIGVmZmVjdCBhbmQgc2hvdWxkIGJlIHNldCB0byBhIHZhbHVlIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgI3Rlcm1pbmFsLmludGVncmF0ZWQuc2Nyb2xsYmFjayNgLlwiKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogMTAwXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuU2hvd0xpbmtIb3Zlcl06IHtcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuc2hvd0xpbmtIb3ZlcicsIFwiV2hldGhlciB0byBzaG93IGhvdmVycyBmb3IgbGlua3MgaW4gdGhlIHRlcm1pbmFsIG91dHB1dC5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuSWdub3JlUHJvY2Vzc05hbWVzXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY29uZmlybUlnbm9yZVByb2Nlc3NlcycsIFwiQSBzZXQgb2YgcHJvY2VzcyBuYW1lcyB0byBpZ25vcmUgd2hlbiB1c2luZyB0aGUgezB9IHNldHRpbmcuXCIsICdgI3Rlcm1pbmFsLmludGVncmF0ZWQuY29uZmlybU9uS2lsbCNgJyksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdHVuaXF1ZUl0ZW1zOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0ZGVmYXVsdDogW1xuXHRcdFx0XHQvLyBQb3B1bGFyIHByb21wdCBwcm9ncmFtcywgdGhlc2Ugc2hvdWxkIG5vdCBjb3VudCBhcyBjaGlsZCBwcm9jZXNzZXNcblx0XHRcdFx0J3N0YXJzaGlwJyxcblx0XHRcdFx0J29oLW15LXBvc2gnLFxuXHRcdFx0XHQvLyBHaXQgYmFzaCBtYXkgcnVucyBhIHN1YnByb2Nlc3Mgb2YgaXRzZWxmIChiaW5cXGJhc2guZXhlIC0+IHVzclxcYmluXFxiYXNoLmV4ZSlcblx0XHRcdFx0J2Jhc2gnLFxuXHRcdFx0XHQnenNoJyxcblx0XHRcdF1cblx0XHR9XG5cdH1cbn07XG5cbi8qKlxuICogUmVnaXN0ZXJzIHRlcm1pbmFsIGNvbmZpZ3VyYXRpb25zIHJlcXVpcmVkIGJ5IHNoYXJlZCBwcm9jZXNzIGFuZCByZW1vdGUgc2VydmVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJUZXJtaW5hbFBsYXRmb3JtQ29uZmlndXJhdGlvbigpIHtcblx0UmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKS5yZWdpc3RlckNvbmZpZ3VyYXRpb24odGVybWluYWxQbGF0Zm9ybUNvbmZpZ3VyYXRpb24pO1xuXHRyZWdpc3RlclRlcm1pbmFsRGVmYXVsdFByb2ZpbGVDb25maWd1cmF0aW9uKCk7XG59XG5cbmxldCBkZWZhdWx0UHJvZmlsZXNDb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUgfCB1bmRlZmluZWQ7XG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJUZXJtaW5hbERlZmF1bHRQcm9maWxlQ29uZmlndXJhdGlvbihkZXRlY3RlZFByb2ZpbGVzPzogeyBvczogT3BlcmF0aW5nU3lzdGVtOyBwcm9maWxlczogSVRlcm1pbmFsUHJvZmlsZVtdIH0sIGV4dGVuc2lvbkNvbnRyaWJ1dGVkUHJvZmlsZXM/OiByZWFkb25seSBJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlW10pIHtcblx0Y29uc3QgcmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRsZXQgcHJvZmlsZUVudW07XG5cdGlmIChkZXRlY3RlZFByb2ZpbGVzKSB7XG5cdFx0cHJvZmlsZUVudW0gPSBjcmVhdGVQcm9maWxlU2NoZW1hRW51bXMoZGV0ZWN0ZWRQcm9maWxlcz8ucHJvZmlsZXMsIGV4dGVuc2lvbkNvbnRyaWJ1dGVkUHJvZmlsZXMpO1xuXHR9XG5cdGNvbnN0IG9sZERlZmF1bHRQcm9maWxlc0NvbmZpZ3VyYXRpb24gPSBkZWZhdWx0UHJvZmlsZXNDb25maWd1cmF0aW9uO1xuXHRkZWZhdWx0UHJvZmlsZXNDb25maWd1cmF0aW9uID0ge1xuXHRcdGlkOiAndGVybWluYWwnLFxuXHRcdG9yZGVyOiAxMDAsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCd0ZXJtaW5hbEludGVncmF0ZWRDb25maWd1cmF0aW9uVGl0bGUnLCBcIkludGVncmF0ZWQgVGVybWluYWxcIiksXG5cdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkRlZmF1bHRQcm9maWxlTGludXhdOiB7XG5cdFx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmRlZmF1bHRQcm9maWxlLmxpbnV4JywgXCJUaGUgZGVmYXVsdCB0ZXJtaW5hbCBwcm9maWxlIG9uIExpbnV4LlwiKSxcblx0XHRcdFx0dHlwZTogWydzdHJpbmcnLCAnbnVsbCddLFxuXHRcdFx0XHRkZWZhdWx0OiBudWxsLFxuXHRcdFx0XHRlbnVtOiBkZXRlY3RlZFByb2ZpbGVzPy5vcyA9PT0gT3BlcmF0aW5nU3lzdGVtLkxpbnV4ID8gcHJvZmlsZUVudW0/LnZhbHVlcyA6IHVuZGVmaW5lZCxcblx0XHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBkZXRlY3RlZFByb2ZpbGVzPy5vcyA9PT0gT3BlcmF0aW5nU3lzdGVtLkxpbnV4ID8gcHJvZmlsZUVudW0/Lm1hcmtkb3duRGVzY3JpcHRpb25zIDogdW5kZWZpbmVkXG5cdFx0XHR9LFxuXHRcdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkRlZmF1bHRQcm9maWxlTWFjT3NdOiB7XG5cdFx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmRlZmF1bHRQcm9maWxlLm9zeCcsIFwiVGhlIGRlZmF1bHQgdGVybWluYWwgcHJvZmlsZSBvbiBtYWNPUy5cIiksXG5cdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXSxcblx0XHRcdFx0ZGVmYXVsdDogbnVsbCxcblx0XHRcdFx0ZW51bTogZGV0ZWN0ZWRQcm9maWxlcz8ub3MgPT09IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2ggPyBwcm9maWxlRW51bT8udmFsdWVzIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IGRldGVjdGVkUHJvZmlsZXM/Lm9zID09PSBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoID8gcHJvZmlsZUVudW0/Lm1hcmtkb3duRGVzY3JpcHRpb25zIDogdW5kZWZpbmVkXG5cdFx0XHR9LFxuXHRcdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkRlZmF1bHRQcm9maWxlV2luZG93c106IHtcblx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZGVmYXVsdFByb2ZpbGUud2luZG93cycsIFwiVGhlIGRlZmF1bHQgdGVybWluYWwgcHJvZmlsZSBvbiBXaW5kb3dzLlwiKSxcblx0XHRcdFx0dHlwZTogWydzdHJpbmcnLCAnbnVsbCddLFxuXHRcdFx0XHRkZWZhdWx0OiBudWxsLFxuXHRcdFx0XHRlbnVtOiBkZXRlY3RlZFByb2ZpbGVzPy5vcyA9PT0gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MgPyBwcm9maWxlRW51bT8udmFsdWVzIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IGRldGVjdGVkUHJvZmlsZXM/Lm9zID09PSBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyA/IHByb2ZpbGVFbnVtPy5tYXJrZG93bkRlc2NyaXB0aW9ucyA6IHVuZGVmaW5lZFxuXHRcdFx0fSxcblx0XHR9XG5cdH07XG5cdHJlZ2lzdHJ5LnVwZGF0ZUNvbmZpZ3VyYXRpb25zKHsgYWRkOiBbZGVmYXVsdFByb2ZpbGVzQ29uZmlndXJhdGlvbl0sIHJlbW92ZTogb2xkRGVmYXVsdFByb2ZpbGVzQ29uZmlndXJhdGlvbiA/IFtvbGREZWZhdWx0UHJvZmlsZXNDb25maWd1cmF0aW9uXSA6IFtdIH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxpQkFBaUIsVUFBVSx3QkFBd0I7QUFDNUQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBb0Isa0JBQThEO0FBQzNGLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQXNELHlCQUF5QjtBQUMvRSxTQUFTLGdDQUFnQztBQUVsQyxNQUFNLHNCQUFtQztBQUFBLEVBQy9DLE1BQU0sQ0FBQyxVQUFVLE1BQU07QUFBQSxFQUN2QixNQUFNO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNB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
