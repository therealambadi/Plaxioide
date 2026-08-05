import assert from "assert";
import { timeout } from "../../../../../base/common/async.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { MockDebugAdapter } from "./mockDebug.js";
suite("Debug - AbstractDebugAdapter", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("event ordering", () => {
    let adapter;
    let output;
    setup(() => {
      adapter = new MockDebugAdapter();
      output = [];
      adapter.onEvent((ev) => {
        output.push(ev.body.output);
        Promise.resolve().then(() => output.push("--end microtask--"));
      });
    });
    const evaluate = async (expression) => {
      await new Promise((resolve) => adapter.sendRequest("evaluate", { expression }, resolve));
      output.push(`=${expression}`);
      Promise.resolve().then(() => output.push("--end microtask--"));
    };
    test("inserts task boundary before response", async () => {
      await evaluate("before.foo");
      await timeout(0);
      assert.deepStrictEqual(output, ["before.foo", "--end microtask--", "=before.foo", "--end microtask--"]);
    });
    test("inserts task boundary after response", async () => {
      await evaluate("after.foo");
      await timeout(0);
      assert.deepStrictEqual(output, ["=after.foo", "--end microtask--", "after.foo", "--end microtask--"]);
    });
    test("does not insert boundaries between events", async () => {
      adapter.sendEventBody("output", { output: "a" });
      adapter.sendEventBody("output", { output: "b" });
      adapter.sendEventBody("output", { output: "c" });
      await timeout(0);
      assert.deepStrictEqual(output, ["a", "b", "c", "--end microtask--", "--end microtask--", "--end microtask--"]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2NvbW1vbi9hYnN0cmFjdERlYnVnQWRhcHRlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgTW9ja0RlYnVnQWRhcHRlciB9IGZyb20gJy4vbW9ja0RlYnVnLmpzJztcblxuc3VpdGUoJ0RlYnVnIC0gQWJzdHJhY3REZWJ1Z0FkYXB0ZXInLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdldmVudCBvcmRlcmluZycsICgpID0+IHtcblx0XHRsZXQgYWRhcHRlcjogTW9ja0RlYnVnQWRhcHRlcjtcblx0XHRsZXQgb3V0cHV0OiBzdHJpbmdbXTtcblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRhZGFwdGVyID0gbmV3IE1vY2tEZWJ1Z0FkYXB0ZXIoKTtcblx0XHRcdG91dHB1dCA9IFtdO1xuXHRcdFx0YWRhcHRlci5vbkV2ZW50KGV2ID0+IHtcblx0XHRcdFx0b3V0cHV0LnB1c2goKGV2IGFzIERlYnVnUHJvdG9jb2wuT3V0cHV0RXZlbnQpLmJvZHkub3V0cHV0KTtcblx0XHRcdFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiBvdXRwdXQucHVzaCgnLS1lbmQgbWljcm90YXNrLS0nKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGV2YWx1YXRlID0gYXN5bmMgKGV4cHJlc3Npb246IHN0cmluZykgPT4ge1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBhZGFwdGVyLnNlbmRSZXF1ZXN0KCdldmFsdWF0ZScsIHsgZXhwcmVzc2lvbiB9LCByZXNvbHZlKSk7XG5cdFx0XHRvdXRwdXQucHVzaChgPSR7ZXhwcmVzc2lvbn1gKTtcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4gb3V0cHV0LnB1c2goJy0tZW5kIG1pY3JvdGFzay0tJykpO1xuXHRcdH07XG5cblx0XHR0ZXN0KCdpbnNlcnRzIHRhc2sgYm91bmRhcnkgYmVmb3JlIHJlc3BvbnNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgZXZhbHVhdGUoJ2JlZm9yZS5mb28nKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3V0cHV0LCBbJ2JlZm9yZS5mb28nLCAnLS1lbmQgbWljcm90YXNrLS0nLCAnPWJlZm9yZS5mb28nLCAnLS1lbmQgbWljcm90YXNrLS0nXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbnNlcnRzIHRhc2sgYm91bmRhcnkgYWZ0ZXIgcmVzcG9uc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCBldmFsdWF0ZSgnYWZ0ZXIuZm9vJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG91dHB1dCwgWyc9YWZ0ZXIuZm9vJywgJy0tZW5kIG1pY3JvdGFzay0tJywgJ2FmdGVyLmZvbycsICctLWVuZCBtaWNyb3Rhc2stLSddKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RvZXMgbm90IGluc2VydCBib3VuZGFyaWVzIGJldHdlZW4gZXZlbnRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YWRhcHRlci5zZW5kRXZlbnRCb2R5KCdvdXRwdXQnLCB7IG91dHB1dDogJ2EnIH0pO1xuXHRcdFx0YWRhcHRlci5zZW5kRXZlbnRCb2R5KCdvdXRwdXQnLCB7IG91dHB1dDogJ2InIH0pO1xuXHRcdFx0YWRhcHRlci5zZW5kRXZlbnRCb2R5KCdvdXRwdXQnLCB7IG91dHB1dDogJ2MnIH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvdXRwdXQsIFsnYScsICdiJywgJ2MnLCAnLS1lbmQgbWljcm90YXNrLS0nLCAnLS1lbmQgbWljcm90YXNrLS0nLCAnLS1lbmQgbWljcm90YXNrLS0nXSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsd0JBQXdCO0FBRWpDLE1BQU0sZ0NBQWdDLE1BQU07QUFDM0MsMENBQXdDO0FBRXhDLFFBQU0sa0JBQWtCLE1BQU07QUFDN0IsUUFBSTtBQUNKLFFBQUk7QUFDSixVQUFNLE1BQU07QUFDWCxnQkFBVSxJQUFJLGlCQUFpQjtBQUMvQixlQUFTLENBQUM7QUFDVixjQUFRLFFBQVEsUUFBTTtBQUNyQixlQUFPLEtBQU0sR0FBaUMsS0FBSyxNQUFNO0FBQ3pELGdCQUFRLFFBQVEsRUFBRSxLQUFLLE1BQU0sT0FBTyxLQUFLLG1CQUFtQixDQUFDO0FBQUEsTUFDOUQsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFVBQU0sV0FBVyxPQUFPLGVBQXVCO0FBQzlDLFlBQU0sSUFBSSxRQUFRLGFBQVcsUUFBUSxZQUFZLFlBQVksRUFBRSxXQUFXLEdBQUcsT0FBTyxDQUFDO0FBQ3JGLGFBQU8sS0FBSyxJQUFJLFVBQVUsRUFBRTtBQUM1QixjQUFRLFFBQVEsRUFBRSxLQUFLLE1BQU0sT0FBTyxLQUFLLG1CQUFtQixDQUFDO0FBQUEsSUFDOUQ7QUFFQSxTQUFLLHlDQUF5QyxZQUFZO0FBQ3pELFlBQU0sU0FBUyxZQUFZO0FBQzNCLFlBQU0sUUFBUSxDQUFDO0FBRWYsYUFBTyxnQkFBZ0IsUUFBUSxDQUFDLGNBQWMscUJBQXFCLGVBQWUsbUJBQW1CLENBQUM7QUFBQSxJQUN2RyxDQUFDO0FBRUQsU0FBSyx3Q0FBd0MsWUFBWTtBQUN4RCxZQUFNLFNBQVMsV0FBVztBQUMxQixZQUFNLFFBQVEsQ0FBQztBQUVmLGFBQU8sZ0JBQWdCLFFBQVEsQ0FBQyxjQUFjLHFCQUFxQixhQUFhLG1CQUFtQixDQUFDO0FBQUEsSUFDckcsQ0FBQztBQUVELFNBQUssNkNBQTZDLFlBQVk7QUFDN0QsY0FBUSxjQUFjLFVBQVUsRUFBRSxRQUFRLElBQUksQ0FBQztBQUMvQyxjQUFRLGNBQWMsVUFBVSxFQUFFLFFBQVEsSUFBSSxDQUFDO0FBQy9DLGNBQVEsY0FBYyxVQUFVLEVBQUUsUUFBUSxJQUFJLENBQUM7QUFDL0MsWUFBTSxRQUFRLENBQUM7QUFFZixhQUFPLGdCQUFnQixRQUFRLENBQUMsS0FBSyxLQUFLLEtBQUsscUJBQXFCLHFCQUFxQixtQkFBbUIsQ0FBQztBQUFBLElBQzlHLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
