import { deepStrictEqual, strictEqual } from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { getInstanceFromResource, getTerminalResourcesFromDragEvent, getTerminalUri } from "../../browser/terminalUri.js";
function fakeDragEvent(data) {
  return {
    dataTransfer: {
      getData: () => {
        return data;
      }
    }
  };
}
suite("terminalUri", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("getTerminalResourcesFromDragEvent", () => {
    test("should give undefined when no terminal resources is in event", () => {
      deepStrictEqual(
        getTerminalResourcesFromDragEvent(fakeDragEvent(""))?.map((e) => e.toString()),
        void 0
      );
    });
    test("should give undefined when an empty terminal resources array is in event", () => {
      deepStrictEqual(
        getTerminalResourcesFromDragEvent(fakeDragEvent("[]"))?.map((e) => e.toString()),
        void 0
      );
    });
    test("should return terminal resource when event contains one", () => {
      deepStrictEqual(
        getTerminalResourcesFromDragEvent(fakeDragEvent('["vscode-terminal:/1626874386474/3"]'))?.map((e) => e.toString()),
        ["vscode-terminal:/1626874386474/3"]
      );
    });
    test("should return multiple terminal resources when event contains multiple", () => {
      deepStrictEqual(
        getTerminalResourcesFromDragEvent(fakeDragEvent('["vscode-terminal:/foo/1","vscode-terminal:/bar/2"]'))?.map((e) => e.toString()),
        ["vscode-terminal:/foo/1", "vscode-terminal:/bar/2"]
      );
    });
  });
  suite("getInstanceFromResource", () => {
    test("should return undefined if there is no match", () => {
      strictEqual(
        getInstanceFromResource([
          { resource: getTerminalUri("workspace", 2, "title") }
        ], getTerminalUri("workspace", 1)),
        void 0
      );
    });
    test("should return a result if there is a match", () => {
      const instance = { resource: getTerminalUri("workspace", 2, "title") };
      strictEqual(
        getInstanceFromResource([
          { resource: getTerminalUri("workspace", 1, "title") },
          instance,
          { resource: getTerminalUri("workspace", 3, "title") }
        ], getTerminalUri("workspace", 2)),
        instance
      );
    });
    test("should ignore the fragment", () => {
      const instance = { resource: getTerminalUri("workspace", 2, "title") };
      strictEqual(
        getInstanceFromResource([
          { resource: getTerminalUri("workspace", 1, "title") },
          instance,
          { resource: getTerminalUri("workspace", 3, "title") }
        ], getTerminalUri("workspace", 2, "does not match!")),
        instance
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxVcmkudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCwgc3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBnZXRJbnN0YW5jZUZyb21SZXNvdXJjZSwgZ2V0VGVybWluYWxSZXNvdXJjZXNGcm9tRHJhZ0V2ZW50LCBnZXRUZXJtaW5hbFVyaSwgSVBhcnRpYWxEcmFnRXZlbnQgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsVXJpLmpzJztcblxuZnVuY3Rpb24gZmFrZURyYWdFdmVudChkYXRhOiBzdHJpbmcpOiBJUGFydGlhbERyYWdFdmVudCB7XG5cdHJldHVybiB7XG5cdFx0ZGF0YVRyYW5zZmVyOiB7XG5cdFx0XHRnZXREYXRhOiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBkYXRhO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn1cblxuc3VpdGUoJ3Rlcm1pbmFsVXJpJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnZ2V0VGVybWluYWxSZXNvdXJjZXNGcm9tRHJhZ0V2ZW50JywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBnaXZlIHVuZGVmaW5lZCB3aGVuIG5vIHRlcm1pbmFsIHJlc291cmNlcyBpcyBpbiBldmVudCcsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0VGVybWluYWxSZXNvdXJjZXNGcm9tRHJhZ0V2ZW50KGZha2VEcmFnRXZlbnQoJycpKT8ubWFwKGUgPT4gZS50b1N0cmluZygpKSxcblx0XHRcdFx0dW5kZWZpbmVkXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBnaXZlIHVuZGVmaW5lZCB3aGVuIGFuIGVtcHR5IHRlcm1pbmFsIHJlc291cmNlcyBhcnJheSBpcyBpbiBldmVudCcsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0VGVybWluYWxSZXNvdXJjZXNGcm9tRHJhZ0V2ZW50KGZha2VEcmFnRXZlbnQoJ1tdJykpPy5tYXAoZSA9PiBlLnRvU3RyaW5nKCkpLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiB0ZXJtaW5hbCByZXNvdXJjZSB3aGVuIGV2ZW50IGNvbnRhaW5zIG9uZScsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0VGVybWluYWxSZXNvdXJjZXNGcm9tRHJhZ0V2ZW50KGZha2VEcmFnRXZlbnQoJ1tcInZzY29kZS10ZXJtaW5hbDovMTYyNjg3NDM4NjQ3NC8zXCJdJykpPy5tYXAoZSA9PiBlLnRvU3RyaW5nKCkpLFxuXHRcdFx0XHRbJ3ZzY29kZS10ZXJtaW5hbDovMTYyNjg3NDM4NjQ3NC8zJ11cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiBtdWx0aXBsZSB0ZXJtaW5hbCByZXNvdXJjZXMgd2hlbiBldmVudCBjb250YWlucyBtdWx0aXBsZScsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0VGVybWluYWxSZXNvdXJjZXNGcm9tRHJhZ0V2ZW50KGZha2VEcmFnRXZlbnQoJ1tcInZzY29kZS10ZXJtaW5hbDovZm9vLzFcIixcInZzY29kZS10ZXJtaW5hbDovYmFyLzJcIl0nKSk/Lm1hcChlID0+IGUudG9TdHJpbmcoKSksXG5cdFx0XHRcdFsndnNjb2RlLXRlcm1pbmFsOi9mb28vMScsICd2c2NvZGUtdGVybWluYWw6L2Jhci8yJ11cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnZ2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiB1bmRlZmluZWQgaWYgdGhlcmUgaXMgbm8gbWF0Y2gnLCAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UoW1xuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IGdldFRlcm1pbmFsVXJpKCd3b3Jrc3BhY2UnLCAyLCAndGl0bGUnKSB9XG5cdFx0XHRcdF0sIGdldFRlcm1pbmFsVXJpKCd3b3Jrc3BhY2UnLCAxKSksXG5cdFx0XHRcdHVuZGVmaW5lZFxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmV0dXJuIGEgcmVzdWx0IGlmIHRoZXJlIGlzIGEgbWF0Y2gnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IHsgcmVzb3VyY2U6IGdldFRlcm1pbmFsVXJpKCd3b3Jrc3BhY2UnLCAyLCAndGl0bGUnKSB9O1xuXHRcdFx0c3RyaWN0RXF1YWwoXG5cdFx0XHRcdGdldEluc3RhbmNlRnJvbVJlc291cmNlKFtcblx0XHRcdFx0XHR7IHJlc291cmNlOiBnZXRUZXJtaW5hbFVyaSgnd29ya3NwYWNlJywgMSwgJ3RpdGxlJykgfSxcblx0XHRcdFx0XHRpbnN0YW5jZSxcblx0XHRcdFx0XHR7IHJlc291cmNlOiBnZXRUZXJtaW5hbFVyaSgnd29ya3NwYWNlJywgMywgJ3RpdGxlJykgfVxuXHRcdFx0XHRdLCBnZXRUZXJtaW5hbFVyaSgnd29ya3NwYWNlJywgMikpLFxuXHRcdFx0XHRpbnN0YW5jZVxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgaWdub3JlIHRoZSBmcmFnbWVudCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGluc3RhbmNlID0geyByZXNvdXJjZTogZ2V0VGVybWluYWxVcmkoJ3dvcmtzcGFjZScsIDIsICd0aXRsZScpIH07XG5cdFx0XHRzdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UoW1xuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IGdldFRlcm1pbmFsVXJpKCd3b3Jrc3BhY2UnLCAxLCAndGl0bGUnKSB9LFxuXHRcdFx0XHRcdGluc3RhbmNlLFxuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IGdldFRlcm1pbmFsVXJpKCd3b3Jrc3BhY2UnLCAzLCAndGl0bGUnKSB9XG5cdFx0XHRcdF0sIGdldFRlcm1pbmFsVXJpKCd3b3Jrc3BhY2UnLCAyLCAnZG9lcyBub3QgbWF0Y2ghJykpLFxuXHRcdFx0XHRpbnN0YW5jZVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsaUJBQWlCLG1CQUFtQjtBQUM3QyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHlCQUF5QixtQ0FBbUMsc0JBQXlDO0FBRTlHLFNBQVMsY0FBYyxNQUFpQztBQUN2RCxTQUFPO0FBQUEsSUFDTixjQUFjO0FBQUEsTUFDYixTQUFTLE1BQU07QUFDZCxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxNQUFNLGVBQWUsTUFBTTtBQUMxQiwwQ0FBd0M7QUFFeEMsUUFBTSxxQ0FBcUMsTUFBTTtBQUNoRCxTQUFLLGdFQUFnRSxNQUFNO0FBQzFFO0FBQUEsUUFDQyxrQ0FBa0MsY0FBYyxFQUFFLENBQUMsR0FBRyxJQUFJLE9BQUssRUFBRSxTQUFTLENBQUM7QUFBQSxRQUMzRTtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCxTQUFLLDRFQUE0RSxNQUFNO0FBQ3RGO0FBQUEsUUFDQyxrQ0FBa0MsY0FBYyxJQUFJLENBQUMsR0FBRyxJQUFJLE9BQUssRUFBRSxTQUFTLENBQUM7QUFBQSxRQUM3RTtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCxTQUFLLDJEQUEyRCxNQUFNO0FBQ3JFO0FBQUEsUUFDQyxrQ0FBa0MsY0FBYyxzQ0FBc0MsQ0FBQyxHQUFHLElBQUksT0FBSyxFQUFFLFNBQVMsQ0FBQztBQUFBLFFBQy9HLENBQUMsa0NBQWtDO0FBQUEsTUFDcEM7QUFBQSxJQUNELENBQUM7QUFDRCxTQUFLLDBFQUEwRSxNQUFNO0FBQ3BGO0FBQUEsUUFDQyxrQ0FBa0MsY0FBYyxxREFBcUQsQ0FBQyxHQUFHLElBQUksT0FBSyxFQUFFLFNBQVMsQ0FBQztBQUFBLFFBQzlILENBQUMsMEJBQTBCLHdCQUF3QjtBQUFBLE1BQ3BEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0QsUUFBTSwyQkFBMkIsTUFBTTtBQUN0QyxTQUFLLGdEQUFnRCxNQUFNO0FBQzFEO0FBQUEsUUFDQyx3QkFBd0I7QUFBQSxVQUN2QixFQUFFLFVBQVUsZUFBZSxhQUFhLEdBQUcsT0FBTyxFQUFFO0FBQUEsUUFDckQsR0FBRyxlQUFlLGFBQWEsQ0FBQyxDQUFDO0FBQUEsUUFDakM7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQ0QsU0FBSyw4Q0FBOEMsTUFBTTtBQUN4RCxZQUFNLFdBQVcsRUFBRSxVQUFVLGVBQWUsYUFBYSxHQUFHLE9BQU8sRUFBRTtBQUNyRTtBQUFBLFFBQ0Msd0JBQXdCO0FBQUEsVUFDdkIsRUFBRSxVQUFVLGVBQWUsYUFBYSxHQUFHLE9BQU8sRUFBRTtBQUFBLFVBQ3BEO0FBQUEsVUFDQSxFQUFFLFVBQVUsZUFBZSxhQUFhLEdBQUcsT0FBTyxFQUFFO0FBQUEsUUFDckQsR0FBRyxlQUFlLGFBQWEsQ0FBQyxDQUFDO0FBQUEsUUFDakM7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQ0QsU0FBSyw4QkFBOEIsTUFBTTtBQUN4QyxZQUFNLFdBQVcsRUFBRSxVQUFVLGVBQWUsYUFBYSxHQUFHLE9BQU8sRUFBRTtBQUNyRTtBQUFBLFFBQ0Msd0JBQXdCO0FBQUEsVUFDdkIsRUFBRSxVQUFVLGVBQWUsYUFBYSxHQUFHLE9BQU8sRUFBRTtBQUFBLFVBQ3BEO0FBQUEsVUFDQSxFQUFFLFVBQVUsZUFBZSxhQUFhLEdBQUcsT0FBTyxFQUFFO0FBQUEsUUFDckQsR0FBRyxlQUFlLGFBQWEsR0FBRyxpQkFBaUIsQ0FBQztBQUFBLFFBQ3BEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
