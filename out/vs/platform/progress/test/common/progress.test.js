import assert from "assert";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { AsyncProgress } from "../../common/progress.js";
suite("Progress", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("multiple report calls are processed in sequence", async () => {
    await runWithFakedTimers({ useFakeTimers: true, maxTaskCount: 100 }, async () => {
      const executionOrder = [];
      const timeout = (time) => {
        return new Promise((resolve) => setTimeout(resolve, time));
      };
      const executor = async (value) => {
        executionOrder.push(`start ${value}`);
        if (value === 1) {
          await timeout(100);
        } else if (value === 2) {
          await timeout(50);
        } else {
          await timeout(10);
        }
        executionOrder.push(`end ${value}`);
      };
      const progress = new AsyncProgress(executor);
      progress.report(1);
      progress.report(2);
      progress.report(3);
      await timeout(1e3);
      assert.deepStrictEqual(executionOrder, [
        "start 1",
        "end 1",
        "start 2",
        "end 2",
        "start 3",
        "end 3"
      ]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9wcm9ncmVzcy90ZXN0L2NvbW1vbi9wcm9ncmVzcy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgQXN5bmNQcm9ncmVzcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5cbnN1aXRlKCdQcm9ncmVzcycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdtdWx0aXBsZSByZXBvcnQgY2FsbHMgYXJlIHByb2Nlc3NlZCBpbiBzZXF1ZW5jZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlLCBtYXhUYXNrQ291bnQ6IDEwMCB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBleGVjdXRpb25PcmRlcjogc3RyaW5nW10gPSBbXTtcblx0XHRcdGNvbnN0IHRpbWVvdXQgPSAodGltZTogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGltZSkpO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGV4ZWN1dG9yID0gYXN5bmMgKHZhbHVlOiBudW1iZXIpID0+IHtcblx0XHRcdFx0ZXhlY3V0aW9uT3JkZXIucHVzaChgc3RhcnQgJHt2YWx1ZX1gKTtcblx0XHRcdFx0aWYgKHZhbHVlID09PSAxKSB7XG5cdFx0XHRcdFx0Ly8gMSBpcyBzbG93ZXN0XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSAyKSB7XG5cdFx0XHRcdFx0Ly8gMiBpcyBhbHNvIHNsb3dcblx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyAzIGlzIGZhc3Rcblx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRleGVjdXRpb25PcmRlci5wdXNoKGBlbmQgJHt2YWx1ZX1gKTtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBwcm9ncmVzcyA9IG5ldyBBc3luY1Byb2dyZXNzPG51bWJlcj4oZXhlY3V0b3IpO1xuXG5cdFx0XHRwcm9ncmVzcy5yZXBvcnQoMSk7XG5cdFx0XHRwcm9ncmVzcy5yZXBvcnQoMik7XG5cdFx0XHRwcm9ncmVzcy5yZXBvcnQoMyk7XG5cblx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhlY3V0aW9uT3JkZXIsIFtcblx0XHRcdFx0J3N0YXJ0IDEnLFxuXHRcdFx0XHQnZW5kIDEnLFxuXHRcdFx0XHQnc3RhcnQgMicsXG5cdFx0XHRcdCdlbmQgMicsXG5cdFx0XHRcdCdzdGFydCAzJyxcblx0XHRcdFx0J2VuZCAzJyxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMscUJBQXFCO0FBRTlCLE1BQU0sWUFBWSxNQUFNO0FBRXZCLDBDQUF3QztBQUV4QyxPQUFLLG1EQUFtRCxZQUFZO0FBQ25FLFVBQU0sbUJBQW1CLEVBQUUsZUFBZSxNQUFNLGNBQWMsSUFBSSxHQUFHLFlBQVk7QUFDaEYsWUFBTSxpQkFBMkIsQ0FBQztBQUNsQyxZQUFNLFVBQVUsQ0FBQyxTQUFpQjtBQUNqQyxlQUFPLElBQUksUUFBYyxhQUFXLFdBQVcsU0FBUyxJQUFJLENBQUM7QUFBQSxNQUM5RDtBQUNBLFlBQU0sV0FBVyxPQUFPLFVBQWtCO0FBQ3pDLHVCQUFlLEtBQUssU0FBUyxLQUFLLEVBQUU7QUFDcEMsWUFBSSxVQUFVLEdBQUc7QUFFaEIsZ0JBQU0sUUFBUSxHQUFHO0FBQUEsUUFDbEIsV0FBVyxVQUFVLEdBQUc7QUFFdkIsZ0JBQU0sUUFBUSxFQUFFO0FBQUEsUUFDakIsT0FBTztBQUVOLGdCQUFNLFFBQVEsRUFBRTtBQUFBLFFBQ2pCO0FBQ0EsdUJBQWUsS0FBSyxPQUFPLEtBQUssRUFBRTtBQUFBLE1BQ25DO0FBQ0EsWUFBTSxXQUFXLElBQUksY0FBc0IsUUFBUTtBQUVuRCxlQUFTLE9BQU8sQ0FBQztBQUNqQixlQUFTLE9BQU8sQ0FBQztBQUNqQixlQUFTLE9BQU8sQ0FBQztBQUVqQixZQUFNLFFBQVEsR0FBSTtBQUVsQixhQUFPLGdCQUFnQixnQkFBZ0I7QUFBQSxRQUN0QztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
