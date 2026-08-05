import { deepStrictEqual, strictEqual } from "assert";
import { Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalCapabilityStore } from "../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { GeneralShellType } from "../../../../../platform/terminal/common/terminal.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { ITerminalConfigurationService, ITerminalInstanceService } from "../../browser/terminal.js";
import { TerminalConfigurationService } from "../../browser/terminalConfigurationService.js";
import { parseExitResult, TerminalInstance, TerminalLabelComputer } from "../../browser/terminalInstance.js";
import { IEnvironmentVariableService } from "../../common/environmentVariable.js";
import { EnvironmentVariableService } from "../../common/environmentVariableService.js";
import { ITerminalProfileResolverService, ProcessState } from "../../common/terminal.js";
import { TestViewDescriptorService } from "./xterm/xtermTerminal.test.js";
import { fixPath } from "../../../../services/search/test/browser/queryBuilder.test.js";
import { TestTerminalProfileResolverService, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
const root1 = "/foo/root1";
const ROOT_1 = fixPath(root1);
const root2 = "/foo/root2";
const ROOT_2 = fixPath(root2);
class MockTerminalProfileResolverService extends TestTerminalProfileResolverService {
  async getDefaultProfile() {
    return {
      profileName: "my-sh",
      path: "/usr/bin/zsh",
      env: {
        TEST: "TEST"
      },
      isDefault: true,
      isUnsafePath: false,
      isFromPath: true,
      icon: {
        id: "terminal-linux"
      },
      color: "terminal.ansiYellow"
    };
  }
}
const terminalShellTypeContextKey = {
  set: () => {
  },
  reset: () => {
  },
  get: () => void 0
};
class TestTerminalChildProcess extends Disposable {
  constructor(shouldPersist) {
    super();
    this.shouldPersist = shouldPersist;
    this.id = 0;
    this.onDidChangeProperty = Event.None;
    this.onProcessData = Event.None;
    this.onProcessExit = Event.None;
    this.onProcessReady = Event.None;
    this.onProcessTitleChanged = Event.None;
    this.onProcessShellTypeChanged = Event.None;
  }
  get capabilities() {
    return [];
  }
  updateProperty(property, value) {
    throw new Error("Method not implemented.");
  }
  async start() {
    return void 0;
  }
  shutdown(immediate) {
  }
  input(data) {
  }
  resize(cols, rows) {
  }
  clearBuffer() {
  }
  acknowledgeDataEvent(charCount) {
  }
  async setUnicodeVersion(version) {
  }
  async getInitialCwd() {
    return "";
  }
  async getCwd() {
    return "";
  }
  async processBinary(data) {
  }
  refreshProperty(property) {
    return Promise.resolve("");
  }
}
class TestTerminalInstanceService extends Disposable {
  getBackend() {
    return {
      onPtyHostExit: Event.None,
      onPtyHostUnresponsive: Event.None,
      onPtyHostResponsive: Event.None,
      onPtyHostRestart: Event.None,
      onDidMoveWindowInstance: Event.None,
      onDidRequestDetach: Event.None,
      createProcess: (shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, windowsEnableConpty, shouldPersist) => this._register(new TestTerminalChildProcess(shouldPersist)),
      getLatency: () => Promise.resolve([])
    };
  }
}
suite("Workbench - TerminalInstance", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  suite("TerminalInstance", () => {
    let terminalInstance;
    test("should create an instance of TerminalInstance with env from default profile", async () => {
      const instantiationService = workbenchInstantiationService({
        configurationService: () => new TestConfigurationService({
          files: {},
          terminal: {
            integrated: {
              fontFamily: "monospace",
              scrollback: 1e3,
              fastScrollSensitivity: 2,
              mouseWheelScrollSensitivity: 1,
              unicodeVersion: "6",
              shellIntegration: {
                enabled: true
              }
            }
          }
        })
      }, store);
      instantiationService.set(ITerminalProfileResolverService, new MockTerminalProfileResolverService());
      instantiationService.stub(IViewDescriptorService, new TestViewDescriptorService());
      instantiationService.stub(IEnvironmentVariableService, store.add(instantiationService.createInstance(EnvironmentVariableService)));
      instantiationService.stub(ITerminalInstanceService, store.add(new TestTerminalInstanceService()));
      terminalInstance = store.add(instantiationService.createInstance(TerminalInstance, terminalShellTypeContextKey, {}));
      await new Promise((resolve) => setTimeout(resolve, 100));
      deepStrictEqual(terminalInstance.shellLaunchConfig.env, { TEST: "TEST" });
    });
  });
  suite("parseExitResult", () => {
    test("should return no message for exit code = undefined", () => {
      deepStrictEqual(
        parseExitResult(void 0, {}, ProcessState.KilledDuringLaunch, void 0),
        { code: void 0, message: void 0 }
      );
      deepStrictEqual(
        parseExitResult(void 0, {}, ProcessState.KilledByUser, void 0),
        { code: void 0, message: void 0 }
      );
      deepStrictEqual(
        parseExitResult(void 0, {}, ProcessState.KilledByProcess, void 0),
        { code: void 0, message: void 0 }
      );
    });
    test("should return no message for exit code = 0", () => {
      deepStrictEqual(
        parseExitResult(0, {}, ProcessState.KilledDuringLaunch, void 0),
        { code: 0, message: void 0 }
      );
      deepStrictEqual(
        parseExitResult(0, {}, ProcessState.KilledByUser, void 0),
        { code: 0, message: void 0 }
      );
      deepStrictEqual(
        parseExitResult(0, {}, ProcessState.KilledDuringLaunch, void 0),
        { code: 0, message: void 0 }
      );
    });
    test("should return friendly message when executable is specified for non-zero exit codes", () => {
      deepStrictEqual(
        parseExitResult(1, { executable: "foo" }, ProcessState.KilledDuringLaunch, void 0),
        { code: 1, message: 'The terminal process "foo" failed to launch (exit code: 1).' }
      );
      deepStrictEqual(
        parseExitResult(1, { executable: "foo" }, ProcessState.KilledByUser, void 0),
        { code: 1, message: 'The terminal process "foo" terminated with exit code: 1.' }
      );
      deepStrictEqual(
        parseExitResult(1, { executable: "foo" }, ProcessState.KilledByProcess, void 0),
        { code: 1, message: 'The terminal process "foo" terminated with exit code: 1.' }
      );
    });
    test("should return friendly message when executable and args are specified for non-zero exit codes", () => {
      deepStrictEqual(
        parseExitResult(1, { executable: "foo", args: ["bar", "baz"] }, ProcessState.KilledDuringLaunch, void 0),
        { code: 1, message: `The terminal process "foo 'bar', 'baz'" failed to launch (exit code: 1).` }
      );
      deepStrictEqual(
        parseExitResult(1, { executable: "foo", args: ["bar", "baz"] }, ProcessState.KilledByUser, void 0),
        { code: 1, message: `The terminal process "foo 'bar', 'baz'" terminated with exit code: 1.` }
      );
      deepStrictEqual(
        parseExitResult(1, { executable: "foo", args: ["bar", "baz"] }, ProcessState.KilledByProcess, void 0),
        { code: 1, message: `The terminal process "foo 'bar', 'baz'" terminated with exit code: 1.` }
      );
    });
    test("should return friendly message when executable and arguments are omitted for non-zero exit codes", () => {
      deepStrictEqual(
        parseExitResult(1, {}, ProcessState.KilledDuringLaunch, void 0),
        { code: 1, message: `The terminal process failed to launch (exit code: 1).` }
      );
      deepStrictEqual(
        parseExitResult(1, {}, ProcessState.KilledByUser, void 0),
        { code: 1, message: `The terminal process terminated with exit code: 1.` }
      );
      deepStrictEqual(
        parseExitResult(1, {}, ProcessState.KilledByProcess, void 0),
        { code: 1, message: `The terminal process terminated with exit code: 1.` }
      );
    });
    test("should ignore pty host-related errors", () => {
      deepStrictEqual(
        parseExitResult({ message: "Could not find pty with id 16" }, {}, ProcessState.KilledDuringLaunch, void 0),
        { code: void 0, message: void 0 }
      );
    });
    test("should format conpty failure code 5", () => {
      deepStrictEqual(
        parseExitResult({ code: 5, message: "A native exception occurred during launch (Cannot create process, error code: 5)" }, { executable: "foo" }, ProcessState.KilledDuringLaunch, void 0),
        { code: 5, message: `The terminal process failed to launch: Access was denied to the path containing your executable "foo". Manage and change your permissions to get this to work.` }
      );
    });
    test("should format conpty failure code 267", () => {
      deepStrictEqual(
        parseExitResult({ code: 267, message: "A native exception occurred during launch (Cannot create process, error code: 267)" }, {}, ProcessState.KilledDuringLaunch, "/foo"),
        { code: 267, message: `The terminal process failed to launch: Invalid starting directory "/foo", review your terminal.integrated.cwd setting.` }
      );
    });
    test("should format conpty failure code 1260", () => {
      deepStrictEqual(
        parseExitResult({ code: 1260, message: "A native exception occurred during launch (Cannot create process, error code: 1260)" }, { executable: "foo" }, ProcessState.KilledDuringLaunch, void 0),
        { code: 1260, message: `The terminal process failed to launch: Windows cannot open this program because it has been prevented by a software restriction policy. For more information, open Event Viewer or contact your system Administrator.` }
      );
    });
    test("should format generic failures", () => {
      deepStrictEqual(
        parseExitResult({ code: 123, message: "A native exception occurred during launch (Cannot create process, error code: 123)" }, {}, ProcessState.KilledDuringLaunch, void 0),
        { code: 123, message: `The terminal process failed to launch: A native exception occurred during launch (Cannot create process, error code: 123).` }
      );
      deepStrictEqual(
        parseExitResult({ code: 123, message: "foo" }, {}, ProcessState.KilledDuringLaunch, void 0),
        { code: 123, message: `The terminal process failed to launch: foo.` }
      );
    });
  });
  suite("TerminalLabelComputer", () => {
    let instantiationService;
    let capabilities;
    function createInstance(partial) {
      const capabilities2 = store.add(new TerminalCapabilityStore());
      if (!isWindows) {
        capabilities2.add(TerminalCapability.NaiveCwdDetection, null);
      }
      return {
        shellLaunchConfig: {},
        shellType: GeneralShellType.PowerShell,
        cwd: "cwd",
        initialCwd: void 0,
        processName: "",
        sequence: void 0,
        workspaceFolder: void 0,
        staticTitle: void 0,
        capabilities: capabilities2,
        title: "",
        description: "",
        userHome: void 0,
        ...partial
      };
    }
    setup(async () => {
      instantiationService = workbenchInstantiationService(void 0, store);
      capabilities = store.add(new TerminalCapabilityStore());
      if (!isWindows) {
        capabilities.add(TerminalCapability.NaiveCwdDetection, null);
      }
    });
    function createLabelComputer(configuration) {
      instantiationService.set(IConfigurationService, new TestConfigurationService(configuration));
      instantiationService.set(ITerminalConfigurationService, store.add(instantiationService.createInstance(TerminalConfigurationService)));
      return store.add(instantiationService.createInstance(TerminalLabelComputer));
    }
    test('should resolve to "" when the template variables are empty', () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " - ", title: "", description: "" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "" }));
      strictEqual(terminalLabelComputer.title, "");
      strictEqual(terminalLabelComputer.description, "");
    });
    test("should resolve cwd", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " - ", title: "${cwd}", description: "${cwd}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, cwd: ROOT_1 }));
      strictEqual(terminalLabelComputer.title, ROOT_1);
      strictEqual(terminalLabelComputer.description, ROOT_1);
    });
    test("should resolve workspaceFolder", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " - ", title: "${workspaceFolder}", description: "${workspaceFolder}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "zsh", workspaceFolder: { uri: URI.from({ scheme: Schemas.file, path: "folder" }) } }));
      strictEqual(terminalLabelComputer.title, "folder");
      strictEqual(terminalLabelComputer.description, "folder");
    });
    test("should resolve local", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " - ", title: "${local}", description: "${local}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "zsh", shellLaunchConfig: { type: "Local" } }));
      strictEqual(terminalLabelComputer.title, "Local");
      strictEqual(terminalLabelComputer.description, "Local");
    });
    test("should resolve process", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " - ", title: "${process}", description: "${process}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "zsh" }));
      strictEqual(terminalLabelComputer.title, "zsh");
      strictEqual(terminalLabelComputer.description, "zsh");
    });
    test("should resolve sequence", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " - ", title: "${sequence}", description: "${sequence}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, sequence: "sequence" }));
      strictEqual(terminalLabelComputer.title, "sequence");
      strictEqual(terminalLabelComputer.description, "sequence");
    });
    test("should resolve task", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " ~ ", title: "${process}${separator}${task}", description: "${task}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "zsh", shellLaunchConfig: { type: "Task" } }));
      strictEqual(terminalLabelComputer.title, "zsh ~ Task");
      strictEqual(terminalLabelComputer.description, "Task");
    });
    test("should resolve separator", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " ~ ", title: "${separator}", description: "${separator}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "zsh", shellLaunchConfig: { type: "Task" } }));
      strictEqual(terminalLabelComputer.title, "zsh");
      strictEqual(terminalLabelComputer.description, "");
    });
    test("should always return static title when specified", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " ~ ", title: "${process}", description: "${workspaceFolder}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "process", workspaceFolder: { uri: URI.from({ scheme: Schemas.file, path: "folder" }) }, staticTitle: "my-title" }));
      strictEqual(terminalLabelComputer.title, "my-title");
      strictEqual(terminalLabelComputer.description, "folder");
    });
    test("should provide cwdFolder for all cwds only when in multi-root", () => {
      const terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " ~ ", title: "${process}${separator}${cwdFolder}", description: "${cwdFolder}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "process", workspaceFolder: { uri: URI.from({ scheme: Schemas.file, path: ROOT_1 }) }, cwd: ROOT_1 }));
      strictEqual(terminalLabelComputer.title, "process");
      strictEqual(terminalLabelComputer.description, "");
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "process", workspaceFolder: { uri: URI.from({ scheme: Schemas.file, path: ROOT_1 }) }, cwd: ROOT_2 }));
      if (isWindows) {
        strictEqual(terminalLabelComputer.title, "process");
        strictEqual(terminalLabelComputer.description, "");
      } else {
        strictEqual(terminalLabelComputer.title, "process ~ root2");
        strictEqual(terminalLabelComputer.description, "root2");
      }
    });
    test("should hide cwdFolder in single folder workspaces when cwd matches the workspace's default cwd even when slashes differ", async () => {
      let terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " ~ ", title: "${process}${separator}${cwdFolder}", description: "${cwdFolder}" } } } });
      terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "process", workspaceFolder: { uri: URI.from({ scheme: Schemas.file, path: ROOT_1 }) }, cwd: ROOT_1 }));
      strictEqual(terminalLabelComputer.title, "process");
      strictEqual(terminalLabelComputer.description, "");
      if (!isWindows) {
        terminalLabelComputer = createLabelComputer({ terminal: { integrated: { tabs: { separator: " ~ ", title: "${process}${separator}${cwdFolder}", description: "${cwdFolder}" } } } });
        terminalLabelComputer.refreshLabel(createInstance({ capabilities, processName: "process", workspaceFolder: { uri: URI.from({ scheme: Schemas.file, path: ROOT_1 }) }, cwd: ROOT_2 }));
        strictEqual(terminalLabelComputer.title, "process ~ root2");
        strictEqual(terminalLabelComputer.description, "root2");
      }
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxJbnN0YW5jZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZGVlcFN0cmljdEVxdWFsLCBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvdGVybWluYWxDYXBhYmlsaXR5U3RvcmUuanMnO1xuaW1wb3J0IHsgR2VuZXJhbFNoZWxsVHlwZSwgSVRlcm1pbmFsQ2hpbGRQcm9jZXNzLCBJVGVybWluYWxQcm9maWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IHBhcnNlRXhpdFJlc3VsdCwgVGVybWluYWxJbnN0YW5jZSwgVGVybWluYWxMYWJlbENvbXB1dGVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbEluc3RhbmNlLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlLmpzJztcbmltcG9ydCB7IEVudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2Vudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UsIFByb2Nlc3NTdGF0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBUZXN0Vmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi94dGVybS94dGVybVRlcm1pbmFsLnRlc3QuanMnO1xuaW1wb3J0IHsgZml4UGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC90ZXN0L2Jyb3dzZXIvcXVlcnlCdWlsZGVyLnRlc3QuanMnO1xuaW1wb3J0IHsgVGVzdFRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcblxuY29uc3Qgcm9vdDEgPSAnL2Zvby9yb290MSc7XG5jb25zdCBST09UXzEgPSBmaXhQYXRoKHJvb3QxKTtcbmNvbnN0IHJvb3QyID0gJy9mb28vcm9vdDInO1xuY29uc3QgUk9PVF8yID0gZml4UGF0aChyb290Mik7XG5cbmNsYXNzIE1vY2tUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UgZXh0ZW5kcyBUZXN0VGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlIHtcblx0b3ZlcnJpZGUgYXN5bmMgZ2V0RGVmYXVsdFByb2ZpbGUoKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlPiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHByb2ZpbGVOYW1lOiBcIm15LXNoXCIsXG5cdFx0XHRwYXRoOiBcIi91c3IvYmluL3pzaFwiLFxuXHRcdFx0ZW52OiB7XG5cdFx0XHRcdFRFU1Q6IFwiVEVTVFwiLFxuXHRcdFx0fSxcblx0XHRcdGlzRGVmYXVsdDogdHJ1ZSxcblx0XHRcdGlzVW5zYWZlUGF0aDogZmFsc2UsXG5cdFx0XHRpc0Zyb21QYXRoOiB0cnVlLFxuXHRcdFx0aWNvbjoge1xuXHRcdFx0XHRpZDogXCJ0ZXJtaW5hbC1saW51eFwiLFxuXHRcdFx0fSxcblx0XHRcdGNvbG9yOiBcInRlcm1pbmFsLmFuc2lZZWxsb3dcIixcblx0XHR9O1xuXHR9XG59XG5cbmNvbnN0IHRlcm1pbmFsU2hlbGxUeXBlQ29udGV4dEtleSA9IHtcblx0c2V0OiAoKSA9PiB7IH0sXG5cdHJlc2V0OiAoKSA9PiB7IH0sXG5cdGdldDogKCkgPT4gdW5kZWZpbmVkXG59O1xuXG5jbGFzcyBUZXN0VGVybWluYWxDaGlsZFByb2Nlc3MgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlcm1pbmFsQ2hpbGRQcm9jZXNzIHtcblx0aWQ6IG51bWJlciA9IDA7XG5cdGdldCBjYXBhYmlsaXRpZXMoKSB7IHJldHVybiBbXTsgfVxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBzaG91bGRQZXJzaXN0OiBib29sZWFuXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblx0dXBkYXRlUHJvcGVydHkocHJvcGVydHk6IGFueSwgdmFsdWU6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdG9uUHJvY2Vzc092ZXJyaWRlRGltZW5zaW9ucz86IEV2ZW50PGFueT4gfCB1bmRlZmluZWQ7XG5cdG9uUHJvY2Vzc1Jlc29sdmVkU2hlbGxMYXVuY2hDb25maWc/OiBFdmVudDxhbnk+IHwgdW5kZWZpbmVkO1xuXHRvbkRpZENoYW5nZUhhc0NoaWxkUHJvY2Vzc2VzPzogRXZlbnQ8YW55PiB8IHVuZGVmaW5lZDtcblxuXHRvbkRpZENoYW5nZVByb3BlcnR5ID0gRXZlbnQuTm9uZTtcblx0b25Qcm9jZXNzRGF0YSA9IEV2ZW50Lk5vbmU7XG5cdG9uUHJvY2Vzc0V4aXQgPSBFdmVudC5Ob25lO1xuXHRvblByb2Nlc3NSZWFkeSA9IEV2ZW50Lk5vbmU7XG5cdG9uUHJvY2Vzc1RpdGxlQ2hhbmdlZCA9IEV2ZW50Lk5vbmU7XG5cdG9uUHJvY2Vzc1NoZWxsVHlwZUNoYW5nZWQgPSBFdmVudC5Ob25lO1xuXHRhc3luYyBzdGFydCgpOiBQcm9taXNlPHVuZGVmaW5lZD4geyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdHNodXRkb3duKGltbWVkaWF0ZTogYm9vbGVhbik6IHZvaWQgeyB9XG5cdGlucHV0KGRhdGE6IHN0cmluZyk6IHZvaWQgeyB9XG5cdHJlc2l6ZShjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IHZvaWQgeyB9XG5cdGNsZWFyQnVmZmVyKCk6IHZvaWQgeyB9XG5cdGFja25vd2xlZGdlRGF0YUV2ZW50KGNoYXJDb3VudDogbnVtYmVyKTogdm9pZCB7IH1cblx0YXN5bmMgc2V0VW5pY29kZVZlcnNpb24odmVyc2lvbjogJzYnIHwgJzExJyk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIGdldEluaXRpYWxDd2QoKTogUHJvbWlzZTxzdHJpbmc+IHsgcmV0dXJuICcnOyB9XG5cdGFzeW5jIGdldEN3ZCgpOiBQcm9taXNlPHN0cmluZz4geyByZXR1cm4gJyc7IH1cblx0YXN5bmMgcHJvY2Vzc0JpbmFyeShkYXRhOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRyZWZyZXNoUHJvcGVydHkocHJvcGVydHk6IGFueSk6IFByb21pc2U8YW55PiB7IHJldHVybiBQcm9taXNlLnJlc29sdmUoJycpOyB9XG59XG5cbmNsYXNzIFRlc3RUZXJtaW5hbEluc3RhbmNlU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBQYXJ0aWFsPElUZXJtaW5hbEluc3RhbmNlU2VydmljZT4ge1xuXHRnZXRCYWNrZW5kKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRvblB0eUhvc3RFeGl0OiBFdmVudC5Ob25lLFxuXHRcdFx0b25QdHlIb3N0VW5yZXNwb25zaXZlOiBFdmVudC5Ob25lLFxuXHRcdFx0b25QdHlIb3N0UmVzcG9uc2l2ZTogRXZlbnQuTm9uZSxcblx0XHRcdG9uUHR5SG9zdFJlc3RhcnQ6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZE1vdmVXaW5kb3dJbnN0YW5jZTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVxdWVzdERldGFjaDogRXZlbnQuTm9uZSxcblx0XHRcdGNyZWF0ZVByb2Nlc3M6IChcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWc6IGFueSxcblx0XHRcdFx0Y3dkOiBzdHJpbmcsXG5cdFx0XHRcdGNvbHM6IG51bWJlcixcblx0XHRcdFx0cm93czogbnVtYmVyLFxuXHRcdFx0XHR1bmljb2RlVmVyc2lvbjogJzYnIHwgJzExJyxcblx0XHRcdFx0ZW52OiBhbnksXG5cdFx0XHRcdHdpbmRvd3NFbmFibGVDb25wdHk6IGJvb2xlYW4sXG5cdFx0XHRcdHNob3VsZFBlcnNpc3Q6IGJvb2xlYW5cblx0XHRcdCkgPT4gdGhpcy5fcmVnaXN0ZXIobmV3IFRlc3RUZXJtaW5hbENoaWxkUHJvY2VzcyhzaG91bGRQZXJzaXN0KSksXG5cdFx0XHRnZXRMYXRlbmN5OiAoKSA9PiBQcm9taXNlLnJlc29sdmUoW10pXG5cdFx0fSBhcyBhbnk7XG5cdH1cbn1cblxuc3VpdGUoJ1dvcmtiZW5jaCAtIFRlcm1pbmFsSW5zdGFuY2UnLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c3VpdGUoJ1Rlcm1pbmFsSW5zdGFuY2UnLCAoKSA9PiB7XG5cdFx0bGV0IHRlcm1pbmFsSW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlO1xuXHRcdHRlc3QoJ3Nob3VsZCBjcmVhdGUgYW4gaW5zdGFuY2Ugb2YgVGVybWluYWxJbnN0YW5jZSB3aXRoIGVudiBmcm9tIGRlZmF1bHQgcHJvZmlsZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogKCkgPT4gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7XG5cdFx0XHRcdFx0ZmlsZXM6IHt9LFxuXHRcdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0XHRpbnRlZ3JhdGVkOiB7XG5cdFx0XHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdtb25vc3BhY2UnLFxuXHRcdFx0XHRcdFx0XHRzY3JvbGxiYWNrOiAxMDAwLFxuXHRcdFx0XHRcdFx0XHRmYXN0U2Nyb2xsU2Vuc2l0aXZpdHk6IDIsXG5cdFx0XHRcdFx0XHRcdG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eTogMSxcblx0XHRcdFx0XHRcdFx0dW5pY29kZVZlcnNpb246ICc2Jyxcblx0XHRcdFx0XHRcdFx0c2hlbGxJbnRlZ3JhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdGVuYWJsZWQ6IHRydWVcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pXG5cdFx0XHR9LCBzdG9yZSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSwgbmV3IE1vY2tUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UoKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIG5ldyBUZXN0Vmlld0Rlc2NyaXB0b3JTZXJ2aWNlKCkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2UsIHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZSkpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLCBzdG9yZS5hZGQobmV3IFRlc3RUZXJtaW5hbEluc3RhbmNlU2VydmljZSgpKSk7XG5cdFx0XHR0ZXJtaW5hbEluc3RhbmNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsSW5zdGFuY2UsIHRlcm1pbmFsU2hlbGxUeXBlQ29udGV4dEtleSwge30pKTtcblx0XHRcdC8vIC8vV2FpdCBmb3IgdGhlIHRlbWluYWxJbnN0YW5jZS5feHRlcm1SZWFkeVByb21pc2UgdG8gcmVzb2x2ZVxuXHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMCkpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHRlcm1pbmFsSW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuZW52LCB7IFRFU1Q6ICdURVNUJyB9KTtcblx0XHR9KTtcblx0fSk7XG5cdHN1aXRlKCdwYXJzZUV4aXRSZXN1bHQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiBubyBtZXNzYWdlIGZvciBleGl0IGNvZGUgPSB1bmRlZmluZWQnLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCh1bmRlZmluZWQsIHt9LCBQcm9jZXNzU3RhdGUuS2lsbGVkRHVyaW5nTGF1bmNoLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IHVuZGVmaW5lZCwgbWVzc2FnZTogdW5kZWZpbmVkIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCh1bmRlZmluZWQsIHt9LCBQcm9jZXNzU3RhdGUuS2lsbGVkQnlVc2VyLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IHVuZGVmaW5lZCwgbWVzc2FnZTogdW5kZWZpbmVkIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCh1bmRlZmluZWQsIHt9LCBQcm9jZXNzU3RhdGUuS2lsbGVkQnlQcm9jZXNzLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IHVuZGVmaW5lZCwgbWVzc2FnZTogdW5kZWZpbmVkIH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiBubyBtZXNzYWdlIGZvciBleGl0IGNvZGUgPSAwJywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoMCwge30sIFByb2Nlc3NTdGF0ZS5LaWxsZWREdXJpbmdMYXVuY2gsIHVuZGVmaW5lZCksXG5cdFx0XHRcdHsgY29kZTogMCwgbWVzc2FnZTogdW5kZWZpbmVkIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCgwLCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZEJ5VXNlciwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiAwLCBtZXNzYWdlOiB1bmRlZmluZWQgfVxuXHRcdFx0KTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VFeGl0UmVzdWx0KDAsIHt9LCBQcm9jZXNzU3RhdGUuS2lsbGVkRHVyaW5nTGF1bmNoLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IDAsIG1lc3NhZ2U6IHVuZGVmaW5lZCB9XG5cdFx0XHQpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gZnJpZW5kbHkgbWVzc2FnZSB3aGVuIGV4ZWN1dGFibGUgaXMgc3BlY2lmaWVkIGZvciBub24temVybyBleGl0IGNvZGVzJywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoMSwgeyBleGVjdXRhYmxlOiAnZm9vJyB9LCBQcm9jZXNzU3RhdGUuS2lsbGVkRHVyaW5nTGF1bmNoLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IDEsIG1lc3NhZ2U6ICdUaGUgdGVybWluYWwgcHJvY2VzcyBcImZvb1wiIGZhaWxlZCB0byBsYXVuY2ggKGV4aXQgY29kZTogMSkuJyB9XG5cdFx0XHQpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoMSwgeyBleGVjdXRhYmxlOiAnZm9vJyB9LCBQcm9jZXNzU3RhdGUuS2lsbGVkQnlVc2VyLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IDEsIG1lc3NhZ2U6ICdUaGUgdGVybWluYWwgcHJvY2VzcyBcImZvb1wiIHRlcm1pbmF0ZWQgd2l0aCBleGl0IGNvZGU6IDEuJyB9XG5cdFx0XHQpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoMSwgeyBleGVjdXRhYmxlOiAnZm9vJyB9LCBQcm9jZXNzU3RhdGUuS2lsbGVkQnlQcm9jZXNzLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IDEsIG1lc3NhZ2U6ICdUaGUgdGVybWluYWwgcHJvY2VzcyBcImZvb1wiIHRlcm1pbmF0ZWQgd2l0aCBleGl0IGNvZGU6IDEuJyB9XG5cdFx0XHQpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gZnJpZW5kbHkgbWVzc2FnZSB3aGVuIGV4ZWN1dGFibGUgYW5kIGFyZ3MgYXJlIHNwZWNpZmllZCBmb3Igbm9uLXplcm8gZXhpdCBjb2RlcycsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VFeGl0UmVzdWx0KDEsIHsgZXhlY3V0YWJsZTogJ2ZvbycsIGFyZ3M6IFsnYmFyJywgJ2JheiddIH0sIFByb2Nlc3NTdGF0ZS5LaWxsZWREdXJpbmdMYXVuY2gsIHVuZGVmaW5lZCksXG5cdFx0XHRcdHsgY29kZTogMSwgbWVzc2FnZTogYFRoZSB0ZXJtaW5hbCBwcm9jZXNzIFwiZm9vICdiYXInLCAnYmF6J1wiIGZhaWxlZCB0byBsYXVuY2ggKGV4aXQgY29kZTogMSkuYCB9XG5cdFx0XHQpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoMSwgeyBleGVjdXRhYmxlOiAnZm9vJywgYXJnczogWydiYXInLCAnYmF6J10gfSwgUHJvY2Vzc1N0YXRlLktpbGxlZEJ5VXNlciwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiAxLCBtZXNzYWdlOiBgVGhlIHRlcm1pbmFsIHByb2Nlc3MgXCJmb28gJ2JhcicsICdiYXonXCIgdGVybWluYXRlZCB3aXRoIGV4aXQgY29kZTogMS5gIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCgxLCB7IGV4ZWN1dGFibGU6ICdmb28nLCBhcmdzOiBbJ2JhcicsICdiYXonXSB9LCBQcm9jZXNzU3RhdGUuS2lsbGVkQnlQcm9jZXNzLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IDEsIG1lc3NhZ2U6IGBUaGUgdGVybWluYWwgcHJvY2VzcyBcImZvbyAnYmFyJywgJ2JheidcIiB0ZXJtaW5hdGVkIHdpdGggZXhpdCBjb2RlOiAxLmAgfVxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmV0dXJuIGZyaWVuZGx5IG1lc3NhZ2Ugd2hlbiBleGVjdXRhYmxlIGFuZCBhcmd1bWVudHMgYXJlIG9taXR0ZWQgZm9yIG5vbi16ZXJvIGV4aXQgY29kZXMnLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCgxLCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiAxLCBtZXNzYWdlOiBgVGhlIHRlcm1pbmFsIHByb2Nlc3MgZmFpbGVkIHRvIGxhdW5jaCAoZXhpdCBjb2RlOiAxKS5gIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCgxLCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZEJ5VXNlciwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiAxLCBtZXNzYWdlOiBgVGhlIHRlcm1pbmFsIHByb2Nlc3MgdGVybWluYXRlZCB3aXRoIGV4aXQgY29kZTogMS5gIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCgxLCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZEJ5UHJvY2VzcywgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiAxLCBtZXNzYWdlOiBgVGhlIHRlcm1pbmFsIHByb2Nlc3MgdGVybWluYXRlZCB3aXRoIGV4aXQgY29kZTogMS5gIH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGlnbm9yZSBwdHkgaG9zdC1yZWxhdGVkIGVycm9ycycsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VFeGl0UmVzdWx0KHsgbWVzc2FnZTogJ0NvdWxkIG5vdCBmaW5kIHB0eSB3aXRoIGlkIDE2JyB9LCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiB1bmRlZmluZWQsIG1lc3NhZ2U6IHVuZGVmaW5lZCB9XG5cdFx0XHQpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBmb3JtYXQgY29ucHR5IGZhaWx1cmUgY29kZSA1JywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoeyBjb2RlOiA1LCBtZXNzYWdlOiAnQSBuYXRpdmUgZXhjZXB0aW9uIG9jY3VycmVkIGR1cmluZyBsYXVuY2ggKENhbm5vdCBjcmVhdGUgcHJvY2VzcywgZXJyb3IgY29kZTogNSknIH0sIHsgZXhlY3V0YWJsZTogJ2ZvbycgfSwgUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiA1LCBtZXNzYWdlOiBgVGhlIHRlcm1pbmFsIHByb2Nlc3MgZmFpbGVkIHRvIGxhdW5jaDogQWNjZXNzIHdhcyBkZW5pZWQgdG8gdGhlIHBhdGggY29udGFpbmluZyB5b3VyIGV4ZWN1dGFibGUgXCJmb29cIi4gTWFuYWdlIGFuZCBjaGFuZ2UgeW91ciBwZXJtaXNzaW9ucyB0byBnZXQgdGhpcyB0byB3b3JrLmAgfVxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgZm9ybWF0IGNvbnB0eSBmYWlsdXJlIGNvZGUgMjY3JywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoeyBjb2RlOiAyNjcsIG1lc3NhZ2U6ICdBIG5hdGl2ZSBleGNlcHRpb24gb2NjdXJyZWQgZHVyaW5nIGxhdW5jaCAoQ2Fubm90IGNyZWF0ZSBwcm9jZXNzLCBlcnJvciBjb2RlOiAyNjcpJyB9LCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCwgJy9mb28nKSxcblx0XHRcdFx0eyBjb2RlOiAyNjcsIG1lc3NhZ2U6IGBUaGUgdGVybWluYWwgcHJvY2VzcyBmYWlsZWQgdG8gbGF1bmNoOiBJbnZhbGlkIHN0YXJ0aW5nIGRpcmVjdG9yeSBcIi9mb29cIiwgcmV2aWV3IHlvdXIgdGVybWluYWwuaW50ZWdyYXRlZC5jd2Qgc2V0dGluZy5gIH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGZvcm1hdCBjb25wdHkgZmFpbHVyZSBjb2RlIDEyNjAnLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlRXhpdFJlc3VsdCh7IGNvZGU6IDEyNjAsIG1lc3NhZ2U6ICdBIG5hdGl2ZSBleGNlcHRpb24gb2NjdXJyZWQgZHVyaW5nIGxhdW5jaCAoQ2Fubm90IGNyZWF0ZSBwcm9jZXNzLCBlcnJvciBjb2RlOiAxMjYwKScgfSwgeyBleGVjdXRhYmxlOiAnZm9vJyB9LCBQcm9jZXNzU3RhdGUuS2lsbGVkRHVyaW5nTGF1bmNoLCB1bmRlZmluZWQpLFxuXHRcdFx0XHR7IGNvZGU6IDEyNjAsIG1lc3NhZ2U6IGBUaGUgdGVybWluYWwgcHJvY2VzcyBmYWlsZWQgdG8gbGF1bmNoOiBXaW5kb3dzIGNhbm5vdCBvcGVuIHRoaXMgcHJvZ3JhbSBiZWNhdXNlIGl0IGhhcyBiZWVuIHByZXZlbnRlZCBieSBhIHNvZnR3YXJlIHJlc3RyaWN0aW9uIHBvbGljeS4gRm9yIG1vcmUgaW5mb3JtYXRpb24sIG9wZW4gRXZlbnQgVmlld2VyIG9yIGNvbnRhY3QgeW91ciBzeXN0ZW0gQWRtaW5pc3RyYXRvci5gIH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGZvcm1hdCBnZW5lcmljIGZhaWx1cmVzJywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZUV4aXRSZXN1bHQoeyBjb2RlOiAxMjMsIG1lc3NhZ2U6ICdBIG5hdGl2ZSBleGNlcHRpb24gb2NjdXJyZWQgZHVyaW5nIGxhdW5jaCAoQ2Fubm90IGNyZWF0ZSBwcm9jZXNzLCBlcnJvciBjb2RlOiAxMjMpJyB9LCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiAxMjMsIG1lc3NhZ2U6IGBUaGUgdGVybWluYWwgcHJvY2VzcyBmYWlsZWQgdG8gbGF1bmNoOiBBIG5hdGl2ZSBleGNlcHRpb24gb2NjdXJyZWQgZHVyaW5nIGxhdW5jaCAoQ2Fubm90IGNyZWF0ZSBwcm9jZXNzLCBlcnJvciBjb2RlOiAxMjMpLmAgfVxuXHRcdFx0KTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VFeGl0UmVzdWx0KHsgY29kZTogMTIzLCBtZXNzYWdlOiAnZm9vJyB9LCB7fSwgUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCwgdW5kZWZpbmVkKSxcblx0XHRcdFx0eyBjb2RlOiAxMjMsIG1lc3NhZ2U6IGBUaGUgdGVybWluYWwgcHJvY2VzcyBmYWlsZWQgdG8gbGF1bmNoOiBmb28uYCB9XG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9KTtcblx0c3VpdGUoJ1Rlcm1pbmFsTGFiZWxDb21wdXRlcicsICgpID0+IHtcblx0XHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0XHRsZXQgY2FwYWJpbGl0aWVzOiBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZTtcblxuXHRcdGZ1bmN0aW9uIGNyZWF0ZUluc3RhbmNlKHBhcnRpYWw/OiBQYXJ0aWFsPElUZXJtaW5hbEluc3RhbmNlPik6IFBpY2s8SVRlcm1pbmFsSW5zdGFuY2UsICdzaGVsbExhdW5jaENvbmZpZycgfCAnc2hlbGxUeXBlJyB8ICd1c2VySG9tZScgfCAnY3dkJyB8ICdpbml0aWFsQ3dkJyB8ICdwcm9jZXNzTmFtZScgfCAnc2VxdWVuY2UnIHwgJ3dvcmtzcGFjZUZvbGRlcicgfCAnc3RhdGljVGl0bGUnIHwgJ2NhcGFiaWxpdGllcycgfCAndGl0bGUnIHwgJ2Rlc2NyaXB0aW9uJz4ge1xuXHRcdFx0Y29uc3QgY2FwYWJpbGl0aWVzID0gc3RvcmUuYWRkKG5ldyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSgpKTtcblx0XHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRcdGNhcGFiaWxpdGllcy5hZGQoVGVybWluYWxDYXBhYmlsaXR5Lk5haXZlQ3dkRGV0ZWN0aW9uLCBudWxsISk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzaGVsbExhdW5jaENvbmZpZzoge30sXG5cdFx0XHRcdHNoZWxsVHlwZTogR2VuZXJhbFNoZWxsVHlwZS5Qb3dlclNoZWxsLFxuXHRcdFx0XHRjd2Q6ICdjd2QnLFxuXHRcdFx0XHRpbml0aWFsQ3dkOiB1bmRlZmluZWQsXG5cdFx0XHRcdHByb2Nlc3NOYW1lOiAnJyxcblx0XHRcdFx0c2VxdWVuY2U6IHVuZGVmaW5lZCxcblx0XHRcdFx0d29ya3NwYWNlRm9sZGVyOiB1bmRlZmluZWQsXG5cdFx0XHRcdHN0YXRpY1RpdGxlOiB1bmRlZmluZWQsXG5cdFx0XHRcdGNhcGFiaWxpdGllcyxcblx0XHRcdFx0dGl0bGU6ICcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJycsXG5cdFx0XHRcdHVzZXJIb21lOiB1bmRlZmluZWQsXG5cdFx0XHRcdC4uLnBhcnRpYWxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKTtcblx0XHRcdGNhcGFiaWxpdGllcyA9IHN0b3JlLmFkZChuZXcgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUoKSk7XG5cdFx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0XHRjYXBhYmlsaXRpZXMuYWRkKFRlcm1pbmFsQ2FwYWJpbGl0eS5OYWl2ZUN3ZERldGVjdGlvbiwgbnVsbCEpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZnVuY3Rpb24gY3JlYXRlTGFiZWxDb21wdXRlcihjb25maWd1cmF0aW9uOiBhbnkpIHtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoY29uZmlndXJhdGlvbikpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc2V0KElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSkpKTtcblx0XHRcdHJldHVybiBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMYWJlbENvbXB1dGVyKSk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnc2hvdWxkIHJlc29sdmUgdG8gXCJcIiB3aGVuIHRoZSB0ZW1wbGF0ZSB2YXJpYWJsZXMgYXJlIGVtcHR5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxMYWJlbENvbXB1dGVyID0gY3JlYXRlTGFiZWxDb21wdXRlcih7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHsgdGFiczogeyBzZXBhcmF0b3I6ICcgLSAnLCB0aXRsZTogJycsIGRlc2NyaXB0aW9uOiAnJyB9IH0gfSB9KTtcblx0XHRcdHRlcm1pbmFsTGFiZWxDb21wdXRlci5yZWZyZXNoTGFiZWwoY3JlYXRlSW5zdGFuY2UoeyBjYXBhYmlsaXRpZXMsIHByb2Nlc3NOYW1lOiAnJyB9KSk7XG5cdFx0XHQvLyBUT0RPOlxuXHRcdFx0Ly8gdGVybWluYWxMYWJlbENvbXB1dGVyLm9uTGFiZWxDaGFuZ2VkKGUgPT4ge1xuXHRcdFx0Ly8gXHRzdHJpY3RFcXVhbChlLnRpdGxlLCAnJyk7XG5cdFx0XHQvLyBcdHN0cmljdEVxdWFsKGUuZGVzY3JpcHRpb24sICcnKTtcblx0XHRcdC8vIH0pO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLnRpdGxlLCAnJyk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICcnKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmVzb2x2ZSBjd2QnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbExhYmVsQ29tcHV0ZXIgPSBjcmVhdGVMYWJlbENvbXB1dGVyKHsgdGVybWluYWw6IHsgaW50ZWdyYXRlZDogeyB0YWJzOiB7IHNlcGFyYXRvcjogJyAtICcsIHRpdGxlOiAnJHtjd2R9JywgZGVzY3JpcHRpb246ICcke2N3ZH0nIH0gfSB9IH0pO1xuXHRcdFx0dGVybWluYWxMYWJlbENvbXB1dGVyLnJlZnJlc2hMYWJlbChjcmVhdGVJbnN0YW5jZSh7IGNhcGFiaWxpdGllcywgY3dkOiBST09UXzEgfSkpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLnRpdGxlLCBST09UXzEpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLmRlc2NyaXB0aW9uLCBST09UXzEpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXNvbHZlIHdvcmtzcGFjZUZvbGRlcicsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsTGFiZWxDb21wdXRlciA9IGNyZWF0ZUxhYmVsQ29tcHV0ZXIoeyB0ZXJtaW5hbDogeyBpbnRlZ3JhdGVkOiB7IHRhYnM6IHsgc2VwYXJhdG9yOiAnIC0gJywgdGl0bGU6ICcke3dvcmtzcGFjZUZvbGRlcn0nLCBkZXNjcmlwdGlvbjogJyR7d29ya3NwYWNlRm9sZGVyfScgfSB9IH0gfSk7XG5cdFx0XHR0ZXJtaW5hbExhYmVsQ29tcHV0ZXIucmVmcmVzaExhYmVsKGNyZWF0ZUluc3RhbmNlKHsgY2FwYWJpbGl0aWVzLCBwcm9jZXNzTmFtZTogJ3pzaCcsIHdvcmtzcGFjZUZvbGRlcjogeyB1cmk6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICdmb2xkZXInIH0pIH0gYXMgSVdvcmtzcGFjZUZvbGRlciB9KSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIudGl0bGUsICdmb2xkZXInKTtcblx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsTGFiZWxDb21wdXRlci5kZXNjcmlwdGlvbiwgJ2ZvbGRlcicpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXNvbHZlIGxvY2FsJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxMYWJlbENvbXB1dGVyID0gY3JlYXRlTGFiZWxDb21wdXRlcih7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHsgdGFiczogeyBzZXBhcmF0b3I6ICcgLSAnLCB0aXRsZTogJyR7bG9jYWx9JywgZGVzY3JpcHRpb246ICcke2xvY2FsfScgfSB9IH0gfSk7XG5cdFx0XHR0ZXJtaW5hbExhYmVsQ29tcHV0ZXIucmVmcmVzaExhYmVsKGNyZWF0ZUluc3RhbmNlKHsgY2FwYWJpbGl0aWVzLCBwcm9jZXNzTmFtZTogJ3pzaCcsIHNoZWxsTGF1bmNoQ29uZmlnOiB7IHR5cGU6ICdMb2NhbCcgfSB9KSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIudGl0bGUsICdMb2NhbCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLmRlc2NyaXB0aW9uLCAnTG9jYWwnKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmVzb2x2ZSBwcm9jZXNzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxMYWJlbENvbXB1dGVyID0gY3JlYXRlTGFiZWxDb21wdXRlcih7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHsgdGFiczogeyBzZXBhcmF0b3I6ICcgLSAnLCB0aXRsZTogJyR7cHJvY2Vzc30nLCBkZXNjcmlwdGlvbjogJyR7cHJvY2Vzc30nIH0gfSB9IH0pO1xuXHRcdFx0dGVybWluYWxMYWJlbENvbXB1dGVyLnJlZnJlc2hMYWJlbChjcmVhdGVJbnN0YW5jZSh7IGNhcGFiaWxpdGllcywgcHJvY2Vzc05hbWU6ICd6c2gnIH0pKTtcblx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsTGFiZWxDb21wdXRlci50aXRsZSwgJ3pzaCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLmRlc2NyaXB0aW9uLCAnenNoJyk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJlc29sdmUgc2VxdWVuY2UnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbExhYmVsQ29tcHV0ZXIgPSBjcmVhdGVMYWJlbENvbXB1dGVyKHsgdGVybWluYWw6IHsgaW50ZWdyYXRlZDogeyB0YWJzOiB7IHNlcGFyYXRvcjogJyAtICcsIHRpdGxlOiAnJHtzZXF1ZW5jZX0nLCBkZXNjcmlwdGlvbjogJyR7c2VxdWVuY2V9JyB9IH0gfSB9KTtcblx0XHRcdHRlcm1pbmFsTGFiZWxDb21wdXRlci5yZWZyZXNoTGFiZWwoY3JlYXRlSW5zdGFuY2UoeyBjYXBhYmlsaXRpZXMsIHNlcXVlbmNlOiAnc2VxdWVuY2UnIH0pKTtcblx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsTGFiZWxDb21wdXRlci50aXRsZSwgJ3NlcXVlbmNlJyk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICdzZXF1ZW5jZScpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXNvbHZlIHRhc2snLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbExhYmVsQ29tcHV0ZXIgPSBjcmVhdGVMYWJlbENvbXB1dGVyKHsgdGVybWluYWw6IHsgaW50ZWdyYXRlZDogeyB0YWJzOiB7IHNlcGFyYXRvcjogJyB+ICcsIHRpdGxlOiAnJHtwcm9jZXNzfSR7c2VwYXJhdG9yfSR7dGFza30nLCBkZXNjcmlwdGlvbjogJyR7dGFza30nIH0gfSB9IH0pO1xuXHRcdFx0dGVybWluYWxMYWJlbENvbXB1dGVyLnJlZnJlc2hMYWJlbChjcmVhdGVJbnN0YW5jZSh7IGNhcGFiaWxpdGllcywgcHJvY2Vzc05hbWU6ICd6c2gnLCBzaGVsbExhdW5jaENvbmZpZzogeyB0eXBlOiAnVGFzaycgfSB9KSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIudGl0bGUsICd6c2ggfiBUYXNrJyk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICdUYXNrJyk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJlc29sdmUgc2VwYXJhdG9yJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxMYWJlbENvbXB1dGVyID0gY3JlYXRlTGFiZWxDb21wdXRlcih7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHsgdGFiczogeyBzZXBhcmF0b3I6ICcgfiAnLCB0aXRsZTogJyR7c2VwYXJhdG9yfScsIGRlc2NyaXB0aW9uOiAnJHtzZXBhcmF0b3J9JyB9IH0gfSB9KTtcblx0XHRcdHRlcm1pbmFsTGFiZWxDb21wdXRlci5yZWZyZXNoTGFiZWwoY3JlYXRlSW5zdGFuY2UoeyBjYXBhYmlsaXRpZXMsIHByb2Nlc3NOYW1lOiAnenNoJywgc2hlbGxMYXVuY2hDb25maWc6IHsgdHlwZTogJ1Rhc2snIH0gfSkpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLnRpdGxlLCAnenNoJyk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICcnKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgYWx3YXlzIHJldHVybiBzdGF0aWMgdGl0bGUgd2hlbiBzcGVjaWZpZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbExhYmVsQ29tcHV0ZXIgPSBjcmVhdGVMYWJlbENvbXB1dGVyKHsgdGVybWluYWw6IHsgaW50ZWdyYXRlZDogeyB0YWJzOiB7IHNlcGFyYXRvcjogJyB+ICcsIHRpdGxlOiAnJHtwcm9jZXNzfScsIGRlc2NyaXB0aW9uOiAnJHt3b3Jrc3BhY2VGb2xkZXJ9JyB9IH0gfSB9KTtcblx0XHRcdHRlcm1pbmFsTGFiZWxDb21wdXRlci5yZWZyZXNoTGFiZWwoY3JlYXRlSW5zdGFuY2UoeyBjYXBhYmlsaXRpZXMsIHByb2Nlc3NOYW1lOiAncHJvY2VzcycsIHdvcmtzcGFjZUZvbGRlcjogeyB1cmk6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6ICdmb2xkZXInIH0pIH0gYXMgSVdvcmtzcGFjZUZvbGRlciwgc3RhdGljVGl0bGU6ICdteS10aXRsZScgfSkpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLnRpdGxlLCAnbXktdGl0bGUnKTtcblx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsTGFiZWxDb21wdXRlci5kZXNjcmlwdGlvbiwgJ2ZvbGRlcicpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBwcm92aWRlIGN3ZEZvbGRlciBmb3IgYWxsIGN3ZHMgb25seSB3aGVuIGluIG11bHRpLXJvb3QnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbExhYmVsQ29tcHV0ZXIgPSBjcmVhdGVMYWJlbENvbXB1dGVyKHsgdGVybWluYWw6IHsgaW50ZWdyYXRlZDogeyB0YWJzOiB7IHNlcGFyYXRvcjogJyB+ICcsIHRpdGxlOiAnJHtwcm9jZXNzfSR7c2VwYXJhdG9yfSR7Y3dkRm9sZGVyfScsIGRlc2NyaXB0aW9uOiAnJHtjd2RGb2xkZXJ9JyB9IH0gfSB9KTtcblx0XHRcdHRlcm1pbmFsTGFiZWxDb21wdXRlci5yZWZyZXNoTGFiZWwoY3JlYXRlSW5zdGFuY2UoeyBjYXBhYmlsaXRpZXMsIHByb2Nlc3NOYW1lOiAncHJvY2VzcycsIHdvcmtzcGFjZUZvbGRlcjogeyB1cmk6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6IFJPT1RfMSB9KSB9IGFzIElXb3Jrc3BhY2VGb2xkZXIsIGN3ZDogUk9PVF8xIH0pKTtcblx0XHRcdC8vIHNpbmdsZS1yb290LCBjd2QgaXMgc2FtZSBhcyByb290XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIudGl0bGUsICdwcm9jZXNzJyk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICcnKTtcblx0XHRcdC8vIG11bHRpLXJvb3Rcblx0XHRcdHRlcm1pbmFsTGFiZWxDb21wdXRlci5yZWZyZXNoTGFiZWwoY3JlYXRlSW5zdGFuY2UoeyBjYXBhYmlsaXRpZXMsIHByb2Nlc3NOYW1lOiAncHJvY2VzcycsIHdvcmtzcGFjZUZvbGRlcjogeyB1cmk6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUsIHBhdGg6IFJPT1RfMSB9KSB9IGFzIElXb3Jrc3BhY2VGb2xkZXIsIGN3ZDogUk9PVF8yIH0pKTtcblx0XHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxMYWJlbENvbXB1dGVyLnRpdGxlLCAncHJvY2VzcycpO1xuXHRcdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICcnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsTGFiZWxDb21wdXRlci50aXRsZSwgJ3Byb2Nlc3MgfiByb290MicpO1xuXHRcdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICdyb290MicpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBoaWRlIGN3ZEZvbGRlciBpbiBzaW5nbGUgZm9sZGVyIHdvcmtzcGFjZXMgd2hlbiBjd2QgbWF0Y2hlcyB0aGUgd29ya3NwYWNlXFwncyBkZWZhdWx0IGN3ZCBldmVuIHdoZW4gc2xhc2hlcyBkaWZmZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgdGVybWluYWxMYWJlbENvbXB1dGVyID0gY3JlYXRlTGFiZWxDb21wdXRlcih7IHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHsgdGFiczogeyBzZXBhcmF0b3I6ICcgfiAnLCB0aXRsZTogJyR7cHJvY2Vzc30ke3NlcGFyYXRvcn0ke2N3ZEZvbGRlcn0nLCBkZXNjcmlwdGlvbjogJyR7Y3dkRm9sZGVyfScgfSB9IH0gfSk7XG5cdFx0XHR0ZXJtaW5hbExhYmVsQ29tcHV0ZXIucmVmcmVzaExhYmVsKGNyZWF0ZUluc3RhbmNlKHsgY2FwYWJpbGl0aWVzLCBwcm9jZXNzTmFtZTogJ3Byb2Nlc3MnLCB3b3Jrc3BhY2VGb2xkZXI6IHsgdXJpOiBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiBST09UXzEgfSkgfSBhcyBJV29ya3NwYWNlRm9sZGVyLCBjd2Q6IFJPT1RfMSB9KSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIudGl0bGUsICdwcm9jZXNzJyk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICcnKTtcblx0XHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRcdHRlcm1pbmFsTGFiZWxDb21wdXRlciA9IGNyZWF0ZUxhYmVsQ29tcHV0ZXIoeyB0ZXJtaW5hbDogeyBpbnRlZ3JhdGVkOiB7IHRhYnM6IHsgc2VwYXJhdG9yOiAnIH4gJywgdGl0bGU6ICcke3Byb2Nlc3N9JHtzZXBhcmF0b3J9JHtjd2RGb2xkZXJ9JywgZGVzY3JpcHRpb246ICcke2N3ZEZvbGRlcn0nIH0gfSB9IH0pO1xuXHRcdFx0XHR0ZXJtaW5hbExhYmVsQ29tcHV0ZXIucmVmcmVzaExhYmVsKGNyZWF0ZUluc3RhbmNlKHsgY2FwYWJpbGl0aWVzLCBwcm9jZXNzTmFtZTogJ3Byb2Nlc3MnLCB3b3Jrc3BhY2VGb2xkZXI6IHsgdXJpOiBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiBST09UXzEgfSkgfSBhcyBJV29ya3NwYWNlRm9sZGVyLCBjd2Q6IFJPT1RfMiB9KSk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsTGFiZWxDb21wdXRlci50aXRsZSwgJ3Byb2Nlc3MgfiByb290MicpO1xuXHRcdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbExhYmVsQ29tcHV0ZXIuZGVzY3JpcHRpb24sICdyb290MicpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxpQkFBaUIsbUJBQW1CO0FBQzdDLFNBQVMsYUFBYTtBQUN0QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsd0JBQWlFO0FBRTFFLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsK0JBQWtELGdDQUFnQztBQUMzRixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLGlCQUFpQixrQkFBa0IsNkJBQTZCO0FBQ3pFLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsaUNBQWlDLG9CQUFvQjtBQUM5RCxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQ0FBb0MscUNBQXFDO0FBRWxGLE1BQU0sUUFBUTtBQUNkLE1BQU0sU0FBUyxRQUFRLEtBQUs7QUFDNUIsTUFBTSxRQUFRO0FBQ2QsTUFBTSxTQUFTLFFBQVEsS0FBSztBQUU1QixNQUFNLDJDQUEyQyxtQ0FBbUM7QUFBQSxFQUNuRixNQUFlLG9CQUErQztBQUM3RCxXQUFPO0FBQUEsTUFDTixhQUFhO0FBQUEsTUFDYixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsUUFDSixNQUFNO0FBQUEsTUFDUDtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsY0FBYztBQUFBLE1BQ2QsWUFB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
