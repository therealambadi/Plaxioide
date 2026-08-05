import { deepEqual, deepStrictEqual, strictEqual } from "assert";
import * as sinon from "sinon";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { NullLogService } from "../../../../../../platform/log/common/log.js";
import { TerminalCapability } from "../../../../../../platform/terminal/common/capabilities/capabilities.js";
import { deserializeMessage, parseKeyValueAssignment, parseMarkSequence, ShellIntegrationAddon } from "../../../../../../platform/terminal/common/xterm/shellIntegrationAddon.js";
import { writeP } from "../../../browser/terminalTestHelpers.js";
class TestShellIntegrationAddon extends ShellIntegrationAddon {
  getCommandDetectionMock(terminal) {
    const capability = super._createOrGetCommandDetection(terminal);
    this.capabilities.add(TerminalCapability.CommandDetection, capability);
    return sinon.mock(capability);
  }
  getCwdDectionMock() {
    const capability = super._createOrGetCwdDetection();
    this.capabilities.add(TerminalCapability.CwdDetection, capability);
    return sinon.mock(capability);
  }
}
suite("ShellIntegrationAddon", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let xterm;
  let shellIntegrationAddon;
  let capabilities;
  setup(async () => {
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    xterm = store.add(new TerminalCtor({ allowProposedApi: true, cols: 80, rows: 30 }));
    shellIntegrationAddon = store.add(new TestShellIntegrationAddon("", true, void 0, new NullLogService()));
    xterm.loadAddon(shellIntegrationAddon);
    capabilities = shellIntegrationAddon.capabilities;
  });
  suite("cwd detection", () => {
    test("should activate capability on the cwd sequence (OSC 633 ; P ; Cwd=<cwd> ST)", async () => {
      strictEqual(capabilities.has(TerminalCapability.CwdDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.CwdDetection), false);
      await writeP(xterm, "\x1B]633;P;Cwd=/foo\x07");
      strictEqual(capabilities.has(TerminalCapability.CwdDetection), true);
    });
    test("should pass cwd sequence to the capability", async () => {
      const mock = shellIntegrationAddon.getCwdDectionMock();
      mock.expects("updateCwd").once().withExactArgs("/foo");
      await writeP(xterm, "\x1B]633;P;Cwd=/foo\x07");
      mock.verify();
    });
    test("detect ITerm sequence: `OSC 1337 ; CurrentDir=<Cwd> ST`", async () => {
      const cases = [
        ["root", "/", "/"],
        ["non-root", "/some/path", "/some/path"]
      ];
      for (const x of cases) {
        const [title, input, expected] = x;
        const mock = shellIntegrationAddon.getCwdDectionMock();
        mock.expects("updateCwd").once().withExactArgs(expected).named(title);
        await writeP(xterm, `\x1B]1337;CurrentDir=${input}\x07`);
        mock.verify();
      }
    });
    suite("detect `SetCwd` sequence: `OSC 7; scheme://cwd ST`", () => {
      test("should accept well-formatted URLs", async () => {
        const cases = [
          // Different hostname values:
          ["empty hostname, pointing root", "file:///", "/"],
          ["empty hostname", "file:///test-root/local", "/test-root/local"],
          ["non-empty hostname", "file://some-hostname/test-root/local", "/test-root/local"],
          // URL-encoded chars:
          ["URL-encoded value (1)", "file:///test-root/%6c%6f%63%61%6c", "/test-root/local"],
          ["URL-encoded value (2)", "file:///test-root/local%22", '/test-root/local"'],
          ["URL-encoded value (3)", 'file:///test-root/local"', '/test-root/local"']
        ];
        for (const x of cases) {
          const [title, input, expected] = x;
          const mock = shellIntegrationAddon.getCwdDectionMock();
          mock.expects("updateCwd").once().withExactArgs(expected).named(title);
          await writeP(xterm, `\x1B]7;${input}\x07`);
          mock.verify();
        }
      });
      test("should ignore ill-formatted URLs", async () => {
        const cases = [
          // Different hostname values:
          ["no hostname, pointing root", "file://"],
          // Non-`file` scheme values:
          ["no scheme (1)", "/test-root"],
          ["no scheme (2)", "//test-root"],
          ["no scheme (3)", "///test-root"],
          ["no scheme (4)", ":///test-root"],
          ["http", "http:///test-root"],
          ["ftp", "ftp:///test-root"],
          ["ssh", "ssh:///test-root"]
        ];
        for (const x of cases) {
          const [title, input] = x;
          const mock = shellIntegrationAddon.getCwdDectionMock();
          mock.expects("updateCwd").never().named(title);
          await writeP(xterm, `\x1B]7;${input}\x07`);
          mock.verify();
        }
      });
    });
    test("detect `SetWindowsFrindlyCwd` sequence: `OSC 9 ; 9 ; <cwd> ST`", async () => {
      const cases = [
        ["root", "/", "/"],
        ["non-root", "/some/path", "/some/path"]
      ];
      for (const x of cases) {
        const [title, input, expected] = x;
        const mock = shellIntegrationAddon.getCwdDectionMock();
        mock.expects("updateCwd").once().withExactArgs(expected).named(title);
        await writeP(xterm, `\x1B]9;9;${input}\x07`);
        mock.verify();
      }
    });
  });
  suite("command tracking", () => {
    test("should activate capability on the prompt start sequence (OSC 633 ; A ST)", async () => {
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "\x1B]633;A\x07");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), true);
    });
    test("should pass prompt start sequence to the capability", async () => {
      const mock = shellIntegrationAddon.getCommandDetectionMock(xterm);
      mock.expects("handlePromptStart").once().withExactArgs();
      await writeP(xterm, "\x1B]633;A\x07");
      mock.verify();
    });
    test("should activate capability on the command start sequence (OSC 633 ; B ST)", async () => {
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "\x1B]633;B\x07");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), true);
    });
    test("should pass command start sequence to the capability", async () => {
      const mock = shellIntegrationAddon.getCommandDetectionMock(xterm);
      mock.expects("handleCommandStart").once().withExactArgs();
      await writeP(xterm, "\x1B]633;B\x07");
      mock.verify();
    });
    test("should activate capability on the command executed sequence (OSC 633 ; C ST)", async () => {
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "\x1B]633;C\x07");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), true);
    });
    test("should pass command executed sequence to the capability", async () => {
      const mock = shellIntegrationAddon.getCommandDetectionMock(xterm);
      mock.expects("handleCommandExecuted").once().withExactArgs();
      await writeP(xterm, "\x1B]633;C\x07");
      mock.verify();
    });
    test("should activate capability on the command finished sequence (OSC 633 ; D ; <ExitCode> ST)", async () => {
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "\x1B]633;D;7\x07");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), true);
    });
    test("should pass command finished sequence to the capability", async () => {
      const mock = shellIntegrationAddon.getCommandDetectionMock(xterm);
      mock.expects("handleCommandFinished").once().withExactArgs(7);
      await writeP(xterm, "\x1B]633;D;7\x07");
      mock.verify();
    });
    test("should pass command line sequence to the capability", async () => {
      const mock = shellIntegrationAddon.getCommandDetectionMock(xterm);
      mock.expects("setCommandLine").once().withExactArgs("", false);
      await writeP(xterm, "\x1B]633;E\x07");
      mock.verify();
      const mock2 = shellIntegrationAddon.getCommandDetectionMock(xterm);
      mock2.expects("setCommandLine").twice().withExactArgs("cmd", false);
      await writeP(xterm, "\x1B]633;E;cmd\x07");
      await writeP(xterm, "\x1B]633;E;cmd;invalid-nonce\x07");
      mock2.verify();
    });
    test("should not activate capability on the cwd sequence (OSC 633 ; P=Cwd=<cwd> ST)", async () => {
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
      await writeP(xterm, "\x1B]633;P;Cwd=/foo\x07");
      strictEqual(capabilities.has(TerminalCapability.CommandDetection), false);
    });
    test("should pass cwd sequence to the capability if it's initialized", async () => {
      const mock = shellIntegrationAddon.getCommandDetectionMock(xterm);
      mock.expects("setCwd").once().withExactArgs("/foo");
      await writeP(xterm, "\x1B]633;P;Cwd=/foo\x07");
      mock.verify();
    });
  });
  suite("BufferMarkCapability", () => {
    test("SetMark", async () => {
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "\x1B]633;SetMark;\x07");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), true);
    });
    test("SetMark - ID", async () => {
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "\x1B]633;SetMark;1;\x07");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), true);
    });
    test("SetMark - hidden", async () => {
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "\x1B]633;SetMark;;Hidden\x07");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), true);
    });
    test("SetMark - hidden & ID", async () => {
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "foo");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), false);
      await writeP(xterm, "\x1B]633;SetMark;1;Hidden\x07");
      strictEqual(capabilities.has(TerminalCapability.BufferMarkDetection), true);
    });
    suite("parseMarkSequence", () => {
      test("basic", async () => {
        deepEqual(parseMarkSequence(["", ""]), { id: void 0, hidden: false });
      });
      test("ID", async () => {
        deepEqual(parseMarkSequence(["Id=3", ""]), { id: "3", hidden: false });
      });
      test("hidden", async () => {
        deepEqual(parseMarkSequence(["", "Hidden"]), { id: void 0, hidden: true });
      });
      test("ID + hidden", async () => {
        deepEqual(parseMarkSequence(["Id=4555", "Hidden"]), { id: "4555", hidden: true });
      });
    });
  });
  suite("deserializeMessage", () => {
    const Backslash = "\\";
    const Newline = "\n";
    const Semicolon = ";";
    const cases = [
      ["empty", "", ""],
      ["basic", "value", "value"],
      ["space", "some thing", "some thing"],
      ["escaped backslash", `${Backslash}${Backslash}`, Backslash],
      ["non-initial escaped backslash", `foo${Backslash}${Backslash}`, `foo${Backslash}`],
      ["two escaped backslashes", `${Backslash}${Backslash}${Backslash}${Backslash}`, `${Backslash}${Backslash}`],
      ["escaped backslash amidst text", `Hello${Backslash}${Backslash}there`, `Hello${Backslash}there`],
      ["backslash escaped literally and as hex", `${Backslash}${Backslash} is same as ${Backslash}x5c`, `${Backslash} is same as ${Backslash}`],
      ["escaped semicolon", `${Backslash}x3b`, Semicolon],
      ["non-initial escaped semicolon", `foo${Backslash}x3b`, `foo${Semicolon}`],
      ["escaped semicolon (upper hex)", `${Backslash}x3B`, Semicolon],
      ['escaped backslash followed by literal "x3b" is not a semicolon', `${Backslash}${Backslash}x3b`, `${Backslash}x3b`],
      ['non-initial escaped backslash followed by literal "x3b" is not a semicolon', `foo${Backslash}${Backslash}x3b`, `foo${Backslash}x3b`],
      ["escaped backslash followed by escaped semicolon", `${Backslash}${Backslash}${Backslash}x3b`, `${Backslash}${Semicolon}`],
      ["escaped semicolon amidst text", `some${Backslash}x3bthing`, `some${Semicolon}thing`],
      ["escaped newline", `${Backslash}x0a`, Newline],
      ["non-initial escaped newline", `foo${Backslash}x0a`, `foo${Newline}`],
      ["escaped newline (upper hex)", `${Backslash}x0A`, Newline],
      ['escaped backslash followed by literal "x0a" is not a newline', `${Backslash}${Backslash}x0a`, `${Backslash}x0a`],
      ['non-initial escaped backslash followed by literal "x0a" is not a newline', `foo${Backslash}${Backslash}x0a`, `foo${Backslash}x0a`],
      ["PS1 simple", "[\\u@\\h \\W]\\$", "[\\u@\\h \\W]\\$"],
      ["PS1 VSC SI", `${Backslash}x1b]633;A${Backslash}x07\\[${Backslash}x1b]0;\\u@\\h:\\w\\a\\]${Backslash}x1b]633;B${Backslash}x07`, "\x1B]633;A\x07\\[\x1B]0;\\u@\\h:\\w\\a\\]\x1B]633;B\x07"]
    ];
    cases.forEach(([title, input, expected]) => {
      test(title, () => strictEqual(deserializeMessage(input), expected));
    });
  });
  test("parseKeyValueAssignment", () => {
    const cases = [
      ["empty", "", ["", void 0]],
      ['no "=" sign', "some-text", ["some-text", void 0]],
      ["empty value", "key=", ["key", ""]],
      ["empty key", "=value", ["", "value"]],
      ["normal", "key=value", ["key", "value"]],
      ['multiple "=" signs (1)', "key==value", ["key", "=value"]],
      ['multiple "=" signs (2)', "key=value===true", ["key", "value===true"]],
      ['just a "="', "=", ["", ""]],
      ['just a "=="', "==", ["", "="]]
    ];
    cases.forEach((x) => {
      const [title, input, [key, value]] = x;
      deepStrictEqual(parseKeyValueAssignment(input), { key, value }, title);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIveHRlcm0vc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSB7IFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcbmltcG9ydCB7IGRlZXBFcXVhbCwgZGVlcFN0cmljdEVxdWFsLCBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBpbXBvcnRBTUROb2RlTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYW1kWC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLCBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBkZXNlcmlhbGl6ZU1lc3NhZ2UsIHBhcnNlS2V5VmFsdWVBc3NpZ25tZW50LCBwYXJzZU1hcmtTZXF1ZW5jZSwgU2hlbGxJbnRlZ3JhdGlvbkFkZG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3h0ZXJtL3NoZWxsSW50ZWdyYXRpb25BZGRvbi5qcyc7XG5pbXBvcnQgeyB3cml0ZVAgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3Rlcm1pbmFsVGVzdEhlbHBlcnMuanMnO1xuXG5jbGFzcyBUZXN0U2hlbGxJbnRlZ3JhdGlvbkFkZG9uIGV4dGVuZHMgU2hlbGxJbnRlZ3JhdGlvbkFkZG9uIHtcblx0Z2V0Q29tbWFuZERldGVjdGlvbk1vY2sodGVybWluYWw6IFRlcm1pbmFsKTogc2lub24uU2lub25Nb2NrIHtcblx0XHRjb25zdCBjYXBhYmlsaXR5ID0gc3VwZXIuX2NyZWF0ZU9yR2V0Q29tbWFuZERldGVjdGlvbih0ZXJtaW5hbCk7XG5cdFx0dGhpcy5jYXBhYmlsaXRpZXMuYWRkKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uLCBjYXBhYmlsaXR5KTtcblx0XHRyZXR1cm4gc2lub24ubW9jayhjYXBhYmlsaXR5KTtcblx0fVxuXHRnZXRDd2REZWN0aW9uTW9jaygpOiBzaW5vbi5TaW5vbk1vY2sge1xuXHRcdGNvbnN0IGNhcGFiaWxpdHkgPSBzdXBlci5fY3JlYXRlT3JHZXRDd2REZXRlY3Rpb24oKTtcblx0XHR0aGlzLmNhcGFiaWxpdGllcy5hZGQoVGVybWluYWxDYXBhYmlsaXR5LkN3ZERldGVjdGlvbiwgY2FwYWJpbGl0eSk7XG5cdFx0cmV0dXJuIHNpbm9uLm1vY2soY2FwYWJpbGl0eSk7XG5cdH1cbn1cblxuc3VpdGUoJ1NoZWxsSW50ZWdyYXRpb25BZGRvbicsICgpID0+IHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgeHRlcm06IFRlcm1pbmFsO1xuXHRsZXQgc2hlbGxJbnRlZ3JhdGlvbkFkZG9uOiBUZXN0U2hlbGxJbnRlZ3JhdGlvbkFkZG9uO1xuXHRsZXQgY2FwYWJpbGl0aWVzOiBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmU7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFRlcm1pbmFsQ3RvciA9IChhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0B4dGVybS94dGVybScpPignQHh0ZXJtL3h0ZXJtJywgJ2xpYi94dGVybS5qcycpKS5UZXJtaW5hbDtcblx0XHR4dGVybSA9IHN0b3JlLmFkZChuZXcgVGVybWluYWxDdG9yKHsgYWxsb3dQcm9wb3NlZEFwaTogdHJ1ZSwgY29sczogODAsIHJvd3M6IDMwIH0pKTtcblx0XHRzaGVsbEludGVncmF0aW9uQWRkb24gPSBzdG9yZS5hZGQobmV3IFRlc3RTaGVsbEludGVncmF0aW9uQWRkb24oJycsIHRydWUsIHVuZGVmaW5lZCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHR4dGVybS5sb2FkQWRkb24oc2hlbGxJbnRlZ3JhdGlvbkFkZG9uKTtcblx0XHRjYXBhYmlsaXRpZXMgPSBzaGVsbEludGVncmF0aW9uQWRkb24uY2FwYWJpbGl0aWVzO1xuXHR9KTtcblxuXHRzdWl0ZSgnY3dkIGRldGVjdGlvbicsICgpID0+IHtcblx0XHR0ZXN0KCdzaG91bGQgYWN0aXZhdGUgY2FwYWJpbGl0eSBvbiB0aGUgY3dkIHNlcXVlbmNlIChPU0MgNjMzIDsgUCA7IEN3ZD08Y3dkPiBTVCknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Dd2REZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdmb28nKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkN3ZERldGVjdGlvbiksIGZhbHNlKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xceDFiXTYzMztQO0N3ZD0vZm9vXFx4MDcnKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkN3ZERldGVjdGlvbiksIHRydWUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHBhc3MgY3dkIHNlcXVlbmNlIHRvIHRoZSBjYXBhYmlsaXR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9jayA9IHNoZWxsSW50ZWdyYXRpb25BZGRvbi5nZXRDd2REZWN0aW9uTW9jaygpO1xuXHRcdFx0bW9jay5leHBlY3RzKCd1cGRhdGVDd2QnKS5vbmNlKCkud2l0aEV4YWN0QXJncygnL2ZvbycpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnXFx4MWJdNjMzO1A7Q3dkPS9mb29cXHgwNycpO1xuXHRcdFx0bW9jay52ZXJpZnkoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RldGVjdCBJVGVybSBzZXF1ZW5jZTogYE9TQyAxMzM3IDsgQ3VycmVudERpcj08Q3dkPiBTVGAnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHR0eXBlIFRlc3RDYXNlID0gW3RpdGxlOiBzdHJpbmcsIGlucHV0OiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmddO1xuXHRcdFx0Y29uc3QgY2FzZXM6IFRlc3RDYXNlW10gPSBbXG5cdFx0XHRcdFsncm9vdCcsICcvJywgJy8nXSxcblx0XHRcdFx0Wydub24tcm9vdCcsICcvc29tZS9wYXRoJywgJy9zb21lL3BhdGgnXSxcblx0XHRcdF07XG5cdFx0XHRmb3IgKGNvbnN0IHggb2YgY2FzZXMpIHtcblx0XHRcdFx0Y29uc3QgW3RpdGxlLCBpbnB1dCwgZXhwZWN0ZWRdID0geDtcblx0XHRcdFx0Y29uc3QgbW9jayA9IHNoZWxsSW50ZWdyYXRpb25BZGRvbi5nZXRDd2REZWN0aW9uTW9jaygpO1xuXHRcdFx0XHRtb2NrLmV4cGVjdHMoJ3VwZGF0ZUN3ZCcpLm9uY2UoKS53aXRoRXhhY3RBcmdzKGV4cGVjdGVkKS5uYW1lZCh0aXRsZSk7XG5cdFx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgYFxceDFiXTEzMzc7Q3VycmVudERpcj0ke2lucHV0fVxceDA3YCk7XG5cdFx0XHRcdG1vY2sudmVyaWZ5KCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnZGV0ZWN0IGBTZXRDd2RgIHNlcXVlbmNlOiBgT1NDIDc7IHNjaGVtZTovL2N3ZCBTVGAnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdzaG91bGQgYWNjZXB0IHdlbGwtZm9ybWF0dGVkIFVSTHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHR5cGUgVGVzdENhc2UgPSBbdGl0bGU6IHN0cmluZywgaW5wdXQ6IHN0cmluZywgZXhwZWN0ZWQ6IHN0cmluZ107XG5cdFx0XHRcdGNvbnN0IGNhc2VzOiBUZXN0Q2FzZVtdID0gW1xuXHRcdFx0XHRcdC8vIERpZmZlcmVudCBob3N0bmFtZSB2YWx1ZXM6XG5cdFx0XHRcdFx0WydlbXB0eSBob3N0bmFtZSwgcG9pbnRpbmcgcm9vdCcsICdmaWxlOi8vLycsICcvJ10sXG5cdFx0XHRcdFx0WydlbXB0eSBob3N0bmFtZScsICdmaWxlOi8vL3Rlc3Qtcm9vdC9sb2NhbCcsICcvdGVzdC1yb290L2xvY2FsJ10sXG5cdFx0XHRcdFx0Wydub24tZW1wdHkgaG9zdG5hbWUnLCAnZmlsZTovL3NvbWUtaG9zdG5hbWUvdGVzdC1yb290L2xvY2FsJywgJy90ZXN0LXJvb3QvbG9jYWwnXSxcblx0XHRcdFx0XHQvLyBVUkwtZW5jb2RlZCBjaGFyczpcblx0XHRcdFx0XHRbJ1VSTC1lbmNvZGVkIHZhbHVlICgxKScsICdmaWxlOi8vL3Rlc3Qtcm9vdC8lNmMlNmYlNjMlNjElNmMnLCAnL3Rlc3Qtcm9vdC9sb2NhbCddLFxuXHRcdFx0XHRcdFsnVVJMLWVuY29kZWQgdmFsdWUgKDIpJywgJ2ZpbGU6Ly8vdGVzdC1yb290L2xvY2FsJTIyJywgJy90ZXN0LXJvb3QvbG9jYWxcIiddLFxuXHRcdFx0XHRcdFsnVVJMLWVuY29kZWQgdmFsdWUgKDMpJywgJ2ZpbGU6Ly8vdGVzdC1yb290L2xvY2FsXCInLCAnL3Rlc3Qtcm9vdC9sb2NhbFwiJ10sXG5cdFx0XHRcdF07XG5cdFx0XHRcdGZvciAoY29uc3QgeCBvZiBjYXNlcykge1xuXHRcdFx0XHRcdGNvbnN0IFt0aXRsZSwgaW5wdXQsIGV4cGVjdGVkXSA9IHg7XG5cdFx0XHRcdFx0Y29uc3QgbW9jayA9IHNoZWxsSW50ZWdyYXRpb25BZGRvbi5nZXRDd2REZWN0aW9uTW9jaygpO1xuXHRcdFx0XHRcdG1vY2suZXhwZWN0cygndXBkYXRlQ3dkJykub25jZSgpLndpdGhFeGFjdEFyZ3MoZXhwZWN0ZWQpLm5hbWVkKHRpdGxlKTtcblx0XHRcdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sIGBcXHgxYl03OyR7aW5wdXR9XFx4MDdgKTtcblx0XHRcdFx0XHRtb2NrLnZlcmlmeSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnc2hvdWxkIGlnbm9yZSBpbGwtZm9ybWF0dGVkIFVSTHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHR5cGUgVGVzdENhc2UgPSBbdGl0bGU6IHN0cmluZywgaW5wdXQ6IHN0cmluZ107XG5cdFx0XHRcdGNvbnN0IGNhc2VzOiBUZXN0Q2FzZVtdID0gW1xuXHRcdFx0XHRcdC8vIERpZmZlcmVudCBob3N0bmFtZSB2YWx1ZXM6XG5cdFx0XHRcdFx0WydubyBob3N0bmFtZSwgcG9pbnRpbmcgcm9vdCcsICdmaWxlOi8vJ10sXG5cdFx0XHRcdFx0Ly8gTm9uLWBmaWxlYCBzY2hlbWUgdmFsdWVzOlxuXHRcdFx0XHRcdFsnbm8gc2NoZW1lICgxKScsICcvdGVzdC1yb290J10sXG5cdFx0XHRcdFx0WydubyBzY2hlbWUgKDIpJywgJy8vdGVzdC1yb290J10sXG5cdFx0XHRcdFx0WydubyBzY2hlbWUgKDMpJywgJy8vL3Rlc3Qtcm9vdCddLFxuXHRcdFx0XHRcdFsnbm8gc2NoZW1lICg0KScsICc6Ly8vdGVzdC1yb290J10sXG5cdFx0XHRcdFx0WydodHRwJywgJ2h0dHA6Ly8vdGVzdC1yb290J10sXG5cdFx0XHRcdFx0WydmdHAnLCAnZnRwOi8vL3Rlc3Qtcm9vdCddLFxuXHRcdFx0XHRcdFsnc3NoJywgJ3NzaDovLy90ZXN0LXJvb3QnXSxcblx0XHRcdFx0XTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IHggb2YgY2FzZXMpIHtcblx0XHRcdFx0XHRjb25zdCBbdGl0bGUsIGlucHV0XSA9IHg7XG5cdFx0XHRcdFx0Y29uc3QgbW9jayA9IHNoZWxsSW50ZWdyYXRpb25BZGRvbi5nZXRDd2REZWN0aW9uTW9jaygpO1xuXHRcdFx0XHRcdG1vY2suZXhwZWN0cygndXBkYXRlQ3dkJykubmV2ZXIoKS5uYW1lZCh0aXRsZSk7XG5cdFx0XHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCBgXFx4MWJdNzske2lucHV0fVxceDA3YCk7XG5cdFx0XHRcdFx0bW9jay52ZXJpZnkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkZXRlY3QgYFNldFdpbmRvd3NGcmluZGx5Q3dkYCBzZXF1ZW5jZTogYE9TQyA5IDsgOSA7IDxjd2Q+IFNUYCcsIGFzeW5jICgpID0+IHtcblx0XHRcdHR5cGUgVGVzdENhc2UgPSBbdGl0bGU6IHN0cmluZywgaW5wdXQ6IHN0cmluZywgZXhwZWN0ZWQ6IHN0cmluZ107XG5cdFx0XHRjb25zdCBjYXNlczogVGVzdENhc2VbXSA9IFtcblx0XHRcdFx0Wydyb290JywgJy8nLCAnLyddLFxuXHRcdFx0XHRbJ25vbi1yb290JywgJy9zb21lL3BhdGgnLCAnL3NvbWUvcGF0aCddLFxuXHRcdFx0XTtcblx0XHRcdGZvciAoY29uc3QgeCBvZiBjYXNlcykge1xuXHRcdFx0XHRjb25zdCBbdGl0bGUsIGlucHV0LCBleHBlY3RlZF0gPSB4O1xuXHRcdFx0XHRjb25zdCBtb2NrID0gc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmdldEN3ZERlY3Rpb25Nb2NrKCk7XG5cdFx0XHRcdG1vY2suZXhwZWN0cygndXBkYXRlQ3dkJykub25jZSgpLndpdGhFeGFjdEFyZ3MoZXhwZWN0ZWQpLm5hbWVkKHRpdGxlKTtcblx0XHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCBgXFx4MWJdOTs5OyR7aW5wdXR9XFx4MDdgKTtcblx0XHRcdFx0bW9jay52ZXJpZnkoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2NvbW1hbmQgdHJhY2tpbmcnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGFjdGl2YXRlIGNhcGFiaWxpdHkgb24gdGhlIHByb21wdCBzdGFydCBzZXF1ZW5jZSAoT1NDIDYzMyA7IEEgU1QpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0c3RyaWN0RXF1YWwoY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiksIGZhbHNlKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ2ZvbycpO1xuXHRcdFx0c3RyaWN0RXF1YWwoY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiksIGZhbHNlKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xceDFiXTYzMztBXFx4MDcnKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pLCB0cnVlKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcGFzcyBwcm9tcHQgc3RhcnQgc2VxdWVuY2UgdG8gdGhlIGNhcGFiaWxpdHknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtb2NrID0gc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmdldENvbW1hbmREZXRlY3Rpb25Nb2NrKHh0ZXJtKTtcblx0XHRcdG1vY2suZXhwZWN0cygnaGFuZGxlUHJvbXB0U3RhcnQnKS5vbmNlKCkud2l0aEV4YWN0QXJncygpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnXFx4MWJdNjMzO0FcXHgwNycpO1xuXHRcdFx0bW9jay52ZXJpZnkoKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgYWN0aXZhdGUgY2FwYWJpbGl0eSBvbiB0aGUgY29tbWFuZCBzdGFydCBzZXF1ZW5jZSAoT1NDIDYzMyA7IEIgU1QpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0c3RyaWN0RXF1YWwoY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiksIGZhbHNlKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ2ZvbycpO1xuXHRcdFx0c3RyaWN0RXF1YWwoY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiksIGZhbHNlKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xceDFiXTYzMztCXFx4MDcnKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pLCB0cnVlKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcGFzcyBjb21tYW5kIHN0YXJ0IHNlcXVlbmNlIHRvIHRoZSBjYXBhYmlsaXR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9jayA9IHNoZWxsSW50ZWdyYXRpb25BZGRvbi5nZXRDb21tYW5kRGV0ZWN0aW9uTW9jayh4dGVybSk7XG5cdFx0XHRtb2NrLmV4cGVjdHMoJ2hhbmRsZUNvbW1hbmRTdGFydCcpLm9uY2UoKS53aXRoRXhhY3RBcmdzKCk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXHgxYl02MzM7QlxceDA3Jyk7XG5cdFx0XHRtb2NrLnZlcmlmeSgpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBhY3RpdmF0ZSBjYXBhYmlsaXR5IG9uIHRoZSBjb21tYW5kIGV4ZWN1dGVkIHNlcXVlbmNlIChPU0MgNjMzIDsgQyBTVCknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnZm9vJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnXFx4MWJdNjMzO0NcXHgwNycpO1xuXHRcdFx0c3RyaWN0RXF1YWwoY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiksIHRydWUpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBwYXNzIGNvbW1hbmQgZXhlY3V0ZWQgc2VxdWVuY2UgdG8gdGhlIGNhcGFiaWxpdHknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtb2NrID0gc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmdldENvbW1hbmREZXRlY3Rpb25Nb2NrKHh0ZXJtKTtcblx0XHRcdG1vY2suZXhwZWN0cygnaGFuZGxlQ29tbWFuZEV4ZWN1dGVkJykub25jZSgpLndpdGhFeGFjdEFyZ3MoKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xceDFiXTYzMztDXFx4MDcnKTtcblx0XHRcdG1vY2sudmVyaWZ5KCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGFjdGl2YXRlIGNhcGFiaWxpdHkgb24gdGhlIGNvbW1hbmQgZmluaXNoZWQgc2VxdWVuY2UgKE9TQyA2MzMgOyBEIDsgPEV4aXRDb2RlPiBTVCknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnZm9vJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnXFx4MWJdNjMzO0Q7N1xceDA3Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHBhc3MgY29tbWFuZCBmaW5pc2hlZCBzZXF1ZW5jZSB0byB0aGUgY2FwYWJpbGl0eScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IG1vY2sgPSBzaGVsbEludGVncmF0aW9uQWRkb24uZ2V0Q29tbWFuZERldGVjdGlvbk1vY2soeHRlcm0pO1xuXHRcdFx0bW9jay5leHBlY3RzKCdoYW5kbGVDb21tYW5kRmluaXNoZWQnKS5vbmNlKCkud2l0aEV4YWN0QXJncyg3KTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xceDFiXTYzMztEOzdcXHgwNycpO1xuXHRcdFx0bW9jay52ZXJpZnkoKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcGFzcyBjb21tYW5kIGxpbmUgc2VxdWVuY2UgdG8gdGhlIGNhcGFiaWxpdHknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtb2NrID0gc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmdldENvbW1hbmREZXRlY3Rpb25Nb2NrKHh0ZXJtKTtcblx0XHRcdG1vY2suZXhwZWN0cygnc2V0Q29tbWFuZExpbmUnKS5vbmNlKCkud2l0aEV4YWN0QXJncygnJywgZmFsc2UpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnXFx4MWJdNjMzO0VcXHgwNycpO1xuXHRcdFx0bW9jay52ZXJpZnkoKTtcblxuXHRcdFx0Y29uc3QgbW9jazIgPSBzaGVsbEludGVncmF0aW9uQWRkb24uZ2V0Q29tbWFuZERldGVjdGlvbk1vY2soeHRlcm0pO1xuXHRcdFx0bW9jazIuZXhwZWN0cygnc2V0Q29tbWFuZExpbmUnKS50d2ljZSgpLndpdGhFeGFjdEFyZ3MoJ2NtZCcsIGZhbHNlKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xceDFiXTYzMztFO2NtZFxceDA3Jyk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXHgxYl02MzM7RTtjbWQ7aW52YWxpZC1ub25jZVxceDA3Jyk7XG5cdFx0XHRtb2NrMi52ZXJpZnkoKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgbm90IGFjdGl2YXRlIGNhcGFiaWxpdHkgb24gdGhlIGN3ZCBzZXF1ZW5jZSAoT1NDIDYzMyA7IFA9Q3dkPTxjd2Q+IFNUKScsIGFzeW5jICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdmb28nKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXHgxYl02MzM7UDtDd2Q9L2Zvb1xceDA3Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSwgZmFsc2UpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBwYXNzIGN3ZCBzZXF1ZW5jZSB0byB0aGUgY2FwYWJpbGl0eSBpZiBpdFxcJ3MgaW5pdGlhbGl6ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtb2NrID0gc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmdldENvbW1hbmREZXRlY3Rpb25Nb2NrKHh0ZXJtKTtcblx0XHRcdG1vY2suZXhwZWN0cygnc2V0Q3dkJykub25jZSgpLndpdGhFeGFjdEFyZ3MoJy9mb28nKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xceDFiXTYzMztQO0N3ZD0vZm9vXFx4MDcnKTtcblx0XHRcdG1vY2sudmVyaWZ5KCk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnQnVmZmVyTWFya0NhcGFiaWxpdHknLCAoKSA9PiB7XG5cdFx0dGVzdCgnU2V0TWFyaycsIGFzeW5jICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdmb28nKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXHgxYl02MzM7U2V0TWFyaztcXHgwNycpO1xuXHRcdFx0c3RyaWN0RXF1YWwoY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQnVmZmVyTWFya0RldGVjdGlvbiksIHRydWUpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ1NldE1hcmsgLSBJRCcsIGFzeW5jICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdmb28nKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXHgxYl02MzM7U2V0TWFyazsxO1xceDA3Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5CdWZmZXJNYXJrRGV0ZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnU2V0TWFyayAtIGhpZGRlbicsIGFzeW5jICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdmb28nKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXHgxYl02MzM7U2V0TWFyazs7SGlkZGVuXFx4MDcnKTtcblx0XHRcdHN0cmljdEVxdWFsKGNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pLCB0cnVlKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdTZXRNYXJrIC0gaGlkZGVuICYgSUQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5CdWZmZXJNYXJrRGV0ZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnZm9vJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5CdWZmZXJNYXJrRGV0ZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnXFx4MWJdNjMzO1NldE1hcms7MTtIaWRkZW5cXHgwNycpO1xuXHRcdFx0c3RyaWN0RXF1YWwoY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQnVmZmVyTWFya0RldGVjdGlvbiksIHRydWUpO1xuXHRcdH0pO1xuXHRcdHN1aXRlKCdwYXJzZU1hcmtTZXF1ZW5jZScsICgpID0+IHtcblx0XHRcdHRlc3QoJ2Jhc2ljJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRkZWVwRXF1YWwocGFyc2VNYXJrU2VxdWVuY2UoWycnLCAnJ10pLCB7IGlkOiB1bmRlZmluZWQsIGhpZGRlbjogZmFsc2UgfSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ0lEJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRkZWVwRXF1YWwocGFyc2VNYXJrU2VxdWVuY2UoWydJZD0zJywgJyddKSwgeyBpZDogXCIzXCIsIGhpZGRlbjogZmFsc2UgfSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2hpZGRlbicsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0ZGVlcEVxdWFsKHBhcnNlTWFya1NlcXVlbmNlKFsnJywgJ0hpZGRlbiddKSwgeyBpZDogdW5kZWZpbmVkLCBoaWRkZW46IHRydWUgfSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ0lEICsgaGlkZGVuJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRkZWVwRXF1YWwocGFyc2VNYXJrU2VxdWVuY2UoWydJZD00NTU1JywgJ0hpZGRlbiddKSwgeyBpZDogXCI0NTU1XCIsIGhpZGRlbjogdHJ1ZSB9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZGVzZXJpYWxpemVNZXNzYWdlJywgKCkgPT4ge1xuXHRcdC8vIEEgc2luZ2xlIGxpdGVyYWwgYmFja3NsYXNoLCBpbiBvcmRlciB0byBhdm9pZCBjb25mdXNpb24gYWJvdXQgd2hldGhlciB3ZSBhcmUgZXNjYXBpbmcgdGVzdCBkYXRhIG9yIHRlc3RpbmcgZXNjYXBlcy5cblx0XHRjb25zdCBCYWNrc2xhc2ggPSAnXFxcXCcgYXMgY29uc3Q7XG5cdFx0Y29uc3QgTmV3bGluZSA9ICdcXG4nIGFzIGNvbnN0O1xuXHRcdGNvbnN0IFNlbWljb2xvbiA9ICc7JyBhcyBjb25zdDtcblxuXHRcdHR5cGUgVGVzdENhc2UgPSBbdGl0bGU6IHN0cmluZywgaW5wdXQ6IHN0cmluZywgZXhwZWN0ZWQ6IHN0cmluZ107XG5cdFx0Y29uc3QgY2FzZXM6IFRlc3RDYXNlW10gPSBbXG5cdFx0XHRbJ2VtcHR5JywgJycsICcnXSxcblx0XHRcdFsnYmFzaWMnLCAndmFsdWUnLCAndmFsdWUnXSxcblx0XHRcdFsnc3BhY2UnLCAnc29tZSB0aGluZycsICdzb21lIHRoaW5nJ10sXG5cdFx0XHRbJ2VzY2FwZWQgYmFja3NsYXNoJywgYCR7QmFja3NsYXNofSR7QmFja3NsYXNofWAsIEJhY2tzbGFzaF0sXG5cdFx0XHRbJ25vbi1pbml0aWFsIGVzY2FwZWQgYmFja3NsYXNoJywgYGZvbyR7QmFja3NsYXNofSR7QmFja3NsYXNofWAsIGBmb28ke0JhY2tzbGFzaH1gXSxcblx0XHRcdFsndHdvIGVzY2FwZWQgYmFja3NsYXNoZXMnLCBgJHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9YCwgYCR7QmFja3NsYXNofSR7QmFja3NsYXNofWBdLFxuXHRcdFx0Wydlc2NhcGVkIGJhY2tzbGFzaCBhbWlkc3QgdGV4dCcsIGBIZWxsbyR7QmFja3NsYXNofSR7QmFja3NsYXNofXRoZXJlYCwgYEhlbGxvJHtCYWNrc2xhc2h9dGhlcmVgXSxcblx0XHRcdFsnYmFja3NsYXNoIGVzY2FwZWQgbGl0ZXJhbGx5IGFuZCBhcyBoZXgnLCBgJHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9IGlzIHNhbWUgYXMgJHtCYWNrc2xhc2h9eDVjYCwgYCR7QmFja3NsYXNofSBpcyBzYW1lIGFzICR7QmFja3NsYXNofWBdLFxuXHRcdFx0Wydlc2NhcGVkIHNlbWljb2xvbicsIGAke0JhY2tzbGFzaH14M2JgLCBTZW1pY29sb25dLFxuXHRcdFx0Wydub24taW5pdGlhbCBlc2NhcGVkIHNlbWljb2xvbicsIGBmb28ke0JhY2tzbGFzaH14M2JgLCBgZm9vJHtTZW1pY29sb259YF0sXG5cdFx0XHRbJ2VzY2FwZWQgc2VtaWNvbG9uICh1cHBlciBoZXgpJywgYCR7QmFja3NsYXNofXgzQmAsIFNlbWljb2xvbl0sXG5cdFx0XHRbJ2VzY2FwZWQgYmFja3NsYXNoIGZvbGxvd2VkIGJ5IGxpdGVyYWwgXCJ4M2JcIiBpcyBub3QgYSBzZW1pY29sb24nLCBgJHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9eDNiYCwgYCR7QmFja3NsYXNofXgzYmBdLFxuXHRcdFx0Wydub24taW5pdGlhbCBlc2NhcGVkIGJhY2tzbGFzaCBmb2xsb3dlZCBieSBsaXRlcmFsIFwieDNiXCIgaXMgbm90IGEgc2VtaWNvbG9uJywgYGZvbyR7QmFja3NsYXNofSR7QmFja3NsYXNofXgzYmAsIGBmb28ke0JhY2tzbGFzaH14M2JgXSxcblx0XHRcdFsnZXNjYXBlZCBiYWNrc2xhc2ggZm9sbG93ZWQgYnkgZXNjYXBlZCBzZW1pY29sb24nLCBgJHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9eDNiYCwgYCR7QmFja3NsYXNofSR7U2VtaWNvbG9ufWBdLFxuXHRcdFx0Wydlc2NhcGVkIHNlbWljb2xvbiBhbWlkc3QgdGV4dCcsIGBzb21lJHtCYWNrc2xhc2h9eDNidGhpbmdgLCBgc29tZSR7U2VtaWNvbG9ufXRoaW5nYF0sXG5cdFx0XHRbJ2VzY2FwZWQgbmV3bGluZScsIGAke0JhY2tzbGFzaH14MGFgLCBOZXdsaW5lXSxcblx0XHRcdFsnbm9uLWluaXRpYWwgZXNjYXBlZCBuZXdsaW5lJywgYGZvbyR7QmFja3NsYXNofXgwYWAsIGBmb28ke05ld2xpbmV9YF0sXG5cdFx0XHRbJ2VzY2FwZWQgbmV3bGluZSAodXBwZXIgaGV4KScsIGAke0JhY2tzbGFzaH14MEFgLCBOZXdsaW5lXSxcblx0XHRcdFsnZXNjYXBlZCBiYWNrc2xhc2ggZm9sbG93ZWQgYnkgbGl0ZXJhbCBcIngwYVwiIGlzIG5vdCBhIG5ld2xpbmUnLCBgJHtCYWNrc2xhc2h9JHtCYWNrc2xhc2h9eDBhYCwgYCR7QmFja3NsYXNofXgwYWBdLFxuXHRcdFx0Wydub24taW5pdGlhbCBlc2NhcGVkIGJhY2tzbGFzaCBmb2xsb3dlZCBieSBsaXRlcmFsIFwieDBhXCIgaXMgbm90IGEgbmV3bGluZScsIGBmb28ke0JhY2tzbGFzaH0ke0JhY2tzbGFzaH14MGFgLCBgZm9vJHtCYWNrc2xhc2h9eDBhYF0sXG5cdFx0XHRbJ1BTMSBzaW1wbGUnLCAnW1xcXFx1QFxcXFxoIFxcXFxXXVxcXFwkJywgJ1tcXFxcdUBcXFxcaCBcXFxcV11cXFxcJCddLFxuXHRcdFx0WydQUzEgVlNDIFNJJywgYCR7QmFja3NsYXNofXgxYl02MzM7QSR7QmFja3NsYXNofXgwN1xcXFxbJHtCYWNrc2xhc2h9eDFiXTA7XFxcXHVAXFxcXGg6XFxcXHdcXFxcYVxcXFxdJHtCYWNrc2xhc2h9eDFiXTYzMztCJHtCYWNrc2xhc2h9eDA3YCwgJ1xceDFiXTYzMztBXFx4MDdcXFxcW1xceDFiXTA7XFxcXHVAXFxcXGg6XFxcXHdcXFxcYVxcXFxdXFx4MWJdNjMzO0JcXHgwNyddXG5cdFx0XTtcblxuXHRcdGNhc2VzLmZvckVhY2goKFt0aXRsZSwgaW5wdXQsIGV4cGVjdGVkXSkgPT4ge1xuXHRcdFx0dGVzdCh0aXRsZSwgKCkgPT4gc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVNZXNzYWdlKGlucHV0KSwgZXhwZWN0ZWQpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncGFyc2VLZXlWYWx1ZUFzc2lnbm1lbnQnLCAoKSA9PiB7XG5cdFx0dHlwZSBUZXN0Q2FzZSA9IFt0aXRsZTogc3RyaW5nLCBpbnB1dDogc3RyaW5nLCBleHBlY3RlZDogW2tleTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkXV07XG5cdFx0Y29uc3QgY2FzZXM6IFRlc3RDYXNlW10gPSBbXG5cdFx0XHRbJ2VtcHR5JywgJycsIFsnJywgdW5kZWZpbmVkXV0sXG5cdFx0XHRbJ25vIFwiPVwiIHNpZ24nLCAnc29tZS10ZXh0JywgWydzb21lLXRleHQnLCB1bmRlZmluZWRdXSxcblx0XHRcdFsnZW1wdHkgdmFsdWUnLCAna2V5PScsIFsna2V5JywgJyddXSxcblx0XHRcdFsnZW1wdHkga2V5JywgJz12YWx1ZScsIFsnJywgJ3ZhbHVlJ11dLFxuXHRcdFx0Wydub3JtYWwnLCAna2V5PXZhbHVlJywgWydrZXknLCAndmFsdWUnXV0sXG5cdFx0XHRbJ211bHRpcGxlIFwiPVwiIHNpZ25zICgxKScsICdrZXk9PXZhbHVlJywgWydrZXknLCAnPXZhbHVlJ11dLFxuXHRcdFx0WydtdWx0aXBsZSBcIj1cIiBzaWducyAoMiknLCAna2V5PXZhbHVlPT09dHJ1ZScsIFsna2V5JywgJ3ZhbHVlPT09dHJ1ZSddXSxcblx0XHRcdFsnanVzdCBhIFwiPVwiJywgJz0nLCBbJycsICcnXV0sXG5cdFx0XHRbJ2p1c3QgYSBcIj09XCInLCAnPT0nLCBbJycsICc9J11dLFxuXHRcdF07XG5cblx0XHRjYXNlcy5mb3JFYWNoKHggPT4ge1xuXHRcdFx0Y29uc3QgW3RpdGxlLCBpbnB1dCwgW2tleSwgdmFsdWVdXSA9IHg7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwocGFyc2VLZXlWYWx1ZUFzc2lnbm1lbnQoaW5wdXQpLCB7IGtleSwgdmFsdWUgfSwgdGl0bGUpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxXQUFXLGlCQUFpQixtQkFBbUI7QUFDeEQsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsc0JBQXNCO0FBQy9CLFNBQW1DLDBCQUEwQjtBQUM3RCxTQUFTLG9CQUFvQix5QkFBeUIsbUJBQW1CLDZCQUE2QjtBQUN0RyxTQUFTLGNBQWM7QUFFdkIsTUFBTSxrQ0FBa0Msc0JBQXNCO0FBQUEsRUFDN0Qsd0JBQXdCLFVBQXFDO0FBQzVELFVBQU0sYUFBYSxNQUFNLDZCQUE2QixRQUFRO0FBQzlELFNBQUssYUFBYSxJQUFJLG1CQUFtQixrQkFBa0IsVUFBVTtBQUNyRSxXQUFPLE1BQU0s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
