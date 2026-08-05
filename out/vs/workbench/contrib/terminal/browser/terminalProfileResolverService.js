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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Schemas } from "../../../../base/common/network.js";
import { env } from "../../../../base/common/process.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { ITerminalProfileService } from "../common/terminal.js";
import * as path from "../../../../base/common/path.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { debounce } from "../../../../base/common/decorators.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { deepClone } from "../../../../base/common/objects.js";
import { isUriComponents } from "../../../../platform/terminal/common/terminalProfiles.js";
import { ITerminalInstanceService } from "./terminal.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
const generatedProfileName = "Generated";
class BaseTerminalProfileResolverService extends Disposable {
  constructor(_context, _configurationService, _configurationResolverService, _historyService, _logService, _terminalProfileService, _workspaceContextService, _remoteAgentService) {
    super();
    this._context = _context;
    this._configurationService = _configurationService;
    this._configurationResolverService = _configurationResolverService;
    this._historyService = _historyService;
    this._logService = _logService;
    this._terminalProfileService = _terminalProfileService;
    this._workspaceContextService = _workspaceContextService;
    this._remoteAgentService = _remoteAgentService;
    this._iconRegistry = getIconRegistry();
    if (this._remoteAgentService.getConnection()) {
      this._remoteAgentService.getEnvironment().then((env2) => this._primaryBackendOs = env2?.os || OS);
    } else {
      this._primaryBackendOs = OS;
    }
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.DefaultProfileWindows) || e.affectsConfiguration(TerminalSettingId.DefaultProfileMacOs) || e.affectsConfiguration(TerminalSettingId.DefaultProfileLinux)) {
        this._refreshDefaultProfileName();
      }
    }));
    this._register(this._terminalProfileService.onDidChangeAvailableProfiles(() => this._refreshDefaultProfileName()));
  }
  get defaultProfileName() {
    return this._defaultProfileName;
  }
  async _refreshDefaultProfileName() {
    if (this._primaryBackendOs) {
      this._defaultProfileName = (await this.getDefaultProfile({
        remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority,
        os: this._primaryBackendOs
      }))?.profileName;
    }
  }
  resolveIcon(shellLaunchConfig, os) {
    if (shellLaunchConfig.icon) {
      shellLaunchConfig.icon = this._getCustomIcon(shellLaunchConfig.icon) || this.getDefaultIcon();
      return;
    }
    if (shellLaunchConfig.customPtyImplementation) {
      shellLaunchConfig.icon = this.getDefaultIcon();
      return;
    }
    if (shellLaunchConfig.executable) {
      return;
    }
    const defaultProfile = this._getUnresolvedRealDefaultProfile(os);
    if (defaultProfile) {
      shellLaunchConfig.icon = defaultProfile.icon;
    }
    if (!shellLaunchConfig.icon) {
      shellLaunchConfig.icon = this.getDefaultIcon();
    }
  }
  getDefaultIcon(resource) {
    return this._iconRegistry.getIcon(this._configurationService.getValue(TerminalSettingId.TabsDefaultIcon, { resource })) || Codicon.terminal;
  }
  async resolveShellLaunchConfig(shellLaunchConfig, options) {
    let resolvedProfile;
    if (shellLaunchConfig.executable) {
      resolvedProfile = await this._resolveProfile({
        path: shellLaunchConfig.executable,
        args: shellLaunchConfig.args,
        profileName: generatedProfileName,
        isDefault: false
      }, options);
    } else {
      resolvedProfile = await this.getDefaultProfile(options);
    }
    shellLaunchConfig.executable = resolvedProfile.path;
    shellLaunchConfig.args = resolvedProfile.args;
    if (resolvedProfile.env) {
      if (shellLaunchConfig.env) {
        shellLaunchConfig.env = { ...shellLaunchConfig.env, ...resolvedProfile.env };
      } else {
        shellLaunchConfig.env = resolvedProfile.env;
      }
    }
    const resource = shellLaunchConfig === void 0 || typeof shellLaunchConfig.cwd === "string" ? void 0 : shellLaunchConfig.cwd;
    shellLaunchConfig.icon = this._getCustomIcon(shellLaunchConfig.icon) || this._getCustomIcon(resolvedProfile.icon) || this.getDefaultIcon(resource);
    if (resolvedProfile.overrideName) {
      shellLaunchConfig.name = resolvedProfile.profileName;
    }
    shellLaunchConfig.color = shellLaunchConfig.color || resolvedProfile.color || this._configurationService.getValue(TerminalSettingId.TabsDefaultColor, { resource });
    if (shellLaunchConfig.useShellEnvironment === void 0) {
      shellLaunchConfig.useShellEnvironment = this._configurationService.getValue(TerminalSettingId.InheritEnv);
    }
  }
  async getDefaultShell(options) {
    return (await this.getDefaultProfile(options)).path;
  }
  async getDefaultShellArgs(options) {
    return (await this.getDefaultProfile(options)).args || [];
  }
  async getDefaultProfile(options) {
    return this._resolveProfile(await this._getUnresolvedDefaultProfile(options), options);
  }
  getEnvironment(remoteAuthority) {
    return this._context.getEnvironment(remoteAuthority);
  }
  _getCustomIcon(icon) {
    if (!icon) {
      return void 0;
    }
    if (typeof icon === "string") {
      return ThemeIcon.fromId(icon);
    }
    if (ThemeIcon.isThemeIcon(icon)) {
      return icon;
    }
    if (URI.isUri(icon) || isUriComponents(icon)) {
      return URI.revive(icon);
    }
    if (typeof icon === "object" && "light" in icon && "dark" in icon) {
      const castedIcon = icon;
      if ((URI.isUri(castedIcon.light) || isUriComponents(castedIcon.light)) && (URI.isUri(castedIcon.dark) || isUriComponents(castedIcon.dark))) {
        return { light: URI.revive(castedIcon.light), dark: URI.revive(castedIcon.dark) };
      }
    }
    return void 0;
  }
  async _getUnresolvedDefaultProfile(options) {
    if (options.allowAutomationShell) {
      const automationShellProfile = this._getUnresolvedAutomationShellProfile(options);
      if (automationShellProfile) {
        return automationShellProfile;
      }
    }
    await this._terminalProfileService.profilesReady;
    const defaultProfile = this._getUnresolvedRealDefaultProfile(options.os);
    if (defaultProfile) {
      return this._setIconForAutomation(options, defaultProfile);
    }
    return this._setIconForAutomation(options, await this._getUnresolvedFallbackDefaultProfile(options));
  }
  _setIconForAutomation(options, profile) {
    if (options.allowAutomationShell) {
      const profileClone = deepClone(profile);
      profileClone.icon = Codicon.tools;
      return profileClone;
    }
    return profile;
  }
  _getUnresolvedRealDefaultProfile(os) {
    return this._terminalProfileService.getDefaultProfile(os);
  }
  async _getUnresolvedFallbackDefaultProfile(options) {
    const executable = await this._context.getDefaultSystemShell(options.remoteAuthority, options.os);
    if (options.os === OS) {
      let existingProfile = this._terminalProfileService.availableProfiles.find((e) => path.parse(e.path).name === path.parse(executable).name);
      if (existingProfile) {
        if (options.allowAutomationShell) {
          existingProfile = deepClone(existingProfile);
          existingProfile.icon = Codicon.tools;
        }
        return existingProfile;
      }
    }
    let args;
    if (options.os === OperatingSystem.Macintosh && path.parse(executable).name.match(/(zsh|bash)/)) {
      args = ["--login"];
    } else {
      args = [];
    }
    const icon = this._guessProfileIcon(executable);
    return {
      profileName: generatedProfileName,
      path: executable,
      args,
      icon,
      isDefault: false
    };
  }
  _getUnresolvedAutomationShellProfile(options) {
    const automationProfile = this._configurationService.getValue(`terminal.integrated.automationProfile.${this._getOsKey(options.os)}`);
    if (this._isValidAutomationProfile(automationProfile, options.os)) {
      automationProfile.icon = this._getCustomIcon(automationProfile.icon) || Codicon.tools;
      return automationProfile;
    }
    return void 0;
  }
  async _resolveProfile(profile, options) {
    const env2 = await this._context.getEnvironment(options.remoteAuthority);
    if (options.os === OperatingSystem.Windows) {
      const isWoW64 = !!env2.hasOwnProperty("PROCESSOR_ARCHITEW6432");
      const windir = env2.windir;
      if (!isWoW64 && windir) {
        const sysnativePath = path.join(windir, "Sysnative").replace(/\//g, "\\").toLowerCase();
        if (profile.path && profile.path.toLowerCase().indexOf(sysnativePath) === 0) {
          profile.path = path.join(windir, "System32", profile.path.substr(sysnativePath.length + 1));
        }
      }
      if (profile.path) {
        profile.path = profile.path.replace(/\//g, "\\");
      }
    }
    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(options.remoteAuthority ? Schemas.vscodeRemote : Schemas.file);
    const lastActiveWorkspace = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
    profile.path = await this._resolveVariables(profile.path, env2, lastActiveWorkspace);
    if (profile.args) {
      if (typeof profile.args === "string") {
        profile.args = await this._resolveVariables(profile.args, env2, lastActiveWorkspace);
      } else {
        profile.args = await Promise.all(profile.args.map((arg) => this._resolveVariables(arg, env2, lastActiveWorkspace)));
      }
    }
    return profile;
  }
  async _resolveVariables(value, env2, lastActiveWorkspace) {
    try {
      value = await this._configurationResolverService.resolveWithEnvironment(env2, lastActiveWorkspace, value);
    } catch (e) {
      this._logService.error(`Could not resolve shell`, e);
    }
    return value;
  }
  _getOsKey(os) {
    switch (os) {
      case OperatingSystem.Linux:
        return "linux";
      case OperatingSystem.Macintosh:
        return "osx";
      case OperatingSystem.Windows:
        return "windows";
    }
  }
  _guessProfileIcon(shell) {
    const file = path.parse(shell).name;
    switch (file) {
      case "bash":
        return Codicon.terminalBash;
      case "pwsh":
      case "powershell":
        return Codicon.terminalPowershell;
      case "tmux":
        return Codicon.terminalTmux;
      case "cmd":
        return Codicon.terminalCmd;
      default:
        return void 0;
    }
  }
  _isValidAutomationProfile(profile, os) {
    if (profile === null || profile === void 0 || typeof profile !== "object") {
      return false;
    }
    if ("path" in profile && typeof profile.path === "string") {
      return true;
    }
    return false;
  }
}
__decorateClass([
  debounce(200)
], BaseTerminalProfileResolverService.prototype, "_refreshDefaultProfileName", 1);
let BrowserTerminalProfileResolverService = class extends BaseTerminalProfileResolverService {
  constructor(configurationResolverService, configurationService, historyService, logService, terminalInstanceService, terminalProfileService, workspaceContextService, remoteAgentService) {
    super(
      {
        getDefaultSystemShell: async (remoteAuthority, os) => {
          const backend = await terminalInstanceService.getBackend(remoteAuthority);
          if (!remoteAuthority || !backend) {
            return os === OperatingSystem.Windows ? "pwsh" : "bash";
          }
          return backend.getDefaultSystemShell(os);
        },
        getEnvironment: async (remoteAuthority) => {
          const backend = await terminalInstanceService.getBackend(remoteAuthority);
          if (!remoteAuthority || !backend) {
            return env;
          }
          return backend.getEnvironment();
        }
      },
      configurationService,
      configurationResolverService,
      historyService,
      logService,
      terminalProfileService,
      workspaceContextService,
      remoteAgentService
    );
  }
};
BrowserTerminalProfileResolverService = __decorateClass([
  __decorateParam(0, IConfigurationResolverService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IHistoryService),
  __decorateParam(3, ITerminalLogService),
  __decorateParam(4, ITerminalInstanceService),
  __decorateParam(5, ITerminalProfileService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IRemoteAgentService)
], BrowserTerminalProfileResolverService);
export {
  BaseTerminalProfileResolverService,
  BrowserTerminalProfileResolverService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGVudiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3MuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IElIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hpc3RvcnkvY29tbW9uL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgT3BlcmF0aW5nU3lzdGVtLCBPUyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElTaGVsbExhdW5jaENvbmZpZywgSVRlcm1pbmFsTG9nU2VydmljZSwgSVRlcm1pbmFsUHJvZmlsZSwgVGVybWluYWxJY29uLCBUZXJtaW5hbFNldHRpbmdJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJU2hlbGxMYXVuY2hDb25maWdSZXNvbHZlT3B0aW9ucywgSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSwgSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBnZXRJY29uUmVnaXN0cnksIElJY29uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBkZWJvdW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBkZWVwQ2xvbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IGlzVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbFByb2ZpbGVzLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEluc3RhbmNlU2VydmljZSB9IGZyb20gJy4vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2ZpbGVDb250ZXh0UHJvdmlkZXIge1xuXHRnZXREZWZhdWx0U3lzdGVtU2hlbGwocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQsIG9zOiBPcGVyYXRpbmdTeXN0ZW0pOiBQcm9taXNlPHN0cmluZz47XG5cdGdldEVudmlyb25tZW50KHJlbW90ZUF1dGhvcml0eTogc3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50Pjtcbn1cblxuY29uc3QgZ2VuZXJhdGVkUHJvZmlsZU5hbWUgPSAnR2VuZXJhdGVkJztcblxuLypcbiAqIFJlc29sdmVzIHRlcm1pbmFsIHNoZWxsIGxhdW5jaCBjb25maWcgYW5kIHRlcm1pbmFsIHByb2ZpbGVzIGZvciB0aGUgZ2l2ZW4gb3BlcmF0aW5nIHN5c3RlbSxcbiAqIGVudmlyb25tZW50LCBhbmQgdXNlciBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlIHtcblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfcHJpbWFyeUJhY2tlbmRPczogT3BlcmF0aW5nU3lzdGVtIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2ljb25SZWdpc3RyeTogSUljb25SZWdpc3RyeSA9IGdldEljb25SZWdpc3RyeSgpO1xuXG5cdHByaXZhdGUgX2RlZmF1bHRQcm9maWxlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXQgZGVmYXVsdFByb2ZpbGVOYW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9kZWZhdWx0UHJvZmlsZU5hbWU7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0OiBJUHJvZmlsZUNvbnRleHRQcm92aWRlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2U6IElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hpc3RvcnlTZXJ2aWNlOiBJSGlzdG9yeVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSVRlcm1pbmFsTG9nU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlOiBJVGVybWluYWxQcm9maWxlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3JlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCkpIHtcblx0XHRcdHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpLnRoZW4oZW52ID0+IHRoaXMuX3ByaW1hcnlCYWNrZW5kT3MgPSBlbnY/Lm9zIHx8IE9TKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcHJpbWFyeUJhY2tlbmRPcyA9IE9TO1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5EZWZhdWx0UHJvZmlsZVdpbmRvd3MpIHx8XG5cdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuRGVmYXVsdFByb2ZpbGVNYWNPcykgfHxcblx0XHRcdFx0ZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5EZWZhdWx0UHJvZmlsZUxpbnV4KSkge1xuXHRcdFx0XHR0aGlzLl9yZWZyZXNoRGVmYXVsdFByb2ZpbGVOYW1lKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VBdmFpbGFibGVQcm9maWxlcygoKSA9PiB0aGlzLl9yZWZyZXNoRGVmYXVsdFByb2ZpbGVOYW1lKCkpKTtcblx0fVxuXG5cdEBkZWJvdW5jZSgyMDApXG5cdHByaXZhdGUgYXN5bmMgX3JlZnJlc2hEZWZhdWx0UHJvZmlsZU5hbWUoKSB7XG5cdFx0aWYgKHRoaXMuX3ByaW1hcnlCYWNrZW5kT3MpIHtcblx0XHRcdHRoaXMuX2RlZmF1bHRQcm9maWxlTmFtZSA9IChhd2FpdCB0aGlzLmdldERlZmF1bHRQcm9maWxlKHtcblx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiB0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpPy5yZW1vdGVBdXRob3JpdHksXG5cdFx0XHRcdG9zOiB0aGlzLl9wcmltYXJ5QmFja2VuZE9zXG5cdFx0XHR9KSk/LnByb2ZpbGVOYW1lO1xuXHRcdH1cblx0fVxuXG5cdHJlc29sdmVJY29uKHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsIG9zOiBPcGVyYXRpbmdTeXN0ZW0pOiB2b2lkIHtcblx0XHRpZiAoc2hlbGxMYXVuY2hDb25maWcuaWNvbikge1xuXHRcdFx0c2hlbGxMYXVuY2hDb25maWcuaWNvbiA9IHRoaXMuX2dldEN1c3RvbUljb24oc2hlbGxMYXVuY2hDb25maWcuaWNvbikgfHwgdGhpcy5nZXREZWZhdWx0SWNvbigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoc2hlbGxMYXVuY2hDb25maWcuY3VzdG9tUHR5SW1wbGVtZW50YXRpb24pIHtcblx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLmljb24gPSB0aGlzLmdldERlZmF1bHRJY29uKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGRlZmF1bHRQcm9maWxlID0gdGhpcy5fZ2V0VW5yZXNvbHZlZFJlYWxEZWZhdWx0UHJvZmlsZShvcyk7XG5cdFx0aWYgKGRlZmF1bHRQcm9maWxlKSB7XG5cdFx0XHRzaGVsbExhdW5jaENvbmZpZy5pY29uID0gZGVmYXVsdFByb2ZpbGUuaWNvbjtcblx0XHR9XG5cdFx0aWYgKCFzaGVsbExhdW5jaENvbmZpZy5pY29uKSB7XG5cdFx0XHRzaGVsbExhdW5jaENvbmZpZy5pY29uID0gdGhpcy5nZXREZWZhdWx0SWNvbigpO1xuXHRcdH1cblx0fVxuXG5cdGdldERlZmF1bHRJY29uKHJlc291cmNlPzogVVJJKTogVGVybWluYWxJY29uICYgVGhlbWVJY29uIHtcblx0XHRyZXR1cm4gdGhpcy5faWNvblJlZ2lzdHJ5LmdldEljb24odGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuVGFic0RlZmF1bHRJY29uLCB7IHJlc291cmNlIH0pKSB8fCBDb2RpY29uLnRlcm1pbmFsO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZVNoZWxsTGF1bmNoQ29uZmlnKHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsIG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gUmVzb2x2ZSB0aGUgc2hlbGwgYW5kIHNoZWxsIGFyZ3Ncblx0XHRsZXQgcmVzb2x2ZWRQcm9maWxlOiBJVGVybWluYWxQcm9maWxlO1xuXHRcdGlmIChzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlKSB7XG5cdFx0XHRyZXNvbHZlZFByb2ZpbGUgPSBhd2FpdCB0aGlzLl9yZXNvbHZlUHJvZmlsZSh7XG5cdFx0XHRcdHBhdGg6IHNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUsXG5cdFx0XHRcdGFyZ3M6IHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MsXG5cdFx0XHRcdHByb2ZpbGVOYW1lOiBnZW5lcmF0ZWRQcm9maWxlTmFtZSxcblx0XHRcdFx0aXNEZWZhdWx0OiBmYWxzZVxuXHRcdFx0fSwgb3B0aW9ucyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc29sdmVkUHJvZmlsZSA9IGF3YWl0IHRoaXMuZ2V0RGVmYXVsdFByb2ZpbGUob3B0aW9ucyk7XG5cdFx0fVxuXHRcdHNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUgPSByZXNvbHZlZFByb2ZpbGUucGF0aDtcblx0XHRzaGVsbExhdW5jaENvbmZpZy5hcmdzID0gcmVzb2x2ZWRQcm9maWxlLmFyZ3M7XG5cdFx0aWYgKHJlc29sdmVkUHJvZmlsZS5lbnYpIHtcblx0XHRcdGlmIChzaGVsbExhdW5jaENvbmZpZy5lbnYpIHtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuZW52ID0geyAuLi5zaGVsbExhdW5jaENvbmZpZy5lbnYsIC4uLnJlc29sdmVkUHJvZmlsZS5lbnYgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLmVudiA9IHJlc29sdmVkUHJvZmlsZS5lbnY7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVmVyaWZ5IHRoZSBpY29uIGlzIHZhbGlkLCBhbmQgZmFsbGJhY2sgY29ycmVjdGx5IHRvIHRoZSBnZW5lcmljIHRlcm1pbmFsIGlkIGlmIHRoZXJlIGlzXG5cdFx0Ly8gYW4gaXNzdWVcblx0XHRjb25zdCByZXNvdXJjZSA9IHNoZWxsTGF1bmNoQ29uZmlnID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIHNoZWxsTGF1bmNoQ29uZmlnLmN3ZCA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBzaGVsbExhdW5jaENvbmZpZy5jd2Q7XG5cdFx0c2hlbGxMYXVuY2hDb25maWcuaWNvbiA9IHRoaXMuX2dldEN1c3RvbUljb24oc2hlbGxMYXVuY2hDb25maWcuaWNvbilcblx0XHRcdHx8IHRoaXMuX2dldEN1c3RvbUljb24ocmVzb2x2ZWRQcm9maWxlLmljb24pXG5cdFx0XHR8fCB0aGlzLmdldERlZmF1bHRJY29uKHJlc291cmNlKTtcblxuXHRcdC8vIE92ZXJyaWRlIHRoZSBuYW1lIGlmIHNwZWNpZmllZFxuXHRcdGlmIChyZXNvbHZlZFByb2ZpbGUub3ZlcnJpZGVOYW1lKSB7XG5cdFx0XHRzaGVsbExhdW5jaENvbmZpZy5uYW1lID0gcmVzb2x2ZWRQcm9maWxlLnByb2ZpbGVOYW1lO1xuXHRcdH1cblxuXHRcdC8vIEFwcGx5IHRoZSBjb2xvclxuXHRcdHNoZWxsTGF1bmNoQ29uZmlnLmNvbG9yID0gc2hlbGxMYXVuY2hDb25maWcuY29sb3Jcblx0XHRcdHx8IHJlc29sdmVkUHJvZmlsZS5jb2xvclxuXHRcdFx0fHwgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuVGFic0RlZmF1bHRDb2xvciwgeyByZXNvdXJjZSB9KTtcblxuXHRcdC8vIFJlc29sdmUgdXNlU2hlbGxFbnZpcm9ubWVudCBiYXNlZCBvbiB0aGUgc2V0dGluZyBpZiBpdCdzIG5vdCBzZXRcblx0XHRpZiAoc2hlbGxMYXVuY2hDb25maWcudXNlU2hlbGxFbnZpcm9ubWVudCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRzaGVsbExhdW5jaENvbmZpZy51c2VTaGVsbEVudmlyb25tZW50ID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuSW5oZXJpdEVudik7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0RGVmYXVsdFNoZWxsKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gKGF3YWl0IHRoaXMuZ2V0RGVmYXVsdFByb2ZpbGUob3B0aW9ucykpLnBhdGg7XG5cdH1cblxuXHRhc3luYyBnZXREZWZhdWx0U2hlbGxBcmdzKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxzdHJpbmcgfCBzdHJpbmdbXT4ge1xuXHRcdHJldHVybiAoYXdhaXQgdGhpcy5nZXREZWZhdWx0UHJvZmlsZShvcHRpb25zKSkuYXJncyB8fCBbXTtcblx0fVxuXG5cdGFzeW5jIGdldERlZmF1bHRQcm9maWxlKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc29sdmVQcm9maWxlKGF3YWl0IHRoaXMuX2dldFVucmVzb2x2ZWREZWZhdWx0UHJvZmlsZShvcHRpb25zKSwgb3B0aW9ucyk7XG5cdH1cblxuXHRnZXRFbnZpcm9ubWVudChyZW1vdGVBdXRob3JpdHk6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8SVByb2Nlc3NFbnZpcm9ubWVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZXh0LmdldEVudmlyb25tZW50KHJlbW90ZUF1dGhvcml0eSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDdXN0b21JY29uKGljb24/OiB1bmtub3duKTogVGVybWluYWxJY29uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWljb24pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgaWNvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBUaGVtZUljb24uZnJvbUlkKGljb24pO1xuXHRcdH1cblx0XHRpZiAoVGhlbWVJY29uLmlzVGhlbWVJY29uKGljb24pKSB7XG5cdFx0XHRyZXR1cm4gaWNvbjtcblx0XHR9XG5cdFx0aWYgKFVSSS5pc1VyaShpY29uKSB8fCBpc1VyaUNvbXBvbmVudHMoaWNvbikpIHtcblx0XHRcdHJldHVybiBVUkkucmV2aXZlKGljb24pO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGljb24gPT09ICdvYmplY3QnICYmICdsaWdodCcgaW4gaWNvbiAmJiAnZGFyaycgaW4gaWNvbikge1xuXHRcdFx0Y29uc3QgY2FzdGVkSWNvbiA9IChpY29uIGFzIHsgbGlnaHQ6IHVua25vd247IGRhcms6IHVua25vd24gfSk7XG5cdFx0XHRpZiAoKFVSSS5pc1VyaShjYXN0ZWRJY29uLmxpZ2h0KSB8fCBpc1VyaUNvbXBvbmVudHMoY2FzdGVkSWNvbi5saWdodCkpICYmIChVUkkuaXNVcmkoY2FzdGVkSWNvbi5kYXJrKSB8fCBpc1VyaUNvbXBvbmVudHMoY2FzdGVkSWNvbi5kYXJrKSkpIHtcblx0XHRcdFx0cmV0dXJuIHsgbGlnaHQ6IFVSSS5yZXZpdmUoY2FzdGVkSWNvbi5saWdodCksIGRhcms6IFVSSS5yZXZpdmUoY2FzdGVkSWNvbi5kYXJrKSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0VW5yZXNvbHZlZERlZmF1bHRQcm9maWxlKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlPiB7XG5cdFx0Ly8gSWYgYXV0b21hdGlvbiBzaGVsbCBpcyBhbGxvd2VkLCBwcmVmZXIgdGhhdFxuXHRcdGlmIChvcHRpb25zLmFsbG93QXV0b21hdGlvblNoZWxsKSB7XG5cdFx0XHRjb25zdCBhdXRvbWF0aW9uU2hlbGxQcm9maWxlID0gdGhpcy5fZ2V0VW5yZXNvbHZlZEF1dG9tYXRpb25TaGVsbFByb2ZpbGUob3B0aW9ucyk7XG5cdFx0XHRpZiAoYXV0b21hdGlvblNoZWxsUHJvZmlsZSkge1xuXHRcdFx0XHRyZXR1cm4gYXV0b21hdGlvblNoZWxsUHJvZmlsZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZXR1cm4gdGhlIHJlYWwgZGVmYXVsdCBwcm9maWxlIGlmIGl0IGV4aXN0cyBhbmQgaXMgdmFsaWQsIHdhaXQgZm9yIHByb2ZpbGVzIHRvIGJlIHJlYWR5XG5cdFx0Ly8gaWYgdGhlIHdpbmRvdyBqdXN0IG9wZW5lZFxuXHRcdGF3YWl0IHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UucHJvZmlsZXNSZWFkeTtcblx0XHRjb25zdCBkZWZhdWx0UHJvZmlsZSA9IHRoaXMuX2dldFVucmVzb2x2ZWRSZWFsRGVmYXVsdFByb2ZpbGUob3B0aW9ucy5vcyk7XG5cdFx0aWYgKGRlZmF1bHRQcm9maWxlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2V0SWNvbkZvckF1dG9tYXRpb24ob3B0aW9ucywgZGVmYXVsdFByb2ZpbGUpO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZXJlIGlzIG5vIHJlYWwgZGVmYXVsdCBwcm9maWxlLCBjcmVhdGUgYSBmYWxsYmFjayBkZWZhdWx0IHByb2ZpbGUgYmFzZWQgb24gdGhlIHNoZWxsXG5cdFx0Ly8gYW5kIHNoZWxsQXJncyBzZXR0aW5ncyBpbiBhZGRpdGlvbiB0byB0aGUgY3VycmVudCBlbnZpcm9ubWVudC5cblx0XHRyZXR1cm4gdGhpcy5fc2V0SWNvbkZvckF1dG9tYXRpb24ob3B0aW9ucywgYXdhaXQgdGhpcy5fZ2V0VW5yZXNvbHZlZEZhbGxiYWNrRGVmYXVsdFByb2ZpbGUob3B0aW9ucykpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0SWNvbkZvckF1dG9tYXRpb24ob3B0aW9uczogSVNoZWxsTGF1bmNoQ29uZmlnUmVzb2x2ZU9wdGlvbnMsIHByb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGUpOiBJVGVybWluYWxQcm9maWxlIHtcblx0XHRpZiAob3B0aW9ucy5hbGxvd0F1dG9tYXRpb25TaGVsbCkge1xuXHRcdFx0Y29uc3QgcHJvZmlsZUNsb25lID0gZGVlcENsb25lKHByb2ZpbGUpO1xuXHRcdFx0cHJvZmlsZUNsb25lLmljb24gPSBDb2RpY29uLnRvb2xzO1xuXHRcdFx0cmV0dXJuIHByb2ZpbGVDbG9uZTtcblx0XHR9XG5cdFx0cmV0dXJuIHByb2ZpbGU7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRVbnJlc29sdmVkUmVhbERlZmF1bHRQcm9maWxlKG9zOiBPcGVyYXRpbmdTeXN0ZW0pOiBJVGVybWluYWxQcm9maWxlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5nZXREZWZhdWx0UHJvZmlsZShvcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRVbnJlc29sdmVkRmFsbGJhY2tEZWZhdWx0UHJvZmlsZShvcHRpb25zOiBJU2hlbGxMYXVuY2hDb25maWdSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8SVRlcm1pbmFsUHJvZmlsZT4ge1xuXHRcdGNvbnN0IGV4ZWN1dGFibGUgPSBhd2FpdCB0aGlzLl9jb250ZXh0LmdldERlZmF1bHRTeXN0ZW1TaGVsbChvcHRpb25zLnJlbW90ZUF1dGhvcml0eSwgb3B0aW9ucy5vcyk7XG5cblx0XHQvLyBUcnkgc2VsZWN0IGFuIGV4aXN0aW5nIHByb2ZpbGUgdG8gZmFsbGJhY2sgdG8sIGJhc2VkIG9uIHRoZSBkZWZhdWx0IHN5c3RlbSBzaGVsbCwgb25seSBkb1xuXHRcdC8vIHRoaXMgd2hlbiBpdCBpcyBOT1QgYSBsb2NhbCB0ZXJtaW5hbCBpbiBhIHJlbW90ZSB3aW5kb3cgd2hlcmUgdGhlIGZyb250IGFuZCBiYWNrIGVuZCBPU1xuXHRcdC8vIGRpZmZlcnMgKGVnLiBXaW5kb3dzIC0+IFdTTCwgTWFjIC0+IExpbnV4KVxuXHRcdGlmIChvcHRpb25zLm9zID09PSBPUykge1xuXHRcdFx0bGV0IGV4aXN0aW5nUHJvZmlsZSA9IHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UuYXZhaWxhYmxlUHJvZmlsZXMuZmluZChlID0+IHBhdGgucGFyc2UoZS5wYXRoKS5uYW1lID09PSBwYXRoLnBhcnNlKGV4ZWN1dGFibGUpLm5hbWUpO1xuXHRcdFx0aWYgKGV4aXN0aW5nUHJvZmlsZSkge1xuXHRcdFx0XHRpZiAob3B0aW9ucy5hbGxvd0F1dG9tYXRpb25TaGVsbCkge1xuXHRcdFx0XHRcdGV4aXN0aW5nUHJvZmlsZSA9IGRlZXBDbG9uZShleGlzdGluZ1Byb2ZpbGUpO1xuXHRcdFx0XHRcdGV4aXN0aW5nUHJvZmlsZS5pY29uID0gQ29kaWNvbi50b29scztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZXhpc3RpbmdQcm9maWxlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZpbmFsbHkgZmFsbGJhY2sgdG8gYSBnZW5lcmF0ZWQgcHJvZmlsZVxuXHRcdGxldCBhcmdzOiBzdHJpbmcgfCBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblx0XHRpZiAob3B0aW9ucy5vcyA9PT0gT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCAmJiBwYXRoLnBhcnNlKGV4ZWN1dGFibGUpLm5hbWUubWF0Y2goLyh6c2h8YmFzaCkvKSkge1xuXHRcdFx0Ly8gbWFjT1Mgc2hvdWxkIGxhdW5jaCBhIGxvZ2luIHNoZWxsIGJ5IGRlZmF1bHRcblx0XHRcdGFyZ3MgPSBbJy0tbG9naW4nXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gUmVzb2x2ZSB1bmRlZmluZWQgdG8gW11cblx0XHRcdGFyZ3MgPSBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBpY29uID0gdGhpcy5fZ3Vlc3NQcm9maWxlSWNvbihleGVjdXRhYmxlKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRwcm9maWxlTmFtZTogZ2VuZXJhdGVkUHJvZmlsZU5hbWUsXG5cdFx0XHRwYXRoOiBleGVjdXRhYmxlLFxuXHRcdFx0YXJncyxcblx0XHRcdGljb24sXG5cdFx0XHRpc0RlZmF1bHQ6IGZhbHNlXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFVucmVzb2x2ZWRBdXRvbWF0aW9uU2hlbGxQcm9maWxlKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogSVRlcm1pbmFsUHJvZmlsZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgYXV0b21hdGlvblByb2ZpbGUgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShgdGVybWluYWwuaW50ZWdyYXRlZC5hdXRvbWF0aW9uUHJvZmlsZS4ke3RoaXMuX2dldE9zS2V5KG9wdGlvbnMub3MpfWApO1xuXHRcdGlmICh0aGlzLl9pc1ZhbGlkQXV0b21hdGlvblByb2ZpbGUoYXV0b21hdGlvblByb2ZpbGUsIG9wdGlvbnMub3MpKSB7XG5cdFx0XHRhdXRvbWF0aW9uUHJvZmlsZS5pY29uID0gdGhpcy5fZ2V0Q3VzdG9tSWNvbihhdXRvbWF0aW9uUHJvZmlsZS5pY29uKSB8fCBDb2RpY29uLnRvb2xzO1xuXHRcdFx0cmV0dXJuIGF1dG9tYXRpb25Qcm9maWxlO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXNvbHZlUHJvZmlsZShwcm9maWxlOiBJVGVybWluYWxQcm9maWxlLCBvcHRpb25zOiBJU2hlbGxMYXVuY2hDb25maWdSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8SVRlcm1pbmFsUHJvZmlsZT4ge1xuXHRcdGNvbnN0IGVudiA9IGF3YWl0IHRoaXMuX2NvbnRleHQuZ2V0RW52aXJvbm1lbnQob3B0aW9ucy5yZW1vdGVBdXRob3JpdHkpO1xuXG5cdFx0aWYgKG9wdGlvbnMub3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKSB7XG5cdFx0XHQvLyBDaGFuZ2UgU3lzbmF0aXZlIHRvIFN5c3RlbTMyIGlmIHRoZSBPUyBpcyBXaW5kb3dzIGJ1dCBOT1QgV29XNjQuIEl0J3Ncblx0XHRcdC8vIHNhZmUgdG8gYXNzdW1lIHRoYXQgdGhpcyB3YXMgdXNlZCBieSBhY2NpZGVudCBhcyBTeXNuYXRpdmUgZG9lcyBub3Rcblx0XHRcdC8vIGV4aXN0IGFuZCB3aWxsIGJyZWFrIHRoZSB0ZXJtaW5hbCBpbiBub24tV29XNjQgZW52aXJvbm1lbnRzLlxuXHRcdFx0Y29uc3QgaXNXb1c2NCA9ICEhZW52Lmhhc093blByb3BlcnR5KCdQUk9DRVNTT1JfQVJDSElURVc2NDMyJyk7XG5cdFx0XHRjb25zdCB3aW5kaXIgPSBlbnYud2luZGlyO1xuXHRcdFx0aWYgKCFpc1dvVzY0ICYmIHdpbmRpcikge1xuXHRcdFx0XHRjb25zdCBzeXNuYXRpdmVQYXRoID0gcGF0aC5qb2luKHdpbmRpciwgJ1N5c25hdGl2ZScpLnJlcGxhY2UoL1xcLy9nLCAnXFxcXCcpLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdGlmIChwcm9maWxlLnBhdGggJiYgcHJvZmlsZS5wYXRoLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihzeXNuYXRpdmVQYXRoKSA9PT0gMCkge1xuXHRcdFx0XHRcdHByb2ZpbGUucGF0aCA9IHBhdGguam9pbih3aW5kaXIsICdTeXN0ZW0zMicsIHByb2ZpbGUucGF0aC5zdWJzdHIoc3lzbmF0aXZlUGF0aC5sZW5ndGggKyAxKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29udmVydCAvIHRvIFxcIG9uIFdpbmRvd3MgZm9yIGNvbnZlbmllbmNlXG5cdFx0XHRpZiAocHJvZmlsZS5wYXRoKSB7XG5cdFx0XHRcdHByb2ZpbGUucGF0aCA9IHByb2ZpbGUucGF0aC5yZXBsYWNlKC9cXC8vZywgJ1xcXFwnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZXNvbHZlIHBhdGggdmFyaWFibGVzXG5cdFx0Y29uc3QgYWN0aXZlV29ya3NwYWNlUm9vdFVyaSA9IHRoaXMuX2hpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVXb3Jrc3BhY2VSb290KG9wdGlvbnMucmVtb3RlQXV0aG9yaXR5ID8gU2NoZW1hcy52c2NvZGVSZW1vdGUgOiBTY2hlbWFzLmZpbGUpO1xuXHRcdGNvbnN0IGxhc3RBY3RpdmVXb3Jrc3BhY2UgPSBhY3RpdmVXb3Jrc3BhY2VSb290VXJpID8gdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGFjdGl2ZVdvcmtzcGFjZVJvb3RVcmkpID8/IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblx0XHRwcm9maWxlLnBhdGggPSBhd2FpdCB0aGlzLl9yZXNvbHZlVmFyaWFibGVzKHByb2ZpbGUucGF0aCwgZW52LCBsYXN0QWN0aXZlV29ya3NwYWNlKTtcblxuXHRcdC8vIFJlc29sdmUgYXJncyB2YXJpYWJsZXNcblx0XHRpZiAocHJvZmlsZS5hcmdzKSB7XG5cdFx0XHRpZiAodHlwZW9mIHByb2ZpbGUuYXJncyA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0cHJvZmlsZS5hcmdzID0gYXdhaXQgdGhpcy5fcmVzb2x2ZVZhcmlhYmxlcyhwcm9maWxlLmFyZ3MsIGVudiwgbGFzdEFjdGl2ZVdvcmtzcGFjZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwcm9maWxlLmFyZ3MgPSBhd2FpdCBQcm9taXNlLmFsbChwcm9maWxlLmFyZ3MubWFwKGFyZyA9PiB0aGlzLl9yZXNvbHZlVmFyaWFibGVzKGFyZywgZW52LCBsYXN0QWN0aXZlV29ya3NwYWNlKSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBwcm9maWxlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZVZhcmlhYmxlcyh2YWx1ZTogc3RyaW5nLCBlbnY6IElQcm9jZXNzRW52aXJvbm1lbnQsIGxhc3RBY3RpdmVXb3Jrc3BhY2U6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQpIHtcblx0XHR0cnkge1xuXHRcdFx0dmFsdWUgPSBhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVXaXRoRW52aXJvbm1lbnQoZW52LCBsYXN0QWN0aXZlV29ya3NwYWNlLCB2YWx1ZSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgQ291bGQgbm90IHJlc29sdmUgc2hlbGxgLCBlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0T3NLZXkob3M6IE9wZXJhdGluZ1N5c3RlbSk6IHN0cmluZyB7XG5cdFx0c3dpdGNoIChvcykge1xuXHRcdFx0Y2FzZSBPcGVyYXRpbmdTeXN0ZW0uTGludXg6IHJldHVybiAnbGludXgnO1xuXHRcdFx0Y2FzZSBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoOiByZXR1cm4gJ29zeCc7XG5cdFx0XHRjYXNlIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzOiByZXR1cm4gJ3dpbmRvd3MnO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2d1ZXNzUHJvZmlsZUljb24oc2hlbGw6IHN0cmluZyk6IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZmlsZSA9IHBhdGgucGFyc2Uoc2hlbGwpLm5hbWU7XG5cdFx0c3dpdGNoIChmaWxlKSB7XG5cdFx0XHRjYXNlICdiYXNoJzpcblx0XHRcdFx0cmV0dXJuIENvZGljb24udGVybWluYWxCYXNoO1xuXHRcdFx0Y2FzZSAncHdzaCc6XG5cdFx0XHRjYXNlICdwb3dlcnNoZWxsJzpcblx0XHRcdFx0cmV0dXJuIENvZGljb24udGVybWluYWxQb3dlcnNoZWxsO1xuXHRcdFx0Y2FzZSAndG11eCc6XG5cdFx0XHRcdHJldHVybiBDb2RpY29uLnRlcm1pbmFsVG11eDtcblx0XHRcdGNhc2UgJ2NtZCc6XG5cdFx0XHRcdHJldHVybiBDb2RpY29uLnRlcm1pbmFsQ21kO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9pc1ZhbGlkQXV0b21hdGlvblByb2ZpbGUocHJvZmlsZTogdW5rbm93biwgb3M6IE9wZXJhdGluZ1N5c3RlbSk6IHByb2ZpbGUgaXMgSVRlcm1pbmFsUHJvZmlsZSB7XG5cdFx0aWYgKHByb2ZpbGUgPT09IG51bGwgfHwgcHJvZmlsZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBwcm9maWxlICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoJ3BhdGgnIGluIHByb2ZpbGUgJiYgdHlwZW9mIChwcm9maWxlIGFzIHsgcGF0aDogdW5rbm93biB9KS5wYXRoID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQnJvd3NlclRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSBleHRlbmRzIEJhc2VUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2Uge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIaXN0b3J5U2VydmljZSBoaXN0b3J5U2VydmljZTogSUhpc3RvcnlTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElUZXJtaW5hbExvZ1NlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEluc3RhbmNlU2VydmljZSB0ZXJtaW5hbEluc3RhbmNlU2VydmljZTogSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxQcm9maWxlU2VydmljZSB0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlOiBJVGVybWluYWxQcm9maWxlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRnZXREZWZhdWx0U3lzdGVtU2hlbGw6IGFzeW5jIChyZW1vdGVBdXRob3JpdHksIG9zKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgYmFja2VuZCA9IGF3YWl0IHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmdldEJhY2tlbmQocmVtb3RlQXV0aG9yaXR5KTtcblx0XHRcdFx0XHRpZiAoIXJlbW90ZUF1dGhvcml0eSB8fCAhYmFja2VuZCkge1xuXHRcdFx0XHRcdFx0Ly8gSnVzdCByZXR1cm4gYmFzaWMgdmFsdWVzLCB0aGlzIGlzIG9ubHkgZm9yIHNlcnZlcmxlc3Mgd2ViIGFuZCB3b3VsZG4ndCBiZSB1c2VkXG5cdFx0XHRcdFx0XHRyZXR1cm4gb3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzID8gJ3B3c2gnIDogJ2Jhc2gnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gYmFja2VuZC5nZXREZWZhdWx0U3lzdGVtU2hlbGwob3MpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRFbnZpcm9ubWVudDogYXN5bmMgKHJlbW90ZUF1dGhvcml0eSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGJhY2tlbmQgPSBhd2FpdCB0ZXJtaW5hbEluc3RhbmNlU2VydmljZS5nZXRCYWNrZW5kKHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRcdFx0aWYgKCFyZW1vdGVBdXRob3JpdHkgfHwgIWJhY2tlbmQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBlbnY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBiYWNrZW5kLmdldEVudmlyb25tZW50KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdFx0XHRoaXN0b3J5U2VydmljZSxcblx0XHRcdGxvZ1NlcnZpY2UsXG5cdFx0XHR0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLFxuXHRcdFx0d29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0XHRyZW1vdGVBZ2VudFNlcnZpY2Vcblx0XHQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLFdBQVc7QUFDcEIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQ0FBa0Q7QUFDM0QsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBOEIsaUJBQWlCLFVBQVU7QUFDekQsU0FBNkIscUJBQXFELHlCQUF5QjtBQUMzRyxTQUE0RSwrQkFBK0I7QUFDM0csWUFBWSxVQUFVO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHVCQUFzQztBQUMvQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxrQkFBa0I7QUFPM0IsTUFBTSx1QkFBdUI7QUFNdEIsTUFBZSwyQ0FBMkMsV0FB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
