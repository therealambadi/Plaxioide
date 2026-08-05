import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Range } from "../../../common/core/range.js";
import { UnicodeTextModelHighlighter } from "../../../common/services/unicodeTextModelHighlighter.js";
import { createTextModel } from "../testTextModel.js";
suite("UnicodeTextModelHighlighter", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function t(text, options) {
    const m = createTextModel(text);
    const r = UnicodeTextModelHighlighter.computeUnicodeHighlights(m, options);
    m.dispose();
    return {
      ...r,
      ranges: r.ranges.map((r2) => Range.lift(r2).toString())
    };
  }
  test("computeUnicodeHighlights (#168068)", () => {
    assert.deepStrictEqual(
      t(`
	For\xA0\xE5\xA0gi\xA0et\xA0eksempel
`, {
        allowedCodePoints: [],
        allowedLocales: [],
        ambiguousCharacters: true,
        invisibleCharacters: true,
        includeComments: false,
        includeStrings: false,
        nonBasicASCII: false
      }),
      {
        ambiguousCharacterCount: 0,
        hasMore: false,
        invisibleCharacterCount: 4,
        nonBasicAsciiCharacterCount: 0,
        ranges: [
          "[2,5 -> 2,6]",
          "[2,7 -> 2,8]",
          "[2,10 -> 2,11]",
          "[2,13 -> 2,14]"
        ]
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvdW5pY29kZVRleHRNb2RlbEhpZ2hsaWdodGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgVW5pY29kZUhpZ2hsaWdodGVyT3B0aW9ucywgVW5pY29kZVRleHRNb2RlbEhpZ2hsaWdodGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL3VuaWNvZGVUZXh0TW9kZWxIaWdobGlnaHRlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi90ZXN0VGV4dE1vZGVsLmpzJztcblxuc3VpdGUoJ1VuaWNvZGVUZXh0TW9kZWxIaWdobGlnaHRlcicsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gdCh0ZXh0OiBzdHJpbmcsIG9wdGlvbnM6IFVuaWNvZGVIaWdobGlnaHRlck9wdGlvbnMpOiB1bmtub3duIHtcblx0XHRjb25zdCBtID0gY3JlYXRlVGV4dE1vZGVsKHRleHQpO1xuXHRcdGNvbnN0IHIgPSBVbmljb2RlVGV4dE1vZGVsSGlnaGxpZ2h0ZXIuY29tcHV0ZVVuaWNvZGVIaWdobGlnaHRzKG0sIG9wdGlvbnMpO1xuXHRcdG0uZGlzcG9zZSgpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLnIsXG5cdFx0XHRyYW5nZXM6IHIucmFuZ2VzLm1hcChyID0+IFJhbmdlLmxpZnQocikudG9TdHJpbmcoKSlcblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnY29tcHV0ZVVuaWNvZGVIaWdobGlnaHRzICgjMTY4MDY4KScsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dChgXG5cdEZvclx1MDBBMFx1MDBFNVx1MDBBMGdpXHUwMEEwZXRcdTAwQTBla3NlbXBlbFxuYCwge1xuXHRcdFx0XHRhbGxvd2VkQ29kZVBvaW50czogW10sXG5cdFx0XHRcdGFsbG93ZWRMb2NhbGVzOiBbXSxcblx0XHRcdFx0YW1iaWd1b3VzQ2hhcmFjdGVyczogdHJ1ZSxcblx0XHRcdFx0aW52aXNpYmxlQ2hhcmFjdGVyczogdHJ1ZSxcblx0XHRcdFx0aW5jbHVkZUNvbW1lbnRzOiBmYWxzZSxcblx0XHRcdFx0aW5jbHVkZVN0cmluZ3M6IGZhbHNlLFxuXHRcdFx0XHRub25CYXNpY0FTQ0lJOiBmYWxzZVxuXHRcdFx0fSksXG5cdFx0XHR7XG5cdFx0XHRcdGFtYmlndW91c0NoYXJhY3RlckNvdW50OiAwLFxuXHRcdFx0XHRoYXNNb3JlOiBmYWxzZSxcblx0XHRcdFx0aW52aXNpYmxlQ2hhcmFjdGVyQ291bnQ6IDQsXG5cdFx0XHRcdG5vbkJhc2ljQXNjaWlDaGFyYWN0ZXJDb3VudDogMCxcblx0XHRcdFx0cmFuZ2VzOiBbXG5cdFx0XHRcdFx0J1syLDUgLT4gMiw2XScsXG5cdFx0XHRcdFx0J1syLDcgLT4gMiw4XScsXG5cdFx0XHRcdFx0J1syLDEwIC0+IDIsMTFdJyxcblx0XHRcdFx0XHQnWzIsMTMgLT4gMiwxNF0nXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsYUFBYTtBQUN0QixTQUFvQyxtQ0FBbUM7QUFDdkUsU0FBUyx1QkFBdUI7QUFFaEMsTUFBTSwrQkFBK0IsTUFBTTtBQUMxQywwQ0FBd0M7QUFFeEMsV0FBUyxFQUFFLE1BQWMsU0FBNkM7QUFDckUsVUFBTSxJQUFJLGdCQUFnQixJQUFJO0FBQzlCLFVBQU0sSUFBSSw0QkFBNEIseUJBQXlCLEdBQUcsT0FBTztBQUN6RSxNQUFFLFFBQVE7QUFFVixXQUFPO0FBQUEsTUFDTixHQUFHO0FBQUEsTUFDSCxRQUFRLEVBQUUsT0FBTyxJQUFJLENBQUFBLE9BQUssTUFBTSxLQUFLQSxFQUFDLEVBQUUsU0FBUyxDQUFDO0FBQUEsSUFDbkQ7QUFBQSxFQUNEO0FBRUEsT0FBSyxzQ0FBc0MsTUFBTTtBQUNoRCxXQUFPO0FBQUEsTUFDTixFQUFFO0FBQUE7QUFBQSxHQUVGO0FBQUEsUUFDQyxtQkFBbUIsQ0FBQztBQUFBLFFBQ3BCLGdCQUFnQixDQUFDO0FBQUEsUUFDakIscUJBQXFCO0FBQUEsUUFDckIscUJBQXFCO0FBQUEsUUFDckIsaUJBQWlCO0FBQUEsUUFDakIsZ0JBQWdCO0FBQUEsUUFDaEIsZUFBZTtBQUFBLE1BQ2hCLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDQyx5QkFBeUI7QUFBQSxRQUN6QixTQUFTO0FBQUEsUUFDVCx5QkFBeUI7QUFBQSxRQUN6Qiw2QkFBNkI7QUFBQSxRQUM3QixRQUFRO0FBQUEsVUFDUDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInIiXQp9Cg==
