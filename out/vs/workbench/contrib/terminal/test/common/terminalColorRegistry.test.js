import assert from "assert";
import { Extensions as ThemeingExtensions } from "../../../../../platform/theme/common/colorRegistry.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { ansiColorIdentifiers, registerColors } from "../../common/terminalColorRegistry.js";
import { Color } from "../../../../../base/common/color.js";
import { ColorScheme } from "../../../../../platform/theme/common/theme.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
registerColors();
const themingRegistry = Registry.as(ThemeingExtensions.ColorContribution);
function getMockTheme(type) {
  const theme = {
    selector: "",
    label: "",
    type,
    getColor: (colorId) => themingRegistry.resolveDefaultColor(colorId, theme),
    defines: () => true,
    getTokenStyleMetadata: () => void 0,
    tokenColorMap: [],
    semanticHighlighting: false
  };
  return theme;
}
suite("Workbench - TerminalColorRegistry", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("hc colors", function() {
    const theme = getMockTheme(ColorScheme.HIGH_CONTRAST_DARK);
    const colors = ansiColorIdentifiers.map((colorId) => Color.Format.CSS.formatHexA(theme.getColor(colorId), true));
    assert.deepStrictEqual(colors, [
      "#000000",
      "#cd0000",
      "#00cd00",
      "#cdcd00",
      "#0000ee",
      "#cd00cd",
      "#00cdcd",
      "#e5e5e5",
      "#7f7f7f",
      "#ff0000",
      "#00ff00",
      "#ffff00",
      "#5c5cff",
      "#ff00ff",
      "#00ffff",
      "#ffffff"
    ], "The high contrast terminal colors should be used when the hc theme is active");
  });
  test("light colors", function() {
    const theme = getMockTheme(ColorScheme.LIGHT);
    const colors = ansiColorIdentifiers.map((colorId) => Color.Format.CSS.formatHexA(theme.getColor(colorId), true));
    assert.deepStrictEqual(colors, [
      "#000000",
      "#cd3131",
      "#107c10",
      "#949800",
      "#0451a5",
      "#bc05bc",
      "#0598bc",
      "#555555",
      "#666666",
      "#cd3131",
      "#14ce14",
      "#b5ba00",
      "#0451a5",
      "#bc05bc",
      "#0598bc",
      "#a5a5a5"
    ], "The light terminal colors should be used when the light theme is active");
  });
  test("dark colors", function() {
    const theme = getMockTheme(ColorScheme.DARK);
    const colors = ansiColorIdentifiers.map((colorId) => Color.Format.CSS.formatHexA(theme.getColor(colorId), true));
    assert.deepStrictEqual(colors, [
      "#000000",
      "#cd3131",
      "#0dbc79",
      "#e5e510",
      "#2472c8",
      "#bc3fbc",
      "#11a8cd",
      "#e5e5e5",
      "#666666",
      "#f14c4c",
      "#23d18b",
      "#f5f543",
      "#3b8eea",
      "#d670d6",
      "#29b8db",
      "#e5e5e5"
    ], "The dark terminal colors should be used when a dark theme is active");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2NvbW1vbi90ZXJtaW5hbENvbG9yUmVnaXN0cnkudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgVGhlbWVpbmdFeHRlbnNpb25zLCBJQ29sb3JSZWdpc3RyeSwgQ29sb3JJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgYW5zaUNvbG9ySWRlbnRpZmllcnMsIHJlZ2lzdGVyQ29sb3JzIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlcm1pbmFsQ29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29sb3JUaGVtZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBDb2xvclNjaGVtZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxucmVnaXN0ZXJDb2xvcnMoKTtcblxuY29uc3QgdGhlbWluZ1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbG9yUmVnaXN0cnk+KFRoZW1laW5nRXh0ZW5zaW9ucy5Db2xvckNvbnRyaWJ1dGlvbik7XG5mdW5jdGlvbiBnZXRNb2NrVGhlbWUodHlwZTogQ29sb3JTY2hlbWUpOiBJQ29sb3JUaGVtZSB7XG5cdGNvbnN0IHRoZW1lID0ge1xuXHRcdHNlbGVjdG9yOiAnJyxcblx0XHRsYWJlbDogJycsXG5cdFx0dHlwZTogdHlwZSxcblx0XHRnZXRDb2xvcjogKGNvbG9ySWQ6IENvbG9ySWRlbnRpZmllcik6IENvbG9yIHwgdW5kZWZpbmVkID0+IHRoZW1pbmdSZWdpc3RyeS5yZXNvbHZlRGVmYXVsdENvbG9yKGNvbG9ySWQsIHRoZW1lKSxcblx0XHRkZWZpbmVzOiAoKSA9PiB0cnVlLFxuXHRcdGdldFRva2VuU3R5bGVNZXRhZGF0YTogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdHRva2VuQ29sb3JNYXA6IFtdLFxuXHRcdHNlbWFudGljSGlnaGxpZ2h0aW5nOiBmYWxzZVxuXHR9O1xuXHRyZXR1cm4gdGhlbWU7XG59XG5cbnN1aXRlKCdXb3JrYmVuY2ggLSBUZXJtaW5hbENvbG9yUmVnaXN0cnknLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2hjIGNvbG9ycycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0aGVtZSA9IGdldE1vY2tUaGVtZShDb2xvclNjaGVtZS5ISUdIX0NPTlRSQVNUX0RBUkspO1xuXHRcdGNvbnN0IGNvbG9ycyA9IGFuc2lDb2xvcklkZW50aWZpZXJzLm1hcChjb2xvcklkID0+IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4QSh0aGVtZS5nZXRDb2xvcihjb2xvcklkKSEsIHRydWUpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29sb3JzLCBbXG5cdFx0XHQnIzAwMDAwMCcsXG5cdFx0XHQnI2NkMDAwMCcsXG5cdFx0XHQnIzAwY2QwMCcsXG5cdFx0XHQnI2NkY2QwMCcsXG5cdFx0XHQnIzAwMDBlZScsXG5cdFx0XHQnI2NkMDBjZCcsXG5cdFx0XHQnIzAwY2RjZCcsXG5cdFx0XHQnI2U1ZTVlNScsXG5cdFx0XHQnIzdmN2Y3ZicsXG5cdFx0XHQnI2ZmMDAwMCcsXG5cdFx0XHQnIzAwZmYwMCcsXG5cdFx0XHQnI2ZmZmYwMCcsXG5cdFx0XHQnIzVjNWNmZicsXG5cdFx0XHQnI2ZmMDBmZicsXG5cdFx0XHQnIzAwZmZmZicsXG5cdFx0XHQnI2ZmZmZmZidcblx0XHRdLCAnVGhlIGhpZ2ggY29udHJhc3QgdGVybWluYWwgY29sb3JzIHNob3VsZCBiZSB1c2VkIHdoZW4gdGhlIGhjIHRoZW1lIGlzIGFjdGl2ZScpO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ2xpZ2h0IGNvbG9ycycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0aGVtZSA9IGdldE1vY2tUaGVtZShDb2xvclNjaGVtZS5MSUdIVCk7XG5cdFx0Y29uc3QgY29sb3JzID0gYW5zaUNvbG9ySWRlbnRpZmllcnMubWFwKGNvbG9ySWQgPT4gQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXRIZXhBKHRoZW1lLmdldENvbG9yKGNvbG9ySWQpISwgdHJ1ZSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb2xvcnMsIFtcblx0XHRcdCcjMDAwMDAwJyxcblx0XHRcdCcjY2QzMTMxJyxcblx0XHRcdCcjMTA3YzEwJyxcblx0XHRcdCcjOTQ5ODAwJyxcblx0XHRcdCcjMDQ1MWE1Jyxcblx0XHRcdCcjYmMwNWJjJyxcblx0XHRcdCcjMDU5OGJjJyxcblx0XHRcdCcjNTU1NTU1Jyxcblx0XHRcdCcjNjY2NjY2Jyxcblx0XHRcdCcjY2QzMTMxJyxcblx0XHRcdCcjMTRjZTE0Jyxcblx0XHRcdCcjYjViYTAwJyxcblx0XHRcdCcjMDQ1MWE1Jyxcblx0XHRcdCcjYmMwNWJjJyxcblx0XHRcdCcjMDU5OGJjJyxcblx0XHRcdCcjYTVhNWE1J1xuXHRcdF0sICdUaGUgbGlnaHQgdGVybWluYWwgY29sb3JzIHNob3VsZCBiZSB1c2VkIHdoZW4gdGhlIGxpZ2h0IHRoZW1lIGlzIGFjdGl2ZScpO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ2RhcmsgY29sb3JzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRoZW1lID0gZ2V0TW9ja1RoZW1lKENvbG9yU2NoZW1lLkRBUkspO1xuXHRcdGNvbnN0IGNvbG9ycyA9IGFuc2lDb2xvcklkZW50aWZpZXJzLm1hcChjb2xvcklkID0+IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4QSh0aGVtZS5nZXRDb2xvcihjb2xvcklkKSEsIHRydWUpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29sb3JzLCBbXG5cdFx0XHQnIzAwMDAwMCcsXG5cdFx0XHQnI2NkMzEzMScsXG5cdFx0XHQnIzBkYmM3OScsXG5cdFx0XHQnI2U1ZTUxMCcsXG5cdFx0XHQnIzI0NzJjOCcsXG5cdFx0XHQnI2JjM2ZiYycsXG5cdFx0XHQnIzExYThjZCcsXG5cdFx0XHQnI2U1ZTVlNScsXG5cdFx0XHQnIzY2NjY2NicsXG5cdFx0XHQnI2YxNGM0YycsXG5cdFx0XHQnIzIzZDE4YicsXG5cdFx0XHQnI2Y1ZjU0MycsXG5cdFx0XHQnIzNiOGVlYScsXG5cdFx0XHQnI2Q2NzBkNicsXG5cdFx0XHQnIzI5YjhkYicsXG5cdFx0XHQnI2U1ZTVlNSdcblx0XHRdLCAnVGhlIGRhcmsgdGVybWluYWwgY29sb3JzIHNob3VsZCBiZSB1c2VkIHdoZW4gYSBkYXJrIHRoZW1lIGlzIGFjdGl2ZScpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsY0FBYywwQkFBMkQ7QUFDbEYsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxzQkFBc0Isc0JBQXNCO0FBRXJELFNBQVMsYUFBYTtBQUN0QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLCtDQUErQztBQUV4RCxlQUFlO0FBRWYsTUFBTSxrQkFBa0IsU0FBUyxHQUFtQixtQkFBbUIsaUJBQWlCO0FBQ3hGLFNBQVMsYUFBYSxNQUFnQztBQUNyRCxRQUFNLFFBQVE7QUFBQSxJQUNiLFVBQVU7QUFBQSxJQUNWLE9BQU87QUFBQSxJQUNQO0FBQUEsSUFDQSxVQUFVLENBQUMsWUFBZ0QsZ0JBQWdCLG9CQUFvQixTQUFTLEtBQUs7QUFBQSxJQUM3RyxTQUFTLE1BQU07QUFBQSxJQUNmLHVCQUF1QixNQUFNO0FBQUEsSUFDN0IsZUFBZSxDQUFDO0FBQUEsSUFDaEIsc0JBQXNCO0FBQUEsRUFDdkI7QUFDQSxTQUFPO0FBQ1I7QUFFQSxNQUFNLHFDQUFxQyxNQUFNO0FBQ2hELDBDQUF3QztBQUV4QyxPQUFLLGFBQWEsV0FBWTtBQUM3QixVQUFNLFFBQVEsYUFBYSxZQUFZLGtCQUFrQjtBQUN6RCxVQUFNLFNBQVMscUJBQXFCLElBQUksYUFBVyxNQUFNLE9BQU8sSUFBSSxXQUFXLE1BQU0sU0FBUyxPQUFPLEdBQUksSUFBSSxDQUFDO0FBRTlHLFdBQU8sZ0JBQWdCLFFBQVE7QUFBQSxNQUM5QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyw4RUFBOEU7QUFBQSxFQUVsRixDQUFDO0FBRUQsT0FBSyxnQkFBZ0IsV0FBWTtBQUNoQyxVQUFNLFFBQVEsYUFBYSxZQUFZLEtBQUs7QUFDNUMsVUFBTSxTQUFTLHFCQUFxQixJQUFJLGFBQVcsTUFBTSxPQUFPLElBQUksV0FBVyxNQUFNLFNBQVMsT0FBTyxHQUFJLElBQUksQ0FBQztBQUU5RyxXQUFPLGdCQUFnQixRQUFRO0FBQUEsTUFDOUI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcseUVBQXlFO0FBQUEsRUFFN0UsQ0FBQztBQUVELE9BQUssZUFBZSxXQUFZO0FBQy9CLFVBQU0sUUFBUSxhQUFhLFlBQVksSUFBSTtBQUMzQyxVQUFNLFNBQVMscUJBQXFCLElBQUksYUFBVyxNQUFNLE9BQU8sSUFBSSxXQUFXLE1BQU0sU0FBUyxPQUFPLEdBQUksSUFBSSxDQUFDO0FBRTlHLFdBQU8sZ0JBQWdCLFFBQVE7QUFBQSxNQUM5QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxxRUFBcUU7QUFBQSxFQUN6RSxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
