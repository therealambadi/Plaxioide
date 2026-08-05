import assert from "assert";
import * as platform from "../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { fixDriveC, getAbsoluteGlob } from "../../node/ripgrepFileSearch.js";
suite("RipgrepFileSearch - etc", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testGetAbsGlob(params) {
    const [folder, glob, expectedResult] = params;
    assert.strictEqual(fixDriveC(getAbsoluteGlob(folder, glob)), expectedResult, JSON.stringify(params));
  }
  (!platform.isWindows ? test.skip : test)("getAbsoluteGlob_win", () => {
    [
      ["C:/foo/bar", "glob/**", "/foo\\bar\\glob\\**"],
      ["c:/", "glob/**", "/glob\\**"],
      ["C:\\foo\\bar", "glob\\**", "/foo\\bar\\glob\\**"],
      ["c:\\foo\\bar", "glob\\**", "/foo\\bar\\glob\\**"],
      ["c:\\", "glob\\**", "/glob\\**"],
      ["\\\\localhost\\c$\\foo\\bar", "glob/**", "\\\\localhost\\c$\\foo\\bar\\glob\\**"],
      // absolute paths are not resolved further
      ["c:/foo/bar", "/path/something", "/path/something"],
      ["c:/foo/bar", "c:\\project\\folder", "/project\\folder"]
    ].forEach(testGetAbsGlob);
  });
  (platform.isWindows ? test.skip : test)("getAbsoluteGlob_posix", () => {
    [
      ["/foo/bar", "glob/**", "/foo/bar/glob/**"],
      ["/", "glob/**", "/glob/**"],
      // absolute paths are not resolved further
      ["/", "/project/folder", "/project/folder"]
    ].forEach(testGetAbsGlob);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3Qvbm9kZS9yaXBncmVwRmlsZVNlYXJjaC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBmaXhEcml2ZUMsIGdldEFic29sdXRlR2xvYiB9IGZyb20gJy4uLy4uL25vZGUvcmlwZ3JlcEZpbGVTZWFyY2guanMnO1xuXG5zdWl0ZSgnUmlwZ3JlcEZpbGVTZWFyY2ggLSBldGMnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRmdW5jdGlvbiB0ZXN0R2V0QWJzR2xvYihwYXJhbXM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgW2ZvbGRlciwgZ2xvYiwgZXhwZWN0ZWRSZXN1bHRdID0gcGFyYW1zO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXhEcml2ZUMoZ2V0QWJzb2x1dGVHbG9iKGZvbGRlciwgZ2xvYikpLCBleHBlY3RlZFJlc3VsdCwgSlNPTi5zdHJpbmdpZnkocGFyYW1zKSk7XG5cdH1cblxuXHQoIXBsYXRmb3JtLmlzV2luZG93cyA/IHRlc3Quc2tpcCA6IHRlc3QpKCdnZXRBYnNvbHV0ZUdsb2Jfd2luJywgKCkgPT4ge1xuXHRcdFtcblx0XHRcdFsnQzovZm9vL2JhcicsICdnbG9iLyoqJywgJy9mb29cXFxcYmFyXFxcXGdsb2JcXFxcKionXSxcblx0XHRcdFsnYzovJywgJ2dsb2IvKionLCAnL2dsb2JcXFxcKionXSxcblx0XHRcdFsnQzpcXFxcZm9vXFxcXGJhcicsICdnbG9iXFxcXCoqJywgJy9mb29cXFxcYmFyXFxcXGdsb2JcXFxcKionXSxcblx0XHRcdFsnYzpcXFxcZm9vXFxcXGJhcicsICdnbG9iXFxcXCoqJywgJy9mb29cXFxcYmFyXFxcXGdsb2JcXFxcKionXSxcblx0XHRcdFsnYzpcXFxcJywgJ2dsb2JcXFxcKionLCAnL2dsb2JcXFxcKionXSxcblx0XHRcdFsnXFxcXFxcXFxsb2NhbGhvc3RcXFxcYyRcXFxcZm9vXFxcXGJhcicsICdnbG9iLyoqJywgJ1xcXFxcXFxcbG9jYWxob3N0XFxcXGMkXFxcXGZvb1xcXFxiYXJcXFxcZ2xvYlxcXFwqKiddLFxuXG5cdFx0XHQvLyBhYnNvbHV0ZSBwYXRocyBhcmUgbm90IHJlc29sdmVkIGZ1cnRoZXJcblx0XHRcdFsnYzovZm9vL2JhcicsICcvcGF0aC9zb21ldGhpbmcnLCAnL3BhdGgvc29tZXRoaW5nJ10sXG5cdFx0XHRbJ2M6L2Zvby9iYXInLCAnYzpcXFxccHJvamVjdFxcXFxmb2xkZXInLCAnL3Byb2plY3RcXFxcZm9sZGVyJ11cblx0XHRdLmZvckVhY2godGVzdEdldEFic0dsb2IpO1xuXHR9KTtcblxuXHQocGxhdGZvcm0uaXNXaW5kb3dzID8gdGVzdC5za2lwIDogdGVzdCkoJ2dldEFic29sdXRlR2xvYl9wb3NpeCcsICgpID0+IHtcblx0XHRbXG5cdFx0XHRbJy9mb28vYmFyJywgJ2dsb2IvKionLCAnL2Zvby9iYXIvZ2xvYi8qKiddLFxuXHRcdFx0WycvJywgJ2dsb2IvKionLCAnL2dsb2IvKionXSxcblxuXHRcdFx0Ly8gYWJzb2x1dGUgcGF0aHMgYXJlIG5vdCByZXNvbHZlZCBmdXJ0aGVyXG5cdFx0XHRbJy8nLCAnL3Byb2plY3QvZm9sZGVyJywgJy9wcm9qZWN0L2ZvbGRlciddLFxuXHRcdF0uZm9yRWFjaCh0ZXN0R2V0QWJzR2xvYik7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsWUFBWSxjQUFjO0FBQzFCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsV0FBVyx1QkFBdUI7QUFFM0MsTUFBTSwyQkFBMkIsTUFBTTtBQUN0QywwQ0FBd0M7QUFDeEMsV0FBUyxlQUFlLFFBQXdCO0FBQy9DLFVBQU0sQ0FBQyxRQUFRLE1BQU0sY0FBYyxJQUFJO0FBQ3ZDLFdBQU8sWUFBWSxVQUFVLGdCQUFnQixRQUFRLElBQUksQ0FBQyxHQUFHLGdCQUFnQixLQUFLLFVBQVUsTUFBTSxDQUFDO0FBQUEsRUFDcEc7QUFFQSxHQUFDLENBQUMsU0FBUyxZQUFZLEtBQUssT0FBTyxNQUFNLHVCQUF1QixNQUFNO0FBQ3JFO0FBQUEsTUFDQyxDQUFDLGNBQWMsV0FBVyxxQkFBcUI7QUFBQSxNQUMvQyxDQUFDLE9BQU8sV0FBVyxXQUFXO0FBQUEsTUFDOUIsQ0FBQyxnQkFBZ0IsWUFBWSxxQkFBcUI7QUFBQSxNQUNsRCxDQUFDLGdCQUFnQixZQUFZLHFCQUFxQjtBQUFBLE1BQ2xELENBQUMsUUFBUSxZQUFZLFdBQVc7QUFBQSxNQUNoQyxDQUFDLCtCQUErQixXQUFXLHVDQUF1QztBQUFBO0FBQUEsTUFHbEYsQ0FBQyxjQUFjLG1CQUFtQixpQkFBaUI7QUFBQSxNQUNuRCxDQUFDLGNBQWMsdUJBQXVCLGtCQUFrQjtBQUFBLElBQ3pELEVBQUUsUUFBUSxjQUFjO0FBQUEsRUFDekIsQ0FBQztBQUVELEdBQUMsU0FBUyxZQUFZLEtBQUssT0FBTyxNQUFNLHlCQUF5QixNQUFNO0FBQ3RFO0FBQUEsTUFDQyxDQUFDLFlBQVksV0FBVyxrQkFBa0I7QUFBQSxNQUMxQyxDQUFDLEtBQUssV0FBVyxVQUFVO0FBQUE7QUFBQSxNQUczQixDQUFDLEtBQUssbUJBQW1CLGlCQUFpQjtBQUFBLElBQzNDLEVBQUUsUUFBUSxjQUFjO0FBQUEsRUFDekIsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
