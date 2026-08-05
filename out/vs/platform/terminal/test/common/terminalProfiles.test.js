import { deepStrictEqual } from "assert";
import { Codicon } from "../../../../base/common/codicons.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { createProfileSchemaEnums } from "../../common/terminalProfiles.js";
suite("terminalProfiles", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("createProfileSchemaEnums", () => {
    test("should return an empty array when there are no profiles", () => {
      deepStrictEqual(createProfileSchemaEnums([]), {
        values: [
          null
        ],
        markdownDescriptions: [
          "Automatically detect the default"
        ]
      });
    });
    test("should return a single entry when there is one profile", () => {
      const profile = {
        profileName: "name",
        path: "path",
        isDefault: true
      };
      deepStrictEqual(createProfileSchemaEnums([profile]), {
        values: [
          null,
          "name"
        ],
        markdownDescriptions: [
          "Automatically detect the default",
          "$(terminal) name\n- path: path"
        ]
      });
    });
    test("should show all profile information", () => {
      const profile = {
        profileName: "name",
        path: "path",
        isDefault: true,
        args: ["a", "b"],
        color: "terminal.ansiRed",
        env: {
          c: "d",
          e: "f"
        },
        icon: Codicon.zap,
        overrideName: true
      };
      deepStrictEqual(createProfileSchemaEnums([profile]), {
        values: [
          null,
          "name"
        ],
        markdownDescriptions: [
          "Automatically detect the default",
          `$(zap) name
- path: path
- args: ['a','b']
- overrideName: true
- color: terminal.ansiRed
- env: {"c":"d","e":"f"}`
        ]
      });
    });
    test("should return a multiple entries when there are multiple profiles", () => {
      const profile1 = {
        profileName: "name",
        path: "path",
        isDefault: true
      };
      const profile2 = {
        profileName: "foo",
        path: "bar",
        isDefault: false
      };
      deepStrictEqual(createProfileSchemaEnums([profile1, profile2]), {
        values: [
          null,
          "name",
          "foo"
        ],
        markdownDescriptions: [
          "Automatically detect the default",
          "$(terminal) name\n- path: path",
          "$(terminal) foo\n- path: bar"
        ]
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC90ZXN0L2NvbW1vbi90ZXJtaW5hbFByb2ZpbGVzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkZWVwU3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsUHJvZmlsZSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVQcm9maWxlU2NoZW1hRW51bXMgfSBmcm9tICcuLi8uLi9jb21tb24vdGVybWluYWxQcm9maWxlcy5qcyc7XG5cbnN1aXRlKCd0ZXJtaW5hbFByb2ZpbGVzJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnY3JlYXRlUHJvZmlsZVNjaGVtYUVudW1zJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gYW4gZW1wdHkgYXJyYXkgd2hlbiB0aGVyZSBhcmUgbm8gcHJvZmlsZXMnLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoY3JlYXRlUHJvZmlsZVNjaGVtYUVudW1zKFtdKSwge1xuXHRcdFx0XHR2YWx1ZXM6IFtcblx0XHRcdFx0XHRudWxsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0J0F1dG9tYXRpY2FsbHkgZGV0ZWN0IHRoZSBkZWZhdWx0J1xuXHRcdFx0XHRdXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmV0dXJuIGEgc2luZ2xlIGVudHJ5IHdoZW4gdGhlcmUgaXMgb25lIHByb2ZpbGUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9maWxlOiBJVGVybWluYWxQcm9maWxlID0ge1xuXHRcdFx0XHRwcm9maWxlTmFtZTogJ25hbWUnLFxuXHRcdFx0XHRwYXRoOiAncGF0aCcsXG5cdFx0XHRcdGlzRGVmYXVsdDogdHJ1ZVxuXHRcdFx0fTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChjcmVhdGVQcm9maWxlU2NoZW1hRW51bXMoW3Byb2ZpbGVdKSwge1xuXHRcdFx0XHR2YWx1ZXM6IFtcblx0XHRcdFx0XHRudWxsLFxuXHRcdFx0XHRcdCduYW1lJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdCdBdXRvbWF0aWNhbGx5IGRldGVjdCB0aGUgZGVmYXVsdCcsXG5cdFx0XHRcdFx0JyQodGVybWluYWwpIG5hbWVcXG4tIHBhdGg6IHBhdGgnXG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBzaG93IGFsbCBwcm9maWxlIGluZm9ybWF0aW9uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvZmlsZTogSVRlcm1pbmFsUHJvZmlsZSA9IHtcblx0XHRcdFx0cHJvZmlsZU5hbWU6ICduYW1lJyxcblx0XHRcdFx0cGF0aDogJ3BhdGgnLFxuXHRcdFx0XHRpc0RlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdGFyZ3M6IFsnYScsICdiJ10sXG5cdFx0XHRcdGNvbG9yOiAndGVybWluYWwuYW5zaVJlZCcsXG5cdFx0XHRcdGVudjoge1xuXHRcdFx0XHRcdGM6ICdkJyxcblx0XHRcdFx0XHRlOiAnZidcblx0XHRcdFx0fSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi56YXAsXG5cdFx0XHRcdG92ZXJyaWRlTmFtZTogdHJ1ZVxuXHRcdFx0fTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChjcmVhdGVQcm9maWxlU2NoZW1hRW51bXMoW3Byb2ZpbGVdKSwge1xuXHRcdFx0XHR2YWx1ZXM6IFtcblx0XHRcdFx0XHRudWxsLFxuXHRcdFx0XHRcdCduYW1lJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdCdBdXRvbWF0aWNhbGx5IGRldGVjdCB0aGUgZGVmYXVsdCcsXG5cdFx0XHRcdFx0YCQoemFwKSBuYW1lXFxuLSBwYXRoOiBwYXRoXFxuLSBhcmdzOiBbJ2EnLCdiJ11cXG4tIG92ZXJyaWRlTmFtZTogdHJ1ZVxcbi0gY29sb3I6IHRlcm1pbmFsLmFuc2lSZWRcXG4tIGVudjoge1xcXCJjXFxcIjpcXFwiZFxcXCIsXFxcImVcXFwiOlxcXCJmXFxcIn1gXG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gYSBtdWx0aXBsZSBlbnRyaWVzIHdoZW4gdGhlcmUgYXJlIG11bHRpcGxlIHByb2ZpbGVzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvZmlsZTE6IElUZXJtaW5hbFByb2ZpbGUgPSB7XG5cdFx0XHRcdHByb2ZpbGVOYW1lOiAnbmFtZScsXG5cdFx0XHRcdHBhdGg6ICdwYXRoJyxcblx0XHRcdFx0aXNEZWZhdWx0OiB0cnVlXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcHJvZmlsZTI6IElUZXJtaW5hbFByb2ZpbGUgPSB7XG5cdFx0XHRcdHByb2ZpbGVOYW1lOiAnZm9vJyxcblx0XHRcdFx0cGF0aDogJ2JhcicsXG5cdFx0XHRcdGlzRGVmYXVsdDogZmFsc2Vcblx0XHRcdH07XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoY3JlYXRlUHJvZmlsZVNjaGVtYUVudW1zKFtwcm9maWxlMSwgcHJvZmlsZTJdKSwge1xuXHRcdFx0XHR2YWx1ZXM6IFtcblx0XHRcdFx0XHRudWxsLFxuXHRcdFx0XHRcdCduYW1lJyxcblx0XHRcdFx0XHQnZm9vJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdCdBdXRvbWF0aWNhbGx5IGRldGVjdCB0aGUgZGVmYXVsdCcsXG5cdFx0XHRcdFx0JyQodGVybWluYWwpIG5hbWVcXG4tIHBhdGg6IHBhdGgnLFxuXHRcdFx0XHRcdCckKHRlcm1pbmFsKSBmb29cXG4tIHBhdGg6IGJhcidcblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxnQ0FBZ0M7QUFFekMsTUFBTSxvQkFBb0IsTUFBTTtBQUMvQiwwQ0FBd0M7QUFFeEMsUUFBTSw0QkFBNEIsTUFBTTtBQUN2QyxTQUFLLDJEQUEyRCxNQUFNO0FBQ3JFLHNCQUFnQix5QkFBeUIsQ0FBQyxDQUFDLEdBQUc7QUFBQSxRQUM3QyxRQUFRO0FBQUEsVUFDUDtBQUFBLFFBQ0Q7QUFBQSxRQUNBLHNCQUFzQjtBQUFBLFVBQ3JCO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUNELFNBQUssMERBQTBELE1BQU07QUFDcEUsWUFBTSxVQUE0QjtBQUFBLFFBQ2pDLGFBQWE7QUFBQSxRQUNiLE1BQU07QUFBQSxRQUNOLFdBQVc7QUFBQSxNQUNaO0FBQ0Esc0JBQWdCLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxHQUFHO0FBQUEsUUFDcEQsUUFBUTtBQUFBLFVBQ1A7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0Esc0JBQXNCO0FBQUEsVUFDckI7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUNELFNBQUssdUNBQXVDLE1BQU07QUFDakQsWUFBTSxVQUE0QjtBQUFBLFFBQ2pDLGFBQWE7QUFBQSxRQUNiLE1BQU07QUFBQSxRQUNOLFdBQVc7QUFBQSxRQUNYLE1BQU0sQ0FBQyxLQUFLLEdBQUc7QUFBQSxRQUNmLE9BQU87QUFBQSxRQUNQLEtBQUs7QUFBQSxVQUNKLEdBQUc7QUFBQSxVQUNILEdBQUc7QUFBQSxRQUNKO0FBQUEsUUFDQSxNQUFNLFFBQVE7QUFBQSxRQUNkLGNBQWM7QUFBQSxNQUNmO0FBQ0Esc0JBQWdCLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxHQUFHO0FBQUEsUUFDcEQsUUFBUTtBQUFBLFVBQ1A7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0Esc0JBQXNCO0FBQUEsVUFDckI7QUFBQSxVQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxTQUFLLHFFQUFxRSxNQUFNO0FBQy9FLFlBQU0sV0FBNkI7QUFBQSxRQUNsQyxhQUFhO0FBQUEsUUFDYixNQUFNO0FBQUEsUUFDTixXQUFXO0FBQUEsTUFDWjtBQUNBLFlBQU0sV0FBNkI7QUFBQSxRQUNsQyxhQUFhO0FBQUEsUUFDYixNQUFNO0FBQUEsUUFDTixXQUFXO0FBQUEsTUFDWjtBQUNBLHNCQUFnQix5QkFBeUIsQ0FBQyxVQUFVLFFBQVEsQ0FBQyxHQUFHO0FBQUEsUUFDL0QsUUFBUTtBQUFBLFVBQ1A7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQSxRQUNBLHNCQUFzQjtBQUFBLFVBQ3JCO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
