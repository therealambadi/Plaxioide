import { strictEqual } from "assert";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { Event } from "../../../../../../base/common/event.js";
import { isWindows } from "../../../../../../base/common/platform.js";
import { URI } from "../../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { TestCommandService } from "../../../../../../editor/test/browser/editorTestServices.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ContextMenuService } from "../../../../../../platform/contextview/browser/contextMenuService.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { ILogService, NullLogService } from "../../../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { TerminalCapability } from "../../../../../../platform/terminal/common/capabilities/capabilities.js";
import { CommandDetectionCapability } from "../../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js";
import { TerminalCapabilityStore } from "../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { ITerminalQuickFixService } from "../../browser/quickFix.js";
import { getQuickFixesForCommand, TerminalQuickFixAddon } from "../../browser/quickFixAddon.js";
import { freePort, FreePortOutputRegex, gitCreatePr, GitCreatePrOutputRegex, gitFastForwardPull, GitFastForwardPullOutputRegex, GitPushOutputRegex, gitPushSetUpstream, gitSimilar, GitSimilarOutputRegex, gitTwoDashes, GitTwoDashesRegex, pwshGeneralError, PwshGeneralErrorOutputRegex, pwshUnixCommandNotFoundError, PwshUnixCommandNotFoundErrorOutputRegex } from "../../browser/terminalQuickFixBuiltinActions.js";
import { TestStorageService } from "../../../../../test/common/workbenchTestServices.js";
suite("QuickFixAddon", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let quickFixAddon;
  let commandDetection;
  let commandService;
  let openerService;
  let labelService;
  let terminal;
  let instantiationService;
  setup(async () => {
    instantiationService = store.add(new TestInstantiationService());
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    terminal = store.add(new TerminalCtor({
      allowProposedApi: true,
      cols: 80,
      rows: 30
    }));
    instantiationService.stub(IStorageService, store.add(new TestStorageService()));
    instantiationService.stub(ITerminalQuickFixService, {
      onDidRegisterProvider: Event.None,
      onDidUnregisterProvider: Event.None,
      onDidRegisterCommandSelector: Event.None,
      extensionQuickFixes: Promise.resolve([])
    });
    instantiationService.stub(IConfigurationService, new TestConfigurationService());
    labelService = instantiationService.stub(ILabelService, {});
    const capabilities = store.add(new TerminalCapabilityStore());
    instantiationService.stub(ILogService, new NullLogService());
    commandDetection = store.add(instantiationService.createInstance(CommandDetectionCapability, terminal));
    capabilities.add(TerminalCapability.CommandDetection, commandDetection);
    instantiationService.stub(IContextMenuService, store.add(instantiationService.createInstance(ContextMenuService)));
    openerService = instantiationService.stub(IOpenerService, {});
    commandService = new TestCommandService(instantiationService);
    quickFixAddon = instantiationService.createInstance(TerminalQuickFixAddon, [], capabilities);
    terminal.loadAddon(quickFixAddon);
  });
  suite("registerCommandFinishedListener & getMatchActions", () => {
    suite("gitSimilarCommand", () => {
      const expectedMap = /* @__PURE__ */ new Map();
      const command = `git sttatus`;
      let output = `git: 'sttatus' is not a git command. See 'git --help'.

			The most similar command is
			status`;
      const exitCode = 1;
      const actions = [{
        id: "Git Similar",
        enabled: true,
        label: "Run: git status",
        tooltip: "Run: git status",
        command: "git status"
      }];
      const outputLines = output.split("\n");
      setup(() => {
        const command2 = gitSimilar();
        expectedMap.set(command2.commandLineMatcher.toString(), [command2]);
        quickFixAddon.registerCommandFinishedListener(command2);
      });
      suite("returns undefined when", () => {
        test("output does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, GitSimilarOutputRegex, exitCode, [`invalid output`]), expectedMap, commandService, openerService, labelService), void 0);
        });
        test("command does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(`gt sttatus`, output, GitSimilarOutputRegex, exitCode, outputLines), expectedMap, commandService, openerService, labelService), void 0);
        });
      });
      suite("returns actions when", () => {
        test("expected unix exit code", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitSimilarOutputRegex, exitCode, outputLines), expectedMap, commandService, openerService, labelService), actions);
        });
        test("matching exit status", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitSimilarOutputRegex, 2, outputLines), expectedMap, commandService, openerService, labelService), actions);
        });
      });
      suite("returns match", () => {
        test("returns match", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitSimilarOutputRegex, exitCode, outputLines), expectedMap, commandService, openerService, labelService), actions);
        });
        test("returns multiple match", async () => {
          output = `git: 'pu' is not a git command. See 'git --help'.
				The most similar commands are
						pull
						push`;
          const actions2 = [{
            id: "Git Similar",
            enabled: true,
            label: "Run: git pull",
            tooltip: "Run: git pull",
            command: "git pull"
          }, {
            id: "Git Similar",
            enabled: true,
            label: "Run: git push",
            tooltip: "Run: git push",
            command: "git push"
          }];
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand("git pu", output, GitSimilarOutputRegex, exitCode, output.split("\n")), expectedMap, commandService, openerService, labelService), actions2);
        });
        test("passes any arguments through", async () => {
          output = `git: 'checkoutt' is not a git command. See 'git --help'.
				The most similar commands are
						checkout`;
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand("git checkoutt .", output, GitSimilarOutputRegex, exitCode, output.split("\n")), expectedMap, commandService, openerService, labelService), [{
            id: "Git Similar",
            enabled: true,
            label: "Run: git checkout .",
            tooltip: "Run: git checkout .",
            command: "git checkout ."
          }]);
        });
      });
    });
    suite("gitTwoDashes", () => {
      const expectedMap = /* @__PURE__ */ new Map();
      const command = `git add . -all`;
      const output = "error: did you mean `--all` (with two dashes)?";
      const exitCode = 1;
      const actions = [{
        id: "Git Two Dashes",
        enabled: true,
        label: "Run: git add . --all",
        tooltip: "Run: git add . --all",
        command: "git add . --all"
      }];
      setup(() => {
        const command2 = gitTwoDashes();
        expectedMap.set(command2.commandLineMatcher.toString(), [command2]);
        quickFixAddon.registerCommandFinishedListener(command2);
      });
      suite("returns undefined when", () => {
        test("output does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, GitTwoDashesRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
        test("command does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(`gt sttatus`, output, GitTwoDashesRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
      });
      suite("returns actions when", () => {
        test("expected unix exit code", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitTwoDashesRegex, exitCode), expectedMap, commandService, openerService, labelService), actions);
        });
        test("matching exit status", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitTwoDashesRegex, 2), expectedMap, commandService, openerService, labelService), actions);
        });
      });
    });
    suite("gitFastForwardPull", () => {
      const expectedMap = /* @__PURE__ */ new Map();
      const command = `git checkout vnext`;
      const output = "Already on 'vnext' \n Your branch is behind 'origin/vnext' by 1 commit, and can be fast-forwarded.";
      const exitCode = 0;
      const actions = [{
        id: "Git Fast Forward Pull",
        enabled: true,
        label: "Run: git pull",
        tooltip: "Run: git pull",
        command: "git pull"
      }];
      setup(() => {
        const command2 = gitFastForwardPull();
        expectedMap.set(command2.commandLineMatcher.toString(), [command2]);
        quickFixAddon.registerCommandFinishedListener(command2);
      });
      suite("returns undefined when", () => {
        test("output does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, GitFastForwardPullOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
        test("command does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(`gt add`, output, GitFastForwardPullOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
        test("exit code does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitFastForwardPullOutputRegex, 2), expectedMap, commandService, openerService, labelService), void 0);
        });
      });
      suite("returns actions when", () => {
        test("matching exit status, command, ouput", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitFastForwardPullOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), actions);
        });
      });
    });
    if (!isWindows) {
      suite("freePort", () => {
        const expectedMap = /* @__PURE__ */ new Map();
        const portCommand = `yarn start dev`;
        const output = `yarn run v1.22.17
			warning ../../package.json: No license field
			Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
				at Server.setupListenHandle [as _listen2] (node:net:1315:16)
				at listenInCluster (node:net:1363:12)
				at doListen (node:net:1501:7)
				at processTicksAndRejections (node:internal/process/task_queues:84:21)
			Emitted 'error' event on WebSocketServer instance at:
				at Server.emit (node:events:394:28)
				at emitErrorNT (node:net:1342:8)
				at processTicksAndRejections (node:internal/process/task_queues:83:21) {
			}
			error Command failed with exit code 1.
			info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.`;
        const actionOptions = [{
          id: "Free Port",
          label: "Free port 3000",
          run: true,
          tooltip: "Free port 3000",
          enabled: true
        }];
        setup(() => {
          const command = freePort(() => Promise.resolve());
          expectedMap.set(command.commandLineMatcher.toString(), [command]);
          quickFixAddon.registerCommandFinishedListener(command);
        });
        suite("returns undefined when", () => {
          test("output does not match", async () => {
            strictEqual(await getQuickFixesForCommand([], terminal, createCommand(portCommand, `invalid output`, FreePortOutputRegex), expectedMap, commandService, openerService, labelService), void 0);
          });
        });
        test("returns actions", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(portCommand, output, FreePortOutputRegex), expectedMap, commandService, openerService, labelService), actionOptions);
        });
      });
    }
    suite("gitPushSetUpstream", () => {
      const expectedMap = /* @__PURE__ */ new Map();
      const command = `git push`;
      const output = `fatal: The current branch test22 has no upstream branch.
			To push the current branch and set the remote as upstream, use

				git push --set-upstream origin test22`;
      const exitCode = 128;
      const actions = [{
        id: "Git Push Set Upstream",
        enabled: true,
        label: "Run: git push --set-upstream origin test22",
        tooltip: "Run: git push --set-upstream origin test22",
        command: "git push --set-upstream origin test22"
      }];
      setup(() => {
        const command2 = gitPushSetUpstream();
        expectedMap.set(command2.commandLineMatcher.toString(), [command2]);
        quickFixAddon.registerCommandFinishedListener(command2);
      });
      suite("returns undefined when", () => {
        test("output does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, GitPushOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
        test("command does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(`git status`, output, GitPushOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
      });
      suite("returns actions when", () => {
        test("expected unix exit code", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitPushOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), actions);
        });
        test("matching exit status", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitPushOutputRegex, 2), expectedMap, commandService, openerService, labelService), actions);
        });
      });
    });
    suite("gitCreatePr", () => {
      const expectedMap = /* @__PURE__ */ new Map();
      const command = `git push`;
      const output = `Total 0 (delta 0), reused 0 (delta 0), pack-reused 0
			remote:
			remote: Create a pull request for 'test22' on GitHub by visiting:
			remote:      https://github.com/meganrogge/xterm.js/pull/new/test22
			remote:
			To https://github.com/meganrogge/xterm.js
			 * [new branch]        test22 -> test22
			Branch 'test22' set up to track remote branch 'test22' from 'origin'. `;
      const exitCode = 0;
      const actions = [{
        id: "Git Create Pr",
        enabled: true,
        label: "Open: https://github.com/meganrogge/xterm.js/pull/new/test22",
        tooltip: "Open: https://github.com/meganrogge/xterm.js/pull/new/test22",
        uri: URI.parse("https://github.com/meganrogge/xterm.js/pull/new/test22")
      }];
      setup(() => {
        const command2 = gitCreatePr();
        expectedMap.set(command2.commandLineMatcher.toString(), [command2]);
        quickFixAddon.registerCommandFinishedListener(command2);
      });
      suite("returns undefined when", () => {
        test("output does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, GitCreatePrOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
        test("command does not match", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(`git status`, output, GitCreatePrOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
        });
        test("failure exit status", async () => {
          strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitCreatePrOutputRegex, 2), expectedMap, commandService, openerService, labelService), void 0);
        });
      });
      suite("returns actions when", () => {
        test("expected unix exit code", async () => {
          assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitCreatePrOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), actions);
        });
      });
    });
  });
  suite("gitPush - multiple providers", () => {
    const expectedMap = /* @__PURE__ */ new Map();
    const command = `git push`;
    const output = `fatal: The current branch test22 has no upstream branch.
		To push the current branch and set the remote as upstream, use

			git push --set-upstream origin test22`;
    const exitCode = 128;
    const actions = [{
      id: "Git Push Set Upstream",
      enabled: true,
      label: "Run: git push --set-upstream origin test22",
      tooltip: "Run: git push --set-upstream origin test22",
      command: "git push --set-upstream origin test22"
    }];
    setup(() => {
      const pushCommand = gitPushSetUpstream();
      const prCommand = gitCreatePr();
      quickFixAddon.registerCommandFinishedListener(prCommand);
      expectedMap.set(pushCommand.commandLineMatcher.toString(), [pushCommand, prCommand]);
    });
    suite("returns undefined when", () => {
      test("output does not match", async () => {
        strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, GitPushOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
      });
      test("command does not match", async () => {
        strictEqual(await getQuickFixesForCommand([], terminal, createCommand(`git status`, output, GitPushOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
      });
    });
    suite("returns actions when", () => {
      test("expected unix exit code", async () => {
        assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitPushOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), actions);
      });
      test("matching exit status", async () => {
        assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, GitPushOutputRegex, 2), expectedMap, commandService, openerService, labelService), actions);
      });
    });
  });
  suite("pwsh feedback providers", () => {
    suite("General", () => {
      const expectedMap = /* @__PURE__ */ new Map();
      const command = `not important`;
      const output = [
        `...`,
        ``,
        `Suggestion [General]:`,
        `  The most similar commands are: python3, python3m, pamon, python3.6, rtmon, echo, pushd, etsn, pwsh, pwconv.`,
        ``,
        `Suggestion [cmd-not-found]:`,
        `  Command 'python' not found, but can be installed with:`,
        `  sudo apt install python3`,
        `  sudo apt install python`,
        `  sudo apt install python-minimal`,
        `  You also have python3 installed, you can run 'python3' instead.'`,
        ``
      ].join("\n");
      const exitCode = 128;
      const actions = [
        "python3",
        "python3m",
        "pamon",
        "python3.6",
        "rtmon",
        "echo",
        "pushd",
        "etsn",
        "pwsh",
        "pwconv"
      ].map((command2) => {
        return {
          id: "Pwsh General Error",
          enabled: true,
          label: `Run: ${command2}`,
          tooltip: `Run: ${command2}`,
          command: command2
        };
      });
      setup(() => {
        const pushCommand = pwshGeneralError();
        quickFixAddon.registerCommandFinishedListener(pushCommand);
        expectedMap.set(pushCommand.commandLineMatcher.toString(), [pushCommand]);
      });
      test("returns undefined when output does not match", async () => {
        strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, PwshGeneralErrorOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
      });
      test("returns actions when output matches", async () => {
        assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, PwshGeneralErrorOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), actions);
      });
    });
    suite("Unix cmd-not-found", () => {
      const expectedMap = /* @__PURE__ */ new Map();
      const command = `not important`;
      const output = [
        `...`,
        ``,
        `Suggestion [General]`,
        `  The most similar commands are: python3, python3m, pamon, python3.6, rtmon, echo, pushd, etsn, pwsh, pwconv.`,
        ``,
        `Suggestion [cmd-not-found]:`,
        `  Command 'python' not found, but can be installed with:`,
        `  sudo apt install python3`,
        `  sudo apt install python`,
        `  sudo apt install python-minimal`,
        `  You also have python3 installed, you can run 'python3' instead.'`,
        ``
      ].join("\n");
      const exitCode = 128;
      const actions = [
        "sudo apt install python3",
        "sudo apt install python",
        "sudo apt install python-minimal",
        "python3"
      ].map((command2) => {
        return {
          id: "Pwsh Unix Command Not Found Error",
          enabled: true,
          label: `Run: ${command2}`,
          tooltip: `Run: ${command2}`,
          command: command2
        };
      });
      setup(() => {
        const pushCommand = pwshUnixCommandNotFoundError();
        quickFixAddon.registerCommandFinishedListener(pushCommand);
        expectedMap.set(pushCommand.commandLineMatcher.toString(), [pushCommand]);
      });
      test("returns undefined when output does not match", async () => {
        strictEqual(await getQuickFixesForCommand([], terminal, createCommand(command, `invalid output`, PwshUnixCommandNotFoundErrorOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), void 0);
      });
      test("returns actions when output matches", async () => {
        assertMatchOptions(await getQuickFixesForCommand([], terminal, createCommand(command, output, PwshUnixCommandNotFoundErrorOutputRegex, exitCode), expectedMap, commandService, openerService, labelService), actions);
      });
    });
  });
});
function createCommand(command, output, outputMatcher, exitCode, outputLines) {
  return {
    cwd: "",
    commandStartLineContent: "",
    markProperties: {},
    executedX: void 0,
    startX: void 0,
    command,
    isTrusted: true,
    exitCode,
    getOutput: () => {
      return output;
    },
    getOutputMatch: (_matcher) => {
      if (outputMatcher) {
        const regexMatch = output.match(outputMatcher) ?? void 0;
        if (regexMatch) {
          return outputLines ? { regexMatch, outputLines } : { regexMatch, outputLines: [] };
        }
      }
      return void 0;
    },
    timestamp: Date.now(),
    hasOutput: () => !!output
  };
}
function assertMatchOptions(actual, expected) {
  strictEqual(actual?.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    const expectedItem = expected[i];
    const actualItem = actual[i];
    strictEqual(actualItem.id, expectedItem.id, `ID`);
    strictEqual(actualItem.enabled, expectedItem.enabled, `enabled`);
    strictEqual(actualItem.label, expectedItem.label, `label`);
    strictEqual(actualItem.tooltip, expectedItem.tooltip, `tooltip`);
    if (expectedItem.command) {
      strictEqual(actualItem.command, expectedItem.command);
    }
    if (expectedItem.uri) {
      strictEqual(actualItem.uri.toString(), expectedItem.uri.toString());
    }
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvcXVpY2tGaXgvdGVzdC9icm93c2VyL3F1aWNrRml4QWRkb24udGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlIHsgVGVybWluYWwgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgc3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaW1wb3J0QU1ETm9kZU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2FtZFguanMnO1xuaW1wb3J0IHsgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9icm93c2VyL2VkaXRvclRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dE1lbnVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbW1hbmQsIFRlcm1pbmFsQ2FwYWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB7IENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvdGVybWluYWxDYXBhYmlsaXR5U3RvcmUuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsT3V0cHV0TWF0Y2hlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxRdWlja0ZpeFNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3F1aWNrRml4LmpzJztcbmltcG9ydCB7IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kLCBUZXJtaW5hbFF1aWNrRml4QWRkb24gfSBmcm9tICcuLi8uLi9icm93c2VyL3F1aWNrRml4QWRkb24uanMnO1xuaW1wb3J0IHsgZnJlZVBvcnQsIEZyZWVQb3J0T3V0cHV0UmVnZXgsIGdpdENyZWF0ZVByLCBHaXRDcmVhdGVQck91dHB1dFJlZ2V4LCBnaXRGYXN0Rm9yd2FyZFB1bGwsIEdpdEZhc3RGb3J3YXJkUHVsbE91dHB1dFJlZ2V4LCBHaXRQdXNoT3V0cHV0UmVnZXgsIGdpdFB1c2hTZXRVcHN0cmVhbSwgZ2l0U2ltaWxhciwgR2l0U2ltaWxhck91dHB1dFJlZ2V4LCBnaXRUd29EYXNoZXMsIEdpdFR3b0Rhc2hlc1JlZ2V4LCBwd3NoR2VuZXJhbEVycm9yLCBQd3NoR2VuZXJhbEVycm9yT3V0cHV0UmVnZXgsIHB3c2hVbml4Q29tbWFuZE5vdEZvdW5kRXJyb3IsIFB3c2hVbml4Q29tbWFuZE5vdEZvdW5kRXJyb3JPdXRwdXRSZWdleCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWxRdWlja0ZpeEJ1aWx0aW5BY3Rpb25zLmpzJztcbmltcG9ydCB7IFRlc3RTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5cbnN1aXRlKCdRdWlja0ZpeEFkZG9uJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBxdWlja0ZpeEFkZG9uOiBUZXJtaW5hbFF1aWNrRml4QWRkb247XG5cdGxldCBjb21tYW5kRGV0ZWN0aW9uOiBDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eTtcblx0bGV0IGNvbW1hbmRTZXJ2aWNlOiBUZXN0Q29tbWFuZFNlcnZpY2U7XG5cdGxldCBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZTtcblx0bGV0IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZTtcblx0bGV0IHRlcm1pbmFsOiBUZXJtaW5hbDtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgVGVybWluYWxDdG9yID0gKGF3YWl0IGltcG9ydEFNRE5vZGVNb2R1bGU8dHlwZW9mIGltcG9ydCgnQHh0ZXJtL3h0ZXJtJyk+KCdAeHRlcm0veHRlcm0nLCAnbGliL3h0ZXJtLmpzJykpLlRlcm1pbmFsO1xuXHRcdHRlcm1pbmFsID0gc3RvcmUuYWRkKG5ldyBUZXJtaW5hbEN0b3Ioe1xuXHRcdFx0YWxsb3dQcm9wb3NlZEFwaTogdHJ1ZSxcblx0XHRcdGNvbHM6IDgwLFxuXHRcdFx0cm93czogMzBcblx0XHR9KSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU3RvcmFnZVNlcnZpY2UsIHN0b3JlLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXJtaW5hbFF1aWNrRml4U2VydmljZSwge1xuXHRcdFx0b25EaWRSZWdpc3RlclByb3ZpZGVyOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRVbnJlZ2lzdGVyUHJvdmlkZXI6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZFJlZ2lzdGVyQ29tbWFuZFNlbGVjdG9yOiBFdmVudC5Ob25lLFxuXHRcdFx0ZXh0ZW5zaW9uUXVpY2tGaXhlczogUHJvbWlzZS5yZXNvbHZlKFtdKVxuXHRcdH0gYXMgUGFydGlhbDxJVGVybWluYWxRdWlja0ZpeFNlcnZpY2U+KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpKTtcblx0XHRsYWJlbFNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMYWJlbFNlcnZpY2UsIHt9IGFzIFBhcnRpYWw8SUxhYmVsU2VydmljZT4pO1xuXHRcdGNvbnN0IGNhcGFiaWxpdGllcyA9IHN0b3JlLmFkZChuZXcgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGNvbW1hbmREZXRlY3Rpb24gPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHksIHRlcm1pbmFsKSk7XG5cdFx0Y2FwYWJpbGl0aWVzLmFkZChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiwgY29tbWFuZERldGVjdGlvbik7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udGV4dE1lbnVTZXJ2aWNlLCBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udGV4dE1lbnVTZXJ2aWNlKSkpO1xuXHRcdG9wZW5lclNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElPcGVuZXJTZXJ2aWNlLCB7fSBhcyBQYXJ0aWFsPElPcGVuZXJTZXJ2aWNlPik7XG5cdFx0Y29tbWFuZFNlcnZpY2UgPSBuZXcgVGVzdENvbW1hbmRTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdHF1aWNrRml4QWRkb24gPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFF1aWNrRml4QWRkb24sIFtdLCBjYXBhYmlsaXRpZXMpO1xuXHRcdHRlcm1pbmFsLmxvYWRBZGRvbihxdWlja0ZpeEFkZG9uKTtcblx0fSk7XG5cblx0c3VpdGUoJ3JlZ2lzdGVyQ29tbWFuZEZpbmlzaGVkTGlzdGVuZXIgJiBnZXRNYXRjaEFjdGlvbnMnLCAoKSA9PiB7XG5cdFx0c3VpdGUoJ2dpdFNpbWlsYXJDb21tYW5kJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gYGdpdCBzdHRhdHVzYDtcblx0XHRcdGxldCBvdXRwdXQgPSBgZ2l0OiAnc3R0YXR1cycgaXMgbm90IGEgZ2l0IGNvbW1hbmQuIFNlZSAnZ2l0IC0taGVscCcuXG5cblx0XHRcdFRoZSBtb3N0IHNpbWlsYXIgY29tbWFuZCBpc1xuXHRcdFx0c3RhdHVzYDtcblx0XHRcdGNvbnN0IGV4aXRDb2RlID0gMTtcblx0XHRcdGNvbnN0IGFjdGlvbnMgPSBbe1xuXHRcdFx0XHRpZDogJ0dpdCBTaW1pbGFyJyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0bGFiZWw6ICdSdW46IGdpdCBzdGF0dXMnLFxuXHRcdFx0XHR0b29sdGlwOiAnUnVuOiBnaXQgc3RhdHVzJyxcblx0XHRcdFx0Y29tbWFuZDogJ2dpdCBzdGF0dXMnXG5cdFx0XHR9XTtcblx0XHRcdGNvbnN0IG91dHB1dExpbmVzID0gb3V0cHV0LnNwbGl0KCdcXG4nKTtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IGdpdFNpbWlsYXIoKTtcblx0XHRcdFx0ZXhwZWN0ZWRNYXAuc2V0KGNvbW1hbmQuY29tbWFuZExpbmVNYXRjaGVyLnRvU3RyaW5nKCksIFtjb21tYW5kXSk7XG5cdFx0XHRcdHF1aWNrRml4QWRkb24ucmVnaXN0ZXJDb21tYW5kRmluaXNoZWRMaXN0ZW5lcihjb21tYW5kKTtcblx0XHRcdH0pO1xuXHRcdFx0c3VpdGUoJ3JldHVybnMgdW5kZWZpbmVkIHdoZW4nLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ291dHB1dCBkb2VzIG5vdCBtYXRjaCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCAoZ2V0UXVpY2tGaXhlc0ZvckNvbW1hbmQoW10sIHRlcm1pbmFsLCBjcmVhdGVDb21tYW5kKGNvbW1hbmQsIGBpbnZhbGlkIG91dHB1dGAsIEdpdFNpbWlsYXJPdXRwdXRSZWdleCwgZXhpdENvZGUsIFtgaW52YWxpZCBvdXRwdXRgXSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXN0KCdjb21tYW5kIGRvZXMgbm90IG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IChnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoYGd0IHN0dGF0dXNgLCBvdXRwdXQsIEdpdFNpbWlsYXJPdXRwdXRSZWdleCwgZXhpdENvZGUsIG91dHB1dExpbmVzKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdHN1aXRlKCdyZXR1cm5zIGFjdGlvbnMgd2hlbicsICgpID0+IHtcblx0XHRcdFx0dGVzdCgnZXhwZWN0ZWQgdW5peCBleGl0IGNvZGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0TWF0Y2hPcHRpb25zKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgb3V0cHV0LCBHaXRTaW1pbGFyT3V0cHV0UmVnZXgsIGV4aXRDb2RlLCBvdXRwdXRMaW5lcyksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIGFjdGlvbnMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVzdCgnbWF0Y2hpbmcgZXhpdCBzdGF0dXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0TWF0Y2hPcHRpb25zKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgb3V0cHV0LCBHaXRTaW1pbGFyT3V0cHV0UmVnZXgsIDIsIG91dHB1dExpbmVzKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgYWN0aW9ucyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRzdWl0ZSgncmV0dXJucyBtYXRjaCcsICgpID0+IHtcblx0XHRcdFx0dGVzdCgncmV0dXJucyBtYXRjaCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnRNYXRjaE9wdGlvbnMoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBvdXRwdXQsIEdpdFNpbWlsYXJPdXRwdXRSZWdleCwgZXhpdENvZGUsIG91dHB1dExpbmVzKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgYWN0aW9ucyk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ3JldHVybnMgbXVsdGlwbGUgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0b3V0cHV0ID0gYGdpdDogJ3B1JyBpcyBub3QgYSBnaXQgY29tbWFuZC4gU2VlICdnaXQgLS1oZWxwJy5cblx0XHRcdFx0VGhlIG1vc3Qgc2ltaWxhciBjb21tYW5kcyBhcmVcblx0XHRcdFx0XHRcdHB1bGxcblx0XHRcdFx0XHRcdHB1c2hgO1xuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbnMgPSBbe1xuXHRcdFx0XHRcdFx0aWQ6ICdHaXQgU2ltaWxhcicsXG5cdFx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdSdW46IGdpdCBwdWxsJyxcblx0XHRcdFx0XHRcdHRvb2x0aXA6ICdSdW46IGdpdCBwdWxsJyxcblx0XHRcdFx0XHRcdGNvbW1hbmQ6ICdnaXQgcHVsbCdcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRpZDogJ0dpdCBTaW1pbGFyJyxcblx0XHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ1J1bjogZ2l0IHB1c2gnLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogJ1J1bjogZ2l0IHB1c2gnLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDogJ2dpdCBwdXNoJ1xuXHRcdFx0XHRcdH1dO1xuXHRcdFx0XHRcdGFzc2VydE1hdGNoT3B0aW9ucygoYXdhaXQgZ2V0UXVpY2tGaXhlc0ZvckNvbW1hbmQoW10sIHRlcm1pbmFsLCBjcmVhdGVDb21tYW5kKCdnaXQgcHUnLCBvdXRwdXQsIEdpdFNpbWlsYXJPdXRwdXRSZWdleCwgZXhpdENvZGUsIG91dHB1dC5zcGxpdCgnXFxuJykpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCBhY3Rpb25zKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ3Bhc3NlcyBhbnkgYXJndW1lbnRzIHRocm91Z2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0b3V0cHV0ID0gYGdpdDogJ2NoZWNrb3V0dCcgaXMgbm90IGEgZ2l0IGNvbW1hbmQuIFNlZSAnZ2l0IC0taGVscCcuXG5cdFx0XHRcdFRoZSBtb3N0IHNpbWlsYXIgY29tbWFuZHMgYXJlXG5cdFx0XHRcdFx0XHRjaGVja291dGA7XG5cdFx0XHRcdFx0YXNzZXJ0TWF0Y2hPcHRpb25zKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoJ2dpdCBjaGVja291dHQgLicsIG91dHB1dCwgR2l0U2ltaWxhck91dHB1dFJlZ2V4LCBleGl0Q29kZSwgb3V0cHV0LnNwbGl0KCdcXG4nKSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIFt7XG5cdFx0XHRcdFx0XHRpZDogJ0dpdCBTaW1pbGFyJyxcblx0XHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ1J1bjogZ2l0IGNoZWNrb3V0IC4nLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogJ1J1bjogZ2l0IGNoZWNrb3V0IC4nLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDogJ2dpdCBjaGVja291dCAuJ1xuXHRcdFx0XHRcdH1dKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnZ2l0VHdvRGFzaGVzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gYGdpdCBhZGQgLiAtYWxsYDtcblx0XHRcdGNvbnN0IG91dHB1dCA9ICdlcnJvcjogZGlkIHlvdSBtZWFuIGAtLWFsbGAgKHdpdGggdHdvIGRhc2hlcyk/Jztcblx0XHRcdGNvbnN0IGV4aXRDb2RlID0gMTtcblx0XHRcdGNvbnN0IGFjdGlvbnMgPSBbe1xuXHRcdFx0XHRpZDogJ0dpdCBUd28gRGFzaGVzJyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0bGFiZWw6ICdSdW46IGdpdCBhZGQgLiAtLWFsbCcsXG5cdFx0XHRcdHRvb2x0aXA6ICdSdW46IGdpdCBhZGQgLiAtLWFsbCcsXG5cdFx0XHRcdGNvbW1hbmQ6ICdnaXQgYWRkIC4gLS1hbGwnXG5cdFx0XHR9XTtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IGdpdFR3b0Rhc2hlcygpO1xuXHRcdFx0XHRleHBlY3RlZE1hcC5zZXQoY29tbWFuZC5jb21tYW5kTGluZU1hdGNoZXIudG9TdHJpbmcoKSwgW2NvbW1hbmRdKTtcblx0XHRcdFx0cXVpY2tGaXhBZGRvbi5yZWdpc3RlckNvbW1hbmRGaW5pc2hlZExpc3RlbmVyKGNvbW1hbmQpO1xuXHRcdFx0fSk7XG5cdFx0XHRzdWl0ZSgncmV0dXJucyB1bmRlZmluZWQgd2hlbicsICgpID0+IHtcblx0XHRcdFx0dGVzdCgnb3V0cHV0IGRvZXMgbm90IG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgYGludmFsaWQgb3V0cHV0YCwgR2l0VHdvRGFzaGVzUmVnZXgsIGV4aXRDb2RlKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ2NvbW1hbmQgZG9lcyBub3QgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChgZ3Qgc3R0YXR1c2AsIG91dHB1dCwgR2l0VHdvRGFzaGVzUmVnZXgsIGV4aXRDb2RlKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdHN1aXRlKCdyZXR1cm5zIGFjdGlvbnMgd2hlbicsICgpID0+IHtcblx0XHRcdFx0dGVzdCgnZXhwZWN0ZWQgdW5peCBleGl0IGNvZGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0TWF0Y2hPcHRpb25zKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgb3V0cHV0LCBHaXRUd29EYXNoZXNSZWdleCwgZXhpdENvZGUpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCBhY3Rpb25zKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ21hdGNoaW5nIGV4aXQgc3RhdHVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydE1hdGNoT3B0aW9ucygoYXdhaXQgZ2V0UXVpY2tGaXhlc0ZvckNvbW1hbmQoW10sIHRlcm1pbmFsLCBjcmVhdGVDb21tYW5kKGNvbW1hbmQsIG91dHB1dCwgR2l0VHdvRGFzaGVzUmVnZXgsIDIpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCBhY3Rpb25zKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnZ2l0RmFzdEZvcndhcmRQdWxsJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gYGdpdCBjaGVja291dCB2bmV4dGA7XG5cdFx0XHRjb25zdCBvdXRwdXQgPSAnQWxyZWFkeSBvbiBcXCd2bmV4dFxcJyBcXG4gWW91ciBicmFuY2ggaXMgYmVoaW5kIFxcJ29yaWdpbi92bmV4dFxcJyBieSAxIGNvbW1pdCwgYW5kIGNhbiBiZSBmYXN0LWZvcndhcmRlZC4nO1xuXHRcdFx0Y29uc3QgZXhpdENvZGUgPSAwO1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IFt7XG5cdFx0XHRcdGlkOiAnR2l0IEZhc3QgRm9yd2FyZCBQdWxsJyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0bGFiZWw6ICdSdW46IGdpdCBwdWxsJyxcblx0XHRcdFx0dG9vbHRpcDogJ1J1bjogZ2l0IHB1bGwnLFxuXHRcdFx0XHRjb21tYW5kOiAnZ2l0IHB1bGwnXG5cdFx0XHR9XTtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IGdpdEZhc3RGb3J3YXJkUHVsbCgpO1xuXHRcdFx0XHRleHBlY3RlZE1hcC5zZXQoY29tbWFuZC5jb21tYW5kTGluZU1hdGNoZXIudG9TdHJpbmcoKSwgW2NvbW1hbmRdKTtcblx0XHRcdFx0cXVpY2tGaXhBZGRvbi5yZWdpc3RlckNvbW1hbmRGaW5pc2hlZExpc3RlbmVyKGNvbW1hbmQpO1xuXHRcdFx0fSk7XG5cdFx0XHRzdWl0ZSgncmV0dXJucyB1bmRlZmluZWQgd2hlbicsICgpID0+IHtcblx0XHRcdFx0dGVzdCgnb3V0cHV0IGRvZXMgbm90IG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgYGludmFsaWQgb3V0cHV0YCwgR2l0RmFzdEZvcndhcmRQdWxsT3V0cHV0UmVnZXgsIGV4aXRDb2RlKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ2NvbW1hbmQgZG9lcyBub3QgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChgZ3QgYWRkYCwgb3V0cHV0LCBHaXRGYXN0Rm9yd2FyZFB1bGxPdXRwdXRSZWdleCwgZXhpdENvZGUpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVzdCgnZXhpdCBjb2RlIGRvZXMgbm90IG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgb3V0cHV0LCBHaXRGYXN0Rm9yd2FyZFB1bGxPdXRwdXRSZWdleCwgMiksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRzdWl0ZSgncmV0dXJucyBhY3Rpb25zIHdoZW4nLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ21hdGNoaW5nIGV4aXQgc3RhdHVzLCBjb21tYW5kLCBvdXB1dCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnRNYXRjaE9wdGlvbnMoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBvdXRwdXQsIEdpdEZhc3RGb3J3YXJkUHVsbE91dHB1dFJlZ2V4LCBleGl0Q29kZSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIGFjdGlvbnMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRzdWl0ZSgnZnJlZVBvcnQnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkTWFwID0gbmV3IE1hcCgpO1xuXHRcdFx0XHRjb25zdCBwb3J0Q29tbWFuZCA9IGB5YXJuIHN0YXJ0IGRldmA7XG5cdFx0XHRcdGNvbnN0IG91dHB1dCA9IGB5YXJuIHJ1biB2MS4yMi4xN1xuXHRcdFx0d2FybmluZyAuLi8uLi9wYWNrYWdlLmpzb246IE5vIGxpY2Vuc2UgZmllbGRcblx0XHRcdEVycm9yOiBsaXN0ZW4gRUFERFJJTlVTRTogYWRkcmVzcyBhbHJlYWR5IGluIHVzZSAwLjAuMC4wOjMwMDBcblx0XHRcdFx0YXQgU2VydmVyLnNldHVwTGlzdGVuSGFuZGxlIFthcyBfbGlzdGVuMl0gKG5vZGU6bmV0OjEzMTU6MTYpXG5cdFx0XHRcdGF0IGxpc3RlbkluQ2x1c3RlciAobm9kZTpuZXQ6MTM2MzoxMilcblx0XHRcdFx0YXQgZG9MaXN0ZW4gKG5vZGU6bmV0OjE1MDE6Nylcblx0XHRcdFx0YXQgcHJvY2Vzc1RpY2tzQW5kUmVqZWN0aW9ucyAobm9kZTppbnRlcm5hbC9wcm9jZXNzL3Rhc2tfcXVldWVzOjg0OjIxKVxuXHRcdFx0RW1pdHRlZCAnZXJyb3InIGV2ZW50IG9uIFdlYlNvY2tldFNlcnZlciBpbnN0YW5jZSBhdDpcblx0XHRcdFx0YXQgU2VydmVyLmVtaXQgKG5vZGU6ZXZlbnRzOjM5NDoyOClcblx0XHRcdFx0YXQgZW1pdEVycm9yTlQgKG5vZGU6bmV0OjEzNDI6OClcblx0XHRcdFx0YXQgcHJvY2Vzc1RpY2tzQW5kUmVqZWN0aW9ucyAobm9kZTppbnRlcm5hbC9wcm9jZXNzL3Rhc2tfcXVldWVzOjgzOjIxKSB7XG5cdFx0XHR9XG5cdFx0XHRlcnJvciBDb21tYW5kIGZhaWxlZCB3aXRoIGV4aXQgY29kZSAxLlxuXHRcdFx0aW5mbyBWaXNpdCBodHRwczovL3lhcm5wa2cuY29tL2VuL2RvY3MvY2xpL3J1biBmb3IgZG9jdW1lbnRhdGlvbiBhYm91dCB0aGlzIGNvbW1hbmQuYDtcblx0XHRcdFx0Y29uc3QgYWN0aW9uT3B0aW9ucyA9IFt7XG5cdFx0XHRcdFx0aWQ6ICdGcmVlIFBvcnQnLFxuXHRcdFx0XHRcdGxhYmVsOiAnRnJlZSBwb3J0IDMwMDAnLFxuXHRcdFx0XHRcdHJ1bjogdHJ1ZSxcblx0XHRcdFx0XHR0b29sdGlwOiAnRnJlZSBwb3J0IDMwMDAnLFxuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWVcblx0XHRcdFx0fV07XG5cdFx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBjb21tYW5kID0gZnJlZVBvcnQoKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCkpO1xuXHRcdFx0XHRcdGV4cGVjdGVkTWFwLnNldChjb21tYW5kLmNvbW1hbmRMaW5lTWF0Y2hlci50b1N0cmluZygpLCBbY29tbWFuZF0pO1xuXHRcdFx0XHRcdHF1aWNrRml4QWRkb24ucmVnaXN0ZXJDb21tYW5kRmluaXNoZWRMaXN0ZW5lcihjb21tYW5kKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHN1aXRlKCdyZXR1cm5zIHVuZGVmaW5lZCB3aGVuJywgKCkgPT4ge1xuXHRcdFx0XHRcdHRlc3QoJ291dHB1dCBkb2VzIG5vdCBtYXRjaCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQocG9ydENvbW1hbmQsIGBpbnZhbGlkIG91dHB1dGAsIEZyZWVQb3J0T3V0cHV0UmVnZXgpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVzdCgncmV0dXJucyBhY3Rpb25zJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydE1hdGNoT3B0aW9ucygoYXdhaXQgZ2V0UXVpY2tGaXhlc0ZvckNvbW1hbmQoW10sIHRlcm1pbmFsLCBjcmVhdGVDb21tYW5kKHBvcnRDb21tYW5kLCBvdXRwdXQsIEZyZWVQb3J0T3V0cHV0UmVnZXgpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCBhY3Rpb25PcHRpb25zKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRzdWl0ZSgnZ2l0UHVzaFNldFVwc3RyZWFtJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gYGdpdCBwdXNoYDtcblx0XHRcdGNvbnN0IG91dHB1dCA9IGBmYXRhbDogVGhlIGN1cnJlbnQgYnJhbmNoIHRlc3QyMiBoYXMgbm8gdXBzdHJlYW0gYnJhbmNoLlxuXHRcdFx0VG8gcHVzaCB0aGUgY3VycmVudCBicmFuY2ggYW5kIHNldCB0aGUgcmVtb3RlIGFzIHVwc3RyZWFtLCB1c2VcblxuXHRcdFx0XHRnaXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gdGVzdDIyYDtcblx0XHRcdGNvbnN0IGV4aXRDb2RlID0gMTI4O1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IFt7XG5cdFx0XHRcdGlkOiAnR2l0IFB1c2ggU2V0IFVwc3RyZWFtJyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0bGFiZWw6ICdSdW46IGdpdCBwdXNoIC0tc2V0LXVwc3RyZWFtIG9yaWdpbiB0ZXN0MjInLFxuXHRcdFx0XHR0b29sdGlwOiAnUnVuOiBnaXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gdGVzdDIyJyxcblx0XHRcdFx0Y29tbWFuZDogJ2dpdCBwdXNoIC0tc2V0LXVwc3RyZWFtIG9yaWdpbiB0ZXN0MjInXG5cdFx0XHR9XTtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IGdpdFB1c2hTZXRVcHN0cmVhbSgpO1xuXHRcdFx0XHRleHBlY3RlZE1hcC5zZXQoY29tbWFuZC5jb21tYW5kTGluZU1hdGNoZXIudG9TdHJpbmcoKSwgW2NvbW1hbmRdKTtcblx0XHRcdFx0cXVpY2tGaXhBZGRvbi5yZWdpc3RlckNvbW1hbmRGaW5pc2hlZExpc3RlbmVyKGNvbW1hbmQpO1xuXHRcdFx0fSk7XG5cdFx0XHRzdWl0ZSgncmV0dXJucyB1bmRlZmluZWQgd2hlbicsICgpID0+IHtcblx0XHRcdFx0dGVzdCgnb3V0cHV0IGRvZXMgbm90IG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgYGludmFsaWQgb3V0cHV0YCwgR2l0UHVzaE91dHB1dFJlZ2V4LCBleGl0Q29kZSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXN0KCdjb21tYW5kIGRvZXMgbm90IG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoYGdpdCBzdGF0dXNgLCBvdXRwdXQsIEdpdFB1c2hPdXRwdXRSZWdleCwgZXhpdENvZGUpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0c3VpdGUoJ3JldHVybnMgYWN0aW9ucyB3aGVuJywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCdleHBlY3RlZCB1bml4IGV4aXQgY29kZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnRNYXRjaE9wdGlvbnMoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBvdXRwdXQsIEdpdFB1c2hPdXRwdXRSZWdleCwgZXhpdENvZGUpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCBhY3Rpb25zKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ21hdGNoaW5nIGV4aXQgc3RhdHVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydE1hdGNoT3B0aW9ucygoYXdhaXQgZ2V0UXVpY2tGaXhlc0ZvckNvbW1hbmQoW10sIHRlcm1pbmFsLCBjcmVhdGVDb21tYW5kKGNvbW1hbmQsIG91dHB1dCwgR2l0UHVzaE91dHB1dFJlZ2V4LCAyKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgYWN0aW9ucyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c3VpdGUoJ2dpdENyZWF0ZVByJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gYGdpdCBwdXNoYDtcblx0XHRcdGNvbnN0IG91dHB1dCA9IGBUb3RhbCAwIChkZWx0YSAwKSwgcmV1c2VkIDAgKGRlbHRhIDApLCBwYWNrLXJldXNlZCAwXG5cdFx0XHRyZW1vdGU6XG5cdFx0XHRyZW1vdGU6IENyZWF0ZSBhIHB1bGwgcmVxdWVzdCBmb3IgJ3Rlc3QyMicgb24gR2l0SHViIGJ5IHZpc2l0aW5nOlxuXHRcdFx0cmVtb3RlOiAgICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9tZWdhbnJvZ2dlL3h0ZXJtLmpzL3B1bGwvbmV3L3Rlc3QyMlxuXHRcdFx0cmVtb3RlOlxuXHRcdFx0VG8gaHR0cHM6Ly9naXRodWIuY29tL21lZ2Fucm9nZ2UveHRlcm0uanNcblx0XHRcdCAqIFtuZXcgYnJhbmNoXSAgICAgICAgdGVzdDIyIC0+IHRlc3QyMlxuXHRcdFx0QnJhbmNoICd0ZXN0MjInIHNldCB1cCB0byB0cmFjayByZW1vdGUgYnJhbmNoICd0ZXN0MjInIGZyb20gJ29yaWdpbicuIGA7XG5cdFx0XHRjb25zdCBleGl0Q29kZSA9IDA7XG5cdFx0XHRjb25zdCBhY3Rpb25zID0gW3tcblx0XHRcdFx0aWQ6ICdHaXQgQ3JlYXRlIFByJyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0bGFiZWw6ICdPcGVuOiBodHRwczovL2dpdGh1Yi5jb20vbWVnYW5yb2dnZS94dGVybS5qcy9wdWxsL25ldy90ZXN0MjInLFxuXHRcdFx0XHR0b29sdGlwOiAnT3BlbjogaHR0cHM6Ly9naXRodWIuY29tL21lZ2Fucm9nZ2UveHRlcm0uanMvcHVsbC9uZXcvdGVzdDIyJyxcblx0XHRcdFx0dXJpOiBVUkkucGFyc2UoJ2h0dHBzOi8vZ2l0aHViLmNvbS9tZWdhbnJvZ2dlL3h0ZXJtLmpzL3B1bGwvbmV3L3Rlc3QyMicpXG5cdFx0XHR9XTtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IGdpdENyZWF0ZVByKCk7XG5cdFx0XHRcdGV4cGVjdGVkTWFwLnNldChjb21tYW5kLmNvbW1hbmRMaW5lTWF0Y2hlci50b1N0cmluZygpLCBbY29tbWFuZF0pO1xuXHRcdFx0XHRxdWlja0ZpeEFkZG9uLnJlZ2lzdGVyQ29tbWFuZEZpbmlzaGVkTGlzdGVuZXIoY29tbWFuZCk7XG5cdFx0XHR9KTtcblx0XHRcdHN1aXRlKCdyZXR1cm5zIHVuZGVmaW5lZCB3aGVuJywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCdvdXRwdXQgZG9lcyBub3QgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBgaW52YWxpZCBvdXRwdXRgLCBHaXRDcmVhdGVQck91dHB1dFJlZ2V4LCBleGl0Q29kZSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXN0KCdjb21tYW5kIGRvZXMgbm90IG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoYGdpdCBzdGF0dXNgLCBvdXRwdXQsIEdpdENyZWF0ZVByT3V0cHV0UmVnZXgsIGV4aXRDb2RlKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRlc3QoJ2ZhaWx1cmUgZXhpdCBzdGF0dXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBvdXRwdXQsIEdpdENyZWF0ZVByT3V0cHV0UmVnZXgsIDIpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0c3VpdGUoJ3JldHVybnMgYWN0aW9ucyB3aGVuJywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCdleHBlY3RlZCB1bml4IGV4aXQgY29kZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnRNYXRjaE9wdGlvbnMoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBvdXRwdXQsIEdpdENyZWF0ZVByT3V0cHV0UmVnZXgsIGV4aXRDb2RlKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgYWN0aW9ucyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnZ2l0UHVzaCAtIG11bHRpcGxlIHByb3ZpZGVycycsICgpID0+IHtcblx0XHRjb25zdCBleHBlY3RlZE1hcCA9IG5ldyBNYXAoKTtcblx0XHRjb25zdCBjb21tYW5kID0gYGdpdCBwdXNoYDtcblx0XHRjb25zdCBvdXRwdXQgPSBgZmF0YWw6IFRoZSBjdXJyZW50IGJyYW5jaCB0ZXN0MjIgaGFzIG5vIHVwc3RyZWFtIGJyYW5jaC5cblx0XHRUbyBwdXNoIHRoZSBjdXJyZW50IGJyYW5jaCBhbmQgc2V0IHRoZSByZW1vdGUgYXMgdXBzdHJlYW0sIHVzZVxuXG5cdFx0XHRnaXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gdGVzdDIyYDtcblx0XHRjb25zdCBleGl0Q29kZSA9IDEyODtcblx0XHRjb25zdCBhY3Rpb25zID0gW3tcblx0XHRcdGlkOiAnR2l0IFB1c2ggU2V0IFVwc3RyZWFtJyxcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRsYWJlbDogJ1J1bjogZ2l0IHB1c2ggLS1zZXQtdXBzdHJlYW0gb3JpZ2luIHRlc3QyMicsXG5cdFx0XHR0b29sdGlwOiAnUnVuOiBnaXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gdGVzdDIyJyxcblx0XHRcdGNvbW1hbmQ6ICdnaXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gdGVzdDIyJ1xuXHRcdH1dO1xuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdGNvbnN0IHB1c2hDb21tYW5kID0gZ2l0UHVzaFNldFVwc3RyZWFtKCk7XG5cdFx0XHRjb25zdCBwckNvbW1hbmQgPSBnaXRDcmVhdGVQcigpO1xuXHRcdFx0cXVpY2tGaXhBZGRvbi5yZWdpc3RlckNvbW1hbmRGaW5pc2hlZExpc3RlbmVyKHByQ29tbWFuZCk7XG5cdFx0XHRleHBlY3RlZE1hcC5zZXQocHVzaENvbW1hbmQuY29tbWFuZExpbmVNYXRjaGVyLnRvU3RyaW5nKCksIFtwdXNoQ29tbWFuZCwgcHJDb21tYW5kXSk7XG5cdFx0fSk7XG5cdFx0c3VpdGUoJ3JldHVybnMgdW5kZWZpbmVkIHdoZW4nLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdvdXRwdXQgZG9lcyBub3QgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgYGludmFsaWQgb3V0cHV0YCwgR2l0UHVzaE91dHB1dFJlZ2V4LCBleGl0Q29kZSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIHVuZGVmaW5lZCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2NvbW1hbmQgZG9lcyBub3QgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoYGdpdCBzdGF0dXNgLCBvdXRwdXQsIEdpdFB1c2hPdXRwdXRSZWdleCwgZXhpdENvZGUpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCB1bmRlZmluZWQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c3VpdGUoJ3JldHVybnMgYWN0aW9ucyB3aGVuJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnZXhwZWN0ZWQgdW5peCBleGl0IGNvZGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydE1hdGNoT3B0aW9ucygoYXdhaXQgZ2V0UXVpY2tGaXhlc0ZvckNvbW1hbmQoW10sIHRlcm1pbmFsLCBjcmVhdGVDb21tYW5kKGNvbW1hbmQsIG91dHB1dCwgR2l0UHVzaE91dHB1dFJlZ2V4LCBleGl0Q29kZSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIGFjdGlvbnMpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdtYXRjaGluZyBleGl0IHN0YXR1cycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0TWF0Y2hPcHRpb25zKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgb3V0cHV0LCBHaXRQdXNoT3V0cHV0UmVnZXgsIDIpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCBhY3Rpb25zKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0c3VpdGUoJ3B3c2ggZmVlZGJhY2sgcHJvdmlkZXJzJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdHZW5lcmFsJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gYG5vdCBpbXBvcnRhbnRgO1xuXHRcdFx0Y29uc3Qgb3V0cHV0ID0gW1xuXHRcdFx0XHRgLi4uYCxcblx0XHRcdFx0YGAsXG5cdFx0XHRcdGBTdWdnZXN0aW9uIFtHZW5lcmFsXTpgLFxuXHRcdFx0XHRgICBUaGUgbW9zdCBzaW1pbGFyIGNvbW1hbmRzIGFyZTogcHl0aG9uMywgcHl0aG9uM20sIHBhbW9uLCBweXRob24zLjYsIHJ0bW9uLCBlY2hvLCBwdXNoZCwgZXRzbiwgcHdzaCwgcHdjb252LmAsXG5cdFx0XHRcdGBgLFxuXHRcdFx0XHRgU3VnZ2VzdGlvbiBbY21kLW5vdC1mb3VuZF06YCxcblx0XHRcdFx0YCAgQ29tbWFuZCAncHl0aG9uJyBub3QgZm91bmQsIGJ1dCBjYW4gYmUgaW5zdGFsbGVkIHdpdGg6YCxcblx0XHRcdFx0YCAgc3VkbyBhcHQgaW5zdGFsbCBweXRob24zYCxcblx0XHRcdFx0YCAgc3VkbyBhcHQgaW5zdGFsbCBweXRob25gLFxuXHRcdFx0XHRgICBzdWRvIGFwdCBpbnN0YWxsIHB5dGhvbi1taW5pbWFsYCxcblx0XHRcdFx0YCAgWW91IGFsc28gaGF2ZSBweXRob24zIGluc3RhbGxlZCwgeW91IGNhbiBydW4gJ3B5dGhvbjMnIGluc3RlYWQuJ2AsXG5cdFx0XHRcdGBgLFxuXHRcdFx0XS5qb2luKCdcXG4nKTtcblx0XHRcdGNvbnN0IGV4aXRDb2RlID0gMTI4O1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IFtcblx0XHRcdFx0J3B5dGhvbjMnLFxuXHRcdFx0XHQncHl0aG9uM20nLFxuXHRcdFx0XHQncGFtb24nLFxuXHRcdFx0XHQncHl0aG9uMy42Jyxcblx0XHRcdFx0J3J0bW9uJyxcblx0XHRcdFx0J2VjaG8nLFxuXHRcdFx0XHQncHVzaGQnLFxuXHRcdFx0XHQnZXRzbicsXG5cdFx0XHRcdCdwd3NoJyxcblx0XHRcdFx0J3B3Y29udicsXG5cdFx0XHRdLm1hcChjb21tYW5kID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogJ1B3c2ggR2VuZXJhbCBFcnJvcicsXG5cdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0XHRsYWJlbDogYFJ1bjogJHtjb21tYW5kfWAsXG5cdFx0XHRcdFx0dG9vbHRpcDogYFJ1bjogJHtjb21tYW5kfWAsXG5cdFx0XHRcdFx0Y29tbWFuZDogY29tbWFuZFxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cdFx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHB1c2hDb21tYW5kID0gcHdzaEdlbmVyYWxFcnJvcigpO1xuXHRcdFx0XHRxdWlja0ZpeEFkZG9uLnJlZ2lzdGVyQ29tbWFuZEZpbmlzaGVkTGlzdGVuZXIocHVzaENvbW1hbmQpO1xuXHRcdFx0XHRleHBlY3RlZE1hcC5zZXQocHVzaENvbW1hbmQuY29tbWFuZExpbmVNYXRjaGVyLnRvU3RyaW5nKCksIFtwdXNoQ29tbWFuZF0pO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdyZXR1cm5zIHVuZGVmaW5lZCB3aGVuIG91dHB1dCBkb2VzIG5vdCBtYXRjaCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBgaW52YWxpZCBvdXRwdXRgLCBQd3NoR2VuZXJhbEVycm9yT3V0cHV0UmVnZXgsIGV4aXRDb2RlKSwgZXhwZWN0ZWRNYXAsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCBsYWJlbFNlcnZpY2UpKSwgdW5kZWZpbmVkKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgncmV0dXJucyBhY3Rpb25zIHdoZW4gb3V0cHV0IG1hdGNoZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydE1hdGNoT3B0aW9ucygoYXdhaXQgZ2V0UXVpY2tGaXhlc0ZvckNvbW1hbmQoW10sIHRlcm1pbmFsLCBjcmVhdGVDb21tYW5kKGNvbW1hbmQsIG91dHB1dCwgUHdzaEdlbmVyYWxFcnJvck91dHB1dFJlZ2V4LCBleGl0Q29kZSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIGFjdGlvbnMpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c3VpdGUoJ1VuaXggY21kLW5vdC1mb3VuZCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGV4cGVjdGVkTWFwID0gbmV3IE1hcCgpO1xuXHRcdFx0Y29uc3QgY29tbWFuZCA9IGBub3QgaW1wb3J0YW50YDtcblx0XHRcdGNvbnN0IG91dHB1dCA9IFtcblx0XHRcdFx0YC4uLmAsXG5cdFx0XHRcdGBgLFxuXHRcdFx0XHRgU3VnZ2VzdGlvbiBbR2VuZXJhbF1gLFxuXHRcdFx0XHRgICBUaGUgbW9zdCBzaW1pbGFyIGNvbW1hbmRzIGFyZTogcHl0aG9uMywgcHl0aG9uM20sIHBhbW9uLCBweXRob24zLjYsIHJ0bW9uLCBlY2hvLCBwdXNoZCwgZXRzbiwgcHdzaCwgcHdjb252LmAsXG5cdFx0XHRcdGBgLFxuXHRcdFx0XHRgU3VnZ2VzdGlvbiBbY21kLW5vdC1mb3VuZF06YCxcblx0XHRcdFx0YCAgQ29tbWFuZCAncHl0aG9uJyBub3QgZm91bmQsIGJ1dCBjYW4gYmUgaW5zdGFsbGVkIHdpdGg6YCxcblx0XHRcdFx0YCAgc3VkbyBhcHQgaW5zdGFsbCBweXRob24zYCxcblx0XHRcdFx0YCAgc3VkbyBhcHQgaW5zdGFsbCBweXRob25gLFxuXHRcdFx0XHRgICBzdWRvIGFwdCBpbnN0YWxsIHB5dGhvbi1taW5pbWFsYCxcblx0XHRcdFx0YCAgWW91IGFsc28gaGF2ZSBweXRob24zIGluc3RhbGxlZCwgeW91IGNhbiBydW4gJ3B5dGhvbjMnIGluc3RlYWQuJ2AsXG5cdFx0XHRcdGBgLFxuXHRcdFx0XS5qb2luKCdcXG4nKTtcblx0XHRcdGNvbnN0IGV4aXRDb2RlID0gMTI4O1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IFtcblx0XHRcdFx0J3N1ZG8gYXB0IGluc3RhbGwgcHl0aG9uMycsXG5cdFx0XHRcdCdzdWRvIGFwdCBpbnN0YWxsIHB5dGhvbicsXG5cdFx0XHRcdCdzdWRvIGFwdCBpbnN0YWxsIHB5dGhvbi1taW5pbWFsJyxcblx0XHRcdFx0J3B5dGhvbjMnLFxuXHRcdFx0XS5tYXAoY29tbWFuZCA9PiB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aWQ6ICdQd3NoIFVuaXggQ29tbWFuZCBOb3QgRm91bmQgRXJyb3InLFxuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0bGFiZWw6IGBSdW46ICR7Y29tbWFuZH1gLFxuXHRcdFx0XHRcdHRvb2x0aXA6IGBSdW46ICR7Y29tbWFuZH1gLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IGNvbW1hbmRcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXHRcdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBwdXNoQ29tbWFuZCA9IHB3c2hVbml4Q29tbWFuZE5vdEZvdW5kRXJyb3IoKTtcblx0XHRcdFx0cXVpY2tGaXhBZGRvbi5yZWdpc3RlckNvbW1hbmRGaW5pc2hlZExpc3RlbmVyKHB1c2hDb21tYW5kKTtcblx0XHRcdFx0ZXhwZWN0ZWRNYXAuc2V0KHB1c2hDb21tYW5kLmNvbW1hbmRMaW5lTWF0Y2hlci50b1N0cmluZygpLCBbcHVzaENvbW1hbmRdKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgncmV0dXJucyB1bmRlZmluZWQgd2hlbiBvdXRwdXQgZG9lcyBub3QgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKChhd2FpdCBnZXRRdWlja0ZpeGVzRm9yQ29tbWFuZChbXSwgdGVybWluYWwsIGNyZWF0ZUNvbW1hbmQoY29tbWFuZCwgYGludmFsaWQgb3V0cHV0YCwgUHdzaFVuaXhDb21tYW5kTm90Rm91bmRFcnJvck91dHB1dFJlZ2V4LCBleGl0Q29kZSksIGV4cGVjdGVkTWFwLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSwgbGFiZWxTZXJ2aWNlKSksIHVuZGVmaW5lZCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3JldHVybnMgYWN0aW9ucyB3aGVuIG91dHB1dCBtYXRjaGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnRNYXRjaE9wdGlvbnMoKGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFtdLCB0ZXJtaW5hbCwgY3JlYXRlQ29tbWFuZChjb21tYW5kLCBvdXRwdXQsIFB3c2hVbml4Q29tbWFuZE5vdEZvdW5kRXJyb3JPdXRwdXRSZWdleCwgZXhpdENvZGUpLCBleHBlY3RlZE1hcCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGxhYmVsU2VydmljZSkpLCBhY3Rpb25zKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBjcmVhdGVDb21tYW5kKGNvbW1hbmQ6IHN0cmluZywgb3V0cHV0OiBzdHJpbmcsIG91dHB1dE1hdGNoZXI/OiBSZWdFeHAgfCBzdHJpbmcsIGV4aXRDb2RlPzogbnVtYmVyLCBvdXRwdXRMaW5lcz86IHN0cmluZ1tdKTogSVRlcm1pbmFsQ29tbWFuZCB7XG5cdHJldHVybiB7XG5cdFx0Y3dkOiAnJyxcblx0XHRjb21tYW5kU3RhcnRMaW5lQ29udGVudDogJycsXG5cdFx0bWFya1Byb3BlcnRpZXM6IHt9LFxuXHRcdGV4ZWN1dGVkWDogdW5kZWZpbmVkLFxuXHRcdHN0YXJ0WDogdW5kZWZpbmVkLFxuXHRcdGNvbW1hbmQsXG5cdFx0aXNUcnVzdGVkOiB0cnVlLFxuXHRcdGV4aXRDb2RlLFxuXHRcdGdldE91dHB1dDogKCkgPT4geyByZXR1cm4gb3V0cHV0OyB9LFxuXHRcdGdldE91dHB1dE1hdGNoOiAoX21hdGNoZXI6IElUZXJtaW5hbE91dHB1dE1hdGNoZXIpID0+IHtcblx0XHRcdGlmIChvdXRwdXRNYXRjaGVyKSB7XG5cdFx0XHRcdGNvbnN0IHJlZ2V4TWF0Y2ggPSBvdXRwdXQubWF0Y2gob3V0cHV0TWF0Y2hlcikgPz8gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAocmVnZXhNYXRjaCkge1xuXHRcdFx0XHRcdHJldHVybiBvdXRwdXRMaW5lcyA/IHsgcmVnZXhNYXRjaCwgb3V0cHV0TGluZXMgfSA6IHsgcmVnZXhNYXRjaCwgb3V0cHV0TGluZXM6IFtdIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSxcblx0XHR0aW1lc3RhbXA6IERhdGUubm93KCksXG5cdFx0aGFzT3V0cHV0OiAoKSA9PiAhIW91dHB1dFxuXHR9IGFzIElUZXJtaW5hbENvbW1hbmQ7XG59XG5cbnR5cGUgVGVzdEFjdGlvbiA9IFBpY2s8SUFjdGlvbiwgJ2lkJyB8ICdsYWJlbCcgfCAndG9vbHRpcCcgfCAnZW5hYmxlZCc+ICYgeyBjb21tYW5kPzogc3RyaW5nOyB1cmk/OiBVUkkgfTtcbmZ1bmN0aW9uIGFzc2VydE1hdGNoT3B0aW9ucyhhY3R1YWw6IFRlc3RBY3Rpb25bXSB8IHVuZGVmaW5lZCwgZXhwZWN0ZWQ6IFRlc3RBY3Rpb25bXSk6IHZvaWQge1xuXHRzdHJpY3RFcXVhbChhY3R1YWw/Lmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBleHBlY3RlZC5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGV4cGVjdGVkSXRlbSA9IGV4cGVjdGVkW2ldO1xuXHRcdGNvbnN0IGFjdHVhbEl0ZW06IGFueSA9IGFjdHVhbFtpXTtcblx0XHRzdHJpY3RFcXVhbChhY3R1YWxJdGVtLmlkLCBleHBlY3RlZEl0ZW0uaWQsIGBJRGApO1xuXHRcdHN0cmljdEVxdWFsKGFjdHVhbEl0ZW0uZW5hYmxlZCwgZXhwZWN0ZWRJdGVtLmVuYWJsZWQsIGBlbmFibGVkYCk7XG5cdFx0c3RyaWN0RXF1YWwoYWN0dWFsSXRlbS5sYWJlbCwgZXhwZWN0ZWRJdGVtLmxhYmVsLCBgbGFiZWxgKTtcblx0XHRzdHJpY3RFcXVhbChhY3R1YWxJdGVtLnRvb2x0aXAsIGV4cGVjdGVkSXRlbS50b29sdGlwLCBgdG9vbHRpcGApO1xuXHRcdGlmIChleHBlY3RlZEl0ZW0uY29tbWFuZCkge1xuXHRcdFx0c3RyaWN0RXF1YWwoYWN0dWFsSXRlbS5jb21tYW5kLCBleHBlY3RlZEl0ZW0uY29tbWFuZCk7XG5cdFx0fVxuXHRcdGlmIChleHBlY3RlZEl0ZW0udXJpKSB7XG5cdFx0XHRzdHJpY3RFcXVhbChhY3R1YWxJdGVtLnVyaSEudG9TdHJpbmcoKSwgZXhwZWN0ZWRJdGVtLnVyaS50b1N0cmluZygpKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUEyQiwwQkFBMEI7QUFDckQsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUywrQkFBK0I7QUFFeEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx5QkFBeUIsNkJBQTZCO0FBQy9ELFNBQVMsVUFBVSxxQkFBcUIsYUFBYSx3QkFBd0Isb0JBQW9CLCtCQUErQixvQkFBb0Isb0JBQW9CLFlBQVksdUJBQXVCLGNBQWMsbUJBQW1CLGtCQUFrQiw2QkFBNkIsOEJBQThCLCtDQUErQztBQUN4VyxTQUFTLDBCQUEwQjtBQUVuQyxNQUFNLGlCQUFpQixNQUFNO0FBQzVCLFFBQU0sUUFBUSx3Q0FBd0M7QUFFdEQsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUVKLFFBQU0sWUFBWTtBQUNqQiwyQkFBdUIsTUFBTSxJQUFJLElBQUkseUJBQXlCLENBQUM7QUFDL0QsVUFBTSxn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
