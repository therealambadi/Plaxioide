import { deepStrictEqual } from "assert";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { OperatingSystem } from "../../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { writeP } from "../../../browser/terminalTestHelpers.js";
import { LineDataEventAddon } from "../../../browser/xterm/lineDataEventAddon.js";
suite("LineDataEventAddon", () => {
  let xterm;
  let lineDataEventAddon;
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  suite("onLineData", () => {
    let events;
    setup(async () => {
      const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
      xterm = store.add(new TerminalCtor({ allowProposedApi: true, cols: 4 }));
      lineDataEventAddon = store.add(new LineDataEventAddon());
      xterm.loadAddon(lineDataEventAddon);
      events = [];
      store.add(lineDataEventAddon.onLineData((e) => events.push(e)));
    });
    test("should fire when a non-wrapped line ends with a line feed", async () => {
      await writeP(xterm, "foo");
      deepStrictEqual(events, []);
      await writeP(xterm, "\n\r");
      deepStrictEqual(events, ["foo"]);
      await writeP(xterm, "bar");
      deepStrictEqual(events, ["foo"]);
      await writeP(xterm, "\n");
      deepStrictEqual(events, ["foo", "bar"]);
    });
    test("should not fire soft wrapped lines", async () => {
      await writeP(xterm, "foo.");
      deepStrictEqual(events, []);
      await writeP(xterm, "bar.");
      deepStrictEqual(events, []);
      await writeP(xterm, "baz.");
      deepStrictEqual(events, []);
    });
    test("should fire when a wrapped line ends with a line feed", async () => {
      await writeP(xterm, "foo.bar.baz.");
      deepStrictEqual(events, []);
      await writeP(xterm, "\n\r");
      deepStrictEqual(events, ["foo.bar.baz."]);
    });
    test("should not fire on cursor move when the backing process is not on Windows", async () => {
      await writeP(xterm, "foo.\x1B[H");
      deepStrictEqual(events, []);
    });
    test("should fire on cursor move when the backing process is on Windows", async () => {
      lineDataEventAddon.setOperatingSystem(OperatingSystem.Windows);
      await writeP(xterm, "foo\x1B[H");
      deepStrictEqual(events, ["foo"]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIveHRlcm0vbGluZURhdGFFdmVudEFkZG9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSB7IFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBpbXBvcnRBTUROb2RlTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYW1kWC5qcyc7XG5pbXBvcnQgeyBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IHdyaXRlUCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvdGVybWluYWxUZXN0SGVscGVycy5qcyc7XG5pbXBvcnQgeyBMaW5lRGF0YUV2ZW50QWRkb24gfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3h0ZXJtL2xpbmVEYXRhRXZlbnRBZGRvbi5qcyc7XG5cbnN1aXRlKCdMaW5lRGF0YUV2ZW50QWRkb24nLCAoKSA9PiB7XG5cdGxldCB4dGVybTogVGVybWluYWw7XG5cdGxldCBsaW5lRGF0YUV2ZW50QWRkb246IExpbmVEYXRhRXZlbnRBZGRvbjtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdvbkxpbmVEYXRhJywgKCkgPT4ge1xuXHRcdGxldCBldmVudHM6IHN0cmluZ1tdO1xuXG5cdFx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgVGVybWluYWxDdG9yID0gKGF3YWl0IGltcG9ydEFNRE5vZGVNb2R1bGU8dHlwZW9mIGltcG9ydCgnQHh0ZXJtL3h0ZXJtJyk+KCdAeHRlcm0veHRlcm0nLCAnbGliL3h0ZXJtLmpzJykpLlRlcm1pbmFsO1xuXHRcdFx0eHRlcm0gPSBzdG9yZS5hZGQobmV3IFRlcm1pbmFsQ3Rvcih7IGFsbG93UHJvcG9zZWRBcGk6IHRydWUsIGNvbHM6IDQgfSkpO1xuXHRcdFx0bGluZURhdGFFdmVudEFkZG9uID0gc3RvcmUuYWRkKG5ldyBMaW5lRGF0YUV2ZW50QWRkb24oKSk7XG5cdFx0XHR4dGVybS5sb2FkQWRkb24obGluZURhdGFFdmVudEFkZG9uKTtcblxuXHRcdFx0ZXZlbnRzID0gW107XG5cdFx0XHRzdG9yZS5hZGQobGluZURhdGFFdmVudEFkZG9uLm9uTGluZURhdGEoZSA9PiBldmVudHMucHVzaChlKSkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGZpcmUgd2hlbiBhIG5vbi13cmFwcGVkIGxpbmUgZW5kcyB3aXRoIGEgbGluZSBmZWVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnZm9vJyk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoZXZlbnRzLCBbXSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXG5cXHInKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChldmVudHMsIFsnZm9vJ10pO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnYmFyJyk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoZXZlbnRzLCBbJ2ZvbyddKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ1xcbicpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGV2ZW50cywgWydmb28nLCAnYmFyJ10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG5vdCBmaXJlIHNvZnQgd3JhcHBlZCBsaW5lcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ2Zvby4nKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChldmVudHMsIFtdKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ2Jhci4nKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChldmVudHMsIFtdKTtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ2Jhei4nKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChldmVudHMsIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBmaXJlIHdoZW4gYSB3cmFwcGVkIGxpbmUgZW5kcyB3aXRoIGEgbGluZSBmZWVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnZm9vLmJhci5iYXouJyk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoZXZlbnRzLCBbXSk7XG5cdFx0XHRhd2FpdCB3cml0ZVAoeHRlcm0sICdcXG5cXHInKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChldmVudHMsIFsnZm9vLmJhci5iYXouJ10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG5vdCBmaXJlIG9uIGN1cnNvciBtb3ZlIHdoZW4gdGhlIGJhY2tpbmcgcHJvY2VzcyBpcyBub3Qgb24gV2luZG93cycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUCh4dGVybSwgJ2Zvby5cXHgxYltIJyk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoZXZlbnRzLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgZmlyZSBvbiBjdXJzb3IgbW92ZSB3aGVuIHRoZSBiYWNraW5nIHByb2Nlc3MgaXMgb24gV2luZG93cycsIGFzeW5jICgpID0+IHtcblx0XHRcdGxpbmVEYXRhRXZlbnRBZGRvbi5zZXRPcGVyYXRpbmdTeXN0ZW0oT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MpO1xuXHRcdFx0YXdhaXQgd3JpdGVQKHh0ZXJtLCAnZm9vXFx4MWJbSCcpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGV2ZW50cywgWydmb28nXSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLGNBQWM7QUFDdkIsU0FBUywwQkFBMEI7QUFFbkMsTUFBTSxzQkFBc0IsTUFBTTtBQUNqQyxNQUFJO0FBQ0osTUFBSTtBQUVKLFFBQU0sUUFBUSx3Q0FBd0M7QUFFdEQsUUFBTSxjQUFjLE1BQU07QUFDekIsUUFBSTtBQUVKLFVBQU0sWUFBWTtBQUNqQixZQUFNLGdCQUFnQixNQUFNLG9CQUFtRCxnQkFBZ0IsY0FBYyxHQUFHO0FBQ2hILGNBQVEsTUFBTSxJQUFJLElBQUksYUFBYSxFQUFFLGtCQUFrQixNQUFNLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDdkUsMkJBQXFCLE1BQU0sSUFBSSxJQUFJLG1CQUFtQixDQUFDO0FBQ3ZELFlBQU0sVUFBVSxrQkFBa0I7QUFFbEMsZUFBUyxDQUFDO0FBQ1YsWUFBTSxJQUFJLG1CQUFtQixXQUFXLE9BQUssT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDN0QsQ0FBQztBQUVELFNBQUssNkRBQTZELFlBQVk7QUFDN0UsWUFBTSxPQUFPLE9BQU8sS0FBSztBQUN6QixzQkFBZ0IsUUFBUSxDQUFDLENBQUM7QUFDMUIsWUFBTSxPQUFPLE9BQU8sTUFBTTtBQUMxQixzQkFBZ0IsUUFBUSxDQUFDLEtBQUssQ0FBQztBQUMvQixZQUFNLE9BQU8sT0FBTyxLQUFLO0FBQ3pCLHNCQUFnQixRQUFRLENBQUMsS0FBSyxDQUFDO0FBQy9CLFlBQU0sT0FBTyxPQUFPLElBQUk7QUFDeEIsc0JBQWdCLFFBQVEsQ0FBQyxPQUFPLEtBQUssQ0FBQztBQUFBLElBQ3ZDLENBQUM7QUFFRCxTQUFLLHNDQUFzQyxZQUFZO0FBQ3RELFlBQU0sT0FBTyxPQUFPLE1BQU07QUFDMUIsc0JBQWdCLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLFlBQU0sT0FBTyxPQUFPLE1BQU07QUFDMUIsc0JBQWdCLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLFlBQU0sT0FBTyxPQUFPLE1BQU07QUFDMUIsc0JBQWdCLFFBQVEsQ0FBQyxDQUFDO0FBQUEsSUFDM0IsQ0FBQztBQUVELFNBQUsseURBQXlELFlBQVk7QUFDekUsWUFBTSxPQUFPLE9BQU8sY0FBYztBQUNsQyxzQkFBZ0IsUUFBUSxDQUFDLENBQUM7QUFDMUIsWUFBTSxPQUFPLE9BQU8sTUFBTTtBQUMxQixzQkFBZ0IsUUFBUSxDQUFDLGNBQWMsQ0FBQztBQUFBLElBQ3pDLENBQUM7QUFFRCxTQUFLLDZFQUE2RSxZQUFZO0FBQzdGLFlBQU0sT0FBTyxPQUFPLFlBQVk7QUFDaEMsc0JBQWdCLFFBQVEsQ0FBQyxDQUFDO0FBQUEsSUFDM0IsQ0FBQztBQUVELFNBQUsscUVBQXFFLFlBQVk7QUFDckYseUJBQW1CLG1CQUFtQixnQkFBZ0IsT0FBTztBQUM3RCxZQUFNLE9BQU8sT0FBTyxXQUFXO0FBQy9CLHNCQUFnQixRQUFRLENBQUMsS0FBSyxDQUFDO0FBQUEsSUFDaEMsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
