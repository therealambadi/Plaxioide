import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { ShellIntegrationAddon } from "../../../../../../platform/terminal/common/xterm/shellIntegrationAddon.js";
import { workbenchInstantiationService } from "../../../../../test/browser/workbenchTestServices.js";
import { NullLogService } from "../../../../../../platform/log/common/log.js";
import { InitialHintAddon } from "../../browser/terminal.initialHint.contribution.js";
import { getActiveDocument } from "../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { strictEqual } from "assert";
import { ExtensionIdentifier } from "../../../../../../platform/extensions/common/extensions.js";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { ChatAgentLocation } from "../../../../chat/common/constants.js";
suite("Terminal Initial Hint Addon", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let eventCount = 0;
  let xterm;
  let initialHintAddon;
  const onDidChangeAgentsEmitter = new Emitter();
  const onDidChangeAgents = onDidChangeAgentsEmitter.event;
  const agent = {
    id: "termminal",
    name: "terminal",
    extensionId: new ExtensionIdentifier("test"),
    extensionPublisherId: "test",
    extensionDisplayName: "test",
    metadata: {},
    slashCommands: [{ name: "test", description: "test" }],
    disambiguation: [],
    locations: [ChatAgentLocation.fromRaw("terminal")],
    invoke: async () => {
      return {};
    }
  };
  const editorAgent = {
    id: "editor",
    name: "editor",
    extensionId: new ExtensionIdentifier("test-editor"),
    extensionPublisherId: "test-editor",
    extensionDisplayName: "test-editor",
    metadata: {},
    slashCommands: [{ name: "test", description: "test" }],
    locations: [ChatAgentLocation.fromRaw("editor")],
    disambiguation: [],
    invoke: async () => {
      return {};
    }
  };
  setup(async () => {
    const instantiationService = workbenchInstantiationService({}, store);
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    xterm = store.add(new TerminalCtor());
    const shellIntegrationAddon = store.add(new ShellIntegrationAddon("", true, void 0, new NullLogService()));
    initialHintAddon = store.add(instantiationService.createInstance(InitialHintAddon, shellIntegrationAddon.capabilities, onDidChangeAgents));
    store.add(initialHintAddon.onDidRequestCreateHint(() => eventCount++));
    const testContainer = document.createElement("div");
    getActiveDocument().body.append(testContainer);
    xterm.open(testContainer);
    xterm.loadAddon(shellIntegrationAddon);
    xterm.loadAddon(initialHintAddon);
  });
  suite("Chat providers", () => {
    test("hint is not shown when there are no chat providers", () => {
      eventCount = 0;
      xterm.focus();
      strictEqual(eventCount, 0);
    });
    test("hint is not shown when there is just an editor agent", () => {
      eventCount = 0;
      onDidChangeAgentsEmitter.fire(editorAgent);
      xterm.focus();
      strictEqual(eventCount, 0);
    });
    test("hint is shown when there is a terminal chat agent", () => {
      eventCount = 0;
      onDidChangeAgentsEmitter.fire(editorAgent);
      xterm.focus();
      strictEqual(eventCount, 0);
      onDidChangeAgentsEmitter.fire(agent);
      strictEqual(eventCount, 1);
    });
    test("hint is not shown again when another terminal chat agent is added if it has already shown", () => {
      eventCount = 0;
      onDidChangeAgentsEmitter.fire(agent);
      xterm.focus();
      strictEqual(eventCount, 1);
      onDidChangeAgentsEmitter.fire(agent);
      strictEqual(eventCount, 1);
    });
  });
  suite("Input", () => {
    test("hint is not shown when there has been input", () => {
      onDidChangeAgentsEmitter.fire(agent);
      xterm.writeln("data");
      setTimeout(() => {
        xterm.focus();
        strictEqual(eventCount, 0);
      }, 50);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvdGVybWluYWxJbml0aWFsSGludC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgeyBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFNoZWxsSW50ZWdyYXRpb25BZGRvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi94dGVybS9zaGVsbEludGVncmF0aW9uQWRkb24uanMnO1xuaW1wb3J0IHsgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSW5pdGlhbEhpbnRBZGRvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWwuaW5pdGlhbEhpbnQuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZURvY3VtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgc3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudCB9IGZyb20gJy4uLy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgaW1wb3J0QU1ETm9kZU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2FtZFguanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5zdWl0ZSgnVGVybWluYWwgSW5pdGlhbCBIaW50IEFkZG9uJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRsZXQgZXZlbnRDb3VudCA9IDA7XG5cdGxldCB4dGVybTogVGVybWluYWw7XG5cdGxldCBpbml0aWFsSGludEFkZG9uOiBJbml0aWFsSGludEFkZG9uO1xuXHRjb25zdCBvbkRpZENoYW5nZUFnZW50c0VtaXR0ZXI6IEVtaXR0ZXI8SUNoYXRBZ2VudCB8IHVuZGVmaW5lZD4gPSBuZXcgRW1pdHRlcigpO1xuXHRjb25zdCBvbkRpZENoYW5nZUFnZW50cyA9IG9uRGlkQ2hhbmdlQWdlbnRzRW1pdHRlci5ldmVudDtcblx0Y29uc3QgYWdlbnQ6IElDaGF0QWdlbnQgPSB7XG5cdFx0aWQ6ICd0ZXJtbWluYWwnLFxuXHRcdG5hbWU6ICd0ZXJtaW5hbCcsXG5cdFx0ZXh0ZW5zaW9uSWQ6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCd0ZXN0JyksXG5cdFx0ZXh0ZW5zaW9uUHVibGlzaGVySWQ6ICd0ZXN0Jyxcblx0XHRleHRlbnNpb25EaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdG1ldGFkYXRhOiB7fSxcblx0XHRzbGFzaENvbW1hbmRzOiBbeyBuYW1lOiAndGVzdCcsIGRlc2NyaXB0aW9uOiAndGVzdCcgfV0sXG5cdFx0ZGlzYW1iaWd1YXRpb246IFtdLFxuXHRcdGxvY2F0aW9uczogW0NoYXRBZ2VudExvY2F0aW9uLmZyb21SYXcoJ3Rlcm1pbmFsJyldLFxuXHRcdGludm9rZTogYXN5bmMgKCkgPT4geyByZXR1cm4ge307IH1cblx0fTtcblx0Y29uc3QgZWRpdG9yQWdlbnQ6IElDaGF0QWdlbnQgPSB7XG5cdFx0aWQ6ICdlZGl0b3InLFxuXHRcdG5hbWU6ICdlZGl0b3InLFxuXHRcdGV4dGVuc2lvbklkOiBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllcigndGVzdC1lZGl0b3InKSxcblx0XHRleHRlbnNpb25QdWJsaXNoZXJJZDogJ3Rlc3QtZWRpdG9yJyxcblx0XHRleHRlbnNpb25EaXNwbGF5TmFtZTogJ3Rlc3QtZWRpdG9yJyxcblx0XHRtZXRhZGF0YToge30sXG5cdFx0c2xhc2hDb21tYW5kczogW3sgbmFtZTogJ3Rlc3QnLCBkZXNjcmlwdGlvbjogJ3Rlc3QnIH1dLFxuXHRcdGxvY2F0aW9uczogW0NoYXRBZ2VudExvY2F0aW9uLmZyb21SYXcoJ2VkaXRvcicpXSxcblx0XHRkaXNhbWJpZ3VhdGlvbjogW10sXG5cdFx0aW52b2tlOiBhc3luYyAoKSA9PiB7IHJldHVybiB7fTsgfVxuXHR9O1xuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh7fSwgc3RvcmUpO1xuXHRcdGNvbnN0IFRlcm1pbmFsQ3RvciA9IChhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0B4dGVybS94dGVybScpPignQHh0ZXJtL3h0ZXJtJywgJ2xpYi94dGVybS5qcycpKS5UZXJtaW5hbDtcblx0XHR4dGVybSA9IHN0b3JlLmFkZChuZXcgVGVybWluYWxDdG9yKCkpO1xuXHRcdGNvbnN0IHNoZWxsSW50ZWdyYXRpb25BZGRvbiA9IHN0b3JlLmFkZChuZXcgU2hlbGxJbnRlZ3JhdGlvbkFkZG9uKCcnLCB0cnVlLCB1bmRlZmluZWQsIG5ldyBOdWxsTG9nU2VydmljZSkpO1xuXHRcdGluaXRpYWxIaW50QWRkb24gPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5pdGlhbEhpbnRBZGRvbiwgc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmNhcGFiaWxpdGllcywgb25EaWRDaGFuZ2VBZ2VudHMpKTtcblx0XHRzdG9yZS5hZGQoaW5pdGlhbEhpbnRBZGRvbi5vbkRpZFJlcXVlc3RDcmVhdGVIaW50KCgpID0+IGV2ZW50Q291bnQrKykpO1xuXHRcdGNvbnN0IHRlc3RDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRnZXRBY3RpdmVEb2N1bWVudCgpLmJvZHkuYXBwZW5kKHRlc3RDb250YWluZXIpO1xuXHRcdHh0ZXJtLm9wZW4odGVzdENvbnRhaW5lcik7XG5cblx0XHR4dGVybS5sb2FkQWRkb24oc2hlbGxJbnRlZ3JhdGlvbkFkZG9uKTtcblx0XHR4dGVybS5sb2FkQWRkb24oaW5pdGlhbEhpbnRBZGRvbik7XG5cdH0pO1xuXG5cdHN1aXRlKCdDaGF0IHByb3ZpZGVycycsICgpID0+IHtcblx0XHR0ZXN0KCdoaW50IGlzIG5vdCBzaG93biB3aGVuIHRoZXJlIGFyZSBubyBjaGF0IHByb3ZpZGVycycsICgpID0+IHtcblx0XHRcdGV2ZW50Q291bnQgPSAwO1xuXHRcdFx0eHRlcm0uZm9jdXMoKTtcblx0XHRcdHN0cmljdEVxdWFsKGV2ZW50Q291bnQsIDApO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ2hpbnQgaXMgbm90IHNob3duIHdoZW4gdGhlcmUgaXMganVzdCBhbiBlZGl0b3IgYWdlbnQnLCAoKSA9PiB7XG5cdFx0XHRldmVudENvdW50ID0gMDtcblx0XHRcdG9uRGlkQ2hhbmdlQWdlbnRzRW1pdHRlci5maXJlKGVkaXRvckFnZW50KTtcblx0XHRcdHh0ZXJtLmZvY3VzKCk7XG5cdFx0XHRzdHJpY3RFcXVhbChldmVudENvdW50LCAwKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdoaW50IGlzIHNob3duIHdoZW4gdGhlcmUgaXMgYSB0ZXJtaW5hbCBjaGF0IGFnZW50JywgKCkgPT4ge1xuXHRcdFx0ZXZlbnRDb3VudCA9IDA7XG5cdFx0XHRvbkRpZENoYW5nZUFnZW50c0VtaXR0ZXIuZmlyZShlZGl0b3JBZ2VudCk7XG5cdFx0XHR4dGVybS5mb2N1cygpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMCk7XG5cdFx0XHRvbkRpZENoYW5nZUFnZW50c0VtaXR0ZXIuZmlyZShhZ2VudCk7XG5cdFx0XHRzdHJpY3RFcXVhbChldmVudENvdW50LCAxKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdoaW50IGlzIG5vdCBzaG93biBhZ2FpbiB3aGVuIGFub3RoZXIgdGVybWluYWwgY2hhdCBhZ2VudCBpcyBhZGRlZCBpZiBpdCBoYXMgYWxyZWFkeSBzaG93bicsICgpID0+IHtcblx0XHRcdGV2ZW50Q291bnQgPSAwO1xuXHRcdFx0b25EaWRDaGFuZ2VBZ2VudHNFbWl0dGVyLmZpcmUoYWdlbnQpO1xuXHRcdFx0eHRlcm0uZm9jdXMoKTtcblx0XHRcdHN0cmljdEVxdWFsKGV2ZW50Q291bnQsIDEpO1xuXHRcdFx0b25EaWRDaGFuZ2VBZ2VudHNFbWl0dGVyLmZpcmUoYWdlbnQpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnSW5wdXQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnaGludCBpcyBub3Qgc2hvd24gd2hlbiB0aGVyZSBoYXMgYmVlbiBpbnB1dCcsICgpID0+IHtcblx0XHRcdG9uRGlkQ2hhbmdlQWdlbnRzRW1pdHRlci5maXJlKGFnZW50KTtcblx0XHRcdHh0ZXJtLndyaXRlbG4oJ2RhdGEnKTtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR4dGVybS5mb2N1cygpO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChldmVudENvdW50LCAwKTtcblx0XHRcdH0sIDUwKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBZTtBQUN4QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUVsQyxNQUFNLCtCQUErQixNQUFNO0FBQzFDLFFBQU0sUUFBUSx3Q0FBd0M7QUFDdEQsTUFBSSxhQUFhO0FBQ2pCLE1BQUk7QUFDSixNQUFJO0FBQ0osUUFBTSwyQkFBNEQsSUFBSSxRQUFRO0FBQzlFLFFBQU0sb0JBQW9CLHlCQUF5QjtBQUNuRCxRQUFNLFFBQW9CO0FBQUEsSUFDekIsSUFBSTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sYUFBYSxJQUFJLG9CQUFvQixNQUFNO0FBQUEsSUFDM0Msc0JBQXNCO0FBQUEsSUFDdEIsc0JBQXNCO0FBQUEsSUFDdEIsVUFBVSxDQUFDO0FBQUEsSUFDWCxl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
