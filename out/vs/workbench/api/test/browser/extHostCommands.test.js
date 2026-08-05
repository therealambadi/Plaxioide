import assert from "assert";
import { ExtHostCommands } from "../../common/extHostCommands.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { SingleProxyRPCProtocol } from "../common/testRPCProtocol.js";
import { mock } from "../../../../base/test/common/mock.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("ExtHostCommands", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("dispose calls unregister", function() {
    let lastUnregister;
    const shape = new class extends mock() {
      $registerCommand(id) {
      }
      $unregisterCommand(id) {
        lastUnregister = id;
      }
    }();
    const commands = new ExtHostCommands(
      SingleProxyRPCProtocol(shape),
      new NullLogService(),
      new class extends mock() {
        onExtensionError() {
          return true;
        }
      }()
    );
    commands.registerCommand(true, "foo", () => {
    }).dispose();
    assert.strictEqual(lastUnregister, "foo");
    assert.strictEqual(CommandsRegistry.getCommand("foo"), void 0);
  });
  test("dispose bubbles only once", function() {
    let unregisterCounter = 0;
    const shape = new class extends mock() {
      $registerCommand(id) {
      }
      $unregisterCommand(id) {
        unregisterCounter += 1;
      }
    }();
    const commands = new ExtHostCommands(
      SingleProxyRPCProtocol(shape),
      new NullLogService(),
      new class extends mock() {
        onExtensionError() {
          return true;
        }
      }()
    );
    const reg = commands.registerCommand(true, "foo", () => {
    });
    reg.dispose();
    reg.dispose();
    reg.dispose();
    assert.strictEqual(unregisterCounter, 1);
  });
  test("execute with retry", async function() {
    let count = 0;
    const shape = new class extends mock() {
      $registerCommand(id) {
      }
      async $executeCommand(id, args, retry) {
        count++;
        assert.strictEqual(retry, count === 1);
        if (count === 1) {
          assert.strictEqual(retry, true);
          throw new Error("$executeCommand:retry");
        } else {
          assert.strictEqual(retry, false);
          return 17;
        }
      }
    }();
    const commands = new ExtHostCommands(
      SingleProxyRPCProtocol(shape),
      new NullLogService(),
      new class extends mock() {
        onExtensionError() {
          return true;
        }
      }()
    );
    const result = await commands.executeCommand("fooo", [this, true]);
    assert.strictEqual(result, 17);
    assert.strictEqual(count, 2);
  });
  test("onCommand:abc activates extensions when executed from command palette, but not when executed programmatically with vscode.commands.executeCommand #150293", async function() {
    const activationEvents = [];
    const shape = new class extends mock() {
      $registerCommand(id) {
      }
      $fireCommandActivationEvent(id) {
        activationEvents.push(id);
      }
    }();
    const commands = new ExtHostCommands(
      SingleProxyRPCProtocol(shape),
      new NullLogService(),
      new class extends mock() {
        onExtensionError() {
          return true;
        }
      }()
    );
    commands.registerCommand(true, "extCmd", (args) => args);
    const result = await commands.executeCommand("extCmd", this);
    assert.strictEqual(result, this);
    assert.deepStrictEqual(activationEvents, ["extCmd"]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0Q29tbWFuZHMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZENvbW1hbmRzU2hhcGUgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IFNpbmdsZVByb3h5UlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFRlbGVtZXRyeSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnRXh0SG9zdENvbW1hbmRzJywgZnVuY3Rpb24gKCkge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdkaXNwb3NlIGNhbGxzIHVucmVnaXN0ZXInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgbGFzdFVucmVnaXN0ZXI6IHN0cmluZztcblxuXHRcdGNvbnN0IHNoYXBlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkQ29tbWFuZHNTaGFwZT4oKSB7XG5cdFx0XHRvdmVycmlkZSAkcmVnaXN0ZXJDb21tYW5kKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdFx0Ly9cblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlICR1bnJlZ2lzdGVyQ29tbWFuZChpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRcdGxhc3RVbnJlZ2lzdGVyID0gaWQ7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGNvbW1hbmRzID0gbmV3IEV4dEhvc3RDb21tYW5kcyhcblx0XHRcdFNpbmdsZVByb3h5UlBDUHJvdG9jb2woc2hhcGUpLFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFeHRIb3N0VGVsZW1ldHJ5PigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgb25FeHRlbnNpb25FcnJvcigpOiBib29sZWFuIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0Y29tbWFuZHMucmVnaXN0ZXJDb21tYW5kKHRydWUsICdmb28nLCAoKTogYW55ID0+IHsgfSkuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0VW5yZWdpc3RlciEsICdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKCdmb28nKSwgdW5kZWZpbmVkKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdkaXNwb3NlIGJ1YmJsZXMgb25seSBvbmNlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IHVucmVnaXN0ZXJDb3VudGVyID0gMDtcblxuXHRcdGNvbnN0IHNoYXBlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkQ29tbWFuZHNTaGFwZT4oKSB7XG5cdFx0XHRvdmVycmlkZSAkcmVnaXN0ZXJDb21tYW5kKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdFx0Ly9cblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlICR1bnJlZ2lzdGVyQ29tbWFuZChpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRcdHVucmVnaXN0ZXJDb3VudGVyICs9IDE7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGNvbW1hbmRzID0gbmV3IEV4dEhvc3RDb21tYW5kcyhcblx0XHRcdFNpbmdsZVByb3h5UlBDUHJvdG9jb2woc2hhcGUpLFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFeHRIb3N0VGVsZW1ldHJ5PigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgb25FeHRlbnNpb25FcnJvcigpOiBib29sZWFuIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0Y29uc3QgcmVnID0gY29tbWFuZHMucmVnaXN0ZXJDb21tYW5kKHRydWUsICdmb28nLCAoKTogYW55ID0+IHsgfSk7XG5cdFx0cmVnLmRpc3Bvc2UoKTtcblx0XHRyZWcuZGlzcG9zZSgpO1xuXHRcdHJlZy5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVucmVnaXN0ZXJDb3VudGVyLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnZXhlY3V0ZSB3aXRoIHJldHJ5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblxuXHRcdGNvbnN0IHNoYXBlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkQ29tbWFuZHNTaGFwZT4oKSB7XG5cdFx0XHRvdmVycmlkZSAkcmVnaXN0ZXJDb21tYW5kKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdFx0Ly9cblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGFzeW5jICRleGVjdXRlQ29tbWFuZDxUPihpZDogc3RyaW5nLCBhcmdzOiBhbnlbXSwgcmV0cnk6IGJvb2xlYW4pOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldHJ5LCBjb3VudCA9PT0gMSk7XG5cdFx0XHRcdGlmIChjb3VudCA9PT0gMSkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXRyeSwgdHJ1ZSk7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCckZXhlY3V0ZUNvbW1hbmQ6cmV0cnknKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV0cnksIGZhbHNlKTtcblx0XHRcdFx0XHRyZXR1cm4gPGFueT4xNztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBjb21tYW5kcyA9IG5ldyBFeHRIb3N0Q29tbWFuZHMoXG5cdFx0XHRTaW5nbGVQcm94eVJQQ1Byb3RvY29sKHNoYXBlKSxcblx0XHRcdG5ldyBOdWxsTG9nU2VydmljZSgpLFxuXHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRXh0SG9zdFRlbGVtZXRyeT4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIG9uRXh0ZW5zaW9uRXJyb3IoKTogYm9vbGVhbiB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBudW1iZXIgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZCgnZm9vbycsIFt0aGlzLCB0cnVlXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMTcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ29uQ29tbWFuZDphYmMgYWN0aXZhdGVzIGV4dGVuc2lvbnMgd2hlbiBleGVjdXRlZCBmcm9tIGNvbW1hbmQgcGFsZXR0ZSwgYnV0IG5vdCB3aGVuIGV4ZWN1dGVkIHByb2dyYW1tYXRpY2FsbHkgd2l0aCB2c2NvZGUuY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQgIzE1MDI5MycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGFjdGl2YXRpb25FdmVudHM6IHN0cmluZ1tdID0gW107XG5cblx0XHRjb25zdCBzaGFwZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZENvbW1hbmRzU2hhcGU+KCkge1xuXHRcdFx0b3ZlcnJpZGUgJHJlZ2lzdGVyQ29tbWFuZChpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRcdC8vXG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSAkZmlyZUNvbW1hbmRBY3RpdmF0aW9uRXZlbnQoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0XHRhY3RpdmF0aW9uRXZlbnRzLnB1c2goaWQpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgY29tbWFuZHMgPSBuZXcgRXh0SG9zdENvbW1hbmRzKFxuXHRcdFx0U2luZ2xlUHJveHlSUENQcm90b2NvbChzaGFwZSksXG5cdFx0XHRuZXcgTnVsbExvZ1NlcnZpY2UoKSxcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RUZWxlbWV0cnk+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBvbkV4dGVuc2lvbkVycm9yKCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGNvbW1hbmRzLnJlZ2lzdGVyQ29tbWFuZCh0cnVlLCAnZXh0Q21kJywgKGFyZ3M6IGFueSk6IGFueSA9PiBhcmdzKTtcblxuXHRcdGNvbnN0IHJlc3VsdDogdW5rbm93biA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kKCdleHRDbWQnLCB0aGlzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCB0aGlzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdGl2YXRpb25FdmVudHMsIFsnZXh0Q21kJ10pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsWUFBWTtBQUNyQixTQUFTLHNCQUFzQjtBQUUvQixTQUFTLCtDQUErQztBQUV4RCxNQUFNLG1CQUFtQixXQUFZO0FBQ3BDLDBDQUF3QztBQUV4QyxPQUFLLDRCQUE0QixXQUFZO0FBRTVDLFFBQUk7QUFFSixVQUFNLFFBQVEsSUFBSSxjQUFjLEtBQThCLEVBQUU7QUFBQSxNQUN0RCxpQkFBaUIsSUFBa0I7QUFBQSxNQUU1QztBQUFBLE1BQ1MsbUJBQW1CLElBQWtCO0FBQzdDLHlCQUFpQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRDtBQUVBLFVBQU0sV0FBVyxJQUFJO0FBQUEsTUFDcEIsdUJBQXVCLEtBQUs7QUFBQSxNQUM1QixJQUFJLGVBQWU7QUFBQSxNQUNuQixJQUFJLGNBQWMsS0FBd0IsRUFBRTtBQUFBLFFBQ2xDLG1CQUE0QjtBQUNwQyxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEs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
