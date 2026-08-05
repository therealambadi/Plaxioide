import { deepStrictEqual } from "assert";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { isLinux, isWindows, OperatingSystem } from "../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { ITerminalInstanceService } from "../../browser/terminal.js";
import { TerminalProfileQuickpick } from "../../browser/terminalProfileQuickpick.js";
import { TerminalProfileService } from "../../browser/terminalProfileService.js";
import { ITerminalProfileService } from "../../common/terminal.js";
import { ITerminalContributionService } from "../../common/terminalExtensionPoints.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { TestExtensionService } from "../../../../test/common/workbenchTestServices.js";
class TestTerminalProfileService extends TerminalProfileService {
  refreshAvailableProfiles() {
    this.hasRefreshedProfiles = this._refreshAvailableProfilesNow();
  }
  refreshAndAwaitAvailableProfiles() {
    this.refreshAvailableProfiles();
    if (!this.hasRefreshedProfiles) {
      throw new Error("has not refreshed profiles yet");
    }
    return this.hasRefreshedProfiles;
  }
}
class MockTerminalProfileService {
  constructor() {
    this.availableProfiles = [];
    this.contributedProfiles = [];
  }
  async getPlatformKey() {
    return "linux";
  }
  getDefaultProfileName() {
    return this._defaultProfileName;
  }
  setProfiles(profiles, contributed) {
    this.availableProfiles = profiles;
    this.contributedProfiles = contributed;
  }
  setDefaultProfileName(name) {
    this._defaultProfileName = name;
  }
}
class MockQuickInputService {
  constructor() {
    this._pick = powershellPick;
  }
  async pick(picks, options, token) {
    Promise.resolve(picks);
    return this._pick;
  }
  setPick(pick) {
    this._pick = pick;
  }
}
class TestTerminalProfileQuickpick extends TerminalProfileQuickpick {
}
class TestTerminalExtensionService extends TestExtensionService {
  constructor() {
    super(...arguments);
    this._onDidChangeExtensions = new Emitter();
  }
}
class TestTerminalContributionService {
  constructor() {
    this.terminalProfiles = [];
  }
  setProfiles(profiles) {
    this.terminalProfiles = profiles;
  }
}
class TestTerminalInstanceService {
  constructor() {
    this._profiles = /* @__PURE__ */ new Map();
    this._hasReturnedNone = true;
  }
  async getBackend(remoteAuthority) {
    return {
      getProfiles: async () => {
        if (this._hasReturnedNone) {
          return this._profiles.get(remoteAuthority ?? "") || [];
        } else {
          this._hasReturnedNone = true;
          return [];
        }
      }
    };
  }
  setProfiles(remoteAuthority, profiles) {
    this._profiles.set(remoteAuthority ?? "", profiles);
  }
  setReturnNone() {
    this._hasReturnedNone = false;
  }
}
class TestRemoteAgentService {
  setEnvironment(os) {
    this._os = os;
  }
  async getEnvironment() {
    return { os: this._os };
  }
}
const defaultTerminalConfig = { profiles: { windows: {}, linux: {}, osx: {} } };
let powershellProfile = {
  profileName: "PowerShell",
  path: "C:\\Powershell.exe",
  isDefault: true,
  icon: Codicon.terminalPowershell
};
let jsdebugProfile = {
  extensionIdentifier: "ms-vscode.js-debug-nightly",
  icon: "debug",
  id: "extension.js-debug.debugTerminal",
  title: "JavaScript Debug Terminal"
};
const powershellPick = { label: "Powershell", profile: powershellProfile, profileName: powershellProfile.profileName };
const jsdebugPick = { label: "Javascript Debug Terminal", profile: jsdebugProfile, profileName: jsdebugProfile.title };
suite("TerminalProfileService", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let configurationService;
  let terminalInstanceService;
  let terminalProfileService;
  let remoteAgentService;
  let extensionService;
  let environmentService;
  let instantiationService;
  setup(async () => {
    configurationService = new TestConfigurationService({
      files: {},
      terminal: {
        integrated: defaultTerminalConfig
      }
    });
    instantiationService = workbenchInstantiationService({
      configurationService: () => configurationService
    }, store);
    remoteAgentService = new TestRemoteAgentService();
    terminalInstanceService = new TestTerminalInstanceService();
    extensionService = new TestTerminalExtensionService();
    environmentService = { remoteAuthority: void 0 };
    const themeService = new TestThemeService();
    const terminalContributionService = new TestTerminalContributionService();
    instantiationService.stub(IExtensionService, extensionService);
    instantiationService.stub(IConfigurationService, configurationService);
    instantiationService.stub(IRemoteAgentService, remoteAgentService);
    instantiationService.stub(ITerminalContributionService, terminalContributionService);
    instantiationService.stub(ITerminalInstanceService, terminalInstanceService);
    instantiationService.stub(IWorkbenchEnvironmentService, environmentService);
    instantiationService.stub(IThemeService, themeService);
    terminalProfileService = store.add(instantiationService.createInstance(TestTerminalProfileService));
    powershellProfile = {
      profileName: "PowerShell",
      path: "C:\\Powershell.exe",
      isDefault: true,
      icon: Codicon.terminalPowershell
    };
    jsdebugProfile = {
      extensionIdentifier: "ms-vscode.js-debug-nightly",
      icon: "debug",
      id: "extension.js-debug.debugTerminal",
      title: "JavaScript Debug Terminal"
    };
    terminalInstanceService.setProfiles(void 0, [powershellProfile]);
    terminalInstanceService.setProfiles("fakeremote", []);
    terminalContributionService.setProfiles([jsdebugProfile]);
    if (isWindows) {
      remoteAgentService.setEnvironment(OperatingSystem.Windows);
    } else if (isLinux) {
      remoteAgentService.setEnvironment(OperatingSystem.Linux);
    } else {
      remoteAgentService.setEnvironment(OperatingSystem.Macintosh);
    }
    configurationService.setUserConfiguration("terminal", { integrated: defaultTerminalConfig });
  });
  suite("Contributed Profiles", () => {
    test("should filter out contributed profiles set to null (Linux)", async () => {
      remoteAgentService.setEnvironment(OperatingSystem.Linux);
      await configurationService.setUserConfiguration("terminal", {
        integrated: {
          profiles: {
            linux: {
              "JavaScript Debug Terminal": null
            }
          }
        }
      });
      configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true, source: ConfigurationTarget.USER });
      await terminalProfileService.refreshAndAwaitAvailableProfiles();
      deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
      deepStrictEqual(terminalProfileService.contributedProfiles, []);
    });
    test("should filter out contributed profiles set to null (Windows)", async () => {
      remoteAgentService.setEnvironment(OperatingSystem.Windows);
      await configurationService.setUserConfiguration("terminal", {
        integrated: {
          profiles: {
            windows: {
              "JavaScript Debug Terminal": null
            }
          }
        }
      });
      configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true, source: ConfigurationTarget.USER });
      await terminalProfileService.refreshAndAwaitAvailableProfiles();
      deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
      deepStrictEqual(terminalProfileService.contributedProfiles, []);
    });
    test("should filter out contributed profiles set to null (macOS)", async () => {
      remoteAgentService.setEnvironment(OperatingSystem.Macintosh);
      await configurationService.setUserConfiguration("terminal", {
        integrated: {
          profiles: {
            osx: {
              "JavaScript Debug Terminal": null
            }
          }
        }
      });
      configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true, source: ConfigurationTarget.USER });
      await terminalProfileService.refreshAndAwaitAvailableProfiles();
      deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
      deepStrictEqual(terminalProfileService.contributedProfiles, []);
    });
    test("should include contributed profiles", async () => {
      await terminalProfileService.refreshAndAwaitAvailableProfiles();
      deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
      deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
    });
  });
  test("should get profiles from remoteTerminalService when there is a remote authority", async () => {
    environmentService = { remoteAuthority: "fakeremote" };
    instantiationService.stub(IWorkbenchEnvironmentService, environmentService);
    terminalProfileService = store.add(instantiationService.createInstance(TestTerminalProfileService));
    await terminalProfileService.hasRefreshedProfiles;
    deepStrictEqual(terminalProfileService.availableProfiles, []);
    deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
    terminalInstanceService.setProfiles("fakeremote", [powershellProfile]);
    await terminalProfileService.refreshAndAwaitAvailableProfiles();
    deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
    deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
  });
  test("should fire onDidChangeAvailableProfiles only when available profiles have changed via user config", async () => {
    powershellProfile.icon = Codicon.lightBulb;
    let calls = [];
    store.add(terminalProfileService.onDidChangeAvailableProfiles((e) => calls.push(e)));
    await configurationService.setUserConfiguration("terminal", {
      integrated: {
        profiles: {
          windows: powershellProfile,
          linux: powershellProfile,
          osx: powershellProfile
        }
      }
    });
    await terminalProfileService.hasRefreshedProfiles;
    deepStrictEqual(calls, [
      [powershellProfile]
    ]);
    deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
    deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
    calls = [];
    await terminalProfileService.refreshAndAwaitAvailableProfiles();
    deepStrictEqual(calls, []);
  });
  test("should fire onDidChangeAvailableProfiles when available or contributed profiles have changed via remote/localTerminalService", async () => {
    powershellProfile.isDefault = false;
    terminalInstanceService.setProfiles(void 0, [powershellProfile]);
    const calls = [];
    store.add(terminalProfileService.onDidChangeAvailableProfiles((e) => calls.push(e)));
    await terminalProfileService.hasRefreshedProfiles;
    deepStrictEqual(calls, [
      [powershellProfile]
    ]);
    deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
    deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
  });
  test("should call refreshAvailableProfiles _onDidChangeExtensions", async () => {
    extensionService._onDidChangeExtensions.fire();
    const calls = [];
    store.add(terminalProfileService.onDidChangeAvailableProfiles((e) => calls.push(e)));
    await terminalProfileService.hasRefreshedProfiles;
    deepStrictEqual(calls, [
      [powershellProfile]
    ]);
    deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
    deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
  });
  suite("Profiles Quickpick", () => {
    let quickInputService;
    let mockTerminalProfileService;
    let terminalProfileQuickpick;
    setup(async () => {
      quickInputService = new MockQuickInputService();
      mockTerminalProfileService = new MockTerminalProfileService();
      instantiationService.stub(IQuickInputService, quickInputService);
      instantiationService.stub(ITerminalProfileService, mockTerminalProfileService);
      terminalProfileQuickpick = instantiationService.createInstance(TestTerminalProfileQuickpick);
    });
    test("setDefault", async () => {
      powershellProfile.isDefault = false;
      mockTerminalProfileService.setProfiles([powershellProfile], [jsdebugProfile]);
      mockTerminalProfileService.setDefaultProfileName(jsdebugProfile.title);
      const result = await terminalProfileQuickpick.showAndGetResult("setDefault");
      deepStrictEqual(result, powershellProfile.profileName);
    });
    test("setDefault to contributed", async () => {
      mockTerminalProfileService.setDefaultProfileName(powershellProfile.profileName);
      quickInputService.setPick(jsdebugPick);
      const result = await terminalProfileQuickpick.showAndGetResult("setDefault");
      const expected = {
        config: {
          extensionIdentifier: jsdebugProfile.extensionIdentifier,
          id: jsdebugProfile.id,
          options: { color: void 0, icon: "debug" },
          title: jsdebugProfile.title
        },
        keyMods: void 0
      };
      deepStrictEqual(result, expected);
    });
    test("createInstance", async () => {
      mockTerminalProfileService.setDefaultProfileName(powershellProfile.profileName);
      const pick = { ...powershellPick, keyMods: { alt: true, ctrlCmd: false } };
      quickInputService.setPick(pick);
      const result = await terminalProfileQuickpick.showAndGetResult("createInstance");
      deepStrictEqual(result, { config: powershellProfile, keyMods: { alt: true, ctrlCmd: false } });
    });
    test("createInstance with contributed", async () => {
      const pick = { ...jsdebugPick, keyMods: { alt: true, ctrlCmd: false } };
      quickInputService.setPick(pick);
      const result = await terminalProfileQuickpick.showAndGetResult("createInstance");
      const expected = {
        config: {
          extensionIdentifier: jsdebugProfile.extensionIdentifier,
          id: jsdebugProfile.id,
          options: { color: void 0, icon: "debug" },
          title: jsdebugProfile.title
        },
        keyMods: { alt: true, ctrlCmd: false }
      };
      deepStrictEqual(result, expected);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxQcm9maWxlU2VydmljZS5pbnRlZ3JhdGlvblRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkZWVwU3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc1dpbmRvd3MsIE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJUGlja09wdGlvbnMsIElRdWlja0lucHV0U2VydmljZSwgT21pdCwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudEVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudEVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25UZXJtaW5hbFByb2ZpbGUsIElUZXJtaW5hbEJhY2tlbmQsIElUZXJtaW5hbFByb2ZpbGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL3Rlc3QvY29tbW9uL3Rlc3RUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJUHJvZmlsZVF1aWNrUGlja0l0ZW0sIFRlcm1pbmFsUHJvZmlsZVF1aWNrcGljayB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWxQcm9maWxlUXVpY2twaWNrLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29uZmlndXJhdGlvbiwgSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29udHJpYnV0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbEV4dGVuc2lvblBvaW50cy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBUZXN0RXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5cbmNsYXNzIFRlc3RUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIGV4dGVuZHMgVGVybWluYWxQcm9maWxlU2VydmljZSBpbXBsZW1lbnRzIFBhcnRpYWw8SVRlcm1pbmFsUHJvZmlsZVNlcnZpY2U+IHtcblx0aGFzUmVmcmVzaGVkUHJvZmlsZXM6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cdG92ZXJyaWRlIHJlZnJlc2hBdmFpbGFibGVQcm9maWxlcygpOiB2b2lkIHtcblx0XHR0aGlzLmhhc1JlZnJlc2hlZFByb2ZpbGVzID0gdGhpcy5fcmVmcmVzaEF2YWlsYWJsZVByb2ZpbGVzTm93KCk7XG5cdH1cblx0cmVmcmVzaEFuZEF3YWl0QXZhaWxhYmxlUHJvZmlsZXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5yZWZyZXNoQXZhaWxhYmxlUHJvZmlsZXMoKTtcblx0XHRpZiAoIXRoaXMuaGFzUmVmcmVzaGVkUHJvZmlsZXMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignaGFzIG5vdCByZWZyZXNoZWQgcHJvZmlsZXMgeWV0Jyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmhhc1JlZnJlc2hlZFByb2ZpbGVzO1xuXHR9XG59XG5cbmNsYXNzIE1vY2tUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIGltcGxlbWVudHMgUGFydGlhbDxJVGVybWluYWxQcm9maWxlU2VydmljZT4ge1xuXHRoYXNSZWZyZXNoZWRQcm9maWxlczogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblx0X2RlZmF1bHRQcm9maWxlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRhdmFpbGFibGVQcm9maWxlcz86IElUZXJtaW5hbFByb2ZpbGVbXSB8IHVuZGVmaW5lZCA9IFtdO1xuXHRjb250cmlidXRlZFByb2ZpbGVzPzogSUV4dGVuc2lvblRlcm1pbmFsUHJvZmlsZVtdIHwgdW5kZWZpbmVkID0gW107XG5cdGFzeW5jIGdldFBsYXRmb3JtS2V5KCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuICdsaW51eCc7XG5cdH1cblx0Z2V0RGVmYXVsdFByb2ZpbGVOYW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlZmF1bHRQcm9maWxlTmFtZTtcblx0fVxuXHRzZXRQcm9maWxlcyhwcm9maWxlczogSVRlcm1pbmFsUHJvZmlsZVtdLCBjb250cmlidXRlZDogSUV4dGVuc2lvblRlcm1pbmFsUHJvZmlsZVtdKTogdm9pZCB7XG5cdFx0dGhpcy5hdmFpbGFibGVQcm9maWxlcyA9IHByb2ZpbGVzO1xuXHRcdHRoaXMuY29udHJpYnV0ZWRQcm9maWxlcyA9IGNvbnRyaWJ1dGVkO1xuXHR9XG5cdHNldERlZmF1bHRQcm9maWxlTmFtZShuYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9kZWZhdWx0UHJvZmlsZU5hbWUgPSBuYW1lO1xuXHR9XG59XG5cblxuY2xhc3MgTW9ja1F1aWNrSW5wdXRTZXJ2aWNlIGltcGxlbWVudHMgUGFydGlhbDxJUXVpY2tJbnB1dFNlcnZpY2U+IHtcblx0X3BpY2s6IElQcm9maWxlUXVpY2tQaWNrSXRlbSA9IHBvd2Vyc2hlbGxQaWNrO1xuXHRwaWNrKHBpY2tzOiBRdWlja1BpY2tJbnB1dDxJUHJvZmlsZVF1aWNrUGlja0l0ZW0+W10gfCBQcm9taXNlPFF1aWNrUGlja0lucHV0PElQcm9maWxlUXVpY2tQaWNrSXRlbT5bXT4sIG9wdGlvbnM/OiBJUGlja09wdGlvbnM8SVByb2ZpbGVRdWlja1BpY2tJdGVtPiAmIHsgY2FuUGlja01hbnk6IHRydWUgfSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVByb2ZpbGVRdWlja1BpY2tJdGVtW10gfCB1bmRlZmluZWQ+O1xuXHRwaWNrKHBpY2tzOiBRdWlja1BpY2tJbnB1dDxJUHJvZmlsZVF1aWNrUGlja0l0ZW0+W10gfCBQcm9taXNlPFF1aWNrUGlja0lucHV0PElQcm9maWxlUXVpY2tQaWNrSXRlbT5bXT4sIG9wdGlvbnM/OiBJUGlja09wdGlvbnM8SVByb2ZpbGVRdWlja1BpY2tJdGVtPiAmIHsgY2FuUGlja01hbnk6IGZhbHNlIH0sIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQcm9maWxlUXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZD47XG5cdHBpY2socGlja3M6IFF1aWNrUGlja0lucHV0PElQcm9maWxlUXVpY2tQaWNrSXRlbT5bXSB8IFByb21pc2U8UXVpY2tQaWNrSW5wdXQ8SVByb2ZpbGVRdWlja1BpY2tJdGVtPltdPiwgb3B0aW9ucz86IE9taXQ8SVBpY2tPcHRpb25zPElQcm9maWxlUXVpY2tQaWNrSXRlbT4sICdjYW5QaWNrTWFueSc+LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUHJvZmlsZVF1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQ+O1xuXHRhc3luYyBwaWNrKHBpY2tzOiBhbnksIG9wdGlvbnM/OiBhbnksIHRva2VuPzogYW55KTogUHJvbWlzZTxJUHJvZmlsZVF1aWNrUGlja0l0ZW0gfCBJUHJvZmlsZVF1aWNrUGlja0l0ZW1bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdFByb21pc2UucmVzb2x2ZShwaWNrcyk7XG5cdFx0cmV0dXJuIHRoaXMuX3BpY2s7XG5cdH1cblxuXHRzZXRQaWNrKHBpY2s6IElQcm9maWxlUXVpY2tQaWNrSXRlbSkge1xuXHRcdHRoaXMuX3BpY2sgPSBwaWNrO1xuXHR9XG59XG5cbmNsYXNzIFRlc3RUZXJtaW5hbFByb2ZpbGVRdWlja3BpY2sgZXh0ZW5kcyBUZXJtaW5hbFByb2ZpbGVRdWlja3BpY2sge1xuXG59XG5cbmNsYXNzIFRlc3RUZXJtaW5hbEV4dGVuc2lvblNlcnZpY2UgZXh0ZW5kcyBUZXN0RXh0ZW5zaW9uU2VydmljZSB7XG5cdHJlYWRvbmx5IF9vbkRpZENoYW5nZUV4dGVuc2lvbnMgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xufVxuXG5jbGFzcyBUZXN0VGVybWluYWxDb250cmlidXRpb25TZXJ2aWNlIGltcGxlbWVudHMgSVRlcm1pbmFsQ29udHJpYnV0aW9uU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0dGVybWluYWxQcm9maWxlczogcmVhZG9ubHkgSUV4dGVuc2lvblRlcm1pbmFsUHJvZmlsZVtdID0gW107XG5cdHNldFByb2ZpbGVzKHByb2ZpbGVzOiBJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlW10pOiB2b2lkIHtcblx0XHR0aGlzLnRlcm1pbmFsUHJvZmlsZXMgPSBwcm9maWxlcztcblx0fVxufVxuXG5jbGFzcyBUZXN0VGVybWluYWxJbnN0YW5jZVNlcnZpY2UgaW1wbGVtZW50cyBQYXJ0aWFsPElUZXJtaW5hbEluc3RhbmNlU2VydmljZT4ge1xuXHRwcml2YXRlIF9wcm9maWxlczogTWFwPHN0cmluZywgSVRlcm1pbmFsUHJvZmlsZVtdPiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSBfaGFzUmV0dXJuZWROb25lID0gdHJ1ZTtcblx0YXN5bmMgZ2V0QmFja2VuZChyZW1vdGVBdXRob3JpdHk6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8SVRlcm1pbmFsQmFja2VuZD4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRQcm9maWxlczogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5faGFzUmV0dXJuZWROb25lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3Byb2ZpbGVzLmdldChyZW1vdGVBdXRob3JpdHkgPz8gJycpIHx8IFtdO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX2hhc1JldHVybmVkTm9uZSA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBzYXRpc2ZpZXMgUGFydGlhbDxJVGVybWluYWxCYWNrZW5kPiBhcyBhbnk7XG5cdH1cblx0c2V0UHJvZmlsZXMocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQsIHByb2ZpbGVzOiBJVGVybWluYWxQcm9maWxlW10pIHtcblx0XHR0aGlzLl9wcm9maWxlcy5zZXQocmVtb3RlQXV0aG9yaXR5ID8/ICcnLCBwcm9maWxlcyk7XG5cdH1cblx0c2V0UmV0dXJuTm9uZSgpIHtcblx0XHR0aGlzLl9oYXNSZXR1cm5lZE5vbmUgPSBmYWxzZTtcblx0fVxufVxuXG5jbGFzcyBUZXN0UmVtb3RlQWdlbnRTZXJ2aWNlIGltcGxlbWVudHMgUGFydGlhbDxJUmVtb3RlQWdlbnRTZXJ2aWNlPiB7XG5cdHByaXZhdGUgX29zOiBPcGVyYXRpbmdTeXN0ZW0gfCB1bmRlZmluZWQ7XG5cdHNldEVudmlyb25tZW50KG9zOiBPcGVyYXRpbmdTeXN0ZW0pIHtcblx0XHR0aGlzLl9vcyA9IG9zO1xuXHR9XG5cdGFzeW5jIGdldEVudmlyb25tZW50KCk6IFByb21pc2U8SVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfCBudWxsPiB7XG5cdFx0cmV0dXJuIHsgb3M6IHRoaXMuX29zIH0gc2F0aXNmaWVzIFBhcnRpYWw8SVJlbW90ZUFnZW50RW52aXJvbm1lbnQ+IGFzIGFueTtcblx0fVxufVxuXG5jb25zdCBkZWZhdWx0VGVybWluYWxDb25maWc6IFBhcnRpYWw8SVRlcm1pbmFsQ29uZmlndXJhdGlvbj4gPSB7IHByb2ZpbGVzOiB7IHdpbmRvd3M6IHt9LCBsaW51eDoge30sIG9zeDoge30gfSB9O1xubGV0IHBvd2Vyc2hlbGxQcm9maWxlID0ge1xuXHRwcm9maWxlTmFtZTogJ1Bvd2VyU2hlbGwnLFxuXHRwYXRoOiAnQzpcXFxcUG93ZXJzaGVsbC5leGUnLFxuXHRpc0RlZmF1bHQ6IHRydWUsXG5cdGljb246IENvZGljb24udGVybWluYWxQb3dlcnNoZWxsXG59O1xubGV0IGpzZGVidWdQcm9maWxlID0ge1xuXHRleHRlbnNpb25JZGVudGlmaWVyOiAnbXMtdnNjb2RlLmpzLWRlYnVnLW5pZ2h0bHknLFxuXHRpY29uOiAnZGVidWcnLFxuXHRpZDogJ2V4dGVuc2lvbi5qcy1kZWJ1Zy5kZWJ1Z1Rlcm1pbmFsJyxcblx0dGl0bGU6ICdKYXZhU2NyaXB0IERlYnVnIFRlcm1pbmFsJ1xufTtcbmNvbnN0IHBvd2Vyc2hlbGxQaWNrID0geyBsYWJlbDogJ1Bvd2Vyc2hlbGwnLCBwcm9maWxlOiBwb3dlcnNoZWxsUHJvZmlsZSwgcHJvZmlsZU5hbWU6IHBvd2Vyc2hlbGxQcm9maWxlLnByb2ZpbGVOYW1lIH07XG5jb25zdCBqc2RlYnVnUGljayA9IHsgbGFiZWw6ICdKYXZhc2NyaXB0IERlYnVnIFRlcm1pbmFsJywgcHJvZmlsZToganNkZWJ1Z1Byb2ZpbGUsIHByb2ZpbGVOYW1lOiBqc2RlYnVnUHJvZmlsZS50aXRsZSB9O1xuXG5zdWl0ZSgnVGVybWluYWxQcm9maWxlU2VydmljZScsICgpID0+IHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgY29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZTtcblx0bGV0IHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlOiBUZXN0VGVybWluYWxJbnN0YW5jZVNlcnZpY2U7XG5cdGxldCB0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlOiBUZXN0VGVybWluYWxQcm9maWxlU2VydmljZTtcblx0bGV0IHJlbW90ZUFnZW50U2VydmljZTogVGVzdFJlbW90ZUFnZW50U2VydmljZTtcblx0bGV0IGV4dGVuc2lvblNlcnZpY2U6IFRlc3RUZXJtaW5hbEV4dGVuc2lvblNlcnZpY2U7XG5cdGxldCBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2U7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZmlsZXM6IHt9LFxuXHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0aW50ZWdyYXRlZDogZGVmYXVsdFRlcm1pbmFsQ29uZmlnXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh7XG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogKCkgPT4gY29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHR9LCBzdG9yZSk7XG5cdFx0cmVtb3RlQWdlbnRTZXJ2aWNlID0gbmV3IFRlc3RSZW1vdGVBZ2VudFNlcnZpY2UoKTtcblx0XHR0ZXJtaW5hbEluc3RhbmNlU2VydmljZSA9IG5ldyBUZXN0VGVybWluYWxJbnN0YW5jZVNlcnZpY2UoKTtcblx0XHRleHRlbnNpb25TZXJ2aWNlID0gbmV3IFRlc3RUZXJtaW5hbEV4dGVuc2lvblNlcnZpY2UoKTtcblx0XHRlbnZpcm9ubWVudFNlcnZpY2UgPSB7IHJlbW90ZUF1dGhvcml0eTogdW5kZWZpbmVkIH0gc2F0aXNmaWVzIFBhcnRpYWw8SVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZT4gYXMgYW55O1xuXG5cdFx0Y29uc3QgdGhlbWVTZXJ2aWNlID0gbmV3IFRlc3RUaGVtZVNlcnZpY2UoKTtcblx0XHRjb25zdCB0ZXJtaW5hbENvbnRyaWJ1dGlvblNlcnZpY2UgPSBuZXcgVGVzdFRlcm1pbmFsQ29udHJpYnV0aW9uU2VydmljZSgpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRXh0ZW5zaW9uU2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZW1vdGVBZ2VudFNlcnZpY2UsIHJlbW90ZUFnZW50U2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVybWluYWxDb250cmlidXRpb25TZXJ2aWNlLCB0ZXJtaW5hbENvbnRyaWJ1dGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLCB0ZXJtaW5hbEluc3RhbmNlU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRoZW1lU2VydmljZSwgdGhlbWVTZXJ2aWNlKTtcblxuXHRcdHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFRlcm1pbmFsUHJvZmlsZVNlcnZpY2UpKTtcblxuXHRcdC8vcmVzZXQgYXMgdGhlc2UgcHJvcGVydGllcyBhcmUgY2hhbmdlZCBpbiBlYWNoIHRlc3Rcblx0XHRwb3dlcnNoZWxsUHJvZmlsZSA9IHtcblx0XHRcdHByb2ZpbGVOYW1lOiAnUG93ZXJTaGVsbCcsXG5cdFx0XHRwYXRoOiAnQzpcXFxcUG93ZXJzaGVsbC5leGUnLFxuXHRcdFx0aXNEZWZhdWx0OiB0cnVlLFxuXHRcdFx0aWNvbjogQ29kaWNvbi50ZXJtaW5hbFBvd2Vyc2hlbGxcblx0XHR9O1xuXHRcdGpzZGVidWdQcm9maWxlID0ge1xuXHRcdFx0ZXh0ZW5zaW9uSWRlbnRpZmllcjogJ21zLXZzY29kZS5qcy1kZWJ1Zy1uaWdodGx5Jyxcblx0XHRcdGljb246ICdkZWJ1ZycsXG5cdFx0XHRpZDogJ2V4dGVuc2lvbi5qcy1kZWJ1Zy5kZWJ1Z1Rlcm1pbmFsJyxcblx0XHRcdHRpdGxlOiAnSmF2YVNjcmlwdCBEZWJ1ZyBUZXJtaW5hbCdcblx0XHR9O1xuXG5cdFx0dGVybWluYWxJbnN0YW5jZVNlcnZpY2Uuc2V0UHJvZmlsZXModW5kZWZpbmVkLCBbcG93ZXJzaGVsbFByb2ZpbGVdKTtcblx0XHR0ZXJtaW5hbEluc3RhbmNlU2VydmljZS5zZXRQcm9maWxlcygnZmFrZXJlbW90ZScsIFtdKTtcblx0XHR0ZXJtaW5hbENvbnRyaWJ1dGlvblNlcnZpY2Uuc2V0UHJvZmlsZXMoW2pzZGVidWdQcm9maWxlXSk7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0cmVtb3RlQWdlbnRTZXJ2aWNlLnNldEVudmlyb25tZW50KE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKTtcblx0XHR9IGVsc2UgaWYgKGlzTGludXgpIHtcblx0XHRcdHJlbW90ZUFnZW50U2VydmljZS5zZXRFbnZpcm9ubWVudChPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZW1vdGVBZ2VudFNlcnZpY2Uuc2V0RW52aXJvbm1lbnQoT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCk7XG5cdFx0fVxuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCd0ZXJtaW5hbCcsIHsgaW50ZWdyYXRlZDogZGVmYXVsdFRlcm1pbmFsQ29uZmlnIH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnQ29udHJpYnV0ZWQgUHJvZmlsZXMnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGZpbHRlciBvdXQgY29udHJpYnV0ZWQgcHJvZmlsZXMgc2V0IHRvIG51bGwgKExpbnV4KScsIGFzeW5jICgpID0+IHtcblx0XHRcdHJlbW90ZUFnZW50U2VydmljZS5zZXRFbnZpcm9ubWVudChPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ3Rlcm1pbmFsJywge1xuXHRcdFx0XHRpbnRlZ3JhdGVkOiB7XG5cdFx0XHRcdFx0cHJvZmlsZXM6IHtcblx0XHRcdFx0XHRcdGxpbnV4OiB7XG5cdFx0XHRcdFx0XHRcdCdKYXZhU2NyaXB0IERlYnVnIFRlcm1pbmFsJzogbnVsbFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb25FbWl0dGVyLmZpcmUoeyBhZmZlY3RzQ29uZmlndXJhdGlvbjogKCkgPT4gdHJ1ZSwgc291cmNlOiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIgfSBhcyBhbnkpO1xuXHRcdFx0YXdhaXQgdGVybWluYWxQcm9maWxlU2VydmljZS5yZWZyZXNoQW5kQXdhaXRBdmFpbGFibGVQcm9maWxlcygpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UuYXZhaWxhYmxlUHJvZmlsZXMsIFtwb3dlcnNoZWxsUHJvZmlsZV0pO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UuY29udHJpYnV0ZWRQcm9maWxlcywgW10pO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBmaWx0ZXIgb3V0IGNvbnRyaWJ1dGVkIHByb2ZpbGVzIHNldCB0byBudWxsIChXaW5kb3dzKScsIGFzeW5jICgpID0+IHtcblx0XHRcdHJlbW90ZUFnZW50U2VydmljZS5zZXRFbnZpcm9ubWVudChPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyk7XG5cdFx0XHRhd2FpdCBjb25maWd1cmF0aW9uU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbigndGVybWluYWwnLCB7XG5cdFx0XHRcdGludGVncmF0ZWQ6IHtcblx0XHRcdFx0XHRwcm9maWxlczoge1xuXHRcdFx0XHRcdFx0d2luZG93czoge1xuXHRcdFx0XHRcdFx0XHQnSmF2YVNjcmlwdCBEZWJ1ZyBUZXJtaW5hbCc6IG51bGxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uRW1pdHRlci5maXJlKHsgYWZmZWN0c0NvbmZpZ3VyYXRpb246ICgpID0+IHRydWUsIHNvdXJjZTogQ29uZmlndXJhdGlvblRhcmdldC5VU0VSIH0gYXMgYW55KTtcblx0XHRcdGF3YWl0IHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UucmVmcmVzaEFuZEF3YWl0QXZhaWxhYmxlUHJvZmlsZXMoKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLCBbcG93ZXJzaGVsbFByb2ZpbGVdKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmNvbnRyaWJ1dGVkUHJvZmlsZXMsIFtdKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgZmlsdGVyIG91dCBjb250cmlidXRlZCBwcm9maWxlcyBzZXQgdG8gbnVsbCAobWFjT1MpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0cmVtb3RlQWdlbnRTZXJ2aWNlLnNldEVudmlyb25tZW50KE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gpO1xuXHRcdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ3Rlcm1pbmFsJywge1xuXHRcdFx0XHRpbnRlZ3JhdGVkOiB7XG5cdFx0XHRcdFx0cHJvZmlsZXM6IHtcblx0XHRcdFx0XHRcdG9zeDoge1xuXHRcdFx0XHRcdFx0XHQnSmF2YVNjcmlwdCBEZWJ1ZyBUZXJtaW5hbCc6IG51bGxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uRW1pdHRlci5maXJlKHsgYWZmZWN0c0NvbmZpZ3VyYXRpb246ICgpID0+IHRydWUsIHNvdXJjZTogQ29uZmlndXJhdGlvblRhcmdldC5VU0VSIH0gYXMgYW55KTtcblx0XHRcdGF3YWl0IHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UucmVmcmVzaEFuZEF3YWl0QXZhaWxhYmxlUHJvZmlsZXMoKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLCBbcG93ZXJzaGVsbFByb2ZpbGVdKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmNvbnRyaWJ1dGVkUHJvZmlsZXMsIFtdKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgaW5jbHVkZSBjb250cmlidXRlZCBwcm9maWxlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UucmVmcmVzaEFuZEF3YWl0QXZhaWxhYmxlUHJvZmlsZXMoKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLCBbcG93ZXJzaGVsbFByb2ZpbGVdKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmNvbnRyaWJ1dGVkUHJvZmlsZXMsIFtqc2RlYnVnUHJvZmlsZV0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgZ2V0IHByb2ZpbGVzIGZyb20gcmVtb3RlVGVybWluYWxTZXJ2aWNlIHdoZW4gdGhlcmUgaXMgYSByZW1vdGUgYXV0aG9yaXR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGVudmlyb25tZW50U2VydmljZSA9IHsgcmVtb3RlQXV0aG9yaXR5OiAnZmFrZXJlbW90ZScgfSBzYXRpc2ZpZXMgUGFydGlhbDxJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlPiBhcyBhbnk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFRlcm1pbmFsUHJvZmlsZVNlcnZpY2UpKTtcblx0XHRhd2FpdCB0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmhhc1JlZnJlc2hlZFByb2ZpbGVzO1xuXHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLCBbXSk7XG5cdFx0ZGVlcFN0cmljdEVxdWFsKHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UuY29udHJpYnV0ZWRQcm9maWxlcywgW2pzZGVidWdQcm9maWxlXSk7XG5cdFx0dGVybWluYWxJbnN0YW5jZVNlcnZpY2Uuc2V0UHJvZmlsZXMoJ2Zha2VyZW1vdGUnLCBbcG93ZXJzaGVsbFByb2ZpbGVdKTtcblx0XHRhd2FpdCB0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLnJlZnJlc2hBbmRBd2FpdEF2YWlsYWJsZVByb2ZpbGVzKCk7XG5cdFx0ZGVlcFN0cmljdEVxdWFsKHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UuYXZhaWxhYmxlUHJvZmlsZXMsIFtwb3dlcnNoZWxsUHJvZmlsZV0pO1xuXHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmNvbnRyaWJ1dGVkUHJvZmlsZXMsIFtqc2RlYnVnUHJvZmlsZV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgZmlyZSBvbkRpZENoYW5nZUF2YWlsYWJsZVByb2ZpbGVzIG9ubHkgd2hlbiBhdmFpbGFibGUgcHJvZmlsZXMgaGF2ZSBjaGFuZ2VkIHZpYSB1c2VyIGNvbmZpZycsIGFzeW5jICgpID0+IHtcblx0XHRwb3dlcnNoZWxsUHJvZmlsZS5pY29uID0gQ29kaWNvbi5saWdodEJ1bGI7XG5cdFx0bGV0IGNhbGxzOiBJVGVybWluYWxQcm9maWxlW11bXSA9IFtdO1xuXHRcdHN0b3JlLmFkZCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQXZhaWxhYmxlUHJvZmlsZXMoZSA9PiBjYWxscy5wdXNoKGUpKSk7XG5cdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ3Rlcm1pbmFsJywge1xuXHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRwcm9maWxlczoge1xuXHRcdFx0XHRcdHdpbmRvd3M6IHBvd2Vyc2hlbGxQcm9maWxlLFxuXHRcdFx0XHRcdGxpbnV4OiBwb3dlcnNoZWxsUHJvZmlsZSxcblx0XHRcdFx0XHRvc3g6IHBvd2Vyc2hlbGxQcm9maWxlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRhd2FpdCB0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmhhc1JlZnJlc2hlZFByb2ZpbGVzO1xuXHRcdGRlZXBTdHJpY3RFcXVhbChjYWxscywgW1xuXHRcdFx0W3Bvd2Vyc2hlbGxQcm9maWxlXVxuXHRcdF0pO1xuXHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLCBbcG93ZXJzaGVsbFByb2ZpbGVdKTtcblx0XHRkZWVwU3RyaWN0RXF1YWwodGVybWluYWxQcm9maWxlU2VydmljZS5jb250cmlidXRlZFByb2ZpbGVzLCBbanNkZWJ1Z1Byb2ZpbGVdKTtcblx0XHRjYWxscyA9IFtdO1xuXHRcdGF3YWl0IHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UucmVmcmVzaEFuZEF3YWl0QXZhaWxhYmxlUHJvZmlsZXMoKTtcblx0XHRkZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIGZpcmUgb25EaWRDaGFuZ2VBdmFpbGFibGVQcm9maWxlcyB3aGVuIGF2YWlsYWJsZSBvciBjb250cmlidXRlZCBwcm9maWxlcyBoYXZlIGNoYW5nZWQgdmlhIHJlbW90ZS9sb2NhbFRlcm1pbmFsU2VydmljZScsIGFzeW5jICgpID0+IHtcblx0XHRwb3dlcnNoZWxsUHJvZmlsZS5pc0RlZmF1bHQgPSBmYWxzZTtcblx0XHR0ZXJtaW5hbEluc3RhbmNlU2VydmljZS5zZXRQcm9maWxlcyh1bmRlZmluZWQsIFtwb3dlcnNoZWxsUHJvZmlsZV0pO1xuXHRcdGNvbnN0IGNhbGxzOiBJVGVybWluYWxQcm9maWxlW11bXSA9IFtdO1xuXHRcdHN0b3JlLmFkZCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQXZhaWxhYmxlUHJvZmlsZXMoZSA9PiBjYWxscy5wdXNoKGUpKSk7XG5cdFx0YXdhaXQgdGVybWluYWxQcm9maWxlU2VydmljZS5oYXNSZWZyZXNoZWRQcm9maWxlcztcblx0XHRkZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFtcblx0XHRcdFtwb3dlcnNoZWxsUHJvZmlsZV1cblx0XHRdKTtcblx0XHRkZWVwU3RyaWN0RXF1YWwodGVybWluYWxQcm9maWxlU2VydmljZS5hdmFpbGFibGVQcm9maWxlcywgW3Bvd2Vyc2hlbGxQcm9maWxlXSk7XG5cdFx0ZGVlcFN0cmljdEVxdWFsKHRlcm1pbmFsUHJvZmlsZVNlcnZpY2UuY29udHJpYnV0ZWRQcm9maWxlcywgW2pzZGVidWdQcm9maWxlXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCBjYWxsIHJlZnJlc2hBdmFpbGFibGVQcm9maWxlcyBfb25EaWRDaGFuZ2VFeHRlbnNpb25zJywgYXN5bmMgKCkgPT4ge1xuXHRcdGV4dGVuc2lvblNlcnZpY2UuX29uRGlkQ2hhbmdlRXh0ZW5zaW9ucy5maXJlKCk7XG5cdFx0Y29uc3QgY2FsbHM6IElUZXJtaW5hbFByb2ZpbGVbXVtdID0gW107XG5cdFx0c3RvcmUuYWRkKHRlcm1pbmFsUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VBdmFpbGFibGVQcm9maWxlcyhlID0+IGNhbGxzLnB1c2goZSkpKTtcblx0XHRhd2FpdCB0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmhhc1JlZnJlc2hlZFByb2ZpbGVzO1xuXHRcdGRlZXBTdHJpY3RFcXVhbChjYWxscywgW1xuXHRcdFx0W3Bvd2Vyc2hlbGxQcm9maWxlXVxuXHRcdF0pO1xuXHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLCBbcG93ZXJzaGVsbFByb2ZpbGVdKTtcblx0XHRkZWVwU3RyaWN0RXF1YWwodGVybWluYWxQcm9maWxlU2VydmljZS5jb250cmlidXRlZFByb2ZpbGVzLCBbanNkZWJ1Z1Byb2ZpbGVdKTtcblx0fSk7XG5cdHN1aXRlKCdQcm9maWxlcyBRdWlja3BpY2snLCAoKSA9PiB7XG5cdFx0bGV0IHF1aWNrSW5wdXRTZXJ2aWNlOiBNb2NrUXVpY2tJbnB1dFNlcnZpY2U7XG5cdFx0bGV0IG1vY2tUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlOiBNb2NrVGVybWluYWxQcm9maWxlU2VydmljZTtcblx0XHRsZXQgdGVybWluYWxQcm9maWxlUXVpY2twaWNrOiBUZXN0VGVybWluYWxQcm9maWxlUXVpY2twaWNrO1xuXHRcdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRcdHF1aWNrSW5wdXRTZXJ2aWNlID0gbmV3IE1vY2tRdWlja0lucHV0U2VydmljZSgpO1xuXHRcdFx0bW9ja1Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UgPSBuZXcgTW9ja1Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UoKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVF1aWNrSW5wdXRTZXJ2aWNlLCBxdWlja0lucHV0U2VydmljZSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLCBtb2NrVGVybWluYWxQcm9maWxlU2VydmljZSk7XG5cdFx0XHR0ZXJtaW5hbFByb2ZpbGVRdWlja3BpY2sgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VGVybWluYWxQcm9maWxlUXVpY2twaWNrKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzZXREZWZhdWx0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0cG93ZXJzaGVsbFByb2ZpbGUuaXNEZWZhdWx0ID0gZmFsc2U7XG5cdFx0XHRtb2NrVGVybWluYWxQcm9maWxlU2VydmljZS5zZXRQcm9maWxlcyhbcG93ZXJzaGVsbFByb2ZpbGVdLCBbanNkZWJ1Z1Byb2ZpbGVdKTtcblx0XHRcdG1vY2tUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLnNldERlZmF1bHRQcm9maWxlTmFtZShqc2RlYnVnUHJvZmlsZS50aXRsZSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbFByb2ZpbGVRdWlja3BpY2suc2hvd0FuZEdldFJlc3VsdCgnc2V0RGVmYXVsdCcpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgcG93ZXJzaGVsbFByb2ZpbGUucHJvZmlsZU5hbWUpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3NldERlZmF1bHQgdG8gY29udHJpYnV0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRtb2NrVGVybWluYWxQcm9maWxlU2VydmljZS5zZXREZWZhdWx0UHJvZmlsZU5hbWUocG93ZXJzaGVsbFByb2ZpbGUucHJvZmlsZU5hbWUpO1xuXHRcdFx0cXVpY2tJbnB1dFNlcnZpY2Uuc2V0UGljayhqc2RlYnVnUGljayk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXJtaW5hbFByb2ZpbGVRdWlja3BpY2suc2hvd0FuZEdldFJlc3VsdCgnc2V0RGVmYXVsdCcpO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSB7XG5cdFx0XHRcdGNvbmZpZzoge1xuXHRcdFx0XHRcdGV4dGVuc2lvbklkZW50aWZpZXI6IGpzZGVidWdQcm9maWxlLmV4dGVuc2lvbklkZW50aWZpZXIsXG5cdFx0XHRcdFx0aWQ6IGpzZGVidWdQcm9maWxlLmlkLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgY29sb3I6IHVuZGVmaW5lZCwgaWNvbjogJ2RlYnVnJyB9LFxuXHRcdFx0XHRcdHRpdGxlOiBqc2RlYnVnUHJvZmlsZS50aXRsZSxcblx0XHRcdFx0fSxcblx0XHRcdFx0a2V5TW9kczogdW5kZWZpbmVkXG5cdFx0XHR9O1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgZXhwZWN0ZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY3JlYXRlSW5zdGFuY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRtb2NrVGVybWluYWxQcm9maWxlU2VydmljZS5zZXREZWZhdWx0UHJvZmlsZU5hbWUocG93ZXJzaGVsbFByb2ZpbGUucHJvZmlsZU5hbWUpO1xuXHRcdFx0Y29uc3QgcGljayA9IHsgLi4ucG93ZXJzaGVsbFBpY2ssIGtleU1vZHM6IHsgYWx0OiB0cnVlLCBjdHJsQ21kOiBmYWxzZSB9IH07XG5cdFx0XHRxdWlja0lucHV0U2VydmljZS5zZXRQaWNrKHBpY2spO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVybWluYWxQcm9maWxlUXVpY2twaWNrLnNob3dBbmRHZXRSZXN1bHQoJ2NyZWF0ZUluc3RhbmNlJyk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwocmVzdWx0LCB7IGNvbmZpZzogcG93ZXJzaGVsbFByb2ZpbGUsIGtleU1vZHM6IHsgYWx0OiB0cnVlLCBjdHJsQ21kOiBmYWxzZSB9IH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY3JlYXRlSW5zdGFuY2Ugd2l0aCBjb250cmlidXRlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHBpY2sgPSB7IC4uLmpzZGVidWdQaWNrLCBrZXlNb2RzOiB7IGFsdDogdHJ1ZSwgY3RybENtZDogZmFsc2UgfSB9O1xuXHRcdFx0cXVpY2tJbnB1dFNlcnZpY2Uuc2V0UGljayhwaWNrKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlcm1pbmFsUHJvZmlsZVF1aWNrcGljay5zaG93QW5kR2V0UmVzdWx0KCdjcmVhdGVJbnN0YW5jZScpO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSB7XG5cdFx0XHRcdGNvbmZpZzoge1xuXHRcdFx0XHRcdGV4dGVuc2lvbklkZW50aWZpZXI6IGpzZGVidWdQcm9maWxlLmV4dGVuc2lvbklkZW50aWZpZXIsXG5cdFx0XHRcdFx0aWQ6IGpzZGVidWdQcm9maWxlLmlkLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgY29sb3I6IHVuZGVmaW5lZCwgaWNvbjogJ2RlYnVnJyB9LFxuXHRcdFx0XHRcdHRpdGxlOiBqc2RlYnVnUHJvZmlsZS50aXRsZSxcblx0XHRcdFx0fSxcblx0XHRcdFx0a2V5TW9kczogeyBhbHQ6IHRydWUsIGN0cmxDbWQ6IGZhbHNlIH1cblx0XHRcdH07XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBleHBlY3RlZCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxXQUFXLHVCQUF1QjtBQUNwRCxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHFCQUFxQiw2QkFBNkI7QUFDM0QsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBdUIsMEJBQWdEO0FBR3ZFLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQWdDLGdDQUFnQztBQUNoRSxTQUFTLDhCQUE4QjtBQUN2QyxTQUFpQywrQkFBK0I7QUFDaEUsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyw0QkFBNEI7QUFFckMsTUFBTSxtQ0FBbUMsdUJBQW1FO0FBQUEsRUFFbEcsMkJBQWlDO0FBQ3pDLFNBQUssdUJBQXVCLEtBQUssNkJBQTZCO0FBQUEsRUFDL0Q7QUFBQSxFQUNBLG1DQUFrRDtBQUNqRCxTQUFLLHlCQUF5QjtBQUM5QixRQUFJLENBQUMsS0FBSyxzQkFBc0I7QUFDL0IsWUFBTSxJQUFJLE1BQU0sZ0NBQWdDO0FBQUEsSUFDakQ7QUFDQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQ0Q7QUFFQSxNQUFNLDJCQUF1RTtBQUFBLEVBQTdFO0FBR0MsNkJBQXFELENBQUM7QUFDdEQsK0JBQWdFLENBQUM7QUFB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
