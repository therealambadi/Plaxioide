import assert from "assert";
import { isFunction } from "../../../../base/common/types.js";
import { Registry } from "../../common/platform.js";
suite("Platform / Registry", () => {
  test("registry - api", function() {
    assert.ok(isFunction(Registry.add));
    assert.ok(isFunction(Registry.as));
    assert.ok(isFunction(Registry.knows));
  });
  test("registry - mixin", function() {
    Registry.add("foo", { bar: true });
    assert.ok(Registry.knows("foo"));
    assert.ok(Registry.as("foo").bar);
    assert.strictEqual(Registry.as("foo").bar, true);
  });
  test("registry - knows, as", function() {
    const ext = {};
    Registry.add("knows,as", ext);
    assert.ok(Registry.knows("knows,as"));
    assert.ok(!Registry.knows("knows,as1234"));
    assert.ok(Registry.as("knows,as") === ext);
    assert.ok(Registry.as("knows,as1234") === null);
  });
  test("registry - mixin, fails on duplicate ids", function() {
    Registry.add("foo-dup", { bar: true });
    try {
      Registry.add("foo-dup", { bar: false });
      assert.ok(false);
    } catch (e) {
      assert.ok(true);
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9yZWdpc3RyeS90ZXN0L2NvbW1vbi9wbGF0Zm9ybS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaXNGdW5jdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vY29tbW9uL3BsYXRmb3JtLmpzJztcblxuc3VpdGUoJ1BsYXRmb3JtIC8gUmVnaXN0cnknLCAoKSA9PiB7XG5cblx0dGVzdCgncmVnaXN0cnkgLSBhcGknLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0Lm9rKGlzRnVuY3Rpb24oUmVnaXN0cnkuYWRkKSk7XG5cdFx0YXNzZXJ0Lm9rKGlzRnVuY3Rpb24oUmVnaXN0cnkuYXMpKTtcblx0XHRhc3NlcnQub2soaXNGdW5jdGlvbihSZWdpc3RyeS5rbm93cykpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWdpc3RyeSAtIG1peGluJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0UmVnaXN0cnkuYWRkKCdmb28nLCB7IGJhcjogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5vayhSZWdpc3RyeS5rbm93cygnZm9vJykpO1xuXHRcdGFzc2VydC5vayhSZWdpc3RyeS5hczxhbnk+KCdmb28nKS5iYXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChSZWdpc3RyeS5hczxhbnk+KCdmb28nKS5iYXIsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWdpc3RyeSAtIGtub3dzLCBhcycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGV4dCA9IHt9O1xuXG5cdFx0UmVnaXN0cnkuYWRkKCdrbm93cyxhcycsIGV4dCk7XG5cblx0XHRhc3NlcnQub2soUmVnaXN0cnkua25vd3MoJ2tub3dzLGFzJykpO1xuXHRcdGFzc2VydC5vayghUmVnaXN0cnkua25vd3MoJ2tub3dzLGFzMTIzNCcpKTtcblxuXHRcdGFzc2VydC5vayhSZWdpc3RyeS5hcygna25vd3MsYXMnKSA9PT0gZXh0KTtcblx0XHRhc3NlcnQub2soUmVnaXN0cnkuYXMoJ2tub3dzLGFzMTIzNCcpID09PSBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgncmVnaXN0cnkgLSBtaXhpbiwgZmFpbHMgb24gZHVwbGljYXRlIGlkcycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdFJlZ2lzdHJ5LmFkZCgnZm9vLWR1cCcsIHsgYmFyOiB0cnVlIH0pO1xuXG5cdFx0dHJ5IHtcblx0XHRcdFJlZ2lzdHJ5LmFkZCgnZm9vLWR1cCcsIHsgYmFyOiBmYWxzZSB9KTtcblx0XHRcdGFzc2VydC5vayhmYWxzZSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0YXNzZXJ0Lm9rKHRydWUpO1xuXHRcdH1cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQjtBQUV6QixNQUFNLHVCQUF1QixNQUFNO0FBRWxDLE9BQUssa0JBQWtCLFdBQVk7QUFDbEMsV0FBTyxHQUFHLFdBQVcsU0FBUyxHQUFHLENBQUM7QUFDbEMsV0FBTyxHQUFHLFdBQVcsU0FBUyxFQUFFLENBQUM7QUFDakMsV0FBTyxHQUFHLFdBQVcsU0FBUyxLQUFLLENBQUM7QUFBQSxFQUNyQyxDQUFDO0FBRUQsT0FBSyxvQkFBb0IsV0FBWTtBQUVwQyxhQUFTLElBQUksT0FBTyxFQUFFLEtBQUssS0FBSyxDQUFDO0FBRWpDLFdBQU8sR0FBRyxTQUFTLE1BQU0sS0FBSyxDQUFDO0FBQy9CLFdBQU8sR0FBRyxTQUFTLEdBQVEsS0FBSyxFQUFFLEdBQUc7QUFDckMsV0FBTyxZQUFZLFNBQVMsR0FBUSxLQUFLLEVBQUUsS0FBSyxJQUFJO0FBQUEsRUFDckQsQ0FBQztBQUVELE9BQUssd0JBQXdCLFdBQVk7QUFFeEMsVUFBTSxNQUFNLENBQUM7QUFFYixhQUFTLElBQUksWUFBWSxHQUFHO0FBRTVCLFdBQU8sR0FBRyxTQUFTLE1BQU0sVUFBVSxDQUFDO0FBQ3BDLFdBQU8sR0FBRyxDQUFDLFNBQVMsTUFBTSxjQUFjLENBQUM7QUFFekMsV0FBTyxHQUFHLFNBQVMsR0FBRyxVQUFVLE1BQU0sR0FBRztBQUN6QyxXQUFPLEdBQUcsU0FBUyxHQUFHLGNBQWMsTUFBTSxJQUFJO0FBQUEsRUFDL0MsQ0FBQztBQUVELE9BQUssNENBQTRDLFdBQVk7QUFFNUQsYUFBUyxJQUFJLFdBQVcsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUVyQyxRQUFJO0FBQ0gsZUFBUyxJQUFJLFdBQVcsRUFBRSxLQUFLLE1BQU0sQ0FBQztBQUN0QyxhQUFPLEdBQUcsS0FBSztBQUFBLElBQ2hCLFNBQVMsR0FBRztBQUNYLGFBQU8sR0FBRyxJQUFJO0FBQUEsSUFDZjtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
