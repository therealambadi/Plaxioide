import assert from "assert";
import { List } from "../../../../browser/ui/list/listWidget.js";
import { range } from "../../../../common/arrays.js";
import { timeout } from "../../../../common/async.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
suite("ListWidget", function() {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("Page up and down", async function() {
    const element = document.createElement("div");
    element.style.height = "200px";
    element.style.width = "200px";
    const delegate = {
      getHeight() {
        return 20;
      },
      getTemplateId() {
        return "template";
      }
    };
    let templatesCount = 0;
    const renderer = {
      templateId: "template",
      renderTemplate() {
        templatesCount++;
      },
      renderElement() {
      },
      disposeTemplate() {
        templatesCount--;
      }
    };
    const listWidget = store.add(new List("test", element, delegate, [renderer]));
    listWidget.layout(200);
    assert.strictEqual(templatesCount, 0, "no templates have been allocated");
    listWidget.splice(0, 0, range(100));
    listWidget.focusFirst();
    listWidget.focusNextPage();
    assert.strictEqual(listWidget.getFocus()[0], 9, "first page down moves focus to element at bottom");
    listWidget.focusNextPage();
    await timeout(0);
    assert.strictEqual(listWidget.getFocus()[0], 19, "page down to next page");
    listWidget.focusPreviousPage();
    assert.strictEqual(listWidget.getFocus()[0], 10, "first page up moves focus to element at top");
    listWidget.focusPreviousPage();
    await timeout(0);
    assert.strictEqual(listWidget.getFocus()[0], 0, "page down to previous page");
  });
  test("Page up and down with item taller than viewport #149502", async function() {
    const element = document.createElement("div");
    element.style.height = "200px";
    element.style.width = "200px";
    const delegate = {
      getHeight() {
        return 200;
      },
      getTemplateId() {
        return "template";
      }
    };
    let templatesCount = 0;
    const renderer = {
      templateId: "template",
      renderTemplate() {
        templatesCount++;
      },
      renderElement() {
      },
      disposeTemplate() {
        templatesCount--;
      }
    };
    const listWidget = store.add(new List("test", element, delegate, [renderer]));
    listWidget.layout(200);
    assert.strictEqual(templatesCount, 0, "no templates have been allocated");
    listWidget.splice(0, 0, range(100));
    listWidget.focusFirst();
    assert.strictEqual(listWidget.getFocus()[0], 0, "initial focus is first element");
    listWidget.focusNextPage();
    await timeout(0);
    assert.strictEqual(listWidget.getFocus()[0], 1, "page down to next page");
    listWidget.focusPreviousPage();
    await timeout(0);
    assert.strictEqual(listWidget.getFocus()[0], 0, "page up to next page");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElMaXN0UmVuZGVyZXIsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IHJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdMaXN0V2lkZ2V0JywgZnVuY3Rpb24gKCkge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ1BhZ2UgdXAgYW5kIGRvd24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gJzIwMHB4Jztcblx0XHRlbGVtZW50LnN0eWxlLndpZHRoID0gJzIwMHB4JztcblxuXHRcdGNvbnN0IGRlbGVnYXRlOiBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxudW1iZXI+ID0ge1xuXHRcdFx0Z2V0SGVpZ2h0KCkgeyByZXR1cm4gMjA7IH0sXG5cdFx0XHRnZXRUZW1wbGF0ZUlkKCkgeyByZXR1cm4gJ3RlbXBsYXRlJzsgfVxuXHRcdH07XG5cblx0XHRsZXQgdGVtcGxhdGVzQ291bnQgPSAwO1xuXG5cdFx0Y29uc3QgcmVuZGVyZXI6IElMaXN0UmVuZGVyZXI8bnVtYmVyLCB2b2lkPiA9IHtcblx0XHRcdHRlbXBsYXRlSWQ6ICd0ZW1wbGF0ZScsXG5cdFx0XHRyZW5kZXJUZW1wbGF0ZSgpIHsgdGVtcGxhdGVzQ291bnQrKzsgfSxcblx0XHRcdHJlbmRlckVsZW1lbnQoKSB7IH0sXG5cdFx0XHRkaXNwb3NlVGVtcGxhdGUoKSB7IHRlbXBsYXRlc0NvdW50LS07IH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbGlzdFdpZGdldCA9IHN0b3JlLmFkZChuZXcgTGlzdDxudW1iZXI+KCd0ZXN0JywgZWxlbWVudCwgZGVsZWdhdGUsIFtyZW5kZXJlcl0pKTtcblxuXHRcdGxpc3RXaWRnZXQubGF5b3V0KDIwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlbXBsYXRlc0NvdW50LCAwLCAnbm8gdGVtcGxhdGVzIGhhdmUgYmVlbiBhbGxvY2F0ZWQnKTtcblx0XHRsaXN0V2lkZ2V0LnNwbGljZSgwLCAwLCByYW5nZSgxMDApKTtcblx0XHRsaXN0V2lkZ2V0LmZvY3VzRmlyc3QoKTtcblxuXHRcdGxpc3RXaWRnZXQuZm9jdXNOZXh0UGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0V2lkZ2V0LmdldEZvY3VzKClbMF0sIDksICdmaXJzdCBwYWdlIGRvd24gbW92ZXMgZm9jdXMgdG8gZWxlbWVudCBhdCBib3R0b20nKTtcblxuXHRcdC8vIHNjcm9sbCB0byBuZXh0IHBhZ2UgaXMgYXN5bmNcblx0XHRsaXN0V2lkZ2V0LmZvY3VzTmV4dFBhZ2UoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0V2lkZ2V0LmdldEZvY3VzKClbMF0sIDE5LCAncGFnZSBkb3duIHRvIG5leHQgcGFnZScpO1xuXG5cdFx0bGlzdFdpZGdldC5mb2N1c1ByZXZpb3VzUGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0V2lkZ2V0LmdldEZvY3VzKClbMF0sIDEwLCAnZmlyc3QgcGFnZSB1cCBtb3ZlcyBmb2N1cyB0byBlbGVtZW50IGF0IHRvcCcpO1xuXG5cdFx0Ly8gc2Nyb2xsIHRvIHByZXZpb3VzIHBhZ2UgaXMgYXN5bmNcblx0XHRsaXN0V2lkZ2V0LmZvY3VzUHJldmlvdXNQYWdlKCk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdFdpZGdldC5nZXRGb2N1cygpWzBdLCAwLCAncGFnZSBkb3duIHRvIHByZXZpb3VzIHBhZ2UnKTtcblx0fSk7XG5cblx0dGVzdCgnUGFnZSB1cCBhbmQgZG93biB3aXRoIGl0ZW0gdGFsbGVyIHRoYW4gdmlld3BvcnQgIzE0OTUwMicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnMjAwcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnMjAwcHgnO1xuXG5cdFx0Y29uc3QgZGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPG51bWJlcj4gPSB7XG5cdFx0XHRnZXRIZWlnaHQoKSB7IHJldHVybiAyMDA7IH0sXG5cdFx0XHRnZXRUZW1wbGF0ZUlkKCkgeyByZXR1cm4gJ3RlbXBsYXRlJzsgfVxuXHRcdH07XG5cblx0XHRsZXQgdGVtcGxhdGVzQ291bnQgPSAwO1xuXG5cdFx0Y29uc3QgcmVuZGVyZXI6IElMaXN0UmVuZGVyZXI8bnVtYmVyLCB2b2lkPiA9IHtcblx0XHRcdHRlbXBsYXRlSWQ6ICd0ZW1wbGF0ZScsXG5cdFx0XHRyZW5kZXJUZW1wbGF0ZSgpIHsgdGVtcGxhdGVzQ291bnQrKzsgfSxcblx0XHRcdHJlbmRlckVsZW1lbnQoKSB7IH0sXG5cdFx0XHRkaXNwb3NlVGVtcGxhdGUoKSB7IHRlbXBsYXRlc0NvdW50LS07IH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbGlzdFdpZGdldCA9IHN0b3JlLmFkZChuZXcgTGlzdDxudW1iZXI+KCd0ZXN0JywgZWxlbWVudCwgZGVsZWdhdGUsIFtyZW5kZXJlcl0pKTtcblxuXHRcdGxpc3RXaWRnZXQubGF5b3V0KDIwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlbXBsYXRlc0NvdW50LCAwLCAnbm8gdGVtcGxhdGVzIGhhdmUgYmVlbiBhbGxvY2F0ZWQnKTtcblx0XHRsaXN0V2lkZ2V0LnNwbGljZSgwLCAwLCByYW5nZSgxMDApKTtcblx0XHRsaXN0V2lkZ2V0LmZvY3VzRmlyc3QoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdFdpZGdldC5nZXRGb2N1cygpWzBdLCAwLCAnaW5pdGlhbCBmb2N1cyBpcyBmaXJzdCBlbGVtZW50Jyk7XG5cblx0XHQvLyBzY3JvbGwgdG8gbmV4dCBwYWdlIGlzIGFzeW5jXG5cdFx0bGlzdFdpZGdldC5mb2N1c05leHRQYWdlKCk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdFdpZGdldC5nZXRGb2N1cygpWzBdLCAxLCAncGFnZSBkb3duIHRvIG5leHQgcGFnZScpO1xuXG5cdFx0Ly8gc2Nyb2xsIHRvIHByZXZpb3VzIHBhZ2UgaXMgYXN5bmNcblx0XHRsaXN0V2lkZ2V0LmZvY3VzUHJldmlvdXNQYWdlKCk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdFdpZGdldC5nZXRGb2N1cygpWzBdLCAwLCAncGFnZSB1cCB0byBuZXh0IHBhZ2UnKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUVuQixTQUFTLFlBQVk7QUFDckIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLCtDQUErQztBQUV4RCxNQUFNLGNBQWMsV0FBWTtBQUMvQixRQUFNLFFBQVEsd0NBQXdDO0FBRXRELE9BQUssb0JBQW9CLGlCQUFrQjtBQUMxQyxVQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsWUFBUSxNQUFNLFNBQVM7QUFDdkIsWUFBUSxNQUFNLFFBQVE7QUFFdEIsVUFBTSxXQUF5QztBQUFBLE1BQzlDLFlBQVk7QUFBRSxlQUFPO0FBQUEsTUFBSTtBQUFBLE1BQ3pCLGdCQUFnQjtBQUFFLGVBQU87QUFBQSxNQUFZO0FBQUEsSUFDdEM7QUFFQSxRQUFJLGlCQUFpQjtBQUVyQixVQUFNLFdBQXdDO0FBQUEsTUFDN0MsWUFBWTtBQUFBLE1BQ1osaUJBQWlCO0FBQUU7QUFBQSxNQUFrQjtBQUFBLE1BQ3JDLGdCQUFnQjtBQUFBLE1BQUU7QUFBQSxNQUNsQixrQkFBa0I7QUFBRTtBQUFBLE1BQWtCO0FBQUEsSUFDdkM7QUFFQSxVQUFNLGFBQWEsTUFBTSxJQUFJLElBQUksS0FBYSxRQUFRLFNBQVMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRXBGLGVBQVcsT0FBTyxHQUFHO0FBQ3JCLFdBQU8sWUFBWSxnQkFBZ0IsR0FBRyxrQ0FBa0M7QUFDeEUsZUFBVyxPQUFPLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUNsQyxlQUFXLFdBQVc7QUFFdEIsZUFBVyxjQUFjO0FBQ3pCLFdBQU8sWUFBWSxXQUFXLFNBQVMsRUFBRSxDQUFDLEdBQUcsR0FBRyxrREFBa0Q7QUFHbEcsZUFBVyxjQUFjO0FBQ3pCLFVBQU0sUUFBUSxDQUFDO0FBQ2YsV0FBTyxZQUFZLFdBQVcsU0FBUyxFQUFFLENBQUMsR0FBRyxJQUFJLHdCQUF3QjtBQUV6RSxlQUFXLGtCQUFrQjtBQUM3QixXQUFPLFlBQVksV0FBVyxTQUFTLEVBQUUsQ0FBQyxHQUFHLElBQUksNkNBQTZDO0FBRzlGLGVBQVcsa0JBQWtCO0FBQzdCLFVBQU0sUUFBUSxDQUFDO0FBQ2YsV0FBTyxZQUFZLFdBQVcsU0FBUyxFQUFFLENBQUMsR0FBRyxHQUFHLDRCQUE0QjtBQUFBLEVBQzdFLENBQUM7QUFFRCxPQUFLLDJEQUEyRCxpQkFBa0I7QUFDakYsVUFBTSxVQUFVLFNBQVMsY0FBYyxLQUFLO0FBQzVDLFlBQVEsTUFBTSxTQUFTO0FBQ3ZCLFlBQVEsTUFBTSxRQUFRO0FBRXRCLFVBQU0sV0FBeUM7QUFBQSxNQUM5QyxZQUFZO0FBQUUsZUFBTztBQUFBLE1BQUs7QUFBQSxNQUMxQixnQkFBZ0I7QUFBRSxlQUFPO0FBQUEsTUFBWTtBQUFBLElBQ3RDO0FBRUEsUUFBSSxpQkFBaUI7QUFFckIsVUFBTSxXQUF3QztBQUFBLE1BQzdDLFlBQVk7QUFBQSxNQUNaLGlCQUFpQjtBQUFFO0FBQUEsTUFBa0I7QUFBQSxNQUNyQyxnQkFBZ0I7QUFBQSxNQUFFO0FBQUEsTUFDbEIsa0JBQWtCO0FBQUU7QUFBQSxNQUFrQjtBQUFBLElBQ3ZDO0FBRUEsVUFBTSxhQUFhLE1BQU0sSUFBSSxJQUFJLEtBQWEsUUFBUSxTQUFTLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUVwRixlQUFXLE9BQU8sR0FBRztBQUNyQixXQUFPLFlBQVksZ0JBQWdCLEdBQUcsa0NBQWtDO0FBQ3hFLGVBQVcsT0FBTyxHQUFHLEdBQUcsTUFBTSxHQUFHLENBQUM7QUFDbEMsZUFBVyxXQUFXO0FBQ3RCLFdBQU8sWUFBWSxXQUFXLFNBQVMsRUFBRSxDQUFDLEdBQUcsR0FBRyxnQ0FBZ0M7QUFHaEYsZUFBVyxjQUFjO0FBQ3pCLFVBQU0sUUFBUSxDQUFDO0FBQ2YsV0FBTyxZQUFZLFdBQVcsU0FBUyxFQUFFLENBQUMsR0FBRyxHQUFHLHdCQUF3QjtBQUd4RSxlQUFXLGtCQUFrQjtBQUM3QixVQUFNLFFBQVEsQ0FBQztBQUNmLFdBQU8sWUFBWSxXQUFXLFNBQVMsRUFBRSxDQUFDLEdBQUcsR0FBRyxzQkFBc0I7QUFBQSxFQUN2RSxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
