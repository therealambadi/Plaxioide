import { strictEqual } from "assert";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { collapseTildePath, sanitizeCwd } from "../../common/terminalEnvironment.js";
suite("terminalEnvironment", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("collapseTildePath", () => {
    test("should return empty string for a falsy path", () => {
      strictEqual(collapseTildePath("", "/foo", "/"), "");
      strictEqual(collapseTildePath(void 0, "/foo", "/"), "");
    });
    test("should return path for a falsy user home", () => {
      strictEqual(collapseTildePath("/foo", "", "/"), "/foo");
      strictEqual(collapseTildePath("/foo", void 0, "/"), "/foo");
    });
    test("should not collapse when user home isn't present", () => {
      strictEqual(collapseTildePath("/foo", "/bar", "/"), "/foo");
      strictEqual(collapseTildePath("C:\\foo", "C:\\bar", "\\"), "C:\\foo");
    });
    test("should collapse with Windows separators", () => {
      strictEqual(collapseTildePath("C:\\foo\\bar", "C:\\foo", "\\"), "~\\bar");
      strictEqual(collapseTildePath("C:\\foo\\bar", "C:\\foo\\", "\\"), "~\\bar");
      strictEqual(collapseTildePath("C:\\foo\\bar\\baz", "C:\\foo\\", "\\"), "~\\bar\\baz");
      strictEqual(collapseTildePath("C:\\foo\\bar\\baz", "C:\\foo", "\\"), "~\\bar\\baz");
    });
    test("should collapse mixed case with Windows separators", () => {
      strictEqual(collapseTildePath("c:\\foo\\bar", "C:\\foo", "\\"), "~\\bar");
      strictEqual(collapseTildePath("C:\\foo\\bar\\baz", "c:\\foo", "\\"), "~\\bar\\baz");
    });
    test("should collapse with Posix separators", () => {
      strictEqual(collapseTildePath("/foo/bar", "/foo", "/"), "~/bar");
      strictEqual(collapseTildePath("/foo/bar", "/foo/", "/"), "~/bar");
      strictEqual(collapseTildePath("/foo/bar/baz", "/foo", "/"), "~/bar/baz");
      strictEqual(collapseTildePath("/foo/bar/baz", "/foo/", "/"), "~/bar/baz");
    });
  });
  suite("sanitizeCwd", () => {
    if (OS === OperatingSystem.Windows) {
      test("should make the Windows drive letter uppercase", () => {
        strictEqual(sanitizeCwd("c:\\foo\\bar"), "C:\\foo\\bar");
      });
    }
    test("should remove any wrapping quotes", () => {
      strictEqual(sanitizeCwd("'/foo/bar'"), "/foo/bar");
      strictEqual(sanitizeCwd('"/foo/bar"'), "/foo/bar");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC90ZXN0L2NvbW1vbi90ZXJtaW5hbEVudmlyb25tZW50LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBPcGVyYXRpbmdTeXN0ZW0sIE9TIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBjb2xsYXBzZVRpbGRlUGF0aCwgc2FuaXRpemVDd2QgfSBmcm9tICcuLi8uLi9jb21tb24vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5cbnN1aXRlKCd0ZXJtaW5hbEVudmlyb25tZW50JywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnY29sbGFwc2VUaWxkZVBhdGgnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiBlbXB0eSBzdHJpbmcgZm9yIGEgZmFsc3kgcGF0aCcsICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCcnLCAnL2ZvbycsICcvJyksICcnKTtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKHVuZGVmaW5lZCwgJy9mb28nLCAnLycpLCAnJyk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiBwYXRoIGZvciBhIGZhbHN5IHVzZXIgaG9tZScsICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCcvZm9vJywgJycsICcvJyksICcvZm9vJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjb2xsYXBzZVRpbGRlUGF0aCgnL2ZvbycsIHVuZGVmaW5lZCwgJy8nKSwgJy9mb28nKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgbm90IGNvbGxhcHNlIHdoZW4gdXNlciBob21lIGlzblxcJ3QgcHJlc2VudCcsICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCcvZm9vJywgJy9iYXInLCAnLycpLCAnL2ZvbycpO1xuXHRcdFx0c3RyaWN0RXF1YWwoY29sbGFwc2VUaWxkZVBhdGgoJ0M6XFxcXGZvbycsICdDOlxcXFxiYXInLCAnXFxcXCcpLCAnQzpcXFxcZm9vJyk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGNvbGxhcHNlIHdpdGggV2luZG93cyBzZXBhcmF0b3JzJywgKCkgPT4ge1xuXHRcdFx0c3RyaWN0RXF1YWwoY29sbGFwc2VUaWxkZVBhdGgoJ0M6XFxcXGZvb1xcXFxiYXInLCAnQzpcXFxcZm9vJywgJ1xcXFwnKSwgJ35cXFxcYmFyJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjb2xsYXBzZVRpbGRlUGF0aCgnQzpcXFxcZm9vXFxcXGJhcicsICdDOlxcXFxmb29cXFxcJywgJ1xcXFwnKSwgJ35cXFxcYmFyJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjb2xsYXBzZVRpbGRlUGF0aCgnQzpcXFxcZm9vXFxcXGJhclxcXFxiYXonLCAnQzpcXFxcZm9vXFxcXCcsICdcXFxcJyksICd+XFxcXGJhclxcXFxiYXonKTtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCdDOlxcXFxmb29cXFxcYmFyXFxcXGJheicsICdDOlxcXFxmb28nLCAnXFxcXCcpLCAnflxcXFxiYXJcXFxcYmF6Jyk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGNvbGxhcHNlIG1peGVkIGNhc2Ugd2l0aCBXaW5kb3dzIHNlcGFyYXRvcnMnLCAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChjb2xsYXBzZVRpbGRlUGF0aCgnYzpcXFxcZm9vXFxcXGJhcicsICdDOlxcXFxmb28nLCAnXFxcXCcpLCAnflxcXFxiYXInKTtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCdDOlxcXFxmb29cXFxcYmFyXFxcXGJheicsICdjOlxcXFxmb28nLCAnXFxcXCcpLCAnflxcXFxiYXJcXFxcYmF6Jyk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGNvbGxhcHNlIHdpdGggUG9zaXggc2VwYXJhdG9ycycsICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCcvZm9vL2JhcicsICcvZm9vJywgJy8nKSwgJ34vYmFyJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChjb2xsYXBzZVRpbGRlUGF0aCgnL2Zvby9iYXInLCAnL2Zvby8nLCAnLycpLCAnfi9iYXInKTtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCcvZm9vL2Jhci9iYXonLCAnL2ZvbycsICcvJyksICd+L2Jhci9iYXonKTtcblx0XHRcdHN0cmljdEVxdWFsKGNvbGxhcHNlVGlsZGVQYXRoKCcvZm9vL2Jhci9iYXonLCAnL2Zvby8nLCAnLycpLCAnfi9iYXIvYmF6Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnc2FuaXRpemVDd2QnLCAoKSA9PiB7XG5cdFx0aWYgKE9TID09PSBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cykge1xuXHRcdFx0dGVzdCgnc2hvdWxkIG1ha2UgdGhlIFdpbmRvd3MgZHJpdmUgbGV0dGVyIHVwcGVyY2FzZScsICgpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoc2FuaXRpemVDd2QoJ2M6XFxcXGZvb1xcXFxiYXInKSwgJ0M6XFxcXGZvb1xcXFxiYXInKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHR0ZXN0KCdzaG91bGQgcmVtb3ZlIGFueSB3cmFwcGluZyBxdW90ZXMnLCAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChzYW5pdGl6ZUN3ZCgnXFwnL2Zvby9iYXJcXCcnKSwgJy9mb28vYmFyJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChzYW5pdGl6ZUN3ZCgnXCIvZm9vL2JhclwiJyksICcvZm9vL2JhcicpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxpQkFBaUIsVUFBVTtBQUNwQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLG1CQUFtQixtQkFBbUI7QUFFL0MsTUFBTSx1QkFBdUIsTUFBTTtBQUNsQywwQ0FBd0M7QUFFeEMsUUFBTSxxQkFBcUIsTUFBTTtBQUNoQyxTQUFLLCtDQUErQyxNQUFNO0FBQ3pELGtCQUFZLGtCQUFrQixJQUFJLFFBQVEsR0FBRyxHQUFHLEVBQUU7QUFDbEQsa0JBQVksa0JBQWtCLFFBQVcsUUFBUSxHQUFHLEdBQUcsRUFBRTtBQUFBLElBQzFELENBQUM7QUFDRCxTQUFLLDRDQUE0QyxNQUFNO0FBQ3RELGtCQUFZLGtCQUFrQixRQUFRLElBQUksR0FBRyxHQUFHLE1BQU07QUFDdEQsa0JBQVksa0JBQWtCLFFBQVEsUUFBVyxHQUFHLEdBQUcsTUFBTTtBQUFBLElBQzlELENBQUM7QUFDRCxTQUFLLG9EQUFxRCxNQUFNO0FBQy9ELGtCQUFZLGtCQUFrQixRQUFRLFFBQVEsR0FBRyxHQUFHLE1BQU07QUFDMUQsa0JBQVksa0JBQWtCLFdBQVcsV0FBVyxJQUFJLEdBQUcsU0FBUztBQUFBLElBQ3JFLENBQUM7QUFDRCxTQUFLLDJDQUEyQyxNQUFNO0FBQ3JELGtCQUFZLGtCQUFrQixnQkFBZ0IsV0FBVyxJQUFJLEdBQUcsUUFBUTtBQUN4RSxrQkFBWSxrQkFBa0IsZ0JBQWdCLGFBQWEsSUFBSSxHQUFHLFFBQVE7QUFDMUUsa0JBQVksa0JBQWtCLHFCQUFxQixhQUFhLElBQUksR0FBRyxhQUFhO0FBQ3BGLGtCQUFZLGtCQUFrQixxQkFBcUIsV0FBVyxJQUFJLEdBQUcsYUFBYTtBQUFBLElBQ25GLENBQUM7QUFDRCxTQUFLLHNEQUFzRCxNQUFNO0FBQ2hFLGtCQUFZLGtCQUFrQixnQkFBZ0IsV0FBVyxJQUFJLEdBQUcsUUFBUTtBQUN4RSxrQkFBWSxrQkFBa0IscUJBQXFCLFdBQVcsSUFBSSxHQUFHLGFBQWE7QUFBQSxJQUNuRixDQUFDO0FBQ0QsU0FBSyx5Q0FBeUMsTUFBTTtBQUNuRCxrQkFBWSxrQkFBa0IsWUFBWSxRQUFRLEdBQUcsR0FBRyxPQUFPO0FBQy9ELGtCQUFZLGtCQUFrQixZQUFZLFNBQVMsR0FBRyxHQUFHLE9BQU87QUFDaEUsa0JBQVksa0JBQWtCLGdCQUFnQixRQUFRLEdBQUcsR0FBRyxXQUFXO0FBQ3ZFLGtCQUFZLGtCQUFrQixnQkFBZ0IsU0FBUyxHQUFHLEdBQUcsV0FBVztBQUFBLElBQ3pFLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRCxRQUFNLGVBQWUsTUFBTTtBQUMxQixRQUFJLE9BQU8sZ0JBQWdCLFNBQVM7QUFDbkMsV0FBSyxrREFBa0QsTUFBTTtBQUM1RCxvQkFBWSxZQUFZLGNBQWMsR0FBRyxjQUFjO0FBQUEsTUFDeEQsQ0FBQztBQUFBLElBQ0Y7QUFDQSxTQUFLLHFDQUFxQyxNQUFNO0FBQy9DLGtCQUFZLFlBQVksWUFBYyxHQUFHLFVBQVU7QUFDbkQsa0JBQVksWUFBWSxZQUFZLEdBQUcsVUFBVTtBQUFBLElBQ2xELENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
