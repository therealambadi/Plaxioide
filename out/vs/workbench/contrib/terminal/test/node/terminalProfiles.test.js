import { deepStrictEqual, fail, ok, strictEqual } from "assert";
import { isWindows } from "../../../../../base/common/platform.js";
import { ProfileSource } from "../../../../../platform/terminal/common/terminal.js";
import { detectAvailableProfiles } from "../../../../../platform/terminal/node/terminalProfiles.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
function profilesEqual(actualProfiles, expectedProfiles) {
  strictEqual(actualProfiles.length, expectedProfiles.length, `Actual: ${actualProfiles.map((e) => e.profileName).join(",")}
Expected: ${expectedProfiles.map((e) => e.profileName).join(",")}`);
  for (const expected of expectedProfiles) {
    const actual = actualProfiles.find((e) => e.profileName === expected.profileName);
    ok(actual, `Expected profile ${expected.profileName} not found`);
    strictEqual(actual.profileName, expected.profileName);
    strictEqual(actual.path, expected.path);
    deepStrictEqual(actual.args, expected.args);
    strictEqual(actual.isAutoDetected, expected.isAutoDetected);
    strictEqual(actual.overrideName, expected.overrideName);
  }
}
suite("Workbench - TerminalProfiles", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("detectAvailableProfiles", () => {
    if (isWindows) {
      test("should detect Git Bash and provide login args", async () => {
        const fsProvider = createFsProvider([
          "C:\\Program Files\\Git\\bin\\bash.exe"
        ]);
        const config = {
          profiles: {
            windows: {
              "Git Bash": { source: ProfileSource.GitBash }
            },
            linux: {},
            osx: {}
          },
          useWslProfiles: false
        };
        const configurationService = new TestConfigurationService({ terminal: { integrated: config } });
        const profiles = await detectAvailableProfiles(void 0, void 0, false, configurationService, process.env, fsProvider, void 0, void 0, void 0);
        const expected = [
          { profileName: "Git Bash", path: "C:\\Program Files\\Git\\bin\\bash.exe", args: ["--login", "-i"], isDefault: true }
        ];
        profilesEqual(profiles, expected);
      });
      test("should allow source to have args", async () => {
        const pwshSourcePaths = [
          "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
        ];
        const fsProvider = createFsProvider(pwshSourcePaths);
        const config = {
          profiles: {
            windows: {
              "PowerShell": { source: ProfileSource.Pwsh, args: ["-NoProfile"], overrideName: true }
            },
            linux: {},
            osx: {}
          },
          useWslProfiles: false
        };
        const configurationService = new TestConfigurationService({ terminal: { integrated: config } });
        const profiles = await detectAvailableProfiles(void 0, void 0, false, configurationService, process.env, fsProvider, void 0, void 0, pwshSourcePaths);
        const expected = [
          { profileName: "PowerShell", path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe", overrideName: true, args: ["-NoProfile"], isDefault: true }
        ];
        profilesEqual(profiles, expected);
      });
      test("configured args should override default source ones", async () => {
        const fsProvider = createFsProvider([
          "C:\\Program Files\\Git\\bin\\bash.exe"
        ]);
        const config = {
          profiles: {
            windows: {
              "Git Bash": { source: ProfileSource.GitBash, args: [] }
            },
            linux: {},
            osx: {}
          },
          useWslProfiles: false
        };
        const configurationService = new TestConfigurationService({ terminal: { integrated: config } });
        const profiles = await detectAvailableProfiles(void 0, void 0, false, configurationService, process.env, fsProvider, void 0, void 0, void 0);
        const expected = [{ profileName: "Git Bash", path: "C:\\Program Files\\Git\\bin\\bash.exe", args: [], isAutoDetected: void 0, overrideName: void 0, isDefault: true }];
        profilesEqual(profiles, expected);
      });
      suite("pwsh source detection/fallback", () => {
        const pwshSourceConfig = {
          profiles: {
            windows: {
              "PowerShell": { source: ProfileSource.Pwsh }
            },
            linux: {},
            osx: {}
          },
          useWslProfiles: false
        };
        test("should prefer pwsh 7 to Windows PowerShell", async () => {
          const pwshSourcePaths = [
            "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "C:\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe",
            "C:\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
          ];
          const fsProvider = createFsProvider(pwshSourcePaths);
          const configurationService = new TestConfigurationService({ terminal: { integrated: pwshSourceConfig } });
          const profiles = await detectAvailableProfiles(void 0, void 0, false, configurationService, process.env, fsProvider, void 0, void 0, pwshSourcePaths);
          const expected = [
            { profileName: "PowerShell", path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe", isDefault: true }
          ];
          profilesEqual(profiles, expected);
        });
        test("should prefer pwsh 7 to pwsh 6", async () => {
          const pwshSourcePaths = [
            "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "C:\\Program Files\\PowerShell\\6\\pwsh.exe",
            "C:\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe",
            "C:\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
          ];
          const fsProvider = createFsProvider(pwshSourcePaths);
          const configurationService = new TestConfigurationService({ terminal: { integrated: pwshSourceConfig } });
          const profiles = await detectAvailableProfiles(void 0, void 0, false, configurationService, process.env, fsProvider, void 0, void 0, pwshSourcePaths);
          const expected = [
            { profileName: "PowerShell", path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe", isDefault: true }
          ];
          profilesEqual(profiles, expected);
        });
        test("should fallback to Windows PowerShell", async () => {
          const pwshSourcePaths = [
            "C:\\Windows\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe",
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
          ];
          const fsProvider = createFsProvider(pwshSourcePaths);
          const configurationService = new TestConfigurationService({ terminal: { integrated: pwshSourceConfig } });
          const profiles = await detectAvailableProfiles(void 0, void 0, false, configurationService, process.env, fsProvider, void 0, void 0, pwshSourcePaths);
          strictEqual(profiles.length, 1);
          strictEqual(profiles[0].profileName, "PowerShell");
        });
      });
    } else {
      const absoluteConfig = {
        profiles: {
          windows: {},
          osx: {
            "fakeshell1": { path: "/bin/fakeshell1" },
            "fakeshell2": { path: "/bin/fakeshell2" },
            "fakeshell3": { path: "/bin/fakeshell3" }
          },
          linux: {
            "fakeshell1": { path: "/bin/fakeshell1" },
            "fakeshell2": { path: "/bin/fakeshell2" },
            "fakeshell3": { path: "/bin/fakeshell3" }
          }
        },
        useWslProfiles: false
      };
      const onPathConfig = {
        profiles: {
          windows: {},
          osx: {
            "fakeshell1": { path: "fakeshell1" },
            "fakeshell2": { path: "fakeshell2" },
            "fakeshell3": { path: "fakeshell3" }
          },
          linux: {
            "fakeshell1": { path: "fakeshell1" },
            "fakeshell2": { path: "fakeshell2" },
            "fakeshell3": { path: "fakeshell3" }
          }
        },
        useWslProfiles: false
      };
      test("should detect shells via absolute paths", async () => {
        const fsProvider = createFsProvider([
          "/bin/fakeshell1",
          "/bin/fakeshell3"
        ]);
        const configurationService = new TestConfigurationService({ terminal: { integrated: absoluteConfig } });
        const profiles = await detectAvailableProfiles(void 0, void 0, false, configurationService, process.env, fsProvider, void 0, void 0, void 0);
        const expected = [
          { profileName: "fakeshell1", path: "/bin/fakeshell1", isDefault: true },
          { profileName: "fakeshell3", path: "/bin/fakeshell3", isDefault: true }
        ];
        profilesEqual(profiles, expected);
      });
      test("should auto detect shells via /etc/shells", async () => {
        const fsProvider = createFsProvider([
          "/bin/fakeshell1",
          "/bin/fakeshell3"
        ], "/bin/fakeshell1\n/bin/fakeshell3");
        const configurationService = new TestConfigurationService({ terminal: { integrated: onPathConfig } });
        const profiles = await detectAvailableProfiles(void 0, void 0, true, configurationService, process.env, fsProvider, void 0, void 0, void 0);
        const expected = [
          { profileName: "fakeshell1", path: "/bin/fakeshell1", isFromPath: true, isDefault: true },
          { profileName: "fakeshell3", path: "/bin/fakeshell3", isFromPath: true, isDefault: true }
        ];
        profilesEqual(profiles, expected);
      });
      test("should validate auto detected shells from /etc/shells exist", async () => {
        const fsProvider = createFsProvider([
          "/bin/fakeshell1"
        ], "/bin/fakeshell1\n/bin/fakeshell3");
        const configurationService = new TestConfigurationService({ terminal: { integrated: onPathConfig } });
        const profiles = await detectAvailableProfiles(void 0, void 0, true, configurationService, process.env, fsProvider, void 0, void 0, void 0);
        const expected = [
          { profileName: "fakeshell1", path: "/bin/fakeshell1", isFromPath: true, isDefault: true }
        ];
        profilesEqual(profiles, expected);
      });
    }
  });
  function createFsProvider(expectedPaths, etcShellsContent = "") {
    const provider = {
      async existsFile(path) {
        return expectedPaths.includes(path);
      },
      async readFile(path) {
        if (path !== "/etc/shells") {
          fail("Unexepected path");
        }
        return Buffer.from(etcShellsContent);
      }
    };
    return provider;
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L25vZGUvdGVybWluYWxQcm9maWxlcy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZGVlcFN0cmljdEVxdWFsLCBmYWlsLCBvaywgc3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsUHJvZmlsZSwgUHJvZmlsZVNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb25maWd1cmF0aW9uLCBJVGVybWluYWxQcm9maWxlcyB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBkZXRlY3RBdmFpbGFibGVQcm9maWxlcywgSUZzUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3Rlcm1pbmFsUHJvZmlsZXMuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbi8qKlxuICogQXNzZXRzIHRoYXQgdHdvIHByb2ZpbGVzIG9iamVjdHMgYXJlIGVxdWFsLCB0aGlzIHdpbGwgdHJlYXQgZXhwbGljaXQgdW5kZWZpbmVkIGFuZCB1bnNldFxuICogcHJvcGVydGllcyB0aGUgc2FtZS4gT3JkZXIgb2YgdGhlIHByb2ZpbGVzIGlzIGlnbm9yZWQuXG4gKi9cbmZ1bmN0aW9uIHByb2ZpbGVzRXF1YWwoYWN0dWFsUHJvZmlsZXM6IElUZXJtaW5hbFByb2ZpbGVbXSwgZXhwZWN0ZWRQcm9maWxlczogSVRlcm1pbmFsUHJvZmlsZVtdKSB7XG5cdHN0cmljdEVxdWFsKGFjdHVhbFByb2ZpbGVzLmxlbmd0aCwgZXhwZWN0ZWRQcm9maWxlcy5sZW5ndGgsIGBBY3R1YWw6ICR7YWN0dWFsUHJvZmlsZXMubWFwKGUgPT4gZS5wcm9maWxlTmFtZSkuam9pbignLCcpfVxcbkV4cGVjdGVkOiAke2V4cGVjdGVkUHJvZmlsZXMubWFwKGUgPT4gZS5wcm9maWxlTmFtZSkuam9pbignLCcpfWApO1xuXHRmb3IgKGNvbnN0IGV4cGVjdGVkIG9mIGV4cGVjdGVkUHJvZmlsZXMpIHtcblx0XHRjb25zdCBhY3R1YWwgPSBhY3R1YWxQcm9maWxlcy5maW5kKGUgPT4gZS5wcm9maWxlTmFtZSA9PT0gZXhwZWN0ZWQucHJvZmlsZU5hbWUpO1xuXHRcdG9rKGFjdHVhbCwgYEV4cGVjdGVkIHByb2ZpbGUgJHtleHBlY3RlZC5wcm9maWxlTmFtZX0gbm90IGZvdW5kYCk7XG5cdFx0c3RyaWN0RXF1YWwoYWN0dWFsLnByb2ZpbGVOYW1lLCBleHBlY3RlZC5wcm9maWxlTmFtZSk7XG5cdFx0c3RyaWN0RXF1YWwoYWN0dWFsLnBhdGgsIGV4cGVjdGVkLnBhdGgpO1xuXHRcdGRlZXBTdHJpY3RFcXVhbChhY3R1YWwuYXJncywgZXhwZWN0ZWQuYXJncyk7XG5cdFx0c3RyaWN0RXF1YWwoYWN0dWFsLmlzQXV0b0RldGVjdGVkLCBleHBlY3RlZC5pc0F1dG9EZXRlY3RlZCk7XG5cdFx0c3RyaWN0RXF1YWwoYWN0dWFsLm92ZXJyaWRlTmFtZSwgZXhwZWN0ZWQub3ZlcnJpZGVOYW1lKTtcblx0fVxufVxuXG5zdWl0ZSgnV29ya2JlbmNoIC0gVGVybWluYWxQcm9maWxlcycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c3VpdGUoJ2RldGVjdEF2YWlsYWJsZVByb2ZpbGVzJywgKCkgPT4ge1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdHRlc3QoJ3Nob3VsZCBkZXRlY3QgR2l0IEJhc2ggYW5kIHByb3ZpZGUgbG9naW4gYXJncycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZnNQcm92aWRlciA9IGNyZWF0ZUZzUHJvdmlkZXIoW1xuXHRcdFx0XHRcdCdDOlxcXFxQcm9ncmFtIEZpbGVzXFxcXEdpdFxcXFxiaW5cXFxcYmFzaC5leGUnXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRjb25zdCBjb25maWc6IElUZXN0VGVybWluYWxDb25maWcgPSB7XG5cdFx0XHRcdFx0cHJvZmlsZXM6IHtcblx0XHRcdFx0XHRcdHdpbmRvd3M6IHtcblx0XHRcdFx0XHRcdFx0J0dpdCBCYXNoJzogeyBzb3VyY2U6IFByb2ZpbGVTb3VyY2UuR2l0QmFzaCB9XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0bGludXg6IHt9LFxuXHRcdFx0XHRcdFx0b3N4OiB7fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dXNlV3NsUHJvZmlsZXM6IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IGNvbmZpZyB9IH0pO1xuXHRcdFx0XHRjb25zdCBwcm9maWxlcyA9IGF3YWl0IGRldGVjdEF2YWlsYWJsZVByb2ZpbGVzKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHByb2Nlc3MuZW52LCBmc1Byb3ZpZGVyLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRcdFx0eyBwcm9maWxlTmFtZTogJ0dpdCBCYXNoJywgcGF0aDogJ0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcR2l0XFxcXGJpblxcXFxiYXNoLmV4ZScsIGFyZ3M6IFsnLS1sb2dpbicsICctaSddLCBpc0RlZmF1bHQ6IHRydWUgfVxuXHRcdFx0XHRdO1xuXHRcdFx0XHRwcm9maWxlc0VxdWFsKHByb2ZpbGVzLCBleHBlY3RlZCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBhbGxvdyBzb3VyY2UgdG8gaGF2ZSBhcmdzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBwd3NoU291cmNlUGF0aHMgPSBbXG5cdFx0XHRcdFx0J0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcUG93ZXJTaGVsbFxcXFw3XFxcXHB3c2guZXhlJ1xuXHRcdFx0XHRdO1xuXHRcdFx0XHRjb25zdCBmc1Byb3ZpZGVyID0gY3JlYXRlRnNQcm92aWRlcihwd3NoU291cmNlUGF0aHMpO1xuXHRcdFx0XHRjb25zdCBjb25maWc6IElUZXN0VGVybWluYWxDb25maWcgPSB7XG5cdFx0XHRcdFx0cHJvZmlsZXM6IHtcblx0XHRcdFx0XHRcdHdpbmRvd3M6IHtcblx0XHRcdFx0XHRcdFx0J1Bvd2VyU2hlbGwnOiB7IHNvdXJjZTogUHJvZmlsZVNvdXJjZS5Qd3NoLCBhcmdzOiBbJy1Ob1Byb2ZpbGUnXSwgb3ZlcnJpZGVOYW1lOiB0cnVlIH1cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRsaW51eDoge30sXG5cdFx0XHRcdFx0XHRvc3g6IHt9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dXNlV3NsUHJvZmlsZXM6IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IGNvbmZpZyB9IH0pO1xuXHRcdFx0XHRjb25zdCBwcm9maWxlcyA9IGF3YWl0IGRldGVjdEF2YWlsYWJsZVByb2ZpbGVzKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHByb2Nlc3MuZW52LCBmc1Byb3ZpZGVyLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcHdzaFNvdXJjZVBhdGhzKTtcblx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRcdFx0eyBwcm9maWxlTmFtZTogJ1Bvd2VyU2hlbGwnLCBwYXRoOiAnQzpcXFxcUHJvZ3JhbSBGaWxlc1xcXFxQb3dlclNoZWxsXFxcXDdcXFxccHdzaC5leGUnLCBvdmVycmlkZU5hbWU6IHRydWUsIGFyZ3M6IFsnLU5vUHJvZmlsZSddLCBpc0RlZmF1bHQ6IHRydWUgfVxuXHRcdFx0XHRdO1xuXHRcdFx0XHRwcm9maWxlc0VxdWFsKHByb2ZpbGVzLCBleHBlY3RlZCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2NvbmZpZ3VyZWQgYXJncyBzaG91bGQgb3ZlcnJpZGUgZGVmYXVsdCBzb3VyY2Ugb25lcycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZnNQcm92aWRlciA9IGNyZWF0ZUZzUHJvdmlkZXIoW1xuXHRcdFx0XHRcdCdDOlxcXFxQcm9ncmFtIEZpbGVzXFxcXEdpdFxcXFxiaW5cXFxcYmFzaC5leGUnXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRjb25zdCBjb25maWc6IElUZXN0VGVybWluYWxDb25maWcgPSB7XG5cdFx0XHRcdFx0cHJvZmlsZXM6IHtcblx0XHRcdFx0XHRcdHdpbmRvd3M6IHtcblx0XHRcdFx0XHRcdFx0J0dpdCBCYXNoJzogeyBzb3VyY2U6IFByb2ZpbGVTb3VyY2UuR2l0QmFzaCwgYXJnczogW10gfVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGxpbnV4OiB7fSxcblx0XHRcdFx0XHRcdG9zeDoge31cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHVzZVdzbFByb2ZpbGVzOiBmYWxzZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyB0ZXJtaW5hbDogeyBpbnRlZ3JhdGVkOiBjb25maWcgfSB9KTtcblx0XHRcdFx0Y29uc3QgcHJvZmlsZXMgPSBhd2FpdCBkZXRlY3RBdmFpbGFibGVQcm9maWxlcyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBwcm9jZXNzLmVudiwgZnNQcm92aWRlciwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkID0gW3sgcHJvZmlsZU5hbWU6ICdHaXQgQmFzaCcsIHBhdGg6ICdDOlxcXFxQcm9ncmFtIEZpbGVzXFxcXEdpdFxcXFxiaW5cXFxcYmFzaC5leGUnLCBhcmdzOiBbXSwgaXNBdXRvRGV0ZWN0ZWQ6IHVuZGVmaW5lZCwgb3ZlcnJpZGVOYW1lOiB1bmRlZmluZWQsIGlzRGVmYXVsdDogdHJ1ZSB9XTtcblx0XHRcdFx0cHJvZmlsZXNFcXVhbChwcm9maWxlcywgZXhwZWN0ZWQpO1xuXHRcdFx0fSk7XG5cdFx0XHRzdWl0ZSgncHdzaCBzb3VyY2UgZGV0ZWN0aW9uL2ZhbGxiYWNrJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBwd3NoU291cmNlQ29uZmlnID0gKHtcblx0XHRcdFx0XHRwcm9maWxlczoge1xuXHRcdFx0XHRcdFx0d2luZG93czoge1xuXHRcdFx0XHRcdFx0XHQnUG93ZXJTaGVsbCc6IHsgc291cmNlOiBQcm9maWxlU291cmNlLlB3c2ggfVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGxpbnV4OiB7fSxcblx0XHRcdFx0XHRcdG9zeDoge30sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR1c2VXc2xQcm9maWxlczogZmFsc2Vcblx0XHRcdFx0fSBhcyBJVGVzdFRlcm1pbmFsQ29uZmlnKSBhcyBJVGVybWluYWxDb25maWd1cmF0aW9uO1xuXG5cdFx0XHRcdHRlc3QoJ3Nob3VsZCBwcmVmZXIgcHdzaCA3IHRvIFdpbmRvd3MgUG93ZXJTaGVsbCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBwd3NoU291cmNlUGF0aHMgPSBbXG5cdFx0XHRcdFx0XHQnQzpcXFxcUHJvZ3JhbSBGaWxlc1xcXFxQb3dlclNoZWxsXFxcXDdcXFxccHdzaC5leGUnLFxuXHRcdFx0XHRcdFx0J0M6XFxcXFN5c25hdGl2ZVxcXFxXaW5kb3dzUG93ZXJTaGVsbFxcXFx2MS4wXFxcXHBvd2Vyc2hlbGwuZXhlJyxcblx0XHRcdFx0XHRcdCdDOlxcXFxTeXN0ZW0zMlxcXFxXaW5kb3dzUG93ZXJTaGVsbFxcXFx2MS4wXFxcXHBvd2Vyc2hlbGwuZXhlJ1xuXHRcdFx0XHRcdF07XG5cdFx0XHRcdFx0Y29uc3QgZnNQcm92aWRlciA9IGNyZWF0ZUZzUHJvdmlkZXIocHdzaFNvdXJjZVBhdGhzKTtcblx0XHRcdFx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyB0ZXJtaW5hbDogeyBpbnRlZ3JhdGVkOiBwd3NoU291cmNlQ29uZmlnIH0gfSk7XG5cdFx0XHRcdFx0Y29uc3QgcHJvZmlsZXMgPSBhd2FpdCBkZXRlY3RBdmFpbGFibGVQcm9maWxlcyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBwcm9jZXNzLmVudiwgZnNQcm92aWRlciwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHB3c2hTb3VyY2VQYXRocyk7XG5cdFx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRcdFx0XHR7IHByb2ZpbGVOYW1lOiAnUG93ZXJTaGVsbCcsIHBhdGg6ICdDOlxcXFxQcm9ncmFtIEZpbGVzXFxcXFBvd2VyU2hlbGxcXFxcN1xcXFxwd3NoLmV4ZScsIGlzRGVmYXVsdDogdHJ1ZSB9XG5cdFx0XHRcdFx0XTtcblx0XHRcdFx0XHRwcm9maWxlc0VxdWFsKHByb2ZpbGVzLCBleHBlY3RlZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXN0KCdzaG91bGQgcHJlZmVyIHB3c2ggNyB0byBwd3NoIDYnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcHdzaFNvdXJjZVBhdGhzID0gW1xuXHRcdFx0XHRcdFx0J0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcUG93ZXJTaGVsbFxcXFw3XFxcXHB3c2guZXhlJyxcblx0XHRcdFx0XHRcdCdDOlxcXFxQcm9ncmFtIEZpbGVzXFxcXFBvd2VyU2hlbGxcXFxcNlxcXFxwd3NoLmV4ZScsXG5cdFx0XHRcdFx0XHQnQzpcXFxcU3lzbmF0aXZlXFxcXFdpbmRvd3NQb3dlclNoZWxsXFxcXHYxLjBcXFxccG93ZXJzaGVsbC5leGUnLFxuXHRcdFx0XHRcdFx0J0M6XFxcXFN5c3RlbTMyXFxcXFdpbmRvd3NQb3dlclNoZWxsXFxcXHYxLjBcXFxccG93ZXJzaGVsbC5leGUnXG5cdFx0XHRcdFx0XTtcblx0XHRcdFx0XHRjb25zdCBmc1Byb3ZpZGVyID0gY3JlYXRlRnNQcm92aWRlcihwd3NoU291cmNlUGF0aHMpO1xuXHRcdFx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHB3c2hTb3VyY2VDb25maWcgfSB9KTtcblx0XHRcdFx0XHRjb25zdCBwcm9maWxlcyA9IGF3YWl0IGRldGVjdEF2YWlsYWJsZVByb2ZpbGVzKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHByb2Nlc3MuZW52LCBmc1Byb3ZpZGVyLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcHdzaFNvdXJjZVBhdGhzKTtcblx0XHRcdFx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdFx0XHRcdHsgcHJvZmlsZU5hbWU6ICdQb3dlclNoZWxsJywgcGF0aDogJ0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcUG93ZXJTaGVsbFxcXFw3XFxcXHB3c2guZXhlJywgaXNEZWZhdWx0OiB0cnVlIH1cblx0XHRcdFx0XHRdO1xuXHRcdFx0XHRcdHByb2ZpbGVzRXF1YWwocHJvZmlsZXMsIGV4cGVjdGVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ3Nob3VsZCBmYWxsYmFjayB0byBXaW5kb3dzIFBvd2VyU2hlbGwnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcHdzaFNvdXJjZVBhdGhzID0gW1xuXHRcdFx0XHRcdFx0J0M6XFxcXFdpbmRvd3NcXFxcU3lzbmF0aXZlXFxcXFdpbmRvd3NQb3dlclNoZWxsXFxcXHYxLjBcXFxccG93ZXJzaGVsbC5leGUnLFxuXHRcdFx0XHRcdFx0J0M6XFxcXFdpbmRvd3NcXFxcU3lzdGVtMzJcXFxcV2luZG93c1Bvd2VyU2hlbGxcXFxcdjEuMFxcXFxwb3dlcnNoZWxsLmV4ZSdcblx0XHRcdFx0XHRdO1xuXHRcdFx0XHRcdGNvbnN0IGZzUHJvdmlkZXIgPSBjcmVhdGVGc1Byb3ZpZGVyKHB3c2hTb3VyY2VQYXRocyk7XG5cdFx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKHsgdGVybWluYWw6IHsgaW50ZWdyYXRlZDogcHdzaFNvdXJjZUNvbmZpZyB9IH0pO1xuXHRcdFx0XHRcdGNvbnN0IHByb2ZpbGVzID0gYXdhaXQgZGV0ZWN0QXZhaWxhYmxlUHJvZmlsZXModW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgcHJvY2Vzcy5lbnYsIGZzUHJvdmlkZXIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBwd3NoU291cmNlUGF0aHMpO1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKHByb2ZpbGVzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwocHJvZmlsZXNbMF0ucHJvZmlsZU5hbWUsICdQb3dlclNoZWxsJyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGFic29sdXRlQ29uZmlnID0gKHtcblx0XHRcdFx0cHJvZmlsZXM6IHtcblx0XHRcdFx0XHR3aW5kb3dzOiB7fSxcblx0XHRcdFx0XHRvc3g6IHtcblx0XHRcdFx0XHRcdCdmYWtlc2hlbGwxJzogeyBwYXRoOiAnL2Jpbi9mYWtlc2hlbGwxJyB9LFxuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDInOiB7IHBhdGg6ICcvYmluL2Zha2VzaGVsbDInIH0sXG5cdFx0XHRcdFx0XHQnZmFrZXNoZWxsMyc6IHsgcGF0aDogJy9iaW4vZmFrZXNoZWxsMycgfVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bGludXg6IHtcblx0XHRcdFx0XHRcdCdmYWtlc2hlbGwxJzogeyBwYXRoOiAnL2Jpbi9mYWtlc2hlbGwxJyB9LFxuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDInOiB7IHBhdGg6ICcvYmluL2Zha2VzaGVsbDInIH0sXG5cdFx0XHRcdFx0XHQnZmFrZXNoZWxsMyc6IHsgcGF0aDogJy9iaW4vZmFrZXNoZWxsMycgfVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0dXNlV3NsUHJvZmlsZXM6IGZhbHNlXG5cdFx0XHR9IGFzIElUZXN0VGVybWluYWxDb25maWcpIGFzIElUZXJtaW5hbENvbmZpZ3VyYXRpb247XG5cdFx0XHRjb25zdCBvblBhdGhDb25maWcgPSAoe1xuXHRcdFx0XHRwcm9maWxlczoge1xuXHRcdFx0XHRcdHdpbmRvd3M6IHt9LFxuXHRcdFx0XHRcdG9zeDoge1xuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDEnOiB7IHBhdGg6ICdmYWtlc2hlbGwxJyB9LFxuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDInOiB7IHBhdGg6ICdmYWtlc2hlbGwyJyB9LFxuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDMnOiB7IHBhdGg6ICdmYWtlc2hlbGwzJyB9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRsaW51eDoge1xuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDEnOiB7IHBhdGg6ICdmYWtlc2hlbGwxJyB9LFxuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDInOiB7IHBhdGg6ICdmYWtlc2hlbGwyJyB9LFxuXHRcdFx0XHRcdFx0J2Zha2VzaGVsbDMnOiB7IHBhdGg6ICdmYWtlc2hlbGwzJyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR1c2VXc2xQcm9maWxlczogZmFsc2Vcblx0XHRcdH0gYXMgSVRlc3RUZXJtaW5hbENvbmZpZykgYXMgSVRlcm1pbmFsQ29uZmlndXJhdGlvbjtcblxuXHRcdFx0dGVzdCgnc2hvdWxkIGRldGVjdCBzaGVsbHMgdmlhIGFic29sdXRlIHBhdGhzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBmc1Byb3ZpZGVyID0gY3JlYXRlRnNQcm92aWRlcihbXG5cdFx0XHRcdFx0Jy9iaW4vZmFrZXNoZWxsMScsXG5cdFx0XHRcdFx0Jy9iaW4vZmFrZXNoZWxsMydcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IGFic29sdXRlQ29uZmlnIH0gfSk7XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGVzID0gYXdhaXQgZGV0ZWN0QXZhaWxhYmxlUHJvZmlsZXModW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgcHJvY2Vzcy5lbnYsIGZzUHJvdmlkZXIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZDogSVRlcm1pbmFsUHJvZmlsZVtdID0gW1xuXHRcdFx0XHRcdHsgcHJvZmlsZU5hbWU6ICdmYWtlc2hlbGwxJywgcGF0aDogJy9iaW4vZmFrZXNoZWxsMScsIGlzRGVmYXVsdDogdHJ1ZSB9LFxuXHRcdFx0XHRcdHsgcHJvZmlsZU5hbWU6ICdmYWtlc2hlbGwzJywgcGF0aDogJy9iaW4vZmFrZXNoZWxsMycsIGlzRGVmYXVsdDogdHJ1ZSB9XG5cdFx0XHRcdF07XG5cdFx0XHRcdHByb2ZpbGVzRXF1YWwocHJvZmlsZXMsIGV4cGVjdGVkKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGF1dG8gZGV0ZWN0IHNoZWxscyB2aWEgL2V0Yy9zaGVsbHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZzUHJvdmlkZXIgPSBjcmVhdGVGc1Byb3ZpZGVyKFtcblx0XHRcdFx0XHQnL2Jpbi9mYWtlc2hlbGwxJyxcblx0XHRcdFx0XHQnL2Jpbi9mYWtlc2hlbGwzJ1xuXHRcdFx0XHRdLCAnL2Jpbi9mYWtlc2hlbGwxXFxuL2Jpbi9mYWtlc2hlbGwzJyk7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IG9uUGF0aENvbmZpZyB9IH0pO1xuXHRcdFx0XHRjb25zdCBwcm9maWxlcyA9IGF3YWl0IGRldGVjdEF2YWlsYWJsZVByb2ZpbGVzKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlLCBjb25maWd1cmF0aW9uU2VydmljZSwgcHJvY2Vzcy5lbnYsIGZzUHJvdmlkZXIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZDogSVRlcm1pbmFsUHJvZmlsZVtdID0gW1xuXHRcdFx0XHRcdHsgcHJvZmlsZU5hbWU6ICdmYWtlc2hlbGwxJywgcGF0aDogJy9iaW4vZmFrZXNoZWxsMScsIGlzRnJvbVBhdGg6IHRydWUsIGlzRGVmYXVsdDogdHJ1ZSB9LFxuXHRcdFx0XHRcdHsgcHJvZmlsZU5hbWU6ICdmYWtlc2hlbGwzJywgcGF0aDogJy9iaW4vZmFrZXNoZWxsMycsIGlzRnJvbVBhdGg6IHRydWUsIGlzRGVmYXVsdDogdHJ1ZSB9XG5cdFx0XHRcdF07XG5cdFx0XHRcdHByb2ZpbGVzRXF1YWwocHJvZmlsZXMsIGV4cGVjdGVkKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIHZhbGlkYXRlIGF1dG8gZGV0ZWN0ZWQgc2hlbGxzIGZyb20gL2V0Yy9zaGVsbHMgZXhpc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdC8vIGZha2VzaGVsbDMgZXhpc3RzIGluIC9ldGMvc2hlbGxzIGJ1dCBub3Qgb24gRlNcblx0XHRcdFx0Y29uc3QgZnNQcm92aWRlciA9IGNyZWF0ZUZzUHJvdmlkZXIoW1xuXHRcdFx0XHRcdCcvYmluL2Zha2VzaGVsbDEnXG5cdFx0XHRcdF0sICcvYmluL2Zha2VzaGVsbDFcXG4vYmluL2Zha2VzaGVsbDMnKTtcblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKHsgdGVybWluYWw6IHsgaW50ZWdyYXRlZDogb25QYXRoQ29uZmlnIH0gfSk7XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGVzID0gYXdhaXQgZGV0ZWN0QXZhaWxhYmxlUHJvZmlsZXModW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBwcm9jZXNzLmVudiwgZnNQcm92aWRlciwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkOiBJVGVybWluYWxQcm9maWxlW10gPSBbXG5cdFx0XHRcdFx0eyBwcm9maWxlTmFtZTogJ2Zha2VzaGVsbDEnLCBwYXRoOiAnL2Jpbi9mYWtlc2hlbGwxJywgaXNGcm9tUGF0aDogdHJ1ZSwgaXNEZWZhdWx0OiB0cnVlIH1cblx0XHRcdFx0XTtcblx0XHRcdFx0cHJvZmlsZXNFcXVhbChwcm9maWxlcywgZXhwZWN0ZWQpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVGc1Byb3ZpZGVyKGV4cGVjdGVkUGF0aHM6IHN0cmluZ1tdLCBldGNTaGVsbHNDb250ZW50OiBzdHJpbmcgPSAnJyk6IElGc1Byb3ZpZGVyIHtcblx0XHRjb25zdCBwcm92aWRlciA9IHtcblx0XHRcdGFzeW5jIGV4aXN0c0ZpbGUocGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0XHRcdHJldHVybiBleHBlY3RlZFBhdGhzLmluY2x1ZGVzKHBhdGgpO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIHJlYWRGaWxlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8QnVmZmVyPiB7XG5cdFx0XHRcdGlmIChwYXRoICE9PSAnL2V0Yy9zaGVsbHMnKSB7XG5cdFx0XHRcdFx0ZmFpbCgnVW5leGVwZWN0ZWQgcGF0aCcpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBCdWZmZXIuZnJvbShldGNTaGVsbHNDb250ZW50KTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBwcm92aWRlcjtcblx0fVxufSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RUZXJtaW5hbENvbmZpZyB7XG5cdHByb2ZpbGVzOiBJVGVybWluYWxQcm9maWxlcztcblx0dXNlV3NsUHJvZmlsZXM6IGJvb2xlYW47XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGlCQUFpQixNQUFNLElBQUksbUJBQW1CO0FBQ3ZELFNBQVMsaUJBQWlCO0FBQzFCLFNBQTJCLHFCQUFxQjtBQUVoRCxTQUFTLCtCQUE0QztBQUNyRCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLCtDQUErQztBQU14RCxTQUFTLGNBQWMsZ0JBQW9DLGtCQUFzQztBQUNoRyxjQUFZLGVBQWUsUUFBUSxpQkFBaUIsUUFBUSxXQUFXLGVBQWUsSUFBSSxPQUFLLEVBQUUsV0FBVyxFQUFFLEtBQUssR0FBRyxDQUFDO0FBQUEsWUFBZSxpQkFBaUIsSUFBSSxPQUFLLEVBQUUsV0FBVyxFQUFFLEtBQUssR0FBRyxDQUFDLEVBQUU7QUFDMUwsYUFBVyxZQUFZLGtCQUFrQjtBQUN4QyxVQUFNLFNBQVMsZUFBZSxLQUFLLE9BQUssRUFBRSxnQkFBZ0IsU0FBUyxXQUFXO0FBQzlFLE9BQUcsUUFBUSxvQkFBb0IsU0FBUyxXQUFXLFlBQVk7QUFDL0QsZ0JBQVksT0FBTyxhQUFhLFNBQVMsV0FBVztBQUNwRCxnQkFBWSxPQUFPLE1BQU0sU0FBUyxJQUFJO0FBQ3RDLG9CQUFnQixPQUFPLE1BQU0sU0FBUyxJQUFJO0FBQzFDLGdCQUFZLE9BQU8sZ0JBQWdCLFNBQVMsY0FBYztBQUMxRCxnQkFBWSxPQUFPLGNBQWMsU0FBUyxZQUFZO0FBQUEsRUFDdkQ7QUFDRDtBQUVBLE1BQU0sZ0NBQWdDLE1BQU07QUFDM0MsMENBQXdDO0FBRXhDLFFBQU0sMkJBQTJCLE1BQU07QUFDdEMsUUFBSSxXQUFXO0FBQ2QsV0FBSyxpREFBaUQsWUFBWTtBQUNqRSxjQUFNLGFBQWEsaUJBQWlCO0FBQUEsVUFDbkM7QUFBQSxRQUNELENBQUM7QUFDRCxjQUFNLFNBQThCO0FBQUEsVUFDbkMsVUFBVTtBQUFBLFlBQ1QsU0FBUztBQUFBLGNBQ1IsWUFBWSxFQUFFLFFBQVEsY0FBYyxRQUFRO0FBQUEsWUFDN0M7QUFBQSxZQUNBLE9BQU8sQ0FBQztBQUFBLFlBQ1IsS0FBSyxDQUFDO0FBQUEsVUFDUDtBQUFBLFVBQ0EsZ0JBQWdCO0FBQUEsUUFDakI7QUFDQSxjQUFNLHVCQUF1QixJQUFJLHlCQUF5QixFQUFFLFVBQVUsRUFBRSxZQUFZLE9BQU8sRUFBRSxDQUFDO0FBQzlGLGNBQU0sV0FBVyxNQUFNLHdCQUF3QixRQUFXLFFBQVcsT0FBTyxzQkFBc0IsUUFBUSxLQUFLLFlBQVksUUFBVyxRQUFXLE1BQVM7QUFDMUosY0FBTSxXQUFXO0FBQUEsVUFDaEIsRUFBRSxhQUFhLFlBQVksTUFBTSx5Q0FBeUMsTUFBTSxDQUFDLFdBQVcsSUFBSSxHQUFHLFdBQVcsS0FBSztBQUFBLFFBQ3BIO0FBQ0Esc0JBQWMsVUFBVSxRQUFRO0FBQUEsTUFDakMsQ0FBQztBQUNELFdBQUssb0NBQW9DLFlBQVk7QUFDcEQsY0FBTSxrQkFBa0I7QUFBQSxVQUN2QjtBQUFBLFFBQ0Q7QUFDQSxjQUFNLGFBQWEsaUJBQWlCLGVBQWU7QUFDbkQsY0FBTSxTQUE4QjtBQUFBLFVBQ25DLFVBQVU7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNSLGNBQWMsRUFBRSxRQUFRLGNBQWMsTUFBTSxNQUFNLENBQUMsWUFBWSxHQUFHLGNBQWMsS0FBSztBQUFBLFlBQ3RGO0FBQUEsWUFDQSxPQUFPLENBQUM7QUFBQSxZQUNSLEtBQUssQ0FBQztBQUFBLFVBQ1A7QUFBQSxVQUNBLGdCQUFnQjtBQUFBLFFBQ2pCO0FBQ0EsY0FBTSx1QkFBdUIsSUFBSSx5QkFBeUIsRUFBRSxVQUFVLEVBQUUsWUFBWSxPQUFPLEVBQUUsQ0FBQztBQUM5RixjQUFNLFdBQVcsTUFBTSx3QkFBd0IsUUFBVyxRQUFXLE9BQU8sc0JBQXNCLFFBQVEsS0FBSyxZQUFZLFFBQVcsUUFBVyxlQUFlO0FBQ2hLLGNBQU0sV0FBVztBQUFBLFVBQ2hCLEVBQUUsYUFBYSxjQUFjLE1BQU0sOENBQThDLGNBQWMsTUFBTSxNQUFNLENBQUMsWUFBWSxHQUFHLFdBQVcsS0FBSztBQUFBLFFBQzVJO0FBQ0Esc0JBQWMsVUFBVSxRQUFRO0FBQUEsTUFDakMsQ0FBQztBQUNELFdBQUssdURBQXVELFlBQVk7QUFDdkUsY0FBTSxhQUFhLGlCQUFpQjtBQUFBLFVBQ25DO0FBQUEsUUFDRCxDQUFDO0FBQ0QsY0FBTSxTQUE4QjtBQUFBLFVBQ25DLFVBQVU7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNSLFlBQVksRUFBRSxRQUFRLGNBQWMsU0FBUyxNQUFNLENBQUMsRUFBRTtBQUFBLFlBQ3ZEO0FBQUEsWUFDQSxPQUFPLENBQUM7QUFBQSxZQUNSLEtBQUssQ0FBQztBQUFBLFVBQ1A7QUFBQSxVQUNBLGdCQUFnQjtBQUFBLFFBQ2pCO0FBQ0EsY0FBTSx1QkFBdUIsSUFBSSx5QkFBeUIsRUFBRSxVQUFVLEVBQUUsWUFBWSxPQUFPLEVBQUUsQ0FBQztBQUM5RixjQUFNLFdBQVcsTUFBTSx3QkFBd0IsUUFBVyxRQUFXLE9BQU8sc0JBQXNCLFFBQVEsS0FBSyxZQUFZLFFBQVcsUUFBVyxNQUFTO0FBQzFKLGNBQU0sV0FBVyxDQUFDLEVBQUUsYUFBYSxZQUFZLE1BQU0seUNBQXlDLE1BQU0sQ0FBQyxHQUFHLGdCQUFnQixRQUFXLGNBQWMsUUFBVyxXQUFXLEtBQUssQ0FBQztBQUMzSyxzQkFBYyxVQUFVLFFBQVE7QUFBQSxNQUNqQyxDQUFDO0FBQ0QsWUFBTSxrQ0FBa0MsTUFBTTtBQUM3QyxjQUFNLG1CQUFvQjtBQUFBLFVBQ3pCLFVBQVU7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNSLGNBQWMsRUFBRSxRQUFRLGNBQWMsS0FBSztBQUFBLFlBQzVDO0FBQUEsWUFDQSxPQUFPLENBQUM7QUFBQSxZQUNSLEtBQUssQ0FBQztBQUFBLFVBQ1A7QUFBQSxVQUNBLGdCQUFnQjtBQUFBLFFBQ2pCO0FBRUEsYUFBSyw4Q0FBOEMsWUFBWTtBQUM5RCxnQkFBTSxrQkFBa0I7QUFBQSxZQUN2QjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsVUFDRDtBQUNBLGdCQUFNLGFBQWEsaUJBQWlCLGVBQWU7QUFDbkQsZ0JBQU0sdUJBQXVCLElBQUkseUJBQXlCLEVBQUUsVUFBVSxFQUFFLFlBQVksaUJBQWlCLEVBQUUsQ0FBQztBQUN4RyxnQkFBTSxXQUFXLE1BQU0sd0JBQXdCLFFBQVcsUUFBVyxPQUFPLHNCQUFzQixRQUFRLEtBQUssWUFBWSxRQUFXLFFBQVcsZUFBZTtBQUNoSyxnQkFBTSxXQUFXO0FBQUEsWUFDaEIsRUFBRSxhQUFhLGNBQWMsTUFBTSw4Q0FBOEMsV0FBVyxLQUFLO0FBQUEsVUFDbEc7QUFDQSx3QkFBYyxVQUFVLFFBQVE7QUFBQSxRQUNqQyxDQUFDO0FBQ0QsYUFBSyxrQ0FBa0MsWUFBWTtBQUNsRCxnQkFBTSxrQkFBa0I7QUFBQSxZQUN2QjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0Q7QUFDQSxnQkFBTSxhQUFhLGlCQUFpQixlQUFlO0FBQ25ELGdCQUFNLHVCQUF1QixJQUFJLHlCQUF5QixFQUFFLFVBQVUsRUFBRSxZQUFZLGlCQUFpQixFQUFFLENBQUM7QUFDeEcsZ0JBQU0sV0FBVyxNQUFNLHdCQUF3QixRQUFXLFFBQVcsT0FBTyxzQkFBc0IsUUFBUSxLQUFLLFlBQVksUUFBVyxRQUFXLGVBQWU7QUFDaEssZ0JBQU0sV0FBVztBQUFBLFlBQ2hCLEVBQUUsYUFBYSxjQUFjLE1BQU0sOENBQThDLFdBQVcsS0FBSztBQUFBLFVBQ2xHO0FBQ0Esd0JBQWMsVUFBVSxRQUFRO0FBQUEsUUFDakMsQ0FBQztBQUNELGFBQUsseUNBQXlDLFlBQVk7QUFDekQsZ0JBQU0sa0JBQWtCO0FBQUEsWUFDdkI7QUFBQSxZQUNBO0FBQUEsVUFDRDtBQUNBLGdCQUFNLGFBQWEsaUJBQWlCLGVBQWU7QUFDbkQsZ0JBQU0sdUJBQXVCLElBQUkseUJBQXlCLEVBQUUsVUFBVSxFQUFFLFlBQVksaUJBQWlCLEVBQUUsQ0FBQztBQUN4RyxnQkFBTSxXQUFXLE1BQU0sd0JBQXdCLFFBQVcsUUFBVyxPQUFPLHNCQUFzQixRQUFRLEtBQUssWUFBWSxRQUFXLFFBQVcsZUFBZTtBQUNoSyxzQkFBWSxTQUFTLFFBQVEsQ0FBQztBQUM5QixzQkFBWSxTQUFTLENBQUMsRUFBRSxhQUFhLFlBQVk7QUFBQSxRQUNsRCxDQUFDO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDRixPQUFPO0FBQ04sWUFBTSxpQkFBa0I7QUFBQSxRQUN2QixVQUFVO0FBQUEsVUFDVCxTQUFTLENBQUM7QUFBQSxVQUNWLEtBQUs7QUFBQSxZQUNKLGNBQWMsRUFBRSxNQUFNLGtCQUFrQjtBQUFBLFlBQ3hDLGNBQWMsRUFBRSxNQUFNLGtCQUFrQjtBQUFBLFlBQ3hDLGNBQWMsRUFBRSxNQUFNLGtCQUFrQjtBQUFBLFVBQ3pDO0FBQUEsVUFDQSxPQUFPO0FBQUEsWUFDTixjQUFjLEVBQUUsTUFBTSxrQkFBa0I7QUFBQSxZQUN4QyxjQUFjLEVBQUUsTUFBTSxrQkFBa0I7QUFBQSxZQUN4QyxjQUFjLEVBQUUsTUFBTSxrQkFBa0I7QUFBQSxVQUN6QztBQUFBLFFBQ0Q7QUFBQSxRQUNBLGdCQUFnQjtBQUFBLE1BQ2pCO0FBQ0EsWUFBTSxlQUFnQjtBQUFBLFFBQ3JCLFVBQVU7QUFBQSxVQUNULFNBQVMsQ0FBQztBQUFBLFVBQ1YsS0FBSztBQUFBLFlBQ0osY0FBYyxFQUFFLE1BQU0sYUFBYTtBQUFBLFlBQ25DLGNBQWMsRUFBRSxNQUFNLGFBQWE7QUFBQSxZQUNuQyxjQUFjLEVBQUUsTUFBTSxhQUFhO0FBQUEsVUFDcEM7QUFBQSxVQUNBLE9BQU87QUFBQSxZQUNOLGNBQWMsRUFBRSxNQUFNLGFBQWE7QUFBQSxZQUNuQyxjQUFjLEVBQUUsTUFBTSxhQUFhO0FBQUEsWUFDbkMsY0FBYyxFQUFFLE1BQU0sYUFBYTtBQUFBLFVBQ3BDO0FBQUEsUUFDRDtBQUFBLFFBQ0EsZ0JBQWdCO0FBQUEsTUFDakI7QUFFQSxXQUFLLDJDQUEyQyxZQUFZO0FBQzNELGNBQU0sYUFBYSxpQkFBaUI7QUFBQSxVQUNuQztBQUFBLFVBQ0E7QUFBQSxRQUNELENBQUM7QUFDRCxjQUFNLHVCQUF1QixJQUFJLHlCQUF5QixFQUFFLFVBQVUsRUFBRSxZQUFZLGVBQWUsRUFBRSxDQUFDO0FBQ3RHLGNBQU0sV0FBVyxNQUFNLHdCQUF3QixRQUFXLFFBQVcsT0FBTyxzQkFBc0IsUUFBUSxLQUFLLFlBQVksUUFBVyxRQUFXLE1BQVM7QUFDMUosY0FBTSxXQUErQjtBQUFBLFVBQ3BDLEVBQUUsYUFBYSxjQUFjLE1BQU0sbUJBQW1CLFdBQVcsS0FBSztBQUFBLFVBQ3RFLEVBQUUsYUFBYSxjQUFjLE1BQU0sbUJBQW1CLFdBQVcsS0FBSztBQUFBLFFBQ3ZFO0FBQ0Esc0JBQWMsVUFBVSxRQUFRO0FBQUEsTUFDakMsQ0FBQztBQUNELFdBQUssNkNBQTZDLFlBQVk7QUFDN0QsY0FBTSxhQUFhLGlCQUFpQjtBQUFBLFVBQ25DO0FBQUEsVUFDQTtBQUFBLFFBQ0QsR0FBRyxrQ0FBa0M7QUFDckMsY0FBTSx1QkFBdUIsSUFBSSx5QkFBeUIsRUFBRSxVQUFVLEVBQUUsWUFBWSxhQUFhLEVBQUUsQ0FBQztBQUNwRyxjQUFNLFdBQVcsTUFBTSx3QkFBd0IsUUFBVyxRQUFXLE1BQU0sc0JBQXNCLFFBQVEsS0FBSyxZQUFZLFFBQVcsUUFBVyxNQUFTO0FBQ3pKLGNBQU0sV0FBK0I7QUFBQSxVQUNwQyxFQUFFLGFBQWEsY0FBYyxNQUFNLG1CQUFtQixZQUFZLE1BQU0sV0FBVyxLQUFLO0FBQUEsVUFDeEYsRUFBRSxhQUFhLGNBQWMsTUFBTSxtQkFBbUIsWUFBWSxNQUFNLFdBQVcsS0FBSztBQUFBLFFBQ3pGO0FBQ0Esc0JBQWMsVUFBVSxRQUFRO0FBQUEsTUFDakMsQ0FBQztBQUNELFdBQUssK0RBQStELFlBQVk7QUFFL0UsY0FBTSxhQUFhLGlCQUFpQjtBQUFBLFVBQ25DO0FBQUEsUUFDRCxHQUFHLGtDQUFrQztBQUNyQyxjQUFNLHVCQUF1QixJQUFJLHlCQUF5QixFQUFFLFVBQVUsRUFBRSxZQUFZLGFBQWEsRUFBRSxDQUFDO0FBQ3BHLGNBQU0sV0FBVyxNQUFNLHdCQUF3QixRQUFXLFFBQVcsTUFBTSxzQkFBc0IsUUFBUSxLQUFLLFlBQVksUUFBVyxRQUFXLE1BQVM7QUFDekosY0FBTSxXQUErQjtBQUFBLFVBQ3BDLEVBQUUsYUFBYSxjQUFjLE1BQU0sbUJBQW1CLFlBQVksTUFBTSxXQUFXLEtBQUs7QUFBQSxRQUN6RjtBQUNBLHNCQUFjLFVBQVUsUUFBUTtBQUFBLE1BQ2pDLENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRCxDQUFDO0FBRUQsV0FBUyxpQkFBaUIsZUFBeUIsbUJBQTJCLElBQWlCO0FBQzlGLFVBQU0sV0FBVztBQUFBLE1BQ2hCLE1BQU0sV0FBVyxNQUFnQztBQUNoRCxlQUFPLGNBQWMsU0FBUyxJQUFJO0FBQUEsTUFDbkM7QUFBQSxNQUNBLE1BQU0sU0FBUyxNQUErQjtBQUM3QyxZQUFJLFNBQVMsZUFBZTtBQUMzQixlQUFLLGtCQUFrQjtBQUFBLFFBQ3hCO0FBQ0EsZUFBTyxPQUFPLEtBQUssZ0JBQWdCO0FBQUEsTUFDcEM7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
