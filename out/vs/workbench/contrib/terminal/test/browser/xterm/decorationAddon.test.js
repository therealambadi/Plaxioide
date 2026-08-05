import { notEqual, strictEqual, throws } from "assert";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TerminalCapability } from "../../../../../../platform/terminal/common/capabilities/capabilities.js";
import { CommandDetectionCapability } from "../../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js";
import { TerminalCapabilityStore } from "../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { DecorationAddon } from "../../../browser/xterm/decorationAddon.js";
import { workbenchInstantiationService } from "../../../../../test/browser/workbenchTestServices.js";
suite("DecorationAddon", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let decorationAddon;
  let xterm;
  setup(async () => {
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    class TestTerminal extends TerminalCtor {
      registerDecoration(decorationOptions) {
        if (decorationOptions.marker.isDisposed) {
          return void 0;
        }
        const element = document.createElement("div");
        return { marker: decorationOptions.marker, element, onDispose: () => {
        }, isDisposed: false, dispose: () => {
        }, onRender: (element2) => {
          return element2;
        } };
      }
    }
    const instantiationService = workbenchInstantiationService({
      configurationService: () => new TestConfigurationService({
        files: {},
        workbench: {
          hover: { delay: 5 }
        },
        terminal: {
          integrated: {
            shellIntegration: {
              decorationsEnabled: "both"
            }
          }
        }
      })
    }, store);
    xterm = store.add(new TestTerminal({
      allowProposedApi: true,
      cols: 80,
      rows: 30
    }));
    const capabilities = store.add(new TerminalCapabilityStore());
    capabilities.add(TerminalCapability.CommandDetection, store.add(instantiationService.createInstance(CommandDetectionCapability, xterm)));
    decorationAddon = store.add(instantiationService.createInstance(DecorationAddon, capabilities));
    xterm.loadAddon(decorationAddon);
  });
  suite("registerDecoration", () => {
    test("should throw when command has no marker", async () => {
      throws(() => decorationAddon.registerCommandDecoration({ command: "cd src", timestamp: Date.now(), hasOutput: () => false }));
    });
    test("should return undefined when marker has been disposed of", async () => {
      const marker = xterm.registerMarker(1);
      marker?.dispose();
      strictEqual(decorationAddon.registerCommandDecoration({ command: "cd src", marker, timestamp: Date.now(), hasOutput: () => false }), void 0);
    });
    test("should return decoration when marker has not been disposed of", async () => {
      const marker = xterm.registerMarker(2);
      notEqual(decorationAddon.registerCommandDecoration({ command: "cd src", marker, timestamp: Date.now(), hasOutput: () => false }), void 0);
    });
    test("should return decoration with mark properties", async () => {
      const marker = xterm.registerMarker(2);
      notEqual(decorationAddon.registerCommandDecoration(void 0, void 0, { marker }), void 0);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIveHRlcm0vZGVjb3JhdGlvbkFkZG9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSB7IElEZWNvcmF0aW9uLCBJRGVjb3JhdGlvbk9wdGlvbnMsIFRlcm1pbmFsIGFzIFJhd1h0ZXJtVGVybWluYWwgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgbm90RXF1YWwsIHN0cmljdEVxdWFsLCB0aHJvd3MgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaW1wb3J0QU1ETm9kZU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2FtZFguanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb21tYW5kLCBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL3Rlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLmpzJztcbmltcG9ydCB7IERlY29yYXRpb25BZGRvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIveHRlcm0vZGVjb3JhdGlvbkFkZG9uLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5cbnN1aXRlKCdEZWNvcmF0aW9uQWRkb24nLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGRlY29yYXRpb25BZGRvbjogRGVjb3JhdGlvbkFkZG9uO1xuXHRsZXQgeHRlcm06IFJhd1h0ZXJtVGVybWluYWw7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFRlcm1pbmFsQ3RvciA9IChhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0B4dGVybS94dGVybScpPignQHh0ZXJtL3h0ZXJtJywgJ2xpYi94dGVybS5qcycpKS5UZXJtaW5hbDtcblx0XHRjbGFzcyBUZXN0VGVybWluYWwgZXh0ZW5kcyBUZXJtaW5hbEN0b3Ige1xuXHRcdFx0b3ZlcnJpZGUgcmVnaXN0ZXJEZWNvcmF0aW9uKGRlY29yYXRpb25PcHRpb25zOiBJRGVjb3JhdGlvbk9wdGlvbnMpOiBJRGVjb3JhdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdGlmIChkZWNvcmF0aW9uT3B0aW9ucy5tYXJrZXIuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRyZXR1cm4geyBtYXJrZXI6IGRlY29yYXRpb25PcHRpb25zLm1hcmtlciwgZWxlbWVudCwgb25EaXNwb3NlOiAoKSA9PiB7IH0sIGlzRGlzcG9zZWQ6IGZhbHNlLCBkaXNwb3NlOiAoKSA9PiB7IH0sIG9uUmVuZGVyOiAoZWxlbWVudDogSFRNTEVsZW1lbnQpID0+IHsgcmV0dXJuIGVsZW1lbnQ7IH0gfSBhcyB1bmtub3duIGFzIElEZWNvcmF0aW9uO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2Uoe1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6ICgpID0+IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHRmaWxlczoge30sXG5cdFx0XHRcdHdvcmtiZW5jaDoge1xuXHRcdFx0XHRcdGhvdmVyOiB7IGRlbGF5OiA1IH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdFx0c2hlbGxJbnRlZ3JhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9uc0VuYWJsZWQ6ICdib3RoJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHR9LCBzdG9yZSk7XG5cdFx0eHRlcm0gPSBzdG9yZS5hZGQobmV3IFRlc3RUZXJtaW5hbCh7XG5cdFx0XHRhbGxvd1Byb3Bvc2VkQXBpOiB0cnVlLFxuXHRcdFx0Y29sczogODAsXG5cdFx0XHRyb3dzOiAzMFxuXHRcdH0pKTtcblx0XHRjb25zdCBjYXBhYmlsaXRpZXMgPSBzdG9yZS5hZGQobmV3IFRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlKCkpO1xuXHRcdGNhcGFiaWxpdGllcy5hZGQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24sIHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSwgeHRlcm0pKSk7XG5cdFx0ZGVjb3JhdGlvbkFkZG9uID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlY29yYXRpb25BZGRvbiwgY2FwYWJpbGl0aWVzKSk7XG5cdFx0eHRlcm0ubG9hZEFkZG9uKGRlY29yYXRpb25BZGRvbik7XG5cdH0pO1xuXG5cdHN1aXRlKCdyZWdpc3RlckRlY29yYXRpb24nLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHRocm93IHdoZW4gY29tbWFuZCBoYXMgbm8gbWFya2VyJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhyb3dzKCgpID0+IGRlY29yYXRpb25BZGRvbi5yZWdpc3RlckNvbW1hbmREZWNvcmF0aW9uKHsgY29tbWFuZDogJ2NkIHNyYycsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSwgaGFzT3V0cHV0OiAoKSA9PiBmYWxzZSB9IGFzIElUZXJtaW5hbENvbW1hbmQpKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmV0dXJuIHVuZGVmaW5lZCB3aGVuIG1hcmtlciBoYXMgYmVlbiBkaXNwb3NlZCBvZicsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IG1hcmtlciA9IHh0ZXJtLnJlZ2lzdGVyTWFya2VyKDEpO1xuXHRcdFx0bWFya2VyPy5kaXNwb3NlKCk7XG5cdFx0XHRzdHJpY3RFcXVhbChkZWNvcmF0aW9uQWRkb24ucmVnaXN0ZXJDb21tYW5kRGVjb3JhdGlvbih7IGNvbW1hbmQ6ICdjZCBzcmMnLCBtYXJrZXIsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSwgaGFzT3V0cHV0OiAoKSA9PiBmYWxzZSB9IGFzIElUZXJtaW5hbENvbW1hbmQpLCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gZGVjb3JhdGlvbiB3aGVuIG1hcmtlciBoYXMgbm90IGJlZW4gZGlzcG9zZWQgb2YnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtYXJrZXIgPSB4dGVybS5yZWdpc3Rlck1hcmtlcigyKTtcblx0XHRcdG5vdEVxdWFsKGRlY29yYXRpb25BZGRvbi5yZWdpc3RlckNvbW1hbmREZWNvcmF0aW9uKHsgY29tbWFuZDogJ2NkIHNyYycsIG1hcmtlciwgdGltZXN0YW1wOiBEYXRlLm5vdygpLCBoYXNPdXRwdXQ6ICgpID0+IGZhbHNlIH0gYXMgSVRlcm1pbmFsQ29tbWFuZCksIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiBkZWNvcmF0aW9uIHdpdGggbWFyayBwcm9wZXJ0aWVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWFya2VyID0geHRlcm0ucmVnaXN0ZXJNYXJrZXIoMik7XG5cdFx0XHRub3RFcXVhbChkZWNvcmF0aW9uQWRkb24ucmVnaXN0ZXJDb21tYW5kRGVjb3JhdGlvbih1bmRlZmluZWQsIHVuZGVmaW5lZCwgeyBtYXJrZXIgfSksIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLFVBQVUsYUFBYSxjQUFjO0FBQzlDLFNBQVMsMkJBQTJC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
