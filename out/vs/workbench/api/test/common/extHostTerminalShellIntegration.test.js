import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { InternalTerminalShellIntegration } from "../../common/extHostTerminalShellIntegration.js";
import { Emitter } from "../../../../base/common/event.js";
import { TerminalShellExecutionCommandLineConfidence } from "../../common/extHostTypes.js";
import { deepStrictEqual, notStrictEqual, strictEqual } from "assert";
import { DeferredPromise } from "../../../../base/common/async.js";
function cmdLine(value) {
  return Object.freeze({
    confidence: TerminalShellExecutionCommandLineConfidence.High,
    value,
    isTrusted: true
  });
}
function asCmdLine(value) {
  if (typeof value === "string") {
    return cmdLine(value);
  }
  return value;
}
function vsc(data) {
  return `\x1B]633;${data}\x07`;
}
const testCommandLine = "echo hello world";
const testCommandLine2 = "echo goodbye world";
suite("InternalTerminalShellIntegration", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let si;
  let terminal;
  let onDidStartTerminalShellExecution;
  let trackedEvents;
  let readIteratorsFlushed;
  async function startExecutionAwaitObject(commandLine, cwd) {
    return await new Promise((r) => {
      store.add(onDidStartTerminalShellExecution.event((e) => {
        r(e.execution);
      }));
      si.startShellExecution(asCmdLine(commandLine), cwd);
    });
  }
  async function endExecutionAwaitObject(commandLine) {
    return await new Promise((r) => {
      store.add(si.onDidRequestEndExecution((e) => r(e.execution)));
      si.endShellExecution(asCmdLine(commandLine), 0);
    });
  }
  async function emitData(data) {
    await new Promise((r) => queueMicrotask(r));
    si.emitData(data);
  }
  function assertTrackedEvents(expected) {
    deepStrictEqual(trackedEvents, expected);
  }
  function assertNonDataTrackedEvents(expected) {
    deepStrictEqual(trackedEvents.filter((e) => e.type !== "data"), expected);
  }
  function assertDataTrackedEvents(expected) {
    deepStrictEqual(trackedEvents.filter((e) => e.type === "data"), expected);
  }
  setup(() => {
    terminal = Symbol("testTerminal");
    onDidStartTerminalShellExecution = store.add(new Emitter());
    si = store.add(new InternalTerminalShellIntegration(terminal, onDidStartTerminalShellExecution));
    trackedEvents = [];
    readIteratorsFlushed = [];
    store.add(onDidStartTerminalShellExecution.event(async (e) => {
      trackedEvents.push({
        type: "start",
        commandLine: e.execution.commandLine.value
      });
      const stream = e.execution.read();
      const readIteratorsFlushedDeferred = new DeferredPromise();
      readIteratorsFlushed.push(readIteratorsFlushedDeferred.p);
      for await (const data of stream) {
        trackedEvents.push({
          type: "data",
          commandLine: e.execution.commandLine.value,
          data
        });
      }
      readIteratorsFlushedDeferred.complete();
    }));
    store.add(si.onDidRequestEndExecution((e) => trackedEvents.push({
      type: "end",
      commandLine: e.execution.commandLine.value
    })));
  });
  test("simple execution", async () => {
    const execution = await startExecutionAwaitObject(testCommandLine);
    deepStrictEqual(execution.commandLine.value, testCommandLine);
    const execution2 = await endExecutionAwaitObject(testCommandLine);
    strictEqual(execution2, execution);
    assertTrackedEvents([
      { commandLine: testCommandLine, type: "start" },
      { commandLine: testCommandLine, type: "end" }
    ]);
  });
  test("different execution unexpectedly ended", async () => {
    const execution1 = await startExecutionAwaitObject(testCommandLine);
    const execution2 = await endExecutionAwaitObject(testCommandLine2);
    strictEqual(execution1, execution2, "when a different execution is ended, the one that started first should end");
    assertTrackedEvents([
      { commandLine: testCommandLine, type: "start" },
      // This looks weird, but it's the same execution behind the scenes, just the command
      // line was updated
      { commandLine: testCommandLine2, type: "end" }
    ]);
  });
  test("no end event", async () => {
    const execution1 = await startExecutionAwaitObject(testCommandLine);
    const endedExecution = await new Promise((r) => {
      store.add(si.onDidRequestEndExecution((e) => r(e.execution)));
      startExecutionAwaitObject(testCommandLine2);
    });
    strictEqual(execution1, endedExecution, "when no end event is fired, the current execution should end");
    await endExecutionAwaitObject(testCommandLine2);
    await Promise.all(readIteratorsFlushed);
    assertTrackedEvents([
      { commandLine: testCommandLine, type: "start" },
      { commandLine: testCommandLine, type: "end" },
      { commandLine: testCommandLine2, type: "start" },
      { commandLine: testCommandLine2, type: "end" }
    ]);
  });
  suite("executeCommand", () => {
    test("^C to clear previous command", async () => {
      const commandLine = "foo";
      const apiRequestedExecution = si.requestNewShellExecution(cmdLine(commandLine), void 0);
      const firstExecution = await startExecutionAwaitObject("^C");
      notStrictEqual(firstExecution, apiRequestedExecution.value);
      si.emitData("SIGINT");
      si.endShellExecution(cmdLine("^C"), 0);
      si.startShellExecution(cmdLine(commandLine), void 0);
      await emitData("1");
      await endExecutionAwaitObject(commandLine);
      await Promise.all(readIteratorsFlushed);
      assertNonDataTrackedEvents([
        { commandLine: "^C", type: "start" },
        { commandLine: "^C", type: "end" },
        { commandLine, type: "start" },
        { commandLine, type: "end" }
      ]);
      assertDataTrackedEvents([
        { commandLine: "^C", type: "data", data: "SIGINT" },
        { commandLine, type: "data", data: "1" }
      ]);
    });
    test("multi-line command line", async () => {
      const commandLine = "foo\nbar";
      const apiRequestedExecution = si.requestNewShellExecution(cmdLine(commandLine), void 0);
      const startedExecution = await startExecutionAwaitObject("foo");
      strictEqual(startedExecution, apiRequestedExecution.value);
      si.emitData("1");
      si.emitData("2");
      si.endShellExecution(cmdLine("foo"), 0);
      si.startShellExecution(cmdLine("bar"), void 0);
      si.emitData("3");
      si.emitData("4");
      const endedExecution = await endExecutionAwaitObject("bar");
      strictEqual(startedExecution, endedExecution);
      assertTrackedEvents([
        { commandLine, type: "start" },
        { commandLine, type: "data", data: "1" },
        { commandLine, type: "data", data: "2" },
        { commandLine, type: "data", data: "3" },
        { commandLine, type: "data", data: "4" },
        { commandLine, type: "end" }
      ]);
    });
    test("multi-line command with long second command", async () => {
      const commandLine = "echo foo\ncat << EOT\nline1\nline2\nline3\nEOT";
      const subCommandLine1 = "echo foo";
      const subCommandLine2 = "cat << EOT\nline1\nline2\nline3\nEOT";
      const apiRequestedExecution = si.requestNewShellExecution(cmdLine(commandLine), void 0);
      const startedExecution = await startExecutionAwaitObject(subCommandLine1);
      strictEqual(startedExecution, apiRequestedExecution.value);
      si.emitData(`${vsc("C")}foo`);
      si.endShellExecution(cmdLine(subCommandLine1), 0);
      si.startShellExecution(cmdLine(subCommandLine2), void 0);
      si.emitData(`${vsc("C")}line1`);
      si.emitData("line2");
      si.emitData("line3");
      const endedExecution = await endExecutionAwaitObject(subCommandLine2);
      strictEqual(startedExecution, endedExecution);
      assertTrackedEvents([
        { commandLine, type: "start" },
        { commandLine, type: "data", data: `${vsc("C")}foo` },
        { commandLine, type: "data", data: `${vsc("C")}line1` },
        { commandLine, type: "data", data: "line2" },
        { commandLine, type: "data", data: "line3" },
        { commandLine, type: "end" }
      ]);
    });
    test("multi-line command comment followed by long second command", async () => {
      const commandLine = "# comment: foo\ncat << EOT\nline1\nline2\nline3\nEOT";
      const subCommandLine1 = "# comment: foo";
      const subCommandLine2 = "cat << EOT\nline1\nline2\nline3\nEOT";
      const apiRequestedExecution = si.requestNewShellExecution(cmdLine(commandLine), void 0);
      const startedExecution = await startExecutionAwaitObject(subCommandLine1);
      strictEqual(startedExecution, apiRequestedExecution.value);
      si.emitData(`${vsc("C")}`);
      si.endShellExecution(cmdLine(subCommandLine1), 0);
      si.startShellExecution(cmdLine(subCommandLine2), void 0);
      si.emitData(`${vsc("C")}line1`);
      si.emitData("line2");
      si.emitData("line3");
      const endedExecution = await endExecutionAwaitObject(subCommandLine2);
      strictEqual(startedExecution, endedExecution);
      assertTrackedEvents([
        { commandLine, type: "start" },
        { commandLine, type: "data", data: `${vsc("C")}` },
        { commandLine, type: "data", data: `${vsc("C")}line1` },
        { commandLine, type: "data", data: "line2" },
        { commandLine, type: "data", data: "line3" },
        { commandLine, type: "end" }
      ]);
    });
    test("4 multi-line commands with output", async () => {
      const commandLine = 'echo "\nfoo"\ngit commit -m "hello\n\nworld"\ncat << EOT\nline1\nline2\nline3\nEOT\n{\necho "foo"\n}';
      const subCommandLine1 = 'echo "\nfoo"';
      const subCommandLine2 = 'git commit -m "hello\n\nworld"';
      const subCommandLine3 = "cat << EOT\nline1\nline2\nline3\nEOT";
      const subCommandLine4 = '{\necho "foo"\n}';
      const apiRequestedExecution = si.requestNewShellExecution(cmdLine(commandLine), void 0);
      const startedExecution = await startExecutionAwaitObject(subCommandLine1);
      strictEqual(startedExecution, apiRequestedExecution.value);
      si.emitData(`${vsc("C")}foo`);
      si.endShellExecution(cmdLine(subCommandLine1), 0);
      si.startShellExecution(cmdLine(subCommandLine2), void 0);
      si.emitData(`${vsc("C")} 2 files changed, 61 insertions(+), 2 deletions(-)`);
      si.endShellExecution(cmdLine(subCommandLine2), 0);
      si.startShellExecution(cmdLine(subCommandLine3), void 0);
      si.emitData(`${vsc("C")}line1`);
      si.emitData("line2");
      si.emitData("line3");
      si.endShellExecution(cmdLine(subCommandLine3), 0);
      si.emitData(`${vsc("C")}foo`);
      si.startShellExecution(cmdLine(subCommandLine4), void 0);
      const endedExecution = await endExecutionAwaitObject(subCommandLine4);
      strictEqual(startedExecution, endedExecution);
      assertTrackedEvents([
        { commandLine, type: "start" },
        { commandLine, type: "data", data: `${vsc("C")}foo` },
        { commandLine, type: "data", data: `${vsc("C")} 2 files changed, 61 insertions(+), 2 deletions(-)` },
        { commandLine, type: "data", data: `${vsc("C")}line1` },
        { commandLine, type: "data", data: "line2" },
        { commandLine, type: "data", data: "line3" },
        { commandLine, type: "data", data: `${vsc("C")}foo` },
        { commandLine, type: "end" }
      ]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvY29tbW9uL2V4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24udGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHR5cGUgVGVybWluYWwsIHR5cGUgVGVybWluYWxTaGVsbEV4ZWN1dGlvbiwgdHlwZSBUZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmUsIHR5cGUgVGVybWluYWxTaGVsbEV4ZWN1dGlvblN0YXJ0RXZlbnQgfSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJbnRlcm5hbFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VGVybWluYWxTaGVsbEludGVncmF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmVDb25maWRlbmNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBkZWVwU3RyaWN0RXF1YWwsIG5vdFN0cmljdEVxdWFsLCBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgdHlwZSB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5cbmZ1bmN0aW9uIGNtZExpbmUodmFsdWU6IHN0cmluZyk6IFRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZSB7XG5cdHJldHVybiBPYmplY3QuZnJlZXplKHtcblx0XHRjb25maWRlbmNlOiBUZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmVDb25maWRlbmNlLkhpZ2gsXG5cdFx0dmFsdWUsXG5cdFx0aXNUcnVzdGVkOiB0cnVlLFxuXHR9KTtcbn1cbmZ1bmN0aW9uIGFzQ21kTGluZSh2YWx1ZTogc3RyaW5nIHwgVGVybWluYWxTaGVsbEV4ZWN1dGlvbkNvbW1hbmRMaW5lKTogVGVybWluYWxTaGVsbEV4ZWN1dGlvbkNvbW1hbmRMaW5lIHtcblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gY21kTGluZSh2YWx1ZSk7XG5cdH1cblx0cmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gdnNjKGRhdGE6IHN0cmluZykge1xuXHRyZXR1cm4gYFxceDFiXTYzMzske2RhdGF9XFx4MDdgO1xufVxuXG5jb25zdCB0ZXN0Q29tbWFuZExpbmUgPSAnZWNobyBoZWxsbyB3b3JsZCc7XG5jb25zdCB0ZXN0Q29tbWFuZExpbmUyID0gJ2VjaG8gZ29vZGJ5ZSB3b3JsZCc7XG5cbmludGVyZmFjZSBJVHJhY2tlZEV2ZW50IHtcblx0dHlwZTogJ3N0YXJ0JyB8ICdkYXRhJyB8ICdlbmQnO1xuXHRjb21tYW5kTGluZTogc3RyaW5nO1xuXHRkYXRhPzogc3RyaW5nO1xufVxuXG5zdWl0ZSgnSW50ZXJuYWxUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24nLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IHNpOiBJbnRlcm5hbFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbjtcblx0bGV0IHRlcm1pbmFsOiBUZXJtaW5hbDtcblx0bGV0IG9uRGlkU3RhcnRUZXJtaW5hbFNoZWxsRXhlY3V0aW9uOiBFbWl0dGVyPFRlcm1pbmFsU2hlbGxFeGVjdXRpb25TdGFydEV2ZW50Pjtcblx0bGV0IHRyYWNrZWRFdmVudHM6IElUcmFja2VkRXZlbnRbXTtcblx0bGV0IHJlYWRJdGVyYXRvcnNGbHVzaGVkOiBQcm9taXNlPHZvaWQ+W107XG5cblx0YXN5bmMgZnVuY3Rpb24gc3RhcnRFeGVjdXRpb25Bd2FpdE9iamVjdChjb21tYW5kTGluZTogc3RyaW5nIHwgVGVybWluYWxTaGVsbEV4ZWN1dGlvbkNvbW1hbmRMaW5lLCBjd2Q/OiBVUkkpOiBQcm9taXNlPFRlcm1pbmFsU2hlbGxFeGVjdXRpb24+IHtcblx0XHRyZXR1cm4gYXdhaXQgbmV3IFByb21pc2U8VGVybWluYWxTaGVsbEV4ZWN1dGlvbj4ociA9PiB7XG5cdFx0XHRzdG9yZS5hZGQob25EaWRTdGFydFRlcm1pbmFsU2hlbGxFeGVjdXRpb24uZXZlbnQoZSA9PiB7XG5cdFx0XHRcdHIoZS5leGVjdXRpb24pO1xuXHRcdFx0fSkpO1xuXHRcdFx0c2kuc3RhcnRTaGVsbEV4ZWN1dGlvbihhc0NtZExpbmUoY29tbWFuZExpbmUpLCBjd2QpO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gZW5kRXhlY3V0aW9uQXdhaXRPYmplY3QoY29tbWFuZExpbmU6IHN0cmluZyB8IFRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZSk6IFByb21pc2U8VGVybWluYWxTaGVsbEV4ZWN1dGlvbj4ge1xuXHRcdHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZTxUZXJtaW5hbFNoZWxsRXhlY3V0aW9uPihyID0+IHtcblx0XHRcdHN0b3JlLmFkZChzaS5vbkRpZFJlcXVlc3RFbmRFeGVjdXRpb24oZSA9PiByKGUuZXhlY3V0aW9uKSkpO1xuXHRcdFx0c2kuZW5kU2hlbGxFeGVjdXRpb24oYXNDbWRMaW5lKGNvbW1hbmRMaW5lKSwgMCk7XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBlbWl0RGF0YShkYXRhOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBBc3luY0l0ZXJhYmxlT2JqZWN0cyBhcmUgaW5pdGlhbGl6ZWQgaW4gYSBtaWNyb3Rhc2ssIHRoaXMgZG9lc24ndCBtYXR0ZXIgaW4gcHJhY3RpY2Vcblx0XHQvLyBzaW5jZSB0aGUgZXZlbnRzIHdpbGwgYWx3YXlzIGNvbWUgdGhyb3VnaCBpbiBkaWZmZXJlbnQgZXZlbnRzLlxuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4gcXVldWVNaWNyb3Rhc2socikpO1xuXHRcdHNpLmVtaXREYXRhKGRhdGEpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0VHJhY2tlZEV2ZW50cyhleHBlY3RlZDogSVRyYWNrZWRFdmVudFtdKSB7XG5cdFx0ZGVlcFN0cmljdEVxdWFsKHRyYWNrZWRFdmVudHMsIGV4cGVjdGVkKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydE5vbkRhdGFUcmFja2VkRXZlbnRzKGV4cGVjdGVkOiBJVHJhY2tlZEV2ZW50W10pIHtcblx0XHRkZWVwU3RyaWN0RXF1YWwodHJhY2tlZEV2ZW50cy5maWx0ZXIoZSA9PiBlLnR5cGUgIT09ICdkYXRhJyksIGV4cGVjdGVkKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydERhdGFUcmFja2VkRXZlbnRzKGV4cGVjdGVkOiBJVHJhY2tlZEV2ZW50W10pIHtcblx0XHRkZWVwU3RyaWN0RXF1YWwodHJhY2tlZEV2ZW50cy5maWx0ZXIoZSA9PiBlLnR5cGUgPT09ICdkYXRhJyksIGV4cGVjdGVkKTtcblx0fVxuXG5cdHNldHVwKCgpID0+IHtcblx0XHR0ZXJtaW5hbCA9IFN5bWJvbCgndGVzdFRlcm1pbmFsJykgYXMgYW55O1xuXHRcdG9uRGlkU3RhcnRUZXJtaW5hbFNoZWxsRXhlY3V0aW9uID0gc3RvcmUuYWRkKG5ldyBFbWl0dGVyKCkpO1xuXHRcdHNpID0gc3RvcmUuYWRkKG5ldyBJbnRlcm5hbFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbih0ZXJtaW5hbCwgb25EaWRTdGFydFRlcm1pbmFsU2hlbGxFeGVjdXRpb24pKTtcblxuXHRcdHRyYWNrZWRFdmVudHMgPSBbXTtcblx0XHRyZWFkSXRlcmF0b3JzRmx1c2hlZCA9IFtdO1xuXHRcdHN0b3JlLmFkZChvbkRpZFN0YXJ0VGVybWluYWxTaGVsbEV4ZWN1dGlvbi5ldmVudChhc3luYyBlID0+IHtcblx0XHRcdHRyYWNrZWRFdmVudHMucHVzaCh7XG5cdFx0XHRcdHR5cGU6ICdzdGFydCcsXG5cdFx0XHRcdGNvbW1hbmRMaW5lOiBlLmV4ZWN1dGlvbi5jb21tYW5kTGluZS52YWx1ZSxcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3Qgc3RyZWFtID0gZS5leGVjdXRpb24ucmVhZCgpO1xuXHRcdFx0Y29uc3QgcmVhZEl0ZXJhdG9yc0ZsdXNoZWREZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRcdHJlYWRJdGVyYXRvcnNGbHVzaGVkLnB1c2gocmVhZEl0ZXJhdG9yc0ZsdXNoZWREZWZlcnJlZC5wKTtcblx0XHRcdGZvciBhd2FpdCAoY29uc3QgZGF0YSBvZiBzdHJlYW0pIHtcblx0XHRcdFx0dHJhY2tlZEV2ZW50cy5wdXNoKHtcblx0XHRcdFx0XHR0eXBlOiAnZGF0YScsXG5cdFx0XHRcdFx0Y29tbWFuZExpbmU6IGUuZXhlY3V0aW9uLmNvbW1hbmRMaW5lLnZhbHVlLFxuXHRcdFx0XHRcdGRhdGEsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmVhZEl0ZXJhdG9yc0ZsdXNoZWREZWZlcnJlZC5jb21wbGV0ZSgpO1xuXHRcdH0pKTtcblx0XHRzdG9yZS5hZGQoc2kub25EaWRSZXF1ZXN0RW5kRXhlY3V0aW9uKGUgPT4gdHJhY2tlZEV2ZW50cy5wdXNoKHtcblx0XHRcdHR5cGU6ICdlbmQnLFxuXHRcdFx0Y29tbWFuZExpbmU6IGUuZXhlY3V0aW9uLmNvbW1hbmRMaW5lLnZhbHVlLFxuXHRcdH0pKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbXBsZSBleGVjdXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZXhlY3V0aW9uID0gYXdhaXQgc3RhcnRFeGVjdXRpb25Bd2FpdE9iamVjdCh0ZXN0Q29tbWFuZExpbmUpO1xuXHRcdGRlZXBTdHJpY3RFcXVhbChleGVjdXRpb24uY29tbWFuZExpbmUudmFsdWUsIHRlc3RDb21tYW5kTGluZSk7XG5cdFx0Y29uc3QgZXhlY3V0aW9uMiA9IGF3YWl0IGVuZEV4ZWN1dGlvbkF3YWl0T2JqZWN0KHRlc3RDb21tYW5kTGluZSk7XG5cdFx0c3RyaWN0RXF1YWwoZXhlY3V0aW9uMiwgZXhlY3V0aW9uKTtcblxuXHRcdGFzc2VydFRyYWNrZWRFdmVudHMoW1xuXHRcdFx0eyBjb21tYW5kTGluZTogdGVzdENvbW1hbmRMaW5lLCB0eXBlOiAnc3RhcnQnIH0sXG5cdFx0XHR7IGNvbW1hbmRMaW5lOiB0ZXN0Q29tbWFuZExpbmUsIHR5cGU6ICdlbmQnIH0sXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RpZmZlcmVudCBleGVjdXRpb24gdW5leHBlY3RlZGx5IGVuZGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGV4ZWN1dGlvbjEgPSBhd2FpdCBzdGFydEV4ZWN1dGlvbkF3YWl0T2JqZWN0KHRlc3RDb21tYW5kTGluZSk7XG5cdFx0Y29uc3QgZXhlY3V0aW9uMiA9IGF3YWl0IGVuZEV4ZWN1dGlvbkF3YWl0T2JqZWN0KHRlc3RDb21tYW5kTGluZTIpO1xuXHRcdHN0cmljdEVxdWFsKGV4ZWN1dGlvbjEsIGV4ZWN1dGlvbjIsICd3aGVuIGEgZGlmZmVyZW50IGV4ZWN1dGlvbiBpcyBlbmRlZCwgdGhlIG9uZSB0aGF0IHN0YXJ0ZWQgZmlyc3Qgc2hvdWxkIGVuZCcpO1xuXG5cdFx0YXNzZXJ0VHJhY2tlZEV2ZW50cyhbXG5cdFx0XHR7IGNvbW1hbmRMaW5lOiB0ZXN0Q29tbWFuZExpbmUsIHR5cGU6ICdzdGFydCcgfSxcblx0XHRcdC8vIFRoaXMgbG9va3Mgd2VpcmQsIGJ1dCBpdCdzIHRoZSBzYW1lIGV4ZWN1dGlvbiBiZWhpbmQgdGhlIHNjZW5lcywganVzdCB0aGUgY29tbWFuZFxuXHRcdFx0Ly8gbGluZSB3YXMgdXBkYXRlZFxuXHRcdFx0eyBjb21tYW5kTGluZTogdGVzdENvbW1hbmRMaW5lMiwgdHlwZTogJ2VuZCcgfSxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnbm8gZW5kIGV2ZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGV4ZWN1dGlvbjEgPSBhd2FpdCBzdGFydEV4ZWN1dGlvbkF3YWl0T2JqZWN0KHRlc3RDb21tYW5kTGluZSk7XG5cdFx0Y29uc3QgZW5kZWRFeGVjdXRpb24gPSBhd2FpdCBuZXcgUHJvbWlzZTxUZXJtaW5hbFNoZWxsRXhlY3V0aW9uPihyID0+IHtcblx0XHRcdHN0b3JlLmFkZChzaS5vbkRpZFJlcXVlc3RFbmRFeGVjdXRpb24oZSA9PiByKGUuZXhlY3V0aW9uKSkpO1xuXHRcdFx0c3RhcnRFeGVjdXRpb25Bd2FpdE9iamVjdCh0ZXN0Q29tbWFuZExpbmUyKTtcblx0XHR9KTtcblx0XHRzdHJpY3RFcXVhbChleGVjdXRpb24xLCBlbmRlZEV4ZWN1dGlvbiwgJ3doZW4gbm8gZW5kIGV2ZW50IGlzIGZpcmVkLCB0aGUgY3VycmVudCBleGVjdXRpb24gc2hvdWxkIGVuZCcpO1xuXG5cdFx0Ly8gQ2xlYW4gdXAgZGlzcG9zYWJsZXNcblx0XHRhd2FpdCBlbmRFeGVjdXRpb25Bd2FpdE9iamVjdCh0ZXN0Q29tbWFuZExpbmUyKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChyZWFkSXRlcmF0b3JzRmx1c2hlZCk7XG5cblx0XHRhc3NlcnRUcmFja2VkRXZlbnRzKFtcblx0XHRcdHsgY29tbWFuZExpbmU6IHRlc3RDb21tYW5kTGluZSwgdHlwZTogJ3N0YXJ0JyB9LFxuXHRcdFx0eyBjb21tYW5kTGluZTogdGVzdENvbW1hbmRMaW5lLCB0eXBlOiAnZW5kJyB9LFxuXHRcdFx0eyBjb21tYW5kTGluZTogdGVzdENvbW1hbmRMaW5lMiwgdHlwZTogJ3N0YXJ0JyB9LFxuXHRcdFx0eyBjb21tYW5kTGluZTogdGVzdENvbW1hbmRMaW5lMiwgdHlwZTogJ2VuZCcgfSxcblx0XHRdKTtcblx0fSk7XG5cblx0c3VpdGUoJ2V4ZWN1dGVDb21tYW5kJywgKCkgPT4ge1xuXHRcdHRlc3QoJ15DIHRvIGNsZWFyIHByZXZpb3VzIGNvbW1hbmQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb21tYW5kTGluZSA9ICdmb28nO1xuXHRcdFx0Y29uc3QgYXBpUmVxdWVzdGVkRXhlY3V0aW9uID0gc2kucmVxdWVzdE5ld1NoZWxsRXhlY3V0aW9uKGNtZExpbmUoY29tbWFuZExpbmUpLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgZmlyc3RFeGVjdXRpb24gPSBhd2FpdCBzdGFydEV4ZWN1dGlvbkF3YWl0T2JqZWN0KCdeQycpO1xuXHRcdFx0bm90U3RyaWN0RXF1YWwoZmlyc3RFeGVjdXRpb24sIGFwaVJlcXVlc3RlZEV4ZWN1dGlvbi52YWx1ZSk7XG5cdFx0XHRzaS5lbWl0RGF0YSgnU0lHSU5UJyk7XG5cdFx0XHRzaS5lbmRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKCdeQycpLCAwKTtcblx0XHRcdHNpLnN0YXJ0U2hlbGxFeGVjdXRpb24oY21kTGluZShjb21tYW5kTGluZSksIHVuZGVmaW5lZCk7XG5cdFx0XHRhd2FpdCBlbWl0RGF0YSgnMScpO1xuXHRcdFx0YXdhaXQgZW5kRXhlY3V0aW9uQXdhaXRPYmplY3QoY29tbWFuZExpbmUpO1xuXHRcdFx0Ly8gSU1QT1JUQU5UOiBXZSBjYW5ub3QgcmVsaWFibHkgYXNzZXJ0IHRoZSBvcmRlciBvZiBkYXRhIGV2ZW50cyBoZXJlIGJlY2F1c2UgZmx1c2hpbmdcblx0XHRcdC8vIG9mIHRoZSBhc3luYyBpdGVyYXRvciBpcyBhc3luY2hyb25vdXMgYW5kIGNvdWxkIGhhcHBlbiBhZnRlciB0aGUgZXhlY3V0aW9uJ3MgZW5kXG5cdFx0XHQvLyBldmVudCBmaXJlcyBpZiBhbiBleGVjdXRpb24gaXMgc3RhcnRlZCBpbW1lZGlhdGVseSBhZnRlcndhcmRzLlxuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwocmVhZEl0ZXJhdG9yc0ZsdXNoZWQpO1xuXG5cdFx0XHRhc3NlcnROb25EYXRhVHJhY2tlZEV2ZW50cyhbXG5cdFx0XHRcdHsgY29tbWFuZExpbmU6ICdeQycsIHR5cGU6ICdzdGFydCcgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZTogJ15DJywgdHlwZTogJ2VuZCcgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ3N0YXJ0JyB9LFxuXHRcdFx0XHR7IGNvbW1hbmRMaW5lLCB0eXBlOiAnZW5kJyB9LFxuXHRcdFx0XSk7XG5cdFx0XHRhc3NlcnREYXRhVHJhY2tlZEV2ZW50cyhbXG5cdFx0XHRcdHsgY29tbWFuZExpbmU6ICdeQycsIHR5cGU6ICdkYXRhJywgZGF0YTogJ1NJR0lOVCcgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiAnMScgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbXVsdGktbGluZSBjb21tYW5kIGxpbmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb21tYW5kTGluZSA9ICdmb29cXG5iYXInO1xuXHRcdFx0Y29uc3QgYXBpUmVxdWVzdGVkRXhlY3V0aW9uID0gc2kucmVxdWVzdE5ld1NoZWxsRXhlY3V0aW9uKGNtZExpbmUoY29tbWFuZExpbmUpLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3Qgc3RhcnRlZEV4ZWN1dGlvbiA9IGF3YWl0IHN0YXJ0RXhlY3V0aW9uQXdhaXRPYmplY3QoJ2ZvbycpO1xuXHRcdFx0c3RyaWN0RXF1YWwoc3RhcnRlZEV4ZWN1dGlvbiwgYXBpUmVxdWVzdGVkRXhlY3V0aW9uLnZhbHVlKTtcblxuXHRcdFx0c2kuZW1pdERhdGEoJzEnKTtcblx0XHRcdHNpLmVtaXREYXRhKCcyJyk7XG5cdFx0XHRzaS5lbmRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKCdmb28nKSwgMCk7XG5cdFx0XHRzaS5zdGFydFNoZWxsRXhlY3V0aW9uKGNtZExpbmUoJ2JhcicpLCB1bmRlZmluZWQpO1xuXHRcdFx0c2kuZW1pdERhdGEoJzMnKTtcblx0XHRcdHNpLmVtaXREYXRhKCc0Jyk7XG5cdFx0XHRjb25zdCBlbmRlZEV4ZWN1dGlvbiA9IGF3YWl0IGVuZEV4ZWN1dGlvbkF3YWl0T2JqZWN0KCdiYXInKTtcblx0XHRcdHN0cmljdEVxdWFsKHN0YXJ0ZWRFeGVjdXRpb24sIGVuZGVkRXhlY3V0aW9uKTtcblxuXHRcdFx0YXNzZXJ0VHJhY2tlZEV2ZW50cyhbXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdzdGFydCcgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiAnMScgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiAnMicgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiAnMycgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiAnNCcgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2VuZCcgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbXVsdGktbGluZSBjb21tYW5kIHdpdGggbG9uZyBzZWNvbmQgY29tbWFuZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbW1hbmRMaW5lID0gJ2VjaG8gZm9vXFxuY2F0IDw8IEVPVFxcbmxpbmUxXFxubGluZTJcXG5saW5lM1xcbkVPVCc7XG5cdFx0XHRjb25zdCBzdWJDb21tYW5kTGluZTEgPSAnZWNobyBmb28nO1xuXHRcdFx0Y29uc3Qgc3ViQ29tbWFuZExpbmUyID0gJ2NhdCA8PCBFT1RcXG5saW5lMVxcbmxpbmUyXFxubGluZTNcXG5FT1QnO1xuXG5cdFx0XHRjb25zdCBhcGlSZXF1ZXN0ZWRFeGVjdXRpb24gPSBzaS5yZXF1ZXN0TmV3U2hlbGxFeGVjdXRpb24oY21kTGluZShjb21tYW5kTGluZSksIHVuZGVmaW5lZCk7XG5cdFx0XHRjb25zdCBzdGFydGVkRXhlY3V0aW9uID0gYXdhaXQgc3RhcnRFeGVjdXRpb25Bd2FpdE9iamVjdChzdWJDb21tYW5kTGluZTEpO1xuXHRcdFx0c3RyaWN0RXF1YWwoc3RhcnRlZEV4ZWN1dGlvbiwgYXBpUmVxdWVzdGVkRXhlY3V0aW9uLnZhbHVlKTtcblxuXHRcdFx0c2kuZW1pdERhdGEoYCR7dnNjKCdDJyl9Zm9vYCk7XG5cdFx0XHRzaS5lbmRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKHN1YkNvbW1hbmRMaW5lMSksIDApO1xuXHRcdFx0c2kuc3RhcnRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKHN1YkNvbW1hbmRMaW5lMiksIHVuZGVmaW5lZCk7XG5cdFx0XHRzaS5lbWl0RGF0YShgJHt2c2MoJ0MnKX1saW5lMWApO1xuXHRcdFx0c2kuZW1pdERhdGEoJ2xpbmUyJyk7XG5cdFx0XHRzaS5lbWl0RGF0YSgnbGluZTMnKTtcblx0XHRcdGNvbnN0IGVuZGVkRXhlY3V0aW9uID0gYXdhaXQgZW5kRXhlY3V0aW9uQXdhaXRPYmplY3Qoc3ViQ29tbWFuZExpbmUyKTtcblx0XHRcdHN0cmljdEVxdWFsKHN0YXJ0ZWRFeGVjdXRpb24sIGVuZGVkRXhlY3V0aW9uKTtcblxuXHRcdFx0YXNzZXJ0VHJhY2tlZEV2ZW50cyhbXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdzdGFydCcgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiBgJHt2c2MoJ0MnKX1mb29gIH0sXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdkYXRhJywgZGF0YTogYCR7dnNjKCdDJyl9bGluZTFgIH0sXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdkYXRhJywgZGF0YTogJ2xpbmUyJyB9LFxuXHRcdFx0XHR7IGNvbW1hbmRMaW5lLCB0eXBlOiAnZGF0YScsIGRhdGE6ICdsaW5lMycgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2VuZCcgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbXVsdGktbGluZSBjb21tYW5kIGNvbW1lbnQgZm9sbG93ZWQgYnkgbG9uZyBzZWNvbmQgY29tbWFuZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbW1hbmRMaW5lID0gJyMgY29tbWVudDogZm9vXFxuY2F0IDw8IEVPVFxcbmxpbmUxXFxubGluZTJcXG5saW5lM1xcbkVPVCc7XG5cdFx0XHRjb25zdCBzdWJDb21tYW5kTGluZTEgPSAnIyBjb21tZW50OiBmb28nO1xuXHRcdFx0Y29uc3Qgc3ViQ29tbWFuZExpbmUyID0gJ2NhdCA8PCBFT1RcXG5saW5lMVxcbmxpbmUyXFxubGluZTNcXG5FT1QnO1xuXG5cdFx0XHRjb25zdCBhcGlSZXF1ZXN0ZWRFeGVjdXRpb24gPSBzaS5yZXF1ZXN0TmV3U2hlbGxFeGVjdXRpb24oY21kTGluZShjb21tYW5kTGluZSksIHVuZGVmaW5lZCk7XG5cdFx0XHRjb25zdCBzdGFydGVkRXhlY3V0aW9uID0gYXdhaXQgc3RhcnRFeGVjdXRpb25Bd2FpdE9iamVjdChzdWJDb21tYW5kTGluZTEpO1xuXHRcdFx0c3RyaWN0RXF1YWwoc3RhcnRlZEV4ZWN1dGlvbiwgYXBpUmVxdWVzdGVkRXhlY3V0aW9uLnZhbHVlKTtcblxuXHRcdFx0c2kuZW1pdERhdGEoYCR7dnNjKCdDJyl9YCk7XG5cdFx0XHRzaS5lbmRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKHN1YkNvbW1hbmRMaW5lMSksIDApO1xuXHRcdFx0c2kuc3RhcnRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKHN1YkNvbW1hbmRMaW5lMiksIHVuZGVmaW5lZCk7XG5cdFx0XHRzaS5lbWl0RGF0YShgJHt2c2MoJ0MnKX1saW5lMWApO1xuXHRcdFx0c2kuZW1pdERhdGEoJ2xpbmUyJyk7XG5cdFx0XHRzaS5lbWl0RGF0YSgnbGluZTMnKTtcblx0XHRcdGNvbnN0IGVuZGVkRXhlY3V0aW9uID0gYXdhaXQgZW5kRXhlY3V0aW9uQXdhaXRPYmplY3Qoc3ViQ29tbWFuZExpbmUyKTtcblx0XHRcdHN0cmljdEVxdWFsKHN0YXJ0ZWRFeGVjdXRpb24sIGVuZGVkRXhlY3V0aW9uKTtcblxuXHRcdFx0YXNzZXJ0VHJhY2tlZEV2ZW50cyhbXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdzdGFydCcgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiBgJHt2c2MoJ0MnKX1gIH0sXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdkYXRhJywgZGF0YTogYCR7dnNjKCdDJyl9bGluZTFgIH0sXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdkYXRhJywgZGF0YTogJ2xpbmUyJyB9LFxuXHRcdFx0XHR7IGNvbW1hbmRMaW5lLCB0eXBlOiAnZGF0YScsIGRhdGE6ICdsaW5lMycgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2VuZCcgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnNCBtdWx0aS1saW5lIGNvbW1hbmRzIHdpdGggb3V0cHV0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29tbWFuZExpbmUgPSAnZWNobyBcIlxcbmZvb1wiXFxuZ2l0IGNvbW1pdCAtbSBcImhlbGxvXFxuXFxud29ybGRcIlxcbmNhdCA8PCBFT1RcXG5saW5lMVxcbmxpbmUyXFxubGluZTNcXG5FT1RcXG57XFxuZWNobyBcImZvb1wiXFxufSc7XG5cdFx0XHRjb25zdCBzdWJDb21tYW5kTGluZTEgPSAnZWNobyBcIlxcbmZvb1wiJztcblx0XHRcdGNvbnN0IHN1YkNvbW1hbmRMaW5lMiA9ICdnaXQgY29tbWl0IC1tIFwiaGVsbG9cXG5cXG53b3JsZFwiJztcblx0XHRcdGNvbnN0IHN1YkNvbW1hbmRMaW5lMyA9ICdjYXQgPDwgRU9UXFxubGluZTFcXG5saW5lMlxcbmxpbmUzXFxuRU9UJztcblx0XHRcdGNvbnN0IHN1YkNvbW1hbmRMaW5lNCA9ICd7XFxuZWNobyBcImZvb1wiXFxufSc7XG5cblx0XHRcdGNvbnN0IGFwaVJlcXVlc3RlZEV4ZWN1dGlvbiA9IHNpLnJlcXVlc3ROZXdTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKGNvbW1hbmRMaW5lKSwgdW5kZWZpbmVkKTtcblx0XHRcdGNvbnN0IHN0YXJ0ZWRFeGVjdXRpb24gPSBhd2FpdCBzdGFydEV4ZWN1dGlvbkF3YWl0T2JqZWN0KHN1YkNvbW1hbmRMaW5lMSk7XG5cdFx0XHRzdHJpY3RFcXVhbChzdGFydGVkRXhlY3V0aW9uLCBhcGlSZXF1ZXN0ZWRFeGVjdXRpb24udmFsdWUpO1xuXG5cdFx0XHRzaS5lbWl0RGF0YShgJHt2c2MoJ0MnKX1mb29gKTtcblx0XHRcdHNpLmVuZFNoZWxsRXhlY3V0aW9uKGNtZExpbmUoc3ViQ29tbWFuZExpbmUxKSwgMCk7XG5cdFx0XHRzaS5zdGFydFNoZWxsRXhlY3V0aW9uKGNtZExpbmUoc3ViQ29tbWFuZExpbmUyKSwgdW5kZWZpbmVkKTtcblx0XHRcdHNpLmVtaXREYXRhKGAke3ZzYygnQycpfSAyIGZpbGVzIGNoYW5nZWQsIDYxIGluc2VydGlvbnMoKyksIDIgZGVsZXRpb25zKC0pYCk7XG5cdFx0XHRzaS5lbmRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKHN1YkNvbW1hbmRMaW5lMiksIDApO1xuXHRcdFx0c2kuc3RhcnRTaGVsbEV4ZWN1dGlvbihjbWRMaW5lKHN1YkNvbW1hbmRMaW5lMyksIHVuZGVmaW5lZCk7XG5cdFx0XHRzaS5lbWl0RGF0YShgJHt2c2MoJ0MnKX1saW5lMWApO1xuXHRcdFx0c2kuZW1pdERhdGEoJ2xpbmUyJyk7XG5cdFx0XHRzaS5lbWl0RGF0YSgnbGluZTMnKTtcblx0XHRcdHNpLmVuZFNoZWxsRXhlY3V0aW9uKGNtZExpbmUoc3ViQ29tbWFuZExpbmUzKSwgMCk7XG5cdFx0XHRzaS5lbWl0RGF0YShgJHt2c2MoJ0MnKX1mb29gKTtcblx0XHRcdHNpLnN0YXJ0U2hlbGxFeGVjdXRpb24oY21kTGluZShzdWJDb21tYW5kTGluZTQpLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgZW5kZWRFeGVjdXRpb24gPSBhd2FpdCBlbmRFeGVjdXRpb25Bd2FpdE9iamVjdChzdWJDb21tYW5kTGluZTQpO1xuXHRcdFx0c3RyaWN0RXF1YWwoc3RhcnRlZEV4ZWN1dGlvbiwgZW5kZWRFeGVjdXRpb24pO1xuXG5cdFx0XHRhc3NlcnRUcmFja2VkRXZlbnRzKFtcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ3N0YXJ0JyB9LFxuXHRcdFx0XHR7IGNvbW1hbmRMaW5lLCB0eXBlOiAnZGF0YScsIGRhdGE6IGAke3ZzYygnQycpfWZvb2AgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiBgJHt2c2MoJ0MnKX0gMiBmaWxlcyBjaGFuZ2VkLCA2MSBpbnNlcnRpb25zKCspLCAyIGRlbGV0aW9ucygtKWAgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiBgJHt2c2MoJ0MnKX1saW5lMWAgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2RhdGEnLCBkYXRhOiAnbGluZTInIH0sXG5cdFx0XHRcdHsgY29tbWFuZExpbmUsIHR5cGU6ICdkYXRhJywgZGF0YTogJ2xpbmUzJyB9LFxuXHRcdFx0XHR7IGNvbW1hbmRMaW5lLCB0eXBlOiAnZGF0YScsIGRhdGE6IGAke3ZzYygnQycpfWZvb2AgfSxcblx0XHRcdFx0eyBjb21tYW5kTGluZSwgdHlwZTogJ2VuZCcgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsbURBQW1EO0FBQzVELFNBQVMsaUJBQWlCLGdCQUFnQixtQkFBbUI7QUFFN0QsU0FBUyx1QkFBdUI7QUFFaEMsU0FBUyxRQUFRLE9BQWtEO0FBQ2xFLFNBQU8sT0FBTyxPQUFPO0FBQUEsSUFDcEIsWUFBWSw0Q0FBNEM7QUFBQSxJQUN4RDtBQUFBLElBQ0EsV0FBVztBQUFBLEVBQ1osQ0FBQztBQUNGO0FBQ0EsU0FBUyxVQUFVLE9BQXNGO0FBQ3hHLE1BQUksT0FBTyxVQUFVLFVBQVU7QUFDOUIsV0FBTyxRQUFRLEtBQUs7QUFBQSxFQUNyQjtBQUNBLFNBQU87QUFDUjtBQUNBLFNBQVMsSUFBSSxNQUFjO0FBQzFCLFNBQU8sWUFBWSxJQUFJO0FBQ3hCO0FBRUEsTUFBTSxrQkFBa0I7QUFDeEIsTUFBTSxtQkFBbUI7QUFRekIsTUFBTSxvQ0FBb0MsTUFBTTtBQUMvQyxRQUFNLFFBQVEsd0NBQXdDO0FBRXRELE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosaUJBQWUsMEJBQTBCLGFBQXlELEtBQTRDO0FBQzdJLFdBQU8sTUFBTSxJQUFJLFFBQWdDLE9BQUs7QUFDckQsWUFBTSxJQUFJLGlDQUFpQyxNQUFNLE9BQUs7QUFDckQsVUFBRSxFQUFFLFNBQVM7QUFBQSxNQUNkLENBQUMsQ0FBQztBQUNGLFNBQUcsb0JBQW9CLFVBQVUsV0FBVyxHQUFHLEdBQUc7QUFBQSxJQUNuRCxDQUFDO0FBQUEsRUFDRjtBQUVBLGlCQUFlLHdCQUF3QixhQUEwRjtBQUNoSSxXQUFPLE1BQU0sSUFBSSxRQUFnQyxPQUFLO0FBQ3JELFlBQU0sSUFBSSxHQUFHLHlCQUF5QixPQUFLLEVBQUUsRUFBRSxTQUFTLENBQUMs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
