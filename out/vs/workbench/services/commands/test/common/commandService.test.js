import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { CommandService } from "../../common/commandService.js";
import { NullExtensionService } from "../../../extensions/common/extensions.js";
import { InstantiationService } from "../../../../../platform/instantiation/common/instantiationService.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
suite("CommandService", function() {
  let commandRegistration;
  setup(function() {
    commandRegistration = CommandsRegistry.registerCommand("foo", function() {
    });
  });
  teardown(function() {
    commandRegistration.dispose();
  });
  test("activateOnCommand", () => {
    let lastEvent;
    const service = new CommandService(new InstantiationService(), new class extends NullExtensionService {
      activateByEvent(activationEvent) {
        lastEvent = activationEvent;
        return super.activateByEvent(activationEvent);
      }
    }(), new NullLogService());
    return service.executeCommand("foo").then(() => {
      assert.ok(lastEvent, "onCommand:foo");
      return service.executeCommand("unknownCommandId");
    }).then(() => {
      assert.ok(false);
    }, () => {
      assert.ok(lastEvent, "onCommand:unknownCommandId");
    });
  });
  test("fwd activation error", async function() {
    const extensionService = new class extends NullExtensionService {
      activateByEvent(activationEvent) {
        return Promise.reject(new Error("bad_activate"));
      }
    }();
    const service = new CommandService(new InstantiationService(), extensionService, new NullLogService());
    await extensionService.whenInstalledExtensionsRegistered();
    return service.executeCommand("foo").then(() => assert.ok(false), (err) => {
      assert.strictEqual(err.message, "bad_activate");
    });
  });
  test("!onReady, but executeCommand", function() {
    let callCounter = 0;
    const reg = CommandsRegistry.registerCommand("bar", () => callCounter += 1);
    const service = new CommandService(new InstantiationService(), new class extends NullExtensionService {
      whenInstalledExtensionsRegistered() {
        return new Promise((_resolve) => {
        });
      }
    }(), new NullLogService());
    service.executeCommand("bar");
    assert.strictEqual(callCounter, 1);
    reg.dispose();
  });
  test("issue #34913: !onReady, unknown command", function() {
    let callCounter = 0;
    let resolveFunc;
    const whenInstalledExtensionsRegistered = new Promise((_resolve) => {
      resolveFunc = _resolve;
    });
    const service = new CommandService(new InstantiationService(), new class extends NullExtensionService {
      whenInstalledExtensionsRegistered() {
        return whenInstalledExtensionsRegistered;
      }
    }(), new NullLogService());
    const r = service.executeCommand("bar");
    assert.strictEqual(callCounter, 0);
    const reg = CommandsRegistry.registerCommand("bar", () => callCounter += 1);
    resolveFunc(true);
    return r.then(() => {
      reg.dispose();
      assert.strictEqual(callCounter, 1);
    });
  });
  test("Stop waiting for * extensions to activate when trigger is satisfied #62457", function() {
    let callCounter = 0;
    const disposable = new DisposableStore();
    const events = [];
    const service = new CommandService(new InstantiationService(), new class extends NullExtensionService {
      activateByEvent(event) {
        events.push(event);
        if (event === "*") {
          return new Promise(() => {
          });
        }
        if (event.indexOf("onCommand:") === 0) {
          return new Promise((resolve) => {
            setTimeout(() => {
              const reg = CommandsRegistry.registerCommand(event.substr("onCommand:".length), () => {
                callCounter += 1;
              });
              disposable.add(reg);
              resolve();
            }, 0);
          });
        }
        return Promise.resolve();
      }
    }(), new NullLogService());
    return service.executeCommand("farboo").then(() => {
      assert.strictEqual(callCounter, 1);
      assert.deepStrictEqual(events.sort(), ["*", "onCommand:farboo"].sort());
    }).finally(() => {
      disposable.dispose();
    });
  });
  test("issue #71471: wait for onCommand activation even if a command is registered", () => {
    const expectedOrder = ["registering command", "resolving activation event", "executing command"];
    const actualOrder = [];
    const disposables = new DisposableStore();
    const service = new CommandService(new InstantiationService(), new class extends NullExtensionService {
      activateByEvent(event) {
        if (event === "*") {
          return new Promise(() => {
          });
        }
        if (event.indexOf("onCommand:") === 0) {
          return new Promise((resolve) => {
            setTimeout(() => {
              actualOrder.push("registering command");
              const reg = CommandsRegistry.registerCommand(event.substr("onCommand:".length), () => {
                actualOrder.push("executing command");
              });
              disposables.add(reg);
              setTimeout(() => {
                actualOrder.push("resolving activation event");
                resolve();
              }, 10);
            }, 10);
          });
        }
        return Promise.resolve();
      }
    }(), new NullLogService());
    return service.executeCommand("farboo2").then(() => {
      assert.deepStrictEqual(actualOrder, expectedOrder);
    }).finally(() => {
      disposables.dispose();
    });
  });
  test("issue #142155: execute commands synchronously if possible", async () => {
    const actualOrder = [];
    const disposables = new DisposableStore();
    disposables.add(CommandsRegistry.registerCommand(`bizBaz`, () => {
      actualOrder.push("executing command");
    }));
    const extensionService = new class extends NullExtensionService {
      activationEventIsDone(_activationEvent) {
        return true;
      }
    }();
    const service = new CommandService(new InstantiationService(), extensionService, new NullLogService());
    await extensionService.whenInstalledExtensionsRegistered();
    try {
      actualOrder.push(`before call`);
      const promise = service.executeCommand("bizBaz");
      actualOrder.push(`after call`);
      await promise;
      actualOrder.push(`resolved`);
      assert.deepStrictEqual(actualOrder, [
        "before call",
        "executing command",
        "after call",
        "resolved"
      ]);
    } finally {
      disposables.dispose();
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29tbWFuZHMvdGVzdC9jb21tb24vY29tbWFuZFNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY29tbWFuZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTnVsbEV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5cbnN1aXRlKCdDb21tYW5kU2VydmljZScsIGZ1bmN0aW9uICgpIHtcblxuXHRsZXQgY29tbWFuZFJlZ2lzdHJhdGlvbjogSURpc3Bvc2FibGU7XG5cblx0c2V0dXAoZnVuY3Rpb24gKCkge1xuXHRcdGNvbW1hbmRSZWdpc3RyYXRpb24gPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZm9vJywgZnVuY3Rpb24gKCkgeyB9KTtcblx0fSk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdGNvbW1hbmRSZWdpc3RyYXRpb24uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdhY3RpdmF0ZU9uQ29tbWFuZCcsICgpID0+IHtcblxuXHRcdGxldCBsYXN0RXZlbnQ6IHN0cmluZztcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgQ29tbWFuZFNlcnZpY2UobmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKCksIG5ldyBjbGFzcyBleHRlbmRzIE51bGxFeHRlbnNpb25TZXJ2aWNlIHtcblx0XHRcdG92ZXJyaWRlIGFjdGl2YXRlQnlFdmVudChhY3RpdmF0aW9uRXZlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRsYXN0RXZlbnQgPSBhY3RpdmF0aW9uRXZlbnQ7XG5cdFx0XHRcdHJldHVybiBzdXBlci5hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50KTtcblx0XHRcdH1cblx0XHR9LCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cblx0XHRyZXR1cm4gc2VydmljZS5leGVjdXRlQ29tbWFuZCgnZm9vJykudGhlbigoKSA9PiB7XG5cdFx0XHRhc3NlcnQub2sobGFzdEV2ZW50LCAnb25Db21tYW5kOmZvbycpO1xuXHRcdFx0cmV0dXJuIHNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3Vua25vd25Db21tYW5kSWQnKTtcblx0XHR9KS50aGVuKCgpID0+IHtcblx0XHRcdGFzc2VydC5vayhmYWxzZSk7XG5cdFx0fSwgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGxhc3RFdmVudCwgJ29uQ29tbWFuZDp1bmtub3duQ29tbWFuZElkJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Z3ZCBhY3RpdmF0aW9uIGVycm9yJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uU2VydmljZSA9IG5ldyBjbGFzcyBleHRlbmRzIE51bGxFeHRlbnNpb25TZXJ2aWNlIHtcblx0XHRcdG92ZXJyaWRlIGFjdGl2YXRlQnlFdmVudChhY3RpdmF0aW9uRXZlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdiYWRfYWN0aXZhdGUnKSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgQ29tbWFuZFNlcnZpY2UobmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKCksIGV4dGVuc2lvblNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblxuXHRcdGF3YWl0IGV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHRyZXR1cm4gc2VydmljZS5leGVjdXRlQ29tbWFuZCgnZm9vJykudGhlbigoKSA9PiBhc3NlcnQub2soZmFsc2UpLCBlcnIgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVyci5tZXNzYWdlLCAnYmFkX2FjdGl2YXRlJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJyFvblJlYWR5LCBidXQgZXhlY3V0ZUNvbW1hbmQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgY2FsbENvdW50ZXIgPSAwO1xuXHRcdGNvbnN0IHJlZyA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdiYXInLCAoKSA9PiBjYWxsQ291bnRlciArPSAxKTtcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgQ29tbWFuZFNlcnZpY2UobmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKCksIG5ldyBjbGFzcyBleHRlbmRzIE51bGxFeHRlbnNpb25TZXJ2aWNlIHtcblx0XHRcdG92ZXJyaWRlIHdoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KF9yZXNvbHZlID0+IHsgLyppZ25vcmUqLyB9KTtcblx0XHRcdH1cblx0XHR9LCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cblx0XHRzZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50ZXIsIDEpO1xuXHRcdHJlZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzNDkxMzogIW9uUmVhZHksIHVua25vd24gY29tbWFuZCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCBjYWxsQ291bnRlciA9IDA7XG5cdFx0bGV0IHJlc29sdmVGdW5jOiBGdW5jdGlvbjtcblx0XHRjb25zdCB3aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQgPSBuZXcgUHJvbWlzZTxib29sZWFuPihfcmVzb2x2ZSA9PiB7IHJlc29sdmVGdW5jID0gX3Jlc29sdmU7IH0pO1xuXG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBDb21tYW5kU2VydmljZShuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoKSwgbmV3IGNsYXNzIGV4dGVuZHMgTnVsbEV4dGVuc2lvblNlcnZpY2Uge1xuXHRcdFx0b3ZlcnJpZGUgd2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCkge1xuXHRcdFx0XHRyZXR1cm4gd2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkO1xuXHRcdFx0fVxuXHRcdH0sIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblxuXHRcdGNvbnN0IHIgPSBzZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50ZXIsIDApO1xuXG5cdFx0Y29uc3QgcmVnID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2JhcicsICgpID0+IGNhbGxDb3VudGVyICs9IDEpO1xuXHRcdHJlc29sdmVGdW5jISh0cnVlKTtcblxuXHRcdHJldHVybiByLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmVnLmRpc3Bvc2UoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsQ291bnRlciwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0b3Agd2FpdGluZyBmb3IgKiBleHRlbnNpb25zIHRvIGFjdGl2YXRlIHdoZW4gdHJpZ2dlciBpcyBzYXRpc2ZpZWQgIzYyNDU3JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IGNhbGxDb3VudGVyID0gMDtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGV2ZW50czogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IENvbW1hbmRTZXJ2aWNlKG5ldyBJbnN0YW50aWF0aW9uU2VydmljZSgpLCBuZXcgY2xhc3MgZXh0ZW5kcyBOdWxsRXh0ZW5zaW9uU2VydmljZSB7XG5cblx0XHRcdG92ZXJyaWRlIGFjdGl2YXRlQnlFdmVudChldmVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGV2ZW50cy5wdXNoKGV2ZW50KTtcblx0XHRcdFx0aWYgKGV2ZW50ID09PSAnKicpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKCkgPT4geyB9KTsgLy9mb3JldmVyIHByb21pc2UuLi5cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXZlbnQuaW5kZXhPZignb25Db21tYW5kOicpID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJlZyA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKGV2ZW50LnN1YnN0cignb25Db21tYW5kOicubGVuZ3RoKSwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNhbGxDb3VudGVyICs9IDE7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRkaXNwb3NhYmxlLmFkZChyZWcpO1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0XHR9LCAwKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHR9XG5cblx0XHR9LCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cblx0XHRyZXR1cm4gc2VydmljZS5leGVjdXRlQ29tbWFuZCgnZmFyYm9vJykudGhlbigoKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50ZXIsIDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChldmVudHMuc29ydCgpLCBbJyonLCAnb25Db21tYW5kOmZhcmJvbyddLnNvcnQoKSk7XG5cdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzcxNDcxOiB3YWl0IGZvciBvbkNvbW1hbmQgYWN0aXZhdGlvbiBldmVuIGlmIGEgY29tbWFuZCBpcyByZWdpc3RlcmVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4cGVjdGVkT3JkZXI6IHN0cmluZ1tdID0gWydyZWdpc3RlcmluZyBjb21tYW5kJywgJ3Jlc29sdmluZyBhY3RpdmF0aW9uIGV2ZW50JywgJ2V4ZWN1dGluZyBjb21tYW5kJ107XG5cdFx0Y29uc3QgYWN0dWFsT3JkZXI6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBDb21tYW5kU2VydmljZShuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoKSwgbmV3IGNsYXNzIGV4dGVuZHMgTnVsbEV4dGVuc2lvblNlcnZpY2Uge1xuXG5cdFx0XHRvdmVycmlkZSBhY3RpdmF0ZUJ5RXZlbnQoZXZlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRpZiAoZXZlbnQgPT09ICcqJykge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7IH0pOyAvL2ZvcmV2ZXIgcHJvbWlzZS4uLlxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChldmVudC5pbmRleE9mKCdvbkNvbW1hbmQ6JykgPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdFx0Ly8gUmVnaXN0ZXIgdGhlIGNvbW1hbmQgYWZ0ZXIgc29tZSB0aW1lXG5cdFx0XHRcdFx0XHRcdGFjdHVhbE9yZGVyLnB1c2goJ3JlZ2lzdGVyaW5nIGNvbW1hbmQnKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVnID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoZXZlbnQuc3Vic3RyKCdvbkNvbW1hbmQ6Jy5sZW5ndGgpLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0YWN0dWFsT3JkZXIucHVzaCgnZXhlY3V0aW5nIGNvbW1hbmQnKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChyZWcpO1xuXG5cdFx0XHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFJlc29sdmUgdGhlIGFjdGl2YXRpb24gZXZlbnQgYWZ0ZXIgc29tZSBtb3JlIHRpbWVcblx0XHRcdFx0XHRcdFx0XHRhY3R1YWxPcmRlci5wdXNoKCdyZXNvbHZpbmcgYWN0aXZhdGlvbiBldmVudCcpO1xuXHRcdFx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHRcdFx0fSwgMTApO1xuXHRcdFx0XHRcdFx0fSwgMTApO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdH1cblxuXHRcdH0sIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblxuXHRcdHJldHVybiBzZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdmYXJib28yJykudGhlbigoKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbE9yZGVyLCBleHBlY3RlZE9yZGVyKTtcblx0XHR9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0MjE1NTogZXhlY3V0ZSBjb21tYW5kcyBzeW5jaHJvbm91c2x5IGlmIHBvc3NpYmxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbE9yZGVyOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKGBiaXpCYXpgLCAoKSA9PiB7XG5cdFx0XHRhY3R1YWxPcmRlci5wdXNoKCdleGVjdXRpbmcgY29tbWFuZCcpO1xuXHRcdH0pKTtcblx0XHRjb25zdCBleHRlbnNpb25TZXJ2aWNlID0gbmV3IGNsYXNzIGV4dGVuZHMgTnVsbEV4dGVuc2lvblNlcnZpY2Uge1xuXHRcdFx0b3ZlcnJpZGUgYWN0aXZhdGlvbkV2ZW50SXNEb25lKF9hY3RpdmF0aW9uRXZlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgQ29tbWFuZFNlcnZpY2UobmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKCksIGV4dGVuc2lvblNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblxuXHRcdGF3YWl0IGV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0YWN0dWFsT3JkZXIucHVzaChgYmVmb3JlIGNhbGxgKTtcblx0XHRcdGNvbnN0IHByb21pc2UgPSBzZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdiaXpCYXonKTtcblx0XHRcdGFjdHVhbE9yZGVyLnB1c2goYGFmdGVyIGNhbGxgKTtcblx0XHRcdGF3YWl0IHByb21pc2U7XG5cdFx0XHRhY3R1YWxPcmRlci5wdXNoKGByZXNvbHZlZGApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxPcmRlciwgW1xuXHRcdFx0XHQnYmVmb3JlIGNhbGwnLFxuXHRcdFx0XHQnZXhlY3V0aW5nIGNvbW1hbmQnLFxuXHRcdFx0XHQnYWZ0ZXIgY2FsbCcsXG5cdFx0XHRcdCdyZXNvbHZlZCdcblx0XHRcdF0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQXNCLHVCQUF1QjtBQUM3QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHNCQUFzQjtBQUUvQixNQUFNLGtCQUFrQixXQUFZO0FBRW5DLE1BQUk7QUFFSixRQUFNLFdBQVk7QUFDakIsMEJBQXNCLGlCQUFpQixnQkFBZ0IsT0FBTyxXQUFZO0FBQUEsSUFBRSxD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
