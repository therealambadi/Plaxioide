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
import { Codicon } from "../../../../base/common/codicons.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { TerminalSettingPrefix } from "../../../../platform/terminal/common/terminal.js";
import { getUriClasses, getColorClass, createColorStyleElement } from "./terminalIcon.js";
import { configureTerminalProfileIcon } from "./terminalIcons.js";
import * as nls from "../../../../nls.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ITerminalProfileResolverService, ITerminalProfileService } from "../common/terminal.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { basename } from "../../../../base/common/path.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
let TerminalProfileQuickpick = class {
  constructor(_terminalProfileService, _terminalProfileResolverService, _configurationService, _quickInputService, _themeService, _notificationService) {
    this._terminalProfileService = _terminalProfileService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._configurationService = _configurationService;
    this._quickInputService = _quickInputService;
    this._themeService = _themeService;
    this._notificationService = _notificationService;
  }
  async showAndGetResult(type) {
    const platformKey = await this._terminalProfileService.getPlatformKey();
    const profilesKey = TerminalSettingPrefix.Profiles + platformKey;
    const result = await this._createAndShow(type);
    const defaultProfileKey = `${TerminalSettingPrefix.DefaultProfile}${platformKey}`;
    if (!result) {
      return;
    }
    if (type === "setDefault") {
      if ("command" in result.profile) {
        return;
      } else if ("id" in result.profile) {
        await this._configurationService.updateValue(defaultProfileKey, result.profile.title, ConfigurationTarget.USER);
        return {
          config: {
            extensionIdentifier: result.profile.extensionIdentifier,
            id: result.profile.id,
            title: result.profile.title,
            options: {
              color: result.profile.color,
              icon: result.profile.icon
            }
          },
          keyMods: result.keyMods
        };
      }
      if ("isAutoDetected" in result.profile) {
        const profilesConfig = await this._configurationService.getValue(profilesKey);
        if (typeof profilesConfig === "object") {
          const newProfile = {
            path: result.profile.path
          };
          if (result.profile.args) {
            newProfile.args = result.profile.args;
          }
          profilesConfig[result.profile.profileName] = this._createNewProfileConfig(result.profile);
          await this._configurationService.updateValue(profilesKey, profilesConfig, ConfigurationTarget.USER);
        }
      }
      await this._configurationService.updateValue(defaultProfileKey, result.profileName, ConfigurationTarget.USER);
    } else if (type === "createInstance") {
      if ("id" in result.profile) {
        return {
          config: {
            extensionIdentifier: result.profile.extensionIdentifier,
            id: result.profile.id,
            title: result.profile.title,
            options: {
              icon: result.profile.icon,
              color: result.profile.color
            }
          },
          keyMods: result.keyMods
        };
      } else {
        return { config: result.profile, keyMods: result.keyMods };
      }
    }
    return "profileName" in result.profile ? result.profile.profileName : result.profile.title;
  }
  async _createAndShow(type) {
    const platformKey = await this._terminalProfileService.getPlatformKey();
    const profiles = this._terminalProfileService.availableProfiles;
    const profilesKey = TerminalSettingPrefix.Profiles + platformKey;
    const defaultProfileName = this._terminalProfileService.getDefaultProfileName();
    let keyMods;
    const options = {
      placeHolder: type === "createInstance" ? nls.localize("terminal.integrated.selectProfileToCreate", "Select the terminal profile to create") : nls.localize("terminal.integrated.chooseDefaultProfile", "Select your default terminal profile"),
      onDidTriggerItemButton: async (context) => {
        if (!await this._isProfileSafe(context.item.profile)) {
          return;
        }
        if ("command" in context.item.profile) {
          return;
        }
        if ("id" in context.item.profile) {
          return;
        }
        const configProfiles2 = this._configurationService.getValue(TerminalSettingPrefix.Profiles + platformKey);
        const existingProfiles = !!configProfiles2 ? Object.keys(configProfiles2) : [];
        const name = await this._quickInputService.input({
          prompt: nls.localize("enterTerminalProfileName", "Enter terminal profile name"),
          value: context.item.profile.profileName,
          validateInput: async (input) => {
            if (existingProfiles.includes(input)) {
              return nls.localize("terminalProfileAlreadyExists", "A terminal profile already exists with that name");
            }
            return void 0;
          }
        });
        if (!name) {
          return;
        }
        const newConfigValue = {
          ...configProfiles2,
          [name]: this._createNewProfileConfig(context.item.profile)
        };
        await this._configurationService.updateValue(profilesKey, newConfigValue, ConfigurationTarget.USER);
      },
      onKeyMods: (mods) => keyMods = mods
    };
    const quickPickItems = [];
    const configProfiles = profiles.filter((e) => !e.isAutoDetected);
    const autoDetectedProfiles = profiles.filter((e) => e.isAutoDetected);
    if (configProfiles.length > 0) {
      quickPickItems.push({ type: "separator", label: nls.localize("terminalProfiles", "profiles") });
      quickPickItems.push(...this._sortProfileQuickPickItems(configProfiles.map((e) => this._createProfileQuickPickItem(e)), defaultProfileName));
    }
    quickPickItems.push({ type: "separator", label: nls.localize("ICreateContributedTerminalProfileOptions", "contributed") });
    const contributedProfiles = [];
    for (const contributed of this._terminalProfileService.contributedProfiles) {
      let icon;
      if (typeof contributed.icon === "string") {
        if (contributed.icon.startsWith("$(")) {
          icon = ThemeIcon.fromString(contributed.icon);
        } else {
          icon = ThemeIcon.fromId(contributed.icon);
        }
      }
      if (!icon || !getIconRegistry().getIcon(icon.id)) {
        icon = this._terminalProfileResolverService.getDefaultIcon();
      }
      const uriClasses = getUriClasses(contributed, this._themeService.getColorTheme().type, true);
      const colorClass = getColorClass(contributed);
      const iconClasses = [];
      if (uriClasses) {
        iconClasses.push(...uriClasses);
      }
      if (colorClass) {
        iconClasses.push(colorClass);
      }
      contributedProfiles.push({
        label: `$(${icon.id}) ${contributed.title}`,
        profile: {
          extensionIdentifier: contributed.extensionIdentifier,
          title: contributed.title,
          icon: contributed.icon,
          id: contributed.id,
          color: contributed.color
        },
        profileName: contributed.title,
        iconClasses
      });
    }
    if (contributedProfiles.length > 0) {
      quickPickItems.push(...this._sortProfileQuickPickItems(contributedProfiles, defaultProfileName));
    }
    if (autoDetectedProfiles.length > 0) {
      quickPickItems.push({ type: "separator", label: nls.localize("terminalProfiles.detected", "detected") });
      quickPickItems.push(...this._sortProfileQuickPickItems(autoDetectedProfiles.map((e) => this._createProfileQuickPickItem(e)), defaultProfileName));
    }
    const colorStyleDisposable = createColorStyleElement(this._themeService.getColorTheme());
    const result = await this._quickInputService.pick(quickPickItems, options);
    colorStyleDisposable.dispose();
    if (!result) {
      return void 0;
    }
    if (!await this._isProfileSafe(result.profile)) {
      return void 0;
    }
    if (keyMods) {
      result.keyMods = keyMods;
    }
    return result;
  }
  _createNewProfileConfig(profile) {
    const result = { path: profile.path };
    if (profile.args) {
      result.args = profile.args;
    }
    if (profile.env) {
      result.env = profile.env;
    }
    return result;
  }
  async _isProfileSafe(profile) {
    const isUnsafePath = "isUnsafePath" in profile && profile.isUnsafePath;
    const requiresUnsafePath = "requiresUnsafePath" in profile && profile.requiresUnsafePath;
    if (!isUnsafePath && !requiresUnsafePath) {
      return true;
    }
    return await new Promise((r) => {
      const unsafePaths = [];
      if (isUnsafePath) {
        unsafePaths.push(profile.path);
      }
      if (requiresUnsafePath) {
        unsafePaths.push(requiresUnsafePath);
      }
      const handle = this._notificationService.prompt(
        Severity.Warning,
        nls.localize("unsafePathWarning", "This terminal profile uses a potentially unsafe path that can be modified by another user: {0}. Are you sure you want to use it?", `"${unsafePaths.join(",")}"`),
        [{
          label: nls.localize("yes", "Yes"),
          run: () => r(true)
        }, {
          label: nls.localize("cancel", "Cancel"),
          run: () => r(false)
        }]
      );
      handle.onDidClose(() => r(false));
    });
  }
  _createProfileQuickPickItem(profile) {
    const buttons = [{
      iconClass: ThemeIcon.asClassName(configureTerminalProfileIcon),
      tooltip: nls.localize("createQuickLaunchProfile", "Configure Terminal Profile")
    }];
    const icon = profile.icon && ThemeIcon.isThemeIcon(profile.icon) ? profile.icon : Codicon.terminal;
    const label = `$(${icon.id}) ${profile.profileName}`;
    const friendlyPath = profile.isFromPath ? basename(profile.path) : profile.path;
    const colorClass = getColorClass(profile);
    const iconClasses = [];
    if (colorClass) {
      iconClasses.push(colorClass);
    }
    if (profile.args) {
      if (typeof profile.args === "string") {
        return { label, description: `${profile.path} ${profile.args}`, profile, profileName: profile.profileName, buttons, iconClasses };
      }
      const argsString = profile.args.map((e) => {
        if (e.includes(" ")) {
          return `"${e.replace(/"/g, '\\"')}"`;
        }
        return e;
      }).join(" ");
      return { label, description: `${friendlyPath} ${argsString}`, profile, profileName: profile.profileName, buttons, iconClasses };
    }
    return { label, description: friendlyPath, profile, profileName: profile.profileName, buttons, iconClasses };
  }
  _sortProfileQuickPickItems(items, defaultProfileName) {
    return items.sort((a, b) => {
      if (b.profileName === defaultProfileName) {
        return 1;
      }
      if (a.profileName === defaultProfileName) {
        return -1;
      }
      return a.profileName.localeCompare(b.profileName);
    });
  }
};
TerminalProfileQuickpick = __decorateClass([
  __decorateParam(0, ITerminalProfileService),
  __decorateParam(1, ITerminalProfileResolverService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, INotificationService)
], TerminalProfileQuickpick);
export {
  TerminalProfileQuickpick
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUHJvZmlsZVF1aWNrcGljay50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSUtleU1vZHMsIElQaWNrT3B0aW9ucywgSVF1aWNrUGlja1NlcGFyYXRvciwgSVF1aWNrSW5wdXRCdXR0b24sIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlLCBJVGVybWluYWxQcm9maWxlLCBJVGVybWluYWxQcm9maWxlT2JqZWN0LCBUZXJtaW5hbFNldHRpbmdQcmVmaXgsIHR5cGUgSVRlcm1pbmFsRXhlY3V0YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBnZXRVcmlDbGFzc2VzLCBnZXRDb2xvckNsYXNzLCBjcmVhdGVDb2xvclN0eWxlRWxlbWVudCB9IGZyb20gJy4vdGVybWluYWxJY29uLmpzJztcbmltcG9ydCB7IGNvbmZpZ3VyZVRlcm1pbmFsUHJvZmlsZUljb24gfSBmcm9tICcuL3Rlcm1pbmFsSWNvbnMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSwgSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVF1aWNrUGlja1Rlcm1pbmFsT2JqZWN0LCBJVGVybWluYWxJbnN0YW5jZSB9IGZyb20gJy4vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVBpY2tlclF1aWNrQWNjZXNzSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci9waWNrZXJRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBnZXRJY29uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5cblxudHlwZSBEZWZhdWx0UHJvZmlsZU5hbWUgPSBzdHJpbmc7XG5leHBvcnQgY2xhc3MgVGVybWluYWxQcm9maWxlUXVpY2twaWNrIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZTogSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9xdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2Vcblx0KSB7IH1cblxuXHRhc3luYyBzaG93QW5kR2V0UmVzdWx0KHR5cGU6ICdzZXREZWZhdWx0JyB8ICdjcmVhdGVJbnN0YW5jZScpOiBQcm9taXNlPElRdWlja1BpY2tUZXJtaW5hbE9iamVjdCB8IERlZmF1bHRQcm9maWxlTmFtZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHBsYXRmb3JtS2V5ID0gYXdhaXQgdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5nZXRQbGF0Zm9ybUtleSgpO1xuXHRcdGNvbnN0IHByb2ZpbGVzS2V5ID0gVGVybWluYWxTZXR0aW5nUHJlZml4LlByb2ZpbGVzICsgcGxhdGZvcm1LZXk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fY3JlYXRlQW5kU2hvdyh0eXBlKTtcblx0XHRjb25zdCBkZWZhdWx0UHJvZmlsZUtleSA9IGAke1Rlcm1pbmFsU2V0dGluZ1ByZWZpeC5EZWZhdWx0UHJvZmlsZX0ke3BsYXRmb3JtS2V5fWA7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHR5cGUgPT09ICdzZXREZWZhdWx0Jykge1xuXHRcdFx0aWYgKCdjb21tYW5kJyBpbiByZXN1bHQucHJvZmlsZSkge1xuXHRcdFx0XHRyZXR1cm47IC8vIFNob3VsZCBuZXZlciBoYXBwZW5cblx0XHRcdH0gZWxzZSBpZiAoJ2lkJyBpbiByZXN1bHQucHJvZmlsZSkge1xuXHRcdFx0XHQvLyBleHRlbnNpb24gY29udHJpYnV0ZWQgcHJvZmlsZVxuXHRcdFx0XHRhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShkZWZhdWx0UHJvZmlsZUtleSwgcmVzdWx0LnByb2ZpbGUudGl0bGUsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Y29uZmlnOiB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb25JZGVudGlmaWVyOiByZXN1bHQucHJvZmlsZS5leHRlbnNpb25JZGVudGlmaWVyLFxuXHRcdFx0XHRcdFx0aWQ6IHJlc3VsdC5wcm9maWxlLmlkLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHJlc3VsdC5wcm9maWxlLnRpdGxlLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRjb2xvcjogcmVzdWx0LnByb2ZpbGUuY29sb3IsXG5cdFx0XHRcdFx0XHRcdGljb246IHJlc3VsdC5wcm9maWxlLmljb25cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGtleU1vZHM6IHJlc3VsdC5rZXlNb2RzXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFkZCB0aGUgcHJvZmlsZSB0byBzZXR0aW5ncyBpZiBuZWNlc3Nhcnlcblx0XHRcdGlmICgnaXNBdXRvRGV0ZWN0ZWQnIGluIHJlc3VsdC5wcm9maWxlKSB7XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGVzQ29uZmlnID0gYXdhaXQgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUocHJvZmlsZXNLZXkpO1xuXHRcdFx0XHRpZiAodHlwZW9mIHByb2ZpbGVzQ29uZmlnID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRcdGNvbnN0IG5ld1Byb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGVPYmplY3QgPSB7XG5cdFx0XHRcdFx0XHRwYXRoOiByZXN1bHQucHJvZmlsZS5wYXRoXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRpZiAocmVzdWx0LnByb2ZpbGUuYXJncykge1xuXHRcdFx0XHRcdFx0bmV3UHJvZmlsZS5hcmdzID0gcmVzdWx0LnByb2ZpbGUuYXJncztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0KHByb2ZpbGVzQ29uZmlnIGFzIHsgW2tleTogc3RyaW5nXTogSVRlcm1pbmFsUHJvZmlsZU9iamVjdCB9KVtyZXN1bHQucHJvZmlsZS5wcm9maWxlTmFtZV0gPSB0aGlzLl9jcmVhdGVOZXdQcm9maWxlQ29uZmlnKHJlc3VsdC5wcm9maWxlKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShwcm9maWxlc0tleSwgcHJvZmlsZXNDb25maWcsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIFNldCB0aGUgZGVmYXVsdCBwcm9maWxlXG5cdFx0XHRhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShkZWZhdWx0UHJvZmlsZUtleSwgcmVzdWx0LnByb2ZpbGVOYW1lLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gJ2NyZWF0ZUluc3RhbmNlJykge1xuXHRcdFx0aWYgKCdpZCcgaW4gcmVzdWx0LnByb2ZpbGUpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjb25maWc6IHtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbklkZW50aWZpZXI6IHJlc3VsdC5wcm9maWxlLmV4dGVuc2lvbklkZW50aWZpZXIsXG5cdFx0XHRcdFx0XHRpZDogcmVzdWx0LnByb2ZpbGUuaWQsXG5cdFx0XHRcdFx0XHR0aXRsZTogcmVzdWx0LnByb2ZpbGUudGl0bGUsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdGljb246IHJlc3VsdC5wcm9maWxlLmljb24sXG5cdFx0XHRcdFx0XHRcdGNvbG9yOiByZXN1bHQucHJvZmlsZS5jb2xvcixcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGtleU1vZHM6IHJlc3VsdC5rZXlNb2RzXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyBjb25maWc6IHJlc3VsdC5wcm9maWxlLCBrZXlNb2RzOiByZXN1bHQua2V5TW9kcyB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBmb3IgdGVzdHNcblx0XHRyZXR1cm4gJ3Byb2ZpbGVOYW1lJyBpbiByZXN1bHQucHJvZmlsZSA/IHJlc3VsdC5wcm9maWxlLnByb2ZpbGVOYW1lIDogcmVzdWx0LnByb2ZpbGUudGl0bGU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVBbmRTaG93KHR5cGU6ICdzZXREZWZhdWx0JyB8ICdjcmVhdGVJbnN0YW5jZScpOiBQcm9taXNlPElQcm9maWxlUXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHBsYXRmb3JtS2V5ID0gYXdhaXQgdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5nZXRQbGF0Zm9ybUtleSgpO1xuXHRcdGNvbnN0IHByb2ZpbGVzID0gdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5hdmFpbGFibGVQcm9maWxlcztcblx0XHRjb25zdCBwcm9maWxlc0tleSA9IFRlcm1pbmFsU2V0dGluZ1ByZWZpeC5Qcm9maWxlcyArIHBsYXRmb3JtS2V5O1xuXHRcdGNvbnN0IGRlZmF1bHRQcm9maWxlTmFtZSA9IHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UuZ2V0RGVmYXVsdFByb2ZpbGVOYW1lKCk7XG5cdFx0bGV0IGtleU1vZHM6IElLZXlNb2RzIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG9wdGlvbnM6IElQaWNrT3B0aW9uczxJUHJvZmlsZVF1aWNrUGlja0l0ZW0+ID0ge1xuXHRcdFx0cGxhY2VIb2xkZXI6IHR5cGUgPT09ICdjcmVhdGVJbnN0YW5jZScgPyBubHMubG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuc2VsZWN0UHJvZmlsZVRvQ3JlYXRlJywgXCJTZWxlY3QgdGhlIHRlcm1pbmFsIHByb2ZpbGUgdG8gY3JlYXRlXCIpIDogbmxzLmxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmNob29zZURlZmF1bHRQcm9maWxlJywgXCJTZWxlY3QgeW91ciBkZWZhdWx0IHRlcm1pbmFsIHByb2ZpbGVcIiksXG5cdFx0XHRvbkRpZFRyaWdnZXJJdGVtQnV0dG9uOiBhc3luYyAoY29udGV4dCkgPT4ge1xuXHRcdFx0XHQvLyBHZXQgdGhlIHVzZXIncyBleHBsaWNpdCBwZXJtaXNzaW9uIHRvIHVzZSBhIHBvdGVudGlhbGx5IHVuc2FmZSBwYXRoXG5cdFx0XHRcdGlmICghYXdhaXQgdGhpcy5faXNQcm9maWxlU2FmZShjb250ZXh0Lml0ZW0ucHJvZmlsZSkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCdjb21tYW5kJyBpbiBjb250ZXh0Lml0ZW0ucHJvZmlsZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoJ2lkJyBpbiBjb250ZXh0Lml0ZW0ucHJvZmlsZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjb25maWdQcm9maWxlczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ1ByZWZpeC5Qcm9maWxlcyArIHBsYXRmb3JtS2V5KTtcblx0XHRcdFx0Y29uc3QgZXhpc3RpbmdQcm9maWxlcyA9ICEhY29uZmlnUHJvZmlsZXMgPyBPYmplY3Qua2V5cyhjb25maWdQcm9maWxlcykgOiBbXTtcblx0XHRcdFx0Y29uc3QgbmFtZSA9IGF3YWl0IHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmlucHV0KHtcblx0XHRcdFx0XHRwcm9tcHQ6IG5scy5sb2NhbGl6ZSgnZW50ZXJUZXJtaW5hbFByb2ZpbGVOYW1lJywgXCJFbnRlciB0ZXJtaW5hbCBwcm9maWxlIG5hbWVcIiksXG5cdFx0XHRcdFx0dmFsdWU6IGNvbnRleHQuaXRlbS5wcm9maWxlLnByb2ZpbGVOYW1lLFxuXHRcdFx0XHRcdHZhbGlkYXRlSW5wdXQ6IGFzeW5jIGlucHV0ID0+IHtcblx0XHRcdFx0XHRcdGlmIChleGlzdGluZ1Byb2ZpbGVzLmluY2x1ZGVzKGlucHV0KSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCd0ZXJtaW5hbFByb2ZpbGVBbHJlYWR5RXhpc3RzJywgXCJBIHRlcm1pbmFsIHByb2ZpbGUgYWxyZWFkeSBleGlzdHMgd2l0aCB0aGF0IG5hbWVcIik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmICghbmFtZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBuZXdDb25maWdWYWx1ZTogeyBba2V5OiBzdHJpbmddOiBJVGVybWluYWxFeGVjdXRhYmxlIH0gPSB7XG5cdFx0XHRcdFx0Li4uY29uZmlnUHJvZmlsZXMsXG5cdFx0XHRcdFx0W25hbWVdOiB0aGlzLl9jcmVhdGVOZXdQcm9maWxlQ29uZmlnKGNvbnRleHQuaXRlbS5wcm9maWxlKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShwcm9maWxlc0tleSwgbmV3Q29uZmlnVmFsdWUsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdFx0XHR9LFxuXHRcdFx0b25LZXlNb2RzOiBtb2RzID0+IGtleU1vZHMgPSBtb2RzXG5cdFx0fTtcblxuXHRcdC8vIEJ1aWxkIHF1aWNrIHBpY2sgaXRlbXNcblx0XHRjb25zdCBxdWlja1BpY2tJdGVtczogKElQcm9maWxlUXVpY2tQaWNrSXRlbSB8IElRdWlja1BpY2tTZXBhcmF0b3IpW10gPSBbXTtcblx0XHRjb25zdCBjb25maWdQcm9maWxlcyA9IHByb2ZpbGVzLmZpbHRlcihlID0+ICFlLmlzQXV0b0RldGVjdGVkKTtcblx0XHRjb25zdCBhdXRvRGV0ZWN0ZWRQcm9maWxlcyA9IHByb2ZpbGVzLmZpbHRlcihlID0+IGUuaXNBdXRvRGV0ZWN0ZWQpO1xuXG5cdFx0aWYgKGNvbmZpZ1Byb2ZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IG5scy5sb2NhbGl6ZSgndGVybWluYWxQcm9maWxlcycsIFwicHJvZmlsZXNcIikgfSk7XG5cdFx0XHRxdWlja1BpY2tJdGVtcy5wdXNoKC4uLnRoaXMuX3NvcnRQcm9maWxlUXVpY2tQaWNrSXRlbXMoY29uZmlnUHJvZmlsZXMubWFwKGUgPT4gdGhpcy5fY3JlYXRlUHJvZmlsZVF1aWNrUGlja0l0ZW0oZSkpLCBkZWZhdWx0UHJvZmlsZU5hbWUhKSk7XG5cdFx0fVxuXG5cdFx0cXVpY2tQaWNrSXRlbXMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbmxzLmxvY2FsaXplKCdJQ3JlYXRlQ29udHJpYnV0ZWRUZXJtaW5hbFByb2ZpbGVPcHRpb25zJywgXCJjb250cmlidXRlZFwiKSB9KTtcblx0XHRjb25zdCBjb250cmlidXRlZFByb2ZpbGVzOiBJUHJvZmlsZVF1aWNrUGlja0l0ZW1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY29udHJpYnV0ZWQgb2YgdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5jb250cmlidXRlZFByb2ZpbGVzKSB7XG5cdFx0XHRsZXQgaWNvbjogVGhlbWVJY29uIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHR5cGVvZiBjb250cmlidXRlZC5pY29uID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRpZiAoY29udHJpYnV0ZWQuaWNvbi5zdGFydHNXaXRoKCckKCcpKSB7XG5cdFx0XHRcdFx0aWNvbiA9IFRoZW1lSWNvbi5mcm9tU3RyaW5nKGNvbnRyaWJ1dGVkLmljb24pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGljb24gPSBUaGVtZUljb24uZnJvbUlkKGNvbnRyaWJ1dGVkLmljb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWljb24gfHwgIWdldEljb25SZWdpc3RyeSgpLmdldEljb24oaWNvbi5pZCkpIHtcblx0XHRcdFx0aWNvbiA9IHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZS5nZXREZWZhdWx0SWNvbigpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdXJpQ2xhc3NlcyA9IGdldFVyaUNsYXNzZXMoY29udHJpYnV0ZWQsIHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkudHlwZSwgdHJ1ZSk7XG5cdFx0XHRjb25zdCBjb2xvckNsYXNzID0gZ2V0Q29sb3JDbGFzcyhjb250cmlidXRlZCk7XG5cdFx0XHRjb25zdCBpY29uQ2xhc3NlcyA9IFtdO1xuXHRcdFx0aWYgKHVyaUNsYXNzZXMpIHtcblx0XHRcdFx0aWNvbkNsYXNzZXMucHVzaCguLi51cmlDbGFzc2VzKTtcblx0XHRcdH1cblx0XHRcdGlmIChjb2xvckNsYXNzKSB7XG5cdFx0XHRcdGljb25DbGFzc2VzLnB1c2goY29sb3JDbGFzcyk7XG5cdFx0XHR9XG5cdFx0XHRjb250cmlidXRlZFByb2ZpbGVzLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogYCQoJHtpY29uLmlkfSkgJHtjb250cmlidXRlZC50aXRsZX1gLFxuXHRcdFx0XHRwcm9maWxlOiB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSWRlbnRpZmllcjogY29udHJpYnV0ZWQuZXh0ZW5zaW9uSWRlbnRpZmllcixcblx0XHRcdFx0XHR0aXRsZTogY29udHJpYnV0ZWQudGl0bGUsXG5cdFx0XHRcdFx0aWNvbjogY29udHJpYnV0ZWQuaWNvbixcblx0XHRcdFx0XHRpZDogY29udHJpYnV0ZWQuaWQsXG5cdFx0XHRcdFx0Y29sb3I6IGNvbnRyaWJ1dGVkLmNvbG9yXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHByb2ZpbGVOYW1lOiBjb250cmlidXRlZC50aXRsZSxcblx0XHRcdFx0aWNvbkNsYXNzZXNcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChjb250cmlidXRlZFByb2ZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goLi4udGhpcy5fc29ydFByb2ZpbGVRdWlja1BpY2tJdGVtcyhjb250cmlidXRlZFByb2ZpbGVzLCBkZWZhdWx0UHJvZmlsZU5hbWUhKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGF1dG9EZXRlY3RlZFByb2ZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IG5scy5sb2NhbGl6ZSgndGVybWluYWxQcm9maWxlcy5kZXRlY3RlZCcsIFwiZGV0ZWN0ZWRcIikgfSk7XG5cdFx0XHRxdWlja1BpY2tJdGVtcy5wdXNoKC4uLnRoaXMuX3NvcnRQcm9maWxlUXVpY2tQaWNrSXRlbXMoYXV0b0RldGVjdGVkUHJvZmlsZXMubWFwKGUgPT4gdGhpcy5fY3JlYXRlUHJvZmlsZVF1aWNrUGlja0l0ZW0oZSkpLCBkZWZhdWx0UHJvZmlsZU5hbWUhKSk7XG5cdFx0fVxuXHRcdGNvbnN0IGNvbG9yU3R5bGVEaXNwb3NhYmxlID0gY3JlYXRlQ29sb3JTdHlsZUVsZW1lbnQodGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9xdWlja0lucHV0U2VydmljZS5waWNrKHF1aWNrUGlja0l0ZW1zLCBvcHRpb25zKTtcblx0XHRjb2xvclN0eWxlRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghYXdhaXQgdGhpcy5faXNQcm9maWxlU2FmZShyZXN1bHQucHJvZmlsZSkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChrZXlNb2RzKSB7XG5cdFx0XHRyZXN1bHQua2V5TW9kcyA9IGtleU1vZHM7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVOZXdQcm9maWxlQ29uZmlnKHByb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGUpOiBJVGVybWluYWxFeGVjdXRhYmxlIHtcblx0XHRjb25zdCByZXN1bHQ6IElUZXJtaW5hbEV4ZWN1dGFibGUgPSB7IHBhdGg6IHByb2ZpbGUucGF0aCB9O1xuXHRcdGlmIChwcm9maWxlLmFyZ3MpIHtcblx0XHRcdHJlc3VsdC5hcmdzID0gcHJvZmlsZS5hcmdzO1xuXHRcdH1cblx0XHRpZiAocHJvZmlsZS5lbnYpIHtcblx0XHRcdHJlc3VsdC5lbnYgPSBwcm9maWxlLmVudjtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2lzUHJvZmlsZVNhZmUocHJvZmlsZTogSVRlcm1pbmFsUHJvZmlsZSB8IElFeHRlbnNpb25UZXJtaW5hbFByb2ZpbGUpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBpc1Vuc2FmZVBhdGggPSAnaXNVbnNhZmVQYXRoJyBpbiBwcm9maWxlICYmIHByb2ZpbGUuaXNVbnNhZmVQYXRoO1xuXHRcdGNvbnN0IHJlcXVpcmVzVW5zYWZlUGF0aCA9ICdyZXF1aXJlc1Vuc2FmZVBhdGgnIGluIHByb2ZpbGUgJiYgcHJvZmlsZS5yZXF1aXJlc1Vuc2FmZVBhdGg7XG5cdFx0aWYgKCFpc1Vuc2FmZVBhdGggJiYgIXJlcXVpcmVzVW5zYWZlUGF0aCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gR2V0IHRoZSB1c2VyJ3MgZXhwbGljaXQgcGVybWlzc2lvbiB0byB1c2UgYSBwb3RlbnRpYWxseSB1bnNhZmUgcGF0aFxuXHRcdHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPihyID0+IHtcblx0XHRcdGNvbnN0IHVuc2FmZVBhdGhzID0gW107XG5cdFx0XHRpZiAoaXNVbnNhZmVQYXRoKSB7XG5cdFx0XHRcdHVuc2FmZVBhdGhzLnB1c2gocHJvZmlsZS5wYXRoKTtcblx0XHRcdH1cblx0XHRcdGlmIChyZXF1aXJlc1Vuc2FmZVBhdGgpIHtcblx0XHRcdFx0dW5zYWZlUGF0aHMucHVzaChyZXF1aXJlc1Vuc2FmZVBhdGgpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gTm90aWZ5IGFib3V0IHVuc2FmZSBwYXRoKHMpLiBBdCB0aGUgdGltZSBvZiB3cml0aW5nLCBtdWx0aXBsZSB1bnNhZmUgcGF0aHMgaXNuJ3Rcblx0XHRcdC8vIHBvc3NpYmxlIHNvIHRoZSBtZXNzYWdlIGlzIG9wdGltaXplZCBmb3IgYSBzaW5nbGUgcGF0aC5cblx0XHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3Vuc2FmZVBhdGhXYXJuaW5nJywgJ1RoaXMgdGVybWluYWwgcHJvZmlsZSB1c2VzIGEgcG90ZW50aWFsbHkgdW5zYWZlIHBhdGggdGhhdCBjYW4gYmUgbW9kaWZpZWQgYnkgYW5vdGhlciB1c2VyOiB7MH0uIEFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byB1c2UgaXQ/JywgYFwiJHt1bnNhZmVQYXRocy5qb2luKCcsJyl9XCJgKSxcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCd5ZXMnLCAnWWVzJyksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiByKHRydWUpXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdjYW5jZWwnLCAnQ2FuY2VsJyksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiByKGZhbHNlKVxuXHRcdFx0XHR9XVxuXHRcdFx0KTtcblx0XHRcdGhhbmRsZS5vbkRpZENsb3NlKCgpID0+IHIoZmFsc2UpKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVByb2ZpbGVRdWlja1BpY2tJdGVtKHByb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGUpOiBJUHJvZmlsZVF1aWNrUGlja0l0ZW0ge1xuXHRcdGNvbnN0IGJ1dHRvbnM6IElRdWlja0lucHV0QnV0dG9uW10gPSBbe1xuXHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoY29uZmlndXJlVGVybWluYWxQcm9maWxlSWNvbiksXG5cdFx0XHR0b29sdGlwOiBubHMubG9jYWxpemUoJ2NyZWF0ZVF1aWNrTGF1bmNoUHJvZmlsZScsIFwiQ29uZmlndXJlIFRlcm1pbmFsIFByb2ZpbGVcIilcblx0XHR9XTtcblx0XHRjb25zdCBpY29uID0gKHByb2ZpbGUuaWNvbiAmJiBUaGVtZUljb24uaXNUaGVtZUljb24ocHJvZmlsZS5pY29uKSkgPyBwcm9maWxlLmljb24gOiBDb2RpY29uLnRlcm1pbmFsO1xuXHRcdGNvbnN0IGxhYmVsID0gYCQoJHtpY29uLmlkfSkgJHtwcm9maWxlLnByb2ZpbGVOYW1lfWA7XG5cdFx0Y29uc3QgZnJpZW5kbHlQYXRoID0gcHJvZmlsZS5pc0Zyb21QYXRoID8gYmFzZW5hbWUocHJvZmlsZS5wYXRoKSA6IHByb2ZpbGUucGF0aDtcblx0XHRjb25zdCBjb2xvckNsYXNzID0gZ2V0Q29sb3JDbGFzcyhwcm9maWxlKTtcblx0XHRjb25zdCBpY29uQ2xhc3NlcyA9IFtdO1xuXHRcdGlmIChjb2xvckNsYXNzKSB7XG5cdFx0XHRpY29uQ2xhc3Nlcy5wdXNoKGNvbG9yQ2xhc3MpO1xuXHRcdH1cblxuXHRcdGlmIChwcm9maWxlLmFyZ3MpIHtcblx0XHRcdGlmICh0eXBlb2YgcHJvZmlsZS5hcmdzID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRyZXR1cm4geyBsYWJlbCwgZGVzY3JpcHRpb246IGAke3Byb2ZpbGUucGF0aH0gJHtwcm9maWxlLmFyZ3N9YCwgcHJvZmlsZSwgcHJvZmlsZU5hbWU6IHByb2ZpbGUucHJvZmlsZU5hbWUsIGJ1dHRvbnMsIGljb25DbGFzc2VzIH07XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBhcmdzU3RyaW5nID0gcHJvZmlsZS5hcmdzLm1hcChlID0+IHtcblx0XHRcdFx0aWYgKGUuaW5jbHVkZXMoJyAnKSkge1xuXHRcdFx0XHRcdHJldHVybiBgXCIke2UucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpfVwiYDsgLy8gQ29kZVFMIFtTTTAyMzgzXSBqcy9pbmNvbXBsZXRlLXNhbml0aXphdGlvbiBUaGlzIGlzIG9ubHkgdXNlZCBhcyBhIGxhYmVsIG9uIHRoZSBVSSBzbyB0aGlzIGlzbid0IGEgcHJvYmxlbVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBlO1xuXHRcdFx0fSkuam9pbignICcpO1xuXHRcdFx0cmV0dXJuIHsgbGFiZWwsIGRlc2NyaXB0aW9uOiBgJHtmcmllbmRseVBhdGh9ICR7YXJnc1N0cmluZ31gLCBwcm9maWxlLCBwcm9maWxlTmFtZTogcHJvZmlsZS5wcm9maWxlTmFtZSwgYnV0dG9ucywgaWNvbkNsYXNzZXMgfTtcblx0XHR9XG5cdFx0cmV0dXJuIHsgbGFiZWwsIGRlc2NyaXB0aW9uOiBmcmllbmRseVBhdGgsIHByb2ZpbGUsIHByb2ZpbGVOYW1lOiBwcm9maWxlLnByb2ZpbGVOYW1lLCBidXR0b25zLCBpY29uQ2xhc3NlcyB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfc29ydFByb2ZpbGVRdWlja1BpY2tJdGVtcyhpdGVtczogSVByb2ZpbGVRdWlja1BpY2tJdGVtW10sIGRlZmF1bHRQcm9maWxlTmFtZTogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGlmIChiLnByb2ZpbGVOYW1lID09PSBkZWZhdWx0UHJvZmlsZU5hbWUpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYS5wcm9maWxlTmFtZSA9PT0gZGVmYXVsdFByb2ZpbGVOYW1lKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhLnByb2ZpbGVOYW1lLmxvY2FsZUNvbXBhcmUoYi5wcm9maWxlTmFtZSk7XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJvZmlsZVF1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdHByb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGUgfCBJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlO1xuXHRwcm9maWxlTmFtZTogc3RyaW5nO1xuXHRrZXlNb2RzPzogSUtleU1vZHMgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlcm1pbmFsUXVpY2tQaWNrSXRlbSBleHRlbmRzIElQaWNrZXJRdWlja0FjY2Vzc0l0ZW0ge1xuXHR0ZXJtaW5hbDogSVRlcm1pbmFsSW5zdGFuY2U7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLHFCQUFxQiw2QkFBNkI7QUFDM0QsU0FBUywwQkFBMEc7QUFDbkgsU0FBOEUsNkJBQXVEO0FBQ3JJLFNBQVMsZUFBZSxlQUFlLCtCQUErQjtBQUN0RSxTQUFTLG9DQUFvQztBQUM3QyxZQUFZLFNBQVM7QUFDckIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxpQ0FBaUMsK0JBQStCO0FBR3pFLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUl4QyxJQUFNLDJCQUFOLE1BQStCO0FBQUEsRUFDckMsWUFDMkMseUJBQ1EsaUNBQ1YsdUJBQ0gsb0JBQ0wsZUFDTyxzQkFDdEM7QUFOeUM7QUFDUTtBQUNWO0FBQ0g7QUFDTDtBQUNPO0FBQUEsRUFDcEM7QUFBQSxFQUVKLE1BQU0saUJBQWlCLE1BQTJHO0FBQ2pJLFVBQU0sY0FBYyxNQUFNLEtBQUssd0JBQXdCLGVBQWU7QUFDdEUsVUFBTSxjQUFjLHNCQUFzQixXQUFXO0FBQ3JELFVBQU0sU0FBUyxNQUFNLEtBQUssZUFBZSxJQUFJO0FBQzdDLFVBQU0sb0JBQW9CLEdBQUcsc0JBQXNCLGNBQWMsR0FBRyxXQUFXO0FBQy9FLFFBQUksQ0FBQyxRQUFRO0FBQ1o7QUFBQSxJQUNEO0FBQ0EsUUFBSSxTQUFTLGNBQWM7QUFDMUIsVUFBSSxhQUFhLE9BQU8sU0FBUztBQUNoQztBQUFBLE1BQ0QsV0FBVyxRQUFRLE9BQU8sU0FBUztBQUVsQyxjQUFNLEtBQUssc0JBQXNCLFlBQVksbUJBQW1CLE9BQU8sUUFBUSxPQUFPLG9CQUFvQixJQUFJO0FBQzlHLGVBQU87QUFBQSxVQUNOLFFBQVE7QUFBQSxZQUNQLHFCQUFxQixPQUFPLFFBQVE7QUFBQSxZQUNwQyxJQUFJLE9BQU8sUUFBUTtBQUFBLFlBQ25CLE9BQU8sT0FBTyxRQUFRO0FBQUEsWUFDdEIsU0FBUztBQUFBLGNBQ1IsT0FBTyxPQUFPLFFBQVE7QUFBQSxjQUN0QixNQUFNLE9BQU8sUUFBUTtBQUFBLFlBQ3RCO0FBQUEsVUFDRDtBQUFBLFVBQ0EsU0FBUyxPQUFPO0FBQUEsUUFDakI7QUFBQSxNQUNEO0FBR0EsVUFBSSxvQkFBb0IsT0FBTyxTQUFTO0FBQ3ZDLGNBQU0saUJBQWlCLE1BQU0sS0FBSyxzQkFBc0IsU0FBUyxXQUFXO0FBQzVFLFlBQUksT0FBTyxtQkFBbUIsVUFBVTtBQUN2QyxnQkFBTSxhQUFxQztBQUFBLFlBQzFDLE1BQU0sT0FBTyxRQUFRO0FBQUEsVUFDdEI7QUFDQSxjQUFJLE9BQU8sUUFBUSxNQUFNO0FBQ3hCLHVCQUFXLE9BQU8sT0FBTyxRQUFRO0FBQUEsVUFDbEM7QUFDQSxVQUFDLGVBQTZELE9BQU8sUUFBUSxXQUFXLElBQUksS0FBSyx3QkFBd0IsT0FBTyxPQUFPO0FBQ3ZJLGdCQUFNLEtBQUssc0JBQXNCLFlBQVksYUFBYSxnQkFBZ0Isb0JBQW9CLElBQUk7QUFBQSxRQUNuRztBQUFBLE1BQ0Q7QUFFQSxZQUFNLEtBQUssc0JBQXNCLFlBQVksbUJBQW1CLE9BQU8sYUFBYSxvQkFBb0IsSUFBSTtBQUFBLElBQzdHLFdBQVcsU0FBUyxrQkFBa0I7QUFDckMsVUFBSSxRQUFRLE9BQU8sU0FBUztBQUMzQixlQUFPO0FBQUEsVUFDTixRQUFRO0FBQUEsWUFDUCxxQkFBcUIsT0FBTyxRQUFRO0FBQUEsWUFDcEMsSUFBSSxPQUFPLFFBQVE7QUFBQSxZQUNuQixPQUFPLE9BQU8sUUFBUTtBQUFBLFlBQ3RCLFNBQVM7QUFBQSxjQUNSLE1BQU0sT0FBTyxRQUFRO0FBQUEsY0FDckIsT0FBTyxPQUFPLFFBQVE7QUFBQSxZQUN2QjtBQUFBLFVBQ0Q7QUFBQSxVQUNBLFNBQVMsT0FBTztBQUFBLFFBQ2pCO0FBQUEsTUFDRCxPQUFPO0FBQ04sZUFBTyxFQUFFLFFBQVEsT0FBTyxTQUFTLFNBQVMsT0FBTyxRQUFRO0FBQUEsTUFDMUQ7QUFBQSxJQUNEO0FBRUEsV0FBTyxpQkFBaUIsT0FBTyxVQUFVLE9BQU8sUUFBUSxjQUFjLE9BQU8sUUFBUTtBQUFBLEVBQ3RGO0FBQUEsRUFFQSxNQUFjLGVBQWUsTUFBbUY7QUFDL0csVUFBTSxjQUFjLE1BQU0sS0FBSyx3QkFBd0IsZUFBZTtBQUN0RSxVQUFNLFdBQVcsS0FBSyx3QkFBd0I7QUFDOUMsVUFBTSxjQUFjLHNCQUFzQixXQUFXO0FBQ3JELFVBQU0scUJBQXFCLEtBQUssd0JBQXdCLHNCQUFzQjtBQUM5RSxRQUFJO0FBQ0osVUFBTSxVQUErQztBQUFBLE1BQ3BELGFBQWEsU0FBUyxtQkFBbUIsSUFBSSxTQUFTLDZDQUE2Qyx1Q0FBdUMsSUFBSSxJQUFJLFNBQVMsNENBQTRDLHNDQUFzQztBQUFBLE1BQzdPLHdCQUF3QixPQUFPLFlBQVk7QUFFMUMsWUFBSSxDQUFDLE1BQU0sS0FBSyxlQUFlLFFBQVEsS0FBSyxPQUFPLEdBQUc7QUFDckQ7QUFBQSxRQUNEO0FBQ0EsWUFBSSxhQUFhLFFBQVEsS0FBSyxTQUFTO0FBQ3RDO0FBQUEsUUFDRDtBQUNBLFlBQUksUUFBUSxRQUFRLEtBQUssU0FBUztBQUNqQztBQUFBLFFBQ0Q7QUFDQSxjQUFNQSxrQkFBeUMsS0FBSyxzQkFBc0IsU0FBUyxzQkFBc0IsV0FBVyxXQUFXO0FBQy9ILGNBQU0sbUJBQW1CLENBQUMsQ0FBQ0Esa0JBQWlCLE9BQU8sS0FBS0EsZUFBYyxJQUFJLENBQUM7QUFDM0UsY0FBTSxPQUFPLE1BQU0sS0FBSyxtQkFBbUIsTUFBTTtBQUFBLFVBQ2hELFFBQVEsSUFBSSxTQUFTLDRCQUE0Qiw2QkFBNkI7QUFBQSxVQUM5RSxPQUFPLFFBQVEsS0FBSyxRQUFRO0FBQUEsVUFDNUIsZUFBZSxPQUFNLFVBQVM7QUFDN0IsZ0JBQUksaUJBQWlCLFNBQVMsS0FBSyxHQUFHO0FBQ3JDLHFCQUFPLElBQUksU0FBUyxnQ0FBZ0Msa0RBQWtEO0FBQUEsWUFDdkc7QUFDQSxtQkFBTztBQUFBLFVBQ1I7QUFBQSxRQUNELENBQUM7QUFDRCxZQUFJLENBQUMsTUFBTTtBQUNWO0FBQUEsUUFDRDtBQUNBLGNBQU0saUJBQXlEO0FBQUEsVUFDOUQsR0FBR0E7QUFBQSxVQUNILENBQUMsSUFBSSxHQUFHLEtBQUssd0JBQXdCLFFBQVEsS0FBSyxPQUFPO0FBQUEsUUFDMUQ7QUFDQSxjQUFNLEtBQUssc0JBQXNCLFlBQVksYUFBYSxnQkFBZ0Isb0JBQW9CLElBQUk7QUFBQSxNQUNuRztBQUFBLE1BQ0EsV0FBVyxVQUFRLFVBQVU7QUFBQSxJQUM5QjtBQUdBLFVBQU0saUJBQWtFLENBQUM7QUFDekUsVUFBTSxpQkFBaUIsU0FBUyxPQUFPLE9BQUssQ0FBQyxFQUFFLGNBQWM7QUFDN0QsVUFBTSx1QkFBdUIsU0FBUyxPQUFPLE9BQUssRUFBRSxjQUFjO0FBRWxFLFFBQUksZUFBZSxTQUFTLEdBQUc7QUFDOUIscUJBQWUsS0FBSyxFQUFFLE1BQU0sYUFBYSxPQUFPLElBQUksU0FBUyxvQkFBb0IsVUFBVSxFQUFFLENBQUM7QUFDOUYscUJBQWUsS0FBSyxHQUFHLEtBQUssMkJBQTJCLGVBQWUsSUFBSSxPQUFLLEtBQUssNEJBQTRCLENBQUMsQ0FBQyxHQUFHLGtCQUFtQixDQUFDO0FBQUEsSUFDMUk7QUFFQSxtQkFBZSxLQUFLLEVBQUUsTUFBTSxhQUFhLE9BQU8sSUFBSSxTQUFTLDRDQUE0QyxhQUFhLEVBQUUsQ0FBQztBQUN6SCxVQUFNLHNCQUErQyxDQUFDO0FBQ3RELGVBQVcsZUFBZSxLQUFLLHdCQUF3QixxQkFBcUI7QUFDM0UsVUFBSTtBQUNKLFVBQUksT0FBTyxZQUFZLFNBQVMsVUFBVTtBQUN6QyxZQUFJLFlBQVksS0FBSyxXQUFXLElBQUksR0FBRztBQUN0QyxpQkFBTyxVQUFVLFdBQVcsWUFBWSxJQUFJO0FBQUEsUUFDN0MsT0FBTztBQUNOLGlCQUFPLFVBQVUsT0FBTyxZQUFZLElBQUk7QUFBQSxRQUN6QztBQUFBLE1BQ0Q7QUFDQSxVQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFLFFBQVEsS0FBSyxFQUFFLEdBQUc7QUFDakQsZUFBTyxLQUFLLGdDQUFnQyxlQUFlO0FBQUEsTUFDNUQ7QUFDQSxZQUFNLGFBQWEsY0FBYyxhQUFhLEtBQUssY0FBYyxjQUFjLEVBQUUsTUFBTSxJQUFJO0FBQzNGLFlBQU0sYUFBYSxjQUFjLFdBQVc7QUFDNUMsWUFBTSxjQUFjLENBQUM7QUFDckIsVUFBSSxZQUFZO0FBQ2Ysb0JBQVksS0FBSyxHQUFHLFVBQVU7QUFBQSxNQUMvQjtBQUNBLFVBQUksWUFBWTtBQUNmLG9CQUFZLEtBQUssVUFBVTtBQUFBLE1BQzVCO0FBQ0EsMEJBQW9CLEtBQUs7QUFBQSxRQUN4QixPQUFPLEtBQUssS0FBSyxFQUFFLEtBQUssWUFBWSxLQUFLO0FBQUEsUUFDekMsU0FBUztBQUFBLFVBQ1IscUJBQXFCLFlBQVk7QUFBQSxVQUNqQyxPQUFPLFlBQVk7QUFBQSxVQUNuQixNQUFNLFlBQVk7QUFBQSxVQUNsQixJQUFJLFlBQVk7QUFBQSxVQUNoQixPQUFPLFlBQVk7QUFBQSxRQUNwQjtBQUFBLFFBQ0EsYUFBYSxZQUFZO0FBQUEsUUFDekI7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBRUEsUUFBSSxvQkFBb0IsU0FBUyxHQUFHO0FBQ25DLHFCQUFlLEtBQUssR0FBRyxLQUFLLDJCQUEyQixxQkFBcUIsa0JBQW1CLENBQUM7QUFBQSxJQUNqRztBQUVBLFFBQUkscUJBQXFCLFNBQVMsR0FBRztBQUNwQyxxQkFBZSxLQUFLLEVBQUUsTUFBTSxhQUFhLE9BQU8sSUFBSSxTQUFTLDZCQUE2QixVQUFVLEVBQUUsQ0FBQztBQUN2RyxxQkFBZSxLQUFLLEdBQUcsS0FBSywyQkFBMkIscUJBQXFCLElBQUksT0FBSyxLQUFLLDRCQUE0QixDQUFDLENBQUMsR0FBRyxrQkFBbUIsQ0FBQztBQUFBLElBQ2hKO0FBQ0EsVUFBTSx1QkFBdUIsd0JBQXdCLEtBQUssY0FBYyxjQUFjLENBQUM7QUFFdkYsVUFBTSxTQUFTLE1BQU0sS0FBSyxtQkFBbUIsS0FBSyxnQkFBZ0IsT0FBTztBQUN6RSx5QkFBcUIsUUFBUTtBQUM3QixRQUFJLENBQUMsUUFBUTtBQUNaLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxDQUFDLE1BQU0sS0FBSyxlQUFlLE9BQU8sT0FBTyxHQUFHO0FBQy9DLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxTQUFTO0FBQ1osYUFBTyxVQUFVO0FBQUEsSUFDbEI7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsd0JBQXdCLFNBQWdEO0FBQy9FLFVBQU0sU0FBOEIsRUFBRSxNQUFNLFFBQVEsS0FBSztBQUN6RCxRQUFJLFFBQVEsTUFBTTtBQUNqQixhQUFPLE9BQU8sUUFBUTtBQUFBLElBQ3ZCO0FBQ0EsUUFBSSxRQUFRLEtBQUs7QUFDaEIsYUFBTyxNQUFNLFFBQVE7QUFBQSxJQUN0QjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFjLGVBQWUsU0FBeUU7QUFDckcsVUFBTSxlQUFlLGtCQUFrQixXQUFXLFFBQVE7QUFDMUQsVUFBTSxxQkFBcUIsd0JBQXdCLFdBQVcsUUFBUTtBQUN0RSxRQUFJLENBQUMsZ0JBQWdCLENBQUMsb0JBQW9CO0FBQ3pDLGFBQU87QUFBQSxJQUNSO0FBR0EsV0FBTyxNQUFNLElBQUksUUFBaUIsT0FBSztBQUN0QyxZQUFNLGNBQWMsQ0FBQztBQUNyQixVQUFJLGNBQWM7QUFDakIsb0JBQVksS0FBSyxRQUFRLElBQUk7QUFBQSxNQUM5QjtBQUNBLFVBQUksb0JBQW9CO0FBQ3ZCLG9CQUFZLEtBQUssa0JBQWtCO0FBQUEsTUFDcEM7QUFHQSxZQUFNLFNBQVMsS0FBSyxxQkFBcUI7QUFBQSxRQUN4QyxTQUFTO0FBQUEsUUFDVCxJQUFJLFNBQVMscUJBQXFCLG9JQUFvSSxJQUFJLFlBQVksS0FBSyxHQUFHLENBQUMsR0FBRztBQUFBLFFBQ2xNLENBQUM7QUFBQSxVQUNBLE9BQU8sSUFBSSxTQUFTLE9BQU8sS0FBSztBQUFBLFVBQ2hDLEtBQUssTUFBTSxFQUFFLElBQUk7QUFBQSxRQUNsQixHQUFHO0FBQUEsVUFDRixPQUFPLElBQUksU0FBUyxVQUFVLFFBQVE7QUFBQSxVQUN0QyxLQUFLLE1BQU0sRUFBRSxLQUFLO0FBQUEsUUFDbkIsQ0FBQztBQUFBLE1BQ0Y7QUFDQSxhQUFPLFdBQVcsTUFBTSxFQUFFLEtBQUssQ0FBQztBQUFBLElBQ2pDLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSw0QkFBNEIsU0FBa0Q7QUFDckYsVUFBTSxVQUErQixDQUFDO0FBQUEsTUFDckMsV0FBVyxVQUFVLFlBQVksNEJBQTRCO0FBQUEsTUFDN0QsU0FBUyxJQUFJLFNBQVMsNEJBQTRCLDRCQUE0QjtBQUFBLElBQy9FLENBQUM7QUFDRCxVQUFNLE9BQVEsUUFBUSxRQUFRLFVBQVUsWUFBWSxRQUFRLElBQUksSUFBSyxRQUFRLE9BQU8sUUFBUTtBQUM1RixVQUFNLFFBQVEsS0FBSyxLQUFLLEVBQUUsS0FBSyxRQUFRLFdBQVc7QUFDbEQsVUFBTSxlQUFlLFFBQVEsYUFBYSxTQUFTLFFBQVEsSUFBSSxJQUFJLFFBQVE7QUFDM0UsVUFBTSxhQUFhLGNBQWMsT0FBTztBQUN4QyxVQUFNLGNBQWMsQ0FBQztBQUNyQixRQUFJLFlBQVk7QUFDZixrQkFBWSxLQUFLLFVBQVU7QUFBQSxJQUM1QjtBQUVBLFFBQUksUUFBUSxNQUFNO0FBQ2pCLFVBQUksT0FBTyxRQUFRLFNBQVMsVUFBVTtBQUNyQyxlQUFPLEVBQUUsT0FBTyxhQUFhLEdBQUcsUUFBUSxJQUFJLElBQUksUUFBUSxJQUFJLElBQUksU0FBUyxhQUFhLFFBQVEsYUFBYSxTQUFTLFlBQVk7QUFBQSxNQUNqSTtBQUNBLFlBQU0sYUFBYSxRQUFRLEtBQUssSUFBSSxPQUFLO0FBQ3hDLFlBQUksRUFBRSxTQUFTLEdBQUcsR0FBRztBQUNwQixpQkFBTyxJQUFJLEVBQUUsUUFBUSxNQUFNLEtBQUssQ0FBQztBQUFBLFFBQ2xDO0FBQ0EsZUFBTztBQUFBLE1BQ1IsQ0FBQyxFQUFFLEtBQUssR0FBRztBQUNYLGFBQU8sRUFBRSxPQUFPLGFBQWEsR0FBRyxZQUFZLElBQUksVUFBVSxJQUFJLFNBQVMsYUFBYSxRQUFRLGFBQWEsU0FBUyxZQUFZO0FBQUEsSUFDL0g7QUFDQSxXQUFPLEVBQUUsT0FBTyxhQUFhLGNBQWMsU0FBUyxhQUFhLFFBQVEsYUFBYSxTQUFTLFlBQVk7QUFBQSxFQUM1RztBQUFBLEVBRVEsMkJBQTJCLE9BQWdDLG9CQUE0QjtBQUM5RixXQUFPLE1BQU0sS0FBSyxDQUFDLEdBQUcsTUFBTTtBQUMzQixVQUFJLEVBQUUsZ0JBQWdCLG9CQUFvQjtBQUN6QyxlQUFPO0FBQUEsTUFDUjtBQUNBLFVBQUksRUFBRSxnQkFBZ0Isb0JBQW9CO0FBQ3pDLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBTyxFQUFFLFlBQVksY0FBYyxFQUFFLFdBQVc7QUFBQSxJQUNqRCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBbFJhLDJCQUFOO0FBQUEsRUFFSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFsiY29uZmlnUHJvZmlsZXMiXQp9Cg==
