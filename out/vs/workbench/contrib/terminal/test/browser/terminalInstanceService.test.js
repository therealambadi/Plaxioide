import { deepStrictEqual } from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { TerminalInstanceService } from "../../browser/terminalInstanceService.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("Workbench - TerminalInstanceService", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let terminalInstanceService;
  setup(async () => {
    const instantiationService = workbenchInstantiationService(void 0, store);
    terminalInstanceService = store.add(instantiationService.createInstance(TerminalInstanceService));
  });
  suite("convertProfileToShellLaunchConfig", () => {
    test("should return an empty shell launch config when undefined is provided", () => {
      deepStrictEqual(terminalInstanceService.convertProfileToShellLaunchConfig(), {});
      deepStrictEqual(terminalInstanceService.convertProfileToShellLaunchConfig(void 0), {});
    });
    test("should return the same shell launch config when provided", () => {
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({}),
        {}
      );
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({ executable: "/foo" }),
        { executable: "/foo" }
      );
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({ executable: "/foo", cwd: "/bar", args: ["a", "b"] }),
        { executable: "/foo", cwd: "/bar", args: ["a", "b"] }
      );
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({ executable: "/foo" }, "/bar"),
        { executable: "/foo", cwd: "/bar" }
      );
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({ executable: "/foo", cwd: "/bar" }, "/baz"),
        { executable: "/foo", cwd: "/baz" }
      );
    });
    test("should convert a provided profile to a shell launch config", () => {
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({
          profileName: "abc",
          path: "/foo",
          isDefault: true
        }),
        {
          args: void 0,
          color: void 0,
          cwd: void 0,
          env: void 0,
          executable: "/foo",
          icon: void 0,
          name: void 0
        }
      );
      const icon = URI.file("/icon");
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({
          profileName: "abc",
          path: "/foo",
          isDefault: true,
          args: ["a", "b"],
          color: "color",
          env: { test: "TEST" },
          icon
        }, "/bar"),
        {
          args: ["a", "b"],
          color: "color",
          cwd: "/bar",
          env: { test: "TEST" },
          executable: "/foo",
          icon,
          name: void 0
        }
      );
    });
    test("should respect overrideName in profile", () => {
      deepStrictEqual(
        terminalInstanceService.convertProfileToShellLaunchConfig({
          profileName: "abc",
          path: "/foo",
          isDefault: true,
          overrideName: true
        }),
        {
          args: void 0,
          color: void 0,
          cwd: void 0,
          env: void 0,
          executable: "/foo",
          icon: void 0,
          name: "abc"
        }
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxJbnN0YW5jZVNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxQcm9maWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEluc3RhbmNlU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxJbnN0YW5jZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5cbnN1aXRlKCdXb3JrYmVuY2ggLSBUZXJtaW5hbEluc3RhbmNlU2VydmljZScsICgpID0+IHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgdGVybWluYWxJbnN0YW5jZVNlcnZpY2U6IElUZXJtaW5hbEluc3RhbmNlU2VydmljZTtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKTtcblx0XHR0ZXJtaW5hbEluc3RhbmNlU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbEluc3RhbmNlU2VydmljZSkpO1xuXHR9KTtcblxuXHRzdWl0ZSgnY29udmVydFByb2ZpbGVUb1NoZWxsTGF1bmNoQ29uZmlnJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gYW4gZW1wdHkgc2hlbGwgbGF1bmNoIGNvbmZpZyB3aGVuIHVuZGVmaW5lZCBpcyBwcm92aWRlZCcsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbCh0ZXJtaW5hbEluc3RhbmNlU2VydmljZS5jb252ZXJ0UHJvZmlsZVRvU2hlbGxMYXVuY2hDb25maWcoKSwge30pO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNvbnZlcnRQcm9maWxlVG9TaGVsbExhdW5jaENvbmZpZyh1bmRlZmluZWQpLCB7fSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiB0aGUgc2FtZSBzaGVsbCBsYXVuY2ggY29uZmlnIHdoZW4gcHJvdmlkZWQnLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNvbnZlcnRQcm9maWxlVG9TaGVsbExhdW5jaENvbmZpZyh7fSksXG5cdFx0XHRcdHt9XG5cdFx0XHQpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHR0ZXJtaW5hbEluc3RhbmNlU2VydmljZS5jb252ZXJ0UHJvZmlsZVRvU2hlbGxMYXVuY2hDb25maWcoeyBleGVjdXRhYmxlOiAnL2ZvbycgfSksXG5cdFx0XHRcdHsgZXhlY3V0YWJsZTogJy9mb28nIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNvbnZlcnRQcm9maWxlVG9TaGVsbExhdW5jaENvbmZpZyh7IGV4ZWN1dGFibGU6ICcvZm9vJywgY3dkOiAnL2JhcicsIGFyZ3M6IFsnYScsICdiJ10gfSksXG5cdFx0XHRcdHsgZXhlY3V0YWJsZTogJy9mb28nLCBjd2Q6ICcvYmFyJywgYXJnczogWydhJywgJ2InXSB9XG5cdFx0XHQpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHR0ZXJtaW5hbEluc3RhbmNlU2VydmljZS5jb252ZXJ0UHJvZmlsZVRvU2hlbGxMYXVuY2hDb25maWcoeyBleGVjdXRhYmxlOiAnL2ZvbycgfSwgJy9iYXInKSxcblx0XHRcdFx0eyBleGVjdXRhYmxlOiAnL2ZvbycsIGN3ZDogJy9iYXInIH1cblx0XHRcdCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNvbnZlcnRQcm9maWxlVG9TaGVsbExhdW5jaENvbmZpZyh7IGV4ZWN1dGFibGU6ICcvZm9vJywgY3dkOiAnL2JhcicgfSwgJy9iYXonKSxcblx0XHRcdFx0eyBleGVjdXRhYmxlOiAnL2ZvbycsIGN3ZDogJy9iYXonIH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGNvbnZlcnQgYSBwcm92aWRlZCBwcm9maWxlIHRvIGEgc2hlbGwgbGF1bmNoIGNvbmZpZycsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0dGVybWluYWxJbnN0YW5jZVNlcnZpY2UuY29udmVydFByb2ZpbGVUb1NoZWxsTGF1bmNoQ29uZmlnKHtcblx0XHRcdFx0XHRwcm9maWxlTmFtZTogJ2FiYycsXG5cdFx0XHRcdFx0cGF0aDogJy9mb28nLFxuXHRcdFx0XHRcdGlzRGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHR9KSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGFyZ3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRjb2xvcjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGN3ZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGVudjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGV4ZWN1dGFibGU6ICcvZm9vJyxcblx0XHRcdFx0XHRpY29uOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0bmFtZTogdW5kZWZpbmVkXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHRjb25zdCBpY29uID0gVVJJLmZpbGUoJy9pY29uJyk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNvbnZlcnRQcm9maWxlVG9TaGVsbExhdW5jaENvbmZpZyh7XG5cdFx0XHRcdFx0cHJvZmlsZU5hbWU6ICdhYmMnLFxuXHRcdFx0XHRcdHBhdGg6ICcvZm9vJyxcblx0XHRcdFx0XHRpc0RlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0YXJnczogWydhJywgJ2InXSxcblx0XHRcdFx0XHRjb2xvcjogJ2NvbG9yJyxcblx0XHRcdFx0XHRlbnY6IHsgdGVzdDogJ1RFU1QnIH0sXG5cdFx0XHRcdFx0aWNvblxuXHRcdFx0XHR9IGFzIElUZXJtaW5hbFByb2ZpbGUsICcvYmFyJyksXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRhcmdzOiBbJ2EnLCAnYiddLFxuXHRcdFx0XHRcdGNvbG9yOiAnY29sb3InLFxuXHRcdFx0XHRcdGN3ZDogJy9iYXInLFxuXHRcdFx0XHRcdGVudjogeyB0ZXN0OiAnVEVTVCcgfSxcblx0XHRcdFx0XHRleGVjdXRhYmxlOiAnL2ZvbycsXG5cdFx0XHRcdFx0aWNvbixcblx0XHRcdFx0XHRuYW1lOiB1bmRlZmluZWRcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmVzcGVjdCBvdmVycmlkZU5hbWUgaW4gcHJvZmlsZScsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0dGVybWluYWxJbnN0YW5jZVNlcnZpY2UuY29udmVydFByb2ZpbGVUb1NoZWxsTGF1bmNoQ29uZmlnKHtcblx0XHRcdFx0XHRwcm9maWxlTmFtZTogJ2FiYycsXG5cdFx0XHRcdFx0cGF0aDogJy9mb28nLFxuXHRcdFx0XHRcdGlzRGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRvdmVycmlkZU5hbWU6IHRydWVcblx0XHRcdFx0fSksXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRhcmdzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0Y29sb3I6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRjd2Q6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRlbnY6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRleGVjdXRhYmxlOiAnL2ZvbycsXG5cdFx0XHRcdFx0aWNvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdG5hbWU6ICdhYmMnXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFHeEQsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxxQ0FBcUM7QUFFOUMsTUFBTSx1Q0FBdUMsTUFBTTtBQUNsRCxRQUFNLFFBQVEsd0NBQXdDO0FBRXRELE1BQUk7QUFFSixRQUFNLFlBQVk7QUFDakIsVUFBTSx1QkFBdUIsOEJBQThCLFFBQVcsS0FBSztBQUMzRSw4QkFBMEIsTUFBTSxJQUFJLHFCQUFxQixlQUFlLHVCQUF1QixDQUFDO0FBQUEsRUFDakcsQ0FBQztBQUVELFFBQU0scUNBQXFDLE1BQU07QUFDaEQsU0FBSyx5RUFBeUUsTUFBTTtBQUNuRixzQkFBZ0Isd0JBQXdCLGtDQUFrQyxHQUFHLENBQUMsQ0FBQztBQUMvRSxzQkFBZ0Isd0JBQXdCLGtDQUFrQyxNQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQUEsSUFDekYsQ0FBQztBQUNELFNBQUssNERBQTRELE1BQU07QUFDdEU7QUFBQSxRQUNDLHdCQUF3QixrQ0FBa0MsQ0FBQyxDQUFDO0FBQUEsUUFDNUQsQ0FBQztBQUFBLE1BQ0Y7QUFDQTtBQUFBLFFBQ0Msd0JBQXdCLGtDQUFrQyxFQUFFLFlBQVksT0FBTyxDQUFDO0FBQUEsUUFDaEYsRUFBRSxZQUFZLE9BQU87QUFBQSxNQUN0QjtBQUNBO0FBQUEsUUFDQyx3QkFBd0Isa0NBQWtDLEVBQUUsWUFBWSxRQUFRLEtBQUssUUFBUSxNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUFBLFFBQy9HLEVBQUUsWUFBWSxRQUFRLEtBQUssUUFBUSxNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUU7QUFBQSxNQUNyRDtBQUNBO0FBQUEsUUFDQyx3QkFBd0Isa0NBQWtDLEVBQUUsWUFBWSxPQUFPLEdBQUcsTUFBTTtBQUFBLFFBQ3hGLEVBQUUsWUFBWSxRQUFRLEtBQUssT0FBTztBQUFBLE1BQ25DO0FBQ0E7QUFBQSxRQUNDLHdCQUF3QixrQ0FBa0MsRUFBRSxZQUFZLFFBQVEsS0FBSyxPQUFPLEdBQUcsTUFBTTtBQUFBLFFBQ3JHLEVBQUUsWUFBWSxRQUFRLEtBQUssT0FBTztBQUFBLE1BQ25DO0FBQUEsSUFDRCxDQUFDO0FBQ0QsU0FBSyw4REFBOEQsTUFBTTtBQUN4RTtBQUFBLFFBQ0Msd0JBQXdCLGtDQUFrQztBQUFBLFVBQ3pELGFBQWE7QUFBQSxVQUNiLE1BQU07QUFBQSxVQUNOLFdBQVc7QUFBQSxRQUNaLENBQUM7QUFBQSxRQUNEO0FBQUEsVUFDQyxNQUFNO0FBQUEsVUFDTixPQUFPO0FBQUEsVUFDUCxLQUFLO0FBQUEsVUFDTCxLQUFLO0FBQUEsVUFDTCxZQUFZO0FBQUEsVUFDWixNQUFNO0FBQUEsVUFDTixNQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFDQSxZQUFNLE9BQU8sSUFBSSxLQUFLLE9BQU87QUFDN0I7QUFBQSxRQUNDLHdCQUF3QixrQ0FBa0M7QUFBQSxVQUN6RCxhQUFhO0FBQUEsVUFDYixNQUFNO0FBQUEsVUFDTixXQUFXO0FBQUEsVUFDWCxNQUFNLENBQUMsS0FBSyxHQUFHO0FBQUEsVUFDZixPQUFPO0FBQUEsVUFDUCxLQUFLLEVBQUUsTUFBTSxPQUFPO0FBQUEsVUFDcEI7QUFBQSxRQUNELEdBQXVCLE1BQU07QUFBQSxRQUM3QjtBQUFBLFVBQ0MsTUFBTSxDQUFDLEtBQUssR0FBRztBQUFBLFVBQ2YsT0FBTztBQUFBLFVBQ1AsS0FBSztBQUFBLFVBQ0wsS0FBSyxFQUFFLE1BQU0sT0FBTztBQUFBLFVBQ3BCLFlBQVk7QUFBQSxVQUNaO0FBQUEsVUFDQSxNQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCxTQUFLLDBDQUEwQyxNQUFNO0FBQ3BEO0FBQUEsUUFDQyx3QkFBd0Isa0NBQWtDO0FBQUEsVUFDekQsYUFBYTtBQUFBLFVBQ2IsTUFBTTtBQUFBLFVBQ04sV0FBVztBQUFBLFVBQ1gsY0FBYztBQUFBLFFBQ2YsQ0FBQztBQUFBLFFBQ0Q7QUFBQSxVQUNDLE1BQU07QUFBQSxVQUNOLE9BQU87QUFBQSxVQUNQLEtBQUs7QUFBQSxVQUNMLEtBQUs7QUFBQSxVQUNMLFlBQVk7QUFBQSxVQUNaLE1BQU07QUFBQSxVQUNOLE1BQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
