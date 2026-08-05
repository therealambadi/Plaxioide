import { deepStrictEqual, strictEqual, ok } from "assert";
import { VSBuffer } from "../../../../../../base/common/buffer.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { join } from "../../../../../../base/common/path.js";
import { isWindows, OperatingSystem } from "../../../../../../base/common/platform.js";
import { env } from "../../../../../../base/common/process.js";
import { URI } from "../../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { IRemoteAgentService } from "../../../../../services/remote/common/remoteAgentService.js";
import { TestStorageService } from "../../../../../test/common/workbenchTestServices.js";
import { fetchBashHistory, fetchFishHistory, fetchPwshHistory, fetchZshHistory, sanitizeFishHistoryCmd, TerminalPersistedHistory } from "../../common/history.js";
function getConfig(limit) {
  return {
    terminal: {
      integrated: {
        shellIntegration: {
          history: limit
        }
      }
    }
  };
}
const expectedCommands = [
  "single line command",
  'git commit -m "A wrapped line in pwsh history\n\nSome commit description\n\nFixes #xyz"',
  "git status",
  'two "\nline"'
];
suite("Terminal history", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  suite("TerminalPersistedHistory", () => {
    let history;
    let instantiationService;
    let configurationService;
    setup(() => {
      configurationService = new TestConfigurationService(getConfig(5));
      instantiationService = store.add(new TestInstantiationService());
      instantiationService.set(IConfigurationService, configurationService);
      instantiationService.set(IStorageService, store.add(new TestStorageService()));
      history = store.add(instantiationService.createInstance(TerminalPersistedHistory, "test"));
    });
    teardown(() => {
      instantiationService.dispose();
    });
    test("should support adding items to the cache and respect LRU", () => {
      history.add("foo", 1);
      deepStrictEqual(Array.from(history.entries), [
        ["foo", 1]
      ]);
      history.add("bar", 2);
      deepStrictEqual(Array.from(history.entries), [
        ["foo", 1],
        ["bar", 2]
      ]);
      history.add("foo", 1);
      deepStrictEqual(Array.from(history.entries), [
        ["bar", 2],
        ["foo", 1]
      ]);
    });
    test("should support removing specific items", () => {
      history.add("1", 1);
      history.add("2", 2);
      history.add("3", 3);
      history.add("4", 4);
      history.add("5", 5);
      strictEqual(Array.from(history.entries).length, 5);
      history.add("6", 6);
      strictEqual(Array.from(history.entries).length, 5);
    });
    test("should limit the number of entries based on config", () => {
      history.add("1", 1);
      history.add("2", 2);
      history.add("3", 3);
      history.add("4", 4);
      history.add("5", 5);
      strictEqual(Array.from(history.entries).length, 5);
      history.add("6", 6);
      strictEqual(Array.from(history.entries).length, 5);
      configurationService.setUserConfiguration("terminal", getConfig(2).terminal);
      configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true });
      strictEqual(Array.from(history.entries).length, 2);
      history.add("7", 7);
      strictEqual(Array.from(history.entries).length, 2);
      configurationService.setUserConfiguration("terminal", getConfig(3).terminal);
      configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true });
      strictEqual(Array.from(history.entries).length, 2);
      history.add("8", 8);
      strictEqual(Array.from(history.entries).length, 3);
      history.add("9", 9);
      strictEqual(Array.from(history.entries).length, 3);
    });
    test("should reload from storage service after recreation", () => {
      history.add("1", 1);
      history.add("2", 2);
      history.add("3", 3);
      strictEqual(Array.from(history.entries).length, 3);
      const history2 = store.add(instantiationService.createInstance(TerminalPersistedHistory, "test"));
      strictEqual(Array.from(history2.entries).length, 3);
    });
  });
  suite("fetchBashHistory", () => {
    let fileScheme;
    let filePath;
    const fileContent = [
      "single line command",
      'git commit -m "A wrapped line in pwsh history',
      "",
      "Some commit description",
      "",
      'Fixes #xyz"',
      "git status",
      'two "',
      'line"'
    ].join("\n");
    let instantiationService;
    let remoteConnection = null;
    let remoteEnvironment = null;
    setup(() => {
      instantiationService = new TestInstantiationService();
      instantiationService.stub(IFileService, {
        async readFile(resource) {
          const expected = URI.from({ scheme: fileScheme, path: filePath });
          strictEqual(resource.scheme, expected.scheme);
          strictEqual(resource.path, expected.path);
          return { value: VSBuffer.fromString(fileContent) };
        }
      });
      instantiationService.stub(IRemoteAgentService, {
        async getEnvironment() {
          return remoteEnvironment;
        },
        getConnection() {
          return remoteConnection;
        }
      });
    });
    teardown(() => {
      instantiationService.dispose();
    });
    if (!isWindows) {
      suite("local", () => {
        let originalEnvValues;
        setup(() => {
          originalEnvValues = { HOME: env["HOME"] };
          env["HOME"] = "/home/user";
          remoteConnection = { remoteAuthority: "some-remote" };
          fileScheme = Schemas.vscodeRemote;
          filePath = "/home/user/.bash_history";
        });
        teardown(() => {
          if (originalEnvValues["HOME"] === void 0) {
            delete env["HOME"];
          } else {
            env["HOME"] = originalEnvValues["HOME"];
          }
        });
        test("current OS", async () => {
          filePath = "/home/user/.bash_history";
          deepStrictEqual((await instantiationService.invokeFunction(fetchBashHistory)).commands, expectedCommands);
        });
      });
    }
    suite("remote", () => {
      let originalEnvValues;
      setup(() => {
        originalEnvValues = { HOME: env["HOME"] };
        env["HOME"] = "/home/user";
        remoteConnection = { remoteAuthority: "some-remote" };
        fileScheme = Schemas.vscodeRemote;
        filePath = "/home/user/.bash_history";
      });
      teardown(() => {
        if (originalEnvValues["HOME"] === void 0) {
          delete env["HOME"];
        } else {
          env["HOME"] = originalEnvValues["HOME"];
        }
      });
      test("Windows", async () => {
        remoteEnvironment = { os: OperatingSystem.Windows };
        strictEqual(await instantiationService.invokeFunction(fetchBashHistory), void 0);
      });
      test("macOS", async () => {
        remoteEnvironment = { os: OperatingSystem.Macintosh };
        deepStrictEqual((await instantiationService.invokeFunction(fetchBashHistory)).commands, expectedCommands);
      });
      test("Linux", async () => {
        remoteEnvironment = { os: OperatingSystem.Linux };
        deepStrictEqual((await instantiationService.invokeFunction(fetchBashHistory)).commands, expectedCommands);
      });
    });
  });
  suite("fetchZshHistory", () => {
    let fileScheme;
    let filePath;
    const fileContent = [
      ": 1655252330:0;single line command",
      ': 1655252330:0;git commit -m "A wrapped line in pwsh history\\',
      "\\",
      "Some commit description\\",
      "\\",
      'Fixes #xyz"',
      ": 1655252330:0;git status",
      ': 1655252330:0;two "\\',
      'line"'
    ].join("\n");
    let instantiationService;
    let remoteConnection = null;
    let remoteEnvironment = null;
    setup(() => {
      instantiationService = new TestInstantiationService();
      instantiationService.stub(IFileService, {
        async readFile(resource) {
          const expected = URI.from({ scheme: fileScheme, path: filePath });
          strictEqual(resource.scheme, expected.scheme);
          strictEqual(resource.path, expected.path);
          return { value: VSBuffer.fromString(fileContent) };
        }
      });
      instantiationService.stub(IRemoteAgentService, {
        async getEnvironment() {
          return remoteEnvironment;
        },
        getConnection() {
          return remoteConnection;
        }
      });
    });
    teardown(() => {
      instantiationService.dispose();
    });
    if (!isWindows) {
      suite("local", () => {
        let originalEnvValues;
        setup(() => {
          originalEnvValues = { HOME: env["HOME"] };
          env["HOME"] = "/home/user";
          remoteConnection = { remoteAuthority: "some-remote" };
          fileScheme = Schemas.vscodeRemote;
          filePath = "/home/user/.bash_history";
        });
        teardown(() => {
          if (originalEnvValues["HOME"] === void 0) {
            delete env["HOME"];
          } else {
            env["HOME"] = originalEnvValues["HOME"];
          }
        });
        test("current OS", async () => {
          filePath = "/home/user/.zsh_history";
          deepStrictEqual((await instantiationService.invokeFunction(fetchZshHistory)).commands, expectedCommands);
        });
      });
    }
    suite("remote", () => {
      let originalEnvValues;
      setup(() => {
        originalEnvValues = { HOME: env["HOME"] };
        env["HOME"] = "/home/user";
        remoteConnection = { remoteAuthority: "some-remote" };
        fileScheme = Schemas.vscodeRemote;
        filePath = "/home/user/.zsh_history";
      });
      teardown(() => {
        if (originalEnvValues["HOME"] === void 0) {
          delete env["HOME"];
        } else {
          env["HOME"] = originalEnvValues["HOME"];
        }
      });
      test("Windows", async () => {
        remoteEnvironment = { os: OperatingSystem.Windows };
        strictEqual(await instantiationService.invokeFunction(fetchZshHistory), void 0);
      });
      test("macOS", async () => {
        remoteEnvironment = { os: OperatingSystem.Macintosh };
        deepStrictEqual((await instantiationService.invokeFunction(fetchZshHistory)).commands, expectedCommands);
      });
      test("Linux", async () => {
        remoteEnvironment = { os: OperatingSystem.Linux };
        deepStrictEqual((await instantiationService.invokeFunction(fetchZshHistory)).commands, expectedCommands);
      });
    });
  });
  suite("fetchPwshHistory", () => {
    let fileScheme;
    let filePath;
    const fileContent = [
      "single line command",
      'git commit -m "A wrapped line in pwsh history`',
      "`",
      "Some commit description`",
      "`",
      'Fixes #xyz"',
      "git status",
      'two "`',
      'line"'
    ].join("\n");
    let instantiationService;
    let remoteConnection = null;
    let remoteEnvironment = null;
    setup(() => {
      instantiationService = new TestInstantiationService();
      instantiationService.stub(IFileService, {
        async readFile(resource) {
          const expected = URI.from({
            scheme: fileScheme,
            authority: remoteConnection?.remoteAuthority,
            path: URI.file(filePath).path
          });
          strictEqual(resource.toString().replaceAll("%5C", "/"), expected.toString().replaceAll("%5C", "/"));
          return { value: VSBuffer.fromString(fileContent) };
        }
      });
      instantiationService.stub(IRemoteAgentService, {
        async getEnvironment() {
          return remoteEnvironment;
        },
        getConnection() {
          return remoteConnection;
        }
      });
    });
    teardown(() => {
      instantiationService.dispose();
    });
    suite("local", () => {
      let originalEnvValues;
      setup(() => {
        originalEnvValues = { HOME: env["HOME"], APPDATA: env["APPDATA"] };
        env["HOME"] = "/home/user";
        env["APPDATA"] = "C:\\AppData";
        remoteConnection = { remoteAuthority: "some-remote" };
        fileScheme = Schemas.vscodeRemote;
        filePath = "/home/user/.zsh_history";
        originalEnvValues = { HOME: env["HOME"], APPDATA: env["APPDATA"] };
      });
      teardown(() => {
        if (originalEnvValues["HOME"] === void 0) {
          delete env["HOME"];
        } else {
          env["HOME"] = originalEnvValues["HOME"];
        }
        if (originalEnvValues["APPDATA"] === void 0) {
          delete env["APPDATA"];
        } else {
          env["APPDATA"] = originalEnvValues["APPDATA"];
        }
      });
      test("current OS", async () => {
        if (isWindows) {
          filePath = join(env["APPDATA"], "Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt");
        } else {
          filePath = join(env["HOME"], ".local/share/powershell/PSReadline/ConsoleHost_history.txt");
        }
        deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory)).commands, expectedCommands);
      });
    });
    suite("remote", () => {
      let originalEnvValues;
      setup(() => {
        remoteConnection = { remoteAuthority: "some-remote" };
        fileScheme = Schemas.vscodeRemote;
        originalEnvValues = { HOME: env["HOME"], APPDATA: env["APPDATA"] };
      });
      teardown(() => {
        if (originalEnvValues["HOME"] === void 0) {
          delete env["HOME"];
        } else {
          env["HOME"] = originalEnvValues["HOME"];
        }
        if (originalEnvValues["APPDATA"] === void 0) {
          delete env["APPDATA"];
        } else {
          env["APPDATA"] = originalEnvValues["APPDATA"];
        }
      });
      test("Windows", async () => {
        remoteEnvironment = { os: OperatingSystem.Windows };
        env["APPDATA"] = "C:\\AppData";
        filePath = "C:\\AppData\\Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt";
        deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory)).commands, expectedCommands);
      });
      test("macOS", async () => {
        remoteEnvironment = { os: OperatingSystem.Macintosh };
        env["HOME"] = "/home/user";
        filePath = "/home/user/.local/share/powershell/PSReadline/ConsoleHost_history.txt";
        deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory)).commands, expectedCommands);
      });
      test("Linux", async () => {
        remoteEnvironment = { os: OperatingSystem.Linux };
        env["HOME"] = "/home/user";
        filePath = "/home/user/.local/share/powershell/PSReadline/ConsoleHost_history.txt";
        deepStrictEqual((await instantiationService.invokeFunction(fetchPwshHistory)).commands, expectedCommands);
      });
    });
  });
  suite("fetchFishHistory", () => {
    let fileScheme;
    let filePath;
    const fileContent = [
      "- cmd: single line command",
      "  when: 1650000000",
      '- cmd: git commit -m "A wrapped line in pwsh history\\n\\nSome commit description\\n\\nFixes #xyz"',
      "  when: 1650000010",
      "- cmd: git status",
      "  when: 1650000020",
      '- cmd: two "\\nline"',
      "  when: 1650000030"
    ].join("\n");
    let instantiationService;
    let remoteConnection = null;
    let remoteEnvironment = null;
    setup(() => {
      instantiationService = new TestInstantiationService();
      instantiationService.stub(IFileService, {
        async readFile(resource) {
          const expected = URI.from({ scheme: fileScheme, path: filePath });
          strictEqual(resource.scheme, expected.scheme);
          strictEqual(resource.path, expected.path);
          return { value: VSBuffer.fromString(fileContent) };
        }
      });
      instantiationService.stub(IRemoteAgentService, {
        async getEnvironment() {
          return remoteEnvironment;
        },
        getConnection() {
          return remoteConnection;
        }
      });
    });
    teardown(() => {
      instantiationService.dispose();
    });
    if (!isWindows) {
      suite("local", () => {
        let originalEnvValues;
        setup(() => {
          originalEnvValues = { HOME: env["HOME"] };
          env["HOME"] = "/home/user";
          remoteConnection = { remoteAuthority: "some-remote" };
          fileScheme = Schemas.vscodeRemote;
          filePath = "/home/user/.local/share/fish/fish_history";
        });
        teardown(() => {
          if (originalEnvValues["HOME"] === void 0) {
            delete env["HOME"];
          } else {
            env["HOME"] = originalEnvValues["HOME"];
          }
        });
        test("current OS", async () => {
          filePath = "/home/user/.local/share/fish/fish_history";
          deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory)).commands, expectedCommands);
        });
      });
      suite("local (overriden path)", () => {
        let originalEnvValues;
        setup(() => {
          originalEnvValues = { XDG_DATA_HOME: env["XDG_DATA_HOME"] };
          env["XDG_DATA_HOME"] = "/home/user/data-home";
          remoteConnection = { remoteAuthority: "some-remote" };
          fileScheme = Schemas.vscodeRemote;
          filePath = "/home/user/data-home/fish/fish_history";
        });
        teardown(() => {
          if (originalEnvValues["XDG_DATA_HOME"] === void 0) {
            delete env["XDG_DATA_HOME"];
          } else {
            env["XDG_DATA_HOME"] = originalEnvValues["XDG_DATA_HOME"];
          }
        });
        test("current OS", async () => {
          filePath = "/home/user/data-home/fish/fish_history";
          deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory)).commands, expectedCommands);
        });
      });
    }
    suite("remote", () => {
      let originalEnvValues;
      setup(() => {
        originalEnvValues = { HOME: env["HOME"] };
        env["HOME"] = "/home/user";
        remoteConnection = { remoteAuthority: "some-remote" };
        fileScheme = Schemas.vscodeRemote;
        filePath = "/home/user/.local/share/fish/fish_history";
      });
      teardown(() => {
        if (originalEnvValues["HOME"] === void 0) {
          delete env["HOME"];
        } else {
          env["HOME"] = originalEnvValues["HOME"];
        }
      });
      test("Windows", async () => {
        remoteEnvironment = { os: OperatingSystem.Windows };
        strictEqual(await instantiationService.invokeFunction(fetchFishHistory), void 0);
      });
      test("macOS", async () => {
        remoteEnvironment = { os: OperatingSystem.Macintosh };
        deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory)).commands, expectedCommands);
      });
      test("Linux", async () => {
        remoteEnvironment = { os: OperatingSystem.Linux };
        deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory)).commands, expectedCommands);
      });
    });
    suite("remote (overriden path)", () => {
      let originalEnvValues;
      setup(() => {
        originalEnvValues = { XDG_DATA_HOME: env["XDG_DATA_HOME"] };
        env["XDG_DATA_HOME"] = "/home/user/data-home";
        remoteConnection = { remoteAuthority: "some-remote" };
        fileScheme = Schemas.vscodeRemote;
        filePath = "/home/user/data-home/fish/fish_history";
      });
      teardown(() => {
        if (originalEnvValues["XDG_DATA_HOME"] === void 0) {
          delete env["XDG_DATA_HOME"];
        } else {
          env["XDG_DATA_HOME"] = originalEnvValues["XDG_DATA_HOME"];
        }
      });
      test("Windows", async () => {
        remoteEnvironment = { os: OperatingSystem.Windows };
        strictEqual(await instantiationService.invokeFunction(fetchFishHistory), void 0);
      });
      test("macOS", async () => {
        remoteEnvironment = { os: OperatingSystem.Macintosh };
        deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory)).commands, expectedCommands);
      });
      test("Linux", async () => {
        remoteEnvironment = { os: OperatingSystem.Linux };
        deepStrictEqual((await instantiationService.invokeFunction(fetchFishHistory)).commands, expectedCommands);
      });
    });
    suite("sanitizeFishHistoryCmd", () => {
      test("valid new-lines", () => {
        const cases = [
          "\\n",
          "\\n at start",
          "some \\n in the middle",
          "at the end \\n",
          "\\\\\\n",
          "\\\\\\n valid at start",
          "valid \\\\\\n in the middle",
          "valid in the end \\\\\\n",
          "\\\\\\\\\\n",
          "\\\\\\\\\\n valid at start",
          "valid \\\\\\\\\\n in the middle",
          "valid in the end \\\\\\\\\\n",
          "mixed valid \\r\\n",
          "mixed valid \\\\\\r\\n",
          "mixed valid \\r\\\\\\n"
        ];
        for (const x of cases) {
          ok(sanitizeFishHistoryCmd(x).includes("\n"));
        }
      });
      test("invalid new-lines", () => {
        const cases = [
          "\\\\n",
          "\\\\n invalid at start",
          "invalid \\\\n in the middle",
          "invalid in the end \\\\n",
          "\\\\\\\\n",
          "\\\\\\\\n invalid at start",
          "invalid \\\\\\\\n in the middle",
          "invalid in the end \\\\\\\\n",
          "mixed invalid \\r\\\\n",
          "mixed invalid \\r\\\\\\\\n",
          'echo "\\\\n"'
        ];
        for (const x of cases) {
          ok(!sanitizeFishHistoryCmd(x).includes("\n"));
        }
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvaGlzdG9yeS90ZXN0L2NvbW1vbi9oaXN0b3J5LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkZWVwU3RyaWN0RXF1YWwsIHN0cmljdEVxdWFsLCBvayB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGVudiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50RW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRDb25uZWN0aW9uLCBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IGZldGNoQmFzaEhpc3RvcnksIGZldGNoRmlzaEhpc3RvcnksIGZldGNoUHdzaEhpc3RvcnksIGZldGNoWnNoSGlzdG9yeSwgc2FuaXRpemVGaXNoSGlzdG9yeUNtZCwgVGVybWluYWxQZXJzaXN0ZWRIaXN0b3J5LCB0eXBlIElUZXJtaW5hbFBlcnNpc3RlZEhpc3RvcnkgfSBmcm9tICcuLi8uLi9jb21tb24vaGlzdG9yeS5qcyc7XG5cbmZ1bmN0aW9uIGdldENvbmZpZyhsaW1pdDogbnVtYmVyKSB7XG5cdHJldHVybiB7XG5cdFx0dGVybWluYWw6IHtcblx0XHRcdGludGVncmF0ZWQ6IHtcblx0XHRcdFx0c2hlbGxJbnRlZ3JhdGlvbjoge1xuXHRcdFx0XHRcdGhpc3Rvcnk6IGxpbWl0XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH07XG59XG5cbmNvbnN0IGV4cGVjdGVkQ29tbWFuZHMgPSBbXG5cdCdzaW5nbGUgbGluZSBjb21tYW5kJyxcblx0J2dpdCBjb21taXQgLW0gXCJBIHdyYXBwZWQgbGluZSBpbiBwd3NoIGhpc3RvcnlcXG5cXG5Tb21lIGNvbW1pdCBkZXNjcmlwdGlvblxcblxcbkZpeGVzICN4eXpcIicsXG5cdCdnaXQgc3RhdHVzJyxcblx0J3R3byBcIlxcbmxpbmVcIidcbl07XG5cbnN1aXRlKCdUZXJtaW5hbCBoaXN0b3J5JywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdUZXJtaW5hbFBlcnNpc3RlZEhpc3RvcnknLCAoKSA9PiB7XG5cdFx0bGV0IGhpc3Rvcnk6IElUZXJtaW5hbFBlcnNpc3RlZEhpc3Rvcnk8bnVtYmVyPjtcblx0XHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0XHRsZXQgY29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZTtcblxuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZShnZXRDb25maWcoNSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJU3RvcmFnZVNlcnZpY2UsIHN0b3JlLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblxuXHRcdFx0aGlzdG9yeSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFBlcnNpc3RlZEhpc3Rvcnk8bnVtYmVyPiwgJ3Rlc3QnKSk7XG5cdFx0fSk7XG5cblx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgc3VwcG9ydCBhZGRpbmcgaXRlbXMgdG8gdGhlIGNhY2hlIGFuZCByZXNwZWN0IExSVScsICgpID0+IHtcblx0XHRcdGhpc3RvcnkuYWRkKCdmb28nLCAxKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcyksIFtcblx0XHRcdFx0Wydmb28nLCAxXVxuXHRcdFx0XSk7XG5cdFx0XHRoaXN0b3J5LmFkZCgnYmFyJywgMik7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoQXJyYXkuZnJvbShoaXN0b3J5LmVudHJpZXMpLCBbXG5cdFx0XHRcdFsnZm9vJywgMV0sXG5cdFx0XHRcdFsnYmFyJywgMl1cblx0XHRcdF0pO1xuXHRcdFx0aGlzdG9yeS5hZGQoJ2ZvbycsIDEpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKEFycmF5LmZyb20oaGlzdG9yeS5lbnRyaWVzKSwgW1xuXHRcdFx0XHRbJ2JhcicsIDJdLFxuXHRcdFx0XHRbJ2ZvbycsIDFdXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBzdXBwb3J0IHJlbW92aW5nIHNwZWNpZmljIGl0ZW1zJywgKCkgPT4ge1xuXHRcdFx0aGlzdG9yeS5hZGQoJzEnLCAxKTtcblx0XHRcdGhpc3RvcnkuYWRkKCcyJywgMik7XG5cdFx0XHRoaXN0b3J5LmFkZCgnMycsIDMpO1xuXHRcdFx0aGlzdG9yeS5hZGQoJzQnLCA0KTtcblx0XHRcdGhpc3RvcnkuYWRkKCc1JywgNSk7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCA1KTtcblx0XHRcdGhpc3RvcnkuYWRkKCc2JywgNik7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCA1KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBsaW1pdCB0aGUgbnVtYmVyIG9mIGVudHJpZXMgYmFzZWQgb24gY29uZmlnJywgKCkgPT4ge1xuXHRcdFx0aGlzdG9yeS5hZGQoJzEnLCAxKTtcblx0XHRcdGhpc3RvcnkuYWRkKCcyJywgMik7XG5cdFx0XHRoaXN0b3J5LmFkZCgnMycsIDMpO1xuXHRcdFx0aGlzdG9yeS5hZGQoJzQnLCA0KTtcblx0XHRcdGhpc3RvcnkuYWRkKCc1JywgNSk7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCA1KTtcblx0XHRcdGhpc3RvcnkuYWRkKCc2JywgNik7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCA1KTtcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCd0ZXJtaW5hbCcsIGdldENvbmZpZygyKS50ZXJtaW5hbCk7XG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb25FbWl0dGVyLmZpcmUoeyBhZmZlY3RzQ29uZmlndXJhdGlvbjogKCkgPT4gdHJ1ZSB9IGFzIGFueSk7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCAyKTtcblx0XHRcdGhpc3RvcnkuYWRkKCc3JywgNyk7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCAyKTtcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCd0ZXJtaW5hbCcsIGdldENvbmZpZygzKS50ZXJtaW5hbCk7XG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb25FbWl0dGVyLmZpcmUoeyBhZmZlY3RzQ29uZmlndXJhdGlvbjogKCkgPT4gdHJ1ZSB9IGFzIGFueSk7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCAyKTtcblx0XHRcdGhpc3RvcnkuYWRkKCc4JywgOCk7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCAzKTtcblx0XHRcdGhpc3RvcnkuYWRkKCc5JywgOSk7XG5cdFx0XHRzdHJpY3RFcXVhbChBcnJheS5mcm9tKGhpc3RvcnkuZW50cmllcykubGVuZ3RoLCAzKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCByZWxvYWQgZnJvbSBzdG9yYWdlIHNlcnZpY2UgYWZ0ZXIgcmVjcmVhdGlvbicsICgpID0+IHtcblx0XHRcdGhpc3RvcnkuYWRkKCcxJywgMSk7XG5cdFx0XHRoaXN0b3J5LmFkZCgnMicsIDIpO1xuXHRcdFx0aGlzdG9yeS5hZGQoJzMnLCAzKTtcblx0XHRcdHN0cmljdEVxdWFsKEFycmF5LmZyb20oaGlzdG9yeS5lbnRyaWVzKS5sZW5ndGgsIDMpO1xuXHRcdFx0Y29uc3QgaGlzdG9yeTIgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxQZXJzaXN0ZWRIaXN0b3J5LCAndGVzdCcpKTtcblx0XHRcdHN0cmljdEVxdWFsKEFycmF5LmZyb20oaGlzdG9yeTIuZW50cmllcykubGVuZ3RoLCAzKTtcblx0XHR9KTtcblx0fSk7XG5cdHN1aXRlKCdmZXRjaEJhc2hIaXN0b3J5JywgKCkgPT4ge1xuXHRcdGxldCBmaWxlU2NoZW1lOiBzdHJpbmc7XG5cdFx0bGV0IGZpbGVQYXRoOiBzdHJpbmc7XG5cdFx0Y29uc3QgZmlsZUNvbnRlbnQ6IHN0cmluZyA9IFtcblx0XHRcdCdzaW5nbGUgbGluZSBjb21tYW5kJyxcblx0XHRcdCdnaXQgY29tbWl0IC1tIFwiQSB3cmFwcGVkIGxpbmUgaW4gcHdzaCBoaXN0b3J5Jyxcblx0XHRcdCcnLFxuXHRcdFx0J1NvbWUgY29tbWl0IGRlc2NyaXB0aW9uJyxcblx0XHRcdCcnLFxuXHRcdFx0J0ZpeGVzICN4eXpcIicsXG5cdFx0XHQnZ2l0IHN0YXR1cycsXG5cdFx0XHQndHdvIFwiJyxcblx0XHRcdCdsaW5lXCInXG5cdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRcdGxldCByZW1vdGVDb25uZWN0aW9uOiBQaWNrPElSZW1vdGVBZ2VudENvbm5lY3Rpb24sICdyZW1vdGVBdXRob3JpdHknPiB8IG51bGwgPSBudWxsO1xuXHRcdGxldCByZW1vdGVFbnZpcm9ubWVudDogUGljazxJUmVtb3RlQWdlbnRFbnZpcm9ubWVudCwgJ29zJz4gfCBudWxsID0gbnVsbDtcblxuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIHtcblx0XHRcdFx0YXN5bmMgcmVhZEZpbGUocmVzb3VyY2U6IFVSSSkge1xuXHRcdFx0XHRcdGNvbnN0IGV4cGVjdGVkID0gVVJJLmZyb20oeyBzY2hlbWU6IGZpbGVTY2hlbWUsIHBhdGg6IGZpbGVQYXRoIH0pO1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKHJlc291cmNlLnNjaGVtZSwgZXhwZWN0ZWQuc2NoZW1lKTtcblx0XHRcdFx0XHRzdHJpY3RFcXVhbChyZXNvdXJjZS5wYXRoLCBleHBlY3RlZC5wYXRoKTtcblx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogVlNCdWZmZXIuZnJvbVN0cmluZyhmaWxlQ29udGVudCkgfTtcblx0XHRcdFx0fVxuXHRcdFx0fSBhcyBQaWNrPElGaWxlU2VydmljZSwgJ3JlYWRGaWxlJz4pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUmVtb3RlQWdlbnRTZXJ2aWNlLCB7XG5cdFx0XHRcdGFzeW5jIGdldEVudmlyb25tZW50KCkgeyByZXR1cm4gcmVtb3RlRW52aXJvbm1lbnQ7IH0sXG5cdFx0XHRcdGdldENvbm5lY3Rpb24oKSB7IHJldHVybiByZW1vdGVDb25uZWN0aW9uOyB9XG5cdFx0XHR9IGFzIFBpY2s8SVJlbW90ZUFnZW50U2VydmljZSwgJ2dldENvbm5lY3Rpb24nIHwgJ2dldEVudmlyb25tZW50Jz4pO1xuXHRcdH0pO1xuXG5cdFx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKCFpc1dpbmRvd3MpIHtcblx0XHRcdHN1aXRlKCdsb2NhbCcsICgpID0+IHtcblx0XHRcdFx0bGV0IG9yaWdpbmFsRW52VmFsdWVzOiB7IEhPTUU6IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXHRcdFx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRcdFx0b3JpZ2luYWxFbnZWYWx1ZXMgPSB7IEhPTUU6IGVudlsnSE9NRSddIH07XG5cdFx0XHRcdFx0ZW52WydIT01FJ10gPSAnL2hvbWUvdXNlcic7XG5cdFx0XHRcdFx0cmVtb3RlQ29ubmVjdGlvbiA9IHsgcmVtb3RlQXV0aG9yaXR5OiAnc29tZS1yZW1vdGUnIH07XG5cdFx0XHRcdFx0ZmlsZVNjaGVtZSA9IFNjaGVtYXMudnNjb2RlUmVtb3RlO1xuXHRcdFx0XHRcdGZpbGVQYXRoID0gJy9ob21lL3VzZXIvLmJhc2hfaGlzdG9yeSc7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKG9yaWdpbmFsRW52VmFsdWVzWydIT01FJ10gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0ZGVsZXRlIGVudlsnSE9NRSddO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbnZbJ0hPTUUnXSA9IG9yaWdpbmFsRW52VmFsdWVzWydIT01FJ107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVzdCgnY3VycmVudCBPUycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRmaWxlUGF0aCA9ICcvaG9tZS91c2VyLy5iYXNoX2hpc3RvcnknO1xuXHRcdFx0XHRcdGRlZXBTdHJpY3RFcXVhbCgoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hCYXNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHN1aXRlKCdyZW1vdGUnLCAoKSA9PiB7XG5cdFx0XHRsZXQgb3JpZ2luYWxFbnZWYWx1ZXM6IHsgSE9NRTogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG5cdFx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRcdG9yaWdpbmFsRW52VmFsdWVzID0geyBIT01FOiBlbnZbJ0hPTUUnXSB9O1xuXHRcdFx0XHRlbnZbJ0hPTUUnXSA9ICcvaG9tZS91c2VyJztcblx0XHRcdFx0cmVtb3RlQ29ubmVjdGlvbiA9IHsgcmVtb3RlQXV0aG9yaXR5OiAnc29tZS1yZW1vdGUnIH07XG5cdFx0XHRcdGZpbGVTY2hlbWUgPSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0XHRcdFx0ZmlsZVBhdGggPSAnL2hvbWUvdXNlci8uYmFzaF9oaXN0b3J5Jztcblx0XHRcdH0pO1xuXHRcdFx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdFx0XHRpZiAob3JpZ2luYWxFbnZWYWx1ZXNbJ0hPTUUnXSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGVudlsnSE9NRSddO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVudlsnSE9NRSddID0gb3JpZ2luYWxFbnZWYWx1ZXNbJ0hPTUUnXTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdXaW5kb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRyZW1vdGVFbnZpcm9ubWVudCA9IHsgb3M6IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzIH07XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoQmFzaEhpc3RvcnkpLCB1bmRlZmluZWQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdtYWNPUycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0cmVtb3RlRW52aXJvbm1lbnQgPSB7IG9zOiBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoIH07XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbCgoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hCYXNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ0xpbnV4JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRyZW1vdGVFbnZpcm9ubWVudCA9IHsgb3M6IE9wZXJhdGluZ1N5c3RlbS5MaW51eCB9O1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoQmFzaEhpc3RvcnkpKSEuY29tbWFuZHMsIGV4cGVjdGVkQ29tbWFuZHMpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnZmV0Y2hac2hIaXN0b3J5JywgKCkgPT4ge1xuXHRcdGxldCBmaWxlU2NoZW1lOiBzdHJpbmc7XG5cdFx0bGV0IGZpbGVQYXRoOiBzdHJpbmc7XG5cdFx0Y29uc3QgZmlsZUNvbnRlbnQ6IHN0cmluZyA9IFtcblx0XHRcdCc6IDE2NTUyNTIzMzA6MDtzaW5nbGUgbGluZSBjb21tYW5kJyxcblx0XHRcdCc6IDE2NTUyNTIzMzA6MDtnaXQgY29tbWl0IC1tIFwiQSB3cmFwcGVkIGxpbmUgaW4gcHdzaCBoaXN0b3J5XFxcXCcsXG5cdFx0XHQnXFxcXCcsXG5cdFx0XHQnU29tZSBjb21taXQgZGVzY3JpcHRpb25cXFxcJyxcblx0XHRcdCdcXFxcJyxcblx0XHRcdCdGaXhlcyAjeHl6XCInLFxuXHRcdFx0JzogMTY1NTI1MjMzMDowO2dpdCBzdGF0dXMnLFxuXHRcdFx0JzogMTY1NTI1MjMzMDowO3R3byBcIlxcXFwnLFxuXHRcdFx0J2xpbmVcIidcblx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdFx0bGV0IHJlbW90ZUNvbm5lY3Rpb246IFBpY2s8SVJlbW90ZUFnZW50Q29ubmVjdGlvbiwgJ3JlbW90ZUF1dGhvcml0eSc+IHwgbnVsbCA9IG51bGw7XG5cdFx0bGV0IHJlbW90ZUVudmlyb25tZW50OiBQaWNrPElSZW1vdGVBZ2VudEVudmlyb25tZW50LCAnb3MnPiB8IG51bGwgPSBudWxsO1xuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElGaWxlU2VydmljZSwge1xuXHRcdFx0XHRhc3luYyByZWFkRmlsZShyZXNvdXJjZTogVVJJKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBVUkkuZnJvbSh7IHNjaGVtZTogZmlsZVNjaGVtZSwgcGF0aDogZmlsZVBhdGggfSk7XG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwocmVzb3VyY2Uuc2NoZW1lLCBleHBlY3RlZC5zY2hlbWUpO1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKHJlc291cmNlLnBhdGgsIGV4cGVjdGVkLnBhdGgpO1xuXHRcdFx0XHRcdHJldHVybiB7IHZhbHVlOiBWU0J1ZmZlci5mcm9tU3RyaW5nKGZpbGVDb250ZW50KSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGFzIFBpY2s8SUZpbGVTZXJ2aWNlLCAncmVhZEZpbGUnPik7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZW1vdGVBZ2VudFNlcnZpY2UsIHtcblx0XHRcdFx0YXN5bmMgZ2V0RW52aXJvbm1lbnQoKSB7IHJldHVybiByZW1vdGVFbnZpcm9ubWVudDsgfSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvbigpIHsgcmV0dXJuIHJlbW90ZUNvbm5lY3Rpb247IH1cblx0XHRcdH0gYXMgUGljazxJUmVtb3RlQWdlbnRTZXJ2aWNlLCAnZ2V0Q29ubmVjdGlvbicgfCAnZ2V0RW52aXJvbm1lbnQnPik7XG5cdFx0fSk7XG5cblx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0c3VpdGUoJ2xvY2FsJywgKCkgPT4ge1xuXHRcdFx0XHRsZXQgb3JpZ2luYWxFbnZWYWx1ZXM6IHsgSE9NRTogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG5cdFx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0XHRvcmlnaW5hbEVudlZhbHVlcyA9IHsgSE9NRTogZW52WydIT01FJ10gfTtcblx0XHRcdFx0XHRlbnZbJ0hPTUUnXSA9ICcvaG9tZS91c2VyJztcblx0XHRcdFx0XHRyZW1vdGVDb25uZWN0aW9uID0geyByZW1vdGVBdXRob3JpdHk6ICdzb21lLXJlbW90ZScgfTtcblx0XHRcdFx0XHRmaWxlU2NoZW1lID0gU2NoZW1hcy52c2NvZGVSZW1vdGU7XG5cdFx0XHRcdFx0ZmlsZVBhdGggPSAnL2hvbWUvdXNlci8uYmFzaF9oaXN0b3J5Jztcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlYXJkb3duKCgpID0+IHtcblx0XHRcdFx0XHRpZiAob3JpZ2luYWxFbnZWYWx1ZXNbJ0hPTUUnXSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRkZWxldGUgZW52WydIT01FJ107XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGVudlsnSE9NRSddID0gb3JpZ2luYWxFbnZWYWx1ZXNbJ0hPTUUnXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXN0KCdjdXJyZW50IE9TJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGZpbGVQYXRoID0gJy9ob21lL3VzZXIvLnpzaF9oaXN0b3J5Jztcblx0XHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoWnNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHN1aXRlKCdyZW1vdGUnLCAoKSA9PiB7XG5cdFx0XHRsZXQgb3JpZ2luYWxFbnZWYWx1ZXM6IHsgSE9NRTogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG5cdFx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRcdG9yaWdpbmFsRW52VmFsdWVzID0geyBIT01FOiBlbnZbJ0hPTUUnXSB9O1xuXHRcdFx0XHRlbnZbJ0hPTUUnXSA9ICcvaG9tZS91c2VyJztcblx0XHRcdFx0cmVtb3RlQ29ubmVjdGlvbiA9IHsgcmVtb3RlQXV0aG9yaXR5OiAnc29tZS1yZW1vdGUnIH07XG5cdFx0XHRcdGZpbGVTY2hlbWUgPSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0XHRcdFx0ZmlsZVBhdGggPSAnL2hvbWUvdXNlci8uenNoX2hpc3RvcnknO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRcdGlmIChvcmlnaW5hbEVudlZhbHVlc1snSE9NRSddID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRkZWxldGUgZW52WydIT01FJ107XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW52WydIT01FJ10gPSBvcmlnaW5hbEVudlZhbHVlc1snSE9NRSddO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ1dpbmRvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlbW90ZUVudmlyb25tZW50ID0geyBvczogT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MgfTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hac2hIaXN0b3J5KSwgdW5kZWZpbmVkKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnbWFjT1MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlbW90ZUVudmlyb25tZW50ID0geyBvczogT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCB9O1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoWnNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ0xpbnV4JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRyZW1vdGVFbnZpcm9ubWVudCA9IHsgb3M6IE9wZXJhdGluZ1N5c3RlbS5MaW51eCB9O1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoWnNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdHN1aXRlKCdmZXRjaFB3c2hIaXN0b3J5JywgKCkgPT4ge1xuXHRcdGxldCBmaWxlU2NoZW1lOiBzdHJpbmc7XG5cdFx0bGV0IGZpbGVQYXRoOiBzdHJpbmc7XG5cdFx0Y29uc3QgZmlsZUNvbnRlbnQ6IHN0cmluZyA9IFtcblx0XHRcdCdzaW5nbGUgbGluZSBjb21tYW5kJyxcblx0XHRcdCdnaXQgY29tbWl0IC1tIFwiQSB3cmFwcGVkIGxpbmUgaW4gcHdzaCBoaXN0b3J5YCcsXG5cdFx0XHQnYCcsXG5cdFx0XHQnU29tZSBjb21taXQgZGVzY3JpcHRpb25gJyxcblx0XHRcdCdgJyxcblx0XHRcdCdGaXhlcyAjeHl6XCInLFxuXHRcdFx0J2dpdCBzdGF0dXMnLFxuXHRcdFx0J3R3byBcImAnLFxuXHRcdFx0J2xpbmVcIidcblx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdFx0bGV0IHJlbW90ZUNvbm5lY3Rpb246IFBpY2s8SVJlbW90ZUFnZW50Q29ubmVjdGlvbiwgJ3JlbW90ZUF1dGhvcml0eSc+IHwgbnVsbCA9IG51bGw7XG5cdFx0bGV0IHJlbW90ZUVudmlyb25tZW50OiBQaWNrPElSZW1vdGVBZ2VudEVudmlyb25tZW50LCAnb3MnPiB8IG51bGwgPSBudWxsO1xuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElGaWxlU2VydmljZSwge1xuXHRcdFx0XHRhc3luYyByZWFkRmlsZShyZXNvdXJjZTogVVJJKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBVUkkuZnJvbSh7XG5cdFx0XHRcdFx0XHRzY2hlbWU6IGZpbGVTY2hlbWUsXG5cdFx0XHRcdFx0XHRhdXRob3JpdHk6IHJlbW90ZUNvbm5lY3Rpb24/LnJlbW90ZUF1dGhvcml0eSxcblx0XHRcdFx0XHRcdHBhdGg6IFVSSS5maWxlKGZpbGVQYXRoKS5wYXRoXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Ly8gU2FuaXRpemUgdGhlIGVuY29kZWQgYC9gIGNoYXJzIGFzIHRoZXkgZG9uJ3QgaW1wYWN0IGJlaGF2aW9yXG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwocmVzb3VyY2UudG9TdHJpbmcoKS5yZXBsYWNlQWxsKCclNUMnLCAnLycpLCBleHBlY3RlZC50b1N0cmluZygpLnJlcGxhY2VBbGwoJyU1QycsICcvJykpO1xuXHRcdFx0XHRcdHJldHVybiB7IHZhbHVlOiBWU0J1ZmZlci5mcm9tU3RyaW5nKGZpbGVDb250ZW50KSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGFzIFBpY2s8SUZpbGVTZXJ2aWNlLCAncmVhZEZpbGUnPik7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZW1vdGVBZ2VudFNlcnZpY2UsIHtcblx0XHRcdFx0YXN5bmMgZ2V0RW52aXJvbm1lbnQoKSB7IHJldHVybiByZW1vdGVFbnZpcm9ubWVudDsgfSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvbigpIHsgcmV0dXJuIHJlbW90ZUNvbm5lY3Rpb247IH1cblx0XHRcdH0gYXMgUGljazxJUmVtb3RlQWdlbnRTZXJ2aWNlLCAnZ2V0Q29ubmVjdGlvbicgfCAnZ2V0RW52aXJvbm1lbnQnPik7XG5cdFx0fSk7XG5cblx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnbG9jYWwnLCAoKSA9PiB7XG5cdFx0XHRsZXQgb3JpZ2luYWxFbnZWYWx1ZXM6IHsgSE9NRTogc3RyaW5nIHwgdW5kZWZpbmVkOyBBUFBEQVRBOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0b3JpZ2luYWxFbnZWYWx1ZXMgPSB7IEhPTUU6IGVudlsnSE9NRSddLCBBUFBEQVRBOiBlbnZbJ0FQUERBVEEnXSB9O1xuXHRcdFx0XHRlbnZbJ0hPTUUnXSA9ICcvaG9tZS91c2VyJztcblx0XHRcdFx0ZW52WydBUFBEQVRBJ10gPSAnQzpcXFxcQXBwRGF0YSc7XG5cdFx0XHRcdHJlbW90ZUNvbm5lY3Rpb24gPSB7IHJlbW90ZUF1dGhvcml0eTogJ3NvbWUtcmVtb3RlJyB9O1xuXHRcdFx0XHRmaWxlU2NoZW1lID0gU2NoZW1hcy52c2NvZGVSZW1vdGU7XG5cdFx0XHRcdGZpbGVQYXRoID0gJy9ob21lL3VzZXIvLnpzaF9oaXN0b3J5Jztcblx0XHRcdFx0b3JpZ2luYWxFbnZWYWx1ZXMgPSB7IEhPTUU6IGVudlsnSE9NRSddLCBBUFBEQVRBOiBlbnZbJ0FQUERBVEEnXSB9O1xuXHRcdFx0fSk7XG5cdFx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRcdGlmIChvcmlnaW5hbEVudlZhbHVlc1snSE9NRSddID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRkZWxldGUgZW52WydIT01FJ107XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW52WydIT01FJ10gPSBvcmlnaW5hbEVudlZhbHVlc1snSE9NRSddO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChvcmlnaW5hbEVudlZhbHVlc1snQVBQREFUQSddID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRkZWxldGUgZW52WydBUFBEQVRBJ107XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW52WydBUFBEQVRBJ10gPSBvcmlnaW5hbEVudlZhbHVlc1snQVBQREFUQSddO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2N1cnJlbnQgT1MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdFx0XHRmaWxlUGF0aCA9IGpvaW4oZW52WydBUFBEQVRBJ10hLCAnTWljcm9zb2Z0XFxcXFdpbmRvd3NcXFxcUG93ZXJTaGVsbFxcXFxQU1JlYWRMaW5lXFxcXENvbnNvbGVIb3N0X2hpc3RvcnkudHh0Jyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZmlsZVBhdGggPSBqb2luKGVudlsnSE9NRSddISwgJy5sb2NhbC9zaGFyZS9wb3dlcnNoZWxsL1BTUmVhZGxpbmUvQ29uc29sZUhvc3RfaGlzdG9yeS50eHQnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoUHdzaEhpc3RvcnkpKSEuY29tbWFuZHMsIGV4cGVjdGVkQ29tbWFuZHMpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c3VpdGUoJ3JlbW90ZScsICgpID0+IHtcblx0XHRcdGxldCBvcmlnaW5hbEVudlZhbHVlczogeyBIT01FOiBzdHJpbmcgfCB1bmRlZmluZWQ7IEFQUERBVEE6IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXHRcdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0XHRyZW1vdGVDb25uZWN0aW9uID0geyByZW1vdGVBdXRob3JpdHk6ICdzb21lLXJlbW90ZScgfTtcblx0XHRcdFx0ZmlsZVNjaGVtZSA9IFNjaGVtYXMudnNjb2RlUmVtb3RlO1xuXHRcdFx0XHRvcmlnaW5hbEVudlZhbHVlcyA9IHsgSE9NRTogZW52WydIT01FJ10sIEFQUERBVEE6IGVudlsnQVBQREFUQSddIH07XG5cdFx0XHR9KTtcblx0XHRcdHRlYXJkb3duKCgpID0+IHtcblx0XHRcdFx0aWYgKG9yaWdpbmFsRW52VmFsdWVzWydIT01FJ10gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGRlbGV0ZSBlbnZbJ0hPTUUnXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlbnZbJ0hPTUUnXSA9IG9yaWdpbmFsRW52VmFsdWVzWydIT01FJ107XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9yaWdpbmFsRW52VmFsdWVzWydBUFBEQVRBJ10gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGRlbGV0ZSBlbnZbJ0FQUERBVEEnXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlbnZbJ0FQUERBVEEnXSA9IG9yaWdpbmFsRW52VmFsdWVzWydBUFBEQVRBJ107XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnV2luZG93cycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0cmVtb3RlRW52aXJvbm1lbnQgPSB7IG9zOiBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyB9O1xuXHRcdFx0XHRlbnZbJ0FQUERBVEEnXSA9ICdDOlxcXFxBcHBEYXRhJztcblx0XHRcdFx0ZmlsZVBhdGggPSAnQzpcXFxcQXBwRGF0YVxcXFxNaWNyb3NvZnRcXFxcV2luZG93c1xcXFxQb3dlclNoZWxsXFxcXFBTUmVhZExpbmVcXFxcQ29uc29sZUhvc3RfaGlzdG9yeS50eHQnO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoUHdzaEhpc3RvcnkpKSEuY29tbWFuZHMsIGV4cGVjdGVkQ29tbWFuZHMpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdtYWNPUycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0cmVtb3RlRW52aXJvbm1lbnQgPSB7IG9zOiBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoIH07XG5cdFx0XHRcdGVudlsnSE9NRSddID0gJy9ob21lL3VzZXInO1xuXHRcdFx0XHRmaWxlUGF0aCA9ICcvaG9tZS91c2VyLy5sb2NhbC9zaGFyZS9wb3dlcnNoZWxsL1BTUmVhZGxpbmUvQ29uc29sZUhvc3RfaGlzdG9yeS50eHQnO1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoKGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZldGNoUHdzaEhpc3RvcnkpKSEuY29tbWFuZHMsIGV4cGVjdGVkQ29tbWFuZHMpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdMaW51eCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0cmVtb3RlRW52aXJvbm1lbnQgPSB7IG9zOiBPcGVyYXRpbmdTeXN0ZW0uTGludXggfTtcblx0XHRcdFx0ZW52WydIT01FJ10gPSAnL2hvbWUvdXNlcic7XG5cdFx0XHRcdGZpbGVQYXRoID0gJy9ob21lL3VzZXIvLmxvY2FsL3NoYXJlL3Bvd2Vyc2hlbGwvUFNSZWFkbGluZS9Db25zb2xlSG9zdF9oaXN0b3J5LnR4dCc7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbCgoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hQd3NoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdHN1aXRlKCdmZXRjaEZpc2hIaXN0b3J5JywgKCkgPT4ge1xuXHRcdGxldCBmaWxlU2NoZW1lOiBzdHJpbmc7XG5cdFx0bGV0IGZpbGVQYXRoOiBzdHJpbmc7XG5cdFx0Y29uc3QgZmlsZUNvbnRlbnQ6IHN0cmluZyA9IFtcblx0XHRcdCctIGNtZDogc2luZ2xlIGxpbmUgY29tbWFuZCcsXG5cdFx0XHQnICB3aGVuOiAxNjUwMDAwMDAwJyxcblx0XHRcdCctIGNtZDogZ2l0IGNvbW1pdCAtbSBcIkEgd3JhcHBlZCBsaW5lIGluIHB3c2ggaGlzdG9yeVxcXFxuXFxcXG5Tb21lIGNvbW1pdCBkZXNjcmlwdGlvblxcXFxuXFxcXG5GaXhlcyAjeHl6XCInLFxuXHRcdFx0JyAgd2hlbjogMTY1MDAwMDAxMCcsXG5cdFx0XHQnLSBjbWQ6IGdpdCBzdGF0dXMnLFxuXHRcdFx0JyAgd2hlbjogMTY1MDAwMDAyMCcsXG5cdFx0XHQnLSBjbWQ6IHR3byBcIlxcXFxubGluZVwiJyxcblx0XHRcdCcgIHdoZW46IDE2NTAwMDAwMzAnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cblx0XHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0XHRsZXQgcmVtb3RlQ29ubmVjdGlvbjogUGljazxJUmVtb3RlQWdlbnRDb25uZWN0aW9uLCAncmVtb3RlQXV0aG9yaXR5Jz4gfCBudWxsID0gbnVsbDtcblx0XHRsZXQgcmVtb3RlRW52aXJvbm1lbnQ6IFBpY2s8SVJlbW90ZUFnZW50RW52aXJvbm1lbnQsICdvcyc+IHwgbnVsbCA9IG51bGw7XG5cblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUZpbGVTZXJ2aWNlLCB7XG5cdFx0XHRcdGFzeW5jIHJlYWRGaWxlKHJlc291cmNlOiBVUkkpIHtcblx0XHRcdFx0XHRjb25zdCBleHBlY3RlZCA9IFVSSS5mcm9tKHsgc2NoZW1lOiBmaWxlU2NoZW1lLCBwYXRoOiBmaWxlUGF0aCB9KTtcblx0XHRcdFx0XHRzdHJpY3RFcXVhbChyZXNvdXJjZS5zY2hlbWUsIGV4cGVjdGVkLnNjaGVtZSk7XG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwocmVzb3VyY2UucGF0aCwgZXhwZWN0ZWQucGF0aCk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgdmFsdWU6IFZTQnVmZmVyLmZyb21TdHJpbmcoZmlsZUNvbnRlbnQpIH07XG5cdFx0XHRcdH1cblx0XHRcdH0gYXMgUGljazxJRmlsZVNlcnZpY2UsICdyZWFkRmlsZSc+KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVJlbW90ZUFnZW50U2VydmljZSwge1xuXHRcdFx0XHRhc3luYyBnZXRFbnZpcm9ubWVudCgpIHsgcmV0dXJuIHJlbW90ZUVudmlyb25tZW50OyB9LFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uKCkgeyByZXR1cm4gcmVtb3RlQ29ubmVjdGlvbjsgfVxuXHRcdFx0fSBhcyBQaWNrPElSZW1vdGVBZ2VudFNlcnZpY2UsICdnZXRDb25uZWN0aW9uJyB8ICdnZXRFbnZpcm9ubWVudCc+KTtcblx0XHR9KTtcblxuXHRcdHRlYXJkb3duKCgpID0+IHtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRzdWl0ZSgnbG9jYWwnLCAoKSA9PiB7XG5cdFx0XHRcdGxldCBvcmlnaW5hbEVudlZhbHVlczogeyBIT01FOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcblx0XHRcdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0XHRcdG9yaWdpbmFsRW52VmFsdWVzID0geyBIT01FOiBlbnZbJ0hPTUUnXSB9O1xuXHRcdFx0XHRcdGVudlsnSE9NRSddID0gJy9ob21lL3VzZXInO1xuXHRcdFx0XHRcdHJlbW90ZUNvbm5lY3Rpb24gPSB7IHJlbW90ZUF1dGhvcml0eTogJ3NvbWUtcmVtb3RlJyB9O1xuXHRcdFx0XHRcdGZpbGVTY2hlbWUgPSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0XHRcdFx0XHRmaWxlUGF0aCA9ICcvaG9tZS91c2VyLy5sb2NhbC9zaGFyZS9maXNoL2Zpc2hfaGlzdG9yeSc7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKG9yaWdpbmFsRW52VmFsdWVzWydIT01FJ10gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0ZGVsZXRlIGVudlsnSE9NRSddO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbnZbJ0hPTUUnXSA9IG9yaWdpbmFsRW52VmFsdWVzWydIT01FJ107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVzdCgnY3VycmVudCBPUycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRmaWxlUGF0aCA9ICcvaG9tZS91c2VyLy5sb2NhbC9zaGFyZS9maXNoL2Zpc2hfaGlzdG9yeSc7XG5cdFx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKChhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihmZXRjaEZpc2hIaXN0b3J5KSkhLmNvbW1hbmRzLCBleHBlY3RlZENvbW1hbmRzKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0c3VpdGUoJ2xvY2FsIChvdmVycmlkZW4gcGF0aCknLCAoKSA9PiB7XG5cdFx0XHRcdGxldCBvcmlnaW5hbEVudlZhbHVlczogeyBYREdfREFUQV9IT01FOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcblx0XHRcdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0XHRcdG9yaWdpbmFsRW52VmFsdWVzID0geyBYREdfREFUQV9IT01FOiBlbnZbJ1hER19EQVRBX0hPTUUnXSB9O1xuXHRcdFx0XHRcdGVudlsnWERHX0RBVEFfSE9NRSddID0gJy9ob21lL3VzZXIvZGF0YS1ob21lJztcblx0XHRcdFx0XHRyZW1vdGVDb25uZWN0aW9uID0geyByZW1vdGVBdXRob3JpdHk6ICdzb21lLXJlbW90ZScgfTtcblx0XHRcdFx0XHRmaWxlU2NoZW1lID0gU2NoZW1hcy52c2NvZGVSZW1vdGU7XG5cdFx0XHRcdFx0ZmlsZVBhdGggPSAnL2hvbWUvdXNlci9kYXRhLWhvbWUvZmlzaC9maXNoX2hpc3RvcnknO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChvcmlnaW5hbEVudlZhbHVlc1snWERHX0RBVEFfSE9NRSddID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGRlbGV0ZSBlbnZbJ1hER19EQVRBX0hPTUUnXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZW52WydYREdfREFUQV9IT01FJ10gPSBvcmlnaW5hbEVudlZhbHVlc1snWERHX0RBVEFfSE9NRSddO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ2N1cnJlbnQgT1MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0ZmlsZVBhdGggPSAnL2hvbWUvdXNlci9kYXRhLWhvbWUvZmlzaC9maXNoX2hpc3RvcnknO1xuXHRcdFx0XHRcdGRlZXBTdHJpY3RFcXVhbCgoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hGaXNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHN1aXRlKCdyZW1vdGUnLCAoKSA9PiB7XG5cdFx0XHRsZXQgb3JpZ2luYWxFbnZWYWx1ZXM6IHsgSE9NRTogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG5cdFx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRcdG9yaWdpbmFsRW52VmFsdWVzID0geyBIT01FOiBlbnZbJ0hPTUUnXSB9O1xuXHRcdFx0XHRlbnZbJ0hPTUUnXSA9ICcvaG9tZS91c2VyJztcblx0XHRcdFx0cmVtb3RlQ29ubmVjdGlvbiA9IHsgcmVtb3RlQXV0aG9yaXR5OiAnc29tZS1yZW1vdGUnIH07XG5cdFx0XHRcdGZpbGVTY2hlbWUgPSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0XHRcdFx0ZmlsZVBhdGggPSAnL2hvbWUvdXNlci8ubG9jYWwvc2hhcmUvZmlzaC9maXNoX2hpc3RvcnknO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRcdGlmIChvcmlnaW5hbEVudlZhbHVlc1snSE9NRSddID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRkZWxldGUgZW52WydIT01FJ107XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW52WydIT01FJ10gPSBvcmlnaW5hbEVudlZhbHVlc1snSE9NRSddO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ1dpbmRvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlbW90ZUVudmlyb25tZW50ID0geyBvczogT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MgfTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hGaXNoSGlzdG9yeSksIHVuZGVmaW5lZCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ21hY09TJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRyZW1vdGVFbnZpcm9ubWVudCA9IHsgb3M6IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2ggfTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKChhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihmZXRjaEZpc2hIaXN0b3J5KSkhLmNvbW1hbmRzLCBleHBlY3RlZENvbW1hbmRzKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnTGludXgnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlbW90ZUVudmlyb25tZW50ID0geyBvczogT3BlcmF0aW5nU3lzdGVtLkxpbnV4IH07XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbCgoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hGaXNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdyZW1vdGUgKG92ZXJyaWRlbiBwYXRoKScsICgpID0+IHtcblx0XHRcdGxldCBvcmlnaW5hbEVudlZhbHVlczogeyBYREdfREFUQV9IT01FOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0b3JpZ2luYWxFbnZWYWx1ZXMgPSB7IFhER19EQVRBX0hPTUU6IGVudlsnWERHX0RBVEFfSE9NRSddIH07XG5cdFx0XHRcdGVudlsnWERHX0RBVEFfSE9NRSddID0gJy9ob21lL3VzZXIvZGF0YS1ob21lJztcblx0XHRcdFx0cmVtb3RlQ29ubmVjdGlvbiA9IHsgcmVtb3RlQXV0aG9yaXR5OiAnc29tZS1yZW1vdGUnIH07XG5cdFx0XHRcdGZpbGVTY2hlbWUgPSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0XHRcdFx0ZmlsZVBhdGggPSAnL2hvbWUvdXNlci9kYXRhLWhvbWUvZmlzaC9maXNoX2hpc3RvcnknO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRcdGlmIChvcmlnaW5hbEVudlZhbHVlc1snWERHX0RBVEFfSE9NRSddID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRkZWxldGUgZW52WydYREdfREFUQV9IT01FJ107XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW52WydYREdfREFUQV9IT01FJ10gPSBvcmlnaW5hbEVudlZhbHVlc1snWERHX0RBVEFfSE9NRSddO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ1dpbmRvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlbW90ZUVudmlyb25tZW50ID0geyBvczogT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MgfTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hGaXNoSGlzdG9yeSksIHVuZGVmaW5lZCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ21hY09TJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRyZW1vdGVFbnZpcm9ubWVudCA9IHsgb3M6IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2ggfTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKChhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihmZXRjaEZpc2hIaXN0b3J5KSkhLmNvbW1hbmRzLCBleHBlY3RlZENvbW1hbmRzKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnTGludXgnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHJlbW90ZUVudmlyb25tZW50ID0geyBvczogT3BlcmF0aW5nU3lzdGVtLkxpbnV4IH07XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbCgoYXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZmV0Y2hGaXNoSGlzdG9yeSkpIS5jb21tYW5kcywgZXhwZWN0ZWRDb21tYW5kcyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdzYW5pdGl6ZUZpc2hIaXN0b3J5Q21kJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgndmFsaWQgbmV3LWxpbmVzJywgKCkgPT4ge1xuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogVmFsaWQgbmV3LWxpbmVzIGhhdmUgb2RkIG51bWJlciBvZiBsZWFkaW5nIGJhY2tzbGFzaGVzOiBcXG4sIFxcXFxcXG4sIFxcXFxcXFxcXFxuXG5cdFx0XHRcdCAqL1xuXHRcdFx0XHRjb25zdCBjYXNlcyA9IFtcblx0XHRcdFx0XHQnXFxcXG4nLFxuXHRcdFx0XHRcdCdcXFxcbiBhdCBzdGFydCcsXG5cdFx0XHRcdFx0J3NvbWUgXFxcXG4gaW4gdGhlIG1pZGRsZScsXG5cdFx0XHRcdFx0J2F0IHRoZSBlbmQgXFxcXG4nLFxuXHRcdFx0XHRcdCdcXFxcXFxcXFxcXFxuJyxcblx0XHRcdFx0XHQnXFxcXFxcXFxcXFxcbiB2YWxpZCBhdCBzdGFydCcsXG5cdFx0XHRcdFx0J3ZhbGlkIFxcXFxcXFxcXFxcXG4gaW4gdGhlIG1pZGRsZScsXG5cdFx0XHRcdFx0J3ZhbGlkIGluIHRoZSBlbmQgXFxcXFxcXFxcXFxcbicsXG5cdFx0XHRcdFx0J1xcXFxcXFxcXFxcXFxcXFxcXFxcbicsXG5cdFx0XHRcdFx0J1xcXFxcXFxcXFxcXFxcXFxcXFxcbiB2YWxpZCBhdCBzdGFydCcsXG5cdFx0XHRcdFx0J3ZhbGlkIFxcXFxcXFxcXFxcXFxcXFxcXFxcbiBpbiB0aGUgbWlkZGxlJyxcblx0XHRcdFx0XHQndmFsaWQgaW4gdGhlIGVuZCBcXFxcXFxcXFxcXFxcXFxcXFxcXG4nLFxuXHRcdFx0XHRcdCdtaXhlZCB2YWxpZCBcXFxcclxcXFxuJyxcblx0XHRcdFx0XHQnbWl4ZWQgdmFsaWQgXFxcXFxcXFxcXFxcclxcXFxuJyxcblx0XHRcdFx0XHQnbWl4ZWQgdmFsaWQgXFxcXHJcXFxcXFxcXFxcXFxuJyxcblx0XHRcdFx0XTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IHggb2YgY2FzZXMpIHtcblx0XHRcdFx0XHRvayhzYW5pdGl6ZUZpc2hIaXN0b3J5Q21kKHgpLmluY2x1ZGVzKCdcXG4nKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdpbnZhbGlkIG5ldy1saW5lcycsICgpID0+IHtcblx0XHRcdFx0LyoqXG5cdFx0XHRcdCAqIEludmFsaWQgbmV3LWxpbmVzIGhhdmUgZXZlbiBudW1iZXIgb2YgbGVhZGluZyBiYWNrc2xhc2hlczogXFxcXG4sIFxcXFxcXFxcbiwgXFxcXFxcXFxcXFxcblxuXHRcdFx0XHQgKi9cblx0XHRcdFx0Y29uc3QgY2FzZXMgPSBbXG5cdFx0XHRcdFx0J1xcXFxcXFxcbicsXG5cdFx0XHRcdFx0J1xcXFxcXFxcbiBpbnZhbGlkIGF0IHN0YXJ0Jyxcblx0XHRcdFx0XHQnaW52YWxpZCBcXFxcXFxcXG4gaW4gdGhlIG1pZGRsZScsXG5cdFx0XHRcdFx0J2ludmFsaWQgaW4gdGhlIGVuZCBcXFxcXFxcXG4nLFxuXHRcdFx0XHRcdCdcXFxcXFxcXFxcXFxcXFxcbicsXG5cdFx0XHRcdFx0J1xcXFxcXFxcXFxcXFxcXFxuIGludmFsaWQgYXQgc3RhcnQnLFxuXHRcdFx0XHRcdCdpbnZhbGlkIFxcXFxcXFxcXFxcXFxcXFxuIGluIHRoZSBtaWRkbGUnLFxuXHRcdFx0XHRcdCdpbnZhbGlkIGluIHRoZSBlbmQgXFxcXFxcXFxcXFxcXFxcXG4nLFxuXHRcdFx0XHRcdCdtaXhlZCBpbnZhbGlkIFxcXFxyXFxcXFxcXFxuJyxcblx0XHRcdFx0XHQnbWl4ZWQgaW52YWxpZCBcXFxcclxcXFxcXFxcXFxcXFxcXFxuJyxcblx0XHRcdFx0XHQnZWNobyBcIlxcXFxcXFxcblwiJyxcblx0XHRcdFx0XTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IHggb2YgY2FzZXMpIHtcblx0XHRcdFx0XHRvayghc2FuaXRpemVGaXNoSGlzdG9yeUNtZCh4KS5pbmNsdWRlcygnXFxuJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxpQkFBaUIsYUFBYSxVQUFVO0FBQ2pELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVk7QUFDckIsU0FBUyxXQUFXLHVCQUF1QjtBQUMzQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQWlDLDJCQUEyQjtBQUM1RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGtCQUFrQixrQkFBa0Isa0JBQWtCLGlCQUFpQix3QkFBd0IsZ0NBQWdFO0FBRXhLLFNBQVMsVUFBVSxPQUFlO0FBQ2pDLFNBQU87QUFBQSxJQUNOLFVBQVU7QUFBQSxNQUNULFlBQVk7QUFBQSxRQUNYLGtCQUFrQjtBQUFBLFVBQ2pCLFNBQVM7QUFBQSxRQUNWO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxNQUFNLG1CQUFtQjtBQUFBLEVBQ3hCO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Q7QUFFQSxNQUFNLG9CQUFvQixNQUFNO0FBQy9CLFFBQU0sUUFBUSx3Q0FBd0M7QUFFdEQsUUFBTSw0QkFBNEIsTUFBTTtBQUN2QyxRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUk7QUFFSixVQUFNLE1BQU07QUFDWCw2QkFBdUIsSUFB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
