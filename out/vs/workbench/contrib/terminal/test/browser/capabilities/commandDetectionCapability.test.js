import { deepStrictEqual, ok } from "assert";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { CommandDetectionCapability } from "../../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js";
import { writeP } from "../../../browser/terminalTestHelpers.js";
import { workbenchInstantiationService } from "../../../../../test/browser/workbenchTestServices.js";
class TestCommandDetectionCapability extends CommandDetectionCapability {
  clearCommands() {
    this._commands.length = 0;
  }
}
suite("CommandDetectionCapability", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let xterm;
  let capability;
  let addEvents;
  function assertCommands(expectedCommands) {
    deepStrictEqual(capability.commands.map((e) => e.command), expectedCommands.map((e) => e.command));
    deepStrictEqual(capability.commands.map((e) => e.cwd), expectedCommands.map((e) => e.cwd));
    deepStrictEqual(capability.commands.map((e) => e.exitCode), expectedCommands.map((e) => e.exitCode));
    deepStrictEqual(capability.commands.map((e) => e.marker?.line), expectedCommands.map((e) => e.marker?.line));
    for (const command of capability.commands) {
      ok(Math.abs(Date.now() - command.timestamp) < 2e3);
    }
    deepStrictEqual(addEvents, capability.commands);
    addEvents.length = 0;
    capability.clearCommands();
  }
  async function printStandardCommand(prompt, command, output, cwd, exitCode) {
    if (cwd !== void 0) {
      capability.setCwd(cwd);
    }
    capability.handlePromptStart();
    await writeP(xterm, `\r${prompt}`);
    capability.handleCommandStart();
    await writeP(xterm, command);
    capability.handleCommandExecuted();
    await writeP(xterm, `\r
${output}\r
`);
    capability.handleCommandFinished(exitCode);
  }
  async function printCommandStart(prompt) {
    capability.handlePromptStart();
    await writeP(xterm, `\r${prompt}`);
    capability.handleCommandStart();
  }
  setup(async () => {
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    xterm = store.add(new TerminalCtor({ allowProposedApi: true, cols: 80 }));
    const instantiationService = workbenchInstantiationService(void 0, store);
    capability = store.add(instantiationService.createInstance(TestCommandDetectionCapability, xterm));
    addEvents = [];
    store.add(capability.onCommandFinished((e) => addEvents.push(e)));
    assertCommands([]);
  });
  test("should not add commands when no capability methods are triggered", async () => {
    await writeP(xterm, "foo\r\nbar\r\n");
    assertCommands([]);
    await writeP(xterm, "baz\r\n");
    assertCommands([]);
  });
  test("should add commands for expected capability method calls", async () => {
    await printStandardCommand("$ ", "echo foo", "foo", void 0, 0);
    await printCommandStart("$ ");
    assertCommands([{
      command: "echo foo",
      exitCode: 0,
      cwd: void 0,
      marker: { line: 0 }
    }]);
  });
  test("should trim the command when command executed appears on the following line", async () => {
    await printStandardCommand("$ ", "echo foo\r\n", "foo", void 0, 0);
    await printCommandStart("$ ");
    assertCommands([{
      command: "echo foo",
      exitCode: 0,
      cwd: void 0,
      marker: { line: 0 }
    }]);
  });
  suite("cwd", () => {
    test("should add cwd to commands when it's set", async () => {
      await printStandardCommand("$ ", "echo foo", "foo", "/home", 0);
      await printStandardCommand("$ ", "echo bar", "bar", "/home/second", 0);
      await printCommandStart("$ ");
      assertCommands([
        { command: "echo foo", exitCode: 0, cwd: "/home", marker: { line: 0 } },
        { command: "echo bar", exitCode: 0, cwd: "/home/second", marker: { line: 2 } }
      ]);
    });
    test("should add old cwd to commands if no cwd sequence is output", async () => {
      await printStandardCommand("$ ", "echo foo", "foo", "/home", 0);
      await printStandardCommand("$ ", "echo bar", "bar", void 0, 0);
      await printCommandStart("$ ");
      assertCommands([
        { command: "echo foo", exitCode: 0, cwd: "/home", marker: { line: 0 } },
        { command: "echo bar", exitCode: 0, cwd: "/home", marker: { line: 2 } }
      ]);
    });
    test("should use an undefined cwd if it's not set initially", async () => {
      await printStandardCommand("$ ", "echo foo", "foo", void 0, 0);
      await printStandardCommand("$ ", "echo bar", "bar", "/home", 0);
      await printCommandStart("$ ");
      assertCommands([
        { command: "echo foo", exitCode: 0, cwd: void 0, marker: { line: 0 } },
        { command: "echo bar", exitCode: 0, cwd: "/home", marker: { line: 2 } }
      ]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSB7IFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCwgb2sgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaW1wb3J0QU1ETm9kZU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2FtZFguanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LmpzJztcbmltcG9ydCB7IHdyaXRlUCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvdGVybWluYWxUZXN0SGVscGVycy5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuXG50eXBlIFRlc3RUZXJtaW5hbENvbW1hbmRNYXRjaCA9IFBpY2s8SVRlcm1pbmFsQ29tbWFuZCwgJ2NvbW1hbmQnIHwgJ2N3ZCcgfCAnZXhpdENvZGUnPiAmIHsgbWFya2VyOiB7IGxpbmU6IG51bWJlciB9IH07XG5cbmNsYXNzIFRlc3RDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSBleHRlbmRzIENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IHtcblx0Y2xlYXJDb21tYW5kcygpIHtcblx0XHR0aGlzLl9jb21tYW5kcy5sZW5ndGggPSAwO1xuXHR9XG59XG5cbnN1aXRlKCdDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eScsICgpID0+IHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgeHRlcm06IFRlcm1pbmFsO1xuXHRsZXQgY2FwYWJpbGl0eTogVGVzdENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5O1xuXHRsZXQgYWRkRXZlbnRzOiBJVGVybWluYWxDb21tYW5kW107XG5cblx0ZnVuY3Rpb24gYXNzZXJ0Q29tbWFuZHMoZXhwZWN0ZWRDb21tYW5kczogVGVzdFRlcm1pbmFsQ29tbWFuZE1hdGNoW10pIHtcblx0XHRkZWVwU3RyaWN0RXF1YWwoY2FwYWJpbGl0eS5jb21tYW5kcy5tYXAoZSA9PiBlLmNvbW1hbmQpLCBleHBlY3RlZENvbW1hbmRzLm1hcChlID0+IGUuY29tbWFuZCkpO1xuXHRcdGRlZXBTdHJpY3RFcXVhbChjYXBhYmlsaXR5LmNvbW1hbmRzLm1hcChlID0+IGUuY3dkKSwgZXhwZWN0ZWRDb21tYW5kcy5tYXAoZSA9PiBlLmN3ZCkpO1xuXHRcdGRlZXBTdHJpY3RFcXVhbChjYXBhYmlsaXR5LmNvbW1hbmRzLm1hcChlID0+IGUuZXhpdENvZGUpLCBleHBlY3RlZENvbW1hbmRzLm1hcChlID0+IGUuZXhpdENvZGUpKTtcblx0XHRkZWVwU3RyaWN0RXF1YWwoY2FwYWJpbGl0eS5jb21tYW5kcy5tYXAoZSA9PiBlLm1hcmtlcj8ubGluZSksIGV4cGVjdGVkQ29tbWFuZHMubWFwKGUgPT4gZS5tYXJrZXI/LmxpbmUpKTtcblx0XHQvLyBFbnN1cmUgdGltZXN0YW1wcyBhcmUgc2V0IGFuZCB3ZXJlIGNhcHR1cmVkIHJlY2VudGx5XG5cdFx0Zm9yIChjb25zdCBjb21tYW5kIG9mIGNhcGFiaWxpdHkuY29tbWFuZHMpIHtcblx0XHRcdG9rKE1hdGguYWJzKERhdGUubm93KCkgLSBjb21tYW5kLnRpbWVzdGFtcCkgPCAyMDAwKTtcblx0XHR9XG5cdFx0ZGVlcFN0cmljdEVxdWFsKGFkZEV2ZW50cywgY2FwYWJpbGl0eS5jb21tYW5kcyk7XG5cdFx0Ly8gQ2xlYXIgdGhlIGNvbW1hbmRzIHRvIGF2b2lkIHJlLWFzc2VydGluZyBwYXN0IGNvbW1hbmRzXG5cdFx0YWRkRXZlbnRzLmxlbmd0aCA9IDA7XG5cdFx0Y2FwYWJpbGl0eS5jbGVhckNvbW1hbmRzKCk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBwcmludFN0YW5kYXJkQ29tbWFuZChwcm9tcHQ6IHN0cmluZywgY29tbWFuZDogc3RyaW5nLCBvdXRwdXQ6IHN0cmluZywgY3dkOiBzdHJpbmcgfCB1bmRlZmluZWQsIGV4aXRDb2RlOiBudW1iZXIpIHtcblx0XHRpZiAoY3dkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNhcGFiaWxpdHkuc2V0Q3dkKGN3ZCk7XG5cdFx0fVxuXHRcdGNhcGFiaWxpdHkuaGFuZGxlUHJvbXB0U3RhcnQoKTtcblx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sIGBcXHIke3Byb21wdH1gKTtcblx0XHRjYXBhYmlsaXR5LmhhbmRsZUNvbW1hbmRTdGFydCgpO1xuXHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgY29tbWFuZCk7XG5cdFx0Y2FwYWJpbGl0eS5oYW5kbGVDb21tYW5kRXhlY3V0ZWQoKTtcblx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sIGBcXHJcXG4ke291dHB1dH1cXHJcXG5gKTtcblx0XHRjYXBhYmlsaXR5LmhhbmRsZUNvbW1hbmRGaW5pc2hlZChleGl0Q29kZSk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBwcmludENvbW1hbmRTdGFydChwcm9tcHQ6IHN0cmluZykge1xuXHRcdGNhcGFiaWxpdHkuaGFuZGxlUHJvbXB0U3RhcnQoKTtcblx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sIGBcXHIke3Byb21wdH1gKTtcblx0XHRjYXBhYmlsaXR5LmhhbmRsZUNvbW1hbmRTdGFydCgpO1xuXHR9XG5cblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgVGVybWluYWxDdG9yID0gKGF3YWl0IGltcG9ydEFNRE5vZGVNb2R1bGU8dHlwZW9mIGltcG9ydCgnQHh0ZXJtL3h0ZXJtJyk+KCdAeHRlcm0veHRlcm0nLCAnbGliL3h0ZXJtLmpzJykpLlRlcm1pbmFsO1xuXG5cdFx0eHRlcm0gPSBzdG9yZS5hZGQobmV3IFRlcm1pbmFsQ3Rvcih7IGFsbG93UHJvcG9zZWRBcGk6IHRydWUsIGNvbHM6IDgwIH0pKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgc3RvcmUpO1xuXHRcdGNhcGFiaWxpdHkgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LCB4dGVybSkpO1xuXHRcdGFkZEV2ZW50cyA9IFtdO1xuXHRcdHN0b3JlLmFkZChjYXBhYmlsaXR5Lm9uQ29tbWFuZEZpbmlzaGVkKGUgPT4gYWRkRXZlbnRzLnB1c2goZSkpKTtcblx0XHRhc3NlcnRDb21tYW5kcyhbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCBub3QgYWRkIGNvbW1hbmRzIHdoZW4gbm8gY2FwYWJpbGl0eSBtZXRob2RzIGFyZSB0cmlnZ2VyZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnZm9vXFxyXFxuYmFyXFxyXFxuJyk7XG5cdFx0YXNzZXJ0Q29tbWFuZHMoW10pO1xuXHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ2JhelxcclxcbicpO1xuXHRcdGFzc2VydENvbW1hbmRzKFtdKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIGFkZCBjb21tYW5kcyBmb3IgZXhwZWN0ZWQgY2FwYWJpbGl0eSBtZXRob2QgY2FsbHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcHJpbnRTdGFuZGFyZENvbW1hbmQoJyQgJywgJ2VjaG8gZm9vJywgJ2ZvbycsIHVuZGVmaW5lZCwgMCk7XG5cdFx0YXdhaXQgcHJpbnRDb21tYW5kU3RhcnQoJyQgJyk7XG5cdFx0YXNzZXJ0Q29tbWFuZHMoW3tcblx0XHRcdGNvbW1hbmQ6ICdlY2hvIGZvbycsXG5cdFx0XHRleGl0Q29kZTogMCxcblx0XHRcdGN3ZDogdW5kZWZpbmVkLFxuXHRcdFx0bWFya2VyOiB7IGxpbmU6IDAgfVxuXHRcdH1dKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIHRyaW0gdGhlIGNvbW1hbmQgd2hlbiBjb21tYW5kIGV4ZWN1dGVkIGFwcGVhcnMgb24gdGhlIGZvbGxvd2luZyBsaW5lJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHByaW50U3RhbmRhcmRDb21tYW5kKCckICcsICdlY2hvIGZvb1xcclxcbicsICdmb28nLCB1bmRlZmluZWQsIDApO1xuXHRcdGF3YWl0IHByaW50Q29tbWFuZFN0YXJ0KCckICcpO1xuXHRcdGFzc2VydENvbW1hbmRzKFt7XG5cdFx0XHRjb21tYW5kOiAnZWNobyBmb28nLFxuXHRcdFx0ZXhpdENvZGU6IDAsXG5cdFx0XHRjd2Q6IHVuZGVmaW5lZCxcblx0XHRcdG1hcmtlcjogeyBsaW5lOiAwIH1cblx0XHR9XSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdjd2QnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGFkZCBjd2QgdG8gY29tbWFuZHMgd2hlbiBpdFxcJ3Mgc2V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgcHJpbnRTdGFuZGFyZENvbW1hbmQoJyQgJywgJ2VjaG8gZm9vJywgJ2ZvbycsICcvaG9tZScsIDApO1xuXHRcdFx0YXdhaXQgcHJpbnRTdGFuZGFyZENvbW1hbmQoJyQgJywgJ2VjaG8gYmFyJywgJ2JhcicsICcvaG9tZS9zZWNvbmQnLCAwKTtcblx0XHRcdGF3YWl0IHByaW50Q29tbWFuZFN0YXJ0KCckICcpO1xuXHRcdFx0YXNzZXJ0Q29tbWFuZHMoW1xuXHRcdFx0XHR7IGNvbW1hbmQ6ICdlY2hvIGZvbycsIGV4aXRDb2RlOiAwLCBjd2Q6ICcvaG9tZScsIG1hcmtlcjogeyBsaW5lOiAwIH0gfSxcblx0XHRcdFx0eyBjb21tYW5kOiAnZWNobyBiYXInLCBleGl0Q29kZTogMCwgY3dkOiAnL2hvbWUvc2Vjb25kJywgbWFya2VyOiB7IGxpbmU6IDIgfSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgYWRkIG9sZCBjd2QgdG8gY29tbWFuZHMgaWYgbm8gY3dkIHNlcXVlbmNlIGlzIG91dHB1dCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHByaW50U3RhbmRhcmRDb21tYW5kKCckICcsICdlY2hvIGZvbycsICdmb28nLCAnL2hvbWUnLCAwKTtcblx0XHRcdGF3YWl0IHByaW50U3RhbmRhcmRDb21tYW5kKCckICcsICdlY2hvIGJhcicsICdiYXInLCB1bmRlZmluZWQsIDApO1xuXHRcdFx0YXdhaXQgcHJpbnRDb21tYW5kU3RhcnQoJyQgJyk7XG5cdFx0XHRhc3NlcnRDb21tYW5kcyhbXG5cdFx0XHRcdHsgY29tbWFuZDogJ2VjaG8gZm9vJywgZXhpdENvZGU6IDAsIGN3ZDogJy9ob21lJywgbWFya2VyOiB7IGxpbmU6IDAgfSB9LFxuXHRcdFx0XHR7IGNvbW1hbmQ6ICdlY2hvIGJhcicsIGV4aXRDb2RlOiAwLCBjd2Q6ICcvaG9tZScsIG1hcmtlcjogeyBsaW5lOiAyIH0gfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHVzZSBhbiB1bmRlZmluZWQgY3dkIGlmIGl0XFwncyBub3Qgc2V0IGluaXRpYWxseScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHByaW50U3RhbmRhcmRDb21tYW5kKCckICcsICdlY2hvIGZvbycsICdmb28nLCB1bmRlZmluZWQsIDApO1xuXHRcdFx0YXdhaXQgcHJpbnRTdGFuZGFyZENvbW1hbmQoJyQgJywgJ2VjaG8gYmFyJywgJ2JhcicsICcvaG9tZScsIDApO1xuXHRcdFx0YXdhaXQgcHJpbnRDb21tYW5kU3RhcnQoJyQgJyk7XG5cdFx0XHRhc3NlcnRDb21tYW5kcyhbXG5cdFx0XHRcdHsgY29tbWFuZDogJ2VjaG8gZm9vJywgZXhpdENvZGU6IDAsIGN3ZDogdW5kZWZpbmVkLCBtYXJrZXI6IHsgbGluZTogMCB9IH0sXG5cdFx0XHRcdHsgY29tbWFuZDogJ2VjaG8gYmFyJywgZXhpdENvZGU6IDAsIGN3ZDogJy9ob21lJywgbWFya2VyOiB7IGxpbmU6IDIgfSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsaUJBQWlCLFVBQVU7QUFDcEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMscUNBQXFDO0FBSTlDLE1BQU0sdUNB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
